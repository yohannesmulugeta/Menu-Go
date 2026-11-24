# Recovered Cloudflare baseline

This directory captures the live menu implementation before shared-platform changes.
It is not deployed automatically. The root React/Supabase app and its GitHub Pages workflow remain unchanged.

- baseline/core: exact downloaded modules from admaki-menu.
- baseline/router: exact downloaded modules from admaki-menu-router, plus the existing synthetic integration tests and credential-schema migration.
- baseline/core/assets: exact public JS, CSS, fonts, branding and active-restaurant migrated-media responses.
- inventory/production.json: version IDs, SHA-256 hashes, route/custom-domain/Access scope and binding types, with no secret values.
- inventory/schema.sql: read-only schema/index export, no user rows, sessions, passwords, feedback or analytics.
- baseline/core/assets/index.html: reconstructed shell for the recovered assets; not asserted to be the original ASSETS index file.

Run with Node 24:

    npm run check:cloudflare-baseline
    npm run build:cloudflare-baseline

The build produces dist-cloudflare and never invokes Wrangler or changes Cloudflare.
The integrity check fails if recovered modules/assets differ from captured remote checksums.
The integration tests use synthetic data and do not contact production.

## Important boundaries

The compiled Cloudflare frontend differs from src/App.tsx and src/lib/admin.ts in main. Its original editable TypeScript and build history have not been recovered. Frozen executable recovery is complete for the explicitly inventoried assets; editable-source reconciliation remains open. Do not replace the live frontend with a GitHub Pages build.

Do not deploy the recovered modules alone: core ASSETS, DB, router service binding, routes, custom domain and Access configuration must be considered together. No staging database or R2 bucket has been created in Phase 0.

The legacy email-verification Access app protects /api/auth on app, menu and workers.dev hosts. Existing local manager auth uses /manager/api. A future username/password endpoint under /api/auth would encounter that policy; design the cutover explicitly.

Fonts and images retain their existing byte content. Font-license files available in the source repository are copied alongside captured fonts; upstream attribution/provenance for the additional hashed font files still needs review before a new distribution.

See docs/PHASE_0_RECOVERY.md for the release boundary and remaining work.

## Editable source and staging update

The editable Cloudflare frontend has now been recovered in cloudflare/frontend and checked against the frozen runtime using binding-normalized JS comparison and exact stylesheet comparison. Separate health-only staging resources and additive schemas are ready. See docs/PHASE_1_STAGING.md. The earlier source-provenance limitation is resolved for the frontend; the bundled live backend and its special renderer adapters still need modular reconciliation.
