# Menu Go on Cloudflare

Public site: https://menu.admakidigital.com/

Administrator sign-in: https://menu.admakidigital.com/#/login

The original React interface is preserved. The deployed application has no
Supabase runtime client, credentials, authentication calls, storage links or
database calls. Historical source migrations remain archived for rollback.

## Deployed services

- Worker: `admaki-menu`
- D1: `admaki-menu`, binding `DB`
- Cloudflare Access application: `Menu Go administrator sign-in`
- Photos: 36 copied assets served by Workers Static Assets
- R2 uploads: implemented, awaiting account activation and binding `MEDIA`

The account's existing public menus and private business records were copied to
D1 from a source snapshot on November 9, 2026:

| Table | Migrated rows |
|---|---:|
| Restaurants | 5 |
| Categories | 36 |
| Menu items | 210 |
| Opening hours | 21 |
| Wi-Fi details | 2 |
| Feedback | 5 |
| Analytics | 94 |
| Activity history | 156 |
| Invitations | 2 |
| Users (identity mapping, no passwords) | 1 |
| Platform administrators | 1 |
| Restaurant memberships | 0 |

Counts were verified against D1 immediately after import. Subsequent visitors
and edits naturally change analytics, activity and feedback counts.

All public photo URLs used by restaurant profiles and items were copied,
including both Supabase Storage objects. Two source buckets were public. There
were no private storage objects to migrate. Existing third-party photos were
also copied rather than leaving an external image dependency.

## Authentication and authorization

Customers do not sign in. Staff choose **Continue with email**. Cloudflare Access
sends an email code and issues an HTTP-only application cookie after verifying
the mailbox. No old password needs importing or resetting.

Only `/api/auth` is protected at the edge: public menus remain public. The Worker
cryptographically verifies every staff request against the configured issuer,
application audience, RS256 signature, token type and expiry. D1 then maps the
verified email to the migrated user identity and checks platform/admin or
restaurant membership. Email verification alone grants no menu access. The
Access policy permits verified email login so invited managers can join without
giving the Worker account-management API credentials.

Invitations remain email-bound, expire after 14 days, are stored as SHA-256
hashes, and redeem transactionally with a unique claim nonce. Each redemption
grants only manager access for the named restaurant. A disabled user is rejected
even if their Access token has not expired.

No secrets or password hashes from the old authentication system were imported.
The current owner role is attached to the verified email from the original
database. Access session duration is eight hours; sign out uses Access logout.

## Verification

`npm run check` runs lint, 16 tests including the parent test, the React build and
production assertions. Tests use actual SQLite SQL and real RS256 JWTs from
local test keys, rather than an authentication bypass. They cover signature,
issuer, audience and expiry checks; tenant isolation; CSRF; invite reuse;
item/category changes; audit records; hours; feedback; abuse limits; and R2
upload handling. No test identities or keys are deployed.

The custom domain and API health endpoint have been checked. The original Abol
Coffee interface loads on the new domain with its categories and prices.
Successful live email verification and a signed-in dashboard edit still need
the owner's interactive login. Unit coverage is not represented as a live login
test. R2 cannot be end-to-end tested until activation.

## Finish photo uploads

The account API returns `Please enable R2 through the Cloudflare Dashboard`.
The owner must activate R2 in the dashboard, reviewing any billing/terms screen.
Then create bucket `admaki-menu-media` and add this binding to `wrangler.jsonc`:

```json
"r2_buckets": [{"binding":"MEDIA","bucket_name":"admaki-menu-media"}]
```

Redeploy the Worker with `MEDIA`. It accepts JPEG, PNG, WebP and AVIF files up to
5 MB, checks signatures and restaurant access, stores immutable unique keys,
and serves the resulting `/media/...` URLs. Existing photo links do not depend
on R2 activation. Do not add a public R2 bucket; files are served via the Worker.

## Develop and deploy

Use Node 24 and Python 3. Install with `npm ci`, then `npm run check`.

`prebuild` verifies existing copied photos against the public asset manifest.
When cloning onto another computer, missing photos are downloaded from their
current Cloudflare deployment and checked against SHA-256 hashes. Photo binaries
are deployment data rather than Git source. A separately retained migration
backup includes the source records, import statements and all 36 photos for
recovery if the public deployment is unavailable. Keep the private export out
of Git; `.migration-private` is ignored.

`npm run deploy:cloudflare` builds the frontend and deploys with Wrangler using
the owner's authenticated Cloudflare CLI session. `npm run build:worker` builds
the Worker without deploying. Bindings and public Access identifiers are in
`cloudflare/wrangler.jsonc`; no account API token is stored there.

The GitHub workflow validates this branch. On merge, its Pages artifact is a
redirect preserving the old QR URL's query and hash, so legacy QR codes can
reach the new domain. It does not deploy the Worker or copy data. Leave the PR
unmerged until staff login and upload activation have been verified. Existing
GitHub Pages and Supabase remain available as rollback during this period.

Adding a custom domain later requires adding its `/api/auth` hostname to the
same Access application and updating the canonical site URL before building.
Never expose administrator APIs through a new hostname without JWT verification.

## Data operations and limits

Menu removals and category removals are soft deletions. Item version checks
reject stale saves. Changes create tenant-scoped activity records; public
feedback and analytics use bounded JSON and short-window request limits. Raw
visitor IP addresses are not stored in the limit table.

Source-import tooling reads ignored exports, converts JSON/bytea/boolean fields,
rewrites photo URLs and generates prepared insert batches. It only inserts into
an empty database and deliberately fails on duplicates. Never rerun it against
a database that has received edits. Reconcile any changes made in the old
Supabase app before final cutover; the migration is a snapshot, not dual-write.

No paid Workers upgrade, R2 subscription or domain purchase was made by this
migration. Existing account allowances and billing still apply.
