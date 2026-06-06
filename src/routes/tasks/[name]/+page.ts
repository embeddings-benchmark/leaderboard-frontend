// Prerender every task detail page at build time so per-entity
// ShareMeta tags land in the static HTML. See the matching note in
// `benchmark/[name]/+page.ts`.
import type { EntryGenerator } from './$types';
import { loadTasks } from '$lib/data/service';

export const prerender = true;

export const entries: EntryGenerator = async () => {
	const tasks = await loadTasks();
	return tasks.map((t) => ({ name: t.name }));
};
