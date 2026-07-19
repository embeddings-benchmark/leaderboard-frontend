<script lang="ts">
	// Per-cell openness tooltip for leaderboard tables. Renders the same
	// card-style breakdown (pips + score + per-dimension check/x) as the model
	// detail card, via the shared HoverPortal shell + OpennessMeter. Mirrors
	// ModelHoverPortal's showFor/hide imperative API.
	import HoverPortal from './HoverPortal.svelte';
	import OpennessMeter from './OpennessMeter.svelte';
	import type { ModelMeta } from '$lib/types';

	type TipState = {
		visible: boolean;
		model: ModelMeta | null;
		x: number;
		y: number;
	};
	let tip = $state<TipState>({ visible: false, model: null, x: 0, y: 0 });

	export function showFor(target: HTMLElement, model: ModelMeta) {
		const r = target.getBoundingClientRect();
		tip = { visible: true, model, x: r.left + r.width / 2, y: r.bottom };
	}
	export function hide() {
		tip = { ...tip, visible: false };
	}
</script>

<HoverPortal visible={tip.visible} title="Openness" x={tip.x} y={tip.y}>
	{#if tip.model}
		<OpennessMeter model={tip.model} breakdown />
	{/if}
</HoverPortal>
