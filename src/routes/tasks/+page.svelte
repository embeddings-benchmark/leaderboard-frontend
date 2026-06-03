<script lang="ts">
	import { resolve } from '$app/paths';
	import { SvelteSet } from 'svelte/reactivity';
	import { loadBenchmarkMenu, loadTasks } from '$lib/data/service';
	import { isBenchmark, type Benchmark, type MenuEntry } from '$lib/types';
	import MarkdownText from '$lib/components/MarkdownText.svelte';
	import { humanizeType, slug } from '$lib/format';

	interface TaskEntry {
		name: string;
		type: string;
		simplifiedType: string;
		languages: string[];
		domains: string[];
		modalities: string[];
		description: string;
		benchmarks: string[];
	}

	// Order intentionally matches the colour palette below.
	const SIMPLIFIED_TYPES = [
		'retrieval',
		'classification',
		'pair-classification',
		'clustering',
		'semantic-similarity'
	] as const;

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
	let SIMPLIFIED_PRESENT = $state<string[]>([]);
	let FULL_TYPES_PRESENT = $state<string[]>([]);
	let MODALITIES = $state<string[]>([]);
	let loadingData = $state(true);
	let loadError = $state<string | null>(null);

	$effect(() => {
		(async () => {
			try {
				// /tasks returns the full mteb task registry (~1300), much larger
				// than any single benchmark's task list. Benchmark membership is
				// computed from the menu's per-benchmark `tasks` arrays.
				const [menu, tasks] = await Promise.all([loadBenchmarkMenu(), loadTasks()]);
				const allBenches = collectBenchmarks(menu);
				// Local accumulator for benchmark membership — plain Map is correct.
				// eslint-disable-next-line svelte/prefer-svelte-reactivity
				const occurrences = new Map<string, string[]>();
				for (const b of allBenches) {
					for (const t of b.tasks) {
						const list = occurrences.get(t) ?? [];
						list.push(b.name);
						occurrences.set(t, list);
					}
				}
				const entries: TaskEntry[] = tasks.map((m) => ({
					name: m.name,
					type: m.type,
					simplifiedType: m.simplifiedType ?? m.type?.toLowerCase() ?? '',
					languages: m.languages ?? [],
					domains: m.domains ?? [],
					// Defend against a stale browser-cached payload from before the
					// `modality: str` → `modalities: list[str]` schema change.
					modalities:
						m.modalities ??
						((m as unknown as { modality?: string }).modality
							? [(m as unknown as { modality: string }).modality]
							: []),
					description: m.description ?? '',
					benchmarks: occurrences.get(m.name) ?? []
				}));
				entries.sort((a, b) => a.name.localeCompare(b.name));
				ALL_TASKS = entries;
				const presentSet = new Set(entries.map((t) => t.simplifiedType));
				// Preserve the curated order from SIMPLIFIED_TYPES, then append
				// any extra simplified types that didn't make the curated list.
				SIMPLIFIED_PRESENT = [
					...SIMPLIFIED_TYPES.filter((t) => presentSet.has(t)),
					...[...presentSet].filter((t) => !SIMPLIFIED_TYPES.includes(t as never)).sort()
				];

				MODALITIES = Array.from(new Set(entries.flatMap((t) => t.modalities))).sort();
				FULL_TYPES_PRESENT = Array.from(new Set(entries.map((t) => t.type).filter(Boolean))).sort();
				for (const v of SIMPLIFIED_PRESENT) typeFilter.add(v);
				for (const v of FULL_TYPES_PRESENT) fullTypeFilter.add(v);
				for (const v of MODALITIES) modalityFilter.add(v);
				loadingData = false;
			} catch (e) {
				loadError = e instanceof Error ? e.message : String(e);
				loadingData = false;
			}
		})();
	});

	const SORTS = [
		{ id: 'name', label: 'Name' },
		{ id: 'type', label: 'Type' },
		{ id: 'benchmarks', label: 'Benchmark count' },
		{ id: 'languages', label: 'Language count' }
	] as const;
	type SortId = (typeof SORTS)[number]['id'];
	type SortDir = 'asc' | 'desc';
	const NATURAL_DIR: Record<SortId, SortDir> = {
		name: 'asc',
		type: 'asc',
		benchmarks: 'desc',
		languages: 'desc'
	};

	let query = $state('');
	const typeFilter = new SvelteSet<string>();
	const fullTypeFilter = new SvelteSet<string>();
	const modalityFilter = new SvelteSet<string>();
	let sort = $state<SortId>('name');
	let sortDir = $state<SortDir>(NATURAL_DIR.name);

	function onSortKeyChange(next: SortId) {
		sort = next;
		sortDir = NATURAL_DIR[next];
	}
	function toggleSortDir() {
		sortDir = sortDir === 'asc' ? 'desc' : 'asc';
	}

	function toggleType(t: string) {
		if (typeFilter.has(t)) typeFilter.delete(t);
		else typeFilter.add(t);
	}
	function toggleFullType(t: string) {
		if (fullTypeFilter.has(t)) fullTypeFilter.delete(t);
		else fullTypeFilter.add(t);
	}
	function toggleModality(m: string) {
		if (modalityFilter.has(m)) modalityFilter.delete(m);
		else modalityFilter.add(m);
	}
	function toggleAllTypes() {
		if (typeFilter.size === SIMPLIFIED_PRESENT.length) typeFilter.clear();
		else for (const v of SIMPLIFIED_PRESENT) typeFilter.add(v);
	}
	function toggleAllFullTypes() {
		if (fullTypeFilter.size === FULL_TYPES_PRESENT.length) fullTypeFilter.clear();
		else for (const v of FULL_TYPES_PRESENT) fullTypeFilter.add(v);
	}
	let allTypes = $derived(typeFilter.size === SIMPLIFIED_PRESENT.length);
	let allFullTypes = $derived(fullTypeFilter.size === FULL_TYPES_PRESENT.length);

	// Mobile-only collapse for the Task type strip. The full list runs
	// 30+ pills and used to scroll inside a fixed-height window that
	// fought page scroll; expose a "More" toggle instead and only
	// render the long tail when the user asks for it.
	let showAllFullTypes = $state(false);
	const FULL_TYPES_PREVIEW = 6;
	let visibleFullTypes = $derived(
		showAllFullTypes ? FULL_TYPES_PRESENT : FULL_TYPES_PRESENT.slice(0, FULL_TYPES_PREVIEW)
	);
	let hiddenFullTypeCount = $derived(Math.max(0, FULL_TYPES_PRESENT.length - FULL_TYPES_PREVIEW));

	// Rank within the curated palette so the "Type" sort groups cards by
	// colour bucket (retrieval first, then classification, …).
	const SIMPLIFIED_RANK: Record<string, number> = Object.fromEntries(
		SIMPLIFIED_TYPES.map((t, i) => [t, i])
	);
	function typeRank(t: string): number {
		return SIMPLIFIED_RANK[t] ?? SIMPLIFIED_TYPES.length;
	}

	let filtered = $derived.by(() => {
		const q = query.trim().toLowerCase();
		const list = ALL_TASKS.filter((t) => {
			if (q && !t.name.toLowerCase().includes(q)) return false;
			if (typeFilter.size > 0 && !typeFilter.has(t.simplifiedType)) return false;
			if (fullTypeFilter.size > 0 && !fullTypeFilter.has(t.type)) return false;
			if (modalityFilter.size > 0 && !(t.modalities ?? []).some((m) => modalityFilter.has(m)))
				return false;
			return true;
		});
		// Comparator always computes "ascending" cmp; sortDir flips at the end.
		// Tie-break by name stays stable across directions so identical rows
		// don't reshuffle when the user toggles the arrow.
		list.sort((a, b) => {
			let cmp: number;
			if (sort === 'name') {
				cmp = a.name.localeCompare(b.name);
			} else if (sort === 'type') {
				const r = typeRank(a.simplifiedType) - typeRank(b.simplifiedType);
				cmp = r !== 0 ? r : a.simplifiedType.localeCompare(b.simplifiedType);
			} else if (sort === 'benchmarks') {
				cmp = a.benchmarks.length - b.benchmarks.length;
			} else if (sort === 'languages') {
				cmp = a.languages.length - b.languages.length;
			} else {
				cmp = 0;
			}
			if (cmp === 0) return a.name.localeCompare(b.name);
			return sortDir === 'asc' ? cmp : -cmp;
		});
		return list;
	});
</script>

<div class="page">
	<header class="hero">
		<h1>Tasks</h1>
		<p class="lead">
			Every task across every benchmark, deduped by name. Click a card to see how each model
			performs on that task.
		</p>
		<p class="contribute-note">
			To add your task, follow our
			<a
				href="https://embeddings-benchmark.github.io/mteb/contributing/adding_a_dataset/"
				target="_blank"
				rel="noreferrer">contributor guide</a
			>.
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
						<button type="button" class="clear" onclick={() => (query = '')} aria-label="Clear"
							>×</button
						>
					{/if}
				</div>
				<div class="sort">
					<label for="sort-select">Sort by</label>
					<select
						id="sort-select"
						value={sort}
						onchange={(e) =>
							onSortKeyChange((e.currentTarget as HTMLSelectElement).value as SortId)}
					>
						{#each SORTS as s (s.id)}
							<option value={s.id}>{s.label}</option>
						{/each}
					</select>
					<button
						type="button"
						class="dir-btn"
						onclick={toggleSortDir}
						aria-label={sortDir === 'asc' ? 'Ascending' : 'Descending'}
						title={sortDir === 'asc'
							? 'Ascending (click for descending)'
							: 'Descending (click for ascending)'}
					>
						{sortDir === 'asc' ? '↑' : '↓'}
					</button>
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
						{#each SIMPLIFIED_PRESENT as t (t)}
							<label class="pill type-pill" data-stype={t}>
								<input type="checkbox" checked={typeFilter.has(t)} onchange={() => toggleType(t)} />
								<span>{t}</span>
							</label>
						{/each}
					</div>
				</div>

				<div class="group">
					<div class="group-head">
						<span class="group-label">Task type</span>
						<button type="button" class="link-btn" onclick={toggleAllFullTypes}>
							{allFullTypes ? 'Clear' : 'All'}
						</button>
					</div>
					<div class="pills scroll">
						{#each visibleFullTypes as t (t)}
							<label class="pill type-fill" data-type={t}>
								<input
									type="checkbox"
									checked={fullTypeFilter.has(t)}
									onchange={() => toggleFullType(t)}
								/>
								<span>{humanizeType(t)}</span>
							</label>
						{/each}
						{#if hiddenFullTypeCount > 0}
							<button
								type="button"
								class="pill more-btn"
								onclick={() => (showAllFullTypes = !showAllFullTypes)}
								aria-expanded={showAllFullTypes}
							>
								{showAllFullTypes ? 'Show less' : `+${hiddenFullTypeCount} more`}
							</button>
						{/if}
					</div>
				</div>

				<div class="group">
					<div class="group-head">
						<span class="group-label">Modality</span>
					</div>
					<div class="pills">
						{#each MODALITIES as m (m)}
							<label class="pill modality-fill" data-modality={m}>
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
					<a
						class="card"
						href={resolve('/tasks/[name]', { name: slug(t.name) })}
						data-stype={t.simplifiedType}
					>
						<div class="card-head">
							<span class="title" title={t.name}>{t.name}</span>
						</div>
						<p class="desc"><MarkdownText text={t.description} /></p>
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
								<dt>{t.modalities.length === 1 ? 'Modality' : 'Modalities'}</dt>
								<dd class="modality">{t.modalities.join(', ') || '—'}</dd>
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
						<div class="card-foot">
							<span class="type-chip" data-type={t.type} title={t.type}>{t.type}</span>
						</div>
					</a>
				{/each}
			</div>
		{/if}
	{/if}
</div>

<style>
	/* Base `.page` (1280 px centred, 18/28/56 padding) is in app.css. */
	.page {
		padding-top: 28px;
		padding-bottom: 64px;
	}
	.hero {
		padding: 24px 0 16px;
	}
	.hero h1 {
		font-size: 32px;
		margin: 0 0 10px;
		letter-spacing: -0.01em;
	}
	/* `.lead`, `.sort*`, `.dir-btn*` live in src/app.css — same
	   markup is on /models so the rules were exact duplicates. */

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
	/* The full-task-type filter has ~30+ chips; cap its height and scroll
	   internally so the toolbar doesn't push the cards grid down. */
	.pills.scroll {
		max-height: 96px;
		overflow-y: auto;
		padding-right: 4px;
		scrollbar-width: thin;
	}
	.pills.scroll::-webkit-scrollbar {
		width: 6px;
	}
	.pills.scroll::-webkit-scrollbar-thumb {
		background: var(--border-strong);
		border-radius: 3px;
	}
	.pill {
		display: inline-flex;
		align-items: center;
		padding: 5px 11px;
		font-size: 12px;
		background: var(--surface);
		border: 1px solid var(--border);
		border-radius: 999px;
		cursor: pointer;
		user-select: none;
	}
	/* "+N more" / "Show less" toggle inside the Task type strip. Same
	   chip shape but in the link colour so it doesn't read as a
	   filter pill the user might accidentally try to select. */
	.more-btn {
		color: var(--link);
		font-weight: 600;
		font-family: inherit;
	}
	.more-btn:hover {
		border-color: color-mix(in srgb, var(--link) 50%, var(--border));
	}
	/* Mobile: stack the three filter groups vertically. Side-by-side
	   on a 375 px viewport gave each group ~120 px of width, which
	   forced even short pills to wrap to one-per-row. Stacking lets
	   each group's pill strip flow horizontally with wrap, so the
	   Type and Modality groups end up ~1 row tall (≈ 50 px) and the
	   Task type group caps at a matching height with internal
	   scroll for the long tail. */
	@media (max-width: 640px) {
		.pill {
			padding: 8px 14px;
			font-size: 13px;
		}
		.row.filter-row {
			flex-direction: column;
			gap: 14px;
			align-items: stretch;
		}
		.group {
			flex: 0 0 auto;
		}
		/* No vertical scroll on mobile — the "More" button reveals the
		   hidden pills inline instead. */
		.pills.scroll {
			max-height: none;
			overflow: visible;
		}
	}
	.pill input {
		/* Hidden but still reachable for screen readers + keyboard.
		   The pill's `:has(input:checked)` styles do the visual
		   indication via background + border colour. */
		position: absolute;
		width: 1px;
		height: 1px;
		margin: -1px;
		padding: 0;
		border: 0;
		clip: rect(0 0 0 0);
		overflow: hidden;
		white-space: nowrap;
	}
	.pill:has(input:checked) {
		font-weight: 600;
	}
	/* The checkbox is visually hidden, so route its focus ring up to
	   the pill — otherwise keyboard users can't tell which pill is
	   active when tabbing. */
	.pill:has(input:focus-visible) {
		outline: 2px solid var(--primary);
		outline-offset: 2px;
	}
	/* Per-simplified-type colors when a type pill is selected. Theme-aware
	   via --tint-* — light in light mode, muted-dark in dark mode. */
	.type-pill[data-stype='retrieval']:has(input:checked) {
		background: var(--tint-purple);
		border-color: color-mix(in srgb, var(--tint-purple-fg) 35%, transparent);
		color: var(--tint-purple-fg);
	}
	.type-pill[data-stype='classification']:has(input:checked) {
		background: var(--tint-blue);
		border-color: color-mix(in srgb, var(--tint-blue-fg) 35%, transparent);
		color: var(--tint-blue-fg);
	}
	.type-pill[data-stype='pair-classification']:has(input:checked) {
		background: var(--tint-green);
		border-color: color-mix(in srgb, var(--tint-green-fg) 35%, transparent);
		color: var(--tint-green-fg);
	}
	.type-pill[data-stype='clustering']:has(input:checked) {
		background: var(--tint-orange);
		border-color: color-mix(in srgb, var(--tint-orange-fg) 35%, transparent);
		color: var(--tint-orange-fg);
	}
	.type-pill[data-stype='semantic-similarity']:has(input:checked) {
		background: var(--tint-pink);
		border-color: color-mix(in srgb, var(--tint-pink-fg) 35%, transparent);
		color: var(--tint-pink-fg);
	}

	/* Task type + Modality pills use the same plain theme-accent
	   treatment as the FilterContent sidebar — no per-category tints.
	   Keeps the filter row visually quieter and unified with the
	   existing model-filter UI. */
	.type-fill,
	.modality-fill {
		color: var(--text-muted);
	}
	/* Long full-type names (e.g. "Multilabel Classification") wrap to
	   two lines and make their pills visibly taller than the single-
	   line simplified-type pills. Force single-line so every chip in
	   the filter row has the same height. */
	.type-fill {
		white-space: nowrap;
	}
	.type-fill:has(input:checked),
	.modality-fill:has(input:checked) {
		background: var(--primary-soft);
		border-color: var(--primary);
		color: var(--primary-strong);
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
		box-shadow: 0 8px 22px rgb(15, 23, 42, 0.08);
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
	/* Per-stype cards: flat surface + thin top-accent bar (`.card::before`).
	   The 64px header tint is mixed against the actual surface so it's a
	   subtle wash in light mode and barely-there in dark. */
	.card[data-stype='retrieval'] {
		--card-accent: var(--tint-purple-fg);
		background: linear-gradient(
			180deg,
			color-mix(in srgb, var(--tint-purple) 55%, var(--surface)) 0%,
			var(--surface) 64px
		);
	}
	.card[data-stype='classification'] {
		--card-accent: var(--tint-blue-fg);
		background: linear-gradient(
			180deg,
			color-mix(in srgb, var(--tint-blue) 55%, var(--surface)) 0%,
			var(--surface) 64px
		);
	}
	.card[data-stype='pair-classification'] {
		--card-accent: var(--tint-green-fg);
		background: linear-gradient(
			180deg,
			color-mix(in srgb, var(--tint-green) 55%, var(--surface)) 0%,
			var(--surface) 64px
		);
	}
	.card[data-stype='clustering'] {
		--card-accent: var(--tint-orange-fg);
		background: linear-gradient(
			180deg,
			color-mix(in srgb, var(--tint-orange) 55%, var(--surface)) 0%,
			var(--surface) 64px
		);
	}
	.card[data-stype='semantic-similarity'] {
		--card-accent: var(--tint-pink-fg);
		background: linear-gradient(
			180deg,
			color-mix(in srgb, var(--tint-pink) 55%, var(--surface)) 0%,
			var(--surface) 64px
		);
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
		/* Long unbroken task names (e.g. XM3600T2IRetrieval) used to wrap
		   awkwardly because the only legal break point was at hyphens.
		   overflow-wrap: anywhere lets the browser break mid-camel-case so the
		   row keeps its rhythm. */
		overflow-wrap: anywhere;
		word-break: normal;
		flex: 1;
		min-width: 0;
		line-height: 1.3;
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
	.card-foot {
		display: flex;
		flex-wrap: wrap;
		gap: 4px;
		margin-top: auto;
		padding-top: 8px;
		border-top: 1px solid var(--border);
	}
	.type-chip {
		display: inline-block;
		padding: 3px 9px;
		font-size: 10px;
		font-weight: 700;
		letter-spacing: 0.03em;
		text-transform: uppercase;
		border-radius: 999px;
		background: var(--surface-muted);
		color: var(--text-muted);
		border: 1px solid var(--border);
	}
	/* All task-type chips key off the shared --tint-* palette so the chip
	   colors automatically swap between the light and dark variants. */
	.type-chip[data-type='Classification'] {
		background: var(--tint-blue);
		color: var(--tint-blue-fg);
		border-color: color-mix(in srgb, var(--tint-blue-fg) 35%, transparent);
	}
	.type-chip[data-type='Clustering'] {
		background: var(--tint-orange);
		color: var(--tint-orange-fg);
		border-color: color-mix(in srgb, var(--tint-orange-fg) 35%, transparent);
	}
	.type-chip[data-type='PairClassification'],
	.type-chip[data-type='MultilabelClassification'] {
		background: var(--tint-green);
		color: var(--tint-green-fg);
		border-color: color-mix(in srgb, var(--tint-green-fg) 35%, transparent);
	}
	.type-chip[data-type='Reranking'] {
		background: var(--tint-amber);
		color: var(--tint-amber-fg);
		border-color: color-mix(in srgb, var(--tint-amber-fg) 35%, transparent);
	}
	.type-chip[data-type='Retrieval'] {
		background: var(--tint-purple);
		color: var(--tint-purple-fg);
		border-color: color-mix(in srgb, var(--tint-purple-fg) 35%, transparent);
	}
	.type-chip[data-type='STS'] {
		background: var(--tint-pink);
		color: var(--tint-pink-fg);
		border-color: color-mix(in srgb, var(--tint-pink-fg) 35%, transparent);
	}
	.type-chip[data-type='BitextMining'] {
		background: var(--tint-azure);
		color: var(--tint-azure-fg);
		border-color: color-mix(in srgb, var(--tint-azure-fg) 35%, transparent);
	}
	.type-chip[data-type='InstructionReranking'] {
		background: var(--tint-orange);
		color: var(--tint-orange-fg);
		border-color: color-mix(in srgb, var(--tint-orange-fg) 35%, transparent);
	}
	.type-chip[data-type='Summarization'] {
		background: var(--tint-teal);
		color: var(--tint-teal-fg);
		border-color: color-mix(in srgb, var(--tint-teal-fg) 35%, transparent);
	}

	/* `.empty` lives in src/app.css. */
</style>
