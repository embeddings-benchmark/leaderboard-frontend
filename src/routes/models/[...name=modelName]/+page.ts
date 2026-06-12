// Prerendered for ShareMeta. Eagerly awaits `loadModel` (the hero card);
// `loadModelScores` is fetched client-side on hydration so the build doesn't
// pay one /scores round-trip per model.
import { error } from '@sveltejs/kit';
import type { EntryGenerator, PageLoad } from './$types';
import { HttpError, loadModel, loadModels } from '$lib/data/service';
import type { ModelMeta } from '$lib/types';

export const prerender = !process.env.BUILD_NO_PRERENDER;

export const entries: EntryGenerator = async () => {
	const models = await loadModels();
	return models.map((m) => ({ name: m.name }));
};

export interface ModelPageData {
	modelName: string;
	model: ModelMeta;
}

export const load: PageLoad = async ({ params, fetch }): Promise<ModelPageData> => {
	const modelName = decodeURIComponent(params.name);
	const model = await loadModel(modelName, fetch).catch((e) => {
		if (e instanceof HttpError && e.status === 404) {
			error(404, `Model "${modelName}" not found`);
		}
		throw e;
	});
	return { modelName, model };
};
