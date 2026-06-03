<script lang="ts">
	import type { BenchmarkSummary, SummaryRow } from '$lib/types';
	import { pinnedModels } from '$lib/stores/pinned.svelte';
	import {
		ariaSort as ariaSortFor,
		bestPerColumn,
		defaultDirFor,
		fmtParamsUnit,
		fmtParamsValue,
		fmtPct,
		heat,
		humanizeType,
		maxOf,
		nextSort,
		sortIcon as sortIconFor
	} from '$lib/format';
	import { stickyHead } from '$lib/actions/sticky-head';
	import { getParam, updateUrl } from '$lib/url-state';

	const INFO = {
		rank: {
			title: 'Rank (Borda)',
			text: 'Rank is computed via the Borda count: each task votes for models by their relative performance. The model with the most votes across tasks gets the highest rank. Borda tends to reward consistent breadth over single peaks.'
		},
		zeroShot: {
			title: 'Zero-shot %',
			text: "What portion of the benchmark a model has not been trained on. 100% means fully out-of-distribution; 50% means it was fine-tuned on half the tasks. '⚠️ NA' means we don't know."
		},
		totalParams: {
			title: 'Total parameters',
			text: 'Total parameter count including embedding weights, in billions. Higher means more CPU/GPU memory required.'
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

	interface Props {
		summary: BenchmarkSummary;
	}
	let { summary }: Props = $props();

	type SortKey =
		| 'rank'
		| 'model'
		| 'totalParams'
		| 'meanTask'
		| 'meanTaskType'
		| 'meanPublic'
		| 'meanPrivate'
		| `tt:${string}`;
	type Dir = 'asc' | 'desc';

	// Hydrate sort from `?s.summary=<key>` + `?d.summary=<asc|desc>` so a
	// shared link restores the user's ordering. Per-table namespace keeps the
	// per-task / per-language tabs independent.
	const initialKey = getParam('s.summary');
	const initialDir = getParam('d.summary');
	let sortKey = $state<SortKey | null>((initialKey as SortKey | null) ?? null);
	let sortDir = $state<Dir>(initialDir === 'asc' ? 'asc' : 'desc');
	$effect(() => {
		updateUrl({
			's.summary': sortKey,
			'd.summary': sortKey ? sortDir : null
		});
	});

	// Score-like columns default to descending (best first); rank and name default to ascending.
	const ASC_KEYS: readonly SortKey[] = ['rank', 'model'];
	const defaultDir = (key: SortKey) => defaultDirFor(key, ASC_KEYS);

	function clickSort(key: SortKey) {
		const next = nextSort(key, sortKey, sortDir, defaultDir);
		sortKey = next.key;
		sortDir = next.dir;
	}

	function getValue(row: SummaryRow, key: SortKey): { v: number | string; missing: boolean } {
		switch (key) {
			case 'rank':
				return { v: row.rank, missing: false };
			case 'model':
				return { v: row.model.displayName.toLowerCase(), missing: false };
			case 'totalParams':
				return { v: row.totalParamsB, missing: row.totalParamsB === 0 };
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
		if (sortKey) {
			const dir = sortDir === 'asc' ? 1 : -1;
			const key = sortKey;
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
	let bestMeanTask = $derived(maxOf(summary.rows.map((r) => r.meanTask)));
	let bestMeanTaskType = $derived(maxOf(summary.rows.map((r) => r.meanTaskType)));
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
	let bestMeanPrivate = $derived(maxOf(summary.rows.map(liveMeanPrivate)));

	function isBestScore(row: SummaryRow, taskType: string): boolean {
		return row.scoresByTaskType[taskType] === best[taskType];
	}

	// SummaryTable uses '' for inactive sort, not '↕' like the
	// per-task / per-language tables.
	const sortIcon = (key: SortKey) => sortIconFor(key, sortKey, sortDir, '');
	const ariaSort = (key: SortKey) => ariaSortFor(key, sortKey, sortDir);

	// Tooltip portal: we render a single tooltip element at the SummaryTable's
	// root (outside the <table> + .scroll wrapper) and update its position/content
	// on hover. Putting it inside a `<th>` would trap it inside that th's sticky
	// stacking context — even though it's position:fixed, the neighboring sticky
	// Model column has a higher z-index in their shared parent and would paint
	// over the left edge of any tip that crossed under it.
	type TipKind = 'col' | 'model';
	type TipRow = { k: string; v: string };
	type TipState = {
		visible: boolean;
		kind: TipKind;
		title: string;
		text: string;
		rows: TipRow[];
		x: number;
		y: number;
	};
	let tipState = $state<TipState>({
		visible: false,
		kind: 'col',
		title: '',
		text: '',
		rows: [],
		x: 0,
		y: 0
	});

	function showTip(e: PointerEvent | FocusEvent) {
		const cell = e.currentTarget as HTMLElement;
		const title = cell.dataset.tipTitle ?? '';
		const text = cell.dataset.tip ?? '';
		if (!text) return;
		const r = cell.getBoundingClientRect();
		tipState = {
			visible: true,
			kind: 'col',
			title,
			text,
			rows: [],
			x: r.left + r.width / 2,
			y: r.bottom
		};
	}

	function showModelTip(e: PointerEvent | FocusEvent, row: SummaryRow) {
		const cell = e.currentTarget as HTMLElement;
		const r = cell.getBoundingClientRect();
		const activeParamsLabel = row.activeParamsB
			? `${fmtParamsValue(row.activeParamsB)}${fmtParamsUnit(row.activeParamsB)}`
			: '—';
		const rows: TipRow[] = [
			{ k: 'Type', v: row.model.modelType },
			{ k: 'Active params', v: activeParamsLabel },
			{ k: 'Zero-shot', v: fmtZeroShot(row.zeroShotPct) },
			{
				k: 'Embedding dim',
				v: row.embeddingDim ? `${row.embeddingDim.toLocaleString()} d` : '—'
			},
			{
				k: 'Max tokens',
				v: row.maxTokens ? `${row.maxTokens.toLocaleString()} tok` : '—'
			},
			{ k: 'Released', v: row.model.releaseDate ?? '—' }
		];
		tipState = {
			visible: true,
			kind: 'model',
			title: row.model.displayName,
			text: '',
			rows,
			x: r.left + r.width / 2,
			y: r.bottom
		};
	}

	function hideTip() {
		tipState = { ...tipState, visible: false };
	}
</script>

<div class="summary">
	<div class="tbl-scroll">
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
						aria-sort={ariaSort('rank')}
					>
						<button class="sort-btn tbl-num" onclick={() => clickSort('rank')}>
							<span>Rank</span>
							<span class="ind" class:on={sortKey === 'rank'}>{sortIcon('rank') || '↕'}</span>
						</button>
					</th>
					<th class="sticky-model" aria-sort={ariaSort('model')}>
						<button class="sort-btn" onclick={() => clickSort('model')}>
							<span>Model</span>
							<span class="ind" class:on={sortKey === 'model'}>{sortIcon('model') || '↕'}</span>
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
						aria-sort={ariaSort('totalParams')}
					>
						<button class="sort-btn tbl-num" onclick={() => clickSort('totalParams')}>
							<span>Total Params</span>
							<span class="ind" class:on={sortKey === 'totalParams'}
								>{sortIcon('totalParams') || '↕'}</span
							>
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
							aria-sort={ariaSort('meanTask')}
						>
							<button class="sort-btn tbl-num" onclick={() => clickSort('meanTask')}>
								<span>Mean (Task)</span>
								<span class="ind" class:on={sortKey === 'meanTask'}
									>{sortIcon('meanTask') || '↕'}</span
								>
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
							aria-sort={ariaSort('meanTaskType')}
						>
							<button class="sort-btn tbl-num" onclick={() => clickSort('meanTaskType')}>
								<span>Mean (TaskType)</span>
								<span class="ind" class:on={sortKey === 'meanTaskType'}
									>{sortIcon('meanTaskType') || '↕'}</span
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
							aria-sort={ariaSort('meanPublic')}
						>
							<button class="sort-btn tbl-num" onclick={() => clickSort('meanPublic')}>
								<span>Mean (Public)</span>
								<span class="ind" class:on={sortKey === 'meanPublic'}
									>{sortIcon('meanPublic') || '↕'}</span
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
							aria-sort={ariaSort('meanPrivate')}
						>
							<button class="sort-btn tbl-num" onclick={() => clickSort('meanPrivate')}>
								<span>Mean (Private)</span>
								<span class="ind" class:on={sortKey === 'meanPrivate'}
									>{sortIcon('meanPrivate') || '↕'}</span
								>
							</button>
						</th>
					{/if}
					{#if showTaskTypes}
						{#each sortedTaskTypes as tt (tt)}
							{@const k = `tt:${tt}` as SortKey}
							<th class="tbl-num" aria-sort={ariaSort(k)}>
								<button class="sort-btn tbl-num" onclick={() => clickSort(k)}>
									<span>{humanizeType(tt)}</span>
									<span class="ind" class:on={sortKey === k}>{sortIcon(k) || '↕'}</span>
								</button>
							</th>
						{/each}
					{/if}
				</tr>
			</thead>
			<tbody>
				{#each sortedRows as row (row.model.name)}
					<tr class:pinned={pinnedModels.has(row.model.name)}>
						<td class="sticky-left">
							<div class="rank-cell">
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
								<span class="rank-num">{row.rank}</span>
							</div>
						</td>
						<td
							class="sticky-model has-tip"
							data-model-type={row.model.modelType}
							onpointerenter={(e) => showModelTip(e, row)}
							onpointerleave={hideTip}
							onfocusin={(e) => showModelTip(e, row)}
							onfocusout={hideTip}
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
						<td class="tbl-num param-cell" data-model-type={row.model.modelType}>
							{fmtParamsValue(row.totalParamsB)}{#if fmtParamsUnit(row.totalParamsB)}<span
									class="unit">{fmtParamsUnit(row.totalParamsB)}</span
								>{/if}
						</td>
						{#if showMeanTask}
							<td
								class="tbl-num"
								class:tbl-best={row.meanTask === bestMeanTask}
								style={heat(row.meanTask, bestMeanTask)}
							>
								{fmtPct(row.meanTask)}
							</td>
						{/if}
						{#if showMeanTaskType}
							<td
								class="tbl-num"
								class:tbl-best={row.meanTaskType === bestMeanTaskType}
								style={heat(row.meanTaskType, bestMeanTaskType)}
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
								style={heat(mp, bestMeanPublic)}
							>
								{fmtPct(mp)}
							</td>
							<td
								class="tbl-num"
								class:tbl-best={mpr != null && mpr === bestMeanPrivate}
								style={heat(mpr, bestMeanPrivate)}
							>
								{fmtPct(mpr)}
							</td>
						{/if}
						{#if showTaskTypes}
							{#each sortedTaskTypes as tt (tt)}
								<td
									class="tbl-num"
									class:tbl-best={isBestScore(row, tt)}
									style={heat(row.scoresByTaskType[tt], best[tt])}
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

	{#if tipState.visible}
		<div class="tip-portal" role="tooltip" style:left="{tipState.x}px" style:top="{tipState.y}px">
			{#if tipState.title}<strong class="tip-portal-title">{tipState.title}</strong>{/if}
			{#if tipState.kind === 'col'}
				<span class="tip-portal-body">{tipState.text}</span>
			{:else}
				<dl class="tip-portal-dl">
					{#each tipState.rows as r (r.k)}
						<div>
							<dt>{r.k}</dt>
							<dd>{r.v}</dd>
						</div>
					{/each}
				</dl>
			{/if}
		</div>
	{/if}
</div>

<style>
	/* Stretch this table to the full main-column width — shared `.tbl` deliberately
	   doesn't set a width because per-task/language tables let columns size to
	   content. */
	.summary-table {
		width: 100%;
	}
	/* Tooltip portal — rendered as a sibling of .scroll so it isn't trapped in
	   any sticky <th>'s stacking context. position:fixed with JS coordinates. */
	.tip-portal {
		position: fixed;
		transform: translate(-50%, 6px);
		min-width: 220px;
		max-width: 340px;
		padding: 10px 12px;
		background: #1f2329;
		color: #f1f3f5;
		border-radius: 8px;
		font-size: 12px;
		font-weight: 400;
		font-family: var(--font-sans);
		text-transform: none;
		letter-spacing: 0;
		line-height: 1.5;
		text-align: left;
		z-index: 1000;
		box-shadow: 0 12px 28px rgb(15, 23, 42, 0.22);
		white-space: normal;
		pointer-events: none;
	}
	.tip-portal::before {
		content: '';
		position: absolute;
		top: -4px;
		left: 50%;
		transform: translateX(-50%) rotate(45deg);
		width: 8px;
		height: 8px;
		background: #1f2329;
	}
	.tip-portal-title {
		display: block;
		font-size: 11px;
		font-weight: 700;
		letter-spacing: 0.04em;
		text-transform: uppercase;
		/* Theme accent so the title pops against the (always dark)
		   tooltip background — orange in light mode, blue in dark
		   mode. The previous hardcoded `#ff9b6f` looked stale in
		   dark theme where every other accent flipped to azure. */
		color: var(--primary);
		margin-bottom: 4px;
	}
	.tip-portal-body {
		display: block;
	}
	.tip-portal-dl {
		display: grid;
		grid-template-columns: max-content 1fr;
		gap: 4px 14px;
		margin: 0;
	}
	.tip-portal-dl > div {
		display: contents;
	}
	.tip-portal-dl dt {
		font-size: 10px;
		letter-spacing: 0.04em;
		text-transform: uppercase;
		color: #9aa3ad;
		font-weight: 600;
		align-self: center;
	}
	.tip-portal-dl dd {
		margin: 0;
		font-variant-numeric: tabular-nums;
		font-weight: 500;
		color: #f1f3f5;
	}

	/* Soft per-model-type tint on the Model + Params columns. Theme-aware
	   tints from the shared --tint-* palette — pastel-on-white in light
	   mode, dim-muted-on-dark in dark mode. */
	.sticky-model[data-model-type='dense'],
	.param-cell[data-model-type='dense'] {
		background-color: color-mix(in srgb, var(--tint-blue) 70%, var(--surface));
	}
	.sticky-model[data-model-type='cross-encoder'],
	.param-cell[data-model-type='cross-encoder'] {
		background-color: color-mix(in srgb, var(--tint-orange) 70%, var(--surface));
	}
	.sticky-model[data-model-type='late-interaction'],
	.param-cell[data-model-type='late-interaction'] {
		background-color: color-mix(in srgb, var(--tint-green) 70%, var(--surface));
	}
	.sticky-model[data-model-type='sparse'],
	.param-cell[data-model-type='sparse'] {
		background-color: color-mix(in srgb, var(--tint-amber) 70%, var(--surface));
	}
	.sticky-model[data-model-type='router'],
	.param-cell[data-model-type='router'] {
		background-color: color-mix(in srgb, var(--tint-purple) 70%, var(--surface));
	}
	/* Tint the model name itself so the type is readable from the text
	   alone (the row's column tint already echoes it). Foregrounds come
	   from the same --tint-*-fg tokens used by chips elsewhere, so the
	   palette stays consistent. The org + slash stay muted so the model
	   name remains the visual anchor. */
	.sticky-model[data-model-type='dense'] .tbl-model-name {
		color: var(--tint-blue-fg);
	}
	.sticky-model[data-model-type='cross-encoder'] .tbl-model-name {
		color: var(--tint-orange-fg);
	}
	.sticky-model[data-model-type='late-interaction'] .tbl-model-name {
		color: var(--tint-green-fg);
	}
	.sticky-model[data-model-type='sparse'] .tbl-model-name {
		color: var(--tint-amber-fg);
	}
	.sticky-model[data-model-type='router'] .tbl-model-name {
		color: var(--tint-purple-fg);
	}
	/* Whole-row hover feedback lives in src/lib/styles/leaderboard-table.css
	   so PerTaskTab / PerLanguageTab / model + task detail tables all
	   share the same inset-shadow treatment. */
	/* Subtle dotted underline on the model link cues that hovering shows more. */
	.has-tip a {
		text-decoration: underline dotted color-mix(in srgb, var(--link) 50%, transparent);
		text-underline-offset: 3px;
		text-decoration-thickness: 1px;
	}
	.has-tip a:hover {
		text-decoration-color: var(--link);
	}
	.sort-btn {
		all: unset;
		/* all: unset resets box-sizing to content-box; force border-box so that
		   width: 100% + horizontal padding stays inside the <th>. Otherwise the
		   right-aligned sort indicator gets painted outside the column. */
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
	/* Rank-cell layout: pin button + rank number share the leftmost column. */
	.rank-cell {
		display: flex;
		align-items: center;
		gap: 8px;
		padding: 4px 8px;
	}
	.rank-num {
		font-variant-numeric: tabular-nums;
		font-weight: 600;
		min-width: 16px;
		text-align: right;
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
