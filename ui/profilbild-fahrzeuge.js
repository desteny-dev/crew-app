// Profilbild-Motive: Autos, Schiffe, Flugzeuge (Runde 3). Stilisierte Silhouetten, keine
// Marken, keine Logos. Zeichensprache: web/ui/profilbild-stil.js.
//
// Fahrzeuge fahren und fliegen nach rechts. Jedes Motiv hat einen hellen und einen dunklen
// Anteil (Fenster/Räder DUNKEL, Akzent CREME), damit es auf allen 16 Grundfarben trägt.
// `skala` und `y` sind so gesetzt, dass die Umrisse gerendert mittig sitzen und flache
// Seitenansichten etwa 80–84 Einheiten breit werden — so wirken sie neben den Tierköpfen
// nicht kleiner. SVG-IDs hier beginnen immer mit „fz".

import { t } from '../core/sprache.js';
import { DUNKEL, CREME, WEISS } from './profilbild-stil.js';

const NABE = '#C9CDD2';

const rad = (x, y, r) => `<circle cx="${x}" cy="${y}" r="${r}" fill="${DUNKEL}"/><circle cx="${x}" cy="${y}" r="${(r * 0.4).toFixed(2)}" fill="${NABE}"/>`;

// Karosserie-Unterkante mit Radläufen: von vorn (x vorn) nach hinten, Läufe als Halbkreise.
const radlaeufe = (vorn, hinten, y, laeufe) => `L${vorn} ${y}${laeufe.slice().sort((a, b) => b[0] - a[0]).map(([x, r]) => `H${x + r}A${r} ${r} 0 0 0 ${x - r} ${y}`).join('')}H${hinten}Z`;

// Fläche nur innerhalb einer Form zeichnen (dunklere Unterseite, Streifen).
const inForm = (id, d, innen) => `<clipPath id="${id}"><path d="${d}"/></clipPath><g clip-path="url(#${id})">${innen}</g>`;

// Ruhige Wellenlinie in CREME.
const welle = (x0, x1, y, w = 12) => {
  let d = `M${x0} ${y}`;
  for (let x = x0; x < x1 - 0.1; x += w) d += `q${w / 4} -2.4 ${w / 2} 0t${w / 2} 0`;
  return `<path d="${d}" stroke="${CREME}" stroke-width="2.6" fill="none" stroke-linecap="round" stroke-linejoin="round"/>`;
};

export const AUTOS = {
  rennwagen: {
    name: t('Rennwagen'), skala: 0.97, y: 44.8,
    zeichnung: () => {
      const koerper = 'M12 60.5V52.5Q12 50.5 14 50L35 41.5Q37 37.5 40.5 37.5Q43 37.5 43.5 40L44.5 45.5H57L88 55.5Q91.5 56.5 91 58.5Q90.5 60.5 88 60.5Z';
      return `<path d="M6 35.5H20.5L19.5 39.5H6ZM7 35.5h4v16H7Z" fill="${DUNKEL}"/>
${inForm('fzRw', koerper, `<path d="${koerper}" fill="#D93A2F"/><rect x="0" y="55" width="96" height="8" fill="#A52A22"/>`)}
<path d="M18 60H84V62.4H18Z" fill="${DUNKEL}"/>
<circle cx="48.5" cy="41.5" r="4.6" fill="#F4C23D"/>
<path d="M42 39H52Q55 39 57 42.5L58.5 45.5" stroke="${DUNKEL}" stroke-width="2.6" fill="none" stroke-linecap="round" stroke-linejoin="round"/>
<path d="M75 62H91V64.8H75ZM87.5 57.5H91V64.8H87.5Z" fill="${DUNKEL}"/>
${rad(23, 57, 10)}${rad(72, 58, 9)}`;
    },
  },
  sportwagen: {
    name: t('Sportwagen'), skala: 1, y: 43.5,
    zeichnung: () => {
      const koerper = `M8 58V50.5Q8.5 47.5 11 47L16 46.3L30 44.3L42 38.6Q46 37 51 37.2Q54.5 37.4 57 39.2L68 45.5L85 48.8Q91 50 91 54${radlaeufe(91, 8, 58, [[26, 10.8], [71, 10.8]])}`;
      return `${inForm('fzSw', koerper, `<path d="${koerper}" fill="#F2B632"/><rect x="0" y="53.5" width="96" height="10" fill="#D48A1E"/>`)}
<path d="M33 45L43 40.4Q46.5 39 50.5 39.2Q53.5 39.4 55.5 40.8L64 45.6Z" fill="${DUNKEL}"/>
<path d="M84.5 50L90 51.2Q90.5 52.2 89.5 52.6L85.5 52Z" fill="${CREME}"/>
${rad(26, 58.5, 9.2)}${rad(71, 58.5, 9.2)}`;
    },
  },
  rallye: {
    name: t('Rallyeauto'), skala: 0.92, y: 45.4,
    zeichnung: () => {
      const blau = '#2F6DB5';
      const koerper = `M10 60V48Q10 46 11.5 45L15 37.5Q16.5 34.5 20 34.5H47Q50 34.5 52.5 36.8L61 44.5L82 47Q88 47.8 88 52.5${radlaeufe(88, 10, 60, [[26, 10.8], [68, 10.8]])}`;
      return `<g transform="translate(3 0)"><circle cx="9" cy="65" r="4.2" fill="${CREME}"/><circle cx="3.5" cy="61" r="3" fill="${CREME}"/>
<g transform="rotate(-4 48 62)">
<path d="M4.5 30H18.5L17.5 33.5H5.5ZM11 33h3v3h-3Z" fill="${DUNKEL}"/><path d="M29 35Q31 31.8 35 31.8H46.5L49 35Z" fill="${blau}"/>
${inForm('fzRa', koerper, `<path d="${koerper}" fill="${blau}"/><rect x="0" y="56.5" width="96" height="10" fill="#23518A"/>`)}
<path d="M16.5 46L19 39Q20 37.5 22 37.5H33V46ZM36.5 37.5H46.5Q48.5 37.5 50.5 39.3L57.5 46H36.5Z" fill="${DUNKEL}"/>
<circle cx="45" cy="53" r="5.4" fill="${CREME}"/><circle cx="84.5" cy="51.5" r="2.6" fill="${CREME}"/>
${rad(26, 60, 9)}${rad(68, 60, 9)}</g></g>`;
    },
  },
  gelaendewagen: {
    name: t('Geländewagen'), skala: 0.96, y: 47.4,
    zeichnung: () => {
      const koerper = `M16 61V34Q16 30.5 19.5 30.5H55Q57.5 30.5 58.8 32.8L63.5 41H84Q87.5 41 87.5 44.5${radlaeufe(87.5, 16, 61, [[31, 12], [70, 12]])}`;
      return `<path d="M19 26H56V28.6H19ZM22 28h2.6v3H22ZM50 28h2.6v3H50Z" fill="${DUNKEL}"/>
${inForm('fzGw', koerper, `<path d="${koerper}" fill="#D9B878"/><rect x="0" y="51" width="96" height="12" fill="#AE8C52"/>`)}
<rect x="26" y="35" width="10" height="8" rx="1.2" fill="${DUNKEL}"/><path d="M39 35H55L59.5 43H39Z" fill="${DUNKEL}"/>
<path d="M83 52h8v6h-8ZM12 53h5v6h-5Z" fill="${DUNKEL}"/><circle cx="84.5" cy="45" r="2.4" fill="${CREME}"/>
${rad(16, 45, 8.5)}${rad(31, 61, 10.2)}${rad(70, 61, 10.2)}`;
    },
  },
  oldtimer: {
    name: t('Oldtimer'), skala: 1.02, y: 44.5,
    zeichnung: () => {
      const kotfluegel = '#5E1F24';
      const weisswand = (x, y, r) => `<circle cx="${x}" cy="${y}" r="${r}" fill="${DUNKEL}"/><circle cx="${x}" cy="${y}" r="${(r * 0.62).toFixed(2)}" fill="${CREME}"/><circle cx="${x}" cy="${y}" r="${(r * 0.32).toFixed(2)}" fill="${DUNKEL}"/>`;
      return `<path d="M36 42Q36 35.5 41 35.5H43Q45 35.5 45 38V42Z" fill="${kotfluegel}"/>
<path d="M50 42L53 36.5" stroke="${DUNKEL}" stroke-width="2.4" stroke-linecap="round"/>
<path d="M55.5 42.5L58.5 33.5" stroke="${CREME}" stroke-width="2.4" stroke-linecap="round"/>
<path d="M12 57Q9 50 13 45.5Q17 42 26 42H56L84 44Q87 44.5 87 47.5V57H12Z" fill="#A3343A"/>
<path d="M10 62C10 52 16.5 47.5 25 47.5C33 47.5 38 51.5 40 57.5H59C62 51 66.5 47.5 72 47.5C80.5 47.5 86.5 53 88.5 62Z" fill="${kotfluegel}"/>
<circle cx="84" cy="46" r="3" fill="${CREME}"/>
${weisswand(25, 62, 8.5)}${weisswand(71, 62, 8.5)}`;
    },
  },
  camper: {
    name: t('Campingbus'), skala: 0.93, y: 50.7,
    zeichnung: () => {
      const koerper = `M11 64V31Q11 26 16 26H60Q64 26 66.5 29.5L74.5 41.5L85 44Q89 45 89 49${radlaeufe(89, 11, 64, [[27, 10.4], [71, 10.4]])}`;
      return `<path d="M20 22.5h2.6v4h-2.6ZM52 22.5h2.6v4h-2.6Z" fill="${DUNKEL}"/>
<path d="M12 21Q14 17.5 24 17.5H60Q72 17.5 78 20.5Q72 23.5 60 23.5H24Q14 23.5 12 21Z" fill="#EE8A35"/>
${inForm('fzCb', koerper, `<path d="${koerper}" fill="#3E9E97"/><rect x="0" y="55" width="96" height="12" fill="#2F7B75"/><rect x="0" y="46.5" width="96" height="3.2" fill="${CREME}"/>`)}
<rect x="16" y="31" width="16" height="11" rx="1.5" fill="${DUNKEL}"/><rect x="36" y="31" width="16" height="11" rx="1.5" fill="${DUNKEL}"/>
<path d="M57 31H62.5Q64 31 65 32.5L71 42H57Z" fill="${DUNKEL}"/>
${rad(27, 64, 8.6)}${rad(71, 64, 8.6)}`;
    },
  },
};

export const SCHIFFE = {
  segelboot: {
    name: t('Segelboot'), skala: 0.91, y: 50.8,
    zeichnung: () => {
      const rumpf = 'M11 57.5H89L81 68Q79 70.5 75 70.5H22Q17.5 70.5 15 66Z';
      return `<path d="M49 11h3v46h-3Z" fill="${DUNKEL}"/>
<path d="M47.5 13.5Q26 28 17 52H47.5Z" fill="${CREME}"/><path d="M53.5 17Q74 28 82 52H53.5Z" fill="#E0563B"/>
<path d="M15 52.5H50V55H15Z" fill="${DUNKEL}"/>
${inForm('fzSb', rumpf, `<path d="${rumpf}" fill="#2C3E63"/><rect x="0" y="61.5" width="96" height="2.6" fill="${CREME}"/>`)}
${welle(18, 78, 76)}`;
    },
  },
  motorboot: {
    name: t('Motorboot'), skala: 0.95, y: 42,
    zeichnung: () => {
      const rumpf = 'M8 51L60 47.5Q80 46 91 42Q87.5 50.5 78 56.5Q70 61 58 62H11Q8 62 8 59Z';
      return `<path d="M56.5 47.6L49.8 40.6Q49.4 40 50.2 40H53.6Q54.5 40 55 40.6L63 47.1Z" fill="${DUNKEL}"/>
${inForm('fzMb', rumpf, `<path d="${rumpf}" fill="#E0573A"/><path d="M0 59.5L96 51.5V72H0Z" fill="#A83C28"/><path d="M0 56L96 48V51.5L0 59.5Z" fill="${CREME}"/>`)}
<path d="M86 53.5Q81 62 67 65.5Q55 68.2 38 67.2Q55 64.2 68 60.4Q79 57.4 86 53.5Z" fill="${CREME}"/>
${welle(8, 32, 67)}`;
    },
  },
  kreuzfahrtschiff: {
    name: t('Kreuzfahrtschiff'), skala: 0.92, y: 46.9,
    zeichnung: () => `<path d="M38 32L40 20.5H50V32Z" fill="#D8412F"/><path d="M40 20.5H50V23.5H39.5Z" fill="${DUNKEL}"/>
<path d="M26 38.5V32H62L65 38.5Z" fill="${WEISS}"/><path d="M18 45.5V38.5H72L76 45.5Z" fill="${WEISS}"/><path d="M12 55V47Q12 45.5 13.5 45.5H80L85 55Z" fill="${WEISS}"/>
<rect x="29" y="34.2" width="32" height="2.5" fill="${DUNKEL}"/><rect x="21" y="40.8" width="50" height="2.6" fill="${DUNKEL}"/><rect x="16" y="48.8" width="64" height="2.8" fill="${DUNKEL}"/>
<path d="M5 55H91Q88 62 84 70H15Q10 70 8 64Z" fill="#26344F"/>
${welle(20, 80, 75)}`,
  },
  containerschiff: {
    name: t('Containerschiff'), skala: 0.92, y: 46.3,
    zeichnung: () => {
      const farben = ['#E8893A', '#2F8C87', '#CF4B3B', CREME];
      const hoehen = [3, 3, 3, 2, 2];
      const muster = [[0, 1, 2], [3, 0, 1], [1, 2, 0], [2, 3], [0, 1]];
      let kisten = '';
      hoehen.forEach((n, s) => {
        for (let r = 0; r < n; r++) kisten += `<rect x="${30 + s * 11.6}" y="${(50.8 - r * 7.4).toFixed(1)}" width="10.4" height="6.2" fill="${farben[muster[s][r]]}"/>`;
      });
      const rumpf = 'M6 57H91L87 70H16Q10 70 8 64Z';
      return `<path d="M14.5 28.5V22H21.5V28.5Z" fill="${DUNKEL}"/><path d="M10 57V30Q10 28.5 11.5 28.5H26V57Z" fill="${WEISS}"/>
<path d="M8 32H28.5V35.8H8Z" fill="${DUNKEL}"/>${kisten}
${inForm('fzCs', rumpf, `<path d="${rumpf}" fill="#2E3A50"/><rect x="0" y="65.5" width="96" height="6" fill="#B8432F"/>`)}
${welle(20, 80, 75)}`;
    },
  },
  ubot: {
    name: t('U-Boot'), skala: 0.94, y: 51.3,
    zeichnung: () => {
      const rumpf = 'M9 56Q15 47 34 45.5H70Q90 45.5 90 56Q90 66.5 70 66.5H34Q15 65 9 56Z';
      return `<path d="M55 32.5V23.5Q55 22 56.5 22H61V25H58V32.5Z" fill="${DUNKEL}"/>
<path d="M14 50L12.5 45H17L22 49.5ZM14 62L12.5 67H17L22 62.5Z" fill="#D08A20"/>
<path d="M4 50.5Q4 49 5.5 49H7.5V63H5.5Q4 63 4 61.5Z" fill="${DUNKEL}"/><path d="M7 54.8H11V57.2H7Z" fill="${DUNKEL}"/>
<path d="M43 45.5L45.5 33.5Q46 32 47.5 32H59Q61 32 61.5 34L64 45.5Z" fill="#F2B632"/>
${inForm('fzUb', rumpf, `<path d="${rumpf}" fill="#F2B632"/><rect x="0" y="57" width="96" height="12" fill="#D08A20"/>`)}
<circle cx="42" cy="54" r="3.2" fill="${DUNKEL}"/><circle cx="54" cy="54" r="3.2" fill="${DUNKEL}"/><circle cx="66" cy="54" r="3.2" fill="${DUNKEL}"/>
<circle cx="10" cy="40" r="2.6" fill="${CREME}"/><circle cx="15" cy="33" r="1.9" fill="${CREME}"/><circle cx="11" cy="27" r="1.4" fill="${CREME}"/>`;
    },
  },
  wikingerschiff: {
    name: t('Wikingerschiff'), skala: 0.9, y: 49.9,
    zeichnung: () => {
      const holz = '#9A6440';
      const holzDunkel = '#6E4329';
      const segel = 'M22 16.5H74Q77 30 72 45H24Q19 30 22 16.5Z';
      const schilde = [25, 34, 43, 52, 61, 70].map((x, i) => `<circle cx="${x}" cy="51" r="4.3" fill="${i % 2 ? '#C8433A' : CREME}"/><circle cx="${x}" cy="51" r="1.6" fill="${holzDunkel}"/>`).join('');
      const steven = (d) => `<path d="${d}" stroke="${holz}" stroke-width="5" fill="none" stroke-linecap="round" stroke-linejoin="round"/>`;
      return `<path d="M46.5 14h3v40h-3Z" fill="${holzDunkel}"/>
${inForm('fzWs', segel, `<path d="${segel}" fill="${CREME}"/><path d="M28 0h8v60h-8ZM44 0h8v60h-8ZM60 0h8v60h-8Z" fill="#C8433A"/>`)}
<rect x="18.5" y="14" width="59" height="3" rx="1.5" fill="${holzDunkel}"/>
${steven('M78 56Q88 50 88.5 36Q89 27 82.5 27.5Q78 28.5 80.5 33')}${steven('M18 56Q8 50 7.5 36Q7 27 13.5 27.5Q18 28.5 15.5 33')}
<path d="M13 51H83Q80 62 66 67Q58 69.5 48 69.5Q38 69.5 30 67Q16 62 13 51Z" fill="${holz}"/>
<rect x="16" y="58.5" width="64" height="2.6" fill="${holzDunkel}"/>
${schilde}
${welle(20, 80, 75)}`;
    },
  },
};

export const FLUGZEUGE = {
  // Draufsicht schräg nach rechts oben: die bekannteste Flugzeug-Silhouette. Die gepfeilten
  // Flügel ziehen den Umriss nach links unten — translate gleicht das aus.
  verkehrsflugzeug: {
    name: t('Verkehrsflugzeug'), skala: 0.86, y: 48,
    zeichnung: () => `<g transform="translate(5.2 -5.2) rotate(45 48 48)">
<path d="M51 36L88 58Q89.5 59 89.5 61V63.5L51 55ZM45 36L8 58Q6.5 59 6.5 61V63.5L45 55Z" fill="#D3D8DF"/>
<path d="M51 73L66 82.5V86L51 82ZM45 73L30 82.5V86L45 82Z" fill="#D3D8DF"/>
<rect x="59.5" y="40" width="6" height="13" rx="3" fill="#58657A"/><rect x="30.5" y="40" width="6" height="13" rx="3" fill="#58657A"/>
<path d="M48 7C51.2 7 52.2 12 52.2 19V72Q52.2 80 48 90Q43.8 80 43.8 72V19C43.8 12 44.8 7 48 7Z" fill="${WEISS}"/>
<path d="M46.6 74H49.4V88.5H46.6Z" fill="#E0573A"/>
<path d="M45.6 15.5Q48 12.5 50.4 15.5V17.5Q48 16.2 45.6 17.5Z" fill="${DUNKEL}"/></g>`,
  },
  jet: {
    name: t('Jet'), skala: 0.9, y: 51.6,
    zeichnung: () => {
      const navy = '#2E3F5E';
      const rumpf = 'M93 50Q89 44.5 78 44.5H30Q18 44.5 8 42.5Q6 42.5 6.5 44.5Q8 48 14 50L30 54.8Q32 55.2 34 55.2H78Q89 55.2 93 50Z';
      const fenster = [44, 50.5, 57, 63.5, 70].map((x) => `<ellipse cx="${x}" cy="48.3" rx="1.8" ry="2.1"/>`).join('');
      return `<g transform="translate(1.8 0) rotate(-9 48 48)">
<path d="M14 44L8 25Q7.5 23.5 9 23.5H13.5L28 44Z" fill="${navy}"/><rect x="3" y="22.5" width="18" height="3" rx="1.5" fill="${navy}"/>
${inForm('fzJt', rumpf, `<path d="${rumpf}" fill="${WEISS}"/><rect x="0" y="51.3" width="96" height="2.4" fill="#E0A23A"/>`)}
<path d="M22 38H36Q39.5 38 39.5 41.25Q39.5 44.5 36 44.5H22Q20 44.5 20 41.25Q20 38 22 38Z" fill="${navy}"/>
<path d="M46 53H66L57.5 59.5Q56.5 60.5 54.5 60.5H46Q44 60.5 44 58.5V55Q44 53 46 53Z" fill="${navy}"/>
<g fill="${navy}">${fenster}<path d="M80 46Q86 46.4 89 49H80Z"/></g></g>`;
    },
  },
  propellerflugzeug: {
    name: t('Propellerflugzeug'), skala: 0.94, y: 43.5,
    zeichnung: () => {
      const gelb = '#F0B432';
      return `<rect x="34.5" y="58" width="37" height="5.5" rx="2.75" fill="${gelb}"/>
<path d="M58 57L64.5 69.5L71 57" stroke="${DUNKEL}" stroke-width="2.4" fill="none" stroke-linecap="round" stroke-linejoin="round"/>${rad(64.5, 70, 5.5)}
<path d="M80 43H50L16 45.5Q12 46 12 48.5Q12 51 16 51.5L50 58H80Z" fill="#2F5E9E"/>
<path d="M16 46L11.5 32Q11 30.5 12.5 30.5H17L29 45Z" fill="${gelb}"/><rect x="6" y="48" width="22" height="3" rx="1.5" fill="${gelb}"/>
<path d="M44 43Q44.5 39 49 39H54Q56 39 56 41V43Z" fill="${DUNKEL}"/>
<path d="M42 35L40.5 58M65 35L63.5 58" stroke="${DUNKEL}" stroke-width="2.3" stroke-linecap="round"/>
<rect x="32.5" y="30" width="43" height="5.5" rx="2.75" fill="${gelb}"/>
<path d="M78 42H84Q86.5 42 86.5 44.5V56.5Q86.5 59 84 59H78Z" fill="${gelb}"/>
<rect x="88.2" y="31" width="3.2" height="39" rx="1.6" fill="${DUNKEL}"/><path d="M86.5 46.5Q91.5 48 91.5 50.5Q91.5 53 86.5 54.5Z" fill="${CREME}"/>`;
    },
  },
  hubschrauber: {
    name: t('Hubschrauber'), skala: 0.94, y: 48.9,
    zeichnung: () => {
      const kabine = 'M40 44Q40 36 50 35H64Q80 35 86.5 50Q88 60 78 60H48Q40 60 40 52Z';
      return `<path d="M44 43L12 42.5Q9 42.5 9 45Q9 47.5 12 47.5L44 51Z" fill="#D94A3A"/>
<path d="M14 45L9.5 31Q9 29.5 10.5 29.5H14L21 44Z" fill="#A8362A"/>
<g transform="rotate(35 12 37)" fill="${DUNKEL}"><rect x="5" y="35.6" width="14" height="2.8" rx="1.4"/><rect x="10.6" y="30" width="2.8" height="14" rx="1.4"/></g>
<path d="M52 60L50 67M74 60L76 67" stroke="${DUNKEL}" stroke-width="2.4" stroke-linecap="round"/>
<path d="M42 67.5H84Q87.5 67.5 88 64" stroke="${DUNKEL}" stroke-width="2.6" fill="none" stroke-linecap="round"/>
${inForm('fzHs', kabine, `<path d="${kabine}" fill="#D94A3A"/><rect x="0" y="53" width="96" height="10" fill="#A8362A"/>`)}
<path d="M66.5 38Q77.5 39 82.5 50H66.5Z" fill="${DUNKEL}"/><rect x="50" y="39" width="12.5" height="10" rx="2" fill="${DUNKEL}"/>
<rect x="57" y="28" width="5" height="8" fill="${DUNKEL}"/><rect x="20" y="25" width="72" height="3.2" rx="1.6" fill="${DUNKEL}"/>`;
    },
  },
  heissluftballon: {
    name: t('Heißluftballon'), skala: 0.84, y: 47.2,
    zeichnung: () => {
      const huelle = 'M48 8C67 8 81 22 81 39C81 53 70 61 60 69H36C26 61 15 53 15 39C15 22 29 8 48 8Z';
      return `${inForm('fzHb', huelle, `<path d="${huelle}" fill="#D8412F"/><ellipse cx="48" cy="38" rx="22" ry="34" fill="${CREME}"/><ellipse cx="48" cy="38" rx="11" ry="34" fill="#F0B432"/>`)}
<path d="M36 69H60L58 74H38Z" fill="#7A4B2E"/>
<path d="M39 74L42 80M57 74L54 80" stroke="#7A4B2E" stroke-width="2.2" stroke-linecap="round"/>
<path d="M40.5 80H55.5Q56.5 80 56.3 81L55 88.5Q54.8 90 53.5 90H42.5Q41.2 90 41 88.5L39.7 81Q39.5 80 40.5 80Z" fill="#8A5A3B"/>
<rect x="39.5" y="79.5" width="17" height="2.8" rx="1.2" fill="#6B432B"/>`;
    },
  },
  wasserflugzeug: {
    name: t('Wasserflugzeug'), skala: 0.92, y: 45.8,
    zeichnung: () => `<path d="M12 43L8 27.5Q7.5 26 9 26H13L26 42Z" fill="#EDB33A"/><rect x="4" y="42.5" width="22" height="3" rx="1.5" fill="#C98B22"/>
<path d="M46 55L44 61.5M72 55L74 61.5" stroke="${DUNKEL}" stroke-width="2.4" stroke-linecap="round"/>
<path d="M84 42Q84 39.5 81 39.5L64 37.5H42L12 42Q9 42.5 9 45Q9 47.5 12 48L42 55H80Q84 55 84 52Z" fill="#EDB33A"/>
<path d="M80 40H85Q87.5 40 87.5 43V52Q87.5 55 85 55H80Z" fill="#C98B22"/>
<path d="M54 41H66L72 46.5H54ZM44 41H51V46.5H44Z" fill="${DUNKEL}"/>
<rect x="36" y="34" width="42" height="4.8" rx="2.4" fill="#C98B22"/>
<rect x="88.5" y="33.5" width="3" height="30.5" rx="1.5" fill="${DUNKEL}"/><path d="M87.5 44.5Q91.5 46 91.5 47.5Q91.5 49 87.5 50.5Z" fill="${CREME}"/>
<path d="M28 61.5H82Q88.5 61.5 91 58.5Q91 64 84 66.5H32Q28 66.5 28 64Z" fill="#4F5B70"/>
${welle(20, 80, 72)}`,
  },
};
