import { untrack } from 'svelte';
import { SvelteSet } from 'svelte/reactivity';

import type { BenchmarkSummary, ModelType, TaskMeta } from '$lib/types';
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

	function initFor(summary: BenchmarkSummary | null) {
		if (!summary) return;

		// Local accumulators — not held by $state, so plain Set is correct.
		// Languages come from `tasksMeta[i].languages` which the backend
		// emits in benchmark-scoped form via `scoped_task_meta_schema`
		// (so a task pinned to `languages=['eng']` doesn't leak its full
		// class-level union into the per-benchmark filter sidebar).
		/* eslint-disable svelte/prefer-svelte-reactivity */
		const domains = new Set<string>();
		const modalities = new Set<string>();
		const languages = new Set<string>();
		/* eslint-enable svelte/prefer-svelte-reactivity */
		for (const t of summary.tasksMeta) {
			for (const d of t.domains ?? []) domains.add(d);
			for (const m of t.modalities ?? []) modalities.add(m);
			for (const l of t.languages ?? []) languages.add(l);
		}
		const sortedDomains = [...domains].sort();
		const sortedModalities = [...modalities].sort();
		const sortedLanguages = [...languages].sort();

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
		state.availableLanguages = sortedLanguages;
		state.availableMinModelSizeM = niceLow;
		state.availableMaxModelSizeM = niceHigh;
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
	return selected.size === 0 || selected.size === available.length;
}

export function applyFilters(summary: BenchmarkSummary): BenchmarkSummary {
	// Visible tasks: pass type / domain / language / modality / explicit task selection.
	const fullTypes = isFullSet(filters.taskTypes, summary.taskTypes);
	const fullDomains = isFullSet(filters.domains, filters.availableDomains);
	const fullModalities = isFullSet(filters.modalities, filters.availableModalities);
	const fullLanguages = isFullSet(filters.languages, filters.availableLanguages);
	const fullTasks = isFullSet(filters.tasks, summary.tasks);
	const fullView = fullTypes && fullDomains && fullModalities && fullLanguages && fullTasks;

	// Skip the `.filter()` allocation when no task-affecting filter is active —
	// `visibleTasks === summary.tasksMeta`, `taskTypesOut === summary.taskTypes`,
	// `taskNamesOut === summary.tasks`. Saves the alloc + Set creation on the
	// common "user is only typing in the name search box" path.
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
			if (!fullLanguages && !t.languages.some((l) => filters.languages.has(l))) return false;
			if (!fullTasks && !filters.tasks.has(t.name)) return false;
			return true;
		});
		// eslint-disable-next-line svelte/prefer-svelte-reactivity
		const visibleTaskNames = new Set(visibleTasks.map((t) => t.name));
		// eslint-disable-next-line svelte/prefer-svelte-reactivity
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

	const q = filters.nameQuery.trim().toLowerCase();
	const rows = summary.rows
		.filter((row) => {
			const m = row.model;
			if (
				q &&
				!m.name.toLowerCase().includes(q) &&
				!m.displayName.toLowerCase().includes(q) &&
				!m.org.toLowerCase().includes(q)
			) {
				return false;
			}
			if (filters.availability === 'open' && !m.openWeights) return false;
			if (filters.availability === 'proprietary' && m.openWeights) return false;

			if (filters.instructions === 'only_instruction' && !m.instructionTuned) return false;
			if (filters.instructions === 'only_non_instruction' && m.instructionTuned) return false;

			if (filters.sentenceTransformersOnly && !m.sentenceTransformersCompatible) return false;

			if (filters.modelTypes.size > 0 && !filters.modelTypes.has(m.modelType)) return false;

			if (
				filters.modelModalities.size > 0 &&
				filters.modelModalities.size < MODEL_MODALITIES.length
			) {
				const mm = m.modalities ?? ['text'];
				if (!mm.some((x) => filters.modelModalities.has(x))) return false;
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
		})
		.map((row) => {
			// Under filter: recompute every aggregate from the visible per-task
			// scalars (null on partial coverage, matching the backend's
			// `_skipna_false_mean`). With no filter, trust the API — MIEB's
			// Mean (Task) is mean-of-per-type-means, not mean-of-tasks.
			let meanTask: number | null = row.meanTask;
			let meanTaskType: number | null = row.meanTaskType;
			let scoresByTaskType: Record<string, number> = row.scoresByTaskType;
			if (!fullView) {
				let taskSum = 0;
				let taskN = 0;
				for (const t of taskNamesOut) {
					const v = row.scoresByTask[t];
					if (v !== undefined) {
						taskSum += v;
						taskN++;
					}
				}
				meanTask =
					taskNamesOut.length > 0 && taskN === taskNamesOut.length ? taskSum / taskN : null;

				scoresByTaskType = {};
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
					if (typeN === typeTasks.length) {
						scoresByTaskType[tt] = typeSum / typeN;
					}
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
				meanTaskType =
					taskTypesOut.length > 0 && mttN === taskTypesOut.length ? mttSum / mttN : null;
			}

			return { ...row, meanTask, meanTaskType, scoresByTaskType };
		});

	// Re-rank over the visible-task slice via Borda count, matching the
	// API's own ranking algorithm. The API rank is for the full
	// benchmark — once the user filters tasks down, that rank no longer
	// reflects the filtered subset. A naive sort by Mean(Task) would
	// over-promote single-task specialists; Borda points (per task:
	// (n - position)) cancel that bias the same way the backend does.
	// Local accumulator in a pure transformation — plain Map is correct here.
	// eslint-disable-next-line svelte/prefer-svelte-reactivity
	const bordaPoints = new Map<string, number>();
	for (const taskName of taskNamesOut) {
		const ranked = rows
			.map((r) => ({ name: r.model.name, v: r.scoresByTask[taskName] }))
			.filter((r): r is { name: string; v: number } => r.v !== undefined)
			.sort((a, b) => b.v - a.v);
		ranked.forEach((r, i) => {
			bordaPoints.set(r.name, (bordaPoints.get(r.name) ?? 0) + (ranked.length - i));
		});
	}

	const rankedRows = rows
		.map((row) => ({ row, borda: bordaPoints.get(row.model.name) ?? 0 }))
		.sort((a, b) => {
			if (a.borda !== b.borda) return b.borda - a.borda;
			// Tiebreak: higher Mean(Task) first; nulls (incomplete coverage)
			// land at the bottom of any tie.
			const am = a.row.meanTask ?? -Infinity;
			const bm = b.row.meanTask ?? -Infinity;
			return bm - am;
		})
		.map(({ row }, i) => ({ ...row, rank: i + 1 }));

	return {
		...summary,
		taskTypes: taskTypesOut,
		tasks: taskNamesOut,
		tasksMeta: visibleTasks,
		rows: rankedRows
	};
}
