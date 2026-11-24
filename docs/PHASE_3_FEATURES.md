# Shared features and draft settings — staging

One typed feature catalogue now drives restaurant settings, platform policy, the sanitized menu projection and public feedback/analytics capability checks. Template changes cannot grant permissions or bypass platform policy. Core CRUD, tenant authorization, validation, audit logging and account security are mandatory; they are not entries in the customer-toggle catalogue.

This phase is deployed only to `admaki-menu-platform-staging`. Production menu routes, Workers, Access policies, restaurant data and QR destinations are unchanged. The existing staging owner credential was not reset or modified.

## Catalogue and resolution

Thirty stable feature keys cover menu search/categories/popular items/photos/descriptions/variants/dietary labels, cover/logo/story, call/directions/review, eight social links, feedback/hours/Wi-Fi/share/QR/languages, pricing disclosure and analytics collection/dashboard.

`config/registry.mjs` records labels, grouping, schema version, readiness dependencies, defaults, manager editability, UI module, API capability rules and a regression test identifier. `config/contracts.ts` derives its feature-key union directly from the runtime registry. Compile-time negative tests reject unknown keys and non-boolean toggles; request validators enforce the same rules at runtime.

The effective state includes `requested`, `effective_requested`, `enabled`, `ready`, `locked`, `lock_reason` and `reason`:

1. Platform availability must allow the feature.
2. A platform forced value overrides the saved restaurant request.
3. The selected template must support the feature, and its data dependencies must be ready.
4. Manager editability affects who can change settings; it does not turn off a feature that is already active.

An unavailable/forced feature is locked. A manager-locked feature also protects its associated content fields. The super admin can edit those fields. Switching a restaurant feature off keeps the saved data. Missing content is reported separately from an off switch. Different templates must implement the same catalogue: a replacement template missing shared capabilities is rejected on selection.

## Versioned configuration

Migration `0005_feature_catalogue.sql` adds the policy epoch, initializes explicit policies, adds immutable Classic contract v2 and Café preset v2, and upgrades synthetic staging configurations with explicit feature flags, safe theme tokens and content settings. Existing v1 template/preset records remain intact. Subsequent preset edits cannot alter a restaurant copy.

The pure `migrateV1` adapter handles the supported old configuration shape, retains valid known contact links, preserves the white background and keeps Occasion opening hours off. Unknown versions/keys are rejected. It is not a production import certification: observed per-restaurant defaults and special renderer behavior still require reconciliation in the template/cutover phases. No production tenant snapshot or private user record has been imported into staging.

Validated settings include six-digit color tokens, allowlisted font/corner choices, cover focal point, service-specific HTTPS social/map/review links, an international phone number, story, language choices, explicit Wi-Fi visibility, supplied dietary/allergen labels and VAT/service disclosure. There is no arbitrary CSS, JavaScript or executable configuration.

Disclosure placement is always `bottom`. Saving rates or a note does not recompute or change item prices. No tax rate or dietary claim is invented. Wi-Fi password visibility requires separate explicit consent, and settings audits record only whether private Wi-Fi fields are set, not their values.

## API and UI contract

All protected responses are JSON, no-store and noindex. Exceptions raised by the shared validators include a stable HTTP-derived `code` alongside the helpful `error` message. Inaccessible tenant resources return 404.

| Endpoint | Access and purpose |
|---|---|
| GET `/api/platform/features` | Super admin; registry plus policy revisions |
| PATCH `/api/platform/features/:key` | Recently reauthenticated super admin; availability/editability/forced value |
| GET `/api/restaurants/:id/feature-catalogue` | Restaurant manager/admin; registry, template and preset metadata |
| GET `/api/restaurants/:id/config` | Restaurant manager/admin; config, effective states and revisions |
| PATCH `/api/restaurants/:id/config` | Restaurant manager/admin; validated draft changes |
| GET `/api/restaurants/:id/preview-data?locale=am` | Authenticated tenant-scoped sanitized projection |
| GET `/api/restaurants/:id/feedback` | Authorized, paginated private inbox; retained when collection is off |
| GET `/api/restaurants/:id/analytics` | Authorized 30-day aggregate history, subject to dashboard entitlement |
| POST `/api/public/menus/:slug/feedback` | Active published snapshot and enabled feedback capability |
| POST `/api/public/menus/:slug/events` | Active published snapshot and enabled analytics/event capability |

Restaurant PATCH requires `revision` and `policy_revision`. Global PATCH requires the feature's `revision`, the global `policy_revision`, boolean `allowed` and `manager_editable`, and nullable boolean `forced_value`. Conflicts return 409. Unknown feature keys/fields, non-boolean switches, unsupported themes, unsafe links and foreign item labels are rejected.

Settings writes compare the draft revision and global policy epoch, recheck the live actor/session/membership inside the atomic D1 batch, increment the revision and write a redacted audit. A policy change increments its row revision and the global epoch in the same audited batch. There is no last-write-wins overwrite.

In staging, open a restaurant, choose **Restaurant settings**, edit feature switches/content/colors, then **Save draft** or **Cancel**. The super-admin dashboard also exposes **Platform features**, with separate availability, manager-editing and override controls. Locked settings explain their state. The responsive form was checked at 390 px. These are draft settings; they do not update the existing live menus.

## Public data and server enforcement

The projection omits disabled photos, descriptions, categories, contacts and hidden Wi-Fi fields. Hiding category navigation keeps the items. Variants and translations are tenant-scoped; missing translated fields fall back to English. Existing item prices remain unchanged.

Public POSTs cannot read draft settings as authority. They require an active restaurant, current publication head and versioned capability manifest. They check current platform policy on every request and recheck policy/publication/status when inserting feedback or incrementing daily analytics. A disable racing a request cannot collect a new record. Collection off does not erase existing feedback or aggregate history. Raw searches, IPs, credentials and arbitrary analytics metadata are not stored.

There is no public GET menu/publish endpoint or production cache cutover in this phase. The preview-data endpoint is a data contract for the shared renderers, not a finished public-menu design. Publication production, template integration, uploads/media lifecycle, full menu editing/onboarding and capacity/retention checks remain later phases. Future cached menu responses must check the current policy epoch before serving cached feature data.

## Evidence

`npm run check:menu-features` checks typed keys, migration/default versioning, the v1 adapter, precedence/readiness/locks, unknown values, unsafe inputs, stale/racing saves, membership removal, template conformance, tenant denial, disabled-field projection, private Wi-Fi omission, translation fallback, variants/labels, unchanged prices, bottom disclosure, published-only writes, feedback/analytics disable races, retained history, quotas, cleanup, redacted audits and embedded UI script syntax/CSP. Schema/authentication and recovered runtime checks also pass.

Cloudflare Browser Rendering exercised the deployed staging UI: hours off by default; feature/contact/color/VAT draft saves; hidden Wi-Fi password omission; stale save 409; platform manager lock; disabled manager controls; forged-write and other-existing-tenant denial; manager save of an unlocked setting; 390px layout; and restoration of the test settings/policy through the audited APIs. There were no page exceptions.

A separate disposable publication proved actual Cloudflare D1 writes: enabled feedback returned 201 and analytics 202, then platform disable returned 403 for both while the authorized inbox/report retained one existing record each. Policy values were restored, test accounts were disabled, and the disposable tenant/publication was removed. Synthetic test credentials are not committed. The existing owner's login was left unchanged.

The exact deployment/version evidence and migration checksum are in `cloudflare/inventory/platform-staging.json`. GitHub CI runs on PR #3. No production Worker or route has been updated.
