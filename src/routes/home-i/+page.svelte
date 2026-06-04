<script lang="ts">
	// Variant I: bento dashboard.
	// Mixed-size grid — quick stats banner, one big featured cell, a
	// "trending" cell, three medium cells, then a wide cell for the
	// catalogue strip. Apple-style. Editorial-leaning; the "trending"
	// slot needs maintaining over time but the visual structure reads
	// as deliberate rather than directory-listy.

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

	function flatten(entries: MenuEntry[]): Benchmark[] {
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
	let flat = $derived(flatten(menu));
	function pick(names: string[]): Benchmark[] {
		const byName = new Map(flat.map((b) => [b.name, b]));
		return names.map((n) => byName.get(n)).filter(Boolean) as Benchmark[];
	}
	let featured = $derived(pick(['MTEB(Multilingual, v2)'])[0] ?? flat[0]);
	let trending = $derived(pick(['MTEB(eng, v2)'])[0] ?? flat[1]);
	let secondary = $derived(pick(['MIEB(eng)', 'MAEB(beta)'])); // 2 medium tiles
	let strip = $derived(flat.slice(0, 4));

	let stats = $derived.by(() => {
		let totalModels = 0;
		const taskSet = new Set<string>();
		const langSet = new Set<string>();
		for (const b of flat) {
			b.tasks.forEach((t) => taskSet.add(t));
			b.languages.forEach((l) => langSet.add(l));
			totalModels = Math.max(totalModels, b.numModels ?? 0);
		}
		return { benchmarks: flat.length, tasks: taskSet.size, models: totalModels, langs: langSet.size };
	});
</script>

<VariantSwitcher active="i" />

<div class="page">
	{#if loading}
		<p class="muted">Loading…</p>
	{:else}
		<div class="bento">
			<aside class="cell stats">
				<div class="stat-row">
					<div class="stat">
						<span class="num">{stats.models.toLocaleString()}</span>
						<span class="lbl">models</span>
					</div>
					<div class="stat">
						<span class="num">{stats.benchmarks}</span>
						<span class="lbl">benchmarks</span>
					</div>
					<div class="stat">
						<span class="num">{stats.tasks.toLocaleString()}</span>
						<span class="lbl">tasks</span>
					</div>
					<div class="stat">
						<span class="num">{stats.langs}+</span>
						<span class="lbl">languages</span>
					</div>
				</div>
			</aside>

			<article class="cell featured">
				<span class="eyebrow">Featured</span>
				<h2>{featured?.displayName}</h2>
				<p>{featured?.description?.slice(0, 220) ?? ''}</p>
				<a
					class="cta"
					href={resolve('/benchmark/[name]', { name: featured?.name ?? '' })}
				>
					Open →
				</a>
			</article>

			<article class="cell trending">
				<span class="eyebrow">Most popular</span>
				<h3>{trending?.displayName}</h3>
				<div class="row">
					<span class="badge">{trending?.tasks.length} tasks</span>
					<span class="badge">{trending?.numModels ?? 0} models</span>
				</div>
				<a
					class="link"
					href={resolve('/benchmark/[name]', { name: trending?.name ?? '' })}
				>
					Open →
				</a>
			</article>

			{#each secondary as b, i (b.name)}
				<article class="cell sec" data-i={i}>
					<h4>{b.displayName}</h4>
					<p>{b.description?.slice(0, 100) ?? ''}</p>
					<a class="link" href={resolve('/benchmark/[name]', { name: b.name })}>Open →</a>
				</article>
			{/each}

			<section class="cell strip">
				<div class="strip-head">
					<h3>More leaderboards</h3>
					<a href={resolve('/benchmarks')} class="see-all">See all →</a>
				</div>
				<div class="strip-grid">
					{#each strip as b (b.name)}
						<BenchmarkCard {b} />
					{/each}
				</div>
			</section>
		</div>
	{/if}
</div>

<style>
	.page {
		max-width: 1280px;
		margin: 0 auto;
		padding: 28px 28px 64px;
	}
	.bento {
		display: grid;
		grid-template-columns: repeat(6, 1fr);
		grid-auto-rows: minmax(120px, auto);
		gap: 14px;
	}
	.cell {
		padding: 22px;
		background: var(--surface);
		border: 1px solid var(--border);
		border-radius: 18px;
		display: flex;
		flex-direction: column;
		gap: 8px;
		box-shadow: 0 1px 2px rgb(var(--shadow-tint) / 0.04);
	}
	.stats {
		grid-column: span 6;
		padding: 22px 26px;
	}
	.stat-row {
		display: grid;
		grid-template-columns: repeat(4, 1fr);
		gap: 14px;
	}
	.stat {
		display: flex;
		flex-direction: column;
		gap: 2px;
	}
	.stat .num {
		font-size: 30px;
		font-weight: 700;
		color: var(--primary-strong);
		letter-spacing: -0.02em;
		font-variant-numeric: tabular-nums;
	}
	.stat .lbl {
		font-size: 12px;
		font-weight: 600;
		color: var(--text-muted);
		text-transform: uppercase;
		letter-spacing: 0.05em;
	}
	.featured {
		grid-column: span 4;
		grid-row: span 2;
		background: linear-gradient(
			135deg,
			color-mix(in srgb, var(--tint-blue) 70%, var(--surface)),
			var(--surface) 75%
		);
		border-color: color-mix(in srgb, var(--tint-blue-fg) 22%, var(--border));
		min-height: 240px;
		justify-content: flex-start;
	}
	.featured h2 {
		font-size: 36px;
		font-weight: 800;
		letter-spacing: -0.02em;
		margin: 6px 0 0;
		color: var(--ink-strong);
	}
	.featured p {
		font-size: 14px;
		line-height: 1.5;
		color: var(--text);
		margin: 6px 0 8px;
		max-width: 60ch;
	}
	.trending {
		grid-column: span 2;
		grid-row: span 2;
		background: linear-gradient(
			135deg,
			color-mix(in srgb, var(--tint-green) 70%, var(--surface)),
			var(--surface) 75%
		);
		border-color: color-mix(in srgb, var(--tint-green-fg) 22%, var(--border));
	}
	.trending h3 {
		font-size: 22px;
		font-weight: 700;
		margin: 6px 0;
		color: var(--ink-strong);
	}
	.eyebrow {
		font-size: 11px;
		font-weight: 800;
		letter-spacing: 0.08em;
		text-transform: uppercase;
		color: var(--primary-strong);
	}
	.row {
		display: flex;
		gap: 6px;
		flex-wrap: wrap;
	}
	.badge {
		font-size: 11px;
		font-weight: 600;
		padding: 2px 8px;
		border-radius: 999px;
		background: var(--surface-muted);
		color: var(--text-muted);
	}
	.sec {
		grid-column: span 3;
	}
	.sec[data-i='1'] {
		background: color-mix(in srgb, var(--tint-amber) 30%, var(--surface));
		border-color: color-mix(in srgb, var(--tint-amber-fg) 18%, var(--border));
	}
	.sec h4 {
		font-size: 18px;
		font-weight: 700;
		margin: 0;
		color: var(--ink-strong);
	}
	.sec p {
		font-size: 13px;
		line-height: 1.45;
		color: var(--text-muted);
		margin: 0;
		flex: 1;
	}
	.strip {
		grid-column: span 6;
		gap: 14px;
	}
	.strip-head {
		display: flex;
		align-items: baseline;
		justify-content: space-between;
	}
	.strip-head h3 {
		font-size: 18px;
		font-weight: 700;
		margin: 0;
	}
	.strip-grid {
		display: grid;
		grid-template-columns: repeat(4, 1fr);
		gap: 14px;
	}
	.cta {
		display: inline-flex;
		padding: 8px 16px;
		font-size: 13px;
		font-weight: 600;
		border-radius: 999px;
		color: var(--surface);
		background: var(--primary);
		text-decoration: none;
		align-self: flex-start;
		margin-top: auto;
	}
	.cta:hover {
		filter: brightness(1.05);
	}
	.link {
		font-weight: 600;
		font-size: 13px;
		margin-top: auto;
	}
	.see-all {
		font-size: 12px;
		font-weight: 600;
		text-transform: uppercase;
		letter-spacing: 0.06em;
	}
	@media (max-width: 980px) {
		.featured,
		.trending {
			grid-column: span 6;
			grid-row: auto;
		}
		.sec {
			grid-column: span 3;
		}
		.strip-grid {
			grid-template-columns: repeat(2, 1fr);
		}
	}
	@media (max-width: 560px) {
		.bento {
			grid-template-columns: 1fr;
		}
		.featured,
		.trending,
		.sec,
		.strip,
		.stats {
			grid-column: 1;
		}
		.stat-row {
			grid-template-columns: repeat(2, 1fr);
		}
		.strip-grid {
			grid-template-columns: 1fr;
		}
		.featured h2 {
			font-size: 26px;
		}
	}
</style>
