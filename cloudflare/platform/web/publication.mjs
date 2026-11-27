export const publicationScript=String.raw`
async function publicationControls(id,box) {
  const panel=el('div'),status=el('p','Loading publication…',{role:'status'});
  panel.append(el('h2','Publication'),status);box.append(panel);
  try {
    const base='/api/restaurants/'+encodeURIComponent(id);
    const [publication,draft]=await Promise.all([api(base+'/publication'),api(base+'/config')]);
    if(!root.contains(panel))return;
    status.textContent=publication.active?'Published version '+publication.publication_revision+' · Saved draft version '+draft.revision:'Saved draft version '+draft.revision;
    const actions=el('div',null,{class:'actions'});
    const preview=el('a','Preview saved draft',{href:'/preview/'+encodeURIComponent(id),target:'_blank',rel:'noopener noreferrer'});
    actions.append(preview);
    if(publication.active)actions.append(el('a','Open public menu',{href:publication.url,target:'_blank',rel:'noopener noreferrer'}));
    async function change(action,body) {
      if(!confirm(action==='publish'?'Publish saved draft version '+draft.revision+' to the staging menu URL?':'Remove public access to this menu?'))return;
      flash.replaceChildren();status.textContent=action==='publish'?'Publishing…':'Removing public access…';
      for(const control of actions.querySelectorAll('button'))control.disabled=true;
      try {
        await api(base+'/'+action,body);
        await overview(id);flash.textContent=action==='publish'?'Menu published.':'Public menu access removed.';
      } catch(error) {
        status.textContent=error.message;
        for(const control of actions.querySelectorAll('button'))control.disabled=false;
      }
    }
    actions.append(button('Publish saved draft',()=>change('publish',{revision:draft.revision,policy_revision:draft.policy_revision,publication_revision:publication.publication_revision})));
    if(publication.active)actions.append(button('Unpublish menu',()=>change('unpublish',{publication_revision:publication.publication_revision}),true));
    actions.append(button('Feedback inbox',()=>guestReport(id,'feedback'),true));
    if(draft.effective['analytics.dashboard'].enabled)actions.append(button('Analytics',()=>guestReport(id,'analytics'),true));
    panel.append(actions);
  } catch(error) {status.textContent=error.message;}
}
`;

