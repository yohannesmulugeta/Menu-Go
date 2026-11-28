import {OCCASION_INTERIOR_BASE64} from "./occasion-interior.js";
import {OCCASION_COVER_BASE64} from "./occasion-cover.js";
import {OCCASION_ABOL_CSS,OCCASION_ABOL_SCRIPT} from "./occasion-branding.js";
import {createApp} from "./worker.js";
import {createApp as createManagerCore} from "./legacy-worker.js";
import {hasManagerCookie,managerSession,managerIdentity,managerAuthRoute,json} from "./manager-auth.js";
import {managerPage,managerHeaders} from "./manager-pages.js";
import {MANAGER_CSS,MANAGER_SCRIPT,MANAGER_CONTROLS} from "./manager-resources.js";

// Zone routes invoke this Worker before the existing static-asset origin.
// MENU_CORE retains ownership of authentication, editing and all other menus.
export default {
  async fetch(request, env, ctx) {
    const url = new URL(request.url);
    if (!["app.admakidigital.com", "menu.admakidigital.com"].includes(url.hostname)) {
      return new Response("Not found", {status:404});
    }
    const isApp=url.hostname==='app.admakidigital.com';
    if(url.pathname==='/occasion-assets/occasion-interior-v2.webp'){
      if(!['GET','HEAD'].includes(request.method))return new Response('Method not allowed',{status:405,headers:{Allow:'GET, HEAD'}});
      return new Response(request.method==='HEAD'?null:Uint8Array.from(atob(OCCASION_INTERIOR_BASE64),c=>c.charCodeAt(0)),{headers:{'Content-Type':'image/webp','Cache-Control':'public, max-age=31536000, immutable','X-Content-Type-Options':'nosniff'}});
    }
    if(url.pathname==='/occasion-assets/cover.css')return new Response(".occasion-cover{width:min(100%,720px);margin:0 auto 24px;border-radius:18px;overflow:hidden}.occasion-cover img[alt]{display:block;width:100%!important;height:clamp(230px,44vw,405px)!important;object-fit:cover!important;object-position:50% 35%!important;border:0!important;border-radius:0!important;padding:0!important;background:transparent!important;max-width:none!important}@media(max-width:600px){.occasion-cover{border-radius:12px;margin-bottom:20px}.occasion-cover img[alt]{height:230px!important}}",{headers:{'Content-Type':'text/css; charset=utf-8','Cache-Control':'no-cache'}});
    if(url.pathname==='/occasion-assets/occasion-cover-v1.png'){
      if(!['GET','HEAD'].includes(request.method))return new Response('Method not allowed',{status:405,headers:{Allow:'GET, HEAD'}});
      return new Response(request.method==='HEAD'?null:Uint8Array.from(atob(OCCASION_COVER_BASE64),c=>c.charCodeAt(0)),{headers:{'Content-Type':'image/png','Cache-Control':'public, max-age=31536000, immutable','X-Content-Type-Options':'nosniff'}});
    }
    if(url.pathname==='/occasion-assets/abol-test.js')return new Response(OCCASION_ABOL_SCRIPT,{headers:{'Content-Type':'text/javascript; charset=utf-8','Cache-Control':'no-cache'}});
    if(url.pathname==='/occasion-assets/abol-test.css')return new Response(OCCASION_ABOL_CSS,{headers:{'Content-Type':'text/css; charset=utf-8','Cache-Control':'no-cache'}});
    if(['/r/occasion','/r/occasion/'].includes(url.pathname)&&url.searchParams.get('design')==='abol') {
      if(!isApp)return Response.redirect('https://app.admakidigital.com/r/occasion?design=abol#/r/occasion',302);
      if(!['GET','HEAD'].includes(request.method))return new Response('Method not allowed',{status:405,headers:{Allow:'GET, HEAD'}});
      // Reuse the exact deployed Abol renderer with Occasion's existing public data.
      const shell=await env.MENU_CORE.fetch(new Request(new URL('/',url),request));
      const headers=new Headers(shell.headers);
      for(const key of ['content-length','etag','content-md5','digest','content-digest','repr-digest'])headers.delete(key);
      headers.set('Cache-Control','private, no-store');headers.set('X-Robots-Tag','noindex, nofollow');
      if(!shell.ok||!shell.headers.get('Content-Type')?.includes('text/html'))return shell;
      if(request.method==='HEAD')return new Response(null,{status:shell.status,headers});
      return new HTMLRewriter()
        .on('script[src]',{element(el){if(el.getAttribute('src')?.startsWith('/occasion-assets/admin-links.js'))el.remove();}})
        .on('head',{element(el){el.prepend('<script src="/occasion-assets/abol-test.js" defer></script><link rel="stylesheet" href="/occasion-assets/abol-test.css">',{html:true});}})
        .on('body',{element(el){el.prepend('<aside class="design-test-banner" aria-label="Design preview"><span>Design test · Abol layout</span><a href="https://menu.admakidigital.com/r/occasion">Current design</a></aside>',{html:true});}})
        .transform(new Response(shell.body,{status:shell.status,headers}));
    }
    if(isApp && url.pathname.startsWith('/manager/assets/')) {
      const files={'/manager/assets/auth.css':[MANAGER_CSS,'text/css'], '/manager/assets/auth.js':[MANAGER_SCRIPT,'text/javascript'], '/manager/assets/controls.js':[MANAGER_CONTROLS,'text/javascript']};
      const asset=files[url.pathname];
      if(!asset)return new Response('Not found',{status:404});
      if(!['GET','HEAD'].includes(request.method))return new Response('Method not allowed',{status:405,headers:{Allow:'GET, HEAD'}});
      return new Response(request.method==='HEAD'?null:asset[0],{headers:{'Content-Type':asset[1]+'; charset=utf-8','Cache-Control':'no-cache','X-Content-Type-Options':'nosniff'}});
    }
    if(isApp && url.pathname.startsWith('/manager/api/')) {
      return await managerAuthRoute(request,env) || json({error:'Not found.'},404);
    }
    const session=isApp?await managerSession(request,env):null;
    if(isApp && ['/manager','/manager/','/manager/login','/manager/change-password'].includes(url.pathname)) {
      if(!['GET','HEAD'].includes(request.method))return new Response('Method not allowed',{status:405,headers:{Allow:'GET, HEAD'}});
      const change=url.pathname==='/manager/change-password';
      if(change&&!session)return Response.redirect(new URL('/manager/login',url),302);
      if(!change&&session)return Response.redirect(new URL(session.must_change_password?'/manager/change-password':`/#/admin/${session.restaurant_id}`,url),302);
      return new Response(request.method==='HEAD'?null:managerPage(change),{headers:managerHeaders});
    }
    if(session?.must_change_password) {
      if(url.pathname.startsWith('/api/'))return json({error:'Change your temporary password first.',must_change_password:true},428);
      if(['/','/index.html','/preview/occasion','/preview/occasion/'].includes(url.pathname))return Response.redirect(new URL('/manager/change-password',url),302);
    }
    if(isApp && url.pathname.startsWith('/api/') && hasManagerCookie(request) && !session) {
      return json({error:'Your manager session expired. Sign in again.'},401);
    }
    const managerCore=session?createManagerCore({authenticate:async()=>managerIdentity(session)}):null;
    const core = {fetch: req => managerCore && new URL(req.url).pathname.startsWith('/api/')
      ? managerCore.fetch(req,env,ctx) : env.MENU_CORE.fetch(req)};
    const app = createApp({baseApp:core, skipDashboardInjection:true});
    const response = await app.fetch(request, env, ctx);
    if (url.hostname === "app.admakidigital.com" && ["/", "/index.html"].includes(url.pathname)
        && request.method !== "HEAD" && response.ok && response.headers.get("Content-Type")?.includes("text/html")) {
      const headers = new Headers(response.headers);
      for (const key of ["content-length", "etag", "content-md5", "digest", "content-digest", "repr-digest"]) headers.delete(key);
      headers.set("Cache-Control", "private, no-store");
      let injected = false, managerControls=false;
      const shell = new Response(response.body, {status:response.status, headers});
      return new HTMLRewriter()
        .on("script[src]", {element(el) {const src=el.getAttribute('src');if(src?.startsWith('/occasion-assets/admin-links.js'))injected=true;if(src?.startsWith('/manager/assets/controls.js'))managerControls=true;}})
        .on("body", {element(el) {
          if(!injected)el.append('<script src="/occasion-assets/admin-links.js?v=2" defer></script>', {html:true});
          if(!managerControls)el.append('<script src="/manager/assets/controls.js?v=1" defer></script>', {html:true});
        }})
        .transform(shell);
    }
    return response;
  }
};
