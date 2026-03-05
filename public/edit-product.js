const appConfig = window.APP_CONFIG || {};
const apiBaseUrl = (appConfig.API_BASE_URL || 'http://localhost:4000').replace(/\/+$/, '');
const apiBase = `${apiBaseUrl}/api/products`;

const productForm = document.getElementById('productForm');
const nameInput = document.getElementById('name');
const descriptionInput = document.getElementById('description');
const priceInput = document.getElementById('price');
const imageUrlInput = document.getElementById('image_url');
const stockInput = document.getElementById('stock');
const message = document.getElementById('message');

const params = new URLSearchParams(window.location.search);
const productId = params.get('id');

let authClient;
let accessToken = '';

function setMessage(text, isError = false) {
  message.textContent = text || '';
  message.className = `mt-4 text-sm ${isError ? 'text-red-600' : 'text-emerald-700'}`;
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
}

async function requireAdminSession() {
  const { data } = await authClient.auth.getSession();
  accessToken = data.session?.access_token || '';

  if (!accessToken) {
    window.location.href = './index.html';
    return false;
  }

  const meResponse = await fetch(`${apiBaseUrl}/api/me`, {
    headers: {
      Authorization: `Bearer ${accessToken}`,
    },
  });

  if (!meResponse.ok) {
    window.location.href = './index.html';
    return false;
  }

  const me = await meResponse.json();
  if (me.role !== 'admin') {
    setMessage('Admin access required.', true);
    productForm.hidden = true;
    return false;
  }

  return true;
}

async function loadProduct() {
  const response = await fetch(`${apiBase}/${productId}`);
  const product = await response.json();

  if (!response.ok) {
    throw new Error(product.error || 'Failed to load product');
  }

  nameInput.value = product.name;
  descriptionInput.value = product.description ?? '';
  priceInput.value = product.price;
  imageUrlInput.value = product.image_url ?? '';
  stockInput.value = product.stock ?? 0;
}

async function updateProduct(payload) {
  const response = await fetch(`${apiBase}/${productId}`, {
    method: 'PUT',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${accessToken}`,
    },
    body: JSON.stringify(payload),
  });

  const data = await response.json();
  if (!response.ok) {
    throw new Error(data.error || 'Update failed');
  }
}

productForm.addEventListener('submit', async (event) => {
  event.preventDefault();

  const payload = {
    name: nameInput.value.trim(),
    description: descriptionInput.value.trim(),
    price: Number(priceInput.value),
    image_url: imageUrlInput.value.trim(),
    stock: Number(stockInput.value || 0),
  };

  try {
    await updateProduct(payload);
    setMessage('Product updated successfully.');
    setTimeout(() => {
      window.location.href = './admin.html';
    }, 700);
  } catch (error) {
    setMessage(error.message, true);
  }
});

async function init() {
  if (!productId) {
    setMessage('Missing product id in URL.', true);
    productForm.hidden = true;
    return;
  }

  await createAuthClient();
  const allowed = await requireAdminSession();
  if (!allowed) return;
  await loadProduct();
}

init().catch((error) => {
  setMessage(error.message, true);
});
