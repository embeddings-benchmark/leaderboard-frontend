<script lang="ts">
	import { untrack } from 'svelte';
	import {
		filters,
		MODEL_MODALITIES,
		MODEL_TYPES,
		SIZE_LOG_MIN,
		SIZE_LOG_MAX,
		type ZeroShotMode,
		type Availability,
		type InstructionMode
	} from '$lib/stores/filters.svelte';
	import RangeSlider from './RangeSlider.svelte';
	import { humanizeType } from '$lib/format';
	import ModelTypeIcon from './ModelTypeIcon.svelte';
	import ModalityIcon from './ModalityIcon.svelte';

	// Size slider works in log10(M-of-params). Bounds are derived per benchmark
	// from filters.availableMin/MaxModelSizeM and clamp into the global
	// [SIZE_LOG_MIN, SIZE_LOG_MAX] window so the math stays well-defined when
	// no benchmark is loaded yet.
	let sizeLogMin = $derived(
		Math.max(SIZE_LOG_MIN, Math.log10(Math.max(filters.availableMinModelSizeM, 1)))
	);
	let sizeLogMax = $derived(
		Math.min(SIZE_LOG_MAX, Math.log10(Math.max(filters.availableMaxModelSizeM, 1)))
	);
	function paramsToLog(m: number): number {
		return Math.max(sizeLogMin, Math.min(sizeLogMax, Math.log10(Math.max(m, 1))));
	}
	function logToParams(v: number): number {
		return Math.pow(10, v);
	}
	function formatParams(mm: number): string {
		if (mm >= 1_000_000) {
			const t = mm / 1_000_000;
			return t >= 100 ? `${t.toFixed(0)}T` : `${t.toFixed(1)}T`;
		}
		if (mm >= 1_000) {
			const b = mm / 1_000;
			return b >= 100 ? `${b.toFixed(0)}B` : `${b.toFixed(1)}B`;
		}
		if (mm >= 1) {
			return mm >= 100 ? `${mm.toFixed(0)}M` : `${mm.toFixed(1)}M`;
		}
		return `${(mm * 1000).toFixed(0)}K`;
	}
	function formatLog(v: number): string {
		return formatParams(logToParams(v));
	}
	// Inverse of `formatParams` — accepts "500K", "5M", "1.2 B", "3T",
	// or a bare number (treated as millions, matching the underlying
	// `minModelSizeM` store unit). Returns log-space units so it slots
	// directly into the slider's value space. Returns null for
	// unparseable input so the slider snaps back to the previous value.
	function parseLog(s: string): number | null {
		const m = s.trim().match(/^([0-9]*\.?[0-9]+)\s*([KMBT]?)$/i);
		if (!m) return null;
		const n = parseFloat(m[1]);
		if (Number.isNaN(n)) return null;
		const unit = m[2].toUpperCase();
		const inMillions =
			unit === 'K' ? n / 1000 : unit === 'B' ? n * 1000 : unit === 'T' ? n * 1_000_000 : n; // bare or 'M' → already in millions
		return paramsToLog(inMillions);
	}

	// Distribute ~4 tick marks across the benchmark's log-size window. Both
	// endpoints are pinned so the rightmost tick aligns with the slider's
	// edge — otherwise spans that don't divide evenly into ``stepDecades``
	// leave a visible gap (e.g. 2.3 → 3.8 with step 0.5 stops at 6.3B even
	// though the slider's right edge is 10B).
	let sizeTicks = $derived.by(() => {
		const lo = sizeLogMin;
		const hi = sizeLogMax;
		if (hi <= lo) return [lo];
		const span = hi - lo;
		const stepDecades = span >= 3 ? 1 : span >= 1.5 ? 0.5 : span / 3;
		const ticks: number[] = [lo];
		// Half of a step is the threshold below which a tick visually collides
		// with the endpoint — skip intermediates that come too close to lo/hi.
		const minGap = stepDecades * 0.5;
		let v = Math.ceil((lo + 1e-6) / stepDecades) * stepDecades;
		while (v < hi - 1e-3) {
			if (v - lo >= minGap && hi - v >= minGap) ticks.push(v);
			v += stepDecades;
		}
		ticks.push(hi);
		return ticks.map((t) => Math.round(t * 100) / 100);
	});

	interface Props {
		defaultModelOpen?: boolean;
		defaultScopeOpen?: boolean;
		// On pages without a benchmark context (e.g. the Models directory) the
		// Customize / Benchmark scope section is irrelevant — hide it entirely.
		hideScope?: boolean;
		// On pages where the sidebar only ever shows model filters (Models
		// directory), drop the collapsible "Model filters" card chrome so the
		// controls read as the section itself instead of a card-in-a-sidebar.
		flatModel?: boolean;
	}
	let {
		defaultModelOpen = true,
		defaultScopeOpen = false,
		hideScope = false,
		flatModel = false
	}: Props = $props();

	let modelOpen = $state(untrack(() => defaultModelOpen));
	let scopeOpen = $state(untrack(() => defaultScopeOpen));
	let langQuery = $state('');
	let taskQuery = $state('');

	const AVAILABILITY_OPTS: { label: string; value: Availability }[] = [
		{ label: 'Both', value: 'both' },
		{ label: 'Open', value: 'open' },
		{ label: 'Proprietary', value: 'proprietary' }
	];
	const ZERO_SHOT_OPTS: { label: string; value: ZeroShotMode }[] = [
		{ label: 'Allow all', value: 'allow_all' },
		{ label: 'Remove unknown', value: 'remove_unknown' },
		{ label: 'Only zero-shot', value: 'only_zero_shot' }
	];
	const INSTRUCTION_OPTS: { label: string; value: InstructionMode }[] = [
		{ label: 'Both', value: 'both' },
		{ label: 'Instruction-tuned', value: 'only_instruction' },
		{ label: 'Non-instruction', value: 'only_non_instruction' }
	];

	// Active-filter chip strip: each non-default filter becomes a removable chip.
	interface Chip {
		key: string;
		label: string;
		clear: () => void;
	}
	// Split into per-section derived so toggling a model filter doesn't
	// invalidate the customize chips (and vice versa) — each section only
	// re-runs when its own inputs change.
	let modelChips = $derived.by(() => {
		const list: Chip[] = [];
		if (filters.nameQuery.trim()) {
			list.push({
				key: 'name',
				label: `Name: "${filters.nameQuery.trim()}"`,
				clear: () => (filters.nameQuery = '')
			});
		}
		if (filters.availability !== 'both') {
			list.push({
				key: 'avail',
				label: filters.availability === 'open' ? 'Open only' : 'Proprietary only',
				clear: () => (filters.availability = 'both')
			});
		}
		if (filters.zeroShot !== 'allow_all') {
			list.push({
				key: 'zs',
				label: filters.zeroShot === 'only_zero_shot' ? 'Only zero-shot' : 'Hide unknown zero-shot',
				clear: () => (filters.zeroShot = 'allow_all')
			});
		}
		if (filters.instructions !== 'both') {
			list.push({
				key: 'inst',
				label:
					filters.instructions === 'only_instruction' ? 'Instruction-tuned' : 'Non-instruction',
				clear: () => (filters.instructions = 'both')
			});
		}
		if (filters.sentenceTransformersOnly) {
			list.push({
				key: 'st',
				label: 'ST compatible',
				clear: () => (filters.sentenceTransformersOnly = false)
			});
		}
		if (
			filters.minModelSizeM > filters.availableMinModelSizeM ||
			filters.maxModelSizeM < filters.availableMaxModelSizeM
		) {
			list.push({
				key: 'size',
				label: `Size ${formatParams(filters.minModelSizeM)}–${formatParams(filters.maxModelSizeM)}`,
				clear: () => {
					filters.minModelSizeM = filters.availableMinModelSizeM;
					filters.maxModelSizeM = filters.availableMaxModelSizeM;
				}
			});
		}
		if (filters.modelTypes.size !== MODEL_TYPES.length) {
			list.push({
				key: 'mtype',
				label: `Type · ${filters.modelTypes.size}/${MODEL_TYPES.length}`,
				clear: () => filters.setAll('modelTypes', MODEL_TYPES, true)
			});
		}
		if (filters.modelModalities.size !== MODEL_MODALITIES.length) {
			list.push({
				key: 'mmod',
				label: `Modality · ${filters.modelModalities.size}/${MODEL_MODALITIES.length}`,
				clear: () => filters.setAll('modelModalities', MODEL_MODALITIES, true)
			});
		}
		return list;
	});
	let customizeChips = $derived.by(() => {
		const list: Chip[] = [];
		const hasTT = filters.availableTaskTypes.length > 0;
		if (hasTT && filters.taskTypes.size !== filters.availableTaskTypes.length) {
			list.push({
				key: 'tt',
				label: `Task type · ${filters.taskTypes.size}/${filters.availableTaskTypes.length}`,
				clear: () => filters.setAll('taskTypes', filters.availableTaskTypes, true)
			});
		}
		const hasD = filters.availableDomains.length > 0;
		if (hasD && filters.domains.size !== filters.availableDomains.length) {
			list.push({
				key: 'dom',
				label: `Domain · ${filters.domains.size}/${filters.availableDomains.length}`,
				clear: () => filters.setAll('domains', filters.availableDomains, true)
			});
		}
		const hasM = filters.availableModalities.length > 0;
		if (hasM && filters.modalities.size !== filters.availableModalities.length) {
			list.push({
				key: 'mod',
				label: `Modality · ${filters.modalities.size}/${filters.availableModalities.length}`,
				clear: () => filters.setAll('modalities', filters.availableModalities, true)
			});
		}
		const hasL = filters.availableLanguages.length > 0;
		if (hasL && filters.languages.size !== filters.availableLanguages.length) {
			list.push({
				key: 'lang',
				label: `Lang · ${filters.languages.size}/${filters.availableLanguages.length}`,
				clear: () => filters.setAll('languages', filters.availableLanguages, true)
			});
		}
		const hasT = filters.availableTasks.length > 0;
		if (hasT && filters.tasks.size !== filters.availableTasks.length) {
			list.push({
				key: 'task',
				label: `Task · ${filters.tasks.size}/${filters.availableTasks.length}`,
				clear: () =>
					filters.setAll(
						'tasks',
						filters.availableTasks.map((t) => t.name),
						true
					)
			});
		}
		return list;
	});
	let chips = $derived([...modelChips, ...customizeChips]);

	let activeModelCount = $derived.by(() => {
		let n = 0;
		if (filters.availability !== 'both') n++;
		if (filters.zeroShot !== 'allow_all') n++;
		if (filters.instructions !== 'both') n++;
		if (filters.sentenceTransformersOnly) n++;
		if (
			filters.minModelSizeM > filters.availableMinModelSizeM ||
			filters.maxModelSizeM < filters.availableMaxModelSizeM
		)
			n++;
		if (filters.modelTypes.size !== MODEL_TYPES.length) n++;
		if (filters.modelModalities.size !== MODEL_MODALITIES.length) n++;
		return n;
	});
	let activeScopeCount = $derived.by(() => {
		let n = 0;
		if (
			filters.availableTaskTypes.length > 0 &&
			filters.taskTypes.size !== filters.availableTaskTypes.length
		)
			n++;
		if (
			filters.availableDomains.length > 0 &&
			filters.domains.size !== filters.availableDomains.length
		)
			n++;
		if (
			filters.availableModalities.length > 0 &&
			filters.modalities.size !== filters.availableModalities.length
		)
			n++;
		if (
			filters.availableLanguages.length > 0 &&
			filters.languages.size !== filters.availableLanguages.length
		)
			n++;
		if (filters.availableTasks.length > 0 && filters.tasks.size !== filters.availableTasks.length)
			n++;
		return n;
	});

	let filteredLanguages = $derived.by(() => {
		// Lowercase + trim the query ONCE; `.filter` callback then only
		// lowercases each candidate (was redoing both per language).
		const q = langQuery.trim().toLowerCase();
		if (!q) return filters.availableLanguages;
		return filters.availableLanguages.filter((l) => l.toLowerCase().includes(q));
	});
	// Pre-sorted full list — sort is invariant under the search query, so
	// running it inside the per-keystroke derived was pure waste.
	let allTaskNamesSorted = $derived(
		filters.availableTasks.map((t) => t.name).sort((a, b) => a.localeCompare(b))
	);
	let filteredTasks = $derived.by(() => {
		const q = taskQuery.trim().toLowerCase();
		if (!q) return allTaskNamesSorted;
		return allTaskNamesSorted.filter((n) => n.toLowerCase().includes(q));
	});

	function resetAll() {
		filters.resetCustomize();
		filters.resetModelFilters();
		filters.nameQuery = '';
	}
</script>

<div class="filter-content">
	{#if chips.length > 0}
		<div class="active-strip">
			<div class="chips">
				{#each chips as c (c.key)}
					<button type="button" class="active-chip" onclick={c.clear} title="Click to clear">
						<span>{c.label}</span>
						<span class="x" aria-hidden="true">×</span>
					</button>
				{/each}
			</div>
			<button type="button" class="reset-all" onclick={resetAll}>Reset all</button>
		</div>
	{/if}

	{#snippet modelGroups()}
		<div class="group">
			<div class="group-label">Availability</div>
			<div class="segmented" role="radiogroup" aria-label="Availability">
				{#each AVAILABILITY_OPTS as opt (opt.value)}
					<button
						type="button"
						role="radio"
						aria-checked={filters.availability === opt.value}
						class="seg"
						class:on={filters.availability === opt.value}
						onclick={() => (filters.availability = opt.value)}
					>
						{opt.label}
					</button>
				{/each}
			</div>
		</div>

		<div class="group">
			<div class="group-label">Zero-shot</div>
			<div class="segmented" role="radiogroup" aria-label="Zero-shot">
				{#each ZERO_SHOT_OPTS as opt (opt.value)}
					<button
						type="button"
						role="radio"
						aria-checked={filters.zeroShot === opt.value}
						class="seg"
						class:on={filters.zeroShot === opt.value}
						onclick={() => (filters.zeroShot = opt.value)}
					>
						{opt.label}
					</button>
				{/each}
			</div>
		</div>

		<div class="group">
			<div class="group-label">
				Model size
				<span class="muted-inline">
					{formatParams(filters.minModelSizeM)} – {formatParams(filters.maxModelSizeM)}
				</span>
			</div>
			<RangeSlider
				min={sizeLogMin}
				max={sizeLogMax}
				step={0.05}
				valueMin={paramsToLog(filters.minModelSizeM)}
				valueMax={paramsToLog(filters.maxModelSizeM)}
				onMinChange={(v) => (filters.minModelSizeM = logToParams(v))}
				onMaxChange={(v) => (filters.maxModelSizeM = logToParams(v))}
				format={formatLog}
				parse={parseLog}
				ticks={sizeTicks}
			/>
		</div>

		<div class="group">
			<div class="group-label">Instructions</div>
			<div class="segmented" role="radiogroup" aria-label="Instructions">
				{#each INSTRUCTION_OPTS as opt (opt.value)}
					<button
						type="button"
						role="radio"
						aria-checked={filters.instructions === opt.value}
						class="seg"
						class:on={filters.instructions === opt.value}
						onclick={() => (filters.instructions = opt.value)}
					>
						{opt.label}
					</button>
				{/each}
			</div>
		</div>

		<div class="group">
			<label class="switch">
				<input
					type="checkbox"
					checked={filters.sentenceTransformersOnly}
					onchange={(e) =>
						(filters.sentenceTransformersOnly = (e.currentTarget as HTMLInputElement).checked)}
				/>
				<span class="switch-track"><span class="switch-knob"></span></span>
				<span class="switch-label">Sentence-Transformers compatible only</span>
			</label>
		</div>

		<div class="group">
			<div class="group-header">
				<span class="group-label">Model type</span>
				<button
					type="button"
					class="link-btn"
					onclick={() =>
						filters.setAll(
							'modelTypes',
							MODEL_TYPES,
							filters.modelTypes.size !== MODEL_TYPES.length
						)}
				>
					{filters.modelTypes.size === MODEL_TYPES.length ? 'Clear' : 'All'}
				</button>
			</div>
			<div class="pills">
				{#each MODEL_TYPES as t (t)}
					<button
						type="button"
						class="pill model-type-pill"
						data-type={t}
						class:on={filters.modelTypes.has(t)}
						onclick={() => filters.toggleInSet('modelTypes', t)}
						aria-pressed={filters.modelTypes.has(t)}
					>
						<ModelTypeIcon type={t} size={12} />
						<span>{t}</span>
					</button>
				{/each}
			</div>
		</div>

		<div class="group">
			<div class="group-header">
				<span class="group-label">Modality</span>
				<button
					type="button"
					class="link-btn"
					onclick={() =>
						filters.setAll(
							'modelModalities',
							MODEL_MODALITIES,
							filters.modelModalities.size !== MODEL_MODALITIES.length
						)}
				>
					{filters.modelModalities.size === MODEL_MODALITIES.length ? 'Clear' : 'All'}
				</button>
			</div>
			<div class="pills">
				{#each MODEL_MODALITIES as m (m)}
					<button
						type="button"
						class="pill"
						class:on={filters.modelModalities.has(m)}
						onclick={() => filters.toggleInSet('modelModalities', m)}
						aria-pressed={filters.modelModalities.has(m)}
					>
						<ModalityIcon modality={m} size={12} />
						<span>{m}</span>
					</button>
				{/each}
			</div>
		</div>
	{/snippet}

	{#if flatModel}
		<!-- Flat layout: model filters render inline. Used on /models
		     where the sidebar only ever shows these controls — no need to nest
		     them in a collapsible "Model filters" card-in-a-sidebar. -->
		<div class="flat-groups">
			{@render modelGroups()}
		</div>
	{:else}
		<section class="block">
			<button
				type="button"
				class="block-head"
				onclick={() => (modelOpen = !modelOpen)}
				aria-expanded={modelOpen}
			>
				<span class="block-title">Model filters</span>
				{#if activeModelCount > 0}
					<span class="count-pill">{activeModelCount}</span>
				{/if}
				<span class="chev" class:open={modelOpen}>›</span>
			</button>
			{#if modelOpen}
				<div class="block-body">
					{@render modelGroups()}
				</div>
			{/if}
		</section>
	{/if}

	{#if !hideScope}
		<section class="block">
			<button
				type="button"
				class="block-head"
				onclick={() => (scopeOpen = !scopeOpen)}
				aria-expanded={scopeOpen}
			>
				<span class="block-title">Benchmark scope</span>
				{#if activeScopeCount > 0}
					<span class="count-pill">{activeScopeCount}</span>
				{/if}
				<span class="chev" class:open={scopeOpen}>›</span>
			</button>

			{#if scopeOpen}
				<div class="block-body">
					<div class="group">
						<div class="group-header">
							<span class="group-label"
								>Task type
								<span class="muted-inline"
									>{filters.taskTypes.size}/{filters.availableTaskTypes.length}</span
								></span
							>
							<button
								type="button"
								class="link-btn"
								onclick={() =>
									filters.setAll(
										'taskTypes',
										filters.availableTaskTypes,
										filters.taskTypes.size !== filters.availableTaskTypes.length
									)}
							>
								{filters.taskTypes.size === filters.availableTaskTypes.length ? 'Clear' : 'All'}
							</button>
						</div>
						<div class="pills">
							{#each filters.availableTaskTypes as tt (tt)}
								<button
									type="button"
									class="pill"
									class:on={filters.taskTypes.has(tt)}
									onclick={() => filters.toggleInSet('taskTypes', tt)}
									aria-pressed={filters.taskTypes.has(tt)}
								>
									{humanizeType(tt)}
								</button>
							{/each}
						</div>
					</div>

					<div class="group">
						<div class="group-header">
							<span class="group-label"
								>Domain
								<span class="muted-inline"
									>{filters.domains.size}/{filters.availableDomains.length}</span
								></span
							>
							<button
								type="button"
								class="link-btn"
								onclick={() =>
									filters.setAll(
										'domains',
										filters.availableDomains,
										filters.domains.size !== filters.availableDomains.length
									)}
							>
								{filters.domains.size === filters.availableDomains.length ? 'Clear' : 'All'}
							</button>
						</div>
						<div class="pills">
							{#each filters.availableDomains as d (d)}
								<button
									type="button"
									class="pill"
									class:on={filters.domains.has(d)}
									onclick={() => filters.toggleInSet('domains', d)}
									aria-pressed={filters.domains.has(d)}
								>
									{d}
								</button>
							{/each}
						</div>
					</div>

					{#if filters.availableModalities.length > 0}
						<div class="group">
							<div class="group-header">
								<span class="group-label"
									>Modality
									<span class="muted-inline"
										>{filters.modalities.size}/{filters.availableModalities.length}</span
									></span
								>
								<button
									type="button"
									class="link-btn"
									onclick={() =>
										filters.setAll(
											'modalities',
											filters.availableModalities,
											filters.modalities.size !== filters.availableModalities.length
										)}
								>
									{filters.modalities.size === filters.availableModalities.length ? 'Clear' : 'All'}
								</button>
							</div>
							<div class="pills">
								{#each filters.availableModalities as m (m)}
									<button
										type="button"
										class="pill"
										class:on={filters.modalities.has(m)}
										onclick={() => filters.toggleInSet('modalities', m)}
										aria-pressed={filters.modalities.has(m)}
									>
										<ModalityIcon modality={m} size={12} />
										<span>{m}</span>
									</button>
								{/each}
							</div>
						</div>
					{/if}

					<div class="group">
						<div class="group-header">
							<span class="group-label"
								>Languages
								<span class="muted-inline"
									>{filters.languages.size}/{filters.availableLanguages.length}</span
								></span
							>
							<button
								type="button"
								class="link-btn"
								onclick={() =>
									filters.setAll(
										'languages',
										filters.availableLanguages,
										filters.languages.size !== filters.availableLanguages.length
									)}
							>
								{filters.languages.size === filters.availableLanguages.length ? 'Clear' : 'All'}
							</button>
						</div>
						<input
							type="search"
							class="search"
							placeholder="Search languages…"
							bind:value={langQuery}
						/>
						<div class="pills scroll-y scroll-thin">
							{#each filteredLanguages as l (l)}
								<button
									type="button"
									class="pill"
									class:on={filters.languages.has(l)}
									onclick={() => filters.toggleInSet('languages', l)}
									aria-pressed={filters.languages.has(l)}
								>
									{l}
								</button>
							{/each}
							{#if filteredLanguages.length === 0}
								<p class="muted">No matches.</p>
							{/if}
						</div>
					</div>

					<div class="group">
						<div class="group-header">
							<span class="group-label"
								>Tasks
								<span class="muted-inline"
									>{filters.tasks.size}/{filters.availableTasks.length}</span
								></span
							>
							<button
								type="button"
								class="link-btn"
								onclick={() =>
									filters.setAll(
										'tasks',
										filters.availableTasks.map((t) => t.name),
										filters.tasks.size !== filters.availableTasks.length
									)}
							>
								{filters.tasks.size === filters.availableTasks.length ? 'Clear' : 'All'}
							</button>
						</div>
						<input
							type="search"
							class="search"
							placeholder="Search tasks…"
							bind:value={taskQuery}
						/>
						<div class="pills scroll-y scroll-thin">
							{#each filteredTasks as name (name)}
								<button
									type="button"
									class="pill"
									class:on={filters.tasks.has(name)}
									onclick={() => filters.toggleInSet('tasks', name)}
									aria-pressed={filters.tasks.has(name)}
								>
									<span class="ellipsis" title={name}>{name}</span>
								</button>
							{/each}
							{#if filteredTasks.length === 0}
								<p class="muted">No matches.</p>
							{/if}
						</div>
					</div>
				</div>
			{/if}
		</section>
	{/if}
</div>

<style>
	.filter-content {
		padding: 12px 14px 28px;
		display: flex;
		flex-direction: column;
		gap: 14px;
	}

	/* Active filter chips ----------------------------------------------------- */
	.active-strip {
		display: flex;
		flex-wrap: wrap;
		align-items: center;
		gap: 6px;
		padding: 10px 12px;
		background: var(--primary-soft);
		border: 1px solid color-mix(in srgb, var(--primary) 30%, transparent);
		border-radius: 10px;
	}
	.chips {
		display: flex;
		flex-wrap: wrap;
		gap: 4px;
		flex: 1;
		min-width: 0;
	}
	/* Selected-filter chip — sits on the page surface, so use the soft
	   primary fill (theme-aware via app.css) instead of pure white,
	   which read as a glaring patch in dark mode. Hover still flips to
	   the full primary tint as a "clear this filter" affordance. */
	.active-chip {
		display: inline-flex;
		align-items: center;
		gap: 6px;
		padding: 3px 8px 3px 10px;
		background: var(--primary-soft);
		border: 1px solid var(--primary);
		border-radius: 999px;
		font-size: 11px;
		font-weight: 500;
		color: var(--primary-strong);
		cursor: pointer;
		max-width: 100%;
		transition:
			background 0.12s,
			color 0.12s;
	}
	.active-chip:hover {
		background: var(--primary);
		color: var(--surface);
	}
	.active-chip .x {
		font-size: 14px;
		line-height: 1;
		opacity: 0.8;
		font-weight: 600;
	}
	.reset-all {
		background: none;
		border: none;
		font-size: 11px;
		font-weight: 600;
		color: var(--primary-strong);
		cursor: pointer;
		text-decoration: underline;
		text-underline-offset: 2px;
		padding: 0 2px;
	}
	.reset-all:hover {
		color: var(--text);
	}

	/* Block sections ---------------------------------------------------------- */
	.block {
		background: var(--surface);
		border: 1px solid var(--border);
		border-radius: 12px;
		overflow: hidden;
	}
	.block-head {
		display: flex;
		align-items: center;
		gap: 8px;
		width: 100%;
		padding: 12px 14px;
		background: none;
		border: none;
		cursor: pointer;
		font-size: 13px;
		font-weight: 700;
		color: var(--text);
		text-align: left;
	}
	.block-head:hover {
		background: var(--surface-muted);
	}
	.block-title {
		flex: 1;
		letter-spacing: -0.005em;
	}
	.count-pill {
		display: inline-flex;
		align-items: center;
		justify-content: center;
		min-width: 18px;
		height: 18px;
		padding: 0 6px;
		background: var(--primary);
		color: #fff;
		border-radius: 999px;
		font-size: 11px;
		font-weight: 700;
	}
	.chev {
		font-size: 18px;
		line-height: 1;
		color: var(--text-subtle);
		transform: rotate(90deg);
		transition: transform 0.18s ease;
	}
	.chev.open {
		transform: rotate(270deg);
	}
	.block-body {
		padding: 4px 14px 16px;
		display: flex;
		flex-direction: column;
		gap: 16px;
		border-top: 1px solid var(--border);
	}
	/* Sibling of `.block` used in flat mode — no card chrome, just the groups. */
	.flat-groups {
		display: flex;
		flex-direction: column;
		gap: 16px;
		padding: 0 2px;
	}

	/* Groups ------------------------------------------------------------------ */
	.group {
		display: flex;
		flex-direction: column;
		gap: 8px;
	}
	.group-header {
		display: flex;
		align-items: center;
		justify-content: space-between;
		gap: 8px;
	}
	.group-label {
		display: inline-flex;
		align-items: baseline;
		gap: 6px;
		font-size: 12px;
		font-weight: 600;
		letter-spacing: 0.02em;
		color: var(--text);
	}
	.muted-inline {
		font-size: 11px;
		font-weight: 500;
		color: var(--text-subtle);
		font-variant-numeric: tabular-nums;
	}
	.link-btn {
		background: none;
		border: none;
		color: var(--link);
		font-size: 11px;
		font-weight: 600;
		cursor: pointer;
		padding: 2px 4px;
	}
	.link-btn:hover {
		text-decoration: underline;
	}

	/* Segmented control (ternary radios) ------------------------------------- */
	.segmented {
		display: grid;
		grid-auto-flow: column;
		grid-auto-columns: 1fr;
		gap: 2px;
		padding: 3px;
		background: var(--surface-muted);
		border: 1px solid var(--border);
		border-radius: 8px;
	}
	.seg {
		display: flex;
		align-items: center;
		justify-content: center;
		min-width: 0; /* let the grid track shrink the button below content-box width */
		padding: 6px 8px;
		font-size: 12px;
		font-weight: 600;
		line-height: 1.25;
		background: transparent;
		border: none;
		border-radius: 6px;
		color: var(--text-muted);
		cursor: pointer;
		transition:
			background 0.12s,
			color 0.12s,
			box-shadow 0.12s;
		/* Allow long labels ("Instruction-tuned", "Only zero-shot", "Proprietary")
		   to wrap within their column instead of truncating with an ellipsis. */
		text-align: center;
		text-wrap: balance;
		overflow-wrap: anywhere;
	}
	.seg:hover {
		color: var(--text);
	}
	.seg.on {
		background: var(--surface);
		color: var(--text);
		box-shadow: 0 1px 2px rgb(var(--shadow-tint) / 0.08);
	}

	/* Multi-select pills ------------------------------------------------------ */
	.pills {
		display: flex;
		flex-wrap: wrap;
		gap: 6px;
	}
	.pills.scroll-y {
		max-height: 220px;
		overflow-y: auto;
		padding: 8px;
		border: 1px solid var(--border);
		border-radius: 8px;
		background: var(--surface-muted);
	}
	.pill {
		display: inline-flex;
		align-items: center;
		gap: 4px;
		padding: 5px 11px;
		font-size: 12px;
		font-weight: 500;
		background: var(--surface);
		border: 1px solid var(--border);
		border-radius: 999px;
		color: var(--text-muted);
		cursor: pointer;
		transition:
			background 0.12s,
			border-color 0.12s,
			color 0.12s;
		max-width: 100%;
	}
	.pill:hover {
		border-color: var(--border-strong);
		color: var(--text);
	}
	.pill.on {
		background: var(--primary-soft);
		border-color: var(--primary);
		color: var(--primary-strong);
		font-weight: 600;
	}
	.pill.on:hover {
		background: color-mix(in srgb, var(--primary) 18%, white);
	}
	/* Model-type pills carry the type's signature color when active. Pulled
	   from the shared --tint-* palette so they match SummaryTable's column
	   tints exactly in both themes. */
	.model-type-pill.on[data-type='dense'] {
		background: var(--tint-blue);
		border-color: color-mix(in srgb, var(--tint-blue-fg) 35%, transparent);
		color: var(--tint-blue-fg);
	}
	.model-type-pill.on[data-type='cross-encoder'] {
		background: var(--tint-orange);
		border-color: color-mix(in srgb, var(--tint-orange-fg) 35%, transparent);
		color: var(--tint-orange-fg);
	}
	.model-type-pill.on[data-type='late-interaction'] {
		background: var(--tint-green);
		border-color: color-mix(in srgb, var(--tint-green-fg) 35%, transparent);
		color: var(--tint-green-fg);
	}
	.model-type-pill.on[data-type='sparse'] {
		background: var(--tint-amber);
		border-color: color-mix(in srgb, var(--tint-amber-fg) 35%, transparent);
		color: var(--tint-amber-fg);
	}
	.model-type-pill.on[data-type='router'] {
		background: var(--tint-purple);
		border-color: color-mix(in srgb, var(--tint-purple-fg) 35%, transparent);
		color: var(--tint-purple-fg);
	}
	.model-type-pill.on:hover {
		filter: brightness(0.97);
		background: inherit;
	}
	.ellipsis {
		overflow: hidden;
		text-overflow: ellipsis;
		white-space: nowrap;
		max-width: 220px;
	}

	/* Switch (binary toggle) -------------------------------------------------- */
	.switch {
		display: inline-flex;
		align-items: center;
		gap: 10px;
		cursor: pointer;
		font-size: 13px;
		color: var(--text);
	}
	.switch input {
		position: absolute;
		opacity: 0;
		width: 0;
		height: 0;
		pointer-events: none;
	}
	.switch-track {
		position: relative;
		width: 34px;
		height: 20px;
		background: var(--border-strong);
		border-radius: 999px;
		transition: background 0.16s;
		flex-shrink: 0;
	}
	.switch-knob {
		position: absolute;
		top: 2px;
		left: 2px;
		width: 16px;
		height: 16px;
		background: #fff;
		border-radius: 50%;
		box-shadow: 0 1px 2px rgb(var(--shadow-tint) / 0.2);
		transition: transform 0.16s;
	}
	.switch input:checked + .switch-track {
		background: var(--primary);
	}
	.switch input:checked + .switch-track .switch-knob {
		transform: translateX(14px);
	}
	.switch-label {
		flex: 1;
	}

	/* Search input ------------------------------------------------------------ */
	.search {
		width: 100%;
		padding: 6px 10px;
		border: 1px solid var(--border);
		border-radius: 6px;
		font-size: 12px;
		font-family: inherit;
		background: var(--surface);
		color: var(--text);
	}
	.search:focus {
		outline: none;
		border-color: var(--primary);
		box-shadow: 0 0 0 3px var(--primary-soft);
	}

	.muted {
		font-size: 12px;
		color: var(--text-muted);
		margin: 4px 0;
	}
</style>
