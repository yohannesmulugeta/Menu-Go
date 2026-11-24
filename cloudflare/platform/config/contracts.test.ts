import type { FeatureKey, ConfigPatch } from './contracts.js';
const valid:FeatureKey='guest.wifi';
// @ts-expect-error Feature keys must come from the runtime registry.
const invalid:FeatureKey='account.security_off';
const patch:ConfigPatch={revision:1,policy_revision:1,features:{'guest.hours':false}};
// @ts-expect-error Configuration toggles accept booleans only.
const bad:ConfigPatch={revision:1,policy_revision:1,features:{'guest.hours':'yes'}};
void [valid,invalid,patch,bad];
