# Menu Go

Restaurant menus and staff dashboards hosted on Cloudflare.

- [Live menus](https://menu.admakidigital.com/)
- [Staff sign-in](https://menu.admakidigital.com/#/login)
- [Cloudflare setup and migration status](cloudflare/README.md)

The original menu interface is preserved. D1 stores business data, Access verifies staff email, and the Worker enforces restaurant permissions. See the setup guide for R2 photo-upload activation and rollback details.

```sh
npm ci
npm run check
npm run deploy:cloudflare
```

Use Node 24 and Python 3. Historical PostgreSQL migrations are retained under `supabase/` for rollback; the deployed Cloudflare application does not use them.
