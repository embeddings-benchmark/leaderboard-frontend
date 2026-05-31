<script lang="ts">
	import { base } from '$app/paths';
	import { BENCHMARK_INDEX, BENCHMARK_MENU } from '$lib/data/mockBenchmarks';
	import { buildMockSummary } from '$lib/data/mockSummary';
	import { isBenchmark, type Benchmark, type MenuEntry } from '$lib/types';

	interface FlatEntry {
		categoryPath: string[];
		benchmark: Benchmark;
	}

	function flatten(entry: MenuEntry, path: string[] = []): FlatEntry[] {
		const here = [...path, entry.name];
		const result: FlatEntry[] = [];
		for (const child of entry.children) {
			if (isBenchmark(child)) {
				result.push({ categoryPath: here, benchmark: child });
			} else {
				result.push(...flatten(child, here));
			}
		}
		return result;
	}

	const categories = BENCHMARK_MENU.map((cat) => ({
		name: cat.name,
		entries: flatten(cat).filter((e) => e.benchmark.name in BENCHMARK_INDEX)
	}));

	function topModel(name: string): string {
		const s = buildMockSummary(name);
		return s.rows[0]?.model.displayName ?? '—';
	}

	function slug(name: string): string {
		return encodeURIComponent(name);
	}
</script>

<div class="explorer">
	<header class="hero">
		<h1>Pick a benchmark to explore.</h1>
		<p class="lead">
			Browse 35+ benchmarks across text and image embedding tasks. Tap any card to drill into its
			leaderboard, filters, and per-task breakdown.
		</p>
	</header>

	{#each categories as cat (cat.name)}
		<section class="category">
			<div class="cat-head">
				<h2>{cat.name}</h2>
				<span class="count">{cat.entries.length} benchmark{cat.entries.length === 1 ? '' : 's'}</span>
			</div>
			<div class="grid">
				{#each cat.entries as { categoryPath, benchmark } (benchmark.name)}
					<a class="card" href="{base}/explorer/{slug(benchmark.name)}">
						<div class="card-top">
							<span class="crumbs">
								{#each categoryPath.slice(1) as c, i (i)}
									<span>{c}</span>
								{/each}
							</span>
							<span class="card-name">{benchmark.displayName}</span>
						</div>
						<p class="card-desc">{benchmark.description}</p>
						<dl class="stats">
							<div>
								<dt>Languages</dt>
								<dd>{benchmark.languages.length}</dd>
							</div>
							<div>
								<dt>Tasks</dt>
								<dd>{benchmark.tasks.length}</dd>
							</div>
							<div>
								<dt>Task types</dt>
								<dd>{benchmark.taskTypes.length}</dd>
							</div>
						</dl>
						<div class="leader">
							<span class="leader-label">Leader</span>
							<span class="leader-name">{topModel(benchmark.name)}</span>
						</div>
						<span class="cta">Open leaderboard →</span>
					</a>
				{/each}
			</div>
		</section>
	{/each}
</div>

<style>
	.explorer {
		max-width: 1280px;
		margin: 0 auto;
		padding: 28px 28px 64px;
	}
	.hero {
		padding: 40px 0 28px;
	}
	h1 {
		font-size: 40px;
		font-weight: 700;
		letter-spacing: -0.02em;
		margin: 0 0 14px;
		max-width: 18ch;
	}
	.lead {
		max-width: 60ch;
		font-size: 16px;
		color: var(--text-muted);
		margin: 0;
	}

	.category {
		padding: 24px 0;
	}
	.cat-head {
		display: flex;
		align-items: baseline;
		gap: 14px;
		margin-bottom: 14px;
		border-bottom: 1px solid var(--border);
		padding-bottom: 8px;
	}
	.cat-head h2 {
		font-size: 18px;
		font-weight: 700;
		margin: 0;
	}
	.count {
		font-size: 12px;
		color: var(--text-subtle);
	}

	.grid {
		display: grid;
		grid-template-columns: repeat(auto-fill, minmax(280px, 1fr));
		gap: 14px;
	}

	.card {
		background: var(--surface);
		border: 1px solid var(--border);
		border-radius: 14px;
		padding: 16px 18px;
		display: flex;
		flex-direction: column;
		gap: 10px;
		text-decoration: none;
		color: var(--text);
		transition:
			transform 0.12s ease,
			border-color 0.12s ease,
			box-shadow 0.12s ease;
		position: relative;
	}
	.card:hover {
		border-color: var(--primary);
		transform: translateY(-1px);
		box-shadow: 0 10px 24px rgba(15, 23, 42, 0.06);
	}
	.card-top {
		display: flex;
		flex-direction: column;
		gap: 4px;
	}
	.crumbs {
		display: flex;
		gap: 6px;
		font-size: 11px;
		color: var(--text-subtle);
		text-transform: uppercase;
		letter-spacing: 0.05em;
	}
	.crumbs span + span::before {
		content: '/';
		margin-right: 6px;
		color: var(--border-strong);
	}
	.card-name {
		font-size: 15px;
		font-weight: 700;
		letter-spacing: -0.005em;
	}
	.card-desc {
		font-size: 13px;
		color: var(--text-muted);
		margin: 0;
		overflow: hidden;
		display: -webkit-box;
		-webkit-line-clamp: 2;
		line-clamp: 2;
		-webkit-box-orient: vertical;
	}
	.stats {
		display: grid;
		grid-template-columns: repeat(3, 1fr);
		gap: 8px;
		margin: 4px 0 0;
	}
	.stats > div {
		display: flex;
		flex-direction: column;
		gap: 1px;
	}
	.stats dt {
		font-size: 10px;
		letter-spacing: 0.04em;
		text-transform: uppercase;
		color: var(--text-subtle);
		font-weight: 600;
	}
	.stats dd {
		margin: 0;
		font-size: 14px;
		font-weight: 700;
		font-variant-numeric: tabular-nums;
	}
	.leader {
		display: flex;
		align-items: center;
		justify-content: space-between;
		padding: 8px 10px;
		background: var(--surface-muted);
		border-radius: 8px;
		font-size: 12px;
	}
	.leader-label {
		color: var(--text-subtle);
		text-transform: uppercase;
		letter-spacing: 0.05em;
		font-weight: 600;
		font-size: 10px;
	}
	.leader-name {
		color: var(--primary-strong);
		font-weight: 600;
		overflow: hidden;
		text-overflow: ellipsis;
		white-space: nowrap;
		max-width: 60%;
	}
	.cta {
		font-size: 12px;
		font-weight: 600;
		color: var(--primary-strong);
		margin-top: auto;
	}
</style>
