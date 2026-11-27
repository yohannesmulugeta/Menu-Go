# Representative staging menu HTTP load

27 November 2026. **Passed the bounded public-delivery profile.** The independent GitHub runner completed 1,660 requests with no incorrect responses, timeouts or dropped arrivals. This is evidence for the tested short profile; it does not certify maximum capacity, visitor counts or production readiness.

[Measured run](https://github.com/yohannesmulugeta/Menu-Go/actions/runs/45937691892), source `c6d24e56a5b48341c43ca6167feafdb302cfe890`. The standard build/regression CI also passed on this source: [CI run](https://github.com/yohannesmulugeta/Menu-Go/actions/runs/45937696421).

## Results

| Phase | Scheduled requests/s | Arrival window | Started / correct | Dropped | Median | p95 |
| --- | ---: | ---: | ---: | ---: | ---: | ---: |
| Fixture preflight | 10 | 6 s | 60 / 60 | 0 | 1,190.28 ms | 1,638.23 ms |
| Ramp | 10 | 10 s | 100 / 100 | 0 | 1,004.35 ms | 1,078.26 ms |
| Ramp | 25 | 10 s | 250 / 250 | 0 | 1,010.56 ms | 1,129.61 ms |
| Ramp | 50 | 10 s | 500 / 500 | 0 | 1,010.48 ms | 1,101.04 ms |
| Short sustained sample | 25 | 30 s | 750 / 750 | 0 | 1,000.27 ms | 1,077.97 ms |

All phases passed the provisional aggregate budgets: p95 <= 3 seconds, incorrect responses <= 1%, no dropped arrivals. Request times include headers, the complete response body and local content/checksum validation. The runner capped simultaneous work at 100 and timed out individual requests after 15 seconds. The next phase is skipped when a phase fails. Total consumed payload was 368,913,156 bytes (368.9 MB), not including HTTP overhead. The observed Cloudflare edge was SJC.

Requests are HTTP requests, **not people or simultaneous browser visits**. The 60-entry weighted manifest contains 20% HTML (English and Amharic), 75% images and 5% QR endpoints. This mix is repeated; exact counts by template and response kind are in the JSON evidence. Distinct probe query strings and response `no-store` checks avoid substituting a cached page for live publication/policy checks.

## Representative fixtures

Three disposable restaurants used the existing classic, mokodo and occasion templates. Each contained:

- 100 items with descriptions and exact saved prices in ETB, 10 categories and marked popular items.
- 20 exact-price variants, 100 synthetic Amharic item translations and seven opening-hour rows.
- Six real PNG objects in the staging R2 bucket: cover, logo and four separate owned item images.

PNG dimensions were 640x320, 128x128 and 320x240. Actual object sizes ranged from 52,836 to 628,752 bytes; total retained image bytes were 4,967,336. The deterministic generated pixel patterns provide substantial payloads; they are not restaurant photographs, and this test does not measure browser image decoding or visual quality. Only four of the 100 items had an image; this is a representative sampled menu, not a 100-photo worst case.

Fixture menu/configuration rows were inserted into isolated staging under a scoped operator plan. All 18 images were uploaded and attached through the actual authenticated media API; the account stayed below its existing 20-upload/15-minute quota. All three menus were published through the real publication endpoint, exercising validation, snapshot creation and publication references. No account had super-admin privileges, and no credentials were passed to GitHub Actions.

Anonymous preflight and load requests verified status, MIME type, no-store headers, English/Amharic final-item markers, the 100-item count and the exact 250.75 ETB variant price. Every PNG response was consumed and compared with its expected SHA-256 and byte length. QR responses were checked as SVG. The earlier QR decoding verification is separate; this HTTP load test did not decode every QR again. It also did not execute guest JavaScript, submit feedback or send analytics events.

## Cleanup and preservation

- All three fixtures are suspended. Their three HTML, three QR and 18 image endpoints returned 404 after cleanup.
- The temporary manager identity and credential are disabled. Its session is revoked; authenticated configuration access returned 401. The local private state no longer contains its session token or credential seed queries.
- Original records across 15 protected content/configuration, publication/media, identity/membership/credential, policy and migration tables matched their pre-test checksums. Newly created fixture rows were excluded from this comparison.
- Three synthetic publication snapshots and 18 referenced image objects remain retained for reproducibility. They are not publicly accessible while suspended. Audit history and fixture rows were not deleted.
- Worker version `03da5e9d-be53-4770-9aff-7d31566dcc8d` remained at 100% traffic throughout. No Worker deployment, migration, production route, domain, account, content or issued QR destination was changed.

## Repeatability and limits

`scripts/staging-capacity-fixtures.mjs` creates a private operator plan outside the repository, generates PNG payloads and provisions media/publications through staging APIs. The private file must never be committed or passed to a runner. Its generated D1 seed queries require an authorized operator to verify the exact staging marker/database before executing them. It is not a public provisioning endpoint.

`scripts/menu-capacity.mjs representative OUTPUT_JSON MANIFEST_JSON` runs the fixed 10/25/50 request ramps and the 30-second sample. The runner accepts only the staging origin and disposable public paths; it rejects production targets. `.github/workflows/staging-menu-capacity.yml` triggers only when that workflow file changes on the feature branch. It makes anonymous GETs, uses no secrets, saves raw artifacts even after a failed gate, and does not manage fixture lifetimes. The operator must guarantee suspension/account revocation afterward. Rerunning the saved workflow now will find the suspended fixtures and fail; do not reactivate fixtures casually or run against real restaurants.

[Durable measurements and cleanup proof](../cloudflare/inventory/capacity/representative-2026-11-27.json) include per-template/per-kind statistics, the source commit and artifact digest. Raw samples are in the `staging-representative-menu-capacity` artifact on the measured run, retained until 27 December 2026.

Remaining Stage 1 work: agree a sustained production traffic/budget profile, run a longer soak if required, measure deployed Worker CPU and actual account usage, and separately exercise login/upload load. The fixture uploads above are functional setup, not a certified upload-capacity test. Addis Ababa mobile networks, full browser page-load timings and native phone sharing remain unmeasured. The earlier 100/1,000-tenant checks were local SQLite checks; this deployed run used three restaurants and does not establish deployed 1,000-tenant capacity. Cost sensitivity values remain estimates until measured CPU and other usage are reconciled.
