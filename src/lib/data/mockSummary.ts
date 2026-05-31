import type { BenchmarkSummary, ModelMeta, ModelType, SummaryRow, TaskMeta } from '$lib/types';
import { BENCHMARK_INDEX } from './mockBenchmarks';

interface MockModel {
	name: string;
	url: string;
	zeroShotPct: number;
	activeParamsB: number;
	totalParamsB: number;
	embeddingDim: number;
	maxTokens: number;
	baseScore: number;
	releaseDate: string;
	modelType: ModelType;
	instructionTuned: boolean;
	openWeights: boolean;
	sentenceTransformersCompatible: boolean;
}

const MOCK_MODELS: MockModel[] = [
	{
		name: 'gemini-embedding-001',
		url: 'https://ai.google.dev/gemini-api/docs/embeddings',
		zeroShotPct: -1,
		activeParamsB: 0,
		totalParamsB: 0,
		embeddingDim: 3072,
		maxTokens: 2048,
		baseScore: 0.682,
		releaseDate: '2025-03-12',
		modelType: 'dense',
		instructionTuned: true,
		openWeights: false,
		sentenceTransformersCompatible: false
	},
	{
		name: 'qwen3-embedding-8b',
		url: 'https://huggingface.co/Qwen/Qwen3-Embedding-8B',
		zeroShotPct: 95,
		activeParamsB: 7.6,
		totalParamsB: 7.6,
		embeddingDim: 4096,
		maxTokens: 32768,
		baseScore: 0.674,
		releaseDate: '2025-06-05',
		modelType: 'dense',
		instructionTuned: true,
		openWeights: true,
		sentenceTransformersCompatible: true
	},
	{
		name: 'qwen3-embedding-4b',
		url: 'https://huggingface.co/Qwen/Qwen3-Embedding-4B',
		zeroShotPct: 95,
		activeParamsB: 4.0,
		totalParamsB: 4.0,
		embeddingDim: 2560,
		maxTokens: 32768,
		baseScore: 0.663,
		releaseDate: '2025-06-05',
		modelType: 'dense',
		instructionTuned: true,
		openWeights: true,
		sentenceTransformersCompatible: true
	},
	{
		name: 'Linq-Embed-Mistral',
		url: 'https://huggingface.co/Linq-AI-Research/Linq-Embed-Mistral',
		zeroShotPct: 88,
		activeParamsB: 7.1,
		totalParamsB: 7.1,
		embeddingDim: 4096,
		maxTokens: 32768,
		baseScore: 0.638,
		releaseDate: '2024-05-29',
		modelType: 'dense',
		instructionTuned: true,
		openWeights: true,
		sentenceTransformersCompatible: true
	},
	{
		name: 'voyage-3-large',
		url: 'https://docs.voyageai.com/docs/embeddings',
		zeroShotPct: -1,
		activeParamsB: 0,
		totalParamsB: 0,
		embeddingDim: 1024,
		maxTokens: 32000,
		baseScore: 0.625,
		releaseDate: '2025-01-21',
		modelType: 'dense',
		instructionTuned: true,
		openWeights: false,
		sentenceTransformersCompatible: false
	},
	{
		name: 'qwen3-embedding-0.6b',
		url: 'https://huggingface.co/Qwen/Qwen3-Embedding-0.6B',
		zeroShotPct: 95,
		activeParamsB: 0.6,
		totalParamsB: 0.6,
		embeddingDim: 1024,
		maxTokens: 32768,
		baseScore: 0.612,
		releaseDate: '2025-06-05',
		modelType: 'dense',
		instructionTuned: true,
		openWeights: true,
		sentenceTransformersCompatible: true
	},
	{
		name: 'NV-Embed-v2',
		url: 'https://huggingface.co/nvidia/NV-Embed-v2',
		zeroShotPct: 82,
		activeParamsB: 7.85,
		totalParamsB: 7.85,
		embeddingDim: 4096,
		maxTokens: 32768,
		baseScore: 0.604,
		releaseDate: '2024-09-09',
		modelType: 'dense',
		instructionTuned: true,
		openWeights: true,
		sentenceTransformersCompatible: true
	},
	{
		name: 'bge-multilingual-gemma2',
		url: 'https://huggingface.co/BAAI/bge-multilingual-gemma2',
		zeroShotPct: 90,
		activeParamsB: 9.24,
		totalParamsB: 9.24,
		embeddingDim: 3584,
		maxTokens: 8192,
		baseScore: 0.598,
		releaseDate: '2024-07-25',
		modelType: 'dense',
		instructionTuned: true,
		openWeights: true,
		sentenceTransformersCompatible: true
	},
	{
		name: 'text-embedding-3-large',
		url: 'https://platform.openai.com/docs/guides/embeddings',
		zeroShotPct: -1,
		activeParamsB: 0,
		totalParamsB: 0,
		embeddingDim: 3072,
		maxTokens: 8191,
		baseScore: 0.589,
		releaseDate: '2024-01-25',
		modelType: 'dense',
		instructionTuned: false,
		openWeights: false,
		sentenceTransformersCompatible: false
	},
	{
		name: 'multilingual-e5-large-instruct',
		url: 'https://huggingface.co/intfloat/multilingual-e5-large-instruct',
		zeroShotPct: 100,
		activeParamsB: 0.56,
		totalParamsB: 0.56,
		embeddingDim: 1024,
		maxTokens: 514,
		baseScore: 0.581,
		releaseDate: '2024-02-08',
		modelType: 'dense',
		instructionTuned: true,
		openWeights: true,
		sentenceTransformersCompatible: true
	},
	{
		name: 'jina-colbert-v2',
		url: 'https://huggingface.co/jinaai/jina-colbert-v2',
		zeroShotPct: 100,
		activeParamsB: 0.56,
		totalParamsB: 0.56,
		embeddingDim: 128,
		maxTokens: 8192,
		baseScore: 0.554,
		releaseDate: '2024-08-30',
		modelType: 'late-interaction',
		instructionTuned: false,
		openWeights: true,
		sentenceTransformersCompatible: false
	},
	{
		name: 'mxbai-rerank-large-v2',
		url: 'https://huggingface.co/mixedbread-ai/mxbai-rerank-large-v2',
		zeroShotPct: 100,
		activeParamsB: 1.5,
		totalParamsB: 1.5,
		embeddingDim: 0,
		maxTokens: 8192,
		baseScore: 0.541,
		releaseDate: '2025-03-04',
		modelType: 'cross-encoder',
		instructionTuned: false,
		openWeights: true,
		sentenceTransformersCompatible: false
	},
	{
		name: 'splade-v3',
		url: 'https://huggingface.co/naver/splade-v3',
		zeroShotPct: 100,
		activeParamsB: 0.11,
		totalParamsB: 0.11,
		embeddingDim: 30522,
		maxTokens: 256,
		baseScore: 0.498,
		releaseDate: '2024-03-18',
		modelType: 'sparse',
		instructionTuned: false,
		openWeights: true,
		sentenceTransformersCompatible: false
	}
];

function hashSeed(str: string): number {
	let h = 2166136261;
	for (let i = 0; i < str.length; i++) {
		h ^= str.charCodeAt(i);
		h = (h * 16777619) >>> 0;
	}
	return h;
}

function jitter(seed: number, idx: number): number {
	const x = Math.sin(seed + idx * 1313) * 10000;
	return x - Math.floor(x);
}

function clamp(n: number, lo = 0, hi = 1): number {
	return Math.max(lo, Math.min(hi, n));
}

function buildRow(
	model: MockModel,
	taskTypes: string[],
	tasks: string[],
	benchmarkSeed: number,
	idx: number
): SummaryRow {
	const meta: ModelMeta = {
		name: model.name,
		displayName: model.name,
		url: model.url,
		zeroShotPct: model.zeroShotPct,
		activeParamsB: model.activeParamsB,
		totalParamsB: model.totalParamsB,
		embeddingDim: model.embeddingDim,
		maxTokens: model.maxTokens,
		releaseDate: model.releaseDate,
		modelType: model.modelType,
		instructionTuned: model.instructionTuned,
		openWeights: model.openWeights,
		sentenceTransformersCompatible: model.sentenceTransformersCompatible
	};

	const scoresByTaskType: Record<string, number> = {};
	let total = 0;
	for (let i = 0; i < taskTypes.length; i++) {
		const noise = (jitter(benchmarkSeed + idx, i) - 0.5) * 0.18;
		const s = clamp(model.baseScore + noise, 0, 0.99);
		scoresByTaskType[taskTypes[i]] = s;
		total += s;
	}
	const meanTaskType = total / Math.max(taskTypes.length, 1);
	// meanTask drifts slightly from meanTaskType.
	const meanTask = clamp(meanTaskType + (jitter(benchmarkSeed, idx) - 0.5) * 0.02);

	// Per-task scores: anchor each task to its task type's score, then jitter.
	const scoresByTask: Record<string, number> = {};
	for (let i = 0; i < tasks.length; i++) {
		const baseTT = taskTypes[i % Math.max(taskTypes.length, 1)] ?? '';
		const base = scoresByTaskType[baseTT] ?? model.baseScore;
		const noise = (jitter(benchmarkSeed + idx * 31, i + 7) - 0.5) * 0.12;
		scoresByTask[tasks[i]] = clamp(base + noise, 0, 0.99);
	}

	return {
		rank: 0,
		model: meta,
		zeroShotPct: model.zeroShotPct,
		activeParamsB: model.activeParamsB,
		totalParamsB: model.totalParamsB,
		embeddingDim: model.embeddingDim,
		maxTokens: model.maxTokens,
		meanTask,
		meanTaskType,
		scoresByTaskType,
		scoresByTask
	};
}

function buildTasksMeta(
	tasks: string[],
	taskTypes: string[],
	languages: string[],
	domains: string[],
	modalities: string[]
): TaskMeta[] {
	if (tasks.length === 0) return [];
	const nLangs = Math.max(1, Math.min(3, languages.length));
	return tasks.map((name, i) => {
		const taskLangs: string[] = [];
		for (let j = 0; j < nLangs; j++) {
			taskLangs.push(languages[(i * 7 + j * 13) % languages.length]);
		}
		const domain = domains.length > 0 ? domains[i % domains.length] : 'Web';
		return {
			name,
			type: taskTypes[i % Math.max(taskTypes.length, 1)] ?? 'Retrieval',
			languages: Array.from(new Set(taskLangs)),
			domains: [domain],
			modality: modalities[i % Math.max(modalities.length, 1)] ?? 'text'
		};
	});
}

export function buildMockSummary(benchmarkName: string): BenchmarkSummary {
	const benchmark = BENCHMARK_INDEX[benchmarkName];
	const taskTypes = benchmark?.taskTypes ?? ['Classification', 'Retrieval', 'STS'];
	const tasks = benchmark?.tasks ?? [];
	const languages = benchmark?.languages ?? ['eng-Latn'];
	const domains = benchmark?.domains ?? [];
	const modalities = benchmark?.modalities ?? ['text'];
	const seed = hashSeed(benchmarkName);

	const tasksMeta = buildTasksMeta(tasks, taskTypes, languages, domains, modalities);

	const rows = MOCK_MODELS.map((m, i) => buildRow(m, taskTypes, tasks, seed, i));
	rows.sort((a, b) => b.meanTask - a.meanTask);
	rows.forEach((r, i) => (r.rank = i + 1));

	return {
		benchmarkName,
		taskTypes,
		tasks,
		tasksMeta,
		rows
	};
}
