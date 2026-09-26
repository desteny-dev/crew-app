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
import { meterProPixel } from '../core/entfernung.js';

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

// --- Die Bedienleiste: Höhenregler senkrecht mittig rechts, ⓘ unten rechts --------------------
// Runde 4 standen beide als EINE Spalte oben rechts (Regler ab 24 px, ⓘ direkt darunter), und alles,
// was eine Seite über die Karte legte, hielt rechts 64 px frei.
// Runde 5 (Jonathan): „Der Info-Button der Map sollte immer unten rechts sein, unabhängig vom Zoom-
// Slider." → ⓘ unten rechts, Regler senkrecht mittig rechts.
// Runde 6 (C4) lag er kurz waagrecht unten — Jonathan hat das zurückgenommen: „er bleibt vertikal
// wie er war". Also wieder senkrecht, in derselben Spalte wie das ⓘ, mittig auf der Höhe.
// Die fünf Höhen stehen als ZEICHEN auf der Spur (oben Raumschiff = weit weg, unten Vogel = nah
// dran), die Kugel trägt das Zeichen der Höhe, auf der man gerade ist.
// Es gilt auf JEDER Karte:
//   • ⓘ unten rechts, Regler darüber in derselben 44-px-Spalte am rechten Rand.
//   • Legt die Seite unten etwas über die Karte (z. B. „Ort übernehmen"), steigt das ⓘ darüber, und
//     der Regler rückt mit nach oben — nichts wird zur Seite gedrückt.
//   • Bleiben dem Regler keine 120 px Höhe, tritt er zurück, statt etwas zu verdecken; zoomen geht
//     weiter mit zwei Fingern, Rad und Doppeltipp.
// Was eine Seite über eine Karte legt, trägt das Merkmal data-ueber-karte — mehr ist nicht zu tun.
export const KARTEN_SPALTE = Object.freeze({
  rechts: 10, breite: 44, abstand: 8, info: 44, rand: 10,
  // Runde 6 (C4): Höhe des Bandes unten und die Breite, unter der der Regler zurücktritt.
  band: 44, reglerMinBreite: 150,
  // Runde 5 (bleibt für Aufrufer, die sie noch lesen): Maße des früheren senkrechten Reglers.
  regler: 300, reglerMin: 120, anteil: 0.46,
  // Nur noch für Ausschnitte, die die App SELBST wählt (Einpassen, Markierung ins Bild rücken): so
  // viel bleibt rechts, damit nichts, was die App hinstellt, unter dem ⓘ landet. Überlagerungen
  // der Seite halten diesen Platz NICHT mehr frei (Runde 5, D3).
  frei: 64,
});
const INFO_KNOPF = 24;
// #free-button: der FREE-Knopf steht unten mittig ÜBER der Crew-Karte, trägt das Merkmal aber noch
// nicht (web/screens/crew.js gehört P1). Seit Runde 6 liegt die Bedienleiste unten — ohne diese
// Ausnahme läge der Regler unter dem Knopf. Sobald P1 dort data-ueber-karte setzt, kann sie raus.
// Runde 6 (Chef): Der FREE-Knopf stand hier als benannte Ausnahme, weil er das Merkmal noch
// nicht trug (P4 konnte components.js nicht anfassen). Jetzt sagt er es selbst — und die
// Regel bleibt allgemein: Wer ueber einer Karte liegt, traegt data-ueber-karte.
// Runde 7 (Welle 3): Das Hinweis-Band des Guides (ui/guide.js › erlaubnis-band) stand hier kurz
// als benannte Ausnahme, weil es sich auf 360 px ueber die untere Bedienung des Karten-Tabs legte.
// Es ist wieder heraus: Das Band weicht seit dieser Welle SELBST aus (guide.js ›
// schwebendHindernis misst, was schwebt, und steigt darueber). Zwei Stellen, die einander
// ausweichen, jagen sich — gemessen landete der Zeitraum-Regler dann wieder unter dem Band.
// EINE Stelle entscheidet. Geprueft wird das Ergebnis in scratch/r7b-karte.mjs, Abschnitt W4.
const UEBER_KARTE = '[data-ueber-karte]';
// Runde 6 (C5): Eine eigene Kartenfläche (die große Ansicht in der App) ist eine eigene Ebene —
// was auf der Seite DARUNTER über einer Karte liegt, geht sie nichts an.
const KARTEN_EBENE_WAHL = '.ui-sheet-card, [data-karten-flaeche]';

// Was die Seite über DIESE Karte legt, in Karten-Pixeln (auch in einer skalierten Vorschau). Gezählt
// wird nur, was sichtbar ist und in derselben Ebene liegt — nicht der Inhalt eines Sheets darüber.
function ueberlagerungen(behaelter, breite, hoehe) {
  const rahmen = behaelter.getBoundingClientRect();
  const faktor = behaelter.offsetWidth ? rahmen.width / behaelter.offsetWidth : 1;
  const blatt = behaelter.closest(KARTEN_EBENE_WAHL);
  const liste = [];
  for (const el of document.querySelectorAll(UEBER_KARTE)) {
    if (behaelter.contains(el) || el.contains(behaelter) || el.closest(KARTEN_EBENE_WAHL) !== blatt) continue;
    // Runde 9: Was UNTER dem Regler steht (data-unter-regler), stellt die Spalte selbst — es ist
    // kein Hindernis, sondern ein Teil von ihr (spalteRechnen › unter).
    if (el.hasAttribute('data-unter-regler')) continue;
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
//
// Runde 6 (C4): Beide liegen in EINEM Band am unteren Rand. Legt die Seite dort etwas über die
// Karte, steigt das ganze Band darüber — es rückt nie zur Seite, und nichts wird nach links
// gedrückt (Runde 5, D3 gilt weiter).
//
// Runde 9 (Jonathan: „Filterknöpfe rechts direkt UNTER dem Zoom-Regler"): `unterHoehe` ist die Höhe
// eines Blocks, der in derselben Spalte direkt unter dem Regler steht (kurzer Abstand unter dem
// Vogel). Der Regler macht ihm Platz; ohne Regler steht der Block über dem ⓘ.
//   → zusätzlich { unter: {l,r,o,u} | null }
export function spalteRechnen(breite, hoehe, hindernisse = [], mitRegler = true, unterHoehe = 0) {
  const S = KARTEN_SPALTE;
  const r = breite - S.rand;
  const l = r - S.breite;                       // die 44-px-Spalte am rechten Rand
  // Das ⓘ sitzt unten in dieser Spalte und weicht nach OBEN aus, wenn die Seite dort etwas über die
  // Karte legt. Höchstens so oft anheben, wie es Hindernisse gibt (jedes hebt nur einmal).
  let u = hoehe - S.rand;
  for (let runde = 0; runde <= hindernisse.length; runde += 1) {
    const o = u - S.info;
    const stoerer = hindernisse.filter((f) => f.l < r && f.r > l && f.o < u - 0.5 && f.u > o + 0.5);
    if (!stoerer.length) break;
    const neu = Math.min(...stoerer.map((f) => f.o - S.abstand));
    if (!(neu < u - 0.5)) break;
    u = neu;
  }
  u = Math.max(S.rand + S.info, Math.min(hoehe - S.rand, u));
  const info = { l, r, o: u - S.info, u };
  const block = Math.max(0, Number(unterHoehe) || 0);
  const unterUeberInfo = block ? { l, r, o: info.o - S.abstand - block, u: info.o - S.abstand } : null;
  if (!mitRegler) return { info, regler: null, unter: unterUeberInfo };
  // Der Regler steht senkrecht in derselben Spalte und endet über dem ⓘ.
  // Runde 8 (R8-34): Oben in derselben Spalte darf die Seite eigene runde Knöpfe tragen (die Filter
  // des Karten-Tabs). Der Regler beginnt dann darunter — nichts rückt zur Seite, nichts wird verdeckt
  // (dieselbe Regel wie beim ⓘ, nur von oben her).
  const obenGrenze = hindernisse
    .filter((f) => f && f.l < r && f.r > l && f.o < hoehe / 2)
    .reduce((grenze, f) => Math.max(grenze, f.u + S.abstand), S.rand);
  const untenGrenze = info.o - S.abstand - (block ? block + S.abstand : 0);
  const platz = untenGrenze - obenGrenze;
  const hoeheRegler = Math.min(S.regler, platz);
  if (hoeheRegler < S.reglerMin) return { info, regler: null, unter: unterUeberInfo };
  // Mittig auf der Karte, aber nie über die Grenzen hinaus.
  const mitte = Math.min(Math.max(hoehe * S.anteil, obenGrenze + hoeheRegler / 2), untenGrenze - hoeheRegler / 2);
  const o = Math.round(mitte - hoeheRegler / 2);
  const regler = { l, r, o, u: o + Math.round(hoeheRegler) };
  const unter = block ? { l, r, o: regler.u + S.abstand, u: regler.u + S.abstand + block } : null;
  return { info, regler, unter };
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
  // Runde 9: Ein Block der Seite, der direkt unter dem Regler stehen will (die Filter des Karten-Tabs).
  // Er liegt neben der Karte im selben Rahmen; seine Höhe in Layout-Pixeln.
  const unterBlock = behaelter.parentElement?.querySelector(':scope > [data-unter-regler]') || null;
  const lage = spalteRechnen(breite, hoehe, ueberlagerungen(behaelter, breite, hoehe), Boolean(regler), unterBlock?.offsetHeight || 0);
  if (unterBlock && lage.unter) {
    // Die Scheiben stehen auf der Achse der Spalte; die Trefferfläche darf breiter sein als sie.
    const oben = `${Math.round(lage.unter.o + behaelter.offsetTop)}px`;
    if (unterBlock.style.top !== oben) unterBlock.style.top = oben;
    if (unterBlock.style.visibility) unterBlock.style.visibility = '';
  }
  const info = behaelter.querySelector(':scope > [data-role="karten-info"]');
  if (info) {
    const unten = `${Math.round(hoehe - lage.info.u)}px`;
    if (info.style.bottom !== unten) info.style.bottom = unten;
    info.style.setProperty('--crew-info-max', `${Math.max(150, breite - 2 * KARTEN_SPALTE.rand)}px`);
  }
  if (regler) karte.__hoehenRegler?.stellen(lage.regler);
  const vorher = JSON.stringify(karte.__crewSpalte || null);
  karte.__crewSpalte = lage;
  // Die Bedienung hat sich verschoben — also auch das, was über der Karte liegt (belegteFlaechen).
  karte.__crewBelegtFlaechen = null;
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
  return lage ? [lage.regler, lage.unter, lage.info].filter(Boolean) : [];
}

// Runde 4 (bleibt für Aufrufer): die Fläche des Reglers, ohne Regler die des ⓘ.
export function bedienSpalteFlaeche(karte) {
  return bedienFlaechen(karte)[0] || null;
}

// --- Was über DIESER Karte liegt: EINE Wahrheit (Runde 7, V1) -------------------------------
// Gemessen (Prüfer, Welle 1): Auf karte.home lag ein Gesicht vollständig unter der neuen
// Ebenen-Leiste — unsichtbar UND nicht antippbar; ein Tipp darauf schaltete die Ebene um, statt
// die Person zu öffnen. Die Ursache war NICHT ein zu kleiner Randabstand (der wäre auf dem
// nächsten Gerät wieder falsch), sondern: Die Karte wusste gar nicht, welche Flächen belegt
// sind. Nur die Bedienspalte (Regler, ⓘ) kannte sie; alles andere musste jede Seite selbst
// nachmessen und durchreichen — und wer das vergaß, verdeckte seine eigenen Marken.
// Jetzt fragt jede Markierungsebene DIESE eine Stelle: Bedienspalte + alles, was eine Seite mit
// data-ueber-karte über die Karte legt, zur Laufzeit gemessen und in Karten-Pixeln.
const BELEGT_TAKT_MS = 200;

export function belegteFlaechen(karte) {
  const behaelter = karte?.getContainer?.();
  if (!behaelter?.isConnected) return [];
  const stand = karte.__crewBelegtFlaechen;
  const jetzt = Date.now();
  // Während eines Fingerzugs ordnet sich jede Ebene in JEDEM Bild neu. Was über der Karte liegt,
  // bewegt sich dabei nicht mit — ein kurzer Takt reicht und spart ein erzwungenes Layout je Bild.
  if (stand && jetzt - stand.zeit < BELEGT_TAKT_MS) return stand.liste;
  const breite = behaelter.clientWidth || 0;
  const hoehe = behaelter.clientHeight || 0;
  const liste = breite && hoehe
    ? [...bedienFlaechen(karte), ...ueberlagerungen(behaelter, breite, hoehe)]
    : [...bedienFlaechen(karte)];
  karte.__crewBelegtFlaechen = { zeit: jetzt, liste };
  return liste;
}

// --- Runde 8 (R8-30/31): Nichts weicht mehr aus ------------------------------------------------
// Bis Runde 7 stand hier die Funktion ausweichen: Ein Schild oder Gesicht, das unter einer Leiste der Seite lag,
// rückte heraus und hielt sich mit einer feinen Linie an seinem Punkt fest. Jonathan (Runde 8): „Keine
// Striche an Meets … IMMER an ihrem Ort, sie stapeln sich mit allem (auch mit Personen), ohne Leute
// wegzuschieben." Seitdem steht alles, was die Karte zeigt, genau auf seinem Ort; was über der Karte
// schwebt (Regler, Filter, ⓘ), liegt eben darüber — wie auf jeder Karte, und ein Fingerzug holt es
// hervor. Eine Linie, die erklären muss, wo etwas eigentlich hingehört, gibt es damit nicht mehr.

// --- Höhenregler: zoomen mit einem Regler, von links (weit weg) nach rechts (nah dran) ----
// Runde 2 (Jonathan): „ein Slider von oben nach unten, um zoomen zu können — und je nach
// Höhe sieht man einen Vogel, Helikopter, Flugzeug, Satelliten oder sogar ein Raumschiff."
// Der Knopf trägt das Zeichen der Höhe, auf der man gerade ist.
// Runde 3: länger (nicht nur drei Zentimeter), größerer Knopf. Runde 4: feste Lage und Höhe (oben).
// Runde 5: senkrecht mittig rechts. Runde 6 (C4, „der meet map slider soll unten sein"): waagrecht
// unten in Daumennähe, die fünf Höhen als Zeichen auf der Spur.
const ZOOM_OBEN = 2.5;   // ganz oben am Regler: weit weg
const ZOOM_UNTEN = 18;   // ganz unten: nah dran
// Runde 8 (R8-33, Jonathan): „Zoom-Regler gleichmäßig: Rakete oben mittig im oberen Rund, Vogel
// unten mittig im unteren Rund, Flugzeug genau in der Mitte, Satellit mittig zwischen Flugzeug und
// Rakete, Helikopter mittig zwischen Flugzeug und Vogel." Bis Runde 7 stand jedes Zeichen an seiner
// Zoom-SCHWELLE — dadurch klebten Rakete und Satellit oben zusammen, und der Vogel hing über dem
// unteren Rund. Jetzt stehen die fünf in GLEICHEN Abständen (anteil 0, ¼, ½, ¾, 1 der Strecke von
// der Mitte des oberen Runds bis zur Mitte des unteren), und die Kugel läuft genau dieselbe Strecke.
// Welches Zeichen sie trägt, entscheidet die NÄCHSTE Marke: Die Grenzen liegen jeweils mittig
// zwischen zwei Marken. Steht die Kugel auf einer Marke, trägt sie genau deren Zeichen.
const hoeheBei = (anteil) => ZOOM_OBEN + anteil * (ZOOM_UNTEN - ZOOM_OBEN);
const HOEHEN = [
  { anteil: 1, ab: hoeheBei(0.875), zeichen: 'vogel', wort: t('Vogel') },
  { anteil: 0.75, ab: hoeheBei(0.625), zeichen: 'helikopter', wort: t('Helikopter') },
  { anteil: 0.5, ab: hoeheBei(0.375), zeichen: 'flugzeug', wort: t('Flugzeug') },
  { anteil: 0.25, ab: hoeheBei(0.125), zeichen: 'satellit', wort: t('Satellit') },
  { anteil: 0, ab: -Infinity, zeichen: 'rakete', wort: t('Raumschiff') },
];

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
// Die Spur ist 4 px schmaler als die Kugel; ihr oberes und unteres Rund haben diesen Halbmesser.
// Die Mitten dieser beiden Runde sind Anfang und Ende der Strecke (R8-33).
const SPUR_RUND = (REGLER_KNOPF - 4) / 2;
// Runde 6 (Jonathan: „die kugel die man … zieht die wird größer und solider links raus, damit das
// logo neben dem Finger ist, und nicht darunter") — danach, am 17.09., wanderte nur noch das
// ZEICHEN heraus, und die Kugel blieb unter dem Finger liegen.
// Runde 7 (K5, Jonathan: „nicht nur das icon links raus, sondern der kreis zusätzlich … der kreis
// muss auch raus und größer werden"): Jetzt wandert die KUGEL SELBST nach links aus dem Regler
// heraus und wird größer — mit ihrem Zeichen, das darin noch einmal wächst. Der Finger bleibt auf
// der Spur, die Kugel steht frei daneben: Man SIEHT, was man einstellt, statt es zu verdecken.
// 54 px: eine Fingerkuppe ist rund 44 breit, die gewachsene Kugel 52 — so steht sie GANZ
// neben dem Regler statt halb darin, und der Finger verdeckt nichts davon.
// Alles andere am Regler bleibt, wie es war (senkrecht rechts, Runde 6): „ansonsten passt alles".
const KUGEL_AUS = 54;
const KUGEL_GROSS = 1.3;
const ZEICHEN_GROSS = 1.2;
const KNOPF_RUHE = '0 2px 8px var(--shadow-22),0 0 0 1px var(--ink-a10)';
const KNOPF_ZUG = '0 0 0 1.5px var(--ink-a16),0 10px 26px var(--shadow-30)';

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
  // Lage und Höhe setzt die Bedienleiste (spalteOrdnen): senkrecht am rechten Rand, über dem ⓘ.
  regler.style.cssText = `position:absolute;right:${S.rand}px;top:0;width:${S.breite}px;height:${S.regler}px;z-index:${EBENE_REGLER};touch-action:none;cursor:ns-resize;outline:none`;
  // Die fünf Höhen stehen als ZEICHEN auf der Spur — oben weit weg (Raumschiff), unten nah dran
  // (Vogel). So sieht man, wohin der Weg führt, ohne ihn zu gehen. R8-33: in gleichen Abständen.
  const marken = HOEHEN.map((stufe) => `<span data-role="hoehenmarke" data-zeichen="${stufe.zeichen}" data-ab="${Number.isFinite(stufe.ab) ? stufe.ab.toFixed(4) : ZOOM_OBEN}" data-anteil="${stufe.anteil.toFixed(4)}" style="position:absolute;left:50%;top:0;width:16px;height:16px;margin:-8px 0 0 -8px;display:flex;align-items:center;justify-content:center;pointer-events:none">${hoehenZeichen(stufe.zeichen, 'var(--ink-a35)', 15)}</span>`).join('');
  regler.innerHTML = `<div data-role="hoehenspur" style="position:absolute;top:0;bottom:0;left:50%;width:${REGLER_KNOPF - 4}px;margin-left:${-(REGLER_KNOPF - 4) / 2}px;border-radius:${(REGLER_KNOPF - 4) / 2}px;background:var(--surface);box-shadow:0 0 0 1px var(--ink-a08),0 2px 10px var(--shadow-14);pointer-events:none"></div>${marken}`
    + `<div data-role="hoehenknopf" style="position:absolute;top:0;left:50%;width:${REGLER_KNOPF}px;height:${REGLER_KNOPF}px;margin-left:${-REGLER_KNOPF / 2}px;box-sizing:border-box;pointer-events:none">`
    + `<span data-role="hoehenkugel" style="position:absolute;left:0;top:0;width:100%;height:100%;box-sizing:border-box;border-radius:50%;background:var(--field);box-shadow:${KNOPF_RUHE};display:flex;align-items:center;justify-content:center;transition:box-shadow .15s ease,background-color .15s ease,transform .16s cubic-bezier(.2,.9,.25,1)">`
    + `<span data-role="hoehenzeichen" style="display:flex;flex:none;transition:transform .16s cubic-bezier(.2,.9,.25,1),filter .16s ease"></span></span></div>`;
  behaelter.appendChild(regler);
  const knopf = regler.querySelector('[data-role="hoehenknopf"]');
  const kugel = regler.querySelector('[data-role="hoehenkugel"]');
  const zeichenFeld = regler.querySelector('[data-role="hoehenzeichen"]');
  const stand = { laenge: S.regler - 2 * SPUR_RUND };
  let zug = null;

  const zeigen = () => {
    const zoom = karte.getZoom();
    const anteil = Math.max(0, Math.min(1, (zoom - ZOOM_OBEN) / (ZOOM_UNTEN - ZOOM_OBEN)));
    // R8-33: Die MITTE der Kugel läuft die Strecke der Marken — von der Mitte des oberen Runds bis
    // zur Mitte des unteren. Steht sie auf einer Marke, liegt sie genau über deren Zeichen.
    const y = Math.round(SPUR_RUND - REGLER_KNOPF / 2 + anteil * stand.laenge);
    const stufe = hoeheFuerZoom(zoom);
    if (knopf.dataset.zeichen !== stufe.zeichen) {
      const vorher = knopf.dataset.zeichen;
      knopf.dataset.zeichen = stufe.zeichen;
      zeichenFeld.innerHTML = hoehenZeichen(stufe.zeichen, 'var(--ink)', 22);
      regler.setAttribute('aria-valuetext', stufe.wort);
      if (vorher && !bewegungGedrosselt()) {
        zeichenFeld.firstElementChild?.animate?.([{ opacity: 0, transform: 'scale(.6)' }, { opacity: 1, transform: 'none' }], { duration: 200, easing: 'cubic-bezier(.2,.9,.25,1)' });
      }
    }
    knopf.style.transform = `translateY(${y}px)`;
    regler.setAttribute('aria-valuenow', zoom.toFixed(1));
  };

  // Ruhe ↔ Zug (Jonathan, 17.09.): Der Regler bleibt, wie er ist. Nur das ZEICHEN wandert nach links
  // aus dem Regler heraus und wird größer — der Finger liegt auf der Kugel, also muss das, was er
  // wissen will, NEBEN ihm stehen. Gerechnet wird mit einer Fingerkuppe von rund 44 px.
  // Ruhe ↔ Zug (Runde 7, K5): Der Regler bleibt, wie er ist — die KUGEL wandert nach links aus ihm
  // heraus und wird größer, ihr Zeichen darin ebenso. Der Finger bleibt auf der Spur, also steht
  // beides NEBEN ihm statt darunter. Gerechnet mit einer Fingerkuppe von rund 44 px.
  const zugZeigen = (an) => {
    if (an) {
      knopf.dataset.zug = '1';
      kugel.style.boxShadow = KNOPF_ZUG;
      kugel.style.background = 'var(--surface)';
      kugel.style.transform = `translateX(${-KUGEL_AUS}px) scale(${KUGEL_GROSS})`;
      zeichenFeld.style.transform = `scale(${ZEICHEN_GROSS})`;
      // Damit das Zeichen über jeder Karte lesbar bleibt, trägt es einen weichen Saum.
      zeichenFeld.style.filter = 'drop-shadow(0 1px 4px var(--shadow-22))';
    } else {
      delete knopf.dataset.zug;
      kugel.style.boxShadow = KNOPF_RUHE;
      kugel.style.background = 'var(--field)';
      kugel.style.transform = '';
      zeichenFeld.style.transform = '';
      zeichenFeld.style.filter = '';
    }
    zeigen();
  };

  // Lage und Höhe kommen aus der Bedienleiste (spalteOrdnen). Ohne Platz (null) tritt der Regler zurück.
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
    if (regler.style.width !== `${Math.round(flaeche.r - flaeche.l)}px`) regler.style.width = `${Math.round(flaeche.r - flaeche.l)}px`;
    stand.laenge = gesamt - 2 * SPUR_RUND;
    for (const marke of regler.querySelectorAll('[data-role="hoehenmarke"]')) {
      marke.style.top = `${Math.round(SPUR_RUND + Number(marke.dataset.anteil) * stand.laenge)}px`;
    }
    zeigen();
  };

  const zoomAn = (clientY, griff) => {
    const rahmen = regler.getBoundingClientRect();
    // In einer skalierten Vorschau (Desktop) sind Zeiger- und Layout-Pixel verschieden.
    const faktor = regler.offsetHeight ? rahmen.height / regler.offsetHeight : 1;
    const lokal = (clientY - rahmen.top) / (faktor || 1) - griff;
    const anteil = Math.max(0, Math.min(1, (lokal - SPUR_RUND) / (stand.laenge || 1)));
    return ZOOM_OBEN + anteil * (ZOOM_UNTEN - ZOOM_OBEN);
  };
  regler.addEventListener('pointerdown', (ereignis) => {
    if (ereignis.button) return;
    ereignis.stopPropagation();
    ereignis.preventDefault();
    regler.setPointerCapture?.(ereignis.pointerId);
    menschBewegt(karte);
    const rahmen = knopf.getBoundingClientRect();
    const aufKnopf = ereignis.clientY >= rahmen.top - 4 && ereignis.clientY <= rahmen.bottom + 4;
    // Wer die Kugel greift, zieht sie von dort, wo er sie gefasst hat — sie springt nicht unter den
    // Finger. Ein Tipp daneben fährt weich an die Stelle.
    const faktor = regler.offsetHeight ? regler.getBoundingClientRect().height / regler.offsetHeight : 1;
    zug = { griff: aufKnopf ? (ereignis.clientY - (rahmen.top + rahmen.height / 2)) / (faktor || 1) : 0 };
    zugZeigen(true);
    if (!aufKnopf) karte.easeTo({ zoom: zoomAn(ereignis.clientY, 0), duration: 220 });
  });
  regler.addEventListener('pointermove', (ereignis) => {
    if (!zug) return;
    ereignis.stopPropagation();
    karte.stop?.();
    karte.setZoom(zoomAn(ereignis.clientY, zug.griff));
  });
  const loslassen = (ereignis) => {
    if (!zug) return;
    zug = null;
    ereignis.stopPropagation();
    zugZeigen(false);
  };
  regler.addEventListener('pointerup', loslassen);
  regler.addEventListener('pointercancel', loslassen);
  regler.addEventListener('keydown', (ereignis) => {
    // Oben ist weit weg, unten ist nah dran — wie die Spur selbst. Runter und rechts heißt deshalb
    // „näher dran", hoch und links „weiter weg".
    const schritt = ['ArrowDown', 'ArrowRight'].includes(ereignis.key) ? 0.5 : ['ArrowUp', 'ArrowLeft'].includes(ereignis.key) ? -0.5 : 0;
    if (!schritt) return;
    ereignis.preventDefault();
    menschBewegt(karte);
    karte.easeTo({ zoom: Math.max(ZOOM_OBEN, Math.min(ZOOM_UNTEN, karte.getZoom() + schritt)), duration: 180 });
  });
  // Ein Tipp auf den Regler darf nichts darunter öffnen (Kacheln, Personen).
  regler.addEventListener('click', (ereignis) => { ereignis.stopPropagation(); ereignis.preventDefault(); });
  // Das Rad über dem Regler zoomt die Karte — wie überall sonst auf ihr.
  radAnKarte(karte, regler);
  // 'move' statt 'zoom': Die Kugel steht damit im selben Bild an ihrer neuen Stelle, BEVOR später
  // angemeldete Lauscher (die Anordnung der Markierungen) sie messen — auch bei einem Sprung.
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
// ruhig wie auf den Karten des Geräts: Punkt, weißer Rand, leichter Hof.
// Runde 6 (C1, Jonathan: „bei standort sollte der standort nicht blau sondern grün sein"): Der Punkt
// trägt jetzt das Grün der App (Token --karte-ich, hell und dunkel in styles.css). Er bleibt trotzdem
// eindeutig: 18 px mit weißem 3-px-Rand, feinem grünen Haarring und 40-px-Hof — der Ortspunkt einer
// Markierung ist 10 px ohne Hof mit Rand in --surface, eine Person ist eine 36-px-Bildscheibe. Ist die
// Lage nicht mehr frisch (genau: false), wird der Punkt grau und verliert den Hof. Das Zuhause ist KEIN Standort
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
  const meter = Number(lage.genauigkeitM);
  return { lat, lon, genau: Boolean(lage.genau), quelle: String(lage.quelle || ''), genauigkeitM: Number.isFinite(meter) && meter > 0 ? meter : null };
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
    el.innerHTML = '<span class="crew-ich-punkt"></span>';
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
  // Runde 9: Am eigenen Punkt steht KEIN Genauigkeitskreis mehr — der Kreis gehört allein zur
  // angetippten Person (genauKreisZeigen).
}

// --- Genauigkeit: EIN Meterkreis, nur für die angetippte Person (Runde 9) --------------------
// Jonathan: „Der Radius nur, wenn man eine Person antippt — sonst nie. Und nur, wenn der Standort
// wirklich ungenau ist." Bis Runde 8 stand um jede Lage ein DOM-Kreis mit pulsierenden Ringen; sein
// Halbmesser war in Pixeln gerechnet und am Bildrand gedeckelt — beim Heranzoomen blieb er deshalb
// stehen, während die Karte wuchs, und sah aus, als schrumpfe er. Jetzt:
//   · EIN Kreis als GeoJSON-Fläche in MapLibre, in Metern: Er ist Teil der Karte und skaliert mit
//     ihr wie eine Straße — kein Pixel-Halbmesser, kein Deckel, kein Pulsen.
//   · Er steht nur, solange das Blatt einer Person offen ist (screens/karte.js › karteEinrichten).
//   · Erst ab GENAU_MIN_M. Begründung der 50 m: GPS unter freiem Himmel meldet 3–20 m, WLAN-Ortung
//     20–50 m — in diesem Bereich liegt der Punkt im selben Haus oder am selben Platz, und der Punkt
//     IST die Antwort („sie ist dort"). Ab 50 m (Funkzelle, Gebäude, grobe Ortung) kann es das
//     Lokal nebenan sein; erst dann sagt ein Kreis etwas, das der Punkt nicht sagt. Ohne gemeldete
//     Zahl gibt es keinen Kreis — erfunden wird nichts (projections.js › genauigkeitVon).
export const GENAU_MIN_M = 50;
const GENAU_QUELLE = 'crew-genau';
const GENAU_LEER = Object.freeze({ type: 'FeatureCollection', features: [] });

// Meter je Pixel: EINE Rechnung für die ganze App (core/entfernung.js).
export function meterJePixel(lat, zoom) {
  return meterProPixel(Number(lat), Number(zoom));
}

// Ist diese Genauigkeit einen Kreis wert?
export function genauUngenau(meter) {
  const m = Number(meter);
  return Number.isFinite(m) && m >= GENAU_MIN_M;
}

function kreisGrenzen(lat, lon, meter) {
  const dLat = meter / 111320;
  const dLon = meter / (111320 * Math.max(0.01, Math.cos((lat * Math.PI) / 180)));
  return [[lon - dLon, lat - dLat], [lon + dLon, lat + dLat]];
}

function kreisFlaeche(lat, lon, meter, schritte = 72) {
  const [[l0, b0], [l1, b1]] = kreisGrenzen(lat, lon, meter);
  const rLon = (l1 - l0) / 2;
  const rLat = (b1 - b0) / 2;
  const ring = [];
  for (let i = 0; i <= schritte; i += 1) {
    const w = (i / schritte) * Math.PI * 2;
    ring.push([lon + rLon * Math.cos(w), lat + rLat * Math.sin(w)]);
  }
  return { type: 'Feature', properties: { meter }, geometry: { type: 'Polygon', coordinates: [ring] } };
}

function gruenDerApp() {
  try {
    const wert = getComputedStyle(document.documentElement).getPropertyValue('--green').trim();
    return wert || '#1b9e5f';
  } catch { return '#1b9e5f'; }
}

// Zeigt den Kreis zu `lage` ({ lat, lon, meter }) — oder nimmt ihn weg (null, genau genug, keine
// Zahl). Der Behälter trägt data-genau-m, solange ein Kreis steht (für Prüfläufe und Vorlesen nichts).
export function genauKreisZeigen(karte, lage) {
  if (!karte?.getContainer) return false;
  const lat = Number(lage?.lat);
  const lon = Number(lage?.lon);
  const meter = Number(lage?.meter);
  const zeigen = Boolean(lage) && genauUngenau(meter) && Number.isFinite(lat) && Number.isFinite(lon);
  karte.__crewGenauDaten = zeigen ? { type: 'FeatureCollection', features: [kreisFlaeche(lat, lon, meter)] } : GENAU_LEER;
  const behaelter = karte.getContainer();
  if (zeigen) behaelter.dataset.genauM = String(Math.round(meter)); else delete behaelter.dataset.genauM;
  const stellen = () => {
    if (!karte.isStyleLoaded?.()) return false;
    const quelle = karte.getSource?.(GENAU_QUELLE);
    if (quelle) { quelle.setData(karte.__crewGenauDaten); return true; }
    if (!zeigen) return true;
    const farbe = gruenDerApp();
    karte.addSource(GENAU_QUELLE, { type: 'geojson', data: karte.__crewGenauDaten });
    karte.addLayer({ id: 'crew-genau-flaeche', type: 'fill', source: GENAU_QUELLE, paint: { 'fill-color': farbe, 'fill-opacity': 0.14 } });
    karte.addLayer({ id: 'crew-genau-rand', type: 'line', source: GENAU_QUELLE, paint: { 'line-color': farbe, 'line-opacity': 0.6, 'line-width': 1.5 } });
    return true;
  };
  try {
    if (!stellen() && !karte.__crewGenauWartet) {
      karte.__crewGenauWartet = true;
      const nochmal = () => { if (stellen()) { karte.__crewGenauWartet = false; karte.off('styledata', nochmal); } };
      karte.on('styledata', nochmal);
    }
  } catch { /* ohne Stil kein Kreis — der Punkt bleibt die Auskunft */ }
  return zeigen;
}

// Die Fläche, die der ganze Kreis braucht (für den Ausschnitt nach dem Antippen).
export function genauKreisGrenzen(lage) {
  const lat = Number(lage?.lat);
  const lon = Number(lage?.lon);
  if (!genauUngenau(lage?.meter) || !Number.isFinite(lat) || !Number.isFinite(lon)) return null;
  return kreisGrenzen(lat, lon, Number(lage.meter));
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

// --- Loslassen außerhalb der Zeichenfläche ---------------------------------------------------
// Gemessen (Runde 6, scratch/r4-neues-meet.mjs): Wer die Karte zieht und über einem Bedienelement
// loslässt, das ÜBER ihr liegt (seit C4 die Leiste unten, davor die Spalte rechts), lässt MapLibre
// im Zug hängen — der Vendor hört „mouseup"/„touchend" nur an seiner eigenen Zeichenfläche
// (getCanvasContainer), „mousemove" dagegen am ganzen Dokument. Danach bewegte sich die Karte nie
// wieder (movestart ohne moveend, isMoving() blieb wahr). Deshalb reicht die App jedes Loslassen,
// das außerhalb der Zeichenfläche passiert, an die Karte weiter, solange sie noch in Bewegung ist.
function loslassenSichern(karte) {
  const dok = globalThis.document;
  if (!dok?.addEventListener) return;
  const weiter = (ereignis) => {
    const ziel = karte.getCanvasContainer?.();
    if (!ziel?.isConnected || ziel.contains(ereignis.target) || !karte.isMoving?.()) return;
    try {
      if (ereignis.type === 'mouseup') {
        ziel.dispatchEvent(new MouseEvent('mouseup', {
          bubbles: true, cancelable: true, button: ereignis.button, buttons: ereignis.buttons,
          clientX: ereignis.clientX, clientY: ereignis.clientY,
        }));
      } else {
        ziel.dispatchEvent(new TouchEvent(ereignis.type, {
          bubbles: true, cancelable: true, touches: [], targetTouches: [], changedTouches: [...ereignis.changedTouches],
        }));
      }
    } catch { /* ohne TouchEvent-Bauweise bleibt es beim bisherigen Verhalten */ }
  };
  const arten = ['mouseup', 'touchend', 'touchcancel'];
  for (const art of arten) dok.addEventListener(art, weiter, true);
  karte.once('remove', () => { for (const art of arten) dok.removeEventListener(art, weiter, true); });
}

// Ein Zug über eine Markierung endet mit einem Klick auf das, worüber er losließ. Der darf
// nichts öffnen.
function zugSperre(ebene) {
  let start = null;
  const merken = (x, y) => { start = { x, y, t: Date.now() }; };
  ebene.addEventListener('pointerdown', (ereignis) => merken(ereignis.clientX, ereignis.clientY), true);
  // Runde 7: Auch der Finger meldet sich hier an. Kommt nach einem Zug KEIN Klick (das ist der
  // Normalfall), blieb der alte Startpunkt sonst stehen und verschluckte irgendwann einen ganz
  // anderen, ehrlichen Tipp. Deshalb zusätzlich: ein Startpunkt gilt nur eine Sekunde.
  ebene.addEventListener('touchstart', (ereignis) => {
    const finger = ereignis.touches?.[0];
    if (finger) merken(finger.clientX, finger.clientY);
  }, { capture: true, passive: true });
  ebene.addEventListener('click', (ereignis) => {
    const frisch = start && Date.now() - start.t < 1000;
    const weit = frisch && Math.hypot(ereignis.clientX - start.x, ereignis.clientY - start.y) > 8;
    start = null;
    if (weit) { ereignis.stopPropagation(); ereignis.preventDefault(); }
  }, true);
}

// --- Runde 6 (C3): Ein Stapel wird nicht aufgelistet, sondern aufgelöst -----------------------
// Jonathan: „wenn sich standorte stacken und man drauf klickt, soll es rein zoomen, das man jeden
// gut sehen kann im ganzen frame und nicht darüber auflisten."
// zoomZumTrennen sagt, bei welcher Höhe zwischen den zwei NÄCHSTEN Punkten `abstand` Pixel liegen.
// null heißt: Das geht nicht — die Punkte liegen exakt aufeinander oder auch der stärkste Zoom
// (ZOOM_UNTEN) trennt sie nicht. Dann bleibt das Auffächern der einzige ehrliche Weg.
export function zoomZumTrennen(karte, punkte, abstand) {
  if (!karte?.project || (punkte || []).length < 2) return null;
  const zoom = karte.getZoom();
  const p = punkte.map((o) => karte.project([Number(o.lon), Number(o.lat)]));
  let naechster = Infinity;
  for (let i = 0; i < p.length; i += 1) {
    for (let j = i + 1; j < p.length; j += 1) naechster = Math.min(naechster, Math.hypot(p[i].x - p[j].x, p[i].y - p[j].y));
  }
  if (!Number.isFinite(naechster) || naechster < 0.02) return null;
  const noetig = zoom + Math.log2(abstand / naechster);
  if (noetig > ZOOM_UNTEN + 0.001) return null;
  return Math.max(zoom, Math.min(ZOOM_UNTEN, noetig));
}

// Der Rand, den ein Ausschnitt der App freilässt: unten die Bedienleiste (Regler und ⓘ), rundum
// Luft, damit eine Markierung neben ihrem Punkt noch Platz hat. Nie mehr als die halbe Fläche —
// sonst nimmt MapLibre den Ausschnitt nicht an.
function kartenRand(karte) {
  const behaelter = karte?.getContainer?.();
  const breite = behaelter?.clientWidth || 0;
  const hoehe = behaelter?.clientHeight || 0;
  const lage = karte?.__crewSpalte;
  const unten = lage ? Math.round(hoehe - lage.info.o) + 14 : 70;
  const deckel = (wert, ganz) => Math.max(8, Math.min(wert, Math.floor(ganz / 2) - 24));
  // Runde 9: Rechts steht die Bedienspalte (Höhenregler, darunter die Filterknöpfe). Seit Personen
  // und Meets gemeinsam stapeln, reicht ein Stapel oft über den ganzen Ausschnitt — gemessen
  // (scratch/r4-karten.mjs D2): nach dem Hineinzoomen lag der verbliebene Stapel unter dem Regler und
  // war nicht mehr antippbar. Der Rand rechts hält deshalb die Spalte frei, wo es eine gibt.
  const spalteLinks = lage?.regler?.l ?? lage?.unter?.l;
  const rechts = Number.isFinite(spalteLinks) ? Math.max(52, Math.round(breite - spalteLinks) + 14) : 52;
  return { top: deckel(72, hoehe), bottom: deckel(unten, hoehe), left: deckel(52, breite), right: deckel(rechts, breite) };
}

// Ein Ausschnitt, den die APP wählt (kein Mensch): schließt keinen Fächer, rückt nichts weg.
export function fliegeAufPunkte(karte, punkte, maxZoom) {
  const echte = (punkte || []).filter((o) => Number.isFinite(Number(o.lat)) && Number.isFinite(Number(o.lon)));
  if (!karte?.fitBounds || !echte.length) return false;
  const lats = echte.map((o) => Number(o.lat));
  const lons = echte.map((o) => Number(o.lon));
  const grenzen = [[Math.min(...lons), Math.min(...lats)], [Math.max(...lons), Math.max(...lats)]];
  const einstellung = {
    padding: kartenRand(karte),
    maxZoom: Math.min(ZOOM_UNTEN, Number.isFinite(maxZoom) ? maxZoom : ZOOM_UNTEN),
  };
  // Erst rechnen, dann versprechen: Kann MapLibre für diesen Ausschnitt keine Kamera bilden
  // (zu viel Rand für zu wenig Fläche), sagt diese Funktion NEIN — und der Aufrufer nimmt
  // seinen anderen Weg (auffächern), statt ins Leere zu zeigen.
  const kamera = karte.cameraForBounds?.(grenzen, einstellung);
  if (!kamera) return false;
  const vorher = { zoom: karte.getZoom(), mitte: karte.getCenter() };
  const dauer = bewegungGedrosselt() ? 0 : 520;
  karte.easeTo({ ...kamera, duration: dauer });
  // Wachhund (Runde 7, gemessen: 1 von 3 Tipps auf ein Bündel): Nach einem Fingerzug bleibt
  // MapLibre gelegentlich im Flug hängen — `movestart`/`zoomstart` kommen, danach kein einziges
  // Bild mehr, kein `moveend`. Für den Menschen heißt das: „ich tippe, und nichts passiert."
  // Nach 320 ms wird deshalb nachgesehen. Gesprungen wird NUR, wenn sich seither gar nichts
  // bewegt hat — wer selbst zieht, wird nicht zurückgerissen.
  if (dauer) {
    setTimeout(() => {
      if (!karte.getContainer?.()?.isConnected) return;
      const mitte = karte.getCenter();
      const steht = Math.abs(karte.getZoom() - vorher.zoom) < 0.01
        && Math.abs(mitte.lat - vorher.mitte.lat) < 1e-7 && Math.abs(mitte.lng - vorher.mitte.lng) < 1e-7;
      if (steht && Math.abs(kamera.zoom - vorher.zoom) > 0.05) karte.jumpTo(kamera);
    }, 320);
  }
  return true;
}

// --- Runde 8 (R8-31): eine Person mittig über ein Blatt stellen --------------------------------
// Jonathan: „Tipp auf eine Person → Blatt von unten, die Karte zoomt auf eine feste Höhe und stellt
// die Person mittig ÜBER das Blatt." `verdeckt` sind die Pixel, die das Blatt unten von der Karte
// zudeckt; der Punkt landet in der Mitte dessen, was darüber frei bleibt.
// Runde 11 (B5, Jonathan): Ist die Lage genau, zoomt die Karte GANZ hinein (BLATT_ZOOM = die nächste
// Stufe des Reglers, der Vogel ganz unten) — man sieht, in welchem Haus jemand steht. Ist sie ungenau,
// zeigt die Karte den ganzen Radius (unten). Das gilt für Freunde und für mich selbst.
// Wie jeder Ausschnitt, den die App wählt: Kein Mensch bewegt hier etwas (nichts schließt sich), und
// derselbe Wachhund wie in fliegeAufPunkte fängt den Fall, dass MapLibre nach einem Fingerzug im
// Flug hängen bleibt.
export const BLATT_ZOOM = ZOOM_UNTEN;

// Runde 9: Ist die Lage ungenau (`meter` ab GENAU_MIN_M), zoomt die Karte nicht fest heran, sondern
// so, dass der GANZE Kreis über dem Blatt steht — näher als BLATT_ZOOM geht es auch dann nicht.
// Die Karte bleibt dabei IMMER bedienbar (Runde 11, B5): Der Ausschnitt ist ein sanfter Flug, den der
// erste Fingerzug beendet — nichts hält die Karte fest, kein Schleier liegt darüber (screens/karte.js).
export function punktUeberBlatt(karte, punkt, { zoom = BLATT_ZOOM, verdeckt = 0, meter = 0 } = {}) {
  if (!karte?.easeTo || !hatKoordinaten(punkt)) return false;
  const behaelter = karte.getContainer?.();
  const hoehe = behaelter?.clientHeight || 0;
  const breite = behaelter?.clientWidth || 0;
  const unten = Math.max(0, Math.min(Number(verdeckt) || 0, hoehe - 80));
  const naechster = Math.max(ZOOM_OBEN, Math.min(ZOOM_UNTEN, Number(zoom) || BLATT_ZOOM));
  let ziel = {
    center: [punkt.lon, punkt.lat],
    zoom: naechster,
    offset: [0, -Math.round(unten / 2)],
  };
  const grenzen = genauKreisGrenzen({ lat: punkt.lat, lon: punkt.lon, meter });
  if (grenzen && karte.cameraForBounds) {
    const oben = Math.min(72, Math.max(8, Math.floor((hoehe - unten) / 4)));
    const seite = Math.min(KARTEN_SPALTE.frei, Math.max(8, Math.floor(breite / 5)));
    const kamera = karte.cameraForBounds(grenzen, {
      padding: { top: oben, bottom: Math.min(hoehe - oben - 40, unten + 20), left: seite, right: seite },
      maxZoom: naechster,
    });
    if (kamera?.center) ziel = { center: kamera.center, zoom: Math.max(ZOOM_OBEN, Math.min(naechster, kamera.zoom)) };
  }
  const dauer = bewegungGedrosselt() ? 0 : 480;
  const vorher = { zoom: karte.getZoom(), mitte: karte.getCenter() };
  karte.easeTo({ ...ziel, duration: dauer });
  if (dauer) {
    setTimeout(() => {
      if (!karte.getContainer?.()?.isConnected) return;
      const mitte = karte.getCenter();
      const steht = Math.abs(karte.getZoom() - vorher.zoom) < 0.01
        && Math.abs(mitte.lat - vorher.mitte.lat) < 1e-7 && Math.abs(mitte.lng - vorher.mitte.lng) < 1e-7;
      if (steht) karte.easeTo({ ...ziel, duration: 0 });
    }, 320);
  }
  return true;
}

// --- Runde 11 (B6): „Auf Karte zeigen" — nur die freien Leute ------------------------------------
// Jonathan: „Knopf links neben FREE: Liste der gerade freien Leute, mit kleinem Schalter ‚auf Karte
// zeigen'." Der Schalter wirkt auf die Karte: An = der Karten-Tab zeigt von den Leuten nur, wer gerade
// frei ist (ich bleibe stehen); Meets sind davon unberührt. Er gilt auf diesem Gerät, solange die App
// offen ist (kein Konto-Datum, kein Server) — und die Karte sagt es laut (Pille „Nur freie Leute",
// ein Tipp darauf stellt es wieder aus), damit niemand vor einer scheinbar leeren Karte steht.
// „Frei" heißt dasselbe wie der grüne Punkt am Profilbild (components.js › personAvatar).
export function istGeradeFrei(person) {
  return Boolean(person?.free?.active && !person.activeMeetId);
}

let nurFreieZeigen = false;

export function nurFreieAufKarte() {
  return nurFreieZeigen;
}

export function nurFreieAufKarteSetzen(an) {
  nurFreieZeigen = Boolean(an);
}

// --- Runde 6 (C2): Wie alt ist diese Lage? ---------------------------------------------------
// Jonathan: „ich will wissen ob freunde jetzt an der gezeigten location sind oder vor x minuten."
// `at` ist der Zeitstempel der Lage in Millisekunden (person.standort.at). 0 oder fehlend heißt
// UNBEKANNT — dann steht nichts da und nichts wird blasser; erfunden wird nichts.
export const FRISCHE_JETZT_MIN = 2;

// Runde 7 (B5) trug die MARKE selbst die Frische: ein farbiger Ring am Bild (grün → orange →
// grau) und ein Bild, das mit dem Alter blasser wurde. Runde 8 (R8-31, Jonathan): „Personen: kein
// Frische-Ring, nur das Bild und rechts die Pille ‚vor x Min'. Bilder und Pillen NIE durchsichtig."
// Die Auskunft steht seitdem allein im TEXT der Pille (jetzt / vor x Min / vor x Std) — er ist
// geprüft und gelernt. Die Stufen bleiben als Daten (lageFrische › art), gezeichnet wird keine.
export const FRISCHE_STUFEN = Object.freeze([
  { art: 'jetzt', bis: FRISCHE_JETZT_MIN },   // gerade dort
  { art: 'frisch', bis: 10 },                 // eben noch
  { art: 'wach', bis: 60 },                   // innerhalb der Stunde
  { art: 'alt', bis: 360 },                   // heute, aber laenger her
  { art: 'kalt', bis: Infinity },             // lange her — die Marke sagt nichts mehr zu
]);

export function lageFrische(at, jetztMs = Date.now()) {
  const zeit = Number(at) || 0;
  if (!zeit) return { art: '', text: '', min: null };
  const min = Math.max(0, Math.floor((jetztMs - zeit) / 60000));
  const stufe = FRISCHE_STUFEN.find((s) => min < s.bis) || FRISCHE_STUFEN[FRISCHE_STUFEN.length - 1];
  const text = min < FRISCHE_JETZT_MIN
    ? t('jetzt')
    : (min < 60 ? t('vor {n} Min', { n: min }) : t('vor {n} Std', { n: Math.floor(min / 60) }));
  return { art: stufe.art, text, min };
}

// Runde 10 (Jonathan: „manchmal aktualisiert es nicht direkt … z. B. Standort"): Die Frische
// steht nicht nur an der Marke. GEMESSEN war: Das offene Blatt einer Person auf der Karte sagte
// „jetzt" und sagte es auch nach einer Viertelstunde noch — es wird beim Zeichnen gesetzt, und
// solange sich in den Daten nichts ändert, zeichnet die App nicht neu.
// Statt einer zweiten Uhr je Bildschirm gilt EINE Regel: Jeder Knoten mit `data-frische-at`
// (Zeitpunkt der Lage in ms) bekommt im Takt der Karte denselben Text wie die Pille an der Marke.
export function frischeFelderStellen(dokument = globalThis.document) {
  const felder = dokument?.querySelectorAll?.('[data-frische-at]');
  if (!felder?.length) return;
  const jetzt = Date.now();
  for (const feld of felder) {
    const { text } = lageFrische(Number(feld.getAttribute('data-frische-at')) || 0, jetzt);
    if (feld.textContent !== text) feld.textContent = text;
  }
}

// --- Runde 7: mehrere Marken-Ebenen auf EINER Karte ------------------------------------------
// Der Karten-Tab legt Leute, Meets und Orte zusammen auf eine Flaeche. Jede Ebene prueft ihre
// Kollisionen bisher nur in der EIGENEN Liste — drei Ebenen ohne gemeinsames Gedaechtnis legen
// sich also uebereinander. Deshalb meldet jede Ebene, die einen `rang` bekommt, ihre Flaechen
// an die Karte; jede Ebene weicht dem aus, was einen KLEINEREN Rang hat (Leute 0, Meets 1,
// Orte 2). Ohne `rang` aendert sich nichts — alle bisherigen Karten bleiben, wie sie sind.
function belegtMelden(halter, schluessel, rang, flaechen) {
  if (!halter || rang == null) return;
  if (!halter.__crewBelegt) halter.__crewBelegt = new Map();
  halter.__crewBelegt.set(schluessel, { rang, flaechen: flaechen || [] });
}

// Was ausserhalb des Bildes steht, belegt nichts: Eine Marke 10 km nordlich haelt weder einen
// Faecher auf noch draengt sie ein Schild zur Seite. Gemessen (scratch/r4-karten.mjs): Ein
// Gesicht bei y = 16 000 px machte den Deckel in faecherStellen zu 16 000 — die Karte sprang
// beim Auffaechern zehn Kilometer weit weg.
function imBlick(f, breite, hoehe, luft = 64) {
  return f && f.r > -luft && f.l < breite + luft && f.u > -luft && f.o < hoehe + luft;
}

export function fremdFlaechen(halter, rang) {
  if (!halter?.__crewBelegt || rang == null) return [];
  const liste = [];
  for (const eintrag of halter.__crewBelegt.values()) {
    if (eintrag.rang < rang) liste.push(...eintrag.flaechen);
  }
  return liste;
}

// --- Runde 9: EIN Stapel für alles, was auf der Karte steht -------------------------------------
// Jonathan: „Personen UND Meets gemeinsam stapeln, kein Unterschied zwischen Arten, Toleranz etwas
// höher." Bis Runde 8 stapelte jede Ebene nur in ihrer EIGENEN Liste: Leute ab 20 px, Meets ab 34 px
// (auseinander ab 46) — ein Meet unter einem Gesicht blieb ein halb verdecktes Schild daneben. Jetzt
// meldet jede Ebene ihre Punkte hier an (stapelQuelle), und EINE Rechnung bildet die Stapel über
// alle Arten hinweg:
//   · zusammen ab 40 px Punktabstand (ein Gesicht ist 36 px breit — was sich berühren würde, gehört
//     zusammen), auseinander erst ab 52 px (Hysterese: an der Grenze zappelt nichts).
//   · Oben liegt, wer den kleineren Rang hat (Leute 0 vor Meets 1), dann die Reihenfolge der Ebene.
//     Der Kopf trägt die Zahl ALLER; die anderen treten zurück.
// Eine Ebene ohne `rang` meldet sich nicht an — Karten mit nur einer Ebene stapeln wie bisher unter
// sich, nur mit derselben Toleranz.
export const STAPEL = Object.freeze({ zusammen: 40, auseinander: 52, rand: 40 });
const STAPEL_TRENNER = '\u0001';

function stapelQuelle(halter, schluessel, eintrag) {
  if (!halter) return;
  if (!halter.__crewStapel) halter.__crewStapel = { quellen: new Map(), vorher: new Map() };
  halter.__crewStapel.quellen.set(schluessel, eintrag);
}

function stapelQuelleWeg(halter, schluessel) {
  halter?.__crewStapel?.quellen.delete(schluessel);
}

// Die anderen Ebenen neu ordnen, wenn sich die eigenen Punkte geändert haben.
function stapelNachbarnOrdnen(halter, schluessel) {
  for (const [key, quelle] of halter?.__crewStapel?.quellen || []) {
    if (key !== schluessel) { try { quelle.anordnen?.(); } catch { /* eine Ebene reißt die andere nie mit */ } }
  }
}

// → Map vollerSchluessel → Gruppe (Liste, Kopf zuerst). Voller Schluessel = Ebene + Trenner + key.
function gemeinsamStapeln(halter, breite, hoehe) {
  const reg = halter?.__crewStapel;
  const ergebnis = new Map();
  if (!reg || typeof halter.project !== 'function') return ergebnis;
  const alle = [];
  for (const [quelle, q] of reg.quellen) {
    let punkte = [];
    try { punkte = q.punkte() || []; } catch { punkte = []; }
    for (const pkt of punkte) {
      const p = halter.project([pkt.lon, pkt.lat]);
      if (!p || !Number.isFinite(p.x) || !Number.isFinite(p.y)) continue;
      if (p.x < -STAPEL.rand || p.x > breite + STAPEL.rand || p.y < -STAPEL.rand || p.y > hoehe + STAPEL.rand) continue;
      alle.push({ ...pkt, quelle, voll: `${quelle}${STAPEL_TRENNER}${pkt.key}`, rang: Number.isFinite(q.rang) ? q.rang : 0, anzahl: pkt.anzahl || 1, x: p.x, y: p.y });
    }
  }
  alle.sort((a, b) => (a.rang - b.rang) || ((a.index || 0) - (b.index || 0)));
  const eltern = new Map(alle.map((m) => [m.voll, m.voll]));
  const stelle = new Map(alle.map((m, i) => [m.voll, i]));
  const wurzel = (k0) => {
    let k = k0;
    while (eltern.get(k) !== k) { eltern.set(k, eltern.get(eltern.get(k))); k = eltern.get(k); }
    return k;
  };
  for (let i = 0; i < alle.length; i += 1) {
    for (let j = i + 1; j < alle.length; j += 1) {
      const a = alle[i];
      const b = alle[j];
      const vorher = reg.vorher.get(a.voll);
      const grenze = vorher && vorher === reg.vorher.get(b.voll) ? STAPEL.auseinander : STAPEL.zusammen;
      if (Math.hypot(a.x - b.x, a.y - b.y) < grenze) {
        const wa = wurzel(a.voll);
        const wb = wurzel(b.voll);
        // Die Wurzel ist immer der Frühere — so bleibt der Kopf der, der oben liegen soll.
        if (wa !== wb) { if (stelle.get(wa) < stelle.get(wb)) eltern.set(wb, wa); else eltern.set(wa, wb); }
      }
    }
  }
  const gruppen = new Map();
  for (const m of alle) {
    const w = wurzel(m.voll);
    if (!gruppen.has(w)) gruppen.set(w, []);
    gruppen.get(w).push(m);
  }
  reg.vorher = new Map();
  for (const gruppe of gruppen.values()) {
    const kopf = gruppe[0].voll;
    for (const m of gruppe) {
      ergebnis.set(m.voll, gruppe);
      if (gruppe.length > 1) reg.vorher.set(m.voll, kopf);
    }
  }
  return ergebnis;
}

function stapelVoll(schluessel, key) {
  return `${schluessel}${STAPEL_TRENNER}${key}`;
}

// Alles, was andere Ebenen belegt haben — unabhängig vom Rang. Gemessen auf der Karte des
// Karten-Tabs: Ein Namensschild („Sam +2") lief quer über die Meet-Marke daneben. Das Bild einer
// Person steht fest auf ihrem Ort und weicht niemandem aus; ihr NAME ist dagegen das Nachgiebige
// und darf sich deshalb an ALLEM stoßen, was schon steht.
function andereFlaechen(halter, schluessel) {
  if (!halter?.__crewBelegt) return [];
  const liste = [];
  for (const [key, eintrag] of halter.__crewBelegt) {
    if (key !== schluessel) liste.push(...eintrag.flaechen);
  }
  return liste;
}

// Wie weit die Trefferfläche eines Gesichts über das Bild hinausreicht (.crew-person-bild::before).
const GESICHT_TREFFER_RAND = 4;

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
.crew-ich-punkt{position:absolute;left:-9px;top:-9px;width:18px;height:18px;box-sizing:border-box;border-radius:50%;background:var(--karte-ich,var(--green));border:3px solid var(--karte-ich-rand,var(--surface));box-shadow:0 1px 5px var(--shadow-30),0 0 0 1px var(--karte-ich-ring,var(--green-a30))}
.crew-ich[data-genau="0"] .crew-ich-punkt{background:var(--karte-ich-alt,var(--muted))}
.crew-marken,.crew-personen{position:absolute;left:0;top:0;width:0;height:0}
.crew-marke{position:absolute;left:0;top:0;width:0;height:0;will-change:transform;font:400 14px/normal 'Instrument Sans',sans-serif;color:var(--ink);text-align:left;letter-spacing:normal}
.crew-marke-punkt{position:absolute;left:-5px;top:-5px;width:10px;height:10px;border-radius:50%;background:var(--green);border:2px solid var(--surface);box-sizing:border-box;box-shadow:0 1px 3px var(--shadow-25);z-index:3;pointer-events:none}
.crew-marke-v{position:absolute;left:0;bottom:0;opacity:0;visibility:hidden;pointer-events:none;transform:scale(.55);transform-origin:0 100%;transition:opacity .12s ease,transform .2s cubic-bezier(.2,.9,.25,1),visibility 0s linear .2s}
.crew-marke[data-seite="links"]>.crew-marke-v{left:auto;right:0;transform-origin:100% 100%}
.crew-marke[data-form="box"]>.crew-marke-box,.crew-marke[data-form="zeichen"]>.crew-marke-zeichen{opacity:1;visibility:visible;pointer-events:auto;transform:none;transition:opacity .16s ease .02s,transform .22s cubic-bezier(.2,.9,.25,1),visibility 0s}
.crew-marke[data-offen="1"]>.crew-marke-v{opacity:0;visibility:hidden;pointer-events:none}
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
.crew-marke[data-unten="1"]>.crew-marke-zeichen{opacity:0;transform:scale(.55);box-shadow:none;border-color:transparent}
.crew-marke[data-unten="1"]>.crew-marke-punkt{opacity:.45;transform:scale(.62);box-shadow:none}
.crew-marke[data-buendel="1"]>.crew-marke-zeichen{border-radius:15px;box-shadow:5px -4px 0 -2.5px var(--surface),5px -4px 0 -1.5px var(--ink-a14),0 2px 7px var(--shadow-18)}
.crew-marke[data-buendel="1"][data-seite="links"]>.crew-marke-zeichen{border-radius:15px;box-shadow:-5px -4px 0 -2.5px var(--surface),-5px -4px 0 -1.5px var(--ink-a14),0 2px 7px var(--shadow-18)}
.crew-marke-zeichen[data-ton="ort"]{border-radius:50%;background:var(--paper);color:var(--ink-soft);border-color:var(--ink-a14)}
.crew-marke[data-seite="links"]>.crew-marke-zeichen[data-ton="ort"]{border-radius:50%}
.crew-marke-box[data-ton="ort"] .crew-marke-ikon{background:var(--field);color:var(--ink-soft)}
.crew-marke-zeichen[data-ton="zuhause"]{border-radius:50%;background:var(--green-tint);color:var(--green-dark);border-color:var(--green-a30)}
.crew-marke[data-seite="links"]>.crew-marke-zeichen[data-ton="zuhause"]{border-radius:50%}
.crew-marke-box[data-ton="zuhause"] .crew-marke-ikon{background:var(--green-tint);color:var(--green-dark)}
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
@keyframes crew-marke-auf{from{opacity:0;transform:translateY(6px) scale(.92)}to{opacity:1;transform:none}}
.crew-person{position:absolute;left:0;top:0;width:0;height:0;will-change:transform;cursor:pointer;font-family:'Instrument Sans',sans-serif;color:var(--ink);outline:none}
.crew-person-bild{position:absolute;left:-18px;top:-18px;width:36px;height:36px;box-sizing:border-box;border-radius:50%;background:var(--surface);box-shadow:0 3px 10px var(--shadow-22);display:flex;align-items:center;justify-content:center;z-index:2;overflow:visible}
.crew-person-bild::before{content:"";position:absolute;left:-${GESICHT_TREFFER_RAND}px;top:-${GESICHT_TREFFER_RAND}px;right:-${GESICHT_TREFFER_RAND}px;bottom:-${GESICHT_TREFFER_RAND}px;border-radius:50%}
.crew-person[data-ich="1"] .crew-person-bild{background:var(--green)}
/* Runde 8 (R8-31): rechts am Bild die Pille „vor x Min" — sonst nichts. Sie ist nie durchsichtig: sie
   steht ganz da oder gar nicht (kein Ein- und Ausblenden ueber die Deckkraft). */
.crew-person-name{position:absolute;left:4px;top:-12px;height:24px;box-sizing:border-box;padding:0 10px 0 18px;border-radius:0 12px 12px 0;background:var(--surface);box-shadow:0 3px 10px var(--shadow-18);font:650 12px/24px 'Instrument Sans',sans-serif;color:var(--ink-soft);font-variant-numeric:tabular-nums;white-space:nowrap;z-index:1;visibility:hidden;pointer-events:none}
.crew-person[data-name="1"] .crew-person-name{visibility:visible;pointer-events:auto}
.crew-person-box-frische{margin-left:6px;font-weight:600;font-size:11px;color:var(--ink-soft);font-variant-numeric:tabular-nums}
.crew-person-box-frische:empty{display:none}
.crew-person[data-unten="1"]{opacity:0;visibility:hidden;pointer-events:none}
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
.crew-person-box[data-meet-box] .crew-person-box-bild{background:var(--green-tint);color:var(--green-dark)}
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
// Runde 7 (B3): `buendeln`/`buendelnAuf` sind PUNKTabstaende, keine Flaechenueberschneidung.
// Abstand faellt beim Herauszoomen streng monoton — Ueberschneidung nicht, weil die Form der
// Marke selbst davon abhaengt. Genau das liess die alte Gruppierung beim Zoomen zappeln.
// `zoomSchwelle`: so viel Hoehenaenderung braucht es, bis die Formwahl (Box/Zeichen) neu
// entschieden wird; beim blossen Schieben wird sie NICHT angefasst (kein Anploppen mehr).
const MARKE = Object.freeze({
  zeichen: 30, box: 36, zeile: 42, punkt: 6, luftWachsen: 6, luftBleiben: -3, rand: 4, trennen: 40,
  buendeln: 34, buendelnAuf: 46, zoomSchwelle: 0.15, aufloesen: 90,
});
const NEIN_ZEICHEN = '<span class="crew-marke-nein" aria-hidden="true"><svg viewBox="0 0 24 24"><path d="M6 6l12 12M18 6 6 18" fill="none" stroke="currentColor" stroke-width="4" stroke-linecap="round"></path></svg></span>';

// Nur das SCHILD (Zeichen oder Box) — ohne den Ortspunkt. Runde 7 (V1): Beim Ausweichen zählt
// allein das Schild; der Punkt bleibt ja stehen, auch wenn er unter einer Leiste liegt.
function schildFlaeche(p, breite, hoehe, seite) {
  return seite === 'links'
    ? { l: p.x - breite, r: p.x, o: p.y - hoehe, u: p.y }
    : { l: p.x, r: p.x + breite, o: p.y - hoehe, u: p.y };
}

function mitPunkt(p, f) {
  return {
    l: Math.min(f.l, p.x - MARKE.punkt), r: Math.max(f.r, p.x + MARKE.punkt),
    o: Math.min(f.o, p.y - MARKE.punkt), u: Math.max(f.u, p.y + MARKE.punkt),
  };
}

// Die ganze Fläche einer Marke (Schild und Punkt) — was sie belegt.
function formFlaeche(p, breite, hoehe, seite) {
  return mitPunkt(p, schildFlaeche(p, breite, hoehe, seite));
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
  return `${ort.eintraege.map((eintrag) => `<div class="crew-marke-box" ${eintrag.attrs || ''} data-ton="${escHtml(eintrag.ton || '')}" role="button" tabindex="0" aria-label="${escHtml(eintrag.label || eintrag.titel)}">${boxInnen(eintrag)}</div>`).join('')}`;
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
    // Runde 7 (V1): nicht nur die Bedienspalte — alles, was die Seite über die Karte legt.
    bedienung: () => belegteFlaechen(karte),
    zoom: () => karte.getZoom?.() ?? 0,
    spalte: () => Boolean(karte.__crewSpalte?.regler),
    // Runde 7 (B2): Waehrend des Schiebens wird nur noch die LAGE gestellt. Die Formwahl fiele
    // sonst bei jedem Bild neu — das war das Anploppen und Seitenkippen, das Jonathan sah.
    beiBewegung: (lauscher) => {
      karte.on('move', () => lauscher({ nurLage: true }));
      karte.on('moveend', () => lauscher({}));
      karte.on('zoomend', () => lauscher({}));
      karte.on('resize', () => lauscher({}));
      karte.once('load', () => lauscher({}));
    },
    beiMensch: (lauscher) => beiBewegungDurchMenschen(karte, lauscher),
    beiKlick: (lauscher) => karte.on('click', (ereignis) => lauscher(ereignis?.originalEvent)),
    verschieben: (dx, dy) => karte.panBy([dx, dy], { duration: bewegungGedrosselt() ? 0 : 260 }),
    // Runde 6 (C3): so weit hinein, dass zwischen den nächsten Punkten `abstand` Pixel liegen —
    // und alle mit Rand im Bild stehen. false, wenn kein Zoom sie trennt.
    hineinZoomen: (punkte, abstand) => {
      const ziel = zoomZumTrennen(karte, punkte, abstand);
      return ziel == null ? false : fliegeAufPunkte(karte, punkte, ziel);
    },
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
    if ('rang' in optionen) vorhanden.rang = Number.isFinite(optionen.rang) ? optionen.rang : null;
    return vorhanden;
  }

  const st = { orte: new Map(), fokus: null, offen: null, ebene: null, zoom: null };
  const steuerung = { frei: optionen.frei || null, rang: Number.isFinite(optionen.rang) ? optionen.rang : null };
  // Runde 9: Mit Rang auf einer echten Karte stapeln die Meets GEMEINSAM mit den anderen Ebenen.
  const gemeinsam = steuerung.rang != null && typeof halter.project === 'function';
  if (gemeinsam) {
    stapelQuelle(halter, schluessel, {
      rang: steuerung.rang,
      anordnen: () => anordnen(),
      punkte: () => [...st.orte.values()].map((e) => ({
        key: e.key, lat: e.lat, lon: e.lon, index: e.rang, anzahl: e.anzahl, eintraege: e.daten?.eintraege || [],
      })),
    });
  }

  function ebeneHolen() {
    const basis = flaeche.ebene?.();
    if (!basis) return null;
    if (st.ebene && st.ebene.parentNode === basis) return st.ebene;
    const ebene = document.createElement('div');
    ebene.className = 'crew-marken';
    ebene.dataset.schluessel = schluessel;
    // Runde 7: Liegen mehrere Ebenen auf einer Karte, entscheidet der Rang, wer oben liegt —
    // sonst entschiede die Zufallsordnung der einzelnen Marken, und ein Tipp landete mal hier,
    // mal dort. Ohne Rang bleibt alles wie bisher (eine Ebene, eine Ordnung).
    if (steuerung.rang != null) ebene.style.zIndex = String(20 - steuerung.rang);
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
    if (gemeinsam) stapelNachbarnOrdnen(halter, schluessel);
  }

  // Runde 7 (B3, Jonathan: „beim Herauszoomen buendeln statt teilen"). Die URSACHE des Teilens
  // lag in der REIHENFOLGE: Bis Runde 6 wurde erst die Form gewaehlt (Box oder Zeichen, mit
  // Seitenwechsel links/rechts, wenn die Box nicht passte) und ERST DANACH gebuendelt — und
  // gebuendelt wurde nur, was schon auf das Zeichen zurueckgefallen war und sich FLAECHIG
  // ueberschnitt. Zwei Meets nebeneinander stritten sich also zuerst um den Platz (einer kippte
  // nach links, einer nach rechts = das „Teilen"), und die Mitglieder eines Buendels blieben
  // voll gezeichnet — ein Haufen mit einer Zahl obendrauf statt EINER Anzeige.
  //
  // Jetzt: erst buendeln (nach Punktabstand, mit Hysterese), dann Form — und nur der KOPF eines
  // Buendels wird gezeichnet und belegt Platz. Die Mitglieder verschwinden weich; nur ihr
  // Ortspunkt bleibt klein und blass stehen, damit man sieht, dass da mehrere echte Orte sind.
  function buendeln(liste) {
    const eltern = new Map(liste.map((e) => [e.key, e.key]));
    const wurzel = (key) => {
      let k = key;
      while (eltern.get(k) !== k) { eltern.set(k, eltern.get(eltern.get(k))); k = eltern.get(k); }
      return k;
    };
    for (let i = 0; i < liste.length; i += 1) {
      for (let j = i + 1; j < liste.length; j += 1) {
        const a = liste[i];
        const b = liste[j];
        // Hysterese: Was zusammen war, bleibt bis 46 px zusammen; neu gebuendelt wird ab 34 px.
        // Ohne das zappelt die Gruppe an der Grenze bei jedem Fingerzucken.
        const zusammen = a.buendelVorher && a.buendelVorher === b.buendelVorher;
        const grenze = zusammen ? STAPEL.auseinander : STAPEL.zusammen;
        if (Math.hypot(a.p.x - b.p.x, a.p.y - b.p.y) < grenze) eltern.set(wurzel(b.key), wurzel(a.key));
      }
    }
    const gruppen = new Map();
    for (const e of liste) {
      const w = wurzel(e.key);
      if (!gruppen.has(w)) gruppen.set(w, []);
      gruppen.get(w).push(e);
    }
    for (const [w, mitglieder] of gruppen) {
      const keys = mitglieder.map((m) => m.key);
      const summe = mitglieder.reduce((wert, m) => wert + m.anzahl, 0);
      const mehrere = mitglieder.length > 1;
      mitglieder.forEach((m, i) => {
        m.cluster = keys;
        m.buendelVorher = mehrere ? w : null;
        m.buendel = mehrere;
        m.kopf = i === 0;
        m.unten = i > 0;
        m.zahl = i === 0 ? summe : 0;
      });
    }
  }

  function anordnen(optionen = {}) {
    if (!ebeneHolen()) return;
    const breite = flaeche.breite();
    const hoehe = flaeche.hoehe();
    if (!breite || !hoehe) return;
    const zoom = Number(flaeche.zoom?.()) || 0;
    // Runde 8 (R8-30): Aufhalten dürfen eine Box oder einen Fächer nur Bedienung und Leisten der
    // Seite (und andere Meets, siehe `belegt`). Die Gesichter der Leute-Ebene (fremdFlaechen) nicht
    // mehr — Meets „stapeln sich mit allem (auch mit Personen)". Gemessen an der Seebühne (Zoom
    // 16,4): Ein Gesicht 2 px UNTER der Box ließ drei Meets zum stummen Zeichen schrumpfen, und der
    // Fächer wurde 6 px vom Ortspunkt weggeklemmt. Ein Gesicht wählt nur noch die Seite (unten).
    const bedienung = [
      ...(flaeche.bedienung?.() || []),
      ...((typeof steuerung.frei === 'function' && steuerung.frei()) || []),
    ];
    const gesichter = fremdFlaechen(halter, steuerung.rang);
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
    const imRahmen = (f) => f.l >= MARKE.rand && f.r <= breite - MARKE.rand && f.o >= MARKE.rand && f.u <= hoehe - MARKE.rand;
    // Runde 7 (V1): Frei heißt: nicht unter einer Leiste der Seite und nicht unter der Bedienung der
    // Karte (belegteFlaechen). Seit Runde 8 zählt ein Gesicht nicht mehr als belegt (siehe oben).
    const freiePlatz = (f) => !bedienung.some((b) => ueberlappt(f, b, 4));
    const imBild = (f) => imRahmen(f) && freiePlatz(f);
    const zeichenFlaeche = (e) => formFlaeche(e.p, MARKE.zeichen, MARKE.zeichen, e.seite);

    // 1. Buendeln — vor jeder Formfrage, und nur, was wirklich im Bild steht.
    for (const e of liste) { e.cluster = [e.key]; e.buendel = false; e.kopf = true; e.unten = false; e.zahl = e.anzahl; e.fremdKopf = ''; }
    if (gemeinsam) {
      // Runde 9: EIN Stapel über alle Ebenen. Liegt ein Gesicht obenauf, tritt das Meet zurück
      // (sein Ortspunkt bleibt klein stehen) — die Zahl trägt das Gesicht.
      const stapel = gemeinsamStapeln(halter, breite, hoehe);
      for (const e of liste) {
        if (draussen(e)) continue;
        const gruppe = stapel.get(stapelVoll(schluessel, e.key));
        if (!gruppe || gruppe.length < 2) continue;
        const eigene = gruppe.filter((m) => m.quelle === schluessel).map((m) => m.key);
        const kopf = gruppe[0];
        e.cluster = eigene;
        e.buendel = true;
        e.buendelVorher = kopf.voll;
        if (kopf.quelle !== schluessel) {
          e.kopf = false; e.unten = true; e.zahl = 0; e.fremdKopf = kopf.voll;
        } else {
          e.kopf = kopf.key === e.key;
          e.unten = !e.kopf;
          e.zahl = e.kopf ? gruppe.reduce((wert, m) => wert + (m.anzahl || 1), 0) : 0;
        }
      }
    } else {
      buendeln(liste.filter((e) => !draussen(e)));
    }

    // 2. Form — nur Koepfe. Ein Buendel ist immer EIN Zeichen mit einer Zahl: eine Mini-Box mit
    // dem Titel des Obersten waere eine Behauptung ueber die anderen.
    const neuEntscheiden = optionen.nurLage !== true || st.zoom == null || Math.abs(zoom - st.zoom) > MARKE.zoomSchwelle;
    if (neuEntscheiden) st.zoom = zoom;
    const koepfe = liste.filter((e) => e.kopf);
    // Runde 9: Ein Meet, das unter einem Gesicht gestapelt ist, zeichnet nur noch seinen Ortspunkt —
    // der bleibt aber stehen und darf von keiner Box eines anderen Ortes zugedeckt werden.
    const gestapeltePunkte = liste.filter((s) => s.fremdKopf && !draussen(s))
      .map((s) => ({ l: s.p.x - 4, r: s.p.x + 4, o: s.p.y - 4, u: s.p.y + 4 }));
    const belegt = [];
    koepfe.forEach((e, index) => {
      let wahl = null;
      if (!e.buendel && !draussen(e) && e.boxBreite) {
        if (!neuEntscheiden) {
          wahl = { form: e.form, seite: e.seite };
        } else {
          const fokus = e.key === st.fokus;
          const spaeter = koepfe.slice(index + 1).filter((s) => !draussen(s));
          const moeglich = [];
          for (const seite of [e.seite, e.seite === 'links' ? 'rechts' : 'links']) {
            const f = formFlaeche(e.p, e.boxBreite, MARKE.box, seite);
            const neu = e.form !== 'box' || seite !== e.seite;
            // Wachsen oder die Seite wechseln nur in freien, SICHTBAREN Platz — nicht über den Rand,
            // nicht unter Regler, ⓘ oder Seitenbedienung. Was schon eine Box ist, bleibt es beim
            // Schieben auch halb draußen; sonst änderte das Schieben die Form.
            if ((neu || fokus) && !imRahmen(f)) continue;
            // Runde 7 (V1, gemessen): Eine Box, die schon eine war, blieb liegen, auch wenn ihr
            // inzwischen eine Leiste auf dem Titel lag — gelesen hat das niemand mehr. Ist der Platz
            // nicht frei, fällt sie auf ihr Zeichen zurück (das an seinem Ort bleibt, Runde 8).
            if (!freiePlatz(f)) continue;
            if (fokus) { moeglich.push(seite); break; }
            const luft = neu ? MARKE.luftWachsen : MARKE.luftBleiben;
            if (belegt.some((b) => ueberlappt(f, b, luft))) continue;
            // Kein Zeichen eines anderen Ortes wird verdeckt; wer schon Box ist, behält beim Wachsen
            // eines anderen seinen Platz (keine Kettenreaktion beim Schieben).
            if (spaeter.some((s) => ueberlappt(f, neu && s.form === 'box' ? formFlaeche(s.p, s.boxBreite, MARKE.box, s.seite) : zeichenFlaeche(s), luft))) continue;
            if (gestapeltePunkte.some((g) => ueberlappt(f, g, 0))) continue;
            moeglich.push(seite);
          }
          // Runde 8 (R8-30): Gehen beide Seiten, wächst die Box dorthin, wo kein Gesicht auf ihrem
          // Titel liegt; sonst bleibt sie auf ihrer Seite — das Gesicht liegt dann obenauf wie auf
          // einem Stapel (ein Gesicht AM Ort des Meets deckt ohnehin nur die Ecke am Punkt).
          const ohneGesicht = moeglich.find((seite) => !gesichter.some((g) => ueberlappt(formFlaeche(e.p, e.boxBreite, MARKE.box, seite), g, 0)));
          if (moeglich.length) wahl = { form: 'box', seite: ohneGesicht || moeglich[0] };
          if (!wahl && fokus) wahl = { form: 'box', seite: e.p.x > breite / 2 ? 'links' : 'rechts' };
        }
      }
      if (!wahl || wahl.form !== 'box') wahl = { form: 'zeichen', seite: e.seite };
      // Runde 8 (R8-30, gemessen): Läge die MITTE eines Zeichens unter einem Gesicht (dessen
      // Trefferfläche reicht 4 px über das Bild), verschwände es bis auf Splitter — ein 36-px-Kreis
      // deckt ein 30-px-Schild fast ganz. Die Ecke bleibt auf dem Ort; das Zeichen zeigt dann zur
      // anderen Seite (gespiegelt), wenn dort frei ist. So liegen beide im Stapel, und man sieht beide.
      if (wahl.form === 'zeichen' && neuEntscheiden && !draussen(e) && gesichter.length) {
        const unterGesicht = (seite) => {
          const f = schildFlaeche(e.p, MARKE.zeichen, MARKE.zeichen, seite);
          const mx = (f.l + f.r) / 2;
          const my = (f.o + f.u) / 2;
          return gesichter.some((g) => Math.hypot(mx - (g.l + g.r) / 2, my - (g.o + g.u) / 2) < (g.r - g.l) / 2 + GESICHT_TREFFER_RAND);
        };
        const andere = wahl.seite === 'links' ? 'rechts' : 'links';
        if (unterGesicht(wahl.seite) && !unterGesicht(andere) && imRahmen(schildFlaeche(e.p, MARKE.zeichen, MARKE.zeichen, andere))) {
          wahl = { form: 'zeichen', seite: andere };
        }
      }
      e.form = wahl.form;
      e.seite = wahl.seite;
      e.ordnung = index;
      // Runde 8 (R8-30, Jonathan): „Keine Striche an Meets … IMMER an ihrem Ort, sie stapeln sich mit
      // allem (auch mit Personen), ohne Leute wegzuschieben." Bis Runde 7 rückte ein Zeichen, das unter
      // einer Leiste oder auf einem Gesicht lag, heraus und hielt sich mit einer Linie an seinem Punkt.
      // Jetzt steht das Schild IMMER mit seiner scharfen Ecke auf seinem Ort. Trifft es ein Gesicht,
      // liegen beide übereinander wie auf einem Stapel — das Gesicht obenauf (die Ebene „Leute" hat
      // den kleineren Rang), das Schild ragt darunter hervor: Ein 36-px-Kreis kann ein 30-px-Schild
      // nie ganz verdecken, umgekehrt schon (gemessen: Sams Gesicht unter dem Zeichen eines Lokals
      // war nirgends mehr antippbar). Nichts wird verschoben. Die BOX (der längere Text) wächst nur,
      // wo keine Bedienung und kein anderes Meet liegt — ein Gesicht hält sie nicht auf.
      const schild = e.form === 'box'
        ? schildFlaeche(e.p, e.boxBreite, MARKE.box, e.seite)
        : schildFlaeche(e.p, MARKE.zeichen, MARKE.zeichen, e.seite);
      e.weg = null;
      e.flaeche = mitPunkt(e.p, schild);
      if (!e.buendel && e.form === 'box') e.zahl = 0;
      belegt.push(e.flaeche);
    });
    // Mitglieder eines Buendels: gezeichnet wird nichts mehr, Platz belegen sie auch nicht.
    for (const e of liste) {
      if (e.kopf) continue;
      e.form = 'zeichen';
      e.ordnung = 199;
      e.weg = null;
      e.flaeche = zeichenFlaeche(e);
    }
    // Was eine andere Ebene wissen muss: hier steht etwas (Runde 7, EINE Karte mit drei Ebenen).
    // Gemeldet wird nur, was im Bild steht — alles andere belegt nichts.
    belegtMelden(halter, schluessel, steuerung.rang, belegt.filter((f) => imBlick(f, breite, hoehe)));

    const offen = new Set(st.offen?.keys || []);
    // Runde 7: Ein offener Fächer (oder eine gewählte Marke) gehört VOR die anderen Ebenen —
    // sonst liegt er unter den Gesichtern der Leute-Ebene und ist nicht antippbar.
    if (st.ebene && steuerung.rang != null) {
      const vorn = st.offen || st.fokus ? '30' : String(20 - steuerung.rang);
      if (st.ebene.style.zIndex !== vorn) st.ebene.style.zIndex = vorn;
    }
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
      const buendel = e.buendel && e.kopf ? '1' : '0';
      if (el.dataset.buendel !== buendel) el.dataset.buendel = buendel;
      // Runde 7 (Welle 3): Wer eingeklappt ist, NENNT seinen Bündelkopf. Vorher stand im DOM nur
      // „ich bin unten" und irgendwo „ich bin ein Kopf" — daraus liess sich nicht nachweisen, dass
      // genau DIESER Ort noch mitgezählt wird. Jetzt trägt jedes Mitglied (auch der Kopf selbst)
      // den Schlüssel seines Kopfes, und ein Prüflauf kann Ort für Ort nachsehen, statt global zu
      // hoffen, dass irgendwo ein Bündel steht.
      const kopfKey = e.buendel && !e.fremdKopf ? String(e.cluster?.[0] ?? '') : '';
      if ((el.dataset.buendelKopf || '') !== kopfKey) {
        if (kopfKey) el.dataset.buendelKopf = kopfKey; else delete el.dataset.buendelKopf;
      }
      // Runde 9: Liegt obenauf ein Gesicht (gemeinsamer Stapel), nennt die Marke dessen Schlüssel.
      const gesichtKey = e.fremdKopf ? e.fremdKopf.split(STAPEL_TRENNER).pop() : '';
      if ((el.dataset.stapelKopf || '') !== gesichtKey) {
        if (gesichtKey) el.dataset.stapelKopf = gesichtKey; else delete el.dataset.stapelKopf;
      }
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
    // Runde 7 (gemessen, Welle 2): Hier rueckte die KARTE den Faecher ins Bild. Der Deckel dafuer
    // war die Unterkante ALLER Leisten, die in der Spalte lagen — auf dem Karten-Tab liegen die
    // aber UNTEN (Ebenen-Leiste, Zeitraum-Regler). Aus dem kleinen Nachruecken wurde so ein Sprung
    // um mehrere hundert Pixel: Der Ort verschwand aus dem Bild, der Faecher landete hinter der
    // Fussleiste. Statt die Karte zu verschieben, wird der Faecher jetzt in den freien Streifen
    // geklemmt (siehe unten) — der Ausschnitt gehoert dem Menschen (Runde 3).
    st.offen.gerueckt = true;

    // Runde 7 (gemessen): Auf dem Karten-Tab liegen unten Ebenen-Leiste und Zeitraum-Regler über
    // der Karte. Der Fächer stand danach halb unter der Fußleiste — lesbar war er dort nicht.
    // Deshalb wird er in den freien Streifen GEKLEMMT: oben unter das, was darüber liegt, unten
    // über das, was darunter liegt. Die Linie zum Ortspunkt bleibt und zeigt, wozu er gehört.
    const spalteR = spalteL + maxBreite;
    const querUeber = (b) => b.r > spalteL && b.l < spalteR;
    const grenzeOben = Math.max(8, ...bedienung.filter((b) => querUeber(b) && b.u <= anker.p.y).map((b) => b.u + 8));
    const grenzeUnten = Math.min(hoehe - 8, ...bedienung.filter((b) => querUeber(b) && b.o >= anker.p.y).map((b) => b.o - 8));
    const rohOben = nachOben ? anker.p.y - lift - block : anker.p.y + lift;
    const blockOben = Math.min(Math.max(rohOben, grenzeOben), Math.max(grenzeOben, grenzeUnten - block));
    // Musste geklemmt werden, sitzt die unterste Box nicht mehr mit ihrer Ecke auf dem Punkt. Eine
    // Linie dorthin gibt es seit Runde 8 nicht mehr (R8-30: keine Striche an Meets) — der Fächer
    // steht ja nur, weil gerade eben genau dieser Ort angetippt wurde.
    const geklemmt = Math.abs(blockOben - rohOben) > 1;
    zeilen.forEach((z, k) => {
      const oben = blockOben + (nachOben ? (zeilen.length - 1 - k) * Z : k * Z);
      // Alle Boxen eines Fächers gleich breit: eine ruhige Spalte statt einer ausgefransten Kante.
      if (z.box.style.width !== `${maxBreite}px`) z.box.style.width = `${maxBreite}px`;
      const links = (seite === 'rechts' ? anker.p.x : anker.p.x - maxBreite) - z.m.p.x;
      z.box.style.left = `${links}px`;
      z.box.style.top = `${oben - z.m.p.y}px`;
      z.box.style.animationDelay = `${Math.min(k, 6) * 18}ms`;
      // Ein Ort allein: Die unterste Box sitzt mit ihrer scharfen Ecke auf dem Punkt.
      let ecke = '';
      if (!lift && !geklemmt && k === 0) {
        if (nachOben) ecke = seite === 'rechts' ? '14px 14px 14px 3px' : '14px 14px 3px 14px';
        else ecke = seite === 'rechts' ? '3px 14px 14px 14px' : '14px 3px 14px 14px';
      }
      if (z.box.style.borderRadius !== ecke) z.box.style.borderRadius = ecke;
    });
  }

  function oeffnen(keys) {
    const mitglieder = keys.map((key) => st.orte.get(key)).filter(Boolean);
    if (!mitglieder.length) return;
    // Runde 6 (C3): Liegen VERSCHIEDENE Orte übereinander, wird nicht aufgelistet — die Karte
    // fliegt so weit hinein, dass jeder sein eigenes Zeichen bekommt. Mehrere Einträge am SELBEN
    // Ort (zwei Meets in derselben Bar) kann kein Zoom trennen: die bleiben ein Fächer.
    // Runde 7 (gemessen): Mit `trennen` (40 px) reichte der Flug oft nur fuer 0,2 Zoomstufen —
    // die Marken hoerten gerade auf, sich zu ueberschneiden, und fuer den Menschen war „nichts
    // passiert". Ein Buendel loest sich erst auf, wenn zwischen den Orten wirklich Luft ist
    // (`aufloesen`); dann sieht man nach dem Tipp einzelne Orte statt einer Zahl.
    if (mitglieder.length > 1 && flaeche.hineinZoomen?.(mitglieder.map((m) => ({ lat: m.lat, lon: m.lon })), MARKE.aufloesen)) {
      schliessen();
      return;
    }
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
      stapelQuelleWeg(halter, schluessel);
      halter.__crewOrtMarken?.delete(schluessel);
      halter.__crewBelegt?.delete(schluessel);
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
//
// Runde 6 (C2, Jonathan: „ich will wissen ob freunde jetzt an der gezeigten location sind oder vor
// x minuten."): Jeder Personenpunkt sagt, wie alt seine Lage ist — „jetzt", „vor 12 Min",
// „vor 3 Std" — und wird mit dem Alter blasser. Die Zeit kommt aus `eintrag.at` (Millisekunden);
// fehlt sie, liest der Baustein sie selbst aus dem Repository (person.standort.at bzw. für mich
// settings.standort.at). 0 heißt unbekannt: dann steht nichts da und nichts wird blasser.
// Runde 6 (C3): Ein Tipp auf einen Stapel fliegt hinein, bis jeder für sich steht; nur wenn selbst
// der stärkste Zoom das nicht schafft (exakt dieselbe Koordinate), wird aufgefächert.
// `trennen` (Runde 9): So weit fliegt ein Tipp auf einen Stapel hinein — über der Grenze, ab der ein
// Stapel wieder auseinandergeht (STAPEL.auseinander), sonst bliebe er nach dem Flug ein Stapel.
const PERSON = Object.freeze({ bild: 36, nameLinks: 4, nameAb: 9.5, box: 40, zeile: 46, luft: 10, rand: 8, trennen: 64 });
const FRISCHE_TAKT_MS = 30000;

// Woher die Zeit der Lage kommt, wenn der Aufrufer sie nicht mitgibt.
function frischeZeit(eintrag) {
  if (eintrag?.at != null) return Number(eintrag.at) || 0;
  const repo = lageRepoHolen();
  if (!repo) return 0;
  try {
    if (eintrag?.ich) return Number(repo.getSettings?.()?.standort?.at) || 0;
    return Number(repo.getPerson?.(String(eintrag?.id))?.standort?.at) || 0;
  } catch {
    return 0;
  }
}

export function personenMarken(karte, optionen = {}) {
  if (!karte) return null;
  kartenStilEinsetzen();
  const schluessel = String(optionen.schluessel || 'personen');
  if (!karte.__crewPersonen) karte.__crewPersonen = new Map();
  const vorhanden = karte.__crewPersonen.get(schluessel);
  if (vorhanden) {
    if ('frei' in optionen) vorhanden.frei = optionen.frei;
    if ('rang' in optionen) vorhanden.rang = Number.isFinite(optionen.rang) ? optionen.rang : null;
    return vorhanden;
  }
  const st = { leute: new Map(), ebene: null, faecher: null, faecherBreite: 0, offen: null, offenFremd: '', gerueckt: false, weg: false, takt: 0 };
  // Runde 7: dieselben zwei Angaben wie bei ortMarken — was die Seite ueber die Karte legt
  // (`frei`) und welcher Ebene diese Marken gehoeren (`rang`, siehe fremdFlaechen).
  const steuer = { frei: optionen.frei || null, rang: Number.isFinite(optionen.rang) ? optionen.rang : null };
  // Runde 9: Personen melden sich IMMER beim gemeinsamen Stapel an (Rang 0, wenn keiner gesetzt ist).
  stapelQuelle(karte, schluessel, {
    rang: steuer.rang ?? 0,
    anordnen: () => anordnen(),
    punkte: () => [...st.leute.values()].map((p) => ({ key: p.id, lat: p.lat, lon: p.lon, index: p.index, anzahl: 1 })),
  });

  function ebeneHolen() {
    if (st.weg) return null;
    const basis = kartenEbene(karte);
    if (!basis) return null;
    if (st.ebene && st.ebene.parentNode === basis) return st.ebene;
    const ebene = document.createElement('div');
    ebene.className = 'crew-personen';
    ebene.dataset.schluessel = schluessel;
    if (steuer.rang != null) ebene.style.zIndex = String(20 - steuer.rang);
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
        vorlage.innerHTML = `<div class="crew-person" data-id="${escHtml(id)}" data-name="0"${eintrag.ich ? ' data-ich="1"' : ''} ${eintrag.attrs || ''} role="button" tabindex="0" aria-label="${escHtml(eintrag.name || '')}"><span class="crew-person-name" aria-hidden="true"><span class="crew-person-frische"></span></span><span class="crew-person-bild">${eintrag.bild || ''}<span class="crew-person-zahl"></span></span></div>`;
        const el = vorlage.content.firstElementChild;
        if (p?.el) {
          el.dataset.name = p.el.dataset.name;
          el.style.cssText = p.el.style.cssText;
          p.el.replaceWith(el);
        }
        p = { el, signatur, nameBreite: 0, beschriftung: null };
      }
      // Runde 7 (F9): `genauigkeitM` ist der Halbmesser in Metern, in dem die Person wirklich
      // ist (projections.js GENAUIGKEIT_M). null/0 heisst: echter Punkt — dann KEIN Kreis.
      Object.assign(p, {
        id, lat, lon, index, daten: eintrag, ich: Boolean(eintrag.ich), at: frischeZeit(eintrag),
        genau: Number(eintrag.genauigkeitM) > 0 ? Number(eintrag.genauigkeitM) : 0,
      });
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
    stapelNachbarnOrdnen(karte, schluessel);
    taktPruefen();
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
    // Stapel (Runde 9): EINE Rechnung über alle Ebenen der Karte (gemeinsamStapeln). Wer so nah auf
    // einem anderen liegt — Person oder Meet —, gehört dazu; oben liegt die erste Person.
    const stapelung = gemeinsamStapeln(karte, breite, hoehe);
    for (const p of liste) {
      const gruppe = stapelung.get(stapelVoll(schluessel, p.id)) || [];
      const eigene = gruppe.filter((m) => m.quelle === schluessel).map((m) => st.leute.get(m.key)).filter(Boolean);
      p.gruppe = eigene.length ? eigene : [p];
      p.fremde = gruppe.filter((m) => m.quelle !== schluessel);
      p.oben = gruppe.length ? gruppe[0].quelle === schluessel && gruppe[0].key === p.id : true;
      p.anzahl = p.gruppe.length + p.fremde.reduce((wert, m) => wert + (m.anzahl || 1), 0);
    }
    // Hat sich der offene Stapel verändert (anderer Ausschnitt, andere Daten), ist der Fächer zu.
    if (st.offen) {
      const kopf = st.leute.get(st.offen[0]);
      if (!kopf?.oben || kopf.gruppe.map((m) => m.id).join('|') !== st.offen.join('|')
        || kopf.fremde.map((m) => m.voll).join('|') !== st.offenFremd) { st.offen = null; st.faecher.textContent = ''; }
    }
    const offen = new Set(st.offen || []);
    // Ein offener Fächer liegt über allem — auch über einem offenen Fächer der Meets (30); sonst
    // läge ein Meet-Schild auf einer Box des Fächers.
    if (st.ebene && steuer.rang != null) {
      const stufe = st.offen ? '31' : String(20 - steuer.rang);
      if (st.ebene.style.zIndex !== stufe) st.ebene.style.zIndex = stufe;
    }
    // Was über der Karte liegt (Bedienung, Leisten der Seite, `frei`) und was andere Ebenen belegen:
    // Beides braucht nur noch die PILLE — sie steht nur, wo Platz ist.
    const belegt = [
      ...belegteFlaechen(karte),
      ...((typeof steuer.frei === 'function' && steuer.frei()) || []),
    ];
    const flaechen = [...belegt, ...fremdFlaechen(karte, steuer.rang)];
    // Runde 8 (R8-30/31, Jonathan: „… ohne Leute wegzuschieben"): Ein Gesicht steht IMMER genau auf
    // seinem Ort. Bis Runde 7 rückte es unter einer Leiste heraus und hielt sich mit einer Linie an
    // einem kleinen Ortspunkt fest — beides ist weg. Was über der Karte schwebt, liegt darüber; ein
    // Fingerzug holt das Gesicht hervor. Liegen zwei so dicht, dass eine Mitte verdeckt wäre, bleibt
    // es beim Stapel mit Zahl (Runde 5, D5): niemand liegt unsichtbar unter einem anderen.
    const bilder = liste.filter((p) => p.oben).map((p) => ({ id: p.id, l: p.p.x - R, r: p.p.x + R, o: p.p.y - R, u: p.p.y + R }));
    belegtMelden(karte, schluessel, steuer.rang, bilder
      .filter((f) => imBlick(f, breite, hoehe))
      .map(({ l, r, o, u }) => ({ l, r, o, u })));
    // Nur für die Pillen (siehe andereFlaechen): das Bild selbst rückt nie.
    const fremd = steuer.rang == null ? [] : andereFlaechen(karte, schluessel);
    const namen = [];
    const jetzt = Date.now();
    liste.forEach((p, index) => {
      const el = p.el;
      const anzahl = p.anzahl;
      const stapel = p.oben && anzahl > 1 ? String(anzahl) : '';
      if ((el.dataset.stapel || '') !== stapel) { if (stapel) el.dataset.stapel = stapel; else delete el.dataset.stapel; }
      const unten = p.oben ? '0' : '1';
      if (el.dataset.unten !== unten) el.dataset.unten = unten;
      const auf = offen.has(p.id) ? '1' : '0';
      if (el.dataset.offen !== auf) el.dataset.offen = auf;
      // Runde 8 (R8-31, Jonathan): „Personen: kein Frische-Ring, nur das Bild und rechts die Pille
      // ‚vor x Min'. Bilder und Pillen NIE durchsichtig." Bis Runde 7 trug das Bild einen farbigen
      // Ring (grün → orange → grau) und wurde mit dem Alter blasser, das Etikett nannte Name und Zeit.
      // Jetzt: das Bild, wie es überall in der App aussieht, und rechts daneben EINE Pille mit der Zeit.
      // Den Namen sagt das Bild (und das Blatt nach dem Tipp); vorgelesen wird beides.
      // Ein STAPEL nennt keine Zeit (B4) — sie gälte nur für die oberste Person; er trägt seine Zahl.
      const frisch = stapel ? { text: '' } : lageFrische(p.at, jetzt);
      const beschriftung = `${stapel}|${frisch.text}`;
      if (p.beschriftung !== beschriftung) {
        p.beschriftung = beschriftung;
        const zahl = el.querySelector('.crew-person-zahl');
        if (zahl) zahl.textContent = stapel;
        const frischeFeld = el.querySelector('.crew-person-frische');
        if (frischeFeld) frischeFeld.textContent = frisch.text;
        const name = p.daten?.name || '';
        const grund = !stapel ? name
          : p.fremde.length ? tn(anzahl - 1, '{name} und {n} weiterer Eintrag', '{name} und {n} weitere Einträge', { name })
            : tn(anzahl - 1, '{name} und {n} weitere Person', '{name} und {n} weitere Personen', { name });
        el.setAttribute('aria-label', [grund, frisch.text].filter(Boolean).join(' · '));
        p.nameBreite = 0;
      }
      if (!p.nameBreite) p.nameBreite = el.querySelector('.crew-person-name')?.offsetWidth || 0;
      // Runde 9: Den Kreis der Genauigkeit zeichnet die Karte nur nach dem Antippen
      // (genauKreisZeigen). Das Merkmal sagt nur, DASS diese Lage ungenau ist.
      const genauM = genauUngenau(p.genau) ? String(Math.round(p.genau)) : '';
      if ((el.dataset.genau || '') !== genauM) { if (genauM) el.dataset.genau = genauM; else delete el.dataset.genau; }
      // Die Pille steht nur, wo Platz ist: nicht auf einer anderen Pille, keinem anderen Bild, nichts,
      // was über der Karte liegt, und keinem Meet. `data-name` sagt „die Pille steht" (Name aus der
      // Zeit, als sie noch den Namen trug — Prüfläufe lesen es so).
      let zeigen = false;
      if (p.oben && auf === '0' && frisch.text && zoom >= PERSON.nameAb && p.nameBreite) {
        const f = { l: p.p.x + R, r: p.p.x + PERSON.nameLinks + p.nameBreite, o: p.p.y - 12, u: p.p.y + 12 };
        const luft = el.dataset.name === '1' ? -2 : 4;
        zeigen = !namen.some((n) => ueberlappt(f, n, luft))
          && !bilder.some((b) => b.id !== p.id && ueberlappt(f, b, luft))
          && !flaechen.some((b) => ueberlappt(f, b, 0))
          && !fremd.some((b) => ueberlappt(f, b, 0));
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
    const fremde = anker?.fremde || [];
    if (!anker || mitglieder.length + fremde.length < 2 || !st.faecher) return;
    if (!st.faecher.firstElementChild) {
      // Runde 9: Im gemeinsamen Stapel stehen auch Meets — als Box in derselben Spalte.
      const meetBoxen = fremde.flatMap((m) => (m.eintraege || []).map((x) => `<div class="crew-person-box" data-meet-box="${escHtml(m.key)}" ${x.attrs || ''} role="button" tabindex="0" aria-label="${escHtml(x.label || x.titel || '')}"><span class="crew-person-box-bild">${x.zeichen || ''}</span><span class="crew-person-box-name">${escHtml(x.titel || '')}</span><span class="crew-person-box-frische">${escHtml(x.unter || '')}</span></div>`));
      st.faecher.innerHTML = mitglieder.map((p) => {
        const frisch = lageFrische(p.at);
        const label = [p.daten?.name || '', frisch.text].filter(Boolean).join(' · ');
        return `<div class="crew-person-box" data-person-box="${escHtml(p.id)}"${p.ich ? ' data-ich="1"' : ''}${frisch.art ? ` data-frische="${frisch.art}"` : ''} ${p.daten?.attrs || ''} role="button" tabindex="0" aria-label="${escHtml(label)}"><span class="crew-person-box-bild">${p.daten?.bild || ''}</span><span class="crew-person-box-name">${escHtml(p.daten?.name || '')}</span><span class="crew-person-box-frische">${escHtml(frisch.text)}</span></div>`;
      }).join('') + meetBoxen.join('');
      st.faecherBreite = Math.max(...[...st.faecher.children].map((box) => box.offsetWidth || 150));
      for (const box of st.faecher.children) box.style.width = `${st.faecherBreite}px`;
    }
    const R = PERSON.bild / 2;
    const W = st.faecherBreite;
    // Der Fächer hängt an dem Bild, das man sieht — es steht seit Runde 8 immer auf seinem Ort.
    const ap = anker.p;
    const block = st.faecher.children.length * PERSON.zeile - (PERSON.zeile - PERSON.box);
    let x = Math.round(Math.max(PERSON.rand, Math.min(breite - PERSON.rand - W, ap.x - W / 2)));
    const ueber = ap.y - R - PERSON.luft - block;
    const unter = ap.y + R + PERSON.luft;
    const flaecheBei = (oben) => ({ l: x, r: x + W, o: oben, u: oben + block });
    const passt = (f) => f.o >= PERSON.rand && f.u <= hoehe - PERSON.rand;
    const nachOben = passt(flaecheBei(ueber)) || !passt(flaecheBei(unter));
    // Neben der Bedienung (Regler, ⓘ): lieber nach links rücken als darunter liegen.
    for (const b of flaechen) {
      if (ueberlappt(flaecheBei(nachOben ? ueber : unter), b, 4) && b.l - 4 - W >= PERSON.rand) x = Math.round(b.l - 4 - W);
    }
    if ((st.gerueckt || 0) < 2) {
      st.gerueckt = (st.gerueckt || 0) + 1;
      // Passt der Fächer nirgends ganz ins Bild, rückt die Karte ihn EINMAL hinein (keine Bewegung durch
      // den Menschen, schließt also nichts).
      const f = flaecheBei(nachOben ? ueber : unter);
      const dy = f.o < PERSON.rand ? f.o - PERSON.rand : (f.u > hoehe - PERSON.rand ? f.u - (hoehe - PERSON.rand) : 0);
      if (dy) karte.panBy([0, dy], { duration: bewegungGedrosselt() ? 0 : 260 });
    }
    [...st.faecher.children].forEach((box, k) => {
      const oben = nachOben ? ap.y - R - PERSON.luft - PERSON.box - k * PERSON.zeile : ap.y + R + PERSON.luft + k * PERSON.zeile;
      const links = `${x}px`;
      const top = `${Math.round(oben)}px`;
      if (box.style.left !== links) box.style.left = links;
      if (box.style.top !== top) box.style.top = top;
      box.style.animationDelay = `${Math.min(k, 6) * 18}ms`;
    });
  }

  function oeffnen(ids) {
    const gueltig = (ids || []).map(String).filter((id) => st.leute.has(id));
    const fremde = st.leute.get(gueltig[0])?.fremde || [];
    if (gueltig.length + fremde.length < 2 || !ebeneHolen()) return;
    st.offen = gueltig;
    st.offenFremd = fremde.map((m) => m.voll).join('|');
    st.gerueckt = 0;
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

  // Tipp auf einen Stapel: hineinfliegen, bis jeder für sich steht (Runde 6, C3). Erst wenn auch
  // der stärkste Zoom sie nicht trennt (exakt dieselbe Koordinate), wird aufgefächert — zweiter
  // Tipp schließt den Fächer. Eine einzelne Person behält ihren Tipp (attrs).
  function tipp(ereignis) {
    const el = ereignis.target.closest?.('.crew-person');
    if (!el || !st.ebene?.contains(el)) return;
    const p = st.leute.get(el.dataset.id);
    if (!p?.oben || (p.anzahl || 0) < 2) return;
    ereignis.stopPropagation();
    ereignis.preventDefault();
    rueckmeldung('tipp');
    const ids = p.gruppe.map((m) => m.id);
    if (st.offen && st.offen.join('|') === ids.join('|')) { schliessen(); return; }
    // Getrennt wird ALLES im Stapel — Leute und Meets.
    const punkte = [...p.gruppe, ...p.fremde].map((m) => ({ lat: m.lat, lon: m.lon }));
    const ziel = zoomZumTrennen(karte, punkte, PERSON.trennen);
    if (ziel != null && fliegeAufPunkte(karte, punkte, ziel)) { schliessen(); return; }
    oeffnen(ids);
  }

  // Runde 6 (C2): Die Frische läuft weiter, auch wenn die App nicht neu zeichnet. Ein ruhiger Takt
  // schreibt nur Text und Blässe neu — nichts bewegt sich. Ohne Zeitstempel läuft er gar nicht.
  // Runde 10: Im selben Takt gehen auch die Frische-Felder der Seite mit (frischeFelderStellen).
  function taktPruefen() {
    const noetig = [...st.leute.values()].some((p) => p.at > 0);
    if (noetig && !st.takt) {
      st.takt = setInterval(() => {
        if (st.weg || !karte.getContainer?.()?.isConnected) { clearInterval(st.takt); st.takt = 0; return; }
        anordnen();
        frischeFelderStellen();
      }, FRISCHE_TAKT_MS);
    } else if (!noetig && st.takt) {
      clearInterval(st.takt);
      st.takt = 0;
    }
  }

  const steuerung = Object.assign(steuer, {
    setzen,
    anordnen,
    oeffnen,
    schliessen,
    zustand: () => ({ offen: st.offen ? [...st.offen] : [] }),
    zeigtMich: () => [...st.leute.values()].some((p) => p.ich),
    entfernen() {
      st.weg = true;
      if (st.takt) { clearInterval(st.takt); st.takt = 0; }
      stapelQuelleWeg(karte, schluessel);
      st.ebene?.remove();
      st.ebene = null;
      st.faecher = null;
      st.offen = null;
      st.leute.clear();
      karte.__crewPersonen?.delete(schluessel);
      karte.__crewBelegt?.delete(schluessel);
      ichStellen(karte);
    },
  });
  karte.on('move', anordnen);
  // Runde 7 (V1, gemessen): Nur auf 'move' zu hören, heißt für die Namensschilder, dass sie mit
  // den Flächen des VORIGEN Bildes rechnen — nach einem Sprung lag ein Name quer über einer
  // Meet-Marke. Am Ende der Bewegung ordnen sich beide Ebenen noch einmal, dann stimmt es.
  karte.on('moveend', anordnen);
  karte.on('zoomend', anordnen);
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
// EINE Karte je Knoten. Gemessen (Runde 7, Welle 2): Im Karten-Tab standen zwei MapLibre-Karten
// in DEMSELBEN Knoten — zwei Zeichenflächen, doppelte Markierungen, und die Bedienung ging an
// die falsche. Wer hier eine Karte anlegt, räumt zuerst weg, was vorher in diesem Knoten stand.
const knotenKarte = new WeakMap();

function knotenLeeren(container) {
  const alt = knotenKarte.get(container);
  if (alt) {
    knotenKarte.delete(container);
    try { alt.remove(); } catch { /* egal */ }
  }
  // Was MapLibre beim Entfernen nicht losgeworden ist (ein Fehler beim Aufräumen würde sonst
  // eine halbe Karte stehen lassen), kommt hier weg — der Knoten gehört uns.
  //
  // Und ebenso UNSERE eigene Bedienung: Höhenregler, ⓘ und der eigene Lagepunkt hängen am
  // Behälter, nicht an MapLibres Zeichenfläche. Gemessen (Runde 7, Welle 2): Nach einem Neubau
  // stand der ALTE Regler noch da — hoehenReglerAnbauen sah ihn, baute keinen neuen, und der
  // sichtbare Regler bediente eine Karte, die es nicht mehr gab. Man zog, und nichts geschah.
  for (const rest of container.querySelectorAll(':scope > .maplibregl-canvas-container, :scope > .maplibregl-control-container, :scope > [data-role="hoehenregler"], :scope > [data-role="karten-info"], :scope > .crew-ich')) rest.remove();
  container.classList.remove('maplibregl-map');
}

export async function karteAnlegen(container, optionen = {}) {
  try {
    knotenLeeren(container);
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
    knotenKarte.set(container, karte);
    // Runde 9 (gemessen, scratch/r4-karten.mjs „Karte fehlt"): Verliert die Karte ihren WebGL-Kontext,
    // BEVOR ihr Stil geladen ist (headless Chrome ~30 ms nach dem Anlegen; auf Geräten bei
    // Speicherdruck), hat MapLibre beim Wiederherstellen keinen Stil zum Zurücklegen — die Karte blieb
    // leer, und karteVon() warf sie als tot weg. Jetzt gilt sie in der Zwischenzeit nicht als tot, und
    // fehlt nach der Rückkehr der Stil, wird er neu gesetzt.
    karte.on('webglcontextlost', () => { karte.__crewOhneKontext = true; });
    karte.on('webglcontextrestored', () => {
      karte.__crewOhneKontext = false;
      if (!karte.style) { try { karte.setStyle(optionen.style || STYLE_URL); } catch { /* bleibt leer wie vorher */ } }
    });
    karte.once('remove', () => { if (knotenKarte.get(container) === karte) knotenKarte.delete(container); });
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
    loslassenSichern(karte);
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

// Eine Karte, die MapLibre entfernt hat, ist eine Leiche: Sie hat keinen Stil mehr, zeichnet
// nichts und nimmt keine Geste an — aber sie beantwortet noch getCenter() und getZoom().
// Gemessen (Runde 7, Welle 2): Genau so eine kam aus karteVon('karte-tab') zurück. Markierungen
// wären an ihr gelandet, Prüfläufe haben an ihr gemessen — und wer sie schob, schob ins Leere.
function karteTot(karte) {
  // Ohne Stil ist sie tot — außer während eines verlorenen WebGL-Kontexts (siehe karteAnlegen):
  // Dann legt MapLibre den Stil nur beiseite und bringt ihn mit dem Kontext zurück.
  return !karte || (!karte.style && !karte.__crewOhneKontext) || !karte.getContainer?.();
}

export async function karteHalten(knoten, schluessel, optionen = {}) {
  const vorhanden = karten.get(schluessel);
  if (vorhanden && karteTot(vorhanden.karte)) { vorhanden.tot = true; karten.delete(schluessel); }
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
  // Für einen ANDEREN Knoten wird gerade gebaut (Bahn: Vorschau und aktive Seite kurz
  // nacheinander)? Dann wird hier weitergebaut — auf WARTEN zu setzen führte zum Ping-Pong:
  // zwei Knoten, die sich gegenseitig die Karte wegnehmen, und zwischendurch gibt es gar keine.
  // Dass in EINEM Knoten nur EINE Karte steht, sichert knotenLeeren() beim Anlegen.
  if (vorhanden) { vorhanden.tot = true; try { vorhanden.karte?.remove(); } catch { /* egal */ } karten.delete(schluessel); }
  const versprechen = karteAnlegen(knoten, optionen);
  kartenImBau.set(schluessel, { knoten, versprechen });
  const karte = await versprechen.finally(() => { if (kartenImBau.get(schluessel)?.versprechen === versprechen) kartenImBau.delete(schluessel); });
  if (!karte) return null;
  karten.set(schluessel, { knoten, karte, tot: false });
  // Wenn der Knoten aus dem Dokument verschwindet, verschwindet auch die Karte.
  //
  // Runde 7 (Welle 2, gemessen): NICHT sofort. Die Bahn nimmt lebende Knoten beim Zeichnen kurz
  // heraus und hängt sie in der nächsten Fassung der Seite wieder ein (app.js › Depot). Wer
  // dabei die Karte wegwirft, baut MapLibre bei jedem Neuzeichnen neu — gemessen: Solange das
  // Standort-Sheet offen stand, gab es sekundenlang überhaupt keine Karte, und die Bedienung
  // hängte an einer toten. Deshalb wird erst nachgesehen, ob der Knoten wirklich weg BLEIBT.
  let abschiedTimer = 0;
  const wache = new MutationObserver(() => {
    if (knoten.isConnected) { if (abschiedTimer) { clearTimeout(abschiedTimer); abschiedTimer = 0; } return; }
    if (abschiedTimer) return;
    abschiedTimer = setTimeout(() => {
      abschiedTimer = 0;
      if (knoten.isConnected) return;
      wache.disconnect();
      const eintrag = karten.get(schluessel);
      if (eintrag && eintrag.knoten === knoten) {
        eintrag.tot = true;
        try { eintrag.karte.remove(); } catch { /* egal */ }
        karten.delete(schluessel);
      }
    }, 700);
  });
  wache.observe(document.body, { childList: true, subtree: true });
  return karte;
}

// Zugriff auf eine gehaltene Karte — für Prüfläufe, die nachsehen wollen, WO die Karte
// gerade steht, und für Bindungen, die eine schon stehende Karte ohne Warten weiterbenutzen.
export function karteVon(schluessel) {
  const eintrag = karten.get(schluessel);
  if (!eintrag || eintrag.tot) return null;
  // Auch ohne unser Zutun kann sie tot sein (MapLibre-Fehler, Knoten weg). Wer sie bekommt,
  // bekommt eine Karte, die wirklich lebt — oder nichts.
  if (karteTot(eintrag.karte)) { eintrag.tot = true; karten.delete(schluessel); return null; }
  return eintrag.karte;
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
