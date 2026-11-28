import {normalizeUsername} from './passwords.mjs';
// Operator migration adapter only. No public import route; never reads another database.
export function legacyCredentialPlan(row,requestId,environment='admaki-menu-platform-staging') {
  if(!['admaki-menu-platform-staging','admaki-menu-platform-production'].includes(environment))throw Error('Explicit environment required.');
  const username=normalizeUsername(row.username);
  if(!username||!row.user_id||row.iterations!==100000||!Number.isSafeInteger(row.password_version)||row.password_version<1||!/^[a-f0-9]{64}$/.test(row.password_hash)||typeof row.salt!=='string'||row.salt.length<16||row.salt.length>128)
    throw Error('Unsupported legacy credential; inspect it before migrating.');
  return [
    {sql:`INSERT INTO login_credentials(user_id,username,hash_format,password_hash,parameters_json,credential_version,must_change_password,disabled)
      SELECT c.user_id,?,'pbkdf2-sha256-legacy',c.password_hash,?,c.password_version,c.must_change_password,c.disabled
      FROM manager_credentials c JOIN users u ON u.id=c.user_id
      JOIN restaurant_members m ON m.user_id=c.user_id AND m.restaurant_id=c.restaurant_id AND m.role='manager'
      WHERE c.user_id=? AND c.username=? AND c.password_hash=? AND c.password_version=?
      AND EXISTS(SELECT 1 FROM platform_environment WHERE singleton=1 AND name=?)
      ON CONFLICT(user_id) DO NOTHING`,params:[username,JSON.stringify({salt:row.salt,salt_encoding:'utf8',iterations:100000}),row.user_id,row.username,row.password_hash,row.password_version,environment]},
    {sql:"INSERT INTO platform_audit_logs(actor_user_id,action,target_type,target_id,request_id,after_json) SELECT NULL,'auth.legacy_import','user',?,?,'{\"same_user_id\":true}' WHERE changes()=1",params:[row.user_id,requestId]}
  ];
}
