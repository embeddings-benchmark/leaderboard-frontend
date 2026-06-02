/**
 * Sticky-thead overlay for leaderboard tables.
 *
 * Why: `.tbl-scroll` has `overflow-x: auto` to contain wide tables inside the
 * main column. Browsers coerce overflow-y to `auto` too, which forms a scroll
 * container on both axes — `position: sticky` on `<thead>` therefore anchors
 * within the wrapper, not the page viewport, and scrolls out of view with
 * the wrapper. There is no CSS-only fix.
 *
 * What: this action clones the `<thead>` into a `position: fixed` overlay
 * pinned at `top: STICKY_TOP_PX` (under the explorer top bar). It mirrors
 * column widths, horizontal scroll, and sort-indicator state, and forwards
 * clicks on the clone's sort buttons to the real ones by index. The original
 * thead remains in the DOM (for layout + reflow) but visually identical
 * "sticky" feedback comes from the overlay.
 *
 * Usage:
 *   <div class="tbl-scroll">
 *     <table class="tbl" use:stickyHead> ... </table>
 *   </div>
 */

import type { Action } from 'svelte/action';

const STICKY_TOP_PX = 60;

export const stickyHead: Action<HTMLTableElement> = (table) => {
	const wrapperOrNull = table.closest<HTMLElement>('.tbl-scroll');
	const theadOrNull = table.tHead;
	if (!wrapperOrNull || !theadOrNull) return;
	// Bind to non-nullable locals so closures below don't need re-narrowing.
	const wrapper: HTMLElement = wrapperOrNull;
	const realThead: HTMLTableSectionElement = theadOrNull;

	const overlay = document.createElement('div');
	overlay.setAttribute('aria-hidden', 'true');
	overlay.className = 'sticky-head-overlay';
	overlay.style.cssText = `
		position: fixed;
		top: ${STICKY_TOP_PX}px;
		z-index: 50;
		overflow: hidden;
		pointer-events: none;
		display: none;
	`;

	// Inner div is the actual horizontal scroll container that mirrors the
	// wrapper's scrollLeft. Sticky cells (.tbl-sticky-pin, .tbl-sticky-col)
	// inside the cloned thead then "stick" relative to this inner scrollport,
	// matching their behavior in the real wrapper.
	const inner = document.createElement('div');
	inner.className = 'sticky-head-inner';
	inner.style.cssText = `
		overflow-x: scroll;
		overflow-y: hidden;
		scrollbar-width: none;
		pointer-events: auto;
		width: 100%;
		height: 100%;
	`;
	(inner.style as CSSStyleDeclaration & { msOverflowStyle?: string }).msOverflowStyle = 'none';

	const cloneTable = document.createElement('table');
	cloneTable.className = table.className;
	// Borrow the original's inline width so column layout matches exactly.
	cloneTable.style.borderCollapse = 'separate';
	cloneTable.style.borderSpacing = '0';

	let cloneThead = realThead.cloneNode(true) as HTMLTableSectionElement;
	stripIds(cloneThead);
	cloneTable.appendChild(cloneThead);
	inner.appendChild(cloneTable);
	overlay.appendChild(inner);
	document.body.appendChild(overlay);

	function stripIds(root: HTMLElement) {
		root.removeAttribute('id');
		root.querySelectorAll('[id]').forEach((el) => el.removeAttribute('id'));
	}

	function syncContent() {
		// Re-clone the real thead so sort indicator state (↑ ↓ ↕) and any other
		// reactive label changes show up on the overlay.
		const fresh = realThead.cloneNode(true) as HTMLTableSectionElement;
		stripIds(fresh);
		cloneTable.replaceChild(fresh, cloneThead);
		cloneThead = fresh;
		syncWidths();
	}

	function syncWidths() {
		cloneTable.style.width = `${table.offsetWidth}px`;
		const realThs = Array.from(realThead.querySelectorAll<HTMLTableCellElement>('th'));
		const cloneThs = Array.from(cloneThead.querySelectorAll<HTMLTableCellElement>('th'));
		for (let i = 0; i < realThs.length; i++) {
			const cloneTh = cloneThs[i];
			if (!cloneTh) continue;
			const w = realThs[i].offsetWidth;
			cloneTh.style.width = `${w}px`;
			cloneTh.style.minWidth = `${w}px`;
			cloneTh.style.maxWidth = `${w}px`;
		}
	}

	function update() {
		const wrapperRect = wrapper.getBoundingClientRect();
		const theadRect = realThead.getBoundingClientRect();
		const tableRect = table.getBoundingClientRect();

		// Show the overlay only when the real thead has scrolled above the offset
		// AND the table itself is still on screen (its bottom hasn't crossed
		// above the overlay yet). Otherwise we'd leave a ghost thead floating
		// after the table is gone.
		const headH = theadRect.height;
		const shouldShow = theadRect.top < STICKY_TOP_PX && tableRect.bottom > STICKY_TOP_PX + headH;

		if (!shouldShow) {
			overlay.style.display = 'none';
			return;
		}

		overlay.style.display = 'block';
		overlay.style.left = `${wrapperRect.left}px`;
		overlay.style.width = `${wrapperRect.width}px`;
		overlay.style.height = `${headH}px`;
		inner.scrollLeft = wrapper.scrollLeft;
	}

	// Forward clicks on the overlay's sort buttons (or any button-like control)
	// to the matching real one by DOM-order index, so sorting works without
	// having to scroll back up.
	function onCloneClick(e: Event) {
		const target = e.target as HTMLElement;
		const cloneBtn = target.closest('button');
		if (!cloneBtn || !inner.contains(cloneBtn)) return;
		const cloneBtns = Array.from(inner.querySelectorAll('button'));
		const realBtns = Array.from(realThead.querySelectorAll('button'));
		const idx = cloneBtns.indexOf(cloneBtn);
		const real = realBtns[idx];
		if (real) {
			e.preventDefault();
			real.click();
		}
	}

	const onScroll = () => update();
	const onWrapperScroll = () => update();
	const onResize = () => {
		syncWidths();
		update();
	};

	const ro = new ResizeObserver(() => {
		syncWidths();
		update();
	});
	ro.observe(table);
	ro.observe(wrapper);

	const mo = new MutationObserver(() => syncContent());
	mo.observe(realThead, { childList: true, subtree: true, characterData: true, attributes: true });

	window.addEventListener('scroll', onScroll, { passive: true });
	wrapper.addEventListener('scroll', onWrapperScroll, { passive: true });
	window.addEventListener('resize', onResize);
	inner.addEventListener('click', onCloneClick);

	syncWidths();
	update();

	return {
		destroy() {
			ro.disconnect();
			mo.disconnect();
			window.removeEventListener('scroll', onScroll);
			wrapper.removeEventListener('scroll', onWrapperScroll);
			window.removeEventListener('resize', onResize);
			inner.removeEventListener('click', onCloneClick);
			overlay.remove();
		}
	};
};
