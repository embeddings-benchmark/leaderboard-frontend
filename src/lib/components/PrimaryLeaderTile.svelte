<script lang="ts">
	// Primary leaderboard tile — big featured card with a top-per-size-
	// bucket leader list. Whole card is clickable via a stretched-link
	// pattern on `.prim-title::after`.

	import { resolve } from '$app/paths';
	import type { Benchmark, BenchmarkLeaders } from '$lib/types';
	import ModelTypeIcon from './ModelTypeIcon.svelte';

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
	function fmtScore(v: number | null | undefined): string {
		if (v == null) return '—';
		return (v * 100).toFixed(1);
	}
</script>

<article class="prim" data-key={tintKey}>
	<header class="prim-head">
		<span class="prim-label">{label}</span>
		<span class="prim-open" aria-hidden="true">Open →</span>
	</header>
	<a class="prim-title" href={resolve('/benchmark/[name]', { name: benchmark.name })}>
		{benchmark.displayName}
	</a>
	<span class="prim-sub">{benchmark.numModels ?? 0} models · {benchmark.tasks.length} tasks</span>
	{#if leaders === 'loading' || leaders === undefined}
		<div class="prim-state">Loading…</div>
	{:else if leaders === 'error'}
		<div class="prim-state error">Couldn't load.</div>
	{:else if leaders.buckets.every((bk) => !bk.leader)}
		<div class="prim-state">No size-bucketed data yet.</div>
	{:else}
		<ul class="prim-buckets">
			{#each leaders.buckets as bk (`${bk.min}-${bk.max ?? 'inf'}`)}
				{@const r = bk.leader}
				{#if r}
					<li class="bucket">
						<span class="bk-chip">{bucketLabel(bk.min, bk.max)}</span>
						<span class="bk-model" data-model-type={r.model.modelType}>
							<span class="bk-icon">
								<ModelTypeIcon type={r.model.modelType} size={11} />
							</span>
							<span class="bk-name">
								<span class="bk-org">{r.model.org}</span>/<span class="bk-display"
									>{r.model.displayName}</span
								>
							</span>
						</span>
						<span class="bk-score">{fmtScore(r.meanTask)}</span>
					</li>
				{/if}
			{/each}
		</ul>
	{/if}
</article>

<style>
	.prim {
		--tint: var(--tint-blue);
		--tint-fg: var(--tint-blue-fg);
		display: flex;
		flex-direction: column;
		gap: 4px;
		padding: 18px 18px 14px;
		background: linear-gradient(
			180deg,
			color-mix(in srgb, var(--tint) 50%, var(--surface)),
			var(--surface) 60%
		);
		border: 1px solid color-mix(in srgb, var(--tint-fg) 22%, var(--border));
		border-radius: 14px;
		box-shadow: 0 1px 2px rgb(var(--shadow-tint) / 0.04);
		position: relative;
		transition:
			transform 0.14s,
			border-color 0.14s,
			box-shadow 0.14s;
	}
	.prim:hover {
		transform: translateY(-1px);
		border-color: var(--tint-fg);
		box-shadow: 0 6px 18px rgb(var(--shadow-tint) / 0.08);
	}
	.prim:hover .prim-title,
	.prim:hover .prim-open {
		color: var(--tint-fg);
	}
	.prim:focus-within {
		outline: 2px solid var(--tint-fg);
		outline-offset: 2px;
	}
	.prim[data-key='retrieval'] {
		--tint: var(--tint-purple);
		--tint-fg: var(--tint-purple-fg);
	}
	.prim[data-key='english'] {
		--tint: var(--tint-green);
		--tint-fg: var(--tint-green-fg);
	}
	.prim-head {
		display: flex;
		align-items: center;
		justify-content: space-between;
	}
	.prim-label {
		font-size: 11px;
		font-weight: 800;
		text-transform: uppercase;
		letter-spacing: 0.08em;
		color: var(--tint-fg);
	}
	.prim-open {
		font-size: 12px;
		font-weight: 700;
		color: var(--tint-fg);
		text-decoration: none;
	}
	.prim-title {
		font-size: 19px;
		font-weight: 700;
		color: var(--ink-strong);
		text-decoration: none;
		margin-top: 2px;
		position: static;
	}
	.prim-title::after {
		content: '';
		position: absolute;
		inset: 0;
		border-radius: inherit;
	}
	.prim-title:focus-visible {
		outline: none;
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
		grid-template-columns: 80px 1fr auto;
		align-items: center;
		gap: 10px;
		padding: 7px 4px;
		font-size: 13px;
	}
	.bucket + .bucket {
		border-top: 1px solid color-mix(in srgb, var(--border) 60%, transparent);
	}
	.bk-chip {
		justify-self: start;
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
	.bk-model {
		display: flex;
		align-items: center;
		gap: 6px;
		min-width: 0;
	}
	.bk-icon {
		display: inline-flex;
		width: 16px;
		height: 16px;
		align-items: center;
		justify-content: center;
		border-radius: 4px;
		background: var(--surface-muted);
		color: var(--text-muted);
		flex-shrink: 0;
	}
	.bk-name {
		overflow: hidden;
		text-overflow: ellipsis;
		white-space: nowrap;
		min-width: 0;
	}
	.bk-org {
		color: var(--text-muted);
	}
	.bk-display {
		font-weight: 600;
		color: var(--text);
	}
	.bk-score {
		font-weight: 700;
		color: var(--tint-fg);
		font-variant-numeric: tabular-nums;
	}
</style>
