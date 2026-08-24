import { prisma } from '@/lib/prisma';
import PlatformAdminUI from '@/components/PlatformAdminUI';

export default async function PlatformAdminPage() {
  const shops = await prisma.shop.findMany({
    orderBy: { createdAt: 'desc' },
    include: {
      _count: {
        select: { orders: true }
      },
      agents: true
    }
  });

  return <PlatformAdminUI initialShops={shops} />;
}
