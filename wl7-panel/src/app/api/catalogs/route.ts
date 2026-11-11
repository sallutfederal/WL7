import { NextResponse } from 'next/server';
import { loadConfig, saveConfig, getCatalog } from '@/lib/config';

export async function GET() {
  return NextResponse.json(loadConfig().catalogs);
}

export async function POST(req: Request) {
  const body = await req.json();
  const cfg = loadConfig();
  if (!body.name) return NextResponse.json({ error: 'name required' }, { status: 400 });
  if (getCatalog(cfg, body.name)) return NextResponse.json({ error: 'exists' }, { status: 400 });
  cfg.catalogs.push({ name: body.name, description: body.description || '', intro: '', products: [] });
  saveConfig(cfg);
  return NextResponse.json({ ok: true });
}

export async function PUT(req: Request) {
  const body = await req.json();
  const cfg = loadConfig();
  const cat = getCatalog(cfg, body.name);
  if (!cat) return NextResponse.json({ error: 'not found' }, { status: 404 });
  if (body.intro !== undefined) cat.intro = body.intro;
  if (body.description !== undefined) cat.description = body.description;
  saveConfig(cfg);
  return NextResponse.json({ ok: true });
}

export async function DELETE(req: Request) {
  const { searchParams } = new URL(req.url);
  const name = searchParams.get('name');
  if (!name) return NextResponse.json({ error: 'name required' }, { status: 400 });
  const cfg = loadConfig();
  cfg.catalogs = cfg.catalogs.filter(c => c.name.toLowerCase() !== name.toLowerCase());
  cfg.pins = cfg.pins.filter(p => p.catalog.toLowerCase() !== name.toLowerCase());
  saveConfig(cfg);
  return NextResponse.json({ ok: true });
}
