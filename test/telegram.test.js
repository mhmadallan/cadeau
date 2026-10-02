const test = require('node:test');
const assert = require('node:assert/strict');
const { getTelegramConfig, sendTelegramOrder, formatOrder } = require('../src/telegram');
const { getNotificationConfig, notifyOrder } = require('../src/notifications');
const order = { id: 'order-1', product_name: '<Gift>', quantity: 2, unit_price: 12.5, total: 25, customer_name: 'Alex', customer_phone: '+12025550123', delivery_address: 'Example Street\nBerlin', notes: '' };
const env = { ORDER_NOTIFICATION_PROVIDER: 'telegram', TELEGRAM_BOT_TOKEN: '123:secret_token', TELEGRAM_CHAT_ID: '456' };

test('Telegram configuration works without WhatsApp settings and validates the target', () => {
  assert.equal(getNotificationConfig(env).provider, 'telegram');
  assert.equal(getTelegramConfig({ ...env, TELEGRAM_CHAT_ID: '-100123' }).chatId, '-100123');
  for (const patch of [{ TELEGRAM_BOT_TOKEN: '' }, { TELEGRAM_BOT_TOKEN: '123:bad/path' }, { TELEGRAM_CHAT_ID: '' }, { TELEGRAM_CHAT_ID: '@someone' }]) {
    assert.throws(() => getTelegramConfig({ ...env, ...patch }));
  }
  assert.throws(() => getNotificationConfig({ ...env, ORDER_NOTIFICATION_PROVIDER: 'typo' }));
});

test('Telegram sends the complete order as plain text to the server-configured chat', async () => {
  const id = await notifyOrder(order, getNotificationConfig(env), async (url, options) => {
    assert.equal(url, 'https://api.telegram.org/bot123:secret_token/sendMessage');
    const body = JSON.parse(options.body);
    assert.equal(body.chat_id, '456');
    assert.equal(body.parse_mode, undefined);
    for (const value of ['order-1', '<Gift>', 'Quantity: 2', '$12.50', '$25.00', 'Alex', '+12025550123', 'Example Street\nBerlin', 'Notes: None']) assert.ok(body.text.includes(value));
    return { ok: true, json: async () => ({ ok: true, result: { message_id: 42 } }) };
  });
  assert.equal(id, '42');
  assert.ok(formatOrder({ ...order, product_name: 'x'.repeat(10000) }).length < 4096);
});

test('Telegram errors and timeouts do not expose the bot token or request URL', async () => {
  await assert.rejects(sendTelegramOrder(order, getTelegramConfig(env), async () => { throw new Error('https://api.telegram.org/bot123:secret_token/sendMessage'); }), (error) => !error.message.includes('secret_token'));
  await assert.rejects(sendTelegramOrder(order, getTelegramConfig(env), async () => ({ ok: false, status: 403, json: async () => ({ ok: false, error_code: 403, description: 'private detail' }) })), (error) => error.providerCode === 403 && !error.message.includes('private detail'));
  await assert.rejects(sendTelegramOrder(order, getTelegramConfig(env), async () => ({ ok: true, json: async () => ({ ok: true, result: {} }) })));
});

test('WhatsApp remains selectable with its original credentials', () => {
  const config = getNotificationConfig({ WHATSAPP_ACCESS_TOKEN: 'secret', WHATSAPP_PHONE_NUMBER_ID: '123', WHATSAPP_RECIPIENT_NUMBER: '491234567890', WHATSAPP_API_VERSION: 'v25.0', WHATSAPP_TEMPLATE_NAME: 'order' });
  assert.equal(config.provider, 'whatsapp');
});

test('Telegram photo contains the full order caption', async () => {
  const id = await sendTelegramOrder({ ...order, product_image_url: 'https://example.com/gift.jpg' }, getTelegramConfig(env), async (url, options) => {
    assert.ok(url.endsWith('/sendPhoto'));
    const body = JSON.parse(options.body);
    assert.equal(body.photo, 'https://example.com/gift.jpg');
    assert.equal(body.caption, formatOrder(order));
    assert.equal(body.parse_mode, undefined);
    return { ok: true, json: async () => ({ ok: true, result: { message_id: 43 } }) };
  });
  assert.equal(id, '43');
});

test('long order details follow the photo without truncation', async () => {
  const longOrder = { ...order, product_image_url: 'https://example.com/gift.jpg', product_name: 'a'.repeat(500), notes: 'n'.repeat(300), delivery_address: 'd'.repeat(300) };
  const calls = [];
  await sendTelegramOrder(longOrder, getTelegramConfig(env), async (url, options) => {
    calls.push({ url, body: JSON.parse(options.body) });
    return { ok: true, json: async () => ({ ok: true, result: { message_id: 44 } }) };
  });
  assert.equal(calls.length, 2);
  assert.ok(calls[0].body.caption.length <= 1024);
  assert.equal(calls[1].body.text, formatOrder(longOrder));
  assert.equal(calls[1].body.reply_parameters.message_id, 44);
});
