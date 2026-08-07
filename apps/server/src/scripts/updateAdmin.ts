import { prisma } from '../utils/prisma.js';
import bcrypt from 'bcryptjs';

async function updateAdmin() {
  const hashedPassword = await bcrypt.hash('668668abcx', 10);

  // If vigor@example.com already exists as a sub-account, delete it
  const existing = await prisma.user.findUnique({ where: { email: 'vigor@example.com' } });
  if (existing && existing.role !== 'ADMIN') {
    await prisma.user.delete({ where: { id: existing.id } });
    console.log(`  已移除冲突的子账号: ${existing.name}`);
  }

  const admin = await prisma.user.findFirst({ where: { role: 'ADMIN' } });
  if (!admin) {
    console.error('未找到主账号');
    process.exit(1);
  }

  await prisma.user.update({
    where: { id: admin.id },
    data: { email: 'vigor@example.com', password: hashedPassword },
  });

  console.log('主账号已更新:');
  console.log(`  邮箱: vigor@example.com`);
  console.log(`  密码: 668668abcx`);
  console.log('\n请使用新账号登录！');
  prisma.$disconnect();
}

updateAdmin().catch(console.error);
