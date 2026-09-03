#!/usr/bin/env node
import { Command } from 'commander';
import { PrismaClient } from '@prisma/client';
import { ClerkToAuthCoreMigrator } from './importer';

const program = new Command();

program
  .name('authcore-migrate')
  .description('Migrate users from Clerk to AuthCore')
  .version('1.0.0')
  .requiredOption('-i, --input <path>', 'Path to Clerk export JSON')
  .option('--dry-run', 'Run without writing to database', false)
  .option('--generate-resets', 'Generate password reset tokens for users without passwords', false)
  .option('-o, --output <path>', 'Output report path', './migration-report.json');

program.parse();

const options = program.opts();

async function main() {
  if (!process.env.DATABASE_URL) {
    console.error('DATABASE_URL environment variable is required');
    process.exit(1);
  }

  const prisma = new PrismaClient();
  const migrator = new ClerkToAuthCoreMigrator(prisma, options.dryRun);

  try {
    console.log(`Loading Clerk export from ${options.input}...`);
    const count = await migrator.loadExport(options.input);
    console.log(`Loaded ${count} users. Starting migration${options.dryRun ? ' (DRY RUN)' : ''}...`);

    const report = await migrator.run();

    console.log('\n========== Migration Report ==========');
    console.log(`Total users:     ${report.totalUsers}`);
    console.log(`Imported:        ${report.imported}`);
    console.log(`Skipped:         ${report.skipped}`);
    console.log(`Failed:          ${report.failed}`);
    console.log(`Duration:        ${(report.durationMs / 1000).toFixed(2)}s`);

    if (report.errors.length > 0) {
      console.log('\nErrors:');
      for (const err of report.errors.slice(0, 10)) {
        console.log(`  - ${err.email}: ${err.error}`);
      }
      if (report.errors.length > 10) {
        console.log(`  ... and ${report.errors.length - 10} more`);
      }
    }

    if (options.generateResets) {
      console.log('\nGenerating password reset tokens...');
      const resetCount = await migrator.generatePasswordResetTokens();
      console.log(`Generated ${resetCount} reset tokens.`);
    }

    await migrator.writeReport(report, options.output);
  } catch (err) {
    console.error('Migration failed:', err);
    process.exit(1);
  } finally {
    await prisma.$disconnect();
  }
}

main();
