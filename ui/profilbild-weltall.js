// Profilbild-Motive: Weltall (Runde 3). Zeichensprache: web/ui/profilbild-stil.js.
//
// Einheitliches Licht von oben links: Jeder Körper bekommt dieselbe ruhige Schattenseite unten
// rechts (Scheibe minus eine versetzte Lichtscheibe). Flache Flächen, keine Gesichter, kein Glanz.

import { t } from '../core/sprache.js';

const f2 = (n) => +n.toFixed(2);

// Schattenseite einer Scheibe: alles außerhalb der Lichtscheibe (nach oben links versetzt).
function schatten(cx, cy, r, { staerke = 0.17, versatz = 0.3, weite = 1.08 } = {}) {
  const lx = cx - r * versatz;
  const ly = cy - r * versatz;
  const lr = r * weite;
  return `<path fill-rule="evenodd" fill="#000" opacity="${staerke}" d="M${f2(cx - r - 2)} ${f2(cy - r - 2)}H${f2(cx + r + 2)}V${f2(cy + r + 2)}H${f2(cx - r - 2)}ZM${f2(lx - lr)} ${f2(ly)}A${f2(lr)} ${f2(lr)} 0 1 0 ${f2(lx + lr)} ${f2(ly)}A${f2(lr)} ${f2(lr)} 0 1 0 ${f2(lx - lr)} ${f2(ly)}Z"/>`;
}

// Kugel: Grundfläche, darin beschnitten Zeichnung und Schattenseite.
function kugel(id, cx, cy, r, farbe, inhalt = '', schattenArt = {}) {
  return `<defs><clipPath id="${id}"><circle cx="${cx}" cy="${cy}" r="${r}"/></clipPath></defs>
<circle cx="${cx}" cy="${cy}" r="${r}" fill="${farbe}"/><g clip-path="url(#${id})">${inhalt}${schatten(cx, cy, r, schattenArt)}</g>`;
}

const poly = (punkte, farbe) => `<path d="M${punkte.map(([x, y]) => `${x} ${y}`).join('L')}Z" fill="${farbe}"/>`;

function saturn() {
  const ring = (rx1, ry1, rx2, ry2, farbe) => `<path fill-rule="evenodd" fill="${farbe}" d="M${48 - rx1} 48A${rx1} ${ry1} 0 1 0 ${48 + rx1} 48A${rx1} ${ry1} 0 1 0 ${48 - rx1} 48ZM${48 - rx2} 48A${rx2} ${ry2} 0 1 0 ${48 + rx2} 48A${rx2} ${ry2} 0 1 0 ${48 - rx2} 48Z"/>`;
  const ringe = ring(42, 11.5, 34, 8.6, '#EFE3CB') + ring(34, 8.6, 29, 7, '#CDB386');
  return `<defs><clipPath id="w-sat-vorn"><rect x="0" y="48" width="96" height="48"/></clipPath></defs>
<g transform="rotate(-20 48 48)">${ringe}</g>
${kugel('w-sat', 48, 48, 22, '#E3B462', `<g transform="rotate(-20 48 48)"><path d="M20 37h56v5H20ZM20 51h56v4.5H20Z" fill="#CF9748"/></g>`)}
<g transform="rotate(-20 48 48)"><g clip-path="url(#w-sat-vorn)">${ringe}</g></g>`;
}

function erde() {
  const land = '#79B065';
  const inhalt = poly([[36, 29], [43, 23], [52, 22], [58, 25], [64, 20], [74, 22], [82, 30], [80, 40], [71, 39], [65, 36], [58, 37], [54, 41], [47, 38], [42, 41], [37, 37]], land)
    + poly([[40, 45], [51, 43], [58, 46], [65, 47], [71, 53], [67, 59], [65, 67], [59, 75], [54, 77], [51, 70], [50, 62], [45, 57], [38, 55], [36, 49]], land)
    + poly([[14, 48], [22, 49], [29, 55], [28, 63], [23, 70], [19, 79], [12, 76]], land)
    + poly([[66, 68], [74, 64], [80, 68], [76, 74], [68, 74]], land);
  return kugel('w-erde', 48, 48, 32, '#3E82C3', inhalt);
}

function mond() {
  const krater = [[37, 36, 6.5], [58, 31, 4.2], [60, 55, 8], [39, 62, 4.8], [27, 50, 3.4], [51, 72, 3.2], [70, 40, 3]];
  return kugel('w-mond', 48, 48, 31, '#D9D4CA', krater.map(([x, y, r]) => `<circle cx="${x}" cy="${y}" r="${r}" fill="#BDB7AB"/>`).join(''));
}

function mars() {
  const dunkel = '#A8502F';
  const inhalt = poly([[16, 48], [30, 44], [40, 49], [52, 46], [60, 52], [74, 49], [82, 54], [80, 60], [66, 59], [56, 64], [44, 60], [30, 62], [16, 58]], dunkel)
    + poly([[34, 70], [46, 68], [52, 74], [44, 80], [34, 78]], dunkel)
    + poly([[56, 30], [66, 32], [70, 38], [60, 39]], dunkel)
    + '<ellipse cx="45" cy="20.5" rx="17" ry="8.5" fill="#F2E7DA"/>';
  return kugel('w-mars', 48, 48, 31, '#CC6A40', inhalt);
}

function jupiter() {
  const inhalt = '<path d="M14 26h68v5H14Z" fill="#D8B68B"/><path d="M14 35h68v7H14Z" fill="#C0875C"/><path d="M14 50h68v6H14Z" fill="#B97D56"/><path d="M14 63h68v4H14Z" fill="#CFA478"/><path d="M14 72h68v4H14Z" fill="#D8B68B"/>'
    + '<ellipse cx="59" cy="59.5" rx="8" ry="4" fill="#BF5F3C"/>';
  return kugel('w-jup', 48, 48, 32, '#E8D1AA', inhalt);
}

function sonne() {
  // Zwölf ruhige Strahlen als Kapseln, abwechselnd lang und kurz, frei um die Scheibe.
  let strahlen = '';
  for (let i = 0; i < 12; i++) {
    const w = (i * 30 * Math.PI) / 180;
    const aussen = i % 2 ? 33 : 37;
    const p = (r) => `${f2(48 + Math.sin(w) * r)} ${f2(48 - Math.cos(w) * r)}`;
    strahlen += `M${p(28.5)}L${p(aussen)}`;
  }
  return `<path d="${strahlen}" stroke="#F0A23C" stroke-width="5" stroke-linecap="round" fill="none"/>
<circle cx="48" cy="48" r="23" fill="#F5B940"/><circle cx="48" cy="48" r="16.5" fill="#F8CA5F"/>`;
}

function rakete() {
  // Senkrecht gezeichnet, dann um 45° nach rechts oben gedreht — Licht bleibt oben links.
  const koerper = 'M48 11C60 20 63 36 62 60H34C33 36 36 20 48 11Z';
  return `<defs><clipPath id="w-rak"><path d="${koerper}"/></clipPath></defs>
<g transform="rotate(45 48 48)">
<path d="M41 63Q48 88 55 63Z" fill="#F0A23C"/><path d="M44 63Q48 79 52 63Z" fill="#F8CA5F"/>
<path d="M35 42L23 58V71L35 63Z" fill="#D2503F"/><path d="M61 42L73 58V71L61 63Z" fill="#B24333"/>
<path d="M39 58H57V66H39Z" fill="#69707C"/>
<path d="${koerper}" fill="#EEE8DD"/>
<g clip-path="url(#w-rak)"><path d="M48 0H70V70H48Z" fill="#000" opacity=".12"/><path d="M20 0H76V25H20Z" fill="#D2503F"/><path d="M48 0H76V25H48Z" fill="#000" opacity=".12"/></g>
<circle cx="48" cy="37.5" r="7.4" fill="#A2AAB5"/><circle cx="48" cy="37.5" r="4.9" fill="#2B3A55"/>
</g>`;
}

function astronaut() {
  const anzug = '#ECE7DF';
  return `<defs><clipPath id="w-ast-helm"><circle cx="48" cy="42" r="25"/></clipPath><clipPath id="w-ast-vis"><rect x="29" y="29" width="38" height="26" rx="12"/></clipPath></defs>
<path d="M14 100C14 80 24 68 48 68S82 80 82 100Z" fill="${anzug}"/>
<path d="M48 68C72 68 82 80 82 100H48Z" fill="#000" opacity=".1"/>
<path d="M38 80H58V90H38Z" fill="#8E98A6"/><path d="M41.5 83h4v4h-4Z" fill="#D2503F"/><path d="M50.5 83h4v4h-4Z" fill="#F2C230"/>
<path d="M35 61H61V71H35Z" fill="#A2AAB5"/>
<rect x="19.5" y="35" width="6" height="15" rx="3" fill="#A2AAB5"/><rect x="70.5" y="35" width="6" height="15" rx="3" fill="#8D96A2"/>
<circle cx="48" cy="42" r="25" fill="${anzug}"/>
<g clip-path="url(#w-ast-helm)">${schatten(48, 42, 25, { staerke: 0.1, versatz: 0.32 })}</g>
<rect x="29" y="29" width="38" height="26" rx="12" fill="#26314A"/>
<g clip-path="url(#w-ast-vis)"><path d="M29 29H52L34 55H29Z" fill="#35425F"/></g>`;
}

function ufo() {
  return `<defs><clipPath id="w-ufo-kuppel"><path d="M30 49A18 18 0 0 1 66 49Z"/></clipPath></defs>
<g transform="rotate(-8 48 50)">
<path d="M30 49A18 18 0 0 1 66 49Z" fill="#A6D3D5"/>
<g clip-path="url(#w-ufo-kuppel)">${schatten(48, 49, 18, { staerke: 0.14, versatz: 0.35 })}</g>
<ellipse cx="48" cy="58" rx="22" ry="8.5" fill="#7F8998"/>
<ellipse cx="48" cy="52" rx="39" ry="11" fill="#C9D0D9"/>
<path d="M9 52A39 11 0 0 0 87 52A39 5.5 0 0 1 9 52Z" fill="#000" opacity=".16"/>
<circle cx="23" cy="54.6" r="2.7" fill="#F2C230"/><circle cx="35.5" cy="57.4" r="2.7" fill="#F2C230"/><circle cx="48" cy="58.4" r="2.7" fill="#F2C230"/><circle cx="60.5" cy="57.4" r="2.7" fill="#F2C230"/><circle cx="73" cy="54.6" r="2.7" fill="#F2C230"/>
</g>`;
}

function komet() {
  // Kopf unten links, drei getrennte Schweif-Keile nach rechts oben.
  return `<g transform="rotate(-40 48 48)">
<path d="M28 34.5L64 38.2Q66 39.6 64 41L28 41.8Z" fill="#8FC3D6"/>
<path d="M28 43.5L83 46.6Q85.5 48 83 49.4L28 52.5Z" fill="#C4E1EA"/>
<path d="M28 54.2L68 55Q70 56.4 68 57.8L28 61.5Z" fill="#8FC3D6"/>
</g>
${kugel('w-kom', 31.9, 61.5, 13, '#F3F6F4', '', { staerke: 0.12 })}`;
}

export const WELTALL = {
  saturn: { name: t('Saturn'), skala: 0.92, y: 48, zeichnung: saturn },
  erde: { name: t('Erde'), skala: 1, y: 48, zeichnung: erde },
  mond: { name: t('Mond'), skala: 1, y: 48, zeichnung: mond },
  mars: { name: t('Mars'), skala: 1, y: 48, zeichnung: mars },
  jupiter: { name: t('Jupiter'), skala: 1, y: 48, zeichnung: jupiter },
  sonne: { name: t('Sonne'), skala: 0.98, y: 48, zeichnung: sonne },
  rakete: { name: t('Rakete'), skala: 0.96, y: 48, zeichnung: rakete },
  astronaut: { name: t('Astronaut'), skala: 0.94, y: 50, zeichnung: astronaut },
  ufo: { name: t('UFO'), skala: 0.97, y: 47, zeichnung: ufo },
  komet: { name: t('Komet'), skala: 1, y: 48, zeichnung: komet },
};
