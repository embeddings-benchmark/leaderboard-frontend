<script lang="ts">
	import { page } from '$app/state';
	import { base } from '$app/paths';
	import { BENCHMARK_INDEX } from '$lib/data/mockBenchmarks';
	import { leaderboard } from '$lib/stores/leaderboard.svelte';
	import { filters, applyFilters } from '$lib/stores/filters.svelte';

	import FilterSidebar from '$lib/components/FilterSidebar.svelte';
	import CiteBlock from '$lib/components/CiteBlock.svelte';
	import BenchmarkOverview from '$lib/components/BenchmarkOverview.svelte';
	import ModelSearchBar from '$lib/components/ModelSearchBar.svelte';
	import Tabs from '$lib/components/Tabs.svelte';
	import SummaryTable from '$lib/components/SummaryTable.svelte';
	import DownloadButton from '$lib/components/DownloadButton.svelte';
	import PerfSizeTab from '$lib/components/PerfSizeTab.svelte';
	import PerfTimeTab from '$lib/components/PerfTimeTab.svelte';
	import PerTaskTab from '$lib/components/PerTaskTab.svelte';
	import PerLanguageTab from '$lib/components/PerLanguageTab.svelte';
	import TaskInfoTab from '$lib/components/TaskInfoTab.svelte';
	import FAQ from '$lib/components/FAQ.svelte';

	let benchmarkName = $derived(decodeURIComponent(page.params.benchmark ?? ''));
	let benchmark = $derived(BENCHMARK_INDEX[benchmarkName] ?? null);

	type TabId =
		| 'overview'
		| 'summary'
		| 'perf_size'
		| 'perf_time'
		| 'perf_task'
		| 'perf_language'
		| 'task_info';
	const TABS: { id: TabId; label: string }[] = [
		{ id: 'overview', label: 'Overview' },
		{ id: 'summary', label: 'Summary' },
		{ id: 'perf_size', label: 'Performance per Model Size' },
		{ id: 'perf_time', label: 'Performance over Time' },
		{ id: 'perf_task', label: 'Performance per task' },
		{ id: 'perf_language', label: 'Performance per language' },
		{ id: 'task_info', label: 'Task information' }
	];
	let activeTab = $state<TabId>('summary');

	$effect(() => {
		if (!benchmark) return;
		// Trigger load both when the URL benchmark differs from the store's
		// current selection AND when it matches but the summary hasn't loaded yet
		// (cold visit where selected already defaulted to this benchmark name).
		const needsSwitch = leaderboard.selected !== benchmark.name;
		const needsInitialLoad = !leaderboard.summary && !leaderboard.loading;
		if (needsSwitch || needsInitialLoad) {
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
			<section class="hero card">
				<div class="hero-left">
					<h1>{benchmark.displayName}</h1>
					<p class="desc">{benchmark.description}</p>
					{#if benchmark.reference}
						<a class="ref" href={benchmark.reference} target="_blank" rel="noreferrer">
							Reference paper →
						</a>
					{/if}
					<CiteBlock {benchmark} />
				</div>
				<div class="kpis">
					<div class="kpi">
						<span class="kpi-label">Languages</span>
						<span class="kpi-value">{benchmark.languages.length}</span>
					</div>
					<div class="kpi">
						<span class="kpi-label">Tasks</span>
						<span class="kpi-value">{filteredSummary?.tasks.length ?? benchmark.tasks.length}</span>
					</div>
					<div class="kpi">
						<span class="kpi-label">Task Types</span>
						<span class="kpi-value"
							>{filteredSummary?.taskTypes.length ?? benchmark.taskTypes.length}</span
						>
					</div>
					<div class="kpi">
						<span class="kpi-label">Models</span>
						<span class="kpi-value">{filteredSummary?.rows.length ?? 0}</span>
					</div>
				</div>
			</section>

			<Tabs tabs={TABS} active={activeTab} onSelect={(id) => (activeTab = id)} />

			{#if activeTab === 'summary' || activeTab === 'perf_task' || activeTab === 'perf_language'}
				<div class="toolbar-row">
					<ModelSearchBar
						matchCount={filteredSummary?.rows.length}
						totalCount={leaderboard.summary?.rows.length}
					/>
					{#if activeTab === 'summary' && filteredSummary}
						<DownloadButton summary={filteredSummary} />
					{/if}
				</div>
			{/if}

			<section class="tab-body">
				{#if !filteredSummary}
					<p class="muted">Loading…</p>
				{:else if filteredSummary.rows.length === 0}
					<p class="muted">No models match the current filters.</p>
				{:else if activeTab === 'overview'}
					<BenchmarkOverview summary={filteredSummary} />
				{:else if activeTab === 'summary'}
					<SummaryTable summary={filteredSummary} />
					<FAQ />
				{:else if activeTab === 'perf_size'}
					<PerfSizeTab summary={filteredSummary} />
				{:else if activeTab === 'perf_time'}
					<PerfTimeTab summary={filteredSummary} />
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

	.card {
		background: var(--surface);
		border: 1px solid var(--border);
		border-radius: 14px;
		box-shadow: 0 1px 3px rgba(15, 23, 42, 0.04);
	}
	.hero {
		display: grid;
		grid-template-columns: minmax(0, 1.4fr) minmax(0, 1fr);
		gap: 28px;
		padding: 26px 28px;
		margin-bottom: 16px;
	}
	@media (max-width: 1000px) {
		.hero {
			grid-template-columns: 1fr;
		}
	}
	.hero-left h1 {
		font-size: 26px;
		margin: 0 0 10px;
		letter-spacing: -0.01em;
	}
	.desc {
		color: var(--text-muted);
		margin: 0 0 12px;
		max-width: 60ch;
	}
	.ref {
		font-size: 13px;
		font-weight: 600;
	}
	/* CiteBlock lives inside the hero card now; give it a little air above. */
	.hero-left :global(.cite) {
		margin-top: 14px;
	}
	.kpis {
		display: grid;
		grid-template-columns: repeat(2, minmax(0, 1fr));
		gap: 10px;
		align-content: start;
	}
	.kpi {
		background: var(--surface-muted);
		border: 1px solid var(--border);
		border-radius: 10px;
		padding: 10px 12px;
		display: flex;
		flex-direction: column;
		gap: 2px;
	}
	.kpi-label {
		font-size: 11px;
		letter-spacing: 0.04em;
		text-transform: uppercase;
		color: var(--text-subtle);
		font-weight: 600;
	}
	.kpi-value {
		font-size: 20px;
		font-weight: 700;
		color: var(--text);
		font-variant-numeric: tabular-nums;
	}

	.tab-body {
		padding-top: 14px;
	}
	.toolbar-row {
		display: flex;
		align-items: center;
		gap: 12px;
	}
	.toolbar-row :global(.bar) {
		flex: 1;
		min-width: 0;
		margin: 8px 0;
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
