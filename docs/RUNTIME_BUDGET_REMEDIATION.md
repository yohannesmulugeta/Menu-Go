# Runtime-budget remediation on Workers Free

27 November 2026. **Launch blocker: concurrent login reached Cloudflare runtime limits.** The public-menu HTTP profile passed previously; that does not validate the substantially more expensive password-checking workload.

## Verified evidence

- The account's Workers plans page showed **Free** as the current plan and offered Paid at **$5/month plus usage**. The plans page was read only; no upgrade or payment was submitted.
- Cloudflare's live GraphQL schema describes `cpuTimeUs` and `startupCpuTimeUs` in microseconds. The earlier 1,660-request public test produced 1,659 adaptive estimated invocations, zero runtime errors and about **4.85 ms mean runtime CPU plus separately reported startup CPU per estimated invocation**. CPU p50/p95/p99 were 3.517/10.448/19.626 ms. Adaptive analytics are not the invoice or the exact client count.
- All nine sequential login requests succeeded. The matching nine-invocation analytics window measured **155.52 ms mean runtime plus startup CPU**, with CPU p50 147.06 ms and p95 172.06 ms.
- The subsequent three-concurrent-request test encountered HTTP 503. The broader login/cleanup window recorded **three `exceededResources` invocations**. Failed invocations had CPU p50 10 ms and p99 29.624 ms; observed memory p99 was about 7.12 MB, well below the 128 MB isolate limit. The initial benchmark stopped and its first driver version did not drain outstanding phase requests before cleanup; the driver now drains in-flight work and preserves failed phase counts. The failed run remains failed; it is not replaced with a passing result.
- The actual staging Worker had no explicit CPU limit in its settings. `usage_model: standard` is not evidence that the account has Workers Paid.
- Separate upload-only samples used operator-issued sessions scoped to disposable managers. Three sequential and nine concurrent PNG uploads returned 201; their matching provider metrics measured about **19.09 ms mean CPU**. These sessions do not demonstrate a successful concurrent login. Client upload timings include the operator's outbound network/proxy and are not independent browser timings.
- The extended upload run subsequently returned HTTP 503 before the per-account quota test could finish. Cloudflare recorded another `exceededResources` event in that upload window. Twenty accepted images were deleted through the media API, and an interrupted pending upload record was also deleted through that API. Final checks found zero live assets, all three managers/credentials disabled, every test session revoked, all three test restaurants suspended, original protected records unchanged and no Worker-version change. Both extended profiles remain **failed**.

[Cloudflare limits](https://developers.cloudflare.com/workers/platform/limits/) specify a 10 ms per-request CPU allowance for Free and a larger configurable allowance for Paid. The runtime can tolerate occasional overages, which explains why some expensive requests may succeed before limits are enforced. The verified Free plan, large secure-login CPU requirement, low observed memory and `exceededResources` events strongly support a CPU-budget mismatch. This finding does not require assuming that a slow network consumes CPU time.

## Owner decision: remain on Free

The owner explicitly chose Workers Free. No subscription upgrade or Paid-only CPU override is authorized or applied. The earlier $5/month Paid option is deferred; it is not the next required action.

## Free-plan implementation — live validation pending

The staging entrypoint now routes only secure-password mutations and PNG uploads through a private SQLite-backed `MenuPrivateOperations` Durable Object binding. Public menus, QR delivery, session reads, editing and the remaining routes retain their existing handler. Request bodies stream across RPC; the front Worker does not buffer or parse credentials/images. Auth objects are partitioned by a SHA-256 digest of the Cloudflare-provided source address; image objects by restaurant ID digest. No raw address, username, password or session token is stored in object names. This is private request coordination, not a new public authentication API or identity store. D1 remains authoritative for sessions, quotas and credential-version/actor guards across objects.

The object calls the unchanged application router. Password parameters (`scrypt N=16384,r=8,p=5`), generic authentication errors, origin checks, account/IP throttles, tenant permissions, post-hash transaction guards, upload bounds and quotas remain unchanged. The object has no public fetch handler, timer, credential cache or storage writes. Missing bindings and RPC failures fail closed, with no expensive fallback or automatic mutation retry.

Cloudflare documents [SQLite Durable Objects on Free](https://developers.cloudflare.com/durable-objects/platform/pricing/) and [a default 30-second CPU allowance](https://developers.cloudflare.com/durable-objects/platform/limits/). Free quotas include 100,000 object requests and 13,000 GB-s duration per day, shared across the account. Quota exhaustion rejects operations; this architecture is not unlimited capacity. Neither Paid billing nor an explicit CPU override is part of the change.

Local validation passed in the actual Workers runtime using the Cloudflare Vitest integration: concurrent username/password login, secure cookies over RPC, generic errors, account creation, first-password change, administrator reset, old-session revocation, unchanged scrypt parameters, cross-tenant/role/CSRF denials, real D1/R2 PNG round trips, invalid/oversize uploads, the 20-image quota and login rate limiting. The full existing security/build regression suites also passed. These local tests do not prove deployed Free-plan behavior.

Before accepting the fix: deploy only verified staging bindings after a tested private database restore; repeat the bounded real login/upload profile with fresh synthetic users; collect provider resource outcomes and CPU metrics; clean every test identity/session/image; compare original protected records; and check public delivery. Keep production unchanged and PR #3 draft until phone, content and production release checks pass.

## Cost implication

[Calibrated Paid-plan scenarios](../cloudflare/inventory/capacity/calibrated-cost-2026-11-27.json) use measured public/login/upload CPU means while retaining explicit assumptions for future traffic, event/manager CPU, media/history storage and shared account allowances. At the previously documented traffic profile, the model is approximately $5/month for 20 restaurants, $5.22 for 100 and $36.07 for 1,000. These are conditional planning values, not current charges, an invoice or supported tenant-capacity claims. Domain, taxes, currency conversion, support, external backups, observability and exceptional abuse remain outside the model.

Calendar-month analytics were also retrieved across the account. They are adaptive estimates for the stated UTC period, not the actual subscription billing cycle. The dedicated billing/subscription API was not available through the current connection, so the account plan was verified in the dashboard instead. R2 storage analytics appeared delayed relative to the retained test objects and were not substituted for the explicit retained-storage assumptions.

[Provider CPU and usage evidence](../cloudflare/inventory/capacity/usage-2026-11-27.json) includes units, windows, sampling caveats and the current plan observation. Login/upload test results and cleanup are recorded separately. A free domain or low request count would not resolve the measured per-invocation CPU mismatch.
