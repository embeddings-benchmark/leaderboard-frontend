import type { Benchmark, BenchmarkSummary } from '$lib/types';
import { loadBenchmark, loadSummary } from '$lib/data/service';
import { DEFAULT_BENCHMARK_NAME } from '$lib/data/defaults';

interface LeaderboardState {
	selected: string;
	benchmark: Benchmark | null;
	summary: BenchmarkSummary | null;
	loading: boolean;
	// True while a language-scoped summary refetch is queued or in
	// flight. Distinct from `loading` (which only flips for the initial
	// benchmark load): callers can show a thin progress bar over the
	// existing table without dimming the rows the user is reading.
	refetching: boolean;
	error: string | null;
}

function createLeaderboardStore() {
	const state = $state<LeaderboardState>({
		selected: DEFAULT_BENCHMARK_NAME,
		benchmark: null,
		summary: null,
		loading: false,
		refetching: false,
		error: null
	});

	let inflight = 0;
	// Language-scoped refetch tracker: `(benchmark, sorted-langs)` key so
	// repeated triggers with the same picks no-op, and stale fetches lose
	// to fresh ones via the counter. A debounce on top swallows rapid
	// checkbox toggles — the server-side polars filter + summary rebuild
	// is non-trivial on huge benchmarks (Multilingual), so we want to
	// fire only when the user stops clicking.
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

	// Refetch the summary scoped to ``languages`` (or unfiltered when
	// empty / undefined). Called from the benchmark page when the user
	// narrows the language filter — the server recomputes per-task /
	// mean scores over the picked subset and we swap the new summary
	// into state. Subsequent toggles back to the same selection hit
	// the LRU `cachedHttp` slot (and the backend per-(name, langs)
	// cache) — no rebuild.
	//
	// Debounced: rapid checkbox flips coalesce into one fetch after the
	// user settles. Reverting to an earlier still-cached combo within
	// the debounce window flushes through immediately via the dedupe key.
	function requestSummaryForLanguages(languages?: ReadonlyArray<string>) {
		const name = state.selected;
		const lang = languages && languages.length ? Array.from(new Set(languages)).sort() : [];
		const key = `${name}::${lang.join(',')}`;
		if (key === langKey) return;
		if (langDebounceTimer) clearTimeout(langDebounceTimer);
		// Flip the refetching flag immediately (not after the debounce)
		// so the UI shows the progress bar as soon as the user clicks
		// a chip — otherwise the 300ms debounce window feels unresponsive.
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
			const summary = await loadSummary(name, lang.length ? lang : undefined);
			if (id !== langInflight || state.selected !== name) return;
			state.summary = summary;
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
			return state.benchmark;
		},
		get summary() {
			return state.summary;
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
