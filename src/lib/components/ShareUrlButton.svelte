<script lang="ts">
	// Bottom-right "copy link" pill — copies `window.location.href` so the
	// recipient lands on the exact view (all filter params already in the URL).

	import Check from 'lucide-svelte/icons/check';
	import Link2 from 'lucide-svelte/icons/link-2';
	import { page } from '$app/state';

	let copied = $state(false);
	let timer: ReturnType<typeof setTimeout> | null = null;
	let currentUrl = $derived(page.url.href);

	async function copy() {
		try {
			await navigator.clipboard.writeText(currentUrl);
			copied = true;
			if (timer) clearTimeout(timer);
			timer = setTimeout(() => {
				copied = false;
				timer = null;
			}, 1600);
		} catch {
			/* iframe sandbox / permission denied — fail silently */
		}
	}
</script>

<button
	type="button"
	class="share-btn floating-pill"
	class:copied
	title="Copy share link — includes the active filters, sort, and tab"
	aria-label="Copy share link"
	onclick={copy}
>
	{#if copied}
		<Check size={16} strokeWidth={2.4} aria-hidden="true" />
		<span>Copied</span>
	{:else}
		<Link2 size={16} aria-hidden="true" />
		<span>Copy link</span>
	{/if}
</button>

<style>
	/* `env(safe-area-inset-*)` keeps the pill clear of the iOS
	   on-screen keyboard / home indicator. */
	.share-btn {
		position: fixed;
		right: max(22px, env(safe-area-inset-right));
		bottom: max(22px, env(safe-area-inset-bottom));
		z-index: 60;
		transition:
			background 0.14s,
			border-color 0.14s,
			color 0.14s,
			box-shadow 0.14s,
			transform 0.14s,
			right 0.18s ease,
			opacity 0.18s ease;
	}
	.share-btn:hover {
		transform: translateY(-1px);
	}
	.share-btn.copied {
		background: color-mix(in srgb, var(--primary) 16%, var(--surface));
		border-color: var(--primary);
		color: var(--primary-strong);
	}
	/* On narrow viewports, shrink to icon-only so we don't crowd the
	   page footer + content. */
	@media (max-width: 480px) {
		.share-btn span {
			display: none;
		}
		.share-btn {
			padding: 0;
			width: 38px;
			justify-content: center;
		}
	}
	/* Slide clear of the open FilterSidebar (set in sidebar.css). */
	:global(body:has(.sidebar:not(.collapsed))) .share-btn {
		right: calc(var(--sidebar-active-width) + 14px);
	}
	/* Drawer covers ~entire viewport on the smallest screens — pushing
	   the button left would put it offscreen, fade it out instead so
	   the transition stays smooth (display:none can't animate). */
	@media (max-width: 380px) {
		:global(body:has(.sidebar:not(.collapsed))) .share-btn {
			opacity: 0;
			pointer-events: none;
		}
	}
</style>
