import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import crypto from 'crypto';

import { getSession } from '@/lib/auth';

export async function POST(req: NextRequest) {
  try {
    const session = await getSession();
    const { shopId } = await req.json();

    if (!shopId) {
      return NextResponse.json({ error: 'Shop ID required' }, { status: 400 });
    }

    if (!session || (session.role !== 'PLATFORM_ADMIN' && session.shopId !== shopId)) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // Generate a 6-digit numeric code
    const code = Math.floor(100000 + Math.random() * 900000).toString();

    // Expires in 15 minutes
    const expiresAt = new Date(Date.now() + 15 * 60 * 1000);

    // Delete any existing codes for this shop to keep it clean
    await prisma.pairingCode.deleteMany({
      where: { shopId }
    });

    await prisma.pairingCode.create({
      data: {
        code,
        shopId,
        expiresAt,
      }
    });

    return NextResponse.json({ success: true, code });
  } catch (error) {
    console.error('Error generating pairing code:', error);
    return NextResponse.json({ error: 'Failed to generate code' }, { status: 500 });
  }
}
