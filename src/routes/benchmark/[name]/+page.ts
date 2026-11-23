// Prerendered so per-entity `ShareMeta` lands in static HTML for social crawlers.
// Requires `PUBLIC_API_URL` reachable during `vite build`.
import { error, redirect } from '@sveltejs/kit';
import { building } from '$app/environment';
import { resolve } from '$app/paths';
import type { EntryGenerator, PageLoad } from './$types';
import { HttpError, loadBenchmark, loadBenchmarks, loadSlugIndex } from '$lib/data/service';
import { resolveSlugParam, slug } from '$lib/format';
import type { Benchmark } from '$lib/types';

export const prerender = !process.env.BUILD_NO_PRERENDER;

export const entries: EntryGenerator = async () => {
	const benches = await loadBenchmarks();
	// Readable slug pages, plus the old raw-name URLs (`MTEB(eng, v2)`) which
	// still prerender so already-shared links keep working.
	return benches.flatMap((b) => {
		const s = slug(b.name);
		return s === b.name ? [{ name: s }] : [{ name: s }, { name: b.name }];
	});
};

// Ships in the route's prerendered .json so hover-preload populates the cache
// before the store's loadBenchmark fires.
export const load: PageLoad = async ({
	params,
	fetch,
	url,
	untrack
}): Promise<{ benchmark: Benchmark }> => {
	const { name, redirect: to } = resolveSlugParam(
		params.name,
		await loadSlugIndex('benchmarks', fetch),
		slug
	);
	// Old raw-name URL (`MTEB(eng, v2)`): the build prerenders it as a full
	// page so link previews of already-shared links keep working; in the
	// browser it redirects to the slug, keeping `?tab=` / `?pin=`.
	if (to && !building) {
		redirect(308, resolve('/benchmark/[name]', { name: to }) + untrack(() => url.search));
	}
	// Unknown params fall through to the API, which also resolves aliases.
	const benchmark = await loadBenchmark(name, fetch).catch((e) => {
		if (e instanceof HttpError && e.status === 404) {
			error(404, `Benchmark "${name}" not found`);
		}
		throw e;
	});
	return { benchmark };
};
