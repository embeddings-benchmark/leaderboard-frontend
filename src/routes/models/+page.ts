import type { PageLoad } from './$types';
import { loadModels } from '$lib/data/service';
import type { ModelMeta } from '$lib/types';

// Prerendered so ShareMeta lands in static HTML.
export const prerender = true;

export interface ModelsData {
	models: ModelMeta[];
	/** Sorted by popularity, alphabetical tie-break. */
	languages: string[];
}

async function deriveModelsData(fetchFn?: typeof fetch): Promise<ModelsData> {
	const models = await loadModels({}, fetchFn);
	const langCount = new Map<string, number>();
	for (const m of models)
		for (const l of m.languages ?? []) langCount.set(l, (langCount.get(l) ?? 0) + 1);
	const languages = [...langCount.entries()]
		.sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0]))
		.map(([l]) => l);
	return { models, languages };
}

export const load: PageLoad = ({ fetch }) => {
	return { models: deriveModelsData(fetch) };
};
