import adapter from '@sveltejs/adapter-static';

const dev = process.env.NODE_ENV === 'development';

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
			base: dev ? '' : process.env.BASE_PATH || ''
		},
		prerender: {
			// The story page's TOC links to section anchors (#lede, #leader, …).
			// Those sections only render after the leaderboard store loads on the
			// client, so they're absent from the prerendered HTML. They WILL be
			// present after hydration, so we downgrade the build error to a warning
			// instead of failing prerender.
			handleMissingId: 'warn'
		}
	}
};

export default config;
