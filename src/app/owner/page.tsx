import { redirect } from 'next/navigation';
import { getSession } from '@/lib/auth';

export default async function AdminShopPage() {
  const session = await getSession();

  if (!session) {
    redirect('/login');
  }

  if (session.shopId) {
    redirect(`/owner/${session.shopId}`);
  }

  // If no shopId is associated with the user, send them back to platform
  redirect('/admin');
}
