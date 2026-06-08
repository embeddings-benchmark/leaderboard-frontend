<!-- Bottom-left floating "back to top" pill; bookends `ShareUrlButton`. -->
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
