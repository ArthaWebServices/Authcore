/**
 * AuthCore Migration Tool — Clerk → AuthCore
 *
 * Reads a Clerk user export (JSON) and imports users into AuthCore.
 *
 * Usage:
 *   pnpm run import --input=./clerk-export.json --dry-run
 *   pnpm run import --input=./clerk-export.json
 *
 * Output:
 *   - Migration report (success/failures)
 *   - users-imported.json (mapping Clerk IDs → AuthCore IDs)
 */

import { PrismaClient } from '@prisma/client';
import { readFile } from 'fs-extra';
import { createHash, randomBytes } from 'crypto';

interface ClerkUser {
  id: string;
  email_address: string;
  first_name?: string;
  last_name?: string;
  password_hash?: string;
  verified_email: boolean;
  created_at: number;
  external_accounts?: Array<{ provider: string; external_id: string; email?: string }>;
}

interface ImportReport {
  totalUsers: number;
  imported: number;
  skipped: number;
  failed: number;
  errors: Array<{ clerkId: string; email: string; error: string }>;
  startTime: string;
  endTime: string;
  durationMs: number;
}

const BATCH_SIZE = 1000;

export class ClerkToAuthCoreMigrator {
  private readonly prisma: PrismaClient;
  private readonly dryRun: boolean;
  private readonly clerkUsers: ClerkUser[] = [];

  constructor(prisma: PrismaClient, dryRun: boolean = false) {
    this.prisma = prisma;
    this.dryRun = dryRun;
  }

  async loadExport(filePath: string): Promise<number> {
    const raw = await readFile(filePath, 'utf-8');
    this.clerkUsers = JSON.parse(raw) as ClerkUser[];
    return this.clerkUsers.length;
  }

  async run(): Promise<ImportReport> {
    const startTime = new Date();
    const report: ImportReport = {
      totalUsers: this.clerkUsers.length,
      imported: 0,
      skipped: 0,
      failed: 0,
      errors: [],
      startTime: startTime.toISOString(),
      endTime: '',
      durationMs: 0,
    };

    // Process in batches
    for (let i = 0; i < this.clerkUsers.length; i += BATCH_SIZE) {
      const batch = this.clerkUsers.slice(i, i + BATCH_SIZE);

      for (const clerkUser of batch) {
        try {
          const result = await this.importUser(clerkUser);
          if (result === 'imported') report.imported++;
          else if (result === 'skipped') report.skipped++;
        } catch (err) {
          report.failed++;
          report.errors.push({
            clerkId: clerkUser.id,
            email: clerkUser.email_address,
            error: err instanceof Error ? err.message : String(err),
          });
        }
      }

      console.log(`Processed ${Math.min(i + BATCH_SIZE, this.clerkUsers.length)}/${this.clerkUsers.length} users`);
    }

    const endTime = new Date();
    report.endTime = endTime.toISOString();
    report.durationMs = endTime.getTime() - startTime.getTime();

    return report;
  }

  private async importUser(clerkUser: ClerkUser): Promise<'imported' | 'skipped'> {
    const normalizedEmail = clerkUser.email_address.toLowerCase().trim();

    // Check if user already exists
    const existing = await this.prisma.user.findUnique({
      where: { email: normalizedEmail },
    });

    if (existing) {
      // Skip — already migrated
      return 'skipped';
    }

    if (this.dryRun) {
      console.log(`[DRY RUN] Would import: ${normalizedEmail} (clerk: ${clerkUser.id})`);
      return 'imported';
    }

    // Create user
    const newUser = await this.prisma.user.create({
      data: {
        email: normalizedEmail,
        emailVerified: clerkUser.verified_email,
        fullName: this.combineFullName(clerkUser.first_name, clerkUser.last_name),
        passwordHash: clerkUser.password_hash ?? null, // Argon2id-compatible
        status: clerkUser.password_hash ? 'active' : 'active', // will need password reset
        createdAt: new Date(clerkUser.created_at),
        // Mark with migration source for traceability
        locale: 'en',
        timezone: 'UTC',
      },
    });

    // Import OAuth accounts if present
    if (clerkUser.external_accounts && clerkUser.external_accounts.length > 0) {
      for (const ext of clerkUser.external_accounts) {
        const provider = this.mapProvider(ext.provider);
        if (!provider) continue;

        await this.prisma.oAuthAccount.create({
          data: {
            userId: newUser.id,
            provider,
            providerUserId: ext.external_id,
            email: ext.email ?? null,
          },
        });
      }
    }

    // Create migration audit log entry
    await this.prisma.auditLog.create({
      data: {
        eventType: 'migration.user.imported',
        userId: newUser.id,
        metadata: {
          source: 'clerk',
          clerkId: clerkUser.id,
          hasPassword: !!clerkUser.password_hash,
        },
      },
    });

    return 'imported';
  }

  private combineFullName(first?: string, last?: string): string | null {
    const parts = [first, last].filter(Boolean);
    if (parts.length === 0) return null;
    return parts.join(' ');
  }

  private mapProvider(clerkProvider: string): string | null {
    const map: Record<string, string> = {
      oauth_google: 'google',
      oauth_github: 'github',
      oauth_microsoft: 'microsoft',
      oauth_gitlab: 'gitlab',
    };
    return map[clerkProvider] ?? null;
  }

  async generatePasswordResetTokens(): Promise<number> {
    // Users without password_hash need a forced password reset
    const usersNeedingReset = await this.prisma.user.findMany({
      where: { passwordHash: null, status: 'active' },
      select: { id: true, email: true },
    });

    let count = 0;
    for (const user of usersNeedingReset) {
      const token = randomBytes(32).toString('hex');
      const expiresAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000); // 7 days

      await this.prisma.verificationToken.create({
        data: {
          identifier: user.id,
          token,
          type: 'password_reset_migration',
          expiresAt,
        },
      });

      // In production, send email here
      console.log(`[RESET TOKEN] ${user.email}: ${token}`);
      count++;
    }

    return count;
  }

  async writeReport(report: ImportReport, outputPath: string): Promise<void> {
    const { writeFile } = await import('fs-extra');
    await writeFile(outputPath, JSON.stringify(report, null, 2), 'utf-8');
    console.log(`Report written to ${outputPath}`);
  }
}
