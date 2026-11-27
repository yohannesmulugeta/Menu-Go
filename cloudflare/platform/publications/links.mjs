// Decode exactly one path segment. Invalid links must never select another menu.
export function menuSlug(segment) {
  let slug;
  try { slug=decodeURIComponent(segment); } catch { return null; }
  return /^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(slug)&&slug.length<=80?slug:null;
}

// Fragments never reach the server. This small client adapter preserves old QR
// links without carrying arbitrary redirects, preview flags or private queries.
export function legacyMenuTarget(hash) {
  if(!/^#\/r(?:\/|\?|$)/.test(hash))return null;
  const match=/^#\/r\/([^/?#]+)\/?(?:\?([^#]*))?$/.exec(hash);
  if(!match)return '';
  let slug;
  try { slug=decodeURIComponent(match[1]); } catch { return ''; }
  if(!/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(slug)||slug.length>80)return '';
  const locale=new URLSearchParams(match[2]||'').get('locale');
  return '/r/'+encodeURIComponent(slug)+(['en','am','om','ti'].includes(locale)?'?locale='+locale:'');
}
