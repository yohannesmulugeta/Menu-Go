const ERROR_CODES={400:'BAD_REQUEST',401:'UNAUTHENTICATED',403:'FORBIDDEN',404:'NOT_FOUND',405:'METHOD_NOT_ALLOWED',409:'CONFLICT',413:'PAYLOAD_TOO_LARGE',415:'UNSUPPORTED_MEDIA_TYPE',428:'REAUTHENTICATION_REQUIRED',429:'RATE_LIMITED',503:'UNAVAILABLE'};
export class HttpError extends Error { constructor(status,message){super(message);this.status=status;this.code=ERROR_CODES[status]||'REQUEST_FAILED';} }
export const fail = (status,message) => {throw new HttpError(status,message);};
export function response(data,status=200,headers={}) {
  return new Response(JSON.stringify(data),{status,headers:{'Content-Type':'application/json; charset=utf-8','Cache-Control':'private, no-store',
    'X-Content-Type-Options':'nosniff','X-Robots-Tag':'noindex, nofollow','Referrer-Policy':'no-referrer',...headers}});
}
export function mutationGuard(request) {
  if (new URL(request.url).protocol!=='https:' || request.headers.get('Origin')!==new URL(request.url).origin || request.headers.get('X-Menu-Request')!=='1')
    fail(403,'This request is not allowed. Reload the page and try again.');
  const site=request.headers.get('Sec-Fetch-Site');
  if (site && site!=='same-origin' && site!=='none') fail(403,'This request is not allowed.');
  if (request.headers.get('Content-Type')?.split(';')[0].trim()!=='application/json') fail(415,'Send JSON.');
}
export async function input(request,maxBytes=4096) {
  mutationGuard(request);
  const reader=request.body?.getReader();if(!reader)fail(400,'Enter your details.');
  const parts=[];let size=0;
  while(true){const {done,value}=await reader.read();if(done)break;size+=value.length;if(size>maxBytes){await reader.cancel();fail(413,'Request is too large.');}parts.push(value);}
  try{const data=JSON.parse(new TextDecoder().decode(Buffer.concat(parts)));if(data && typeof data==='object'&&!Array.isArray(data))return data;}catch{/* handled below */}
  fail(400,'Invalid request.');
}
