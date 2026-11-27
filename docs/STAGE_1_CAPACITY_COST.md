# Stage 1: capacity and cost checks

Date: 27 November 2026. Source before measurement: `18caacfec0c113c3ba92b1e9ab1c6b718ce169a7`.

**Result: tooling and initial measurements completed; capacity acceptance remains unresolved.** Local indexed reads passed at 100 and 1,000 synthetic restaurants. The deployed 10 requests/second probe returned correct responses without errors, but missed the provisional 3-second p95 end-to-end budget. A health-only control showed almost the same slowdown. These observations cannot establish the application's maximum capacity or isolate an application defect. The 25 and 50 requests/second steps were deliberately skipped after the first failed latency gate.

Production code, routes, domains, accounts and content were not changed. PR #3 remains draft. The staging Worker version remains `03da5e9d-be53-4770-9aff-7d31566dcc8d`; no deployment or migration was needed.

## Measured results

| Local actual Worker / SQLite | 100 restaurants | 1,000 restaurants |
| --- | ---: | ---: |
| Items, 100 per restaurant | 10,000 | 100,000 |
| Measured sequential public HTML requests | 100 | 100 |
| Incorrect responses | 0 | 0 |
| Median request + consumed body | 3.65 ms | 3.36 ms |
| p95 request + consumed body | 7.16 ms | 8.19 ms |
| Database calls per HTML | 3 | 3 |
| SQLite tables + indexes + one publication per tenant | 5.81 MB | 55.12 MB |

These are Node 24 measurements with an in-memory database, prepared-statement reuse, no D1 network, no real R2, and no browser. They do not measure Worker CPU billing or public network performance. Each run warms all five templates, then reads a hot tenant and distributed tenants. Exact item counts, final item text, status and no-store headers are checked. EXPLAIN shows indexed restaurant, publication/head, policy epoch and template lookups. Only the fixed 30-entry feature-policy catalogue is scanned; restaurant count does not cause a public tenant-table scan.

| Deployed probe | Mixed menu/image/QR | Health control |
| --- | ---: | ---: |
| Scheduled arrival rate | 10 requests/s | 10 requests/s |
| Arrival window | 10 seconds | 10 seconds |
| Requests started / correct responses | 100 / 100 | 100 / 100 |
| Dropped arrivals / incorrect responses | 0 / 0 | 0 / 0 |
| Median response + full body | 3.87 s | 3.77 s |
| p95 response + full body | 7.97 s | 7.54 s |
| Total time including final responses | 15.37 s | 14.64 s |
| Completions per second including drain | 6.51 | 6.83 |
| Observed edge location | MXP | MXP |
| Provisional p95 <= 3 s and errors <= 1% | Failed latency | Failed latency |

The mixed probe used 75 HTML, 20 published PNG and 5 QR GETs. It verified expected saved price, MIME type and no-store headers, consumed every body, rejected redirects, used distinct probe query strings, bounded in-flight work to 100, and applied a 15-second request timeout. It did not execute JavaScript or create analytics/feedback events. The retained synthetic publication has **one item and a tiny PNG**. This is a bounded endpoint/arrival test, not a realistic full-menu capacity benchmark. The provisional 3-second threshold is an engineering starting point, not an agreed service-level commitment.

Both probes ran through this executor's outbound proxy from one location. The similar health-only slowdown means shared network/proxy behavior, Worker-to-D1 travel or database queueing must be separated before attributing the result to menu rendering. Read-only D1 query metadata reported the primary in SIN; the individual measured HTML SQL durations totalled about 0.96 ms, excluding network and queue time. Those separate query probes do not explain the eight-second tail latency. Client wall time must not be substituted for Worker CPU time.

The previous nine-request ADD performance sample is a different client/location and load pattern; it is not a controlled before/after comparison with this run.

## Cost scenarios

Official pricing was checked on 27 November 2026:

- [Workers pricing](https://developers.cloudflare.com/workers/platform/pricing/): Standard minimum $5/account/month, 10 million monthly requests and 30 million CPU ms included; additional requests $0.30/million and CPU $0.02/million ms.
- [D1 pricing](https://developers.cloudflare.com/d1/platform/pricing/): monthly Paid inclusions of 25 billion rows read, 50 million rows written and 5 GB storage; overages $0.001/million reads, $1/million writes and $0.75/GB-month.
- [R2 pricing](https://developers.cloudflare.com/r2/pricing/): Standard includes 10 GB-month, 1 million Class A and 10 million Class B operations. Overage $0.015/GB-month, $4.50/million A and $0.36/million B. The model rounds R2 billing units upward and assumes fewer than the included bucket/database counts.

Actual D1 `rows_read` metadata for the live read queries was 1 + 35 + 3 = **39 per HTML/QR**, and another 3 = **42 per published image**. A query call is not a billable row. The image also requires one R2 GET. No query instrumentation or counters were deployed to the application.

Planning assumptions: 300 views per restaurant per day, 30 days/month, four image GETs and one analytics event per view, QR GETs on 1% of views, two logins/day/restaurant, 200 other management requests and 20 uploads/month/restaurant. Each restaurant holds 60 MB of retained media and 0.55 MB of D1 data/history. The write model assumes four billed rows/event including index work, 80 reads/event, and conservative management allowances. Those event/manager/storage figures are assumptions, not measured usage. One analytics event per view also assumes collection is enabled and accepted within the existing rate limits.

| Restaurants | Model at 5 ms/request | Model at 20 ms/request | Model at 100 ms/request |
| --- | ---: | ---: | ---: |
| 20 | $5.00/month | $5.00/month | $6.58/month |
| 100 | $5.00/month | $6.60/month | $15.29/month |
| 1,000 | $33.49/month | $49.79/month | $136.68/month |

CPU values are **sensitivity assumptions**, not measured Cloudflare CPU. Each login has a separate 200 ms planning allowance. Paid-plan capacity is not certified by this cost table. The account's current subscription and other apps' consumption were not verified; all shared account allowances are assumed available. Domain, taxes, currency conversion, support, external backups, observability/logging, abuse and traffic beyond these assumptions are excluded. This is an estimated platform cost, not a quote or invoice. Low request counts alone do not validate the Free plan: its per-invocation CPU limit also matters for password hashing.

## Safety and repeatability

Only the retained disposable staging restaurant `99d27200-33f4-4079-bed9-3648c8ba97b9` was temporarily changed from suspended to active, with ID/slug/environment/head guards. Its original suspended state was restored after the probe. Public HTML, QR and image subsequently returned 404. Checksums of all 15 protected content/configuration, publication/media, identity/credential/membership, policy and migration tables matched before and after. No password, session or temporary credential was created or copied. Raw credentials are absent from the evidence.

Commands from the repository, with Node 24 and installed dependencies:

```sh
npm run check:menu-capacity
npm run measure:menu-scale -- /tmp/local-capacity.json
npm run estimate:menu-cost -- /tmp/menu-cost.json
node scripts/menu-capacity.mjs control /tmp/health-control.json
node scripts/menu-capacity.mjs remote /tmp/remote-capacity.json cloudflare/inventory/capacity/staging-paths.json
```

Where this executor requires its configured outbound proxy, set `NODE_USE_ENV_PROXY=1`. Remote public-fixture runs require a separately verified temporary staging activation and guaranteed restoration; the load tool itself performs GETs only and does not activate fixtures. Do not run against production. It hard-restricts the origin to the staging Worker and paths to disposable public fixtures or read-only health. The fixture is suspended now, so a remote run without controlled activation correctly fails. A nonzero process exit indicates a failed budget; inspect the written JSON rather than assuming execution failed before measurement.

Validation passed: runner/pricing behavior checks, local scale assertions, existing publication/media regression suite, and ESLint. CI now includes the tooling checks; these use fake HTTP responses and do not generate remote traffic. No application runtime code changed.

## Remaining Stage 1 acceptance

1. Run the same paced health/public tests from an independent client with known network conditions, including Addis Ababa. Capture Worker CPU, wall time and D1 latency/queue metrics for the exact test interval. Keep the staging resource bindings and deployment fixed.
2. If that confirms backend latency, address the measured source and rerun the same baseline. Do not remove live publication/policy revocation checks to reduce request time.
3. Use isolated, fully populated synthetic staging menus with representative images, translations/variants and publication history; then clear 10/25/50 requests/second and a sustained soak against agreed budgets. Local 1,000-tenant results do not replace this step.
4. Separately benchmark login and upload workloads, including CPU and rate-limit outcomes. Their cost remains assumed here.
5. Replace CPU/event/management/storage assumptions with measured account usage, account for other apps sharing allowances, and agree the expected traffic before accepting a monthly budget.

Stage 1 must not be marked capacity-approved. Native phone sharing, approved restaurant content and production cutover remain later work.

Machine-readable evidence: [capacity measurements](../cloudflare/inventory/capacity/2026-11-27.json), [cost scenarios](../cloudflare/inventory/capacity/cost-2026-11-27.json).
