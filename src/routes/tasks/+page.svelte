<script lang="ts">
	import { resolve } from '$app/paths';
	import { SvelteSet } from 'svelte/reactivity';
	import { loadBenchmarkMenu, loadTasks } from '$lib/data/service';
	import { safeIdle } from '$lib/idle';
	import { flattenMenu } from '$lib/types';
	import MarkdownText from '$lib/components/MarkdownText.svelte';
	import ModalityIcon from '$lib/components/ModalityIcon.svelte';
	import ScrollToTopButton from '$lib/components/ScrollToTopButton.svelte';
	import SearchInput from '$lib/components/SearchInput.svelte';
	import SortDirIcon from '$lib/components/SortDirIcon.svelte';
	import ShareUrlButton from '$lib/components/ShareUrlButton.svelte';
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
		numModels: number;
	}

	// Curated order — matches the `.type-pill[data-stype=…]` palette below.
	const SIMPLIFIED_TYPES = [
		'retrieval',
		'classification',
		'pair-classification',
		'clustering',
		'semantic-similarity'
	] as const;

	let ALL_TASKS = $state<TaskEntry[]>([]);
	let SIMPLIFIED_PRESENT = $state<string[]>([]);
	let FULL_TYPES_PRESENT = $state<string[]>([]);
	let MODALITIES = $state<string[]>([]);
	let DOMAINS = $state<string[]>([]);
	let loadingData = $state(true);
	let loadError = $state<string | null>(null);

	$effect(() => {
		(async () => {
			try {
				// /tasks returns the full task registry; we cross-reference the menu
				// to know which benchmarks each task appears in.
				const [menu, tasks] = await Promise.all([loadBenchmarkMenu(), loadTasks()]);
				const allBenches = flattenMenu(menu);
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
					// Fallback for the old `modality: str` payload shape.
					modalities:
						m.modalities ??
						((m as unknown as { modality?: string }).modality
							? [(m as unknown as { modality: string }).modality]
							: []),
					description: m.description ?? '',
					benchmarks: occurrences.get(m.name) ?? [],
					numModels: m.numModels ?? 0
				}));
				entries.sort((a, b) => a.name.localeCompare(b.name));
				ALL_TASKS = entries;
				const presentSet = new Set(entries.map((t) => t.simplifiedType));
				// Curated order first, then any extras alphabetised.
				SIMPLIFIED_PRESENT = [
					...SIMPLIFIED_TYPES.filter((t) => presentSet.has(t)),
					...[...presentSet].filter((t) => !SIMPLIFIED_TYPES.includes(t as never)).sort()
				];

				MODALITIES = Array.from(new Set(entries.flatMap((t) => t.modalities))).sort();
				FULL_TYPES_PRESENT = Array.from(new Set(entries.map((t) => t.type).filter(Boolean))).sort();
				DOMAINS = Array.from(new Set(entries.flatMap((t) => t.domains))).sort();
				for (const v of SIMPLIFIED_PRESENT) typeFilter.add(v);
				for (const v of FULL_TYPES_PRESENT) fullTypeFilter.add(v);
				for (const v of MODALITIES) modalityFilter.add(v);
				for (const v of DOMAINS) domainFilter.add(v);
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
		{ id: 'languages', label: 'Language count' },
		{ id: 'models', label: 'Models evaluated' }
	] as const;
	type SortId = (typeof SORTS)[number]['id'];
	type SortDir = 'asc' | 'desc';
	const NATURAL_DIR: Record<SortId, SortDir> = {
		name: 'asc',
		type: 'asc',
		benchmarks: 'desc',
		languages: 'desc',
		models: 'desc'
	};

	let query = $state('');
	const typeFilter = new SvelteSet<string>();
	const fullTypeFilter = new SvelteSet<string>();
	const modalityFilter = new SvelteSet<string>();
	const domainFilter = new SvelteSet<string>();

	// Start collapsed on narrow viewports where the drawer would overlap content.
	let sidebarCollapsed = $state(
		typeof window !== 'undefined' && window.matchMedia('(max-width: 640px)').matches
	);
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
	function toggleDomain(d: string) {
		if (domainFilter.has(d)) domainFilter.delete(d);
		else domainFilter.add(d);
	}
	function toggleAllTypes() {
		if (typeFilter.size === SIMPLIFIED_PRESENT.length) typeFilter.clear();
		else for (const v of SIMPLIFIED_PRESENT) typeFilter.add(v);
	}
	function toggleAllFullTypes() {
		if (fullTypeFilter.size === FULL_TYPES_PRESENT.length) fullTypeFilter.clear();
		else for (const v of FULL_TYPES_PRESENT) fullTypeFilter.add(v);
	}
	function toggleAllDomains() {
		if (domainFilter.size === DOMAINS.length) domainFilter.clear();
		else for (const v of DOMAINS) domainFilter.add(v);
	}
	function toggleAllModalities() {
		if (modalityFilter.size === MODALITIES.length) modalityFilter.clear();
		else for (const v of MODALITIES) modalityFilter.add(v);
	}
	let allTypes = $derived(typeFilter.size === SIMPLIFIED_PRESENT.length);
	let allFullTypes = $derived(fullTypeFilter.size === FULL_TYPES_PRESENT.length);
	let allDomains = $derived(domainFilter.size === DOMAINS.length);
	let allModalities = $derived(modalityFilter.size === MODALITIES.length);

	let domainQuery = $state('');
	let visibleDomains = $derived.by(() => {
		const q = domainQuery.trim().toLowerCase();
		if (!q) return DOMAINS;
		return DOMAINS.filter((d) => d.toLowerCase().includes(q));
	});

	let fullTypeQuery = $state('');
	let visibleFullTypes = $derived.by(() => {
		const q = fullTypeQuery.trim().toLowerCase();
		if (!q) return FULL_TYPES_PRESENT;
		// Match the raw CamelCase id and the humanised form so "BitextMining"
		// and "bitext" both hit.
		return FULL_TYPES_PRESENT.filter(
			(t) => t.toLowerCase().includes(q) || humanizeType(t).toLowerCase().includes(q)
		);
	});

	const SIMPLIFIED_RANK: Record<string, number> = Object.fromEntries(
		SIMPLIFIED_TYPES.map((t, i) => [t, i])
	);
	function typeRank(t: string): number {
		return SIMPLIFIED_RANK[t] ?? SIMPLIFIED_TYPES.length;
	}

	// Split filter / sort so name-query keystrokes only re-run the cheap
	// filter pass; the sort only re-runs when sort key/dir or the matched
	// set identity changes.
	let matched = $derived.by(() => {
		const q = query.trim().toLowerCase();
		// Filters with every chip checked are bypassed so rows with empty
		// modality / domain / type lists stay visible (`[].some(...)` is false).
		const typeOff = typeFilter.size === SIMPLIFIED_PRESENT.length;
		const fullTypeOff = fullTypeFilter.size === FULL_TYPES_PRESENT.length;
		const modalityOff = modalityFilter.size === MODALITIES.length;
		const domainOff = domainFilter.size === DOMAINS.length;
		return ALL_TASKS.filter((t) => {
			if (q && !t.name.toLowerCase().includes(q)) return false;
			if (!typeOff && typeFilter.size > 0 && !typeFilter.has(t.simplifiedType)) return false;
			if (!fullTypeOff && fullTypeFilter.size > 0 && !fullTypeFilter.has(t.type)) return false;
			if (
				!modalityOff &&
				modalityFilter.size > 0 &&
				!(t.modalities ?? []).some((m) => modalityFilter.has(m))
			)
				return false;
			if (
				!domainOff &&
				domainFilter.size > 0 &&
				!(t.domains ?? []).some((d) => domainFilter.has(d))
			)
				return false;
			return true;
		});
	});
	let filtered = $derived.by(() => {
		const list = [...matched];
		// Comparator computes ascending cmp; sortDir flips at the end. Name
		// tie-break stays stable so equal rows don't reshuffle on direction toggle.
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
			} else if (sort === 'models') {
				cmp = a.numModels - b.numModels;
			} else {
				cmp = 0;
			}
			if (cmp === 0) return a.name.localeCompare(b.name);
			return sortDir === 'asc' ? cmp : -cmp;
		});
		return list;
	});

	// Progressive render: paint the first chunk synchronously so the user
	// sees content within one frame, then push the rest in idle slots so
	// the heavy DOM creation never blocks the initial paint. The effect
	// fires on every `filtered.length` change — including the rapid burst
	// of filter-set seeding during data load. We coalesce restarts with a
	// 80 ms debounce so a storm of mutations doesn't permanently reset
	// the grow chain to its initial chunk.
	const INITIAL_CHUNK = 60;
	const CHUNK_STEP = 200;
	let visibleCount = $state(INITIAL_CHUNK);
	let growVersion = 0;
	let lastFilteredSignature = '';
	let kickoffTimer: ReturnType<typeof setTimeout> | null = null;
	$effect(() => {
		const total = filtered.length;
		// Signature = length + first/last row name. Catches all real filter
		// changes (count change OR same count but different rows from sort)
		// while letting our own writes to `visibleCount` re-fire the effect
		// harmlessly (signature unchanged → bail, chain keeps growing).
		const signature = `${total}|${filtered[0]?.name ?? ''}|${filtered[total - 1]?.name ?? ''}`;
		if (signature === lastFilteredSignature) return;
		lastFilteredSignature = signature;
		const myVersion = ++growVersion;
		visibleCount = Math.min(INITIAL_CHUNK, total);
		if (visibleCount >= total) return;
		if (kickoffTimer) clearTimeout(kickoffTimer);
		kickoffTimer = setTimeout(() => {
			kickoffTimer = null;
			if (myVersion !== growVersion) return;
			const grow = () => {
				if (myVersion !== growVersion) return;
				visibleCount = Math.min(visibleCount + CHUNK_STEP, total);
				if (visibleCount < total) safeIdle(grow);
			};
			safeIdle(grow);
		}, 80);
	});
	let visibleTasks = $derived(filtered.slice(0, visibleCount));
</script>

<div class="app">
	<main class="main">
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
				>. Already have model scores? See the
				<a
					href="https://embeddings-benchmark.github.io/mteb/contributing/submitting_results/"
					target="_blank"
					rel="noreferrer">submitting results guide</a
				>.
			</p>
		</header>

		{#if loadingData}
			<p class="empty">Loading tasks…</p>
		{:else if loadError}
			<p class="empty">Failed to load tasks: {loadError}</p>
		{:else}
			<div class="toolbar">
				<SearchInput
					bind:value={query}
					placeholder="Search tasks by name…"
					ariaLabel="Search tasks"
				/>
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
						<SortDirIcon dir={sortDir} />
					</button>
				</div>
				<span class="count">{filtered.length} / {ALL_TASKS.length}</span>
			</div>

			{#if filtered.length === 0}
				<p class="empty">No tasks match those filters.</p>
			{:else}
				<div class="grid" data-loaded>
					{#each visibleTasks as t (t.name)}
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
									<dt>Models evaluated</dt>
									<dd>{t.numModels}</dd>
								</div>
							</dl>
							{#if t.modalities.length > 0}
								<div class="badges">
									{#each t.modalities as mod (mod)}
										<span class="badge modality-tint" data-modality={mod} title={mod}>
											<ModalityIcon modality={mod} size={12} />
											<span>{mod}</span>
										</span>
									{/each}
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
	</main>

	<aside class="sidebar" class:collapsed={sidebarCollapsed} aria-label="Filters">
		<button
			type="button"
			class="sidebar-toggle"
			onclick={() => (sidebarCollapsed = !sidebarCollapsed)}
			aria-expanded={!sidebarCollapsed}
			title={sidebarCollapsed ? 'Expand filters' : 'Collapse filters'}
		>
			<span class="chev" class:open={!sidebarCollapsed}>‹</span>
			{#if !sidebarCollapsed}
				<span class="toggle-label">Filters</span>
			{/if}
		</button>

		{#if !sidebarCollapsed}
			<div class="filters">
				<div class="group">
					<div class="group-head">
						<span class="group-label">Task group</span>
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
						<span class="group-label">Modality</span>
						<button type="button" class="link-btn" onclick={toggleAllModalities}>
							{allModalities ? 'Clear' : 'All'}
						</button>
					</div>
					<div class="pills">
						{#each MODALITIES as m (m)}
							<label class="pill modality-fill">
								<input
									type="checkbox"
									checked={modalityFilter.has(m)}
									onchange={() => toggleModality(m)}
								/>
								<ModalityIcon modality={m} size={12} />
								<span>{m}</span>
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
					<input
						type="search"
						class="type-search"
						placeholder="Search task types…"
						bind:value={fullTypeQuery}
					/>
					<div class="pills scroll scroll-thin">
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
						{#if visibleFullTypes.length === 0}
							<p class="muted no-match">No task types match.</p>
						{/if}
					</div>
				</div>

				<div class="group">
					<div class="group-head">
						<span class="group-label">Domain</span>
						<button type="button" class="link-btn" onclick={toggleAllDomains}>
							{allDomains ? 'Clear' : 'All'}
						</button>
					</div>
					<input
						type="search"
						class="type-search"
						placeholder="Search domains…"
						bind:value={domainQuery}
					/>
					<div class="pills scroll scroll-thin">
						{#each visibleDomains as d (d)}
							<label class="pill type-fill">
								<input
									type="checkbox"
									checked={domainFilter.has(d)}
									onchange={() => toggleDomain(d)}
								/>
								<span>{d}</span>
							</label>
						{/each}
						{#if visibleDomains.length === 0}
							<p class="muted no-match">No domains match.</p>
						{/if}
					</div>
				</div>
			</div>
		{/if}
	</aside>
</div>

<ScrollToTopButton />
<ShareUrlButton />

<style>
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
	/* Toolbar is now just a single search-row strip — the four filter
	   groups have moved into the right-hand sidebar (`.sidebar`) to
	   mirror the /models layout. */
	/* Sticky shelf — matches /benchmarks and /models. */
	/* `.toolbar` (sticky shell + mobile rules) is shared in src/app.css. */
	/* Two-column layout: cards on the left, filters in the sticky
	   sidebar on the right — same shape as `/models`. `.app` is the
	   page-level flex container so the sidebar spans the full viewport
	   height (not just the cards section). `.main` carries the
	   1280 px max-width + page padding that used to live on `.page`. */
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
	/* Sidebar shell + pills + filter pills live in $lib/styles/sidebar.css.
	   Only the per-simplified-type colour overrides for the Task-group
	   pills are local to this page. */
	.count {
		font-size: 12px;
		color: var(--text-subtle);
		font-variant-numeric: tabular-nums;
	}

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
		/* `content-visibility: auto` lets the browser skip rendering off-screen
		   cards (1759 entries on the full registry). `contain-intrinsic-size`
		   reserves placeholder space so the scrollbar geometry stays stable. */
		content-visibility: auto;
		contain-intrinsic-size: 280px;
	}
	.card:hover {
		transform: translateY(-1px);
		box-shadow: 0 8px 22px rgb(var(--shadow-tint) / 0.08);
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
	.badges {
		display: flex;
		flex-wrap: wrap;
		gap: 4px;
	}
	.badge {
		display: inline-flex;
		align-items: center;
		gap: 4px;
		font-size: 10px;
		padding: 3px 8px;
		border-radius: 999px;
		font-weight: 600;
		letter-spacing: 0.02em;
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
