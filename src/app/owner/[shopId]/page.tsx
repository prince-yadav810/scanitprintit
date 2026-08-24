import { prisma } from '@/lib/prisma';
import { notFound } from 'next/navigation';
import AdminShopUI from '@/components/AdminShopUI';
import { getSession } from '@/lib/auth';

export default async function AdminShopPage({ params }: { params: Promise<{ shopId: string }> }) {
  const { shopId } = await params;
  const session = await getSession();

  const shop = await prisma.shop.findUnique({
    where: { id: shopId },
    include: {
      orders: {
        orderBy: { createdAt: 'desc' },
        take: 50,
        include: { files: true },
      },
      agents: true,
    },
  });

  if (!shop) notFound();

  return <AdminShopUI shop={shop} userRole={session?.role} />;
}
