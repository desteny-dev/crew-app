// Runde 8 (R8-27) — Routen für die Anreise: wer fährt, holt wen ab, und wie lange dauert das?
//
// Jonathan: „Tipp auf eine Person → Route ich → Person → Treffpunkt mit Zeit … Routen über
// OpenRouteService (Jonathan legt den Gratis-Schlüssel an), Navigation übergeben an Google Maps."
//
// API (verbindlich, feste Schnittstelle aus dem Rundenauftrag):
//   routeBerechnen(punkte, optionen?)  → Promise<Route>
//     punkte: [{ lat, lon }, …] in Fahrtreihenfolge — Start, Zwischenstopps, Ziel (mindestens zwei).
//     MIT Schlüssel (web/config.js → window.CREW_CONFIG.orsSchluessel): OpenRouteService, Profil
//       driving-car, echte Straßen →
//       { geschaetzt:false, quelle:'ors', dauerMin, meter, linie:[[lon,lat],…], abschnitte:[{ dauerMin, meter }] }
//     OHNE Schlüssel — oder wenn der Dienst nicht antwortet — ehrlich geschätzt aus der Luftlinie →
//       { geschaetzt:true, quelle:'luftlinie', dauerMin, meter, linie:[[lon,lat],…] (gerade Stücke),
//         abschnitte:[…], fehler?:'ors' }
//     Die Schätzung ist dieselbe Rechnung, die das Mitfahren seit Runde 5 benutzt: Luftlinie × 1,3
//     (Straßen sind nie gerade), 40 km/h (Stadt und Land gemischt, mit Ampeln). Sie behauptet keine
//     Straße: die Karte zeichnet sie gestrichelt, und daneben steht „geschätzt".
//   routeSchaetzen(punkte)            → Route (sofort, ohne Netz) — die Schätzung von oben.
//   routeGemerkt(punkte)              → die schon berechnete echte Route dieser Punkte oder null.
//   routeMitSchluessel()              → true, wenn ein OpenRouteService-Schlüssel eingetragen ist.
//   googleMapsUrl(punkte, optionen?)  → URL „In Google Maps öffnen" mit ALLEN Zwischenstopps.
//     optionen.ohneStart: true → der erste Punkt ist KEIN Start (die Karten-App nimmt dann den Ort,
//     an dem das Handy gerade ist), sondern schon ein Stopp.
//   UMWEG_FAKTOR · KMH                 → die zwei Zahlen der Schätzung (mitfahren.js liest sie hier).
//
// Warum hier und nicht in ui/map.js: map.js zeichnet Karten. Diese Datei rechnet Wege — sie wird
// auch dort gebraucht, wo keine Karte steht (die Zeit, zu der jemand abgeholt wird).

import { entfernungKm, hatLage } from '../core/entfernung.js';

export const UMWEG_FAKTOR = 1.3;
export const KMH = 40;

const ORS_URL = 'https://api.openrouteservice.org/v2/directions/driving-car/geojson';
// Der Gratis-Zugang erlaubt 50 Wegpunkte je Anfrage — mehr Leute passen in kein Auto.
const ORS_MAX_PUNKTE = 50;
const ORS_WARTEN_MS = 9000;
// Eine echte Route gilt zehn Minuten. Danach wird neu gefragt: Leute bewegen sich.
const GEMERKT_MS = 10 * 60 * 1000;

const gemerkt = new Map();
const unterwegs = new Map();

export function routeMitSchluessel() {
  const schluessel = globalThis.CREW_CONFIG?.orsSchluessel;
  return typeof schluessel === 'string' && schluessel.trim().length > 0;
}

function gueltigePunkte(punkte) {
  return (Array.isArray(punkte) ? punkte : []).filter(hatLage);
}

// Auf fünf Stellen (≈ 1 m) — so fragt ein Neuzeichnen mit denselben Leuten nicht noch einmal.
function signatur(punkte) {
  return gueltigePunkte(punkte).map((p) => `${p.lat.toFixed(5)},${p.lon.toFixed(5)}`).join('|');
}

export function routeSchaetzen(punkte) {
  const echte = gueltigePunkte(punkte);
  const abschnitte = [];
  for (let i = 0; i < echte.length - 1; i += 1) {
    const km = (entfernungKm(echte[i], echte[i + 1]) || 0) * UMWEG_FAKTOR;
    abschnitte.push({ meter: Math.round(km * 1000), dauerMin: (km / KMH) * 60 });
  }
  return {
    geschaetzt: true,
    quelle: 'luftlinie',
    meter: abschnitte.reduce((summe, a) => summe + a.meter, 0),
    dauerMin: abschnitte.reduce((summe, a) => summe + a.dauerMin, 0),
    linie: echte.map((p) => [p.lon, p.lat]),
    abschnitte,
  };
}

export function routeGemerkt(punkte) {
  const eintrag = gemerkt.get(signatur(punkte));
  if (!eintrag) return null;
  if (Date.now() - eintrag.am > GEMERKT_MS) { gemerkt.delete(signatur(punkte)); return null; }
  return eintrag.route;
}

async function orsFragen(punkte, schluessel) {
  const abbruch = typeof AbortController === 'function' ? new AbortController() : null;
  const uhr = abbruch ? setTimeout(() => abbruch.abort(), ORS_WARTEN_MS) : 0;
  try {
    const antwort = await fetch(ORS_URL, {
      method: 'POST',
      headers: {
        Authorization: schluessel,
        'Content-Type': 'application/json',
        Accept: 'application/geo+json, application/json',
      },
      body: JSON.stringify({ coordinates: punkte.map((p) => [p.lon, p.lat]), instructions: false }),
      signal: abbruch?.signal,
    });
    if (!antwort.ok) throw new Error(`ors ${antwort.status}`);
    const daten = await antwort.json();
    const weg = daten?.features?.[0];
    const summe = weg?.properties?.summary || {};
    const linie = weg?.geometry?.type === 'LineString' ? weg.geometry.coordinates : null;
    if (!linie || !Number.isFinite(Number(summe.duration))) throw new Error('ors leer');
    const abschnitte = (weg.properties.segments || []).map((s) => ({
      meter: Math.round(Number(s.distance) || 0),
      dauerMin: (Number(s.duration) || 0) / 60,
    }));
    return {
      geschaetzt: false,
      quelle: 'ors',
      meter: Math.round(Number(summe.distance) || 0),
      dauerMin: (Number(summe.duration) || 0) / 60,
      linie,
      // Ein Abschnitt je Teilstück. Fehlen sie (sehr kurze Wege), gilt die ganze Strecke als einer.
      abschnitte: abschnitte.length === punkte.length - 1
        ? abschnitte
        : [{ meter: Math.round(Number(summe.distance) || 0), dauerMin: (Number(summe.duration) || 0) / 60 }],
    };
  } finally {
    if (uhr) clearTimeout(uhr);
  }
}

export async function routeBerechnen(punkte) {
  const echte = gueltigePunkte(punkte);
  if (echte.length < 2) return { ...routeSchaetzen(echte), dauerMin: 0, meter: 0 };
  const schluessel = globalThis.CREW_CONFIG?.orsSchluessel;
  if (!routeMitSchluessel() || echte.length > ORS_MAX_PUNKTE) return routeSchaetzen(echte);
  const kennung = signatur(echte);
  const schon = routeGemerkt(echte);
  if (schon) return schon;
  if (unterwegs.has(kennung)) return unterwegs.get(kennung);
  const frage = orsFragen(echte, String(schluessel).trim())
    .then((route) => {
      gemerkt.set(kennung, { route, am: Date.now() });
      return route;
    })
    // Kein Netz, Schlüssel falsch, Tagesgrenze erreicht: Dann steht die Schätzung da — und sie
    // sagt, dass sie eine ist. Nichts wird als echte Route ausgegeben, was keine ist.
    .catch(() => ({ ...routeSchaetzen(echte), fehler: 'ors' }))
    .finally(() => unterwegs.delete(kennung));
  unterwegs.set(kennung, frage);
  return frage;
}

// „In Google Maps öffnen": Start, jeder Zwischenstopp in der Reihenfolge der Route, Ziel.
// Google nimmt bis zu neun Zwischenstopps über diesen Weg — mehr passen ohnehin in kein Auto.
export function googleMapsUrl(punkte, optionen = {}) {
  const echte = gueltigePunkte(punkte);
  if (!echte.length) return null;
  const text = (p) => `${Number(p.lat.toFixed(5))},${Number(p.lon.toFixed(5))}`;
  const ziel = echte[echte.length - 1];
  const start = optionen.ohneStart ? null : (echte.length > 1 ? echte[0] : null);
  const zwischen = echte.slice(start ? 1 : 0, -1).slice(0, 9);
  const teile = [`api=1`, `destination=${encodeURIComponent(text(ziel))}`, 'travelmode=driving'];
  if (start) teile.push(`origin=${encodeURIComponent(text(start))}`);
  if (zwischen.length) teile.push(`waypoints=${encodeURIComponent(zwischen.map(text).join('|'))}`);
  return `https://www.google.com/maps/dir/?${teile.join('&')}`;
}
