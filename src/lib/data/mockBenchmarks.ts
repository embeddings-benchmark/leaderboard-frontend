import type { Benchmark, MenuEntry } from '$lib/types';

export const COMMON_DOMAINS = [
	'Academic',
	'Blog',
	'Constructed',
	'Encyclopaedic',
	'Entertainment',
	'Fiction',
	'Financial',
	'Government',
	'Legal',
	'Medical',
	'News',
	'Non-fiction',
	'Programming',
	'Religious',
	'Reviews',
	'Social',
	'Spoken',
	'Subtitles',
	'Web',
	'Written'
];

// Curated multilingual ISO-639-3 + ISO-15924 sample. Used for the language filter
// list. The displayed "number of languages" stat is decoupled from this list so
// the description can still claim large numbers like 250.
export const MMTEB_LANGUAGES = [
	'eng-Latn',
	'fra-Latn',
	'deu-Latn',
	'spa-Latn',
	'por-Latn',
	'ita-Latn',
	'nld-Latn',
	'pol-Latn',
	'rus-Cyrl',
	'ukr-Cyrl',
	'ces-Latn',
	'swe-Latn',
	'nor-Latn',
	'dan-Latn',
	'fin-Latn',
	'tur-Latn',
	'zho-Hans',
	'zho-Hant',
	'jpn-Jpan',
	'kor-Kore',
	'tha-Thai',
	'vie-Latn',
	'ind-Latn',
	'msa-Latn',
	'tgl-Latn',
	'hin-Deva',
	'ben-Beng',
	'urd-Arab',
	'fas-Arab',
	'ara-Arab',
	'heb-Hebr',
	'ell-Grek',
	'swa-Latn',
	'yor-Latn',
	'hau-Latn',
	'amh-Ethi'
];

function makeBenchmark(partial: Partial<Benchmark> & { name: string }): Benchmark {
	return {
		displayName: partial.displayName ?? partial.name,
		description:
			partial.description ??
			`Mock description for ${partial.name}. The real description will come from the mteb backend.`,
		reference: partial.reference,
		citation: partial.citation,
		languages: partial.languages ?? ['eng-Latn'],
		taskTypes: partial.taskTypes ?? [
			'Classification',
			'Clustering',
			'PairClassification',
			'Reranking',
			'Retrieval',
			'STS',
			'Summarization'
		],
		tasks: partial.tasks ?? [],
		domains: partial.domains ?? ['Web', 'News', 'Academic'],
		modalities: partial.modalities ?? ['text'],
		...partial
	};
}

const MTEB_MULTILINGUAL_V2 = makeBenchmark({
	name: 'MTEB(Multilingual, v2)',
	displayName: 'MTEB(Multilingual, v2)',
	description:
		'A large-scale multilingual expansion of MTEB known as MMTEB, driven mainly by highly-curated community contributions covering 250+ languages.',
	reference: 'https://arxiv.org/abs/2502.13595',
	languages: MMTEB_LANGUAGES,
	tasks: Array.from({ length: 132 }, (_, i) => `Task_${i + 1}`),
	domains: COMMON_DOMAINS,
	modalities: ['text'],
	taskTypes: [
		'BitextMining',
		'Classification',
		'Clustering',
		'InstructionReranking',
		'MultilabelClassification',
		'PairClassification',
		'Reranking',
		'Retrieval',
		'STS'
	],
	citation: `@article{enevoldsen2025mmteb,
  title={MMTEB: Massive Multilingual Text Embedding Benchmark},
  author={Enevoldsen, Kenneth and Chung, Isaac and Kerboua, Imene and Kardos, M{\\'a}rton and others},
  journal={arXiv preprint arXiv:2502.13595},
  year={2025}
}`
});

const MTEB_ENG_V2 = makeBenchmark({
	name: 'MTEB(eng, v2)',
	displayName: 'MTEB(eng, v2)',
	description: 'English-focused MTEB v2 benchmark.',
	reference: 'https://arxiv.org/abs/2210.07316',
	languages: ['eng-Latn'],
	domains: COMMON_DOMAINS,
	tasks: Array.from({ length: 56 }, (_, i) => `EngTask_${i + 1}`),
	citation: `@article{muennighoff2022mteb,
  title={MTEB: Massive Text Embedding Benchmark},
  author={Muennighoff, Niklas and Tazi, Nouamane and Magne, Lo{\\"\\i}c and Reimers, Nils},
  journal={arXiv preprint arXiv:2210.07316},
  year={2022}
}`
});

const HUME_V1 = makeBenchmark({
	name: 'HUME(v1)',
	displayName: 'Human Benchmark',
	description: 'Human-curated benchmark for embedding models.',
	tasks: Array.from({ length: 10 }, (_, i) => `Hume_${i + 1}`)
});

const MIEB_MULTILINGUAL = makeBenchmark({
	name: 'MIEB(Multilingual)',
	description: 'Multilingual Image Embedding Benchmark.'
});
const MIEB_ENG = makeBenchmark({ name: 'MIEB(eng)' });
const MIEB_LITE = makeBenchmark({ name: 'MIEB(lite)' });
const MIEB_IMG = makeBenchmark({ name: 'MIEB(Img)' });

const MAEB_BETA = makeBenchmark({ name: 'MAEB(beta)' });
const MAEB_AUDIO_ONLY = makeBenchmark({ name: 'MAEB(beta, audio-only)' });

const MTEB_CODE = makeBenchmark({ name: 'MTEB(Code, v1)' });
const MTEB_LAW = makeBenchmark({ name: 'MTEB(Law, v1)' });
const MTEB_MEDICAL = makeBenchmark({ name: 'MTEB(Medical, v1)' });
const CHEM_TEB = makeBenchmark({ name: 'ChemTEB' });
const COREB = makeBenchmark({ name: 'CoREB(v1)' });

const MTEB_EUROPE = makeBenchmark({ name: 'MTEB(Europe, v1)' });
const MTEB_INDIC = makeBenchmark({ name: 'MTEB(Indic, v1)' });
const MTEB_SCAND = makeBenchmark({ name: 'MTEB(Scandinavian, v1)' });
const MTEB_CMN = makeBenchmark({ name: 'MTEB(cmn, v1)' });
const MTEB_DEU = makeBenchmark({ name: 'MTEB(deu, v1)' });
const MTEB_FRA = makeBenchmark({ name: 'MTEB(fra, v1)' });

const RTEB_BETA = makeBenchmark({ name: 'RTEB(beta)' });
const RTEB_ENG = makeBenchmark({ name: 'RTEB(eng, beta)' });
const VIDORE_V3 = makeBenchmark({ name: 'ViDoRe(v3)' });
const JINA_VDR = makeBenchmark({ name: 'JinaVDR' });
const VIDORE_V1V2 = makeBenchmark({ name: 'ViDoRe(v1&v2)' });

const RTEB_FIN = makeBenchmark({ name: 'RTEB(fin, beta)' });
const RTEB_LAW = makeBenchmark({ name: 'RTEB(Law, beta)' });
const RTEB_CODE = makeBenchmark({ name: 'RTEB(Code, beta)' });
const COIR = makeBenchmark({ name: 'CoIR' });
const RTEB_HEALTH = makeBenchmark({ name: 'RTEB(Health, beta)' });
const FOLLOW_IR = makeBenchmark({ name: 'FollowIR' });
const LONG_EMBED = makeBenchmark({ name: 'LongEmbed' });
const BRIGHT = makeBenchmark({ name: 'BRIGHT' });

const BEIR = makeBenchmark({ name: 'BEIR' });
const NANO_BEIR = makeBenchmark({ name: 'NanoBEIR' });

export const BENCHMARK_INDEX: Record<string, Benchmark> = Object.fromEntries(
	[
		MTEB_MULTILINGUAL_V2,
		MTEB_ENG_V2,
		HUME_V1,
		MIEB_MULTILINGUAL,
		MIEB_ENG,
		MIEB_LITE,
		MIEB_IMG,
		MAEB_BETA,
		MAEB_AUDIO_ONLY,
		MTEB_CODE,
		MTEB_LAW,
		MTEB_MEDICAL,
		CHEM_TEB,
		COREB,
		MTEB_EUROPE,
		MTEB_INDIC,
		MTEB_SCAND,
		MTEB_CMN,
		MTEB_DEU,
		MTEB_FRA,
		RTEB_BETA,
		RTEB_ENG,
		VIDORE_V3,
		JINA_VDR,
		VIDORE_V1V2,
		RTEB_FIN,
		RTEB_LAW,
		RTEB_CODE,
		COIR,
		RTEB_HEALTH,
		FOLLOW_IR,
		LONG_EMBED,
		BRIGHT,
		BEIR,
		NANO_BEIR
	].map((b) => [b.name, b])
);

export const DEFAULT_BENCHMARK_NAME = MTEB_MULTILINGUAL_V2.name;

export const BENCHMARK_MENU: MenuEntry[] = [
	{
		name: 'General Purpose',
		open: true,
		children: [
			MTEB_MULTILINGUAL_V2,
			MTEB_ENG_V2,
			HUME_V1,
			{
				name: 'Image',
				children: [MIEB_MULTILINGUAL, MIEB_ENG, MIEB_LITE, MIEB_IMG]
			},
			{
				name: 'Audio',
				children: [MAEB_BETA, MAEB_AUDIO_ONLY]
			},
			{
				name: 'Domain-Specific',
				children: [MTEB_CODE, MTEB_LAW, MTEB_MEDICAL, CHEM_TEB, COREB]
			},
			{
				name: 'Language-specific',
				children: [
					MTEB_EUROPE,
					MTEB_INDIC,
					MTEB_SCAND,
					MTEB_CMN,
					MTEB_DEU,
					MTEB_FRA
				]
			},
			{
				name: 'Miscellaneous',
				children: []
			}
		]
	},
	{
		name: 'Retrieval',
		open: true,
		children: [
			RTEB_BETA,
			RTEB_ENG,
			{
				name: 'Image',
				open: true,
				children: [
					VIDORE_V3,
					JINA_VDR,
					{ name: 'Other', children: [VIDORE_V1V2] }
				]
			},
			{
				name: 'Domain-Specific',
				children: [
					RTEB_FIN,
					RTEB_LAW,
					RTEB_CODE,
					COIR,
					RTEB_HEALTH,
					FOLLOW_IR,
					LONG_EMBED,
					BRIGHT
				]
			},
			{
				name: 'Language-specific',
				children: [BEIR]
			},
			{
				name: 'Miscellaneous',
				children: [NANO_BEIR]
			}
		]
	}
];
