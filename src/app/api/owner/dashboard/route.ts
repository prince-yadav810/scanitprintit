import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import crypto from 'crypto';

// ─── Auth helper (same as agent jobs route) ───────────────────────────────────
async function getAgentAndShop(req: NextRequest) {
  const authHeader = req.headers.get('authorization');
  if (!authHeader?.startsWith('Bearer ')) return null;
  const token = authHeader.split(' ')[1];
  const tokenHash = crypto.createHash('sha256').update(token).digest('hex');
  return prisma.agent.findFirst({
    where: { tokenHash },
    include: { shop: { include: { pricingTiers: true } } },
  });
}

// ─── IST "today" boundaries ────────────────────────────────────────────────────
function todayIST() {
  const now = new Date();
  // IST = UTC+5:30
  const offset = 5.5 * 60 * 60 * 1000;
  const istNow = new Date(now.getTime() + offset);
  const y = istNow.getUTCFullYear();
  const m = istNow.getUTCMonth();
  const d = istNow.getUTCDate();
  const start = new Date(Date.UTC(y, m, d) - offset);       // midnight IST in UTC
  const end   = new Date(Date.UTC(y, m, d + 1) - offset);   // next midnight IST in UTC
  return { start, end };
}

export async function GET(req: NextRequest) {
  try {
    const agent = await getAgentAndShop(req);
    if (!agent) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    const shopId = agent.shopId;
    const { start, end } = todayIST();

    // Update last seen
    await prisma.agent.update({
      where: { id: agent.id },
      data: { lastSeenAt: new Date(), status: 'ONLINE' },
    });

    // Today's orders (exclude DRAFT / AWAITING_PAYMENT)
    const todayOrders = await prisma.order.findMany({
      where: {
        shopId,
        createdAt: { gte: start, lt: end },
        status: { notIn: ['DRAFT', 'AWAITING_PAYMENT', 'EXPIRED'] },
      },
      include: { files: { select: { originalName: true } } },
      orderBy: { createdAt: 'desc' },
    });

    // Revenue excludes cancelled orders
    const validOrders = todayOrders.filter(o => !o.status.startsWith('CANCELLED'));
    const totalRevenue  = validOrders.reduce((sum, o) => sum + o.totalAmount, 0);
    const totalPages    = validOrders.reduce((sum, o) => sum + o.pageCount, 0);
    const failedCount   = todayOrders.filter(o => o.status === 'NEEDS_ATTENTION').length;

    // Live queue (jobs that need action or are in-progress)
    const queue = await prisma.order.findMany({
      where: {
        shopId,
        status: { in: ['PAID_QUEUED', 'PRINTING', 'NEEDS_ATTENTION', 'AWAITING_APPROVAL'] },
      },
      include: { files: { select: { originalName: true, cloudinaryUrl: true } } },
      orderBy: { createdAt: 'asc' },
    });

    return NextResponse.json({
      shop: { id: agent.shop.id, name: agent.shop.name, slug: agent.shop.slug },
      today: {
        orders:      todayOrders,
        totalOrders: validOrders.length,
        totalPages,
        totalRevenue,
        failedCount,
      },
      queue,
      agent: { status: agent.status, lastSeenAt: agent.lastSeenAt },
      settings: {
        autoPrintEnabled:  agent.shop.autoPrintEnabled,
        simulationEnabled: agent.shop.simulationEnabled,
        pricingTiers:      agent.shop.pricingTiers,
      },
    });
  } catch (error) {
    console.error('[/api/owner/dashboard]', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
