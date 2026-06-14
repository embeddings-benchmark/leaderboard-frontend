// Fetches the catalog (including off-menu entries) and pre-derives sidebar facets.
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

// Curated order shared with /tasks.
const CURATED = [
	'retrieval',
	'classification',
	'pair-classification',
	'clustering',
	'semantic-similarity'
] as const;

async function deriveBenchmarksData(fetchFn?: typeof fetch): Promise<BenchmarksData> {
	const list = (await loadBenchmarks(fetchFn)).sort((a, b) =>
		a.displayName.localeCompare(b.displayName)
	);
	const mods = new Set<string>();
	const simpTypes = new Set<string>();
	const doms = new Set<string>();
	// Per-language count → popularity-sorted pills.
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
