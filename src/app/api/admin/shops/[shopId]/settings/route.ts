import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { getSession } from '@/lib/auth';
import { hashPassword } from '@/lib/passwords';

export async function PATCH(req: NextRequest, { params }: { params: Promise<{ shopId: string }> }) {
  try {
    const session = await getSession();
    if (!session || session.role !== 'PLATFORM_ADMIN') {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }
    const { shopId } = await params;
    const body = await req.json();

    const updateData: Record<string, unknown> = {};
    if (body.status !== undefined) updateData.status = body.status;
    if (body.autoPrintEnabled !== undefined) updateData.autoPrintEnabled = body.autoPrintEnabled;
    if (body.simulationEnabled !== undefined) updateData.simulationEnabled = body.simulationEnabled;
    if (body.isTestShop !== undefined) updateData.isTestShop = body.isTestShop;
    if (body.billingStartDate !== undefined) updateData.billingStartDate = new Date(body.billingStartDate);

    if (Object.keys(updateData).length > 0) {
      await prisma.shop.update({ where: { id: shopId }, data: updateData });
    }

    if (body.bwPricePerPage !== undefined || body.colorPricePerPage !== undefined) {
      await prisma.shopPricingTier.deleteMany({ where: { shopId } });
      await prisma.shopPricingTier.createMany({
        data: [
          { shopId, mode: 'BW', minPages: 1, pricePerPage: parseFloat(body.bwPricePerPage) || 5 },
          { shopId, mode: 'COLOR', minPages: 1, pricePerPage: parseFloat(body.colorPricePerPage) || 10 },
        ],
      });
    }

    // Reset owner password
    if (body.newPassword) {
      const hashed = await hashPassword(body.newPassword);
      await prisma.user.updateMany({ where: { shopId }, data: { password: hashed } });
    }

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('[admin/shops/[shopId]/settings PATCH]', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
