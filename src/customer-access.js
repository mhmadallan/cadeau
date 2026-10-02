const { randomBytes, createHash } = require('node:crypto');
const hash = (value) => createHash('sha256').update(value).digest('hex');
function normalizePhone(value) {
  if (typeof value !== 'string' || !/^[+\d ()-]+$/.test(value)) throw new Error('Enter your number with country code, for example +4917612345678.');
  const number = value.replace(/[ ()-]/g, '').replace(/^00/, '+');
  if (!/^\+[1-9]\d{6,14}$/.test(number)) throw new Error('Include + and your country code.');
  return number;
}

async function sendAccessMessage(kind, customer, env = process.env, fetchImpl = fetch) {
  const template = kind === 'request' ? env.WHATSAPP_ACCESS_REQUEST_TEMPLATE : env.WHATSAPP_ACCESS_APPROVED_TEMPLATE;
  const to = kind === 'request' ? env.WHATSAPP_RECIPIENT_NUMBER : customer.phone.slice(1);
  if (!template || !env.WHATSAPP_ACCESS_TOKEN || !env.WHATSAPP_PHONE_NUMBER_ID || !env.WHATSAPP_API_VERSION || !to) return 'not_configured';
  try {
    const response = await fetchImpl(`https://graph.facebook.com/${env.WHATSAPP_API_VERSION}/${env.WHATSAPP_PHONE_NUMBER_ID}/messages`, {
      method: 'POST', headers: { Authorization: `Bearer ${env.WHATSAPP_ACCESS_TOKEN}`, 'Content-Type': 'application/json' },
      signal: AbortSignal.timeout(15000),
      body: JSON.stringify({ messaging_product: 'whatsapp', to, type: 'template', template: {
        name: template, language: { code: env.WHATSAPP_ACCESS_TEMPLATE_LANGUAGE || 'en' },
        components: [{ type: 'body', parameters: [customer.name, customer.phone].map(text => ({ type: 'text', text })) }],
      } }),
    });
    const result = await response.json();
    return response.ok && result.messages?.[0]?.id ? 'accepted' : 'unknown';
  } catch { return 'unknown'; }
}

function createCustomerAccess(db, notify = sendAccessMessage) {
  const hits = new Map();
  function rateLimit(req, res, next) {
    const now = Date.now();
    for (const [key, value] of hits) if (value.until < now) hits.delete(key);
    const key = req.ip;
    const value = hits.get(key) || { count: 0, until: now + 60000 };
    if (++value.count > 10) return res.status(429).json({ error: 'Too many attempts. Please wait a minute.' });
    hits.set(key, value); next();
  }
  async function authenticate(token) {
    if (!/^shop_[a-f0-9]{64}$/.test(token)) return { error: 'Invalid session', status: 401 };
    const { data, error } = await db.from('customer_sessions').select('customer_id,expires_at').eq('token_hash', hash(token)).maybeSingle();
    if (error) return { error: 'Access service unavailable', status: 503 };
    if (!data || Date.parse(data.expires_at) <= Date.now()) return { error: 'Session expired', status: 401 };
    const customer = await db.from('shop_customers').select('id,status').eq('id', data.customer_id).maybeSingle();
    if (customer.error) return { error: 'Access service unavailable', status: 503 };
    if (customer.data?.status !== 'approved') return { error: 'Shop access is not approved', status: 403 };
    // Never expose the stored name, number or any other customer's private data.
    return { user: { id: customer.data.id }, role: 'customer', authType: 'phone' };
  }
  return {
    authenticate, rateLimit,
    async request(req, res) {
      let phone;
      try { phone = normalizePhone(req.body?.phone); } catch (e) { return res.status(400).json({ error: e.message }); }
      const name = req.body?.name;
      if (typeof name !== 'string' || !name.trim() || name.trim().length > 100 || /[\r\n\t]/.test(name)) return res.status(400).json({ error: 'Enter your name (up to 100 characters).' });
      const inserted = await db.from('shop_customers').insert({ phone, name: name.trim() }).select('id,name,phone').single();
      if (inserted.error?.code === '23505') return res.status(202).json({ message: 'Your request is already registered. If approved, use Enter shop.' });
      if (inserted.error) return res.status(503).json({ error: 'Could not save your request. Please try again later.' });
      const status = await notify('request', inserted.data);
      await db.from('shop_customers').update({ request_notification: status }).eq('id', inserted.data.id);
      return res.status(201).json({ message: 'Your request is saved and awaiting admin approval. Check back here to enter the shop.' });
    },
    async login(req, res) {
      let phone;
      try { phone = normalizePhone(req.body?.phone); } catch (e) { return res.status(400).json({ error: e.message }); }
      const { data, error } = await db.from('shop_customers').select('id,status').eq('phone', phone).maybeSingle();
      if (error) return res.status(503).json({ error: 'Access service unavailable.' });
      if (data?.status !== 'approved') return res.status(403).json({ error: 'This number is not approved. Submit an access request or wait for admin approval.' });
      const token = `shop_${randomBytes(32).toString('hex')}`;
      const expires_at = new Date(Date.now() + 30 * 86400000).toISOString();
      const saved = await db.from('customer_sessions').insert({ token_hash: hash(token), customer_id: data.id, expires_at });
      if (saved.error) return res.status(503).json({ error: 'Could not start your session.' });
      res.set('Cache-Control', 'no-store');
      return res.json({ access_token: token, expires_at, user: { id: data.id }, role: 'customer' });
    },
    async logout(req, res) {
      const token = (req.get('authorization') || '').replace(/^Bearer /, '');
      if (token.startsWith('shop_')) {
        const result = await db.from('customer_sessions').delete().eq('token_hash', hash(token));
        if (result.error) return res.status(503).json({ error: 'Could not end the session. Please retry.' });
      }
      return res.sendStatus(204);
    },
    async list(req, res) {
      const page = Math.max(0, Math.min(10000, Number(req.query.page) || 0));
      const result = await db.from('shop_customers').select('id,name,phone,status,created_at,request_notification,approval_notification').order('created_at', { ascending: false }).range(page * 50, page * 50 + 49);
      if (result.error) return res.status(503).json({ error: 'Could not load access requests. Check database setup.' });
      return res.json(result.data);
    },
    async decide(req, res) {
      const status = req.body?.status;
      if (!['approved', 'rejected'].includes(status) || !/^[a-f0-9-]{36}$/i.test(req.params.id)) return res.status(400).json({ error: 'Invalid decision.' });
      const result = await db.from('shop_customers').update({ status, reviewed_by: req.user.id, reviewed_at: new Date().toISOString() }).eq('id', req.params.id).neq('status', status).select('id,name,phone').maybeSingle();
      if (result.error) return res.status(503).json({ error: 'Could not save decision.' });
      if (!result.data) return res.json({ message: 'No change needed.' });
      if (status === 'rejected') await db.from('customer_sessions').delete().eq('customer_id', result.data.id);
      let notification = null;
      if (status === 'approved') {
        notification = await notify('approved', result.data);
        await db.from('shop_customers').update({ approval_notification: notification }).eq('id', result.data.id);
      }
      return res.json({ status, notification });
    },
  };
}
module.exports = { createCustomerAccess, normalizePhone, sendAccessMessage };
