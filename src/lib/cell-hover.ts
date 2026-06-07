/**
 * Helpers for delegated pointer-hover events on table cells.
 *
 * Svelte 5 delegates the bubbling `pointerover` / `pointerout` pair
 * to the document — using those instead of `pointerenter` /
 * `pointerleave` saves a per-cell listener (significant on a
 * 400-row × 250-column PerTask table). The bubbling pair fires on
 * every internal cursor traversal too, so we filter for outer
 * boundary crossings via `relatedTarget`.
 */

/**
 * Return true iff the event just crossed the cell's outer boundary
 * (entry or exit). False for internal traversal (cursor moved
 * between children of the same cell).
 */
export function isBoundaryCross(e: PointerEvent | FocusEvent): boolean {
	const cell = e.currentTarget as HTMLElement | null;
	const other = (e as PointerEvent).relatedTarget as Node | null;
	return !!cell && !(other && cell.contains(other));
}

/**
 * Clamp the cell-anchored x-coordinate of a fixed-position tooltip so
 * its `maxWidth/2` half doesn't run off either viewport edge. On
 * viewports narrower than `maxWidth` the tip centres on the viewport
 * rather than letting min exceed max.
 */
export function clampTooltipX(rawX: number, maxWidth: number, edge = 8): number {
	if (typeof window === 'undefined') return rawX;
	const half = maxWidth / 2;
	const min = edge + half;
	const max = window.innerWidth - edge - half;
	if (min > max) return window.innerWidth / 2;
	return Math.min(max, Math.max(min, rawX));
}
