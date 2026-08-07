import { prisma } from '../utils/prisma.js';
import bcrypt from 'bcryptjs';

async function recreateVigor1() {
  const hashedPassword = await bcrypt.hash('668668abcx', 10);

  const existing = await prisma.user.findUnique({ where: { email: 'vigor1@example.com' } });
  if (existing) {
    console.log('账号 vigor1@example.com 已存在');
    prisma.$disconnect();
    return;
  }

  await prisma.user.create({
    data: {
      email: 'vigor1@example.com',
      name: 'Vigor1',
      password: hashedPassword,
      role: 'TRAINEE',
    },
  });

  console.log('Vigor1 子账号已重新创建:');
  console.log('  邮箱: vigor1@example.com');
  console.log('  密码: 668668abcx');
  prisma.$disconnect();
}

recreateVigor1().catch(console.error);
