// /tasks loader. Fetches the full task registry + benchmark menu and runs
// the per-task occurrence/facet derivation once at prerender time so the
// static HTML carries the derived `TasksData` shape directly. On client-
// side navigation the loader replays via `cachedHttp` (already warm from
// preload-on-hover) and runs the derivation pass in <10ms.
import type { PageLoad } from './$types';
import { loadBenchmarkMenu, loadTasks } from '$lib/data/service';
import { flattenMenu } from '$lib/types';
import { COLLATOR } from '$lib/format';

export const prerender = true;

export interface TaskEntry {
	name: string;
	// Lowercased name cached at load — the name-search keystroke filter
	// runs 1700x per recompute, so a per-entry `.toLowerCase()` would
	// allocate 1700 strings per stroke. Memoised once here.
	nameLower: string;
	type: string;
	simplifiedType: string;
	languages: string[];
	domains: string[];
	modalities: string[];
	description: string;
	benchmarks: string[];
	mainScore: string;
	// Distinct models evaluated on this task — backend overlay from the
	// unified results frame. `0` for tasks the cache hasn't filled in.
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

// Streamed so client-side nav from another page paints the /tasks shell +
// skeleton immediately, then swaps in real content when the derivation
// resolves. Prerender awaits before writing the static HTML, so direct
// visits skip the skeleton entirely.
export const load: PageLoad = () => {
	return { tasks: deriveTasksData() };
};

async function deriveTasksData(): Promise<TasksData> {
	const [menu, tasks] = await Promise.all([loadBenchmarkMenu(), loadTasks()]);
	const allBenches = flattenMenu(menu);
	const occurrences = new Map<string, string[]>();
	for (const b of allBenches) {
		for (const t of b.tasks) {
			const list = occurrences.get(t) ?? [];
			list.push(b.name);
			occurrences.set(t, list);
		}
	}
	// Build entries + extract every facet in one pass over the 1700+ task
	// registry. Fuses what used to be four separate flatMap+Set traversals
	// into one walk.
	const modSet = new Set<string>();
	const domSet = new Set<string>();
	// Count per language so the filter pills sort by popularity.
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
	// Curated order first, then any extras alphabetised.
	const simplifiedPresent = [
		...SIMPLIFIED_TYPES.filter((t) => presentSet.has(t)),
		...[...presentSet].filter((t) => !SIMPLIFIED_TYPES.includes(t as never)).sort()
	];
	const modalities = [...modSet].sort();
	const domains = [...domSet].sort();
	// Descending by usage count, alphabetical tie-break.
	const languages = [...langCount.entries()]
		.sort((a, b) => b[1] - a[1] || COLLATOR.compare(a[0], b[0]))
		.map(([l]) => l);
	return { tasks: entries, simplifiedPresent, modalities, domains, languages };
}
