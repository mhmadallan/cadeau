const apiBaseUrl = window.CadeauAuth.apiBaseUrl;
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

async function requireAdminSession() {
  const authState = await window.CadeauAuth.syncNavbar();
  accessToken = authState.token;

  if (!authState.isAuthenticated) {
    window.location.href = './index.html';
    return false;
  }

  if (!authState.me) {
    window.location.href = './index.html';
    return false;
  }

  if (!authState.isAdmin) {
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

  const navbar = await window.CadeauAuth.initNavbar({
    logoutRedirect: './index.html',
    onLogoutError(error) {
      setMessage(error.message, true);
    },
    onNavbarError(error) {
      setMessage(error.message, true);
    },
  });
  authClient = navbar.client;
  const allowed = await requireAdminSession();
  if (!allowed) return;
  await loadProduct();
}

init().catch((error) => {
  setMessage(error.message, true);
});
