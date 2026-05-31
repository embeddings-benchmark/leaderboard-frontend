<script lang="ts">
	import { page } from '$app/state';
	import { base } from '$app/paths';
	import { BENCHMARK_INDEX } from '$lib/data/mockBenchmarks';
	import { leaderboard } from '$lib/stores/leaderboard.svelte';
	import { filters, applyFilters } from '$lib/stores/filters.svelte';

	import FilterSidebar from '$lib/components/FilterSidebar.svelte';
	import CiteBlock from '$lib/components/CiteBlock.svelte';
	import ModelSearchBar from '$lib/components/ModelSearchBar.svelte';
	import Tabs from '$lib/components/Tabs.svelte';
	import SummaryTable from '$lib/components/SummaryTable.svelte';
	import DownloadButton from '$lib/components/DownloadButton.svelte';
	import PerfSizeTab from '$lib/components/PerfSizeTab.svelte';
	import PerfTimeTab from '$lib/components/PerfTimeTab.svelte';
	import RadarTab from '$lib/components/RadarTab.svelte';
	import PerTaskTab from '$lib/components/PerTaskTab.svelte';
	import PerLanguageTab from '$lib/components/PerLanguageTab.svelte';
	import TaskInfoTab from '$lib/components/TaskInfoTab.svelte';
	import FAQ from '$lib/components/FAQ.svelte';

	let benchmarkName = $derived(decodeURIComponent(page.params.benchmark ?? ''));
	let benchmark = $derived(BENCHMARK_INDEX[benchmarkName] ?? null);

	type TabId =
		| 'summary'
		| 'perf_size'
		| 'perf_time'
		| 'perf_task_type'
		| 'perf_task'
		| 'perf_language'
		| 'task_info';
	const TABS: { id: TabId; label: string }[] = [
		{ id: 'summary', label: 'Summary' },
		{ id: 'perf_size', label: 'Performance per Model Size' },
		{ id: 'perf_time', label: 'Performance over Time' },
		{ id: 'perf_task_type', label: 'Performance per Task Type' },
		{ id: 'perf_task', label: 'Performance per task' },
		{ id: 'perf_language', label: 'Performance per language' },
		{ id: 'task_info', label: 'Task information' }
	];
	let activeTab = $state<TabId>('summary');

	$effect(() => {
		if (benchmark && leaderboard.selected !== benchmark.name) {
			leaderboard.select(benchmark.name);
		}
	});
	$effect(() => {
		filters.initFor(leaderboard.summary);
	});

	let filteredSummary = $derived(
		leaderboard.summary && leaderboard.selected === benchmarkName
			? applyFilters(leaderboard.summary)
			: null
	);
</script>

<div class="app">
	<main class="main">
		<nav class="breadcrumb" aria-label="Breadcrumb">
			<a href="{base}/explorer">Explorer</a>
			<span class="sep">/</span>
			<span class="current">{benchmark?.displayName ?? benchmarkName}</span>
		</nav>

		{#if !benchmark}
			<section class="empty card">
				<h1>Unknown benchmark</h1>
				<p>No benchmark named “{benchmarkName}” exists in the mock data.</p>
				<a class="back" href="{base}/explorer">← Back to Explorer</a>
			</section>
		{:else}
			<section class="hero">
				<h1>{benchmark.displayName}</h1>
				<p class="lead">{benchmark.description}</p>
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
					<div>
						<dt>Domains</dt>
						<dd>{benchmark.domains.length}</dd>
					</div>
				</dl>
				{#if benchmark.reference}
					<a class="ref" href={benchmark.reference} target="_blank" rel="noreferrer">
						Reference paper →
					</a>
				{/if}
			</section>

			<CiteBlock {benchmark} />

			<Tabs tabs={TABS} active={activeTab} onSelect={(id) => (activeTab = id)} />

			<ModelSearchBar
				matchCount={filteredSummary?.rows.length}
				totalCount={leaderboard.summary?.rows.length}
			/>

			<section class="tab-body">
				{#if !filteredSummary}
					<p class="muted">Loading…</p>
				{:else if filteredSummary.rows.length === 0}
					<p class="muted">No models match the current filters.</p>
				{:else if activeTab === 'summary'}
					<SummaryTable summary={filteredSummary} />
					<DownloadButton summary={filteredSummary} />
					<FAQ />
				{:else if activeTab === 'perf_size'}
					<PerfSizeTab summary={filteredSummary} />
				{:else if activeTab === 'perf_time'}
					<PerfTimeTab summary={filteredSummary} />
				{:else if activeTab === 'perf_task_type'}
					<RadarTab summary={filteredSummary} />
				{:else if activeTab === 'perf_task'}
					<PerTaskTab summary={filteredSummary} />
				{:else if activeTab === 'perf_language'}
					<PerLanguageTab summary={filteredSummary} />
				{:else if activeTab === 'task_info'}
					<TaskInfoTab {benchmark} />
				{/if}
			</section>
		{/if}
	</main>

	<FilterSidebar />
</div>

<style>
	.app {
		display: flex;
		min-height: 100vh;
	}
	.main {
		flex: 1;
		min-width: 0;
		max-width: 1400px;
		margin: 0 auto;
		padding: 18px 28px 40px;
		padding-right: 28px;
	}
	.breadcrumb {
		display: flex;
		align-items: center;
		gap: 6px;
		font-size: 12px;
		color: var(--text-muted);
		margin-bottom: 12px;
	}
	.breadcrumb a {
		color: var(--text-muted);
	}
	.breadcrumb a:hover {
		color: var(--text);
	}
	.sep {
		color: var(--border-strong);
	}
	.current {
		color: var(--text);
		font-weight: 600;
	}

	.hero {
		padding: 18px 0 22px;
		border-bottom: 1px solid var(--border);
		margin-bottom: 16px;
	}
	.hero h1 {
		font-size: 28px;
		font-weight: 700;
		letter-spacing: -0.01em;
		margin: 0 0 10px;
	}
	.lead {
		max-width: 70ch;
		color: var(--text-muted);
		margin: 0 0 14px;
	}
	.stats {
		display: flex;
		flex-wrap: wrap;
		gap: 18px;
		margin: 0 0 12px;
	}
	.stats > div {
		display: flex;
		flex-direction: column;
		gap: 2px;
	}
	.stats dt {
		font-size: 10px;
		text-transform: uppercase;
		letter-spacing: 0.06em;
		color: var(--text-subtle);
		font-weight: 600;
	}
	.stats dd {
		margin: 0;
		font-size: 18px;
		font-weight: 700;
		font-variant-numeric: tabular-nums;
	}
	.ref {
		font-size: 13px;
		font-weight: 600;
	}

	.tab-body {
		padding-top: 14px;
	}
	.muted {
		color: var(--text-muted);
	}

	.empty {
		background: var(--surface);
		border: 1px solid var(--border);
		border-radius: 14px;
		padding: 40px;
		text-align: center;
	}
	.empty h1 {
		font-size: 20px;
		margin: 0 0 6px;
	}
	.empty p {
		color: var(--text-muted);
	}
	.back {
		display: inline-block;
		margin-top: 12px;
		font-weight: 600;
	}
</style>
