import { prisma } from '@/lib/prisma';
import { notFound } from 'next/navigation';
import ShopUploadUI from '@/components/ShopUploadUI';

export default async function ShopPage({ params }: { params: Promise<{ shopId: string }> }) {
  const { shopId } = await params;
  const shop = await prisma.shop.findUnique({
    where: { slug: shopId },
    include: {
      pricingTiers: true,
    }
  });

  if (!shop) {
    notFound();
  }

  return <ShopUploadUI shop={shop} />;
}
