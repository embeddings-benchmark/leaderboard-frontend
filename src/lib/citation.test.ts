import { describe, expect, it } from 'vitest';
import { apaAuthors, apaName, bibtexToApa, latexToText, parseBibtex, refText } from './citation';

const apa = (src: string) => bibtexToApa(src).map((r) => refText(r.parts));

describe('parseBibtex', () => {
	it('reads braced, quoted, bare and concatenated values', () => {
		const [e] = parseBibtex(`@InProceedings{key1,
  title = {A {Nested} Title},
  journal = "Quoted",
  year = 2020,
  month = may # { 31},
}`);
		expect(e).toEqual({
			type: 'inproceedings',
			key: 'key1',
			fields: { title: 'A {Nested} Title', journal: 'Quoted', year: '2020', month: 'May 31' }
		});
	});

	it('splits a string holding several entries', () => {
		const entries = parseBibtex('@misc{a, title={A}}\n\n@article{b, title={B}}');
		expect(entries.map((e) => e.key)).toEqual(['a', 'b']);
	});
});

describe('latexToText', () => {
	it('decodes accents and symbols', () => {
		expect(latexToText("Fr{\\'e}d{\\'e}ric")).toBe('Frédéric');
		expect(latexToText("Ljube{\\v{s}}i{\\'c}")).toBe('Ljubešić');
		expect(latexToText('{\\O}vrelid')).toBe('Øvrelid');
		expect(latexToText('Pere{\\l}kiewicz')).toBe('Perełkiewicz');
		expect(latexToText('T{\\"o}rg')).toBe('Törg');
	});

	it('repairs double-escaped commands', () => {
		expect(latexToText('{\\\\O}vrelid')).toBe('Øvrelid');
	});

	it('strips braces and formatting commands, keeps escaped symbols', () => {
		expect(latexToText('{ESC}: \\emph{Dataset} for R\\&D, 10--20')).toBe(
			'ESC: Dataset for R&D, 10–20'
		);
		expect(latexToText("``quoted''")).toBe('“quoted”');
	});
});

describe('apaName / apaAuthors', () => {
	it('handles "Last, First" and "First von Last"', () => {
		expect(apaName('Enevoldsen, Kenneth')).toBe('Enevoldsen, K.');
		expect(apaName('Jean-Pierre de la Fontaine')).toBe('de la Fontaine, J.-P.');
		expect(apaName('Wang, Hong-you')).toBe('Wang, H.-y.');
		expect(apaName('{Google DeepMind}')).toBe('Google DeepMind');
	});

	it('joins with commas and an ampersand', () => {
		expect(apaAuthors('A, Ann')).toBe('A, A.');
		expect(apaAuthors('A, Ann and B, Bo')).toBe('A, A., & B, B.');
		expect(apaAuthors('A, Ann and B, Bo and C, Cy')).toBe('A, A., B, B., & C, C.');
		expect(apaAuthors('A, Ann and others')).toBe('A, A., et al.');
	});

	it('truncates 21+ authors to the first 19, an ellipsis and the last', () => {
		const names = Array.from({ length: 22 }, (_, i) => `N${i}, X`).join(' and ');
		const out = apaAuthors(names);
		expect(out.startsWith('N0, X., N1, X.')).toBe(true);
		expect(out).toContain('N18, X., … N21, X.');
		expect(out).not.toContain('N19');
	});
});

describe('bibtexToApa', () => {
	it('formats an arXiv preprint', () => {
		expect(
			apa(`@article{enevoldsen2025mmteb,
  author = {Enevoldsen, Kenneth and Chung, Isaac},
  doi = {10.48550/arXiv.2502.13595},
  journal = {arXiv preprint arXiv:2502.13595},
  title = {MMTEB: Massive Multilingual Text Embedding Benchmark},
  year = {2025},
}`)
		).toEqual([
			'Enevoldsen, K., & Chung, I. (2025). MMTEB: Massive Multilingual Text Embedding Benchmark (arXiv:2502.13595). arXiv. https://doi.org/10.48550/arXiv.2502.13595'
		]);
	});

	it('italicises the preprint title', () => {
		const [ref] = bibtexToApa(
			'@misc{x, author={A, B}, title={T}, eprint={2401.00001}, archiveprefix={arXiv}, year={2024}}'
		);
		expect(ref.parts.find((p) => p.text === 'T')?.em).toBe(true);
	});

	it('formats a journal article with volume, issue and pages', () => {
		expect(
			apa(
				'@article{x, author={Doe, Jane}, title={A Study}, journal={J. Things}, volume={4}, number={2}, pages={10--20}, year={2020}, doi={https://doi.org/10.1/abc}}'
			)
		).toEqual(['Doe, J. (2020). A Study. J. Things, 4(2), 10–20. https://doi.org/10.1/abc']);
	});

	it('formats a conference paper', () => {
		expect(
			apa(
				'@inproceedings{x, author={Doe, Jane}, title={A Paper}, booktitle={Proceedings of Things}, pages={1--9}, publisher={ACL}, year={2021}, url={https://aclanthology.org/x}}'
			)
		).toEqual([
			'Doe, J. (2021). A Paper. In Proceedings of Things (pp. 1–9). ACL. https://aclanthology.org/x'
		]);
	});

	it('labels datasets and theses', () => {
		expect(
			apa('@dataset{x, author={Doe, Jane}, title={Data}, publisher={Zenodo}, year={2021}}')
		).toEqual(['Doe, J. (2021). Data [Data set]. Zenodo.']);
		expect(
			apa('@mastersthesis{x, author={Doe, Jane}, title={Thesis}, school={AU}, year={2021}}')
		).toEqual(["Doe, J. (2021). Thesis [Master's thesis, AU]."]);
	});

	it('falls back to biblatex dates and n.d.', () => {
		expect(apa('@misc{x, author={Doe, J.}, title={T}, date={2015-10-13}}')).toEqual([
			'Doe, J. (2015). T.'
		]);
		expect(apa('@misc{x, author={Doe, J.}, title={T}}')).toEqual(['Doe, J. (n.d.). T.']);
	});

	// From the PR #46 review.
	it('keeps URLs and DOIs literal: no `~` → space, no `--` → en dash', () => {
		expect(
			apa(
				'@inproceedings{x, author={Doe, J.}, title={T}, booktitle={B}, year={2016}, url={http://host.de/~riezler/a--b\\_c.pdf}}'
			)
		).toEqual(['Doe, J. (2016). T. In B. http://host.de/~riezler/a--b_c.pdf']);
		expect(apa('@misc{x, author={Doe, J.}, title={T}, year={2020}, doi={10.1/a--b}}')).toEqual([
			'Doe, J. (2020). T. https://doi.org/10.1/a--b'
		]);
	});

	it('formats a published article that also lists its arXiv eprint as the article', () => {
		expect(
			apa(
				'@article{x, author={Doe, J.}, title={T}, journal={TACL}, volume={9}, pages={1--5}, eprint={2101.00001}, archiveprefix={arXiv}, year={2021}}'
			)
		).toEqual(['Doe, J. (2021). T. TACL, 9, 1–5.']);
	});

	it('does not add a period after a title ending in ? or !', () => {
		expect(apa('@misc{x, author={Doe, J.}, title={Why Embed?}, year={2020}}')).toEqual([
			'Doe, J. (2020). Why Embed?'
		]);
	});

	it('keys each reference by its BibTeX key, once per key', () => {
		const refs = bibtexToApa('@misc{a, title={A}}\n@misc{b, title={B}}\n@misc{a, title={A}}');
		expect(refs.map((r) => r.key)).toEqual(['a', 'b']);
		expect(bibtexToApa('not bibtex')).toEqual([]);
	});
});
