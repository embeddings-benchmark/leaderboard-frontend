// Shared "pinned models" set. Pinning in any table floats that model to the
// top of every table that shows it (Summary, PerTask, PerLanguage, Spreadsheet).
function createPinned() {
	let value = $state(new Set<string>());

	return {
		get value() {
			return value;
		},
		get size() {
			return value.size;
		},
		has(name: string) {
			return value.has(name);
		},
		toggle(name: string) {
			const next = new Set(value);
			if (next.has(name)) next.delete(name);
			else next.add(name);
			value = next;
		},
		add(name: string) {
			if (value.has(name)) return;
			const next = new Set(value);
			next.add(name);
			value = next;
		},
		remove(name: string) {
			if (!value.has(name)) return;
			const next = new Set(value);
			next.delete(name);
			value = next;
		},
		clear() {
			if (value.size === 0) return;
			value = new Set();
		}
	};
}

export const pinnedModels = createPinned();
