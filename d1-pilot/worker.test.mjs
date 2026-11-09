import { test } from 'node:test';
import assert from 'node:assert/strict';
import { DatabaseSync } from 'node:sqlite';
import { readFileSync } from 'node:fs';
import worker from './worker.mjs';
import { seedStatements } from './seed.mjs';
import { JS } from './ui.mjs';

// Execute the actual SQL with foreign keys enabled; only Supabase's external
// identity responses are fixtures. The Worker, validation and SQL are real.
function setup() {
  const sqlite = new DatabaseSync(':memory:');
  sqlite.exec(readFileSync(new URL('./schema.sql', import.meta.url), 'utf8'));
  const snapshot = JSON.parse(readFileSync(new URL('./public-snapshot.json', import.meta.url)));
  for (const statement of seedStatements(snapshot)) sqlite.prepare(statement.sql).run(...statement.params);
  function prepare(sql, params = []) {
    return {
      bind(...values) { return prepare(sql, values); },
      async first() { return sqlite.prepare(sql).get(...params) ?? null; },
      async all() { return { results: sqlite.prepare(sql).all(...params) }; },
      _sql: sql, _params: params,
    };
  }
  const env = { DB: { prepare, async batch(statements) {
    sqlite.exec('BEGIN');
    try {
      const results = statements.map(s => ({ meta: { changes: Number(sqlite.prepare(s._sql).run(...s._params).changes) } }));
      sqlite.exec('COMMIT'); return results;
    } catch (error) { sqlite.exec('ROLLBACK'); throw error; }
  } }, SUPABASE_URL: 'https://auth.example.test', SUPABASE_PUBLISHABLE_KEY: 'public-fixture' };
  const originalFetch = globalThis.fetch;
  globalThis.fetch = async (url, init) => {
    const token = init.headers.Authorization?.replace('Bearer ', '');
    const u = new URL(url);
    if (u.pathname === '/auth/v1/token') {
      const input = JSON.parse(init.body);
      if (input.email === 'manager@example.test' && input.password === ' unchanged password ') return Response.json({ access_token: 'manager', expires_in: 3600 });
      return Response.json({ error: 'invalid' }, { status: 400 });
    }
    if (u.pathname === '/auth/v1/user') return ['manager','admin','outsider'].includes(token) ? Response.json({ id: token, email_confirmed_at: '2026-01-01' }) : Response.json({}, { status: 401 });
    if (u.pathname === '/rest/v1/platform_admins') return Response.json(token === 'admin' ? [{ user_id: 'admin' }] : []);
    if (u.pathname === '/rest/v1/restaurant_members') return Response.json(token === 'manager' && u.searchParams.get('restaurant_id') === 'eq.77777777-7777-4777-8777-777777777777' ? [{ restaurant_id: '77777777-7777-4777-8777-777777777777' }] : []);
    if (u.pathname === '/auth/v1/logout') return new Response(null, { status: 204 });
    throw new Error('Unexpected upstream request '+u.pathname);
  };
  const call = (path, { method = 'GET', data, token, origin } = {}) => worker.fetch(new Request('https://pilot.test'+path, {
    method, headers: { ...(data ? { 'Content-Type': 'application/json' } : {}), ...(token ? { Authorization: 'Bearer '+token } : {}), ...(origin ? { Origin: origin } : {}) },
    body: data ? JSON.stringify(data) : undefined,
  }), env);
  return { env, sqlite, call, close() { globalThis.fetch = originalFetch; sqlite.close(); } };
}

test('pilot API preserves menus, scopes writes, validates data and persists edits', async t => {
  const s = setup(); t.after(() => s.close());
  const endpoint = '/api/admin/restaurants/abol-coffee/';
  await t.test('public menus retain source counts and no caching', async () => {
    for (const [slug, count, categories] of [['abol-coffee',89,13],['mokodo-pizza',103,12]]) {
      const response = await s.call('/api/restaurants/'+slug+'/menu');
      assert.equal(response.status,200);assert.equal(response.headers.get('Cache-Control'),'no-store');
      const menu = await response.json(); assert.equal(menu.items.length,count); assert.equal(menu.categories.length,categories);
    }
  });
  await t.test('anonymous and forged tokens cannot read or write admin data', async () => {
    for (const token of [undefined,'forged']) assert.equal((await s.call(endpoint+'menu',{token})).status,401);
    assert.equal((await s.call('/api/restaurants/abol-coffee/items',{method:'POST',data:{}})).status,405);
  });
  await t.test('existing login accepts passwords unchanged and never returns refresh tokens', async () => {
    const response = await s.call('/api/login',{method:'POST',data:{email:'manager@example.test',password:' unchanged password '}});
    assert.equal(response.status,200);const data=await response.json();assert.equal(data.access_token,'manager');assert.equal(data.refresh_token,undefined);
  });
  await t.test('unassigned accounts and cross-restaurant manager access are denied', async () => {
    assert.equal((await s.call(endpoint+'menu',{token:'outsider'})).status,403);
    assert.equal((await s.call('/api/admin/restaurants/mokodo-pizza/menu',{token:'manager'})).status,403);
  });
  let menu = await (await s.call(endpoint+'menu',{token:'manager'})).json();
  const original = menu.items[0], other = s.sqlite.prepare("SELECT category_id FROM menu_items WHERE restaurant_id <> ? LIMIT 1").get(menu.restaurant.id);
  const payload = { ...original, price: 123.45 };
  await t.test('negative, excess decimals, foreign categories and unsafe images are rejected', async () => {
    for (const changes of [{price:-1},{price:1.123},{category_id:other.category_id},{image_url:'javascript:alert(1)'},{is_available:'false'}]) {
      assert.equal((await s.call(endpoint+'items/'+original.id,{method:'PUT',token:'manager',data:{...payload,...changes}})).status,400);
    }
  });
  await t.test('cross-origin writes are denied', async () => {
    assert.equal((await s.call(endpoint+'items/'+original.id,{method:'PUT',token:'manager',origin:'https://other.test',data:payload})).status,403);
  });
  await t.test('price edit persists in public menu and writes an audit entry', async () => {
    assert.equal((await s.call(endpoint+'items/'+original.id,{method:'PUT',token:'manager',data:payload})).status,200);
    const publicMenu=await (await s.call('/api/restaurants/abol-coffee/menu')).json();
    assert.equal(publicMenu.items.find(i=>i.id===original.id).price,123.45);
    assert.equal(s.sqlite.prepare('SELECT count(*) n FROM audit_logs').get().n,1);
  });
  await t.test('stale edits fail with a conflict and do not append audit noise', async () => {
    assert.equal((await s.call(endpoint+'items/'+original.id,{method:'PUT',token:'manager',data:payload})).status,409);
    assert.equal(s.sqlite.prepare('SELECT count(*) n FROM audit_logs').get().n,1);
  });
  await t.test('availability hides item from public menu but retains it for manager', async () => {
    assert.equal((await s.call(endpoint+'items/'+original.id,{method:'PUT',token:'manager',data:{...payload,version:original.version+1,is_available:false}})).status,200);
    const publicMenu=await (await s.call('/api/restaurants/abol-coffee/menu')).json();
    assert.equal(publicMenu.items.some(i=>i.id===original.id),false);
    const privateMenu=await (await s.call(endpoint+'menu',{token:'manager'})).json();
    assert.equal(privateMenu.items.find(i=>i.id===original.id).is_available,false);
  });
  await t.test('category creation, item creation, safe removal and category hiding work', async () => {
    const category=await (await s.call(endpoint+'categories',{method:'POST',token:'manager',data:{name:'Pilot tests',is_active:true}})).json();
    const response=await s.call(endpoint+'items',{method:'POST',token:'manager',data:{...payload,category_id:category.id}});
    assert.equal(response.status,201);const item=await response.json();
    assert.equal((await s.call(endpoint+'categories/'+category.id,{method:'PUT',token:'manager',data:{name:'Hidden tests',is_active:false}})).status,200);
    let publicMenu=await (await s.call('/api/restaurants/abol-coffee/menu')).json();assert.equal(publicMenu.items.some(i=>i.id===item.id),false);
    assert.equal((await s.call(endpoint+'items/'+item.id,{method:'DELETE',token:'manager'})).status,200);
    assert.ok(s.sqlite.prepare('SELECT deleted_at FROM menu_items WHERE id=?').get(item.id).deleted_at);
  });
  await t.test('manager cannot change another restaurant item by guessing its ID', async () => {
    const id=s.sqlite.prepare('SELECT id FROM menu_items WHERE restaurant_id<>? LIMIT 1').get(menu.restaurant.id).id;
    assert.equal((await s.call(endpoint+'items/'+id,{method:'DELETE',token:'manager'})).status,404);
  });
  await t.test('draft restaurants and inactive categories are never public', async () => {
    s.sqlite.prepare("UPDATE restaurants SET status='draft' WHERE slug='mokodo-pizza'").run();
    assert.equal((await s.call('/api/restaurants/mokodo-pizza/menu')).status,404);
  });
  await t.test('missing binding has an actionable health error and UI JavaScript parses', async () => {
    const response=await worker.fetch(new Request('https://pilot.test/api/health'),{});assert.equal(response.status,503);
    assert.match((await response.json()).error,/binding/i);assert.doesNotThrow(()=>new Function(JS));
  });
});
