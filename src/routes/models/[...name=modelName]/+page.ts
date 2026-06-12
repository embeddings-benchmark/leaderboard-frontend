// Prerendered for ShareMeta. Eagerly awaits `loadModel`; streams `loadModelScores`
// so the card hero paints before the slow scores fetch resolves.
import { error } from '@sveltejs/kit';
import type { EntryGenerator, PageLoad } from './$types';
import { HttpError, loadModel, loadModels, loadModelScores } from '$lib/data/service';
import type { ModelMeta, ModelScores } from '$lib/types';

export const prerender = true;

export const entries: EntryGenerator = async () => {
	const models = await loadModels();
	return models.map((m) => ({ name: m.name }));
};

// Discriminated union so the streamed promise never rejects — prerender would
// crash on unhandled rejections. Transient scores-fetch failures shouldn't
// 404 the whole page; only a missing model does.
export type ScoresResult = { ok: true; data: ModelScores } | { ok: false; error: string };

export interface ModelPageData {
	modelName: string;
	model: ModelMeta;
	scores: Promise<ScoresResult>;
}

export const load: PageLoad = async ({ params, fetch }): Promise<ModelPageData> => {
	const modelName = decodeURIComponent(params.name);
	const model = await loadModel(modelName, fetch).catch((e) => {
		if (e instanceof HttpError && e.status === 404) {
			error(404, `Model "${modelName}" not found`);
		}
		throw e;
	});
	return {
		modelName,
		model,
		scores: loadModelScores(modelName, fetch).then(
			(s): ScoresResult => ({ ok: true, data: s }),
			(e): ScoresResult => ({ ok: false, error: e instanceof Error ? e.message : String(e) })
		)
	};
};
