import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';

import { getSession } from '@/lib/auth';

export async function POST(req: NextRequest, { params }: { params: Promise<{ shopId: string }> }) {
  try {
    const session = await getSession();
    const { shopId } = await params;

    if (!session || (session.role !== 'PLATFORM_ADMIN' && session.shopId !== shopId)) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { autoPrintEnabled, pricing, simulationEnabled } = await req.json();

    const shop = await prisma.shop.findUnique({ where: { id: shopId } });
    if (!shop) return NextResponse.json({ error: 'Shop not found' }, { status: 404 });

    const updateData: any = { autoPrintEnabled };
    if (shop.isTestShop && simulationEnabled !== undefined) {
      updateData.simulationEnabled = simulationEnabled;
    }

    // Update shop settings
    await prisma.shop.update({
      where: { id: shopId },
      data: updateData
    });

    // Update pricing tiers (simplified for prototype: we just delete and recreate)
    if (pricing) {
      await prisma.shopPricingTier.deleteMany({
        where: { shopId: shopId }
      });

      await prisma.shopPricingTier.createMany({
        data: [
          { shopId: shopId, mode: 'BW', minPages: 1, pricePerPage: pricing.BW },
          { shopId: shopId, mode: 'COLOR', minPages: 1, pricePerPage: pricing.COLOR }
        ]
      });
    }

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Settings update error:', error);
    return NextResponse.json({ error: 'Failed to update settings' }, { status: 500 });
  }
}
