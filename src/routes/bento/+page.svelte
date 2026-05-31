<script lang="ts">
	import { leaderboard } from '$lib/stores/leaderboard.svelte';
	import { performanceOverTimePlot } from '$lib/charts/figures';
	import PlotlyChart from '$lib/components/PlotlyChart.svelte';

	$effect(() => {
		if (!leaderboard.benchmark && !leaderboard.loading) {
			leaderboard.select(leaderboard.selected);
		}
	});

	let s = $derived(leaderboard.summary);
	let benchmark = $derived(leaderboard.benchmark);
	let leader = $derived(s?.rows[0] ?? null);
	let openPct = $derived.by(() => {
		if (!s || s.rows.length === 0) return 0;
		return Math.round((s.rows.filter((r) => r.model.openWeights).length / s.rows.length) * 100);
	});
	let nopen = $derived(s?.rows.filter((r) => r.model.openWeights).length ?? 0);

	let newest = $derived.by(() => {
		if (!s) return [];
		return [...s.rows]
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
		if (!s) return [];
		const buckets = new Map<string, { rows: typeof s.rows; best: number }>();
		for (const r of s.rows) {
			const cls = sizeClass(r.totalParamsB);
			const cur = buckets.get(cls) ?? { rows: [], best: -1 };
			cur.rows.push(r);
			if (r.meanTask > cur.best) cur.best = r.meanTask;
			buckets.set(cls, cur);
		}
		const order = ['<500M', '<2B', '<8B', '8B+', 'Closed'];
		return order
			.filter((k) => buckets.has(k))
			.map((k) => {
				const grp = buckets.get(k)!;
				const top = grp.rows.reduce((a, b) => (a.meanTask >= b.meanTask ? a : b));
				return { label: k, top, count: grp.rows.length };
			});
	});

	let timeSpec = $derived(s ? performanceOverTimePlot(s) : null);

	function fmtPct(v: number): string {
		return (v * 100).toFixed(2);
	}
	function fmtParams(b: number): string {
		if (b === 0) return '—';
		return b >= 1 ? `${b.toFixed(1)}B` : `${(b * 1000).toFixed(0)}M`;
	}
</script>

<div class="bento" style="--accent: var(--primary);">
	<header class="top">
		<div class="brand">
			<span class="dot"></span>
			<span class="brand-name">mteb&nbsp;leaderboard</span>
			<span class="tag">Bento</span>
		</div>
		<div class="bench-name">{benchmark?.displayName ?? leaderboard.selected}</div>
	</header>

	{#if !s || !benchmark || !leader}
		<p class="loading">Loading…</p>
	{:else}
		<div class="grid">
			<article class="cell leader">
				<span class="cell-label">Current leader</span>
				<div class="leader-rank">#{leader.rank}</div>
				<h2 class="leader-name">{leader.model.displayName}</h2>
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
						<dd>{leader.embeddingDim || '—'}</dd>
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

			<article class="cell stat sx">
				<span class="cell-label">Languages</span>
				<div class="stat-num">{benchmark.languages.length}</div>
			</article>
			<article class="cell stat sy">
				<span class="cell-label">Tasks</span>
				<div class="stat-num">{benchmark.tasks.length}</div>
			</article>
			<article class="cell stat sz">
				<span class="cell-label">Models</span>
				<div class="stat-num">{s.rows.length}</div>
			</article>
			<article class="cell stat sw">
				<span class="cell-label">Open weights</span>
				<div class="stat-num">{openPct}<span class="suf">%</span></div>
				<div class="stat-foot">{nopen} of {s.rows.length}</div>
			</article>

			<article class="cell chart">
				<span class="cell-label">Pareto frontier — score vs. release date</span>
				{#if timeSpec}
					<PlotlyChart data={timeSpec.data} layout={timeSpec.layout} height={240} />
				{/if}
			</article>

			<article class="cell list newest">
				<span class="cell-label">Newest models</span>
				<ul>
					{#each newest as r (r.model.name)}
						<li>
							<span class="li-date">{r.model.releaseDate}</span>
							<span class="li-name">{r.model.displayName}</span>
							<span class="li-score">{fmtPct(r.meanTask)}</span>
						</li>
					{/each}
				</ul>
			</article>

			<article class="cell list bysize">
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

			<article class="cell quote">
				<span class="cell-label">About</span>
				<p>{benchmark.description}</p>
				{#if benchmark.reference}
					<a href={benchmark.reference} target="_blank" rel="noreferrer">Reference paper →</a>
				{/if}
			</article>
		</div>
	{/if}
</div>

<style>
	.bento {
		min-height: 100vh;
		background: linear-gradient(180deg, #fbfbfc 0%, var(--bg) 320px);
		padding: 64px 28px 56px;
	}
	.top {
		max-width: 1280px;
		margin: 0 auto 18px;
		display: flex;
		align-items: center;
		justify-content: space-between;
		gap: 16px;
	}
	.brand {
		display: inline-flex;
		align-items: center;
		gap: 10px;
	}
	.dot {
		width: 10px;
		height: 10px;
		border-radius: 50%;
		background: var(--primary);
		box-shadow: 0 0 0 4px var(--primary-soft);
	}
	.brand-name {
		font-weight: 700;
		font-size: 14px;
	}
	.tag {
		font-size: 11px;
		font-weight: 600;
		letter-spacing: 0.06em;
		text-transform: uppercase;
		color: var(--primary-strong);
		background: var(--primary-soft);
		padding: 3px 8px;
		border-radius: 999px;
	}
	.bench-name {
		font-size: 14px;
		color: var(--text-muted);
		font-weight: 600;
	}
	.loading {
		max-width: 1280px;
		margin: 0 auto;
		color: var(--text-muted);
	}

	.grid {
		max-width: 1280px;
		margin: 0 auto;
		display: grid;
		grid-template-columns: repeat(6, 1fr);
		grid-auto-rows: 130px;
		gap: 14px;
	}
	@media (max-width: 900px) {
		.grid {
			grid-template-columns: repeat(2, 1fr);
		}
	}
	.cell {
		background: var(--surface);
		border: 1px solid var(--border);
		border-radius: 18px;
		padding: 16px 18px;
		position: relative;
		display: flex;
		flex-direction: column;
		overflow: hidden;
	}
	.cell-label {
		font-size: 10px;
		letter-spacing: 0.05em;
		text-transform: uppercase;
		color: var(--text-subtle);
		font-weight: 600;
		margin-bottom: 8px;
	}

	/* Leader: hero card. Spans 3 cols × 3 rows. */
	.leader {
		grid-column: span 3;
		grid-row: span 3;
		background:
			radial-gradient(120% 80% at 100% 0%, color-mix(in srgb, var(--primary) 16%, transparent), transparent 60%),
			var(--surface);
		border-color: color-mix(in srgb, var(--primary) 30%, var(--border));
	}
	.leader-rank {
		font-size: 14px;
		font-weight: 700;
		color: var(--primary-strong);
		margin-bottom: 4px;
	}
	.leader-name {
		font-size: 26px;
		letter-spacing: -0.015em;
		margin: 0 0 12px;
		font-weight: 800;
	}
	.leader-score {
		display: flex;
		align-items: baseline;
		gap: 10px;
		margin-bottom: 14px;
	}
	.leader-score .num {
		font-size: 48px;
		font-weight: 800;
		font-variant-numeric: tabular-nums;
		letter-spacing: -0.02em;
		color: var(--primary-strong);
	}
	.leader-score .lbl {
		font-size: 12px;
		color: var(--text-muted);
		text-transform: uppercase;
		letter-spacing: 0.06em;
		font-weight: 600;
	}
	.leader-stats {
		display: grid;
		grid-template-columns: repeat(2, 1fr);
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

	/* KPI tiles. Single-cell each. */
	.stat {
		grid-column: span 1;
		grid-row: span 1;
		justify-content: space-between;
	}
	.sx {
		grid-column: span 1;
	}
	.sy {
		grid-column: span 2;
	}
	.sz {
		grid-column: span 1;
	}
	.sw {
		grid-column: span 2;
	}
	.stat-num {
		font-size: 38px;
		font-weight: 800;
		font-variant-numeric: tabular-nums;
		letter-spacing: -0.02em;
	}
	.stat-num .suf {
		font-size: 18px;
		font-weight: 700;
		color: var(--text-muted);
		margin-left: 2px;
	}
	.stat-foot {
		margin-top: 4px;
		font-size: 11px;
		color: var(--text-subtle);
		font-weight: 500;
	}

	/* Chart card: 4 cols × 2 rows. */
	.chart {
		grid-column: span 4;
		grid-row: span 2;
		padding-bottom: 8px;
	}

	/* Lists: 2 cols × 2 rows each. */
	.list {
		grid-column: span 2;
		grid-row: span 2;
	}
	.list ul {
		list-style: none;
		padding: 0;
		margin: 0;
		display: flex;
		flex-direction: column;
		gap: 8px;
		overflow: hidden;
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
		width: 75px;
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

	/* Quote / about card. 3 cols × 2 rows. */
	.quote {
		grid-column: span 3;
		grid-row: span 2;
	}
	.quote p {
		font-size: 14px;
		color: var(--text);
		line-height: 1.55;
		margin: 0 0 12px;
		overflow: hidden;
		display: -webkit-box;
		-webkit-line-clamp: 4;
		line-clamp: 4;
		-webkit-box-orient: vertical;
	}
	.quote a {
		font-size: 13px;
		font-weight: 600;
		margin-top: auto;
		color: var(--primary-strong);
	}
</style>
