<script lang="ts">
	import { untrack } from 'svelte';

	interface Props {
		min: number;
		max: number;
		step?: number;
		valueMin: number;
		valueMax: number;
		onMinChange: (v: number) => void;
		onMaxChange: (v: number) => void;
		format: (v: number) => string;
		ticks?: number[];
	}
	let {
		min,
		max,
		step = 0.05,
		valueMin,
		valueMax,
		onMinChange,
		onMaxChange,
		format,
		ticks = []
	}: Props = $props();

	// Local state drives the inputs via bind:value so the DOM and the visual
	// fill stay perfectly in sync during a drag, regardless of the parent
	// finishing its re-render. Props are pushed in via $effect.
	let localMin = $state(untrack(() => valueMin));
	let localMax = $state(untrack(() => valueMax));

	$effect(() => {
		if (valueMin !== localMin) localMin = valueMin;
	});
	$effect(() => {
		if (valueMax !== localMax) localMax = valueMax;
	});

	function pct(v: number): number {
		if (max === min) return 0;
		return ((v - min) / (max - min)) * 100;
	}

	let leftPct = $derived(pct(localMin));
	let rightPct = $derived(pct(localMax));

	function onMinInput() {
		if (localMin > localMax) localMin = localMax;
		onMinChange(localMin);
	}
	function onMaxInput() {
		if (localMax < localMin) localMax = localMin;
		onMaxChange(localMax);
	}
</script>

<div class="rs">
	<div class="labels">
		<span class="val">{format(localMin)}</span>
		<span class="val">{format(localMax)}</span>
	</div>
	<div class="track-wrap">
		<div class="track"></div>
		<div class="fill" style:left="{leftPct}%" style:right="{100 - rightPct}%"></div>
		<input
			type="range"
			{min}
			{max}
			{step}
			bind:value={localMin}
			oninput={onMinInput}
			class="input min"
			style:z-index={localMin > max - (max - min) * 0.1 ? 4 : 3}
			aria-label="Minimum"
		/>
		<input
			type="range"
			{min}
			{max}
			{step}
			bind:value={localMax}
			oninput={onMaxInput}
			class="input max"
			aria-label="Maximum"
		/>
	</div>
	{#if ticks.length > 0}
		<div class="ticks">
			{#each ticks as t (t)}
				<span class="tick" style:left="{pct(t)}%">{format(t)}</span>
			{/each}
		</div>
	{/if}
</div>

<style>
	.rs {
		display: flex;
		flex-direction: column;
		gap: 6px;
		padding: 4px 8px 6px;
	}
	.labels {
		display: flex;
		justify-content: space-between;
		font-size: 12px;
		color: var(--text);
		font-variant-numeric: tabular-nums;
	}
	.val {
		font-weight: 600;
	}
	.track-wrap {
		position: relative;
		height: 24px;
	}
	.track {
		position: absolute;
		top: 50%;
		left: 0;
		right: 0;
		height: 4px;
		transform: translateY(-50%);
		background: var(--border);
		border-radius: 999px;
		pointer-events: none;
	}
	.fill {
		position: absolute;
		top: 50%;
		height: 4px;
		transform: translateY(-50%);
		background: var(--primary);
		border-radius: 999px;
		pointer-events: none;
	}
	.input {
		position: absolute;
		inset: 0;
		width: 100%;
		height: 100%;
		appearance: none;
		-webkit-appearance: none;
		background: transparent;
		pointer-events: none;
		margin: 0;
	}
	.input.max {
		z-index: 2;
	}
	.input.min {
		z-index: 3;
	}
	.input::-webkit-slider-runnable-track {
		height: 4px;
		background: transparent;
		border: none;
	}
	.input::-moz-range-track {
		height: 4px;
		background: transparent;
		border: none;
	}
	.input::-webkit-slider-thumb {
		appearance: none;
		-webkit-appearance: none;
		pointer-events: auto;
		width: 16px;
		height: 16px;
		border-radius: 50%;
		background: var(--surface);
		border: 2px solid var(--primary);
		cursor: grab;
		box-shadow: var(--shadow-sm);
		margin-top: -6px;
	}
	.input::-moz-range-thumb {
		pointer-events: auto;
		width: 16px;
		height: 16px;
		border-radius: 50%;
		background: var(--surface);
		border: 2px solid var(--primary);
		cursor: grab;
		box-shadow: var(--shadow-sm);
		box-sizing: border-box;
	}
	.input:active::-webkit-slider-thumb {
		cursor: grabbing;
		background: var(--primary-soft);
	}
	.input:active::-moz-range-thumb {
		cursor: grabbing;
		background: var(--primary-soft);
	}
	.input:focus {
		outline: none;
	}
	.ticks {
		position: relative;
		height: 14px;
		font-size: 10px;
		color: var(--text-subtle);
	}
	.tick {
		position: absolute;
		transform: translateX(-50%);
		white-space: nowrap;
	}
</style>
