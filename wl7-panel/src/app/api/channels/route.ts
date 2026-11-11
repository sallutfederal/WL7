import { NextResponse } from 'next/server';

export async function GET() {
  const setupBase = process.env.SETUP_URL || 'http://localhost:8080';
  try {
    const res = await fetch(new URL('/api/channels', setupBase), {
      headers: { 'x-internal-service': 'wl7-panel' },
    });
    if (!res.ok) return NextResponse.json([]);
    return NextResponse.json(await res.json());
  } catch {
    return NextResponse.json([]);
  }
}
