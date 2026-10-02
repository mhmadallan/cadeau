const appConfig = window.APP_CONFIG || {};
const apiBaseUrl = (appConfig.API_BASE_URL || 'http://localhost:4000').replace(/\/+$/, '');
const apiBase = `${apiBaseUrl}/api/products`;

const message = document.getElementById('message');
const authMessage = document.getElementById('authMessage');
const productsGrid = document.getElementById('productsGrid');
const refreshBtn = document.getElementById('refreshBtn');
const signinLink = document.getElementById('signinLink');
const logoutBtn = document.getElementById('logoutBtn');
const adminLink = document.getElementById('adminLink');

let authClient;
const storeContent = document.getElementById('storeContent');
const accessMessage = document.getElementById('accessMessage');

function requireSignIn() {
  storeContent.hidden = true;
  productsGrid.innerHTML = '';
  window.location.replace('./signin.html');
}

function setMessage(text, isError = false) {
  message.textContent = text || '';
  message.className = `mb-4 text-sm ${isError ? 'text-red-600' : 'text-slate-600'}`;
}

function setAuthMessage(text, isError = false) {
  authMessage.textContent = text || '';
  authMessage.className = `mb-2 text-sm ${isError ? 'text-red-600' : 'text-slate-600'}`;
}

function createProductCard(product) {
  const card = document.createElement('article');
  card.className = 'overflow-hidden rounded-xl bg-white shadow-sm ring-1 ring-slate-200';

  const image = product.image_url
    ? `<img src="${product.image_url}" alt="${product.name}" class="h-44 w-full object-cover" />`
    : '<div class="grid h-44 place-items-center bg-slate-200 text-slate-500">No image</div>';

  card.innerHTML = `
    ${image}
    <div class="p-4">
      <h3 class="text-lg font-semibold">${product.name}</h3>
      <p class="mt-1 text-sm text-slate-600 min-h-10">${product.description ?? ''}</p>
      <div class="mt-3 flex items-center justify-between text-sm">
        <span class="font-medium text-emerald-700">$${Number(product.price).toFixed(2)}</span>
        <span class="rounded-full bg-slate-100 px-2 py-1 text-slate-700">Stock: ${product.stock ?? 0}</span>
      </div>
    </div>
  `;

  const orderLink = document.createElement('a');
  orderLink.className = 'm-4 mt-0 inline-block rounded-lg bg-emerald-600 px-4 py-2 text-white hover:bg-emerald-500';
  orderLink.textContent = Number(product.stock) > 0 ? 'Order product' : 'Out of stock';
  if (Number(product.stock) > 0) orderLink.href = `./order.html?id=${encodeURIComponent(product.id)}`;
  else orderLink.setAttribute('aria-disabled', 'true');
  card.appendChild(orderLink);

  return card;
}

async function fetchProducts() {
  setMessage('Loading products...');
  try {
    const { data } = await authClient.auth.getSession();
    const token = data.session?.access_token;
    if (!token) return requireSignIn();
    const response = await fetch(apiBase, { headers: { Authorization: `Bearer ${token}` } });
    if (response.status === 401) return requireSignIn();
    const products = await response.json();

    if (!response.ok) {
      throw new Error(products.error || 'Failed to fetch products');
    }

    // A logout while the request was pending must not reveal the response.
    const current = await authClient.auth.getSession();
    if (current.data.session?.user.id !== data.session.user.id) return requireSignIn();

    productsGrid.innerHTML = '';
    if (!products.length) {
      productsGrid.innerHTML = '<p class="text-slate-600">No products available yet.</p>';
      setMessage('No products found.');
      return;
    }

    products.forEach((product) => {
      productsGrid.appendChild(createProductCard(product));
    });

    setMessage(`Loaded ${products.length} product(s).`);
  } catch (error) {
    setMessage(error.message, true);
  }
}

async function createAuthClient() {
  let supabaseClientUrl = appConfig.SUPABASE_URL;
  let supabaseClientAnonKey = appConfig.SUPABASE_ANON_KEY;

  if (!supabaseClientUrl || !supabaseClientAnonKey) {
    const response = await fetch(`${apiBaseUrl}/api/config`);
    const config = await response.json();
    if (!response.ok) {
      throw new Error(config.error || 'Failed to load auth config');
    }
    supabaseClientUrl = config.supabaseUrl;
    supabaseClientAnonKey = config.supabaseAnonKey;
  }

  authClient = window.supabase.createClient(supabaseClientUrl, supabaseClientAnonKey);
  if (window.ShopSession) authClient = window.ShopSession.wrap(authClient, apiBaseUrl);
}

async function loadCurrentUser() {
  const { data } = await authClient.auth.getSession();
  const token = data.session?.access_token;

  if (!token) {
    requireSignIn();
    return false;
  }

  signinLink.hidden = true;
  logoutBtn.hidden = false;

  const response = await fetch(`${apiBaseUrl}/api/me`, {
    signal: AbortSignal.timeout(15000),
    headers: {
      Authorization: `Bearer ${token}`,
    },
  });

  if (!response.ok) {
    if (response.status === 401) requireSignIn();
    throw new Error('Unable to verify your account. Please sign in again.');
  }

  const me = await response.json();
  adminLink.hidden = me.role !== 'admin';
  setAuthMessage(me.role === 'customer' ? 'Shop access approved.' : `Signed in as ${me.email} (${me.role}).`);
  return true;
}

logoutBtn.addEventListener('click', async () => {
  const { error } = await authClient.auth.signOut({ scope: 'local' });
  if (error) {
    setAuthMessage(error.message, true);
    return;
  }

  requireSignIn();
});

refreshBtn.addEventListener('click', fetchProducts);

let refreshInProgress = null;
let refreshRequested = false;

async function refreshSignedInStore() {
  if (refreshInProgress) {
    refreshRequested = true;
    return refreshInProgress;
  }
  refreshInProgress = (async () => {
    do {
      refreshRequested = false;
      try {
        if (!await loadCurrentUser()) return;
        storeContent.hidden = false;
        accessMessage.hidden = true;
        await fetchProducts();
      } catch (error) {
        storeContent.hidden = true;
        productsGrid.innerHTML = '';
        accessMessage.hidden = false;
        accessMessage.textContent = `${error.message} Reload the page to try again.`;
      }
    } while (refreshRequested);
  })();
  try { await refreshInProgress; }
  finally { refreshInProgress = null; }
}

async function init() {
  await createAuthClient();
  authClient.auth.onAuthStateChange((event, session) => {
    // init handles the initial session once. Later successful checks must also
    // reveal the catalog again, including after transient authentication failures.
    if (event === 'INITIAL_SESSION') return;
    if (!session) return requireSignIn();
    setTimeout(() => { refreshSignedInStore(); }, 0);
  });
  await refreshSignedInStore();
}

init().catch((error) => {
  storeContent.hidden = true;
  accessMessage.hidden = false;
  accessMessage.textContent = `${error.message} Reload the page to try again.`;
});
