import {requireSession} from '../auth/service.mjs';
import {fail} from '../auth/http.mjs';
export async function restaurantAccess(request,db,id){
  const s=await requireSession(request,db),admin=!!await db.prepare('SELECT 1 FROM platform_admins WHERE user_id=?').bind(s.user_id).first();
  if(!admin&&!await db.prepare("SELECT 1 FROM restaurant_members WHERE user_id=? AND restaurant_id=? AND role='manager'").bind(s.user_id,id).first())fail(404,'Restaurant not found.');
  const restaurant=await db.prepare('SELECT * FROM restaurants WHERE id=?').bind(id).first();if(!restaurant)fail(404,'Restaurant not found.');
  return {session:s,role:admin?'super_admin':'manager',restaurant};
}
export function liveActorSQL({admin=false,recent=false}={}){
  return `EXISTS(SELECT 1 FROM auth_sessions s JOIN login_credentials c ON c.user_id=s.user_id JOIN users u ON u.id=c.user_id WHERE s.token_hash=? AND s.user_id=? AND s.revoked_at IS NULL AND s.credential_version=c.credential_version AND c.disabled=0 AND u.disabled=0 AND c.must_change_password=0 AND s.idle_expires_at>? AND s.absolute_expires_at>? ${recent?'AND s.reauthenticated_at>?':''} AND (${admin?'EXISTS(SELECT 1 FROM platform_admins a WHERE a.user_id=s.user_id)':"EXISTS(SELECT 1 FROM platform_admins a WHERE a.user_id=s.user_id) OR EXISTS(SELECT 1 FROM restaurant_members m WHERE m.user_id=s.user_id AND m.restaurant_id=? AND m.role='manager')"}))`;
}
export function liveActorParams(s,{admin=false,recent=false,restaurantId}={}){const t=Math.floor(Date.now()/1000);return [s.token_hash,s.user_id,t,t,...(recent?[t-300]:[]),...(admin?[]:[restaurantId])];}
