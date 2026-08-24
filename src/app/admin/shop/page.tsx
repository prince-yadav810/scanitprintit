import { prisma } from '@/lib/prisma';
import AdminShopUI from '@/components/AdminShopUI';

export default async function AdminShopPage() {
  // For this prototype, we'll just hardcode the shopId to the one we seeded
  const shopId = 'test-shop';

  const shop = await prisma.shop.findUnique({
    where: { id: shopId },
    include: {
      orders: {
        orderBy: { createdAt: 'desc' },
        take: 50,
      },
      agents: true,
    }
  });

  if (!shop) {
    return <div>Shop not found. Please run the seed script.</div>;
  }

  return <AdminShopUI shop={shop} />;
}
