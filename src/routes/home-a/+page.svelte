<script lang="ts">
	// Variant A: featured hero + flatter category browser.
	// Hand-picked featured row at the top, then category sections
	// rendered as always-open grids (no <details> accordion). Removes
	// the click-to-expand step; biggest UX win for least redesign cost.

	import { resolve } from '$app/paths';
	import { loadBenchmarkMenu } from '$lib/data/service';
	import { isBenchmark, type Benchmark, type MenuEntry } from '$lib/types';
	import BenchmarkCard from '$lib/components/BenchmarkCard.svelte';
	import MarkdownText from '$lib/components/MarkdownText.svelte';
	import VariantSwitcher from '$lib/components/HomeVariantSwitcher.svelte';

	let menu = $state<MenuEntry[]>([]);
	let loading = $state(true);

	$effect(() => {
		loadBenchmarkMenu().then((m) => {
			menu = m;
			loading = false;
		});
	});

	const FEATURED_NAMES = ['MTEB(eng, v2)', 'MTEB(Multilingual, v2)', 'HUME(v1)'];

	function allBenchmarks(entries: MenuEntry[]): Benchmark[] {
		const out: Benchmark[] = [];
		const walk = (e: MenuEntry) => {
			for (const c of e.children) {
				if (isBenchmark(c)) out.push(c);
				else walk(c);
			}
		};
		entries.forEach(walk);
		return out;
	}

	let featured = $derived.by(() => {
		const flat = allBenchmarks(menu);
		const byName = new Map(flat.map((b) => [b.name, b]));
		const picked = FEATURED_NAMES.map((n) => byName.get(n)).filter(Boolean) as Benchmark[];
		return picked.length === 3 ? picked : flat.slice(0, 3);
	});

	function countBenchmarks(entry: MenuEntry): number {
		let n = 0;
		for (const c of entry.children) {
			if (isBenchmark(c)) n++;
			else n += countBenchmarks(c);
		}
		return n;
	}
</script>

<VariantSwitcher active="a" />

<div class="page">
	<header class="hero">
		<h1>Embedding leaderboards, ranked.</h1>
		<p class="lead">
			Curated benchmarks across text, image, audio, and video. Start with a featured leaderboard or
			<a class="lead-link" href={resolve('/benchmarks')}>browse all →</a>
		</p>
	</header>

	{#if loading}
		<p class="muted">Loading benchmarks…</p>
	{:else}
		<section class="featured" aria-labelledby="featured-h">
			<div class="section-head">
				<h2 id="featured-h">Featured</h2>
				<span class="kicker">Where most people start</span>
			</div>
			<div class="featured-grid">
				{#each featured as b (b.name)}
					<BenchmarkCard {b} />
				{/each}
			</div>
		</section>

		{#each menu as section (section.name)}
			{@const groups = section.children.filter((c) => !isBenchmark(c)) as MenuEntry[]}
			{@const direct = section.children.filter(isBenchmark) as Benchmark[]}
			<section class="cat" aria-labelledby="cat-{section.name}">
				<div class="section-head">
					<h2 id="cat-{section.name}">{section.name}</h2>
					<span class="kicker">{countBenchmarks(section)} benchmarks</span>
				</div>
				{#if section.description}
					<p class="section-desc"><MarkdownText text={section.description} /></p>
				{/if}
				{#if direct.length > 0}
					<div class="grid">
						{#each direct as b (b.name)}
							<BenchmarkCard {b} />
						{/each}
					</div>
				{/if}
				{#each groups as g (g.name)}
					{@const gDirect = g.children.filter(isBenchmark) as Benchmark[]}
					{#if gDirect.length > 0}
						<h3 class="subhead">{g.name}</h3>
						<div class="grid">
							{#each gDirect as b (b.name)}
								<BenchmarkCard {b} />
							{/each}
						</div>
					{/if}
				{/each}
			</section>
		{/each}
	{/if}
</div>

<style>
	.page {
		max-width: 1280px;
		margin: 0 auto;
		padding: 28px 28px 64px;
	}
	.hero {
		padding: 32px 0 24px;
	}
	h1 {
		font-size: 42px;
		font-weight: 700;
		letter-spacing: -0.02em;
		margin: 0 0 12px;
		color: var(--ink-strong);
	}
	.lead-link {
		font-weight: 600;
	}
	.section-head {
		display: flex;
		align-items: baseline;
		justify-content: space-between;
		gap: 12px;
		margin: 28px 0 12px;
		padding-bottom: 8px;
		border-bottom: 1px solid var(--border);
	}
	.section-head h2 {
		font-size: 22px;
		font-weight: 700;
		margin: 0;
		color: var(--ink-strong);
	}
	.kicker {
		font-size: 12px;
		font-weight: 600;
		color: var(--text-muted);
		text-transform: uppercase;
		letter-spacing: 0.06em;
	}
	.section-desc {
		margin: 0 0 14px;
		color: var(--text-muted);
		max-width: 760px;
	}
	.featured {
		padding: 16px 0 24px;
		border-bottom: 1px solid var(--border);
	}
	.featured-grid {
		display: grid;
		grid-template-columns: repeat(3, 1fr);
		gap: 16px;
	}
	.grid {
		display: grid;
		grid-template-columns: repeat(auto-fill, minmax(280px, 1fr));
		gap: 14px;
	}
	.subhead {
		font-size: 14px;
		font-weight: 700;
		text-transform: uppercase;
		letter-spacing: 0.06em;
		color: var(--text-muted);
		margin: 18px 0 10px;
	}
	@media (max-width: 720px) {
		.featured-grid {
			grid-template-columns: 1fr;
		}
		h1 {
			font-size: 30px;
		}
	}
</style>
