import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import crypto from 'crypto';

/**
 * Cashfree Webhook Handler
 *
 * Cashfree signs webhooks with:
 *   HMAC-SHA256( timestamp + rawBody, secretKey )
 * and sends the signature in the `x-webhook-signature` header,
 * and the timestamp in `x-webhook-timestamp`.
 *
 * Reference: https://docs.cashfree.com/docs/payment-gateway-v3#webhook-verification
 */
function verifyCashfreeSignature(
  rawBody: string,
  timestamp: string,
  receivedSig: string,
  secret: string,
): boolean {
  const message = timestamp + rawBody;
  const expected = crypto
    .createHmac('sha256', secret)
    .update(message)
    .digest('base64');
  return crypto.timingSafeEqual(
    Buffer.from(expected),
    Buffer.from(receivedSig),
  );
}

export async function POST(req: NextRequest) {
  // 1. Read raw body (must be done before any JSON parsing)
  const rawBody = await req.text();

  const timestamp    = req.headers.get('x-webhook-timestamp') ?? '';
  const receivedSig  = req.headers.get('x-webhook-signature') ?? '';
  const secret       = process.env.CASHFREE_SECRET_KEY ?? '';

  // 2. Verify signature
  let sigValid = false;
  try {
    sigValid = verifyCashfreeSignature(rawBody, timestamp, receivedSig, secret);
  } catch {
    sigValid = false;
  }

  if (!sigValid) {
    console.warn('[Cashfree webhook] Invalid signature');
    return NextResponse.json({ error: 'Invalid signature' }, { status: 401 });
  }

  // 3. Parse payload
  let payload: any;
  try {
    payload = JSON.parse(rawBody);
  } catch {
    return NextResponse.json({ error: 'Bad JSON' }, { status: 400 });
  }

  const eventType    = payload?.type as string;              // e.g. "PAYMENT_SUCCESS_WEBHOOK"
  const cfOrderId    = payload?.data?.order?.order_id as string;
  const cfPaymentId  = payload?.data?.payment?.cf_payment_id as string | undefined;
  const paymentStatus = payload?.data?.payment?.payment_status as string; // SUCCESS / FAILED / etc.

  if (!cfOrderId) {
    return NextResponse.json({ ok: true, skipped: 'no order_id' });
  }

  // 4. Find matching order by the Cashfree order ID we stored at creation
  const order = await prisma.order.findFirst({
    where: { cashfreeOrderId: cfOrderId },
    include: { shop: true },
  });

  if (!order) {
    // Could be a test ping from Cashfree dashboard — return 200 so they don't retry
    console.warn(`[Cashfree webhook] No order found for cashfreeOrderId=${cfOrderId}`);
    return NextResponse.json({ ok: true, skipped: 'order not found' });
  }

  // 5. Idempotency guard — if paymentReference already set, we've processed this
  if (order.paymentReference) {
    console.log(`[Cashfree webhook] Already processed order ${order.orderNumber}. Skipping.`);
    return NextResponse.json({ ok: true, skipped: 'already processed' });
  }

  // 6. Handle event
  if (paymentStatus === 'SUCCESS' || eventType?.includes('PAYMENT_SUCCESS')) {
    // Determine target status based on shop's auto-print setting
    const nextStatus = order.shop.autoPrintEnabled ? 'PAID_QUEUED' : 'AWAITING_APPROVAL';

    await prisma.order.update({
      where: { id: order.id },
      data: {
        status:           nextStatus,
        paymentReference: cfPaymentId ?? cfOrderId,
      },
    });

    console.log(`[Cashfree webhook] Order ${order.orderNumber} → ${nextStatus}`);
  } else if (paymentStatus === 'FAILED' || eventType?.includes('PAYMENT_FAILED')) {
    await prisma.order.update({
      where: { id: order.id },
      data:  { status: 'AWAITING_PAYMENT' },
    });
    console.log(`[Cashfree webhook] Payment failed for order ${order.orderNumber}`);
  } else {
    // USER_DROPPED, PENDING, etc. — log but don't change status
    console.log(`[Cashfree webhook] Unhandled event type: ${eventType} (${paymentStatus})`);
  }

  return NextResponse.json({ ok: true });
}
