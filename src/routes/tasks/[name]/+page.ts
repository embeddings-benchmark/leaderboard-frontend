// /tasks/[name] loader. Awaits the cheap fetches (benchmark menu + task
// metadata) at prerender so the card hero lands ready; streams the heavier
// /scores fetch so client-side nav can paint the card immediately and fill
// in the model table when ready.
import type { EntryGenerator, PageLoad } from './$types';
import { loadBenchmarkMenu, loadTask, loadTaskScores, loadTasks } from '$lib/data/service';
import { flattenMenu, type Benchmark, type TaskMeta, type TaskScores } from '$lib/types';

// Streamed promises that reject during prerender crash the build with an
// unhandled rejection. Wrap the scores fetch in a discriminated-union
// result so the promise itself never rejects — the page reads `.ok` and
// renders an inline error fallback for failures.
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

export const load: PageLoad = async ({ params }): Promise<TaskPageData> => {
	const taskName = decodeURIComponent(params.name);
	// Both small, both prerender-friendly. We catch task-meta failures so a
	// missing/renamed task still shows the card shell + the menu-derived
	// "In benchmarks: …" strip instead of a hard error page.
	const [menu, taskResult] = await Promise.all([
		loadBenchmarkMenu(),
		loadTask(taskName).then(
			(t) => ({ meta: t, error: null as string | null }),
			(e) => ({ meta: null as TaskMeta | null, error: e instanceof Error ? e.message : String(e) })
		)
	]);
	return {
		taskName,
		allBenchmarks: flattenMenu(menu),
		taskMeta: taskResult.meta,
		taskMetaError: taskResult.error,
		scores: loadTaskScores(taskName).then(
			(s): ScoresResult => ({ ok: true, data: s }),
			(e): ScoresResult => ({ ok: false, error: e instanceof Error ? e.message : String(e) })
		)
	};
};
