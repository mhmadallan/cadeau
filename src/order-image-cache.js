// Private process-local cache. Authentication/signature checks run before every lookup.
function createImageCache({maxBytes=32*1024*1024,ttlMs=7*86400000,now=Date.now}={}) {
 const entries=new Map(),pending=new Map();let total=0;
 const remove=key=>{const entry=entries.get(key);if(entry){total-=entry.bytes.length;entries.delete(key);}};
 return async function get(key,build){
  const time=now();for(const [id,entry] of entries)if(entry.expires<=time)remove(id);
  const cached=entries.get(key);
  if(cached){entries.delete(key);entries.set(key,cached);return cached.bytes;}
  if(pending.has(key))return pending.get(key);
  const work=Promise.resolve().then(build).then(bytes=>{
   if(bytes.length<=maxBytes){while(total+bytes.length>maxBytes && entries.size)remove(entries.keys().next().value);entries.set(key,{bytes,expires:now()+ttlMs});total+=bytes.length;}
   return bytes;
  }).finally(()=>pending.delete(key));
  pending.set(key,work);return work;
 };
}
const caches=new WeakMap();
function cacheFor(db){if(!caches.has(db))caches.set(db,createImageCache());return caches.get(db);}
module.exports={createImageCache,cacheFor};
