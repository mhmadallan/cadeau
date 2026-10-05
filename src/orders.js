const { getNotificationConfig, notifyOrder } = require('./notifications');
const { getImageLink } = require('./whatsapp');
const { NotificationConfigError } = require('./notification-config-error');

const uuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

function validateOrder(body) {
  if (body?.items) {
    if (!uuid.test(body.request_id) || !Array.isArray(body.items) || !body.items.length || body.items.length > 30) throw new Error('Choose between 1 and 30 items.');
    const seen = new Set();
    for (const item of body.items) {
      if (!uuid.test(item.product_id) || typeof item.variant_id !== 'string' || item.variant_id.length > 100 || !Number.isInteger(item.quantity) || item.quantity < 1 || item.quantity > 99 || seen.has(item.product_id + ':' + item.variant_id)) throw new Error('Invalid cart item.');
      seen.add(item.product_id + ':' + item.variant_id);
    }
    const details = validateOrder({ ...body, items: undefined, product_id: body.items[0].product_id, quantity: 1 });
    delete details.product_id; delete details.quantity;
    return { ...details, items: body.items.map(({ product_id, variant_id, quantity }) => ({ product_id, variant_id, quantity })) };
  }
  if (!body || !uuid.test(body.product_id) || !uuid.test(body.request_id)
    || !Number.isInteger(body.quantity) || body.quantity < 1 || body.quantity > 99) {
    throw new Error('Choose a product and a quantity between 1 and 99.');
  }
  const result = { product_id: body.product_id, request_id: body.request_id, quantity: body.quantity };
  for (const [key, max] of Object.entries({ customer_name: 100, customer_phone: 30, delivery_address: 300, notes: 300 })) {
    const value = body[key] ?? '';
    if (typeof value !== 'string' || value.trim().length > max || (key !== 'notes' && !value.trim())) {
      throw new Error(`Please provide a valid ${key.replaceAll('_', ' ')} (maximum ${max} characters).`);
    }
    result[key] = value.trim();
  }
  if (!/^\+?[\d ()-]{7,30}$/.test(result.customer_phone)
    || result.customer_phone.replace(/\D/g, '').length < 7) {
    throw new Error('Please enter a valid phone number including country code.');
  }
  return result;
}

function createOrderHandler(supabase, { getConfig = getNotificationConfig, notify = notifyOrder } = {}) {
  return async (req, res) => {
    let payload;
    try { payload = validateOrder(req.body); }
    catch (error) { return res.status(400).json({ error: error.message }); }

    // Look up retries before checking configuration, so an already saved order stays accessible.
    const existing = await supabase.from('orders').select('*')
      .eq(req.authType === 'phone' ? 'customer_id' : 'user_id', req.user.id).eq('request_id', payload.request_id).maybeSingle();
    if (existing.error) return res.status(503).json({ error: 'Ordering is unavailable. Please try again later.' });
    const summary = (order) => ({ id: order.id, total: order.total, notification_status: order.notification_status });
    if (existing.data) return res.json(summary(existing.data));

    let config;
    try { config = getConfig(); }
    catch (error) {
      console.error('Order notification configuration failed:', error instanceof NotificationConfigError ? error.message : 'Unexpected configuration error');
      return res.status(503).json({ error: 'Ordering is not configured yet. Please contact the store.' });
    }

    // Fail before reserving stock when Telegram's database migration is missing.
    if (config.provider === 'telegram') {
      const readiness = await supabase.from('orders').select('notification_provider,notification_message_id').limit(0);
      if (readiness.error) return res.status(503).json({ error: 'Ordering setup is incomplete. Please contact the store.' });
    }

    let requiredImage = null;
    if (config.provider === 'whatsapp' && config.headerType === 'image') {
      const product = await supabase.from('products').select('image_url').eq('id', (payload.product_id || payload.items?.[0].product_id)).maybeSingle();
      if (product.error) return res.status(503).json({ error: 'Could not check the product image. Please try again later.' });
      if (!product.data) return res.status(409).json({ error: 'This product is no longer available.' });
      requiredImage = getImageLink(product.data.image_url);
      if (!requiredImage) return res.status(409).json({ error: 'This product needs an image before it can be ordered. Please contact the store.' });
    }

    const { data, error } = await supabase.rpc(payload.items ? 'place_cart_order' : (req.authType === 'phone' ? 'place_customer_order' : 'place_order'), {
      ...(payload.items ? { p_user_id: null, p_customer_id: null } : {}),
      [req.authType === 'phone' ? 'p_customer_id' : 'p_user_id']: req.user.id,
      ...Object.fromEntries(Object.entries(payload).map(([key, value]) => [`p_${key}`, value])),
    });
    if (error) {
      const known = { OUT_OF_STOCK: 'Not enough stock remains for this order.', PRODUCT_NOT_FOUND: 'This product is no longer available.', ORDER_LIMIT: 'Please wait a minute before placing another order.' };
      return res.status(known[error.message] ? 409 : 503).json({ error: known[error.message] || 'Could not save the order. Retry using the same form.' });
    }
    const order = data.order;
    if (!data.created) return res.json(summary(order));

    if (config.provider === 'telegram') {
      const tracking = await supabase.from('orders').update({ notification_provider: 'telegram' }).eq('id', order.id);
      if (tracking.error) {
        console.error(`Could not record notification channel for order ${order.id}`);
        return res.status(201).json(summary(order));
      }
    }

    let status = 'unknown';
    let messageId = null;
    try {
      let notificationOrder = requiredImage ? { ...order, product_image_url: requiredImage } : order;
      if (!requiredImage && (config.provider === 'telegram' || (config.provider === 'whatsapp' && config.imageTemplate)) && order.product_id) {
        // Resolve images server-side, never from customer-provided order fields.
        // The image is the product's current image at notification time.
        const product = await supabase.from('products').select('image_url').eq('id', order.product_id).maybeSingle();
        if (!product.error && product.data?.image_url) {
          notificationOrder = { ...order, product_image_url: product.data.image_url };
        }
      }
      messageId = await notify(notificationOrder, config);
      status = 'accepted';
    } catch (error) {
      // Keep actionable diagnostics without tokens, customer details, or provider response bodies.
      console.error('Order notification could not be confirmed', {
        provider: config.provider || 'whatsapp',
        orderId: order.id,
        errorType: error.name,
        httpStatus: error.httpStatus,
        providerCode: error.providerCode,
        providerSubcode: error.providerSubcode,
      });
    }
    // An API acceptance is not a delivery receipt. Never automatically resend uncertain requests.
    const notificationUpdate = config.provider === 'telegram'
      ? { notification_status: status, notification_provider: 'telegram', notification_message_id: messageId }
      : { notification_status: status, whatsapp_message_id: messageId };
    const saved = await supabase.from('orders').update(notificationUpdate).eq('id', order.id);
    if (saved.error) console.error(`Could not save notification status for order ${order.id}`);
    return res.status(201).json(summary({ ...order, notification_status: status }));
  };
}

module.exports = { validateOrder, createOrderHandler };
