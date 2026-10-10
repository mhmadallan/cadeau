window.CadeauBag = {
  key: 'cadeau-bag-v1',
  read() { try { const data = JSON.parse(localStorage.getItem(this.key) || '[]'); return Array.isArray(data) ? data.filter(i => typeof i.product_id === 'string' && typeof i.variant_id === 'string' && Number.isInteger(i.quantity) && i.quantity > 0 && i.quantity <= 99 && Number.isFinite(i.price)) : []; } catch { return []; } },
  save(items) { localStorage.setItem(this.key, JSON.stringify(items)); this.render(); },
  add(product, variant, quantity) {
    const items = this.read(), id = variant?.id || '', item = items.find(i => i.product_id === product.id && i.variant_id === id), stock = variant ? variant.stock : product.stock;
    if (quantity + (item?.quantity || 0) > Math.min(99, stock)) throw new Error('This quantity exceeds available stock.');
    if (item) item.quantity += quantity;
    else items.push({ product_id: product.id, variant_id: id, name: product.name, color: variant?.color || '', size: variant?.size || '', price: Number(product.price), image: product.image_url || '', quantity });
    this.save(items); this.dialog.showModal();
  },
  render() {
    const items = this.read(); document.querySelectorAll('[data-bag-count]').forEach(el => el.textContent = items.reduce((n,i) => n + i.quantity,0));
    this.lines.replaceChildren();
    items.forEach((item,index) => {
      const row = document.createElement('div'); row.className = 'bag-line';
      const img = document.createElement('img'); img.src = item.image; img.alt = item.name;
      const info = document.createElement('div'); const name = document.createElement('h3'); name.textContent = item.name;
      const variant = document.createElement('p'); variant.textContent = [item.color,item.size].filter(Boolean).join(' / ') || 'Standard';
      const price = document.createElement('p'); price.textContent = `$${(item.price * item.quantity).toFixed(2)}`;
      const qty = document.createElement('input'); qty.type = 'number'; qty.min = 1; qty.max = 99; qty.value = item.quantity; qty.setAttribute('aria-label', 'Quantity for ' + item.name);
      qty.onchange = () => { const n = Number(qty.value); if (!Number.isInteger(n) || n < 1 || n > 99) { qty.value = item.quantity; return; } const current = this.read(); if (current[index]) { current[index].quantity = n; this.save(current); } };
      const remove = document.createElement('button'); remove.textContent = 'Remove'; remove.onclick = () => this.save(this.read().filter((_,n) => n !== index));
      info.append(name,variant,price,qty,remove); row.append(img,info); this.lines.append(row);
    });
    if (!items.length) this.lines.textContent = 'Your bag is waiting for something lovely.';
    this.total.textContent = `$${items.reduce((n,i) => n+i.price*i.quantity,0).toFixed(2)}`;
    this.checkout.hidden = !items.length;
  },
  init() {
    const dialog = document.createElement('dialog'); dialog.className = 'drawer'; dialog.setAttribute('aria-label','Shopping bag');
    dialog.innerHTML = '<div class="drawer-head"><h2>Your bag</h2><button aria-label="Close bag">×</button></div><div data-lines></div><div class="total"><span>Subtotal</span><span data-total></span></div><p class="muted">Payment and delivery arranged personally after confirmation.</p><a class="solid" style="display:block" href="checkout.html">Continue to checkout ↗</a>';
    document.body.append(dialog); this.dialog = dialog; this.lines = dialog.querySelector('[data-lines]'); this.total = dialog.querySelector('[data-total]'); this.checkout = dialog.querySelector('a');
    dialog.querySelector('button').onclick = () => dialog.close();
    document.querySelectorAll('[data-open-bag]').forEach(b => b.onclick = () => { this.render(); dialog.showModal(); });
    window.addEventListener('storage', () => this.render()); this.render();
  }
};
if (typeof document.querySelectorAll === 'function') window.CadeauBag.init();
