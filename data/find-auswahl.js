// Bereich „Find" (Runde 8, R8-66) — die reine Darstellungslogik: WAS steht WO und in welcher
// Reihenfolge, und wie der Finder eingrenzt. Kein Speicher, kein DOM, keine Texte, keine Imports.
// Eingabe sind die Einträge aus repo.getFindEintraege() und ein Zeitpunkt; Ausgabe sind Listen.
// Dadurch läuft jede Regel hier auch ohne Browser (scratch/.r8b-find/auswahl-probe.mjs).
//
// Datenvertrag (web/data/repository.js, Paket daten):
//   { id, titel, art:'event'|'restaurant'|'erlebnis', ort:{name,lat,lon}, wann?:{von,bis} (ms),
//     bild?, bildUrheber?, bildSeite?, score (0–100), testerBewertung?:{note 1–5, text, beispiel?},
//     gesponsert:boolean, tags:[] }
//
// =============================================================================================
// DIE EINE STELLE, AN DER DIE OBERFLÄCHE DEN SCORE LIEST
// ---------------------------------------------------------------------------------------------
// Jonathan baut den Algorithmus, der Einträge bewertet, gerade in einem anderen Chat. Bis er da
// ist, zeigt Find das Ergebnis, das schon vorliegt: das Feld `score` am Eintrag (0–100). GERECHNET
// wird es an EINER Stelle — web/data/projections.js › findScore (Paket daten), in beiden
// Gateways gleich. Kommt der Algorithmus, wird genau diese Funktion ersetzt.
//
// Auf dieser Seite gilt dasselbe in klein: Alles, was mit dem Score arbeitet — Reihenfolge,
// Crew-Tipp, Anzeige, Finder, die Zahl auf der Karte —, liest ihn ausschließlich HIER. Sollte der
// Algorithmus einmal im Gerät statt in der Datenschicht laufen, ist das die zweite und letzte
// Stelle zum Tauschen; `kontext` trägt schon, was er bräuchte ({ jetzt, lage, settings }).
//
// Was NIE einfließt: `gesponsert` (eine Anzeige kauft keinen Score) und `testerBewertung` (die
// steht getrennt und gekennzeichnet daneben, R8-50).
// =============================================================================================
export function scoreVon(eintrag, kontext = {}) {
  void kontext;
  const wert = Number(eintrag?.score);
  return eintrag?.score !== null && eintrag?.score !== '' && Number.isFinite(wert) ? wert : null;
}

// --- Einträge lesen -------------------------------------------------------------------------
// Was nicht zum Vertrag passt, wird nicht geraten: ohne id oder Titel fällt ein Eintrag weg;
// ohne Koordinaten bleibt er in den Listen, fehlt aber auf der Karte; eine unbekannte Art gilt
// als Erlebnis (die allgemeinste der drei); ein unlesbarer Zeitpunkt heißt „ohne Termin".
export const ARTEN = Object.freeze(['event', 'restaurant', 'erlebnis']);

const TAG_MS = 24 * 60 * 60 * 1000;

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

function zahlOderNull(wert) {
  if (wert === null || wert === undefined || wert === '') return null;
  const zahl = Number(wert);
  return Number.isFinite(zahl) ? zahl : null;
}

export function eintragLesen(roh, kontext = {}) {
  if (!roh || typeof roh !== 'object') return null;
  const id = String(roh.id ?? '').trim();
  const titel = String(roh.titel ?? '').trim();
  if (!id || !titel) return null;
  const art = ARTEN.includes(roh.art) ? roh.art : 'erlebnis';
  const lat = zahlOderNull(roh.ort?.lat);
  const lon = zahlOderNull(roh.ort?.lon);
  const ort = roh.ort && typeof roh.ort === 'object'
    ? { name: String(roh.ort.name ?? '').trim(), lat, lon, adresse: String(roh.ort.adresse ?? roh.ort.address ?? '').trim() }
    : null;
  const von = zeitpunkt(roh.wann?.von);
  const bisRoh = zeitpunkt(roh.wann?.bis);
  // Ein Ende vor dem Anfang ist ein Tippfehler, keine Angabe — dann gilt nur der Anfang.
  const wann = von != null ? { von, bis: bisRoh != null && bisRoh >= von ? bisRoh : null } : null;
  const note = zahlOderNull(roh.testerBewertung?.note);
  const testerText = String(roh.testerBewertung?.text ?? '').trim();
  // `beispiel` steht nur im Beispielbestand (seed/find.js) — die Oberfläche kennzeichnet es.
  const tester = note != null || testerText ? { note, text: testerText, beispiel: roh.testerBewertung?.beispiel === true } : null;
  const bild = typeof roh.bild === 'string' && roh.bild.trim() ? roh.bild.trim() : null;
  const tags = Array.isArray(roh.tags) ? roh.tags.map((tag) => String(tag ?? '').trim()).filter(Boolean) : [];
  return {
    id,
    titel,
    art,
    ort,
    wann,
    bild,
    // Die Namensnennung, die freie Bildlizenzen verlangen — sie reist mit dem Bild.
    bildUrheber: bild ? String(roh.bildUrheber ?? '').trim() : '',
    bildSeite: bild && /^https:[/][/]/.test(String(roh.bildSeite ?? '')) ? String(roh.bildSeite).trim() : '',
    score: scoreVon(roh, kontext),
    tester,
    gesponsert: roh.gesponsert === true,
    tags,
    text: normText([titel, ...tags].join(' ')),
  };
}

export function eintraegeLesen(liste, kontext = {}) {
  const gesehen = new Set();
  const out = [];
  for (const roh of Array.isArray(liste) ? liste : []) {
    const eintrag = eintragLesen(roh, kontext);
    if (!eintrag || gesehen.has(eintrag.id)) continue;
    gesehen.add(eintrag.id);
    out.push(eintrag);
  }
  return out;
}

export function hatKoordinaten(eintrag) {
  return Boolean(eintrag?.ort && Number.isFinite(eintrag.ort.lat) && Number.isFinite(eintrag.ort.lon));
}

// --- Text vergleichen -----------------------------------------------------------------------
// Klein, ohne Umlaute und Akzente, nur Buchstaben und Ziffern: „Open-Air-Kino am Bodensee" →
// „open air kino am bodensee". Darauf laufen alle Wortmuster dieser Datei (\b ist dann sicher).
export function normText(text) {
  return String(text ?? '')
    .toLowerCase()
    .replace(/ä/g, 'ae').replace(/ö/g, 'oe').replace(/ü/g, 'ue').replace(/ß/g, 'ss')
    .normalize('NFD').replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9]+/g, ' ')
    .trim();
}

// --- Zeit -----------------------------------------------------------------------------------
function tagesAnfang(ms) {
  const d = new Date(ms);
  return new Date(d.getFullYear(), d.getMonth(), d.getDate()).getTime();
}

function tagesEnde(ms) {
  const d = new Date(ms);
  return new Date(d.getFullYear(), d.getMonth(), d.getDate(), 23, 59, 59, 999).getTime();
}

// Das Wochenende, um das es gerade geht: Freitag 17 Uhr bis Sonntag Mitternacht. Von Montag bis
// Donnerstag ist das das kommende; ab Freitag das laufende — und dann zählt nur, was noch kommt.
export const WOCHENENDE_AB_STUNDE = 17;

export function wochenende(jetzt = Date.now()) {
  const ms = zeitpunkt(jetzt) ?? Date.now();
  const d = new Date(ms);
  const wochentag = d.getDay(); // 0 So … 6 Sa
  const bisFreitag = wochentag === 0 ? -2 : wochentag === 6 ? -1 : 5 - wochentag;
  const freitag = new Date(d.getFullYear(), d.getMonth(), d.getDate() + bisFreitag, WOCHENENDE_AB_STUNDE, 0, 0, 0).getTime();
  const sonntag = tagesEnde(tagesAnfang(freitag) + 2 * TAG_MS + TAG_MS / 2);
  return { von: Math.max(freitag, ms), bis: sonntag };
}

export function heute(jetzt = Date.now()) {
  const ms = zeitpunkt(jetzt) ?? Date.now();
  return { von: ms, bis: tagesEnde(ms) };
}

// Überschneidet sich der Termin eines Eintrags mit einem Zeitraum? Ohne Ende zählt der Anfang.
export function liegtIn(eintrag, raum) {
  if (!eintrag?.wann || !raum) return false;
  const ende = eintrag.wann.bis ?? eintrag.wann.von;
  return eintrag.wann.von <= raum.bis && ende >= raum.von;
}

// Vorbei ist nur, was einen Termin hat und dessen Ende hinter uns liegt. Ein Restaurant ohne
// Termin ist nie „vorbei" — die App kennt seine Öffnungszeiten nicht und behauptet keine.
export function istVorbei(eintrag, jetzt = Date.now()) {
  if (!eintrag?.wann) return false;
  const ende = eintrag.wann.bis ?? tagesEnde(eintrag.wann.von);
  return ende < (zeitpunkt(jetzt) ?? Date.now());
}

// --- Besonders statt Standard -----------------------------------------------------------------
// „Dieses Wochenende": Besonderes zum Ausgehen und unter Leute kommen — KEINE wöchentlichen
// Standard-Clubs (R8-50). Woran die App das erkennt, steht in den Tags oder im Titel.
const WOECHENTLICH = /\b(woechentlich\w*|wochentlich\w*|weekly|jede woche|jeden (montag|dienstag|mittwoch|donnerstag|freitag|samstag|sonntag)|regelmaessig\w*|stammtisch\w*|standard)\b/;

export function istWoechentlich(eintrag) {
  return WOECHENTLICH.test(eintrag?.text || '');
}

// --- Reihenfolge ------------------------------------------------------------------------------
// Nach Score, der höchste zuerst; ohne Score ans Ende; bei Gleichstand der frühere Termin, dann
// der Titel — damit die Reihenfolge bei jedem Zeichnen dieselbe ist.
export function nachScore(a, b) {
  const sa = a.score ?? -Infinity;
  const sb = b.score ?? -Infinity;
  if (sb !== sa) return sb > sa ? 1 : -1;
  const ta = a.wann?.von ?? Infinity;
  const tb = b.wann?.von ?? Infinity;
  if (ta !== tb) return ta < tb ? -1 : 1;
  return a.titel.localeCompare(b.titel, 'de');
}

// --- Anzeigen ---------------------------------------------------------------------------------
// Eine Anzeige (gesponsert) bekommt in ihrer Reihe einen festen Platz: die zweite Stelle — nie
// ganz vorn, denn der erste Platz gehört dem, was es verdient. Steht sie aus eigener Kraft schon
// weiter vorn, bleibt sie dort. Höchstens EINE Anzeige je Reihe wird so nach vorn geholt; weitere
// stehen, wo ihr Score sie hinstellt. Jede trägt sichtbar „Anzeige" (screens/find.js).
// Score und Crew-Tipp wissen davon nichts: scoreVon und crewTipps lesen `gesponsert` nie.
export const ANZEIGE_PLATZ = 1; // Index: die zweite Stelle

export function anzeigePlatzieren(liste) {
  const reihe = [...liste];
  const index = reihe.findIndex((eintrag) => eintrag.gesponsert);
  if (index <= ANZEIGE_PLATZ) return reihe;
  const [anzeige] = reihe.splice(index, 1);
  reihe.splice(ANZEIGE_PLATZ, 0, anzeige);
  return reihe;
}

// --- Crew-Tipp: das Label, das man nicht kaufen kann -------------------------------------------
// Den Tipp trägt höchstens das beste Fünftel nach Score. Er hängt an der Rangfolge, nicht an
// einer Zahl — so gilt er für jede Skala, die der Algorithmus einmal liefert. `gesponsert` wird
// hier absichtlich NICHT gelesen: Ob jemand zahlt, ändert weder den Score noch den Tipp.
// Vorbei ist vorbei — Vergangenes zählt nicht mit.
//
// Gleichstand an der Schwelle: Wer gleich gut ist, wird nicht per Zufall ausgelassen — aber ein
// Block Gleicher darf das Label auch nicht aufblähen. Gemessen am Beispielbestand: sieben
// Einträge mit Score 70 hätten „das beste Fünftel" auf zehn von siebzehn gebracht. Passt der
// ganze Block nicht mehr ins Fünftel, bekommt ihn nur, wer STRIKT darüber liegt. Liegen alle
// gleichauf, sticht niemand heraus — dann trägt ihn keiner.
export const CREW_TIPP_ANTEIL = 0.2;

export function crewTipps(eintraege, jetzt = Date.now()) {
  const mitScore = eintraege.filter((eintrag) => eintrag.score != null && !istVorbei(eintrag, jetzt));
  if (!mitScore.length) return new Set();
  const sortiert = [...mitScore].sort((a, b) => b.score - a.score);
  const anzahl = Math.max(1, Math.ceil(sortiert.length * CREW_TIPP_ANTEIL));
  const schwelle = sortiert[anzahl - 1].score;
  const mitGleichen = sortiert.filter((eintrag) => eintrag.score >= schwelle);
  const gewaehlt = mitGleichen.length <= anzahl ? mitGleichen : sortiert.filter((eintrag) => eintrag.score > schwelle);
  if (gewaehlt.length === sortiert.length && sortiert.length > 1) return new Set();
  return new Set(gewaehlt.map((eintrag) => eintrag.id));
}

// --- Die Abschnitte des Dashboards ------------------------------------------------------------
export const REIHE_MAX = 10;

function aktuell(eintraege, jetzt) {
  return eintraege.filter((eintrag) => !istVorbei(eintrag, jetzt));
}

export function diesesWochenende(eintraege, jetzt = Date.now()) {
  const raum = wochenende(jetzt);
  return anzeigePlatzieren(aktuell(eintraege, jetzt)
    .filter((eintrag) => liegtIn(eintrag, raum) && !istWoechentlich(eintrag))
    .sort(nachScore))
    .slice(0, REIHE_MAX);
}

export function besteNachArt(eintraege, art, jetzt = Date.now()) {
  const raum = wochenende(jetzt);
  return anzeigePlatzieren(aktuell(eintraege, jetzt)
    // Ein Termin dieses Wochenendes steht schon oben — zweimal dasselbe ist Lärm.
    .filter((eintrag) => eintrag.art === art && !liegtIn(eintrag, raum))
    .sort(nachScore))
    .slice(0, REIHE_MAX);
}

// Events NACH diesem Wochenende hätten sonst keinen Platz auf dem Dashboard (sie sind weder
// Restaurant noch Erlebnis und nicht „dieses Wochenende") — sie stünden nur auf der Karte.
export function demnaechst(eintraege, jetzt = Date.now()) {
  const raum = wochenende(jetzt);
  return anzeigePlatzieren(aktuell(eintraege, jetzt)
    .filter((eintrag) => eintrag.art === 'event' && eintrag.wann && !liegtIn(eintrag, raum) && eintrag.wann.von > raum.bis)
    .sort((a, b) => a.wann.von - b.wann.von || nachScore(a, b)))
    .slice(0, REIHE_MAX);
}

// --- Für dich -----------------------------------------------------------------------------------
// Ehrlich personalisiert: Nur was zu einem EIGENEN Interesse passt (settings.interests), mit
// genau diesem Interesse als Grund. Gibt es kein passendes, gibt es den Abschnitt nicht — eine
// „Für dich"-Reihe ohne Grund wäre eine Behauptung. Gemerktes steht unter „Gemerkt".
function stamm(wort) {
  for (const endung of ['ern', 'en', 'er', 'e', 'n', 's']) {
    if (wort.length - endung.length >= 4 && wort.endsWith(endung)) return wort.slice(0, -endung.length);
  }
  return wort;
}

function wortPasst(wort, tokens) {
  if (wort.length < 4) return tokens.some((token) => token === wort || (token.length > wort.length + 2 && token.endsWith(wort)));
  const kern = stamm(wort);
  return tokens.some((token) => token === wort || token.startsWith(kern) || (token.length > kern.length + 2 && token.endsWith(kern)));
}

// Passt ein Interesse („Bouldern", „Kochen draußen") zu einem Eintrag? Bei mehreren Wörtern
// müssen alle tragenden Wörter vorkommen — sonst passte „Kochen draußen" zu allem, was draußen ist.
export function interessePasst(interesse, eintrag) {
  const worte = normText(interesse).split(' ').filter((wort) => wort.length >= 3);
  if (!worte.length || !eintrag?.text) return false;
  const tragend = worte.filter((wort) => !['und', 'mit', 'der', 'die', 'das', 'den', 'dem', 'the', 'and'].includes(wort));
  if (!tragend.length) return false;
  const tokens = eintrag.text.split(' ');
  return tragend.every((wort) => wortPasst(wort, tokens));
}

export function fuerDich(eintraege, interessen, jetzt = Date.now(), gemerktIds = []) {
  const liste = (Array.isArray(interessen) ? interessen : [])
    .map((eintrag) => (typeof eintrag === 'string' ? eintrag : eintrag?.name))
    .map((name) => String(name ?? '').trim())
    .filter(Boolean);
  if (!liste.length) return [];
  const gemerkt = new Set(gemerktIds || []);
  const treffer = [];
  for (const eintrag of aktuell(eintraege, jetzt)) {
    if (gemerkt.has(eintrag.id)) continue;
    const passend = liste.filter((interesse) => interessePasst(interesse, eintrag));
    if (passend.length) treffer.push({ eintrag, gruende: passend.slice(0, 2), zahl: passend.length });
  }
  treffer.sort((a, b) => b.zahl - a.zahl || nachScore(a.eintrag, b.eintrag));
  return treffer.slice(0, REIHE_MAX);
}

// --- Das Dashboard als Ganzes -------------------------------------------------------------------
// Jeder Eintrag steht in den kuratierten Reihen höchstens EINMAL — in der ersten, die ihn nimmt,
// von oben nach unten: Dieses Wochenende · Für dich · Beste Restaurants · Beste Erlebnisse ·
// Demnächst. Gemessen am Beispielbestand stand sonst dasselbe Lokal in „Für dich" und direkt
// darunter in „Beste Restaurants" — zweimal dasselbe Bild ist Lärm, keine Auskunft.
// „Gemerkt" ist die eigene Sammlung und zeigt ALLES Gemerkte, auch wenn es oben schon steht.
// Die Anzeige-Regel (zweiter Platz) gilt je Reihe NACH dem Aussortieren.
export function dashboardAbschnitte(eintraege, { interessen = [], gemerktIds = [], jetzt = Date.now() } = {}) {
  const genommen = new Set();
  const nimm = (liste) => {
    const rest = liste.filter((eintrag) => !genommen.has(eintrag.id));
    for (const eintrag of rest) genommen.add(eintrag.id);
    return rest;
  };
  // Nach dem Aussortieren steht eine Anzeige vielleicht nicht mehr an ihrem Platz: Die Reihe wird
  // erst wieder in ihre eigene Ordnung gebracht (Score bzw. Zeit) und dann neu platziert.
  const neuPlatziert = (liste) => anzeigePlatzieren(liste).slice(0, REIHE_MAX);
  const wochenendeListe = nimm(diesesWochenende(eintraege, jetzt));
  const fuerDichTreffer = fuerDich(eintraege, interessen, jetzt, gemerktIds).filter((treffer) => !genommen.has(treffer.eintrag.id));
  for (const treffer of fuerDichTreffer) genommen.add(treffer.eintrag.id);
  const restaurants = neuPlatziert(nimm(besteNachArt(eintraege, 'restaurant', jetzt)).sort(nachScore));
  const erlebnisse = neuPlatziert(nimm(besteNachArt(eintraege, 'erlebnis', jetzt)).sort(nachScore));
  const bald = neuPlatziert(nimm(demnaechst(eintraege, jetzt)).sort((a, b) => a.wann.von - b.wann.von || nachScore(a, b)));
  return [
    { id: 'wochenende', liste: wochenendeListe },
    { id: 'fuerdich', liste: fuerDichTreffer.map((treffer) => treffer.eintrag), gruende: fuerDichTreffer.map((treffer) => treffer.gruende) },
    { id: 'restaurants', liste: restaurants },
    { id: 'erlebnisse', liste: erlebnisse },
    { id: 'demnaechst', liste: bald },
    { id: 'gemerkt', liste: gemerktListe(eintraege, gemerktIds, jetzt) },
  ];
}

// --- Gemerkt ----------------------------------------------------------------------------------
// settings.gemerktIds, das zuletzt Gemerkte zuerst. Was es nicht mehr gibt oder vorbei ist,
// steht nicht da (die Kennung bleibt gespeichert; sie schadet nicht und verrät nichts).
export function gemerktListe(eintraege, gemerktIds, jetzt = Date.now()) {
  const nachId = new Map(eintraege.map((eintrag) => [eintrag.id, eintrag]));
  return (Array.isArray(gemerktIds) ? gemerktIds : [])
    .map((id) => nachId.get(id))
    .filter((eintrag) => eintrag && !istVorbei(eintrag, jetzt));
}

export function merkenUmschalten(gemerktIds, id) {
  const liste = (Array.isArray(gemerktIds) ? gemerktIds : []).filter((wert) => typeof wert === 'string' && wert);
  return liste.includes(id) ? liste.filter((wert) => wert !== id) : [id, ...liste];
}

// --- Karte ------------------------------------------------------------------------------------
// Mehrere Einträge am selben Ort sind EINE Markierung (ui/map.js › ortMarken fächert sie auf).
export function kartenOrte(eintraege, jetzt = Date.now()) {
  const gruppen = new Map();
  for (const eintrag of aktuell(eintraege, jetzt)) {
    if (!hatKoordinaten(eintrag)) continue;
    const key = `${eintrag.ort.lat.toFixed(5)}|${eintrag.ort.lon.toFixed(5)}`;
    if (!gruppen.has(key)) gruppen.set(key, { key, lat: eintrag.ort.lat, lon: eintrag.ort.lon, eintraege: [] });
    gruppen.get(key).eintraege.push(eintrag);
  }
  const liste = [...gruppen.values()];
  for (const gruppe of liste) gruppe.eintraege.sort(nachScore);
  return liste.sort((a, b) => nachScore(a.eintraege[0], b.eintraege[0]));
}

// =============================================================================================
// DER FINDER (R8-50: „im Stil von akinator.com")
// ---------------------------------------------------------------------------------------------
// Der Mensch weiß das Wort nicht, nur sein Gefühl. Also keine Suche und keine Ja/Nein-Fragen,
// sondern wenige Fragen mit Auswahl, die Schritt für Schritt eingrenzen:
//   · Die erste Frage ist immer dieselbe (Worauf hast du Lust?) — sie steht schon auf dem
//     Dashboard, ein Tipp darauf ist die erste Antwort. Sie ist die einzige STRENGE Frage: Es
//     bleibt nur, was ausdrücklich zum Gefühl passt. Sonst stünde nach „Feiern" die Schifffahrt
//     vorn, bloß weil über sie nichts Gegenteiliges bekannt ist.
//   · Danach wählt der Finder wie Akinator die Frage, die unter den VERBLEIBENDEN Einträgen am
//     meisten entscheidet (erwartete Eingrenzung). Eine Frage, die nichts trennen würde, kommt
//     gar nicht erst — und eine Antwort, nach der nichts mehr übrig wäre, wird nicht angeboten.
//   · Schluss ist, wenn höchstens FINDER_GENUG übrig sind, FINDER_MAX Fragen gestellt wurden
//     oder keine Frage mehr etwas entscheidet.
//
// Jede Antwort-Möglichkeit sagt über einen Eintrag +1 (passt), -1 (passt nicht) oder 0 (weiß
// man nicht). Nur -1 schließt aus. „Weiß man nicht" bleibt drin und rückt nach hinten: Ein
// Eintrag, dessen Tags nichts über „drinnen" sagen, ist nicht falsch — nur unbelegt.
//
// Die Wortmuster laufen auf normText(Titel + Tags). Der Ort zählt nicht mit: ein Lokal, das
// „Club Seven" heißt, ist deshalb noch keine Party.
// =============================================================================================
export const FINDER_START = 'lust';
export const FINDER_MAX = 5;
export const FINDER_GENUG = 3;

const PASSEND_RUHIG = /\b(ruhig\w*|entspann\w*|gemuetlich\w*|chill\w*|relax\w*|wellness|spa|sauna\w*|therme\w*|kaffee\w*|cafe\w*|lesung\w*|lesen|yoga|picknick\w*|sonnenuntergang|sunset|genuss\w*|slow|meditation|park|spazier\w*|brunch|tee|aussicht\w*|\w*see|schiff\w*|natur\w*|museum|museen|kunst\w*|ausflug\w*)\b/;
const PASSEND_AKTIV = /\b(sport\w*|aktiv\w*|bewegung\w*|wander\w*|kletter\w*|boulder\w*|bike\w*|rad|radtour\w*|mountainbike\w*|lauf|laufen|run|running|jogg\w*|schwimm\w*|surf\w*|sup|stand up|paddel\w*|kajak\w*|kanu\w*|ski\w*|tennis|padel|fussball\w*|volleyball\w*|beachvolley\w*|trampolin\w*|fitness|workout|hike|hiking|trail\w*|gipfel\w*|klettersteig\w*|tanz\w*|dance)\b/;
const PASSEND_PARTY = /\b(party|partys|feier\w*|club\w*|clubbing|tanz\w*|dance|dj|rave|techno|disco|festival\w*|konzert\w*|live|live musik|livemusik|cocktail\w*|drinks?|nacht\w*|schlager)\b/;
const PASSEND_LEUTE = /\b(gesellig\w*|leute|community|pub|kneipe\w*|beisl|ausgehen|live|slam\w*|markt\w*|flohmarkt\w*|festival\w*|fest|feste|party|konzert\w*|quiz\w*|pubquiz|tanz\w*|club\w*|open air|public viewing|afterwork|after work|feier\w*|meetup|treff\w*|mitmachen)\b/;
const PASSEND_NEU = /\b(neu\w*|besonder\w*|einmalig\w*|erstmal\w*|workshop\w*|kurs\w*|tasting|verkostung\w*|degustation|fuehrung\w*|tour|touren|ausstellung\w*|museum|museen|theater\w*|kultur\w*|kunst\w*|slam\w*|geschichte|escape|vernissage|premiere\w*|pop ?up|experiment\w*|entdeck\w*|geheimtipp\w*|special|ausflug\w*|schiff\w*)\b/;
const PASSEND_ESSEN = /\b(essen|food|kulinari\w*|restaurant\w*|dinner|abendessen|brunch|fruehstueck\w*|pizza\w*|sushi|burger\w*|street ?food|tasting|verkostung\w*|degustation|wein\w*|genuss\w*|koch\w*|bistro\w*|trattoria|gasthaus|gasthof|beisl|wirtshaus|heuriger|markthalle|dessert\w*|gelato|brauerei\w*)\b/;
const PASSEND_DRAUSSEN = /\b(draussen|outdoor|open air|freiluft\w*|im freien|\w*garten\w*|\w*terrasse\w*|\w*see|seeufer|seebuehne|seepromenade|\w*park|natur\w*|aussicht\w*|schiff\w*|\w*schlucht|wander\w*|berg|berge|bergtour\w*|gipfel\w*|\w*strand\w*|\w*ufer|rooftop|alm\w*|\w*huette\w*|\w*wald\w*|sup|kajak\w*|kanu\w*|radtour\w*|bike\w*|hike|picknick\w*|sonnenuntergang|sunset|flohmarkt\w*|festival\w*)\b/;
// „bar" nur als Wort oder in den üblichen Zusammensetzungen — sonst wäre „wunderbar" ein Lokal.
const PASSEND_DRINNEN = /\b(drinnen|indoor|halle\w*|\w+halle|saal|\w*kino|museum|kunsthaus|theater\w*|club\w*|keller\w*|(cocktail|wein|sky|tapas|kaffee|espresso|sport|karaoke|jazz|piano|hotel)?bar|bars|therme\w*|spa|escape\w*|bowling|billard|lounge|cafe\w*)\b/;
// Was ausdrücklich draußen ist, ist nie drinnen — auch wenn „Kino" im Titel steht (Open-Air-Kino).
const NIE_DRINNEN = /\b(draussen|outdoor|open air|freiluft\w*|im freien)\b/;
const NIE_DRAUSSEN = /\b(drinnen|indoor)\b/;
const PASSEND_ZWEIT = /\b(zu zweit|date|paar\w*|romanti\w*|zweisam\w*|candle ?light\w*|intim\w*|fuer zwei)\b/;
const PASSEND_RUNDE = /\b(runde|freunde|kleine gruppe|kleingruppe|gruppe\w*|gemeinsam\w*|spiele\w*|brettspiel\w*|escape|quiz\w*|bowling|billard|dart)\b/;
const PASSEND_VIELE = /\b(grosse gruppe|grossgruppe\w*|gruppe\w*|viele|festival\w*|party|fest|open air|markt\w*|public viewing|team\w*|stadion|konzert\w*|feier\w*)\b/;
const PASSEND_GRATIS = /\b(gratis|kostenlos\w*|eintritt frei|freier eintritt|free entry|umsonst|spende\w*)\b/;
const PASSEND_GUENSTIG = /\b(guenstig\w*|billig\w*|preiswert\w*|gratis|kostenlos\w*|eintritt frei|freier eintritt|umsonst|budget|street ?food|imbiss\w*|happy hour|studenten\w*)\b/;
const PASSEND_GEHOBEN = /\b(gehoben\w*|fine dining|premium|luxus\w*|haube\w*|michelin|degustation|gourmet\w*|exklusiv\w*)\b/;
const KOSTET = /\b(teuer\w*|gehoben\w*|fine dining|premium|luxus\w*|haube\w*|michelin|degustation|gourmet\w*|eintritt|ticket\w*)\b/;

// Eine Antwort-Möglichkeit: `plus`/`minus` sind Wortmuster, `nie` schlägt alles (ein ausdrückliches
// „draußen" ist nie „drinnen"), `arten` passen immer, `artenGegen` passen nie, `streng` heißt „was
// nicht ausdrücklich passt, passt nicht", `pruefe` rechnet selbst (Zeit).
export const FINDER_FRAGEN = Object.freeze([
  {
    id: 'lust',
    mehrfach: true,
    optionen: [
      { streng: true, id: 'runterkommen', plus: PASSEND_RUHIG, minus: /\b(party|club\w*|rave|techno|laut|workout|marathon|fitness|bootcamp|clubbing|disco)\b/ },
      { streng: true, id: 'leute', plus: PASSEND_LEUTE, arten: ['event'], minus: /\b(zu zweit|date|romanti\w*|allein|privat|zweisam\w*|intim\w*)\b/ },
      { streng: true, id: 'auspowern', plus: PASSEND_AKTIV, minus: /\b(ruhig\w*|entspann\w*|gemuetlich\w*|chill\w*|wellness|spa|sauna\w*|kino|lesung\w*|museum|ausstellung\w*|dinner)\b/, artenGegen: ['restaurant'] },
      { streng: true, id: 'neues', plus: PASSEND_NEU, arten: ['erlebnis'], minus: WOECHENTLICH },
      { streng: true, id: 'feiern', plus: PASSEND_PARTY, minus: /\b(ruhig\w*|wellness|spa|sauna\w*|fruehstueck\w*|brunch|kinder\w*|familie\w*|museum|lesung\w*)\b/ },
      { id: 'essen', plus: PASSEND_ESSEN, arten: ['restaurant'], streng: true },
    ],
  },
  {
    id: 'wo',
    optionen: [
      { id: 'draussen', nie: NIE_DRAUSSEN, plus: PASSEND_DRAUSSEN, minus: PASSEND_DRINNEN },
      { id: 'drinnen', nie: NIE_DRINNEN, plus: PASSEND_DRINNEN, arten: ['restaurant'], minus: /\b(wander\w*|gipfel\w*|\w*strand\w*|seeufer|alm\w*|picknick\w*|sup|kajak\w*|kanu\w*|radtour\w*|hike)\b/ },
    ],
  },
  {
    id: 'energie',
    optionen: [
      { id: 'wenig', plus: PASSEND_RUHIG, arten: ['restaurant'], minus: PASSEND_AKTIV },
      { id: 'viel', plus: PASSEND_AKTIV, minus: PASSEND_RUHIG, artenGegen: ['restaurant'] },
    ],
  },
  {
    id: 'anzahl',
    optionen: [
      { id: 'zweit', plus: PASSEND_ZWEIT, minus: /\b(grossgruppe\w*|grosse gruppe|team\w*|firmen\w*|stadion)\b/ },
      { id: 'runde', plus: PASSEND_RUNDE, minus: /\b(stadion|grossveranstaltung\w*)\b/ },
      { id: 'viele', plus: PASSEND_VIELE, minus: /\b(zu zweit|date|romanti\w*|intim\w*|zweisam\w*|candle ?light\w*)\b/ },
    ],
  },
  {
    id: 'budget',
    optionen: [
      { id: 'nichts', plus: PASSEND_GRATIS, minus: KOSTET, artenGegen: ['restaurant'] },
      { id: 'wenig', plus: PASSEND_GUENSTIG, minus: PASSEND_GEHOBEN },
      { id: 'mehr', plus: PASSEND_GEHOBEN },
    ],
  },
  {
    id: 'wann',
    optionen: [
      { id: 'heute', pruefe: (eintrag, jetzt) => (eintrag.wann ? (liegtIn(eintrag, heute(jetzt)) ? 1 : -1) : 0) },
      { id: 'wochenende', pruefe: (eintrag, jetzt) => (eintrag.wann ? (liegtIn(eintrag, wochenende(jetzt)) ? 1 : -1) : 0) },
    ],
  },
  {
    id: 'was',
    mehrfach: true,
    zuletzt: true,
    optionen: [
      { id: 'event', arten: ['event'], streng: true },
      { id: 'restaurant', arten: ['restaurant'], streng: true },
      { id: 'erlebnis', arten: ['erlebnis'], streng: true },
    ],
  },
]);

export function finderFrage(id) {
  return FINDER_FRAGEN.find((frage) => frage.id === id) || null;
}

// +1 passt · 0 weiß man nicht · -1 passt nicht
export function lage(eintrag, option, jetzt = Date.now()) {
  if (!eintrag || !option) return 0;
  if (typeof option.pruefe === 'function') return option.pruefe(eintrag, zeitpunkt(jetzt) ?? Date.now());
  const text = eintrag.text || '';
  if (option.nie?.test(text)) return -1;
  if (option.arten?.includes(eintrag.art)) return 1;
  // Beide Seiten können zutreffen („Sunset-SUP": Sonnenuntergang ist ruhig, SUP ist aktiv). Dann
  // entscheidet, welche Seite MEHR Belege hat; bei Gleichstand weiß man es nicht (0).
  const dafuer = belege(option.plus, text);
  const dagegen = belege(option.minus, text);
  if (dafuer > dagegen) return 1;
  if (option.streng) return -1;
  if (option.artenGegen?.includes(eintrag.art)) return -1;
  if (dagegen > dafuer) return -1;
  return 0;
}

// Wie viele verschiedene Wörter eines Musters im Text stehen.
const GLOBAL = new WeakMap();
function belege(muster, text) {
  if (!muster || !text) return 0;
  if (!GLOBAL.has(muster)) GLOBAL.set(muster, new RegExp(muster.source, 'g'));
  return new Set(text.match(GLOBAL.get(muster)) || []).size;
}

// Eine Antwort über mehrere Möglichkeiten (Mehrfachauswahl): Es reicht, wenn EINE passt; aus
// ist ein Eintrag nur, wenn ALLE gewählten nicht passen. Keine Wahl („Egal") sagt nichts.
function urteil(eintrag, frage, gewaehlt, jetzt) {
  const optionen = (frage?.optionen || []).filter((option) => gewaehlt.includes(option.id));
  if (!optionen.length) return 0;
  const werte = optionen.map((option) => lage(eintrag, option, jetzt));
  if (werte.includes(1)) return 1;
  if (werte.every((wert) => wert === -1)) return -1;
  return 0;
}

// antworten: [{ frage:'lust', optionen:['runterkommen', …] }] — eine leere Liste heißt „Egal".
export function finderKandidaten(eintraege, antworten = [], jetzt = Date.now()) {
  const kandidaten = [];
  for (const eintrag of aktuell(eintraege, jetzt)) {
    let treffer = 0;
    let raus = false;
    for (const antwort of antworten) {
      const wert = urteil(eintrag, finderFrage(antwort.frage), antwort.optionen || [], jetzt);
      if (wert === -1) { raus = true; break; }
      treffer += wert;
    }
    if (!raus) kandidaten.push({ eintrag, treffer });
  }
  // Wer öfter ausdrücklich passt, steht vorn; dann entscheidet der Score. Anzeigen werden im
  // Finder NICHT nach vorn geholt — hier zählt nur, was zum Gefühl passt.
  return kandidaten.sort((a, b) => b.treffer - a.treffer || nachScore(a.eintrag, b.eintrag));
}

// Welche Möglichkeiten einer Frage lohnen sich? Nur die, nach denen noch etwas übrig bliebe.
export function finderOptionen(frage, kandidaten, jetzt = Date.now()) {
  if (!frage) return [];
  return frage.optionen
    .map((option) => {
      let rest = 0;
      let passt = 0;
      for (const { eintrag } of kandidaten) {
        const wert = lage(eintrag, option, jetzt);
        if (wert >= 0) rest += 1;
        if (wert === 1) passt += 1;
      }
      return { id: option.id, rest, passt };
    })
    .filter((option) => option.rest > 0);
}

// Wie viel entscheidet eine Frage unter den verbleibenden Einträgen? Gezählt wird, was eine
// Antwort im Mittel ausschließt, dazu ein kleiner Anteil für das, was sie bestätigt (das ordnet
// die Liste, auch wenn nichts wegfällt). Eine Frage mit weniger als zwei sinnvollen Antworten
// entscheidet nichts.
function wertDerFrage(frage, kandidaten, jetzt) {
  const optionen = finderOptionen(frage, kandidaten, jetzt);
  if (optionen.length < 2) return 0;
  const n = kandidaten.length;
  const summe = optionen.reduce((wert, option) => wert + (n - option.rest) + 0.3 * option.passt, 0);
  return summe / optionen.length;
}

export const FINDER_MINDESTWERT = 0.5;

export function finderStand(eintraege, antworten = [], jetzt = Date.now()) {
  const kandidaten = finderKandidaten(eintraege, antworten, jetzt);
  const gefragt = new Set(antworten.map((antwort) => antwort.frage));
  let naechste = null;
  if (!gefragt.has(FINDER_START)) {
    naechste = finderFrage(FINDER_START);
  } else if (kandidaten.length > FINDER_GENUG && gefragt.size < FINDER_MAX) {
    // Zwei Durchgänge: zuerst die Fragen nach Gefühl und Umständen; die Kategorie-Frage (zuletzt)
    // nur, wenn keine von ihnen mehr etwas entscheidet. Bei Gleichstand gewinnt die frühere Frage
    // der Liste — die Reihenfolge ist die Absicht.
    for (const spaeter of [false, true]) {
      let bester = FINDER_MINDESTWERT;
      for (const frage of FINDER_FRAGEN) {
        if (gefragt.has(frage.id) || Boolean(frage.zuletzt) !== spaeter) continue;
        const wert = wertDerFrage(frage, kandidaten, jetzt);
        if (wert > bester + 1e-9) { bester = wert; naechste = frage; }
      }
      if (naechste) break;
    }
  }
  return {
    kandidaten,
    frage: naechste,
    optionen: naechste ? finderOptionen(naechste, kandidaten, jetzt) : [],
    fertig: !naechste,
  };
}
