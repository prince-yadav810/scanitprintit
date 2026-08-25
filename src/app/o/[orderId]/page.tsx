import { prisma } from '@/lib/prisma';
import { notFound } from 'next/navigation';
import CheckoutUI from '@/components/CheckoutUI';

// Force dynamic so Next.js never caches this — payment status must always be fresh
export const dynamic = 'force-dynamic';
export const revalidate = 0;

export default async function OrderPage({
  params,
  searchParams,
}: {
  params: Promise<{ orderId: string }>;
  searchParams: Promise<{ payment_status?: string }>;
}) {
  const { orderId } = await params;
  const { payment_status } = await searchParams;

  const order = await prisma.order.findUnique({
    where: { id: orderId },
    include: { shop: true, files: true },
  });

  if (!order) {
    notFound();
  }

  // Fallback: Cashfree redirected with ?payment_status=SUCCESS but the webhook
  // may not have fired yet. Update the order directly so the UI shows the right state
  // and the customer doesn't see the Pay button again (payment loop).
  const paymentStatusUpper = (payment_status ?? '').toUpperCase();
  const isPaidRedirect = paymentStatusUpper === 'SUCCESS' || paymentStatusUpper === 'PAID';

  if (isPaidRedirect && order.status === 'AWAITING_PAYMENT') {
    const nextStatus = order.shop.autoPrintEnabled ? 'PAID_QUEUED' : 'AWAITING_APPROVAL';
    const updated = await prisma.order.update({
      where: { id: order.id },
      data: {
        status: nextStatus,
        // If no payment reference yet, store the cashfreeOrderId as reference
        paymentReference: order.paymentReference ?? order.cashfreeOrderId ?? 'REDIRECT_FALLBACK',
      },
    });
    // Pass the freshly updated record to the UI
    return <CheckoutUI order={{ ...order, status: updated.status }} />;
  }

  return <CheckoutUI order={order} />;
}
