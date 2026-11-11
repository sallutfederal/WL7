// language: JavaScript (Node.js), file: pingocash.js, target: PingoCash/IcePay PIX API client
const crypto = require('crypto');

const BASE_URL = (process.env.PINGO_BASE_URL || 'https://api.pingocash.com.br/api/v1').replace(/\/$/, '');
const DEFAULT_API_KEY = 'lp_535c04ed50234257a4ba5de5';

function getApiKey() {
  const key = process.env.PINGO_API_KEY || DEFAULT_API_KEY;
  if (!key) throw new Error('PINGO_API_KEY nao definido');
  return key;
}

function authHeaders() {
  return {
    'Authorization': 'Bearer ' + getApiKey(),
    'Content-Type': 'application/json',
  };
}

async function request(method, path, body) {
  const res = await fetch(BASE_URL + path, {
    method,
    headers: authHeaders(),
    body: body ? JSON.stringify(body) : undefined,
  });
  const text = await res.text();
  let json = null;
  try { json = JSON.parse(text); } catch (e) {}
  if (!res.ok) {
    const err = new Error('pingocash ' + res.status + ': ' + text);
    err.status = res.status;
    err.response = json || text;
    throw err;
  }
  return json || text;
}

async function testCredentials() {
  try {
    return await request('GET', '/test');
  } catch (e) {
    // /test may require Basic Auth on some versions while Bearer lp_... keys work on /pix/status & /pix/charge
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

// Create a PIX charge. Returns { success, data: { id, external_id, amount, qr_code, qr_code_base64, copy_paste, status } }
async function createCharge({ amount, external_id, description, payer }) {
  const numAmount = Number(Number(amount).toFixed(2));
  if (!numAmount || numAmount <= 0) throw new Error('Valor da cobranca invalido: ' + amount);
  const payload = {
    amount: numAmount,
    external_id: String(external_id),
  };
  if (description) payload.description = String(description);
  if (payer) {
    payload.payer = {
      name: (payer && payer.name) ? String(payer.name) : 'Cliente',
      document: (payer && payer.document) ? String(payer.document) : '12345678909',
    };
  }
  // Try /pix/charge first (works with Bearer lp_... API keys), fallback to /pix/create
  let raw;
  try {
    raw = await request('POST', '/pix/charge', payload);
  } catch (e) {
    try {
      raw = await request('POST', '/pix/create', payload);
    } catch (e2) {
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

// Consultar status: GET /pix/status?transaction_id=uuid (also sends ?id=uuid for compatibility)
async function getCharge(idOrExternalId) {
  if (!idOrExternalId) throw new Error('ID da transacao nao informado');
  const encoded = encodeURIComponent(String(idOrExternalId));
  try {
    return await request('GET', '/pix/status?id=' + encoded + '&transaction_id=' + encoded);
  } catch (e) {
    if (e.status === 404 || e.status === 400) {
      return await request('GET', '/pix/status?external_id=' + encoded + '&transaction_id=' + encoded);
    }
    throw e;
  }
}

// Validate webhook signature (Header X-IcePay-Signature)
const DEFAULT_WEBHOOK_SECRET = 'whsec_1cc2d187a235bd1478f9ccffd7b18f27b1186bebfd2f481f';
function verifyWebhookSignature(rawBody, signature, secret = process.env.PINGO_WEBHOOK_SECRET || DEFAULT_WEBHOOK_SECRET) {
  if (!secret) return true; // no secret configured -> allow
  if (!signature) return false;
  const sig = String(signature).replace(/^sha256=/, '').trim();
  if (sig === secret) return true;
  const expected = crypto.createHmac('sha256', secret).update(rawBody || '').digest('hex');
  try {
    return crypto.timingSafeEqual(Buffer.from(sig, 'hex'), Buffer.from(expected, 'hex'));
  } catch (e) {
    return false;
  }
}

module.exports = { BASE_URL, getApiKey, authHeaders, testCredentials, createCharge, getCharge, verifyWebhookSignature };
