<script lang="ts">
	import { resolve } from '$app/paths';
	import type { Benchmark, LeaderRow } from '$lib/types';
	import { splitModelName } from '$lib/format';
	import ModalityIcon from './ModalityIcon.svelte';

	// 1-decimal score format (`fmtPct` in format.ts uses 2 decimals,
	// which is too long for the cramped tile meta line).
	function fmtScore(v: number | null | undefined): string {
		if (v == null) return '—';
		return (v * 100).toFixed(1);
	}

	type Modality = 'image' | 'audio' | 'video';

	interface Props {
		modality: Modality;
		label: string;
		// Null + `comingSoon` = render the dashed placeholder tile.
		benchmark: Benchmark | null;
		comingSoon?: boolean;
		// Top model for this modality. `undefined` / `'loading'` =
		// show numModels instead; `'error'` collapses to numModels too.
		leader?: LeaderRow | null | 'loading' | 'error';
	}
	let { modality, label, benchmark, comingSoon = false, leader }: Props = $props();

	let topLeader = $derived(leader && leader !== 'loading' && leader !== 'error' ? leader : null);
</script>

{#if comingSoon || !benchmark}
	<div class="mod-tile soon" data-modality={modality}>
		<span class="mod-icon"><ModalityIcon {modality} size={16} /></span>
		<div class="mod-text">
			<span class="mod-eyebrow">{label}</span>
			<span class="mod-title">Coming soon</span>
			<span class="mod-meta">Benchmark in development</span>
		</div>
	</div>
{:else}
	<a
		class="mod-tile"
		data-modality={modality}
		href={resolve('/benchmark/[name]', { name: benchmark.name })}
	>
		<span class="mod-icon"><ModalityIcon {modality} size={16} /></span>
		<div class="mod-text">
			<span class="mod-eyebrow">{label}</span>
			<span class="mod-title">{benchmark.displayName}</span>
			{#if topLeader}
				<span class="mod-meta">
					Leader: {splitModelName(topLeader.model.name).displayName} · {fmtScore(
						topLeader.meanTask
					)}
				</span>
			{:else}
				<span class="mod-meta">{benchmark.numModels ?? 0} models</span>
			{/if}
		</div>
		<span class="mod-arrow">→</span>
	</a>
{/if}

<style>
	.mod-tile {
		--tint: var(--tint-blue);
		--tint-fg: var(--tint-blue-fg);
		display: flex;
		align-items: center;
		gap: 14px;
		padding: 14px 18px;
		background: linear-gradient(
			135deg,
			color-mix(in srgb, var(--tint) 55%, var(--surface)),
			var(--surface) 75%
		);
		border: 1px solid color-mix(in srgb, var(--tint-fg) 22%, var(--border));
		border-radius: 12px;
		text-decoration: none;
		color: inherit;
		transition:
			transform 0.14s,
			border-color 0.14s;
	}
	.mod-tile:hover {
		transform: translateY(-1px);
		border-color: var(--tint-fg);
	}
	.mod-tile[data-modality='audio'] {
		--tint: var(--tint-amber);
		--tint-fg: var(--tint-amber-fg);
	}
	.mod-tile[data-modality='video'] {
		--tint: var(--tint-purple);
		--tint-fg: var(--tint-purple-fg);
	}
	.mod-tile.soon {
		cursor: default;
		opacity: 0.75;
		background: var(--surface);
		border-style: dashed;
	}
	.mod-tile.soon:hover {
		transform: none;
	}
	.mod-icon {
		display: inline-flex;
		width: 36px;
		height: 36px;
		align-items: center;
		justify-content: center;
		border-radius: 10px;
		background: var(--surface);
		color: var(--tint-fg);
		flex-shrink: 0;
	}
	.mod-text {
		display: flex;
		flex-direction: column;
		gap: 1px;
		min-width: 0;
		flex: 1;
	}
	.mod-eyebrow {
		font-size: 10px;
		font-weight: 800;
		letter-spacing: 0.08em;
		text-transform: uppercase;
		color: var(--tint-fg);
	}
	.mod-title {
		font-size: 15px;
		font-weight: 700;
		color: var(--ink-strong);
	}
	.mod-meta {
		font-size: 12px;
		color: var(--text-muted);
		overflow: hidden;
		text-overflow: ellipsis;
		white-space: nowrap;
	}
	.mod-arrow {
		font-size: 18px;
		color: var(--tint-fg);
		flex-shrink: 0;
	}
</style>
