// /benchmarks loader. Fetches the full benchmark catalog (including hidden
// entries — the catalog renders them with the "newer version available"
// hint) and pre-derives the facet sets the sidebar needs. Streamed so the
// page can paint the shell + skeleton on client-side nav; prerender awaits
// the promise before writing static HTML.
import type { PageLoad } from './$types';
import { loadBenchmarks } from '$lib/data/service';
import type { Benchmark } from '$lib/types';

export const prerender = true;

export interface BenchmarksData {
	all: Benchmark[];
	modalities: string[];
	simplifiedTypesPresent: string[];
	domains: string[];
	languages: string[];
}

// Order the simplified buckets the same way /tasks does (curated canonical
// first, then any extras) so users see the familiar "retrieval / classification
// / …" sequence.
const CURATED = [
	'retrieval',
	'classification',
	'pair-classification',
	'clustering',
	'semantic-similarity'
] as const;

async function deriveBenchmarksData(fetchFn?: typeof fetch): Promise<BenchmarksData> {
	const list = (await loadBenchmarks(true, fetchFn)).sort((a, b) =>
		a.displayName.localeCompare(b.displayName)
	);
	// Single pass over the catalog to fill every facet set, instead of
	// per-facet flatMap+Set traversals.
	const mods = new Set<string>();
	const simpTypes = new Set<string>();
	const doms = new Set<string>();
	// Count per language so the filter pills sort by popularity.
	const langCount = new Map<string, number>();
	for (const b of list) {
		if (b.modalities) for (const m of b.modalities) mods.add(m);
		if (b.simplifiedTaskTypes) for (const t of b.simplifiedTaskTypes) simpTypes.add(t);
		if (b.domains) for (const d of b.domains) doms.add(d);
		if (b.languages) for (const l of b.languages) langCount.set(l, (langCount.get(l) ?? 0) + 1);
	}
	return {
		all: list,
		modalities: [...mods].sort(),
		simplifiedTypesPresent: [
			...CURATED.filter((t) => simpTypes.has(t)),
			...[...simpTypes].filter((t) => !CURATED.includes(t as never)).sort()
		],
		domains: [...doms].sort(),
		languages: [...langCount.entries()]
			.sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0]))
			.map(([l]) => l)
	};
}

export const load: PageLoad = ({ fetch }) => {
	return { benchmarks: deriveBenchmarksData(fetch) };
};
