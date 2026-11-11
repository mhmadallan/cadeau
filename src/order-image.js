const { cacheFor } = require('./order-image-cache');
const { verifyImageShare } = require('./order-share-link');
const sharp = require('sharp');
const { buildCollage, download } = require('./order-collage');
const uuid=/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const escape=value=>String(value).replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&apos;'}[c]));
async function renderOrderImage(order, load) {
 const items=order.items?.length?order.items:[{...order,image_url:order.product_image_url}];
 const collage=await buildCollage(items,load);const {width,height}=await sharp(collage).metadata();
 const lines=['CADEAU - Order summary', 'Order: '+order.id, 'Customer: '+order.customer_name, 'Phone: '+order.customer_phone];
 const header=Buffer.from('<svg width="'+width+'" height="140"><rect width="100%" height="100%" fill="white"/>'+lines.map((text,i)=>'<text x="12" y="'+(26+i*30)+'" font-family="sans-serif" font-size="'+(i===1?13:18)+'">'+escape(String(text).slice(0,80))+'</text>').join('')+'</svg>');
 const bytes=await sharp({create:{width,height:height+140,channels:3,background:'white'}}).composite([{input:header,left:0,top:0},{input:collage,left:0,top:140}]).jpeg({quality:80}).toBuffer();
 if(bytes.length>5*1024*1024) throw new Error('Order image too large');
 return bytes;
}
function createOrderImageHandler(db,{render=renderOrderImage,fetchImpl=fetch,env=process.env,shared=false}={}) {
 return async(req,res)=>{
  res.set('Cache-Control','no-store');
  res.set('Referrer-Policy','no-referrer');res.set('X-Robots-Tag','noindex, nofollow, noarchive');
  const id=shared ? verifyImageShare(req.params.token,env) : req.params.id;
  if(!uuid.test(id || ''))return res.status(404).json({error:'Order not found.'});
  let query=db.from('orders').select('*').eq('id',id);
  if(!shared)query=query.eq(req.authType==='phone'?'customer_id':'user_id',req.user.id);
  const {data:order,error}=await query.maybeSingle();
  if(error)return res.status(503).json({error:'Could not load your order.'});
  if(!order)return res.status(404).json({error:'Order not found.'});
  try {
   if(!order.items?.length && order.product_id){const p=await db.from('products').select('image_url').eq('id',order.product_id).maybeSingle();if(p.error)throw new Error('Image lookup failed');order.product_image_url=p.data?.image_url;}
   const bytes=await cacheFor(db)(order.id,()=>render(order,url=>download(url,fetchImpl,env)));
   return res.type('image/jpeg').set('Content-Disposition','inline; filename="cadeau-order-'+order.id+'.jpg"').send(bytes);
  }catch{return res.status(503).json({error:'Your order is saved, but its image could not be prepared. Retry the image or message the store directly.'});}
 };
}
module.exports={createOrderImageHandler,renderOrderImage};
