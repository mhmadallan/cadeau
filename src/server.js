const express = require('express');
const cors = require('cors');
const path = require('path');
require('dotenv').config();

const { getSupabaseClient } = require('./supabase');

const app = express();
const port = Number(process.env.PORT || 4000);
const adminKey = process.env.ADMIN_KEY;

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

function requireAdmin(req, res, next) {
  if (!adminKey) {
    return res.status(500).json({ error: 'ADMIN_KEY is not configured on the server' });
  }

  const providedKey = req.get('x-admin-key');
  if (!providedKey || providedKey !== adminKey) {
    return res.status(401).json({ error: 'Admin access is required' });
  }

  return next();
}

app.post('/api/admin/verify', (req, res) => {
  if (!adminKey) {
    return res.status(500).json({ error: 'ADMIN_KEY is not configured on the server' });
  }

  const { adminKey: keyFromBody } = req.body || {};
  if (!keyFromBody || keyFromBody !== adminKey) {
    return res.status(401).json({ error: 'Invalid admin key' });
  }

  return res.json({ ok: true });
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
