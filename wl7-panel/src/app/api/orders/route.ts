import { NextResponse } from 'next/server';
import { loadConfig, saveConfig } from '@/lib/config';

export async function GET() {
  const cfg = loadConfig();
  return NextResponse.json(cfg.orders.slice().reverse());
}

export async function PUT(req: Request) {
  const body = await req.json();
  const cfg = loadConfig();
  const order = cfg.orders.find(o => o.id === Number(body.id));
  if (!order) return NextResponse.json({ error: 'not found' }, { status: 404 });
  order.status = body.status;
  if (body.status === 'paid' && !order.paidAt) order.paidAt = new Date().toISOString();
  if (body.status === 'delivered' && !order.deliveredAt) order.deliveredAt = new Date().toISOString();
  saveConfig(cfg);
  return NextResponse.json({ ok: true });
}
