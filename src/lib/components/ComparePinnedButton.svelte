<script lang="ts">
	// Bottom-centre chip that opens /compare with the pinned models
	// pre-selected. Positioned away from ScrollToTopButton (bottom-
	// left) and ShareUrlButton (bottom-right).

	import ArrowLeftRight from 'lucide-svelte/icons/arrow-left-right';
	import { pinnedModels } from '$lib/stores/pinned.svelte';
	import { leaderboard } from '$lib/stores/leaderboard.svelte';
	import { resolve } from '$app/paths';
	import { page } from '$app/state';

	let count = $derived(pinnedModels.size);
	// Trim trailing slash so `/compare/` and `/compare` both match.
	let onCompare = $derived(page.url.pathname.replace(/\/$/, '').endsWith('/compare'));
	let visible = $derived(count >= 2 && !onCompare);

	let href = $derived.by(() => {
		const names = Array.from(pinnedModels.value).slice(0, 4);
		// Manual query build (NOT URLSearchParams). `params.set('model',
		// 'a,b')` would URL-encode the join comma to `%2C`, leaving the
		// compare page's `readMultiParam` to treat the whole thing as a
		// single name. Mirror the canonical writer instead: encode each
		// name separately (commas inside a name like "MTEB(Multilingual, v2)"
		// become `%2C` and survive the read-side split), then join with a
		// literal `,` separator.
		const parts: string[] = [];
		if (names.length > 0) {
			parts.push(`model=${names.map((n) => encodeURIComponent(n)).join(',')}`);
		}
		if (leaderboard.selected) {
			parts.push(`benchmark=${encodeURIComponent(leaderboard.selected)}`);
		}
		const qs = parts.length > 0 ? `?${parts.join('&')}` : '';
		return `${resolve('/compare')}${qs}`;
	});
</script>

{#if visible}
	<!-- href is composed above via resolve('/compare'); the linter can't
	     see the static prefix through the template literal. -->
	<!-- eslint-disable svelte/no-navigation-without-resolve -->
	<a
		class="compare-pinned-btn floating-pill"
		{href}
		title={`Open the compare view with ${count} pinned model${count === 1 ? '' : 's'}`}
		aria-label="Compare pinned models"
	>
		<ArrowLeftRight size={16} aria-hidden="true" />
		<span>Compare {count > 4 ? '4 of ' + count : count} pinned</span>
	</a>
	<!-- eslint-enable svelte/no-navigation-without-resolve -->
{/if}

<style>
	/* Local hover lift composes onto the centring transform. */
	.compare-pinned-btn {
		position: fixed;
		left: 50%;
		bottom: max(22px, env(safe-area-inset-bottom));
		transform: translateX(-50%);
		z-index: 60;
		padding: 0 16px;
		transition:
			background 0.14s,
			border-color 0.14s,
			color 0.14s,
			box-shadow 0.14s,
			transform 0.14s;
	}
	.compare-pinned-btn:hover {
		transform: translateX(-50%) translateY(-1px);
	}
</style>
