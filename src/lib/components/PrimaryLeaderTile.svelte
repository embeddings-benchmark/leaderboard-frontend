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
	class="prim accent-rail"
	data-key={tintKey}
	href={resolve('/benchmark/[name]', { name: slug(benchmark.name) })}
	aria-label={`Open ${benchmark.displayName} leaderboard`}
>
	<header class="prim-head">
		<span class="prim-label">{label}</span>
	</header>
	<div class="prim-title">
		{#if benchmark.icon}
			{#if isIconUrl(benchmark.icon)}
				<img
					class="prim-icon"
					src={apiUrl(benchmark.icon)}
					alt=""
					width="22"
					height="22"
					loading="lazy"
					decoding="async"
				/>
			{:else}
				<span class="prim-icon prim-icon-text" aria-hidden="true">{benchmark.icon}</span>
			{/if}
		{/if}
		<span class="prim-title-text">{benchmark.displayName}</span>
	</div>
	<span class="prim-sub">{benchmark.numModels ?? 0} models · {benchmark.tasks.length} tasks</span>
	{#if leaders === 'loading' || leaders === undefined}
		<div class="prim-list-head">Top models</div>
		<ul class="prim-buckets" aria-busy="true" aria-label="Loading leaders">
			{#each [0, 1, 2, 3] as i (i)}
				<li class="bucket">
					<span class="skel bk-chip-skel"></span>
					<span class="skel bk-name-skel"></span>
				</li>
			{/each}
		</ul>
	{:else if leaders === 'error'}
		<div class="prim-state error">Couldn't load.</div>
	{:else if orderedBuckets.every((bk) => !bk.leader)}
		<div class="prim-state">No size-bucketed data yet.</div>
	{:else}
		<div class="prim-list-head">Top models</div>
		<ul class="prim-buckets">
			{#each orderedBuckets as bk (`${bk.min}-${bk.max ?? 'inf'}`)}
				{@const r = bk.leader}
				{#if r}
					<li class="bucket">
						<span class="bk-chip">{bucketLabel(bk.min, bk.max)}</span>
						<span class="bk-name">{splitModelName(r.model.name).displayName}</span>
					</li>
				{/if}
			{/each}
		</ul>
	{/if}
</a>

<style>
	/* Accent-rail treatment, matching the benchmark/task/model cards: flat
	   surface + neutral border, with an inset rounded marker rail on the
	   left edge coloured by the per-tile tint. */
	.prim {
		--tint: var(--tint-blue);
		--tint-fg: var(--tint-blue-fg);
		/* Map to `--card-accent` so the shared `.accent-rail::before`
		   (src/app.css) reads this tile's per-key tint. */
		--card-accent: var(--tint-fg);
		display: flex;
		flex-direction: column;
		gap: 4px;
		padding: 18px 18px 14px 22px;
		background: var(--surface);
		border: 1px solid var(--border);
		border-radius: 14px;
		box-shadow: 0 1px 2px rgb(var(--shadow-tint) / 0.04);
		text-decoration: none;
		color: inherit;
		position: relative;
		overflow: hidden;
		transition:
			transform 0.14s,
			border-color 0.14s,
			box-shadow 0.14s;
	}
	.prim:hover {
		transform: translateY(-1px);
		border-color: color-mix(in srgb, var(--tint-fg) 45%, var(--border));
		box-shadow: 0 6px 18px rgb(var(--shadow-tint) / 0.08);
	}
	.prim:hover .prim-title {
		color: var(--tint-fg);
	}
	.prim:focus-visible {
		outline: 2px solid var(--tint-fg);
		outline-offset: 2px;
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
	}
	.prim-label {
		font-size: 11px;
		font-weight: 800;
		text-transform: uppercase;
		letter-spacing: 0.08em;
		color: var(--tint-fg);
	}
	.prim-title {
		font-size: 19px;
		font-weight: 700;
		color: var(--ink-strong);
		margin-top: 2px;
		display: inline-flex;
		align-items: center;
		gap: 8px;
		min-width: 0;
	}
	.prim-icon {
		width: 22px;
		height: 22px;
		flex-shrink: 0;
		border-radius: 4px;
		object-fit: contain;
		background: color-mix(in srgb, var(--surface) 60%, var(--tint));
	}
	.prim-icon-text {
		display: inline-flex;
		align-items: center;
		justify-content: center;
		font-size: 18px;
		line-height: 1;
		background: transparent;
	}
	.prim-title-text {
		min-width: 0;
		overflow: hidden;
		text-overflow: ellipsis;
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
	.prim-list-head {
		font-size: 10px;
		font-weight: 800;
		letter-spacing: 0.08em;
		text-transform: uppercase;
		color: var(--text-subtle);
		margin: 4px 0 2px;
	}
	.prim-buckets {
		list-style: none;
		margin: 0;
		padding: 0;
		display: flex;
		flex-direction: column;
		gap: 2px;
	}
	.bucket {
		display: grid;
		grid-template-columns: 80px 1fr;
		align-items: center;
		gap: 10px;
		padding: 7px 4px;
		font-size: 13px;
	}
	.bucket + .bucket {
		border-top: 1px solid color-mix(in srgb, var(--border) 60%, transparent);
	}
	.bk-chip {
		/* Stretch to the grid cell + center text so every bucket chip
		   reads at the same width regardless of its label
		   (`<500M` vs `500M–1B` etc.). */
		justify-self: stretch;
		text-align: center;
		padding: 3px 8px;
		font-size: 11px;
		font-weight: 700;
		letter-spacing: 0.02em;
		color: var(--tint-fg);
		background: color-mix(in srgb, var(--tint-fg) 14%, transparent);
		border: 1px solid color-mix(in srgb, var(--tint-fg) 28%, transparent);
		border-radius: 999px;
		font-variant-numeric: tabular-nums;
		white-space: nowrap;
	}
	.bk-name {
		font-weight: 600;
		color: var(--text);
		overflow: hidden;
		text-overflow: ellipsis;
		white-space: nowrap;
		min-width: 0;
	}
	/* Skeleton shapes for the loading state — sized to match the real
	   chip + name row so the layer doesn't reflow when data lands. */
	.bk-chip-skel {
		justify-self: stretch;
		height: 18px;
		border-radius: 999px;
	}
	.bk-name-skel {
		height: 14px;
		width: 70%;
	}
</style>
