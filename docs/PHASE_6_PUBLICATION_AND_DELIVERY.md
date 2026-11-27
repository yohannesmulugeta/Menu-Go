# Publication and public delivery on staging

This release adds publication and guest interaction to the shared staging Worker. The accepted shared layouts and existing authentication services continue to apply. The stable staging destination is `https://admaki-menu-platform-staging.yohannesmulugeta084.workers.dev/r/:slug`.

## Publishing and revocation

Restaurant managers and super admins use the restaurant overview to review the saved draft, publish it, open the public menu or unpublish it. Requests include the saved configuration revision, current policy revision and expected publication head. A suspended restaurant cannot publish. Onboarding continues creating drafts.

A single SQLite read captures restaurant metadata, configuration, visible menu data and media ownership. The publication transaction compares that state again, rechecks the actor and policy, inserts the immutable snapshot and its media references, advances the head and activates the restaurant. Concurrent or retried requests with stale revisions fail with 409. A partial write rolls back the entire batch. Existing retained history without a head receives a new revision after the maximum historical revision.

Each snapshot contains versioned configuration, data and capability metadata. Private Wi-Fi values are stripped. Publication validates managed media tenant, slot and item ownership, ready lifecycle and R2 availability. Reference rows are inserted before the head becomes public. Unpublishing returns the restaurant to draft while retaining its head, snapshots, audit and image references. No schema migration is required.

## Public delivery

| Route | Behavior |
|---|---|
| `GET /api/restaurants/:id/publication` | Authorized publication status, expected head and stable menu URL. |
| `POST /api/restaurants/:id/publish` | Publish the saved draft using `revision`, `policy_revision` and `publication_revision`. |
| `POST /api/restaurants/:id/unpublish` | Revoke public availability using `publication_revision`. |
| `GET` / `HEAD /r/:slug` | Render the active snapshot using current platform policies and locale. |
| `GET` / `HEAD /public-media/:slug/:mediaId` | Serve only a visible image referenced by the current active publication. |
| `GET` / `HEAD /r/:slug/qr.svg` | Download a standalone QR SVG when the current QR capability is enabled. |

Public HTML, images and QR responses use no-store headers. Every request reads the active head and policy epoch. HTML rendering and R2 reads recheck them immediately before returning. Disabling an image feature blocks its existing public URL. Unpublishing or suspension blocks menu, QR, image and guest-write access. The private upload routes continue requiring a session. External approved image URLs retain their existing origin.

QR generation reuses the existing React, React DOM and `qrcode.react` dependencies. The SVG includes its standalone namespace and four-module quiet area. Its encoded target is the stable staging menu URL, which follows future publication heads.

## Guest interaction and dashboard

Published menus connect feedback, share and QR controls. Enabled analytics send only the existing enumerated anonymous events. Search text and arbitrary metadata are excluded. The server uses the existing published capability, origin, rate-limit, head and policy checks for writes. Private previews send no guest events and keep publication controls inactive.

The restaurant overview now links to the paginated feedback inbox and the existing 30-day analytics report. Disabled analytics collection retains authorized access to historical counts when dashboard policy permits it. Feedback and event rows remain available to authorized managers after unpublishing.

## Verification

`npm run check:menu-publications` covers snapshot isolation, duplicate and stale requests, cross-tenant and origin denials, session and policy races, R2 availability, wrong media slots, atomic failure rollback, current-policy media gating, QR serialization, unpublishing, suspension and retained legacy history. Existing schema, media, feature, authentication, onboarding, baseline and root build checks remain part of CI.

Local Chrome checks exercised dashboard publication, anonymous menu and image access, all five public templates at 360/390/768/1440 pixel widths with the feedback form expanded, guest feedback, the manager inbox and analytics report, QR link generation and unpublishing. A scanner decoded the generated QR to the exact stable staging menu URL. The browser recorded no warnings or exceptions. These local checks use synthetic in-memory D1 and R2 fixtures. The share fallback passed with native sharing disabled in the test browser. The native device share sheet remains a device verification step. Deployed evidence is recorded below.

## Rollback and remaining release work

Capture the active staging Worker version and a private D1 backup before deployment. Deploy only `cloudflare/wrangler.platform-staging.jsonc`. Roll back Worker code to that captured version when required, preserving database history, references, credentials and image objects. Verify health, resource bindings and all six existing migration checksums before and after deployment.

Production cutover, original domain and QR routing, real restaurant import, content editing, retention limits for historical publications, and capacity/cost certification require their respective follow-up work and approvals. This staging release adds no production route or content import.

## Verified staging release

Worker version `ae586267-7f7f-4ac6-b9c4-33010cae1600` serves 100% of staging traffic. The uploaded bundle matches the checked dry-run build. Bindings, the environment marker, six migration checksums, scheduled cleanup and health were verified. The previous Worker was `a0213465-a250-4840-8d6e-052612dac951`. A fresh private D1 export passed an isolated restore before rollout.

A disposable restaurant manager published through the deployed dashboard. Anonymous R2 image bytes matched authenticated private reads. Private previews generated no guest events. The public menu passed four viewport widths, feedback submission, empty search, anonymous analytics and the manager inbox/report. The real downloaded SVG was scanned and decoded to its exact stable staging URL. Republished draft changes appeared only after the second publication. The old image URL lost public access while its object remained retained. Live platform policy changes revoked cover and QR availability, and the original values were restored. Unpublishing revoked menu, QR, images and feedback writes.

The first remote attempt exposed a stale success notice during republishing. The notice now clears while the request runs. The final test waits for the actual response and passed with no browser warnings or exceptions. Both test attempts were cleaned up. Accounts are disabled, sessions revoked and test restaurants suspended. Referenced synthetic images and publication history remain retained. Existing restaurant configuration and credential fingerprints matched the initial snapshots.

[CI passed on the final runtime commit](https://github.com/yohannesmulugeta/Menu-Go/actions/runs/45919491809). [The staging inventory](../cloudflare/inventory/platform-staging.json) records source hashes, deployment, backup, QR scan and cleanup evidence. PR #3 stays in draft.

## Changed files

- `cloudflare/platform/publications/service.mjs`, `snapshot.mjs` and `public.mjs` implement publication and public delivery.
- `cloudflare/platform/templates/render.mjs` and `public-script.mjs` connect guest controls.
- `cloudflare/platform/web/page.mjs`, `publication.mjs` and `guest-reports.mjs` add dashboard controls and reports.
- `cloudflare/platform/worker.mjs` connects the routes and health capability.
- `scripts/check-menu-publications.mjs`, `scripts/check-menu-platform.mjs`, `package.json` and `.github/workflows/check-cloudflare-baseline.yml` add the regression gate.
- This report and `cloudflare/inventory/platform-staging.json` record the rollout.
