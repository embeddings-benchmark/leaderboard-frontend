<script lang="ts">
	import type { BenchmarkSummary, SummaryRow } from '$lib/types';
	import { performanceOverTimePlot } from '$lib/charts/figures';
	import PlotlyChart from './PlotlyChart.svelte';

	interface Props {
		summary: BenchmarkSummary;
	}
	let { summary }: Props = $props();

	let leader = $derived<SummaryRow | null>(summary.rows[0] ?? null);

	let newest = $derived.by(() => {
		return [...summary.rows]
			.filter((r) => r.model.releaseDate)
			.sort((a, b) =>
				(b.model.releaseDate ?? '').localeCompare(a.model.releaseDate ?? '')
			)
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
				const top = grp.reduce((a, b) => (a.meanTask >= b.meanTask ? a : b));
				return { label: k, top, count: grp.length };
			});
	});

	let timeSpec = $derived(performanceOverTimePlot(summary));

	function fmtPct(v: number): string {
		return (v * 100).toFixed(2);
	}
	function fmtParams(b: number): string {
		if (b === 0) return '—';
		return b >= 1 ? `${b.toFixed(1)} B` : `${(b * 1000).toFixed(0)} M`;
	}
</script>

<div class="overview">
	{#if !leader}
		<p class="muted">No models match the current filters.</p>
	{:else}
		<article class="cell leader" data-model-type={leader.model.modelType}>
			<span class="cell-label">Current leader</span>
			<div class="leader-rank">#{leader.rank}</div>
			<h3 class="leader-name">
				<span class="leader-org">{leader.model.org}</span><span class="leader-sep">/</span>{leader
					.model.displayName}
			</h3>
			<div class="leader-score">
				<span class="num">{fmtPct(leader.meanTask)}</span>
				<span class="lbl">Mean(Task)</span>
			</div>
			<dl class="leader-stats">
				<div>
					<dt>Params</dt>
					<dd>{fmtParams(leader.totalParamsB)}</dd>
				</div>
				<div>
					<dt>Embedding dim</dt>
					<dd>{leader.embeddingDim ? leader.embeddingDim.toLocaleString() : '—'}</dd>
				</div>
				<div>
					<dt>Max tokens</dt>
					<dd>{leader.maxTokens.toLocaleString()}</dd>
				</div>
				<div>
					<dt>Released</dt>
					<dd>{leader.model.releaseDate ?? '—'}</dd>
				</div>
			</dl>
			{#if leader.model.url}
				<a class="leader-link" href={leader.model.url} target="_blank" rel="noreferrer">
					Model page →
				</a>
			{/if}
		</article>

		<article class="cell chart">
			<span class="cell-label">Pareto frontier — score vs. release date</span>
			<PlotlyChart data={timeSpec.data} layout={timeSpec.layout} height={300} />
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
	{/if}
</div>

<style>
	.overview {
		display: grid;
		grid-template-columns: minmax(0, 1.1fr) minmax(0, 1fr);
		gap: 14px;
		padding-top: 4px;
	}
	@media (max-width: 900px) {
		.overview {
			grid-template-columns: 1fr;
		}
	}
	.cell {
		background: var(--surface);
		border: 1px solid var(--border);
		border-radius: 14px;
		padding: 16px 18px;
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
	.muted {
		color: var(--text-muted);
		margin: 0;
		font-size: 13px;
	}

	/* Leader cell — large hero card, color-keyed by the model type. */
	.leader {
		background:
			radial-gradient(120% 80% at 100% 0%, color-mix(in srgb, var(--primary) 14%, transparent), transparent 55%),
			var(--surface);
		border-color: color-mix(in srgb, var(--primary) 25%, var(--border));
	}
	.leader[data-model-type='dense'] {
		border-color: color-mix(in srgb, #2740b8 35%, var(--border));
	}
	.leader[data-model-type='cross-encoder'] {
		border-color: color-mix(in srgb, #c0432e 35%, var(--border));
	}
	.leader[data-model-type='late-interaction'] {
		border-color: color-mix(in srgb, #1c7a4c 35%, var(--border));
	}
	.leader[data-model-type='sparse'] {
		border-color: color-mix(in srgb, #a36100 35%, var(--border));
	}
	.leader[data-model-type='router'] {
		border-color: color-mix(in srgb, #6a32b1 35%, var(--border));
	}
	.leader-rank {
		font-size: 12px;
		font-weight: 700;
		color: var(--primary-strong);
		margin-bottom: 4px;
	}
	.leader-name {
		font-size: 22px;
		letter-spacing: -0.015em;
		margin: 0 0 14px;
		font-weight: 700;
		word-break: break-word;
	}
	.leader-org {
		color: var(--text-subtle);
		font-weight: 400;
	}
	.leader-sep {
		color: var(--border-strong);
		margin: 0 1px;
		font-weight: 400;
	}
	.leader-score {
		display: flex;
		align-items: baseline;
		gap: 10px;
		margin-bottom: 14px;
	}
	.leader-score .num {
		font-size: 40px;
		font-weight: 800;
		font-variant-numeric: tabular-nums;
		letter-spacing: -0.02em;
		color: var(--primary-strong);
	}
	.leader-score .lbl {
		font-size: 11px;
		color: var(--text-muted);
		text-transform: uppercase;
		letter-spacing: 0.06em;
		font-weight: 600;
	}
	.leader-stats {
		display: grid;
		grid-template-columns: repeat(2, minmax(0, 1fr));
		gap: 10px 18px;
		margin: 0 0 14px;
	}
	.leader-stats > div {
		display: flex;
		flex-direction: column;
		gap: 1px;
	}
	.leader-stats dt {
		font-size: 10px;
		letter-spacing: 0.04em;
		text-transform: uppercase;
		color: var(--text-subtle);
		font-weight: 600;
	}
	.leader-stats dd {
		margin: 0;
		font-size: 14px;
		font-weight: 700;
		font-variant-numeric: tabular-nums;
	}
	.leader-link {
		margin-top: auto;
		font-size: 13px;
		font-weight: 600;
		color: var(--primary-strong);
	}

	/* Pareto chart cell takes the right column on the first row. */
	.chart {
		padding-bottom: 8px;
	}

	/* List cells (Newest / By size) take the second row. */
	.list ul {
		list-style: none;
		padding: 0;
		margin: 0;
		display: flex;
		flex-direction: column;
		gap: 8px;
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
</style>
