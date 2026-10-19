/**
 * BibTeX → APA (7th edition) reference formatting for the cite dialog.
 *
 * The citations come straight from mteb metadata, so this covers the BibTeX
 * that actually ships there — `@article`, `@inproceedings`, `@misc` arXiv
 * preprints, datasets, software, theses, reports — rather than the whole
 * BibTeX grammar. A citation string may hold several entries; each becomes
 * its own reference.
 *
 * Titles are kept as written: APA wants sentence case, but lowering words
 * would mangle model names and acronyms the BibTeX didn't brace-protect.
 */

export interface BibEntry {
	type: string;
	key: string;
	/** Lower-cased field names → raw values (LaTeX not yet decoded). */
	fields: Record<string, string>;
}

/** One run of reference text; `em` runs are italic (journal, book, volume). */
export interface RefPart {
	text: string;
	em?: boolean;
}

const MONTHS: Record<string, string> = {
	jan: 'January',
	feb: 'February',
	mar: 'March',
	apr: 'April',
	may: 'May',
	jun: 'June',
	jul: 'July',
	aug: 'August',
	sep: 'September',
	oct: 'October',
	nov: 'November',
	dec: 'December'
};

/** Parse every `@type{key, field = value, …}` entry in `src`. */
export function parseBibtex(src: string): BibEntry[] {
	const entries: BibEntry[] = [];
	let i = 0;
	while ((i = src.indexOf('@', i)) !== -1) {
		const head = /^@\s*(\w+)\s*[{(]\s*/.exec(src.slice(i));
		if (!head) {
			i++;
			continue;
		}
		const type = head[1].toLowerCase();
		i += head[0].length;
		if (type === 'comment' || type === 'preamble' || type === 'string') continue;

		const keyEnd = src.slice(i).search(/[,}\s]/);
		const key = keyEnd === -1 ? src.slice(i) : src.slice(i, i + keyEnd);
		i += key.length;
		const fields: Record<string, string> = {};

		while (i < src.length) {
			const name = /^[\s,]*([\w:.-]+)\s*=\s*/.exec(src.slice(i));
			if (!name) break;
			i += name[0].length;
			const parts: string[] = [];
			// `a # b` concatenation: keep reading values while a `#` follows.
			for (;;) {
				const [value, next] = readValue(src, i);
				parts.push(value);
				i = next;
				const hash = /^\s*#\s*/.exec(src.slice(i));
				if (!hash) break;
				i += hash[0].length;
			}
			fields[name[1].toLowerCase()] = parts.join('');
		}
		const close = /^[\s,]*[})]/.exec(src.slice(i));
		if (close) i += close[0].length;
		entries.push({ type, key, fields });
	}
	return entries;
}

/** Read one braced, quoted or bare value starting at `i`. */
function readValue(src: string, i: number): [value: string, next: number] {
	const open = src[i];
	if (open === '{' || open === '"') {
		const close = open === '{' ? '}' : '"';
		let depth = 0;
		for (let j = i + 1; j < src.length; j++) {
			const c = src[j];
			if (c === '\\') {
				j++;
				continue;
			}
			if (c === '{') depth++;
			else if (c === '}' && depth > 0) depth--;
			else if (c === close && depth === 0) return [src.slice(i + 1, j), j + 1];
		}
		return [src.slice(i + 1), src.length];
	}
	// Bare number or macro (`month = jan`).
	const bare = /^[^,}#\s]*/.exec(src.slice(i))![0];
	return [MONTHS[bare.toLowerCase()] ?? bare, i + bare.length];
}

// LaTeX accent commands → Unicode combining marks.
const ACCENTS: Record<string, string> = {
	"'": '́',
	'`': '̀',
	'^': '̂',
	'"': '̈',
	'~': '̃',
	'=': '̄',
	'.': '̇',
	u: '̆',
	v: '̌',
	H: '̋',
	c: '̧',
	k: '̨',
	d: '̣',
	r: '̊',
	b: '̱'
};
const SYMBOLS: Record<string, string> = {
	i: 'ı',
	j: 'ȷ',
	l: 'ł',
	L: 'Ł',
	o: 'ø',
	O: 'Ø',
	ss: 'ß',
	aa: 'å',
	AA: 'Å',
	ae: 'æ',
	AE: 'Æ',
	oe: 'œ',
	OE: 'Œ'
};

/** Decode the LaTeX that shows up in BibTeX fields into plain Unicode text. */
export function latexToText(s: string): string {
	return (
		s
			// Some mteb entries double-escape commands (`{\\O}vrelid`); a real
			// `\\` line break is never followed directly by a letter or accent.
			.replace(/\\\\(?=[a-zA-Z`'^"~=.])/g, '\\')
			// Accents: \'e, \'{e}, {\'e}, \v{s}, \'\i
			.replace(
				/\\([`'^"~=.]|[uvHckdrb](?=[\s{]))\s*(?:\{\s*(\\?[a-zA-Z])\s*\}|(\\?[a-zA-Z]))/g,
				(_, acc: string, braced?: string, bare?: string) => {
					const base = (braced ?? bare)!.replace(/^\\([ij])$/, '$1');
					return base + ACCENTS[acc];
				}
			)
			.replace(/\\(ss|aa|AA|ae|AE|oe|OE|[ijlLoO])(?![a-zA-Z])\s*/g, (_, c: string) => SYMBOLS[c])
			.replace(/\\\\/g, ' ')
			.replace(/\\([&%$#_{}])/g, '$1')
			// Formatting commands keep their argument: \emph{x}, \textit{x}, \url{x}
			.replace(/\\[a-zA-Z]+\s*/g, '')
			.replace(/[{}]/g, '')
			.replace(/``/g, '“')
			.replace(/''/g, '”')
			.replace(/---/g, '—')
			.replace(/--/g, '–')
			.replace(/~/g, ' ')
			.replace(/\s+/g, ' ')
			.trim()
			.normalize('NFC')
	);
}

/** Split at ` and ` (case-insensitive) outside braces. */
function splitNames(raw: string): string[] {
	const out: string[] = [];
	let depth = 0;
	let start = 0;
	for (let i = 0; i < raw.length; i++) {
		if (raw[i] === '{') depth++;
		else if (raw[i] === '}') depth--;
		else if (depth === 0 && /^\s+and\s+/i.test(raw.slice(i))) {
			out.push(raw.slice(start, i));
			const sep = /^\s+and\s+/i.exec(raw.slice(i))![0];
			i += sep.length - 1;
			start = i + 1;
		}
	}
	out.push(raw.slice(start));
	return out.map((n) => n.trim()).filter(Boolean);
}

/** Split on whitespace / commas outside braces, keeping braced groups whole. */
function tokens(s: string, sep: RegExp): string[] {
	const out: string[] = [];
	let depth = 0;
	let cur = '';
	for (const c of s) {
		if (c === '{') depth++;
		else if (c === '}') depth--;
		if (depth === 0 && sep.test(c)) {
			out.push(cur);
			cur = '';
		} else cur += c;
	}
	out.push(cur);
	return out.map((t) => t.trim());
}

/** `J.`, `J.-P.` from `John`, `Jean-Pierre`; already-initialled `J.` stays. */
function initials(given: string): string {
	return tokens(given, /\s/)
		.filter(Boolean)
		.map((word) =>
			latexToText(word)
				.split('-')
				.filter(Boolean)
				.map((p) => `${[...p][0]}.`)
				.join('-')
		)
		.join(' ');
}

/** One BibTeX name → APA `Last, F. M.`; brace-wrapped corporate names stay whole. */
export function apaName(raw: string): string {
	const name = raw.trim();
	if (/^\{.*\}$/.test(name) && !/\}.*\{/.test(name.slice(1, -1))) return latexToText(name);
	const commaParts = tokens(name, /,/);
	let last: string;
	let given: string;
	let suffix = '';
	if (commaParts.length >= 2) {
		// `Last, First` or `Last, Jr, First`
		last = commaParts[0];
		given = commaParts[commaParts.length - 1];
		if (commaParts.length >= 3) suffix = commaParts[1];
	} else {
		const words = tokens(name, /\s/).filter(Boolean);
		if (words.length === 1) return latexToText(words[0]);
		// `First von Last`: the surname starts at the first lower-case particle.
		let cut = words.findIndex((w, idx) => idx > 0 && idx < words.length - 1 && /^[a-z]/.test(w));
		if (cut === -1) cut = words.length - 1;
		last = words.slice(cut).join(' ');
		given = words.slice(0, cut).join(' ');
	}
	const init = initials(given);
	const out = latexToText(last) + (init ? `, ${init}` : '');
	return suffix ? `${out}, ${latexToText(suffix)}` : out;
}

/** APA author list: `A`, `A, & B`, `A, B, & C`, …; 21+ → first 19, …, last. */
export function apaAuthors(raw: string): string {
	const names = splitNames(raw);
	const etAl = names.length > 0 && names[names.length - 1].toLowerCase() === 'others';
	const list = (etAl ? names.slice(0, -1) : names).map(apaName);
	if (list.length === 0) return '';
	if (etAl) return `${list.join(', ')}, et al.`;
	if (list.length === 1) return list[0];
	if (list.length > 20) return `${list.slice(0, 19).join(', ')}, … ${list[list.length - 1]}`;
	return `${list.slice(0, -1).join(', ')}, & ${list[list.length - 1]}`;
}

/** Append `.` unless the text already ends in terminal punctuation. */
function period(s: string): string {
	return /[.?!]$/.test(s) ? s : `${s}.`;
}

/**
 * A URL or DOI as written: `~` and `--` are literal there, so it skips
 * `latexToText` and only drops braces and unescapes `\_`, `\&`, `\%`, `\#`.
 */
function rawUrl(s: string): string {
	return s
		.replace(/\\url\s*/g, '')
		.replace(/\\([_&%#])/g, '$1')
		.replace(/[{}\s]/g, '');
}

function link(f: Record<string, string>): string | null {
	if (f.doi) {
		const doi = rawUrl(f.doi).replace(/^(https?:\/\/)?(dx\.)?doi\.org\//i, '');
		return `https://doi.org/${doi}`;
	}
	return f.url ? rawUrl(f.url) : null;
}

/**
 * arXiv id for preprints cited as `@misc{eprint=…}` or `journal={arXiv preprint
 * arXiv:…}`. A journal article that also lists its arXiv `eprint` is published
 * work, not a preprint, so a non-arXiv `journal` returns null.
 */
function arxivId(f: Record<string, string>): string | null {
	if (f.journal && !/arxiv|corr/i.test(f.journal)) return null;
	const prefix = (f.archiveprefix ?? f.eprinttype ?? '').toLowerCase();
	if (f.eprint && (prefix === 'arxiv' || /^\d{4}\.\d{4,5}/.test(f.eprint))) return f.eprint.trim();
	const m = /arxiv(?: preprint)?[\s:]*(?:arxiv:)?\s*(\d{4}\.\d{4,5}(?:v\d+)?)/i.exec(
		`${f.journal ?? ''} ${f.note ?? ''}`
	);
	return m ? m[1] : null;
}

/** Format one entry as APA reference runs. */
export function toApa(entry: BibEntry): RefPart[] {
	const f = entry.fields;
	const text = (k: string) => (f[k] ? latexToText(f[k]) : '');
	const authors = f.author ? apaAuthors(f.author) : '';
	// biblatex entries may carry only `date = {2015-10-13}`.
	const year = text('year') || text('date').slice(0, 4) || 'n.d.';
	const title = text('title');
	const pages = text('pages').replace(/\s*[-–]+\s*/, '–');
	const url = link(f);

	const parts: RefPart[] = [];
	const push = (t: string, em = false) => {
		if (t) parts.push(em ? { text: t, em } : { text: t });
	};
	// Authors (Year). — no authors: the title moves into the author slot.
	if (authors) push(`${period(authors)} (${year}). `);

	const arxiv = arxivId(f);
	const type = entry.type;
	const bracket =
		type === 'dataset' || type === 'data'
			? 'Data set'
			: type === 'software'
				? 'Computer software'
				: type === 'mastersthesis' || type === 'phdthesis'
					? [
							type === 'phdthesis' ? 'Doctoral dissertation' : "Master's thesis",
							text('school') || text('institution')
						]
							.filter(Boolean)
							.join(', ')
					: '';

	if (arxiv && type !== 'inproceedings') {
		push(title, true);
		push(` (arXiv:${arxiv}). arXiv.`);
		const doi = f.doi ? url : `https://doi.org/10.48550/arXiv.${arxiv.replace(/v\d+$/, '')}`;
		if (!authors) push(` (${year}).`);
		push(` ${doi}`);
		return parts;
	}

	if (type === 'article') {
		push(period(title));
		if (!authors) push(` (${year}).`);
		const journal = text('journal');
		if (journal) {
			push(' ');
			push(journal, true);
			const volume = text('volume');
			if (volume) {
				push(', ');
				push(volume, true);
			}
			const number = text('number');
			if (number) push(`(${number})`);
			push(pages ? `, ${pages}.` : /[.?!]$/.test(refText(parts)) ? '' : '.');
		}
	} else if (type === 'inproceedings' || type === 'incollection' || type === 'conference') {
		push(period(title));
		if (!authors) push(` (${year}).`);
		const book = text('booktitle');
		if (book) {
			push(' In ');
			push(book, true);
			push(pages ? ` (pp. ${pages}).` : /[.?!]$/.test(book) ? '' : '.');
		}
		const publisher = text('publisher') || text('organization');
		if (publisher) push(` ${period(publisher)}`);
	} else {
		push(title, true);
		push(bracket ? ` [${bracket}].` : /[.?!]$/.test(title) ? '' : '.');
		if (!authors) push(` (${year}).`);
		// `howpublished = {\url{…}}` is a link, already covered by `url`.
		const howpublished = /\\url|https?:/i.test(f.howpublished ?? '') ? '' : text('howpublished');
		const publisher =
			text('publisher') || text('institution') || text('organization') || howpublished;
		if (publisher && !bracket.includes(publisher)) push(` ${period(publisher)}`);
	}
	if (url) push(` ${url}`);
	return parts;
}

/** One formatted reference, keyed by its BibTeX key. */
export interface ApaRef {
	key: string;
	parts: RefPart[];
}

/** Every entry in a BibTeX string as APA references; a repeated key is kept once. */
export function bibtexToApa(src: string): ApaRef[] {
	const seen = new Set<string>();
	return parseBibtex(src)
		.filter((e) => !seen.has(e.key) && seen.add(e.key))
		.map((e) => ({ key: e.key, parts: toApa(e) }));
}

/** Plain-text form of one reference (italics dropped). */
export function refText(parts: readonly RefPart[]): string {
	return parts.map((p) => p.text).join('');
}
