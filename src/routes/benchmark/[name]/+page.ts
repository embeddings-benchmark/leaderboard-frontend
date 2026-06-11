// Prerender every benchmark detail page at build time so the per-entity
// `ShareMeta` tags land in the static HTML where social-media crawlers
// can read them. The SPA fallback at `404.html` doesn't carry route-
// specific `<title>` / `<meta og:…>` — anything not prerendered shows
// up as a blank card. The build hits the API to enumerate names; this
// requires `PUBLIC_API_URL` to be reachable during `vite build`.
import type { EntryGenerator, PageLoad } from './$types';
import { loadBenchmark, loadBenchmarks } from '$lib/data/service';

export const prerender = true;

export const entries: EntryGenerator = async () => {
	const benches = await loadBenchmarks(true);
	return benches.map((b) => ({ name: b.name }));
};

// Pre-warm `loadBenchmark(name)` — small payload (just the benchmark
// metadata, no scores). With `data-sveltekit-preload-data="hover"` on
// `<body>` this runs ~200 ms after a benchmark-card hover, so by the
// time the user clicks the page's leaderboard store gets a synchronous
// `cachedHttp` hit instead of waiting on the network. The heavy
// `loadSummary` stays lazy: the store triggers it when the page mounts.
// Best-effort: a failure here doesn't block the prerender / nav, since
// the store retries on mount and surfaces its own error UI.
export const load: PageLoad = async ({ params }) => {
	await loadBenchmark(params.name).catch(() => undefined);
	return {};
};
