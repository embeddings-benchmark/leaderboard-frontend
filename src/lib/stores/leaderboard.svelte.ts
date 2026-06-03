import type { Benchmark, BenchmarkSummary } from '$lib/types';
import { DEFAULT_BENCHMARK_NAME, loadBenchmark, loadSummary } from '$lib/data/service';

interface LeaderboardState {
	selected: string;
	benchmark: Benchmark | null;
	summary: BenchmarkSummary | null;
	loading: boolean;
	error: string | null;
}

function createLeaderboardStore() {
	const state = $state<LeaderboardState>({
		selected: DEFAULT_BENCHMARK_NAME,
		benchmark: null,
		summary: null,
		loading: false,
		error: null
	});

	let inflight = 0;

	async function select(name: string) {
		state.selected = name;
		const id = ++inflight;
		state.loading = true;
		state.error = null;
		try {
			const [benchmark, summary] = await Promise.all([loadBenchmark(name), loadSummary(name)]);
			if (id !== inflight) return;
			state.benchmark = benchmark;
			state.summary = summary;
		} catch (e) {
			if (id !== inflight) return;
			state.error = e instanceof Error ? e.message : String(e);
		} finally {
			if (id === inflight) state.loading = false;
		}
	}

	return {
		get selected() {
			return state.selected;
		},
		get benchmark() {
			return state.benchmark;
		},
		get summary() {
			return state.summary;
		},
		get loading() {
			return state.loading;
		},
		get error() {
			return state.error;
		},
		select
	};
}

export const leaderboard = createLeaderboardStore();
