<script lang="ts">
	// "How is the BT score computed?" — plain-language walkthrough with a tiny worked
	// example, so the Summary table's BT Score column isn't a black box. The same
	// algorithm lives in `$lib/bt-score` (client) and `mteb/api/bradley_terry.py`.
</script>

<details class="bt-score-explainer" id="bt-score">
	<summary>How is the BT score computed?</summary>
	<div class="body">
		<p>
			Instead of averaging raw scores (which mixes metrics with different scales), the BT
			(Bradley-Terry) score only asks
			<em>who beats whom</em> on each task.
		</p>
		<ol>
			<li>
				<strong>Head-to-head per task.</strong> On every task, each pair of models plays one round: the
				higher score wins, equal scores tie (half a win each).
			</li>
			<li>
				<strong>Missing = loss.</strong> A model evaluated on a task beats one that wasn't, so skipping
				tasks never inflates a rating. Two models that both lack a task aren't compared on it.
			</li>
			<li>
				<strong>Bradley-Terry fit.</strong> Wins are summed over tasks and a Bradley-Terry model finds
				the strength for each model that best explains all the results, then rescales it to an Elo-style
				number centered on 1000. A 400-point gap means the stronger model is expected to win about 91%
				of matchups.
			</li>
			<li>
				<strong>Uncertainty.</strong> The <em>±</em> is half the width of a 95% bootstrap interval: tasks
				are resampled with replacement and the fit repeated. Close ratings with overlapping intervals
				aren't reliably ordered.
			</li>
		</ol>
		<p class="example-title">Example — 3 models, 3 tasks (higher is better)</p>
		<table class="example">
			<thead>
				<tr><th></th><th>Task 1</th><th>Task 2</th><th>Task 3</th><th>Wins</th></tr>
			</thead>
			<tbody>
				<tr><th scope="row">A</th><td>0.80</td><td>0.60</td><td>0.90</td><td>5 of 6</td></tr>
				<tr><th scope="row">B</th><td>0.70</td><td>0.65</td><td>—</td><td>3 of 6</td></tr>
				<tr><th scope="row">C</th><td>0.50</td><td>—</td><td>0.40</td><td>1 of 6</td></tr>
			</tbody>
		</table>
		<p>
			Each task has 3 pairings, 9 in total. A has the highest scores overall but loses to B on Task
			2 (0.60 vs 0.65), so it wins 5 of its 6 pairings. B wins 3 (it beats C on Tasks 1 and 2, and A
			on Task 2) — it has no Task 3 score, so it loses both Task 3 pairings. C wins just 1: its only
			win is over B on Task 3, where B has no score. These counts, not the raw scores, determine the
			ratings.
		</p>
		<p class="note">
			The BT score is relative to the models and tasks being compared: narrowing the filters re-fits
			it on the visible set (without the ± interval).
		</p>
	</div>
</details>

<style>
	.bt-score-explainer {
		border: 1px solid var(--border);
		border-radius: 10px;
		background: var(--surface);
		padding: 10px 14px;
		margin-bottom: 16px;
	}
	summary {
		cursor: pointer;
		font-weight: 600;
		color: var(--ink-strong);
	}
	.body {
		margin-top: 10px;
		display: grid;
		gap: 10px;
		max-width: 70ch;
		color: var(--text);
	}
	ol {
		margin: 0;
		padding-left: 1.2em;
		display: grid;
		gap: 6px;
	}
	.example-title {
		font-weight: 600;
		margin: 4px 0 0;
	}
	.example {
		border-collapse: collapse;
		font-variant-numeric: tabular-nums;
		width: max-content;
	}
	.example th,
	.example td {
		border: 1px solid var(--border);
		padding: 4px 10px;
		text-align: right;
	}
	.example th:first-child {
		text-align: left;
	}
	.note {
		color: var(--text-muted);
		font-size: 0.9em;
	}
</style>
