const test = require('node:test');
const assert = require('node:assert/strict');
const express = require('express');
const { createHmac } = require('node:crypto');
const { createWhatsAppWebhook } = require('../src/whatsapp-webhook');

test('WhatsApp webhook verifies challenges and authenticates raw delivery events', async (t) => {
  const rows = [];
  let unavailable = false;
  const db = { from(name) {
    assert.equal(name, 'whatsapp_delivery_events');
    return { async upsert(events, options) {
      assert.equal(options.ignoreDuplicates, true);
      if (unavailable) return { error: { code: 'test' } };
      rows.push(...events);
      return { error: null };
    } };
  } };
  const handlers = createWhatsAppWebhook(db, {
    META_APP_SECRET: 'test-secret', WHATSAPP_WEBHOOK_VERIFY_TOKEN: 'verify-token', WHATSAPP_PHONE_NUMBER_ID: '123',
  });
  const app = express();
  app.get('/hook', handlers.verify);
  app.post('/hook', express.raw({ type: 'application/json' }), handlers.receive);
  const server = app.listen(0, '127.0.0.1');
  await new Promise((resolve) => server.once('listening', resolve));
  t.after(() => { server.closeAllConnections(); return new Promise((resolve) => server.close(resolve)); });
  const base = `http://127.0.0.1:${server.address().port}/hook`;
  let response = await fetch(`${base}?hub.mode=subscribe&hub.verify_token=verify-token&hub.challenge=12345`);
  assert.equal(response.status, 200);
  assert.equal(await response.text(), '12345');
  assert.equal((await fetch(`${base}?hub.mode=subscribe&hub.verify_token=wrong&hub.challenge=12345`)).status, 403);
  const event = { id: 'wamid.test', status: 'failed', timestamp: '1750000000', recipient_id: 'private-number', errors: [{ code: 131026, message: 'private details' }] };
  const payload = { object: 'whatsapp_business_account', entry: [{ changes: [{ field: 'messages', value: { metadata: { phone_number_id: '123' }, statuses: [event, event] } }] }] };
  async function post(body, signature) {
    return fetch(base, { method: 'POST', headers: {
      'Content-Type': 'application/json',
      'x-hub-signature-256': signature || `sha256=${createHmac('sha256', 'test-secret').update(body).digest('hex')}`,
    }, body });
  }
  const body = JSON.stringify(payload);
  assert.equal((await post(body, 'sha256=wrong')).status, 403);
  assert.equal(rows.length, 0);
  assert.equal((await post(body)).status, 200);
  assert.equal(rows.length, 1);
  assert.equal(rows[0].status, 'failed');
  assert.deepEqual(rows[0].error_codes, [131026]);
  assert.ok(!JSON.stringify(rows).includes('private'));
  const firstKey = rows[0].event_key;
  await post(body);
  assert.equal(rows[1].event_key, firstKey);
  assert.equal((await post('{bad json')).status, 400);
  payload.entry[0].changes[0].value.metadata.phone_number_id = 'another-sender';
  assert.equal((await post(JSON.stringify(payload))).status, 200);
  assert.equal(rows.length, 2);
  unavailable = true;
  assert.equal((await post(body)).status, 503);
});
