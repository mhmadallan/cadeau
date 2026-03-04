const express = require('express');
const cors = require('cors');
const path = require('path');
require('dotenv').config();

const { getSupabaseClient } = require('./supabase');

const app = express();
const port = Number(process.env.PORT || 4000);
const supabaseUrl = process.env.SUPABASE_URL;
const supabaseAnonKey = process.env.SUPABASE_ANON_KEY;

app.use(cors());
app.use(express.json());
app.use(express.static(path.join(__dirname, '..', 'public')));

let supabase;
try {
  supabase = getSupabaseClient();
} catch (error) {
  console.error(error.message);
  process.exit(1);
}

const tableName = 'products';

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

app.get('/api/products', async (_req, res) => {
  const { data, error } = await supabase
    .from(tableName)
    .select('*')
    .order('created_at', { ascending: false });

  if (error) {
    return res.status(500).json({ error: error.message });
  }

  return res.json(data);
});

app.get('/api/products/:id', async (req, res) => {
  const { id } = req.params;
  const { data, error } = await supabase
    .from(tableName)
    .select('*')
    .eq('id', id)
    .single();

  if (error) {
    const status = error.code === 'PGRST116' ? 404 : 500;
    return res.status(status).json({ error: error.message });
  }

  return res.json(data);
});

app.post('/api/products', requireAdmin, async (req, res) => {
  const { name, description, price, image_url, stock } = req.body;

  if (!name || price === undefined || price === null) {
    return res.status(400).json({ error: 'name and price are required' });
  }

  const { data, error } = await supabase
    .from(tableName)
    .insert({
      name,
      description: description || null,
      price: Number(price),
      image_url: image_url || null,
      stock: Number.isFinite(Number(stock)) ? Number(stock) : 0,
    })
    .select('*')
    .single();

  if (error) {
    return res.status(500).json({ error: error.message });
  }

  return res.status(201).json(data);
});

app.put('/api/products/:id', requireAdmin, async (req, res) => {
  const { id } = req.params;
  const { name, description, price, image_url, stock } = req.body;

  if (!name || price === undefined || price === null) {
    return res.status(400).json({ error: 'name and price are required' });
  }

  const { data, error } = await supabase
    .from(tableName)
    .update({
      name,
      description: description || null,
      price: Number(price),
      image_url: image_url || null,
      stock: Number.isFinite(Number(stock)) ? Number(stock) : 0,
    })
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

app.get('/{*splat}', (_req, res) => {
  res.sendFile(path.join(__dirname, '..', 'public', 'index.html'));
});

app.listen(port, () => {
  console.log(`Server running on http://localhost:${port}`);
});
