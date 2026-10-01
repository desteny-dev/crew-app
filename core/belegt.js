// Runde 4 (B5) — „Keine Zeit": feste Zeiten, die jede Woche wiederkommen.
//
// Jonathan: „Montags bis donnerstags von x bis y und am Freitag x bis y … diese Uhrzeiten hab
// ich Arbeit." Andere sehen davon NUR, dass man sicher keine Zeit hat — nie, was man macht, und
// nie den Plan selbst. Es setzt niemanden frei und nimmt niemandem das Frei.
//
// Datenform (settings.belegt, bei Freunden person.belegt):
//   [{ tage: [1, 2, 3, 4], von: '08:00', bis: '17:00' }, …]
//   tage: 0 = So, 1 = Mo … 6 = Sa (wie Date.getDay()). von/bis 'HH:MM'.
//   bis < von heißt: das Fenster endet am Folgetag (Nachtschicht 22:00–06:00).
//   bis '00:00' heißt: bis Mitternacht.
//
// Alle Funktionen sind rein (kein DOM, kein Speicher) — Crew, Raum und Neues Meet nutzen sie.

import { t } from './sprache.js';
import { weekdayShort, toISODate } from './dates.js';

const ZEIT = /^([01]\d|2[0-3]):([0-5]\d)$/;
const TAG_MS = 24 * 60 * 60 * 1000;

// Anzeige- und Auswahlreihenfolge: Die Woche beginnt am Montag.
export const WOCHE_AB_MONTAG = [1, 2, 3, 4, 5, 6, 0];

function minutenVon(hhmm) {
  const treffer = ZEIT.exec(String(hhmm || ''));
  return treffer ? Number(treffer[1]) * 60 + Number(treffer[2]) : null;
}

const zwei = (n) => String(n).padStart(2, '0');

export function uhrzeitText(datum) {
  return `${zwei(datum.getHours())}:${zwei(datum.getMinutes())}`;
}

// Kurzname eines Wochentags (0 = So) in der aktiven Sprache — dieselben Namen wie überall.
// 2024-01-07 war ein Sonntag; +d ergibt den gewünschten Tag.
export function tagKurz(tag) {
  return weekdayShort(`2024-01-${zwei(7 + (Number(tag) % 7))}`);
}

// Nur gültige Fenster: Tage 0–6 ohne Doppelte (aufsteigend), von/bis 'HH:MM', von ≠ bis.
export function belegtBereinigen(roh) {
  if (!Array.isArray(roh)) return [];
  const sauber = [];
  for (const fenster of roh) {
    if (!fenster || typeof fenster !== 'object') continue;
    const tage = [...new Set((Array.isArray(fenster.tage) ? fenster.tage : [])
      .map(Number)
      .filter((tag) => Number.isInteger(tag) && tag >= 0 && tag <= 6))].sort((a, b) => a - b);
    const von = minutenVon(fenster.von);
    const bis = minutenVon(fenster.bis);
    if (!tage.length || von === null || bis === null || von === bis) continue;
    sauber.push({ tage, von: fenster.von, bis: fenster.bis });
  }
  return sauber;
}

// Alle Fenster als echte Zeiträume rund um einen Zeitpunkt (von einem Tag davor bis acht Tage
// danach). Mit lokalen Datumsangaben gebaut — Sommerzeit verschiebt so keine Uhrzeit.
function zeitraeume(belegt, datum, tageDavor = 1, tageDanach = 8) {
  const liste = [];
  const j = datum.getFullYear();
  const m = datum.getMonth();
  const d = datum.getDate();
  for (const fenster of belegtBereinigen(belegt)) {
    const von = minutenVon(fenster.von);
    const bis = minutenVon(fenster.bis);
    for (let k = -tageDavor; k <= tageDanach; k += 1) {
      const tag = new Date(j, m, d + k);
      if (!fenster.tage.includes(tag.getDay())) continue;
      const start = new Date(j, m, d + k, 0, von).getTime();
      const ende = new Date(j, m, d + k + (bis > von ? 0 : 1), 0, bis).getTime();
      liste.push({ start, ende });
    }
  }
  return liste.sort((a, b) => a.start - b.start);
}

// Hat man JETZT sicher keine Zeit — und bis wann?
//   → { belegt: true, bis: '17:00', ende: Date }  (aneinanderstoßende Fenster zählen als eines)
//   → { belegt: false, bis: null, ende: null }
export function belegtJetzt(belegt, datum = new Date()) {
  const jetzt = datum.getTime();
  const liste = zeitraeume(belegt, datum);
  const aktiv = liste.filter((z) => z.start <= jetzt && jetzt < z.ende);
  if (!aktiv.length) return { belegt: false, bis: null, ende: null };
  let ende = Math.max(...aktiv.map((z) => z.ende));
  // Verketten: 08–12 und 12–17 ergeben „bis 17:00", nicht „bis 12:00".
  for (let runde = 0; runde < 64; runde += 1) {
    const weiter = liste.find((z) => z.start <= ende && z.ende > ende);
    if (!weiter) break;
    ende = weiter.ende;
  }
  const endeDatum = new Date(ende);
  return { belegt: true, bis: uhrzeitText(endeDatum), ende: endeDatum };
}

// Der Satz für die Anzeige — nie mehr als das.
//   'Keine Zeit bis 17:00' · 'Keine Zeit bis Mitternacht' · 'Keine Zeit bis morgen 06:00'
//   'Keine Zeit bis Mo 08:00' · '' (wenn man nicht belegt ist)
export function belegtText(zustand, jetzt = new Date()) {
  if (!zustand?.belegt || !zustand.ende) return '';
  const ende = zustand.ende;
  const heute = new Date(jetzt.getFullYear(), jetzt.getMonth(), jetzt.getDate()).getTime();
  const endeTag = new Date(ende.getFullYear(), ende.getMonth(), ende.getDate()).getTime();
  const tage = Math.round((endeTag - heute) / TAG_MS);
  const zeit = uhrzeitText(ende);
  if (tage <= 0) return t('Keine Zeit bis {zeit}', { zeit });
  if (tage === 1 && zeit === '00:00') return t('Keine Zeit bis Mitternacht');
  if (tage === 1) return t('Keine Zeit bis morgen {zeit}', { zeit });
  return t('Keine Zeit bis {tag} {zeit}', { tag: tagKurz(ende.getDay()), zeit });
}

// Runde 5 (B5, Jonathan: „Bei Busy ist sehr viel Text, etwas zu viel."): Wo „Keine Zeit" schon als
// Überschrift steht (die eigene Karte im Profil), reicht das Ende: 'bis 17:00' · 'bis Mitternacht' ·
// 'bis morgen 06:00' · 'bis Mo 08:00' · ''. Freunde sehen weiter den ganzen Satz (belegtText).
export function belegtBisText(zustand, jetzt = new Date()) {
  if (!zustand?.belegt || !zustand.ende) return '';
  const ende = zustand.ende;
  const heute = new Date(jetzt.getFullYear(), jetzt.getMonth(), jetzt.getDate()).getTime();
  const endeTag = new Date(ende.getFullYear(), ende.getMonth(), ende.getDate()).getTime();
  const tage = Math.round((endeTag - heute) / TAG_MS);
  const zeit = uhrzeitText(ende);
  if (tage <= 0) return t('bis {zeit}', { zeit });
  if (tage === 1 && zeit === '00:00') return t('bis Mitternacht');
  if (tage === 1) return t('bis morgen {zeit}', { zeit });
  return t('bis {tag} {zeit}', { tag: tagKurz(ende.getDay()), zeit });
}

// Kurzform: direkt aus den Fenstern einer Person.
export function belegtHinweis(belegt, jetzt = new Date()) {
  return belegtText(belegtJetzt(belegt, jetzt), jetzt);
}

// Überschneidet sich ein Zeitraum mit einem Fenster? (Zeitvorschläge, Neues Meet)
export function belegtImZeitraum(belegt, von, bis) {
  const a = von instanceof Date ? von : new Date(von);
  const b = bis instanceof Date ? bis : new Date(bis);
  if (!(b > a)) return false;
  const tageDanach = Math.min(60, Math.ceil((b - a) / TAG_MS) + 1);
  return zeitraeume(belegt, a, 1, tageDanach).some((z) => z.start < b.getTime() && z.ende > a.getTime());
}

// --- Runde 7 (E1/E2): die Woche als BLÖCKE ---------------------------------------------------
//
// Die Wochenansicht wird GERECHNET, nicht gespeichert. Die Daten bleiben ein Wochenmuster
// ([{tage,von,bis}]) — ein datierter Kalender würde Ausnahmen versprechen, die man gar nicht
// eintragen kann. Genau deshalb steht die Rechnung hier und nicht in einem Bildschirm: sonst
// hätte die eigene Woche eine andere Wahrheit als die Woche bei einer Freundin.
//
// Ein Block sagt AUSSCHLIESSLICH „hier ist keine Zeit" — kein Grund, kein Titel, kein Ort.
// Mehr steht auch nicht in den Daten (belegtBereinigen wirft alles andere weg), und mehr darf
// niemals hinzukommen: es ist eine Freundes-App, kein Kalender-Server.
//
//   woche(belegt) → [{ tag, streifen: [{ vonMin, bisMin }] }]   sieben Einträge ab Montag
//
// vonMin/bisMin sind Minuten seit Mitternacht des jeweiligen Tages (0…1440). Eine Nachtschicht
// 22:00–06:00 erzeugt zwei Streifen (Mo 1320–1440 und Di 0–360); aneinanderstoßende Fenster
// (08–12 und 12–17) verschmelzen zu einem Streifen, genau wie belegtJetzt sie verkettet —
// sonst zeigte dieselbe Angabe an zwei Stellen zwei Antworten.
export function woche(belegt, bezug = new Date()) {
  const montag = new Date(bezug.getFullYear(), bezug.getMonth(), bezug.getDate());
  // getDay(): 0 = So. Der Montag dieser Woche liegt (tag + 6) % 7 Tage zurück.
  montag.setDate(montag.getDate() - ((montag.getDay() + 6) % 7));
  const liste = zeitraeume(belegt, montag, 1, 8);
  return WOCHE_AB_MONTAG.map((tag, index) => {
    const start = new Date(montag.getFullYear(), montag.getMonth(), montag.getDate() + index);
    const ende = new Date(montag.getFullYear(), montag.getMonth(), montag.getDate() + index + 1);
    const tagStart = start.getTime();
    const tagEnde = ende.getTime();
    const roh = [];
    for (const zeitraum of liste) {
      const von = Math.max(zeitraum.start, tagStart);
      const bis = Math.min(zeitraum.ende, tagEnde);
      if (!(bis > von)) continue;
      const vonDatum = new Date(von);
      // Sommerzeit: die Minuten kommen aus der ÖRTLICHEN Uhr, nicht aus der Differenz in
      // Millisekunden — ein 23- oder 25-Stunden-Tag verschöbe sonst jeden Balken.
      const vonMin = vonDatum.getHours() * 60 + vonDatum.getMinutes();
      const bisDatum = new Date(bis);
      const bisMin = bis === tagEnde ? 1440 : bisDatum.getHours() * 60 + bisDatum.getMinutes();
      if (bisMin > vonMin) roh.push({ vonMin, bisMin });
    }
    roh.sort((a, b) => a.vonMin - b.vonMin);
    const streifen = [];
    for (const block of roh) {
      const letzter = streifen[streifen.length - 1];
      if (letzter && block.vonMin <= letzter.bisMin) letzter.bisMin = Math.max(letzter.bisMin, block.bisMin);
      else streifen.push({ ...block });
    }
    return { tag, streifen };
  });
}

// Wie viele Minuten der Woche sind belegt? (Für „14 Stunden in der Woche" o. Ä. — eine Zahl,
// die aus derselben Rechnung kommt wie der Streifen.)
export function wochenMinuten(belegt, bezug = new Date()) {
  return woche(belegt, bezug).reduce(
    (summe, tag) => summe + tag.streifen.reduce((s, b) => s + (b.bisMin - b.vonMin), 0),
    0,
  );
}

// Die Tage als kurzer Text in Wochenreihenfolge: Mo–Do · Mo, Mi, Fr · Sa, So · Jeden Tag.
export function tageText(tage) {
  const gewaehlt = WOCHE_AB_MONTAG.filter((tag) => (tage || []).includes(tag));
  if (gewaehlt.length === 7) return t('Jeden Tag');
  if (!gewaehlt.length) return '';
  const laeufe = [];
  for (const tag of gewaehlt) {
    const pos = WOCHE_AB_MONTAG.indexOf(tag);
    const letzter = laeufe[laeufe.length - 1];
    if (letzter && WOCHE_AB_MONTAG.indexOf(letzter[letzter.length - 1]) === pos - 1) letzter.push(tag);
    else laeufe.push([tag]);
  }
  return laeufe.map((lauf) => (lauf.length >= 3
    ? `${tagKurz(lauf[0])}–${tagKurz(lauf[lauf.length - 1])}`
    : lauf.map(tagKurz).join(', '))).join(', ');
}

// Eine Zeile der eigenen Liste: 'Mo–Do · 08:00–17:00'.
export function zeitfensterText(fenster) {
  if (!fenster) return '';
  return `${tageText(fenster.tage)} · ${fenster.von}–${fenster.bis}`;
}
