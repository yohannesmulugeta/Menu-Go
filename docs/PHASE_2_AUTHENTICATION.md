# Shared authentication — staging release

The isolated staging Worker now supports the same username/password login for super admin and restaurant managers. No mailbox, email verification, SMS, public signup or guest account is required. Production Workers, Access policies, routes, QR URLs and restaurant data are unchanged.

## Password-storage decision and runtime evidence

New credentials use native `node:crypto` scrypt with N=16,384, r=8, p=5, a random 24-byte salt, 32-byte output, and a 32 MiB allocation ceiling. The serialized format records the algorithm, salt encoding and cost. Verification accepts only the explicitly supported formats and costs; it cannot allocate memory based on unbounded database parameters.

OWASP lists this scrypt configuration among its minimum configurations when Argon2id is unavailable. Cloudflare documents native Argon2 as unsupported. Both native PBKDF2 and Web Crypto rejected 600,000 PBKDF2 iterations on the actual staging runtime with a 100,000-iteration ceiling. We did not reduce the new-password work factor to fit that ceiling.

A public synthetic scrypt vector matched Node and Cloudflare exactly. Three sequential browser-to-Worker requests returned HTTP 200 in 357, 194 and 188 ms on 24 November 2026. These are end-to-end request timings, including network and browser overhead, not isolated CPU measurements or a concurrency/capacity certification. A synchronous native hash limits per-isolate overlapping allocations, but consumes CPU; load and cost checks remain release gates before production.

Sources checked for this decision:

- https://cheatsheetseries.owasp.org/cheatsheets/Password_Storage_Cheat_Sheet.html
- https://developers.cloudflare.com/workers/runtime-apis/nodejs/crypto/
- https://developers.cloudflare.com/d1/worker-api/d1-database/

New passwords accept spaces, paste and Unicode, with 15–256 characters and a 1,024-byte request-side password limit. A small local predictable-password check is included; it is not a full breached-password corpus or a claim of NIST certification. Existing passwords are verified using their legacy rules before an upgrade.

The legacy adapter imports only an already-existing manager user/membership and preserves its user ID and credential version. Legacy PBKDF2 salts are UTF-8 strings, exactly as in the recovered implementation, rather than hexadecimal-decoded bytes. Successful login rehashes with scrypt and rotates the credential version. Imports are idempotent and cannot overwrite an existing shared credential. Synthetic legacy import and automatic upgrade were also verified on the deployed Worker, retaining the same user ID and increasing its credential version. No production credential was copied into staging. Production import remains part of the reviewed cutover.

## Implemented behavior

- Shared `/login`, account password page, role dashboard and restaurant picker.
- Server-side role/membership checks on every protected request. A URL or client-supplied role cannot grant access. One account may manage multiple restaurants.
- Super-admin creation of manager access for existing restaurants, and password reset after recent reauthentication. There is no web endpoint to promote a user to super admin.
- Cryptographically generated temporary passwords, shown once in a no-store response, expiring after 24 hours. Mandatory password change blocks protected dashboard APIs.
- Username/password changes verify the current password, atomically rotate credential versions, revoke sessions and write an audit record. Reset and legacy upgrade also invalidate old manager sessions.
- 256-bit random session tokens; only SHA-256 token digests in D1. Host-only Secure/HttpOnly/SameSite=Strict cookie, 30-minute idle expiry, eight-hour absolute expiry.
- Exact HTTPS origin, custom request header and JSON checks for all mutations, including sign-in and logout. Strict page CSP and DOM text insertion prevent account/restaurant names becoming HTML.
- Persistent account/IP throttles, bounded request bodies, generic incorrect-credential responses and no password/token logging. Limit counters can support later abuse monitoring.
- Version/hash checks reject password reset/change races, including a reset racing a legacy upgrade.
- Last-enabled-owner database guards; no public disable/delete or role-promotion endpoint is exposed in this phase.
- Indexed cleanup of at most 500 expired sessions and 500 throttle records per 15-minute cron run. Provision a separate retention job if sustained traffic exceeds this cleanup budget.

The staging UI is a small authentication/account shell, not the finished restaurant editor. Existing React source and frozen recovery artifacts remain intact. Feature settings, onboarding/publishing, menu editing, dashboard integration and production route compatibility follow in later phases. The current identity/picker response is bounded to the first 100 restaurant entries; pagination of that list is required in the dashboard phase before large-tenant rollout. Account list pagination is already implemented.

## Owner recovery

There is no anonymous bootstrap or password-recovery API. `scripts/menu-owner.mjs` requires an authenticated Cloudflare operator token, an explicit owner user ID, the exact staging database ID and an interactive terminal. Bootstrap requires an empty identity store. Recovery targets an existing platform-admin identity, preserves its ID/role, revokes sessions and audits the action. The command cannot target production.

From a trusted terminal with `CLOUDFLARE_API_TOKEN` set securely:

```sh
node scripts/menu-owner.mjs bootstrap --user-id YOUR_NEW_OWNER_UUID --username YOUR_USERNAME --database-id 0cd21d93-da77-4b6b-b4dd-e16b741348c5
node scripts/menu-owner.mjs recover --user-id EXISTING_OWNER_UUID --username YOUR_USERNAME --database-id 0cd21d93-da77-4b6b-b4dd-e16b741348c5
```

Do not run bootstrap on an initialized system. The password is displayed once in the terminal; do not redirect output into files or CI logs. No token or real password belongs in Git. The same operator SQL-plan builder was used through the authorized Cloudflare connector to bootstrap and recover the staging owner. Direct CLI networking with an environment API token was not executed in this workspace.

## Validation performed

`npm run check:menu-auth` covers actual SQLite-backed request handlers: username normalization, current hash verification, legacy import/replay/upgrade, concurrent reset races, forced first-login change, shared role routing, multi-restaurant membership, cross-tenant denial, membership removal, password reset/revocation, temporary expiry, recent reauthentication, prevention of role injection, owner recovery/last-admin protection, CSRF, bounded inputs, idle/absolute expiry, user disable, throttles, cleanup and absence of secrets in responses/audits.

Cloudflare Browser Rendering also proved that the synthetic legacy manager could access its own private staging tenant while another existing tenant returned 404 and platform access returned 403.

Cloudflare Browser Rendering exercised the deployed staging UI and D1: owner temporary login/change/re-login, manager creation, mandatory manager change/re-login, manager dashboard, super-admin and cross-tenant denials, admin reset, rejection of an existing manager session after reset, no page exceptions, and no horizontal overflow at 390 px. Browser testing found two screen/callback bugs; both were corrected before the successful run. The reusable synthetic check is `scripts/menu-auth-browser-check.mjs`, with credentials supplied only at invocation.

Recovery integrity, all 14 recovered router tests, normalized frontend parity, schema/migration tests, lint and both app builds passed. GitHub CI results are recorded on PR #3.

## Production release boundary

The live super-admin Access login and Occasion manager login are still in place. The production Access app protects `/api/auth`; moving the new endpoint there requires an explicit route/policy cutover. Do not deploy this staging configuration or its test identities into production. Before cutover, complete remaining platform phases, a supported hashing-load check for the selected plan, production backup/recovery rehearsal, existing-role/credential import dry run, and the concrete release/rollback manifest. Rolling back code must not restore revoked passwords or sessions.
