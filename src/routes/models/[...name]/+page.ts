// Prerender every model detail page at build time so per-entity
// ShareMeta tags land in the static HTML. The route uses `[...name]`
// (rest param) because model identifiers are `org/name` — SvelteKit
// passes the raw string through, slashes and all.
//
// The loader awaits `loadModel` (cheap registry lookup) eagerly and
// streams `loadModelScores` (walks every benchmark summary — slow on
// a cold backend cache). On client-side nav the page paints the card
// hero immediately and shows a skeleton over the score table until the
// stream resolves.
import type { EntryGenerator, PageLoad } from './$types';
import { loadModel, loadModels, loadModelScores } from '$lib/data/service';
import type { ModelMeta, ModelScores } from '$lib/types';

export const prerender = true;

export const entries: EntryGenerator = async () => {
	const models = await loadModels();
	return models.map((m) => ({ name: m.name }));
};

// Streamed promises that reject during prerender crash the build with an
// unhandled rejection. Wrap the scores fetch in a discriminated-union
// result so the promise itself never rejects — the page reads `.ok` and
// renders the in-card error fallback for failures.
export type ScoresResult = { ok: true; data: ModelScores } | { ok: false; error: string };

export interface ModelPageData {
	modelName: string;
	model: ModelMeta | null;
	modelError: string | null;
	scores: Promise<ScoresResult>;
}

export const load: PageLoad = async ({ params }): Promise<ModelPageData> => {
	const modelName = decodeURIComponent(params.name);
	// Catch the metadata fetch so a missing model still renders the card
	// shell + the streamed error fallback for scores instead of a 500.
	const meta = await loadModel(modelName).then(
		(m) => ({ model: m, error: null as string | null }),
		(e) => ({
			model: null as ModelMeta | null,
			error: e instanceof Error ? e.message : String(e)
		})
	);
	return {
		modelName,
		model: meta.model,
		modelError: meta.error,
		scores: loadModelScores(modelName).then(
			(s): ScoresResult => ({ ok: true, data: s }),
			(e): ScoresResult => ({ ok: false, error: e instanceof Error ? e.message : String(e) })
		)
	};
};
