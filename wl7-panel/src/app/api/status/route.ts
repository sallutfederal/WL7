import { NextResponse } from 'next/server';
import { loadConfig } from '@/lib/config';

export async function GET() {
  const cfg = loadConfig();
  return NextResponse.json({
    botName: cfg.botName, currency: cfg.currency, botAvatar: cfg.botAvatar, botBanner: cfg.botBanner,
    catalogs: cfg.catalogs.length,
    products: cfg.catalogs.reduce((a, c) => a + (c.products ? c.products.length : 0), 0),
    orders: cfg.orders.length, targets: cfg.targets.length, pins: cfg.pins.length,
    pendingOrders: cfg.orders.filter(o => o.status === 'pending').length,
    paidOrders: cfg.orders.filter(o => o.status === 'paid' || o.status === 'delivered').length,
    revenue: cfg.orders.filter(o => o.status === 'paid' || o.status === 'delivered').reduce((a, o) => a + o.amount, 0),
  });
}
