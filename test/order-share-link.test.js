const test=require('node:test');const assert=require('node:assert/strict');
const {imageShareLink,verifyImageShare}=require('../src/order-share-link');
const {createOrderImageHandler}=require('../src/order-image');
const id='11111111-1111-4111-8111-111111111111',env={ORDER_SHARE_SECRET:'test-secret'};
test('signed image links reject edits, expiry and wrong secrets',()=>{
 const token=new URL(imageShareLink(id,env,100000)).pathname.split('/').pop();
 assert.equal(verifyImageShare(token,env,101000),id);
 assert.equal(verifyImageShare(token+'x',env,101000),null);
 assert.equal(verifyImageShare(token,{ORDER_SHARE_SECRET:'other'},101000),null);
 assert.equal(verifyImageShare(token,env,100000+7*86400000),null);
});
test('public image requires a valid signature before database access',async()=>{
 const db={from:()=>assert.fail('Invalid token must not query database')};
 const res={set(){return this;},status(code){this.code=code;return this;},json(){return this;}};
 await createOrderImageHandler(db,{shared:true,env})({params:{token:'invalid'}},res);assert.equal(res.code,404);
});

const {createOrderPreview}=require('../src/order-preview');
test('preview includes the signed JPEG metadata without exposing customer details',async()=>{
 const url=new URL(imageShareLink(id,env)), token=url.pathname.split('/').pop();assert.ok(url.pathname.startsWith('/order-preview/'));
 const db={from(){const q={select(fields){assert.equal(fields,'id,items');return q;},eq(){return q;},maybeSingle:async()=>({data:{id,items:[{},{}]}})};return q;}};
 const res={headers:{},set(k,v){this.headers[k]=v;return this;},type(){return this;},send(body){this.body=body;return this;}};
 await createOrderPreview(db,env)({params:{token}},res);
 assert.ok(res.body.includes('property="og:image" content="https://cadeau-hbmt.onrender.com/order-image/'+token+'"'));
 assert.ok(res.body.includes('property="og:image:width" content="800"'));assert.ok(res.body.includes('height" content="600"'));
 assert.equal(res.headers['Cache-Control'],'no-store');
});
test('expired preview links do not query the database',async()=>{
 const token=new URL(imageShareLink(id,env,0)).pathname.split('/').pop();
 const db={from:()=>assert.fail('Expired preview must not load order')};
 const res={set(){return this;},status(code){this.code=code;return this;},send(){return this;}};
 await createOrderPreview(db,env)({params:{token}},res);assert.equal(res.code,404);
});
