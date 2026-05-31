<script lang="ts">
	import type { Benchmark } from '$lib/types';

	interface Props {
		benchmark: Benchmark;
	}
	let { benchmark }: Props = $props();

	let query = $state('');

	interface TaskRow {
		name: string;
		type: string;
		languages: string;
		domains: string;
		modality: string;
		isPublic: string;
	}

	function makeRows(): TaskRow[] {
		const types = benchmark.taskTypes;
		const domains = benchmark.domains;
		const langs = benchmark.languages.slice(0, 3).join(', ');
		const modalities = ['text', 'image', 'audio'];
		return benchmark.tasks.map((name, i) => ({
			name,
			type: types[i % types.length] ?? '',
			languages: langs || '—',
			domains: domains.length ? domains[i % domains.length] : '—',
			modality: modalities[i % modalities.length],
			isPublic: i % 5 === 0 ? 'No' : 'Yes'
		}));
	}

	let rows = $derived(makeRows());
	let filtered = $derived(
		query.trim()
			? rows.filter((r) => r.name.toLowerCase().includes(query.toLowerCase().trim()))
			: rows
	);
</script>

<div class="wrap">
	<p class="muted">
		{benchmark.tasks.length} tasks in this benchmark. The metadata shown here is mock — the real
		values will come from the backend once it's wired up.
	</p>
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
					<th>Languages</th>
					<th>Domains</th>
					<th>Modality</th>
					<th>Public</th>
				</tr>
			</thead>
			<tbody>
				{#each filtered as row (row.name)}
					<tr>
						<td>{row.name}</td>
						<td>{row.type}</td>
						<td>{row.languages}</td>
						<td>{row.domains}</td>
						<td>{row.modality}</td>
						<td>{row.isPublic}</td>
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
	.muted {
		color: var(--text-muted);
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
</style>
