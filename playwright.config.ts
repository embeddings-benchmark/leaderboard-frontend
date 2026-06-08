import { defineConfig } from '@playwright/test';

export default defineConfig({
	webServer: {
		// Point at the live backend — the build's prerender `entries()`
		// (benchmark/[name], tasks/[name], models/[...name]) hit the API
		// to enumerate names, and runtime loaders need it too. Set
		// explicitly so a developer's `.env.local` doesn't get baked in.
		// Matches the URL the other CI workflows use.
		command: 'npm run build && npm run preview -- --port 4173',
		env: { PUBLIC_API_URL: 'https://mteb-leaderboard-backend.hf.space' },
		port: 4173,
		reuseExistingServer: true,
		timeout: 180_000
	},
	use: { baseURL: 'http://localhost:4173' },
	testMatch: '**/*.e2e.{ts,js}',
	forbidOnly: !!process.env.CI,
	retries: process.env.CI ? 2 : 0
});
