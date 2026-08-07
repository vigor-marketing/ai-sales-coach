import { PrismaClient } from '@prisma/client';
import bcrypt from 'bcryptjs';

const prisma = new PrismaClient();

async function main() {
  const hash = await bcrypt.hash('admin123', 10);
  
  const result = await prisma.user.updateMany({
    where: { role: 'ADMIN' },
    data: { password: hash },
  });
  console.log('Updated:', result.count, 'admin user(s)');
  
  // Verify
  const admin = await prisma.user.findFirst({ where: { role: 'ADMIN' } });
  if (admin) {
    console.log('New password length:', admin.password.length);
    const valid = await bcrypt.compare('admin123', admin.password);
    console.log('Login test:', valid ? 'PASS' : 'FAIL');
  }
  
  await prisma.$disconnect();
}

main().catch(console.error);
