import { sveltekit } from '@sveltejs/kit/vite';
import { defineConfig } from 'vite';

export default defineConfig({
	plugins: [sveltekit()],
	// `plotly.js/lib/core` (and a few transitive deps) reference the
	// Node-only `global` symbol at the top level. Alias it to `globalThis`
	// so the modular Plotly bundle works in the browser.
	define: {
		global: 'globalThis'
	}
});
