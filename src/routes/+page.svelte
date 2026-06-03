<script lang="ts">
	import { resolve } from '$app/paths';
	import { goto } from '$app/navigation';
	import { loadBenchmarkMenu } from '$lib/data/service';
	import { isBenchmark, type Benchmark, type MenuEntry } from '$lib/types';
	import MarkdownText from '$lib/components/MarkdownText.svelte';
	import CopyableId from '$lib/components/CopyableId.svelte';
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
	<a class="card" href={resolve('/benchmark/[name]', { name: slug(b.name) })}>
		<div class="card-head">
			{#if b.icon}
				{#if isIconUrl(b.icon)}
					<img class="card-icon" src={apiUrl(b.icon)} alt="" loading="lazy" />
				{:else}
					<span class="card-icon card-icon-text" aria-hidden="true">{b.icon}</span>
				{/if}
			{/if}
			<div class="card-titles">
				<span class="card-name">{b.displayName}</span>
				<CopyableId value={b.name} ariaLabel="Copy benchmark id" />
			</div>
		</div>
		<p class="card-desc"><MarkdownText text={b.description} /></p>
		<div class="card-foot">
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
			<div class="stats-line">
				{#if b.numModels && b.numModels > 0}
					<span title="{b.numModels} models"><strong>{fmtCompact(b.numModels)}</strong> models</span
					>
					<span class="dot">·</span>
				{/if}
				<span title="{b.tasks.length} tasks"
					><strong>{fmtCompact(b.tasks.length)}</strong> tasks</span
				>
				<span class="dot">·</span>
				<span title="{b.languages.length} languages"
					><strong>{fmtCompact(b.languages.length)}</strong> langs</span
				>
				<span class="dot">·</span>
				<span title="{b.taskTypes.length} task types"
					><strong>{fmtCompact(b.taskTypes.length)}</strong> types</span
				>
			</div>
			<span class="cta">Open leaderboard →</span>
		</div>
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

	/* Cards ------------------------------------------------------------------- */
	.grid {
		margin: 8px 0 12px;
		display: grid;
		grid-template-columns: repeat(auto-fill, minmax(280px, 1fr));
		gap: 14px;
	}
	.card {
		background: var(--surface);
		border: 1px solid var(--border);
		border-radius: 14px;
		padding: 16px 18px;
		display: flex;
		flex-direction: column;
		gap: 10px;
		text-decoration: none;
		color: var(--text);
		transition:
			transform 0.12s ease,
			border-color 0.12s ease,
			box-shadow 0.12s ease;
		position: relative;
		max-height: 220px;
		overflow: hidden;
	}
	.card:hover {
		border-color: var(--primary);
		transform: translateY(-1px);
		box-shadow: 0 10px 24px rgb(15, 23, 42, 0.06);
	}
	.card-head {
		display: flex;
		/* Align the icon to the top so it sits next to the display-name
		   row rather than vertically centring between the name and the
		   id pill below it. */
		align-items: flex-start;
		gap: 10px;
	}
	.card-head .card-icon {
		/* Nudge the 28 px icon down by the difference between line-box
		   height of the 15 px display name and the icon, so its centre
		   lines up with the name's baseline-cap region. */
		margin-top: 1px;
	}
	.card-icon {
		width: 28px;
		height: 28px;
		flex-shrink: 0;
		border-radius: 4px;
		object-fit: contain;
		background: var(--surface-muted);
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
	.card-name {
		font-size: 15px;
		font-weight: 700;
		letter-spacing: -0.005em;
	}
	.card-desc {
		font-size: 13px;
		color: var(--text-muted);
		margin: 0;
		overflow: hidden;
		display: -webkit-box;
		-webkit-line-clamp: 3;
		line-clamp: 3;
		-webkit-box-orient: vertical;
	}
	.card-foot {
		margin-top: auto;
		display: flex;
		flex-direction: column;
		gap: 8px;
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
	.stats-line {
		display: flex;
		flex-wrap: wrap;
		column-gap: 4px;
		row-gap: 2px;
		align-items: baseline;
		font-size: 11.5px;
		color: var(--text-muted);
	}
	/* Keep each "<N> label" chunk together — only the separator dots
	   are allowed to land at line-break candidates, so wrapping (if it
	   happens on a very narrow viewport) splits cleanly. */
	.stats-line > span:not(.dot) {
		white-space: nowrap;
	}
	.stats-line strong {
		color: var(--text);
		font-variant-numeric: tabular-nums;
	}
	.stats-line .dot {
		color: var(--border-strong);
	}
	/* Base `.muted` (color + margin: 0) lives in src/app.css. */
	.muted {
		padding: 20px 0;
	}
	.cta {
		font-size: 12px;
		font-weight: 600;
		color: var(--primary-strong);
	}
</style>
