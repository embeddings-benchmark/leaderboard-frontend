// Eagerly awaits menu + task metadata; streams the heavier scores fetch.
import { error } from '@sveltejs/kit';
import type { EntryGenerator, PageLoad } from './$types';
import {
	HttpError,
	loadBenchmarkMenu,
	loadTask,
	loadTaskScores,
	loadTasks
} from '$lib/data/service';
import { flattenMenu, type Benchmark, type TaskMeta, type TaskScores } from '$lib/types';

// Discriminated union so the streamed promise never rejects — prerender would
// crash on unhandled rejections.
export type ScoresResult = { ok: true; data: TaskScores } | { ok: false; error: string };

export const prerender = true;

export const entries: EntryGenerator = async () => {
	const tasks = await loadTasks();
	return tasks.map((t) => ({ name: t.name }));
};

export interface TaskPageData {
	taskName: string;
	allBenchmarks: Benchmark[];
	taskMeta: TaskMeta;
	// Streamed — page renders a scores skeleton until this resolves.
	scores: Promise<ScoresResult>;
}

export const load: PageLoad = async ({ params, fetch }): Promise<TaskPageData> => {
	const taskName = decodeURIComponent(params.name);
	// Only `loadTask` failures imply a missing task; menu failures shouldn't 404
	// the whole page (the menu is a sidebar; the page is the task).
	const [menu, taskMeta] = await Promise.all([
		loadBenchmarkMenu(fetch),
		loadTask(taskName, fetch).catch((e) => {
			if (e instanceof HttpError && e.status === 404) {
				error(404, `Task "${taskName}" not found`);
			}
			throw e;
		})
	]);
	return {
		taskName,
		allBenchmarks: flattenMenu(menu),
		taskMeta,
		scores: loadTaskScores(taskName, fetch).then(
			(s): ScoresResult => ({ ok: true, data: s }),
			(e): ScoresResult => ({ ok: false, error: e instanceof Error ? e.message : String(e) })
		)
	};
};
