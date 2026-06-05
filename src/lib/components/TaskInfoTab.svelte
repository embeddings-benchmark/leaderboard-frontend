<script lang="ts">
	import type { Benchmark, TaskMeta } from '$lib/types';
	import TaskCard from './TaskCard.svelte';

	interface Props {
		benchmark: Benchmark;
		// Real per-task metadata (TaskMeta[]) from the loaded summary. When
		// absent (cold visit, summary still loading) we fall back to bare
		// task names from `benchmark.tasks`.
		tasksMeta?: TaskMeta[];
	}
	let { benchmark, tasksMeta = [] }: Props = $props();

	let query = $state('');

	interface CardRow {
		name: string;
		type: string;
		simplifiedType: string;
		languages: string[];
		domains: string[];
		modalities: string[];
		description: string;
		mainScore: string;
	}

	let rows = $derived.by<CardRow[]>(() => {
		const byName = new Map(tasksMeta.map((t) => [t.name, t]));
		return benchmark.tasks.map((name) => {
			const meta = byName.get(name);
			return {
				name,
				type: meta?.type ?? '—',
				simplifiedType: meta?.simplifiedType ?? '',
				languages: meta?.languages ?? [],
				domains: meta?.domains ?? [],
				modalities: meta?.modalities ?? [],
				description: meta?.description ?? '',
				mainScore: meta?.mainScore ?? ''
			};
		});
	});

	let filtered = $derived(
		query.trim()
			? rows.filter((r) => r.name.toLowerCase().includes(query.toLowerCase().trim()))
			: rows
	);
</script>

<div class="wrap">
	<p class="muted">{benchmark.tasks.length} tasks in this benchmark.</p>
	<div class="filter">
		<input type="search" placeholder="Filter tasks…" bind:value={query} />
		<span class="count">{filtered.length} / {rows.length}</span>
	</div>

	{#if filtered.length === 0}
		<p class="empty">No tasks match the current filter.</p>
	{:else}
		<div class="grid">
			{#each filtered as row (row.name)}
				<TaskCard
					name={row.name}
					type={row.type}
					simplifiedType={row.simplifiedType}
					description={row.description}
					modalities={row.modalities}
					stats={[
						{ label: 'Languages', value: row.languages.length },
						{ label: 'Domains', value: row.domains.length },
						{ label: 'Main metric', value: row.mainScore || '—', variant: 'metric' }
					]}
				/>
			{/each}
		</div>
	{/if}
</div>

<style>
	.wrap {
		padding-top: 8px;
	}
	.muted {
		margin: 0 0 12px;
	}
	.filter {
		display: flex;
		align-items: center;
		gap: 12px;
		margin-bottom: 14px;
	}
	.filter input {
		flex: 1;
		max-width: 320px;
		padding: 6px 10px;
		border: 1px solid var(--border);
		border-radius: 6px;
		font-size: 13px;
		font-family: inherit;
	}
	.filter input:focus {
		outline: none;
		border-color: var(--primary);
	}
	.count {
		color: var(--text-muted);
		font-size: 12px;
	}
	.empty {
		padding: 24px;
		text-align: center;
		color: var(--text-muted);
		background: var(--surface);
		border: 1px dashed var(--border);
		border-radius: 8px;
	}
	/* Same grid as /tasks — TaskCard handles the chrome, we just lay them out. */
	.grid {
		display: grid;
		grid-template-columns: repeat(auto-fill, minmax(280px, 1fr));
		gap: 12px;
	}
</style>
