const feature=(label,group,dependency='none',defaultEnabled=true,contentKeys=[],capabilities=['public.projection'])=>Object.freeze({label,group,dependency,default_enabled:defaultEnabled,manager_editable:true,content_keys:contentKeys,ui_module:group.toLowerCase(),api_capabilities:capabilities,test_id:'shared-feature-resolution',schema_version:2});
export const FEATURES=Object.freeze({
  'menu.search':feature('Menu search','Menu','items'),
  'menu.categories':feature('Category navigation','Menu','categories'),
  'menu.popular':feature('Popular items','Menu','popular'),
  'menu.item_images':feature('Item photos','Menu','item_images'),
  'menu.descriptions':feature('Item descriptions','Menu','descriptions'),
  'menu.variants':feature('Sizes and variants','Menu','variants',false),
  'menu.dietary_labels':feature('Dietary and allergen labels','Menu','labels',false,['item_labels']),
  'brand.cover':feature('Cover photo','Brand','cover',true,['cover_url','cover_focal']),
  'brand.logo':feature('Logo','Brand','logo',true,['logo_url']),
  'contact.call':feature('Call button','Contact','phone',true,['phone']),
  'contact.directions':feature('Google Maps directions','Contact','directions',true,['google_maps_url']),
  'contact.google_review':feature('Google review link','Contact','review',true,['google_review_url']),
  'contact.social.instagram':feature('Instagram','Social','instagram',true,['instagram_url']),
  'contact.social.facebook':feature('Facebook','Social','facebook',true,['facebook_url']),
  'contact.social.tiktok':feature('TikTok','Social','tiktok',true,['tiktok_url']),
  'contact.social.youtube':feature('YouTube','Social','youtube',true,['youtube_url']),
  'contact.social.telegram':feature('Telegram','Social','telegram',true,['telegram_url']),
  'contact.social.whatsapp':feature('WhatsApp','Social','whatsapp',true,['whatsapp_url']),
  'contact.social.linkedin':feature('LinkedIn','Social','linkedin',true,['linkedin_url']),
  'contact.social.website':feature('Website','Social','website',true,['website_url']),
  'guest.feedback':feature('Private guest feedback','Guest','none',true,[],['public.feedback.write','private.feedback.read']),
  'guest.hours':feature('Opening hours','Guest','hours',false),
  'guest.wifi':feature('Public Wi-Fi details','Guest','wifi',false,['wifi']),
  'guest.share':feature('Share menu','Guest'),
  'guest.qr_download':feature('Download QR code','Guest'),
  'guest.language':feature('Language selection','Guest','translations',false,['languages']),
  'pricing.disclosure':feature('VAT and service disclosure','Pricing','pricing',true,['pricing']),
  'analytics.collection':feature('Collect anonymous menu events','Analytics','none',false,[],['public.analytics.write']),
  'analytics.dashboard':feature('Analytics dashboard','Analytics','none',true,[],['private.analytics.read']),
  'menu.story':feature('Restaurant story','Brand','story',true,['story'])
});
export const FEATURE_KEYS=Object.freeze(Object.keys(FEATURES));
export const DEFAULT_FEATURES=Object.freeze(Object.fromEntries(FEATURE_KEYS.map(key=>[key,FEATURES[key].default_enabled])));
export const DEFAULT_THEME=Object.freeze({background:'#ffffff',surface:'#ffffff',text:'#173a2a',accent:'#245943',font:'system',radius:'soft'});
export const DEFAULT_CONTENT=Object.freeze({phone:'',google_maps_url:'',google_review_url:'',instagram_url:'',facebook_url:'',tiktok_url:'',youtube_url:'',telegram_url:'',whatsapp_url:'',linkedin_url:'',website_url:'',cover_url:'',logo_url:'',cover_focal:{x:50,y:50},story:'',languages:['en'],pricing:{mode:'custom',vat_rate:null,service_rate:null,text:'',placement:'bottom'},wifi:{network_name:'',password:'',public_name:false,public_password:false},item_labels:{}});
export const hasFeature=key=>Object.hasOwn(FEATURES,key);
export const CONTENT_FEATURE=Object.freeze(Object.fromEntries(FEATURE_KEYS.flatMap(key=>FEATURES[key].content_keys.map(c=>[c,key]))));
