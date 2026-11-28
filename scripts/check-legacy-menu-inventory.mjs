// Read-only pre-cutover inventory check. Run with Node 18+.
// No credentials, mutations, or publication changes.
import assert from 'node:assert/strict';

const origin = new URL(process.env.MENU_LEGACY_ORIGIN || 'https://app.admakidigital.com');
assert.equal(origin.protocol, 'https:', 'Use an HTTPS origin');
const baseline = [
  ['abol-coffee', 89, 13],
  ['mokodo-pizza', 103, 12],
  ['occasion', 116, 15],
  ['sheba-coffee', 40, 7],
  ['some', 0, 0],
];
let failed = false;
for (const [slug, items, categories] of baseline) {
  try {
    const response = await fetch(new URL('/api/restaurants/' + encodeURIComponent(slug), origin), {
      headers: { Accept: 'application/json', 'X-Menu-Request': '1' },
      signal: AbortSignal.timeout(15000),
      redirect: 'error',
    });
    assert.equal(response.status, 200);
    const data = await response.json();
    assert.equal(data.restaurant?.slug, slug, 'Restaurant identity mismatch');
    assert.ok(Array.isArray(data.items) && Array.isArray(data.categories), 'Unexpected API shape');
    assert.equal(data.items.length, items, 'Item count differs from recorded inventory');
    assert.equal(data.categories.length, categories, 'Category count differs from recorded inventory');
    console.log('PASS', slug, data.items.length, 'items,', data.categories.length, 'categories');
  } catch (error) {
    failed = true;
    console.error('FAIL', slug, error.message);
  }
}
if (failed) process.exitCode = 1;
// Counts are a point-in-time inventory, not proof of content approval.
// This checks the API, not browser routing, visual parity, or QR scanning.
// Intentional menu edits require reconciling the baseline with the owner.
