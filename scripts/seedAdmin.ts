import { prisma } from '../src/lib/prisma';
import bcrypt from 'bcrypt';

async function main() {
  const username = 'admin';
  const rawPassword = process.env.DEFAULT_ADMIN_PASSWORD || 'password123';
  
  if (rawPassword === 'password123') {
    console.warn('⚠️ WARNING: Using default password "password123". Please set DEFAULT_ADMIN_PASSWORD in your environment variables for production.');
  }

  const password = await bcrypt.hash(rawPassword, 10);

  const user = await prisma.user.upsert({
    where: { username },
    update: { password },
    create: {
      username,
      password,
      role: 'PLATFORM_ADMIN',
    },
  });

  console.log('✅ Admin user created/updated:', user.username);
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
