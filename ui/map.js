// Echte Karte — MapLibre GL mit freien OpenStreetMap-Daten (Prüfschritt T5).
//
// Die Bibliothek liegt im Projekt (web/vendor/maplibre) und wird NUR geladen, wenn wirklich
// eine Karte gezeigt wird — sie ist rund ein Megabyte, das soll niemand mitschleppen, der
// nur seine Meets anschaut.
//
// Kartenbild: OpenFreeMap („Positron"), freie OSM-Daten ohne Schlüssel und ohne Konto.
// Positron ist ruhig und hellgrau — es passt zur Sprache der App und lässt sich, anders als
// das bunte „Liberty", für die dunkle Darstellung sauber umkehren (Auftrag §5.2).
// Ortssuche: Photon (OpenStreetMap-Daten, für Eingabe während des Tippens gemacht),
// Nominatim als Rückfall. Beide sind fremde Dienste: Was jemand in die Ortssuche tippt,
// geht dorthin. Das gehört in die Datenschutzerklärung und steht dort auch.
//
// Kein Google: keine Places-API, keine Schlüssel, keine Kosten. Routen werden an die
// Karten-App des Geräts weitergereicht (siehe oeffneRoute).
//
// Runde 4: Diese Datei ist der EINE Baukasten für alle Karten der App — Bedienspalte (Höhenregler
// und ⓘ), Orts-Markierungen (zwei Formen, Auffächern) und Personen. Schnittstellen und Beispiele:
// scratch/.r4-api-karte.md.

import { t, tn, sprache as aktiveSprache } from '../core/sprache.js';
import { rueckmeldung } from '../core/html.js';
import { now, toISODate, fromISODate, addDays, weekdayShort, tagMonatKurz } from '../core/dates.js';

const STYLE_URL = 'https://tiles.openfreemap.org/styles/positron';
const PHOTON = 'https://photon.komoot.io/api/';
const NOMINATIM = 'https://nominatim.openstreetmap.org/search';
const PHOTON_REVERSE = 'https://photon.komoot.io/reverse';
const NOMINATIM_REVERSE = 'https://nominatim.openstreetmap.org/reverse';

// Ortsnamen kommen in der Sprache der App zurück. Photon kennt nur de, en und fr — jede andere
// Angabe beantwortet es mit 400 (und die Suche fiele auf Nominatim zurück). Dann fragt es
// „default": die Namen, wie sie vor Ort heißen. Nominatim versteht jede Sprache.
function photonSprache() {
  const code = aktiveSprache();
  return ['de', 'en', 'fr'].includes(code) ? code : 'default';
}

// Bregenz — die Gegend, in der diese App entsteht. Startpunkt, wenn nichts anderes bekannt ist.
export const START_MITTE = { lat: 47.5031, lon: 9.7471 };

let maplibrePromise = null;

export function ladeMapLibre() {
  if (maplibrePromise) return maplibrePromise;
  maplibrePromise = (async () => {
    if (!document.querySelector('#maplibre-css')) {
      const css = document.createElement('link');
      css.id = 'maplibre-css';
      css.rel = 'stylesheet';
      css.href = './vendor/maplibre/maplibre-gl.css';
      document.head.appendChild(css);
    }
    const modul = await import('../vendor/maplibre/maplibre-gl.mjs');
    return modul.default || modul;
  })();
  return maplibrePromise;
}

// --- Wo die Karte anfängt, wenn es noch nichts zu zeigen gibt ----------------------------
// Runde 2 (Jonathan): „Warum ist die Karte immer auf Vorarlberg, obwohl ich noch keinen
// Standort aktiv habe?" — weil START_MITTE fest auf Bregenz stand.
//
// Jetzt, in dieser Reihenfolge und ohne einen fremden Dienst zu fragen:
//   1. Gibt es Meets oder Freunde mit Ort, zeigt die Karte genau diese (passeAufPunkte).
//   2. Hat man selbst ein Zuhause hinterlegt, fängt sie dort an.
//   3. Sonst das Land, in dem das Gerät steht — abgelesen an der Zeitzone, ersatzweise an
//      der Region der Gerätesprache. Die IP wird bewusst NICHT benutzt: dafür müsste ein
//      fremder Dienst sie sehen.
//   4. Kennt die App das Land nicht: Mitteleuropa, weit herausgezoomt.
const LAENDER = {
  AT: [47.6, 13.3, 6.3], DE: [51.1, 10.4, 5.3], CH: [46.8, 8.2, 6.8], LI: [47.16, 9.55, 10.2],
  FR: [46.6, 2.4, 5.0], ES: [40.2, -3.7, 5.2], PT: [39.6, -8.0, 5.6], IT: [42.8, 12.5, 4.9],
  GB: [54.0, -2.4, 4.9], IE: [53.4, -8.0, 6.0], NL: [52.2, 5.3, 6.7], BE: [50.6, 4.6, 6.9],
  LU: [49.8, 6.1, 8.6], DK: [56.0, 10.0, 6.0], PL: [52.1, 19.4, 5.4], CZ: [49.8, 15.5, 6.2],
  SE: [62.0, 15.0, 4.1], NO: [64.5, 12.0, 3.9], FI: [64.0, 26.0, 4.2], US: [39.5, -98.4, 3.1],
  CA: [56.0, -96.0, 2.6], AU: [-25.3, 134.0, 3.2], MX: [23.6, -102.5, 4.1],
};
const ZEITZONEN = {
  'Europe/Vienna': 'AT', 'Europe/Berlin': 'DE', 'Europe/Busingen': 'DE', 'Europe/Zurich': 'CH',
  'Europe/Vaduz': 'LI', 'Europe/Paris': 'FR', 'Europe/Madrid': 'ES', 'Atlantic/Canary': 'ES',
  'Europe/Lisbon': 'PT', 'Europe/Rome': 'IT', 'Europe/London': 'GB', 'Europe/Dublin': 'IE',
  'Europe/Amsterdam': 'NL', 'Europe/Brussels': 'BE', 'Europe/Luxembourg': 'LU',
  'Europe/Copenhagen': 'DK', 'Europe/Warsaw': 'PL', 'Europe/Prague': 'CZ', 'Europe/Stockholm': 'SE',
  'Europe/Oslo': 'NO', 'Europe/Helsinki': 'FI', 'America/Mexico_City': 'MX',
};

export function landDesGeraets() {
  try {
    const zone = Intl.DateTimeFormat().resolvedOptions().timeZone || '';
    if (ZEITZONEN[zone]) return ZEITZONEN[zone];
    for (const sprache of (navigator.languages || [navigator.language])) {
      const region = String(sprache || '').split('-')[1];
      if (region && LAENDER[region.toUpperCase()]) return region.toUpperCase();
    }
  } catch { /* ohne Angaben bleibt Europa */ }
  return null;
}

export function startAnsicht(settings = {}) {
  const heim = settings.homeAddress;
  if (heim && typeof heim.lat === 'number' && typeof heim.lon === 'number') {
    return { mitte: { lat: heim.lat, lon: heim.lon }, zoom: 12.4, quelle: 'zuhause' };
  }
  const land = landDesGeraets();
  if (land && LAENDER[land]) {
    const [lat, lon, zoom] = LAENDER[land];
    return { mitte: { lat, lon }, zoom, quelle: `land:${land}` };
  }
  return { mitte: { lat: 49.5, lon: 10.5 }, zoom: 3.6, quelle: 'europa' };
}

// --- Kleinigkeiten, die alle Bausteine brauchen --------------------------------------------

function bewegungGedrosselt() {
  try { return Boolean(globalThis.matchMedia?.('(prefers-reduced-motion: reduce)').matches); } catch { return false; }
}

const escHtml = (wert) => String(wert ?? '').replace(/[&<>"']/g, (zeichen) => ({
  '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;',
}[zeichen]));

function ueberlappt(a, b, luft = 0) {
  return a.l < b.r + luft && a.r + luft > b.l && a.o < b.u + luft && a.u + luft > b.o;
}

// Auf ganze Gerätepixel runden: Markierungen sollen scharf stehen, auch beim Schieben.
export function aufGeraetepixel(wert) {
  const dichte = globalThis.devicePixelRatio || 1;
  return Math.round(wert * dichte) / dichte;
}

// --- Ebenen: was über der Karte liegt, und in welcher Reihenfolge -------------------------
// Runde 3 (Jonathan): „Die Hinweise auf der Karte dürfen die Infokarte, woher die Daten sind,
// nicht bedecken." MapLibre legt seine Bedienecken (dort sitzt die Herkunftsangabe ⓘ) auf
// Ebene 2 — jede Kachel darüber lag also AUF der aufgeklappten Quellenangabe. Jetzt gilt:
//   Markierungen der App ≤ 1000 · Höhenregler 1100 · Bedienecken der Karte 1200.
const EBENE_REGLER = 1100;
const EBENE_ECKEN = 1200;

// --- Die Bedienspalte: Höhenregler mittig rechts, ⓘ unten rechts ------------------------------
// Runde 4 standen beide als EINE Spalte oben rechts (Regler ab 24 px, ⓘ direkt darunter), und alles,
// was eine Seite über die Karte legte, hielt rechts 64 px frei.
// Runde 5 (Jonathan): „Der Info-Button der Map sollte immer unten rechts sein, unabhängig vom Zoom-
// Slider. Der Zoom-Slider soll nicht ganz oben sein, sondern mittig rechts, und es darf keine anderen
// Elemente, welche über einer Karte liegen, nach links drücken." Jetzt gilt auf JEDER Karte:
//   • ⓘ unten rechts (Fläche 44 px, 10 px vom Rand). Legt die Seite unten rechts etwas über die
//     Karte (z. B. „Ort übernehmen"), steht das ⓘ direkt darüber — zur Seite rückt es nie.
//   • Der Regler steht rechts, senkrecht mittig. Seine Höhe folgt der Kartenhöhe (46 %, 120 bis
//     300 px) und dem Platz, den die Seite ihm lässt.
//   • Suchfelder, Hinweise, Chips und Knöpfe laufen wieder über die volle Breite. Wollen sie und der
//     Regler dieselbe Stelle, gewinnt der Inhalt: Er ist das, weswegen man die Seite öffnet, und
//     zoomen geht auch mit zwei Fingern und dem Rad. Der Regler wird kürzer und rückt in den größten
//     freien Abschnitt; bleiben dort keine 120 px, tritt er zurück, statt etwas zu verdecken.
// Was eine Seite über eine Karte legt, trägt das Merkmal data-ueber-karte — mehr ist nicht zu tun.
export const KARTEN_SPALTE = Object.freeze({
  rechts: 10, breite: 44, regler: 300, reglerMin: 120, anteil: 0.46, abstand: 8, info: 44, rand: 10,
  // Nur noch für Ausschnitte, die die App SELBST wählt (Einpassen, Markierung ins Bild rücken): so
  // viel bleibt rechts, damit nichts, was die App hinstellt, unter dem Regler landet. Überlagerungen
  // der Seite halten diesen Platz NICHT mehr frei (Runde 5, D3).
  frei: 64,
});
const INFO_KNOPF = 24;
const UEBER_KARTE = '[data-ueber-karte]';

// Was die Seite über DIESE Karte legt, in Karten-Pixeln (auch in einer skalierten Vorschau). Gezählt
// wird nur, was sichtbar ist und in derselben Ebene liegt — nicht der Inhalt eines Sheets darüber.
function ueberlagerungen(behaelter, breite, hoehe) {
  const rahmen = behaelter.getBoundingClientRect();
  const faktor = behaelter.offsetWidth ? rahmen.width / behaelter.offsetWidth : 1;
  const blatt = behaelter.closest('.ui-sheet-card');
  const liste = [];
  for (const el of document.querySelectorAll(UEBER_KARTE)) {
    if (behaelter.contains(el) || el.contains(behaelter) || el.closest('.ui-sheet-card') !== blatt) continue;
    const r = el.getBoundingClientRect();
    if (!r.width || !r.height) continue;
    const f = { l: (r.left - rahmen.left) / faktor, r: (r.right - rahmen.left) / faktor, o: (r.top - rahmen.top) / faktor, u: (r.bottom - rahmen.top) / faktor };
    if (f.r <= 0 || f.l >= breite || f.u <= 0 || f.o >= hoehe) continue;
    if (getComputedStyle(el).visibility === 'hidden') continue;
    liste.push(f);
  }
  return liste;
}

// Die Lage von ⓘ und Regler aus Kartengröße und Überlagerungen — reine Rechnung, prüfbar.
// → { info: {l,r,o,u}, regler: {l,r,o,u} | null }  (Fläche des ⓘ = seine 44-px-Trefferfläche)
export function spalteRechnen(breite, hoehe, hindernisse = [], mitRegler = true) {
  const S = KARTEN_SPALTE;
  const spalteL = breite - S.rechts - S.breite;
  const spalteR = breite - S.rechts;
  const rechts = hindernisse.filter((f) => f.l < spalteR && f.r > spalteL);
  // ⓘ: unten rechts. Was die Seite dort unten hinlegt, hebt es an.
  let infoU = hoehe - S.rand;
  for (const f of [...rechts].sort((a, b) => b.o - a.o)) {
    if (f.o + f.u > hoehe && f.o < infoU && f.u > infoU - S.info) infoU = f.o - 2;
  }
  infoU = Math.max(S.rand + S.info, infoU);
  const info = { l: spalteL, r: spalteR, o: infoU - S.info, u: infoU };
  if (!mitRegler) return { info, regler: null };
  // Freie Abschnitte der rechten Spalte zwischen oberem Rand und ⓘ.
  let frei = [[S.rand, info.o - S.abstand]];
  for (const f of rechts) {
    const a = f.o - S.abstand;
    const b = f.u + S.abstand;
    frei = frei.flatMap(([o, u]) => (b <= o || a >= u ? [[o, u]] : [[o, Math.min(u, a)], [Math.max(o, b), u]].filter(([x, y]) => y > x)));
  }
  const tauglich = frei.filter(([o, u]) => u - o >= S.reglerMin);
  if (!tauglich.length) return { info, regler: null };
  const ideal = Math.round(Math.max(S.reglerMin, Math.min(S.regler, hoehe * S.anteil)));
  const mitte = hoehe / 2;
  const laengster = tauglich.reduce((a, b) => (b[1] - b[0] > a[1] - a[0] ? b : a));
  const mitMitte = tauglich.find(([o, u]) => o <= mitte && u >= mitte);
  const [o, u] = mitMitte && mitMitte[1] - mitMitte[0] >= Math.min(ideal, laengster[1] - laengster[0]) ? mitMitte : laengster;
  // Mittig bleibt er, solange er dafür nur kürzer werden muss; erst wenn das unter 120 px ginge, rückt er.
  const symmetrisch = Math.floor(2 * Math.min(mitte - o, u - mitte));
  const h = Math.min(ideal, symmetrisch >= S.reglerMin ? symmetrisch : u - o);
  const oben = Math.round(symmetrisch >= S.reglerMin ? mitte - h / 2 : Math.max(o, Math.min(u - h, mitte - h / 2)));
  return { info, regler: { l: spalteL, r: spalteR, o: oben, u: oben + h } };
}

// Stellt ⓘ und Regler einer Karte an ihren Platz: beim Anlegen, bei jeder Größenänderung und wenn
// eine Seite Bescheid gibt (bedienSpalteOrdnen). Ändert sich etwas, verteilen sich die Markierungen neu.
function spalteOrdnen(karte) {
  const behaelter = karte?.getContainer?.();
  if (!behaelter?.isConnected) return;
  const breite = behaelter.clientWidth || 0;
  const hoehe = behaelter.clientHeight || 0;
  if (!breite || !hoehe) return;
  const regler = behaelter.querySelector(':scope > [data-role="hoehenregler"]');
  const lage = spalteRechnen(breite, hoehe, ueberlagerungen(behaelter, breite, hoehe), Boolean(regler));
  const info = behaelter.querySelector(':scope > [data-role="karten-info"]');
  if (info) {
    const unten = `${Math.round(hoehe - lage.info.u)}px`;
    if (info.style.bottom !== unten) info.style.bottom = unten;
    info.style.setProperty('--crew-info-max', `${Math.max(150, breite - 2 * KARTEN_SPALTE.rand)}px`);
  }
  if (regler) karte.__hoehenRegler?.stellen(lage.regler);
  const vorher = JSON.stringify(karte.__crewSpalte || null);
  karte.__crewSpalte = lage;
  if (vorher !== JSON.stringify(lage)) {
    for (const marken of karte.__crewOrtMarken?.values() || []) marken.anordnen?.();
    for (const leute of karte.__crewPersonen?.values() || []) leute.anordnen?.();
  }
}

function spalteBald(karte) {
  if (!karte || karte.__crewSpalteBild) return;
  const naechstesBild = globalThis.requestAnimationFrame || ((fn) => setTimeout(fn, 16));
  karte.__crewSpalteBild = naechstesBild(() => { karte.__crewSpalteBild = 0; spalteOrdnen(karte); });
}

// Für Seiten: „Ich habe gerade etwas über die Karte gelegt oder weggenommen" (data-ueber-karte).
export function bedienSpalteOrdnen(karte) {
  spalteBald(karte);
}

// Die Flächen der Bedienung (Regler, wenn er steht, und ⓘ) in Karten-Pixeln — Markierungen und
// Namen wachsen nicht darunter.
export function bedienFlaechen(karte) {
  if (!karte?.getContainer?.()) return [];
  if (!karte.__crewSpalte) spalteOrdnen(karte);
  const lage = karte.__crewSpalte;
  return lage ? [lage.regler, lage.info].filter(Boolean) : [];
}

// Runde 4 (bleibt für Aufrufer): die Fläche des Reglers, ohne Regler die des ⓘ.
export function bedienSpalteFlaeche(karte) {
  return bedienFlaechen(karte)[0] || null;
}

// --- Höhenregler: zoomen mit einem Regler, von oben (weit weg) nach unten (nah dran) ------
// Runde 2 (Jonathan): „ein Slider von oben nach unten, um zoomen zu können — und je nach
// Höhe sieht man einen Vogel, Helikopter, Flugzeug, Satelliten oder sogar ein Raumschiff."
// Der Knopf trägt das Zeichen der Höhe, auf der man gerade ist.
// Runde 3: länger (nicht nur drei Zentimeter), größerer Knopf. Runde 4: feste Lage und Höhe (oben).
const HOEHEN = [
  { ab: 15.5, zeichen: 'vogel', wort: t('Vogel') },
  { ab: 12.3, zeichen: 'helikopter', wort: t('Helikopter') },
  { ab: 8.6, zeichen: 'flugzeug', wort: t('Flugzeug') },
  { ab: 5.2, zeichen: 'satellit', wort: t('Satellit') },
  { ab: -Infinity, zeichen: 'rakete', wort: t('Raumschiff') },
];
const ZOOM_OBEN = 2.5;   // ganz oben am Regler: weit weg
const ZOOM_UNTEN = 18;   // ganz unten: nah dran

export function hoeheFuerZoom(zoom) {
  return HOEHEN.find((stufe) => zoom >= stufe.ab) || HOEHEN[HOEHEN.length - 1];
}

// Die fünf Höhen-Zeichen. Feld 24 × 24, Strich 1.7, runde Enden — dieselbe Grammatik wie der
// Symbolkatalog (ui/symbole.js). Was fliegt, fliegt schräg nach oben.
// Runde 4 (Jonathan): „Die Rakete soll richtig modern aussehen wie SpaceX und nicht wie eine
// Kinderrakete, der Heli soll auch krasser aussehen, und der Vogel kann auch etwas besser sein."
//   Rakete: schlanker Edelstahl-Rumpf wie Starship — Spitze, vordere und hintere Klappen, ein
//           Abgasstrich. Kein Bullauge, keine Flamme.
//   Heli:   gestreckte Kanzel mit spitzer Nase und Cockpitlinie, langer Heckausleger mit Finne,
//           Kufen mit hochgezogener Spitze; Nase nach unten wie im schnellen Vorwärtsflug.
//   Vogel:  Runde 5 (Jonathan: „Die Flügel vom Bird sehen komisch aus."): Der Mauersegler von oben
//           las sich klein nicht als Vogel — die Sichelflügel wirkten wie ein Haken. Jetzt ein Vogel im
//           Flug von der Seite: Kopf mit Schnabel, EIN gehobener Flügel, gefächerter Schwanz. So liest
//           er sich auch mit 16 px auf einen Blick (angesehen hell und dunkel, 16 bis 96 px). Schräge
//           Fassungen sahen dem Zeichen eines bekannten Dienstes zu ähnlich, die Schwalbe von oben dem
//           Flugzeug.
const STRICH = 'fill="none" stroke="COL" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round"';
export const HOEHEN_ZEICHEN = {
  vogel: `<g transform="translate(0 1.8)"><path d="M21.3 8.8 18.9 8.1C18.1 6.8 16.3 6.7 15.3 7.8L14.1 9.3C11.8 8.1 9.4 6 7.4 2.9 7.2 6.7 8 9.5 9.8 11.5L3 12.8 6.2 14.3 3.8 16.6C9.2 17.2 14.3 16.1 16.8 13.2 17.8 12 18.4 10.5 21.3 8.8Z" ${STRICH}></path></g>`,
  helikopter: `<g transform="rotate(10 12 12)"><path d="M2.6 5.4h18.8M12.4 5.4v2.4" ${STRICH}></path><path d="M21.6 12.8 18.2 9c-.8-.8-1.8-1.2-2.9-1.2H11c-1.8 0-3 .9-3.5 2.3L2.2 9.8v1.1l5.3 1.8c.4 1.4 1.7 2.3 3.2 2.3h9.4c1.2 0 1.9-1.3 1.5-2.2Z" ${STRICH}></path><path d="M15.4 7.9l2 3.9h3.7M2.4 10.3 1.6 7.3M9.4 18.2h10.4c.7 0 1.3-.3 1.6-.9M11.4 15l-.3 3.2M17.4 15l.2 3.2" ${STRICH}></path></g>`,
  // Von oben, schräg im Steigflug.
  flugzeug: `<g transform="rotate(45 12 12)"><path d="M12 3.2c.8 0 1.3.7 1.3 1.6v5.1l6.6 3.9v1.8l-6.6-1.9v3.6l1.8 1.3v1.5L12 19.4l-3.1.7v-1.5l1.8-1.3v-3.6l-6.6 1.9v-1.8l6.6-3.9V4.8c0-.9.5-1.6 1.3-1.6Z" ${STRICH}></path></g>`,
  // Körper mit zwei Sonnensegeln und einer Antenne, die sendet.
  satellit: `<g transform="rotate(-45 12 12)"><rect x="9.6" y="9.6" width="4.8" height="4.8" rx="1" ${STRICH}></rect><rect x="2.6" y="10" width="5" height="4" rx=".6" ${STRICH}></rect><rect x="16.4" y="10" width="5" height="4" rx=".6" ${STRICH}></rect><path d="M7.6 12h2M14.4 12h2M12 9.6V7.4M9.9 5.2a3 3 0 0 1 4.2 0" ${STRICH}></path></g>`,
  rakete: `<g transform="rotate(45 12 12)"><path d="M12 1.5c1.3 1.1 2.1 2.9 2.1 5.1V18.6H9.9V6.6c0-2.2.8-4 2.1-5.1Z" ${STRICH}></path><path d="M9.9 7.4l-1.1 1.2v1.2M14.1 7.4l1.1 1.2v1.2M9.9 14.6 7.9 17v2.3l2-.7M14.1 14.6l2 2.4v2.3l-2-.7M12 20.8v1.6" ${STRICH}></path></g>`,
};

export function hoehenZeichen(name, farbe = 'currentColor', groesse = 20) {
  const pfad = (HOEHEN_ZEICHEN[name] || HOEHEN_ZEICHEN.flugzeug).replaceAll('COL', farbe);
  return `<svg width="${groesse}" height="${groesse}" viewBox="0 0 24 24" aria-hidden="true" style="display:block;pointer-events:none">${pfad}</svg>`;
}

const REGLER_KNOPF = 40;

// --- Bewegt ein MENSCH die Karte? -------------------------------------------------------------
// Ziehen, Rad, zwei Finger, Doppeltipp und der Höhenregler sind Bewegungen durch den Menschen.
// Einpassen und „ins Bild rücken" löst die App selbst aus — die zählen nicht. Die Markierungen
// schließen einen offenen Fächer genau dann (Jonathan: „wenn man sich dann wieder rumbewegt,
// soll es sich direkt wieder schließen").
function menschBewegt(karte) {
  for (const lauscher of karte?.__crewMensch || []) {
    try { lauscher(); } catch { /* der nächste Lauscher zählt trotzdem */ }
  }
}

export function beiBewegungDurchMenschen(karte, lauscher) {
  if (!karte || typeof lauscher !== 'function') return () => {};
  if (!karte.__crewMensch) {
    karte.__crewMensch = new Set();
    for (const art of ['movestart', 'zoomstart', 'dragstart']) {
      karte.on(art, (ereignis) => { if (ereignis?.originalEvent) menschBewegt(karte); });
    }
    // Gemessen: Beim Zoomen mit dem Rad kommen movestart/zoomstart OHNE originalEvent — das Rad
    // selbst meldet MapLibre aber als eigenes Kartenereignis. Ebenso zählen zwei Finger sofort.
    karte.on('wheel', (ereignis) => { if (ereignis?.originalEvent) menschBewegt(karte); });
    karte.on('touchstart', (ereignis) => { if ((ereignis?.originalEvent?.touches?.length || 0) >= 2) menschBewegt(karte); });
  }
  karte.__crewMensch.add(lauscher);
  return () => karte.__crewMensch.delete(lauscher);
}

function hoehenReglerAnbauen(karte) {
  const behaelter = karte.getContainer();
  if (!behaelter || behaelter.querySelector(':scope > [data-role="hoehenregler"]')) return;
  kartenStilEinsetzen();
  const S = KARTEN_SPALTE;
  const regler = document.createElement('div');
  regler.dataset.role = 'hoehenregler';
  regler.dataset.hdrag = 'zoom';
  regler.setAttribute('role', 'slider');
  regler.setAttribute('tabindex', '0');
  regler.setAttribute('aria-label', t('Höhe über der Karte'));
  regler.setAttribute('aria-orientation', 'vertical');
  regler.setAttribute('aria-valuemin', String(ZOOM_OBEN));
  regler.setAttribute('aria-valuemax', String(ZOOM_UNTEN));
  // Über jeder Markierung der App (auch dem geöffneten Fächer): Ein Bedienelement darf nicht
  // unter Inhalt verschwinden.
  // Lage und Höhe setzt die Bedienspalte (spalteOrdnen): mittig rechts.
  regler.style.cssText = `position:absolute;right:${S.rechts}px;top:0;width:${S.breite}px;height:${S.regler}px;z-index:${EBENE_REGLER};touch-action:none;cursor:ns-resize;outline:none`;
  const marken = HOEHEN.filter((stufe) => Number.isFinite(stufe.ab))
    .map((stufe) => `<span data-role="hoehenmarke" data-ab="${stufe.ab}" style="position:absolute;left:50%;top:0;width:12px;height:2px;margin:-1px 0 0 -6px;border-radius:1px;background:var(--ink-a22);pointer-events:none"></span>`).join('');
  regler.innerHTML = `<div data-role="hoehenspur" style="position:absolute;left:50%;top:${REGLER_KNOPF / 2}px;bottom:${REGLER_KNOPF / 2}px;width:6px;margin-left:-3px;border-radius:3px;background:var(--surface);box-shadow:0 0 0 1px var(--ink-a10),0 2px 8px var(--shadow-14);pointer-events:none"></div>${marken}`
    + `<span data-role="hoehenwort" aria-hidden="true" style="position:absolute;right:${S.breite + 6}px;top:0;height:26px;margin-top:-13px;padding:0 10px;border-radius:13px;background:var(--surface);box-shadow:0 4px 14px var(--shadow-14);font:650 12px/26px 'Instrument Sans',sans-serif;color:var(--ink);white-space:nowrap;opacity:0;transition:opacity .18s ease;pointer-events:none"></span>`
    + `<div data-role="hoehenknopf" style="position:absolute;left:${(S.breite - REGLER_KNOPF) / 2}px;top:0;width:${REGLER_KNOPF}px;height:${REGLER_KNOPF}px;border-radius:50%;background:var(--surface);box-shadow:0 4px 14px var(--shadow-18),0 0 0 1px var(--ink-a08);display:flex;align-items:center;justify-content:center;box-sizing:border-box;pointer-events:none;transition:box-shadow .15s ease"></div>`;
  behaelter.appendChild(regler);
  const knopf = regler.querySelector('[data-role="hoehenknopf"]');
  const wort = regler.querySelector('[data-role="hoehenwort"]');
  const stand = { spur: S.regler - REGLER_KNOPF };

  const zeigen = () => {
    const zoom = karte.getZoom();
    const anteil = Math.max(0, Math.min(1, (zoom - ZOOM_OBEN) / (ZOOM_UNTEN - ZOOM_OBEN)));
    const y = Math.round(anteil * stand.spur);
    knopf.style.transform = `translateY(${y}px)`;
    wort.style.transform = `translateY(${y + REGLER_KNOPF / 2}px)`;
    const stufe = hoeheFuerZoom(zoom);
    if (knopf.dataset.zeichen !== stufe.zeichen) {
      const vorher = knopf.dataset.zeichen;
      knopf.dataset.zeichen = stufe.zeichen;
      knopf.innerHTML = hoehenZeichen(stufe.zeichen, 'var(--ink)', 22);
      wort.textContent = stufe.wort;
      regler.setAttribute('aria-valuetext', stufe.wort);
      if (vorher && !bewegungGedrosselt()) {
        knopf.firstElementChild?.animate?.([{ opacity: 0, transform: 'scale(.6)' }, { opacity: 1, transform: 'none' }], { duration: 200, easing: 'cubic-bezier(.2,.9,.25,1)' });
      }
    }
    regler.setAttribute('aria-valuenow', zoom.toFixed(1));
  };

  // Runde 5: Lage und Höhe kommen aus der Bedienspalte (spalteOrdnen) — mittig rechts, so hoch, wie
  // Karte und Seite es erlauben. Ohne Platz (null) tritt der Regler zurück.
  const stellen = (flaeche) => {
    if (!flaeche) {
      if (regler.style.display !== 'none') regler.style.display = 'none';
      regler.dataset.verborgen = '1';
      return;
    }
    if (regler.style.display) regler.style.display = '';
    if (regler.dataset.verborgen) delete regler.dataset.verborgen;
    const gesamt = Math.round(flaeche.u - flaeche.o);
    const oben = `${Math.round(flaeche.o)}px`;
    if (regler.style.top !== oben) regler.style.top = oben;
    if (regler.style.height !== `${gesamt}px`) regler.style.height = `${gesamt}px`;
    stand.spur = gesamt - REGLER_KNOPF;
    for (const marke of regler.querySelectorAll('[data-role="hoehenmarke"]')) {
      const anteil = (Number(marke.dataset.ab) - ZOOM_OBEN) / (ZOOM_UNTEN - ZOOM_OBEN);
      marke.style.top = `${Math.round(REGLER_KNOPF / 2 + anteil * stand.spur)}px`;
    }
    zeigen();
  };

  const zoomAm = (clientY, griff) => {
    const rahmen = regler.getBoundingClientRect();
    // In einer skalierten Vorschau (Desktop) sind Zeiger- und Layout-Pixel verschieden.
    const faktor = regler.offsetHeight ? rahmen.height / regler.offsetHeight : 1;
    const lokal = (clientY - rahmen.top) / (faktor || 1) - griff;
    const anteil = Math.max(0, Math.min(1, (lokal - REGLER_KNOPF / 2) / (stand.spur || 1)));
    return ZOOM_OBEN + anteil * (ZOOM_UNTEN - ZOOM_OBEN);
  };
  let zug = null;
  let wortZeit = 0;
  const wortZeigen = (an) => {
    clearTimeout(wortZeit);
    if (an) wort.style.opacity = '1';
    else wortZeit = setTimeout(() => { wort.style.opacity = '0'; }, 650);
  };
  regler.addEventListener('pointerdown', (ereignis) => {
    if (ereignis.button) return;
    ereignis.stopPropagation();
    ereignis.preventDefault();
    regler.setPointerCapture?.(ereignis.pointerId);
    menschBewegt(karte);
    const rahmen = knopf.getBoundingClientRect();
    const aufKnopf = ereignis.clientY >= rahmen.top - 4 && ereignis.clientY <= rahmen.bottom + 4;
    // Wer den Knopf greift, zieht ihn von dort, wo er ihn gefasst hat — er springt nicht unter
    // den Finger. Ein Tipp daneben fährt weich an die Stelle.
    const faktor = regler.offsetHeight ? regler.getBoundingClientRect().height / regler.offsetHeight : 1;
    zug = { griff: aufKnopf ? (ereignis.clientY - (rahmen.top + rahmen.height / 2)) / (faktor || 1) : 0 };
    knopf.style.boxShadow = '0 6px 18px var(--shadow-22),0 0 0 1px var(--ink-a10)';
    wortZeigen(true);
    if (!aufKnopf) karte.easeTo({ zoom: zoomAm(ereignis.clientY, 0), duration: 220 });
  });
  regler.addEventListener('pointermove', (ereignis) => {
    if (!zug) return;
    ereignis.stopPropagation();
    karte.stop?.();
    karte.setZoom(zoomAm(ereignis.clientY, zug.griff));
  });
  const loslassen = (ereignis) => {
    if (!zug) return;
    zug = null;
    ereignis.stopPropagation();
    knopf.style.boxShadow = '';
    wortZeigen(false);
  };
  regler.addEventListener('pointerup', loslassen);
  regler.addEventListener('pointercancel', loslassen);
  regler.addEventListener('keydown', (ereignis) => {
    const schritt = ereignis.key === 'ArrowDown' ? 0.5 : ereignis.key === 'ArrowUp' ? -0.5 : 0;
    if (!schritt) return;
    ereignis.preventDefault();
    menschBewegt(karte);
    karte.easeTo({ zoom: Math.max(ZOOM_OBEN, Math.min(ZOOM_UNTEN, karte.getZoom() + schritt)), duration: 180 });
  });
  // Ein Tipp auf den Regler darf nichts darunter öffnen (Kacheln, Personen).
  regler.addEventListener('click', (ereignis) => { ereignis.stopPropagation(); ereignis.preventDefault(); });
  // Das Rad über dem Regler zoomt die Karte — wie überall sonst auf ihr.
  radAnKarte(karte, regler);
  // 'move' statt 'zoom': Der Knopf steht damit im selben Bild an seiner neuen Stelle, BEVOR später
  // angemeldete Lauscher (die Anordnung der Markierungen) ihn messen — auch bei einem Sprung.
  karte.on('move', zeigen);
  karte.__hoehenRegler = { stand, stellen };
  zeigen();
}

// Runde 4: Ein eigener Rand wirkt nicht mehr — die Lage kommt aus spalteOrdnen. Der Aufruf bleibt
// erlaubt, damit Seiten, die ihn noch setzen, nicht brechen.
export function hoehenReglerRand() {}

// --- ⓘ: woher die Karte kommt ---------------------------------------------------------------
// Runde 5 (D2, Jonathan: „Mir fällt gerade auf, dass es den i-Button in der Map zwei Mal gibt."):
// MapLibre brachte seine eigene Herkunftsangabe mit (ein aufklappbares Feld mit eigenem ⓘ), die
// Runde 4 per Stil in die Spalte schob. Jetzt ist MapLibres Angabe aus, und JEDE Karte trägt genau
// einen Knopf der App, überall gleich. Die Nennung bleibt einen Tipp entfernt — OpenStreetMap,
// OpenMapTiles und OpenFreeMap verlangen sie. Der Wortlaut kommt aus den Kartendaten selbst; bis sie
// geladen sind, steht der bekannte Satz da.
const HERKUNFT_RUECKFALL = [
  { href: 'https://www.openstreetmap.org/copyright', text: 'OpenStreetMap' },
  { href: 'https://openfreemap.org', text: 'OpenFreeMap' },
  { href: 'https://www.openmaptiles.org/', text: '© OpenMapTiles' },
];
const INFO_ZEICHEN = '<svg viewBox="0 0 24 24" aria-hidden="true"><circle cx="12" cy="7.3" r="1.55" fill="currentColor"></circle><path d="M12 11.1v6.3" fill="none" stroke="currentColor" stroke-width="2.3" stroke-linecap="round"></path></svg>';
let infoZaehler = 0;

function herkunftAusKarte(karte) {
  const verwalter = karte?.style?.tileManagers || karte?.style?.sourceCaches || {};
  const vorlage = document.createElement('template');
  vorlage.innerHTML = Object.values(verwalter).map((v) => {
    try { return String(v?.getSource?.()?.attribution || ''); } catch { return ''; }
  }).join(' ');
  return [...vorlage.content.querySelectorAll('a[href]')]
    .map((a) => ({ href: a.getAttribute('href') || '', text: a.textContent.replace(/\s+/g, ' ').trim() }))
    .filter((link) => /^https:\/\//.test(link.href) && link.text);
}

function herkunftHtml(links) {
  const gesehen = new Set();
  return (links.length ? links : HERKUNFT_RUECKFALL)
    .map((link) => (/openstreetmap\.org/i.test(link.href) ? { ...link, text: t('© OpenStreetMap-Mitwirkende'), rang: 0 } : { ...link, rang: 1 }))
    .filter((link) => !gesehen.has(link.href) && gesehen.add(link.href))
    .sort((a, b) => a.rang - b.rang)
    .map((link) => `<a href="${escHtml(link.href)}" target="_blank" rel="noopener">${escHtml(link.text)}</a>`)
    .join('<span aria-hidden="true"> · </span>');
}

function infoAnbauen(karte) {
  const behaelter = karte.getContainer();
  if (!behaelter || behaelter.querySelector(':scope > [data-role="karten-info"]')) return;
  kartenStilEinsetzen();
  infoZaehler += 1;
  const textId = `crew-karten-info-${infoZaehler}`;
  const info = document.createElement('div');
  info.className = 'crew-karten-info';
  info.dataset.role = 'karten-info';
  info.dataset.offen = '0';
  info.style.zIndex = String(EBENE_ECKEN);
  info.innerHTML = `<div class="crew-karten-info-text" id="${textId}">${herkunftHtml([])}</div>`
    + `<button type="button" class="crew-karten-info-knopf" aria-expanded="false" aria-controls="${textId}" aria-label="${escHtml(t('Kartendaten'))}"><span class="crew-karten-info-i">${INFO_ZEICHEN}</span></button>`;
  behaelter.appendChild(info);
  const knopf = info.querySelector('.crew-karten-info-knopf');
  const text = info.querySelector('.crew-karten-info-text');
  const auf = (offen) => {
    const wert = offen ? '1' : '0';
    if (info.dataset.offen === wert) return;
    info.dataset.offen = wert;
    knopf.setAttribute('aria-expanded', String(Boolean(offen)));
  };
  knopf.addEventListener('click', (ereignis) => {
    ereignis.preventDefault();
    rueckmeldung('tipp');
    auf(info.dataset.offen !== '1');
  });
  // Tipps auf ⓘ und seine Links gehören der Karte: Karten liegen in Bereichen mit data-act (Route,
  // Karte schließen) — deren Handler dürfen weder auslösen noch den Link verhindern.
  info.addEventListener('click', (ereignis) => ereignis.stopPropagation());
  info.addEventListener('keydown', (ereignis) => {
    if (ereignis.key === 'Escape' && info.dataset.offen === '1') { auf(false); knopf.focus(); }
  });
  radAnKarte(karte, info);
  // Wie ein Fächer: Bewegung durch den Menschen und ein Tipp auf die Karte schließen die Angabe.
  beiBewegungDurchMenschen(karte, () => auf(false));
  karte.on('click', () => auf(false));
  const auffrischen = () => {
    const links = herkunftAusKarte(karte);
    if (!links.length) return false;
    text.innerHTML = herkunftHtml(links);
    return true;
  };
  if (!auffrischen()) {
    const beiDaten = () => { if (auffrischen()) karte.off('sourcedata', beiDaten); };
    karte.on('sourcedata', beiDaten);
  }
}

// --- Meine Lage auf jeder Karte --------------------------------------------------------------
// Runde 5 (D4, Jonathan: „Bedenke, dass jede Map weiß, wo ich bin, wenn ich Standort habe, und alle
// Maps einfach einheitlich bedacht sind."): Jede Karte zeigt die eigene Lage mit DEMSELBEN Punkt —
// ruhig wie auf den Karten des Geräts: blauer Punkt, weißer Rand, leichter Hof. Ist die Lage nicht
// mehr frisch (genau: false), wird der Punkt grau und verliert den Hof. Das Zuhause ist KEIN Standort
// (Chef): Es steht nie als Punkt da, sonst sähe es aus, als wüsste die Karte, wo man ist.
// Quelle ist repo.getMyLocation(); Änderungen meldet das Repository über subscribe. Die App reicht
// das Repository mit kartenLageQuelle(repo) herein (bis dahin: das Repository der laufenden App).
// Zeigt eine Karte mich schon als Person (personenMarken mit ich: true), steht dort kein zweiter Punkt.
let lageRepo = null;
let lageStand = null;
const lageKarten = new Set();
const lageAbos = new WeakSet();

export function kartenLageQuelle(repo) {
  if (!repo || typeof repo.getMyLocation !== 'function') return;
  lageRepo = repo;
  lageAuffrischen();
}

function lageRepoHolen() {
  if (lageRepo) return lageRepo;
  const laufend = globalThis.__crew?.repo;
  return typeof laufend?.getMyLocation === 'function' ? laufend : null;
}

function lageLesen() {
  const repo = lageRepoHolen();
  if (!repo) return null;
  if (!lageAbos.has(repo) && typeof repo.subscribe === 'function') {
    lageAbos.add(repo);
    try { repo.subscribe(() => lageAuffrischen()); } catch { /* ohne Abo gilt der Stand beim Anlegen */ }
  }
  let lage = null;
  try { lage = repo.getMyLocation(); } catch { return null; }
  if (!lage || lage.quelle === 'zuhause' || lage.lat == null || lage.lon == null) return null;
  const lat = Number(lage.lat);
  const lon = Number(lage.lon);
  if (!Number.isFinite(lat) || !Number.isFinite(lon)) return null;
  return { lat, lon, genau: Boolean(lage.genau), quelle: String(lage.quelle || '') };
}

function lageAuffrischen() {
  const neu = lageLesen();
  const gleich = JSON.stringify(neu) === JSON.stringify(lageStand);
  lageStand = neu;
  for (const karte of [...lageKarten]) {
    if (!karte.getContainer?.()?.isConnected) { lageKarten.delete(karte); continue; }
    if (!gleich) ichStellen(karte);
  }
}

function ichStellen(karte) {
  let el = karte.__crewIch;
  const alsPerson = [...(karte.__crewPersonen?.values() || [])].some((leute) => leute.zeigtMich?.());
  if (!lageStand || alsPerson) {
    if (el && el.style.display !== 'none') el.style.display = 'none';
    return;
  }
  const ebene = kartenEbene(karte);
  if (!ebene) return;
  if (!el || el.parentNode !== ebene) {
    el = document.createElement('div');
    el.className = 'crew-ich';
    el.dataset.role = 'eigene-lage';
    el.setAttribute('role', 'img');
    el.setAttribute('aria-label', t('Dein Standort'));
    el.innerHTML = '<span class="crew-ich-hof"></span><span class="crew-ich-punkt"></span>';
    ebene.insertBefore(el, ebene.firstChild);
    karte.__crewIch = el;
  }
  if (el.style.display) el.style.display = '';
  const genau = lageStand.genau ? '1' : '0';
  if (el.dataset.genau !== genau) el.dataset.genau = genau;
  el.dataset.lat = String(lageStand.lat);
  el.dataset.lon = String(lageStand.lon);
  el.dataset.quelle = lageStand.quelle;
  const p = karte.project([lageStand.lon, lageStand.lat]);
  const lage = `translate(${aufGeraetepixel(p.x)}px,${aufGeraetepixel(p.y)}px)`;
  if (el.style.transform !== lage) el.style.transform = lage;
}

// Scrollt die Seite, verschieben sich ihre schwebenden Leisten gegenüber einer Karte im Inhalt (die
// Umkreis-Karte läuft unter „Suchen"/„Übernehmen"): Dann ordnet sich die Bedienspalte neu.
let scrollGebunden = false;
function scrollBinden() {
  if (scrollGebunden || typeof document === 'undefined') return;
  scrollGebunden = true;
  document.addEventListener('scroll', () => {
    for (const karte of lageKarten) if (karte.getContainer?.()?.isConnected) spalteBald(karte);
  }, { capture: true, passive: true });
}

function lageAnbauen(karte) {
  scrollBinden();
  if (lageKarten.has(karte)) return;
  lageKarten.add(karte);
  const stellen = () => ichStellen(karte);
  karte.on('move', stellen);
  karte.on('resize', stellen);
  karte.once('load', stellen);
  karte.once('remove', () => lageKarten.delete(karte));
  lageAuffrischen();
  stellen();
}

// --- Markierungen, die sich wie Teile der Karte verhalten ----------------------------------
// Runde 3 (Jonathan): „Wenn man auf einer Box/Kachel scrollt, soll trotzdem auf der Karte
// gezoomt werden — idiotensicher." MapLibre hört auf Zeiger, Finger und Rad an seinem
// Zeichenflächen-Behälter. Was dort HINEIN gehängt wird, gehört für jede Geste zur Karte:
// Ziehen, Rad, Zwei-Finger-Zoom, Doppeltipp — genauso, wie es bei MapLibres eigenen
// Markern ist. Ein kurzer Tipp bleibt ein Klick auf das Element selbst.
export function kartenEbene(karte) {
  if (!karte) return null;
  if (karte.__kartenEbene?.isConnected) return karte.__kartenEbene;
  const behaelter = karte.getCanvasContainer?.();
  if (!behaelter) return null;
  const ebene = document.createElement('div');
  ebene.dataset.role = 'karten-ebene';
  // Null groß: Die Ebene selbst verdeckt nichts; ihre Markierungen stehen absolut darin.
  ebene.style.cssText = 'position:absolute;left:0;top:0;width:0;height:0;z-index:1';
  behaelter.appendChild(ebene);
  karte.__kartenEbene = ebene;
  return ebene;
}

// Für alles, was ÜBER der Karte schwebt und nicht in ihr liegt (Regler, Hinweise): Das Rad
// dort zoomt die Karte, statt ins Leere zu laufen. Auch das Zusammenziehen auf dem Trackpad
// (Rad mit Strg) kommt so an.
export function radAnKarte(karte, element) {
  if (!karte || !element) return;
  element.__radKarte = karte;
  if (element.__radGebunden) return;
  element.__radGebunden = true;
  element.addEventListener('wheel', (ereignis) => {
    const ziel = element.__radKarte?.getCanvasContainer?.();
    if (!ziel || !ziel.isConnected || ziel.contains(ereignis.target)) return;
    ereignis.preventDefault();
    ereignis.stopPropagation();
    ziel.dispatchEvent(new WheelEvent('wheel', {
      deltaX: ereignis.deltaX,
      deltaY: ereignis.deltaY,
      deltaZ: ereignis.deltaZ,
      deltaMode: ereignis.deltaMode,
      clientX: ereignis.clientX,
      clientY: ereignis.clientY,
      screenX: ereignis.screenX,
      screenY: ereignis.screenY,
      ctrlKey: ereignis.ctrlKey,
      metaKey: ereignis.metaKey,
      shiftKey: ereignis.shiftKey,
      altKey: ereignis.altKey,
      bubbles: true,
      cancelable: true,
    }));
  }, { passive: false });
}

// Ein Zug über eine Markierung endet mit einem Klick auf das, worüber er losließ. Der darf
// nichts öffnen.
function zugSperre(ebene) {
  let start = null;
  ebene.addEventListener('pointerdown', (ereignis) => { start = { x: ereignis.clientX, y: ereignis.clientY }; }, true);
  ebene.addEventListener('click', (ereignis) => {
    const weit = start && Math.hypot(ereignis.clientX - start.x, ereignis.clientY - start.y) > 8;
    start = null;
    if (weit) { ereignis.stopPropagation(); ereignis.preventDefault(); }
  }, true);
}

// --- Stil der Bausteine (einmal je Dokument) -----------------------------------------------
const KARTEN_STIL = `
.crew-karten-info{position:absolute;right:${KARTEN_SPALTE.rechts}px;bottom:${KARTEN_SPALTE.rand}px;width:${KARTEN_SPALTE.info}px;height:${KARTEN_SPALTE.info}px;pointer-events:none;font:500 11.5px/16px 'Instrument Sans',sans-serif;letter-spacing:normal;text-align:left}
.crew-karten-info-knopf{position:absolute;right:0;bottom:0;width:100%;height:100%;margin:0;padding:0;border:0;background:transparent;display:flex;align-items:center;justify-content:center;cursor:pointer;appearance:none;-webkit-appearance:none;-webkit-tap-highlight-color:transparent;pointer-events:auto;outline:none;z-index:2}
.crew-karten-info-i{width:${INFO_KNOPF}px;height:${INFO_KNOPF}px;box-sizing:border-box;border-radius:50%;background:var(--surface);color:var(--ink);box-shadow:0 1px 5px var(--shadow-22),0 0 0 1px var(--ink-a08);display:flex;align-items:center;justify-content:center;pointer-events:none;transition:transform .15s ease}
.crew-karten-info-i svg{width:18px;height:18px;display:block}
.crew-karten-info-knopf:active .crew-karten-info-i{transform:scale(.92)}
.crew-karten-info-knopf:focus-visible .crew-karten-info-i{box-shadow:0 0 0 2px var(--green),0 1px 5px var(--shadow-22)}
.crew-karten-info-text{position:absolute;right:${(KARTEN_SPALTE.info - INFO_KNOPF) / 2}px;bottom:${(KARTEN_SPALTE.info - INFO_KNOPF) / 2}px;z-index:1;box-sizing:border-box;width:max-content;max-width:var(--crew-info-max,300px);min-height:${INFO_KNOPF}px;padding:4px ${INFO_KNOPF + 8}px 4px 11px;border-radius:${INFO_KNOPF / 2}px;background:var(--surface);color:var(--ink-soft);box-shadow:0 3px 12px var(--shadow-18);opacity:0;visibility:hidden;transform:scale(.97);transform-origin:100% 100%;transition:opacity .14s ease,transform .18s cubic-bezier(.2,.9,.25,1),visibility 0s linear .18s;pointer-events:none}
.crew-karten-info[data-offen="1"] .crew-karten-info-text{opacity:1;visibility:visible;transform:none;pointer-events:auto;transition:opacity .14s ease,transform .18s cubic-bezier(.2,.9,.25,1)}
.crew-karten-info-text a{display:inline-block;padding:8px 1px;margin:-8px 0;color:var(--ink);font-weight:650;text-decoration:none;white-space:nowrap}
.crew-karten-info-text a:active{text-decoration:underline}
.crew-ich{position:absolute;left:0;top:0;width:0;height:0;pointer-events:none;z-index:50}
.crew-ich-hof{position:absolute;left:-20px;top:-20px;width:40px;height:40px;border-radius:50%;background:var(--karte-ich-hof,var(--blue-tint))}
.crew-ich-punkt{position:absolute;left:-9px;top:-9px;width:18px;height:18px;box-sizing:border-box;border-radius:50%;background:var(--karte-ich,var(--blue-dark));border:3px solid var(--karte-ich-rand,var(--surface));box-shadow:0 1px 5px var(--shadow-30)}
.crew-ich[data-genau="0"] .crew-ich-punkt{background:var(--karte-ich-alt,var(--muted))}
.crew-ich[data-genau="0"] .crew-ich-hof{display:none}
.crew-marken,.crew-personen{position:absolute;left:0;top:0;width:0;height:0}
.crew-marke{position:absolute;left:0;top:0;width:0;height:0;will-change:transform;font:400 14px/normal 'Instrument Sans',sans-serif;color:var(--ink);text-align:left;letter-spacing:normal}
.crew-marke-punkt{position:absolute;left:-5px;top:-5px;width:10px;height:10px;border-radius:50%;background:var(--green);border:2px solid var(--surface);box-sizing:border-box;box-shadow:0 1px 3px var(--shadow-25);z-index:3;pointer-events:none}
.crew-marke-v{position:absolute;left:0;bottom:0;opacity:0;visibility:hidden;pointer-events:none;transform:scale(.55);transform-origin:0 100%;transition:opacity .12s ease,transform .2s cubic-bezier(.2,.9,.25,1),visibility 0s linear .2s}
.crew-marke[data-seite="links"]>.crew-marke-v{left:auto;right:0;transform-origin:100% 100%}
.crew-marke[data-form="box"]>.crew-marke-box,.crew-marke[data-form="zeichen"]>.crew-marke-zeichen{opacity:1;visibility:visible;pointer-events:auto;transform:none;transition:opacity .16s ease .02s,transform .22s cubic-bezier(.2,.9,.25,1),visibility 0s}
.crew-marke[data-offen="1"]>.crew-marke-v{opacity:0;visibility:hidden;pointer-events:none;transition:none}
.crew-marke-zeichen{width:30px;height:30px;box-sizing:border-box;display:flex;align-items:center;justify-content:center;background:var(--surface);color:var(--ink);border:1px solid var(--ink-a12);border-radius:15px 15px 15px 3px;box-shadow:0 2px 7px var(--shadow-18);cursor:pointer}
.crew-marke[data-seite="links"]>.crew-marke-zeichen{border-radius:15px 15px 3px 15px}
.crew-marke-zeichen::before{content:"";position:absolute;left:-7px;top:-7px;right:-7px;bottom:-7px}
.crew-marke-zeichen svg,.crew-marke-ikon svg{width:15px;height:15px;display:block;pointer-events:none}
.crew-marke-box{display:flex;align-items:center;gap:7px;width:max-content;max-width:164px;height:36px;box-sizing:border-box;padding:4px 10px 4px 4px;background:var(--surface);color:var(--ink);border:1px solid var(--ink-a12);border-radius:14px 14px 14px 3px;box-shadow:0 2px 8px var(--shadow-14);cursor:pointer;white-space:nowrap;font-family:'Instrument Sans',sans-serif}
.crew-marke[data-seite="links"]>.crew-marke-box{border-radius:14px 14px 3px 14px}
.crew-marke-box::before{content:"";position:absolute;left:0;right:0;top:-4px;bottom:-4px}
.crew-marke-ikon{position:relative;flex:none;width:26px;height:26px;border-radius:9px;background:var(--paper);color:var(--ink);display:flex;align-items:center;justify-content:center;pointer-events:none}
.crew-marke-text{display:flex;flex-direction:column;min-width:0;pointer-events:none}
.crew-marke-titel{font-size:12px;font-weight:650;line-height:15px;letter-spacing:-.01em;overflow:hidden;text-overflow:ellipsis;color:var(--ink)}
.crew-marke-unter{font-size:10.5px;line-height:13px;color:var(--ink-soft);font-variant-numeric:tabular-nums;overflow:hidden;text-overflow:ellipsis}
.crew-marke-plus{flex:none;min-width:20px;height:18px;padding:0 5px;box-sizing:border-box;border-radius:9px;background:var(--field);color:var(--ink);font:650 10px/18px 'Instrument Sans',sans-serif;text-align:center;pointer-events:none}
.crew-marke-zahl{position:absolute;top:-7px;right:-8px;min-width:17px;height:17px;padding:0 4px;box-sizing:border-box;border-radius:9px;background:var(--field);color:var(--ink);font:700 9.5px/17px 'Instrument Sans',sans-serif;text-align:center;pointer-events:none;box-shadow:0 0 0 1.5px var(--surface),0 1px 3px var(--shadow-14)}
.crew-marke-zahl:empty{display:none}
.crew-marke[data-seite="links"] .crew-marke-zahl{right:auto;left:-8px}
.crew-marke-nein{position:absolute;left:-5px;top:-5px;width:13px;height:13px;border-radius:50%;background:var(--red);color:var(--on-accent);box-shadow:0 0 0 1.5px var(--surface);display:flex;align-items:center;justify-content:center;pointer-events:none}
.crew-marke-nein svg{width:7px;height:7px}
.crew-marke[data-unten="1"]>.crew-marke-zeichen>.crew-marke-nein{display:none}
.crew-marke-box[data-ton="loop"] .crew-marke-ikon,.crew-marke-zeichen[data-ton="loop"]{background:var(--blue-tint);color:var(--blue-dark)}
.crew-marke-box[data-ton="loop"] .crew-marke-titel{color:var(--blue-dark)}
.crew-marke-box[data-ton="aktiv"],.crew-marke-zeichen[data-ton="aktiv"]{border-color:var(--green);box-shadow:0 0 0 1px var(--green),0 2px 8px var(--shadow-14)}
.crew-marke-box[data-ton="gewaehlt"],.crew-marke-zeichen[data-ton="gewaehlt"]{border-color:var(--green);box-shadow:0 0 0 1.5px var(--green),0 2px 8px var(--shadow-14)}
.crew-marke-box[data-ton="abgelehnt"] .crew-marke-titel{color:var(--muted)}
.crew-marke-box[data-ton="abgelehnt"] .crew-marke-ikon>svg,.crew-marke-zeichen[data-ton="abgelehnt"]>svg{opacity:.55}
.crew-marke-box[data-ton="blass"]>*,.crew-marke-zeichen[data-ton="blass"]>svg{opacity:.5}
.crew-marke-faecher{position:absolute;left:0;top:0;width:0;height:0;display:none}
.crew-marke[data-offen="1"]>.crew-marke-faecher{display:block}
.crew-marke-faecher>.crew-marke-box{position:absolute;left:0;top:0;border-radius:14px;box-shadow:0 8px 22px var(--shadow-22);animation:crew-marke-auf .2s cubic-bezier(.2,.9,.25,1) both}
.crew-marke-linie{position:absolute;left:0;top:-.75px;width:0;height:1.5px;border-radius:1px;background:var(--ink-a35);transform-origin:0 50%;pointer-events:none}
@keyframes crew-marke-auf{from{opacity:0;transform:translateY(5px) scale(.97)}to{opacity:1;transform:none}}
.crew-person{position:absolute;left:0;top:0;width:0;height:0;will-change:transform;cursor:pointer;font-family:'Instrument Sans',sans-serif;color:var(--ink);outline:none}
.crew-person-bild{position:absolute;left:-18px;top:-18px;width:36px;height:36px;box-sizing:border-box;border-radius:50%;background:var(--surface);box-shadow:0 3px 10px var(--shadow-22);display:flex;align-items:center;justify-content:center;z-index:2;overflow:visible}
.crew-person-bild::before{content:"";position:absolute;left:-4px;top:-4px;right:-4px;bottom:-4px;border-radius:50%}
.crew-person[data-ich="1"] .crew-person-bild{background:var(--green)}
.crew-person-name{position:absolute;left:4px;top:-12px;height:24px;box-sizing:border-box;padding:0 10px 0 18px;border-radius:0 12px 12px 0;background:var(--surface);box-shadow:0 3px 10px var(--shadow-18);font:650 12.5px/24px 'Instrument Sans',sans-serif;color:var(--ink);white-space:nowrap;z-index:1;opacity:0;visibility:hidden;pointer-events:none;transition:opacity .15s ease,visibility 0s linear .15s}
.crew-person[data-name="1"] .crew-person-name{opacity:1;visibility:visible;pointer-events:auto;transition:opacity .15s ease}
.crew-person-plus{margin-left:5px;color:var(--ink-soft)}
.crew-person:not([data-stapel]) .crew-person-plus{display:none}
.crew-person[data-unten="1"]{visibility:hidden;pointer-events:none}
.crew-person[data-stapel] .crew-person-bild{box-shadow:6px -5px 0 -3px var(--surface),6px -5px 0 -2px var(--ink-a14),0 3px 10px var(--shadow-22)}
.crew-person-zahl{position:absolute;top:-7px;right:-9px;min-width:18px;height:18px;padding:0 4px;box-sizing:border-box;border-radius:9px;background:var(--field);color:var(--ink);font:700 10px/18px 'Instrument Sans',sans-serif;text-align:center;pointer-events:none;box-shadow:0 0 0 1.5px var(--surface),0 1px 3px var(--shadow-14);display:none;z-index:3}
.crew-person[data-stapel] .crew-person-zahl{display:block}
.crew-person[data-offen="1"] .crew-person-zahl{display:none}
.crew-person-faecher{position:absolute;left:0;top:0;width:0;height:0;z-index:995}
.crew-person-box{position:absolute;left:0;top:0;display:flex;align-items:center;gap:8px;height:40px;box-sizing:border-box;padding:3px 13px 3px 3px;background:var(--surface);color:var(--ink);border:1px solid var(--ink-a12);border-radius:20px;box-shadow:0 8px 22px var(--shadow-22);cursor:pointer;white-space:nowrap;font:650 13px/1 'Instrument Sans',sans-serif;animation:crew-marke-auf .2s cubic-bezier(.2,.9,.25,1) both}
.crew-person-box::before{content:"";position:absolute;left:0;right:0;top:-3px;bottom:-3px}
.crew-person-box-bild{position:relative;flex:none;width:32px;height:32px;border-radius:50%;display:flex;align-items:center;justify-content:center;pointer-events:none}
.crew-person-box[data-ich="1"] .crew-person-box-bild{box-shadow:0 0 0 2px var(--green)}
.crew-person-box-name{pointer-events:none;overflow:hidden;text-overflow:ellipsis;max-width:190px}
@media (prefers-reduced-motion:reduce){.crew-marke-v,.crew-marke-faecher>.crew-marke-box,.crew-person-name,.crew-person-box,.crew-karten-info-text{transition:none!important;animation:none!important}}
`;

function kartenStilEinsetzen() {
  if (typeof document === 'undefined' || document.getElementById('crew-karten-stil')) return;
  const stil = document.createElement('style');
  stil.id = 'crew-karten-stil';
  stil.textContent = KARTEN_STIL;
  document.head.appendChild(stil);
}

// --- Grobe Zeit und Kurzname für Markierungen ------------------------------------------------
// Runde 4 (Jonathan): Die Mini-Box zeigt „Icon, Kurzname und grobe Uhrzeit". Grob heißt: so kurz,
// dass man es im Vorbeischauen liest — „Jetzt", „Heute 19 Uhr", „Sa 17 Uhr"; ab acht Tagen
// Abstand steht das Datum statt des Wochentags („22.9. 19 Uhr").
export function grobeZeit(termin = {}) {
  if (termin.status === 'active') return t('Jetzt');
  const teile = /^(\d{1,2}):(\d{2})$/.exec(String(termin.time || '').trim());
  const uhr = teile ? (teile[2] === '00' ? t('{h} Uhr', { h: Number(teile[1]) }) : `${Number(teile[1])}:${teile[2]}`) : '';
  const iso = termin.date;
  if (!iso) return uhr;
  const heute = toISODate(now());
  const mit = (wort) => (uhr ? `${wort} ${uhr}` : wort);
  if (iso === heute) return mit(t('Heute'));
  if (iso === addDays(heute, 1)) return mit(t('Morgen'));
  if (iso > heute && iso <= addDays(heute, 7)) return mit(weekdayShort(iso));
  return mit(tagMonatKurz(fromISODate(iso)));
}

// „Kino: Dune Part 3" → „Dune Part 3": Was vor dem Doppelpunkt steht, sagt das Zeichen schon.
export function kurzName(titel) {
  const text = String(titel || '').trim();
  const teile = text.split(': ');
  return teile.length > 1 && teile.slice(1).join(': ').trim().length >= 3 ? teile.slice(1).join(': ').trim() : text;
}

// --- Orts-Markierungen: zwei Formen, Auffächern ----------------------------------------------
// Runde 4 (Jonathan, D1–D3): „Du hast jetzt 4 Darstellungen … ich würde es abändern." Nur noch
// ZWEI Formen:
//   • die Mini-Box — Zeichen, Kurzname, grobe Zeit. „Die sieht man generell."
//   • nur das Zeichen — wenn wenig Platz ist bzw. weit herausgezoomt.
// „Das mit den Personen streichen wir generell raus." — „Den Punkt alleine finde ich nicht so gut."
// Die Karte „versucht immer, alles anzuzeigen": Jeder Ort ist mindestens sein Zeichen, eine
// Mini-Box verdeckt nie das Zeichen eines anderen Ortes. Zeichen dürfen einander überdecken — dann
// trägt das oberste die Zahl aller darunter, und ein Tipp fächert sie auf. „Wenn man sich dann
// wieder rumbewegt, soll es sich direkt wieder schließen." Die Ecke jeder Markierung (grüner
// Ortspunkt) steht exakt auf ihrem Ort; nichts wird verschoben oder ins Bild geholt (Runde 3).
const MARKE = Object.freeze({ zeichen: 30, box: 36, zeile: 42, punkt: 6, luftWachsen: 6, luftBleiben: -3, rand: 4 });
const NEIN_ZEICHEN = '<span class="crew-marke-nein" aria-hidden="true"><svg viewBox="0 0 24 24"><path d="M6 6l12 12M18 6 6 18" fill="none" stroke="currentColor" stroke-width="4" stroke-linecap="round"></path></svg></span>';

function formFlaeche(p, breite, hoehe, seite) {
  const f = seite === 'links'
    ? { l: p.x - breite, r: p.x, o: p.y - hoehe, u: p.y }
    : { l: p.x, r: p.x + breite, o: p.y - hoehe, u: p.y };
  return {
    l: Math.min(f.l, p.x - MARKE.punkt), r: Math.max(f.r, p.x + MARKE.punkt),
    o: Math.min(f.o, p.y - MARKE.punkt), u: Math.max(f.u, p.y + MARKE.punkt),
  };
}

function boxInnen(eintrag) {
  const nein = eintrag.ton === 'abgelehnt' ? NEIN_ZEICHEN : '';
  const unter = eintrag.unter ? `<span class="crew-marke-unter">${escHtml(eintrag.unter)}</span>` : '';
  return `<span class="crew-marke-ikon">${eintrag.zeichen || ''}${nein}</span><span class="crew-marke-text"><span class="crew-marke-titel">${escHtml(eintrag.titel)}</span>${unter}</span>`;
}

function markeInnen(ort) {
  const erstes = ort.eintraege[0];
  const anzahl = ort.eintraege.length;
  const name = escHtml(anzahl > 1 ? `${erstes.titel} +${anzahl - 1}` : (erstes.label || erstes.titel));
  const ton = escHtml(erstes.ton || '');
  const boxZiel = anzahl === 1 ? (erstes.attrs || '') : 'data-marke-tipp="gruppe"';
  return '<span class="crew-marke-punkt"></span>'
    + `<div class="crew-marke-v crew-marke-zeichen" data-marke-tipp="zeichen" data-ton="${ton}" role="button" tabindex="0" aria-label="${name}">${erstes.zeichen || ''}${erstes.ton === 'abgelehnt' ? NEIN_ZEICHEN : ''}<span class="crew-marke-zahl"></span></div>`
    + `<div class="crew-marke-v crew-marke-box" ${boxZiel} data-ton="${ton}" role="button" tabindex="0" aria-label="${name}">${boxInnen(erstes)}${anzahl > 1 ? `<span class="crew-marke-plus">+${anzahl - 1}</span>` : ''}</div>`
    + '<div class="crew-marke-faecher"></div>';
}

function faecherInnen(ort) {
  return `${ort.eintraege.map((eintrag) => `<div class="crew-marke-box" ${eintrag.attrs || ''} data-ton="${escHtml(eintrag.ton || '')}" role="button" tabindex="0" aria-label="${escHtml(eintrag.label || eintrag.titel)}">${boxInnen(eintrag)}</div>`).join('')}<span class="crew-marke-linie"></span>`;
}

// Die Fläche, auf der Markierungen stehen: normalerweise eine MapLibre-Karte. Ohne Karte (kein
// WebGL) kann eine Seite eine eigene Fläche mit geschätzter Lage übergeben.
function kartenFlaeche(karte) {
  return {
    halter: karte,
    ebene: () => kartenEbene(karte),
    projiziere: (lat, lon) => karte.project([lon, lat]),
    breite: () => karte.getContainer()?.clientWidth || 0,
    hoehe: () => karte.getContainer()?.clientHeight || 0,
    bedienung: () => bedienFlaechen(karte),
    spalte: () => Boolean(karte.__crewSpalte?.regler),
    beiBewegung: (lauscher) => { karte.on('move', lauscher); karte.on('resize', lauscher); karte.once('load', lauscher); },
    beiMensch: (lauscher) => beiBewegungDurchMenschen(karte, lauscher),
    beiKlick: (lauscher) => karte.on('click', (ereignis) => lauscher(ereignis?.originalEvent)),
    verschieben: (dx, dy) => karte.panBy([dx, dy], { duration: bewegungGedrosselt() ? 0 : 260 }),
    einpassen: (punkte) => {
      const lats = punkte.map((p) => p.lat);
      const lons = punkte.map((p) => p.lon);
      karte.fitBounds([[Math.min(...lons), Math.min(...lats)], [Math.max(...lons), Math.max(...lats)]], {
        padding: { top: 90, bottom: 60, left: 50, right: KARTEN_SPALTE.frei + 60 }, maxZoom: 17.5, duration: bewegungGedrosselt() ? 0 : 420,
      });
    },
  };
}

export function ortMarken(karte, optionen = {}) {
  const flaeche = optionen.flaeche || (karte ? kartenFlaeche(karte) : null);
  if (!flaeche?.halter) return null;
  kartenStilEinsetzen();
  const schluessel = String(optionen.schluessel || 'orte');
  const halter = flaeche.halter;
  if (!halter.__crewOrtMarken) halter.__crewOrtMarken = new Map();
  const vorhanden = halter.__crewOrtMarken.get(schluessel);
  if (vorhanden) {
    if ('frei' in optionen) vorhanden.frei = optionen.frei;
    return vorhanden;
  }

  const st = { orte: new Map(), fokus: null, offen: null, ebene: null };
  const steuerung = { frei: optionen.frei || null };

  function ebeneHolen() {
    const basis = flaeche.ebene?.();
    if (!basis) return null;
    if (st.ebene && st.ebene.parentNode === basis) return st.ebene;
    const ebene = document.createElement('div');
    ebene.className = 'crew-marken';
    ebene.dataset.schluessel = schluessel;
    basis.appendChild(ebene);
    zugSperre(ebene);
    ebene.addEventListener('click', tipp);
    ebene.addEventListener('keydown', (ereignis) => {
      const knopf = ereignis.target.closest?.('[role="button"]');
      if (knopf && (ereignis.key === 'Enter' || ereignis.key === ' ')) { ereignis.preventDefault(); knopf.click(); }
    });
    st.ebene = ebene;
    for (const e of st.orte.values()) ebene.appendChild(e.el);
    return ebene;
  }

  function faecherLeeren() {
    for (const e of st.orte.values()) {
      const kasten = e.el.querySelector(':scope > .crew-marke-faecher');
      if (kasten?.firstChild) kasten.textContent = '';
    }
  }

  function setzen(liste) {
    const ebene = ebeneHolen();
    const neu = new Map();
    (liste || []).forEach((ort, index) => {
      const lat = Number(ort?.lat);
      const lon = Number(ort?.lon);
      if (!Number.isFinite(lat) || !Number.isFinite(lon) || !ort.eintraege?.length) return;
      const key = String(ort.key ?? `${lat.toFixed(5)}|${lon.toFixed(5)}`);
      const signatur = JSON.stringify(ort.eintraege.map((x) => [x.id, x.zeichen, x.titel, x.unter, x.attrs, x.ton, x.label]));
      let e = st.orte.get(key);
      if (!e) {
        const el = document.createElement('div');
        el.className = 'crew-marke';
        el.dataset.key = key;
        el.dataset.anchor = key;
        el.dataset.form = 'zeichen';
        el.dataset.seite = 'rechts';
        el.dataset.offen = '0';
        e = { key, el, form: 'zeichen', seite: 'rechts', signatur: '' };
      }
      if (e.signatur !== signatur) {
        e.el.innerHTML = markeInnen(ort);
        e.signatur = signatur;
        e.boxBreite = 0;
      }
      Object.assign(e, { lat, lon, daten: ort, index, rang: Number.isFinite(ort.rang) ? ort.rang : index, anzahl: ort.eintraege.length });
      e.el.dataset.lat = String(lat);
      e.el.dataset.lon = String(lon);
      e.el.dataset.anzahl = String(e.anzahl);
      neu.set(key, e);
    });
    for (const [key, e] of st.orte) if (!neu.has(key)) e.el.remove();
    st.orte = neu;
    if (ebene) for (const e of neu.values()) if (e.el.parentNode !== ebene) ebene.appendChild(e.el);
    if (st.fokus && !neu.has(st.fokus)) st.fokus = null;
    if (st.offen && st.offen.keys.some((key) => !neu.has(key))) { st.offen = null; faecherLeeren(); }
    anordnen();
  }

  function anordnen() {
    if (!ebeneHolen()) return;
    const breite = flaeche.breite();
    const hoehe = flaeche.hoehe();
    if (!breite || !hoehe) return;
    const bedienung = [...(flaeche.bedienung?.() || []), ...((typeof steuerung.frei === 'function' && steuerung.frei()) || [])];
    const alle = [...st.orte.values()];
    for (const e of alle) {
      const p = flaeche.projiziere(e.lat, e.lon);
      e.p = p && Number.isFinite(p.x) && Number.isFinite(p.y) ? { x: aufGeraetepixel(p.x), y: aufGeraetepixel(p.y) } : null;
      if (e.p && !e.boxBreite) e.boxBreite = e.el.querySelector(':scope > .crew-marke-box')?.offsetWidth || 0;
    }
    const liste = alle.filter((e) => e.p);
    const vorn = (e) => (e.key === st.fokus ? 0 : 1);
    liste.sort((a, b) => (vorn(a) - vorn(b)) || (a.rang - b.rang) || (a.index - b.index));
    const draussen = (e) => e.p.x < -8 || e.p.x > breite + 8 || e.p.y < -8 || e.p.y > hoehe + 8;
    const imBild = (f) => f.l >= MARKE.rand && f.r <= breite - MARKE.rand && f.o >= MARKE.rand && f.u <= hoehe - MARKE.rand
      && !bedienung.some((b) => ueberlappt(f, b, 4));
    const zeichenFlaeche = (e) => formFlaeche(e.p, MARKE.zeichen, MARKE.zeichen, e.seite);
    const belegt = [];
    liste.forEach((e, index) => {
      let wahl = null;
      if (!draussen(e) && e.boxBreite) {
        const fokus = e.key === st.fokus;
        const spaeter = liste.slice(index + 1).filter((s) => !draussen(s));
        for (const seite of [e.seite, e.seite === 'links' ? 'rechts' : 'links']) {
          const f = formFlaeche(e.p, e.boxBreite, MARKE.box, seite);
          const neu = e.form !== 'box' || seite !== e.seite;
          // Wachsen oder die Seite wechseln nur in freien, SICHTBAREN Platz — nicht über den Rand,
          // nicht unter Regler, ⓘ oder Seitenbedienung. Was schon eine Box ist, bleibt es beim
          // Schieben auch halb draußen; sonst änderte das Schieben die Form.
          if ((neu || fokus) && !imBild(f)) continue;
          if (fokus) { wahl = { form: 'box', seite }; break; }
          const luft = neu ? MARKE.luftWachsen : MARKE.luftBleiben;
          if (belegt.some((b) => ueberlappt(f, b, luft))) continue;
          // Kein Zeichen eines anderen Ortes wird verdeckt; wer schon Box ist, behält beim Wachsen
          // eines anderen seinen Platz (keine Kettenreaktion beim Schieben).
          if (spaeter.some((s) => ueberlappt(f, neu && s.form === 'box' ? formFlaeche(s.p, s.boxBreite, MARKE.box, s.seite) : zeichenFlaeche(s), luft))) continue;
          wahl = { form: 'box', seite };
          break;
        }
        if (!wahl && fokus) wahl = { form: 'box', seite: e.p.x > breite / 2 ? 'links' : 'rechts' };
      }
      if (!wahl) wahl = { form: 'zeichen', seite: e.seite };
      e.form = wahl.form;
      e.seite = wahl.seite;
      e.ordnung = index;
      e.flaeche = e.form === 'box' ? formFlaeche(e.p, e.boxBreite, MARKE.box, e.seite) : zeichenFlaeche(e);
      belegt.push(e.flaeche);
    });

    // Zeichen, die einander überdecken, gehören zusammen: Das oberste trägt die Zahl aller.
    for (const e of liste) { e.cluster = [e.key]; e.zahl = e.form === 'zeichen' ? e.anzahl : 0; e.unten = false; }
    const zeichen = liste.filter((e) => e.form === 'zeichen' && !draussen(e));
    const eltern = new Map(zeichen.map((e) => [e.key, e.key]));
    const wurzel = (key) => {
      let k = key;
      while (eltern.get(k) !== k) { eltern.set(k, eltern.get(eltern.get(k))); k = eltern.get(k); }
      return k;
    };
    for (let i = 0; i < zeichen.length; i += 1) {
      for (let j = i + 1; j < zeichen.length; j += 1) {
        if (ueberlappt(zeichen[i].flaeche, zeichen[j].flaeche, -2)) eltern.set(wurzel(zeichen[j].key), wurzel(zeichen[i].key));
      }
    }
    const haufen = new Map();
    for (const e of zeichen) {
      const w = wurzel(e.key);
      if (!haufen.has(w)) haufen.set(w, []);
      haufen.get(w).push(e);
    }
    for (const mitglieder of haufen.values()) {
      if (mitglieder.length < 2) continue;
      mitglieder.sort((a, b) => a.ordnung - b.ordnung);
      const keys = mitglieder.map((m) => m.key);
      const summe = mitglieder.reduce((s, m) => s + m.anzahl, 0);
      // Nur das oberste Zeichen trägt Zahl und Abgelehnt-Zeichen — darunter liegende bleiben still.
      mitglieder.forEach((m, i) => { m.cluster = keys; m.zahl = i === 0 ? summe : 0; m.unten = i > 0; });
    }

    const offen = new Set(st.offen?.keys || []);
    for (const e of alle) {
      const el = e.el;
      if (!e.p) { if (el.style.display !== 'none') el.style.display = 'none'; continue; }
      if (el.style.display) el.style.display = '';
      if (el.dataset.form !== e.form) el.dataset.form = e.form;
      if (el.dataset.seite !== e.seite) el.dataset.seite = e.seite;
      const auf = offen.has(e.key) ? '1' : '0';
      if (el.dataset.offen !== auf) el.dataset.offen = auf;
      const unten = e.unten ? '1' : '0';
      if (el.dataset.unten !== unten) el.dataset.unten = unten;
      const lage = `translate(${e.p.x}px,${e.p.y}px)`;
      if (el.style.transform !== lage) el.style.transform = lage;
      const stufe = Math.min(e.ordnung ?? 199, 199);
      const z = auf === '1' ? 990 - Math.min(stufe, 20) : e.key === st.fokus ? 960 : (e.form === 'box' ? 700 : 400) - stufe;
      if (el.style.zIndex !== String(z)) el.style.zIndex = String(z);
      const zahl = el.querySelector(':scope > .crew-marke-zeichen > .crew-marke-zahl');
      const text = e.zahl > 1 ? String(e.zahl) : '';
      if (zahl && zahl.textContent !== text) zahl.textContent = text;
    }
    if (st.offen) faecherStellen(breite, hoehe, bedienung);
  }

  // Aufgefächert: alle Einträge als Mini-Boxen in einer Spalte über (oder unter) dem Ort. Liegen
  // mehrere Orte übereinander, führt eine feine Linie von jeder Gruppe zu IHREM Ortspunkt.
  function faecherStellen(breite, hoehe, bedienung) {
    const mitglieder = st.offen.keys.map((key) => st.orte.get(key)).filter((e) => e?.p);
    if (!mitglieder.length) { st.offen = null; return; }
    mitglieder.sort((a, b) => (a.rang - b.rang) || (a.index - b.index));
    const anker = mitglieder[0];
    const zeilen = [];
    for (const m of mitglieder) {
      const kasten = m.el.querySelector(':scope > .crew-marke-faecher');
      if (!kasten.firstElementChild) kasten.innerHTML = faecherInnen(m.daten);
      for (const box of kasten.querySelectorAll(':scope > .crew-marke-box')) zeilen.push({ m, box, breite: box.offsetWidth || 150 });
    }
    const Z = MARKE.zeile;
    const block = zeilen.length * Z - (Z - MARKE.box);
    const lift = mitglieder.length > 1 ? 18 : 0;
    const maxBreite = Math.max(...zeilen.map((z) => z.breite));
    const rechterRand = breite - (flaeche.spalte?.() ? KARTEN_SPALTE.frei : 8);
    const seite = anker.p.x + maxBreite <= rechterRand || anker.p.x - maxBreite < 8 ? 'rechts' : 'links';
    const spalteL = seite === 'rechts' ? anker.p.x : anker.p.x - maxBreite;
    const flaecheBei = (oben) => ({ l: spalteL, r: spalteL + maxBreite, o: oben, u: oben + block });
    const passt = (f) => f.o >= 8 && f.u <= hoehe - 8 && !bedienung.some((b) => ueberlappt(f, b, 4));
    const auf = flaecheBei(anker.p.y - lift - block);
    const ab = flaecheBei(anker.p.y + lift);
    const nachOben = passt(auf) || !passt(ab);
    if (!st.offen.gerueckt) {
      st.offen.gerueckt = true;
      // Passt der Fächer nirgends ganz, rückt die Karte ihn EINMAL ins Bild (zählt nicht als
      // Bewegung durch den Menschen, schließt also nichts).
      const f = nachOben ? auf : ab;
      if (!passt(f) && flaeche.verschieben) {
        const deckel = Math.max(8, ...bedienung.filter((b) => b.r > f.l && b.l < f.r).map((b) => b.u + 8));
        const dy = f.o < deckel ? f.o - deckel : (f.u > hoehe - 8 ? f.u - (hoehe - 8) : 0);
        if (dy) flaeche.verschieben(0, dy);
      }
    }
    const bereit = new Set();
    zeilen.forEach((z, k) => {
      const oben = nachOben ? anker.p.y - lift - MARKE.box - k * Z : anker.p.y + lift + k * Z;
      // Alle Boxen eines Fächers gleich breit: eine ruhige Spalte statt einer ausgefransten Kante.
      if (z.box.style.width !== `${maxBreite}px`) z.box.style.width = `${maxBreite}px`;
      const links = (seite === 'rechts' ? anker.p.x : anker.p.x - maxBreite) - z.m.p.x;
      z.box.style.left = `${links}px`;
      z.box.style.top = `${oben - z.m.p.y}px`;
      z.box.style.animationDelay = `${Math.min(k, 6) * 18}ms`;
      // Ein Ort allein: Die unterste Box sitzt mit ihrer scharfen Ecke auf dem Punkt.
      let ecke = '';
      if (!lift && k === 0) {
        if (nachOben) ecke = seite === 'rechts' ? '14px 14px 14px 3px' : '14px 14px 3px 14px';
        else ecke = seite === 'rechts' ? '3px 14px 14px 14px' : '14px 3px 14px 14px';
      }
      if (z.box.style.borderRadius !== ecke) z.box.style.borderRadius = ecke;
      if (!bereit.has(z.m.key)) {
        bereit.add(z.m.key);
        const linie = z.m.el.querySelector(':scope > .crew-marke-faecher > .crew-marke-linie');
        if (linie) {
          const dx = anker.p.x - z.m.p.x;
          const dy = (nachOben ? oben + MARKE.box : oben) - z.m.p.y;
          const laenge = lift ? Math.hypot(dx, dy) : 0;
          linie.style.width = `${laenge}px`;
          linie.style.transform = `rotate(${Math.atan2(dy, dx)}rad)`;
        }
      }
    });
  }

  function oeffnen(keys) {
    const mitglieder = keys.map((key) => st.orte.get(key)).filter(Boolean);
    if (!mitglieder.length) return;
    const zeilen = mitglieder.reduce((s, m) => s + m.anzahl, 0);
    // Zu viele Orte übereinander für eine Spalte: dann zoomt die Karte auf sie, statt eine Liste
    // zu zeigen, die nicht ins Bild passt.
    if (mitglieder.length > 1 && zeilen * MARKE.zeile + 60 > flaeche.hoehe() && flaeche.einpassen) {
      schliessen();
      flaeche.einpassen(mitglieder.map((m) => ({ lat: m.lat, lon: m.lon })));
      return;
    }
    faecherLeeren();
    st.fokus = null;
    st.offen = { keys: mitglieder.map((m) => m.key), gerueckt: false };
    anordnen();
  }

  function schliessen() {
    if (!st.offen && !st.fokus) return false;
    st.offen = null;
    st.fokus = null;
    faecherLeeren();
    anordnen();
    return true;
  }

  // Wer ein einzelnes Zeichen antippt, will es lesen: Es wird zur Box (vorne) und ganz ins Bild
  // gerückt. Ein zweiter Tipp öffnet es.
  function insBild(e) {
    const f = e?.flaeche;
    if (!f || !flaeche.verschieben) return;
    const breite = flaeche.breite();
    const hoehe = flaeche.hoehe();
    const rechts = breite - (flaeche.spalte?.() ? KARTEN_SPALTE.frei : 12);
    let dx = 0;
    let dy = 0;
    if (f.l < 12) dx = f.l - 12;
    else if (f.r > rechts) dx = f.r - rechts;
    if (f.o < 12) dy = f.o - 12;
    else if (f.u > hoehe - 12) dy = f.u - (hoehe - 12);
    if (Math.abs(dx) > 1 || Math.abs(dy) > 1) flaeche.verschieben(dx, dy);
  }

  function tipp(ereignis) {
    const ziel = ereignis.target.closest?.('[data-marke-tipp]');
    if (!ziel || !st.ebene?.contains(ziel)) return;
    ereignis.stopPropagation();
    ereignis.preventDefault();
    const e = st.orte.get(ziel.closest('.crew-marke')?.dataset.key);
    if (!e) return;
    // Fühlbar: die EINE Rückmeldung der App (Capacitor-Haptik, sonst navigator.vibrate).
    rueckmeldung('tipp');
    const haufen = e.cluster?.length > 1 ? e.cluster : [e.key];
    if (ziel.dataset.markeTipp === 'gruppe' || haufen.length > 1 || e.anzahl > 1) { oeffnen(haufen); return; }
    st.offen = null;
    faecherLeeren();
    st.fokus = e.key;
    anordnen();
    insBild(e);
  }

  Object.assign(steuerung, {
    setzen,
    anordnen,
    schliessen,
    oeffnen: (keys) => oeffnen((keys || []).map(String)),
    zustand: () => ({ offen: st.offen ? [...st.offen.keys] : [], fokus: st.fokus }),
    // Ein Ausschnitt, den die App selbst gewählt hat: alle Formen neu verteilen (ohne Gedächtnis).
    neuVerteilen() {
      for (const e of st.orte.values()) e.form = 'zeichen';
      anordnen();
    },
    entfernen() {
      st.ebene?.remove();
      st.ebene = null;
      st.orte.clear();
      halter.__crewOrtMarken?.delete(schluessel);
    },
  });
  flaeche.beiBewegung?.(anordnen);
  flaeche.beiMensch?.(() => { schliessen(); });
  flaeche.beiKlick?.((original) => {
    if (original?.target?.closest?.('.crew-marke')) return;
    schliessen();
  });
  halter.__crewOrtMarken.set(schluessel, steuerung);
  return steuerung;
}

// --- Personen auf Karten ---------------------------------------------------------------------
// Runde 4 (Jonathan, D6): „Die Standorte von Personen schieben sich gegenseitig nach unten und
// weg … ganz rausgezoomt ist eine Person in Italien. Das sollte auf gar keinen Fall so sein. Wenn
// man zu weit rauszoomt, dass nur noch die Profilbilder zu sehen sind und dass sie sich
// überschneiden." Vorher rückte die Crew-Karte jede Beschriftung, die einer anderen zu nahe kam,
// 40 px nach unten — und die nächste darunter noch einmal. Jetzt: Die MITTE des Profilbilds steht
// exakt auf dem Ort. Bilder dürfen einander überdecken; der Name steht nur, wo Platz ist und die
// Karte nah genug ist. Nichts rutscht.
//
// Runde 5 (D5, Jonathan: „Ich weiß nicht, ob der Standort meiner Kollegin direkt auf mir liegt und
// ich ihren Standort deshalb nicht sehe."): Gemessen lagen beide geteilten Standorte nach dem Runden
// 0 m auseinander — ihr Bild lag genau unter seinem. Jetzt gilt: Nie liegt eine Person unsichtbar
// unter einer anderen. Liegt ein Bild so nah auf einem anderen, dass dessen Mitte verdeckt wäre
// (unter 20 px), bilden sie einen STAPEL: oben die erste Person der Liste, dahinter angedeutet ein
// zweites Bild, oben rechts die Zahl aller. Ein Tipp fächert den Stapel auf — dieselbe Grammatik wie
// bei den Orts-Markierungen: gleich breite Boxen (Bild und Name) über dem Stapel, ein Tipp auf eine
// Box öffnet die Person. Jede Bewegung durch den Menschen und ein Tipp auf die freie Karte schließen.
// Überlappen, ohne dass eine Mitte verdeckt ist, bleibt erlaubt (weit herausgezoomt, Runde 4).
const PERSON = Object.freeze({ bild: 36, nameLinks: 4, nameAb: 9.5, stapel: 20, box: 40, zeile: 46, luft: 10, rand: 8 });

export function personenMarken(karte, optionen = {}) {
  if (!karte) return null;
  kartenStilEinsetzen();
  const schluessel = String(optionen.schluessel || 'personen');
  if (!karte.__crewPersonen) karte.__crewPersonen = new Map();
  const vorhanden = karte.__crewPersonen.get(schluessel);
  if (vorhanden) return vorhanden;
  const st = { leute: new Map(), ebene: null, faecher: null, faecherBreite: 0, offen: null, gerueckt: false, weg: false };

  function ebeneHolen() {
    if (st.weg) return null;
    const basis = kartenEbene(karte);
    if (!basis) return null;
    if (st.ebene && st.ebene.parentNode === basis) return st.ebene;
    const ebene = document.createElement('div');
    ebene.className = 'crew-personen';
    ebene.dataset.schluessel = schluessel;
    basis.appendChild(ebene);
    zugSperre(ebene);
    ebene.addEventListener('click', tipp);
    ebene.addEventListener('keydown', (ereignis) => {
      const knopf = ereignis.target.closest?.('.crew-person, .crew-person-box');
      if (knopf && (ereignis.key === 'Enter' || ereignis.key === ' ')) { ereignis.preventDefault(); knopf.click(); }
    });
    const faecher = document.createElement('div');
    faecher.className = 'crew-person-faecher';
    ebene.appendChild(faecher);
    st.faecher = faecher;
    st.ebene = ebene;
    for (const p of st.leute.values()) ebene.insertBefore(p.el, faecher);
    return ebene;
  }

  function setzen(liste) {
    const ebene = ebeneHolen();
    const neu = new Map();
    const vorherIch = [...st.leute.values()].some((p) => p.ich);
    const vorherSignatur = new Map([...st.leute].map(([id, p]) => [id, p.signatur]));
    (liste || []).forEach((eintrag, index) => {
      if (eintrag?.lat == null || eintrag?.lon == null) return;
      const lat = Number(eintrag.lat);
      const lon = Number(eintrag.lon);
      if (!Number.isFinite(lat) || !Number.isFinite(lon)) return;
      const id = String(eintrag.id);
      const signatur = JSON.stringify([eintrag.bild, eintrag.name, eintrag.attrs, Boolean(eintrag.ich)]);
      let p = st.leute.get(id);
      if (!p || p.signatur !== signatur) {
        const vorlage = document.createElement('template');
        vorlage.innerHTML = `<div class="crew-person" data-id="${escHtml(id)}" data-name="0"${eintrag.ich ? ' data-ich="1"' : ''} ${eintrag.attrs || ''} role="button" tabindex="0" aria-label="${escHtml(eintrag.name || '')}"><span class="crew-person-name">${escHtml(eintrag.name || '')}<span class="crew-person-plus"></span></span><span class="crew-person-bild">${eintrag.bild || ''}<span class="crew-person-zahl"></span></span></div>`;
        const el = vorlage.content.firstElementChild;
        if (p?.el) {
          el.dataset.name = p.el.dataset.name;
          el.style.cssText = p.el.style.cssText;
          p.el.replaceWith(el);
        }
        p = { el, signatur, nameBreite: 0, plus: '' };
      }
      Object.assign(p, { id, lat, lon, index, daten: eintrag, ich: Boolean(eintrag.ich) });
      p.el.dataset.lat = String(lat);
      p.el.dataset.lon = String(lon);
      neu.set(id, p);
    });
    for (const [id, p] of st.leute) if (!neu.has(id)) p.el.remove();
    st.leute = neu;
    if (ebene) for (const p of neu.values()) if (p.el.parentNode !== ebene) ebene.insertBefore(p.el, st.faecher);
    // Zeichnet die App nur neu, bleibt ein offener Fächer offen; ändern sich seine Personen, ist er zu.
    if (st.offen && !st.offen.every((id) => neu.get(id)?.signatur === vorherSignatur.get(id))) { st.offen = null; if (st.faecher) st.faecher.textContent = ''; }
    anordnen();
    // Zeigt diese Karte mich als Person, steht dort kein zweiter Punkt für meine Lage.
    if (vorherIch !== [...neu.values()].some((p) => p.ich)) ichStellen(karte);
  }

  function anordnen() {
    if (!ebeneHolen()) return;
    const zoom = karte.getZoom();
    const behaelter = karte.getContainer();
    const breite = behaelter?.clientWidth || 0;
    const hoehe = behaelter?.clientHeight || 0;
    const R = PERSON.bild / 2;
    const liste = [...st.leute.values()].sort((a, b) => a.index - b.index);
    for (const p of liste) {
      const q = karte.project([p.lon, p.lat]);
      p.p = { x: aufGeraetepixel(q.x), y: aufGeraetepixel(q.y) };
    }
    // Stapel: Wer so nah auf einem anderen liegt, dass eine Mitte verdeckt wäre, gehört dazu.
    const eltern = new Map(liste.map((p) => [p.id, p.id]));
    const wurzel = (id) => {
      let k = id;
      while (eltern.get(k) !== k) { eltern.set(k, eltern.get(eltern.get(k))); k = eltern.get(k); }
      return k;
    };
    for (let i = 0; i < liste.length; i += 1) {
      for (let j = i + 1; j < liste.length; j += 1) {
        if (Math.hypot(liste[i].p.x - liste[j].p.x, liste[i].p.y - liste[j].p.y) < PERSON.stapel) eltern.set(wurzel(liste[j].id), wurzel(liste[i].id));
      }
    }
    const gruppen = new Map();
    for (const p of liste) {
      const w = wurzel(p.id);
      if (!gruppen.has(w)) gruppen.set(w, []);
      gruppen.get(w).push(p);
    }
    for (const mitglieder of gruppen.values()) for (const p of mitglieder) { p.gruppe = mitglieder; p.oben = mitglieder[0] === p; }
    // Hat sich der offene Stapel verändert (anderer Ausschnitt, andere Daten), ist der Fächer zu.
    if (st.offen) {
      const kopf = st.leute.get(st.offen[0]);
      if (!kopf?.oben || kopf.gruppe.map((m) => m.id).join('|') !== st.offen.join('|')) { st.offen = null; st.faecher.textContent = ''; }
    }
    const offen = new Set(st.offen || []);
    const flaechen = bedienFlaechen(karte);
    const bilder = liste.filter((p) => p.oben).map((p) => ({ id: p.id, l: p.p.x - R, r: p.p.x + R, o: p.p.y - R, u: p.p.y + R }));
    const namen = [];
    liste.forEach((p, index) => {
      const el = p.el;
      const anzahl = p.gruppe.length;
      const stapel = p.oben && anzahl > 1 ? String(anzahl) : '';
      if ((el.dataset.stapel || '') !== stapel) { if (stapel) el.dataset.stapel = stapel; else delete el.dataset.stapel; }
      const unten = p.oben ? '0' : '1';
      if (el.dataset.unten !== unten) el.dataset.unten = unten;
      const auf = offen.has(p.id) ? '1' : '0';
      if (el.dataset.offen !== auf) el.dataset.offen = auf;
      const plus = stapel ? `+${anzahl - 1}` : '';
      if (p.plus !== plus) {
        p.plus = plus;
        const zahl = el.querySelector('.crew-person-zahl');
        if (zahl) zahl.textContent = stapel;
        const plusText = el.querySelector('.crew-person-plus');
        if (plusText) plusText.textContent = plus;
        const name = p.daten?.name || '';
        el.setAttribute('aria-label', stapel ? tn(anzahl - 1, '{name} und {n} weitere Person', '{name} und {n} weitere Personen', { name }) : name);
        p.nameBreite = 0;
      }
      if (!p.nameBreite) p.nameBreite = el.querySelector('.crew-person-name')?.offsetWidth || 0;
      let zeigen = false;
      if (p.oben && auf === '0' && zoom >= PERSON.nameAb && p.nameBreite) {
        const f = { l: p.p.x + R, r: p.p.x + PERSON.nameLinks + p.nameBreite, o: p.p.y - 12, u: p.p.y + 12 };
        const luft = el.dataset.name === '1' ? -2 : 4;
        zeigen = !namen.some((n) => ueberlappt(f, n, luft))
          && !bilder.some((b) => b.id !== p.id && ueberlappt(f, b, luft))
          && !flaechen.some((b) => ueberlappt(f, b, 0));
        if (zeigen) namen.push(f);
      }
      const wert = zeigen ? '1' : '0';
      if (el.dataset.name !== wert) el.dataset.name = wert;
      const lage = `translate(${p.p.x}px,${p.p.y}px)`;
      if (el.style.transform !== lage) el.style.transform = lage;
      const z = String(p.oben ? 600 - Math.min(index, 400) : 150 - Math.min(index, 140));
      if (el.style.zIndex !== z) el.style.zIndex = z;
    });
    if (st.offen) faecherStellen(breite, hoehe, flaechen);
  }

  // Aufgefächert: gleich breite Boxen übereinander, die erste Person dem Stapel am nächsten — über dem
  // Stapel, passt es dort nicht, darunter. Der Stapel bleibt sichtbar: So sieht man, wozu sie gehören.
  function faecherStellen(breite, hoehe, flaechen) {
    const mitglieder = st.offen.map((id) => st.leute.get(id)).filter((p) => p?.p);
    const anker = mitglieder[0];
    if (!anker || mitglieder.length < 2 || !st.faecher) return;
    if (!st.faecher.firstElementChild) {
      st.faecher.innerHTML = mitglieder.map((p) => `<div class="crew-person-box" data-person-box="${escHtml(p.id)}"${p.ich ? ' data-ich="1"' : ''} ${p.daten?.attrs || ''} role="button" tabindex="0" aria-label="${escHtml(p.daten?.name || '')}"><span class="crew-person-box-bild">${p.daten?.bild || ''}</span><span class="crew-person-box-name">${escHtml(p.daten?.name || '')}</span></div>`).join('');
      st.faecherBreite = Math.max(...[...st.faecher.children].map((box) => box.offsetWidth || 150));
      for (const box of st.faecher.children) box.style.width = `${st.faecherBreite}px`;
    }
    const R = PERSON.bild / 2;
    const W = st.faecherBreite;
    const block = mitglieder.length * PERSON.zeile - (PERSON.zeile - PERSON.box);
    let x = Math.round(Math.max(PERSON.rand, Math.min(breite - PERSON.rand - W, anker.p.x - W / 2)));
    const ueber = anker.p.y - R - PERSON.luft - block;
    const unter = anker.p.y + R + PERSON.luft;
    const flaecheBei = (oben) => ({ l: x, r: x + W, o: oben, u: oben + block });
    const passt = (f) => f.o >= PERSON.rand && f.u <= hoehe - PERSON.rand;
    const nachOben = passt(flaecheBei(ueber)) || !passt(flaecheBei(unter));
    // Neben der Bedienung (Regler, ⓘ): lieber nach links rücken als darunter liegen.
    for (const b of flaechen) {
      if (ueberlappt(flaecheBei(nachOben ? ueber : unter), b, 4) && b.l - 4 - W >= PERSON.rand) x = Math.round(b.l - 4 - W);
    }
    if (!st.gerueckt) {
      st.gerueckt = true;
      // Passt der Fächer nirgends ganz ins Bild, rückt die Karte ihn EINMAL hinein (keine Bewegung durch
      // den Menschen, schließt also nichts).
      const f = flaecheBei(nachOben ? ueber : unter);
      const dy = f.o < PERSON.rand ? f.o - PERSON.rand : (f.u > hoehe - PERSON.rand ? f.u - (hoehe - PERSON.rand) : 0);
      if (dy) karte.panBy([0, dy], { duration: bewegungGedrosselt() ? 0 : 260 });
    }
    [...st.faecher.children].forEach((box, k) => {
      const oben = nachOben ? anker.p.y - R - PERSON.luft - PERSON.box - k * PERSON.zeile : anker.p.y + R + PERSON.luft + k * PERSON.zeile;
      const links = `${x}px`;
      const top = `${Math.round(oben)}px`;
      if (box.style.left !== links) box.style.left = links;
      if (box.style.top !== top) box.style.top = top;
      box.style.animationDelay = `${Math.min(k, 6) * 18}ms`;
    });
  }

  function oeffnen(ids) {
    const gueltig = (ids || []).map(String).filter((id) => st.leute.has(id));
    if (gueltig.length < 2 || !ebeneHolen()) return;
    st.offen = gueltig;
    st.gerueckt = false;
    st.faecher.textContent = '';
    st.faecherBreite = 0;
    anordnen();
  }

  function schliessen() {
    if (!st.offen) return false;
    st.offen = null;
    if (st.faecher) st.faecher.textContent = '';
    anordnen();
    return true;
  }

  // Tipp auf einen Stapel: auffächern (zweiter Tipp: zu). Eine einzelne Person behält ihren Tipp (attrs).
  function tipp(ereignis) {
    const el = ereignis.target.closest?.('.crew-person');
    if (!el || !st.ebene?.contains(el)) return;
    const p = st.leute.get(el.dataset.id);
    if (!p?.oben || (p.gruppe?.length || 0) < 2) return;
    ereignis.stopPropagation();
    ereignis.preventDefault();
    rueckmeldung('tipp');
    const ids = p.gruppe.map((m) => m.id);
    if (st.offen && st.offen.join('|') === ids.join('|')) { schliessen(); return; }
    oeffnen(ids);
  }

  const steuerung = {
    setzen,
    anordnen,
    oeffnen,
    schliessen,
    zustand: () => ({ offen: st.offen ? [...st.offen] : [] }),
    zeigtMich: () => [...st.leute.values()].some((p) => p.ich),
    entfernen() {
      st.weg = true;
      st.ebene?.remove();
      st.ebene = null;
      st.faecher = null;
      st.offen = null;
      st.leute.clear();
      karte.__crewPersonen?.delete(schluessel);
      ichStellen(karte);
    },
  };
  karte.on('move', anordnen);
  karte.on('resize', anordnen);
  karte.once('load', anordnen);
  beiBewegungDurchMenschen(karte, () => { schliessen(); });
  karte.on('click', (ereignis) => {
    if (ereignis?.originalEvent?.target?.closest?.('.crew-person, .crew-person-faecher')) return;
    schliessen();
  });
  karte.__crewPersonen.set(schluessel, steuerung);
  return steuerung;
}

// Legt eine Karte in `container` an. Gibt die Karte zurück oder null, wenn es nicht geht
// (kein Netz, kein WebGL) — die aufrufende Stelle zeigt dann etwas Ehrliches statt einer
// leeren Fläche.
//
// optionen.hoehenRegler: true — Höhenregler und ⓘ in der festen Bedienspalte (KARTEN_SPALTE).
export async function karteAnlegen(container, optionen = {}) {
  try {
    const maplibregl = await ladeMapLibre();
    const karte = new maplibregl.Map({
      container,
      style: optionen.style || STYLE_URL,
      center: [optionen.mitte?.lon ?? START_MITTE.lon, optionen.mitte?.lat ?? START_MITTE.lat],
      zoom: optionen.zoom ?? 12.2,
      minZoom: ZOOM_OBEN,
      maxZoom: ZOOM_UNTEN,
      // Runde 5 (D2): MapLibres eigene Herkunftsangabe ist aus — sie steht im EINEN ⓘ der App
      // (infoAnbauen). Vorher gab es auf einer Karte zwei ⓘ.
      attributionControl: false,
      // Die App ist eine Handy-App: Drehen und Kippen würde nur stören.
      pitchWithRotate: false,
      dragRotate: false,
      touchPitch: false,
      interactive: optionen.interaktiv !== false,
    });
    karte.touchZoomRotate?.disableRotation();
    // Runde 5: Jede Karte trägt dieselbe Bedienung — ⓘ unten rechts, auf bedienbaren Karten den
    // Höhenregler mittig rechts — und zeigt meine Lage.
    try { infoAnbauen(karte); } catch { /* ohne ⓘ bleibt die Karte bedienbar */ }
    if (optionen.hoehenRegler) {
      try {
        hoehenReglerAnbauen(karte);
      } catch { /* ohne Regler bleibt die Karte bedienbar */ }
    }
    karte.on('resize', () => spalteBald(karte));
    karte.once('load', () => spalteBald(karte));
    if (typeof ResizeObserver === 'function') {
      const beobachter = new ResizeObserver(() => spalteBald(karte));
      beobachter.observe(container);
      karte.once('remove', () => beobachter.disconnect());
    }
    spalteOrdnen(karte);
    try { lageAnbauen(karte); } catch { /* ohne eigene Lage bleibt die Karte, wie sie ist */ }
    return karte;
  } catch (fehler) {
    console.warn('[Crew] Karte nicht verfügbar:', fehler?.message || fehler);
    return null;
  }
}

// Wartet, bis die Karte wirklich Bilder zeigt — erst dann ist ein Screenshot aussagekräftig.
export function warteAufKarte(karte, maxMs = 8000) {
  return new Promise((fertig) => {
    if (!karte) { fertig(false); return; }
    let erledigt = false;
    const ende = (wert) => { if (!erledigt) { erledigt = true; fertig(wert); } };
    if (karte.loaded()) ende(true);
    karte.once('idle', () => ende(true));
    karte.once('error', () => ende(false));
    setTimeout(() => ende(karte.loaded?.() || false), maxMs);
  });
}

// --- Ortssuche ---------------------------------------------------------------------------
// Ergebnisform wie im bisherigen Ortsbestand: { name, address, lat, lon }.
function ausPhoton(feature) {
  const p = feature.properties || {};
  const [lon, lat] = feature.geometry?.coordinates || [];
  const adresse = [
    [p.street, p.housenumber].filter(Boolean).join(' '),
    [p.postcode, p.city || p.district || p.county].filter(Boolean).join(' '),
    p.state,
  ].filter(Boolean).join(', ');
  return { name: p.name || p.street || p.city || t('Ort'), address: adresse, lat, lon };
}

export async function ortSuchen(text, optionen = {}) {
  const frage = String(text || '').trim();
  if (frage.length < 2) return [];
  const grenze = optionen.limit || 6;
  // Nach Vorarlberg gewichten: Wer „Strandbad" tippt, meint das hier, nicht eines in Kiel.
  const nahe = `&lat=${START_MITTE.lat}&lon=${START_MITTE.lon}`;
  try {
    const antwort = await fetch(`${PHOTON}?q=${encodeURIComponent(frage)}&limit=${grenze}&lang=${photonSprache()}${nahe}`, optionen.signal ? { signal: optionen.signal } : {});
    if (antwort.ok) {
      const daten = await antwort.json();
      const treffer = (daten.features || []).map(ausPhoton).filter((e) => typeof e.lat === 'number');
      if (treffer.length) return treffer;
    }
  } catch { /* weiter zum Rückfall */ }
  try {
    const antwort = await fetch(`${NOMINATIM}?q=${encodeURIComponent(frage)}&format=json&limit=${grenze}&accept-language=${aktiveSprache()}`, optionen.signal ? { signal: optionen.signal } : {});
    if (!antwort.ok) return [];
    const daten = await antwort.json();
    return (daten || []).map((e) => ({
      name: (e.display_name || '').split(',')[0],
      address: (e.display_name || '').split(',').slice(1, 4).join(',').trim(),
      lat: Number(e.lat),
      lon: Number(e.lon),
    }));
  } catch {
    return [];
  }
}

// Rückwärts: Was ist an dieser Stelle? Für „Ort auf der Karte wählen".
// Photon hat dafür einen EIGENEN Weg (/reverse), nicht /api/reverse — mit dem falschen Pfad
// kam hier nur ein 404 zurück, und der Bildschirm hätte eine Stelle ohne Namen gezeigt.
// Antwortet Photon nicht, fragt Nominatim; erst wenn auch das schweigt, bleibt es beim Nichts.
export async function ortAnPunkt(lat, lon) {
  try {
    const antwort = await fetch(`${PHOTON_REVERSE}?lat=${lat}&lon=${lon}&lang=${photonSprache()}&limit=1`);
    if (antwort.ok) {
      const daten = await antwort.json();
      const treffer = (daten.features || [])[0];
      if (treffer) return { ...ausPhoton(treffer), lat, lon };
    }
  } catch { /* weiter zum Rückfall */ }
  try {
    const antwort = await fetch(`${NOMINATIM_REVERSE}?lat=${lat}&lon=${lon}&format=json&accept-language=${aktiveSprache()}&zoom=18`);
    if (!antwort.ok) return null;
    const daten = await antwort.json();
    const a = daten.address || {};
    const strasse = [a.road || a.pedestrian || a.footway, a.house_number].filter(Boolean).join(' ');
    const ort = [a.postcode, a.city || a.town || a.village || a.municipality].filter(Boolean).join(' ');
    const name = strasse || a.amenity || a.shop || a.tourism || ort || (daten.display_name || '').split(',')[0];
    if (!name) return null;
    return { name, address: [ort, a.state].filter(Boolean).join(', '), lat, lon };
  } catch {
    return null;
  }
}

// --- Route an die Karten-App des Geräts ---------------------------------------------------
// Kein eingebauter Router: Wer losfährt, will seine gewohnte Navigation — mit seinen
// Einstellungen, seiner Stimme, seinen Offline-Karten.
// `anbieter` ist 'apple' oder 'google', wenn jemand ausdrücklich wählt. Ohne Wahl entscheidet
// das Gerät: Auf dem iPhone ist Apple Karten die eingebaute Navigation.
export function routenZiel(place, anbieter) {
  if (!place) return null;
  const hatKoordinaten = typeof place.lat === 'number' && typeof place.lon === 'number';
  const ziel = hatKoordinaten ? `${place.lat},${place.lon}` : '';
  const beschriftung = [place.name, place.address].filter(Boolean).join(', ');
  const vomGeraet = globalThis.navigator && /iPhone|iPad|iPod|Macintosh/.test(navigator.userAgent || '');
  const apple = anbieter === 'apple' || (anbieter !== 'google' && vomGeraet);
  if (apple) {
    return hatKoordinaten
      ? `https://maps.apple.com/?daddr=${encodeURIComponent(ziel)}&q=${encodeURIComponent(place.name || t('Ziel'))}`
      : `https://maps.apple.com/?q=${encodeURIComponent(beschriftung)}`;
  }
  return hatKoordinaten
    ? `https://www.google.com/maps/dir/?api=1&destination=${encodeURIComponent(ziel)}`
    : `https://www.google.com/maps/dir/?api=1&destination=${encodeURIComponent(beschriftung)}`;
}

export function oeffneRoute(place, anbieter) {
  const url = routenZiel(place, anbieter);
  if (!url) return false;
  globalThis.open?.(url, '_blank', 'noopener');
  return true;
}

// Hat dieser Ort echte Koordinaten? Nur dann lässt er sich auf einer Karte zeigen.
export function hatKoordinaten(place) {
  return Boolean(place && typeof place.lat === 'number' && typeof place.lon === 'number');
}

// --- Eine Karte je Bildschirmstelle ------------------------------------------------------
// Die App zeichnet bei jeder Änderung neu. Eine Karte darf das nicht mitmachen: Sie hängt an
// ihrem Knoten (der über data-fremd vom Abgleich ausgenommen ist) und wird beim nächsten
// Render weiterverwendet, statt neu aufgebaut zu werden.
const karten = new Map();
const kartenImBau = new Map();

// Bedienbar oder nur Bild? Das kann sich im Laufe eines Bildschirms ÄNDERN — die Karte im
// Ort-Sheet ist erst ein ruhiges Bild und wird zum Wählen bedienbar. Weil dieselbe Karte
// weiterlebt, muss das umgestellt werden können; wäre es nur eine Angabe beim Anlegen,
// bliebe sie für immer starr (genau das war sie, und „Ort auf der Karte wählen" ließ sich
// nicht schieben).
export function karteBedienbar(karte, an) {
  if (!karte) return;
  for (const teil of ['dragPan', 'scrollZoom', 'doubleClickZoom', 'touchZoomRotate', 'keyboard', 'boxZoom']) {
    if (an) karte[teil]?.enable?.();
    else karte[teil]?.disable?.();
  }
  if (an) karte.touchZoomRotate?.disableRotation();
  const behaelter = karte.getContainer?.();
  if (behaelter) behaelter.style.cursor = an ? 'grab' : '';
}

export async function karteHalten(knoten, schluessel, optionen = {}) {
  const vorhanden = karten.get(schluessel);
  if (vorhanden && vorhanden.knoten === knoten && !vorhanden.tot) {
    if (optionen.mitte && optionen.folgen !== false) {
      vorhanden.karte?.setCenter([optionen.mitte.lon, optionen.mitte.lat]);
    }
    if (optionen.interaktiv !== undefined) karteBedienbar(vorhanden.karte, optionen.interaktiv !== false);
    // Neu gezeichnet: Was die Seite über die Karte legt, kann sich geändert haben.
    spalteBald(vorhanden.karte);
    return vorhanden.karte;
  }
  // Runde 5 (D2): Zwei Zeichnungen kurz hintereinander legten zwei MapLibre-Karten in DENSELBEN Knoten
  // (gemessen auf „Auf Karte wählen": zwei Punkte für meine Lage; vorher zwei Herkunftsangaben, also zwei
  // ⓘ). Wird eine Karte für diesen Knoten gerade angelegt, warten alle auf dieselbe Anlage.
  const imBau = kartenImBau.get(schluessel);
  if (imBau && imBau.knoten === knoten) return imBau.versprechen;
  if (vorhanden) { try { vorhanden.karte?.remove(); } catch { /* egal */ } karten.delete(schluessel); }
  const versprechen = karteAnlegen(knoten, optionen);
  kartenImBau.set(schluessel, { knoten, versprechen });
  const karte = await versprechen.finally(() => { if (kartenImBau.get(schluessel)?.versprechen === versprechen) kartenImBau.delete(schluessel); });
  if (!karte) return null;
  karten.set(schluessel, { knoten, karte, tot: false });
  // Wenn der Knoten aus dem Dokument verschwindet, verschwindet auch die Karte.
  const wache = new MutationObserver(() => {
    if (!knoten.isConnected) {
      wache.disconnect();
      const eintrag = karten.get(schluessel);
      if (eintrag && eintrag.knoten === knoten) {
        try { eintrag.karte.remove(); } catch { /* egal */ }
        karten.delete(schluessel);
      }
    }
  });
  wache.observe(document.body, { childList: true, subtree: true });
  return karte;
}

// Zugriff auf eine gehaltene Karte — für Prüfläufe, die nachsehen wollen, WO die Karte
// gerade steht, und für Bindungen, die eine schon stehende Karte ohne Warten weiterbenutzen.
export function karteVon(schluessel) {
  const eintrag = karten.get(schluessel);
  return eintrag && !eintrag.tot ? eintrag.karte : null;
}

export function projiziere(karte, punkt) {
  if (!karte || !hatKoordinaten(punkt)) return null;
  const p = karte.project([punkt.lon, punkt.lat]);
  return { x: p.x, y: p.y };
}

export function passeAufPunkte(karte, punkte, optionen = {}) {
  const echte = (punkte || []).filter(hatKoordinaten);
  if (!karte || !echte.length) return;
  if (echte.length === 1) {
    karte.jumpTo({ center: [echte[0].lon, echte[0].lat], zoom: optionen.zoom ?? 14 });
    return;
  }
  const lats = echte.map((p) => p.lat);
  const lons = echte.map((p) => p.lon);
  karte.fitBounds(
    [[Math.min(...lons), Math.min(...lats)], [Math.max(...lons), Math.max(...lats)]],
    { padding: optionen.padding ?? 70, animate: false, maxZoom: optionen.maxZoom ?? 15 },
  );
}
