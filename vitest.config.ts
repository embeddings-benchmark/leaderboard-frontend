import { defineConfig } from 'vitest/config';
import { sveltekit } from '@sveltejs/kit/vite';

export default defineConfig({
	plugins: [sveltekit()],
	test: {
		// Unit tests live next to the source as *.test.ts. Playwright e2e
		// suites under tests/ use *.e2e.ts and are excluded here.
		include: ['src/**/*.{test,spec}.{ts,js}'],
		exclude: ['node_modules', 'build', '.svelte-kit', 'tests/**'],
		environment: 'node'
	}
});
