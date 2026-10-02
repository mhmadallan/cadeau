const { getWhatsAppConfig, sendOrderNotification } = require('./whatsapp');
const { getTelegramConfig, sendTelegramOrder } = require('./telegram');
const { NotificationConfigError } = require('./notification-config-error');

function getNotificationConfig(env = process.env) {
  const provider = (env.ORDER_NOTIFICATION_PROVIDER || 'whatsapp').trim().toLowerCase();
  if (provider === 'whatsapp') return { ...getWhatsAppConfig(env), provider };
  if (provider === 'telegram') return { ...getTelegramConfig(env), provider };
  throw new NotificationConfigError(['ORDER_NOTIFICATION_PROVIDER']);
}

function notifyOrder(order, config, fetchImpl = fetch) {
  if (config.provider === 'telegram') return sendTelegramOrder(order, config, fetchImpl);
  if (config.provider === 'whatsapp') return sendOrderNotification(order, config, fetchImpl);
  throw new Error('Unsupported notification provider');
}

module.exports = { getNotificationConfig, notifyOrder };
