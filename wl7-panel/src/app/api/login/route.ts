import { NextResponse } from 'next/server';
import { cookies } from 'next/headers';

const SECRET = process.env.SESSION_SECRET || 'wl7-store-secret-key-2026';
const TOKEN = 'WL7STORE:' + SECRET;

export async function POST(req: Request) {
  const body = await req.json();
  if (body.username === 'WL7 STORE' && body.password === 'WL7STORE') {
    const cookieStore = await cookies();
    cookieStore.set('session', TOKEN, { httpOnly: true, path: '/', sameSite: 'lax' });
    return NextResponse.json({ ok: true });
  }
  return NextResponse.json({ error: 'invalid credentials' }, { status: 401 });
}
