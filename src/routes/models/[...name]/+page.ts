// Prerender every model detail page at build time so per-entity
// ShareMeta tags land in the static HTML. The route uses `[...name]`
// (rest param) because model identifiers are `org/name` — SvelteKit
// passes the raw string through, slashes and all.
import type { EntryGenerator } from './$types';
import { loadModels } from '$lib/data/service';

export const prerender = true;

export const entries: EntryGenerator = async () => {
	const models = await loadModels();
	return models.map((m) => ({ name: m.name }));
};
