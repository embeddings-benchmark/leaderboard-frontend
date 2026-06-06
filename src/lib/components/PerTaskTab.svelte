<script lang="ts">
	import type { BenchmarkSummary, SummaryRow } from '$lib/types';
	import { pinnedModels } from '$lib/stores/pinned.svelte';
	import { isBoundaryCross } from '$lib/cell-hover';
	import { stickyHead } from '$lib/actions/sticky-head';
	import { stickyHScroll } from '$lib/actions/sticky-hscroll';
	import { resolve } from '$app/paths';
	import { bestWorstPerColumn, heat, humanizeType, slug } from '$lib/format';
	import { createSortState } from '$lib/stores/sort.svelte';
	import { safeIdle } from '$lib/idle';
	import MarkdownText from './MarkdownText.svelte';
	import ModelCellName from './ModelCellName.svelte';
	import ModelHoverPortal from './ModelHoverPortal.svelte';
	import SortHeader from './SortHeader.svelte';
	import PinButton from './PinButton.svelte';
	import InfoDot from './InfoDot.svelte';

	type Tip = {
		showFor: (t: HTMLElement, row: SummaryRow) => void;
		hide: () => void;
	};
	let tipPortal = $state<Tip | undefined>(undefined);

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
	const sort = createSortState<SortKey>({
		urlKeys: ['s.task', 'd.task'],
		ascKeys: ['model']
	});

	function fmt(score: number | undefined): string {
		if (score === undefined) return '';
		return (score * 100).toFixed(2);
	}

	// Trained-on ⚠️ tooltip — single fixed-position portal shared
	// across every cell. 200 ms hide delay so the user can cross
	// onto the bubble.
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

	// Column-header tip — fixed-position portal so it escapes the
	// sticky <th>'s clipping + stacking context (same pattern as
	// SummaryTable). One element reused across every column.
	const TASK_TIP_MAX_WIDTH = 320;
	const TASK_TIP_EDGE = 8;
	type TaskTipState = {
		visible: boolean;
		title: string;
		type: string;
		mainScore: string;
		description: string;
		x: number;
		y: number;
	};
	let taskTip = $state<TaskTipState>({
		visible: false,
		title: '',
		type: '',
		mainScore: '',
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
	// Lookup keyed by task name — cached by `tasksMeta` identity in a
	// WeakMap so filter-driven summary recomputes that return the same
	// `tasksMeta` array don't rebuild the index.
	const _taskMetaCache = new WeakMap<
		readonly (typeof summary.tasksMeta)[number][],
		Map<string, (typeof summary.tasksMeta)[number]>
	>();
	let taskMetaByName = $derived.by(() => {
		const meta = summary.tasksMeta ?? [];
		let cached = _taskMetaCache.get(meta);
		if (!cached) {
			// eslint-disable-next-line svelte/prefer-svelte-reactivity
			cached = new Map<string, (typeof summary.tasksMeta)[number]>();
			for (const t of meta) cached.set(t.name, t);
			_taskMetaCache.set(meta, cached);
		}
		return cached;
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
			mainScore: meta?.mainScore ?? '',
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
	// `summary.tasks` is pre-sorted at the service boundary.
	let sortedTasks = $derived(summary.tasks);
	function scoreFor(row: SummaryRow, task: string): number | undefined {
		return row.scoresByTask[task];
	}
	let taskBests = $derived(bestWorstPerColumn(sortedTasks, summary.rows, scoreFor));
	let best = $derived(taskBests.best);
	let worst = $derived(taskBests.worst);
	// Per-row Set of trained-on task names — cell template would otherwise
	// run `Array.includes` per cell (200×200 = up to 1.2M ops on a re-render).
	let trainedByModel = $derived.by(() => {
		// eslint-disable-next-line svelte/prefer-svelte-reactivity
		const m = new Map<string, Set<string>>();
		for (const r of summary.rows) {
			m.set(r.model.name, new Set(r.trainedOnTasks ?? []));
		}
		return m;
	});

	let sortedRows = $derived.by(() => {
		let rows = summary.rows;
		if (sort.key) {
			const dir = sort.dir === 'asc' ? 1 : -1;
			const key = sort.key;
			rows = [...rows].sort((a, b) => {
				if (key === 'model') {
					return (
						a.model.displayName.toLowerCase().localeCompare(b.model.displayName.toLowerCase()) * dir
					);
				}
				const taskName = key.slice(5);
				const va = scoreFor(a, taskName);
				const vb = scoreFor(b, taskName);
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

	// Heaviest table on the page (~100k cells). Stream rows in idle
	// slots during off-screen pre-paint; force-finish when the pane
	// activates so a tab click never reveals a partial table.
	// `lastRowSignature` bails the $effect on its own writes.
	const INITIAL_ROW_CHUNK = 60;
	const ROW_CHUNK_STEP = 80;
	let visibleRows = $state(INITIAL_ROW_CHUNK);
	let growVersion = 0;
	let lastRowSignature = '';
	let rowKickoffTimer: ReturnType<typeof setTimeout> | null = null;
	let wrapEl: HTMLDivElement | undefined = $state();
	let paneActiveMo: MutationObserver | null = null;

	$effect(() => {
		const total = sortedRows.length;
		const signature = `${total}|${sortedRows[0]?.model.name ?? ''}|${sortedRows[total - 1]?.model.name ?? ''}`;
		if (signature === lastRowSignature) return;
		lastRowSignature = signature;
		const myVersion = ++growVersion;
		// Already-active pane (deep link) renders everything at once —
		// progressive only makes sense during off-screen pre-paint.
		const pane = wrapEl?.closest('.tab-pane');
		if (!pane || pane.classList.contains('active')) {
			visibleRows = total;
			return;
		}
		visibleRows = Math.min(INITIAL_ROW_CHUNK, total);
		if (visibleRows >= total) return;
		if (rowKickoffTimer) clearTimeout(rowKickoffTimer);
		rowKickoffTimer = setTimeout(() => {
			rowKickoffTimer = null;
			if (myVersion !== growVersion) return;
			const grow = () => {
				if (myVersion !== growVersion) return;
				visibleRows = Math.min(visibleRows + ROW_CHUNK_STEP, total);
				if (visibleRows < total) safeIdle(grow);
			};
			safeIdle(grow);
		}, 60);
	});

	// Force-finish the row chunks the moment the pane activates.
	$effect(() => {
		if (!wrapEl) return;
		const pane = wrapEl.closest('.tab-pane');
		if (!pane) return;
		paneActiveMo?.disconnect();
		paneActiveMo = new MutationObserver(() => {
			if (pane.classList.contains('active')) {
				visibleRows = sortedRows.length;
				growVersion++; // abort any in-flight grow chain
			}
		});
		paneActiveMo.observe(pane, { attributes: true, attributeFilter: ['class'] });
		return () => {
			paneActiveMo?.disconnect();
			paneActiveMo = null;
		};
	});

	let renderedRows = $derived(sortedRows.slice(0, visibleRows));
</script>

<div class="wrap" bind:this={wrapEl}>
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
						<th class="tbl-sticky-col" aria-sort={sort.aria('model')}>
							<SortHeader {sort} field="model" label="Model" align="left" />
						</th>
						{#each sortedTasks as task (task)}
							{@const k = `task:${task}` as SortKey}
							<th
								class="tbl-num"
								aria-sort={sort.aria(k)}
								onpointerenter={(e) => showTaskTip(e, task)}
								onpointerleave={hideTaskTip}
								onfocusin={(e) => showTaskTip(e, task)}
								onfocusout={hideTaskTip}
							>
								<SortHeader {sort} field={k} label={task} ellipsis>
									{#snippet info()}
										<InfoDot ariaLabel="What is {task}?" />
									{/snippet}
								</SortHeader>
							</th>
						{/each}
					</tr>
				</thead>
				<tbody>
					{#each renderedRows as row (row.model.name)}
						{@const rowTrained = trainedByModel.get(row.model.name)}
						<tr class:pinned={pinnedModels.has(row.model.name)}>
							<td class="tbl-pin-col tbl-sticky-pin">
								<PinButton name={row.model.name} />
							</td>
							<td
								class="tbl-sticky-col"
								data-model-type={row.model.modelType}
								onpointerover={(e) => onCellEnter(e, row)}
								onpointerout={onCellLeave}
								onfocusin={(e) => onCellEnter(e, row)}
								onfocusout={onCellLeave}
							>
								<ModelCellName model={row.model} />
							</td>
							{#each sortedTasks as task (task)}
								{@const trained = rowTrained?.has(task) ?? false}
								{@const v = scoreFor(row, task)}
								<td
									class="tbl-num {heat(v, worst[task], best[task])}"
									class:tbl-best={v === best[task]}
									class:trained-on={trained}
								>
									{fmt(v)}{#if trained}<button
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
			<a class="task-tip-title" href={resolve('/tasks/[name]', { name: slug(taskTip.title) })}>
				{taskTip.title}
			</a>
			{#if taskTip.type}<span class="task-tip-type">{taskTip.type}</span>{/if}
			{#if taskTip.mainScore}
				<span class="task-tip-metric">
					Metric: <code>{taskTip.mainScore}</code>
				</span>
			{/if}
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
		color: var(--tip-fg);
		background: var(--tip-bg);
		border-radius: 6px;
		box-shadow: 0 8px 18px rgb(var(--shadow-tint) / 0.22);
		text-align: left;
		white-space: normal;
		z-index: 1000;
		pointer-events: auto;
	}
	/* Column-header tip — same dark-portal treatment as the
	   trained-on bubble and SummaryTable's column tip. */
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
		color: var(--tip-fg);
		background: var(--tip-bg);
		border-radius: 8px;
		box-shadow: 0 12px 28px rgb(var(--shadow-tint) / 0.22);
		text-align: left;
		white-space: normal;
		z-index: 1000;
		pointer-events: auto;
	}
	.task-tip-title {
		display: block;
		font-size: 12px;
		font-weight: 700;
		color: var(--tip-fg);
		margin-bottom: 2px;
		word-break: break-word;
		text-decoration: underline;
		text-decoration-color: color-mix(in srgb, var(--tip-fg) 35%, transparent);
		text-underline-offset: 2px;
	}
	.task-tip-title:hover,
	.task-tip-title:focus-visible {
		text-decoration-color: var(--tip-fg);
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
	.task-tip-metric {
		display: block;
		font-size: 11px;
		color: var(--tip-label);
		margin-bottom: 6px;
	}
	.task-tip-metric code {
		font-family: var(--font-mono);
		font-size: 11px;
		color: var(--tip-fg);
		background: none;
		padding: 0;
	}
	.task-tip-body {
		display: block;
	}
	.task-tip-empty {
		display: block;
		color: var(--tip-label);
		font-style: italic;
	}
</style>
