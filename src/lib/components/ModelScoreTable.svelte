<script lang="ts" module>
	import type { ModelMeta } from '$lib/types';

	/**
	 * Per-model scores for a single task — used by the task detail page.
	 * Each row is one model with its rank + mean score across subsets +
	 * per-subset scores. Sort + heat-shading are local to this component.
	 */
	export interface ModelScore {
		model: ModelMeta;
		score: number | null;
		rank: number;
		benchmarkName: string;
		subsetScores: Record<string, number>;
	}
</script>

<script lang="ts">
	import { resolve } from '$app/paths';
	import { stickyHead } from '$lib/actions/sticky-head';
	import { stickyHScroll } from '$lib/actions/sticky-hscroll';
	import { getParam, updateUrl } from '$lib/url-state';
	import ModelTypeIcon from './ModelTypeIcon.svelte';
	import {
		ariaSort as ariaSortFor,
		defaultDirFor,
		fmtPct,
		heat,
		maxOf,
		minOf,
		nextSort,
		slug,
		sortIcon as sortIconFor
	} from '$lib/format';

	interface Props {
		rows: ModelScore[];
		subsets: string[];
	}
	let { rows, subsets }: Props = $props();

	// Subset columns get a `subset:` prefix so the string union stays flat
	// and serialises to the URL without further encoding.
	type SortKey = 'rank' | 'model' | 'score' | `subset:${string}`;
	const initialKey = getParam('s.scores');
	const initialDir = getParam('d.scores');
	let sortKey = $state<SortKey | null>((initialKey as SortKey | null) ?? null);
	let sortDir = $state<'asc' | 'desc'>(initialDir === 'asc' ? 'asc' : 'desc');
	$effect(() => {
		updateUrl({
			's.scores': sortKey,
			'd.scores': sortKey ? sortDir : null
		});
	});

	const ASC_KEYS: readonly SortKey[] = ['rank', 'model'];
	const defaultDir = (k: SortKey) => defaultDirFor(k, ASC_KEYS);
	function clickSort(k: SortKey) {
		const next = nextSort(k, sortKey, sortDir, defaultDir);
		sortKey = next.key;
		sortDir = next.dir;
	}
	const sortIcon = (k: SortKey) => sortIconFor(k, sortKey, sortDir);
	const ariaSort = (k: SortKey) => ariaSortFor(k, sortKey, sortDir);

	let sortedRows = $derived.by<ModelScore[]>(() => {
		if (!sortKey) return rows;
		const dir = sortDir === 'asc' ? 1 : -1;
		const k = sortKey;
		return [...rows].sort((a, b) => {
			if (k === 'rank') return (a.rank - b.rank) * dir;
			if (k === 'model') return a.model.name.localeCompare(b.model.name) * dir;
			if (k === 'score') {
				// Null scores sort to the bottom regardless of direction
				// (missing data is never "best" or "worst", just missing).
				if (a.score == null && b.score == null) return 0;
				if (a.score == null) return 1;
				if (b.score == null) return -1;
				return (a.score - b.score) * dir;
			}
			const subset = k.slice(7);
			const av = a.subsetScores[subset];
			const bv = b.subsetScores[subset];
			if (av === undefined && bv === undefined) return 0;
			if (av === undefined) return 1;
			if (bv === undefined) return -1;
			return (av - bv) * dir;
		});
	});

	// Heat scales per-column over the [min, max] range so columns where
	// scores cluster tightly still show useful contrast.
	let bestScore = $derived(maxOf(rows.map((r) => r.score)));
	let worstScore = $derived(minOf(rows.map((r) => r.score)));
	let bestPerSubset = $derived.by(() => {
		const m: Record<string, number> = {};
		for (const sub of subsets) {
			m[sub] = maxOf(rows.map((r) => r.subsetScores[sub]));
		}
		return m;
	});
	let worstPerSubset = $derived.by(() => {
		const m: Record<string, number> = {};
		for (const sub of subsets) {
			m[sub] = minOf(rows.map((r) => r.subsetScores[sub]));
		}
		return m;
	});
</script>

<div class="tbl-scroll" use:stickyHScroll>
	<table class="tbl task-table" use:stickyHead>
		<thead>
			<tr>
				<th class="tbl-num sticky-rank" aria-sort={ariaSort('rank')}>
					<button type="button" class="tbl-sort" onclick={() => clickSort('rank')}>
						<span>Rank</span>
						<span class="tbl-sort-ind" class:on={sortKey === 'rank'}>{sortIcon('rank')}</span>
					</button>
				</th>
				<th class="sticky" aria-sort={ariaSort('model')}>
					<button type="button" class="tbl-sort tbl-sort-left" onclick={() => clickSort('model')}>
						<span>Model</span>
						<span class="tbl-sort-ind" class:on={sortKey === 'model'}>{sortIcon('model')}</span>
					</button>
				</th>
				<th
					class="tbl-num mean-head"
					aria-sort={ariaSort('score')}
					title="Mean of per-subset scores for this task"
				>
					<button type="button" class="tbl-sort" onclick={() => clickSort('score')}>
						<span>Mean scores</span>
						<span class="tbl-sort-ind" class:on={sortKey === 'score'}>{sortIcon('score')}</span>
					</button>
				</th>
				{#each subsets as sub (sub)}
					{@const k = `subset:${sub}` as SortKey}
					<th class="tbl-num sub" aria-sort={ariaSort(k)} title={sub}>
						<button type="button" class="tbl-sort" onclick={() => clickSort(k)}>
							<span>{sub}</span>
							<span class="tbl-sort-ind" class:on={sortKey === k}>{sortIcon(k)}</span>
						</button>
					</th>
				{/each}
			</tr>
		</thead>
		<tbody>
			{#each sortedRows as s (s.model.name + s.benchmarkName)}
				<tr>
					<td class="tbl-num sticky-rank">
						<span class="rank-pill">#{s.rank}</span>
					</td>
					<td class="sticky" data-model-type={s.model.modelType}>
						<span class="type-icon" title={s.model.modelType}>
							<ModelTypeIcon type={s.model.modelType} size={13} />
						</span>
						<a
							class="task-model-link"
							href={resolve('/models/[name]', { name: slug(s.model.name) })}
						>
							<span class="tbl-model-org">{s.model.org}</span><span class="tbl-model-sep">/</span
							><span class="tbl-model-name">{s.model.displayName}</span>
						</a>
					</td>
					<td
						class="tbl-num mean-cell"
						class:partial={s.score == null}
						style={s.score == null ? '' : heat(s.score, worstScore, bestScore)}
						title={s.score == null ? 'Not evaluated on every subset' : undefined}
						>{fmtPct(s.score)}</td
					>
					{#each subsets as sub (sub)}
						{@const v = s.subsetScores[sub]}
						<td
							class="tbl-num sub"
							style={v !== undefined ? heat(v, worstPerSubset[sub], bestPerSubset[sub]) : ''}
						>
							{v !== undefined ? fmtPct(v) : '—'}
						</td>
					{/each}
				</tr>
			{/each}
		</tbody>
	</table>
</div>

<style>
	.task-table {
		width: 100%;
	}
	/* Two sticky columns: Rank (70 px) pinned to the viewport edge, then
	   Model (240 px) butted up against it. Without pinning Rank too, the
	   #N pill scrolled out of view as soon as the user panned right —
	   leaving anonymous model rows next to the floating sticky scrollbar.
	   `--rank-w` keeps the Rank width and Model's left offset in sync. */
	.task-table {
		--rank-w: 70px;
	}
	.sticky-rank {
		position: sticky;
		left: 0;
		background: var(--surface);
		z-index: 2;
		min-width: var(--rank-w);
		width: var(--rank-w);
	}
	thead th.sticky-rank {
		background: var(--surface-muted);
		z-index: 3;
	}
	tbody tr:nth-child(even) td.sticky-rank {
		background: var(--row-alt);
	}
	tbody tr:hover td.sticky-rank {
		background: var(--row-hover);
	}
	.sticky {
		position: sticky;
		left: var(--rank-w);
		background: var(--surface);
		z-index: 2;
		min-width: 240px;
	}
	thead th.sticky {
		background: var(--surface-muted);
		z-index: 3;
	}
	tbody tr:nth-child(even) td.sticky {
		background: var(--row-alt);
	}
	tbody tr:hover td.sticky {
		background: var(--row-hover);
	}
	/* Mobile: the sticky pair hides almost every score column behind it
	   on a 375 px viewport. Drop the stickyness so columns scroll
	   together. */
	@media (max-width: 640px) {
		.sticky,
		.sticky-rank,
		thead th.sticky,
		thead th.sticky-rank {
			position: static;
			left: auto;
			min-width: 0;
			width: auto;
		}
		.sticky {
			min-width: 160px;
		}
	}
	.task-model-link {
		color: var(--text);
		text-decoration: none;
	}
	.task-model-link:hover {
		color: var(--link);
	}
	/* `.type-icon` + per-model-type tint rules live in
	   src/lib/styles/leaderboard-table.css — shared with SummaryTable,
	   PerTaskTab, and PerLanguageTab. */
	.mean-cell.partial {
		color: var(--text-subtle);
		font-weight: 500;
	}
	/* `.rank-pill` lives in src/lib/styles/leaderboard-table.css — shared
	   with SummaryTable so both views render the rank identically. */
	thead th.sub {
		font-size: 11px;
		font-weight: 600;
		color: var(--text-subtle);
	}
	tbody td.sub {
		color: var(--text-muted);
	}
	thead th.mean-head {
		color: var(--text);
		font-weight: 700;
		border-right: 1px solid var(--border);
	}
	tbody td.mean-cell {
		font-weight: 700;
		color: var(--text);
		border-right: 1px solid var(--border);
	}
</style>
