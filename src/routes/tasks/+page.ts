// Fetches the task registry + menu, runs facet derivation, ships as
// `TasksData`.
import type { PageLoad } from './$types';
import { loadBenchmarkMenu, loadTasks } from '$lib/data/service';
import { flattenMenu } from '$lib/types';
import { COLLATOR } from '$lib/format';

export const prerender = true;

export interface TaskEntry {
	name: string;
	// Memoised — name-search runs over 1700+ entries per keystroke.
	nameLower: string;
	type: string;
	simplifiedType: string;
	languages: string[];
	domains: string[];
	modalities: string[];
	description: string;
	benchmarks: string[];
	mainScore: string;
	/** Backend overlay; 0 when the cache isn't filled. */
	numModels: number;
}

export interface TasksData {
	tasks: TaskEntry[];
	simplifiedPresent: string[];
	modalities: string[];
	domains: string[];
	languages: string[];
}

// Curated order — matches the `.type-pill[data-stype=…]` palette on the page.
const SIMPLIFIED_TYPES = [
	'retrieval',
	'classification',
	'pair-classification',
	'clustering',
	'semantic-similarity'
] as const;

export const load: PageLoad = ({ fetch }) => {
	return { tasks: deriveTasksData(fetch) };
};

async function deriveTasksData(fetchFn?: typeof fetch): Promise<TasksData> {
	const [menu, tasks] = await Promise.all([loadBenchmarkMenu(fetchFn), loadTasks({}, fetchFn)]);
	const allBenches = flattenMenu(menu);
	const occurrences = new Map<string, string[]>();
	for (const b of allBenches) {
		for (const t of b.tasks) {
			const list = occurrences.get(t) ?? [];
			list.push(b.name);
			occurrences.set(t, list);
		}
	}
	// Single-pass extraction over the 1700+ task registry.
	const modSet = new Set<string>();
	const domSet = new Set<string>();
	const langCount = new Map<string, number>();
	const presentSet = new Set<string>();
	const entries: TaskEntry[] = new Array(tasks.length);
	for (let i = 0; i < tasks.length; i++) {
		const m = tasks[i];
		const simplifiedType = m.simplifiedType ?? m.type?.toLowerCase() ?? '';
		const modalities =
			m.modalities ??
			((m as unknown as { modality?: string }).modality
				? [(m as unknown as { modality: string }).modality]
				: []);
		const languages = m.languages ?? [];
		const domains = m.domains ?? [];
		entries[i] = {
			name: m.name,
			nameLower: m.name.toLowerCase(),
			type: m.type,
			simplifiedType,
			languages,
			domains,
			modalities,
			description: m.description ?? '',
			benchmarks: occurrences.get(m.name) ?? [],
			mainScore: m.mainScore ?? '',
			numModels: m.numModels ?? 0
		};
		presentSet.add(simplifiedType);
		for (const x of modalities) modSet.add(x);
		for (const x of domains) domSet.add(x);
		for (const x of languages) langCount.set(x, (langCount.get(x) ?? 0) + 1);
	}
	entries.sort((a, b) => COLLATOR.compare(a.name, b.name));
	const simplifiedPresent = [
		...SIMPLIFIED_TYPES.filter((t) => presentSet.has(t)),
		...[...presentSet].filter((t) => !SIMPLIFIED_TYPES.includes(t as never)).sort()
	];
	const modalities = [...modSet].sort();
	const domains = [...domSet].sort();
	const languages = [...langCount.entries()]
		.sort((a, b) => b[1] - a[1] || COLLATOR.compare(a[0], b[0]))
		.map(([l]) => l);
	return { tasks: entries, simplifiedPresent, modalities, domains, languages };
}
