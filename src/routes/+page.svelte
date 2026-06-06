<script lang="ts">
	// Home page: three primary leader tiles (Multilingual / Retrieval /
	// English) above four collapsible sections — Language, Modality,
	// Retrieval, Domain — each driven by the backend's
	// `HOME_BENCHMARK_ENTRIES` menu. Tabs are gone; the menu's flat
	// 4-section shape now drives the layout directly.

	import { untrack } from 'svelte';
	import { resolve } from '$app/paths';
	import { loadBenchmarkMenu, loadLeaders } from '$lib/data/service';
	import { flattenMenu, type Benchmark, type BenchmarkLeaders, type MenuEntry } from '$lib/types';
	import MenuSection from '$lib/components/MenuSection.svelte';
	import PrimaryLeaderTile from '$lib/components/PrimaryLeaderTile.svelte';
	import ShareMeta from '$lib/components/ShareMeta.svelte';

	let menu = $state<MenuEntry[]>([]);
	let loading = $state(true);

	$effect(() => {
		loadBenchmarkMenu().then((m) => {
			menu = m;
			loading = false;
		});
	});

	// Primary tiles — eyebrow label decoupled from benchmark name so
	// "General" can cover both MTEB(Multilingual) and MTEB(eng).
	type Primary = {
		key: 'multilingual' | 'retrieval' | 'english';
		label: string;
		preferred: string;
	};
	const PRIMARIES: Primary[] = [
		{ key: 'multilingual', label: 'General', preferred: 'MTEB(Multilingual, v2)' },
		{ key: 'retrieval', label: 'Retrieval', preferred: 'RTEB(beta)' },
		{ key: 'english', label: 'General', preferred: 'MTEB(eng, v2)' }
	];

	let flat = $derived(flattenMenu(menu));

	let byName = $derived(new Map(flat.map((b) => [b.name, b])));
	function pick(name: string): Benchmark | undefined {
		return byName.get(name);
	}

	// Resolve lazily so the layout still renders if a name is missing.
	let primaries = $derived(
		PRIMARIES.map((p) => ({ ...p, b: pick(p.preferred) })).filter((p) => !!p.b) as Array<
			Primary & { b: Benchmark }
		>
	);

	// Size buckets in MILLIONS of parameters (wire format expected by
	// `/benchmarks/{name}/leaders?buckets=…`). `null` second element
	// = open-ended top bucket. Chip labels switch units at ≥1000M.
	const SIZE_BUCKETS: ReadonlyArray<readonly [number, number | null]> = [
		[0, 500],
		[500, 1000],
		[1000, 5000],
		[5000, null]
	];

	// Per-benchmark leaders cache for the primary hero tiles.
	let primaryLeaders = $state<Record<string, BenchmarkLeaders | 'loading' | 'error'>>({});

	$effect(() => {
		const ps = primaries;
		untrack(() => {
			for (const p of ps) {
				if (primaryLeaders[p.b.name]) continue;
				primaryLeaders[p.b.name] = 'loading';
				loadLeaders(p.b.name, SIZE_BUCKETS)
					.then((r) => {
						primaryLeaders[p.b.name] = r;
					})
					.catch(() => {
						primaryLeaders[p.b.name] = 'error';
					});
			}
		});
	});

	// Sections in the order the backend declares them (matches the
	// HOME_BENCHMARK_ENTRIES order: Language → Modality → Retrieval →
	// Domain).
	let sections = $derived(menu);
</script>

<ShareMeta
	title="Benchmark Overview"
	description="MTEB Leaderboard home — primary General / Retrieval / English benchmark winners plus curated sections for language, modality, retrieval, and domain-specific evaluations."
/>

<div class="page">
	<header class="hero">
		<h1>Benchmark Overview</h1>
		<a class="all-link" href={resolve('/benchmarks')}>See all benchmarks →</a>
	</header>

	{#if loading}
		<p class="muted">Loading benchmarks…</p>
	{:else}
		<section class="primary" aria-label="Featured leaderboards">
			<div class="section-head">
				<span class="eyebrow">Featured</span>
			</div>
			<div class="primary-grid">
				{#each primaries as p (p.key)}
					<PrimaryLeaderTile
						tintKey={p.key}
						label={p.label}
						benchmark={p.b}
						leaders={primaryLeaders[p.b.name]}
					/>
				{/each}
			</div>
		</section>

		<div class="sections">
			{#each sections as s (s.name)}
				<MenuSection entry={s} />
			{/each}
		</div>
	{/if}
</div>

<style>
	.page {
		max-width: 1280px;
		margin: 0 auto;
		padding: 28px 28px 64px;
	}
	.hero {
		display: flex;
		align-items: baseline;
		justify-content: space-between;
		gap: 16px;
		margin: 24px 0 24px;
		flex-wrap: wrap;
	}
	h1 {
		font-size: 32px;
		font-weight: 800;
		letter-spacing: -0.02em;
		margin: 0;
		color: var(--ink-strong);
	}
	.all-link {
		font-weight: 600;
		font-size: 14px;
	}
	.section-head {
		display: flex;
		align-items: baseline;
		gap: 12px;
		margin-bottom: 12px;
		flex-wrap: wrap;
	}
	.eyebrow {
		font-size: 11px;
		font-weight: 800;
		letter-spacing: 0.08em;
		text-transform: uppercase;
		color: var(--primary-strong);
		padding: 3px 8px;
		background: var(--primary-soft);
		border-radius: 999px;
	}
	.primary {
		margin-bottom: 22px;
	}
	.primary-grid {
		display: grid;
		grid-template-columns: repeat(3, 1fr);
		gap: 14px;
	}
	.sections {
		display: flex;
		flex-direction: column;
	}

	@media (max-width: 980px) {
		.primary-grid {
			grid-template-columns: 1fr;
		}
	}
	@media (max-width: 560px) {
		h1 {
			font-size: 24px;
		}
	}
</style>
