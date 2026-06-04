<script lang="ts">
	// Bottom-right "copy link" pill — copies `window.location.href` so the
	// recipient lands on the exact view (all filter params already in the URL).

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
	class="share-btn"
	class:copied
	title="Copy share link — includes the active filters, sort, and tab"
	aria-label="Copy share link"
	onclick={copy}
>
	{#if copied}
		<svg
			viewBox="0 0 24 24"
			width="16"
			height="16"
			fill="none"
			stroke="currentColor"
			stroke-width="2.4"
			stroke-linecap="round"
			stroke-linejoin="round"
			aria-hidden="true"
		>
			<path d="M5 12l5 5L20 7" />
		</svg>
		<span>Copied</span>
	{:else}
		<!-- Link/chain glyph -->
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
			<path d="M10 14a5 5 0 0 0 7.07 0l3-3a5 5 0 0 0-7.07-7.07L11 5.93" />
			<path d="M14 10a5 5 0 0 0-7.07 0l-3 3a5 5 0 0 0 7.07 7.07L13 18.07" />
		</svg>
		<span>Copy link</span>
	{/if}
</button>

<style>
	.share-btn {
		position: fixed;
		right: 22px;
		bottom: 22px;
		z-index: 60;
		transition:
			background 0.14s,
			border-color 0.14s,
			color 0.14s,
			box-shadow 0.14s,
			transform 0.14s,
			right 0.18s ease,
			opacity 0.18s ease;
		display: inline-flex;
		align-items: center;
		gap: 8px;
		height: 38px;
		padding: 0 14px;
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
		cursor: pointer;
	}
	.share-btn:hover {
		background: color-mix(in srgb, var(--primary) 12%, var(--surface));
		border-color: var(--primary-strong);
		box-shadow:
			0 0 0 2px color-mix(in srgb, var(--primary) 25%, transparent),
			0 10px 22px rgb(var(--shadow-tint) / 0.16);
		transform: translateY(-1px);
	}
	.share-btn:focus-visible {
		outline: 2px solid var(--primary);
		outline-offset: 2px;
	}
	.share-btn.copied {
		background: color-mix(in srgb, var(--primary) 16%, var(--surface));
		border-color: var(--primary);
		color: var(--primary-strong);
	}
	/* Avoid colliding with the on-screen keyboard / safe area on iOS. */
	@supports (padding: env(safe-area-inset-bottom)) {
		.share-btn {
			bottom: max(22px, env(safe-area-inset-bottom));
			right: max(22px, env(safe-area-inset-right));
		}
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
	/* When the FilterSidebar is expanded it sits at the right edge in
	   every layout — in-flow 340 px on desktop, a fixed-position drawer
	   of the same width on mobile — so the share pill at right: 22 px
	   would always paint on top of it. Detect the open state via
	   :has() on the body and slide the pill clear of the panel. */
	:global(body:has(.sidebar:not(.collapsed))) .share-btn {
		right: calc(min(340px, 100vw) + 14px);
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
