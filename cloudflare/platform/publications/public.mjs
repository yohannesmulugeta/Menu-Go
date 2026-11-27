import {createElement} from 'react';
import {renderToStaticMarkup} from 'react-dom/server';
import {QRCodeSVG} from 'qrcode.react';
import {publishedMenu,assertCurrent,publicURL} from './service.mjs';
import {renderMenu} from '../templates/render.mjs';
import {response,fail} from '../auth/http.mjs';
import {menuSlug} from './links.mjs';

const privateHeaders={'Cache-Control':'no-store, max-age=0','X-Content-Type-Options':'nosniff','X-Robots-Tag':'noindex, nofollow','Referrer-Policy':'no-referrer','X-Frame-Options':'DENY'};
export async function publicMenuRoute(request,env) {
  const url=new URL(request.url);
  const legacyAPI=/^\/api\/restaurants\/([^/]+)\/?$/.exec(url.pathname);
  if(legacyAPI&&env.ENVIRONMENT==='admaki-menu-platform-production'){
    if(!['GET','HEAD'].includes(request.method))return response({error:'Method not allowed.'},405,{Allow:'GET, HEAD'});
    const slug=menuSlug(legacyAPI[1]);if(!slug)fail(404,'Menu not found.');
    const menu=await publishedMenu(env.DB,slug,url.searchParams.get('locale')||'en',env),dto=menu.dto;
    await assertCurrent(env.DB,menu);
    const data={restaurant:{...dto.restaurant,...dto.contact,logo_url:dto.logo_url||null,cover_image_url:dto.cover?.url||null,description:dto.story||null,status:'active'},categories:(dto.categories||[]).map((c,index)=>({...c,sort_order:index,is_active:1})),items:dto.items.map((i,index)=>({...i,sort_order:index,is_available:1,is_popular:i.popular?1:0}))};
    return request.method==='HEAD'?new Response(null,{headers:privateHeaders}):response(data);
  }
  const menuMatch=/^\/r\/([^/]+)(\/qr\.svg)?\/?$/.exec(url.pathname);
  const mediaMatch=/^\/public-media\/([^/]+)\/([a-f0-9-]{36})$/.exec(url.pathname);
  if(!menuMatch&&!mediaMatch)return null;
  if(!['GET','HEAD'].includes(request.method))return response({error:'Method not allowed.'},405,{Allow:'GET, HEAD'});
  const slug=menuSlug((menuMatch||mediaMatch)[1]);
  if(!slug)fail(404,'Menu not found.');
  const menu=await publishedMenu(env.DB,slug,url.searchParams.get('locale')||'en',env);
  if(mediaMatch) {
    const id=mediaMatch[2];
    if(!menu.images.includes(id))fail(404,'Image not found.');
    const media=await env.DB.prepare(`SELECT a.object_key,a.mime_type,a.size_bytes FROM media_assets a
      JOIN media_publication_refs p ON p.media_id=a.id AND p.restaurant_id=a.restaurant_id
      WHERE a.id=? AND a.restaurant_id=? AND p.publication_revision=? AND a.lifecycle='ready' AND a.state!='deleted'`)
      .bind(id,menu.restaurant_id,menu.revision).first();
    if(!media)fail(404,'Image not found.');
    const object=await env.MEDIA.get(media.object_key);
    if(!object)fail(404,'Image not found.');
    await assertCurrent(env.DB,menu);
    return new Response(request.method==='HEAD'?null:object.body,{headers:{...privateHeaders,'Content-Type':media.mime_type,'Content-Length':String(media.size_bytes),'Content-Security-Policy':"default-src 'none'; frame-ancestors 'none'"}});
  }
  if(menuMatch[2]) {
    if(!menu.dto.features['guest.qr_download'])fail(403,'QR download is disabled.');
    const svg=request.method==='HEAD'?null:renderToStaticMarkup(createElement(QRCodeSVG,{xmlns:'http://www.w3.org/2000/svg',value:publicURL(slug,env),size:320,marginSize:4,level:'M',title:'Menu for '+menu.dto.restaurant.name}));
    await assertCurrent(env.DB,menu);
    return new Response(svg,{headers:{...privateHeaders,'Content-Type':'image/svg+xml; charset=utf-8','Content-Disposition':'attachment; filename="menu-'+slug.replace(/[^a-z0-9-]/gi,'-')+'.svg"','Content-Security-Policy':"default-src 'none'; frame-ancestors 'none'"}});
  }
  const nonce=crypto.randomUUID().replaceAll('-','');
  const html=request.method==='HEAD'?null:renderMenu(menu.dto,{nonce,preview:false});
  await assertCurrent(env.DB,menu);
  return new Response(html,{headers:{...privateHeaders,'Content-Type':'text/html; charset=utf-8','Content-Security-Policy':`default-src 'none'; script-src 'nonce-${nonce}'; style-src 'nonce-${nonce}'; img-src 'self' https:; connect-src 'self'; base-uri 'none'; form-action 'self'; frame-ancestors 'none'`}});
}

