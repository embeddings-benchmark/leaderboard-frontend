<script lang="ts">
	import { resolve } from '$app/paths';
	import { goto } from '$app/navigation';
	import { SvelteSet } from 'svelte/reactivity';
	import { loadBenchmarkMenu } from '$lib/data/service';
	import { isBenchmark, type Benchmark, type MenuEntry } from '$lib/types';
	import { env } from '$env/dynamic/public';
	import MarkdownText from '$lib/components/MarkdownText.svelte';
	import CopyableId from '$lib/components/CopyableId.svelte';
	import ModalityIcon from '$lib/components/ModalityIcon.svelte';
	import ScrollToTopButton from '$lib/components/ScrollToTopButton.svelte';
	import SearchInput from '$lib/components/SearchInput.svelte';
	import ShareUrlButton from '$lib/components/ShareUrlButton.svelte';
	import SortDirIcon from '$lib/components/SortDirIcon.svelte';
	import { apiUrl, fmtCompact, humanizeType, isIconUrl, slug } from '$lib/format';
	import { getParam, updateUrl } from '$lib/url-state';

	// `/benchmarks` returns *every* benchmark, even those not on the curated
	// menu. We compare against the menu to call out which ones aren't reachable
	// from the explorer home.
	const API = env.PUBLIC_API_URL?.trim() ?? '';

	let allBenchmarks = $state<Benchmark[]>([]);
	const menuNames = new SvelteSet<string>();
	let loading = $state(true);
	let error = $state<string | null>(null);
	// Hydrate the search query from `?q=` so refresh / share keeps the
	// filtered view, and mirror every keystroke back to the URL.
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

	function fillFromMenu(entries: MenuEntry[]) {
		menuNames.clear();
		const walk = (m: MenuEntry) => {
			for (const c of m.children) {
				if (isBenchmark(c)) menuNames.add(c.name);
				else walk(c);
			}
		};
		entries.forEach(walk);
	}

	async function loadAll(): Promise<Benchmark[]> {
		if (!API) return []; // offline build — no all-list endpoint
		// include_hidden surfaces benchmarks with display_on_leaderboard=False
		// so the "Not on the menu" section is non-empty.
		const res = await fetch(`${API}/benchmarks?include_hidden=true`);
		if (!res.ok) throw new Error(`${res.status} ${res.statusText}`);
		return (await res.json()) as Benchmark[];
	}

	// Sidebar filter state — same shape as /tasks: each `*Filter` set
	// holds the *currently-checked* values. The corresponding `*_ALL`
	// array is the universe (every value present in the loaded
	// benchmarks). After the load effect lands, every set is seeded
	// with every value so the default state is "everything on" — and
	// `filteredAll` treats `size === ALL.length` as "filter off" so
	// benchmarks whose modality / type / domain list is empty don't
	// silently drop out of the default view.
	let MODALITIES = $state<string[]>([]);
	let TASK_TYPES = $state<string[]>([]);
	let DOMAINS = $state<string[]>([]);
	const modalityFilter = new SvelteSet<string>();
	const taskTypeFilter = new SvelteSet<string>();
	const domainFilter = new SvelteSet<string>();
	let sidebarCollapsed = $state(
		typeof window !== 'undefined' && window.matchMedia('(max-width: 640px)').matches
	);
	let taskTypeQuery = $state('');
	let domainQuery = $state('');
	let visibleTaskTypes = $derived.by(() => {
		const q = taskTypeQuery.trim().toLowerCase();
		return q ? TASK_TYPES.filter((t) => t.toLowerCase().includes(q)) : TASK_TYPES;
	});
	let visibleDomains = $derived.by(() => {
		const q = domainQuery.trim().toLowerCase();
		return q ? DOMAINS.filter((d) => d.toLowerCase().includes(q)) : DOMAINS;
	});

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
	let allModalities = $derived(modalityFilter.size === MODALITIES.length);
	let allTaskTypes = $derived(taskTypeFilter.size === TASK_TYPES.length);
	let allDomains = $derived(domainFilter.size === DOMAINS.length);

	$effect(() => {
		Promise.all([loadAll(), loadBenchmarkMenu()])
			.then(([list, menu]) => {
				allBenchmarks = list.sort((a, b) => a.displayName.localeCompare(b.displayName));
				fillFromMenu(menu);
				MODALITIES = Array.from(new Set(list.flatMap((b) => b.modalities ?? []))).sort();
				TASK_TYPES = Array.from(new Set(list.flatMap((b) => b.taskTypes ?? []))).sort();
				DOMAINS = Array.from(new Set(list.flatMap((b) => b.domains ?? []))).sort();
				for (const v of MODALITIES) modalityFilter.add(v);
				for (const v of TASK_TYPES) taskTypeFilter.add(v);
				for (const v of DOMAINS) domainFilter.add(v);
				loading = false;
			})
			.catch((e) => {
				error = e instanceof Error ? e.message : String(e);
				loading = false;
			});
	});

	// Single unified list: featured (on the curated explorer menu) first,
	// then non-menu benchmarks (older versions, specialised drops). The
	// `.card.other` styling still distinguishes them visually so users
	// can tell which ones are off-menu without a separate section.
	let filteredAll = $derived.by(() => {
		const q = query.trim().toLowerCase();
		// Bypass each filter when *all* of its chips are checked (the default
		// state) — without this, benchmarks whose modality/type/domain list
		// is empty drop out silently because `.some()` over `[]` is always
		// false. Same pattern as /tasks.
		const modalityOff = modalityFilter.size === MODALITIES.length;
		const taskTypeOff = taskTypeFilter.size === TASK_TYPES.length;
		const domainOff = domainFilter.size === DOMAINS.length;
		const matches = (b: Benchmark) => {
			if (q && !b.name.toLowerCase().includes(q) && !b.displayName.toLowerCase().includes(q))
				return false;
			if (
				!modalityOff &&
				modalityFilter.size > 0 &&
				!(b.modalities ?? []).some((m) => modalityFilter.has(m))
			)
				return false;
			if (
				!taskTypeOff &&
				taskTypeFilter.size > 0 &&
				!(b.taskTypes ?? []).some((t) => taskTypeFilter.has(t))
			)
				return false;
			if (
				!domainOff &&
				domainFilter.size > 0 &&
				!(b.domains ?? []).some((d) => domainFilter.has(d))
			)
				return false;
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
		const featured = allBenchmarks.filter((b) => menuNames.has(b.name) && matches(b)).sort(cmp);
		const other = allBenchmarks.filter((b) => !menuNames.has(b.name) && matches(b)).sort(cmp);
		return [...featured, ...other];
	});
</script>

<div class="app">
	<main class="main">
		<nav class="breadcrumb" aria-label="Breadcrumb">
			<a href={resolve('/')}>Home</a>
			<span class="sep">/</span>
			<span class="current">All benchmarks</span>
		</nav>

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
					<span class="hint">
						— faded cards aren't on the curated explorer menu (older versions or specialised drops).
						The "Newer version" tag links to the current replacement when there is one.
					</span>
				</header>
				<div class="grid">
					{#each filteredAll as b (b.name)}
						{@render benchmarkCard(b, !menuNames.has(b.name))}
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
					<div class="pills scroll">
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
					<div class="pills scroll">
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

{#snippet benchmarkCard(b: Benchmark, other: boolean)}
	{@const accentModality = b.modalities?.[0] ?? 'text'}
	<a
		class="card"
		class:other
		href={resolve('/benchmark/[name]', { name: slug(b.name) })}
		data-modality={accentModality}
	>
		<div class="card-head">
			{#if b.icon}
				{#if isIconUrl(b.icon)}
					<img class="card-icon" src={apiUrl(b.icon)} alt="" loading="lazy" />
				{:else}
					<span class="card-icon card-icon-text" aria-hidden="true">{b.icon}</span>
				{/if}
			{/if}
			<div class="card-titles">
				<span class="title" title={b.displayName}>{b.displayName}</span>
				<CopyableId value={b.name} ariaLabel="Copy benchmark id" />
			</div>
		</div>
		<p class="desc"><MarkdownText text={b.description} /></p>
		<dl class="stats">
			<div>
				<dt>Models</dt>
				<dd>{fmtCompact(b.numModels ?? 0)}</dd>
			</div>
			<div>
				<dt>Tasks</dt>
				<dd>{fmtCompact(b.tasks.length)}</dd>
			</div>
			<div>
				<dt>Languages</dt>
				<dd>{fmtCompact(b.languages.length)}</dd>
			</div>
			<div>
				<dt>Task types</dt>
				<dd>{fmtCompact(b.taskTypes.length)}</dd>
			</div>
		</dl>
		{#if b.newVersion && b.newVersion.length > 0}
			<!-- Whole note is clickable; navigates to the first newer version. -->
			<button
				type="button"
				class="newer-note"
				title="Open {b.newVersion[0]}"
				onclick={(e) => {
					e.stopPropagation();
					e.preventDefault();
					goto(resolve('/benchmark/[name]', { name: slug(b.newVersion![0]) }));
				}}
			>
				<span class="newer-label">Newer version</span>
				{#each b.newVersion as nv (nv)}
					<code class="newer-link">{nv}</code>
				{/each}
			</button>
		{/if}
		{#if b.modalities && b.modalities.length > 0}
			<div class="badges">
				{#each b.modalities as mod (mod)}
					<span class="badge modality-tint" data-modality={mod} title={mod}>
						<ModalityIcon modality={mod} size={12} />
						<span>{mod}</span>
					</span>
				{/each}
			</div>
		{/if}
	</a>
{/snippet}

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

	/* Sticky shelf — search + sort dock under the page header so the
	   controls stay reachable while the user scrolls the cards grid.
	   z-index sits below the page bar (10) so the bar wins on overlap.
	   --bar-bg + backdrop-blur ties the strip visually to the header. */
	.toolbar {
		display: flex;
		align-items: center;
		gap: 12px;
		margin: 18px 0;
		padding: 10px 12px;
		background: var(--bar-bg);
		backdrop-filter: blur(14px) saturate(140%);
		-webkit-backdrop-filter: blur(14px) saturate(140%);
		border: 1px solid var(--border);
		border-radius: 10px;
		box-shadow: var(--shadow-sm);
		position: sticky;
		top: var(--header-offset, 56px);
		z-index: 5;
	}
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
	.hint {
		font-size: 12px;
		color: var(--text-subtle);
		font-weight: 400;
	}

	.grid {
		display: grid;
		grid-template-columns: repeat(auto-fill, minmax(280px, 1fr));
		gap: 14px;
	}
	/* Card shape mirrors the /tasks overview cards exactly — flex column,
	   thin top-accent stripe via `::before`, soft gradient header tint
	   driven by `data-modality`. Keeps the two index surfaces visually
	   consistent so users learn one card pattern. */
	.card {
		position: relative;
		overflow: hidden;
		background: var(--surface);
		border: 1px solid var(--border);
		border-radius: 12px;
		padding: 14px 16px;
		display: flex;
		flex-direction: column;
		gap: 10px;
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
		border-color: color-mix(in srgb, var(--card-accent, var(--primary)) 50%, var(--border));
	}
	.card:hover .title {
		color: var(--card-accent, var(--primary-strong));
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
	/* Per-modality tint applied to the card's top 64 px header band.
	   Same colour pairs as the modality badges + filter pills so the
	   accent is legible at a glance: text=teal, image=blue,
	   audio=amber, video=purple. */
	.card[data-modality='text'] {
		--card-accent: var(--tint-teal-fg);
		background: linear-gradient(
			180deg,
			color-mix(in srgb, var(--tint-teal) 55%, var(--surface)) 0%,
			var(--surface) 64px
		);
	}
	.card[data-modality='image'] {
		--card-accent: var(--tint-blue-fg);
		background: linear-gradient(
			180deg,
			color-mix(in srgb, var(--tint-blue) 55%, var(--surface)) 0%,
			var(--surface) 64px
		);
	}
	.card[data-modality='audio'] {
		--card-accent: var(--tint-amber-fg);
		background: linear-gradient(
			180deg,
			color-mix(in srgb, var(--tint-amber) 55%, var(--surface)) 0%,
			var(--surface) 64px
		);
	}
	.card[data-modality='video'] {
		--card-accent: var(--tint-purple-fg);
		background: linear-gradient(
			180deg,
			color-mix(in srgb, var(--tint-purple) 55%, var(--surface)) 0%,
			var(--surface) 64px
		);
	}
	/* Off-menu (older versions, specialised drops) — fade the whole card
	   so the "featured" set still reads as primary. */
	.card.other {
		opacity: 0.72;
	}
	.card.other:hover {
		opacity: 1;
	}
	.card-head {
		display: flex;
		align-items: flex-start;
		gap: 10px;
	}
	.card-icon {
		width: 28px;
		height: 28px;
		flex-shrink: 0;
		border-radius: 4px;
		object-fit: contain;
		background: var(--surface-muted);
		margin-top: 1px;
	}
	.card-icon-text {
		display: inline-flex;
		align-items: center;
		justify-content: center;
		font-size: 18px;
		line-height: 1;
	}
	.card-titles {
		display: flex;
		flex-direction: column;
		align-items: flex-start;
		gap: 4px;
		min-width: 0;
		flex: 1;
	}
	.title {
		font-size: 14px;
		font-weight: 700;
		color: var(--text);
		overflow-wrap: anywhere;
		word-break: normal;
		line-height: 1.3;
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
	/* Pin the modality strip to the bottom of the card so the row
	   aligns across the grid regardless of how tall each card's stats
	   / description / newer-version note end up. The whitespace above
	   it grows into whichever card has less header content. */
	.badges {
		display: flex;
		flex-wrap: wrap;
		gap: 4px;
		margin-top: auto;
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
	.newer-note {
		display: inline-flex;
		flex-wrap: wrap;
		align-items: center;
		gap: 4px 6px;
		padding: 5px 9px;
		background: color-mix(in srgb, var(--primary-soft) 60%, transparent);
		border: 1px solid color-mix(in srgb, var(--primary) 25%, transparent);
		border-radius: 8px;
		font-size: 11px;
		color: var(--primary-strong);
		align-self: flex-start;
		cursor: pointer;
		text-align: left;
		font-family: inherit;
		transition:
			background 0.12s,
			border-color 0.12s;
	}
	.newer-note:hover {
		background: color-mix(in srgb, var(--primary) 18%, var(--surface));
		border-color: var(--primary);
	}
	.newer-note:focus-visible {
		outline: 2px solid var(--primary);
		outline-offset: 2px;
	}
	.newer-label {
		font-weight: 700;
		letter-spacing: 0.03em;
		text-transform: uppercase;
		font-size: 10px;
	}
	.newer-link {
		font-family: var(--font-mono);
		font-size: 11px;
		padding: 1px 6px;
		background: var(--surface);
		border-radius: 4px;
		color: var(--primary-strong);
	}
	/* Base `.muted` (color + margin: 0) lives in src/app.css. */
	.muted {
		padding: 20px 0;
	}

	/* Sidebar shell + pills — copied verbatim from /tasks so the two
	   index sidebars stay in lock-step (FilterSidebar's chassis on
	   /benchmark/[name] + /models is the third sibling). */
	.sidebar {
		flex: 0 0 340px;
		min-width: 320px;
		max-width: 380px;
		margin-left: auto;
		border-left: 1px solid var(--border);
		background: var(--surface);

		--header-offset: 64px;

		height: calc(100vh - var(--header-offset));
		position: sticky;
		top: var(--header-offset);
		overflow-y: auto;
		transition:
			flex-basis 0.18s ease,
			min-width 0.18s ease,
			max-width 0.18s ease;
	}
	.sidebar.collapsed {
		flex: 0 0 0;
		min-width: 0;
		max-width: none;
		width: 0;
		border-left: none;
		background: none;
		overflow: visible;
	}
	.sidebar-toggle {
		position: sticky;
		top: 0;
		display: flex;
		align-items: center;
		gap: 8px;
		width: 100%;
		padding: 10px 12px;
		background: var(--surface);
		border: none;
		border-bottom: 1px solid var(--border);
		font-size: 12px;
		font-weight: 600;
		color: var(--text-muted);
		cursor: pointer;
		z-index: 2;
	}
	.sidebar.collapsed .sidebar-toggle {
		position: relative;
		transform: translateX(-100%);
		margin-top: 56px;
		margin-right: 8px;
		padding: 6px 10px;
		width: auto;
		border: 1px solid var(--border);
		border-radius: 6px;
		background: var(--surface);
		box-shadow: var(--shadow-sm);
		z-index: 11;
	}
	.sidebar-toggle:hover {
		color: var(--text);
		background: var(--surface-muted);
	}
	.chev {
		display: inline-block;
		font-size: 18px;
		line-height: 1;
		transition: transform 0.18s ease;
		color: var(--text-subtle);
	}
	.chev.open {
		transform: rotate(180deg);
	}
	.toggle-label {
		text-transform: uppercase;
		letter-spacing: 0.06em;
	}
	.filters {
		display: flex;
		flex-direction: column;
		gap: 18px;
		padding: 14px 16px 24px;
	}
	.group {
		display: flex;
		flex-direction: column;
		gap: 6px;
		min-width: 0;
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
	.type-search {
		width: 100%;
		max-width: 320px;
		padding: 5px 9px;
		font-size: 12px;
		font-family: inherit;
		background: var(--surface);
		color: var(--text);
		border: 1px solid var(--border);
		border-radius: 6px;
	}
	.type-search:focus {
		outline: none;
		border-color: var(--primary);
		box-shadow: 0 0 0 3px var(--primary-soft);
	}
	.no-match {
		margin: 0;
		font-size: 12px;
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
	.pills {
		display: flex;
		flex-wrap: wrap;
		gap: 4px;
	}
	.pills.scroll {
		max-height: 320px;
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
		gap: 5px;
		padding: 5px 11px;
		font-size: 12px;
		background: var(--surface);
		border: 1px solid var(--border);
		border-radius: 999px;
		cursor: pointer;
		user-select: none;
	}
	.pill input {
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
	.pill:has(input:focus-visible) {
		outline: 2px solid var(--primary);
		outline-offset: 2px;
	}
	.type-fill,
	.modality-fill {
		color: var(--text-muted);
	}
	.type-fill {
		white-space: nowrap;
	}
	.type-fill:has(input:checked),
	.modality-fill:has(input:checked) {
		background: var(--primary-soft);
		border-color: var(--primary);
		color: var(--primary-strong);
	}
</style>
