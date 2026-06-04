<script lang="ts">
	// Variant B: editorial / magazine.
	// Quick-stats banner, hero, featured row, then each category as a
	// horizontal scroller with snap so the page reads like a magazine
	// homepage rather than a directory listing.

	import { resolve } from '$app/paths';
	import { loadBenchmarkMenu } from '$lib/data/service';
	import { isBenchmark, type Benchmark, type MenuEntry } from '$lib/types';
	import BenchmarkCard from '$lib/components/BenchmarkCard.svelte';
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

	let flat = $derived(allBenchmarks(menu));
	let stats = $derived.by(() => {
		// Pre-compute aggregates from the menu — best-available numbers,
		// since we don't have a separate stats endpoint.
		const benchCount = flat.length;
		const taskNames = new Set<string>();
		const langSet = new Set<string>();
		let totalModels = 0;
		for (const b of flat) {
			b.tasks.forEach((t) => taskNames.add(t));
			b.languages.forEach((l) => langSet.add(l));
			totalModels = Math.max(totalModels, b.numModels ?? 0);
		}
		return {
			benchCount,
			taskCount: taskNames.size,
			languages: langSet.size,
			topModelCount: totalModels
		};
	});

	let featured = $derived.by(() => {
		const byName = new Map(flat.map((b) => [b.name, b]));
		const picked = FEATURED_NAMES.map((n) => byName.get(n)).filter(Boolean) as Benchmark[];
		return picked.length === 3 ? picked : flat.slice(0, 3);
	});

	function topLevelBenchmarks(section: MenuEntry): Benchmark[] {
		// Flatten one level deep so each scroller has enough cards.
		const out: Benchmark[] = [];
		for (const c of section.children) {
			if (isBenchmark(c)) out.push(c);
			else for (const cc of c.children) if (isBenchmark(cc)) out.push(cc);
		}
		return out;
	}
</script>

<VariantSwitcher active="b" />

<div class="page">
	{#if !loading}
		<aside class="stats" aria-label="Leaderboard stats">
			<div class="stat">
				<span class="num">{stats.topModelCount.toLocaleString()}</span>
				<span class="lbl">top models tracked</span>
			</div>
			<div class="stat">
				<span class="num">{stats.benchCount}</span>
				<span class="lbl">benchmarks</span>
			</div>
			<div class="stat">
				<span class="num">{stats.taskCount.toLocaleString()}</span>
				<span class="lbl">tasks</span>
			</div>
			<div class="stat">
				<span class="num">{stats.languages}+</span>
				<span class="lbl">languages</span>
			</div>
		</aside>
	{/if}

	<header class="hero">
		<h1>The state of embedding models, ranked.</h1>
		<p class="lead">
			Benchmarks span text, image, audio, and video — all submitted by the research community.
			<a class="lead-link" href={resolve('/benchmarks')}>Browse all →</a>
		</p>
	</header>

	{#if loading}
		<p class="muted">Loading benchmarks…</p>
	{:else}
		<section class="featured">
			<div class="section-head">
				<h2>Featured</h2>
				<a class="see-all" href={resolve('/benchmarks')}>See all →</a>
			</div>
			<div class="featured-grid">
				{#each featured as b (b.name)}
					<BenchmarkCard {b} />
				{/each}
			</div>
		</section>

		{#each menu as section (section.name)}
			{@const benches = topLevelBenchmarks(section)}
			{#if benches.length > 0}
				<section class="scroll-row" aria-labelledby="scr-{section.name}">
					<div class="section-head">
						<h2 id="scr-{section.name}">{section.name}</h2>
						<span class="kicker">{benches.length} benchmarks</span>
					</div>
					<div class="scroller" role="list">
						{#each benches as b (b.name)}
							<div class="scroll-card" role="listitem">
								<BenchmarkCard {b} />
							</div>
						{/each}
					</div>
				</section>
			{/if}
		{/each}
	{/if}
</div>

<style>
	.page {
		max-width: 1280px;
		margin: 0 auto;
		padding: 20px 28px 64px;
	}
	.stats {
		display: grid;
		grid-template-columns: repeat(4, 1fr);
		gap: 14px;
		padding: 20px 22px;
		margin: 8px 0 28px;
		background: linear-gradient(
			135deg,
			color-mix(in srgb, var(--primary) 14%, var(--surface)),
			var(--surface) 70%
		);
		border: 1px solid color-mix(in srgb, var(--primary) 22%, var(--border));
		border-radius: 14px;
		box-shadow: 0 1px 2px rgb(var(--shadow-tint) / 0.04);
	}
	.stat {
		display: flex;
		flex-direction: column;
		gap: 2px;
	}
	.stat .num {
		font-size: 28px;
		font-weight: 700;
		letter-spacing: -0.02em;
		color: var(--primary-strong);
		font-variant-numeric: tabular-nums;
	}
	.stat .lbl {
		font-size: 12px;
		font-weight: 600;
		color: var(--text-muted);
		text-transform: uppercase;
		letter-spacing: 0.05em;
	}
	.hero {
		padding: 16px 0 28px;
	}
	h1 {
		font-size: 44px;
		font-weight: 700;
		letter-spacing: -0.02em;
		margin: 0 0 12px;
		color: var(--ink-strong);
		line-height: 1.1;
		max-width: 18ch;
	}
	.lead {
		max-width: 60ch;
		font-size: 16px;
		color: var(--text-muted);
		margin: 0;
	}
	.lead-link {
		font-weight: 600;
	}
	.section-head {
		display: flex;
		align-items: baseline;
		justify-content: space-between;
		gap: 12px;
		margin: 28px 0 14px;
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
	.see-all {
		font-size: 12px;
		font-weight: 600;
		text-transform: uppercase;
		letter-spacing: 0.06em;
	}
	.featured-grid {
		display: grid;
		grid-template-columns: repeat(3, 1fr);
		gap: 16px;
	}
	.scroller {
		display: flex;
		gap: 14px;
		overflow-x: auto;
		scroll-snap-type: x mandatory;
		padding: 4px 4px 14px;
		margin: 0 -4px;
		scrollbar-width: thin;
	}
	.scroll-card {
		flex: 0 0 320px;
		scroll-snap-align: start;
	}
	@media (max-width: 720px) {
		.stats {
			grid-template-columns: repeat(2, 1fr);
		}
		.featured-grid {
			grid-template-columns: 1fr;
		}
		h1 {
			font-size: 30px;
		}
		.scroll-card {
			flex-basis: 78vw;
		}
	}
</style>
