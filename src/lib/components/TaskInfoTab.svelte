<script lang="ts">
	import { resolve } from '$app/paths';
	import type { Benchmark, TaskMeta } from '$lib/types';
	import { slug } from '$lib/format';

	interface Props {
		benchmark: Benchmark;
		// Real per-task metadata (TaskMeta[]) from the loaded summary. When
		// absent (cold visit, summary still loading) we fall back to rendering
		// just the task name from `benchmark.tasks`.
		tasksMeta?: TaskMeta[];
	}
	let { benchmark, tasksMeta = [] }: Props = $props();

	let query = $state('');

	interface TaskRow {
		name: string;
		type: string;
		languages: string;
		domains: string;
		modalities: string;
	}

	let rows = $derived.by<TaskRow[]>(() => {
		const byName = new Map(tasksMeta.map((t) => [t.name, t]));
		return benchmark.tasks.map((name) => {
			const meta = byName.get(name);
			return {
				name,
				type: meta?.type ?? '—',
				languages: meta?.languages.length ? meta.languages.join(', ') : '—',
				domains: meta?.domains.length ? meta.domains.join(', ') : '—',
				modalities: meta?.modalities.length ? meta.modalities.join(', ') : '—'
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
	<div class="scroll">
		<table>
			<thead>
				<tr>
					<th>Task Name</th>
					<th>Task Type</th>
					<th class="wrap-col">Languages</th>
					<th class="wrap-col">Domains</th>
					<th>Modalities</th>
				</tr>
			</thead>
			<tbody>
				{#each filtered as row (row.name)}
					<tr>
						<td>
							<a class="task-link" href={resolve('/tasks/[name]', { name: slug(row.name) })}
								>{row.name}</a
							>
						</td>
						<td>{row.type}</td>
						<td class="wrap-col" title={row.languages}>{row.languages}</td>
						<td class="wrap-col" title={row.domains}>{row.domains}</td>
						<td>{row.modalities}</td>
					</tr>
				{/each}
			</tbody>
		</table>
	</div>
</div>

<style>
	.wrap {
		padding-top: 8px;
	}
	/* Base `.muted` (color + margin: 0) lives in src/app.css. */
	.muted {
		margin: 0 0 12px;
	}
	.filter {
		display: flex;
		align-items: center;
		gap: 12px;
		margin-bottom: 10px;
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
	.scroll {
		overflow-x: auto;
		max-height: 600px;
		overflow-y: auto;
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
	th,
	td {
		padding: 8px 12px;
		border-bottom: 1px solid var(--border);
		text-align: left;
		white-space: nowrap;
		vertical-align: top;
	}
	/* Languages + Domains can carry hundreds of entries on multilingual tasks
	   (MMTEB, MIEB(Multilingual), ...). Cap the column and let the cell wrap
	   so the row grows vertically instead of the table going horizontal. */
	.wrap-col {
		max-width: 320px;
		white-space: normal;
		overflow-wrap: anywhere;
		line-height: 1.4;
	}
	thead th {
		background: var(--surface-muted);
		color: var(--text-muted);
		font-weight: 600;
		position: sticky;
		top: 0;
		z-index: 1;
	}
	tbody tr:nth-child(even) td {
		background: var(--row-alt);
	}
	tbody tr:hover td {
		background: var(--row-hover);
	}
	.task-link {
		color: var(--text);
		font-weight: 600;
		text-decoration: underline dotted color-mix(in srgb, var(--link) 45%, transparent);
		text-underline-offset: 3px;
	}
	.task-link:hover {
		color: var(--link);
		text-decoration-color: var(--link);
	}
</style>
