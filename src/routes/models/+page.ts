import type { PageLoad } from './$types';
import { loadModels } from '$lib/data/service';

// Prerender so ShareMeta's `<title>` + `<meta og:…>` end up in the static
// HTML for social-media crawlers. SSR stays on (default) — the page
// component renders during build to emit the head tags, then hydrates
// with live data on the client.
export const prerender = true;

// Pre-warm `cachedHttp` so hover-triggered preload (cross-browser via
// SvelteKit's `preloadData`) fills the cache before the user clicks.
// The page's reactive effect re-issues the same call on mount and gets
// an instant cache hit. Modality-filter refetches still go through the
// component effect — those re-fire when the user toggles the picker.
//
// Best-effort: if the backend is unreachable we swallow the error so the
// page still mounts and its own effect can surface the failure inline
// (and retry). The pre-warm is purely an optimization.
export const load: PageLoad = async () => {
	await loadModels({}).catch(() => undefined);
	return {};
};
