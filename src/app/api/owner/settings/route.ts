/**
 * /api/owner/settings
 * 
 * Token-authenticated (Bearer) settings endpoint for the Electron Agent.
 * Allows the agent to read and update shop settings without a browser session.
 */
import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import crypto from 'crypto';

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

// GET — fetch current settings
export async function GET(req: NextRequest) {
  try {
    const agent = await getAgentAndShop(req);
    if (!agent) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    const shop = agent.shop;
    return NextResponse.json({
      success: true,
      autoPrintEnabled:  shop.autoPrintEnabled,
      simulationEnabled: shop.simulationEnabled,
      pricingTiers:      shop.pricingTiers,
    });
  } catch (error) {
    console.error('[/api/owner/settings GET]', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

// PATCH — update settings
export async function PATCH(req: NextRequest) {
  try {
    const agent = await getAgentAndShop(req);
    if (!agent) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    const body = await req.json();
    const shopId = agent.shopId;

    const updateData: any = {};
    if (body.autoPrintEnabled !== undefined) updateData.autoPrintEnabled = body.autoPrintEnabled;

    // Only test shops can toggle simulation
    if (agent.shop.isTestShop && body.simulationEnabled !== undefined) {
      updateData.simulationEnabled = body.simulationEnabled;
    }

    await prisma.shop.update({ where: { id: shopId }, data: updateData });

    // Update pricing if provided — accepts { bwPricePerPage, colorPricePerPage }
    if (body.bwPricePerPage !== undefined || body.colorPricePerPage !== undefined) {
      const bwPrice    = parseFloat(body.bwPricePerPage)    || 0;
      const colorPrice = parseFloat(body.colorPricePerPage) || 0;

      // Delete and recreate (simple replace strategy)
      await prisma.shopPricingTier.deleteMany({ where: { shopId } });
      await prisma.shopPricingTier.createMany({
        data: [
          { shopId, mode: 'BW',    minPages: 1, pricePerPage: bwPrice },
          { shopId, mode: 'COLOR', minPages: 1, pricePerPage: colorPrice },
        ],
      });
    }

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('[/api/owner/settings PATCH]', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
