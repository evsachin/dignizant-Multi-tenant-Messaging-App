require('dotenv').config();
const bcrypt = require('bcryptjs');
const prisma = require('./lib/prisma');

async function main() {
  console.log('🌱 Seeding database...');

  // Clean existing data
  await prisma.message.deleteMany();
  await prisma.groupMember.deleteMany();
  await prisma.group.deleteMany();
  await prisma.user.deleteMany();
  await prisma.organization.deleteMany();

  const pw = await bcrypt.hash('password123', 12);

  // Org A
  const orgA = await prisma.organization.create({ data: { name: 'Acme Corp' } });
  const adminA = await prisma.user.create({
    data: { orgId: orgA.id, email: 'admin@acme.com', passwordHash: pw, role: 'ADMIN' },
  });
  const userA1 = await prisma.user.create({
    data: { orgId: orgA.id, email: 'alice@acme.com', passwordHash: pw, role: 'MEMBER' },
  });
  const userA2 = await prisma.user.create({
    data: { orgId: orgA.id, email: 'bob@acme.com', passwordHash: pw, role: 'MEMBER' },
  });

  const generalA = await prisma.group.create({
    data: { orgId: orgA.id, name: 'general', createdBy: adminA.id },
  });
  const devA = await prisma.group.create({
    data: { orgId: orgA.id, name: 'dev-team', createdBy: adminA.id },
  });

  await prisma.groupMember.createMany({
    data: [
      { groupId: generalA.id, userId: adminA.id },
      { groupId: generalA.id, userId: userA1.id },
      { groupId: generalA.id, userId: userA2.id },
      { groupId: devA.id, userId: adminA.id },
      { groupId: devA.id, userId: userA1.id },
    ],
  });

  await prisma.message.createMany({
    data: [
      { groupId: generalA.id, senderId: adminA.id, content: 'Welcome to Acme Corp! 🎉' },
      { groupId: generalA.id, senderId: userA1.id, content: 'Thanks! Happy to be here.' },
      { groupId: generalA.id, senderId: userA2.id, content: 'Hey everyone! Looking forward to working together.' },
      { groupId: devA.id, senderId: adminA.id, content: 'Dev team channel is live!' },
      { groupId: devA.id, senderId: userA1.id, content: 'Great, I will post updates here.' },
    ],
  });

  // Org B
  const orgB = await prisma.organization.create({ data: { name: 'Globex Inc' } });
  const adminB = await prisma.user.create({
    data: { orgId: orgB.id, email: 'admin@globex.com', passwordHash: pw, role: 'ADMIN' },
  });
  const userB1 = await prisma.user.create({
    data: { orgId: orgB.id, email: 'carol@globex.com', passwordHash: pw, role: 'MEMBER' },
  });

  const generalB = await prisma.group.create({
    data: { orgId: orgB.id, name: 'general', createdBy: adminB.id },
  });

  await prisma.groupMember.createMany({
    data: [
      { groupId: generalB.id, userId: adminB.id },
      { groupId: generalB.id, userId: userB1.id },
    ],
  });

  await prisma.message.createMany({
    data: [
      { groupId: generalB.id, senderId: adminB.id, content: 'Welcome to Globex Inc!' },
      { groupId: generalB.id, senderId: userB1.id, content: 'Glad to be part of the team!' },
    ],
  });

  console.log('✅ Seed complete!\n');
  console.log('📋 Demo Accounts:');
  console.log('Org: "Acme Corp"');
  console.log('  admin@acme.com    / password123 (ADMIN)');
  console.log('  alice@acme.com    / password123 (MEMBER)');
  console.log('  bob@acme.com      / password123 (MEMBER)');
  console.log('\nOrg: "Globex Inc"');
  console.log('  admin@globex.com  / password123 (ADMIN)');
  console.log('  carol@globex.com  / password123 (MEMBER)');
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
