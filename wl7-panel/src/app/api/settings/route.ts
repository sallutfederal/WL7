import { NextResponse } from 'next/server';
import { loadConfig, saveConfig } from '@/lib/config';

export async function GET() { return NextResponse.json(loadConfig()); }

export async function PUT(req: Request) {
  const body = await req.json();
  const cfg = loadConfig();
  if (body.botName) cfg.botName = body.botName;
  if (body.currency) cfg.currency = body.currency.toUpperCase();
  saveConfig(cfg);
  return NextResponse.json({ ok: true });
}
