window.createCollectionCard = function (product) {
  const card = document.createElement('article');
  card.className = 'product-card collection-product';
  card.setAttribute('aria-label', product.name);
  const gallery = document.createElement('div');
  card.appendChild(gallery);
  window.renderProductGallery(gallery, { ...product, image_urls: product.image_urls?.length ? product.image_urls : product.images });
  const actions = document.createElement('div');
  actions.className = 'collection-actions';
  const status = document.createElement('p');
  status.className = 'collection-status';
  status.setAttribute('role', 'status');
  const like = document.createElement('button');
  like.type = 'button';
  like.className = 'collection-icon';
  const readLikes = () => {
    try { const value = JSON.parse(localStorage.getItem('cadeau-likes') || '[]'); return Array.isArray(value) ? value : []; }
    catch { return []; }
  };
  const updateLike = () => {
    const liked = readLikes().includes(product.id);
    like.textContent = liked ? '♥' : '♡';
    like.setAttribute('aria-pressed', String(liked));
    like.setAttribute('aria-label', (liked ? 'Unlike ' : 'Like ') + product.name);
  };
  updateLike();
  like.addEventListener('click', () => {
    try {
      const likes = readLikes();
      localStorage.setItem('cadeau-likes', JSON.stringify(likes.includes(product.id) ? likes.filter(id => id !== product.id) : [...likes, product.id]));
      updateLike();
    } catch { status.textContent = 'Could not save your favourite on this device.'; }
  });
  const add = document.createElement('button');
  add.type = 'button';
  add.className = 'collection-icon';
  add.setAttribute('aria-label', 'Add ' + product.name + ' to cart');
  add.innerHTML = '<svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" aria-hidden="true"><path d="M3 3h2l3 13h11l2-9H6M10 3v6m-3-3h6"/><circle cx="9" cy="20" r="1"/><circle cx="18" cy="20" r="1"/></svg>';
  const variants = product.variants || [];
  const options = document.createElement('select');
  options.className = 'collection-variants';
  options.hidden = true;
  options.setAttribute('aria-label', 'Size and colour for ' + product.name);
  const placeholder = document.createElement('option');
  placeholder.value = '';
  placeholder.textContent = 'Choose size / colour';
  options.appendChild(placeholder);
  variants.forEach(variant => {
    const option = document.createElement('option');
    option.value = variant.id;
    option.textContent = variant.color + ' / ' + variant.size + (variant.stock > 0 ? '' : ' — unavailable');
    option.disabled = variant.stock < 1;
    options.appendChild(option);
  });
  add.disabled = variants.length ? !variants.some(v => v.stock > 0) : !(product.stock > 0);
  if (add.disabled) add.setAttribute('aria-label', product.name + ' is out of stock');
  add.addEventListener('click', () => {
    const variant = variants.find(v => v.id === options.value);
    if (variants.length && !variant) {
      options.hidden = false;
      options.focus();
      status.textContent = 'Choose a size and colour, then tap the cart icon.';
      return;
    }
    try {
      window.CadeauBag.add(product, variant, 1);
      status.textContent = 'Added to your bag.';
    } catch (error) { status.textContent = error.message; }
  });
  actions.append(like, add);
  gallery.children[0].appendChild(actions);
  card.append(options, status);
  return card;
};
