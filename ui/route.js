// Runde 8 (R8-27) — Routen für die Anreise: wer fährt, holt wen ab, und wie lange dauert das?
//
// Jonathan: „Tipp auf eine Person → Route ich → Person → Treffpunkt mit Zeit … Routen über
// OpenRouteService (Jonathan legt den Gratis-Schlüssel an), Navigation übergeben an Google Maps."
//
// API (verbindlich, feste Schnittstelle aus dem Rundenauftrag):
//   routeBerechnen(punkte, repo, optionen?) → Promise<Route>
//     punkte: [{ lat, lon }, …] in Fahrtreihenfolge — Start, Zwischenstopps, Ziel (mindestens zwei).
//     optionen: { fahrer: personId, meet: meetId } — wessen Fahrt und zu welchem Meet. Damit merkt sich der Server die
//       optionen.personen: [personId|null je Punkt] — nur wenn der Fahrer selbst rechnet (Abholzeit je Mitfahrer, 0048).
//       Route (je Fahrer und Menge der Halte, 0047): dieselbe Menge kostet beim Routen-Dienst nichts mehr. Punkte mit
//       quelle 'geteilt' | 'standort' | 'geraet' liegen am Live-Standort — die gelten am Server nur kurz (istLive).
//     Runde 11 (C3): Die echte Route kommt vom Datenweg (repo.routeFragen → Supabase-Funktion
//       `route` → OpenRouteService, Profil driving-car). Der Schlüssel liegt NUR auf dem Server
//       (Hausregel 7) — vorher stand hier ein Feld in web/config.js, das leer bleiben musste. →
//       { geschaetzt:false, quelle:'ors', dauerMin, meter, linie:[[lon,lat],…], abschnitte:[{ dauerMin, meter }] }
//     Ohne Konto (Demo), ohne Netz oder wenn der Dienst nicht antwortet — ehrlich geschätzt aus der Luftlinie →
//       { geschaetzt:true, quelle:'luftlinie', dauerMin, meter, linie:[[lon,lat],…] (gerade Stücke),
//         abschnitte:[…], fehler?:'ors' }
//     Die Schätzung ist dieselbe Rechnung, die das Mitfahren seit Runde 5 benutzt: Luftlinie × 1,3
//     (Straßen sind nie gerade), 40 km/h (Stadt und Land gemischt, mit Ampeln). Sie behauptet keine
//     Straße: die Karte zeichnet sie gestrichelt, und daneben steht „geschätzt".
//   routeSchaetzen(punkte)            → Route (sofort, ohne Netz) — die Schätzung von oben.
//   routeGemerkt(punkte)              → die schon berechnete echte Route dieser Punkte oder null.
//   reihenfolgeGemerkt(start, ziel, stopps) → die Abholungen in der Reihenfolge, die der Dienst nach
//     echter Fahrzeit als kürzeste gefunden hat (Runde 12) — oder null, solange er keine kennt.
//     Die Abholreihenfolge der App (mitfahren.js › abholReihenfolge) rechnet zuerst aus der Luftlinie;
//     sobald hier eine echte Antwort liegt, gilt sie. Die Route dazu liegt unter den Punkten in
//     genau dieser Reihenfolge — routeGemerkt findet sie also beim nächsten Zeichnen.
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

// Liegt der Punkt an einem Live-Standort? Ein Live-Standort bewegt sich — der Server merkt sich eine Route mit so einem
// Halt höchstens 10 Minuten, alles andere (Abholadresse, Zuhause, Treffpunkt) 30 Tage.
const LIVE_QUELLEN = new Set(['geteilt', 'standort', 'geraet']);
export const istLive = (punkt) => LIVE_QUELLEN.has(punkt?.quelle);

// Fahrer + acht Mitfahrende + Ziel — mehr passen in kein Auto (die Funktion nimmt höchstens 12).
const MAX_PUNKTE = 12;
// Eine echte Route gilt zehn Minuten. Danach wird neu gefragt: Leute bewegen sich.
const GEMERKT_MS = 10 * 60 * 1000;
// Kam keine echte Route (kein Netz, Dienst aus, Grenze erreicht), wird dieselbe Strecke zwei Minuten lang nicht
// noch einmal gefragt — sonst fragte jedes Neuzeichnen (Live-Daten) für jeden Fahrer von vorn.
const NICHT_WIEDER_MS = 2 * 60 * 1000;

// Liegt ein Halt am Live-Standort, ändert sich die Lage alle paar Sekunden — jede neue Stelle wäre eine neue Anfrage beim Routen-Dienst
// (dessen Tageskontingent klein ist). Darum gilt eine Route mit denselben Halten (Live-Punkte nur auf ≈ 1 km genau) fünf Minuten lang
// weiter; erst danach wird für die neue Stelle neu gefragt.
const LIVE_PAUSE_MS = 5 * 60 * 1000;
const jungeLive = new Map();
function grobSignatur(punkte, fahrer) {
  return `${fahrer || ''}#${punkte.map((p) => (istLive(p) ? `~${Math.round(p.lat / 0.01)},${Math.round(p.lon / 0.01)}` : `${p.lat.toFixed(5)},${p.lon.toFixed(5)}`)).join('|')}`;
}

const gemerkt = new Map();
const reihenfolgen = new Map();
const unterwegs = new Map();
const vergeblich = new Map();

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

// Start, Ziel und die Menge der Abholungen — ohne ihre Reihenfolge. Dieselben Leute an denselben Orten
// ergeben denselben Schlüssel, egal wie sie gerade sortiert sind.
function mengenSignatur(start, ziel, stopps) {
  const lagen = (Array.isArray(stopps) ? stopps : []).map((stopp) => stopp?.lage);
  if (![start, ziel, ...lagen].every(hatLage)) return null;
  return `${signatur([start])}>${lagen.map((lage) => signatur([lage])).sort().join('|')}>${signatur([ziel])}`;
}

export function reihenfolgeGemerkt(start, ziel, stopps) {
  const schluessel = mengenSignatur(start, ziel, stopps);
  const eintrag = schluessel && reihenfolgen.get(schluessel);
  if (!eintrag) return null;
  if (Date.now() - eintrag.am > GEMERKT_MS) { reihenfolgen.delete(schluessel); return null; }
  const frei = [...stopps];
  const geordnet = [];
  for (const sig of eintrag.ordnung) {
    const nr = frei.findIndex((stopp) => signatur([stopp.lage]) === sig);
    if (nr < 0) return null;
    geordnet.push(frei.splice(nr, 1)[0]);
  }
  return frei.length ? null : geordnet;
}

export function routeGemerkt(punkte) {
  const eintrag = gemerkt.get(signatur(punkte));
  if (!eintrag) return null;
  if (Date.now() - eintrag.am > GEMERKT_MS) { gemerkt.delete(signatur(punkte)); return null; }
  return eintrag.route;
}

export async function routeBerechnen(punkte, repo, optionen = {}) {
  const echte = gueltigePunkte(punkte);
  if (echte.length < 2) return { ...routeSchaetzen(echte), dauerMin: 0, meter: 0 };
  if (typeof repo?.routeFragen !== 'function' || echte.length > MAX_PUNKTE) return routeSchaetzen(echte);
  const kennung = signatur(echte);
  const schon = routeGemerkt(echte);
  if (schon) return schon;
  if (unterwegs.has(kennung)) return unterwegs.get(kennung);
  const grob = echte.some(istLive) ? grobSignatur(echte, optionen.fahrer) : null;
  const junge = grob && jungeLive.get(grob);
  if (junge && Date.now() - junge.am < LIVE_PAUSE_MS) {
    gemerkt.set(kennung, { route: junge.route, am: Date.now() });
    return junge.route;
  }
  if (Date.now() - (vergeblich.get(kennung) || 0) < NICHT_WIEDER_MS) return { ...routeSchaetzen(echte), fehler: 'ors' };
  const frage = Promise.resolve()
    .then(() => repo.routeFragen(echte, {
      fahrer: optionen.fahrer || null,
      meet: optionen.meet || null,
      live: echte.map((p, nr) => (istLive(p) ? nr : -1)).filter((nr) => nr >= 0),
      personen: optionen.personen || null,
    }))
    .then((antwort) => {
      if (antwort?.ok !== true || !Array.isArray(antwort.linie) || antwort.linie.length < 2) throw new Error(antwort?.reason || 'leer');
      // Der Dienst darf die Abholungen umstellen (Runde 12): `reihenfolge` sagt, in welcher Reihenfolge der
      // eingereichten Punkte er gefahren ist. Nur eine echte Umstellung der Mitte zählt — Start und Ziel
      // bleiben. Alles andere (fehlt, kaputt, Start/Ziel vertauscht) wird ignoriert: dann gilt die Route
      // für die Reihenfolge, in der gefragt wurde.
      const n = echte.length;
      const r = Array.isArray(antwort.reihenfolge) ? antwort.reihenfolge.map(Number) : null;
      const umgestellt = Boolean(r) && r.length === n && r[0] === 0 && r[n - 1] === n - 1
        && new Set(r).size === n && r.every((i) => Number.isInteger(i) && i >= 0 && i < n)
        && r.some((i, nr) => i !== nr);
      const gefahren = umgestellt ? r.map((i) => echte[i]) : echte;
      const summe = { meter: Math.round(Number(antwort.meter) || 0), dauerMin: Number(antwort.dauerMin) || 0 };
      const abschnitte = (antwort.abschnitte || []).map((a) => ({ meter: Math.round(Number(a.meter) || 0), dauerMin: Number(a.dauerMin) || 0 }));
      const route = {
        geschaetzt: false,
        quelle: 'ors',
        ...summe,
        linie: antwort.linie,
        // Ein Abschnitt je Teilstück. Fehlen sie, gilt die ganze Strecke als einer.
        abschnitte: abschnitte.length === echte.length - 1 ? abschnitte : [summe],
        // Die Punkte in der Reihenfolge, in der gefahren wird — bei einer Umstellung nicht die gefragte.
        punkte: gefahren,
      };
      gemerkt.set(signatur(gefahren), { route, am: Date.now() });
      if (umgestellt) {
        const mitte = gefahren.slice(1, -1).map((p) => `${p.lat.toFixed(5)},${p.lon.toFixed(5)}`);
        const schluessel = mengenSignatur(gefahren[0], gefahren[n - 1], gefahren.slice(1, -1).map((p) => ({ lage: p })));
        if (schluessel) reihenfolgen.set(schluessel, { ordnung: mitte, am: Date.now() });
      }
      if (grob) jungeLive.set(grob, { route, am: Date.now() });
      vergeblich.delete(kennung);
      return route;
    })
    // Kein Konto, kein Netz, Tagesgrenze erreicht: Dann steht die Schätzung da — und sie sagt, dass
    // sie eine ist. Nichts wird als echte Route ausgegeben, was keine ist.
    // „ohneKonto" (Demo) kostet kein Netz und wird darum nicht gesperrt — wer sich anmeldet, bekommt
    // sofort die echte Route.
    .catch((fehler) => {
      if (fehler?.message !== 'ohneKonto') vergeblich.set(kennung, Date.now());
      return { ...routeSchaetzen(echte), fehler: 'ors' };
    })
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
