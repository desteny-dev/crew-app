// Thema (hell / dunkel / System) — Fable, 04.09.2026.
//
// Die Farben selbst leben als Tokens in styles.css (:root und :root[data-theme="dark"]).
// Hier wird nur entschieden, welcher Satz gilt: die Einstellung „system" folgt dem
// Betriebssystem (und reagiert live auf Wechsel), „hell"/„dunkel" sind fest.
// Zusätzlich wird die Browser-Chrome-Farbe (theme-color) auf das Papier gesetzt.

const MEDIA = typeof window !== 'undefined' && window.matchMedia ? window.matchMedia('(prefers-color-scheme: dark)') : null;
const PAPER = { light: '#f6f3ee', dark: '#1a1816' };

let aktuelleEinstellung = 'hell';
let mediaGebunden = false;

export function resolveTheme(theme = aktuelleEinstellung) {
  if (theme === 'dunkel') return 'dark';
  if (theme === 'system') return MEDIA && MEDIA.matches ? 'dark' : 'light';
  return 'light';
}

function anwenden() {
  const resolved = resolveTheme();
  const root = document.documentElement;
  if (root.dataset.theme !== resolved) root.dataset.theme = resolved;
  const meta = document.querySelector('meta[name="theme-color"]');
  if (meta && meta.getAttribute('content') !== PAPER[resolved]) meta.setAttribute('content', PAPER[resolved]);
  return resolved;
}

export function applyTheme(theme) {
  aktuelleEinstellung = theme === 'dunkel' || theme === 'system' ? theme : 'hell';
  if (MEDIA && !mediaGebunden) {
    mediaGebunden = true;
    const onChange = () => { if (aktuelleEinstellung === 'system') anwenden(); };
    if (MEDIA.addEventListener) MEDIA.addEventListener('change', onChange);
    else if (MEDIA.addListener) MEDIA.addListener(onChange);
  }
  return anwenden();
}
