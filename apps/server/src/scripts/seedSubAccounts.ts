import { prisma } from '../utils/prisma.js';
import bcrypt from 'bcryptjs';

async function seedSubAccounts() {
  console.log('开始创建子账号...');
  const hashedPassword = await bcrypt.hash('668668abcx', 10);

  for (let i = 1; i <= 6; i++) {
    const name = `Vigor${i}`;
    const email = `vigor${i}@example.com`;

    const existing = await prisma.user.findUnique({ where: { email } });
    if (existing) {
      console.log(`  账号已存在: ${email}`);
      continue;
    }

    await prisma.user.create({
      data: {
        email,
        name,
        password: hashedPassword,
        role: 'TRAINEE',
      },
    });
    console.log(`  创建子账号: ${name} (${email})`);
  }

  console.log('子账号创建完成！');
  console.log('密码: 668668abcx');
}

seedSubAccounts()
  .catch(console.error)
  .finally(() => prisma.$disconnect());
