import type { Benchmark, BenchmarkSummary, MenuEntry } from '$lib/types';
import { BENCHMARK_INDEX, BENCHMARK_MENU, DEFAULT_BENCHMARK_NAME } from './mockBenchmarks';
import { buildMockSummary } from './mockSummary';

// Thin async wrappers so a real backend can be dropped in later without
// touching any callers.

export async function loadBenchmarkMenu(): Promise<MenuEntry[]> {
	return BENCHMARK_MENU;
}

export async function loadBenchmark(name: string): Promise<Benchmark> {
	const benchmark = BENCHMARK_INDEX[name];
	if (!benchmark) throw new Error(`Unknown benchmark: ${name}`);
	return benchmark;
}

export async function loadSummary(benchmarkName: string): Promise<BenchmarkSummary> {
	return buildMockSummary(benchmarkName);
}

export { DEFAULT_BENCHMARK_NAME };
