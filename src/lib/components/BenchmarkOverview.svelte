<script lang="ts">
	import type { BenchmarkSummary, SummaryRow } from '$lib/types';
	import { performanceOverTimePlot } from '$lib/charts/figures';
	import { fmtPct } from '$lib/format';
	import PlotlyChart from './PlotlyChart.svelte';

	interface Props {
		summary: BenchmarkSummary;
	}
	let { summary }: Props = $props();

	let hasAnyRows = $derived(summary.rows.length > 0);

	// Top model per task type — score from summary.scoresByTaskType.
	let bestPerType = $derived.by(() => {
		return summary.taskTypes.map((tt) => {
			let top: SummaryRow | null = null;
			let best = -Infinity;
			for (const r of summary.rows) {
				const v = r.scoresByTaskType[tt];
				if (v !== undefined && v > best) {
					best = v;
					top = r;
				}
			}
			return { taskType: tt, top, score: top ? best : null };
		});
	});

	let newest = $derived.by(() => {
		return [...summary.rows]
			.filter((r) => r.model.releaseDate)
			.sort((a, b) => (b.model.releaseDate ?? '').localeCompare(a.model.releaseDate ?? ''))
			.slice(0, 5);
	});

	function sizeClass(b: number): string {
		if (b === 0) return 'Closed';
		if (b < 0.5) return '<500M';
		if (b < 2) return '<2B';
		if (b < 8) return '<8B';
		return '8B+';
	}
	let bySizeClass = $derived.by(() => {
		// Local bucket in a pure derived — plain Map is correct.
		// eslint-disable-next-line svelte/prefer-svelte-reactivity
		const buckets = new Map<string, SummaryRow[]>();
		for (const r of summary.rows) {
			const cls = sizeClass(r.totalParamsB);
			(buckets.get(cls) ?? buckets.set(cls, []).get(cls)!).push(r);
		}
		const order = ['<500M', '<2B', '<8B', '8B+', 'Closed'];
		return order
			.filter((k) => buckets.has(k))
			.map((k) => {
				const grp = buckets.get(k)!;
				const top = grp.reduce((a, b) =>
					(a.meanTask ?? -Infinity) >= (b.meanTask ?? -Infinity) ? a : b
				);
				return { label: k, top, count: grp.length };
			});
	});

	let timeSpec = $derived(performanceOverTimePlot(summary));
</script>

<div class="overview">
	{#if !hasAnyRows}
		<p class="muted">No models match the current filters.</p>
	{:else}
		<div class="grid">
			<article class="cell chart">
				<span class="cell-label">Pareto frontier — score vs. release date</span>
				<PlotlyChart data={timeSpec.data} layout={timeSpec.layout} height={260} />
			</article>

			<article class="cell list">
				<span class="cell-label">Newest models</span>
				<ul>
					{#each newest as r (r.model.name)}
						<li>
							<span class="li-date">{r.model.releaseDate}</span>
							<span class="li-name">{r.model.displayName}</span>
							<span class="li-score">{fmtPct(r.meanTask)}</span>
						</li>
					{/each}
					{#if newest.length === 0}
						<p class="muted">No release dates on these models.</p>
					{/if}
				</ul>
			</article>

			<article class="cell list">
				<span class="cell-label">Best by size class</span>
				<ul>
					{#each bySizeClass as b (b.label)}
						<li>
							<span class="li-tag">{b.label}</span>
							<span class="li-name">{b.top.model.displayName}</span>
							<span class="li-score">{fmtPct(b.top.meanTask)}</span>
						</li>
					{/each}
				</ul>
			</article>
		</div>

		{#if bestPerType.length > 0}
			<article class="cell type-card">
				<span class="cell-label">Best per task type</span>
				<div class="type-grid">
					{#each bestPerType as b (b.taskType)}
						{#if b.top && b.score !== null}
							<div class="type-row" data-model-type={b.top.model.modelType}>
								<span class="type-name">{b.taskType}</span>
								<span class="type-model" title="{b.top.model.org}/{b.top.model.displayName}">
									{b.top.model.displayName}
								</span>
								<span class="type-score">{(b.score * 100).toFixed(2)}</span>
							</div>
						{/if}
					{/each}
				</div>
			</article>
		{/if}
	{/if}
</div>

<style>
	.overview {
		display: flex;
		flex-direction: column;
		gap: 14px;
		padding-top: 4px;
	}
	/* Base `.muted` (color + margin: 0) lives in src/app.css. */
	.muted {
		font-size: 13px;
	}

	/* Pareto chart + side lists */
	.grid {
		display: grid;
		grid-template-columns: minmax(0, 1.4fr) minmax(0, 1fr);
		grid-template-rows: auto auto;
		gap: 12px;
	}
	@media (max-width: 900px) {
		.grid {
			grid-template-columns: 1fr;
		}
	}
	.cell {
		background: var(--surface);
		border: 1px solid var(--border);
		border-radius: 12px;
		padding: 14px 16px;
		display: flex;
		flex-direction: column;
		min-width: 0;
	}
	.cell-label {
		font-size: 10px;
		letter-spacing: 0.05em;
		text-transform: uppercase;
		color: var(--text-subtle);
		font-weight: 600;
		margin-bottom: 8px;
	}
	/* The Pareto chart fills the left column across both rows. */
	.chart {
		grid-column: 1;
		grid-row: 1 / span 2;
		padding-bottom: 6px;
	}

	.list ul {
		list-style: none;
		padding: 0;
		margin: 0;
		display: flex;
		flex-direction: column;
		gap: 6px;
	}
	.list li {
		display: flex;
		align-items: center;
		gap: 10px;
		font-size: 12.5px;
	}
	.list .li-date {
		color: var(--text-subtle);
		font-variant-numeric: tabular-nums;
		font-size: 11px;
		width: 78px;
		flex-shrink: 0;
	}
	.list .li-tag {
		background: var(--surface-muted);
		border: 1px solid var(--border);
		padding: 1px 8px;
		border-radius: 999px;
		font-size: 10px;
		letter-spacing: 0.04em;
		text-transform: uppercase;
		font-weight: 700;
		color: var(--text-muted);
		width: 64px;
		text-align: center;
		flex-shrink: 0;
	}
	.list .li-name {
		flex: 1;
		font-weight: 600;
		overflow: hidden;
		text-overflow: ellipsis;
		white-space: nowrap;
	}
	.list .li-score {
		font-variant-numeric: tabular-nums;
		font-weight: 700;
		color: var(--primary-strong);
	}

	/* Best per task type — grid of compact rows below the main 2-col area. */
	.type-grid {
		display: grid;
		grid-template-columns: repeat(auto-fit, minmax(220px, 1fr));
		gap: 6px 12px;
	}
	.type-row {
		--c: var(--primary);
		display: grid;
		grid-template-columns: 1fr auto;
		grid-template-rows: auto auto;
		column-gap: 12px;
		align-items: baseline;
		padding: 6px 10px;
		border-left: 3px solid var(--c);
		background: color-mix(in srgb, var(--c) 5%, var(--surface));
		border-radius: 4px;
	}
	.type-row[data-model-type='dense'] {
		--c: var(--tint-blue-fg);
	}
	.type-row[data-model-type='cross-encoder'] {
		--c: var(--tint-orange-fg);
	}
	.type-row[data-model-type='late-interaction'] {
		--c: var(--tint-green-fg);
	}
	.type-row[data-model-type='sparse'] {
		--c: var(--tint-amber-fg);
	}
	.type-row[data-model-type='router'] {
		--c: var(--tint-purple-fg);
	}
	.type-name {
		font-size: 10px;
		letter-spacing: 0.04em;
		text-transform: uppercase;
		color: var(--c);
		font-weight: 700;
		grid-row: 1;
	}
	.type-score {
		font-size: 16px;
		font-weight: 800;
		font-variant-numeric: tabular-nums;
		color: var(--c);
		grid-row: 1 / span 2;
		grid-column: 2;
		align-self: center;
	}
	.type-model {
		font-size: 12.5px;
		color: var(--text);
		font-weight: 600;
		overflow: hidden;
		text-overflow: ellipsis;
		white-space: nowrap;
		grid-row: 2;
	}
</style>
