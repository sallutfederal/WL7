import { NextResponse } from 'next/server';
import { loadConfig, saveConfig } from '@/lib/config';

export async function POST(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const cfg = loadConfig();
  const order = cfg.orders.find(o => o.id === Number(id));
  if (!order) return NextResponse.json({ error: 'not found' }, { status: 404 });
  order.status = 'delivered';
  if (!order.deliveredAt) order.deliveredAt = new Date().toISOString();
  saveConfig(cfg);
  return NextResponse.json({ ok: true });
}
