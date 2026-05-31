import type { BenchmarkSummary, ModelType, TaskMeta } from '$lib/types';

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

interface FiltersState {
	// model filters
	nameQuery: string;
	minModelSizeM: number;
	maxModelSizeM: number;
	zeroShot: ZeroShotMode;
	availability: Availability;
	instructions: InstructionMode;
	sentenceTransformersOnly: boolean;
	modelTypes: Set<string>;
	// customize-benchmark filters
	taskTypes: Set<string>;
	domains: Set<string>;
	modalities: Set<string>;
	languages: Set<string>;
	tasks: Set<string>;
	// available choices (per benchmark)
	availableTaskTypes: string[];
	availableDomains: string[];
	availableModalities: string[];
	availableLanguages: string[];
	availableTasks: TaskMeta[];
}

function defaultState(): FiltersState {
	return {
		nameQuery: '',
		minModelSizeM: SIZE_MIN_M,
		maxModelSizeM: SIZE_MAX_M,
		zeroShot: 'allow_all',
		availability: 'both',
		instructions: 'both',
		sentenceTransformersOnly: false,
		modelTypes: new Set<string>(MODEL_TYPES),
		taskTypes: new Set(),
		domains: new Set(),
		modalities: new Set(),
		languages: new Set(),
		tasks: new Set(),
		availableTaskTypes: [],
		availableDomains: [],
		availableModalities: [],
		availableLanguages: [],
		availableTasks: []
	};
}

function createFilters() {
	const state = $state<FiltersState>(defaultState());

	function initFor(summary: BenchmarkSummary | null) {
		if (!summary) return;

		const domains = new Set<string>();
		const modalities = new Set<string>();
		const languages = new Set<string>();
		for (const t of summary.tasksMeta) {
			for (const d of t.domains) domains.add(d);
			modalities.add(t.modality);
			for (const l of t.languages) languages.add(l);
		}
		const sortedDomains = [...domains].sort();
		const sortedModalities = [...modalities].sort();
		const sortedLanguages = [...languages].sort();

		// Single batch of writes; we deliberately never read state.* here, so this
		// stays a write-only operation when called from inside a $effect — no
		// implicit subscription, no re-fire loop.
		state.availableTaskTypes = summary.taskTypes;
		state.availableTasks = summary.tasksMeta;
		state.availableDomains = sortedDomains;
		state.availableModalities = sortedModalities;
		state.availableLanguages = sortedLanguages;
		state.taskTypes = new Set(summary.taskTypes);
		state.domains = new Set(sortedDomains);
		state.modalities = new Set(sortedModalities);
		state.languages = new Set(sortedLanguages);
		state.tasks = new Set(summary.tasks);
	}

	function resetModelFilters() {
		state.nameQuery = '';
		state.minModelSizeM = SIZE_MIN_M;
		state.maxModelSizeM = SIZE_MAX_M;
		state.zeroShot = 'allow_all';
		state.availability = 'both';
		state.instructions = 'both';
		state.sentenceTransformersOnly = false;
		state.modelTypes = new Set<string>(MODEL_TYPES);
	}

	function resetCustomize() {
		state.taskTypes = new Set(state.availableTaskTypes);
		state.domains = new Set(state.availableDomains);
		state.modalities = new Set(state.availableModalities);
		state.languages = new Set(state.availableLanguages);
		state.tasks = new Set(state.availableTasks.map((t) => t.name));
	}

	function toggleInSet(key: 'taskTypes' | 'domains' | 'modalities' | 'languages' | 'tasks' | 'modelTypes', name: string) {
		const next = new Set(state[key]);
		if (next.has(name)) next.delete(name);
		else next.add(name);
		state[key] = next;
	}

	function setAll(
		key: 'taskTypes' | 'domains' | 'modalities' | 'languages' | 'tasks' | 'modelTypes',
		values: string[],
		checked: boolean
	) {
		state[key] = checked ? new Set(values) : new Set();
	}

	return {
		get nameQuery() {
			return state.nameQuery;
		},
		set nameQuery(v: string) {
			state.nameQuery = v;
		},
		get minModelSizeM() {
			return state.minModelSizeM;
		},
		set minModelSizeM(v: number) {
			state.minModelSizeM = v;
		},
		get maxModelSizeM() {
			return state.maxModelSizeM;
		},
		set maxModelSizeM(v: number) {
			state.maxModelSizeM = v;
		},
		get zeroShot() {
			return state.zeroShot;
		},
		set zeroShot(v: ZeroShotMode) {
			state.zeroShot = v;
		},
		get availability() {
			return state.availability;
		},
		set availability(v: Availability) {
			state.availability = v;
		},
		get instructions() {
			return state.instructions;
		},
		set instructions(v: InstructionMode) {
			state.instructions = v;
		},
		get sentenceTransformersOnly() {
			return state.sentenceTransformersOnly;
		},
		set sentenceTransformersOnly(v: boolean) {
			state.sentenceTransformersOnly = v;
		},
		get modelTypes() {
			return state.modelTypes;
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

	const visibleTasks = summary.tasksMeta.filter((t) => {
		if (!fullTypes && !filters.taskTypes.has(t.type)) return false;
		if (!fullDomains && !t.domains.some((d) => filters.domains.has(d))) return false;
		if (!fullModalities && !filters.modalities.has(t.modality)) return false;
		if (!fullLanguages && !t.languages.some((l) => filters.languages.has(l))) return false;
		if (!fullTasks && !filters.tasks.has(t.name)) return false;
		return true;
	});
	const visibleTaskNames = new Set(visibleTasks.map((t) => t.name));
	const visibleTaskTypes = Array.from(new Set(visibleTasks.map((t) => t.type)));
	// Preserve the original task-type ordering.
	const taskTypesOut = summary.taskTypes.filter((t) => visibleTaskTypes.includes(t));

	const taskNamesOut = summary.tasks.filter((t) => visibleTaskNames.has(t));

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

			// Size filter only applies to models with a known size (open-weight, params > 0).
			// Proprietary/unknown-size models always pass.
			if (m.totalParamsB > 0) {
				const paramsM = m.totalParamsB * 1000;
				if (paramsM < filters.minModelSizeM) return false;
				if (paramsM > filters.maxModelSizeM) return false;
			}

			if (filters.zeroShot === 'only_zero_shot' && row.zeroShotPct !== 100) return false;
			if (filters.zeroShot === 'remove_unknown' && row.zeroShotPct === -1) return false;

			return true;
		})
		.map((row) => {
			// Recompute means over the visible task slice.
			let taskSum = 0;
			let taskN = 0;
			for (const t of taskNamesOut) {
				const v = row.scoresByTask[t];
				if (v !== undefined) {
					taskSum += v;
					taskN++;
				}
			}
			const meanTask = taskN > 0 ? taskSum / taskN : row.meanTask;

			let typeSum = 0;
			let typeN = 0;
			for (const tt of taskTypesOut) {
				const v = row.scoresByTaskType[tt];
				if (v !== undefined) {
					typeSum += v;
					typeN++;
				}
			}
			const meanTaskType = typeN > 0 ? typeSum / typeN : row.meanTaskType;

			return { ...row, meanTask, meanTaskType };
		})
		.sort((a, b) => b.meanTask - a.meanTask)
		.map((row, idx) => ({ ...row, rank: idx + 1 }));

	return {
		...summary,
		taskTypes: taskTypesOut,
		tasks: taskNamesOut,
		tasksMeta: visibleTasks,
		rows
	};
}
