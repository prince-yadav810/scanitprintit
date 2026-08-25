import { prisma } from '../src/lib/prisma';
import { hashPassword } from '../src/lib/passwords';

async function main() {
  const hashedPassword = await hashPassword('password123');
  
  const admin = await prisma.user.upsert({
    where: { username: 'admin' },
    update: { 
      password: hashedPassword,
      role: 'PLATFORM_ADMIN'
    },
    create: {
      username: 'admin',
      password: hashedPassword,
      role: 'PLATFORM_ADMIN'
    }
  });
  
  console.log('Admin user upserted successfully:', admin.username);
}

main()
  .catch(console.error)
  .finally(() => prisma.$disconnect());
