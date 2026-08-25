import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';

const CF_BASE = process.env.CASHFREE_ENV === 'PRODUCTION'
  ? 'https://api.cashfree.com'
  : 'https://sandbox.cashfree.com';

/**
 * GET /api/orders/[orderId]/status
 *
 * Returns current order status.
 * If order is still AWAITING_PAYMENT but has a cashfreeOrderId,
 * we actively verify with Cashfree's API whether payment succeeded.
 * This fixes the webhook-delay payment loop without relying on redirect URL params.
 */
export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ orderId: string }> }
) {
  const { orderId } = await params;

  const order = await prisma.order.findUnique({
    where: { id: orderId },
    include: { shop: true },
  });

  if (!order) return NextResponse.json({ error: 'Not found' }, { status: 404 });

  // Fast path: order already moved past payment — just return status
  if (order.status !== 'AWAITING_PAYMENT') {
    return NextResponse.json({ status: order.status });
  }

  // Order is still AWAITING_PAYMENT — check with Cashfree directly
  // This handles the case where webhook was delayed, failed, or env var was wrong
  if (order.cashfreeOrderId && process.env.CASHFREE_APP_ID && process.env.CASHFREE_SECRET_KEY) {
    try {
      const cfRes = await fetch(`${CF_BASE}/pg/orders/${order.cashfreeOrderId}`, {
        headers: {
          'x-api-version':   '2023-08-01',
          'x-client-id':     process.env.CASHFREE_APP_ID,
          'x-client-secret': process.env.CASHFREE_SECRET_KEY,
        },
        // Don't let this slow down the poll — 4s timeout
        signal: AbortSignal.timeout(4000),
      });

      if (cfRes.ok) {
        const cfOrder = await cfRes.json();
        const cfStatus = cfOrder.order_status as string; // PAID, ACTIVE, EXPIRED, etc.

        if (cfStatus === 'PAID') {
          // Cashfree confirms payment — update our DB
          const nextStatus = order.shop.autoPrintEnabled ? 'PAID_QUEUED' : 'AWAITING_APPROVAL';

          await prisma.order.update({
            where: { id: order.id },
            data: {
              status:           nextStatus,
              paymentReference: order.paymentReference ?? cfOrder.cf_order_id ?? order.cashfreeOrderId,
            },
          });

          console.log(`[status poll] Order ${order.orderNumber} confirmed PAID by Cashfree → ${nextStatus}`);
          return NextResponse.json({ status: nextStatus });
        }
      }
    } catch (err: any) {
      // Non-fatal — just return the current DB status if Cashfree check fails
      console.warn(`[status poll] Cashfree check failed for order ${orderId}: ${err.message}`);
    }
  }

  return NextResponse.json({ status: order.status });
}
