import { NextResponse } from 'next/server';

export async function GET() {
  try {
    const res = await fetch('http://localhost:8080/api/channels');
    if (!res.ok) return NextResponse.json([]);
    return NextResponse.json(await res.json());
  } catch {
    return NextResponse.json([]);
  }
}
