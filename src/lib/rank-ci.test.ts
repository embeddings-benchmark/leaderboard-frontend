import { describe, expect, it } from 'vitest';
import { bootstrapRankIntervals, type RankCiInput } from './rank-ci';

// ---------------------------------------------------------------------------
// Fixture builder. `scores[model][task]` reads like the leaderboard grid; the
// helper flips it into the per-task sorted lists `narrowTasks` hands over.
// ---------------------------------------------------------------------------

function makeInput(scores: Record<string, Record<string, number>>): RankCiInput {
	const modelNames = Object.keys(scores);
	const taskNames = [...new Set(modelNames.flatMap((m) => Object.keys(scores[m])))];
	const sortedByTask = new Map<string, { name: string; v: number }[]>();
	for (const task of taskNames) {
		const ranked = modelNames
			.filter((m) => scores[m][task] !== undefined)
			.map((m) => ({ name: m, v: scores[m][task] }));
		ranked.sort((a, b) => b.v - a.v || (a.name < b.name ? -1 : a.name > b.name ? 1 : 0));
		sortedByTask.set(task, ranked);
	}
	const models = modelNames.map((name) => {
		const xs = Object.values(scores[name]);
		return { name, tieBreak: xs.reduce((a, b) => a + b, 0) / (xs.length || 1) };
	});
	return { taskNames, sortedByTask, models };
}

/** Four tasks, one model ahead on every single one. */
const DOMINANT = makeInput({
	best: { t1: 0.9, t2: 0.9, t3: 0.9, t4: 0.9 },
	mid: { t1: 0.5, t2: 0.5, t3: 0.5, t4: 0.5 },
	worst: { t1: 0.1, t2: 0.1, t3: 0.1, t4: 0.1 }
});

/** Two models that trade wins task by task — the ordering is a coin flip. */
const COIN_FLIP = makeInput({
	a: { t1: 0.9, t2: 0.1, t3: 0.9, t4: 0.1 },
	b: { t1: 0.1, t2: 0.9, t3: 0.1, t4: 0.9 }
});

describe('bootstrapRankIntervals', () => {
	it('is deterministic for a given input', () => {
		const one = bootstrapRankIntervals(DOMINANT);
		const two = bootstrapRankIntervals(DOMINANT);
		expect([...two.entries()]).toEqual([...one.entries()]);
	});

	it('reports the observed Borda rank as the point estimate', () => {
		const out = bootstrapRankIntervals(DOMINANT);
		expect(out.get('best')?.rank).toBe(1);
		expect(out.get('mid')?.rank).toBe(2);
		expect(out.get('worst')?.rank).toBe(3);
	});

	it('pins a model that wins every task to a degenerate interval', () => {
		const out = bootstrapRankIntervals(DOMINANT);
		const best = out.get('best');
		// No resample of these tasks can dislodge it, so there is nothing to widen.
		expect(best).toMatchObject({ lower: 1, upper: 1, rankUb: 1 });
	});

	it('leaves models that trade wins unseparated', () => {
		const out = bootstrapRankIntervals(COIN_FLIP);
		const a = out.get('a');
		const b = out.get('b');
		expect(a!.upper).toBeGreaterThan(a!.lower);
		expect(b!.upper).toBeGreaterThan(b!.lower);
		// Neither is better than the other beyond the task sample.
		expect(a!.rankUb).toBe(1);
		expect(b!.rankUb).toBe(1);
	});

	it('brackets the observed rank', () => {
		const out = bootstrapRankIntervals(
			makeInput({
				m1: { t1: 0.91, t2: 0.72, t3: 0.65, t4: 0.88, t5: 0.4 },
				m2: { t1: 0.9, t2: 0.75, t3: 0.6, t4: 0.85, t5: 0.45 },
				m3: { t1: 0.5, t2: 0.55, t3: 0.52, t4: 0.49, t5: 0.51 },
				m4: { t1: 0.2, t2: 0.25, t3: 0.18, t4: 0.3, t5: 0.22 }
			})
		);
		for (const iv of out.values()) {
			expect(iv.lower).toBeLessThanOrEqual(iv.rank);
			expect(iv.upper).toBeGreaterThanOrEqual(iv.rank);
			expect(iv.rankUb).toBeLessThanOrEqual(iv.rank);
		}
	});

	it('separates models that a wider interval would merge', () => {
		const out = bootstrapRankIntervals(
			makeInput({
				top: { t1: 0.99, t2: 0.98, t3: 0.99, t4: 0.97, t5: 0.98 },
				bottom: { t1: 0.1, t2: 0.12, t3: 0.09, t4: 0.11, t5: 0.1 }
			})
		);
		// A gap this wide survives every resample, so the loser's UB rank is 2.
		expect(out.get('bottom')?.rankUb).toBe(2);
	});

	it('tolerates a ragged panel where a model is missing tasks', () => {
		const out = bootstrapRankIntervals(
			makeInput({
				full: { t1: 0.8, t2: 0.8, t3: 0.8 },
				partial: { t1: 0.9 },
				other: { t1: 0.4, t2: 0.4, t3: 0.4 }
			})
		);
		expect(out.size).toBe(3);
		// Scoring one task out of three cannot out-Borda a model that scored all
		// three, which is the behaviour the table already has.
		expect(out.get('partial')!.rank).toBeGreaterThan(out.get('full')!.rank);
	});

	it('returns nothing to draw when there is no ordering', () => {
		expect(bootstrapRankIntervals(makeInput({ solo: { t1: 0.5 } })).size).toBe(0);
		expect(
			bootstrapRankIntervals({ taskNames: [], sortedByTask: new Map(), models: [] }).size
		).toBe(0);
	});

	it('widens the interval as the level rises', () => {
		const input = makeInput({
			a: { t1: 0.9, t2: 0.6, t3: 0.8, t4: 0.55, t5: 0.7, t6: 0.62 },
			b: { t1: 0.85, t2: 0.65, t3: 0.75, t4: 0.6, t5: 0.68, t6: 0.66 },
			c: { t1: 0.4, t2: 0.45, t3: 0.42, t4: 0.38, t5: 0.44, t6: 0.41 }
		});
		const narrow = bootstrapRankIntervals(input, { level: 0.5, resamples: 2000 });
		const wide = bootstrapRankIntervals(input, { level: 0.99, resamples: 2000 });
		const span = (n: string, m: Map<string, { lower: number; upper: number }>) =>
			m.get(n)!.upper - m.get(n)!.lower;
		expect(span('a', wide)).toBeGreaterThanOrEqual(span('a', narrow));
	});

	it('honours the seed', () => {
		const input = makeInput({
			a: { t1: 0.9, t2: 0.6, t3: 0.8, t4: 0.55 },
			b: { t1: 0.85, t2: 0.65, t3: 0.75, t4: 0.6 }
		});
		const one = bootstrapRankIntervals(input, { seed: 1, resamples: 200 });
		const two = bootstrapRankIntervals(input, { seed: 2, resamples: 200 });
		expect(one.get('a')!.rank).toBe(two.get('a')!.rank);
	});
});
