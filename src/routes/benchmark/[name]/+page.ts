// Prerendered so per-entity `ShareMeta` lands in static HTML for social crawlers.
// Requires `PUBLIC_API_URL` reachable during `vite build`.
import type { EntryGenerator, PageLoad } from './$types';
import { loadBenchmark, loadBenchmarks } from '$lib/data/service';
import type { Benchmark } from '$lib/types';

export const prerender = true;

export const entries: EntryGenerator = async () => {
	const benches = await loadBenchmarks();
	return benches.map((b) => ({ name: b.name }));
};

// Ships in the route's prerendered .json so hover-preload populates the cache
// before the store's loadBenchmark fires.
export const load: PageLoad = async ({
	params,
	fetch
}): Promise<{ benchmark: Benchmark | null }> => {
	return { benchmark: await loadBenchmark(params.name, fetch).catch(() => null) };
};
