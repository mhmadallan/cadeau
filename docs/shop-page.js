(async () => {
  const api = (window.APP_CONFIG.API_BASE_URL || 'http://localhost:4000').replace(/\/+$/,'');
  const status = document.getElementById('pageStatus'), content = document.getElementById('pageContent');
  try {
    let { SUPABASE_URL: url, SUPABASE_ANON_KEY: key } = window.APP_CONFIG;
    if (!url || !key) { const r = await fetch(api + '/api/config'); if (!r.ok) throw new Error('Could not connect to the store.'); const c = await r.json(); url = c.supabaseUrl; key = c.supabaseAnonKey; }
    const auth = window.ShopSession.wrap(window.supabase.createClient(url,key),api);
    const session = (await auth.auth.getSession()).data.session;
    if (!session) return window.location.replace('signin.html');
    const request = async (path, options = {}) => { const r = await fetch(api + '/api/' + path, { ...options, headers: { 'Content-Type':'application/json', Authorization: 'Bearer ' + session.access_token }, signal: AbortSignal.timeout(30000) }); if (r.status === 401) { content.hidden = true; window.location.replace('signin.html'); throw new Error('Please sign in again.'); } const data = await r.json(); if (!r.ok) throw new Error(data.error || 'Please try again.'); return data; };
    await request('me');
    auth.auth.onAuthStateChange((event, current) => { if (!current) { content.hidden = true; window.location.replace('signin.html'); } });
    if (document.body.dataset.page === 'product') {
      const id = new URLSearchParams(window.location.search).get('id');
      if (!id) throw new Error('Choose a product from the collection.');
      const product = await request('products/' + encodeURIComponent(id));
      document.title = product.name + ' — Cadeau';
      document.getElementById('productName').textContent = product.name;
      document.getElementById('productCollection').textContent = product.collection || 'The Cadeau edit';
      document.getElementById('productDescription').textContent = product.description || '';
      document.getElementById('productPrice').textContent = '$' + Number(product.price).toFixed(2);
      [...new Set([product.image_url,...(product.images || [])].filter(Boolean))].forEach(src => { const image = document.createElement('img'); image.src = src; image.alt = product.name; document.getElementById('gallery').append(image); });
      const variants = product.variants || []; let color = variants[0]?.color || '', size = '';
      const colors = document.getElementById('colors'), sizes = document.getElementById('sizes'), availability = document.getElementById('availability'), add = document.getElementById('addToBag'), quantity = document.getElementById('quantity');
      const selected = () => variants.find(v => v.color === color && v.size === size);
      const update = () => {
        const stock = variants.length ? (selected()?.stock || 0) : product.stock;
        add.disabled = !stock; quantity.max = Math.min(99,stock || 1);
        availability.textContent = variants.length && !size ? 'Select your size.' : stock > 0 ? `${stock} available` : 'Currently unavailable';
      };
      const drawSizes = () => { sizes.replaceChildren(); [...new Set(variants.map(v => v.size))].forEach(value => { const v = variants.find(v => v.color === color && v.size === value); const b = document.createElement('button'); b.className='option'; b.textContent=value; b.disabled=!v?.stock; b.setAttribute('aria-pressed',String(size === value)); b.onclick=() => { size=value; drawSizes(); update(); }; sizes.append(b); }); };
      const drawColors = () => { colors.replaceChildren(); [...new Set(variants.map(v => v.color))].forEach(value => { const b=document.createElement('button'); b.className='option'; b.textContent=value; b.setAttribute('aria-pressed',String(color===value)); b.onclick=() => { color=value; size=''; drawColors(); drawSizes(); update(); }; colors.append(b); }); };
      if (!variants.length) document.getElementById('variantSelectors').hidden=true;
      drawColors(); drawSizes(); update();
      add.onclick=() => { try { const n=Number(quantity.value); if (!Number.isInteger(n)||n<1||n>99) throw new Error('Choose a quantity from 1 to 99.'); window.CadeauBag.add(product,selected(),n); } catch(e) { availability.textContent=e.message; } };
      const related = (await request('products')).filter(p => p.id !== product.id).sort((a,b) => Number(b.collection === product.collection)-Number(a.collection === product.collection)).slice(0,4);
      related.forEach(p => { const card=document.createElement('a'); card.className='product-card'; card.href='product.html?id='+encodeURIComponent(p.id); const image=document.createElement('img'); image.src=p.image_url || ''; image.alt=p.name; image.loading='lazy'; const photo=document.createElement('div'); photo.className='photo'; photo.append(image); const name=document.createElement('h3'); name.textContent=p.name; const price=document.createElement('p'); price.textContent='$'+Number(p.price).toFixed(2); card.append(photo,name,price); document.getElementById('related').append(card); });
    } else {
      const form = document.getElementById('checkoutForm'), summary = document.getElementById('summary');
      let requestId = sessionStorage.getItem('cadeau-order-request');
      const snapshot = JSON.stringify(window.CadeauBag.read().map(i => ({product_id:i.product_id,variant_id:i.variant_id,quantity:i.quantity})));
      if (!requestId || sessionStorage.getItem('cadeau-order-cart') !== snapshot) { requestId=crypto.randomUUID(); sessionStorage.setItem('cadeau-order-request',requestId); sessionStorage.setItem('cadeau-order-cart',snapshot); }
      const items = window.CadeauBag.read();
      if (!items.length) { form.hidden=true; summary.textContent='Your bag is empty. Discover the collection to get started.'; }
      items.forEach(i => { const p=document.createElement('p'); p.textContent=`${i.name} · ${[i.color,i.size].filter(Boolean).join(' / ')} × ${i.quantity} — $${(i.price*i.quantity).toFixed(2)}`; summary.append(p); });
      const total=document.createElement('h3'); total.textContent='Subtotal $'+items.reduce((n,i)=>n+i.price*i.quantity,0).toFixed(2); if(items.length) summary.append(total);
      form.onsubmit=async e => { e.preventDefault(); const button=form.querySelector('button'); button.disabled=true; status.textContent='Confirming your order…';
        try { const body=Object.fromEntries(new FormData(form)); body.request_id=requestId; body.items=JSON.parse(snapshot); const order=await request('orders',{method:'POST',body:JSON.stringify(body)}); window.CadeauBag.save([]); sessionStorage.removeItem('cadeau-order-request'); sessionStorage.removeItem('cadeau-order-cart'); form.hidden=true; status.textContent=`Thank you. Your order ${order.id} is confirmed. Total: $${Number(order.total).toFixed(2)}. ${order.notification_status === 'accepted' ? 'We’ll contact you to arrange payment and delivery.' : 'Your order is saved. The store can review it in the dashboard.'}`; }
        catch(e) { status.textContent=e.message; button.disabled=false; }
      };
    }
    content.hidden=false; status.textContent='';
  } catch(e) { status.textContent=e.message; }
})();
