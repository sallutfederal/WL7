import { NextResponse } from 'next/server';
import { verifyWebhookSignature } from '@/lib/pingocash';
import { loadConfig, saveConfig } from '@/lib/config';

export async function POST(req: Request) {
  const rawBody = await req.text();
  const sig = req.headers.get('x-icepay-signature') || req.headers.get('x-pingocash-signature') || req.headers.get('x-signature');
  const secret = process.env.PINGO_WEBHOOK_SECRET;

  if (!verifyWebhookSignature(rawBody, sig, secret)) {
    return NextResponse.json({ ok: false, error: 'invalid signature' }, { status: 401 });
  }

  let body: any = {};
  try { body = JSON.parse(rawBody); } catch {}

  if (body.event === 'payment.updated' || body.data) {
    const d = body.data || body;
    const cfg = loadConfig();
    const order = cfg.orders.find(o => o.externalId === d.external_id || (o.chargeId && o.chargeId === d.id));
    if (order && d.status && order.status !== 'paid' && order.status !== 'delivered') {
      const st = String(d.status).toLowerCase();
      if (st === 'completed' || st === 'paid' || st === 'approved') {
        order.status = 'paid';
        order.paidAt = new Date().toISOString();
        saveConfig(cfg);
        const client = (global as any).discordClient;
        if (client) {
          try {
            const user = await client.users.fetch(order.userId);
            await user.send('✅ **Pagamento confirmado!**\nPedido **#' + order.id + '** — **' + order.product + '**').catch(() => {});
          } catch {}
        }
      } else if (st === 'cancelled' || st === 'expired' || st === 'failed') {
        order.status = st;
        for (const cat of cfg.catalogs) {
          const prod = (cat.products || []).find(p => p.name === order.product);
          if (prod && prod.stock !== -1) prod.stock += 1;
        }
        saveConfig(cfg);
      }
    }
  }

  return NextResponse.json({ ok: true });
}

