// Entfernungen: Umkreis-Stufen, Luftlinie, Kartenmaßstab (Runde 2).
//
// Jonathan: „Die Entfernung soll nicht immer km für km sein, sondern irgendwann größere
// Sprünge haben — aber im Slider sind die Einraster immer in gleichen Abständen."
// Deshalb eine feste Stufenleiter: Jede Stufe hat auf dem Regler denselben Abstand, die Werte
// selbst wachsen so, wie man Entfernungen denkt — zu Fuß, mit dem Rad, mit dem Auto, Ausflug.
//
// Liegt in core/, weil Datenschicht (Entfernung eines Vorschlags) und Oberfläche (Regler,
// Umkreis auf der Karte) dieselben Zahlen brauchen.
import { zahl } from './sprache.js';

export const STUFEN_KM = [1, 2, 3, 5, 7, 10, 15, 20, 30, 50, 75, 100, 150, 200, 300, 500];

const LETZTE = STUFEN_KM.length - 1;
const begrenzt = (wert, min, max) => Math.min(max, Math.max(min, wert));

// Die Stufe, die einem beliebigen Wert am nächsten liegt — gemessen im Verhältnis, nicht in
// Kilometern: 12 km liegt näher an 10 als an 15, 170 km näher an 150 als an 200.
export function stufeFuerKm(km) {
  const wert = Number(km);
  if (!Number.isFinite(wert) || wert <= STUFEN_KM[0]) return 0;
  if (wert >= STUFEN_KM[LETZTE]) return LETZTE;
  let beste = 0;
  let abstand = Infinity;
  STUFEN_KM.forEach((stufe, index) => {
    const d = Math.abs(Math.log(wert / stufe));
    if (d < abstand) { abstand = d; beste = index; }
  });
  return beste;
}

export const naechsteStufe = (km) => STUFEN_KM[stufeFuerKm(km)];
export const anteilFuerKm = (km) => stufeFuerKm(km) / LETZTE;
export const kmFuerAnteil = (anteil) => STUFEN_KM[Math.round(begrenzt(Number(anteil) || 0, 0, 1) * LETZTE)];

export function hatLage(punkt) {
  return Boolean(punkt && typeof punkt.lat === 'number' && typeof punkt.lon === 'number');
}

// Luftlinie zwischen zwei Punkten { lat, lon } in Kilometern.
export function entfernungKm(a, b) {
  if (!hatLage(a) || !hatLage(b)) return null;
  const rad = Math.PI / 180;
  const dLat = (b.lat - a.lat) * rad;
  const dLon = (b.lon - a.lon) * rad;
  const h = Math.sin(dLat / 2) ** 2 + Math.cos(a.lat * rad) * Math.cos(b.lat * rad) * Math.sin(dLon / 2) ** 2;
  return 6371.0088 * 2 * Math.asin(Math.min(1, Math.sqrt(h)));
}

// --- Web-Mercator wie MapLibre (512er Kacheln, ohne Drehung und Neigung) -----------------
// Damit liegen Umkreis und Kacheln auch dann richtig, wenn die Karte (noch) nicht geladen
// ist — und sie liegen exakt dort, wo MapLibre denselben Punkt zeichnet.
const WELT = 512;

function merkator(punkt, zoom) {
  const groesse = WELT * 2 ** zoom;
  const sin = Math.sin((begrenzt(punkt.lat, -85.05, 85.05) * Math.PI) / 180);
  return {
    x: ((punkt.lon + 180) / 360) * groesse,
    y: (0.5 - Math.log((1 + sin) / (1 - sin)) / (4 * Math.PI)) * groesse,
  };
}

// Bildschirmstelle eines Punkts in einem Ausschnitt { mitte, zoom } der Größe breite × hoehe.
export function bildpunkt(ausschnitt, breite, hoehe, punkt) {
  const m = merkator(ausschnitt.mitte, ausschnitt.zoom);
  const p = merkator(punkt, ausschnitt.zoom);
  return { x: breite / 2 + (p.x - m.x), y: hoehe / 2 + (p.y - m.y) };
}

// Meter je Bildschirmpixel auf dieser Breite und Zoomstufe.
export function meterProPixel(lat, zoom) {
  return (40075016.686 * Math.cos((lat * Math.PI) / 180)) / (WELT * 2 ** zoom);
}

// Die Zoomstufe, bei der ein Kreis von `km` genau `pixel` Halbmesser hat.
export function zoomFuerRadius(lat, km, pixel) {
  const meterJePixel = (km * 1000) / Math.max(1, pixel);
  return Math.log2((40075016.686 * Math.cos((lat * Math.PI) / 180)) / (WELT * meterJePixel));
}

// Kurz und ohne unnötige Nachkommastelle: 1,5 · 12 · 300.
export function kmText(km) {
  if (km == null || !Number.isFinite(Number(km))) return '';
  const wert = Number(km);
  // Runde 2: Dezimalzeichen der Sprache („6,7" · „6.7").
  if (wert < 10) return zahl(Math.round(wert * 10) / 10, 1);
  return String(Math.round(wert));
}
