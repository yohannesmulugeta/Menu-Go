# Restaurant menu editor

The shared dashboard now edits restaurant menu content through the existing authenticated Worker and database schema. Changes advance the saved draft revision. The current public publication continues serving its immutable snapshot until a manager or super admin publishes again.

## Editing

- Categories have a name, sort order and visibility. Hidden categories hide their items in the next publication. Search and pagination include inactive categories.
- Items have a name, description, price, category, availability, popular status and sort order. Prices follow the recovered API's non-negative, two-decimal limit and existing database maximum. Each saved item update also advances its existing item version.
- Item photos use the existing browser conversion, upload and revision-checked attachment service. The editor supports replacing a photo and removing its draft attachment. The existing media lifecycle and publication references protect retained image bytes.
- Variants have labels, exact integer minor-unit prices, sort order and visibility. Their display follows the existing Sizes and variants feature.
- Amharic, Oromo and Tigrinya translations are saved per item. English uses the base item fields. Translations appear for languages enabled in restaurant settings, with the existing English fallback.
- Opening hours are edited per weekday in the restaurant's configured timezone. Closed days retain their saved times for reopening. The guest-hours feature controls their public display.

The editor preserves existing records. Category and variant visibility, item availability and photo attachment changes use existing fields. Published snapshots and referenced media remain retained.

## API

All routes below start with `/api/restaurants/:id/menu`. Mutations include `revision` and `policy_revision`. Item updates additionally include the existing item `version`.

| Route | Methods |
|---|---|
| `/categories?search=&offset=0` | GET with 50-row pagination, POST creation |
| `/categories/:categoryId` | PATCH name, sort order and visibility |
| `/items?search=&offset=0` | GET with 50-row pagination, POST creation |
| `/items/:itemId` | GET item with variants and translations, PATCH item fields |
| `/items/:itemId/variants` | POST variant |
| `/items/:itemId/variants/:variantId` | PATCH variant |
| `/items/:itemId/translations/:locale` | PATCH translation |
| `/hours` | GET saved days and configured timezone |
| `/hours/:weekday` | PATCH a day from 0 (Sunday) to 6 (Saturday) |

Reads return draft and policy revisions plus the current content-editing permissions. The revision is read before the content, so concurrent edits produce a stale save. Each write atomically advances the configuration revision, updates the owned content and inserts an audit record. The transaction rechecks session, tenant membership, policy epoch and item version where applicable. A former admin cannot retain an earlier policy bypass after a role change. The same transaction guard now protects shared settings and photo mutations.

The manager-editing locks for categories, descriptions, popularity, images, variants, languages and hours apply to their content controls. Foreign category/item/variant IDs are rejected. Item image URLs are changed through the image service. The shared renderer and public delivery continue consuming saved publication snapshots.

## Validation and deployment

`npm run check:menu-editor` covers category and item creation and updates, validation, cross-tenant and origin denials, stale drafts and item versions, transaction rollback, membership/policy/admin-role races, feature locks, variants, translations, hours, publication isolation and pagination beyond 100 rows. CI includes this suite with the existing authentication, schema, media, feature, publication, onboarding and root checks.

A delayed image-control response is included in the browser check. Settings submission is attached before image controls load, so an early Save remains functional.

Local Chrome checks exercised category and item creation, JPEG conversion, photo attachment/removal, exact variant pricing, translation entry, opening hours and feature activation. Published variants, translated names and hours matched the saved data. A later price edit stayed in the draft. Unsaved item fields survived attempts to open a dependent editor. The item screen passed 360, 390, 768 and 1440 pixel widths with a clean console.

No database migration or new dependency is required. Staging deployment uses `cloudflare/wrangler.platform-staging.jsonc` after checking the live bindings, six migration checksums and a private D1 backup. The rollout inventory records the active Worker version and rollback checkpoint. Deployed evidence is recorded below.

## Changed files

- `cloudflare/platform/menu/access.mjs`, `validation.mjs`, `mutations.mjs` and `service.mjs` implement the editor API.
- `cloudflare/platform/web/menu.mjs`, `menu-extras.mjs` and `page.mjs` implement the dashboard forms.
- `cloudflare/platform/worker.mjs` connects the menu routes. Shared `config/service.mjs` and `media/service.mjs` enforce the live admin-role guard.
- `scripts/check-menu-editor.mjs`, `package.json` and `.github/workflows/check-cloudflare-baseline.yml` add the verification gate.
- This report and `cloudflare/inventory/platform-staging.json` record the staging release.

## Verified staging release

Worker version `0d590b59-f666-404e-be4f-b80eb6faef13` serves 100% of staging traffic. Its uploaded bundle matches the checked dry-run build. The environment marker, D1/R2 bindings, six migration checksums and existing scheduled cleanup were verified. Code rollback targets `ae586267-7f7f-4ac6-b9c4-33010cae1600`, captured before the editor rollout. The private D1 export passed a test restore.

A disposable manager used the deployed dashboard to create a category and item, convert and attach an item photo, save a variant for 250.75, enter a translation and set opening hours. Feature activation and the private preview matched those values. Public delivery then showed the translated name, exact variant price, hours and real R2 image bytes. Later price, photo and category edits stayed in the draft until republished. The old public image URL was revoked after replacement. Stale and cross-tenant edits were denied. The item editor passed four viewport widths. The final browser console was clean.

The first deployed run exposed a settings loading race. Submission is now attached before optional image controls load, and a delayed-response browser check passes. The final audit received a Cloudflare 403 after applying cleanup. A new authenticated process completed verification against the pre-rollout backup. Original content, credentials, users, roles and memberships matched. Both attempts have disabled test accounts, revoked sessions, suspended restaurants and zero draft image references. Referenced synthetic image objects and publication history remain retained.

Five sequential public response-header measurements were 2061, 2537, 2580, 2555, 2846 ms, including network overhead. Public delivery performance, capacity and cost remain release work. Native mobile sharing and approved restaurant content/cutover also require their follow-up checks and approval.

[CI passed on the final runtime commit](https://github.com/yohannesmulugeta/Menu-Go/actions/runs/45923678788). [The staging inventory](../cloudflare/inventory/platform-staging.json) contains the source, backup, deployment and cleanup evidence. PR #3 remains draft.
