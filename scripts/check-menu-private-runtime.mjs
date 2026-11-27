import assert from 'node:assert/strict';
import runtime,{privateOperationKey,dispatchPrivateOperation} from '../cloudflare/platform/private-runtime.mjs';

const origin='https://staging.invalid';
const req=(path,method='POST',headers={},body='{}')=>new Request(origin+path,{method,headers:{'CF-Connecting-IP':'192.0.2.1',...headers},body:['GET','HEAD'].includes(method)?undefined:body});
const authKey=privateOperationKey(req('/api/auth/login'));
assert.match(authKey,/^auth-source:[a-f0-9]{64}$/);
assert.equal(privateOperationKey(req('/api/auth/password')),authKey);
assert.equal(privateOperationKey(req('/api/auth/reauth')),authKey);
assert.equal(privateOperationKey(req('/api/platform/users')),authKey);
assert.equal(privateOperationKey(req('/api/platform/users/user-id/reset-password')),authKey);
assert.notEqual(privateOperationKey(req('/api/auth/login','POST',{'CF-Connecting-IP':'192.0.2.2'})),authKey);
assert.equal(privateOperationKey(req('/api/restaurants/caf%C3%A9/media')),privateOperationKey(req('/api/restaurants/café/media')));
assert.notEqual(privateOperationKey(req('/api/restaurants/first/media')),privateOperationKey(req('/api/restaurants/second/media')));
for(const [path,method] of [['/r/cafe','GET'],['/public-media/cafe/image','GET'],['/api/health','GET'],['/api/auth/session','GET'],['/api/auth/login','GET'],['/api/auth/logout','POST'],['/api/restaurants/cafe/media/image','DELETE'],['/api/restaurants/cafe/media-attachment','PATCH']])assert.equal(privateOperationKey(req(path,method)),null);

let calls=0;const env={ENVIRONMENT:'admaki-menu-platform-staging',PRIVATE_OPERATIONS:{getByName(key){assert.equal(key,authKey);return {async dispatch(request){calls++;assert.equal(request.headers.get('Cookie'),'__Host-admaki_menu=private');assert.equal(request.headers.get('Origin'),origin);assert.equal(await request.text(),'private-test-body');return new Response('forwarded',{status:201,headers:{'Set-Cookie':'test=private; Secure; HttpOnly'}});}};}}};
const r=await runtime.fetch(req('/api/auth/login','POST',{Origin:origin,Cookie:'__Host-admaki_menu=private'},'private-test-body'),env);
assert.equal(r.status,201);assert.equal(await r.text(),'forwarded');assert.match(r.headers.get('Set-Cookie'),/HttpOnly/);assert.equal(calls,1);
// No plaintext credentials are needed to choose the object; the stream is untouched.
for(const badEnv of [{ENVIRONMENT:'production',PRIVATE_OPERATIONS:env.PRIVATE_OPERATIONS},{ENVIRONMENT:'admaki-menu-platform-staging'}])assert.equal((await runtime.fetch(req('/api/auth/login'),badEnv)).status,503);
assert.equal(calls,1);
const failure={...env,PRIVATE_OPERATIONS:{getByName(){return {dispatch(){calls++;throw Error('secret-rpc-details');}};}}};
const failed=await runtime.fetch(req('/api/auth/login'),failure);assert.equal(failed.status,503);assert.ok(!(await failed.text()).includes('secret'));assert.equal(calls,2);
assert.equal((await dispatchPrivateOperation(req('/r/cafe','GET'),{})).status,404);
assert.equal((await dispatchPrivateOperation(req('/api/auth/login'),{ENVIRONMENT:'production'})).status,503);
console.log('Private runtime checks passed: bounded route selection, source/tenant partitioning, body/header/cookie forwarding, public path bypass, fail-closed binding/environment and no automatic mutation retry.');
