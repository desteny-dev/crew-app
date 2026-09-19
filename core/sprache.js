// Sprachen — Runde 2 (Jonathan: „Mache englisch französisch und spanisch mit guten
// übersetzern, wir haben eh wenig text. frei wird zu free und im satz ist es übersetzt").
//
// Der Quelltext bleibt deutsch, und der deutsche Satz IST der Schlüssel:
//
//   t('Einstellungen')                       → „Settings"
//   t('Frei ab {zeit}', { zeit: '19:00' })   → „Free from 19:00"
//   tn(anzahl, '{n} Freund', '{n} Freunde')  → „1 friend" / „3 friends"
//
// Fehlt eine Übersetzung, erscheint der deutsche Satz — nie ein leeres Feld und nie ein
// Schlüsselname. scripts/sprachen-pruefen.mjs findet jede Lücke und jeden Platzhalter, der in
// einer Übersetzung fehlt oder falsch geschrieben ist.
//
// Das Wort im Frei-Knopf und auf Frei-Abzeichen ist in JEDER Sprache „FREE" und läuft nicht
// über t(). Im Satz wird es übersetzt („Du bist frei" → „You're free").
//
// Die Sprache steht fest, BEVOR ein Modul seine Texte baut: Sie kommt synchron aus dem Gerät
// (gemerkte Wahl, sonst die Gerätesprache). Ein Wechsel lädt die App neu — so gibt es keinen
// halb übersetzten Bildschirm und keine Konstante, die noch die alte Sprache trägt.

import en from '../sprachen/en.js';
import fr from '../sprachen/fr.js';
import es from '../sprachen/es.js';

// Jede Sprache heißt in ihrer eigenen Sprache — wer versehentlich auf Spanisch gestellt hat,
// muss „Deutsch" wiederfinden können, ohne Spanisch zu lesen.
export const SPRACHEN = [
  { code: 'de', name: 'Deutsch', gebiet: 'de-DE' },
  { code: 'en', name: 'English', gebiet: 'en-GB' },
  { code: 'fr', name: 'Français', gebiet: 'fr-FR' },
  { code: 'es', name: 'Español', gebiet: 'es-ES' },
];
const CODES = SPRACHEN.map((s) => s.code);
const WOERTER = { en, fr, es };
const MERKER = 'crew.sprache';

function gemerkteWahl() {
  try {
    const wert = globalThis.localStorage?.getItem(MERKER) || '';
    return CODES.includes(wert) ? wert : 'auto';
  } catch {
    return 'auto';
  }
}

// Die Gerätesprache: die erste der bevorzugten Sprachen, die Crew kann. Wer Italienisch
// eingestellt hat, bekommt Englisch — das verstehen mehr Menschen als Deutsch.
// Prüfläufe setzen sie fest (scripts/serve.mjs → CREW_CONFIG.sprache), sonst hinge jedes
// Ergebnis an der Sprache des Browsers, der gerade prüft.
export function geraeteSprache() {
  const fest = globalThis.CREW_CONFIG?.sprache;
  if (CODES.includes(fest)) return fest;
  // Ohne Browser (Node-Skripte, die Module der App laden) bleibt es Deutsch — Node ab 21 kennt
  // zwar navigator.language, aber ein Prüfskript soll nicht an der Sprache des PCs hängen.
  if (!globalThis.document) return 'de';
  const nav = globalThis.navigator;
  const liste = nav?.languages?.length ? nav.languages : [nav?.language || 'de'];
  for (const eintrag of liste) {
    const kurz = String(eintrag || '').slice(0, 2).toLowerCase();
    if (CODES.includes(kurz)) return kurz;
  }
  return 'en';
}

// ?sprache=en zeigt die App einmal in einer Sprache, ohne die Wahl zu ändern (für Prüfbilder).
function adressSprache() {
  try {
    const wert = new URLSearchParams(globalThis.location?.search || '').get('sprache');
    return CODES.includes(wert) ? wert : '';
  } catch {
    return '';
  }
}

let wahl = gemerkteWahl();
let aktiv = adressSprache() || (wahl === 'auto' ? geraeteSprache() : wahl);
if (globalThis.document?.documentElement) globalThis.document.documentElement.lang = aktiv;

/** Die Sprache, in der die App gerade spricht: 'de' | 'en' | 'fr' | 'es'. */
export function sprache() {
  return aktiv;
}

/** Was eingestellt ist: 'auto' (wie das Gerät) oder ein Sprachcode. */
export function sprachWahl() {
  return wahl;
}

/** Gebietsschema für Intl (Zahlen, Sortierung). */
export function gebiet() {
  return (SPRACHEN.find((s) => s.code === aktiv) || SPRACHEN[0]).gebiet;
}

/**
 * Merkt die Wahl im Gerät. Gibt zurück, ob die App dafür neu laden muss: nur wenn sich die
 * gesprochene Sprache ändert UND die Wahl wirklich gemerkt ist. Ohne Speicher (manches private
 * Fenster) käme nach dem Neuladen wieder die alte Sprache — und der Abgleich beim Start ließe
 * die App endlos neu laden.
 */
export function merkeSprachWahl(code) {
  const neu = CODES.includes(code) ? code : 'auto';
  try {
    if (neu === 'auto') globalThis.localStorage?.removeItem(MERKER);
    else globalThis.localStorage?.setItem(MERKER, neu);
  } catch { /* privates Fenster: gilt dann nur bis zum Neuladen */ }
  wahl = neu;
  const kuenftig = adressSprache() || (neu === 'auto' ? geraeteSprache() : neu);
  return kuenftig !== aktiv && gemerkteWahl() === neu;
}

function einsetzen(text, werte) {
  return text.replace(/\{(\w+)\}/g, (ganz, name) => (Object.prototype.hasOwnProperty.call(werte, name) ? String(werte[name]) : ganz));
}

/** Übersetzt einen deutschen Satz. Platzhalter in geschweiften Klammern: {name}. */
export function t(text, werte) {
  const ziel = aktiv === 'de' ? text : (WOERTER[aktiv]?.[text] ?? text);
  return werte ? einsetzen(ziel, werte) : ziel;
}

/**
 * Derselbe deutsche Satz mit verschiedener Bedeutung: tk('Abgesagt', 'Person') für jemanden,
 * der abgesagt hat, t('Abgesagt') für ein abgesagtes Meet. Deutsch zeigt beides gleich; die
 * Wörterbücher führen den Schlüssel „Abgesagt [Person]" — so kann Englisch „Declined" sagen
 * und „Cancelled". Fehlt die Übersetzung mit Kontext, gilt die ohne.
 */
export function tk(text, kontext, werte) {
  const ziel = aktiv === 'de' ? text : (WOERTER[aktiv]?.[`${text} [${kontext}]`] ?? WOERTER[aktiv]?.[text] ?? text);
  return werte ? einsetzen(ziel, werte) : ziel;
}

/**
 * Ein Wort, das die App vorgibt, das aber als DATUM gespeichert und verglichen wird (Interessen
 * aus dem Katalog, Namen von Ressourcen): Im Quelltext steht `schluessel('Bouldern')` — das
 * liefert unverändert den deutschen Namen, und scripts/sprachen-pruefen.mjs nimmt ihn als
 * Schlüssel auf. Gespeichert wird immer der deutsche Name; übersetzt wird erst bei der Anzeige.
 */
export function schluessel(text) {
  return text;
}

/**
 * Anzeige eines gespeicherten Wortes (siehe schluessel): die Übersetzung, wenn es eine gibt,
 * sonst das Wort, wie es ist — ein selbst getipptes Interesse („Pilates") bleibt stehen.
 * Nur für Interessen und Ressourcen benutzen, nie für frei benannte Orte oder Titel: ein Ort,
 * der zufällig „Bar" heißt, soll nicht übersetzt werden.
 */
export function wort(text) {
  if (aktiv === 'de' || typeof text !== 'string') return text;
  return WOERTER[aktiv]?.[text] ?? text;
}

/**
 * Einzahl oder Mehrzahl. {n} steht für die Anzahl. Im Französischen gilt 0 wie 1
 * („0 message"), sonst ist nur 1 Einzahl.
 */
export function tn(anzahl, eins, mehr, werte = {}) {
  const betrag = Math.abs(Number(anzahl) || 0);
  const einzahl = aktiv === 'fr' ? betrag < 2 : betrag === 1;
  return t(einzahl ? eins : mehr, { n: anzahl, ...werte });
}

/** Zahl im Format der Sprache: 6,7 (de, fr, es) bzw. 6.7 (en). */
export function zahl(wert, stellen = 1) {
  return new Intl.NumberFormat(gebiet(), { maximumFractionDigits: stellen }).format(Number(wert) || 0);
}
