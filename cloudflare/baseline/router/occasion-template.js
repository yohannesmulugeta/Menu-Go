export const OCCASION_ID = "895adc6a-cc13-5695-ad79-26d60c57c6d0";
export const LOGO_PATH = `/media/${OCCASION_ID}/occasion-logo-v1.png`;
export const STYLE_PATH = "/occasion-assets/menu.css";
export const SCRIPT_PATH = "/occasion-assets/menu.js";
export const QR_PATH = "/occasion-assets/occasion-menu-qr.svg";
export const PUBLIC_URL = "https://menu.admakidigital.com/r/occasion";
const paths={phone:'M22 16.9v3a2 2 0 0 1-2.2 2A19.8 19.8 0 0 1 3.1 5.2 2 2 0 0 1 5.1 3h3a2 2 0 0 1 2 1.7c.1 1 .4 2 .7 2.9a2 2 0 0 1-.5 2.1L9 11a16 16 0 0 0 4 4l1.3-1.3a2 2 0 0 1 2.1-.5c.9.3 1.9.6 2.9.7a2 2 0 0 1 1.7 2z',pin:'M20 10c0 6-8 12-8 12S4 16 4 10a8 8 0 1 1 16 0Z M15 10a3 3 0 1 1-6 0 3 3 0 0 1 6 0',share:'M12 16V3 M7 8l5-5 5 5 M5 13v6a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2v-6',Instagram:'M7 3h10a4 4 0 0 1 4 4v10a4 4 0 0 1-4 4H7a4 4 0 0 1-4-4V7a4 4 0 0 1 4-4Z M16 12a4 4 0 1 1-8 0 4 4 0 0 1 8 0 M17.5 6.5h.01',Facebook:'M14 22V13h3l.5-4H14V7c0-1 .3-2 2-2h2V1h-3c-4 0-6 2-6 6v2H6v4h3v9',external:'M14 3h7v7 M10 14 21 3 M10 3H5a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-5'};
const icon=name=>`<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="${paths[name]||paths.external}"/></svg>`;

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
  const cover = safeUrl(restaurant.cover_image_url);
  const money = value => new Intl.NumberFormat("en-ET",{minimumFractionDigits:2,maximumFractionDigits:2}).format(value);
  const tabs = grouped.map(c => `<button type="button" class="tab" data-category="${escape(c.id)}" aria-pressed="false">${escape(c.name)}</button>`).join("");
  const sections = grouped.map(c => `<section class="menu-category" data-category="${escape(c.id)}" aria-labelledby="category-${escape(c.id)}"><div class="category-heading"><h2 id="category-${escape(c.id)}">${escape(c.name)}</h2><span>${String(c.items.length).padStart(2,"0")}</span></div><ul>${c.items.map(i => {
    const photo = safeUrl(i.image_url,{image:true});
    return `<li class="item" data-search="${escape(`${i.name} ${i.description ?? ""}`.toLocaleLowerCase())}">${photo?`<img class="food-photo" src="${escape(photo)}" alt="" width="74" height="74" loading="lazy" decoding="async">`:""}<div class="item-copy"><h3>${escape(i.name)}</h3>${i.description?`<p>${escape(i.description)}</p>`:""}</div><span class="price">${escape(money(i.price))}<small>${escape(currency)}</small></span></li>`;
  }).join("")}</ul></section>`).join("");
  const actions = [];
  const maps=safeUrl(restaurant.google_maps_url), reviews=safeUrl(restaurant.google_review_url);
  if(maps) actions.push(`<a class="contact-button" href="${escape(maps)}" target="_blank" rel="noopener noreferrer">${icon('pin')}Directions</a>`);
  if(reviews) actions.push(`<a href="${escape(reviews)}" target="_blank" rel="noopener noreferrer">Leave a review</a>`);
  const phone=typeof restaurant.phone==='string'&&/^\+?[\d\s()-]{5,30}$/.test(restaurant.phone)?restaurant.phone.replace(/[\s()-]/g,''):null;
  if(phone) actions.unshift(`<a class="contact-button primary" href="tel:${escape(phone)}">${icon('phone')}Call us</a>`);
  const socials=[];
  for(const [label,key] of [["Instagram","instagram_url"],["TikTok","tiktok_url"],["Facebook","facebook_url"],["Telegram","telegram_url"],["WhatsApp","whatsapp_url"],["Website","website_url"]]) {
    const url=safeUrl(restaurant[key]);
    if(url) socials.push(`<a class="social-card" href="${escape(url)}" target="_blank" rel="noopener noreferrer"><span class="social-icon">${icon(label)}</span><span><strong>${label}</strong><small>${label==='WhatsApp'?'Chat with us':label==='Website'?'Visit our website':'Follow Occasion'}</small></span><span class="social-arrow" aria-hidden="true">${icon('external')}</span></a>`);
  }
  actions.push(`<button class="contact-button" type="button" id="share-menu">${icon('share')}Share menu</button>`);
  const connect=`<section class="connect-panel" aria-labelledby="connect-heading"><div class="connect-heading"><p class="eyebrow">Stay connected</p><h2 id="connect-heading">A little more Occasion.</h2><p>Follow us and keep your next visit close.</p></div>${socials.length?`<nav class="social-grid" aria-label="Occasion social media">${socials.join('')}</nav>`:''}<details class="menu-qr"><summary>Show menu QR code</summary><div class="qr-content"><img src="${QR_PATH}" alt="QR code opening the Occasion menu" width="222" height="222" loading="lazy"><div><h3>Save a seat for good moments.</h3><p>Scan to open this menu on another phone.</p><a href="${QR_PATH}" download="Occasion_Menu_QR.svg">Download QR code</a></div></div></details></section>`;
  return `<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><meta name="theme-color" content="#ffffff">${preview?'<meta name="robots" content="noindex,nofollow">':""}<title>${escape(restaurant.name)} Menu | ADMAKI Menu</title><meta name="description" content="Browse the ${escape(restaurant.name)} menu. Prices in ${escape(currency)}."><link rel="stylesheet" href="${STYLE_PATH}?v=2"><link rel="stylesheet" href="/occasion-assets/cover.css"><script src="${SCRIPT_PATH}?v=2" defer></script></head><body><a class="skip" href="#menu">Skip to menu</a>${preview?`<div class="draft-strip"><strong>Draft preview</strong><span>Prices and charges await confirmation.</span><a href="/#/admin/${escape(restaurant.id)}">Return to dashboard</a></div>`:""}<div class="shell"><header class="masthead"><span class="edition">FOOD · COFFEE · SWEET MOMENTS</span><a class="powered" href="https://menu.admakidigital.com/">ADMAKI MENU ↗</a></header>${cover?`<div class="occasion-cover"><img src="${escape(cover)}" alt="Occasion bakery cover — baker with celebration cakes" width="150" height="150" fetchpriority="high"></div>`:""}<section class="hero"><p class="eyebrow">Digital menu</p><h1>${logo?`<img class="occasion-logo" src="${escape(logo)}" alt="${escape(restaurant.name)}${restaurant.tagline?` — ${escape(restaurant.tagline)}`:""}" width="1254" height="1254" fetchpriority="high">`:escape(restaurant.name)}</h1>${!logo && restaurant.tagline?`<p class="tagline">${escape(restaurant.tagline)}</p>`:""}${restaurant.address?`<p class="address">${escape(restaurant.address)}</p>`:""}${actions.length?`<nav class="contact-actions" aria-label="Contact Occasion">${actions.join("")}</nav>`:""}<p id="share-status" class="share-status" role="status" aria-live="polite"></p><label class="share-fallback" id="share-fallback" hidden>Menu link<input readonly value="${PUBLIC_URL}" aria-label="Copy this menu link"></label></section><main id="menu"><div class="menu-header"><h2>Find your favorite.</h2><span class="count" id="count" role="status">${count} items</span></div><label class="search"><span aria-hidden="true">⌕</span><input type="search" id="search" aria-label="Search all menu items" placeholder="Search food, coffee, drinks…"></label><nav class="navigation" aria-label="Menu categories"><div class="tabs"><button type="button" class="tab selected" data-category="all" aria-pressed="true">All items</button>${tabs}</div></nav><div class="menu">${sections}</div><p class="empty" ${count?"hidden":""}>${count?"No items match your search.":"The menu is being updated. Please check with the restaurant."}</p><button type="button" class="back-top" id="back-top">Back to menu ↑</button></main>${connect}<div class="charges"><strong>Prices in ${escape(currency)}.</strong>${restaurant.description?`<p>${escape(restaurant.description)}</p>`:""}</div><footer class="footer"><p class="thanks">Thank you for coming.</p><p>${escape(restaurant.name)}${restaurant.tagline?` · ${escape(restaurant.tagline)}`:""}</p><a href="https://menu.admakidigital.com/">Powered by ADMAKI Menu</a></footer></div></body></html>`;
}
