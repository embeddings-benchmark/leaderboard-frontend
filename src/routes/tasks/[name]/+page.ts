// Eagerly awaits menu + task metadata (the hero card); `loadTaskScores` is
// fetched client-side on hydration so the build doesn't pay one /scores
// round-trip per task.
import { error } from '@sveltejs/kit';
import type { EntryGenerator, PageLoad } from './$types';
import { HttpError, loadBenchmarkMenu, loadTask, loadTasks } from '$lib/data/service';
import { flattenMenu, type Benchmark, type TaskMeta } from '$lib/types';

export const prerender = !process.env.BUILD_NO_PRERENDER;

export const entries: EntryGenerator = async () => {
	const tasks = await loadTasks();
	return tasks.map((t) => ({ name: t.name }));
};

export interface TaskPageData {
	taskName: string;
	allBenchmarks: Benchmark[];
	taskMeta: TaskMeta;
}

export const load: PageLoad = async ({ params, fetch }): Promise<TaskPageData> => {
	const taskName = decodeURIComponent(params.name);
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
		taskMeta
	};
};
