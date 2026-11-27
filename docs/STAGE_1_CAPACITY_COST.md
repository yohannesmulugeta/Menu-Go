# Stage 1: capacity and cost checks

Date: 27 November 2026. Source before measurement: `18caacfec0c113c3ba92b1e9ab1c6b718ce169a7`.

**Result: public delivery passed, but the account runtime budget blocks launch.** Nine sequential logins succeeded; the concurrent-login profile and later extended uploads encountered HTTP 503 with Cloudflare resource-limit events. The dashboard confirmed Workers Free (10 ms/request). Measured mean CPU was about 155.52 ms for the sequential login window and 19.09 ms for upload samples, versus 4.85 ms for the earlier public profile. No billing/runtime setting or password work factor was changed. See [current readiness](STAGING_READINESS.md) and [the proposed runtime-budget fix](RUNTIME_BUDGET_REMEDIATION.md).

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

## Independent-client health comparison

The [independent GitHub-hosted run](https://github.com/yohannesmulugeta/Menu-Go/actions/runs/45936406697) completed successfully on 27 November 2026. Both runs used the existing control script, 10 requests/second for 10 seconds, and the same staging deployment as the earlier measurements.

| Health control | Earlier executor | Independent run 1 | Independent run 2 |
| --- | ---: | ---: | ---: |
| Started / correct requests | 100 / 100 | 100 / 100 | 100 / 100 |
| Dropped / incorrect | 0 / 0 | 0 / 0 | 0 / 0 |
| Median | 3,766.29 ms | 472.68 ms | 466.28 ms |
| p95 | 7,535.66 ms | 538.16 ms | 515.28 ms |
| Edge | MXP | ORD | ORD |
| Provisional 3-second p95 gate | Failed | Passed | Passed |

Worker version `03da5e9d-be53-4770-9aff-7d31566dcc8d` and deployment `e47e1ed2-8176-40bc-94a5-be3dc7f93600` were verified unchanged before and after this comparison. No restaurant state was changed.

The health endpoint performs **two D1 reads**: environment-marker lookup and migration count. It does not render menus or read R2. Earlier control metadata described only the environment check; that scope label is corrected in the tool, with no behavior change. No HTTP latency measurement here is treated as Worker CPU time.

The similar slow menu/health result in the original executor and the much faster independent health result support the inference that the original client/network/edge path contributed. Geography and client both changed, so this is not proof that a particular proxy or network was responsible. The subsequent representative public-menu HTTP tests also passed; see the report below. Addis Ababa mobile-network performance remains unmeasured.

The new `.github/workflows/staging-network-probe.yml` runs only when that workflow file changes on the existing feature branch. It has read-only repository permissions, uses no secrets, makes only staging health GETs, and saves raw JSON even if the latency budget fails. Existing runs can be rerun from their Actions page. It is not a production deployment or recurring schedule.

[Durable comparison summary](../cloudflare/inventory/capacity/network-control-2026-11-27.json) includes the source commit and artifact digest. Raw samples are in the `staging-network-probe` artifact on the run page, currently retained until 27 December 2026. The standard build/regression workflow also passed on the probe workflow's source commit.

## Representative public delivery — passed for the tested profile

[The independent menu run](https://github.com/yohannesmulugeta/Menu-Go/actions/runs/45937691892) verified three 100-item layouts, English/Amharic content, exact variant prices, six R2 images per menu and QR responses. All 1,660 requests were correct, with no dropped arrivals. p95 was 1,078.26 ms at 10 requests/s, 1,129.61 ms at 25 requests/s, 1,101.04 ms at 50 requests/s and 1,077.97 ms during the 30-second 25 requests/s sample. The 60-request preflight p95 was 1,638.23 ms. The unchanged staging version served 368.9 MB of response payload from the SJC edge.

All fixtures are suspended, their temporary account is disabled and revoked, all 24 public menu/QR/image destinations returned 404, and the account API returned 401. Original records across 15 protected tables matched their pre-test checksums. Three synthetic publications and 18 images (4.97 MB) remain privately retained. See [full results, methodology, cleanup and limits](REPRESENTATIVE_MENU_CAPACITY.md).

## Remaining Stage 1 acceptance

1. Resolve the verified Free-plan CPU-budget mismatch. The proposed owner decision is Workers Paid ($5/account/month base plus usage), then a 500 ms staging CPU ceiling and retest. This recurring billing change has not been made.
2. Rerun login and extended upload/quota tests after the budget is compatible. The latest extended profiles failed; only their smaller successful samples are reported as passing. Operator-network wall timings are not independent browser timings.
3. Actual provider CPU/account usage is now recorded, and Paid forecasts use measured public/login/upload CPU means. Future traffic, event/manager CPU, storage retention, shared allowance consumption and the real invoice period still limit the forecast.
4. Agree production traffic/duration expectations and complete café content, real-phone/network, sharing and final release checks. The earlier three-restaurant/30-second profile is not a deployed 1,000-tenant or long-soak certification.

Current launch status is blocked. All new test accounts/sessions/media were cleaned up, original protected records matched, and production remains unchanged. See [current readiness](STAGING_READINESS.md).

Machine-readable evidence: [capacity measurements](../cloudflare/inventory/capacity/2026-11-27.json), [cost scenarios](../cloudflare/inventory/capacity/cost-2026-11-27.json).
