#!/usr/bin/env node
// Run only from a trusted terminal. The token must have Workers D1 Write access.
import {hashPassword,normalizeUsername,temporaryPassword} from '../cloudflare/platform/auth/passwords.mjs';
import {ownerPlan,STAGING_DATABASE_ID,STAGING_ENVIRONMENT} from '../cloudflare/platform/auth/operator.mjs';
const args=process.argv.slice(2),mode=args[0];
const get=flag=>{const i=args.indexOf(flag);return i<0?undefined:args[i+1];};
const userId=get('--user-id'),username=normalizeUsername(get('--username'));
if(!process.stdout.isTTY)throw Error('Run in an interactive trusted terminal; temporary passwords must not enter redirected logs.');
if(!process.env.CLOUDFLARE_API_TOKEN)throw Error('Set CLOUDFLARE_API_TOKEN using your authorized Cloudflare operator account.');
if(get('--database-id')!==STAGING_DATABASE_ID)throw Error('Supply the explicit staging --database-id. Production is not supported by this command.');
const account='2a0b619cf019c336f7208f21a1fa28cd';
async function cf(path,body){
  const r=await fetch('https://api.cloudflare.com/client/v4'+path,{method:body?'POST':'GET',headers:{Authorization:'Bearer '+process.env.CLOUDFLARE_API_TOKEN,'Content-Type':'application/json'},body:body?JSON.stringify(body):undefined});
  const result=await r.json();if(!r.ok||!result.success)throw Error('Cloudflare operator request failed. Check permissions and target.');return result.result;
}
const base=`/accounts/${account}/d1/database/${STAGING_DATABASE_ID}`;
const database=await cf(base);if(database.name!==STAGING_ENVIRONMENT)throw Error('Database identity mismatch.');
const before=await cf(base+'/query',{sql:'SELECT name FROM platform_environment WHERE singleton=1'});
if(before[0].results[0]?.name!==STAGING_ENVIRONMENT)throw Error('Environment marker mismatch.');
const password=temporaryPassword(),credential=hashPassword(password),requestId=crypto.randomUUID();
const batch=ownerPlan({mode,userId,username,credential,requestId,expiresAt:Math.floor(Date.now()/1000)+86400});
await cf(base+'/query',{batch});
const check=await cf(base+'/query',{sql:"SELECT count(*) n FROM platform_audit_logs WHERE request_id=? AND action=?",params:[requestId,`auth.owner_${mode}`]});
if(check[0].results[0]?.n!==1)throw Error('No owner changed. Bootstrap requires an empty identity store; recovery requires an existing platform-admin user ID.');
console.log(`Staging owner ${username}\nTemporary password (shown once): ${password}\nExpires in 24 hours. Change it on first sign-in. All existing sessions were revoked.`);
