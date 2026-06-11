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

// Hot-path constant — avoids allocating a fresh `['text']` per row.
const TEXT_ONLY: readonly string[] = ['text'];

interface FiltersState {
	// model filters
	nameQuery: string;
	minModelSizeM: number;
	maxModelSizeM: number;
	// Inactive until the user moves the slider; once on, also drops unsized models.
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
	// Slider bounds; fall back to global defaults when no benchmark is loaded.
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
		availableMinModelSizeM: SIZE_MIN_M,
		availableMaxModelSizeM: SIZE_MAX_M
	};
}

function createFilters() {
	const state = $state<FiltersState>(defaultState());
	// $state.raw because these are reassigned wholesale (never deep-mutated)
	// and contain hundreds of entries per Multilingual benchmark.
	let availableTaskTypes = $state.raw<string[]>([]);
	let availableDomains = $state.raw<string[]>([]);
	let availableModalities = $state.raw<string[]>([]);
	let availableLanguages = $state.raw<string[]>([]);
	let availableTasks = $state.raw<TaskMeta[]>([]);
	// Same-benchmark refetches (e.g. language-scoped) refresh available-* without
	// resetting user picks — otherwise toggling a language would loop.
	let lastBenchmarkName: string | null = null;

	function initFor(summary: BenchmarkSummary | null) {
		if (!summary) return;
		const isNewBenchmark = lastBenchmarkName !== summary.benchmarkName;
		lastBenchmarkName = summary.benchmarkName;

		// Local accumulators — never reactive.
		/* eslint-disable svelte/prefer-svelte-reactivity */
		const domains = new Set<string>();
		const modalities = new Set<string>();
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

		// Bracket slider bounds to known model sizes; unsized models pass anyway.
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
		// Round outward to 1-sigfig "nice" numbers for readable tick labels.
		const niceLow = hasSizes ? Math.max(SIZE_MIN_M, niceDown(lowM)) : SIZE_MIN_M;
		const niceHigh = hasSizes ? Math.min(SIZE_MAX_M, niceUp(highM)) : SIZE_MAX_M;

		// Write-only — must not read state.* here or this re-fires when called
		// from an $effect.
		availableTaskTypes = summary.taskTypes;
		availableTasks = summary.tasksMeta;
		availableDomains = sortedDomains;
		availableModalities = sortedModalities;
		// Languages only refresh on benchmark change so the language-scoped
		// refetch dedupe key stays stable.
		if (isNewBenchmark) {
			availableLanguages = sortedLanguages;
		}
		state.availableMinModelSizeM = niceLow;
		state.availableMaxModelSizeM = niceHigh;
		// Same-benchmark refetch: keep picks, just trim ones no longer in the
		// shrunk universe (otherwise sidebar shows e.g. "9/8").
		if (!isNewBenchmark) {
			pruneToAvailable(state.taskTypes, summary.taskTypes);
			pruneToAvailable(state.tasks, summary.tasks);
			pruneToAvailable(state.domains, sortedDomains);
			pruneToAvailable(state.modalities, sortedModalities);
			sync();
			return;
		}
		// In-place mutation preserves SvelteSet identity for subscribers.
		replaceSet(state.taskTypes, summary.taskTypes);
		replaceSet(state.domains, sortedDomains);
		replaceSet(state.modalities, sortedModalities);
		replaceSet(state.languages, sortedLanguages);
		replaceSet(state.tasks, summary.tasks);
		state.minModelSizeM = niceLow;
		state.maxModelSizeM = niceHigh;
		state.sizeActive = false;

		// Layer URL params on top so deep links restore the exact view.
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

	// Microtask-debounced URL sync. `untrack` prevents reactive subscribers
	// from binding to state reads when called from inside an $effect.
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
				tt: state.taskTypes.size === availableTaskTypes.length ? null : encodeSet(state.taskTypes),
				lang:
					state.languages.size === availableLanguages.length ? null : encodeSet(state.languages),
				dom: state.domains.size === availableDomains.length ? null : encodeSet(state.domains),
				mods:
					state.modalities.size === availableModalities.length ? null : encodeSet(state.modalities),
				tks: state.tasks.size === availableTasks.length ? null : encodeSet(state.tasks)
			})
		);
	}

	// niceDown(109) → 100, niceDown(7) → 5; niceUp(7) → 10, niceUp(43) → 50.
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
		replaceSet(state.taskTypes, availableTaskTypes);
		replaceSet(state.domains, availableDomains);
		replaceSet(state.modalities, availableModalities);
		replaceSet(state.languages, availableLanguages);
		state.tasks.clear();
		for (const t of availableTasks) state.tasks.add(t.name);
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
			return availableTaskTypes;
		},
		get availableDomains() {
			return availableDomains;
		},
		get availableModalities() {
			return availableModalities;
		},
		get availableLanguages() {
			return availableLanguages;
		},
		get availableTasks() {
			return availableTasks;
		},
		get availableMinModelSizeM() {
			return state.availableMinModelSizeM;
		},
		get availableMaxModelSizeM() {
			return state.availableMaxModelSizeM;
		},
		initFor,
		// Public for pages without a benchmark summary (e.g. /models); /benchmark
		// calls it implicitly inside initFor.
		hydrateFromUrl,
		resetModelFilters,
		resetCustomize,
		toggleInSet,
		setAll
	};
}

export const filters = createFilters();

function isFullSet(selected: Set<string>, available: string[]): boolean {
	// "Full" = no narrowing. Empty universe = always full; empty pick set on a
	// populated universe = explicit "exclude everything".
	if (available.length === 0) return true;
	if (selected.size === 0) return false;
	// Element-wise check (not size===size): a server-scoped refetch can shrink
	// the universe while the user's pick set keeps a different element of the
	// same size.
	return available.every((x) => selected.has(x));
}

// Cached per (summary, task-filter signature) so name-search keystrokes
// reuse the previous narrowing result.
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
		taskTypesOut = summary.taskTypes.filter((t) => visibleTaskTypes.has(t));
		taskNamesOut = summary.tasks.filter((t) => visibleTaskNames.has(t));
		// Bucket once so the per-row aggregate loop is O(rows × visibleTasks).
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
	// Empty language pick set = "exclude everything"; the backend's `?languages=`
	// treats it as no filter, so enforce the drop client-side.
	if (filters.availableLanguages.length > 0 && filters.languages.size === 0) {
		return {
			...summary,
			rows: [],
			tasks: [],
			tasksMeta: [],
			taskTypes: []
		};
	}
	// Language is server-scoped via `?languages=` — don't refilter client-side.
	const lenient =
		filters.languages.size > 0 && filters.languages.size < filters.availableLanguages.length;
	const narrow = narrowTasks(summary, lenient);
	const { fullView, visibleTasks, taskTypesOut, taskNamesOut, tasksByType, perRowAgg } = narrow;

	// All tasks filtered out → drop rows too; otherwise the table renders model
	// names with all-`—` aggregates.
	if (!fullView && visibleTasks.length === 0) {
		return {
			...summary,
			rows: [],
			tasks: [],
			tasksMeta: [],
			taskTypes: []
		};
	}

	const q = filters.nameQuery.trim().toLowerCase();
	// Re-rank 1..N when an explicit filter narrows rows; name search alone is a
	// find-in-table gesture and keeps original ranks.
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

		// Active size filter also drops unsized (proprietary) models.
		if (filters.sizeActive) {
			if (m.totalParamsB == null || m.totalParamsB <= 0) return false;
			const paramsM = m.totalParamsB * 1000;
			if (paramsM < filters.minModelSizeM) return false;
			if (paramsM > filters.maxModelSizeM) return false;
		}

		if (filters.zeroShot === 'only_zero_shot' && row.zeroShotPct !== 100) return false;
		if (filters.zeroShot === 'remove_unknown' && row.zeroShotPct === -1) return false;

		return true;
	};

	let rows: SummaryRow[];
	if (fullView) {
		rows = summary.rows.filter(passesRowFilter);
	} else {
		// Strict (no language filter): every visible task must be present.
		// Lenient (language filter on): any present value contributes — matches
		// the backend's `_skipna_false_mean` policy.
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

	// Re-rank: fresh Borda when tasks narrowed; renumber 1..N when only rows
	// narrowed; keep API ranks for name-search-only (find-in-table gesture).
	let rankedRows: typeof rows;
	if (fullView) {
		if (rowFilterActive) {
			rankedRows = rows.map((row, i) => ({ ...row, rank: i + 1 }));
		} else {
			rankedRows = rows;
		}
	} else {
		const { sortedByTask } = narrow;
		if (sortedByTask.size === 0) {
			for (const taskName of taskNamesOut) {
				const ranked: { name: string; v: number }[] = [];
				for (const r of summary.rows) {
					const v = r.scoresByTask[taskName];
					if (v !== undefined) ranked.push({ name: r.model.name, v });
				}
				// Stable tie-break by name for deterministic Borda points.
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
