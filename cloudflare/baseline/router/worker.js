import {createApp as createLegacyApp} from "./legacy-worker.js";
import {renderOccasion, OCCASION_ID, LOGO_PATH, STYLE_PATH, SCRIPT_PATH, QR_PATH} from "./occasion-template.js";
import {MENU_CSS, MENU_SCRIPT, ADMIN_SCRIPT, LOGO_BASE64, QR_SVG} from "./resources.js";

const headers = {
  "Cache-Control":"private, no-store",
  "Content-Type":"text/html; charset=utf-8",
  "X-Content-Type-Options":"nosniff",
  "X-Frame-Options":"DENY",
  "Referrer-Policy":"strict-origin-when-cross-origin",
  "Permissions-Policy":"camera=(),microphone=(),geolocation=()",
  "Content-Security-Policy":"default-src 'self'; script-src 'self'; style-src 'self'; img-src 'self' https: data:; font-src 'self'; connect-src 'self'; object-src 'none'; frame-ancestors 'none'; base-uri 'self'; form-action 'self'"
};
function unavailable(status=404, preview=false) {
  const title = status===401?"Sign in to preview":status===403?"Restaurant access required":status===503?"Menu temporarily unavailable":"Menu not available";
  const link = preview && status===401?`<p><a href="/#/admin/${OCCASION_ID}">Open ADMAKI Menu and sign in</a></p>`:"";
  return new Response(`<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><meta name="robots" content="noindex,nofollow"><title>${title}</title><link rel="stylesheet" href="${STYLE_PATH}"></head><body><main class="shell"><div class="hero"><h1>${title}</h1><p>${status===404?"Please check with the restaurant.":status===401?"Use the account assigned to this restaurant or your platform administrator account.":status===403?"Your account cannot preview this restaurant.":"Please try again shortly."}</p>${link}</div></main></body></html>`,{status,headers:{...headers,"X-Robots-Tag":"noindex, nofollow"}});
}
const resource = (request,body,type) => new Response(request.method==="HEAD"?null:body,{headers:{"Content-Type":type,"Cache-Control":"public, max-age=3600","X-Content-Type-Options":"nosniff"}});

async function loadMenu(env,restaurant) {
  const [categories,items]=await env.DB.batch([
    env.DB.prepare("SELECT id,name,sort_order,is_active,deleted_at FROM categories WHERE restaurant_id=? AND is_active=1 AND deleted_at IS NULL ORDER BY sort_order,name,id").bind(restaurant.id),
    env.DB.prepare("SELECT m.id,m.category_id,m.name,m.description,m.price,m.image_url,m.is_available,m.sort_order,m.deleted_at FROM menu_items m JOIN categories c ON c.id=m.category_id AND c.restaurant_id=m.restaurant_id WHERE m.restaurant_id=? AND m.is_available=1 AND m.deleted_at IS NULL AND c.is_active=1 AND c.deleted_at IS NULL ORDER BY m.sort_order,m.created_at,m.id").bind(restaurant.id)
  ]);
  return {restaurant,categories:categories.results,items:items.results};
}

export function createApp(options={}) {
  const core = options.baseApp ?? createLegacyApp(options);
  return {
    async fetch(request,env,ctx) {
      const url=new URL(request.url), path=url.pathname;
      const publicPage=path==="/r/occasion" || path==="/r/occasion/";
      const preview=path==="/preview/occasion" || path==="/preview/occasion/";
      const asset = [STYLE_PATH,SCRIPT_PATH,QR_PATH,"/occasion-assets/admin-links.js",LOGO_PATH].includes(path);
      if((publicPage || preview || asset) && !["GET","HEAD"].includes(request.method)) return new Response("Method not allowed",{status:405,headers:{Allow:"GET, HEAD","Cache-Control":"no-store"}});
      if(asset) {
        if(path===QR_PATH)return resource(request,QR_SVG,"image/svg+xml; charset=utf-8");
        if(path===STYLE_PATH)return resource(request,MENU_CSS,"text/css; charset=utf-8");
        if(path===SCRIPT_PATH)return resource(request,MENU_SCRIPT,"text/javascript; charset=utf-8");
        if(path==="/occasion-assets/admin-links.js")return resource(request,ADMIN_SCRIPT,"text/javascript; charset=utf-8");
        return resource(request,Uint8Array.from(atob(LOGO_BASE64),c=>c.charCodeAt(0)),"image/png");
      }
      if(publicPage || preview) {
        try {
          let restaurant;
          if(preview) {
            // Reuse the deployed account verification and tenant-membership checks.
            const authUrl=new URL(`/api/admin/restaurants/${OCCASION_ID}`,url);
            const authResponse=await core.fetch(new Request(authUrl,{method:"GET",headers:request.headers}),env,ctx);
            if(!authResponse.ok)return unavailable([401,403,404].includes(authResponse.status)?authResponse.status:503,true);
            restaurant=await authResponse.json();
          } else {
            restaurant=await env.DB.prepare("SELECT * FROM restaurants WHERE id=? AND slug='occasion' AND status='active'").bind(OCCASION_ID).first();
          }
          if(!restaurant || restaurant.id!==OCCASION_ID || restaurant.slug!=="occasion")return unavailable(404,preview);
          const data=await loadMenu(env,restaurant);
          const responseHeaders={...headers,...(preview?{"X-Robots-Tag":"noindex, nofollow"}:{})};
          return new Response(request.method==="HEAD"?null:renderOccasion({...data,preview}),{headers:responseHeaders});
        } catch(error) {
          console.error("Occasion menu failed",{name:error?.name??"Error"});
          return unavailable(503,preview);
        }
      }
      const response=await core.fetch(request,env,ctx);
      // The existing SPA still owns sign-in, platform administration and item edits.
      if(!options.skipDashboardInjection && (path==="/" || path==="/index.html") && response.ok && response.headers.get("Content-Type")?.includes("text/html")) {
        const shellHeaders=new Headers(response.headers);
        for(const key of ["content-length","etag","content-md5","digest","content-digest","repr-digest"])shellHeaders.delete(key);
        shellHeaders.set("Cache-Control","private, no-store");
        const shell=new Response(response.body,{status:response.status,headers:shellHeaders});
        return new HTMLRewriter().on("head",{element(element){element.append('<script src="/occasion-assets/admin-links.js?v=1" defer></script>',{html:true});}}).transform(shell);
      }
      return response;
    }
  };
}
export default createApp();
