const {verifyImageShare}=require('./order-share-link');
const escape=value=>String(value).replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
function createOrderPreview(db,env=process.env){
 return async(req,res)=>{
  res.set('Cache-Control','no-store');res.set('Referrer-Policy','no-referrer');res.set('X-Robots-Tag','noindex, nofollow, noarchive');
  const id=verifyImageShare(req.params.token,env);
  if(!id)return res.status(404).send('This order link is invalid or has expired.');
  const {data,error}=await db.from('orders').select('id,items').eq('id',id).maybeSingle();
  if(error)return res.status(503).send('The order preview is temporarily unavailable. Please try again.');
  if(!data)return res.status(404).send('Order not found.');
  const base=env.PUBLIC_API_URL || 'https://cadeau-hbmt.onrender.com';
  const image=new URL('/order-image/'+req.params.token,base).href;
  const page=new URL('/order-preview/'+req.params.token,base).href;
  const count=data.items?.length || 1,width=Math.min(3,count)*400,height=Math.ceil(count/Math.min(3,count))*460+140;
  const title='Cadeau order '+id;
  return res.type('html').send('<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>'+escape(title)+'</title><meta property="og:type" content="website"><meta property="og:site_name" content="Cadeau"><meta property="og:title" content="'+escape(title)+'"><meta property="og:description" content="View the ordered items, product photos and quantities."><meta property="og:url" content="'+escape(page)+'"><meta property="og:image" content="'+escape(image)+'"><meta property="og:image:type" content="image/jpeg"><meta property="og:image:width" content="'+width+'"><meta property="og:image:height" content="'+height+'"><meta property="og:image:alt" content="Order summary with product photos and quantities"><meta name="twitter:card" content="summary_large_image"></head><body style="margin:0;background:#f6f3ed;color:#242923;font-family:system-ui;text-align:center"><main style="max-width:1200px;margin:32px auto;padding:16px"><h1>Your Cadeau order</h1><p>Order reference: '+escape(id)+'</p><img src="'+escape(image)+'" alt="Order summary with product photos and quantities" style="display:block;width:100%;height:auto;background:white"><p>This private link expires seven days after it was created.</p></main></body></html>');
 };
}
module.exports={createOrderPreview};
