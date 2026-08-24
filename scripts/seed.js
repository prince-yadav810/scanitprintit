const { PrismaClient } = require('@prisma/client');
const { Pool } = require('pg');
const { PrismaPg } = require('@prisma/adapter-pg');
require('dotenv/config');

const pool = new Pool({ connectionString: process.env.DATABASE_URL });
const adapter = new PrismaPg(pool);
const prisma = new PrismaClient({ adapter });

async function main() {
  const shopId = 'test-shop';

  const existingShop = await prisma.shop.findUnique({
    where: { id: shopId },
  });

  if (!existingShop) {
    const shop = await prisma.shop.create({
      data: {
        id: shopId,
        slug: shopId,
        name: 'Test Print Shop',
        status: 'ACTIVE',
        pricingTiers: {
          create: [
            {
              mode: 'BW',
              minPages: 1,
              pricePerPage: 5.0,
            },
            {
              mode: 'COLOR',
              minPages: 1,
              pricePerPage: 10.0,
            }
          ]
        }
      },
    });
    console.log(`Created shop: ${shop.name} (${shop.id})`);
  } else {
    console.log(`Shop ${shopId} already exists.`);
  }
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
