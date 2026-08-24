import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import crypto from 'crypto';

export async function GET(req: NextRequest) {
  try {
    const authHeader = req.headers.get('authorization');
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const token = authHeader.split(' ')[1];
    const tokenHash = crypto.createHash('sha256').update(token).digest('hex');

    // Find agent by token
    const agent = await prisma.agent.findFirst({
      where: { tokenHash },
      include: { shop: true }
    });

    if (!agent) {
      return NextResponse.json({ error: 'Invalid token' }, { status: 401 });
    }

    // Update last seen
    await prisma.agent.update({
      where: { id: agent.id },
      data: { lastSeenAt: new Date(), status: 'ONLINE' }
    });

    // For Gauntlet 4: We'll fetch orders that are AWAITING_PAYMENT (mocking that they are paid for now)
    // In production, we'd fetch PAID_QUEUED or APPROVED.
    const jobs = await prisma.order.findMany({
      where: {
        shopId: agent.shopId,
        status: 'PAID_QUEUED', 
      },
      include: {
        files: true,
      },
      take: 1, // Process one job at a time
      orderBy: { createdAt: 'asc' }
    });

    return NextResponse.json({ success: true, jobs });
  } catch (error) {
    console.error('Agent poll error:', error);
    return NextResponse.json({ error: 'Failed to fetch jobs' }, { status: 500 });
  }
}
