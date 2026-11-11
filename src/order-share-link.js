const {createHmac,timingSafeEqual}=require('node:crypto');
function signature(value,key){return createHmac('sha256',key).update('cadeau-order-image:'+value).digest('base64url');}
function imageShareLink(id,env=process.env,now=Date.now()){
 const key=env.ORDER_SHARE_SECRET || env.SUPABASE_SERVICE_ROLE_KEY;
 if(!key)throw new Error('Order sharing is not configured');
 const value=Buffer.from(JSON.stringify({id,expires:Math.floor(now/1000)+7*86400})).toString('base64url');
 const base=new URL(env.PUBLIC_API_URL || 'https://cadeau-hbmt.onrender.com');
 if(base.protocol!=='https:')throw new Error('Order sharing requires HTTPS');
 return new URL('/order-image/'+value+'.'+signature(value,key),base).href;
}
function verifyImageShare(token,env=process.env,now=Date.now()){
 try{
  const key=env.ORDER_SHARE_SECRET || env.SUPABASE_SERVICE_ROLE_KEY;
  if(!key || typeof token!=='string' || token.length>1024)return null;
  const parts=token.split('.');if(parts.length!==2)return null;
  const expected=Buffer.from(signature(parts[0],key)),actual=Buffer.from(parts[1]);
  if(expected.length!==actual.length || !timingSafeEqual(expected,actual))return null;
  const data=JSON.parse(Buffer.from(parts[0],'base64url').toString());
  if(!/^[0-9a-f-]{36}$/i.test(data.id)||!Number.isInteger(data.expires)||data.expires<=now/1000)return null;
  return data.id;
 }catch{return null;}
}
module.exports={imageShareLink,verifyImageShare};
