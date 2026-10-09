import type { SummaryRow } from '$lib/types';
import { rowId } from '$lib/format';

/**
 * Bradley-Terry ("ELO") rating of benchmark rows from per-task scores.
 *
 * Mirrors `mteb/api/bradley_terry.py` (the API computes it for the full task
 * set; this recomputes it when sidebar filters narrow the tasks or models).
 * Keep the two in sync:
 *  - each task is a head-to-head round between every pair of rows: the higher
 *    score wins, equal scores tie (0.5 each);
 *  - a row with a score beats one without (an unevaluated task is a loss, so
 *    skipping tasks never inflates a rating); two rows that both lack a score
 *    are not compared;
 *  - wins are summed over tasks and a Bradley-Terry model is fit with MM
 *    iterations (plus a 0.5 pseudo-win per ordered pair to keep undefeated rows
 *    finite), then mapped to `1000 + 400/ln(10) * logStrength`.
 *
 * No bootstrap here — the interval (`low` / `high`) only comes from the API.
 */

export const ELO_BASE = 1000;
export const ELO_SCALE = 400 / Math.LN10;
const PSEUDO_WINS = 0.5;
const MAX_ITER = 200;
const TOL = 1e-9;

export interface EloResult {
	elo: number;
	low?: number | null;
	high?: number | null;
}

/** `scores[i][task]` is `undefined` (or NaN) when row i wasn't evaluated. */
type TaskScores = Record<string, number | undefined>;

function valueOf(row: TaskScores, task: string): number | null {
	const v = row[task];
	return v === undefined || v === null || Number.isNaN(v) ? null : v;
}

/** Row-major `n × n` win matrix summed over `tasks`. */
function winMatrix(scores: readonly TaskScores[], tasks: readonly string[]): Float64Array {
	const n = scores.length;
	const wins = new Float64Array(n * n);
	for (const task of tasks) {
		const col = scores.map((r) => valueOf(r, task));
		for (let i = 0; i < n; i++) {
			const a = col[i];
			for (let j = 0; j < n; j++) {
				if (i === j) continue;
				const b = col[j];
				if (a === null) continue; // i missing: loses (or both missing: skipped)
				if (b === null || a > b) wins[i * n + j] += 1;
				else if (a === b) wins[i * n + j] += 0.5;
			}
		}
	}
	return wins;
}

/** Mean-centered Bradley-Terry log-strengths from a row-major win matrix. */
function fit(wins: Float64Array, n: number): Float64Array {
	const w = new Float64Array(n * n);
	const totalWins = new Float64Array(n);
	for (let i = 0; i < n; i++) {
		for (let j = 0; j < n; j++) {
			if (i === j) continue;
			const v = wins[i * n + j] + PSEUDO_WINS;
			w[i * n + j] = v;
			totalWins[i] += v;
		}
	}
	let p = new Float64Array(n).fill(1);
	for (let iter = 0; iter < MAX_ITER; iter++) {
		const next = new Float64Array(n);
		for (let i = 0; i < n; i++) {
			let denom = 0;
			for (let j = 0; j < n; j++) {
				if (i === j) continue;
				denom += (w[i * n + j] + w[j * n + i]) / (p[i] + p[j]);
			}
			next[i] = totalWins[i] / denom;
		}
		let meanLog = 0;
		for (let i = 0; i < n; i++) meanLog += Math.log(next[i]);
		meanLog /= n;
		const scale = Math.exp(meanLog);
		let delta = 0;
		for (let i = 0; i < n; i++) {
			next[i] /= scale;
			delta = Math.max(delta, Math.abs(Math.log(next[i]) - Math.log(p[i])));
		}
		p = next;
		if (delta < TOL) break;
	}
	const logs = new Float64Array(n);
	let mean = 0;
	for (let i = 0; i < n; i++) {
		logs[i] = Math.log(p[i]);
		mean += logs[i];
	}
	mean /= n;
	for (let i = 0; i < n; i++) logs[i] -= mean;
	return logs;
}

/**
 * Rate `rows` over `tasks`. Keyed by `rowId` so experiment variants are
 * rated separately from the base model. Empty with fewer than two rows or no
 * tasks.
 */
export function computeElo(
	rows: readonly SummaryRow[],
	tasks: readonly string[]
): Map<string, EloResult> {
	const out = new Map<string, EloResult>();
	const uniqueTasks = [...new Set(tasks)];
	if (rows.length < 2 || uniqueTasks.length === 0) return out;
	const n = rows.length;
	const logs = fit(
		winMatrix(
			rows.map((r) => r.scoresByTask),
			uniqueTasks
		),
		n
	);
	for (let i = 0; i < n; i++) out.set(rowId(rows[i]), { elo: ELO_BASE + ELO_SCALE * logs[i] });
	return out;
}
