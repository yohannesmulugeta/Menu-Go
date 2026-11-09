export const HTML = `<!doctype html>
<html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><meta name="robots" content="noindex,nofollow"><title>Menu Go · D1 pilot</title><link rel="stylesheet" href="/style.css"><script src="/app.js" defer></script></head>
<body><div class="pilot">TEST COPY · Changes here affect only this pilot menu.</div><header><a class="brand" href="/">Menu Go<span>by ADMAKI</span></a><nav><a href="/r/abol-coffee">View menu</a><a href="/admin">Manage menu</a></nav></header><main id="app" aria-live="polite"><p>Loading menu…</p></main><footer>Menu Go · Restaurant menu pilot</footer></body></html>`;

export const CSS = `
:root{font-family:Inter,system-ui,-apple-system,BlinkMacSystemFont,"Segoe UI",sans-serif;color:#25251e;background:#f7f6f0;font-synthesis:none}*{box-sizing:border-box}body{margin:0}.pilot{background:#e8d6a4;color:#44370f;font-size:12px;text-align:center;padding:9px;font-weight:700;letter-spacing:.06em}header{max-width:1100px;margin:auto;display:flex;justify-content:space-between;align-items:center;padding:25px 24px;border-bottom:1px solid #deded3}.brand{font-weight:800;font-size:24px;color:#303b27;letter-spacing:-1px;text-decoration:none}.brand span{font-size:11px;display:block;letter-spacing:.08em;text-transform:uppercase;color:#707966;margin-top:2px}nav{display:flex;gap:20px}a{color:#405535}nav a{font-size:14px;text-underline-offset:5px}main{max-width:1100px;margin:0 auto;padding:36px 24px 60px}h1{font-size:clamp(30px,5vw,46px);letter-spacing:-1.5px;margin:12px 0}h2{font-size:24px;letter-spacing:-.7px}h3{margin:0 0 8px;font-size:17px}.eyebrow{text-transform:uppercase;letter-spacing:.13em;font-size:11px;font-weight:750;color:#6a715c}.sub{color:#73766a;line-height:1.6}.hero{border-bottom:1px solid #deded3;padding:0 0 25px;margin-bottom:24px}.hero a{display:inline-block;margin:10px 20px 0 0}.tools{display:flex;align-items:center;gap:12px;flex-wrap:wrap;margin-bottom:24px}.tools label{min-width:220px}.tools input{flex:1;min-width:200px}.chips{display:flex;gap:8px;overflow-x:auto;padding:5px 0 20px}.chips button{white-space:nowrap}.chips button.selected{background:#3d5333;color:white;border-color:#3d5333}.grid{display:grid;grid-template-columns:repeat(3,1fr);gap:16px}.card{background:white;border:1px solid #e3e3d9;border-radius:16px;padding:22px;min-width:0}.card img{width:100%;height:170px;object-fit:cover;border-radius:10px;margin-bottom:16px}.card p{font-size:14px;color:#73766a;line-height:1.6}.price{display:block;margin-top:20px;color:#385030;font-size:20px}.popular{font-size:11px;color:#7e5d21;display:inline-block;margin-bottom:12px}.empty{padding:36px;color:#73766a;text-align:center}.error{background:#f9e6df;border:1px solid #e9bcac;padding:16px;border-radius:10px;color:#913b25}.success{background:#e6eee0;border:1px solid #c5d4b9;padding:14px;border-radius:10px;color:#385030}.auth{max-width:430px;margin:35px auto}.auth form{margin-top:28px}label{display:block;font-size:13px;font-weight:650;margin-bottom:16px}input,select,textarea{display:block;width:100%;margin-top:7px;font:inherit;font-size:15px;border:1px solid #cdcec2;background:white;border-radius:8px;padding:12px;color:#25251e}textarea{resize:vertical;min-height:85px}button{font:inherit;cursor:pointer;background:white;border:1px solid #d9dacc;color:#424a37;padding:11px 16px;border-radius:9px;font-weight:650;font-size:13px}button:hover{border-color:#4b613e;background:#f1f4eb}button:disabled{opacity:.5;cursor:wait}.primary{background:#3d5333;color:white;border-color:#3d5333}.primary:hover{background:#2c4125;color:white}.danger{color:#9b3824}.admin-head{display:flex;justify-content:space-between;gap:15px;align-items:center}.edit-layout{display:grid;grid-template-columns:minmax(0,1fr) 340px;gap:24px}.editor{position:sticky;top:20px;align-self:start}.checks{display:flex;gap:20px}.checks label{display:flex;align-items:center;gap:7px}.checks input{display:inline;width:auto;margin:0}.item-row{display:flex;justify-content:space-between;align-items:center;gap:15px;border-bottom:1px solid #e7e7de;padding:18px 0}.item-row h3{font-size:15px;margin-bottom:5px}.item-row p{margin:0;font-size:12px;color:#727769}.item-row .price{font-size:16px;margin:0;white-space:nowrap}.row-actions{display:flex;gap:8px;align-items:center}.row-actions button{font-size:12px;padding:8px 11px}.summary{display:flex;gap:16px;margin:24px 0}.summary .card{padding:16px 24px;flex:1}.summary strong{font-size:25px;display:block}.summary small{color:#73766a}.actions{display:flex;gap:10px;margin-top:15px}.status{min-height:20px;margin:15px 0}.category-editor{margin-top:24px}.category-line{display:flex;align-items:center;gap:8px;margin-bottom:10px}.category-line input{margin:0}.category-line input[type=checkbox]{width:auto}.category-line label{margin:0;font-size:12px}.category-line .name{flex:1}.back{font-size:13px}footer{text-align:center;border-top:1px solid #deded3;padding:24px;font-size:12px;color:#73766a}#login-message{margin-top:16px}dialog{border:0;border-radius:14px;box-shadow:0 10px 80px #0004;max-width:400px;padding:28px}dialog::backdrop{background:#0006}button:focus-visible,a:focus-visible,input:focus-visible,select:focus-visible,textarea:focus-visible{outline:3px solid #a8b890;outline-offset:3px}
@media(max-width:800px){.grid{grid-template-columns:repeat(2,1fr)}.edit-layout{grid-template-columns:1fr}.editor{position:static}.admin-head{align-items:flex-start}.row-actions{flex-wrap:wrap;justify-content:flex-end}.summary{gap:10px}.summary .card{padding:15px}.summary strong{font-size:21px}}
@media(max-width:480px){header{padding:20px 18px}nav{gap:12px}nav a{font-size:12px}main{padding:24px 16px 40px}.grid{grid-template-columns:1fr}.card{padding:18px}.item-row{gap:10px}.item-row h3{font-size:14px}.item-row .price{font-size:14px}.summary .card{padding:12px}.pilot{font-size:10px}.tools label{min-width:0;width:100%}}`;

export const JS = String.raw`
'use strict';
const app = document.getElementById('app');
let token = '', model = null, selectedCategory = '', search = '', editing = null, adminMode = location.pathname === '/admin';
let slug = new URLSearchParams(location.search).get('restaurant') || location.pathname.split('/')[2] || 'abol-coffee';
let restaurantList = [];
function el(tag, props, children) {
  const node = document.createElement(tag);
  for (const [key,value] of Object.entries(props || {})) {
    if (key.startsWith('on')) node.addEventListener(key.slice(2), value);
    else if (key === 'class') node.className = value;
    else if (key === 'text') node.textContent = value;
    else if (key === 'checked' || key === 'disabled') node[key] = Boolean(value);
    else if (value !== null && value !== undefined) node.setAttribute(key, value);
  }
  for (const child of children || []) if (child !== null && child !== undefined) node.append(typeof child === 'string' ? document.createTextNode(child) : child);
  return node;
}
async function api(path, method, data) {
  const response = await fetch(path, {method:method || 'GET', headers:{...(token ? {Authorization:'Bearer '+token}:{}), ...(data ? {'Content-Type':'application/json'}:{})}, body:data ? JSON.stringify(data) : undefined});
  const result = await response.json();
  if (!response.ok) {
    if (response.status === 401 && adminMode) token = '';
    throw new Error(result.error || 'Request failed. Please try again.');
  }
  return result;
}
const endpoint = (resource,id) => '/api/admin/restaurants/'+encodeURIComponent(slug)+'/'+resource+(id?'/'+encodeURIComponent(id):'');
function link(href, label, external) {return el('a',{href:href, ...(external ? {target:'_blank',rel:'noopener noreferrer'} : {}),text:label});}
function notice(message, kind) { return el('p',{class:kind || 'error',role:'status',text:message}); }
function money(price) {return new Intl.NumberFormat('en-ET',{maximumFractionDigits:2}).format(price)+' '+(model.restaurant.currency || 'ETB');}
function safeLink(value) {try{return new URL(value).protocol === 'https:' ? value : null;}catch{return null;}}
function itemCard(item) {
  const children=[];
  const image=safeLink(item.image_url);
  if(image)children.push(el('img',{src:image,alt:'',loading:'lazy',onerror:e=>e.target.remove()}));
  if(item.is_popular)children.push(el('span',{class:'popular',text:'POPULAR'}));
  children.push(el('h3',{text:item.name}),el('p',{text:item.description}),el('strong',{class:'price',text:money(item.price)}));
  return el('article',{class:'card'},children);
}
function publicMenu() {
  const restaurant=model.restaurant;
  document.title=restaurant.name+' · Menu Go pilot';
  const hero=el('section',{class:'hero'},[el('p',{class:'eyebrow',text:'Menu Go / Test menu'}),el('h1',{text:restaurant.name}),el('p',{class:'sub',text:restaurant.tagline || 'Explore our menu'})]);
  if(restaurant.address)hero.append(el('p',{class:'sub',text:restaurant.address}));
  if(restaurant.phone)hero.append(link('tel:'+restaurant.phone,'Call the restaurant'));
  if(safeLink(restaurant.google_maps_url))hero.append(link(restaurant.google_maps_url,'Directions',true));
  hero.append(link('/admin?restaurant='+encodeURIComponent(slug),'Manage this test menu'));
  if (slug === 'abol-coffee') hero.append(el('p',{class:'sub',text:'All prices include VAT & service charge.'}));
  if (slug === 'mokodo-pizza') hero.append(el('p',{class:'sub',text:'15% VAT and 5% service charge are added to listed prices. Takeaway box: 130 ETB each. Mixed toppings: 50 ETB extra, added to the price of the higher-priced dish.'}));
  const searchInput=el('input',{type:'search',placeholder:'Search food and drinks…','aria-label':'Search menu items',value:search});
  searchInput.addEventListener('input',()=>{search=searchInput.value;drawItems();});
  const chips=el('div',{class:'chips','aria-label':'Menu categories'});
  const choices=[{id:'',name:'All items'},...model.categories];
  for(const category of choices){
    const button=el('button',{type:'button',class:category.id===selectedCategory?'selected':'',text:category.name,'aria-pressed':String(category.id===selectedCategory)});
    button.addEventListener('click',()=>{selectedCategory=category.id;for(const b of chips.children){b.classList.remove('selected');b.setAttribute('aria-pressed','false');}button.classList.add('selected');button.setAttribute('aria-pressed','true');drawItems();});chips.append(button);
  }
  const count=el('p',{class:'sub'}), grid=el('div',{class:'grid'});
  function drawItems(){
    const items=model.items.filter(i=>(!selectedCategory || i.category_id===selectedCategory) && (i.name+' '+i.description).toLowerCase().includes(search.toLowerCase()));
    count.textContent=items.length+(items.length === 1?' item':' items');grid.replaceChildren(...items.map(itemCard));
    if(!items.length)grid.append(el('p',{class:'empty',text:'No items match your search.'}));
  }
  app.replaceChildren(hero,searchInput,chips,count,grid);drawItems();
}
function login(message) {
  model=null;editing=null;
  const email=el('input',{type:'email',autocomplete:'username',required:'',name:'email'}),password=el('input',{type:'password',autocomplete:'current-password',required:'',name:'password'});
  const button=el('button',{class:'primary',type:'submit',text:'Sign in'}), status=el('div',{id:'login-message',role:'status'});
  if(message)status.append(notice(message));
  const form=el('form',{},[el('label',{text:'Email'},[email]),el('label',{text:'Password'},[password]),button,status]);
  form.addEventListener('submit',async e=>{
    e.preventDefault();button.disabled=true;status.replaceChildren();
    try {
      const session=await api('/api/login','POST',{email:email.value.trim(),password:password.value});
      token=session.access_token;password.value='';
      await loadMenu();
    }catch(error){status.replaceChildren(notice(error.message));}finally{button.disabled=false;}
  });
  app.replaceChildren(el('section',{class:'card auth'},[el('p',{class:'eyebrow',text:'Menu management'}),el('h1',{text:'Welcome back.'}),el('p',{class:'sub',text:'Use your existing Menu Go account. Your changes are saved only in this test copy.'}),form]));
}
function labelled(label,input){return el('label',{text:label},[input]);}
function adminMenu(message) {
  const restaurant=model.restaurant;
  document.title='Manage '+restaurant.name+' · Menu Go pilot';
  const name=el('input',{required:'',maxlength:'200',value:editing?editing.name:''});
  const price=el('input',{type:'number',required:'',min:'0',max:'9999999.99',step:'0.01',value:editing?editing.price:''});
  const category=el('select',{'aria-label':'Item category'},model.categories.map(c=>el('option',{value:c.id,text:c.name+(c.is_active?'':' (hidden)')})));
  if(editing)category.value=editing.category_id;
  const description=el('textarea',{maxlength:'3000'},[editing?editing.description:'']);
  const image=el('input',{type:'url',placeholder:'https://…',value:editing?(editing.image_url || ''):''});
  const available=el('input',{type:'checkbox',checked:editing?editing.is_available:true}),popular=el('input',{type:'checkbox',checked:editing?editing.is_popular:false});
  const save=el('button',{class:'primary',type:'submit',text:editing?'Save changes':'Add item'});
  const editStatus=el('div',{class:'status',role:'status'});
  const form=el('form',{},[el('h2',{text:editing?'Edit item':'Add an item'}),labelled('Item name',name),labelled('Price ('+(restaurant.currency||'ETB')+')',price),labelled('Category',category),labelled('Description',description),labelled('Photo link',image),el('p',{class:'sub',text:'Paste an HTTPS photo link. File uploads will be connected separately.'}),el('div',{class:'checks'},[labelled('Available',available),labelled('Popular',popular)]),el('div',{class:'actions'},[save,el('button',{type:'button',text:'Clear',onclick:()=>{editing=null;adminMenu();}})]),editStatus]);
  form.addEventListener('submit',async e=>{
    e.preventDefault();save.disabled=true;editStatus.replaceChildren();
    const current=editing;
    try{
      await api(endpoint('items',current?.id),current?'PUT':'POST',{name:name.value,price:Number(price.value),category_id:category.value,description:description.value,image_url:image.value,is_available:available.checked,is_popular:popular.checked,...(current?{version:current.version}:{})});
      editing=null;await loadMenu('Item saved. The public test menu is updated.');
    }catch(error){if(!token)login(error.message);else editStatus.replaceChildren(notice(error.message));}finally{save.disabled=false;}
  });
  const restaurantSelect=el('select',{'aria-label':'Restaurant'},restaurantList.map(r=>el('option',{value:r.slug,text:r.name})));
  restaurantSelect.value=slug;
  restaurantSelect.addEventListener('change',async()=>{slug=restaurantSelect.value;editing=null;history.replaceState(null,'','/admin?restaurant='+encodeURIComponent(slug));await loadMenu();});
  const searchBox=el('input',{type:'search',placeholder:'Find an item…','aria-label':'Search managed items'});
  const rows=el('div');
  function drawRows(){
    const items=model.items.filter(i=>i.name.toLowerCase().includes(searchBox.value.toLowerCase()));
    rows.replaceChildren(...items.map(item=>el('article',{class:'item-row'},[
      el('div',{},[el('h3',{text:item.name}),el('p',{text:(model.categories.find(c=>c.id===item.category_id)?.name || 'Uncategorized')+' · '+(item.is_available?'Available':'Unavailable')})]),
      el('div',{class:'row-actions'},[el('strong',{class:'price',text:money(item.price)}),el('button',{type:'button',text:'Edit','aria-label':'Edit '+item.name,onclick:()=>{editing=item;adminMenu();document.getElementById('item-editor').scrollIntoView({behavior:'smooth',block:'start'});}}),el('button',{type:'button',class:'danger',text:'Remove','aria-label':'Remove '+item.name,onclick:()=>removeItem(item)})])
    ])));
    if(!items.length)rows.append(el('p',{class:'empty',text:'No matching items.'}));
  }
  searchBox.addEventListener('input',drawRows);
  const logOut=el('button',{text:'Sign out',type:'button',onclick:async()=>{try{await api('/api/logout','POST',{});}catch{}token='';login();}});
  const list=el('section',{class:'card'},[el('h2',{text:'Menu items'}),searchBox,rows]);
  const editor=el('section',{class:'card editor',id:'item-editor'},[form]);
  app.replaceChildren(
    el('div',{class:'admin-head'},[el('div',{},[el('p',{class:'eyebrow',text:'Restaurant dashboard'}),el('h1',{text:restaurant.name})]),logOut]),
    el('div',{class:'tools'},[labelled('Restaurant',restaurantSelect),link('/r/'+encodeURIComponent(slug),'Open public test menu',true)]),
    el('div',{class:'summary'},[el('div',{class:'card'},[el('strong',{text:String(model.items.length)}),el('small',{text:'Menu items'})]),el('div',{class:'card'},[el('strong',{text:String(model.categories.length)}),el('small',{text:'Categories'})]),el('div',{class:'card'},[el('strong',{text:String(model.items.filter(i=>i.is_available).length)}),el('small',{text:'Available'})])]),
    ...(message?[notice(message,'success')]:[]),el('div',{class:'edit-layout'},[list,editor]),categoryEditor());
  drawRows();
}
function removeItem(item){
  const dialog=el('dialog',{'aria-label':'Remove menu item'});
  const status=el('div',{role:'status'});
  const remove=el('button',{class:'danger',text:'Remove item',type:'button',onclick:async()=>{
    remove.disabled=true;
    try{await api(endpoint('items',item.id),'DELETE');if(editing?.id===item.id)editing=null;dialog.close();dialog.remove();await loadMenu('Item removed from the test menu.');}
    catch(error){status.replaceChildren(notice(error.message));remove.disabled=false;}
  }});
  dialog.append(el('h2',{text:'Remove '+item.name+'?'}),el('p',{class:'sub',text:'The item will be hidden from this test menu. The original menu is unaffected.'}),el('div',{class:'actions'},[remove,el('button',{text:'Cancel',type:'button',onclick:()=>{dialog.close();dialog.remove();}})]),status);
  document.body.append(dialog);dialog.addEventListener('close',()=>dialog.remove());dialog.showModal();
}
function categoryEditor(){
  const section=el('section',{class:'card category-editor'},[el('h2',{text:'Categories'}),el('p',{class:'sub',text:'Hide a category to hide its items from the public test menu.'})]);
  for(const category of model.categories){
    const name=el('input',{value:category.name,required:'',maxlength:'120','aria-label':'Category name: '+category.name});
    const visible=el('input',{type:'checkbox',checked:category.is_active,'aria-label':'Show category: '+category.name});
    const status=el('span',{role:'status'});
    const save=el('button',{type:'submit',text:'Save'});
    const form=el('form',{class:'category-line'},[el('div',{class:'name'},[name]),labelled('Visible',visible),save,status]);
    form.addEventListener('submit',async e=>{e.preventDefault();save.disabled=true;try{await api(endpoint('categories',category.id),'PUT',{name:name.value,is_active:visible.checked});await loadMenu('Category saved.');}catch(error){status.textContent=error.message;save.disabled=false;}});
    section.append(form);
  }
  const newName=el('input',{placeholder:'New category name',required:'',maxlength:'120','aria-label':'New category name'}),status=el('span',{role:'status'});
  const add=el('button',{type:'submit',text:'Add category'});
  const form=el('form',{class:'category-line'},[el('div',{class:'name'},[newName]),add,status]);
  form.addEventListener('submit',async e=>{e.preventDefault();add.disabled=true;try{await api(endpoint('categories'),'POST',{name:newName.value,is_active:true});await loadMenu('Category added.');}catch(error){status.textContent=error.message;add.disabled=false;}});
  section.append(form);return section;
}
async function loadMenu(message){
  try{
    model=await api('/api/'+(adminMode?'admin/':'')+'restaurants/'+encodeURIComponent(slug)+'/menu');
    if(adminMode)adminMenu(message);else publicMenu();
  }catch(error){
    if(adminMode && !token)login(error.message);
    else app.replaceChildren(notice(error.message),link('/admin','Return to sign in'));
  }
}
async function start(){
  try{restaurantList=await api('/api/restaurants');}catch(error){app.replaceChildren(notice(error.message));return;}
  if(adminMode)login();else await loadMenu();
}
start();
`;
