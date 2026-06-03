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
	tasks: string[];
	domains: string[];
	modalities: string[];
	// Backend may flag a benchmark as hidden from the curated menu
	// (`display_on_leaderboard=False`); /benchmarks?include_hidden=true returns
	// them so the all-benchmarks page can still surface them.
	displayOnLeaderboard?: boolean;
	// Names of newer benchmarks that supersede this one.
	newVersion?: string[] | null;
	// Aggregation columns this benchmark's summary table should render. Mirrors
	// `Benchmark.aggregations` upstream — frontend uses it to hide irrelevant
	// columns (ViDoRe has no per-type breakdown; RTEB has only Mean (Task)).
	aggregations: BenchmarkAggregation[];
	// Distinct models with at least one score on this benchmark. Surfaced on
	// the catalogue / home benchmark cards so the user can size up coverage
	// without opening each benchmark. Set by the backend from the cached
	// per-benchmark frames; `0` means unknown (cache not populated) or empty.
	numModels?: number;
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

export type ModelType = 'dense' | 'cross-encoder' | 'late-interaction' | 'sparse' | 'router';

export interface ModelMeta {
	name: string;
	displayName: string;
	org: string;
	url?: string;
	zeroShotPct: number;
	activeParamsB: number;
	totalParamsB: number;
	embeddingDim: number;
	maxTokens: number;
	releaseDate?: string;
	modelType: ModelType;
	instructionTuned: boolean;
	openWeights: boolean;
	sentenceTransformersCompatible: boolean;
	// Modalities the model can encode (e.g. ["text"], ["text", "image"]).
	// Defaults to ["text"] when the upstream ModelMeta omits the field.
	modalities?: string[];
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
	activeParamsB: number;
	totalParamsB: number;
	embeddingDim: number;
	maxTokens: number;
	// `null` when the model is missing any task / task-type cell. Don't average
	// partial coverage — it would silently outrank fully-evaluated peers.
	meanTask: number | null;
	meanTaskType: number | null;
	// Public/Private split means for benchmarks that hold out a private task
	// subset (ViDoRe family). `null` for benchmarks without that split.
	meanPublic?: number | null;
	meanPrivate?: number | null;
	scoresByTaskType: Record<string, number>;
	scoresByTask: Record<string, number>;
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
