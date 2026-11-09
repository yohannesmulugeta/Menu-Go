# Menu Go: isolated D1 pilot

This is a separate test deployment. The GitHub Pages application, Supabase data,
user accounts, and existing customer QR URLs have not been migrated or changed.

## Deployed resources

- Worker: `admaki-menu-d1-pilot`
- Database: `admaki-menu-d1-pilot` (binding: `DB`)
- Public test menu: https://admaki-menu-d1-pilot.yohannesmulugeta084.workers.dev/r/abol-coffee
- Second test menu: https://admaki-menu-d1-pilot.yohannesmulugeta084.workers.dev/r/mokodo-pizza
- Dashboard: https://admaki-menu-d1-pilot.yohannesmulugeta084.workers.dev/admin
- Health: `/api/health`

The D1 ID in `wrangler.jsonc` belongs only to this pilot. Never reuse this
configuration for the live application's database.

## What was checked on November 9, 2026

- GitHub Pages responds with HTTP 200. Abol Coffee's menu renders in a real
  browser, and its Hot Drinks category loads without console errors.
- The existing Supabase project is `ACTIVE_HEALTHY`; its health advisor has no
  findings. `list_tables` approximate row counts are stale and show zeros:
  exact SQL queries confirm restaurant data exists.
- Exact source counts: Abol Coffee, 89 items / 13 categories; Mokodo Pizza,
  103 items / 12 categories. Both were copied into D1, including availability.
- No Menu-Go D1 database, Worker, or Pages project existed in the connected
  Cloudflare account before this pilot. The original reported D1 error was not
  available and cannot be assigned a confirmed cause.
- Existing React build and production assertions pass.
- `node --test d1-pilot/worker.test.mjs` passes all 14 tests (including the parent
  test). Tests execute actual SQLite SQL; external authentication is mocked.
- Live D1 / Worker / browser read flow verified. A price in the pilot was
  changed from 329 to 330 ETB using the management API, observed in the browser,
  then restored to 329 ETB and verified again. This was not a live dashboard
  authentication test; no customer-facing production price was changed.

## Dashboard capabilities

- Existing Menu Go email/password login, with access tokens held in memory.
- Restaurant managers can edit only their own restaurant. Platform admins can
  edit both pilot restaurants. Roles are looked up through the existing
  Supabase API and RLS on every admin request, after verifying the access token
  with `/auth/v1/user`. No service key or user-metadata authorization is used.
- Add/edit menu items, prices, descriptions, HTTPS image URLs, availability,
  and popular flags.
- Add/rename/hide categories. Public queries hide unavailable items and items
  belonging to hidden categories.
- Soft-remove menu items. Audit entries record who made each change.
- Integer minor units preserve two-decimal prices. Optimistic item versions
  prevent silently overwriting another editor's item update.
- Same-origin write checks, bounded JSON request bodies, prepared SQL,
  tenant-scoped writes, CSP, and no caching of authenticated responses.

Sign in using an existing confirmed account already assigned as a Menu Go
manager or platform administrator. No new user was created and no password was
changed. Authorized live dashboard edits still need verification after sign-in;
the automated tests cover that path with identity fixtures. Sessions expire
without refresh; reload or expiry requires signing in again for this pilot.

## Run checks

Node 24 is needed for the test adapter's built-in SQLite support:

```sh
node --test d1-pilot/worker.test.mjs
npm run build
npm run check:production
```

`schema.sql` initializes an empty D1 database. `seed.mjs` emits prepared D1 query
batches from `public-snapshot.json`. Apply batches to an empty pilot database
only; inserts fail rather than overwriting existing edits. The snapshot contains
public restaurant/menu fields only; it excludes accounts, invites, feedback,
analytics, Wi-Fi information and private audit records.

Deploy the two ES modules through Cloudflare's Worker upload API or an installed
Wrangler CLI using `d1-pilot/wrangler.jsonc`. Do not deploy the root React app over
the pilot Worker. The publishable key in the config is already public in the
existing deployment workflow. No private key is required here.

## Before a complete migration

This pilot deliberately retains Supabase **authentication and authorization**.
Public menus load from D1 without Supabase; admin sign-in and permission checks
still depend on Supabase. This is not yet a Supabase-independent replacement.

Before replacing production:

1. Verify successful sign-in, editing and sign-out using the owner's actual
   account; verify a real manager cannot access the other restaurant.
2. Choose a replacement identity provider or owner-only login if completely
   removing Supabase, and implement account recovery and session management.
3. Copy every required tenant and complete field/feature parity: social links,
   opening hours, feedback, analytics, invitations and platform management.
4. Add image storage/upload (e.g. R2) with MIME/size validation and access rules.
   The pilot supports photo URLs, not file uploads, and retains existing image
   URLs. It has created no R2 bucket or paid service.
5. Back up production data and image assets; test a restore into a separate
   environment. The public snapshot here is not a full production backup.
6. Add abuse controls, sign-in monitoring and appropriate rate limits; verify
   existing CAPTCHA requirements if enabled. The pilot relies on upstream
   Supabase login rate limits and does not change Auth configuration.
7. Run browser checks for the completed editor on phone/desktop, then deploy a
   staging build of the existing frontend against D1.
8. Reconcile changes since this snapshot before switching the original customer
   URLs. Keep a rollback path; changing database IDs alone cannot migrate a
   Supabase app to D1.

No paid Cloudflare upgrade was requested or made. Existing account allowances
and billing still apply; this deployment does not guarantee unlimited free use.
