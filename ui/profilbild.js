// Profilbild-Baukasten, Runde 3 — Hintergrund und Motiv getrennt.
//
// Jonathan: „Statt einem Haufen fertiger Bilder, die auch die Farbe vorgeben: Man klickt auf
// Hintergrund und bekommt die Farbauswahl; man klickt auf Motiv und wählt zuerst eine
// Kategorie, dann das Motiv." Und: „Ganz am Anfang ist das Standardprofilbild irgendeine Farbe."
//
// Gespeichert wird weiterhin KEIN Bild, sondern ein kurzes Wort mit dem Präfix `motiv:` — nur
// daran erkennt web/ui/components.js (bildVon) ein gestaltetes Profilbild und holt sich hier
// die Bildadresse. Zwei Schreibweisen gelten:
//
//   alt (Runde 2):  motiv:fuchs:tanne                       Motiv + Grundfarbe
//   neu (Runde 3):  motiv:m=fuchs;a=froh;g=see;v=nacht;r=ru;p=wellen
//                   m Motiv · a Ausdruck · g Farbe · v zweite Farbe (Farbverlauf)
//                   r Richtung · p Muster · i Initialen (nur ohne Motiv)
//   Runde 5 (B1):   motiv:e=1f60e;g=see
//                   e Emoji als Codepunkte in Hex (web/ui/profilbild-emoji.js) — statt eines
//                   Motivs, nie beides. Ältere App-Stände kennen `e` nicht und zeigen dann den
//                   Hintergrund ohne Emoji; kein altes Wort enthält `e=`, nichts kollidiert.
//   Runde 8 (R8-13): motiv:g=see;k=JO
//                   k SELBST getippte Initialen (Baukasten → Motiv → Initialen). Anders als `i`
//                   ziehen sie NICHT mit dem Namen mit — wer sie selbst setzt, will genau diese.
//                   Nur ohne Motiv und Emoji. Auch auf schlichter Farbe wird dann ein Wort
//                   gespeichert (sonst gäbe es keinen Ort für sie).
//
// Eine schlichte Farbe ohne Motiv, Verlauf und Muster wird gar nicht als Wort gespeichert:
// Dann ist `photo` leer und `color` trägt die Farbe — genau die Scheibe mit Initialen, die die
// App für jeden Menschen ohne Bild zeichnet (Standard, A3).
//
// Initialen im Wort: Ein Verlauf oder Muster OHNE Motiv braucht die Buchstaben im Bild selbst.
// Sie werden beim Speichern des Namens nachgeführt (mitInitialen) und in einer Systemschrift
// gezeichnet — ein Bild in <img> darf die Schriften der Seite nicht laden.

import { t } from '../core/sprache.js';
import { TIERE, VERSTECKT } from './profilbild-tiere.js';
import { FLAGGEN } from './profilbild-flaggen.js';
import { AUTOS, SCHIFFE, FLUGZEUGE } from './profilbild-fahrzeuge.js';
import { WELTALL } from './profilbild-weltall.js';
import { FIGUREN } from './profilbild-figuren.js';
import { emojiZeichen, gueltigesEmoji } from './profilbild-emoji.js';

// Die ersten acht Schlüssel und Werte sind die aus Runde 2 — alte Wörter behalten ihre Farbe.
// Die zweite Reihe sind die ruhigen Personenfarben, die die App schon immer für Menschen ohne
// Bild benutzt hat. Auf allen steht weiße Schrift.
export const PB_FARBEN = [
  { key: 'mohn', name: t('Mohn'), wert: '#D2493F' },
  { key: 'kuerbis', name: t('Kürbis'), wert: '#E0892F' },
  { key: 'ocker', name: t('Ocker'), wert: '#C9A33C' },
  { key: 'tanne', name: t('Tanne'), wert: '#2F6B4F' },
  { key: 'petrol', name: t('Petrol'), wert: '#22747A' },
  { key: 'see', name: t('See'), wert: '#3877A6' },
  { key: 'lavendel', name: t('Lavendel'), wert: '#7C6BB8' },
  { key: 'beere', name: t('Beere'), wert: '#9C3D63' },
  { key: 'karamell', name: t('Karamell'), wert: '#C98A5B' },
  { key: 'salbei', name: t('Salbei'), wert: '#8FAF8A' },
  { key: 'taube', name: t('Taube'), wert: '#7F9FC9' },
  { key: 'flieder', name: t('Flieder'), wert: '#A08FC9' },
  { key: 'rose', name: t('Rosé'), wert: '#C97F93' },
  { key: 'nuss', name: t('Nuss'), wert: '#B0876B' },
  { key: 'nacht', name: t('Nacht'), wert: '#34405A' },
  { key: 'graphit', name: t('Graphit'), wert: '#3A3734' },
];

export const PB_RICHTUNGEN = [
  { key: 'u', name: t('Nach unten'), attr: 'x1="0" y1="0" x2="0" y2="1"' },
  { key: 'r', name: t('Nach rechts'), attr: 'x1="0" y1="0" x2="1" y2="0"' },
  { key: 'ru', name: t('Schräg nach rechts unten'), attr: 'x1="0" y1="0" x2="1" y2="1"' },
  { key: 'lu', name: t('Schräg nach links unten'), attr: 'x1="1" y1="0" x2="0" y2="1"' },
  { key: 'k', name: t('Von der Mitte aus'), attr: '' },
];

// Muster liegen Ton in Ton auf dem Grund: helle Linien oder dunklere Flächen mit wenig
// Deckkraft. So passen sie zu jeder Farbe und drängen sich nie vor das Motiv.
export const PB_MUSTER = [
  { key: '', name: t('Kein Muster') },
  { key: 'punkte', name: t('Punkte') },
  { key: 'wellen', name: t('Wellen') },
  { key: 'streifen', name: t('Streifen') },
  { key: 'ringe', name: t('Ringe') },
  { key: 'sterne', name: t('Sterne') },
  { key: 'berge', name: t('Berge') },
  { key: 'wald', name: t('Wald') },
];

export const PB_AUSDRUECKE = [
  { key: '', name: t('Neutral') },
  { key: 'froh', name: t('Lächelnd') },
  { key: 'grimmig', name: t('Grimmig') },
];

// Runde 5 (B2): Ohne Mund (Schnabel, nichts Sichtbares) lächelt kein Tier — der frohe Ausdruck
// liegt dort nur in den Augen und heißt deshalb „Fröhlich".
const AUSDRUECKE_OHNE_MUND = [
  { key: '', name: t('Neutral') },
  { key: 'froh', name: t('Fröhlich') },
  { key: 'grimmig', name: t('Grimmig') },
];

// Die Ausdrücke, die zu einem Motiv passen. Ohne Tier (noch nichts gewählt): die mit Mund.
export function ausdrueckeFuer(motivKey) {
  const anatomie = PB_MOTIVE[motivKey]?.anatomie;
  return anatomie === 'schnabel' || anatomie === 'ohne' ? AUSDRUECKE_OHNE_MUND : PB_AUSDRUECKE;
}

export const PB_KATEGORIEN = [
  { key: 'tiere', name: t('Tiere'), motive: TIERE, ausdruck: true },
  // Runde 8 (R8-13): Figuren im selben Stil wie Weltall — Astronaut, Roboter, Ritter, Ninja.
  { key: 'figuren', name: t('Figuren'), motive: FIGUREN },
  { key: 'flaggen', name: t('Flaggen'), motive: FLAGGEN },
  { key: 'autos', name: t('Autos'), motive: AUTOS },
  { key: 'weltall', name: t('Weltall'), motive: WELTALL },
  { key: 'schiffe', name: t('Schiffe'), motive: SCHIFFE },
  { key: 'flugzeuge', name: t('Flugzeuge'), motive: FLUGZEUGE },
];

// Alle Motive in einer Karte: Schlüssel → { name, zeichnung, kategorie, … }.
export const PB_MOTIVE = {};
for (const kat of PB_KATEGORIEN) {
  for (const [key, motiv] of Object.entries(kat.motive)) PB_MOTIVE[key] = { ...motiv, kategorie: kat.key };
}
for (const [key, motiv] of Object.entries(VERSTECKT)) PB_MOTIVE[key] = { ...motiv, kategorie: 'tiere', versteckt: true };
// Runde 2 kannte einen „planet" — heute heißt er Saturn.
const ALTE_NAMEN = { planet: 'saturn' };

const PRAEFIX = 'motiv:';
const AUSDRUCK_KEYS = PB_AUSDRUECKE.map((a) => a.key);
const HEX = /^[0-9a-f]{6}$/i;

export function istMotiv(wert) {
  return typeof wert === 'string' && wert.startsWith(PRAEFIX);
}

export function leererZustand() {
  return { m: '', a: '', e: '', g: PB_FARBEN[0].key, v: '', r: 'u', p: '', i: '', k: '' };
}

function gueltigeFarbe(wert) {
  return PB_FARBEN.some((f) => f.key === wert) || HEX.test(wert || '');
}

// Farbwert eines Schlüssels (oder einer eigenen Farbe `c9ae6b`).
export function farbWert(key) {
  const f = PB_FARBEN.find((e) => e.key === key);
  if (f) return f.wert;
  return HEX.test(key || '') ? `#${key.toUpperCase()}` : PB_FARBEN[0].wert;
}

// Schlüssel zu einer gespeicherten Personenfarbe: Palette, sonst die Farbe selbst (`c9ae6b`).
// `var(--blue)` ist die alte Standardfarbe aus AVATAR_COLORS — sie heißt hier Taube.
export function farbSchluessel(farbe) {
  const wert = String(farbe || '').trim();
  if (/var\(--blue\)/.test(wert)) return 'taube';
  const hex = wert.replace('#', '');
  if (!HEX.test(hex)) return null;
  const f = PB_FARBEN.find((e) => e.wert.slice(1).toLowerCase() === hex.toLowerCase());
  return f ? f.key : hex.toLowerCase();
}

// Liest ein gespeichertes Wort (alt oder neu). null, wenn es kein gestaltetes Bild ist.
export function profilbildAusToken(wert) {
  if (!istMotiv(wert)) return null;
  const rest = wert.slice(PRAEFIX.length);
  const z = leererZustand();
  if (!rest.includes('=')) {
    const [motiv, farbe] = rest.split(':');
    const key = ALTE_NAMEN[motiv] || motiv;
    z.m = PB_MOTIVE[key] ? key : '';
    z.g = gueltigeFarbe(farbe) ? farbe : 'see';
    return z;
  }
  for (const teil of rest.split(';')) {
    const trenner = teil.indexOf('=');
    if (trenner < 1) continue;
    const key = teil.slice(0, trenner);
    let wertTeil = teil.slice(trenner + 1);
    try { wertTeil = decodeURIComponent(wertTeil); } catch { /* bleibt roh */ }
    if (key === 'm') z.m = PB_MOTIVE[ALTE_NAMEN[wertTeil] || wertTeil] ? (ALTE_NAMEN[wertTeil] || wertTeil) : '';
    else if (key === 'a') z.a = AUSDRUCK_KEYS.includes(wertTeil) ? wertTeil : '';
    else if (key === 'g') z.g = gueltigeFarbe(wertTeil) ? wertTeil : z.g;
    else if (key === 'v') z.v = gueltigeFarbe(wertTeil) ? wertTeil : '';
    else if (key === 'r') z.r = PB_RICHTUNGEN.some((r) => r.key === wertTeil) ? wertTeil : 'u';
    else if (key === 'p') z.p = PB_MUSTER.some((p) => p.key === wertTeil) ? wertTeil : '';
    else if (key === 'i') z.i = wertTeil.slice(0, 4);
    else if (key === 'e') z.e = gueltigesEmoji(wertTeil) ? wertTeil.toLowerCase() : '';
    else if (key === 'k') z.k = eigeneInitialen(wertTeil);
  }
  // Motiv und Emoji schließen einander aus — stünden je beide in einem Wort, gilt das Motiv.
  if (z.m) z.e = '';
  if (z.m || z.e) z.k = '';
  return z;
}

// Runde 8: selbst getippte Initialen — höchstens drei Buchstaben oder Ziffern, groß geschrieben.
export function eigeneInitialen(wert) {
  return [...String(wert || '').normalize('NFC').replace(/[^\p{L}\p{N}]/gu, '')].slice(0, 3).join('').toLocaleUpperCase('de');
}

// Schlicht = nichts, was nur ein Bild zeigen kann: dann gilt die normale Initialen-Scheibe.
export function istSchlicht(z) {
  return Boolean(z) && !z.m && !z.e && !z.v && !z.p && !z.k;
}

export function profilbildToken(z) {
  const teile = [];
  if (z.m) teile.push(`m=${z.m}`);
  if (z.m && z.a && PB_MOTIVE[z.m]?.kategorie === 'tiere') teile.push(`a=${z.a}`);
  if (!z.m && z.e) teile.push(`e=${z.e}`);
  teile.push(`g=${z.g}`);
  if (z.v) {
    teile.push(`v=${z.v}`);
    if (z.r && z.r !== 'u') teile.push(`r=${z.r}`);
  }
  if (z.p) teile.push(`p=${z.p}`);
  if (!z.m && !z.e && z.i) teile.push(`i=${encodeURIComponent(z.i)}`);
  if (!z.m && !z.e && z.k) teile.push(`k=${encodeURIComponent(z.k)}`);
  return PRAEFIX + teile.join(';');
}

// Was gespeichert wird: { photo, color }.
export function profilbildErgebnis(z) {
  return { photo: istSchlicht(z) ? null : profilbildToken(z), color: farbWert(z.g) };
}

// Ein Name wurde geändert: Wörter OHNE Motiv tragen die Initialen im Bild — die ziehen mit.
export function mitInitialen(wert, initialen) {
  const z = profilbildAusToken(wert);
  if (!z || z.m || z.e || (!z.v && !z.p && !z.k)) return wert;
  return profilbildToken({ ...z, i: initialen || '' });
}

const xml = (s) => String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');

function musterSvg(key) {
  if (key === 'punkte') {
    return `<pattern id="pm" width="12" height="12" patternUnits="userSpaceOnUse"><circle cx="3" cy="3" r="1.45" fill="#fff"/><circle cx="9" cy="9" r="1.45" fill="#fff"/></pattern><rect width="96" height="96" fill="url(#pm)" opacity=".2"/>`;
  }
  if (key === 'wellen') {
    return `<pattern id="pm" width="16" height="11" patternUnits="userSpaceOnUse"><path d="M-.5 5.5Q4 1.4 8 5.5T16.5 5.5" stroke="#fff" stroke-width="1.7" fill="none"/></pattern><rect width="96" height="96" fill="url(#pm)" opacity=".2"/>`;
  }
  if (key === 'streifen') {
    return `<pattern id="pm" width="10" height="10" patternUnits="userSpaceOnUse" patternTransform="rotate(40)"><rect width="3.4" height="10" fill="#fff"/></pattern><rect width="96" height="96" fill="url(#pm)" opacity=".13"/>`;
  }
  if (key === 'ringe') {
    let ringe = '';
    for (let rad = 10; rad < 140; rad += 11) ringe += `<circle cx="84" cy="90" r="${rad}"/>`;
    return `<g fill="none" stroke="#fff" stroke-width="3" opacity=".14">${ringe}</g>`;
  }
  if (key === 'sterne') {
    const punkte = [[14, 22, 1.3, 0.55], [30, 12, 0.9, 0.4], [52, 9, 1.1, 0.5], [74, 16, 1.5, 0.6], [86, 34, 0.9, 0.4], [9, 46, 1, 0.45], [88, 58, 1.2, 0.5], [18, 72, 1.4, 0.5], [70, 86, 1, 0.4], [40, 88, 0.8, 0.35], [62, 28, 0.7, 0.35], [24, 36, 0.7, 0.3]];
    const funkeln = (x, y, s) => `<path d="M${x} ${y - s * 3}Q${x} ${y} ${x + s * 3} ${y}Q${x} ${y} ${x} ${y + s * 3}Q${x} ${y} ${x - s * 3} ${y}Q${x} ${y} ${x} ${y - s * 3}Z" fill="#fff" opacity=".55"/>`;
    return `${punkte.map(([x, y, r, o]) => `<circle cx="${x}" cy="${y}" r="${r}" fill="#fff" opacity="${o}"/>`).join('')}${funkeln(78, 70, 1.3)}${funkeln(20, 56, 1)}`;
  }
  if (key === 'berge') {
    return `<circle cx="72" cy="25" r="8" fill="#fff" opacity=".18"/><path d="M0 66L20 46 34 58 56 34 78 56 96 44V96H0Z" fill="#000" opacity=".1"/><path d="M0 80 18 66 36 76 58 58 80 76 96 68V96H0Z" fill="#000" opacity=".13"/>`;
  }
  if (key === 'wald') {
    const baum = (x, basis, h, b) => `<path d="M${x} ${basis - h}L${x + b} ${basis}H${x - b}Z"/>`;
    const hinten = [4, 18, 30, 44, 58, 70, 84, 96].map((x, i) => baum(x, 80, 22 + (i % 3) * 5, 8)).join('');
    const vorn = [-2, 12, 26, 40, 54, 68, 82, 96].map((x, i) => baum(x + 6, 96, 24 + ((i + 1) % 3) * 6, 9)).join('');
    return `<g fill="#000" opacity=".09">${hinten}<rect y="80" width="96" height="16"/></g><g fill="#000" opacity=".1">${vorn}</g>`;
  }
  return '';
}

function grundSvg(z) {
  const eins = farbWert(z.g);
  if (!z.v) return { defs: '', flaeche: `<rect width="96" height="96" fill="${eins}"/>` };
  const zwei = farbWert(z.v);
  const richtung = PB_RICHTUNGEN.find((r) => r.key === z.r) || PB_RICHTUNGEN[0];
  const stops = `<stop offset="0" stop-color="${eins}"/><stop offset="1" stop-color="${zwei}"/>`;
  const defs = richtung.key === 'k'
    ? `<radialGradient id="gv" cx="50%" cy="50%" r="62%">${stops}</radialGradient>`
    : `<linearGradient id="gv" ${richtung.attr}>${stops}</linearGradient>`;
  return { defs, flaeche: `<rect width="96" height="96" fill="url(#gv)"/>` };
}

const SYSTEMSCHRIFT = "-apple-system,BlinkMacSystemFont,'SF Pro Text','Segoe UI',Roboto,'Helvetica Neue',Arial,sans-serif";
const EMOJISCHRIFT = "'Apple Color Emoji','Segoe UI Emoji','Noto Color Emoji','Segoe UI Symbol',sans-serif";

// Schatten unter dem Motiv trennt es von jedem Grund — auch der orange Fuchs auf Kürbis bleibt
// lesbar. Die Facette (rechte Hälfte eine Spur dunkler) gibt Tieren Tiefe.
//
// Runde 5 (B6, Jonathan: „Auflösung der Icons ist auch etwas schlecht"): Beides kam aus einem
// SVG-Filter (Unschärfe, Versatz, Flutung). Ein Filter wird in einem Zwischenbild gerechnet — ob
// WebKit (Safari und die App-Hülle auf dem iPhone) das in einem <img> in Geräteauflösung tut, hängt
// am Zeichenweg; die Folge wäre ein weiches Motiv. Deshalb jetzt nur Vektoren, scharf auf jeder
// Engine und in jeder Größe:
//   Schatten  sieben leicht versetzte Schattenrisse des Motivs — zusammen wie vorher Unschärfe ≈ 1,9,
//             Versatz 1,9 nach unten, Deckkraft ≈ .3
//   Facette   ein dunkler Schattenriss (.1), auf die rechte Hälfte beschnitten (Vektor-Clip)
// Schattenriss = dieselbe Zeichnung, über eine Regel im Bild in Schwarz (Klasse pbs).
const SCHATTENRISS_STIL = '<style>.pbs *{fill:#000!important}.pbs [fill="none"]{fill:none!important}.pbs [stroke]:not([stroke="none"]){stroke:#000!important}</style>';
const SCHATTEN_VERSATZ = [[0, 1.9, 0.1], [1.3, 1.9, 0.045], [-1.3, 1.9, 0.045], [0.65, 3.03, 0.045], [-0.65, 3.03, 0.045], [0.65, 0.77, 0.045], [-0.65, 0.77, 0.045]];

function motivMitTiefe(motiv, ausdruck) {
  const zeichnung = motiv.zeichnung(ausdruck || '');
  const schatten = SCHATTEN_VERSATZ.map(([dx, dy, deckkraft]) => `<g class="pbs" opacity="${deckkraft}" transform="translate(${dx} ${dy})">${zeichnung}</g>`).join('');
  const facette = motiv.facette ? `<g class="pbs" opacity=".1" clip-path="url(#pbr)">${zeichnung}</g>` : '';
  return `${schatten}${zeichnung}${facette}`;
}

export function profilbildSvg(z) {
  const grund = grundSvg(z);
  const motiv = z.m ? PB_MOTIVE[z.m] : null;
  const skala = motiv?.skala || 0.86;
  const mitte = motiv?.y ?? 49;
  // Runde 5 (B1): Emoji statt Motiv — in der Farbschrift des Geräts. Emojis bringen ihre eigene Tiefe mit.
  const emoji = !motiv && z.e ? emojiZeichen(z.e) : '';
  const tiefe = motiv ? `${SCHATTENRISS_STIL}${motiv.facette ? '<clipPath id="pbr"><rect x="48" y="-20" width="80" height="140"/></clipPath>' : ''}` : '';
  const inhalt = motiv
    ? `<g transform="translate(48 ${mitte}) scale(${skala}) translate(-48 -48)">${motivMitTiefe(motiv, z.a)}</g>`
    : emoji
      ? `<text x="48" y="49" dy=".35em" text-anchor="middle" font-family="${EMOJISCHRIFT}" font-size="52">${xml(emoji)}</text>`
      : ((z.k || z.i) ? `<text x="48" y="48" dy=".355em" text-anchor="middle" font-family="${SYSTEMSCHRIFT}" font-weight="600" font-size="${[...(z.k || z.i)].length > 2 ? 27 : 33}" letter-spacing="-.3" fill="#fff">${xml(z.k || z.i)}</text>` : '');
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 96 96" width="96" height="96">
<defs>${grund.defs}<radialGradient id="gl" cx="28%" cy="16%" r="85%"><stop offset="0" stop-color="#fff" stop-opacity=".16"/><stop offset=".6" stop-color="#fff" stop-opacity="0"/></radialGradient><linearGradient id="gs" x1="0" y1="0" x2="0" y2="1"><stop offset=".55" stop-color="#000" stop-opacity="0"/><stop offset="1" stop-color="#000" stop-opacity=".12"/></linearGradient>${tiefe}</defs>
${grund.flaeche}${musterSvg(z.p)}<rect width="96" height="96" fill="url(#gl)"/><rect width="96" height="96" fill="url(#gs)"/>
${inhalt}
</svg>`;
}

const bildMerker = new Map();

// Bildadresse eines Zustands — für Vorschauen im Baukasten (auch schlichte Farben).
export function profilbildAdresse(z) {
  const schluessel = `${profilbildToken(z)}|${z.i || ''}|${z.k || ''}`;
  if (!bildMerker.has(schluessel)) {
    if (bildMerker.size > 600) bildMerker.clear();
    bildMerker.set(schluessel, `data:image/svg+xml;charset=utf-8,${encodeURIComponent(profilbildSvg(z))}`);
  }
  return bildMerker.get(schluessel);
}

// Die Bildadresse für <img src> — dieselbe Stelle, an der sonst die Foto-Adresse steht
// (web/ui/components.js → bildVon).
export function motivBildAdresse(wert) {
  const z = profilbildAusToken(wert);
  return z ? profilbildAdresse(z) : null;
}
