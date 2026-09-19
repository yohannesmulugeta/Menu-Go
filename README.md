# Menu Go

Menu Go is a mobile-first digital guest experience for restaurants.

## Current demo

The repository includes three demo views:

- `#/demo` — guest-facing restaurant page and digital menu
- `#/admin` — restaurant management dashboard
- `#/platform` — Menu Go super-admin dashboard

The first demo restaurant, **Sora Table**, is fictional and exists only to demonstrate the product.

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

## Development

```bash
npm install
npm run dev
```

## Build

```bash
npm run build
```

The Vite base path is configured for:

`https://yohannesmulugeta.github.io/Menu-Go/`
