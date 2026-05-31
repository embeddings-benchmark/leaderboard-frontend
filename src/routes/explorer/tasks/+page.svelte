<script lang="ts">
	import { base } from '$app/paths';
	import { BENCHMARK_INDEX } from '$lib/data/mockBenchmarks';
	import { buildMockSummary } from '$lib/data/mockSummary';

	interface TaskEntry {
		name: string;
		type: string;
		languages: string[];
		domains: string[];
		modality: string;
		benchmarks: string[]; // benchmark names this task appears in
	}

	// Aggregate tasks across all benchmarks. Tasks with the same name across
	// benchmarks merge their benchmark lists; their type/lang/domain comes from
	// the first occurrence (mock data is deterministic so this is stable).
	const ALL_TASKS: TaskEntry[] = (() => {
		const map = new Map<string, TaskEntry>();
		for (const bench of Object.values(BENCHMARK_INDEX)) {
			const summary = buildMockSummary(bench.name);
			for (const meta of summary.tasksMeta) {
				const existing = map.get(meta.name);
				if (existing) {
					if (!existing.benchmarks.includes(bench.name)) {
						existing.benchmarks.push(bench.name);
					}
				} else {
					map.set(meta.name, {
						name: meta.name,
						type: meta.type,
						languages: meta.languages,
						domains: meta.domains,
						modality: meta.modality,
						benchmarks: [bench.name]
					});
				}
			}
		}
		return [...map.values()].sort((a, b) => a.name.localeCompare(b.name));
	})();

	const TASK_TYPES = Array.from(new Set(ALL_TASKS.map((t) => t.type))).sort();
	const MODALITIES = Array.from(new Set(ALL_TASKS.map((t) => t.modality))).sort();

	let query = $state('');
	let typeFilter = $state<Set<string>>(new Set(TASK_TYPES));
	let modalityFilter = $state<Set<string>>(new Set(MODALITIES));

	function toggleType(t: string) {
		const next = new Set(typeFilter);
		if (next.has(t)) next.delete(t);
		else next.add(t);
		typeFilter = next;
	}
	function toggleModality(m: string) {
		const next = new Set(modalityFilter);
		if (next.has(m)) next.delete(m);
		else next.add(m);
		modalityFilter = next;
	}

	let filtered = $derived.by(() => {
		const q = query.trim().toLowerCase();
		return ALL_TASKS.filter((t) => {
			if (q && !t.name.toLowerCase().includes(q)) return false;
			if (typeFilter.size > 0 && !typeFilter.has(t.type)) return false;
			if (modalityFilter.size > 0 && !modalityFilter.has(t.modality)) return false;
			return true;
		});
	});

	function fmtList(items: string[], max = 3): string {
		if (items.length <= max) return items.join(', ');
		return items.slice(0, max).join(', ') + `, +${items.length - max}`;
	}

	function slug(name: string): string {
		return encodeURIComponent(name);
	}
</script>

<div class="page">
	<header class="hero">
		<h1>Tasks</h1>
		<p class="lead">
			Every task across every benchmark in the leaderboard, deduped by name. Filter by task type,
			modality, or search by name — click a benchmark chip to jump into its detail page.
		</p>
	</header>

	<div class="toolbar">
		<div class="search">
			<svg
				viewBox="0 0 24 24"
				width="14"
				height="14"
				fill="none"
				stroke="currentColor"
				stroke-width="2"
				stroke-linecap="round"
				stroke-linejoin="round"
				aria-hidden="true"
			>
				<circle cx="11" cy="11" r="7" />
				<path d="m20 20-3.5-3.5" />
			</svg>
			<input type="search" placeholder="Search tasks by name…" bind:value={query} />
			{#if query}
				<button type="button" class="clear" onclick={() => (query = '')} aria-label="Clear">×</button>
			{/if}
		</div>

		<div class="pills" role="group" aria-label="Task type">
			{#each TASK_TYPES as t (t)}
				<label class="pill">
					<input type="checkbox" checked={typeFilter.has(t)} onchange={() => toggleType(t)} />
					<span>{t}</span>
				</label>
			{/each}
		</div>

		<div class="pills" role="group" aria-label="Modality">
			{#each MODALITIES as m (m)}
				<label class="pill">
					<input
						type="checkbox"
						checked={modalityFilter.has(m)}
						onchange={() => toggleModality(m)}
					/>
					<span>{m}</span>
				</label>
			{/each}
		</div>

		<span class="count">{filtered.length} / {ALL_TASKS.length}</span>
	</div>

	{#if filtered.length === 0}
		<p class="empty">No tasks match those filters.</p>
	{:else}
		<div class="card">
			<div class="scroll">
				<table>
					<thead>
						<tr>
							<th>Task</th>
							<th>Type</th>
							<th>Modality</th>
							<th>Languages</th>
							<th>Domains</th>
							<th>In benchmarks</th>
						</tr>
					</thead>
					<tbody>
						{#each filtered as t (t.name)}
							<tr>
								<td class="task-name">{t.name}</td>
								<td><span class="chip type">{t.type}</span></td>
								<td><span class="chip">{t.modality}</span></td>
								<td class="dim">{fmtList(t.languages)}</td>
								<td class="dim">{fmtList(t.domains)}</td>
								<td>
									<div class="bench-chips">
										{#each t.benchmarks.slice(0, 4) as b (b)}
											<a class="bench-chip" href="{base}/explorer/{slug(b)}">{b}</a>
										{/each}
										{#if t.benchmarks.length > 4}
											<span class="bench-chip more">+{t.benchmarks.length - 4}</span>
										{/if}
									</div>
								</td>
							</tr>
						{/each}
					</tbody>
				</table>
			</div>
		</div>
	{/if}
</div>

<style>
	.page {
		max-width: 1280px;
		margin: 0 auto;
		padding: 28px 28px 64px;
	}
	.hero {
		padding: 24px 0 16px;
	}
	.hero h1 {
		font-size: 32px;
		margin: 0 0 10px;
		letter-spacing: -0.01em;
	}
	.lead {
		color: var(--text-muted);
		margin: 0;
		max-width: 60ch;
	}

	.toolbar {
		display: flex;
		flex-wrap: wrap;
		gap: 12px;
		align-items: center;
		margin: 16px 0 18px;
		padding: 14px 16px;
		background: var(--surface);
		border: 1px solid var(--border);
		border-radius: 12px;
		box-shadow: var(--shadow-sm);
	}
	.search {
		position: relative;
		flex: 1;
		min-width: 220px;
		max-width: 360px;
	}
	.search svg {
		position: absolute;
		left: 10px;
		top: 50%;
		transform: translateY(-50%);
		color: var(--text-subtle);
	}
	.search input {
		width: 100%;
		padding: 7px 28px 7px 30px;
		border: 1px solid var(--border);
		border-radius: 8px;
		font-size: 13px;
		font-family: inherit;
		background: var(--surface);
	}
	.search input:focus {
		outline: none;
		border-color: var(--primary);
		box-shadow: 0 0 0 3px var(--primary-soft);
	}
	.clear {
		position: absolute;
		right: 6px;
		top: 50%;
		transform: translateY(-50%);
		width: 20px;
		height: 20px;
		border: none;
		background: none;
		color: var(--text-subtle);
		font-size: 16px;
		cursor: pointer;
		border-radius: 4px;
	}

	.pills {
		display: flex;
		flex-wrap: wrap;
		gap: 4px;
	}
	.pill {
		display: inline-flex;
		align-items: center;
		gap: 6px;
		padding: 4px 10px;
		font-size: 12px;
		background: var(--surface);
		border: 1px solid var(--border);
		border-radius: 999px;
		cursor: pointer;
		user-select: none;
	}
	.pill input {
		margin: 0;
		accent-color: var(--primary);
	}
	.pill:has(input:checked) {
		background: var(--primary-soft);
		border-color: var(--primary);
		color: var(--primary-strong);
		font-weight: 500;
	}

	.count {
		margin-left: auto;
		font-size: 12px;
		color: var(--text-subtle);
		font-variant-numeric: tabular-nums;
	}

	.card {
		background: var(--surface);
		border: 1px solid var(--border);
		border-radius: 12px;
		box-shadow: var(--shadow-sm);
		overflow: hidden;
	}
	.scroll {
		overflow-x: auto;
		max-height: 70vh;
		overflow-y: auto;
	}
	table {
		width: 100%;
		border-collapse: separate;
		border-spacing: 0;
		font-size: 13px;
	}
	thead th {
		background: var(--surface-muted);
		color: var(--text-muted);
		font-weight: 600;
		text-align: left;
		padding: 10px 12px;
		border-bottom: 1px solid var(--border);
		position: sticky;
		top: 0;
		z-index: 1;
		white-space: nowrap;
	}
	tbody td {
		padding: 9px 12px;
		border-bottom: 1px solid var(--border);
		vertical-align: middle;
	}
	tbody tr:nth-child(even) td {
		background: var(--row-alt);
	}
	tbody tr:hover td {
		background: var(--row-hover);
	}
	.task-name {
		font-weight: 600;
	}
	.chip {
		display: inline-block;
		padding: 2px 8px;
		font-size: 11px;
		font-weight: 600;
		border-radius: 999px;
		background: var(--surface-muted);
		color: var(--text-muted);
		white-space: nowrap;
	}
	.chip.type {
		background: var(--primary-soft);
		color: var(--primary-strong);
	}
	.dim {
		color: var(--text-muted);
	}
	.bench-chips {
		display: flex;
		flex-wrap: wrap;
		gap: 4px;
	}
	.bench-chip {
		display: inline-block;
		padding: 3px 8px;
		font-size: 11px;
		font-weight: 500;
		border-radius: 999px;
		background: var(--surface-muted);
		color: var(--text);
		border: 1px solid var(--border);
		text-decoration: none;
		max-width: 220px;
		overflow: hidden;
		text-overflow: ellipsis;
		white-space: nowrap;
	}
	.bench-chip:hover {
		border-color: var(--primary);
		color: var(--primary-strong);
	}
	.bench-chip.more {
		color: var(--text-subtle);
		cursor: default;
	}

	.empty {
		text-align: center;
		color: var(--text-muted);
		padding: 40px;
		background: var(--surface);
		border: 1px solid var(--border);
		border-radius: 12px;
	}
</style>
