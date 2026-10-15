const test = require('node:test');
const assert = require('node:assert/strict');
const {createProductShare,productShareUrl} = require('../src/product-share');
const id='11111111-1111-4111-8111-111111111111';
async function request(data,error=null) {
 const db={from(){return {select(fields){assert.equal(fields,'id,name,image_url,visible');return this;},eq(){return this;},async maybeSingle(){return {data,error};}};}};
 const res={code:200,status(n){this.code=n;return this;},set(){return this;},type(){return this;},send(body){this.body=body;return this;}};
 await createProductShare(db,{})({params:{id}},res);return res;
}
test('preview exposes escaped name and image with collection destination, no private details',async()=>{
 const res=await request({id,name:'<script> & "shirt"',image_url:'https://example.com/image.jpg',visible:true,price:123,stock:10});
 assert.equal(res.code,200);assert.match(res.body,/property="og:image" content="https:\/\/example.com\/image.jpg"/);
 assert.ok(res.body.includes('#product-'+id));assert.ok(res.body.includes('&lt;script&gt;'));assert.ok(!res.body.includes('<script>'));assert.ok(!res.body.includes('123'));
});
test('hidden and missing products have no preview; failures return unavailable',async()=>{
 assert.equal((await request({id,visible:false})).code,404);
 assert.equal((await request(null)).code,404);
 assert.equal((await request(null,{})).code,503);
 assert.equal(productShareUrl('../x'),null);
});
