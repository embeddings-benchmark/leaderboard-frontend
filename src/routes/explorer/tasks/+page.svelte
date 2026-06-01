<script lang="ts">
	import { base } from '$app/paths';
	import { DEFAULT_BENCHMARK_NAME, loadBenchmarkMenu, loadSummary } from '$lib/data/service';
	import { isBenchmark, type Benchmark, type MenuEntry } from '$lib/types';

	interface TaskEntry {
		name: string;
		type: string;
		languages: string[];
		domains: string[];
		modality: string;
		description: string;
		benchmarks: string[];
	}

	function collectBenchmarks(entries: MenuEntry[]): Benchmark[] {
		const out: Benchmark[] = [];
		const walk = (m: MenuEntry) => {
			for (const c of m.children) {
				if (isBenchmark(c)) out.push(c);
				else walk(c);
			}
		};
		entries.forEach(walk);
		return out;
	}

	let ALL_TASKS = $state<TaskEntry[]>([]);
	let TASK_TYPES = $state<string[]>([]);
	let MODALITIES = $state<string[]>([]);
	let loadingData = $state(true);
	let loadError = $state<string | null>(null);

	$effect(() => {
		(async () => {
			try {
				const [menu, summary] = await Promise.all([
					loadBenchmarkMenu(),
					loadSummary(DEFAULT_BENCHMARK_NAME)
				]);
				const allBenches = collectBenchmarks(menu);
				const occurrences = new Map<string, string[]>();
				for (const b of allBenches) {
					for (const t of b.tasks) {
						const list = occurrences.get(t) ?? [];
						list.push(b.name);
						occurrences.set(t, list);
					}
				}
				const tasks = summary.tasksMeta.map<TaskEntry>((m) => ({
					name: m.name,
					type: m.type,
					languages: m.languages,
					domains: m.domains,
					modality: m.modality,
					description: m.description,
					benchmarks: occurrences.get(m.name) ?? [DEFAULT_BENCHMARK_NAME]
				}));
				tasks.sort((a, b) => a.name.localeCompare(b.name));
				ALL_TASKS = tasks;
				TASK_TYPES = Array.from(new Set(tasks.map((t) => t.type))).sort();
				MODALITIES = Array.from(new Set(tasks.map((t) => t.modality))).sort();
				typeFilter = new Set(TASK_TYPES);
				modalityFilter = new Set(MODALITIES);
				loadingData = false;
			} catch (e) {
				loadError = e instanceof Error ? e.message : String(e);
				loadingData = false;
			}
		})();
	});

	const SORTS = [
		{ id: 'name', label: 'Name' },
		{ id: 'type', label: 'Task type' },
		{ id: 'benchmarks', label: 'Benchmark count' },
		{ id: 'languages', label: 'Language count' }
	] as const;
	type SortId = (typeof SORTS)[number]['id'];

	let query = $state('');
	let typeFilter = $state<Set<string>>(new Set());
	let modalityFilter = $state<Set<string>>(new Set());
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
	function toggleAllTypes() {
		typeFilter = typeFilter.size === TASK_TYPES.length ? new Set() : new Set(TASK_TYPES);
	}
	let allTypes = $derived(typeFilter.size === TASK_TYPES.length);

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
			if (sort === 'type') {
				const t = a.type.localeCompare(b.type);
				return t !== 0 ? t : a.name.localeCompare(b.name);
			}
			if (sort === 'benchmarks') return b.benchmarks.length - a.benchmarks.length;
			if (sort === 'languages') return b.languages.length - a.languages.length;
			return 0;
		});
		return list;
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
			Every task across every benchmark, deduped by name. Click a card to see how each model
			performs on that task.
		</p>
	</header>

	{#if loadingData}
		<p class="empty">Loading tasks…</p>
	{:else if loadError}
		<p class="empty">Failed to load tasks: {loadError}</p>
	{:else}
	<div class="toolbar">
		<div class="row search-row">
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

		<div class="row filter-row">
			<div class="group">
				<div class="group-head">
					<span class="group-label">Type</span>
					<button type="button" class="link-btn" onclick={toggleAllTypes}>
						{allTypes ? 'Clear' : 'All'}
					</button>
				</div>
				<div class="pills">
					{#each TASK_TYPES as t (t)}
						<label class="pill type-pill" data-type={t}>
							<input
								type="checkbox"
								checked={typeFilter.has(t)}
								onchange={() => toggleType(t)}
							/>
							<span>{t}</span>
						</label>
					{/each}
				</div>
			</div>

			<div class="group">
				<div class="group-head">
					<span class="group-label">Modality</span>
				</div>
				<div class="pills">
					{#each MODALITIES as m (m)}
						<label class="pill modality-pill">
							<input
								type="checkbox"
								checked={modalityFilter.has(m)}
								onchange={() => toggleModality(m)}
							/>
							<span>{m}</span>
						</label>
					{/each}
				</div>
			</div>
		</div>
	</div>

	{#if filtered.length === 0}
		<p class="empty">No tasks match those filters.</p>
	{:else}
		<div class="grid" data-loaded>
			{#each filtered as t (t.name)}
				<a class="card" href="{base}/explorer/tasks/{slug(t.name)}" data-type={t.type}>
					<div class="card-head">
						<span class="title" title={t.name}>{t.name}</span>
						<span class="type-chip" data-type={t.type}>{t.type}</span>
					</div>
					<p class="desc">{t.description}</p>
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
				</a>
			{/each}
		</div>
	{/if}
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

	/* Toolbar -------------------------------------------------------------- */
	.toolbar {
		display: flex;
		flex-direction: column;
		gap: 14px;
		margin: 16px 0 18px;
		padding: 14px 16px;
		background: var(--surface);
		border: 1px solid var(--border);
		border-radius: 12px;
		box-shadow: var(--shadow-sm);
	}
	.row {
		display: flex;
		flex-wrap: wrap;
		gap: 16px 20px;
		align-items: center;
	}
	.row.filter-row {
		border-top: 1px solid var(--border);
		padding-top: 14px;
		gap: 8px 28px;
		align-items: flex-start;
	}
	.group {
		display: flex;
		flex-direction: column;
		gap: 6px;
		min-width: 0;
		flex: 1;
	}
	.group-head {
		display: flex;
		align-items: center;
		justify-content: space-between;
		gap: 8px;
	}
	.group-label {
		font-size: 11px;
		font-weight: 700;
		letter-spacing: 0.05em;
		text-transform: uppercase;
		color: var(--text-subtle);
	}
	.link-btn {
		background: none;
		border: none;
		color: var(--link);
		font-size: 11px;
		font-weight: 600;
		cursor: pointer;
		padding: 0 2px;
	}
	.link-btn:hover {
		text-decoration: underline;
	}

	.search {
		position: relative;
		flex: 1;
		min-width: 240px;
		max-width: 420px;
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
		padding: 8px 28px 8px 30px;
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
	}

	.sort {
		display: inline-flex;
		align-items: center;
		gap: 6px;
		font-size: 12px;
		color: var(--text-muted);
		margin-left: auto;
	}
	.sort select {
		padding: 6px 10px;
		border: 1px solid var(--border);
		border-radius: 6px;
		font-size: 12px;
		background: var(--surface);
		font-family: inherit;
		color: var(--text);
	}
	.count {
		font-size: 12px;
		color: var(--text-subtle);
		font-variant-numeric: tabular-nums;
	}

	/* Pills ---------------------------------------------------------------- */
	.pills {
		display: flex;
		flex-wrap: wrap;
		gap: 4px;
	}
	.pill {
		display: inline-flex;
		align-items: center;
		gap: 6px;
		padding: 5px 11px;
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
		font-weight: 600;
	}
	.modality-pill:has(input:checked) {
		background: var(--primary-soft);
		border-color: var(--primary);
		color: var(--primary-strong);
	}
	/* Per-task-type colors when a type pill is selected. */
	.type-pill[data-type='Classification']:has(input:checked) {
		background: #e8edff;
		border-color: #c4cef9;
		color: #2740b8;
	}
	.type-pill[data-type='Clustering']:has(input:checked) {
		background: #ffe6dc;
		border-color: #f7c4b2;
		color: #c0432e;
	}
	.type-pill[data-type='PairClassification']:has(input:checked) {
		background: #def7e9;
		border-color: #aedeb9;
		color: #1c7a4c;
	}
	.type-pill[data-type='Reranking']:has(input:checked) {
		background: #fff1d4;
		border-color: #f4d595;
		color: #a36100;
	}
	.type-pill[data-type='Retrieval']:has(input:checked) {
		background: #f2e7ff;
		border-color: #d5bff0;
		color: #6a32b1;
	}
	.type-pill[data-type='STS']:has(input:checked) {
		background: #ffdee9;
		border-color: #f4b5cd;
		color: #b41868;
	}
	.type-pill[data-type='BitextMining']:has(input:checked) {
		background: #dceefc;
		border-color: #b5d2ee;
		color: #1e6cc3;
	}
	.type-pill[data-type='InstructionReranking']:has(input:checked) {
		background: #fce4d6;
		border-color: #f4c5a8;
		color: #a04500;
	}
	.type-pill[data-type='MultilabelClassification']:has(input:checked) {
		background: #e0f5e9;
		border-color: #b4dec1;
		color: #2a7d4d;
	}
	.type-pill[data-type='Summarization']:has(input:checked) {
		background: #d8f3fe;
		border-color: #a5d8ea;
		color: #1c5d7a;
	}

	/* Cards ---------------------------------------------------------------- */
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
		gap: 10px;
		position: relative;
		overflow: hidden;
		text-decoration: none;
		color: inherit;
		transition:
			transform 0.12s ease,
			border-color 0.12s ease,
			box-shadow 0.12s ease;
	}
	.card:hover {
		transform: translateY(-1px);
		box-shadow: 0 8px 22px rgba(15, 23, 42, 0.08);
	}
	.card:focus-visible {
		outline: 2px solid var(--card-accent, var(--primary));
		outline-offset: 2px;
	}
	.card::before {
		content: '';
		position: absolute;
		top: 0;
		left: 0;
		right: 0;
		height: 3px;
		background: var(--card-accent, var(--border));
	}
	.card[data-type='Classification'] {
		--card-accent: #2740b8;
		background: linear-gradient(180deg, color-mix(in srgb, #e8edff 40%, white) 0%, var(--surface) 80px);
	}
	.card[data-type='Clustering'] {
		--card-accent: #c0432e;
		background: linear-gradient(180deg, color-mix(in srgb, #ffe6dc 40%, white) 0%, var(--surface) 80px);
	}
	.card[data-type='PairClassification'] {
		--card-accent: #1c7a4c;
		background: linear-gradient(180deg, color-mix(in srgb, #def7e9 40%, white) 0%, var(--surface) 80px);
	}
	.card[data-type='Reranking'] {
		--card-accent: #a36100;
		background: linear-gradient(180deg, color-mix(in srgb, #fff1d4 40%, white) 0%, var(--surface) 80px);
	}
	.card[data-type='Retrieval'] {
		--card-accent: #6a32b1;
		background: linear-gradient(180deg, color-mix(in srgb, #f2e7ff 40%, white) 0%, var(--surface) 80px);
	}
	.card[data-type='STS'] {
		--card-accent: #b41868;
		background: linear-gradient(180deg, color-mix(in srgb, #ffdee9 40%, white) 0%, var(--surface) 80px);
	}
	.card[data-type='BitextMining'] {
		--card-accent: #1e6cc3;
		background: linear-gradient(180deg, color-mix(in srgb, #dceefc 40%, white) 0%, var(--surface) 80px);
	}
	.card[data-type='InstructionReranking'] {
		--card-accent: #a04500;
		background: linear-gradient(180deg, color-mix(in srgb, #fce4d6 40%, white) 0%, var(--surface) 80px);
	}
	.card[data-type='MultilabelClassification'] {
		--card-accent: #2a7d4d;
		background: linear-gradient(180deg, color-mix(in srgb, #e0f5e9 40%, white) 0%, var(--surface) 80px);
	}
	.card[data-type='Summarization'] {
		--card-accent: #1c5d7a;
		background: linear-gradient(180deg, color-mix(in srgb, #d8f3fe 40%, white) 0%, var(--surface) 80px);
	}
	.card:hover {
		border-color: color-mix(in srgb, var(--card-accent) 50%, var(--border));
	}
	.card:hover .title {
		color: var(--card-accent, var(--primary-strong));
	}

	.card-head {
		display: flex;
		align-items: flex-start;
		justify-content: space-between;
		gap: 10px;
	}
	.desc {
		margin: 0;
		font-size: 12.5px;
		line-height: 1.45;
		color: var(--text-muted);
		display: -webkit-box;
		-webkit-line-clamp: 2;
		line-clamp: 2;
		-webkit-box-orient: vertical;
		overflow: hidden;
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

	.empty {
		text-align: center;
		color: var(--text-muted);
		padding: 40px;
		background: var(--surface);
		border: 1px solid var(--border);
		border-radius: 12px;
	}
</style>
