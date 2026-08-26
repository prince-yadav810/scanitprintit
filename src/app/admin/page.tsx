import { prisma } from '@/lib/prisma';
import PlatformAdminUI from '@/components/PlatformAdminUI';

export default async function PlatformAdminPage() {
  const PAID = ['PAID_QUEUED', 'PRINTING', 'PRINTED', 'SIMULATED_PRINTED'] as const;

  const shops = await prisma.shop.findMany({
    orderBy: { createdAt: 'desc' },
    include: {
      _count: { select: { orders: true } },
      agents: true,
      pricingTiers: true,
      user: { select: { username: true } },
    },
  });

  // Attach revenue aggregates per shop
  const revenueByShop = await prisma.order.groupBy({
    by: ['shopId'],
    where: { status: { in: [...PAID] } },
    _sum: { totalAmount: true },
    _count: true,
  });

  const revenueMap = new Map(revenueByShop.map((r) => [r.shopId, { revenue: r._sum.totalAmount ?? 0, paidOrders: r._count }]));

  const shopsWithRevenue = shops.map((s) => ({
    ...s,
    revenue: revenueMap.get(s.id)?.revenue ?? 0,
    paidOrders: revenueMap.get(s.id)?.paidOrders ?? 0,
  }));

  // Platform-wide totals
  const totals = {
    totalShops: shops.length,
    activeShops: shops.filter((s) => s.status === 'ACTIVE').length,
    agentsOnline: shops.filter((s) => s.agents.some((a) => a.status === 'ONLINE')).length,
    totalRevenue: revenueByShop.reduce((acc, r) => acc + (r._sum.totalAmount ?? 0), 0),
    totalOrders: revenueByShop.reduce((acc, r) => acc + r._count, 0),
  };

  return <PlatformAdminUI initialShops={shopsWithRevenue} totals={totals} />;
}
