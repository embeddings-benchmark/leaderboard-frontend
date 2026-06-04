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
		// Optional inverse of `format`. When provided, the min/max labels
		// become editable text inputs — Enter or blur commits, Escape
		// reverts. Returns `null` for unparseable input. Values are clamped
		// to [min, max] by the slider before being applied.
		parse?: (s: string) => number | null;
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
		parse,
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

	// Editable labels (only rendered when `parse` is provided). Each side
	// holds its own draft text so the user can type freely without the
	// drag-driven `format(localMin/Max)` re-flowing under them mid-edit.
	// Drafts re-sync from the live formatted value whenever the field
	// loses focus.
	let editingMin = $state(false);
	let editingMax = $state(false);
	// `untrack` mirrors the existing pattern for `localMin / localMax` —
	// the draft is seeded from the initial prop snapshot and then
	// resynced via the focus-gated effects below.
	let minDraft = $state(untrack(() => format(valueMin)));
	let maxDraft = $state(untrack(() => format(valueMax)));
	$effect(() => {
		if (!editingMin) minDraft = format(localMin);
	});
	$effect(() => {
		if (!editingMax) maxDraft = format(localMax);
	});

	function commitMin() {
		editingMin = false;
		if (!parse) return;
		const v = parse(minDraft);
		if (v == null || Number.isNaN(v)) {
			minDraft = format(localMin);
			return;
		}
		const clamped = Math.max(min, Math.min(localMax, v));
		if (clamped !== localMin) {
			localMin = clamped;
			onMinChange(clamped);
		}
		minDraft = format(localMin);
	}
	function commitMax() {
		editingMax = false;
		if (!parse) return;
		const v = parse(maxDraft);
		if (v == null || Number.isNaN(v)) {
			maxDraft = format(localMax);
			return;
		}
		const clamped = Math.min(max, Math.max(localMin, v));
		if (clamped !== localMax) {
			localMax = clamped;
			onMaxChange(clamped);
		}
		maxDraft = format(localMax);
	}
	function onLabelKey(e: KeyboardEvent, side: 'min' | 'max') {
		if (e.key === 'Enter') {
			e.preventDefault();
			(e.currentTarget as HTMLInputElement).blur();
		} else if (e.key === 'Escape') {
			e.preventDefault();
			if (side === 'min') {
				minDraft = format(localMin);
				editingMin = false;
			} else {
				maxDraft = format(localMax);
				editingMax = false;
			}
			(e.currentTarget as HTMLInputElement).blur();
		}
	}

	// Click-and-drag on the track itself: move whichever thumb is closer to the
	// pointer. Without this, clicks on the track area do nothing because the
	// inputs sit on top of it with pointer-events:none.
	function valueAt(clientX: number, rect: DOMRect): number {
		const ratio = Math.max(0, Math.min(1, (clientX - rect.left) / rect.width));
		let v = min + ratio * (max - min);
		if (step > 0) v = Math.round(v / step) * step;
		return Math.max(min, Math.min(max, v));
	}

	function trackPointerDown(e: PointerEvent) {
		// Inputs have pointer-events:none so the native input drag is disabled. We
		// handle every pointerdown that bubbles up to the track ourselves and pick
		// the closer thumb — clicking on a thumb resolves to that same thumb, so
		// thumb-drag and track-click both work through one code path.
		if (e.button !== 0 && e.pointerType === 'mouse') return;
		e.preventDefault();
		const trackEl = e.currentTarget as HTMLElement;
		const rect = trackEl.getBoundingClientRect();

		// Pick the closer thumb at the click location and lock onto it for the drag.
		const initial = valueAt(e.clientX, rect);
		const dragMin = Math.abs(initial - localMin) <= Math.abs(initial - localMax);

		function apply(clientX: number) {
			const v = valueAt(clientX, rect);
			if (dragMin) {
				const clamped = Math.min(v, localMax);
				if (clamped !== localMin) {
					localMin = clamped;
					onMinChange(clamped);
				}
			} else {
				const clamped = Math.max(v, localMin);
				if (clamped !== localMax) {
					localMax = clamped;
					onMaxChange(clamped);
				}
			}
		}

		apply(e.clientX);
		try {
			trackEl.setPointerCapture(e.pointerId);
		} catch {
			/* No active pointer (synthetic event or unusual input); drag still works via document listeners below. */
		}

		function onMove(ev: PointerEvent) {
			apply(ev.clientX);
		}
		function onUp(ev: PointerEvent) {
			try {
				trackEl.releasePointerCapture(ev.pointerId);
			} catch {
				/* ignore */
			}
			trackEl.removeEventListener('pointermove', onMove);
			trackEl.removeEventListener('pointerup', onUp);
			trackEl.removeEventListener('pointercancel', onUp);
		}
		trackEl.addEventListener('pointermove', onMove);
		trackEl.addEventListener('pointerup', onUp);
		trackEl.addEventListener('pointercancel', onUp);
	}
</script>

<div class="rs">
	<div class="labels">
		{#if parse}
			{@const HINT = 'Accepts e.g. 500K, 5M, 1.2B, 3T — Enter to apply, Esc to cancel'}
			<input
				type="text"
				class="val val-edit"
				bind:value={minDraft}
				onfocus={() => (editingMin = true)}
				onblur={commitMin}
				onkeydown={(e) => onLabelKey(e, 'min')}
				aria-label="Minimum value"
				title={HINT}
				inputmode="text"
				spellcheck="false"
			/>
			<input
				type="text"
				class="val val-edit"
				bind:value={maxDraft}
				onfocus={() => (editingMax = true)}
				onblur={commitMax}
				onkeydown={(e) => onLabelKey(e, 'max')}
				aria-label="Maximum value"
				title={HINT}
				inputmode="text"
				spellcheck="false"
			/>
		{:else}
			<span class="val">{format(localMin)}</span>
			<span class="val">{format(localMax)}</span>
		{/if}
	</div>
	<div class="track-wrap" role="presentation" onpointerdown={trackPointerDown}>
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
	{#if parse && (editingMin || editingMax)}
		<div class="hint">Type a value (e.g. 500K, 5M, 1.2B, 3T)</div>
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
	/* Editable label — looks like plain text by default, gains a subtle
	   input chrome on hover/focus so the affordance is discoverable
	   without crowding the resting state. `size` is set inline from the
	   draft length so the field width tracks the value. */
	.val-edit {
		font: inherit;
		font-weight: 600;
		color: inherit;
		background: transparent;
		border: 1px solid transparent;
		border-radius: 4px;
		padding: 1px 4px;
		margin: -1px -4px;
		min-width: 3ch;
		text-align: left;
		font-variant-numeric: tabular-nums;
		cursor: text;
		transition:
			background 0.1s,
			border-color 0.1s;
		/* Auto-size to content where supported (Baseline 2024-10).
		   Avoids a reactive `size` attribute that would swap the
		   input element and blur it mid-keystroke. Falls back to
		   the `width` below for older browsers. */
		field-sizing: content;
		width: 7ch;
	}
	.val-edit:hover {
		background: var(--surface-muted);
		border-color: var(--border);
	}
	.val-edit:focus {
		outline: none;
		background: var(--surface);
		border-color: var(--primary);
	}
	.labels > .val-edit:last-child {
		text-align: right;
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
	.hint {
		font-size: 11px;
		color: var(--text-subtle);
		text-align: center;
		margin-top: 2px;
	}
</style>
