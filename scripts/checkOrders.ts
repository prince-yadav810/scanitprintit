import { prisma } from '../src/lib/prisma';

async function main() {
  const orders = await prisma.order.findMany({
    include: { shop: true }
  });
  console.log("ALL ORDERS:");
  orders.forEach(o => {
    console.log(`- Order: ${o.orderNumber}, Status: ${o.status}, Shop: ${o.shop.slug}`);
  });
}

main()
  .catch(console.error)
  .finally(() => prisma.$disconnect());
