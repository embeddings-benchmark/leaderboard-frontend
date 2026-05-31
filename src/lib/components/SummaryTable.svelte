<script lang="ts">
	import type { BenchmarkSummary, SummaryRow } from '$lib/types';

	interface Props {
		summary: BenchmarkSummary;
	}
	let { summary }: Props = $props();

	type SortKey =
		| 'rank'
		| 'model'
		| 'zeroShot'
		| 'activeParams'
		| 'totalParams'
		| 'embeddingDim'
		| 'maxTokens'
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
			case 'zeroShot':
				return { v: row.zeroShotPct, missing: row.zeroShotPct === -1 };
			case 'activeParams':
				return { v: row.activeParamsB, missing: row.activeParamsB === 0 };
			case 'totalParams':
				return { v: row.totalParamsB, missing: row.totalParamsB === 0 };
			case 'embeddingDim':
				return { v: row.embeddingDim, missing: !row.embeddingDim };
			case 'maxTokens':
				return { v: row.maxTokens, missing: !row.maxTokens };
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
		if (!sortKey) return summary.rows;
		const dir = sortDir === 'asc' ? 1 : -1;
		const key = sortKey;
		return [...summary.rows].sort((a, b) => {
			const va = getValue(a, key);
			const vb = getValue(b, key);
			// Always push "missing" values to the bottom regardless of direction.
			if (va.missing && !vb.missing) return 1;
			if (!va.missing && vb.missing) return -1;
			if (va.missing && vb.missing) return 0;
			if (typeof va.v === 'string') return (va.v as string).localeCompare(vb.v as string) * dir;
			return ((va.v as number) - (vb.v as number)) * dir;
		});
	});

	function fmtPct(score: number): string {
		return (score * 100).toFixed(2);
	}
	function fmtZeroShot(pct: number): string {
		if (pct === -1) return '⚠️ NA';
		return `${pct.toFixed(0)}%`;
	}
	function fmtParams(b: number): string {
		if (b === 0) return '—';
		return b >= 1 ? b.toFixed(1) : b.toFixed(3);
	}
	function fmtInt(n: number): string {
		if (!n) return '—';
		return n.toLocaleString();
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
</script>

<div class="scroll">
	<table>
		<thead>
			<tr>
				<th class="num sticky-left" aria-sort={ariaSort('rank')}>
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
				<th class="num" aria-sort={ariaSort('zeroShot')}>
					<button class="sort-btn num" onclick={() => clickSort('zeroShot')}>
						<span>Zero-shot</span>
						<span class="ind" class:on={sortKey === 'zeroShot'}>{sortIcon('zeroShot') || '↕'}</span>
					</button>
				</th>
				<th class="num" aria-sort={ariaSort('activeParams')}>
					<button class="sort-btn num" onclick={() => clickSort('activeParams')}>
						<span>Active Params (B)</span>
						<span class="ind" class:on={sortKey === 'activeParams'}
							>{sortIcon('activeParams') || '↕'}</span
						>
					</button>
				</th>
				<th class="num" aria-sort={ariaSort('totalParams')}>
					<button class="sort-btn num" onclick={() => clickSort('totalParams')}>
						<span>Total Params (B)</span>
						<span class="ind" class:on={sortKey === 'totalParams'}
							>{sortIcon('totalParams') || '↕'}</span
						>
					</button>
				</th>
				<th class="num" aria-sort={ariaSort('embeddingDim')}>
					<button class="sort-btn num" onclick={() => clickSort('embeddingDim')}>
						<span>Embedding Dim</span>
						<span class="ind" class:on={sortKey === 'embeddingDim'}
							>{sortIcon('embeddingDim') || '↕'}</span
						>
					</button>
				</th>
				<th class="num" aria-sort={ariaSort('maxTokens')}>
					<button class="sort-btn num" onclick={() => clickSort('maxTokens')}>
						<span>Max Tokens</span>
						<span class="ind" class:on={sortKey === 'maxTokens'}
							>{sortIcon('maxTokens') || '↕'}</span
						>
					</button>
				</th>
				<th class="num" aria-sort={ariaSort('meanTask')}>
					<button class="sort-btn num" onclick={() => clickSort('meanTask')}>
						<span>Mean (Task)</span>
						<span class="ind" class:on={sortKey === 'meanTask'}
							>{sortIcon('meanTask') || '↕'}</span
						>
					</button>
				</th>
				<th class="num" aria-sort={ariaSort('meanTaskType')}>
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
				<tr>
					<td class="num sticky-left">{row.rank}</td>
					<td class="sticky-model">
						{#if row.model.url}
							<a href={row.model.url} target="_blank" rel="noreferrer">{row.model.displayName}</a>
						{:else}
							{row.model.displayName}
						{/if}
					</td>
					<td class="num">{fmtZeroShot(row.zeroShotPct)}</td>
					<td class="num">{fmtParams(row.activeParamsB)}</td>
					<td class="num">{fmtParams(row.totalParamsB)}</td>
					<td class="num">{fmtInt(row.embeddingDim)}</td>
					<td class="num">{fmtInt(row.maxTokens)}</td>
					<td class="num" class:best={row.meanTask === bestMeanTask}>
						{fmtPct(row.meanTask)}
					</td>
					<td class="num" class:best={row.meanTaskType === bestMeanTaskType}>
						{fmtPct(row.meanTaskType)}
					</td>
					{#each summary.taskTypes as tt (tt)}
						<td class="num" class:best={isBestScore(row, tt)}>
							{row.scoresByTaskType[tt] !== undefined ? fmtPct(row.scoresByTaskType[tt]) : ''}
						</td>
					{/each}
				</tr>
			{/each}
		</tbody>
	</table>
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
	th.num,
	td.num {
		text-align: right;
		font-variant-numeric: tabular-nums;
	}
	.sort-btn {
		all: unset;
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
		color: var(--text-subtle);
		opacity: 0.5;
		transition: opacity 0.12s, color 0.12s;
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
		color: var(--primary-strong);
	}
	.sticky-left {
		position: sticky;
		left: 0;
		background: var(--surface);
		z-index: 2;
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
		left: 60px;
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
