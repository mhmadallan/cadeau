const test=require('node:test');
const assert=require('node:assert/strict');
const sharp=require('sharp');
const {buildCollage,imageUrl}=require('../src/order-collage');
const {sendOrderNotification,getWhatsAppConfig}=require('../src/whatsapp');
const items=[{product_name:'Shirt <blue>',color:'Blue',size:'M',quantity:2,image_url:'https://images.unsplash.com/a',unit_price:10,total:20},{product_name:'Pants',quantity:1,image_url:'https://images.unsplash.com/b',unit_price:20,total:20}];
async function photo(){return sharp({create:{width:100,height:100,channels:3,background:'blue'}}).png().toBuffer();}
test('collage produces one JPEG grid and rejects invalid input',async()=>{
 const bytes=await photo();const image=await buildCollage(items,async()=>bytes);const meta=await sharp(image).metadata();
 assert.equal(meta.format,'jpeg');assert.equal(meta.width,800);assert.equal(meta.height,460);assert.ok(image.length<5*1024*1024);
 await assert.rejects(buildCollage([],async()=>bytes));await assert.rejects(buildCollage(items,async()=>Buffer.from('bad')));
 assert.throws(()=>imageUrl('http://images.unsplash.com/a',{}));assert.throws(()=>imageUrl('https://localhost/a',{}));assert.throws(()=>imageUrl('https://images.unsplash.com.evil.test/a',{}));
});
test('collage uploads once and sends one template retaining complete order details',async()=>{
 const bytes=await photo();let uploads=0,sends=0;
 const result=await sendOrderNotification({id:'order-1',items,total:40,customer_name:'Customer',customer_phone:'+49123456789',delivery_address:'Berlin',notes:'Test'}, {collage:true,perItem:true,headerType:'image',template:'order_image',language:'en',phoneId:'123',version:'v99.0',token:'fake',recipient:'49123456789'},async(url,options)=>{
 if(url.includes('images.unsplash.com')) {assert.equal(options.redirect,'error');return new Response(bytes);}
 if(url.endsWith('/media')) {uploads++;assert.equal(options.body.get('file').type,'image/jpeg');return {ok:true,json:async()=>({id:'media-1'})};}
 sends++;const template=JSON.parse(options.body).template;
 assert.deepEqual(template.components[0].parameters[0].image,{id:'media-1'});
 const values=template.components[1].parameters.map(p=>p.text);
 assert.equal(values[0],'order-1');assert.match(values[1],/Shirt/);assert.match(values[1],/Pants/);assert.equal(values[5],'Customer');assert.equal(values[7],'Berlin');
 return {ok:true,json:async()=>({messages:[{id:'sent-1'}]})};
 });
 assert.equal(result,'sent-1');assert.equal(uploads,1);assert.equal(sends,1);
});
