// Profilbild-Motive: Tiere (Runde 3). Zeichensprache: web/ui/profilbild-stil.js.
// Jedes Tier: zeichnung(ausdruck) im 96er-Raster, facette: true (rechte Hälfte dunkler).
// Runde 5 (B2): anatomie — was das Tier im Gesicht hat: 'mund' (mit Schnauze: geteilte Oberlippe,
// sonst eine Mundlinie) · 'schnabel' · 'ohne' (nichts Sichtbares). Danach richten sich die
// angebotenen Ausdrücke (ausdrueckeFuer in profilbild.js) und die Zeichnung.

import { t } from '../core/sprache.js';
import { DUNKEL, CREME, WEISS, augen, mund, schnauze } from './profilbild-stil.js';

const r2 = (n) => Math.round(n * 100) / 100;
const poly = (pts) => `M${pts.map(([x, y]) => `${r2(x)} ${r2(y)}`).join('L')}Z`;
// Symmetrische Fläche aus der linken Hälfte: Punkte von der Mittellinie oben bis unten.
const sym = (pts) => poly([...pts, ...pts.slice().reverse().filter(([x]) => x !== 48).map(([x, y]) => [96 - x, y])]);
// Linke Seite zeichnen, rechte gespiegelt dazu.
const beide = (svg) => `${svg}<g transform="matrix(-1 0 0 1 96 0)">${svg}</g>`;
// Zacken-Kranz (Mähne, Stacheln, Fell).
function stern(cx, cy, ra, ri, n, drehung = -90) {
  const pts = [];
  for (let i = 0; i < n * 2; i += 1) {
    const w = ((drehung + (180 / n) * i) * Math.PI) / 180;
    const rad = i % 2 ? ri : ra;
    pts.push([cx + Math.cos(w) * rad, cy + Math.sin(w) * rad]);
  }
  return poly(pts);
}
const nase = (y, b = 9.6, h = 5.7, farbe = DUNKEL) => `<path d="M${r2(48 - b / 2)} ${y}h${b}L48 ${r2(y + h)}Z" fill="${farbe}" stroke="${farbe}" stroke-width="1.6" stroke-linejoin="round"/>`;
// Lider nur innerhalb einer Fläche (Maske, Gesichtsscheibe) — sonst ragt ihre Farbe hinaus.
const innerhalb = (id, form, inhalt) => `<clipPath id="${id}">${form}</clipPath><g clip-path="url(#${id})">${inhalt}</g>`;
const AUGE = 3.3;

export const TIERE = {
  fuchs: {
    name: t('Fuchs'), facette: true, anatomie: 'mund',
    zeichnung: (a) => `<path d="M16 38 28 13 42 29h12l14-16 12 25-4 16-28 28-28-28Z" fill="#E8742A"/>
<path d="M28.6 21 37 30.5 28 36Z" fill="#9E4418"/><path d="M67.4 21 59 30.5 68 36Z" fill="#9E4418"/>
<path d="M17 45 40 55 48 64 48 82 20 54Z" fill="${CREME}"/><path d="M79 45 56 55 48 64 48 82 76 54Z" fill="${CREME}"/>
${augen({ l: [37, 46], r: [59, 46], gr: AUGE, haut: '#E8742A', ausdruck: a })}
<path d="M43.2 67.5h9.6L48 73.2Z" fill="${DUNKEL}" stroke="${DUNKEL}" stroke-width="1.6" stroke-linejoin="round"/>
${schnauze({ spitze: 73.4, b: 7, ausdruck: a, dicke: 2 })}`,
  },
  wolf: {
    name: t('Wolf'), facette: true, anatomie: 'mund',
    zeichnung: (a) => `<path d="${sym([[48, 27], [40, 26], [30, 12], [20, 34], [13, 50], [22, 55], [16, 64], [31, 68], [48, 84]])}" fill="#7C8691"/>
${beide('<path d="M31 19 37.5 27 25 32.5Z" fill="#4F5864"/>')}
<path d="${sym([[48, 63], [38, 57], [22, 55], [16, 64], [31, 68], [48, 84]])}" fill="${CREME}"/>
${augen({ l: [37, 46], r: [59, 46], gr: AUGE, haut: '#7C8691', ausdruck: a })}
<path d="M40 27h16L48 63Z" fill="#4F5864"/>
${nase(66.5)}
${schnauze({ spitze: 72.6, b: 9, ausdruck: a, dicke: 2.2 })}`,
  },
  loewe: {
    name: t('Löwe'), facette: true, anatomie: 'mund',
    zeichnung: (a) => `<path d="${stern(48, 49, 37.5, 30, 13)}" fill="#9A4B22" stroke="#9A4B22" stroke-width="3" stroke-linejoin="round"/>
${beide('<circle cx="31" cy="28" r="7" fill="#E7A23F"/><circle cx="31" cy="28" r="3.4" fill="#9A4B22"/>')}
<path d="M31 28Q48 21 65 28L71 50Q70 68 48 80Q26 68 25 50Z" fill="#E7A23F"/>
<path d="M35 61Q48 54 61 61Q63 73 48 78Q33 73 35 61Z" fill="${CREME}"/>
${augen({ l: [37, 45], r: [59, 45], gr: AUGE, haut: '#E7A23F', ausdruck: a })}
${nase(57.5, 11, 6)}
${schnauze({ spitze: 64, b: 9, ausdruck: a, dicke: 2.2 })}`,
  },
  tiger: {
    name: t('Tiger'), facette: true, anatomie: 'mund',
    zeichnung: (a) => `${beide(`<circle cx="27" cy="25" r="9" fill="#E9822F"/><circle cx="27" cy="25" r="4.4" fill="${DUNKEL}"/>`)}
<path d="M22 30Q30 20 48 20Q66 20 74 30L80 50L76 64Q66 80 48 84Q30 80 20 64L16 50Z" fill="#E9822F"/>
<path d="M17.5 55L34 58L48 66L62 58L78.5 55L76 64Q66 80 48 84Q30 80 20 64Z" fill="${WEISS}"/>
<path d="M43.5 20.5h9L48 34Z" fill="${DUNKEL}"/>
${beide(`<path d="M32 24.5 38 22.5 41.5 33Z" fill="${DUNKEL}"/><path d="M18.3 43 32 48 16.3 49.5Z" fill="${DUNKEL}"/><path d="M18.2 56.5 33 55.5 19.6 62.5Z" fill="${DUNKEL}"/>`)}
${augen({ l: [37, 45], r: [59, 45], gr: AUGE, haut: '#E9822F', ausdruck: a })}
${nase(63.5, 10, 6)}
${schnauze({ spitze: 70, b: 9, ausdruck: a, dicke: 2.2 })}`,
  },
  baer: {
    name: t('Bär'), facette: true, anatomie: 'mund',
    zeichnung: (a) => `${beide('<circle cx="27" cy="26" r="9.5" fill="#7A4F32"/><circle cx="27" cy="26" r="4.8" fill="#4E311E"/>')}
<path d="${sym([[48, 19], [34, 19], [21, 30], [18, 58], [32, 78], [48, 82]])}" fill="#7A4F32"/>
<path d="M36 58Q48 52 60 58L63 68Q58 79 48 79Q38 79 33 68Z" fill="#C89B6B"/>
${augen({ l: [37, 45], r: [59, 45], gr: AUGE, haut: '#7A4F32', ausdruck: a })}
${nase(58, 13, 7)}
${schnauze({ spitze: 65.5, b: 10, ausdruck: a, dicke: 2.2 })}`,
  },
  panda: {
    name: t('Panda'), facette: true, anatomie: 'mund',
    zeichnung: (a) => {
      const flecken = '<ellipse cx="36.5" cy="49.5" rx="7.4" ry="10" transform="rotate(36 36.5 49.5)"/><ellipse cx="59.5" cy="49.5" rx="7.4" ry="10" transform="rotate(-36 59.5 49.5)"/>';
      return `${beide(`<circle cx="27" cy="26" r="9.5" fill="${DUNKEL}"/>`)}
<path d="M34 20H62Q74 22 77 34L79 56Q76 76 48 82Q20 76 17 56L19 34Q22 22 34 20Z" fill="${WEISS}"/>
<g fill="${DUNKEL}">${flecken}</g>
${innerhalb('tier-panda', flecken, augen({ l: [38.5, 47.5], r: [57.5, 47.5], gr: 3, farbe: CREME, haut: DUNKEL, braue: DUNKEL, ausdruck: a }))}
${nase(61, 10, 6)}
${schnauze({ spitze: 67.4, b: 9, ausdruck: a, dicke: 2.2 })}`;
    },
  },
  eule: {
    name: t('Eule'), facette: true, anatomie: 'schnabel',
    zeichnung: (a) => {
      const scheiben = '<circle cx="36" cy="49" r="13"/><circle cx="60" cy="49" r="13"/>';
      return `<path d="M22 18L37 29L48 33L59 29L74 18L77 50Q75 76 48 85Q21 76 19 50Z" fill="#5C4736"/>
<g fill="#D9B58A">${scheiben}</g>
${innerhalb('tier-eule', scheiben, augen({ l: [36, 49], r: [60, 49], gr: 5.2, hoch: 1, farbe: '#E9A13B', haut: '#D9B58A', braue: DUNKEL, ausdruck: a, innen: ([x, y]) => `<circle cx="${x}" cy="${y}" r="3" fill="${DUNKEL}"/>` }))}
<path d="M39 31H57L48 60Z" fill="#5C4736"/>
<path d="M43.5 55h9L48 66Z" fill="#E9A13B" stroke="#E9A13B" stroke-width="1.6" stroke-linejoin="round"/>`;
    },
  },
  adler: {
    name: t('Adler'), facette: true, anatomie: 'schnabel',
    zeichnung: (a) => `<path d="M17 58L48 78L79 58L80 70Q68 86 48 88Q28 86 16 70Z" fill="#5A3D2A"/>
<path d="M26 30Q30 16 48 16Q66 16 70 30L78 54L68 60L70 70L58 66L48 76L38 66L26 70L28 60L18 54Z" fill="${WEISS}"/>
${augen({ l: [31, 42], r: [65, 42], gr: AUGE, haut: WEISS, ausdruck: a })}
<path d="M39 44H57Q61 52 58 60L51 74Q48 78 45 74L38 60Q35 52 39 44Z" fill="#EFB234"/>
<path d="M42.5 64H53.5L51 74Q48 78 45 74Z" fill="#C98A1E"/>`,
  },
  pinguin: {
    name: t('Pinguin'), facette: true, anatomie: 'schnabel',
    zeichnung: (a) => {
      const gesicht = '<path d="M21 46Q30 40 40 43L48 51L56 43Q66 40 75 46L76 60C76 73 64 82 48 82C32 82 20 73 20 60Z"/>';
      return `<path d="M48 13C67 13 79 26 79 46L79 60C79 77 66 86 48 86C30 86 17 77 17 60L17 46C17 26 29 13 48 13Z" fill="#232B38"/>
<g fill="${WEISS}">${gesicht}</g>
${innerhalb('tier-pinguin', gesicht, augen({ l: [37, 50], r: [59, 50], gr: AUGE, haut: WEISS, ausdruck: a }))}
<path d="M40.5 51H55.5L48 63.5Z" fill="#F29A30" stroke="#F29A30" stroke-width="2" stroke-linejoin="round"/>`;
    },
  },
  katze: {
    name: t('Katze'), facette: true, anatomie: 'mund',
    zeichnung: (a) => `<path d="M22 42L26 14L42 26H54L70 14L74 42L80 58Q76 76 48 82Q20 76 16 58Z" fill="#40454F"/>
${beide('<path d="M28.5 21.5 38.5 28.5 26 35Z" fill="#857880"/>')}
<path d="M39 61Q48 57 57 61L56 70Q48 78 40 70Z" fill="${CREME}"/>
${augen({ l: [37, 47], r: [59, 47], gr: AUGE, farbe: '#D8C64C', haut: '#40454F', braue: DUNKEL, ausdruck: a, innen: ([x, y]) => `<ellipse cx="${x}" cy="${y}" rx="1.25" ry="2.9" fill="${DUNKEL}"/>` })}
${nase(62, 7, 4.2)}
${schnauze({ spitze: 66.6, b: 8, ausdruck: a, dicke: 2 })}`,
  },
  hund: {
    name: t('Hund'), facette: true, anatomie: 'mund',
    zeichnung: (a) => `<path d="M30 20H66Q74 22 76 32L78 56Q74 76 48 82Q22 76 18 56L20 32Q22 22 30 20Z" fill="#CE9656"/>
<path d="M45 20H51L53 53Q58 55 62 59L64 70Q60 80 48 82Q36 80 32 70L34 59Q38 55 43 53Z" fill="${CREME}"/>
${beide('<path d="M27 20 13 38 13 60Q15 66 21 63L32 34Z" fill="#6B4228"/>')}
${augen({ l: [36, 44], r: [60, 44], gr: AUGE, haut: '#CE9656', ausdruck: a })}
${nase(59.5, 13, 7)}
${schnauze({ spitze: 67, b: 10, ausdruck: a, dicke: 2.2 })}`,
  },
  waschbaer: {
    name: t('Waschbär'), facette: true, anatomie: 'mund',
    zeichnung: (a) => {
      const maske = `<path d="${sym([[48, 47], [30, 40], [16, 47], [23, 56], [36, 58], [48, 62]])}"/>`;
      return `<path d="${sym([[48, 26], [39, 25], [30, 13], [22, 32], [14, 46], [20, 52], [15, 60], [30, 68], [48, 82]])}" fill="#8A817A"/>
${beide('<path d="M30.5 20 36 26 26 30.5Z" fill="#4A433E"/>')}
<path d="M44 26H52L49.5 46H46.5Z" fill="#4A433E"/>
<path d="${sym([[48, 44], [36, 37], [20, 44], [24, 56], [30, 68], [48, 82]])}" fill="${WEISS}"/>
<g fill="${DUNKEL}">${maske}</g>
${innerhalb('tier-waschbaer', maske, augen({ l: [37, 50], r: [59, 50], gr: AUGE, farbe: WEISS, haut: DUNKEL, braue: DUNKEL, ausdruck: a }))}
<path d="M38 62Q48 56 58 62L60 70L48 80L36 70Z" fill="${WEISS}"/>
${nase(63, 9, 5.5)}
${schnauze({ spitze: 69, b: 8, ausdruck: a, dicke: 2 })}`;
    },
  },
  koala: {
    name: t('Koala'), facette: true, anatomie: 'mund',
    zeichnung: (a) => `${beide(`<path d="${stern(24, 33, 13, 10.5, 9)}" fill="#8E959D"/><circle cx="25.5" cy="34.5" r="6.5" fill="#E3DFD8"/>`)}
<path d="M30 24H66Q78 28 78 44L77 60Q72 78 48 82Q24 78 19 60L18 44Q18 28 30 24Z" fill="#8E959D"/>
${augen({ l: [32, 46], r: [64, 46], gr: AUGE, haut: '#8E959D', ausdruck: a })}
<path d="M42 49H54Q57.5 49 57.5 54L56.5 65Q55.5 72 48 72Q40.5 72 39.5 65L38.5 54Q38.5 49 42 49Z" fill="${DUNKEL}"/>
${mund({ y: 76, b: 8, ausdruck: a, dicke: 2 })}`,
  },
  hase: {
    name: t('Hase'), facette: true, anatomie: 'mund',
    zeichnung: (a) => `${beide('<path d="M34 44 28 18Q27 12 32.5 12Q37.5 12 39 18L44 42Z" fill="#CBC2B7"/><path d="M36.5 40 32 19.5Q31.8 17 33 17Q34.6 17 35.2 19.5L40 40Z" fill="#978A7E"/>')}
<path d="M48 36Q68 36 74 52L76 62Q74 80 48 84Q22 80 20 62L22 52Q28 36 48 36Z" fill="#CBC2B7"/>
<path d="M38 64Q48 58 58 64Q60 74 48 79Q36 74 38 64Z" fill="${WEISS}"/>
${augen({ l: [37, 55], r: [59, 55], gr: AUGE, haut: '#CBC2B7', ausdruck: a })}
${nase(62.5, 7, 4.5)}
${schnauze({ spitze: 67.4, b: 7, ausdruck: a, dicke: 2 })}`,
  },
  frosch: {
    name: t('Frosch'), facette: true, anatomie: 'mund',
    zeichnung: (a) => `${beide('<circle cx="33" cy="37" r="12" fill="#5B9A45"/>')}
<path d="M14 62Q14 44 30 42H66Q82 44 82 62Q82 79 48 81Q14 79 14 62Z" fill="#5B9A45"/>
<path d="M22 68Q48 76 74 68Q70 79 48 81Q26 79 22 68Z" fill="${CREME}"/>
${augen({ l: [33, 37], r: [63, 37], gr: 3.8, hoch: 1, haut: '#5B9A45', ausdruck: a })}
${beide('<circle cx="44" cy="52" r="1.5" fill="#2F5A26"/>')}
${mund({ y: 61, b: 30, ausdruck: a, dicke: 2.4, neutralStrich: true, tiefe: 0.45 })}`,
  },
  affe: {
    name: t('Affe'), facette: true, anatomie: 'mund',
    zeichnung: (a) => {
      const gesicht = '<circle cx="37" cy="46" r="11.5"/><circle cx="59" cy="46" r="11.5"/><ellipse cx="48" cy="65" rx="18" ry="14"/>';
      return `${beide('<circle cx="17.5" cy="50" r="8.5" fill="#5B3F2C"/><circle cx="18.5" cy="50" r="4.2" fill="#D6AA7C"/>')}
<path d="M48 16Q74 16 76 44L76 56Q74 82 48 84Q22 82 20 56L20 44Q22 16 48 16Z" fill="#5B3F2C"/>
<g fill="#D6AA7C">${gesicht}</g>
${innerhalb('tier-affe', gesicht, augen({ l: [37, 47], r: [59, 47], gr: AUGE, haut: '#D6AA7C', ausdruck: a }))}
<path d="M41 30H55L48 43Z" fill="#5B3F2C"/>
${beide(`<ellipse cx="45" cy="60" rx="1.6" ry="2" fill="${DUNKEL}"/>`)}
${mund({ y: 68.5, b: 13, ausdruck: a, dicke: 2.2 })}`;
    },
  },
  maus: {
    name: t('Maus'), facette: true, anatomie: 'mund',
    zeichnung: (a) => `${beide('<circle cx="27.5" cy="26" r="13.5" fill="#AFA398"/><circle cx="28" cy="26.5" r="8" fill="#76675B"/>')}
<path d="M48 30Q68 30 71 46Q72 58 60 70L52.5 80Q48 84 43.5 80L36 70Q24 58 25 46Q28 30 48 30Z" fill="#AFA398"/>
<path d="M38 62Q48 57 58 62L52.5 79Q48 84 43.5 79Z" fill="${CREME}"/>
${augen({ l: [39, 50], r: [57, 50], gr: AUGE, haut: '#AFA398', ausdruck: a })}
<circle cx="48" cy="67.5" r="3.3" fill="${DUNKEL}"/>
${schnauze({ spitze: 71.2, b: 7, ausdruck: a, dicke: 2 })}`,
  },
  igel: {
    name: t('Igel'), facette: true, anatomie: 'mund',
    zeichnung: (a) => {
      const gesicht = '<path d="M26 52Q27 37 48 37Q69 37 70 52Q70 62 59 71L52.5 79Q48 83 43.5 79L37 71Q26 62 26 52Z"/>';
      return `<path d="${stern(48, 50, 36, 27, 15)}" fill="#4E3E33"/>
<path d="${stern(48, 52, 29, 22, 15, -78)}" fill="#7A6150"/>
<g fill="#E3C59D">${gesicht}</g>
${innerhalb('tier-igel', gesicht, augen({ l: [38, 53], r: [58, 53], gr: AUGE, haut: '#E3C59D', ausdruck: a }))}
<circle cx="48" cy="68.5" r="3.2" fill="${DUNKEL}"/>
${schnauze({ spitze: 72, b: 7, ausdruck: a, dicke: 2 })}`;
    },
  },
  schaf: {
    name: t('Schaf'), facette: true, anatomie: 'mund',
    zeichnung: (a) => {
      let wolle = '<circle cx="48" cy="44" r="26"/>';
      for (let i = 0; i < 11; i += 1) {
        const w = (-90 + (360 / 11) * i) * (Math.PI / 180);
        wolle += `<circle cx="${r2(48 + Math.cos(w) * 26)}" cy="${r2(44 + Math.sin(w) * 26)}" r="9"/>`;
      }
      const gesicht = '<path d="M36 32H60L66 50L62 68Q58 80 48 82Q38 80 34 68L30 50Z"/>';
      return `<g fill="${CREME}">${wolle}</g>
${beide('<path d="M34 45Q23 38 13 44Q22 53 34 51Z" fill="#3A332F"/>')}
<g fill="#3A332F">${gesicht}</g>
<g fill="${CREME}"><circle cx="40" cy="31" r="8.5"/><circle cx="56" cy="31" r="8.5"/><circle cx="48" cy="27" r="9"/></g>
${innerhalb('tier-schaf', gesicht, augen({ l: [38, 51], r: [58, 51], gr: AUGE, farbe: CREME, haut: '#3A332F', braue: '#3A332F', ausdruck: a }))}
${nase(65, 9, 5, '#6F6259')}
${schnauze({ spitze: 70.4, b: 8, ausdruck: a, dicke: 2, farbe: CREME })}`;
    },
  },
  schwein: {
    name: t('Schwein'), facette: true, anatomie: 'mund',
    zeichnung: (a) => `<path d="M30 26H66Q78 30 78 46L76 62Q70 80 48 82Q26 80 20 62L18 46Q18 30 30 26Z" fill="#E4A48D"/>
${beide('<path d="M17 19 42 22.5 27 43Z" fill="#D08A74" stroke="#D08A74" stroke-width="2.4" stroke-linejoin="round"/>')}
<ellipse cx="48" cy="63" rx="13" ry="9" fill="#C97C68"/>
${beide(`<ellipse cx="43.5" cy="63" rx="2.1" ry="3.3" fill="${DUNKEL}"/>`)}
${augen({ l: [36, 47], r: [60, 47], gr: AUGE, haut: '#E4A48D', ausdruck: a })}
${mund({ y: 76, b: 9, ausdruck: a, dicke: 2.2 })}`,
  },
  wal: {
    name: t('Wal'), facette: true, anatomie: 'mund',
    zeichnung: (a) => {
      const tropfen = (x, y, w, s = 1) => `<path d="M0 6C-3.6 1 -3.6-6 0-6C3.6-6 3.6 1 0 6Z" transform="translate(${x} ${y}) rotate(${w}) scale(${s})"/>`;
      return `<g fill="#BFD6E6">${tropfen(48, 22.5, 0, 1.05)}${tropfen(37.5, 25.5, -38, 0.85)}${tropfen(58.5, 25.5, 38, 0.85)}</g>
<path d="M12 60Q12 36 48 34Q84 36 84 60Q84 80 48 82Q12 80 12 60Z" fill="#3E72A5"/>
<path d="M17 65Q48 73 79 65Q77 80 48 82Q19 80 17 65Z" fill="#D5E3EC"/>
${augen({ l: [29, 53], r: [67, 53], gr: AUGE, haut: '#3E72A5', ausdruck: a })}
${mund({ y: 61, b: 22, ausdruck: a, dicke: 2.4, neutralStrich: true, tiefe: 0.55 })}`;
    },
  },
  oktopus: {
    name: t('Oktopus'), facette: true, anatomie: 'ohne',
    zeichnung: (a) => `${beide('<path d="M40 58Q38 74 30 81" stroke="#AE4A36" stroke-width="7" stroke-linecap="round" fill="none"/>')}
${beide('<path d="M30 55Q22 64 15 60M37 59Q34 72 25 76M45 61Q45 75 40 83" stroke="#DE6A4B" stroke-width="7" stroke-linecap="round" fill="none"/>')}
<path d="M48 13Q73 13 74 40Q74 55 64 61H32Q22 55 22 40Q23 13 48 13Z" fill="#DE6A4B"/>
${augen({ l: [38, 42], r: [58, 42], gr: AUGE, haut: '#DE6A4B', ausdruck: a })}`,
  },
};

// Motive aus Runde 2, die nicht mehr angeboten werden, aber in gespeicherten Wörtern stehen
// können (`motiv:pilz:mohn`). Sie erscheinen weiter — im selben ruhigen Stil, ohne Gesicht.
export const VERSTECKT = {
  pilz: {
    name: t('Pilz'), facette: true,
    zeichnung: () => `<path d="M38 58H58L60.5 77Q61 83 55 83H41Q35 83 35.5 77Z" fill="${CREME}"/>
<path d="M24 55H72Q68 61 60 61H36Q28 61 24 55Z" fill="#D9C7AE"/>
<path d="M14 50Q15 17 48 16Q81 17 82 50Q82 55 76 55H20Q14 55 14 50Z" fill="#C8503A"/>
<g fill="${CREME}"><circle cx="33" cy="34" r="5.5"/><circle cx="52" cy="25" r="4.5"/><circle cx="65" cy="40" r="5"/><circle cx="46" cy="43" r="4"/></g>`,
  },
  kaktus: {
    name: t('Kaktus'), facette: true,
    zeichnung: () => `<g fill="#4E9A5C"><path d="M40 70V28Q40 18 48 18Q56 18 56 28V70Z"/>
<path d="M41 54H33Q27 54 27 48V38Q27 33 31 33Q35 33 35 38V46H41Z"/>
<path d="M55 46H63V32Q63 27 67 27Q71 27 71 32V42Q71 50 64 50H55Z"/></g>
<path d="M48 25V64" stroke="#3C7C49" stroke-width="2.6" stroke-linecap="round"/>
<path d="M31 72H65L61 86H35Z" fill="#C4683F"/>
<path d="M28 66H68V73H28Z" fill="#A9532F"/>`,
  },
  blume: {
    name: t('Blume'), facette: true,
    zeichnung: () => {
      let blaetter = '';
      for (let i = 0; i < 8; i += 1) {
        const w = (-90 + 45 * i) * (Math.PI / 180);
        blaetter += `<circle cx="${r2(48 + Math.cos(w) * 16)}" cy="${r2(42 + Math.sin(w) * 16)}" r="9.5"/>`;
      }
      return `<path d="M48 58V84" stroke="#4E9A5C" stroke-width="5" stroke-linecap="round"/>
<path d="M48 76Q36 76 32 66Q44 64 48 72Z" fill="#4E9A5C"/>
<g fill="${CREME}">${blaetter}</g>
<circle cx="48" cy="42" r="9" fill="#E6A43A"/>`;
    },
  },
};
