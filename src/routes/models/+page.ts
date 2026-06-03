import { loadModels } from '$lib/data/service';

export const ssr = false;

// Pre-warm `cachedHttp` so hover-triggered preload (cross-browser via
// SvelteKit's `preloadData`) fills the cache before the user clicks.
// The page's reactive effect re-issues the same call on mount and gets
// an instant cache hit. Modality-filter refetches still go through the
// component effect — those re-fire when the user toggles the picker.
export const load = async () => {
	await loadModels({});
	return {};
};
