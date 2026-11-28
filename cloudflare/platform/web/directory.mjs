// Shares the account shell's DOM helpers and authenticated API client.
export const directoryScript=String.raw`
async function openRestaurantTool(restaurant,tool) {
  flash.replaceChildren();
  navigate('/manage/'+encodeURIComponent(restaurant.id));
  dashboardShell(restaurant,tool==='qr'?'qr':'menu');
  if(tool==='qr')return qrScreen(restaurant.id);
  return menuScreen(restaurant.id);
}
async function dashboard(offset=0,search='',filter='all',showTests=false) {
  dashboardShell(null,'restaurants');
  root.replaceChildren();
  navigate(me.role==='super_admin'?'/platform':'/manage');
  const box=el('section',null,{class:'restaurant-directory'}),cards=el('div',null,{class:'restaurant-grid'}),status=el('p','Loading restaurants…',{role:'status',class:'directory-results'});
  const heading=pageHeading(me.role==='super_admin'?'Restaurants':'Your restaurants',me.role==='super_admin'?'ADMAKI MENU ADMIN':'RESTAURANT MANAGER');
  heading.querySelector('div').append(el('p','Choose a restaurant to edit its menu, preview changes or manage its QR code.'));
  if(me.role==='super_admin')heading.append(button('Create restaurant',createRestaurant));
  const stats=el('div',null,{class:'stats-grid'});box.append(el('h2','Restaurant menus'));
  if(!useProductionLogin){
    const note=el('div',null,{class:'workspace-notice'});
    note.append(el('strong','Staging workspace'),el('p','These are sample restaurants for testing. Your live restaurant menus are managed in production.'),el('a','Open production dashboard',{href:'https://app.admakidigital.com/login',target:'_blank',rel:'noopener noreferrer'}));
    box.append(note);
  }
  const searchForm=el('form',null,{class:'directory-filters'}),query=el('input',null,{id:'restaurant-search',type:'search',maxlength:'120',placeholder:'Search by restaurant name'});
  query.value=search;
  const searchField=el('div',null,{class:'directory-search'});searchField.append(el('label','Find a restaurant',{for:query.id}),query);
  const state=selectField('restaurant-status','Status',[['all','All statuses'],['active','Active'],['draft','Draft'],['suspended','Suspended']],filter);
  searchForm.append(searchField,state.wrap,el('button','Search',{type:'submit'}));
  let tests;
  if(!useProductionLogin){tests=check('Show test restaurants',showTests);tests.row.classList.add('fixture-filter');searchForm.append(tests.row);}
  const reload=()=>dashboard(0,query.value.trim(),state.input.value,tests?.input.checked||false);
  searchForm.onsubmit=event=>{event.preventDefault();reload();};
  state.input.onchange=reload;if(tests)tests.input.onchange=reload;
  box.append(searchForm,status,cards);
  root.append(heading,stats,box);
  try {
    const data=await api('/api/restaurants?offset='+offset+'&search='+encodeURIComponent(search)+'&status='+encodeURIComponent(filter)+'&include_tests='+(showTests?'1':'0'));
    if(!root.contains(box))return;
    const totals=data.summary;
    status.textContent=totals.total?'Showing '+(offset+1)+'–'+(offset+data.restaurants.length)+' of '+totals.total+' restaurants':'No restaurants match these filters.';
    stats.replaceChildren(stat('Restaurants',totals.total,'Matching your filters','restaurants'),stat('Active',totals.active,'Matching your filters','overview'),stat('Draft',totals.draft,'Matching your filters','menu'),stat('Suspended',totals.suspended,'Matching your filters','restaurants'));
    for(const restaurant of data.restaurants) {
      const card=el('article',null,{class:'restaurant-card'}),head=el('div',null,{class:'restaurant-card-heading'}),copy=el('div');
      const title=el('h3'),open=button(restaurant.name,()=>overview(restaurant.id),true);open.className='restaurant-name';title.append(open);
      copy.append(title,el('p','/r/'+restaurant.slug,{class:'restaurant-slug'}));
      head.append(el('span',restaurant.name.slice(0,2).toUpperCase(),{class:'restaurant-monogram','aria-hidden':'true'}),copy);
      card.append(head,el('span',restaurant.status[0].toUpperCase()+restaurant.status.slice(1),{class:'status-chip status-'+restaurant.status}));
      const actions=el('div',null,{class:'restaurant-card-actions'});
      actions.append(button('Edit menu',()=>openRestaurantTool(restaurant,'menu')),el('a','Preview',{class:'action-link',href:'/preview/'+encodeURIComponent(restaurant.id),target:'_blank',rel:'noopener noreferrer'}),button('QR code',()=>openRestaurantTool(restaurant,'qr'),true));
      card.append(actions);cards.append(card);
    }
    const pages=el('div',null,{class:'actions'});
    if(offset)pages.append(button('Previous restaurants',()=>dashboard(Math.max(0,offset-50),search,filter,showTests),true));
    if(data.next_offset!==null)pages.append(button('Next restaurants',()=>dashboard(data.next_offset,search,filter,showTests),true));
    box.append(pages);
  } catch(error) {
    if(root.contains(box)){status.textContent=error.message;status.setAttribute('role','alert');box.append(button('Retry',()=>dashboard(offset,search,filter,showTests),true));}
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

