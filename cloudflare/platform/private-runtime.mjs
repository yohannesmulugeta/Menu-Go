import worker from './worker.mjs';
import {digest} from './auth/passwords.mjs';
import {response} from './auth/http.mjs';

// Only the expensive private mutations use the larger Durable Object CPU budget.
// Bodies are streamed to the object, never parsed, buffered or logged here.
// Object names contain neither usernames nor raw client addresses/session tokens.
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
    const key=privateOperationKey(request);
    if(key===null)return await worker.fetch(request,env,ctx);
    // Missing/misconfigured private compute must fail closed, without falling
    // back to expensive hashing or PNG validation inside the 10 ms Worker.
    if(env.ENVIRONMENT!=='admaki-menu-platform-staging'||!env.PRIVATE_OPERATIONS)
      return response({error:'Environment is not configured.'},503);
    return await env.PRIVATE_OPERATIONS.getByName(key).dispatch(request);
  } catch {
    // Never retry mutations automatically or expose RPC errors/credentials.
    return response({error:'Unable to complete this request. Please try again.'},503);
  }
}

export async function dispatchPrivateOperation(request,env) {
  if(privateOperationKey(request)===null)return response({error:'Not found.'},404);
  // The original router performs environment, CSRF, session, role, tenant,
  // quota and credential-version checks, including guards after expensive work.
  return worker.fetch(request,env);
}

export default {fetch:privateRuntimeFetch,scheduled:worker.scheduled};
