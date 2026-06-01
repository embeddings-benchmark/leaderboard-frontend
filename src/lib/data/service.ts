import { env } from '$env/dynamic/public';
import type { Benchmark, BenchmarkSummary, MenuEntry } from '$lib/types';
import { BENCHMARK_INDEX, BENCHMARK_MENU, DEFAULT_BENCHMARK_NAME } from './mockBenchmarks';
import { buildMockSummary } from './mockSummary';

// When PUBLIC_API_URL is empty (e.g. the offline GitHub Pages build), fall
// through to the deterministic mocks so the site still works without a server.
// We use `$env/dynamic/public` (not static) so the import doesn't fail at
// build time when the env var is unset.
const API = env.PUBLIC_API_URL?.trim() ?? '';

async function http<T>(path: string): Promise<T> {
	const res = await fetch(`${API}${path}`);
	if (!res.ok) throw new Error(`${res.status} ${res.statusText} — ${path}`);
	return (await res.json()) as T;
}

export async function loadBenchmarkMenu(): Promise<MenuEntry[]> {
	if (!API) return BENCHMARK_MENU;
	return http<MenuEntry[]>('/benchmarks/menu');
}

export async function loadBenchmark(name: string): Promise<Benchmark> {
	if (!API) {
		const benchmark = BENCHMARK_INDEX[name];
		if (!benchmark) throw new Error(`Unknown benchmark: ${name}`);
		return benchmark;
	}
	return http<Benchmark>(`/benchmarks/${encodeURIComponent(name)}`);
}

export async function loadSummary(benchmarkName: string): Promise<BenchmarkSummary> {
	if (!API) return buildMockSummary(benchmarkName);
	return http<BenchmarkSummary>(`/benchmarks/${encodeURIComponent(benchmarkName)}/summary`);
}

export { DEFAULT_BENCHMARK_NAME };
