const { NotificationConfigError } = require('./notification-config-error');

function getTelegramConfig(env = process.env) {
  const token = (env.TELEGRAM_BOT_TOKEN || '').trim();
  const chatId = (env.TELEGRAM_CHAT_ID || '').trim();
  const invalid = [];
  if (!/^\d+:[A-Za-z0-9_-]+$/.test(token)) invalid.push('TELEGRAM_BOT_TOKEN');
  if (!/^-?[1-9]\d*$/.test(chatId)) invalid.push('TELEGRAM_CHAT_ID');
  if (invalid.length) throw new NotificationConfigError(invalid);
  return { token, chatId };
}

function formatOrder(order) {
  return [
    `New Cadeau order: ${order.id}`,
    `Product: ${String(order.product_name).slice(0, 500)}`,
    `Quantity: ${order.quantity}`,
    `Unit price: $${Number(order.unit_price).toFixed(2)}`,
    `Total: $${Number(order.total).toFixed(2)}`,
    `Customer: ${order.customer_name}`,
    `Phone: ${order.customer_phone}`,
    `Delivery address: ${order.delivery_address}`,
    `Notes: ${order.notes || 'None'}`,
    'Please contact the customer to arrange payment and delivery.',
  ].join('\n');
}

async function telegramRequest(method, payload, config, fetchImpl) {
  let response;
  let data;
  try {
    response = await fetchImpl(`https://api.telegram.org/bot${config.token}/${method}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      signal: AbortSignal.timeout(15000),
      body: JSON.stringify({ chat_id: config.chatId, ...payload }),
    });
    data = await response.json();
  } catch {
    // Telegram embeds the secret token in the URL. Never propagate raw fetch errors.
    throw new Error('Telegram request could not be confirmed');
  }
  if (!response.ok || !data.ok || !Number.isInteger(data.result?.message_id)) {
    const error = new Error('Telegram rejected the notification');
    error.httpStatus = response.status;
    error.providerCode = Number.isInteger(data.error_code) ? data.error_code : null;
    throw error;
  }
  return String(data.result.message_id);
}

async function sendTelegramOrder(order, config, fetchImpl = fetch) {
  const text = formatOrder(order);
  let photo;
  try {
    const url = new URL(order.product_image_url);
    if (url.protocol === 'https:' && !url.username && !url.password) photo = url.href;
  } catch { /* Products without an image retain text notifications. */ }
  if (photo) {
    const fitsCaption = text.length <= 1024;
    const id = await telegramRequest('sendPhoto', {
      photo, caption: fitsCaption ? text : `Cadeau order: ${order.id}`,
    }, config, fetchImpl);
    if (!fitsCaption) {
      // Preserve all order details when they exceed Telegram's photo caption limit.
      await telegramRequest('sendMessage', {
        text, reply_parameters: { message_id: Number(id) },
        link_preview_options: { is_disabled: true },
      }, config, fetchImpl);
    }
    return id;
  }
  return telegramRequest('sendMessage', {
    text, link_preview_options: { is_disabled: true },
  }, config, fetchImpl);
}

module.exports = { getTelegramConfig, formatOrder, sendTelegramOrder };
