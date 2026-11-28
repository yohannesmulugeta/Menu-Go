# Phase 0: live-source recovery

## What changed

Recovered the core and router Worker modules into Git and captured the live frontend assets and active restaurant migrated media. Added a deterministic packaging command, remote-checksum integrity verification and synthetic regression checks. No production deployment, password reset, Access change or D1 migration was performed.

## Evidence

Base main commit: 33f87316fd8b9cf2b38124d6dcacfba07891a393.
Core version: 9165d6f7-a226-47c4-9863-8856262539c2.
Router version: 22b21817-df16-48ba-8e83-f324057bedb5.
See cloudflare/inventory/production.json for exact source and asset hashes.

The recovered app JS contains the Cloudflare JSON API client and no Supabase client. GitHub main's editable source still uses Supabase; its Pages deployment remains a separate historical implementation.

Cloudflare script downloads were parsed as multipart modules and every saved file was checked against a SHA-256 digest computed from the API response. Public static response bytes were fetched in the Cloudflare browser service and hashed before transfer. This avoids relying on HTML-rendered source as an exact-byte archive.

## Scope

- Two Workers, 15 modules total.
- Live frontend JS/CSS, referenced fonts, branding and social-preview asset.
- 23 distinct /migrated-media paths referenced by current active restaurant data.
- Existing Occasion synthetic tests, credential migration and protected route baselines.
- D1 schema/index definitions, without private rows.
- App custom domain, 13 zone routes, and relevant Access path/policy metadata without identities or secret values.

Captured static assets do not constitute an export of every unreferenced object in Cloudflare's ASSETS storage. They cover the dependency graph identified from the main HTML/JS/CSS and active restaurant image paths. Older unused files remain outside the inventory.

## Route and data baseline

Abol: active, 13 nondeleted categories / 89 nondeleted items.
Mokodo: active, 12 / 103.
Occasion: active, 15 / 116.
Sheba: active, 7 / 40.
some: active, 0 / 0.
Sora Table: draft, 5 / 8.
Addis Harvest: draft, 6 / 10.
Counts do not imply all remaining items/categories are available/active.

One super-admin membership and one local manager credential record exist. No credential data was exported.

Preserve /r/occasion, its ?design=abol preview, hash-based dashboard/menu aliases, /manager routes, Sheba routes and exact current media URLs. The manager authentication adapter and core API delegation are retained exactly.

## Remaining source gap

Original editable TypeScript for the Cloudflare-specific frontend is missing. The new build reliably repackages verified compiled assets; it does not claim to regenerate them from TypeScript. Recovering that source or deliberately reconstructing typed clients/components with parity tests is required before broad frontend refactoring.

The captured core modules are bundled, not claimed to be original authoring sources. They can be deployed as the recovered baseline after infrastructure/route review, but are not a desirable final module layout.

## Validation

Record executed check results in the PR. The baseline check covers exact hashes, Node syntax, referenced static files, truncated-download markers and known credential markers. Existing integration tests cover manager sessions/password changes/rate limits, tenant authorization, preview privacy, escaping and core delegation.

The build intentionally has no deployment command. No new UI comparison, load test, database restore or production-authentication test is claimed by this phase.

## Next bounded step

Prepare isolated staging D1/R2/Worker configuration and additive schema migrations. Preserve source snapshots. First implement a typed API/client compatibility layer against the recovered baseline before replacing compiled frontend behavior. Never point staging tests at production DB.

## Subsequent recovery

The editable frontend source was subsequently located on feat/cloudflare-full-migration and reconciled with the live bundle. See PHASE_1_STAGING.md for the reconstructed deltas, equivalence check and staging resource evidence. Historical limitations above describe the initial recovery snapshot.
