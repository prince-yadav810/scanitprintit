import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import crypto from 'crypto';

async function getAgent(req: NextRequest) {
  const authHeader = req.headers.get('authorization');
  if (!authHeader?.startsWith('Bearer ')) return null;
  const token = authHeader.split(' ')[1];
  const tokenHash = crypto.createHash('sha256').update(token).digest('hex');
  return prisma.agent.findFirst({ where: { tokenHash } });
}

export async function GET(req: NextRequest) {
  try {
    const agent = await getAgent(req);
    if (!agent) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    // Last 30 days
    const end   = new Date();
    const start = new Date();
    start.setDate(start.getDate() - 30);

    const orders = await prisma.order.findMany({
      where: {
        shopId:    agent.shopId,
        createdAt: { gte: start, lte: end },
        status: { notIn: ['DRAFT', 'AWAITING_PAYMENT', 'EXPIRED', 'CANCELLED', 'CANCELLED_REFUNDED'] },
      },
      select: { totalAmount: true, pageCount: true, createdAt: true },
    });

    // Build daily buckets (last 30 days, IST offset)
    const IST_OFFSET_MS = 5.5 * 60 * 60 * 1000;
    const buckets: Record<string, { revenue: number; pages: number; count: number }> = {};

    for (let i = 29; i >= 0; i--) {
      const d = new Date(Date.now() - i * 86400000 + IST_OFFSET_MS);
      const key = d.toISOString().slice(0, 10);
      buckets[key] = { revenue: 0, pages: 0, count: 0 };
    }

    for (const o of orders) {
      const ist = new Date(o.createdAt.getTime() + IST_OFFSET_MS);
      const key = ist.toISOString().slice(0, 10);
      if (buckets[key]) {
        buckets[key].revenue += o.totalAmount;
        buckets[key].pages   += o.pageCount;
        buckets[key].count   += 1;
      }
    }

    const dailyRevenue = Object.entries(buckets).map(([date, v]) => ({ date, ...v }));

    const totalRevenue  = orders.reduce((s, o) => s + o.totalAmount, 0);
    const totalPages    = orders.reduce((s, o) => s + o.pageCount, 0);
    const totalOrders   = orders.length;
    const avgOrderValue = totalOrders ? totalRevenue / totalOrders : 0;

    return NextResponse.json({ totalRevenue, totalPages, totalOrders, avgOrderValue, dailyRevenue });
  } catch (error) {
    console.error('[/api/owner/stats/monthly]', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
