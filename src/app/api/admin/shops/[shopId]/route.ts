import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { getSession } from '@/lib/auth';

export async function GET(_req: NextRequest, { params }: { params: Promise<{ shopId: string }> }) {
  try {
    const session = await getSession();
    if (!session || session.role !== 'PLATFORM_ADMIN') {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }
    const { shopId } = await params;
    const shop = await prisma.shop.findUnique({
      where: { id: shopId },
      include: {
        user: { select: { username: true } },
        agents: true,
        pricingTiers: true,
        _count: { select: { orders: true } },
      },
    });
    if (!shop) return NextResponse.json({ error: 'Shop not found' }, { status: 404 });
    return NextResponse.json({ success: true, shop });
  } catch (error) {
    console.error('[admin/shops/[shopId] GET]', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
