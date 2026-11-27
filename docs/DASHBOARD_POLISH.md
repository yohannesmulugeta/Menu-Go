# Restaurant workspace release

The dashboard and six-digit client PIN update were deployed to production on 27 November 2026 using the same bundle tested in staging. The application source is commit `f51e8857626d04a4d289a457a07a3cd59492c481`. Both complete GitHub verification runs passed before deployment.

[Live dashboard](https://app.admakidigital.com/login) · [Staging sample menu](https://admaki-menu-platform-staging.yohannesmulugeta084.workers.dev/r/staging-demo)

## Changes

The restaurant directory has direct Edit menu, Preview and QR actions, status filters, accurate totals across pages, responsive cards and a clear staging notice. Known staging fixtures are hidden by default and can be shown without deleting records. Production never classifies restaurants as fixtures by name or slug. Publication now has a visible in-dashboard confirmation and Cancel action.

Clients can use six-digit PINs with the existing hashing, throttling, first-login rotation and session rules. Super admins retain the strong passphrase policy. Existing production credentials were not reset.

## Verified results

- Staging owner login and the restored dashboard/editor were verified. The existing owner session remained usable after deployment.
- Local browser checks used synthetic SQLite/R2 only: owner and six-digit manager sign-in, direct menu navigation, an exact price save and matching preview, QR navigation, and the directory at 360, 390, 768 and 1440 pixels. The browser captured no warnings or errors during those checks.
- Deployed staging Cancel left the draft unpublished; Confirm publish published the two explicitly labeled sample items with correct prices. The generated 320 by 320 QR image loaded successfully.
- Production health reported the production environment, six migrations and the existing media binding after release.
- Ordered before/after fingerprints matched for restaurant records, menu contents/prices/image URLs, categories, saved design/configuration and publication snapshots/heads. Private production recovery and audit details are excluded from this public repository.
- No production data migration, credential reset, route change, binding change or paid service activation was performed.

| Live menu | Verified items |
| --- | ---: |
| Abol Coffee | 89 |
| Mokodo Pizza | 103 |
| Occasion | 116 |
| Sheba Coffee | 40 |

The user computer disconnected during the last production QR download check. The read-only release workflow checks production health, the login shell, the four public menus and their SVG GET/HEAD download responses independently of that computer connection. Its result must be inspected before claiming that final check passed. Physical-phone scanning and a fresh real production-admin password login are not claimed as verified by this update.

## Overview usability update — 27 November 2026 (local)

- The restaurant overview has one primary Edit menu action. Categories and opening hours remain available inside Menu; feedback, analytics, QR and settings retain their sidebar destinations. Platform administration has its own visually separated navigation group.
- Unpublished menus show an amber status and a three-step launch guide instead of zero-value analytics. Published menus retain statistics. Disabled or failed analytics are described explicitly instead of being displayed as zero.
- Preview and publishing share one panel. Unpublished changes are detected by comparing the saved configuration revision with the publication's configuration revision. Publication time is displayed from the existing server timestamp; no last-saved timestamp is fabricated. Confirmation, revision guards and unpublish behavior remain in place.
- The sidebar keeps the restaurant profile visible and limits scrolling to navigation when necessary. Mobile uses a collapsible Navigation control; account actions live in a compact native disclosure. Controls have at least 44-pixel targets.
- The overview reuses its publication/configuration reads when constructing publication controls. No schema, public template, authentication, credential, production-data or hosting changes are included.

Local verification: Cloudflare entry bundle, authentication, onboarding, menu editor, publications, template/media, production isolation and gateway checks passed. An actual local Worker with synthetic SQLite/R2 data was checked in the browser for manager/admin navigation, draft checklist, published statistics/QR, publish confirmation/cancel, categories and opening hours. Responsive checks covered 360, 390, 768 and 1440 pixels; these are simulated viewports, not physical phones. This update has not been deployed.
