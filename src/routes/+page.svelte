<script lang="ts">
	import { resolve } from '$app/paths';
	import { goto } from '$app/navigation';
	import { loadBenchmarkMenu } from '$lib/data/service';
	import { isBenchmark, type Benchmark, type MenuEntry } from '$lib/types';
	import MarkdownText from '$lib/components/MarkdownText.svelte';
	import CopyableId from '$lib/components/CopyableId.svelte';
	import ModalityIcon from '$lib/components/ModalityIcon.svelte';
	import { apiUrl, fmtCompact, isIconUrl, slug } from '$lib/format';

	let menu = $state<MenuEntry[]>([]);
	let loading = $state(true);
	let error = $state<string | null>(null);

	$effect(() => {
		loadBenchmarkMenu()
			.then((m) => {
				menu = m;
				loading = false;
			})
			.catch((e) => {
				error = e instanceof Error ? e.message : String(e);
				loading = false;
			});
	});

	function benchmarkCount(entry: MenuEntry): number {
		let n = 0;
		for (const c of entry.children) {
			if (isBenchmark(c)) n++;
			else n += benchmarkCount(c);
		}
		return n;
	}
</script>

<div class="explorer">
	<header class="hero">
		<h1>Pick a benchmark to explore.</h1>
		<p class="lead">
			Curated leaderboards across text, image, audio, and video embedding tasks. Browse the menu
			below or
			<a class="lead-link" href={resolve('/benchmarks')}>view all benchmarks →</a>
		</p>
	</header>

	{#if loading}
		<p class="muted">Loading benchmarks…</p>
	{:else if error}
		<p class="muted">Failed to load benchmarks: {error}</p>
	{:else}
		{#each menu as section (section.name)}
			{@render menuNode(section, 0)}
		{/each}
	{/if}
</div>

{#snippet benchmarkCard(b: Benchmark)}
	{@const accentModality = b.modalities?.[0] ?? 'text'}
	<a
		class="card"
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
			<!-- Whole note is clickable; navigates to the first newer version.
			     Nested inside the card's outer <a>, so this is a <button>
			     with stopPropagation to keep the card link from firing too. -->
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

{#snippet menuNode(entry: MenuEntry, depth: number)}
	{@const directBenches = entry.children.filter(isBenchmark) as Benchmark[]}
	{@const childGroups = entry.children.filter((c) => !isBenchmark(c)) as MenuEntry[]}
	{@const total = benchmarkCount(entry)}
	<details class="section depth-{depth}" open={entry.open}>
		<summary>
			<svg
				class="chev"
				viewBox="0 0 24 24"
				width="14"
				height="14"
				fill="none"
				stroke="currentColor"
				stroke-width="2.4"
				stroke-linecap="round"
				stroke-linejoin="round"
				aria-hidden="true"
			>
				<path d="M9 6l6 6-6 6" />
			</svg>
			<h2>{entry.name}</h2>
			<span class="count">{total} benchmark{total === 1 ? '' : 's'}</span>
		</summary>
		{#if entry.description}
			<p class="section-desc"><MarkdownText text={entry.description} /></p>
		{/if}
		{#if directBenches.length > 0}
			<div class="grid">
				{#each directBenches as b (b.name)}
					{@render benchmarkCard(b)}
				{/each}
			</div>
		{/if}
		{#each childGroups as child (child.name)}
			{@render menuNode(child, depth + 1)}
		{/each}
	</details>
{/snippet}

<style>
	.explorer {
		max-width: 1280px;
		margin: 0 auto;
		padding: 28px 28px 64px;
	}
	.hero {
		padding: 40px 0 28px;
	}
	h1 {
		font-size: 40px;
		font-weight: 700;
		letter-spacing: -0.02em;
		margin: 0 0 14px;
		color: var(--ink-strong);
	}
	/* Base `.lead` (color + margin) lives in src/app.css. */
	.lead {
		font-size: 16px;
	}
	.lead-link {
		color: var(--ink-strong);
		font-weight: 600;
		border-bottom: 1px solid var(--primary);
		padding-bottom: 1px;
		text-decoration: none;
	}
	.lead-link:hover {
		color: var(--primary-strong);
		background: var(--primary-soft);
		text-decoration: none;
	}

	/* Collapsible sections ---------------------------------------------------- */
	.section {
		margin: 14px 0;
	}
	.section.depth-0 > summary {
		border-bottom: 1px solid var(--border);
		padding-bottom: 10px;
	}
	.section.depth-0 > summary h2 {
		font-size: 18px;
	}
	.section.depth-1 {
		margin: 10px 0 10px 18px;
	}
	.section.depth-1 > summary h2 {
		font-size: 14px;
		color: var(--text-muted);
	}
	.section.depth-2 {
		margin: 6px 0 6px 16px;
	}
	.section.depth-2 > summary h2 {
		font-size: 13px;
		color: var(--text-subtle);
	}
	summary {
		display: flex;
		align-items: center;
		gap: 10px;
		padding: 8px 0;
		cursor: pointer;
		list-style: none;
		user-select: none;
	}
	summary::-webkit-details-marker {
		display: none;
	}
	summary h2 {
		flex: 1;
		font-weight: 700;
		margin: 0;
		letter-spacing: -0.005em;
	}
	.chev {
		flex-shrink: 0;
		color: var(--text-muted);
		transition: transform 0.16s cubic-bezier(0.6, 0.1, 0.2, 1);
		transform-origin: 50% 50%;
	}
	details[open] > summary .chev {
		transform: rotate(90deg);
	}
	.count {
		font-size: 12px;
		color: var(--text-subtle);
		font-variant-numeric: tabular-nums;
	}
	.section-desc {
		margin: 4px 0 10px 24px;
		color: var(--text-muted);
		font-size: 13px;
	}

	/* Cards — shared design with /benchmarks: top-accent stripe driven
	   by modality, gradient header band, 2x2 stats grid, modality
	   badges pinned to the card bottom. */
	.grid {
		margin: 8px 0 12px;
		display: grid;
		grid-template-columns: repeat(auto-fill, minmax(280px, 1fr));
		gap: 14px;
	}
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
</style>
