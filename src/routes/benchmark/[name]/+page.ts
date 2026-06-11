// Prerender every benchmark detail page at build time so the per-entity
// `ShareMeta` tags land in the static HTML where social-media crawlers
// can read them. The SPA fallback at `404.html` doesn't carry route-
// specific `<title>` / `<meta og:…>` — anything not prerendered shows
// up as a blank card. The build hits the API to enumerate names; this
// requires `PUBLIC_API_URL` to be reachable during `vite build`.
import type { EntryGenerator, PageLoad } from './$types';
import { loadBenchmark, loadBenchmarks } from '$lib/data/service';
import type { Benchmark } from '$lib/types';

export const prerender = true;

export const entries: EntryGenerator = async () => {
	const benches = await loadBenchmarks(true);
	return benches.map((b) => ({ name: b.name }));
};

// Return the benchmark metadata so it ships in the route's prerendered
// `.json` payload. `data-sveltekit-preload-data="hover"` on `<body>` fetches
// that `.json` on link hover — by the time the user clicks, the data is
// already in the browser. The page primes `cachedHttp` from this value at
// script-top (before any `$effect` fires), so the leaderboard store's
// `loadBenchmark` call resolves synchronously instead of going to the
// network. The heavy `loadSummary` stays lazy: the store triggers it when
// the page mounts. Best-effort — a failure here gives the page `null` and
// the store retries on mount, surfacing its own error UI.
export const load: PageLoad = async ({
	params,
	fetch
}): Promise<{ benchmark: Benchmark | null }> => {
	return { benchmark: await loadBenchmark(params.name, fetch).catch(() => null) };
};
