<script lang="ts">
	// Collapsible home-page section. Header shows title + benchmark count
	// + chevron; body renders the first ``initialCount`` benchmark cards
	// (~2 rows on desktop) with a "Show more" button to reveal the rest.
	//
	// Used by `/+page.svelte` — four sections (Language / Modality /
	// Retrieval / Domain), each driven by one entry from the backend's
	// `HOME_BENCHMARK_ENTRIES`.

	import { untrack } from 'svelte';
	import { isBenchmark, type Benchmark, type MenuEntry } from '$lib/types';
	import BenchmarkCard from './BenchmarkCard.svelte';

	interface Props {
		entry: MenuEntry;
		// How many cards to show before the "Show more" cut. Defaults to
		// 4 — one row at the desktop grid width.
		initialCount?: number;
		// Whether the section starts expanded. Mirrors `MenuEntry.open`
		// from the backend by default; pass to force.
		defaultOpen?: boolean;
	}
	let { entry, initialCount = 4, defaultOpen }: Props = $props();

	// Only direct-child benchmarks land in the cards; nested MenuEntries
	// (none for the home layout, but the type allows them) are ignored.
	let cards = $derived(entry.children.filter(isBenchmark) as Benchmark[]);

	// One-shot snapshot of the initial open state — user collapses don't
	// get clobbered by prop updates. `untrack` silences Svelte 5's
	// "state_referenced_locally" warning.
	let open = $state(untrack(() => defaultOpen ?? entry.open ?? true));
	let expanded = $state(false);
	let visible = $derived(expanded ? cards : cards.slice(0, initialCount));
	let hasMore = $derived(cards.length > initialCount);
</script>

<section class="menu-section" class:open>
	<button
		type="button"
		class="head"
		aria-expanded={open}
		aria-controls="sec-{entry.name}"
		onclick={() => (open = !open)}
	>
		<span class="chev" aria-hidden="true">{open ? '▾' : '▸'}</span>
		<span class="title">{entry.name}</span>
		<span class="count">{cards.length}</span>
		{#if entry.description}
			<span class="desc">{entry.description}</span>
		{/if}
	</button>
	{#if open}
		<div class="body" id="sec-{entry.name}">
			<div class="card-grid">
				{#each visible as b (b.name)}
					<BenchmarkCard {b} />
				{/each}
			</div>
			{#if hasMore}
				<button
					type="button"
					class="show-more"
					onclick={() => (expanded = !expanded)}
					aria-expanded={expanded}
				>
					{expanded
						? 'Show less'
						: `Show ${cards.length - initialCount} more benchmark${cards.length - initialCount === 1 ? '' : 's'}`}
				</button>
			{/if}
		</div>
	{/if}
</section>

<style>
	.menu-section {
		background: var(--surface);
		border: 1px solid var(--border);
		border-radius: 14px;
		overflow: hidden;
		margin-bottom: 14px;
	}
	.head {
		display: flex;
		align-items: baseline;
		gap: 10px;
		width: 100%;
		padding: 14px 18px;
		background: var(--surface-muted);
		border: none;
		border-bottom: 1px solid transparent;
		cursor: pointer;
		text-align: left;
		font: inherit;
		color: var(--text);
	}
	.menu-section.open .head {
		border-bottom-color: var(--border);
	}
	.head:hover {
		background: color-mix(in srgb, var(--surface-muted) 70%, var(--primary-soft));
	}
	.chev {
		display: inline-block;
		width: 12px;
		color: var(--text-subtle);
		font-size: 12px;
	}
	.title {
		font-size: 16px;
		font-weight: 700;
		color: var(--ink-strong);
	}
	.count {
		font-size: 11px;
		font-weight: 700;
		padding: 1px 7px;
		border-radius: 999px;
		background: var(--surface);
		color: var(--text-muted);
		border: 1px solid var(--border);
	}
	.desc {
		font-size: 12px;
		color: var(--text-muted);
		margin-left: auto;
		text-align: right;
		overflow: hidden;
		text-overflow: ellipsis;
		white-space: nowrap;
		min-width: 0;
	}
	.body {
		padding: 18px;
	}
	.card-grid {
		display: grid;
		grid-template-columns: repeat(4, 1fr);
		gap: 14px;
	}
	.show-more {
		display: block;
		margin: 14px auto 0;
		padding: 8px 18px;
		background: var(--surface);
		color: var(--primary);
		border: 1px solid var(--border);
		border-radius: 999px;
		font-weight: 600;
		font-size: 13px;
		cursor: pointer;
	}
	.show-more:hover {
		color: var(--primary-strong);
		border-color: color-mix(in srgb, var(--primary) 35%, var(--border));
		background: var(--primary-soft);
	}
	.show-more:focus-visible {
		outline: 2px solid var(--primary);
		outline-offset: 2px;
	}
	@media (max-width: 1100px) {
		.card-grid {
			grid-template-columns: repeat(3, 1fr);
		}
	}
	@media (max-width: 820px) {
		.card-grid {
			grid-template-columns: repeat(2, 1fr);
		}
		.desc {
			display: none;
		}
	}
	@media (max-width: 520px) {
		.card-grid {
			grid-template-columns: 1fr;
		}
	}
</style>
