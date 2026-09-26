// Geteilte Meet-Bausteine (reference/current 05.6–05.11) — verwendet in
// Meet-Details UND Raum-Panel.
//
// API (verbindlich, docs/FRAMEWORK.md):
//   meetMainCard(ctx, meet, options?)      → html  (v14: neutrale Hauptkarte OHNE Zustands-Chips —
//     Icon · Titel · Stift, darunter Uhr-Zeile (Datum · Uhrzeit/„Zeit offen") und Orts-Zeile;
//     einzig beim aktiven Meet ist die Datum/Uhrzeit-Fläche klein grün.)
//     options.tapAct: macht die ganze Karte antippbar (data-act=tapAct, data-meet)
//     v7 spec/04 §4 + A20: Ist genau ein Feld offen, trägt es den warmen Vorschlagsstatus
//     und ist ein eigenes Tap-Ziel (data-act=options.variantAct, Vorgabe "variant-pick").
//     Die Kartenhöhe ändert sich dadurch nicht — markiert und unmarkiert teilen sich
//     dieselben Maße.
//   variantPickSheet(ctx, meet)            → html  (der kompakte Abstimmzustand aus dem
//     GEMEINSAMEN Sheet-Host; liegt in ctx.ui.variantPick, kein Routenwechsel.)
//   participationSection(ctx, meet, options?) → html
//     Runde 8 (R8-24): Dabei | Abgesagt — ZUGLEICH die direkt antippbare Auswahl (data-act="set-part",
//     data-state 'yes'|'no'). Wer noch nicht entschieden hat, steht nirgends: keine eigene Spalte,
//     kein Strich. Ein zweiter Tipp auf die eigene Wahl nimmt sie zurück (→ 'open'), genau wie
//     ✓/✕ im Kalender. Der eigene Zustand liegt als ruhige getönte Spalte an.
//     options.compact → kleinere Maße fürs Raum-Panel, options.bare → ohne Kartenrahmen.
//   bringSection(ctx, meet, {expanded})    → html  (v14: geöffnet EINE Box mit einer Kante,
//     nur die Größe ändert sich; Farbe/Radius bleiben. options.label erlaubt „Liste" im Raum.)
//     v3.1 §7: Übernimmt jemand einen Punkt, steht sein kleines Profilbild ANSTELLE des
//     generischen Hakens. Keine zusätzlichen Statuswörter.
//   pollSection(ctx, meet, {expanded})     → html
//     R3 K2: Jede Antwort ist EINE ganze Trefferfläche (data-act="vote-poll"); die eigene
//     Stimme trägt Fläche, Kontur, Haken und Farbe — nicht mehr nur eine grüne Schrift.
//   bindMeetPanels(root, ctx, meet)        → Handler für alle Bausteine (inkl. data-act="set-part").
//     Auf-/Zuklappen läuft über ctx.ui.panel ('bring'|'polls'|null).
//     Leere Pflichtfelder melden sich per ctx.toast (v3.1 §7), nie als Sheet.
//     R3 K1: Ein GEÖFFNETER Bereich klappt über seinen Kopf immer zu — auch wenn er leer ist.
//
//   R3 — Rückblick und Bewertungs-Hinweis:
//   meetVorbei(meet)                       → boolean. Dieselbe Regel wie der Verlauf
//     (projections.sortAndFilterMeets 'history'): abgeschlossen ODER Datum vor heute, nie aktiv,
//     nie Entwurf, nie ein laufender Loop.
//   bringRueckblick(ctx, meet) / pollRueckblick(ctx, meet) → html ('' ohne Inhalt): dieselben
//     Zeilen wie oben, nur zum Nachsehen (keine Bedienung).
//   R6 D6 / Runde 11 (B10, D10) — Die Frage lebt IN der Meet-Zeile (keine eigene Box, keine Gesichter):
//   bewertungMoeglich(meet)                → boolean. Darf dieses Meet überhaupt bewertet werden?
//     (projections.meetBewertbar: ich war dabei, vorbei, nicht abgesagt, klarer Inhalt — Aktivität oder Ort.)
//   bewertungOffen(meet)                   → boolean. Wird gerade GEFRAGT: möglich, noch nicht bewertet,
//     nicht ausgeblendet, höchstens 7 Tage her, nicht weggetippt (Merker aus der Zeit vor Runde 11).
//   bewertungsMeetIn(repo, context)        → das jüngste wartende Meet eines Kontexts (Raum/Crew/Person).
//   bewertungsPille(meet)                  → html. Die leise Pille „Wie war's?" — sie sitzt in der Zeile
//     des Meets (Meet-Liste, Meine Meets, Vergangene Meets), dessen Titel, Tag und Ort daneben stehen.
//   bewertungsZeile(ctx, meet)             → html ('' wenn nichts zu fragen ist). Für den Chat-Raum, wo die
//     Meet-Zeile fehlt: Titel, Tag · Ort und die Pille in EINER Zeile.
//   bewertungsZeileAktionen(ctx)           → Handler: 'bew-mehr' (öffnet die Bewertungsseite).
//   BEWERTUNG_STUFEN · BEWERTUNG_TON · gesichtSvg(art, farbe, groesse, mitKreis)
//     Stufen, Farbtöne und Gesichter der Bewertung — EINE Quelle; meet-details.js liest sie hier.
//
//   R4 — Meet mit Ort: Foto oben, Text, darunter die echte Karte (E9), keine Sprünge (C4):
//   meetFoto(repo, meet)                   → { bild, bildSeite, bildUrheber } | null. Reihenfolge:
//     meet.bild → Vorschlag meet.suggestionId → Vorschlag am selben Ort (gleicher Name / ≤ 50 m).
//   meetFotoKopf(ctx, meet, foto, options?) → html. Foto-Fläche (options.hoehe, Standard 156) mit
//     dem Aktivitätszeichen auf Glas oben links und einem ⓘ-Knopf (44 px) unten rechts. Der
//     Bildnachweis steht erst nach dem Tipp auf ⓘ da (ctx.ui.fotoInfo = meet.id), als Link zur
//     Quelle. options.iconFarbe färbt das Zeichen (offene Aktivität: Vorschlagsfarbe).
//   meetMainCard(ctx, meet, options?)      → mit Foto steht es OBEN in der Karte; options.foto:false
//     schaltet es ab. Die Zeitzeile sagt „Jetzt" statt einer Uhrzeit (core/dates.js terminText).
//   meetOrtKarte(ctx, meet, options?)      → html. EIGENE Karte unter dem Text: echte Karte
//     (MapLibre, nicht bedienbar, Tipp öffnet die Routenwahl), Adresse, Route · Website. Ohne
//     Koordinaten keine gemalte Ersatzkarte; ohne Koordinaten UND Adresse gar nichts (der Name
//     steht schon in der Hauptkarte). Ort angefragt → der ehrliche Zwischenstand.
//     options.kartenHoehe (Standard 150).
//   bindeMeetOrtKarte(root, meetId)        → hängt die echte Karte ein (nach dem Zeichnen).
//   meetOrtAktionen(ctx, meet)             → Handler: 'route-menu', 'route-open', 'open-website'.
//   meetFotoAktionen(ctx)                  → Handler: 'foto-info' (auch in bindMeetPanels enthalten).
//   meetPanelReihe(ctx, meet)              → html. Mitbringen | Umfragen bleiben IMMER als zwei
//     Kacheln nebeneinander stehen; der geöffnete Inhalt erscheint darunter. Die angetippte
//     Kachel bewegt sich dadurch nie (vorher sprang „Umfragen" gemessen 52 px nach unten links).
//     Die Eingabe „Etwas hinzufügen" steht OBEN im Inhalt, neue Punkte kommen darunter dazu —
//     der „+"-Knopf bleibt nach dem Hinzufügen an seiner Stelle.
//     Runde 8 (R8-27): Darüber steht der EINE Knopf „Anreise planen" (ui/mitfahren.js anreiseKnopf).
//     Er öffnet die Seite „Anreise" (Route 'meet.anreise'); der frühere aufklappbare Block ist weg.
//     Sein Handler ('anreise-oeffnen') steckt in bindMeetPanels.
//   Rückmeldung per Vibration: rueckmeldung(art) aus core/html.js (Runde 4, eine Stelle für die App).
//
//   Runde 11 (B2, D2): Die Meet-Seite ist EIN System (Kopf → Zusage-Reihe → Teilnehmende → nur hinzugefügte
//     Module → „+ Hinzufügen“): zusageReihe, teilnehmendeKarte, moduleDa, modulPille, modulSheet — Beschreibung
//     bei den Bausteinen selbst. meetPanelReihe zeigt nur noch die HINZUGEFÜGTEN Module.
//
//   Runde 8 (R8-24): „Ich bin da” ist weg" ist weg — Knopf, Zeile und Handler. (Jonathan: „‚Ich bin da'
//     weg.") Der Datenvertrag (repo.getAnkuenfte/setAnkunft) bleibt unberührt; die Oberfläche
//     ruft ihn nicht mehr.
//   vorschlagTitel(variante, meet)         → Text eines Aktivitätsvorschlags. Trägt er einen
//     anderen Ort als das Meet (R8-26: „Ort aus dem Chat ins Meet"), steht der Ort dabei:
//     „Kochabend · Strandbad Lochau".

import { esc, bindActions, rueckmeldung } from '../core/html.js';
import { activityIconSvg } from './activity-icons.js';
import { ME } from '../data/ids.js';
// Runde 11 (B10): Wer bewertet wird, ist eine Regel der Daten (beide Gateways) — hier nur gelesen.
import { meetBewertbar, meetBewertungsTitel, meetIstVorbei } from '../data/projections.js';
import { plus } from './icons.js';
import {
  dirtyGuard, stackSeparator, personMarker, personAvatar, sheet,
} from './components.js';
import {
  isToday, isTomorrow, dayOffset, fromISODate, weekdayShort, tagMonatKurz, now, toISODate, meetSortKey,
  istJetzt, zeitText, terminText,
} from '../core/dates.js';
import { entfernungKm } from '../core/entfernung.js';
import { t, tn, tk, zahl } from '../core/sprache.js';
// R4: Markierung und Tippgefühl kommen aus den gemeinsamen Karten-Bausteinen (P3). Als Namensraum
// geholt, damit ein noch fehlender Baustein nichts bricht — dann gilt der Rückfall hier.
import * as karten from './map.js';
// R6 (P4, C5): Ein Tipp auf die kleine Ortskarte öffnet die GROSSE Karte in der App — die
// Anbieterwahl (Apple/Google) kommt erst dort hinter „Route".
import { karteGrossOeffnen } from './karte-gross.js';
// Runde 8 (R8-27): Anreise — ein Knopf hier, die Seite „Anreise" in ui/mitfahren.js.
import { anreiseKnopf, anreiseAktionen, mitfahrStand, mitfahrenMoeglich } from './mitfahren.js';

const FONT = "'Instrument Sans',sans-serif";

// --- Foto des Ortes (R3 G1 · R4 E9) ---------------------------------------------------------
//
// Ein Meet trägt sein Foto heute meist NICHT selbst: publishDraft übernimmt vom gewählten
// Vorschlag nur Titel, Symbol und Ort. Bis das Meet sein Foto speichert, gilt diese Reihenfolge:
//   1. meet.bild (+ bildSeite, bildUrheber) — die künftige Form am Meet,
//   2. meet.suggestionId → repo.getSuggestion(id),
//   3. ein Vorschlag am SELBEN Ort: gleicher Name oder höchstens 50 m entfernt.
// Der dritte Weg erfindet nichts — er zeigt nur ein echtes Foto genau dieses Ortes.
const fotoMerker = new Map();

function fotoVon(eintrag) {
  return eintrag?.bild
    ? { bild: eintrag.bild, bildSeite: eintrag.bildSeite || null, bildUrheber: eintrag.bildUrheber || null }
    : null;
}

export function meetFoto(repo, meet) {
  if (!meet) return null;
  if (meet.bild) return fotoVon(meet);
  if (meet.suggestionId && repo?.getSuggestion) {
    const foto = fotoVon(repo.getSuggestion(meet.suggestionId));
    if (foto) return foto;
  }
  const place = meet.place;
  if (!place?.name || meet.placePending || !repo?.getSuggestions) return null;
  const schluessel = `${meet.id}|${place.name}|${place.lat}|${place.lon}`;
  const gemerkt = fotoMerker.get(schluessel);
  // Ein Treffer bleibt; ein Fehlschlag wird nach kurzer Zeit neu gesucht, weil die Vorschläge
  // im Serverbetrieb erst nach dem Start eintreffen.
  if (gemerkt && (gemerkt.foto || Date.now() - gemerkt.at < 15000)) return gemerkt.foto;
  const name = place.name.trim().toLowerCase();
  const passt = (vorschlag) => {
    if (!vorschlag?.bild || !vorschlag.place) return false;
    if ((vorschlag.place.name || '').trim().toLowerCase() === name) return true;
    const km = entfernungKm(place, vorschlag.place);
    return km != null && km <= 0.05;
  };
  let treffer = null;
  try {
    // Mit Suchwort kommt die ganze passende Liste (ohne Stufen-Begrenzung) — danach die
    // gewöhnliche Liste für den Fall, dass nur die Lage übereinstimmt.
    treffer = (repo.getSuggestions({ query: place.name }) || []).find(passt)
      || (repo.getSuggestions({}) || []).find(passt)
      || null;
  } catch {
    treffer = null;
  }
  const foto = fotoVon(treffer);
  fotoMerker.set(schluessel, { foto, at: Date.now() });
  return foto;
}

function infoGlyph(color = 'var(--ink)', size = 17) {
  return `<svg width="${size}" height="${size}" viewBox="0 0 24 24" fill="none" style="display:block;flex:none"><circle cx="12" cy="12" r="9.2" stroke="${color}" stroke-width="1.8"></circle><path d="M12 10.8v5.8" stroke="${color}" stroke-width="2.1" stroke-linecap="round"></path><circle cx="12" cy="7.5" r="1.3" fill="${color}"></circle></svg>`;
}

function pfeilRausGlyph(color = 'var(--ink)', size = 12) {
  return `<svg width="${size}" height="${size}" viewBox="0 0 24 24" fill="none" style="display:block;flex:none"><path d="M8 16 16.5 7.5M9.5 7h7.5v7.5" stroke="${color}" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"></path></svg>`;
}

// R4 E9 (Jonathan: „Das Foto sollte ganz oben sein, wo auch das Icon ist, wie man es von den
// Meet-Vorschlägen kennt … den Foto-Urheber verstecke hinter einem Info-Button"):
// Die Foto-Fläche trägt das Aktivitätszeichen auf Glas (wie die Marke der besonderen
// Vorschläge) und unten rechts ⓘ. Der Nachweis liegt ÜBER dem Foto — auf- und zuklappen
// ändert keine Höhe, darunter verschiebt sich nichts.
export function meetFotoKopf(ctx, meet, foto, options = {}) {
  if (!foto?.bild) return '';
  const hoehe = options.hoehe || 156;
  const offen = ctx.ui?.fotoInfo === meet.id;
  const urheber = esc(foto.bildUrheber || 'Wikimedia Commons');
  const glas = 'background:var(--glass);-webkit-backdrop-filter:blur(10px);backdrop-filter:blur(10px);box-shadow:0 1px 4px var(--shadow-10)';
  const nachweisStil = `position:absolute;left:10px;bottom:12px;max-width:calc(100% - 64px);box-sizing:border-box;display:flex;align-items:center;gap:6px;padding:6px 10px;border-radius:10px;${glas};font:600 11.5px/16px ${FONT};color:var(--ink);text-decoration:none`;
  const nachweisText = `<span style="white-space:nowrap;overflow:hidden;text-overflow:ellipsis;min-width:0">${t('Foto: {urheber}', { urheber })}</span>`;
  const nachweis = !offen ? '' : (foto.bildSeite
    ? `<a data-role="foto-nachweis" href="${esc(foto.bildSeite)}" target="_blank" rel="noopener" style="${nachweisStil}">${nachweisText}${pfeilRausGlyph('var(--ink)', 12)}</a>`
    : `<span data-role="foto-nachweis" style="${nachweisStil}">${nachweisText}</span>`);
  const hinweis = offen ? t('Foto-Nachweis ausblenden') : t('Foto-Nachweis zeigen');
  return `<div data-role="meet-foto" style="position:relative;height:${hoehe}px;background:var(--field);overflow:hidden;flex:none">
<img src="${esc(foto.bild)}" alt="${esc(meet.place?.name || meet.title || '')}" loading="lazy" referrerpolicy="no-referrer" style="position:absolute;inset:0;width:100%;height:100%;object-fit:cover;display:block;pointer-events:none" onerror="this.remove()">
<span data-role="meet-foto-icon" aria-hidden="true" style="position:absolute;left:12px;top:12px;width:42px;height:42px;border-radius:50%;${glas};display:flex;align-items:center;justify-content:center;pointer-events:none">${activityIconSvg(meet, options.iconFarbe || 'var(--ink)', 21)}</span>
${nachweis}
<button data-act="foto-info" data-meet="${esc(meet.id)}" aria-expanded="${offen}" aria-label="${esc(hinweis)}" style="position:absolute;right:4px;bottom:4px;width:44px;height:44px;border:0;background:transparent;padding:0;display:flex;align-items:center;justify-content:center;cursor:pointer;appearance:none"><span style="width:28px;height:28px;border-radius:50%;${offen ? 'background:var(--surface);box-shadow:0 1px 4px var(--shadow-14)' : glas};display:flex;align-items:center;justify-content:center;pointer-events:none">${infoGlyph('var(--ink)', 18)}</span></button>
</div>`;
}

export function meetFotoAktionen(ctx) {
  return {
    'foto-info': (data) => {
      const ui = ctx.ui;
      ui.fotoInfo = ui.fotoInfo === data.meet ? null : data.meet;
      rueckmeldung('tipp');
      ctx.render();
    },
  };
}

// --- Ort: echte Karte, Adresse, Route (reference 05.6/05.7 · R3 G1 · R4 E9) -------------------

const routeIcon = () => `<svg width="14" height="14" viewBox="0 0 24 24" fill="none"><path d="M6 19h9a3.5 3.5 0 0 0 0-7H9a3.5 3.5 0 0 1 0-7h9" stroke="var(--ink)" stroke-width="1.8" stroke-linecap="round"></path><circle cx="4.5" cy="19" r="1.8" fill="var(--ink)"></circle><circle cx="19.5" cy="5" r="1.8" fill="var(--ink)"></circle></svg>`;
const globeIcon = () => `<svg width="14" height="14" viewBox="0 0 24 24" fill="none"><circle cx="12" cy="12" r="8.6" stroke="var(--ink)" stroke-width="1.8"></circle><path d="M3.4 12h17.2M12 3.4c-4.8 4.9-4.8 12.3 0 17.2 4.8-4.9 4.8-12.3 0-17.2Z" stroke="var(--ink)" stroke-width="1.8"></path></svg>`;

// v7 spec/04 §7 / A17: „Bei Person" als Ort ist erst nach der Zustimmung ein Ort. Solange die
// Anfrage offen ist, steht hier nur der ehrliche Zwischenstand — keine Adresse, keine Karte.
function placePendingCard(ctx, meet) {
  const anfrage = ctx.repo.getPlaceRequests?.({ meetId: meet.id, status: 'open' })?.[0] || null;
  const gastgeber = anfrage ? ctx.repo.getPerson(anfrage.hostId) : null;
  const text = !gastgeber
    ? t('Ort bei der gefragten Person angefragt — die Adresse erscheint erst nach der Zustimmung.')
    : (gastgeber.id === ME
      ? t('Ort bei dir angefragt — die Adresse erscheint erst nach der Zustimmung.')
      : t('Ort bei {name} angefragt — die Adresse erscheint erst nach der Zustimmung.', { name: esc(gastgeber.name) }));
  return `<div data-role="place-pending" style="background:var(--surface);border:1px solid var(--orange-dark-a28);border-radius:20px;padding:13px 15px;display:flex;align-items:center;gap:10px;flex:none">
<span style="width:8px;height:8px;border-radius:50%;background:var(--orange);flex:none"></span>
<span style="font-size:12.5px;color:var(--ink-soft);line-height:1.4;flex:1;min-width:0">${text}</span>
</div>`;
}

const hatEchteLage = (place) => typeof place?.lat === 'number' && typeof place?.lon === 'number';

// R4 E9 (Jonathan: „getrennt das Bild oben und unten die Karte — in der Mitte durchgestrichen"):
// Foto und Karte liegen nie mehr aneinander. Das Foto steht oben in der Hauptkarte; diese
// Ortskarte kommt darunter und zeigt nur die ECHTE Karte mit der grünen Namenspille, die
// Adresse und die Wege dorthin. Wo keine Koordinaten da sind, wird keine Karte gemalt.
export function meetOrtKarte(ctx, meet, options = {}) {
  if (meet.placePending) return placePendingCard(ctx, meet);
  const place = meet.place;
  if (!place?.name) return '';
  // Runde 11 (B2, D2): „nie zwei Karten“ — trägt der Kopf schon das Foto, steht hier keine Kartenvorschau
  // (options.ohneKarte); Adresse, Route und Website bleiben.
  if (!hatEchteLage(place) && !place.address) return '';
  const echteKarte = hatEchteLage(place) && !options.ohneKarte;
  const hoehe = options.kartenHoehe || 150;
  const hasWebsite = Boolean(place.url);

  const routeMenu = ctx.ui.routeMenu
    ? `<div style="position:absolute;left:16px;bottom:50px;background:var(--surface);border-radius:14px;box-shadow:0 8px 24px var(--shadow-18);border:1px solid var(--ink-a07);overflow:hidden;width:170px;z-index:6">
<button data-act="route-open" data-provider="apple" style="display:flex;align-items:center;gap:9px;min-height:44px;padding:0 14px;width:100%;border:0;border-bottom:1px solid var(--ink-a06);background:transparent;cursor:pointer;appearance:none;font:650 13px ${FONT};color:var(--ink);text-align:left">Apple Maps</button>
<button data-act="route-open" data-provider="google" style="display:flex;align-items:center;gap:9px;min-height:44px;padding:0 14px;width:100%;border:0;background:transparent;cursor:pointer;appearance:none;font:650 13px ${FONT};color:var(--ink);text-align:left">Google Maps</button>
</div>`
    : '';

  // Die Karte ist ein Bild des Ortes in einer scrollenden Seite — sie nimmt dem Finger das
  // Scrollen nicht weg. Runde 6 (C5, Jonathan: „man kann aber nicht die karte und den standort vom
  // meet in der app anklicken und in einer großen ansicht ansehen, sondern es zeigt einen immer nur
  // die auswahl für google oder apple maps"): Ein Tipp darauf öffnet jetzt die GROSSE Karte in der
  // App (ui/karte-gross.js). Die Anbieterwahl steht dort hinter „Route" — und hier weiter hinter dem
  // Knopf „Route" darunter. Die Herkunftsangabe (ⓘ der Karte) bleibt bedienbar: map.js hält ihre
  // Klicks bei sich.
  // Die Markierung ist dieselbe wie auf jeder anderen Karte der App (map.js ortMarken: Mini-Box
  // mit Zeichen, Name und grober Zeit, Ortspunkt exakt auf dem Ort). Nur wo dieser Baustein
  // fehlt, steht die frühere grüne Namenspille als Rückfall in der Mitte.
  const pille = typeof karten.ortMarken === 'function'
    ? ''
    : `<div style="position:absolute;left:50%;top:50%;transform:translate(-50%,-100%);display:flex;flex-direction:column;align-items:center;pointer-events:none;z-index:2"><span style="background:var(--green);color:var(--on-accent);border-radius:999px;padding:6px 11px;font-size:11px;font-weight:650;box-shadow:0 3px 9px var(--green-a40);white-space:nowrap;max-width:220px;overflow:hidden;text-overflow:ellipsis">${esc(place.name)}</span><span style="width:2.5px;height:7px;background:var(--green)"></span></div>`;
  const karte = echteKarte
    ? `<div data-act="karte-gross" data-meet="${esc(meet.id)}" data-role="meet-map-flaeche" role="button" aria-label="${esc(t('Karte öffnen'))}" style="position:relative;height:${hoehe}px;background:var(--map-tint);overflow:hidden;border-radius:20px 20px 0 0;cursor:pointer">
<div data-fremd="1" data-role="meet-map" data-meet="${esc(meet.id)}" data-lat="${place.lat}" data-lon="${place.lon}" style="position:absolute;inset:0"></div>
${pille}
</div>`
    : '';

  const entfernung = place.distanceKm != null ? ` · ${zahl(place.distanceKm)} km` : '';
  const adresse = place.address
    ? `<div data-role="ort-adresse" style="display:flex;align-items:center;gap:8px;padding:10px 14px;${karte ? 'border-top:1px solid var(--ink-a07)' : ''}">${pinIconSmall('var(--muted)')}<span style="font-size:12.5px;color:var(--ink-soft);flex:1;min-width:0;white-space:nowrap;overflow:hidden;text-overflow:ellipsis">${esc(place.address)}${esc(entfernung)}</span></div>`
    : '';

  return `<div data-role="ort-karte" style="background:var(--surface);border:1px solid var(--ink-a10);border-radius:20px;overflow:visible;flex:none;position:relative">
${karte}
${adresse}
<div style="display:flex;border-top:1px solid var(--ink-a07)">
<button data-act="route-menu" aria-expanded="${Boolean(ctx.ui.routeMenu)}" style="flex:1;display:flex;align-items:center;justify-content:center;gap:7px;min-height:44px;padding:0;font:650 12.5px ${FONT};color:var(--ink);border:0;background:transparent;cursor:pointer;appearance:none"><span style="pointer-events:none;display:flex">${routeIcon()}</span><span style="pointer-events:none">${t('Route')}</span></button>
${hasWebsite ? `<button data-act="open-website" style="flex:1;display:flex;align-items:center;justify-content:center;gap:7px;min-height:44px;padding:0;font:650 12.5px ${FONT};color:var(--ink);border:0;border-left:1px solid var(--ink-a07);background:transparent;cursor:pointer;appearance:none"><span style="pointer-events:none;display:flex">${globeIcon()}</span><span style="pointer-events:none">${t('Website')}</span></button>` : ''}
</div>
${routeMenu}</div>`;
}

// T5: die echte Karte im Ortsfeld — erst nach dem Zeichnen, denn sie braucht einen Knoten.
// `meet` darf das Meet oder (wie früher) nur seine ID sein; mit dem Meet bekommt die Karte ihre
// Markierung (Zeichen der Aktivität, Ortsname, grobe Zeit). Ein Tipp darauf öffnet seit Runde 6
// die große Karte in der App (C5).
export function bindeMeetOrtKarte(root, meet) {
  const kartenFeld = root.querySelector('[data-role="meet-map"]');
  if (!kartenFeld) return;
  const meetId = typeof meet === 'string' ? meet : meet?.id;
  const lat = Number(kartenFeld.dataset.lat);
  const lon = Number(kartenFeld.dataset.lon);
  karten.karteHalten(kartenFeld, `meet-${meetId}`, {
    mitte: { lat, lon },
    zoom: 14.6,
    interaktiv: false,
    folgen: true,
  }).then((karte) => {
    if (!karte || typeof meet !== 'object' || typeof karten.ortMarken !== 'function') return;
    const name = meet.place?.name || meet.title || '';
    const zeit = typeof karten.grobeZeit === 'function' ? karten.grobeZeit(meet) : '';
    karten.ortMarken(karte, { schluessel: `meet-ort-${meetId}` })?.setzen([{
      key: `meet-ort-${meetId}`,
      lat,
      lon,
      eintraege: [{
        id: meetId,
        zeichen: activityIconSvg(meet, 'currentColor', 24),
        titel: name,
        unter: zeit,
        attrs: `data-act="karte-gross" data-meet="${esc(meetId)}"`,
        ton: meet.status === 'active' ? 'aktiv' : '',
        label: [name, zeit].filter(Boolean).join(', '),
      }],
    }]);
  }).catch(() => {});
}

// Route · Website: in den kommenden Details und im Rückblick dieselben Wege.
export function meetOrtAktionen(ctx, meet) {
  const { ui } = ctx;
  return {
    // Runde 6 (C5): Die kleine Karte öffnet die große Ansicht IN der App — kein Routenmenü mehr.
    'karte-gross': () => {
      const place = meet.place;
      if (!place || !hatEchteLage(place)) return;
      karteGrossOeffnen({
        titel: place.name || meet.title || '',
        adresse: place.address || '',
        lat: place.lat,
        lon: place.lon,
        zeichen: activityIconSvg(meet, 'currentColor', 20),
        unter: typeof karten.grobeZeit === 'function' ? karten.grobeZeit(meet) : '',
      });
    },
    'route-menu': () => { ui.routeMenu = !ui.routeMenu; ctx.render(); },
    // T5: Mit echten Koordinaten führt die Karten-App direkt zum Punkt statt zu einer
    // Namenssuche. Die Adresse für die Karten-App baut EINE Stelle (ui/map.js).
    'route-open': (data) => {
      ui.routeMenu = false;
      import('./map.js').then(({ oeffneRoute }) => oeffneRoute(meet.place, data.provider));
      ctx.render();
    },
    'open-website': () => { if (meet.place?.url) window.open(meet.place.url, '_blank'); },
  };
}

export const CATEGORY_LABELS = {
  sport: t('Sport'), essen: t('Essen'), ausgehen: t('Ausgehen'), chillen: t('Chillen'), event: t('Event'),
};

// "Heute" / "Morgen" / "Gestern, Sa 22.8." / "Sa 22.8." — kompakte Referenz-Schreibweise.
export function meetDateLabel(iso) {
  if (!iso) return '';
  const date = fromISODate(iso);
  const compact = `${weekdayShort(iso)} ${tagMonatKurz(date)}`;
  if (isToday(iso)) return t('Heute');
  if (isTomorrow(iso)) return t('Morgen');
  if (iso === dayOffset(-1)) return t('Gestern, {datum}', { datum: compact });
  return compact;
}

// Mitglieder eines Meets: Crew-Mitglieder bzw. eingeladene Personen + Ersteller + ich.
export function meetMemberIds(repo, meet) {
  if (meet.crewId) {
    const crew = repo.getCrew(meet.crewId);
    if (crew) return crew.memberIds;
  }
  const ids = new Set([ME, meet.creatorId, ...(meet.personIds || []), ...Object.keys(meet.participation || {})]);
  return [...ids];
}

export function participationGroups(repo, meet) {
  const groups = { yes: [], open: [], no: [] };
  for (const id of meetMemberIds(repo, meet)) {
    const person = repo.getPerson(id);
    if (!person) continue;
    const state = meet.participation?.[id];
    if (state === 'yes') groups.yes.push(person);
    else if (state === 'no') groups.no.push(person);
    else groups.open.push(person);
  }
  return groups;
}

// --- Icons (1:1 aus reference/current/source/05-Meet.dc.html) ---

export function pencilIcon(color = 'var(--ink)', size = 14) {
  return `<svg width="${size}" height="${size}" viewBox="0 0 24 24" fill="none"><path d="M4 20h4L19.5 8.5a2.1 2.1 0 0 0-3-3L5 17l-1 4Z" stroke="${color}" stroke-width="1.8" stroke-linejoin="round"></path><path d="m14.5 7 3 3" stroke="${color}" stroke-width="1.8"></path></svg>`;
}

function circleCheckIcon(color = 'var(--ink)', size = 15) {
  return `<svg width="${size}" height="${size}" viewBox="0 0 24 24" fill="none" style="flex:none"><circle cx="12" cy="12" r="9" stroke="${color}" stroke-width="1.8"></circle><path d="m8.5 12 2.4 2.4 4.6-4.8" stroke="${color}" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"></path></svg>`;
}

function barsIcon(color = 'var(--ink)', size = 15) {
  return `<svg width="${size}" height="${size}" viewBox="0 0 24 24" fill="none" style="flex:none"><path d="M5 20V10M12 20V4M19 20v-7" stroke="${color}" stroke-width="1.8" stroke-linecap="round"></path></svg>`;
}

// Pfeil nach rechts: der ruhige „führt weiter"-Hinweis der Hauptkarte im Raum.
function chevronRight(color = 'var(--line-strong)') {
  return `<svg width="15" height="15" viewBox="0 0 24 24" fill="none"><path d="m9.5 6 6 6-6 6" stroke="${color}" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"></path></svg>`;
}

function chevron(direction, color = 'var(--muted-light)') {
  const path = direction === 'up' ? 'm6 14.5 6-6 6 6' : 'm6 9.5 6 6 6-6';
  return `<svg width="13" height="13" viewBox="0 0 24 24" fill="none"><path d="${path}" stroke="${color}" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"></path></svg>`;
}

function clockIconSmall(color = 'var(--muted)') {
  return `<svg width="14" height="14" viewBox="0 0 24 24" fill="none" style="flex:none"><circle cx="12" cy="12" r="9" stroke="${color}" stroke-width="1.8"></circle><path d="M12 7v5l3.2 2" stroke="${color}" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"></path></svg>`;
}

function pinIconSmall(color = 'var(--muted)') {
  return `<svg width="14" height="14" viewBox="0 0 24 24" fill="none" style="flex:none"><path d="M12 21.5s7-6.1 7-11a7 7 0 1 0-14 0c0 4.9 7 11 7 11Z" stroke="${color}" stroke-width="1.8" stroke-linejoin="round"></path><circle cx="12" cy="10.5" r="2.4" stroke="${color}" stroke-width="1.8"></circle></svg>`;
}

// v7 spec/04 §4 / A20: Die warme Vorschlagsfarbe des Produkts. Sie sagt „hier ist noch
// nichts entschieden" — Grün wäre bereits Zustimmung, Schwarz wäre eine Feststellung.
const VORSCHLAG_INK = 'var(--orange-dark)';
const VORSCHLAG_FLAECHE = 'var(--orange-dark-a10)';
const VORSCHLAG_KANTE = 'var(--orange-dark-a30)';

// v6 A11a: dieselbe warme Übernehmen-Geste wie im Raum-Panel (screens/room.js adoptGlyph).
// Ein Haken bedeutet „erledigt" und war als Einladung zum Übernehmen falsch.
function adoptGlyph(color = 'var(--orange-dark)', size = 16) {
  return `<svg width="${size}" height="${size}" viewBox="0 0 24 24" fill="none" style="flex:none"><path d="M8.6 11V5.6a1.5 1.5 0 0 1 3 0V11m0-.6V4.4a1.5 1.5 0 0 1 3 0V11m0-.4V6.4a1.5 1.5 0 0 1 3 0v6.4c0 4-2.4 6.6-5.7 6.6-2.2 0-3.6-1-4.7-2.8L5.9 13.4a1.5 1.5 0 0 1 2.6-1.5l1 1.7" stroke="${color}" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round"></path></svg>`;
}

function checkPath(stroke, width = 2.4, size = 13) {
  return `<svg width="${size}" height="${size}" viewBox="0 0 24 24" fill="none"><path d="m7.5 12.5 3 3 6-6.5" stroke="${stroke}" stroke-width="${width}" stroke-linecap="round" stroke-linejoin="round"></path></svg>`;
}

// --- Kleine Avatare (26px in den Details, 20px im Raum-Panel; reference 05.6/07.2) ---
//
// v4 P0-3-9 / COMPONENT_RULES 2: „Technische weiße Trenner aus Avatar-Stacks dürfen nicht
// sichtbar sein." Der Trenner war hier ein echter weißer RAHMEN AUF dem Avatar — auf der
// getönten Teilnahme-Zelle (rgb 231,243,236 bzw. 243,239,232) wurde daraus ein deutlich
// sichtbarer heller Ring, der wie eine eigene Markierung aussah. Jetzt ist er ein Ring
// HINTER dem Avatar (stackSeparator = box-shadow) in der Farbe des jeweiligen
// Untergrunds: auf Weiß unverändert, auf getöntem Grund unsichtbar.
//
// v4 P0-3-10: Mit options.settings tragen die Stapel dieselben Markierungen wie jede
// Personenzeile — goldener Ring (Bester Freund) und Symbol unten links (Besondere Person).

// v7 spec/08 §1: KEINE lokale Initialenscheibe mehr. Der Stapel zeichnet dieselbe
// Avatar-Unit wie jede andere Fläche der App (personAvatar → bildVon/avatarFlaeche) —
// nur so erscheint hier das echte Profilbild, sobald eine Person eines hat, und der
// Farb-/Initialen-Fall bleibt der EINE gemeinsame Fallback statt einer zweiten Bauart.
// Der weiße Trenner bleibt ein Ring HINTER der Unit (box-shadow), damit er nie wie eine
// eigene Markierung auf dem Bild liegt.
// Fable 4: In der Teilnahme-Zelle des Meets selbst ist jede Person per Definition in DIESEM Meet —
// der Aktiv-Fade wäre dort nur Rauschen (active: false); Frei-Punkt und Zeichen folgen der einen Regel.
function smallAvatar(person, size = 26, options = {}) {
  const overlap = Math.round(size * 0.27);
  const font = Number((size * 0.365).toFixed(1));
  const separator = options.separator || 'var(--surface)';
  const marker = options.settings ? personMarker(person.id, options.settings) : null;
  return `<span style="display:flex;border-radius:50%;flex:none;margin-left:-${overlap}px;${stackSeparator(separator)}">${personAvatar(person, { size, fontSize: font, marker, compact: size < 26, dotBorder: separator, active: false })}</span>`;
}

function avatarStack(people, size = 26, options = {}) {
  const overlap = Math.round(size * 0.27);
  // Runde 8 (R8-24): Eine leere Spalte zeigt NICHTS — früher stand hier ein Strich. Die Höhe
  // bleibt, damit die Spalte nicht springt, wenn jemand hinzukommt.
  if (!people.length) return `<span aria-hidden="true" style="display:block;height:${size}px;pointer-events:none"></span>`;
  const separator = options.separator || 'var(--surface)';
  const shown = people.slice(0, 3).map((person) => smallAvatar(person, size, options)).join('');
  const font = (size * 0.35).toFixed(1);
  const extra = people.length > 3
    ? `<span style="position:relative;flex:none;width:${size}px;height:${size}px;margin-left:-${overlap}px"><span style="display:block;width:${size}px;height:${size}px;border-radius:50%;background:var(--field);color:var(--muted);font:600 ${font}px/${size}px ${FONT};text-align:center;${stackSeparator(separator)}">+${people.length - 3}</span></span>`
    : '';
  return `<div style="display:flex;padding-left:${overlap}px;pointer-events:none">${shown}${extra}</div>`;
}

// --- Hauptkarte (v14: keine Zustands-Etiketten; Uhr-Zeile + Orts-Zeile unter Hairline) ---

// Genau EIN Feld einer Meet-Box darf offen markiert sein (spec/04 §4). Bei mehreren
// offenen Feldern gewinnt das mit den meisten Vorschlägen — dieselbe Regel wie im
// Raum-Panel, damit beide Orte niemals unterschiedliche Felder markieren.
export function offeneVariantenArt(meet) {
  if (!meet || meet.status === 'active' || meet.status === 'done') return null;
  const varianten = meet.variants || [];
  const arten = [...new Set(varianten.map((variant) => variant.kind))];
  if (!arten.length) return null;
  return arten.sort((a, b) => varianten.filter((v) => v.kind === b).length
    - varianten.filter((v) => v.kind === a).length)[0];
}

// Runde 8 (R8-26): Ein Aktivitätsvorschlag kann einen Ort tragen — seit ein Ort aus dem Chat mit
// einem Tipp ins Meet geht. Heißt er wie das Meet und liegt anderswo, steht der Ort dabei, sonst
// sähe er aus wie das Original.
export function vorschlagTitel(variante, meet) {
  const titel = variante?.title || '';
  const ort = variante?.place?.name || '';
  if (!ort || ort === (meet?.place?.name || '')) return titel;
  return titel ? `${titel} · ${ort}` : ort;
}

// Wortlaut wie im Abstimmzustand: Original + Varianten.
export function variantenAnzahl(meet, kind) {
  return (meet.variants || []).filter((variant) => variant.kind === kind).length + 1;
}

// Der Zähl-Chip sagt in EINEM Blick, wie viel offen ist, ohne die Zeile höher zu machen:
// er ist exakt so hoch wie die Textzeile daneben (ZEILE = 16 px, fest gesetzt), damit die
// Karte beim Aufgehen einer Variante messbar dieselbe Höhe behält (A20b).
const ZEILE = 16;

function vorschlagChip(anzahl) {
  return `<span aria-hidden="true" style="flex:none;height:${ZEILE}px;line-height:${ZEILE}px;padding:0 7px;border-radius:8px;background:${VORSCHLAG_FLAECHE};color:${VORSCHLAG_INK};font:650 10px/${ZEILE}px ${FONT};letter-spacing:.03em;white-space:nowrap">${tn(anzahl, '{n} Vorschlag', '{n} Vorschläge')}</span>`;
}

export function meetMainCard(ctx, meet, options = {}) {
  const hasTimeVariants = Boolean(meet.variants?.some((variant) => variant.kind === 'time'));
  // v7 A20: Das offene Feld trägt den warmen Status — bei Zeit die ZEITZEILE, bei
  // Aktivität Titel und Icon. Der Titel bleibt dabei der echte Titel: dass er nur ein
  // Vorschlag unter mehreren ist, sagt jetzt die Farbe samt Zähl-Chip (v6 ersetzte ihn
  // durch „3 Vorschläge" und nahm der Karte damit ihren Gegenstand).
  const offeneArt = offeneVariantenArt(meet);
  const zeitOffen = offeneArt === 'time';
  const aktivitaetOffen = offeneArt === 'activity';
  const pickAct = options.variantAct || 'variant-pick';

  const showPencil = (meet.status === 'open' || meet.status === 'draft') && !options.tapAct;
  // spec/04 §4: „klarer Status zum Öffnen der Meet-Details". Wo die ganze Karte in die
  // Details führt (options.tapAct), sagt das der Pfeil rechts — sonst steht dort der
  // Stift, der den Vorschlagsweg öffnet. Beide sind 32 px breit, die Kopfzeile behält
  // in jedem Fall dieselbe Höhe.
  const pencil = showPencil
    ? `<button data-act="main-pencil" aria-label="${esc(t('Vorschlagen'))}" style="width:32px;height:32px;border-radius:50%;border:1px solid var(--ink-a12);background:transparent;display:flex;align-items:center;justify-content:center;cursor:pointer;appearance:none;padding:0;flex:none"><span style="pointer-events:none;display:flex">${pencilIcon('var(--ink)', 14)}</span></button>`
    : (options.tapAct
      ? `<span aria-hidden="true" style="width:32px;height:32px;display:flex;align-items:center;justify-content:center;flex:none">${chevronRight()}</span>`
      : '');

  // Innerhalb einer antippbaren Karte (options.tapAct) darf kein zweiter Button liegen.
  // Das markierte Feld wird dort zu einer eigenen Trefferfläche, die die abgeschalteten
  // pointer-events der Karte lokal wieder einschaltet — bindActions findet über
  // closest('[data-act]') zuerst dieses innere Ziel, der Rest der Karte öffnet weiter
  // die Meet-Details.
  const treffer = (kind, inhalt, stil) => {
    const label = kind === 'time' ? t('Zeitvorschläge ansehen') : t('Aktivitätsvorschläge ansehen');
    const attrs = `data-act="${esc(pickAct)}" data-kind="${kind}" data-meet="${esc(meet.id)}" aria-label="${esc(label)}"`;
    const basis = `border:0;padding:0;margin:0;appearance:none;font-family:${FONT};text-align:left;cursor:pointer;${stil}`;
    if (options.tapAct) {
      return `<span role="button" tabindex="0" ${attrs} style="${basis};pointer-events:auto">${inhalt}</span>`;
    }
    return `<button ${attrs} style="${basis}">${inhalt}</button>`;
  };

  // Die Zeitzeile hat IMMER dieselben Maße (Pille mit 4/9 px Innenabstand, um 9 px nach
  // links gezogen). Nur Fläche und Farbe wechseln — so wächst die Box nicht, wenn eine
  // Variante aufgeht, und der aktive Fall bleibt genau wie bisher.
  const zeitPille = 'display:flex;align-items:center;gap:8px;padding:4px 9px;margin-left:-9px;border-radius:9px;box-sizing:border-box';
  let timeRow;
  if (meet.status === 'active') {
    // Einzige grüne Ausnahme: die kleine Datum/Uhrzeit-Fläche des laufenden Meets.
    // R4 F2: Wurde das Meet als „Jetzt" angelegt, steht vorn „Jetzt" statt „Heute".
    const vorn = istJetzt(meet) ? t('Jetzt') : meetDateLabel(meet.date);
    timeRow = `<div style="${zeitPille};background:var(--green-tint)">${clockIconSmall('var(--green-dark)')}<span style="font:650 13px/${ZEILE}px ${FONT};color:var(--green-dark);font-variant-numeric:tabular-nums">${esc(vorn)} · ${t('seit {zeit}', { zeit: esc(meet.time || '') })}</span></div>`;
  } else {
    // R4 F2 (Jonathan: „die Zeit wäre jetzt … dann wird nicht die Uhrzeit angezeigt, sondern
    // einfach nur jetzt"): terminText sagt „Jetzt", „Heute · 19:30" oder „Heute · Zeit offen".
    const zeitZeile = hasTimeVariants
      ? `${meetDateLabel(meet.date)} · ${t('Zeit offen')}`
      : terminText(meet, { datum: meetDateLabel });
    const ink = zeitOffen ? VORSCHLAG_INK : 'var(--ink)';
    const inhalt = `${clockIconSmall(zeitOffen ? VORSCHLAG_INK : 'var(--muted)')}<span style="font:${zeitOffen ? 650 : 600} 13.5px/${ZEILE}px ${FONT};color:${ink};font-variant-numeric:tabular-nums;${options.tapAct ? '' : 'pointer-events:none;'}white-space:nowrap">${esc(zeitZeile)}</span>${zeitOffen ? vorschlagChip(variantenAnzahl(meet, 'time')) : ''}`;
    timeRow = zeitOffen
      ? treffer('time', inhalt, `${zeitPille};background:${VORSCHLAG_FLAECHE};box-shadow:inset 0 0 0 1px ${VORSCHLAG_KANTE}`)
      : `<div style="${zeitPille};background:transparent">${inhalt}</div>`;
  }

  // v7 spec/04 §7: Solange die angefragte Person nicht zugestimmt hat, steht hier KEIN
  // Ortsname und keine Adresse — nur der ehrliche Zwischenstand.
  const placeRow = meet.placePending
    ? `<div style="display:flex;align-items:center;gap:8px">${pinIconSmall(VORSCHLAG_INK)}<span style="font-size:13.5px;font-weight:600;color:${VORSCHLAG_INK};flex:1;min-width:0;white-space:nowrap;overflow:hidden;text-overflow:ellipsis">${t('Ort — Zustimmung steht aus')}</span></div>`
    // Offener Ort ist leer gespeichert (Sprachen) — dieselbe Zeile sagt „Ort offen" in der
    // Sprache der Lesenden. Vorher stand der deutsche Satz als Ortsname in den Daten.
    : `<div style="display:flex;align-items:center;gap:8px">${pinIconSmall()}<span style="font-size:13.5px;font-weight:600;color:var(--ink);flex:1;min-width:0;white-space:nowrap;overflow:hidden;text-overflow:ellipsis">${esc(meet.place?.name || t('Ort offen'))}</span></div>`;

  // v7 spec/05 §3: Das Symbol wird AUS Kategorie und Titel abgeleitet (activityIconKey).
  // Die manuelle Symbolauswahl aus v6 entfällt vollständig — sie schrieb ein Emoji in
  // meet.icon, das die Ableitung in den meisten Fällen gar nicht kannte, und war damit
  // ein Bedienelement ohne Wirkung auf die gezeichnete Aktivität.
  // R4 E9: Gibt es ein Foto des Ortes, steht es OBEN in der Karte und trägt das Zeichen der
  // Aktivität (wie die Vorschlagskarten). Die Titelzeile beginnt dann direkt mit dem Titel.
  // Eine antippbare Karte (options.tapAct) bleibt ohne Foto: in einem Knopf darf kein zweiter
  // Knopf (ⓘ) und kein Link (Bildnachweis) liegen.
  const foto = options.tapAct || options.foto === false ? null : meetFoto(ctx.repo, meet);
  const iconFarbe = aktivitaetOffen ? VORSCHLAG_INK : 'var(--ink)';
  const iconSvg = activityIconSvg(meet, iconFarbe, 20);
  const iconStyle = `width:40px;height:40px;border-radius:50%;background:${aktivitaetOffen ? VORSCHLAG_FLAECHE : 'var(--surface)'};border:1px solid ${aktivitaetOffen ? VORSCHLAG_KANTE : 'var(--ink-a10)'};display:flex;align-items:center;justify-content:center;flex:none;padding:0;box-sizing:border-box`;
  const iconHtml = foto ? '' : `<span style="${iconStyle}">${iconSvg}</span>`;
  const titelSpan = `<span style="font-family:'Bricolage Grotesque',sans-serif;font-size:23px;font-weight:650;letter-spacing:-.01em;color:${aktivitaetOffen ? VORSCHLAG_INK : 'var(--ink)'};flex:1;min-width:0;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;${foto ? 'line-height:32px;' : ''}${options.tapAct ? '' : 'pointer-events:none'}">${esc(meet.title)}</span>`;

  const kopfInhalt = `${iconHtml}${titelSpan}${aktivitaetOffen ? vorschlagChip(variantenAnzahl(meet, 'activity')) : ''}`;
  const kopfStil = 'display:flex;align-items:center;gap:11px;width:100%;min-width:0;background:transparent';
  const kopfZeile = aktivitaetOffen
    ? `<div style="display:flex;align-items:center;gap:11px">${treffer('activity', kopfInhalt, kopfStil)}${pencil}</div>`
    : `<div style="${kopfStil}">${kopfInhalt}${pencil}</div>`;

  const inner = `
${kopfZeile}
<div style="display:flex;flex-direction:column;gap:5px;border-top:1px solid var(--ink-a07);padding-top:9px">
${timeRow}
${placeRow}
</div>`;

  const cardStyle = `margin:6px 16px 0;background:var(--surface);border:1px solid var(--ink-a10);border-radius:20px;padding:14px 16px;display:flex;flex-direction:column;gap:7px;flex:none`;
  if (options.tapAct) {
    return `<button data-act="${esc(options.tapAct)}" data-meet="${esc(meet.id)}" data-role="meet-main-card" style="${cardStyle};width:auto;text-align:left;cursor:pointer;appearance:none;font-family:${FONT};color:var(--ink)"><span style="display:contents;pointer-events:none">${inner}</span></button>`;
  }
  if (foto) {
    return `<div data-role="meet-main-card" data-foto="1" style="margin:6px 16px 0;background:var(--surface);border:1px solid var(--ink-a10);border-radius:20px;overflow:hidden;display:flex;flex-direction:column;flex:none">
${meetFotoKopf(ctx, meet, foto, { iconFarbe })}
<div data-role="meet-main-text" style="padding:12px 16px 14px;display:flex;flex-direction:column;gap:7px">${inner}</div>
</div>`;
  }
  return `<div data-role="meet-main-card" style="${cardStyle}">${inner}</div>`;
}

// --- Kompakter Abstimmzustand (v7 A20c, spec/04 §4) ----------------------------------
//
// Der vollständige Abstimminhalt liegt NICHT offen in der Meet-Box. Ein Tipp auf das
// markierte Feld öffnet ihn hier — im GEMEINSAMEN Sheet-Host des jeweiligen Screens,
// ohne Routenwechsel und ohne dass Karte, Seite oder Hintergrund neu entstehen.

function variantBalken(label, votes, total, mine, act, data) {
  const share = Math.max(12, Math.round((votes / Math.max(1, total)) * 100));
  const dataAttrs = Object.entries(data || {}).map(([key, value]) => `data-${key}="${esc(value)}"`).join(' ');
  return `<div style="display:flex;align-items:center;gap:9px">
<button data-act="${act}" ${dataAttrs} aria-pressed="${mine}" style="flex:1;min-width:0;height:36px;border-radius:11px;background:${mine ? 'var(--green-tint)' : 'var(--paper)'};position:relative;overflow:hidden;border:0;padding:0;cursor:pointer;appearance:none;font-family:${FONT};text-align:left">
<span style="position:absolute;inset:0;width:${share}%;background:${mine ? 'var(--green-a22)' : 'var(--field)'};pointer-events:none"></span>
<span style="position:absolute;left:12px;top:9px;right:10px;font-size:12.5px;font-weight:650;color:${mine ? 'var(--green-dark)' : 'var(--ink-soft)'};white-space:nowrap;overflow:hidden;text-overflow:ellipsis;pointer-events:none">${label}${mine ? ' ✓' : ''}</span>
</button>
<span style="font-size:12.5px;font-weight:650;color:${mine ? 'var(--green-dark)' : 'var(--muted)'};font-variant-numeric:tabular-nums;min-width:14px;text-align:right;flex:none">${votes}</span>
</div>`;
}

export function variantPickSheet(ctx, meet) {
  const state = ctx.ui?.variantPick;
  if (!state || !meet) return '';
  if (state.meetId && state.meetId !== meet.id) return '';
  const kind = state.kind === 'activity' ? 'activity' : 'time';
  const varianten = (meet.variants || []).filter((variant) => variant.kind === kind);
  if (!varianten.length) return '';

  const gewaehlt = new Set(varianten.flatMap((variant) => variant.votes));
  const yesIds = meetMemberIds(ctx.repo, meet).filter((id) => meet.participation?.[id] === 'yes');
  const originalVotes = yesIds.filter((id) => !gewaehlt.has(id)).length;
  const meineVariante = varianten.find((variant) => variant.votes.includes(ME));
  const aufOriginal = !meineVariante && meet.participation?.[ME] === 'yes';
  const total = originalVotes + varianten.reduce((sum, variant) => sum + variant.votes.length, 0);

  // R4 F2: Ein „Jetzt"-Termin heißt „Jetzt" — ohne Datum und ohne Uhrzeit (terminText).
  const originalLabel = kind === 'time'
    ? t('{termin} · Original', { termin: esc(terminText(meet, { datum: meetDateLabel })) })
    : t('{titel} · Original', { titel: esc(meet.title) });
  const originalBalken = variantBalken(originalLabel, originalVotes, total, aufOriginal, 'vote-original', { kind });

  const balken = varianten.map((variant) => {
    const label = kind === 'time'
      ? esc(terminText({ ...variant, date: variant.date || meet.date }, { datum: meetDateLabel }))
      : esc(vorschlagTitel(variant, meet));
    return variantBalken(label, variant.votes.length, total, variant.votes.includes(ME), 'variant-vote', { variant: variant.id });
  }).join('');

  const titel = kind === 'time' ? t('Zeit') : t('Aktivität');
  return sheet(`<div style="display:flex;align-items:baseline;gap:8px;margin-bottom:12px">
<span style="font-family:'Bricolage Grotesque',sans-serif;font-size:19px;font-weight:650">${titel}</span>
<span style="font-size:11px;font-weight:650;letter-spacing:.09em;text-transform:uppercase;color:${VORSCHLAG_INK}">${tn(varianten.length + 1, '{n} Vorschlag', '{n} Vorschläge')}</span>
</div>
<div style="display:flex;flex-direction:column;gap:8px">${originalBalken}${balken}</div>
<button data-act="variant-add" data-kind="${kind}" data-meet="${esc(meet.id)}" style="margin-top:13px;border:1.5px dashed var(--ink-a20);border-radius:999px;padding:9px 15px;font:650 12.5px ${FONT};color:var(--ink-soft);background:transparent;cursor:pointer;appearance:none"><span style="pointer-events:none">${t('+ Vorschlag')}</span></button>`,
  { closeAct: 'close-variant-pick', scrollKey: 'variant-pick' });
}

// --- Teilnahme-Dreiteilung = Auswahl-Control (v3.1 §7) ---
// Dabei | Offen | Abgesagt zeigt weiter alle Beteiligten UND ist zugleich die eigene
// Auswahl: die getönte Spalte ist der eigene Zustand, ein Tipp setzt ihn direkt.

// Runde 8 (R8-24, Jonathan: „Unentschieden = nichts (kein Strich)."): Es gibt zwei Aussagen, die ein
// Mensch macht — dabei oder abgesagt. „Noch nicht entschieden" ist keine Aussage und bekommt deshalb
// weder eine Spalte noch ein Zeichen. Die eigene Unentschiedenheit ist einfach: nichts angewählt —
// dieselbe Grammatik wie ✓/✕ an den Meets im Kalender (meet-browser.js rsvpPair).
const PART_STATES = [
  { state: 'yes', key: 'yes', label: t('Dabei'), color: 'var(--green-dark)', tint: 'var(--green-tint)', ring: 'var(--green-a40)' },
  // Sprachen: „Abgesagt" heißt hier „die Person hat abgesagt" — eigener Schlüssel, weil ein
  // abgesagtes Meet in anderen Sprachen ein anderes Wort ist (Declined ≠ Cancelled).
  { state: 'no', key: 'no', label: tk('Abgesagt', 'Person'), color: 'var(--red)', tint: 'var(--red-tint)', ring: 'var(--red-a30)' },
];

export function participationSection(ctx, meet, options = {}) {
  const groups = participationGroups(ctx.repo, meet);
  const compact = Boolean(options.compact);
  const editable = options.editable !== false && meet.status !== 'done';
  const mine = meet.participation?.[ME] || 'open';
  const size = compact ? 20 : 26;
  const labelSize = compact ? 9.5 : 10;
  const padY = compact ? 7 : 9;
  const settings = ctx.repo.getSettings();
  // v4 P0-3-9: Der Trenner bekommt die Farbe des Untergrunds, auf dem der Stapel liegt —
  // die getönte Fläche der eigenen Auswahl bzw. das Weiß/der warme Grund daneben.
  const surface = options.surface || 'var(--surface)';

  const cells = PART_STATES.map((entry) => {
    const people = groups[entry.key];
    const selected = editable && mine === entry.state;
    const color = (people.length || selected) ? entry.color : 'var(--muted-light)';
    const look = selected
      ? `background:${entry.tint};border:1px solid ${entry.ring}`
      : 'background:transparent;border:1px solid transparent';
    const stackOptions = { settings, separator: selected ? entry.tint : surface };
    const inner = `<span style="font-size:${labelSize}px;font-weight:650;letter-spacing:.07em;text-transform:uppercase;color:${color};pointer-events:none">${entry.label} · ${people.length}</span>${avatarStack(people, size, stackOptions)}`;
    const box = `flex:1;min-width:0;display:flex;flex-direction:column;align-items:center;gap:${compact ? 6 : 7}px;padding:${padY}px 4px;border-radius:${compact ? 12 : 15}px;box-sizing:border-box;${look}`;
    if (!editable) return { selected, html: `<div style="${box}">${inner}</div>` };
    return {
      selected,
      html: `<button data-act="set-part" data-state="${entry.state}" aria-pressed="${selected}" aria-label="${esc(entry.label)}" style="${box};cursor:pointer;appearance:none;font-family:${FONT};text-align:center">${inner}</button>`,
    };
  });

  // Runde 8 (R8-24): kein Trennstrich mehr zwischen den Spalten — der Abstand trennt genug.
  const row = cells.map((cell) => cell.html).join(`<span style="width:${compact ? 6 : 8}px;flex:none"></span>`);

  if (options.bare) {
    return `<div data-role="teilnahme" style="display:flex;border-top:1px solid var(--ink-a07);padding-top:6px">${row}</div>`;
  }
  const pad = compact ? 4 : 5;
  return `<div data-role="teilnahme" style="background:var(--surface);border:1px solid var(--ink-a10);border-radius:20px;padding:${pad}px;display:flex;flex:none">${row}</div>`;
}

// =====================================================================================
// Runde 11 (B2, Jonathan D2): Die Meet-Seite ist EIN System — in den Details und im Chat gleich.
//   Kopf (Titel, Zeit, Ort; Bild ODER Kartenvorschau) → Zusage-Reihe → Teilnehmende → nur die
//   HINZUGEFÜGTEN Module in fester Reihenfolge (Anreise · Mitbringen · Umfrage) → ganz unten EINE
//   ruhige Pille „+ Hinzufügen“. Im Chat steht dieselbe Auswahl hinter dem „+“ der Eingabezeile.
//
//   zusageReihe(ctx, meet, {compact?, bare?, editable?}) → html. Zwei große Knöpfe, mittig: Dabei · Nicht
//     dabei, je mit der Zahl. Ein Tipp auf die NICHT gewählte Seite setzt sie; ein Tipp auf die AKTIVE Wahl
//     nimmt sie direkt zurück (wieder offen). Halten klappt die Teilnehmenden-Liste auf, ohne die Wahl
//     zu ändern. „Vielleicht“ gibt es bewusst nicht: unentschieden ist keine Aussage (R8-24) und steht nirgends.
//   teilnehmendeKarte(ctx, meet, {compact?, bare?}) → html. Die Zeile „Teilnehmende“ mit den Zusagen als
//     kleinem Stapel; ein Tipp DARAUF (oder Halten auf einer Zusage-Seite) klappt EINE Liste ALLER
//     Mitglieder auf (ctx.ui.teilOffen) — keine Gruppierung nach Wahl, rechts je Person ein ruhiges
//     Zeichen (✓ dabei · × nicht dabei · „offen“ noch unentschieden). Weiterer Nachtrag (Wunsch 3): Die
//     eigene Zeile darin ist KEINE Aktion mehr — Abwaehlen geht nur noch ueber den erneuten Tipp auf
//     die aktive Wahl (Dabei/Nicht dabei) in der Zusage-Reihe.
//   moduleDa(ctx, meet) → { anreise, bring, polls }: was dieses Meet schon hat oder hier in dieser
//     Sitzung hinzugefügt wurde (ctx.ui.module[meetId]). modulDazu(ui, meetId, modul) merkt eines vor.
//   modulPille(ctx, meet) / modulSheet(ctx, meet) → die Pille „+ Hinzufügen“ und ihre Auswahl (nur die
//     Module, die noch fehlen). Handler in bindMeetPanels: 'modul-plus', 'modul-zu', 'modul-waehlen',
//     'teil-toggle', 'teil-wahl'; Halten auf einer Zusage-Seite (data-zusage) öffnet die Liste.
// =====================================================================================

export function moduleDa(ctx, meet) {
  const gewaehlt = ctx.ui?.module?.[meet.id] || [];
  const moeglich = mitfahrenMoeglich(meet);
  let anreiseInhalt = false;
  if (moeglich) {
    try {
      const stand = mitfahrStand(ctx.repo, meet);
      anreiseInhalt = Boolean(stand.fahrer.length || stand.suchen.length || stand.selbst.length || stand.anreisen.size);
    } catch { anreiseInhalt = false; }
  }
  return {
    anreise: moeglich && (anreiseInhalt || gewaehlt.includes('anreise')),
    bring: (meet.bring || []).length > 0 || gewaehlt.includes('bring'),
    polls: (meet.polls || []).length > 0 || gewaehlt.includes('polls'),
  };
}

export function modulDazu(ui, meetId, modul) {
  if (!ui.module) ui.module = {};
  const liste = ui.module[meetId] || [];
  if (!liste.includes(modul)) ui.module[meetId] = [...liste, modul];
}

const autoIcon = (color = 'var(--ink)', size = 17) => `<svg width="${size}" height="${size}" viewBox="0 0 24 24" fill="none" style="flex:none;pointer-events:none"><path d="M4.5 15.5v-3.3l1.9-4.5a1.9 1.9 0 0 1 1.7-1.2h7.8a1.9 1.9 0 0 1 1.7 1.2l1.9 4.5v3.3M3.6 15.5h16.8M5 12.2h14" stroke="${color}" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"></path><circle cx="7.7" cy="17.4" r="1.9" fill="${color}"></circle><circle cx="16.3" cy="17.4" r="1.9" fill="${color}"></circle></svg>`;

// Der Finger, der eine Zusage-Seite gehalten hat, hebt danach ab. Dieser eine Klick darf nichts auslösen —
// sonst schlösse er die Liste, die das Halten eben geöffnet hat. Jede neue Berührung hebt die Sperre auf.
let zusageKlickSperre = false;
if (globalThis.window?.addEventListener) {
  window.addEventListener('pointerdown', () => { zusageKlickSperre = false; }, true);
  window.addEventListener('click', (event) => {
    if (!zusageKlickSperre) return;
    zusageKlickSperre = false;
    event.preventDefault();
    event.stopPropagation();
  }, true);
}
const ZUSAGE_HALTEN_MS = 450;
const ZUSAGE_TOLERANZ_PX = 10;

const ZUSAGE_SEITEN = [
  { state: 'yes', key: 'yes', color: 'var(--green-dark)', tint: 'var(--green-tint)', ring: 'var(--green-a40)' },
  { state: 'no', key: 'no', color: 'var(--red)', tint: 'var(--red-tint)', ring: 'var(--red-a30)' },
];
const zusageLabel = (state) => (state === 'yes' ? t('Dabei') : (state === 'no' ? t('Nicht dabei') : t('Noch offen')));

export function zusageReihe(ctx, meet, options = {}) {
  const groups = participationGroups(ctx.repo, meet);
  const kompakt = Boolean(options.compact);
  const editable = options.editable !== false && meet.status !== 'done';
  const mine = meet.participation?.[ME] || 'open';
  const knoepfe = ZUSAGE_SEITEN.map((seite) => {
    const n = groups[seite.key].length;
    const gewaehlt = editable && mine === seite.state;
    const look = gewaehlt
      ? `background:${seite.tint};box-shadow:inset 0 0 0 1.5px ${seite.ring};color:${seite.color}`
      : 'background:var(--paper);color:var(--ink-soft)';
    const zeichen = seite.state === 'yes'
      ? `<svg width="${kompakt ? 15 : 18}" height="${kompakt ? 15 : 18}" viewBox="0 0 24 24" fill="none" style="flex:none;pointer-events:none"><path d="m6.5 12.5 4 4 7-8" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round"></path></svg>`
      : `<svg width="${kompakt ? 13 : 16}" height="${kompakt ? 13 : 16}" viewBox="0 0 24 24" fill="none" style="flex:none;pointer-events:none"><path d="M7 7l10 10M17 7 7 17" stroke="currentColor" stroke-width="2.4" stroke-linecap="round"></path></svg>`;
    const inhalt = `${zeichen}<span style="pointer-events:none;white-space:nowrap">${esc(zusageLabel(seite.state))}</span><span data-role="zusage-zahl" style="pointer-events:none;font-weight:600;font-variant-numeric:tabular-nums;opacity:.75">${n}</span>`;
    const stil = `flex:1;min-width:0;max-width:210px;min-height:${kompakt ? 44 : 54}px;border:0;border-radius:${kompakt ? 13 : 16}px;${look};display:flex;align-items:center;justify-content:center;gap:${kompakt ? 6 : 8}px;padding:0 10px;font:650 ${kompakt ? 13 : 14.5}px ${FONT};box-sizing:border-box;-webkit-user-select:none;user-select:none;-webkit-touch-callout:none`;
    if (!editable) return `<div style="${stil}">${inhalt}</div>`;
    return `<button data-act="set-part" data-state="${seite.state}" data-zusage="${seite.state}" aria-pressed="${gewaehlt}" aria-label="${esc(`${zusageLabel(seite.state)} · ${n}`)}" style="${stil};cursor:pointer;appearance:none">${inhalt}</button>`;
  }).join('');
  const reihe = `display:flex;justify-content:center;gap:${kompakt ? 8 : 10}px`;
  if (options.bare) return `<div data-role="zusage" style="${reihe};border-top:1px solid var(--ink-a07);padding-top:8px">${knoepfe}</div>`;
  return `<div data-role="zusage" style="${reihe};background:var(--surface);border:1px solid var(--ink-a10);border-radius:20px;padding:10px;flex:none">${knoepfe}</div>`;
}

// Runde 11 Nachtrag (D2): EIN Zeichen je Person statt einer Gruppen-Spalte — leise, ohne Fläche.
function teilZeichen(state) {
  if (state === 'yes') return `<span aria-hidden="true" style="font-size:13px;font-weight:700;color:var(--green-dark);flex:none;pointer-events:none">✓</span>`;
  if (state === 'no') return `<span aria-hidden="true" style="font-size:13px;font-weight:700;color:var(--red);flex:none;pointer-events:none">×</span>`;
  return `<span aria-hidden="true" style="font-size:11px;font-weight:650;color:var(--muted-light);flex:none;pointer-events:none">${t('offen')}</span>`;
}

// Eine Zeile der Liste ALLER Mitglieder: Name/Bild links, das ruhige Zeichen rechts. Weiterer
// Nachtrag (Wunsch 3, Jonathan): Die eigene Zeile ist KEINE Aktion mehr — Abwaehlen geht nur noch
// ueber den erneuten Tipp auf die aktive Wahl (Dabei/Nicht dabei) in der Zusage-Reihe.
function teilnehmerZeile(ctx, meet, person, state, editable, kompakt) {
  const settings = ctx.repo.getSettings();
  const size = kompakt ? 22 : 26;
  const name = person.id === ME ? t('Du') : person.name;
  const inhalt = `<span style="display:flex;align-items:center;gap:8px;flex:1;min-width:0;pointer-events:none">${personAvatar(person, { size, fontSize: Number((size * 0.36).toFixed(1)), marker: personMarker(person.id, settings), compact: true, active: false })}<span style="font-size:13px;font-weight:600;color:var(--ink);white-space:nowrap;overflow:hidden;text-overflow:ellipsis;min-width:0">${esc(name)}</span></span>${teilZeichen(state)}`;
  const reihe = `display:flex;align-items:center;gap:8px;width:100%;min-height:${kompakt ? 32 : 36}px`;
  const attrs = `data-role="teil-person" data-person="${esc(person.id)}" data-zustand="${state}"`;
  return `<div ${attrs} style="${reihe}">${inhalt}</div>`;
}

export function teilnehmendeKarte(ctx, meet, options = {}) {
  const groups = participationGroups(ctx.repo, meet);
  const kompakt = Boolean(options.compact);
  const alle = groups.yes.length + groups.no.length + groups.open.length;
  if (!alle) return '';
  const offen = Boolean(ctx.ui?.teilOffen);
  const editable = options.editable !== false && meet.status !== 'done';
  const stapel = groups.yes.length ? avatarStack(groups.yes, kompakt ? 20 : 24, { settings: ctx.repo.getSettings() }) : '';
  const kopf = `<button data-act="teil-toggle" data-role="teil-kopf" aria-expanded="${offen}" aria-label="${esc(`${t('Teilnehmende')} · ${alle}`)}" style="width:100%;display:flex;align-items:center;gap:10px;min-height:${kompakt ? 44 : 52}px;padding:0 ${kompakt ? 4 : 14}px;border:0;background:transparent;cursor:pointer;appearance:none;font-family:${FONT};color:var(--ink);text-align:left;box-sizing:border-box">
<span style="font-size:${kompakt ? 12.5 : 13}px;font-weight:650;pointer-events:none">${esc(t('Teilnehmende'))} · ${alle}</span>
<span style="flex:1"></span>
${stapel}
<span style="pointer-events:none;display:flex;flex:none">${chevron(offen ? 'up' : 'down', offen ? 'var(--ink)' : 'var(--muted-light)')}</span>
</button>`;
  let liste = '';
  if (offen) {
    // Runde 11 Nachtrag (D2): EINE Liste aller Mitglieder — keine Gruppierung nach Wahl.
    const zeilen = meetMemberIds(ctx.repo, meet)
      .map((id) => ctx.repo.getPerson(id))
      .filter(Boolean)
      .map((person) => {
        const antwort = meet.participation?.[person.id];
        const state = antwort === 'yes' || antwort === 'no' ? antwort : 'open';
        return teilnehmerZeile(ctx, meet, person, state, editable, kompakt);
      }).join('');
    liste = `<div data-role="teil-liste" style="display:flex;flex-direction:column;padding:0 ${kompakt ? 2 : 14}px ${kompakt ? 6 : 13}px">${zeilen}</div>`;
  }
  if (options.bare) return `<div data-role="teilnehmende" style="border-top:1px solid var(--ink-a07);display:flex;flex-direction:column">${kopf}${liste}</div>`;
  return `<div data-role="teilnehmende" style="background:var(--surface);border:1px solid var(--ink-a10);border-radius:20px;display:flex;flex-direction:column;flex:none">${kopf}${liste}</div>`;
}

// Die Pille „+ Hinzufügen“ — nur solange noch ein Modul fehlt. Im Chat gibt es sie nicht: dort ist es das „+“.
export function modulPille(ctx, meet) {
  if (meet.status === 'done' || meet.status === 'draft') return '';
  const da = moduleDa(ctx, meet);
  if (da.anreise && da.bring && da.polls) return '';
  return `<div style="display:flex;justify-content:center;padding:6px 0 0;flex:none"><button data-act="modul-plus" data-role="modul-plus" data-treffer aria-haspopup="dialog" style="min-height:44px;padding:0 20px;border:1.5px solid var(--ink-a14);border-radius:999px;background:var(--paper-soft);color:var(--ink-soft);cursor:pointer;appearance:none;font:650 13px ${FONT};box-shadow:0 1px 3px var(--shadow-08)">+ ${esc(t('Hinzufügen'))}</button></div>`;
}

export function modulSheet(ctx, meet) {
  if (!ctx.ui?.modulWahl) return '';
  const da = moduleDa(ctx, meet);
  const zeilen = [
    ['anreise', autoIcon('var(--ink)', 17), t('Mitfahrt'), t('wer fährt, wer fährt mit')],
    ['bring', circleCheckIcon('var(--ink)', 17), t('Liste'), t('wer bringt was mit')],
    ['polls', barsIcon('var(--ink)', 17), t('Umfrage'), t('abstimmen lassen')],
  ].filter(([modul]) => !da[modul]);
  if (!zeilen.length) return '';
  const zeile = ([modul, svg, label, sub], index) => `<button data-act="modul-waehlen" data-modul="${modul}" style="display:flex;align-items:center;gap:11px;padding:11px 2px;border:0;${index < zeilen.length - 1 ? 'border-bottom:1px solid var(--ink-a06);' : ''}background:transparent;width:100%;text-align:left;cursor:pointer;appearance:none;font-family:${FONT}">
<span style="width:34px;height:34px;border-radius:11px;background:var(--paper);display:flex;align-items:center;justify-content:center;flex:none;pointer-events:none">${svg}</span>
<span style="display:flex;flex-direction:column;gap:1px;pointer-events:none;min-width:0;flex:1"><span style="font-size:14px;font-weight:650;color:var(--ink)">${esc(label)}</span><span style="font-size:11.5px;color:var(--muted)">${esc(sub)}</span></span>
</button>`;
  return sheet(`<div style="display:flex;flex-direction:column;gap:9px;font-family:${FONT}">
<span style="font-family:'Bricolage Grotesque',sans-serif;font-size:20px;font-weight:650">${esc(t('Hinzufügen'))}</span>
<div style="display:flex;flex-direction:column">${zeilen.map(zeile).join('')}</div>
</div>`, { closeAct: 'modul-zu', scrollKey: 'meet-modul' });
}

// --- Kopfzeile eines Bereichs (geschlossen = Kachel; geöffnet = Kopf INNERHALB derselben Box) ---

// v5 A15: `empty` schaltet die Kopfzeile auf den Erstellungsweg um — eine leere Liste
// oder Umfrage klappt keinen leeren Bereich auf.
// R3 K1 (Jonathan: „Mitbringen kann man irgendwie nicht schließen, wenn man es geöffnet hat"):
// Der Kopf eines GEÖFFNETEN leeren Bereichs trug weiter 'panel-empty' — und das öffnet nur.
// Jeder Tipp darauf setzte den Bereich wieder auf, er ließ sich nie zuklappen (gemessen an
// „Mitbringen · 0" im Kochabend). Geöffnet ist der Kopf jetzt immer 'panel-toggle'; der
// Pfeil sitzt dann auf einer sichtbaren runden Fläche, damit man den Schließen-Weg auch sieht.
function panelHeader(panel, icon, label, expanded, empty = false) {
  const style = expanded
    ? 'border:0;background:transparent;padding:10px 10px 10px 14px'
    : 'background:var(--surface);border:1px solid var(--ink-a10);border-radius:18px;padding:12px 14px';
  const act = expanded ? 'panel-toggle' : (empty ? 'panel-empty' : 'panel-toggle');
  const pfeil = expanded
    ? `<span style="pointer-events:none;display:flex;align-items:center;justify-content:center;width:30px;height:30px;border-radius:50%;background:var(--field);flex:none">${chevron('up', 'var(--ink)')}</span>`
    : `<span style="pointer-events:none;display:flex">${chevron('down', 'var(--muted-light)')}</span>`;
  const hinweis = expanded ? t('{bereich} zuklappen', { bereich: label }) : label;
  return `<button data-act="${act}" data-panel="${panel}" aria-expanded="${expanded}" aria-label="${esc(hinweis)}" style="${style};display:flex;align-items:center;gap:8px;width:100%;cursor:pointer;appearance:none;font-family:${FONT};color:var(--ink);text-align:left;box-sizing:border-box">
<span style="pointer-events:none;display:flex">${icon}</span>
<span style="font-size:13px;font-weight:650;flex:1;min-width:0;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;pointer-events:none">${label}</span>
${pfeil}
</button>`;
}

// R3 K2 (Jonathan: „Man sieht nicht wirklich, wenn etwas angewählt wurde, z. B. bei der
// Umfrage"): Vorher war die eigene Stimme nur eine grüne Schrift auf demselben beigen Balken
// plus ein gefüllter Kreis rechts außen — und der hohle Kreis der anderen Antworten war
// ebenfalls grün mit Haken, sah also schon halb gewählt aus. Jetzt:
//   · die GANZE Zeile ist die Trefferfläche (vorher nur der 28-px-Kreis),
//   · die eigene Antwort trägt eine grün getönte Fläche mit grüner Kontur, fette grüne Schrift,
//     eine grüne Zahl und einen gefüllten Haken,
//   · alle anderen haben einen leeren, neutralen Kreis ohne Haken.
// So ist die Wahl in hell und dunkel auf einen Blick und ohne Farbensehen erkennbar.
function pollAntwort(poll, option, total, options = {}) {
  const mine = option.votes.includes(ME);
  const votable = options.votable !== false;
  const share = total ? Math.max(10, Math.round((option.votes.length / total) * 100)) : 0;
  const kontur = mine
    ? '<span style="position:absolute;inset:0;border-radius:12px;box-shadow:inset 0 0 0 1.5px var(--green-a60);pointer-events:none"></span>'
    : '';
  const balken = `<span style="flex:1;min-width:0;height:38px;border-radius:12px;background:${mine ? 'var(--green-tint)' : 'var(--paper)'};position:relative;overflow:hidden;display:block;pointer-events:none">
<span style="position:absolute;left:0;top:0;bottom:0;width:${share}%;background:${mine ? 'var(--green-a22)' : 'var(--field)'}"></span>
<span style="position:absolute;left:12px;right:10px;top:0;bottom:0;display:flex;align-items:center;font-size:13px;font-weight:${mine ? 700 : 600};color:${mine ? 'var(--green-dark)' : 'var(--ink-soft)'}"><span style="overflow:hidden;text-overflow:ellipsis;white-space:nowrap">${esc(option.label)}</span></span>
${kontur}</span>`;
  const zahl = `<span style="font-size:12.5px;font-weight:650;color:${mine ? 'var(--green-dark)' : 'var(--muted)'};font-variant-numeric:tabular-nums;min-width:12px;text-align:right;flex:none;pointer-events:none">${option.votes.length}</span>`;
  const kreis = mine
    ? `<span style="width:26px;height:26px;border-radius:50%;background:var(--green);display:flex;align-items:center;justify-content:center;flex:none;pointer-events:none">${checkPath('var(--on-accent)', 2.6, 14)}</span>`
    : `<span style="width:26px;height:26px;border-radius:50%;border:1.5px solid var(--ink-a20);box-sizing:border-box;flex:none;pointer-events:none"></span>`;
  const reihe = 'display:flex;align-items:center;gap:9px;width:100%';
  if (!votable) {
    return `<div data-poll-antwort="${esc(option.id)}" data-mine="${mine}" style="${reihe}">${balken}${zahl}${mine ? kreis : '<span style="width:26px;flex:none"></span>'}</div>`;
  }
  const aria = mine
    ? t('{antwort} — deine Stimme', { antwort: option.label })
    : t('Für {antwort} stimmen', { antwort: option.label });
  return `<button data-act="vote-poll" data-poll="${esc(poll.id)}" data-option="${esc(option.id)}" aria-pressed="${mine}" aria-label="${esc(aria)}" style="${reihe};border:0;background:transparent;padding:0;cursor:pointer;appearance:none;font-family:${FONT};text-align:left">${balken}${zahl}${kreis}</button>`;
}

function pollBloecke(polls, options = {}) {
  return polls.map((poll, index) => {
    const total = poll.options.reduce((sum, option) => sum + option.votes.length, 0);
    const rows = poll.options.map((option) => pollAntwort(poll, option, total, options)).join('');
    return `<div style="display:flex;flex-direction:column;gap:8px${index ? ';border-top:1px solid var(--ink-a06);padding-top:14px' : ''}">
<div style="display:flex;align-items:baseline;gap:8px"><span style="font-size:14.5px;font-weight:650;flex:1;min-width:0">${esc(poll.question)}</span><span style="font-size:11.5px;color:var(--muted);font-variant-numeric:tabular-nums;flex:none">${tn(total, '{n} Stimme', '{n} Stimmen')}</span></div>${rows}</div>`;
  }).join('');
}

// v3.1 §7: Übernommene Mitbringen-Punkte zeigen das Profilbild der Person STATT des Hakens.
// Offene Punkte behalten den hohlen grünen Haken als Einladung, ihn zu übernehmen.
function bringTakerControl(ctx, item, options = {}) {
  const size = options.size || 28;
  const takenBy = item.takenBy || [];
  const label = esc(item.label || '');
  // R3: Im Rückblick wird nur nachgesehen — kein Übernehmen, kein Freigeben.
  if (options.readOnly && !takenBy.length) {
    return `<span style="font-size:12px;color:var(--muted-light);flex:none">${t('niemand')}</span>`;
  }
  if (!takenBy.length) {
    // v6 A11a: warme, ruhige Übernehmen-Geste statt eines grünen Hakens (= „erledigt").
    return `<button data-act="toggle-bring" data-item="${esc(item.id)}" aria-pressed="false" aria-label="${esc(t('{punkt} übernehmen', { punkt: item.label || '' }))}" style="width:${size}px;height:${size}px;border-radius:50%;background:var(--orange-dark-a08);border:1.5px solid var(--orange-dark-a34);box-sizing:border-box;display:flex;align-items:center;justify-content:center;flex:none;cursor:pointer;appearance:none;padding:0"><span style="pointer-events:none;display:flex">${adoptGlyph('var(--orange-dark)', Math.round(size * 0.62))}</span></button>`;
  }
  const people = takenBy.map((id) => ctx.repo.getPerson(id)).filter(Boolean);
  const mine = takenBy.includes(ME);
  const shown = people.slice(0, 2);
  const overlap = Math.round(size * 0.3);
  const font = (size * 0.36).toFixed(1);
  // v6 A11b: Das Profilbild kommt aus derselben Komponente wie überall (personAvatar) —
  // nur so trägt es Goldring und Zeichen der Person. Der grüne Ring der EIGENEN Übernahme
  // bleibt ein eigener Layer außen herum.
  const settings = ctx.repo.getSettings();
  const faces = shown.map((person, index) => {
    const own = person.id === ME;
    const ring = own ? 'box-shadow:0 0 0 2px var(--green)' : stackSeparator('var(--surface)');
    return `<span style="display:flex;border-radius:50%;${ring};flex:none${index ? `;margin-left:-${overlap}px` : ''}">${personAvatar(person, { size, fontSize: Number(font), marker: personMarker(person.id, settings) })}</span>`;
  }).join('');
  const extra = people.length > shown.length
    ? `<span style="width:${size}px;height:${size}px;border-radius:50%;background:var(--field);color:var(--muted);font:600 ${font}px/${size}px ${FONT};text-align:center;${stackSeparator('var(--surface)')};flex:none;margin-left:-${overlap}px">+${people.length - shown.length}</span>`
    : '';
  const names = people.map((person) => (person.id === ME ? t('Du') : person.name)).join(', ');
  const aria = `${label} · ${esc(names)}`;
  if (mine && !options.readOnly) {
    return `<button data-act="toggle-bring" data-item="${esc(item.id)}" aria-pressed="true" aria-label="${esc(t('{punkt} · {namen} — wieder freigeben', { punkt: item.label || '', namen: names }))}" style="display:flex;align-items:center;border:0;background:transparent;padding:0;cursor:pointer;appearance:none;flex:none"><span style="display:flex;pointer-events:none">${faces}${extra}</span></button>`;
  }
  return `<span role="img" aria-label="${aria}" style="display:flex;align-items:center;flex:none">${faces}${extra}</span>`;
}

// --- Mitbringen (v14 05.8: eine Box; Zeile = Gegenstand · übernehmende Person) ---

export function bringSection(ctx, meet, options = {}) {
  const items = meet.bring || [];
  const expanded = Boolean(options.expanded);
  const label = options.label || t('Mitbringen');
  const header = panelHeader('bring', circleCheckIcon(), `${label} · ${items.length}`, expanded, items.length === 0);
  if (!expanded) return header;

  const rows = items.map((item, index) => `<div style="display:flex;align-items:center;gap:12px${index ? ';border-top:1px solid var(--ink-a06);padding-top:13px' : ''}">
<span style="font-size:14.5px;font-weight:650;color:var(--ink);flex:1;min-width:0;overflow:hidden;text-overflow:ellipsis;white-space:nowrap">${esc(item.label)}</span>
${bringTakerControl(ctx, item)}</div>`).join('');

  // Der getippte Text lebt in ctx.ui.bringDraft: er überlebt jedes Rerender (Stimme,
  // Übernahme) und die Ü4-Nachfrage beim Zuklappen.
  const addRow = `<div style="display:flex;gap:8px;align-items:center${items.length ? ';border-top:1px solid var(--ink-a06);padding-top:13px' : ''}">
<input id="bring-input" value="${esc(ctx.ui.bringDraft || '')}" placeholder="${esc(t('Etwas hinzufügen'))}" maxlength="40" style="flex:1;min-width:0;border:1.5px dashed var(--ink-a16);border-radius:12px;padding:9px 12px;font:500 12.5px ${FONT};color:var(--ink);background:transparent;outline:none">
<button data-act="add-bring" aria-label="${esc(t('Hinzufügen'))}" style="width:30px;height:30px;border-radius:50%;background:var(--field);border:0;display:flex;align-items:center;justify-content:center;cursor:pointer;appearance:none;padding:0;flex:none"><span style="pointer-events:none;display:flex">${plus('var(--ink)', 14)}</span></button>
</div>`;

  // EINE Box mit einer Kante: Kopf und Inhalt liegen darin, nur die Größe ändert sich.
  // v5 A15: Ist noch nichts drauf, steht hier kein leerer Kasten, sondern eine klare
  // Aufforderung mit dem Eingabefeld — der Bereich hat immer echten Inhalt.
  const leerHinweis = items.length
    ? ''
    : `<span style="font-size:12.5px;color:var(--muted);line-height:1.45">${t('Noch nichts drauf — schreib den ersten Punkt.')}</span>`;
  return `<div style="background:var(--surface);border:1px solid var(--ink-a10);border-radius:18px;display:flex;flex-direction:column;flex:none">
${header}
<div style="padding:2px 14px 14px;display:flex;flex-direction:column;gap:13px">${leerHinweis}${rows}${addRow}</div>
</div>`;
}

// --- Umfragen (gleiches Box-Prinzip) ---

export function pollSection(ctx, meet, options = {}) {
  const polls = meet.polls || [];
  const expanded = Boolean(options.expanded);
  const header = panelHeader('polls', barsIcon(), `${t('Umfragen')} · ${polls.length}`, expanded, polls.length === 0);
  if (!expanded) return header;

  const blocks = pollBloecke(polls);

  const inputStyle = `border:1px solid var(--ink-a12);border-radius:12px;padding:10px 12px;font:500 12.5px ${FONT};color:var(--ink);background:var(--paper);outline:none`;
  const draft = ctx.ui.pollDraft || {};
  const form = ctx.ui.pollForm
    ? `<div style="display:flex;flex-direction:column;gap:8px${polls.length ? ';border-top:1px solid var(--ink-a06);padding-top:14px' : ''}">
<input id="poll-q" value="${esc(draft.q || '')}" placeholder="${esc(t('Frage'))}" maxlength="60" style="${inputStyle}">
<input id="poll-o1" value="${esc(draft.a || '')}" placeholder="${esc(t('Option 1'))}" maxlength="40" style="${inputStyle}">
<input id="poll-o2" value="${esc(draft.b || '')}" placeholder="${esc(t('Option 2'))}" maxlength="40" style="${inputStyle}">
<button data-act="add-poll" style="align-self:flex-end;background:var(--green);color:var(--on-accent);border-radius:999px;padding:9px 16px;font:650 12.5px ${FONT};border:0;cursor:pointer;appearance:none">${t('Hinzufügen')}</button>
</div>`
    : `<div${polls.length ? ' style="border-top:1px solid var(--ink-a06);padding-top:14px"' : ''}>
<button data-act="toggle-add-poll" style="border:1.5px dashed var(--ink-a20);border-radius:999px;padding:8px 14px;font:650 12px ${FONT};color:var(--ink-soft);background:transparent;cursor:pointer;appearance:none">${t('+ Umfrage')}</button>
</div>`;

  return `<div style="background:var(--surface);border:1px solid var(--ink-a10);border-radius:18px;display:flex;flex-direction:column;flex:none">
${header}
<div style="padding:2px 14px 14px;display:flex;flex-direction:column;gap:14px">${blocks}${form}</div>
</div>`;
}

// --- Mitbringen | Umfragen als stehende Kachelreihe (R4 C4) ---------------------------------
//
// Jonathan: „Wenn man etwas auswählt, dann muss die Ansicht gleich bleiben und darf nicht
// herumspringen." Bisher wurde die angetippte Kachel beim Öffnen selbst zur großen Box — die
// rechte Kachel „Umfragen" rutschte dabei unter „Mitbringen" (gemessen: 52 px nach unten,
// 179 px nach links). Jetzt bleiben beide Kacheln stehen, wo sie sind (wie im Raum-Panel);
// nur Fläche und Pfeil sagen „offen", der Inhalt erscheint darunter. Ein zweiter Tipp auf
// die offene Kachel schließt, ein Tipp auf die andere wechselt.
function panelKachel(panel, icon, label, offen, leer) {
  const act = offen ? 'panel-toggle' : (leer ? 'panel-empty' : 'panel-toggle');
  const look = offen
    ? 'background:var(--field);border:1px solid var(--ink-a22)'
    : 'background:var(--surface);border:1px solid var(--ink-a10)';
  const hinweis = offen ? t('{bereich} zuklappen', { bereich: label }) : label;
  return `<button data-act="${act}" data-panel="${panel}" aria-expanded="${offen}" aria-label="${esc(hinweis)}" style="flex:1;min-width:0;${look};border-radius:18px;height:46px;padding:0 12px 0 14px;display:flex;align-items:center;gap:8px;box-sizing:border-box;cursor:pointer;appearance:none;font-family:${FONT};color:var(--ink);text-align:left">
<span style="pointer-events:none;display:flex">${icon}</span>
<span style="font-size:13px;font-weight:650;flex:1;min-width:0;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;pointer-events:none">${label}</span>
<span style="pointer-events:none;display:flex;align-items:center;justify-content:center;width:22px;height:22px;flex:none">${chevron(offen ? 'up' : 'down', offen ? 'var(--ink)' : 'var(--muted-light)')}</span>
</button>`;
}

function bringInhalt(ctx, meet) {
  const items = meet.bring || [];
  // Die Eingabe steht OBEN: Ein neuer Punkt kommt darunter dazu, Feld und „+" bleiben stehen.
  const addRow = `<div style="display:flex;gap:8px;align-items:center">
<input id="bring-input" value="${esc(ctx.ui.bringDraft || '')}" placeholder="${esc(t('Etwas hinzufügen'))}" maxlength="40" style="flex:1;min-width:0;height:44px;box-sizing:border-box;border:1.5px dashed var(--ink-a16);border-radius:12px;padding:0 12px;font:500 13px ${FONT};color:var(--ink);background:transparent;outline:none">
<button data-act="add-bring" aria-label="${esc(t('Hinzufügen'))}" style="width:44px;height:44px;border-radius:50%;background:var(--field);border:0;display:flex;align-items:center;justify-content:center;cursor:pointer;appearance:none;padding:0;flex:none"><span style="pointer-events:none;display:flex">${plus('var(--ink)', 15)}</span></button>
</div>`;
  const rows = items.map((item) => `<div style="display:flex;align-items:center;gap:12px;border-top:1px solid var(--ink-a06);padding-top:12px">
<span style="font-size:14.5px;font-weight:650;color:var(--ink);flex:1;min-width:0;overflow:hidden;text-overflow:ellipsis;white-space:nowrap">${esc(item.label)}</span>
${bringTakerControl(ctx, item)}</div>`).join('');
  const leerHinweis = items.length
    ? ''
    : `<span style="font-size:12.5px;color:var(--muted);line-height:1.45">${t('Noch nichts drauf — schreib den ersten Punkt.')}</span>`;
  return `<div data-role="panel-inhalt" data-panel="bring" style="background:var(--surface);border:1px solid var(--ink-a10);border-radius:18px;padding:12px 14px 14px;display:flex;flex-direction:column;gap:12px;flex:none">${addRow}${leerHinweis}${rows}</div>`;
}

function pollInhalt(ctx, meet) {
  const polls = meet.polls || [];
  const inputStyle = `height:44px;box-sizing:border-box;border:1px solid var(--ink-a12);border-radius:12px;padding:0 12px;font:500 13px ${FONT};color:var(--ink);background:var(--paper);outline:none`;
  const draft = ctx.ui.pollDraft || {};
  const trenner = polls.length ? ';border-top:1px solid var(--ink-a06);padding-top:14px' : '';
  const form = ctx.ui.pollForm
    ? `<div style="display:flex;flex-direction:column;gap:8px${trenner}">
<input id="poll-q" value="${esc(draft.q || '')}" placeholder="${esc(t('Frage'))}" maxlength="60" style="${inputStyle}">
<input id="poll-o1" value="${esc(draft.a || '')}" placeholder="${esc(t('Option 1'))}" maxlength="40" style="${inputStyle}">
<input id="poll-o2" value="${esc(draft.b || '')}" placeholder="${esc(t('Option 2'))}" maxlength="40" style="${inputStyle}">
<button data-act="add-poll" style="align-self:flex-end;min-height:44px;background:var(--green);color:var(--on-accent);border-radius:999px;padding:0 18px;font:650 13px ${FONT};border:0;cursor:pointer;appearance:none">${t('Hinzufügen')}</button>
</div>`
    : `<div style="display:flex${trenner}">
<button data-act="toggle-add-poll" style="min-height:44px;border:1.5px dashed var(--ink-a20);border-radius:999px;padding:0 16px;font:650 12.5px ${FONT};color:var(--ink-soft);background:transparent;cursor:pointer;appearance:none">${t('+ Umfrage')}</button>
</div>`;
  return `<div data-role="panel-inhalt" data-panel="polls" style="background:var(--surface);border:1px solid var(--ink-a10);border-radius:18px;padding:12px 14px 14px;display:flex;flex-direction:column;gap:14px;flex:none">${pollBloecke(polls)}${form}</div>`;
}

export function meetPanelReihe(ctx, meet) {
  const offen = ['bring', 'polls'].includes(ctx.ui.panel) ? ctx.ui.panel : null;
  const items = meet.bring || [];
  const polls = meet.polls || [];
  const da = moduleDa(ctx, meet);
  // Runde 11 (B2, D2): Nur die HINZUGEFÜGTEN Module stehen da, in fester Reihenfolge Anreise · Mitbringen ·
  // Umfrage, jedes über die ganze Breite; darunter EINE ruhige Pille „+ Hinzufügen“.
  const teile = [];
  if (da.anreise) teile.push(anreiseKnopf(ctx, meet));
  if (da.bring) {
    teile.push(`<div style="display:flex">${panelKachel('bring', circleCheckIcon(), `${t('Mitbringen')} · ${items.length}`, offen === 'bring', false)}</div>`);
    if (offen === 'bring') teile.push(bringInhalt(ctx, meet));
  }
  if (da.polls) {
    teile.push(`<div style="display:flex">${panelKachel('polls', barsIcon(), `${t('Umfragen')} · ${polls.length}`, offen === 'polls', false)}</div>`);
    if (offen === 'polls') teile.push(pollInhalt(ctx, meet));
  }
  // R5 (P4): Eine Hülle mit demselben 9-px-Abstand wie die Abschnitte der Meet-Details — sie hält beim
  // Schrumpfen ihre größte Höhe (bindMeetPanels), damit ganz unten nichts nachrutscht.
  return `<div data-role="panel-bereich" data-meet="${esc(meet.id)}" style="display:flex;flex-direction:column;gap:9px;flex:none">${teile.join('')}${modulPille(ctx, meet)}</div>`;
}

// --- Rückblick: Mitbringen und Umfragen zum Nachsehen (R3 E5) ---------------------------
// Ein vorbeies Meet ist eine feste Übersicht. Wer was mitgebracht hat und wie abgestimmt
// wurde, bleibt lesbar — in derselben Bauform wie oben, aber ohne Bedienelemente, die nach
// dem Meet nichts mehr bewirken sollen.

function rueckblickBox(icon, titel, inhalt) {
  return `<div style="background:var(--surface);border:1px solid var(--ink-a10);border-radius:18px;display:flex;flex-direction:column;flex:none">
<div style="display:flex;align-items:center;gap:8px;padding:12px 14px 4px"><span style="display:flex">${icon}</span><span style="font-size:13px;font-weight:650;flex:1;min-width:0">${titel}</span></div>
<div style="padding:6px 14px 14px;display:flex;flex-direction:column;gap:12px">${inhalt}</div>
</div>`;
}

export function bringRueckblick(ctx, meet) {
  const items = meet.bring || [];
  if (!items.length) return '';
  const rows = items.map((item, index) => `<div style="display:flex;align-items:center;gap:12px${index ? ';border-top:1px solid var(--ink-a06);padding-top:12px' : ''}">
<span style="font-size:14px;font-weight:650;color:var(--ink);flex:1;min-width:0;overflow:hidden;text-overflow:ellipsis;white-space:nowrap">${esc(item.label)}</span>
${bringTakerControl(ctx, item, { size: 26, readOnly: true })}</div>`).join('');
  return `<div data-role="rueckblick-bring">${rueckblickBox(circleCheckIcon(), `${t('Mitbringen')} · ${items.length}`, rows)}</div>`;
}

export function pollRueckblick(ctx, meet) {
  const polls = meet.polls || [];
  if (!polls.length) return '';
  return `<div data-role="rueckblick-polls">${rueckblickBox(barsIcon(), `${t('Umfragen')} · ${polls.length}`, pollBloecke(polls, { votable: false }))}</div>`;
}

// --- Vorbei? (R3 E5) — dieselbe Regel wie der Verlauf ---------------------------------------

// Runde 11 (B10): Die Regel selbst steht in data/projections.js (meetIstVorbei) — eine Wahrheit.
export function meetVorbei(meet, jetzt = now()) {
  return meetIstVorbei(meet, toISODate(jetzt));
}

// --- Bewertungs-Hinweis (R3 E4) ------------------------------------------------------------
// Jonathan: „Wenn man ein Event fertig hat und in die App geht, soll man einen Hinweis
// bekommen, dass man es bewerten kann. Klickt man darauf, ist man direkt bei der Bewertung."
//
// Der Hinweis ist ein ruhiger Baustein für die Startseiten. Er erscheint nur, wo er etwas
// bedeutet: ich war dabei, das Meet ist vorbei und nicht abgesagt, es ist höchstens eine
// Woche her und noch nicht bewertet. Weggeklickt bleibt er auf diesem Gerät weg — ein
// Hinweis, den man nicht los wird, wäre Nörgeln. Bewerten lässt es sich weiter im Verlauf.

const HINWEIS_TAGE = 7;
const HINWEIS_MERKER = 'crew.bewertungHinweisWeg';

function weggeklickteHinweise() {
  try {
    const liste = JSON.parse(globalThis.localStorage?.getItem(HINWEIS_MERKER) || '[]');
    return Array.isArray(liste) ? liste : [];
  } catch {
    return [];
  }
}

// Runde 11 (B10, D10): Das ✕ an der Frage ist weg — die Frage ist jetzt eine leise Pille in der Zeile
// und läuft nach sieben Tagen von selbst aus. Wer den Hinweis früher schon weggetippt hatte, wird
// weiter nicht gefragt (Merker bleibt gelesen), neu setzen lässt er sich nicht mehr.

// R6 D6: Die KACHEL des alten Hinweises (bewertungsHinweis / bewertungsHinweisAktionen /
// bewertungsHinweisMeet) ist entfallen. Sie stand auf der Crew-Startseite — also weit weg
// von dem Meet, um das es ging — und trug einen orangen Punkt wie eine offene Schuld.
// An ihre Stelle tritt die Zeile unten: am Meet, im Raum und in der Liste. Der Merker der
// weggetippten Hinweise (HINWEIS_MERKER) bleibt derselbe, damit niemand, der die Kachel
// schon weggetippt hatte, nun wieder gefragt wird.

// --- R6 D6: Der Hinweis zieht zum MEET ------------------------------------------------------
//
// Jonathan (Runde 6): „Bewertungshinweis könnten wir eventuell woanders hin geben."
// Die Kachel auf der Crew-Startseite ist weg (P1). Gefragt wird jetzt dort, wo das Meet
// steht — im Rückblick, in der Meet-Box des Raums und als leise Zeile unter dem vergangenen
// Meet in der Liste. Die Zeile stellt EINE Frage und nimmt EINEN Tipp entgegen; alles
// Weitere (Themen, Notiz) bleibt auf der bestehenden Bewertungsseite und kommt nur, wenn
// jemand sie ausdrücklich öffnet.
//
// Sie mahnt nicht: kein Zähler, keine Farbfläche, keine zweite Erinnerung.
//
// Runde 11 (B10, Jonathan D10): Keine eigene Abfrage-Box unter der Karte und keine winzigen Gesichter
// daneben — die Frage ist eine leise Pille IN der Zeile des Meets (bewertungsPille). Sie öffnet die
// Bewertungsseite: erst nur die drei Stufen, nach dem Tipp die freiwilligen Angaben, keine Notiz.

// Die drei Stufen und ihre Zeichen. Sie standen bisher nur in screens/meet-details.js;
// seit die Frage auch am Meet und in der Liste steht, gehören sie in den gemeinsamen
// Baustein — EINE Quelle für Wortlaut, Gesicht und Farbe. meet-details.js liest sie hier.
export const BEWERTUNG_STUFEN = [
  { id: 'nicht-gut', label: t('Nicht gut'), ton: 'rot', gesicht: 'traurig' },
  { id: 'mittel', label: t('Mittel'), ton: 'blau', gesicht: 'neutral' },
  { id: 'gut', label: t('Gut'), ton: 'gruen', gesicht: 'froh' },
];

// `glyph` ist die Zeichenfarbe AUF der gefüllten Fläche. Blau ist die urteilsfreie Mitte
// (R4 H1): Orange gehört dem Vorschlagszustand, und Blau bleibt auch bei Rot-Grün-Schwäche
// von beiden Seiten getrennt. Grau trägt nur „Hat nicht stattgefunden".
export const BEWERTUNG_TON = {
  gruen: { fill: 'var(--green)', tint: 'var(--green-tint)', line: 'var(--green-a45)', ink: 'var(--green-dark)', glyph: 'var(--on-accent)' },
  blau: {
    fill: 'color-mix(in srgb,var(--blue-dark) 75%,var(--blue-tint))',
    tint: 'var(--blue-tint)',
    line: 'color-mix(in srgb,var(--blue) 60%,transparent)',
    ink: 'var(--blue-dark)',
    glyph: 'var(--on-accent)',
  },
  rot: { fill: 'var(--red)', tint: 'var(--red-tint)', line: 'var(--red-a45)', ink: 'var(--danger)', glyph: 'var(--on-accent)' },
  grau: { fill: 'var(--ink-soft)', tint: 'var(--field)', line: 'var(--ink-a22)', ink: 'var(--ink)', glyph: 'var(--paper)' },
};

// Ein Gesicht je Stufe (froh · neutral · traurig). Ohne Kreis gezeichnet, wenn es auf einer
// gefüllten Fläche oder in einem umrandeten Knopf sitzt — die Fläche IST dann das Gesicht.
export function gesichtSvg(art, farbe, groesse = 24, mitKreis = true) {
  const mund = art === 'froh'
    ? 'M8.4 14.2c.9 1.4 2.2 2.1 3.6 2.1s2.7-.7 3.6-2.1'
    : art === 'traurig'
      ? 'M8.4 16.5c.9-1.4 2.2-2.1 3.6-2.1s2.7.7 3.6 2.1'
      : 'M8.7 15.3h6.6';
  const kreis = mitKreis ? `<circle cx="12" cy="12" r="9.2" stroke="${farbe}" stroke-width="1.7"></circle>` : '';
  return `<svg width="${groesse}" height="${groesse}" viewBox="0 0 24 24" fill="none" style="flex:none;display:block">${kreis}<circle cx="9.2" cy="10" r="1.2" fill="${farbe}"></circle><circle cx="14.8" cy="10" r="1.2" fill="${farbe}"></circle><path d="${mund}" stroke="${farbe}" stroke-width="1.7" stroke-linecap="round"></path></svg>`;
}

// Darf dieses Meet bewertet werden — unabhängig davon, ob schon gefragt wird? (Runde 11, D10 a/b)
export function bewertungMoeglich(meet, jetzt = now()) {
  return meetBewertbar(meet, ME, toISODate(jetzt));
}

export function bewertungOffen(meet, jetzt = now()) {
  if (!bewertungMoeglich(meet, jetzt)) return false;
  const grenze = toISODate(new Date(jetzt.getFullYear(), jetzt.getMonth(), jetzt.getDate() - HINWEIS_TAGE));
  return !meet.hiddenFromHistory
    && !meet.review?.verdict
    && (meet.date || '') >= grenze
    && !weggeklickteHinweise().includes(meet.id);
}

// Das jüngste wartende Meet eines Kontexts — so findet der Raum „sein" gerade vorbeies Meet,
// ohne dass irgendwo eine zweite Regel entsteht.
export function bewertungsMeetIn(repo, context, jetzt = now()) {
  if (!repo?.getMeets) return null;
  let meets = [];
  try {
    meets = repo.getMeets({ context, direction: 'history' }) || [];
  } catch {
    meets = [];
  }
  const offen = meets.filter((meet) => bewertungOffen(meet, jetzt));
  offen.sort((a, b) => meetSortKey(b).localeCompare(meetSortKey(a)));
  return offen[0] || null;
}

// Die Frage selbst: eine leise Pille. Ein Tipp öffnet die Bewertungsseite (groß, drei Stufen). Sie
// sitzt in der Zeile des Meets, deshalb steht daneben immer, WORUM es ging (Titel, Tag, Ort).
export function bewertungsPille(meet, options = {}) {
  return `<button data-act="bew-mehr" data-role="bewertungs-pille" data-meet="${esc(meet.id)}" data-treffer aria-label="${esc(t('Wie war {titel}?', { titel: meetBewertungsTitel(meet) }))}" style="border:0;appearance:none;cursor:pointer;background:var(--orange-tint);color:var(--orange-dark);font:650 12px/1 ${FONT};padding:8px 12px;border-radius:999px;flex:none;${options.stil || ''}"><span style="pointer-events:none">${t("Wie war's?")}</span></button>`;
}

// Für den Chat-Raum: dort steht sonst keine Meet-Zeile. Dieselbe Frage, dieselbe Pille — mit
// Titel und „Tag · Ort" daneben (D10 c).
export function bewertungsZeile(ctx, meet, options = {}) {
  if (!bewertungOffen(meet)) return '';
  const wann = [meetDateLabel(meet.date), meet.time || ''].filter(Boolean).join(' · ');
  const ort = meet.placePending ? '' : (meet.place?.name || '');
  const meta = [wann, ort].filter(Boolean).join(' · ');
  return `<div data-role="bewertungs-zeile" data-variante="${esc(options.variante || 'karte')}" data-meet="${esc(meet.id)}" style="display:flex;align-items:center;gap:10px;flex:1 1 auto;width:100%;box-sizing:border-box;min-width:0;font-family:${FONT}">
<span style="display:flex;flex-direction:column;gap:2px;min-width:0;flex:1;pointer-events:none">
<span data-role="bewertungs-titel" style="font-size:15px;font-weight:650;letter-spacing:-.01em;white-space:nowrap;overflow:hidden;text-overflow:ellipsis">${esc(meetBewertungsTitel(meet))}</span>
<span data-role="bewertungs-meta" style="font-size:12px;color:var(--ink-soft);font-variant-numeric:tabular-nums;white-space:nowrap;overflow:hidden;text-overflow:ellipsis">${esc(meta)}</span>
</span>
${bewertungsPille(meet)}
</div>`;
}

export function bewertungsZeileAktionen(ctx) {
  return {
    // Ein Tipp auf die Pille öffnet die Bewertungsseite: drei große Stufen, dann freiwillige Angaben.
    'bew-mehr': (data) => {
      rueckmeldung('tipp');
      ctx.nav?.go('meet.review', { meetId: data.meet });
    },
  };
}

// --- Gemeinsames Binding für alle Bausteine ---

// v5 A18: Ein Wortlaut fuer alle drei Orte (Raum-Panel, Meet-Details, Meet-Browser).
export const PART_TOAST = { yes: t('Du bist dabei'), open: t('Zusage offen'), no: t('Du hast abgesagt') };

export function bindMeetPanels(root, ctx, meet) {
  const { repo, ui } = ctx;
  const notify = (message) => (ctx.toast ? ctx.toast(message) : undefined);

  // Eingaben der offenen Bereiche liegen in ui (bringDraft/pollDraft) — sie überstehen so
  // jedes Rerender. Ü4: Beim Zuklappen wird ein tatsächlich getippter Text nicht still
  // verworfen, sondern kurz nachgefragt; leer klappt direkt zu.
  const readDrafts = () => {
    const bring = root.querySelector('#bring-input');
    if (bring) ui.bringDraft = bring.value;
    const question = root.querySelector('#poll-q');
    if (question) {
      ui.pollDraft = {
        q: question.value,
        a: root.querySelector('#poll-o1')?.value || '',
        b: root.querySelector('#poll-o2')?.value || '',
      };
    }
  };
  const draftValue = () => {
    const poll = ui.pollDraft || {};
    return [ui.bringDraft || '', poll.q || '', poll.a || '', poll.b || ''].map((value) => value.trim());
  };
  const EMPTY_DRAFT = ['', '', '', ''];
  const clearDrafts = () => { ui.bringDraft = ''; ui.pollDraft = null; };
  const panelGuard = dirtyGuard(ctx, 'meet-panel-draft');

  ['#bring-input', '#poll-q', '#poll-o1', '#poll-o2'].forEach((selector) => {
    root.querySelector(selector)?.addEventListener('input', readDrafts);
  });

  // R5 (P4, gemessen): „Vorschlag übernehmen" oder „Mitnehmen" ganz unten auf der Seite macht den
  // Inhalt kürzer — der Browser klemmte die Scrollposition, alles rutschte 40–61 px nach unten. Der
  // Bereich behält deshalb seine größte Höhe als unsichtbaren Platz unter sich. Gesetzt wird das nach
  // dem Abgleich und vor dem zweiten restoreScroll (app.js), also bevor etwas gezeichnet wird.
  const bereich = [...root.querySelectorAll('[data-role="panel-bereich"]')].find((el) => el.dataset.meet === meet.id);
  if (bereich) {
    bereich.style.minHeight = '';
    const hoehe = bereich.getBoundingClientRect().height;
    const merker = ui.panelBereichHoehe?.meetId === meet.id ? ui.panelBereichHoehe : { meetId: meet.id, max: 0 };
    merker.max = Math.max(merker.max, hoehe);
    ui.panelBereichHoehe = merker;
    if (merker.max > hoehe + 0.5) bereich.style.minHeight = `${Math.ceil(merker.max)}px`;
  }

  const handlers = {
    // R4 E9: ⓘ am Foto zeigt/verbirgt den Bildnachweis.
    ...meetFotoAktionen(ctx),
    // Runde 8 (R8-27): der Knopf „Anreise planen" öffnet die Seite „Anreise".
    ...anreiseAktionen(ctx, meet),
    // v7 A20c: Der Tipp auf das markierte Feld öffnet den kompakten Abstimmzustand im
    // vorhandenen Sheet-Host — KEIN nav.go. Ein Routenwechsel würde in morphInto() den
    // Zweig mit host.innerHTML auslösen und den ganzen Screen neu aufbauen.
    'variant-pick': (data) => {
      ui.variantPick = {
        meetId: data.meet || meet.id,
        kind: data.kind === 'activity' ? 'activity' : 'time',
      };
      ctx.render();
    },
    'close-variant-pick': () => { ui.variantPick = null; ctx.render(); },
    // Abstimmen lässt das Sheet offen: repo.voteVariant meldet nur, der Abgleich läuft
    // in place — Sheet, Karte und Hintergrund bleiben stehen.
    'variant-vote': (data) => { rueckmeldung('auswahl'); repo.voteVariant(meet.id, data.variant); },
    // Zurück auf den Originalvorschlag: die eigene Variantenstimme wird abgewählt.
    // Screens mit eigener Fassung (Meet-Details) registrieren ihre zuerst und gewinnen.
    'vote-original': (data) => {
      const aktuell = repo.getMeet(meet.id) || meet;
      const meine = (aktuell.variants || []).find((variant) => variant.kind === data.kind && variant.votes.includes(ME));
      if (meine) repo.voteVariant(meet.id, meine.id);
    },
    'variant-add': (data) => {
      ui.variantPick = null;
      ctx.nav?.go(data.kind === 'activity' ? 'meet.proposeActivity' : 'meet.proposeTime', { meetId: data.meet || meet.id });
    },
    // v3.1 §7: die Auswahl setzt den eigenen Zustand direkt.
    // v5 A18: Jede Zustandsaenderung bestaetigt sich kurz und nicht blockierend.
    // Runde 8 (R8-24): Ein zweiter Tipp auf die eigene Wahl nimmt sie zurück — dann ist man wieder
    // unentschieden, und davon steht nirgends etwas.
    // Runde 11 Nachtrag (D3): Ein Tipp auf die NICHT gewählte Seite setzt sie; ein Tipp auf die AKTIVE
    // Wahl nimmt sie direkt zurück (wieder offen). Die Teilnehmenden-Liste öffnet sich davon nicht mehr —
    // dafür gibt es Halten oder den Tipp auf „Teilnehmende“ selbst.
    'set-part': (data) => {
      const jetzt = (repo.getMeet(meet.id) || meet).participation?.[ME];
      rueckmeldung('auswahl');
      repo.setParticipation(meet.id, jetzt === data.state ? 'open' : data.state);
      ctx.toast?.((jetzt === data.state ? PART_TOAST.open : PART_TOAST[data.state]) || t('Zusage geändert'));
    },
    'teil-toggle': () => { ui.teilOffen = !ui.teilOffen; ctx.render(); },
    'modul-plus': () => { ui.modulWahl = true; ctx.render(); },
    'modul-zu': () => { ui.modulWahl = false; ctx.render(); },
    'modul-waehlen': (data) => {
      ui.modulWahl = false;
      modulDazu(ui, meet.id, data.modul);
      if (data.modul === 'anreise') { ctx.nav?.go('meet.anreise', { meetId: meet.id }); return; }
      ui.panel = data.modul === 'polls' ? 'polls' : 'bring';
      ui.pollForm = data.modul === 'polls' && !(meet.polls || []).length;
      ctx.render();
    },
    // v5 A15: Wo es keinen eigenen Erstellungsweg gibt (Meet-Details), oeffnet die leere
    // Kachel denselben Bereich — er zeigt dann Aufforderung und Eingabe, nie nur Leere.
    'panel-empty': (data) => {
      ui.panel = data.panel;
      ui.pollForm = data.panel === 'polls';
      ctx.render();
    },
    'panel-toggle': (data) => {
      readDrafts();
      panelGuard.track(EMPTY_DRAFT);
      const close = () => {
        clearDrafts();
        ui.panel = ui.panel === data.panel ? null : data.panel;
        ui.pollForm = false;
        ctx.render();
      };
      if (!panelGuard.confirm(draftValue(), close)) return;
      close();
    },
    'toggle-bring': (data) => { rueckmeldung('auswahl'); repo.toggleBring(meet.id, data.item); },
    'add-bring': () => {
      readDrafts();
      const value = (ui.bringDraft || '').trim();
      if (!value) { notify(t('Erst einen Punkt eintragen')); return; }
      ui.bringDraft = '';
      panelGuard.clear();
      repo.addBringItem(meet.id, value);
    },
    'vote-poll': (data) => { rueckmeldung('auswahl'); repo.votePoll(meet.id, data.poll, data.option); },
    'toggle-add-poll': () => { readDrafts(); ui.pollForm = true; ctx.render(); },
    'add-poll': () => {
      readDrafts();
      const draft = ui.pollDraft || {};
      const question = (draft.q || '').trim();
      const optionA = (draft.a || '').trim();
      const optionB = (draft.b || '').trim();
      if (!question || !optionA || !optionB) { notify(t('Frage und zwei Optionen ausfüllen')); return; }
      ui.pollForm = false;
      ui.pollDraft = null;
      panelGuard.clear();
      repo.addPoll(meet.id, { question, options: [optionA, optionB] });
    },
  };
  bindActions(root, handlers);

  // Halten auf einer Zusage-Seite klappt die Liste nach Wahl auf — ohne die Wahl selbst zu ändern.
  // Die Knoten bleiben beim Abgleich meist stehen; deshalb wird jeder nur EINMAL gebunden und liest
  // den zuletzt gebundenen Zustand.
  root.querySelectorAll('[data-zusage]').forEach((knopf) => {
    knopf.__zusageCtx = ctx;
    if (knopf.__zusageGebunden) return;
    knopf.__zusageGebunden = true;
    let halt = null;
    const loslassen = () => {
      if (halt) window.clearTimeout(halt.timer);
      halt = null;
    };
    knopf.addEventListener('pointerdown', (event) => {
      loslassen();
      if (!event.isPrimary || (event.pointerType === 'mouse' && event.button !== 0)) return;
      halt = {
        x: event.clientX,
        y: event.clientY,
        timer: window.setTimeout(() => {
          halt = null;
          const aktuell = knopf.__zusageCtx;
          if (!aktuell || !knopf.isConnected) return;
          zusageKlickSperre = true;
          rueckmeldung('tipp');
          aktuell.ui.teilOffen = true;
          aktuell.render();
        }, ZUSAGE_HALTEN_MS),
      };
    });
    knopf.addEventListener('pointermove', (event) => {
      if (halt && Math.hypot(event.clientX - halt.x, event.clientY - halt.y) > ZUSAGE_TOLERANZ_PX) loslassen();
    });
    knopf.addEventListener('pointerup', loslassen);
    knopf.addEventListener('pointercancel', loslassen);
    knopf.addEventListener('pointerleave', loslassen);
    knopf.addEventListener('contextmenu', (event) => event.preventDefault());
  });
  return handlers;
}
