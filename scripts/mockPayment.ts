import { prisma } from '../src/lib/prisma';

async function main() {
  const result = await prisma.order.updateMany({
    where: { status: 'AWAITING_PAYMENT' },
    data: { status: 'PAID_QUEUED' }
  });
  console.log(`Updated ${result.count} unpaid orders to PAID_QUEUED. The agent should pick them up now!`);
}

main()
  .catch(console.error)
  .finally(() => prisma.$disconnect());
