import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import crypto from 'crypto';

export async function POST(req: NextRequest) {
  try {
    const { shopId, files, printMode, sides, copies } = await req.json();

    if (!shopId || !files || files.length === 0) {
      return NextResponse.json({ error: 'Missing required fields' }, { status: 400 });
    }

    const mode = printMode === 'COLOR' ? 'COLOR' : 'BW';
    const numCopies = typeof copies === 'number' && copies > 0 ? copies : 1;
    const layout = sides === 'DOUBLE' ? 'DOUBLE' : 'SINGLE';

    // Fetch the shop and its pricing
    const shop = await prisma.shop.findUnique({
      where: { id: shopId },
      include: { pricingTiers: true },
    });

    if (!shop) {
      return NextResponse.json({ error: 'Shop not found' }, { status: 404 });
    }

    // Determine pricing tier
    const tier = shop.pricingTiers.find((t: any) => t.mode === mode) || shop.pricingTiers[0];
    const pricePerPage = tier?.pricePerPage || 5.0;

    let totalDocumentPages = 0;
    const fileRecords = files.map((f: any) => {
      totalDocumentPages += f.pages;
      return {
        originalName: f.originalName,
        cloudinaryUrl: f.cloudinaryUrl,
        status: 'UPLOADED',
        expiresAt: new Date(Date.now() + 24 * 60 * 60 * 1000), // 24 hours expiry
      };
    });

    const printSubtotal = totalDocumentPages * pricePerPage * numCopies;
    const totalAmount = printSubtotal; // Platform charge excluded for now

    const orderNumber   = crypto.randomBytes(4).toString('hex').toUpperCase();
    // Status always starts as AWAITING_PAYMENT.
    // It only advances to PAID_QUEUED or AWAITING_APPROVAL via the Cashfree webhook
    // after a confirmed successful payment.
    const initialStatus = 'AWAITING_PAYMENT';

    // Create order and files
    const order = await prisma.order.create({
      data: {
        orderNumber,
        shopId,
        status: initialStatus,
        pageCount: totalDocumentPages * numCopies,
        printSubtotal,
        totalAmount,
        settings: { mode, sides: layout, copies: numCopies },
        files: {
          create: fileRecords,
        },
      },
    });

    return NextResponse.json({
      success: true,
      orderId: order.id,
      orderNumber: order.orderNumber,
      totalAmount: order.totalAmount,
    });
  } catch (error: any) {
    console.error('Order creation error:', error);
    return NextResponse.json({ error: 'Failed to create order' }, { status: 500 });
  }
}
