import { NextResponse } from 'next/server';

const BOT = 'http://localhost:8080';

export async function POST(req: Request, { params }: { params: Promise<{ name: string }> }) {
  const { name } = await params;
  try {
    const res = await fetch(BOT + '/api/pushconfig/' + encodeURIComponent(name), { method: 'POST' });
    return NextResponse.json(await res.json(), { status: res.status });
  } catch (e: any) { return NextResponse.json({ error: e.message }, { status: 500 }); }
}
