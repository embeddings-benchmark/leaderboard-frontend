import type { Benchmark, BenchmarkSummary } from '$lib/types';
import { loadBenchmark, loadSummary } from '$lib/data/service';
import { DEFAULT_BENCHMARK_NAME } from '$lib/data/defaults';

interface LeaderboardState {
	selected: string;
	loading: boolean;
	// Language-scoped refetch; distinct from `loading` so the existing table
	// stays visible behind a progress bar.
	refetching: boolean;
	error: string | null;
}

function createLeaderboardStore() {
	const state = $state<LeaderboardState>({
		selected: DEFAULT_BENCHMARK_NAME,
		loading: false,
		refetching: false,
		error: null
	});
	// $state.raw — reassigned wholesale, never deep-mutated.
	let benchmark = $state.raw<Benchmark | null>(null);
	let summary = $state.raw<BenchmarkSummary | null>(null);

	let inflight = 0;
	// Debounced + dedupe-keyed language refetch — the server rebuild is heavy
	// on Multilingual.
	let langInflight = 0;
	let langKey = '';
	let langDebounceTimer: ReturnType<typeof setTimeout> | null = null;
	const LANG_DEBOUNCE_MS = 300;

	async function select(name: string) {
		state.selected = name;
		langKey = '';
		state.refetching = false;
		if (langDebounceTimer) {
			clearTimeout(langDebounceTimer);
			langDebounceTimer = null;
		}
		const id = ++inflight;
		state.loading = true;
		state.error = null;
		try {
			const [b, s] = await Promise.all([loadBenchmark(name), loadSummary(name)]);
			if (id !== inflight) return;
			benchmark = b;
			summary = s;
		} catch (e) {
			if (id !== inflight) return;
			state.error = e instanceof Error ? e.message : String(e);
		} finally {
			if (id === inflight) state.loading = false;
		}
	}

	// Debounced refetch of the summary scoped to `languages` (empty = unfiltered).
	function requestSummaryForLanguages(languages?: ReadonlyArray<string>) {
		const name = state.selected;
		const lang = languages && languages.length ? Array.from(new Set(languages)).sort() : [];
		const key = `${name}::${lang.join(',')}`;
		if (key === langKey) return;
		if (langDebounceTimer) clearTimeout(langDebounceTimer);
		// Flip the flag pre-debounce so the progress bar appears on click.
		state.refetching = true;
		langDebounceTimer = setTimeout(() => {
			langDebounceTimer = null;
			void _fetchSummaryForLanguages(name, lang, key);
		}, LANG_DEBOUNCE_MS);
	}

	async function _fetchSummaryForLanguages(
		name: string,
		lang: string[],
		key: string
	): Promise<void> {
		langKey = key;
		const id = ++langInflight;
		try {
			const s = await loadSummary(name, lang.length ? lang : undefined);
			if (id !== langInflight || state.selected !== name) return;
			summary = s;
		} catch (e) {
			if (id !== langInflight) return;
			state.error = e instanceof Error ? e.message : String(e);
		} finally {
			if (id === langInflight) state.refetching = false;
		}
	}

	return {
		get selected() {
			return state.selected;
		},
		get benchmark() {
			return benchmark;
		},
		get summary() {
			return summary;
		},
		get loading() {
			return state.loading;
		},
		get refetching() {
			return state.refetching;
		},
		get error() {
			return state.error;
		},
		select,
		requestSummaryForLanguages
	};
}

export const leaderboard = createLeaderboardStore();
