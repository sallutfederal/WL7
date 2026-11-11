import { NextResponse } from 'next/server';

function getSetupUrl(path: string) {
  const base = process.env.SETUP_URL || 'http://localhost:8080';
  return new URL(path, base);
}

export async function GET() {
  try {
    const res = await fetch(getSetupUrl('/api/pins'), {
      headers: { 'x-internal-service': 'wl7-panel' },
    });
    return NextResponse.json(await res.json());
  } catch { return NextResponse.json([]); }
}

export async function POST(req: Request) {
  const body = await req.json();
  try {
    const res = await fetch(getSetupUrl('/api/pin'), {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'x-internal-service': 'wl7-panel' },
      body: JSON.stringify(body),
    });
    return NextResponse.json(await res.json(), { status: res.status });
  } catch (e: any) { return NextResponse.json({ error: e.message }, { status: 500 }); }
}

export async function DELETE(req: Request) {
  const body = await req.json();
  try {
    const res = await fetch(getSetupUrl('/api/pin'), {
      method: 'DELETE',
      headers: { 'Content-Type': 'application/json', 'x-internal-service': 'wl7-panel' },
      body: JSON.stringify(body),
    });
    return NextResponse.json(await res.json(), { status: res.status });
  } catch (e: any) { return NextResponse.json({ error: e.message }, { status: 500 }); }
}
