const test = require('node:test');
const assert = require('node:assert/strict');
const { validateOrder, createOrderHandler } = require('../src/orders');
const { validateProduct } = require('../src/catalog');
const { formatOrder } = require('../src/telegram');
const id = '12345678-1234-1234-1234-123456789abc';
const body = { request_id:id, items:[{product_id:id,variant_id:'black-s',quantity:2}],customer_name:'Customer',customer_phone:'+49123456789',delivery_address:'Berlin',notes:'' };
test('cart validation preserves variants and rejects duplicate lines and invalid quantities',()=>{
 assert.deepEqual(validateOrder(body).items,body.items);
 assert.throws(()=>validateOrder({...body,items:[...body.items,...body.items]}));
 assert.throws(()=>validateOrder({...body,items:[{...body.items[0],quantity:1.5}]}));
 assert.throws(()=>validateOrder({...body,items:[]}));
});
test('catalog derives stock from variants and rejects duplicate combinations and unsafe images',()=>{
 const product={name:'T-shirt',price:40,variants:[{id:'black-s',color:'Black',size:'S',stock:4}]};
 assert.equal(validateProduct(product).stock,4);
 assert.throws(()=>validateProduct({...product,variants:[...product.variants,{...product.variants[0],id:'other'}]}));
 assert.throws(()=>validateProduct({...product,image_url:'javascript:alert(1)'}));
 assert.throws(()=>validateProduct({...product,price:-1}));
});
test('cart uses the atomic RPC and server-owned order snapshot for notifications',async()=>{
 let rpc,notification;
 const saved={id,total:80,items:[{product_name:'T-shirt',color:'Black',size:'S',quantity:2,total:80}]};
 const db={from(){const q={select(){return q;},eq(){return q;},update(){return q;},maybeSingle:async()=>({data:null}),then(resolve){resolve({});}};return q;},rpc:async(name,args)=>{rpc={name,args};return {data:{created:true,order:saved}};}};
 const res={status(n){this.code=n;return this;},json(value){this.body=value;return this;}};
 await createOrderHandler(db,{getConfig:()=>({provider:'whatsapp'}),notify:async order=>{notification=order;return 'message';}})({body,user:{id},authType:'phone'},res);
 assert.equal(rpc.name,'place_cart_order');assert.equal(rpc.args.p_customer_id,id);assert.equal(rpc.args.p_user_id,null);assert.deepEqual(rpc.args.p_items,body.items);assert.equal(notification,saved);assert.equal(res.code,201);
});
test('notification lists every variant and line quantity',()=>{
 const text=formatOrder({id,items:[{product_name:'T-shirt',color:'Black',size:'S',quantity:2,total:80},{product_name:'Skirt',color:'White',size:'M',quantity:1,total:60}],total:140});
 assert.match(text,/Black \/ S × 2/);assert.match(text,/White \/ M × 1/);assert.match(text,/140.00/);
});

test('bag persists separate variants, combines matching lines, and enforces stock',()=>{
 const fs=require('node:fs'),vm=require('node:vm');const values=new Map();
 const context={window:{},document:{},localStorage:{getItem:k=>values.get(k),setItem:(k,v)=>values.set(k,v)}};
 vm.runInNewContext(fs.readFileSync(require.resolve('../docs/bag.js'),'utf8'),context);
 const bag=context.window.CadeauBag;bag.render=()=>{};bag.dialog={showModal(){}};
 const product={id,name:'T-shirt',price:40,stock:10};
 bag.add(product,{id:'black-s',color:'Black',size:'S',stock:4},2);
 bag.add(product,{id:'white-m',color:'White',size:'M',stock:2},1);
 bag.add(product,{id:'black-s',color:'Black',size:'S',stock:4},1);
 assert.equal(bag.read().length,2);assert.equal(bag.read()[0].quantity,3);assert.equal(bag.read()[1].color,'White');
 assert.throws(()=>bag.add(product,{id:'black-s',stock:4},2));
 const reload={window:{},document:{},localStorage:context.localStorage};vm.runInNewContext(fs.readFileSync(require.resolve('../docs/bag.js'),'utf8'),reload);assert.equal(reload.window.CadeauBag.read()[0].quantity,3);
});
