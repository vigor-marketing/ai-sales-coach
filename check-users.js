const { PrismaClient } = require('@prisma/client');
const p = new PrismaClient();
p.user.findMany({ select: { id: true, name: true, email: true, role: true } })
  .then(r => { r.forEach(u => console.log(u.id.slice(0,8), u.name, u.email, u.role)); })
  .catch(e => console.log('ERROR:', e.message));
