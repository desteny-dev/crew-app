// Bereich „Find" — die reine Darstellungslogik: WAS steht WO und in welcher Reihenfolge. Kein DOM,
// keine Texte, keine Imports. Dadurch läuft jede Regel hier auch ohne Browser.
//
// Paket G2 (Algorithmus, 28.09.2026): Find rechnet NICHTS mehr selbst. Was gut ist (Crew Score,
// Algorithmus 1) und was zu wem passt (Algorithmus 2) kommt fertig aus der Datenschicht
// (repo.findAuswahlStand / findSuchen, beide Gateways gleich, web/data/auswahl-regeln.js). Diese Datei
// ordnet nur, was dort geliefert wird:
//   · „Für dich" gliedern: der Crew-Tipp (Platz 1) groß, dann die Ringe Nah · Mittel · „Weiter weg, aber
//     lohnt sich" in der Reihenfolge der Datenschicht (leere Ringe gibt es nicht).
//   · Kategorien (ZUSATZ §6): welche Arten zu welchem Knopf gehören — ohne Personenfilter, sortiert nach
//     Crew Score, dann Entfernung (so liefert es findSuchen).
//   · Der Finder „Worauf hast du Lust?" liefert eine ABSICHT und einen Zeitpunkt — keine eigene
//     Punktlogik mehr (vorher: Wortmuster je Antwort).
//   · Signal „ignoriert" (ZUSATZ §5.2): Anzeigen im Gerät zählen und genau EINMAL melden.
//   · Gemerktes und Karte.
//
// Die Stufen des Crew Scores (§2.11: 70–79 gut · 80–89 sehr gut · 90–100 herausragend) stehen NICHT hier,
// sondern im Ring selbst (web/unternehmen/ring.js › stufeVon) — dieselbe Regel für Website und App.

const TAG_MS = 24 * 60 * 60 * 1000;

// --- Zeit -----------------------------------------------------------------------------------------
// Zeitpunkt aus dem, was ein Gateway liefern kann: Millisekunden, Date, 'YYYY-MM-DD',
// 'YYYY-MM-DDTHH:MM' (Ortszeit) oder ein ISO-Text mit Zone. Ein reines Datum wird als
// Mitternacht in ORTSZEIT gelesen — new Date('2026-09-20') wäre Mitternacht in UTC.
export function zeitpunkt(wert) {
  if (wert == null || wert === '') return null;
  if (wert instanceof Date) return Number.isFinite(wert.getTime()) ? wert.getTime() : null;
  if (typeof wert === 'number') return Number.isFinite(wert) ? wert : null;
  const text = String(wert).trim();
  const nurTag = /^(\d{4})-(\d{2})-(\d{2})$/.exec(text);
  if (nurTag) return new Date(Number(nurTag[1]), Number(nurTag[2]) - 1, Number(nurTag[3])).getTime();
  const ortszeit = /^(\d{4})-(\d{2})-(\d{2})[T ](\d{1,2}):(\d{2})(?::(\d{2}))?$/.exec(text);
  if (ortszeit) {
    const [, j, m, t, h, min, s] = ortszeit;
    return new Date(Number(j), Number(m) - 1, Number(t), Number(h), Number(min), Number(s || 0)).getTime();
  }
  const ms = Date.parse(text);
  return Number.isFinite(ms) ? ms : null;
}

function tagesEnde(ms) {
  const d = new Date(ms);
  return new Date(d.getFullYear(), d.getMonth(), d.getDate(), 23, 59, 59, 999).getTime();
}

// Vorbei ist nur, was einen Termin hat und dessen Ende hinter uns liegt.
export function istVorbei(eintrag, jetzt = Date.now()) {
  if (!eintrag?.wann) return false;
  const von = zeitpunkt(eintrag.wann.von);
  const bis = zeitpunkt(eintrag.wann.bis);
  const ende = bis ?? (von != null ? tagesEnde(von) : null);
  return ende != null && ende < (zeitpunkt(jetzt) ?? Date.now());
}

// --- Text vergleichen -----------------------------------------------------------------------------
// Klein, ohne Umlaute und Akzente, nur Buchstaben und Ziffern: „Open-Air-Kino am Bodensee" →
// „open air kino am bodensee".
export function normText(text) {
  return String(text ?? '')
    .toLowerCase()
    .replace(/ä/g, 'ae').replace(/ö/g, 'oe').replace(/ü/g, 'ue').replace(/ß/g, 'ss')
    .normalize('NFD').replace(/[̀-ͯ]/g, '')
    .replace(/[^a-z0-9]+/g, ' ')
    .trim();
}

export function hatKoordinaten(eintrag) {
  const lat = Number(eintrag?.ort?.lat);
  const lon = Number(eintrag?.ort?.lon);
  return Boolean(eintrag?.ort) && eintrag.ort.lat != null && eintrag.ort.lon != null && Number.isFinite(lat) && Number.isFinite(lon);
}

// Ein Eintrag aus der Datenschicht, so wie ihn die Seite braucht. Was nicht zum Vertrag passt, wird
// nicht geraten: ohne id oder Titel fällt er weg; ein vergangenes Event steht nirgends mehr.
export function eintragGueltig(eintrag, jetzt = Date.now()) {
  return Boolean(eintrag && typeof eintrag === 'object' && String(eintrag.id ?? '').trim() && String(eintrag.titel ?? '').trim()
    && !istVorbei(eintrag, jetzt));
}

export function eintraegeSaeubern(liste, { jetzt = Date.now(), versteckt = null, erlaubt = null } = {}) {
  const gesehen = new Set();
  const aus = [];
  for (const eintrag of Array.isArray(liste) ? liste : []) {
    if (!eintragGueltig(eintrag, jetzt) || gesehen.has(eintrag.id)) continue;
    if (versteckt?.has?.(eintrag.id)) continue;
    if (erlaubt && !erlaubt(eintrag)) continue;
    gesehen.add(eintrag.id);
    aus.push(eintrag);
  }
  return aus;
}

// --- „Für dich" gliedern (Feinschliff 01.10.2026, ersetzt die Ringe aus §3.7) ----------------------------
// daten = { eintraege, weitere } aus findAuswahlStand. `eintraege` ist „oben" in der Reihenfolge der Auswahl
// (Platz 1 = Crew-Tipp), `weitere` liegt darunter (hinter „Mehr anzeigen") — Orte, die die Abstandsregel oder
// die Vielfalt nach unten geschoben hat. Gelöscht wird nichts; was oben steht, steht unten nicht noch einmal.
export function fuerDichGliedern(daten, { jetzt = Date.now(), versteckt = null, erlaubt = null } = {}) {
  const eintraege = eintraegeSaeubern(daten?.eintraege, { jetzt, versteckt, erlaubt });
  const oben = new Set(eintraege.map((e) => e.id));
  const weitere = eintraegeSaeubern(daten?.weitere, { jetzt, versteckt, erlaubt }).filter((e) => !oben.has(e.id));
  return { hero: eintraege[0] || null, oben: eintraege.slice(1), weitere, alle: eintraege, bekannt: [...eintraege, ...weitere] };
}

// --- Kategorien (ZUSATZ §6: alles Freigegebene, nach Crew Score, dann Entfernung) --------------------
// Die bisherigen Abschnitte leben hier weiter: „Dieses Wochenende" → Events, „Beste Restaurants" → Essen,
// „Beste Erlebnisse" → Kultur/Natur/Sport/…, „Ideen für Zuhause" → Zuhause (private Ideen, ohne Score).
// Zusammen decken die Knöpfe JEDE Art aus PLAN §1.1 ab — nichts Importiertes ist unauffindbar.
export const KATEGORIEN = Object.freeze([
  { id: 'events', arten: ['konzert', 'party', 'markt', 'kultur', 'sport'] },
  { id: 'essen', arten: ['restaurant', 'cafe'] },
  { id: 'clubbar', arten: ['bar', 'club'] },
  { id: 'kultur', arten: ['museum', 'buehne', 'kino'] },
  { id: 'natur', arten: ['natur', 'wandern'] },
  { id: 'sport', arten: ['klettern', 'fitness', 'aktiv_spass', 'rad', 'wintersport', 'wassersport'] },
  { id: 'wellness', arten: ['bad', 'therme'] },
  { id: 'hobby', arten: ['spiele_hobby', 'musik_machen'] },
  { id: 'zuhause', arten: ['idee'] },
]);

export function kategorie(id) {
  return KATEGORIEN.find((k) => k.id === id) || null;
}

// Mehrere Antworten von findSuchen (je Art eine) zu EINER Liste: nach Crew Score, dann Entfernung.
// „Neu" und Ideen (ohne Zahl) stehen hinter allem mit Zahl — wie in der Datenschicht (auswahl-regeln › suchen).
function scoreRang(e) {
  if (e.nichtEmpfohlen) return -2;
  return typeof e.score === 'number' ? e.score : -1;
}
export function nachScoreDannNaehe(a, b) {
  return (scoreRang(b) - scoreRang(a))
    || ((a.entfernungKm ?? Infinity) - (b.entfernungKm ?? Infinity))
    || String(a.titel).localeCompare(String(b.titel), 'de');
}

export function kategorieListe(antworten, { jetzt = Date.now(), versteckt = null, erlaubt = null } = {}) {
  return eintraegeSaeubern((antworten || []).flat(), { jetzt, versteckt, erlaubt }).sort(nachScoreDannNaehe);
}

// --- Der Finder „Worauf hast du Lust?" --------------------------------------------------------------
// Zwei Fragen, dann das Ergebnis — jede Antwort hat eine Wirkung in der Datenschicht:
//   · Lust → `absicht` (konfig-auswahl.js › absichten: 12er-Muster + erlaubte Arten)
//   · Wann → `zeitpunkt` + `ganzerTag` (Öffnungszeiten, Events, Tageszeit, Wetter)
// Passt nichts, zeigt das Ergebnis die Kategorie, die zur Absicht gehört (ungefiltert, nach Crew Score).
export const ABSICHTEN = Object.freeze(['essen', 'trinken', 'feiern', 'entspannen', 'draussen', 'kultur', 'aktiv']);
export const ABSICHT_KATEGORIE = Object.freeze({
  essen: 'essen', trinken: 'clubbar', feiern: 'clubbar', entspannen: 'wellness', draussen: 'natur', kultur: 'kultur', aktiv: 'sport',
});
export const WANN = Object.freeze(['jetzt', 'abend', 'wochenende']);

// Zeitpunkt zu einer Wann-Antwort — auf die Viertelstunde, damit dieselbe Frage dieselbe Anfrage bleibt.
//   jetzt       → kein Zeitpunkt (die Datenschicht nimmt „jetzt")
//   abend       → heute 20 Uhr (ist es schon später: jetzt)
//   wochenende  → der ganze Samstag (am Samstag/Sonntag: heute)
export function wannOptionen(wann, jetztWert = Date.now()) {
  const jetzt = zeitpunkt(jetztWert) ?? Date.now();
  const viertel = (ms) => Math.floor(ms / 900000) * 900000;
  const d = new Date(jetzt);
  if (wann === 'abend') {
    const abend = new Date(d.getFullYear(), d.getMonth(), d.getDate(), 20, 0).getTime();
    return { zeitpunkt: viertel(Math.max(abend, jetzt)), ganzerTag: false };
  }
  if (wann === 'wochenende') {
    const tag = d.getDay();
    const bis = tag === 6 || tag === 0 ? 0 : 6 - tag;
    const ziel = new Date(d.getFullYear(), d.getMonth(), d.getDate() + bis, 12, 0).getTime();
    return { zeitpunkt: viertel(Math.max(ziel, jetzt)), ganzerTag: true };
  }
  return {};
}

export function finderAnfrage(finder, jetzt = Date.now()) {
  const absicht = ABSICHTEN.includes(finder?.absicht) ? finder.absicht : 'egal';
  return { absicht, ...wannOptionen(finder?.wann, jetzt) };
}

// --- Radius erweitern (§3.7: „Heute nichts, das gut genug ist — Radius erweitern?") ------------------
// Die Stufen kommen aus der Datenschicht (auswahl-weg.js › RADIUS_STUFEN); hier nur: die nächste.
export function naechsterRadius(stufen, jetzigerKm) {
  const liste = (Array.isArray(stufen) ? stufen : []).map(Number).filter(Number.isFinite).sort((a, b) => a - b);
  const jetzt = Number(jetzigerKm);
  const start = Number.isFinite(jetzt) ? jetzt : liste[0];
  return liste.find((km) => km > start) ?? null;
}

// --- Signal „ignoriert" (ZUSATZ §5.2: „Angezeigt, mehrmals nicht beachtet") -------------------------
// Gezählt wird im Gerät: Ein Eintrag gilt als EINMAL angezeigt, wenn er sichtbar war — höchstens einmal
// je ANZEIGE_ABSTAND (sonst zählte jedes Zeichnen). Nach ANZEIGEN_BIS_IGNORIERT Anzeigen ohne jede
// Handlung wird genau einmal gemeldet. Wer etwas mit dem Eintrag tut (öffnen, merken, teilen, planen,
// „Weniger davon"), hat ihn beachtet — dann wird nie „ignoriert" gemeldet.
//   stand: { [id]: { n, zuletzt, i (interagiert), g (gemeldet) } }
export const ANZEIGEN_BIS_IGNORIERT = 3;
export const ANZEIGE_ABSTAND_MS = 6 * 60 * 60 * 1000;
export const ANZEIGEN_MERKEN = 400;

export function anzeigeZaehlen(stand, id, jetzt = Date.now()) {
  const neu = { ...(stand && typeof stand === 'object' ? stand : {}) };
  const alt = neu[id] || { n: 0, zuletzt: 0 };
  if (alt.i || alt.g) return { stand: neu, melden: false };
  if (alt.n > 0 && jetzt - (alt.zuletzt || 0) < ANZEIGE_ABSTAND_MS) return { stand: neu, melden: false };
  const n = (alt.n || 0) + 1;
  const melden = n >= ANZEIGEN_BIS_IGNORIERT;
  neu[id] = { n, zuletzt: jetzt, ...(melden ? { g: 1 } : {}) };
  return { stand: kuerzen(neu), melden };
}

export function interaktionMerken(stand, id) {
  const neu = { ...(stand && typeof stand === 'object' ? stand : {}) };
  neu[id] = { ...(neu[id] || { n: 0, zuletzt: 0 }), i: 1 };
  return kuerzen(neu);
}

function kuerzen(stand) {
  const ids = Object.keys(stand);
  if (ids.length <= ANZEIGEN_MERKEN) return stand;
  const behalten = ids.sort((a, b) => (stand[b].zuletzt || 0) - (stand[a].zuletzt || 0)).slice(0, ANZEIGEN_MERKEN);
  return Object.fromEntries(behalten.map((id) => [id, stand[id]]));
}

// --- Das Wischspiel (ZUSATZ §5.3) -------------------------------------------------------------------
// Die leise Karte „Crew kennt dich noch kaum" steht oben in Find, solange Crew aus dem eigenen Verhalten
// weniger als WENIG_INTERESSEN Interessen kennt. Die gewählten Hauptgruppen des Einrichtens
// („gruppe:…") zählen dafür nicht — sie sind eine Angabe, kein Verhalten. Wer gespielt oder die Karte
// weggelegt hat, sieht sie WISCH_PAUSE_TAGE nicht wieder.
export const WENIG_INTERESSEN = 3;
export const WISCH_PAUSE_TAGE = 30;

export function kenntDichKaum(gelerntes) {
  const eigene = (gelerntes?.interessen || []).filter((x) => !String(x?.aktivitaet || '').startsWith('gruppe:'));
  return eigene.length < WENIG_INTERESSEN;
}

export function wischPausiert(pauseSeit, jetzt = Date.now()) {
  return Number(pauseSeit) > 0 && jetzt - Number(pauseSeit) < WISCH_PAUSE_TAGE * TAG_MS;
}

export function wischKarteZeigen(gelerntes, pauseSeit, jetzt = Date.now()) {
  if (!gelerntes) return false;
  if (wischPausiert(pauseSeit, jetzt)) return false;
  return kenntDichKaum(gelerntes);
}

// Wie weit ein Wisch zählt: ab dieser Strecke (px) oder mit Schwung ist es eine Antwort.
export const WISCH_STRECKE = 90;
export function wischUrteil(dx, geschwindigkeit = 0) {
  if (dx >= WISCH_STRECKE || (dx > 30 && geschwindigkeit > 0.6)) return 'ja';
  if (dx <= -WISCH_STRECKE || (dx < -30 && geschwindigkeit < -0.6)) return 'nein';
  return null;
}

// Stärke eines gelernten Interesses (0–1) als Wort — nie als Rohzahl (ZUSATZ §6).
export function staerkeStufe(staerke) {
  const s = Number(staerke) || 0;
  if (s >= 0.6) return 'stark';
  if (s >= 0.3) return 'mittel';
  return 'leicht';
}

// --- Gemerkt ---------------------------------------------------------------------------------------
// settings.gemerktIds, das zuletzt Gemerkte zuerst. Aufgelöst wird über `aufloesen` — eine Funktion Kennung →
// Eintrag (die Seite fragt die Datenschicht: repo.findEintragStand) oder eine Map/Liste. Was es nicht (mehr) gibt
// oder vorbei ist, steht nicht da — die Kennung bleibt gespeichert; sie schadet nicht und verrät nichts.
export function gemerktListe(aufloesen, gemerktIds, jetzt = Date.now()) {
  const nachId = typeof aufloesen === 'function' || aufloesen instanceof Map ? null : new Map((aufloesen || []).map((e) => [e.id, e]));
  const finde = typeof aufloesen === 'function' ? aufloesen : (id) => (nachId || aufloesen).get(id);
  return (Array.isArray(gemerktIds) ? gemerktIds : [])
    .map((id) => finde(id))
    .filter((eintrag) => eintrag && !istVorbei(eintrag, jetzt));
}

export function merkenUmschalten(gemerktIds, id) {
  const liste = (Array.isArray(gemerktIds) ? gemerktIds : []).filter((wert) => typeof wert === 'string' && wert);
  return liste.includes(id) ? liste.filter((wert) => wert !== id) : [id, ...liste];
}

// --- Karte ------------------------------------------------------------------------------------------
// Mehrere Einträge am selben Ort sind EINE Markierung (ui/map.js › ortMarken fächert sie auf). Die
// Reihenfolge bleibt die der Datenschicht (Rang).
export function kartenOrte(eintraege, jetzt = Date.now()) {
  const gruppen = new Map();
  for (const eintrag of eintraegeSaeubern(eintraege, { jetzt })) {
    if (!hatKoordinaten(eintrag)) continue;
    const lat = Number(eintrag.ort.lat);
    const lon = Number(eintrag.ort.lon);
    const key = `${lat.toFixed(5)}|${lon.toFixed(5)}`;
    if (!gruppen.has(key)) gruppen.set(key, { key, lat, lon, eintraege: [] });
    gruppen.get(key).eintraege.push(eintrag);
  }
  return [...gruppen.values()];
}
