import { prisma } from '../utils/prisma.js';

const users = await prisma.user.findMany({
  where: { email: { contains: 'vigor' } },
  orderBy: { email: 'asc' },
});

console.log('Vigor accounts in DB:');
for (const u of users) {
  console.log(`  ${u.email} | ${u.name} | ${u.role}`);
}

if (users.length === 0) {
  console.log('  (none)');
}

await prisma.$disconnect();
