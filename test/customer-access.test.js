const test = require('node:test');
const assert = require('node:assert/strict');
const { createCustomerAccess, normalizePhone, sendAccessMessage } = require('../src/customer-access');

function database() {
  const tables = { shop_customers: [], customer_sessions: [] };
  return { tables, from(table) {
    let action = 'select', value, filters = [];
    const chain = {
      select() { return chain; },
      eq(key, val) { filters.push(row => row[key] === val); return chain; },
      neq(key, val) { filters.push(row => row[key] !== val); return chain; },
      insert(data) { action = 'insert'; value = data; return chain; },
      update(data) { action = 'update'; value = data; return chain; },
      delete() { action = 'delete'; return chain; },
      single() { return run(true); }, maybeSingle() { return run(true); },
      then(resolve, reject) { return run(false).then(resolve, reject); },
    };
    async function run(single) {
      let rows = tables[table].filter(row => filters.every(filter => filter(row)));
      if (action === 'insert') {
        if (table === 'shop_customers' && tables[table].some(row => row.phone === value.phone)) return { error: { code: '23505' } };
        const row = { id: '11111111-1111-4111-8111-111111111111', status: 'pending', ...value };
        tables[table].push(row); rows = [row];
      }
      if (action === 'update') rows.forEach(row => Object.assign(row, value));
      if (action === 'delete') tables[table] = tables[table].filter(row => !rows.includes(row));
      return { data: single ? rows[0] || null : rows, error: null };
    }
    return chain;
  } };
}
async function call(handler, { body = {}, params = {}, token = '' } = {}) {
  const res = { code: 200, status(code) { this.code = code; return this; }, set() {}, json(body) { this.body = body; return this; }, sendStatus(code) { this.code = code; return this; } };
  await handler({ body, params, user: { id: 'admin-id' }, get: () => `Bearer ${token}` }, res);
  return res;
}

test('international phone normalization rejects ambiguous or invalid inputs', () => {
  assert.equal(normalizePhone('+49 (176) 1234-5678'), '+4917612345678');
  assert.equal(normalizePhone('004917612345678'), '+4917612345678');
  for (const number of ['017612345678', 'abc', null, '+00000000']) assert.throws(() => normalizePhone(number));
});

test('pending requests cannot login; duplicates do not notify or overwrite names', async () => {
  const db = database(); const notices = [];
  const access = createCustomerAccess(db, async (kind) => { notices.push(kind); return 'accepted'; });
  const body = { name: 'Alex', phone: '+4917612345678' };
  assert.equal((await call(access.request, { body })).code, 201);
  assert.equal((await call(access.request, { body: { ...body, name: 'Imposter' } })).code, 202);
  assert.equal(db.tables.shop_customers[0].name, 'Alex');
  assert.deepEqual(notices, ['request']);
  assert.equal((await call(access.login, { body })).code, 403);
});

test('approval permits shop-only sessions; revocation blocks existing tokens', async () => {
  const db = database(); const notices = [];
  const access = createCustomerAccess(db, async kind => { notices.push(kind); return 'accepted'; });
  const body = { name: 'Alex', phone: '+4917612345678' };
  await call(access.request, { body });
  const id = db.tables.shop_customers[0].id;
  await call(access.decide, { params: { id }, body: { status: 'approved' } });
  await call(access.decide, { params: { id }, body: { status: 'approved' } });
  assert.deepEqual(notices, ['request', 'approved']);
  const result = await call(access.login, { body });
  assert.equal(result.code, 200);
  assert.ok(result.body.access_token.startsWith('shop_'));
  assert.notEqual(db.tables.customer_sessions[0].token_hash, result.body.access_token);
  const session = await access.authenticate(result.body.access_token);
  assert.equal(session.role, 'customer');
  assert.equal(session.user.phone, undefined);
  assert.equal(session.user.name, undefined);
  await call(access.decide, { params: { id }, body: { status: 'rejected' } });
  assert.equal((await access.authenticate(result.body.access_token)).status, 401);
  assert.equal((await call(access.login, { body })).code, 403);
});

test('notification failure does not discard access requests or approval', async () => {
  const db = database();
  const access = createCustomerAccess(db, async () => 'unknown');
  const body = { name: 'Alex', phone: '+4917612345678' };
  await call(access.request, { body });
  assert.equal(db.tables.shop_customers[0].request_notification, 'unknown');
  const id = db.tables.shop_customers[0].id;
  await call(access.decide, { params: { id }, body: { status: 'approved' } });
  assert.equal((await call(access.login, { body })).code, 200);
});

test('access notices use distinct templates and correct recipients', async () => {
  const env = { WHATSAPP_ACCESS_REQUEST_TEMPLATE: 'request_access', WHATSAPP_ACCESS_APPROVED_TEMPLATE: 'approved_access', WHATSAPP_ACCESS_TOKEN: 'secret', WHATSAPP_PHONE_NUMBER_ID: '123', WHATSAPP_API_VERSION: 'v25.0', WHATSAPP_RECIPIENT_NUMBER: '49123456789' };
  for (const kind of ['request', 'approved']) {
    assert.equal(await sendAccessMessage(kind, { name: 'Alex', phone: '+4917612345678' }, env, async (_url, options) => {
      const body = JSON.parse(options.body);
      assert.equal(body.to, kind === 'request' ? env.WHATSAPP_RECIPIENT_NUMBER : '4917612345678');
      assert.equal(body.template.components[0].parameters.length, 2);
      return { ok: true, json: async () => ({ messages: [{ id: 'test' }] }) };
    }), 'accepted');
  }
});
