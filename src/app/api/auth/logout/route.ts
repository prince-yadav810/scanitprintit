import { NextResponse } from 'next/server';
import { cookies } from 'next/headers';

export async function GET() {
  const cookieStore = await cookies();
  cookieStore.delete('printdesk_session');
  return NextResponse.redirect(new URL('/login', process.env.NEXT_PUBLIC_APP_URL || 'https://www.scanitprintit.in'));
}

// Also handle POST for safety
export async function POST() {
  const cookieStore = await cookies();
  cookieStore.delete('printdesk_session');
  return NextResponse.json({ success: true });
}
