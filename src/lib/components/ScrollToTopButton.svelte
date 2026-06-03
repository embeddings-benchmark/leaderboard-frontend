<!--
  Floating "back to top" button pinned to the bottom-left of the
  viewport. Mirrors `ShareUrlButton`'s placement (bottom-right) so the
  two action affordances bookend the page without colliding. Becomes
  visible once the user has scrolled past roughly one viewport so it
  doesn't clutter the initial above-the-fold view.
-->
<script lang="ts">
	let visible = $state(false);

	$effect(() => {
		const onScroll = () => {
			visible = window.scrollY > 320;
		};
		onScroll();
		window.addEventListener('scroll', onScroll, { passive: true });
		return () => window.removeEventListener('scroll', onScroll);
	});

	function scrollTop() {
		window.scrollTo({ top: 0, behavior: 'smooth' });
	}
</script>

<button
	type="button"
	class="top-btn"
	class:visible
	aria-label="Back to top"
	title="Back to top"
	tabindex={visible ? 0 : -1}
	aria-hidden={!visible}
	onclick={scrollTop}
>
	<svg
		viewBox="0 0 24 24"
		width="16"
		height="16"
		fill="none"
		stroke="currentColor"
		stroke-width="2.2"
		stroke-linecap="round"
		stroke-linejoin="round"
		aria-hidden="true"
	>
		<path d="M12 19V5" />
		<path d="m5 12 7-7 7 7" />
	</svg>
	<span>Top</span>
</button>

<style>
	/* Mirrors `ShareUrlButton`'s accent treatment so the bookended pair
	   (Top on the left, Copy link on the right) reads as one family of
	   floating actions. Same accent border + soft halo, same hover lift. */
	.top-btn {
		position: fixed;
		left: 22px;
		bottom: 22px;
		z-index: 60;
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
			0 6px 18px rgb(15, 23, 42, 0.12);
		cursor: pointer;
		opacity: 0;
		pointer-events: none;
		transform: translateY(6px);
		transition:
			opacity 0.18s ease,
			transform 0.18s ease,
			background 0.14s,
			border-color 0.14s,
			color 0.14s,
			box-shadow 0.14s;
	}
	.top-btn.visible {
		opacity: 1;
		pointer-events: auto;
		transform: translateY(0);
	}
	.top-btn:hover {
		background: color-mix(in srgb, var(--primary) 12%, var(--surface));
		border-color: var(--primary-strong);
		box-shadow:
			0 0 0 2px color-mix(in srgb, var(--primary) 25%, transparent),
			0 10px 22px rgb(15, 23, 42, 0.16);
		transform: translateY(-1px);
	}
	.top-btn:focus-visible {
		outline: 2px solid var(--primary);
		outline-offset: 2px;
	}
	@supports (padding: env(safe-area-inset-bottom)) {
		.top-btn {
			bottom: max(22px, env(safe-area-inset-bottom));
			left: max(22px, env(safe-area-inset-left));
		}
	}
	@media (max-width: 480px) {
		.top-btn span {
			display: none;
		}
		.top-btn {
			padding: 0;
			width: 38px;
			justify-content: center;
		}
	}
</style>
