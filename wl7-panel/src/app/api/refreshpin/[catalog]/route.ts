import { NextResponse } from 'next/server';

export async function POST(req: Request, { params }: { params: Promise<{ catalog: string }> }) {
  const { catalog } = await params;
  const base = process.env.SETUP_URL || 'http://localhost:8080';
  try {
    const res = await fetch(new URL('/api/refreshpin/' + encodeURIComponent(catalog), base), {
      method: 'POST',
      headers: { 'x-internal-service': 'wl7-panel' },
    });
    return NextResponse.json(await res.json(), { status: res.status });
  } catch (e: any) { return NextResponse.json({ error: e.message }, { status: 500 }); }
}
