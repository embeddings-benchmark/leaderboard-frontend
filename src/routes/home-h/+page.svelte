<script lang="ts">
	// Variant H: decision wizard.
	// Three "intent" cards at the top — researching, benchmarking own
	// model, just browsing. Selecting one reveals a tailored shortlist
	// + helpful follow-ups below. Opinionated; treats the home page as
	// an onboarding step rather than a directory.

	import { resolve } from '$app/paths';
	import { loadBenchmarkMenu } from '$lib/data/service';
	import { isBenchmark, type Benchmark, type MenuEntry } from '$lib/types';
	import BenchmarkCard from '$lib/components/BenchmarkCard.svelte';
	import VariantSwitcher from '$lib/components/HomeVariantSwitcher.svelte';

	let menu = $state<MenuEntry[]>([]);
	let loading = $state(true);
	let intent = $state<'research' | 'submit' | 'browse' | null>(null);

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
	let researchPicks = $derived(
		pick(['MTEB(Multilingual, v2)', 'MTEB(eng, v2)', 'MIEB(eng)', 'MAEB(beta)'])
	);
	let submitPicks = $derived(pick(['MTEB(eng, v2)', 'MIEB(eng)', 'MAEB(beta)']));
</script>

<VariantSwitcher active="h" />

<div class="page">
	<header class="hero">
		<h1>What are you trying to do?</h1>
		<p class="lead">Pick the closest match — we'll point you at the right leaderboard.</p>
	</header>

	<section class="intents" aria-label="Pick your intent">
		<button
			type="button"
			class="intent"
			class:on={intent === 'research'}
			onclick={() => (intent = 'research')}
			data-tint="blue"
		>
			<svg viewBox="0 0 24 24" width="22" height="22" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
				<circle cx="11" cy="11" r="7" /><path d="M21 21l-4.3-4.3" />
			</svg>
			<h2>I'm researching a model</h2>
			<p>Find which model leads on a benchmark you care about.</p>
		</button>
		<button
			type="button"
			class="intent"
			class:on={intent === 'submit'}
			onclick={() => (intent = 'submit')}
			data-tint="green"
		>
			<svg viewBox="0 0 24 24" width="22" height="22" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
				<path d="M12 19V5" /><path d="M5 12l7-7 7 7" />
			</svg>
			<h2>I'm benchmarking my own model</h2>
			<p>Pick the evaluation suite, run it locally, and submit your scores.</p>
		</button>
		<button
			type="button"
			class="intent"
			class:on={intent === 'browse'}
			onclick={() => (intent = 'browse')}
			data-tint="purple"
		>
			<svg viewBox="0 0 24 24" width="22" height="22" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
				<rect x="3" y="3" width="7" height="7" /><rect x="14" y="3" width="7" height="7" /><rect x="3" y="14" width="7" height="7" /><rect x="14" y="14" width="7" height="7" />
			</svg>
			<h2>I'm just browsing</h2>
			<p>Show me everything — I'll find what's interesting.</p>
		</button>
	</section>

	{#if loading}
		<p class="muted">Loading…</p>
	{:else if intent === 'research'}
		<section class="result">
			<h3>Start with one of these leaderboards</h3>
			<p class="result-help">
				These cover most of the embeddings landscape — pick by modality / language.
			</p>
			<div class="grid">
				{#each researchPicks as b (b.name)}
					<BenchmarkCard {b} />
				{/each}
			</div>
			<a class="more" href={resolve('/benchmarks')}>See all {flat.length} benchmarks →</a>
		</section>
	{:else if intent === 'submit'}
		<section class="result">
			<h3>Pick an evaluation suite</h3>
			<p class="result-help">
				Pick the suite that matches the kind of model you trained, then follow the run-locally
				steps in the suite's reference.
			</p>
			<div class="grid">
				{#each submitPicks as b (b.name)}
					<BenchmarkCard {b} />
				{/each}
			</div>
			<a class="more" href="https://github.com/embeddings-benchmark/mteb#how-to-add-a-task">
				How to add a task & submit results →
			</a>
		</section>
	{:else if intent === 'browse'}
		<section class="result">
			<h3>Everything we have</h3>
			<p class="result-help">{flat.length} benchmarks total — sort, filter, and dive in.</p>
			<div class="grid">
				{#each flat.slice(0, 12) as b (b.name)}
					<BenchmarkCard {b} />
				{/each}
			</div>
			<a class="more" href={resolve('/benchmarks')}>Open the full catalogue →</a>
		</section>
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
		text-align: center;
	}
	h1 {
		font-size: 38px;
		font-weight: 700;
		letter-spacing: -0.02em;
		margin: 0 0 10px;
		color: var(--ink-strong);
	}
	.lead {
		color: var(--text-muted);
		margin: 0;
		font-size: 16px;
	}
	.intents {
		display: grid;
		grid-template-columns: repeat(3, 1fr);
		gap: 16px;
		margin: 24px 0 36px;
	}
	.intent {
		all: unset;
		cursor: pointer;
		display: flex;
		flex-direction: column;
		gap: 8px;
		padding: 22px;
		background: var(--surface);
		border: 1px solid var(--border);
		border-radius: 16px;
		box-shadow: 0 1px 2px rgb(var(--shadow-tint) / 0.04);
		transition:
			transform 0.14s,
			border-color 0.14s,
			background 0.14s;
	}
	.intent[data-tint='blue'] {
		--ti: var(--tint-blue);
		--ti-fg: var(--tint-blue-fg);
	}
	.intent[data-tint='green'] {
		--ti: var(--tint-green);
		--ti-fg: var(--tint-green-fg);
	}
	.intent[data-tint='purple'] {
		--ti: var(--tint-purple);
		--ti-fg: var(--tint-purple-fg);
	}
	.intent svg {
		width: 28px;
		height: 28px;
		padding: 6px;
		border-radius: 10px;
		background: var(--ti);
		color: var(--ti-fg);
	}
	.intent h2 {
		font-size: 17px;
		font-weight: 700;
		color: var(--ink-strong);
		margin: 6px 0 0;
	}
	.intent p {
		color: var(--text-muted);
		font-size: 13px;
		margin: 0;
		line-height: 1.45;
	}
	.intent:hover {
		transform: translateY(-2px);
		border-color: var(--ti-fg);
	}
	.intent.on {
		border-color: var(--ti-fg);
		background: linear-gradient(180deg, color-mix(in srgb, var(--ti) 55%, var(--surface)), var(--surface));
		box-shadow: 0 0 0 2px color-mix(in srgb, var(--ti-fg) 25%, transparent);
	}
	.result h3 {
		font-size: 22px;
		font-weight: 700;
		margin: 0 0 6px;
		color: var(--ink-strong);
	}
	.result-help {
		color: var(--text-muted);
		margin: 0 0 16px;
		max-width: 60ch;
	}
	.grid {
		display: grid;
		grid-template-columns: repeat(4, 1fr);
		gap: 14px;
	}
	.more {
		display: inline-block;
		margin-top: 18px;
		font-weight: 600;
		font-size: 14px;
	}
	@media (max-width: 880px) {
		.intents {
			grid-template-columns: 1fr;
		}
		.grid {
			grid-template-columns: repeat(2, 1fr);
		}
	}
	@media (max-width: 560px) {
		.grid {
			grid-template-columns: 1fr;
		}
		h1 {
			font-size: 28px;
		}
	}
</style>
