import { describe, expect, it } from 'vitest';
import type { ModelMeta, SummaryRow } from '$lib/types';
import { computeElo, ELO_BASE } from './elo';

function row(name: string, scoresByTask: Record<string, number>): SummaryRow {
	const model: ModelMeta = {
		name,
		displayName: name,
		org: '',
		zeroShotPct: 100,
		activeParamsB: 1,
		totalParamsB: 1,
		embeddingDim: 768,
		maxTokens: 512,
		modelType: 'dense',
		instructionTuned: false,
		openWeights: true,
		sentenceTransformersCompatible: true
	};
	return {
		rank: 1,
		model,
		zeroShotPct: 100,
		activeParamsB: 1,
		totalParamsB: 1,
		embeddingDim: 768,
		maxTokens: 512,
		meanTask: null,
		meanTaskType: null,
		scoresByTask,
		scoresByTaskType: {}
	};
}

const TASKS = ['t1', 't2', 't3', 't4'];

describe('computeElo', () => {
	it('matches the Python implementation (mteb/api/bradley_terry.py)', () => {
		const rows = [
			row('a', { t1: 3, t2: 1, t3: 2, t4: 5 }),
			row('b', { t1: 2, t2: 3, t3: 1 }),
			row('c', { t1: 1, t2: 2, t3: 3, t4: 1 }),
			row('d', { t1: 2 })
		];
		const res = computeElo(rows, TASKS);
		expect(res.get('a')!.elo).toBeCloseTo(1118.276819, 3);
		expect(res.get('b')!.elo).toBeCloseTo(1011.120258, 3);
		expect(res.get('c')!.elo).toBeCloseTo(1039.965673, 3);
		expect(res.get('d')!.elo).toBeCloseTo(830.63725, 3);
	});

	it('orders strictly dominant rows and centers on the base', () => {
		const res = computeElo(
			[row('a', { t1: 3, t2: 3 }), row('b', { t1: 2, t2: 2 }), row('c', { t1: 1, t2: 1 })],
			['t1', 't2']
		);
		expect(res.get('a')!.elo).toBeGreaterThan(res.get('b')!.elo);
		expect(res.get('b')!.elo).toBeGreaterThan(res.get('c')!.elo);
		const mean = [...res.values()].reduce((s, r) => s + r.elo, 0) / 3;
		expect(mean).toBeCloseTo(ELO_BASE, 6);
	});

	it('does not reward skipping tasks', () => {
		const res = computeElo(
			[
				row('strong', { t1: 1, t2: 1 }),
				row('weak', { t1: 0.1, t2: 0.1 }),
				row('cherry', { t1: 2 })
			],
			['t1', 't2']
		);
		expect(res.get('cherry')!.elo).toBeLessThan(res.get('strong')!.elo);
	});

	it('is invariant to monotone rescaling of a task', () => {
		const mk = (f: (x: number) => number) => [
			row('a', { t1: 0.2, t2: f(70) }),
			row('b', { t1: 0.4, t2: f(60) }),
			row('c', { t1: 0.3, t2: f(65) })
		];
		const r1 = computeElo(
			mk((x) => x),
			['t1', 't2']
		);
		const r2 = computeElo(
			mk((x) => Math.log(x) * 100),
			['t1', 't2']
		);
		for (const k of ['a', 'b', 'c']) expect(r1.get(k)!.elo).toBeCloseTo(r2.get(k)!.elo, 6);
	});

	it('returns nothing for degenerate input', () => {
		expect(computeElo([row('a', { t1: 1 })], TASKS).size).toBe(0);
		expect(computeElo([row('a', { t1: 1 }), row('b', { t1: 2 })], []).size).toBe(0);
	});
});
