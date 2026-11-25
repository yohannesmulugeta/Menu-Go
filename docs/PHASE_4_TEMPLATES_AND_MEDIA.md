# Shared templates and private media — implementation checkpoint

Source checkpoint: `66a0d4ffc8e596ac731e55e2023bf2dc1faf2fa0`, branch `feature/menu-platform-foundation`, existing draft PR #3. Work was performed on 25 November 2026. The entire upstream tree was reconstructed through the connected GitHub API and checked against Git blob hashes; its tree is exactly `6b4e4536c7ebb7efc0baa68dd3869553bde8fd4c`. The local history retains the actual upstream commit as a shallow checkpoint.

This implementation is not a completed staging rollout or a production-parity certification. Production Workers, domains, bindings, Access policies, passwords, restaurant content and printed QR destinations were not modified. No production pages were loaded to generate comparison analytics. The existing staging owner's account was not accessed or reset.

## Recovered design comparison

| Design | Existing presentation and behavior | Existing routing/workarounds | New independent release |
|---|---|---|---|
| Abol | Recovered React photo hero, serif title, action cards, social links, category selection, popular items and responsive item cards. The old implementation hardcodes an inclusive-tax note by slug. | Hash menu routes, a default Abol route, tenant conditions in the old customer component. | `abol@1`, photo-card presentation; `classic@2` uses the same layout to preserve the existing contract. |
| Mokodo | React layout with separate green/red identity, larger logo, bold sans headings, expanded descriptions and a story panel. Its old tax and packaging notes are hardcoded by slug. | Existing React route; `.mokodo-page` styles and slug branches. | `mokodo@1`, independent bold presentation, common data and feature behavior. No tax or packaging claims are inserted automatically. |
| Sheba | Standalone server-rendered white/navy menu, custom bundled display/body fonts, category sections, dotted price rows and category drawings. Hours and Wi-Fi exist in its renderer. | `/r/sheba-coffee` canonical host redirect and `/sheba-assets/*` resources embedded in the frozen core. | `sheba@1`, independent editorial presentation. Original fonts/drawings and exact dotted-row parity remain preserved in the baseline, not certified in the new release. |
| Occasion | Standalone white café layout, logo/title, current cover asset, compact menu rows, social/contact/review actions and a bottom charges area. Router cover CSS controls cropping. | `/r/occasion`, `/preview/occasion`, explicit media paths, dashboard script injection, and an experimental `?design=abol` adapter using DOM injection. | `occasion@1`, white-default café presentation with shared layout rules, stable logo/title and saved cover focal points. The experiment is not made the default. |

Authoritative comparison sources are `cloudflare/frontend/src/App.tsx`, its CSS, and the frozen `cloudflare/baseline/core/` and `cloudflare/baseline/router/` modules. All frozen files and the frontend recovery sources remain unchanged. These new shared releases are functional layout families, not a claim of pixel-for-pixel reproduction. Existing production Occasion content, verified contacts, white design and selected cover stay on their original deployment; no synthetic information is imported into them. Final content reconciliation requires an authorized current restaurant snapshot before cutover.

## Architecture and preview

Migration `0006_templates_media.sql` adds releases without selecting one for any restaurant. Earlier applied migrations are unchanged. All five releases declare the same 30-feature catalogue. Settings and permissions remain in the existing config/auth services; there is no tenant-slug permission logic or new login.

`templates/render.mjs` is a shared server renderer with versioned presentation classes and one search/filter implementation. The existing platform account shell already uses server-rendered HTML with nonce-protected scripts; continuing that architecture keeps the frozen React/Vite source independently verifiable and avoids making preview availability depend on a second browser bundle. The existing React source remains available for later dashboard integration. Theme input continues to use validated colors, font choices and corner choices; arbitrary CSS/HTML/JS is not accepted.

`GET /preview/:restaurantId` authorizes through the existing `GET /api/restaurants/:id/preview-data` route and consumes that sanitized contract. It returns no-store/noindex HTML with a nonce CSP. Anonymous access returns 401, another manager's restaurant returns 404, and API routes still return JSON. Template selection saves a draft only. Settings now link to the saved-draft preview.

The renderer handles search, category and popular filters, approved images, descriptions, variants, supplied dietary labels, story, verified contacts, languages, hours, explicitly public Wi-Fi and bottom disclosure. Missing translations use the existing English fallback. Hidden photos produce no image elements or requests; hidden category navigation retains items. Prices are formatted, never recomputed. Disclosure remains after the footer.

There is still no public menu GET or publishing endpoint. Guest feedback, share and QR controls are deliberately inactive in a private preview with a publication explanation. Preview never records analytics. The existing authenticated analytics dashboard capability and published-only POST capability rules are unchanged. Public interaction behavior must be connected and verified during Phase 6 rather than exposing drafts now.

## Upload contract and ownership

| Endpoint | Behavior |
|---|---|
| `POST /api/restaurants/:id/media?kind=logo\|cover\|item` | Authenticated, same-origin image upload; `item` also requires an owned `item_id`. Returns an opaque media ID and protected URL, never the R2 key. |
| `GET` / `HEAD /api/restaurants/:id/media/:mediaId` | Rechecks current session/membership and ready metadata, then serves private/no-store image bytes. An unguessable URL is not authorization. |
| `PATCH /api/restaurants/:id/media-attachment` | Attaches or removes a logo, cover or item photo using `kind`, nullable `media_id`, current `revision`/`policy_revision`, and `item_id` for item photos. |
| `DELETE /api/restaurants/:id/media/:mediaId` | Revision-checked deletion of an unreferenced draft object only. Referenced/published/retained media cannot be deleted. |

Every mutation checks session and tenant membership. Manager image locks follow the shared feature policy. Expensive image work is followed by live session/membership/policy checks at commit. Item ownership is enforced both in authorization and composite database foreign keys. Different tenants and different menu items cannot attach each other's uploads. Logo/cover private references cannot be forged through the general config PATCH. R2 keys are generated by the server under a private draft prefix, never supplied by the client.

Raw upload bodies are bounded while streaming to 5 MiB. A claimed Content-Length, extension, browser MIME or client dimensions cannot override this. Stored output is a verified PNG: exact signature, legal structure, chunk CRCs, supported color/depth, dimensions, complete bounded zlib inflation, exact scanline length, legal filter bytes, no trailing compressed data, animation or unknown critical chunks. Ancillary metadata is removed by rebuilding the file. Maximum dimensions are 4096 per edge and 4 million pixels. The existing media schema's 5 MiB ceiling is preserved.

The image picker accepts JPEG/PNG/WebP/AVIF source files, verifies raster signatures, decodes them in the browser, bounds their dimensions and sends canonical PNG. The server independently validates the resulting pixels. Direct JPEG/WebP/AVIF API bodies are rejected with 415; there is no unsafe header-only validation or arbitrary SVG/HTML support. Interlaced/indexed/16-bit/transparency-chunk PNG inputs should use the picker for conversion. Animated inputs are flattened by browser decoding, while raw animated PNG uploads are rejected. Color-profile/EXIF preservation is not promised. A future direct multi-format API needs a reviewed bounded decoder; no paid processing service is enabled.

Restaurant limits are 100 nondeleted media rows and 100 MiB; a creator can start at most 20 uploads per 15 minutes. The browser source-file ceiling is 20 MiB. Normalized PNGs can be larger than JPEG/WebP sources; the picker explains the limit and asks for a smaller image when necessary. These bounds are safeguards, not load/cost certification.

## Replacement, retention and cleanup

1. Authenticate, check policy/item ownership and validate bytes before storage.
2. Atomically create an audited pending metadata record, subject to live access, epoch and quotas.
3. Write a generated key to the dedicated staging R2 binding.
4. Mark ready only after another live access/policy check. An uncertain write leaves a durable pending record for cleanup.
5. Attach through a separate atomic D1 batch with draft revision and policy epoch checks. Update the private URL, draft reference, item image where applicable, and audit together.

The old reference is not removed before the attachment transaction. Failed R2 writes, stale attachment, changed policy and removed membership leave the previous image usable. Old uploaded objects are retained until demonstrably unreferenced. Switching a feature off does not delete content.

The 15-minute cron claims at most 25 orphan candidates older than 24 hours, or retries a previously claimed deletion. It checks draft references, publication-reference rows, current configs/item URLs and conservatively searches **all retained publication snapshots** for the media ID/key. Objects in `published` or `retained` state are never automatically removed. Claiming `deleting` happens before R2 deletion; attachment rejects that lifecycle, closing the cleanup/attachment race. A failed deletion is retryable. Completion records an audit without image bytes, filenames, credentials or private metadata. Deleted metadata remains as a tombstone; a later retention phase should bound tombstone/audit retention.

Future publishers must validate ownership and insert `media_publication_refs` atomically with their snapshot. Adding those reference tables does not make images public. Published-media serving and publication revocation remain Phase 6 work.

## Legacy URLs

`cloudflare/inventory/legacy-assets.json` records the captured static URLs, the Occasion image/style/script aliases and Sheba asset names extracted from the recovered module. No catch-all R2 alias route was added. Existing absolute public asset URLs continue on their original deployment. No existing public image was deleted or copied into another product's bucket. Frozen router tests still verify the original logo/supporting routes and delegation. Future URL normalization must use an explicit allowlist adapter, not infer tenant ownership from a path.

## Verification evidence

Executed locally with Node 24.14.0 and in-memory synthetic SQLite/R2 fixtures:

- Baseline integrity: 52 exact modules/assets; all 14 recovered router tests passed. Baseline packaging passed.
- Schema/migrations: six migrations, replay/checksum/rollback, composite tenant FKs, synthetic restore and fail-closed Worker health passed.
- Existing authentication request tests passed. Existing feature runtime tests passed, including hidden Wi-Fi, translation fallback, policy races and unchanged prices.
- New `npm run check:menu-media` passed: invalid PNG/HTML/SVG, CRC, malformed compressed bytes, size/dimension checks, metadata removal, private reads/uploads, CSRF, tenant/item ownership, stale/epoch/membership races, failed R2 writes, safe replacement, retained publications, deletion refusal/retry, every registered template, hidden photos/categories, bottom disclosure, unchanged prices and JSON API failures.
- Local browser: Classic, Abol, Mokodo, Sheba and Occasion checked at 360, 390, 768 and 1440 CSS pixels (20 combinations). No horizontal page overflow, valid image loading, `object-fit: cover`, saved `25% 35%` focal positioning, stable logo dimensions, minimum 44px active controls and disclosure last in the shell. Synthetic long unbroken names, missing images and empty menus were exercised. Search no-results and popular filtering worked.
- Local browser dashboard at 390px: settings/preview link, template list, three image controls, browser PNG conversion, actual local upload + revision-checked logo attachment, draft template save and saved private preview passed. No recorded browser warning/error logs at the upload check. This uses a localhost-only fixture server and synthetic owner session; it does not certify deployed Cloudflare login/upload behavior.

No layout-shift performance trace, production screenshot parity, load benchmark or deployed R2 round trip was performed. Width/geometry checks are not a visual-parity certification.

The terminal cannot connect to GitHub, npm or Cloudflare (Cloudflare/npm network errors include EACCES). GitHub source/PR operations use the connected API. Exact dependency installation could not finish: the local cache lacks Vite 7.3.6 and TypeScript 5.8.3. Consequently canonical `npm run check:menu-features` typechecking, `build:cloudflare-frontend`, `check:frontend-recovery`, and root `npm run check` could not complete locally. Their failures are dependency/build-output failures, not reported as passes. Existing CI is extended with the new media suite; record its actual result in the PR after pushing.

## Staging rollout and rollback

The current recorded staging release remains Worker version `69bf68bb-d542-421f-b817-1d7d9c7ca405`, migrations 0001–0005. `platform-staging.json` intentionally retains that actual deployed state. `phase-4-candidate.json` records pending source/migration hashes separately. No Phase 4 deployment succeeded in this environment.

From a network-enabled, authenticated operator environment:

1. Fetch the final branch/PR head and run every required check with `npm ci --ignore-scripts`. Verify the frozen baseline/recovery checks and new suite before deployment.
2. Re-read Worker settings and the D1 `platform_environment` marker. They must match `admaki-menu-platform-staging`, D1 `0cd21d93-da77-4b6b-b4dd-e16b741348c5`, and bucket `admaki-menu-media-platform-staging`. Verify existing migration names/checksums against the actual inventory and preserve the current owner login.
3. Capture the current staging Worker version and a staging D1 backup. Apply only additive `0006_templates_media.sql` using the existing checksum-tracked migration process, recording its SHA-256 in `schema_migrations` only after success. Never edit migrations 0001–0005 or apply this staging migration to production. If interrupted, inspect the real schema and marker before retrying; do not blindly replay ALTER TABLE.
4. Deploy `cloudflare/wrangler.platform-staging.jsonc` only. Its entry remains `platform/worker.mjs`; Node compatibility supports the bounded native zlib implementation. Do not deploy the root app, bind another bucket or alter Access/routes.
5. Verify health reports six migrations. Use disposable staging identities/tenants to repeat the auth, preview/upload/attachment/deletion and cross-tenant tests, actual R2 reads, image formats/conversion and all widths. Restore settings, disable test identities and safely remove disposable references/objects. Do not reset the existing owner to obtain test access.
6. Update `platform-staging.json` with actual deployment/version, module and migration manifests and executed remote evidence. Keep PR #3 in draft; do not merge or touch production.

Rollback code to the version captured immediately before rollout. Leave additive tables/columns/migration history intact and retain all image objects/reference metadata. Never roll back credentials/sessions or delete referenced media. The older shell continues using the existing auth/config tables; the frozen production baseline is separate.

Sources for the runtime/API design: https://developers.cloudflare.com/workers/runtime-apis/nodejs/zlib/ and https://developers.cloudflare.com/r2/api/workers/workers-api-reference/. Node tests do not substitute for a Cloudflare runtime compatibility check.

## Remaining work

Phase 4 still needs the canonical dependency/build/CI gate, authenticated staging deployment, real R2/conversion/retention verification, actual approved restaurant content reconciliation and a reviewed visual-parity comparison. New layouts retain separate identities but are not certified replicas. Direct multi-format server decoding, layout-shift tracing and capacity/cost measurements remain explicit gaps.

After Phase 4 acceptance, Phase 5 is the integrated/paginated restaurant dashboard and configuration-only onboarding. Phase 6 is validated publication/public delivery, published-media references, cache/current-policy enforcement and end-to-end QR behavior. Phase 7 requires the concrete production release/rollback manifest and explicit cutover approval. None of those later phases is claimed complete here.
