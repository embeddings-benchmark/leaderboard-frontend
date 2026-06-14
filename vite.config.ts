import { sveltekit } from '@sveltejs/kit/vite';
import { defineConfig } from 'vite';

export default defineConfig({
	plugins: [sveltekit()],
	// `plotly.js/lib/core` (and a few transitive deps) reference the
	// Node-only `global` symbol at the top level. Alias it to `globalThis`
	// so the modular Plotly bundle works in the browser.
	//
	// `process.env.BUILD_NO_PRERENDER` is read by `+layout.ts` / `+page.ts`
	// modules that get bundled into BOTH server and client. Vite doesn't
	// auto-substitute custom `process.env.*` references, so the client
	// bundle would hit `process is not defined` at module load. Inline the
	// build-time value as a literal so the client gets a plain string.
	define: {
		global: 'globalThis',
		'process.env.BUILD_NO_PRERENDER': JSON.stringify(process.env.BUILD_NO_PRERENDER || '')
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
