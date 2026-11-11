const { imageShareLink } = require('./order-share-link');
const { productShareUrl } = require('./product-share');
const { getNotificationConfig } = require('./notifications');
const { NotificationConfigError } = require('./notification-config-error');

function getCheckoutConfig(env = process.env) {
  const mode = (env.ORDER_CHECKOUT_MODE || 'api').trim().toLowerCase();
  if (mode === 'api') return getNotificationConfig(env);
  if (!['whatsapp_link','whatsapp_share'].includes(mode)) throw new NotificationConfigError(['ORDER_CHECKOUT_MODE']);
  const recipient = (env.WHATSAPP_RECIPIENT_NUMBER || '').trim();
  if (!/^[1-9]\d{6,14}$/.test(recipient)) throw new NotificationConfigError(['WHATSAPP_RECIPIENT_NUMBER']);
  const shareEnv = { ORDER_SHARE_SECRET: env.ORDER_SHARE_SECRET || env.SUPABASE_SERVICE_ROLE_KEY, PUBLIC_API_URL: env.PUBLIC_API_URL };
  if (mode === 'whatsapp_share' && !shareEnv.ORDER_SHARE_SECRET) throw new NotificationConfigError(['ORDER_SHARE_SECRET or SUPABASE_SERVICE_ROLE_KEY']);
  return { provider: mode, recipient, shareEnv };
}

function orderLink(order, recipient) {
  const items = order.items?.length ? order.items : [order];
  const lines = items.map(item => {
    const link = productShareUrl(item.product_id || order.product_id);
    return [item.product_name, item.color, item.size].filter(Boolean).join(' / ') + ' x ' + item.quantity + (link ? '\nProduct: ' + link : '');
  });
  const message = ['Cadeau order ' + order.id, ...lines,
    'Name: ' + order.customer_name, 'Phone: ' + order.customer_phone,
    'Delivery address: ' + order.delivery_address, 'Notes: ' + (order.notes || 'None')].join('\n');
  return 'https://wa.me/' + recipient + '?text=' + encodeURIComponent(message);
}
function confirmationLink(order, recipient, imageLink) {
  const message = 'Hello, I am ' + order.customer_name + '. I just placed an order on Cadeau.\nOrder reference: ' + order.id + '\nPhone: ' + order.customer_phone + (imageLink ? '\nView order image: ' + imageLink : '');
  return 'https://wa.me/' + recipient + '?text=' + encodeURIComponent(message);
}
module.exports = { getCheckoutConfig, orderLink, confirmationLink, imageShareLink };
