import { defineConfig } from '@playwright/test';

export default defineConfig({
	webServer: {
		// PUBLIC_USE_MOCK=1 makes service.ts return the deterministic mock data
		// instead of throwing on a missing PUBLIC_API_URL — so the e2e suite
		// runs against a self-contained build with no backend dependency.
		// PUBLIC_API_URL is explicitly cleared so a developer's `.env.local`
		// (which may point at a local backend) doesn't get baked into the
		// test build — service.ts prefers API over USE_MOCK when both are set.
		command: 'npm run build && npm run preview -- --port 4173',
		env: { PUBLIC_USE_MOCK: '1', PUBLIC_API_URL: '' },
		port: 4173,
		reuseExistingServer: true,
		timeout: 180_000
	},
	use: { baseURL: 'http://localhost:4173' },
	testMatch: '**/*.e2e.{ts,js}',
	forbidOnly: !!process.env.CI,
	retries: process.env.CI ? 2 : 0
});
