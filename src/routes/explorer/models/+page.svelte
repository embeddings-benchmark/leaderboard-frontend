<script lang="ts">
	import { buildMockSummary } from '$lib/data/mockSummary';
	import { DEFAULT_BENCHMARK_NAME } from '$lib/data/mockBenchmarks';
	import type { ModelMeta, ModelType } from '$lib/types';

	// All mock models live in a single MOCK_MODELS list inside mockSummary. We pull
	// metadata via a default-benchmark summary to keep that module the source of truth.
	const ALL_MODELS: ModelMeta[] = buildMockSummary(DEFAULT_BENCHMARK_NAME).rows.map((r) => r.model);

	const MODEL_TYPES: ModelType[] = ['dense', 'cross-encoder', 'late-interaction', 'sparse', 'router'];
	const SORTS = [
		{ id: 'name', label: 'Name' },
		{ id: 'params', label: 'Params' },
		{ id: 'released', label: 'Release date' }
	] as const;
	type SortId = (typeof SORTS)[number]['id'];

	let query = $state('');
	let typeFilter = $state<Set<ModelType>>(new Set(MODEL_TYPES));
	let availability = $state<'all' | 'open' | 'proprietary'>('all');
	let sort = $state<SortId>('params');

	function toggleType(t: ModelType) {
		const next = new Set(typeFilter);
		if (next.has(t)) next.delete(t);
		else next.add(t);
		typeFilter = next;
	}

	let filtered = $derived.by(() => {
		const q = query.trim().toLowerCase();
		const list = ALL_MODELS.filter((m) => {
			if (q && !m.name.toLowerCase().includes(q) && !m.displayName.toLowerCase().includes(q))
				return false;
			if (typeFilter.size > 0 && !typeFilter.has(m.modelType)) return false;
			if (availability === 'open' && !m.openWeights) return false;
			if (availability === 'proprietary' && m.openWeights) return false;
			return true;
		});
		list.sort((a, b) => {
			if (sort === 'name') return a.name.localeCompare(b.name);
			if (sort === 'params') {
				// Push 0-param (unknown / proprietary) to the bottom of params sort.
				const aP = a.totalParamsB || -1;
				const bP = b.totalParamsB || -1;
				return bP - aP;
			}
			if (sort === 'released') {
				return (b.releaseDate ?? '').localeCompare(a.releaseDate ?? '');
			}
			return 0;
		});
		return list;
	});

	function fmtParams(b: number): string {
		if (!b) return '—';
		return b >= 1 ? `${b.toFixed(1)}B` : `${(b * 1000).toFixed(0)}M`;
	}
	function fmtInt(n: number): string {
		return n ? n.toLocaleString() : '—';
	}
</script>

<div class="page">
	<header class="hero">
		<h1>Models</h1>
		<p class="lead">
			Every model in the leaderboard with its architecture type, parameter count, embedding
			dimension, max context, and release date.
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
			<input type="search" placeholder="Search models by name…" bind:value={query} />
			{#if query}
				<button type="button" class="clear" onclick={() => (query = '')} aria-label="Clear">×</button>
			{/if}
		</div>

		<div class="pills" role="group" aria-label="Type">
			{#each MODEL_TYPES as t (t)}
				<label class="pill">
					<input
						type="checkbox"
						checked={typeFilter.has(t)}
						onchange={() => toggleType(t)}
					/>
					<span>{t}</span>
				</label>
			{/each}
		</div>

		<div class="pills" role="group" aria-label="Availability">
			<label class="pill">
				<input type="radio" name="avail" checked={availability === 'all'} onchange={() => (availability = 'all')} />
				<span>All</span>
			</label>
			<label class="pill">
				<input type="radio" name="avail" checked={availability === 'open'} onchange={() => (availability = 'open')} />
				<span>Open</span>
			</label>
			<label class="pill">
				<input type="radio" name="avail" checked={availability === 'proprietary'} onchange={() => (availability = 'proprietary')} />
				<span>Proprietary</span>
			</label>
		</div>

		<div class="sort">
			<label for="sort-select">Sort by</label>
			<select id="sort-select" bind:value={sort}>
				{#each SORTS as s (s.id)}
					<option value={s.id}>{s.label}</option>
				{/each}
			</select>
		</div>

		<span class="count">{filtered.length} / {ALL_MODELS.length}</span>
	</div>

	{#if filtered.length === 0}
		<p class="empty">No models match those filters.</p>
	{:else}
		<div class="grid">
			{#each filtered as m (m.name)}
				<article class="card">
					<div class="card-head">
						{#if m.url}
							<a class="title" href={m.url} target="_blank" rel="noreferrer">{m.displayName}</a>
						{:else}
							<span class="title">{m.displayName}</span>
						{/if}
						<span class="type-chip" data-type={m.modelType}>{m.modelType}</span>
					</div>
					<dl class="stats">
						<div>
							<dt>Params</dt>
							<dd>{fmtParams(m.totalParamsB)}</dd>
						</div>
						<div>
							<dt>Embed dim</dt>
							<dd>{fmtInt(m.embeddingDim)}</dd>
						</div>
						<div>
							<dt>Max tokens</dt>
							<dd>{fmtInt(m.maxTokens)}</dd>
						</div>
						<div>
							<dt>Released</dt>
							<dd>{m.releaseDate ?? '—'}</dd>
						</div>
					</dl>
					<div class="badges">
						<span class="badge" class:open={m.openWeights} class:closed={!m.openWeights}>
							{m.openWeights ? 'Open weights' : 'Proprietary'}
						</span>
						{#if m.instructionTuned}
							<span class="badge soft">Instruction-tuned</span>
						{/if}
						{#if m.sentenceTransformersCompatible}
							<span class="badge soft">ST compatible</span>
						{/if}
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
		padding: 0;
	}
	.clear:hover {
		color: var(--text);
		background: var(--surface-muted);
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
		gap: 10px;
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
		text-decoration: none;
		word-break: break-word;
	}
	a.title:hover {
		color: var(--primary-strong);
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
	}
	.type-chip[data-type='dense'] {
		background: #e8edff;
		color: #2740b8;
	}
	.type-chip[data-type='cross-encoder'] {
		background: #ffe6dc;
		color: #c0432e;
	}
	.type-chip[data-type='late-interaction'] {
		background: #def7e9;
		color: #1c7a4c;
	}
	.type-chip[data-type='sparse'] {
		background: #fff1d4;
		color: #a36100;
	}
	.type-chip[data-type='router'] {
		background: #f2e7ff;
		color: #6a32b1;
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
		font-weight: 600;
		font-variant-numeric: tabular-nums;
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
	.badge.open {
		background: #def7e9;
		color: #1c7a4c;
	}
	.badge.closed {
		background: var(--surface-muted);
		color: var(--text-muted);
	}
	.badge.soft {
		background: var(--surface-muted);
		color: var(--text-muted);
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
