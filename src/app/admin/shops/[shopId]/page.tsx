import { notFound } from 'next/navigation';
import { prisma } from '@/lib/prisma';
import ShopDetailUI from '@/components/ShopDetailUI';

export const dynamic = 'force-dynamic';

export default async function ShopDetailPage({ params }: { params: Promise<{ shopId: string }> }) {
  const { shopId } = await params;

  const PAID = ['PAID_QUEUED', 'PRINTING', 'PRINTED', 'SIMULATED_PRINTED'] as const;

  const shop = await prisma.shop.findUnique({
    where: { id: shopId },
    include: {
      user: { select: { username: true } },
      agents: true,
      pricingTiers: true,
      _count: { select: { orders: true } },
    },
  });

  if (!shop) notFound();

  const now = new Date();
  const startOfToday = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);

  const where = { shopId, status: { in: [...PAID] } };

  const [todayAgg, monthAgg, allTimeAgg, recentOrders, colorOrders] = await Promise.all([
    prisma.order.aggregate({ where: { ...where, createdAt: { gte: startOfToday } }, _sum: { totalAmount: true }, _count: true }),
    prisma.order.aggregate({ where: { ...where, createdAt: { gte: startOfMonth } }, _sum: { totalAmount: true }, _count: true }),
    prisma.order.aggregate({ where, _sum: { totalAmount: true, pageCount: true }, _count: true }),
    prisma.order.findMany({
      where: { shopId },
      orderBy: { createdAt: 'desc' },
      take: 20,
      select: {
        id: true, orderNumber: true, customerName: true, totalAmount: true,
        pageCount: true, status: true, createdAt: true, settings: true,
      },
    }),
    prisma.order.count({ where: { shopId, status: { in: [...PAID] }, settings: { path: ['mode'], equals: 'COLOR' } } }),
  ]);

  const stats = {
    today: { revenue: todayAgg._sum.totalAmount ?? 0, orders: todayAgg._count },
    month: { revenue: monthAgg._sum.totalAmount ?? 0, orders: monthAgg._count },
    allTime: { revenue: allTimeAgg._sum.totalAmount ?? 0, orders: allTimeAgg._count, pages: allTimeAgg._sum.pageCount ?? 0 },
    bwOrders: allTimeAgg._count - colorOrders,
    colorOrders,
  };

  return <ShopDetailUI shop={shop} stats={stats} recentOrders={recentOrders} />;
}
