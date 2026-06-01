<script lang="ts">
	import { base } from '$app/paths';
	import { DEFAULT_BENCHMARK_NAME, loadSummary } from '$lib/data/service';
	import { filters } from '$lib/stores/filters.svelte';
	import FilterSidebar from '$lib/components/FilterSidebar.svelte';
	import ModelSearchBar from '$lib/components/ModelSearchBar.svelte';
	import type { ModelMeta } from '$lib/types';

	function slug(name: string): string {
		return encodeURIComponent(name);
	}

	let ALL_MODELS = $state<ModelMeta[]>([]);
	let loadingData = $state(true);
	let loadError = $state<string | null>(null);

	$effect(() => {
		loadSummary(DEFAULT_BENCHMARK_NAME)
			.then((s) => {
				ALL_MODELS = s.rows.map((r) => r.model);
				loadingData = false;
			})
			.catch((e) => {
				loadError = e instanceof Error ? e.message : String(e);
				loadingData = false;
			});
	});

	const SORTS = [
		{ id: 'name', label: 'Name' },
		{ id: 'params', label: 'Parameters' },
		{ id: 'released', label: 'Release date' }
	] as const;
	type SortId = (typeof SORTS)[number]['id'];
	let sort = $state<SortId>('params');

	// Apply the shared leaderboard filter store's predicates to a flat model
	// list. Same logic as applyFilters() in filters.svelte.ts, just minus the
	// benchmark-scope / sort / re-rank parts that only make sense for a
	// summary's rows.
	function passes(m: ModelMeta): boolean {
		const q = filters.nameQuery.trim().toLowerCase();
		if (
			q &&
			!m.name.toLowerCase().includes(q) &&
			!m.displayName.toLowerCase().includes(q) &&
			!m.org.toLowerCase().includes(q)
		)
			return false;
		if (filters.availability === 'open' && !m.openWeights) return false;
		if (filters.availability === 'proprietary' && m.openWeights) return false;
		if (filters.instructions === 'only_instruction' && !m.instructionTuned) return false;
		if (filters.instructions === 'only_non_instruction' && m.instructionTuned) return false;
		if (filters.sentenceTransformersOnly && !m.sentenceTransformersCompatible) return false;
		if (filters.modelTypes.size > 0 && !filters.modelTypes.has(m.modelType)) return false;
		if (m.totalParamsB > 0) {
			const paramsM = m.totalParamsB * 1000;
			if (paramsM < filters.minModelSizeM) return false;
			if (paramsM > filters.maxModelSizeM) return false;
		}
		return true;
	}

	let filtered = $derived.by(() => {
		const list = ALL_MODELS.filter(passes);
		list.sort((a, b) => {
			if (sort === 'name') return a.name.localeCompare(b.name);
			if (sort === 'params') {
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

<div class="app">
	<main class="main">
		<header class="hero">
			<h1>Models</h1>
			<p class="lead">
				Every model in the leaderboard with its architecture type, parameter count, embedding
				dimension, max context, and release date. Filters here share state with the leaderboard
				on every benchmark detail page.
			</p>
		</header>

		<div class="toolbar">
			<ModelSearchBar matchCount={filtered.length} totalCount={ALL_MODELS.length} />
			<div class="sort">
				<label for="sort-select">Sort by</label>
				<select id="sort-select" bind:value={sort}>
					{#each SORTS as s (s.id)}
						<option value={s.id}>{s.label}</option>
					{/each}
				</select>
			</div>
		</div>

		{#if loadingData}
			<p class="empty">Loading models…</p>
		{:else if loadError}
			<p class="empty">Failed to load models: {loadError}</p>
		{:else if filtered.length === 0}
			<p class="empty">No models match those filters.</p>
		{:else}
			<div class="grid">
				{#each filtered as m (m.name)}
					<a
						class="card"
						href="{base}/explorer/models/{slug(m.name)}"
						data-type={m.modelType}
						title={m.modelType}
					>
						<div class="card-head">
							<div class="title-wrap">
								<span class="title">
									<span class="org">{m.org}</span><span class="sep">/</span>{m.displayName}
								</span>
							</div>
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
					</a>
				{/each}
			</div>
		{/if}
	</main>

	<FilterSidebar hideScope />
</div>

<style>
	.app {
		display: flex;
		min-height: 100vh;
	}
	.main {
		flex: 1;
		min-width: 0;
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
		margin: 8px 0 18px;
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
	.card:focus-visible {
		outline: 2px solid var(--card-accent, var(--primary));
		outline-offset: 2px;
	}
	.card:hover {
		transform: translateY(-1px);
		box-shadow: 0 8px 22px rgba(15, 23, 42, 0.08);
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
	.card[data-type='dense'] {
		--card-accent: #2740b8;
		background: linear-gradient(180deg, color-mix(in srgb, #e8edff 40%, white) 0%, var(--surface) 80px);
	}
	.card[data-type='cross-encoder'] {
		--card-accent: #c0432e;
		background: linear-gradient(180deg, color-mix(in srgb, #ffe6dc 40%, white) 0%, var(--surface) 80px);
	}
	.card[data-type='late-interaction'] {
		--card-accent: #1c7a4c;
		background: linear-gradient(180deg, color-mix(in srgb, #def7e9 40%, white) 0%, var(--surface) 80px);
	}
	.card[data-type='sparse'] {
		--card-accent: #a36100;
		background: linear-gradient(180deg, color-mix(in srgb, #fff1d4 40%, white) 0%, var(--surface) 80px);
	}
	.card[data-type='router'] {
		--card-accent: #6a32b1;
		background: linear-gradient(180deg, color-mix(in srgb, #f2e7ff 40%, white) 0%, var(--surface) 80px);
	}
	.card:hover {
		border-color: color-mix(in srgb, var(--card-accent) 50%, var(--border));
	}

	.card-head {
		display: flex;
		align-items: flex-start;
		justify-content: space-between;
		gap: 10px;
	}
	.title-wrap {
		flex: 1;
		min-width: 0;
	}
	.title {
		display: block;
		font-size: 14px;
		font-weight: 700;
		color: var(--text);
		word-break: break-word;
	}
	.card:hover .title {
		color: var(--card-accent, var(--primary-strong));
	}
	.title .org {
		color: var(--text-subtle);
		font-weight: 400;
	}
	.title .sep {
		color: var(--border-strong);
		margin: 0 1px;
		font-weight: 400;
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

	.type-chip {
		flex: 0 0 auto;
		font-size: 10px;
		font-weight: 600;
		letter-spacing: 0.02em;
		padding: 3px 8px;
		border-radius: 999px;
		white-space: nowrap;
		text-transform: lowercase;
		background: color-mix(in srgb, var(--card-accent, var(--border)) 14%, white);
		color: var(--card-accent, var(--text-muted));
		border: 1px solid color-mix(in srgb, var(--card-accent, var(--border)) 35%, transparent);
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
