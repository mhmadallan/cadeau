const orderConfig = window.APP_CONFIG || {};
const orderApi = (orderConfig.API_BASE_URL || 'http://localhost:4000').replace(/\/+$/, '');
const orderProductId = new URLSearchParams(window.location.search).get('id');
const orderForm = document.getElementById('orderForm');
const orderFields = document.getElementById('orderFields');
const orderMessage = document.getElementById('orderMessage');
const placeOrderButton = document.getElementById('placeOrder');
let orderAuth;
let orderProduct;
let pendingOrder;
let pendingKey;

function showOrderMessage(text) { orderMessage.textContent = text; }
function updateTotal() {
  document.getElementById('orderTotal').textContent = `Product total: $${(Number(orderProduct.price) * Number(orderForm.elements.quantity.value)).toFixed(2)}`;
}

async function initOrder() {
  if (!orderProductId) throw new Error('No product selected. Please return to the store.');
  let config = { supabaseUrl: orderConfig.SUPABASE_URL, supabaseAnonKey: orderConfig.SUPABASE_ANON_KEY };
  if (!config.supabaseUrl || !config.supabaseAnonKey) {
    const response = await fetch(`${orderApi}/api/config`);
    if (!response.ok) throw new Error('Could not load the order form. Please try again later.');
    config = await response.json();
  }
  orderAuth = window.supabase.createClient(config.supabaseUrl, config.supabaseAnonKey);
  if (window.ShopSession) orderAuth = window.ShopSession.wrap(orderAuth, orderApi);
  const { data } = await orderAuth.auth.getSession();
  if (!data.session) {
    window.location.replace('./signin.html');
    return;
  }
  orderAuth.auth.onAuthStateChange((_event, session) => {
    if (!session) {
      document.getElementById('protectedContent').hidden = true;
      orderForm.hidden = true;
      document.getElementById('productSummary').textContent = '';
      window.location.replace('./signin.html');
    }
  });
  pendingKey = `cadeau-order:${data.session.user.id}:${orderProductId}`;
  pendingOrder = JSON.parse(sessionStorage.getItem(pendingKey) || 'null');
  const response = await fetch(`${orderApi}/api/products/${encodeURIComponent(orderProductId)}`, {
    headers: { Authorization: `Bearer ${data.session.access_token}` },
  });
  if (response.status === 401) { window.location.replace('./signin.html'); return; }
  if (response.status === 403) throw new Error('Unable to verify your account. Please sign in again.');
  if (!response.ok && !pendingOrder) throw new Error('This product is no longer available.');
  document.getElementById('protectedContent').hidden = false;
  document.getElementById('accessMessage').hidden = true;
  orderProduct = response.ok ? await response.json() : { name: 'Previously submitted order', price: 0, stock: 0 };
  document.getElementById('productSummary').textContent = `${orderProduct.name} — $${Number(orderProduct.price).toFixed(2)} each`;
  if (pendingOrder) {
    for (const [key, value] of Object.entries(pendingOrder)) {
      if (orderForm.elements.namedItem(key)) orderForm.elements.namedItem(key).value = value;
    }
    orderFields.disabled = true;
    showOrderMessage('An earlier submission is awaiting confirmation. Use the button to check it without placing another order.');
    placeOrderButton.textContent = 'Confirm previous order';
  } else {
    if (Number(orderProduct.stock) < 1) throw new Error('This product is out of stock.');
    orderForm.elements.quantity.max = Math.min(99, Number(orderProduct.stock));
  }
  orderForm.hidden = false;
  updateTotal();
}

orderForm.elements.quantity.addEventListener('input', updateTotal);
orderForm.addEventListener('submit', async (event) => {
  event.preventDefault();
  placeOrderButton.disabled = true;
  try {
    const { data } = await orderAuth.auth.getSession();
    if (!data.session) throw new Error('Your session expired. Sign in again to continue.');
    if (!pendingOrder) {
      pendingOrder = Object.fromEntries(new FormData(orderForm));
      pendingOrder.quantity = Number(pendingOrder.quantity);
      pendingOrder.product_id = orderProductId;
      pendingOrder.request_id = crypto.randomUUID();
      sessionStorage.setItem(pendingKey, JSON.stringify(pendingOrder));
    }
    orderFields.disabled = true;
    showOrderMessage('Submitting your order…');
    const response = await fetch(`${orderApi}/api/orders`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${data.session.access_token}` },
      body: JSON.stringify(pendingOrder),
      signal: AbortSignal.timeout(30000),
    });
    const result = await response.json();
    if (!response.ok) {
      // Keep the same request ID on uncertain failures; the server deduplicates retries.
      if ([400, 409].includes(response.status)) {
        sessionStorage.removeItem(pendingKey);
        pendingOrder = null;
        orderFields.disabled = false;
      }
      throw new Error(result.error || 'Could not confirm your order. Please retry.');
    }
    sessionStorage.removeItem(pendingKey);
    orderForm.hidden = true;
    showOrderMessage(`Order ${result.id} received. Product total: $${Number(result.total).toFixed(2)}. The store will contact you to arrange payment and delivery.`);
  } catch (error) {
    showOrderMessage(`${error.message}${pendingOrder ? ' Retry to confirm the same order; do not start a new order.' : ''}`);
    placeOrderButton.textContent = pendingOrder ? 'Confirm order' : 'Place order';
  } finally {
    placeOrderButton.disabled = false;
  }
});

initOrder().catch((error) => {
  document.getElementById('accessMessage').textContent = error.message;
  showOrderMessage(error.message);
});
