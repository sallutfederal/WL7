import crypto from 'crypto';

export const BASE_URL = (process.env.PINGO_BASE_URL || 'https://api.pingocash.com.br/api/v1').replace(/\/$/, '');
const DEFAULT_API_KEY = 'lp_535c04ed50234257a4ba5de5';

export function getApiKey() {
  const key = process.env.PINGO_API_KEY || DEFAULT_API_KEY;
  if (!key) throw new Error('PINGO_API_KEY nao definido');
  return key;
}

export function authHeaders() {
  return {
    Authorization: 'Bearer ' + getApiKey(),
    'Content-Type': 'application/json',
  };
}

async function request(method: string, path: string, body?: any) {
  const res = await fetch(BASE_URL + path, {
    method,
    headers: authHeaders(),
    body: body ? JSON.stringify(body) : undefined,
  });
  const text = await res.text();
  let json: any = null;
  try { json = JSON.parse(text); } catch {}
  if (!res.ok) {
    const err: any = new Error('pingocash ' + res.status + ': ' + text);
    err.status = res.status;
    err.response = json || text;
    throw err;
  }
  return json || text;
}

export async function testCredentials() {
  try {
    return await request('GET', '/test');
  } catch (e) {
    const res = await fetch(BASE_URL + '/pix/status?id=00000000-0000-0000-0000-000000000000', {
      method: 'GET',
      headers: authHeaders(),
    });
    if (res.status === 404 || res.status === 200) {
      return { success: true, message: 'Credenciais Bearer validas' };
    }
    throw e;
  }
}

export async function createCharge(params: { amount: number; external_id: string; description?: string; payer?: { name?: string; document?: string } }) {
  const numAmount = Number(Number(params.amount).toFixed(2));
  if (!numAmount || numAmount <= 0) throw new Error('Valor da cobranca invalido: ' + params.amount);
  const payload: any = {
    amount: numAmount,
    external_id: String(params.external_id),
  };
  if (params.description) payload.description = String(params.description);
  if (params.payer) {
    payload.payer = {
      name: params.payer.name ? String(params.payer.name) : 'Cliente',
      document: params.payer.document ? String(params.payer.document) : '12345678909',
    };
  }
  let raw: any;
  try {
    raw = await request('POST', '/pix/charge', payload);
  } catch (e: any) {
    try {
      raw = await request('POST', '/pix/create', payload);
    } catch {
      throw e;
    }
  }
  const d = (raw && raw.data) ? raw.data : (raw || {});
  const normalized = {
    id: d.id || d.transaction_id || null,
    external_id: d.external_id || payload.external_id,
    amount: d.amount !== undefined ? Number(d.amount) : numAmount,
    qr_code: d.qr_code || d.copy_paste || '',
    qr_code_base64: d.qr_code_base64 || '',
    copy_paste: d.copy_paste || d.qr_code || '',
    status: d.status || 'pending',
  };
  return {
    success: raw && raw.success !== undefined ? raw.success : true,
    data: normalized,
    ...normalized,
  };
}

export async function getCharge(idOrExternalId: string) {
  if (!idOrExternalId) throw new Error('ID da transacao nao informado');
  const encoded = encodeURIComponent(String(idOrExternalId));
  try {
    return await request('GET', '/pix/status?id=' + encoded + '&transaction_id=' + encoded);
  } catch (e: any) {
    if (e.status === 404 || e.status === 400) {
      return await request('GET', '/pix/status?external_id=' + encoded + '&transaction_id=' + encoded);
    }
    throw e;
  }
}

const DEFAULT_WEBHOOK_SECRET = 'whsec_1cc2d187a235bd1478f9ccffd7b18f27b1186bebfd2f481f';
export function verifyWebhookSignature(rawBody: string | Buffer, signature: string | null | undefined, secret: string | undefined = process.env.PINGO_WEBHOOK_SECRET || DEFAULT_WEBHOOK_SECRET) {
  if (!secret) return true;
  if (!signature) return false;
  const sig = String(signature).replace(/^sha256=/, '').trim();
  if (sig === secret) return true;
  const expected = crypto.createHmac('sha256', secret).update(rawBody || '').digest('hex');
  try {
    return crypto.timingSafeEqual(Buffer.from(sig, 'hex'), Buffer.from(expected, 'hex'));
  } catch {
    return false;
  }
}
