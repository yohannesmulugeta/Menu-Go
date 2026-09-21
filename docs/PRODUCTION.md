# Menu Go production operations

## Current production scope

- Hosting: GitHub Pages
- Public restaurant: Abol Coffee (`abol-coffee`)
- Demo tenants: retained as `draft`
- Customer access: public, no account required
- Restaurant management: invitation-only email/password accounts
- Platform management: existing platform-administrator account

## Release command

```bash
npm ci
npm run check
```

Push to `main` only after this command succeeds. GitHub Actions repeats the same
check before publishing the `dist` artifact.

## Supabase Dashboard settings

The repository's `supabase/config.toml` documents the intended settings. Confirm
these values in the hosted Supabase Dashboard because database migrations cannot
change hosted Auth configuration:

1. Site URL: `https://yohannesmulugeta.github.io/Menu-Go/`
2. Redirect allow-list: `https://yohannesmulugeta.github.io/Menu-Go/**`
3. Email confirmation: enabled
4. Minimum password length: 8; require letters and digits
5. Secure password changes: enabled
6. Leaked-password protection: enabled when available on the selected plan
7. Auth email/sign-in rate limits: reviewed
8. CAPTCHA: configure before opening self-service registration; manager signup is currently invitation-only
9. Custom SMTP: configure before sending invitations to real restaurant managers
10. Protect the Supabase and GitHub owner accounts with MFA

## Abol Coffee manager handover

The database contains a non-deliverable placeholder invitation ending in
`@example.invalid`. From `#/platform`, choose **Invite manager** for Abol Coffee
and enter the real manager email. Creating the new invitation expires the
placeholder. Send the generated one-time link to the manager.

## Data protection

Before each release:

- Export or snapshot the production database.
- Keep `supabase/migrations` synchronized with the hosted migration history.
- Verify Abol Coffee remains active and the demo tenants remain draft.
- Verify the Abol menu and category integrity counts.
- Do not place service-role keys, database passwords, SMTP passwords, or access
  tokens in Vite variables or GitHub-tracked files.

## Rollback

Use the Git tag created before a release to restore frontend code. Database
changes require a reviewed forward migration or a Supabase backup restore; do
not edit migration history that has already been applied.
