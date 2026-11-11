// language: JavaScript (Node.js), file: server.js, target: Express gateway for PingoCash PIX + webhook receiver
require('dotenv').config();
const express = require('express');
const pc = require('./pingocash');

const app = express();
const PORT = process.env.PORT || 3001;

// keep raw body for webhook signature verification
app.use(express.json({
  verify: (req, res, buf) => { req.rawBody = buf; },
}));

app.get('/health', (req, res) => res.json({ ok: true, service: 'gateway', baseUrl: pc.BASE_URL }));

app.get('/test', async (req, res) => {
  try {
    const r = await pc.testCredentials();
    res.json({ ok: true, data: r });
  } catch (e) {
    res.status(500).json({ ok: false, error: e.message });
  }
});

// create a charge (supports /charge, /pix/create, /pix/charge)
async function handleCreateCharge(req, res) {
  try {
    const { amount, external_id, description, payer } = req.body || {};
    if (!amount || !external_id) return res.status(400).json({ ok: false, error: 'amount e external_id obrigatorios' });
    const r = await pc.createCharge({ amount, external_id, description, payer });
    res.json({ ok: true, success: true, data: r && r.data ? r.data : r });
  } catch (e) {
    res.status(500).json({ ok: false, error: e.message });
  }
}
app.post('/charge', handleCreateCharge);
app.post('/pix/create', handleCreateCharge);
app.post('/pix/charge', handleCreateCharge);

// get charge status (supports /charge/:id and /pix/status?transaction_id=uuid)
app.get('/charge/:id', async (req, res) => {
  try {
    const r = await pc.getCharge(req.params.id);
    res.json({ ok: true, success: true, data: r && r.data ? r.data : r });
  } catch (e) {
    res.status(500).json({ ok: false, error: e.message });
  }
});

app.get('/pix/status', async (req, res) => {
  try {
    const id = req.query.transaction_id || req.query.id || req.query.external_id;
    if (!id) return res.status(400).json({ ok: false, error: 'transaction_id obrigatorio' });
    const r = await pc.getCharge(id);
    res.json({ ok: true, success: true, data: r && r.data ? r.data : r });
  } catch (e) {
    res.status(500).json({ ok: false, error: e.message });
  }
});

// webhook receiver from PingoCash/IcePay
app.post('/webhook/pingocash', (req, res) => {
  const sig = req.headers['x-icepay-signature'] || req.headers['x-pingocash-signature'] || req.headers['x-signature'];
  const secret = process.env.PINGO_WEBHOOK_SECRET;
  const ok = pc.verifyWebhookSignature(req.rawBody, sig, secret);
  if (!ok) {
    console.warn('webhook signature invalid');
    return res.status(401).json({ ok: false, error: 'invalid signature' });
  }
  const event = req.body || {};
  console.log('webhook event:', JSON.stringify(event));
  global.__events = global.__events || [];
  global.__events.unshift({ receivedAt: new Date().toISOString(), event });
  global.__events = global.__events.slice(0, 100);
  res.json({ ok: true });
});

// list recent webhook events
app.get('/events', (req, res) => res.json({ ok: true, events: global.__events || [] }));

if (!process.env.VERCEL) {
  app.listen(PORT, () => console.log('gateway listening on port ' + PORT));
}

module.exports = app;
