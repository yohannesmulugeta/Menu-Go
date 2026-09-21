# Menu Go

Menu Go is a mobile-first digital guest experience for restaurants.

## Production routes

The production application includes:

- `#/r/abol-coffee` — Abol Coffee guest page and digital menu
- `#/admin` — authenticated restaurant management dashboard
- `#/platform` — authenticated Menu Go platform-admin dashboard
- `#/accept-invite` — email-bound manager account activation

New restaurants are created as drafts and must be activated by the platform administrator.

## MVP direction

Guest experience:
- Restaurant profile
- Searchable menu
- Category navigation
- Prices and food images
- Review, directions, Wi-Fi and private feedback actions
- Permanent QR code

Restaurant admin:
- Menu management
- Price and availability controls
- QR management
- Feedback
- Basic analytics

Platform admin:
- Multi-restaurant management
- Restaurant status
- Platform analytics

## Supabase

The frontend is already prepared for Supabase.

Copy `.env.example` to `.env.local` after the Supabase project is created:

```bash
VITE_SUPABASE_URL=
VITE_SUPABASE_PUBLISHABLE_KEY=
```

Never commit service-role keys or private credentials.

The full hosted migration history is stored in `supabase/migrations`. The public
Abol Coffee menu is preserved in `supabase/seed.sql`; it contains no users,
feedback, analytics, invitations, or credentials.

Temporary first-user bootstrap RPCs have been removed. New restaurant managers
must use an email-bound invitation created by the platform administrator.

## Development

```bash
npm install
npm run dev
```

## Build

```bash
npm run build
```

Run the complete production gate before deployment:

```bash
npm ci
npm run check
```

The Vite base path is configured for:

`https://yohannesmulugeta.github.io/Menu-Go/`

See [`docs/PRODUCTION.md`](docs/PRODUCTION.md) for release checks and the few
Supabase Dashboard settings that cannot be changed through database migrations.
