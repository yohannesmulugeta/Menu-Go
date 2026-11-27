export const menuScript=String.raw`
const menuBase=id=>'/api/restaurants/'+encodeURIComponent(id)+'/menu';
function menuForm(title,submit,save) {
  const box=el('section'),f=el('form'),error=el('p','',{class:'error',role:'alert'}),actions=el('div',null,{class:'actions'}),b=el('button',submit,{type:'submit'});
  box.append(el('h1',title),f);actions.append(b);f.append(error,actions);
  f.onsubmit=async event=>{
    event.preventDefault();flash.replaceChildren();error.textContent='';b.disabled=true;b.textContent='Saving…';
    try {await save();}catch(e){error.textContent=e.message;}finally{b.disabled=false;b.textContent=submit;}
  };
  return {box,f,error,actions};
}
function insertMenuFields(editor,fields) {for(const field of fields)editor.f.insertBefore(field.wrap||field.row,editor.error);}
async function menuScreen(id,kind='items',offset=0,search='') {
  const box=el('section'),status=el('p','Loading menu…',{role:'status'}),rows=el('div'),actions=el('div',null,{class:'actions'});
  box.append(el('h1',kind==='items'?'Menu items':'Categories'),status);
  actions.append(button('Menu items',()=>menuScreen(id)),button('Categories',()=>menuScreen(id,'categories'),true),button('Opening hours',()=>menuHours(id),true),button('Back to restaurant',()=>overview(id),true));box.append(actions);
  const f=el('form'),query=el('input',null,{type:'search',id:'menu-search',maxlength:'120'});query.value=search;
  f.append(el('label','Find '+kind,{for:query.id}),query,el('button','Search',{type:'submit'}));f.onsubmit=e=>{e.preventDefault();menuScreen(id,kind,0,query.value.trim());};
  box.append(f,rows);root.replaceChildren(box);
  try {
    const data=await api(menuBase(id)+'/'+kind+'?offset='+offset+'&search='+encodeURIComponent(search));
    if(!root.contains(box))return;
    status.textContent=data.restaurant.name+(data[kind].length?'':' · No '+kind+' found.');
    const add=button(kind==='items'?'Add item':'Add category',()=>kind==='items'?menuItemForm(id):menuCategoryForm(id,null,data));
    if(kind==='categories'&&!data.editable['menu.categories']){add.disabled=true;box.append(el('p','Category editing is locked by platform settings.'));}
    actions.prepend(add);
    for(const entry of data[kind]) {
      const row=el('div',null,{class:'row'}),content=el('div');
      content.append(el('h2',entry.name));
      const details=kind==='categories'?(entry.is_active?'Visible':'Hidden')+' · Order '+entry.sort_order:new Intl.NumberFormat('en',{minimumFractionDigits:2,maximumFractionDigits:2}).format(entry.price)+' '+data.restaurant.currency+' · '+(entry.is_available?'Available':'Unavailable')+(entry.category_name?' · '+entry.category_name:'')+(entry.category_id&&(!entry.category_active||entry.category_deleted_at)?' · Category hidden':'');
      content.append(el('small',details));row.append(content);
      const edit=button('Edit '+entry.name,()=>kind==='items'?menuItemForm(id,entry.id):menuCategoryForm(id,entry,data),true);
      edit.disabled=kind==='categories'&&!data.editable['menu.categories'];row.append(edit);rows.append(row);
    }
    const pages=el('div',null,{class:'actions'});
    if(offset)pages.append(button('Previous '+kind,()=>menuScreen(id,kind,Math.max(0,offset-50),search),true));
    if(data.next_offset!==null)pages.append(button('Next '+kind,()=>menuScreen(id,kind,data.next_offset,search),true));
    rows.append(pages);
  }catch(e){if(root.contains(box)){status.textContent=e.message;box.append(button('Retry menu',()=>menuScreen(id,kind,offset,search),true));}}
}
function menuCategoryForm(id,category,data) {
  const editor=menuForm(category?'Edit category':'Add category','Save category',async()=>{
    await api(menuBase(id)+'/categories'+(category?'/'+encodeURIComponent(category.id):''),{revision:data.revision,policy_revision:data.policy_revision,name:name.input.value,sort_order:Number(order.input.value),is_active:active.input.checked},category?'PATCH':'POST');
    await menuScreen(id,'categories');flash.textContent='Category saved to draft.';
  });
  const name=field('category-name','Category name',category?.name||'',{max:120}),order=field('category-order','Sort order',category?.sort_order??0,{type:'number'}),active=check('Category visible',category?!!category.is_active:true);
  name.input.required=true;order.input.step='1';order.input.required=true;
  insertMenuFields(editor,[name,order,active]);
  editor.f.insertBefore(el('p','Hidden categories hide their items in the next published menu.'),editor.error);
  editor.actions.append(button('Cancel',()=>menuScreen(id,'categories'),true));root.replaceChildren(editor.box);
}
function menuCategoryPicker(id,item,f,locked) {
  const wrap=el('div',null,{'data-category-picker':''}),query=el('input',null,{type:'search',id:'item-category-search',maxlength:'120'}),select=el('select',null,{id:'item-category'});
  let selected=item?.category_id||'',selectedName=item?.category_name||'Selected category',generation=0;
  wrap.append(el('label','Category',{for:select.id}),select);
  if(locked){select.append(el('option',selected?selectedName:'Uncategorized',{value:selected}));select.disabled=true;return {wrap,value:()=>selected};}
  wrap.append(el('label','Find categories',{for:query.id}),query);
  const controls=el('div',null,{class:'actions'}),pages=el('div',null,{class:'actions'}),status=el('p','',{role:'status'});
  controls.append(button('Find categories',()=>load(0,query.value.trim()),true));wrap.append(controls,status,pages);
  select.onchange=()=>{selected=select.value;selectedName=select.selectedOptions[0].textContent;f.dataset.dirty='1';};
  query.onkeydown=e=>{if(e.key==='Enter'){e.preventDefault();load(0,query.value.trim());}};
  async function load(offset,search) {
    const current=++generation;status.textContent='Loading categories…';
    try {
      const data=await api(menuBase(id)+'/categories?offset='+offset+'&search='+encodeURIComponent(search));
      if(current!==generation)return;
      select.replaceChildren(el('option','Uncategorized',{value:''}));
      if(selected&&!data.categories.some(c=>c.id===selected))select.append(el('option',selectedName,{value:selected}));
      for(const c of data.categories)select.append(el('option',c.name+(c.is_active?'':' (hidden)'),{value:c.id}));
      select.value=selected;pages.replaceChildren();
      if(offset)pages.append(button('Previous category choices',()=>load(Math.max(0,offset-50),search),true));
      if(data.next_offset!==null)pages.append(button('Next category choices',()=>load(data.next_offset,search),true));
      status.textContent=data.categories.length?'':'No categories found.';
    }catch(e){if(current===generation)status.textContent=e.message;}
  }
  load(0,'');return {wrap,value:()=>selected};
}
async function menuItemForm(id,itemId) {
  const loading=el('section','Loading item…');root.replaceChildren(loading);
  try {
    const data=await api(menuBase(id)+'/items'+(itemId?'/'+encodeURIComponent(itemId):''));
    if(!root.contains(loading))return;
    const item=data.item||{name:'',description:'',price:0,is_available:1,is_popular:0,sort_order:0,category_id:null};
    const editor=menuForm(itemId?'Edit item':'Add item','Save item',async()=>{
      const result=await api(menuBase(id)+'/items'+(itemId?'/'+encodeURIComponent(itemId):''),{
        revision:data.revision,policy_revision:data.policy_revision,...(itemId?{version:item.version}:{}),
        name:name.input.value,description:description.input.value,price:Number(price.input.value),category_id:category.value()||null,
        sort_order:Number(order.input.value),is_available:available.input.checked,is_popular:popular.input.checked
      },itemId?'PATCH':'POST');
      await menuItemForm(id,result.id);flash.textContent='Item saved to draft.';
    });
    const name=field('item-name','Item name',item.name,{max:200}),description=field('item-description','Description',item.description||'',{type:'textarea',max:3000,disabled:!data.editable['menu.descriptions']}),price=field('item-price','Price ('+data.restaurant.currency+')',item.price,{type:'number'}),order=field('item-order','Sort order',item.sort_order,{type:'number'}),available=check('Available',!!item.is_available),popular=check('Popular',!!item.is_popular,!data.editable['menu.popular']);
    name.input.required=true;price.input.min='0';price.input.max='9999999.99';price.input.step='0.01';price.input.required=true;order.input.step='1';order.input.required=true;
    const category=menuCategoryPicker(id,item,editor.f,!data.editable['menu.categories']);
    insertMenuFields(editor,[name,description,price,category,order,available,popular]);
    editor.f.addEventListener('input',event=>{if(!event.target.closest('[data-category-picker]'))editor.f.dataset.dirty='1';});
    editor.actions.append(button('Back to items',()=>menuScreen(id),true),button('Restaurant settings',()=>settings(id),true));
    root.replaceChildren(editor.box);
    if(itemId){menuItemPhoto(id,itemId,data,editor.f);menuItemExtras(id,itemId,data,editor.f);}
  }catch(e){if(root.contains(loading))root.replaceChildren(el('p',e.message,{role:'alert'}),button('Back to items',()=>menuScreen(id),true));}
}
`;

