import adapter from '@sveltejs/adapter-static';
import { execSync } from 'node:child_process';

const dev = process.env.NODE_ENV === 'development';

// A stable per-build version string. SvelteKit embeds this in the build and
// polls for it at runtime; on mismatch the next navigation does a full reload
// instead of trying to load now-missing hashed assets. Prefer the GitHub
// Actions commit SHA, then a local git SHA, then a build timestamp.
function buildVersion() {
	const sha = process.env.GITHUB_SHA;
	if (sha) return sha.slice(0, 12);
	try {
		return execSync('git rev-parse --short HEAD', { stdio: ['ignore', 'pipe', 'ignore'] })
			.toString()
			.trim();
	} catch {
		return Date.now().toString();
	}
}

/** @type {import('@sveltejs/kit').Config} */
const config = {
	compilerOptions: {
		// Force runes mode for the project, except for libraries. Can be removed in svelte 6.
		runes: ({ filename }) => (filename.split(/[/\\]/).includes('node_modules') ? undefined : true)
	},
	kit: {
		adapter: adapter({
			pages: 'build',
			assets: 'build',
			fallback: '404.html',
			precompress: false,
			strict: true
		}),
		paths: {
			base: dev ? '' : process.env.BASE_PATH || '',
			// SvelteKit 2 defaults this to `true`, which emits *relative*
			// asset URLs. On a deep route like `/benchmark/<name>/` that
			// turns `_app/immutable/...` into
			// `/benchmark/<name>/_app/immutable/...`, which doesn't exist
			// on disk → nginx SPA fallback serves 404.html → browser
			// refuses to load the resulting HTML as a JS module (MIME
			// mismatch). Force absolute (`/_app/...`) so the asset URL
			// is the same from every page.
			relative: false
		},
		prerender: {
			// The story page's TOC links to section anchors (#lede, #leader, …).
			// Those sections only render after the leaderboard store loads on the
			// client, so they're absent from the prerendered HTML. They WILL be
			// present after hydration, so we downgrade the build error to a warning
			// instead of failing prerender.
			handleMissingId: 'warn',
			// The GitHub Pages build lives at `embeddings-benchmark.github.io/leaderboard-frontend`
			// — same origin as the sibling mteb docs site at `embeddings-benchmark.github.io/mteb/`,
			// which the top-bar links to. SvelteKit's crawler treats those same-origin URLs
			// as internal, strips the origin, then crashes because `/mteb/` doesn't start with
			// `paths.base`. Anything outside our base is a sibling site — log and skip.
			handleHttpError: ({ path, referrer, message }) => {
				const base = process.env.BASE_PATH || '';
				if (base && !path.startsWith(base)) {
					console.warn(`Skipping sibling-origin link ${path} (referenced from ${referrer})`);
					return;
				}
				throw new Error(message);
			},
			// Production origin baked into every prerendered URL. `page.url.origin`
			// resolves to this during `vite build`, which is what ends up in
			// `og:image` / `og:url` / canonical-link tags on the static HTML.
			// Override per build with `PUBLIC_SITE_URL=…` (e.g. for staging
			// or a fork). Without this, SvelteKit substitutes its placeholder
			// `http://sveltekit-prerender`, which 404s in every crawler.
			origin: process.env.PUBLIC_SITE_URL || 'https://mteb-leaderboardv3.hf.space'
		},
		version: {
			// Embedded in the build. SvelteKit checks `_app/version.json` at the
			// configured interval; when the deployed version no longer matches the
			// loaded one, the next client-side navigation falls back to a full
			// page reload — so a fresh deploy lands without a manual cache clear.
			name: buildVersion(),
			pollInterval: 60_000
		}
	}
};

export default config;
