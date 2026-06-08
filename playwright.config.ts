import { defineConfig } from '@playwright/test';

export default defineConfig({
	// Two-stage webServer: the mock API boots first, then the build (which
	// hits the mock during prerender `entries()`) and preview run pointed
	// at it. `wait-on` blocks the build until the mock's port is bound,
	// avoiding a race during `vite build`.
	webServer: [
		{
			command: 'npx tsx tests/mock-api.ts',
			port: 8787,
			reuseExistingServer: true,
			timeout: 30_000
		},
		{
			// Custom `tests/preview-server.mjs` over `npm run preview` because
			// vite preview fails to URL-decode benchmark filenames with
			// special chars (parens / commas) — see comment in that file.
			command:
				'npx wait-on -t 30s tcp:8787 && npm run build && node tests/preview-server.mjs',
			env: { PUBLIC_API_URL: 'http://localhost:8787' },
			port: 4173,
			reuseExistingServer: true,
			timeout: 180_000
		}
	],
	use: { baseURL: 'http://localhost:4173' },
	testMatch: '**/*.e2e.{ts,js}',
	forbidOnly: !!process.env.CI,
	retries: process.env.CI ? 2 : 0
});
