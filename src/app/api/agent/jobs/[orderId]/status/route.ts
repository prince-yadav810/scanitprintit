import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import crypto from 'crypto';

export async function POST(req: NextRequest, { params }: { params: Promise<{ orderId: string }> }) {
  try {
    const { orderId } = await params;
    const authHeader = req.headers.get('authorization');
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const token = authHeader.split(' ')[1];
    const tokenHash = crypto.createHash('sha256').update(token).digest('hex');

    // Verify agent
    const agent = await prisma.agent.findFirst({
      where: { tokenHash }
    });

    if (!agent) {
      return NextResponse.json({ error: 'Invalid token' }, { status: 401 });
    }

    const { status } = await req.json();
    if (!status || !['PRINTING', 'PRINTED', 'NEEDS_ATTENTION'].includes(status)) {
      return NextResponse.json({ error: 'Invalid status' }, { status: 400 });
    }

    // Verify the order belongs to the agent's shop
    const order = await prisma.order.findUnique({
      where: { id: orderId }
    });

    if (!order || order.shopId !== agent.shopId) {
      return NextResponse.json({ error: 'Order not found' }, { status: 404 });
    }

    // State machine check: if transitioning to PRINTING, it MUST currently be PAID_QUEUED
    if (status === 'PRINTING') {
      const updated = await prisma.order.updateMany({
        where: { id: order.id, status: 'PAID_QUEUED' },
        data: { status }
      });
      if (updated.count === 0) {
        return NextResponse.json({ error: 'Order is not queued for printing' }, { status: 409 });
      }
    } else {
      // For other statuses (e.g. PRINTED, NEEDS_ATTENTION), just update
      await prisma.order.update({
        where: { id: order.id },
        data: { status }
      });
    }

    return NextResponse.json({ success: true, status });
  } catch (error) {
    console.error('Agent update status error:', error);
    return NextResponse.json({ error: 'Failed to update status' }, { status: 500 });
  }
}
