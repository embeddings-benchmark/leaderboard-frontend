// Eagerly awaits menu + task metadata; streams the heavier scores fetch.
import type { EntryGenerator, PageLoad } from './$types';
import { loadBenchmarkMenu, loadTask, loadTaskScores, loadTasks } from '$lib/data/service';
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
	taskMeta: TaskMeta | null;
	taskMetaError: string | null;
	// Streamed — page renders a scores skeleton until this resolves.
	scores: Promise<ScoresResult>;
}

export const load: PageLoad = async ({ params, fetch }): Promise<TaskPageData> => {
	const taskName = decodeURIComponent(params.name);
	// Catch task-meta failures so a missing task still shows the card shell.
	const [menu, taskResult] = await Promise.all([
		loadBenchmarkMenu(fetch),
		loadTask(taskName, fetch).then(
			(t) => ({ meta: t, error: null as string | null }),
			(e) => ({ meta: null as TaskMeta | null, error: e instanceof Error ? e.message : String(e) })
		)
	]);
	return {
		taskName,
		allBenchmarks: flattenMenu(menu),
		taskMeta: taskResult.meta,
		taskMetaError: taskResult.error,
		scores: loadTaskScores(taskName, fetch).then(
			(s): ScoresResult => ({ ok: true, data: s }),
			(e): ScoresResult => ({ ok: false, error: e instanceof Error ? e.message : String(e) })
		)
	};
};
