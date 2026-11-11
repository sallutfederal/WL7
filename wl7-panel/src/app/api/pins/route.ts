import { NextResponse } from 'next/server';
import { loadConfig } from '@/lib/config';

export async function GET() {
  return NextResponse.json(loadConfig().pins);
}
