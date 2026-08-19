/**
 * Bootstrap rank intervals for the Borda leaderboard ordering.
 *
 * The rank a model gets is a function of which tasks are in the benchmark. Swap
 * the task set for another draw of comparable tasks and the ordering moves. This
 * module measures how much, by resampling the visible tasks with replacement,
 * recomputing Borda points over each draw, and collecting the rank distribution
 * per model.
 *
 * What it is not: it does not resample *within* a task (seeds, prompts, test
 * items). That source of noise is real but far smaller here — task choice
 * dominates it — and resampling within a task alone would report a much tighter
 * interval than the ordering actually supports.
 *
 * Everything is deterministic given the inputs: the PRNG is seeded, so the same
 * filter state always yields the same interval. An interval that jittered on
 * every re-render would read as a bug, not as uncertainty.
 */

/** Borda points a model scored on one task, laid out per (task, model). */
type PointsMatrix = Float64Array;

export interface RankInterval {
	/** Rank in the observed ordering, 1-based — what the table already shows. */
	rank: number;
	/** Best plausible rank (numerically smallest) at the requested level. */
	lower: number;
	/** Worst plausible rank (numerically largest) at the requested level. */
	upper: number;
	/**
	 * Arena-style upper-bound rank: 1 + the number of models that are better
	 * beyond this interval, i.e. whose whole interval sits above this one.
	 * Models sharing a `rankUb` are not separated by the task sample.
	 */
	rankUb: number;
}

export interface RankCiModel {
	name: string;
	/**
	 * Value used to break Borda ties in the production sort (mean over tasks).
	 * Kept as an input rather than recomputed so the bootstrap orders models
	 * exactly the way the table does.
	 */
	tieBreak: number;
}

export interface RankCiInput {
	/** Task names currently visible, in any order. */
	taskNames: readonly string[];
	/** Per task, the models sorted by score descending — as `narrowTasks` builds it. */
	sortedByTask: ReadonlyMap<string, readonly { name: string; v: number }[]>;
	/** Models currently visible. */
	models: readonly RankCiModel[];
}

export interface RankCiOptions {
	/** Bootstrap draws. Cost is linear in this; 500 is enough to place a 95% interval. */
	resamples?: number;
	/** Interval mass, 0 < level < 1. */
	level?: number;
	/** PRNG seed. Fixed by default so the same filter state gives the same interval. */
	seed?: number;
}

const DEFAULTS = { resamples: 500, level: 0.95, seed: 0x5eed } as const;

/** mulberry32 — small, fast, and seedable; we need reproducibility, not crypto. */
function makeRng(seed: number): () => number {
	let a = seed >>> 0;
	return () => {
		a = (a + 0x6d2b79f5) >>> 0;
		let t = a;
		t = Math.imul(t ^ (t >>> 15), t | 1);
		t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
		return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
	};
}

/**
 * Borda points for the *visible* models, per task, matching the production
 * ordering rule: on each task the top visible model scores `visibleCount`, the
 * next `visibleCount - 1`, and so on. Models a task never scored get nothing
 * from it, which is what the table does too.
 */
function buildPoints(input: RankCiInput, index: Map<string, number>): PointsMatrix {
	const t = input.taskNames.length;
	const m = input.models.length;
	const points = new Float64Array(t * m);
	for (let ti = 0; ti < t; ti++) {
		const ranked = input.sortedByTask.get(input.taskNames[ti]);
		if (!ranked) continue;
		let visibleCount = 0;
		for (const r of ranked) if (index.has(r.name)) visibleCount++;
		const base = ti * m;
		let i = 0;
		for (const r of ranked) {
			const mi = index.get(r.name);
			if (mi === undefined) continue;
			points[base + mi] = visibleCount - i;
			i++;
		}
	}
	return points;
}

/**
 * Rank distribution over task resamples.
 *
 * Returns one interval per model, keyed by model name. An empty map is returned
 * when there is nothing to resample (no tasks or fewer than two models) — a
 * single model has no ordering to be uncertain about.
 */
export function bootstrapRankIntervals(
	input: RankCiInput,
	options: RankCiOptions = {}
): Map<string, RankInterval> {
	const resamples = Math.max(1, Math.trunc(options.resamples ?? DEFAULTS.resamples));
	const level = options.level ?? DEFAULTS.level;
	const seed = options.seed ?? DEFAULTS.seed;

	const out = new Map<string, RankInterval>();
	const t = input.taskNames.length;
	const m = input.models.length;
	if (t === 0 || m < 2) return out;

	const index = new Map<string, number>();
	for (let i = 0; i < m; i++) index.set(input.models[i].name, i);
	const points = buildPoints(input, index);

	// Observed ordering: the full task set, no resampling. This reproduces the
	// table's own rank, so the point estimate inside the interval is the rank
	// the reader is looking at.
	const totals = new Float64Array(m);
	for (let ti = 0; ti < t; ti++) {
		const base = ti * m;
		for (let mi = 0; mi < m; mi++) totals[mi] += points[base + mi];
	}
	const order = new Int32Array(m);
	for (let i = 0; i < m; i++) order[i] = i;
	const tieBreak = Float64Array.from(input.models, (mm) => mm.tieBreak);
	const byTotal = (a: number, b: number): number =>
		totals[b] - totals[a] || tieBreak[b] - tieBreak[a] || a - b;
	const observed = Array.from(order).sort(byTotal);
	const observedRank = new Int32Array(m);
	for (let r = 0; r < m; r++) observedRank[observed[r]] = r + 1;

	// One row of ranks per model across the draws, filled in place.
	const ranks: Int32Array[] = Array.from({ length: m }, () => new Int32Array(resamples));
	const counts = new Int32Array(t);
	const scratch = Array.from(order);
	const rng = makeRng(seed);

	for (let b = 0; b < resamples; b++) {
		counts.fill(0);
		for (let d = 0; d < t; d++) counts[(rng() * t) | 0]++;
		totals.fill(0);
		for (let ti = 0; ti < t; ti++) {
			const c = counts[ti];
			if (c === 0) continue;
			const base = ti * m;
			for (let mi = 0; mi < m; mi++) totals[mi] += c * points[base + mi];
		}
		for (let i = 0; i < m; i++) scratch[i] = i;
		scratch.sort(byTotal);
		for (let r = 0; r < m; r++) ranks[scratch[r]][b] = r + 1;
	}

	// Percentile interval. Sorting each model's own rank draws is O(B log B)
	// and B is small; a counting sort would not pay for the extra code.
	const lo = (1 - level) / 2;
	const hi = 1 - lo;
	const loIdx = Math.max(0, Math.min(resamples - 1, Math.floor(lo * (resamples - 1))));
	const hiIdx = Math.max(0, Math.min(resamples - 1, Math.ceil(hi * (resamples - 1))));
	const lowers = new Int32Array(m);
	const uppers = new Int32Array(m);
	for (let mi = 0; mi < m; mi++) {
		const row = ranks[mi];
		row.sort();
		lowers[mi] = row[loIdx];
		uppers[mi] = row[hiIdx];
	}

	// Arena-style upper-bound rank: 1 + the number of models that are better than
	// this one by more than the task sample can explain, i.e. whose interval ends
	// strictly before this one's begins. A model never counts against itself
	// because its own `upper` is never below its own `lower`. Binary search over
	// the sorted uppers keeps this O(m log m) instead of pairwise.
	const sortedUppers = Int32Array.from(uppers).sort();
	const rankUb = new Int32Array(m);
	for (let mi = 0; mi < m; mi++) {
		let lo2 = 0;
		let hi2 = m;
		while (lo2 < hi2) {
			const mid = (lo2 + hi2) >>> 1;
			if (sortedUppers[mid] < lowers[mi]) lo2 = mid + 1;
			else hi2 = mid;
		}
		rankUb[mi] = lo2 + 1;
	}

	for (let mi = 0; mi < m; mi++) {
		out.set(input.models[mi].name, {
			rank: observedRank[mi],
			lower: lowers[mi],
			upper: uppers[mi],
			rankUb: rankUb[mi]
		});
	}
	return out;
}

/** A leaderboard row, reduced to what the bootstrap needs. */
export interface RankCiRow {
	name: string;
	scoresByTask: Record<string, number>;
	tieBreak: number;
}

/**
 * Same bootstrap, fed straight from the rows a filtered view already carries.
 * Builds the per-task orderings itself, so callers do not have to reach into
 * the narrowing cache.
 */
export function rankIntervalsFromRows(
	tasks: readonly string[],
	rows: readonly RankCiRow[],
	options: RankCiOptions = {}
): Map<string, RankInterval> {
	const sortedByTask = new Map<string, { name: string; v: number }[]>();
	for (const task of tasks) {
		const ranked: { name: string; v: number }[] = [];
		for (const row of rows) {
			const v = row.scoresByTask[task];
			if (v !== undefined) ranked.push({ name: row.name, v });
		}
		// Same tie-break as the production Borda pass, so equal scores award
		// points in the same order the table used.
		ranked.sort((a, b) => b.v - a.v || (a.name < b.name ? -1 : a.name > b.name ? 1 : 0));
		sortedByTask.set(task, ranked);
	}
	return bootstrapRankIntervals(
		{
			taskNames: tasks,
			sortedByTask,
			models: rows.map((r) => ({ name: r.name, tieBreak: r.tieBreak }))
		},
		options
	);
}

// Single-slot memo: a reader looks at one filter state at a time, and the
// bootstrap is the expensive part of rendering the rank column. Keyed by the
// visible task and model sets, so a name-search keystroke that changes neither
// reuses the previous result.
let _memoKey = '';
let _memoValue = new Map<string, RankInterval>();

export function rankIntervalsCached(
	tasks: readonly string[],
	rows: readonly RankCiRow[],
	options: RankCiOptions = {}
): Map<string, RankInterval> {
	const key = `${options.resamples ?? DEFAULTS.resamples}§${options.level ?? DEFAULTS.level}§${tasks.length}§${tasks.join(',')}§${rows.map((r) => r.name).join(',')}`;
	if (key === _memoKey) return _memoValue;
	_memoKey = key;
	_memoValue = rankIntervalsFromRows(tasks, rows, options);
	return _memoValue;
}
