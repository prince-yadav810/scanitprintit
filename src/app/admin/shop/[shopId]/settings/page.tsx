import { prisma } from '@/lib/prisma';
import { notFound } from 'next/navigation';
import ShopSettingsUI from '@/components/ShopSettingsUI';

export default async function ShopSettingsPage({ params }: { params: Promise<{ shopId: string }> }) {
  const { shopId } = await params;
  const shop = await prisma.shop.findUnique({
    where: { id: shopId },
    include: {
      pricingTiers: true
    }
  });

  if (!shop) {
    notFound();
  }

  return <ShopSettingsUI shop={shop} />;
}
