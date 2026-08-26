import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { getSession } from '@/lib/auth';
import { OrderStatus } from '@prisma/client';

const PAID_STATUSES: OrderStatus[] = ['PAID_QUEUED', 'PRINTING', 'PRINTED', 'SIMULATED_PRINTED'];

export async function GET(_req: NextRequest, { params }: { params: Promise<{ shopId: string }> }) {
  try {
    const session = await getSession();
    if (!session || session.role !== 'PLATFORM_ADMIN') {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }
    const { shopId } = await params;

    const now = new Date();
    const startOfToday = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);

    const where = { shopId, status: { in: PAID_STATUSES } };

    const [todayAgg, monthAgg, allTimeAgg, recentOrders, colorAgg] = await Promise.all([
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
      prisma.order.count({ where: { shopId, status: { in: PAID_STATUSES }, settings: { path: ['mode'], equals: 'COLOR' } } }),
    ]);

    return NextResponse.json({
      success: true,
      today: { revenue: todayAgg._sum?.totalAmount ?? 0, orders: todayAgg._count },
      month: { revenue: monthAgg._sum?.totalAmount ?? 0, orders: monthAgg._count },
      allTime: { revenue: allTimeAgg._sum?.totalAmount ?? 0, orders: allTimeAgg._count, pages: allTimeAgg._sum?.pageCount ?? 0 },
      bwOrders: allTimeAgg._count - colorAgg,
      colorOrders: colorAgg,
      recentOrders,
    });
  } catch (error) {
    console.error('[admin/shops/[shopId]/stats GET]', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
