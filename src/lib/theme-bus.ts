// Shared theme-change dispatcher. Every PlotlyChart instance used to install
// its own MutationObserver on `data-theme` + its own `prefers-color-scheme`
// media listener — for N charts on a page that's 2N listeners that all fire
// for one theme toggle. Centralising lets us pay one observer + one media
// listener total, fanning out to subscribers.

type Sub = () => void;

const subs = new Set<Sub>();
let installed = false;
let mq: MediaQueryList | null = null;

function dispatch() {
	for (const s of subs) s();
}

function install() {
	if (installed || typeof window === 'undefined') return;
	installed = true;
	const mo = new MutationObserver(dispatch);
	mo.observe(document.documentElement, { attributes: true, attributeFilter: ['data-theme'] });
	mq = window.matchMedia('(prefers-color-scheme: dark)');
	mq.addEventListener('change', dispatch);
}

export function onThemeChange(fn: Sub): () => void {
	install();
	subs.add(fn);
	return () => subs.delete(fn);
}
