# ADMAKI Menu production release

Owner authorized implementation and deployment in this conversation on 27 November 2026. Use existing Free services only. No paid upgrade, weakened password hashing or automatic billing activation is part of the release.

The candidate is separate from staging and the legacy live database. Its D1 database is `7da5fc86-a792-4410-9773-6dfa72e1b8e3`; its R2 bucket is `admaki-menu-media-platform-production`. Production validates its explicit environment marker; canonical menu/QR URLs use `https://menu.admakidigital.com`. Private images accept only configured application/canonical/candidate origins, never an arbitrary request Host.

An offline-restored, foreign-key-checked private backup contains all 16 source tables. The importer preserves all seven restaurant IDs/statuses, 366 item IDs/names/prices, 58 category records, current media URLs, existing users/memberships/admin identity and legacy history. Only the four nonempty active cafés receive initial publications. Empty and draft records cannot substitute another café.

Real café logos, image URLs, ordering and exact existing tax/packaging notes are carried into the shared template families. Occasion keeps its white background, cover/logo, no opening hours and item photos disabled initially. Existing image and font assets remain on their legacy workers. Shared templates are the reviewed layout families; they are not asserted to be pixel-identical copies of every legacy renderer.

The admin uses `admin`; client accounts use `abol`, `mokodo`, `occasion`, and `sheba`. Credentials are random temporary passwords, expire if unused, and require changing at first login. They are kept outside Git and are never put in this document. The admin and Occasion retain their original user IDs. No real user receives another restaurant's membership.

Production uses `/session-api/` for its username/password requests, normalized internally to the existing shared auth handlers. This avoids the old email Access gate while retaining it for legacy recovery. Origin checks, session cookies, rate limits and private compute remain intact. No new external email provider is needed.

The gateway forwards menus and administration to the production platform, keeps legacy static/media routes on the old workers, and rejects unknown paths without a default café. Existing root/hash links and manager links resolve to the new account/public routes. A route backup records every pre-release mapping. Rollback restores those mappings and removes the two broad gateway routes; old workers and old data remain available. Candidate code recovery preserves its SQLite Durable Object class/namespace.

Before switching routes, verify candidate content/price parity, all five temporary logins, tenant denial, synthetic draft/price/image/publish behavior, source hash/bindings and fresh source-data fingerprints. Verify the same canonical URLs after the switch. Real customer menu content is not used as a disposable editing test. Retain actual results and do not claim physical-phone or unlimited-capacity certification.

## Live release result

Released 27 November 2026 at 15:20 UTC. The common live dashboard is https://app.admakidigital.com/login. Admin and four café managers signed in successfully on the canonical domain; all require a first-login password change. No email verification was required. Public Abol/Mokodo/Occasion/Sheba menus served 89/103/116/40 items. All source item names and prices matched. The actual browser verified the old Abol hash link, Popular filtering, Abol image loading and Occasion's white layout/cover/logo. Phone hardware was not claimed as tested.

A dedicated synthetic tenant passed item creation, photo upload/attachment, private preview, publication, exact price edit isolation until republishing, QR and unpublish revocation. The image was deleted through the API; all fixture content and its restaurant record were removed, its sessions revoked and user disabled. Real café content was not edited as a disposable test.

[Release inventory and route recovery](../cloudflare/inventory/production-release-2026-11-27.json), [canonical menu/login checks](../cloudflare/inventory/production-canonical-2026-11-27.json), [editor checks](../cloudflare/inventory/production-editor-2026-11-27.json), [source parity](../cloudflare/inventory/production-content-2026-11-27.json), [CI passed](https://github.com/yohannesmulugeta/Menu-Go/actions/runs/46022884516).

Staging and both legacy workers remain unchanged. Restoring old routes restores the old data source: export/reconcile any customer edits made after release before choosing that rollback. The candidate database is now the production source of truth. No purchase, subscription upgrade or Paid-only CPU override was applied. The gateway adds another Worker invocation per proxied request, sharing the account's existing free daily allowance; the earlier staging profile does not certify unlimited production capacity.
