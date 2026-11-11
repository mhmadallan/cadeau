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
