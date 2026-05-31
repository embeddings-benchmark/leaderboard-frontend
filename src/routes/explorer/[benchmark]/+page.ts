import { BENCHMARK_INDEX } from '$lib/data/mockBenchmarks';

export const prerender = true;

export function entries() {
	return Object.keys(BENCHMARK_INDEX).map((name) => ({ benchmark: name }));
}
