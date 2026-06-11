export type BenchmarkAggregation = 'mean_task' | 'mean_task_type' | 'task_types' | 'public_private';

export interface Benchmark {
	name: string;
	displayName: string;
	icon?: string;
	description: string;
	reference?: string;
	citation?: string;
	languages: string[];
	taskTypes: string[];
	// Simplified task groups (Borda-compatible buckets) this benchmark
	// touches — one of "retrieval", "classification", "pair-classification",
	// "clustering", "semantic-similarity". Drives the "Task group" facet
	// on /benchmarks. Empty when the backend hasn't populated it.
	simplifiedTaskTypes?: string[];
	tasks: string[];
	domains: string[];
	modalities: string[];
	// Backend may flag a benchmark as hidden from the curated menu
	// (`display_on_leaderboard=False`); the /benchmarks list always
	// includes them so the all-benchmarks page can still surface them
	// (with the "newer version available" hint).
	displayOnLeaderboard?: boolean;
	// Names of newer benchmarks that supersede this one.
	newVersion?: string[] | null;
	// Aggregation columns this benchmark's summary table should render. Mirrors
	// `Benchmark.aggregations` upstream — frontend uses it to hide irrelevant
	// columns (ViDoRe has no per-type breakdown; RTEB has only Mean (Task)).
	aggregations: BenchmarkAggregation[];
	// Whether the Zero-shot column is meaningful on this benchmark. Off for
	// ViDoRe / RTEB where task names aren't tracked in model training-data
	// annotations so every row would otherwise render as a misleading 100%.
	showZeroShot?: boolean;
	// Distinct models with at least one score on this benchmark. Surfaced on
	// the catalogue / home benchmark cards so the user can size up coverage
	// without opening each benchmark. Set by the backend from the cached
	// per-benchmark frames; `0` means unknown (cache not populated) or empty.
	numModels?: number;
	// Explicit subset of language codes for the per-language leaderboard
	// view. Mirrors `Benchmark.language_view` upstream. `'all'` means
	// "every language present"; `null`/missing means the benchmark didn't
	// opt into a per-language view and the Per-language tab should be
	// hidden entirely on this benchmark's detail page.
	languageView?: string[] | 'all' | null;
}

export type SimplifiedTaskType =
	| 'retrieval'
	| 'clustering'
	| 'classification'
	| 'semantic-similarity'
	| 'pair-classification'
	| string;

export interface TaskMeta {
	name: string;
	type: string;
	simplifiedType: SimplifiedTaskType;
	languages: string[];
	domains: string[];
	modalities: string[];
	description: string;
	reference?: string | null;
	citation?: string | null;
	// Whether the dataset is openly published. Used to recompute Mean (Public)
	// / Mean (Private) when filters narrow the task set on benchmarks that
	// declare the public_private aggregation.
	isPublic?: boolean;
	// Extended dataset metadata for the task detail card.
	sourceDataset?: string | null;
	license?: string | null;
	dateFrom?: string | null;
	dateTo?: string | null;
	annotationsCreators?: string | null;
	dialect?: string[] | null;
	sampleCreation?: string | null;
	// Primary metric the task is scored on (e.g. ``ndcg_at_10``,
	// ``cosine_spearman``). Surfaced on the /tasks card, the task detail
	// page, and the PerTaskTab column tooltip.
	mainScore?: string | null;
	// Count of distinct models that have at least one score on this task.
	numModels?: number;
}

export interface MenuEntry {
	name: string;
	description?: string;
	open?: boolean;
	children: Array<MenuEntry | Benchmark>;
}

export function isBenchmark(item: MenuEntry | Benchmark): item is Benchmark {
	return 'displayName' in item;
}

/**
 * Flatten the nested menu tree to its leaf benchmarks, preserving menu order.
 * Cached by root array identity — the menu is fetched once and held in
 * `responseCache`, so subsequent walks (compare, /tasks, /benchmarks,
 * /tasks/[name]) share one traversal instead of re-walking per page.
 */
const _flattenCache = new WeakMap<readonly MenuEntry[], Benchmark[]>();
export function flattenMenu(entries: readonly MenuEntry[]): Benchmark[] {
	const cached = _flattenCache.get(entries);
	if (cached) return cached;
	const out: Benchmark[] = [];
	const walk = (m: MenuEntry) => {
		for (const c of m.children) {
			if (isBenchmark(c)) out.push(c);
			else walk(c);
		}
	};
	for (const m of entries) walk(m);
	_flattenCache.set(entries, out);
	return out;
}

export type ModelType = 'dense' | 'cross-encoder' | 'late-interaction' | 'sparse' | 'router';

export interface ModelMeta {
	name: string;
	displayName: string;
	org: string;
	url?: string;
	zeroShotPct: number;
	// Nullable: backend emits `null` for proprietary models that don't
	// publish param counts.
	activeParamsB: number | null;
	totalParamsB: number | null;
	// Nullable: backend returns `null` for models whose ModelMeta doesn't
	// pin these down (mostly proprietary entries with no published spec).
	embeddingDim: number | null;
	maxTokens: number | null;
	releaseDate?: string;
	modelType: ModelType;
	instructionTuned: boolean;
	openWeights: boolean;
	sentenceTransformersCompatible: boolean;
	// Modalities the model can encode (e.g. ["text"], ["text", "image"]).
	// Defaults to ["text"] when the upstream ModelMeta omits the field.
	modalities?: string[];
	// Display labels (e.g. "English", "Mandarin Chinese") for the
	// languages this model targets. Empty when the upstream meta
	// declares no language scope. Used by the /models filter sidebar.
	languages?: string[];
	citation?: string | null;
	// Extended metadata, all optional. Surfaced on the model detail card.
	memoryUsageMb?: number | null;
	license?: string | null;
	publicTrainingCode?: string | null;
	publicTrainingData?: string | null;
	adaptedFrom?: string | null;
	supersededBy?: string | null;
	extraRequirementsGroups?: string[] | null;
	trainingDatasets?: string[] | null;
}

export interface SummaryRow {
	rank: number;
	model: ModelMeta;
	zeroShotPct: number;
	// Nullable: see ModelMeta — proprietary models leave param counts /
	// architectural specs blank.
	activeParamsB: number | null;
	totalParamsB: number | null;
	embeddingDim: number | null;
	maxTokens: number | null;
	// `null` when the model is missing any task / task-type cell. Don't average
	// partial coverage — it would silently outrank fully-evaluated peers.
	meanTask: number | null;
	meanTaskType: number | null;
	// Public/Private split means for benchmarks that hold out a private task
	// subset (ViDoRe family). `null` for benchmarks without that split.
	meanPublic?: number | null;
	meanPrivate?: number | null;
	scoresByTaskType: Record<string, number>;
	// Flat per-task mean (averaged across subsets / languages). Drives
	// every existing per-task UI; the language filter overrides via
	// the lazy /per-task endpoint when it lands.
	scoresByTask: Record<string, number>;
	// Tasks (within this benchmark) the model declares in its training
	// datasets — used by PerTaskTab to surface a ⚠️ next to scores that
	// the model isn't zero-shot on.
	trainedOnTasks?: string[];
	// Experiment kwargs that produced this row — present only for variant
	// rows (e.g. `{ colbert: true, use_image_modality: false }`). `null` for
	// the canonical base-model row. Multiple rows can share the same
	// `model.name`, distinguished only by `experiments`. Frontend may badge
	// or filter these as ablations without affecting the rest of the schema.
	experiments?: Record<string, unknown> | null;
}

export interface BenchmarkSummary {
	benchmarkName: string;
	taskTypes: string[];
	tasks: string[];
	tasksMeta: TaskMeta[];
	rows: SummaryRow[];
	// Mirrors the Benchmark.aggregations declaration so SummaryTable knows
	// which columns to render without inspecting the score data itself.
	aggregations: BenchmarkAggregation[];
	// Mirrors `Benchmark.showZeroShot` — SummaryTable hides the Zero-shot
	// column when False (ViDoRe / RTEB, where the metric is uniformly 100%).
	showZeroShot?: boolean;
}

// `/v1/benchmarks/{name}/per-language` payload — one row per model with
// its mean main_score per language label (e.g. "English" → 0.732).
// Loaded lazily by PerLanguageTab on mount. Keys match the language
// labels emitted on `Benchmark.languages` / `TaskMeta.languages` so
// joins are direct.
export interface BenchmarkPerLanguageRow {
	modelName: string;
	scoresByLanguage: Record<string, number>;
}
export interface BenchmarkPerLanguage {
	benchmarkName: string;
	rows: BenchmarkPerLanguageRow[];
}

// Slim per-size-bucket response from `/benchmarks/{name}/leaders` —
// used by the home page so we don't have to pull a full /scores
// payload (several MB on multilingual benchmarks) just to render
// 4 mini-leaderboard rows.
export interface LeaderModel {
	// Canonical `org/name` HuggingFace identifier. Consumers split on
	// `/` (via `splitModelName` in `$lib/format`) when they need
	// display-only segments.
	name: string;
	modelType: ModelType;
}
export interface LeaderRow {
	rank: number;
	model: LeaderModel;
	meanTask: number | null;
	totalParamsB: number | null;
}
export interface BucketLeader {
	min: number;
	/** `null` means "open-ended" (>= min). */
	max: number | null;
	leader: LeaderRow | null;
}
export interface BenchmarkLeaders {
	benchmarkName: string;
	buckets: BucketLeader[];
}

export interface TaskScoreRow {
	rank: number;
	model: ModelMeta;
	// `null` when the model wasn't evaluated on every subset of this task —
	// rendering a partial-coverage mean would falsely outrank fully-scored
	// peers, so the API leaves it blank.
	score: number | null;
	subsetScores: Record<string, number>;
	benchmarks: string[];
	// Three-state per-task training-overlap signal from the backend:
	//   true  → task is in `model.trainingDatasets` (matches PerTaskTab's ⚠️)
	//   false → model declared its training data and this task isn't in it
	//   null  → model didn't declare `trainingDatasets` (rendered as NA)
	trainedOn: boolean | null;
}

export interface TaskScores {
	task: TaskMeta;
	benchmarks: string[];
	subsets: string[];
	rows: TaskScoreRow[];
}

export interface ModelScoreRow {
	benchmarkName: string;
	benchmarkDisplayName: string;
	rank: number;
	totalModels: number;
	meanTask: number | null;
	meanTaskType: number | null;
	zeroShotPct: number;
	taskTypes: string[];
	scoresByTaskType: Record<string, number>;
}

export interface ModelScores {
	model: ModelMeta;
	rows: ModelScoreRow[];
}

export interface TaskFilters {
	languages?: string[];
	types?: string[];
	domains?: string[];
	modalities?: string[];
	categories?: string[];
	name?: string;
}

export interface ModelFilters {
	modelTypes?: string[];
	frameworks?: string[];
	openWeights?: boolean;
	instructionTuned?: boolean;
	minParamsB?: number;
	maxParamsB?: number;
	modalities?: string[];
	exclusiveModality?: boolean;
	name?: string;
}
