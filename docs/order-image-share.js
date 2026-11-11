window.showOrderImageShare = function(container, order, api, token) {
 const panel=document.createElement('section'), note=document.createElement('p'), preview=document.createElement('img');
 const share=document.createElement('button'), download=document.createElement('a'), retry=document.createElement('button'), chat=document.createElement('a');
 share.type=retry.type='button';share.textContent='Share order image';retry.textContent='Prepare image';
 share.className=download.className=chat.className='solid';share.disabled=true;download.hidden=true;
 download.textContent='Download order image';chat.textContent='Message admin on WhatsApp';chat.href=order.confirmation_url;chat.target='_blank';chat.rel='noopener noreferrer';
 preview.alt='Your order summary';preview.style.cssText='display:block;max-width:100%;height:auto;margin:16px 0';preview.hidden=true;
 panel.style.cssText='display:flex;flex-direction:column;gap:12px;margin-top:24px';
 panel.append(note,preview,share,download,retry,chat);container.append(panel);
 let file,objectUrl;
 const dispose=()=>{if(objectUrl)URL.revokeObjectURL(objectUrl);};window.addEventListener('pagehide',dispose,{once:true});
 async function prepare(){
  retry.disabled=true;note.textContent='Preparing your order image...';
  try{
   const response=await fetch(api+'/api/orders/'+encodeURIComponent(order.id)+'/image',{headers:{Authorization:'Bearer '+token},signal:AbortSignal.timeout(120000)});
   if(!response.ok){let data={};try{data=await response.json();}catch{}throw new Error(data.error||'Could not prepare image. Please retry.');}
   const blob=await response.blob();dispose();objectUrl=URL.createObjectURL(blob);
   file=new File([blob],'cadeau-order-'+order.id+'.jpg',{type:'image/jpeg'});
   preview.src=download.href=objectUrl;preview.hidden=download.hidden=false;download.download=file.name;
   share.disabled=!(navigator.share && navigator.canShare?.({files:[file]}));
   note.textContent=share.disabled?'Download the image, open the admin chat and attach it manually. Your order is already saved.':'Tap Share order image, choose WhatsApp, select the admin chat and press Send. Your order is already saved.';
   retry.hidden=true;
  }catch(error){note.textContent=error.message+' Your order is saved; do not place it again.';retry.textContent='Retry preparing image';}
  finally{retry.disabled=false;}
 }
 share.onclick=()=>{
  if(!file)return;
  navigator.share({files:[file],title:'Cadeau order '+order.id}).catch(error=>{
   if(error.name!=='AbortError')note.textContent='Sharing is unavailable. Download the image and attach it in the admin WhatsApp chat.';
  });
 };
 retry.onclick=prepare;prepare();
};
