<script lang="ts">
	import type { BenchmarkSummary, SummaryRow } from '$lib/types';
	import { pinnedModels } from '$lib/stores/pinned.svelte';
	import { stickyHead } from '$lib/actions/sticky-head';
	import { getParam, updateUrl } from '$lib/url-state';
	import {
		ariaSort as ariaSortFor,
		bestPerColumn,
		defaultDirFor,
		heat,
		nextSort,
		sortIcon as sortIconFor,
		worstPerColumn
	} from '$lib/format';
	import ModelHoverPortal from './ModelHoverPortal.svelte';

	type Tip = {
		showFor: (t: HTMLElement, row: SummaryRow) => void;
		hide: () => void;
	};
	let tipPortal = $state<Tip | undefined>(undefined);

	function onCellEnter(e: PointerEvent | FocusEvent, row: SummaryRow) {
		tipPortal?.showFor(e.currentTarget as HTMLElement, row);
	}
	function onCellLeave() {
		tipPortal?.hide();
	}

	interface Props {
		summary: BenchmarkSummary;
	}
	let { summary }: Props = $props();

	type SortKey = 'model' | `task:${string}`;
	const initialKey = getParam('s.task');
	const initialDir = getParam('d.task');
	let sortKey = $state<SortKey | null>((initialKey as SortKey | null) ?? null);
	let sortDir = $state<'asc' | 'desc'>(initialDir === 'asc' ? 'asc' : 'desc');
	$effect(() => {
		updateUrl({
			's.task': sortKey,
			'd.task': sortKey ? sortDir : null
		});
	});

	const ASC_KEYS: readonly SortKey[] = ['model'];
	const defaultDir = (k: SortKey) => defaultDirFor(k, ASC_KEYS);
	function clickSort(k: SortKey) {
		const next = nextSort(k, sortKey, sortDir, defaultDir);
		sortKey = next.key;
		sortDir = next.dir;
	}
	const sortIcon = (k: SortKey) => sortIconFor(k, sortKey, sortDir);
	const ariaSort = (k: SortKey) => ariaSortFor(k, sortKey, sortDir);

	function fmt(score: number | undefined): string {
		if (score === undefined) return '';
		return (score * 100).toFixed(2);
	}

	// Task columns are rendered A→Z so wide leaderboards are scannable.
	// API ordering is whatever the benchmark registered; alphabetising
	// here keeps it stable as the user filters the task set.
	let sortedTasks = $derived([...summary.tasks].sort((a, b) => a.localeCompare(b)));
	let best = $derived(bestPerColumn(sortedTasks, summary.rows, (r, t) => r.scoresByTask[t]));
	let worst = $derived(worstPerColumn(sortedTasks, summary.rows, (r, t) => r.scoresByTask[t]));

	let sortedRows = $derived.by(() => {
		let rows = summary.rows;
		if (sortKey) {
			const dir = sortDir === 'asc' ? 1 : -1;
			const key = sortKey;
			rows = [...rows].sort((a, b) => {
				if (key === 'model') {
					return (
						a.model.displayName.toLowerCase().localeCompare(b.model.displayName.toLowerCase()) * dir
					);
				}
				const taskName = key.slice(5);
				const va = a.scoresByTask[taskName];
				const vb = b.scoresByTask[taskName];
				if (va === undefined && vb === undefined) return 0;
				if (va === undefined) return 1;
				if (vb === undefined) return -1;
				return (va - vb) * dir;
			});
		}
		if (pinnedModels.size === 0) return rows;
		const isPinned = (r: SummaryRow) => pinnedModels.has(r.model.name);
		return [...rows.filter(isPinned), ...rows.filter((r) => !isPinned(r))];
	});
</script>

<div class="wrap">
	{#if summary.tasks.length === 0}
		<p class="muted">This benchmark has no tasks defined in the mock data.</p>
	{:else}
		<p class="muted">
			Per-task scores for each visible model. {summary.tasks.length} tasks; scroll horizontally to see
			them all. Click any column header to sort.
		</p>
		<div class="tbl-scroll">
			<table class="tbl" use:stickyHead>
				<thead>
					<tr>
						<th class="tbl-pin-col tbl-sticky-pin" aria-label="Pinned"></th>
						<th class="tbl-sticky-col" aria-sort={ariaSort('model')}>
							<button class="tbl-sort tbl-sort-left" onclick={() => clickSort('model')}>
								<span>Model</span>
								<span class="tbl-sort-ind" class:on={sortKey === 'model'}>{sortIcon('model')}</span>
							</button>
						</th>
						{#each sortedTasks as task (task)}
							{@const k = `task:${task}` as SortKey}
							<th class="tbl-num" aria-sort={ariaSort(k)}>
								<button class="tbl-sort" onclick={() => clickSort(k)} title={task}>
									<span class="lbl">{task}</span>
									<span class="tbl-sort-ind" class:on={sortKey === k}>{sortIcon(k)}</span>
								</button>
							</th>
						{/each}
					</tr>
				</thead>
				<tbody>
					{#each sortedRows as row (row.model.name)}
						<tr class:pinned={pinnedModels.has(row.model.name)}>
							<td class="tbl-pin-col tbl-sticky-pin">
								<button
									type="button"
									class="tbl-pin-btn"
									class:on={pinnedModels.has(row.model.name)}
									onclick={() => pinnedModels.toggle(row.model.name)}
									aria-label={pinnedModels.has(row.model.name) ? 'Unpin row' : 'Pin row'}
									title={pinnedModels.has(row.model.name) ? 'Unpin row' : 'Pin row'}
								>
									<svg
										viewBox="0 0 24 24"
										width="12"
										height="12"
										fill="none"
										stroke="currentColor"
										stroke-width="2.4"
										stroke-linecap="round"
										stroke-linejoin="round"
										aria-hidden="true"
									>
										<path d="M12 17v5" />
										<path d="M9 10.76V6h6v4.76l3 2.59V17H6v-3.65l3-2.59z" />
									</svg>
								</button>
							</td>
							<td
								class="tbl-sticky-col"
								onpointerenter={(e) => onCellEnter(e, row)}
								onpointerleave={onCellLeave}
								onfocusin={(e) => onCellEnter(e, row)}
								onfocusout={onCellLeave}
							>
								{#if row.model.url}
									<!-- External model URL (HuggingFace etc.) -->
									<!-- eslint-disable-next-line svelte/no-navigation-without-resolve -->
									<a href={row.model.url} target="_blank" rel="noreferrer" class="tbl-model-link">
										<span class="tbl-model-org">{row.model.org}</span><span class="tbl-model-sep"
											>/</span
										><span class="tbl-model-name">{row.model.displayName}</span>
									</a>
								{:else}
									<span class="tbl-model-link">
										<span class="tbl-model-org">{row.model.org}</span><span class="tbl-model-sep"
											>/</span
										><span class="tbl-model-name">{row.model.displayName}</span>
									</span>
								{/if}
							</td>
							{#each sortedTasks as task (task)}
								<td
									class="tbl-num"
									class:tbl-best={row.scoresByTask[task] === best[task]}
									style={heat(row.scoresByTask[task], worst[task], best[task])}
								>
									{fmt(row.scoresByTask[task])}
								</td>
							{/each}
						</tr>
					{/each}
				</tbody>
			</table>
		</div>
	{/if}

	<ModelHoverPortal bind:this={tipPortal} />
</div>

<style>
	.wrap {
		padding-top: 8px;
	}
	/* Base `.muted` (color + margin: 0) lives in src/app.css. */
	.muted {
		margin: 0 0 12px;
	}
	/* Task column headers can be long ("AmazonReviewsClassification…") — clip
	   them so they don't push the column impossibly wide. */
	.lbl {
		overflow: hidden;
		text-overflow: ellipsis;
		max-width: 160px;
	}
</style>
