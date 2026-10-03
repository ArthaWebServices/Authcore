import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

const DEFAULT_PERMISSIONS = [
  { name: 'users:read', description: 'Read user profiles', resource: 'users', action: 'read' },
  { name: 'users:write', description: 'Update user profiles', resource: 'users', action: 'write' },
  { name: 'users:delete', description: 'Delete users', resource: 'users', action: 'delete' },
  { name: 'roles:read', description: 'Read roles and permissions', resource: 'roles', action: 'read' },
  { name: 'roles:write', description: 'Manage roles and permissions', resource: 'roles', action: 'write' },
  { name: 'org:read', description: 'Read organization details', resource: 'org', action: 'read' },
  { name: 'org:write', description: 'Update organization settings', resource: 'org', action: 'write' },
  { name: 'org:delete', description: 'Delete organizations', resource: 'org', action: 'delete' },
  { name: 'sessions:read', description: 'Inspect active sessions', resource: 'sessions', action: 'read' },
  { name: 'sessions:revoke', description: 'Revoke active sessions', resource: 'sessions', action: 'revoke' },
  { name: 'audit:read', description: 'Read audit logs', resource: 'audit', action: 'read' },
  { name: 'webhooks:read', description: 'Read webhooks', resource: 'webhooks', action: 'read' },
  { name: 'webhooks:write', description: 'Manage webhooks', resource: 'webhooks', action: 'write' },
  { name: 'apikeys:read', description: 'Read API keys', resource: 'apikeys', action: 'read' },
  { name: 'apikeys:write', description: 'Manage API keys', resource: 'apikeys', action: 'write' },
];

const DEFAULT_ROLES = [
  { name: 'admin', description: 'Full system administrator', isSystem: true },
  { name: 'member', description: 'Standard organization member', isSystem: true },
  { name: 'viewer', description: 'Read-only access', isSystem: true },
];

async function main() {
  console.log('🌱 Starting database seed...');

  // 1. Seed Permissions
  console.log('Seeding default permissions...');
  for (const perm of DEFAULT_PERMISSIONS) {
    await prisma.permission.upsert({
      where: { name: perm.name },
      update: { description: perm.description, resource: perm.resource, action: perm.action },
      create: perm,
    });
  }

  // 2. Seed System Roles
  console.log('Seeding default system roles...');
  for (const role of DEFAULT_ROLES) {
    const existing = await prisma.role.findFirst({
      where: { name: role.name, organizationId: null },
    });

    let roleRecord;
    if (!existing) {
      roleRecord = await prisma.role.create({
        data: role,
      });
    } else {
      roleRecord = existing;
    }

    // Assign all permissions to 'admin'
    if (role.name === 'admin') {
      const allPerms = await prisma.permission.findMany();
      for (const p of allPerms) {
        await prisma.rolePermission.upsert({
          where: {
            roleId_permissionId: {
              roleId: roleRecord.id,
              permissionId: p.id,
            },
          },
          update: {},
          create: {
            roleId: roleRecord.id,
            permissionId: p.id,
          },
        });
      }
    }
  }

  console.log('✅ Seeding completed successfully.');
}

main()
  .catch((e) => {
    console.error('❌ Seeding failed:', e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
