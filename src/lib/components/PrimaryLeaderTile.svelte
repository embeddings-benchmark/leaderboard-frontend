<script lang="ts">
	import { resolve } from '$app/paths';
	import type { Benchmark, BenchmarkLeaders } from '$lib/types';
	import { apiUrl, isIconUrl, slug, splitModelName } from '$lib/format';

	type TintKey = 'multilingual' | 'retrieval' | 'english';

	interface Props {
		// Drives the per-card tint via `data-key`.
		tintKey: TintKey;
		label: string;
		benchmark: Benchmark;
		leaders: BenchmarkLeaders | 'loading' | 'error' | undefined;
	}
	let { tintKey, label, benchmark, leaders }: Props = $props();

	function fmtParams(m: number): string {
		if (m >= 1000) {
			const b = m / 1000;
			return `${Number.isInteger(b) ? b : b.toFixed(1)}B`;
		}
		return `${Math.round(m)}M`;
	}
	function bucketLabel(min: number, max: number | null): string {
		if (min === 0 && max != null) return `<${fmtParams(max)}`;
		if (max == null) return `>${fmtParams(min)}`;
		return `${fmtParams(min)}–${fmtParams(max)}`;
	}
	// Loader returns buckets ascending by size (smallest → biggest). Reverse
	// so the largest-model bucket sits at the top — matches the convention
	// of "best/biggest first" rankings.
	let orderedBuckets = $derived(
		leaders && leaders !== 'loading' && leaders !== 'error' ? [...leaders.buckets].reverse() : []
	);
</script>

<a
	class="prim card-link accent-rail"
	data-key={tintKey}
	href={resolve('/benchmark/[name]', { name: slug(benchmark.name) })}
	aria-label={`Open ${benchmark.displayName} leaderboard`}
>
	<header class="prim-head">
		<div class="prim-title">
			{#if benchmark.icon}
				{#if isIconUrl(benchmark.icon)}
					<img
						class="prim-icon icon-tile"
						src={apiUrl(benchmark.icon)}
						alt=""
						width="22"
						height="22"
						loading="lazy"
						decoding="async"
						fetchpriority="low"
					/>
				{:else}
					<span class="prim-icon icon-tile icon-tile-text" aria-hidden="true">{benchmark.icon}</span>
				{/if}
			{/if}
			<span class="prim-title-text">{benchmark.displayName}</span>
		</div>
		<span class="prim-chip">{label}</span>
	</header>
	<span class="prim-sub">{benchmark.numModels ?? 0} models · {benchmark.tasks.length} tasks</span>
	{#if leaders === 'loading' || leaders === undefined}
		<div class="prim-grid" aria-busy="true" aria-label="Loading leaders">
			<div class="prim-row prim-head-row">
				<span>Model</span>
				<span>Size group</span>
			</div>
			{#each [0, 1, 2, 3] as i (i)}
				<div class="prim-row">
					<span class="skel skel-name"></span>
					<span class="skel skel-size"></span>
				</div>
			{/each}
		</div>
	{:else if leaders === 'error'}
		<div class="prim-state error">Couldn't load.</div>
	{:else if orderedBuckets.every((bk) => !bk.leader)}
		<div class="prim-state">No size-bucketed data yet.</div>
	{:else}
		<div class="prim-grid">
			<div class="prim-row prim-head-row">
				<span>Model</span>
				<span>Size group</span>
			</div>
			{#each orderedBuckets as bk (`${bk.min}-${bk.max ?? 'inf'}`)}
				{@const r = bk.leader}
				{#if r}
					<div class="prim-row">
						<span class="prim-model">{splitModelName(r.model.name).displayName}</span>
						<span class="prim-size">{bucketLabel(bk.min, bk.max)}</span>
					</div>
				{/if}
			{/each}
		</div>
	{/if}
</a>

<style>
	.prim {
		--tint: var(--tint-blue);
		--tint-fg: var(--tint-blue-fg);
		--card-accent: var(--tint-fg);
		--card-radius: 14px;
		--card-padding: 18px 18px 14px 22px;
		--card-gap: 4px;
	}
	.prim:hover .prim-title-text {
		color: var(--tint-fg);
	}
	.prim[data-key='retrieval'] {
		--tint: var(--tint-purple);
		--tint-fg: var(--tint-purple-fg);
	}
	/* English shares the blue tint with Multilingual — both are
	   "general" benchmarks, and the original green was reading like a
	   different category rather than a different scope. The data-key
	   stays on the element for future per-tile overrides. */
	.prim[data-key='english'] {
		--tint: var(--tint-blue);
		--tint-fg: var(--tint-blue-fg);
	}
	.prim-head {
		display: flex;
		align-items: center;
		justify-content: space-between;
		gap: 10px;
	}
	.prim-title {
		display: inline-flex;
		align-items: center;
		gap: 8px;
		min-width: 0;
		font-size: 17px;
		font-weight: 700;
		color: var(--ink-strong);
	}
	.prim-icon {
		--icon-size: 22px;
		--icon-bg: color-mix(in srgb, var(--surface) 60%, var(--tint));
	}
	/* Emoji glyph variant — clear the tinted backdrop so the glyph
	   reads cleanly. */
	.prim-icon.icon-tile-text {
		background: transparent;
	}
	.prim-title-text {
		min-width: 0;
		overflow: hidden;
		text-overflow: ellipsis;
		white-space: nowrap;
	}
	.prim-chip {
		font-size: 10px;
		font-weight: 700;
		letter-spacing: 0.08em;
		text-transform: uppercase;
		color: var(--tint-fg);
		padding: 3px 9px;
		background: color-mix(in srgb, var(--tint-fg) 12%, transparent);
		border: 1px solid color-mix(in srgb, var(--tint-fg) 28%, transparent);
		border-radius: 999px;
		white-space: nowrap;
	}
	.prim-sub {
		font-size: 12px;
		color: var(--text-muted);
		margin-bottom: 10px;
	}
	.prim-state {
		padding: 18px 4px;
		font-size: 13px;
		color: var(--text-muted);
	}
	.prim-state.error {
		color: var(--tint-orange-fg, #c0432e);
	}
	/* Two-col tabular list: model name (flex), bucket label (right). */
	.prim-grid {
		display: flex;
		flex-direction: column;
	}
	.prim-row {
		display: grid;
		grid-template-columns: 1fr auto;
		align-items: center;
		gap: 12px;
		padding: 8px 4px;
		font-size: 13px;
	}
	.prim-head-row {
		font-size: 11px;
		font-weight: 600;
		letter-spacing: 0.04em;
		text-transform: uppercase;
		color: var(--text-subtle);
		padding-block: 4px;
		border-bottom: 1px solid color-mix(in srgb, var(--border) 60%, transparent);
	}
	.prim-row + .prim-row {
		border-top: 1px solid color-mix(in srgb, var(--border) 60%, transparent);
	}
	.prim-model {
		font-weight: 600;
		color: var(--text);
		min-width: 0;
		overflow-wrap: anywhere;
	}
	.prim-size {
		font-variant-numeric: tabular-nums;
		color: var(--text-muted);
		white-space: nowrap;
	}
	/* Skeleton shapes — sized to match the real row so the layer
	   doesn't reflow when data lands. */
	.skel-name {
		height: 14px;
		width: 70%;
	}
	.skel-size {
		height: 14px;
		width: 56px;
		justify-self: end;
	}
</style>
