import { prisma } from '@shared/prisma';
import { logger } from '@shared/logger';
import { NotFoundError, ValidationError } from '@shared/errors';
import type { Organization, Membership } from '@prisma/client';

export interface OrganizationPublic {
  id: string;
  name: string;
  slug: string;
  description: string | null;
  createdAt: Date;
}

export interface MembershipPublic {
  id: string;
  userId: string;
  organizationId: string;
  role: string;
  createdAt: Date;
}

export class OrganizationService {
  async create(data: { name: string; slug: string; description?: string }): Promise<OrganizationPublic> {
    const existing = await prisma.organization.findUnique({ where: { slug: data.slug } });
    if (existing) {
      throw new ValidationError('Organization with this slug already exists');
    }

    const org = await prisma.organization.create({
      data: {
        name: data.name,
        slug: data.slug,
        description: data.description ?? null,
      },
    });

    // Create default roles for the organization
    await this.createDefaultRoles(org.id);

    logger.info({ orgId: org.id, slug: org.slug }, 'Organization created');
    return this.toPublic(org);
  }

  async findById(id: string): Promise<OrganizationPublic> {
    const org = await prisma.organization.findUnique({ where: { id } });
    if (!org || org.deletedAt) {
      throw new NotFoundError('Organization');
    }
    return this.toPublic(org);
  }

  async findBySlug(slug: string): Promise<OrganizationPublic> {
    const org = await prisma.organization.findUnique({ where: { slug } });
    if (!org || org.deletedAt) {
      throw new NotFoundError('Organization');
    }
    return this.toPublic(org);
  }

  async listForUser(userId: string): Promise<OrganizationPublic[]> {
    const memberships = await prisma.membership.findMany({
      where: { userId },
      include: { organization: true },
      orderBy: { createdAt: 'desc' },
    });

    return memberships
      .filter((m) => m.organization && !m.organization.deletedAt)
      .map((m) => this.toPublic(m.organization));
  }

  async addMember(organizationId: string, userId: string, roleName: string = 'member'): Promise<MembershipPublic> {
    const org = await prisma.organization.findUnique({ where: { id: organizationId } });
    if (!org) throw new NotFoundError('Organization');

    const role = await prisma.role.findFirst({
      where: { name: roleName, organizationId },
    });
    if (!role) throw new NotFoundError('Role');

    const existing = await prisma.membership.findFirst({
      where: { userId, organizationId },
    });
    if (existing) {
      throw new ValidationError('User is already a member');
    }

    const membership = await prisma.membership.create({
      data: { userId, organizationId, roleId: role.id },
    });

    logger.info({ orgId: organizationId, userId, role: roleName }, 'Member added to organization');
    return {
      id: membership.id,
      userId: membership.userId,
      organizationId: membership.organizationId,
      role: roleName,
      createdAt: membership.createdAt,
    };
  }

  async removeMember(organizationId: string, userId: string): Promise<void> {
    const membership = await prisma.membership.findFirst({
      where: { userId, organizationId },
    });
    if (!membership) throw new NotFoundError('Membership');

    await prisma.membership.delete({ where: { id: membership.id } });
    logger.info({ orgId: organizationId, userId }, 'Member removed from organization');
  }

  async getUserRole(organizationId: string, userId: string): Promise<string | null> {
    const membership = await prisma.membership.findFirst({
      where: { userId, organizationId },
      include: { role: true },
    });
    return membership?.role?.name ?? null;
  }

  async listMembers(organizationId: string): Promise<MembershipPublic[]> {
    const memberships = await prisma.membership.findMany({
      where: { organizationId },
      include: { role: true },
    });

    return memberships.map((m) => ({
      id: m.id,
      userId: m.userId,
      organizationId: m.organizationId,
      role: m.role?.name ?? 'unknown',
      createdAt: m.createdAt,
    }));
  }

  async updateRole(organizationId: string, userId: string, newRole: string): Promise<MembershipPublic> {
    const role = await prisma.role.findFirst({
      where: { name: newRole, organizationId },
    });
    if (!role) throw new NotFoundError('Role');

    const membership = await prisma.membership.findFirst({
      where: { userId, organizationId },
    });
    if (!membership) throw new NotFoundError('Membership');

    const updated = await prisma.membership.update({
      where: { id: membership.id },
      data: { roleId: role.id },
    });

    logger.info({ orgId: organizationId, userId, role: newRole }, 'Member role updated');
    return {
      id: updated.id,
      userId: updated.userId,
      organizationId: updated.organizationId,
      role: newRole,
      createdAt: updated.createdAt,
    };
  }

  private async createDefaultRoles(organizationId: string): Promise<void> {
    const defaultRoles = [
      { name: 'owner', description: 'Full control over the organization' },
      { name: 'admin', description: 'Manage members and settings' },
      { name: 'member', description: 'Standard member access' },
    ];

    for (const role of defaultRoles) {
      await prisma.role.create({
        data: {
          name: role.name,
          description: role.description,
          organizationId,
          isSystem: false,
        },
      });
    }
  }

  private toPublic(org: Organization): OrganizationPublic {
    return {
      id: org.id,
      name: org.name,
      slug: org.slug,
      description: org.description,
      createdAt: org.createdAt,
    };
  }
}
