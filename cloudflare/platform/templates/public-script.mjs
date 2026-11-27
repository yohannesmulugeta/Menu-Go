export const publicScript=String.raw`
const slug=document.body.dataset.publicSlug,guestStatus=document.querySelector('#guest-status');
const publicBase='/api/public/menus/'+encodeURIComponent(slug);
async function guestRequest(action,body) {
  const r=await fetch(publicBase+'/'+action,{method:'POST',headers:{'Content-Type':'application/json','X-Menu-Request':'1'},body:JSON.stringify(body),credentials:'omit',cache:'no-store'});
  const data=await r.json();
  if(!r.ok)throw Error(data.error||'Please try again.');
  return data;
}
function event(name) {
  if(document.body.dataset.analytics==='1')guestRequest('events',{event:name}).catch(()=>{});
}
event('menu_view');
let searchTimer;
document.querySelector('#search')?.addEventListener('input',()=>{clearTimeout(searchTimer);searchTimer=setTimeout(()=>event('search'),500);});
for(const link of document.querySelectorAll('[data-event]'))link.addEventListener('click',()=>event(link.dataset.event));
document.querySelector('#feedback-toggle')?.addEventListener('click',()=>{
  const form=document.querySelector('#feedback-form');form.hidden=!form.hidden;
  document.querySelector('#feedback-toggle').setAttribute('aria-expanded',String(!form.hidden));
  if(!form.hidden)form.querySelector('textarea').focus();
});
document.querySelector('#feedback-form')?.addEventListener('submit',async e=>{
  e.preventDefault();const form=e.currentTarget,submit=form.querySelector('button'),status=form.querySelector('[role=status]');
  submit.disabled=true;status.textContent='Sending…';
  try {
    const message=form.querySelector('textarea').value,rating=form.querySelector('select').value;
    await guestRequest('feedback',{message,...(rating?{rating:Number(rating)}:{})});
    form.reset();status.textContent='Your feedback was sent.';
  } catch(error) {status.textContent=error.message;} finally {submit.disabled=false;}
});
document.querySelector('#share-menu')?.addEventListener('click',async()=>{
  const url=new URL('/r/'+encodeURIComponent(slug),location.origin).href;
  try {
    if(navigator.share)await navigator.share({title:document.title,url});
    else if(navigator.clipboard){await navigator.clipboard.writeText(url);guestStatus.textContent='Menu link copied.';}
    else guestStatus.textContent=url;
    event('share');
  } catch(error) {if(error.name!=='AbortError')guestStatus.textContent='Copy this menu link: '+url;}
});
`;

