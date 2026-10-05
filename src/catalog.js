function validateProduct(body) {
  if (!body || typeof body.name !== 'string' || !body.name.trim() || body.name.length > 200 || !Number.isFinite(Number(body.price)) || Number(body.price) < 0 || Number(body.price) > 99999999) throw new Error('Provide a name and a valid price.');
  const url = value => { if (!value) return ''; const u = new URL(value); if (!['https:', 'http:'].includes(u.protocol)) throw new Error('Use HTTP image URLs.'); return u.href; };
  const variants = body.variants || [];
  if (!Array.isArray(variants) || variants.length > 100) throw new Error('Maximum 100 variants.');
  const ids = new Set(), combinations = new Set();
  const clean = variants.map(v => {
    if (!v.id || typeof v.id !== 'string' || v.id.length > 100 || typeof v.color !== 'string' || !v.color.trim() || v.color.length > 60 || typeof v.size !== 'string' || !v.size.trim() || v.size.length > 30 || !Number.isInteger(v.stock) || v.stock < 0 || ids.has(v.id) || combinations.has(v.color.trim() + ':' + v.size.trim())) throw new Error('Each variant needs a unique color/size, ID and whole stock quantity.');
    ids.add(v.id); combinations.add(v.color.trim() + ':' + v.size.trim());
    return { id: v.id, color: v.color.trim(), size: v.size.trim(), stock: v.stock };
  });
  if (!Number.isInteger(Number(body.stock || 0)) || Number(body.stock || 0) < 0) throw new Error('Stock must be a positive whole number.');
  if (!Array.isArray(body.images || []) || (body.images || []).length > 12) throw new Error('Maximum 12 gallery images.');
  return { name: body.name.trim(), description: String(body.description || '').slice(0, 10000), price: Number(body.price), image_url: url(body.image_url) || null, images: (body.images || []).map(url), stock: clean.length ? clean.reduce((n,v) => n + v.stock, 0) : Number(body.stock || 0), variants: clean, collection: String(body.collection || '').trim().slice(0, 100), visible: body.visible !== false, featured: body.featured === true, new_arrival: body.new_arrival === true };
}
module.exports = { validateProduct };
