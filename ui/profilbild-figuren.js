// Profilbild-Motive: Figuren (Runde 8, R8-13). Zeichensprache: web/ui/profilbild-stil.js.
//
// Jonathan: „Neue Kategorie ‚Figuren' (Astronaut u. ä. im selben Stil)." Der Astronaut stand bis
// Runde 7 unter Weltall; er ist hierher umgezogen (sein Schlüssel bleibt `astronaut`, gespeicherte
// Bilder zeigen ihn weiter). Dazu drei Figuren in derselben Bauart: Kopf oder Helm auf Schultern,
// Licht von oben links, eine ruhige Schattenseite unten rechts, höchstens vier Farbtöne,
// kein Glanz — und kein Gesicht, wo ein Helm es verdeckt.

import { t } from '../core/sprache.js';
import { schatten } from './profilbild-weltall.js';

const ANZUG = '#ECE7DF';
const STAHL = '#C9D0D9';
const STAHL_DUNKEL = '#8E98A6';
const NACHT = '#26314A';
const ROT = '#D2503F';
const GELB = '#F2C230';

// Schultern unten im Kreis — für jede Figur dieselbe Linie, rechte Hälfte eine Spur dunkler.
function schultern(farbe, oben = 68) {
  return `<path d="M14 100C14 80 24 ${oben} 48 ${oben}S82 80 82 100Z" fill="${farbe}"/>
<path d="M48 ${oben}C72 ${oben} 82 80 82 100H48Z" fill="#000" opacity=".1"/>`;
}

function astronaut() {
  return `<defs><clipPath id="w-ast-helm"><circle cx="48" cy="42" r="25"/></clipPath><clipPath id="w-ast-vis"><rect x="29" y="29" width="38" height="26" rx="12"/></clipPath></defs>
${schultern(ANZUG)}
<path d="M38 80H58V90H38Z" fill="${STAHL_DUNKEL}"/><path d="M41.5 83h4v4h-4Z" fill="${ROT}"/><path d="M50.5 83h4v4h-4Z" fill="${GELB}"/>
<path d="M35 61H61V71H35Z" fill="#A2AAB5"/>
<rect x="19.5" y="35" width="6" height="15" rx="3" fill="#A2AAB5"/><rect x="70.5" y="35" width="6" height="15" rx="3" fill="#8D96A2"/>
<circle cx="48" cy="42" r="25" fill="${ANZUG}"/>
<g clip-path="url(#w-ast-helm)">${schatten(48, 42, 25, { staerke: 0.1, versatz: 0.32 })}</g>
<rect x="29" y="29" width="38" height="26" rx="12" fill="${NACHT}"/>
<g clip-path="url(#w-ast-vis)"><path d="M29 29H52L34 55H29Z" fill="#35425F"/></g>`;
}

// Roboter: kantiger Kopf mit runden Ecken, Sichtband mit zwei gelben Lampen, Antenne.
function roboter() {
  return `<defs><clipPath id="f-rob-kopf"><rect x="23" y="25" width="50" height="42" rx="12"/></clipPath></defs>
${schultern(STAHL_DUNKEL, 72)}
<path d="M41 62H55V74H41Z" fill="${STAHL_DUNKEL}"/>
<path d="M48 25V15.5" stroke="${STAHL_DUNKEL}" stroke-width="3" stroke-linecap="round"/>
<circle cx="48" cy="13" r="4.6" fill="${GELB}"/>
<rect x="17" y="37" width="8" height="18" rx="3.5" fill="${STAHL_DUNKEL}"/><rect x="71" y="37" width="8" height="18" rx="3.5" fill="${STAHL_DUNKEL}"/>
<rect x="23" y="25" width="50" height="42" rx="12" fill="${STAHL}"/>
<g clip-path="url(#f-rob-kopf)"><path d="M48 20H80V72H48Z" fill="#000" opacity=".09"/></g>
<rect x="29.5" y="34" width="37" height="16" rx="8" fill="${NACHT}"/>
<circle cx="39.5" cy="42" r="4.2" fill="${GELB}"/><circle cx="56.5" cy="42" r="4.2" fill="${GELB}"/>
<path d="M38.5 58.5h19" stroke="${STAHL_DUNKEL}" stroke-width="3.2" stroke-linecap="round"/>`;
}

// Ritter: Topfhelm mit Sehschlitz und Luftlöchern, roter Federbusch.
function ritter() {
  const helm = 'M24 70V45C24 30 34 20 48 20S72 30 72 45V70Z';
  let loecher = '';
  for (const [x, y] of [[53, 55], [58.5, 55], [64, 55], [53, 61], [58.5, 61], [64, 61]]) loecher += `<circle cx="${x}" cy="${y}" r="1.7" fill="${NACHT}"/>`;
  return `<defs><clipPath id="f-rit-helm"><path d="${helm}"/></clipPath></defs>
${schultern(STAHL_DUNKEL, 72)}
<path d="M47 22C49 11 60 5.5 70 9.5C62 11 56.5 16 54.5 24Z" fill="${ROT}"/>
<path d="${helm}" fill="${STAHL}"/>
<g clip-path="url(#f-rit-helm)"><path d="M48 14H80V74H48Z" fill="#000" opacity=".09"/><path d="M46.2 14h3.6v60h-3.6Z" fill="#000" opacity=".07"/></g>
<rect x="28.5" y="40" width="39" height="6.5" rx="3.25" fill="${NACHT}"/>
${loecher}`;
}

// Ninja: dunkle Kapuze, schmaler Streifen Haut mit ruhigen Augen, rotes Stirnband mit Enden.
function ninja() {
  const haut = '#E6C29B';
  return `<defs><clipPath id="f-nin-kopf"><circle cx="48" cy="43" r="25"/></clipPath></defs>
${schultern('#2B3A55', 70)}
<path d="M24.5 33.5 11 27.5l3.2 7.3Z" fill="${ROT}"/><path d="M24.5 36.5 10.5 40.5l5.4 4.6Z" fill="${ROT}"/>
<circle cx="48" cy="43" r="25" fill="#34405A"/>
<g clip-path="url(#f-nin-kopf)"><path d="M18 31.5h60v5H18Z" fill="${ROT}"/>${schatten(48, 43, 25, { staerke: 0.12, versatz: 0.32 })}</g>
<circle cx="25.6" cy="34" r="3.3" fill="${ROT}"/>
<rect x="27" y="39" width="42" height="12.5" rx="6.25" fill="${haut}"/>
<ellipse cx="39.5" cy="45.2" rx="2.9" ry="2.5" fill="#1E1A17"/><ellipse cx="56.5" cy="45.2" rx="2.9" ry="2.5" fill="#1E1A17"/>`;
}

export const FIGUREN = {
  astronaut: { name: t('Astronaut'), skala: 0.94, y: 50, zeichnung: astronaut },
  roboter: { name: t('Roboter'), skala: 0.94, y: 50, zeichnung: roboter },
  ritter: { name: t('Ritter'), skala: 0.94, y: 50, zeichnung: ritter },
  ninja: { name: t('Ninja'), skala: 0.94, y: 50, zeichnung: ninja },
};
