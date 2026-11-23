// Eagerly awaits the benchmark catalog + task metadata (the hero card); `loadTaskScores` is
// fetched client-side on hydration so the build doesn't pay one /scores
// round-trip per task.
import { error, redirect } from '@sveltejs/kit';
import { building } from '$app/environment';
import { resolve } from '$app/paths';
import type { EntryGenerator, PageLoad } from './$types';
import { HttpError, loadBenchmarks, loadSlugIndex, loadTask, loadTasks } from '$lib/data/service';
import { resolveSlugParam, slug } from '$lib/format';
import type { Benchmark, TaskMeta } from '$lib/types';

export const prerender = !process.env.BUILD_NO_PRERENDER;

export const entries: EntryGenerator = async () => {
	const tasks = await loadTasks();
	// Slug pages plus the old raw-name URLs (see the redirect in `load`).
	return tasks.flatMap((t) => {
		const s = slug(t.name);
		return s === t.name ? [{ name: s }] : [{ name: s }, { name: t.name }];
	});
};

export interface TaskPageData {
	taskName: string;
	allBenchmarks: Benchmark[];
	taskMeta: TaskMeta;
}

export const load: PageLoad = async ({ params, fetch, url, untrack }): Promise<TaskPageData> => {
	const { name: taskName, redirect: to } = resolveSlugParam(
		decodeURIComponent(params.name),
		await loadSlugIndex('tasks', fetch),
		slug
	);
	// Old raw-name URL (`MTEB(eng, v2)`): the build prerenders it as a full
	// page so link previews of already-shared links keep working; in the
	// browser it redirects to the slug, keeping `?tab=` / `?pin=`.
	if (to && !building)
		redirect(308, resolve('/tasks/[name]', { name: to }) + untrack(() => url.search));
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
