const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');

async function storefront({ session = null, authFailure = false, rejected = false } = {}) {
  function element() {
    return { hidden: true, children: [], textContent: '', innerHTML: '',
      addEventListener() {}, setAttribute() {}, appendChild(child) { this.children.push(child); } };
  }
  const elements = new Map();
  const requests = [];
  const redirects = [];
  let authCallback;
  const document = {
    getElementById(id) { if (!elements.has(id)) elements.set(id, element()); return elements.get(id); },
    createElement: element,
  };
  const context = {
    document, setTimeout, AbortSignal,
    window: {
      APP_CONFIG: {}, location: { replace: (url) => redirects.push(url) },
      supabase: { createClient: () => ({ auth: {
        getSession: async () => ({ data: { session } }),
        onAuthStateChange(callback) { authCallback = callback; },
      } }) },
    },
    fetch: async (url, options) => {
      requests.push({ url, options });
      if (url.endsWith('/api/config')) {
        if (authFailure) throw new Error('Authentication unavailable');
        return { ok: true, json: async () => ({ supabaseUrl: 'test', supabaseAnonKey: 'test' }) };
      }
      if (url.endsWith('/api/me')) return { ok: !rejected, status: rejected ? 401 : 200, json: async () => ({ email: 'user@example.com', role: 'user' }) };
      return { ok: true, json: async () => [{ id: 'product-1', name: 'Gift', price: 34, stock: 45 }] };
    },
  };
  vm.runInNewContext(fs.readFileSync(require.resolve('../docs/app.js'), 'utf8'), context);
  await new Promise((resolve) => setImmediate(resolve));
  return {
    elements, requests, redirects,
    logout: () => authCallback('SIGNED_OUT', null),
    recover: async () => {
      rejected = false;
      authCallback('TOKEN_REFRESHED', session);
      await new Promise((resolve) => setTimeout(resolve, 20));
    },
  };
}

test('guests are redirected without requesting product data', async () => {
  const page = await storefront();
  assert.ok(page.redirects.includes('./signin.html'));
  assert.equal(page.elements.get('storeContent').hidden, true);
  assert.ok(!page.requests.some((r) => r.url.endsWith('/api/products')));
});

test('authentication failures and rejected sessions never reveal content', async () => {
  for (const options of [{ authFailure: true }, { session: { access_token: 'bad', user: { id: 'user-1' } }, rejected: true }]) {
    const page = await storefront(options);
    assert.equal(page.elements.get('storeContent').hidden, true);
    assert.ok(!page.requests.some((r) => r.url.endsWith('/api/products')));
  }
});

test('verified sessions fetch products with authorization and logout hides them', async () => {
  const page = await storefront({ session: { access_token: 'test-token', user: { id: 'user-1' } } });
  assert.equal(page.elements.get('storeContent').hidden, false);
  assert.equal(page.requests.find((r) => r.url.endsWith('/api/products')).options.headers.Authorization, 'Bearer test-token');
  assert.equal(page.elements.get('productsGrid').children[0].children[0].href, './order.html?id=product-1');
  page.logout();
  assert.equal(page.elements.get('storeContent').hidden, true);
  assert.equal(page.elements.get('productsGrid').innerHTML, '');
  assert.ok(page.redirects.includes('./signin.html'));
});

test('a successful later authentication check restores the hidden catalog', async () => {
  const page = await storefront({ session: { access_token: 'test-token', user: { id: 'user-1' } }, rejected: true });
  assert.equal(page.elements.get('storeContent').hidden, true);
  await page.recover();
  assert.equal(page.elements.get('storeContent').hidden, false);
  assert.equal(page.elements.get('accessMessage').hidden, true);
  assert.equal(page.elements.get('productsGrid').children.length, 1);
});
