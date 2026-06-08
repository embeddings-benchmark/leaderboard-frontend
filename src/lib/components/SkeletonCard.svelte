<script lang="ts">
	// Skeleton placeholder for one card in the /models /tasks /benchmarks grids.
	// Shape mirrors the real card shell (title + 2-line desc + 4 stats + chips
	// + badge row) so the transition to real content is positionally stable.
</script>

<div class="card-skel">
	<div class="skel title"></div>
	<div class="skel desc"></div>
	<div class="skel desc short"></div>
	<div class="card-stats">
		<div class="skel stat"></div>
		<div class="skel stat"></div>
		<div class="skel stat"></div>
		<div class="skel stat"></div>
	</div>
	<div class="chip-row">
		<div class="skel chip"></div>
		<div class="skel chip"></div>
	</div>
</div>

<style>
	.card-skel {
		background: var(--surface);
		border: 1px solid var(--border);
		border-radius: 12px;
		padding: 14px 16px;
		display: flex;
		flex-direction: column;
		gap: 10px;
		min-height: 220px;
		position: relative;
		overflow: hidden;
	}
	/* Same 3px top accent strip as the real cards — kept transparent here so
	   it doesn't pulse against the soft fills. */
	.card-skel::before {
		content: '';
		position: absolute;
		top: 0;
		left: 0;
		right: 0;
		height: 3px;
		background: var(--border);
	}
	.title {
		width: 70%;
		height: 16px;
	}
	.desc {
		width: 100%;
		height: 11px;
	}
	.desc.short {
		width: 60%;
	}
	.card-stats {
		margin-top: 4px;
	}
	.stat {
		height: 22px;
	}
	.chip {
		width: 64px;
		height: 18px;
		border-radius: 999px;
	}
</style>
