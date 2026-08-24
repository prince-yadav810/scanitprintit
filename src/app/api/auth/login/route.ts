import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { encrypt } from '@/lib/auth';
import { verifyPassword } from '@/lib/passwords';
import { cookies } from 'next/headers';

export async function POST(req: NextRequest) {
  try {
    const { username, password } = await req.json();

    const user = await prisma.user.findUnique({ where: { username } });
    if (!user) {
      return NextResponse.json({ error: 'Invalid credentials' }, { status: 401 });
    }

    const isValid = await verifyPassword(password, user.password);
    if (!isValid) {
      return NextResponse.json({ error: 'Invalid credentials' }, { status: 401 });
    }

    // Create session
    const sessionData = {
      userId: user.id,
      username: user.username,
      role: user.role,
      shopId: user.shopId
    };

    const token = await encrypt(sessionData);

    const cookieStore = await cookies();
    cookieStore.set('printdesk_session', token, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'lax',
      maxAge: 60 * 60 * 24 // 24 hours
    });

    return NextResponse.json({ 
      success: true,
      redirectUrl: user.role === 'PLATFORM_ADMIN' ? '/admin/platform' : (user.shopId ? `/admin/shop/${user.shopId}` : '/admin/platform')
    });
  } catch (error) {
    console.error('Login error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
