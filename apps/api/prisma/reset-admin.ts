import { PrismaClient } from '@prisma/client';
import bcrypt from 'bcryptjs';

const prisma = new PrismaClient();

async function main() {
  const email = process.env.ADMIN_EMAIL || 'admin@wppbot.com';
  const password = process.env.ADMIN_PASSWORD || 'admin123';

  const hashed = await bcrypt.hash(password, 10);

  const user = await prisma.user.upsert({
    where: { email },
    update: { password: hashed, name: 'Admin', role: 'admin' },
    create: { email, password: hashed, name: 'Admin', role: 'admin' },
  });

  console.log(`Admin atualizado:`);
  console.log(`  Email: ${user.email}`);
  console.log(`  Senha: ${password}`);
  console.log(`  ID:    ${user.id}`);
}

main()
  .catch((e) => { console.error(e); process.exit(1); })
  .finally(() => prisma.$disconnect());
