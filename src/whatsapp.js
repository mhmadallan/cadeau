const { NotificationConfigError } = require('./notification-config-error');

function getWhatsAppConfig(env = process.env) {
  const read = (key) => (env[key] || '').trim();
  const config = {
    token: read('WHATSAPP_ACCESS_TOKEN'),
    phoneId: read('WHATSAPP_PHONE_NUMBER_ID'),
    recipient: read('WHATSAPP_RECIPIENT_NUMBER'),
    version: read('WHATSAPP_API_VERSION'),
    template: read('WHATSAPP_TEMPLATE_NAME'),
    language: read('WHATSAPP_TEMPLATE_LANGUAGE') || 'en_US',
  };
  const invalid = [];
  if (!config.token) invalid.push('WHATSAPP_ACCESS_TOKEN');
  if (!/^\d+$/.test(config.phoneId)) invalid.push('WHATSAPP_PHONE_NUMBER_ID');
  if (!/^[1-9]\d{6,14}$/.test(config.recipient)) invalid.push('WHATSAPP_RECIPIENT_NUMBER');
  if (!/^v\d+\.\d+$/.test(config.version)) invalid.push('WHATSAPP_API_VERSION');
  if (!config.template) invalid.push('WHATSAPP_TEMPLATE_NAME');
  config.imageTemplate = (env.WHATSAPP_IMAGE_TEMPLATE_NAME || '').trim();
  config.headerType = (env.WHATSAPP_TEMPLATE_HEADER || 'none').trim().toLowerCase();
  if (!['none', 'image'].includes(config.headerType)) invalid.push('WHATSAPP_TEMPLATE_HEADER');
  if (invalid.length) throw new NotificationConfigError(invalid);
  return config;
}

function getImageLink(value) {
  try {
    const url = new URL(value);
    if (url.protocol !== 'https:' || url.username || url.password) return null;
    return url.href;
  } catch { return null; }
}

async function sendOrderNotification(order, config, fetchImpl = fetch) {
  const values = [
    order.id, order.product_name, String(order.quantity),
    `$${Number(order.unit_price).toFixed(2)}`, `$${Number(order.total).toFixed(2)}`,
    order.customer_name, order.customer_phone, order.delivery_address,
    order.notes || 'None',
  ];
  const imageRequired = config.headerType === 'image';
  const imageLink = (imageRequired || config.imageTemplate) ? getImageLink(order.product_image_url) : null;
  if (imageRequired && !imageLink) throw new Error('A valid HTTPS product image is required for this WhatsApp template');
  const components = [{
    type: 'body',
    parameters: values.map((value) => ({
      type: 'text', text: String(value).replace(/\s+/g, ' ').trim(),
    })),
  }];
  if (imageLink) components.unshift({
    type: 'header', parameters: [{ type: 'image', image: { link: imageLink } }],
  });
  const response = await fetchImpl(
    `https://graph.facebook.com/${config.version}/${config.phoneId}/messages`,
    {
      method: 'POST',
      headers: { Authorization: `Bearer ${config.token}`, 'Content-Type': 'application/json' },
      signal: AbortSignal.timeout(15000),
      body: JSON.stringify({
        messaging_product: 'whatsapp',
        to: config.recipient,
        type: 'template',
        template: {
          name: imageLink && !imageRequired ? config.imageTemplate : config.template,
          language: { code: config.language },
          components,
        },
      }),
    },
  );
  const data = await response.json();
  if (!response.ok || !data.messages?.[0]?.id) {
    // Do not log Meta response bodies: they may contain customer details.
    const error = new Error(`WhatsApp request failed (HTTP ${response.status})`);
    error.httpStatus = response.status;
    error.providerCode = Number.isInteger(data.error?.code) ? data.error.code : null;
    error.providerSubcode = Number.isInteger(data.error?.error_subcode) ? data.error.error_subcode : null;
    throw error;
  }
  return data.messages[0].id;
}

module.exports = { getWhatsAppConfig, sendOrderNotification, getImageLink };
