# Required runtime-budget decision before launch

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

## Proposed change — not applied

1. Obtain the owner's approval to enable **Workers Paid, $5/account/month base plus metered usage**. This is an account-wide subscription, not a charge per restaurant. It shares included usage with the account's other Workers. No financial action is authorized by this report itself.
2. Verify that the account now shows Paid. Keep password hashing parameters, rate limits, tenant authorization and credential handling intact.
3. Set an explicit **500 ms CPU ceiling on the staging Worker** and repeat the isolated login/upload profiles. This is a proposed bounded starting budget, not an already verified operational limit. A normal username/password login must work reliably without depending on Free-plan overage tolerance.

```json
"limits": { "cpu_ms": 500 }
```

Apply this to `cloudflare/wrangler.platform-staging.jsonc` only after the Paid plan is confirmed. Verify the exact staging DB/R2 bindings and current version before a staging-only deployment; retain a code/version rollback. No production routing, domain, credentials or content cutover is included. Restoring an old Worker version does not cancel a paid account subscription.

4. Retest single and three-concurrent logins, generic errors, role/tenant denials, session revocation, rate limits, upload checksums and upload quotas without resetting/bypassing production protections. Use fresh synthetic accounts and guarantee disabled accounts, revoked sessions and removed disposable uploads afterward.
5. Require no unexpected HTTP failures or `exceededResources` events, then complete agreed network/phone/content checks before release review. Do not mark Stage 1 or production launch approved before this succeeds.

The existing scrypt format remains `N=16384, r=8, p=5`. No password work factor was reduced, no authentication system was replaced, and no runtime/billing change was made during this investigation.

## Cost implication

[Calibrated Paid-plan scenarios](../cloudflare/inventory/capacity/calibrated-cost-2026-11-27.json) use measured public/login/upload CPU means while retaining explicit assumptions for future traffic, event/manager CPU, media/history storage and shared account allowances. At the previously documented traffic profile, the model is approximately $5/month for 20 restaurants, $5.22 for 100 and $36.07 for 1,000. These are conditional planning values, not current charges, an invoice or supported tenant-capacity claims. Domain, taxes, currency conversion, support, external backups, observability and exceptional abuse remain outside the model.

Calendar-month analytics were also retrieved across the account. They are adaptive estimates for the stated UTC period, not the actual subscription billing cycle. The dedicated billing/subscription API was not available through the current connection, so the account plan was verified in the dashboard instead. R2 storage analytics appeared delayed relative to the retained test objects and were not substituted for the explicit retained-storage assumptions.

[Provider CPU and usage evidence](../cloudflare/inventory/capacity/usage-2026-11-27.json) includes units, windows, sampling caveats and the current plan observation. Login/upload test results and cleanup are recorded separately. A free domain or low request count would not resolve the measured per-invocation CPU mismatch.
