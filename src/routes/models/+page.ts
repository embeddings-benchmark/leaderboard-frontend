import type { PageLoad } from './$types';
import { loadModels } from '$lib/data/service';
import type { ModelMeta } from '$lib/types';

// Prerender so ShareMeta's `<title>` + `<meta og:…>` end up in the static
// HTML for social-media crawlers. The page hydrates with live data on
// the client via the streamed promise returned below.
export const prerender = true;

export interface ModelsData {
	models: ModelMeta[];
	// Languages declared by at least one model, sorted by popularity
	// (most-tagged first, alphabetical tie-break). Drives the page-local
	// `languagesPicked` SvelteSet. Always derived here (not on the page)
	// so the page consumes one resolved shape and the loader does the
	// one-pass union once at prerender / cache fill.
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

// Returns the derived data as an UNRESOLVED promise so client-side nav
// paints the shell + skeleton immediately. Prerender awaits the promise
// before writing static HTML, so direct visits skip the skeleton.
export const load: PageLoad = ({ fetch }) => {
	return { models: deriveModelsData(fetch) };
};
