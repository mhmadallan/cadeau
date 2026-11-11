const test=require('node:test');const assert=require('node:assert/strict');const sharp=require('sharp');
const {createOrderImageHandler,renderOrderImage}=require('../src/order-image');
const id='11111111-1111-4111-8111-111111111111';
test('order image checks ownership before rendering and disables caching',async()=>{
 for(const authType of ['phone','email']) {
 const filters=[];let rendered=false;
 const db={from(){const q={select(){return q;},eq(k,v){filters.push([k,v]);return q;},maybeSingle:async()=>({data:null})};return q;}};
 const res={headers:{},set(k,v){this.headers[k]=v;return this;},status(code){this.code=code;return this;},json(){return this;}};
 await createOrderImageHandler(db,{render:async()=>{rendered=true;}})({params:{id},authType,user:{id:'owner'}},res);
 assert.deepEqual(filters,[['id',id],[authType==='phone'?'customer_id':'user_id','owner']]);assert.equal(res.code,404);assert.equal(rendered,false);assert.equal(res.headers['Cache-Control'],'no-store');
 }
});
test('private order image returns JPEG with an order header',async()=>{
 const bytes=await sharp({create:{width:50,height:50,channels:3,background:'green'}}).png().toBuffer();
 const result=await renderOrderImage({id,customer_name:'Name & test',customer_phone:'+49123456789',items:[{product_name:'Shirt',quantity:2,image_url:'https://example.com/a'}]},async()=>bytes);
 const metadata=await sharp(result).metadata();assert.equal(metadata.format,'jpeg');assert.equal(metadata.height,600);
});
