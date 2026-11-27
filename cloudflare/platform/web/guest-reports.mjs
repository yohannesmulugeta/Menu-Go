export const guestReportsScript=String.raw`
async function guestReport(id,type,offset=0) {
  setActive(type);
  const box=el('section'),status=el('p','Loading…',{role:'status'});
  box.append(el('h1',type==='feedback'?'Feedback inbox':'Menu analytics'),status,button('Back to restaurant',()=>overview(id),true));root.replaceChildren(box);
  try {
    const data=await api('/api/restaurants/'+encodeURIComponent(id)+'/'+type+'?offset='+offset);
    if(!root.contains(box))return;
    if(type==='feedback') {
      status.textContent=data.feedback.length?'':'No feedback yet.';
      for(const entry of data.feedback) {
        const row=el('div',null,{class:'row'}),content=el('div');
        content.append(el('p',entry.message),el('small',entry.created_at+(entry.rating?' · Rating '+entry.rating+'/5':'')));
        row.append(content);box.append(row);
      }
      const pages=el('div',null,{class:'actions'});
      if(offset)pages.append(button('Previous feedback',()=>guestReport(id,type,Math.max(0,offset-50)),true));
      if(data.next_offset!==null)pages.append(button('Next feedback',()=>guestReport(id,type,data.next_offset),true));
      box.append(pages);
    } else {
      status.textContent=data.events.length?'Last '+data.days+' days':'No menu events in the last '+data.days+' days.';
      for(const entry of data.events)box.append(el('p',entry.day+' · '+entry.event_type.replaceAll('_',' ')+' · '+entry.count));
    }
  } catch(error) {status.textContent=error.message;status.setAttribute('role','alert');}
}
`;

