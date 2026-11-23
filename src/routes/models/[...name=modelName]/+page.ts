// Prerendered for ShareMeta. Eagerly awaits `loadModel` (the hero card);
// `loadModelScores` is fetched client-side on hydration so the build doesn't
// pay one /scores round-trip per model.
import { error, redirect } from '@sveltejs/kit';
import { building } from '$app/environment';
import { resolve } from '$app/paths';
import type { EntryGenerator, PageLoad } from './$types';
import { HttpError, loadModel, loadModels, loadSlugIndex } from '$lib/data/service';
import { modelPath, resolveSlugParam } from '$lib/format';
import type { ModelMeta } from '$lib/types';

export const prerender = !process.env.BUILD_NO_PRERENDER;

export const entries: EntryGenerator = async () => {
	const models = await loadModels();
	// Slug pages plus the old raw-name URLs (see the redirect in `load`).
	return models.flatMap((m) => {
		const p = modelPath(m.name);
		return p === m.name ? [{ name: p }] : [{ name: p }, { name: m.name }];
	});
};

export interface ModelPageData {
	modelName: string;
	model: ModelMeta;
}

export const load: PageLoad = async ({ params, fetch, url, untrack }): Promise<ModelPageData> => {
	const { name: modelName, redirect: to } = resolveSlugParam(
		decodeURIComponent(params.name),
		await loadSlugIndex('models', fetch),
		modelPath
	);
	// Old raw-name URL (`MTEB(eng, v2)`): the build prerenders it as a full
	// page so link previews of already-shared links keep working; in the
	// browser it redirects to the slug, keeping `?tab=` / `?pin=`.
	if (to && !building) {
		redirect(308, resolve('/models/[...name=modelName]', { name: to }) + untrack(() => url.search));
	}
	const model = await loadModel(modelName, fetch).catch((e) => {
		if (e instanceof HttpError && e.status === 404) {
			error(404, `Model "${modelName}" not found`);
		}
		throw e;
	});
	return { modelName, model };
};
