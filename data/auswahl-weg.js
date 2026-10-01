// Der Datenweg der persönlichen Auswahl (Paket G1) — was BEIDE Gateways gleich machen müssen.
//
// Algorithmus 2 selbst rechnet web/data/auswahl-regeln.js (im Gerät) bzw. die Edge Function `auswahl`
// mit derselben Datei (am Server). Diese Datei ist die Schicht dazwischen, damit es über dieselbe
// Frage keine zwei Wahrheiten gibt (Hausregel 3):
//   · Texte: Das Modul liefert neben den deutschen Sätzen Bausteine { text, werte } — HIER, an einer
//     Stelle, wird daraus mit t() der fertige Satz in der Sprache der App (eintragAnzeigen).
//   · Signale: welche Arten ein Mensch selbst melden darf, wie eine App-Kennung gelesen wird, und
//     im Gerät dieselben Grenzen wie public.signal_melden (0058) — signalPruefen.
//   · Meet-Signale im Gerät: dieselben Regeln wie die Trigger am Server (0058/0061) — meetSignale.
//   · Meldungen („?"-Menü, ALGORITHMUS §7.1): dieselben Grenzen wie public.meldung_senden (0061).
//   · Vorschläge beim Meet-Erstellen: Einträge aus „Für dich" und aus der Suche in der Form, die die
//     Vorschlagskarten kennen (vorschlaegeAusAuswahl).
//   · AuswahlLader: Antworten der Edge Function halten, `vorlaeufig` einmal nachfragen, Fehler zeigen.
// Rein bis auf t() und den Lader — keine Oberfläche, kein Speicher.

import { t } from '../core/sprache.js';
import { KONFIG_AUSWAHL as K } from './konfig-auswahl.js';
import { MARKE } from '../core/marke.js';
import { entfernungKm, hatLage } from '../core/entfernung.js';
import { iconKeyForText, activityIconKey } from '../ui/activity-icons.js';
import { weekdayShort, toISODate } from '../core/dates.js';

const TAG_MS = 86400000;

// Die EINE Fehlermeldung, wenn der Server nicht antwortet oder ablehnt — nie still eine leere Liste.
export function auswahlFehlerText() {
  return t('Hat nicht geklappt');
}

export class AuswahlFehler extends Error {
  constructor(grund = 'netz') {
    super(auswahlFehlerText());
    this.grund = grund;
  }
}

// =====================================================================================================
// Texte: Bausteine → Sätze in der Sprache der App
// =====================================================================================================
// Werte eines Bausteins (auswahl-regeln.js › baustein): 'Wort'/12 so, { worte:[…] } je Wort übersetzt mit
// ' · ', { liste:[…] } je Wort übersetzt mit ', '.
function wertAnzeigen(wert) {
  if (wert && Array.isArray(wert.worte)) return wert.worte.map((w) => t(String(w))).join(' · ');
  if (wert && Array.isArray(wert.liste)) return wert.liste.map((w) => t(String(w))).join(', ');
  return wert ?? '';
}

export function bausteinAnzeigen(b) {
  if (!b || !b.text) return '';
  const werte = {};
  for (const [k, v] of Object.entries(b.werte || {})) werte[k] = wertAnzeigen(v);
  return t(String(b.text), werte);
}

// Ein Label aus Wörtern („Klettern · Fels") — jedes Wort ist ein Schlüssel im Wörterbuch.
export function labelAnzeigen(label) {
  return String(label || '').split(' · ').map((w) => t(w)).join(' · ');
}

// Ein Grund des Crew Scores (Paket B): Kommt die Vorlage mit (Edge Function), wird sie übersetzt und
// mit den Zahlen gefüllt; sonst bleibt der gelieferte Satz (übersetzt, wenn das Wörterbuch ihn kennt).
function grundAnzeigen(g) {
  const text = g.vorlage ? t(String(g.vorlage), g.zahlen || {}) : t(String(g.text || ''));
  return { ...g, text };
}

// Ein Eintrag aus „Für dich" oder der Suche (PLAN §1.2) mit fertigen Sätzen.
//   beispiel: true  → Beispiel-Score des Geräte-Bestands (seed/find.js) — `scoreBeispiel: true`
//   tester          → die Beispiel-Tester-Bewertung, falls es eine gibt
// Titel und Beschreibung privater Ideen sind deutsche Sätze aus dem Wörterbuch (Paket D) und werden
// übersetzt; Namen echter Orte nie (ein Ort namens „Kino" hieße sonst auf Englisch „Cinema").
export function eintragAnzeigen(e, { beispiel = false, tester = null } = {}) {
  if (!e || typeof e !== 'object') return null;
  const texte = e.texte || {};
  const idee = e.eintragTyp === 'idee';
  const aus = {
    ...e,
    titel: idee ? t(String(e.titel || '')) : String(e.titel || ''),
    ort: e.ort ? { ...e.ort, name: idee ? t(String(e.ort.name || '')) : e.ort.name } : e.ort,
    passungText: texte.passung ? bausteinAnzeigen(texte.passung) : t(String(e.passungText || '')),
    warum: texte.warum ? bausteinAnzeigen(texte.warum) : t(String(e.warum || '')),
    oeffnungsHinweis: texte.oeffnung ? bausteinAnzeigen(texte.oeffnung) : t(String(e.oeffnungsHinweis || '')),
    wetterHinweis: texte.wetter ? bausteinAnzeigen(texte.wetter) : t(String(e.wetterHinweis || '')),
    scoreGruende: (Array.isArray(e.scoreGruende) ? e.scoreGruende : []).map(grundAnzeigen),
    tags: Array.isArray(e.tags) ? [...e.tags] : [],
    gesponsert: e.gesponsert === true,
  };
  if (e.beschreibung) aus.beschreibung = idee ? t(String(e.beschreibung)) : String(e.beschreibung);
  if (beispiel && aus.score !== null && aus.score !== undefined) aus.scoreBeispiel = true;
  if (tester) aus.testerBewertung = { ...tester };
  return aus;
}

// Die Antwort von „Für dich" für die Oberfläche: fertige Sätze, dieselbe Form in beiden Gateways.
export function auswahlAntwort(r, optionen = {}) {
  const eintraege = (Array.isArray(r?.eintraege) ? r.eintraege : []).map((e) => eintragAnzeigen(e, optionen.je?.(e) || optionen)).filter(Boolean);
  const ringe = { nah: [...(r?.ringe?.nah || [])], mittel: [...(r?.ringe?.mittel || [])], fern: [...(r?.ringe?.fern || [])] };
  // Feinschliff: was nicht oben steht, liegt darunter („Mehr anzeigen“) — gelöscht wird nichts.
  const weitere = (Array.isArray(r?.weitere) ? r.weitere : []).map((e) => eintragAnzeigen(e, optionen.je?.(e) || optionen)).filter(Boolean);
  return {
    eintraege,
    weitere,
    ringe,
    leer: eintraege.length === 0,
    vorlaeufig: r?.vorlaeufig === true,
    ...(eintraege.length === 0 ? { leerText: t(K.texte.leer) } : {}),
    ...(r?.ohneStandort ? { ohneStandort: true } : {}),
  };
}

export function gelerntesAnzeigen(r) {
  const interessen = (Array.isArray(r?.interessen) ? r.interessen : []).map((x) => ({
    aktivitaet: String(x.aktivitaet), label: labelAnzeigen(x.label), staerke: Number(x.staerke) || 0,
  }));
  return { interessen };
}

export function wischKartenAnzeigen(karten) {
  return (Array.isArray(karten) ? karten : []).map((k) => ({ id: String(k.id), label: t(String(k.label || k.id)) }));
}

// =====================================================================================================
// Private Ideen als Kandidaten (Zeilenform von crew_auswahl_kandidaten › ideen_k, 0058)
// =====================================================================================================
// Eine Zeile der Tabelle ideen_privat (bzw. seed/ideen-privat.js) → Kandidat. Ideen brauchen keinen Ort:
// Ohne Standort (keine Einwilligung) zeigt „Was machen?" genau sie — im Gerät aus dem Seed, am Server aus der
// Tabelle (lesbar für Angemeldete, 0055). Dieselbe Umformung für beide.
export function ideeAlsKandidat(i) {
  return {
    eintrag_typ: 'idee', id: `idee:${i.id}`, name: i.name, art: 'idee', stil: null, aktivitaet: i.aktivitaet || `idee·${i.id}`,
    lat: null, lon: null, adresse: null, land: null, merkmale: i.merkmale, touristen_wert: null, min_alter: i.min_alter ?? null,
    oeffnungszeiten_osm: null, beginn: null, ende: null, ort_id: null,
    crew_score: null, neu: false, freigegeben: true, gruende: [],
    personen_min: i.personen_min ?? null, personen_max: i.personen_max ?? null, jahreszeiten: i.jahreszeiten ?? null,
    wetter_abhaengig: i.wetter_abhaengig === true, draussen: i.draussen ?? null,
    bild: null, bild_seite: null, beschreibung: i.beschreibung || null, tags: Array.isArray(i.tags) ? i.tags : [],
  };
}

// =====================================================================================================
// Standort und Gruppe
// =====================================================================================================
// Vor dem Senden auf 0,01° (≈ 1 km) — wie orte-vorschlaege.js; die Edge Function rundet zusätzlich.
export function lageRunden(lage) {
  if (!hatLage(lage)) return null;
  const r = K.server.standortRundung || 0.01;
  const runden = (x) => Math.round(Math.round(x / r) * r * 1e6) / 1e6;
  return { lat: runden(Number(lage.lat)), lon: runden(Number(lage.lon)) };
}

// Die Gruppe einer Anfrage in EINER Form: Meet vor Crew vor einzelnen Personen; sonst allein.
export function gruppeAus(opts = {}) {
  if (opts.meetId) return { meetId: String(opts.meetId) };
  if (opts.crewId) return { crewId: String(opts.crewId) };
  const personen = [...new Set((opts.personIds || opts.personen || []).map(String).filter(Boolean))];
  if (personen.length) return { personen };
  return null;
}

// Der Umkreis-Regler in „Was machen?" geht Kilometer für Kilometer. Gefragt wird in Stufen (dazwischen filtert
// die Liste selbst nach Entfernung, vorschlaegeAusAuswahl) — sonst wäre jeder Kilometer eine Anfrage an den Server.
// Ohne Umkreis gilt der Standard (25 km, Konfig).
export const RADIUS_STUFEN = Object.freeze([K.radius.standardKm, 50, 100, K.radius.maxKm]);
export function radiusStufe(km) {
  if (km === null || km === undefined || !Number.isFinite(Number(km))) return null;
  return RADIUS_STUFEN.find((s) => s >= Number(km)) ?? K.radius.maxKm;
}

// Zeitpunkt aus einem Entwurf (when: { date, time, open, now }) — ohne Uhrzeit gilt der ganze Tag.
export function zeitpunktAusTermin(when, jetzt = Date.now()) {
  if (!when || when.now || !when.date) return { zeitpunkt: jetzt, ganzerTag: false };
  const [j, m, d] = String(when.date).split('-').map(Number);
  if (!j || !m || !d) return { zeitpunkt: jetzt, ganzerTag: false };
  if (when.open || !when.time) {
    const mittag = new Date(j, m - 1, d, 12, 0).getTime();
    return { zeitpunkt: mittag, ganzerTag: true };
  }
  const [h, min] = String(when.time).split(':').map(Number);
  return { zeitpunkt: new Date(j, m - 1, d, h || 0, min || 0).getTime(), ganzerTag: false };
}

// =====================================================================================================
// Signale (PLAN §1.3)
// =====================================================================================================
export const CLIENT_SIGNALE = Object.freeze([...K.clientSignale]);

// Eine App-Kennung → wohin das Signal zeigt:
//   'karte:<id>'        eine Wischkarte (wisch_ja/wisch_nein)
//   'aktivitaet:<akt>'  eine Aktivität ('bar·cocktail', 'klettern·*', 'karte:…', 'gruppe:…', '*') — vergessen/weniger
//   sonst               ein Eintrag ('osm:node/…', 'ev:<uuid>', 'idee:<id>', im Gerät auch 'f-…')
export function signalZiel(eintragId) {
  const id = String(eintragId ?? '').trim();
  if (id.startsWith('karte:')) return { typ: 'karte', id: id.slice(6) };
  if (id.startsWith('aktivitaet:')) return { typ: 'aktivitaet', id: id.slice(11) || '*' };
  return { typ: null, id };
}

// Dieselben Grenzen wie public.signal_melden (0058) — für das Gerät.
//   kandidat: der Eintrag aus dem Bestand (für eintrag_typ und aktivitaet) oder null
//   heute:    wie viele Client-Signale dieser Mensch in den letzten 24 h gemeldet hat
// → { ok:true, signal } | { ok:false, grund:'art'|'eintrag'|'wert'|'typ'|'zu-viele' }
export function signalPruefen({ art, eintragId, wert = null } = {}, { kandidat = null, heute = 0, jetzt = Date.now() } = {}) {
  if (!CLIENT_SIGNALE.includes(art)) return { ok: false, grund: 'art' };
  const ziel = signalZiel(eintragId);
  if (!ziel.id || ziel.id.length > 200) return { ok: false, grund: 'eintrag' };
  const w = wert === null || wert === undefined ? null : Number(wert);
  if (w !== null && (!Number.isFinite(w) || (art === 'angesehen' ? (w < 0 || w > 3600) : (w < -1 || w > 1)))) return { ok: false, grund: 'wert' };
  let signal;
  if (ziel.typ === 'karte') {
    if (art !== 'wisch_ja' && art !== 'wisch_nein') return { ok: false, grund: 'art' };
    if (!K.karten.some((k) => k.id === ziel.id)) return { ok: false, grund: 'eintrag' };
    signal = { eintrag_typ: 'karte', eintrag_id: ziel.id, aktivitaet: null };
  } else if (ziel.typ === 'aktivitaet') {
    if (art !== 'vergessen' && art !== 'weniger') return { ok: false, grund: 'art' };
    const akt = ziel.id;
    if (!(akt === '*' || /^[a-z_]{2,20}·[a-z0-9_*-]{1,60}$/.test(akt) || /^(karte|gruppe):[a-z_ ]{2,20}$/.test(akt))) return { ok: false, grund: 'eintrag' };
    signal = { eintrag_typ: 'aktivitaet', eintrag_id: akt, aktivitaet: akt };
  } else {
    if (art === 'vergessen') return { ok: false, grund: 'art' };
    if (!kandidat?.aktivitaet) return { ok: false, grund: 'eintrag' };
    signal = { eintrag_typ: kandidat.eintrag_typ || 'ort', eintrag_id: String(kandidat.id), aktivitaet: kandidat.aktivitaet };
  }
  if (heute >= K.signaleProTag) return { ok: false, grund: 'zu-viele' };
  return { ok: true, signal: { ...signal, art, wert: w, erstellt_am: new Date(jetzt).toISOString() } };
}

// Wie viele Signale das Gerät höchstens hält (die ältesten Client-Signale gehen zuerst; Meet-Signale
// bleiben — sie sind die stärksten, ZUSATZ §5.2).
export const SIGNALE_IM_GERAET = 1500;
export function signaleDeckeln(signale) {
  const liste = Array.isArray(signale) ? signale : [];
  if (liste.length <= SIGNALE_IM_GERAET) return liste;
  const meet = liste.filter((s) => s.meet_id);
  const rest = liste.filter((s) => !s.meet_id);
  return [...meet, ...rest.slice(Math.max(0, rest.length - (SIGNALE_IM_GERAET - meet.length)))]
    .sort((a, b) => String(a.erstellt_am).localeCompare(String(b.erstellt_am)));
}

export function signaleHeute(signale, jetzt = Date.now()) {
  return (Array.isArray(signale) ? signale : []).filter((s) => CLIENT_SIGNALE.includes(s.art) && jetzt - Date.parse(s.erstellt_am) < TAG_MS).length;
}

// =====================================================================================================
// Meet-Signale — dieselben Regeln wie die Trigger am Server (0058 signal_zusage, 0061 signal_bewertung)
// =====================================================================================================
// Bewertungs-Skala: 0 (nicht gut) · 50 (mittel) · 100 (gut) — die Skala des Crew Scores (Paket B,
// konfig-score.js › bewertung_werte), gelesen aus konfig-auswahl.js › bewertungSkala.
export function urteilLesen(review) {
  let urteil = review?.verdict ? String(review.verdict) : null;
  if (urteil === 'wieder-machen') urteil = 'gut';
  if (urteil === 'nicht-passend') urteil = (review.reasons || []).includes('fand-nicht-statt') ? 'fand-nicht-statt' : 'nicht-gut';
  return urteil;
}

// signale: die bisherigen Signale · meet: { id, crewId?, place:{ eintragId } } · kandidat: Eintrag aus
// dem Bestand ({ eintrag_typ, id, aktivitaet }) · aenderung: { zusage:'yes'|'maybe'|'no'|… } oder
// { bewertung: review|null }. → die neue Liste (die Zeilen gehören dem Meet und geben seinen JETZIGEN
// Stand wieder: Zusage zurückgezogen → weg, Bewertung geändert → neu).
export function meetSignale(signale, { meet, kandidat, aenderung, jetzt = Date.now() }) {
  const liste = Array.isArray(signale) ? [...signale] : [];
  if (!meet?.id || !kandidat?.aktivitaet || !meet.place?.eintragId) return liste;
  const basis = {
    eintrag_typ: kandidat.eintrag_typ || 'ort', eintrag_id: String(kandidat.id), aktivitaet: kandidat.aktivitaet,
    meet_id: String(meet.id), crew_id: meet.crewId || null, erstellt_am: new Date(jetzt).toISOString(),
  };
  if (aenderung && 'zusage' in aenderung) {
    const ohne = liste.filter((s) => !(s.meet_id === basis.meet_id && s.art === 'zugesagt'));
    if (aenderung.zusage === 'yes') ohne.push({ ...basis, art: 'zugesagt', wert: null });
    return ohne;
  }
  if (aenderung && 'bewertung' in aenderung) {
    const ohne = liste.filter((s) => !(s.meet_id === basis.meet_id && ['meet_stattgefunden', 'meet_nicht', 'meet_unklar', 'bewertung'].includes(s.art)));
    const urteil = urteilLesen(aenderung.bewertung);
    if (urteil === 'fand-nicht-statt') ohne.push({ ...basis, art: 'meet_nicht', wert: null });
    else if (Object.prototype.hasOwnProperty.call(K.bewertungSkala, urteil)) {
      ohne.push({ ...basis, art: 'meet_stattgefunden', wert: null }, { ...basis, art: 'bewertung', wert: K.bewertungSkala[urteil] });
    }
    return ohne;
  }
  return liste;
}

// =====================================================================================================
// Meldungen („?"-Menü, ALGORITHMUS §7.1) — dieselben Grenzen wie public.meldung_senden (0061)
// =====================================================================================================
export const MELDUNG_ARTEN = Object.freeze(['falsch', 'geschlossen', 'unpassend', 'bild_problem', 'dein_unternehmen']);
export const MELDUNG_TEXT_MAX = 200;
export const MELDUNG_TAGE = 60;

// → { ok:true, text } | { ok:false, grund:'art'|'text'|'typ' }
export function meldungPruefen({ eintragId, art, text } = {}) {
  if (!MELDUNG_ARTEN.includes(art)) return { ok: false, grund: 'art' };
  const id = String(eintragId ?? '').trim();
  if (!id || id.length > 200) return { ok: false, grund: 'eintrag' };
  if (id.startsWith('idee:')) return { ok: false, grund: 'typ' }; // private Ideen sind unsere eigenen — nichts zu melden
  const sauber = String(text ?? '').replace(/[\x00-\x1f\x7f]/g, ' ').replace(/\s+/g, ' ').trim();
  if ([...sauber].length > MELDUNG_TEXT_MAX) return { ok: false, grund: 'text' };
  return { ok: true, text: sauber || null };
}

// Die Ortsseite eines OSM-Orts (Paket H, web/unternehmen/pfad.js): <webAdresse>ort.html?ort=n123.
// Der Server liefert nur den Pfad; die Adresse der Website steht an EINER Stelle (core/marke.js).
export function ortSeiteSchluessel(eintragId) {
  const m = String(eintragId || '').match(/^osm:(node|way|relation)\/([0-9]{1,15})$/);
  return m ? `${m[1][0]}${m[2]}` : '';
}
export function ortSeiteAdresse(pfad) {
  const rein = String(pfad || '').replace(/^\/+/, '');
  return rein ? `${MARKE.webAdresse}${rein}` : '';
}

// =====================================================================================================
// Vorschläge beim Meet-Erstellen aus Algorithmus 2 (ZUSATZ §7)
// =====================================================================================================
// Die Kategorien der Vorschlagsliste (new-meet.js › CATEGORIES) je Art. Ideen nach ihren Stichwörtern.
const KATEGORIE_JE_ART = {
  restaurant: 'essen', cafe: 'essen',
  bar: 'ausgehen', club: 'ausgehen', kino: 'ausgehen', buehne: 'ausgehen', museum: 'ausgehen', spiele_hobby: 'ausgehen', musik_machen: 'ausgehen',
  bad: 'chillen', therme: 'chillen', natur: 'chillen',
  wandern: 'sport', klettern: 'sport', rad: 'sport', wintersport: 'sport', wassersport: 'sport', fitness: 'sport', aktiv_spass: 'sport',
};
// Zeichen je Art (ui/symbole.js) — nur wo die Art eindeutig ist. „Bowling, Minigolf & Co." und „Spiele & Hobby"
// leiten es aus Titel und Kategorie ab: Das Zeichen ist auch die Art, an der „Was machen?" gemeinsame Dinge
// erkennt (E8) — ein Würfel an einer Bowlingbahn behauptete sonst „Ihr habt: Brettspiele".
const ZEICHEN_JE_ART = {
  restaurant: 'gabel', cafe: 'tasse', bar: 'glas', club: 'feiern', kino: 'film', buehne: 'ticket', museum: 'museum',
  bad: 'schwimmen', therme: 'wellen', fitness: 'hantel', natur: 'berg', wandern: 'wandern',
  klettern: 'berg', rad: 'rad', wintersport: 'ski', wassersport: 'kanu', musik_machen: 'gitarre',
  konzert: 'note', party: 'feiern', markt: 'tasche', kultur: 'ticket', sport: 'fussball',
};

export function vorschlagsKategorie(e) {
  if (e.eintragTyp === 'event') return 'event';
  if (e.eintragTyp === 'idee') {
    const tags = new Set(e.tags || []);
    if (['essen', 'kochen', 'backen', 'grillen', 'brunch', 'pizza', 'fondue'].some((w) => tags.has(w))) return 'essen';
    if (['sport', 'bewegung', 'turnier', 'wandern', 'rad', 'klettern', 'yoga'].some((w) => tags.has(w))) return 'sport';
    return 'chillen';
  }
  return KATEGORIE_JE_ART[e.crewArt] || 'ausgehen';
}

// Ein Eintrag (mit fertigen Sätzen) → Vorschlagskarte. `eintragId` steht am Vorschlag UND an seinem
// Ort: Der Ort wandert beim Wählen in den Entwurf (new-meet.js › applySelection) und beim Senden ins
// Meet (projections.js › uebernimmOrt) — dort lesen die Trigger am Server `place.eintragId`.
export function auswahlAlsVorschlag(e, { stufe = 'passend' } = {}) {
  const idee = e.eintragTyp === 'idee';
  const place = idee || !hatLage(e.ort) ? null : {
    name: e.ort.adresse && e.eintragTyp === 'event' ? e.ort.adresse : e.ort.name,
    address: e.eintragTyp === 'event' ? '' : (e.ort.adresse || ''),
    lat: Number(e.ort.lat), lon: Number(e.ort.lon), eintragId: e.id,
  };
  const beginn = Number(e.wann?.von);
  const iconKey = idee || !ZEICHEN_JE_ART[e.crewArt] ? (iconKeyForText(e.titel) || null) : ZEICHEN_JE_ART[e.crewArt];
  const category = vorschlagsKategorie(e);
  return {
    id: e.id, eintragId: e.id, quelle: 'crew',
    title: e.titel, shortTitle: e.titel,
    icon: null, iconKey,
    // Die Art des Zeichens — damit lernt „Was machen?" wie bisher, was gewählt und was übergangen wird.
    art: activityIconKey({ iconKey, title: e.titel, category }),
    kind: e.eintragTyp === 'event' ? 'event' : (idee ? 'idee' : 'ort'),
    category,
    place,
    home: idee && !(e.tags || []).includes('draussen'),
    distanceKm: typeof e.entfernungKm === 'number' ? e.entfernungKm : null,
    priceLevel: null, price: null,
    ...(e.eintragTyp === 'event' && Number.isFinite(beginn) ? { when: weekdayShort(toISODate(new Date(beginn))) } : {}),
    reason: e.warum || e.passungText || '',
    blurb: e.passungText || '',
    description: e.beschreibung || '',
    ...(e.bild ? { bild: e.bild, bildSeite: e.bildSeite || null, bildUrheber: e.bildUrheber || null } : {}),
    links: { website: null, social: [], maps: place ? ['apple', 'google'] : [] },
    stufe,
    score: e.score ?? null,
    scoreBeispiel: e.scoreBeispiel === true,
    malWasAnderes: e.malWasAnderes === true,
    nichtEmpfohlen: e.nichtEmpfohlen === true,
    wann: e.wann ? { ...e.wann } : null,
  };
}

// Die Liste für „Was machen?": zuerst „Für dich" der Gruppe (Events als „Besonders", höchstens drei),
// dann „Geht immer" = Suche/Kategorien (ZUSATZ §6: alles Freigegebene nach Crew Score, dann Entfernung).
// Danach die Filter der Oberfläche — dieselben wie vorher in der RulesEngine: Kategorie, Ort-Modus,
// Budget, Suchtext, Umkreis, „Nicht für mich". „Geht immer" ist ohne Suchtext gedeckelt (die besten
// Orte und Events, dazu Ideen) — eine Liste von 120 Zeilen ist keine Auswahl mehr; wer sucht, findet alles.
//   quellen: { fuerDich:[Einträge], alle:[Einträge], treffer:[Einträge der Namenssuche] }
export const GEHT_IMMER_ORTE = 30;
export const GEHT_IMMER_IDEEN = 12;
export function vorschlaegeAusAuswahl(quellen, filter = {}, { lernen = null, mitte = null } = {}) {
  const gesehen = new Set();
  const liste = [];
  let besonders = 0;
  const dazu = (e, stufe) => {
    if (!e?.id || gesehen.has(e.id)) return;
    gesehen.add(e.id);
    let s = stufe;
    if (s === 'passend' && e.eintragTyp === 'event' && besonders < 3) { s = 'besonders'; besonders += 1; }
    liste.push(auswahlAlsVorschlag(e, { stufe: s }));
  };
  const query = String(filter.query || '').trim();
  for (const e of quellen.fuerDich || []) dazu(e, 'passend');
  for (const e of quellen.alle || []) dazu(e, 'immer');
  if (query) for (const e of quellen.treffer || []) dazu(e, 'immer');
  const q = query.toLowerCase();
  const nein = lernen?.nein || {};
  const gefiltert = liste.map((s) => (hatLage(mitte) && s.place ? { ...s, distanceKm: Math.round(entfernungKm(mitte, s.place) * 10) / 10 } : s)).filter((s) => {
    if (nein[s.id]) return false;
    if (filter.category && filter.category !== 'egal' && s.category !== filter.category) return false;
    if (filter.placeMode === 'daheim' && !s.home) return false;
    if (filter.placeMode === 'unterwegs' && !s.place) return false;
    if (filter.radiusKm != null && s.distanceKm != null && s.distanceKm > Number(filter.radiusKm)) return false;
    if (q && !`${s.title} ${s.blurb || ''} ${s.description || ''}`.toLowerCase().includes(q)) return false;
    return true;
  });
  if (q) return gefiltert;
  let orte = 0;
  let ideen = 0;
  return gefiltert.filter((s) => {
    if (s.stufe !== 'immer') return true;
    if (s.kind === 'idee') { ideen += 1; return ideen <= GEHT_IMMER_IDEEN; }
    orte += 1;
    return orte <= GEHT_IMMER_ORTE;
  });
}

// =====================================================================================================
// AuswahlLader — Antworten der Edge Function halten (Server-Datenweg)
// =====================================================================================================
// holen(anfrage) → Promise<Antwort> (wirft bei Fehler) · geaendert() zeichnet die App neu.
// `vorlaeufig: true` heißt: Die Region wird gerade nachgeladen (Paket A) — nach `nachfrageMs` wird EIN
// Mal nachgefragt und die Liste ersetzt. Ein Fehler bleibt sichtbar stehen (stand().fehler) und wird
// frühestens nach `fehlerPauseMs` von selbst wiederholt — sonst fragte jedes Zeichnen erneut.
export class AuswahlLader {
  constructor(holen, geaendert = () => {}, { frischMs = 5 * 60000, nachfrageMs = 4000, fehlerPauseMs = 60000, hoechstens = 40 } = {}) {
    this.holen = holen;
    this.geaendert = geaendert;
    this.frischMs = frischMs;
    this.nachfrageMs = nachfrageMs;
    this.fehlerPauseMs = fehlerPauseMs;
    this.hoechstens = hoechstens;
    this.speicher = new Map();
  }

  stand(schluessel) {
    return this.speicher.get(schluessel) || null;
  }

  // Braucht es eine (neue) Anfrage? Frisch gehaltene Antworten und laufende Anfragen nicht.
  faellig(schluessel) {
    const e = this.speicher.get(schluessel);
    if (!e) return true;
    if (e.laedt) return false;
    if (e.fehler) return Date.now() - e.am > this.fehlerPauseMs;
    return Date.now() - e.am > this.frischMs;
  }

  laden(schluessel, anfrage, { erzwingen = false } = {}) {
    const e = this.speicher.get(schluessel);
    if (e?.laedt) return e.versprechen;
    if (e && !erzwingen && !this.faellig(schluessel)) return e.fehler ? Promise.reject(e.fehler) : Promise.resolve(e.daten);
    const eintrag = e || { daten: null, fehler: null, laedt: false, am: 0, nachgefragt: false };
    eintrag.laedt = true;
    this.speicher.delete(schluessel);
    this.speicher.set(schluessel, eintrag);
    while (this.speicher.size > this.hoechstens) this.speicher.delete(this.speicher.keys().next().value);
    eintrag.versprechen = Promise.resolve()
      .then(() => this.holen(anfrage))
      .then((daten) => {
        eintrag.daten = daten;
        eintrag.fehler = null;
        eintrag.am = Date.now();
        eintrag.laedt = false;
        if (daten?.vorlaeufig && !eintrag.nachgefragt) {
          eintrag.nachgefragt = true;
          setTimeout(() => { this.laden(schluessel, anfrage, { erzwingen: true }).catch(() => {}); }, this.nachfrageMs);
        }
        this.geaendert();
        return daten;
      }, (fehler) => {
        eintrag.fehler = fehler instanceof AuswahlFehler ? fehler : new AuswahlFehler(fehler?.grund || 'netz');
        eintrag.am = Date.now();
        eintrag.laedt = false;
        this.geaendert();
        throw eintrag.fehler;
      });
    return eintrag.versprechen;
  }

  vergessen() {
    this.speicher.clear();
  }
}
