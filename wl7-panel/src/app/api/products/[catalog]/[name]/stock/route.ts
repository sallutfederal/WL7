import { NextResponse } from 'next/server';
import { loadConfig, saveConfig, getCatalog } from '@/lib/config';

export async function PUT(req: Request, { params }: { params: Promise<{ catalog: string; name: string }> }) {
  const { catalog, name } = await params;
  const body = await req.json();
  const cfg = loadConfig();
  const cat = getCatalog(cfg, catalog);
  if (!cat) return NextResponse.json({ error: 'catalog not found' }, { status: 404 });
  const p = cat.products.find(x => x.name.toLowerCase() === name.toLowerCase());
  if (!p) return NextResponse.json({ error: 'product not found' }, { status: 404 });
  p.stock = Number(body.stock);
  saveConfig(cfg);
  return NextResponse.json({ ok: true });
}
