const { getImageLink } = require('./whatsapp');
const uuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const escape = value => String(value).replace(/[&<>"']/g, char => ({ '&':'&amp;', '<':'&lt;', '>':'&gt;', '"':'&quot;', "'":'&#39;' }[char]));
function productShareUrl(id, env = process.env) {
  if (!uuid.test(id)) return null;
  const base = getImageLink(env.PUBLIC_API_URL || 'https://cadeau-hbmt.onrender.com');
  if (!base) throw new Error('PUBLIC_API_URL must be an HTTPS URL');
  return new URL('/p/' + id, base).href;
}
function createProductShare(supabase, env = process.env) {
  return async (req, res) => {
    if (!uuid.test(req.params.id)) return res.status(404).send('Product not found');
    const {data, error} = await supabase.from('products').select('id,name,image_url,visible').eq('id',req.params.id).maybeSingle();
    if (error) return res.status(503).send('Please try again later');
    if (!data || data.visible === false) return res.status(404).send('Product not found');
    const image = getImageLink(data.image_url);
    const store = getImageLink(env.STOREFRONT_URL || 'https://mhmadallan.github.io/cadeau/index.html');
    if (!store) return res.status(503).send('Store link unavailable');
    const target = new URL(store); target.hash = 'product-' + data.id;
    res.set('Cache-Control','no-store');
    res.set('X-Robots-Tag','noindex');
    res.type('html').send('<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>' + escape(data.name) + ' | Cadeau</title><meta property="og:type" content="website"><meta property="og:site_name" content="Cadeau"><meta property="og:title" content="' + escape(data.name) + '"><meta property="og:description" content="View this product in the Cadeau collection."><meta property="og:url" content="' + escape(productShareUrl(data.id,env)) + '">' + (image ? '<meta property="og:image" content="' + escape(image) + '"><meta property="og:image:alt" content="' + escape(data.name) + '">' : '') + '</head><body style="font-family:system-ui;max-width:480px;margin:40px auto;padding:20px;text-align:center"><h1>' + escape(data.name) + '</h1>' + (image ? '<img style="max-width:100%;max-height:60vh" src="' + escape(image) + '" alt="' + escape(data.name) + '">' : '') + '<p><a href="' + escape(target.href) + '">View in the Cadeau collection</a></p></body></html>');
  };
}
module.exports = { productShareUrl, createProductShare };
