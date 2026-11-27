# Restaurant workspace update

27 November 2026. This update changes the authenticated dashboard and directory reads. It does not migrate a database, reset production accounts, republish a restaurant, change a public menu renderer, or change Cloudflare plans, routes or bindings.

The restaurant directory now has explicit Edit menu, Preview and QR code actions, status filtering, totals across all matching pages, and responsive cards. A staging notice links to the live administration site. Known staging fixtures are hidden by default and remain available through Show test restaurants. The filter is restricted to the exact staging environment; it never hides production restaurants based on their names or slugs. Existing directory callers retain their default visibility and response fields.

The recovered owner account was verified through the authenticated staging dashboard and restaurant editor after operator recovery. Production admin credentials were not recovered or reset. The six-digit client PIN policy retains the strong owner passphrase policy, first-login rotation, hashing, throttles and session revocation.

## Verification before deployment

- SQLite-backed authentication, onboarding/directory, editor, publication, schema, feature, gateway, production-isolation and private-runtime unit checks passed locally. The directory tests cover totals beyond 100 rows, status validation, tenant scoping, reversible fixture filtering and production visibility.
- The recovered baseline verified 52 exact source/assets and all 14 original router tests passed.
- The browser used a local actual Worker with synthetic SQLite/R2 only: owner sign-in, hidden/visible test records, direct menu navigation, an exact price save and matching private preview, QR draft guidance, and manager sign-in with a six-digit PIN passed. No browser warning/error was captured.
- The restaurant directory fit 360, 390, 768 and 1440 pixel viewports without horizontal overflow. These checks do not certify physical phones.
- The packaged Worker preserves the MenuPrivateOperations export and the existing fetch/scheduled handlers. Both environments use the same bundle with their existing environment-specific bindings.

Full build, lint and actual Cloudflare runtime checks are required in GitHub CI before production. Remote staging and production results must be recorded after deployment; local verification alone does not establish a live release.
