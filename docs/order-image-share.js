window.showOrderImageShare = function(container, order, api, token) {
 const panel=document.createElement('section'),note=document.createElement('p'),preview=document.createElement('img'),send=document.createElement('button');
 panel.style.cssText='display:flex;flex-direction:column;gap:12px;margin-top:24px';
 preview.alt='Your order summary';preview.style.cssText='display:block;max-width:100%;height:auto;margin:16px 0';preview.hidden=true;
 send.type='button';send.className='solid';
 panel.append(note,preview,send);container.append(panel);
 let objectUrl,ready=false;
 window.addEventListener('pagehide',()=>{if(objectUrl)URL.revokeObjectURL(objectUrl);},{once:true});
 async function prepare(){
  send.disabled=true;send.textContent='Preparing order image...';note.textContent='Your order is saved. Preparing its image before opening WhatsApp...';
  try{
   const response=await fetch(api+'/api/orders/'+encodeURIComponent(order.id)+'/image',{headers:{Authorization:'Bearer '+token},signal:AbortSignal.timeout(120000)});
   if(!response.ok)throw new Error('Preview unavailable');
   const blob=await response.blob();
   if(objectUrl)URL.revokeObjectURL(objectUrl);objectUrl=URL.createObjectURL(blob);
   preview.src=objectUrl;preview.hidden=false;ready=true;
   send.textContent='Send order on WhatsApp';
   note.textContent='Your order image is ready. Open WhatsApp and press Send. The private image link is valid for 7 days.';
  }catch{
   ready=false;send.textContent='Retry preparing image';note.textContent='Your order is saved, but its image could not be prepared. Retry here; do not place another order.';
  }finally{send.disabled=false;}
 }
 send.onclick=()=>{if(ready)window.location.assign(order.confirmation_url);else prepare();};
 prepare();
};
