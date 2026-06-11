// Prerendered for ShareMeta. Eagerly awaits `loadModel`; streams `loadModelScores`
// so the card hero paints before the slow scores fetch resolves.
import type { EntryGenerator, PageLoad } from './$types';
import { loadModel, loadModels, loadModelScores } from '$lib/data/service';
import type { ModelMeta, ModelScores } from '$lib/types';

export const prerender = true;

export const entries: EntryGenerator = async () => {
	const models = await loadModels();
	return models.map((m) => ({ name: m.name }));
};

// Discriminated union so the streamed promise never rejects — prerender would
// crash on unhandled rejections.
export type ScoresResult = { ok: true; data: ModelScores } | { ok: false; error: string };

export interface ModelPageData {
	modelName: string;
	model: ModelMeta | null;
	modelError: string | null;
	scores: Promise<ScoresResult>;
}

export const load: PageLoad = async ({ params, fetch }): Promise<ModelPageData> => {
	const modelName = decodeURIComponent(params.name);
	// Catch so a missing model still renders the card shell instead of a 500.
	const meta = await loadModel(modelName, fetch).then(
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
		scores: loadModelScores(modelName, fetch).then(
			(s): ScoresResult => ({ ok: true, data: s }),
			(e): ScoresResult => ({ ok: false, error: e instanceof Error ? e.message : String(e) })
		)
	};
};
