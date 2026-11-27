// Shares the account shell's DOM helpers and authenticated API client.
export const directoryScript=String.raw`
async function dashboard(offset=0,search='') {
  dashboardShell(null,'restaurants');
  root.replaceChildren();
  navigate(me.role==='super_admin'?'/platform':'/manage');
  const box=el('section'), cards=el('div',null,{class:'cards'}), status=el('p','Loading restaurants…',{role:'status'});
  const heading=pageHeading(me.role==='super_admin'?'Platform dashboard':'Your restaurants',me.role==='super_admin'?'ADMAKI MENU ADMIN':'RESTAURANT MANAGER');
  const stats=el('div',null,{class:'stats-grid'});box.append(el('h2','Restaurant tenants'));
  const searchForm=el('form'), query=el('input',null,{id:'restaurant-search',type:'search',maxlength:'120'});
  query.value=search;
  searchForm.append(el('label','Find a restaurant',{for:query.id}),query,el('button','Search',{type:'submit'}));
  searchForm.onsubmit=event=>{event.preventDefault();dashboard(0,query.value.trim());};
  box.append(searchForm,status,cards);
  if(me.role==='super_admin') {
    const actions=el('div',null,{class:'actions'});
    actions.append(button('Create restaurant',createRestaurant),button('Manage accounts',()=>accounts(),true),button('Platform features',platformFeatures,true));
    box.append(actions);
  }
  root.append(heading,stats,box);
  try {
    const data=await api('/api/restaurants?offset='+offset+'&search='+encodeURIComponent(search));
    if(!root.contains(box))return;
    status.textContent=data.restaurants.length?'':'No restaurants found.';
    stats.replaceChildren(stat('Restaurants',data.restaurants.length,'Current results','restaurants'),stat('Active',data.restaurants.filter(r=>r.status==='active').length,'Current results','overview'),stat('Draft',data.restaurants.filter(r=>r.status==='draft').length,'Current results','menu'),stat('Public access','QR','No guest sign-in','qr'));
    for(const restaurant of data.restaurants) {
      const card=button(restaurant.name,()=>overview(restaurant.id));
      card.append(el('small',restaurant.slug+' · '+restaurant.status));cards.append(card);
    }
    const pages=el('div',null,{class:'actions'});
    if(offset)pages.append(button('Previous restaurants',()=>dashboard(Math.max(0,offset-50),search),true));
    if(data.next_offset!==null)pages.append(button('Next restaurants',()=>dashboard(data.next_offset,search),true));
    box.append(pages);
  } catch(error) {
    if(root.contains(box)){status.textContent=error.message;status.setAttribute('role','alert');box.append(button('Retry',()=>dashboard(offset,search),true));}
  }
}

async function createRestaurant() {
  setActive('restaurants');
  const loading=el('section','Loading onboarding options…');root.replaceChildren(loading);
  try {
    const options=await api('/api/platform/onboarding-options');
    if(!root.contains(loading))return;
    if(!options.templates.length||!options.presets.length)throw Error('No supported templates or presets are available.');
    const {box,f,inputs}=form('Create restaurant','Choose the starting configuration for a new draft.',[
      {name:'name',label:'Restaurant name'},{name:'slug',label:'Restaurant slug'}
    ],'Create draft',async body=>{
      const [preset_id,preset_version]=preset.input.value.split(':');
      const [template_id,template_version]=template.input.value.split(':');
      const result=await privileged('/api/platform/restaurants',{...body,preset_id,preset_version:Number(preset_version),template_id,template_version:Number(template_version)});
      await overview(result.restaurant.id);
      flash.textContent='Restaurant draft created. Add settings and manager access when ready.';
    });
    inputs.name.maxLength=120;inputs.slug.maxLength=80;inputs.slug.pattern='[a-z0-9]+(-[a-z0-9]+)*';
    const preset=selectField('onboard-preset','Configuration preset',options.presets.map(p=>[p.preset_id+':'+p.version,p.name+' · v'+p.version]),options.presets[0].preset_id+':'+options.presets[0].version);
    const template=selectField('onboard-template','Menu template',options.templates.map(t=>[t.template_id+':'+t.version,t.name+' · v'+t.version]),options.templates[0].template_id+':'+options.templates[0].version);
    f.insertBefore(preset.wrap,f.querySelector('.actions'));f.insertBefore(template.wrap,f.querySelector('.actions'));
    f.querySelector('.actions').append(button('Cancel',()=>dashboard(),true));
    root.replaceChildren(box);
  } catch(error) {
    if(root.contains(loading))root.replaceChildren(el('p',error.message,{role:'alert'}),button('Back to dashboard',()=>dashboard(),true));
  }
}

function restaurantPicker(initialId) {
  const selected=new Set(initialId?[initialId]:[]),wrap=el('section'),list=el('div'),status=el('p','',{role:'status'});
  const searchForm=el('div'),query=el('input',null,{type:'search',id:'manager-restaurant-search',maxlength:'120'});
  wrap.append(el('h2','Restaurant access'));
  searchForm.append(el('label','Find restaurants',{for:query.id}),query,button('Find restaurants',()=>load(0,query.value.trim()),true));
  wrap.append(searchForm,status,list);
  query.onkeydown=event=>{if(event.key==='Enter'){event.preventDefault();load(0,query.value.trim());}};
  let generation=0;
  async function load(offset,search) {
    const current=++generation;status.textContent='Loading restaurants…';list.replaceChildren();
    try {
      const data=await api('/api/restaurants?offset='+offset+'&search='+encodeURIComponent(search));
      if(current!==generation)return;
      status.textContent=selected.size+' selected'+(data.restaurants.length?'':' · No restaurants found.');
      for(const restaurant of data.restaurants) {
        const choice=check(restaurant.name+' · '+restaurant.slug,selected.has(restaurant.id));
        choice.input.onchange=()=>{
          if(choice.input.checked&&selected.size>=10){choice.input.checked=false;status.textContent='Choose up to 10 restaurants.';return;}
          if(choice.input.checked)selected.add(restaurant.id);else selected.delete(restaurant.id);
          status.textContent=selected.size+' selected';
        };
        list.append(choice.row);
      }
      const pages=el('div',null,{class:'actions'});
      if(offset)pages.append(button('Previous choices',()=>load(Math.max(0,offset-50),search),true));
      if(data.next_offset!==null)pages.append(button('Next choices',()=>load(data.next_offset,search),true));
      list.append(pages);
    } catch(error) {
      if(current===generation){status.textContent=error.message;list.append(button('Retry choices',()=>load(offset,search),true));}
    }
  }
  load(0,'');
  return {wrap,selected};
}
`;

