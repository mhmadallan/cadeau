const apiBase = '/api/products';
const adminVerifyApi = '/api/admin/verify';
const adminKeyStorageKey = 'cadeau_admin_key';

const authSection = document.getElementById('authSection');
const manageSection = document.getElementById('manageSection');
const adminKeyForm = document.getElementById('adminKeyForm');
const adminKeyInput = document.getElementById('adminKey');
const authMessage = document.getElementById('authMessage');
const productForm = document.getElementById('productForm');
const message = document.getElementById('message');
const productsGrid = document.getElementById('productsGrid');
const refreshBtn = document.getElementById('refreshBtn');
const logoutBtn = document.getElementById('logoutBtn');

const nameInput = document.getElementById('name');
const descriptionInput = document.getElementById('description');
const priceInput = document.getElementById('price');
const imageUrlInput = document.getElementById('image_url');
const stockInput = document.getElementById('stock');

function getAdminKey() {
  return sessionStorage.getItem(adminKeyStorageKey) || '';
}

function setAuthMessage(text, isError = false) {
  authMessage.textContent = text || '';
  authMessage.className = `mt-3 text-sm ${isError ? 'text-red-600' : 'text-emerald-700'}`;
}

function setMessage(text, isError = false) {
  message.textContent = text || '';
  message.className = `mt-4 text-sm ${isError ? 'text-red-600' : 'text-emerald-700'}`;
}

function setAdminUi(enabled) {
  authSection.hidden = enabled;
  manageSection.hidden = !enabled;
}

function createProductCard(product) {
  const card = document.createElement('article');
  card.className = 'overflow-hidden rounded-xl bg-slate-50 shadow-sm ring-1 ring-slate-200';

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
      <div class="mt-4 flex gap-2">
        <a class="rounded-md bg-slate-900 px-3 py-1.5 text-sm text-white hover:bg-slate-700" href="/edit-product.html?id=${product.id}">Edit</a>
        <button class="delete-btn rounded-md bg-red-600 px-3 py-1.5 text-sm text-white hover:bg-red-500" data-id="${product.id}">Delete</button>
      </div>
    </div>
  `;

  return card;
}

async function verifyAdminKey(adminKey) {
  const response = await fetch(adminVerifyApi, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ adminKey }),
  });

  if (!response.ok) {
    const data = await response.json();
    throw new Error(data.error || 'Invalid admin key');
  }
}

async function fetchProducts() {
  try {
    const response = await fetch(apiBase);
    const products = await response.json();

    if (!response.ok) {
      throw new Error(products.error || 'Failed to fetch products');
    }

    productsGrid.innerHTML = '';
    if (!products.length) {
      productsGrid.innerHTML = '<p class="text-slate-600">No products available yet.</p>';
      return;
    }

    products.forEach((product) => {
      productsGrid.appendChild(createProductCard(product));
    });
  } catch (error) {
    productsGrid.innerHTML = `<p class="text-red-600">${error.message}</p>`;
  }
}

async function createProduct(payload) {
  const response = await fetch(apiBase, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'x-admin-key': getAdminKey(),
    },
    body: JSON.stringify(payload),
  });

  const data = await response.json();
  if (!response.ok) {
    throw new Error(data.error || 'Create failed');
  }
}

async function deleteProduct(id) {
  const response = await fetch(`${apiBase}/${id}`, {
    method: 'DELETE',
    headers: { 'x-admin-key': getAdminKey() },
  });

  if (!response.ok) {
    const data = await response.json();
    throw new Error(data.error || 'Delete failed');
  }
}

function resetProductForm() {
  productForm.reset();
  stockInput.value = '0';
}

adminKeyForm.addEventListener('submit', async (event) => {
  event.preventDefault();
  const adminKey = adminKeyInput.value.trim();

  try {
    await verifyAdminKey(adminKey);
    sessionStorage.setItem(adminKeyStorageKey, adminKey);
    setAdminUi(true);
    setAuthMessage('');
    await fetchProducts();
  } catch (error) {
    setAuthMessage(error.message, true);
  }
});

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
    await createProduct(payload);
    setMessage('Product created successfully.');
    resetProductForm();
    await fetchProducts();
  } catch (error) {
    setMessage(error.message, true);
  }
});

productsGrid.addEventListener('click', async (event) => {
  const target = event.target;
  if (!target.classList.contains('delete-btn')) return;

  const confirmed = window.confirm('Delete this product?');
  if (!confirmed) return;

  try {
    await deleteProduct(target.dataset.id);
    setMessage('Product deleted successfully.');
    await fetchProducts();
  } catch (error) {
    setMessage(error.message, true);
  }
});

refreshBtn.addEventListener('click', fetchProducts);

logoutBtn.addEventListener('click', () => {
  sessionStorage.removeItem(adminKeyStorageKey);
  setAdminUi(false);
  setMessage('');
  setAuthMessage('Admin panel locked.');
});

async function init() {
  await fetchProducts();

  const existingKey = getAdminKey();
  if (!existingKey) {
    setAdminUi(false);
    return;
  }

  try {
    await verifyAdminKey(existingKey);
    setAdminUi(true);
  } catch (_error) {
    sessionStorage.removeItem(adminKeyStorageKey);
    setAdminUi(false);
  }
}

init();
