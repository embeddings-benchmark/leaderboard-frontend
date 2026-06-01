import { BENCHMARK_INDEX } from '$lib/data/mockBenchmarks';
import { buildMockSummary } from '$lib/data/mockSummary';

export const prerender = true;

export function entries() {
	const names = new Set<string>();
	for (const bench of Object.values(BENCHMARK_INDEX)) {
		const summary = buildMockSummary(bench.name);
		for (const meta of summary.tasksMeta) names.add(meta.name);
	}
	return [...names].map((name) => ({ name }));
}
