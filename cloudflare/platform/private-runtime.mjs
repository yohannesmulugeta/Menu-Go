import {deployment} from './deployment.mjs';
import worker from './worker.mjs';
import {digest} from './auth/passwords.mjs';
import {response} from './auth/http.mjs';

// Only the expensive private mutations use the larger Durable Object CPU budget.
// Request bodies stream to the object, never parsed, buffered or logged here.
// Object names contain neither usernames nor raw client addresses/session tokens.
export const MAX_PRIVATE_RESPONSE_BYTES=128*1024;

// Private mutations return small JSON responses, not image downloads. Read the
// complete bounded response and dispose its RPC scope before ending the caller.
// Returning the RPC Response directly leaves that scope alive at caller teardown.
export async function completePrivateResponse(remote) {
  let reader,complete=false;
  try {
    reader=remote.body?.getReader();
    const chunks=[];let size=0;
    if(reader)for(;;){
      const {done,value}=await reader.read();
      if(done)break;
      size+=value.byteLength;
      if(size>MAX_PRIVATE_RESPONSE_BYTES)throw Error('Private response exceeds its bound.');
      chunks.push(value);
    }
    complete=true;
    const bytes=new Uint8Array(size);let offset=0;
    for(const chunk of chunks){bytes.set(chunk,offset);offset+=chunk.byteLength;}
    return new Response(remote.body?bytes:null,{status:remote.status,statusText:remote.statusText,headers:remote.headers});
  } finally {
    try {if(reader&&!complete)await reader.cancel();}
    finally {
      try {reader?.releaseLock();}
      finally {remote[Symbol.dispose]?.();}
    }
  }
}

export function privateOperationKey(request) {
  if(request.method!=='POST')return null;
  const path=new URL(request.url).pathname;
  if(/^\/api\/auth\/(login|password|reauth)$/.test(path)||path==='/api/platform/users'||/^\/api\/platform\/users\/[^/]+\/reset-password$/.test(path))
    return 'auth-source:'+digest(request.headers.get('CF-Connecting-IP')||'unknown');
  const media=/^\/api\/restaurants\/([^/]+)\/media$/.exec(path);
  return media?'media-tenant:'+digest(decodeURIComponent(media[1])):null;
}

export async function privateRuntimeFetch(request,env,ctx) {
  try {
    if(deployment(env)?.label==='production'){const url=new URL(request.url);if(/^\/session-api\/(login|logout|session|password|reauth)$/.test(url.pathname)){url.pathname=url.pathname.replace('/session-api/','/api/auth/');request=new Request(url,request);}}
    const key=privateOperationKey(request);
    if(key===null)return await worker.fetch(request,env,ctx);
    // Missing/misconfigured private compute must fail closed, without falling
    // back to expensive hashing or PNG validation inside the 10 ms Worker.
    if(!deployment(env)||!env.PRIVATE_OPERATIONS)
      return response({error:'Environment is not configured.'},503);
    return await completePrivateResponse(await env.PRIVATE_OPERATIONS.getByName(key).dispatch(request));
  } catch {
    // Never retry mutations automatically or expose RPC errors/credentials.
    return response({error:'Unable to complete this request. Please try again.'},503);
  }
}

export async function dispatchPrivateOperation(request,env) {
  if(privateOperationKey(request)===null)return response({error:'Not found.'},404);
  // The original router performs environment, CSRF, session, role, tenant,
  // quota and credential-version checks, including guards after expensive work.
  try {return await worker.fetch(request,env);}
  finally {
    // Early denials (origin, access, content length) intentionally skip reading
    // the body. Release that transferred stream without draining hostile input.
    if(request.body&&!request.bodyUsed)try {await request.body.cancel();} catch {/* Preserve the original response if the client already canceled. */}
  }
}

export default {fetch:privateRuntimeFetch,scheduled:worker.scheduled};
