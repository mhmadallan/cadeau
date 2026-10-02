const test = require('node:test');
const assert = require('node:assert/strict');
const { validateOrder, createOrderHandler } = require('../src/orders');
const { getWhatsAppConfig, sendOrderNotification } = require('../src/whatsapp');

const payload = {
  product_id: '11111111-1111-4111-8111-111111111111',
  request_id: '22222222-2222-4222-8222-222222222222',
  quantity: 2, customer_name: ' Customer ', customer_phone: '+491234567890',
  delivery_address: 'Test street 1\nBerlin', notes: '',
};
const order = { ...payload, id: 'order-123', product_name: 'Gift', unit_price: 12.5, total: 25, notification_status: 'pending' };
const config = { token: 'test-token', phoneId: '123', recipient: '491234567890', version: 'v99.0', template: 'order_notice', language: 'en_US' };

test('validates customer input and ignores client-supplied totals', () => {
  const result = validateOrder({ ...payload, total: 0.01 });
  assert.equal(result.customer_name, 'Customer');
  assert.equal(result.total, undefined);
  for (const quantity of [0, -1, 1.5, 100, '2', null]) {
    assert.throws(() => validateOrder({ ...payload, quantity }));
  }
  for (const invalid of [{ product_id: '../x' }, { request_id: 'bad' }, { customer_name: ' ' }, { delivery_address: 'x'.repeat(301) }, { customer_phone: 'abcdefg' }]) {
    assert.throws(() => validateOrder({ ...payload, ...invalid }));
  }
});

test('requires complete server-side configuration', () => {
  assert.throws(() => getWhatsAppConfig({}));
  const env = { WHATSAPP_ACCESS_TOKEN: 'secret', WHATSAPP_PHONE_NUMBER_ID: '123', WHATSAPP_RECIPIENT_NUMBER: '491234567890', WHATSAPP_API_VERSION: 'v99.0', WHATSAPP_TEMPLATE_NAME: 'order' };
  assert.equal(getWhatsAppConfig(env).language, 'en_US');
  assert.throws(() => getWhatsAppConfig({ ...env, WHATSAPP_PHONE_NUMBER_ID: '../messages' }));
});

test('sends the configured recipient all nine template parameters', async () => {
  const messageId = await sendOrderNotification(order, config, async (url, options) => {
    assert.equal(url, 'https://graph.facebook.com/v99.0/123/messages');
    assert.equal(options.headers.Authorization, 'Bearer test-token');
    const body = JSON.parse(options.body);
    assert.equal(body.to, config.recipient);
    assert.equal(body.type, 'template');
    assert.deepEqual(body.template.components[0].parameters.map((p) => p.text), [
      'order-123', 'Gift', '2', '$12.50', '$25.00', 'Customer', '+491234567890', 'Test street 1 Berlin', 'None',
    ]);
    return { ok: true, json: async () => ({ messages: [{ id: 'wamid.test' }] }) };
  });
  assert.equal(messageId, 'wamid.test');
});

test('image template includes the product image and preserves all nine body fields', async () => {
  await sendOrderNotification({ ...order, product_image_url: 'https://example.com/gift.jpg' }, { ...config, imageTemplate: 'order_image' }, async (_url, options) => {
    const template = JSON.parse(options.body).template;
    assert.equal(template.name, 'order_image');
    assert.deepEqual(template.components[0], { type: 'header', parameters: [{ type: 'image', image: { link: 'https://example.com/gift.jpg' } }] });
    assert.equal(template.components[1].parameters.length, 9);
    return { ok: true, json: async () => ({ messages: [{ id: 'wamid.image' }] }) };
  });
});

test('missing or invalid image uses text-only template; image feature is opt-in', async () => {
  for (const [url, imageTemplate] of [[null, 'image'], ['bad', 'image'], ['http://example.com/a.jpg', 'image'], ['https://user:password@example.com/a.jpg', 'image'], ['https://example.com/a.jpg', '']]) {
    await sendOrderNotification({ ...order, product_image_url: url }, { ...config, imageTemplate }, async (_url, options) => {
      const template = JSON.parse(options.body).template;
      assert.equal(template.name, config.template);
      assert.equal(template.components.length, 1);
      assert.equal(template.components[0].type, 'body');
      return { ok: true, json: async () => ({ messages: [{ id: 'wamid.text' }] }) };
    });
  }
});

test('rejects provider errors and malformed acceptance without exposing response details', async () => {
  for (const response of [
    { ok: false, status: 401, json: async () => ({ error: { message: 'private details' } }) },
    { ok: true, status: 200, json: async () => ({}) },
  ]) {
    await assert.rejects(sendOrderNotification(order, config, async () => response), (error) => !error.message.includes('private details'));
  }
});

test('retains Meta error codes for diagnosis without retaining the provider message', async () => {
  await assert.rejects(sendOrderNotification(order, config, async () => ({
    ok: false, status: 400,
    json: async () => ({ error: { code: 132001, error_subcode: 123, message: 'private provider details' } }),
  })), (error) => {
    assert.equal(error.httpStatus, 400);
    assert.equal(error.providerCode, 132001);
    assert.equal(error.providerSubcode, 123);
    assert.ok(!error.message.includes('private provider details'));
    return true;
  });
});

function database({ existing = null, rpcError = null, created = true, migrationError = null, product = null } = {}) {
  const state = { rpcCalls: 0, updates: [], lastRpc: null };
  return {
    state,
    from(table) {
      const chain = {
        select() { return chain; }, eq() { return chain; },
        maybeSingle: async () => ({ data: table === 'products' ? product : existing, error: null }),
        limit: async () => ({ error: migrationError }),
        update(values) { state.updates.push(values); return chain; },
      };
      return chain;
    },
    async rpc(name, args) {
      state.rpcCalls++;
      state.lastRpc = { name, args };
      assert.ok(['place_order', 'place_customer_order'].includes(name));
      assert.equal(args.p_user_id || args.p_customer_id, 'user-123');
      assert.equal(args.p_total, undefined);
      return { data: { order, created }, error: rpcError };
    },
  };
}
async function request(db, options = {}, body = payload, authType = 'email') {
  const response = { code: 200, status(code) { this.code = code; return this; }, json(data) { this.body = data; return this; } };
  await createOrderHandler(db, { getConfig: () => config, notify: async () => 'wamid.test', ...options })({ user: { id: 'user-123' }, body, authType }, response);
  return response;
}

test('saves first, sends once, and records API acceptance', async () => {
  const db = database();
  const result = await request(db, { notify: async () => { assert.equal(db.state.rpcCalls, 1); return 'wamid.test'; } });
  assert.equal(result.code, 201);
  assert.equal(result.body.total, 25);
  assert.equal(result.body.notification_status, 'accepted');
  assert.deepEqual(db.state.updates, [{ notification_status: 'accepted', whatsapp_message_id: 'wamid.test' }]);
});

test('existing and concurrently deduplicated orders do not send again', async () => {
  for (const db of [database({ existing: order }), database({ created: false })]) {
    const result = await request(db, { notify: async () => assert.fail('Must not resend') });
    assert.equal(result.code, 200);
    assert.equal(db.state.updates.length, 0);
  }
});

test('provider timeout preserves successful order and records uncertainty', async () => {
  const db = database();
  const result = await request(db, { notify: async () => { throw new Error('Timeout'); } });
  assert.equal(result.code, 201);
  assert.equal(result.body.id, order.id);
  assert.equal(result.body.notification_status, 'unknown');
});

test('stock failures do not notify and missing config does not reserve stock', async () => {
  const result = await request(database({ rpcError: { message: 'OUT_OF_STOCK' } }), { notify: async () => assert.fail('Must not send') });
  assert.equal(result.code, 409);
  const db = database();
  assert.equal((await request(db, { getConfig: () => { throw new Error('Missing config'); } })).code, 503);
  assert.equal(db.state.rpcCalls, 0);
  assert.equal((await request(db, {}, { ...payload, quantity: 0 })).code, 400);
});

test('Telegram uses separate tracking fields and preserves WhatsApp history', async () => {
  const db = database();
  const result = await request(db, { getConfig: () => ({ provider: 'telegram' }), notify: async () => '42' });
  assert.equal(result.code, 201);
  assert.deepEqual(db.state.updates, [
    { notification_provider: 'telegram' },
    { notification_status: 'accepted', notification_provider: 'telegram', notification_message_id: '42' },
  ]);
});

test('WhatsApp order notification resolves the image from the database', async () => {
  const db = database({ product: { image_url: 'https://example.com/database-image.jpg' } });
  const result = await request(db, {
    getConfig: () => ({ ...config, provider: 'whatsapp', imageTemplate: 'order_image' }),
    notify: async (savedOrder) => {
      assert.equal(savedOrder.product_image_url, 'https://example.com/database-image.jpg');
      return 'wamid.image';
    },
  }, { ...payload, product_image_url: 'https://example.com/untrusted.jpg' });
  assert.equal(result.code, 201);
});

test('missing Telegram migration blocks ordering before reserving stock or sending', async () => {
  const db = database({ migrationError: { code: '42703' } });
  const result = await request(db, { getConfig: () => ({ provider: 'telegram' }), notify: async () => assert.fail('Must not send') });
  assert.equal(result.code, 503);
  assert.equal(db.state.rpcCalls, 0);
});

test('existing image-header template always includes the ordered product image', async () => {
  await sendOrderNotification({ ...order, product_image_url: 'https://example.com/product.jpg' }, { ...config, headerType: 'image', imageTemplate: 'ignored' }, async (_url, options) => {
    const template = JSON.parse(options.body).template;
    assert.equal(template.name, config.template);
    assert.equal(template.components[0].parameters[0].image.link, 'https://example.com/product.jpg');
    assert.equal(template.components[1].parameters.length, 9);
    return { ok: true, json: async () => ({ messages: [{ id: 'wamid.image' }] }) };
  });
  await assert.rejects(sendOrderNotification(order, { ...config, headerType: 'image' }, async () => assert.fail('Must not send without image')), /product image is required/);
});

test('required images are checked before reserving stock and come from the database', async () => {
  for (const product of [null, { image_url: '' }, { image_url: 'javascript:bad' }]) {
    const db = database({ product });
    const response = await request(db, { getConfig: () => ({ ...config, provider: 'whatsapp', headerType: 'image' }), notify: async () => assert.fail('Must not send') });
    assert.equal(response.code, 409);
    assert.equal(db.state.rpcCalls, 0);
  }
  const db = database({ product: { image_url: 'https://example.com/real-product.jpg' } });
  const response = await request(db, {
    getConfig: () => ({ ...config, provider: 'whatsapp', headerType: 'image' }),
    notify: async (saved) => { assert.equal(saved.product_image_url, 'https://example.com/real-product.jpg'); return 'wamid.image'; },
  }, { ...payload, product_image_url: 'https://example.com/fake.jpg' });
  assert.equal(response.code, 201);
});

test('phone customers use their own order transaction, not Supabase Auth identities', async () => {
  const db = database();
  const response = await request(db, {}, payload, 'phone');
  assert.equal(response.code, 201);
  assert.equal(db.state.lastRpc.name, 'place_customer_order');
  assert.equal(db.state.lastRpc.args.p_customer_id, 'user-123');
  assert.equal(db.state.lastRpc.args.p_user_id, undefined);
});
