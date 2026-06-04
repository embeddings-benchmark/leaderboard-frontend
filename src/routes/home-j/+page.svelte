<script lang="ts">
	// Variant J: modality quadrant.
	// 2x2 grid where each quadrant is a modality (text / image / audio /
	// video) showing the top 3-4 benchmarks for that modality. Visual,
	// scannable in one viewport. Trades exhaustiveness for clarity —
	// modalities that don't fit the four-cell model are surfaced via a
	// catch-all bottom strip ("Other categories") instead of getting
	// dropped.

	import { resolve } from '$app/paths';
	import { loadBenchmarkMenu } from '$lib/data/service';
	import { isBenchmark, type Benchmark, type MenuEntry } from '$lib/types';
	import VariantSwitcher from '$lib/components/HomeVariantSwitcher.svelte';
	import ModalityIcon from '$lib/components/ModalityIcon.svelte';

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

	type QId = 'text' | 'image' | 'audio' | 'video';
	const QUADRANTS: Array<{ id: QId; title: string }> = [
		{ id: 'text', title: 'Text' },
		{ id: 'image', title: 'Image' },
		{ id: 'audio', title: 'Audio' },
		{ id: 'video', title: 'Video' }
	];

	function pickPrimary(modality: QId): Benchmark[] {
		// Curated picks per quadrant — the canonical "where most people
		// start" benchmark first, then the next 2-3 by descending model
		// count to surface the most-used ones.
		const preferred: Record<QId, string[]> = {
			text: ['MTEB(Multilingual, v2)', 'MTEB(eng, v2)'],
			image: ['MIEB(eng)', 'MIEB(Multilingual)'],
			audio: ['MAEB(beta)', 'MAEB(beta, audio-only)'],
			video: []
		};
		const byName = new Map(flat.map((b) => [b.name, b]));
		const picked: Benchmark[] = [];
		for (const n of preferred[modality]) {
			const b = byName.get(n);
			if (b) picked.push(b);
		}
		const seen = new Set(picked.map((b) => b.name));
		const others = flat
			.filter((b) => b.modalities.includes(modality) && !seen.has(b.name))
			.sort((a, b) => (b.numModels ?? 0) - (a.numModels ?? 0));
		for (const b of others) {
			if (picked.length >= 4) break;
			picked.push(b);
		}
		return picked;
	}

	function totalIn(modality: QId): number {
		return flat.filter((b) => b.modalities.includes(modality)).length;
	}
</script>

<VariantSwitcher active="j" />

<div class="page">
	<header class="hero">
		<h1>Explore by modality</h1>
		<p class="lead">Pick the kind of data you care about — every leaderboard is one click away.</p>
	</header>

	{#if loading}
		<p class="muted">Loading…</p>
	{:else}
		<div class="quad-grid">
			{#each QUADRANTS as q (q.id)}
				{@const picks = pickPrimary(q.id)}
				{@const total = totalIn(q.id)}
				<section class="quad" data-modality={q.id}>
					<header class="quad-head">
						<span class="quad-icon"><ModalityIcon modality={q.id} size={18} /></span>
						<h2>{q.title}</h2>
						<span class="quad-count">{total}</span>
					</header>
					{#if picks.length === 0}
						<p class="empty">No leaderboards yet — coming soon.</p>
					{:else}
						<ul class="picks">
							{#each picks as b (b.name)}
								<li>
									<a class="pick" href={resolve('/benchmark/[name]', { name: b.name })}>
										<span class="pick-title">{b.displayName}</span>
										<span class="pick-meta">
											{b.tasks.length} tasks · {b.languages.length} langs
										</span>
									</a>
								</li>
							{/each}
						</ul>
					{/if}
					{#if total > picks.length}
						<a class="see-more" href={`${resolve('/benchmarks')}?modality=${q.id}`}>
							See all {total} {q.title.toLowerCase()} leaderboards →
						</a>
					{/if}
				</section>
			{/each}
		</div>

		<a class="all-link" href={resolve('/benchmarks')}>Browse every benchmark →</a>
	{/if}
</div>

<style>
	.page {
		max-width: 1280px;
		margin: 0 auto;
		padding: 28px 28px 64px;
	}
	.hero {
		text-align: center;
		padding: 32px 0 28px;
	}
	h1 {
		font-size: 38px;
		font-weight: 700;
		letter-spacing: -0.02em;
		margin: 0 0 8px;
		color: var(--ink-strong);
	}
	.lead {
		color: var(--text-muted);
		margin: 0;
	}
	.quad-grid {
		display: grid;
		grid-template-columns: repeat(2, 1fr);
		gap: 18px;
	}
	.quad {
		--tint: var(--tint-teal);
		--tint-fg: var(--tint-teal-fg);
		display: flex;
		flex-direction: column;
		gap: 12px;
		padding: 24px;
		background: linear-gradient(
			135deg,
			color-mix(in srgb, var(--tint) 75%, var(--surface)),
			var(--surface) 70%
		);
		border: 1px solid color-mix(in srgb, var(--tint-fg) 22%, var(--border));
		border-radius: 18px;
		box-shadow: 0 1px 2px rgb(var(--shadow-tint) / 0.04);
		min-height: 280px;
	}
	.quad[data-modality='image'] {
		--tint: var(--tint-blue);
		--tint-fg: var(--tint-blue-fg);
	}
	.quad[data-modality='audio'] {
		--tint: var(--tint-amber);
		--tint-fg: var(--tint-amber-fg);
	}
	.quad[data-modality='video'] {
		--tint: var(--tint-purple);
		--tint-fg: var(--tint-purple-fg);
	}
	.quad-head {
		display: flex;
		align-items: center;
		gap: 10px;
		padding-bottom: 12px;
		border-bottom: 1px solid color-mix(in srgb, var(--tint-fg) 22%, var(--border));
	}
	.quad-icon {
		display: inline-flex;
		align-items: center;
		justify-content: center;
		width: 32px;
		height: 32px;
		border-radius: 8px;
		background: var(--surface);
		color: var(--tint-fg);
	}
	.quad-head h2 {
		font-size: 22px;
		font-weight: 700;
		margin: 0;
		color: var(--ink-strong);
		flex: 1;
	}
	.quad-count {
		font-size: 12px;
		font-weight: 700;
		padding: 4px 10px;
		border-radius: 999px;
		background: var(--surface);
		color: var(--tint-fg);
	}
	.picks {
		list-style: none;
		margin: 0;
		padding: 0;
		display: flex;
		flex-direction: column;
		gap: 4px;
	}
	.pick {
		display: flex;
		flex-direction: column;
		gap: 2px;
		padding: 10px 12px;
		border-radius: 10px;
		text-decoration: none;
		color: inherit;
		transition: background 0.1s;
	}
	.pick:hover {
		background: color-mix(in srgb, var(--surface) 90%, var(--tint-fg) 10%);
	}
	.pick-title {
		font-size: 15px;
		font-weight: 700;
		color: var(--ink-strong);
	}
	.pick-meta {
		font-size: 12px;
		color: var(--text-muted);
		font-variant-numeric: tabular-nums;
	}
	.see-more {
		margin-top: auto;
		font-size: 12px;
		font-weight: 600;
		color: var(--tint-fg);
		text-decoration: none;
	}
	.see-more:hover {
		text-decoration: underline;
	}
	.empty {
		color: var(--text-muted);
		font-style: italic;
		margin: 0;
	}
	.all-link {
		display: inline-block;
		margin-top: 28px;
		font-weight: 600;
	}
	@media (max-width: 760px) {
		.quad-grid {
			grid-template-columns: 1fr;
		}
		h1 {
			font-size: 28px;
		}
	}
</style>
