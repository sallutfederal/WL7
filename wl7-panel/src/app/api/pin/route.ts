import { NextResponse } from 'next/server';

const BOT = 'http://localhost:8080';

export async function GET() {
  try {
    const res = await fetch(BOT + '/api/pins');
    return NextResponse.json(await res.json());
  } catch { return NextResponse.json([]); }
}

export async function POST(req: Request) {
  const body = await req.json();
  try {
    const res = await fetch(BOT + '/api/pin', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) });
    return NextResponse.json(await res.json(), { status: res.status });
  } catch (e: any) { return NextResponse.json({ error: e.message }, { status: 500 }); }
}

export async function DELETE(req: Request) {
  const body = await req.json();
  try {
    const res = await fetch(BOT + '/api/pin', { method: 'DELETE', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) });
    return NextResponse.json(await res.json(), { status: res.status });
  } catch (e: any) { return NextResponse.json({ error: e.message }, { status: 500 }); }
}
