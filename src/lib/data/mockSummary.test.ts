import { describe, expect, it } from 'vitest';
import { buildMockSummary } from './mockSummary';
import { BENCHMARK_INDEX, DEFAULT_BENCHMARK_NAME } from './mockBenchmarks';

describe('buildMockSummary', () => {
	it('is deterministic — same input always yields the same output', () => {
		const a = buildMockSummary(DEFAULT_BENCHMARK_NAME);
		const b = buildMockSummary(DEFAULT_BENCHMARK_NAME);
		// Deep structural equality; the seeded hash should produce byte-identical
		// scores for the same benchmark name across calls.
		expect(a).toEqual(b);
	});

	it('different benchmark names produce different score distributions', () => {
		const names = Object.keys(BENCHMARK_INDEX);
		// At least two benchmarks are needed to compare; if the mock catalogue
		// ever shrinks below that, skip the test rather than fake it.
		if (names.length < 2) return;
		const [n1, n2] = names;
		const s1 = buildMockSummary(n1);
		const s2 = buildMockSummary(n2);
		const firstScore = (s: ReturnType<typeof buildMockSummary>) =>
			s.rows[0].scoresByTask[s.tasks[0]] ?? null;
		expect(firstScore(s1)).not.toBe(firstScore(s2));
	});

	it('ranks are dense 1..N after sort', () => {
		const s = buildMockSummary(DEFAULT_BENCHMARK_NAME);
		const ranks = s.rows.map((r) => r.rank);
		expect(ranks).toEqual(Array.from({ length: s.rows.length }, (_, i) => i + 1));
	});

	it('mirrors the benchmark catalogue for taskTypes / tasks / aggregations', () => {
		const s = buildMockSummary(DEFAULT_BENCHMARK_NAME);
		const catalog = BENCHMARK_INDEX[DEFAULT_BENCHMARK_NAME];
		expect(s.taskTypes).toEqual(catalog.taskTypes);
		expect(s.tasks).toEqual(catalog.tasks);
		expect(s.aggregations).toContain('mean_task');
	});

	it('unknown benchmark name falls back to a safe default shape', () => {
		const s = buildMockSummary('not-a-real-benchmark');
		expect(s.benchmarkName).toBe('not-a-real-benchmark');
		// Default taskTypes per the fallback branch in buildMockSummary.
		expect(s.taskTypes).toEqual(['Classification', 'Retrieval', 'STS']);
		expect(Array.isArray(s.rows)).toBe(true);
	});
});
