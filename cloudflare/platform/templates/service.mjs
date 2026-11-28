import {configRoute} from '../config/service.mjs';
import {renderMenu} from './render.mjs';
export async function previewRoute(request,env){
 const url=new URL(request.url),match=/^\/preview\/([^/]+)\/?$/.exec(url.pathname);if(!match)return null;
 if(!['GET','HEAD'].includes(request.method))return new Response(null,{status:405,headers:{Allow:'GET, HEAD','Cache-Control':'private, no-store','X-Robots-Tag':'noindex, nofollow'}});
 const dataURL=new URL('/api/restaurants/'+match[1]+'/preview-data',url);dataURL.search=url.search;
 const data=await configRoute(new Request(dataURL,{headers:request.headers}),env);if(!data.ok)return data;
 const dto=await data.json(),nonce=crypto.randomUUID().replaceAll('-','');
 return new Response(request.method==='HEAD'?null:renderMenu(dto,{nonce}),{headers:{'Content-Type':'text/html; charset=utf-8','Cache-Control':'private, no-store','X-Robots-Tag':'noindex, nofollow','X-Content-Type-Options':'nosniff','Referrer-Policy':'no-referrer','X-Frame-Options':'DENY','Content-Security-Policy':`default-src 'none'; script-src 'nonce-${nonce}'; style-src 'nonce-${nonce}'; img-src 'self' https:; connect-src 'self'; base-uri 'none'; form-action 'self'; frame-ancestors 'none'`}});
}
