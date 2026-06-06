import { loadBenchmarkMenu, loadTasks } from '$lib/data/service';

// Prerender so ShareMeta's `<title>` + `<meta og:…>` end up in the static
// HTML for crawlers. SSR stays on (default) so the page component
// renders during build to emit the head tags; the client still
// re-hydrates with live data via the page's `$effect`.
export const prerender = true;

// Pre-warms the shared `cachedHttp` cache so the page's `$effect` resolves
// synchronously on first activation. With `data-sveltekit-preload-data="hover"`
// on `<body>`, this load runs ~200 ms after a nav-link hover in every browser
// — cross-browser equivalent of the Chrome-only Speculation Rules prefetch.
export const load = async () => {
	await Promise.all([loadBenchmarkMenu(), loadTasks({})]);
	return {};
};
