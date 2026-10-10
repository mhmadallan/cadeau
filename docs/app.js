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
  card.className = 'product-card fade-in';

  const link = document.createElement('a');
  link.href = './product.html?id=' + encodeURIComponent(product.id);
  link.className = 'photo';
  link.setAttribute('aria-label', 'View ' + product.name);
  const image = document.createElement('img');
  image.src = product.image_url || './product-placeholder.svg';
  image.alt = product.name;
  image.loading = 'lazy';
  image.className = 'h-64 w-full object-cover';
  image.onerror = () => { image.onerror = null; image.src = './product-placeholder.svg'; };
  link.appendChild(image);
  card.appendChild(link);

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

    setMessage('');
    if (typeof document.querySelectorAll === 'function') setupCollections(products);

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

function setupCollections(products) {
  const filters = document.getElementById('collectionFilters'), links = document.getElementById('collectionLinks');
  filters.innerHTML = ''; links.innerHTML = '';
  const collections = [...new Set(products.map(p => p.collection).filter(Boolean))];
  const show = (label) => {
    productsGrid.innerHTML = '';
    products.filter(p => label === 'All pieces' || (label === 'New arrivals' ? p.new_arrival : label === 'Featured' ? p.featured : p.collection === label)).forEach(p => productsGrid.appendChild(createProductCard(p)));
    filters.querySelectorAll('button').forEach(b => b.classList.toggle('active', b.textContent === label));
  };
  ['All pieces','New arrivals','Featured',...collections].forEach(label => {
    const button = document.createElement('button'); button.textContent = label; button.className = label === 'All pieces' ? 'active' : ''; button.onclick = () => show(label); filters.appendChild(button);
  });
  collections.forEach(label => { const a = document.createElement('a'); a.className = 'collection-card'; a.textContent = label + ' ↗'; a.href = '#products'; a.onclick = () => show(label); links.appendChild(a); });
  if (!collections.length) links.textContent = 'The next collection is on its way.';
}
