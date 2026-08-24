import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';

const CF_BASE = process.env.CASHFREE_ENV === 'PRODUCTION'
  ? 'https://api.cashfree.com'
  : 'https://sandbox.cashfree.com';

export async function POST(req: NextRequest) {
  try {
    const { orderId } = await req.json();
    if (!orderId) return NextResponse.json({ error: 'orderId required' }, { status: 400 });

    const order = await prisma.order.findUnique({
      where: { id: orderId },
      include: { shop: true },
    });

    if (!order) return NextResponse.json({ error: 'Order not found' }, { status: 404 });
    if (order.status !== 'AWAITING_PAYMENT') {
      return NextResponse.json({ error: 'Order is not in a payable state' }, { status: 409 });
    }

    // Reuse existing Cashfree order if one was already created (idempotency on retry)
    if (order.cashfreeOrderId) {
      const existingRes = await fetch(`${CF_BASE}/pg/orders/${order.cashfreeOrderId}`, {
        headers: {
          'x-api-version': '2023-08-01',
          'x-client-id':     process.env.CASHFREE_APP_ID!,
          'x-client-secret': process.env.CASHFREE_SECRET_KEY!,
        },
      });
      if (existingRes.ok) {
        const existing = await existingRes.json();
        return NextResponse.json({ payment_session_id: existing.payment_session_id });
      }
    }

    const appUrl = process.env.NEXT_PUBLIC_APP_URL || 'https://www.scanitprintit.in';

    const cfPayload = {
      order_id:       `PD-${order.orderNumber}-${Date.now()}`,
      order_amount:   Number(order.totalAmount.toFixed(2)),
      order_currency: 'INR',
      order_note:     `PrintDesk order ${order.orderNumber} at ${order.shop.name}`,
      customer_details: {
        customer_id:    order.id,
        customer_phone: '9999999999', // Customer phone not collected in MVP — Cashfree requires it
        customer_name:  'PrintDesk Customer',
      },
      order_meta: {
        return_url:  `${appUrl}/o/${order.id}?payment_status={payment_status}`,
        notify_url:  `${appUrl}/api/webhooks/cashfree`,
      },
    };

    const cfRes = await fetch(`${CF_BASE}/pg/orders`, {
      method: 'POST',
      headers: {
        'Content-Type':    'application/json',
        'x-api-version':   '2023-08-01',
        'x-client-id':     process.env.CASHFREE_APP_ID!,
        'x-client-secret': process.env.CASHFREE_SECRET_KEY!,
      },
      body: JSON.stringify(cfPayload),
    });

    if (!cfRes.ok) {
      const err = await cfRes.text();
      console.error('Cashfree order creation failed:', err);
      return NextResponse.json({ error: 'Payment gateway error. Please try again.' }, { status: 502 });
    }

    const cfData = await cfRes.json();

    // Store Cashfree order ID so we can look it up in the webhook
    await prisma.order.update({
      where: { id: order.id },
      data:  { cashfreeOrderId: cfPayload.order_id },
    });

    return NextResponse.json({ payment_session_id: cfData.payment_session_id });
  } catch (err: any) {
    console.error('Payment create error:', err);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
