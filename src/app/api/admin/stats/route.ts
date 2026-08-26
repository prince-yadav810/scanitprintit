import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { getSession } from '@/lib/auth';

export async function GET() {
  try {
    const session = await getSession();
    if (!session || session.role !== 'PLATFORM_ADMIN') {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const [totalShops, activeShops, totalOrdersAgg, agentsOnline] = await Promise.all([
      prisma.shop.count(),
      prisma.shop.count({ where: { status: 'ACTIVE' } }),
      prisma.order.aggregate({
        where: { status: { in: ['PAID_QUEUED', 'PRINTING', 'PRINTED', 'SIMULATED_PRINTED'] } },
        _sum: { totalAmount: true },
        _count: true,
      }),
      prisma.agent.count({ where: { status: 'ONLINE' } }),
    ]);

    return NextResponse.json({
      success: true,
      totalShops,
      activeShops,
      agentsOnline,
      totalRevenue: totalOrdersAgg._sum.totalAmount ?? 0,
      totalOrders: totalOrdersAgg._count,
    });
  } catch (error) {
    console.error('[/api/admin/stats]', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
