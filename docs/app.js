const apiBaseUrl = window.CadeauAuth.apiBaseUrl;
const apiBase = `${apiBaseUrl}/api/products`;

const message = document.getElementById('message');
const authMessage = document.getElementById('authMessage');
const productsGrid = document.getElementById('productsGrid');
const refreshBtn = document.getElementById('refreshBtn');

let authClient;

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

async function loadCurrentUser() {
  const authState = await window.CadeauAuth.syncNavbar();

  if (!authState.isAuthenticated) {
    setAuthMessage('You are browsing as a guest.');
    return;
  }

  const response = await fetch(`${apiBaseUrl}/api/me`, {
    headers: {
      Authorization: `Bearer ${authState.token}`,
    },
  });

  if (!response.ok) {
    setAuthMessage('Signed in.');
    return;
  }

  const me = await response.json();
  setAuthMessage(`Signed in as ${me.email} (${me.role}).`);
}

refreshBtn.addEventListener('click', fetchProducts);

async function init() {
  const { client } = await window.CadeauAuth.initNavbar({
    logoutRedirect: './index.html',
    onLogoutError(error) {
      setAuthMessage(error.message, true);
    },
    onNavbarError(error) {
      setAuthMessage(error.message, true);
    },
  });
  authClient = client;
  await loadCurrentUser();
  await fetchProducts();

  authClient.auth.onAuthStateChange(async () => {
    await loadCurrentUser();
  });
}

init().catch((error) => {
  setAuthMessage(error.message, true);
});
