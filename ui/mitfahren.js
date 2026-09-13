// Runde 5 (P4, E1) — Mitfahren: wer fährt, wer mit wem fährt, in welcher Reihenfolge abgeholt wird.
//
// Jonathan: „Nice wäre ein Routenplaner, der es mir zeigt, wenn ich gut mitnehmen kann bzw. wer wen
// mit dem Auto mitnimmt usw. Bedenke, Freunde brauchen meist nicht die Route, aber zu wissen, wer wen
// abholt, wäre nützlich."
//
// Deshalb ist die Hauptsache KEINE Karte, sondern das, was man in einer Sekunde liest:
//   · eine stehende Leiste „Mitfahren" — die Fahrer als Profilbilder, daneben „2 suchen" oder
//     „3 Plätze frei",
//   · aufgeklappt: die eigene Rolle mit einem Tipp, jedes Auto mit seiner Abholreihenfolge
//     (① Tobi ② Lena → Pfänderbahn · ~9 min Umweg), wer noch sucht — für Fahrer mit „Mitnehmen" und
//     dem EIGENEN Umweg („~3 min Umweg für dich", grün, wenn es fast auf dem Weg liegt) —, darunter
//     ein Vorschlag der Zuordnung zum Übernehmen,
//   · nur für den Fahrer selbst: Route in Apple Maps oder Google Maps mit den Abholungen als Stopps.
//
// Warum eine eigene Leiste über „Mitbringen | Umfragen" statt einer dritten Kachel daneben:
//   1. Drei Kacheln lassen bei 360 px Breite rund 20 px für die Beschriftung — sie wäre in jeder
//      Sprache abgeschnitten.
//   2. Eine geschlossene Kachel kann nicht zeigen, WER fährt. Die Leiste zeigt es ohne Tipp.
//   3. Die Leiste hat ihren eigenen Auf/Zu-Zustand (ctx.ui.mitfahren = meetId). Öffnen klappt keinen
//      anderen Bereich zu — also rückt weder die Leiste noch die Kachelreihe darunter nach oben.
//
// API (verbindlich):
//   mitfahrenMoeglich(meet)                 → boolean: nicht bei Entwurf, abgeschlossen, abgesagt.
//   mitfahrStand(repo, meet)                → Ansichtsmodell aus repo.getRides / repo.getLage:
//     { meetId, creatorId, ziel, fahrer:[{ id, plaetze, mitfahrer, frei, lage, reihenfolge, ohneLage,
//       geordnet, routeStopps, umwegKm }], suchen, selbst, offen, lagen:Map, zuordnung:Map,
//       rolleVon(id), meine:{ rolle, fahrerId, abgesagt }, vorschlag }
//   mitfahrenKachel(ctx, meet, options?)    → html. Die Leiste. options.kompakt (Raum-Panel),
//     options.offen (überschreibt ctx.ui.mitfahren), options.act + options.panel (z. B. 'panel-toggle'
//     und 'mitfahren', wenn ein Bildschirm den Bereich in seine eigene Kachel-Logik hängt).
//   mitfahrenInhalt(ctx, meet, options?)    → html. Der aufgeklappte Inhalt. options.kompakt.
//   mitfahrenBereich(ctx, meet, options?)   → Leiste + Inhalt; offen, wenn ctx.ui.mitfahren === meet.id.
//   mitfahrenAktionen(ctx, meet)            → Handler-Karte für bindActions (steckt in bindMeetPanels,
//     wirkt also in den Meet-Details UND im Raum-Panel).
//   mitfahrVorschlag({ ziel, fahrer:[{ id, lage, frei, stopps }], suchende:[{ id, lage }] })
//     → { zuordnungen:[{ mitfahrerId, fahrerId, kostenKm }], fahrer:[{ fahrerId, neu, reihenfolge,
//         umwegKm, umwegMin }], ohnePlatz:[id], ohneLage:[id] }        (reine Rechnung, ohne DOM)
//   abholReihenfolge(start, ziel, stopps)   → { stopps, umwegKm, laengeKm, direktKm } | null
//   mitfahrRouteUrl(ziel, stopps, anbieter) → URL ('apple' | 'google'), Stopps als Zwischenziele.
//   standardPlaetze(repo)                   → Plätze für Mitfahrer: eigene Auto-Ressource (Kapazität
//     zählt Personen, also − 1), sonst 4.
//   mitfahrtAusChat(ctx, meetId, { art:'angebot'|'suche', autorId, plaetze? }) → { ok, reason? }
//     Die Übergabe für die Chat-Erkennung im Raum (siehe dort).
//   mitfahrtSchonErfasst(repo, meetId, { art, autorId }) → boolean (Vorschlag im Chat ausblenden).
//   mitfahrMeldung(ergebnis, name?)         → Toast-Text zu einem Ergebnis ('' wenn nichts zu sagen ist).
//
// Rechnung (nur ein Vorschlag — übernommen wird mit einem Tipp):
//   Weg(a, b)  = Luftlinie × 1,3 (Straßen sind nie gerade).
//   Umweg      = Länge der Route Fahrer → Stopps → Ziel mit dem neuen Stopp − ohne ihn; bei einem
//                einzigen Stopp also Weg(d→r) + Weg(r→Ziel) − Weg(d→Ziel).
//   Gierig: immer die billigste Einfügung zuerst — welcher Suchende, in welches Auto, an welche Stelle
//   der Abholreihenfolge —, bis niemand mehr sucht oder kein Platz frei ist. Weil die Stelle
//   mitgerechnet wird, ist die gezeigte Reihenfolge genau die Route, deren Umweg dasteht. (Erst
//   zuordnen und danach nach „nächstem Nachbarn" ordnen hätte eine andere Route ergeben als die, deren
//   Minuten angezeigt werden.) Minuten grob bei 40 km/h.
//   Lagen kommen NUR aus repo.getLage — für andere ist das ihr geteilter Standort, nie eine Adresse.
//   Wer keine Lage hat, wird nicht geraten, sondern steht als „ohne Standort — selbst absprechen" da.

import { esc, rueckmeldung } from '../core/html.js';
import { ME } from '../data/ids.js';
import { personAvatar, personMarker, stackSeparator } from './components.js';
import { ressourcenIconKey, ressourcenIconSvg } from './activity-icons.js';
import { entfernungKm, hatLage } from '../core/entfernung.js';
import { t, tn } from '../core/sprache.js';

const FONT = "'Instrument Sans',sans-serif";
export const UMWEG_FAKTOR = 1.3;
export const KMH = 40;
const PLAETZE_MIN = 1;
const PLAETZE_MAX = 8;
// Ohne eigene Auto-Ressource mit Kapazität: ein gewöhnliches Auto hat fünf Sitze, einer fährt.
const PLAETZE_OHNE_KAPAZITAET = 4;
// Bis hierher (gerundete Minuten) liegt jemand „fast auf dem Weg" — die Zeile wird grün.
const KAUM_UMWEG_MIN = 2;

const begrenzt = (wert) => Math.min(PLAETZE_MAX, Math.max(PLAETZE_MIN, Math.round(Number(wert) || PLAETZE_MIN)));
const danach = (wert, weiter) => (wert && typeof wert.then === 'function' ? wert.then(weiter) : weiter(wert));

// --- Rechnung ------------------------------------------------------------------------------

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

// Reihenfolge der schon eingestiegenen Mitfahrer — dieselbe gierige Einfügung wie beim Vorschlag.
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
  const direktKm = wegKm(start, ziel);
  const laengeKm = routenLaenge(start, route, ziel);
  return { stopps: route, umwegKm: Math.max(0, laengeKm - direktKm), laengeKm, direktKm };
}

// fahrer[].stopps ist die feste, schon geordnete Route des Autos (nur Stopps mit Lage).
export function mitfahrVorschlag({ ziel, fahrer = [], suchende = [] } = {}) {
  const ergebnis = {
    zuordnungen: [],
    fahrer: [],
    ohnePlatz: [],
    ohneLage: suchende.filter((eintrag) => !hatLage(eintrag.lage)).map((eintrag) => eintrag.id),
  };
  const offen = suchende.filter((eintrag) => hatLage(eintrag.lage));
  if (!hatLage(ziel)) {
    ergebnis.ohnePlatz = [];
    return ergebnis;
  }
  const autos = fahrer
    .filter((auto) => hatLage(auto.lage) && auto.frei > 0)
    .map((auto) => {
      const stopps = (auto.stopps || []).filter((stopp) => hatLage(stopp.lage));
      return { id: auto.id, lage: auto.lage, frei: auto.frei, stopps: [...stopps], vorherKm: routenLaenge(auto.lage, stopps, ziel), neu: [] };
    });
  while (offen.length) {
    let wahl = null;
    for (const auto of autos) {
      if (auto.frei <= 0) continue;
      offen.forEach((stopp, nr) => {
        const einfuegung = besteEinfuegung(auto.lage, auto.stopps, ziel, stopp.lage);
        if (!wahl || einfuegung.kosten < wahl.kosten - 1e-9) wahl = { auto, nr, ...einfuegung };
      });
    }
    if (!wahl) break;
    const stopp = offen.splice(wahl.nr, 1)[0];
    wahl.auto.stopps.splice(wahl.index, 0, stopp);
    wahl.auto.frei -= 1;
    wahl.auto.neu.push(stopp.id);
    ergebnis.zuordnungen.push({ mitfahrerId: stopp.id, fahrerId: wahl.auto.id, kostenKm: wahl.kosten });
  }
  ergebnis.ohnePlatz = offen.map((stopp) => stopp.id);
  ergebnis.fahrer = autos.filter((auto) => auto.neu.length).map((auto) => {
    const umwegKm = Math.max(0, routenLaenge(auto.lage, auto.stopps, ziel) - auto.vorherKm);
    return { fahrerId: auto.id, neu: auto.neu, reihenfolge: auto.stopps.map((stopp) => stopp.id), umwegKm, umwegMin: minutenFuerKm(umwegKm) };
  });
  return ergebnis;
}

// Apple (Unified Maps URLs, ab iOS 18.4 mit Zwischenzielen) und Google. Ohne Start — die Karten-App
// nimmt den Ort, an dem der Fahrer gerade ist.
export function mitfahrRouteUrl(ziel, stopps = [], anbieter = 'apple') {
  if (!hatLage(ziel)) return null;
  const punkt = (lage) => `${Number(lage.lat.toFixed(5))},${Number(lage.lon.toFixed(5))}`;
  const zwischen = stopps.map((stopp) => stopp?.lage || stopp).filter(hatLage);
  if (anbieter === 'google') {
    const wege = zwischen.length ? `&waypoints=${encodeURIComponent(zwischen.map(punkt).join('|'))}` : '';
    return `https://www.google.com/maps/dir/?api=1&destination=${encodeURIComponent(punkt(ziel))}${wege}&travelmode=driving`;
  }
  const wege = zwischen.map((lage) => `&waypoint=${encodeURIComponent(punkt(lage))}`).join('');
  return `https://maps.apple.com/directions?destination=${encodeURIComponent(punkt(ziel))}${wege}&mode=driving`;
}

// --- Daten ---------------------------------------------------------------------------------

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

// Mitglieder wie ui/meet-panels.js meetMemberIds — hier nachgebildet, weil meet-panels.js diesen
// Baustein importiert (ein Rückimport wäre ein Kreis).
function mitglieder(repo, meet) {
  if (meet?.crewId) {
    const crew = repo.getCrew?.(meet.crewId);
    if (crew) return crew.memberIds || [];
  }
  return [...new Set([ME, meet?.creatorId, ...(meet?.personIds || []), ...Object.keys(meet?.participation || {})])].filter(Boolean);
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
      try { gefunden = repo.getPerson(id) || null; } catch { gefunden = null; }
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
  const mitRolle = new Set([...fahrerIds, ...zuordnung.keys(), ...suchen, ...selbst]);
  const offen = mitglieder(repo, meet).filter((id) => teilnahme[id] === 'yes' && person(id) && !mitRolle.has(id));

  const ziel = meet && !meet.placePending && hatLage(meet.place)
    ? { lat: meet.place.lat, lon: meet.place.lon, name: meet.place.name || '' }
    : null;

  for (const auto of fahrer) {
    const stopps = auto.mitfahrer.map((id) => ({ id, lage: lageVon(repo, id) }));
    auto.ohneLage = stopps.filter((stopp) => !stopp.lage).map((stopp) => stopp.id);
    const mitLage = stopps.filter((stopp) => stopp.lage);
    const route = ziel && auto.lage ? abholReihenfolge(auto.lage, ziel, mitLage) : null;
    auto.geordnet = Boolean(route);
    auto.routeStopps = route ? route.stopps : mitLage;
    auto.reihenfolge = auto.routeStopps.map((stopp) => stopp.id);
    auto.umwegKm = route && route.stopps.length ? route.umwegKm : null;
  }

  const lagen = new Map(suchen.map((id) => [id, lageVon(repo, id)]));
  const vorschlag = mitfahrVorschlag({
    ziel,
    fahrer: fahrer.map((auto) => ({ id: auto.id, lage: auto.lage, frei: auto.frei, stopps: auto.routeStopps })),
    suchende: suchen.map((id) => ({ id, lage: lagen.get(id) })),
  });

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
    offen,
    lagen,
    zuordnung,
    rolleVon,
    meine: { rolle: rolleVon(ME), fahrerId: zuordnung.get(ME) || null, abgesagt: teilnahme[ME] === 'no', lage: lageVon(repo, ME) },
    vorschlag,
  };
}

// Dieselben Regeln wie repo.assignRide — nur so zeigt die Oberfläche keine Knöpfe, die abgelehnt würden.
function darfZuordnen(stand, mitfahrerId, fahrerId) {
  const ersteller = ME === stand.creatorId;
  if (fahrerId) {
    if (fahrerId === mitfahrerId) return false;
    if (stand.rolleVon(mitfahrerId) === 'fahrer' && ME !== mitfahrerId && !ersteller) return false;
    return ME === mitfahrerId || ersteller || ME === fahrerId;
  }
  return ME === mitfahrerId || ersteller || stand.zuordnung.get(mitfahrerId) === ME;
}

// --- Bausteine der Oberfläche --------------------------------------------------------------

function nameVon(r, id) {
  if (id === ME) return t('Du');
  return r.repo.getPerson(id)?.name || t('Jemand');
}

function namenListe(r, ids) {
  return ids.map((id) => nameVon(r, id)).join(', ');
}

function gesicht(r, id, size, ring = '') {
  const person = r.repo.getPerson(id);
  if (!person) return '';
  const avatar = personAvatar(person, {
    size, fontSize: Math.round(size * 0.36), marker: personMarker(person.id, r.settings), active: false, free: false, compact: size < 26,
  });
  return `<span style="display:flex;flex:none;border-radius:50%;pointer-events:none;${ring}">${avatar}</span>`;
}

function umwegText(km, fuerMich = false) {
  const minuten = Math.round(minutenFuerKm(km));
  if (minuten <= 0) return fuerMich ? t('kein Umweg für dich') : t('kein Umweg');
  return fuerMich ? t('~{n} min Umweg für dich', { n: minuten }) : t('~{n} min Umweg', { n: minuten });
}

const autoGlyph = (farbe = 'var(--ink)', size = 16) => ressourcenIconSvg('Auto', farbe, size, 'auto');

function chevronGlyph(offen, farbe) {
  const pfad = offen ? 'm6 14.5 6-6 6 6' : 'm6 9.5 6 6 6-6';
  return `<svg width="13" height="13" viewBox="0 0 24 24" fill="none"><path d="${pfad}" stroke="${farbe}" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"></path></svg>`;
}

const kreuzGlyph = (farbe = 'var(--muted)') => `<svg width="13" height="13" viewBox="0 0 24 24" fill="none"><path d="M7 7l10 10M17 7 7 17" stroke="${farbe}" stroke-width="2.2" stroke-linecap="round"></path></svg>`;
const plusGlyph = (farbe = 'var(--ink)') => `<svg width="14" height="14" viewBox="0 0 24 24" fill="none"><path d="M12 5v14M5 12h14" stroke="${farbe}" stroke-width="2.4" stroke-linecap="round"></path></svg>`;
const minusGlyph = (farbe = 'var(--ink)') => `<svg width="14" height="14" viewBox="0 0 24 24" fill="none"><path d="M5 12h14" stroke="${farbe}" stroke-width="2.4" stroke-linecap="round"></path></svg>`;
const pinGlyph = (farbe = 'var(--green-dark)') => `<svg width="12" height="12" viewBox="0 0 24 24" fill="none"><path d="M12 21.5s7-6.1 7-11a7 7 0 1 0-14 0c0 4.9 7 11 7 11Z" stroke="${farbe}" stroke-width="2.2" stroke-linejoin="round"></path><circle cx="12" cy="10.5" r="2.4" fill="${farbe}"></circle></svg>`;
const routeGlyph = (farbe = 'var(--ink)') => `<svg width="14" height="14" viewBox="0 0 24 24" fill="none"><path d="M6 19h9a3.5 3.5 0 0 0 0-7H9a3.5 3.5 0 0 1 0-7h9" stroke="${farbe}" stroke-width="1.8" stroke-linecap="round"></path><circle cx="4.5" cy="19" r="1.8" fill="${farbe}"></circle><circle cx="19.5" cy="5" r="1.8" fill="${farbe}"></circle></svg>`;

// Eine Pille, die in einer 44 px hohen Trefferfläche sitzt.
function pillenKnopf(act, label, options = {}) {
  const gruen = options.ton === 'gruen';
  const pille = gruen
    ? 'background:var(--green-tint);color:var(--green-dark);box-shadow:inset 0 0 0 1px var(--green-a30)'
    : 'background:var(--field);color:var(--ink)';
  const daten = Object.entries(options.daten || {}).map(([key, wert]) => ` data-${key}="${esc(wert)}"`).join('');
  const aria = options.aria ? ` aria-label="${esc(options.aria)}"` : '';
  return `<button data-act="${act}"${daten}${aria} style="min-height:44px;min-width:44px;border:0;background:transparent;padding:0;display:flex;align-items:center;justify-content:center;flex:none;cursor:pointer;appearance:none;font-family:${FONT}"><span style="pointer-events:none;display:flex;align-items:center;height:32px;padding:0 13px;border-radius:999px;${pille};font:650 12.5px/1 ${FONT};white-space:nowrap">${esc(label)}</span></button>`;
}

function marke(label) {
  return `<span data-role="mitfahren-voll" style="flex:none;display:flex;align-items:center;height:26px;padding:0 10px;border-radius:999px;background:var(--field);color:var(--muted);font:650 11.5px/1 ${FONT};white-space:nowrap">${esc(label)}</span>`;
}

// --- Leiste ---------------------------------------------------------------------------------

function leistenStatus(stand) {
  const suchend = stand.suchen.length;
  const frei = stand.fahrer.reduce((summe, auto) => summe + auto.frei, 0);
  if (suchend) return { text: tn(suchend, '{n} sucht', '{n} suchen'), farbe: 'var(--orange-dark)' };
  if (!stand.fahrer.length) return { text: t('Wer fährt?'), farbe: 'var(--muted)' };
  if (frei) return { text: tn(frei, '{n} Platz frei', '{n} Plätze frei'), farbe: 'var(--muted)' };
  return { text: t('alle Plätze belegt'), farbe: 'var(--muted)' };
}

export function mitfahrenKachel(ctx, meet, options = {}) {
  if (!mitfahrenMoeglich(meet)) return '';
  const stand = options.stand || mitfahrStand(ctx.repo, meet);
  const r = { ctx, repo: ctx.repo, settings: ctx.repo.getSettings() };
  const offen = options.offen ?? (ctx.ui?.mitfahren === meet.id);
  const kompakt = Boolean(options.kompakt);
  const status = leistenStatus(stand);
  const grund = kompakt ? 'var(--paper)' : (offen ? 'var(--field)' : 'var(--surface)');
  const groesse = kompakt ? 18 : 22;
  const ueberlapp = Math.round(groesse * 0.28);
  const gezeigt = stand.fahrer.slice(0, 3);
  const stapel = gezeigt.map((auto, index) => `<span style="display:flex;flex:none;border-radius:50%;${index ? `margin-left:-${ueberlapp}px;` : ''}${stackSeparator(grund)}">${gesicht(r, auto.id, groesse)}</span>`).join('');
  const mehr = stand.fahrer.length > gezeigt.length
    ? `<span style="font:650 11px/1 ${FONT};color:var(--muted);margin-left:3px">+${stand.fahrer.length - gezeigt.length}</span>`
    : '';
  const act = options.act || 'mitfahren-auf';
  const panel = options.panel ? ` data-panel="${esc(options.panel)}"` : '';
  const hinweis = offen
    ? `${t('{bereich} zuklappen', { bereich: t('Mitfahren') })} · ${status.text}`
    : `${t('Mitfahren')} · ${status.text}`;
  const look = kompakt
    ? `background:${grund};border:0;border-radius:12px;min-height:38px;padding:0 11px`
    : `background:${grund};border:1px solid ${offen ? 'var(--ink-a22)' : 'var(--ink-a10)'};border-radius:18px;height:46px;padding:0 12px 0 14px`;
  return `<button data-act="${esc(act)}"${panel} data-meet="${esc(meet.id)}" data-role="mitfahren-kachel" data-suchen="${stand.suchen.length}" data-fahrer="${stand.fahrer.length}"${kompakt ? ' data-treffer' : ''} aria-expanded="${offen}" aria-label="${esc(hinweis)}" style="${look};width:100%;display:flex;align-items:center;gap:8px;box-sizing:border-box;cursor:pointer;appearance:none;font-family:${FONT};color:var(--ink);text-align:left;flex:none">
<span style="pointer-events:none;display:flex">${autoGlyph('var(--ink)', kompakt ? 14 : 16)}</span>
<span style="font-size:${kompakt ? 12 : 13}px;font-weight:650;flex:none;pointer-events:none">${esc(t('Mitfahren'))}</span>
<span style="flex:1;min-width:0;display:flex;align-items:center;justify-content:flex-end;gap:7px;pointer-events:none">${stapel ? `<span style="display:flex;align-items:center;flex:none">${stapel}${mehr}</span>` : ''}<span data-role="mitfahren-status" style="font-size:${kompakt ? 11.5 : 12.5}px;font-weight:650;color:${status.farbe};white-space:nowrap;overflow:hidden;text-overflow:ellipsis;min-width:0">${esc(status.text)}</span></span>
<span style="pointer-events:none;display:flex;align-items:center;justify-content:center;width:22px;height:22px;flex:none">${chevronGlyph(offen, offen ? 'var(--ink)' : 'var(--muted-light)')}</span>
</button>`;
}

// --- Inhalt: eigene Rolle --------------------------------------------------------------------

function duZeile(r) {
  const { ctx, stand, meet } = r;
  const text = (inhalt, farbe = 'var(--ink-soft)') => `<span style="flex:1;min-width:0;font-size:12.5px;line-height:1.35;color:${farbe}">${inhalt}</span>`;
  const mein = stand.fahrer.find((auto) => auto.id === ME);

  const frage = ctx.ui?.mitfahrenFrage;
  if (frage && frage.meetId === meet.id && mein?.mitfahrer.length) {
    const anzahl = mein.mitfahrer.length;
    const namen = namenListe(r, mein.mitfahrer);
    // Höchstens zwei Zeilen: die Zeile behält ihre Höhe, darunter rückt nichts.
    const satz = anzahl === 1 ? t('{namen} sucht dann wieder.', { namen }) : t('{namen} suchen dann wieder.', { namen });
    return `<span data-role="mitfahren-frage" style="flex:1;min-width:0;font-size:12px;line-height:1.3;color:var(--ink);display:-webkit-box;-webkit-box-orient:vertical;-webkit-line-clamp:2;overflow:hidden">${esc(satz)}</span>
${pillenKnopf('mitfahren-frage-nein', t('Abbrechen'))}${pillenKnopf('mitfahren-frage-ja', t('Ändern'), { ton: 'gruen' })}`;
  }

  if (stand.meine.rolle === 'fahrer' && mein) {
    const min = Math.max(PLAETZE_MIN, mein.mitfahrer.length);
    const schritt = (wert, glyph, aria, aus) => `<button data-act="mitfahren-plaetze" data-schritt="${wert}" aria-label="${esc(aria)}"${aus ? ' aria-disabled="true"' : ''} style="width:44px;height:44px;border:0;background:transparent;padding:0;display:flex;align-items:center;justify-content:center;flex:none;cursor:pointer;appearance:none"><span style="pointer-events:none;width:32px;height:32px;border-radius:50%;background:var(--field);display:flex;align-items:center;justify-content:center;opacity:${aus ? 0.4 : 1}">${glyph}</span></button>`;
    // Wie viele belegt sind, steht direkt darunter in der eigenen Autokarte — hier nur der Regler.
    return `<span style="flex:1;min-width:0;font-size:13px;font-weight:650;color:var(--ink)">${esc(t('Plätze für Mitfahrer'))}</span>
${schritt(-1, minusGlyph(), t('Ein Platz weniger'), mein.plaetze <= min)}<span data-role="mitfahren-plaetze-zahl" style="min-width:20px;text-align:center;font:700 17px/1 ${FONT};font-variant-numeric:tabular-nums;color:var(--ink)">${mein.plaetze}</span>${schritt(1, plusGlyph(), t('Ein Platz mehr'), mein.plaetze >= PLAETZE_MAX)}`;
  }

  if (stand.meine.rolle === 'mitfahrer' && stand.meine.fahrerId) {
    const name = nameVon(r, stand.meine.fahrerId);
    return `${gesicht(r, stand.meine.fahrerId, 26)}${text(esc(t('Du fährst mit {name}', { name })), 'var(--ink)')}${pillenKnopf('mitfahren-aussteigen', t('Aussteigen'))}`;
  }

  if (stand.meine.rolle === 'mitfahrer') {
    const vorgeschlagen = stand.vorschlag.zuordnungen.find((zuordnung) => zuordnung.mitfahrerId === ME);
    let unter = '';
    if (!stand.meine.lage) unter = t('ohne Standort — selbst absprechen');
    else if (vorgeschlagen) unter = t('Vorschlag: {name} holt dich ab', { name: nameVon(r, vorgeschlagen.fahrerId) });
    return text(`<span style="display:block;color:var(--ink);font-weight:600">${esc(t('Du suchst eine Mitfahrt.'))}</span>${unter ? `<span style="display:block;color:var(--muted);font-size:11.5px">${esc(unter)}</span>` : ''}`);
  }

  if (stand.meine.rolle === 'selbst') return text(esc(t('Du kommst selbst hin.')), 'var(--ink)');
  return text(esc(t('Ein Tipp genügt — so wissen alle, wer wen abholt.')), 'var(--muted)');
}

function rollenBlock(r) {
  const { stand, kompakt } = r;
  if (stand.meine.abgesagt) {
    return `<div data-role="mitfahren-du" style="min-height:44px;display:flex;align-items:center"><span style="font-size:12.5px;color:var(--muted);line-height:1.4">${esc(t('Du hast abgesagt — hier siehst du nur, wer fährt.'))}</span></div>`;
  }
  const rollen = [
    { rolle: 'fahrer', label: t('Ich fahre'), aria: t('Ich fahre') },
    { rolle: 'mitfahrer', label: t('Brauche Mitfahrt'), aria: t('Ich brauche eine Mitfahrt') },
    { rolle: 'selbst', label: t('Komme selbst'), aria: t('Ich komme selbst') },
  ];
  const knoepfe = rollen.map(({ rolle, label, aria }) => {
    const an = stand.meine.rolle === rolle;
    const look = an
      ? 'background:var(--surface);color:var(--green-dark);box-shadow:0 1px 3px var(--shadow-12),inset 0 0 0 1.5px var(--green-a40)'
      : 'background:transparent;color:var(--ink-soft)';
    return `<button data-act="mitfahren-rolle" data-rolle="${rolle}" aria-pressed="${an}" aria-label="${esc(aria)}" style="flex:1;min-width:0;min-height:44px;border:0;border-radius:11px;padding:4px 6px;${look};cursor:pointer;appearance:none;font-family:${FONT};text-align:center"><span style="pointer-events:none;display:block;font-size:${kompakt ? 12 : 12.5}px;font-weight:${an ? 700 : 600};line-height:1.2">${esc(label)}</span></button>`;
  }).join('');
  return `<div data-role="mitfahren-du" style="display:flex;flex-direction:column;gap:8px">
<div role="group" aria-label="${esc(t('Wie kommst du hin?'))}" style="display:flex;gap:3px;padding:3px;border-radius:14px;background:var(--field)">${knoepfe}</div>
<div data-role="mitfahren-du-zeile" style="min-height:44px;display:flex;align-items:center;gap:8px">${duZeile(r)}</div>
</div>`;
}

// --- Inhalt: Autos --------------------------------------------------------------------------

function stoppZeile(r, auto, id, zeichen, zusatz = '') {
  const absetzbar = id !== ME && (auto.id === ME || ME === r.stand.creatorId);
  const name = nameVon(r, id);
  const knopf = absetzbar
    ? `<button data-act="mitfahren-absetzen" data-person="${esc(id)}" aria-label="${esc(t('{name} absetzen', { name }))}" style="width:44px;height:44px;margin-right:-10px;border:0;background:transparent;padding:0;display:flex;align-items:center;justify-content:center;flex:none;cursor:pointer;appearance:none">${kreuzGlyph()}</button>`
    : '';
  return `<li data-role="mitfahren-stopp" data-person="${esc(id)}" style="position:relative;display:flex;align-items:center;gap:9px;min-height:${absetzbar ? 44 : 30}px">
<span aria-hidden="true" style="position:relative;z-index:1;width:20px;height:20px;border-radius:50%;background:var(--surface);box-shadow:inset 0 0 0 1.5px var(--ink-a20);display:flex;align-items:center;justify-content:center;font:700 10.5px/1 ${FONT};color:var(--ink-soft);flex:none">${esc(zeichen)}</span>
${gesicht(r, id, 22)}
<span style="flex:1;min-width:0;font-size:13px;font-weight:600;color:var(--ink);white-space:nowrap;overflow:hidden;text-overflow:ellipsis">${esc(name)}${zusatz ? `<span style="font-weight:500;color:var(--muted)"> · ${esc(zusatz)}</span>` : ''}</span>
${knopf}</li>`;
}

function autoKarte(r, auto, index) {
  const { stand, kompakt } = r;
  const ich = auto.id === ME;
  const name = nameVon(r, auto.id);
  const titel = ich ? t('Du fährst') : t('{name} fährt', { name });
  const belegt = auto.mitfahrer.length;
  const plaetze = auto.plaetze;

  let aktion = '';
  if (stand.meine.fahrerId === auto.id) {
    aktion = `<span style="flex:none;display:flex;align-items:center;height:26px;padding:0 10px;border-radius:999px;background:var(--green-tint);color:var(--green-dark);font:650 11.5px/1 ${FONT};white-space:nowrap">${esc(t('mit dir'))}</span>`;
  } else if (!ich && !stand.meine.abgesagt && (stand.meine.rolle === 'mitfahrer' || stand.meine.rolle === null)) {
    aktion = auto.frei
      ? pillenKnopf('mitfahren-einsteigen', t('Einsteigen'), { ton: 'gruen', daten: { fahrer: auto.id }, aria: t('Bei {name} einsteigen', { name }) })
      : marke(t('Voll'));
  }
  const vollChip = aktion.includes('data-role="mitfahren-voll"');
  const unter = `${tn(plaetze, '{belegt} von {n} Platz', '{belegt} von {n} Plätzen', { belegt })}${!auto.frei && !vollChip ? ` · ${t('voll')}` : ''}`;

  const ziel = stand.ziel;
  const zielName = ziel ? (ziel.name || t('Ziel')) : '';
  let verlauf = '';
  if (kompakt) {
    const teile = auto.reihenfolge.map((id) => nameVon(r, id));
    const kette = auto.geordnet ? [...teile, ...(teile.length ? [zielName] : [])].join(' → ') : teile.join(' · ');
    const rest = [
      ...(auto.umwegKm != null ? [umwegText(auto.umwegKm)] : []),
      ...auto.ohneLage.map((id) => `${nameVon(r, id)} ${t('ohne Standort')}`),
    ];
    const zeile = [kette, ...rest].filter(Boolean).join(' · ');
    if (zeile) verlauf = `<div data-role="mitfahren-reihenfolge" style="font-size:12px;line-height:1.4;color:var(--ink-soft);padding-left:40px">${esc(zeile)}</div>`;
  } else if (belegt) {
    const zeilen = [
      ...auto.reihenfolge.map((id, nr) => stoppZeile(r, auto, id, auto.geordnet ? String(nr + 1) : '•')),
      ...auto.ohneLage.map((id) => stoppZeile(r, auto, id, '?', t('ohne Standort'))),
    ];
    if (ziel) {
      zeilen.push(`<li data-role="mitfahren-ziel" style="position:relative;display:flex;align-items:center;gap:9px;min-height:30px">
<span aria-hidden="true" style="position:relative;z-index:1;width:20px;height:20px;border-radius:50%;background:var(--green-tint);display:flex;align-items:center;justify-content:center;flex:none">${pinGlyph()}</span>
<span style="flex:1;min-width:0;font-size:12.5px;color:var(--ink-soft);white-space:nowrap;overflow:hidden;text-overflow:ellipsis">${esc(zielName)}${auto.umwegKm != null ? ` · ${esc(umwegText(auto.umwegKm))}` : ''}</span>
</li>`);
    }
    verlauf = `<ol data-role="mitfahren-reihenfolge" aria-label="${esc(t('Abholreihenfolge'))}" style="position:relative;list-style:none;margin:0;padding:0 0 0 5px;display:flex;flex-direction:column">${zeilen.join('')}</ol>`;
  }

  const route = ich && ziel && auto.routeStopps.length
    ? `<div data-role="mitfahren-route" style="display:flex;flex-direction:column;gap:4px;padding-left:${kompakt ? 0 : 34}px">
<span style="font-size:11.5px;color:var(--muted)">${esc(t('Route mit Abholungen'))}</span>
<div style="display:flex;gap:8px">
<button data-act="mitfahren-route" data-anbieter="apple" aria-label="${esc(t('Route mit Abholungen in {karte} öffnen', { karte: 'Apple Maps' }))}" style="flex:1;min-width:0;min-height:44px;border-radius:12px;border:1px solid var(--ink-a12);background:transparent;display:flex;align-items:center;justify-content:center;gap:6px;padding:0 8px;cursor:pointer;appearance:none;font:650 12.5px ${FONT};color:var(--ink)"><span style="pointer-events:none;display:flex">${routeGlyph()}</span><span style="pointer-events:none;white-space:nowrap">Apple Maps</span></button>
<button data-act="mitfahren-route" data-anbieter="google" aria-label="${esc(t('Route mit Abholungen in {karte} öffnen', { karte: 'Google Maps' }))}" style="flex:1;min-width:0;min-height:44px;border-radius:12px;border:1px solid var(--ink-a12);background:transparent;display:flex;align-items:center;justify-content:center;gap:6px;padding:0 8px;cursor:pointer;appearance:none;font:650 12.5px ${FONT};color:var(--ink)"><span style="pointer-events:none;display:flex">${routeGlyph()}</span><span style="pointer-events:none;white-space:nowrap">Google Maps</span></button>
</div>
</div>`
    : '';

  const umwegMin = auto.umwegKm != null ? Math.round(minutenFuerKm(auto.umwegKm)) : '';
  return `<div data-role="mitfahren-auto" data-fahrer="${esc(auto.id)}" data-plaetze="${plaetze}" data-belegt="${belegt}" data-reihenfolge="${esc(auto.reihenfolge.join(','))}" data-umweg-min="${umwegMin}" style="display:flex;flex-direction:column;gap:4px${index ? ';border-top:1px solid var(--ink-a06);padding-top:10px' : ''}">
<div style="display:flex;align-items:center;gap:10px;min-height:44px">
${gesicht(r, auto.id, kompakt ? 28 : 30)}
<span style="flex:1;min-width:0;display:flex;flex-direction:column;gap:1px"><span style="font-size:${kompakt ? 13 : 14}px;font-weight:650;color:var(--ink);white-space:nowrap;overflow:hidden;text-overflow:ellipsis">${esc(titel)}</span><span data-role="mitfahren-belegt" style="font-size:12px;color:var(--muted);white-space:nowrap;overflow:hidden;text-overflow:ellipsis">${esc(unter)}</span></span>
${aktion}
</div>
${verlauf}
${route}
</div>`;
}

function autosBlock(r) {
  const { stand } = r;
  if (!stand.fahrer.length) {
    return `<div data-role="mitfahren-autos" data-leer="1" style="font-size:12.5px;color:var(--muted);line-height:1.4">${esc(t('Noch fährt niemand.'))}</div>`;
  }
  return `<div data-role="mitfahren-autos" style="display:flex;flex-direction:column;gap:10px">${stand.fahrer.map((auto, index) => autoKarte(r, auto, index)).join('')}</div>`;
}

// --- Inhalt: wer noch sucht ------------------------------------------------------------------

function suchenBlock(r) {
  const { stand } = r;
  if (!stand.suchen.length) return '';
  const mein = stand.fahrer.find((auto) => auto.id === ME);
  const anzahl = stand.suchen.length;
  const zeilen = stand.suchen.map((id) => {
    const lage = stand.lagen.get(id);
    const name = nameVon(r, id);
    let unter = '';
    let farbe = 'var(--muted)';
    let umwegMin = '';
    if (!lage) {
      unter = t('ohne Standort — selbst absprechen');
    } else if (mein && mein.lage && stand.ziel && id !== ME) {
      // Jonathan: „… zeigt es mir, wenn ich gut mitnehmen kann" — der Umweg für MEIN Auto, mit den
      // Mitfahrern, die schon drin sind.
      const einfuegung = besteEinfuegung(mein.lage, mein.routeStopps, stand.ziel, lage);
      umwegMin = Math.round(minutenFuerKm(einfuegung.kosten));
      unter = umwegText(einfuegung.kosten, true);
      if (umwegMin <= KAUM_UMWEG_MIN) farbe = 'var(--green-dark)';
    }
    let aktion = '';
    if (mein && id !== ME) {
      aktion = mein.frei
        ? pillenKnopf('mitfahren-mitnehmen', t('Mitnehmen'), { ton: 'gruen', daten: { person: id }, aria: t('{name} mitnehmen', { name }) })
        : marke(t('Voll'));
    }
    return `<div data-role="mitfahren-sucht" data-person="${esc(id)}" data-umweg-min="${umwegMin}" style="display:flex;align-items:center;gap:10px;min-height:44px">
${gesicht(r, id, 28)}
<span style="flex:1;min-width:0;display:flex;flex-direction:column;gap:1px"><span style="font-size:13.5px;font-weight:650;color:var(--ink);white-space:nowrap;overflow:hidden;text-overflow:ellipsis">${esc(name)}</span>${unter ? `<span data-role="mitfahren-umweg" style="font-size:11.5px;line-height:1.3;color:${farbe};display:-webkit-box;-webkit-box-orient:vertical;-webkit-line-clamp:2;overflow:hidden">${esc(unter)}</span>` : ''}</span>
${aktion}</div>`;
  }).join('');
  const frei = stand.fahrer.reduce((summe, auto) => summe + auto.frei, 0);
  const voll = stand.fahrer.length && !frei
    ? `<span data-role="mitfahren-alle-voll" style="font-size:12px;color:var(--muted);line-height:1.4">${esc(t('Alle Autos sind voll.'))}</span>`
    : '';
  return `<div data-role="mitfahren-suchen" style="display:flex;flex-direction:column;gap:2px">
<span style="font-size:10.5px;font-weight:650;letter-spacing:.07em;text-transform:uppercase;color:var(--orange-dark)">${esc(tn(anzahl, '{n} sucht noch', '{n} suchen noch'))}</span>
${zeilen}${voll}</div>`;
}

// --- Inhalt: Vorschlag -----------------------------------------------------------------------

function vorschlagBlock(r) {
  const { stand } = r;
  const vorschlag = stand.vorschlag;
  if (!vorschlag.fahrer.length) return '';
  const erlaubt = vorschlag.zuordnungen.filter((zuordnung) => darfZuordnen(stand, zuordnung.mitfahrerId, zuordnung.fahrerId));
  const alle = erlaubt.length === vorschlag.zuordnungen.length;
  const zeilen = vorschlag.fahrer.map((auto) => {
    const namen = auto.reihenfolge.filter((id) => auto.neu.includes(id)).map((id) => nameVon(r, id)).join(' → ');
    const text = auto.fahrerId === ME
      ? t('Du holst {namen} ab', { namen })
      : t('{name} holt {namen} ab', { name: nameVon(r, auto.fahrerId), namen });
    return `<div data-role="vorschlag-auto" data-fahrer="${esc(auto.fahrerId)}" data-neu="${esc(auto.neu.join(','))}" data-reihenfolge="${esc(auto.reihenfolge.join(','))}" data-umweg-km="${auto.umwegKm.toFixed(3)}" data-umweg-min="${Math.round(auto.umwegMin)}" style="display:flex;align-items:center;gap:9px;min-height:30px">
${gesicht(r, auto.fahrerId, 22)}
<span style="flex:1;min-width:0;font-size:13px;line-height:1.35;color:var(--ink)"><span style="font-weight:650">${esc(text)}</span><span style="color:var(--ink-soft)"> · ${esc(umwegText(auto.umwegKm))}</span></span>
</div>`;
  }).join('');
  const ohnePlatz = vorschlag.ohnePlatz.length
    ? `<span data-role="vorschlag-ohne-platz" style="font-size:12px;color:var(--muted);line-height:1.4">${esc(t('Kein Platz mehr für {namen}', { namen: namenListe(r, vorschlag.ohnePlatz) }))}</span>`
    : '';
  const knopf = erlaubt.length
    ? `<button data-act="mitfahren-vorschlag" data-anzahl="${erlaubt.length}" style="min-height:44px;border:0;border-radius:999px;background:var(--green);color:var(--on-accent);padding:0 18px;cursor:pointer;appearance:none;font:650 13px ${FONT}"><span style="pointer-events:none">${esc(alle ? t('Vorschlag übernehmen') : t('Meinen Teil übernehmen'))}</span></button>`
    : '';
  let notiz = '';
  if (!alle) notiz = erlaubt.length ? t('Den Rest können die Fahrer übernehmen.') : t('Übernehmen können Fahrer, Mitfahrer oder wer das Meet erstellt hat.');
  return `<div data-role="mitfahren-vorschlag" style="background:var(--orange-dark-a08);border:1px solid var(--orange-dark-a28);border-radius:14px;padding:10px 12px 12px;display:flex;flex-direction:column;gap:8px">
<div style="display:flex;align-items:baseline;gap:8px"><span style="font-size:10.5px;font-weight:650;letter-spacing:.07em;text-transform:uppercase;color:var(--orange-dark)">${esc(t('Vorschlag'))}</span><span style="font-size:11px;color:var(--muted)">${esc(t('grob nach Luftlinie'))}</span></div>
${zeilen}${ohnePlatz}${knopf}${notiz ? `<span style="font-size:11.5px;color:var(--muted);line-height:1.4">${esc(notiz)}</span>` : ''}
</div>`;
}

function restBlock(r) {
  const { stand } = r;
  const zeilen = [];
  if (stand.selbst.length) zeilen.push(`<span data-role="mitfahren-selbst">${esc(t('Kommen selbst: {namen}', { namen: namenListe(r, stand.selbst) }))}</span>`);
  if (stand.offen.length) zeilen.push(`<span data-role="mitfahren-offen">${esc(t('Noch ohne Angabe: {namen}', { namen: namenListe(r, stand.offen) }))}</span>`);
  if (!zeilen.length) return '';
  return `<div data-role="mitfahren-rest" style="display:flex;flex-direction:column;gap:4px;font-size:12px;color:var(--muted);line-height:1.4">${zeilen.join('')}</div>`;
}

export function mitfahrenInhalt(ctx, meet, options = {}) {
  if (!mitfahrenMoeglich(meet)) return '';
  const r = {
    ctx, repo: ctx.repo, meet, settings: ctx.repo.getSettings(), kompakt: Boolean(options.kompakt),
    stand: options.stand || mitfahrStand(ctx.repo, meet),
  };
  const teile = [rollenBlock(r), autosBlock(r), suchenBlock(r), vorschlagBlock(r), restBlock(r)].filter(Boolean);
  const rahmen = r.kompakt
    ? 'background:var(--paper);border-radius:12px;padding:8px 12px 12px'
    : 'background:var(--surface);border:1px solid var(--ink-a10);border-radius:18px;padding:12px 14px 14px';
  const mitTrenner = teile.map((html, index) => (index ? `<div style="border-top:1px solid var(--ink-a07);padding-top:12px">${html}</div>` : html));
  return `<div data-role="mitfahren-inhalt" data-meet="${esc(meet.id)}" style="${rahmen};display:flex;flex-direction:column;gap:12px;flex:none;font-family:${FONT};color:var(--ink)">${mitTrenner.join('')}</div>`;
}

export function mitfahrenBereich(ctx, meet, options = {}) {
  if (!mitfahrenMoeglich(meet)) return '';
  const stand = mitfahrStand(ctx.repo, meet);
  const offen = ctx.ui?.mitfahren === meet.id;
  return `${mitfahrenKachel(ctx, meet, { ...options, stand, offen })}${offen ? mitfahrenInhalt(ctx, meet, { ...options, stand }) : ''}`;
}

// --- Handler ---------------------------------------------------------------------------------

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

export function mitfahrenAktionen(ctx, meet) {
  const { repo } = ctx;
  const meetId = meet.id;
  const ui = () => ctx.ui || {};
  const aktuell = () => mitfahrStand(repo, repo.getMeet(meetId) || meet);
  // Ergebnis zurückmelden: abgelehnt → Vibration „abgelehnt" und ein kurzer Satz, sonst die leise
  // Bestätigung. Die sichtbare Änderung selbst ist die Rückmeldung — kein Toast bei Erfolg.
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
  const rolleSetzen = (rolle) => {
    ui().mitfahrenFrage = null;
    if (ohneDaten()) { ctx.render(); return; }
    const eingabe = rolle === 'fahrer' ? { rolle, plaetze: standardPlaetze(repo) } : { rolle };
    melden(repo.setRide(meetId, eingabe));
    ctx.render();
  };

  return {
    'mitfahren-auf': () => {
      const zustand = ui();
      zustand.mitfahren = zustand.mitfahren === meetId ? null : meetId;
      zustand.mitfahrenFrage = null;
      rueckmeldung('tipp');
      ctx.render();
    },
    'mitfahren-rolle': (data) => {
      const stand = aktuell();
      const rolle = ['fahrer', 'mitfahrer', 'selbst'].includes(data.rolle) ? data.rolle : null;
      if (!rolle) return;
      if (stand.meine.rolle === rolle) {
        rueckmeldung('auswahl');
        if (ui().mitfahrenFrage) { ui().mitfahrenFrage = null; ctx.render(); }
        return;
      }
      // Wer fährt und schon Mitfahrer hat, lässt sie nicht mit einem versehentlichen Tipp stehen.
      const mein = stand.fahrer.find((auto) => auto.id === ME);
      if (stand.meine.rolle === 'fahrer' && mein?.mitfahrer.length) {
        ui().mitfahrenFrage = { meetId, rolle };
        rueckmeldung('tipp');
        ctx.render();
        return;
      }
      rolleSetzen(rolle);
    },
    'mitfahren-frage-ja': () => {
      const frage = ui().mitfahrenFrage;
      if (!frage || frage.meetId !== meetId) return;
      rolleSetzen(frage.rolle);
    },
    'mitfahren-frage-nein': () => {
      ui().mitfahrenFrage = null;
      rueckmeldung('schliessen');
      ctx.render();
    },
    'mitfahren-plaetze': (data) => {
      if (ohneDaten()) return;
      const mein = aktuell().fahrer.find((auto) => auto.id === ME);
      if (!mein) return;
      const ziel = mein.plaetze + (Number(data.schritt) || 0);
      const min = Math.max(PLAETZE_MIN, mein.mitfahrer.length);
      if (ziel < min || ziel > PLAETZE_MAX) {
        rueckmeldung('abgelehnt');
        // Weniger Plätze als Mitfahrer würde jemanden still aussteigen lassen.
        if (ziel < min && ziel >= PLAETZE_MIN) ctx.toast?.(t('Erst jemanden absetzen'));
        return;
      }
      melden(repo.setRide(meetId, { rolle: 'fahrer', plaetze: ziel }));
    },
    'mitfahren-mitnehmen': (data) => {
      if (ohneDaten() || !data.person) return;
      melden(repo.assignRide(meetId, data.person, ME), 'erfolg');
    },
    'mitfahren-einsteigen': (data) => {
      if (ohneDaten() || !data.fahrer) return;
      melden(repo.assignRide(meetId, ME, data.fahrer), 'erfolg');
    },
    'mitfahren-aussteigen': () => {
      if (ohneDaten()) return;
      melden(repo.assignRide(meetId, ME, null), 'zurueck');
    },
    'mitfahren-absetzen': (data) => {
      if (ohneDaten() || !data.person) return;
      melden(repo.assignRide(meetId, data.person, null), 'zurueck');
    },
    'mitfahren-vorschlag': () => {
      if (ohneDaten()) return;
      const stand = aktuell();
      const erlaubt = stand.vorschlag.zuordnungen.filter((zuordnung) => darfZuordnen(stand, zuordnung.mitfahrerId, zuordnung.fahrerId));
      if (!erlaubt.length) {
        rueckmeldung('abgelehnt');
        ctx.toast?.(mitfahrMeldung({ ok: false, reason: 'verboten' }));
        return;
      }
      const antworten = erlaubt.map((zuordnung) => repo.assignRide(meetId, zuordnung.mitfahrerId, zuordnung.fahrerId));
      Promise.all(antworten.map((antwort) => Promise.resolve(antwort))).then((liste) => {
        const fehl = liste.filter((antwort) => antwort && antwort.ok === false).length;
        if (!fehl) {
          rueckmeldung('erfolg');
          ctx.toast?.(t('Vorschlag übernommen'));
        } else {
          rueckmeldung('abgelehnt');
          ctx.toast?.(tn(fehl, '{n} Zuordnung ging nicht mehr', '{n} Zuordnungen gingen nicht mehr'));
        }
        ctx.render();
      });
    },
    'mitfahren-route': (data) => {
      const stand = aktuell();
      const mein = stand.fahrer.find((auto) => auto.id === ME);
      const url = mein ? mitfahrRouteUrl(stand.ziel, mein.routeStopps, data.anbieter === 'google' ? 'google' : 'apple') : null;
      if (!url) { rueckmeldung('abgelehnt'); return; }
      rueckmeldung('tipp');
      globalThis.open?.(url, '_blank', 'noopener');
    },
  };
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
