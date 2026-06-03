<script lang="ts">
	import type { BenchmarkSummary, SummaryRow } from '$lib/types';
	import { pinnedModels } from '$lib/stores/pinned.svelte';
	import { stickyHead } from '$lib/actions/sticky-head';
	import { stickyHScroll } from '$lib/actions/sticky-hscroll';
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
	import ModelTypeIcon from './ModelTypeIcon.svelte';

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

	// Trained-on warning tooltip — mirrors the SummaryTable column-tip
	// pattern (fixed-position portal anchored to the icon's bounding
	// rect). Replaces the previous CSS ::after bubble which felt slow
	// because anchor-positioning re-layout + the transition combined
	// add perceptible latency. The portal is a single element shared
	// across every ⚠️ in the table, with no transition: shown the
	// moment the cursor enters, hidden 200 ms after it leaves so the
	// user has time to mouse onto it if needed.
	const TRAIN_TIP_MAX_WIDTH = 260;
	const TRAIN_TIP_EDGE = 8;
	type TrainTipState = { visible: boolean; text: string; x: number; y: number };
	let trainTip = $state<TrainTipState>({ visible: false, text: '', x: 0, y: 0 });
	let trainTipHideTimer: ReturnType<typeof setTimeout> | null = null;
	function clampX(rawX: number): number {
		if (typeof window === 'undefined') return rawX;
		const half = TRAIN_TIP_MAX_WIDTH / 2;
		const min = TRAIN_TIP_EDGE + half;
		const max = window.innerWidth - TRAIN_TIP_EDGE - half;
		if (min > max) return window.innerWidth / 2;
		return Math.min(max, Math.max(min, rawX));
	}
	function cancelTrainTipHide() {
		if (trainTipHideTimer !== null) {
			clearTimeout(trainTipHideTimer);
			trainTipHideTimer = null;
		}
	}
	function showTrainTip(e: PointerEvent | FocusEvent) {
		cancelTrainTipHide();
		const el = e.currentTarget as HTMLElement;
		const text = el.dataset.tip ?? '';
		if (!text) return;
		const r = el.getBoundingClientRect();
		trainTip = {
			visible: true,
			text,
			x: clampX(r.left + r.width / 2),
			y: r.bottom
		};
	}
	function hideTrainTip() {
		cancelTrainTipHide();
		trainTipHideTimer = setTimeout(() => {
			trainTip = { ...trainTip, visible: false };
			trainTipHideTimer = null;
		}, 200);
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
		<div class="tbl-scroll" use:stickyHScroll>
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
								data-model-type={row.model.modelType}
								onpointerenter={(e) => onCellEnter(e, row)}
								onpointerleave={onCellLeave}
								onfocusin={(e) => onCellEnter(e, row)}
								onfocusout={onCellLeave}
							>
								<span class="type-icon" title={row.model.modelType}>
									<ModelTypeIcon type={row.model.modelType} size={13} />
								</span>
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
								{@const trained = row.trainedOnTasks?.includes(task) ?? false}
								<td
									class="tbl-num"
									class:tbl-best={row.scoresByTask[task] === best[task]}
									class:trained-on={trained}
									style={heat(row.scoresByTask[task], worst[task], best[task])}
								>
									{fmt(row.scoresByTask[task])}{#if trained}<button
											type="button"
											class="trained-warn"
											data-tip="Model lists this task in its training datasets — score is not zero-shot."
											aria-label="Trained on this task"
											onpointerenter={showTrainTip}
											onpointerleave={hideTrainTip}
											onfocusin={showTrainTip}
											onfocusout={hideTrainTip}>⚠️</button
										>{/if}
								</td>
							{/each}
						</tr>
					{/each}
				</tbody>
			</table>
		</div>
	{/if}

	<ModelHoverPortal bind:this={tipPortal} />

	{#if trainTip.visible}
		<div
			class="train-tip"
			role="tooltip"
			style:left="{trainTip.x}px"
			style:top="{trainTip.y}px"
			onpointerenter={cancelTrainTipHide}
			onpointerleave={hideTrainTip}
		>
			{trainTip.text}
		</div>
	{/if}
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
	/* Trained-on warning sits inline after the score number with a small
	   gap so it doesn't crowd the digits. The cell already keeps its
	   heat-shaded background, so the ⚠️ is purely additive. The
	   tooltip itself lives in a fixed-positioned portal rendered as a
	   sibling of `.tbl-scroll` (see `.train-tip` below) — JS sets x/y
	   from the icon's getBoundingClientRect on pointerenter, so the
	   bubble appears instantly without re-layout cost or browser
	   `title` delay, and isn't clipped by the table's overflow-x. */
	.trained-warn {
		/* Reset <button> chrome so the inline ⚠️ icon stays purely
		   typographic — it's a button only so a static role / tabindex
		   isn't needed for the hover-tooltip handlers. */
		all: unset;
		margin-left: 4px;
		font-size: 11px;
		line-height: 1;
		cursor: help;
	}
	.trained-warn:focus-visible {
		outline: 2px solid var(--primary);
		outline-offset: 1px;
		border-radius: 3px;
	}
	.train-tip {
		position: fixed;
		transform: translate(-50%, 6px);
		max-width: 260px;
		padding: 6px 10px;
		font-family: var(--font-sans);
		font-size: 11px;
		font-weight: 500;
		line-height: 1.4;
		color: #f1f3f5;
		background: #1f2329;
		border-radius: 6px;
		box-shadow: 0 8px 18px rgb(15, 23, 42, 0.22);
		text-align: left;
		white-space: normal;
		z-index: 1000;
		pointer-events: auto;
	}
	.lbl {
		overflow: hidden;
		text-overflow: ellipsis;
		max-width: 160px;
	}
</style>
