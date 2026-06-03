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
		humanizeType,
		nextSort,
		sortIcon as sortIconFor,
		worstPerColumn
	} from '$lib/format';
	import MarkdownText from './MarkdownText.svelte';
	import ModelHoverPortal from './ModelHoverPortal.svelte';
	import ModelTypeIcon from './ModelTypeIcon.svelte';

	type Tip = {
		showFor: (t: HTMLElement, row: SummaryRow) => void;
		hide: () => void;
	};
	let tipPortal = $state<Tip | undefined>(undefined);

	// Filter `pointerover`/`pointerout` to outer boundary crossings only —
	// Svelte 5 delegates the bubbling pair to the document, so we save a
	// per-cell listener vs `pointerenter`/`pointerleave`.
	function isBoundaryCross(e: PointerEvent | FocusEvent): boolean {
		const cell = e.currentTarget as HTMLElement | null;
		const other = (e as PointerEvent).relatedTarget as Node | null;
		return !!cell && !(other && cell.contains(other));
	}
	function onCellEnter(e: PointerEvent | FocusEvent, row: SummaryRow) {
		if (!isBoundaryCross(e)) return;
		tipPortal?.showFor(e.currentTarget as HTMLElement, row);
	}
	function onCellLeave(e?: PointerEvent | FocusEvent) {
		if (e && !isBoundaryCross(e)) return;
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

	// Column-header tip for the task name. Mirrors the SummaryTable
	// portal pattern (fixed-position, JS-clamped to viewport) — the
	// `<th>` is sticky and lives in `overflow-x: auto`, so a child
	// tooltip would be clipped + trapped in the th's stacking context.
	// One portal element is reused across every column.
	const TASK_TIP_MAX_WIDTH = 320;
	const TASK_TIP_EDGE = 8;
	type TaskTipState = {
		visible: boolean;
		title: string;
		type: string;
		description: string;
		x: number;
		y: number;
	};
	let taskTip = $state<TaskTipState>({
		visible: false,
		title: '',
		type: '',
		description: '',
		x: 0,
		y: 0
	});
	let taskTipHideTimer: ReturnType<typeof setTimeout> | null = null;
	function clampTaskTipX(rawX: number): number {
		if (typeof window === 'undefined') return rawX;
		const half = TASK_TIP_MAX_WIDTH / 2;
		const min = TASK_TIP_EDGE + half;
		const max = window.innerWidth - TASK_TIP_EDGE - half;
		if (min > max) return window.innerWidth / 2;
		return Math.min(max, Math.max(min, rawX));
	}
	function cancelTaskTipHide() {
		if (taskTipHideTimer !== null) {
			clearTimeout(taskTipHideTimer);
			taskTipHideTimer = null;
		}
	}
	// Lookup keyed by task name. tasksMeta entries are 1:1 with the
	// benchmark's task list, but defensive map-lookup keeps it robust
	// if the backend ever returns a different order or omits entries.
	let taskMetaByName = $derived.by(() => {
		const m = new Map<string, (typeof summary.tasksMeta)[number]>();
		for (const t of summary.tasksMeta ?? []) m.set(t.name, t);
		return m;
	});
	function showTaskTip(e: PointerEvent | FocusEvent, taskName: string) {
		cancelTaskTipHide();
		const meta = taskMetaByName.get(taskName);
		const el = e.currentTarget as HTMLElement;
		const r = el.getBoundingClientRect();
		taskTip = {
			visible: true,
			title: taskName,
			type: meta?.type ? humanizeType(meta.type) : '',
			description: meta?.description ?? '',
			x: clampTaskTipX(r.left + r.width / 2),
			y: r.bottom
		};
	}
	function hideTaskTip() {
		cancelTaskTipHide();
		taskTipHideTimer = setTimeout(() => {
			taskTip = { ...taskTip, visible: false };
			taskTipHideTimer = null;
		}, 200);
	}
	function keepTaskTip() {
		cancelTaskTipHide();
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
							<th
								class="tbl-num"
								aria-sort={ariaSort(k)}
								onpointerenter={(e) => showTaskTip(e, task)}
								onpointerleave={hideTaskTip}
								onfocusin={(e) => showTaskTip(e, task)}
								onfocusout={hideTaskTip}
							>
								<button class="tbl-sort" onclick={() => clickSort(k)}>
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
								onpointerover={(e) => onCellEnter(e, row)}
								onpointerout={onCellLeave}
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

	{#if taskTip.visible}
		<div
			class="task-tip"
			role="tooltip"
			style:left="{taskTip.x}px"
			style:top="{taskTip.y}px"
			onpointerenter={keepTaskTip}
			onpointerleave={hideTaskTip}
		>
			<strong class="task-tip-title">{taskTip.title}</strong>
			{#if taskTip.type}<span class="task-tip-type">{taskTip.type}</span>{/if}
			{#if taskTip.description}
				<span class="task-tip-body"><MarkdownText text={taskTip.description} /></span>
			{:else}
				<span class="task-tip-empty">No description available.</span>
			{/if}
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
	/* Column-header tip — same dark-portal treatment as the trained-on
	   warning bubble and SummaryTable's column tip. Fixed-position so
	   it escapes the table's overflow + sticky-header stacking context. */
	.task-tip {
		position: fixed;
		transform: translate(-50%, 6px);
		max-width: 320px;
		min-width: 220px;
		padding: 10px 12px;
		font-family: var(--font-sans);
		font-size: 12px;
		font-weight: 400;
		line-height: 1.5;
		color: #f1f3f5;
		background: #1f2329;
		border-radius: 8px;
		box-shadow: 0 12px 28px rgb(15, 23, 42, 0.22);
		text-align: left;
		white-space: normal;
		z-index: 1000;
		pointer-events: auto;
	}
	.task-tip-title {
		display: block;
		font-size: 12px;
		font-weight: 700;
		color: #f1f3f5;
		margin-bottom: 2px;
		word-break: break-word;
	}
	.task-tip-type {
		display: block;
		font-size: 10px;
		font-weight: 600;
		letter-spacing: 0.04em;
		text-transform: uppercase;
		color: var(--primary);
		margin-bottom: 6px;
	}
	.task-tip-body {
		display: block;
	}
	.task-tip-empty {
		display: block;
		color: #9aa3ad;
		font-style: italic;
	}
</style>
