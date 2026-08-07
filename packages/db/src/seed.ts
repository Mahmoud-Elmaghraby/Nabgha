import { PrismaClient } from '@prisma/client';
import * as bcrypt from 'bcrypt';

const prisma = new PrismaClient();

async function main() {
  console.log('🌱 Seeding database...');

  // Plans
  const plans = [
    {
      id: 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa',
      name: 'Starter',
      slug: 'starter',
      maxStudents: 100,
      price: 199,
      features: { whatsapp: false, parentPortal: false, advancedReports: false },
    },
    {
      id: 'bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb',
      name: 'Pro',
      slug: 'pro',
      maxStudents: 500,
      price: 499,
      features: { whatsapp: true, parentPortal: true, advancedReports: true },
    },
    {
      id: 'cccccccc-cccc-cccc-cccc-cccccccccccc',
      name: 'Enterprise',
      slug: 'enterprise',
      maxStudents: 999999,
      price: 0,
      features: { whatsapp: true, parentPortal: true, advancedReports: true, multiBranch: true },
    },
    {
      id: 'dddddddd-dddd-dddd-dddd-dddddddddddd',
      name: 'Desktop',
      slug: 'desktop',
      maxStudents: 999999,
      price: 0,
      features: { whatsapp: false, parentPortal: false, advancedReports: false },
    },
  ];

  for (const plan of plans) {
    await prisma.plan.upsert({
      where: { id: plan.id },
      update: {},
      create: plan,
    });
  }
  console.log('✅ Plans seeded');

  // Super Admin
  const passwordHash = await bcrypt.hash('Nabgha@Admin2026', 12);
  await prisma.platformUser.upsert({
    where: { email: 'admin@nabgha.com' },
    update: {},
    create: {
      email: 'admin@nabgha.com',
      passwordHash,
      name: 'Super Admin',
      isSuperAdmin: true,
    },
  });
  console.log('✅ Super Admin seeded');

  // Test Tenant
  await prisma.tenant.upsert({
    where: { slug: 'test-center' },
    update: {},
    create: {
      id: '00000000-0000-0000-0000-000000000001',
      name: 'مركز الاختبار',
      slug: 'test-center',
      planId: 'bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb',
      schemaName: 'tenant_00000000_0000_0000_0000_000000000001',
    },
  });
  console.log('✅ Test Tenant seeded');

  console.log('🎉 Seeding completed!');
}

main()
  .catch(console.error)
  .finally(() => prisma.$disconnect());
