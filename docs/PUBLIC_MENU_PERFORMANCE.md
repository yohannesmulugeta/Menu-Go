# Public menu read performance

Public delivery now reads the active publication, template capabilities and live feature policies in one SQLite statement. Previously these were three sequential database requests. The shared helper preserves the different template lookup used by legacy capability-only snapshots.

The environment check still runs on every request. Menu, QR and image responses still recheck the current publication and policy epoch immediately before responding. Guest feedback and analytics retain their atomic write guards and rate limits. Responses remain `no-store`; no public cache or migration is introduced.

| Successful request | Previous database calls | Current database calls |
|---|---:|---:|
| Public menu HTML | 5 | 3 |
| QR SVG | 5 | 3 |
| Published image | 6 | 4 |
| Guest feedback or analytics write | 6 | 4 |

These counts include the environment check. An image also reads its publication reference and R2 object; the R2 call is separate from the database count. Missing or invalid policy epochs fail closed.

## Changed files

- `cloudflare/platform/publications/context.mjs` adds the coherent public context read.
- `cloudflare/platform/publications/service.mjs` and `cloudflare/platform/config/capabilities.mjs` consume it.
- `cloudflare/platform/config/service.mjs` shares policy decoding and validates the policy epoch.
- `scripts/check-menu-publications.mjs` checks request counts, rendering-time policy/head races and missing policy state alongside the existing publication security tests.

## Validation

Local lint, TypeScript, production build/checks, baseline integrity/router tests, recovered frontend checks and the platform, media, authentication, feature, onboarding, publication and editor suites are required before staging deployment. Browser checks exercise all five public templates at 360, 390, 768 and 1440 pixels, guest feedback/analytics, QR generation, desktop sharing fallback and unpublishing. Editor browser coverage includes settings saving during delayed image loading, photo conversion/attachment, variants, translations and hours.

The staging procedure verifies the actual environment marker, D1/R2 bindings, six unchanged migration checksums, rollback version and a privately stored D1 export that passes a test restore. Only `cloudflare/wrangler.platform-staging.jsonc` is deployed. The uploaded bundle must match the checked dry-run build.

The before/after probe uses the same retained synthetic publication, one warm-up and nine sequential anonymous HTML requests. It consumes each response, checks `no-store` and the expected saved price, and restores the synthetic restaurant's original suspended state in `finally`. It does not execute guest analytics. Timings include network overhead and are a small single-location sample, not a load or cost certification. Deployment results are recorded after verification.

Production remains untouched and PR #3 remains draft. Native mobile sharing, capacity/cost measurement and authorized restaurant content/cutover remain release work.
