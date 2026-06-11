// Home page loader. Replaces three `$effect` blocks that fetched menu /
// primaries / leaders client-side after hydration.
//
// Returns `menu` and `primaries` as UNRESOLVED promises so the page can
// `{#await}` each section and show a skeleton while data flows in:
//
//   • Direct visit (prerender): SvelteKit awaits both promises before
//     writing the static HTML, so the file carries the resolved data.
//     `{#await}` resolves synchronously on first paint — no skeleton.
//   • Client-side nav from another page: the new page renders with the
//     skeleton in place immediately rather than blocking the transition
//     on the previous page.
//
// Failures degrade gracefully: a missing primary benchmark or a leaders
// fetch error is filtered out / coerced to `'error'`. Only a hard
// `loadBenchmarkMenu` failure stops the page from rendering.
import type { PageLoad } from './$types';
import { flattenMenu, type Benchmark, type BenchmarkLeaders } from '$lib/types';
import { loadBenchmark, loadBenchmarkMenu, loadLeaders } from '$lib/data/service';

type TintKey = 'multilingual' | 'retrieval' | 'english';
export interface Primary {
	key: TintKey;
	label: string;
	preferred: string;
}

const PRIMARIES: readonly Primary[] = [
	{ key: 'multilingual', label: 'General', preferred: 'MTEB(Multilingual, v2)' },
	{ key: 'retrieval', label: 'Retrieval', preferred: 'RTEB(beta)' },
	{ key: 'english', label: 'General', preferred: 'MTEB(eng, v2)' }
];

// Size buckets in MILLIONS of params (wire format for /benchmarks/{name}/leaders).
// `null` = open-ended top bucket. Mirrors the constant in +page.svelte.
const SIZE_BUCKETS: ReadonlyArray<readonly [number, number | null]> = [
	[0, 500],
	[500, 1000],
	[1000, 5000],
	[5000, null]
];

// Tagged result instead of a string sentinel — matches the `ScoresResult`
// shape used by /tasks/[name] and /models/[...name]. Downstream code
// branches on the `error` key rather than comparing against the literal
// `'error'`.
export type LeadersResult = BenchmarkLeaders | { error: string };

export interface ResolvedPrimary extends Primary {
	b: Benchmark;
	leaders: LeadersResult;
}

export const load: PageLoad = ({ fetch }) => {
	const menuPromise = loadBenchmarkMenu(fetch);
	// Primaries depend on the menu shape (we prefer the in-menu copy
	// before falling back to a direct fetch), so chain off the menu
	// promise. The chain is its own promise — both ship to the client
	// independently and `{#await}` can resolve them in parallel.
	const primariesPromise = menuPromise.then(async (menu) => {
		const byName = new Map(flattenMenu(menu).map((b) => [b.name, b]));
		const resolved = await Promise.all(
			PRIMARIES.map(async (p): Promise<(Primary & { b: Benchmark }) | null> => {
				const fromMenu = byName.get(p.preferred);
				if (fromMenu) return { ...p, b: fromMenu };
				try {
					return { ...p, b: await loadBenchmark(p.preferred, fetch) };
				} catch {
					return null;
				}
			})
		);
		const found = resolved.filter((p): p is Primary & { b: Benchmark } => p !== null);
		return Promise.all(
			found.map(
				async (p): Promise<ResolvedPrimary> => ({
					...p,
					leaders: await loadLeaders(p.b.name, SIZE_BUCKETS, fetch).catch(
						(e): LeadersResult => ({ error: e instanceof Error ? e.message : String(e) })
					)
				})
			)
		);
	});

	return { menu: menuPromise, primaries: primariesPromise };
};
