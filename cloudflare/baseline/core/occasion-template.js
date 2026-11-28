export const OCCASION_ID = "895adc6a-cc13-5695-ad79-26d60c57c6d0";
export const LOGO_PATH = `/media/${OCCASION_ID}/occasion-logo-v1.png`;
export const STYLE_PATH = "/occasion-assets/menu.css";
export const SCRIPT_PATH = "/occasion-assets/menu.js";

const escape = (value) => String(value ?? "").replace(/[&<>"']/g, c => ({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"}[c]));

function safeUrl(value) {
  if (typeof value !== "string" || !value) return null;
  if (/^\/(?!\/)[a-zA-Z0-9/_.-]+$/.test(value)) return value;
  try {
    const url = new URL(value);
    if (url.protocol === "https:" && !url.username && !url.password) return url.href;
  } catch { /* Missing and unsafe URLs are omitted. */ }
  return null;
}

export function renderOccasion({restaurant, categories, items, preview = false}) {
  const currency = restaurant.currency || "ETB";
  const activeCategories = categories.filter(c => c.is_active !== 0 && c.is_active !== false && !c.deleted_at);
  const grouped = activeCategories.map(c => ({...c, items:items.filter(i => i.category_id === c.id && !i.deleted_at && i.is_available !== 0 && i.is_available !== false)})).filter(c => c.items.length);
  const count = grouped.reduce((n,c) => n+c.items.length,0);
  const logo = safeUrl(restaurant.logo_url, {image:true});
  const money = value => new Intl.NumberFormat("en-ET",{minimumFractionDigits:2,maximumFractionDigits:2}).format(value);
  const tabs = grouped.map(c => `<button type="button" class="tab" data-category="${escape(c.id)}" aria-pressed="false">${escape(c.name)}</button>`).join("");
  const sections = grouped.map(c => `<section class="menu-category" data-category="${escape(c.id)}" aria-labelledby="category-${escape(c.id)}"><div class="category-heading"><h2 id="category-${escape(c.id)}">${escape(c.name)}</h2><span>${String(c.items.length).padStart(2,"0")}</span></div><ul>${c.items.map(i => {
    const photo = safeUrl(i.image_url,{image:true});
    return `<li class="item" data-search="${escape(`${i.name} ${i.description ?? ""}`.toLocaleLowerCase())}">${photo?`<img class="food-photo" src="${escape(photo)}" alt="" width="74" height="74" loading="lazy" decoding="async">`:""}<div class="item-copy"><h3>${escape(i.name)}</h3>${i.description?`<p>${escape(i.description)}</p>`:""}</div><span class="price">${escape(money(i.price))}<small>${escape(currency)}</small></span></li>`;
  }).join("")}</ul></section>`).join("");
  const actions = [];
  const maps=safeUrl(restaurant.google_maps_url), reviews=safeUrl(restaurant.google_review_url);
  if(maps) actions.push(`<a href="${escape(maps)}" target="_blank" rel="noopener noreferrer">Directions</a>`);
  if(reviews) actions.push(`<a href="${escape(reviews)}" target="_blank" rel="noopener noreferrer">Leave a review</a>`);
  if(typeof restaurant.phone==="string" && /^\+?[\d\s()-]{5,30}$/.test(restaurant.phone)) actions.push(`<a href="tel:${escape(restaurant.phone.replace(/[\s()-]/g,""))}">Call us</a>`);
  for(const [label,key] of [["Instagram","instagram_url"],["TikTok","tiktok_url"],["Facebook","facebook_url"],["Telegram","telegram_url"],["WhatsApp","whatsapp_url"],["Website","website_url"]]) {
    const url=safeUrl(restaurant[key]);
    if(url) actions.push(`<a href="${escape(url)}" target="_blank" rel="noopener noreferrer">${label}</a>`);
  }
  return `<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><meta name="theme-color" content="#ffffff">${preview?'<meta name="robots" content="noindex,nofollow">':""}<title>${escape(restaurant.name)} Menu | ADMAKI Menu</title><meta name="description" content="Browse the ${escape(restaurant.name)} menu. Prices in ${escape(currency)}."><link rel="stylesheet" href="${STYLE_PATH}?v=1"><script src="${SCRIPT_PATH}?v=1" defer></script></head><body><a class="skip" href="#menu">Skip to menu</a>${preview?`<div class="draft-strip"><strong>Draft preview</strong><span>Prices and charges await confirmation.</span><a href="/#/admin/${escape(restaurant.id)}">Return to dashboard</a></div>`:""}<div class="shell"><header class="masthead"><span class="edition">FOOD · COFFEE · SWEET MOMENTS</span><a class="powered" href="https://menu.admakidigital.com/">ADMAKI MENU ↗</a></header><section class="hero"><p class="eyebrow">Digital menu</p><h1>${logo?`<img class="occasion-logo" src="${escape(logo)}" alt="${escape(restaurant.name)}${restaurant.tagline?` — ${escape(restaurant.tagline)}`:""}" width="1254" height="1254" fetchpriority="high">`:escape(restaurant.name)}</h1>${!logo && restaurant.tagline?`<p class="tagline">${escape(restaurant.tagline)}</p>`:""}${restaurant.address?`<p class="address">${escape(restaurant.address)}</p>`:""}${actions.length?`<nav class="contact-actions" aria-label="Contact Occasion">${actions.join("")}</nav>`:""}</section><main id="menu"><div class="menu-header"><h2>Find your favorite.</h2><span class="count" id="count" role="status">${count} items</span></div><label class="search"><span aria-hidden="true">⌕</span><input type="search" id="search" aria-label="Search all menu items" placeholder="Search food, coffee, drinks…"></label><nav class="navigation" aria-label="Menu categories"><div class="tabs"><button type="button" class="tab selected" data-category="all" aria-pressed="true">All items</button>${tabs}</div></nav><div class="charges"><strong>Prices in ${escape(currency)}.</strong>${restaurant.description?`<p>${escape(restaurant.description)}</p>`:""}</div><div class="menu">${sections}</div><p class="empty" ${count?"hidden":""}>${count?"No items match your search.":"The menu is being updated. Please check with the restaurant."}</p><button type="button" class="back-top" id="back-top">Back to menu ↑</button></main><footer class="footer"><p class="thanks">Thank you for coming.</p><p>${escape(restaurant.name)}${restaurant.tagline?` · ${escape(restaurant.tagline)}`:""}</p><a href="https://menu.admakidigital.com/">Powered by ADMAKI Menu</a></footer></div></body></html>`;
}
