window.loadAdminOrders = async function(page=0) {
  const list=document.getElementById('adminOrders'), status=document.getElementById('ordersStatus'); status.textContent='Loading orders…';
  try {
    const response=await fetch(`${apiBaseUrl}/api/admin/orders?page=${page}`,{headers:{Authorization:`Bearer ${accessToken}`}});const orders=await response.json();if(!response.ok)throw new Error(orders.error);
    list.replaceChildren();
    orders.forEach(order=>{
      const article=document.createElement('article');article.className='border-b py-4';
      const heading=document.createElement('h3');heading.textContent=`${order.customer_name} · $${Number(order.total).toFixed(2)} · ${new Date(order.created_at).toLocaleString()}`;
      const id=document.createElement('p');id.textContent=`${order.id} · Notification: ${order.notification_status}`;
      const details=document.createElement('p');details.textContent=[order.customer_phone,order.delivery_address,order.notes].filter(Boolean).join(' · ');
      const lines=document.createElement('div');(order.items?.length?order.items:[order]).forEach(i=>{const p=document.createElement('p');p.textContent=`${i.product_name} / ${i.color||'Standard'} / ${i.size||'One size'} × ${i.quantity} — $${Number(i.total).toFixed(2)}`;lines.append(p);});
      const select=document.createElement('select');select.setAttribute('aria-label','Order status');['new','confirmed','dispatched','completed','cancelled'].forEach(s=>{const option=document.createElement('option');option.value=s;option.textContent=s;option.selected=s===(order.status||'new');select.append(option);});
      select.onchange=async()=>{select.disabled=true;try{const r=await fetch(`${apiBaseUrl}/api/admin/orders/${order.id}`,{method:'PATCH',headers:{Authorization:`Bearer ${accessToken}`,'Content-Type':'application/json'},body:JSON.stringify({status:select.value})});if(!r.ok)throw new Error('Could not save status.');status.textContent='Status saved. Cancellation does not automatically restock items.';}catch(e){status.textContent=e.message;select.value=order.status||'new';}finally{select.disabled=false;}};
      article.append(heading,id,details,lines,select);list.append(article);
    });status.textContent=orders.length?'':'No orders yet.';
    document.getElementById('ordersPrevious').disabled=page===0;document.getElementById('ordersNext').disabled=orders.length<50;
    document.getElementById('ordersPrevious').onclick=()=>window.loadAdminOrders(page-1);document.getElementById('ordersNext').onclick=()=>window.loadAdminOrders(page+1);
  }catch(e){status.textContent=e.message;}
};
document.getElementById('refreshOrders').onclick=()=>window.loadAdminOrders();
