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
		benchmarks: string[];
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

	const SORTS = [
		{ id: 'name', label: 'Name' },
		{ id: 'benchmarks', label: 'Benchmark count' },
		{ id: 'languages', label: 'Language count' }
	] as const;
	type SortId = (typeof SORTS)[number]['id'];

	let query = $state('');
	let typeFilter = $state<Set<string>>(new Set(TASK_TYPES));
	let modalityFilter = $state<Set<string>>(new Set(MODALITIES));
	let sort = $state<SortId>('name');

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
		const list = ALL_TASKS.filter((t) => {
			if (q && !t.name.toLowerCase().includes(q)) return false;
			if (typeFilter.size > 0 && !typeFilter.has(t.type)) return false;
			if (modalityFilter.size > 0 && !modalityFilter.has(t.modality)) return false;
			return true;
		});
		list.sort((a, b) => {
			if (sort === 'name') return a.name.localeCompare(b.name);
			if (sort === 'benchmarks') return b.benchmarks.length - a.benchmarks.length;
			if (sort === 'languages') return b.languages.length - a.languages.length;
			return 0;
		});
		return list;
	});

	function slug(name: string): string {
		return encodeURIComponent(name);
	}
</script>

<div class="page">
	<header class="hero">
		<h1>Tasks</h1>
		<p class="lead">
			Every task across every benchmark, deduped by name. Filter by task type, modality, or search
			by name — open any benchmark chip to jump into its detail page.
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

		<div class="sort">
			<label for="sort-select">Sort by</label>
			<select id="sort-select" bind:value={sort}>
				{#each SORTS as s (s.id)}
					<option value={s.id}>{s.label}</option>
				{/each}
			</select>
		</div>

		<span class="count">{filtered.length} / {ALL_TASKS.length}</span>
	</div>

	{#if filtered.length === 0}
		<p class="empty">No tasks match those filters.</p>
	{:else}
		<div class="grid">
			{#each filtered as t (t.name)}
				<article class="card">
					<div class="card-head">
						<span class="title" title={t.name}>{t.name}</span>
						<span class="type-chip" data-type={t.type}>{t.type}</span>
					</div>
					<dl class="stats">
						<div>
							<dt>Benchmarks</dt>
							<dd>{t.benchmarks.length}</dd>
						</div>
						<div>
							<dt>Languages</dt>
							<dd>{t.languages.length}</dd>
						</div>
						<div>
							<dt>Domains</dt>
							<dd>{t.domains.length}</dd>
						</div>
						<div>
							<dt>Modality</dt>
							<dd class="modality">{t.modality}</dd>
						</div>
					</dl>
					{#if t.domains.length > 0}
						<div class="badges">
							{#each t.domains.slice(0, 3) as d (d)}
								<span class="badge soft">{d}</span>
							{/each}
							{#if t.domains.length > 3}
								<span class="badge soft muted">+{t.domains.length - 3}</span>
							{/if}
						</div>
					{/if}
					<div class="bench-section">
						<div class="bench-label">In benchmarks</div>
						<div class="bench-chips">
							{#each t.benchmarks.slice(0, 3) as b (b)}
								<a class="bench-chip" href="{base}/explorer/{slug(b)}" title={b}>{b}</a>
							{/each}
							{#if t.benchmarks.length > 3}
								<span class="bench-chip more">+{t.benchmarks.length - 3}</span>
							{/if}
						</div>
					</div>
				</article>
			{/each}
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

	.sort {
		display: inline-flex;
		align-items: center;
		gap: 6px;
		font-size: 12px;
		color: var(--text-muted);
	}
	.sort select {
		padding: 5px 8px;
		border: 1px solid var(--border);
		border-radius: 6px;
		font-size: 12px;
		background: var(--surface);
		font-family: inherit;
		color: var(--text);
	}

	.count {
		margin-left: auto;
		font-size: 12px;
		color: var(--text-subtle);
		font-variant-numeric: tabular-nums;
	}

	.grid {
		display: grid;
		grid-template-columns: repeat(auto-fill, minmax(280px, 1fr));
		gap: 12px;
	}
	.card {
		background: var(--surface);
		border: 1px solid var(--border);
		border-radius: 12px;
		padding: 14px 16px;
		display: flex;
		flex-direction: column;
		gap: 12px;
		transition:
			border-color 0.12s,
			box-shadow 0.12s;
	}
	.card:hover {
		border-color: var(--border-strong);
		box-shadow: 0 6px 16px rgba(15, 23, 42, 0.06);
	}
	.card-head {
		display: flex;
		align-items: flex-start;
		justify-content: space-between;
		gap: 10px;
	}
	.title {
		font-size: 14px;
		font-weight: 700;
		color: var(--text);
		word-break: break-word;
		flex: 1;
	}
	.type-chip {
		font-size: 10px;
		letter-spacing: 0.04em;
		text-transform: uppercase;
		font-weight: 700;
		padding: 3px 8px;
		border-radius: 999px;
		background: var(--surface-muted);
		color: var(--text-muted);
		white-space: nowrap;
		flex-shrink: 0;
	}
	.type-chip[data-type='Classification'] {
		background: #e8edff;
		color: #2740b8;
	}
	.type-chip[data-type='Clustering'] {
		background: #ffe6dc;
		color: #c0432e;
	}
	.type-chip[data-type='PairClassification'] {
		background: #def7e9;
		color: #1c7a4c;
	}
	.type-chip[data-type='Reranking'] {
		background: #fff1d4;
		color: #a36100;
	}
	.type-chip[data-type='Retrieval'] {
		background: #f2e7ff;
		color: #6a32b1;
	}
	.type-chip[data-type='STS'] {
		background: #ffdee9;
		color: #b41868;
	}
	.type-chip[data-type='BitextMining'] {
		background: #dceefc;
		color: #1e6cc3;
	}
	.type-chip[data-type='InstructionReranking'] {
		background: #fce4d6;
		color: #a04500;
	}
	.type-chip[data-type='MultilabelClassification'] {
		background: #e0f5e9;
		color: #2a7d4d;
	}
	.type-chip[data-type='Summarization'] {
		background: #d8f3fe;
		color: #1c5d7a;
	}

	.stats {
		display: grid;
		grid-template-columns: repeat(2, 1fr);
		gap: 8px 14px;
		margin: 0;
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
	.stats dd.modality {
		font-size: 12px;
		text-transform: capitalize;
	}

	.badges {
		display: flex;
		flex-wrap: wrap;
		gap: 4px;
	}
	.badge {
		font-size: 10px;
		padding: 3px 8px;
		border-radius: 999px;
		font-weight: 600;
		letter-spacing: 0.02em;
	}
	.badge.soft {
		background: var(--surface-muted);
		color: var(--text-muted);
		border: 1px solid var(--border);
	}
	.badge.muted {
		color: var(--text-subtle);
	}

	.bench-section {
		display: flex;
		flex-direction: column;
		gap: 6px;
		padding-top: 6px;
		border-top: 1px solid var(--border);
	}
	.bench-label {
		font-size: 10px;
		letter-spacing: 0.04em;
		text-transform: uppercase;
		color: var(--text-subtle);
		font-weight: 600;
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
		max-width: 100%;
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
