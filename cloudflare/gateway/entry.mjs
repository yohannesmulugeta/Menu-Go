// Production edge switch. Legacy workers/assets stay intact for recovery.
export default {
 async fetch(request,env){
  const url=new URL(request.url),path=url.pathname;
  if(!['app.admakidigital.com','menu.admakidigital.com'].includes(url.hostname))return new Response('Not found',{status:404});
  if(path.startsWith('/occasion-assets/')||path==='/preview/occasion'||path==='/preview/occasion/')return env.LEGACY_ROUTER.fetch(request);
  if(['/migrated-media/','/media/','/assets/','/fonts/','/sheba-assets/'].some(prefix=>path.startsWith(prefix)))return env.LEGACY_CORE.fetch(request);
  if(path==='/index.html'){url.pathname='/';return env.PLATFORM.fetch(new Request(url,request));}
  if(path==='/'||path==='/favicon.ico'||/^\/(login|platform|manage(?:\/[^/]+)?|account\/password)\/?$/.test(path)||path.startsWith('/manager')||path.startsWith('/api/')||path.startsWith('/session-api/')||path.startsWith('/r/')||path.startsWith('/public-media/')||/^\/preview\/[^/]+\/?$/.test(path))return env.PLATFORM.fetch(request);
  return new Response('Not found',{status:404,headers:{'Cache-Control':'no-store','X-Content-Type-Options':'nosniff'}});
 }
};
