import { loadBenchmarkMenu, loadTasks } from '$lib/data/service';

// Client-only route — the page component populates its own reactive state.
export const ssr = false;

// Pre-warms the shared `cachedHttp` cache so the page's `$effect` resolves
// synchronously on first activation. With `data-sveltekit-preload-data="hover"`
// on `<body>`, this load runs ~200 ms after a nav-link hover in every browser
// — cross-browser equivalent of the Chrome-only Speculation Rules prefetch.
export const load = async () => {
	await Promise.all([loadBenchmarkMenu(), loadTasks({})]);
	return {};
};
