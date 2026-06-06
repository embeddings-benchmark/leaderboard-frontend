// Shared window scroll/resize dispatcher for sticky-head / sticky-hscroll.
// Each table action used to install its own listener — with pre-mounted
// PerTaskTab + PerLanguageTab + Summary, that meant up to 6 redundant
// listeners firing on every scroll. Centralising to one listener per type
// cuts the dispatch cost proportionally.

type Sub = () => void;

const scrollSubs = new Set<Sub>();
const resizeSubs = new Set<Sub>();
let installed = false;

function onScroll() {
	for (const s of scrollSubs) s();
}
function onResize() {
	for (const s of resizeSubs) s();
}
function install() {
	if (installed || typeof window === 'undefined') return;
	installed = true;
	window.addEventListener('scroll', onScroll, { passive: true });
	window.addEventListener('resize', onResize);
}

export function onWindowScroll(fn: Sub): () => void {
	install();
	scrollSubs.add(fn);
	return () => scrollSubs.delete(fn);
}

export function onWindowResize(fn: Sub): () => void {
	install();
	resizeSubs.add(fn);
	return () => resizeSubs.delete(fn);
}
