<script lang="ts">
	// Bottom-centre chip that opens /compare with the pinned models
	// pre-selected. Positioned away from ScrollToTopButton (bottom-
	// left) and ShareUrlButton (bottom-right).

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
		// URLSearchParams form-encodes spaces as `+` — matches the
		// canonical shape /compare writes back, so the URL doesn't
		// flicker after navigation.
		// eslint-disable-next-line svelte/prefer-svelte-reactivity
		const params = new URLSearchParams();
		params.set('model', names.join(','));
		if (leaderboard.selected) params.set('benchmark', leaderboard.selected);
		return `${resolve('/compare')}?${params.toString()}`;
	});
</script>

{#if visible}
	<!-- href is composed above via resolve('/compare'); the linter can't
	     see the static prefix through the template literal. -->
	<!-- eslint-disable svelte/no-navigation-without-resolve -->
	<a
		class="compare-pinned-btn"
		{href}
		title={`Open the compare view with ${count} pinned model${count === 1 ? '' : 's'}`}
		aria-label="Compare pinned models"
	>
		<svg
			viewBox="0 0 24 24"
			width="16"
			height="16"
			fill="none"
			stroke="currentColor"
			stroke-width="2"
			stroke-linecap="round"
			stroke-linejoin="round"
			aria-hidden="true"
		>
			<path d="M3 8h7l-3 4 3 4H3" />
			<path d="M21 8h-7l3 4-3 4h7" />
		</svg>
		<span>Compare {count > 4 ? '4 of ' + count : count} pinned</span>
	</a>
	<!-- eslint-enable svelte/no-navigation-without-resolve -->
{/if}

<style>
	.compare-pinned-btn {
		position: fixed;
		left: 50%;
		bottom: 22px;
		transform: translateX(-50%);
		z-index: 60;
		display: inline-flex;
		align-items: center;
		gap: 8px;
		height: 38px;
		padding: 0 16px;
		font-size: 13px;
		font-weight: 600;
		font-family: inherit;
		color: var(--primary-strong);
		background: var(--surface);
		border: 1.5px solid var(--primary);
		border-radius: 999px;
		box-shadow:
			0 0 0 1px color-mix(in srgb, var(--primary) 18%, transparent),
			0 6px 18px rgb(var(--shadow-tint) / 0.12);
		text-decoration: none;
		cursor: pointer;
		transition:
			background 0.14s,
			border-color 0.14s,
			color 0.14s,
			box-shadow 0.14s,
			transform 0.14s;
	}
	.compare-pinned-btn:hover {
		background: color-mix(in srgb, var(--primary) 12%, var(--surface));
		border-color: var(--primary-strong);
		box-shadow:
			0 0 0 2px color-mix(in srgb, var(--primary) 25%, transparent),
			0 10px 22px rgb(var(--shadow-tint) / 0.16);
		transform: translateX(-50%) translateY(-1px);
	}
	.compare-pinned-btn:focus-visible {
		outline: 2px solid var(--primary);
		outline-offset: 2px;
	}
	@supports (padding: env(safe-area-inset-bottom)) {
		.compare-pinned-btn {
			bottom: max(22px, env(safe-area-inset-bottom));
		}
	}
</style>
