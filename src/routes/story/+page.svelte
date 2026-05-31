<script lang="ts">
	import { base } from '$app/paths';
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

	let openTop = $derived.by(() =>
		s ? s.rows.filter((r) => r.model.openWeights).slice(0, 5) : []
	);
	let closedTop = $derived.by(() =>
		s ? s.rows.filter((r) => !r.model.openWeights).slice(0, 5) : []
	);
	let newest = $derived.by(() => {
		if (!s) return [];
		return [...s.rows]
			.filter((r) => r.model.releaseDate)
			.sort((a, b) => (b.model.releaseDate ?? '').localeCompare(a.model.releaseDate ?? ''))
			.slice(0, 6);
	});

	function sizeClass(b: number): string {
		if (b === 0) return 'Closed-source';
		if (b < 0.5) return 'Under 500M';
		if (b < 2) return 'Under 2B';
		if (b < 8) return 'Under 8B';
		return '8B and up';
	}
	let bySize = $derived.by(() => {
		if (!s) return [];
		const buckets = new Map<string, { rows: typeof s.rows }>();
		for (const r of s.rows) {
			const cls = sizeClass(r.totalParamsB);
			const cur = buckets.get(cls) ?? { rows: [] };
			cur.rows.push(r);
			buckets.set(cls, cur);
		}
		const order = ['Under 500M', 'Under 2B', 'Under 8B', '8B and up', 'Closed-source'];
		return order
			.filter((k) => buckets.has(k))
			.map((k) => {
				const grp = buckets.get(k)!;
				const top = grp.rows.reduce((a, b) => (a.meanTask >= b.meanTask ? a : b));
				return { label: k, top, count: grp.rows.length };
			});
	});

	let timeSpec = $derived(s ? performanceOverTimePlot(s) : null);

	let sections = [
		{ id: 'lede', label: 'The lede' },
		{ id: 'leader', label: 'The leader' },
		{ id: 'open-vs-closed', label: 'Open vs closed' },
		{ id: 'by-size', label: 'By size class' },
		{ id: 'fresh', label: 'Newest models' },
		{ id: 'further', label: 'Read on' }
	];

	function fmtPct(v: number): string {
		return (v * 100).toFixed(2);
	}
	function fmtParams(b: number): string {
		if (b === 0) return 'closed-source';
		return b >= 1 ? `${b.toFixed(1)}B parameters` : `${(b * 1000).toFixed(0)}M parameters`;
	}
</script>

<div class="story">
	<aside class="toc" aria-label="Sections">
		<ul>
			{#each sections as sec (sec.id)}
				<li><a href={`#${sec.id}`}>{sec.label}</a></li>
			{/each}
		</ul>
	</aside>

	{#if !s || !benchmark || !leader}
		<p class="loading">Loading…</p>
	{:else}
		<article class="prose">
			<header class="masthead">
				<span class="kicker">A field guide to</span>
				<h1>{benchmark.displayName}</h1>
				<p class="dek">{benchmark.description}</p>
			</header>

			<section id="lede" class="section">
				<h2>The lede</h2>
				<p class="big">
					Across <strong>{benchmark.tasks.length}</strong> tasks in
					<strong>{benchmark.languages.length}</strong> languages, one model is
					out in front: <strong>{leader.model.displayName}</strong>, scoring
					<strong>{fmtPct(leader.meanTask)}</strong> on the mean-of-tasks measure.
				</p>
				<div class="callout">
					<div class="callout-stat">
						<span class="lbl">Mean(Task)</span>
						<span class="val">{fmtPct(leader.meanTask)}</span>
					</div>
					<div class="callout-stat">
						<span class="lbl">Models compared</span>
						<span class="val">{s.rows.length}</span>
					</div>
					<div class="callout-stat">
						<span class="lbl">Task types</span>
						<span class="val">{s.taskTypes.length}</span>
					</div>
				</div>
			</section>

			<section id="leader" class="section">
				<h2>The leader, in detail</h2>
				<p>
					<strong>{leader.model.displayName}</strong>
					{#if leader.model.openWeights}is an <em>open-weight</em> model{:else}is a <em>proprietary</em> system{/if}
					with {fmtParams(leader.totalParamsB)}{#if leader.model.releaseDate}, released
						{leader.model.releaseDate}{/if}. It uses {leader.embeddingDim
						? `${leader.embeddingDim.toLocaleString()}-dimensional embeddings`
						: 'an unspecified embedding dimension'}
					and supports up to
					<strong>{leader.maxTokens.toLocaleString()}</strong> tokens of context.
				</p>
				{#if leader.model.url}
					<p>
						<a class="cta" href={leader.model.url} target="_blank" rel="noreferrer">
							Read the model card →
						</a>
					</p>
				{/if}
			</section>

			<section id="open-vs-closed" class="section">
				<h2>Open weights vs. closed</h2>
				<p>
					Of the {s.rows.length} models on this benchmark,
					<strong>{openTop.length > 0 ? s.rows.filter((r) => r.model.openWeights).length : 0}</strong>
					ship their weights and
					<strong>{s.rows.filter((r) => !r.model.openWeights).length}</strong>
					are proprietary APIs. The leaders in each camp:
				</p>
				<div class="split">
					<div class="split-col">
						<h3>Open</h3>
						<ol>
							{#each openTop as r (r.model.name)}
								<li>
									<span class="rank">#{r.rank}</span>
									<span class="name">{r.model.displayName}</span>
									<span class="score">{fmtPct(r.meanTask)}</span>
								</li>
							{/each}
						</ol>
					</div>
					<div class="split-col">
						<h3>Proprietary</h3>
						<ol>
							{#each closedTop as r (r.model.name)}
								<li>
									<span class="rank">#{r.rank}</span>
									<span class="name">{r.model.displayName}</span>
									<span class="score">{fmtPct(r.meanTask)}</span>
								</li>
							{/each}
						</ol>
					</div>
				</div>
			</section>

			<section id="by-size" class="section">
				<h2>Best in class, by size</h2>
				<p>
					If you're shopping for a model that fits in a specific compute budget,
					here's the top scorer in each size bracket. A few hundred million
					parameters can still go a long way.
				</p>
				<div class="size-list">
					{#each bySize as b (b.label)}
						<div class="size-row">
							<div class="size-tag">{b.label}</div>
							<div class="size-info">
								<div class="size-name">{b.top.model.displayName}</div>
								<div class="size-meta">
									{b.count} model{b.count === 1 ? '' : 's'} in this bracket
								</div>
							</div>
							<div class="size-score">{fmtPct(b.top.meanTask)}</div>
						</div>
					{/each}
				</div>
			</section>

			<section id="fresh" class="section">
				<h2>The newest arrivals</h2>
				<p>
					Embedding models keep moving. These are the six most recently released
					entries, plus the Pareto frontier of score over time so you can see how
					quickly the ceiling is rising.
				</p>
				{#if timeSpec}
					<div class="chart-wrap">
						<PlotlyChart data={timeSpec.data} layout={timeSpec.layout} height={320} />
					</div>
				{/if}
				<ul class="newest">
					{#each newest as r (r.model.name)}
						<li>
							<span class="newest-date">{r.model.releaseDate}</span>
							<span class="newest-name">{r.model.displayName}</span>
							<span class="newest-score">{fmtPct(r.meanTask)}</span>
						</li>
					{/each}
				</ul>
			</section>

			<section id="further" class="section">
				<h2>Read on</h2>
				<p>
					Want to dig deeper, slice by language, or compare two specific models?
					Jump into one of the other views.
				</p>
				<div class="more-grid">
					<a class="more-card" href="{base}/">
						<span class="more-tag">Classic</span>
						<span class="more-title">The full leaderboard table</span>
						<span class="more-desc">Sortable, filterable, the works.</span>
					</a>
					<a class="more-card" href="{base}/explorer">
						<span class="more-tag">Explorer</span>
						<span class="more-title">Browse benchmarks, models, tasks</span>
						<span class="more-desc">One card per artifact, deeply linked.</span>
					</a>
					<a class="more-card" href="{base}/spreadsheet">
						<span class="more-tag">Sheet</span>
						<span class="more-title">Spreadsheet view</span>
						<span class="more-desc">
							Pin rows, color-coded scores, density toggle.
						</span>
					</a>
					<a class="more-card" href="{base}/bento">
						<span class="more-tag">Bento</span>
						<span class="more-title">At-a-glance bento</span>
						<span class="more-desc">KPIs, leader, recent activity in one frame.</span>
					</a>
				</div>
			</section>
		</article>
	{/if}
</div>

<style>
	.story {
		min-height: 100vh;
		background: #fcfbf8;
		display: grid;
		grid-template-columns: 220px minmax(0, 1fr);
		gap: 0;
	}
	@media (max-width: 900px) {
		.story {
			grid-template-columns: 1fr;
		}
		.toc {
			display: none;
		}
	}

	.toc {
		position: sticky;
		top: 0;
		align-self: start;
		padding: 80px 24px 24px;
		max-height: 100vh;
		overflow-y: auto;
	}
	.toc ul {
		list-style: none;
		padding: 0;
		margin: 0;
		display: flex;
		flex-direction: column;
		gap: 6px;
		border-left: 1px solid var(--border);
	}
	.toc a {
		display: block;
		padding: 4px 12px;
		font-size: 12px;
		color: var(--text-muted);
		text-decoration: none;
		font-weight: 500;
		transition:
			color 0.12s,
			border-color 0.12s;
		border-left: 2px solid transparent;
		margin-left: -1px;
	}
	.toc a:hover {
		color: var(--text);
		border-left-color: var(--primary);
	}

	.loading {
		padding: 80px 28px;
		color: var(--text-muted);
	}

	.prose {
		max-width: 740px;
		padding: 80px 28px 96px;
		font-family: 'Iowan Old Style', 'Georgia', 'Times New Roman', serif;
		color: #2c2a26;
		font-size: 18px;
		line-height: 1.7;
	}
	.masthead {
		border-bottom: 1px solid #e7e2d6;
		padding-bottom: 28px;
		margin-bottom: 36px;
	}
	.kicker {
		display: inline-block;
		font-family: var(--font-sans);
		font-size: 11px;
		letter-spacing: 0.1em;
		text-transform: uppercase;
		color: var(--primary-strong);
		font-weight: 700;
		margin-bottom: 16px;
	}
	.masthead h1 {
		font-family: 'Iowan Old Style', 'Georgia', 'Times New Roman', serif;
		font-size: 48px;
		line-height: 1.1;
		letter-spacing: -0.02em;
		margin: 0 0 14px;
		font-weight: 700;
		color: #1a1916;
	}
	.dek {
		font-size: 20px;
		color: #57534a;
		font-style: italic;
		margin: 0;
	}

	.section {
		margin: 56px 0;
		scroll-margin-top: 24px;
	}
	.section h2 {
		font-family: 'Iowan Old Style', 'Georgia', serif;
		font-size: 30px;
		letter-spacing: -0.01em;
		margin: 0 0 16px;
		color: #1a1916;
		font-weight: 700;
	}
	.section p {
		margin: 0 0 18px;
	}
	.section p.big {
		font-size: 22px;
		line-height: 1.55;
		color: #2c2a26;
	}
	.section strong {
		color: var(--primary-strong);
		font-weight: 700;
	}

	.callout {
		display: grid;
		grid-template-columns: repeat(3, 1fr);
		gap: 14px;
		margin: 24px 0;
		padding: 22px 18px;
		background: #fff8f1;
		border: 1px solid #f1dcc4;
		border-radius: 12px;
	}
	.callout-stat {
		display: flex;
		flex-direction: column;
		gap: 2px;
		align-items: center;
		font-family: var(--font-sans);
	}
	.callout-stat .lbl {
		font-size: 10px;
		letter-spacing: 0.06em;
		text-transform: uppercase;
		color: var(--text-subtle);
		font-weight: 700;
	}
	.callout-stat .val {
		font-size: 28px;
		font-weight: 800;
		font-variant-numeric: tabular-nums;
		color: var(--primary-strong);
		letter-spacing: -0.01em;
	}

	.cta {
		display: inline-block;
		font-family: var(--font-sans);
		font-size: 14px;
		font-weight: 700;
		color: var(--primary-strong);
		text-decoration: none;
		border-bottom: 1px solid var(--primary-soft);
		padding-bottom: 2px;
	}
	.cta:hover {
		border-bottom-color: var(--primary);
	}

	.split {
		display: grid;
		grid-template-columns: repeat(2, 1fr);
		gap: 24px;
		margin: 18px 0;
	}
	@media (max-width: 600px) {
		.split {
			grid-template-columns: 1fr;
		}
	}
	.split-col h3 {
		font-family: var(--font-sans);
		font-size: 11px;
		letter-spacing: 0.08em;
		text-transform: uppercase;
		color: var(--text-subtle);
		font-weight: 700;
		margin: 0 0 10px;
	}
	.split-col ol {
		list-style: none;
		padding: 0;
		margin: 0;
		display: flex;
		flex-direction: column;
		gap: 8px;
		font-family: var(--font-sans);
		font-size: 14px;
	}
	.split-col li {
		display: grid;
		grid-template-columns: 40px 1fr auto;
		align-items: center;
		gap: 8px;
	}
	.split-col .rank {
		color: var(--text-subtle);
		font-weight: 700;
		font-variant-numeric: tabular-nums;
	}
	.split-col .name {
		overflow: hidden;
		text-overflow: ellipsis;
		white-space: nowrap;
	}
	.split-col .score {
		font-variant-numeric: tabular-nums;
		font-weight: 700;
		color: var(--primary-strong);
	}

	.size-list {
		display: flex;
		flex-direction: column;
		gap: 10px;
		margin: 18px 0;
		font-family: var(--font-sans);
	}
	.size-row {
		display: grid;
		grid-template-columns: 130px 1fr auto;
		align-items: center;
		gap: 14px;
		padding: 12px 16px;
		background: #fff;
		border: 1px solid var(--border);
		border-radius: 10px;
	}
	.size-tag {
		font-size: 11px;
		letter-spacing: 0.04em;
		text-transform: uppercase;
		color: var(--text-muted);
		font-weight: 700;
	}
	.size-name {
		font-size: 14px;
		font-weight: 700;
		color: var(--text);
	}
	.size-meta {
		font-size: 11px;
		color: var(--text-subtle);
	}
	.size-score {
		font-size: 22px;
		font-weight: 800;
		font-variant-numeric: tabular-nums;
		color: var(--primary-strong);
		letter-spacing: -0.01em;
	}

	.chart-wrap {
		margin: 20px 0;
		background: #fff;
		border: 1px solid var(--border);
		border-radius: 10px;
		padding: 8px;
	}
	.newest {
		list-style: none;
		padding: 0;
		margin: 18px 0;
		display: flex;
		flex-direction: column;
		gap: 6px;
		font-family: var(--font-sans);
		font-size: 14px;
	}
	.newest li {
		display: grid;
		grid-template-columns: 90px 1fr auto;
		gap: 12px;
		padding: 8px 0;
		border-bottom: 1px dotted #e7e2d6;
	}
	.newest .newest-date {
		color: var(--text-subtle);
		font-variant-numeric: tabular-nums;
	}
	.newest .newest-name {
		font-weight: 600;
	}
	.newest .newest-score {
		font-variant-numeric: tabular-nums;
		font-weight: 700;
		color: var(--primary-strong);
	}

	.more-grid {
		display: grid;
		grid-template-columns: repeat(2, 1fr);
		gap: 12px;
		margin-top: 18px;
		font-family: var(--font-sans);
	}
	@media (max-width: 600px) {
		.more-grid {
			grid-template-columns: 1fr;
		}
	}
	.more-card {
		display: flex;
		flex-direction: column;
		gap: 6px;
		padding: 16px;
		background: #fff;
		border: 1px solid var(--border);
		border-radius: 12px;
		text-decoration: none;
		color: var(--text);
		transition:
			border-color 0.12s,
			box-shadow 0.12s;
	}
	.more-card:hover {
		border-color: var(--primary);
		box-shadow: 0 6px 16px rgba(232, 90, 42, 0.08);
	}
	.more-tag {
		font-size: 10px;
		letter-spacing: 0.06em;
		text-transform: uppercase;
		color: var(--primary-strong);
		font-weight: 700;
	}
	.more-title {
		font-size: 15px;
		font-weight: 700;
	}
	.more-desc {
		font-size: 12.5px;
		color: var(--text-muted);
		font-weight: 500;
	}
</style>
