<script lang="ts">
	import { onMount } from 'svelte';
	import { goto } from '$app/navigation';
	import { base } from '$app/paths';

	onMount(() => {
		goto(`${base}/explorer`, { replaceState: true });
	});
</script>

<svelte:head>
	<meta http-equiv="refresh" content="0;url={base}/explorer" />
</svelte:head>

<p class="redirect">Redirecting to Explorer…</p>

<style>
	.redirect {
		padding: 80px 28px;
		color: var(--text-muted);
		font-size: 14px;
	}
</style>
