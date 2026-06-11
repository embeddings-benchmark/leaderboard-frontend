<script lang="ts">
	// Home page: three primary leader tiles (Multilingual / Retrieval /
	// English) above four collapsible sections — Language, Modality,
	// Retrieval, Domain — each driven by the backend's
	// `HOME_BENCHMARK_ENTRIES` menu. Tabs are gone; the menu's flat
	// 4-section shape now drives the layout directly.
	//
	// Data lands via the +page.ts loader. `data.menu` and `data.primaries`
	// are returned as unresolved promises so client-side nav from another
	// page renders the home shell with skeletons immediately, then fills
	// in as each promise resolves. Prerender awaits both promises before
	// emitting HTML, so direct visits skip the skeleton entirely.

	import { resolve } from '$app/paths';
	import MenuSection from '$lib/components/MenuSection.svelte';
	import PrimaryLeaderTile from '$lib/components/PrimaryLeaderTile.svelte';
	import ShareMeta from '$lib/components/ShareMeta.svelte';
	import type { PageData } from './$types';

	let { data }: { data: PageData } = $props();
</script>

<ShareMeta
	title="Benchmark Overview"
	description="MTEB Leaderboard home — primary General / Retrieval / English benchmark winners plus curated sections for language, modality, retrieval, and domain-specific evaluations."
/>

<main id="main-content" tabindex="-1" class="page">
	<header class="hero">
		<h1>Benchmark Overview</h1>
		<a class="all-link" href={resolve('/benchmarks')}>See all benchmarks →</a>
	</header>

	<section class="primary" aria-label="Featured leaderboards">
		<div class="section-head">
			<span class="eyebrow-chip">Featured</span>
		</div>
		<div class="primary-grid">
			{#await data.primaries}
				{#each [0, 1, 2] as i (i)}
					<div class="prim-skel" aria-busy="true" aria-label="Loading featured leaderboard">
						<div class="skel" style="width: 80px; height: 11px;"></div>
						<div class="skel" style="width: 60%; height: 19px; margin-top: 8px;"></div>
						<div class="skel" style="width: 40%; height: 11px; margin-top: 4px;"></div>
						<div class="prim-skel-rows">
							{#each [0, 1, 2, 3] as r (r)}
								<div class="prim-skel-row">
									<div class="skel" style="width: 64px; height: 18px; border-radius: 999px;"></div>
									<div class="skel" style="flex: 1; height: 14px;"></div>
								</div>
							{/each}
						</div>
					</div>
				{/each}
			{:then primaries}
				{#each primaries as p (p.key)}
					<PrimaryLeaderTile tintKey={p.key} label={p.label} benchmark={p.b} leaders={p.leaders} />
				{/each}
			{:catch}
				<p class="load-error" role="status">
					Couldn't load featured leaderboards. The backend may be unavailable — try refreshing in a
					moment.
				</p>
			{/await}
		</div>
	</section>

	<div class="sections">
		{#await data.menu}
			{#each [0, 1, 2, 3] as i (i)}
				<div class="menu-skel" aria-busy="true" aria-label="Loading benchmark sections">
					<div class="skel" style="width: 160px; height: 14px;"></div>
					<div class="menu-skel-grid">
						{#each [0, 1, 2] as r (r)}
							<div class="skel menu-skel-card"></div>
						{/each}
					</div>
				</div>
			{/each}
		{:then menu}
			{#each menu as s (s.name)}
				<MenuSection entry={s} />
			{/each}
		{:catch}
			<p class="load-error" role="status">
				Couldn't load benchmark sections. The backend may be unavailable — try refreshing in a
				moment.
			</p>
		{/await}
	</div>
</main>

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
	.eyebrow-chip {
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
	/* Skeleton placeholders shown while the loader promises are pending
	   (client-side navigation only — prerender awaits everything). Same
	   outer shells as the real tiles / sections so the layout doesn't
	   shift when the data lands. */
	.prim-skel {
		display: flex;
		flex-direction: column;
		gap: 4px;
		padding: 18px 18px 14px;
		background: var(--surface);
		border: 1px solid var(--border);
		border-radius: 14px;
	}
	.prim-skel-rows {
		display: flex;
		flex-direction: column;
		gap: 4px;
		margin-top: 14px;
	}
	.prim-skel-row {
		display: flex;
		align-items: center;
		gap: 10px;
		padding: 6px 4px;
	}
	.menu-skel {
		display: flex;
		flex-direction: column;
		gap: 12px;
		padding: 18px 0;
	}
	.menu-skel-grid {
		display: grid;
		grid-template-columns: repeat(3, 1fr);
		gap: 14px;
	}
	.menu-skel-card {
		height: 130px;
		border-radius: 14px;
	}
	.load-error {
		grid-column: 1 / -1;
		margin: 8px 0 0;
		padding: 14px 16px;
		font-size: 13px;
		color: var(--text-muted);
		background: var(--surface-muted);
		border: 1px solid var(--border);
		border-radius: 10px;
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
