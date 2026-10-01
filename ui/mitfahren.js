// Runde 8 (R8-27) — ANREISE: Wer fährt, wen holt er ab, und wann steht er wo?
//
// Jonathan: „Anreise: alter Block weg → Knopf ‚Anreise planen'. ‚Ich fahre' (wen nehme ich mit) /
// ‚Ich brauche eine Mitfahrt' (Anfrage). Karte: wen ich abholen kann; Tipp auf Person → Route
// ich → Person → Treffpunkt mit Zeit; weitere Personen reihen sich ein; Vorschlag, wer auf dem Weg
// liegt. Abgeholt wird am AKTUELLEN Standort der Person."
//
// Was sich gegenüber Runde 5–7 geändert hat — und warum:
//   · Der aufklappbare Block mit fünf Anreise-Arten (Auto · Öffi · Rad · Zu Fuß · Mitfahrt), Platz-
//     Regler, Auto-Karten, Zuordnungs-Vorschlag und Sammelzeilen ist WEG — im Raum und in den
//     Meet-Details. Er beantwortete zehn Fragen gleichzeitig und keine davon zuerst.
//   · An seiner Stelle steht EIN Knopf (anreiseKnopf). Er sagt in einer Zeile, wie es um die eigene
//     Anreise steht („Anreise planen", „Du fährst · Mira", „Mira holt dich ab") und rechts, ob
//     jemand eine Mitfahrt sucht. Ein Tipp öffnet die Seite „Anreise" (Route 'meet.anreise').
//   · Dort gibt es genau zwei Wege: „Ich fahre" und „Ich brauche eine Mitfahrt".
//       Ich fahre → eine Karte mit mir, dem Treffpunkt und allen, die eine Mitfahrt suchen — an
//       ihrem AKTUELLEN geteilten Standort (repo.getLage). Ein Tipp auf eine Person nimmt sie mit:
//       die Route ich → Person → Treffpunkt steht sofort da, mit Uhrzeiten. Jede weitere Person
//       reiht sich an der günstigsten Stelle ein (dieselbe gierige Einfügung wie seit Runde 5).
//       Wer auf dem Weg liegt (höchstens AUF_DEM_WEG_MIN Minuten Umweg), steht oben und grün.
//       „In Google Maps öffnen" übergibt die Route mit allen Zwischenstopps.
//       Ich brauche eine Mitfahrt → die Anfrage steht bei allen Fahrern auf der Karte. Wer schon
//       fährt und Platz hat, steht darunter („Einsteigen" — eine Handlung weniger).
//   · Routen rechnet web/ui/route.js: angemeldet echte Straßen (repo.routeFragen → Supabase-Funktion
//     `route` → OpenRouteService), sonst ehrlich geschätzt (gestrichelt, „geschätzt" daneben).
//   · Runde 11 (C3): Fahren mehrere (2–4 und mehr), sehen ALLE die Karte mit JEDER Route — je Fahrer
//     seine Route über die Mitfahrenden zum Treffpunkt, jede in eigener Farbe, dazu eine Zeile je
//     Fahrt (wen er abholt, wie lange, wie weit). Egal ob man selbst fährt, mitfährt oder noch
//     nichts gewählt hat: Wer kommt wie hin, ist eine Frage aller.
//   · Wen man abholen kann, sind die, die eine Mitfahrt ANGEFRAGT haben. Bewusst nicht „alle, die
//     kommen": Wer jemanden ungefragt einlädt und wieder auslädt, hinterließe in den Daten eine
//     Anfrage, die die Person nie gestellt hat (Hausregel 8 — keine erfundenen Aussagen über Menschen).
//
//   · Routen speichern (Auftrag AUFTRAG_ROUTEN_SPEICHER.md): Wer mitfährt, wird an seiner ABHOLADRESSE abgeholt (Profil,
//     freiwillig; sie sieht nur der Fahrer, bei dem man mitfährt). Nur wer ausdrücklich „Von meinem aktuellen Standort“
//     wählt, wird am Live-Standort abgeholt. Ohne Adresse und ohne diese Wahl steht ehrlich „ohne Standort“ da — die App
//     nimmt nicht ungefragt den Standort. Wer NUR eine Mitfahrt sucht (bei niemandem eingestiegen), erscheint dem Fahrer
//     weiter an seinem geteilten Standort: Seine Adresse sieht noch niemand.
//
// Datenwege — unverändert (Datenvertrag): repo.getRides · repo.setAnreise (setRide für Altaufrufer)
// · repo.assignRide · repo.getLage · neu: repo.getAbholort · repo.setAbholung · repo.getAbholadresse.
//
// API (verbindlich):
//   mitfahrenMoeglich(meet)                 → boolean: nicht bei Entwurf, abgeschlossen, abgesagt.
//   mitfahrStand(repo, meet)                → Ansichtsmodell aus repo.getRides / repo.getLage:
//     { meetId, creatorId, ziel, fahrer:[{ id, plaetze, mitfahrer, frei, lage, ohneLage, geordnet,
//       routeStopps, reihenfolge, umwegKm }], suchen, selbst, lagen:Map, zuordnung:Map, anreisen:Map,
//       rolleVon(id), meine:{ rolle, art, plaetze, fahrerId, abgesagt, lage } }
//   anreiseKnopf(ctx, meet, options?)       → html. Der eine Knopf (options.kompakt im Raum-Panel).
//   anreiseAktionen(ctx, meet)              → Handler 'anreise-oeffnen' (steckt in bindMeetPanels).
//   renderAnreise(ctx)                      → { html, bind } der Seite 'meet.anreise' (params.meetId).
//   alleFahrten(repo, meet, optionen?)      → je Fahrer seine Route (Runde 11, C3):
//     [{ fahrerId, farbe:{ token, rueckfall }, start, stopps:[{ id, lage }], ohneLage, punkte, route, zeiten,
//        mitfahrer, frei }]  — optionen.stand, optionen.plan (die eigene Fahrt wie auf der Fahrerseite).
//   anreisePlan(repo, meet, optionen?)      → das Rechenmodell der Fahrerseite (ohne DOM, für Prüfläufe):
//     { start, startQuelle, ziel, stopps:[{ id, lage }], ohneLage:[id], punkte, route, zeiten,
//       kandidaten:[{ id, lage, umwegMin, aufDemWeg }], platz:{ plaetze, belegt } }
//   wegKm · minutenFuerKm · besteEinfuegung · abholReihenfolge   (reine Rechnung, seit Runde 5)
//   standardPlaetze(repo)                   → Plätze für Mitfahrer: eigene Auto-Ressource − 1, sonst 4.
//   mitfahrtAusChat(ctx, meetId, { art, autorId, plaetze? }) → { ok, reason? } (Chat-Erkennung, room.js)
//   mitfahrtSchonErfasst(repo, meetId, { art, autorId })     → boolean
//   mitfahrMeldung(ergebnis, name?)         → Toast-Text zu einem Ergebnis ('' wenn nichts zu sagen ist).

import { esc, bindActions, rueckmeldung } from '../core/html.js';
import { ME } from '../data/ids.js';
import { personAvatar, personMarker, screenScaffold, sheet, meetKachel } from './components.js';
import { backArrow } from './icons.js';
import { ressourcenIconKey, ressourcenIconSvg } from './activity-icons.js';
import { entfernungKm, hatLage } from '../core/entfernung.js';
import { t, tn, tk, zahl } from '../core/sprache.js';
import {
  now, isToday, isTomorrow, weekdayShort, tagMonatKurz, fromISODate, zeitText,
} from '../core/dates.js';
import { rolleAusAnreise } from '../data/projections.js';
import {
  UMWEG_FAKTOR, KMH, routeBerechnen, routeSchaetzen, routeGemerkt, reihenfolgeGemerkt, googleMapsUrl,
} from './route.js';
import { karteHalten, karteVon, ladeMapLibre, passeAufPunkte } from './map.js';

export { UMWEG_FAKTOR, KMH };

const FONT = "'Instrument Sans',sans-serif";
const TITEL_FONT = "'Bricolage Grotesque',sans-serif";
const PLAETZE_MIN = 1;
const PLAETZE_MAX = 8;
// Ohne eigene Auto-Ressource mit Kapazität: ein gewöhnliches Auto hat fünf Sitze, einer fährt.
const PLAETZE_OHNE_KAPAZITAET = 4;
// Bis hierher (gerundete Minuten Umweg) liegt jemand „auf dem Weg" — die App schlägt ihn vor.
export const AUF_DEM_WEG_MIN = 5;
// Einsteigen braucht Zeit: je Abholung zwei Minuten, damit die Uhrzeiten nicht zu knapp sind.
export const PAUSE_JE_ABHOLUNG_MIN = 2;

const begrenzt = (wert) => Math.min(PLAETZE_MAX, Math.max(PLAETZE_MIN, Math.round(Number(wert) || PLAETZE_MIN)));
const danach = (wert, weiter) => (wert && typeof wert.then === 'function' ? wert.then(weiter) : weiter(wert));

// --- Rechnung (seit Runde 5) ------------------------------------------------------------------

export function wegKm(a, b) {
  const km = entfernungKm(a, b);
  return km == null ? null : km * UMWEG_FAKTOR;
}

export function minutenFuerKm(km) {
  return ((Number(km) || 0) / KMH) * 60;
}

function routenLaenge(start, stopps, ziel) {
  let summe = 0;
  let vorher = start;
  for (const stopp of stopps) {
    summe += wegKm(vorher, stopp.lage);
    vorher = stopp.lage;
  }
  return summe + wegKm(vorher, ziel);
}

// Die billigste Stelle, an der `lage` in die Route start → stopps → ziel passt.
export function besteEinfuegung(start, stopps, ziel, lage) {
  const punkte = [start, ...stopps.map((stopp) => stopp.lage), ziel];
  let beste = null;
  for (let i = 0; i < punkte.length - 1; i += 1) {
    const kosten = wegKm(punkte[i], lage) + wegKm(lage, punkte[i + 1]) - wegKm(punkte[i], punkte[i + 1]);
    if (!beste || kosten < beste.kosten - 1e-9) beste = { index: i, kosten };
  }
  return beste;
}

// Reihenfolge der Abholungen — jede weitere Person reiht sich an der günstigsten Stelle ein.
export function abholReihenfolge(start, ziel, stopps = []) {
  if (!hatLage(start) || !hatLage(ziel)) return null;
  const offen = stopps.filter((stopp) => hatLage(stopp.lage));
  const route = [];
  while (offen.length) {
    let wahl = null;
    offen.forEach((stopp, nr) => {
      const einfuegung = besteEinfuegung(start, route, ziel, stopp.lage);
      if (!wahl || einfuegung.kosten < wahl.kosten - 1e-9) wahl = { ...einfuegung, nr };
    });
    route.splice(wahl.index, 0, offen[wahl.nr]);
    offen.splice(wahl.nr, 1);
  }
  // Hat der Routen-Dienst schon nach echter Fahrzeit gerechnet (Runde 12), gilt seine Reihenfolge —
  // die Luftlinie kennt weder Einbahnstraßen noch den See noch die Auffahrt zur Autobahn.
  const echt = route.length > 1 ? reihenfolgeGemerkt(start, ziel, route) : null;
  const reihe = echt || route;
  const direktKm = wegKm(start, ziel);
  const laengeKm = routenLaenge(start, reihe, ziel);
  return { stopps: reihe, umwegKm: Math.max(0, laengeKm - direktKm), laengeKm, direktKm, nachFahrzeit: Boolean(echt) };
}

// --- Daten ------------------------------------------------------------------------------------

const hatDaten = (repo) => typeof repo?.getRides === 'function'
  && typeof repo?.setRide === 'function'
  && typeof repo?.assignRide === 'function';

export function mitfahrenMoeglich(meet) {
  return Boolean(meet) && meet.status !== 'draft' && meet.status !== 'done' && !meet.cancelled;
}

export function standardPlaetze(repo) {
  let ich = null;
  try { ich = repo?.getMe?.() || null; } catch { ich = null; }
  const meta = ich?.resourceMeta || {};
  // Ein Auto erkennt die App an seinem Zeichen — „Auto", „Bus", „Van", „Kombi" oder ein selbst
  // gewähltes Auto-Zeichen, in jeder Sprache gleich.
  const kapazitaeten = (ich?.resources || [])
    .filter((name) => ressourcenIconKey(name, meta[name]?.icon || null) === 'auto')
    .map((name) => Number(meta[name]?.capacity) || 0)
    .filter((wert) => wert > 1);
  if (!kapazitaeten.length) return PLAETZE_OHNE_KAPAZITAET;
  return begrenzt(Math.max(...kapazitaeten) - 1);
}

function lageVon(repo, personId) {
  try {
    const lage = typeof repo?.getLage === 'function' ? repo.getLage(personId) : null;
    return hatLage(lage) ? lage : null;
  } catch {
    return null;
  }
}

// Wo wird jemand für dieses Meet abgeholt? Am Live-Standort nur, wenn die Person das ausdrücklich gewählt hat; sonst an ihrer
// Abholadresse. Ohne beides: keine Lage. (Ein Datenweg ohne getAbholort fällt auf den geteilten Standort zurück.)
function abholLageVon(repo, meetId, personId) {
  try {
    const punkt = typeof repo?.getAbholort === 'function' ? repo.getAbholort(meetId, personId) : repo?.getLage?.(personId);
    return hatLage(punkt) ? punkt : null;
  } catch {
    return null;
  }
}

export function mitfahrStand(repo, meet) {
  const leer = { fahrer: [], suchen: [], selbst: [] };
  let roh = leer;
  try {
    roh = (meet && typeof repo?.getRides === 'function' ? repo.getRides(meet.id) : null) || leer;
  } catch {
    roh = leer;
  }
  const teilnahme = meet?.participation || {};
  const personen = new Map();
  const person = (id) => {
    if (!personen.has(id)) {
      let gefunden = null;
      try { gefunden = id === ME ? (repo.getMe?.() || { id: ME }) : (repo.getPerson(id) || null); } catch { gefunden = null; }
      personen.set(id, gefunden);
    }
    return personen.get(id);
  };
  // Wer abgesagt hat oder nicht (mehr) sichtbar ist (blockiert), fährt in dieser Ansicht nicht mit.
  const dabei = (id) => teilnahme[id] !== 'no' && Boolean(person(id));

  const zuordnung = new Map();
  const fahrer = [];
  const freigestellt = [];
  for (const eintrag of roh.fahrer || []) {
    const mitfahrer = (eintrag.mitfahrer || []).filter(dabei);
    if (!dabei(eintrag.personId)) {
      // Ein Fahrer hat abgesagt: seine Mitfahrer suchen in der Ansicht wieder.
      freigestellt.push(...mitfahrer);
      continue;
    }
    mitfahrer.forEach((id) => zuordnung.set(id, eintrag.personId));
    const plaetze = Math.max(Number(eintrag.plaetze) || PLAETZE_MIN, mitfahrer.length);
    fahrer.push({ id: eintrag.personId, plaetze, mitfahrer, frei: Math.max(0, plaetze - mitfahrer.length), lage: lageVon(repo, eintrag.personId) });
  }
  // Das eigene Auto steht oben — dort sind die eigenen Knöpfe.
  fahrer.sort((a, b) => (a.id === ME ? -1 : 0) - (b.id === ME ? -1 : 0));

  const fahrerIds = new Set(fahrer.map((auto) => auto.id));
  const ohneAuto = (id) => dabei(id) && !zuordnung.has(id) && !fahrerIds.has(id);
  const suchen = [...new Set([...(roh.suchen || []), ...freigestellt])].filter(ohneAuto);
  const selbst = [...new Set(roh.selbst || [])].filter((id) => ohneAuto(id) && !suchen.includes(id));

  const ziel = meet && !meet.placePending && hatLage(meet.place)
    ? { lat: meet.place.lat, lon: meet.place.lon, name: meet.place.name || '' }
    : null;

  for (const auto of fahrer) {
    const stopps = auto.mitfahrer.map((id) => ({ id, lage: abholLageVon(repo, meet.id, id) }));
    auto.ohneLage = stopps.filter((stopp) => !stopp.lage).map((stopp) => stopp.id);
    const mitLage = stopps.filter((stopp) => stopp.lage);
    const route = ziel && auto.lage ? abholReihenfolge(auto.lage, ziel, mitLage) : null;
    auto.geordnet = Boolean(route);
    auto.routeStopps = route ? route.stopps : mitLage;
    auto.reihenfolge = auto.routeStopps.map((stopp) => stopp.id);
    auto.umwegKm = route && route.stopps.length ? route.umwegKm : null;
  }

  const lagen = new Map(suchen.map((id) => [id, lageVon(repo, id)]));
  const anreisen = new Map();
  for (const eintrag of roh.anreisen || []) {
    if (dabei(eintrag.personId)) anreisen.set(eintrag.personId, eintrag);
  }
  const meineAnreise = anreisen.get(ME) || null;

  const rolleVon = (id) => {
    if (fahrerIds.has(id)) return 'fahrer';
    if (zuordnung.has(id) || suchen.includes(id)) return 'mitfahrer';
    if (selbst.includes(id)) return 'selbst';
    return null;
  };
  return {
    meetId: meet?.id || null,
    creatorId: meet?.creatorId || null,
    ziel,
    fahrer,
    suchen,
    selbst,
    lagen,
    zuordnung,
    anreisen,
    rolleVon,
    meine: {
      rolle: rolleVon(ME),
      art: meineAnreise?.art || null,
      // 'auto' OHNE Plätze heißt: ich fahre, biete aber nichts an (Altbestand aus Runde 7).
      plaetze: meineAnreise?.art === 'auto' ? (Number(meineAnreise.plaetze) || 0) : 0,
      fahrerId: zuordnung.get(ME) || null,
      // 'standort' = ich habe gewählt, vom aktuellen Standort abgeholt zu werden; sonst gilt meine Abholadresse.
      abholung: meineAnreise?.abholung === 'standort' ? 'standort' : 'adresse',
      abgesagt: teilnahme[ME] === 'no',
      lage: lageVon(repo, ME),
    },
  };
}

// --- Namen, Zeiten, kleine Bausteine -----------------------------------------------------------

function nameVon(repo, id) {
  if (id === ME) return t('Du');
  try { return repo.getPerson(id)?.name || t('Jemand'); } catch { return t('Jemand'); }
}

function namenListe(repo, ids, ich = null) {
  const namen = ids.map((id) => (id === ME && ich ? ich : nameVon(repo, id)));
  const und = tk('und', 'Aufzählung');
  if (namen.length <= 2) return namen.join(` ${und} `);
  return `${namen.slice(0, -1).join(', ')} ${und} ${namen[namen.length - 1]}`;
}

function datumText(iso) {
  if (!iso) return '';
  if (isToday(iso)) return t('Heute');
  if (isTomorrow(iso)) return t('Morgen');
  return `${weekdayShort(iso)} ${tagMonatKurz(fromISODate(iso))}`;
}

function uhr(datum) {
  return `${String(datum.getHours()).padStart(2, '0')}:${String(datum.getMinutes()).padStart(2, '0')}`;
}

const minutenText = (min) => {
  const gerundet = Math.max(1, Math.round(Number(min) || 0));
  if (gerundet < 60) return t('{n} Min', { n: gerundet });
  const stunden = Math.floor(gerundet / 60);
  const rest = gerundet % 60;
  return rest ? t('{h} Std {m} Min', { h: stunden, m: rest }) : t('{n} Std', { n: stunden });
};

const kmText = (meter) => `${zahl((Number(meter) || 0) / 1000, (Number(meter) || 0) < 10000 ? 1 : 0)} km`;

function gesicht(repo, settings, id, size) {
  let person = null;
  try { person = id === ME ? repo.getMe?.() : repo.getPerson(id); } catch { person = null; }
  if (!person) return '';
  return personAvatar(person, {
    size, marker: personMarker(person.id, settings), active: false, free: false, compact: size < 26,
  });
}

const autoGlyph = (farbe = 'var(--ink)', size = 16) => ressourcenIconSvg('Auto', farbe, size, 'auto');
// Wer eine Mitfahrt braucht, steht am Weg und hebt die Hand — kein Auto, sondern eine Bitte.
const handGlyph = (farbe = 'var(--ink)', size = 16) => `<svg width="${size}" height="${size}" viewBox="0 0 24 24" fill="none" style="display:block;flex:none"><circle cx="9.4" cy="4.8" r="2.1" stroke="${farbe}" stroke-width="1.8"></circle><path d="M9.4 8.6v6.2M6.6 20.6l2.8-5.8 2.8 5.8M9.4 10.6l5.4-4.2" stroke="${farbe}" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"></path></svg>`;
const routeGlyph = (farbe = 'var(--ink)', size = 15) => `<svg width="${size}" height="${size}" viewBox="0 0 24 24" fill="none" style="display:block;flex:none"><path d="M6 19h9a3.5 3.5 0 0 0 0-7H9a3.5 3.5 0 0 1 0-7h9" stroke="${farbe}" stroke-width="1.8" stroke-linecap="round"></path><circle cx="4.5" cy="19" r="1.8" fill="${farbe}"></circle><circle cx="19.5" cy="5" r="1.8" fill="${farbe}"></circle></svg>`;
const pfeilRechts = (farbe = 'var(--line-strong)') => `<svg width="15" height="15" viewBox="0 0 24 24" fill="none" style="display:block;flex:none"><path d="m9.5 6 6 6-6 6" stroke="${farbe}" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"></path></svg>`;
const hakenGlyph = (farbe = 'var(--on-accent)', size = 12) => `<svg width="${size}" height="${size}" viewBox="0 0 24 24" fill="none" style="display:block;flex:none"><path d="m6 12.5 4 4 8-9" stroke="${farbe}" stroke-width="2.8" stroke-linecap="round" stroke-linejoin="round"></path></svg>`;
const pinGlyph = (farbe = 'var(--green-dark)', size = 14) => `<svg width="${size}" height="${size}" viewBox="0 0 24 24" fill="none" style="display:block;flex:none"><path d="M12 21.5s7-6.1 7-11a7 7 0 1 0-14 0c0 4.9 7 11 7 11Z" stroke="${farbe}" stroke-width="2" stroke-linejoin="round"></path><circle cx="12" cy="10.5" r="2.4" fill="${farbe}"></circle></svg>`;

// Eine Pille in einer 44 px hohen Trefferfläche.
function pille(act, label, options = {}) {
  const gruen = options.ton === 'gruen';
  const an = options.ton === 'an';
  const look = an
    ? 'background:var(--green);color:var(--on-accent)'
    : (gruen ? 'background:var(--green-tint);color:var(--green-dark);box-shadow:inset 0 0 0 1px var(--green-a30)' : 'background:var(--field);color:var(--ink)');
  const daten = Object.entries(options.daten || {}).map(([key, wert]) => ` data-${key}="${esc(wert)}"`).join('');
  const aria = options.aria ? ` aria-label="${esc(options.aria)}"` : '';
  const gedrueckt = options.gedrueckt === undefined ? '' : ` aria-pressed="${options.gedrueckt}"`;
  return `<button data-act="${act}"${daten}${aria}${gedrueckt} style="min-height:44px;min-width:44px;border:0;background:transparent;padding:0;display:flex;align-items:center;justify-content:center;flex:none;cursor:pointer;appearance:none;font-family:${FONT}"><span style="pointer-events:none;display:flex;align-items:center;gap:5px;height:32px;padding:0 13px;border-radius:999px;${look};font:650 12.5px/1 ${FONT};white-space:nowrap">${an ? hakenGlyph('var(--on-accent)', 12) : ''}${esc(label)}</span></button>`;
}

const kapitel = (text, farbe = 'var(--muted-light)') => `<span style="display:block;font-size:11px;font-weight:650;letter-spacing:.09em;text-transform:uppercase;color:${farbe};padding:0 2px 6px">${esc(text)}</span>`;
const karteStil = 'background:var(--surface);border:1px solid var(--ink-a10);border-radius:20px';

// --- Der eine Knopf („Anreise planen") ----------------------------------------------------------

function anreiseStatus(repo, stand) {
  const suchende = stand.suchen.filter((id) => id !== ME);
  const andereFahrer = stand.fahrer.filter((auto) => auto.id !== ME);
  const suchenText = suchende.length ? { text: tn(suchende.length, '{n} sucht', '{n} suchen'), farbe: 'var(--orange-dark)' } : null;
  if (stand.meine.rolle === 'fahrer' || stand.meine.art === 'auto') {
    const mein = stand.fahrer.find((auto) => auto.id === ME);
    const mit = mein?.mitfahrer.length ? ` · ${namenListe(repo, mein.mitfahrer)}` : '';
    return { art: 'fahrer', text: `${t('Du fährst')}${mit}`, zusatz: suchenText };
  }
  if (stand.meine.rolle === 'mitfahrer') {
    if (stand.meine.fahrerId) return { art: 'abgeholt', text: t('{name} holt dich ab', { name: nameVon(repo, stand.meine.fahrerId) }), zusatz: null };
    const frei = andereFahrer.filter((auto) => auto.frei > 0).length;
    return {
      art: 'angefragt',
      text: t('Mitfahrt angefragt'),
      zusatz: frei ? { text: tn(frei, '{n} fährt', '{n} fahren'), farbe: 'var(--muted)' } : null,
    };
  }
  if (suchenText) return { art: 'offen', text: t('Anreise planen'), zusatz: suchenText };
  if (andereFahrer.length) return { art: 'offen', text: t('Anreise planen'), zusatz: { text: tn(andereFahrer.length, '{n} fährt', '{n} fahren'), farbe: 'var(--muted)' } };
  return { art: 'offen', text: t('Anreise planen'), zusatz: null };
}

export function anreiseKnopf(ctx, meet, options = {}) {
  if (!mitfahrenMoeglich(meet)) return '';
  const stand = options.stand || mitfahrStand(ctx.repo, meet);
  // Wer abgesagt hat, kommt nicht — „Anreise planen" wäre dort ein Knopf ohne Sinn (Hausregel 9).
  // Sagt die Person wieder zu, steht er sofort wieder da.
  if (stand.meine.abgesagt) return '';
  const kompakt = Boolean(options.kompakt);
  const status = anreiseStatus(ctx.repo, stand);
  const glyph = status.art === 'angefragt' || status.art === 'abgeholt' ? handGlyph('var(--ink)', kompakt ? 14 : 16) : autoGlyph('var(--ink)', kompakt ? 14 : 16);
  const look = kompakt
    ? 'background:var(--paper);border:0;border-radius:12px;min-height:38px;padding:0 11px'
    : 'background:var(--surface);border:1px solid var(--ink-a10);border-radius:18px;min-height:46px;padding:0 12px 0 14px';
  const aria = status.zusatz ? `${status.text} · ${status.zusatz.text}` : status.text;
  return `<button data-act="anreise-oeffnen" data-meet="${esc(meet.id)}" data-role="anreise-knopf" data-status="${status.art}" data-suchen="${stand.suchen.filter((id) => id !== ME).length}" data-fahrer="${stand.fahrer.length}"${kompakt ? ' data-treffer' : ''} aria-label="${esc(aria)}" style="${look};width:100%;display:flex;align-items:center;gap:8px;box-sizing:border-box;cursor:pointer;appearance:none;font-family:${FONT};color:var(--ink);text-align:left;flex:none">
<span style="pointer-events:none;display:flex">${glyph}</span>
<span data-role="anreise-knopf-text" style="font-size:${kompakt ? 12 : 13}px;font-weight:650;flex:1;min-width:0;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;pointer-events:none">${esc(status.text)}</span>
${status.zusatz ? `<span data-role="anreise-knopf-zusatz" style="font-size:${kompakt ? 11.5 : 12.5}px;font-weight:650;color:${status.zusatz.farbe};white-space:nowrap;flex:none;pointer-events:none">${esc(status.zusatz.text)}</span>` : ''}
<span style="pointer-events:none;display:flex;flex:none">${pfeilRechts(kompakt ? 'var(--muted-light)' : 'var(--line-strong)')}</span>
</button>`;
}

export function anreiseAktionen(ctx, meet) {
  return {
    'anreise-oeffnen': (data) => {
      rueckmeldung('tipp');
      ctx.nav?.go('meet.anreise', { meetId: data.meet || meet.id });
    },
  };
}

// --- Das Rechenmodell der Fahrerseite -------------------------------------------------------------

// Wann soll ich am Treffpunkt sein? Die Uhrzeit des Meets — außer es läuft schon oder die Zeit ist
// offen. Dann gibt es keinen Zeitpunkt, von dem aus sich rückwärts rechnen ließe.
function zielZeitpunkt(meet) {
  if (!meet?.date || meet.status === 'active') return null;
  const [stunde, minute] = String(meet.time || '').split(':').map(Number);
  if (!Number.isFinite(stunde) || meet.openTime) return null;
  const tag = fromISODate(meet.date);
  tag.setHours(stunde, minute || 0, 0, 0);
  return tag.getTime() > now().getTime() ? tag : null;
}

// Uhrzeiten an jedem Punkt der Route: rückwärts von der Meet-Uhrzeit, bei laufendem Meet vorwärts
// von jetzt, sonst nur die Dauer. Nach jeder Abholung kommen PAUSE_JE_ABHOLUNG_MIN dazu.
// `abholungAb`: ab welchem Punkt abgeholt wird — 1, wenn die Route bei mir beginnt, sonst 0.
function zeitenRechnen(meet, route, anzahlPunkte, abholungAb = 1) {
  const abschnitte = route?.abschnitte || [];
  const letzteAbholung = anzahlPunkte - 2;
  const ab = [0];
  for (let i = 1; i < anzahlPunkte; i += 1) {
    const vorher = i - 1;
    const pause = vorher >= abholungAb && vorher <= letzteAbholung ? PAUSE_JE_ABHOLUNG_MIN : 0;
    ab.push(ab[vorher] + pause + (abschnitte[vorher]?.dauerMin || 0));
  }
  const gesamt = ab[ab.length - 1] || 0;
  const ziel = zielZeitpunkt(meet);
  let uhrzeiten = null;
  // Rückwärts: Jede Restdauer bis zum Treffpunkt wird aufgerundet — lieber eine Minute zu früh
  // als zu spät, und am Treffpunkt steht genau die Uhrzeit des Meets.
  if (ziel) uhrzeiten = ab.map((min) => uhr(new Date(ziel.getTime() - Math.ceil(gesamt - min - 1e-9) * 60000)));
  else if (meet?.status === 'active') {
    const los = now().getTime();
    uhrzeiten = ab.map((min) => uhr(new Date(los + Math.round(min) * 60000)));
  }
  return { gesamtMin: gesamt, uhrzeiten, rueckwaerts: Boolean(ziel) };
}

export function anreisePlan(repo, meet, optionen = {}) {
  const stand = optionen.stand || mitfahrStand(repo, meet);
  const eigeneLage = optionen.start && hatLage(optionen.start) ? optionen.start : null;
  const start = eigeneLage || stand.meine.lage;
  const startQuelle = eigeneLage ? 'geraet' : (stand.meine.lage ? (stand.meine.lage.quelle === 'zuhause' ? 'zuhause' : 'standort') : null);
  const ziel = stand.ziel;
  const mein = stand.fahrer.find((auto) => auto.id === ME) || null;
  const mitfahrer = mein ? mein.mitfahrer : [];
  const mitLage = mitfahrer.map((id) => ({ id, lage: abholLageVon(repo, meet.id, id) })).filter((stopp) => stopp.lage);
  const ohneLage = mitfahrer.filter((id) => !mitLage.some((stopp) => stopp.id === id));

  let stopps = mitLage;
  if (ziel && start) stopps = abholReihenfolge(start, ziel, mitLage)?.stopps || mitLage;
  else if (ziel && mitLage.length > 1) {
    // Ohne eigenen Start beginnt die Route bei der ersten Abholung; der Rest reiht sich ein.
    const [erste, ...rest] = mitLage;
    stopps = [erste, ...(abholReihenfolge(erste.lage, ziel, rest)?.stopps || rest)];
  }
  const punkte = [...(start ? [start] : []), ...stopps.map((stopp) => stopp.lage), ...(ziel ? [ziel] : [])];
  const route = punkte.length >= 2 ? (routeGemerkt(punkte) || routeSchaetzen(punkte)) : null;
  // Ohne Ziel gibt es keine Ankunft, von der aus sich Uhrzeiten rechnen ließen.
  const zeiten = route && ziel ? zeitenRechnen(meet, route, punkte.length, start ? 1 : 0) : null;

  // Wen kann ich mitnehmen? Wer eine Mitfahrt angefragt hat — am aktuellen Standort. Der Umweg ist
  // der Unterschied der Routenlänge mit und ohne diese Person, an der günstigsten Stelle eingereiht.
  const kandidaten = stand.suchen.filter((id) => id !== ME).map((id) => {
    const lage = stand.lagen.get(id) || null;
    let umwegMin = null;
    if (lage && ziel && (start || stopps.length)) {
      const anfang = start || stopps[0].lage;
      const reihe = start ? stopps : stopps.slice(1);
      umwegMin = Math.round(minutenFuerKm(besteEinfuegung(anfang, reihe, ziel, lage).kosten));
    }
    return { id, lage, umwegMin, aufDemWeg: umwegMin != null && umwegMin <= AUF_DEM_WEG_MIN };
  }).sort((a, b) => {
    if (a.umwegMin == null && b.umwegMin == null) return 0;
    if (a.umwegMin == null) return 1;
    if (b.umwegMin == null) return -1;
    return a.umwegMin - b.umwegMin;
  });
  return {
    stand,
    start,
    startQuelle,
    ziel,
    stopps,
    ohneLage,
    punkte,
    route,
    zeiten,
    kandidaten,
    platz: { plaetze: mein ? mein.plaetze : 0, belegt: mitfahrer.length },
  };
}

// Runde 11 (C3): Jede Fahrt bekommt eine Farbe. Sie hängt an der Person, die fährt (aus ihrer Kennung
// gerechnet) — nicht daran, wer schaut, wer sonst fährt oder was man selbst gewählt hat: So ist Tobis
// Route für alle und in jeder Ansicht dieselbe, und „die blaue Route" meint im Chat für alle dasselbe.
// Träfen zwei Fahrer auf dieselbe Farbe, nimmt der zweite (nach Kennung) die nächste freie.
export const FAHRT_FARBEN = [
  { token: '--green', rueckfall: '#1b9e5f' },
  { token: '--blue-dark', rueckfall: '#3d5e8c' },
  { token: '--orange', rueckfall: '#d96c1f' },
  { token: '--red', rueckfall: '#d14b3f' },
  { token: '--ink-soft', rueckfall: '#6f6963' },
  { token: '--green-dark', rueckfall: '#17694a' },
];

function fahrtFarben(ids) {
  const vergeben = new Map();
  const belegt = new Set();
  for (const id of [...ids].sort()) {
    let nr = [...String(id)].reduce((summe, zeichen) => (summe * 31 + zeichen.charCodeAt(0)) % 997, 7) % FAHRT_FARBEN.length;
    for (let schritt = 0; schritt < FAHRT_FARBEN.length && belegt.has(nr); schritt += 1) nr = (nr + 1) % FAHRT_FARBEN.length;
    belegt.add(nr);
    vergeben.set(id, FAHRT_FARBEN[nr]);
  }
  return vergeben;
}

// Alle Fahrten eines Meets: je Fahrer Start (sein geteilter Standort) → seine Mitfahrenden in der
// günstigsten Reihenfolge → Treffpunkt. Dieselbe Rechnung wie die eigene Fahrerseite; die eigene
// Fahrt kommt aus `optionen.plan`, damit Karte und Liste dort genau dasselbe zeigen.
export function alleFahrten(repo, meet, optionen = {}) {
  const stand = optionen.stand || mitfahrStand(repo, meet);
  const ziel = stand.ziel;
  if (!ziel) return [];
  const farben = fahrtFarben(stand.fahrer.map((auto) => auto.id));
  return stand.fahrer.map((auto) => {
    let start = auto.lage;
    let stopps = auto.routeStopps;
    if (auto.id === ME && optionen.plan) {
      start = optionen.plan.start;
      stopps = optionen.plan.stopps;
    } else if (!start && stopps.length > 1) {
      // Ohne Standort des Fahrers beginnt die Route bei der ersten Abholung (wie auf seiner Seite).
      const [erste, ...rest] = stopps;
      stopps = [erste, ...(abholReihenfolge(erste.lage, ziel, rest)?.stopps || rest)];
    }
    const punkte = [...(start ? [start] : []), ...stopps.map((stopp) => stopp.lage), ziel];
    const route = punkte.length >= 2 ? (routeGemerkt(punkte) || routeSchaetzen(punkte)) : null;
    const zeiten = route ? zeitenRechnen(meet, route, punkte.length, start ? 1 : 0) : null;
    return {
      fahrerId: auto.id,
      farbe: farben.get(auto.id),
      start,
      stopps,
      ohneLage: auto.ohneLage,
      punkte,
      route,
      zeiten,
      mitfahrer: auto.mitfahrer,
      frei: auto.frei,
    };
  });
}

// Eine Zeile je Fahrt: Farbstrich (wie die Linie auf der Karte), Gesicht, „Tobi fährt", darunter wen er
// abholt, wie lange es dauert und wie weit es ist.
function fahrtUnterText(repo, fahrt) {
  const teile = [];
  if (fahrt.mitfahrer.length) teile.push(t('holt {namen} ab', { namen: namenListe(repo, fahrt.mitfahrer, t('dich')) }));
  if (fahrt.route && fahrt.punkte.length >= 2) {
    teile.push(minutenText(fahrt.zeiten?.gesamtMin ?? fahrt.route.dauerMin), kmText(fahrt.route.meter));
    if (fahrt.route.geschaetzt) teile.push(t('geschätzt'));
    // Die Abholadresse sieht nur der Fahrer: Wer nicht fährt, kennt die Abholorte nicht — die Linie geht dann ohne sie.
    if (fahrt.fahrerId !== ME && fahrt.ohneLage.length) teile.push(t('ohne Abholorte'));
  } else teile.push(t('ohne Standort'));
  return teile.join(' · ');
}

const farbStrich = (fahrt) => `<span aria-hidden="true" data-role="anreise-fahrt-farbe" style="width:4px;height:30px;border-radius:2px;background:var(${fahrt.farbe.token});flex:none"></span>`;

function fahrtenKarte(ctx, fahrten, titel) {
  if (!fahrten.length) return '';
  const repo = ctx.repo;
  const settings = repo.getSettings();
  const zeilen = fahrten.map((fahrt, nr) => {
    const name = fahrt.fahrerId === ME ? t('Du fährst') : t('{name} fährt', { name: nameVon(repo, fahrt.fahrerId) });
    return `<div data-role="anreise-fahrt" data-fahrer="${esc(fahrt.fahrerId)}" data-geschaetzt="${fahrt.route?.geschaetzt === false ? '0' : '1'}" data-stopps="${esc(fahrt.stopps.map((stopp) => stopp.id).join(','))}" style="display:flex;align-items:center;gap:10px;min-height:52px;${nr ? 'border-top:1px solid var(--ink-a06);' : ''}">
${farbStrich(fahrt)}${gesicht(repo, settings, fahrt.fahrerId, 32)}
<span style="flex:1;min-width:0;display:flex;flex-direction:column;gap:1px"><span style="font-size:14px;font-weight:650;white-space:nowrap;overflow:hidden;text-overflow:ellipsis">${esc(name)}</span><span data-role="anreise-fahrt-unter" style="font-size:12px;color:var(--muted);line-height:1.35">${esc(fahrtUnterText(repo, fahrt))}</span></span>
</div>`;
  }).join('');
  return `<div data-role="anreise-fahrten" style="${karteStil};padding:10px 14px 6px">${kapitel(titel)}${zeilen}</div>`;
}

// --- Die Seite „Anreise" ------------------------------------------------------------------------

function kopfZeile(ctx, meet) {
  const wann = meet.status === 'active' ? t('läuft gerade') : [datumText(meet.date), zeitText(meet)].filter(Boolean).join(' · ');
  const unter = [meet.title, wann].filter(Boolean).join(' · ');
  return `<div style="display:flex;align-items:center;gap:10px;padding:10px 20px 8px;flex:none">
<button data-act="back" aria-label="${esc(t('Zurück'))}" style="width:36px;height:36px;margin-left:-8px;border:0;background:transparent;display:flex;align-items:center;justify-content:center;cursor:pointer;appearance:none;padding:0;flex:none"><span style="pointer-events:none;display:flex">${backArrow('var(--ink)', 22)}</span></button>
<span style="display:flex;flex-direction:column;gap:1px;flex:1;min-width:0">
<span style="font-family:${TITEL_FONT};font-size:21px;font-weight:650;letter-spacing:-.01em">${esc(t('Anreise'))}</span>
<span data-role="anreise-unterzeile" style="font-size:12px;color:var(--muted);white-space:nowrap;overflow:hidden;text-overflow:ellipsis">${esc(unter)}</span>
</span>
</div>`;
}

function wahlZeile(act, glyph, titel, unter, erste) {
  return `<button data-act="${act}" style="display:flex;align-items:center;gap:12px;width:100%;min-height:64px;padding:10px 14px;border:0;${erste ? '' : 'border-top:1px solid var(--ink-a07);'}background:transparent;cursor:pointer;appearance:none;font-family:${FONT};text-align:left;box-sizing:border-box">
<span style="width:40px;height:40px;border-radius:12px;background:var(--paper);display:flex;align-items:center;justify-content:center;flex:none;pointer-events:none">${glyph}</span>
<span style="display:flex;flex-direction:column;gap:2px;flex:1;min-width:0;pointer-events:none"><span style="font-size:15px;font-weight:650;color:var(--ink)">${esc(titel)}</span><span style="font-size:12px;color:var(--muted)">${esc(unter)}</span></span>
<span style="pointer-events:none;display:flex">${pfeilRechts()}</span>
</button>`;
}

function wahlAnsicht(ctx, meet, stand, fahrten) {
  const repo = ctx.repo;
  const andereFahrer = stand.fahrer.filter((auto) => auto.id !== ME);
  const suchende = stand.suchen.filter((id) => id !== ME);
  const zeilen = [];
  if (andereFahrer.length) {
    zeilen.push(`<span data-role="anreise-lage-fahrer">${esc(andereFahrer.length === 1
      ? t('{namen} fährt', { namen: nameVon(repo, andereFahrer[0].id) })
      : t('{namen} fahren', { namen: namenListe(repo, andereFahrer.map((auto) => auto.id)) }))}</span>`);
  }
  if (suchende.length) {
    zeilen.push(`<span data-role="anreise-lage-suchen" style="color:var(--orange-dark)">${esc(suchende.length === 1
      ? t('{namen} sucht eine Mitfahrt', { namen: nameVon(repo, suchende[0]) })
      : t('{namen} suchen eine Mitfahrt', { namen: namenListe(repo, suchende) }))}</span>`);
  }
  return `<div data-role="anreise-wahl" style="${karteStil};overflow:hidden">
${wahlZeile('anreise-fahren', autoGlyph('var(--ink)', 19), t('Ich fahre'), t('Du holst Leute ab'), true)}
${wahlZeile('anreise-mitfahrt', handGlyph('var(--ink)', 19), t('Ich brauche eine Mitfahrt'), t('Wer fährt, sieht deine Anfrage'), false)}
</div>
${zeilen.length ? `<div data-role="anreise-lage" style="display:flex;flex-direction:column;gap:4px;padding:2px 6px;font-size:12.5px;line-height:1.4;color:var(--muted)">${zeilen.join('')}</div>` : ''}
${kartenFlaeche(meet, null, fahrten)}
${fahrtenKarte(ctx, fahrten, t('Fahrten'))}`;
}

// Die Karte: eine Fläche, die die echte Karte (MapLibre) in bind bekommt. Ohne Punkte keine Karte.
function kartenPunkte(plan, fahrten) {
  return [
    ...(plan ? [plan.start, plan.ziel, ...plan.kandidaten.map((k) => k.lage), ...plan.stopps.map((s) => s.lage)] : []),
    ...fahrten.flatMap((fahrt) => fahrt.punkte),
  ].filter(hatLage);
}

function kartenFlaeche(meet, plan, fahrten = []) {
  // Auf der Fahrerseite steht die Karte immer (dort wählt man, wen man mitnimmt); sonst, sobald
  // jemand fährt — dann zeigt sie jede Route.
  if (!plan && !fahrten.length) return '';
  if (!kartenPunkte(plan, fahrten).length) return '';
  return `<div data-role="anreise-karte-rahmen" style="position:relative;height:280px;border-radius:20px;overflow:hidden;background:var(--map-tint, var(--field));border:1px solid var(--ink-a10);flex:none">
<div data-fremd="1" data-role="anreise-karte" data-meet="${esc(meet.id)}" style="position:absolute;inset:0"></div>
</div>`;
}

function startText(plan) {
  if (plan.startQuelle === 'zuhause') return t('ab Zuhause');
  if (plan.startQuelle) return t('ab deinem Standort');
  return '';
}

function routeKarte(ctx, meet, plan, farbe = FAHRT_FARBEN[0]) {
  const repo = ctx.repo;
  const { route, zeiten } = plan;
  const uhrzeit = (index) => (zeiten?.uhrzeiten ? zeiten.uhrzeiten[index] : '');
  const zeile = (inhalt, attrs, index, zeit, knopf = '') => `<li${attrs} style="display:flex;align-items:center;gap:10px;min-height:48px;${index ? 'border-top:1px solid var(--ink-a06);' : ''}">${inhalt}<span data-role="anreise-zeit" style="font-size:13.5px;font-weight:650;color:var(--ink);font-variant-numeric:tabular-nums;flex:none">${esc(zeit || '')}</span><span style="width:30px;flex:none;display:flex;justify-content:flex-end">${knopf}</span></li>`;
  const zeilen = [];
  let index = 0;
  if (plan.start) {
    zeilen.push(zeile(`${gesicht(repo, ctx.repo.getSettings(), ME, 28)}<span style="flex:1;min-width:0;display:flex;flex-direction:column;gap:1px"><span style="font-size:14px;font-weight:650">${esc(t('Du'))}</span><span style="font-size:11.5px;color:var(--muted)">${esc(startText(plan))}</span></span>`, ` data-role="anreise-stopp" data-art="start"`, index, uhrzeit(index)));
    index += 1;
  }
  plan.stopps.forEach((stopp, nr) => {
    const name = nameVon(repo, stopp.id);
    const knopf = `<button data-act="anreise-person" data-person="${esc(stopp.id)}" aria-label="${esc(t('{name} nicht mitnehmen', { name }))}" style="width:44px;height:44px;margin:-6px -10px -6px -6px;border:0;background:transparent;padding:0;display:flex;align-items:center;justify-content:center;flex:none;cursor:pointer;appearance:none"><svg width="13" height="13" viewBox="0 0 24 24" fill="none" style="pointer-events:none"><path d="M7 7l10 10M17 7 7 17" stroke="var(--muted)" stroke-width="2.2" stroke-linecap="round"></path></svg></button>`;
    zeilen.push(zeile(`<span style="position:relative;display:flex;flex:none">${gesicht(repo, ctx.repo.getSettings(), stopp.id, 28)}<span aria-hidden="true" style="position:absolute;right:-5px;top:-5px;min-width:17px;height:17px;border-radius:9px;background:var(${farbe.token});color:var(--on-accent);font:700 10px/17px ${FONT};text-align:center;box-shadow:0 0 0 2px var(--surface)">${nr + 1}</span></span><span style="flex:1;min-width:0;display:flex;flex-direction:column;gap:1px"><span style="font-size:14px;font-weight:650;white-space:nowrap;overflow:hidden;text-overflow:ellipsis">${esc(name)}</span>${stopp.lage?.quelle === 'abholadresse' && stopp.lage.name ? `<span data-role="anreise-abholort" style="font-size:11.5px;color:var(--muted);white-space:nowrap;overflow:hidden;text-overflow:ellipsis">${esc(stopp.lage.name)}</span>` : ''}</span>`, ` data-role="anreise-stopp" data-art="abholung" data-person="${esc(stopp.id)}"`, index, uhrzeit(index), knopf));
    index += 1;
  });
  if (plan.ziel) {
    zeilen.push(zeile(`<span style="display:flex;flex:none">${meetKachel(meet, 28)}</span><span style="flex:1;min-width:0;display:flex;flex-direction:column;gap:1px"><span style="font-size:14px;font-weight:650;white-space:nowrap;overflow:hidden;text-overflow:ellipsis">${esc(plan.ziel.name || meet.title)}</span><span style="font-size:11.5px;color:var(--muted)">${esc(t('Treffpunkt'))}</span></span>`, ' data-role="anreise-stopp" data-art="ziel"', index, uhrzeit(index)));
  }
  const ohneLage = plan.ohneLage.length
    ? `<span data-role="anreise-ohne-standort" style="display:block;font-size:12px;color:var(--muted);line-height:1.4;padding-top:6px">${esc(t('{namen} ohne Standort — Treffpunkt selbst absprechen', { namen: namenListe(repo, plan.ohneLage) }))}</span>`
    : '';

  let kopf = '';
  if (route && plan.ziel && plan.punkte.length >= 2) {
    const los = zeiten?.uhrzeiten && zeiten.rueckwaerts ? t('Los um {zeit}', { zeit: zeiten.uhrzeiten[0] }) : '';
    const teile = [los, minutenText(zeiten?.gesamtMin ?? route.dauerMin), kmText(route.meter)].filter(Boolean);
    kopf = `<div style="display:flex;align-items:baseline;gap:8px;flex-wrap:wrap;padding-bottom:4px">
<span data-role="anreise-summe" style="font-size:15px;font-weight:650;color:var(--ink);font-variant-numeric:tabular-nums">${esc(teile.join(' · '))}</span>
${route.geschaetzt ? `<span data-role="anreise-geschaetzt" style="font-size:11.5px;font-weight:650;color:var(--muted)">${esc(t('geschätzt'))}</span>` : ''}
</div>`;
  } else if (!plan.ziel) {
    kopf = `<span data-role="anreise-ohne-ziel" style="display:block;font-size:12.5px;color:var(--muted);line-height:1.45;padding-bottom:6px">${esc(t('Der Treffpunkt ist noch nicht auf der Karte — die Route kommt, sobald er feststeht.'))}</span>`;
  }
  const standortKnopf = !plan.start && plan.ziel
    ? `<button data-act="anreise-standort" style="display:flex;align-items:center;justify-content:center;gap:7px;width:100%;min-height:44px;border-radius:999px;border:1.5px solid var(--ink-a14);background:transparent;cursor:pointer;appearance:none;font:650 13px ${FONT};color:var(--ink);margin-top:8px"><span style="pointer-events:none;display:flex">${pinGlyph('var(--ink)', 14)}</span><span style="pointer-events:none">${esc(t('Von meinem Standort aus'))}</span></button>`
    : '';
  const google = plan.ziel && (plan.start || plan.stopps.length)
    ? `<button data-act="anreise-google" style="display:flex;align-items:center;justify-content:center;gap:8px;width:100%;min-height:46px;border-radius:999px;border:0;background:var(--green);color:var(--on-accent);cursor:pointer;appearance:none;font:650 14px ${FONT};margin-top:10px;box-shadow:0 4px 14px var(--green-a26)"><span style="pointer-events:none;display:flex">${routeGlyph('var(--on-accent)', 16)}</span><span style="pointer-events:none">${esc(t('In Google Maps öffnen'))}</span></button>`
    : '';
  return `<div data-role="anreise-route" data-geschaetzt="${route?.geschaetzt ? '1' : '0'}" data-dauer-min="${route ? Math.round(zeiten?.gesamtMin ?? route.dauerMin) : ''}" data-meter="${route ? route.meter : ''}" style="${karteStil};padding:12px 14px 14px;display:flex;flex-direction:column">
${kopf}
<ol data-role="anreise-stopps" style="list-style:none;margin:0;padding:0;display:flex;flex-direction:column">${zeilen.join('')}</ol>
${ohneLage}${standortKnopf}${google}
</div>`;
}

function kandidatenKarte(ctx, plan) {
  const repo = ctx.repo;
  if (!plan.kandidaten.length) {
    return `<div data-role="anreise-niemand" style="${karteStil};padding:14px;font-size:13px;color:var(--muted);line-height:1.45">${esc(t('Gerade fragt niemand nach einer Mitfahrt. Wer eine braucht, erscheint hier — mit dem Umweg für dich.'))}</div>`;
  }
  const voll = plan.platz.belegt >= PLAETZE_MAX;
  const zeilen = plan.kandidaten.map((kandidat, nr) => {
    const name = nameVon(repo, kandidat.id);
    let unter = t('ohne Standort');
    let farbe = 'var(--muted)';
    if (kandidat.umwegMin != null) {
      unter = kandidat.umwegMin <= 0 ? t('liegt auf dem Weg') : t('+{n} Min Umweg', { n: kandidat.umwegMin });
      if (kandidat.aufDemWeg) {
        farbe = 'var(--green-dark)';
        if (kandidat.umwegMin > 0) unter = t('auf dem Weg · +{n} Min', { n: kandidat.umwegMin });
      }
    }
    const knopf = voll
      ? `<span style="font-size:12px;font-weight:650;color:var(--muted);flex:none">${esc(t('Auto voll'))}</span>`
      : pille('anreise-person', t('Mitnehmen'), { ton: kandidat.aufDemWeg ? 'gruen' : '', daten: { person: kandidat.id }, aria: t('{name} mitnehmen', { name }), gedrueckt: false });
    return `<div data-role="anreise-kandidat" data-person="${esc(kandidat.id)}" data-umweg-min="${kandidat.umwegMin ?? ''}" data-auf-dem-weg="${kandidat.aufDemWeg ? '1' : '0'}" style="display:flex;align-items:center;gap:10px;min-height:52px;${nr ? 'border-top:1px solid var(--ink-a06);' : ''}">
${gesicht(repo, ctx.repo.getSettings(), kandidat.id, 34)}
<span style="flex:1;min-width:0;display:flex;flex-direction:column;gap:1px"><span style="font-size:14px;font-weight:650;white-space:nowrap;overflow:hidden;text-overflow:ellipsis">${esc(name)}</span><span data-role="anreise-umweg" style="font-size:12px;font-weight:${kandidat.aufDemWeg ? 650 : 500};color:${farbe}">${esc(unter)}</span></span>
${knopf}
</div>`;
  }).join('');
  return `<div data-role="anreise-kandidaten" style="${karteStil};padding:10px 14px 6px">
${kapitel(t('Wer mitfahren will'))}
${zeilen}
</div>`;
}

function fahrerAnsicht(ctx, meet, plan, fahrten) {
  return `${kartenFlaeche(meet, plan, fahrten)}
${routeKarte(ctx, meet, plan, fahrten.find((fahrt) => fahrt.fahrerId === ME)?.farbe)}
${kandidatenKarte(ctx, plan)}
${fahrtenKarte(ctx, fahrten.filter((fahrt) => fahrt.fahrerId !== ME), t('Andere Fahrten'))}
<button data-act="anreise-doch-nicht" style="align-self:center;min-height:44px;padding:0 14px;border:0;background:transparent;cursor:pointer;appearance:none;font:650 13px ${FONT};color:var(--muted)"><span style="pointer-events:none">${esc(t('Doch nicht fahren'))}</span></button>`;
}

// Meine Abholzeit vom Server (0048): nur Minuten, aus der Route meines Fahrers — ohne Adresse der anderen.
function zeitAusServer(meet, z) {
  const ziel = zielZeitpunkt(meet);
  if (ziel) return uhr(new Date(ziel.getTime() - Math.ceil(z.gesamtMin - z.abMin - 1e-9) * 60000));
  if (meet?.status === 'active') return uhr(new Date(now().getTime() + Math.round(z.abMin) * 60000));
  return null;
}

// Wann holt mich mein Fahrer ab? Der Server sagt es jedem Mitfahrer für sich (nur die eigene Zeit); sonst dieselbe Rechnung
// wie auf der Fahrerseite — soweit ich alle Halte kenne.
function abholZeit(repo, meet, stand) {
  const vomServer = stand.meine.fahrerId ? repo.getAbholzeit?.(meet.id) : null;
  if (vomServer && vomServer.fahrerId === stand.meine.fahrerId) {
    const zeit = zeitAusServer(meet, vomServer);
    if (zeit) return { punkte: null, zeit };
  }
  const auto = stand.fahrer.find((eintrag) => eintrag.id === stand.meine.fahrerId);
  if (!auto || !auto.lage || !stand.ziel) return null;
  const index = auto.routeStopps.findIndex((stopp) => stopp.id === ME);
  if (index < 0) return null;
  // Die Abholorte der anderen Mitfahrenden kenne ich nicht (nur der Fahrer sieht sie): Dann wäre die Uhrzeit geraten.
  if (auto.ohneLage.some((id) => id !== ME)) return null;
  const punkte = [auto.lage, ...auto.routeStopps.map((stopp) => stopp.lage), stand.ziel];
  const route = routeGemerkt(punkte) || routeSchaetzen(punkte);
  const zeiten = zeitenRechnen(meet, route, punkte.length, 1);
  return { punkte, zeit: zeiten.uhrzeiten ? zeiten.uhrzeiten[index + 1] : null };
}

// Wo holen wir dich ab? Standard ist die Abholadresse aus dem Profil; ausdrücklich vom aktuellen Standort nur auf Wunsch.
function abholKarte(ctx, meet, stand) {
  const repo = ctx.repo;
  const wahl = stand.meine.abholung;
  const ort = repo.getAbholadresse?.() || null;
  const teilt = repo.getSettings().location?.use !== false && repo.getSettings().location?.shareMode !== 'niemand';
  const punkt = (aktiv) => `<span aria-hidden="true" style="width:20px;height:20px;border-radius:50%;border:2px solid ${aktiv ? 'var(--green)' : 'var(--ink-a20, var(--line-strong))'};display:flex;align-items:center;justify-content:center;flex:none;box-sizing:border-box">${aktiv ? '<span style="width:10px;height:10px;border-radius:50%;background:var(--green)"></span>' : ''}</span>`;
  const wahlZeile = (wert, titel, unter, erste) => `<button data-act="anreise-abholung" data-wert="${wert}" data-role="anreise-abholung-${wert}" aria-pressed="${wahl === wert}" style="display:flex;align-items:center;gap:12px;flex:1;min-width:0;min-height:56px;padding:8px 2px;border:0;background:transparent;cursor:pointer;appearance:none;font-family:${FONT};text-align:left;color:var(--ink)">
<span style="pointer-events:none;display:flex">${punkt(wahl === wert)}</span>
<span style="pointer-events:none;display:flex;flex-direction:column;gap:2px;flex:1;min-width:0"><span style="font-size:14.5px;font-weight:650">${esc(titel)}</span><span data-role="anreise-abholung-unter" style="font-size:12px;color:var(--muted);line-height:1.35">${esc(unter)}</span></span></button>`;
  const adresseUnter = ort ? [ort.name, ort.city].filter(Boolean).join(', ') : t('Noch keine hinterlegt');
  const aendern = `<button data-act="anreise-adresse" data-role="anreise-adresse" style="flex:none;min-height:44px;padding:0 12px;border:0;background:transparent;cursor:pointer;appearance:none;font:650 13px ${FONT};color:var(--green-dark)"><span style="pointer-events:none">${esc(ort ? t('Ändern') : t('Eintragen'))}</span></button>`;
  const standortUnter = teilt ? t('Dein Fahrer sieht, wo du gerade bist.') : t('Dein Standort ist für Freunde nicht sichtbar — dein Fahrer findet dich so nicht.');
  return `<div data-role="anreise-abholung" data-wahl="${wahl}" data-adresse="${ort ? '1' : '0'}" style="${karteStil};padding:10px 14px 8px">
${kapitel(t('Wo holen wir dich ab?'))}
<div style="display:flex;align-items:center">${wahlZeile('adresse', t('Meine Abholadresse'), adresseUnter)}${aendern}</div>
<div style="display:flex;align-items:center;border-top:1px solid var(--ink-a06)">${wahlZeile('standort', t('Von meinem aktuellen Standort'), standortUnter)}</div>
<span style="display:block;font-size:11.5px;color:var(--muted);line-height:1.4;padding:4px 2px 2px">${esc(t('Deine Abholadresse sieht nur der Fahrer, bei dem du mitfährst.'))}</span>
</div>`;
}

function mitfahrerAnsicht(ctx, meet, stand, fahrten) {
  const repo = ctx.repo;
  const settings = repo.getSettings();
  let titel;
  let unter;
  let glyph = handGlyph('var(--orange-dark)', 20);
  let flaeche = 'var(--orange-dark-a10)';
  if (stand.meine.fahrerId) {
    const abholung = abholZeit(repo, meet, stand);
    titel = t('{name} holt dich ab', { name: nameVon(repo, stand.meine.fahrerId) });
    unter = abholung?.zeit ? t('ungefähr um {zeit}', { zeit: abholung.zeit }) : t('Die Uhrzeit sprecht ihr am besten im Chat ab.');
    glyph = gesicht(repo, settings, stand.meine.fahrerId, 40);
    flaeche = 'transparent';
  } else {
    titel = t('Du brauchst eine Mitfahrt');
    unter = t('Wer fährt, sieht deine Anfrage — samt Umweg.');
  }
  const status = `<div data-role="anreise-status" data-abgeholt="${stand.meine.fahrerId ? '1' : '0'}" style="${karteStil};padding:14px;display:flex;align-items:center;gap:12px">
<span style="width:40px;height:40px;border-radius:12px;background:${flaeche};display:flex;align-items:center;justify-content:center;flex:none">${glyph}</span>
<span style="display:flex;flex-direction:column;gap:2px;flex:1;min-width:0"><span style="font-size:15px;font-weight:650">${esc(titel)}</span><span data-role="anreise-status-unter" style="font-size:12.5px;color:var(--muted);line-height:1.4">${esc(unter)}</span></span>
</div>`;
  const andere = stand.fahrer.filter((auto) => auto.id !== ME);
  const fahrerZeilen = andere.map((auto, nr) => {
    const name = nameVon(repo, auto.id);
    const meiner = stand.meine.fahrerId === auto.id;
    let rechts;
    if (meiner) rechts = `<span style="font-size:12px;font-weight:650;color:var(--green-dark);flex:none">${esc(t('mit dir'))}</span>`;
    else if (auto.frei > 0) rechts = pille('anreise-einsteigen', t('Einsteigen'), { ton: 'gruen', daten: { fahrer: auto.id }, aria: t('Bei {name} einsteigen', { name }) });
    else rechts = `<span style="font-size:12px;font-weight:650;color:var(--muted);flex:none">${esc(t('voll'))}</span>`;
    const unterZeile = auto.frei > 0 ? tn(auto.frei, '{n} Platz frei', '{n} Plätze frei') : t('alle Plätze belegt');
    // Runde 11 (C3): Die Zeile trägt die Farbe ihrer Route auf der Karte und sagt, wie die Fahrt läuft.
    const fahrt = fahrten.find((eintrag) => eintrag.fahrerId === auto.id);
    return `<div data-role="anreise-fahrer" data-fahrer="${esc(auto.id)}" style="display:flex;align-items:center;gap:10px;min-height:52px;${nr ? 'border-top:1px solid var(--ink-a06);' : ''}">
${fahrt ? farbStrich(fahrt) : ''}${gesicht(repo, settings, auto.id, 34)}
<span style="flex:1;min-width:0;display:flex;flex-direction:column;gap:1px"><span style="font-size:14px;font-weight:650;white-space:nowrap;overflow:hidden;text-overflow:ellipsis">${esc(t('{name} fährt', { name }))}</span><span style="font-size:12px;color:var(--muted)">${esc(unterZeile)}</span>${fahrt ? `<span data-role="anreise-fahrt-unter" style="font-size:12px;color:var(--muted);line-height:1.35">${esc(fahrtUnterText(repo, fahrt))}</span>` : ''}</span>
${rechts}
</div>`;
  }).join('');
  const fahrerKarte = andere.length
    ? `<div data-role="anreise-fahrerliste" style="${karteStil};padding:10px 14px 6px">${kapitel(t('Fahrer'))}${fahrerZeilen}</div>`
    : '';
  const weg = stand.meine.fahrerId
    ? `<button data-act="anreise-aussteigen" style="align-self:center;min-height:44px;padding:0 14px;border:0;background:transparent;cursor:pointer;appearance:none;font:650 13px ${FONT};color:var(--muted)"><span style="pointer-events:none">${esc(t('Aussteigen'))}</span></button>`
    : `<button data-act="anreise-zurueckziehen" style="align-self:center;min-height:44px;padding:0 14px;border:0;background:transparent;cursor:pointer;appearance:none;font:650 13px ${FONT};color:var(--muted)"><span style="pointer-events:none">${esc(t('Anfrage zurückziehen'))}</span></button>`;
  return `${status}${abholKarte(ctx, meet, stand)}${kartenFlaeche(meet, null, fahrten)}${fahrerKarte}${weg}`;
}

function dochNichtSheet(ctx, meet, stand) {
  if (ctx.ui.anreiseFrage?.meetId !== meet.id) return '';
  const mein = stand.fahrer.find((auto) => auto.id === ME);
  const namen = mein?.mitfahrer.length ? namenListe(ctx.repo, mein.mitfahrer) : '';
  const satz = mein?.mitfahrer.length === 1
    ? t('{namen} sucht dann wieder eine Mitfahrt.', { namen })
    : t('{namen} suchen dann wieder eine Mitfahrt.', { namen });
  return sheet(`<div data-role="anreise-frage" style="display:flex;flex-direction:column;gap:12px;font-family:${FONT}">
<span style="font-family:${TITEL_FONT};font-size:19px;font-weight:650">${esc(t('Doch nicht fahren?'))}</span>
<span style="font-size:13px;color:var(--ink-soft);line-height:1.45">${esc(satz)}</span>
<div style="display:flex;gap:8px">
<button data-act="anreise-frage-nein" style="flex:1;min-height:48px;border:1.5px solid var(--ink-a14);background:var(--surface);color:var(--ink-soft);font:650 14px/1 ${FONT};border-radius:999px;cursor:pointer;appearance:none"><span style="pointer-events:none">${esc(t('Abbrechen'))}</span></button>
<button data-act="anreise-frage-ja" style="flex:1;min-height:48px;background:var(--danger);border:0;color:var(--on-accent);font:650 14px/1 ${FONT};border-radius:999px;cursor:pointer;appearance:none"><span style="pointer-events:none">${esc(t('Nicht fahren'))}</span></button>
</div>
</div>`, { closeAct: 'anreise-frage-nein', scrollKey: 'anreise-frage' });
}

function fehltSeite() {
  return {
    html: screenScaffold({
      header: `<div style="display:flex;align-items:center;padding:10px 20px 6px"><button data-act="back" aria-label="${esc(t('Zurück'))}" style="width:36px;height:36px;margin-left:-8px;border:0;background:transparent;display:flex;align-items:center;justify-content:center;cursor:pointer;appearance:none;padding:0"><span style="pointer-events:none;display:flex">${backArrow('var(--ink)', 22)}</span></button></div>`,
      body: `<div style="padding:120px 40px;text-align:center;font-size:13.5px;color:var(--muted)">${esc(t('Dieses Meet gibt es nicht mehr.'))}</div>`,
      scrollKey: 'anreise-fehlt',
    }),
    bind() {},
  };
}

export function renderAnreise(ctx) {
  const { repo, ui } = ctx;
  const meet = repo.getMeet(ctx.params.meetId);
  if (!meet) return fehltSeite();
  const stand = mitfahrStand(repo, meet);
  let modus = 'wahl';
  if (stand.meine.rolle === 'fahrer' || stand.meine.art === 'auto') modus = 'fahrer';
  else if (stand.meine.rolle === 'mitfahrer') modus = 'mitfahrer';
  const plan = modus === 'fahrer' ? anreisePlan(repo, meet, { stand, start: ui.anreiseStart || null }) : null;
  const fahrten = alleFahrten(repo, meet, { stand, plan });

  let inhalt;
  if (!mitfahrenMoeglich(meet)) {
    inhalt = `<div style="${karteStil};padding:14px;font-size:13px;color:var(--muted)">${esc(t('Für dieses Meet gibt es keine Anreise mehr zu planen.'))}</div>`;
  } else if (stand.meine.abgesagt) {
    inhalt = `<div data-role="anreise-abgesagt" style="${karteStil};padding:14px;font-size:13px;color:var(--muted);line-height:1.45">${esc(t('Du hast abgesagt — eine Anreise brauchst du nicht.'))}</div>`;
  } else if (modus === 'fahrer') inhalt = fahrerAnsicht(ctx, meet, plan, fahrten);
  else if (modus === 'mitfahrer') inhalt = mitfahrerAnsicht(ctx, meet, stand, fahrten);
  else inhalt = wahlAnsicht(ctx, meet, stand, fahrten);

  const html = screenScaffold({
    header: kopfZeile(ctx, meet),
    body: `<div data-role="anreise" data-meet="${esc(meet.id)}" data-modus="${modus}" style="display:flex;flex-direction:column;gap:10px;padding:6px 20px 0;font-family:${FONT};color:var(--ink)">${inhalt}</div>`,
    bottomInset: 28,
    overlays: dochNichtSheet(ctx, meet, stand),
    scrollKey: `anreise-${meet.id}`,
  });
  return { html, bind: (root) => bindActions(root, bindAnreise(root, ctx, meet, { modus, plan, stand, fahrten })) };
}

// --- Die Karte der Fahrerseite ----------------------------------------------------------------

const LINIE_QUELLE = 'crew-anreise-route';
const LINIE_EBENE = 'crew-anreise-linie';

function farbeAus(token, rueckfall) {
  try {
    const wert = getComputedStyle(document.documentElement).getPropertyValue(token).trim();
    return wert || rueckfall;
  } catch {
    return rueckfall;
  }
}

function markeKnoten(inhalt, attrs = {}) {
  const knoten = document.createElement('div');
  knoten.className = 'anreise-marke';
  for (const [name, wert] of Object.entries(attrs)) knoten.setAttribute(name, wert);
  // Antippbare Marken bekommen eine Trefferflaeche von mindestens 44 px — das Bild bleibt, wie es ist.
  knoten.style.cssText = `display:flex;align-items:center;justify-content:center;cursor:pointer;-webkit-tap-highlight-color:transparent${attrs['data-act'] ? ';min-width:44px;min-height:44px' : ''}`;
  knoten.innerHTML = inhalt;
  return knoten;
}

// Die eigene Route (Fahrerseite) liegt in LINIE_QUELLE, alle anderen Fahrten in FAHRTEN_QUELLE — je
// Fahrt ein Stück mit ihrer Farbe; echte Straßen durchgezogen, Schätzungen gestrichelt (eine gerade
// Linie ist keine Straße und soll auch nicht so aussehen). Die eigene Route liegt obenauf.
const FAHRTEN_QUELLE = 'crew-anreise-fahrten';
const FAHRTEN_ECHT = 'crew-anreise-fahrten-echt';
const FAHRTEN_GESCHAETZT = 'crew-anreise-fahrten-geschaetzt';

function linienSetzen(karte, eigene, andere, eigeneFarbe = FAHRT_FARBEN[0]) {
  if (!karte) return;
  // Gezeichnet wird immer der NEUESTE Wunsch. Wartet ein älterer Aufruf noch auf 'idle' (Stil lädt), darf er
  // die Linie eines neueren nicht überschreiben — sonst legt sich die gestrichelte Schätzung über die
  // echte Route, die inzwischen da war (gemessen mit einem langsamen Routen-Dienst, Runde 12).
  karte.__linienWunsch = { eigene, andere, eigeneFarbe };
  const zeichnen = () => {
    const { eigene, andere, eigeneFarbe } = karte.__linienWunsch;
    const eigeneDaten = { type: 'Feature', properties: {}, geometry: { type: 'LineString', coordinates: eigene?.linie || [] } };
    const andereDaten = {
      type: 'FeatureCollection',
      features: andere.map((fahrt) => ({
        type: 'Feature',
        properties: { fahrer: fahrt.fahrerId, farbe: farbeAus(fahrt.farbe.token, fahrt.farbe.rueckfall), geschaetzt: fahrt.route.geschaetzt ? 1 : 0 },
        geometry: { type: 'LineString', coordinates: fahrt.route.linie || [] },
      })),
    };
    const fahrtenQuelle = karte.getSource?.(FAHRTEN_QUELLE);
    if (fahrtenQuelle) fahrtenQuelle.setData(andereDaten);
    else {
      karte.addSource(FAHRTEN_QUELLE, { type: 'geojson', data: andereDaten });
      const vor = karte.getLayer?.(LINIE_EBENE) ? LINIE_EBENE : undefined;
      for (const [id, echt] of [[FAHRTEN_GESCHAETZT, false], [FAHRTEN_ECHT, true]]) {
        karte.addLayer({
          id,
          type: 'line',
          source: FAHRTEN_QUELLE,
          filter: ['==', ['get', 'geschaetzt'], echt ? 0 : 1],
          layout: { 'line-cap': 'round', 'line-join': 'round' },
          paint: { 'line-color': ['get', 'farbe'], 'line-width': 4, 'line-opacity': 0.85, ...(echt ? {} : { 'line-dasharray': [1.2, 1.6] }) },
        }, vor);
      }
    }
    const quelle = karte.getSource?.(LINIE_QUELLE);
    if (quelle) quelle.setData(eigeneDaten);
    else if (eigene) {
      karte.addSource(LINIE_QUELLE, { type: 'geojson', data: eigeneDaten });
      karte.addLayer({
        id: LINIE_EBENE,
        type: 'line',
        source: LINIE_QUELLE,
        layout: { 'line-cap': 'round', 'line-join': 'round' },
        paint: { 'line-color': farbeAus(eigeneFarbe.token, eigeneFarbe.rueckfall), 'line-width': 4, 'line-opacity': 0.9 },
      });
    }
    if (eigene && karte.getLayer?.(LINIE_EBENE)) karte.setPaintProperty(LINIE_EBENE, 'line-color', farbeAus(eigeneFarbe.token, eigeneFarbe.rueckfall));
    if (eigene && karte.getLayer?.(LINIE_EBENE)) karte.setPaintProperty(LINIE_EBENE, 'line-dasharray', eigene.geschaetzt ? [1.2, 1.6] : [1, 0]);
  };
  try {
    // Gemessen (C3): isStyleLoaded() ist auch dann false, wenn nur eine Linien-Quelle gerade neue Daten
    // verarbeitet — und 'load' kommt kein zweites Mal. Die neue Linie blieb dann liegen (gestrichelt,
    // obwohl die echte Route längst da war). Darum: Ist der Stil einmal da, wird sofort gezeichnet;
    // sonst beim nächsten 'idle', das immer kommt.
    if (karte.__anreiseStil || karte.isStyleLoaded?.()) { karte.__anreiseStil = true; zeichnen(); } else {
      karte.once('idle', () => { try { karte.__anreiseStil = true; zeichnen(); } catch { /* Stil fehlt: dann ohne Linie */ } });
    }
  } catch { /* ohne Linie bleibt die Karte bedienbar */ }
}

// Marken näher als MARKEN_ABSTAND px (ein Gesicht mit Ring ist gut 40 px breit) bilden eine Gruppe; ihre
// Mitglieder stehen auf einem Kreis, dessen Nachbarn MARKEN_ABSTAND px auseinander liegen. Der Versatz
// (Marker.setOffset) ist in Pixeln, die Marke bleibt an ihrer Koordinate verankert.
const MARKEN_ABSTAND = 44;
function markenVerteilen(karte, marken) {
  const liste = [...marken].map(([id, eintrag]) => {
    const ort = eintrag.marke.getLngLat();
    const p = karte.project([ort.lng, ort.lat]);
    return { id, eintrag, x: p.x, y: p.y };
  }).sort((a, b) => (a.id < b.id ? -1 : 1));
  const wurzel = liste.map((_, i) => i);
  const finde = (i) => { let k = i; while (wurzel[k] !== k) { wurzel[k] = wurzel[wurzel[k]]; k = wurzel[k]; } return k; };
  for (let i = 0; i < liste.length; i += 1) {
    for (let j = i + 1; j < liste.length; j += 1) {
      if (Math.hypot(liste[i].x - liste[j].x, liste[i].y - liste[j].y) < MARKEN_ABSTAND) wurzel[finde(j)] = finde(i);
    }
  }
  const gruppen = new Map();
  liste.forEach((m, i) => { const w = finde(i); if (!gruppen.has(w)) gruppen.set(w, []); gruppen.get(w).push(m); });
  for (const gruppe of gruppen.values()) {
    const n = gruppe.length;
    if (n === 1) { gruppe[0].eintrag.marke.setOffset([0, 0]); continue; }
    const mx = gruppe.reduce((summe, m) => summe + m.x, 0) / n;
    const my = gruppe.reduce((summe, m) => summe + m.y, 0) / n;
    const radius = (MARKEN_ABSTAND / 2) / Math.sin(Math.PI / n);
    gruppe.forEach((m, k) => {
      const winkel = -Math.PI / 2 + (2 * Math.PI * k) / n;
      m.eintrag.marke.setOffset([mx + radius * Math.cos(winkel) - m.x, my + radius * Math.sin(winkel) - m.y]);
    });
  }
}

async function karteBinden(root, ctx, meet, plan, fahrten, stand) {
  const knoten = root.querySelector('[data-role="anreise-karte"]');
  if (!knoten) return;
  const repo = ctx.repo;
  const settings = repo.getSettings();
  const schluessel = `anreise-${meet.id}`;
  const alle = kartenPunkte(plan, fahrten);
  const ziel = plan?.ziel || stand.ziel;
  const mitte = ziel || plan?.start || alle[0];
  const karte = await karteHalten(knoten, schluessel, { mitte, zoom: 12.5, interaktiv: true, folgen: false });
  if (!karte || !knoten.isConnected) return;
  const maplibregl = await ladeMapLibre();
  if (!karte.__anreiseMarken) karte.__anreiseMarken = new Map();
  const marken = karte.__anreiseMarken;
  const gesehen = new Set();
  // Liegen Marken aufeinander (ich und der Treffpunkt 300 m auseinander, jemand 10 km weg), gilt
  // eine feste Stapelfolge: ich unten, dann wer eine Mitfahrt sucht, darüber der Treffpunkt, ganz
  // oben, wer schon mitfährt.
  const setzen = (id, lage, html, attrs, ebene) => {
    gesehen.add(id);
    let eintrag = marken.get(id);
    if (!eintrag) {
      const element = markeKnoten(html, attrs);
      eintrag = { element, marke: new maplibregl.Marker({ element, anchor: 'center' }).setLngLat([lage.lon, lage.lat]).addTo(karte) };
      marken.set(id, eintrag);
    } else {
      eintrag.marke.setLngLat([lage.lon, lage.lat]);
      if (eintrag.element.__html !== html) eintrag.element.innerHTML = html;
      // Wer eben noch antippbar war (sucht) und jetzt bei jemand anderem mitfährt, ist es nicht mehr.
      for (const name of ['data-act', 'data-gewaehlt', 'data-role', 'data-fahrer', 'role', 'aria-label']) {
        if (!(name in attrs)) eintrag.element.removeAttribute(name);
      }
      for (const [name, wert] of Object.entries(attrs)) eintrag.element.setAttribute(name, wert);
    }
    eintrag.element.style.zIndex = String(ebene);
    eintrag.element.__html = html;
  };
  const ring = (farbe) => `box-shadow:0 0 0 3px ${farbe},0 3px 10px var(--shadow-25)`;
  if (ziel) {
    setzen('ziel', ziel, `<span data-role="anreise-ziel-marke" style="display:flex;border-radius:10px;${ring('var(--surface)')}">${meetKachel(meet, 32)}</span>`, { 'data-role': 'anreise-ziel' }, 3);
  }
  // Runde 11 (C3): die Fahrten der anderen — der Fahrer mit einem Ring in der Farbe seiner Route, seine
  // Mitfahrenden mit ihrer Nummer in derselben Farbe. Nur ansehen: Wen ANDERE mitnehmen, entscheiden sie.
  const andere = fahrten.filter((fahrt) => !(plan && fahrt.fahrerId === ME));
  for (const fahrt of andere) {
    const farbe = `var(${fahrt.farbe.token})`;
    if (fahrt.start) {
      setzen(fahrt.fahrerId === ME ? 'ich' : `f:${fahrt.fahrerId}`, fahrt.start, `<span data-role="${fahrt.fahrerId === ME ? 'anreise-ich-marke' : 'anreise-fahrer-marke'}" style="display:flex;border-radius:50%;${ring(farbe)}">${gesicht(repo, settings, fahrt.fahrerId, 30)}</span>`, { 'data-fahrer': fahrt.fahrerId, 'data-person': fahrt.fahrerId }, 2);
    }
    fahrt.stopps.forEach((stopp, nr) => {
      setzen(stopp.id === ME ? 'ich' : `p:${stopp.id}`, stopp.lage, `<span style="position:relative;display:flex;border-radius:50%;${ring(farbe)}">${gesicht(repo, settings, stopp.id, 30)}<span style="position:absolute;right:-7px;top:-7px;min-width:18px;height:18px;border-radius:9px;background:${farbe};color:var(--on-accent);font:700 10.5px/18px ${FONT};text-align:center;box-shadow:0 0 0 2px var(--surface)">${nr + 1}</span></span>`, { 'data-fahrer': fahrt.fahrerId, 'data-person': stopp.id, ...(stopp.id === ME ? { 'data-role': 'anreise-ich' } : {}) }, stopp.id === ME ? 5 : 3);
    });
  }
  if (!plan) {
    // Wer (noch) nicht fährt und nicht abgeholt wird, sieht sich selbst auf der Karte — zwischen den Routen.
    const ich = stand.meine.lage;
    if (ich && !gesehen.has('ich')) setzen('ich', ich, `<span data-role="anreise-ich-marke" style="display:flex;border-radius:50%;${ring('var(--surface)')}">${gesicht(repo, settings, ME, 28)}</span>`, { 'data-role': 'anreise-ich' }, 1);
  }
  if (plan?.start) {
    setzen('ich', plan.start, `<span data-role="anreise-ich-marke" style="display:flex;border-radius:50%;${ring('var(--surface)')}">${gesicht(repo, settings, ME, 28)}</span>`, { 'data-role': 'anreise-ich' }, 1);
  }
  const eigeneFahrt = fahrten.find((fahrt) => fahrt.fahrerId === ME) || null;
  const eigeneFarbe = `var(${(eigeneFahrt?.farbe || FAHRT_FARBEN[0]).token})`;
  if (plan) plan.stopps.forEach((stopp, nr) => {
    setzen(`p:${stopp.id}`, stopp.lage, `<span style="position:relative;display:flex;border-radius:50%;${ring(eigeneFarbe)}">${gesicht(repo, settings, stopp.id, 36)}<span style="position:absolute;right:-7px;top:-7px;min-width:19px;height:19px;border-radius:10px;background:${eigeneFarbe};color:var(--on-accent);font:700 11px/19px ${FONT};text-align:center;box-shadow:0 0 0 2px var(--surface)">${nr + 1}</span></span>`, {
      'data-act': 'anreise-person', 'data-person': stopp.id, 'data-gewaehlt': '1', role: 'button', 'aria-label': t('{name} nicht mitnehmen', { name: nameVon(repo, stopp.id) }),
    }, 4);
  });
  if (plan) plan.kandidaten.filter((k) => k.lage).forEach((kandidat) => {
    setzen(`p:${kandidat.id}`, kandidat.lage, `<span style="display:flex;border-radius:50%;${ring(kandidat.aufDemWeg ? 'var(--green-a55)' : 'var(--surface)')};opacity:.96">${gesicht(repo, settings, kandidat.id, 36)}</span>`, {
      'data-act': 'anreise-person', 'data-person': kandidat.id, 'data-gewaehlt': '0', role: 'button', 'aria-label': t('{name} mitnehmen', { name: nameVon(repo, kandidat.id) }),
    }, 2);
  });
  for (const [id, eintrag] of [...marken]) {
    if (gesehen.has(id)) continue;
    eintrag.marke.remove();
    marken.delete(id);
  }
  // Aufräumen: Wer so nah beieinander steht, dass sich die Marken berühren, wird im Kreis um die gemeinsame
  // Mitte verteilt — jede bleibt einzeln zu sehen und antippbar. Bei jedem Zoom neu (die Abstände in
  // Pixeln ändern sich), darum hängt der Horcher einmal an der Karte.
  if (!karte.__anreiseVerteilen) {
    karte.__anreiseVerteilen = () => markenVerteilen(karte, marken);
    karte.on?.('zoomend', karte.__anreiseVerteilen);
  }
  markenVerteilen(karte, marken);
  const eigene = plan?.route && plan.ziel ? plan.route : null;
  linienSetzen(karte, eigene, andere.filter((fahrt) => fahrt.route && fahrt.punkte.length >= 2), eigeneFahrt?.farbe || FAHRT_FARBEN[0]);
  // Alles ins Bild: beim ersten Mal und immer dann, wenn neue Leute dazukommen (Anfragen kommen live)
  // — solange der Mensch die Karte nicht selbst bewegt hat. Dann bleibt SEIN Ausschnitt.
  if (!karte.__anreiseHandHoerer) {
    karte.__anreiseHandHoerer = true;
    const vonHand = (ereignis) => { if (ereignis?.originalEvent) karte.__anreiseVonHand = true; };
    for (const art of ['dragstart', 'zoomstart', 'rotatestart', 'pitchstart']) karte.on?.(art, vonHand);
  }
  const bild = alle.map((punkt) => `${punkt.lat.toFixed(5)},${punkt.lon.toFixed(5)}`).sort().join('|');
  if (knoten.__eingepasst !== bild && (!knoten.__eingepasst || !karte.__anreiseVonHand)) {
    knoten.__eingepasst = bild;
    passeAufPunkte(karte, alle, { padding: 62, maxZoom: 14.5 });
  }
}

// --- Handler der Seite ----------------------------------------------------------------------------

function bindAnreise(root, ctx, meet, { modus, plan, stand, fahrten = [] }) {
  const { repo, ui } = ctx;
  const meetId = meet.id;
  const melden = (ergebnis, art = 'auswahl') => danach(ergebnis, (antwort) => {
    if (antwort && antwort.ok === false) {
      rueckmeldung('abgelehnt');
      ctx.toast?.(mitfahrMeldung(antwort));
      ctx.render();
      return false;
    }
    rueckmeldung(art);
    return true;
  });
  const ohneDaten = () => {
    if (hatDaten(repo)) return false;
    rueckmeldung('abgelehnt');
    ctx.toast?.(t('Gerade nicht möglich'));
    return true;
  };
  const anreiseSchreiben = (art, plaetze) => {
    if (typeof repo.setAnreise === 'function') return repo.setAnreise(meetId, { art, plaetze });
    const rolle = rolleAusAnreise(art, plaetze);
    return repo.setRide(meetId, rolle === 'fahrer' ? { rolle, plaetze } : { rolle });
  };
  const aktuell = () => mitfahrStand(repo, repo.getMeet(meetId) || meet);

  // Echte Routen kommen nach — für die eigene Fahrt, für jede andere und für die eigene Abholzeit.
  // Kommt eine, wird neu gezeichnet. Ohne Konto (Demo) antwortet der Datenweg sofort „nein", und
  // route.js fragt dieselbe Strecke eine Weile nicht wieder: Es bleibt ehrlich geschätzt.
  // Der Server merkt sich jede Route je Fahrer und Menge der Halte (0047) — darum geht mit, WESSEN Fahrt es ist und zu welchem Meet.
  // Eine fremde Fahrt mit unbekannten Abholorten bleibt geschätzt: Ihre echte Route kennt nur ihr Fahrer.
  // Der Fahrer meldet dabei, wer wo steht — daraus rechnet der Server jedem Mitfahrer nur seine eigene Abholzeit.
  const personen = plan?.start && plan.ziel ? [ME, ...plan.stopps.map((stopp) => stopp.id), null] : null;
  const offen = [{ punkte: plan?.punkte, fahrer: ME, personen }, ...fahrten.filter((fahrt) => fahrt.fahrerId === ME || !fahrt.ohneLage.length).map((fahrt) => ({ punkte: fahrt.punkte, fahrer: fahrt.fahrerId }))];
  if (modus === 'mitfahrer' && stand.meine.fahrerId) offen.push({ punkte: abholZeit(repo, meet, stand)?.punkte, fahrer: stand.meine.fahrerId });
  if (modus === 'mitfahrer' && stand.meine.fahrerId) repo.abholzeitNachladen?.();
  for (const { punkte, fahrer, personen: wer } of offen) {
    if (!punkte || punkte.length < 2 || routeGemerkt(punkte)) continue;
    routeBerechnen(punkte, repo, { fahrer, meet: meetId, personen: wer || null }).then((route) => { if (route && !route.geschaetzt && root.isConnected) ctx.render(); }).catch(() => {});
  }
  if (root.querySelector('[data-role="anreise-karte"]')) karteBinden(root, ctx, meet, modus === 'fahrer' ? plan : null, fahrten, stand).catch(() => {});

  return {
    'anreise-fahren': () => {
      if (ohneDaten()) return;
      melden(anreiseSchreiben('auto', standardPlaetze(repo)), 'erfolg');
      ctx.render();
    },
    'anreise-mitfahrt': () => {
      if (ohneDaten()) return;
      melden(anreiseSchreiben('mitfahrt'), 'erfolg');
      ctx.render();
    },
    'anreise-person': (data) => {
      if (ohneDaten() || !data.person) return;
      const jetzt = aktuell();
      const mein = jetzt.fahrer.find((auto) => auto.id === ME);
      if (mein?.mitfahrer.includes(data.person)) {
        melden(repo.assignRide(meetId, data.person, null), 'zurueck');
        ctx.render();
        return;
      }
      // Ein Tipp nimmt mit. Ist das Auto nach der eingestellten Zahl voll, wächst sie um einen Platz
      // (bis acht): Wer jemanden ausdrücklich antippt, hat den Platz.
      const weiter = () => { melden(repo.assignRide(meetId, data.person, ME), 'erfolg'); ctx.render(); };
      if (mein && mein.frei > 0) { weiter(); return; }
      // Voll (acht Plätze): ehrlich ablehnen und sofort den echten Stand zeigen — die Zeile sagt dann
      // „Auto voll" statt eines Knopfes, der nichts mehr kann.
      if (mein && mein.plaetze >= PLAETZE_MAX) { rueckmeldung('abgelehnt'); ctx.toast?.(t('Kein Platz mehr frei')); ctx.render(); return; }
      const plaetze = mein ? mein.plaetze + 1 : standardPlaetze(repo);
      danach(anreiseSchreiben('auto', plaetze), (antwort) => {
        if (antwort?.ok === false) { melden(antwort); return; }
        weiter();
      });
    },
    'anreise-google': () => {
      const jetzt = anreisePlan(repo, repo.getMeet(meetId) || meet, { start: ui.anreiseStart || null });
      const url = googleMapsUrl(jetzt.punkte, { ohneStart: !jetzt.start });
      if (!url) { rueckmeldung('abgelehnt'); return; }
      rueckmeldung('tipp');
      globalThis.open?.(url, '_blank', 'noopener');
    },
    'anreise-standort': (_daten, _knopf, ereignis) => {
      if (!navigator.geolocation) { ctx.toast?.(t('Dieses Gerät liefert keinen Standort')); return; }
      navigator.geolocation.getCurrentPosition(
        (position) => {
          ui.anreiseStart = { lat: position.coords.latitude, lon: position.coords.longitude, quelle: 'geraet' };
          rueckmeldung('erfolg');
          ctx.render();
        },
        () => { rueckmeldung('abgelehnt'); ctx.toast?.(t('Ohne Standortfreigabe rechnet die Route ab der ersten Abholung')); },
        { enableHighAccuracy: true, timeout: 9000, maximumAge: 60000, ausloeser: ereignis },
      );
    },
    'anreise-doch-nicht': () => {
      const mein = aktuell().fahrer.find((auto) => auto.id === ME);
      if (mein?.mitfahrer.length) { ui.anreiseFrage = { meetId }; rueckmeldung('tipp'); ctx.render(); return; }
      if (ohneDaten()) return;
      melden(anreiseSchreiben(null), 'zurueck');
      ctx.render();
    },
    'anreise-frage-nein': () => { ui.anreiseFrage = null; rueckmeldung('schliessen'); ctx.render(); },
    'anreise-frage-ja': () => {
      ui.anreiseFrage = null;
      if (ohneDaten()) { ctx.render(); return; }
      melden(anreiseSchreiben(null), 'zurueck');
      ctx.render();
    },
    'anreise-zurueckziehen': () => {
      if (ohneDaten()) return;
      melden(anreiseSchreiben(null), 'zurueck');
      ctx.render();
    },
    'anreise-einsteigen': (data) => {
      if (ohneDaten() || !data.fahrer) return;
      melden(repo.assignRide(meetId, ME, data.fahrer), 'erfolg');
      ctx.render();
    },
    'anreise-aussteigen': () => {
      if (ohneDaten()) return;
      melden(repo.assignRide(meetId, ME, null), 'zurueck');
      ctx.render();
    },
    // Wo holen wir dich ab? „adresse“ (Standard) oder ausdrücklich „standort“.
    'anreise-abholung': (data) => {
      if (typeof repo.setAbholung !== 'function') { rueckmeldung('abgelehnt'); ctx.toast?.(t('Gerade nicht möglich')); return; }
      melden(repo.setAbholung(meetId, data.wert === 'standort' ? 'standort' : 'adresse'), 'auswahl');
      ctx.render();
    },
    'anreise-adresse': () => { rueckmeldung('tipp'); ctx.nav?.go('profile.abholadresse'); },
  };
}

// --- Rückmeldungen --------------------------------------------------------------------------------

export function mitfahrMeldung(ergebnis, name = '') {
  if (!ergebnis) return '';
  if (ergebnis.ok === false) {
    if (ergebnis.reason === 'voll') return t('Kein Platz mehr frei');
    if (ergebnis.reason === 'verboten') return t('Das dürfen nur Fahrer, Mitfahrer oder wer das Meet erstellt hat');
    if (ergebnis.reason === 'keinFahrer') return name ? t('{name} fährt gerade nicht', { name }) : t('Diese Person fährt gerade nicht');
    return t('Gerade nicht möglich');
  }
  if (ergebnis.reason === 'keinFahrer') {
    return name ? t('{name} fährt noch nicht — du stehst bei „sucht noch“', { name }) : t('Du stehst bei „sucht noch“');
  }
  return '';
}

// --- Übergabe an die Chat-Erkennung im Raum ---------------------------------------------------
//
// „ich fahr, 3 Plätze frei" (eigen)      → ich bin Fahrer mit 3 Plätzen
// „ich fahr" von Mira                    → ich steige bei Mira ein; fährt Mira (noch) nicht,
//                                          stehe ich bei „sucht noch" (reason 'keinFahrer', ok:true)
// „kann mich wer mitnehmen" (eigen)      → ich suche eine Mitfahrt
// „kann mich wer mitnehmen" von Ayla     → ich fahre (falls noch nicht) und nehme Ayla mit
export function mitfahrtAusChat(ctx, meetId, { art, autorId, plaetze } = {}) {
  const repo = ctx?.repo;
  if (!hatDaten(repo)) return { ok: false, reason: 'keineDaten' };
  const meet = repo.getMeet(meetId);
  if (!meet) return { ok: false, reason: 'keinMeet' };
  const stand = mitfahrStand(repo, meet);
  const eigen = autorId === ME;
  if (art === 'angebot') {
    if (eigen) {
      const bisher = stand.fahrer.find((auto) => auto.id === ME)?.plaetze;
      return repo.setRide(meetId, { rolle: 'fahrer', plaetze: plaetze ? begrenzt(plaetze) : (bisher || standardPlaetze(repo)) });
    }
    if (stand.rolleVon(autorId) === 'fahrer') return repo.assignRide(meetId, ME, autorId);
    return danach(repo.setRide(meetId, { rolle: 'mitfahrer' }), (antwort) => (antwort?.ok === false ? antwort : { ok: true, reason: 'keinFahrer' }));
  }
  if (eigen) return repo.setRide(meetId, { rolle: 'mitfahrer' });
  const mitnehmen = () => repo.assignRide(meetId, autorId, ME);
  if (stand.meine.rolle === 'fahrer') return mitnehmen();
  return danach(repo.setRide(meetId, { rolle: 'fahrer', plaetze: standardPlaetze(repo) }), (antwort) => (antwort?.ok === false ? antwort : mitnehmen()));
}

export function mitfahrtSchonErfasst(repo, meetId, { art, autorId } = {}) {
  const meet = repo?.getMeet?.(meetId);
  if (!meet || !hatDaten(repo)) return false;
  const stand = mitfahrStand(repo, meet);
  const eigen = autorId === ME;
  if (art === 'angebot') return eigen ? stand.meine.rolle === 'fahrer' : stand.meine.fahrerId === autorId;
  if (eigen) return stand.meine.rolle === 'mitfahrer' || stand.meine.rolle === 'fahrer';
  const rolle = stand.rolleVon(autorId);
  return rolle === 'fahrer' || rolle === 'selbst' || stand.zuordnung.has(autorId);
}
