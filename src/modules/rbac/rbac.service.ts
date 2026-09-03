import { prisma } from '@shared/prisma';
import { logger } from '@shared/logger';
import { NotFoundError, ValidationError } from '@shared/errors';

export interface RolePublic {
  id: string;
  name: string;
  description: string | null;
  organizationId: string | null;
  permissions: string[];
}

export interface PermissionPublic {
  id: string;
  name: string;
  resource: string;
  action: string;
  description: string | null;
}

export class RbacService {
  async createRole(data: { name: string; description?: string; organizationId?: string; permissions: string[] }): Promise<RolePublic> {
    const existing = await prisma.role.findFirst({
      where: { name: data.name, organizationId: data.organizationId ?? null },
    });
    if (existing) {
      throw new ValidationError('Role with this name already exists');
    }

    const role = await prisma.role.create({
      data: {
        name: data.name,
        description: data.description ?? null,
        organizationId: data.organizationId ?? null,
        isSystem: false,
      },
    });

    // Attach permissions
    for (const permName of data.permissions) {
      const perm = await prisma.permission.findUnique({ where: { name: permName } });
      if (!perm) {
        throw new ValidationError(`Unknown permission: ${permName}`);
      }
      await prisma.rolePermission.create({
        data: { roleId: role.id, permissionId: perm.id },
      });
    }

    logger.info({ roleId: role.id, name: role.name }, 'Role created');
    return this.toPublic(role, data.permissions);
  }

  async listRoles(organizationId?: string): Promise<RolePublic[]> {
    const roles = await prisma.role.findMany({
      where: {
        OR: [
          { organizationId: null, isSystem: true },
          { organizationId: organizationId ?? undefined },
        ],
      },
    });

    const result: RolePublic[] = [];
    for (const role of roles) {
      const perms = await this.getRolePermissions(role.id);
      result.push(this.toPublic(role, perms));
    }
    return result;
  }

  async getRole(roleId: string): Promise<RolePublic> {
    const role = await prisma.role.findUnique({ where: { id: roleId } });
    if (!role) throw new NotFoundError('Role');
    const permissions = await this.getRolePermissions(role.id);
    return this.toPublic(role, permissions);
  }

  async listPermissions(): Promise<PermissionPublic[]> {
    const perms = await prisma.permission.findMany({ orderBy: { name: 'asc' } });
    return perms.map((p) => ({
      id: p.id,
      name: p.name,
      resource: p.resource,
      action: p.action,
      description: p.description,
    }));
  }

  async hasPermission(userId: string, permissionName: string, organizationId?: string): Promise<boolean> {
    const memberships = await prisma.membership.findMany({
      where: {
        userId,
        ...(organizationId ? { organizationId } : {}),
      },
      include: { role: { include: { permissions: { include: { permission: true } } } } },
    });

    for (const m of memberships) {
      const permNames = m.role.permissions.map((rp) => rp.permission.name);
      if (permNames.includes(permissionName)) return true;
    }
    return false;
  }

  async getUserPermissions(userId: string, organizationId?: string): Promise<string[]> {
    const memberships = await prisma.membership.findMany({
      where: { userId, ...(organizationId ? { organizationId } : {}) },
      include: { role: { include: { permissions: { include: { permission: true } } } } },
    });

    const all = new Set<string>();
    for (const m of memberships) {
      for (const rp of m.role.permissions) {
        all.add(rp.permission.name);
      }
    }
    return Array.from(all);
  }

  async grantPermission(roleId: string, permissionName: string): Promise<void> {
    const perm = await prisma.permission.findUnique({ where: { name: permissionName } });
    if (!perm) throw new NotFoundError('Permission');

    const existing = await prisma.rolePermission.findFirst({
      where: { roleId, permissionId: perm.id },
    });
    if (existing) return; // already granted

    await prisma.rolePermission.create({ data: { roleId, permissionId: perm.id } });
    logger.info({ roleId, permission: permissionName }, 'Permission granted to role');
  }

  async revokePermission(roleId: string, permissionName: string): Promise<void> {
    const perm = await prisma.permission.findUnique({ where: { name: permissionName } });
    if (!perm) throw new NotFoundError('Permission');

    await prisma.rolePermission.deleteMany({
      where: { roleId, permissionId: perm.id },
    });
    logger.info({ roleId, permission: permissionName }, 'Permission revoked from role');
  }

  private async getRolePermissions(roleId: string): Promise<string[]> {
    const rps = await prisma.rolePermission.findMany({
      where: { roleId },
      include: { permission: true },
    });
    return rps.map((rp) => rp.permission.name);
  }

  private toPublic(role: { id: string; name: string; description: string | null; organizationId: string | null }, permissions: string[]): RolePublic {
    return {
      id: role.id,
      name: role.name,
      description: role.description,
      organizationId: role.organizationId,
      permissions,
    };
  }
}
