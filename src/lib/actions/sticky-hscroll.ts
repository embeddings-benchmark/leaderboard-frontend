/**
 * Sticky horizontal scrollbar overlay for tall tables.
 *
 * Why: `.tbl-scroll` has `overflow-x: auto` and no `max-height`, so it grows
 * to fit the table (often several thousand pixels) and the native horizontal
 * scrollbar sits at the very bottom of that wrapper — far below the viewport
 * fold. Users had no visual hint that the table was horizontally scrollable.
 *
 * What: this action mirrors the `stickyHead` pattern in reverse. It builds a
 * `position: fixed; bottom: 0` overlay the same width as the wrapper, with a
 * single inner element sized to the real table's `scrollWidth`. The browser
 * gives the overlay a native horizontal scrollbar; we sync its `scrollLeft`
 * both ways with the underlying wrapper so dragging the floating bar pans
 * the table and vice versa. Visible only when the wrapper straddles the
 * viewport such that its own scrollbar is off-screen.
 *
 * Usage:
 *   <div class="tbl-scroll" use:stickyHScroll>
 *     <table>…</table>
 *   </div>
 */

import type { Action } from 'svelte/action';

const BAR_HEIGHT_PX = 14;

export const stickyHScroll: Action<HTMLElement> = (wrapper) => {
	const overlay = document.createElement('div');
	overlay.setAttribute('aria-hidden', 'true');
	overlay.className = 'sticky-hscroll-overlay';
	overlay.style.cssText = `
		position: fixed;
		left: 0;
		bottom: 0;
		height: ${BAR_HEIGHT_PX}px;
		overflow-x: scroll;
		overflow-y: hidden;
		pointer-events: auto;
		z-index: 40;
		background: var(--bar-bg, var(--surface));
		border-top: 1px solid var(--border);
		backdrop-filter: blur(14px) saturate(140%);
		-webkit-backdrop-filter: blur(14px) saturate(140%);
		display: none;
		scrollbar-width: thin;
		scrollbar-color: var(--border-strong) transparent;
	`;

	// Inner spacer just gives the overlay something with the table's
	// scrollable width so the native scrollbar appears the right size.
	const spacer = document.createElement('div');
	spacer.style.cssText = 'height: 1px; width: 1px;';
	overlay.appendChild(spacer);
	document.body.appendChild(overlay);

	// Two-way scroll sync. The `syncing` flag avoids the feedback loop
	// where setting scrollLeft fires the listener which sets scrollLeft
	// back, etc.
	let syncing = false;
	function onOverlayScroll() {
		if (syncing) return;
		syncing = true;
		wrapper.scrollLeft = overlay.scrollLeft;
		syncing = false;
	}
	function onWrapperScroll() {
		if (syncing) return;
		syncing = true;
		overlay.scrollLeft = wrapper.scrollLeft;
		syncing = false;
	}

	function update() {
		const table = wrapper.firstElementChild as HTMLElement | null;
		const scrollWidth = table ? table.scrollWidth : wrapper.scrollWidth;
		const wrapperRect = wrapper.getBoundingClientRect();
		const viewportH = window.innerHeight;

		// Hide when the wrapper isn't horizontally scrollable.
		if (scrollWidth <= wrapper.clientWidth) {
			overlay.style.display = 'none';
			return;
		}

		// The wrapper's own bottom-edge scrollbar is on-screen when the
		// wrapper's bottom is inside the viewport. In that case the
		// native bar is reachable, so the floating overlay is redundant.
		// Also hide when the wrapper has scrolled entirely off-screen
		// (top is past the bottom of the viewport).
		const wrapperBottomVisible = wrapperRect.bottom <= viewportH;
		const wrapperOffscreen = wrapperRect.top >= viewportH;
		if (wrapperBottomVisible || wrapperOffscreen) {
			overlay.style.display = 'none';
			return;
		}

		overlay.style.display = 'block';
		overlay.style.left = `${wrapperRect.left}px`;
		overlay.style.width = `${wrapperRect.width}px`;
		spacer.style.width = `${scrollWidth}px`;

		// Keep the floating bar's scroll position aligned with the real one.
		if (overlay.scrollLeft !== wrapper.scrollLeft) {
			syncing = true;
			overlay.scrollLeft = wrapper.scrollLeft;
			syncing = false;
		}
	}

	// Batch `update()` so a noisy scroll stream resolves to one layout
	// read + style write per frame instead of one per event.
	let rafId = 0;
	function scheduleUpdate() {
		if (rafId) return;
		rafId = requestAnimationFrame(() => {
			rafId = 0;
			update();
		});
	}

	const ro = new ResizeObserver(scheduleUpdate);
	ro.observe(wrapper);
	const table = wrapper.firstElementChild;
	if (table) ro.observe(table);

	window.addEventListener('scroll', scheduleUpdate, { passive: true });
	wrapper.addEventListener('scroll', onWrapperScroll, { passive: true });
	overlay.addEventListener('scroll', onOverlayScroll, { passive: true });
	window.addEventListener('resize', scheduleUpdate);

	update();

	return {
		destroy() {
			if (rafId) cancelAnimationFrame(rafId);
			ro.disconnect();
			window.removeEventListener('scroll', scheduleUpdate);
			wrapper.removeEventListener('scroll', onWrapperScroll);
			overlay.removeEventListener('scroll', onOverlayScroll);
			window.removeEventListener('resize', scheduleUpdate);
			overlay.remove();
		}
	};
};
