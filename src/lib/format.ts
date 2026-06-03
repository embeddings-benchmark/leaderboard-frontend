import { env } from '$env/dynamic/public';

/**
 * Insert a space before each new capitalized word so CamelCase task type
 * identifiers read naturally in the UI. The backend canonicalises these to
 * CamelCase ("BitextMining") so per-type column keys line up with
 * `tasksMeta[].type` across filter / table / chart code; this is the one
 * place that humanises the same string for display.
 *
 * Examples:
 *   "BitextMining"          -> "Bitext Mining"
 *   "InstructionReranking"  -> "Instruction Reranking"
 *   "STS"                   -> "STS"
 *   "Classification"        -> "Classification"
 */
export function humanizeType(s: string): string {
	return s.replace(/([a-z0-9])([A-Z])/g, '$1 $2');
}

/**
 * Resolve an API-relative URL (one starting with "/") against PUBLIC_API_URL.
 * Absolute URLs and empty/null inputs pass through unchanged. Used so the
 * backend can serve cache-friendly proxy paths (e.g. /icon/<name>) without
 * the frontend having to know the API origin at every consumer.
 */
export function apiUrl(path: string | null | undefined): string | undefined {
	if (!path) return undefined;
	if (/^https?:\/\//i.test(path)) return path;
	const base = env.PUBLIC_API_URL?.trim().replace(/\/$/, '') ?? '';
	if (!base) return path; // offline build — return as-is, will 404 but harmlessly
	return `${base}${path.startsWith('/') ? path : '/' + path}`;
}

/**
 * A benchmark icon may be a URL (flag SVG, hosted PNG, our /icon proxy path)
 * or short text/emoji ("🌍"). URLs get rendered as <img>; everything else
 * is rendered as text in the consumer's UI.
 */
export function isIconUrl(icon: string | null | undefined): boolean {
	if (!icon) return false;
	return icon.startsWith('/') || /^(https?:|data:)/i.test(icon);
}

/**
 * URL-safe form of a benchmark / model / task name for use in route paths
 * (e.g. ``/models/{slug(name)}``). Benchmark names contain parens, commas,
 * and spaces — ``encodeURIComponent`` covers them all. Identical helper
 * was inlined in 7 components before this was extracted.
 */
export function slug(name: string): string {
	return encodeURIComponent(name);
}

/** Tabular integer with locale grouping, em-dash for falsy values. */
export function fmtInt(n: number | null | undefined): string {
	return n ? n.toLocaleString() : '—';
}

/**
 * Compact integer formatting for dense UI strips: 1234 → "1.2k", 1000000 → "1M".
 * Falsy values render as ``'0'`` (callers usually guard with a length check
 * before showing the stat at all). Used by the benchmark cards' stats-line
 * so massive multilingual benchmarks (1000+ languages, 300+ models) still
 * fit on one row without forcing the layout to wrap.
 */
const COMPACT_FMT = new Intl.NumberFormat('en', { notation: 'compact', maximumFractionDigits: 1 });
export function fmtCompact(n: number | null | undefined): string {
	if (!n) return '0';
	if (n < 1000) return n.toString();
	return COMPACT_FMT.format(n);
}

/**
 * Split a parameter count (in billions) into a value + unit pair, so
 * tables can right-align the number and left-align the unit. ``0`` →
 * ``("—", "")``; ``≥1`` keeps billions; ``<1`` switches to millions.
 */
export function fmtParamsValue(b: number): string {
	if (b === 0) return '—';
	if (b >= 1) return b.toFixed(1);
	return (b * 1000).toFixed(0);
}
export function fmtParamsUnit(b: number): string {
	if (b === 0) return '';
	return b >= 1 ? 'B' : 'M';
}

/** Direction of a sortable column. */
export type SortDir = 'asc' | 'desc';

/**
 * Glyph shown in a sortable column header. ``↑`` / ``↓`` when active,
 * ``inactiveGlyph`` (default ``↕``, SummaryTable uses ``''``) otherwise.
 */
export function sortIcon<K extends string>(
	key: K,
	activeKey: K | null,
	dir: SortDir,
	inactiveGlyph = '↕'
): string {
	if (activeKey !== key) return inactiveGlyph;
	return dir === 'asc' ? '↑' : '↓';
}

/** `aria-sort` value for a sortable `<th>` — active column gets the live direction. */
export function ariaSort<K extends string>(
	key: K,
	activeKey: K | null,
	dir: SortDir
): 'ascending' | 'descending' | 'none' {
	if (activeKey !== key) return 'none';
	return dir === 'asc' ? 'ascending' : 'descending';
}

/**
 * Score formatted as a 2-decimal percentage (``0.7613`` → ``"76.13"``).
 * ``null``/``undefined`` becomes ``"—"`` so cells with missing data
 * render as a clear placeholder instead of ``"NaN"``.
 */
export function fmtPct(score: number | null | undefined): string {
	if (score == null) return '—';
	return (score * 100).toFixed(2);
}

/** Real value vs the em-dash / NA placeholder used by ``fmtPct``/``fmtInt``. */
export function hasValue(s: string): boolean {
	return s !== '—' && s !== '⚠️ NA';
}

/**
 * Heat-shading background for a score cell, normalised against the
 * column's own [min, max] range. The strongest cell in a column gets
 * ~55 % primary tint; the weakest gets 0 %. Mapping from min instead
 * of an absolute zero amplifies the difference inside columns where
 * every score clusters tightly (e.g. all between 0.70 and 0.78) —
 * before this change those columns rendered as one near-uniform
 * shade. Pass both bounds; ``null``/``undefined`` score, a non-finite
 * bound, or a degenerate range (max ≤ min, e.g. one row in the
 * column) all yield an empty string (no inline style).
 */
// Pre-cached background strings. ~1500 cells per SummaryTable render share
// 56 distinct percentages, so a lookup beats a fresh template literal +
// `color-mix()` resolution per cell. Inline `background-color` keeps
// specificity above the `:nth-child(even)` row-stripe rule the way a
// per-cell inline style always has.
const HEAT_STYLE_CACHE: string[] = Array.from(
	{ length: 56 },
	(_, i) => `background-color: color-mix(in srgb, var(--heat) ${i}%, transparent);`
);

export function heat(score: number | null | undefined, min: number, max: number): string {
	if (score == null) return '';
	if (!Number.isFinite(min) || !Number.isFinite(max)) return '';
	if (max <= min) return '';
	const ratio = Math.max(0, Math.min(1, (score - min) / (max - min)));
	const pct = Math.round(ratio * 55);
	if (pct === 0) return '';
	return HEAT_STYLE_CACHE[pct];
}

/**
 * Default sort direction for a column. Names / ranks read more
 * naturally ascending (A→Z, 1→N); numeric score columns read better
 * descending (best first). Pass the list of keys that should default
 * to ``'asc'``; everything else defaults to ``'desc'``.
 */
export function defaultDirFor<K extends string>(key: K, ascKeys: readonly K[]): SortDir {
	return ascKeys.includes(key) ? 'asc' : 'desc';
}

/**
 * Max numeric value in an array that may include ``null`` / ``undefined``.
 * Returns ``0`` when no numbers are present so the result is safe to
 * use as a denominator (the matching ``heat`` helper short-circuits on
 * non-positive max).
 */
export function maxOf(vs: readonly (number | null | undefined)[]): number {
	const nums = vs.filter((v): v is number => typeof v === 'number');
	return nums.length === 0 ? 0 : Math.max(...nums);
}

/**
 * Min numeric value in an array that may include ``null`` / ``undefined``.
 * Returns ``0`` when no numbers are present. The matching ``heat``
 * helper short-circuits when min ≥ max, so degenerate inputs render
 * as un-tinted cells.
 */
export function minOf(vs: readonly (number | null | undefined)[]): number {
	const nums = vs.filter((v): v is number => typeof v === 'number');
	return nums.length === 0 ? 0 : Math.min(...nums);
}

/**
 * For every key in ``keys``, the max value across ``rows`` looked up
 * via ``getValue``. Used by leaderboard tables to highlight the
 * best-in-column score (per task, per task-type, per language).
 * Missing values (``undefined``) are skipped; if a column has no
 * values at all the result entry is ``-Infinity``.
 */
export function bestPerColumn<R, K extends string>(
	keys: readonly K[],
	rows: readonly R[],
	getValue: (row: R, key: K) => number | undefined
): Record<string, number> {
	const best: Record<string, number> = {};
	for (const k of keys) {
		let max = -Infinity;
		for (const r of rows) {
			const v = getValue(r, k);
			if (v !== undefined && v > max) max = v;
		}
		best[k] = max;
	}
	return best;
}

/**
 * Mirror of ``bestPerColumn`` for the *worst* value in each column.
 * Used as the lower bound when computing heat-shading against the
 * column's own [min, max] range. Empty columns yield ``+Infinity``.
 */
export function worstPerColumn<R, K extends string>(
	keys: readonly K[],
	rows: readonly R[],
	getValue: (row: R, key: K) => number | undefined
): Record<string, number> {
	const worst: Record<string, number> = {};
	for (const k of keys) {
		let min = Infinity;
		for (const r of rows) {
			const v = getValue(r, k);
			if (v !== undefined && v < min) min = v;
		}
		worst[k] = min;
	}
	return worst;
}

/**
 * Three-state sort click handler used by every leaderboard table.
 *  1. New column → activate, use ``defaultDir(key)``.
 *  2. Same column, still at the default direction → flip.
 *  3. Same column, already flipped → clear (return null key).
 *
 * Returns the next ``{ key, dir }`` instead of mutating, so callers
 * stay in control of the reactive ``$state`` writes.
 */
export function nextSort<K extends string>(
	clickedKey: K,
	currentKey: K | null,
	currentDir: SortDir,
	defaultDir: (k: K) => SortDir
): { key: K | null; dir: SortDir } {
	if (currentKey !== clickedKey) {
		return { key: clickedKey, dir: defaultDir(clickedKey) };
	}
	if (currentDir === defaultDir(clickedKey)) {
		return { key: clickedKey, dir: currentDir === 'asc' ? 'desc' : 'asc' };
	}
	return { key: null, dir: currentDir };
}
