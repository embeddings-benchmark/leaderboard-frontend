import { buildMockSummary } from '$lib/data/mockSummary';
import { DEFAULT_BENCHMARK_NAME } from '$lib/data/mockBenchmarks';

export const prerender = true;

export function entries() {
	const models = buildMockSummary(DEFAULT_BENCHMARK_NAME).rows.map((r) => r.model.name);
	return models.map((name) => ({ name }));
}
