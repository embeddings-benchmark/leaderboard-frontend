<script lang="ts">
	import '../app.css';
	import { base } from '$app/paths';
	import ViewSwitcher from '$lib/components/ViewSwitcher.svelte';

	let { children } = $props();
</script>

<svelte:head>
	<link rel="icon" href="{base}/dots-icon.ico" type="image/x-icon" />
	<title>MTEB Leaderboard</title>
</svelte:head>

<ViewSwitcher />
{@render children()}
