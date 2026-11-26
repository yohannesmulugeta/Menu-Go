# Restaurant directory and configuration onboarding

On 26 November 2026, the user chose to retain the current shared menu layouts and proceed to Phase 5. The recovered designs remain available as references. Exact visual matching is outside this accepted direction.

## Implemented

- The dashboard loads an authorized restaurant directory with search and 50-row pages. Managers see their memberships and super admins see all restaurants. Restaurants beyond the session response's first 100 entries are accessible through the directory.
- Super admins can create a draft restaurant by selecting an existing versioned preset and shared template. Onboarding creates the restaurant, validated configuration snapshot and audit record in one D1 batch. The existing schema supplies currency and timezone defaults.
- A current authenticated super-admin session and recent password confirmation are required for creation. The transaction rechecks access. The unique slug prevents duplicate creates, including retries. Failed configuration writes roll back the whole creation.
- A new draft opens the existing settings and private preview flow. Its overview links to manager creation with that restaurant selected.
- Manager creation uses a searchable, paginated restaurant picker. Selections persist across pages and searches within the form. The existing limit of 1–10 restaurants and temporary-password flow apply.

## API

| Route | Contract |
|---|---|
| `GET /api/restaurants?search=&offset=0` | Authenticated directory. Returns `restaurants` and nullable `next_offset`. Search matches literal text in name or slug. |
| `GET /api/platform/onboarding-options` | Super-admin list of schema-v2 presets and templates supporting the complete feature catalogue. |
| `POST /api/platform/restaurants` | Super-admin creation using `name`, `slug`, `preset_id`, `preset_version`, `template_id`, `template_version`. Returns the new draft restaurant. |

The older `GET /api/platform/restaurants` array contract is preserved for existing callers. The new dashboard and picker use the paginated route.

## Validation

`npm run check:menu-onboarding` exercises pagination beyond 100 restaurants, membership isolation, literal wildcard search, input validation, role and CSRF denials, successful draft creation, duplicate handling, live-session revocation and rollback of partial writes. It reuses the existing synthetic media test environment. The PR verification workflow runs this suite.

Local Chrome checks exercised directory paging, draft creation, settings entry, manager selections across pages, temporary-password issuance and 360, 390, 768 and 1440 pixel widths. The console captured no warnings or page errors. These checks use the real Worker with synthetic in-memory D1.

No schema migration is required. Menu editing, publication, public delivery and QR behavior remain later work. Remote staging evidence is recorded separately after deployment verification.
