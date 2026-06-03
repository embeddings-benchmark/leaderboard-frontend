<script lang="ts">
	import { resolve } from '$app/paths';
	import { SvelteSet } from 'svelte/reactivity';
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
		languages: string[];
		domains: string[];
		modalities: string;
	}

	let rows = $derived.by<TaskRow[]>(() => {
		const byName = new Map(tasksMeta.map((t) => [t.name, t]));
		return benchmark.tasks.map((name) => {
			const meta = byName.get(name);
			return {
				name,
				type: meta?.type ?? '—',
				languages: meta?.languages ?? [],
				domains: meta?.domains ?? [],
				modalities: meta?.modalities.length ? meta.modalities.join(', ') : '—'
			};
		});
	});

	let filtered = $derived(
		query.trim()
			? rows.filter((r) => r.name.toLowerCase().includes(query.toLowerCase().trim()))
			: rows
	);

	// Long Languages / Domains lists (MMTEB tasks declare 200+ languages
	// each) blow the row height out without a cap. Show the first
	// PREVIEW entries inline; the row stays scannable, the user clicks
	// "+N more" to expand a single cell.
	const PREVIEW = 6;
	// Key: `${row.name}|${col}`. Tracking expanded cells in a set lets
	// each Languages cell expand independently of the matching Domains
	// cell on the same row.
	const expanded = new SvelteSet<string>();
	function expandKey(rowName: string, col: 'lang' | 'dom'): string {
		return `${rowName}|${col}`;
	}
	function toggleExpand(rowName: string, col: 'lang' | 'dom') {
		const k = expandKey(rowName, col);
		if (expanded.has(k)) expanded.delete(k);
		else expanded.add(k);
	}
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
					{@const langOpen = expanded.has(expandKey(row.name, 'lang'))}
					{@const domOpen = expanded.has(expandKey(row.name, 'dom'))}
					{@const langShown = langOpen ? row.languages : row.languages.slice(0, PREVIEW)}
					{@const domShown = domOpen ? row.domains : row.domains.slice(0, PREVIEW)}
					{@const langHidden = row.languages.length - langShown.length}
					{@const domHidden = row.domains.length - domShown.length}
					<tr>
						<td>
							<a class="task-link" href={resolve('/tasks/[name]', { name: slug(row.name) })}
								>{row.name}</a
							>
						</td>
						<td>{row.type}</td>
						<td class="wrap-col" title={row.languages.join(', ') || '—'}>
							{#if row.languages.length === 0}
								—
							{:else}
								{langShown.join(', ')}{#if langHidden > 0},
									<button
										type="button"
										class="more-toggle"
										onclick={() => toggleExpand(row.name, 'lang')}
									>
										+{langHidden} more
									</button>
								{:else if langOpen && row.languages.length > PREVIEW}
									<button
										type="button"
										class="more-toggle"
										onclick={() => toggleExpand(row.name, 'lang')}
									>
										Show fewer
									</button>
								{/if}
							{/if}
						</td>
						<td class="wrap-col" title={row.domains.join(', ') || '—'}>
							{#if row.domains.length === 0}
								—
							{:else}
								{domShown.join(', ')}{#if domHidden > 0},
									<button
										type="button"
										class="more-toggle"
										onclick={() => toggleExpand(row.name, 'dom')}
									>
										+{domHidden} more
									</button>
								{:else if domOpen && row.domains.length > PREVIEW}
									<button
										type="button"
										class="more-toggle"
										onclick={() => toggleExpand(row.name, 'dom')}
									>
										Show fewer
									</button>
								{/if}
							{/if}
						</td>
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
	/* Horizontal scroll only — page scroll handles the y-axis, matching
	   SummaryTable / PerTaskTab / PerLanguageTab. Previously this had
	   a `max-height: 600px` + `overflow-y: auto` that trapped the table
	   in an internal scrollport so the user couldn't reach the bottom
	   without an extra inner scrollbar. */
	.scroll {
		overflow-x: auto;
		border: 1px solid var(--border);
		border-radius: 8px;
		background: var(--surface);
		box-shadow: var(--shadow-sm);
		-webkit-overflow-scrolling: touch;
		overscroll-behavior-x: contain;
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
	   so the row grows vertically instead of the table going horizontal.
	   Combined with the per-cell "+N more" toggle in the markup, the
	   collapsed state stays roughly one line tall. */
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
	/* "+N more" / "Show fewer" inline button: looks like a link, sits
	   on the same line as the comma-joined preview so the cell stays
	   compact even when expanded. ``margin-left`` separates the button
	   from the preceding comma (or, in the expanded case, the final
	   item) since Svelte collapses literal whitespace between adjacent
	   blocks. */
	.more-toggle {
		all: unset;
		margin-left: 4px;
		color: var(--link);
		font-weight: 600;
		cursor: pointer;
		white-space: nowrap;
	}
	.more-toggle:hover {
		text-decoration: underline;
	}
	.more-toggle:focus-visible {
		outline: 2px solid var(--primary);
		outline-offset: 1px;
		border-radius: 3px;
	}
</style>
