import {
	ariaSort as ariaSortFor,
	defaultDirFor,
	nextSort,
	sortIcon as sortIconFor
} from '$lib/format';
import { getParam, updateUrl } from '$lib/url-state';

/**
 * Per-table sort state with URL hydration. Each leaderboard table
 * (SummaryTable, PerTaskTab, PerLanguageTab, ModelScoreTable,
 * BenchScoreTable) duplicates the same ~15-line setup — initial
 * read from `?s.x=…&d.x=…`, write-back effect, `clickSort`, `sortIcon`,
 * `ariaSort`, default-direction helper. Factor it into one factory
 * keyed by the URL prefix + the set of keys that default to
 * ascending sort.
 *
 * Usage:
 *   const sort = createSortState<SortKey>({
 *     urlKeys: ['s.summary', 'd.summary'],
 *     ascKeys: ['rank', 'model']
 *   });
 *   // …
 *   <SortHeader {sort} field="meanTask" label="Mean (Task)" />
 *
 * Reads + writes happen inside `$effect`/`$state` so the factory
 * MUST be called from a component's script (or another `.svelte.ts`)
 * — not from plain `.ts`.
 */
export interface SortState<K extends string> {
	readonly key: K | null;
	readonly dir: 'asc' | 'desc';
	click(k: K): void;
	icon(k: K): string;
	aria(k: K): 'ascending' | 'descending' | 'none';
}

export function createSortState<K extends string>(opts: {
	urlKeys: readonly [keyParam: string, dirParam: string];
	ascKeys: readonly K[];
	/** Optional placeholder icon shown when no sort is active (e.g. '↕'). */
	defaultIcon?: string;
}): SortState<K> {
	const [keyParam, dirParam] = opts.urlKeys;
	const initialKey = getParam(keyParam);
	const initialDir = getParam(dirParam);

	const state = $state<{ key: K | null; dir: 'asc' | 'desc' }>({
		key: (initialKey as K | null) ?? null,
		dir: initialDir === 'asc' ? 'asc' : 'desc'
	});

	// Write-back: keep the URL in sync with the live state. Direction
	// is omitted while no key is active so a default-sort link is the
	// shortest possible URL.
	$effect(() => {
		updateUrl({
			[keyParam]: state.key,
			[dirParam]: state.key ? state.dir : null
		});
	});

	const defaultDir = (k: K) => defaultDirFor(k, opts.ascKeys);

	return {
		get key() {
			return state.key;
		},
		get dir() {
			return state.dir;
		},
		click(k: K) {
			const next = nextSort(k, state.key, state.dir, defaultDir);
			state.key = next.key as K | null;
			state.dir = next.dir;
		},
		icon(k: K) {
			return sortIconFor(k, state.key, state.dir, opts.defaultIcon ?? '');
		},
		aria(k: K) {
			return ariaSortFor(k, state.key, state.dir);
		}
	};
}
