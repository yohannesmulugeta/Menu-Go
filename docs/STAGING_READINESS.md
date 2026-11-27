# ADMAKI Menu staging readiness

27 November 2026. **Bounded Free-plan HTTP validation passed; production release remains pending.** No subscription, metered-billing activation or Paid-only CPU override was applied. The earlier failed tests remain recorded as historical failures.

| Area | Current result | Next requirement |
| --- | --- | --- |
| Shared dashboard/editor, username/password, roles and feature toggles | Implemented in staging; regression suites pass | Reconcile existing café accounts and approved settings before cutover |
| Public delivery | Earlier 1,660-request bounded profile passed; Free remediation passed 24 menu/QR/image checks | Real-phone and geographic checks; no unlimited-capacity claim |
| Free-plan login | New private runtime passed nine sequential and nine three-concurrent login requests, generic-error, isolation, rate-limit and logout checks | Review provider RPC disconnect telemetry; bounded HTTP success is not full capacity certification |
| Free-plan uploads | Three sequential and nine three-concurrent requests passed, plus image integrity, rejection and quota checks | Real-phone file-picker/network checks |
| Provider outcomes | Front Worker: 153 estimated invocations, zero errors. Durable Objects: three success and 60 clientDisconnected RPC outcomes; no resource-limit outcome returned | Explain RPC lifecycle outcomes before claiming zero provider errors |
| Test cleanup | Three users/credentials disabled, zero unrevoked sessions, three fixtures suspended, all 28 uploads deleted; 15 protected table fingerprints unchanged | Retain audit evidence and private backup recovery procedure |
| Old QR routing | Shared candidate supports exact legacy hash menu links before sign-in; malformed links return an error, never another café | Verify in staging, then reconcile production domains and every printed QR before cutover |
| Restaurant content | Abol 89 items/13 categories and Occasion 116/15 were previously inventoried; no customer content published by these tests | Confirm exact prices, images, tax notes, contact links and designs |
| Real phones | HTTP and simulated-browser checks do not certify physical phones | Test QR scanning, sharing, images and manager editing on actual phones/networks |
| Production cutover | PR #3 remains draft; production Worker versions unchanged | Current-data import rehearsal, route/content parity, recovery manifest and final release decision |

The retained Free remediation deployment is `79390ac3-596e-499f-9161-0484f77805cc`. Its private SQLite Durable Object binding keeps password hashing and upload validation outside the front Worker's small CPU budget without weakening authentication. Public menus retain their previous handler. The new class is a lifecycle boundary: preserve it and its namespace/migration history during forward corrections; do not attempt a direct rollback to pre-class versions.

Evidence: [Free validation and cleanup](../cloudflare/inventory/capacity/free-runtime-validation-2026-11-27.json), [HTTP tests](../cloudflare/inventory/capacity/free-runtime-http-2026-11-27.json), [public checks](../cloudflare/inventory/capacity/free-runtime-public-2026-11-27.json), [revocation](../cloudflare/inventory/capacity/free-runtime-revocation-2026-11-27.json), [runtime implementation/recovery](RUNTIME_BUDGET_REMEDIATION.md) and [production preflight](PRODUCTION_CUTOVER_PREFLIGHT.md).
