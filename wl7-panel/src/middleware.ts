import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';

const SECRET = process.env.SESSION_SECRET || 'wl7-store-secret-key-2026';
const TOKEN = 'WL7STORE:' + SECRET;

export function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;
  if (pathname === '/login' || pathname === '/api/login' || pathname === '/api/webhook/pingocash') return NextResponse.next();
  if (pathname.startsWith('/_next') || pathname.startsWith('/favicon')) return NextResponse.next();
  const token = request.cookies.get('session')?.value;
  if (token !== TOKEN) {
    if (pathname.startsWith('/api/')) {
      return NextResponse.json({ error: 'unauthorized' }, { status: 401 });
    }
    return NextResponse.redirect(new URL('/login', request.url));
  }
  return NextResponse.next();
}

export const config = {
  matcher: ['/((?!_next/static|_next/image|favicon.ico).*)'],
};
