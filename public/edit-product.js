const apiBase = '/api/products';
const adminVerifyApi = '/api/admin/verify';
const adminKeyStorageKey = 'cadeau_admin_key';

const productForm = document.getElementById('productForm');
const nameInput = document.getElementById('name');
const descriptionInput = document.getElementById('description');
const priceInput = document.getElementById('price');
const imageUrlInput = document.getElementById('image_url');
const stockInput = document.getElementById('stock');
const message = document.getElementById('message');

const params = new URLSearchParams(window.location.search);
const productId = params.get('id');

function getAdminKey() {
  return sessionStorage.getItem(adminKeyStorageKey) || '';
}

function setMessage(text, isError = false) {
  message.textContent = text || '';
  message.className = `mt-4 text-sm ${isError ? 'text-red-600' : 'text-emerald-700'}`;
}

async function verifyAdminKey(adminKey) {
  const response = await fetch(adminVerifyApi, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ adminKey }),
  });

  if (!response.ok) {
    throw new Error('Admin access required');
  }
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
      'x-admin-key': getAdminKey(),
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
      window.location.href = '/admin.html';
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

  const adminKey = getAdminKey();
  if (!adminKey) {
    window.location.href = '/admin.html';
    return;
  }

  try {
    await verifyAdminKey(adminKey);
    await loadProduct();
  } catch (_error) {
    sessionStorage.removeItem(adminKeyStorageKey);
    window.location.href = '/admin.html';
  }
}

init();
