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
      window.renderProductGallery(document.getElementById('gallery'), { ...product, image_urls: product.image_urls?.length ? product.image_urls : product.images });
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
