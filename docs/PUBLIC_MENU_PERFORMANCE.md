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

## Verified staging release

Worker `03da5e9d-be53-4770-9aff-7d31566dcc8d` serves 100% of staging traffic. The uploaded bundle matches the dry-run build. The actual environment marker, D1/R2 bindings, six migration checksums, scheduled cleanup and health were verified. Code rollback targets `0d590b59-f666-404e-be4f-b80eb6faef13`; retain the additive schema, credentials, publication history and referenced media. The private D1 export passed a test restore. No migration was applied.

All local checks listed above passed, including both browser suites. [GitHub CI passed on the runtime commit](https://github.com/yohannesmulugeta/Menu-Go/actions/runs/45927342143).

| Nine-request sample | Before | After |
|---|---:|---:|
| Median response headers, including network | 1635 ms | 953 ms |
| Smallest–largest response-header timing | 1522–3824 ms | 936–968 ms |

The observed median decreased by 41.7%. Both samples used the same retained synthetic publication and the ADD point of presence. Response sizes stayed unchanged. These sequential samples do not establish performance under concurrent traffic.

Deployed checks verified translated item text, exact saved item/variant prices, hours, GET/HEAD behavior, no-store/CSP headers and current R2 image bytes against the stored checksum. The prior image URL remained revoked. Feedback was accepted, cross-origin feedback was rejected, and analytics disabled in the publication stayed denied. The deployed anonymous menu loaded images at all four widths without overflow or browser console errors. The downloaded QR decoded to the exact stable staging menu URL.

The synthetic restaurant was restored to its original suspended state after every probe. Suspension immediately revoked menu, QR, image and feedback access. Content, identities, credentials, memberships, policies, publication heads/history and media metadata matched the pre-rollout backup. One synthetic feedback record from this verification remains retained; no user data or media was deleted.

[The staging inventory](../cloudflare/inventory/platform-staging.json) records complete timings, checksums and deployment evidence. Production remains untouched and PR #3 remains draft. Next release work is concurrent capacity/cost measurement, native device sharing, and authorized content reconciliation and production cutover.
