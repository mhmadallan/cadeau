const express = require('express');
const cors = require('cors');
require('dotenv').config();

const { getSupabaseClient } = require('./supabase');
const { createOrderHandler } = require('./orders');
const { createWhatsAppWebhook } = require('./whatsapp-webhook');
const { validateProduct } = require('./catalog');
const { createCustomerAccess } = require('./customer-access');

const app = express();
const port = Number(process.env.PORT || 4000);
const supabaseUrl = process.env.SUPABASE_URL;
const supabaseAnonKey = process.env.SUPABASE_ANON_KEY;
const corsOrigins = (process.env.CORS_ORIGINS || 'https://mhmadallan.github.io')
  .split(',')
  .map((origin) => origin.trim())
  .filter(Boolean);

app.use(cors({
  origin(origin, callback) {
    if (!origin) {
      return callback(null, true);
    }

    if (!corsOrigins.length || corsOrigins.includes(origin)) {
      return callback(null, true);
    }

    return callback(new Error('Origin not allowed by CORS'));
  },
}));

let supabase;
try {
  supabase = getSupabaseClient();
} catch (error) {
  console.error(error.message);
  process.exit(1);
}

// Signature verification must receive the exact raw body before the JSON parser.
const whatsappWebhook = createWhatsAppWebhook(supabase);
app.get('/api/webhooks/whatsapp', whatsappWebhook.verify);
app.post('/api/webhooks/whatsapp', express.raw({ type: 'application/json', limit: '1mb' }), whatsappWebhook.receive);
app.use(express.json());

const tableName = 'products';
const customerAccess = createCustomerAccess(supabase);

function getBearerToken(req) {
  const authHeader = req.get('authorization') || '';
  const [type, token] = authHeader.split(' ');
  if (type !== 'Bearer' || !token) {
    return null;
  }
  return token;
}

async function getUserWithRole(req) {
  const token = getBearerToken(req);
  if (!token) {
    return { error: 'Authentication required', status: 401 };
  }

  if (token.startsWith('shop_')) return customerAccess.authenticate(token);

  const { data: userData, error: userError } = await supabase.auth.getUser(token);
  if (userError || !userData.user) {
    return { error: 'Invalid or expired session', status: 401 };
  }

  const { data: profile, error: profileError } = await supabase
    .from('profiles')
    .select('role')
    .eq('id', userData.user.id)
    .single();

  if (profileError || !profile) {
    return { error: 'User profile not found', status: 403 };
  }

  return {
    user: userData.user,
    role: profile.role || 'user',
  };
}

async function requireAuthenticatedUser(req, res, next) {
  const result = await getUserWithRole(req);
  if (result.error) {
    return res.status(result.status).json({ error: result.error });
  }

  req.user = result.user;
  req.userRole = result.role;
  req.authType = result.authType || 'email';
  return next();
}

async function requireAdmin(req, res, next) {
  const result = await getUserWithRole(req);
  if (result.error) {
    return res.status(result.status).json({ error: result.error });
  }

  if (result.role !== 'admin') {
    return res.status(403).json({ error: 'Admin access is required' });
  }

  req.user = result.user;
  req.userRole = result.role;
  return next();
}

app.get('/api/config', (_req, res) => {
  if (!supabaseUrl || !supabaseAnonKey) {
    return res.status(500).json({ error: 'SUPABASE_URL and SUPABASE_ANON_KEY must be set' });
  }

  return res.json({
    supabaseUrl,
    supabaseAnonKey,
  });
});

app.get('/api/me', requireAuthenticatedUser, (req, res) => {
  return res.json({
    id: req.user.id,
    email: req.user.email,
    role: req.userRole,
  });
});

app.post('/api/access/request', customerAccess.rateLimit, customerAccess.request);
app.post('/api/access/login', customerAccess.rateLimit, customerAccess.login);
app.post('/api/access/logout', customerAccess.logout);
app.get('/api/admin/access', requireAdmin, customerAccess.list);
app.patch('/api/admin/access/:id', requireAdmin, customerAccess.decide);

app.post('/api/orders', requireAuthenticatedUser, createOrderHandler(supabase));

app.get('/api/products', requireAuthenticatedUser, async (req, res) => {
  let query = supabase.from(tableName).select('*');
  if (req.userRole !== 'admin') query = query.eq('visible', true);
  const { data, error } = await query
    .order('created_at', { ascending: false });

  if (error) {
    return res.status(500).json({ error: error.message });
  }

  return res.json(data);
});

app.get('/api/products/:id', requireAuthenticatedUser, async (req, res) => {
  const { id } = req.params;
  const { data, error } = await supabase
    .from(tableName)
    .select('*')
    .eq('id', id)
    .single();

  if (!error && data?.visible === false && req.userRole !== 'admin') return res.status(404).json({ error: 'Product not found' });
  if (error) {
    const status = error.code === 'PGRST116' ? 404 : 500;
    return res.status(status).json({ error: error.message });
  }

  return res.json(data);
});

app.post('/api/products', requireAdmin, async (req, res) => {
  let product;
  try { product = validateProduct(req.body); } catch (error) { return res.status(400).json({ error: error.message }); }

  const { data, error } = await supabase
    .from(tableName)
    .insert(product)
    .select('*')
    .single();

  if (error) {
    return res.status(500).json({ error: error.message });
  }

  return res.status(201).json(data);
});

app.put('/api/products/:id', requireAdmin, async (req, res) => {
  const { id } = req.params;
  let product;
  try { product = validateProduct(req.body); } catch (error) { return res.status(400).json({ error: error.message }); }

  const { data, error } = await supabase
    .from(tableName)
    .update(product)
    .eq('id', id)
    .select('*')
    .single();

  if (error) {
    const status = error.code === 'PGRST116' ? 404 : 500;
    return res.status(status).json({ error: error.message });
  }

  return res.json(data);
});

app.delete('/api/products/:id', requireAdmin, async (req, res) => {
  const { id } = req.params;

  const { error } = await supabase
    .from(tableName)
    .delete()
    .eq('id', id);

  if (error) {
    return res.status(500).json({ error: error.message });
  }

  return res.status(204).send();
});

app.get('/api/admin/orders', requireAdmin, async (req, res) => {
  const page = Math.max(0, Number.parseInt(req.query.page, 10) || 0);
  const { data, error } = await supabase.from('orders').select('*').order('created_at', { ascending: false }).range(page * 50, page * 50 + 49);
  return error ? res.status(503).json({ error: 'Could not load orders' }) : res.json(data);
});
app.patch('/api/admin/orders/:id', requireAdmin, async (req, res) => {
  if (!['new','confirmed','dispatched','completed','cancelled'].includes(req.body.status)) return res.status(400).json({ error: 'Invalid status' });
  const { data, error } = await supabase.from('orders').update({ status: req.body.status }).eq('id', req.params.id).select('*').single();
  return error ? res.status(503).json({ error: 'Could not update order' }) : res.json(data);
});

app.get('/api/health', (_req, res) => res.json({ ok: true, service: 'cadeau-api' }));

app.get('/', (_req, res) => {
  res.json({ ok: true, service: 'cadeau-api' });
});

app.listen(port, () => {
  console.log(`Server running on http://localhost:${port}`);
});
