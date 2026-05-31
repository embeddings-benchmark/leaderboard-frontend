<script lang="ts">
	import type { BenchmarkSummary, SummaryRow } from '$lib/types';
	import { pinnedModels } from '$lib/stores/pinned.svelte';

	const INFO = {
		rank: {
			title: 'Rank (Borda)',
			text: 'Rank is computed via the Borda count: each task votes for models by their relative performance. The model with the most votes across tasks gets the highest rank. Borda tends to reward consistent breadth over single peaks.'
		},
		zeroShot: {
			title: 'Zero-shot %',
			text: "What portion of the benchmark a model has not been trained on. 100% means fully out-of-distribution; 50% means it was fine-tuned on half the tasks. '⚠️ NA' means we don't know."
		},
		activeParams: {
			title: 'Active parameters',
			text: 'Parameters actively used during inference. For dense models this equals total minus embedding params; for MoE models it can be much lower.'
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
			text: 'Naïve average of the model\'s scores across every task in the benchmark. Continuous, simple to read, but tasks with higher score variance pull the mean around.'
		},
		meanTaskType: {
			title: 'Mean (TaskType)',
			text: 'Weighted average computed by first averaging per task category (Classification, Retrieval, …) and then averaging across categories. Rewards models that perform well in every category.'
		}
	} as const;

	interface Props {
		summary: BenchmarkSummary;
	}
	let { summary }: Props = $props();

	type SortKey =
		| 'rank'
		| 'model'
		| 'activeParams'
		| 'totalParams'
		| 'meanTask'
		| 'meanTaskType'
		| `tt:${string}`;
	type Dir = 'asc' | 'desc';

	let sortKey = $state<SortKey | null>(null);
	let sortDir = $state<Dir>('desc');

	// Score-like columns default to descending (best first); rank and name default to ascending.
	function defaultDir(key: SortKey): Dir {
		return key === 'rank' || key === 'model' ? 'asc' : 'desc';
	}

	function clickSort(key: SortKey) {
		if (sortKey !== key) {
			sortKey = key;
			sortDir = defaultDir(key);
			return;
		}
		// Same column: toggle once, then clear on the third click.
		if (sortDir === defaultDir(key)) {
			sortDir = sortDir === 'asc' ? 'desc' : 'asc';
		} else {
			sortKey = null;
		}
	}

	function getValue(row: SummaryRow, key: SortKey): { v: number | string; missing: boolean } {
		switch (key) {
			case 'rank':
				return { v: row.rank, missing: false };
			case 'model':
				return { v: row.model.displayName.toLowerCase(), missing: false };
			case 'activeParams':
				return { v: row.activeParamsB, missing: row.activeParamsB === 0 };
			case 'totalParams':
				return { v: row.totalParamsB, missing: row.totalParamsB === 0 };
			case 'meanTask':
				return { v: row.meanTask, missing: false };
			case 'meanTaskType':
				return { v: row.meanTaskType, missing: false };
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

	function fmtPct(score: number): string {
		return (score * 100).toFixed(2);
	}
	/* Heatmap shade for score cells: stretches the meaningful 0.45–0.75 range
	   across a 0–55% orange wash so weak scores look pale and strong scores pop. */
	function heat(score: number | undefined): string {
		if (score === undefined) return '';
		const v = Math.max(0, Math.min(1, (score - 0.45) / 0.3));
		const pct = Math.round(v * 55);
		if (pct === 0) return '';
		return `background-color: color-mix(in srgb, var(--primary) ${pct}%, transparent);`;
	}
	function fmtZeroShot(pct: number): string {
		if (pct === -1) return '⚠️ NA';
		return `${pct.toFixed(0)}%`;
	}
	function fmtParamsValue(b: number): string {
		if (b === 0) return '—';
		// Models under 1B are shown in millions so the magnitude is obvious at a glance.
		if (b >= 1) return b.toFixed(1);
		return (b * 1000).toFixed(0);
	}
	function fmtParamsUnit(b: number): string {
		if (b === 0) return '';
		return b >= 1 ? 'B' : 'M';
	}
	function fmtInt(n: number): string {
		if (!n) return '—';
		return n.toLocaleString();
	}
	function hasValue(s: string): boolean {
		return s !== '—' && s !== '⚠️ NA';
	}

	function bestPerTaskType(): Record<string, number> {
		const best: Record<string, number> = {};
		for (const tt of summary.taskTypes) {
			let max = -Infinity;
			for (const r of summary.rows) {
				const v = r.scoresByTaskType[tt];
				if (v !== undefined && v > max) max = v;
			}
			best[tt] = max;
		}
		return best;
	}
	let best = $derived(bestPerTaskType());
	let bestMeanTask = $derived(Math.max(...summary.rows.map((r) => r.meanTask)));
	let bestMeanTaskType = $derived(Math.max(...summary.rows.map((r) => r.meanTaskType)));

	function isBestScore(row: SummaryRow, taskType: string): boolean {
		return row.scoresByTaskType[taskType] === best[taskType];
	}

	function sortIcon(key: SortKey): string {
		if (sortKey !== key) return '';
		return sortDir === 'asc' ? '↑' : '↓';
	}

	function ariaSort(key: SortKey): 'ascending' | 'descending' | 'none' {
		if (sortKey !== key) return 'none';
		return sortDir === 'asc' ? 'ascending' : 'descending';
	}

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
		const rows: TipRow[] = [
			{ k: 'Zero-shot', v: fmtZeroShot(row.zeroShotPct) },
			{
				k: 'Embedding dim',
				v: row.embeddingDim ? `${row.embeddingDim.toLocaleString()} d` : '—'
			},
			{
				k: 'Max tokens',
				v: row.maxTokens ? `${row.maxTokens.toLocaleString()} tok` : '—'
			},
			{ k: 'Type', v: row.model.modelType },
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
<div class="scroll">
	<table>
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
					<button class="sort-btn num" onclick={() => clickSort('rank')}>
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
					class="num"
					data-tip-title={INFO.activeParams.title}
					data-tip={INFO.activeParams.text}
					onpointerenter={showTip}
					onpointerleave={hideTip}
					onfocusin={showTip}
					onfocusout={hideTip}
					aria-sort={ariaSort('activeParams')}
				>
					<button class="sort-btn num" onclick={() => clickSort('activeParams')}>
						<span>Active Params</span>
						<span class="ind" class:on={sortKey === 'activeParams'}
							>{sortIcon('activeParams') || '↕'}</span
						>
					</button>
				</th>
				<th
					class="num"
					data-tip-title={INFO.totalParams.title}
					data-tip={INFO.totalParams.text}
					onpointerenter={showTip}
					onpointerleave={hideTip}
					onfocusin={showTip}
					onfocusout={hideTip}
					aria-sort={ariaSort('totalParams')}
				>
					<button class="sort-btn num" onclick={() => clickSort('totalParams')}>
						<span>Total Params</span>
						<span class="ind" class:on={sortKey === 'totalParams'}
							>{sortIcon('totalParams') || '↕'}</span
						>
					</button>
				</th>
				<th
					class="num"
					data-tip-title={INFO.meanTask.title}
					data-tip={INFO.meanTask.text}
					onpointerenter={showTip}
					onpointerleave={hideTip}
					onfocusin={showTip}
					onfocusout={hideTip}
					aria-sort={ariaSort('meanTask')}
				>
					<button class="sort-btn num" onclick={() => clickSort('meanTask')}>
						<span>Mean (Task)</span>
						<span class="ind" class:on={sortKey === 'meanTask'}
							>{sortIcon('meanTask') || '↕'}</span
						>
					</button>
				</th>
				<th
					class="num"
					data-tip-title={INFO.meanTaskType.title}
					data-tip={INFO.meanTaskType.text}
					onpointerenter={showTip}
					onpointerleave={hideTip}
					onfocusin={showTip}
					onfocusout={hideTip}
					aria-sort={ariaSort('meanTaskType')}
				>
					<button class="sort-btn num" onclick={() => clickSort('meanTaskType')}>
						<span>Mean (TaskType)</span>
						<span class="ind" class:on={sortKey === 'meanTaskType'}
							>{sortIcon('meanTaskType') || '↕'}</span
						>
					</button>
				</th>
				{#each summary.taskTypes as tt (tt)}
					{@const k = `tt:${tt}` as SortKey}
					<th class="num" aria-sort={ariaSort(k)}>
						<button class="sort-btn num" onclick={() => clickSort(k)}>
							<span>{tt}</span>
							<span class="ind" class:on={sortKey === k}>{sortIcon(k) || '↕'}</span>
						</button>
					</th>
				{/each}
			</tr>
		</thead>
		<tbody>
			{#each sortedRows as row (row.model.name)}
				<tr class:pinned={pinnedModels.has(row.model.name)}>
					<td class="sticky-left">
						<div class="rank-cell">
							<button
								type="button"
								class="pin-btn"
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
							<a href={row.model.url} target="_blank" rel="noreferrer" class="model-link">
								<span class="model-org">{row.model.org}</span><span class="model-sep">/</span><span
									class="model-name">{row.model.displayName}</span
								>
							</a>
						{:else}
							<span class="model-link">
								<span class="model-org">{row.model.org}</span><span class="model-sep">/</span><span
									class="model-name">{row.model.displayName}</span
								>
							</span>
						{/if}
					</td>
					<td class="num param-cell" data-model-type={row.model.modelType}>
						{fmtParamsValue(row.activeParamsB)}{#if fmtParamsUnit(row.activeParamsB)}<span
								class="unit">{fmtParamsUnit(row.activeParamsB)}</span
							>{/if}
					</td>
					<td class="num param-cell" data-model-type={row.model.modelType}>
						{fmtParamsValue(row.totalParamsB)}{#if fmtParamsUnit(row.totalParamsB)}<span
								class="unit">{fmtParamsUnit(row.totalParamsB)}</span
							>{/if}
					</td>
					<td class="num" class:best={row.meanTask === bestMeanTask} style={heat(row.meanTask)}>
						{fmtPct(row.meanTask)}
					</td>
					<td
						class="num"
						class:best={row.meanTaskType === bestMeanTaskType}
						style={heat(row.meanTaskType)}
					>
						{fmtPct(row.meanTaskType)}
					</td>
					{#each summary.taskTypes as tt (tt)}
						<td
							class="num"
							class:best={isBestScore(row, tt)}
							style={heat(row.scoresByTaskType[tt])}
						>
							{row.scoresByTaskType[tt] !== undefined ? fmtPct(row.scoresByTaskType[tt]) : ''}
						</td>
					{/each}
				</tr>
			{/each}
		</tbody>
	</table>
</div>

{#if tipState.visible}
	<div
		class="tip-portal"
		role="tooltip"
		style:left="{tipState.x}px"
		style:top="{tipState.y}px"
	>
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
	.scroll {
		overflow-x: auto;
		border: 1px solid var(--border);
		border-radius: 8px;
		background: var(--surface);
		box-shadow: var(--shadow-sm);
	}
	table {
		width: 100%;
		border-collapse: separate;
		border-spacing: 0;
		font-size: 13px;
	}
	thead th {
		background: var(--surface-muted);
		color: var(--text-muted);
		font-weight: 600;
		text-align: left;
		padding: 0;
		border-bottom: 1px solid var(--border);
		white-space: nowrap;
		position: sticky;
		top: 0;
		z-index: 1;
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
		box-shadow: 0 12px 28px rgba(15, 23, 42, 0.22);
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
		color: #ff9b6f;
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

	/* Soft per-model-type tint on the Model + Params columns. The chosen
	   color-mix targets are opaque (mixed with white) so they cover the sticky
	   Model cell's white background while still feeling subtle.   */
	.sticky-model[data-model-type='dense'],
	.param-cell[data-model-type='dense'] {
		background-color: color-mix(in srgb, #e8edff 55%, white);
	}
	.sticky-model[data-model-type='cross-encoder'],
	.param-cell[data-model-type='cross-encoder'] {
		background-color: color-mix(in srgb, #ffe6dc 55%, white);
	}
	.sticky-model[data-model-type='late-interaction'],
	.param-cell[data-model-type='late-interaction'] {
		background-color: color-mix(in srgb, #def7e9 55%, white);
	}
	.sticky-model[data-model-type='sparse'],
	.param-cell[data-model-type='sparse'] {
		background-color: color-mix(in srgb, #fff1d4 55%, white);
	}
	.sticky-model[data-model-type='router'],
	.param-cell[data-model-type='router'] {
		background-color: color-mix(in srgb, #f2e7ff 55%, white);
	}
	/* On hover, deepen the tint slightly so the row still has feedback. */
	tbody tr:hover td.sticky-model[data-model-type],
	tbody tr:hover td.param-cell[data-model-type] {
		filter: brightness(0.96);
	}
	/* Subtle dotted underline on the model link cues that hovering shows more. */
	.has-tip a {
		text-decoration: underline dotted color-mix(in srgb, var(--link) 50%, transparent);
		text-underline-offset: 3px;
		text-decoration-thickness: 1px;
	}
	.has-tip a:hover {
		text-decoration-color: var(--link);
	}
	/* Model name = org/name (HF-style). Org and slash are muted so the model
	   identity reads clearly without losing the organization at a glance. */
	.model-org {
		color: var(--text-subtle);
		font-weight: 400;
	}
	.model-sep {
		color: var(--border-strong);
		margin: 0 1px;
	}
	.model-name {
		font-weight: 600;
	}
	.model-link {
		display: inline-block;
		max-width: 100%;
		overflow: hidden;
		text-overflow: ellipsis;
	}
	th.num,
	td.num {
		text-align: right;
		font-variant-numeric: tabular-nums;
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
	.sort-btn.num {
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
	tbody td {
		padding: 8px 12px;
		border-bottom: 1px solid var(--border);
		white-space: nowrap;
	}
	tbody tr:nth-child(even) td {
		background: var(--row-alt);
	}
	tbody tr:hover td {
		background: var(--row-hover);
	}
	.best {
		font-weight: 700;
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
	.pin-btn {
		display: inline-flex;
		align-items: center;
		justify-content: center;
		width: 22px;
		height: 22px;
		background: none;
		border: 1px solid transparent;
		border-radius: 6px;
		color: var(--border-strong);
		cursor: pointer;
		padding: 0;
		transition:
			color 0.12s,
			background 0.12s,
			transform 0.06s;
	}
	.pin-btn:hover {
		color: var(--text-muted);
		background: var(--surface-muted);
	}
	.pin-btn.on {
		color: var(--primary);
		background: var(--primary-soft);
		border-color: color-mix(in srgb, var(--primary) 35%, transparent);
		transform: rotate(35deg);
	}
	.pin-btn:focus-visible {
		outline: 2px solid var(--primary);
		outline-offset: 1px;
	}
	tbody tr.pinned td {
		background: color-mix(in srgb, var(--primary-soft) 65%, transparent);
	}
	tbody tr.pinned + tr:not(.pinned) td {
		border-top: 2px solid color-mix(in srgb, var(--primary) 50%, var(--border));
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
		min-width: 220px;
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
</style>
