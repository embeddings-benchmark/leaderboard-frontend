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
		// Plotly chunk is lazy-loaded by PlotlyChart.svelte; default 500 kB warning is noise.
		chunkSizeWarningLimit: 900
	},
	ssr: {
		// lucide-svelte ships raw `.svelte` files behind its subpath exports
		// (the `./icons/<name>.js` shim re-imports `../Icon.svelte`). Without
		// noExternal, Vite leaves the package external during SSR / prerender
		// and Node hits the `.svelte` files directly → ERR_UNKNOWN_FILE_EXTENSION.
		noExternal: ['lucide-svelte']
	}
});
