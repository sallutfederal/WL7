import { NextResponse } from 'next/server';
import { loadConfig, saveConfig, getCatalog } from '@/lib/config';

export async function GET(req: Request) {
  const { searchParams } = new URL(req.url);
  const catalog = searchParams.get('catalog');
  const cfg = loadConfig();
  if (catalog) {
    const cat = getCatalog(cfg, catalog);
    if (!cat) return NextResponse.json({ error: 'not found' }, { status: 404 });
    return NextResponse.json(cat.products);
  }
  return NextResponse.json(cfg.catalogs.map(c => ({ catalog: c.name, products: c.products })));
}

export async function POST(req: Request) {
  const body = await req.json();
  const cfg = loadConfig();
  const cat = getCatalog(cfg, body.catalog);
  if (!cat) return NextResponse.json({ error: 'catalog not found' }, { status: 404 });
  const existing = cat.products.find(p => p.name.toLowerCase() === String(body.name).toLowerCase());
  if (existing) { existing.price = Number(body.price); existing.description = body.description || ''; if (body.stock !== undefined) existing.stock = Number(body.stock); }
  else cat.products.push({ name: body.name, price: Number(body.price), description: body.description || '', stock: body.stock !== undefined ? Number(body.stock) : -1 });
  saveConfig(cfg);
  return NextResponse.json({ ok: true });
}

export async function DELETE(req: Request) {
  const { searchParams } = new URL(req.url);
  const catalog = searchParams.get('catalog');
  const name = searchParams.get('name');
  if (!catalog || !name) return NextResponse.json({ error: 'missing params' }, { status: 400 });
  const cfg = loadConfig();
  const cat = getCatalog(cfg, catalog);
  if (!cat) return NextResponse.json({ error: 'catalog not found' }, { status: 404 });
  cat.products = cat.products.filter(p => p.name.toLowerCase() !== name.toLowerCase());
  saveConfig(cfg);
  return NextResponse.json({ ok: true });
}
