import { sveltekit } from '@sveltejs/kit/vite';
import { defineConfig } from 'vite';

export default defineConfig({
	plugins: [sveltekit()],
	// `plotly.js/lib/core` (and a few transitive deps) reference the
	// Node-only `global` symbol at the top level. Alias it to `globalThis`
	// so the modular Plotly bundle works in the browser.
	define: {
		global: 'globalThis'
	},
	build: {
		// Plotly's core renderer + bundled D3 is ~800 kB minified (~280 kB
		// gzip) and is already dynamic-imported from `PlotlyChart.svelte`
		// (with per-trace `plotly.js/lib/scatter[polar]` chunks on top of
		// `plotly.js/lib/core`) so it only loads when a chart needs to
		// render. The default 500 kB warning would have us do the
		// optimisation we already did (dynamic import) and is otherwise
		// noise — raise the threshold to acknowledge the lazy-loaded
		// chunk's intrinsic size.
		chunkSizeWarningLimit: 900
	}
});
