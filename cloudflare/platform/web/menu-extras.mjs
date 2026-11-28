export const menuExtrasScript=String.raw`
function menuItemPhoto(id,itemId,data,f) {
  const box=el('section'),input=el('input',null,{type:'file',id:'menu-item-photo',accept:'image/png,image/jpeg,image/webp,image/avif'}),status=el('p','',{role:'status'});
  box.append(el('h2','Item photo'),el('label','Choose item photo',{for:input.id}),input,status);
  input.disabled=!data.editable['menu.item_images'];
  if(data.item.image_url)box.append(el('img',null,{src:data.item.image_url,alt:'Current item photo',class:'editor-photo'}));
  input.onchange=async()=>{
    if(!input.files?.[0])return;
    if(f.dataset.dirty){status.textContent='Save item changes before changing the photo.';input.value='';return;}
    flash.replaceChildren();input.disabled=true;remove.disabled=true;f.setAttribute('inert','');status.textContent='Preparing image…';
    try {
      const bytes=await convertImage(input.files[0]),response=await fetch('/api/restaurants/'+encodeURIComponent(id)+'/media?kind=item&item_id='+encodeURIComponent(itemId),{method:'POST',headers:{'Content-Type':'image/png','X-Menu-Request':'1'},body:bytes,credentials:'same-origin',cache:'no-store'});
      const uploaded=await response.json();if(!response.ok)throw Error(uploaded.error||'Unable to upload the photo.');
      await api('/api/restaurants/'+encodeURIComponent(id)+'/media-attachment',{kind:'item',item_id:itemId,media_id:uploaded.id,revision:data.revision,policy_revision:data.policy_revision},'PATCH');
      if(root.contains(box))await menuItemForm(id,itemId);flash.textContent='Item photo saved to draft.';
    }catch(e){status.textContent=e.message;}finally{f.removeAttribute('inert');input.disabled=!data.editable['menu.item_images'];remove.disabled=!data.editable['menu.item_images']||!data.item.image_url;input.value='';}
  };
  const remove=button('Remove photo from draft',async()=>{
    if(f.dataset.dirty){status.textContent='Save item changes before changing the photo.';return;}
    flash.replaceChildren();input.disabled=true;remove.disabled=true;f.setAttribute('inert','');
    try {
      await api('/api/restaurants/'+encodeURIComponent(id)+'/media-attachment',{kind:'item',item_id:itemId,media_id:null,revision:data.revision,policy_revision:data.policy_revision},'PATCH');
      if(root.contains(box))await menuItemForm(id,itemId);flash.textContent='Photo removed from draft.';
    }catch(e){status.textContent=e.message;}finally{f.removeAttribute('inert');input.disabled=!data.editable['menu.item_images'];remove.disabled=!data.editable['menu.item_images']||!data.item.image_url;}
  },true);
  remove.disabled=!data.editable['menu.item_images']||!data.item.image_url;box.append(remove);
  root.append(box);
}
function variantPriceText(value) {return Math.floor(value/100)+'.'+String(value%100).padStart(2,'0');}
function variantMinor(value) {
  if(!/^\d+(\.\d{1,2})?$/.test(value))throw Error('Enter a non-negative price with at most two decimals.');
  const [whole,fraction='']=value.split('.'),minor=BigInt(whole)*100n+BigInt(fraction.padEnd(2,'0'));
  if(minor>BigInt(Number.MAX_SAFE_INTEGER))throw Error('The variant price is too large.');
  return Number(minor);
}
function menuItemExtras(id,itemId,data,f) {
  function openEditor(open){if(f.dataset.dirty||f.hasAttribute('inert')){flash.textContent='Save item changes and finish photo uploads before editing variants or translations.';return;}open();}
  const variants=el('section');variants.append(el('h2','Sizes and variants'),el('p','Visibility follows Sizes and variants in restaurant settings.'));
  const add=button('Add variant',()=>openEditor(()=>menuVariantForm(id,itemId,null,data)));add.disabled=!data.editable['menu.variants'];variants.append(add);
  for(const variant of data.variants) {
    const row=el('div',null,{class:'row'});row.append(el('span',variant.label+' · '+variantPriceText(variant.price_minor)+' '+data.restaurant.currency+' · '+(variant.is_active?'Visible':'Hidden')));
    const edit=button('Edit variant '+variant.label,()=>openEditor(()=>menuVariantForm(id,itemId,variant,data)),true);edit.disabled=!data.editable['menu.variants'];row.append(edit);variants.append(row);
  }
  if(!data.variants.length)variants.append(el('p','No variants yet.'));
  const translations=el('section');translations.append(el('h2','Translations'),el('p','Translations appear for languages enabled in restaurant settings.'));
  const translationActions=el('div',null,{class:'actions'});translations.append(translationActions);
  for(const [locale,label] of [['am','Amharic'],['om','Oromo'],['ti','Tigrinya']]) {
    const existing=data.translations.find(t=>t.locale===locale),b=button((existing?'Edit ':'Add ')+label+' translation',()=>openEditor(()=>menuTranslationForm(id,itemId,locale,label,existing,data)),true);b.disabled=!data.editable['guest.language'];translationActions.append(b);
  }
  root.append(variants,translations);
}
function menuVariantForm(id,itemId,variant,data) {
  const editor=menuForm(variant?'Edit variant':'Add variant','Save variant',async()=>{
    await api(menuBase(id)+'/items/'+encodeURIComponent(itemId)+'/variants'+(variant?'/'+encodeURIComponent(variant.id):''),{revision:data.revision,policy_revision:data.policy_revision,label:label.input.value,price_minor:variantMinor(price.input.value),sort_order:Number(order.input.value),is_active:active.input.checked},variant?'PATCH':'POST');
    await menuItemForm(id,itemId);flash.textContent='Variant saved to draft.';
  });
  const label=field('variant-label','Variant label',variant?.label||'',{max:120}),price=field('variant-price','Price ('+data.restaurant.currency+')',variant?variantPriceText(variant.price_minor):'0.00'),order=field('variant-order','Sort order',variant?.sort_order??0,{type:'number'}),active=check('Variant visible',variant?!!variant.is_active:true);
  label.input.required=true;price.input.required=true;price.input.inputMode='decimal';order.input.step='1';order.input.required=true;
  insertMenuFields(editor,[label,price,order,active]);editor.actions.append(button('Cancel',()=>menuItemForm(id,itemId),true));root.replaceChildren(editor.box);
}
function menuTranslationForm(id,itemId,locale,label,translation,data) {
  const editor=menuForm(label+' translation','Save translation',async()=>{
    await api(menuBase(id)+'/items/'+encodeURIComponent(itemId)+'/translations/'+locale,{revision:data.revision,policy_revision:data.policy_revision,name:name.input.value,description:description.input.value},'PATCH');
    await menuItemForm(id,itemId);flash.textContent='Translation saved to draft.';
  });
  const name=field('translation-name','Translated item name',translation?.name||'',{max:200}),description=field('translation-description','Translated description',translation?.description||'',{type:'textarea',max:3000});
  name.input.required=true;insertMenuFields(editor,[name,description]);editor.actions.append(button('Cancel',()=>menuItemForm(id,itemId),true));root.replaceChildren(editor.box);
}
async function menuHours(id) {
  setActive('hours');
  const loading=el('section','Loading opening hours…');root.replaceChildren(loading);
  try {
    const data=await api(menuBase(id)+'/hours');if(!root.contains(loading))return;
    const box=el('section');box.append(el('h1','Opening hours'),el('p','Times use '+data.timezone+'.'),button('Back to restaurant',()=>overview(id),true));
    for(const [weekday,label] of ['Sunday','Monday','Tuesday','Wednesday','Thursday','Friday','Saturday'].entries()) {
      const day=data.hours.find(h=>h.weekday===weekday),row=el('div',null,{class:'row'});
      row.append(el('span',label+' · '+(!day?'Not set':day.is_closed?'Closed':day.opens_at+'–'+day.closes_at)));
      const edit=button('Edit '+label,()=>menuHoursForm(id,weekday,label,day,data),true);edit.disabled=!data.editable['guest.hours'];row.append(edit);box.append(row);
    }
    if(!data.editable['guest.hours'])box.append(el('p','Opening hours are locked by platform settings.'));
    root.replaceChildren(box);
  }catch(e){if(root.contains(loading))root.replaceChildren(el('p',e.message,{role:'alert'}),button('Back to restaurant',()=>overview(id),true));}
}
function menuHoursForm(id,weekday,label,day,data) {
  const editor=menuForm(label+' opening hours','Save hours',async()=>{
    await api(menuBase(id)+'/hours/'+weekday,{revision:data.revision,policy_revision:data.policy_revision,opens_at:opens.input.value||null,closes_at:closes.input.value||null,is_closed:closed.input.checked},'PATCH');
    await menuHours(id);flash.textContent='Opening hours saved to draft.';
  });
  const opens=field('opens-at','Opens at',day?.opens_at||'',{type:'time'}),closes=field('closes-at','Closes at',day?.closes_at||'',{type:'time'}),closed=check('Closed',!!day?.is_closed);
  function sync(){opens.input.required=closes.input.required=!closed.input.checked;opens.input.disabled=closes.input.disabled=closed.input.checked;}
  closed.input.onchange=sync;sync();insertMenuFields(editor,[closed,opens,closes]);editor.actions.append(button('Cancel',()=>menuHours(id),true));root.replaceChildren(editor.box);
}
`;

