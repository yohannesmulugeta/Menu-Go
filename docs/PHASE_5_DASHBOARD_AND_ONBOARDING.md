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

No schema migration is required. Menu editing, publication, public delivery and QR behavior remain later work. Remote staging evidence is recorded below.

## Staging verification

Worker version `a0213465-a250-4840-8d6e-052612dac951` serves 100% of staging traffic. Its uploaded bundle matches the dry-run build byte for byte. D1 and R2 bindings, the staging environment marker, six migration checksums and the existing cleanup schedule were verified. The private D1 export passed an isolated restore. Code rollback targets `551d7209-007e-4c13-ae0b-946f4aa47e24` while preserving D1 history, credentials and retained media.

The deployed browser created a disposable draft, opened its settings and created manager access with the new restaurant selected. The manager changed its temporary password, signed in again and received access to its assigned restaurant and private preview. Duplicate creation, foreign access and cross-origin creation were denied. Four viewport widths passed with no browser warnings or exceptions. The first attempt stopped because its foreign-manager fixture lacked a membership. That fixture was disabled and corrected before retrying. The following run caught a missing browser favicon. The Worker now serves the existing repository brand icon, and the final full browser run passed with a clean console.

All disposable accounts are disabled, their sessions are revoked and their restaurants are suspended. Existing restaurant configuration and credential fingerprints matched the pre-test snapshot. Audit history is retained. [The staging inventory](../cloudflare/inventory/platform-staging.json) contains exact deployment, backup, source and cleanup evidence. [CI passed on the runtime commit](https://github.com/yohannesmulugeta/Menu-Go/actions/runs/45878926330).
