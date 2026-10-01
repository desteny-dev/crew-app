// iPhone-Runde 1 (B3): Gemeinsame freie Zeit einer Gruppe — die EINE Rechenregel.
//
// Jonathan: „In einer Gruppe sieht man im Kalender auf einen Blick, wann alle oder fast alle Zeit
// haben. Leer heißt: Hier hat kaum jemand Zeit. Grün erscheint erst, wenn mindestens die Hälfte
// frei ist. Je mehr Mitglieder frei sind, desto kräftiger wird das Grün. Volles Grün heißt: Alle
// haben Zeit." Datengrundlage ist nur, was in Crew steht (Busy, zugesagte Meets) — und man sieht
// nur, WER nicht kann, nie warum.
//
// Beide Gateways geben dafür nur ZEITEN in diese Regel: je Mitglied eine Liste
//   [{ datum:'YYYY-MM-DD', von:'HH:MM', bis:'HH:MM'|null }]
// ohne Titel, ohne Art (Busy oder Meet ist nicht zu unterscheiden). Am Server entsteht diese
// Liste in der Datenbank (public.gruppen_zeiten, Migration 0053) — ein fremder Busy-Titel verlässt
// sie nie. Im Gerät baut der Demo-Datenweg dieselbe Form aus seinem Bestand (busyAlsZeiten unten,
// dieselbe Regel wie in 0053, und projections.js meetZeitenRoh, dieselbe wie in 0041).
//
// Regeln einer Zeit (für Busy und Meet gleich):
//   · bis ≤ von heißt: sie endet am Folgetag (Nachtschicht 22–06, Meet 20–01). bis '00:00' = Mitternacht.
//   · bis null (Meet ohne Ende): sie läuft MEET_OHNE_ENDE_MIN (4 h) — wie überall im Kalender.
//   · Eine Zeit vom Vortag reicht in den ersten Tag hinein (deshalb liefern beide Wege den Vortag mit).
//
// Die Antwort (repo.getGruppenZeit, beide Gateways dieselbe Form):
//   { ok, grund, geladen, gesamt, vonMin, bisMin,
//     tage:[{ iso, tag, bereiche:[{ vonMin, bisMin, frei, gesamt, stufe, fehlend:[personId…] }] }] }
//   · Sieben Tage ab heute; gezeigt wird der Tag von TAG_VON_MIN (8 Uhr) bis Mitternacht — nachts
//     trägt niemand „schlafen" ein, die Nacht wäre sonst immer „alle frei".
//   · Heute beginnt frühestens jetzt (auf die nächste Viertelstunde): Vergangenes plant niemand.
//   · Ein Bereich ist eine Strecke, in der GENAU DIESELBEN Menschen fehlen. Gleiche Stufe mit anderen
//     Fehlenden bleibt ein eigener Bereich — sonst stimmte „Lena fehlt" beim Antippen nicht mehr.
//   · Nur Bereiche mit mindestens der Hälfte frei (frei · 2 ≥ gesamt) und mindestens
//     MINDEST_MIN (30 min) Länge — eine Lücke von zehn Minuten ist keine gemeinsame Zeit.
//   · stufe: 0 = genau die Hälfte frei … 1 = alle frei. Die Oberfläche macht daraus die Deckkraft.

import { MEET_OHNE_ENDE_MIN, ZUSAMMEN_TAGE, zusammenTageIso } from './projections.js';
import { belegtBereinigen } from '../core/belegt.js';

export const GRUPPEN_ZEIT_TAGE = ZUSAMMEN_TAGE;
export const TAG_VON_MIN = 8 * 60;
export const TAG_BIS_MIN = 24 * 60;
export const MINDEST_MIN = 30;
const TAG_MIN = 24 * 60;
const RASTER_MIN = 15;

function minutenAus(zeit) {
  const treffer = /^(\d{1,2}):(\d{2})/.exec(String(zeit || ''));
  if (!treffer) return null;
  const wert = Number(treffer[1]) * 60 + Number(treffer[2]);
  return wert >= 0 && wert <= TAG_MIN ? wert : null;
}

function isoPlus(iso, tage) {
  const [j, m, d] = String(iso).split('-').map(Number);
  const tag = new Date(j, m - 1, d + tage);
  return `${tag.getFullYear()}-${String(tag.getMonth() + 1).padStart(2, '0')}-${String(tag.getDate()).padStart(2, '0')}`;
}

function wochentag(iso) {
  const [j, m, d] = String(iso).split('-').map(Number);
  return new Date(j, m - 1, d).getDay();
}

// Die Tage, für die ein Datenweg Zeiten liefern muss: der Vortag (Nachtschicht) bis zum letzten Tag.
export function gruppenZeitTage(bezug = new Date()) {
  const tage = zusammenTageIso(bezug);
  return { tage, ab: isoPlus(tage[0], -1), bis: tage[tage.length - 1] };
}

// Wöchentliche Busy-Fenster ({ tage, von, bis, … }) → Zeiten an echten Tagen, NUR Datum/von/bis.
// Titel und Schloss fallen hier schon beim Lesen weg. Dieselbe Regel steht in 0053 (SQL) für den Server.
export function busyAlsZeiten(fenster, ab, bis) {
  const liste = [];
  const sauber = belegtBereinigen(fenster);
  for (let iso = ab; iso <= bis; iso = isoPlus(iso, 1)) {
    const tag = wochentag(iso);
    for (const f of sauber) if (f.tage.includes(tag)) liste.push({ datum: iso, von: f.von, bis: f.bis });
  }
  return liste;
}

// Eine Zeit → [start, ende) in Minuten ab Mitternacht des ersten Tages.
function spanneAb(eintrag, ersterTag) {
  const datum = String(eintrag?.datum || '').slice(0, 10);
  if (!/^\d{4}-\d{2}-\d{2}$/.test(datum)) return null;
  const von = minutenAus(eintrag.von);
  if (von === null || von >= TAG_MIN) return null;
  const [j1, m1, d1] = ersterTag.split('-').map(Number);
  const [j2, m2, d2] = datum.split('-').map(Number);
  const tagIndex = Math.round((Date.UTC(j2, m2 - 1, d2) - Date.UTC(j1, m1 - 1, d1)) / 86400000);
  const basis = tagIndex * TAG_MIN;
  const bis = minutenAus(eintrag.bis);
  if (bis === null) return { start: basis + von, ende: basis + von + MEET_OHNE_ENDE_MIN };
  return { start: basis + von, ende: bis > von ? basis + bis : basis + TAG_MIN + bis };
}

// 0 = genau die Hälfte frei … 1 = alle frei; null = weniger als die Hälfte (bleibt leer).
export function gruppenStufe(frei, gesamt) {
  if (!(gesamt > 0) || frei * 2 < gesamt) return null;
  if (frei >= gesamt) return 1;
  const halb = gesamt / 2;
  return Math.round(((frei - halb) / (gesamt - halb)) * 1000) / 1000;
}

export function gruppenZeitLeer(grund = null, geladen = true) {
  return { ok: !grund, grund, geladen, gesamt: 0, vonMin: TAG_VON_MIN, bisMin: TAG_BIS_MIN, tage: [] };
}

// mitglieder: [personId…] in Anzeigereihenfolge · zeiten: { [personId]: [{ datum, von, bis }] }
export function gruppenZeit({ mitglieder = [], zeiten = {}, jetzt = new Date(), geladen = true } = {}) {
  const ids = [...new Set((mitglieder || []).filter(Boolean))];
  const tage = zusammenTageIso(jetzt);
  const ersterTag = tage[0];
  const gesamt = ids.length;
  const belegt = new Map(ids.map((id) => [id, (zeiten?.[id] || []).map((z) => spanneAb(z, ersterTag)).filter(Boolean)]));
  const jetztMin = jetzt.getHours() * 60 + jetzt.getMinutes();
  const ab = Math.ceil(jetztMin / RASTER_MIN) * RASTER_MIN;
  const ergebnis = tage.map((iso, index) => {
    const basis = index * TAG_MIN;
    const von = basis + (index === 0 ? Math.max(TAG_VON_MIN, ab) : TAG_VON_MIN);
    const bis = basis + TAG_BIS_MIN;
    const bereiche = [];
    if (gesamt && von < bis) {
      const kanten = new Set([von, bis]);
      for (const spannen of belegt.values()) {
        for (const s of spannen) {
          if (s.start > von && s.start < bis) kanten.add(s.start);
          if (s.ende > von && s.ende < bis) kanten.add(s.ende);
        }
      }
      const punkte = [...kanten].sort((a, b) => a - b);
      const stuecke = [];
      for (let i = 0; i < punkte.length - 1; i += 1) {
        const a = punkte[i];
        const b = punkte[i + 1];
        const fehlend = ids.filter((id) => belegt.get(id).some((s) => s.start < b && s.ende > a));
        const letztes = stuecke[stuecke.length - 1];
        if (letztes && letztes.bis === a && letztes.fehlend.join('|') === fehlend.join('|')) letztes.bis = b;
        else stuecke.push({ von: a, bis: b, fehlend });
      }
      for (const stueck of stuecke) {
        const frei = gesamt - stueck.fehlend.length;
        const stufe = gruppenStufe(frei, gesamt);
        if (stufe === null || stueck.bis - stueck.von < MINDEST_MIN) continue;
        bereiche.push({ vonMin: stueck.von - basis, bisMin: stueck.bis - basis, frei, gesamt, stufe, fehlend: stueck.fehlend });
      }
    }
    return { iso, tag: wochentag(iso), bereiche };
  });
  return { ok: true, grund: null, geladen, gesamt, vonMin: TAG_VON_MIN, bisMin: TAG_BIS_MIN, tage: ergebnis };
}
