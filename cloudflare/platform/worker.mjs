import {favicon} from './web/favicon.mjs';
import {restaurantRoute} from './restaurants/service.mjs';
import {authRoute,cleanupAuth} from './auth/service.mjs';
import {response} from './auth/http.mjs';
import {configRoute} from './config/service.mjs';
import {publicCapabilityRoute,cleanupPublicLimits} from './config/capabilities.mjs';
import {appPage} from './web/page.mjs';
import {mediaRoute,attachmentRoute,cleanupMedia} from './media/service.mjs';
import {previewRoute} from './templates/service.mjs';
const EXPECTED_ENVIRONMENT='admaki-menu-platform-staging';
async function environmentReady(env){
  if(env.ENVIRONMENT!==EXPECTED_ENVIRONMENT)return false;
  const marker=await env.DB.prepare('SELECT name FROM platform_environment WHERE singleton=1').first();
  return marker?.name===EXPECTED_ENVIRONMENT;
}
export default {
  async fetch(request,env){
    try{
      if(!await environmentReady(env))return response({error:'Environment is not configured.'},503);
      const url=new URL(request.url);
      if(url.protocol!=='https:')return response({error:'Use HTTPS.'},400);
      if(url.pathname==='/favicon.ico'){
        if(!['GET','HEAD'].includes(request.method))return response({error:'Method not allowed.'},405,{Allow:'GET, HEAD'});
        return new Response(request.method==='HEAD'?null:favicon,{headers:{'Content-Type':'image/svg+xml','Cache-Control':'public, max-age=86400','X-Content-Type-Options':'nosniff'}});
      }
      if(url.pathname==='/api/health'){
        if(!['GET','HEAD'].includes(request.method))return response({error:'Method not allowed.'},405,{Allow:'GET, HEAD'});
        if(request.method==='HEAD')return new Response(null,{headers:{'Cache-Control':'no-store','X-Robots-Tag':'noindex, nofollow'}});
        const schema=await env.DB.prepare('SELECT count(*) count FROM schema_migrations').first();
        return response({ok:true,environment:'staging',schema_migrations:schema.count,media_binding:!!env.MEDIA,authentication:'username/password',public_menus:'not enabled'});
      }
      if(url.pathname.startsWith('/api/'))return await restaurantRoute(request,env)||await mediaRoute(request,env)||await attachmentRoute(request,env)||await configRoute(request,env)||await publicCapabilityRoute(request,env)||await authRoute(request,env)||response({error:'Not found.'},404);
      const preview=await previewRoute(request,env);if(preview)return preview;
      if(['GET','HEAD'].includes(request.method)&&(/^\/(login|platform|manage(\/[^/]+)?|account\/password)?\/?$/.test(url.pathname))){
        const page=appPage();return request.method==='HEAD'?new Response(null,{headers:page.headers}):page;
      }
      return response({error:'Not found.'},404);
    }catch(error){
      if(error.status)return response({error:error.message,code:error.code||'REQUEST_FAILED'},error.status,error.status===429?{'Retry-After':'900'}:{});
      // No exception messages, request bodies, cookies, credentials or SQL in logs/responses.
      console.error('Menu staging request failed',{name:error.name||'Error'});
      return response({error:'Unable to complete this request. Please try again.'},503);
    }
  },
  async scheduled(_event,env){if(await environmentReady(env)){await cleanupAuth(env.DB);await cleanupPublicLimits(env.DB);if(env.MEDIA)await cleanupMedia(env.DB,env.MEDIA);}}
};
