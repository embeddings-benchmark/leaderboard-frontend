<!-- Bottom-left floating "back to top" pill; bookends `ShareUrlButton`.
     IntersectionObserver on a sentinel at top: 320px replaces a per-scroll
     listener. FUTURE: `@container scroll-state(scrollable: top)` on the root
     would drop the JS once it leaves Chrome-only. -->
<script lang="ts">
	let visible = $state(false);
	let sentinel: HTMLDivElement | undefined = $state();

	$effect(() => {
		if (!sentinel) return;
		const io = new IntersectionObserver(([entry]) => {
			// Sentinel sits at 320px; out of view = user has scrolled past it.
			visible = !entry.isIntersecting;
		});
		io.observe(sentinel);
		return () => io.disconnect();
	});

	function scrollTop() {
		window.scrollTo({ top: 0, behavior: 'smooth' });
	}
</script>

<div bind:this={sentinel} class="scroll-sentinel" aria-hidden="true"></div>

<button
	type="button"
	class="top-btn floating-pill"
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
	/* `position: absolute` (not `fixed`) so the sentinel sits at a fixed
	   document position rather than scrolling with the viewport. */
	.scroll-sentinel {
		position: absolute;
		top: 320px;
		left: 0;
		width: 1px;
		height: 1px;
		pointer-events: none;
		visibility: hidden;
	}
	.top-btn {
		position: fixed;
		left: max(22px, env(safe-area-inset-left));
		bottom: max(22px, env(safe-area-inset-bottom));
		z-index: 60;
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
		transform: translateY(-1px);
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
