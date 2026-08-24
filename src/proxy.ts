import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';
import { decrypt } from '@/lib/auth';

export async function proxy(request: NextRequest) {
  const path = request.nextUrl.pathname;

  // Protect both /admin and /owner routes
  if (path.startsWith('/admin') || path.startsWith('/owner')) {
    const sessionCookie = request.cookies.get('printdesk_session')?.value;
    
    if (!sessionCookie) {
      return NextResponse.redirect(new URL('/login', request.url));
    }

    const session = await decrypt(sessionCookie);
    if (!session) {
      return NextResponse.redirect(new URL('/login', request.url));
    }

    // Role-based access control
    if (path.startsWith('/admin') && session.role !== 'PLATFORM_ADMIN') {
      return NextResponse.redirect(new URL(session.shopId ? `/owner/${session.shopId}` : '/login', request.url)); 
    }

    if (path.startsWith('/owner') && session.role !== 'SHOP_OWNER' && session.role !== 'PLATFORM_ADMIN') {
      return NextResponse.redirect(new URL('/login', request.url));
    }
  }

  return NextResponse.next();
}

export const config = {
  matcher: ['/admin/:path*', '/owner/:path*'],
};
