# Editable frontend recovery and isolated staging foundation

## Delivered

The editable Cloudflare frontend was recovered from feat/cloudflare-full-migration at 5f802d2528fea63c840f1ff80ee128512b12bae0, with small patches reconstructed from the verified live bundle. The authoring source lives in cloudflare/frontend. The older Supabase application at the repository root is retained for historical compatibility.

Restored changes include the Sheba canonical public link, public-link anchors in admin/preview tables, restaurant switching for platform admins, staged dashboard loading with error/retry, and Google review help text.

The recovered JavaScript is not byte-identical because minified variable names differ. A scope-aware Babel comparison renames lexical bindings consistently and verifies equality of the generated bundles. The stylesheet is byte-identical. Both comparisons are enforced in CI. This is a source-recovery equivalence check, not a browser login or security certification.

    npm run build:cloudflare-frontend
    npm run check:frontend-recovery
    npm run check:menu-platform
    npm run check:cloudflare-baseline
    npm run check

The frontend preparation step copies inventoried public fonts/branding/media from the frozen baseline without contacting production. It does not export every old unreferenced asset. Before replacing demo/preview behavior or deploying this frontend, review the older fallback-photo paths against the captured media subset. No new frontend is deployed by this phase.

## Staging resources

Worker: admaki-menu-platform-staging.
Database: admaki-menu-platform-staging (0cd21d93-da77-4b6b-b4dd-e16b741348c5).
R2 bucket: admaki-menu-media-platform-staging.
Configuration: cloudflare/wrangler.platform-staging.jsonc.
Health URL: https://admaki-menu-platform-staging.yohannesmulugeta084.workers.dev/api/health

These are separate from the live menu database, both live menu Workers and all NFC storage.
The bucket is not made public. R2 activation was already present in the account; no billing or terms settings were changed.

The deployed Worker exposes only health/readiness. It requires both an environment binding and database identity marker to match staging. It contains no login implementation, credential-provisioning endpoint, menu publication endpoint or media upload endpoint.

Verified remotely: health HTTP 200, three schema migrations, media binding present, login HTTP 404, POST health HTTP 405. R2 upload authorization and object round trips remain later tests; a binding check alone does not certify uploads.

## Schema

0001_recovered_baseline.sql preserves the current menu schema and indexes without exporting any private rows.
0002_shared_platform.sql adds independent login credentials/sessions, template releases, feature policies, revisioned restaurant configurations/presets, publication snapshots/heads, media metadata, global audit, aggregate analytics, item variants and translations.
0003_staging_fixtures.sql inserts one synthetic draft restaurant, template/config and preset. No users, passwords or production restaurant content are copied.

A unique (id, restaurant_id) menu-item index supports tenant-consistent foreign keys for variants and translations. Platform audit does not require a fabricated restaurant.

Schema migrations are tracked by file name and SHA-256. The local runner rejects untracked non-empty databases and changed migration checksums, wraps each file in a transaction and supports safe replay. These bootstrap files are specifically for staging and must not be applied to production; a reviewed production transition remains separate.

Remote initialization used the exact named staging database and verified zero users, zero credentials, three migration records and no foreign-key violations afterward. No production schema or credentials were modified.

## Checks completed

- Scope-normalized frontend JavaScript equivalence and exact stylesheet equality.
- Existing 52 frozen module/asset checksums.
- All 14 existing synthetic manager/menu/router integration tests.
- Local schema checks: migration replay, changed-checksum rejection, failed-file rollback, cross-tenant foreign-key denial, JSON object validation, case-insensitive username uniqueness, publication ownership and platform audit.
- Dump/restore of a synthetic SQLite database including indexes, then foreign-key verification.
- Staging health and refusal behavior described above.
- Existing root lint, TypeScript/Vite build and production assertions.

The backup drill is local SQLite; Cloudflare D1 Time Travel/export restore has not been rehearsed remotely. No claim is made that a production backup/restore procedure has passed.

## Next

Implement the reviewed username/password authentication design in staging, using existing stable user IDs only when performing the later controlled migration. Select and benchmark password hashing within Worker limits before enabling credentials. Add reset/revocation/tenant tests and a login UI; then add typed feature resolution and dashboard toggles.

Do not change production Access policies, issue a production super-admin password, merge this draft PR, or deploy the new frontend as part of this staging foundation.
