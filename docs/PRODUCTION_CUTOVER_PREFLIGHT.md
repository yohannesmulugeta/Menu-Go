# Production cutover preflight — 2026-11-27

Status: draft only. No production release or database mutation authorized by this document.

## Observed legacy inventory
Read-only production D1 counts and public API results agree:

| Slug | Items | Categories |
|---|---:|---:|
| abol-coffee | 89 | 13 |
| mokodo-pizza | 103 | 12 |
| occasion | 116 | 15 |
| sheba-coffee | 40 | 7 |
| some | 0 | 0 |

Abol has 13 popular items, so its initial category is not an indication of data loss. The Some Café record is active but empty; do not substitute Abol or remove it without owner approval.

## Routing
- The shared candidate now resolves old `#/r/:slug` links client-side before requesting a login session, then uses the existing published-only clean route. Only supported locale values survive the redirect. Invalid encodings, embedded slashes, double encoding and unknown slugs cannot select a fallback café. This does not modify the recovered frontend or production routes.
- menu.admakidigital.com/r/occasion and /r/sheba-coffee returned their intended menus.
- menu.admakidigital.com/r/abol-coffee, /r/mokodo-pizza and /r/some returned 404.
- app.admakidigital.com/r/some opened Abol because the legacy SPA uses HashRouter and defaults to Abol on an empty hash.
- app.admakidigital.com/#/r/mokodo-pizza and /#/r/some opened the correct tenants.
- The new Worker deliberately checks the staging environment and generates staging-origin public URLs. Do not bypass the check or change the deployed staging instance.

## Release requirements
1. Preserve the frozen recovery baseline (its equivalence test is intentional). Implement routing in the new production candidate instead of changing the recovered artifacts.
2. Create an explicit production configuration and isolated production-candidate database/media resources. Validate environment markers and bindings before serving traffic. Keep staging configuration unchanged.
3. Import authorized current restaurant records, identifiers, categories, items, exact prices, approved media, settings, and compatible identities. Reconcile counts and content without exposing credentials or importing synthetic fixtures. Publish only approved restaurants.
4. Configure the canonical public origin using trusted deployment configuration, not request Host. Preserve each existing printed QR URL. Map clean paths by exact slug; handle legacy hash links client-side (URL fragments are not sent to the server). Preserve existing Occasion/Sheba routes and old assets until verified.
5. For unknown, empty, draft, suspended or unauthorized menus, enforce correct tenant/status behavior; never substitute another restaurant. Test slash, encoded slug, old hash, direct link, and unknown slug cases.
6. Verify all existing links and designs on real phones; confirm exact item/category counts and prices, admin access and permanent QR destinations. Keep old routes live until explicit cutover approval.
7. Record pre-release database and media backups, rollback version and route restoration instructions. Review migration and test results before any production switch.

Read-only legacy API inventory check: node scripts/check-legacy-menu-inventory.mjs. Recorded counts are a snapshot; intentional client edits require reconciliation. This check does not certify browser routes, designs, or device sharing.
