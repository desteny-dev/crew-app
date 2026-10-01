// Profilbild-Motive: Flaggen (Runde 3). Einfache Formen, keine Wappen, keine Schrift — eine
// sanft wehende Fahne als Plakette auf dem Hintergrund. Zeichensprache: web/ui/profilbild-stil.js.
//
// Jede Flagge wird FLACH gedacht (u quer 0…b, v hoch 0…h) und dann auf das wehende Tuch gelegt:
// Jeder Punkt rutscht um die Welle an seiner Stelle nach oben oder unten. Waagrechte Kanten werden
// dabei exakt zu denselben weichen Bögen wie der Umriss, senkrechte bleiben senkrecht, schräge
// (Union Jack, Dreiecke, Raute) werden fein unterteilt. So liegen Kreuze, Felder und Zeichen
// sauber im Umriss und wehen mit.

import { t } from '../core/sprache.js';
import { DUNKEL, WEISS } from './profilbild-stil.js';

const f2 = (n) => +n.toFixed(2);

// Ein Tuch: Breite b, Höhe h, mittig im 96er-Raster. `welle` ist der Ausschlag des Bogen-
// Kontrollpunkts — sichtbar hebt und senkt sich die Kante um die Hälfte davon.
export function tuch(b = 68, h = 42, welle = b * 4.6 / 64) {
  const x0 = 48 - b / 2;
  const y0 = 48 - h / 2;
  const halb = b / 2;
  const mitte = x0 + halb;
  // Versatz an der Weltstelle x: vordere Hälfte hebt sich, hintere senkt sich.
  const off = (x) => {
    const s = (x - x0) / halb;
    return s <= 1 ? -2 * welle * s * (1 - s) : 2 * welle * (s - 1) * (2 - s);
  };
  const steigung = (x) => {
    const s = (x - x0) / halb;
    return (s <= 1 ? -2 * welle * (1 - 2 * s) : 2 * welle * (3 - 2 * s)) / halb;
  };
  const P = (u, v) => [x0 + u, y0 + v + off(x0 + u)];
  // Waagrechte Kante von Weltstelle xa nach xb auf flacher Höhe yv — exakt als Q-Bögen.
  const kante = (xa, xb, yv) => {
    const teile = (xa - mitte) * (xb - mitte) < 0 ? [xa, mitte, xb] : [xa, xb];
    let d = '';
    for (let i = 1; i < teile.length; i++) {
      const a = teile[i - 1];
      const e = teile[i];
      const m = (a + e) / 2;
      const ya = yv + off(a);
      const ye = yv + off(e);
      const cy = 2 * (yv + off(m)) - (ya + ye) / 2;
      d += `Q${f2(m)} ${f2(cy)} ${f2(e)} ${f2(ye)}`;
    }
    return d;
  };
  // Vieleck in flachen Koordinaten → Pfad auf dem wehenden Tuch.
  const pfad = (punkte) => {
    let d = '';
    punkte.forEach(([u, v], i) => {
      if (i === 0) { const [x, y] = P(u, v); d += `M${f2(x)} ${f2(y)}`; }
      const [u2, v2] = punkte[(i + 1) % punkte.length];
      if (Math.abs(v2 - v) < 1e-6) d += kante(x0 + u, x0 + u2, y0 + v);
      else if (Math.abs(u2 - u) < 1e-6) { const [x, y] = P(u2, v2); d += `L${f2(x)} ${f2(y)}`; }
      else {
        const schritte = Math.max(2, Math.ceil(Math.hypot(u2 - u, v2 - v) / 3));
        for (let s = 1; s <= schritte; s++) {
          const [x, y] = P(u + ((u2 - u) * s) / schritte, v + ((v2 - v) * s) / schritte);
          d += `L${f2(x)} ${f2(y)}`;
        }
      }
    });
    return `${d}Z`;
  };
  const flaeche = (punkte, farbe) => `<path d="${pfad(punkte)}" fill="${farbe}"/>`;
  const rechteck = (u, v, w, hh, farbe) => flaeche([[u, v], [u + w, v], [u + w, v + hh], [u, v + hh]], farbe);
  const kreis = (u, v, r, farbe) => { const [x, y] = P(u, v); return `<circle cx="${f2(x)}" cy="${f2(y)}" r="${f2(r)}" fill="${farbe}"/>`; };
  // Beliebige Zeichnung um (0|0) an die Stelle (u|v) legen — sie schert mit dem Tuch.
  const an = (u, v, inhalt) => {
    const [x, y] = P(u, v);
    const winkel = (Math.atan(steigung(x)) * 180) / Math.PI;
    return `<g transform="translate(${f2(x)} ${f2(y)}) skewY(${f2(winkel)})">${inhalt}</g>`;
  };
  return { b, h, x0, y0, P, pfad, flaeche, rechteck, kreis, an, umriss: pfad([[0, 0], [b, 0], [b, h], [0, h]]) };
}

const STANDARD = tuch();

// Stoff-Licht: vorn eine Spur heller, in der Mulde eine Spur dunkler — wie ein Tuch im Wind.
const licht = (id, T) => `<linearGradient id="${id}" gradientUnits="userSpaceOnUse" x1="${T.x0}" y1="0" x2="${T.x0 + T.b}" y2="0"><stop offset="0" stop-color="#fff" stop-opacity=".16"/><stop offset=".3" stop-color="#fff" stop-opacity="0"/><stop offset=".62" stop-color="#000" stop-opacity=".1"/><stop offset=".8" stop-color="#000" stop-opacity="0"/><stop offset="1" stop-color="#fff" stop-opacity=".08"/></linearGradient>`;

// Fahne: Inhalt im Umriss beschnitten, darüber das Stoff-Licht. Die IDs tragen den Schlüssel.
export function flagge(inhalt, { key = 'x', T = STANDARD, defs = '' } = {}) {
  return `<defs><clipPath id="fc-${key}"><path d="${T.umriss}"/></clipPath>${licht(`fl-${key}`, T)}${defs}</defs>
<g clip-path="url(#fc-${key})">${inhalt}<rect x="0" y="0" width="96" height="96" fill="url(#fl-${key})"/></g>`;
}

// Streifen: Die erste Farbe liegt als ganze Fläche darunter, jede weitere reicht bis über den
// Rand — so blitzt zwischen zwei Streifen nie der Hintergrund durch.
const RAND = 3;
const baender = (T, farben, anteile = farben.map(() => 1)) => {
  const summe = anteile.reduce((a, e) => a + e, 0);
  let lauf = 0;
  return farben.map((farbe, i) => {
    const von = (T.h * lauf) / summe;
    lauf += anteile[i];
    return i === 0 ? T.rechteck(-RAND, -RAND, T.b + 2 * RAND, T.h + 2 * RAND, farbe) : T.rechteck(-RAND, von, T.b + 2 * RAND, T.h - von + RAND, farbe);
  }).join('');
};
const spalten = (T, farben) => farben.map((farbe, i) => {
  const von = i === 0 ? -RAND : (T.b * i) / farben.length;
  return T.rechteck(von, -RAND, T.b - von + RAND, T.h + 2 * RAND, farbe);
}).join('');

export const waagrecht = (farben, key = 'w') => flagge(baender(STANDARD, farben), { key });
export const senkrecht = (farben, key = 's') => flagge(spalten(STANDARD, farben), { key });

// Fünfzackiger Stern um (0|0), eine Spitze zeigt in Richtung `drehung` (Grad, 0 = oben).
function stern(r, farbe, drehung = 0, innen = 0.42) {
  let d = '';
  for (let i = 0; i < 10; i++) {
    const w = ((drehung + i * 36) * Math.PI) / 180;
    const rr = i % 2 ? r * innen : r;
    d += `${i ? 'L' : 'M'}${f2(Math.sin(w) * rr)} ${f2(-Math.cos(w) * rr)}`;
  }
  return `<path d="${d}Z" fill="${farbe}"/>`;
}

// Skandinavisches Kreuz: senkrechter Balken bei `u` (linke Kante), waagrechter bei `v`, Breite `d`.
const kreuz = (T, u, v, d, farbe) => T.rechteck(-RAND, v, T.b + 2 * RAND, d, farbe) + T.rechteck(u, -RAND, d, T.h + 2 * RAND, farbe);

// Farben — nah an den amtlichen Tönen, eine Spur ruhiger.
const ROT = '#C8102E';

function schweiz() {
  const T = tuch(48, 48);
  const e = T.b / 32; // amtlich: Kreuzarme 6 breit, je 7 lang, im 32er-Quadrat
  const m = T.b / 2;
  return flagge(T.rechteck(-RAND, -RAND, T.b + 2 * RAND, T.h + 2 * RAND, '#D52B1E')
    + T.rechteck(m - 10 * e, m - 3 * e, 20 * e, 6 * e, WEISS)
    + T.rechteck(m - 3 * e, m - 10 * e, 6 * e, 20 * e, WEISS), { key: 'ch', T });
}

function unionJack() {
  const T = STANDARD;
  const { b, h } = T;
  const g = h / 30; // amtlich 30 hoch: Andreaskreuz weiß 6, rot 2 (versetzt), Georgskreuz 10/6
  const lang = 6;
  const band = (A, B, o1, o2, farbe) => {
    const L = Math.hypot(B[0] - A[0], B[1] - A[1]);
    const d = [(B[0] - A[0]) / L, (B[1] - A[1]) / L];
    const n = [-d[1], d[0]];
    const p = (Q, s, o) => [Q[0] + d[0] * s + n[0] * o, Q[1] + d[1] * s + n[1] * o];
    return T.flaeche([p(A, -lang, o1), p(B, lang, o1), p(B, lang, o2), p(A, -lang, o2)], farbe);
  };
  const M = [b / 2, h / 2];
  // Rote Diagonale je Viertel: an der Stange liegt das breite Weiß oben (Windrad-Anordnung).
  const arm = (ecke, ziel) => {
    const L = Math.hypot(M[0] - ecke[0], M[1] - ecke[1]);
    const n = [-(M[1] - ecke[1]) / L, (M[0] - ecke[0]) / L];
    const seite = Math.sign((ziel[0] - ecke[0]) * n[0] + (ziel[1] - ecke[1]) * n[1]) || 1;
    return band(ecke, M, 0, 2 * g * seite, ROT);
  };
  return flagge(
    T.rechteck(-RAND, -RAND, b + 2 * RAND, h + 2 * RAND, '#012169')
    + band([0, 0], [b, h], -3 * g, 3 * g, WEISS)
    + band([0, h], [b, 0], -3 * g, 3 * g, WEISS)
    + arm([0, 0], [0, h / 2])
    + arm([0, h], [b / 2, h])
    + arm([b, h], [b, h / 2])
    + arm([b, 0], [b / 2, 0])
    + T.rechteck(-RAND, h / 2 - 5 * g, b + 2 * RAND, 10 * g, WEISS)
    + T.rechteck(b / 2 - 5 * g, -RAND, 10 * g, h + 2 * RAND, WEISS)
    + T.rechteck(-RAND, h / 2 - 3 * g, b + 2 * RAND, 6 * g, ROT)
    + T.rechteck(b / 2 - 3 * g, -RAND, 6 * g, h + 2 * RAND, ROT),
    { key: 'gb' },
  );
}

function usa() {
  const T = STANDARD;
  const { b, h } = T;
  const s = h / 13;
  let streifen = T.rechteck(-RAND, -RAND, b + 2 * RAND, h + 2 * RAND, WEISS);
  for (let i = 0; i < 13; i += 2) streifen += T.rechteck(-RAND, i === 0 ? -RAND : i * s, b + 2 * RAND, i === 0 ? s + RAND : i === 12 ? s + RAND : s, '#B22234');
  const bw = b * 0.4;
  const bh = 7 * s;
  let punkte = '';
  const reihen = 5;
  for (let r = 0; r < reihen; r++) {
    const anzahl = r % 2 ? 4 : 5;
    for (let c = 0; c < anzahl; c++) {
      const u = (bw / 5) * (c + (r % 2 ? 1 : 0.5));
      const v = (bh / reihen) * (r + 0.5);
      punkte += T.kreis(u, v, 1.15, WEISS);
    }
  }
  return flagge(streifen + T.rechteck(-RAND, -RAND, bw + RAND, bh + RAND, '#3C3B6E') + punkte, { key: 'us' });
}

function tschechien() {
  const T = STANDARD;
  const { b, h } = T;
  const k = h / b;
  return flagge(baender(T, [WEISS, '#D7141A']) + T.flaeche([[-RAND, -RAND * k], [b / 2, h / 2], [-RAND, h + RAND * k]], '#11457E'), { key: 'cz' });
}

function kroatien() {
  const T = STANDARD;
  const { b, h } = T;
  const q = 3.2;             // Kantenlänge eines Feldes
  const w = 5 * q;
  const u0 = b / 2 - w / 2;
  const v0 = h / 2 - 2.6 * q; // Schild beginnt knapp über dem weißen Band
  // Schild: oben gerade, unten ein runder Bogen (als Vieleck, damit er mitweht).
  const umriss = [[u0, v0], [u0 + w, v0], [u0 + w, v0 + 3.6 * q]];
  for (let i = 1; i < 12; i++) {
    const a = (Math.PI * i) / 12;
    umriss.push([u0 + w / 2 + (w / 2) * Math.cos(a), v0 + 3.6 * q + 1.55 * q * Math.sin(a)]);
  }
  umriss.push([u0, v0 + 3.6 * q]);
  let felder = '';
  for (let r = 0; r < 5; r++) for (let c = 0; c < 5; c++) if ((r + c) % 2 === 0) felder += T.rechteck(u0 + c * q - (c === 0 ? 1 : 0), v0 + r * q - (r === 0 ? 1 : 0), q + (c === 0 || c === 4 ? 1 : 0), q + (r === 0 || r === 4 ? 1.5 : 0), '#D8232A');
  return flagge(
    `${baender(T, ['#D8232A', WEISS, '#1B3C8F'])}${T.flaeche(umriss, WEISS)}<g clip-path="url(#fk-hr)">${felder}</g>`,
    { key: 'hr', defs: `<clipPath id="fk-hr"><path d="${T.pfad(umriss)}"/></clipPath>` },
  );
}

function bosnien() {
  const T = STANDARD;
  const { b, h } = T;
  const rechts = b - 0.36 * h;       // senkrechte Kathete des gelben Dreiecks
  const links = rechts - h;          // gleichschenklig-rechtwinklig, Kathete = Höhe
  let sterne = '';
  for (let i = 0; i <= 8; i++) {
    const v = (h * i) / 8;
    sterne += T.an(links + v - 6.6, v, stern(2.9, WEISS));
  }
  return flagge(T.rechteck(-RAND, -RAND, b + 2 * RAND, h + 2 * RAND, '#1F3F95')
    + T.flaeche([[links - RAND, -RAND], [rechts, -RAND], [rechts, h + RAND]], '#F5C400') + sterne, { key: 'ba' });
}

function tuerkei() {
  const T = STANDARD;
  const { b, h } = T;
  // amtlich (G = Höhe): Mond außen Ø 1/2 G bei 1/2 G, innen Ø 2/5 G um 1/16 G versetzt,
  // Stern im Kreis Ø 1/4 G, eine Spitze zeigt zum Mond.
  const rot = '#E30A17';
  return flagge(T.rechteck(-RAND, -RAND, b + 2 * RAND, h + 2 * RAND, rot)
    + T.kreis(0.5 * h, h / 2, 0.25 * h, WEISS)
    + T.kreis(0.5625 * h, h / 2, 0.2 * h, rot)
    + T.an(0.8208 * h, h / 2, stern(0.125 * h, WEISS, -90, 0.4)), { key: 'tr' });
}

function griechenland() {
  const T = STANDARD;
  const { b, h } = T;
  const s = h / 9;
  let flaechen = T.rechteck(-RAND, -RAND, b + 2 * RAND, h + 2 * RAND, WEISS);
  for (let i = 0; i < 9; i += 2) flaechen += T.rechteck(-RAND, i === 0 ? -RAND : i * s, b + 2 * RAND, i === 0 || i === 8 ? s + RAND : s, '#0D5EAF');
  flaechen += T.rechteck(-RAND, -RAND, 5 * s + RAND, 5 * s + RAND, '#0D5EAF');
  flaechen += T.rechteck(-RAND, 2 * s, 5 * s + RAND, s, WEISS) + T.rechteck(2 * s, -RAND, s, 5 * s + RAND, WEISS);
  return flagge(flaechen, { key: 'gr' });
}

// Skandinavien: Die Stangenseite behält die amtlichen Einheiten (Felder dort fast quadratisch),
// die längere Flugseite nimmt den Rest.
function nordisch(key, grund, kreuze) {
  const T = STANDARD;
  return flagge(T.rechteck(-RAND, -RAND, T.b + 2 * RAND, T.h + 2 * RAND, grund) + kreuze(T), { key });
}

function portugal() {
  const T = STANDARD;
  const { b, h } = T;
  const u = 0.4 * b;
  const v = h / 2;
  const r = 0.235 * h;
  // Armillarsphäre als gelber Ring, davor das Schild: rot, innen weiß.
  const schild = (w, hh, farbe) => `<path d="M${-w} ${-hh}H${w}V${f2(hh * 0.25)}Q${w} ${hh} 0 ${hh}Q${-w} ${hh} ${-w} ${f2(hh * 0.25)}Z" fill="${farbe}"/>`;
  return flagge(T.rechteck(-RAND, -RAND, b + 2 * RAND, h + 2 * RAND, '#DA291C')
    + T.rechteck(-RAND, -RAND, u + RAND, h + 2 * RAND, '#046A38')
    + T.an(u, v, `<circle r="${f2(r)}" fill="none" stroke="#F2C230" stroke-width="3.2"/>${schild(6, 7, '#DA291C')}${schild(4.1, 5, WEISS)}<circle cy="-0.8" r="1.5" fill="#1F3F95"/>`), { key: 'pt' });
}

function brasilien() {
  const T = STANDARD;
  const { b, h } = T;
  const m = (1.7 / 14) * h;
  return flagge(T.rechteck(-RAND, -RAND, b + 2 * RAND, h + 2 * RAND, '#009B3A')
    + T.flaeche([[m, h / 2], [b / 2, m], [b - m, h / 2], [b / 2, h - m]], '#FEDD00')
    + T.kreis(b / 2, h / 2, (3.5 / 14) * h, '#1E3A8A'), { key: 'br' });
}

function japan() {
  const T = STANDARD;
  return flagge(T.rechteck(-RAND, -RAND, T.b + 2 * RAND, T.h + 2 * RAND, WEISS) + T.kreis(T.b / 2, T.h / 2, 0.3 * T.h, '#BC002D'), { key: 'jp' });
}

// Ahornblatt, vereinfacht aus dem amtlichen 11-Spitzen-Blatt; rechte Hälfte, oben = Spitze.
const AHORN = [[0, -1.92], [0.36, -1.26], [0.72, -1.44], [0.56, -0.37], [1.02, -0.8], [1.15, -0.54], [1.72, -0.64], [1.55, -0.04], [1.77, 0.09], [0.83, 0.87], [0.93, 1.22], [0.14, 1.08], [0.13, 2.03]];
function ahorn(hoehe, farbe) {
  const s = hoehe / 3.95;
  const rechts = AHORN.map(([x, y]) => [x * s, (y - 0.055) * s]);
  const links = rechts.slice().reverse().map(([x, y]) => [-x, y]);
  return `<path d="M${[...rechts, ...links].map(([x, y]) => `${f2(x)} ${f2(y)}`).join('L')}Z" fill="${farbe}"/>`;
}

function kanada() {
  const T = STANDARD;
  const { b, h } = T;
  const rot = '#D52B1E';
  return flagge(T.rechteck(-RAND, -RAND, b + 2 * RAND, h + 2 * RAND, rot)
    + T.rechteck(b / 4, -RAND, b / 2, h + 2 * RAND, WEISS)
    + T.an(b / 2, h / 2, ahorn(0.78 * h, rot)), { key: 'ca' });
}

function europa() {
  const T = STANDARD;
  const { b, h } = T;
  let sterne = '';
  for (let i = 0; i < 12; i++) {
    const w = (i * Math.PI) / 6;
    sterne += T.an(b / 2 + Math.sin(w) * (h / 3), h / 2 - Math.cos(w) * (h / 3), stern(3.2, '#FFCC00', 0, 0.45));
  }
  return flagge(T.rechteck(-RAND, -RAND, b + 2 * RAND, h + 2 * RAND, '#1F3C99') + sterne, { key: 'eu' });
}

function zielflagge() {
  const T = STANDARD;
  const { b, h } = T;
  const reihen = 6;
  const spaltenZahl = 10;
  const qh = h / reihen;
  const qb = b / spaltenZahl;
  let felder = T.rechteck(-RAND, -RAND, b + 2 * RAND, h + 2 * RAND, WEISS);
  for (let r = 0; r < reihen; r++) {
    for (let c = 0; c < spaltenZahl; c++) {
      if ((r + c) % 2) continue;
      const u = c === 0 ? -RAND : c * qb;
      const v = r === 0 ? -RAND : r * qh;
      felder += T.rechteck(u, v, (c + 1) * qb - u + (c === spaltenZahl - 1 ? RAND : 0), (r + 1) * qh - v + (r === reihen - 1 ? RAND : 0), DUNKEL);
    }
  }
  return flagge(felder, { key: 'zf' });
}

const F = (name, zeichnung, extra = {}) => ({ name, zeichnung, skala: 0.93, y: 48, ...extra });

export const FLAGGEN = {
  at: F(t('Österreich'), () => waagrecht(['#C8102E', WEISS, '#C8102E'], 'at')),
  de: F(t('Deutschland'), () => waagrecht([DUNKEL, '#DA1F26', '#F5C21B'], 'de')),
  ch: F(t('Schweiz'), schweiz),
  it: F(t('Italien'), () => senkrecht(['#0E8A4A', WEISS, '#D12D36'], 'it')),
  fr: F(t('Frankreich'), () => senkrecht(['#1D3C91', WEISS, '#E1242F'], 'fr')),
  es: F(t('Spanien'), () => flagge(baender(STANDARD, ['#C60B1E', '#FFC400', '#C60B1E'], [1, 2, 1]), { key: 'es' })),
  gb: F(t('Großbritannien'), unionJack),
  us: F(t('USA'), usa),
  nl: F(t('Niederlande'), () => waagrecht(['#AE1C28', WEISS, '#21468B'], 'nl')),
  be: F(t('Belgien'), () => senkrecht([DUNKEL, '#F9D02C', '#E8313E'], 'be')),
  pl: F(t('Polen'), () => waagrecht([WEISS, '#D4213D'], 'pl')),
  cz: F(t('Tschechien'), tschechien),
  hu: F(t('Ungarn'), () => waagrecht(['#CD2A3E', WEISS, '#477050'], 'hu')),
  hr: F(t('Kroatien'), kroatien),
  rs: F(t('Serbien'), () => waagrecht(['#C6363C', '#0C4076', WEISS], 'rs')),
  ba: F(t('Bosnien und Herzegowina'), bosnien),
  tr: F(t('Türkei'), tuerkei),
  gr: F(t('Griechenland'), griechenland),
  se: F(t('Schweden'), () => nordisch('se', '#006AA7', (T) => kreuz(T, 0.5 * T.h, 0.4 * T.h, 0.2 * T.h, '#FECC00'))),
  no: F(t('Norwegen'), () => nordisch('no', '#BA0C2F', (T) => kreuz(T, (6 / 16) * T.h, (6 / 16) * T.h, (4 / 16) * T.h, WEISS) + kreuz(T, (7 / 16) * T.h, (7 / 16) * T.h, (2 / 16) * T.h, '#00205B'))),
  dk: F(t('Dänemark'), () => nordisch('dk', '#C8102E', (T) => kreuz(T, (12 / 28) * T.h, (12 / 28) * T.h, (4 / 28) * T.h, WEISS))),
  fi: F(t('Finnland'), () => nordisch('fi', WEISS, (T) => kreuz(T, (5 / 11) * T.h, (4 / 11) * T.h, (3 / 11) * T.h, '#0F3F82'))),
  ie: F(t('Irland'), () => senkrecht(['#169B62', WEISS, '#F28C38'], 'ie')),
  pt: F(t('Portugal'), portugal),
  ua: F(t('Ukraine'), () => waagrecht(['#0057B7', '#FFD500'], 'ua')),
  br: F(t('Brasilien'), brasilien),
  jp: F(t('Japan'), japan),
  ca: F(t('Kanada'), kanada),
  eu: F(t('Europa'), europa),
  regenbogen: F(t('Regenbogen'), () => waagrecht(['#D93A35', '#EE8A2A', '#F2CB3A', '#2F9A55', '#2F66B8', '#7B3F98'], 'rb')),
  zielflagge: F(t('Zielflagge'), zielflagge),
};
