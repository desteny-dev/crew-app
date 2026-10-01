// Algorithmus 2 — Persönliche Auswahl (ALGORITHMUS §3, ALGORITHMUS_ZUSATZ §5/§6 — der Zusatz hat Vorrang).
//
// EINE Wahrheit für App und Server (PLAN §0.3): Diese Datei läuft unverändert im Gerät (Demo-Gateway,
// mit Seed-Kandidaten) und in der Edge Function `auswahl` (Kopie in supabase/functions/_shared/,
// erzeugt von scripts/auswahl-deploy.mjs; `npm run lint` meldet jede Abweichung). Die Datenbank
// liefert nur Kandidaten (public.crew_auswahl_kandidaten — reine Lese-Funktion); gerechnet wird hier.
// Deshalb: nur die zwei Nachbar-Dateien als Importe, kein Speicher, kein Zustand, keine Oberfläche.
//
// Der Weg eines Eintrags (je Schritt eine Funktion, von oben nach unten):
//   1. Profil     — aus Signalen (ZUSATZ §5.1–5.3): 12 Merkmale + Wert je Aktivität (art·stil),
//                   Zerfall 6 Monate, Saison, „vergessen", Onboarding und Wischkarten als Start,
//                   Schätzung aus ähnlichen Menschen, solange eigene Signale fehlen.
//                   KEINE Pauschalen aus Alter, Geschlecht, Herkunft — das Alter zählt nur für
//                   gesetzliche Grenzen (Machbarkeit).
//   2. Vorauswahl — freigegeben (auch hier geprüft: Verteidigung in der Tiefe), Radius, Öffnungszeiten
//                   mit Feiertagen, Event-Fenster, Saison, gesetzliches Alter, Gruppengröße, Unwetter —
//                   und ein Treffpunkt (Treffpunkt-Eignung ≥ Grenze; Imbisse, Ketten-Fast-Food fallen hier raus).
//   3. Passung    — „wie viel mehr als der Durchschnitt" (ZUSATZ §5.4) auf beiden Ebenen; Gruppe
//                   0,6 × Minimum + 0,4 × Mittel, niemand unter 0,3; Crew-Profil; Absicht.
//   4. Rang       — q(Crew Score) × Passung^½ × leichter Distanz-Preis × Frische × Öffnung × Einheimisch/
//                   Besuch × Zusammenhang (Tageszeit, Wochentag, Jahreszeit, Wetter). Die Zahl zählt am
//                   stärksten; die doppelte Wohlfühl-Entfernung kostet höchstens ein Viertel.
//   5. Liste      — Abstandsregel (gleiche Art + Küche im Abdeckungs-Radius ersetzen sich), abnehmender Nutzen
//                   je Art nach Interessen-Stärke, Neu ≤ 20 %, „Mal was anderes" ≤ 1 von 10. Oben steht das
//                   Beste nach diesen Regeln, alles Übrige darunter (`weitere`) — gelöscht wird nichts.
//                   (Feinschliff 01.10.2026, ersetzt Ringe, Fern-Regel, Ausdünnen und Deckel aus §3.7.)
// Getrennt davon: Suche und Kategorien (ZUSATZ §6) — alles Freigegebene nach Crew Score, dann Entfernung,
// ohne Personen- und Einheimisch-Filter; die Namenssuche findet auch, was unter 70 liegt.

import { KONFIG_AUSWAHL as K } from './konfig-auswahl.js';
import { oeffnungsStatus, ortszeit } from './oeffnungszeiten.js';

export { KONFIG_AUSWAHL } from './konfig-auswahl.js';

const TAG_MS = 24 * 60 * 60 * 1000;
const STUNDE_MS = 60 * 60 * 1000;
const NEUTRAL = Object.freeze(Array(12).fill(0.5));

// =====================================================================================================
// Kleine Werkzeuge
// =====================================================================================================
function zahl(wert) {
  if (wert === null || wert === undefined || wert === '') return null;
  const z = Number(wert);
  return Number.isFinite(z) ? z : null;
}
const begrenzt = (wert, min, max) => Math.max(min, Math.min(max, wert));

export function zeitMs(wert) {
  if (wert == null || wert === '') return null;
  if (wert instanceof Date) return Number.isFinite(wert.getTime()) ? wert.getTime() : null;
  if (typeof wert === 'number') return Number.isFinite(wert) ? wert : null;
  const ms = Date.parse(String(wert));
  return Number.isFinite(ms) ? ms : null;
}

function merkmaleLesen(roh) {
  let werte = roh;
  if (typeof roh === 'string') {
    // Postgres-Array als Text: '{0.1,0.2,…}'
    werte = roh.replace(/[{}]/g, '').split(',');
  }
  if (!Array.isArray(werte) || werte.length !== 12) return null;
  const out = werte.map((w) => zahl(w));
  return out.every((w) => w !== null) ? out.map((w) => begrenzt(w, 0, 1)) : null;
}

export function entfernungKm(a, b) {
  if (!a || !b) return null;
  const lat1 = zahl(a.lat); const lon1 = zahl(a.lon); const lat2 = zahl(b.lat); const lon2 = zahl(b.lon);
  if ([lat1, lon1, lat2, lon2].some((w) => w === null)) return null;
  const r = 6371;
  const dLat = ((lat2 - lat1) * Math.PI) / 180;
  const dLon = ((lon2 - lon1) * Math.PI) / 180;
  const h = Math.sin(dLat / 2) ** 2 + Math.cos((lat1 * Math.PI) / 180) * Math.cos((lat2 * Math.PI) / 180) * Math.sin(dLon / 2) ** 2;
  return 2 * r * Math.asin(Math.min(1, Math.sqrt(h)));
}

// Ähnlichkeit zweier 12er-Muster: 1 − mittlerer Abstand (ALGORITHMUS §3.4).
export function aehnlichkeit(a, b) {
  if (!a || !b) return null;
  let summe = 0;
  for (let i = 0; i < 12; i += 1) summe += Math.abs(a[i] - b[i]);
  return 1 - summe / 12;
}

export function artVon(aktivitaet) {
  return String(aktivitaet || '').split('·')[0];
}

export function aktivitaetVon(art, stil) {
  return `${art}·${stil || 'ohne'}`;
}

// 'klettern·*' passt zu jedem Klettern-Stil; sonst genau.
// Interessen-Einheiten aus Karten und Gruppen: Wer „Sport“ wählt, hat EIN Interesse gezeigt — nicht
// sieben. Die Einheit 'gruppe:sport' bzw. 'karte:klettern' steht für ihre Muster.
const ZUSAMMEN = Object.freeze(Object.fromEntries([
  ...Object.entries(K.interessenGruppen).map(([g, x]) => [`gruppe:${g}`, x.aktivitaeten]),
  ...K.karten.map((k) => [`karte:${k.id}`, k.aktivitaeten]),
]));
const istEinheit = (schluessel) => Object.prototype.hasOwnProperty.call(ZUSAMMEN, schluessel);

// 'klettern·*' passt zu jedem Klettern-Stil; eine Einheit passt zu jedem ihrer Muster; sonst genau.
export function musterPasst(muster, aktivitaet) {
  if (!muster || !aktivitaet) return false;
  if (muster === aktivitaet) return true;
  if (istEinheit(muster)) return ZUSAMMEN[muster].some((m) => musterPasst(m, aktivitaet));
  const [art, stil] = muster.split('·');
  return stil === '*' && artVon(aktivitaet) === art;
}

// --- Texte, die übersetzt werden können ---------------------------------------------------------------
// Der Server hat das Wörterbuch der App nicht. Deshalb liefert jeder Text neben der deutschen Fassung
// seinen Baustein { text, werte }: `text` ist ein deutscher Satz aus der Konfig (Schlüssel im Wörterbuch,
// Übersetzungen in scratch/uebersetzung/*-alg-c.json), `werte` füllt die {Platzhalter}:
//   'Wort' / 12        → so einsetzen (Uhrzeit, Grad)
//   { worte: [a, b] }  → jedes Wort übersetzen, mit ' · ' verbinden („Klettern · Fels“)
//   { liste: [a, b] }  → jedes Wort übersetzen, mit ', ' verbinden („ruhig, draußen“)
// Die App macht daraus t(text, werte) — dieselbe Regel, nur mit dem Wörterbuch der Sprache.
export function baustein(text, werte = {}) {
  return { text, werte };
}

export function textAus(b) {
  if (!b) return '';
  return String(b.text).replace(/\{(\w+)\}/g, (_, k) => {
    const w = b.werte?.[k];
    if (w && Array.isArray(w.worte)) return w.worte.join(' · ');
    if (w && Array.isArray(w.liste)) return w.liste.join(', ');
    return w ?? '';
  });
}

function artLabel(art) {
  return K.arten[art]?.label || art;
}

// Die Wörter eines Labels („Klettern“, „Fels“) — jedes für sich ein Wörterbuch-Schlüssel.
export function aktivitaetWorte(aktivitaet) {
  if (String(aktivitaet).startsWith('gruppe:')) return [K.interessenGruppen[aktivitaet.slice(7)]?.label || aktivitaet];
  if (String(aktivitaet).startsWith('karte:')) return [K.karten.find((k) => `karte:${k.id}` === aktivitaet)?.label || aktivitaet];
  const [art, stil] = String(aktivitaet).split('·');
  if (art === 'idee') return [K.arten.idee.label];
  if (!stil || stil === '*' || stil === 'ohne' || stil === art) return [artLabel(art)];
  const stilText = K.stile[`${art}·${stil}`] || K.stile[stil] || stil.replace(/_/g, ' ').replace(/ae/g, 'ä').replace(/oe/g, 'ö').replace(/ue/g, 'ü');
  return [artLabel(art), stilText];
}

export function aktivitaetLabel(aktivitaet) {
  return aktivitaetWorte(aktivitaet).join(' · ');
}

// =====================================================================================================
// Saison (ZUSATZ §5.2): je Jahreszeit gemerkt, verblasst nicht über den Sommer
// =====================================================================================================
function saisonMonate(aktivitaet, lat) {
  const eintrag = K.saison.find((s) => musterPasst(s.muster, aktivitaet));
  if (!eintrag) return null;
  // Südhalbkugel: Jahreszeiten um 6 Monate verschoben.
  return (zahl(lat) ?? 45) < 0 ? eintrag.monate.map((m) => ((m + 5) % 12) + 1) : eintrag.monate;
}

export function inSaison(aktivitaet, ms, lat) {
  const monate = saisonMonate(aktivitaet, lat);
  if (!monate) return true;
  return monate.includes(new Date(ms).getUTCMonth() + 1);
}

// Tage zwischen zwei Zeitpunkten, die in die Saison fallen (Monatsweise genau genug).
function saisonTage(von, bis, monate) {
  if (bis <= von) return 0;
  let tage = 0;
  let cursor = von;
  while (cursor < bis) {
    const d = new Date(cursor);
    const monatsEnde = Date.UTC(d.getUTCFullYear(), d.getUTCMonth() + 1, 1);
    const ende = Math.min(monatsEnde, bis);
    if (monate.includes(d.getUTCMonth() + 1)) tage += (ende - cursor) / TAG_MS;
    cursor = ende;
  }
  return tage;
}

export function zerfall(signalMs, jetzt, aktivitaet) {
  if (!Number.isFinite(signalMs) || signalMs <= 0) return 1; // Onboarding-Interessen: kein Alter
  const monate = saisonMonate(aktivitaet);
  const tage = monate ? saisonTage(signalMs, jetzt, monate) : Math.max(0, (jetzt - signalMs) / TAG_MS);
  return 0.5 ** (tage / K.halbwertszeitTage);
}

// =====================================================================================================
// 1. Profil aus Signalen (ZUSATZ §5.1–5.3)
// =====================================================================================================
// Signal (Server: Zeile aus signale_eigen + Merkmale/Lage des Eintrags; Gerät: dasselbe aus dem Speicher):
//   { art, eintragTyp, eintragId, aktivitaet, wert?, erstelltAm, meetId?, crewId?, merkmale?, lat?, lon?, land? }
export function signalLesen(roh) {
  if (!roh || typeof roh !== 'object') return null;
  const art = String(roh.art || '');
  if (!art) return null;
  return {
    art,
    eintragTyp: String(roh.eintragTyp ?? roh.eintrag_typ ?? ''),
    eintragId: String(roh.eintragId ?? roh.eintrag_id ?? ''),
    aktivitaet: roh.aktivitaet ? String(roh.aktivitaet) : null,
    wert: zahl(roh.wert),
    zeit: zeitMs(roh.erstelltAm ?? roh.erstellt_am ?? roh.zeit) ?? 0,
    meetId: roh.meetId ?? roh.meet_id ?? null,
    crewId: roh.crewId ?? roh.crew_id ?? null,
    merkmale: merkmaleLesen(roh.merkmale),
    lat: zahl(roh.lat),
    lon: zahl(roh.lon),
    land: roh.land ? String(roh.land) : null,
  };
}

export function signalGewicht(signal) {
  // Skala 0 · 50 · 100 (K.bewertungSkala, dieselbe wie im Crew Score): über „mittel“ positiv, darunter negativ.
  if (signal.art === 'bewertung') return K.signale.bewertung * Math.sign((signal.wert ?? K.bewertungSkala.mittel) - K.bewertungSkala.mittel);
  return K.signale[signal.art] ?? 0;
}

function interessenSchluessel(interessen) {
  return [...new Set((Array.isArray(interessen) ? interessen : [])
    .map((w) => String((typeof w === 'string' ? w : w?.name) ?? '').trim().toLowerCase()
      .replace(/&/g, ' ').replace(/\s+/g, ' ').trim())
    .filter((w) => K.interessenGruppen[w]))];
}

// Wischkarten- und Onboarding-Signale werden zu Aktivitäts-Signalen mit dem Muster der Karte.
function signaleAufloesen(signale, interessen) {
  const out = [];
  for (const gruppe of interessenSchluessel(interessen)) {
    const g = K.interessenGruppen[gruppe];
    out.push({ art: 'karte', eintragTyp: 'karte', eintragId: `interesse:${gruppe}`, aktivitaet: `gruppe:${gruppe}`, wert: null, zeit: 0, merkmale: g.muster, quelle: { karte: g.label } });
  }
  for (const s of signale) {
    if (s.eintragTyp === 'karte' && (s.art === 'wisch_ja' || s.art === 'wisch_nein' || s.art === 'karte')) {
      const karte = K.karten.find((k) => k.id === s.eintragId);
      if (!karte) continue;
      out.push({ ...s, aktivitaet: `karte:${karte.id}`, merkmale: karte.muster, quelle: s.art === 'wisch_ja' ? { wisch: karte.label } : (s.art === 'karte' ? { karte: karte.label } : {}) });
      continue;
    }
    out.push(s);
  }
  return out;
}

// → profil { merkmale[12], roh:{akt:Summe}, staerke:{akt:Σ|Gewicht|}, quellen:{akt:{…}}, besuche, vorgeschlagen,
//            positiv, meetOrte, signaleAnzahl }
export function profilAusSignalen(signaleRoh = [], { jetzt = Date.now(), interessen = [] } = {}) {
  const gelesen = (Array.isArray(signaleRoh) ? signaleRoh : []).map(signalLesen).filter(Boolean).sort((a, b) => a.zeit - b.zeit);
  // „vergessen" (ZUSATZ §6): alles davor zählt für diese Aktivität (bzw. '*' = alles) nicht mehr.
  const vergessen = new Map();
  for (const s of gelesen) {
    if (s.art !== 'vergessen') continue;
    const was = s.aktivitaet || s.eintragId || '*';
    vergessen.set(was, Math.max(vergessen.get(was) ?? 0, s.zeit || jetzt));
  }
  const vergessenBis = (akt) => {
    let bis = vergessen.get('*') ?? -Infinity;
    // „Klettern“ (klettern·*) vergessen löscht alle Kletter-Stile; „Klettern · Fels“ nur diesen Stil.
    for (const [was, zeit] of vergessen) if (was !== '*' && musterPasst(was, akt)) bis = Math.max(bis, zeit);
    return bis;
  };

  const roh = {};
  const staerke = {};
  const quellen = {};
  const besuche = {};
  const vorgeschlagen = {};
  const positiv = {};
  const abgelehnt = {};
  const zuletzt = {};
  const meetOrte = [];
  let mSumme = [...NEUTRAL];
  let mGewicht = 1;               // neutrale Mitte zählt wie ein Signal: ohne Daten bleibt das Profil 0,5
  const negSumme = Array(12).fill(0);
  let negGewicht = 0;
  let anzahl = 0;

  // Wie viel eigenes Verhalten gibt es schon? Danach richtet sich, wie stark der Onboarding-Start zählt.
  const eigene = gelesen.filter((s) => s.eintragTyp !== 'karte' && s.aktivitaet && signalGewicht(s) !== 0).length;
  const S = K.start;
  const startFaktor = eigene <= S.vollBis ? 1 : Math.max(S.rest, 1 - ((1 - S.rest) * (eigene - S.vollBis)) / (S.ausBei - S.vollBis));
  for (const s of signaleAufloesen(gelesen.filter((x) => x.art !== 'vergessen'), interessen)) {
    // Frische und Heimat brauchen auch Signale ohne Gewicht (vorgeschlagen) bzw. ohne Aktivität.
    if (s.art === 'vorgeschlagen' && s.eintragId) vorgeschlagen[s.eintragId] = Math.max(vorgeschlagen[s.eintragId] ?? 0, s.zeit);
    if (s.art === 'meet_stattgefunden' && s.eintragId) {
      (besuche[s.eintragId] = besuche[s.eintragId] || []).push(s.zeit);
      if (s.lat !== null && s.lon !== null) meetOrte.push({ lat: s.lat, lon: s.lon, land: s.land, zeit: s.zeit });
    }
    const gewicht = signalGewicht(s);
    if (gewicht > 0 && s.eintragId) positiv[s.eintragId] = Math.max(positiv[s.eintragId] ?? 0, s.zeit);
    if (s.art === 'weniger' && s.eintragId && s.eintragTyp !== 'karte') abgelehnt[s.eintragId] = s.zeit;
    if (!gewicht || !s.aktivitaet) continue;
    const vergessenAm = vergessenBis(s.aktivitaet);
    if (vergessenAm > -Infinity && s.zeit <= vergessenAm) continue;
    const z = zerfall(s.zeit, jetzt, s.aktivitaet) * (s.aktivitaet.startsWith('gruppe:') ? startFaktor : 1);
    const w = gewicht * z;
    roh[s.aktivitaet] = (roh[s.aktivitaet] ?? 0) + w;
    zuletzt[s.aktivitaet] = Math.max(zuletzt[s.aktivitaet] ?? -Infinity, s.zeit);
    staerke[s.aktivitaet] = (staerke[s.aktivitaet] ?? 0) + Math.abs(w);
    const q = (quellen[s.aktivitaet] = quellen[s.aktivitaet] || { meet: 0, zugesagt: 0, merken: 0, wisch: [], karte: [], weniger: 0 });
    if (s.art === 'meet_stattgefunden') q.meet += 1;
    if (s.art === 'zugesagt') q.zugesagt += 1;
    if (s.art === 'merken' || s.art === 'teilen') q.merken += 1;
    if (s.art === 'weniger') q.weniger += 1;
    if (s.quelle?.wisch && !q.wisch.includes(s.quelle.wisch)) q.wisch.push(s.quelle.wisch);
    if (s.quelle?.karte && !q.karte.includes(s.quelle.karte)) q.karte.push(s.quelle.karte);
    if (s.art !== 'karte') anzahl += 1;
    if (s.merkmale) {
      if (w > 0) { for (let i = 0; i < 12; i += 1) mSumme[i] += w * s.merkmale[i]; mGewicht += w; }
      else { for (let i = 0; i < 12; i += 1) negSumme[i] += -w * s.merkmale[i]; negGewicht += -w; }
    }
  }
  const merkmale = mSumme.map((v) => v / mGewicht);
  if (negGewicht > 0) {
    // Was jemand ablehnt, schiebt das Profil ein Stück davon weg.
    const anteil = negGewicht / (negGewicht + mGewicht);
    for (let i = 0; i < 12; i += 1) merkmale[i] = begrenzt(merkmale[i] + 0.3 * anteil * (merkmale[i] - negSumme[i] / negGewicht), 0, 1);
  }
  return { merkmale, roh, staerke, quellen, besuche, vorgeschlagen, positiv, abgelehnt, meetOrte, zuletzt, vergessen: [...vergessen], signaleAnzahl: anzahl, cf: {} };
}

// Eigener Wert einer Aktivität (−1 … 1): direkt + Art-Muster + halb aus den anderen Stilen derselben Art.
// Wann wurde diese Aktivität zuletzt „vergessen“? (Für Einheiten: Karten wirken auf eine vergessene
// Aktivität nicht mehr, auch wenn die Karte selbst stehen bleibt.)
function vergessenAm(profil, aktivitaet) {
  let bis = -Infinity;
  for (const [was, zeit] of profil.vergessen || []) if (was === '*' || musterPasst(was, aktivitaet)) bis = Math.max(bis, zeit);
  return bis;
}

function eigenerWert(profil, aktivitaet) {
  if (istEinheit(aktivitaet)) {
    return { wert: Math.tanh((profil.roh[aktivitaet] ?? 0) / K.aktivitaetSkala), staerke: profil.staerke[aktivitaet] ?? 0 };
  }
  const art = artVon(aktivitaet);
  const muster = `${art}·*`;
  const vergessen = vergessenAm(profil, aktivitaet);
  let genau = 0; let breit = 0; let rest = 0;
  let staerke = 0;
  for (const [schluessel, wert] of Object.entries(profil.roh)) {
    const s = profil.staerke[schluessel] ?? 0;
    // Ein Art-Muster ('klettern·*') und eine Karte/Gruppe, die diese Aktivität umfasst, gelten voll;
    // die anderen Stile derselben Art nur zu einem Teil — sonst wäre „die ganze Art“ immer das Stärkste.
    if (schluessel === aktivitaet) { genau += wert; staerke += s; } else if (istEinheit(schluessel)) {
      if (musterPasst(schluessel, aktivitaet) && (profil.zuletzt?.[schluessel] ?? 0) > vergessen) { breit += wert; staerke += s; }
    } else if (schluessel === muster) { breit += wert; staerke += s; } else if (artVon(schluessel) === art) { rest += wert; staerke += K.artUebertrag * s; }
  }
  // Wer zu GENAU dieser Aktivität „Weniger davon“ sagt, meint es: Dann hebt kein breites Interesse
  // („Essen“) und kein anderer Stil sie wieder an (ZUSATZ §6). Das Muster selbst („die ganze Art“)
  // trägt nur, was jemand über die ganze Art gesagt hat (dessen Signale stehen dann in „genau“).
  const summe = aktivitaet === muster ? genau : (genau < 0 ? genau + Math.min(0, breit) : genau + breit + K.artUebertrag * rest);
  return { wert: Math.tanh(summe / K.aktivitaetSkala), staerke };
}

// Wert einer Aktivität mit Schätzung aus ähnlichen Menschen (ZUSATZ §5.3): Je mehr eigene Signale,
// desto weniger zählt die Schätzung; ab cf.eigeneSignaleVoll nur noch das Eigene. Ohne Schätzung
// (kaum Nutzer) zählt das Eigene allein — die 12 Merkmale tragen dann den Rest.
export function aktivitaetsWert(profil, aktivitaet) {
  const eigen = eigenerWert(profil, aktivitaet);
  const schaetzung = profil.cf?.[aktivitaet] ?? profil.cf?.[`${artVon(aktivitaet)}·*`];
  if (schaetzung === undefined || schaetzung === null) return { wert: eigen.wert, eigen: eigen.wert, staerke: eigen.staerke, cf: null };
  const w = Math.min(1, eigen.staerke / K.cf.eigeneSignaleVoll);
  return { wert: w * eigen.wert + (1 - w) * schaetzung.wert, eigen: eigen.wert, staerke: eigen.staerke, cf: schaetzung };
}

// Die eigenen Werte aller Aktivitäten, zu denen es Signale gibt (für CF und Durchschnitt).
export function eigeneWerte(profil) {
  const out = {};
  for (const akt of Object.keys(profil.roh)) out[akt] = eigenerWert(profil, akt).wert;
  return out;
}

// „Wer A und B macht, macht oft auch C" — Nähe zweier Aktivitäten über Menschen (Kosinus der
// positiven Werte). Nur Paare mit mindestens cf.minNutzer verschiedenen Menschen (PLAN, 0055).
// eingabe: [{ werte:{akt:wert} }] → [{ a, b, wert, nutzer }]
export function naeheBerechnen(profile, { minNutzer = K.cf.minNutzer } = {}) {
  const vektoren = profile.map((p) => Object.fromEntries(Object.entries(p.werte || {}).filter(([, w]) => w > 0.1)));
  const schluessel = [...new Set(vektoren.flatMap((v) => Object.keys(v)))].sort();
  const betrag = Object.fromEntries(schluessel.map((k) => [k, Math.sqrt(vektoren.reduce((s, v) => s + (v[k] ?? 0) ** 2, 0))]));
  const out = [];
  for (let i = 0; i < schluessel.length; i += 1) {
    for (let j = i + 1; j < schluessel.length; j += 1) {
      const a = schluessel[i]; const b = schluessel[j];
      let skalar = 0; let beide = 0;
      for (const v of vektoren) if (v[a] && v[b]) { skalar += v[a] * v[b]; beide += 1; }
      if (beide < minNutzer || !betrag[a] || !betrag[b]) continue;
      const wert = skalar / (betrag[a] * betrag[b]);
      out.push({ a, b, wert: Math.round(wert * 1000) / 1000, nutzer: beide });
    }
  }
  return out;
}

// Schätzung je Aktivität aus der Nähe-Tabelle: gewichtetes Mittel der eigenen Werte naher Aktivitäten.
export function cfSchaetzen(profil, naehe = []) {
  const eigen = eigeneWerte(profil);
  const summe = {}; const gewicht = {}; const quelle = {};
  for (const zeile of naehe) {
    for (const [von, nach] of [[zeile.a, zeile.b], [zeile.b, zeile.a]]) {
      const w = eigen[von];
      if (!w || w <= 0) continue;
      summe[nach] = (summe[nach] ?? 0) + zeile.wert * w;
      gewicht[nach] = (gewicht[nach] ?? 0) + zeile.wert;
      if (!quelle[nach] || zeile.wert * w > quelle[nach].beitrag) quelle[nach] = { von, beitrag: zeile.wert * w };
    }
  }
  const cf = {};
  for (const akt of Object.keys(summe)) cf[akt] = { wert: summe[akt] / (gewicht[akt] + 1), von: quelle[akt]?.von || null };
  return cf;
}

// Durchschnitt über alle Profile (ZUSATZ §5.4) — gemischt mit dem Konfig-Standard, solange es kaum
// Nutzer gibt. eingabe: [{ werte:{akt:wert}, merkmale }] → { arten:{art:Ø}, merkmale:[12], nutzer }
export function durchschnittAus(profile = []) {
  const n = profile.length;
  const k = K.cf.durchschnittAbNutzer;
  const arten = {};
  for (const art of Object.keys(K.arten)) {
    let summe = 0;
    for (const p of profile) {
      let artSumme = 0;
      for (const [akt, w] of Object.entries(p.werte || {})) if (artVon(akt) === art) artSumme = Math.max(artSumme, w);
      summe += artSumme;
    }
    const standard = K.durchschnittStandard[art] ?? 0.05;
    arten[art] = n ? (summe + k * standard) / (n + k) : standard;
  }
  // Durchschnittsprofil der Merkmale: bis es echte Menschen gibt, der Mittelwert der 16 Karten —
  // „ein Mensch, der von allem etwas mag“. Nicht 0,5: Kaum etwas ist Kultur oder Wettkampf, das
  // Besondere liegt im Abstand zu diesem Mittel.
  const merkmale = KARTEN_MITTEL.map((standard, i) => {
    const summe = profile.reduce((s, p) => s + (p.merkmale?.[i] ?? standard), 0);
    return (summe + k * standard) / (n + k);
  });
  return { arten, merkmale, nutzer: n };
}

const KARTEN_MITTEL = Object.freeze(NEUTRAL.map((_, i) => K.karten.reduce((s, karte) => s + karte.muster[i], 0) / K.karten.length));
const STANDARD = durchschnittAus([]);

export function durchschnittStandard() {
  return STANDARD;
}

// =====================================================================================================
// Heimat, Besuch (ZUSATZ §5.6) — nur aus eigenen Meet-Orten, nie aus einem Standortverlauf
// =====================================================================================================
export function heimatBestimmen(meetOrte = [], { jetzt = Date.now(), heimatort = null } = {}) {
  const seit = jetzt - K.heimat.monate * 30.44 * TAG_MS;
  const orte = meetOrte.filter((o) => o && zahl(o.lat) !== null && zahl(o.lon) !== null && (zeitMs(o.zeit) ?? 0) >= seit);
  let beste = null;
  for (const o of orte) {
    const nah = orte.filter((p) => entfernungKm(o, p) <= K.heimat.gegendKm);
    if (!beste || nah.length > beste.length) beste = nah;
  }
  if (beste && beste.length >= K.heimat.minMeetOrte) {
    const lat = beste.reduce((s, o) => s + Number(o.lat), 0) / beste.length;
    const lon = beste.reduce((s, o) => s + Number(o.lon), 0) / beste.length;
    // Land der Gegend = das der meisten Meet-Orte (Grenzgegenden: Hörbranz/Lindau, Basel …).
    const zaehler = {};
    beste.forEach((o) => { if (o.land) zaehler[o.land] = (zaehler[o.land] || 0) + 1; });
    const land = Object.entries(zaehler).sort((a, b) => b[1] - a[1])[0]?.[0] || null;
    return { lat, lon, land, quelle: 'meets' };
  }
  if (heimatort && zahl(heimatort.lat) !== null && zahl(heimatort.lon) !== null) {
    return { lat: Number(heimatort.lat), lon: Number(heimatort.lon), land: heimatort.land || null, quelle: 'profil' };
  }
  return null;
}

// → 'einheimisch' | 'besuch' | null (unbekannt). Gruppe: Mehrheit der Bekannten.
export function besuchStatus(heimaten = [], ursprung, ursprungLand = null) {
  let besuch = 0; let heimisch = 0;
  for (const h of heimaten) {
    if (!h) continue;
    const km = entfernungKm(h, ursprung);
    // „In einem anderen Land" zählt erst außerhalb der eigenen Gegend: Wer in Hörbranz lebt, ist in
    // Lindau nicht zu Besuch, nur weil dazwischen eine Grenze liegt.
    const anderesLand = Boolean(h.land && ursprungLand && h.land !== ursprungLand) && (km === null || km > K.heimat.gegendKm);
    if (anderesLand || (km !== null && km > K.heimat.besuchAbKm)) besuch += 1; else heimisch += 1;
  }
  if (!besuch && !heimisch) return null;
  if (besuch === heimisch) return null;
  return besuch > heimisch ? 'besuch' : 'einheimisch';
}

// =====================================================================================================
// Kandidaten lesen (Datenbank-Zeile aus crew_auswahl_kandidaten ODER Seed im Gerät)
// =====================================================================================================
export function kandidatLesen(roh) {
  if (!roh || typeof roh !== 'object') return null;
  const eintragTyp = String(roh.eintragTyp ?? roh.eintrag_typ ?? 'ort');
  const id = String(roh.id ?? roh.eintrag_id ?? '');
  const name = String(roh.name ?? roh.titel ?? '').trim();
  const crewArt = String(roh.crewArt ?? roh.art ?? (eintragTyp === 'idee' ? 'idee' : '')).trim();
  if (!id || !name || !crewArt) return null;
  const stil = roh.stil ? String(roh.stil) : null;
  const score = zahl(roh.crewScore ?? roh.crew_score ?? roh.score);
  return {
    id, eintragTyp, name, crewArt, stil,
    aktivitaet: roh.aktivitaet ? String(roh.aktivitaet) : aktivitaetVon(crewArt, stil),
    lat: zahl(roh.lat), lon: zahl(roh.lon),
    adresse: roh.adresse ? String(roh.adresse) : '',
    land: roh.land ? String(roh.land) : null,
    merkmale: merkmaleLesen(roh.merkmale),
    touristenWert: zahl(roh.touristenWert ?? roh.touristen_wert),
    minAlter: zahl(roh.minAlter ?? roh.min_alter),
    oeffnungszeiten: roh.oeffnungszeiten ?? roh.oeffnungszeiten_osm ?? null,
    oeffnungszeitenUnternehmen: roh.oeffnungszeitenUnternehmen ?? roh.oeffnungszeiten_unternehmen ?? null,
    beginn: zeitMs(roh.beginn), ende: zeitMs(roh.ende),
    ortId: roh.ortId ?? roh.ort_id ?? null,
    crewScore: score,
    // Küche (Abstandsregel) und Treffpunkt-Eignung (Vorauswahl, 0067). Ohne Angabe: keine Küche, Treffpunkt 1.
    kueche: roh.kueche ? String(roh.kueche) : null,
    treffpunkt: zahl(roh.treffpunkt) ?? 1,
    neu: roh.neu === true || roh.scoreNeu === true,
    // Warum „Neu“ (Paket B, scores.neu_grund): osm_jung | wenig_daten | zu_wenig_vergleich — B ist die Quelle.
    neuGrund: typeof (roh.neuGrund ?? roh.neu_grund) === 'string' && (roh.neuGrund ?? roh.neu_grund) ? String(roh.neuGrund ?? roh.neu_grund) : null,
    freigegeben: eintragTyp === 'idee' ? true : roh.freigegeben === true,
    geschlossen: roh.geschlossen === true,
    gruende: Array.isArray(roh.gruende) ? roh.gruende : (Array.isArray(roh.scoreGruende) ? roh.scoreGruende : []),
    personenMin: zahl(roh.personenMin ?? roh.personen_min),
    personenMax: zahl(roh.personenMax ?? roh.personen_max),
    jahreszeiten: Array.isArray(roh.jahreszeiten) ? roh.jahreszeiten : null,
    wetterAbhaengig: roh.wetterAbhaengig === true || roh.wetter_abhaengig === true,
    draussen: zahl(roh.draussen),
    bild: roh.bild || roh.bild_url || null,
    bildUrheber: roh.bildUrheber || roh.bild_urheber || '',
    bildSeite: roh.bildSeite || roh.bild_seite || '',
    beschreibung: roh.beschreibung || '',
    entfernungKm: zahl(roh.entfernungKm ?? roh.entfernung_km),
    tags: Array.isArray(roh.tags) ? roh.tags.map(String) : [],
  };
}

// Freigegeben (ALGORITHMUS §1): Score ≥ 70 ohne K.o. oder „Neu"; private Ideen immer.
// Die Datenbank liefert nur Freigegebenes — hier wird es trotzdem noch einmal geprüft.
export function istFreigegeben(k) {
  if (!k || k.geschlossen) return false;
  if (k.eintragTyp === 'idee') return true;
  if (k.freigegeben !== true) return false;
  if (k.neu) return true;
  return k.crewScore !== null && k.crewScore >= K.rang.scoreGrenze;
}

// =====================================================================================================
// 2. Machbarkeit (ALGORITHMUS §3.3, ohne Alters-Dämpfer)
// =====================================================================================================
// Wetter: { stunden:[{ zeit, code, mm, regen, temp }] } (Open-Meteo stündlich) → Stunde am Zeitpunkt.
export function wetterBei(wetter, ms) {
  const stunden = Array.isArray(wetter?.stunden) ? wetter.stunden : [];
  let beste = null;
  for (const s of stunden) {
    const z = zeitMs(s.zeit);
    if (z === null) continue;
    const abstand = Math.abs(z - ms);
    if (abstand <= 1.5 * STUNDE_MS && (!beste || abstand < beste.abstand)) beste = { ...s, abstand };
  }
  return beste;
}

function draussenWert(k) {
  if (k.merkmale) return k.merkmale[K.merkmalDraussen];
  if (k.draussen !== null) return k.draussen;
  return null;
}

function jahreszeitVon(ms, lat) {
  const monat = new Date(ms).getUTCMonth() + 1;
  const m = (zahl(lat) ?? 45) < 0 ? ((monat + 5) % 12) + 1 : monat;
  if (m >= 3 && m <= 5) return 'fruehling';
  if (m >= 6 && m <= 8) return 'sommer';
  if (m >= 9 && m <= 11) return 'herbst';
  return 'winter';
}

// Zeitpunkte, an denen ein ganzer Tag geprüft wird (bei „an diesem Tag").
const TAG_PROBEN_STUNDEN = [10, 13, 16, 19, 21, 23];

function tagesProben(ms, zeitzone) {
  const o = ortszeit(ms, zeitzone);
  const mitternacht = ms - o.minuten * 60000;
  return TAG_PROBEN_STUNDEN.map((h) => mitternacht + h * STUNDE_MS);
}

export function machbarkeit(k, ctx) {
  const t = ctx.zeitpunkt;
  const nein = (grund) => ({ machbar: false, grund });
  if (!istFreigegeben(k)) return nein('nicht-freigegeben');
  if (k.eintragTyp !== 'idee' && ctx.radiusKm != null && (k.entfernungKm === null || k.entfernungKm > ctx.radiusKm)) return nein('radius');
  if (ctx.arten?.length && !ctx.arten.includes(k.crewArt)) return nein('art-filter');
  const absicht = ctx.absicht && K.absichten[ctx.absicht];
  if (absicht?.arten && !absicht.arten.includes(k.crewArt)) return nein('absicht');
  if (!inSaison(k.aktivitaet, t, k.lat ?? ctx.ursprung?.lat)) return nein('saison');
  if (k.eintragTyp === 'idee' && k.jahreszeiten?.length && !k.jahreszeiten.includes(jahreszeitVon(t, ctx.ursprung?.lat))) return nein('saison');

  // Gesetzliches Alter (nie eine Pauschale): Mindestalter des Eintrags; unter 16 nichts mit Alkohol-Schwerpunkt.
  for (const m of ctx.mitglieder || []) {
    const alter = zahl(m.alter);
    if (alter === null) continue;
    if (k.minAlter !== null && alter < k.minAlter) return nein('alter');
    if (alter < K.machbarkeit.alkoholAbAlter && k.merkmale && k.merkmale[K.merkmalAlkohol] >= K.machbarkeit.alkoholMerkmalAb) return nein('alter');
  }
  // Gruppengröße nur bei einer echten Gruppe — wer allein sucht, plant für sich und noch offene Freunde.
  const groesse = (ctx.mitglieder || []).length;
  if (groesse > 1 && (k.personenMin !== null && groesse < k.personenMin) || (k.personenMax !== null && groesse > k.personenMax)) return nein('gruppengroesse');

  // Event-Fenster: [t − 30 min, t + 6 h] bzw. der gewählte Tag; ein laufendes Event zählt auch.
  if (k.eintragTyp === 'event') {
    if (k.beginn === null) return nein('event-ohne-zeit');
    const laeuft = k.beginn <= t && (k.ende ?? k.beginn) >= t;
    if (ctx.ganzerTag) {
      const tag = ortszeit(t, ctx.zeitzone).datum;
      const endeTag = ortszeit(k.ende ?? k.beginn, ctx.zeitzone).datum;
      if (!(ortszeit(k.beginn, ctx.zeitzone).datum <= tag && endeTag >= tag)) return nein('event-fenster');
    } else if (!laeuft && (k.beginn < t - K.machbarkeit.eventVorMin * 60000 || k.beginn > t + K.machbarkeit.eventNachStd * STUNDE_MS)) {
      return nein('event-fenster');
    }
  }

  // Öffnungszeiten (nur Orte): Unternehmens-Zeiten haben Vorrang; unbekannt ist nicht geschlossen.
  let oeffnungsFaktor = 1;
  let oeffnung = null;
  if (k.eintragTyp === 'ort') {
    const text = k.oeffnungszeitenUnternehmen || k.oeffnungszeiten;
    const optionen = { feiertage: ctx.feiertage || [], zeitzone: ctx.zeitzone };
    if (!text) {
      oeffnungsFaktor = K.oeffnungUnbekanntFaktor;
      oeffnung = baustein(K.texte.oeffnungUnbekannt);
    } else if (ctx.ganzerTag) {
      const status = tagesProben(t, ctx.zeitzone).map((p) => oeffnungsStatus(text, p, optionen));
      if (status.every((s) => s.status === 'geschlossen')) return nein('geschlossen');
      if (!status.some((s) => s.status === 'offen')) { oeffnungsFaktor = K.oeffnungUnbekanntFaktor; oeffnung = baustein(K.texte.oeffnungUnbekannt); }
    } else {
      const s = oeffnungsStatus(text, t, optionen);
      if (s.status === 'geschlossen') {
        if (s.oeffnetInMin != null && s.oeffnetInMin <= K.machbarkeit.oeffnetBaldMin) oeffnung = baustein(K.texte.oeffnetUm, { uhr: s.oeffnetUm });
        else return nein('geschlossen');
      } else if (s.status === 'unbekannt') {
        oeffnungsFaktor = K.oeffnungUnbekanntFaktor;
        oeffnung = baustein(K.texte.oeffnungUnbekannt);
      } else {
        oeffnung = s.schliesstUm ? baustein(K.texte.offenBis, { uhr: s.schliesstUm }) : baustein(K.texte.offenesEnde);
      }
    }
  }

  // Wetter: Unwetter + draußen ≥ 0,8 → raus; sonst Faktor und Hinweis.
  let wetterFaktor = 1;
  let wetterText = null;
  const draussen = draussenWert(k);
  const w = ctx.ganzerTag ? null : wetterBei(ctx.wetter, t);
  const wTag = ctx.ganzerTag ? (ctx.wetter?.stunden || []).filter((s) => { const z = zeitMs(s.zeit); return z !== null && tagesProben(t, ctx.zeitzone).some((p) => Math.abs(p - z) <= STUNDE_MS); }) : [];
  const proben = w ? [w] : wTag;
  if (proben.length && draussen !== null) {
    const W = K.wetter;
    const unwetter = proben.filter((p) => W.unwetterCodes.includes(zahl(p.code)) || (zahl(p.mm) ?? 0) >= W.starkregenMmStunde);
    const zuDraussen = k.eintragTyp === 'idee' ? (k.wetterAbhaengig && draussen >= W.draussenAb) : draussen >= W.draussenAb;
    if (zuDraussen && unwetter.length === proben.length) return nein('unwetter');
    const regen = proben.some((p) => W.regenCodes.includes(zahl(p.code)) || (zahl(p.regen) ?? 0) >= W.regenWahrscheinlichAb) || unwetter.length > 0;
    const sonnig = proben.every((p) => W.sonnigCodes.includes(zahl(p.code))) && Math.max(...proben.map((p) => zahl(p.temp) ?? -99)) >= W.sonnigAbGrad;
    if (regen && draussen >= W.draussenWetterAb) { wetterFaktor = W.regenDraussen; wetterText = baustein(K.texte.regen); }
    else if (regen && draussen <= W.drinnenBis) { wetterFaktor = W.regenDrinnen; wetterText = baustein(K.texte.regenDrinnen); }
    else if (sonnig && draussen >= W.draussenWetterAb) {
      wetterFaktor = W.sonnigDraussen;
      wetterText = baustein(K.texte.sonnig, { grad: Math.round(Math.max(...proben.map((p) => zahl(p.temp) ?? -99))) });
    }
  }
  return { machbar: true, oeffnungsFaktor, oeffnung, oeffnungsHinweis: textAus(oeffnung), wetterFaktor, wetter: wetterText, wetterHinweis: textAus(wetterText) };
}

// Zusammenhang (ZUSATZ §5.5): Tageszeit, Wochentag, Jahreszeit — je Art aus der Konfig.
export function zusammenhangFaktor(k, ctx) {
  let faktor = 1;
  if (k.eintragTyp === 'event') return 1; // der Termin sagt schon, wann
  const o = ortszeit(ctx.zeitpunkt, ctx.zeitzone);
  if (!ctx.ganzerTag) {
    const stunde = Math.floor(o.minuten / 60);
    const fenster = K.tageszeiten.findIndex(([von, bis]) => (von < bis ? stunde >= von && stunde < bis : stunde >= von || stunde < bis));
    const tabelle = K.tageszeitFaktor[k.crewArt];
    if (tabelle && fenster >= 0) faktor *= tabelle[fenster];
    const woche = K.wochentagFaktor[k.crewArt];
    if (woche) {
      // Freitag- und Samstagabend (bis in die Nacht) gelten als Wochenende.
      const wochenende = o.wochentag === 5 || o.wochentag === 6 || (o.wochentag === 0 && stunde < 6);
      faktor *= wochenende ? woche.wochenende : woche.werktag;
    }
  }
  const monat = o.monat;
  const draussen = draussenWert(k);
  if (K.winterMonate.includes(monat) && draussen !== null && draussen >= K.winterDraussenAb && k.crewArt !== 'wintersport') faktor *= K.winterDraussenFaktor;
  return faktor;
}

// =====================================================================================================
// 3. Passung (ZUSATZ §5.4, ALGORITHMUS §3.4)
// =====================================================================================================
function logistisch(x) {
  return 1 / (1 + Math.exp(-x));
}

// Einzel-Passung 0–1 aus beiden Ebenen, gemessen als „wie viel mehr als der Durchschnitt".
export function einzelPassung(profil, k, durchschnitt = durchschnittStandard()) {
  const a = aktivitaetsWert(profil, k.aktivitaet);
  const schnitt = durchschnitt.arten?.[k.crewArt] ?? K.durchschnittStandard[k.crewArt] ?? 0.05;
  const sim = aehnlichkeit(profil.merkmale, k.merkmale);
  const simSchnitt = aehnlichkeit(durchschnitt.merkmale || NEUTRAL, k.merkmale);
  const merkmalLift = sim === null || simSchnitt === null ? 0 : sim - simSchnitt;
  const lift = a.wert - schnitt;
  const x = K.passung.gewichtAktivitaet * lift + K.passung.gewichtMerkmale * merkmalLift;
  return { passung: logistisch(x), wert: a.wert, eigen: a.eigen, staerke: a.staerke, cf: a.cf, lift, merkmalLift };
}

export function gruppenPassung(profile, k, { durchschnitt = durchschnittStandard(), crewProfil = null, absicht = null } = {}) {
  const einzel = profile.map((p) => einzelPassung(p, k, durchschnitt));
  const werte = einzel.map((e) => e.passung);
  const min = Math.min(...werte);
  const mittel = werte.reduce((s, w) => s + w, 0) / werte.length;
  let passung = werte.length > 1 ? K.passung.gruppeMin * min + K.passung.gruppeMittel * mittel : werte[0];
  let crew = 0;
  if (crewProfil) {
    crew = aktivitaetsWert(crewProfil, k.aktivitaet).wert;
    if (crew > 0) passung += K.passung.crewGewicht * crew * (1 - passung);
  }
  const muster = absicht && K.absichten[absicht]?.muster;
  if (muster && k.merkmale) passung = (1 - K.passung.absichtGewicht) * passung + K.passung.absichtGewicht * aehnlichkeit(muster, k.merkmale);
  return { passung, einzel, min, crew };
}

// =====================================================================================================
// 4. Rang (Feinschliff 01.10.2026, ersetzt ALGORITHMUS §3.6; ZUSATZ §5.6)
// =====================================================================================================
export function qVon(k) {
  if (k.eintragTyp === 'idee') return K.rang.qIdee;
  if (k.neu) return K.rang.qNeu;
  return 0.5 + (0.5 * (begrenzt(k.crewScore ?? K.rang.scoreGrenze, K.rang.scoreGrenze, 100) - K.rang.scoreGrenze)) / (100 - K.rang.scoreGrenze);
}

// Entfernung zählt nur leicht: Preis = 1 / (1 + d / (h × d0)), h = distanz.halbBeiKomfort. Mit h = 6 kostet die
// doppelte Wohlfühl-Entfernung ein Viertel, erst die sechsfache die Hälfte (vorher: dreifach −84 %).
export function distanzPreis(km, d0) {
  if (km === null || km === undefined) return 1;
  return 1 / (1 + km / (K.distanz.halbBeiKomfort * d0));
}

// Die Passung geht gedämpft in den Rang (Exponent < 1), damit die Zahl aus Algorithmus 1 am stärksten zählt;
// WIE VIEL Platz ein Interesse bekommt, regelt die Vielfalt (Anteil nach Stärke), nicht dieser Faktor.
export function passungImRang(passung) {
  return Math.max(0, passung) ** K.passung.rangExponent;
}

export function frischeFaktor(k, profile, jetzt) {
  // „Weniger davon“ genau an diesem Eintrag: nicht wieder vorschlagen (auch kein Event).
  if (profile.some((p) => p.abgelehnt?.[k.id])) return 0;
  if (k.eintragTyp === 'event') return 1;
  const F = K.frische;
  let faktor = 1;
  const vorgeschlagen = Math.max(...profile.map((p) => p.vorgeschlagen?.[k.id] ?? 0));
  const genommen = Math.max(...profile.map((p) => p.positiv?.[k.id] ?? 0));
  if (vorgeschlagen && jetzt - vorgeschlagen <= F.vorgeschlagenTage * TAG_MS && jetzt - vorgeschlagen >= F.vorgeschlagenMinStd * STUNDE_MS && genommen < vorgeschlagen) {
    faktor *= F.vorgeschlagenFaktor;
  }
  const besuche = profile.flatMap((p) => p.besuche?.[k.id] || []);
  if (besuche.some((z) => jetzt - z <= F.besuchtTage * TAG_MS)) faktor *= besuche.length >= F.lieblingsBesuche ? F.lieblingsFaktor : F.besuchtFaktor;
  return faktor;
}

export function touristenFaktor(k, status, eventAmOrt = false) {
  if (!status || k.touristenWert === null || k.touristenWert < K.heimat.touristenAb) return 1;
  if (status === 'besuch') return K.heimat.faktorBesuch;
  return eventAmOrt ? 1 : K.heimat.faktorEinheimisch;
}

// =====================================================================================================
// Texte: Passung (nie eine Zahl, §2.11) und „Warum sehe ich das?" (ZUSATZ §6)
// =====================================================================================================
function mittelMerkmale(profile) {
  return NEUTRAL.map((_, i) => profile.reduce((s, p) => s + p.merkmale[i], 0) / profile.length);
}

// Die Merkmale, in denen Profil UND Eintrag auf derselben Seite deutlich vom Durchschnitt abweichen —
// das, was diese Person ausmacht und was der Eintrag bietet („ruhig, draußen"). Relativ zum
// Durchschnittsprofil, nicht zur Mitte der Skala: Dass kaum jemand Kultur „braucht", ist nichts Besonderes.
function passendeMerkmale(profilMerkmale, eintragMerkmale, schnitt, anzahl = 2) {
  if (!eintragMerkmale) return [];
  const klar = K.passung.textKlarheit;
  return profilMerkmale
    .map((p, i) => ({ i, dp: p - schnitt[i], de: eintragMerkmale[i] - schnitt[i] }))
    .filter(({ dp, de }) => Math.abs(dp) >= klar && Math.sign(dp) === Math.sign(de) && Math.abs(de) >= klar)
    .sort((a, b) => Math.min(Math.abs(b.dp), Math.abs(b.de)) - Math.min(Math.abs(a.dp), Math.abs(a.de)))
    .slice(0, anzahl)
    .map(({ i, dp }) => (dp < 0 ? K.merkmale[i].links : K.merkmale[i].rechts));
}

// Woher das Wissen über diese Aktivität stammt: Meets zählen je Art („Du warst oft klettern"),
// Merken/Wischen/Karten nur, wenn sie genau diese Aktivität (oder ihre Art als Ganzes) meinen.
function quellenFuer(profil, k) {
  const summe = { meet: 0, zugesagt: 0, merken: 0, wisch: [], karte: [], weniger: 0 };
  for (const [akt, q] of Object.entries(profil?.quellen || {})) {
    if (istEinheit(akt) ? !musterPasst(akt, k.aktivitaet) : artVon(akt) !== k.crewArt) continue;
    summe.meet += q.meet; summe.zugesagt += q.zugesagt;
    if (!musterPasst(akt, k.aktivitaet)) continue;
    summe.merken += q.merken; summe.weniger += q.weniger;
    q.wisch.forEach((w) => { if (!summe.wisch.includes(w)) summe.wisch.push(w); });
    q.karte.forEach((w) => { if (!summe.karte.includes(w)) summe.karte.push(w); });
  }
  return summe;
}

// „Passt zu dir: ruhig, draußen" — nie eine Zahl (§2.11). → Baustein (siehe baustein()).
export function passungBaustein(profile, k, { gruppe = false, crewProfil = null, durchschnitt = durchschnittStandard() } = {}) {
  const worte = passendeMerkmale(mittelMerkmale(profile), k.merkmale, durchschnitt.merkmale);
  const meets = crewProfil ? quellenFuer(crewProfil, k).meet : (!gruppe ? quellenFuer(profile[0], k).meet : 0);
  const liste = worte.length ? [...worte] : [artLabel(k.crewArt)];
  if (meets >= 2) liste.push(gruppe ? K.texte.wieLetzteMeets : K.texte.wieDeineMeets);
  return baustein(gruppe ? K.texte.passtEuch : K.texte.passtDir, { liste: { liste } });
}

export function passungText(profile, k, optionen) {
  return textAus(passungBaustein(profile, k, optionen));
}

// Ein Satz (ZUSATZ §6). In einer Gruppe nie etwas über einzelne Mitglieder — nur über die Crew.
export function warumBaustein(profile, k, { gruppe = false, crewProfil = null, status = null, absicht = null, malWasAnderes = false, durchschnitt = durchschnittStandard() } = {}) {
  const T = K.texte;
  const worte = passendeMerkmale(mittelMerkmale(profile), k.merkmale, durchschnitt.merkmale).map((w) => ({ worte: [w] }));
  // Gruppe: „ihr/euch“ statt „du/dir“.
  const t = (name) => (gruppe && T[`${name}Euch`]) || T[name];
  if (malWasAnderes) {
    if (worte.length >= 2) return baustein(t('warumMalAnders'), { a: worte[0], b: worte[1] });
    if (worte.length === 1) return baustein(t('warumMalAndersEins'), { a: worte[0] });
    return baustein(T.malWasAnderes);
  }
  if (status === 'besuch' && k.touristenWert !== null && k.touristenWert >= K.heimat.touristenAb) return baustein(t('warumBesuch'));
  const artSaetze = K.arten[k.crewArt]?.warum;
  if (crewProfil && artSaetze) {
    const q = quellenFuer(crewProfil, k);
    if (q.meet + q.zugesagt >= 2) return baustein(artSaetze[1]);
  }
  if (!gruppe && artSaetze) {
    const q = quellenFuer(profile[0], k);
    if (q.meet + q.zugesagt >= 2) return baustein(artSaetze[0]);
    if (q.merken >= 1) return baustein(T.warumGemerkt);
    if (q.wisch.length) return baustein(T.warumWisch, { karte: { worte: [q.wisch[0]] } });
    if (q.karte.length) return baustein(T.warumKarte, { karte: { worte: [q.karte[0]] } });
    const a = aktivitaetsWert(profile[0], k.aktivitaet);
    if (a.cf && a.cf.wert > 0.1 && a.cf.von) return baustein(T.warumAehnlich, { a: { worte: aktivitaetWorte(a.cf.von) }, b: { worte: aktivitaetWorte(k.aktivitaet) } });
  }
  if (absicht && K.absichten[absicht]?.muster) return baustein(T.warumAbsicht, { absicht: { worte: [K.absichten[absicht].label] } });
  if (worte.length >= 2) return baustein(t('warumMerkmale'), { a: worte[0], b: worte[1] });
  if (worte.length === 1) return baustein(t('warumMerkmaleEins'), { a: worte[0] });
  return baustein(t('warumAktivitaet'), { aktivitaet: { worte: aktivitaetWorte(k.aktivitaet) } });
}

export function warumSatz(profile, k, optionen) {
  return textAus(warumBaustein(profile, k, optionen));
}

// =====================================================================================================
// Ausgabe je Eintrag (PLAN §1.2 — beide Gateways gleich)
// =====================================================================================================
function anzeigeArt(k) {
  return K.arten[k.crewArt]?.anzeige || (K.eventArten.includes(k.crewArt) ? 'event' : 'erlebnis');
}

// extra: { ring, passung, warum, oeffnung, wetter (Bausteine), malWasAnderes, nichtEmpfohlen }
// Die vier Texte stehen zweimal: fertig auf Deutsch (passungText, warum, oeffnungsHinweis, wetterHinweis)
// und als Baustein in `texte` — daraus macht die App die Fassung in ihrer Sprache.
export function eintragAusgeben(k, extra = {}) {
  const nichtEmpfohlen = extra.nichtEmpfohlen === true;
  const score = nichtEmpfohlen || k.neu || k.eintragTyp === 'idee' ? null : k.crewScore;
  const tags = [...(k.tags || [])];
  if (k.eintragTyp === 'idee' && !tags.includes('zuhause')) tags.push('zuhause');
  const texte = { passung: extra.passung || null, warum: extra.warum || null, oeffnung: extra.oeffnung || null, wetter: extra.wetter || null };
  const aus = {
    id: k.id,
    titel: k.name,
    art: anzeigeArt(k),
    crewArt: k.crewArt,
    stil: k.stil,
    aktivitaet: k.aktivitaet,
    eintragTyp: k.eintragTyp,
    ort: { name: k.name, lat: k.lat, lon: k.lon, ...(k.adresse ? { adresse: k.adresse } : {}) },
    score,
    scoreNeu: !nichtEmpfohlen && k.neu === true,
    // Nur bei „Neu“ — die App zeigt dann B's Satz (konfig-score.js › texte.neu) statt „Noch keine Bewertung“.
    neuGrund: !nichtEmpfohlen && k.neu === true ? k.neuGrund || null : null,
    scoreGruende: nichtEmpfohlen || score === null ? [] : (k.gruende || []).slice(0, 3),
    passungText: textAus(texte.passung),
    warum: textAus(texte.warum),
    ring: extra.ring || null,
    entfernungKm: k.eintragTyp === 'idee' || k.entfernungKm === null ? null : Math.round(k.entfernungKm * 10) / 10,
    malWasAnderes: extra.malWasAnderes === true,
    nichtEmpfohlen,
    oeffnungsHinweis: textAus(texte.oeffnung),
    wetterHinweis: textAus(texte.wetter),
    texte,
    gesponsert: false,
    tags,
  };
  if (k.eintragTyp === 'event' && k.beginn !== null) aus.wann = { von: k.beginn, bis: k.ende ?? k.beginn };
  // Die Beschreibung (private Ideen: Paket D; Orte: vom Unternehmen) — für Detail und Vorschlagskarte.
  if (k.beschreibung) aus.beschreibung = k.beschreibung;
  if (k.bild) { aus.bild = k.bild; aus.bildUrheber = k.bildUrheber || ''; aus.bildSeite = k.bildSeite || ''; }
  return aus;
}

// =====================================================================================================
// 5. „Für dich" (ALGORITHMUS §3.7, ZUSATZ §5.4)
// =====================================================================================================
function median(werte) {
  const s = [...werte].sort((a, b) => a - b);
  if (!s.length) return null;
  const m = Math.floor(s.length / 2);
  return s.length % 2 ? s[m] : (s[m - 1] + s[m]) / 2;
}

/// Stärke eines Interesses — einer Aktivität ('bar·cocktail') oder einer ganzen Art ('klettern·*', aus
// Onboarding-Karten) — für eine Person: wie viel MEHR als der Durchschnitt (nur positiv, ZUSATZ §5.4).
function schnittVon(schluessel, durchschnitt) {
  const arten = istEinheit(schluessel) ? [...new Set(ZUSAMMEN[schluessel].map(artVon))] : [artVon(schluessel)];
  return arten.reduce((s, art) => s + (durchschnitt.arten?.[art] ?? K.durchschnittStandard[art] ?? 0.05), 0) / arten.length;
}

// Für den ANTEIL eines Interesses an der Liste zählt die ungesättigte Stärke (atanh des Werts): zehn
// Restaurant-Abende sind mehr als vier Café-Besuche, auch wenn beide Werte nahe 1 liegen.
const linear = (w) => Math.atanh(begrenzt(w, -0.999, 0.999));
function interessenStaerke(profil, schluessel, durchschnitt) {
  return Math.max(0, linear(aktivitaetsWert(profil, schluessel).wert) - linear(schnittVon(schluessel, durchschnitt)));
}

// Die 3–5 wichtigsten Interessen, auf der Ebene, auf der gelernt wurde (Aktivität), mit Anteil nach
// Stärke. Nur Interessen, zu denen es hier gerade etwas Passendes gibt (pool). Gruppe: wie die Passung
// (0,6 × Minimum + 0,4 × Mittel) — Gemeinsames zuerst; dazu, was die Crew oft macht.
// Deckt ein Interesse diese Aktivität? Eine Karte oder Gruppe deckt nichts, was jemand nach ihr
// ausdrücklich vergessen hat („Klettern vergessen“ → die alte Kletter-Karte trägt kein Klettern mehr).
export function interesseDeckt(profile, schluessel, aktivitaet) {
  if (!musterPasst(schluessel, aktivitaet)) return false;
  if (!istEinheit(schluessel)) return true;
  return profile.every((p) => !(schluessel in p.roh) || (p.zuletzt?.[schluessel] ?? -Infinity) > vergessenAm(p, aktivitaet));
}

export function topInteressen(profile, durchschnitt, { crewProfil = null, pool = [] } = {}) {
  const schluessel = new Set();
  for (const p of [...profile, ...(crewProfil ? [crewProfil] : [])]) {
    Object.keys(p.roh).forEach((k) => schluessel.add(k));
    Object.keys(p.cf || {}).forEach((k) => schluessel.add(k));
  }
  const liste = [];
  for (const key of schluessel) {
    let bester = 0;
    for (const e of pool) if (interesseDeckt(profile, key, e.k.aktivitaet) && e.rang > bester) bester = e.rang;
    if (!bester) continue;
    const einzel = profile.map((p) => interessenStaerke(p, key, durchschnitt));
    let staerke = profile.length > 1
      ? K.passung.gruppeMin * Math.min(...einzel) + K.passung.gruppeMittel * (einzel.reduce((a, b) => a + b, 0) / einzel.length)
      : einzel[0];
    if (crewProfil) staerke += interessenStaerke(crewProfil, key, durchschnitt);
    if (staerke > 0) liste.push({ schluessel: key, staerke, bester });
  }
  liste.sort((a, b) => (b.staerke - a.staerke) || (b.bester - a.bester) || a.schluessel.localeCompare(b.schluessel));
  // Was ein stärkeres Interesse schon abdeckt („Klettern“ deckt „Klettern · Fels“), ist kein eigenes.
  const eindeutig = [];
  // Ein breiteres Interesse, das nach spezifischeren kommt, zählt nur, wenn es hier noch etwas Eigenes abdeckt.
  for (const x of liste) {
    if (eindeutig.some((y) => musterPasst(y.schluessel, x.schluessel))) continue;
    const eigenes = pool.some((e) => interesseDeckt(profile, x.schluessel, e.k.aktivitaet) && !eindeutig.some((y) => interesseDeckt(profile, y.schluessel, e.k.aktivitaet)));
    if (eigenes) eindeutig.push(x);
  }
  if (!eindeutig.length) return [];
  const max = eindeutig[0].staerke;
  const klar = eindeutig.filter((x) => x.staerke >= K.vielfalt.staerkeAnteilMin * max);
  const anzahl = begrenzt(klar.length, Math.min(K.vielfalt.minInteressen, eindeutig.length), K.vielfalt.maxInteressen);
  return eindeutig.slice(0, anzahl);
}

// Abstandsregel (Feinschliff 01.10.2026, ersetzt das Ausdünnen aus §3.7): Gleiche Orte, die nah beieinander
// liegen, ersetzen sich. „Gleich“ = gleiche Art und gleicher Stil — bei Restaurants ist der Stil die Küche: ein
// Italiener ersetzt keinen Chinesen, ein Kino ein Kino, aber eine Hütte keinen Gipfel und eine Langlaufloipe kein
// Skigebiet. „Nah“ = innerhalb des Abdeckungs-Radius der Art: ein Viertel ihres Einzugsradius (Kino 20 km → 5 km,
// Restaurant 8 km → 2 km). Eine Regel für alle Arten; nur der Radius unterscheidet sich (später aus echten Wegen gelernt).
export function abstandSchluessel(k) {
  return `${k.crewArt}·${k.stil || ''}`;
}
export function abdeckungKm(crewArt) {
  const r = K.einzugsradiusKm[crewArt];
  return r ? K.abstand.faktor * r : 0;
}
function ersetzt(a, b) {
  if (abstandSchluessel(a.k) !== abstandSchluessel(b.k)) return false;
  if (a.k.lat === null || b.k.lat === null) return false;
  return entfernungKm(a.k, b.k) <= abdeckungKm(a.k.crewArt);
}

// Vielfalt (abnehmender Nutzen): Wie viel Platz ein Interesse bekommt, richtet sich nach seiner Stärke (Anteil an
// allen Interessen der Person) — jeder weitere Eintrag desselben Interesses zählt 1 / (1 + n / (platzSkala × Anteil)).
// Dazu zählt jeder weitere Ort derselben Art weniger (× gleicheArt) und derselbe Ort noch einmal anderswo (gleiche Art
// und Küche, außerhalb des Abdeckungs-Radius) noch einmal weniger (× gleicheSorte): ein zweiter Italiener muss deutlich
// besser sein als ein erster Grieche, ein zweites Kino deutlich besser als ein erstes Restaurant.
function vielfaltFaktor({ interesse, art, sorte }, anteil) {
  const V = K.vielfalt;
  return (1 / (1 + interesse / (V.platzSkala * Math.max(anteil, 1e-6)))) * V.gleicheArt ** art * V.gleicheSorte ** sorte;
}

// Eingabe (beide Gateways gleich):
//   kandidaten      Zeilen aus crew_auswahl_kandidaten bzw. Seed (kandidatLesen)
//   mitglieder      [{ signale, interessen, alter?, heimatort?, komfortradiusKm? }] — bei Solo einer
//   crewSignale     Signale mit crew_id dieser Crew (Gruppen-Profil, ZUSATZ §5.5) — optional
//   ursprung        { lat, lon, land? }; radiusKm; zeitpunkt (ms/ISO); ganzerTag; zeitzone
//   absicht, arten, wetter, feiertage, naehe (aktivitaet_naehe), durchschnitt, jetzt
// → { eintraege (oben, in Rang-Reihenfolge), weitere (darunter), ringe:{ nah, mittel, fern } (Etikett der
//     Einträge oben), leer, interessen:[schlüssel], besuch }
export function fuerDich(eingabe) {
  const jetzt = zeitMs(eingabe.jetzt) ?? Date.now();
  const zeitpunkt = zeitMs(eingabe.zeitpunkt) ?? jetzt;
  const zeitzone = eingabe.zeitzone || 'Europe/Vienna';
  const radiusKm = begrenzt(zahl(eingabe.radiusKm) ?? K.radius.standardKm, 1, K.radius.maxKm);
  const ursprung = eingabe.ursprung || null;
  const durchschnitt = eingabe.durchschnitt || durchschnittStandard();
  const mitglieder = (eingabe.mitglieder?.length ? eingabe.mitglieder : [{}]).map((m) => {
    const profil = m.profil || profilAusSignalen(m.signale || [], { jetzt, interessen: m.interessen || [] });
    if (eingabe.naehe?.length) profil.cf = cfSchaetzen(profil, eingabe.naehe);
    return {
      profil,
      alter: zahl(m.alter),
      heimat: m.heimat !== undefined ? m.heimat : heimatBestimmen(profil.meetOrte, { jetzt, heimatort: m.heimatort }),
      komfort: begrenzt(zahl(m.komfortradiusKm) ?? K.komfortradius.startKm, K.komfortradius.minKm, K.komfortradius.maxKm),
    };
  });
  const profile = mitglieder.map((m) => m.profil);
  const gruppe = mitglieder.length > 1;
  const crewProfil = eingabe.crewSignale?.length ? profilAusSignalen(eingabe.crewSignale, { jetzt }) : null;
  const d0 = median(mitglieder.map((m) => m.komfort));
  const mittelGrenze = Math.max(K.ringe.mittelAnteil * radiusKm, K.ringe.mittelMinFaktor * d0);
  const status = ursprung ? besuchStatus(mitglieder.map((m) => m.heimat), ursprung, ursprung.land || null) : null;
  const ctx = {
    zeitpunkt, ganzerTag: eingabe.ganzerTag === true, zeitzone, radiusKm, ursprung,
    arten: Array.isArray(eingabe.arten) && eingabe.arten.length ? eingabe.arten : null,
    absicht: eingabe.absicht && eingabe.absicht !== 'egal' ? eingabe.absicht : null,
    feiertage: eingabe.feiertage || [], wetter: eingabe.wetter || null,
    mitglieder: mitglieder.map((m) => ({ alter: m.alter })),
  };

  const kandidaten = (eingabe.kandidaten || []).map(kandidatLesen).filter(Boolean);
  for (const k of kandidaten) {
    if (k.entfernungKm === null && ursprung && k.lat !== null) k.entfernungKm = entfernungKm(ursprung, k);
  }
  // 1. Vorauswahl: machbar (offen, im Radius, Altersgrenze, Wetter …), freigegeben (≥ 70 oder „Neu“), ein Treffpunkt.
  const machbar = [];
  for (const k of kandidaten) {
    if (k.treffpunkt < K.treffpunkt.min) continue;
    const m = machbarkeit(k, ctx);
    if (m.machbar) machbar.push({ k, m });
  }
  const eventOrte = new Set(machbar.filter(({ k }) => k.eintragTyp === 'event' && k.ortId).map(({ k }) => String(k.ortId)));

  // 3. Rang: die Zahl aus Algorithmus 1 zählt am stärksten (q), dann die Passung zur Person, die Entfernung nur leicht.
  const bewertet = [];
  for (const { k, m } of machbar) {
    const gp = gruppenPassung(profile, k, { durchschnitt, crewProfil, absicht: ctx.absicht });
    const d = k.eintragTyp === 'idee' ? 0 : k.entfernungKm;
    const ring = k.eintragTyp === 'idee' || d <= d0 ? 'nah' : (d <= mittelGrenze ? 'mittel' : 'fern');
    // Einheimisch/Besuch wirkt „zusätzlich zur Passung“ (ZUSATZ §5.6): Für Einheimische passt ein
    // Touristenziel nur noch zu 30 % — es fällt damit unter die Mindest-Passung. Besucher: × 1,2.
    const tourist = touristenFaktor(k, status, eventOrte.has(k.id));
    const rang = qVon(k) * passungImRang(gp.passung) * distanzPreis(d, d0) * frischeFaktor(k, profile, jetzt)
      * m.oeffnungsFaktor * tourist * zusammenhangFaktor(k, ctx) * m.wetterFaktor;
    bewertet.push({ k, m, gp, ring, rang, d, tourist });
  }

  // Nur, was passt: Gruppe — niemand unter 0,3 (§3.4: „ein Vorschlag, den einer hasst, ruiniert den Abend“).
  const passt = (e) => e.gp.passung * Math.min(1, e.tourist) >= K.passung.fuerDichMin && (!gruppe || e.gp.min >= K.passung.gruppeMinEinzel) && e.rang > 0;
  const pool = bewertet.filter(passt).sort((a, b) => (b.rang - a.rang) || a.k.id.localeCompare(b.k.id));

  // Die 3–5 wichtigsten Interessen, mit Anteil nach Stärke (ZUSATZ §5.4).
  const interessen = topInteressen(profile, durchschnitt, { crewProfil, pool });
  const irgendwasBekannt = [...profile, ...(crewProfil ? [crewProfil] : [])]
    .some((p) => Object.keys(p.roh).some((akt) => aktivitaetsWert(p, akt).wert > 0));
  if (!irgendwasBekannt) {
    // Über diese Person ist noch GAR nichts bekannt (keine Karte, kein Signal): Dann tragen die 12
    // Merkmale und die Qualität allein. Wer Interessen hat, bekommt nie Fremdes nach oben.
    for (const e of pool) {
      if (interessen.length >= K.vielfalt.minInteressen) break;
      if (interessen.some((i) => musterPasst(i.schluessel, e.k.aktivitaet))) continue;
      interessen.push({ schluessel: e.k.aktivitaet, staerke: 1, bester: e.rang });
    }
  }
  const summe = interessen.reduce((s, i) => s + i.staerke, 0) || 1;
  const anteilVon = new Map(interessen.map((i) => [i.schluessel, i.staerke / summe]));
  const interesseVon = (e) => interessen.find((i) => interesseDeckt(profile, i.schluessel, e.k.aktivitaet))?.schluessel ?? null;
  for (const e of pool) { e.interesse = interesseVon(e); e.anteil = e.interesse ? anteilVon.get(e.interesse) : 0; }

  // 4./5. Oben: immer der Eintrag mit dem höchsten Wert = Rang × Vielfalt — außer ein gleicher Ort im
  // Abdeckungs-Radius steht schon oben (Abstandsregel). Oben endet, wenn der nächste Wert unter einen Anteil
  // des besten fällt oder der Platz voll ist. Nichts wird gelöscht: der Rest steht darunter (`weitere`).
  const O = K.oben;
  const oben = [];
  const jeArt = {};
  const jeSorte = {};
  const jeInteresse = {};
  let neu = 0;
  let erster = null;
  const offen = new Set(pool.filter((e) => e.interesse));
  while (oben.length < O.max && offen.size) {
    let bester = null;
    let besterWert = 0;
    for (const e of offen) {
      if (oben.some((x) => ersetzt(x, e))) { offen.delete(e); continue; }
      if (e.k.neu && neu + 1 > Math.floor(K.neuAnteil * O.max)) continue;
      const schon = { interesse: jeInteresse[e.interesse] ?? 0, art: jeArt[e.k.crewArt] ?? 0, sorte: jeSorte[abstandSchluessel(e.k)] ?? 0 };
      const wert = e.rang * vielfaltFaktor(schon, e.anteil);
      if (wert > besterWert || (wert === besterWert && bester && e.k.id < bester.k.id)) { bester = e; besterWert = wert; }
    }
    if (!bester) break;
    if (erster !== null && besterWert < O.mindestAnteil * erster) break;
    if (erster === null) erster = besterWert;
    offen.delete(bester);
    bester.wert = besterWert;
    oben.push(bester);
    jeArt[bester.k.crewArt] = (jeArt[bester.k.crewArt] ?? 0) + 1;
    jeSorte[abstandSchluessel(bester.k)] = (jeSorte[abstandSchluessel(bester.k)] ?? 0) + 1;
    jeInteresse[bester.interesse] = (jeInteresse[bester.interesse] ?? 0) + 1;
    if (bester.k.neu) neu += 1;
  }

  // „Mal was anderes" (ZUSATZ §5.4): höchstens 1 von 10, passt zu den 12 Merkmalen, bei einer Art, die
  // für alle Mitglieder neu ist, mit hohem Crew Score; beschriftet, auf Platz `MWA.platz` der Liste oben.
  const MWA = K.malWasAnderes;
  const drin = new Set(oben.map((e) => e.k.id));
  const artenDrin = new Set(oben.map((e) => e.k.crewArt));
  let mwa = null;
  if ((oben.length + 1) >= MWA.jeEintraege) {
    mwa = bewertet
      .filter((e) => !drin.has(e.k.id) && !artenDrin.has(e.k.crewArt) && !e.k.neu && e.k.eintragTyp !== 'idee'
        && e.k.crewScore !== null && e.k.crewScore >= MWA.minScore && e.k.merkmale && e.rang > 0
        && e.gp.einzel.every((x) => x.eigen <= MWA.eigenerWertBis && x.merkmalLift >= MWA.merkmaleUeber)
        && (!gruppe || e.gp.min >= K.passung.gruppeMinEinzel) && !oben.some((x) => ersetzt(x, e)))
      .map((e) => ({ ...e, mwaRang: Math.min(...e.gp.einzel.map((x) => x.merkmalLift)) * qVon(e.k) * Math.sqrt(distanzPreis(e.d, d0) * e.m.oeffnungsFaktor * zusammenhangFaktor(e.k, ctx)) }))
      .sort((a, b) => (b.mwaRang - a.mwaRang) || a.k.id.localeCompare(b.k.id))[0] || null;
  }
  if (mwa && oben.length >= O.max) oben.pop();
  const liste = [...oben];
  if (mwa) liste.splice(Math.min(MWA.platz - 1, liste.length), 0, { ...mwa, malWasAnderes: true });

  // Darunter: alles Übrige, das passt (von der Abstandsregel verdrängt, von der Vielfalt geschoben, kein Platz mehr) —
  // in derselben Reihenfolge wie oben (Rang × Vielfalt, die Zähler laufen weiter), nur ohne Abstandssperre und ohne
  // Platzgrenze. So steht der zweitbeste Italiener vor der vierzigsten Idee für zuhause.
  const gezeigt = new Set(liste.map((e) => e.k.id));
  const rest = pool.filter((e) => !gezeigt.has(e.k.id));
  const darunter = [];
  while (darunter.length < K.weitere.max && rest.length) {
    let bi = 0;
    let bw = -1;
    rest.forEach((e, i) => {
      const schon = { interesse: jeInteresse[e.interesse] ?? 0, art: jeArt[e.k.crewArt] ?? 0, sorte: jeSorte[abstandSchluessel(e.k)] ?? 0 };
      const w = e.rang * vielfaltFaktor(schon, e.anteil || 0);
      if (w > bw) { bw = w; bi = i; }
    });
    const [e] = rest.splice(bi, 1);
    darunter.push(e);
    jeArt[e.k.crewArt] = (jeArt[e.k.crewArt] ?? 0) + 1;
    jeSorte[abstandSchluessel(e.k)] = (jeSorte[abstandSchluessel(e.k)] ?? 0) + 1;
    jeInteresse[e.interesse] = (jeInteresse[e.interesse] ?? 0) + 1;
  }

  const ausgeben = (e) => eintragAusgeben(e.k, {
    ring: e.ring,
    passung: passungBaustein(profile, e.k, { gruppe, crewProfil, durchschnitt }),
    warum: warumBaustein(profile, e.k, { gruppe, crewProfil, status, absicht: ctx.absicht, malWasAnderes: e.malWasAnderes === true, durchschnitt }),
    malWasAnderes: e.malWasAnderes === true,
    oeffnung: e.m.oeffnung,
    wetter: e.m.wetter,
  });
  const ausgabe = liste.map(ausgeben);
  const ringe = { nah: [], mittel: [], fern: [] };
  for (const a of ausgabe) ringe[a.ring || 'nah'].push(a.id);
  return {
    eintraege: ausgabe,
    weitere: darunter.map(ausgeben),
    ringe,
    leer: ausgabe.length === 0,
    interessen: interessen.map((i) => i.schluessel),
    besuch: status,
  };
}

// =====================================================================================================
// Suche und Kategorien (ZUSATZ §6) — ohne Personen- und Einheimisch-Filter
// =====================================================================================================
// eingabe: { kandidaten, ursprung, crewArt?, radiusKm?, nameTreffer? }
// Kategorien: alles Freigegebene nach Crew Score, dann Entfernung („Neu" nach den Bewerteten).
// Namenssuche (nameTreffer:true): findet jeden importierten Ort; unter 70 bzw. nicht freigegeben ⇒
// nichtEmpfohlen:true, score:null, Hinweis „nicht unter den Empfehlungen".
// Text vergleichen wie die Datenbank (lower + unaccent): klein, ohne Umlaute und Akzente.
export function suchText(text) {
  return String(text ?? '').toLowerCase()
    .replace(/ä/g, 'ae').replace(/ö/g, 'oe').replace(/ü/g, 'ue').replace(/ß/g, 'ss')
    .normalize('NFD').replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9]+/g, ' ').trim();
}

// Findet ein Name den Suchtext? Jedes Wort des Suchtexts muss vorkommen (Gerät; der Server nutzt
// dafür pg_trgm in public.find_namenssuche und liefert dieselben Einträge vorsortiert).
export function nameTrifft(name, text) {
  const worte = suchText(text).split(' ').filter(Boolean);
  const n = suchText(name);
  return worte.length > 0 && worte.every((w) => n.includes(w));
}

export function suchen(eingabe) {
  const ursprung = eingabe.ursprung || null;
  const radiusKm = zahl(eingabe.radiusKm);
  const zeitpunkt = zeitMs(eingabe.zeitpunkt) ?? Date.now();
  const zeitzone = eingabe.zeitzone || 'Europe/Vienna';
  const text = String(eingabe.text ?? '').trim();
  const nameTreffer = eingabe.nameTreffer === true || Boolean(text);
  eingabe = { ...eingabe, nameTreffer };
  const liste = [];
  for (const k of (eingabe.kandidaten || []).map(kandidatLesen).filter(Boolean)) {
    if (k.geschlossen) continue;
    // Kommen die Treffer schon aus der Namenssuche der Datenbank, ist der Name geprüft (unscharf, pg_trgm).
    if (text && eingabe.nameGeprueft !== true && !nameTrifft(k.name, text)) continue;
    if (k.entfernungKm === null && ursprung && k.lat !== null) k.entfernungKm = entfernungKm(ursprung, k);
    if (eingabe.crewArt && k.crewArt !== eingabe.crewArt) continue;
    if (!eingabe.nameTreffer && radiusKm !== null && k.eintragTyp !== 'idee' && (k.entfernungKm === null || k.entfernungKm > radiusKm)) continue;
    if (k.eintragTyp === 'event' && (k.ende ?? k.beginn ?? 0) < zeitpunkt) continue;
    const frei = istFreigegeben(k);
    if (!frei && !eingabe.nameTreffer) continue;
    let oeffnung = null;
    if (k.eintragTyp === 'ort') {
      const zeiten = k.oeffnungszeitenUnternehmen || k.oeffnungszeiten;
      const s = zeiten ? oeffnungsStatus(zeiten, zeitpunkt, { feiertage: eingabe.feiertage || [], zeitzone }) : { status: 'unbekannt' };
      oeffnung = s.status === 'offen' ? (s.schliesstUm ? baustein(K.texte.offenBis, { uhr: s.schliesstUm }) : baustein(K.texte.offenesEnde))
        : s.status === 'geschlossen' ? (s.oeffnetUm ? baustein(K.texte.oeffnetUm, { uhr: s.oeffnetUm }) : baustein(K.texte.geschlossen)) : baustein(K.texte.oeffnungUnbekannt);
    }
    liste.push({ k, frei, oeffnung });
  }
  const scoreSort = (x) => (x.frei && !x.k.neu && x.k.crewScore !== null ? x.k.crewScore : (x.frei ? -1 : -2));
  liste.sort((a, b) => (scoreSort(b) - scoreSort(a)) || ((a.k.entfernungKm ?? 0) - (b.k.entfernungKm ?? 0)) || a.k.name.localeCompare(b.k.name, 'de'));
  return liste.map(({ k, frei, oeffnung }) => eintragAusgeben(k, {
    nichtEmpfohlen: !frei,
    warum: baustein(!frei ? K.texte.nichtEmpfohlen : (eingabe.nameTreffer ? K.texte.warumSuche : K.texte.warumKategorie)),
    oeffnung,
  }));
}

// =====================================================================================================
// Gelerntes (ZUSATZ §6: „Was Crew gelernt hat") und Wischkarten (ZUSATZ §5.3)
// =====================================================================================================
export function gelerntes(eingabe = {}) {
  const jetzt = zeitMs(eingabe.jetzt) ?? Date.now();
  const profil = eingabe.profil || profilAusSignalen(eingabe.signale || [], { jetzt, interessen: eingabe.interessen || [] });
  const anzahl = zahl(eingabe.anzahl) ?? 8;
  // Eine Karte, deren Hauptsache vergessen wurde („Klettern“ bei „Klettern & Bouldern“), zeigt nichts
  // Gelerntes mehr an.
  const vergessenHaupt = (akt) => istEinheit(akt) && (profil.zuletzt?.[akt] ?? -Infinity) <= vergessenAm(profil, ZUSAMMEN[akt][0]);
  const liste = Object.keys(profil.roh)
    .filter((akt) => !vergessenHaupt(akt))
    .map((akt) => ({ aktivitaet: akt, wert: eigenerWert(profil, akt).wert }))
    .filter((x) => x.wert > 0.05)
    .sort((a, b) => b.wert - a.wert || a.aktivitaet.localeCompare(b.aktivitaet));
  const gesehen = new Set();
  const interessen = [];
  for (const x of liste) {
    const label = aktivitaetLabel(x.aktivitaet);
    if (gesehen.has(label)) continue;
    gesehen.add(label);
    interessen.push({ aktivitaet: x.aktivitaet, label, staerke: Math.round(x.wert * 100) / 100 });
    if (interessen.length >= anzahl) break;
  }
  return { interessen };
}

// 10 aus 16: die Karten, aus denen gerade am meisten Neues zu lernen ist — wenig eigene Signale zu
// ihren Aktivitäten, frisch nicht schon beantwortet, und untereinander verschieden (Merkmal-Abstand).
export function wischKarten(eingabe = {}) {
  const jetzt = zeitMs(eingabe.jetzt) ?? Date.now();
  const signale = (eingabe.signale || []).map(signalLesen).filter(Boolean);
  const profil = eingabe.profil || profilAusSignalen(eingabe.signale || [], { jetzt, interessen: eingabe.interessen || [] });
  const anzahl = zahl(eingabe.anzahl) ?? K.wischKartenAnzahl;
  const beantwortet = new Set(signale.filter((s) => s.eintragTyp === 'karte' && (s.art === 'wisch_ja' || s.art === 'wisch_nein') && jetzt - s.zeit < 90 * TAG_MS).map((s) => s.eintragId));
  const unsicherheit = (karte) => {
    const staerke = karte.aktivitaeten.reduce((s, muster) => s + Object.entries(profil.staerke)
      .filter(([akt]) => musterPasst(muster, akt) || musterPasst(akt, muster)).reduce((a, [, w]) => a + w, 0), 0);
    return (1 - Math.min(1, staerke / 6)) * (beantwortet.has(karte.id) ? 0.2 : 1);
  };
  const offen = K.karten.map((karte) => ({ karte, u: unsicherheit(karte) }));
  const gewaehlt = [];
  while (gewaehlt.length < Math.min(anzahl, offen.length)) {
    let beste = null;
    for (const x of offen) {
      if (gewaehlt.includes(x)) continue;
      const abstand = gewaehlt.length ? Math.min(...gewaehlt.map((g) => 1 - aehnlichkeit(g.karte.muster, x.karte.muster))) : 0.5;
      const wert = x.u + 0.5 * abstand;
      if (!beste || wert > beste.wert + 1e-9) beste = { x, wert };
    }
    gewaehlt.push(beste.x);
  }
  return gewaehlt.map(({ karte }) => ({ id: karte.id, label: karte.label }));
}
