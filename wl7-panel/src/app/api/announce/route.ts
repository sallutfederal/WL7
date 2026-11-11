import { NextResponse } from 'next/server';

export async function POST(req: Request) {
  const formData = await req.formData();
  const base = process.env.SETUP_URL || 'http://localhost:8080';
  try {
    const res = await fetch(new URL('/api/announce', base), {
      method: 'POST',
      headers: { 'x-internal-service': 'wl7-panel' },
      body: formData,
    });
    const data = await res.json().catch(() => ({ error: res.statusText }));
    return NextResponse.json(data, { status: res.status });
  } catch (e: any) {
    return NextResponse.json({ error: e.message }, { status: 500 });
  }
}
