import { prisma } from '@/lib/prisma';
import { notFound } from 'next/navigation';
import CheckoutUI from '@/components/CheckoutUI';

// Must be dynamic — order status changes after payment
export const dynamic = 'force-dynamic';

export default async function OrderPage({
  params,
}: {
  params: Promise<{ orderId: string }>;
}) {
  const { orderId } = await params;

  const order = await prisma.order.findUnique({
    where: { id: orderId },
    include: { shop: true, files: true },
  });

  if (!order) {
    notFound();
  }

  return <CheckoutUI order={order} />;
}
