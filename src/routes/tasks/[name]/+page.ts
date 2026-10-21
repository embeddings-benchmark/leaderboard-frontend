// Eagerly awaits the benchmark catalog + task metadata (the hero card); `loadTaskScores` is
// fetched client-side on hydration so the build doesn't pay one /scores
// round-trip per task.
import { error } from '@sveltejs/kit';
import type { EntryGenerator, PageLoad } from './$types';
import { HttpError, loadBenchmarks, loadTask, loadTasks } from '$lib/data/service';
import type { Benchmark, TaskMeta } from '$lib/types';

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
	// Full catalog, not the menu: the menu omits the featured benchmarks
	// (MTEB(Multilingual, v2), MTEB(eng, v2), …) shown as home-page tiles.
	const [benchmarks, taskMeta] = await Promise.all([
		loadBenchmarks(fetch),
		loadTask(taskName, fetch).catch((e) => {
			if (e instanceof HttpError && e.status === 404) {
				error(404, `Task "${taskName}" not found`);
			}
			throw e;
		})
	]);
	return {
		taskName,
		// Current benchmarks first, superseded ones (with a `newVersion`) last.
		// `displayOnLeaderboard` is false for the featured ones, so can't sort on it.
		allBenchmarks: benchmarks
			.slice()
			.sort(
				(a, b) =>
					Number(!!a.newVersion?.length) - Number(!!b.newVersion?.length) ||
					a.displayName.localeCompare(b.displayName)
			),
		taskMeta
	};
};
