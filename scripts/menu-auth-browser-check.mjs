// Synthetic staging fixtures only. Invoke through Cloudflare Browser Rendering with explicit options.
export async function checkMenuAuthBrowser({page,browser},options){const checks=[],errors=[];let ownerPassword;page.on('pageerror',e=>errors.push(e.message));try{
 const base='https://admaki-menu-platform-staging.yohannesmulugeta084.workers.dev';
 await page.setViewport({width:390,height:844,deviceScaleFactor:1});await page.goto(base+'/login',{waitUntil:'networkidle0'});
 ownerPassword=options.adminPassword;await page.waitForSelector('#field-username');await page.type('#field-username',options.adminUsername);await page.type('#field-password',ownerPassword);await page.click('button[type=submit]');
 await page.waitForFunction(()=>document.querySelector('h1')?.textContent==='Restaurants');checks.push('owner accesses shared dashboard');
 await page.evaluate(()=>Array.from(document.querySelectorAll('button')).find(b=>b.textContent==='Manage accounts').click());await page.waitForSelector('#restaurants');
 await page.type('#field-username',options.managerUsername);await page.select('#restaurants',options.restaurantId);await page.click('button[type=submit]');
 await page.waitForSelector('.secret');const managerPassword=await page.$eval('.secret',e=>e.textContent);checks.push('admin creates manager with one-time temporary password');
 const ownerCookies=await page.cookies();await page.deleteCookie(...ownerCookies);
 await page.goto(base+'/login',{waitUntil:'networkidle0'});await page.waitForSelector('#field-password');await page.type('#field-username',options.managerUsername);await page.type('#field-password',managerPassword);await page.click('button[type=submit]');await page.waitForFunction(()=>document.querySelector('h1')?.textContent==='Set your own password');
 const forced=await page.evaluate(async()=>{const r=await fetch('/api/manage/staging-demo/overview');return r.status;});if(forced!==403)throw Error('First-login restriction failed');checks.push('manager forced-change access restriction');
 if(!/^\d{6}$/.test(managerPassword))throw Error('Expected a six-digit temporary PIN');
 const finalManagerPassword=managerPassword==='483927'?'592836':'483927';
 await page.type('#field-current_password',managerPassword);await page.type('#field-new_password',finalManagerPassword);await page.click('button[type=submit]');await page.waitForFunction(()=>document.querySelector('h1')?.textContent==='Welcome back');
 await page.type('#field-username',options.managerUsername);await page.type('#field-password',finalManagerPassword);await page.click('button[type=submit]');await page.waitForFunction(name=>document.querySelector('h1')?.textContent===name,{},options.restaurantName);
 const denied=await page.evaluate(async()=>({platform:(await fetch('/api/platform/users')).status,tenant:(await fetch('/api/manage/unknown/overview')).status,session:await(await fetch('/api/auth/session')).json()}));if(denied.platform!==403||denied.tenant!==404||denied.session.role!=='manager')throw Error('Role/tenant isolation failed');checks.push('manager dashboard and platform/cross-tenant denials');
 const managerCookies=await page.cookies();await page.deleteCookie(...managerCookies);await page.setCookie(...ownerCookies);await page.goto(base+'/platform',{waitUntil:'networkidle0'});
 const reset=await page.evaluate(async userId=>{const r=await fetch('/api/platform/users/'+userId+'/reset-password',{method:'POST',headers:{'Content-Type':'application/json','X-Menu-Request':'1'},body:'{}'});const data=await r.json();return {status:r.status,ok:typeof data.temporary_password==='string'};},denied.session.user_id);if(reset.status!==200||!reset.ok)throw Error('Reset failed '+reset.status);checks.push('recently authenticated admin resets manager password');
 await page.deleteCookie(...await page.cookies());await page.setCookie(...managerCookies);
 const stale=await page.evaluate(async()=>await(await fetch('/api/auth/session')).json());if(stale!==null)throw Error('Reset did not revoke manager session');checks.push('reset invalidates existing manager session');
 await page.deleteCookie(...await page.cookies());await page.setCookie(...ownerCookies);await page.goto(base+'/platform',{waitUntil:'networkidle0'});
 const layout=await page.evaluate(()=>({width:innerWidth,scroll:document.documentElement.scrollWidth}));if(layout.scroll>layout.width)throw Error('Mobile horizontal overflow');checks.push('mobile dashboard fits 390px');
 return {checks,errors,manager_id:denied.session.user_id};
 }catch(e){return {failed:e.message,checks,errors,screen:await page.evaluate(()=>{document.querySelectorAll('.secret').forEach(e=>e.remove());return document.body.innerText;})};}finally{await browser.close();}}

