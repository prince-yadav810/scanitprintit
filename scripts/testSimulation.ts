import { prisma } from '../src/lib/prisma';

async function main() {
  const shop = await prisma.shop.findFirst();
  if (!shop) {
    console.log('No shop found to make a test shop.');
    return;
  }
  
  await prisma.shop.update({
    where: { id: shop.id },
    data: {
      isTestShop: true,
      simulationEnabled: true,
      autoPrintEnabled: true
    }
  });
  
  console.log(`✅ Shop '${shop.name}' is now a test shop with simulation enabled.`);
}

main()
  .catch(console.error)
  .finally(() => prisma.$disconnect());
