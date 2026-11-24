import {test} from 'node:test';
import assert from 'node:assert/strict';
import router from '../router.js';

test('router delegates requests to the existing core with the original method, body and cookies', async () => {
  let observed;
  const request = new Request('https://app.admakidigital.com/api/admin/test', {
    method:'PUT', headers:{Cookie:'session=test', 'Content-Type':'application/json'}, body:'{"name":"test"}'
  });
  const response = await router.fetch(request, {MENU_CORE:{async fetch(req) {
    observed = {url:req.url, method:req.method, cookie:req.headers.get('Cookie'), body:await req.text()};
    return new Response('core result', {status:202});
  }}}, {});
  assert.deepEqual(observed, {url:request.url, method:'PUT', cookie:'session=test', body:'{"name":"test"}'});
  assert.equal(response.status,202);
  assert.equal(await response.text(),'core result');
});

test('router rejects unrelated hosts without accessing the core or database', async () => {
  const response = await router.fetch(new Request('https://unrelated.example/r/occasion'), {}, {});
  assert.equal(response.status,404);
});

test('preview uses the existing core authorization before reading menu data', async () => {
  let authUrl;
  const response = await router.fetch(new Request('https://app.admakidigital.com/preview/occasion'), {
    MENU_CORE:{async fetch(req) {authUrl=req.url;return new Response('Unauthorized',{status:401});}}
  }, {});
  assert.match(authUrl,/\/api\/admin\/restaurants\//);
  assert.equal(response.status,401);
  assert.match(await response.text(),/Sign in to preview/);
});
