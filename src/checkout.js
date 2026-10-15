const { getImageLink } = require('./whatsapp');
const { getNotificationConfig } = require('./notifications');
const { NotificationConfigError } = require('./notification-config-error');

function getCheckoutConfig(env = process.env) {
  const mode = (env.ORDER_CHECKOUT_MODE || 'api').trim().toLowerCase();
  if (mode === 'api') return getNotificationConfig(env);
  if (mode !== 'whatsapp_link') throw new NotificationConfigError(['ORDER_CHECKOUT_MODE']);
  const recipient = (env.WHATSAPP_RECIPIENT_NUMBER || '').trim();
  if (!/^[1-9]\d{6,14}$/.test(recipient)) throw new NotificationConfigError(['WHATSAPP_RECIPIENT_NUMBER']);
  return { provider: 'whatsapp_link', recipient };
}

function orderLink(order, recipient) {
  const items = order.items?.length ? order.items : [order];
  const lines = items.map(item => {
    const image = getImageLink(item.image_url || item.product_image_url);
    return [item.product_name, item.color, item.size].filter(Boolean).join(' / ') + ' x ' + item.quantity + (image ? '\nProduct image: ' + image : '');
  });
  const message = ['Cadeau order ' + order.id, ...lines,
    'Name: ' + order.customer_name, 'Phone: ' + order.customer_phone,
    'Delivery address: ' + order.delivery_address, 'Notes: ' + (order.notes || 'None')].join('\n');
  return 'https://wa.me/' + recipient + '?text=' + encodeURIComponent(message);
}
module.exports = { getCheckoutConfig, orderLink };
