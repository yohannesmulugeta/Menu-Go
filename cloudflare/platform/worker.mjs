const EXPECTED_ENVIRONMENT="admaki-menu-platform-staging";
function json(data,status=200){return new Response(JSON.stringify(data),{status,headers:{"Content-Type":"application/json; charset=utf-8","Cache-Control":"no-store","X-Content-Type-Options":"nosniff","X-Robots-Tag":"noindex, nofollow"}});}
export default {async fetch(request,env){
  const url=new URL(request.url);
  if(env.ENVIRONMENT!==EXPECTED_ENVIRONMENT)return json({error:"Environment is not configured."},503);
  if(request.method!=="GET"&&request.method!=="HEAD")return json({error:"Staging bootstrap has no write API."},405);
  if(!["/","/api/health"].includes(url.pathname))return json({error:"Not found."},404);
  try{
    const marker=await env.DB.prepare("SELECT name FROM platform_environment WHERE singleton=1").first();
    if(marker?.name!==EXPECTED_ENVIRONMENT)return json({error:"Database environment mismatch."},503);
    const schema=await env.DB.prepare("SELECT count(*) count FROM schema_migrations").first();
    const result={ok:true,environment:"staging",schema_migrations:schema.count,media_binding:!!env.MEDIA,authentication:"not enabled",public_menus:"not enabled"};
    if(request.method==="HEAD")return new Response(null,{headers:{"Cache-Control":"no-store","X-Robots-Tag":"noindex, nofollow"}});
    return json(result);
  }catch{return json({error:"Staging database is not ready."},503);}
}};
