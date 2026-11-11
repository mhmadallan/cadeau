const sharp = require('sharp');
const LIMIT = 5 * 1024 * 1024;
function imageUrl(value, env = process.env) {
  const url = new URL(value);
  const hosts = new Set(['images.unsplash.com', ...(env.COLLAGE_IMAGE_HOSTS || '').split(',').map(x=>x.trim()).filter(Boolean)]);
  if (env.SUPABASE_URL) hosts.add(new URL(env.SUPABASE_URL).hostname);
  if (url.protocol !== 'https:' || url.username || url.password || (url.port && url.port !== '443') || !hosts.has(url.hostname)) throw new Error('Product image host is not enabled for collages');
  return url.href;
}
async function download(value, fetchImpl, env) {
  const response = await fetchImpl(imageUrl(value,env), {redirect:'error',signal:AbortSignal.timeout(10000)});
  if (!response.ok || Number(response.headers.get('content-length')) > LIMIT) throw new Error('Product image download failed');
  const chunks=[]; let length=0;
  for await (const chunk of response.body) {
    length+=chunk.length;
    if(length>LIMIT) { await response.body.cancel?.().catch(()=>{}); throw new Error('Product image exceeds 5 MB'); }
    chunks.push(chunk);
  }
  return Buffer.concat(chunks);
}
const escape = value => String(value).replace(/[&<>"']/g, c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&apos;'}[c]));
async function buildCollage(items, load) {
  if(!items.length || items.length>30) throw new Error('Invalid collage item count');
  const columns=Math.min(3,items.length), width=columns*400, height=Math.ceil(items.length/columns)*460;
  const layers=[];
  for(let index=0;index<items.length;index++) {
    const item=items[index], left=(index%columns)*400, top=Math.floor(index/columns)*460;
    const bytes=await load(item.image_url);
    const photo=await sharp(bytes,{limitInputPixels:25000000}).rotate().resize(380,350,{fit:'contain',background:'#ffffff'}).flatten({background:'#ffffff'}).jpeg().toBuffer();
    layers.push({input:photo,left:left+10,top:top+10});
    const label=[(index+1)+'. '+item.product_name, [item.color,item.size].filter(Boolean).join(' / '), 'Quantity: '+item.quantity];
    const svg='<svg width="400" height="90"><rect width="400" height="90" fill="white"/>'+label.map((line,i)=>'<text x="12" y="'+(22+i*25)+'" font-family="sans-serif" font-size="18">'+escape(String(line).slice(0,36))+'</text>').join('')+'</svg>';
    layers.push({input:Buffer.from(svg),left,top:top+365});
  }
  const output=await sharp({create:{width,height,channels:3,background:'#ffffff'}}).composite(layers).jpeg({quality:80}).toBuffer();
  if(output.length>LIMIT) throw new Error('Collage exceeds WhatsApp image size');
  return output;
}
async function uploadCollage(order, config, fetchImpl=fetch, env=process.env) {
  const items=order.items?.length ? order.items : [{...order,image_url:order.product_image_url}];
  const bytes=await buildCollage(items,url=>download(url,fetchImpl,env));
  const form=new FormData();form.set('messaging_product','whatsapp');form.set('file',new Blob([bytes],{type:'image/jpeg'}),'order.jpg');
  const response=await fetchImpl('https://graph.facebook.com/'+config.version+'/'+config.phoneId+'/media',{method:'POST',headers:{Authorization:'Bearer '+config.token},body:form,signal:AbortSignal.timeout(15000)});
  const data=await response.json();
  if(!response.ok || !data.id) { const error=new Error('Collage upload failed'); error.httpStatus=response.status;error.providerCode=data.error?.code;throw error; }
  return data.id;
}
module.exports={buildCollage,uploadCollage,imageUrl,download};
