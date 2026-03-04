const apiBase = '/api/products';

const message = document.getElementById('message');
const productsGrid = document.getElementById('productsGrid');
const refreshBtn = document.getElementById('refreshBtn');

const authMessage = document.getElementById('authMessage');
const emailInput = document.getElementById('email');
const passwordInput = document.getElementById('password');
const signupBtn = document.getElementById('signupBtn');
const signinBtn = document.getElementById('signinBtn');
const googleBtn = document.getElementById('googleBtn');
const logoutBtn = document.getElementById('logoutBtn');
const adminLink = document.getElementById('adminLink');

let authClient;

function setMessage(text, isError = false) {
  message.textContent = text || '';
  message.className = `mb-4 text-sm ${isError ? 'text-red-600' : 'text-slate-600'}`;
}

function setAuthMessage(text, isError = false) {
  authMessage.textContent = text || '';
  authMessage.className = `mt-3 text-sm ${isError ? 'text-red-600' : 'text-emerald-700'}`;
}

function showSignedOutUi(statusText = 'Logged out.') {
  adminLink.hidden = true;
  logoutBtn.hidden = true;
  setAuthMessage(statusText);
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

  return card;
}

async function fetchProducts() {
  setMessage('Loading products...');
  try {
    const response = await fetch(apiBase);
    const products = await response.json();

    if (!response.ok) {
      throw new Error(products.error || 'Failed to fetch products');
    }

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

async function getAccessToken() {
  const { data } = await authClient.auth.getSession();
  return data.session?.access_token || null;
}

async function loadCurrentUser() {
  const token = await getAccessToken();
  if (!token) {
    showSignedOutUi();
    return;
  }

  const response = await fetch('/api/me', {
    headers: {
      Authorization: `Bearer ${token}`,
    },
  });

  if (!response.ok) {
    adminLink.hidden = true;
    logoutBtn.hidden = false;
    setAuthMessage('Signed in.');
    return;
  }

  const me = await response.json();
  logoutBtn.hidden = false;
  adminLink.hidden = me.role !== 'admin';
  setAuthMessage(`Signed in as ${me.email} (${me.role}).`);
}

async function createAuthClient() {
  const response = await fetch('/api/config');
  const config = await response.json();
  if (!response.ok) {
    throw new Error(config.error || 'Failed to load auth config');
  }

  authClient = window.supabase.createClient(config.supabaseUrl, config.supabaseAnonKey);
}

signupBtn.addEventListener('click', async () => {
  try {
    const email = emailInput.value.trim();
    const password = passwordInput.value;
    const { error } = await authClient.auth.signUp({ email, password });
    if (error) throw error;
    setAuthMessage('Account created. Check your email for confirmation if required.');
    await loadCurrentUser();
  } catch (error) {
    setAuthMessage(error.message, true);
  }
});

signinBtn.addEventListener('click', async () => {
  try {
    const email = emailInput.value.trim();
    const password = passwordInput.value;
    const { error } = await authClient.auth.signInWithPassword({ email, password });
    if (error) throw error;
    setAuthMessage('Signed in successfully.');
    await loadCurrentUser();
  } catch (error) {
    setAuthMessage(error.message, true);
  }
});

googleBtn.addEventListener('click', async () => {
  try {
    const { error } = await authClient.auth.signInWithOAuth({
      provider: 'google',
      options: {
        redirectTo: `${window.location.origin}/`,
      },
    });
    if (error) throw error;
  } catch (error) {
    setAuthMessage(error.message, true);
  }
});

logoutBtn.addEventListener('click', async () => {
  const { error } = await authClient.auth.signOut({ scope: 'local' });
  if (error) {
    setAuthMessage(error.message, true);
    return;
  }
  showSignedOutUi();
});

refreshBtn.addEventListener('click', fetchProducts);

async function init() {
  await createAuthClient();
  await loadCurrentUser();
  await fetchProducts();

  authClient.auth.onAuthStateChange(async () => {
    await loadCurrentUser();
  });
}

init().catch((error) => {
  setAuthMessage(error.message, true);
});
