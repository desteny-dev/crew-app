// Bereich Profil (reference 06.x + Vertrag §9, Runtime-Grammatik v3.1): eigenes Profil,
// Einstellungen, Freunde, QR-Einladung und Onboarding. render(ctx) → { html, bind(root, ctx) }.
//
// v3.1 §1: JEDER Screen dieses Bereichs wird mit screenScaffold(...) gebaut — genau eine
// Scrollfläche je Screen, CTAs/Navigation in der absolut darüberliegenden Bottom-Ebene.
// Es gibt hier keine zweite Scrollfläche und kein zusätzliches overflow:hidden mehr.

import { esc, bindActions } from '../core/html.js';
import {
  screenScaffold, bottomBar, bottomFade, tabBar, personAvatar, personMarker,
  specialLabelChip, sheet, SPECIAL_SYMBOL_KEYS, SPECIAL_SYMBOLS, specialSymbolKey, ersterEmojiCluster,
  specialAvatarMark, avatarFlaeche,
  dirtyGuard, discardSheet, discardActions, leerZeile,
  radSpalte, bindRad, RAD_ZEILE,
  tabHeader, MARKER_COLORS,
} from '../ui/components.js';
import { backArrow, plus, cross, pencil } from '../ui/icons.js';
import { activityIconSvg, ressourcenIconSvg, ressourcenIconKey, ressourcenIconGefunden, RESSOURCEN_WORTE, ART_WORTE } from '../ui/activity-icons.js';
import { symbol } from '../ui/symbole.js';
// Runde 3: Profilbild aus Hintergrund, Motiv oder Foto — EIN Baukasten für Einrichten und Profil.
// Runde 4 (B1–B3): mit Foto-Zuschnitt, einer großen Vorschau und als ganzes Sheet (pbSheet).
import { PB_FARBEN, mitInitialen } from '../ui/profilbild.js';
import { pbStart, pbErgebnis, pbAvatar, pbSheet, pbActs, pbFotoBinden } from '../ui/profilbild-baukasten.js';
// Runde 4: Zeichen nach Kategorien (B7) · Keine Zeit (B5) · ein Zeichen für alle besten Freunde (B4).
import { zeichenAuswahlHtml, zeichenAuswahlBinden } from '../ui/zeichen-auswahl.js';
import { belegtBereinigen, belegtJetzt, belegtBisText, tageText, tagKurz, WOCHE_AB_MONTAG } from '../core/belegt.js';
import { besteFreundeMarke, istStandardMarke, BESTE_FREUNDE_GOLD, BESTE_FREUNDE_MARKE_STANDARD, MARKE_SYMBOLE } from '../ui/beste-freunde-marke.js';
import { haptik } from '../ui/haptik.js';
// Runde 5 (P5, G1/G2): Mitteilungsseite — Zustand dieses Geräts, Einschalten im Tipp, Töne.
import { pushSeitenKarte, pushSeitenAktionen, pushLageAuffrischen, mitteilungenBeobachten } from '../ui/mitteilungen.js';
import { ton } from '../ui/ton.js';
// Runde 5 (A2): Das Desteny-Zeichen — dieselbe Quelle wie die Anmeldung.
import { destenyKachel } from '../ui/desteny-marke.js';
// Runde 3 (D4): Das Kamerafeld im Einladungs-Sheet scannt wirklich.
import { starteQrScan, einladungsCodeAus } from '../ui/qr-scanner.js';
import { weekdayShort, fromISODate } from '../core/dates.js';
import { ME, roomIdForCrew } from '../data/ids.js';
import { meetBrowserParts, bindMeetBrowserBody } from './meet-browser.js';
import { setGatewayMode } from '../data/gateway.js';
import { t as tx, tn as tnx, SPRACHEN, sprachWahl, geraeteSprache, merkeSprachWahl, schluessel, wort } from '../core/sprache.js';
// v7 A37 (spec/08 §2): dieselbe Gruppendarstellung wie ueberall — Bild, sonst Monogramm.
import { gruppenKreis } from './room.js';

// ============================================================================
// QR-Encoder — Byte-Modus, EC-Level L, Version 2–5 (reine Funktionen, Vertrag §9)
// ============================================================================
//
// Runde 3 (Chef, gemessen): Der Encoder kannte nur Version 2 (32 Bytes) und 3 (53 Bytes) und
// wählte über 32 Bytes IMMER 3. Die veröffentlichte Einladungsadresse
// (https://desteny-dev.github.io/crew-app/?einladung=…) hat 59 Bytes — der Code lief über und
// war mit keinem Scanner lesbar. Auf dem Prüfserver (localhost, 42 Bytes) fiel das nicht auf.
// Jetzt: die kleinste Version, in die der Text passt, bis Version 5 (106 Bytes).
// Stufe L hat bis Version 5 genau EINEN Block (keine Verschränkung), das Längenfeld ist 8 Bit,
// es gibt eine Ausrichtungsmarke und keine Versionsinformation (erst ab 7); die 7 Restbits
// füllt placeData als helle Module. Der RS-Generator wird für jeden Grad allgemein berechnet.

const QR_VERSIONS = {
  2: { size: 25, totalCodewords: 44, ecCodewords: 10, align: 18, byteCapacity: 32 },
  3: { size: 29, totalCodewords: 70, ecCodewords: 15, align: 22, byteCapacity: 53 },
  4: { size: 33, totalCodewords: 100, ecCodewords: 20, align: 26, byteCapacity: 78 },
  5: { size: 37, totalCodewords: 134, ecCodewords: 26, align: 30, byteCapacity: 106 },
};
const QR_GROESSTE = 5;

const GF_EXP = new Uint8Array(512);
const GF_LOG = new Uint8Array(256);
(() => {
  let x = 1;
  for (let i = 0; i < 255; i++) {
    GF_EXP[i] = x;
    GF_LOG[x] = i;
    x <<= 1;
    if (x & 0x100) x ^= 0x11d;
  }
  for (let i = 255; i < 512; i++) GF_EXP[i] = GF_EXP[i - 255];
})();

function gfMul(a, b) {
  if (a === 0 || b === 0) return 0;
  return GF_EXP[GF_LOG[a] + GF_LOG[b]];
}

// Reed-Solomon-Restpolynom (Generator höchstgradig zuerst, Leitkoeffizient 1).
export function rsRemainder(data, degree) {
  let gen = [1];
  for (let i = 0; i < degree; i++) {
    const next = new Array(gen.length + 1).fill(0);
    for (let j = 0; j < gen.length; j++) {
      next[j] ^= gen[j];
      next[j + 1] ^= gfMul(gen[j], GF_EXP[i]);
    }
    gen = next;
  }
  const rest = data.concat(new Array(degree).fill(0));
  for (let i = 0; i < data.length; i++) {
    const factor = rest[i];
    if (factor === 0) continue;
    for (let j = 0; j < gen.length; j++) rest[i + j] ^= gfMul(gen[j], factor);
  }
  return rest.slice(data.length);
}

function qrCodewords(bytes, version) {
  const spec = QR_VERSIONS[version];
  const dataCount = spec.totalCodewords - spec.ecCodewords;
  const bits = [];
  const push = (value, length) => {
    for (let i = length - 1; i >= 0; i--) bits.push((value >>> i) & 1);
  };
  push(0b0100, 4);
  push(bytes.length, 8);
  bytes.forEach((b) => push(b, 8));
  for (let i = 0; i < 4 && bits.length < dataCount * 8; i++) bits.push(0);
  while (bits.length % 8 !== 0) bits.push(0);
  const data = [];
  for (let i = 0; i < bits.length; i += 8) {
    let value = 0;
    for (let j = 0; j < 8; j++) value = (value << 1) | bits[i + j];
    data.push(value);
  }
  const pads = [0xec, 0x11];
  let p = 0;
  while (data.length < dataCount) data.push(pads[p++ % 2]);
  return data.concat(rsRemainder(data, spec.ecCodewords));
}

const QR_MASKS = [
  (r, c) => (r + c) % 2 === 0,
  (r) => r % 2 === 0,
  (r, c) => c % 3 === 0,
  (r, c) => (r + c) % 3 === 0,
  (r, c) => (Math.floor(r / 2) + Math.floor(c / 3)) % 2 === 0,
  (r, c) => ((r * c) % 2) + ((r * c) % 3) === 0,
  (r, c) => (((r * c) % 2) + ((r * c) % 3)) % 2 === 0,
  (r, c) => (((r * c) % 3) + ((r + c) % 2)) % 2 === 0,
];

export function qrFormatBits(mask) {
  const data = (0b01 << 3) | mask; // EC-Level L
  const bitLen = (v) => {
    let n = 0;
    while (v !== 0) { n += 1; v >>>= 1; }
    return n;
  };
  let d = data << 10;
  while (bitLen(d) - bitLen(0x537) >= 0) d ^= 0x537 << (bitLen(d) - bitLen(0x537));
  return (((data << 10) | d) ^ 0x5412) & 0x7fff;
}

export function qrMatrix(text) {
  const bytes = Array.from(new TextEncoder().encode(text));
  const version = Object.keys(QR_VERSIONS).map(Number).find((v) => bytes.length <= QR_VERSIONS[v].byteCapacity) || QR_GROESSTE;
  if (bytes.length > QR_VERSIONS[version].byteCapacity) {
    // Länger als Version 5 fasst: lieber laut scheitern als einen Code zeigen, den niemand liest.
    throw new Error(`QR-Text zu lang (${bytes.length} Bytes, höchstens ${QR_VERSIONS[QR_GROESSTE].byteCapacity})`);
  }
  const spec = QR_VERSIONS[version];
  const size = spec.size;
  const codewords = qrCodewords(bytes, version);

  const makeBase = () => {
    const m = Array.from({ length: size }, () => new Array(size).fill(null));
    const setFinder = (row, col) => {
      for (let r = -1; r <= 7; r++) {
        for (let c = -1; c <= 7; c++) {
          const rr = row + r;
          const cc = col + c;
          if (rr < 0 || rr >= size || cc < 0 || cc >= size) continue;
          const dark = r >= 0 && r <= 6 && c >= 0 && c <= 6
            && (r === 0 || r === 6 || c === 0 || c === 6 || (r >= 2 && r <= 4 && c >= 2 && c <= 4));
          m[rr][cc] = dark ? 1 : 0;
        }
      }
    };
    setFinder(0, 0);
    setFinder(0, size - 7);
    setFinder(size - 7, 0);
    for (let i = 8; i < size - 8; i++) {
      if (m[6][i] === null) m[6][i] = i % 2 === 0 ? 1 : 0;
      if (m[i][6] === null) m[i][6] = i % 2 === 0 ? 1 : 0;
    }
    const a = spec.align;
    for (let r = -2; r <= 2; r++) {
      for (let c = -2; c <= 2; c++) {
        m[a + r][a + c] = Math.max(Math.abs(r), Math.abs(c)) !== 1 ? 1 : 0;
      }
    }
    m[size - 8][8] = 1; // Dunkelmodul
    for (let i = 0; i < 9; i++) {
      if (i === 6) continue;
      if (m[8][i] === null) m[8][i] = 0;
      if (m[i][8] === null) m[i][8] = 0;
    }
    for (let i = size - 8; i < size; i++) {
      if (m[8][i] === null) m[8][i] = 0;
      if (m[i][8] === null) m[i][8] = 0;
    }
    return m;
  };

  const placeData = (m, mask) => {
    let byteIndex = 0;
    let bitIndex = 7;
    let row = size - 1;
    let inc = -1;
    for (let col = size - 1; col > 0; col -= 2) {
      if (col === 6) col -= 1;
      for (;;) {
        for (let c = 0; c < 2; c++) {
          if (m[row][col - c] === null) {
            let dark = false;
            if (byteIndex < codewords.length) dark = ((codewords[byteIndex] >>> bitIndex) & 1) === 1;
            if (QR_MASKS[mask](row, col - c)) dark = !dark;
            m[row][col - c] = dark ? 1 : 0;
            bitIndex -= 1;
            if (bitIndex === -1) { byteIndex += 1; bitIndex = 7; }
          }
        }
        row += inc;
        if (row < 0 || row >= size) { row -= inc; inc = -inc; break; }
      }
    }
  };

  const placeFormat = (m, mask) => {
    const bits = qrFormatBits(mask);
    for (let i = 0; i < 15; i++) {
      const mod = ((bits >> i) & 1) === 1 ? 1 : 0;
      if (i < 6) m[i][8] = mod;
      else if (i < 8) m[i + 1][8] = mod;
      else m[size - 15 + i][8] = mod;
      if (i < 8) m[8][size - i - 1] = mod;
      else if (i < 9) m[8][15 - i] = mod;
      else m[8][15 - i - 1] = mod;
    }
    m[size - 8][8] = 1;
  };

  const penalty = (m) => {
    let score = 0;
    for (let r = 0; r < size; r++) {
      let runRow = 1;
      let runCol = 1;
      for (let c = 1; c < size; c++) {
        if (m[r][c] === m[r][c - 1]) {
          runRow += 1;
          if (c === size - 1 && runRow >= 5) score += runRow - 2;
        } else {
          if (runRow >= 5) score += runRow - 2;
          runRow = 1;
        }
        if (m[c][r] === m[c - 1][r]) {
          runCol += 1;
          if (c === size - 1 && runCol >= 5) score += runCol - 2;
        } else {
          if (runCol >= 5) score += runCol - 2;
          runCol = 1;
        }
      }
    }
    for (let r = 0; r < size - 1; r++) {
      for (let c = 0; c < size - 1; c++) {
        const v = m[r][c];
        if (m[r][c + 1] === v && m[r + 1][c] === v && m[r + 1][c + 1] === v) score += 3;
      }
    }
    const patternA = [1, 0, 1, 1, 1, 0, 1, 0, 0, 0, 0];
    const patternB = [0, 0, 0, 0, 1, 0, 1, 1, 1, 0, 1];
    for (let r = 0; r < size; r++) {
      for (let c = 0; c + 10 < size; c++) {
        let rowA = true;
        let rowB = true;
        let colA = true;
        let colB = true;
        for (let k = 0; k < 11; k++) {
          if (m[r][c + k] !== patternA[k]) rowA = false;
          if (m[r][c + k] !== patternB[k]) rowB = false;
          if (m[c + k][r] !== patternA[k]) colA = false;
          if (m[c + k][r] !== patternB[k]) colB = false;
        }
        if (rowA || rowB) score += 40;
        if (colA || colB) score += 40;
      }
    }
    let dark = 0;
    for (let r = 0; r < size; r++) for (let c = 0; c < size; c++) dark += m[r][c];
    score += Math.floor(Math.abs((dark * 100) / (size * size) - 50) / 5) * 10;
    return score;
  };

  let best = null;
  let bestScore = Infinity;
  for (let mask = 0; mask < 8; mask++) {
    const m = makeBase();
    placeData(m, mask);
    placeFormat(m, mask);
    const score = penalty(m);
    if (score < bestScore) { bestScore = score; best = m; }
  }
  return best;
}

// v4 QR-1: Der Code muss SCANBAR sein. Vorher ersetzte die Darstellung die
// Positionserkennungsmuster durch dekorative grüne Kreise an ALLEN VIER Ecken und löschte
// die Module darunter — damit konnte kein Scanner den Code lokalisieren, und die vierte
// Ecke verlor echte Datenmodule.
//
// Jetzt gilt die Norm: genau DREI Finder (oben links, oben rechts, unten links) als
// dunkles 7×7, helle 5×5-Trennung, dunkles 3×3. Die vierte Ecke trägt Daten. Rundum liegt
// die vorgeschriebene helle Quiet Zone von 4 Modulen. Der Crew-Look bleibt in den
// Datenmodulen erhalten (waagrechte Läufe als weiche Kapseln) — er berührt die
// Erkennungsmuster nicht mehr.
const QR_QUIET = 4;

// Auftrag §2.2: Der Code trägt die Sprache der App — runde Ecken, Papierton statt
// Reinweiß, die Erkennungsmuster als ruhige Ringe, unten links im Crew-Grün. Was er NICHT
// tut: die Lesbarkeit anfassen. Kein Zeichen in der Mitte (das frisst Fehlerkorrektur),
// keine bunten Datenmodule, kein Verlauf. Das Ruhefeld ringsum bleibt volle vier Module.
// Eigene Tokens, die im dunklen Satz bewusst NICHT überschrieben werden (styles.css):
// Ein umgedrehter Code (helle Module auf dunklem Grund) wäre für manche Scanner unlesbar,
// und ein Code, der bei manchen nicht geht, ist kaputt.
const QR_GRUND = 'var(--qr-grund)';
const QR_TINTE = 'var(--qr-tinte)';
// Runde 3 (Jonathan, D1): „Die Kreise haben ein falsches Grün — dunkelgrün statt unser
// Logo-Grün." Der Punkt trägt jetzt das Logo-Grün (auch im dunklen Modus dasselbe Token wie
// überall). Grund und Tinte bleiben die festen QR-Tokens.
const QR_MARKE = 'var(--green)';
// Im dunklen Satz ist --green heller (#2db56f), der QR-Grund aber bleibt hell. Gemessen mit einem
// fremden Decoder (scratch/r3-profilbild.mjs): In 1x war der Code dann nicht mehr lesbar — das
// helle Grün zählt im Erkennungsmuster nicht mehr sicher als dunkel. Nur dort wird der Punkt
// deshalb mit der QR-Tinte auf die Helligkeit des Logo-Grüns im hellen Satz gebracht.
const QR_MARKE_DUNKEL = '<style>:root[data-theme="dark"] svg[data-qr] .qr-marke{fill:color-mix(in srgb,var(--green) 80%,var(--qr-tinte))}</style>';

// Runde 2 (Jonathan): Alle drei Ecken gleich — schwarze Box, darin ein runder grüner Punkt.
// Der Rest des Codes bleibt schwarz. Der Punkt füllt die mittleren 3×3 Module aus; entlang
// der Mittellinie, auf der Scanner das Verhältnis 1:1:3:1:1 messen, ist er also genau drei
// Module breit — das Muster bleibt lesbar (nachgewiesen mit scratch/r1-qr-beweis.mjs).
function qrFinder(x, y) {
  return `<rect x="${x}" y="${y}" width="7" height="7" rx="1.8" fill="${QR_TINTE}"></rect>`
    + `<rect x="${x + 1}" y="${y + 1}" width="5" height="5" rx="1.3" fill="${QR_GRUND}"></rect>`
    + `<circle class="qr-marke" cx="${x + 3.5}" cy="${y + 3.5}" r="1.55" fill="${QR_MARKE}"></circle>`;
}

function qrSvg(text, sizePx) {
  const m = qrMatrix(text);
  const n = m.length;
  // Die drei Finder werden separat und geometrisch exakt gezeichnet; ihre Modulfelder
  // (inkl. der 1-Modul-Trennung ringsum) bleiben im Kapsel-Durchlauf ausgespart.
  const inFinder = (r, c) => (r < 8 && c < 8) || (r < 8 && c >= n - 8) || (r >= n - 8 && c < 8);
  let modules = '';
  for (let r = 0; r < n; r++) {
    let start = -1;
    for (let c = 0; c <= n; c++) {
      const dark = c < n && m[r][c] === 1 && !inFinder(r, c);
      if (dark && start === -1) start = c;
      if (!dark && start !== -1) {
        modules += `<rect x="${start}" y="${r}" width="${c - start}" height="1" rx="0.45"></rect>`;
        start = -1;
      }
    }
  }
  const span = n + QR_QUIET * 2;
  // Alle drei Ecken gleich: schwarze Box mit grünem Punkt (qrFinder).
  const finders = `${qrFinder(0, 0)}${qrFinder(n - 7, 0)}${qrFinder(0, n - 7)}`;
  return `<svg data-qr="1" width="${sizePx}" height="${sizePx}" viewBox="${-QR_QUIET} ${-QR_QUIET} ${span} ${span}" fill="${QR_TINTE}" shape-rendering="geometricPrecision">`
    + QR_MARKE_DUNKEL
    + `<rect x="${-QR_QUIET}" y="${-QR_QUIET}" width="${span}" height="${span}" rx="2.6" fill="${QR_GRUND}"></rect>`
    + `<g>${modules}</g><g>${finders}</g></svg>`;
}

// ============================================================================
// Gemeinsame Bausteine des Bereichs (Stile 1:1 aus reference 06.x)
// ============================================================================

const FONT = "'Instrument Sans',sans-serif";
const BRICOLAGE = "'Bricolage Grotesque',sans-serif";
const GREEN_PILL = `border:0;background:var(--green);color:var(--on-accent);font:650 14px/1 ${FONT};padding:14px 0;border-radius:999px;text-align:center;cursor:pointer;appearance:none;width:100%`;
const RED_PILL = `border:0;background:var(--red);color:var(--on-accent);font:650 14px/1 ${FONT};padding:14px 0;border-radius:999px;text-align:center;cursor:pointer;appearance:none;width:100%`;
const INPUT_STYLE = `width:100%;padding:13px 14px;border:1.5px solid var(--ink-a12);border-radius:14px;background:var(--paper);outline:none;color:var(--ink);font:600 15px ${FONT};box-sizing:border-box`;


const LEVEL_WORDS = { 1: tx('ab und zu'), 2: tx('regelmäßig'), 3: tx('oft') };

// v7 A31 (spec/06 §1): feste Vorschaugrenzen. Der „Alle …"-Knopf hängt daran und
// erscheint nur, wenn die Liste wirklich länger ist als die Vorschau.
const INTEREST_PREVIEW = 3;
const RESOURCE_PREVIEW = 4;

// v7 A32f (spec/06 §2): EIN Wortlaut für dieselbe Menge. Vorher hießen dieselben Personen
// je nach Screen „ausgewählte" oder „markierte" Freunde.
const MARKED_FRIENDS_LABEL = tx('Markierte Freunde');

// v7 A04c (spec/01 §3): Die verbindliche 5x3-Reihenfolge liegt jetzt zentral in
// ui/components.js als MARKER_COLORS. Dieser Screen haelt KEINE zweite Liste mehr —
// genau die Doppelquelle wollte v7 abschaffen.
const MARK_PALETTE = MARKER_COLORS;
const MARK_COLOR_DEFAULT = MARK_PALETTE[0][0];

// Ein gespeicherter Altwert (z. B. #7E6BA8 aus dem Seed) liegt nicht in der Palette —
// dann trüge KEIN Feld den Auswahlring. Er wird deshalb beim Lesen auf den nächstliegenden
// Palettenton abgebildet, gemessen im RGB-Abstand.
function paletteColor(hex) {
  const wert = typeof hex === 'string' ? hex.trim().toUpperCase() : '';
  if (MARK_PALETTE.some(([value]) => value === wert)) return wert;
  const rgb = (value) => [1, 3, 5].map((i) => parseInt(value.slice(i, i + 2), 16));
  if (!/^#[0-9A-F]{6}$/.test(wert)) return MARK_COLOR_DEFAULT;
  const ziel = rgb(wert);
  let best = MARK_COLOR_DEFAULT;
  let bestAbstand = Infinity;
  for (const [value] of MARK_PALETTE) {
    const c = rgb(value);
    const abstand = (c[0] - ziel[0]) ** 2 + (c[1] - ziel[1]) ** 2 + (c[2] - ziel[2]) ** 2;
    if (abstand < bestAbstand) { bestAbstand = abstand; best = value; }
  }
  return best;
}

function paletteColorName(hex) {
  return (MARK_PALETTE.find(([value]) => value === paletteColor(hex)) || ['', tx('Farbe')])[1];
}

// v3.2 Ü3: kuratierte, dezente Akzentfarben. Die Statusfarben Grün (aktiv/frei), Blau (Loop),
// Orange (Benachrichtigung) und Rot (Absage) stehen hier bewusst NICHT zur Wahl.
// v3.2 D3: Palette und Farbnamen kommen zentral aus ui/components.js (MARKER_COLORS).

// v4 P0-3-8: Es gibt KEINE eigene Symboltabelle mehr in diesem Bereich. Vorher existierten
// drei Kopien desselben Schlüsselsatzes (hier, in room.js und in ui/components.js), die sich
// bei „herzlos" widersprachen — die Kachel zeigte etwas anderes als die spätere Markierung.
// Einzige Quelle ist jetzt SPECIAL_SYMBOLS aus ui/components.js. Für die 44px-Kachel wird
// dasselbe Symbol nur vergrößert gezeichnet, nie neu gezeichnet.
// v6 A04a: Es gibt keinen 'raute'-Rückfall mehr. specialSymbolKey migriert jeden Altwert
// auf das Herz — sonst bekäme eine Person ohne bewusste Wahl ein Viereck, das gar nicht
// mehr auswählbar ist.
function markSymbolGlyph(key, color, scale = 1.35) {
  const draw = SPECIAL_SYMBOLS[specialSymbolKey(key)];
  return `<span style="display:flex;align-items:center;justify-content:center;transform:scale(${scale})">${draw(color)}</span>`;
}
// v3.1 §6: FESTE kuratierte Symbolauswahl — genau SPECIAL_SYMBOL_KEYS aus ui/components.js,
// keine freie Emoji-Tastatur (Darstellung/Farbe liefe sonst je System auseinander).
const MARK_SYMBOL_ORDER = SPECIAL_SYMBOL_KEYS.filter((key) => SPECIAL_SYMBOLS[key]);

function hexToRgba(hex, alpha) {
  const v = hex.replace('#', '');
  return `rgba(${parseInt(v.slice(0, 2), 16)},${parseInt(v.slice(2, 4), 16)},${parseInt(v.slice(4, 6), 16)},${alpha})`;
}

const svgPersonPlus = `<svg width="21" height="21" viewBox="0 0 24 24" fill="none"><circle cx="10" cy="8.4" r="3.4" stroke="var(--ink)" stroke-width="1.8"></circle><path d="M3.6 19a6.5 6.5 0 0 1 12.8 0" stroke="var(--ink)" stroke-width="1.8" stroke-linecap="round"></path><path d="M18.5 7v6M15.5 10h6" stroke="var(--ink)" stroke-width="1.8" stroke-linecap="round"></path></svg>`;
const svgGear = `<svg width="20" height="20" viewBox="0 0 24 24" fill="none"><circle cx="12" cy="12" r="3.1" stroke="var(--ink)" stroke-width="1.8"></circle><path d="M12 3.6v2.2M12 18.2v2.2M20.4 12h-2.2M5.8 12H3.6M17.9 6.1l-1.5 1.5M7.6 16.4l-1.5 1.5M17.9 17.9l-1.5-1.5M7.6 7.6 6.1 6.1" stroke="var(--ink)" stroke-width="1.8" stroke-linecap="round"></path></svg>`;
const svgPencilSmall = (size = 13) => `<svg width="${size}" height="${size}" viewBox="0 0 24 24" fill="none"><path d="M4 20h4L20 8l-4-4L4 16v4Z" stroke="var(--ink)" stroke-width="1.8" stroke-linejoin="round"></path></svg>`;
const svgMyMeets = `<svg width="19" height="19" viewBox="0 0 24 24" fill="none"><rect x="3.8" y="5.2" width="16.4" height="15" rx="3" stroke="var(--ink)" stroke-width="1.8"></rect><path d="M3.8 9.8h16.4M8.4 3v3.4M15.6 3v3.4" stroke="var(--ink)" stroke-width="1.8" stroke-linecap="round"></path><path d="m9 14.6 2 2 4-4" stroke="var(--ink)" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"></path></svg>`;
const svgCopy = `<svg width="15" height="15" viewBox="0 0 24 24" fill="none"><rect x="8" y="8" width="12" height="12" rx="2.5" stroke="var(--green-dark)" stroke-width="1.8"></rect><path d="M5 15.5A2.5 2.5 0 0 1 4 13.5V6a2 2 0 0 1 2-2h7.5A2.5 2.5 0 0 1 15.5 5" stroke="var(--green-dark)" stroke-width="1.8" stroke-linecap="round"></path></svg>`;
const svgApple = (color = 'var(--ink)', size = 14) => `<svg width="${size}" height="${size}" viewBox="0 0 24 24" fill="${color}"><path d="M16.6 12.9c0-2.5 2-3.7 2.1-3.8-1.1-1.7-2.9-1.9-3.5-1.9-1.5-.2-2.9.9-3.7.9-.8 0-1.9-.9-3.2-.9-1.6 0-3.1 1-4 2.4-1.7 2.9-.4 7.2 1.2 9.6.8 1.2 1.8 2.5 3 2.4 1.2 0 1.7-.8 3.1-.8 1.4 0 1.9.8 3.2.8 1.3 0 2.2-1.2 3-2.3.9-1.4 1.3-2.7 1.3-2.8-.1 0-2.5-1-2.5-3.6ZM14.2 5.6c.7-.8 1.1-1.9 1-3.1-1 0-2.2.7-2.9 1.5-.6.7-1.2 1.9-1 3 1.1.1 2.2-.6 2.9-1.4Z"></path></svg>`;
const svgGoogle = `<svg width="16" height="16" viewBox="0 0 24 24" fill="var(--ink)"><path d="M20.6 12.2c0 4.9-3.5 8.4-8.6 8.4a8.6 8.6 0 1 1 0-17.2c2.3 0 4.3.85 5.8 2.24l-2.4 2.32A5.1 5.1 0 0 0 12 6.9a5.3 5.3 0 1 0 5.1 6.75H12v-3.1h8.5c.07.53.1 1.08.1 1.65Z"></path></svg>`;
const svgCameraLens = (size = 13, color = 'var(--ink)') => `<svg width="${size}" height="${size}" viewBox="0 0 24 24" fill="none" style="pointer-events:none"><path d="M4 8.5A2.5 2.5 0 0 1 6.5 6h1.2l1.1-1.7c.3-.5.8-.8 1.4-.8h3.6c.6 0 1.1.3 1.4.8L16.3 6h1.2A2.5 2.5 0 0 1 20 8.5v8a2.5 2.5 0 0 1-2.5 2.5h-11A2.5 2.5 0 0 1 4 16.5v-8Z" stroke="${color}" stroke-width="1.8" stroke-linejoin="round"></path><circle cx="12" cy="12.4" r="3.2" stroke="${color}" stroke-width="1.8"></circle></svg>`;

const svgAbmelden = `<svg width="17" height="17" viewBox="0 0 24 24" fill="none" style="pointer-events:none"><path d="M14.5 4.5H7.2A2.2 2.2 0 0 0 5 6.7v10.6a2.2 2.2 0 0 0 2.2 2.2h7.3" stroke="var(--ink-soft)" stroke-width="1.8" stroke-linecap="round"></path><path d="M18.5 12H10M15.6 8.6 19 12l-3.4 3.4" stroke="var(--ink-soft)" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"></path></svg>`;
const svgAuge = `<svg width="18" height="18" viewBox="0 0 24 24" fill="none"><path d="M2.5 12S6 5.5 12 5.5 21.5 12 21.5 12 18 18.5 12 18.5 2.5 12 2.5 12Z" stroke="currentColor" stroke-width="1.7" stroke-linejoin="round"></path><circle cx="12" cy="12" r="3.1" stroke="currentColor" stroke-width="1.7"></circle></svg>`;
// v6 A20b: Sucher-Symbol des Umschalters im Einladungszustand (zurück zum eigenen Code).
const svgQrMini = `<svg width="14" height="14" viewBox="0 0 24 24" fill="none" style="flex:none;pointer-events:none"><rect x="3.5" y="3.5" width="7" height="7" rx="1.8" stroke="var(--ink)" stroke-width="1.8"></rect><rect x="13.5" y="3.5" width="7" height="7" rx="1.8" stroke="var(--ink)" stroke-width="1.8"></rect><rect x="3.5" y="13.5" width="7" height="7" rx="1.8" stroke="var(--ink)" stroke-width="1.8"></rect><path d="M14 14h2.5M20 14v2.5M14 18.5v2M17.5 20.5h3" stroke="var(--ink)" stroke-width="1.8" stroke-linecap="round"></path></svg>`;
const svgPersonPlusGreen = `<svg width="15" height="15" viewBox="0 0 24 24" fill="none" style="flex:none;pointer-events:none"><circle cx="10" cy="8.4" r="3.4" stroke="var(--green-dark)" stroke-width="1.9"></circle><path d="M3.6 19a6.5 6.5 0 0 1 12.8 0" stroke="var(--green-dark)" stroke-width="1.9" stroke-linecap="round"></path><path d="M18.5 7v6M15.5 10h6" stroke="var(--green-dark)" stroke-width="1.9" stroke-linecap="round"></path></svg>`;
const svgSendWhite = `<svg width="15" height="15" viewBox="0 0 24 24" fill="none"><path d="M20.5 12 4 5.2 6.6 12 4 18.8 20.5 12Z" stroke="var(--on-accent)" stroke-width="1.8" stroke-linejoin="round"></path><path d="M6.6 12h6.6" stroke="var(--on-accent)" stroke-width="1.8" stroke-linecap="round"></path></svg>`;
const svgTrashRed = `<svg width="15" height="15" viewBox="0 0 24 24" fill="none"><path d="M4 6.5h16M9 6.5V4.8A1.8 1.8 0 0 1 10.8 3h2.4A1.8 1.8 0 0 1 15 4.8v1.7M6.5 6.5 7.5 21h9l1-14.5" stroke="var(--red)" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"></path></svg>`;
const svgCheckedCircle = `<svg width="18" height="18" viewBox="0 0 24 24" fill="none" style="pointer-events:none"><circle cx="12" cy="12" r="10" fill="var(--green)"></circle><path d="m8 12 2.6 2.6L16.4 9" stroke="var(--on-accent)" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"></path></svg>`;
const emptyCircle = `<span style="width:18px;height:18px;border-radius:50%;border:1.7px solid var(--line-solid);box-sizing:border-box;flex:none;pointer-events:none"></span>`;
const chevron = `<span style="color:var(--line-strong);pointer-events:none">›</span>`;
const svgRowChevron = `<svg width="12" height="12" viewBox="0 0 24 24" fill="none" style="flex:none;pointer-events:none"><path d="M9.5 5.5 16 12l-6.5 6.5" stroke="var(--line-solid)" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round"></path></svg>`;
const svgChevronUp = (color = 'var(--green-dark)', size = 15) => `<svg width="${size}" height="${size}" viewBox="0 0 24 24" fill="none" style="flex:none;pointer-events:none"><path d="m6 14.5 6-6 6 6" stroke="${color}" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round"></path></svg>`;
const svgLock = `<svg width="14" height="14" viewBox="0 0 24 24" fill="none" style="flex:none"><rect x="5" y="10" width="14" height="10" rx="3" stroke="var(--muted)" stroke-width="1.8"></rect><path d="M8 10V7.5a4 4 0 0 1 8 0V10" stroke="var(--muted)" stroke-width="1.8"></path></svg>`;
const svgShareWhite = `<svg width="16" height="16" viewBox="0 0 24 24" fill="none"><path d="M12 14V4M12 4 8.5 7.5M12 4l3.5 3.5" stroke="var(--on-accent)" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"></path><path d="M5 12v6a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2v-6" stroke="var(--on-accent)" stroke-width="1.8" stroke-linecap="round"></path></svg>`;
const svgCapacity = `<svg width="12" height="12" viewBox="0 0 24 24" fill="none"><circle cx="12" cy="8" r="3.4" stroke="var(--muted-light)" stroke-width="1.8"></circle><path d="M5.5 19.5c0-3.3 2.9-5.2 6.5-5.2s6.5 1.9 6.5 5.2" stroke="var(--muted-light)" stroke-width="1.8" stroke-linecap="round"></path></svg>`;
const svgStarGold = (size = 16) => `<svg width="${size}" height="${size}" viewBox="0 0 24 24" style="flex:none;pointer-events:none"><path d="m12 3.5 2.6 5.3 5.9.9-4.3 4.1 1 5.9L12 16.9l-5.2 2.8 1-5.9-4.3-4.1 5.9-.9L12 3.5Z" fill="#C9AE6B"></path></svg>`;

// Ressourcen-Icons (reference 06.1; Beamer/Kühlbox/Fallback im selben Strichstil).
// Auftrag §6.2: Das Zeichen einer Ressource kommt aus dem EINEN Katalog. Vorher standen
// hier sechs Muster; alles andere — PC, Beamer-Leinwand, Bohrmaschine, Kanu, Gitarre —
// bekam denselben allgemeinen Anhänger.
// R1 §6.2: `gewaehlt` ist das selbst ausgesuchte Zeichen aus resourceMeta[name].icon.
function resourceIconSvg(name, size = 15, gewaehlt = null) {
  return ressourcenIconSvg(name, 'var(--muted)', size, gewaehlt);
}

function eigenesRessourcenZeichen(settings, label) {
  return settings.resourceMeta?.[label]?.icon || null;
}

// Verfügbarkeits-Kreis (reference 06.1): voll grün = immer, halb = manchmal.
// v3.1 §6: Eine EIGENE Ressource hat genau einen dieser beiden Werte. „Unterschiedlich"
// ist höchstens eine Gruppenzusammenfassung (Crew-/Personenansicht) und niemals ein
// persönlicher Eingabewert — das frühere `mixed`-Flag entfällt ersatzlos.
// v6 A19g: „Manchmal" trug bisher denselben Neutralton wie jede andere graue Fläche
// (rgb(167,159,149), rund 9 % Sättigung). Zwei Zustände, die nebeneinander gelesen werden,
// brauchen zwei eigene Farbwerte — deshalb steht dem Grün jetzt ein warmes Amber gegenüber.
const AMBER_SURFACE = 'var(--orange-tint)';
const AMBER_MARK = 'var(--orange)';
const AVAILABILITY_DOT = {
  immer: `<span style="width:20px;height:20px;border-radius:50%;background:var(--green);border:2px solid var(--surface);box-sizing:border-box;display:flex;align-items:center;justify-content:center;flex:none"><svg width="10" height="10" viewBox="0 0 24 24" fill="none"><path d="m6.5 12.5 3.5 3.5 7.5-8" stroke="var(--on-accent)" stroke-width="3" stroke-linecap="round" stroke-linejoin="round"></path></svg></span>`,
  manchmal: `<span style="width:20px;height:20px;border-radius:50%;background:${AMBER_SURFACE};border:2px solid var(--surface);box-sizing:border-box;display:flex;overflow:hidden;flex:none"><span style="width:50%;background:${AMBER_MARK}"></span></span>`,
};

const AVAILABILITY_WORDS = { immer: 'Immer verfügbar', manchmal: 'Manchmal verfügbar' };

// v7 A32b: realistische Kapazitätswerte; 0 ist der NEUTRALE Mittelpunkt und wird als „—"
// gezeigt — „keine Angabe" ist keine Null.
const CAPACITY_VALUES = [0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 12, 15, 20];
const capacityText = (wert) => (Number(wert) > 0 ? String(wert) : '—');

const svgLockSmall = (color = 'var(--muted)') => `<svg width="14" height="14" viewBox="0 0 24 24" fill="none" style="flex:none;pointer-events:none"><rect x="5" y="10.5" width="14" height="9.5" rx="3" stroke="${color}" stroke-width="1.9"></rect><path d="M8.2 10.5V7.8a3.8 3.8 0 0 1 7.6 0v2.7" stroke="${color}" stroke-width="1.9"></path></svg>`;

// Genau zwei erlaubte Werte; Altbestände ('abundzu') laufen sauber auf 'manchmal'.
function availabilityOf(value) {
  const kind = typeof value === 'string' ? value : value?.availability;
  return kind === 'immer' ? 'immer' : 'manchmal';
}

function availabilityCircle(value) {
  return `<span style="display:flex;align-items:center;padding-left:7px;flex:none;pointer-events:none">${AVAILABILITY_DOT[availabilityOf(value)]}</span>`;
}

function capacityCell(capacity) {
  return capacity
    ? `<span style="display:flex;align-items:center;justify-content:flex-end;gap:3px;width:40px;flex:none;pointer-events:none">${svgCapacity}<span style="font-size:12px;font-weight:650;color:var(--ink-soft);font-variant-numeric:tabular-nums">${capacity}</span></span>`
    : `<span style="width:40px;flex:none;pointer-events:none"></span>`;
}

// v4 P0-4-2a: EINE Zeilen-Grammatik für Ressourcen. Vorher baute das Bearbeiten-Sheet
// seine Zeile selbst — nur Icon, Name und eine graue Pille „Details", ohne Freigabe,
// ohne Verfügbarkeits-Kreis, ohne Kapazität — während die Ressourcenliste im Profil all
// das zeigte. Zwei Templates für dieselbe Zeile ist genau die fremde Informationsform,
// die COMPONENT_RULES 4 verbietet. Beide Orte rufen jetzt diese Funktion.
//   entry: { label, availability, capacity }  ·  options.share: Freigabewert
//   options.trailingHtml: nur im Bearbeiten-Sheet (Entfernen-Kreuz), nie in der Anzeige.
function resourceListRow(entry, options = {}) {
  const { act = 'res-open', share, trailingHtml = '' } = options;
  return `<div style="display:flex;align-items:center;gap:2px;border-top:1px solid var(--ink-a05)">
<button data-act="${act}" data-name="${esc(entry.label)}" style="display:flex;align-items:center;gap:10px;padding:11px 0;min-height:44px;box-sizing:border-box;flex:1;min-width:0;border:0;background:transparent;text-align:left;cursor:pointer;appearance:none;font-family:${FONT};color:var(--ink)">
${resourceIconSvg(entry.label, 15, entry.icon)}<span style="font-size:14px;font-weight:600;flex:1;min-width:0;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;pointer-events:none">${esc(wort(entry.label))}</span>
${shareIcon(share)}${availabilityCircle(entry.availability)}${capacityCell(entry.capacity)}${svgRowChevron}</button>${trailingHtml}</div>`;
}

// --- Freigaben je Ressource (v3.1 §6) --------------------------------------------------
// share: 'freunde' | 'privat' | [crewId, …] — wirkt über repo.projectProfile in
// Freundes- und Crew-Ansichten. Ohne Eintrag gilt „freunde".

// v5 A30d: Neben 'freunde' | 'privat' | [crewId…] gibt es jetzt { personen:[personId…] }.
// Ein Objekt statt eines zweiten Arrays, damit Crew- und Personenlisten sich nicht
// verwechseln lassen — die Unterscheidung ist am Wert selbst ablesbar.
function shareKind(share) {
  if (Array.isArray(share)) return 'crews';
  if (share && typeof share === 'object' && Array.isArray(share.personen)) return 'personen';
  if (share === 'privat') return 'privat';
  return 'freunde';
}

// v7 A32g: shareLabel() ist entfallen — der Freigabewert wird nicht mehr je Ressource
// beschrieben, sondern von der zentralen Regel abgeleitet (ruleLabel).

const svgShareFriends = `<svg width="12" height="12" viewBox="0 0 24 24" fill="none" style="flex:none;pointer-events:none"><circle cx="9" cy="8.6" r="3.1" stroke="var(--muted)" stroke-width="1.8"></circle><path d="M3.5 19a5.5 5.5 0 0 1 11 0" stroke="var(--muted)" stroke-width="1.8" stroke-linecap="round"></path><path d="M16.5 6.2a2.9 2.9 0 0 1 0 5.4M17.5 14.4a4.6 4.6 0 0 1 3.2 4.1" stroke="var(--muted)" stroke-width="1.8" stroke-linecap="round"></path></svg>`;
const svgSharePrivate = `<svg width="12" height="12" viewBox="0 0 24 24" fill="none" style="flex:none;pointer-events:none"><rect x="5.5" y="10.5" width="13" height="9" rx="2.6" stroke="var(--muted)" stroke-width="1.8"></rect><path d="M8.5 10.5V8a3.5 3.5 0 0 1 7 0v2.5" stroke="var(--muted)" stroke-width="1.8"></path></svg>`;
const svgShareCrew = `<svg width="12" height="12" viewBox="0 0 24 24" fill="none" style="flex:none;pointer-events:none"><circle cx="8" cy="9" r="2.8" stroke="var(--muted)" stroke-width="1.8"></circle><circle cx="16.4" cy="10.2" r="2.3" stroke="var(--muted)" stroke-width="1.8"></circle><path d="M3 19a5 5 0 0 1 10 0M15 15.2a4.3 4.3 0 0 1 5 3.8" stroke="var(--muted)" stroke-width="1.8" stroke-linecap="round"></path></svg>`;

function shareIcon(share) {
  const kind = shareKind(share);
  return kind === 'privat' ? svgSharePrivate : kind === 'crews' ? svgShareCrew : svgShareFriends;
}

// v5 A30d: „Markierte Freunde" = beste Freund:innen plus die besondere Person.
function markedFriendIds(settings) {
  return [...(settings.bestFriendIds || []), settings.specialPerson?.personId].filter(Boolean);
}

// ---------------------------------------------------------------------------------------
// v7 A32g (spec/06 §2): Die allgemeine Freigaberegel liegt EINMALIG in den Einstellungen.
// Je Ressource bleibt nur noch ein Schalter „privat". Damit die Regel wirklich WIRKT und
// nicht wieder ein folgenloser Regler wird (genau der Fehler, den v4 hier beseitigt hat),
// wird sie auf den einen Wert projiziert, den der Gateway-Filter isSharedWith() liest:
// resourceShares[label]. Es gibt also weiterhin genau eine wirksame Datenquelle.
// ---------------------------------------------------------------------------------------
const SHARE_RULE_DEFAULT = { general: { mode: 'alle', ids: [] }, private: { mode: 'ich', ids: [] } };

// R1 §7 „Sichtbarkeit ist unklar": Es gibt nur noch EINE Regel zum Einstellen.
// Alle Freunde sehen die Ressourcen — das ist fest. Eingeschränkt ist ausschliesslich,
// was ausdrücklich als privat markiert wurde; NUR dort wählt man, wer es sieht.
// Die zweite, gleich aussehende Regel für die nicht markierten Ressourcen ist entfallen:
// sie konnte nichts, was das Privat-Schloss nicht besser kann, und machte beide unklar.
function shareRules(settings) {
  const gespeichert = settings.resourceSharing || {};
  return {
    general: { ...SHARE_RULE_DEFAULT.general },
    private: { ...SHARE_RULE_DEFAULT.private, ...(gespeichert.private || {}) },
  };
}

const SHARE_RULE_WORDS = {
  alle: tx('Alle Freunde'),
  markierte: MARKED_FRIENDS_LABEL,
  individuell: tx('Individuell'),
  ich: tx('Nur ich'),
};

function ruleValue(regel, settings) {
  if (regel.mode === 'ich') return 'privat';
  if (regel.mode === 'alle') return 'freunde';
  if (regel.mode === 'markierte') return { personen: markedFriendIds(settings) };
  return { personen: [...(regel.ids || [])] };
}

function ruleLabel(regel, repo) {
  if (regel.mode !== 'individuell') return SHARE_RULE_WORDS[regel.mode] || SHARE_RULE_WORDS.alle;
  const ids = regel.ids || [];
  if (!ids.length) return tx('Individuell · niemand');
  if (ids.length === 1) return repo.getPeople().find((person) => person.id === ids[0])?.name || tx('Individuell · {n}', { n: 1 });
  return tx('Individuell · {n}', { n: ids.length });
}

function isResourcePrivate(settings, label) {
  return Boolean((settings.resourcePrivate || {})[label]);
}

// Schreibt die Regeln auf jede Ressource durch. Ein zusätzlicher Patch (z. B. eine neue
// Ressourcenliste) wird im SELBEN Aufruf mitgeschrieben, damit nie ein Zwischenstand
// entsteht, in dem Liste und Freigaben auseinanderlaufen.
function projiziereFreigaben(repo, patch = {}) {
  const settings = { ...repo.getSettings(), ...patch };
  const regeln = shareRules(settings);
  const privat = settings.resourcePrivate || {};
  const shares = {};
  for (const label of settings.resources || []) {
    shares[label] = ruleValue(privat[label] ? regeln.private : regeln.general, settings);
  }
  repo.updateSettings({ ...patch, resourceShares: shares });
}

// v7 A33a/A35b: Einmalige Angleichung des Demozustands an die verbindlichen v7-Vorgaben.
// Die Werte stehen als Literale im Seed (web/data/seed/profile.js) — einer fremden Datei.
// Diese Migration setzt sie GENAU EINMAL nach und markiert das im Zustand, damit eine
// spätere eigene Entscheidung der Nutzerin nie wieder überschrieben wird.
let defaultsGeplant = false;

function v7ProfilDefaults(repo) {
  if (defaultsGeplant || repo.getSettings().v7Defaults) return false;
  // WICHTIG: Der Schreibvorgang darf NICHT mitten im Binden laufen. Ein repo-Schreiben
  // loest sofort einen verschachtelten Renderlauf aus, und dessen Bindung setzt in
  // app.js/bindeEinmalig nur die Merker (__ev_*), waehrend der aeussere, noch aktive
  // Waechter das eigentliche addEventListener abweist — gemessen am Erinnerungs-Wheel:
  // Merker gesetzt, aber 0 Ereignisse. Deshalb laeuft die Migration erst nach dem
  // aktuellen Durchgang.
  defaultsGeplant = true;
  window.setTimeout(() => { defaultsGeplant = false; v7DefaultsSchreiben(repo); }, 0);
  return false;
}

function v7DefaultsSchreiben(repo) {
  const settings = repo.getSettings();
  if (settings.v7Defaults) return false;
  const interests = (settings.interests || []).map((label) => (label === 'See' ? 'Baden' : label));
  const levels = { ...(settings.interestLevels || {}) };
  if (levels.See !== undefined) { levels.Baden = levels.See; delete levels.See; }
  const privat = {};
  for (const label of settings.resources || []) {
    if (shareKind((settings.resourceShares || {})[label]) === 'privat') privat[label] = true;
  }
  projiziereFreigaben(repo, {
    v7Defaults: true,
    activityStatus: 'zeigen',
    visibility: { ...(settings.visibility || {}), unknownProfile: 'profil' },
    location: { ...(settings.location || {}), use: false, shareMode: 'alle', shareIds: [] },
    interests,
    interestLevels: levels,
    resourcePrivate: privat,
    resourceSharing: shareRules(settings),
  });
  return true;
}

// Kreis-Punkt-Dekor der Einladungs-Slide-ups (reference 06.3/06.3b).
const sheetDecor = `<span style="position:absolute;left:-90px;top:-64px;width:230px;height:230px;border-radius:50%;border:15px solid var(--ink-a05);box-sizing:border-box;pointer-events:none"></span><span style="position:absolute;left:124px;top:112px;width:44px;height:44px;border-radius:50%;background:var(--green-a12);pointer-events:none"></span>`;
// v5 A20: Der Griff ist zusätzlich die Zieh-Fläche (data-qr-grab) — ein Tap schaltet
// weiterhin um, ein Zug verändert die Höhe stufenlos.
const grabber = (act) => `<button data-act="${act}" data-qr-grab aria-label="${esc(tx('Ziehen'))}" style="display:block;width:100%;padding:6px 0;border:0;background:transparent;cursor:grab;appearance:none;position:relative;flex:none;touch-action:none"><span style="display:block;width:36px;height:4px;border-radius:2px;background:var(--handle);margin:0 auto;pointer-events:none"></span></button>`;

function initialsOf(name) {
  const clean = (name || '').trim();
  if (!clean) return '–';
  const parts = clean.split(/\s+/);
  if (parts.length >= 2) return (parts[0][0] + parts[1][0]).toUpperCase();
  return clean[0].toUpperCase() + (clean[1] || '').toLowerCase();
}

// --- Überlappender Avatar-Stapel (v3.1 §6 / RUNTIME_QUALITY_CONTRACT §2) ---------------
// Drei getrennte Ebenen:
//   0  technischer Separator (weiße Scheibe UNTER dem Avatar) — er trennt nur die
//      Überlappung. Ist der Avatar aktiv, wird er durch die grüne Außenkante ERSETZT,
//      damit beim aktiven Meet nie ein weißer Trennring durchscheint.
//   1  der Avatar selbst mit nach innen laufendem Aktiv-Fade.
//   2  bewusstes semantisches Kennzeichen (ruhiger goldener Ring für Besten Freund) —
//      es darf sichtbar über allem liegen.
// v4 P0-3-10: Der Stapel liest die Markierung aus derselben Quelle wie jede andere
// Ansicht (`personMarker`). Vorher waren `best`/`active` zwar vorhanden, wurden aber an
// keiner Aufrufstelle gesetzt — der semantische Layer war toter Code, und dieselbe Person
// trug in der Liste einen Goldring, im Stapel darüber keinen.
// Fable 4 (J2/J3): Der Stapel zeichnet dieselbe Avatar-Unit wie jede Zeile (personAvatar) —
// Frei-Punkt, Aktiv-Fade und Zeichen kommen aus der einen Regel. Der Trenner bleibt eine
// Scheibe HINTER dem Avatar; ist die Person aktiv, ist sie grün statt weiß.
function stackAvatar(person, options = {}) {
  const size = options.size || 38;
  const first = Boolean(options.first);
  const active = options.active ?? Boolean(person.activeMeetId);
  const marker = options.marker || null;
  const fontSize = options.fontSize || Math.round(size * 0.37);
  const separator = `<span style="position:absolute;inset:-2px;border-radius:50%;background:${active ? 'var(--green)' : 'var(--surface)'};z-index:0"></span>`;
  return `<span style="position:relative;display:block;width:${size}px;height:${size}px;flex:none;${first ? '' : `margin-left:-${Math.round(size * 0.21)}px;`}">
${separator}
<span style="position:relative;z-index:1;display:block">${personAvatar(person, { size, fontSize, active, marker, dotBorder: 'var(--surface)' })}</span></span>`;
}
// v4 P0-3-10: EIN Weg, wie ein Stapel an seine Markierung kommt. Personenzeilen und
// Stapel lesen damit dieselbe Quelle; eine Anfrage (noch kein Freund) liefert korrekt
// keine Markierung, ein markierter Freund im Stapel dagegen schon.
function stackMarker(repo, person) {
  const id = person?.personId || person?.id;
  if (!id || !repo) return null;
  return personMarker(id, repo.getSettings());
}

// Restzähler im Stapel (gleiche Ebenenordnung, ohne semantisches Kennzeichen).
function stackMore(count, size = 38) {
  if (count <= 0) return '';
  return `<span style="position:relative;display:block;width:${size}px;height:${size}px;flex:none;margin-left:-${Math.round(size * 0.21)}px">
<span style="position:absolute;inset:-2px;border-radius:50%;background:var(--surface);z-index:0"></span>
<span style="position:relative;z-index:1;display:block;width:${size}px;height:${size}px;border-radius:50%;background:var(--field);color:var(--muted);font:600 ${Math.round(size * 0.34)}px/${size}px ${FONT};text-align:center">+${count}</span></span>`;
}

function subHeader(title, rightHtml = '') {
  return `<div style="display:flex;align-items:center;gap:10px;padding:12px 20px 14px">
<button data-act="back" data-treffer aria-label="${esc(tx('Zurück'))}" style="display:flex;align-items:center;padding:0;border:0;background:transparent;cursor:pointer;appearance:none">${backArrow('var(--ink)', 22)}</button>
<span style="font-family:${BRICOLAGE};font-size:22px;font-weight:650">${esc(title)}</span>${rightHtml}</div>`;
}

function groupLabel(text) {
  return `<span style="font-size:10.5px;font-weight:650;letter-spacing:.09em;text-transform:uppercase;color:var(--muted-light);padding-left:4px">${esc(text)}</span>`;
}

function navRow({ act, data = {}, label, valueHtml = '', last = false }) {
  const attrs = Object.entries(data).map(([k, v]) => `data-${k}="${esc(v)}"`).join(' ');
  return `<button data-act="${act}" ${attrs} style="display:flex;justify-content:space-between;align-items:center;gap:10px;padding:13px 16px;width:100%;border:0;${last ? '' : 'border-bottom:1px solid var(--ink-a06);'}background:transparent;text-align:left;cursor:pointer;appearance:none;font-family:${FONT};color:var(--ink)">
<span style="font-size:14px;font-weight:600;pointer-events:none">${esc(label)}</span>
<span style="display:flex;gap:8px;align-items:center;pointer-events:none">${valueHtml}${chevron}</span></button>`;
}

function groupCard(rowsHtml) {
  return `<div style="background:var(--surface);border-radius:18px;border:1px solid var(--ink-a07);overflow:hidden">${rowsHtml}</div>`;
}

function choiceCard(label, rowsHtml) {
  return `<div style="background:var(--surface);border-radius:20px;border:1px solid var(--ink-a07);padding:6px 16px">
<div style="padding:10px 0 4px"><span style="font-size:11px;font-weight:650;letter-spacing:.09em;text-transform:uppercase;color:var(--muted-light)">${esc(label)}</span></div>${rowsHtml}</div>`;
}

function radioMark(selected) {
  return selected
    ? `<span style="width:20px;height:20px;border-radius:50%;background:var(--green);display:flex;align-items:center;justify-content:center;flex:none;pointer-events:none"><span style="width:7px;height:7px;border-radius:50%;background:var(--surface)"></span></span>`
    : `<span style="width:20px;height:20px;border-radius:50%;border:1.8px solid var(--line-solid);box-sizing:border-box;flex:none;pointer-events:none"></span>`;
}

// v5 A31a: `disabled` macht eine Zeile SICHTBAR unbedienbar — blasser, grau, ohne
// Zeiger und mit echtem disabled-Attribut, damit auch die Tastatur nicht hineinkommt.
function radioRow({ act, data = {}, selected, label, hintHtml = '', disabled = false }) {
  const attrs = Object.entries(data).map(([k, v]) => `data-${k}="${esc(v)}"`).join(' ');
  return `<button data-act="${act}" ${attrs}${disabled ? ' disabled aria-disabled="true"' : ''} style="display:flex;align-items:center;gap:11px;padding:11px 0;width:100%;border:0;border-top:1px solid var(--ink-a05);background:transparent;text-align:left;${disabled ? 'cursor:default;opacity:.42;pointer-events:none;' : 'cursor:pointer;'}appearance:none;font-family:${FONT};color:${disabled ? 'var(--muted)' : 'var(--ink)'}">
${radioMark(selected)}<span style="font-size:14px;font-weight:${selected ? 650 : 600};${selected && !disabled ? '' : 'color:var(--ink-soft);'}flex:1;pointer-events:none">${esc(label)}</span>${hintHtml}</button>`;
}

// v7 A33a: Der „Standard"-Chip haengt am tatsaechlichen Standardwert, nicht mehr fest an
// der Zeile „Nur aktiv".
function standardChip() {
  return `<span style="font-size:10px;font-weight:650;letter-spacing:.05em;text-transform:uppercase;color:var(--green-dark);background:var(--green-tint);padding:3px 7px;border-radius:6px;flex:none;pointer-events:none">${tx('Standard')}</span>`;
}

function hintSpan(text) {
  return `<span style="font-size:11.5px;color:var(--muted);pointer-events:none">${esc(text)}</span>`;
}

// Radio-Zeile mit Beschreibungstext (+ optionalem „Standard"-Chip, reference 06.5).
function radioRowRich({ act, data = {}, selected, label, sub, standard = false }) {
  const attrs = Object.entries(data).map(([k, v]) => `data-${k}="${esc(v)}"`).join(' ');
  const chip = standard
    ? `<span style="font-size:10px;font-weight:650;letter-spacing:.05em;text-transform:uppercase;color:var(--green-dark);background:var(--green-tint);padding:3px 7px;border-radius:6px;flex:none;margin-top:1px;pointer-events:none">${tx('Standard')}</span>`
    : '';
  return `<button data-act="${act}" ${attrs} style="display:flex;align-items:flex-start;gap:11px;padding:12px 0;width:100%;border:0;border-top:1px solid var(--ink-a05);background:transparent;text-align:left;cursor:pointer;appearance:none;font-family:${FONT};color:var(--ink)">
<span style="margin-top:1px;display:flex;pointer-events:none">${radioMark(selected)}</span>
<div style="display:flex;flex-direction:column;gap:2px;flex:1;min-width:0;pointer-events:none">
<span style="font-size:14px;font-weight:${selected ? 650 : 600};${selected ? '' : 'color:var(--ink-soft);'}">${esc(label)}</span>
<span style="font-size:11.5px;color:var(--muted);line-height:1.4;text-wrap:pretty">${esc(sub)}</span>
</div>${chip}</button>`;
}

function toggleSwitch(on, act, data = {}) {
  const attrs = Object.entries(data).map(([k, v]) => `data-${k}="${esc(v)}"`).join(' ');
  return `<button data-act="${act}" ${attrs} data-treffer role="switch" aria-checked="${on}" style="width:40px;height:24px;border-radius:12px;background:${on ? 'var(--green)' : '#DDD7CC'};position:relative;flex:none;border:0;padding:0;cursor:pointer;appearance:none"><span style="position:absolute;${on ? 'right' : 'left'}:3px;top:3px;width:18px;height:18px;border-radius:50%;background:var(--surface);box-shadow:0 1px 3px var(--shadow-20);pointer-events:none"></span></button>`;
}

// Personen-Auswahlzeile (reference 06.6: eingerückt, 28px-Avatar, Haken-Kreis)
function pickPersonRow({ act, person, selected }) {
  return `<button data-act="${act}" data-person="${person.id}" style="display:flex;align-items:center;gap:11px;padding:9px 0 9px 31px;width:100%;border:0;border-top:1px solid var(--ink-a05);background:transparent;text-align:left;cursor:pointer;appearance:none;font-family:${FONT};color:var(--ink)">
<span style="pointer-events:none;display:contents">${personAvatar(person, { size: 28, fontSize: 10.5 })}</span>
<span style="font-size:13.5px;font-weight:600;${selected ? '' : 'color:var(--ink-soft);'}flex:1;pointer-events:none">${esc(person.name)}</span>
${selected ? svgCheckedCircle : emptyCircle}</button>`;
}

function copyToClipboard(text) {
  try {
    if (navigator.clipboard?.writeText) navigator.clipboard.writeText(text).catch(() => {});
  } catch { /* Demo: still */ }
}

// ============================================================================
// 06.1 Profil (profile.home)
// ============================================================================

function interestDots(level) {
  let dots = '';
  for (let i = 0; i < 3; i++) {
    dots += `<span style="width:7px;height:7px;border-radius:50%;background:${i < level ? 'var(--green)' : 'var(--field-deep)'}"></span>`;
  }
  return `<span style="display:flex;gap:3px;flex:none;pointer-events:none">${dots}</span>`;
}

// v6 A19c: Ein Interesse ist antippbar wie eine Ressource — gleiche Zeilenordnung
// (Name links, Bewertung rechts, Chevron), damit beide Listen sich gleich bedienen lassen.
function interestListRow(entry) {
  return `<button data-act="int-open" data-name="${esc(entry.label)}" style="display:flex;align-items:center;gap:10px;padding:9px 0;min-height:44px;box-sizing:border-box;width:100%;border:0;border-top:1px solid var(--ink-a05);background:transparent;text-align:left;cursor:pointer;appearance:none;font-family:${FONT};color:var(--ink)">
<span style="font-size:14px;font-weight:600;flex:1;min-width:0;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;pointer-events:none">${esc(wort(entry.label))}</span>
${interestDots(entry.level)}${svgRowChevron}</button>`;
}

// v7 A31: Das Anlegen gehört auf die HÖHE DES ABSCHNITTSTITELS — ein kleiner runder
// Plus-Knopf rechts. Die v6-Plus-Zeile innerhalb der Liste ist entfallen: sie sah aus wie
// ein Eintrag und stand zwischen den echten Einträgen. Der Fuß-Knopf („Alle …") erscheint
// nur, wenn es wirklich mehr gibt als die Vorschau zeigt — sonst führt er ins Leere.
function addRoundButton(act, label) {
  return `<button data-act="${act}" data-treffer aria-label="${esc(label)}" title="${esc(label)}" style="width:28px;height:28px;border-radius:50%;background:var(--green-tint);border:0;display:flex;align-items:center;justify-content:center;flex:none;cursor:pointer;appearance:none;padding:0"><span style="pointer-events:none;display:flex">${plus('var(--green-dark)', 15)}</span></button>`;
}

function profileBox({ label, rowsHtml, footAct, footLabel, addAct, addLabel, showFoot = true }) {
  return `<div style="flex:none;background:var(--surface);border:1.5px solid var(--ink-a09);border-radius:20px;padding:2px 16px 0;box-shadow:0 1px 2px var(--shadow-05)">
<div style="display:flex;justify-content:space-between;align-items:center;gap:10px;padding:8px 0 6px;min-height:30px;box-sizing:border-box"><span style="font-size:11px;font-weight:650;letter-spacing:.09em;text-transform:uppercase;color:var(--muted-light)">${esc(label)}</span>${addAct ? addRoundButton(addAct, addLabel) : ''}</div>
${rowsHtml}
${showFoot ? `<button data-act="${footAct}" style="display:flex;align-items:center;justify-content:center;padding:11px 0;min-height:44px;box-sizing:border-box;width:100%;border:0;border-top:1px solid var(--ink-a05);background:transparent;cursor:pointer;appearance:none"><span style="font-size:12.5px;font-weight:650;color:var(--green-dark);pointer-events:none">${esc(footLabel)}</span></button>` : ''}
</div>`;
}

// --- Runde 4 (B5): Keine Zeit ------------------------------------------------------------
// Jonathan: „Montags bis donnerstags von x bis y und am Freitag x bis y … diese Uhrzeiten hab ich
// Arbeit." Mehrere Zeitfenster, jede Woche wieder (settings.belegt, web/core/belegt.js). Freunde
// sehen davon nur „Keine Zeit bis …" — nie den Plan und nie, was man macht.
const BELEGT_STUNDEN = Array.from({ length: 24 }, (_, i) => i);
const BELEGT_MINUTEN = Array.from({ length: 12 }, (_, i) => i * 5);
const BELEGT_VORLAGEN = [
  { tage: [1, 2, 3, 4, 5] },
  { tage: [6, 0], name: tx('Wochenende') },
  { tage: [0, 1, 2, 3, 4, 5, 6] },
];

function belegtSortiert(liste) {
  const erster = (fenster) => Math.min(...fenster.tage.map((tag) => WOCHE_AB_MONTAG.indexOf(tag)));
  return [...liste].sort((a, b) => erster(a) - erster(b) || a.von.localeCompare(b.von));
}

// Die Räder stehen auf 5-Minuten-Schritten — ein anders gespeicherter Wert rastet beim Öffnen ein.
function aufFuenfMinuten(hhmm) {
  const [h, m] = String(hhmm || '').split(':').map(Number);
  let stunde = Number.isFinite(h) ? h : 8;
  let minute = Math.round((Number.isFinite(m) ? m : 0) / 5) * 5;
  if (minute === 60) { minute = 0; stunde = (stunde + 1) % 24; }
  return `${String(stunde).padStart(2, '0')}:${String(minute).padStart(2, '0')}`;
}

// Runde 5 (B5, Jonathan: „Bei Busy ist sehr viel Text, etwas zu viel."): Die Karte sagt dasselbe mit
// weniger Wörtern — über ihr steht schon „Keine Zeit", der Hinweis rechts nennt deshalb nur noch
// „bis 18:00"; der Satz zur Privatsphäre ist eine kurze Zeile.
function belegtBox(settings) {
  const liste = belegtBereinigen(settings.belegt);
  const jetzt = belegtJetzt(liste);
  const status = jetzt.belegt
    ? `<span data-role="belegt-jetzt" style="font-size:11px;font-weight:650;color:var(--ink-soft);background:var(--field);padding:4px 9px;border-radius:999px;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;min-width:0">${esc(belegtBisText(jetzt))}</span>`
    : '';
  const zeilen = liste.length
    ? liste.map((fenster, index) => `<button data-act="belegt-open" data-index="${index}" style="display:flex;align-items:center;gap:10px;padding:11px 0;min-height:44px;width:100%;border:0;border-top:1px solid var(--ink-a05);background:transparent;text-align:left;cursor:pointer;appearance:none;font-family:${FONT};color:var(--ink)">
<span style="font-size:14px;font-weight:600;flex:1;min-width:0;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;pointer-events:none">${esc(tageText(fenster.tage))}</span>
<span style="font-size:13.5px;font-weight:600;color:var(--ink-soft);font-variant-numeric:tabular-nums;pointer-events:none;white-space:nowrap">${esc(fenster.von)}–${esc(fenster.bis)}</span>${svgRowChevron}</button>`).join('')
    : `<button data-act="belegt-add" style="display:flex;align-items:center;gap:10px;padding:11px 0;min-height:44px;width:100%;border:0;border-top:1px solid var(--ink-a05);background:transparent;text-align:left;cursor:pointer;appearance:none;font-family:${FONT};color:var(--ink)">
<span style="display:flex;flex-direction:column;gap:2px;flex:1;min-width:0;pointer-events:none"><span style="font-size:14px;font-weight:600">${tx('Feste Zeiten eintragen')}</span><span style="font-size:11.5px;color:var(--muted);line-height:1.35">${tx('Arbeit, Schule, Training')}</span></span>${svgRowChevron}</button>`;
  return `<div data-role="belegt-box" style="flex:none;background:var(--surface);border:1.5px solid var(--ink-a09);border-radius:20px;padding:2px 16px 0;box-shadow:0 1px 2px var(--shadow-05)">
<div style="display:flex;align-items:center;gap:8px;padding:8px 0 6px;min-height:30px;box-sizing:border-box"><span style="font-size:11px;font-weight:650;letter-spacing:.09em;text-transform:uppercase;color:var(--muted-light);flex:none">${tx('Keine Zeit')}</span><span style="flex:1;min-width:0;display:flex;justify-content:flex-end">${status}</span>${addRoundButton('belegt-add', tx('Zeiten hinzufügen'))}</div>
${zeilen}
<div style="display:flex;align-items:center;gap:7px;padding:10px 0 12px;border-top:1px solid var(--ink-a05)">${svgLockSmall('var(--muted-light)')}<span style="font-size:11.5px;color:var(--muted);line-height:1.4">${tx('Freunde sehen nur „Keine Zeit“.')}</span></div>
</div>`;
}

// Eigene Daten in EINER Projektion lesen (v3.1 §6): Interessen absteigend nach echter
// Punktebewertung, Ressourcen nach Verfügbarkeit — dieselbe Gateway-Regel wie in Freundes-
// und Crew-Ansichten, nur ohne Freigabefilter (im eigenen Profil sieht man alles).
function ownProfile(repo) {
  const settings = repo.getSettings();
  return repo.projectProfile({
    ...repo.getMe(),
    interests: settings.interests || [],
    interestLevels: settings.interestLevels || {},
    resources: settings.resources || [],
    resourceMeta: settings.resourceMeta || {},
    resourceShares: {}, // eigenes Profil: keine Projektion, alles sichtbar
  }, {}) || { interestList: [], resourceList: [] };
}

// Runde 5 (C2, Jonathan: „Freundesanfragen sollen stärker kommuniziert werden."): Offene Anfragen
// stehen ganz oben im Profil — mit Bild, Name, woher sie kommen, und „Annehmen"/„Ablehnen" direkt in
// der Karte. Vorher verriet sie nur ein oranger Punkt am Knopf „Freund hinzufügen". Beide Knöpfe sind
// 44 px hoch und je halb so breit wie die Karte; es gelten dieselben Aktionen wie auf der Seite
// „Anfragen" (requestActs). Mehr als zwei Anfragen: „Alle Anfragen (n)" führt dorthin.
const ANFRAGEN_VORSCHAU = 2;

function anfragenKarte(ctx) {
  const { repo } = ctx;
  const requests = repo.getFriendRequests() || [];
  if (!requests.length) return '';
  const zeilen = requests.slice(0, ANFRAGEN_VORSCHAU).map((request, index) => `<div data-role="anfrage" data-request="${esc(request.id)}" style="display:flex;flex-direction:column;gap:11px;padding:12px 0 14px;${index ? 'border-top:1px solid var(--ink-a06);' : ''}">
<div style="display:flex;align-items:center;gap:12px;min-width:0">
${stackAvatar(request, { size: 44, fontSize: 16, first: true, marker: stackMarker(repo, request) })}
<div style="display:flex;flex-direction:column;gap:2px;flex:1;min-width:0"><span data-role="anfrage-name" style="font-size:15px;font-weight:650;white-space:nowrap;overflow:hidden;text-overflow:ellipsis">${esc(request.name)}</span><span style="font-size:12px;color:var(--muted);white-space:nowrap;overflow:hidden;text-overflow:ellipsis">${esc(request.meta || tx('über Link'))}</span></div>
</div>
<div style="display:flex;gap:8px">
<button data-act="req-decline" data-request="${esc(request.id)}" style="flex:1 1 0;min-width:0;height:44px;border-radius:999px;border:1.5px solid var(--ink-a14);background:var(--surface);box-sizing:border-box;font:650 14px/1 ${FONT};color:var(--ink-soft);cursor:pointer;appearance:none">${tx('Ablehnen')}</button>
<button data-act="req-accept" data-request="${esc(request.id)}" style="flex:1 1 0;min-width:0;height:44px;border-radius:999px;border:0;background:var(--green);font:650 14px/1 ${FONT};color:var(--on-accent);cursor:pointer;appearance:none">${tx('Annehmen')}</button>
</div></div>`).join('');
  const mehr = requests.length > ANFRAGEN_VORSCHAU
    ? `<button data-act="go-requests" style="display:flex;align-items:center;justify-content:center;width:100%;min-height:44px;padding:0;border:0;border-top:1px solid var(--ink-a06);background:transparent;cursor:pointer;appearance:none"><span style="font:650 12.5px ${FONT};color:var(--green-dark);pointer-events:none">${tx('Alle Anfragen ({n})', { n: requests.length })}</span></button>`
    : '';
  return `<div data-role="anfragen-karte" style="flex:none;margin:6px 24px 4px;background:var(--surface);border:1.5px solid var(--orange-a40);border-radius:20px;padding:4px 16px 0;box-shadow:0 1px 2px var(--shadow-05)">
<div style="display:flex;align-items:center;gap:8px;padding:10px 0 0;min-height:24px">
<span style="font-size:11px;font-weight:650;letter-spacing:.09em;text-transform:uppercase;color:var(--ink-soft);flex:1;min-width:0">${tx('Freundesanfragen')}</span>
<span style="min-width:22px;height:22px;border-radius:11px;background:var(--orange);color:var(--on-accent);font:650 12px/22px ${FONT};text-align:center;padding:0 6px;box-sizing:border-box;flex:none">${requests.length}</span>
</div>
${zeilen}${mehr}</div>`;
}

// v6 A20a: „Freund hinzufügen" sitzt wieder OBEN RECHTS neben den Einstellungen. Als
// schwebende Pille unten links lag der Einstieg messbar über der Ressourcenliste und
// verdeckte Inhalt, den man gerade lesen wollte. Der offene-Anfragen-Punkt wandert mit.
function homeHeader(ctx) {
  const openRequests = (ctx.repo.getFriendRequests() || []).length;
  const dot = openRequests
    ? `<span style="position:absolute;right:-1px;top:-1px;width:12px;height:12px;border-radius:50%;background:var(--orange);border:2.5px solid var(--paper);box-sizing:border-box;pointer-events:none"></span>`
    : '';
  const rundKnopf = (act, aria, inner, extra = '') => `<button data-act="${act}" data-treffer aria-label="${aria}" style="position:relative;width:36px;height:36px;border-radius:50%;background:var(--surface);border:1.5px solid var(--ink-a10);display:flex;align-items:center;justify-content:center;cursor:pointer;appearance:none;padding:0;flex:none"><span style="pointer-events:none;display:flex">${inner}</span>${extra}</button>`;
  // v4 A.4: gemeinsame Kopfachse. Der Profil-Tab trägt jetzt auch einen Titel, damit
  // die Achse tatsächlich dieselbe ist und beim Wechsel kein Sprung entsteht.
  return tabHeader(
    `<span style="font-family:'Bricolage Grotesque',sans-serif;font-size:22px;font-weight:650">${tx('Profil')}</span>`,
    `${rundKnopf('go-friend-add', esc(tx('Freund hinzufügen')), svgPersonPlus, dot)}${rundKnopf('go-settings', esc(tx('Einstellungen')), svgGear)}`,
  );
}

// v3.1 §1: EIN Inhaltskörper — Profilkopf, Interessen, Ressourcen und Meine Meets
// scrollen gemeinsam. Keine zusätzliche Scrollfläche, kein beiger Zwischenblock.
function homeBody(ctx) {
  const { repo, ui } = ctx;
  const settings = repo.getSettings();
  const projected = ownProfile(repo);
  const interests = projected.interestList || [];
  const resources = projected.resourceList || [];
  const shares = settings.resourceShares || {};
  // v7 A31: höchstens DREI Interessen in der Vorschau (spec/06 §1).
  const shownInterests = ui.allInterests ? interests : interests.slice(0, INTEREST_PREVIEW);
  const shownResources = ui.allResources ? resources : resources.slice(0, RESOURCE_PREVIEW);

  // v6 A19c: dieselbe Zeilen-Grammatik wie bei den Ressourcen — antippbar, mit Chevron.
  const interestRows = shownInterests.map(interestListRow).join('');

  const resourceRows = shownResources
    .map((entry) => resourceListRow(entry, { share: shares[entry.label] }))
    .join('');

  const meetCount = repo.getMeets({ context: { mine: true }, direction: 'history' }).length;

  // v7 A36/spec 08 §1: Auch das eigene Profilbild kommt aus der EINEN kanonischen Quelle
  // (repo.getMe()). Vorher stand hier eine handgeschriebene Farbscheibe, die ein Foto
  // niemals gezeigt hätte.
  const me = repo.getMe();

  return `${anfragenKarte(ctx)}<div style="display:flex;flex-direction:column;align-items:center;gap:12px;padding:10px 24px 18px">
<button data-act="edit-profile" aria-label="${esc(tx('Profil bearbeiten'))}" style="position:relative;border:0;background:transparent;padding:0;cursor:pointer;appearance:none"><span style="pointer-events:none;display:contents">${personAvatar(me, { size: 92, fontSize: 30 })}</span><span style="position:absolute;right:-3px;bottom:-1px;width:28px;height:28px;border-radius:50%;background:var(--surface);border:1px solid var(--ink-a10);box-shadow:0 2px 6px var(--shadow-14);display:flex;align-items:center;justify-content:center;pointer-events:none;z-index:6">${svgPencilSmall(12)}</span></button>
<span style="font-family:${BRICOLAGE};font-size:25px;font-weight:650">${esc(settings.name)}</span>
</div>
<div style="display:flex;flex-direction:column;gap:12px;padding:0 24px">
${profileBox({
    label: tx('Interessen'), rowsHtml: interestRows,
    addAct: 'int-add-row', addLabel: tx('Interesse hinzufügen'),
    showFoot: ui.allInterests || interests.length > INTEREST_PREVIEW,
    footAct: 'toggle-interests', footLabel: ui.allInterests ? tx('Weniger anzeigen') : tx('Alle Interessen ({n})', { n: interests.length }),
  })}
${profileBox({
    label: tx('Ressourcen'), rowsHtml: resourceRows,
    addAct: 'res-add-row', addLabel: tx('Ressource hinzufügen'),
    showFoot: ui.allResources || resources.length > RESOURCE_PREVIEW,
    footAct: 'toggle-resources', footLabel: ui.allResources ? tx('Weniger anzeigen') : tx('Alle Ressourcen ({n})', { n: resources.length }),
  })}
${belegtBox(settings)}
<button data-act="go-my-meets" style="background:var(--surface);border:1.5px solid var(--ink-a09);border-radius:20px;padding:14px 16px;display:flex;align-items:center;gap:11px;box-shadow:0 1px 2px var(--shadow-05);flex:none;width:100%;cursor:pointer;appearance:none;text-align:left;font-family:${FONT};color:var(--ink)">
<span style="pointer-events:none;display:flex">${svgMyMeets}</span>
<span style="font-size:14.5px;font-weight:650;flex:1;pointer-events:none">${tx('Meine Meets')}</span>
<span style="font-size:12.5px;color:var(--muted);font-variant-numeric:tabular-nums;pointer-events:none">${meetCount}</span>${chevron}
</button>
</div>`;
}

// Bottom-Ebene (v3.1 §1): weicher Auslauf, darunter die echte Hauptnavigation. Sie deckt
// deckend ab — Inhalt läuft sichtbar unter die Leiste, blendet davor aber weich aus,
// statt als Geisterschrift durchzuscheinen. Gleiche Konvention wie im Meet-Tab.
const TABBAR_INSET = 88;
const CONTENT_INSET = 24;

function navBottom(ctx, tab = 'profil') {
  const openRequests = (ctx.repo.getFriendRequests() || []).length;
  return `${bottomFade(30)}
<div style="pointer-events:auto;background:var(--paper)">${tabBar(tab, { dot: openRequests > 0 })}</div>`;
}

// v4 P0-1: profile.home ist eine Seite in der Tab-Bahn — die Bottom-Navigation steht
// außerhalb, in der App-Chrome.
//
// v6 A20a: Die schwebende Pille „Hinzufügen" unten links ist entfallen — sie lag über der
// Ressourcenliste (gemessen bis 3792 px² Überdeckung). Der Einstieg steht jetzt oben
// rechts in homeHeader; unten bleibt nur die Hauptnavigation.

// v7 A31: Die Plus-ZEILE innerhalb der Liste ist ersatzlos entfallen (spec/06 §1). Der
// Einstieg ist jetzt der runde Knopf auf Höhe des Abschnittstitels (addRoundButton).

// v5 A30b: Ein BREITER Schalter mit bewegtem Knauf statt zweier konkurrierender
// Radiozeilen. Der Knauf fährt über transform, deshalb animiert der Wechsel wirklich —
// der Knoten bleibt beim In-Place-Abgleich derselbe und die Transition läuft.
function availabilitySlider(value) {
  const always = availabilityOf(value) === 'immer';
  // v7 A32a: Editor und Liste führen DASSELBE Zeichen. Vorher trug der Editor zwei reine
  // Textsegmente, während die Ressourcenliste den grünen Haken und den warmen Halbkreis
  // zeigte — zwei Darstellungen für denselben Zustand.
  const seg = (kind, label, active) => `<button data-act="res-avail" data-kind="${kind}" aria-pressed="${active}" style="position:relative;z-index:1;flex:1;border:0;background:transparent;padding:0;height:38px;cursor:pointer;appearance:none;display:flex;align-items:center;justify-content:center;gap:7px;font:${active ? 650 : 600} 13.5px ${FONT};color:${active ? 'var(--green-dark)' : 'var(--ink-soft)'}"><span style="pointer-events:none;display:flex;transform:scale(.8)">${AVAILABILITY_DOT[kind]}</span><span style="pointer-events:none">${esc(label)}</span></button>`;
  return `<div id="res-avail-slider" role="group" aria-label="${esc(tx('Verfügbarkeit'))}" style="position:relative;display:flex;background:var(--field);border-radius:14px;padding:4px;width:100%;box-sizing:border-box">
<span aria-hidden="true" data-role="avail-knob" style="position:absolute;top:4px;left:4px;width:calc(50% - 4px);height:38px;border-radius:11px;background:var(--surface);box-shadow:0 1px 4px var(--shadow-14);transform:translateX(${always ? '0%' : '100%'});transition:transform .26s cubic-bezier(.4,0,.2,1)"></span>
${seg('immer', tx('Immer verfügbar'), always)}${seg('manchmal', tx('Manchmal'), !always)}</div>`;
}

// v7 A32g: Der 246-px-Popover mit vier Auswahlarten JE RESSOURCE ist ersatzlos entfallen.
// Die Regel steht einmal in den Einstellungen (renderVisibility); an der Ressource bleibt
// nur der Privat-Schalter. Damit gibt es für dieselbe Entscheidung nur noch eine Stelle.

// ----------------------------------------------------------------------------
// Ü4 — Bearbeitungen der 06.1-Sheets nicht still verlieren
//
// Beim Öffnen wird der Ausgangszustand gemerkt (zentraler `dirtyGuard`). Schließen über
// Scrim oder Schließen-Knopf vergleicht ihn mit dem aktuellen Zustand: unverändert schließt
// direkt, verändert fragt „Weiter bearbeiten / Änderungen verwerfen". „Verwerfen" stellt den
// Ausgangszustand wieder her — auch dort, wo eine Änderung sofort wirkt (Interessen, Level,
// Ressourcen, Verfügbarkeit/Kapazität/Freigabe). „Fertig"/„Speichern" ist die bewusste
// Übernahme und schließt ohne Nachfrage.
// ----------------------------------------------------------------------------

const homeGuard = (ctx, key) => dirtyGuard(ctx, `profil-${key}`);

// Vergleichswert eines Sheets: alles, was in ihm bearbeitet werden kann.
function homeSheetValue(ctx, key) {
  const { ui } = ctx;
  const settings = ctx.repo.getSettings();
  if (key === 'profil') {
    // v6 A19e: Die private Wohnadresse ist kein Profilfeld mehr — sie gehört allein in den
    // geschützten Orts-/Zuhause-Flow eines Meets. Deshalb steht sie auch nicht mehr im
    // Vergleichswert des Sheets.
    // Runde 3: Farbe und Bild speichert der Baukasten selbst („Übernehmen") — hier zählt
    // deshalb nur noch der Name.
    return { name: (ui.editName ?? settings.name) || '' };
  }
  if (key === 'int-detail') {
    return { fuer: ui.intFor || null, name: (ui.intNameDraft || '').trim(), level: ui.intLevelDraft || 1 };
  }
  if (key === 'res-detail') {
    const name = ui.resFor;
    // v5 A30a: Im Anlege-Modus gibt es noch keinen gespeicherten Wert — der Entwurf
    // IST der Bearbeitungsstand und zaehlt genauso als Aenderung.
    if (ui.resNew) {
      const draft = ui.resDraftMeta || {};
      return { neu: true, meta: { availability: draft.availability, capacity: draft.capacity, icon: draft.icon || null }, privat: Boolean(draft.privat), name: (ui.resNameDraft || '').trim() };
    }
    return {
      meta: settings.resourceMeta?.[name] ?? null,
      privat: isResourcePrivate(settings, name),
      // v4 P0-4-2a: Der Name ist jetzt Teil des Bearbeiten-Zustands und damit auch Teil
      // der Ü4-Verwerfen-Entscheidung.
      name: (ui.resNameDraft ?? name ?? '').trim(),
    };
  }
  if (key === 'belegt') {
    return ui.belegtEntwurf ? { ...ui.belegtEntwurf, tage: [...ui.belegtEntwurf.tage].sort((a, b) => a - b) } : null;
  }
  return null;
}

// „Änderungen verwerfen": Ausgangszustand zurückschreiben.
function restoreHomeSheet(ctx, key, snapshot) {
  const { repo, ui } = ctx;
  if (!snapshot) return;
  if (key === 'profil') {
    ui.editName = null;
    return;
  }
  if (key === 'belegt') {
    ui.belegtEntwurf = null;
    return;
  }
  if (key === 'int-detail') {
    ui.intFor = null;
    ui.intNameDraft = '';
    ui.intLevelDraft = 1;
    return;
  }
  if (key === 'res-detail' && ui.resNew) {
    // Nichts geschrieben, also nichts zurueckzuschreiben — nur den Entwurf leeren.
    ui.resNameDraft = null;
    ui.resDraftMeta = null;
    return;
  }
  if (key === 'res-detail' && ui.resFor) {
    ui.resNameDraft = null;
    const current = repo.getSettings();
    const privat = { ...(current.resourcePrivate || {}) };
    if (snapshot.privat) privat[ui.resFor] = true; else delete privat[ui.resFor];
    projiziereFreigaben(repo, {
      resourceMeta: { ...current.resourceMeta, [ui.resFor]: snapshot.meta },
      resourcePrivate: privat,
    });
  }
}

// v4 P0-4-2b: `ui.sheet` war ein einzelner String-Slot — das Detail-Sheet ERSETZTE die
// Ressourcenliste, und „Fertig" landete auf der Profil-Startseite statt zurück in der
// Liste. Wer zwei Ressourcen bearbeiten wollte, musste jedes Mal neu über den Stift oben
// rechts einsteigen. Jetzt gibt es einen echten Sheet-Stapel: `options.stack` legt das
// aufrufende Sheet als Rückweg ab, `backHomeSheet` kehrt dorthin zurück.
function openHomeSheet(ctx, key, before, options = {}) {
  const { ui } = ctx;
  if (options.stack && ui.sheet && ui.sheet !== key) {
    ui.sheetStack = [...(ui.sheetStack || []), ui.sheet];
  }
  ui.sheet = key;
  before?.();
  const value = homeSheetValue(ctx, key);
  ui.homeSnapshot = { key, value };
  homeGuard(ctx, key).reset(value);
  ctx.render();
}

// Rückweg eine Stufe hoch (Detail → Liste). Ohne Stapel schließt es wie bisher.
// „Fertig" (commit) übernimmt, das X/der Scrim fragt bei echter Änderung nach.
function backHomeSheet(ctx, options = {}) {
  const { ui } = ctx;
  const stack = ui.sheetStack || [];
  if (!stack.length) { closeHomeSheet(ctx, options); return; }
  const key = ui.sheet;
  const parent = stack[stack.length - 1];
  const guard = homeGuard(ctx, key);
  const snapshot = ui.homeSnapshot?.key === key ? ui.homeSnapshot.value : null;
  const finish = () => {
    ui.sheetStack = stack.slice(0, -1);
    openHomeSheet(ctx, parent);
  };
  if (options.commit) { guard.clear(); finish(); return; }
  const allowed = guard.confirm(homeSheetValue(ctx, key), () => {
    restoreHomeSheet(ctx, key, snapshot);
    finish();
  });
  if (allowed) finish();
}

// options.commit = true → bewusste Übernahme („Fertig"/„Speichern"), keine Nachfrage.
function closeHomeSheet(ctx, options = {}) {
  const { ui } = ctx;
  const key = ui.sheet === 'foto' ? 'profil' : ui.sheet; // Fotoschritt gehört zum Profil-Sheet
  const finish = () => {
    ui.sheet = null;
    ui.sheetStack = [];
    ui.homeSnapshot = null;
    // v5 A30: Entwuerfe und das Freigabe-Dropdown ueberleben kein geschlossenes Sheet.
    ui.resNew = false;
    ui.resDraftMeta = null;
    ui.resNameDraft = null;
    ui.intFor = null;
    ui.intNameDraft = '';
    ui.intLevelDraft = 1;
    ui.pb = null;
    ui.belegtEntwurf = null;
    ctx.render();
  };
  if (!key) { finish(); return; }
  const guard = homeGuard(ctx, key);
  if (options.commit) { guard.clear(); finish(); return; }
  const snapshot = ui.homeSnapshot?.key === key ? ui.homeSnapshot.value : null;
  const allowed = guard.confirm(homeSheetValue(ctx, key), () => {
    restoreHomeSheet(ctx, key, snapshot);
    finish();
  });
  if (allowed) finish();
}

// Runde 3 (Jonathan, A1–A7): Das Profilbild entsteht im Baukasten aus Hintergrund, Motiv oder
// Foto (web/ui/profilbild-baukasten.js). Hier bleiben nur die Einstiege — das Profil-Sheet und
// „Wie heißt du?" — und beide öffnen denselben Baukasten.
//
// Jonathan (A6): „Wir haben einfach eine Box und dort muss man draufklicken — weiß man, dass
// man draufklicken muss?" Die frühere Aufnahmefläche ist ersatzlos entfallen; im Reiter „Foto"
// stehen jetzt beschriftete Knöpfe („Foto wählen", „Kamera") und „Foto entfernen".

// Die Scheibe selbst ist antippbar (A7: „nicht nur das Plus"), unten rechts ein kleines Zeichen.
function profilbildKnopf({ act, size, inhalt, zeichen, label, id = '' }) {
  return `<button data-act="${act}" aria-label="${esc(label)}" style="position:relative;display:block;width:${size}px;height:${size}px;border:0;background:transparent;padding:0;cursor:pointer;appearance:none;flex:none;border-radius:50%">
<span${id ? ` id="${id}"` : ''} style="position:relative;display:block;width:${size}px;height:${size}px;border-radius:50%;overflow:hidden;pointer-events:none">${inhalt}</span>
${zeichen}</button>`;
}

// Runde 4: Die Fußzeile des Baukastens (pbFuss) und das ganze Sheet (pbSheet) liegen jetzt im
// Baukasten selbst — dieselben für Einrichten, Profil und Gruppenbilder.
// Bearbeiten-Sheets von 06.1 (Profil, Interessen inkl. Punkte-Auswahl, Ressourcen)
function homeSheets(ctx) {
  const { repo, ui } = ctx;
  const settings = repo.getSettings();

  if (ui.sheet === 'profil') {
    const name = ui.editName ?? settings.name;
    const initialen = initialsOf(name);
    // Runde 3 (A7): Keine Farbpunkte mehr — Farbe, Motiv und Foto wählt man im Baukasten. Die
    // Scheibe selbst öffnet ihn, und darunter sagt es ein Textknopf ausdrücklich.
    const stift = `<span style="position:absolute;right:-3px;bottom:-3px;width:30px;height:30px;border-radius:50%;background:var(--surface);border:1px solid var(--ink-a12);box-shadow:0 2px 6px var(--shadow-14);display:flex;align-items:center;justify-content:center;pointer-events:none">${svgPencilSmall(12)}</span>`;
    return sheet(`<span style="font-family:${BRICOLAGE};font-size:19px;font-weight:650;display:block;padding-bottom:6px">${tx('Profil bearbeiten')}</span>
<div style="display:flex;flex-direction:column;align-items:center;gap:6px;padding:14px 0 2px;border-top:1px solid var(--ink-a07)">
${profilbildKnopf({ act: 'edit-photo', size: 84, id: 'edit-avatar', label: tx('Profilbild ändern'), inhalt: avatarFlaeche({ photo: mitInitialen(settings.photo || null, initialen), color: settings.color, initials: initialen }, 84, 28), zeichen: stift })}
<button data-act="edit-photo" style="border:0;background:transparent;padding:8px 10px 2px;cursor:pointer;appearance:none;font:650 13.5px ${FONT};color:var(--green-dark)">${tx('Profilbild ändern')}</button>
</div>
<div style="display:flex;flex-direction:column;gap:6px;padding-top:12px">
${groupLabel(tx('Name'))}
<input id="edit-name" value="${esc(name)}" aria-label="${esc(tx('Name'))}" style="${INPUT_STYLE}">
</div>
<button data-act="save-profile" style="${GREEN_PILL};margin-top:16px">${tx('Speichern')}</button>`, { closeAct: 'close-home-sheet' });
  }

  // Runde 3: der Baukasten. Die Vorschau oben zeigt immer, was „Übernehmen" speichert;
  // „Abbrechen" und die Fläche daneben ändern nichts.
  if (ui.sheet === 'foto' && ui.pb) {
    return pbSheet(ui.pb, { titel: tx('Profilbild'), abbrechen: 'foto-cancel', uebernehmen: 'foto-apply' });
  }
  // v5 A30e: Ein neues Interesse fragt nach Name UND aktueller Häufigkeit, statt still
  // Stufe 1 zu setzen. Dieselbe Wortwahl wie in der Bearbeitung: ab und zu · regelmäßig · oft.
  // v6 A19c: Dasselbe Sheet trägt jetzt BEIDE Zustände — anlegen (ui.intFor leer) und
  // bearbeiten (ui.intFor = bestehendes Interesse). Eine zweite Liste hinter einem Stift
  // gibt es nicht mehr; deshalb wandert auch das Entfernen hierher.
  if (ui.sheet === 'int-detail') {
    const bearbeitet = Boolean(ui.intFor);
    const level = ui.intLevelDraft || 1;
    const levelRow = (l) => {
      const selected = l === level;
      let dots = '';
      for (let i = 0; i < l; i++) dots += `<span style="width:7px;height:7px;border-radius:50%;background:var(--green)"></span>`;
      return `<button data-act="int-level-draft" data-level="${l}" style="display:flex;align-items:center;gap:11px;padding:12px 2px;width:100%;border:0;border-top:1px solid var(--ink-a05);background:transparent;text-align:left;cursor:pointer;appearance:none;font-family:${FONT}">
<span style="display:flex;gap:3px;width:34px;pointer-events:none">${dots}</span>
<span style="font-size:14px;font-weight:${selected ? 650 : 600};color:${selected ? 'var(--green-dark)' : 'var(--ink-soft)'};flex:1;pointer-events:none">${LEVEL_WORDS[l]}</span>
${selected ? `<svg width="14" height="14" viewBox="0 0 24 24" fill="none" style="pointer-events:none"><path d="m5 12.5 4.5 4.5L19 7.5" stroke="var(--green-dark)" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round"></path></svg>` : ''}</button>`;
    };
    const hasStack = (ui.sheetStack || []).length > 0;
    return sheet(`<div style="display:flex;align-items:center;gap:9px;padding-bottom:10px">
${hasStack ? `<button data-act="int-detail-back" data-treffer aria-label="${esc(tx('Zurück'))}" style="width:30px;height:30px;border-radius:50%;background:var(--paper);border:1px solid var(--ink-a08);display:flex;align-items:center;justify-content:center;flex:none;cursor:pointer;appearance:none;padding:0"><span style="pointer-events:none;display:flex">${backArrow('var(--ink)', 15)}</span></button>` : ''}
<span style="font-family:${BRICOLAGE};font-size:19px;font-weight:650;flex:1">${bearbeitet ? tx('Interesse bearbeiten') : tx('Neues Interesse')}</span></div>
${bearbeitet ? '' : `<div style="max-height:300px;overflow-y:auto;scrollbar-width:none;margin:0 -2px" data-scroll-keep="int-katalog">${interestCatalogHtml({
      act: 'int-pick',
      istGewaehlt: (label) => label === (ui.intNameDraft || '').trim(),
      offen: ui.offeneKat || null,
      toggleAct: 'int-kat',
    })}</div>`}
<div style="display:flex;flex-direction:column;gap:6px;padding:${bearbeitet ? '0' : '12px'} 0 6px">
${groupLabel(bearbeitet ? tx('Interesse') : tx('Eigenes Interesse'))}
<input id="int-name" value="${esc(ui.intNameDraft || '')}" placeholder="${esc(tx('z. B. Padel'))}" aria-label="${esc(tx('Interesse'))}" style="${INPUT_STYLE}">
</div>
<div style="padding:10px 0 2px;border-top:1px solid var(--ink-a05)"><span style="font-size:11px;font-weight:650;letter-spacing:.09em;text-transform:uppercase;color:var(--muted-light)">${tx('Wie oft gerade?')}</span></div>
${levelRow(1)}${levelRow(2)}${levelRow(3)}
${bearbeitet ? `<button data-act="int-remove" data-name="${esc(ui.intFor)}" style="display:flex;align-items:center;justify-content:center;gap:9px;padding:12px 0;margin-top:12px;width:100%;border:1.5px solid var(--red-a28);border-radius:999px;background:transparent;cursor:pointer;appearance:none;font-family:${FONT}"><span style="pointer-events:none;display:flex">${svgTrashRed}</span><span style="font-size:13.5px;font-weight:650;color:var(--red);pointer-events:none">${tx('Interesse entfernen')}</span></button>` : ''}
<button data-act="${bearbeitet ? 'int-save' : 'int-create'}" style="${GREEN_PILL};margin-top:${bearbeitet ? 10 : 16}px">${bearbeitet ? tx('Fertig') : tx('Hinzufügen')}</button>`, { closeAct: 'close-home-sheet' });
  }

  // Ressourcen-Details (v14 06.1, Tap auf die Zeile) — v3.1 §6: zwei Verfügbarkeitswerte,
  // Kapazität als präziser Stepper, Freigabe je Ressource. KEINE Tags mehr.
  if (ui.sheet === 'res-detail' && (ui.resFor || ui.resNew)) {
    // v5 A30a: Im Anlege-Modus gibt es die Ressource noch nicht. Alle Werte leben als
    // Entwurf in ui.resDraftMeta und werden erst mit „Hinzufügen" geschrieben.
    const isNew = Boolean(ui.resNew);
    const draft = ui.resDraftMeta || { availability: 'manchmal', capacity: null, share: 'freunde' };
    const name = isNew ? (ui.resNameDraft || '') : ui.resFor;
    const meta = isNew ? draft : (settings.resourceMeta?.[name] || {});
    const availability = availabilityOf(meta);
    // v7 A32b: Kapazität als vertikales Wheel wie die Uhrzeit — neutraler Mittelpunkt „—"
    // (nicht 0), gewählter Wert mittig, Nachbarwerte darüber und darunter, Ziehen möglich.
    const capacityWheel = `<div style="display:flex;align-items:center;justify-content:center;position:relative;padding:6px 0">
<div style="position:absolute;left:50%;transform:translateX(-50%);width:96px;top:50%;margin-top:-19px;height:38px;border-radius:12px;background:var(--paper)"></div>
${wheelColumn('cap', CAPACITY_VALUES, meta.capacity || 0, { text: capacityText, width: 96 })}
</div>`;
    // v4 P0-4-2b: Das Detail-Sheet hat einen echten Rückweg in die Liste (wie das
    // Foto-Sheet mit 'edit-photo-back'). „Fertig" landet wieder in der Ressourcenliste,
    // nicht auf der Profil-Startseite.
    // v4 P0-4-2a: Der Bearbeiten-Zustand enthält alle drei verlangten Felder —
    // NAME, Immer/Manchmal, Kapazität — plus die Freigabe.
    const nameDraft = isNew ? (ui.resNameDraft || '') : (ui.resNameDraft ?? name);
    // Der Zurück-Pfeil erscheint nur, wenn es wirklich eine Stufe darunter gibt (Liste).
    // Direkt aus der Profilzeile geöffnet, gibt es keinen Rückweg — dann auch keinen Pfeil.
    const hasStack = (ui.sheetStack || []).length > 0;
    // v7 A32c: Der private Zustand ist ein kleiner runder Knopf OBEN RECHTS — sichtbar
    // aktiv/inaktiv, ohne die Bearbeitung zu dominieren. Vorher war „privat" nur ein
    // Eintrag tief in einer Auswahlliste.
    const privatAn = isNew ? Boolean(draft.privat) : isResourcePrivate(settings, name);
    // R1 §7: Statt „Private Ressourcen · Regel in den Einstellungen" steht hier ein Satz,
    // der für DIESE Ressource sagt, wer sie sieht — und wie man das ändert.
    const freigabeName = (isNew ? nameDraft : name) || tx('diese Ressource');
    const privatRegel = shareRules(settings).private;
    const freigabeSatz = !privatAn
      // Runde 2 (Jonathan: zu viel Text) — ein kurzer Satz, das Schloss erklärt sich selbst.
      ? tx('Alle deine Freunde sehen {name}.', { name: freigabeName })
      : privatRegel.mode === 'ich'
        ? tx('Nur du siehst {name}.', { name: freigabeName })
        : tx('Nur {wer} sieht {name}.', { wer: ruleLabel(privatRegel, repo), name: freigabeName });
    const privatKnopf = `<button data-act="res-private" aria-pressed="${privatAn}" aria-label="${esc(tx('Private Ressource'))}" title="${esc(tx('Private Ressource'))}" style="width:30px;height:30px;border-radius:50%;border:1.5px solid ${privatAn ? 'var(--green-a50)' : 'var(--ink-a14)'};background:${privatAn ? 'var(--green-tint)' : 'var(--surface)'};display:flex;align-items:center;justify-content:center;flex:none;cursor:pointer;appearance:none;padding:0"><span style="pointer-events:none;display:flex">${svgLockSmall(privatAn ? 'var(--green-dark)' : 'var(--muted)')}</span></button>`;
    // R1 §6.2: Das Zeichen ist antippbar — dahinter liegt die Liste zum Selbstaussuchen.
    // Es ist absichtlich KEIN versteckter Weg: findet die Zuordnung nichts, sagt die
    // Zeile darunter, dass man selbst wählen kann.
    const zeichenGewaehlt = isNew ? (draft.icon || null) : eigenesRessourcenZeichen(settings, name);
    const zeichenName = isNew ? nameDraft : name;
    const zeichenKnopf = `<button data-act="res-icon-open" aria-label="${esc(tx('Symbol wählen'))}" title="${esc(tx('Symbol wählen'))}" style="width:34px;height:34px;border-radius:50%;border:1.5px solid ${zeichenGewaehlt ? 'var(--green-a50)' : 'var(--ink-a09)'};background:${zeichenGewaehlt ? 'var(--green-tint)' : 'var(--paper)'};display:flex;align-items:center;justify-content:center;flex:none;cursor:pointer;appearance:none;padding:0"><span style="pointer-events:none;display:flex">${resourceIconSvg(zeichenName, 18, zeichenGewaehlt)}</span></button>`;
    const zeichenHinweis = zeichenGewaehlt || ressourcenIconGefunden(zeichenName)
      ? ''
      : `<button data-act="res-icon-open" style="display:block;width:100%;padding:0 0 8px;border:0;background:transparent;text-align:left;cursor:pointer;appearance:none;font-family:${FONT}"><span style="font-size:11.5px;color:var(--muted);line-height:1.45;pointer-events:none">${tx('Kein passendes Symbol gefunden — {an}such dir selbst eines aus{aus}.', { an: '<span style="color:var(--green-dark);font-weight:650">', aus: '</span>' })}</span></button>`;
    const backRow = `<div style="display:flex;align-items:center;gap:9px;padding-bottom:10px">
${hasStack ? `<button data-act="res-detail-back" data-treffer aria-label="${esc(tx('Zurück'))}" style="width:30px;height:30px;border-radius:50%;background:var(--paper);border:1px solid var(--ink-a08);display:flex;align-items:center;justify-content:center;flex:none;cursor:pointer;appearance:none;padding:0"><span style="pointer-events:none;display:flex">${backArrow('var(--ink)', 15)}</span></button>` : ''}
${zeichenKnopf}<span style="font-family:${BRICOLAGE};font-size:19px;font-weight:650;flex:1;min-width:0;overflow:hidden;text-overflow:ellipsis;white-space:nowrap">${esc(isNew ? (name || tx('Neue Ressource')) : name)}</span>${privatKnopf}</div>
${zeichenHinweis}`;
    return sheet(`${backRow}
<div style="display:flex;flex-direction:column;gap:6px;padding-bottom:6px">
${groupLabel(tx('Name'))}
<input id="res-name" value="${esc(nameDraft)}"${isNew ? ` placeholder="${esc(tx('z. B. Anhänger'))}"` : ''} aria-label="${esc(tx('Name der Ressource'))}" style="${INPUT_STYLE}">
</div>
<div style="padding:10px 0 8px;border-top:1px solid var(--ink-a05)"><span style="font-size:11px;font-weight:650;letter-spacing:.09em;text-transform:uppercase;color:var(--muted-light)">${tx('Verfügbarkeit')}</span></div>
${availabilitySlider(meta)}
<div style="padding:12px 0 0;border-top:1px solid var(--ink-a05)"><span style="font-size:11px;font-weight:650;letter-spacing:.09em;text-transform:uppercase;color:var(--muted-light)">${tx('Personen-Kapazität')}</span></div>
${capacityWheel}
<div style="display:flex;align-items:center;gap:10px;padding:13px 0 2px;border-top:1px solid var(--ink-a05)">
<span style="font-size:11px;font-weight:650;letter-spacing:.09em;text-transform:uppercase;color:var(--muted-light);flex:1">${tx('Freigabe')}</span>
<span style="font-size:12.5px;font-weight:650;color:${privatAn ? 'var(--green-dark)' : 'var(--ink-soft)'}">${esc(privatAn ? ruleLabel(shareRules(settings).private, repo) : tx('Alle Freunde'))}</span>
</div>
<span style="display:block;font-size:11px;color:var(--muted);line-height:1.45;padding-bottom:2px">${esc(freigabeSatz)}</span>
${isNew ? '' : `<button data-act="res-remove" data-name="${esc(name)}" style="display:flex;align-items:center;justify-content:center;gap:9px;padding:12px 0;margin-top:14px;width:100%;border:1.5px solid var(--red-a28);border-radius:999px;background:transparent;cursor:pointer;appearance:none;font-family:${FONT}"><span style="pointer-events:none;display:flex">${svgTrashRed}</span><span style="font-size:13.5px;font-weight:650;color:var(--red);pointer-events:none">${tx('Ressource entfernen')}</span></button>`}
<button data-act="${isNew ? 'res-create' : 'commit-home-sheet'}" style="${GREEN_PILL};margin-top:${isNew ? 16 : 10}px">${isNew ? tx('Hinzufügen') : tx('Fertig')}</button>`, { closeAct: 'close-home-sheet' });
  }

  // R1 §6.2 — „Wird nichts gefunden, kann man selbst eines aus einer Liste aussuchen."
  // Die Liste ist derselbe Katalog, aus dem auch die automatische Zuordnung schöpft;
  // jedes Zeichen trägt sein Wort, weil Stativ, Leinwand und Pavillon klein sonst
  // gleich aussehen. Ganz oben steht der Weg zurück zur Automatik.
  if (ui.sheet === 'res-icon' && (ui.resFor || ui.resNew)) {
    const istNeu = Boolean(ui.resNew);
    const label = (istNeu ? (ui.resNameDraft || '') : (ui.resFor || '')).trim();
    const gewaehlt = istNeu ? ((ui.resDraftMeta || {}).icon || null) : eigenesRessourcenZeichen(settings, ui.resFor);
    const autoKey = ressourcenIconKey(label);
    const autoGefunden = ressourcenIconGefunden(label);
    // Runde 4 (B7): Die Liste ist nach Kategorien geordnet (web/ui/zeichen-auswahl.js) — oben die
    // Leiste zum Springen, darunter alle Zeichen in Abschnitten.
    return sheet(`<div style="display:flex;align-items:center;gap:9px;padding-bottom:8px">
<button data-act="res-icon-back" data-treffer aria-label="${esc(tx('Zurück'))}" style="width:30px;height:30px;border-radius:50%;background:var(--paper);border:1px solid var(--ink-a08);display:flex;align-items:center;justify-content:center;flex:none;cursor:pointer;appearance:none;padding:0"><span style="pointer-events:none;display:flex">${backArrow('var(--ink)', 15)}</span></button>
<span style="font-family:${BRICOLAGE};font-size:19px;font-weight:650;flex:1;min-width:0;overflow:hidden;text-overflow:ellipsis;white-space:nowrap">${tx('Symbol für {name}', { name: esc(label || tx('die Ressource')) })}</span></div>
<button data-act="res-icon-auto" aria-pressed="${!gewaehlt}" style="display:flex;align-items:center;gap:11px;padding:11px 13px;width:100%;border-radius:16px;border:1.5px solid ${gewaehlt ? 'var(--ink-a07)' : 'var(--green-a50)'};background:${gewaehlt ? 'var(--surface)' : 'var(--green-tint)'};cursor:pointer;appearance:none;font-family:${FONT};text-align:left;margin-bottom:12px">
<span style="pointer-events:none;display:flex">${symbol(autoKey, gewaehlt ? 'var(--ink-soft)' : 'var(--green-dark)', 22)}</span>
<span style="display:flex;flex-direction:column;gap:1px;flex:1;min-width:0;pointer-events:none">
<span style="font-size:13.5px;font-weight:650;color:${gewaehlt ? 'var(--ink)' : 'var(--green-dark)'}">${tx('Automatisch')}</span>
<span style="font-size:11px;color:var(--muted);line-height:1.35">${autoGefunden ? tx('nach dem Namen gewählt: {name}', { name: esc(RESSOURCEN_WORTE[autoKey] || autoKey) }) : tx('zum Namen passt nichts — wähl unten selbst')}</span></span></button>
${zeichenAuswahlHtml({ act: 'res-icon-set', gewaehlt, worte: RESSOURCEN_WORTE })}`, { closeAct: 'close-home-sheet', scrollKey: 'res-icon' });
  }

  // Runde 4 (B5): Ein Zeitfenster anlegen oder ändern — Tage antippen, von/bis drehen.
  if (ui.sheet === 'belegt' && ui.belegtEntwurf) {
    const entwurf = ui.belegtEntwurf;
    const neu = entwurf.index === null;
    const [vh, vm] = entwurf.von.split(':').map(Number);
    const [bh, bm] = entwurf.bis.split(':').map(Number);
    const gleicheTage = (a, b) => a.length === b.length && a.every((tag) => b.includes(tag));
    const tagKnopf = (tag) => {
      const an = entwurf.tage.includes(tag);
      return `<button data-act="belegt-tag" data-tag="${tag}" aria-pressed="${an}" style="flex:1 1 0;min-width:0;height:44px;border-radius:14px;border:1.5px solid ${an ? 'var(--green)' : 'var(--ink-a12)'};background:${an ? 'var(--green)' : 'var(--surface)'};color:${an ? 'var(--on-accent)' : 'var(--ink-soft)'};font:650 13px/1 ${FONT};cursor:pointer;appearance:none;padding:0;transition:background .14s ease-out,border-color .14s ease-out,color .14s ease-out"><span style="pointer-events:none">${esc(tagKurz(tag))}</span></button>`;
    };
    const vorlage = (v) => {
      const an = gleicheTage(entwurf.tage, v.tage);
      return `<button data-act="belegt-vorlage" data-tage="${v.tage.join(',')}" aria-pressed="${an}" style="height:44px;padding:0;border:0;background:transparent;cursor:pointer;appearance:none;flex:none"><span style="display:flex;align-items:center;height:32px;padding:0 12px;border-radius:999px;box-sizing:border-box;border:1.5px solid ${an ? 'var(--green-a50)' : 'var(--ink-a09)'};background:${an ? 'var(--green-tint)' : 'var(--paper)'};font:650 12.5px/1 ${FONT};color:${an ? 'var(--green-dark)' : 'var(--ink-soft)'};pointer-events:none;white-space:nowrap">${esc(v.name || tageText(v.tage))}</span></button>`;
    };
    const uhr = (feld, h, m) => `<div style="position:relative;display:flex;align-items:center;justify-content:center">
<div style="position:absolute;left:0;right:0;top:50%;margin-top:-19px;height:38px;border-radius:12px;background:var(--paper)"></div>
${wheelColumn(`belegt-${feld}-h`, BELEGT_STUNDEN, h, { runden: 3, width: 44 })}
<span style="font-size:17px;font-weight:650;position:relative;width:8px;text-align:center">:</span>
${wheelColumn(`belegt-${feld}-m`, BELEGT_MINUTEN, m, { runden: 3, width: 44 })}
</div>`;
    const spalte = (label, feld, h, m) => `<div style="display:flex;flex-direction:column;align-items:center;gap:4px">${groupLabel(label)}${uhr(feld, h, m)}</div>`;
    const vonMin = vh * 60 + vm;
    const bisMin = bh * 60 + bm;
    const gleich = vonMin === bisMin;
    const folgetag = gleich ? tx('Von und Bis sind gleich') : bisMin < vonMin ? (bisMin === 0 ? tx('Bis Mitternacht') : tx('Endet am nächsten Tag')) : '';
    const bereit = entwurf.tage.length > 0 && !gleich;
    return sheet(`<span style="font-family:${BRICOLAGE};font-size:19px;font-weight:650;display:block">${neu ? tx('Keine Zeit eintragen') : tx('Keine Zeit bearbeiten')}</span>
<span style="display:block;font-size:12.5px;color:var(--ink-soft);line-height:1.45;padding:6px 0 2px">${tx('Jede Woche. Freunde sehen nur „Keine Zeit“.')}</span>
<div style="padding:14px 0 8px">${groupLabel(tx('Tage'))}</div>
<div role="group" aria-label="${esc(tx('Tage'))}" style="display:flex;gap:6px">${WOCHE_AB_MONTAG.map(tagKnopf).join('')}</div>
<div style="display:flex;gap:6px;flex-wrap:wrap;padding-top:4px">${BELEGT_VORLAGEN.map(vorlage).join('')}</div>
<div style="display:flex;align-items:flex-start;justify-content:center;gap:12px;padding-top:12px;margin-top:6px;border-top:1px solid var(--ink-a05)">
${spalte(tx('Von'), 'von', vh, vm)}
<div aria-hidden="true" style="display:flex;flex-direction:column;align-items:center;gap:4px">${groupLabel(' ')}<div style="height:${RAD_ZEILE * 5}px;display:flex;align-items:center"><span style="display:block;width:12px;height:2px;border-radius:1px;background:var(--muted-light)"></span></div></div>
${spalte(tx('Bis'), 'bis', bh, bm)}
</div>
<span data-role="belegt-folgetag" style="display:block;min-height:18px;text-align:center;font-size:12px;font-weight:650;color:${gleich ? 'var(--danger)' : 'var(--green-dark)'};padding-top:2px">${esc(folgetag)}</span>
${neu ? '' : `<button data-act="belegt-remove" style="display:flex;align-items:center;justify-content:center;gap:9px;padding:12px 0;margin-top:12px;width:100%;border:1.5px solid var(--red-a28);border-radius:999px;background:transparent;cursor:pointer;appearance:none;font-family:${FONT}"><span style="pointer-events:none;display:flex">${svgTrashRed}</span><span style="font-size:13.5px;font-weight:650;color:var(--red);pointer-events:none">${tx('Zeiten entfernen')}</span></button>`}
<button data-act="belegt-save" style="${GREEN_PILL};margin-top:${neu ? 14 : 10}px;${bereit ? '' : 'opacity:.4'}">${neu ? tx('Hinzufügen') : tx('Fertig')}</button>`, { closeAct: 'close-home-sheet', scrollKey: 'belegt' });
  }

  return '';
}

// v6 A19d: „Profil bearbeiten" lebt AUSSCHLIESSLICH in der Profilansicht (Tap auf den
// eigenen Avatar). Der zweite Einstieg aus den Einstellungen ist entfallen — und mit ihm
// der Routenparameter ?sheet, der nur von dort kam.
// v7 A31d (spec/06 §1): Der Satz „Deine Ressource im Profil bearbeiten" gehoert entfernt,
// und die eigene Ressource soll DIREKT ihre Bearbeitung oeffnen. Der Weg dorthin fuehrt
// ueber den Profil-Tab; damit room.js dafuer keinen zweiten Sheet-Aufbau bekommt, meldet
// es hier nur den Namen an und dieser Screen oeffnet sein eigenes, bestehendes Sheet.
let offeneRessource = null;

export function oeffneEigeneRessource(label) {
  offeneRessource = label || null;
}

function renderProfileHome(ctx) {
  if (offeneRessource) {
    ctx.ui.sheet = 'res-detail';
    ctx.ui.resFor = offeneRessource;
    ctx.ui.resNew = false;
    ctx.ui.resNameDraft = null;
    ctx.ui.sheetStack = [];
    offeneRessource = null;
  }
  const html = screenScaffold({
    page: true,
    header: homeHeader(ctx),
    body: homeBody(ctx),
    // v6 A20a: Die Seite liegt in der Tab-Bahn — die Bottom-Navigation steht in der
    // App-Chrome (v4 P0-1). Hier bleibt nur der Auslauf unter der Leiste; die schwebende
    // Pille „Hinzufügen" ist nach oben rechts gewandert.
    bottom: `<div style="pointer-events:none;height:26px"></div>`,
    bottomInset: TABBAR_INSET + CONTENT_INSET,
    overlays: `${homeSheets(ctx)}${discardSheet(ctx)}`,
    scrollKey: 'profile-home',
  });
  return { html, bind: bindProfileHome };
}

function bindProfileHome(root, ctx) {
  const { repo, nav, ui } = ctx;
  v7ProfilDefaults(repo);           // schreibt hoechstens einmal (A33a/A35b)
  const settings = repo.getSettings();

  const nameInput = root.querySelector('#edit-name');
  if (nameInput) {
    nameInput.addEventListener('input', () => {
      ui.editName = nameInput.value;
      // v7 A36: Der Vorschau-Avatar kann ein Bild tragen — deshalb wird er mit derselben
      // Primitive neu gezeichnet statt nur sein Text gesetzt (das haette ein Foto geloescht).
      const avatar = root.querySelector('#edit-avatar');
      if (avatar) {
        const aktuell = repo.getSettings();
        const initialen = initialsOf(nameInput.value);
        avatar.innerHTML = avatarFlaeche({ photo: mitInitialen(aktuell.photo || null, initialen), color: aktuell.color, initials: initialen }, 84, 28);
      }
    });
  }
  // v6 A19e: Es gibt hier keine Adressfelder mehr — settings.homeAddress wird nur noch im
  // geschützten Orts-/Zuhause-Flow eines Meets gepflegt und bleibt hier unangetastet.
  // v4 P0-4-2a: Der Name der Ressource ist ein echtes Bearbeitungsfeld. Er wird erst mit
  // „Fertig" übernommen (Umbenennen zieht Meta und Freigabe mit) — bis dahin lebt er als
  // Entwurf und zählt beim Schließen als Änderung (Ü4).
  root.querySelector('#res-name')?.addEventListener('input', (event) => { ui.resNameDraft = event.target.value; });

  pbFotoBinden(root, ctx, () => (ui.sheet === 'foto' ? ui.pb : null));
  // Runde 4 (B7): Kategorien-Leiste der Zeichenauswahl (springen, mitlaufen).
  zeichenAuswahlBinden(root);

  // v5 A30e: Ein neues Interesse entsteht im eigenen Sheet mit Name UND Haeufigkeit.
  const createInterest = () => {
    const value = (ui.intNameDraft || '').trim();
    if (!value) { ctx.toast(tx('Bitte ein Interesse eingeben')); return false; }
    const current = repo.getSettings();
    const interests = current.interests || [];
    if (interests.includes(value)) { ctx.toast(tx('Interesse gibt es schon')); return false; }
    repo.updateSettings({
      interests: [...interests, value],
      interestLevels: { ...current.interestLevels, [value]: ui.intLevelDraft || 1 },
    });
    ui.intFor = null;
    ui.intNameDraft = '';
    ui.intLevelDraft = 1;
    ctx.toast(tx('Interesse hinzugefügt'));
    return true;
  };
  // v6 A19c: Bearbeiten eines BESTEHENDEN Interesses — Umbenennen zieht die Bewertung mit,
  // damit dieselbe Sache nicht zweimal in der Liste landet.
  const saveInterest = () => {
    const from = ui.intFor;
    const to = (ui.intNameDraft ?? from ?? '').trim();
    if (!from) return false;
    if (!to) { ctx.toast(tx('Bitte ein Interesse eingeben')); return false; }
    const current = repo.getSettings();
    const interests = current.interests || [];
    if (to !== from && interests.includes(to)) { ctx.toast(tx('Interesse gibt es schon')); return false; }
    const levels = { ...current.interestLevels };
    delete levels[from];
    levels[to] = ui.intLevelDraft || 1;
    repo.updateSettings({
      interests: interests.map((entry) => (entry === from ? to : entry)),
      interestLevels: levels,
    });
    ui.intFor = null;
    ui.intNameDraft = '';
    ui.intLevelDraft = 1;
    return true;
  };
  // options.open = true → nach dem Anlegen direkt in den Bearbeiten-Zustand der neuen
  // Ressource (v4 P0-4-2a: „klarer Add-/Edit-Zustand: Name, Immer/Manchmal, Kapazität").
  // v5 A30a: Angelegt wird erst mit „Hinzufügen" im Detail-Sheet — mit allem, was dort
  // eingestellt wurde (Name, Verfügbarkeit, Kapazität, Freigabe).
  const createResource = () => {
    const value = (ui.resNameDraft || '').trim();
    if (!value) { ctx.toast(tx('Bitte einen Namen eingeben')); return false; }
    const current = repo.getSettings();
    const resources = current.resources || [];
    if (resources.includes(value)) { ctx.toast(tx('Ressource gibt es schon')); return false; }
    const draft = ui.resDraftMeta || { availability: 'manchmal', capacity: null, privat: false };
    // v7 A32g: Die Freigabe entsteht aus der zentralen Regel plus dem Privat-Schalter.
    projiziereFreigaben(repo, {
      resources: [...resources, value],
      resourceMeta: { ...current.resourceMeta, [value]: { availability: draft.availability, capacity: draft.capacity, icon: draft.icon || null } },
      resourcePrivate: draft.privat ? { ...(current.resourcePrivate || {}), [value]: true } : (current.resourcePrivate || {}),
    });
    ui.resNew = false;
    ui.resDraftMeta = null;
    ui.resNameDraft = null;
    ctx.toast(tx('Ressource hinzugefügt'));
    return true;
  };
  // v4 P0-4-2b: Das Detail liegt ÜBER der Liste (Stapel), nicht an ihrer Stelle.
  const openResourceDetail = (context, name) => openHomeSheet(context, 'res-detail', () => {
    ui.resFor = name;
    ui.resNameDraft = null;
  }, { stack: true });
  // Umbenennen zieht Verfügbarkeit/Kapazität und Freigabe mit — die Ressource bleibt
  // dieselbe Sache, auch in Crew- und Personenansichten (gemeinsame Datenquelle).
  const commitResourceName = () => {
    const from = ui.resFor;
    const to = (ui.resNameDraft ?? from ?? '').trim();
    ui.resNameDraft = null;
    if (!from || !to || to === from) return true;
    const current = repo.getSettings();
    if ((current.resources || []).includes(to)) { ctx.toast(tx('Ressource gibt es schon')); return false; }
    const meta = { ...current.resourceMeta };
    const privat = { ...(current.resourcePrivate || {}) };
    meta[to] = meta[from] ?? { availability: 'manchmal', capacity: null };
    if (privat[from]) privat[to] = true;
    delete meta[from];
    delete privat[from];
    projiziereFreigaben(repo, {
      resources: (current.resources || []).map((entry) => (entry === from ? to : entry)),
      resourceMeta: meta,
      resourcePrivate: privat,
    });
    ui.resFor = to;
    return true;
  };
  const patchResourceMeta = (name, patch) => {
    const current = repo.getSettings();
    const meta = current.resourceMeta?.[name] || { availability: 'manchmal', capacity: null };
    repo.updateSettings({ resourceMeta: { ...current.resourceMeta, [name]: { ...meta, ...patch } } });
  };
  // v5 A30a: Im Anlege-Modus schreibt jede Einstellung in den Entwurf, sonst direkt in
  // den Zustand. Ein einziger Ort dafuer, damit sich beide Wege nie auseinanderleben.
  // R1 §6.2: Ein Griff für beide Wege — Entwurf beim Anlegen, Zustand beim Bearbeiten.
  // Danach geht es zurück in die Bearbeitung, damit man die Wahl sofort dort sieht.
  const schreibeZeichen = (key) => {
    if (ui.resNew) ui.resDraftMeta = { ...(ui.resDraftMeta || {}), icon: key };
    else patchResourceMeta(ui.resFor, { icon: key });
    backHomeSheet(ctx, { commit: true });
  };
  const currentResMeta = () => (ui.resNew ? (ui.resDraftMeta || {}) : (repo.getSettings().resourceMeta?.[ui.resFor] || {}));
  const writeResMeta = (patch) => {
    if (ui.resNew) { ui.resDraftMeta = { ...(ui.resDraftMeta || {}), ...patch }; ctx.render(); return; }
    patchResourceMeta(ui.resFor, patch);
  };
  // Ü4: Getippter, aber noch nicht hinzugefügter Text ist ein echter Bearbeitungsstand —
  // er überlebt Rerender und zählt beim Schließen als Änderung.
  const intNameInput = root.querySelector('#int-name');
  if (intNameInput) {
    intNameInput.addEventListener('input', () => { ui.intNameDraft = intNameInput.value; });
    intNameInput.addEventListener('keydown', (event) => {
      if (event.key !== 'Enter') return;
      const ok = ui.intFor ? saveInterest() : createInterest();
      if (ok) backHomeSheet(ctx, { commit: true });
    });
  }

  // v7 A32b: Kapazitaet laesst sich ziehen, nicht nur antippen.
  // Runde 4 (B5): Die Uhrzeit-Räder im Sheet „Keine Zeit" schreiben in den Entwurf.
  const belegtRad = (col, value) => {
    const entwurf = ui.belegtEntwurf;
    if (!entwurf) return;
    const [, feld, teil] = col.split('-');
    if (feld !== 'von' && feld !== 'bis') return;
    const [h, m] = entwurf[feld].split(':').map(Number);
    const wert = Number(value);
    const neu = teil === 'h' ? [wert, m] : [h, wert];
    entwurf[feld] = `${String(neu[0]).padStart(2, '0')}:${String(neu[1]).padStart(2, '0')}`;
    ctx.render();
  };
  bindWheelDrag(root, (col, value) => {
    if (col.startsWith('belegt-')) { belegtRad(col, value); return; }
    if (col !== 'cap') return;
    const wert = Number(value);
    writeResMeta({ capacity: wert > 0 ? wert : null });
  });

  bindActions(root, {
    ...discardActions(ctx),
    'go-friend-add': () => nav.go('profile.friendAdd'),
    'go-settings': () => nav.go('profile.settings'),
    'go-my-meets': () => nav.go('profile.myMeets'),
    // Runde 5 (C2): Anfragen oben im Profil — dieselben Aktionen wie auf der Seite „Anfragen".
    ...requestActs(ctx),
    'go-requests': () => nav.go('profile.friendRequests'),
    'toggle-interests': () => { ui.allInterests = !ui.allInterests; ctx.render(); },
    'toggle-resources': () => { ui.allResources = !ui.allResources; ctx.render(); },
    'edit-profile': () => openHomeSheet(ctx, 'profil', () => {
      ui.editName = settings.name;
    }),
    // Runde 3: Der Baukasten startet mit dem Gespeicherten — und den Initialen des Namens,
    // der gerade im Feld steht.
    'edit-photo': () => {
      const aktuell = repo.getSettings();
      const initialen = initialsOf(ui.editName ?? aktuell.name);
      ui.pb = pbStart({ photo: mitInitialen(aktuell.photo || null, initialen), color: aktuell.color, initials: initialen });
      ui.sheet = 'foto';
      ctx.render();
    },
    ...pbActs(ctx, () => (ui.sheet === 'foto' ? ui.pb : null)),
    // Abbrechen verwirft NUR den Entwurf; das gespeicherte Bild bleibt unberührt.
    'foto-cancel': () => { ui.pb = null; ui.sheet = 'profil'; ctx.render(); },
    'foto-apply': () => {
      if (!ui.pb) return;
      const vorher = repo.getSettings();
      const ergebnis = pbErgebnis(ui.pb);
      // Gespeichert wird mit den Initialen des GESPEICHERTEN Namens; ändert „Speichern" den
      // Namen, zieht es sie nach (save-profile).
      const photo = mitInitialen(ergebnis.photo, vorher.initials || initialsOf(vorher.name));
      const geaendert = photo !== (vorher.photo || null) || ergebnis.color !== vorher.color;
      // EIN Schreibweg für das eigene Bild (spec/08 §1): repo.updateSettings — Bild und Farbe gemeinsam.
      if (geaendert) repo.updateSettings({ photo, color: ergebnis.color });
      ui.pb = null;
      ui.sheet = 'profil';
      ctx.render();
      if (geaendert) ctx.toast(tx('Profilbild übernommen'));
    },    // Scrim/Schließen-Knopf: nur bei echter Änderung nachfragen (Ü4).
    'close-home-sheet': () => closeHomeSheet(ctx),
    // v5 A30a: Neue Eintraege entstehen nur noch ueber ihr eigenes Sheet — hier gibt es
    // keinen halb getippten Text mehr, der beim Schliessen gerettet werden muesste.
    // v4 P0-4-2b: Aus dem Detail führt „Fertig" zurück in die Ressourcenliste, nicht auf
    // die Profil-Startseite.
    'commit-home-sheet': () => {
      if (ui.sheet === 'res-detail') {
        if (!commitResourceName()) return;
        backHomeSheet(ctx, { commit: true });
        return;
      }
      closeHomeSheet(ctx, { commit: true });
    },
    // Rückweg aus dem Detail ohne Übernahme des Namensentwurfs (Ü4 fragt bei Änderung).
    'res-detail-back': () => backHomeSheet(ctx),

    'save-profile': () => {
      const name = (ui.editName ?? settings.name).trim() || settings.name;
      // v6 A19e: homeAddress wird hier bewusst NICHT mehr geschrieben.
      const aktuell = repo.getSettings();
      repo.updateSettings({
        name,
        initials: initialsOf(name),
        color: aktuell.color,
        // v7 A36c: Das Bild gehört zum Profil und wird an derselben EINEN Stelle
        // geschrieben wie Name und Farbe. Runde 3: Ein gestaltetes Bild ohne Motiv trägt die
        // Initialen im Bild — sie ziehen mit dem Namen mit.
        photo: mitInitialen(aktuell.photo || null, initialsOf(name)),
      });
      closeHomeSheet(ctx, { commit: true });
      ctx.toast(tx('Profil gespeichert'));
    },
    // v6 A19c: Tap auf eine bestehende Zeile öffnet direkt ihre Bearbeitung, die Plus-Zeile
    // den Neu-Anlegen-Zustand — beides im selben Sheet-Host, ohne Zwischenliste.
    'int-kat': (data) => { ui.offeneKat = ui.offeneKat === data.kat ? null : data.kat; ctx.render(); },
    'int-open': (data) => openHomeSheet(ctx, 'int-detail', () => {
      ui.intFor = data.name;
      ui.intNameDraft = data.name;
      ui.intLevelDraft = (repo.getSettings().interestLevels || {})[data.name] || 1;
    }, { stack: true }),
    'int-remove': (data) => {
      const current = repo.getSettings();
      const levels = { ...current.interestLevels };
      delete levels[data.name];
      repo.updateSettings({ interests: (current.interests || []).filter((n) => n !== data.name), interestLevels: levels });
      backHomeSheet(ctx, { commit: true });
      ctx.toast(tx('Interesse entfernt'));
    },
    'int-add-row': () => openHomeSheet(ctx, 'int-detail', () => { ui.intFor = null; ui.intNameDraft = ''; ui.intLevelDraft = 1; }, { stack: true }),
    // v7 A31e: Ein Tap in der kategorisierten Liste uebernimmt das Interesse in das Feld —
    // das Freitextfeld bleibt daneben als sichtbare Zusatzaktion bestehen.
    'int-pick': (data) => {
      ui.intNameDraft = ui.intNameDraft === data.name ? '' : data.name;
      ctx.render();
    },
    'int-level-draft': (data) => { ui.intLevelDraft = Number(data.level); ctx.render(); },
    'int-detail-back': () => backHomeSheet(ctx),
    'int-create': () => { if (createInterest()) backHomeSheet(ctx, { commit: true }); },
    'int-save': () => { if (saveInterest()) backHomeSheet(ctx, { commit: true }); },
    'res-open': (data) => openResourceDetail(ctx, data.name),
    'res-add-row': () => openHomeSheet(ctx, 'res-detail', () => {
      ui.resNew = true;
      ui.resFor = null;
      ui.resNameDraft = '';
      ui.resDraftMeta = { availability: 'manchmal', capacity: null, privat: false };
    }, { stack: true }),
    'res-create': () => { if (createResource()) backHomeSheet(ctx, { commit: true }); },
    'res-avail': (data) => writeResMeta({ availability: availabilityOf(data.kind) }),
    // v7 A32b: Das Wheel schreibt denselben Wert wie zuvor der Stepper; 0 bedeutet „—".
    'wheel-set': (data) => {
      if (String(data.col || '').startsWith('belegt-')) { belegtRad(data.col, data.value); return; }
      if (data.col !== 'cap') return;
      const wert = Number(data.value);
      writeResMeta({ capacity: wert > 0 ? wert : null });
    },
    // Runde 4 (B5): Keine Zeit — anlegen, ändern, entfernen.
    'belegt-add': () => openHomeSheet(ctx, 'belegt', () => {
      ui.belegtEntwurf = { index: null, tage: [1, 2, 3, 4, 5], von: '08:00', bis: '17:00' };
    }),
    'belegt-open': (data) => {
      const fenster = belegtBereinigen(repo.getSettings().belegt)[Number(data.index)];
      if (!fenster) return;
      openHomeSheet(ctx, 'belegt', () => {
        ui.belegtEntwurf = { index: Number(data.index), tage: [...fenster.tage], von: aufFuenfMinuten(fenster.von), bis: aufFuenfMinuten(fenster.bis) };
      });
    },
    'belegt-tag': (data) => {
      const entwurf = ui.belegtEntwurf;
      if (!entwurf) return;
      const tag = Number(data.tag);
      entwurf.tage = entwurf.tage.includes(tag) ? entwurf.tage.filter((t) => t !== tag) : [...entwurf.tage, tag];
      haptik('tipp');
      ctx.render();
    },
    'belegt-vorlage': (data) => {
      const entwurf = ui.belegtEntwurf;
      if (!entwurf) return;
      entwurf.tage = String(data.tage || '').split(',').map(Number).filter((tag) => tag >= 0 && tag <= 6);
      haptik('tipp');
      ctx.render();
    },
    'belegt-save': () => {
      const entwurf = ui.belegtEntwurf;
      if (!entwurf) return;
      if (!entwurf.tage.length) { ctx.toast(tx('Wähl mindestens einen Tag')); return; }
      if (entwurf.von === entwurf.bis) { ctx.toast(tx('Von und Bis sind gleich')); return; }
      const liste = belegtBereinigen(repo.getSettings().belegt);
      const fenster = { tage: [...entwurf.tage].sort((a, b) => a - b), von: entwurf.von, bis: entwurf.bis };
      if (entwurf.index === null || !liste[entwurf.index]) liste.push(fenster);
      else liste[entwurf.index] = fenster;
      const neu = entwurf.index === null;
      repo.updateSettings({ belegt: belegtSortiert(belegtBereinigen(liste)) });
      haptik('erfolg');
      closeHomeSheet(ctx, { commit: true });
      ctx.toast(neu ? tx('Zeiten hinzugefügt') : tx('Zeiten gespeichert'));
    },
    'belegt-remove': () => {
      const entwurf = ui.belegtEntwurf;
      if (!entwurf || entwurf.index === null) return;
      const liste = belegtBereinigen(repo.getSettings().belegt).filter((_, index) => index !== entwurf.index);
      repo.updateSettings({ belegt: liste });
      closeHomeSheet(ctx, { commit: true });
      ctx.toast(tx('Zeiten entfernt'));
    },
    // v7 A32c: privat/nicht privat je Ressource. Die WIRKSAME Freigabe entsteht daraus
    // zusammen mit der Regel aus den Einstellungen (projiziereFreigaben).
    // R1 §6.2: Selbst ausgesuchtes Zeichen. `null` heißt „wieder automatisch".
    'res-icon-open': () => openHomeSheet(ctx, 'res-icon', null, { stack: true }),
    'res-icon-back': () => backHomeSheet(ctx, { commit: true }),
    'res-icon-set': (data) => schreibeZeichen(data.key),
    'res-icon-auto': () => schreibeZeichen(null),
    'res-private': () => {
      if (ui.resNew) {
        ui.resDraftMeta = { ...(ui.resDraftMeta || {}), privat: !(ui.resDraftMeta || {}).privat };
        ctx.render();
        return;
      }
      const current = repo.getSettings();
      const label = ui.resFor;
      const naechste = { ...(current.resourcePrivate || {}) };
      if (naechste[label]) delete naechste[label]; else naechste[label] = true;
      projiziereFreigaben(repo, { resourcePrivate: naechste });
    },
    'res-remove': (data) => {
      const current = repo.getSettings();
      const meta = { ...current.resourceMeta };
      const privat = { ...(current.resourcePrivate || {}) };
      delete meta[data.name];
      delete privat[data.name];
      projiziereFreigaben(repo, { resources: (current.resources || []).filter((n) => n !== data.name), resourceMeta: meta, resourcePrivate: privat });
      // v6 A19a: Ohne Zwischenliste führt das Entfernen direkt zurück auf die Profilseite.
      ui.resFor = null;
      backHomeSheet(ctx, { commit: true });
      ctx.toast(tx('Ressource entfernt'));
    },
  });
}

// ============================================================================
// 06.2 Meine Meets (gemeinsamer Meet-Browser, Kontext mine)
// ============================================================================

// v3.1 §3: „Meine Meets" zeigt AUSSCHLIESSLICH persönliche vergangene/abgeschlossene
// Meets — kein Kommend/Verlauf-Umschalter. Der gemeinsame Meet-Browser liefert dafür
// `history:'only'`; die eigene Titelzeile trägt Zurück + Titel (title ' ' lässt die
// Browser-Kopfzeile nur ihre Ansichts-Umschalter zeigen).
const MY_MEETS_OPTS = { context: { mine: true }, uiKey: 'myMeets', title: ' ', history: 'only' };

function renderMyMeets(ctx) {
  const parts = meetBrowserParts(ctx, MY_MEETS_OPTS);
  const html = screenScaffold({
    header: `${subHeader(tx('Meine Meets'))}${parts.header}`,
    body: parts.body,
    bottom: parts.bottom,
    bottomInset: parts.contentInset ?? 28,
    overlays: parts.overlays,
    scrollKey: `my-meets-${parts.view}`,
  });
  return {
    html,
    bind: (root, innerCtx) => {
      bindMeetBrowserBody(root, innerCtx, MY_MEETS_OPTS);
    },
  };
}

// ============================================================================
// QR-Einladung (Vertrag §9) — Slide-up von profile.home & friendAdd
// ============================================================================

// Die Adresse im QR-Code muss WIRKLICH irgendwo hinführen. `https://crew.app/i/…` war eine
// erfundene Adresse — wer den Code mit der Kamera scannt, landete im Nichts. Gezeigt wird
// deshalb die Adresse, unter der die App tatsächlich läuft: dieselbe, aus der die Seite
// gerade geladen wurde, plus den Code als Parameter. Für die Demo als Dateisammlung (kein
// Server) bleibt die veröffentlichte Adresse der Rückfall.
const CREW_ADRESSE_FALLBACK = 'https://desteny-dev.github.io/crew-app/';

// Runde 3 (Chef): In der nativen App ist die eigene Adresse „https://localhost" (Android) bzw.
// „capacitor://localhost" (iOS). Ein QR dorthin führt auf dem Handy des Freundes ins Nichts —
// dort gilt deshalb immer die veröffentlichte Adresse. Der Prüfserver (localhost MIT Port)
// bleibt bei seiner eigenen Adresse.
function inNativerApp() {
  if (globalThis.Capacitor?.isNativePlatform?.()) return true;
  const ort = globalThis.location;
  return Boolean(ort && ort.hostname === 'localhost' && !ort.port);
}

export function inviteUrl(code) {
  const ort = globalThis.location;
  const basis = ort && /^https?:$/.test(ort.protocol) && !inNativerApp()
    ? `${ort.origin}${ort.pathname.replace(/[^/]*$/, '')}`
    : CREW_ADRESSE_FALLBACK;
  return `${basis}?einladung=${encodeURIComponent(code)}`;
}

// v6 A20c: Die beiden Zustände des Sheets belegen exakt dieselbe Fläche. Deshalb sind
// Codefeld, Codezeile und Aktionszeile FESTE Maße statt inhaltsabhängiger Höhen — vorher
// fiel die Karte beim Umschalten um 112 px zusammen (604 → 492 px in 390x844).
const QR_BOX = 196;          // äußerer Rahmen des Codebereichs (kompakt)
const QR_INNER = 188;        // Kantenlänge von QR-Grafik bzw. Kamerafläche
// v7 A13a: Der zweite, kleinere Codebereich des aufgezogenen Zustands ist ersatzlos
// entfallen — der QR hat in JEDER Sheet-Höhe dieselbe Größe und dieselbe Position.
const CODE_ROW_H = 46;
const ACTION_ROW_H = 46;

// v6 A08g: Die Kamerafläche war eine vollschwarze 172er Kachel. Sie ist jetzt eine ruhige
// getönte Fläche mit grünen Sucherecken, Kamerasymbol und Beschriftung — als Kamerafeld
// unverwechselbar, ohne dominantes Schwarz.
//
// Runde 3 (D4, Jonathan: „Funktioniert die Kamera zum QR-Scannen wirklich?"): Jetzt ja — der
// Scanner (web/ui/qr-scanner.js) legt das Kamerabild in dieses Feld. Ebenen:
//   0  Grund: Kamerazeichen mit „QR-Code scannen" — oder ein ruhiger Hinweis, wenn die Kamera
//      nicht geht (die Code-Eingabe darunter bleibt immer)
//   1  [data-qr-kamera] mit data-fremd: Hier liegt das Video. Der Abgleich fasst den Inhalt
//      nicht an, deshalb übersteht das laufende Bild jedes Neuzeichnen (Toast, Anfragen …).
//   2  die Sucherecken      3  „Code erkannt" (kurz, bevor die eigene Einladung zurückkommt)
const KAMERA_HINWEIS = {
  verweigert: tx('Kamera nicht freigegeben — gib den Code unten ein.'),
  'keine-kamera': tx('Keine Kamera gefunden — gib den Code unten ein.'),
  'nicht-moeglich': tx('Scannen geht hier nicht — gib den Code unten ein.'),
  unbekannt: tx('Die Kamera startet gerade nicht — gib den Code unten ein.'),
};

function scanSurface(size = QR_INNER, kamera = '') {
  const rand = '2.5px solid var(--green)';
  const ecke = (pos, radius) => `<span style="position:absolute;${pos};width:28px;height:28px;border-radius:${radius};pointer-events:none;z-index:2"></span>`;
  const klein = size < 170;
  const hinweis = KAMERA_HINWEIS[kamera];
  const grund = hinweis
    ? `<span data-role="kamera-hinweis" style="position:relative;display:flex;flex-direction:column;align-items:center;gap:8px;padding:0 28px;text-align:center;pointer-events:none">${svgCameraLens(24, 'var(--muted)')}<span style="font-size:12px;font-weight:600;line-height:1.4;color:var(--ink-soft)">${esc(hinweis)}</span></span>`
    : `<span style="position:relative;display:flex;flex-direction:column;align-items:center;gap:6px;pointer-events:none">${svgCameraLens(klein ? 26 : 32, 'var(--green-dark)')}<span style="font-size:${klein ? 10.5 : 11.5}px;font-weight:650;color:var(--green-dark)">${tx('QR-Code scannen')}</span></span>`;
  const erkannt = kamera === 'erkannt'
    ? `<span data-role="kamera-erkannt" style="position:absolute;inset:0;z-index:3;display:flex;flex-direction:column;align-items:center;justify-content:center;gap:8px;background:var(--green);border-radius:inherit;pointer-events:none"><svg width="34" height="34" viewBox="0 0 24 24" fill="none"><path d="m5.5 12.5 4.2 4.2L18.5 7.8" stroke="var(--on-accent)" stroke-width="2.6" stroke-linecap="round" stroke-linejoin="round"></path></svg><span style="font-size:13px;font-weight:650;color:var(--on-accent)">${tx('Code erkannt')}</span></span>`
    : '';
  return `<div data-qr-scan data-kamera="${esc(kamera || 'an')}" style="width:${size}px;height:${size}px;border-radius:18px;background:var(--field);position:relative;overflow:hidden;flex:none;display:flex;align-items:center;justify-content:center;box-sizing:border-box">
<span style="position:absolute;inset:0;background:radial-gradient(circle at 50% 45%,var(--surface),transparent 66%);pointer-events:none"></span>
${grund}
<div data-qr-kamera data-fremd style="position:absolute;inset:0;border-radius:inherit;z-index:1;pointer-events:none"></div>
${ecke(`left:18px;top:18px;border-left:${rand};border-top:${rand}`, '8px 0 0 0')}
${ecke(`right:18px;top:18px;border-right:${rand};border-top:${rand}`, '0 8px 0 0')}
${ecke(`left:18px;bottom:18px;border-left:${rand};border-bottom:${rand}`, '0 0 0 8px')}
${ecke(`right:18px;bottom:18px;border-right:${rand};border-bottom:${rand}`, '0 0 8px 0')}
${erkannt}
</div>`;
}
// Der Codebereich: außen immer derselbe Rahmen, innen QR-Grafik ODER Kamerafeld.
function codeSurface(scan, code, box = QR_BOX, inner = QR_INNER, kamera = '') {
  // §2.2: EIN Objekt statt drei. Vorher stand eine weiße Kachel mit hartem Rahmen auf
  // einem weißen Sheet — zwei fast gleiche Weiß nebeneinander mit einer Kante dazwischen.
  // Genau das liest sich als „unfertig". Jetzt: Papierton, weiche Ecken, kein Rahmen.
  return `<div style="align-self:center;width:${box}px;height:${box}px;border-radius:26px;background:${scan ? 'var(--surface)' : 'var(--paper)'};display:flex;align-items:center;justify-content:center;box-sizing:border-box;flex:none;box-shadow:inset 0 0 0 1px var(--ink-a06)">${scan ? scanSurface(inner, kamera) : qrSvg(inviteUrl(code), inner)}</div>`;
}

// Code-Zeile (reference 06.3): Kurzcode auf beiger Fläche, Copy-Icon (grüner Haken nach Kopieren).
function inviteCodeRow(code, copied) {
  return `<button data-act="qr-copy" style="display:flex;align-items:center;justify-content:center;gap:10px;background:var(--paper);border-radius:14px;height:${CODE_ROW_H}px;padding:0 16px;border:0;cursor:pointer;appearance:none;width:100%;box-sizing:border-box">
<span style="font-size:16px;font-weight:650;font-family:ui-monospace,monospace;letter-spacing:.12em;color:var(--ink);pointer-events:none">${esc(code)}</span>
<span style="pointer-events:none;display:flex">${copied ? `<svg width="15" height="15" viewBox="0 0 24 24" fill="none"><path d="m5 12.5 4.5 4.5L19 7.5" stroke="var(--green-dark)" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round"></path></svg>` : svgCopy}</span></button>`;
}

// v6 A20b: An der Stelle des EIGENEN Codes steht im Hinzufügen-Zustand das Feld für den
// fremden Code — gleiche Höhe, gleiche Position, nur anderer Inhalt.
function codeSlot(scan, code, copied) {
  if (!scan) return inviteCodeRow(code, copied);
  return `<input id="qr-code-input" placeholder="${esc(tx('Code eingeben'))}" aria-label="${esc(tx('Code von Freund:in eingeben'))}" autocomplete="off" autocapitalize="characters" style="width:100%;height:${CODE_ROW_H}px;box-sizing:border-box;padding:0 12px;border:1.5px solid var(--green-a50);border-radius:14px;background:var(--surface);outline:none;font:650 15px ui-monospace,monospace;letter-spacing:.08em;text-align:center;color:var(--ink);caret-color:var(--green);text-transform:uppercase">`;
}

// Genau EINE Hauptaktion je Zustand — dieselbe Höhe, damit das Sheet nicht springt.
function actionSlot(scan) {
  const pille = (act, icon, label) => `<button data-act="${act}" style="width:100%;height:${ACTION_ROW_H}px;box-sizing:border-box;background:var(--green);border:0;display:flex;align-items:center;justify-content:center;gap:8px;border-radius:999px;font:650 14px ${FONT};color:var(--on-accent);cursor:pointer;appearance:none"><span style="pointer-events:none;display:flex">${icon}</span><span style="pointer-events:none">${label}</span></button>`;
  return scan ? pille('qr-code-submit', svgSendWhite, tx('Anfrage senden')) : pille('qr-share', svgShareWhite, tx('Teilen'));
}

// Kopfzeile des Einladungs-Sheets: Avatar · Name/Zustand · Umschalter (reference 06.3).
//
// v6 A20b: EIN Knopf oben rechts schaltet zwischen „meine Einladung" und „Freund
// hinzufügen" — und wieder zurück. Vorher lagen Hin- und Rückweg als zwei verschiedene
// Controls am unteren Rand des Sheets; oben stand nur ein nicht bedienbares Logo.
// Die Freundesanfragen bleiben davon unberührt: sie öffnen sich weiterhin nur durch
// Hochziehen des Sheets.
function qrToggleButton(scan) {
  const ton = scan ? { rand: 'var(--ink-a14)', flaeche: 'var(--surface)', schrift: 'var(--ink)' } : { rand: 'var(--green-a45)', flaeche: 'var(--green-tint)', schrift: 'var(--green-dark)' };
  return `<button data-act="qr-toggle" aria-pressed="${scan}" aria-label="${esc(scan ? tx('Zurück zu meiner Einladung') : tx('Freund hinzufügen'))}" style="display:flex;align-items:center;gap:7px;height:36px;padding:0 13px;border-radius:999px;border:1.5px solid ${ton.rand};background:${ton.flaeche};box-sizing:border-box;cursor:pointer;appearance:none;flex:none;font-family:${FONT}">
<span style="pointer-events:none;display:flex">${scan ? svgQrMini : svgPersonPlusGreen}</span>
<span style="font-size:12.5px;font-weight:650;color:${ton.schrift};white-space:nowrap;pointer-events:none">${scan ? tx('Meine Einladung') : tx('Hinzufügen')}</span></button>`;
}

function inviteHeaderRow(me, scan) {
  return `<div style="display:flex;align-items:center;gap:12px;padding:0 2px 4px">
${personAvatar(me, { size: 44, fontSize: 16 })}
<div style="display:flex;flex-direction:column;gap:1px;flex:1;min-width:0"><span style="font-family:${BRICOLAGE};font-size:19px;font-weight:650;letter-spacing:-.01em;line-height:1.15;white-space:nowrap;overflow:hidden;text-overflow:ellipsis">${esc(me.name)}</span><span style="font-size:12px;color:var(--muted);white-space:nowrap;overflow:hidden;text-overflow:ellipsis">${scan ? tx('Freund hinzufügen') : tx('Einladen')}</span></div>
${qrToggleButton(scan)}</div>`;
}

// Erhaltene Anfrage: runde Controls in RSVP-Sprache (reference 06.3b/06.12).
function requestControls(requestId, size = 30) {
  return `<div style="display:flex;gap:6px;flex:none">
<button data-act="req-accept" data-request="${esc(requestId)}" data-treffer aria-label="${esc(tx('Annehmen'))}" style="width:${size}px;height:${size}px;border-radius:50%;background:var(--green);border:0;display:flex;align-items:center;justify-content:center;cursor:pointer;appearance:none;padding:0"><svg width="${size === 30 ? 14 : 15}" height="${size === 30 ? 14 : 15}" viewBox="0 0 24 24" fill="none" style="pointer-events:none"><path d="m7.5 12.5 3 3 6-6.5" stroke="var(--on-accent)" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round"></path></svg></button>
<button data-act="req-decline" data-request="${esc(requestId)}" data-treffer aria-label="${esc(tx('Ablehnen'))}" style="width:${size}px;height:${size}px;border-radius:50%;border:1.5px solid var(--ink-a14);background:transparent;box-sizing:border-box;display:flex;align-items:center;justify-content:center;cursor:pointer;appearance:none;padding:0"><svg width="12" height="12" viewBox="0 0 24 24" fill="none" style="pointer-events:none"><path d="M7 7l10 10M17 7 7 17" stroke="var(--muted)" stroke-width="2.4" stroke-linecap="round"></path></svg></button>
</div>`;
}

// Gesendete Anfrage normalisieren (Seed-Eintrag mit Name oder Code-Einlösung aus dem Demo-Gateway).
function outgoingView(entry) {
  if (entry.name) return { id: entry.id, name: entry.name, initials: entry.initials || '–', color: entry.color || 'var(--muted-light)', meta: entry.meta || tx('gesendet') };
  return { id: entry.id, name: entry.code || tx('Einladung'), initials: (entry.code || '??').slice(0, 2), color: 'var(--muted-light)', meta: tx('Kurzcode · gerade eben') };
}

function outgoingRow(entry, options = {}) {
  const view = outgoingView(entry);
  // 06.3b: Zustand („Wartet") plus Weg; 06.12 (Karte): nur der Weg, sonst wird die Zeile knapp.
  const secondLine = options.card
    ? `<span style="font-size:12px;color:var(--muted);min-width:0;white-space:nowrap;overflow:hidden;text-overflow:ellipsis">${esc(view.meta)}</span>`
    : `<span style="display:flex;align-items:center;gap:5px;min-width:0"><span style="width:5px;height:5px;border-radius:50%;background:var(--orange-dark);flex:none"></span><span style="font-size:11.5px;font-weight:650;color:var(--orange-dark)">${tx('Wartet')}</span><span style="font-size:11.5px;color:#D3CCC0">·</span><span style="font-size:11.5px;color:var(--muted);min-width:0;white-space:nowrap;overflow:hidden;text-overflow:ellipsis">${esc(view.meta)}</span></span>`;
  return `<div style="display:flex;align-items:center;gap:11px;padding:12px 0;border-top:1px solid rgba(33,30,26,.0${options.card ? '5' : '6'})">
${personAvatar(view, { size: options.card ? 40 : 38, fontSize: 14 })}
<div style="display:flex;flex-direction:column;gap:2px;flex:1;min-width:0"><span style="font-size:14.5px;font-weight:650;white-space:nowrap;overflow:hidden;text-overflow:ellipsis">${esc(view.name)}</span>
${secondLine}</div>
<button data-act="out-withdraw" data-out="${esc(view.id)}" data-treffer style="font:650 ${options.card ? 12 : 11.5}px/1 ${FONT};color:var(--ink-soft);border:1.5px solid var(--ink-a14);background:transparent;border-radius:999px;padding:${options.card ? '9px 13px' : '7px 12px'};flex:none;cursor:pointer;appearance:none">${tx('Zurückziehen')}</button>
</div>`;
}

// v7 A13 (spec/03 §4): EIN Aufbau für jede Sheet-Höhe. Vorher gab es zwei vollständig
// verschiedene Markups — beim Aufziehen sprang der QR von 196 auf 158 px, wanderte von der
// Mitte an den linken Rand, und Code/Teilen klappten in eine zweite Spalte daneben. Die
// Anfragen existierten im kompakten Zustand überhaupt nicht; an ihrer Stelle stand eine
// zusammenfassende Kachel mit angeschnittener Vorschauzeile. Beides ist entfallen: der
// obere Bereich (QR · Code · Teilen) steht FEST, darunter läuft eine durchgehende Liste,
// und das Aufziehen gibt ihr nur mehr Platz.
const QR_KOMPAKT_H = 556;   // fester oberer Bereich plus Anfang der Anfrageliste

function qrOverlay(ctx) {
  const { repo, ui } = ctx;
  const me = repo.getMe();
  const settings = repo.getSettings();
  const code = repo.getInviteCode();
  const requests = repo.getFriendRequests() || [];
  const outgoing = settings.outgoingRequests || [];
  const scan = ui.qrView === 'scan';
  const offen = Boolean(ui.qrExpanded);

  const leerZeile = (text) => `<div style="padding:12px 0;border-top:1px solid var(--ink-a06)"><span style="font-size:12.5px;color:var(--muted)">${esc(text)}</span></div>`;
  const receivedRows = requests.length
    ? requests.map((request) => `<div style="display:flex;align-items:center;gap:11px;padding:12px 0;border-top:1px solid var(--ink-a06)">
${personAvatar(request, { size: 38, fontSize: 14 })}
<div style="display:flex;flex-direction:column;gap:1px;flex:1;min-width:0"><span style="font-size:14.5px;font-weight:650;white-space:nowrap;overflow:hidden;text-overflow:ellipsis">${esc(request.name)}</span><span style="font-size:11.5px;color:var(--muted);white-space:nowrap;overflow:hidden;text-overflow:ellipsis">${esc(request.meta || tx('über Link'))}</span></div>
${requestControls(request.id)}
</div>`).join('')
    : leerZeile(tx('Keine offenen Anfragen'));
  const outgoingRows = outgoing.length
    ? outgoing.map((entry) => outgoingRow(entry)).join('')
    : leerZeile(tx('Keine gesendeten Anfragen'));

  const abschnitt = (text) => `<div style="padding:4px 2px 8px"><span style="font-size:11px;font-weight:650;letter-spacing:.09em;text-transform:uppercase;color:var(--muted-light)">${esc(text)}</span></div>`;

  return `<div style="position:absolute;inset:0;z-index:14">
<div data-act="qr-close" style="position:absolute;inset:0;background:var(--scrim);-webkit-backdrop-filter:var(--scrim-filter);backdrop-filter:var(--scrim-filter)"></div>
<div data-qr-card class="ui-sheet-card" data-qr-state="${offen ? 'offen' : 'kompakt'}" style="position:absolute;left:0;right:0;bottom:0;height:${offen ? 'calc(100% - 48px)' : `min(${QR_KOMPAKT_H}px, calc(100% - 48px))`};background:var(--surface);border-radius:28px 28px 0 0;padding:14px 22px 0;display:flex;flex-direction:column;gap:14px;box-shadow:0 -8px 24px var(--shadow-18);overflow:hidden">
${sheetDecor}
${grabber(offen ? 'qr-collapse' : 'qr-expand')}
<div style="position:relative;flex:none;display:flex;flex-direction:column;gap:14px">
${inviteHeaderRow(me, scan)}
${codeSurface(scan, code, QR_BOX, QR_INNER, ui.qrKamera || '')}
${codeSlot(scan, code, ui.copied)}
${actionSlot(scan)}
</div>
<div style="position:relative;flex:1;min-height:0;overflow-y:auto;scrollbar-width:none;padding-bottom:24px;border-top:1px solid var(--ink-a08)" data-scroll-keep="invite-requests">
${abschnitt(tx('Erhalten · {n}', { n: requests.length }))}
${receivedRows}
<div style="padding:14px 2px 6px"><span style="font-size:11px;font-weight:650;letter-spacing:.09em;text-transform:uppercase;color:var(--muted-light)">${tx('Von mir gesendet · {n}', { n: outgoing.length })}</span></div>
${outgoingRows}
</div>
</div>
</div>`;
}

function qrCoreActs(ctx) {
  const { repo, ui } = ctx;
  const code = repo.getInviteCode();
  const markCopied = () => {
    ui.copied = true;
    ctx.render();
    window.setTimeout(() => {
      if (ui.copied) { ui.copied = false; ctx.render(); }
    }, 1600);
  };
  return {
    // v6 A20b: EIN Umschalter für beide Richtungen. Die Freundesanfragen bleiben davon
    // unberührt — sie hängen allein am Zieh-/Aufziehzustand (ui.qrExpanded).
    // Runde 3 (D4): Jeder Wechsel beginnt das Kamerafeld frisch; zurück zur eigenen Einladung
    // schaltet die Kamera sofort aus.
    'qr-toggle': () => {
      ui.qrView = ui.qrView === 'scan' ? 'qr' : 'scan';
      ui.qrKamera = '';
      ui.qrAbgelehnt = '';
      if (ui.qrView !== 'scan') qrScanStoppen();
      ctx.render();
    },
    'qr-copy': () => { copyToClipboard(code); markCopied(); },
    'qr-share': () => {
      if (navigator.share) {
        navigator.share({ title: 'Crew', text: tx('Füge mich in Crew hinzu: {code}', { code }), url: inviteUrl(code) }).catch(() => {});
      } else {
        copyToClipboard(inviteUrl(code));
        markCopied();
      }
    },
    'qr-code-submit': (data, el, event, root) => {
      const input = (root || document).querySelector('#qr-code-input');
      const value = (input?.value || '').trim();
      // v4: Auch ein leeres Feld bekommt eine sichtbare Rueckmeldung. Vorher brach der
      // Handler still ab — ein Knopf, der nichts tut, ist genau der verbotene Anschein.
      // Der Demo-Weg antwortet sofort, der Server-Weg erst nach der Rückfrage (er darf die
      // Codes anderer Leute nicht kennen). Beides wird hier gleich behandelt — und in beiden
      // Fällen erscheint GENAU EIN Toast, nämlich der mit der echten Antwort.
      Promise.resolve(ctx.repo.redeemInviteCode(value)).then((result) => {
        if (!result?.ok) {
          ctx.toast(result?.reason || tx('Code passt nicht'));
          return;
        }
        ui.qrView = 'qr';
        // v4 QR-2: Der Text kommt aus der Datenschicht, damit der Toast die Person nennt
        // ("Anfrage an Pia gesendet") statt einer festen Formel.
        ctx.toast(result.reason || tx('Anfrage gesendet'));
      });
    },
  };
}

// v3.1 §1: Profil-Inhaltskörper mit der Einladung als oberster Overlay-Ebene.
function renderFriendAdd(ctx) {
  // v7 P0: Dieselbe Huelle wie renderProfileHome. Vorher baute diese Route die Seite
  // OHNE Tab-Bahn und mit eigener Bottom-Navigation; dadurch war die Scrollflaeche
  // 744 statt 668 px hoch und die gemerkte Position 240 klemmte sichtbar auf 187.
  const html = screenScaffold({
    page: true,
    header: homeHeader(ctx),
    body: homeBody(ctx),
    bottom: '<div style="pointer-events:none;height:26px"></div>',
    bottomInset: TABBAR_INSET + CONTENT_INSET,
    overlays: qrOverlay(ctx),
    scrollKey: 'profile-home',
  });
  return { html, bind: bindFriendAdd };
}

// Gemeinsame Anfrage-Aktionen (06.3b und 06.12). v3.1 §4: Annehmen, Ablehnen und
// Zurückziehen melden sich als kurzes Toast — kein Bestätigungs-Sheet für einen Hinweis.
function requestActs(ctx) {
  const { repo } = ctx;
  return {
    'req-accept': (data) => {
      const request = (repo.getFriendRequests() || []).find((entry) => entry.id === data.request);
      const firstName = (request?.name || '').split(' ')[0];
      repo.acceptFriendRequest(data.request);
      ctx.toast(firstName ? tx('{name} ist jetzt dein Freund', { name: firstName }) : tx('Anfrage angenommen'));
    },
    'req-decline': (data) => {
      repo.declineFriendRequest(data.request);
      ctx.toast(tx('Anfrage abgelehnt'));
    },
    'out-withdraw': (data) => {
      const outgoing = repo.getSettings().outgoingRequests || [];
      repo.updateSettings({ outgoingRequests: outgoing.filter((entry) => entry.id !== data.out) });
      ctx.toast(tx('Anfrage zurückgezogen'));
    },
  };
}

// v5 A20: Zwei verkettete Stufen.
//   Stufe 1 — der CONTAINER wächst mit dem Zug (stufenlos, in lokalen Koordinaten des
//             Telefonrahmens; eine CSS-Skalierung der Vorschau wird herausgerechnet).
//   Stufe 2 — erst in der Maximalhöhe gibt die innere Anfrageliste ihr eigenes Scrollen
//             frei; darunter bleibt sie gesperrt, damit nicht beide Ebenen gleichzeitig
//             reagieren. Der obere Bereich (QR, Code, Aktionen) steht dabei fest.
// Ein Zug nach unten führt zurück in die kompakte Lage.
function bindQrZug(root, ctx) {
  const rahmen = root.querySelector('.runtime-phone') || root;
  const karteJetzt = () => root.querySelector('[data-qr-card]');
  const karte = karteJetzt();
  if (!karte) return;
  const liste = karte.querySelector('[data-scroll-keep="invite-requests"]');
  // Auftrag §4.4: Zuerst wächst das FELD, dann scrollt die Liste.
  //
  // Vorher galt Fable J10: Die Liste scrollte in jedem Zustand, und das Sheet wuchs nur
  // über den Griff. Wer im kompakten Zustand in der Liste nach oben wischte, scrollte
  // sofort an den Inhalten vorbei, statt das Feld aufzuziehen — genau der Befund aus dem
  // Test am Handy.
  //
  // Jetzt: Im kompakten Zustand gehört jede Aufwärtsbewegung dem Sheet (die Liste scrollt
  // dort gar nicht, deshalb overflow: hidden). Ganz oben gehört sie der Liste. Nach unten
  // umgekehrt: erst die Liste an ihren Anfang, dann schrumpft das Feld.
  if (liste) liste.style.overflowY = ctx.ui.qrExpanded ? 'auto' : 'hidden';

  // Die Karte wird beim Zustandswechsel ausgetauscht; die Geste haengt deshalb am
  // Rahmen und am Fenster, nicht an der Karte. Der Merker sitzt am Rahmen.
  if (rahmen.__qrZug) return;
  rahmen.__qrZug = true;
  let start = null;

  const masse = () => {
    const r = rahmen.getBoundingClientRect();
    const skala = rahmen.offsetWidth ? r.width / rahmen.offsetWidth : 1;
    const max = Math.max(160, rahmen.offsetHeight - 48);
    return { max, kompakt: Math.min(QR_KOMPAKT_H, max), skala: skala || 1 };
  };
  const schleierVon = (k) => k?.parentElement?.querySelector(':scope > [data-act="qr-close"]') || null;
  // Dieselbe Schwelle wie jedes andere Sheet (core/html.js › sheetWischen): 28 % der Höhe, 72–160 px.
  const schwelleVon = (hoehe) => Math.max(72, Math.min(160, hoehe * 0.28));

  // Runde 4 (Jonathan: „Es ist etwas ruckelig, das Sheet nach oben und nach unten zu schieben."):
  // Vorher änderte jeder Bewegungsschritt die HÖHE der Karte — Layout des ganzen Sheets samt
  // QR-Grafik je Ereignis. Jetzt steht die Karte während des Zugs einmal in voller Höhe und wird
  // nur über `translate` verschoben, gemalt einmal je Bild (requestAnimationFrame), ohne Neuzeichnen.
  // `translate` statt `transform`, weil die Einfahr-Animation `transform` festhält (wie in
  // core/html.js). Erst nach dem Einrasten wechselt der Zustand — mit genau einem Render.
  // Nach unten über die kompakte Lage hinaus folgt die Karte dem Finger weiter; über die Schwelle
  // oder mit Schwung schließt sie (Schleier-Tipp „qr-close"), sonst federt sie zurück.
  let bild = 0;
  let stand = null;
  const malen = () => {
    bild = 0;
    if (!stand) return;
    stand.k.style.translate = `0 ${stand.versatz.toFixed(1)}px`;
    const schleier = schleierVon(stand.k);
    if (schleier) schleier.style.opacity = stand.deckkraft;
  };
  const vorbereiten = (k, hoehe) => {
    const { max } = masse();
    k.setAttribute('data-sheet-zug', 'aktiv');
    schleierVon(k)?.setAttribute('data-sheet-schleier', 'aktiv');
    k.style.top = 'auto';
    k.style.height = `${max}px`;
    k.style.translate = `0 ${(max - hoehe).toFixed(1)}px`;
  };
  const zeigen = (k, hoehe) => {
    const { max, kompakt } = masse();
    const unter = Math.max(0, kompakt - hoehe);
    stand = { k, versatz: max - hoehe, deckkraft: Math.max(0.08, 1 - unter / kompakt).toFixed(3) };
    if (!bild) bild = requestAnimationFrame(malen);
  };
  const aufraeumen = (k) => {
    if (bild) { cancelAnimationFrame(bild); bild = 0; }
    stand = null;
    k.removeAttribute('data-sheet-zug');
    for (const eigenschaft of ['translate', 'transition', 'height', 'top']) k.style.removeProperty(eigenschaft);
    const schleier = schleierVon(k);
    if (schleier) {
      schleier.removeAttribute('data-sheet-schleier');
      schleier.style.removeProperty('opacity');
      schleier.style.removeProperty('transition');
    }
  };
  const QR_KURVE = 'cubic-bezier(.22,.61,.36,1)';
  const gleiten = (k, hoehe, danach) => {
    const { max } = masse();
    if (bild) { cancelAnimationFrame(bild); bild = 0; }
    stand = null;
    k.setAttribute('data-sheet-zug', 'federt');
    const schleier = schleierVon(k);
    schleier?.setAttribute('data-sheet-schleier', 'federt');
    k.__qrGleitet = true;
    requestAnimationFrame(() => {
      if (!k.isConnected) { k.__qrGleitet = false; return; }
      k.style.transition = `translate 260ms ${QR_KURVE}`;
      k.style.translate = `0 ${(max - hoehe).toFixed(1)}px`;
      if (schleier) { schleier.style.transition = `opacity 260ms ${QR_KURVE}`; schleier.style.opacity = '1'; }
      window.setTimeout(() => { k.__qrGleitet = false; if (k.isConnected) danach(); }, 290);
    });
  };

  // Nach einem echten Zug folgt noch ein Klick. Der laege nach dem Neuaufbau auf dem Griff des
  // anderen Zustands und wuerde die Geste sofort rueckgaengig machen — genau dieser eine Klick
  // wird verschluckt. Das eigene Schließen (Schleier-Tipp) gibt ihn vorher frei.
  let schlucker = null;
  const klickFrei = () => {
    if (!schlucker) return;
    window.removeEventListener('click', schlucker, { capture: true });
    schlucker = null;
  };
  const klickSchlucken = () => {
    klickFrei();
    const eigener = (klick) => { klick.stopPropagation(); klick.preventDefault(); if (schlucker === eigener) klickFrei(); };
    schlucker = eigener;
    window.addEventListener('click', eigener, { capture: true });
    window.setTimeout(() => { if (schlucker === eigener) klickFrei(); }, 350);
  };

  const zuschieben = (k) => {
    const { max, kompakt } = masse();
    const schleier = schleierVon(k);
    if (bild) { cancelAnimationFrame(bild); bild = 0; }
    stand = null;
    k.setAttribute('data-sheet-zug', 'zu');
    schleier?.setAttribute('data-sheet-schleier', 'zu');
    haptik('schliessen');
    klickFrei();
    schleier?.click();
    if (!k.isConnected) return;
    if (!k.closest('[data-exit]')) { gleiten(k, kompakt, () => aufraeumen(k)); return; }
    requestAnimationFrame(() => {
      k.style.transition = `translate 240ms ${QR_KURVE}`;
      k.style.translate = `0 ${Math.round(max + 24)}px`;
      if (schleier) { schleier.style.transition = `opacity 240ms ${QR_KURVE}`; schleier.style.opacity = '0'; }
    });
  };

  // v7 A13c (spec/03 §3): Die Geste beginnt am Griff ODER im Inhalt. Im kompakten Zustand
  // zieht die erste Aufwärtsbewegung im Inhalt das Sheet auf; im Maximalzustand gehört sie
  // der inneren Liste, und erst ein bewusstes Herunterziehen bei scrollTop 0 gibt sie
  // wieder an das Sheet zurück. So konkurrieren nie beide Ebenen um dieselbe Bewegung.
  //
  // Runde 3 (Jonathan, D3): „Es soll auch nach oben gehen, wenn ich irgendwo im Sheet scrolle
  // oder wische — Scrollen und Wischen ohne Unterschied, überall im Slide-up." Die Geste beginnt
  // deshalb ÜBERALL auf der Karte (Kopf, Code, Knöpfe, Liste), nicht mehr nur am Griff und in
  // der Liste. Ein Tipp bleibt ein Tipp (erst ab 5 px wird gezogen). Mit der Maus nicht in
  // einem Eingabefeld — dort markiert man Text.
  const beginn = (x, y, ziel, maus = false) => {
    const k = karteJetzt();
    if (!k || !ziel || !ziel.closest || !k.contains(ziel) || k.__qrGleitet) { start = null; return; }
    if (maus && ziel.closest('input, textarea')) { start = null; return; }
    const liste = k.querySelector('[data-scroll-keep="invite-requests"]');
    const ausListe = !ziel.closest('[data-qr-grab]') && Boolean(liste && liste.contains(ziel));
    start = { y, hoehe: k.offsetHeight, bewegt: false, ausListe, liste, letzte: null, spur: [], ueber: false };
  };

  // Rückgabe: true, wenn das Sheet die Bewegung übernommen hat (dann kein natives Scrollen).
  const zug = (y, zeit) => {
    const k = karteJetzt();
    if (!start || !k) return false;
    const { max, kompakt, skala } = masse();
    const dy = (start.y - y) / skala;            // > 0 = nach oben gezogen
    if (!start.bewegt) {
      if (Math.abs(dy) < 5) return false;
      if (start.ausListe) {
        const scroll = start.liste ? start.liste.scrollTop : 0;
        const ganzOben = start.hoehe >= max - 2;
        // §4.4: nach oben — solange das Feld nicht ganz oben ist, wächst es; danach
        // scrollt die Liste. Nach unten — solange die Liste nicht an ihrem Anfang steht,
        // scrollt sie; erst dann schrumpft das Feld.
        if (dy > 0 ? ganzOben : scroll > 0) { start = null; return false; }
      }
      start.bewegt = true;
      vorbereiten(k, start.hoehe);
    }
    const hoehe = Math.max(0, Math.min(max, start.hoehe + dy));
    start.letzte = hoehe;
    start.spur.push({ t: zeit, y: y / skala });
    if (start.spur.length > 8) start.spur.shift();
    // Über der Schliess-Schwelle einmal spürbar — wie ein Rasten.
    const ueber = hoehe < kompakt - schwelleVon(kompakt);
    if (ueber !== start.ueber) { start.ueber = ueber; if (ueber) haptik('grenze'); }
    zeigen(k, hoehe);
    return true;
  };

  const ende = () => {
    const k = karteJetzt();
    if (!start || !k) { start = null; return; }
    const { bewegt, spur } = start;
    const ausgang = start.hoehe;
    const hoehe = start.letzte ?? ausgang;
    start = null;
    if (!bewegt) return;                        // reiner Tap: der data-act uebernimmt
    klickSchlucken();
    const { max, kompakt } = masse();
    // Unter die kompakte Lage gezogen: schließen über die Schwelle oder mit Schwung (> 0,5 px/ms).
    const letzte = spur[spur.length - 1];
    const fenster = letzte ? spur.filter((p) => p.t >= letzte.t - 100) : [];
    const v = fenster.length > 1 ? (letzte.y - fenster[0].y) / Math.max(1, letzte.t - fenster[0].t) : 0;
    const unter = kompakt - hoehe;
    if (unter > 0 && v > -0.2 && (unter > schwelleVon(kompakt) || (v > 0.5 && unter > 24))) {
      zuschieben(k);
      return;
    }
    // v7 A13c: Aus der Maximalhöhe heraus schließt das Sheet erst nach einem bewussten
    // Herunterziehen über die Schwelle (56 px, im Band 48–64 px aus spec/03 §3). Vorher
    // genügte jede noch so kleine Abwärtsbewegung, weil der Mittelwert bei ausgang = max
    // genau max war. Von unten herauf bleibt es beim Mittelwert.
    const warOffen = ausgang >= max - 2;
    const offen = warOffen
      ? (ausgang - hoehe) < 56
      : (hoehe > (ausgang + max) / 2 || hoehe > max * 0.9);
    // v6 A20b: Der Zieh-Zustand und der Inhalts-Zustand sind getrennt. Ein Zug nach unten
    // schaltet den Inhalt NICHT mehr heimlich auf die eigene Einladung zurück — dafür gibt
    // es genau einen sichtbaren Umschalter oben rechts.
    gleiten(k, offen ? max : kompakt, () => {
      aufraeumen(k);
      ctx.ui.qrExpanded = offen;
      ctx.render();
    });
  };

  rahmen.addEventListener('pointerdown', (e) => { if (e.pointerType !== 'touch') beginn(e.clientX, e.clientY, e.target, true); });

  // Runde 3 (D3): Mausrad und Trackpad folgen derselben Regel wie das Wischen. Das Sheet
  // wächst mit dem Scrollen mit und rastet nach einer kurzen Pause ein. Eine Folge von
  // Rad-Ereignissen gehört als Ganzes EINER Ebene — so zieht der Nachlauf eines Listen-
  // Scrolls das Sheet nicht versehentlich zu.
  let rad = null;
  const radEnde = () => {
    const k = karteJetzt();
    const folge = rad;
    rad = null;
    if (!folge || folge.besitzer !== 'sheet' || !k || !folge.bereit) return;
    const { max, kompakt } = masse();
    const offen = folge.warOffen ? folge.summe > -24 : folge.summe > 24;
    gleiten(k, offen ? max : kompakt, () => {
      aufraeumen(k);
      ctx.ui.qrExpanded = offen;
      ctx.render();
    });
  };
  rahmen.addEventListener('wheel', (e) => {
    const k = karteJetzt();
    if (!k || !k.contains(e.target) || Math.abs(e.deltaY) <= Math.abs(e.deltaX)) return;
    if (k.__qrGleitet) { if (e.cancelable) e.preventDefault(); return; }
    const liste = k.querySelector('[data-scroll-keep="invite-requests"]');
    const schritt = e.deltaMode === 1 ? e.deltaY * 16 : e.deltaY;
    if (!rad) {
      const warOffen = Boolean(ctx.ui.qrExpanded);
      const inListe = Boolean(liste && liste.contains(e.target));
      // Offen gehört das Scrollen nach unten der Liste; nach oben auch — bis sie an ihrem
      // Anfang steht. Außerhalb der Liste zieht nach oben das Sheet zu.
      const besitzer = warOffen && (schritt > 0 || (inListe && liste.scrollTop > 0)) ? 'liste' : 'sheet';
      rad = { besitzer, warOffen, summe: 0, hoehe: k.offsetHeight, uhr: 0, bereit: false };
    }
    clearTimeout(rad.uhr);
    rad.uhr = setTimeout(radEnde, 160);
    if (rad.besitzer === 'liste') {
      // Über Kopf und Code scrollt das Rad die Liste mit — „überall im Slide-up".
      if (liste && !liste.contains(e.target)) {
        liste.scrollTop += schritt;
        if (e.cancelable) e.preventDefault();
      }
      return;
    }
    if (e.cancelable) e.preventDefault();
    const { max, skala } = masse();
    rad.summe += schritt / skala;
    const hoehe = Math.max(rad.warOffen ? 160 : rad.hoehe, Math.min(max, rad.hoehe + rad.summe));
    if (!rad.bereit) { rad.bereit = true; vorbereiten(k, rad.hoehe); }
    zeigen(k, hoehe);
  }, { passive: false });
  // Bewegung und Ende haengen am FENSTER: ein Zug nach oben verlaesst den Rahmen,
  // und dort duerfen die Ereignisse nicht verloren gehen.
  window.addEventListener('pointermove', (e) => {
    if (e.pointerType === 'touch' || !start) return;
    if (zug(e.clientY, e.timeStamp)) e.preventDefault();
  });
  window.addEventListener('pointerup', (e) => { if (e.pointerType !== 'touch') ende(); });
  window.addEventListener('pointercancel', () => { start = null; });
  rahmen.addEventListener('touchstart', (e) => { const t = e.touches[0]; if (t) beginn(t.clientX, t.clientY, e.target); }, { passive: false });
  window.addEventListener('touchmove', (e) => {
    const t = e.touches[0];
    if (!t || !start) return;
    // preventDefault erst, WENN das Sheet die Bewegung wirklich übernimmt — sonst wäre das
    // Scrollen der Anfrageliste im Maximalzustand blockiert.
    if (zug(t.clientY, e.timeStamp) && e.cancelable) e.preventDefault();
  }, { passive: false });
  window.addEventListener('touchend', ende, { passive: true });
}

// Runde 3 (D4): Echter Scan im Kamerafeld — höchstens EINER in der ganzen App, gebunden an das
// Feld, in dem er läuft. Verschwindet das Feld (Umschalten, Schließen, anderer Bildschirm), geht
// die Kamera aus. Ein Wächter prüft das zusätzlich alle 400 ms: Nach einem Routenwechsel ruft
// niemand mehr diesen Binder auf, und eine Kamera, die weiterläuft, darf es nicht geben.
let qrScan = null;

function qrScanStoppen() {
  if (!qrScan) return;
  const laufend = qrScan;
  qrScan = null;
  clearInterval(laufend.waechter);
  laufend.beobachter.disconnect();
  laufend.stop();
}

function bindQrScan(root, ctx) {
  const { ui, repo } = ctx;
  const feld = root.querySelector('[data-qr-kamera]');
  if (!feld || ui.qrView !== 'scan') { qrScanStoppen(); return; }
  if (qrScan && qrScan.feld === feld && feld.isConnected) return;   // läuft schon hier
  qrScanStoppen();
  // Ein Hinweis steht (verweigert …) oder ein Code wird gerade eingelöst: nicht neu starten —
  // sonst fragte die App in Schleife nach der Kamera.
  if (ui.qrKamera) return;
  // Das Video, das der Scanner hineinlegt, ist eine Laufzeit-Ebene, kein Markup.
  const beobachter = new MutationObserver((liste) => liste.forEach((m) => m.addedNodes.forEach((knoten) => { knoten.__morphFrei = true; })));
  beobachter.observe(feld, { childList: true });
  const eigenerScan = () => qrScan && qrScan.feld === feld;
  const stop = starteQrScan(feld, {
    onText: (text) => {
      if (!eigenerScan()) return;
      const code = einladungsCodeAus(text);
      if (!code) {
        if (ui.qrAbgelehnt !== text) { ui.qrAbgelehnt = text; ctx.toast(tx('Das ist kein Crew-Code')); }
        return;
      }
      if (ui.qrAbgelehnt === code) return;
      // Erkannt: kurzes Haptik-Gefühl, Kamera aus, sichtbare Bestätigung — dann derselbe Weg
      // wie „Code eingeben" (repo.redeemInviteCode) mit genau einem Toast mit der Antwort.
      try { navigator.vibrate?.(12); } catch { /* ohne Vibration */ }
      qrScanStoppen();
      ui.qrKamera = 'erkannt';
      ctx.render();
      Promise.resolve(repo.redeemInviteCode(code)).then((ergebnis) => {
        if (!ergebnis?.ok) {
          // Eigener Code, schon befreundet, ungültig …: Grund nennen und weiter scannen.
          ui.qrAbgelehnt = code;
          ui.qrKamera = '';
          ctx.toast(ergebnis?.reason || tx('Code passt nicht'));
          ctx.render();
          return;
        }
        ctx.toast(ergebnis.reason || tx('Anfrage gesendet'));
        window.setTimeout(() => {
          ui.qrKamera = '';
          ui.qrAbgelehnt = '';
          ui.qrView = 'qr';
          ctx.render();
        }, 650);
      });
    },
    onFehler: (grund) => {
      if (!eigenerScan()) return;
      qrScanStoppen();
      ui.qrKamera = KAMERA_HINWEIS[grund] ? grund : 'unbekannt';
      ctx.render();
    },
  });
  const waechter = setInterval(() => { if (!feld.isConnected) qrScanStoppen(); }, 400);
  qrScan = { feld, stop, waechter, beobachter };
}

// Runde 2: Die Aktionen des Einladungs-Sheets gibt es an zwei Stellen — als eigene Route über
// dem Profil und als Sheet über der Freundesliste. Nur das Schließen unterscheidet sich.
function qrSheetActs(root, ctx, schliessen) {
  const { ui } = ctx;
  const core = qrCoreActs(ctx);
  root.querySelector('#qr-code-input')?.addEventListener('keydown', (event) => {
    if (event.key === 'Enter') core['qr-code-submit']({}, null, event, root);
  });
  bindQrZug(root, ctx);
  bindQrScan(root, ctx);
  return {
    ...core,
    ...requestActs(ctx),
    'qr-code-submit': (data, el, event) => core['qr-code-submit'](data, el, event, root),
    'qr-close': () => { qrScanStoppen(); schliessen(); },
    'qr-expand': () => { ui.qrExpanded = true; ctx.render(); },
    'qr-collapse': () => { ui.qrExpanded = false; ctx.render(); },
  };
}

function bindFriendAdd(root, ctx) {
  bindActions(root, qrSheetActs(root, ctx, () => ctx.nav.back('profile.home')));
}

// Runde 3 (D5, Jonathan: „Freund hinzufügen überall als Slide-up über dem aktuellen Schirm —
// Schließen führt dorthin zurück, wo man war"): Dasselbe Einladungs-Sheet wie in der
// Freundesliste, für jeden Screen. app.js reicht es als ctx.freundHinzufuegen weiter — so
// importieren Crew, Meet-Liste und Raum profile.js nicht selbst (profile.js importiert sie).
export const freundHinzufuegen = {
  overlay: (ctx) => (ctx.ui.qrOffen ? qrOverlay(ctx) : ''),
  oeffnen: (ctx) => { ctx.ui.qrOffen = true; ctx.ui.qrExpanded = false; ctx.render(); },
  aktionen: (root, ctx) => (ctx.ui.qrOffen
    ? qrSheetActs(root, ctx, () => { ctx.ui.qrOffen = false; ctx.ui.qrExpanded = false; ctx.render(); })
    : {}),
};

// ============================================================================
// 06.4 Einstellungen (profile.settings)
// ============================================================================

// v3.2 Ü7/D7: Bis zum eigenen Dark-Mode-Durchlauf ist der Light-Modus verbindlich.
// Die App rendert ausschließlich hell — deshalb ist „Hell" der echte, angewandte Wert und
// Fable: Darstellung ist eine echte Einstellung (settings.appearance.theme), siehe renderAppearance.
const THEME_LABELS = { system: tx('System'), hell: tx('Hell'), dunkel: tx('Dunkel') };


function locationValue(settings) {
  if (!settings.location?.use) return tx('Aus');
  const mode = settings.location.shareMode;
  if (mode === 'alle') return tx('An · Alle Freunde');
  if (mode === 'ausgewaehlte') return tnx((settings.location.shareIds || []).length, 'An · {n} Freund', 'An · {n} Freunde');
  return tx('An');
}

// v7 A33a: „Standard: aus" stand als Hilfstext unter einem Schalter, der im Seed auf AN
// stand. Der Text bleibt, der Wert ist jetzt wirklich der Standard (v7ProfilDefaults).

// v6 A19d: „Profil bearbeiten" steht AUSSCHLIESSLICH in der Profilansicht. Zwei Einstiege
// in dasselbe Sheet — Avatar oben und Einstellungszeile — waren ein Weg zu viel; die
// Gruppe KONTO beginnt deshalb wieder mit dem Konto.
// Runde 5 (A2): Die Zeile heißt „Desteny-Konto" und trägt das Desteny-Zeichen — schon hier sieht man,
// dass es nicht ein Konto nur für Crew ist.
function settingsBody(ctx) {
  const { repo } = ctx;
  const settings = repo.getSettings();
  const value = (text) => `<span style="font-size:13px;color:var(--muted)">${esc(text)}</span>`;
  const numberValue = (n) => `<span style="font-size:13px;color:var(--muted);font-variant-numeric:tabular-nums">${n}</span>`;
  const konto = repo.getAccountInfo?.() || {};
  const kontoZeile = `<button data-act="open" data-route="profile.account" data-role="einstellungen-konto" style="display:flex;justify-content:space-between;align-items:center;gap:10px;padding:10px 16px;min-height:47px;box-sizing:border-box;width:100%;border:0;border-bottom:1px solid var(--ink-a06);background:transparent;text-align:left;cursor:pointer;appearance:none;font-family:${FONT};color:var(--ink)">
<span style="display:flex;align-items:center;gap:11px;flex:none;pointer-events:none">${destenyKachel(26)}<span data-role="einstellungen-konto-name" style="font-size:14px;font-weight:600;white-space:nowrap">${tx('Desteny-Konto')}</span></span>
<span style="display:flex;gap:8px;align-items:center;justify-content:flex-end;flex:1 1 auto;min-width:0;pointer-events:none"><span data-role="einstellungen-konto-email" style="font-size:13px;color:var(--muted);white-space:nowrap;overflow:hidden;text-overflow:ellipsis;min-width:0">${esc(konto.email || (konto.echt ? '' : tx('Demo')))}</span>${chevron}</span></button>`;
  return `<div style="display:flex;flex-direction:column;gap:11px;padding:2px 20px 0">
<div style="display:flex;flex-direction:column;gap:6px">
${groupLabel(tx('Konto'))}
${groupCard(`${kontoZeile}
${navRow({ act: 'open', data: { route: 'profile.appearance' }, label: tx('Darstellung'), valueHtml: value(THEME_LABELS[settings.appearance?.theme] || tx('Hell')) })}
${navRow({ act: 'open', data: { route: 'profile.sprache' }, label: tx('Sprache'), valueHtml: value(spracheWert()), last: true })}`)}
</div>
<div style="display:flex;flex-direction:column;gap:6px">
${groupLabel(tx('Privat'))}
${groupCard(`${navRow({ act: 'open', data: { route: 'profile.visibility' }, label: tx('Privatsphäre & Freigaben') })}
${navRow({ act: 'open', data: { route: 'profile.location' }, label: tx('Standort'), valueHtml: value(locationValue(settings)), last: true })}`)}
</div>
<div style="display:flex;flex-direction:column;gap:6px">
${groupLabel(tx('App'))}
${groupCard(`${navRow({ act: 'open', data: { route: 'profile.notifications' }, label: tx('Benachrichtigungen'), valueHtml: value(reminderValue(settings)) })}
${navRow({ act: 'open', data: { route: 'profile.friends' }, label: tx('Freunde'), valueHtml: numberValue(repo.getPeople().length) })}
${navRow({ act: 'open', data: { route: 'profile.freiReset' }, label: tx('Frei zurücksetzen um'), valueHtml: numberValue(settings.freeResetTime || '00:00'), last: true })}`)}
</div>
</div>`;
}

// Gemeinsames Gerüst der Einstellungs-Unterseiten: ein Inhaltskörper, Sheets als Overlay.
function settingsScaffold(ctx, overlays = '') {
  return screenScaffold({
    header: subHeader(tx('Einstellungen')),
    body: settingsBody(ctx),
    bottomInset: 28,
    overlays,
    scrollKey: 'settings',
  });
}

// Runde 2 (Jonathan): „Alle eigenen Daten als Archiv anfordern" ist entfallen. Das Recht auf
// eine Kopie bleibt — es braucht keinen Knopf, ein Satz in der Datenschutzerklärung
// („per Mail an development@desteny.at") reicht. Weder Apple noch Google verlangen ihn.
// Runde 2 (Jonathan): „Das mit der Datenbank geben wir versteckt in die Einstellungen ganz
// unten — einfach ein Text zum Anklicken, ohne Box." Hier steht, was Crew aus Wählen,
// Übergehen und „Nicht für mich" gelernt hat — und wie man es wieder vergisst.
function renderGelernt(ctx) {
  const lernen = ctx.repo.getSettings().lernen || {};
  const arten = Object.entries(lernen.arten || {});
  const magst = arten.filter(([, a]) => (a.g || 0) > 0 && (a.g || 0) > (a.n || 0))
    .sort((a, b) => (b[1].g || 0) - (a[1].g || 0));
  const eherNicht = arten.filter(([, a]) => (a.n || 0) > 0 || ((a.u || 0) >= 3 && !(a.g || 0)))
    .sort((a, b) => ((b[1].n || 0) * 3 + (b[1].u || 0)) - ((a[1].n || 0) * 3 + (a[1].u || 0)));
  const ausgeblendet = Object.keys(lernen.nein || {}).length;
  const zeile = ([art, a], index) => `<div data-role="gelernt-art" data-art="${esc(art)}" style="display:flex;align-items:center;gap:11px;padding:11px 14px;${index ? 'border-top:1px solid var(--ink-a07);' : ''}">
<span style="display:flex;flex:none">${activityIconSvg({ icon: art }, 'var(--ink-soft)', 17)}</span>
<span style="flex:1;min-width:0;font-size:14px;font-weight:600;white-space:nowrap;overflow:hidden;text-overflow:ellipsis">${esc(ART_WORTE[art] || art)}</span>
<span style="font-size:12px;color:var(--muted);font-variant-numeric:tabular-nums;white-space:nowrap">${[a.g ? tx('{n}× gewählt', { n: a.g }) : '', a.u ? tx('{n}× übergangen', { n: a.u }) : '', a.n ? tx('{n}× nein', { n: a.n }) : ''].filter(Boolean).join(' · ')}</span></div>`;
  const gruppe = (titel, liste) => `<div style="display:flex;flex-direction:column;gap:6px">${groupLabel(titel)}${groupCard(liste.length
    ? liste.map(zeile).join('')
    : `<div style="padding:13px 14px;font-size:13px;color:var(--muted)">${tx('Noch nichts')}</div>`)}</div>`;
  const html = screenScaffold({
    header: subHeader(tx('Was Crew gelernt hat')),
    bottomInset: 28,
    scrollKey: 'gelernt',
    body: `<div style="display:flex;flex-direction:column;gap:14px;padding:2px 20px 0">
<span style="font-size:12.5px;color:var(--ink-soft);line-height:1.5">${tx('Daraus sortiert Crew deine Vorschläge. Es bleibt in deinem Konto.')}</span>
${gruppe(tx('Magst du'), magst)}
${gruppe(tx('Eher nicht'), eherNicht)}
${groupCard(`<div style="display:flex;align-items:center;gap:10px;padding:12px 14px"><span style="flex:1;font-size:14px;font-weight:600">${tx('Ausgeblendet')}</span><span data-role="gelernt-ausgeblendet" style="font-size:13px;color:var(--muted);font-variant-numeric:tabular-nums">${ausgeblendet}</span>${ausgeblendet ? `<button data-act="gelernt-zeigen" style="border:1.5px solid var(--ink-a14);background:var(--surface);color:var(--ink-soft);font:650 12.5px/1 ${FONT};padding:8px 12px;border-radius:999px;cursor:pointer;appearance:none"><span style="pointer-events:none">${tx('Wieder zeigen')}</span></button>` : ''}</div>`)}
${arten.length || ausgeblendet ? `<button data-act="gelernt-vergessen" style="align-self:center;border:0;background:transparent;padding:10px 8px;font:650 13px/1 ${FONT};color:var(--red);cursor:pointer;appearance:none"><span style="pointer-events:none">${tx('Alles vergessen')}</span></button>` : ''}
</div>`,
  });
  return {
    html,
    bind: (root, innerCtx) => bindActions(root, {
      'gelernt-zeigen': () => {
        const stand = innerCtx.repo.getSettings().lernen || {};
        innerCtx.repo.updateSettings({ lernen: { arten: stand.arten || {}, nein: {} } });
        innerCtx.toast(tx('Alles wird wieder vorgeschlagen'));
      },
      'gelernt-vergessen': () => {
        innerCtx.repo.updateSettings({ lernen: { arten: {}, nein: {} } });
        innerCtx.toast(tx('Vergessen'));
      },
    }),
  };
}

function renderSettings(ctx) {
  return {
    html: settingsScaffold(ctx),
    bind: (root, innerCtx) => {
      v7ProfilDefaults(innerCtx.repo);  // schreibt hoechstens einmal (A33a/A35b)
      bindActions(root, {
        open: (data) => innerCtx.nav.go(data.route),
      });
    },
  };
}

// ============================================================================
// T6: Wer blockiert ist, steht hier — und kann hier wieder freigegeben werden. Ohne diese
// Liste wäre eine Blockierung unumkehrbar und für die blockierende Person unsichtbar.
function blockierteKarte(ctx) {
  const blockiert = ctx.repo.getBlockedPeople();
  const zeilen = blockiert.length
    ? blockiert.map((person, index) => `<div style="display:flex;align-items:center;gap:11px;padding:11px 14px;${index ? 'border-top:1px solid var(--ink-a07);' : ''}">
<span style="display:flex;flex:none;pointer-events:none">${personAvatar(person, { size: 32, fontSize: 12 })}</span>
<span style="flex:1;min-width:0;font-size:14px;font-weight:600;color:var(--ink);white-space:nowrap;overflow:hidden;text-overflow:ellipsis">${esc(person.name)}</span>
<button data-act="unblock" data-person="${esc(person.id)}" style="flex:none;border:1.5px solid var(--ink-a14);background:var(--surface);color:var(--ink-soft);font:650 12.5px/1 ${FONT};padding:8px 13px;border-radius:999px;cursor:pointer;appearance:none"><span style="pointer-events:none">${tx('Freigeben')}</span></button>
</div>`).join('')
    : `<div style="padding:13px 14px;font-size:13px;color:var(--muted);line-height:1.45">${tx('Niemand blockiert')}</div>`;
  return choiceCard(tx('Blockierte Personen'), zeilen);
}

// 06.5 Privatsphäre & Freigaben (profile.visibility) — Vertrag §7/§9
// ============================================================================

// v7 A32g/A33 (spec/06 §2 und §4): Hier liegt die EINE allgemeine Freigaberegel für
// Ressourcen — „Ressourcen für Freunde" für alle nicht privaten und „Private Ressourcen"
// für die ausdrücklich privat markierten. Der frühere Erklärabsatz und die Sprungzeile in
// den Profil-Tab sind entfallen: eine Zusammenfassung ohne Bedienung ist keine Einstellung.
// Beide Regeln schreiben über projiziereFreigaben() auf resourceShares durch und wirken
// deshalb wirklich im Gateway-Filter isSharedWith().
// R1 §7: Nur die private Regel ist noch wählbar. „alle" steht bewusst NICHT darin —
// wer eine Ressource allen Freunden zeigen will, nimmt einfach das Schloss weg.
const RULE_OPTIONS = {
  private: ['ich', 'markierte', 'individuell'],
};

function sharePickRow(act, data, label, selected) {
  const attrs = Object.entries(data).map(([k, v]) => `data-${k}="${esc(v)}"`).join(' ');
  return `<button data-act="${act}" ${attrs} style="display:flex;align-items:center;gap:9px;padding:10px 12px;width:100%;border:0;background:${selected ? 'var(--green-tint)' : 'transparent'};text-align:left;cursor:pointer;appearance:none;font-family:${FONT}">
<span style="font-size:13px;font-weight:${selected ? 650 : 600};color:${selected ? 'var(--green-dark)' : 'var(--ink-soft)'};flex:1;min-width:0;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;pointer-events:none">${esc(label)}</span>
${selected ? svgCheckedCircle : emptyCircle}</button>`;
}

function ruleRow(kind, label, regel, repo, last = false) {
  return `<button data-act="rule-open" data-kind="${kind}" style="display:flex;justify-content:space-between;align-items:center;gap:10px;padding:12px 0;width:100%;border:0;${last ? '' : 'border-bottom:1px solid var(--ink-a06);'}background:transparent;text-align:left;cursor:pointer;appearance:none;font-family:${FONT};color:var(--ink)">
<span style="font-size:14px;font-weight:600;pointer-events:none">${esc(label)}</span>
<span style="display:flex;gap:8px;align-items:center;pointer-events:none"><span style="font-size:13px;color:var(--muted)">${esc(ruleLabel(regel, repo))}</span>${svgRowChevron}</span></button>`;
}

// Kleiner Popover in der OVERLAY-Ebene: die Scrollfläche hat einen eigenen Stapelkontext,
// ein Popover darin käme nie über seine Rücknahmefläche. Die Position kommt aus der
// gemessenen Zeilenunterkante — dieselbe Verankerung wie beim Personenmenü.
function rulePopover(ctx) {
  const { repo, ui } = ctx;
  const kind = ui.ruleOpen;
  if (!kind || !RULE_OPTIONS[kind]) return '';
  const settings = repo.getSettings();
  const regel = shareRules(settings)[kind];
  const top = Math.max(96, Math.min(520, Math.round(ui.ruleTop || 200)));
  const zeile = (mode) => sharePickRow('rule-set', { kind, mode }, SHARE_RULE_WORDS[mode], regel.mode === mode);
  // v7 A32e: Der ERSTE Popover schliesst nach jeder Auswahl. Bei „Individuell" tritt an
  // seine Stelle der zweite, ebenso kleine Popover mit der Freundesliste — nie beide.
  const zweiterOffen = ui.rulePeopleOpen === kind;
  const liste = zweiterOffen
    ? `<div role="menu" data-role="rule-people" style="position:absolute;right:20px;top:${top}px;width:230px;max-height:300px;overflow-y:auto;background:var(--surface);border-radius:14px;border:1px solid var(--ink-a08);box-shadow:0 10px 28px var(--shadow-20);padding:4px 0;z-index:13;scrollbar-width:none">
${repo.getPeople().map((person) => sharePickRow('rule-person', { kind, person: person.id }, person.name, (regel.ids || []).includes(person.id))).join('')}
<button data-act="rule-people-done" style="display:flex;align-items:center;justify-content:center;padding:11px 12px;width:100%;border:0;border-top:1px solid var(--ink-a06);background:transparent;cursor:pointer;appearance:none;font:650 12.5px ${FONT};color:var(--green-dark)">${tx('Fertig')}</button>
</div>`
    : '';
  const erster = zweiterOffen ? '' : `<div role="menu" data-role="rule-pop" style="position:absolute;right:20px;top:${top}px;width:212px;background:var(--surface);border-radius:14px;border:1px solid var(--ink-a08);box-shadow:0 10px 28px var(--shadow-20);padding:4px 0;z-index:12">
${RULE_OPTIONS[kind].map(zeile).join('')}
</div>`;
  return `<div data-act="rule-close" style="position:absolute;inset:0;z-index:11"></div>${erster}${liste}`;
}

// Runde 3 (H4): Hat man den Standort für Vorschläge freigegeben, steht hier, was gespeichert ist
// (ungefähr, nur auf dem Gerät) — und wie man es wieder vergisst. Ohne Standort steht hier nichts.
function standortKarte(ctx) {
  const mitte = ctx.repo.getVorschlagsMitte?.();
  if (mitte?.quelle !== 'standort') return '';
  return choiceCard(tx('Standort für Vorschläge'), `
<div style="display:flex;align-items:center;gap:12px;padding:2px 0 4px">
<span style="flex:1;font-size:12.5px;color:var(--ink-soft);line-height:1.5">${tx('Ungefähr, nur auf diesem Gerät gespeichert.')}</span>
<button data-act="vis-standort-vergessen" style="flex:none;min-height:36px;padding:0 14px;border-radius:999px;border:1px solid var(--ink-a12);background:transparent;font:600 13px/1 ${FONT};color:var(--ink);cursor:pointer;appearance:none">${tx('Vergessen')}</button>
</div>`);
}

function renderVisibility(ctx) {
  const settings = ctx.repo.getSettings();
  // v7 A33a: verbindliche Standardwerte — Aktivität zeigen und vollständiges Profil.
  const activity = settings.activityStatus || 'zeigen';
  const unknown = settings.visibility?.unknownProfile || 'profil';
  const regeln = shareRules(settings);
  // R1 §7: Die Karte sagt zuerst den Standard in einem Satz und nennt dann die EINE
  // Regel, die etwas einschränkt. Darunter steht schwarz auf weiss, was gerade privat
  // ist — und wo man das markiert. Vorher standen hier zwei gleich aussehende Regeln
  // ohne einen einzigen erklärenden Satz.
  const privatNamen = (settings.resources || []).filter((label) => isResourcePrivate(settings, label));
  // Runde 2 (Jonathan: zu viel Text) — nur noch, WAS privat ist. Ist nichts privat, steht
  // hier nichts; der Satz darüber sagt dann schon alles.
  const privatSatz = privatNamen.length ? tx('Privat: {namen}', { namen: privatNamen.map((name) => wort(name)).join(', ') }) : '';

  // Runde 3 (Jonathan, M1): „Was Crew gelernt hat" steht nicht mehr ganz unten in den
  // Einstellungen, sondern hier — als unauffälliger Textlink unter den Freigaben.
  const html = screenScaffold({
    header: subHeader(tx('Privatsphäre & Freigaben')),
    bottomInset: 28,
    scrollKey: 'visibility',
    overlays: rulePopover(ctx),
    body: `<div style="display:flex;flex-direction:column;gap:14px;padding:2px 20px 0">
${choiceCard(tx('Ressourcen'), `
<span style="display:block;font-size:12.5px;color:var(--ink-soft);line-height:1.5;padding:0 0 6px">${tx('Alle Freunde sehen deine Ressourcen — außer private.')}</span>
${ruleRow('private', tx('Private Ressourcen sehen'), regeln.private, ctx.repo, true)}
${privatSatz ? `<span style="display:block;font-size:11.5px;color:var(--muted);line-height:1.45;padding:9px 0 4px">${esc(privatSatz)}</span>` : ''}`)}
${choiceCard(tx('Aktivitätsstatus für Freunde'), `
${radioRow({ act: 'vis-activity', data: { value: 'aus' }, selected: activity === 'aus', label: tx('Aus') })}
${radioRow({ act: 'vis-activity', data: { value: 'nur-aktiv' }, selected: activity === 'nur-aktiv', label: tx('Nur aktiv') })}
${radioRow({ act: 'vis-activity', data: { value: 'zeigen' }, selected: activity === 'zeigen', label: tx('Aktivität zeigen'), hintHtml: standardChip() })}`)}
${choiceCard(tx('Unbekannte Meet-Teilnehmende sehen'), `
${radioRow({ act: 'vis-unknown', data: { value: 'nichts' }, selected: unknown === 'nichts', label: tx('Nichts') })}
${radioRow({ act: 'vis-unknown', data: { value: 'vorname' }, selected: unknown === 'vorname', label: tx('Vorname') })}
${radioRow({ act: 'vis-unknown', data: { value: 'profil' }, selected: unknown === 'profil', label: tx('Vollständiges Profil'), hintHtml: standardChip() })}`)}
${blockierteKarte(ctx)}
${standortKarte(ctx)}
<button data-act="open" data-route="profile.gelernt" style="align-self:center;border:0;background:transparent;padding:6px 8px 4px;font:600 12.5px/1 ${FONT};color:var(--muted);cursor:pointer;appearance:none"><span style="pointer-events:none">${tx('Was Crew gelernt hat')}</span></button>
</div>`,
  });

  return {
    html,
    bind: (root, innerCtx) => {
      const { repo, ui } = innerCtx;
      v7ProfilDefaults(repo);           // schreibt hoechstens einmal (A33a/A35b)
      bindActions(root, {
        open: (data) => innerCtx.nav.go(data.route),
        'vis-activity': (data) => repo.updateSettings({ activityStatus: data.value }),
        // Runde 3 (H4, P2-Hinweis): Der Standort für Vorschläge lässt sich hier wieder vergessen.
        'vis-standort-vergessen': () => { repo.vorschlagsStandortVergessen?.(); innerCtx.render(); },
        'vis-unknown': (data) => repo.updateSettings({ visibility: { ...repo.getSettings().visibility, unknownProfile: data.value } }),
        // v7 A32d: Der Popover ist an der Zeile verankert; ein Tap daneben schliesst ihn
        // und NUR ihn — der Screen darunter bleibt unberuehrt.
        'rule-open': (data, el) => {
          const phone = el ? el.closest('.runtime-phone') : document.querySelector('.runtime-phone');
          ui.ruleTop = el && phone ? el.getBoundingClientRect().bottom - phone.getBoundingClientRect().top + 6 : 200;
          ui.ruleOpen = ui.ruleOpen === data.kind ? null : data.kind;
          ui.rulePeopleOpen = null;
          innerCtx.render();
        },
        'rule-close': () => { ui.ruleOpen = null; ui.rulePeopleOpen = null; innerCtx.render(); },
        // Nach JEDER Auswahl schliesst der erste Popover; „Individuell" oeffnet den zweiten.
        'rule-set': (data) => {
          const aktuell = shareRules(repo.getSettings());
          const regel = { ...aktuell[data.kind], mode: data.mode };
          const naechste = { ...aktuell, [data.kind]: regel };
          ui.ruleOpen = data.mode === 'individuell' ? data.kind : null;
          ui.rulePeopleOpen = data.mode === 'individuell' ? data.kind : null;
          projiziereFreigaben(repo, { resourceSharing: naechste });
        },
        'rule-person': (data) => {
          const aktuell = shareRules(repo.getSettings());
          const ids = aktuell[data.kind].ids || [];
          const regel = { ...aktuell[data.kind], mode: 'individuell', ids: ids.includes(data.person) ? ids.filter((id) => id !== data.person) : [...ids, data.person] };
          projiziereFreigaben(repo, { resourceSharing: { ...aktuell, [data.kind]: regel } });
        },
        'rule-people-done': () => { ui.ruleOpen = null; ui.rulePeopleOpen = null; innerCtx.render(); },
        // T6: Eine Blockierung muss sich auch zurücknehmen lassen — sonst wäre sie eine
        // Falle statt eines Schutzes.
        'unblock': (data) => {
          const person = repo.getBlockedPeople().find((p) => p.id === data.person);
          repo.unblockPerson(data.person);
          innerCtx.render();
          innerCtx.toast(person?.name ? tx('{name} ist nicht mehr blockiert', { name: person.name.split(' ')[0] }) : tx('Person ist nicht mehr blockiert'));
        },
      });
    },
  };
}

// ============================================================================
// 06.6 Standort (profile.location)
// ============================================================================

function renderLocation(ctx) {
  const { repo } = ctx;
  const settings = repo.getSettings();
  const location = settings.location || {};
  const shareMode = location.shareMode || 'niemand';
  const shareIds = location.shareIds || [];
  const people = repo.getPeople();

  // v5 A31a: Ohne Standortfreigabe gibt es nichts zu verteilen — die Empfängerauswahl
  // ist dann sichtbar deaktiviert und schreibt auch nichts mehr.
  const aus = !location.use;
  // v5 A31b: Die Personenliste klappt NICHT automatisch auf. Sichtbar ist eine ruhige
  // Zusammenfassung, die man gezielt öffnet.
  const offen = Boolean(ctx.ui.locPickOpen);
  const gewaehlt = shareIds.length;
  const zusammenfassung = shareMode === 'ausgewaehlte' && !aus
    ? `<button data-act="loc-pick-open" aria-expanded="${offen}" style="display:flex;align-items:center;gap:10px;padding:11px 0 11px 31px;width:100%;border:0;border-top:1px solid var(--ink-a05);background:transparent;text-align:left;cursor:pointer;appearance:none;font-family:${FONT}">
<span style="font-size:13px;font-weight:600;color:var(--ink-soft);flex:1;pointer-events:none">${tnx(gewaehlt, '{n} Freund:in gewählt', '{n} Freund:innen gewählt')}</span>
<span style="display:flex;transform:rotate(${offen ? 90 : 0}deg);transition:transform .16s ease-out;pointer-events:none">${svgRowChevron}</span></button>`
    : '';
  const picker = shareMode === 'ausgewaehlte' && offen && !aus
    ? people.map((person) => pickPersonRow({ act: 'loc-person', person, selected: shareIds.includes(person.id) })).join('')
    : '';

  const html = screenScaffold({
    header: subHeader(tx('Standort')),
    bottomInset: 28,
    scrollKey: 'location',
    body: `<div style="display:flex;flex-direction:column;gap:14px;padding:2px 20px 0">
${groupCard(`<div style="display:flex;justify-content:space-between;align-items:center;padding:13px 16px"><div style="display:flex;flex-direction:column;gap:2px"><span style="font-size:14px;font-weight:600">${tx('Standort verwenden')}</span><span style="font-size:11.5px;color:var(--muted)">${tx('Standard: aus')}</span></div>${toggleSwitch(Boolean(location.use), 'loc-use')}</div>`)}
${choiceCard(tx('Standort teilen mit'), `
${aus ? `<span style="display:block;font-size:11.5px;color:var(--muted);line-height:1.45;padding:2px 0 8px">${tx('Schalte den Standort oben ein, um zu wählen, wer ihn sieht.')}</span>` : ''}
${radioRow({ act: 'loc-mode', data: { mode: 'niemand' }, selected: shareMode === 'niemand', label: tx('Niemand'), disabled: aus })}
${radioRow({ act: 'loc-mode', data: { mode: 'alle' }, selected: shareMode === 'alle', label: tx('Alle Freunde'), disabled: aus })}
${radioRow({ act: 'loc-mode', data: { mode: 'ausgewaehlte' }, selected: shareMode === 'ausgewaehlte', label: tx('Individuell'), disabled: aus })}
${zusammenfassung}${picker}`)}
</div>`,
  });

  return {
    html,
    bind: (root, innerCtx) => {
      const repo2 = innerCtx.repo;
      v7ProfilDefaults(repo2);          // schreibt hoechstens einmal (A33a/A35b)
      const current = () => repo2.getSettings().location || {};
      bindActions(root, {
        'loc-use': () => {
          const next = !current().use;
          // Beim Ausschalten schliesst sich auch die Personenliste — sonst bliebe eine
          // aufgeklappte, aber deaktivierte Auswahl stehen.
          if (!next) innerCtx.ui.locPickOpen = false;
          repo2.updateSettings({ location: { ...current(), use: next } });
        },
        // v5 A31a: Ohne Standortfreigabe wird nichts geschrieben — die Zeilen sind auch
        // sichtbar deaktiviert, aber die Sperre gehoert zusaetzlich hierher.
        'loc-mode': (data) => {
          if (!current().use) return;
          repo2.updateSettings({ location: { ...current(), shareMode: data.mode } });
        },
        'loc-pick-open': () => { innerCtx.ui.locPickOpen = !innerCtx.ui.locPickOpen; innerCtx.render(); },
        'loc-person': (data) => {
          if (!current().use) return;
          const loc = current();
          const ids = loc.shareIds || [];
          const next = ids.includes(data.person) ? ids.filter((id) => id !== data.person) : [...ids, data.person];
          repo2.updateSettings({ location: { ...loc, shareIds: next } });
        },
      });
    },
  };
}

// ============================================================================
// 06.7 Konto & Anmeldung (profile.account) — E-Mail, Anmeldung, Datenexport,
// Konto löschen ganz unten (reference 06.7)
// ============================================================================

// Auftrag §1.7: Auf dieser Seite stand nichts, was stimmte — die E-Mail fehlte, bei der
// Anmeldeart stand fest „Apple", das Passwortfeld gab es nicht, und „Speichern" war ein
// Toast ohne Wirkung. Alles kommt jetzt aus dem echten Konto (repo.getAccountInfo()) und
// jede Änderung geht wirklich an den Server.
const ANBIETER_ZEICHEN = {
  apple: (farbe = 'var(--ink)') => svgApple(farbe, 16),
  google: () => svgGoogle,
  email: (farbe = 'var(--ink)') => `<svg width="16" height="16" viewBox="0 0 24 24" fill="none"><rect x="3" y="5.5" width="18" height="13" rx="2.6" stroke="${farbe}" stroke-width="1.8"></rect><path d="m3.8 7 8.2 6 8.2-6" stroke="${farbe}" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"></path></svg>`,
  demo: (farbe = 'var(--ink)') => `<svg width="16" height="16" viewBox="0 0 24 24" fill="none"><circle cx="12" cy="12" r="8.6" stroke="${farbe}" stroke-width="1.8"></circle><path d="M12 7.8v4.6M12 15.6v.6" stroke="${farbe}" stroke-width="1.8" stroke-linecap="round"></path></svg>`,
};

const EMAIL_FORM = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;

function anbieterZeichen(methode, farbe = 'var(--ink)') {
  return (ANBIETER_ZEICHEN[methode] || ANBIETER_ZEICHEN.email)(farbe);
}

function accountSheets(ctx) {
  const { repo, ui } = ctx;
  const konto = repo.getAccountInfo();
  const meldung = ui.accMeldung ? `<span data-role="acc-meldung" style="display:block;font-size:12.5px;color:${ui.accMeldungGut ? 'var(--green-dark)' : 'var(--danger)'};line-height:1.45;padding-top:10px">${esc(ui.accMeldung)}</span>` : '';
  if (ui.sheet === 'email') {
    // Runde 2 (Jonathan: „man kann nur eine Mail schicken, wenn man die Mail auch ändert —
    // das soll sinnhaft sein"): Das Feld ist LEER, getippt wird die NEUE Adresse. Der Knopf
    // wird erst kräftig, wenn sie gültig und wirklich eine andere ist (bindAccount).
    return sheet(`<span style="font-family:${BRICOLAGE};font-size:19px;font-weight:650;display:block;padding-bottom:10px">${tx('E-Mail ändern')}</span>
<span style="display:block;font-size:12.5px;color:var(--ink-soft);line-height:1.5;padding-bottom:10px">${tx('Jetzt: {an}{email}{aus}', { an: '<strong style="color:var(--ink)">', email: esc(konto.email || '—'), aus: '</strong>' })}</span>
<input id="acc-email" value="" type="email" inputmode="email" autocomplete="email" placeholder="${esc(tx('Neue E-Mail-Adresse'))}" aria-label="${esc(tx('Neue E-Mail-Adresse'))}" style="${INPUT_STYLE}">
<span style="display:block;font-size:12px;color:var(--muted);line-height:1.45;padding-top:8px">${tx('Sie gilt, sobald du den Link in der Mail angeklickt hast.')}</span>
${meldung}
<button data-act="acc-email-save" aria-disabled="true" style="${GREEN_PILL};margin-top:14px;opacity:.4">${tx('Bestätigung schicken')}</button>`, { closeAct: 'acc-close' });
  }
  if (ui.sheet === 'login') {
    // Runde 2 (Jonathan: „die Texte sind so lang, dass sie Zeilenbrüche brauchen"): ein
    // Name, ein kurzer Satz. Aus der Demo führt ein Knopf zurück zur echten Anmeldung.
    // Runde 4 (Jonathan): „Bei Sign in will ich sehen, dass ich mich über Desteny Development
    // angemeldet habe." Oben steht deshalb das Desteny-Konto; wie man hineinkommt (E-Mail, Apple,
    // Google), ist die zweite Zeile.
    // Runde 5 (A2): Oben das Desteny-Konto mit seinem Zeichen, darunter wie man hineinkommt.
    const satz = !konto.echt ? tx('Die Demo läuft nur auf diesem Gerät.')
      : tx('Mit diesem Desteny-Konto meldest du dich bei allen Apps von Desteny Development an.');
    const weg = konto.methode === 'email' ? tx('mit E-Mail und Passwort') : tx('über {name}', { name: konto.methodeLabel });
    return sheet(`<span style="font-family:${BRICOLAGE};font-size:19px;font-weight:650;display:block;padding-bottom:10px">${tx('Anmeldung')}</span>
<div data-role="konto-anbieter" style="display:flex;align-items:center;gap:12px;padding:14px 0;border-top:1px solid var(--ink-a07)">${destenyKachel(40)}<div style="display:flex;flex-direction:column;gap:2px;flex:1;min-width:0"><span style="font-size:15.5px;font-weight:650">${tx('Desteny-Konto')}</span><span style="font-size:12px;color:var(--muted);display:flex;align-items:center;gap:6px">${konto.echt ? `${anbieterZeichen(konto.methode, 'var(--muted)').replace('width="16" height="16"', 'width="13" height="13"')}${esc(weg)}` : tx('Demo · kein Konto')}</span></div>${konto.echt ? `<span style="font-size:11.5px;font-weight:650;color:var(--green-dark)">${tx('Verbunden')}</span>` : ''}</div>
<span style="display:block;font-size:12.5px;color:var(--ink-soft);line-height:1.45;padding:2px 0 4px">${satz}</span>
${konto.echt && konto.methode === 'email' ? `<span style="display:block;font-size:12px;color:var(--muted);line-height:1.45">${tx('Apple und Google folgen mit der App.')}</span>` : ''}
${konto.echt
    ? `<button data-act="acc-close" style="${GREEN_PILL};margin-top:12px">${tx('Okay')}</button>`
    : `<button data-act="acc-zum-konto" style="${GREEN_PILL};margin-top:12px">${tx('Mit Desteny-Konto anmelden')}</button>
<button data-act="acc-close" style="border:1.5px solid var(--ink-a14);background:var(--surface);color:var(--ink);font:650 14px/1 ${FONT};padding:13px 0;border-radius:999px;width:100%;cursor:pointer;appearance:none;margin-top:9px">${tx('Schließen')}</button>`}`, { closeAct: 'acc-close' });
  }
  if (ui.sheet === 'passwort') {
    // Runde 2 (Jonathan: „Passwort ändern sollte man erst mit dem Passwort können"): Wer
    // das Handy kurz unbeaufsichtigt liegen lässt, soll nicht das Konto verlieren.
    const feld = (id, platz, auto) => `<div style="position:relative;display:flex;align-items:center">
<input id="${id}" type="password" autocomplete="${auto}" placeholder="${platz}" aria-label="${platz}" style="${INPUT_STYLE};padding-right:46px">
<button data-act="acc-auge" data-feld="${id}" aria-label="${esc(tx('Passwort anzeigen'))}" style="position:absolute;right:5px;width:36px;height:36px;border:0;background:transparent;color:var(--muted);display:flex;align-items:center;justify-content:center;cursor:pointer;padding:0;appearance:none"><span style="pointer-events:none;display:flex">${svgAuge}</span></button>
</div>`;
    return sheet(`<span style="font-family:${BRICOLAGE};font-size:19px;font-weight:650;display:block;padding-bottom:10px">${tx('Passwort ändern')}</span>
<div style="display:flex;flex-direction:column;gap:9px">${feld('acc-password-alt', esc(tx('Aktuelles Passwort')), 'current-password')}${feld('acc-password', esc(tx('Neues Passwort')), 'new-password')}</div>
<div style="display:flex;justify-content:space-between;align-items:center;gap:10px;padding-top:8px"><span style="font-size:12px;color:var(--muted)">${tx('Neu: mindestens 8 Zeichen.')}</span><button data-act="acc-password-vergessen" style="border:0;background:transparent;padding:4px 0;font:600 12px/1 ${FONT};color:var(--ink-soft);cursor:pointer;appearance:none;white-space:nowrap">${tx('Passwort vergessen?')}</button></div>
${meldung}
<button data-act="acc-password-save" aria-disabled="true" style="${GREEN_PILL};margin-top:14px;opacity:.4">${tx('Speichern')}</button>`, { closeAct: 'acc-close' });
  }
  if (ui.sheet === 'abmelden') {
    return sheet(`<span style="font-family:${BRICOLAGE};font-size:19px;font-weight:650;display:block;padding-bottom:8px">${tx('Abmelden')}</span>
<span style="display:block;font-size:12.5px;color:var(--ink-soft);line-height:1.5;padding-bottom:4px">${konto.email ? tx('Dein Desteny-Konto bleibt bestehen. Du kannst dich jederzeit wieder mit {email} anmelden.', { email: esc(konto.email) }) : tx('Dein Desteny-Konto bleibt bestehen. Du kannst dich jederzeit wieder mit deiner E-Mail anmelden.')}</span>
<button data-act="acc-signout" style="${GREEN_PILL};margin-top:12px">${tx('Abmelden')}</button>
<button data-act="acc-close" style="border:1.5px solid var(--ink-a14);background:var(--surface);color:var(--ink);font:650 14px/1 ${FONT};padding:13px 0;border-radius:999px;width:100%;cursor:pointer;appearance:none;margin-top:9px">${tx('Abbrechen')}</button>`, { closeAct: 'acc-close' });
  }
  if (ui.sheet === 'delete') {
    return sheet(`<span style="font-family:${BRICOLAGE};font-size:19px;font-weight:650;display:block;padding-bottom:8px;color:var(--red)">${tx('Desteny-Konto löschen')}</span>
<span style="display:block;font-size:12.5px;color:var(--ink-soft);line-height:1.5;padding-bottom:4px">${tx('Dein Desteny-Konto wird gelöscht, auch für andere Apps von Desteny Development. Deine Crews und Meets werden dauerhaft entfernt. Das lässt sich nicht rückgängig machen.')}</span>
<button data-act="acc-delete" style="${RED_PILL};margin-top:12px">${tx('Endgültig löschen')}</button>
<button data-act="acc-close" style="border:1.5px solid var(--ink-a14);background:var(--surface);color:var(--ink);font:650 14px/1 ${FONT};padding:13px 0;border-radius:999px;width:100%;cursor:pointer;appearance:none;margin-top:9px">${tx('Abbrechen')}</button>`, { closeAct: 'acc-close' });
  }
  return '';
}

// Runde 4 (Jonathan): „Ich will einen Desteny-Development-Account haben, nicht einen Crew-Account,
// und mit diesem hab ich Crew aktiviert."
// Runde 5 (A2, Jonathan: „In der App bei Account ist es ein Desteny-Account. Jetzt fühlt es sich an, als
// wäre es nur der Account von der App, aber Desteny spürt man nicht."): Oben steht das Desteny-Konto als
// eigenes Ding — Zeichen, E-Mail, Anmeldeart und dass Crew damit aktiviert ist. Darunter die
// Desteny-Apps, darunter, was man am Konto ändern kann. Ruhig, in Tinte — keine Werbung.
function renderAccount(ctx) {
  const { repo } = ctx;
  const konto = repo.getAccountInfo();
  const weg = konto.methode === 'email' || !konto.methodeLabel ? tx('E-Mail und Passwort') : konto.methodeLabel;
  const kontoKarte = `<div data-role="desteny-konto" style="background:var(--surface);border-radius:22px;border:1px solid var(--ink-a07);box-shadow:0 1px 2px var(--shadow-05);overflow:hidden;flex:none">
<div style="display:flex;align-items:center;gap:14px;padding:16px">
${destenyKachel(48)}
<div style="display:flex;flex-direction:column;gap:3px;flex:1;min-width:0">
<span style="font-family:${BRICOLAGE};font-size:18px;font-weight:650;letter-spacing:-.01em;color:var(--ink)">${tx('Desteny-Konto')}</span>
<span data-role="konto-email" style="font-size:13px;color:var(--muted);white-space:nowrap;overflow:hidden;text-overflow:ellipsis">${esc(konto.email || (konto.echt ? '—' : tx('Demo · kein Konto')))}</span>
</div></div>
${konto.echt
    ? `<button data-act="acc-sheet" data-sheet="login" data-role="konto-anmeldeart" style="display:flex;align-items:center;gap:11px;padding:12px 16px;min-height:46px;box-sizing:border-box;width:100%;border:0;border-top:1px solid var(--ink-a06);background:transparent;text-align:left;cursor:pointer;appearance:none;font-family:${FONT};color:var(--ink)"><span style="width:20px;display:flex;justify-content:center;flex:none;pointer-events:none">${anbieterZeichen(konto.methode, 'var(--ink-soft)')}</span><span style="font-size:13.5px;color:var(--ink-soft);flex:1;min-width:0;pointer-events:none">${tx('Anmeldung')}</span><span style="font-size:13.5px;font-weight:600;white-space:nowrap;pointer-events:none">${esc(weg)}</span>${chevron}</button>
<div data-role="konto-crew-aktiv" style="display:flex;align-items:center;gap:11px;padding:12px 16px;min-height:46px;box-sizing:border-box;border-top:1px solid var(--ink-a06)"><span style="width:20px;display:flex;justify-content:center;flex:none">${svgCheckedCircle}</span><span style="font-size:13.5px;font-weight:650;color:var(--green-dark)">${tx('Crew ist mit diesem Konto aktiviert')}</span></div>`
    : `<div style="display:flex;flex-direction:column;gap:12px;padding:12px 16px 16px;border-top:1px solid var(--ink-a06)"><span style="font-size:12.5px;color:var(--ink-soft);line-height:1.45">${tx('Die Demo läuft nur auf diesem Gerät.')}</span><button data-act="acc-sheet" data-sheet="login" style="${GREEN_PILL}">${tx('Mit Desteny-Konto anmelden')}</button></div>`}
</div>`;
  const crewZeichen = svgCrewLogo.replace('width="60" height="60"', 'width="30" height="30"');
  const appsKarte = `<div style="display:flex;flex-direction:column;gap:6px">
${groupLabel(tx('Desteny-Apps'))}
${groupCard(`<div data-role="konto-apps" style="display:flex;align-items:center;gap:12px;padding:12px 16px">
<span style="width:40px;height:40px;border-radius:12px;background:var(--paper);display:flex;align-items:center;justify-content:center;flex:none">${crewZeichen}</span>
<div style="display:flex;flex-direction:column;gap:2px;flex:1;min-width:0"><span style="font-size:14.5px;font-weight:650">Crew</span><span style="font-size:11.5px;color:var(--muted);white-space:nowrap;overflow:hidden;text-overflow:ellipsis">${tx('Wer ist frei? Was machen wir?')}</span></div>
${konto.echt
    ? `<span data-role="konto-app-status" style="display:flex;align-items:center;gap:6px;font-size:12px;font-weight:650;color:var(--green-dark);background:var(--green-tint);padding:5px 10px;border-radius:999px;flex:none"><span style="width:7px;height:7px;border-radius:50%;background:var(--green)"></span>${tx('aktiv')}</span>`
    : `<span data-role="konto-app-status" style="font-size:12px;font-weight:650;color:var(--ink-soft);background:var(--field);padding:5px 10px;border-radius:999px;flex:none">${tx('Demo')}</span>`}
</div>`)}
</div>`;

  // Was man am Desteny-Konto ändern kann — nur mit echtem Konto.
  const verwalten = konto.echt
    ? `<div style="display:flex;flex-direction:column;gap:6px">
${groupLabel(tx('Verwalten'))}
${groupCard(`${navRow({ act: 'acc-sheet', data: { sheet: 'email' }, label: tx('E-Mail ändern'), last: !konto.kannPasswort })}
${konto.kannPasswort ? navRow({ act: 'acc-sheet', data: { sheet: 'passwort' }, label: tx('Passwort ändern'), last: true }) : ''}`)}
</div>`
    : '';

  const html = screenScaffold({
    header: subHeader(tx('Desteny-Konto')),
    bottomInset: 28,
    scrollKey: 'account',
    overlays: accountSheets(ctx),
    // „Konto löschen" bleibt wie in reference 06.7 ganz unten — ohne zweite Scrollfläche:
    // der Inhaltskörper ist mindestens so hoch wie die Scrollfläche, die rote Karte
    // schiebt sich per margin-top:auto ans Ende.
    body: `<div style="min-height:100%;display:flex;flex-direction:column;gap:14px;padding:2px 20px 0">
${kontoKarte}
${konto.neueEmail ? `<div style="background:var(--green-tint);border-radius:16px;padding:12px 14px;font:600 12.5px/1.5 ${FONT};color:var(--green-dark)">${tx('Wartet auf Bestätigung: {email}', { email: esc(konto.neueEmail) })}</div>` : ''}
${appsKarte}
${verwalten}
${konto.echt
      // Auftrag §1.6: Abmelden gab es überhaupt nicht — man konnte das Konto nur LÖSCHEN.
      // Wer die App auf einem fremden Gerät geöffnet hatte, kam nicht mehr heraus, ohne
      // alles zu verlieren. Deutlich getrennt von „Konto löschen": eigene Karte, weit
      // darüber, in ruhiger Schrift.
      ? groupCard(`<button data-act="acc-sheet" data-sheet="abmelden" style="display:flex;align-items:center;gap:10px;padding:14px 16px;width:100%;border:0;background:transparent;text-align:left;cursor:pointer;appearance:none;font-family:${FONT};color:var(--ink)"><span style="pointer-events:none;display:flex">${svgAbmelden}</span><span style="font-size:14px;font-weight:600;flex:1;pointer-events:none">${tx('Abmelden')}</span>${chevron}</button>`)
      : ''}
<div style="background:var(--surface);border-radius:18px;border:1px solid var(--red-a25);margin-top:auto;flex:none">
<button data-act="acc-sheet" data-sheet="delete" style="display:flex;align-items:center;gap:10px;padding:14px 16px;width:100%;border:0;background:transparent;text-align:left;cursor:pointer;appearance:none;font-family:${FONT}"><span style="pointer-events:none;display:flex">${svgTrashRed}</span><span style="font-size:14px;font-weight:650;color:var(--red);pointer-events:none">${tx('Desteny-Konto löschen')}</span></button>
</div>
</div>`,
  });

  return { html, bind: bindAccount };
}

function bindAccount(root, ctx) {
  const { repo, ui } = ctx;
  // Das Ergebnis kommt vom Server, nicht aus einem Toast: Erst wenn er zugestimmt hat,
  // schließt das Feld. Sagt er nein, bleibt es offen und nennt den Grund.
  const antwort = async (versprechen, erfolgsToast) => {
    const { ok, meldung } = await versprechen;
    if (!ok) { ui.accMeldung = meldung; ui.accMeldungGut = false; ctx.render(); return; }
    ui.accMeldung = '';
    ui.sheet = null;
    ctx.render();
    ctx.toast(erfolgsToast || meldung);
  };

  const sagen = (text, gut = false) => { ui.accMeldung = text; ui.accMeldungGut = gut; ctx.render(); };
  const andereAdresse = (wert) => EMAIL_FORM.test(wert) && wert.toLowerCase() !== (repo.getAccountInfo().email || '').trim().toLowerCase();

  // Runde 2: Die Knöpfe werden erst kräftig, wenn es wirklich etwas zu tun gibt — direkt am
  // DOM, ohne Neuzeichnen, damit die Eingabemarke im Feld bleibt.
  const knopfStellen = (knopf, an) => {
    if (!knopf) return;
    knopf.style.opacity = an ? '1' : '.4';
    knopf.setAttribute('aria-disabled', String(!an));
  };
  const emailFeld = root.querySelector('#acc-email');
  if (emailFeld) {
    const pruefen = () => knopfStellen(root.querySelector('[data-act="acc-email-save"]'), andereAdresse(emailFeld.value.trim()));
    emailFeld.addEventListener('input', pruefen);
    pruefen();
  }
  const altFeld = root.querySelector('#acc-password-alt');
  const neuFeld = root.querySelector('#acc-password');
  if (altFeld && neuFeld) {
    const pruefen = () => knopfStellen(root.querySelector('[data-act="acc-password-save"]'), altFeld.value.length > 0 && neuFeld.value.length >= 8);
    altFeld.addEventListener('input', pruefen);
    neuFeld.addEventListener('input', pruefen);
    pruefen();
  }

  bindActions(root, {
    'acc-sheet': (data) => { ui.sheet = data.sheet; ui.accMeldung = ''; ctx.render(); },
    'acc-close': () => { ui.sheet = null; ui.accMeldung = ''; ctx.render(); },
    // Jedes Passwortfeld hat sein eigenes Auge.
    'acc-auge': (data) => {
      const feld = root.querySelector(`#${data.feld || 'acc-password'}`);
      if (feld) feld.type = feld.type === 'password' ? 'text' : 'password';
    },
    // Eine Mail geht nur raus, wenn die Adresse gültig und wirklich eine andere ist.
    'acc-email-save': () => {
      const neu = (root.querySelector('#acc-email')?.value || '').trim();
      if (!EMAIL_FORM.test(neu)) { sagen(tx('Bitte eine gültige E-Mail-Adresse eingeben.')); return; }
      if (!andereAdresse(neu)) { sagen(tx('Das ist schon deine Adresse.')); return; }
      antwort(repo.changeEmail(neu));
    },
    'acc-password-save': () => antwort(repo.changePassword(root.querySelector('#acc-password-alt')?.value || '', root.querySelector('#acc-password')?.value || '')),
    'acc-password-vergessen': async () => {
      const { ok, meldung } = await repo.sendPasswordReset();
      sagen(meldung, ok);
    },
    // Aus der Demo zurück zur echten Anmeldung.
    'acc-zum-konto': () => {
      setGatewayMode('supabase');
      globalThis.location?.replace?.(globalThis.location.pathname);
    },
    // §1.6: Abmelden beendet die Sitzung und lädt neu — danach steht die Anmeldemaske da.
    'acc-signout': () => {
      ui.sheet = null;
      repo.signOut();
      setTimeout(() => globalThis.location?.reload?.(), 120);
    },
    'acc-delete': () => repo.deleteAccount(),
  });
}

// ============================================================================
// 06.8 Darstellung (profile.appearance) — Sheet über den Einstellungen
// ============================================================================

// Zeile eines Auswahlfelds ohne Bedienbarkeit: gedämpft, nicht anklickbar, aria-disabled.
// Sie zeigt den Zustand ehrlich an, statt eine Auswahl vorzutäuschen, die nichts bewirkt.
function radioRowDisabled({ label, hintHtml = '' }) {
  return `<div role="radio" aria-checked="false" aria-disabled="true" style="display:flex;align-items:center;gap:11px;padding:11px 0;width:100%;border-top:1px solid var(--ink-a05);font-family:${FONT};color:var(--ink);opacity:.4;cursor:default;user-select:none">
${radioMark(false)}<span style="font-size:14px;font-weight:600;color:var(--ink-soft);flex:1">${esc(label)}</span>${hintHtml}</div>`;
}

// Aktive, aber nicht abwählbare Zeile (der einzige verfügbare Wert).
function radioRowFixed({ label, hintHtml = '' }) {
  return `<div role="radio" aria-checked="true" style="display:flex;align-items:center;gap:11px;padding:11px 0;width:100%;border-top:1px solid var(--ink-a05);font-family:${FONT};color:var(--ink);user-select:none">
${radioMark(true)}<span style="font-size:14px;font-weight:650;flex:1">${esc(label)}</span>${hintHtml}</div>`;
}

function renderAppearance(ctx) {
  // Fable (04.09.2026): Der Schalter wirkt. Drei Werte — „System" folgt dem Gerät (und
  // wechselt live mit), „Hell"/„Dunkel" sind fest. Gespeichert unter settings.appearance.theme,
  // angewendet in app.js vor jedem Zeichnen (core/theme.js setzt data-theme am <html>).
  const aktuell = ctx.repo.getSettings().appearance?.theme || 'hell';
  const zeile = (theme, label, hint) => radioRow({ act: 'theme-set', data: { theme }, selected: aktuell === theme, label, hintHtml: hint ? hintSpan(hint) : '' });
  const content = `<span style="font-family:${BRICOLAGE};font-size:19px;font-weight:650;display:block;padding-bottom:6px">${tx('Darstellung')}</span>
${zeile('system', tx('System'), tx('folgt dem Gerät'))}
${zeile('hell', tx('Hell'))}
${zeile('dunkel', tx('Dunkel'))}`;

  const html = settingsScaffold(ctx, sheet(content, { closeAct: 'sheet-back' }));
  return {
    html,
    bind: (root, innerCtx) => {
      bindActions(root, {
        'sheet-back': () => innerCtx.nav.back('profile.settings'),
        // Auftrag §7: „Darstellung lässt sich nicht umstellen." Der Grund stand genau hier:
        // bindActions übergibt als ERSTES das dataset des angetippten Knotens, nicht den
        // Knoten. `el.dataset.theme` war also immer undefined, die Prüfung darunter brach
        // ab — und der Tipp verpuffte, ohne dass irgendetwas aussah wie ein Fehler.
        'theme-set': (data) => {
          const theme = data.theme;
          if (!THEME_LABELS[theme]) return;
          innerCtx.repo.updateSettings({ appearance: { theme } });
          innerCtx.render();
        },
      });
    },
  };
}

// Runde 2: Sprache. „Wie das Gerät" folgt der Sprache des Handys; eine feste Wahl liegt im
// Konto und gilt auf jedem Gerät. Jede Sprache steht in ihrer eigenen Schreibweise da — wer aus
// Versehen Spanisch gewählt hat, findet „Deutsch" wieder, ohne Spanisch zu lesen.
// Ein Tipp wählt; die App lädt dann neu und kommt in die Einstellungen zurück.
function spracheWert() {
  const wahl = sprachWahl();
  return wahl === 'auto' ? tx('Wie das Gerät') : (SPRACHEN.find((s) => s.code === wahl)?.name || wahl);
}

function renderSprache(ctx) {
  const aktuell = sprachWahl();
  const geraet = SPRACHEN.find((s) => s.code === geraeteSprache())?.name || 'English';
  const zeile = (code, label, hint) => radioRow({ act: 'sprache-set', data: { sprache: code }, selected: aktuell === code, label, hintHtml: hint ? hintSpan(hint) : '' });
  const content = `<span style="font-family:${BRICOLAGE};font-size:19px;font-weight:650;display:block;padding-bottom:6px">${esc(tx('Sprache'))}</span>
${zeile('auto', tx('Wie das Gerät'), geraet)}
${SPRACHEN.map((s) => zeile(s.code, s.name)).join('\n')}`;

  const html = settingsScaffold(ctx, sheet(content, { closeAct: 'sheet-back' }));
  return {
    html,
    bind: (root, innerCtx) => {
      bindActions(root, {
        'sheet-back': () => innerCtx.nav.back('profile.settings'),
        'sprache-set': (data) => {
          const code = data.sprache;
          if (code !== 'auto' && !SPRACHEN.some((s) => s.code === code)) return;
          // Zuerst ins Konto — es wird im Gerät gesichert, bevor es gesendet wird, ein Neuladen
          // verliert es also nicht —, dann ins Gerät.
          innerCtx.repo.updateSettings({ sprache: code });
          if (merkeSprachWahl(code)) {
            try { globalThis.sessionStorage?.setItem('crew.nachSprache', 'profile.settings'); } catch { /* egal */ }
            window.location.reload();
            return;
          }
          innerCtx.render();
        },
      });
    },
  };
}

// ============================================================================
// 06.9 Benachrichtigungen (profile.notifications) — Frei-Hinweise global
// ============================================================================

// v3.1 §4: Keine erklärenden Dauerbanner mehr — die Chat-Zeile trägt keinen Erklärsatz.
const NOTIFICATION_ROWS = [
  { key: 'invitations', label: tx('Einladungen & Meet-Änderungen') },
  { key: 'mentions', label: tx('Direkte Erwähnungen') },
  { key: 'chat', label: tx('Chat') },
  { key: 'updates', label: tx('Updates & Zusammenfassungen') },
];

// v3.1 §4: Die Meet-Erinnerung ist NIE nur An/Aus — die sichtbare Einstellung benennt
// ihren Zeitpunkt. Standard sind 15 Minuten vor Beginn.
// v7 A33c: realistische Vorlaufwerte im RUHIGEN Wheel — dieselbe Grammatik wie Uhrzeit
// und Kapazität. Die vier Pillen sind entfallen; eine Pillenreihe ist eine dritte
// Bedienform für dieselbe Art Entscheidung.
const REMINDER_MINUTES = [5, 10, 15, 30, 45, 60, 120];
const REMINDER_DEFAULT = 15;

function reminderMinutes(settings) {
  const value = Number(settings.notifications?.reminderMinutes);
  return REMINDER_MINUTES.includes(value) ? value : REMINDER_DEFAULT;
}

function reminderText(minutes) {
  return Number(minutes) >= 60 ? tx('{n} Std.', { n: Number(minutes) / 60 }) : tx('{n} Min.', { n: minutes });
}

function reminderLabel(minutes) {
  return tx('{zeit} vor Beginn', { zeit: reminderText(minutes) });
}

function reminderValue(settings) {
  return settings.notifications?.reminder === false ? tx('Erinnerung aus') : reminderLabel(reminderMinutes(settings));
}

// T4: Mitteilungen kommen nur an, wenn dieses GERÄT dafür angemeldet ist. Das ist eine
// eigene Entscheidung und keine Einstellung wie die darunter: Sie gilt je Gerät, sie braucht
// die Erlaubnis des Browsers, und sie lässt sich nicht überall treffen. Deshalb steht sie
// oben und sagt in jedem Fall, woran man ist — statt einen Schalter zu zeigen, der nichts tut.
// Runde 5 (P5, G1): Die Karte lebt in ui/mitteilungen.js — dieselbe Quelle wie die Karte oben im
// Crew-Tab, damit beide immer denselben Zustand zeigen: an · aus · vom System blockiert · auf diesem
// Gerät nicht möglich · iPhone ohne Home-Bildschirm (mit Bildzeichen-Anleitung) · nur mit Konto.
function pushKarte(ctx) {
  return pushSeitenKarte(ctx, { schalter: (an) => toggleSwitch(an, 'push-toggle') });
}

// Runde 5 (P5, G2): Töne in der offenen App (settings.notifications.toene, fehlt = an).
function toeneKarte(notifications) {
  return groupCard(`<div data-role="toene-zeile" style="display:flex;justify-content:space-between;align-items:center;gap:10px;padding:12px 16px">
<div style="display:flex;flex-direction:column;gap:2px;min-width:0"><span style="font-size:14px;font-weight:600">${tx('Töne')}</span><span style="font-size:11.5px;color:var(--muted);line-height:1.4">${tx('Kurzer Ton und Vibration, wenn etwas ankommt, während Crew offen ist')}</span></div>
${toggleSwitch(notifications.toene !== false, 'notif-toene')}</div>`);
}

function renderNotifications(ctx) {
  const { repo } = ctx;
  const settings = repo.getSettings();
  const notifications = settings.notifications || {};
  // Runde 4 (B6, Jonathan): „Der Standard ist bei allen Freunden, dass man von allen Freunden eine
  // Benachrichtigung kriegt, wenn sie frei sind." Fehlt die Einstellung, gilt deshalb 'alle'.
  const hints = settings.freiHints || { mode: 'alle', customIds: [] };
  const people = repo.getPeople();

  const toggleRows = NOTIFICATION_ROWS.map((row, index) => `<div style="display:flex;justify-content:space-between;align-items:center;gap:10px;padding:12px 16px;${index === NOTIFICATION_ROWS.length - 1 ? '' : 'border-bottom:1px solid var(--ink-a06)'}">
${row.sub ? `<div style="display:flex;flex-direction:column;gap:2px;min-width:0"><span style="font-size:14px;font-weight:600">${esc(row.label)}</span><span style="font-size:11.5px;color:var(--muted)">${esc(row.sub)}</span></div>` : `<span style="font-size:14px;font-weight:600">${esc(row.label)}</span>`}
${toggleSwitch(Boolean(notifications[row.key]), 'notif-toggle', { key: row.key })}</div>`).join('');

  const customCount = (hints.customIds || []).length;
  const individuellHint = hints.mode === 'individuell'
    ? `<span style="display:flex;align-items:center;gap:6px;pointer-events:none"><span style="font-size:12px;font-weight:650;color:var(--green-dark)">${tnx(customCount, '{n} Freund', '{n} Freunde')} ›</span></span>`
    : '';

  const reminderOn = notifications.reminder !== false;
  const minutes = reminderMinutes(settings);
  const reminderRow = `<div style="display:flex;justify-content:space-between;align-items:center;gap:10px;padding:12px 16px;border-top:1px solid var(--ink-a06)">
<div style="display:flex;flex-direction:column;gap:2px;min-width:0"><span style="font-size:14px;font-weight:600">${tx('Meet-Erinnerung')}</span><span style="font-size:11.5px;color:var(--muted)">${esc(reminderOn ? reminderLabel(minutes) : tx('aus'))}</span></div>
${toggleSwitch(reminderOn, 'notif-reminder')}</div>
<div style="display:flex;align-items:center;justify-content:center;position:relative;padding:2px 16px 12px;${reminderOn ? '' : 'opacity:.4;pointer-events:none'}">
<div style="position:absolute;left:50%;transform:translateX(-50%);width:104px;top:50%;margin-top:-23px;height:38px;border-radius:12px;background:var(--paper)"></div>
${wheelColumn('reminder', REMINDER_MINUTES, minutes, { text: reminderText, width: 104 })}
</div>`;

  const html = screenScaffold({
    header: subHeader(tx('Benachrichtigungen')),
    bottomInset: 28,
    scrollKey: 'notifications',
    overlays: ctx.ui.sheet === 'hints' ? hintsPickSheet(ctx, people) : '',
    // Runde 4 (E4, Jonathan): „normale Benachrichtigungen und Benachrichtigungen für Anstupser" —
    // zwei getrennte Bereiche. Der Anstupser-Schalter schreibt notifications.anstupser (fehlt = an);
    // die native App legt dafür einen eigenen Mitteilungskanal an.
    // Runde 4 (B6): „Alle" ist der Standard und steht deshalb oben.
    body: `<div style="display:flex;flex-direction:column;gap:14px;padding:2px 20px 0">
${pushKarte(ctx)}
${toeneKarte(notifications)}
<div style="display:flex;flex-direction:column;gap:6px">${groupLabel(tx('Mitteilungen'))}
${groupCard(`${toggleRows}${reminderRow}`)}</div>
<div style="display:flex;flex-direction:column;gap:6px">${groupLabel(tx('Anstupser'))}
${groupCard(`<div data-role="anstupser-zeile" style="display:flex;justify-content:space-between;align-items:center;gap:10px;padding:12px 16px">
<div style="display:flex;flex-direction:column;gap:2px;min-width:0"><span style="font-size:14px;font-weight:600">${tx('Wenn dich jemand anstupst')}</span><span style="font-size:11.5px;color:var(--muted);line-height:1.4">${tx('Eigene Mitteilung, getrennt von den übrigen')}</span></div>
${toggleSwitch(notifications.anstupser !== false, 'notif-anstupser')}</div>`)}</div>
${choiceCard(tx('Frei-Hinweise von Freunden'), `
${radioRow({ act: 'hints-mode', data: { mode: 'alle' }, selected: hints.mode === 'alle', label: tx('Alle'), hintHtml: hintSpan(tx('Standard')) })}
${radioRow({ act: 'hints-mode', data: { mode: 'beste' }, selected: hints.mode === 'beste', label: tx('Beste Freunde') })}
${radioRow({ act: 'hints-mode', data: { mode: 'markierte' }, selected: hints.mode === 'markierte', label: MARKED_FRIENDS_LABEL })}
${radioRow({ act: 'hints-mode', data: { mode: 'individuell' }, selected: hints.mode === 'individuell', label: tx('Individuell'), hintHtml: individuellHint })}
${radioRow({ act: 'hints-mode', data: { mode: 'niemand' }, selected: hints.mode === 'niemand', label: tx('Niemand') })}`)}
</div>`,
  });

  return { html, bind: bindNotifications };
}

// 06.9b — „Individuell" öffnet direkt dieses Slide-up mit der echten Personen-Auswahl
// (gruppiert wie 06.11, kein zweiter Umschalter, nur so hoch wie die Liste).
function hintsPickSheet(ctx, people) {
  const { repo, ui } = ctx;
  const settings = repo.getSettings();
  const picked = ui.hintsPick || [];
  const groups = groupedFriends(people, settings);

  const row = (person) => {
    const marker = personMarker(person.id, settings);
    const selected = picked.includes(person.id);
    const control = selected
      ? `<span style="width:26px;height:26px;border-radius:50%;background:var(--green);display:flex;align-items:center;justify-content:center;flex:none;pointer-events:none"><svg width="12" height="12" viewBox="0 0 24 24" fill="none"><path d="m7.5 12.5 3 3 6-6.5" stroke="var(--on-accent)" stroke-width="2.6" stroke-linecap="round" stroke-linejoin="round"></path></svg></span>`
      : `<span style="width:26px;height:26px;border-radius:50%;border:1.5px solid var(--ink-a16);box-sizing:border-box;flex:none;pointer-events:none"></span>`;
    return `<button data-act="hints-person" data-person="${person.id}" style="display:flex;align-items:center;gap:11px;padding:9px 0;width:100%;border:0;border-top:1px solid var(--ink-a05);background:transparent;text-align:left;cursor:pointer;appearance:none;font-family:${FONT};color:var(--ink)">
<span style="pointer-events:none;display:contents">${personAvatar(person, { size: 36, fontSize: 13, marker })}</span>
<span style="display:flex;align-items:center;gap:6px;flex:1;min-width:0;pointer-events:none"><span style="font-size:14.5px;font-weight:600;white-space:nowrap;overflow:hidden;text-overflow:ellipsis">${esc(person.name)}</span>${specialLabelChip(marker)}</span>
${control}</button>`;
  };
  const group = (label, list) => (list.length
    ? `<span style="font-size:10.5px;font-weight:650;letter-spacing:.09em;text-transform:uppercase;color:var(--muted-light);padding:12px 0 2px">${esc(label)}</span>${list.map(row).join('')}`
    : '');

  return `<div style="position:absolute;inset:0;z-index:14;display:flex;align-items:flex-end">
<div data-act="hints-close" style="position:absolute;inset:0;background:var(--scrim);-webkit-backdrop-filter:var(--scrim-filter);backdrop-filter:var(--scrim-filter)"></div>
<div style="position:relative;width:100%;background:var(--surface);border-radius:28px 28px 0 0;display:flex;flex-direction:column;box-shadow:0 -8px 24px var(--shadow-18);max-height:88%">
<span style="width:36px;height:4px;border-radius:2px;background:var(--handle);align-self:center;flex:none;margin:11px 0 0"></span>
<div style="display:flex;align-items:baseline;gap:10px;padding:10px 20px 2px">
<span style="font-family:${BRICOLAGE};font-size:19px;font-weight:650;flex:1">${tx('Frei-Hinweise · Individuell')}</span>
<span style="font-size:12.5px;color:var(--muted);font-variant-numeric:tabular-nums;flex:none">${tx('{n} gewählt', { n: picked.length })}</span>
</div>
<div style="display:flex;flex-direction:column;padding:0 20px;overflow-y:auto;scrollbar-width:none" data-scroll-keep="hints-pick">
${group(tx('Besondere Person'), groups.special)}
${group(tx('Beste Freunde'), groups.best)}
${group(tx('Freunde'), groups.normal)}
</div>
<div style="padding:14px 20px 28px"><button data-act="hints-save" style="border:0;background:var(--green);color:var(--on-accent);font:650 15px/1 ${FONT};padding:16px 0;border-radius:999px;width:100%;cursor:pointer;appearance:none">${tx('Speichern')}</button></div>
</div></div>`;
}

function bindNotifications(root, ctx) {
  const { repo, ui } = ctx;
  v7ProfilDefaults(repo);           // schreibt hoechstens einmal (A33a/A35b)

  // T4 / Runde 5 (P5): Was für dieses Gerät gilt, weiß nur der Browser. pushLage() liefert beim
  // Rendern sofort den wahrscheinlichen Stand; hier wird einmal nachgefragt und bei Änderung neu
  // gezeichnet. Der Wächter hört, was in der offenen App ankommt (Ton + Vibration).
  pushLageAuffrischen(ctx);
  mitteilungenBeobachten(ctx);
  // v7 A33c: Die Erinnerungszeit laesst sich ziehen wie jede andere Walze.
  bindWheelDrag(root, (col, value) => {
    if (col !== 'reminder') return;
    const current = repo.getSettings().notifications || {};
    repo.updateSettings({ notifications: { ...current, reminder: true, reminderMinutes: Number(value) } });
  });
  bindActions(root, {
    'wheel-set': (data) => {
      if (data.col !== 'reminder') return;
      const current = repo.getSettings().notifications || {};
      repo.updateSettings({ notifications: { ...current, reminder: true, reminderMinutes: Number(data.value) } });
    },
    // Der Schalter fragt nach der Erlaubnis — NUR auf diesen Tipp, und synchron darin: vorher lagen
    // ein dynamischer Import und zwei Rückfragen dazwischen, und Safari verlangt die Berührung als
    // unmittelbaren Auslöser. Runde 5 (P5): 'push-toggle' und 'push-probe' aus ui/mitteilungen.js.
    ...pushSeitenAktionen(ctx),
    // Runde 5 (G2): Töne in der offenen App. Fehlt der Wert, sind sie an; Einschalten spielt eine Probe.
    'notif-toene': () => {
      const current = repo.getSettings().notifications || {};
      const an = current.toene === false;
      repo.updateSettings({ notifications: { ...current, toene: an } });
      haptik('tipp');
      if (an) ton('probe');
    },
    'notif-toggle': (data) => {
      const current = repo.getSettings().notifications || {};
      repo.updateSettings({ notifications: { ...current, [data.key]: !current[data.key] } });
    },
    // Runde 4 (E4): fehlt der Wert, sind Anstupser an — der erste Tipp schaltet sie also aus.
    'notif-anstupser': () => {
      const current = repo.getSettings().notifications || {};
      repo.updateSettings({ notifications: { ...current, anstupser: current.anstupser === false } });
      haptik('tipp');
    },
    'notif-reminder': () => {
      const current = repo.getSettings().notifications || {};
      const on = current.reminder !== false;
      repo.updateSettings({
        notifications: { ...current, reminder: !on, reminderMinutes: reminderMinutes(repo.getSettings()) },
      });
    },
    'hints-mode': (data) => {
      const current = repo.getSettings().freiHints || {};
      if (data.mode === 'individuell') {
        ui.sheet = 'hints';
        ui.hintsPick = [...(current.customIds || [])];
      }
      repo.updateSettings({ freiHints: { ...current, mode: data.mode } });
    },
    'hints-person': (data) => {
      const picked = ui.hintsPick || [];
      ui.hintsPick = picked.includes(data.person) ? picked.filter((id) => id !== data.person) : [...picked, data.person];
      ctx.render();
    },
    'hints-close': () => { ui.sheet = null; ctx.render(); },
    'hints-save': () => {
      const current = repo.getSettings().freiHints || {};
      ui.sheet = null;
      repo.updateSettings({ freiHints: { ...current, mode: 'individuell', customIds: ui.hintsPick || [] } });
    },
  });
}

// ============================================================================
// 06.10 Frei-Reset (profile.freiReset) — Uhrzeit-Walze, Standard 00:00
// ============================================================================

const MINUTE_STEPS = [0, 15, 30, 45];
const pad2 = (n) => String(n).padStart(2, '0');

// Auftrag §4.3: Das Rad steht EINMAL in ui/components.js (radSpalte/bindRad) und wird von
// hier und vom Meet-Composer benutzt. Vorher gab es hier eine zweite Fassung, die beim
// Ziehen in Stufen von 24 Pixeln von Wert zu Wert SPRANG — dieselbe Bedienung wie im
// Composer, aber ein anderes Gefühl. Jetzt folgt beides dem Finger und rastet weich ein.
const WHEEL_ROW = RAD_ZEILE;
function wheelColumn(col, werte, gewaehlt, optionen = {}) {
  return radSpalte(col, werte, gewaehlt, {
    runden: optionen.runden ?? 1,
    width: optionen.width,
    text: optionen.text,
    act: 'wheel-set',
  });
}

// Alle Räder eines Bildschirms an dieselbe Rückmeldung hängen.
function bindWheelDrag(root, onChange) {
  root.querySelectorAll('[data-role^="wheel-"][data-index]').forEach((box) => {
    const rolle = box.dataset.role.replace(/^wheel-/, '');
    bindRad(root, rolle, (wert) => onChange(rolle, wert));
  });
}

function renderFreiReset(ctx) {
  const { repo, ui } = ctx;
  const resetGuard = dirtyGuard(ctx, 'frei-reset');
  if (ui.hour === undefined) {
    const [h, m] = (repo.getSettings().freeResetTime || '00:00').split(':').map(Number);
    ui.hour = Number.isFinite(h) ? h : 0;
    ui.minute = MINUTE_STEPS.includes(m) ? m : 0;
    // Ü4: Ausgangszeit merken — ein gedrehtes Rad darf beim Scrim-Tap nicht still verfallen.
    resetGuard.track({ hour: ui.hour, minute: ui.minute });
  }
  const stunden = Array.from({ length: 24 }, (_, i) => i);
  const hourValues = [-2, -1, 0, 1, 2].map((offset) => ({ offset, value: (ui.hour + offset + 24) % 24 }));
  const minuteIndex = MINUTE_STEPS.indexOf(ui.minute);
  const minuteValues = [-2, -1, 0, 1, 2].map((offset) => ({ offset, value: MINUTE_STEPS[(minuteIndex + offset + 8) % 4] }));

  const content = `<span style="font-family:${BRICOLAGE};font-size:19px;font-weight:650;display:block">${tx('Frei zurücksetzen um')}</span>
<span style="display:block;font-size:12.5px;color:var(--ink-soft);line-height:1.45;padding:8px 0 2px">${tx('Der Frei-Status wird spätestens um diese Uhrzeit zurückgesetzt — oder früher durch dein eigenes aktives Meet.')}</span>
<div style="display:flex;gap:12px;align-items:center;justify-content:center;position:relative;padding:10px 0">
<div style="position:absolute;left:110px;right:110px;top:50%;transform:translateY(-50%);height:38px;border-radius:12px;background:var(--paper)"></div>
${wheelColumn('hour', stunden, ui.hour, { runden: 3 })}
<span style="font-size:17px;font-weight:650;position:relative">:</span>
${wheelColumn('minute', MINUTE_STEPS, ui.minute, { runden: 7 })}
</div>
<div style="display:flex;gap:8px;padding-top:4px">
<button data-act="reset-standard" style="flex:1;border:1.5px solid var(--ink-a14);background:var(--surface);color:var(--ink-soft);font:650 14px/1 ${FONT};padding:13px 0;border-radius:999px;display:flex;align-items:center;justify-content:center;gap:6px;cursor:pointer;appearance:none"><svg width="12" height="12" viewBox="0 0 24 24" fill="none" style="pointer-events:none"><path d="M4 12a8 8 0 1 0 2.3-5.6M4 4v4h4" stroke="var(--ink-soft)" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"></path></svg><span style="pointer-events:none">${tx('Standard 00:00')}</span></button>
<button data-act="reset-save" style="flex:1;${GREEN_PILL};width:auto">${tx('Übernehmen')}</button>
</div>`;

  const html = settingsScaffold(ctx, `${sheet(content, { closeAct: 'sheet-back' })}${discardSheet(ctx)}`);
  return {
    html,
    bind: (root, innerCtx) => {
      const { nav, repo: repo2, ui: ui2 } = innerCtx;
      const leave = () => nav.back('profile.settings');
      // v7 A32b: dieselbe Ziehgeste wie bei Kapazität und Erinnerung.
      bindWheelDrag(root, (col, value) => {
        if (col === 'hour') ui2.hour = Number(value);
        else ui2.minute = Number(value);
        innerCtx.render();
      });
      bindActions(root, {
        ...discardActions(innerCtx),
        'sheet-back': () => {
          const guard2 = dirtyGuard(innerCtx, 'frei-reset');
          if (guard2.confirm({ hour: ui2.hour, minute: ui2.minute }, leave)) leave();
        },
        'wheel-set': (data) => {
          if (data.col === 'hour') ui2.hour = Number(data.value);
          else ui2.minute = Number(data.value);
          innerCtx.render();
        },
        'reset-standard': () => { ui2.hour = 0; ui2.minute = 0; innerCtx.render(); },
        'reset-save': () => {
          dirtyGuard(innerCtx, 'frei-reset').clear();
          repo2.updateSettings({ freeResetTime: `${pad2(ui2.hour)}:${pad2(ui2.minute)}` });
          nav.back('profile.settings');
          innerCtx.toast(tx('Frei zurücksetzen um {zeit}', { zeit: `${pad2(ui2.hour)}:${pad2(ui2.minute)}` }));
        },
      });
    },
  };
}

// ============================================================================
// 06.11 Freunde (profile.friends) — Vertrag §9: nur Liste, Entfernen,
// Bester Freund (max 3), Besondere Person mit Bearbeiten-Sheet
// ============================================================================

// Freunde in v14-Ordnung gruppieren: Besondere Person · Beste Freunde · Freunde.
function groupedFriends(people, settings) {
  const specialId = settings.specialPerson?.personId || null;
  const best = settings.bestFriendIds || [];
  return {
    special: people.filter((person) => person.id === specialId),
    best: people.filter((person) => best.includes(person.id) && person.id !== specialId),
    normal: people.filter((person) => person.id !== specialId && !best.includes(person.id)),
  };
}

// v4 P0-3-2 / COMPONENT_RULES 3: Dieses Sheet gehört AUSSCHLIESSLICH der Besonderen Person.
// Vorher war es ein Kombi-Sheet mit Radio-Auswahl für BEIDE Markierungsarten — genau die
// von v4 verbotene zweite Auswahlseite. „Als bester Freund markieren" setzt den Goldring
// jetzt direkt im Menü, ohne Sheet. Hier stehen nur: Titel „Für dich", kuratierte
// Symbolauswahl, dezente Akzentfarbe, optionales Label und Entfernen.
export function markSheet(ctx) {
  const { repo, ui } = ctx;
  const settings = repo.getSettings();
  const person = repo.getPerson(ui.markFor);
  if (!person) return '';
  const label = ui.markLabel || '';
  // v6 A04a/A04c: kein Viereck und keine Farbe ausserhalb der Palette als Rueckfall.
  const symbol = specialSymbolKey(ui.markSymbol);
  const emoji = ui.markEmoji || '';       // v5 A10: Emoji statt Vektorsymbol, wenn gewählt
  // v7 A04c: Ein Altwert außerhalb der Palette wird auf den nächstliegenden Ton abgebildet,
  // damit IMMER genau ein Feld den Auswahlring trägt.
  const color = paletteColor(ui.markColor || MARK_COLOR_DEFAULT);
  const isSpecial = settings.specialPerson?.personId === person.id;

  // Vorschau: Das Symbol sitzt unten links AM AVATAR (v4 P0-3-1). Neben dem Namen steht
  // nur das Label — und nur, wenn wirklich eines getippt wurde.
  const previewMarker = { kind: 'special', symbol, emoji, color, label: label.trim() };
  const headerChip = specialLabelChip(previewMarker);

  const specialSections = `
<div style="display:flex;flex-direction:column;gap:7px">
<div style="display:flex;align-items:baseline;gap:8px"><span style="font-size:11px;font-weight:650;letter-spacing:.09em;text-transform:uppercase;color:var(--muted-light);flex:1">${tx('Label · frei tippbar')}</span><span id="mark-count" style="font-size:10.5px;color:var(--line-solid);font-variant-numeric:tabular-nums">${label.length}/18</span></div>
<div style="background:var(--surface);border:1.5px solid var(--green-a50);border-radius:16px;padding:12px 16px;display:flex;align-items:center;gap:9px">
<input id="mark-label" value="${esc(label)}" maxlength="18" placeholder="${esc(tx('z. B. Freundin'))}" aria-label="${esc(tx('Label'))}" style="flex:1;min-width:0;border:0;outline:none;background:transparent;font:650 15.5px ${FONT};color:var(--ink);caret-color:var(--green);padding:0">
<svg width="15" height="15" viewBox="0 0 24 24" fill="none" style="flex:none"><path d="M4 20h4L19.5 8.5a2.1 2.1 0 0 0-3-3L5 17l-1 4Z" stroke="var(--muted-light)" stroke-width="1.8" stroke-linejoin="round"></path></svg>
</div>
<span style="font-size:11px;color:var(--muted);padding-left:2px">${tx('Ohne Eingabe steht neben dem Namen nur der Name.')}</span>
</div>
<div style="display:flex;flex-direction:column;gap:8px">
<span style="font-size:11px;font-weight:650;letter-spacing:.09em;text-transform:uppercase;color:var(--muted-light)">${tx('Symbol oder Emoji')}</span>
<div style="display:flex;flex-wrap:wrap;gap:8px">${MARK_SYMBOL_ORDER.map((key) => {
    const selected = key === symbol && !emoji;
    return `<button data-act="mark-symbol" data-symbol="${key}" aria-label="${esc(tx('Symbol'))}" aria-pressed="${selected}" style="width:44px;height:44px;border-radius:14px;background:${selected ? hexToRgba(color, .1) : 'var(--paper)'};border:${selected ? `1.5px solid ${hexToRgba(color, .65)}` : '0'};box-sizing:border-box;display:flex;align-items:center;justify-content:center;flex:none;cursor:pointer;appearance:none;padding:0"><span style="pointer-events:none;display:flex;align-items:center;justify-content:center">${markSymbolGlyph(key, selected ? color : 'var(--muted-light)')}</span></button>`;
  }).join('')}
<label data-act="mark-emoji-focus" style="width:44px;height:44px;border-radius:14px;background:${emoji ? hexToRgba(color, .1) : 'var(--paper)'};border:${emoji ? `1.5px solid ${hexToRgba(color, .65)}` : '1.5px dashed var(--ink-a18)'};box-sizing:border-box;display:flex;align-items:center;justify-content:center;flex:none;cursor:text;padding:0;position:relative">
<input id="mark-emoji" value="${esc(emoji)}" inputmode="text" enterkeyhint="done" maxlength="8" autocomplete="off" aria-label="${esc(tx('Eigenes Emoji'))}" style="position:absolute;inset:0;width:100%;height:100%;border:0;background:transparent;outline:none;text-align:center;font-size:20px;line-height:1;color:var(--ink);padding:0;font-family:${FONT}">
${emoji ? '' : `<span style="pointer-events:none;font-size:17px;opacity:.5">🙂</span>`}</label>
</div>
<span style="font-size:11px;color:var(--muted);padding-left:2px">${tx('Eigenes Emoji: das rechte Feld antippen und aus der Tastatur wählen. Ein Emoji ersetzt das Symbol — der farbige Ring bleibt.')}</span>
</div>
<div style="position:relative;display:flex;flex-direction:column;gap:8px">
<span style="font-size:11px;font-weight:650;letter-spacing:.09em;text-transform:uppercase;color:var(--muted-light)">${tx('Farbe')}</span>
<button data-act="mark-color-open" aria-expanded="${Boolean(ui.markColorOpen)}" style="background:var(--paper);border-radius:14px;padding:11px 14px;display:flex;align-items:center;gap:11px;border:0;width:100%;cursor:pointer;appearance:none;font-family:${FONT};color:var(--ink)">
<span style="width:26px;height:26px;border-radius:50%;background:${color};flex:none;pointer-events:none"></span>
<span style="font-size:14px;font-weight:650;flex:1;text-align:left;pointer-events:none">${esc(paletteColorName(color))}</span>
${svgChevronUp('var(--ink)', 13)}
</button>
${ui.markColorOpen ? `<div data-role="mark-color-pop" style="position:absolute;left:0;right:0;bottom:calc(100% + 6px);background:var(--surface);border-radius:20px;border:1px solid var(--ink-a07);box-shadow:0 12px 32px var(--shadow-22);padding:14px;display:flex;flex-direction:column;gap:11px;z-index:3">
<span style="font-size:11px;font-weight:650;letter-spacing:.09em;text-transform:uppercase;color:var(--muted-light)">${tx('Farbe wählen')}</span>
${/* v7 A04c: FÜNF Spalten, drei volle Zeilen, 15 Felder — ein durchgehendes Spektrum von
      Indigo bis Violett. Keine halb besetzte Zeile, kein isolierter letzter Kreis. Die
      gewählte Farbe trägt genau einen sauberen Auswahlring, keinen zweiten großen Kreis. */''}
<div style="display:grid;grid-template-columns:repeat(5,1fr);gap:9px">${MARK_PALETTE.map(([value, name]) => {
    const selected = value === color;
    return `<button data-act="mark-color" data-color="${value}" aria-label="${esc(name)}" aria-pressed="${selected}" style="width:100%;aspect-ratio:1;max-width:38px;border-radius:50%;background:${value};border:0;padding:0;cursor:pointer;appearance:none;justify-self:center;${selected ? `box-shadow:0 0 0 2px var(--surface),0 0 0 3.5px ${value}` : ''}"></button>`;
  }).join('')}</div>
</div>` : ''}
</div>`;

  // v7 A05 (spec/01 §3): Der Farb-Popover ist ein Unterzustand IM Sheet. Diese unsichtbare
  // Rücknahmefläche liegt ÜBER dem restlichen Sheetinhalt, aber UNTER dem Popover — ein
  // Tap daneben schließt deshalb nur den Popover, nie das Sheet. Ohne sie fand der Tap
  // gar keine Aktion (bindActions reagiert nur auf [data-act]) und nichts geschah.
  const paletteRuecknahme = ui.markColorOpen
    ? `<div data-act="mark-color-close" aria-hidden="true" style="position:absolute;inset:0;z-index:2"></div>`
    : '';

  return `<div style="position:absolute;inset:0;z-index:14;display:flex;align-items:flex-end">
<div data-act="mark-close" class="ui-sheet-scrim" style="position:absolute;inset:0;background:var(--scrim);-webkit-backdrop-filter:var(--scrim-filter);backdrop-filter:var(--scrim-filter)"></div>
<div class="ui-sheet-card" style="position:relative;width:100%;background:var(--surface);border-radius:28px 28px 0 0;padding:12px 20px 28px;display:flex;flex-direction:column;gap:13px;box-shadow:0 -8px 24px var(--shadow-18);max-height:92%;overflow-y:auto">
${paletteRuecknahme}
<span style="width:36px;height:4px;border-radius:2px;background:var(--handle);align-self:center;flex:none"></span>
<span style="font-family:${BRICOLAGE};font-size:22px;font-weight:650;letter-spacing:-.01em;flex:none">${tx('Für dich')}</span>
<div style="display:flex;align-items:center;gap:12px">
<span style="pointer-events:none;display:contents">${personAvatar(person, { size: 44, fontSize: 16, marker: previewMarker })}</span>
<div style="display:flex;flex-direction:column;gap:3px;flex:1;min-width:0">
<span style="display:flex;align-items:center;gap:7px;min-width:0"><span style="font-family:${BRICOLAGE};font-size:19px;font-weight:650;letter-spacing:-.01em;white-space:nowrap;overflow:hidden;text-overflow:ellipsis">${esc(person.name)}</span><span id="mark-chip" style="display:contents">${headerChip}</span></span>
<span style="font-size:11.5px;color:var(--muted)">${tx('Nur für dich sichtbar')}</span>
</div>
</div>
${specialSections}
<div style="display:flex;gap:8px">
${isSpecial ? `<button data-act="mark-remove" style="flex:1;border:1.5px solid var(--ink-a14);background:var(--surface);color:var(--ink-soft);font:650 14px/1 ${FONT};padding:13px 0;border-radius:999px;cursor:pointer;appearance:none">${tx('Entfernen')}</button>` : ''}
<button data-act="mark-save" style="flex:1;background:var(--green);border:0;color:var(--on-accent);font:650 14px/1 ${FONT};padding:14px 0;border-radius:999px;cursor:pointer;appearance:none">${tx('Speichern')}</button>
</div>
</div></div>`;
}

// v4 P0-3-5 / COMPONENT_RULES 3: Der Wechsel der Markierungsart nimmt der Person sichtbar
// ihren bisherigen Status — und beim Wechsel weg von der Besonderen Person auch ihr
// eingegebenes Label. Vorher geschah das in beide Richtungen ohne jede Rückfrage. Diese
// kompakte Entscheidung ist der verlangte eindeutige Bestätigungsschritt.
// Runde 4 (B4): Das Sheet „Zeichen für beste Freunde" hängt an markSwitchSheet, weil beide
// Bildschirme mit Markierungen (Freundesliste und Personenprofil im Raum) genau diese Funktion
// zeichnen — so gibt es das neue Sheet an beiden Stellen ohne zweiten Einbau.
export function markSwitchSheet(ctx) {
  const { repo, ui } = ctx;
  const bfSheet = besteFreundeMarkeSheet(ctx);
  const pending = ui.markSwitch;
  if (!pending) return bfSheet;
  const person = repo.getPerson(pending.personId);
  if (!person) return bfSheet;
  const toBest = pending.to === 'best';
  const settings = repo.getSettings();
  const label = (settings.specialPerson?.label || '').trim();
  const title = toBest ? tx('Zu bestem Freund wechseln?') : tx('Zu besonderer Person wechseln?');
  const text = toBest
    ? (label
      ? tx('{name} trägt gerade ein eigenes Zeichen („{label}"). Der goldene Ring ersetzt es — beides zusammen geht nicht.', { name: person.name, label })
      : tx('{name} trägt gerade ein eigenes Zeichen. Der goldene Ring ersetzt es — beides zusammen geht nicht.', { name: person.name }))
    : tx('{name} trägt gerade den goldenen Ring. Ein eigenes Zeichen ersetzt ihn — beides zusammen geht nicht.', { name: person.name });
  return `${bfSheet}<div style="position:absolute;inset:0;z-index:22;display:flex;align-items:flex-end">
<div data-act="mark-switch-cancel" style="position:absolute;inset:0;background:var(--scrim);-webkit-backdrop-filter:var(--scrim-filter);backdrop-filter:var(--scrim-filter)"></div>
<div style="position:relative;width:100%;padding:16px 20px 26px;border-radius:26px 26px 0 0;background:var(--surface);box-shadow:0 -10px 30px var(--shadow-15);font-family:${FONT};display:flex;flex-direction:column;gap:11px">
<div style="width:38px;height:4px;margin:0 auto 2px;border-radius:999px;background:var(--handle)"></div>
<span style="font-family:${BRICOLAGE};font-size:19px;font-weight:650">${esc(title)}</span>
<span style="font-size:13px;color:var(--ink-soft);line-height:1.45;text-wrap:pretty">${esc(text)}</span>
<div style="display:flex;gap:8px;padding-top:2px">
<button data-act="mark-switch-cancel" style="flex:1;border:1.5px solid var(--ink-a14);background:var(--surface);color:var(--ink-soft);font:650 14px/1 ${FONT};padding:13px 0;border-radius:999px;cursor:pointer;appearance:none">${tx('Abbrechen')}</button>
<button data-act="mark-switch-ok" style="flex:1;background:var(--green);border:0;color:var(--on-accent);font:650 14px/1 ${FONT};padding:14px 0;border-radius:999px;cursor:pointer;appearance:none">${tx('Wechseln')}</button>
</div>
</div></div>`;
}

// --- Runde 4 (B4): EIN Zeichen für alle besten Freunde -----------------------------------
// Jonathan: „… dann gelten sie für alle besten Freunde und nicht nur für eine … damit es
// allgemein beste Freunde gibt und nur eine besondere Person." Gespeichert wird
// settings.besteFreundeMarke = { symbol, color } (web/ui/beste-freunde-marke.js); die Plakette am
// Avatar zeichnet components.js (avatarMark). Hier: Gold vorneweg, dann die Markierungsfarben.
const BF_FARBEN = [[BESTE_FREUNDE_GOLD, tx('Gold')], ...MARK_PALETTE];

// Dieselbe Plakette wie avatarMark (volle Farbe, Zeichen weiß, Ring in der Farbe des Grunds) —
// hier für die Vorschau im Sheet und die kleine Anzeige in der Freundesliste.
function bfPlakette(marke, avatarGroesse, ring = 'var(--surface)', frei = false) {
  const plate = Math.max(16, Math.round(avatarGroesse * 0.44));
  const off = -Math.round(plate * 0.12);
  const px = Math.round(plate * 0.64 * 10) / 10;
  const svg = SPECIAL_SYMBOLS[specialSymbolKey(marke.symbol)]('var(--on-accent)').replace(/width="[\d.]+" height="[\d.]+"/, `width="${px}" height="${px}"`);
  const lage = frei ? 'position:relative' : `position:absolute;left:${off}px;bottom:${off}px;z-index:3`;
  return `<span data-role="bf-vorschau-zeichen" style="${lage};width:${plate}px;height:${plate}px;border-radius:50%;background:${marke.color};box-shadow:0 0 0 2px ${ring};box-sizing:border-box;display:flex;align-items:center;justify-content:center;flex:none;pointer-events:none">${svg}</span>`;
}

export function besteFreundeMarkeSheet(ctx) {
  const { repo, ui } = ctx;
  if (!ui.bfMarke) return '';
  const settings = repo.getSettings();
  const marke = besteFreundeMarke({ besteFreundeMarke: ui.bfMarke });
  const besten = [...new Set(settings.bestFriendIds || [])].map((id) => repo.getPerson(id)).filter(Boolean).slice(0, 3);
  const vorschau = besten.length
    ? besten.map((person) => `<div style="display:flex;flex-direction:column;align-items:center;gap:6px;min-width:0;width:72px">
<span style="position:relative;display:block;pointer-events:none">${personAvatar(person, { size: 48, fontSize: 17, free: false, active: false })}${bfPlakette(marke, 48)}</span>
<span style="font-size:12px;font-weight:600;color:var(--ink-soft);max-width:100%;overflow:hidden;text-overflow:ellipsis;white-space:nowrap">${esc((person.name || '').split(' ')[0])}</span></div>`).join('')
    : `<div style="display:flex;align-items:center;gap:12px"><span style="position:relative;display:block;width:48px;height:48px;border-radius:50%;background:var(--field)">${bfPlakette(marke, 48)}</span><span style="font-size:12.5px;color:var(--muted);line-height:1.4">${tx('Noch keine besten Freunde — das Zeichen gilt, sobald du jemanden markierst.')}</span></div>`;
  const special = settings.specialPerson;
  const gleichWieBesondere = Boolean(special && !special.emoji && specialSymbolKey(special.symbol) === marke.symbol && paletteColor(special.color) === marke.color);
  const symbolKacheln = MARKE_SYMBOLE.filter((key) => SPECIAL_SYMBOLS[key]).map((key) => {
    const an = key === marke.symbol;
    return `<button data-act="bf-marke-symbol" data-symbol="${key}" aria-label="${esc(tx('Symbol'))}" aria-pressed="${an}" style="width:48px;height:48px;border-radius:14px;background:${an ? hexToRgba(marke.color, 0.12) : 'var(--paper)'};border:${an ? `1.5px solid ${hexToRgba(marke.color, 0.7)}` : '0'};box-sizing:border-box;display:flex;align-items:center;justify-content:center;flex:none;cursor:pointer;appearance:none;padding:0"><span style="pointer-events:none;display:flex">${markSymbolGlyph(key, an ? marke.color : 'var(--muted-light)')}</span></button>`;
  }).join('');
  const farben = BF_FARBEN.map(([wert, name]) => {
    const an = wert === marke.color;
    return `<button data-act="bf-marke-farbe" data-color="${wert}" aria-label="${esc(name)}" aria-pressed="${an}" style="height:44px;border:0;background:transparent;padding:0;display:flex;align-items:center;justify-content:center;cursor:pointer;appearance:none;min-width:0"><span style="width:30px;height:30px;border-radius:50%;background:${wert};pointer-events:none;${an ? `box-shadow:0 0 0 2px var(--surface),0 0 0 4px ${wert}` : ''}"></span></button>`;
  }).join('');
  const standard = istStandardMarke(marke)
    ? ''
    : `<button data-act="bf-marke-standard" style="flex:1;border:1.5px solid var(--ink-a14);background:var(--surface);color:var(--ink-soft);font:650 14px/1 ${FONT};padding:13px 0;min-height:46px;border-radius:999px;cursor:pointer;appearance:none">${tx('Standard')}</button>`;
  return `<div data-role="bf-marke-sheet" style="position:absolute;inset:0;z-index:21;display:flex;align-items:flex-end">
<div data-act="bf-marke-close" class="ui-sheet-scrim" style="position:absolute;inset:0;background:var(--scrim);-webkit-backdrop-filter:var(--scrim-filter);backdrop-filter:var(--scrim-filter)"></div>
<div class="ui-sheet-card" data-scroll-keep="sheet-bf-marke" style="position:relative;width:100%;background:var(--surface);border-radius:28px 28px 0 0;padding:12px 20px 28px;display:flex;flex-direction:column;gap:14px;box-shadow:0 -8px 24px var(--shadow-18);max-height:92%;overflow-y:auto;box-sizing:border-box;font-family:${FONT}">
<span style="width:36px;height:4px;border-radius:2px;background:var(--handle);align-self:center;flex:none"></span>
<div style="display:flex;flex-direction:column;gap:3px"><span style="font-family:${BRICOLAGE};font-size:22px;font-weight:650;letter-spacing:-.01em">${tx('Zeichen für beste Freunde')}</span>
<span style="font-size:12px;color:var(--muted)">${tx('Gilt für alle besten Freunde · nur für dich sichtbar')}</span></div>
<div data-role="bf-vorschau" style="display:flex;gap:10px;align-items:flex-start;padding:4px 2px">${vorschau}</div>
<div style="display:flex;flex-direction:column;gap:8px">
<span style="font-size:11px;font-weight:650;letter-spacing:.09em;text-transform:uppercase;color:var(--muted-light)">${tx('Symbol')}</span>
<div style="display:flex;gap:8px">${symbolKacheln}</div></div>
<div style="display:flex;flex-direction:column;gap:4px">
<span style="font-size:11px;font-weight:650;letter-spacing:.09em;text-transform:uppercase;color:var(--muted-light)">${tx('Farbe')}</span>
<div style="display:grid;grid-template-columns:repeat(8,minmax(0,1fr));gap:0 4px">${farben}</div></div>
${gleichWieBesondere ? `<span data-role="bf-gleich" style="font-size:12px;color:var(--orange-dark);line-height:1.4">${tx('Sieht gleich aus wie das Zeichen deiner besonderen Person.')}</span>` : ''}
<div style="display:flex;gap:8px;padding-top:2px">
${standard}
<button data-act="bf-marke-save" style="flex:1;background:var(--green);border:0;color:var(--on-accent);font:650 14px/1 ${FONT};padding:14px 0;min-height:46px;border-radius:999px;cursor:pointer;appearance:none">${tx('Speichern')}</button>
</div>
</div></div>`;
}

// v6 A05b: Das Beenden einer Freundschaft ist die einzige wirklich destruktive Aktion des
// Menüs — deshalb führt sie nie sofort aus, sondern über diese eindeutige Entscheidung.
// Der Text sagt ausdrücklich, was NICHT gelöscht wird: gemeinsame Meets der Vergangenheit
// und die eigenen privaten Bewertungen bleiben.
export function removeFriendSheet(ctx) {
  const { repo, ui } = ctx;
  if (!ui.removeFriendFor) return '';
  const person = repo.getPerson(ui.removeFriendFor);
  if (!person) return '';
  return `<div style="position:absolute;inset:0;z-index:22;display:flex;align-items:flex-end">
<div data-act="remove-friend-cancel" style="position:absolute;inset:0;background:var(--scrim);-webkit-backdrop-filter:var(--scrim-filter);backdrop-filter:var(--scrim-filter)"></div>
<div style="position:relative;width:100%;padding:16px 20px 26px;border-radius:26px 26px 0 0;background:var(--surface);box-shadow:0 -10px 30px var(--shadow-15);font-family:${FONT};display:flex;flex-direction:column;gap:11px">
<div style="width:38px;height:4px;margin:0 auto 2px;border-radius:999px;background:var(--handle)"></div>
<span style="font-family:${BRICOLAGE};font-size:19px;font-weight:650">${esc(tx('Freundschaft mit {name} beenden?', { name: person.name }))}</span>
<span style="font-size:13px;color:var(--ink-soft);line-height:1.45;text-wrap:pretty">${tx('Ihr seht danach nichts mehr voneinander — kein Frei, keine Meets, keine Crews. Eure gemeinsamen vergangenen Meets und deine eigenen Bewertungen bleiben erhalten.')}</span>
<div style="display:flex;gap:8px;padding-top:2px">
<button data-act="remove-friend-cancel" style="flex:1;border:1.5px solid var(--ink-a14);background:var(--surface);color:var(--ink-soft);font:650 14px/1 ${FONT};padding:13px 0;border-radius:999px;cursor:pointer;appearance:none">${tx('Abbrechen')}</button>
<button data-act="remove-friend-ok" style="flex:1;background:var(--danger);border:0;color:var(--on-accent);font:650 14px/1 ${FONT};padding:14px 0;border-radius:999px;cursor:pointer;appearance:none">${tx('Entfernen')}</button>
</div>
<button data-act="block-open" data-person="${esc(person.id)}" style="border:0;background:transparent;padding:6px 0 0;cursor:pointer;appearance:none;font-family:${FONT};align-self:center"><span style="pointer-events:none;font-size:13px;font-weight:650;color:var(--danger);text-decoration:underline">${tx('Stattdessen blockieren und melden')}</span></button>
</div></div>`;
}

// --- T6: Blockieren und Melden -----------------------------------------------------------
// Apple und Google verlangen beides, bevor eine App mit fremden Inhalten in den Store darf.
// Wichtiger ist der Grund dahinter: Wer belästigt wird, braucht einen Weg, der sofort wirkt —
// ohne Rückfrage an die andere Seite und ohne dass sie es erfährt.
export const MELDEGRUENDE = [
  { id: 'belaestigung', label: tx('Belästigung') },
  { id: 'spam', label: tx('Spam') },
  { id: 'inhalte', label: tx('Unangemessene Inhalte') },
  { id: 'anderes', label: tx('Etwas anderes') },
];

function grundChips(gewaehlt) {
  return `<div style="display:flex;flex-wrap:wrap;gap:7px;padding-top:2px">${MELDEGRUENDE.map((grund) => {
    const an = gewaehlt === grund.id;
    return `<button data-act="report-grund" data-grund="${grund.id}" style="border:1.5px solid ${an ? 'var(--danger)' : 'var(--ink-a14)'};background:${an ? 'var(--red-tint)' : 'var(--surface)'};color:${an ? 'var(--danger)' : 'var(--ink-soft)'};font:650 12.5px/1 ${FONT};padding:9px 13px;border-radius:999px;cursor:pointer;appearance:none"><span style="pointer-events:none">${esc(grund.label)}</span></button>`;
  }).join('')}</div>`;
}

function sheetRahmen(inhalt) {
  return `<div style="position:absolute;inset:0;z-index:23;display:flex;align-items:flex-end">
<div data-act="block-cancel" style="position:absolute;inset:0;background:var(--scrim);-webkit-backdrop-filter:var(--scrim-filter);backdrop-filter:var(--scrim-filter)"></div>
<div style="position:relative;width:100%;padding:16px 20px 26px;border-radius:26px 26px 0 0;background:var(--surface);box-shadow:0 -10px 30px var(--shadow-15);font-family:${FONT};display:flex;flex-direction:column;gap:11px">
<div style="width:38px;height:4px;margin:0 auto 2px;border-radius:999px;background:var(--handle)"></div>
${inhalt}
</div></div>`;
}

export function blockSheet(ctx) {
  const { repo, ui } = ctx;
  if (!ui.blockFor) return '';
  const person = repo.getPerson(ui.blockFor);
  if (!person) return '';
  const vorname = (person.name || '').split(' ')[0];
  return sheetRahmen(`<span style="font-family:${BRICOLAGE};font-size:19px;font-weight:650">${esc(tx('{name} blockieren?', { name: vorname }))}</span>
<span style="font-size:13px;color:var(--ink-soft);line-height:1.45;text-wrap:pretty">${tx('Ihr seht danach nichts mehr voneinander. {name} verschwindet aus deinen Listen, aus euren Gruppen und aus allen Räumen — auch bereits geschriebene Nachrichten. {name} erfährt davon nichts.', { name: esc(vorname) })}</span>
<span style="font-size:12px;font-weight:650;color:var(--muted);padding-top:2px">${tx('Grund melden (freiwillig)')}</span>
${grundChips(ui.blockGrund)}
<div style="display:flex;gap:8px;padding-top:6px">
<button data-act="block-cancel" style="flex:1;border:1.5px solid var(--ink-a14);background:var(--surface);color:var(--ink-soft);font:650 14px/1 ${FONT};padding:13px 0;border-radius:999px;cursor:pointer;appearance:none">${tx('Abbrechen')}</button>
<button data-act="block-ok" style="flex:1;background:var(--danger);border:0;color:var(--on-accent);font:650 14px/1 ${FONT};padding:14px 0;border-radius:999px;cursor:pointer;appearance:none">${tx('Blockieren')}</button>
</div>`);
}

// Eine einzelne Nachricht melden — erreichbar über langes Drücken auf die Blase.
export function reportSheet(ctx) {
  const { repo, ui } = ctx;
  if (!ui.reportFor) return '';
  const person = repo.getPerson(ui.reportFor.personId);
  const vorname = (person?.name || '').split(' ')[0] || tx('Diese Person');
  return sheetRahmen(`<span style="font-family:${BRICOLAGE};font-size:19px;font-weight:650">${tx('Nachricht melden')}</span>
<span style="font-size:13px;color:var(--ink-soft);line-height:1.45;text-wrap:pretty">${tx('Die Nachricht wird zur Prüfung übermittelt. {name} erfährt nicht, dass du gemeldet hast.', { name: esc(vorname) })}</span>
${ui.reportFor.text ? `<span style="font-size:12.5px;color:var(--muted);line-height:1.45;background:var(--field);border-radius:12px;padding:9px 12px;overflow-wrap:break-word">${esc(ui.reportFor.text.slice(0, 160))}</span>` : ''}
<span style="font-size:12px;font-weight:650;color:var(--muted);padding-top:2px">${tx('Warum meldest du?')}</span>
${grundChips(ui.blockGrund)}
<div style="display:flex;gap:8px;padding-top:6px">
<button data-act="block-cancel" style="flex:1;border:1.5px solid var(--ink-a14);background:var(--surface);color:var(--ink-soft);font:650 14px/1 ${FONT};padding:13px 0;border-radius:999px;cursor:pointer;appearance:none">${tx('Abbrechen')}</button>
<button data-act="report-ok" style="flex:1;background:var(--danger);border:0;color:var(--on-accent);font:650 14px/1 ${FONT};padding:14px 0;border-radius:999px;cursor:pointer;appearance:none">${tx('Melden')}</button>
</div>
<button data-act="report-und-block" style="border:0;background:transparent;padding:2px 0 0;cursor:pointer;appearance:none;font-family:${FONT};align-self:center"><span style="pointer-events:none;font-size:13px;font-weight:650;color:var(--danger);text-decoration:underline">${tx('Melden und {name} blockieren', { name: esc(vorname) })}</span></button>`);
}

// Die Aktionen gelten in der Freundesliste UND im Raum — deshalb eine Fabrik für beide.
export function blockActs(ctx) {
  const { repo, ui } = ctx;
  return {
    'block-open': (data) => {
      ui.removeFriendFor = null;
      ui.menuFor = null;
      ui.blockFor = data.person;
      ui.blockGrund = null;
      ctx.render();
    },
    'block-cancel': () => { ui.blockFor = null; ui.reportFor = null; ui.blockGrund = null; ctx.render(); },
    'report-grund': (data) => { ui.blockGrund = ui.blockGrund === data.grund ? null : data.grund; ctx.render(); },
    'block-ok': () => {
      const personId = ui.blockFor;
      const person = repo.getPerson(personId);
      const vorname = (person?.name || '').split(' ')[0];
      const ergebnis = repo.blockPerson(personId, { grund: ui.blockGrund || undefined });
      ui.blockFor = null;
      ui.blockGrund = null;
      ctx.render();
      ctx.toast(ergebnis?.ok ? (vorname ? tx('{name} blockiert', { name: vorname }) : tx('Person blockiert')) : (ergebnis?.reason || tx('Das hat nicht geklappt')));
    },
    'report-ok': () => {
      const eintrag = ui.reportFor;
      if (!eintrag) return;
      repo.reportContent({ personId: eintrag.personId, messageId: eintrag.messageId, grund: ui.blockGrund || 'anderes' });
      ui.reportFor = null;
      ui.blockGrund = null;
      ctx.render();
      ctx.toast(tx('Danke — die Meldung ist raus'));
    },
    'report-und-block': () => {
      const eintrag = ui.reportFor;
      if (!eintrag) return;
      const person = repo.getPerson(eintrag.personId);
      const vorname = (person?.name || '').split(' ')[0];
      repo.reportContent({ personId: eintrag.personId, messageId: eintrag.messageId, grund: ui.blockGrund || 'anderes' });
      repo.blockPerson(eintrag.personId, {});
      ui.reportFor = null;
      ui.blockGrund = null;
      ctx.render();
      ctx.toast(vorname ? tx('Gemeldet · {name} blockiert', { name: vorname }) : tx('Gemeldet · Person blockiert'));
    },
  };
}

function friendsSheets(ctx) {
  const { ui } = ctx;
  const base = ui.sheet === 'mark' && ui.markFor ? markSheet(ctx) : ui.menuFor ? friendMenu(ctx, ui.menuFor) : '';
  // Die Wechsel-Entscheidung liegt über allem (z-index 22) — sie kann sowohl aus dem
  // Menü als auch bei geschlossenem Menü ausgelöst worden sein.
  return `${base}${markSwitchSheet(ctx)}${removeFriendSheet(ctx)}${blockSheet(ctx)}${reportSheet(ctx)}`;
}

// v6 A05a: Der Frei-Hinweis ist ZURÜCK im Drei-Punkte-Menü — er ist kein zweiter,
// konkurrierender Schalter, weil er auf denselben Zustand schreibt wie die Liste unter
// profile.notifications (settings.freiHints). Er steuert ausschließlich den EMPFANG der
// aktuellen Nutzerin; die eigene Frei-Meldung (repo.setFree) bleibt unberührt.
function freiHintActive(settings, personId) {
  // Runde 4 (B6): ohne Einstellung gilt der Standard „alle".
  const hints = settings.freiHints || { mode: 'alle', customIds: [] };
  if (hints.mode === 'alle') return true;
  if (hints.mode === 'beste') return [...new Set(settings.bestFriendIds || [])].includes(personId);
  // v7 A33: „Markierte Freunde" ist eine eigene Stufe — beste Freund:innen plus die
  // besondere Person, ohne dass daraus eine individuelle Liste geschrieben wird.
  if (hints.mode === 'markierte') return markedFriendIds(settings).includes(personId);
  if (hints.mode === 'individuell') return (hints.customIds || []).includes(personId);
  return false;
}

// Beim Umschalten wird die aktuell WIRKSAME Menge zuerst ausgeschrieben. Sonst würde ein
// Tippen bei Modus „alle"/„beste" still auch alle anderen Personen mitverändern.
function toggleFreiHint(repo, personId) {
  const settings = repo.getSettings();
  const hints = settings.freiHints || { mode: 'alle', customIds: [] };
  const wirksam = hints.mode === 'alle'
    ? repo.getPeople().map((person) => person.id)
    : hints.mode === 'beste'
      ? [...new Set(settings.bestFriendIds || [])]
      : hints.mode === 'markierte'
        ? markedFriendIds(settings)
        : hints.mode === 'individuell'
          ? [...(hints.customIds || [])]
          : [];
  const an = !freiHintActive(settings, personId);
  const customIds = an ? [...new Set([...wirksam, personId])] : wirksam.filter((id) => id !== personId);
  repo.updateSettings({ freiHints: { ...hints, mode: 'individuell', customIds } });
  return an;
}

const svgFreiHint = (on) => `<svg width="15" height="15" viewBox="0 0 24 24" fill="none" style="flex:none;pointer-events:none"><circle cx="12" cy="12" r="8.2" stroke="${on ? 'var(--green)' : 'var(--muted-light)'}" stroke-width="1.8"></circle>${on ? '<circle cx="12" cy="12" r="3.6" fill="var(--green)"></circle>' : ''}</svg>`;
// Derselbe Schalter wie im Personenprofil (room.js): ein Ein/Aus-Zustand ist ein Schalter.
// Die frühere An/Aus-Pille beschrieb den Zustand nur und ließ die beiden Menüs unterschiedlich aussehen.
const freiHintChip = (on) => `<span style="pointer-events:none;width:34px;height:20px;border-radius:999px;background:${on ? 'var(--green)' : 'var(--handle)'};display:flex;align-items:center;padding:2px;box-sizing:border-box;flex:none"><span style="width:16px;height:16px;border-radius:50%;background:var(--surface);transform:translateX(${on ? 14 : 0}px);transition:transform .16s ease-out"></span></span>`;

const svgStarOutline = `<svg width="15" height="15" viewBox="0 0 24 24" fill="none" style="flex:none;pointer-events:none"><path d="m12 3.9 2.5 5.1 5.6.8-4.1 4 1 5.6L12 16.7l-5 2.7 1-5.6-4.1-4 5.6-.8L12 3.9Z" stroke="var(--muted-light)" stroke-width="1.7" stroke-linejoin="round"></path></svg>`;
const svgCrossSmall = `<svg width="14" height="14" viewBox="0 0 24 24" fill="none" style="flex:none;pointer-events:none"><path d="M7 7l10 10M17 7 7 17" stroke="var(--muted)" stroke-width="2.2" stroke-linecap="round"></path></svg>`;

// v7 A06 (spec/01 §4): Das Personenmenü ist KLEIN und hat genau drei Zeilen — Markieren,
// Frei-Hinweis, Entfernen. Vorher standen beide Markierungswege als eigene Zeilen im
// Primärmenü, weshalb es je nach Zustand 4 oder 5 Zeilen hoch und 290 px breit war
// (74 % der Bildschirmbreite). „Markieren" öffnet jetzt ein zweites, gleich gebautes
// kleines Menü daneben; der Wechsel dort ist exklusiv.
const MENU_WIDTH = 182;
const MENU_RIGHT = 14;

function menuRow({ act, icon, label, valueHtml = '', last = false, tone = 'var(--ink)', wrap = false }) {
  const textStyle = wrap
    ? 'white-space:normal;line-height:1.25;text-wrap:pretty'
    : 'white-space:nowrap;overflow:hidden;text-overflow:ellipsis';
  return `<button data-act="${act}" role="menuitem" style="display:flex;align-items:center;gap:9px;padding:11px 12px;border:0;${last ? '' : 'border-bottom:1px solid var(--ink-a06);'}background:transparent;width:100%;box-sizing:border-box;text-align:left;cursor:pointer;appearance:none;font-family:${FONT}">
<span style="pointer-events:none;display:flex;width:15px;justify-content:center;flex:none">${icon}</span>
<span style="pointer-events:none;font-size:13px;font-weight:650;color:${tone};flex:1;min-width:0;${textStyle}">${esc(label)}</span>
${valueHtml}</button>`;
}

// Beide Menüs sind dieselbe Karte. Das Zweitmenü bekommt statt einer festen Breite eine
// linke und eine rechte Kante — so passt es auch bei 360 px Rahmenbreite neben das erste,
// statt aus dem Bild zu laufen.
function menuCard(rows, style) {
  return `<div role="menu" style="position:absolute;${style};background:var(--surface);border-radius:14px;box-shadow:0 8px 24px var(--shadow-16);border:1px solid var(--ink-a07);overflow:hidden;box-sizing:border-box;z-index:13">${rows}</div>`;
}

// Neutrales Markieren-Zeichen (Anhänger) und das Zeichen der besonderen Person (Herz).
// Beide unterscheiden sich klar vom Goldstern des besten Freundes — im Menü stehen sonst
// zwei gleich aussehende Sterne untereinander.
const svgMarkTag = `<svg width="15" height="15" viewBox="0 0 24 24" fill="none" style="flex:none;pointer-events:none"><path d="M6 3.5h8.5L20 9v11.5H6V3.5Z" stroke="var(--muted-light)" stroke-width="1.7" stroke-linejoin="round"></path><path d="M9.5 12.5h6M9.5 16h4" stroke="var(--muted-light)" stroke-width="1.7" stroke-linecap="round"></path></svg>`;
const svgHeartOutline = `<svg width="15" height="15" viewBox="0 0 24 24" fill="none" style="flex:none;pointer-events:none"><path d="M12 19.5S4.5 14.8 4.5 9.9A3.9 3.9 0 0 1 12 8a3.9 3.9 0 0 1 7.5 1.9c0 4.9-7.5 9.6-7.5 9.6Z" stroke="var(--muted-light)" stroke-width="1.7" stroke-linejoin="round"></path></svg>`;

// v7 A06: Auch das Personenprofil im Raum verwendet genau dieses Menue. Deshalb ist es
// exportiert und wird nicht ein zweites Mal nachgebaut.
export function friendMenu(ctx, personId) {
  const { repo, ui } = ctx;
  const settings = repo.getSettings();
  const person = repo.getPerson(personId);
  if (!person) return '';
  const bestIds = [...new Set(settings.bestFriendIds || [])];
  const isBest = bestIds.includes(personId);
  const special = settings.specialPerson?.personId === personId ? settings.specialPerson : null;
  const markiert = isBest || Boolean(special);
  const anchorTop = Math.max(96, Math.min(560, Math.round(ui.menuTop || 140)));
  const counter = `<span style="pointer-events:none;font-size:10.5px;font-weight:650;color:var(--muted-light);font-variant-numeric:tabular-nums">${bestIds.length}/3</span>`;
  const freiAn = freiHintActive(settings, personId);
  const vorname = (person.name || '').split(' ')[0];
  // Das Primärmenü zeigt am Eintrag „Markieren" den aktuellen Zustand als Zeichen —
  // das Zeichen der besten Freunde (Runde 4, B4: einstellbar) oder das der besonderen Person.
  const bf = besteFreundeMarke(settings);
  const markIcon = special
    ? markSymbolGlyph(special.symbol, special.color, 1)
    : (isBest ? markSymbolGlyph(bf.symbol, bf.color, 1) : svgMarkTag);

  const rows = menuRow({ act: 'menu-mark-open', icon: markIcon, label: tx('Markieren'), valueHtml: `<span style="pointer-events:none;display:flex">${svgRowChevron}</span>` })
    + menuRow({ act: 'menu-frei', icon: svgFreiHint(freiAn), label: tx('Frei-Hinweis'), valueHtml: freiHintChip(freiAn) })
    + menuRow({ act: 'menu-remove-friend', icon: svgTrashRed, label: tx('Entfernen'), tone: 'var(--danger)', last: true });

  // Das Zweitmenü sitzt DIREKT NEBEN dem ersten (links davon, weil das erste am rechten
  // Rand verankert ist) und hat dieselbe Bauart und Zeilenhöhe. „Markierung entfernen"
  // erscheint nur, wenn die Person überhaupt markiert ist.
  // Runde 4 (B4): Bei einer Person, die schon beste Freund:in ist, steht direkt darunter das
  // gemeinsame Zeichen aller besten Freunde — dort, wo man es braucht. Bei allen anderen bliebe es
  // nur Rauschen; der ständige Einstieg ist der Knopf „Zeichen" neben „Beste Freunde" in der Liste.
  const subRows = menuRow({ act: 'menu-best', icon: svgStarOutline, label: tx('Als beste Freund:in markieren'), valueHtml: counter, wrap: true })
    + (isBest ? menuRow({ act: 'menu-bf-marke', icon: markSymbolGlyph(bf.symbol, bf.color, 1), label: tx('Zeichen für beste Freunde'), wrap: true }) : '')
    + menuRow({ act: 'menu-mark', icon: svgHeartOutline, label: tx('Als besondere Person markieren'), last: !markiert, wrap: true })
    + (markiert ? menuRow({ act: 'menu-mark-clear', icon: svgCrossSmall, label: tx('Markierung entfernen'), tone: 'var(--ink-soft)', last: true, wrap: true }) : '');
  const sub = ui.menuMark
    ? menuCard(subRows, `right:${MENU_RIGHT + MENU_WIDTH + 6}px;left:8px;top:${anchorTop + 6}px`)
    : '';

  return `<div data-act="menu-close" style="position:absolute;inset:0;z-index:12"></div>
${menuCard(rows, `right:${MENU_RIGHT}px;top:${anchorTop}px;width:${MENU_WIDTH}px`)}${sub}`;
}

// v7 A06: Dieselben Menue-Aktionen fuer Freundesliste UND Personenprofil. Die Fabrik
// bekommt ctx und die Umgebung des jeweiligen Screens; alles Uebrige ist identisch.
export function friendMenuActs(ctx, umgebung = {}) {
  const { repo, ui, nav } = ctx;
  const applyBest = umgebung.applyBest || ((personId, on) => {
    const result = repo.setBestFriend(personId, on);
    if (result && !result.ok) { ctx.toast(result.reason); return false; }
    return true;
  });
  // v7: oeffnet das Special-Sheet der Person. Reine ctx-Operation, deshalb hier.
  // openMark braucht beides — sie gehoeren deshalb in dieselbe Fabrik.
  const markValue = () => ({
    label: (ui.markLabel || '').trim(),
    symbol: specialSymbolKey(ui.markSymbol),
    color: paletteColor(ui.markColor || MARK_COLOR_DEFAULT),
  });
  const guard = dirtyGuard(ctx, 'mark');
  const openMark = (personId) => {
    const settings = repo.getSettings();
    ui.sheet = 'mark';
    ui.markFor = personId;
    ui.menuFor = null;
    ui.markColorOpen = false;
    const existing = settings.specialPerson?.personId === personId ? settings.specialPerson : null;
    ui.markLabel = existing?.label || '';
    ui.markSymbol = specialSymbolKey(existing?.symbol);
    ui.markEmoji = existing?.emoji || '';
    ui.markColor = paletteColor(existing?.color || MARK_COLOR_DEFAULT);
    ui.menuMark = false;
    guard.reset(markValue());
    ctx.render();
  };
  // Runde 4 (B4): das gemeinsame Zeichen der besten Freunde — aus dem Menü und aus der Freundesliste.
  const bfGuard = dirtyGuard(ctx, 'bf-marke');
  const bfOeffnen = () => {
    const marke = besteFreundeMarke(repo.getSettings());
    ui.bfMarke = { ...marke };
    ui.menuFor = null;
    ui.menuMark = false;
    bfGuard.reset({ ...marke });
    haptik('tipp');
    ctx.render();
  };
  const bfSchliessen = () => { ui.bfMarke = null; ctx.render(); };
  return {
    'menu-bf-marke': bfOeffnen,
    'bf-marke-open': bfOeffnen,
    'bf-marke-symbol': (data) => {
      if (!ui.bfMarke) return;
      ui.bfMarke = { ...ui.bfMarke, symbol: data.symbol };
      haptik('tipp');
      ctx.render();
    },
    'bf-marke-farbe': (data) => {
      if (!ui.bfMarke) return;
      ui.bfMarke = { ...ui.bfMarke, color: data.color };
      haptik('tipp');
      ctx.render();
    },
    'bf-marke-standard': () => {
      if (!ui.bfMarke) return;
      ui.bfMarke = { ...BESTE_FREUNDE_MARKE_STANDARD };
      ctx.render();
    },
    'bf-marke-close': () => {
      if (!ui.bfMarke) return;
      if (bfGuard.confirm(besteFreundeMarke({ besteFreundeMarke: ui.bfMarke }), bfSchliessen)) bfSchliessen();
    },
    'bf-marke-save': () => {
      if (!ui.bfMarke) return;
      const marke = besteFreundeMarke({ besteFreundeMarke: ui.bfMarke });
      bfGuard.clear();
      ui.bfMarke = null;
      repo.updateSettings({ besteFreundeMarke: marke });
      haptik('erfolg');
      ctx.render();
      ctx.toast(tx('Zeichen für beste Freunde gespeichert'));
    },
    'menu-open': (data, el) => {
      const phone = el ? el.closest('.runtime-phone') : document.querySelector('.runtime-phone');
      const top = el && phone
        ? el.getBoundingClientRect().bottom - phone.getBoundingClientRect().top + 6
        : 140;
      ui.menuFor = ui.menuFor === data.person ? null : data.person;
      ui.menuTop = top;
      // v7 A06: Jedes neu geoeffnete Menue startet ohne Zweitmenue.
      ui.menuMark = false;
      ctx.render();
    },
    'menu-close': () => { ui.menuFor = null; ui.menuMark = false; ctx.render(); },
    // v7 A06: „Markieren" oeffnet das zweite kleine Menue daneben — es ersetzt die beiden
    // fruehereren Markierungszeilen im Primaermenue.
    'menu-mark-open': () => { ui.menuMark = !ui.menuMark; ctx.render(); },
    // Nimmt die vorhandene Markierung zurueck, gleich welcher Art (exklusiv, spec/01 §4).
    'menu-mark-clear': () => {
      const personId = ui.menuFor;
      const settings = repo.getSettings();
      ui.menuFor = null;
      ui.menuMark = false;
      if (settings.specialPerson?.personId === personId) repo.setSpecialPerson(personId, null);
      else applyBest(personId, false);
      ctx.render();
      ctx.toast(tx('Markierung entfernt'));
    },
    // v4 P0-3-2: markiert bzw. hebt NUR Besten Freund auf — direkt, ohne Sheet.
    // v4 P0-3-5: Trägt die Person das Zeichen der Besonderen Person, geht der Wechsel
    // erst nach eindeutiger Bestätigung.
    'menu-best': () => {
      const personId = ui.menuFor;
      const settings = repo.getSettings();
      const isBest = [...new Set(settings.bestFriendIds || [])].includes(personId);
      const isSpecial = settings.specialPerson?.personId === personId;
      if (isSpecial) {
        ui.menuFor = null;
        ui.menuMark = false;
        ui.markSwitch = { personId, to: 'best' };
        ctx.render();
        return;
      }
      if (!applyBest(personId, !isBest)) return;
      ui.menuFor = null;
      ui.menuMark = false;
      ctx.render();
      ctx.toast(isBest ? tx('Bester Freund entfernt') : tx('Als beste Freund:in markiert'));
    },
    // v4 P0-3-2: öffnet AUSSCHLIESSLICH das Besondere-Person-Sheet.
    // v4 P0-3-5: Aus dem Besten Freund heraus zuerst die Bestätigung.
    'menu-mark': () => {
      const personId = ui.menuFor;
      const settings = repo.getSettings();
      const isBest = [...new Set(settings.bestFriendIds || [])].includes(personId);
      const isSpecial = settings.specialPerson?.personId === personId;
      ui.menuFor = null;
      ui.menuMark = false;
      if (isBest && !isSpecial) {
        ui.markSwitch = { personId, to: 'special' };
        ctx.render();
        return;
      }
      openMark(personId);
    },
    // v6 A05a: Nur der EMPFANG. Das Menü bleibt offen, damit der neue Zustand sofort
    // an derselben Zeile sichtbar wird.
    'menu-frei': () => {
      const personId = ui.menuFor;
      const person = repo.getPerson(personId);
      const an = toggleFreiHint(repo, personId);
      ctx.render();
      const vorname = (person?.name || '').split(' ')[0];
      ctx.toast(an ? tx('Frei-Hinweis von {name} an', { name: vorname }) : tx('Frei-Hinweis von {name} aus', { name: vorname }));
    },
    // v6 A05b: destruktiv, deshalb erst nach eindeutiger Bestätigung.
    'menu-remove-friend': () => {
      ui.removeFriendFor = ui.menuFor;
      ui.menuFor = null;
      ui.menuMark = false;
      ctx.render();
    },
    // v7: Die Folge-Bestaetigungen gehoeren zum selben Menue und damit in dieselbe Fabrik.
    'remove-friend-cancel': () => { ui.removeFriendFor = null; ctx.render(); },
    'remove-friend-ok': () => {
      const personId = ui.removeFriendFor;
      const person = repo.getPerson(personId);
      const vorname = (person?.name || '').split(' ')[0];
      ui.removeFriendFor = null;
      repo.removeFriend(personId);
      ctx.render();
      ctx.toast(vorname ? tx('{name} ist nicht mehr dein:e Freund:in', { name: vorname }) : tx('Freundschaft beendet'));
    },
    // Bestätigter Wechsel — der andere Status wird atomar ersetzt (demo-gateway räumt
    // ihn im selben Aufruf ab), und der Nutzer hat es vorher gesehen.
    'mark-switch-cancel': () => { ui.markSwitch = null; ctx.render(); },
    'mark-switch-ok': () => {
      const pending = ui.markSwitch;
      ui.markSwitch = null;
      if (!pending) { ctx.render(); return; }
      if (pending.to === 'best') {
        if (!applyBest(pending.personId, true)) { ctx.render(); return; }
        ctx.render();
        ctx.toast(tx('Bester Freund — besonderes Zeichen ersetzt'));
        return;
      }
      openMark(pending.personId);
    },
  };
}

function renderFriends(ctx) {
  const { repo } = ctx;
  const settings = repo.getSettings();
  const people = repo.getPeople();
  const requests = repo.getFriendRequests() || [];
  const groups = groupedFriends(people, settings);

  const row = (person, first) => {
    const marker = personMarker(person.id, settings);
    return `<div style="display:flex;align-items:center;gap:11px;padding:10px 0;${first ? '' : 'border-top:1px solid var(--ink-a05)'}">
<button data-act="open-friend" data-person="${person.id}" style="display:flex;align-items:center;gap:11px;flex:1;min-width:0;border:0;background:transparent;padding:0;text-align:left;cursor:pointer;appearance:none;font-family:${FONT};color:var(--ink)">
<span style="pointer-events:none;display:contents">${personAvatar(person, {
      size: 38,
      fontSize: 14,
      marker,
      // Zustand aus derselben Quelle wie überall (v3.1 §6): aktiver Meet vor Frei.
      active: Boolean(person.activeMeetId),
      free: person.free?.active && !person.activeMeetId,
    })}</span>
<span style="display:flex;align-items:center;gap:6px;min-width:0;pointer-events:none"><span style="font-size:14.5px;font-weight:600;white-space:nowrap;overflow:hidden;text-overflow:ellipsis">${esc(person.name)}</span>${specialLabelChip(marker)}</span>
</button>
<button data-act="menu-open" data-person="${person.id}" data-treffer aria-label="${esc(tx('Optionen'))}" style="width:34px;height:34px;border-radius:50%;background:var(--paper);border:0;display:flex;align-items:center;justify-content:center;flex:none;cursor:pointer;appearance:none;padding:0"><span style="pointer-events:none;color:var(--ink-soft);letter-spacing:1px;font-weight:650;font-size:13px;line-height:1">···</span></button>
</div>`;
  };
  const group = (label, list, rechts = '') => (list.length
    ? `${rechts
      ? `<div style="display:flex;align-items:center;gap:8px"><span style="font-size:10.5px;font-weight:650;letter-spacing:.09em;text-transform:uppercase;color:var(--muted-light);padding:11px 0 3px;flex:1;min-width:0">${esc(label)}</span>${rechts}</div>`
      : `<span style="font-size:10.5px;font-weight:650;letter-spacing:.09em;text-transform:uppercase;color:var(--muted-light);padding:11px 0 3px">${esc(label)}</span>`}${list.map((person, index) => row(person, index === 0)).join('')}`
    : '');
  // Runde 4 (B4): Neben „Beste Freunde" das gemeinsame Zeichen — antippen, um es zu ändern.
  const bfKnopf = `<button data-act="bf-marke-open" aria-label="${esc(tx('Zeichen für beste Freunde'))}" style="display:flex;align-items:center;gap:6px;height:44px;margin:-6px -6px -10px 0;padding:6px 6px 0;border:0;background:transparent;cursor:pointer;appearance:none;font:650 11.5px ${FONT};color:var(--green-dark);flex:none"><span style="pointer-events:none;display:flex">${bfPlakette(besteFreundeMarke(settings), 40, 'var(--surface)', true)}</span><span style="pointer-events:none">${tx('Zeichen')}</span></button>`;

  // Anfragen-Zeile mit orangem Zähler — nur wenn es welche gibt (reference 06.11).
  const names = requests.map((request) => (request.name || '').split(' ')[0]);
  const waitText = names.length === 1
    ? tx('{name} wartet auf Antwort', { name: names[0] })
    : names.length === 2
      ? tx('{a} und {b} warten auf Antwort', { a: names[0], b: names[1] })
      : tx('{a}, {b} und {n} weitere warten auf Antwort', { a: names[0], b: names[1], n: names.length - 2 });
  const requestBanner = requests.length
    ? `<button data-act="go-requests" style="flex:none;width:calc(100% - 40px);box-sizing:border-box;margin:12px 20px 0;background:var(--surface);border-radius:20px;border:1.5px solid var(--orange-a40);padding:12px 15px;display:flex;align-items:center;gap:11px;cursor:pointer;appearance:none;text-align:left;font-family:${FONT};color:var(--ink)">
<div style="display:flex;flex:none;pointer-events:none">${requests.slice(0, 2).map((request, index) => stackAvatar(request, { size: 32, fontSize: 12, first: index === 0, marker: stackMarker(repo, request) })).join('')}</div>
<div style="display:flex;flex-direction:column;gap:1px;flex:1;min-width:0;pointer-events:none"><span style="font-size:14.5px;font-weight:650">${tx('Freundesanfragen')}</span><span style="font-size:11.5px;color:var(--muted);white-space:nowrap;overflow:hidden;text-overflow:ellipsis">${esc(waitText)}</span></div>
<span style="min-width:22px;height:22px;border-radius:11px;background:var(--orange);color:var(--on-accent);font:650 12px/22px ${FONT};text-align:center;padding:0 6px;flex:none;pointer-events:none">${requests.length}</span>
${chevron}
</button>`
    : '';

  // Zaehler aus eindeutigen IDs (v3.1 §6), nicht aus sichtbaren Zeilen.
  const bestCount = [...new Set(settings.bestFriendIds || [])].length;

  const html = screenScaffold({
    header: `<div style="display:flex;align-items:center;gap:10px;padding:12px 20px 6px">
<button data-act="back" data-treffer aria-label="${esc(tx('Zurück'))}" style="display:flex;align-items:center;padding:0;border:0;background:transparent;cursor:pointer;appearance:none">${backArrow('var(--ink)', 22)}</button>
<span style="font-family:${BRICOLAGE};font-size:22px;font-weight:650">${tx('Freunde')}</span>
<span style="margin-left:auto;font-size:12.5px;color:var(--muted);font-variant-numeric:tabular-nums">${people.length}</span>
</div>`,
    bottomInset: 30,
    scrollKey: 'friends',
    // Runde 2: Das Einladungs-Sheet kann auch HIER liegen (siehe 'go-friend-add').
    overlays: `${friendsSheets(ctx)}${discardSheet(ctx)}${ctx.ui.qrOffen ? qrOverlay(ctx) : ''}`,
    // Auftrag §3.1: Ohne Freunde stand hier eine leere Karte mit einem einzigen Strich.
    // Jetzt ein Satz und direkt daneben der Weg, jemanden hinzuzufügen.
    body: `${requestBanner}
${people.length
      ? `<div style="margin:12px 20px 0;background:var(--surface);border-radius:20px;border:1px solid var(--ink-a07);padding:2px 16px;display:flex;flex-direction:column">
${group(tx('Besondere Person'), groups.special)}
${group(tx('Beste Freunde · {n} von 3', { n: bestCount }), groups.best, bfKnopf)}
${group(tx('Freunde · {n}', { n: groups.normal.length }), groups.normal)}
</div>`
      : `<div style="margin:12px 20px 0">${leerZeile({
        text: tx('Noch keine Freunde'),
        aktLabel: tx('Freunde hinzufügen'),
        act: 'go-friend-add',
      })}</div>`}`,
  });

  return { html, bind: bindFriends };
}

// v7 A06 (spec/01 §4): Freundesliste UND Personenprofil im Raum zeigen DASSELBE
// Markieren-Sheet (markSheet) und dieselben Bestaetigungs-Sheets. Die Aktionen dieses
// Sheets lagen bisher ausschliesslich in bindFriends: im Raum wurde das Sheet zwar
// gerendert, aber KEINE seiner Schaltflaechen war gebunden — „Speichern" schrieb dort
// nichts. Deshalb liegen sie jetzt in einer gemeinsamen Fabrik, die beide Screens
// einbinden; nur so sind Bauform UND Aktionen wirklich dieselben.
export function markSheetActs(ctx) {
  const { repo, ui } = ctx;
  // Dieselbe Sicht auf den Bearbeitungszustand wie in friendMenuActs: dirtyGuard und
  // markValue lesen ausschliesslich ctx.ui, zwei Instanzen teilen deshalb denselben Stand.
  const markValue = () => ({
    label: (ui.markLabel || '').trim(),
    symbol: specialSymbolKey(ui.markSymbol),
    color: paletteColor(ui.markColor || MARK_COLOR_DEFAULT),
  });
  const guard = dirtyGuard(ctx, 'mark');

  // Ü4: Der Markieren-Stand (Label, Symbol, Farbe) wird erst mit „Speichern" übernommen —
  // beim Schließen über Scrim wird deshalb nach echter Änderung gefragt.
  // v4 P0-3-2: Es gibt keinen `mode` mehr. Das Sheet IST die Besondere Person.
  const closeMark = () => {
    ui.sheet = null;
    ui.markFor = null;
    ui.markColorOpen = false;
    ctx.render();
  };

  return {
    'mark-close': () => { if (guard.confirm(markValue(), closeMark)) closeMark(); },
    // v5 A10: Symbol und Emoji schließen einander aus — die Wahl ist eindeutig.
    'mark-symbol': (data) => { ui.markSymbol = data.symbol; ui.markEmoji = ''; ctx.render(); },
    // v6 A04b: Das Feld selbst traegt die Eingabe; der Klick auf die Kachel fokussiert nur.
    'mark-emoji-focus': (data, el) => { el.querySelector('#mark-emoji')?.focus(); },
    'mark-color-open': () => { ui.markColorOpen = !ui.markColorOpen; ctx.render(); },
    // v7 A05: Tap im Sheet, aber ausserhalb des Popovers -> nur der Popover schliesst.
    'mark-color-close': () => { ui.markColorOpen = false; ctx.render(); },
    'mark-color': (data) => { ui.markColor = data.color; ui.markColorOpen = false; ctx.render(); },
    // Speichern setzt IMMER die Besondere Person. Der Goldring wird dabei atomar
    // zurückgenommen — bestätigt wurde das bereits vor dem Öffnen (P0-3-5).
    'mark-save': () => {
      const personId = ui.markFor;
      const settings = repo.getSettings();
      guard.clear();
      const wasBest = [...new Set(settings.bestFriendIds || [])].includes(personId);
      repo.setSpecialPerson(personId, {
        label: (ui.markLabel || '').trim(),
        symbol: specialSymbolKey(ui.markSymbol),
        emoji: ui.markEmoji || '',
        color: paletteColor(ui.markColor || MARK_COLOR_DEFAULT),
      });
      ui.sheet = null;
      ui.markFor = null;
      ctx.render();
      ctx.toast(wasBest ? tx('Besondere Person — Goldring zurückgenommen') : tx('Als besondere Person markiert'));
    },
    'mark-remove': () => {
      const personId = ui.markFor;
      const settings = repo.getSettings();
      guard.clear();
      ui.sheet = null;
      ui.markFor = null;
      if (settings.specialPerson?.personId === personId) repo.setSpecialPerson(personId, null);
      ctx.render();
      ctx.toast(tx('Besondere Person entfernt'));
    },
  };
}

// v7 A06: Label- und Emoji-Feld des Markieren-Sheets haengen an echten input-Ereignissen,
// nicht an data-act. Sie gehoeren deshalb ebenfalls in die gemeinsame Fabrik — sonst nimmt
// dasselbe Sheet im Personenprofil des Raums keinen Text an.
export function bindMarkSheetInputs(root, ctx) {
  const { ui } = ctx;
  // v6 A04b: Aus der Systemtastatur kommt beliebiger Text; uebernommen wird genau EIN
  // Emoji-Zeichen. Die Exklusivitaet Symbol ODER Emoji bleibt bestehen.
  root.querySelector('#mark-emoji')?.addEventListener('input', (event) => {
    const zeichen = ersterEmojiCluster(event.target.value);
    ui.markEmoji = zeichen;
    if (event.target.value !== zeichen) event.target.value = zeichen;
    ctx.render();
  });
  const labelInput = root.querySelector('#mark-label');
  if (!labelInput) return;
  labelInput.addEventListener('input', () => {
    ui.markLabel = labelInput.value;
    const counter = root.querySelector('#mark-count');
    if (counter) counter.textContent = `${labelInput.value.length}/18`;
    // v7 A04d: Der Chip wird GEZIELT an seinem Knoten aktualisiert — nicht über
    // ctx.render(). Ein voller Renderlauf je Tastendruck ist genau die globale
    // Renderkette, die spec/00 verbietet; ohne Aktualisierung blieb der Chip aber bis
    // zum Speichern unsichtbar. Der Chip kommt weiterhin aus derselben Primitive.
    const chip = root.querySelector('#mark-chip');
    if (chip) {
      chip.innerHTML = specialLabelChip({
        kind: 'special',
        symbol: specialSymbolKey(ui.markSymbol),
        emoji: ui.markEmoji || '',
        color: paletteColor(ui.markColor || MARK_COLOR_DEFAULT),
        label: labelInput.value.trim(),
      });
    }
  });
}

function bindFriends(root, ctx) {
  const { repo, nav } = ctx;
  v7ProfilDefaults(repo);           // schreibt hoechstens einmal (A33a/A35b)

  // v7 A06: Eingabefelder und Aktionen des Markieren-Sheets kommen aus der gemeinsamen
  // Fabrik — dieselbe, die das Personenprofil im Raum benutzt.
  bindMarkSheetInputs(root, ctx);

  // v4 P0-3-2: „Als besondere Person markieren" öffnet AUSSCHLIESSLICH dieses Sheet.

  // v4 P0-3-4: Der abgelehnte vierte beste Freund MUSS sichtbar werden. Ein Menü-Hinweis
  // reicht nicht — das Menü ist an dieser Stelle schon zu.
  const applyBest = (personId, on) => {
    const result = repo.setBestFriend(personId, on);
    if (result && !result.ok) { ctx.toast(result.reason); return false; }
    return true;
  };

  bindActions(root, {
    ...discardActions(ctx),
    'go-requests': () => nav.go('profile.friendRequests'),
    // Runde 2 (Jonathan): Aus der Freundesliste öffnet „Freunde hinzufügen" das Einladungs-
    // Sheet ÜBER der Liste — wer es schließt, ist wieder in der Liste, nicht im Profil.
    'go-friend-add': () => { ctx.ui.qrOffen = true; ctx.render(); },
    ...(ctx.ui.qrOffen ? qrSheetActs(root, ctx, () => { ctx.ui.qrOffen = false; ctx.ui.qrExpanded = false; ctx.render(); }) : {}),
    'open-friend': (data) => nav.go('room.personDetails', { personId: data.person }),
    // Drei-Punkte-Menue: am Icon verankertes Dropdown, nie ein Bottom-Sheet.
    ...friendMenuActs(ctx, { applyBest }),
    ...markSheetActs(ctx),
    ...blockActs(ctx),
  });
}

// ============================================================================
// 06.12 Freundesanfragen (profile.friendRequests) — annehmen oder ablehnen
// ============================================================================

function renderFriendRequests(ctx) {
  const { repo } = ctx;
  const requests = repo.getFriendRequests() || [];
  const outgoing = repo.getSettings().outgoingRequests || [];

  const receivedRows = requests.map((request) => `<div style="display:flex;align-items:center;gap:11px;padding:12px 0;border-top:1px solid var(--ink-a05)">
${stackAvatar(request, { size: 40, fontSize: 14.5, first: true, marker: stackMarker(repo, request) })}
<div style="display:flex;flex-direction:column;gap:2px;flex:1;min-width:0"><span style="font-size:14.5px;font-weight:650;white-space:nowrap;overflow:hidden;text-overflow:ellipsis">${esc(request.name)}</span><span style="font-size:11.5px;color:var(--muted);white-space:nowrap;overflow:hidden;text-overflow:ellipsis">${esc(request.meta || tx('über Link'))}</span></div>
${requestControls(request.id, 32)}
</div>`).join('');

  const receivedCard = requests.length
    ? `<div style="background:var(--surface);border-radius:20px;border:1px solid var(--ink-a07);padding:4px 16px 6px;display:flex;flex-direction:column;flex:none">
<span style="font-size:10.5px;font-weight:650;letter-spacing:.09em;text-transform:uppercase;color:var(--muted-light);padding:11px 0 3px">${tx('Möchten dich adden')}</span>
${receivedRows}
</div>`
    : '';
  const sentCard = outgoing.length
    ? `<div style="background:var(--surface);border-radius:20px;border:1px solid var(--ink-a07);padding:4px 16px 6px;display:flex;flex-direction:column;flex:none">
<span style="font-size:10.5px;font-weight:650;letter-spacing:.09em;text-transform:uppercase;color:var(--muted-light);padding:11px 0 3px">${tx('Von dir gesendet')}</span>
${outgoing.map((entry) => outgoingRow(entry, { card: true })).join('')}
</div>`
    : '';
  const emptyCard = (requests.length + outgoing.length) === 0
    ? `<div style="background:var(--surface);border-radius:20px;border:1px solid var(--ink-a07);padding:22px;text-align:center;flex:none"><span style="font-size:13px;color:var(--muted)">${tx('Keine offenen Anfragen')}</span></div>`
    : '';

  const badge = requests.length
    ? `<span style="margin-left:auto;min-width:22px;height:22px;border-radius:11px;background:var(--orange);color:var(--on-accent);font:650 12px/22px ${FONT};text-align:center;padding:0 6px">${requests.length}</span>`
    : `<span style="margin-left:auto;font-size:12.5px;color:var(--muted);font-variant-numeric:tabular-nums">${outgoing.length}</span>`;

  const html = screenScaffold({
    header: `<div style="display:flex;align-items:center;gap:10px;padding:12px 20px 6px">
<button data-act="back" data-treffer aria-label="${esc(tx('Zurück'))}" style="display:flex;align-items:center;padding:0;border:0;background:transparent;cursor:pointer;appearance:none">${backArrow('var(--ink)', 22)}</button>
<span style="font-family:${BRICOLAGE};font-size:22px;font-weight:650">${tx('Anfragen')}</span>
${badge}
</div>`,
    bottom: navBottom(ctx),
    bottomInset: TABBAR_INSET + CONTENT_INSET,
    scrollKey: 'friend-requests',
    body: `<div style="display:flex;flex-direction:column;gap:12px;padding:12px 20px 0">
${receivedCard}
${sentCard}
${emptyCard}
<div style="display:flex;align-items:flex-start;gap:9px;background:var(--surface);border-radius:16px;border:1px solid var(--ink-a07);padding:12px 14px;flex:none">
<span style="margin-top:1px;display:flex;flex:none">${svgLock}</span>
<span style="font-size:11.5px;color:var(--muted);line-height:1.45;flex:1;text-wrap:pretty">${tx('Bis du annimmst, sieht die Person <b>nichts</b> von dir — kein Frei, keine Meets, keine Crews. Abgelehnte Anfragen verschwinden lautlos, ohne Hinweis an die andere Seite.')}</span>
</div>
</div>`,
  });

  return { html, bind: bindFriendRequests };
}

function bindFriendRequests(root, ctx) {
  bindActions(root, requestActs(ctx));
}

// ============================================================================
// Onboarding 09.1–09.4 (reference/current 09): Anmelden · Name & Foto ·
// Interessen (mind. 2) · Einladungsziel bzw. Start ohne Einladung.
// Kein Standort, keine Kontakte, keine Benachrichtigungs-Abfrage, kein
// Kalender, kein Tutorial-Karussell.
// ============================================================================

// v5 A32b (Spec 05 §5): Der Einstieg fragt nach SECHS breiten, gemeinschaftlich
// sinnvollen Feldern — nicht nach einzelnen Hobbys. Die präzisen Dinge (Gym, Schwimmen,
// Kino, Grillen …) liegen eine Ebene tiefer unter „Weitere Interessen".
// v6 A21a: Die Suche ist ersatzlos entfallen — über sechs sichtbaren Karten kostet ein
// Suchfeld mehr Aufmerksamkeit, als es einspart, und es ersetzte beim Tippen sogar die
// Karten selbst durch eine Trefferliste.
const svgFeldSport = `<svg width="20" height="20" viewBox="0 0 24 24" fill="none" style="flex:none;pointer-events:none"><circle cx="12" cy="12" r="8.2" stroke="var(--green-dark)" stroke-width="1.8"></circle><path d="M12 3.8c2.6 2.4 2.6 13.9 0 16.4M4.2 9.5c4.6 1.7 11 1.7 15.6 0" stroke="var(--green-dark)" stroke-width="1.6" stroke-linecap="round"></path></svg>`;
const svgFeldEssen = `<svg width="20" height="20" viewBox="0 0 24 24" fill="none" style="flex:none;pointer-events:none"><path d="M7 3.5v7.5a2.2 2.2 0 0 0 4.4 0V3.5M9.2 11v9.5" stroke="var(--green-dark)" stroke-width="1.8" stroke-linecap="round"></path><path d="M16.6 3.5c-1.5 1.2-2.2 3-2.2 5.2 0 1.6.8 2.6 2.2 2.8v9" stroke="var(--green-dark)" stroke-width="1.8" stroke-linecap="round"></path></svg>`;
const svgFeldFilm = `<svg width="20" height="20" viewBox="0 0 24 24" fill="none" style="flex:none;pointer-events:none"><rect x="3.2" y="5.5" width="17.6" height="13" rx="2.6" stroke="var(--green-dark)" stroke-width="1.8"></rect><path d="M10 9.7v4.6l4-2.3-4-2.3Z" fill="var(--green-dark)"></path></svg>`;
const svgFeldGaming = `<svg width="20" height="20" viewBox="0 0 24 24" fill="none" style="flex:none;pointer-events:none"><rect x="2.6" y="7.5" width="18.8" height="9.5" rx="4.4" stroke="var(--green-dark)" stroke-width="1.8"></rect><path d="M7 10.6v3.4M5.3 12.3h3.4" stroke="var(--green-dark)" stroke-width="1.6" stroke-linecap="round"></path><circle cx="16.4" cy="11.4" r="1.15" fill="var(--green-dark)"></circle><circle cx="18.4" cy="13.6" r="1.15" fill="var(--green-dark)"></circle></svg>`;
// v6 A21b: „Ausgehen & Events" statt „Musik & Events" — das Ticket zeigt den Anlass,
// nicht ein einzelnes Genre.
const svgFeldAusgehen = `<svg width="20" height="20" viewBox="0 0 24 24" fill="none" style="flex:none;pointer-events:none"><path d="M3.4 9.4a2 2 0 0 1 2-2h13.2a2 2 0 0 1 2 2v1.1a1.8 1.8 0 0 0 0 3.4v1.1a2 2 0 0 1-2 2H5.4a2 2 0 0 1-2-2v-1.1a1.8 1.8 0 0 0 0-3.4V9.4Z" stroke="var(--green-dark)" stroke-width="1.8" stroke-linejoin="round"></path><path d="M14.4 8.4v1.5M14.4 11.3v1.5M14.4 14.2v1.5" stroke="var(--green-dark)" stroke-width="1.6" stroke-linecap="round"></path></svg>`;
// v6 A21f: „Chillen & Spiele" trug ein Sofa — also genau die Hälfte ohne die Spiele. Der
// Würfel ist dieselbe Formensprache wie das Spiele-Icon der Ressourcenliste
// (RESOURCE_ICON_PATHS, Muster /spiel/), damit beide Stellen dasselbe Zeichen führen.
// v7 A34: Spielkarte UND Würfel — das reine Punktequadrat war auf 20 px kaum von einer
// leeren Kachel zu unterscheiden.
const svgFeldSpiele = `<svg width="20" height="20" viewBox="0 0 24 24" fill="none" style="flex:none;pointer-events:none"><rect x="2.6" y="5.2" width="10" height="14" rx="2.4" stroke="var(--green-dark)" stroke-width="1.8"></rect><path d="M7.6 9.2 9.4 11l-1.8 1.8L5.8 11l1.8-1.8Z" fill="var(--green-dark)"></path><rect x="12.4" y="8.4" width="9" height="9" rx="2.4" transform="rotate(12 12.4 8.4)" stroke="var(--green-dark)" stroke-width="1.8"></rect><circle cx="16.2" cy="12.6" r="1.05" fill="var(--green-dark)"></circle><circle cx="19.4" cy="15.4" r="1.05" fill="var(--green-dark)"></circle></svg>`;

// v6 A21b: exakt die sechs Felder aus der Spezifikation, in dieser Reihenfolge.
// Sprachen: Die Namen der Felder und Einträge sind gespeicherte Interessen (settings.interests)
// und werden verglichen — sie bleiben deutsch. schluessel macht sie zu Übersetzungs-Schlüsseln,
// angezeigt werden sie über wort() (web/core/sprache.js).
const ONBOARDING_FIELDS = [
  { label: schluessel('Sport & draußen'), icon: svgFeldSport },
  { label: schluessel('Essen'), icon: svgFeldEssen },
  { label: schluessel('Filme & Serien'), icon: svgFeldFilm },
  { label: schluessel('Gaming'), icon: svgFeldGaming },
  { label: schluessel('Ausgehen & Events'), icon: svgFeldAusgehen },
  { label: schluessel('Chillen & Spiele'), icon: svgFeldSpiele },
];

// v7 A34d/A31e (spec/06 §1 und §5): Die zweite Ebene ist eine KATEGORISIERTE Liste mit
// Icons — vorher eine flache Reihe aus elf Textzeilen ohne ein einziges Zeichen. Genau
// diese Struktur nutzt auch „Interesse hinzufügen" im Profil; es gibt keine zweite
// Interessen-Auswahl mehr.
// v7 A35b (spec/07): Der Aktivitätsbegriff heißt „Baden", nicht „See & Baden" — See ist
// ein Ort, kein Interesse.
// Fable 4 (J14): Jeder Eintrag bekommt sein Icon über den EINEN Katalog (ui/activity-icons.js,
// Stichwort im Label) — keine Hints mehr, die „Ski" auf „bouldern" und „Kaffee" auf „brunch" legten.
// Neu im Katalog: Trinken und Feiern (fehlten ganz), Laufen, Fußball, Volleyball, Pizza,
// Kartenspiele, Filmabend, Theater.
//
// Auftrag §1.5: Diese Liste ist jetzt eine AUFKLAPPBARE Liste von Oberbegriffen. Damit das
// Aufklappen überhaupt etwas bringt, sind die vier sehr breiten Gruppen in sieben schärfere
// zerlegt — „Sport" und „Draußen" sind nicht dasselbe, und Musik hatte gar keinen Platz.
// Jeder Eintrag hier hat ein Zeichen im EINEN Icon-Katalog (ui/activity-icons.js); das ist
// geprüft (scratch/fable-icons-check.mjs), nicht gehofft.
const INTEREST_CATALOG = [
  {
    kategorie: 'Sport',
    eintraege: [schluessel('Gym'), schluessel('Laufen'), schluessel('Schwimmen'), schluessel('Radfahren'), schluessel('Ski'), schluessel('Bouldern'), schluessel('Fußball'), schluessel('Volleyball'), schluessel('Yoga')]
      .map((label) => ({ label, hint: { title: label } })),
  },
  {
    kategorie: 'Draußen',
    eintraege: [schluessel('Wandern'), schluessel('Spazieren'), schluessel('Baden'), schluessel('Grillen'), schluessel('Picknick'), schluessel('Camping')]
      .map((label) => ({ label, hint: { title: label } })),
  },
  {
    kategorie: 'Essen & Trinken',
    eintraege: [schluessel('Kochen'), schluessel('Essen gehen'), schluessel('Pizza'), schluessel('Brunch'), schluessel('Kaffee'), schluessel('Trinken')]
      .map((label) => ({ label, hint: { title: label } })),
  },
  {
    kategorie: 'Zuhause',
    eintraege: [schluessel('Brettspiele'), schluessel('Kartenspiele'), schluessel('Gaming'), schluessel('Filmabend'), schluessel('Serien'), schluessel('Chillen')]
      .map((label) => ({ label, hint: { title: label } })),
  },
  // Runde 2 (Jonathan, 13.09.2026): „Feiern" heißt „Club", „Theater" wird zu „Konzerte",
  // die Hauptkategorie Musik und „Musik machen" entfallen. Festivals und Karaoke gehören
  // ohnehin zum Ausgehen und wandern mit.
  {
    kategorie: 'Ausgehen',
    // Runde 3 (Jonathan, B1): „Festivals" ist gestrichen — „Konzerte passt am besten".
    eintraege: [schluessel('Kino'), schluessel('Club'), schluessel('Bar'), schluessel('Konzerte'), schluessel('Karaoke'), schluessel('Museum')].map((label) => ({ label, hint: { title: label } })),
  },
  {
    kategorie: 'Ruhe & Kreatives',
    eintraege: [schluessel('Lesen'), schluessel('Fotografieren'), schluessel('Lernen'), schluessel('Shopping')].map((label) => ({ label, hint: { title: label } })),
  },
];

// Runde 3 (B1): Wer „Festivals" früher gewählt hat, behält es — als eigenes Interesse, genau wie
// ein selbst getipptes. Damit es in jeder Sprache weiter übersetzt erscheint (wort()), bleibt das
// Wort hier als Übersetzungs-Schlüssel stehen. Angeboten wird es nicht mehr.
export const FRUEHERE_INTERESSEN = [schluessel('Festivals')];

// Sprachen: Die Oberbegriffe sind zugleich der Merker des offenen Abschnitts (ui.offeneKat,
// data-kat) und werden verglichen — sie bleiben deshalb deutsch und werden erst bei der
// Anzeige übersetzt. Die Einträge selbst sind gespeicherte Interessen und bleiben, wie sie sind.
const KATEGORIE_WORTE = {
  Sport: tx('Sport'),
  Draußen: tx('Draußen'),
  'Essen & Trinken': tx('Essen & Trinken'),
  Zuhause: tx('Zuhause'),
  Ausgehen: tx('Ausgehen'),
  'Ruhe & Kreatives': tx('Ruhe & Kreatives'),
  Eigene: tx('Eigene'),
};

const ONBOARDING_MORE = INTEREST_CATALOG.flatMap((gruppe) => gruppe.eintraege.map((eintrag) => eintrag.label));

// Alles Vorgegebene zusammen — daran erkennt „Eigenes hinzufügen", was schon existiert.
const ONBOARDING_INTERESTS = [...ONBOARDING_FIELDS.map((feld) => feld.label), ...ONBOARDING_MORE];

function interestIcon(label, color = 'var(--green-dark)', size = 18) {
  const eintrag = INTEREST_CATALOG.flatMap((gruppe) => gruppe.eintraege).find((e) => e.label === label);
  return activityIconSvg(eintrag ? eintrag.hint : { title: label }, color, size);
}

// EINE Darstellung der kategorisierten Auswahl für beide Aufrufer (Onboarding und Profil).
//   istGewaehlt(label) → markiert die Zeile
//   act               → data-act jeder Zeile (data-name trägt das Label)
//   extra(label)      → optionaler Zusatz rechts (z. B. „eigenes")
//   offen / toggleAct → Auftrag §1.5: Oberbegriffe klappen auf. Es ist immer HÖCHSTENS
//                       EINER offen; ein zweiter Tipp auf denselben schließt ihn wieder.
//                       Ohne toggleAct bleibt es bei der flachen Liste (Rückfallweg).
function interestCatalogHtml({ act, istGewaehlt, extraLabels = [], extra = () => '', offen = null, toggleAct = '' }) {
  const gruppen = extraLabels.length
    ? [{ kategorie: 'Eigene', eintraege: extraLabels.map((label) => ({ label, hint: { title: label } })) }, ...INTEREST_CATALOG]
    : INTEREST_CATALOG;

  const zeile = (eintrag) => {
    const gewaehlt = istGewaehlt(eintrag.label);
    return `<button data-act="${act}" data-name="${esc(eintrag.label)}" aria-pressed="${gewaehlt}" style="display:flex;align-items:center;gap:11px;padding:11px 0;width:100%;border:0;border-top:1px solid var(--ink-a05);background:transparent;text-align:left;cursor:pointer;appearance:none;font-family:${FONT}">
<span style="width:30px;height:30px;border-radius:10px;background:${gewaehlt ? 'var(--green-tint)' : 'var(--paper-soft)'};display:flex;align-items:center;justify-content:center;flex:none;pointer-events:none">${interestIcon(eintrag.label, 'var(--green-dark)', 17)}</span>
<span style="font-size:14.5px;font-weight:${gewaehlt ? 650 : 600};color:${gewaehlt ? 'var(--ink)' : 'var(--ink-soft)'};flex:1;min-width:0;pointer-events:none">${esc(wort(eintrag.label))}</span>
${extra(eintrag.label)}
${gewaehlt ? onbCheck : onbEmpty}</button>`;
  };

  if (!toggleAct) {
    return gruppen.map((gruppe) => `<div style="padding:12px 0 2px"><span style="font-size:10.5px;font-weight:650;letter-spacing:.09em;text-transform:uppercase;color:var(--muted-light)">${esc(KATEGORIE_WORTE[gruppe.kategorie] || gruppe.kategorie)}</span></div>
${gruppe.eintraege.map(zeile).join('')}`).join('');
  }

  return gruppen.map((gruppe) => {
    const auf = offen === gruppe.kategorie;
    const gewaehlteHier = gruppe.eintraege.filter((e) => istGewaehlt(e.label)).length;
    return `<div style="border-top:1px solid var(--ink-a07)">
<button data-act="${toggleAct}" data-kat="${esc(gruppe.kategorie)}" aria-expanded="${auf}" style="display:flex;align-items:center;gap:10px;padding:14px 0;width:100%;border:0;background:transparent;text-align:left;cursor:pointer;appearance:none;font-family:${FONT}">
<span style="font-size:15px;font-weight:650;color:${auf ? 'var(--green-dark)' : 'var(--ink)'};flex:1;pointer-events:none">${esc(KATEGORIE_WORTE[gruppe.kategorie] || gruppe.kategorie)}</span>
${gewaehlteHier ? `<span style="font-size:11px;font-weight:650;color:var(--green-dark);background:var(--green-tint);padding:3px 8px;border-radius:7px;flex:none;font-variant-numeric:tabular-nums;pointer-events:none">${gewaehlteHier}</span>` : ''}
<span style="display:flex;transform:rotate(${auf ? 90 : 0}deg);transition:transform .16s ease-out;pointer-events:none">${auf ? svgOnbChevronGruen : svgOnbChevron}</span></button>
${auf ? `<div style="padding-bottom:6px">${gruppe.eintraege.map(zeile).join('')}</div>` : ''}
</div>`;
  }).join('');
}

// Hintergrund von 09.1: Ring links oben, grüner Punkt darunter. Die Offsets sind auf den
// Inhaltskörper bezogen (er beginnt 46 px unter der Screen-Oberkante = Höhe der StatusBar),
// damit die Dekoration exakt an der Referenzposition sitzt.
const onbDecor = `<span style="position:absolute;left:-110px;top:-126px;width:270px;height:270px;border-radius:50%;border:18px solid var(--ink-a05);box-sizing:border-box;pointer-events:none"></span><span style="position:absolute;left:118px;top:80px;width:56px;height:56px;border-radius:50%;background:var(--green-a12);pointer-events:none"></span>`;

const svgCrewLogo = `<svg width="60" height="60" viewBox="0 0 72 72" style="pointer-events:none"><circle cx="36" cy="36" r="24" fill="none" stroke="var(--ink)" stroke-width="6.5"></circle><circle cx="53.5" cy="52" r="9" fill="var(--green)" stroke="var(--paper)" stroke-width="4"></circle></svg>`;

const svgCrewPair = `<svg width="22" height="22" viewBox="0 0 24 24" fill="none" style="pointer-events:none"><circle cx="8.5" cy="9" r="3.4" stroke="var(--green-dark)" stroke-width="1.8"></circle><circle cx="16.5" cy="10.5" r="2.6" stroke="var(--green-dark)" stroke-width="1.8"></circle><path d="M3 19.5a5.5 5.5 0 0 1 11 0M15.5 15.5a5 5 0 0 1 5.5 4" stroke="var(--green-dark)" stroke-width="1.8" stroke-linecap="round"></path></svg>`;
const svgFriendPlus = `<svg width="22" height="22" viewBox="0 0 24 24" fill="none" style="pointer-events:none"><circle cx="10" cy="9" r="3.8" stroke="var(--ink)" stroke-width="1.8"></circle><path d="M3.5 20a6.5 6.5 0 0 1 13 0" stroke="var(--ink)" stroke-width="1.8" stroke-linecap="round"></path><path d="M19 7.5v6M16 10.5h6" stroke="var(--ink)" stroke-width="1.8" stroke-linecap="round"></path></svg>`;
const svgOnbChevron = `<svg width="16" height="16" viewBox="0 0 24 24" fill="none" style="flex:none;pointer-events:none"><path d="M9.5 5.5 16 12l-6.5 6.5" stroke="var(--muted-light)" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"></path></svg>`;
const svgOnbChevronGruen = `<svg width="16" height="16" viewBox="0 0 24 24" fill="none" style="flex:none;pointer-events:none"><path d="M9.5 5.5 16 12l-6.5 6.5" stroke="var(--green-dark)" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"></path></svg>`;
const onbCheck = `<span style="width:26px;height:26px;border-radius:50%;background:var(--green);display:flex;align-items:center;justify-content:center;flex:none;pointer-events:none"><svg width="12" height="12" viewBox="0 0 24 24" fill="none"><path d="m7.5 12.5 3 3 6-6.5" stroke="var(--on-accent)" stroke-width="2.6" stroke-linecap="round" stroke-linejoin="round"></path></svg></span>`;
const onbEmpty = `<span style="width:26px;height:26px;border-radius:50%;border:1.5px solid var(--ink-a16);box-sizing:border-box;flex:none;pointer-events:none"></span>`;

// Runder Zurück-Knopf der Onboarding-Schritte (reference 09.2/09.2b).
//
// Runde 3 (Jonathan: „Ich kann nicht zurückklicken, wenn ich den Namen eingebe"): Im Server-
// Modus ist „Wie heißt du?" der ERSTE Schritt (app.js, ERSTER_SCHRITT). Der Pfeil führte dort ins
// Leere — ohne abgeschlossenes Einrichten lenkt die App sofort wieder hierher. Der Zurück-Knopf
// erscheint deshalb nur, wenn es wirklich einen vorigen Schritt gibt; sonst hält ein gleich
// großer Platzhalter die Kopfzeile ruhig.
function onbHeader(ctx, rightHtml = '') {
  const zurueck = ctx.nav.depth() > 1
    ? `<button data-act="back" data-treffer aria-label="${esc(tx('Zurück'))}" style="width:36px;height:36px;border-radius:50%;background:var(--surface);border:1.5px solid var(--ink-a10);display:flex;align-items:center;justify-content:center;flex:none;cursor:pointer;appearance:none;padding:0"><span style="pointer-events:none;display:flex">${backArrow('var(--ink)', 18)}</span></button>`
    : '<span aria-hidden="true" data-role="onb-kein-zurueck" style="width:36px;height:36px;flex:none"></span>';
  return `<div style="display:flex;align-items:center;gap:12px;padding:8px 20px 4px;flex:none">${zurueck}${rightHtml}</div>`;
}

function onbTitle(text) {
  return `<span style="font-family:${BRICOLAGE};font-size:30px;font-weight:650;letter-spacing:-.02em;line-height:1.15;flex:none">${esc(text)}</span>`;
}

function onbPrimary(act, label, enabled = true) {
  return `<button data-act="${act}"${enabled ? '' : ' disabled'} style="border:0;background:var(--green);color:var(--on-accent);font:650 15px/1 ${FONT};padding:17px 0;border-radius:999px;width:100%;text-align:center;appearance:none;${enabled ? 'cursor:pointer' : 'opacity:.35;cursor:default'}">${esc(label)}</button>`;
}

function onbTextButton(act, label) {
  return `<div style="flex:none;padding:0 24px 34px;display:flex;justify-content:center"><button data-act="${act}" style="border:0;background:transparent;cursor:pointer;appearance:none;padding:6px 10px;font:650 13.5px ${FONT};color:var(--ink-soft)">${esc(label)}</button></div>`;
}

// Runde 3 (Jonathan, A3): „Ganz am Anfang ist das Standardprofilbild irgendeine Farbe" — eine
// ruhige Farbe aus der Profilbild-Palette. Vorher hing sie am Namen und sprang mit jedem
// getippten Buchstaben um.
function zufallsFarbe() {
  const auswahl = PB_FARBEN.filter((farbe) => farbe.key !== 'graphit');
  return auswahl[Math.floor(Math.random() * auswahl.length)].wert;
}

function onbShortDate(iso) {
  const date = fromISODate(iso);
  return `${weekdayShort(iso)} ${date.getDate()}.${date.getMonth() + 1}.`;
}

// Onboarding abschließen: Profil übernehmen, Einladung verbraucht.
// Auftrag §1.4: Name, Bild und Farbe werden schon im Namensschritt geschrieben. Vorher
// entstanden sie erst hier, ganz am Ende — und ein im ersten Schritt gewähltes Bild hätte
// den Weg über drei Bildschirme als Parameter mitreisen müssen. Hier wird deshalb nur noch
// abgeschlossen; was schon im Profil steht, bleibt unangetastet.
function finishOnboarding(ctx) {
  const settings = ctx.repo.getSettings();
  const name = (settings.name || ctx.params.name || 'Du').trim() || 'Du';
  ctx.repo.completeOnboarding({
    name,
    initials: initialsOf(name),
    color: settings.color || zufallsFarbe(),
    photo: settings.photo || null,
    pendingInvite: null,
  });
}

// --- 09.1 Anmelden -----------------------------------------------------------

function renderOnboardingWelcome(ctx) {
  // Auftrag §1.1: Hier standen „Mit Apple anmelden" und „Mit Google anmelden" — ein Rest
  // aus der Zeit vor dem echten Konto-System. Im Server-Modus ist die Anmeldung an dieser
  // Stelle längst passiert; die App springt deshalb gar nicht mehr hierher (app.js,
  // ERSTER_SCHRITT). Übrig bleibt der Eingang für den Demo-Modus, wo es kein Konto gibt —
  // und dort tut kein Knopf mehr so, als würde er sich irgendwo anmelden.
  const html = screenScaffold({
    headerFade: false,
    scrollKey: 'onb-welcome',
    bottomInset: 0,
    body: `<div style="min-height:100%;display:flex;flex-direction:column;justify-content:center;align-items:flex-start;gap:14px;padding:0 30px 178px;position:relative">
${onbDecor}
<span style="position:relative;display:flex">${svgCrewLogo}</span>
<span style="position:relative;font-family:${BRICOLAGE};font-size:46px;font-weight:650;letter-spacing:-.02em;line-height:1">crew<span style="color:var(--green)">.</span></span>
<span style="position:relative;font-size:16px;color:var(--ink-soft);line-height:1.5;max-width:290px;text-wrap:pretty">${tx('Sehen, wer Zeit hat. Und daraus etwas machen.')}</span>
</div>`,
    bottom: `${bottomFade(24)}${bottomBar(`<div style="display:flex;flex-direction:column;gap:9px;padding:0 24px 34px;background:var(--paper)">
${onbPrimary('onb-start', tx('Los geht’s'))}
</div>`)}`,
  });

  return {
    html,
    bind: (root, innerCtx) => {
      bindActions(root, { 'onb-start': () => innerCtx.nav.go('onboarding.name') });
    },
  };
}

// --- 09.2 Name & Foto --------------------------------------------------------

function renderOnboardingName(ctx) {
  const { ui } = ctx;
  const name = ui.name || '';
  const ready = Boolean(name.trim());
  // Runde 3 (A3): Der Standard ist eine Farbe — einmal gezogen, dann fest. Mit dem Namen kommen
  // die Initialen dazu; vorher steht ein ruhiges Personenzeichen auf der Farbe.
  if (!ui.pbFest) ui.pbFest = pbStart({ photo: null, color: zufallsFarbe(), initials: '' });
  const stand = ui.pb || ui.pbFest;
  stand.z.i = name.trim() ? initialsOf(name) : '';
  const gestaltet = Boolean(pbErgebnis(ui.pbFest).photo);

  // A7: Der Baukasten — derselbe wie im Profil. Während er offen ist, zeigt die Scheibe
  // dahinter schon den Entwurf; „Abbrechen" stellt den Stand davor wieder her.
  const photoSheet = ui.pb
    ? pbSheet(ui.pb, { titel: tx('Profilbild'), abbrechen: 'onb-photo-cancel', uebernehmen: 'onb-photo-close' })
    : '';

  // A7 (Jonathan): „Die Farbpunkte unter dem Profilbild weg. Das Profilbild selbst ist
  // antippbar, nicht nur das Plus." Die ganze Scheibe ist der Knopf; das Zeichen unten rechts
  // und der Textknopf darunter sagen, dass man hier gestalten kann.
  const zeichen = `<span style="position:absolute;right:-2px;bottom:-2px;width:34px;height:34px;border-radius:50%;background:var(--green);border:3px solid var(--paper);box-sizing:border-box;display:flex;align-items:center;justify-content:center;pointer-events:none">${gestaltet ? pencil('var(--on-accent)', 14) : plus('var(--on-accent)', 15)}</span>`;
  const knopfText = gestaltet ? tx('Profilbild ändern') : tx('Profilbild gestalten');

  const html = screenScaffold({
    header: onbHeader(ctx),
    scrollKey: 'onb-name',
    overlays: photoSheet,
    bottomInset: 116,
    body: `<div style="display:flex;flex-direction:column;padding:12px 24px 0;gap:20px">
${onbTitle(tx('Wie heißt du?'))}
<div style="display:flex;flex-direction:column;align-items:center;gap:2px;flex:none">
${profilbildKnopf({ act: 'onb-photo', size: 104, id: 'onb-avatar', label: knopfText, inhalt: pbAvatar(stand, 104, 34), zeichen })}
<button data-act="onb-photo" style="border:0;background:transparent;padding:10px 10px 2px;cursor:pointer;appearance:none;font:650 13.5px ${FONT};color:var(--green-dark)">${knopfText}</button>
<span style="font-size:12px;color:var(--muted);text-align:center">${tx('Farbe, Motiv oder Foto — änderbar im Profil.')}</span>
</div>
<div style="display:flex;flex-direction:column;gap:8px;flex:none">
<span style="font-size:11px;font-weight:650;letter-spacing:.09em;text-transform:uppercase;color:var(--muted-light)">${tx('Name')}</span>
<div style="background:var(--surface);border:1.5px solid var(--green-a50);border-radius:16px;padding:15px 16px;display:flex;align-items:center;gap:9px">
<input id="onb-name" value="${esc(name)}" placeholder="${esc(tx('Dein Name'))}" aria-label="${esc(tx('Dein Name'))}" style="flex:1;min-width:0;border:0;outline:none;background:transparent;font:600 16px ${FONT};color:var(--ink);caret-color:var(--green);padding:0">
</div>
<span style="font-size:12px;color:var(--muted);padding-left:2px">${tx('So sehen dich deine Freunde. Änderbar im Profil.')}</span>
</div>
</div>`,
    bottom: `${bottomFade(24)}${bottomBar(`<div style="padding:0 24px 34px;background:var(--paper)">${onbPrimary('onb-next', tx('Weiter'), ready)}</div>`)}`,
  });

  return { html, bind: bindOnboardingName };
}

function bindOnboardingName(root, ctx) {
  const { nav, ui, repo } = ctx;
  const input = root.querySelector('#onb-name');
  const goNext = () => {
    const value = (ui.name || '').trim();
    if (!value) return;
    const initialen = initialsOf(value);
    const { photo, color } = pbErgebnis(ui.pbFest || pbStart({ photo: null, color: zufallsFarbe(), initials: initialen }));
    // §1.4: Name, Bild und Farbe werden hier geschrieben — an EINER Stelle, über denselben
    // Weg wie später im Profil (repo.updateSettings).
    repo.updateSettings({
      name: value,
      initials: initialen,
      color,
      photo: mitInitialen(photo, initialen),
    });
    nav.go('onboarding.interests', { name: value });
  };
  pbFotoBinden(root, ctx, () => ui.pb || null);
  if (input) {
    // Kein Rerender beim Tippen (zerstört den Fokus) — Knopf und Scheibe werden direkt gesetzt.
    input.addEventListener('input', () => {
      ui.name = input.value;
      const next = root.querySelector('[data-act="onb-next"]');
      const hasName = Boolean(input.value.trim());
      if (next) {
        next.disabled = !hasName;
        next.style.opacity = hasName ? '1' : '.35';
        next.style.cursor = hasName ? 'pointer' : 'default';
      }
      // Runde 3: Die Initialen erscheinen sofort in der Scheibe.
      const avatar = root.querySelector('#onb-avatar');
      const stand = ui.pb || ui.pbFest;
      if (avatar && stand) {
        stand.z.i = hasName ? initialsOf(input.value) : '';
        avatar.innerHTML = pbAvatar(stand, 104, 34);
      }
    });
    input.addEventListener('keydown', (event) => { if (event.key === 'Enter') goNext(); });
  }
  bindActions(root, {
    // Der Entwurf ist eine Kopie — der feste Stand bleibt für „Abbrechen".
    'onb-photo': () => {
      const fest = ui.pbFest || pbStart({ photo: null, color: zufallsFarbe(), initials: '' });
      ui.pbFest = fest;
      ui.pb = { ...fest, z: { ...fest.z } };
      ctx.render();
    },
    ...pbActs(ctx, () => ui.pb || null),
    'onb-photo-close': () => {
      if (ui.pb) ui.pbFest = ui.pb;
      ui.pb = null;
      ctx.render();
    },
    'onb-photo-cancel': () => { ui.pb = null; ctx.render(); },
    'onb-next': goNext,
  });
}
// --- 09.2b Interessen (mindestens zwei, eigene erlaubt, kein „Später") -------

// v4 P7-2 / COMPONENT_RULES 7: Das Onboarding bleibt kurz und ist ÜBERSPRINGBAR. Vorher
// war dieser Schritt der einzige Zwang: „0 von mind. 2", der Weiter-Knopf blieb blass, bis
// zwei Interessen gewählt waren. Alle anderen Schritte („Foto ist optional", „Erstmal
// umsehen", „Später — direkt zu Crew") waren schon frei. Jetzt ist er es auch.
function renderOnboardingInterests(ctx) {
  const { ui } = ctx;
  const custom = ui.custom || [];
  const picked = ui.picked || [];
  // v7 A34a (spec/06 §5): „Weiter" ist erst ab ZWEI Interessen aktiv. Der v4-Wert
  // `const ready = true` liess den Knopf auch ohne jede Auswahl weiterfuehren.
  const ready = picked.length >= 2;

  // v7 A34c: Das eigene Interesse ist ein DAUERHAFT sichtbares Feld in der Kartensprache
  // (16 px Radius, neutrale Kontur, volle Breite) und steht als eigener Block unmittelbar
  // ueber „Weiter". Vorher war es eine passive Textzeile, die sich erst nach einem Tap in
  // ein andersfarbiges Feld verwandelte — und beim Aufklappen der zweiten Ebene 321 px
  // unter den sichtbaren Bereich rutschte.
  const addRow = `<div style="display:flex;align-items:center;gap:8px">
<input id="onb-int-new" placeholder="${esc(tx('Eigenes Interesse'))}" aria-label="${esc(tx('Eigenes Interesse'))}" style="flex:1;min-width:0;border:1.5px solid var(--ink-a10);border-radius:16px;padding:13px 14px;font:600 14px ${FONT};color:var(--ink);caret-color:var(--green);background:var(--surface);outline:none;box-sizing:border-box">
<button data-act="onb-int-add" aria-label="${esc(tx('Eigenes Interesse hinzufügen'))}" style="width:44px;height:44px;border-radius:16px;border:0;background:var(--green);display:flex;align-items:center;justify-content:center;flex:none;cursor:pointer;appearance:none;padding:0"><span style="pointer-events:none;display:flex">${plus('var(--on-accent)', 16)}</span></button>
</div>`;

  // Runde 3 (Jonathan, B3): Das Etikett „eigenes" neben selbst eingetragenen Interessen ist
  // entfallen — im Dunkelmodus stand es weiß auf hellem Grund, und die Überschrift „Eigene"
  // sagt es ohnehin.
  // v5 A32b: Sechs breite Felder als Karten mit Icon.
  //
  // v6 A21c: Die Auswahl darf die Kartengeometrie NICHT verändern. Der frühere 16-px-Haken
  // saß in derselben Flexzeile wie das Label; sobald Labelbreite + 23 px die Kartenbreite
  // überschritten, brach der Text um und die Karte wuchs von 96 auf 106,8 px — und riss im
  // 2-Spalten-Raster die ganze Zeile mit hoch. Der Haken ist ersatzlos weg; die Auswahl
  // spricht allein über Fläche, Kontur und Farbe. `height` statt `min-height` legt die
  // Höhe zusätzlich strukturell fest.
  const feldKarte = (feld) => {
    const selected = picked.includes(feld.label);
    // Die Maße sind so gewählt, dass auch ein ZWEIZEILIGES Label noch in die feste Höhe
    // passt (12+32+6+2x16,25+12 = 94,5 ≤ 96). Damit muss der Text weder abgeschnitten
    // werden noch kann er die Karte auseinanderdrücken — auch nicht bei 360 px Breite.
    return `<button data-act="onb-int" data-name="${esc(feld.label)}" aria-pressed="${selected}" style="display:flex;flex-direction:column;align-items:flex-start;justify-content:flex-start;gap:6px;padding:12px 12px;border-radius:16px;border:1.5px solid ${selected ? 'var(--green)' : 'var(--ink-a10)'};background:${selected ? 'var(--green-tint)' : 'var(--surface)'};text-align:left;cursor:pointer;appearance:none;font-family:${FONT};height:96px;overflow:hidden;box-sizing:border-box">
<span style="display:flex;align-items:center;justify-content:center;width:32px;height:32px;border-radius:10px;background:${selected ? 'var(--green-tint)' : 'var(--paper-soft)'};flex:none;pointer-events:none">${feld.icon}</span>
<span style="display:flex;align-items:flex-start;width:100%;pointer-events:none">
<span style="font-size:13px;font-weight:${selected ? 650 : 600};color:${selected ? 'var(--green-dark)' : 'var(--ink-soft)'};flex:1;min-width:0;line-height:1.25;text-wrap:pretty">${esc(wort(feld.label))}</span>
</span></button>`;
  };
  // Was auf der zweiten Ebene gewählt wurde — für den Zähler am Knopf und die Chips darunter.
  const gewaehltTiefer = picked.filter((label) => !ONBOARDING_FIELDS.some((f) => f.label === label));
  // Runde 3 (B2): Eigene Interessen („Klimmzüge") bekommen ihr Zeichen schon hier, nicht erst nach
  // dem Einrichten — der Server schlägt unbekannte Wörter nach, dann zeichnet die App neu.
  ctx.repo.zeichenLernen?.(gewaehltTiefer);
  const felder = `<div style="display:grid;grid-template-columns:1fr 1fr;gap:9px">${ONBOARDING_FIELDS.map(feldKarte).join('')}</div>`;

  // Auftrag §1.5: „Weitere Interessen" öffnet ein Feld von unten. Darin stehen Oberbegriffe,
  // die sich aufklappen — immer nur einer. Vorher klappte die vollständige Liste MITTEN im
  // Bildschirm auf und schob alles darunter aus dem Sichtfeld.
  const tieferSheet = ui.moreOpen
    ? sheet(`<div style="display:flex;align-items:baseline;gap:8px;padding-bottom:4px">
<span style="font-family:${BRICOLAGE};font-size:19px;font-weight:650;flex:1">${tx('Weitere Interessen')}</span>
<span style="font-size:12px;color:var(--muted);font-variant-numeric:tabular-nums">${tx('{n} gewählt', { n: picked.length })}</span>
</div>
${interestCatalogHtml({
      act: 'onb-int',
      istGewaehlt: (label) => picked.includes(label),
      extraLabels: custom,
      offen: ui.offeneKat || null,
      toggleAct: 'onb-kat',
    })}
<div style="padding-top:14px;border-top:1px solid var(--ink-a07);margin-top:10px">
${groupLabel(tx('Steht nichts Passendes dabei?'))}
<div style="padding-top:6px">${addRow}</div>
</div>
<button data-act="onb-more-close" style="${GREEN_PILL};margin-top:16px">${tx('Fertig')}</button>`, { closeAct: 'onb-more-close', scrollKey: 'onb-more' })
    : '';
  // v6 A21d: „Weitere Interessen" las sich wie eine Überschrift — schwarzer Fließtext,
  // grauer Zähler, graues Chevron, direkt über einem grünen Add-Control. Jetzt trägt der
  // Knopf dieselbe aktive Sprache wie jeder andere Control: grüne Schrift, grünes Chevron,
  // Zähler als getönte Pille.
  const moreRow = `<button data-act="onb-more" style="display:flex;align-items:center;gap:9px;padding:12px 0;width:100%;border:0;background:transparent;text-align:left;cursor:pointer;appearance:none;font-family:${FONT}">
<span style="font-size:14.5px;font-weight:650;color:var(--green-dark);flex:1;pointer-events:none">${tx('Weitere Interessen')}</span>
${gewaehltTiefer.length ? `<span style="font-size:11px;font-weight:650;color:var(--green-dark);background:var(--green-tint);padding:3px 8px;border-radius:7px;flex:none;font-variant-numeric:tabular-nums;pointer-events:none">${gewaehltTiefer.length}</span>` : ''}
<span style="display:flex;pointer-events:none">${svgOnbChevronGruen}</span></button>`;

  // v7 A34a: Der Zaehler nennt die Restanzahl statt „optional" — der Knopf ist es nicht.
  const counter = ready
    ? `<span style="margin-left:auto;font-size:12.5px;color:var(--green-dark);font-weight:650;font-variant-numeric:tabular-nums">${tx('{n} gewählt', { n: picked.length })}</span>`
    : `<span style="margin-left:auto;font-size:12.5px;color:var(--muted);font-weight:600">${tx('noch {n} wählen', { n: 2 - picked.length })}</span>`;

  // Die eigenen Interessen stehen unter den sechs Feldern, damit man sieht, was man
  // ausgesucht hat, ohne das Feld von unten noch einmal zu öffnen.
  const chips = gewaehltTiefer.length
    ? `<div style="display:flex;flex-wrap:wrap;gap:7px;padding-top:2px">${gewaehltTiefer.map((label) => `<button data-act="onb-int" data-name="${esc(label)}" style="display:flex;align-items:center;gap:6px;padding:7px 11px;border-radius:999px;border:1.5px solid var(--green-a35);background:var(--green-tint);cursor:pointer;appearance:none;font-family:${FONT}">
<span style="pointer-events:none;display:flex">${interestIcon(label, 'var(--green-dark)', 14)}</span>
<span style="font-size:12.5px;font-weight:650;color:var(--green-dark);pointer-events:none">${esc(wort(label))}</span>
<span style="pointer-events:none;display:flex">${cross('var(--green-dark)', 11, 2.4)}</span></button>`).join('')}</div>`
    : '';

  const html = screenScaffold({
    header: onbHeader(ctx, counter),
    scrollKey: 'onb-interests',
    overlays: tieferSheet,
    bottomInset: 116,
    body: `<div style="display:flex;flex-direction:column;padding:12px 24px 0;gap:14px">
${onbTitle(tx('Was machst du gern?'))}
${felder}
${chips}
<div style="background:var(--surface);border-radius:20px;border:1px solid var(--ink-a07);padding:4px 16px;display:flex;flex-direction:column">
${moreRow}
</div>
</div>`,
    bottom: `${bottomFade(24)}${bottomBar(`<div style="padding:0 24px 34px;background:var(--paper)">${onbPrimary('onb-int-next', tx('Weiter'), ready)}</div>`)}`,
  });

  return { html, bind: bindOnboardingInterests };
}

function bindOnboardingInterests(root, ctx) {
  const { repo, nav, ui, params } = ctx;
  if (!ui.picked) ui.picked = [];
  if (!ui.custom) ui.custom = [];

  // v6 A21e: Ein eigenes Interesse landete bisher nur im Zustand — die einzige Stelle, an
  // der es dargestellt wird (die zweite Ebene), war zugeklappt, und der Zähler sprang
  // wortlos von 11 auf 12. Deshalb klappt „Weitere Interessen" jetzt beim Anlegen auf, und
  // das Eingabefeld bleibt geleert offen, damit mehrere Interessen hintereinander gehen.
  const addCustom = () => {
    const input = root.querySelector('#onb-int-new');
    const value = (input?.value || '').trim();
    if (!value) { ctx.toast(tx('Bitte ein Interesse eingeben')); return; }
    if (!ui.custom.includes(value) && !ONBOARDING_INTERESTS.includes(value)) ui.custom = [value, ...ui.custom];
    if (!ui.picked.includes(value)) ui.picked = [...ui.picked, value];
    ui.moreOpen = true;
    ui.offeneKat = 'Eigene';
    // Der Wert steht nur im DOM, nicht im Markup — er muss ausdrücklich geleert werden.
    if (input) input.value = '';
    ctx.render();
    ctx.toast(tx('„{name}" hinzugefügt', { name: value }));
    root.querySelector('#onb-int-new')?.focus();
  };
  root.querySelector('#onb-int-new')?.addEventListener('keydown', (event) => {
    if (event.key === 'Enter') addCustom();
  });

  bindActions(root, {
    'onb-more': () => { ui.moreOpen = true; ctx.render(); },
    'onb-more-close': () => { ui.moreOpen = false; ctx.render(); },
    // §1.5: Es ist immer höchstens EIN Oberbegriff offen.
    'onb-kat': (data) => { ui.offeneKat = ui.offeneKat === data.kat ? null : data.kat; ctx.render(); },
    'onb-int-add': addCustom,
    'onb-int': (data) => {
      ui.picked = ui.picked.includes(data.name)
        ? ui.picked.filter((entry) => entry !== data.name)
        : [...ui.picked, data.name];
      ctx.render();
    },
    // v4 P7-2: kein Mindestwert. Ohne Auswahl bleibt der bisherige Bestand unangetastet,
    // statt ihn mit einer leeren Liste zu überschreiben.
    'onb-int-next': () => {
      // v7 A34a: zusaetzlicher Schutz gegen Tastatur-/Doppelereignisse.
      if (ui.picked.length < 2) { ctx.toast(tx('Bitte mindestens zwei Interessen wählen')); return; }
      if (ui.picked.length) {
        const levels = {};
        for (const label of ui.picked) levels[label] = 1;
        repo.updateSettings({ interests: [...ui.picked], interestLevels: levels });
      }
      const target = repo.getSettings().pendingInvite ? 'onboarding.invite' : 'onboarding.start';
      nav.go(target, { name: params.name || '' });
    },
  });
}

// --- 09.3 Mit Einladung / 09.4 Ohne Einladung --------------------------------

function onbCard(innerHtml) {
  return `<div style="background:var(--surface);border:1px solid var(--ink-a09);border-radius:22px;padding:18px;display:flex;flex-direction:column;gap:14px;box-shadow:0 2px 8px var(--shadow-05);flex:none">${innerHtml}</div>`;
}

function inviteCrewCard(ctx, crew, inviterId) {
  // Wer eingeladen hat, steht vorn im Stapel.
  const ids = (crew.memberIds || []).filter((id) => id !== ME);
  const ordered = inviterId && ids.includes(inviterId) ? [inviterId, ...ids.filter((id) => id !== inviterId)] : ids;
  const others = ordered.map((id) => ctx.repo.getPerson(id)).filter(Boolean);
  const shown = others.slice(0, 2);
  const rest = (crew.memberIds || []).length - shown.length;
  const avatar = (person, index) => stackAvatar(person, { size: 38, fontSize: 14, first: index === 0, marker: stackMarker(ctx.repo, person) });
  const more = stackMore(rest, 38);
  return onbCard(`<div style="display:flex;align-items:center;gap:12px">
<div style="display:flex;align-items:center;gap:8px;flex:none">${gruppenKreis(crew, 44, 17)}<div style="display:flex;flex:none;transform:scale(.62);transform-origin:left center;margin-right:-14px">${shown.map(avatar).join('')}${more}</div></div>
<div style="display:flex;flex-direction:column;gap:2px;flex:1;min-width:0"><span style="font-size:17px;font-weight:650;letter-spacing:-.01em;white-space:nowrap;overflow:hidden;text-overflow:ellipsis">${esc(crew.name)}</span><span style="font-size:12.5px;color:var(--muted)">${tnx((crew.memberIds || []).length, '{n} Mitglied', '{n} Mitglieder')}</span></div>
</div>
<button data-act="onb-to-crew" data-crew="${crew.id}" style="border:0;background:var(--green);color:var(--on-accent);font:650 14.5px/1 ${FONT};padding:15px 0;border-radius:999px;width:100%;text-align:center;cursor:pointer;appearance:none">${tx('Zur Crew')}</button>`);
}

function inviteMeetCard(ctx, meet) {
  const meta = `${onbShortDate(meet.date)} · ${esc(meet.time || tx('Zeit offen'))} · ${esc(meet.place?.name || tx('Ort offen'))}`;
  return onbCard(`<div style="display:flex;align-items:center;gap:12px">
<span style="width:40px;height:40px;border-radius:12px;background:var(--paper);display:flex;align-items:center;justify-content:center;flex:none">${activityIconSvg(meet, 'var(--ink)', 19)}</span>
<div style="display:flex;flex-direction:column;gap:2px;flex:1;min-width:0"><span style="font-size:17px;font-weight:650;letter-spacing:-.01em;white-space:nowrap;overflow:hidden;text-overflow:ellipsis">${esc(meet.title)}</span><span style="font-size:12.5px;color:var(--muted);font-variant-numeric:tabular-nums;white-space:nowrap;overflow:hidden;text-overflow:ellipsis">${meta}</span></div>
</div>
<div style="display:flex;gap:8px">
<button data-act="onb-meet-yes" data-meet="${meet.id}" style="flex:1;border:0;background:var(--green);color:var(--on-accent);font:650 14.5px/1 ${FONT};padding:15px 0;border-radius:999px;cursor:pointer;appearance:none">${tx('Dabei')}</button>
<button data-act="onb-meet-later" data-meet="${meet.id}" style="flex:1;border:1.5px solid var(--ink-a14);background:transparent;color:var(--ink-soft);font:650 14.5px/1 ${FONT};padding:14px 0;border-radius:999px;cursor:pointer;appearance:none">${tx('Später')}</button>
</div>`);
}

function onbStartBody() {
  const option = (act, iconHtml, bg, title, sub) => `<button data-act="${act}" style="background:var(--surface);border:1px solid var(--ink-a09);border-radius:22px;padding:18px;display:flex;align-items:center;gap:14px;box-shadow:0 2px 8px var(--shadow-05);flex:none;width:100%;text-align:left;cursor:pointer;appearance:none;font-family:${FONT};color:var(--ink)">
<span style="width:46px;height:46px;border-radius:14px;background:${bg};display:flex;align-items:center;justify-content:center;flex:none">${iconHtml}</span>
<div style="display:flex;flex-direction:column;gap:3px;flex:1;min-width:0;pointer-events:none"><span style="font-size:17px;font-weight:650;letter-spacing:-.01em">${esc(title)}</span><span style="font-size:12.5px;color:var(--muted);line-height:1.4">${esc(sub)}</span></div>
${svgOnbChevron}</button>`;

  return `<div style="display:flex;flex-direction:column;padding:24px 24px 0;gap:18px">
<div style="display:flex;flex-direction:column;gap:6px;flex:none">
${onbTitle(tx('Womit fängst du an?'))}
<span style="font-size:14px;color:var(--ink-soft);line-height:1.5">${tx('Beides dauert unter einer Minute.')}</span>
</div>
${option('onb-add-friend', svgFriendPlus, 'var(--paper)', tx('Freund hinzufügen'), tx('Code scannen oder Link teilen'))}
</div>`;
}

// Onboarding-Ziele als eigener Scaffold: ein Inhaltskörper, Textaktion in der Bottom-Ebene.
function onbTargetScaffold(body, textAct, textLabel, scrollKey) {
  return screenScaffold({
    scrollKey,
    headerFade: false,
    bottomInset: 96,
    body,
    bottom: `${bottomFade(24)}${bottomBar(`<div style="background:var(--paper)">${onbTextButton(textAct, textLabel)}</div>`)}`,
  });
}

function renderOnboardingInvite(ctx) {
  const { repo } = ctx;
  const invite = repo.getSettings().pendingInvite;
  const crew = invite?.crewId ? repo.getCrew(invite.crewId) : null;
  const meet = invite?.meetId ? repo.getMeet(invite.meetId) : null;

  // Ohne Einladung greift derselbe Startpunkt wie 09.4.
  if (!crew && !meet) {
    return { html: onbTargetScaffold(onbStartBody(), 'onb-skip', tx('Später — direkt zu Crew'), 'onb-start'), bind: bindOnboardingTarget };
  }

  const body = `<div style="display:flex;flex-direction:column;padding:24px 24px 0;gap:18px">
<div style="display:flex;flex-direction:column;gap:6px;flex:none">
${onbTitle(tx('Du bist eingeladen'))}
<span style="font-size:14px;color:var(--ink-soft);line-height:1.5">${invite.byName ? tx('{name} hat dich zu Crew geholt.', { name: esc(invite.byName) }) : tx('Ein Freund hat dich zu Crew geholt.')}</span>
</div>
${crew ? inviteCrewCard(ctx, crew, invite.byId) : ''}
${meet ? inviteMeetCard(ctx, meet) : ''}
</div>`;

  return { html: onbTargetScaffold(body, 'onb-skip', tx('Erstmal umsehen'), 'onb-invite'), bind: bindOnboardingTarget };
}

function renderOnboardingStart() {
  return { html: onbTargetScaffold(onbStartBody(), 'onb-skip', tx('Später — direkt zu Crew'), 'onb-start'), bind: bindOnboardingTarget };
}

function bindOnboardingTarget(root, ctx) {
  const { repo, nav } = ctx;
  bindActions(root, {
    'onb-to-crew': (data) => {
      finishOnboarding(ctx);
      nav.resetTo('room.view', { roomId: roomIdForCrew(data.crew) });
    },
    'onb-meet-yes': (data) => {
      repo.setParticipation(data.meet, 'yes');
      finishOnboarding(ctx);
      nav.setTab('crew');
    },
    'onb-meet-later': (data) => {
      repo.setParticipation(data.meet, 'open');
      finishOnboarding(ctx);
      nav.setTab('crew');
    },
    'onb-add-friend': () => { finishOnboarding(ctx); nav.resetTo('profile.friendAdd'); },
    'onb-skip': () => { finishOnboarding(ctx); nav.setTab('crew'); },
  });
}

// ============================================================================
// Export
// ============================================================================

export const profileScreens = {
  'profile.home': renderProfileHome,
  'profile.myMeets': renderMyMeets,
  'profile.friendAdd': renderFriendAdd,
  'profile.settings': renderSettings,
  'profile.gelernt': renderGelernt,
  'profile.visibility': renderVisibility,
  'profile.location': renderLocation,
  'profile.account': renderAccount,
  'profile.appearance': renderAppearance,
  'profile.sprache': renderSprache,
  'profile.notifications': renderNotifications,
  'profile.freiReset': renderFreiReset,
  'profile.friends': renderFriends,
  'profile.friendRequests': renderFriendRequests,
  'onboarding.welcome': renderOnboardingWelcome,
  'onboarding.name': renderOnboardingName,
  'onboarding.interests': renderOnboardingInterests,
  'onboarding.invite': renderOnboardingInvite,
  'onboarding.start': renderOnboardingStart,
};
