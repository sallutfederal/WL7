import { NextResponse } from 'next/server';

const BOT = 'http://localhost:8080';

export async function POST() {
  try {
    const res = await fetch(BOT + '/api/pushall', { method: 'POST' });
    return NextResponse.json(await res.json(), { status: res.status });
  } catch (e: any) { return NextResponse.json({ error: e.message }, { status: 500 }); }
}
