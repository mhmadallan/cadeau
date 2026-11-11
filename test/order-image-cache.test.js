const test=require('node:test');const assert=require('node:assert/strict');
const {createImageCache}=require('../src/order-image-cache');
test('cache coalesces renders, expires and evicts to its byte budget',async()=>{
 let time=0,calls=0;const cache=createImageCache({maxBytes:4,ttlMs:10,now:()=>time});
 const build=async()=>{calls++;return Buffer.from('abc');};
 await Promise.all([cache('one',build),cache('one',build)]);assert.equal(calls,1);
 await cache('one',build);assert.equal(calls,1);
 await cache('two',build);await cache('one',build);assert.equal(calls,3);
 time=11;await cache('one',build);assert.equal(calls,4);
});
test('failed rendering is retryable',async()=>{
 const cache=createImageCache();await assert.rejects(cache('x',async()=>{throw new Error('failed');}));
 assert.equal((await cache('x',async()=>Buffer.from('ok'))).toString(),'ok');
});
test('WhatsApp button waits for the image and retries failures without a new order',async()=>{
 const vm=require('node:vm'),fs=require('node:fs');
 const element=()=>({children:[],style:{},append(...children){this.children.push(...children);}});
 let reject,resolve;const requests=[],destinations=[];
 const context={document:{createElement:element},AbortSignal,URL:{createObjectURL:()=> 'blob:test',revokeObjectURL(){}},window:{addEventListener(){},location:{assign:url=>destinations.push(url)}},fetch:(url)=>{requests.push(url);return new Promise((yes,no)=>{resolve=yes;reject=no;});}};
 vm.runInNewContext(fs.readFileSync(require.resolve('../docs/order-image-share.js'),'utf8'),context);
 const root=element();context.window.showOrderImageShare(root,{id:'order',confirmation_url:'https://wa.me/123'},'https://api.test','token');
 const [note,preview,button]=root.children[0].children;
 assert.equal(button.disabled,true);assert.equal(destinations.length,0);
 reject(new Error('network'));await new Promise(setImmediate);assert.equal(button.disabled,false);assert.equal(button.textContent,'Retry preparing image');
 button.onclick();assert.equal(button.disabled,true);assert.equal(requests.length,2);
 resolve({ok:true,blob:async()=>({})});await new Promise(setImmediate);
 assert.equal(button.disabled,false);assert.equal(preview.hidden,false);button.onclick();assert.deepEqual(destinations,['https://wa.me/123']);
});
