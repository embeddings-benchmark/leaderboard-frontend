<script lang="ts">
	import { SvelteSet } from 'svelte/reactivity';
	import { loadBenchmarks } from '$lib/data/service';
	import type { Benchmark } from '$lib/types';
	import BenchmarkCard from '$lib/components/BenchmarkCard.svelte';
	import ShareMeta from '$lib/components/ShareMeta.svelte';
	import ModalityIcon from '$lib/components/ModalityIcon.svelte';
	import ScrollToTopButton from '$lib/components/ScrollToTopButton.svelte';
	import SearchInput from '$lib/components/SearchInput.svelte';
	import ShareUrlButton from '$lib/components/ShareUrlButton.svelte';
	import SortDirIcon from '$lib/components/SortDirIcon.svelte';
	import { humanizeType } from '$lib/format';
	import { getParam, updateUrl } from '$lib/url-state';

	let allBenchmarks = $state<Benchmark[]>([]);
	let loading = $state(true);
	let error = $state<string | null>(null);
	let query = $state(getParam('q') ?? '');

	const SORTS = [
		{ id: 'name', label: 'Name' },
		{ id: 'tasks', label: 'Task count' },
		{ id: 'languages', label: 'Language count' },
		{ id: 'models', label: 'Model count' }
	] as const;
	type SortId = (typeof SORTS)[number]['id'];
	type SortDir = 'asc' | 'desc';
	const NATURAL_DIR: Record<SortId, SortDir> = {
		name: 'asc',
		tasks: 'desc',
		languages: 'desc',
		models: 'desc'
	};
	const SORT_IDS = SORTS.map((s) => s.id) as readonly SortId[];
	const initialSort = getParam('sort');
	const initialDir = getParam('dir');
	const seedSort: SortId =
		initialSort && (SORT_IDS as readonly string[]).includes(initialSort)
			? (initialSort as SortId)
			: 'name';
	let sort = $state<SortId>(seedSort);
	let sortDir = $state<SortDir>(
		initialDir === 'asc' || initialDir === 'desc' ? initialDir : NATURAL_DIR[seedSort]
	);
	function onSortKeyChange(next: SortId) {
		sort = next;
		sortDir = NATURAL_DIR[next];
	}
	function toggleSortDir() {
		sortDir = sortDir === 'asc' ? 'desc' : 'asc';
	}
	$effect(() => {
		updateUrl({
			q: query.trim() || null,
			sort: sort === 'name' ? null : sort,
			dir: sortDir === NATURAL_DIR[sort] ? null : sortDir
		});
	});


	// Filter sets are seeded with every value so the default state is
	// "everything on"; `filteredAll` treats `size === ALL.length` as filter-off
	// so rows with empty modality / type / domain lists stay visible.
	let MODALITIES = $state<string[]>([]);
	let TASK_TYPES = $state<string[]>([]);
	let SIMPLIFIED_TYPES_PRESENT = $state<string[]>([]);
	let DOMAINS = $state<string[]>([]);
	let LANGUAGES = $state<string[]>([]);
	const modalityFilter = new SvelteSet<string>();
	const taskTypeFilter = new SvelteSet<string>();
	const simplifiedTypeFilter = new SvelteSet<string>();
	const domainFilter = new SvelteSet<string>();
	const languageFilter = new SvelteSet<string>();
	let sidebarCollapsed = $state(
		typeof window !== 'undefined' && window.matchMedia('(max-width: 640px)').matches
	);
	let taskTypeQuery = $state('');
	let domainQuery = $state('');
	let languageQuery = $state('');
	let languagesExpanded = $state(false);
	const LANGUAGE_CAP = 40;
	let visibleTaskTypes = $derived.by(() => {
		const q = taskTypeQuery.trim().toLowerCase();
		return q ? TASK_TYPES.filter((t) => t.toLowerCase().includes(q)) : TASK_TYPES;
	});
	let visibleDomains = $derived.by(() => {
		const q = domainQuery.trim().toLowerCase();
		return q ? DOMAINS.filter((d) => d.toLowerCase().includes(q)) : DOMAINS;
	});
	let filteredLanguages = $derived.by(() => {
		const q = languageQuery.trim().toLowerCase();
		return q ? LANGUAGES.filter((l) => l.toLowerCase().includes(q)) : LANGUAGES;
	});
	let visibleLanguages = $derived(
		languagesExpanded || filteredLanguages.length <= LANGUAGE_CAP
			? filteredLanguages
			: filteredLanguages.slice(0, LANGUAGE_CAP)
	);

	function toggleModality(m: string) {
		if (modalityFilter.has(m)) modalityFilter.delete(m);
		else modalityFilter.add(m);
	}
	function toggleTaskType(t: string) {
		if (taskTypeFilter.has(t)) taskTypeFilter.delete(t);
		else taskTypeFilter.add(t);
	}
	function toggleDomain(d: string) {
		if (domainFilter.has(d)) domainFilter.delete(d);
		else domainFilter.add(d);
	}
	function toggleAllModalities() {
		if (modalityFilter.size === MODALITIES.length) modalityFilter.clear();
		else for (const v of MODALITIES) modalityFilter.add(v);
	}
	function toggleAllTaskTypes() {
		if (taskTypeFilter.size === TASK_TYPES.length) taskTypeFilter.clear();
		else for (const v of TASK_TYPES) taskTypeFilter.add(v);
	}
	function toggleAllDomains() {
		if (domainFilter.size === DOMAINS.length) domainFilter.clear();
		else for (const v of DOMAINS) domainFilter.add(v);
	}
	function toggleSimplifiedType(t: string) {
		if (simplifiedTypeFilter.has(t)) simplifiedTypeFilter.delete(t);
		else simplifiedTypeFilter.add(t);
	}
	function toggleAllSimplifiedTypes() {
		if (simplifiedTypeFilter.size === SIMPLIFIED_TYPES_PRESENT.length)
			simplifiedTypeFilter.clear();
		else for (const v of SIMPLIFIED_TYPES_PRESENT) simplifiedTypeFilter.add(v);
	}
	function toggleLanguage(l: string) {
		if (languageFilter.has(l)) languageFilter.delete(l);
		else languageFilter.add(l);
	}
	function toggleAllLanguages() {
		if (languageFilter.size === LANGUAGES.length) languageFilter.clear();
		else for (const v of LANGUAGES) languageFilter.add(v);
	}
	let allModalities = $derived(modalityFilter.size === MODALITIES.length);
	let allTaskTypes = $derived(taskTypeFilter.size === TASK_TYPES.length);
	let allSimplifiedTypes = $derived(
		simplifiedTypeFilter.size === SIMPLIFIED_TYPES_PRESENT.length
	);
	let allDomains = $derived(domainFilter.size === DOMAINS.length);
	let allLanguages = $derived(languageFilter.size === LANGUAGES.length);

	$effect(() => {
		loadBenchmarks(true)
			.then((list) => {
				allBenchmarks = list.sort((a, b) => a.displayName.localeCompare(b.displayName));
				// Single pass over the catalog to fill all 3 facet sets, instead of
				// three separate flatMap+Set traversals. Plain Set is correct
				// here — used as a local accumulator, never read reactively.
				/* eslint-disable svelte/prefer-svelte-reactivity */
				const mods = new Set<string>();
				const types = new Set<string>();
				const simpTypes = new Set<string>();
				const doms = new Set<string>();
				const langs = new Set<string>();
				/* eslint-enable svelte/prefer-svelte-reactivity */
				for (const b of list) {
					if (b.modalities) for (const m of b.modalities) mods.add(m);
					if (b.taskTypes) for (const t of b.taskTypes) types.add(t);
					if (b.simplifiedTaskTypes) for (const t of b.simplifiedTaskTypes) simpTypes.add(t);
					if (b.domains) for (const d of b.domains) doms.add(d);
					if (b.languages) for (const l of b.languages) langs.add(l);
				}
				MODALITIES = [...mods].sort();
				TASK_TYPES = [...types].sort();
				// Order the simplified buckets the same way /tasks does (curated
				// canonical first, then any extras) so users see the familiar
				// "retrieval / classification / …" sequence.
				const CURATED = [
					'retrieval',
					'classification',
					'pair-classification',
					'clustering',
					'semantic-similarity'
				];
				SIMPLIFIED_TYPES_PRESENT = [
					...CURATED.filter((t) => simpTypes.has(t)),
					...[...simpTypes].filter((t) => !CURATED.includes(t)).sort()
				];
				DOMAINS = [...doms].sort();
				LANGUAGES = [...langs].sort();
				for (const v of MODALITIES) modalityFilter.add(v);
				for (const v of TASK_TYPES) taskTypeFilter.add(v);
				for (const v of SIMPLIFIED_TYPES_PRESENT) simplifiedTypeFilter.add(v);
				for (const v of DOMAINS) domainFilter.add(v);
				for (const v of LANGUAGES) languageFilter.add(v);
				loading = false;
			})
			.catch((e) => {
				error = e instanceof Error ? e.message : String(e);
				loading = false;
			});
	});

	// Featured (on the curated menu) come first, then off-menu benchmarks.
	let filteredAll = $derived.by(() => {
		const q = query.trim().toLowerCase();
		// "All on" = filter off; partial = intersection check; empty =
		// the user deliberately cleared the category, so nothing matches.
		const modalityOff = modalityFilter.size === MODALITIES.length;
		const taskTypeOff = taskTypeFilter.size === TASK_TYPES.length;
		const simplifiedOff = simplifiedTypeFilter.size === SIMPLIFIED_TYPES_PRESENT.length;
		const domainOff = domainFilter.size === DOMAINS.length;
		const languageOff = languageFilter.size === LANGUAGES.length;
		const matches = (b: Benchmark) => {
			if (q && !b.name.toLowerCase().includes(q) && !b.displayName.toLowerCase().includes(q))
				return false;
			if (!modalityOff && !(b.modalities ?? []).some((m) => modalityFilter.has(m))) return false;
			if (!taskTypeOff && !(b.taskTypes ?? []).some((t) => taskTypeFilter.has(t))) return false;
			if (
				!simplifiedOff &&
				!(b.simplifiedTaskTypes ?? []).some((t) => simplifiedTypeFilter.has(t))
			)
				return false;
			if (!domainOff && !(b.domains ?? []).some((d) => domainFilter.has(d))) return false;
			if (!languageOff && !(b.languages ?? []).some((l) => languageFilter.has(l))) return false;
			return true;
		};
		const dir = sortDir === 'asc' ? 1 : -1;
		const cmp = (a: Benchmark, b: Benchmark) => {
			let c = 0;
			if (sort === 'name') c = a.displayName.localeCompare(b.displayName);
			else if (sort === 'tasks') c = a.tasks.length - b.tasks.length;
			else if (sort === 'languages') c = a.languages.length - b.languages.length;
			else if (sort === 'models') c = (a.numModels ?? 0) - (b.numModels ?? 0);
			if (c === 0) c = a.displayName.localeCompare(b.displayName);
			return dir * c;
		};
		// Single pass: partition into featured / other while filtering.
		// "Featured" = `displayOnLeaderboard !== false` (the curated menu
		// set the backend returns when `include_hidden=true` flips the
		// flag for off-menu entries) — saves a second `/menu` round-trip
		// since this info is already on every Benchmark.
		const featured: Benchmark[] = [];
		const other: Benchmark[] = [];
		for (const b of allBenchmarks) {
			if (!matches(b)) continue;
			if (b.displayOnLeaderboard !== false) featured.push(b);
			else other.push(b);
		}
		featured.sort(cmp);
		other.sort(cmp);
		return [...featured, ...other];
	});
</script>

<ShareMeta
	title="All benchmarks"
	description={`Every benchmark registered in MTEB — ${allBenchmarks.length || '100+'} suites spanning multilingual, multimodal, retrieval, classification, clustering, semantic similarity, and domain-specific evaluations.`}
/>

<div class="app">
	<main class="main">
		<header class="hero">
			<h1>All benchmarks</h1>
			<p class="lead">
				Every benchmark registered in mteb — including ones that aren't on the curated explorer
				menu. Use the search box to find a benchmark by name.
			</p>
			<p class="contribute-note">
				To add your benchmark, follow our
				<a
					href="https://embeddings-benchmark.github.io/mteb/contributing/adding_a_benchmark/"
					target="_blank"
					rel="noreferrer">contributor guide</a
				>.
			</p>
		</header>

		<div class="toolbar">
			<SearchInput
				bind:value={query}
				placeholder="Search benchmarks…"
				ariaLabel="Search benchmarks"
			/>
			<div class="sort">
				<label for="sort-select">Sort by</label>
				<select
					id="sort-select"
					value={sort}
					onchange={(e) => onSortKeyChange((e.currentTarget as HTMLSelectElement).value as SortId)}
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
			<span class="count">
				{filteredAll.length} / {allBenchmarks.length}
			</span>
		</div>

		{#if loading}
			<p class="muted">Loading benchmarks…</p>
		{:else if error}
			<p class="muted">Failed to load: {error}</p>
		{:else if filteredAll.length === 0}
			<p class="muted">No benchmark matches that search.</p>
		{:else}
			<section class="block">
				<header class="block-head">
					<h2>Benchmarks</h2>
					<span class="count">{filteredAll.length}</span>
				</header>
				<div class="grid">
					{#each filteredAll as b (b.name)}
						<BenchmarkCard {b} />
					{/each}
				</div>
			</section>
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
						<button type="button" class="link-btn" onclick={toggleAllSimplifiedTypes}>
							{allSimplifiedTypes ? 'Clear' : 'All'}
						</button>
					</div>
					<!-- `type-fill` paints checked chips in the shared primary
					     tint (instead of the per-stype colour the /tasks page
					     uses). On /benchmarks the Task group sits next to the
					     other primary-tinted facets (Modality / Task type /
					     Domain), so matching their treatment keeps the sidebar
					     visually consistent. -->
					<div class="pills">
						{#each SIMPLIFIED_TYPES_PRESENT as t (t)}
							<label class="pill type-fill">
								<input
									type="checkbox"
									checked={simplifiedTypeFilter.has(t)}
									onchange={() => toggleSimplifiedType(t)}
								/>
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
						<button type="button" class="link-btn" onclick={toggleAllTaskTypes}>
							{allTaskTypes ? 'Clear' : 'All'}
						</button>
					</div>
					<input
						type="search"
						class="type-search"
						placeholder="Search task types…"
						bind:value={taskTypeQuery}
					/>
					<div class="pills scroll scroll-thin">
						{#each visibleTaskTypes as t (t)}
							<label class="pill type-fill" data-type={t}>
								<input
									type="checkbox"
									checked={taskTypeFilter.has(t)}
									onchange={() => toggleTaskType(t)}
								/>
								<span>{humanizeType(t)}</span>
							</label>
						{/each}
						{#if visibleTaskTypes.length === 0}
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

				<div class="group">
					<div class="group-head">
						<span class="group-label">Language</span>
						<button type="button" class="link-btn" onclick={toggleAllLanguages}>
							{allLanguages ? 'Clear' : 'All'}
						</button>
					</div>
					<input
						type="search"
						class="type-search"
						placeholder="Search languages…"
						bind:value={languageQuery}
					/>
					<!-- Cap collapsed; on expand we drop the .scroll wrapper so
					     the full language list flows in the sidebar and the
					     page scroll handles overflow. Same pattern as /tasks. -->
					<div class="pills" class:scroll={!languagesExpanded} class:scroll-thin={!languagesExpanded}>
						{#each visibleLanguages as l (l)}
							<label class="pill type-fill">
								<input
									type="checkbox"
									checked={languageFilter.has(l)}
									onchange={() => toggleLanguage(l)}
								/>
								<span>{l}</span>
							</label>
						{/each}
						{#if visibleLanguages.length === 0}
							<p class="muted no-match">No languages match.</p>
						{/if}
					</div>
					{#if filteredLanguages.length > LANGUAGE_CAP}
						<button
							type="button"
							class="link-btn show-more-btn"
							onclick={() => (languagesExpanded = !languagesExpanded)}
						>
							{languagesExpanded ? 'Show fewer' : `Show all ${filteredLanguages.length}`}
						</button>
					{/if}
				</div>
			</div>
		{/if}
	</aside>
</div>

<ScrollToTopButton />
<ShareUrlButton />

<style>
	/* Two-column layout — mirrors /tasks and /models. `.app` is the
	   page-level flex container so the sidebar can span the full viewport
	   height; `.main` carries the 1280 px max-width + the page padding
	   that used to live on `.page`. */
	.app {
		display: flex;
		min-height: 100vh;
	}
	.main {
		flex: 1;
		min-width: 0;
		max-width: 1280px;
		margin: 0 auto;
		padding: 18px 28px 64px;
	}
	/* `.breadcrumb`, `.breadcrumb a`, `.breadcrumb .sep`,
	   `.breadcrumb .current` live in src/app.css. */
	.hero {
		padding: 28px 0 18px;
		position: relative;
	}
	h1 {
		font-size: 32px;
		font-weight: 700;
		letter-spacing: -0.01em;
		line-height: 1.08;
		margin: 0 0 10px;
		color: var(--ink-strong);
	}
	.hero::before {
		content: '';
		position: absolute;
		top: 18px;
		left: 0;
		width: 32px;
		height: 3px;
		background: var(--primary);
		border-radius: 2px;
	}
	/* Base `.lead` (color + margin) lives in src/app.css. */
	.lead {
		font-size: 15px;
		line-height: 1.55;
	}

	/* `.toolbar` (sticky shell + mobile rules) is shared in src/app.css. */
	.count {
		font-size: 12px;
		color: var(--text-subtle);
		font-variant-numeric: tabular-nums;
	}

	.block {
		margin: 22px 0;
	}
	.block-head {
		display: flex;
		align-items: baseline;
		gap: 10px;
		margin-bottom: 12px;
		padding-bottom: 8px;
		border-bottom: 1px solid var(--border);
	}
	.block-head h2 {
		font-size: 18px;
		font-weight: 700;
		margin: 0;
	}
	.grid {
		display: grid;
		grid-template-columns: repeat(auto-fill, minmax(280px, 1fr));
		gap: 14px;
	}
	/* Base `.muted` (color + margin: 0) lives in src/app.css. */
	.muted {
		padding: 20px 0;
	}
</style>
