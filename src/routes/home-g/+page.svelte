<script lang="ts">
	// Variant G: hero + drawer.
	// One huge benchmark hero front-and-centre with full description +
	// preview; a slim right-side drawer lists every other benchmark as
	// a compact row the user can click to swap into the hero. Editorial
	// approach — gives a single benchmark real weight, at the cost of
	// "browse everything at once" affordance.

	import { resolve } from '$app/paths';
	import { loadBenchmarkMenu } from '$lib/data/service';
	import { isBenchmark, type Benchmark, type MenuEntry } from '$lib/types';
	import MarkdownText from '$lib/components/MarkdownText.svelte';
	import ModalityIcon from '$lib/components/ModalityIcon.svelte';
	import VariantSwitcher from '$lib/components/HomeVariantSwitcher.svelte';

	let menu = $state<MenuEntry[]>([]);
	let loading = $state(true);
	let activeName = $state<string>('');

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
	$effect(() => {
		if (!activeName && flat.length > 0) {
			// Prefer the multilingual MTEB as the default hero — it's the
			// canonical "what most people came here for" benchmark.
			activeName =
				flat.find((b) => b.name === 'MTEB(Multilingual, v2)')?.name ??
				flat[0].name;
		}
	});
	let active = $derived(flat.find((b) => b.name === activeName) ?? flat[0]);

	function paramCount(b: Benchmark | undefined): number {
		return b?.numModels ?? 0;
	}
</script>

<VariantSwitcher active="g" />

<div class="page">
	{#if loading}
		<p class="muted">Loading…</p>
	{:else if active}
		<article class="hero" data-modality={active.modalities[0] ?? 'text'}>
			<div class="head">
				<span class="eyebrow">Today's leaderboard</span>
				<h1>{active.displayName}</h1>
				<code class="name">{active.name}</code>
			</div>
			<div class="desc">
				{#if active.description}
					<MarkdownText text={active.description} />
				{/if}
			</div>
			<div class="stats">
				<div class="stat">
					<span class="num">{paramCount(active).toLocaleString()}</span>
					<span class="lbl">models tracked</span>
				</div>
				<div class="stat">
					<span class="num">{active.tasks.length}</span>
					<span class="lbl">tasks</span>
				</div>
				<div class="stat">
					<span class="num">{active.languages.length}</span>
					<span class="lbl">languages</span>
				</div>
				<div class="stat">
					<span class="num">{active.taskTypes.length}</span>
					<span class="lbl">task types</span>
				</div>
			</div>
			<div class="cta-row">
				<a
					class="cta primary"
					href={resolve('/benchmark/[name]', { name: active.name })}
				>
					Open leaderboard →
				</a>
				<a class="cta ghost" href={resolve('/benchmarks')}>Browse all {flat.length}</a>
			</div>
		</article>

		<aside class="drawer">
			<div class="drawer-head">
				<h2>Other benchmarks</h2>
				<span class="kicker">{flat.length - 1}</span>
			</div>
			<ul>
				{#each flat as b (b.name)}
					{#if b.name !== active.name}
						<li>
							<button
								type="button"
								class="row"
								data-modality={b.modalities[0] ?? 'text'}
								onclick={() => (activeName = b.name)}
							>
								<span class="row-modality">
									<ModalityIcon modality={b.modalities[0] ?? 'text'} size={14} />
								</span>
								<span class="row-text">
									<span class="row-title">{b.displayName}</span>
									<span class="row-meta">
										{b.tasks.length} tasks · {b.languages.length} langs
									</span>
								</span>
							</button>
						</li>
					{/if}
				{/each}
			</ul>
		</aside>
	{/if}
</div>

<style>
	.page {
		display: grid;
		grid-template-columns: minmax(0, 1fr) 320px;
		gap: 28px;
		max-width: 1400px;
		margin: 0 auto;
		padding: 28px 28px 64px;
	}
	.hero {
		--tint: var(--tint-blue);
		--tint-fg: var(--tint-blue-fg);
		display: flex;
		flex-direction: column;
		gap: 22px;
		padding: 40px;
		background: linear-gradient(
			135deg,
			color-mix(in srgb, var(--tint) 75%, var(--surface)),
			var(--surface) 75%
		);
		border: 1px solid color-mix(in srgb, var(--tint-fg) 22%, var(--border));
		border-radius: 20px;
		box-shadow: 0 1px 2px rgb(var(--shadow-tint) / 0.04);
	}
	.hero[data-modality='image'] {
		--tint: var(--tint-purple);
		--tint-fg: var(--tint-purple-fg);
	}
	.hero[data-modality='audio'] {
		--tint: var(--tint-amber);
		--tint-fg: var(--tint-amber-fg);
	}
	.hero[data-modality='video'] {
		--tint: var(--tint-pink);
		--tint-fg: var(--tint-pink-fg);
	}
	.eyebrow {
		font-size: 12px;
		font-weight: 700;
		letter-spacing: 0.08em;
		text-transform: uppercase;
		color: var(--tint-fg);
	}
	.hero h1 {
		font-size: 48px;
		font-weight: 800;
		letter-spacing: -0.02em;
		margin: 6px 0 4px;
		color: var(--ink-strong);
		line-height: 1.05;
	}
	.name {
		font-size: 13px;
		color: var(--text-muted);
		font-family: var(--font-mono, monospace);
	}
	.desc {
		font-size: 15px;
		line-height: 1.6;
		color: var(--text);
		max-width: 70ch;
	}
	.stats {
		display: grid;
		grid-template-columns: repeat(4, 1fr);
		gap: 14px;
		padding: 18px 0;
		border-top: 1px solid color-mix(in srgb, var(--tint-fg) 22%, var(--border));
		border-bottom: 1px solid color-mix(in srgb, var(--tint-fg) 22%, var(--border));
	}
	.stat {
		display: flex;
		flex-direction: column;
		gap: 2px;
	}
	.stat .num {
		font-size: 24px;
		font-weight: 700;
		color: var(--ink-strong);
		font-variant-numeric: tabular-nums;
	}
	.stat .lbl {
		font-size: 11px;
		font-weight: 600;
		color: var(--text-muted);
		text-transform: uppercase;
		letter-spacing: 0.05em;
	}
	.cta-row {
		display: flex;
		gap: 10px;
	}
	.cta {
		display: inline-flex;
		align-items: center;
		padding: 10px 18px;
		font-size: 14px;
		font-weight: 600;
		border-radius: 999px;
		text-decoration: none;
	}
	.cta.primary {
		color: var(--surface);
		background: var(--tint-fg);
	}
	.cta.primary:hover {
		filter: brightness(1.1);
	}
	.cta.ghost {
		color: var(--text-muted);
		border: 1px solid var(--border);
	}
	.cta.ghost:hover {
		color: var(--text);
		border-color: var(--border-strong);
	}
	.drawer {
		position: sticky;
		top: calc(var(--header-offset, 56px) + 36px);
		max-height: calc(100vh - var(--header-offset, 56px) - 72px);
		display: flex;
		flex-direction: column;
		min-height: 0;
		border: 1px solid var(--border);
		border-radius: 16px;
		background: var(--surface);
		overflow: hidden;
	}
	.drawer-head {
		display: flex;
		align-items: baseline;
		justify-content: space-between;
		padding: 14px 16px;
		border-bottom: 1px solid var(--border);
	}
	.drawer-head h2 {
		font-size: 14px;
		font-weight: 700;
		margin: 0;
		color: var(--ink-strong);
	}
	.drawer .kicker {
		font-size: 11px;
		font-weight: 700;
		color: var(--text-muted);
		text-transform: uppercase;
		letter-spacing: 0.06em;
	}
	.drawer ul {
		list-style: none;
		margin: 0;
		padding: 6px;
		overflow-y: auto;
		scrollbar-width: thin;
	}
	.row {
		all: unset;
		cursor: pointer;
		display: flex;
		align-items: center;
		gap: 10px;
		width: 100%;
		padding: 10px 10px;
		border-radius: 8px;
		box-sizing: border-box;
	}
	.row:hover {
		background: var(--surface-muted);
	}
	.row-modality {
		display: inline-flex;
		width: 24px;
		height: 24px;
		align-items: center;
		justify-content: center;
		border-radius: 6px;
		background: var(--surface-muted);
		color: var(--text-muted);
	}
	.row-text {
		display: flex;
		flex-direction: column;
		gap: 2px;
		min-width: 0;
		flex: 1;
	}
	.row-title {
		font-size: 13px;
		font-weight: 600;
		color: var(--text);
		overflow: hidden;
		text-overflow: ellipsis;
		white-space: nowrap;
	}
	.row-meta {
		font-size: 11px;
		color: var(--text-muted);
		font-variant-numeric: tabular-nums;
	}
	@media (max-width: 880px) {
		.page {
			grid-template-columns: 1fr;
		}
		.drawer {
			position: static;
			max-height: 380px;
		}
		.hero h1 {
			font-size: 32px;
		}
	}
</style>
