window.showOrderImageShare = function(container, order, api, token) {
 const panel=document.createElement('section'),note=document.createElement('p'),preview=document.createElement('img'),send=document.createElement('a');
 panel.style.cssText='display:flex;flex-direction:column;gap:12px;margin-top:24px';
 note.textContent='Your order is saved. Open WhatsApp below and press Send. The message includes a private link to your order image, valid for 7 days.';
 preview.alt='Your order summary';preview.style.cssText='display:block;max-width:100%;height:auto;margin:16px 0';preview.hidden=true;
 send.textContent='Send order on WhatsApp';send.className='solid';send.href=order.confirmation_url;send.target='_blank';send.rel='noopener noreferrer';
 panel.append(note,preview,send);container.append(panel);
 let objectUrl;
 window.addEventListener('pagehide',()=>{if(objectUrl)URL.revokeObjectURL(objectUrl);},{once:true});
 fetch(api+'/api/orders/'+encodeURIComponent(order.id)+'/image',{headers:{Authorization:'Bearer '+token},signal:AbortSignal.timeout(120000)})
 .then(async response=>{if(!response.ok)throw new Error('Preview unavailable');return response.blob();})
 .then(blob=>{objectUrl=URL.createObjectURL(blob);preview.src=objectUrl;preview.hidden=false;})
 .catch(()=>{note.textContent='Your order is saved, but the image preview could not load. You can still send the order reference and image link to the admin below.';});
};
