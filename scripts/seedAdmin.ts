import { prisma } from '../src/lib/prisma';
import bcrypt from 'bcrypt';

async function main() {
  const username = 'admin';
  const rawPassword = process.env.DEFAULT_ADMIN_PASSWORD;
  if (!rawPassword || rawPassword.length < 16 || Buffer.byteLength(rawPassword) > 72) {
    throw new Error('Set DEFAULT_ADMIN_PASSWORD to a new password with at least 16 characters and at most 72 bytes.');
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
