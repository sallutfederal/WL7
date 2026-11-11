import { NextResponse } from 'next/server';
import { loadConfig, saveConfig } from '@/lib/config';

export async function GET() { return NextResponse.json(loadConfig().targets); }

export async function POST(req: Request) {
  const body = await req.json();
  const cfg = loadConfig();
  if (!body.name || !body.webhook) return NextResponse.json({ error: 'name and webhook required' }, { status: 400 });
  const existing = cfg.targets.find(t => t.name.toLowerCase() === body.name.toLowerCase());
  if (existing) { existing.webhook = body.webhook; existing.note = body.note || ''; }
  else cfg.targets.push({ name: body.name, webhook: body.webhook, note: body.note || '' });
  saveConfig(cfg);
  return NextResponse.json({ ok: true });
}

export async function DELETE(req: Request) {
  const { searchParams } = new URL(req.url);
  const name = searchParams.get('name');
  const cfg = loadConfig();
  cfg.targets = cfg.targets.filter(t => t.name.toLowerCase() !== String(name).toLowerCase());
  saveConfig(cfg);
  return NextResponse.json({ ok: true });
}
