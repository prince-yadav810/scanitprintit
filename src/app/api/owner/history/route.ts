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

    const { searchParams } = new URL(req.url);
    const from   = searchParams.get('from');
    const to     = searchParams.get('to');
    const status = searchParams.get('status');
    const mode   = searchParams.get('mode');
    const page   = parseInt(searchParams.get('page') || '1');
    const limit  = 100;

    const where: any = {
      shopId: agent.shopId,
      status: { notIn: ['DRAFT', 'AWAITING_PAYMENT', 'EXPIRED'] },
    };

    if (from) where.createdAt = { ...where.createdAt, gte: new Date(from) };
    if (to)   where.createdAt = { ...where.createdAt, lte: new Date(to + 'T23:59:59') };
    if (status) where.status = status;
    if (mode) where.settings = { path: ['mode'], equals: mode };

    const [orders, total] = await Promise.all([
      prisma.order.findMany({
        where,
        include: { files: { select: { originalName: true } } },
        orderBy: { createdAt: 'desc' },
        take: limit,
        skip: (page - 1) * limit,
      }),
      prisma.order.count({ where }),
    ]);

    return NextResponse.json({ orders, total, page, limit });
  } catch (error) {
    console.error('[/api/owner/history]', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
