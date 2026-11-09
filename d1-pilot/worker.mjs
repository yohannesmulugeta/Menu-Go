import { HTML, CSS, JS } from './ui.mjs';

class HttpError extends Error {
  constructor(status, message) { super(message); this.status = status; }
}
const fail = (status, message) => { throw new HttpError(status, message); };
const headers = {
  'Cache-Control': 'no-store',
  'X-Content-Type-Options': 'nosniff',
  'Referrer-Policy': 'no-referrer',
  'X-Frame-Options': 'DENY',
  'Content-Security-Policy': "default-src 'self'; script-src 'self'; style-src 'self'; img-src 'self' https:; connect-src 'self'; frame-ancestors 'none'; base-uri 'none'; form-action 'self'",
};
const json = (data, status = 200) => new Response(JSON.stringify(data), {
  status, headers: { ...headers, 'Content-Type': 'application/json; charset=utf-8' },
});
function text(value, name, max, required = false) {
  if (value === null || value === undefined) value = '';
  if (typeof value !== 'string' || value.trim().length > max || (required && !value.trim())) {
    fail(400, `Enter a valid ${name} (maximum ${max} characters).`);
  }
  return value.trim();
}
function imageUrl(value) {
  const clean = text(value, 'image URL', 2000);
  if (!clean) return null;
  try { if (new URL(clean).protocol === 'https:') return clean; } catch { /* invalid URL */ }
  fail(400, 'Photo links must start with https://.');
}
async function body(request) {
  if (!request.headers.get('Content-Type')?.startsWith('application/json')) fail(415, 'Use JSON.');
  if (Number(request.headers.get('Content-Length')) > 16384) fail(413, 'Request is too large.');
  const reader = request.body?.getReader();
  if (!reader) fail(400, 'A request body is required.');
  const chunks = []; let size = 0;
  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    size += value.byteLength;
    if (size > 16384) { await reader.cancel(); fail(413, 'Request is too large.'); }
    chunks.push(value);
  }
  const bytes = new Uint8Array(size); let offset = 0;
  for (const chunk of chunks) { bytes.set(chunk, offset); offset += chunk.byteLength; }
  try {
    const data = JSON.parse(new TextDecoder().decode(bytes));
    if (!data || typeof data !== 'object' || Array.isArray(data)) fail(400, 'Expected a JSON object.');
    return data;
  } catch (error) {
    if (error instanceof HttpError) throw error;
    fail(400, 'Invalid JSON.');
  }
}
function sameOrigin(request) {
  const origin = request.headers.get('Origin');
  if (origin && origin !== new URL(request.url).origin) fail(403, 'Request origin is not allowed.');
}
function authConfig(env) {
  if (!env.SUPABASE_URL || !env.SUPABASE_PUBLISHABLE_KEY) fail(503, 'Sign-in is not configured.');
}
async function supabase(env, path, token, init = {}) {
  authConfig(env);
  const response = await fetch(`${env.SUPABASE_URL}${path}`, {
    ...init,
    signal: AbortSignal.timeout(10000),
    headers: { apikey: env.SUPABASE_PUBLISHABLE_KEY, ...(token ? { Authorization: `Bearer ${token}` } : {}), ...init.headers },
  });
  return response;
}
// No service key: Supabase verifies the access token and applies the existing RLS
// to every membership lookup. User-editable JWT metadata never grants access.
async function identity(request, env) {
  const token = request.headers.get('Authorization')?.match(/^Bearer (\S+)$/)?.[1];
  if (!token) fail(401, 'Sign in to manage menus.');
  const response = await supabase(env, '/auth/v1/user', token);
  if (!response.ok) fail(response.status >= 500 ? 503 : 401, 'Your session expired. Please sign in again.');
  const user = await response.json();
  if (!user.id || !user.email_confirmed_at || user.is_anonymous) fail(403, 'Use a confirmed manager account.');
  const adminResponse = await supabase(env, `/rest/v1/platform_admins?select=user_id&user_id=eq.${encodeURIComponent(user.id)}&limit=1`, token);
  if (!adminResponse.ok) fail(503, 'Could not verify your permissions.');
  const admins = await adminResponse.json();
  return { id: user.id, token, platformAdmin: admins.length > 0 };
}
async function authorized(request, env, restaurant) {
  const user = await identity(request, env);
  if (user.platformAdmin) return user;
  const query = `?select=restaurant_id&user_id=eq.${encodeURIComponent(user.id)}&restaurant_id=eq.${encodeURIComponent(restaurant.id)}&role=eq.manager&limit=1`;
  const response = await supabase(env, `/rest/v1/restaurant_members${query}`, user.token);
  if (!response.ok) fail(503, 'Could not verify your restaurant access.');
  if (!(await response.json()).length) fail(403, 'You do not have permission to edit this restaurant.');
  return user;
}
async function restaurantBySlug(env, slug) {
  if (!env.DB) fail(503, 'The menu database binding is missing.');
  const row = await env.DB.prepare('SELECT * FROM restaurants WHERE slug = ?').bind(slug).first();
  if (!row) fail(404, 'Restaurant not found.');
  return row;
}
function mapItem(row) {
  return { ...row, price: row.price_minor / 100, is_available: Boolean(row.is_available), is_popular: Boolean(row.is_popular) };
}
async function menu(env, restaurant, admin = false) {
  if (!admin && restaurant.status !== 'active') fail(404, 'Restaurant not found.');
  const categories = await env.DB.prepare(`SELECT * FROM categories WHERE restaurant_id = ? ${admin ? '' : 'AND is_active = 1'} ORDER BY sort_order, name`).bind(restaurant.id).all();
  const items = await env.DB.prepare(`SELECT m.* FROM menu_items m JOIN categories c ON c.id=m.category_id AND c.restaurant_id=m.restaurant_id WHERE m.restaurant_id=? AND m.deleted_at IS NULL ${admin ? '' : 'AND m.is_available=1 AND c.is_active=1'} ORDER BY m.sort_order,m.name`).bind(restaurant.id).all();
  return { restaurant: { id: restaurant.id, slug: restaurant.slug, name: restaurant.name, status: restaurant.status, ...JSON.parse(restaurant.profile_json) }, categories: categories.results.map(c => ({ ...c, is_active: Boolean(c.is_active) })), items: items.results.map(mapItem) };
}
function audit(env, user, restaurant, action, entityId, payload) {
  return env.DB.prepare('INSERT INTO audit_logs (restaurant_id,user_id,action,entity_id,payload_json) VALUES (?,?,?,?,?)').bind(restaurant.id, user.id, action, entityId, JSON.stringify(payload));
}
async function saveItem(request, env, restaurant, user, itemId) {
  const input = await body(request);
  const name = text(input.name, 'item name', 200, true);
  const description = text(input.description, 'description', 3000);
  if (typeof input.price !== 'number' || !Number.isFinite(input.price) || input.price < 0 || input.price > 9999999.99) fail(400, 'Enter a valid non-negative price.');
  const priceMinor = Math.round(input.price * 100);
  if (Math.abs(input.price * 100 - priceMinor) > 0.00001) fail(400, 'Prices can have at most two decimal places.');
  if (typeof input.is_available !== 'boolean' || typeof input.is_popular !== 'boolean') fail(400, 'Availability and popular must be true or false.');
  const categoryId = text(input.category_id, 'category', 100, true);
  const category = await env.DB.prepare('SELECT id FROM categories WHERE id=? AND restaurant_id=?').bind(categoryId, restaurant.id).first();
  if (!category) fail(400, 'Select a category belonging to this restaurant.');
  const image = imageUrl(input.image_url);
  const values = [name, description, priceMinor, image, Number(input.is_available), Number(input.is_popular), categoryId];
  if (!itemId) {
    const id = crypto.randomUUID();
    await env.DB.batch([
      env.DB.prepare('INSERT INTO menu_items (name,description,price_minor,image_url,is_available,is_popular,category_id,id,restaurant_id) VALUES (?,?,?,?,?,?,?,?,?)').bind(...values, id, restaurant.id),
      audit(env, user, restaurant, 'create_item', id, { name }),
    ]);
    return json({ id }, 201);
  }
  if (!Number.isInteger(input.version) || input.version < 1) fail(400, 'Reload the item before saving.');
  const result = await env.DB.batch([
    env.DB.prepare('UPDATE menu_items SET name=?,description=?,price_minor=?,image_url=?,is_available=?,is_popular=?,category_id=?,version=version+1,updated_at=CURRENT_TIMESTAMP WHERE id=? AND restaurant_id=? AND version=? AND deleted_at IS NULL').bind(...values, itemId, restaurant.id, input.version),
    env.DB.prepare("INSERT INTO audit_logs (restaurant_id,user_id,action,entity_id,payload_json) SELECT ?,?,'update_item',?,? WHERE changes() > 0").bind(restaurant.id, user.id, itemId, JSON.stringify({ name, price: input.price })),
  ]);
  if (!result[0].meta.changes) fail(409, 'This item changed or was removed. Reload before saving.');
  return json({ id: itemId, version: input.version + 1 });
}

export default {
  async fetch(request, env) {
    try {
      const url = new URL(request.url);
      const path = url.pathname;
      if (request.method !== 'GET' && request.method !== 'HEAD') sameOrigin(request);
      if (request.method === 'GET' && (['/','/admin'].includes(path) || /^\/r\/[a-z0-9-]+$/.test(path))) {
        return new Response(HTML, { headers: { ...headers, 'Content-Type': 'text/html; charset=utf-8', 'X-Robots-Tag': 'noindex, nofollow' } });
      }
      if (request.method === 'GET' && path === '/style.css') return new Response(CSS, { headers: { ...headers, 'Content-Type': 'text/css; charset=utf-8' } });
      if (request.method === 'GET' && path === '/app.js') return new Response(JS, { headers: { ...headers, 'Content-Type': 'text/javascript; charset=utf-8' } });
      if (request.method === 'GET' && path === '/robots.txt') return new Response('User-agent: *\nDisallow: /');
      if (request.method === 'GET' && path === '/api/health') {
        if (!env.DB) fail(503, 'Database binding missing.');
        await env.DB.prepare('SELECT 1 FROM restaurants LIMIT 1').first();
        return json({ ok: true, environment: 'isolated-pilot', database: 'Cloudflare D1 / SQLite' });
      }
      if (request.method === 'POST' && path === '/api/login') {
        const input = await body(request);
        const email = text(input.email, 'email', 254, true);
        if (typeof input.password !== 'string' || !input.password.length || input.password.length > 1000) fail(400, 'Enter your password.');
        const password = input.password;
        const response = await supabase(env, '/auth/v1/token?grant_type=password', null, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ email, password }) });
        if (!response.ok) fail(response.status === 429 ? 429 : 401, response.status === 429 ? 'Too many sign-in attempts. Please try later.' : 'Sign-in failed. Check your existing Menu Go account details.');
        const session = await response.json();
        return json({ access_token: session.access_token, expires_in: session.expires_in });
      }
      if (request.method === 'POST' && path === '/api/logout') {
        const token = request.headers.get('Authorization')?.match(/^Bearer (\S+)$/)?.[1];
        if (token) await supabase(env, '/auth/v1/logout?scope=local', token, { method: 'POST' });
        return json({ ok: true });
      }
      if (request.method === 'GET' && path === '/api/restaurants') {
        const result = await env.DB.prepare("SELECT name,slug FROM restaurants WHERE status='active' ORDER BY name").all();
        return json(result.results);
      }
      const match = path.match(/^\/api\/(admin\/)?restaurants\/([a-z0-9-]+)\/(menu|items|categories)(?:\/([a-zA-Z0-9-]+))?$/);
      if (!match) fail(404, 'Page not found.');
      const [, adminPath, slug, resource, id] = match;
      // Reject writes to public paths before any database work.
      if (!adminPath && (request.method !== 'GET' || resource !== 'menu' || id)) fail(405, 'Method not allowed.');
      const restaurant = await restaurantBySlug(env, slug);
      const user = adminPath ? await authorized(request, env, restaurant) : null;
      if (resource === 'menu' && !id && request.method === 'GET') return json(await menu(env, restaurant, Boolean(user)));
      if (!user) fail(403, 'Sign in to edit this menu.');
      if (resource === 'items' && (request.method === 'POST' && !id || request.method === 'PUT' && id)) return await saveItem(request, env, restaurant, user, id);
      if (resource === 'items' && id && request.method === 'DELETE') {
        const result = await env.DB.batch([
          env.DB.prepare('UPDATE menu_items SET deleted_at=CURRENT_TIMESTAMP,version=version+1 WHERE id=? AND restaurant_id=? AND deleted_at IS NULL').bind(id, restaurant.id),
          env.DB.prepare("INSERT INTO audit_logs (restaurant_id,user_id,action,entity_id,payload_json) SELECT ?,?,'remove_item',?,'{}' WHERE changes()>0").bind(restaurant.id, user.id, id),
        ]);
        if (!result[0].meta.changes) fail(404, 'Item not found.');
        return json({ ok: true });
      }
      if (resource === 'categories' && (request.method === 'POST' && !id || request.method === 'PUT' && id)) {
        const input = await body(request);
        const name = text(input.name, 'category name', 120, true);
        if (typeof input.is_active !== 'boolean') fail(400, 'Category visibility must be true or false.');
        const categoryId = id || crypto.randomUUID();
        if (id && !await env.DB.prepare('SELECT id FROM categories WHERE id=? AND restaurant_id=?').bind(id, restaurant.id).first()) fail(404, 'Category not found.');
        await env.DB.batch([
          id ? env.DB.prepare('UPDATE categories SET name=?,is_active=? WHERE id=? AND restaurant_id=?').bind(name, Number(input.is_active), id, restaurant.id)
            : env.DB.prepare('INSERT INTO categories (id,restaurant_id,name,is_active,sort_order) VALUES (?,?,?,?,999)').bind(categoryId, restaurant.id, name, Number(input.is_active)),
          audit(env, user, restaurant, id ? 'update_category' : 'create_category', categoryId, { name, is_active: input.is_active }),
        ]);
        return json({ id: categoryId }, id ? 200 : 201);
      }
      fail(405, 'Method not allowed.');
    } catch (error) {
      if (error instanceof HttpError) return json({ error: error.message }, error.status);
      // Never log tokens, passwords or request bodies.
      console.error('Menu pilot request failed', error.name);
      return json({ error: 'The menu service is unavailable. Please try again.' }, 503);
    }
  },
};
