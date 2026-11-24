import { FEATURES } from './registry.mjs';
export type FeatureKey = keyof typeof FEATURES;
export type FeatureFlags = Record<FeatureKey, boolean>;
export interface EffectiveFeature { requested:boolean; effective_requested:boolean; enabled:boolean; ready:boolean; locked:boolean; lock_reason:'platform_disabled'|'platform_forced'|'manager_locked'|null; reason:'platform_disabled'|'template_unsupported'|'platform_forced_off'|'not_requested'|'missing_data'|'enabled'; }
export interface FeaturePolicy { feature_key:FeatureKey; allowed:0|1; manager_editable:0|1; forced_value:0|1|null; revision:number; }
export interface Theme { background:string; surface:string; text:string; accent:string; font:'system'|'serif'|'rounded'; radius:'square'|'soft'|'round'; }
export interface ContentSettings { phone:string; google_maps_url:string; google_review_url:string; instagram_url:string; facebook_url:string; tiktok_url:string; youtube_url:string; telegram_url:string; whatsapp_url:string; linkedin_url:string; website_url:string; cover_url:string; logo_url:string; cover_focal:{x:number;y:number}; story:string; languages:Array<'en'|'am'|'om'|'ti'>; pricing:{mode:'included'|'excluded'|'custom';vat_rate:number|null;service_rate:number|null;text:string;placement:'bottom'}; wifi:{network_name:string;password:string;public_name:boolean;public_password:boolean}; item_labels:Record<string,Array<'vegetarian'|'vegan'|'gluten_free'|'contains_milk'|'contains_egg'|'contains_nuts'|'contains_gluten'>>; }
export interface RestaurantConfig { schema_version:2; template_id:string; template_version:number; features:FeatureFlags; theme:Theme; content_settings:ContentSettings; }
export interface ConfigResponse { revision:number; policy_revision:number; config:RestaurantConfig; effective:Record<FeatureKey,EffectiveFeature>; }
export type ConfigPatch = { revision:number; policy_revision:number; schema_version?:2; template_id?:string; template_version?:number; features?:Partial<FeatureFlags>; theme?:Partial<Theme>; content_settings?:Partial<ContentSettings> };
export interface CapabilityManifest { version:1; template_id:string; template_version:number; requested:FeatureFlags; ready:FeatureFlags; }
