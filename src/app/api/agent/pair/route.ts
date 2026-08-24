import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import crypto from 'crypto';

export async function POST(req: NextRequest) {
  try {
    const { code } = await req.json();

    if (!code) {
      return NextResponse.json({ error: 'Code required' }, { status: 400 });
    }

    const pairingCode = await prisma.pairingCode.findUnique({
      where: { code }
    });

    if (!pairingCode) {
      return NextResponse.json({ error: 'Invalid pairing code' }, { status: 400 });
    }

    if (pairingCode.expiresAt < new Date()) {
      return NextResponse.json({ error: 'Pairing code expired' }, { status: 400 });
    }

    // Generate permanent token for the agent
    const token = crypto.randomBytes(32).toString('hex');
    // Hash the token before storing it (security best practice)
    const tokenHash = crypto.createHash('sha256').update(token).digest('hex');

    // Upsert the Agent for this shop
    await prisma.agent.upsert({
      where: { shopId: pairingCode.shopId },
      update: {
        tokenHash,
        status: 'ONLINE',
        lastSeenAt: new Date(),
      },
      create: {
        shopId: pairingCode.shopId,
        tokenHash,
        status: 'ONLINE',
      }
    });

    // Delete the pairing code so it can't be reused
    await prisma.pairingCode.delete({
      where: { id: pairingCode.id }
    });

    return NextResponse.json({ success: true, token });
  } catch (error) {
    console.error('Agent pair error:', error);
    return NextResponse.json({ error: 'Failed to pair agent' }, { status: 500 });
  }
}
