import { defineConfig } from '@playwright/test';

// Screenshot tests (`*.visual.ts`) compare against PNG baselines committed
// under `tests/__screenshots__/`, so reviewers see how an element looks in the
// PR diff. Text rendering differs per OS, so the baselines are made in the
// official Playwright Linux image (`make update-visual`) and CI runs them in
// that same image. The project only exists on Linux: on macOS `make test`
// skips it, and `make test-visual` runs it in Docker.
const visual = process.platform === 'linux';

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
			command: 'npx wait-on -t 30s tcp:8787 && npm run build && node tests/preview-server.mjs',
			env: { PUBLIC_API_URL: 'http://localhost:8787' },
			port: 4173,
			reuseExistingServer: true,
			timeout: 180_000
		}
	],
	testDir: 'tests',
	use: { baseURL: 'http://localhost:4173' },
	projects: [
		{ name: 'e2e', testMatch: '**/*.e2e.{ts,js}' },
		...(visual
			? [
					{
						name: 'visual',
						testMatch: '**/*.visual.ts',
						use: { viewport: { width: 1280, height: 900 } }
					}
				]
			: [])
	],
	// No platform suffix: there is only one (Linux) set of baselines.
	snapshotPathTemplate: '{testDir}/__screenshots__/{testFileName}/{arg}{ext}',
	// Small tolerance: baselines made on arm64 (Apple silicon Docker) can differ
	// from CI's amd64 by a few anti-aliased pixels.
	expect: {
		toHaveScreenshot: {
			animations: 'disabled',
			caret: 'hide',
			maxDiffPixelRatio: 0.01,
			stylePath: './tests/visual.css'
		}
	},
	forbidOnly: !!process.env.CI,
	retries: process.env.CI ? 2 : 0
});
