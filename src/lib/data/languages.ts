// Map iso639-3 + script codes (eng-Latn, zho-Hans, …) to a human-friendly name.
// Covers every code emitted by the mock benchmark data. Falls back to the
// raw code so unknown values still render rather than disappear.

const LANGUAGE_NAMES: Record<string, string> = {
	'eng-Latn': 'English',
	'fra-Latn': 'French',
	'deu-Latn': 'German',
	'spa-Latn': 'Spanish',
	'por-Latn': 'Portuguese',
	'ita-Latn': 'Italian',
	'nld-Latn': 'Dutch',
	'pol-Latn': 'Polish',
	'rus-Cyrl': 'Russian',
	'ukr-Cyrl': 'Ukrainian',
	'ces-Latn': 'Czech',
	'swe-Latn': 'Swedish',
	'nor-Latn': 'Norwegian',
	'dan-Latn': 'Danish',
	'fin-Latn': 'Finnish',
	'tur-Latn': 'Turkish',
	'zho-Hans': 'Chinese (Simplified)',
	'zho-Hant': 'Chinese (Traditional)',
	'jpn-Jpan': 'Japanese',
	'kor-Kore': 'Korean',
	'tha-Thai': 'Thai',
	'vie-Latn': 'Vietnamese',
	'ind-Latn': 'Indonesian',
	'msa-Latn': 'Malay',
	'tgl-Latn': 'Tagalog',
	'hin-Deva': 'Hindi',
	'ben-Beng': 'Bengali',
	'urd-Arab': 'Urdu',
	'fas-Arab': 'Persian',
	'ara-Arab': 'Arabic',
	'heb-Hebr': 'Hebrew',
	'ell-Grek': 'Greek',
	'swa-Latn': 'Swahili',
	'yor-Latn': 'Yoruba',
	'hau-Latn': 'Hausa',
	'amh-Ethi': 'Amharic'
};

export function languageLabel(code: string): string {
	return LANGUAGE_NAMES[code] ?? code;
}
