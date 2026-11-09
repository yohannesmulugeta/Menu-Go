import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

// Public menu fields only: no accounts, invitations, Wi-Fi, feedback or analytics.
export function seedStatements(snapshot) {
  return [
    ...snapshot.restaurants.map(r => ({
      sql: 'INSERT INTO restaurants(id,slug,name,status,profile_json) VALUES(?,?,?,?,?)',
      params: [r.id, r.slug, r.name, r.status, JSON.stringify(r.profile)],
    })),
    ...snapshot.categories.map(c => ({
      sql: 'INSERT INTO categories(id,restaurant_id,name,sort_order,is_active) VALUES(?,?,?,?,?)',
      params: [c.id, c.restaurant_id, c.name, c.sort_order, Number(c.is_active)],
    })),
    ...snapshot.items.map(i => ({
      sql: 'INSERT INTO menu_items(id,restaurant_id,category_id,name,description,price_minor,image_url,is_available,is_popular,sort_order) VALUES(?,?,?,?,?,?,?,?,?,?)',
      params: [i.id, i.restaurant_id, i.category_id, i.name, i.description ?? '', Math.round(Number(i.price) * 100), i.image_url ?? null, Number(i.is_available), Number(i.is_popular), i.sort_order],
    })),
  ];
}
if (process.argv[1] === fileURLToPath(import.meta.url)) {
  const snapshot = JSON.parse(readFileSync(new URL('./public-snapshot.json', import.meta.url)));
  // Emits JSON query batches for the Cloudflare D1 query API. Initialize only an
  // empty pilot database; duplicate inserts intentionally fail instead of
  // overwriting edits. Never point this seed at a production database.
  process.stdout.write(JSON.stringify({ batch: seedStatements(snapshot) }, null, 2) + '\n');
}
