import { prisma } from '@/lib/prisma';
import { notFound } from 'next/navigation';
import CheckoutUI from '@/components/CheckoutUI';

export default async function OrderPage({ params, searchParams }: { params: Promise<{ orderId: string }>; searchParams: Promise<{ payment_status?: string }> }) {
  const { orderId } = await params;
  const { payment_status } = await searchParams;
  const order = await prisma.order.findUnique({
    where: { id: orderId },
    include: {
      shop: true,
      files: true,
    }
  });

  if (!order) {
    notFound();
  }

  // Fallback: if Cashfree redirected with ?payment_status=SUCCESS but webhook
  // hasn't fired yet, update the order ourselves so it doesn't loop.
  if (
    payment_status === 'SUCCESS' &&
    order.status === 'AWAITING_PAYMENT'
  ) {
    const nextStatus = order.shop.autoPrintEnabled ? 'PAID_QUEUED' : 'AWAITING_APPROVAL';
    await prisma.order.update({
      where: { id: order.id },
      data: { status: nextStatus },
    });
    // Refresh order with new status
    order.status = nextStatus as any;
  }

  return <CheckoutUI order={order} />;
}
