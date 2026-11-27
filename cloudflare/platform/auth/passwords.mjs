import { scryptSync, pbkdf2Sync, randomBytes, randomInt, createHash, timingSafeEqual } from 'node:crypto';
export const HASH_FORMAT = 'scrypt-v1';
const COST = Object.freeze({ N:16384, r:8, p:5, maxmem:33554432 });
export const randomToken = () => randomBytes(32).toString('hex');
export const digest = value => createHash('sha256').update(value).digest('hex');
export const temporaryPassword = () => randomBytes(18).toString('base64url');
export function managerPinProblem(value) {
  if (typeof value !== 'string' || !/^\d{6}$/.test(value)) return 'Use exactly six digits.';
  if (/^(\d)\1{5}$/.test(value) || /^(\d{2})\1{2}$/.test(value) || /^(\d{3})\1$/.test(value) || ['123456','654321','012345','987654','234567','345678','456789','567890','098765','876543','765432','543210','121212','112233','123123','159753','123789'].includes(value)) return 'Choose a less predictable six-digit PIN.';
  return null;
}
export function temporaryManagerPin() {
  let pin;
  do { pin = String(randomInt(0,1000000)).padStart(6,'0'); } while (managerPinProblem(pin));
  return pin;
}
export function normalizeUsername(value) {
  if (typeof value !== 'string') return null;
  const username = value.trim().toLowerCase();
  return /^[a-z0-9][a-z0-9._-]{2,47}$/.test(username) ? username : null;
}
export function passwordProblem(value, username='') {
  if (typeof value !== 'string' || [...value].length < 15 || [...value].length > 256 || Buffer.byteLength(value,'utf8') > 1024)
    return 'Use a passphrase of 15–256 characters. Spaces and paste are supported.';
  const normalized = value.toLowerCase().replace(/[^a-z0-9]/g,'');
  if (normalized.includes(username.toLowerCase()) && username.length >= 3)
    return 'Choose a passphrase that does not contain your username.';
  if (new Set([...value]).size < 5 || /^(password|123456|qwerty|letmein|welcome|admin|occasion|admaki)[\d\W_]*$/i.test(value))
    return 'Choose a less predictable passphrase.';
  return null;
}
export function hashPassword(password) {
  const salt = randomBytes(24).toString('hex');
  return { hash_format:HASH_FORMAT, password_hash:scryptSync(password,Buffer.from(salt,'hex'),32,COST).toString('hex'),
    parameters_json:JSON.stringify({ N:COST.N,r:COST.r,p:COST.p,salt,salt_encoding:'hex',key_length:32 }) };
}
export function verifyPassword(password, credential) {
  if (typeof password !== 'string' || Buffer.byteLength(password,'utf8') > 1024) return false;
  try {
    const p = JSON.parse(credential.parameters_json);
    let actual;
    if (credential.hash_format === HASH_FORMAT && p.N===COST.N && p.r===COST.r && p.p===COST.p && p.key_length===32 && p.salt_encoding==='hex' && /^[a-f0-9]{48}$/.test(p.salt))
      actual = scryptSync(password,Buffer.from(p.salt,'hex'),32,COST);
    // Exact legacy semantics: the hexadecimal salt string itself was UTF-8, not decoded bytes.
    else if (credential.hash_format==='pbkdf2-sha256-legacy' && p.iterations===100000 && p.salt_encoding==='utf8' && typeof p.salt==='string' && p.salt.length>=16 && p.salt.length<=128)
      actual = pbkdf2Sync(password,p.salt,p.iterations,32,'sha256');
    else return false;
    if (!/^[a-f0-9]{64}$/.test(credential.password_hash)) return false;
    return timingSafeEqual(actual,Buffer.from(credential.password_hash,'hex'));
  } catch { return false; }
}
// Same cost for unknown/disabled accounts; this is a public test vector, never an account credential.
export const DUMMY_CREDENTIAL = { hash_format:HASH_FORMAT,password_hash:'6a63003d4b4000ff869a1c2022fe778ac0be51cd22769dd238128a5810ccc67a',
  parameters_json:JSON.stringify({N:16384,r:8,p:5,key_length:32,salt:'303132333435363738396162636465663031323334353637',salt_encoding:'hex'}) };
