<script lang="ts">
	import FilterContent from './FilterContent.svelte';

	interface Props {
		open: boolean;
		onClose: () => void;
	}
	let { open, onClose }: Props = $props();

	function onKey(e: KeyboardEvent) {
		if (e.key === 'Escape' && open) onClose();
	}
</script>

<svelte:window onkeydown={onKey} />

{#if open}
	<div
		class="backdrop"
		role="presentation"
		onclick={onClose}
		onkeydown={(e) => {
			if (e.key === 'Enter' || e.key === ' ') onClose();
		}}
		tabindex="-1"
	></div>
	<div class="drawer" role="dialog" aria-label="Filters" aria-modal="true">
		<header class="head">
			<h2>Filters</h2>
			<button type="button" class="close" onclick={onClose} aria-label="Close filters">×</button>
		</header>
		<div class="body">
			<FilterContent />
		</div>
	</div>
{/if}

<style>
	.backdrop {
		position: fixed;
		inset: 0;
		background: rgb(var(--shadow-tint) / 0.45);
		z-index: 200;
		animation: fade 0.18s ease;
	}
	@keyframes fade {
		from {
			opacity: 0;
		}
		to {
			opacity: 1;
		}
	}
	.drawer {
		position: fixed;
		top: 0;
		right: 0;
		height: 100vh;
		width: 340px;
		max-width: 92vw;
		background: var(--surface);
		border-left: 1px solid var(--border);
		box-shadow: -8px 0 24px rgb(var(--shadow-tint) / 0.08);
		z-index: 201;
		display: flex;
		flex-direction: column;
		animation: slide 0.22s ease;
	}
	@keyframes slide {
		from {
			transform: translateX(20px);
			opacity: 0;
		}
		to {
			transform: translateX(0);
			opacity: 1;
		}
	}
	.head {
		display: flex;
		align-items: center;
		justify-content: space-between;
		padding: 14px 16px;
		border-bottom: 1px solid var(--border);
	}
	.head h2 {
		font-size: 14px;
		margin: 0;
		letter-spacing: 0.04em;
		text-transform: uppercase;
		color: var(--text-muted);
	}
	.close {
		background: none;
		border: none;
		font-size: 24px;
		line-height: 1;
		color: var(--text-subtle);
		cursor: pointer;
		padding: 4px 8px;
		border-radius: 6px;
	}
	.close:hover {
		color: var(--text);
		background: var(--surface-muted);
	}
	.body {
		flex: 1;
		overflow-y: auto;
	}
</style>
