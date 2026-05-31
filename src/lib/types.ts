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
}

export interface TaskMeta {
	name: string;
	type: string;
	languages: string[];
	domains: string[];
	modality: string;
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

export type ModelType =
	| 'dense'
	| 'cross-encoder'
	| 'late-interaction'
	| 'sparse'
	| 'router';

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
}

export interface SummaryRow {
	rank: number;
	model: ModelMeta;
	zeroShotPct: number;
	activeParamsB: number;
	totalParamsB: number;
	embeddingDim: number;
	maxTokens: number;
	meanTask: number;
	meanTaskType: number;
	scoresByTaskType: Record<string, number>;
	scoresByTask: Record<string, number>;
}

export interface BenchmarkSummary {
	benchmarkName: string;
	taskTypes: string[];
	tasks: string[];
	tasksMeta: TaskMeta[];
	rows: SummaryRow[];
}
