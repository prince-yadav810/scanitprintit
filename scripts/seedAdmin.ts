import { prisma } from '../src/lib/prisma';
import bcrypt from 'bcrypt';

async function main() {
  const email = 'admin@printdesk.com';
  const rawPassword = process.env.DEFAULT_ADMIN_PASSWORD || 'password123';
  
  if (rawPassword === 'password123') {
    console.warn('⚠️ WARNING: Using default password "password123". Please set DEFAULT_ADMIN_PASSWORD in your environment variables for production.');
  }

  const password = await bcrypt.hash(rawPassword, 10);

  const user = await prisma.user.upsert({
    where: { email },
    update: { password },
    create: {
      email,
      password,
      role: 'PLATFORM_ADMIN',
    },
  });

  console.log('✅ Admin user created/updated:', user.email);
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
