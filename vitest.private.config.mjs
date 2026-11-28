import {cloudflareTest,readD1Migrations} from '@cloudflare/vitest-plugin';
import {defineConfig} from 'vitest/config';

export default defineConfig({
  plugins:[cloudflareTest({
    wrangler:{configPath:'./cloudflare/wrangler.platform-staging.jsonc'},
    miniflare:{bindings:{TEST_MIGRATIONS:await readD1Migrations('./cloudflare/platform/migrations')}}
  })],
  test:{include:['tests/private-runtime.test.mjs'],testTimeout:60000,hookTimeout:30000}
});
