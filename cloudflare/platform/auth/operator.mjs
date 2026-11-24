// Operator-only SQL plan. This module has no HTTP route and never contains a password.
export const STAGING_DATABASE_ID='0cd21d93-da77-4b6b-b4dd-e16b741348c5';
export const STAGING_ENVIRONMENT='admaki-menu-platform-staging';
export function ownerPlan({mode,userId,username,credential,requestId,expiresAt}) {
  if(!['bootstrap','recover'].includes(mode)||!/^[-a-zA-Z0-9]{3,80}$/.test(userId)||!/^[a-z0-9][a-z0-9._-]{2,47}$/.test(username))throw Error('Explicit mode, owner user ID and normalized username are required.');
  const h=credential,envGuard="EXISTS(SELECT 1 FROM platform_environment WHERE singleton=1 AND name='admaki-menu-platform-staging')";
  const q=(sql,params=[])=>({sql,params});
  const plan=[];
  if(mode==='bootstrap'){
    plan.push(q(`INSERT INTO users(id,email) SELECT ?,? WHERE NOT EXISTS(SELECT 1 FROM users) AND NOT EXISTS(SELECT 1 FROM platform_admins) AND ${envGuard}`,[userId,`${userId}@login.admaki.invalid`]));
    plan.push(q(`INSERT INTO login_credentials(user_id,username,hash_format,password_hash,parameters_json,temporary_expires_at) SELECT id,?,?,?,?,? FROM users WHERE id=? AND changes()=1 AND NOT EXISTS(SELECT 1 FROM login_credentials) AND NOT EXISTS(SELECT 1 FROM platform_admins) AND ${envGuard}`,[username,h.hash_format,h.password_hash,h.parameters_json,expiresAt,userId]));
    plan.push(q(`INSERT INTO platform_admins(user_id) SELECT user_id FROM login_credentials WHERE user_id=? AND password_hash=? AND ${envGuard}`,[userId,h.password_hash]));
  }else{
    plan.push(q(`UPDATE login_credentials SET username=?,hash_format=?,password_hash=?,parameters_json=?,credential_version=credential_version+1,must_change_password=1,temporary_expires_at=?,disabled=0,updated_at=CURRENT_TIMESTAMP WHERE user_id=? AND EXISTS(SELECT 1 FROM platform_admins WHERE user_id=?) AND ${envGuard}`,[username,h.hash_format,h.password_hash,h.parameters_json,expiresAt,userId,userId]));
    // Access-only owners may not have a password credential yet; preserve their user ID and role.
    plan.push(q(`INSERT INTO login_credentials(user_id,username,hash_format,password_hash,parameters_json,temporary_expires_at) SELECT u.id,?,?,?,?,? FROM users u JOIN platform_admins a ON a.user_id=u.id WHERE u.id=? AND NOT EXISTS(SELECT 1 FROM login_credentials WHERE user_id=u.id) AND ${envGuard}`,[username,h.hash_format,h.password_hash,h.parameters_json,expiresAt,userId]));
  }
  const changed="EXISTS(SELECT 1 FROM login_credentials c JOIN platform_admins a ON a.user_id=c.user_id WHERE c.user_id=? AND c.password_hash=?)";
  plan.push(q(`UPDATE users SET disabled=0 WHERE id=? AND ${changed}`,[userId,userId,h.password_hash]));
  plan.push(q(`UPDATE auth_sessions SET revoked_at=? WHERE user_id=? AND ${changed}`,[Math.floor(Date.now()/1000),userId,userId,h.password_hash]));
  plan.push(q(`DELETE FROM manager_sessions WHERE user_id=? AND ${changed}`,[userId,userId,h.password_hash]));
  plan.push(q(`INSERT INTO platform_audit_logs(actor_user_id,action,target_type,target_id,request_id,after_json) SELECT ?,?,'user',?,?,'{"operator_authenticated":true,"sessions_revoked":true}' WHERE ${changed}`,[userId,`auth.owner_${mode}`,userId,requestId,userId,h.password_hash]));
  return plan;
}
