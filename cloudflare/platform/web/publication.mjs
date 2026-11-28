export const publicationScript=String.raw`
async function publicationControls(id,box,state=null) {
  const panel=el('div'),status=el('p','Loading publication…',{role:'status'});
  panel.className='publication-panel';panel.append(el('h2','Preview & publish'),status);box.append(panel);
  try {
    const base='/api/restaurants/'+encodeURIComponent(id);
    const [publication,draft]=state||await Promise.all([api(base+'/publication'),api(base+'/config')]);
    if(!root.contains(panel))return;
    const changed=publication.active&&publication.config_revision!==draft.revision;
    status.textContent=publication.active?(changed?'Unpublished changes. Guests still see your published menu.':'Your menu is live. Saved changes appear only after publishing.'):'Your menu is unpublished. Preview your saved menu, then publish when it is ready.';
    if(publication.published_at){const stamp=publication.published_at.replace(' ','T')+'Z';panel.append(el('time','Last published '+new Date(stamp).toLocaleString(),{datetime:stamp,class:'publication-time'}));}
    const actions=el('div',null,{class:'actions'});
    const preview=el('a','Preview saved menu',{href:'/preview/'+encodeURIComponent(id),target:'_blank',rel:'noopener noreferrer',class:'action-link'});
    actions.append(preview);
    if(publication.active)actions.append(el('a','View live menu',{href:publication.url,target:'_blank',rel:'noopener noreferrer',class:'action-link'}));
    function change(action,body) {
      if(panel.querySelector('[data-publication-confirm]'))return;
      const previous=document.activeElement;
      const question=el('section',null,{class:'notice','data-publication-confirm':'1',role:'group','aria-label':'Confirm publication'});
      question.append(el('h3',action==='publish'?'Publish your menu?':'Unpublish this menu?'),el('p',action==='publish'?'Your saved menu will become visible to guests at the same permanent link.':'Guests will no longer be able to open this menu. Saved menu content will be kept.'));
      const choices=el('div',null,{class:'actions'});
      const yes=button(action==='publish'?'Confirm publish':'Confirm unpublish',async()=>{question.remove();await applyChange(action,body);});
      choices.append(yes,button('Cancel',()=>{question.remove();if(previous?.isConnected)previous.focus();},true));
      question.append(choices);panel.append(question);yes.focus();
    }
    async function applyChange(action,body) {
      flash.replaceChildren();status.textContent=action==='publish'?'Publishing…':'Removing public access…';
      for(const control of panel.querySelectorAll('button'))control.disabled=true;
      try {
        await api(base+'/'+action,body);
        await overview(id);flash.textContent=action==='publish'?'Menu published.':'Public menu access removed.';
      } catch(error) {
        status.textContent=error.message;
        for(const control of panel.querySelectorAll('button'))control.disabled=false;
      }
    }
    const publish=button(publication.active?'Publish changes':'Publish menu',()=>change('publish',{revision:draft.revision,policy_revision:draft.policy_revision,publication_revision:publication.publication_revision}),true);
    publish.classList.add('publish-action');publish.disabled=activeRestaurant?.status==='suspended';actions.append(publish);
    if(publication.active){const more=el('details',null,{class:'publication-more'});more.append(el('summary','Publication options'),button('Unpublish menu',()=>change('unpublish',{publication_revision:publication.publication_revision}),true));panel.append(more);}
    panel.append(actions);
  } catch(error) {status.textContent=error.message;}
}
`;

