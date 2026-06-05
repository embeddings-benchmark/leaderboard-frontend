<script lang="ts">
	import type { BenchmarkSummary, SummaryRow } from '$lib/types';
	import { pinnedModels } from '$lib/stores/pinned.svelte';
	import {
		bestPerColumn,
		fmtParamsUnit,
		fmtParamsValue,
		fmtPct,
		heat,
		humanizeType,
		maxOf,
		minOf,
		worstPerColumn
	} from '$lib/format';
	import { stickyHead } from '$lib/actions/sticky-head';
	import { stickyHScroll } from '$lib/actions/sticky-hscroll';
	import { createSortState } from '$lib/stores/sort.svelte';
	import { isBoundaryCross } from '$lib/cell-hover';
	import ModelCellName from './ModelCellName.svelte';
	import PinButton from './PinButton.svelte';
	import ModelHoverPortal from './ModelHoverPortal.svelte';
	import HoverPortal from './HoverPortal.svelte';
	import MarkdownText from './MarkdownText.svelte';

	const INFO = {
		rank: {
			title: 'Rank (Borda)',
			text: 'Rank is computed via the Borda count: each task votes for models by their relative performance. The model with the most votes across tasks gets the highest rank. Borda tends to reward consistent breadth over single peaks.'
		},
		model: {
			title: 'Model',
			text: 'Missing results — the model may not have been run on the tasks in the benchmark. We only display models that have been run on at least one task. To submit results, see the [submitting results guide](https://embeddings-benchmark.github.io/mteb/contributing/submitting_results/).'
		},
		zeroShot: {
			title: 'Zero-shot %',
			text: "What portion of the benchmark a model has not been trained on. 100% means fully out-of-distribution; 50% means it was fine-tuned on half the tasks. '⚠️ NA' means we don't know."
		},
		totalParams: {
			title: 'Total parameters',
			text: 'Total parameter count including embedding weights. Higher means more CPU/GPU memory required.'
		},
		embedding: {
			title: 'Embedding dimension',
			text: 'The size of the vector each model produces. Higher dimensions cost more storage per embedding and more compute downstream.'
		},
		maxTokens: {
			title: 'Max tokens',
			text: 'How many tokens (word-pieces) the model can process in a single input. Larger is usually better for long-context tasks.'
		},
		meanTask: {
			title: 'Mean (Task)',
			text: "Naïve average of the model's scores across every task in the benchmark. Continuous, simple to read, but tasks with higher score variance pull the mean around."
		},
		meanTaskType: {
			title: 'Mean (TaskType)',
			text: 'Weighted average computed by first averaging per task category (Classification, Retrieval, …) and then averaging across categories. Rewards models that perform well in every category.'
		},
		meanPublic: {
			title: 'Mean (Public)',
			text: "Average score across the benchmark's public (openly-released) task subset. Recomputed live when you narrow the visible task set with filters."
		},
		meanPrivate: {
			title: 'Mean (Private)',
			text: "Average score across the benchmark's private (held-out) task subset — datasets the benchmark keeps closed to discourage training-set contamination. Recomputed live with filters."
		}
	} as const;

	// Short explanations for the per-task-type columns. Surfaced on
	// column-header hover so users skimming the table know what each
	// score is measuring without leaving the page.
	const TASK_TYPE_INFO: Record<string, string> = {
		Classification: 'Classify text into pre-defined labels (sentiment, topic, intent, …).',
		Clustering:
			'Group similar texts together without supervision; scored by cluster quality vs gold labels.',
		PairClassification:
			'Predict a relation between two texts — e.g. paraphrase yes/no, entailment.',
		MultilabelClassification: 'Assign one or more labels per text from a fixed vocabulary.',
		Reranking: 'Re-order a candidate list relative to a query; measures top-K ordering quality.',
		InstructionReranking:
			'Rerank candidates according to a free-form natural-language instruction supplied with the query.',
		Retrieval: 'Find the most relevant documents for a query out of a large corpus.',
		STS: 'Rate the semantic similarity between two texts on a continuous scale.',
		BitextMining:
			'Pair sentences across two languages that carry the same meaning (translation alignment).',
		Summarization:
			'Produce or evaluate concise summaries of longer documents; scored against reference summaries.'
	};

	interface Props {
		summary: BenchmarkSummary;
	}
	let { summary }: Props = $props();

	type SortKey =
		| 'rank'
		| 'model'
		| 'totalParams'
		| 'zeroShot'
		| 'meanTask'
		| 'meanTaskType'
		| 'meanPublic'
		| 'meanPrivate'
		| `tt:${string}`;

	// Per-summary-tab sort. URL prefix `s.summary` / `d.summary` keeps
	// the per-task and per-language tabs independent (each has its own
	// namespace). `↕` is the resting indicator when no column is the
	// active sort.
	const sort = createSortState<SortKey>({
		urlKeys: ['s.summary', 'd.summary'],
		ascKeys: ['rank', 'model'],
		defaultIcon: '↕'
	});

	function getValue(row: SummaryRow, key: SortKey): { v: number | string; missing: boolean } {
		switch (key) {
			case 'rank':
				return { v: row.rank, missing: false };
			case 'model':
				return { v: row.model.displayName.toLowerCase(), missing: false };
			case 'totalParams':
				return { v: row.totalParamsB, missing: row.totalParamsB === 0 };
			case 'zeroShot':
				// -1 is the "unknown" sentinel; treat as missing so it sorts
				// to the bottom regardless of direction.
				return { v: row.zeroShotPct, missing: row.zeroShotPct === -1 };
			case 'meanTask':
				return { v: row.meanTask ?? 0, missing: row.meanTask == null };
			case 'meanTaskType':
				return { v: row.meanTaskType ?? 0, missing: row.meanTaskType == null };
			case 'meanPublic': {
				const v = liveMeanPublic(row);
				return { v: v ?? 0, missing: v == null };
			}
			case 'meanPrivate': {
				const v = liveMeanPrivate(row);
				return { v: v ?? 0, missing: v == null };
			}
		}
		if (key.startsWith('tt:')) {
			const tt = key.slice(3);
			const v = row.scoresByTaskType[tt];
			return { v: v ?? 0, missing: v === undefined };
		}
		return { v: 0, missing: true };
	}

	let sortedRows = $derived.by(() => {
		let rows = summary.rows;
		if (sort.key) {
			const dir = sort.dir === 'asc' ? 1 : -1;
			const key = sort.key;
			rows = [...rows].sort((a, b) => {
				const va = getValue(a, key);
				const vb = getValue(b, key);
				// Always push "missing" values to the bottom regardless of direction.
				if (va.missing && !vb.missing) return 1;
				if (!va.missing && vb.missing) return -1;
				if (va.missing && vb.missing) return 0;
				if (typeof va.v === 'string') return (va.v as string).localeCompare(vb.v as string) * dir;
				return ((va.v as number) - (vb.v as number)) * dir;
			});
		}
		// Float pinned rows to the top while preserving their order in the sorted set.
		if (pinnedModels.size === 0) return rows;
		const isPinned = (r: SummaryRow) => pinnedModels.has(r.model.name);
		return [...rows.filter(isPinned), ...rows.filter((r) => !isPinned(r))];
	});

	// Progressive row render — Firefox benefits a lot (cold first-paint
	// drops ~50%) because its layout engine streams large tbodies
	// incrementally and our 80-row first chunk paints before the rest of
	// the layer's columns get reflowed. Chromium / WebKit also see a
	// modest win. `lastRowSignature` lets the $effect bail on its own
	// writes to `visibleRows` (Svelte 5 re-fires the effect on every
	// state change inside it).
	const INITIAL_ROW_CHUNK = 80;
	const ROW_CHUNK_STEP = 200;
	let visibleRows = $state(INITIAL_ROW_CHUNK);
	let growVersion = 0;
	let lastRowSignature = '';
	let rowKickoffTimer: ReturnType<typeof setTimeout> | null = null;
	$effect(() => {
		const total = sortedRows.length;
		const signature = `${total}|${sortedRows[0]?.model.name ?? ''}|${sortedRows[total - 1]?.model.name ?? ''}`;
		if (signature === lastRowSignature) return;
		lastRowSignature = signature;
		const myVersion = ++growVersion;
		visibleRows = Math.min(INITIAL_ROW_CHUNK, total);
		if (visibleRows >= total) return;
		if (rowKickoffTimer) clearTimeout(rowKickoffTimer);
		rowKickoffTimer = setTimeout(() => {
			rowKickoffTimer = null;
			if (myVersion !== growVersion) return;
			const idle = (cb: () => void): number =>
				'requestIdleCallback' in window
					? window.requestIdleCallback(cb, { timeout: 500 })
					: (setTimeout(cb, 0) as unknown as number);
			const grow = () => {
				if (myVersion !== growVersion) return;
				visibleRows = Math.min(visibleRows + ROW_CHUNK_STEP, total);
				if (visibleRows < total) idle(grow);
			};
			idle(grow);
		}, 60);
	});
	let renderedRows = $derived(sortedRows.slice(0, visibleRows));

	function fmtZeroShot(pct: number): string {
		if (pct === -1) return '⚠️ NA';
		return `${pct.toFixed(0)}%`;
	}

	// Display the per-task-type columns A→Z. The API preserves
	// benchmark-specific order, but readers scan a wide table faster
	// when columns are alphabetised (and the mean columns to the left
	// stay anchored). `localeCompare` keeps "STS" before "Summarization"
	// regardless of locale, etc.
	let sortedTaskTypes = $derived([...summary.taskTypes].sort((a, b) => a.localeCompare(b)));
	let best = $derived(
		bestPerColumn(sortedTaskTypes, summary.rows, (r, tt) => r.scoresByTaskType[tt])
	);
	let worst = $derived(
		worstPerColumn(sortedTaskTypes, summary.rows, (r, tt) => r.scoresByTaskType[tt])
	);
	let bestMeanTask = $derived(maxOf(summary.rows.map((r) => r.meanTask)));
	let worstMeanTask = $derived(minOf(summary.rows.map((r) => r.meanTask)));
	let bestMeanTaskType = $derived(maxOf(summary.rows.map((r) => r.meanTaskType)));
	let worstMeanTaskType = $derived(minOf(summary.rows.map((r) => r.meanTaskType)));
	// Column visibility is declarative — `summary.aggregations` lists exactly
	// which mean columns belong on this benchmark's leaderboard. Avoids
	// inferring from the score data (which led to ViDoRe showing an empty
	// Mean (TaskType) column it doesn't actually compute).
	let aggs = $derived(new Set(summary.aggregations ?? []));
	let showMeanTask = $derived(aggs.has('mean_task'));
	let showMeanTaskType = $derived(aggs.has('mean_task_type'));
	let showTaskTypes = $derived(aggs.has('task_types'));
	let showPublicPrivate = $derived(aggs.has('public_private'));
	// Recompute Mean (Public) / Mean (Private) from the model's per-task scores
	// using the benchmark's `tasksMeta[].isPublic` flag. This way the means
	// update live when the user filters the task set, instead of staying frozen
	// at the original benchmark-level values.
	let publicTaskNames = $derived(
		new Set(summary.tasksMeta.filter((t) => t.isPublic !== false).map((t) => t.name))
	);
	let privateTaskNames = $derived(
		new Set(summary.tasksMeta.filter((t) => t.isPublic === false).map((t) => t.name))
	);
	function meanOver(row: SummaryRow, names: Set<string>): number | null {
		if (names.size === 0) return null;
		let sum = 0;
		let n = 0;
		for (const name of names) {
			const v = row.scoresByTask[name];
			if (typeof v === 'number') {
				sum += v;
				n += 1;
			}
		}
		// Strict: missing any visible task drops the mean to null, matching the
		// policy applied to Mean (Task) / Mean (TaskType).
		return n === names.size ? sum / n : null;
	}
	// No fallback to the backend's row.meanPublic / row.meanPrivate: the user
	// might have deliberately filtered every public (or private) task out, in
	// which case the mean is undefined — falling back would surface the
	// pre-filter number and look stale. ``meanOver`` is null on empty input,
	// which is exactly the right answer.
	function liveMeanPublic(row: SummaryRow): number | null {
		if (!showPublicPrivate) return null;
		return meanOver(row, publicTaskNames);
	}
	function liveMeanPrivate(row: SummaryRow): number | null {
		if (!showPublicPrivate) return null;
		return meanOver(row, privateTaskNames);
	}
	let bestMeanPublic = $derived(maxOf(summary.rows.map(liveMeanPublic)));
	let worstMeanPublic = $derived(minOf(summary.rows.map(liveMeanPublic)));
	let bestMeanPrivate = $derived(maxOf(summary.rows.map(liveMeanPrivate)));
	let worstMeanPrivate = $derived(minOf(summary.rows.map(liveMeanPrivate)));

	function isBestScore(row: SummaryRow, taskType: string): boolean {
		return row.scoresByTaskType[taskType] === best[taskType];
	}

	// Tooltip portal: we render a single tooltip element at the SummaryTable's
	// root (outside the <table> + .scroll wrapper) and update its position/content
	// on hover. Putting it inside a `<th>` would trap it inside that th's sticky
	// stacking context — even though it's position:fixed, the neighboring sticky
	// Model column has a higher z-index in their shared parent and would paint
	// over the left edge of any tip that crossed under it.
	//
	// The MODEL-cell hover now delegates to the shared `ModelHoverPortal`
	// (also used by PerTaskTab + PerLanguageTab) so all three tables show
	// byte-identical tooltips. This file's local `tipState` only handles
	// the column-header tooltips, which have a different shape (markdown
	// body, no dl rows).
	type TipState = {
		visible: boolean;
		title: string;
		text: string;
		x: number;
		y: number;
	};
	let tipState = $state<TipState>({
		visible: false,
		title: '',
		text: '',
		x: 0,
		y: 0
	});
	type ModelTip = {
		showFor: (t: HTMLElement, row: SummaryRow) => void;
		hide: () => void;
	};
	let modelTipPortal = $state<ModelTip | undefined>(undefined);

	// Tooltip is `position: fixed; transform: translate(-50%, …)` so x is
	// the desired *centre*. Clamp it to the viewport with a half-width
	// margin so the bubble can't spill off either edge — Rank/leftmost
	// columns previously got the left half cut off; the same logic helps
	// rightmost task-type columns on narrow screens.
	const TIP_MAX_WIDTH = 340;
	const TIP_EDGE = 8;
	function clampTipX(rawX: number): number {
		if (typeof window === 'undefined') return rawX;
		const half = TIP_MAX_WIDTH / 2;
		const min = TIP_EDGE + half;
		const max = window.innerWidth - TIP_EDGE - half;
		// On very narrow viewports (< TIP_MAX_WIDTH) min > max; centre on the
		// viewport in that case rather than letting min clobber max.
		if (min > max) return window.innerWidth / 2;
		return Math.min(max, Math.max(min, rawX));
	}

	function showTip(e: PointerEvent | FocusEvent) {
		cancelHide();
		const cell = e.currentTarget as HTMLElement;
		const title = cell.dataset.tipTitle ?? '';
		const text = cell.dataset.tip ?? '';
		if (!text) return;
		const r = cell.getBoundingClientRect();
		tipState = {
			visible: true,
			title,
			text,
			x: clampTipX(r.left + r.width / 2),
			y: r.bottom
		};
	}

	function showModelTip(e: PointerEvent | FocusEvent, row: SummaryRow) {
		if (!isBoundaryCross(e)) return;
		modelTipPortal?.showFor(e.currentTarget as HTMLElement, row);
	}
	function hideModelTip(e?: PointerEvent | FocusEvent) {
		if (e && !isBoundaryCross(e)) return;
		modelTipPortal?.hide();
	}

	// Hiding is debounced so the user can cross the 6 px gap between the
	// cell and the portal without the tip vanishing mid-traverse. The
	// portal's own pointerenter cancels the pending timer; pointerleave
	// re-arms it.
	let hideTimer: ReturnType<typeof setTimeout> | null = null;
	const HIDE_DELAY_MS = 200;
	function cancelHide() {
		if (hideTimer !== null) {
			clearTimeout(hideTimer);
			hideTimer = null;
		}
	}
	function hideTip(e?: PointerEvent | FocusEvent) {
		// `pointerout` fires on every internal traversal; only schedule
		// the hide when the cursor leaves the cell itself.
		if (e && !isBoundaryCross(e)) return;
		cancelHide();
		hideTimer = setTimeout(() => {
			tipState = { ...tipState, visible: false };
			hideTimer = null;
		}, HIDE_DELAY_MS);
	}
	function keepTip() {
		cancelHide();
	}
</script>

<div class="summary">
	<div class="tbl-scroll" use:stickyHScroll>
		<table class="tbl summary-table" use:stickyHead>
			<thead>
				<tr>
					<th
						class="sticky-left rank-head"
						data-tip-title={INFO.rank.title}
						data-tip={INFO.rank.text}
						onpointerenter={showTip}
						onpointerleave={hideTip}
						onfocusin={showTip}
						onfocusout={hideTip}
						aria-sort={sort.aria('rank')}
					>
						<button class="sort-btn tbl-num" onclick={() => sort.click('rank')}>
							<span>Rank</span>
							<span class="ind" class:on={sort.key === 'rank'}>{sort.icon('rank')}</span>
						</button>
					</th>
					<th
						class="sticky-model"
						aria-sort={sort.aria('model')}
						data-tip-title={INFO.model.title}
						data-tip={INFO.model.text}
						onpointerenter={showTip}
						onpointerleave={hideTip}
						onfocusin={showTip}
						onfocusout={hideTip}
					>
						<button class="sort-btn" onclick={() => sort.click('model')}>
							<span>Model</span>
							<span class="ind" class:on={sort.key === 'model'}>{sort.icon('model')}</span>
						</button>
					</th>
					<th
						class="tbl-num"
						data-tip-title={INFO.totalParams.title}
						data-tip={INFO.totalParams.text}
						onpointerenter={showTip}
						onpointerleave={hideTip}
						onfocusin={showTip}
						onfocusout={hideTip}
						aria-sort={sort.aria('totalParams')}
					>
						<button class="sort-btn tbl-num" onclick={() => sort.click('totalParams')}>
							<span>Total Params</span>
							<span class="ind" class:on={sort.key === 'totalParams'}
								>{sort.icon('totalParams')}</span
							>
						</button>
					</th>
					<th
						class="tbl-num"
						data-tip-title={INFO.zeroShot.title}
						data-tip={INFO.zeroShot.text}
						onpointerenter={showTip}
						onpointerleave={hideTip}
						onfocusin={showTip}
						onfocusout={hideTip}
						aria-sort={sort.aria('zeroShot')}
					>
						<button class="sort-btn tbl-num" onclick={() => sort.click('zeroShot')}>
							<span>Zero-shot</span>
							<span class="ind" class:on={sort.key === 'zeroShot'}>{sort.icon('zeroShot')}</span>
						</button>
					</th>
					{#if showMeanTask}
						<th
							class="tbl-num"
							data-tip-title={INFO.meanTask.title}
							data-tip={INFO.meanTask.text}
							onpointerenter={showTip}
							onpointerleave={hideTip}
							onfocusin={showTip}
							onfocusout={hideTip}
							aria-sort={sort.aria('meanTask')}
						>
							<button class="sort-btn tbl-num" onclick={() => sort.click('meanTask')}>
								<span>Mean (Task)</span>
								<span class="ind" class:on={sort.key === 'meanTask'}>{sort.icon('meanTask')}</span>
							</button>
						</th>
					{/if}
					{#if showMeanTaskType}
						<th
							class="tbl-num"
							data-tip-title={INFO.meanTaskType.title}
							data-tip={INFO.meanTaskType.text}
							onpointerenter={showTip}
							onpointerleave={hideTip}
							onfocusin={showTip}
							onfocusout={hideTip}
							aria-sort={sort.aria('meanTaskType')}
						>
							<button class="sort-btn tbl-num" onclick={() => sort.click('meanTaskType')}>
								<span>Mean (TaskType)</span>
								<span class="ind" class:on={sort.key === 'meanTaskType'}
									>{sort.icon('meanTaskType')}</span
								>
							</button>
						</th>
					{/if}
					{#if showPublicPrivate}
						<th
							class="tbl-num"
							data-tip-title={INFO.meanPublic.title}
							data-tip={INFO.meanPublic.text}
							onpointerenter={showTip}
							onpointerleave={hideTip}
							onfocusin={showTip}
							onfocusout={hideTip}
							aria-sort={sort.aria('meanPublic')}
						>
							<button class="sort-btn tbl-num" onclick={() => sort.click('meanPublic')}>
								<span>Mean (Public)</span>
								<span class="ind" class:on={sort.key === 'meanPublic'}
									>{sort.icon('meanPublic')}</span
								>
							</button>
						</th>
						<th
							class="tbl-num"
							data-tip-title={INFO.meanPrivate.title}
							data-tip={INFO.meanPrivate.text}
							onpointerenter={showTip}
							onpointerleave={hideTip}
							onfocusin={showTip}
							onfocusout={hideTip}
							aria-sort={sort.aria('meanPrivate')}
						>
							<button class="sort-btn tbl-num" onclick={() => sort.click('meanPrivate')}>
								<span>Mean (Private)</span>
								<span class="ind" class:on={sort.key === 'meanPrivate'}
									>{sort.icon('meanPrivate')}</span
								>
							</button>
						</th>
					{/if}
					{#if showTaskTypes}
						{#each sortedTaskTypes as tt (tt)}
							{@const k = `tt:${tt}` as SortKey}
							{@const desc = TASK_TYPE_INFO[tt]}
							<th
								class="tbl-num"
								aria-sort={sort.aria(k)}
								data-tip-title={desc ? humanizeType(tt) : ''}
								data-tip={desc ?? ''}
								onpointerenter={desc ? showTip : undefined}
								onpointerleave={desc ? hideTip : undefined}
								onfocusin={desc ? showTip : undefined}
								onfocusout={desc ? hideTip : undefined}
							>
								<button class="sort-btn tbl-num" onclick={() => sort.click(k)}>
									<span>{humanizeType(tt)}</span>
									<span class="ind" class:on={sort.key === k}>{sort.icon(k)}</span>
								</button>
							</th>
						{/each}
					{/if}
				</tr>
			</thead>
			<tbody>
				{#each renderedRows as row (row.model.name)}
					<tr class:pinned={pinnedModels.has(row.model.name)}>
						<td class="sticky-left">
							<div class="rank-cell">
								<PinButton name={row.model.name} />
								<span class="rank-pill">#{row.rank}</span>
							</div>
						</td>
						<td
							class="sticky-model has-tip"
							data-model-type={row.model.modelType}
							onpointerover={(e) => showModelTip(e, row)}
							onpointerout={hideModelTip}
							onfocusin={(e) => showModelTip(e, row)}
							onfocusout={hideModelTip}
						>
							<ModelCellName model={row.model} />
						</td>
						<td class="tbl-num param-cell" data-model-type={row.model.modelType}>
							{fmtParamsValue(row.totalParamsB)}{#if fmtParamsUnit(row.totalParamsB)}<span
									class="unit">{fmtParamsUnit(row.totalParamsB)}</span
								>{/if}
						</td>
						<td class="tbl-num zs-cell" class:partial={row.zeroShotPct === -1}>
							{fmtZeroShot(row.zeroShotPct)}
						</td>
						{#if showMeanTask}
							<td
								class="tbl-num"
								class:tbl-best={row.meanTask === bestMeanTask}
								style={heat(row.meanTask, worstMeanTask, bestMeanTask)}
							>
								{fmtPct(row.meanTask)}
							</td>
						{/if}
						{#if showMeanTaskType}
							<td
								class="tbl-num"
								class:tbl-best={row.meanTaskType === bestMeanTaskType}
								style={heat(row.meanTaskType, worstMeanTaskType, bestMeanTaskType)}
							>
								{fmtPct(row.meanTaskType)}
							</td>
						{/if}
						{#if showPublicPrivate}
							{@const mp = liveMeanPublic(row)}
							{@const mpr = liveMeanPrivate(row)}
							<td
								class="tbl-num"
								class:tbl-best={mp != null && mp === bestMeanPublic}
								style={heat(mp, worstMeanPublic, bestMeanPublic)}
							>
								{fmtPct(mp)}
							</td>
							<td
								class="tbl-num"
								class:tbl-best={mpr != null && mpr === bestMeanPrivate}
								style={heat(mpr, worstMeanPrivate, bestMeanPrivate)}
							>
								{fmtPct(mpr)}
							</td>
						{/if}
						{#if showTaskTypes}
							{#each sortedTaskTypes as tt (tt)}
								<td
									class="tbl-num"
									class:tbl-best={isBestScore(row, tt)}
									style={heat(row.scoresByTaskType[tt], worst[tt], best[tt])}
								>
									{row.scoresByTaskType[tt] !== undefined ? fmtPct(row.scoresByTaskType[tt]) : ''}
								</td>
							{/each}
						{/if}
					</tr>
				{/each}
			</tbody>
		</table>
	</div>

	<!-- Column-header tooltip — `interactive` so the user can click any
	     [link](url) we slip into the body. The cell's pointerleave
	     still fires on exit because the bubble's `pointerenter` /
	     `pointerleave` chain back into `keepTip` / `hideTip`. -->
	<HoverPortal
		visible={tipState.visible}
		title={tipState.title}
		x={tipState.x}
		y={tipState.y}
		interactive
		onPointerEnter={keepTip}
		onPointerLeave={hideTip}
	>
		<span class="tip-portal-body"><MarkdownText text={tipState.text} /></span>
	</HoverPortal>

	<!-- Model-cell tooltip is the shared `ModelHoverPortal` so all three
	     leaderboard tables (Summary / PerTask / PerLanguage) render
	     byte-identical bubbles. -->
	<ModelHoverPortal bind:this={modelTipPortal} />
</div>

<style>
	/* Stretch this table to the full main-column width — shared `.tbl` deliberately
	   doesn't set a width because per-task/language tables let columns size to
	   content. */
	.summary-table {
		width: 100%;
	}
	/* Tooltip shell + title styles live in HoverPortal.svelte. We only
	   own the column-tip body wrapper so MarkdownText output (links,
	   spans, etc.) sits as a block under the title. */
	.tip-portal-body {
		display: block;
	}

	/* `.type-icon` + per-model-type tints, plus shared row hover, live in
	   src/lib/styles/leaderboard-table.css. The link inside the model
	   cell now comes from ModelCellName.svelte; `:global(...)` reaches
	   it across the component boundary so the dotted-underline hint
	   (only on SummaryTable's tip-bearing cells) still applies. */
	.has-tip :global(.tbl-model-link) {
		text-decoration: underline dotted color-mix(in srgb, var(--link) 50%, transparent);
		text-underline-offset: 3px;
		text-decoration-thickness: 1px;
	}
	.has-tip :global(.tbl-model-link:hover) {
		text-decoration-color: var(--link);
	}
	.sort-btn {
		all: unset;
		/* `all: unset` flips box-sizing back to content-box; force border-box. */
		box-sizing: border-box;
		display: inline-flex;
		align-items: center;
		gap: 6px;
		width: 100%;
		padding: 10px 12px;
		cursor: pointer;
		color: var(--text-muted);
		font-weight: 600;
		transition:
			background 0.12s,
			color 0.12s;
	}
	.sort-btn.tbl-num {
		justify-content: flex-end;
	}
	.zs-cell {
		font-variant-numeric: tabular-nums;
	}
	.zs-cell.partial {
		color: var(--text-subtle);
		font-weight: 500;
	}
	.sort-btn:hover {
		color: var(--text);
		background: color-mix(in srgb, var(--primary-soft) 60%, transparent);
	}
	.sort-btn:focus-visible {
		outline: 2px solid var(--primary);
		outline-offset: -2px;
		border-radius: 4px;
	}
	.ind {
		font-size: 11px;
		color: var(--text-muted);
		opacity: 0.85;
		transition:
			opacity 0.12s,
			color 0.12s;
		font-weight: 700;
	}
	.sort-btn:hover .ind {
		opacity: 1;
	}
	.ind.on {
		color: var(--primary-strong);
		opacity: 1;
	}
	.unit {
		margin-left: 2px;
		font-size: 0.78em;
		font-weight: 500;
		color: var(--text-subtle);
		letter-spacing: 0.02em;
	}
	/* Pin button + rank pill share the leftmost column. */
	.rank-cell {
		display: flex;
		align-items: center;
		gap: 8px;
		padding: 4px 8px;
	}
	/* Combined pin + rank column. */
	.sticky-left {
		position: sticky;
		left: 0;
		background: var(--surface);
		z-index: 2;
		width: 72px;
		min-width: 72px;
	}
	.sticky-left .sort-btn {
		justify-content: flex-start;
		padding: 10px 8px 10px 12px;
	}
	tbody td.sticky-left {
		padding: 0;
	}
	thead th.sticky-left {
		background: var(--surface-muted);
		z-index: 3;
	}
	tbody tr:nth-child(even) td.sticky-left {
		background: var(--row-alt);
	}
	tbody tr:hover td.sticky-left {
		background: var(--row-hover);
	}
	.sticky-model {
		position: sticky;
		left: 72px;
		background: var(--surface);
		z-index: 2;
		/* Hold the column to a fixed width window. Long model names wrap
		   inside the cell (row grows in height) instead of either truncating
		   or stretching the column. */
		width: 260px;
		min-width: 260px;
		max-width: 260px;
		white-space: normal;
		overflow-wrap: anywhere;
		vertical-align: top;
	}
	thead th.sticky-model {
		background: var(--surface-muted);
		z-index: 3;
	}
	tbody tr:nth-child(even) td.sticky-model {
		background: var(--row-alt);
	}
	tbody tr:hover td.sticky-model {
		background: var(--row-hover);
	}

	/* Mobile: 72 px (rank) + 260 px (model) of sticky pane eats almost
	   the whole 375 px viewport, leaving the score columns unreachable.
	   Drop the stickyness and let everything flow inside the horizontal
	   scroll container — rank and model just become the first two
	   columns the user scrolls past. */
	@media (max-width: 640px) {
		.sticky-left,
		thead th.sticky-left,
		tbody td.sticky-left {
			position: static;
			width: auto;
			min-width: 0;
		}
		.sticky-model,
		thead th.sticky-model {
			position: static;
			left: auto;
			width: auto;
			min-width: 160px;
			max-width: 200px;
		}
	}
</style>
