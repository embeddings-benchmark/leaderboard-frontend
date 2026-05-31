<script lang="ts">
	import Sidebar from '$lib/components/Sidebar.svelte';
	import FilterSidebar from '$lib/components/FilterSidebar.svelte';
	import Header from '$lib/components/Header.svelte';
	import Description from '$lib/components/Description.svelte';
	import CiteBlock from '$lib/components/CiteBlock.svelte';
	import ModelSearchBar from '$lib/components/ModelSearchBar.svelte';
	import Tabs from '$lib/components/Tabs.svelte';
	import SummaryTable from '$lib/components/SummaryTable.svelte';
	import DownloadButton from '$lib/components/DownloadButton.svelte';
	import FAQ from '$lib/components/FAQ.svelte';
	import Acknowledgement from '$lib/components/Acknowledgement.svelte';
	import PerfSizeTab from '$lib/components/PerfSizeTab.svelte';
	import PerfTimeTab from '$lib/components/PerfTimeTab.svelte';
	import RadarTab from '$lib/components/RadarTab.svelte';
	import PerTaskTab from '$lib/components/PerTaskTab.svelte';
	import PerLanguageTab from '$lib/components/PerLanguageTab.svelte';
	import TaskInfoTab from '$lib/components/TaskInfoTab.svelte';
	import { leaderboard } from '$lib/stores/leaderboard.svelte';
	import { filters, applyFilters } from '$lib/stores/filters.svelte';
	import { BENCHMARK_MENU } from '$lib/data/mockBenchmarks';

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
		if (!leaderboard.benchmark && !leaderboard.loading) {
			leaderboard.select(leaderboard.selected);
		}
	});

	// Re-init customize filters whenever the loaded summary changes.
	$effect(() => {
		filters.initFor(leaderboard.summary);
	});

	let filteredSummary = $derived(
		leaderboard.summary ? applyFilters(leaderboard.summary) : null
	);
</script>

<div class="app">
	<Sidebar menu={BENCHMARK_MENU} />

	<main class="main">
		<div class="page">
			<Header benchmarkName={leaderboard.selected} />

			{#if leaderboard.benchmark}
				<Description benchmark={leaderboard.benchmark} />
				<CiteBlock benchmark={leaderboard.benchmark} />
			{:else if leaderboard.loading}
				<p class="muted">Loading…</p>
			{/if}

			<Tabs tabs={TABS} active={activeTab} onSelect={(id) => (activeTab = id)} />

			<ModelSearchBar
				matchCount={filteredSummary?.rows.length}
				totalCount={leaderboard.summary?.rows.length}
			/>

			<section class="tab-body">
				{#if leaderboard.error}
					<p class="error">{leaderboard.error}</p>
				{:else if !filteredSummary || !leaderboard.benchmark}
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
					<TaskInfoTab benchmark={leaderboard.benchmark} />
				{/if}
			</section>

			<Acknowledgement />
		</div>
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
	}
	.page {
		max-width: 1400px;
		margin: 0 auto;
		padding: 16px 28px 40px;
	}
	.tab-body {
		padding-top: 18px;
	}
	.muted {
		color: var(--text-muted);
	}
	.error {
		color: #c0392b;
	}
</style>
