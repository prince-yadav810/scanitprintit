import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { getSession } from '@/lib/auth';

export async function POST(req: NextRequest, { params }: { params: Promise<{ orderId: string }> }) {
  try {
    const session = await getSession();
    const { orderId } = await params;

    if (!session || (session.role !== 'PLATFORM_ADMIN' && session.role !== 'SHOP_OWNER')) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { status } = await req.json();
    if (!status || !['PRINTED', 'CANCELLED', 'AWAITING_APPROVAL', 'PAID_QUEUED', 'NEEDS_ATTENTION', 'PRINTING'].includes(status)) {
      return NextResponse.json({ error: 'Invalid status' }, { status: 400 });
    }

    // Verify order exists and user owns the shop (if not PLATFORM_ADMIN)
    const order = await prisma.order.findUnique({
      where: { id: orderId },
      include: { shop: true }
    });

    if (!order) {
      return NextResponse.json({ error: 'Order not found' }, { status: 404 });
    }

    if (session.role !== 'PLATFORM_ADMIN' && session.shopId !== order.shopId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // Update order status
    const updatedOrder = await prisma.order.update({
      where: { id: orderId },
      data: { status }
    });

    return NextResponse.json({ success: true, order: updatedOrder });
  } catch (error) {
    console.error('Update status error:', error);
    return NextResponse.json({ error: 'Failed to update order status' }, { status: 500 });
  }
}
