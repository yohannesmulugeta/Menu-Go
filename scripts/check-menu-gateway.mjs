import assert from 'node:assert/strict';
import gateway from '../cloudflare/gateway/entry.mjs';
const calls=[];const service=name=>({async fetch(r){calls.push({name,path:new URL(r.url).pathname,method:r.method,cookie:r.headers.get('Cookie'),body:['GET','HEAD'].includes(r.method)?'':await r.text()});return new Response(name);}});
const env={PLATFORM:service('platform'),LEGACY_ROUTER:service('router'),LEGACY_CORE:service('core')};
for(const host of ['app.admakidigital.com','menu.admakidigital.com'])for(const path of ['/','/login','/platform','/manage/id','/r/occasion','/r/unknown','/api/restaurants/occasion','/session-api/login','/public-media/cafe/id','/manager/login']){const r=await gateway.fetch(new Request('https://'+host+path),env);assert.equal(await r.text(),'platform');}
assert.equal(await(await gateway.fetch(new Request('https://app.admakidigital.com/occasion-assets/cover.css'),env)).text(),'router');
for(const path of ['/migrated-media/image.png','/media/id/logo.png','/sheba-assets/logo.webp','/fonts/font.woff2'])assert.equal(await(await gateway.fetch(new Request('https://menu.admakidigital.com'+path),env)).text(),'core');
assert.equal((await gateway.fetch(new Request('https://unknown.invalid/login'),env)).status,404);
assert.equal((await gateway.fetch(new Request('https://app.admakidigital.com/not-a-menu'),env)).status,404);
await gateway.fetch(new Request('https://app.admakidigital.com/session-api/login',{method:'POST',headers:{Cookie:'private=one'},body:'private-body'}),env);assert.deepEqual(calls.at(-1),{name:'platform',path:'/session-api/login',method:'POST',cookie:'private=one',body:'private-body'});
console.log('Gateway checks passed: canonical hosts, stable menu and account paths, streamed cookies/bodies, retained legacy assets, unknown paths denied and no fallback café.');
