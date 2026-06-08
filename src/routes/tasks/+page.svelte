<script lang="ts">
	import { SvelteSet } from 'svelte/reactivity';
	import { loadBenchmarkMenu, loadTasks } from '$lib/data/service';
	import { safeIdle } from '$lib/idle';
	import { flattenMenu } from '$lib/types';
	import FilterFacet from '$lib/components/FilterFacet.svelte';
	import FilterSidebar from '$lib/components/FilterSidebar.svelte';
	import ModalityIcon from '$lib/components/ModalityIcon.svelte';
	import ScrollToTopButton from '$lib/components/ScrollToTopButton.svelte';
	import ShareMeta from '$lib/components/ShareMeta.svelte';
	import TaskCard from '$lib/components/TaskCard.svelte';
	import SearchInput from '$lib/components/SearchInput.svelte';
	import SkeletonGrid from '$lib/components/SkeletonGrid.svelte';
	import SortDirIcon from '$lib/components/SortDirIcon.svelte';
	import { COLLATOR } from '$lib/format';
	import { getParam, updateUrl } from '$lib/url-state';
	import ShareUrlButton from '$lib/components/ShareUrlButton.svelte';

	interface TaskEntry {
		name: string;
		// Lowercased name cached at load — the name-search keystroke filter
		// runs 1700x per recompute, so a per-entry `.toLowerCase()` would
		// allocate 1700 strings per stroke. Memoised once here.
		nameLower: string;
		type: string;
		simplifiedType: string;
		languages: string[];
		domains: string[];
		modalities: string[];
		description: string;
		benchmarks: string[];
		mainScore: string;
		// Distinct models evaluated on this task — backend overlay from the
		// unified results frame. `0` for tasks the cache hasn't filled in.
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
	let MODALITIES = $state<string[]>([]);
	let DOMAINS = $state<string[]>([]);
	let LANGUAGES = $state<string[]>([]);
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
				// Build entries + extract every facet in one pass over the
				// 1700+ task registry. The original code ran four separate
				// `flatMap()` passes (one per facet), each allocating a fresh
				// intermediate array; this fuses them into a single walk.
				// eslint-disable-next-line svelte/prefer-svelte-reactivity
				const modSet = new Set<string>();
				// eslint-disable-next-line svelte/prefer-svelte-reactivity
				const domSet = new Set<string>();
				// Count per language so the filter pills sort by popularity.
				// eslint-disable-next-line svelte/prefer-svelte-reactivity
				const langCount = new Map<string, number>();
				// eslint-disable-next-line svelte/prefer-svelte-reactivity
				const presentSet = new Set<string>();
				const entries: TaskEntry[] = new Array(tasks.length);
				for (let i = 0; i < tasks.length; i++) {
					const m = tasks[i];
					const simplifiedType = m.simplifiedType ?? m.type?.toLowerCase() ?? '';
					const modalities =
						m.modalities ??
						((m as unknown as { modality?: string }).modality
							? [(m as unknown as { modality: string }).modality]
							: []);
					const languages = m.languages ?? [];
					const domains = m.domains ?? [];
					entries[i] = {
						name: m.name,
						nameLower: m.name.toLowerCase(),
						type: m.type,
						simplifiedType,
						languages,
						domains,
						modalities,
						description: m.description ?? '',
						benchmarks: occurrences.get(m.name) ?? [],
						mainScore: m.mainScore ?? '',
						numModels: m.numModels ?? 0
					};
					presentSet.add(simplifiedType);
					for (const x of modalities) modSet.add(x);
					for (const x of domains) domSet.add(x);
					for (const x of languages) langCount.set(x, (langCount.get(x) ?? 0) + 1);
				}
				entries.sort((a, b) => COLLATOR.compare(a.name, b.name));
				ALL_TASKS = entries;
				// Curated order first, then any extras alphabetised.
				SIMPLIFIED_PRESENT = [
					...SIMPLIFIED_TYPES.filter((t) => presentSet.has(t)),
					...[...presentSet].filter((t) => !SIMPLIFIED_TYPES.includes(t as never)).sort()
				];

				MODALITIES = [...modSet].sort();
				DOMAINS = [...domSet].sort();
				// Descending by usage count, alphabetical tie-break.
				LANGUAGES = [...langCount.entries()]
					.sort((a, b) => b[1] - a[1] || COLLATOR.compare(a[0], b[0]))
					.map(([l]) => l);
				for (const v of SIMPLIFIED_PRESENT) typeFilter.add(v);
				for (const v of MODALITIES) modalityFilter.add(v);
				for (const v of DOMAINS) domainFilter.add(v);
				for (const v of LANGUAGES) languageFilter.add(v);
				loadingData = false;
			} catch (e) {
				loadError = e instanceof Error ? e.message : String(e);
				loadingData = false;
			}
		})();
	});

	const SORTS = [
		{ id: 'models', label: 'Model count' },
		{ id: 'name', label: 'Name' },
		{ id: 'type', label: 'Type' },
		{ id: 'benchmarks', label: 'Benchmark count' },
		{ id: 'languages', label: 'Language count' },
		{ id: 'metric', label: 'Main metric' }
	] as const;
	type SortId = (typeof SORTS)[number]['id'];
	type SortDir = 'asc' | 'desc';
	const NATURAL_DIR: Record<SortId, SortDir> = {
		models: 'desc',
		name: 'asc',
		type: 'asc',
		benchmarks: 'desc',
		languages: 'desc',
		metric: 'asc'
	};

	let query = $state('');
	const typeFilter = new SvelteSet<string>();
	const modalityFilter = new SvelteSet<string>();
	const domainFilter = new SvelteSet<string>();
	const languageFilter = new SvelteSet<string>();

	// URL-backed sort (`?s.tasks=…&d.tasks=…`) so navigating to a task detail
	// page and back via the browser restores the user's sort choice.
	const SORT_IDS = new Set(SORTS.map((s) => s.id));
	const DEFAULT_SORT: SortId = 'models';
	const _urlSort = getParam('s.tasks');
	const _urlDir = getParam('d.tasks');
	const initialSort: SortId = SORT_IDS.has(_urlSort as SortId)
		? (_urlSort as SortId)
		: DEFAULT_SORT;
	let sort = $state<SortId>(initialSort);
	let sortDir = $state<SortDir>(
		_urlDir === 'asc' || _urlDir === 'desc' ? _urlDir : NATURAL_DIR[initialSort]
	);
	$effect(() => {
		const isDefault = sort === DEFAULT_SORT && sortDir === NATURAL_DIR[DEFAULT_SORT];
		updateUrl({
			's.tasks': isDefault ? null : sort,
			'd.tasks': isDefault ? null : sortDir
		});
	});

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
	function toggleModality(m: string) {
		if (modalityFilter.has(m)) modalityFilter.delete(m);
		else modalityFilter.add(m);
	}
	function toggleDomain(d: string) {
		if (domainFilter.has(d)) domainFilter.delete(d);
		else domainFilter.add(d);
	}
	function toggleLanguage(l: string) {
		if (languageFilter.has(l)) languageFilter.delete(l);
		else languageFilter.add(l);
	}
	function toggleAllTypes() {
		if (typeFilter.size === SIMPLIFIED_PRESENT.length) typeFilter.clear();
		else for (const v of SIMPLIFIED_PRESENT) typeFilter.add(v);
	}
	function toggleAllDomains() {
		if (domainFilter.size === DOMAINS.length) domainFilter.clear();
		else for (const v of DOMAINS) domainFilter.add(v);
	}
	function toggleAllModalities() {
		if (modalityFilter.size === MODALITIES.length) modalityFilter.clear();
		else for (const v of MODALITIES) modalityFilter.add(v);
	}
	function toggleAllLanguages() {
		if (languageFilter.size === LANGUAGES.length) languageFilter.clear();
		else for (const v of LANGUAGES) languageFilter.add(v);
	}
	let allTypes = $derived(typeFilter.size === SIMPLIFIED_PRESENT.length);
	let allDomains = $derived(domainFilter.size === DOMAINS.length);
	let allModalities = $derived(modalityFilter.size === MODALITIES.length);
	let allLanguages = $derived(languageFilter.size === LANGUAGES.length);

	let domainQuery = $state('');
	let visibleDomains = $derived.by(() => {
		const q = domainQuery.trim().toLowerCase();
		if (!q) return DOMAINS;
		return DOMAINS.filter((d) => d.toLowerCase().includes(q));
	});

	let languageQuery = $state('');
	let filteredLanguages = $derived.by(() => {
		const q = languageQuery.trim().toLowerCase();
		if (!q) return LANGUAGES;
		return LANGUAGES.filter((l) => l.toLowerCase().includes(q));
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
		// "All on" = filter off (skip the empty-`.some()` problem on rows
		// with empty modality / domain / type lists). Partial = intersection
		// check. Empty = the user cleared the category deliberately, so
		// nothing matches.
		const typeOff = typeFilter.size === SIMPLIFIED_PRESENT.length;
		const modalityOff = modalityFilter.size === MODALITIES.length;
		const domainOff = domainFilter.size === DOMAINS.length;
		const languageOff = languageFilter.size === LANGUAGES.length;
		return ALL_TASKS.filter((t) => {
			if (q && !t.nameLower.includes(q)) return false;
			if (!typeOff && !typeFilter.has(t.simplifiedType)) return false;
			if (!modalityOff && !t.modalities.some((m) => modalityFilter.has(m))) return false;
			if (!domainOff && !t.domains.some((d) => domainFilter.has(d))) return false;
			if (!languageOff && !t.languages.some((l) => languageFilter.has(l))) return false;
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
				cmp = COLLATOR.compare(a.name, b.name);
			} else if (sort === 'type') {
				const r = typeRank(a.simplifiedType) - typeRank(b.simplifiedType);
				cmp = r !== 0 ? r : COLLATOR.compare(a.simplifiedType, b.simplifiedType);
			} else if (sort === 'benchmarks') {
				cmp = a.benchmarks.length - b.benchmarks.length;
			} else if (sort === 'languages') {
				cmp = a.languages.length - b.languages.length;
			} else if (sort === 'models') {
				cmp = a.numModels - b.numModels;
			} else if (sort === 'metric') {
				cmp = COLLATOR.compare(a.mainScore, b.mainScore);
			} else {
				cmp = 0;
			}
			if (cmp === 0) return COLLATOR.compare(a.name, b.name);
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

<ShareMeta
	title="Tasks"
	description={`Every task across every benchmark on the MTEB Leaderboard — ${ALL_TASKS.length || '1700+'} entries spanning retrieval, classification, clustering, pair classification, and semantic similarity.`}
/>

<div class="layout-sidebar">
	<main id="main-content" tabindex="-1" class="layout-main">
		<header class="hero index-hero">
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

		<!-- Toolbar stays outside the loading branch so the search input +
		     sort widget are interactive immediately and the cards land in
		     the same position they'd be without the skeleton. The match
		     count hides while data loads to avoid the misleading "0/0". -->
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
			{#if !loadingData && !loadError}
				<span class="count">{filtered.length} / {ALL_TASKS.length}</span>
			{/if}
		</div>

		{#if loadingData}
			<SkeletonGrid />
		{:else if loadError}
			<p class="empty">Failed to load tasks: {loadError}</p>
		{:else if filtered.length === 0}
			<p class="empty">No tasks match those filters.</p>
		{:else}
			<div class="grid card-grid" data-loaded>
				{#each visibleTasks as t (t.name)}
					<TaskCard
						name={t.name}
						type={t.type}
						simplifiedType={t.simplifiedType}
						description={t.description}
						modalities={t.modalities}
						stats={[
							{ label: 'Benchmarks', value: t.benchmarks.length },
							{ label: 'Languages', value: t.languages.length },
							{ label: 'Models', value: t.numModels },
							{ label: 'Main metric', value: t.mainScore || '—', variant: 'metric' }
						]}
					/>
				{/each}
			</div>
		{/if}
	</main>

	<FilterSidebar>
		<!-- `data-stype` drives the per-stype checked-state tint
		     defined in this page's local CSS (Task group is the one
		     facet here that uses the per-category palette rather than
		     the shared primary tint). -->
		<FilterFacet
			label="Task group"
			items={SIMPLIFIED_PRESENT}
			picked={typeFilter}
			onToggle={toggleType}
			onToggleAll={toggleAllTypes}
			allSelected={allTypes}
			pillClass="type-pill"
			pillAttrs={(t) => ({ 'data-stype': t })}
		/>
		<FilterFacet
			label="Modality"
			items={MODALITIES}
			picked={modalityFilter}
			onToggle={toggleModality}
			onToggleAll={toggleAllModalities}
			allSelected={allModalities}
			pillClass="modality-fill"
		>
			{#snippet pillIcon(m)}<ModalityIcon modality={m} size={12} />{/snippet}
		</FilterFacet>
		<FilterFacet
			label="Domain"
			items={visibleDomains}
			picked={domainFilter}
			onToggle={toggleDomain}
			onToggleAll={toggleAllDomains}
			allSelected={allDomains}
			pillClass="type-fill"
			searchPlaceholder="Search domains…"
			bind:searchValue={domainQuery}
			scrollable
			emptyMessage="No domains match."
		/>
		<FilterFacet
			label="Language"
			items={filteredLanguages}
			picked={languageFilter}
			onToggle={toggleLanguage}
			onToggleAll={toggleAllLanguages}
			allSelected={allLanguages}
			pillClass="type-fill"
			searchPlaceholder="Search languages…"
			bind:searchValue={languageQuery}
			scrollable
			grow
			emptyMessage="No languages match."
		/>
	</FilterSidebar>
</div>

<ScrollToTopButton />
<ShareUrlButton />

<style>
	.count {
		font-size: 12px;
		color: var(--text-subtle);
		font-variant-numeric: tabular-nums;
	}
</style>
