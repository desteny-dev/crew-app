// Runde 6 (P5, B3) — Ladebausteine: Platzhalter, die aussehen wie der spätere Inhalt.
//
// Jonathan: „man sollte eine ladeanimation haben, wenn etwas ladet egal ob bei app start oder
// karte oder sonst wo, man soll nicht sehen wie sich, auch wenn nur kurz, laggy die seite
// zusammensetzt … dort soll man auch darauf achten das es immer in der richtigen farbe ladet."
//
// Deshalb gibt es hier KEINEN Kreisel. Ein Kreisel sagt „warte", ein Platzhalter sagt „hier
// kommt eine Liste" — und wenn der Platzhalter dieselbe Form hat wie der Inhalt, springt beim
// Eintreffen nichts mehr. Alle Bausteine sind reine HTML-Zeichenketten ohne Bindung: man setzt
// sie dorthin, wo sonst der Inhalt stünde.
//
//   ladeZeile({ breite, hoehe })        eine Textzeile
//   ladeKreis(groesse)                  ein Profilbild
//   ladeRechteck({ breite, hoehe })     eine Fläche (Kachel, Bild, Knopf)
//   ladeKarte({ zeilen, bild })         eine Karte wie Meet-/Gruppenkarte
//   ladePersonZeile()                   eine Zeile wie personRow (Kreis + zwei Zeilen)
//   ladeListe({ anzahl, art })          ein Listenblock aus mehreren davon
//   ladeKartenflaeche({ hoehe })        die Fläche einer Landkarte
//   ladeEbene(inhalt, { grund })        legt Platzhalter ÜBER einen Bereich, der noch lädt
//   ladeAusblenden(knoten)              lässt eine solche Ebene weich verschwinden
//
//   appStartZeigen() / appStartBeenden()   der „App startet"-Zustand für die erste Sekunde
//
// Farben: ausschließlich Tokens (--p5-lade-grund, --p5-lade-glanz in web/styles.css, hell und
// dunkel getrennt). Das Schimmern ist ruhig (1,6 s) und hält sich an „Bewegung reduzieren".

import { esc } from '../core/html.js';
import { t as tx } from '../core/sprache.js';

const FONT = "'Instrument Sans',sans-serif";
// Welches Thema zuletzt galt. Beim nächsten Start steht die richtige Farbe damit schon fest,
// BEVOR das Repository geladen ist — sonst blitzt ein heller Start vor einer dunklen App auf.
const THEMA_MERKER = 'crew.lade.thema';
const START_NOTBREMSE_MS = 9000;
const START_MIN_MS = 260;

function merken(schluessel, wert) {
  try { globalThis.localStorage?.setItem(schluessel, wert); } catch { /* privates Fenster */ }
}

function gemerkt(schluessel) {
  try { return globalThis.localStorage?.getItem(schluessel) || ''; } catch { return ''; }
}

function masse(wert, standard) {
  if (wert === undefined || wert === null) return standard;
  return typeof wert === 'number' ? `${wert}px` : String(wert);
}

// Ein einzelnes schimmerndes Stück. `verzug` staffelt mehrere Stücke zu einer ruhigen Welle.
function stueck(stil, verzug = 0) {
  const takt = verzug ? `animation-delay:${verzug}ms;` : '';
  return `<span class="p5-lade" aria-hidden="true" style="display:block;${takt}${stil}"></span>`;
}

// --- Einzelne Formen -------------------------------------------------------------------------

export function ladeZeile(optionen = {}) {
  const { breite = '100%', hoehe = 12, rund = 6, oben = 0, verzug = 0 } = optionen;
  return stueck(`width:${masse(breite, '100%')};height:${masse(hoehe, '12px')};border-radius:${masse(rund, '6px')};${oben ? `margin-top:${masse(oben, '0')};` : ''}`, verzug);
}

export function ladeKreis(groesse = 42, optionen = {}) {
  const { verzug = 0 } = optionen;
  return stueck(`width:${masse(groesse, '42px')};height:${masse(groesse, '42px')};border-radius:50%;flex:none;`, verzug);
}

export function ladeRechteck(optionen = {}) {
  const { breite = '100%', hoehe = 44, rund = 14, verzug = 0 } = optionen;
  return stueck(`width:${masse(breite, '100%')};height:${masse(hoehe, '44px')};border-radius:${masse(rund, '14px')};flex:none;`, verzug);
}

// Eine Karte, wie sie danach dasteht: echter Rahmen, echte Rundung, echter Innenabstand —
// nur der Inhalt ist noch ein Platzhalter. Dadurch ändert sich beim Eintreffen kein Maß.
export function ladeKarte(optionen = {}) {
  const { hoehe = null, bild = true, zeilen = 2, rund = 20, verzug = 0, breite = '100%' } = optionen;
  const texte = Array.from({ length: Math.max(1, zeilen) }, (unbenutzt, i) => ladeZeile({
    breite: i === 0 ? '62%' : `${Math.max(34, 86 - i * 22)}%`,
    hoehe: i === 0 ? 13 : 10,
    oben: i === 0 ? 0 : 7,
    verzug: verzug + i * 90,
  })).join('');
  return `<div data-role="lade-karte" style="display:flex;align-items:center;gap:11px;padding:13px;border:1px solid var(--line);border-radius:${masse(rund, '20px')};background:var(--surface);box-shadow:0 1px 2px var(--shadow-04);width:${masse(breite, '100%')};${hoehe ? `height:${masse(hoehe, 'auto')};box-sizing:border-box;` : ''}flex:none">
${bild ? ladeRechteck({ breite: 42, hoehe: 42, rund: 13, verzug }) : ''}
<span style="display:block;flex:1;min-width:0">${texte}</span>
</div>`;
}

// Eine Personenzeile (ui/components.js personRow): Profilbild, Name, Zustand.
export function ladePersonZeile(optionen = {}) {
  const { verzug = 0 } = optionen;
  return `<div data-role="lade-person" style="display:flex;align-items:center;gap:12px;padding:9px 0;flex:none">
${ladeKreis(42, { verzug })}
<span style="display:block;flex:1;min-width:0">${ladeZeile({ breite: '46%', hoehe: 13, verzug: verzug + 80 })}${ladeZeile({ breite: '30%', hoehe: 10, oben: 6, verzug: verzug + 160 })}</span>
</div>`;
}

// Ein ganzer Listenblock. art: 'person' | 'karte' | 'zeile'.
export function ladeListe(optionen = {}) {
  const { anzahl = 4, art = 'person', abstand = art === 'karte' ? 10 : 0 } = optionen;
  const teile = Array.from({ length: Math.max(1, anzahl) }, (unbenutzt, i) => {
    const verzug = i * 120;
    if (art === 'karte') return ladeKarte({ verzug });
    if (art === 'zeile') return ladeZeile({ breite: `${92 - i * 9}%`, hoehe: 13, verzug });
    return ladePersonZeile({ verzug });
  });
  return `<div data-role="laden" data-lade-art="${esc(art)}" role="status" aria-label="${esc(tx('Lädt …'))}" style="display:flex;flex-direction:column;gap:${masse(abstand, '0')}">${teile.join('')}</div>`;
}

// Die Fläche einer Landkarte: dieselbe Tönung wie die echte Karte, darüber ein ruhiger Schimmer
// und zwei angedeutete Punkte. So bleibt der Bildausschnitt von Anfang an derselbe.
export function ladeKartenflaeche(optionen = {}) {
  const { hoehe = '100%', breite = '100%', rund = 0, punkte = true } = optionen;
  const punkt = (links, oben, groesse, verzug) => `<span class="p5-lade" aria-hidden="true" style="position:absolute;left:${links};top:${oben};width:${groesse}px;height:${groesse}px;border-radius:50%;animation-delay:${verzug}ms"></span>`;
  return `<div data-role="laden" data-lade-art="karte-flaeche" role="status" aria-label="${esc(tx('Karte lädt …'))}" style="position:relative;width:${masse(breite, '100%')};height:${masse(hoehe, '100%')};border-radius:${masse(rund, '0')};overflow:hidden;background:var(--map-tint)">
<span class="p5-lade p5-lade-weich" aria-hidden="true" style="position:absolute;inset:0;border-radius:inherit"></span>
${punkte ? `${punkt('28%', '38%', 26, 0)}${punkt('62%', '26%', 20, 220)}${punkt('52%', '64%', 18, 420)}` : ''}
</div>`;
}

// Legt Platzhalter ÜBER einen Bereich, der gerade lädt (Karte, Liste, Bild). Der Träger braucht
// position:relative. Beim Eintreffen des Inhalts: ladeAusblenden(knoten) — dann wechselt nichts hart.
export function ladeEbene(inhalt, optionen = {}) {
  const { grund = 'var(--paper)', rund = 0, z = 3, abstand = '0' } = optionen;
  return `<div data-role="lade-ebene" role="status" aria-label="${esc(tx('Lädt …'))}" style="position:absolute;inset:0;z-index:${z};border-radius:${masse(rund, '0')};background:${grund};padding:${abstand};box-sizing:border-box;overflow:hidden">${inhalt}</div>`;
}

export function ladeAusblenden(knoten) {
  if (!knoten) return;
  if (typeof knoten.animate !== 'function') { knoten.remove(); return; }
  const lauf = knoten.animate([{ opacity: 1 }, { opacity: 0 }], { duration: 180, easing: 'ease-in', fill: 'forwards' });
  lauf.finished.then(() => knoten.remove(), () => knoten.remove());
}

// --- „App startet" ---------------------------------------------------------------------------
//
// Die erste Sekunde gehört nicht dem Zusammenbau der Seite. Bis das Repository steht, liegt eine
// ruhige Fläche darüber, die GENAU so aussieht wie der Rahmen danach: dieselbe Papierfarbe,
// dieselbe Rundung, dieselbe Breite. Danach blendet sie in 220 ms aus.
//
// Beim App-Start liegt diese Fläche seit Runde 6 statisch in index.html (#start-huelle, Klassen
// .p5-start aus styles.css — Chef), damit sie schon im ERSTEN Bild steht. appStartZeigen()
// übernimmt eine vorhandene Fläche, statt eine zweite darüberzulegen; es legt nur dann selbst
// eine an, wenn keine da ist (z. B. Neustart nach einem Sprachwechsel).
//
// Die Farbe steht schon vor dem ersten Render fest: Beim Beenden wird das dann gültige Thema
// gemerkt (crew.lade.thema — denselben Schlüssel liest das Inline-Skript in index.html); beim
// nächsten Start gilt es sofort. Beim allerersten Start entscheidet das Gerät
// (prefers-color-scheme) — nie Weiß vor einer dunklen App.

let startKnoten = null;
let startAb = 0;
let startUhr = null;

function themaVorabSetzen() {
  const wurzel = globalThis.document?.documentElement;
  if (!wurzel || wurzel.dataset.theme) return;
  const gemerktes = gemerkt(THEMA_MERKER);
  if (gemerktes === 'dark' || gemerktes === 'light') { wurzel.dataset.theme = gemerktes; return; }
  let dunkel = false;
  try { dunkel = Boolean(globalThis.matchMedia?.('(prefers-color-scheme: dark)').matches); } catch { dunkel = false; }
  wurzel.dataset.theme = dunkel ? 'dark' : 'light';
}

/** Merkt das Thema, das JETZT gilt — damit der nächste Start sofort richtig färbt. */
export function ladeThemaMerken() {
  const wurzel = globalThis.document?.documentElement;
  if (!wurzel?.dataset.theme) return;
  merken(THEMA_MERKER, wurzel.dataset.theme);
}

export function appStartZeigen(optionen = {}) {
  const dok = globalThis.document;
  if (!dok?.body) return null;
  if (startKnoten?.isConnected) return startKnoten;
  themaVorabSetzen();
  // Runde 6 (Abstimmung mit Chef): Die Start-Fläche steht schon STATISCH in index.html, damit sie
  // im ersten Bild liegt — vor jedem Modul. Gibt es sie, wird sie übernommen statt eine zweite
  // darüberzulegen; appStartBeenden() bleibt die eine Stelle zum Beenden.
  const vorhanden = dok.querySelector('#start-huelle, [data-role="app-start"]');
  if (vorhanden) {
    startKnoten = vorhanden;
    startAb = Date.now();
    clearTimeout(startUhr);
    startUhr = setTimeout(() => appStartBeenden({ sofort: true }), START_NOTBREMSE_MS);
    return vorhanden;
  }
  const knoten = dok.createElement('div');
  knoten.className = 'p5-start';
  knoten.setAttribute('data-role', 'app-start');
  knoten.setAttribute('role', 'status');
  knoten.setAttribute('aria-label', esc(optionen.text || tx('Crew startet …')));
  // Runde 6 (Jonathan): Das Ladezeichen ist NUR die Crew-Marke — Ring und Punkt. Genau dieselbe
  // Fläche steht auch statisch in web/index.html; ändert sich eine, gehört die andere mit.
  knoten.innerHTML = `<div class="p5-start-flaeche">
<div class="p5-start-mitte">
<svg class="crew-lademarke" width="74" height="74" viewBox="2 2 68 68" aria-hidden="true"><mask id="crew-lade-luecke" maskUnits="userSpaceOnUse" x="0" y="0" width="72" height="72"><rect x="0" y="0" width="72" height="72" fill="#fff"></rect><circle cx="53.5" cy="52" r="11.5" fill="#000"></circle></mask><circle cx="36" cy="36" r="24" fill="none" stroke="currentColor" stroke-width="7" mask="url(#crew-lade-luecke)"></circle><circle cx="53.5" cy="52" r="9.5" fill="var(--green)"></circle></svg>
</div></div>`;
  dok.body.appendChild(knoten);
  startKnoten = knoten;
  startAb = Date.now();
  // Ginge beim Start etwas schief, darf die Fläche nicht für immer stehen bleiben.
  clearTimeout(startUhr);
  startUhr = setTimeout(() => appStartBeenden({ sofort: true }), START_NOTBREMSE_MS);
  return knoten;
}

export function appStartBeenden(optionen = {}) {
  const { sofort = false } = optionen;
  clearTimeout(startUhr);
  startUhr = null;
  ladeThemaMerken();
  const knoten = startKnoten;
  if (!knoten) return Promise.resolve(false);
  startKnoten = null;
  const weg = () => { knoten.remove(); };
  if (sofort || typeof knoten.animate !== 'function') { weg(); return Promise.resolve(true); }
  // Sehr schnelle Starts sollen nicht flackern: die Fläche bleibt mindestens kurz stehen.
  const rest = Math.max(0, START_MIN_MS - (Date.now() - startAb));
  return new Promise((fertig) => {
    setTimeout(() => {
      const lauf = knoten.animate([{ opacity: 1 }, { opacity: 0 }], { duration: 220, easing: 'ease-in', fill: 'forwards' });
      lauf.finished.then(() => { weg(); fertig(true); }, () => { weg(); fertig(true); });
    }, rest);
  });
}

/** Läuft der Startzustand gerade? (Prüfläufe, und für Bausteine, die darauf warten.) */
export function appStartLaeuft() {
  return Boolean(startKnoten?.isConnected);
}

// Kurzer Text für „hier kommt gleich etwas" ohne eigene Form (z. B. in einer leeren Karte).
export function ladeText(text) {
  return `<span data-role="lade-text" role="status" style="font:600 12.5px/1.4 ${FONT};color:var(--muted)">${esc(text || tx('Lädt …'))}</span>`;
}
