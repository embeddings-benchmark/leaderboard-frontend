import { untrack } from 'svelte';
import { SvelteSet } from 'svelte/reactivity';

import type { BenchmarkSummary, ModelType, SummaryRow, TaskMeta } from '$lib/types';
import { modelSearchKey } from '$lib/format';
import { decodeSet, encodeSet, readParams, updateUrl } from '$lib/url-state';

export type ZeroShotMode = 'allow_all' | 'remove_unknown' | 'only_zero_shot';
export type Availability = 'both' | 'open' | 'proprietary';
export type InstructionMode = 'both' | 'only_instruction' | 'only_non_instruction';

// Model-size slider works in log10 of millions of params: 0 → 1M, 6 → 1T.
export const SIZE_LOG_MIN = 0;
export const SIZE_LOG_MAX = 6;
export const SIZE_MIN_M = 1; // 1M
export const SIZE_MAX_M = 1_000_000; // 1T in millions

export const MODEL_TYPES: ModelType[] = [
	'dense',
	'cross-encoder',
	'late-interaction',
	'sparse',
	'router'
];

export const MODEL_MODALITIES = ['text', 'image', 'audio', 'video'] as const;
export type ModelModality = (typeof MODEL_MODALITIES)[number];

// Shared default for models whose `modalities` field is missing — avoids
// allocating a fresh `['text']` array per row in the hot filter pass.
const TEXT_ONLY: readonly string[] = ['text'];

interface FiltersState {
	// model filters
	nameQuery: string;
	minModelSizeM: number;
	maxModelSizeM: number;
	// `false` until the user actually moves the slider. While inactive the
	// size filter is a no-op (all rows pass, including proprietary models
	// with unknown size). Once flipped on, the filter applies AND drops
	// unsized models — see applyFilters.
	sizeActive: boolean;
	zeroShot: ZeroShotMode;
	availability: Availability;
	instructions: InstructionMode;
	sentenceTransformersOnly: boolean;
	modelTypes: SvelteSet<string>;
	modelModalities: SvelteSet<string>;
	// customize-benchmark filters
	taskTypes: SvelteSet<string>;
	domains: SvelteSet<string>;
	modalities: SvelteSet<string>;
	languages: SvelteSet<string>;
	tasks: SvelteSet<string>;
	// available choices (per benchmark)
	availableTaskTypes: string[];
	availableDomains: string[];
	availableModalities: string[];
	availableLanguages: string[];
	availableTasks: TaskMeta[];
	// Size slider bounds derived from the loaded summary. Fall back to the
	// global SIZE_MIN_M / SIZE_MAX_M when no benchmark is loaded.
	availableMinModelSizeM: number;
	availableMaxModelSizeM: number;
}

function defaultState(): FiltersState {
	return {
		nameQuery: '',
		minModelSizeM: SIZE_MIN_M,
		maxModelSizeM: SIZE_MAX_M,
		sizeActive: false,
		zeroShot: 'allow_all',
		availability: 'both',
		instructions: 'both',
		sentenceTransformersOnly: false,
		modelTypes: new SvelteSet<string>(MODEL_TYPES),
		modelModalities: new SvelteSet<string>(MODEL_MODALITIES),
		taskTypes: new SvelteSet(),
		domains: new SvelteSet(),
		modalities: new SvelteSet(),
		languages: new SvelteSet(),
		tasks: new SvelteSet(),
		availableTaskTypes: [],
		availableDomains: [],
		availableModalities: [],
		availableLanguages: [],
		availableTasks: [],
		availableMinModelSizeM: SIZE_MIN_M,
		availableMaxModelSizeM: SIZE_MAX_M
	};
}

function createFilters() {
	const state = $state<FiltersState>(defaultState());
	// Track the benchmark whose available-* + picks we've already seeded.
	// Subsequent `initFor` calls for the SAME benchmark (e.g. a
	// language-scoped summary refetch) refresh the available-* lists
	// without clobbering the user's current pick state — otherwise
	// unchecking a language would trigger a refetch, the new summary
	// would land, `initFor` would reset the language picks to "all",
	// which would trigger another refetch back to unfiltered.
	let lastBenchmarkName: string | null = null;

	function initFor(summary: BenchmarkSummary | null) {
		if (!summary) return;
		const isNewBenchmark = lastBenchmarkName !== summary.benchmarkName;
		lastBenchmarkName = summary.benchmarkName;

		// Local accumulators — not held by $state, so plain Set is correct.
		// Languages come from `tasksMeta[i].languages` which the backend
		// emits in benchmark-scoped form via `scoped_task_meta_schema`
		// (so a task pinned to `languages=['eng']` doesn't leak its full
		// class-level union into the per-benchmark filter sidebar).
		/* eslint-disable svelte/prefer-svelte-reactivity */
		const domains = new Set<string>();
		const modalities = new Set<string>();
		// Count per language so the filter pills sort by popularity.
		const languageCount = new Map<string, number>();
		/* eslint-enable svelte/prefer-svelte-reactivity */
		for (const t of summary.tasksMeta) {
			for (const d of t.domains ?? []) domains.add(d);
			for (const m of t.modalities ?? []) modalities.add(m);
			for (const l of t.languages ?? []) languageCount.set(l, (languageCount.get(l) ?? 0) + 1);
		}
		const sortedDomains = [...domains].sort();
		const sortedModalities = [...modalities].sort();
		const sortedLanguages = [...languageCount.entries()]
			.sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0]))
			.map(([l]) => l);

		// Bracket the size slider to this benchmark's actual models. We ignore
		// proprietary/unknown-size models (totalParamsB === 0) when computing
		// the bounds — they pass the size filter anyway. If no model has a
		// known size, fall back to the global defaults so the slider is still
		// usable.
		let lowM = Number.POSITIVE_INFINITY;
		let highM = 0;
		for (const row of summary.rows) {
			const b = row.model.totalParamsB;
			if (!b) continue;
			const m = b * 1000;
			if (m < lowM) lowM = m;
			if (m > highM) highM = m;
		}
		const hasSizes = highM > 0 && lowM !== Number.POSITIVE_INFINITY;
		// Round outward to a 1-significant-figure value so the slider edges
		// land on "nice" numbers (e.g. 100M rather than 109M, 10B rather
		// than 9.24B). This keeps the visible tick labels readable.
		const niceLow = hasSizes ? Math.max(SIZE_MIN_M, niceDown(lowM)) : SIZE_MIN_M;
		const niceHigh = hasSizes ? Math.min(SIZE_MAX_M, niceUp(highM)) : SIZE_MAX_M;

		// Single batch of writes; we deliberately never read state.* here, so this
		// stays a write-only operation when called from inside a $effect — no
		// implicit subscription, no re-fire loop.
		state.availableTaskTypes = summary.taskTypes;
		state.availableTasks = summary.tasksMeta;
		state.availableDomains = sortedDomains;
		state.availableModalities = sortedModalities;
		// Available languages are only reseeded when the benchmark changes;
		// staying constant across same-benchmark refetches lets the
		// language-filter `requestSummaryForLanguages` effect track its
		// own dedupe key correctly.
		if (isNewBenchmark) {
			state.availableLanguages = sortedLanguages;
		}
		state.availableMinModelSizeM = niceLow;
		state.availableMaxModelSizeM = niceHigh;
		// Same-benchmark refresh (e.g. language-scoped summary refetch):
		// leave the user's current pick state alone — only the available-*
		// lists were updated above. Picks reset only when the benchmark
		// actually changes (new page nav).
		//
		// Trim picks that reference items no longer in the new available-*
		// universe — otherwise the sidebar's `picks/available` counter
		// reads e.g. "9/8" when a task type the user had checked got
		// dropped by the server-scoped summary (e.g. InstructionReranking
		// disappearing once English is deselected). We don't ADD newly
		// available items: the user's explicit deselections stay in force,
		// they just get masked against the visible universe.
		if (!isNewBenchmark) {
			pruneToAvailable(state.taskTypes, summary.taskTypes);
			pruneToAvailable(state.tasks, summary.tasks);
			pruneToAvailable(state.domains, sortedDomains);
			pruneToAvailable(state.modalities, sortedModalities);
			sync();
			return;
		}
		// Replace contents in place rather than swapping the SvelteSet reference.
		// Reassigning the Set forces every chip / FilterContent subscriber to
		// re-bind from scratch; mutating notifies once per mutation but lets
		// consumers see the new contents on the same identity.
		replaceSet(state.taskTypes, summary.taskTypes);
		replaceSet(state.domains, sortedDomains);
		replaceSet(state.modalities, sortedModalities);
		replaceSet(state.languages, sortedLanguages);
		replaceSet(state.tasks, summary.tasks);
		// Reset the chosen range to the new bounds so switching benchmarks
		// doesn't leave the slider stuck at an invisible position.
		state.minModelSizeM = niceLow;
		state.maxModelSizeM = niceHigh;
		// Each new benchmark starts with the size filter disabled — only the
		// user dragging the slider opts in. URL hydration below can flip it
		// back on if the share link carried explicit bounds.
		state.sizeActive = false;

		// After initFor establishes the defaults, layer any URL state on top so
		// shared deep-links restore the exact filter view.
		hydrateFromUrl();
		sync();
	}

	function hydrateFromUrl() {
		const p = readParams();
		const q = p.get('q');
		if (q !== null) state.nameQuery = q;
		const min = p.get('minSize');
		const max = p.get('maxSize');
		if (min !== null || max !== null) {
			const minN = Number(min);
			const maxN = Number(max);
			if (Number.isFinite(minN)) state.minModelSizeM = minN;
			if (Number.isFinite(maxN)) state.maxModelSizeM = maxN;
			state.sizeActive = true;
		}
		const avail = p.get('avail');
		if (avail === 'open' || avail === 'proprietary' || avail === 'both') state.availability = avail;
		const inst = p.get('inst');
		if (inst === 'only_instruction' || inst === 'only_non_instruction' || inst === 'both') {
			state.instructions = inst;
		}
		const zs = p.get('zs');
		if (zs === 'allow_all' || zs === 'remove_unknown' || zs === 'only_zero_shot')
			state.zeroShot = zs;
		if (p.get('st') === '1') state.sentenceTransformersOnly = true;
		const mt = p.get('mtypes');
		if (mt !== null) replaceSet(state.modelTypes, decodeSet(mt));
		const mm = p.get('mmods');
		if (mm !== null) replaceSet(state.modelModalities, decodeSet(mm));
		const tt = p.get('tt');
		if (tt !== null) replaceSet(state.taskTypes, decodeSet(tt));
		const lang = p.get('lang');
		if (lang !== null) replaceSet(state.languages, decodeSet(lang));
		const dom = p.get('dom');
		if (dom !== null) replaceSet(state.domains, decodeSet(dom));
		const mods = p.get('mods');
		if (mods !== null) replaceSet(state.modalities, decodeSet(mods));
		const tks = p.get('tks');
		if (tks !== null) replaceSet(state.tasks, decodeSet(tks));
	}

	// Drop entries from `target` that aren't in `available`. Used on
	// same-benchmark refresh so the picks/available counter doesn't
	// read "9/8" after a server-scoped refetch shrinks the universe.
	function pruneToAvailable(target: SvelteSet<string>, available: readonly string[]) {
		const present = new Set<string>(available);
		for (const v of target) {
			if (!present.has(v)) target.delete(v);
		}
	}

	function replaceSet(target: SvelteSet<string>, source: Iterable<string>) {
		target.clear();
		for (const v of source) target.add(v);
	}

	// Writes the current filter state back to the URL. Each set field only
	// appears in the URL when narrowed (not equal to its "all" baseline), so
	// the default view stays a clean URL with no query string at all. We
	// `untrack` the body because callers can be inside reactive contexts
	// (e.g. `initFor` is invoked from an `$effect`) — without it, the
	// state-reads below would bind to the outer effect and a single state
	// change would loop the entire reactive graph.
	//
	// `syncTimer` debounces: 13 sites call `sync()` (one per setter), and a
	// reset / hydrate burst calls 5-7 of them back-to-back. Coalescing to one
	// `replaceState` per microtask collapses that to a single URL rebuild.
	let syncScheduled = false;
	function sync() {
		if (syncScheduled) return;
		syncScheduled = true;
		queueMicrotask(() => {
			syncScheduled = false;
			doSync();
		});
	}
	function doSync() {
		untrack(() =>
			updateUrl({
				q: state.nameQuery || null,
				minSize: state.sizeActive ? String(state.minModelSizeM) : null,
				maxSize: state.sizeActive ? String(state.maxModelSizeM) : null,
				avail: state.availability !== 'both' ? state.availability : null,
				inst: state.instructions !== 'both' ? state.instructions : null,
				zs: state.zeroShot !== 'allow_all' ? state.zeroShot : null,
				st: state.sentenceTransformersOnly ? '1' : null,
				mtypes: state.modelTypes.size === MODEL_TYPES.length ? null : encodeSet(state.modelTypes),
				mmods:
					state.modelModalities.size === MODEL_MODALITIES.length
						? null
						: encodeSet(state.modelModalities),
				tt:
					state.taskTypes.size === state.availableTaskTypes.length
						? null
						: encodeSet(state.taskTypes),
				lang:
					state.languages.size === state.availableLanguages.length
						? null
						: encodeSet(state.languages),
				dom: state.domains.size === state.availableDomains.length ? null : encodeSet(state.domains),
				mods:
					state.modalities.size === state.availableModalities.length
						? null
						: encodeSet(state.modalities),
				tks: state.tasks.size === state.availableTasks.length ? null : encodeSet(state.tasks)
			})
		);
	}

	// "Nice" log-rounded numbers for slider endpoints. niceDown(109) → 100,
	// niceDown(7) → 5, niceDown(0.6) → 0.5; niceUp(7) → 10, niceUp(43) → 50.
	function niceDown(m: number): number {
		if (m <= 0) return 0;
		const pow = Math.floor(Math.log10(m));
		const base = Math.pow(10, pow);
		const lead = m / base;
		const stepped = lead >= 5 ? 5 : lead >= 2 ? 2 : 1;
		return stepped * base;
	}
	function niceUp(m: number): number {
		if (m <= 0) return 0;
		const pow = Math.floor(Math.log10(m));
		const base = Math.pow(10, pow);
		const lead = m / base;
		const stepped = lead <= 1 ? 1 : lead <= 2 ? 2 : lead <= 5 ? 5 : 10;
		return stepped * base;
	}

	function resetModelFilters() {
		state.nameQuery = '';
		state.minModelSizeM = state.availableMinModelSizeM;
		state.maxModelSizeM = state.availableMaxModelSizeM;
		state.sizeActive = false;
		state.zeroShot = 'allow_all';
		state.availability = 'both';
		state.instructions = 'both';
		state.sentenceTransformersOnly = false;
		replaceSet(state.modelTypes, MODEL_TYPES);
		replaceSet(state.modelModalities, MODEL_MODALITIES);
		sync();
	}

	function resetCustomize() {
		replaceSet(state.taskTypes, state.availableTaskTypes);
		replaceSet(state.domains, state.availableDomains);
		replaceSet(state.modalities, state.availableModalities);
		replaceSet(state.languages, state.availableLanguages);
		state.tasks.clear();
		for (const t of state.availableTasks) state.tasks.add(t.name);
		sync();
	}

	type SetKey =
		| 'taskTypes'
		| 'domains'
		| 'modalities'
		| 'languages'
		| 'tasks'
		| 'modelTypes'
		| 'modelModalities';

	function toggleInSet(key: SetKey, name: string) {
		const s = state[key];
		if (s.has(name)) s.delete(name);
		else s.add(name);
		sync();
	}

	function setAll(key: SetKey, values: readonly string[], checked: boolean) {
		const s = state[key];
		s.clear();
		if (checked) for (const v of values) s.add(v);
		sync();
	}

	return {
		get nameQuery() {
			return state.nameQuery;
		},
		set nameQuery(v: string) {
			state.nameQuery = v;
			sync();
		},
		get minModelSizeM() {
			return state.minModelSizeM;
		},
		set minModelSizeM(v: number) {
			state.minModelSizeM = v;
			state.sizeActive = true;
			sync();
		},
		get maxModelSizeM() {
			return state.maxModelSizeM;
		},
		set maxModelSizeM(v: number) {
			state.maxModelSizeM = v;
			state.sizeActive = true;
			sync();
		},
		get sizeActive() {
			return state.sizeActive;
		},
		get zeroShot() {
			return state.zeroShot;
		},
		set zeroShot(v: ZeroShotMode) {
			state.zeroShot = v;
			sync();
		},
		get availability() {
			return state.availability;
		},
		set availability(v: Availability) {
			state.availability = v;
			sync();
		},
		get instructions() {
			return state.instructions;
		},
		set instructions(v: InstructionMode) {
			state.instructions = v;
			sync();
		},
		get sentenceTransformersOnly() {
			return state.sentenceTransformersOnly;
		},
		set sentenceTransformersOnly(v: boolean) {
			state.sentenceTransformersOnly = v;
			sync();
		},
		get modelTypes() {
			return state.modelTypes;
		},
		get modelModalities() {
			return state.modelModalities;
		},
		get taskTypes() {
			return state.taskTypes;
		},
		get domains() {
			return state.domains;
		},
		get modalities() {
			return state.modalities;
		},
		get languages() {
			return state.languages;
		},
		get tasks() {
			return state.tasks;
		},
		get availableTaskTypes() {
			return state.availableTaskTypes;
		},
		get availableDomains() {
			return state.availableDomains;
		},
		get availableModalities() {
			return state.availableModalities;
		},
		get availableLanguages() {
			return state.availableLanguages;
		},
		get availableTasks() {
			return state.availableTasks;
		},
		get availableMinModelSizeM() {
			return state.availableMinModelSizeM;
		},
		get availableMaxModelSizeM() {
			return state.availableMaxModelSizeM;
		},
		initFor,
		resetModelFilters,
		resetCustomize,
		toggleInSet,
		setAll
	};
}

export const filters = createFilters();

function isFullSet(selected: Set<string>, available: string[]): boolean {
	// "Full" = every currently-visible item is picked, so no narrowing
	// is being applied. We deliberately do NOT treat selected=empty as
	// "no filter": when the user clears every chip in a category they
	// want to see nothing match (an explicit "exclude everything" gesture).
	//
	// HOWEVER, when there's nothing to filter in the first place
	// (`available` is empty — e.g. RTEB exposes taskTypes=[]), there are
	// no chips, no narrowing is possible, and returning false here would
	// flip `fullView` off and cause `applyFilters` to drop every task
	// (the .has(...) check on the empty selected set is always false →
	// `!fullTypes && !filters.taskTypes.has(...) → return false`). Treat
	// "no facet" as "no narrowing" so the data passes through.
	if (available.length === 0) return true;
	//
	// Why not the cheaper `selected.size === available.length` shortcut?
	// After a server-scoped summary refetch (e.g. language filter
	// trims the task-type list from 9 → 8 by dropping
	// InstructionReranking), the user's picks may still hold the
	// original 9 minus a different element. Both sets have size 8 but
	// contain different elements — the shortcut would falsely report
	// "no narrowing" and applyFilters would trust the API, leaving the
	// user's explicitly-deselected column visible.
	if (selected.size === 0) return false;
	return available.every((x) => selected.has(x));
}

// Cached per `summary` + task-filter signature so name-search keystrokes
// reuse the previous visibleTasks / Sets / per-row aggregate cache.
interface NarrowingResult {
	signature: string;
	fullView: boolean;
	visibleTasks: TaskMeta[];
	taskTypesOut: string[];
	taskNamesOut: string[];
	tasksByType: Map<string, string[]>;
	perRowAgg: WeakMap<
		SummaryRow,
		{
			meanTask: number | null;
			meanTaskType: number | null;
			scoresByTaskType: Record<string, number>;
		}
	>;
	// Per-task sorted (name, score) lists — backs the Borda cache,
	// independent of the row filter (intersected at compute time).
	sortedByTask: Map<string, readonly { name: string; v: number }[]>;
}
const _narrowingCache = new WeakMap<BenchmarkSummary, NarrowingResult>();

function narrowTasks(summary: BenchmarkSummary, lenient: boolean): NarrowingResult {
	// Signature of every input that flips `fullView` or changes
	// `visibleTasks`; sets sorted so iteration order is stable.
	const sig = [
		lenient ? 'L' : 'S',
		[...filters.taskTypes].sort().join('|'),
		[...filters.domains].sort().join('|'),
		[...filters.modalities].sort().join('|'),
		[...filters.tasks].sort().join('|'),
		filters.availableDomains.length,
		filters.availableModalities.length
	].join('§');
	const cached = _narrowingCache.get(summary);
	if (cached && cached.signature === sig) return cached;

	const fullTypes = isFullSet(filters.taskTypes, summary.taskTypes);
	const fullDomains = isFullSet(filters.domains, filters.availableDomains);
	const fullModalities = isFullSet(filters.modalities, filters.availableModalities);
	const fullTasks = isFullSet(filters.tasks, summary.tasks);
	const fullView = fullTypes && fullDomains && fullModalities && fullTasks;

	let visibleTasks: TaskMeta[];
	let taskTypesOut: string[];
	let taskNamesOut: string[];
	// eslint-disable-next-line svelte/prefer-svelte-reactivity
	const tasksByType = new Map<string, string[]>();
	if (fullView) {
		visibleTasks = summary.tasksMeta;
		taskTypesOut = summary.taskTypes;
		taskNamesOut = summary.tasks;
	} else {
		visibleTasks = summary.tasksMeta.filter((t) => {
			if (!fullTypes && !filters.taskTypes.has(t.type)) return false;
			if (!fullDomains && !t.domains.some((d) => filters.domains.has(d))) return false;
			if (!fullModalities && !(t.modalities ?? []).some((m) => filters.modalities.has(m)))
				return false;
			if (!fullTasks && !filters.tasks.has(t.name)) return false;
			return true;
		});
		const visibleTaskNames = new Set(visibleTasks.map((t) => t.name));
		const visibleTaskTypes = new Set(visibleTasks.map((t) => t.type));
		// Drop type columns no visible task feeds — backend strips spaces from
		// display labels, so `summary.taskTypes` keys line up with `tasksMeta[i].type`.
		taskTypesOut = summary.taskTypes.filter((t) => visibleTaskTypes.has(t));
		taskNamesOut = summary.tasks.filter((t) => visibleTaskNames.has(t));
		// Bucket visible tasks by raw type once so the per-row aggregate loop
		// below is O(rows × visibleTasks) instead of O(rows × types × visibleTasks).
		for (const t of visibleTasks) {
			const arr = tasksByType.get(t.type);
			if (arr) arr.push(t.name);
			else tasksByType.set(t.type, [t.name]);
		}
	}

	const result: NarrowingResult = {
		signature: sig,
		fullView,
		visibleTasks,
		taskTypesOut,
		taskNamesOut,
		tasksByType,
		perRowAgg: new WeakMap(),
		sortedByTask: new Map()
	};
	_narrowingCache.set(summary, result);
	return result;
}

export function applyFilters(summary: BenchmarkSummary): BenchmarkSummary {
	// Visible tasks: pass type / domain / modality / explicit task selection.
	// Language is intentionally NOT in this list — the backend already
	// returns a language-scoped summary (via `?languages=` on /scores),
	// so re-filtering tasks client-side by language would either be a
	// no-op (server-trimmed lists already match) or drift wrong while
	// the debounced refetch is in flight (showing the previous summary's
	// task slots with current-filter narrowing produces invented values).
	const lenient =
		filters.languages.size > 0 && filters.languages.size < filters.availableLanguages.length;
	const narrow = narrowTasks(summary, lenient);
	const { fullView, visibleTasks, taskTypesOut, taskNamesOut, tasksByType, perRowAgg } = narrow;

	const q = filters.nameQuery.trim().toLowerCase();
	// "Did the user pick something that narrows the row set, other than
	// typing in the name search?" — name search is a find-in-table
	// gesture and shouldn't relabel ranks. Any of the other filters
	// (availability / instructions / model type / size / zero-shot / …)
	// being active means the visible set is a deliberate subset and the
	// re-rank below should renumber 1..N.
	const rowFilterActive =
		filters.availability !== 'both' ||
		filters.instructions !== 'both' ||
		filters.sentenceTransformersOnly ||
		filters.modelTypes.size !== MODEL_TYPES.length ||
		filters.modelModalities.size !== MODEL_MODALITIES.length ||
		filters.sizeActive ||
		filters.zeroShot !== 'allow_all';
	const passesRowFilter = (row: SummaryRow): boolean => {
		const m = row.model;
		if (q && !modelSearchKey(m).includes(q)) return false;
		if (filters.availability === 'open' && !m.openWeights) return false;
		if (filters.availability === 'proprietary' && m.openWeights) return false;

		if (filters.instructions === 'only_instruction' && !m.instructionTuned) return false;
		if (filters.instructions === 'only_non_instruction' && m.instructionTuned) return false;

		if (filters.sentenceTransformersOnly && !m.sentenceTransformersCompatible) return false;

		// Empty pick set = "deselect everything" = nothing matches.
		// Full pick set = filter off. Partial = intersection check.
		if (!filters.modelTypes.has(m.modelType)) return false;

		if (filters.modelModalities.size < MODEL_MODALITIES.length) {
			const mm = m.modalities ?? TEXT_ONLY;
			let any = false;
			for (const x of mm) {
				if (filters.modelModalities.has(x)) {
					any = true;
					break;
				}
			}
			if (!any) return false;
		}

		// Size filter is inactive until the user actually moves the slider.
		// Once active, it both applies the [min, max] bracket AND drops
		// unsized (proprietary) models — a deliberate "you opted in to
		// filtering by size, so rows that can't satisfy it shouldn't pass".
		if (filters.sizeActive) {
			if (m.totalParamsB <= 0) return false;
			const paramsM = m.totalParamsB * 1000;
			if (paramsM < filters.minModelSizeM) return false;
			if (paramsM > filters.maxModelSizeM) return false;
		}

		if (filters.zeroShot === 'only_zero_shot' && row.zeroShotPct !== 100) return false;
		if (filters.zeroShot === 'remove_unknown' && row.zeroShotPct === -1) return false;

		return true;
	};

	// fullView: aggregates are unchanged from the API, so skip the per-row
	// `{...row, ...}` spread + recompute. Big win for the common case where
	// the user is just typing in name search or toggling a row facet.
	let rows: SummaryRow[];
	if (fullView) {
		rows = summary.rows.filter(passesRowFilter);
	} else {
		// Under task narrowing: recompute every aggregate from the visible
		// per-task scalars. Aggregation policy mirrors the backend:
		//   • No language filter  → strict (`_skipna_false_mean`): null on
		//     any missing task in the visible slice, so partial-coverage
		//     models can't outrank full-coverage peers.
		//   • Language filter ON  → lenient: the backend already switched
		//     to lenient means for the language-scoped summary.
		// Memoised by `(row identity, narrow signature)` — a name-search
		// keystroke under a fixed task filter reuses every survivor's cache.
		// Lenient: any present value contributes. Strict: all values must be
		// present for a non-null mean — matches the backend's
		// `_skipna_false_mean` policy.
		const meanOrNull = (sum: number, n: number, total: number): number | null => {
			if (lenient) return n > 0 ? sum / n : null;
			return total > 0 && n === total ? sum / total : null;
		};
		const computeAgg = (row: SummaryRow) => {
			let taskSum = 0;
			let taskN = 0;
			for (const t of taskNamesOut) {
				const v = row.scoresByTask[t];
				if (v !== undefined) {
					taskSum += v;
					taskN++;
				}
			}
			const meanTask = meanOrNull(taskSum, taskN, taskNamesOut.length);

			const scoresByTaskType: Record<string, number> = {};
			for (const tt of taskTypesOut) {
				const typeTasks = tasksByType.get(tt);
				if (!typeTasks || typeTasks.length === 0) continue;
				let typeSum = 0;
				let typeN = 0;
				for (const name of typeTasks) {
					const v = row.scoresByTask[name];
					if (v !== undefined) {
						typeSum += v;
						typeN++;
					}
				}
				const typeMean = meanOrNull(typeSum, typeN, typeTasks.length);
				if (typeMean !== null) scoresByTaskType[tt] = typeMean;
			}

			let mttSum = 0;
			let mttN = 0;
			for (const tt of taskTypesOut) {
				const v = scoresByTaskType[tt];
				if (v !== undefined) {
					mttSum += v;
					mttN++;
				}
			}
			const meanTaskType = meanOrNull(mttSum, mttN, taskTypesOut.length);
			return { meanTask, meanTaskType, scoresByTaskType };
		};

		rows = [];
		for (const row of summary.rows) {
			if (!passesRowFilter(row)) continue;
			let agg = perRowAgg.get(row);
			if (!agg) {
				agg = computeAgg(row);
				perRowAgg.set(row, agg);
			}
			rows.push({
				...row,
				meanTask: agg.meanTask,
				meanTaskType: agg.meanTaskType,
				scoresByTaskType: agg.scoresByTaskType
			});
		}
	}

	// Re-rank to match what the user is actually looking at:
	//   • Task set narrowed (`!fullView`) → fresh Borda over the visible
	//     task slice (a model's per-task wins against a different
	//     opponent set produce a different total).
	//   • Row set narrowed by a deliberate facet (model availability /
	//     size / type / zero-shot / …) but task set intact → preserve
	//     the API's Borda ORDER (still correct against the same task
	//     set) and just renumber 1..N over the visible rows. Otherwise
	//     the top-visible row keeps its original e.g. rank=12 which is
	//     confusing when it's the only model on screen.
	//   • Name search only (or nothing) → keep the API ranks as-is.
	//     The name search is a find-in-table gesture, not a filter that
	//     should re-rank the matches as if they were the universe.
	let rankedRows: typeof rows;
	if (fullView) {
		if (rowFilterActive) {
			rankedRows = rows.map((row, i) => ({ ...row, rank: i + 1 }));
		} else {
			rankedRows = rows;
		}
	} else {
		// Per-task sorted (name, score) lists, cached once per (summary,
		// taskNamesOut). Borda for the visible set walks each list and
		// skips names not in `visibleNames`.
		const { sortedByTask } = narrow;
		if (sortedByTask.size === 0) {
			for (const taskName of taskNamesOut) {
				const ranked: { name: string; v: number }[] = [];
				for (const r of summary.rows) {
					const v = r.scoresByTask[taskName];
					if (v !== undefined) ranked.push({ name: r.model.name, v });
				}
				// Stable tie-break by name so tied scores award deterministic
				// points regardless of `summary.rows` order.
				ranked.sort((a, b) => b.v - a.v || (a.name < b.name ? -1 : a.name > b.name ? 1 : 0));
				sortedByTask.set(taskName, ranked);
			}
		}
		// eslint-disable-next-line svelte/prefer-svelte-reactivity
		const visibleNames = new Set<string>();
		for (const r of rows) visibleNames.add(r.model.name);
		// eslint-disable-next-line svelte/prefer-svelte-reactivity
		const bordaPoints = new Map<string, number>();
		for (const taskName of taskNamesOut) {
			const ranked = sortedByTask.get(taskName);
			if (!ranked) continue;
			// Visible count per task — Borda awards `visibleCount - rank`.
			let visibleCount = 0;
			for (const r of ranked) if (visibleNames.has(r.name)) visibleCount++;
			let i = 0;
			for (const r of ranked) {
				if (!visibleNames.has(r.name)) continue;
				bordaPoints.set(r.name, (bordaPoints.get(r.name) ?? 0) + (visibleCount - i));
				i++;
			}
		}
		rankedRows = rows
			.map((row) => ({ row, borda: bordaPoints.get(row.model.name) ?? 0 }))
			.sort((a, b) => {
				if (a.borda !== b.borda) return b.borda - a.borda;
				// Tiebreak: higher Mean(Task) first; nulls to bottom.
				const am = a.row.meanTask ?? -Infinity;
				const bm = b.row.meanTask ?? -Infinity;
				return bm - am;
			})
			.map(({ row }, i) => ({ ...row, rank: i + 1 }));
	}

	return {
		...summary,
		taskTypes: taskTypesOut,
		tasks: taskNamesOut,
		tasksMeta: visibleTasks,
		rows: rankedRows
	};
}
