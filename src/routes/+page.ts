// Returns `menu` and `primaries` as unresolved promises so client-side nav
// renders the skeleton immediately; prerender awaits both before emitting HTML.
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

// Size buckets in millions of params; `null` = open-ended top bucket.
const SIZE_BUCKETS: ReadonlyArray<readonly [number, number | null]> = [
	[0, 500],
	[500, 1000],
	[1000, 5000],
	[5000, null]
];

export type LeadersResult = BenchmarkLeaders | { error: string };

export interface ResolvedPrimary extends Primary {
	b: Benchmark;
	leaders: LeadersResult;
}

export const load: PageLoad = ({ fetch }) => {
	const menuPromise = loadBenchmarkMenu(fetch);
	// Prefer in-menu copy; fall back to direct fetch.
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
