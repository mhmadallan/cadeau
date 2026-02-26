const apiBase = '/api/products';
const message = document.getElementById('message');
const productsGrid = document.getElementById('productsGrid');
const refreshBtn = document.getElementById('refreshBtn');

function setMessage(text, isError = false) {
  message.textContent = text || '';
  message.className = `mb-4 text-sm ${isError ? 'text-red-600' : 'text-slate-600'}`;
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
      setMessage('No products found. Add your first product.');
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

refreshBtn.addEventListener('click', fetchProducts);

fetchProducts();
