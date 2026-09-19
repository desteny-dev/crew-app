// Bereich Räume (reference/current 07.x, v14): Chat, Meet-Panel, Anstupsen,
// Crew-/Person-Details, Neue Crew. Screens: render(ctx) → { html, bind(root, ctx) }.
//
// Das schwebende Meet-Panel ist 1:1 aus dem Board „07 Panel-Zustände" transkribiert
// (kompakte Kacheln „Liste"/„Umfragen", aufgeklappt eine beige Box). Die Interaktionen
// laufen über das geteilte bindMeetPanels aus ui/meet-panels.js (dokumentierte API).
//
// v3.1-Runtime-Grammatik (docs/FRAMEWORK.md „v3.1"):
//   • Jeder Screen ist ein screenScaffold — GENAU EINE Scrollfläche je Screen.
//     Im Raum scrollen Panel und Chat zusammen; Composer, Anstupsen-Karte und
//     Catch-up liegen als echte Bottom-Ebene ABSOLUT darüber (bottomBar), der Chat
//     läuft sichtbar darunter durch und blendet dort weich aus (bottomFade).
//   • §3: höchstens EIN relevantes Panel — aktiv zuerst, sonst das nächste kommende.
//   • Runde 8 (R8-8, Jonathan): „Hast du Zeit?" ist weg — kein Knopf, kein Band, keine
//     Antworten, und auch die alten Anstupser stehen nicht mehr im Verlauf. Wer wissen will,
//     ob jemand Zeit hat, sieht es am FREE — und fragt im Chat mit eigenen Worten.
//   • §6: keine Ressourcen-Tags; Ressourcendaten kommen aus repo.projectProfile.
//   • §7: Liste und Umfrage öffnen einen kleinen Erstellungsflow mit Meet-Ziel.

// Runde 4 (P4): EINE Rückmeldung per Vibration/Haptik für die ganze App — keine verstreuten
// navigator.vibrate-Aufrufe mehr.
import { esc, bindActions, captureScroll, rueckmeldung } from '../core/html.js';
import { activityIconSvg, activityIconKey, activityIconPath, ressourcenIconKey } from '../ui/activity-icons.js';
import { ME, roomIdForCrew, roomIdForPerson } from '../data/ids.js';
import {
  screenScaffold, bottomFade, bottomBar, cardEdgeFade, personRow, personAvatar, sheet,
  personMarker, specialLabelChip, SPECIAL_SYMBOL_KEYS, SPECIAL_SYMBOLS, BEST_FRIEND_GOLD,
  stackSeparator,
  dirtyGuard, discardSheet, discardActions,
  MARKER_COLORS,
  stackMarker,
  ersterEmojiCluster, specialSymbolKey,
  bildVon, avatarFlaeche,
  besteFreundeMarkeAus,
  meetKachel,
} from '../ui/components.js';
// Die einstellbare Beste-Freunde-Markierung kommt aus derselben Quelle wie überall.
import { backArrow, plus, cross, search, groupIcon } from '../ui/icons.js';
import {
  participationGroups, participationSection, meetDateLabel, bindMeetPanels,
  bewertungsMeetIn, bewertungsZeile, bewertungsZeileAktionen, vorschlagTitel,
} from '../ui/meet-panels.js';
import { meetBrowserParts, bindMeetBrowserBody } from './meet-browser.js';
// v7 A06: Das kompakte Personen-Menue ist EINE Bauform fuer Freundesliste und
// Personenprofil. Es wird hier verwendet statt ein zweites Mal geschrieben.
// v7 A06: Die früheren raumeigenen Nachbauten (personMenu, switchConfirmSheet,
// markSheet) sind damit abgelöst und entfernt — es gibt nur noch DIESE eine Bauform.
// Runde 8 (R8-12): Auch das Gruppenmenü kommt von dort (crewMenu/crewMenuActs) — der frühere
// raumeigene Nachbau („Gruppe verlassen" allein, eigene Bestätigung) ist entfernt.
import { friendMenu, friendMenuActs, crewMenu, crewMenuActs, markSheetActs, bindMarkSheetInputs, markSwitchSheet, removeFriendSheet as gemeinsamesEntfernenSheet, markSheet as gemeinsamesMarkSheet, blockSheet, reportSheet, blockActs } from './profile.js';
// Runde 8c: Die Busy-Woche der Person steht auch in ihrem Raum-Profil — derselbe Baustein wie im Profil.
import { busyKarte } from './profile.js';
import { fromISODate, now, toISODate, terminText, jetztTermin, istJetzt } from '../core/dates.js';
import { belegtHinweis } from '../core/belegt.js';
import { t, tn, wort as wortAnzeige } from '../core/sprache.js';
import {
  mitbringWort, lustAuf, suchtMitfahrt, planErkennen, bietetMitfahrt, uhrzeitIn, tagIn, gleichesVorhaben,
  ortIn, klingtNachVorschlag,
} from '../core/chat-erkennung.js';
// Runde 3 (K5): echte Karten über die gemeinsame Kartenschicht (ui/map.js). MapLibre selbst
// lädt erst, wenn wirklich eine Karte gebraucht wird — map.js holt es bei der ersten Karte.
import {
  karteHalten, karteAnlegen, karteVon, ladeMapLibre, ortAnPunkt, oeffneRoute, startAnsicht, hatKoordinaten,
} from '../ui/map.js';
// Runde 4 (B3): Gruppenbilder mit demselben Baukasten wie das Profilbild (P1).
import { pbStart, pbSheet, pbActs, pbFotoBinden, pbErgebnis } from '../ui/profilbild-baukasten.js';
import { farbSchluessel } from '../ui/profilbild.js';
// Runde 5 (B4): Profilbilder anderer groß ansehen — ein Baustein für alle Stellen (ui/bild-gross.js).
import {
  bildGrossHtml, bildGrossBinden, bildGrossAktionen, bildGrossOeffnen, bildGrossZu, bildGrossInZeilen,
} from '../ui/bild-gross.js';
// Runde 5 (P4, E1): Mitfahren — Chat-Erkennung schreibt in die Fahrten des Meets.
// Runde 8 (R8-27): Im Raum-Panel steht dafür nur noch der eine Knopf „Anreise planen".
import {
  anreiseKnopf, mitfahrtAusChat, mitfahrtSchonErfasst, mitfahrMeldung,
} from '../ui/mitfahren.js';

// --- Bereichseigene SVGs (1:1 aus reference/current/source/07-Raum.dc.html) ---


const listCheckSvg = `<svg width="14" height="14" viewBox="0 0 24 24" fill="none" style="flex:none"><circle cx="12" cy="12" r="9" stroke="var(--ink)" stroke-width="1.8"></circle><path d="m8.5 12 2.4 2.4 4.6-4.8" stroke="var(--ink)" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"></path></svg>`;
const pollBarsSvg = (color = 'var(--ink)', size = 14) => `<svg width="${size}" height="${size}" viewBox="0 0 24 24" fill="none" style="flex:none"><path d="M5 20V10M12 20V4M19 20v-7" stroke="${color}" stroke-width="1.8" stroke-linecap="round"></path></svg>`;
const tileChevron = (up, dark) => `<svg width="12" height="12" viewBox="0 0 24 24" fill="none" style="flex:none"><path d="${up ? 'm6 14.5 6-6 6 6' : 'm6 9.5 6 6 6-6'}" stroke="${dark ? 'var(--ink)' : 'var(--muted-light)'}" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round"></path></svg>`;
const panelChevronRight = `<svg width="15" height="15" viewBox="0 0 24 24" fill="none" style="flex:none"><path d="M9.5 5.5 16 12l-6.5 6.5" stroke="var(--muted-light)" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"></path></svg>`;
const rowChevron = `<svg width="12" height="12" viewBox="0 0 24 24" fill="none" style="flex:none"><path d="M9.5 5.5 16 12l-6.5 6.5" stroke="var(--line-solid)" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round"></path></svg>`;
const menuMeetSvg = `<svg width="17" height="17" viewBox="0 0 24 24" fill="none"><rect x="3.8" y="5.2" width="16.4" height="15" rx="3" stroke="var(--ink)" stroke-width="1.8"></rect><path d="M3.8 9.8h16.4M8.4 3v3.4M15.6 3v3.4M12 12.6v4M10 14.6h4" stroke="var(--ink)" stroke-width="1.8" stroke-linecap="round"></path></svg>`;
const menuListSvg = `<svg width="17" height="17" viewBox="0 0 24 24" fill="none"><path d="M9 6h11M9 12h11M9 18h11" stroke="var(--ink)" stroke-width="1.8" stroke-linecap="round"></path><path d="m3.5 5.5 1 1 2-2" stroke="var(--ink)" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"></path><circle cx="4.5" cy="12" r="1.3" fill="var(--ink)"></circle><circle cx="4.5" cy="18" r="1.3" fill="var(--ink)"></circle></svg>`;
// Runde 5 (B4): Der Stift an der Gruppen-Scheibe ist ein eigener 44-px-Knopf (Bearbeiten); die Scheibe
// selbst zeigt das Gruppenbild groß. Optik und Lage des Stifts bleiben wie vorher.
const pencilBadge = `<span style="width:28px;height:28px;border-radius:50%;background:var(--surface);border:1px solid var(--ink-a10);box-shadow:0 2px 6px var(--shadow-14);display:flex;align-items:center;justify-content:center;pointer-events:none;flex:none"><svg width="12" height="12" viewBox="0 0 24 24" fill="none"><path d="M4 20h4L20 8l-4-4L4 16v4Z" stroke="var(--ink)" stroke-width="1.8" stroke-linejoin="round"></path></svg></span>`;
const searchCircleSvg = `<svg width="15" height="15" viewBox="0 0 24 24" fill="none"><circle cx="11" cy="11" r="6.5" stroke="var(--ink-soft)" stroke-width="1.8"></circle><path d="m15.8 15.8 4.2 4.2" stroke="var(--ink-soft)" stroke-width="1.8" stroke-linecap="round"></path></svg>`;
const sendSvg = `<svg width="15" height="15" viewBox="0 0 24 24" fill="none"><path d="M12 19V5M6 11l6-6 6 6" stroke="var(--on-accent)" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"></path></svg>`;
// Ü3: Bester Freund trägt einen schmalen warm-goldenen Ring um den Avatar — KEIN Stern.
// Menü- und Sheet-Zeilen zeigen deshalb genau dieses Zeichen (gesetzt = gold, sonst grau).
// Runde 4 (B4): Die Farbe ist die eingestellte Markierung ALLER besten Freunde (Standard Gold).
const goldRingGlyph = (on, size = 16, settings = null) => `<span style="width:${size}px;height:${size}px;border-radius:50%;border:${on ? 2.6 : 1.8}px solid ${on ? besteFreundeMarkeAus(settings).color : 'var(--muted-light)'};box-sizing:border-box;flex:none;display:block"></span>`;
const crossSmallSvg = `<svg width="14" height="14" viewBox="0 0 24 24" fill="none" style="flex:none"><path d="M7 7l10 10M17 7 7 17" stroke="var(--muted)" stroke-width="2.2" stroke-linecap="round"></path></svg>`;
const personCapSvg = `<svg width="12" height="12" viewBox="0 0 24 24" fill="none" style="flex:none"><circle cx="12" cy="8" r="3.4" stroke="var(--muted-light)" stroke-width="1.8"></circle><path d="M5.5 19.5c0-3.3 2.9-5.2 6.5-5.2s6.5 1.9 6.5 5.2" stroke="var(--muted-light)" stroke-width="1.8" stroke-linecap="round"></path></svg>`;

// Auftrag R1 §6.2: HIER lag die dritte Symboltabelle. Sie kannte sieben Muster und
// zeichnete alles andere als Kiste — „PC", „Bohrmaschine", „Kanu", „Kühlbox" sahen im
// Raum identisch aus. Und drei ihrer Zeichen (grill, beamer, film) überdeckten den
// Katalog, sodass dasselbe Interesse im Profil anders aussah als hier. Beide Tabellen
// sind entfallen; gezeichnet wird nur noch aus ui/symbole.js.
function detailIcon(key, color = 'var(--muted)', size = 15) {
  return `<svg width="${size}" height="${size}" viewBox="0 0 24 24" fill="none" style="flex:none">${activityIconPath(key, color, 1.7)}</svg>`;
}

// R1 §6.2: Das Zeichen einer fremden Ressource. Hat die Besitzerin selbst eines gewählt,
// gilt ihres — sonst greift dieselbe Stichwortliste wie im eigenen Profil.
function ressourcenZeichen(entry) {
  const gewaehlt = (entry.owners || []).map((owner) => owner.meta?.icon).find(Boolean);
  return detailIcon(ressourcenIconKey(entry.label, gewaehlt));
}

// Fable 4 (J14): Interessen lesen denselben Katalog wie Meets und Profil (ui/activity-icons.js).
// Vorher hatte der Raum eine dritte Stichwortliste — „Wandern" war hier ein Berg, im Profil ein Stiefel.
function interestIconKey(label) {
  return activityIconKey({ title: label });
}


// v4 P0-3-8: KEINE eigene Symboltabelle mehr. Vorher stand hier eine dritte Kopie, die
// bei „herzlos" ein Herz zeichnete, während die tatsächliche Markierung ein abgerundetes
// Quadrat war — der Nutzer wählte also etwas anderes, als er danach sah. Jetzt kommt
// jedes Zeichen aus SPECIAL_SYMBOLS (ui/components.js) und wird nur skaliert.
function markSymbolGlyph(key, color, size = 13) {
  // v6: SPECIAL_SYMBOLS traegt nur noch die vier gueltigen Zeichen. specialSymbolKey
  // hebt Altwerte (z. B. 'raute') auf ein gueltiges Zeichen — ohne das war der Aufruf
  // undefined und riss das ganze Personen-Menue mit.
  const symbol = SPECIAL_SYMBOLS[specialSymbolKey(key)](color);
  const scale = (size / 11).toFixed(2);
  return `<span style="width:${size}px;height:${size}px;display:flex;align-items:center;justify-content:center;flex:none"><span style="display:flex;align-items:center;justify-content:center;transform:scale(${scale})">${symbol}</span></span>`;
}

// Ü3: kuratierte, dezente Akzentfarben der Besonderen Person — bewusst OHNE Grün, Blau,
// Orange und Rot, weil diese vier in der App feste Bedeutungen tragen (frei/aktiv, Loop,
// Benachrichtigung, Absage). Reihenfolge und Namen wie im Profil-Markieren-Sheet.
// v3.2 D3: dieselbe Palette wie im Profil — zentral aus ui/components.js.
const MARK_COLORS = MARKER_COLORS;

const CREW_COLORS = ['#A08FC9', 'var(--blue)', '#C97F93', '#8FAF8A', '#C9AE6B', '#C98A5B'];

// Ü3: EINE kuratierte Symbolauswahl für die Besondere Person — genau SPECIAL_SYMBOL_KEYS
// aus ui/components.js, dieselbe Reihenfolge wie im Profil. Keine freie Emoji-Tastatur.
const MARK_SYMBOLS = SPECIAL_SYMBOL_KEYS;

// --- kleine Helfer ---

// v4 P0-3-9 / P0-3-10: Der Trenner zwischen gestapelten Avataren ist ein Ring HINTER dem
// Avatar (stackSeparator = box-shadow in der Farbe des Untergrunds), kein weißer Rahmen
// AUF ihm — sonst wird er auf getöntem Grund selbst zur scheinbaren Markierung.
// Mit options.settings trägt der Stapel dieselben Markierungen wie jede Personenzeile:
// goldener Ring (Bester Freund) und Symbol unten links (Besondere Person).
function avatarStack(people, options = {}) {
  const size = options.size || 22;
  const font = options.font || 8.5;
  const overlap = options.overlap ?? (size >= 26 ? 7 : size >= 20 ? 6 : 5);
  const border = options.border || 'var(--surface)';
  const max = options.max ?? 3;
  const settings = options.settings || null;
  const shown = people.slice(0, max);
  const extra = options.more === false ? 0 : people.length - shown.length;

  // v6 A02b: KEINE eigene Ringgeometrie mehr. Die lokale Kopie zeichnete inset:-2.5px bei
  // 1,6px Rahmen — daraus wurde ein 1,5px breiter heller Streifen zwischen Bild und Ring.
  // Es gibt jetzt genau EINE Quelle für Ring und Zeichen: stackMarker aus ui/components.js.
  // Fable 4 (J2/J3): Jede Scheibe ist personAvatar — Frei-Punkt, Aktiv-Fade und das Zeichen
  // (Stern/Symbol unten links) kommen aus derselben Regel wie in jeder Personenzeile.
  // Runde 8 (R8-25): options.kennung — jede Scheibe sagt, wen sie zeigt (data-stapel-person), die
  // Sammelscheibe „+n" trägt data-stapel-rest. Daran findet die Gruppenseite die Bilder, die beim
  // Auf- und Zuklappen der Mitglieder zwischen Stapel und Liste wandern.
  const cell = (inner, attrs = '') => `<span${attrs} style="position:relative;flex:none;width:${size}px;height:${size}px;margin-left:-${overlap}px;isolation:isolate">${inner}</span>`;
  const disc = (bg, color, text) => `<span style="display:block;width:${size}px;height:${size}px;border-radius:50%;background:${bg};color:${color};font:600 ${font}px/${size}px 'Instrument Sans',sans-serif;text-align:center;${stackSeparator(border)}">${esc(text)}</span>`;
  const gesicht = (person) => `<span style="display:block;width:${size}px;height:${size}px;border-radius:50%;${stackSeparator(border)}">${personAvatar(person, { size, fontSize: font, compact: true, dotBorder: border, marker: settings ? personMarker(person.id, settings) : null })}</span>`;

  const faces = shown.map((person) => cell(gesicht(person), options.kennung ? ` data-stapel-person="${esc(person.id)}"` : '')).join('');
  const rest = extra > 0 ? cell(disc('var(--field)', 'var(--muted)', `+${extra}`), options.kennung ? ' data-stapel-rest="1"' : '') : '';
  return `<div style="display:flex;padding-left:${overlap}px;pointer-events:none">${faces}${rest}</div>`;
}

function shade(hex, factor) {
  if (!/^#[0-9a-f]{6}$/i.test(hex)) return hex; // Fable: Token-Fallback (var(--…)) unverändert lassen
  const n = parseInt(hex.slice(1), 16);
  const channel = (value) => Math.max(0, Math.min(255, Math.round(value * (1 + factor))));
  const r = channel((n >> 16) & 255);
  const g = channel((n >> 8) & 255);
  const b = channel(n & 255);
  return `#${((r << 16) | (g << 8) | b).toString(16).padStart(6, '0')}`;
}

function crewInitials(name) {
  const words = String(name || '').split(/[^\p{L}\d]+/u).filter(Boolean);
  return `${words[0]?.[0] || ''}${words[1]?.[0] || words[0]?.[1] || ''}`.toUpperCase();
}

// @Name im Chat ruhig hervorheben (reference 07.8) — nach dem Escapen.
function chatText(text) {
  return esc(text).replace(/(^|\s)@([\wÄÖÜäöüß-]+)/g,
    (_, lead, word) => `${lead}<b style="background:var(--field);border-radius:7px;padding:1.5px 6px;font-weight:650;color:var(--ink)">@${word}</b>`);
}

// v7 spec/08 §4: Anstupsen und Standort sind STRUKTURIERTE Raum-Datensätze — kein in die
// Nachrichtenliste eingefügter String und keine erfundene Chatnachricht im fremden Namen.
// Der Datenzugang kennt bisher nur sendMessage (Text); appendMessage ist sein eigener,
// nachrichtenartenneutraler Schreibweg und bekommt hier genau den Datensatz, den chatBody
// wieder liest. Fehlt dieser Weg, wird nichts vorgetäuscht: die Funktion meldet false.
function raumEreignisSchreiben(repo, roomId, eintrag) {
  // v7: Seit dem Vertrag addRoomEvent kennt, laeuft das Schreiben ueber den Vertrag
  // statt am Gateway vorbei. Id, Datum und Uhrzeit vergibt die Datenschicht.
  if (typeof repo.addRoomEvent !== 'function') return false;
  return Boolean(repo.addRoomEvent(roomId, eintrag));
}

function resolveRoom(ctx, roomId) {
  const room = ctx.repo.getRoom(roomId);
  if (room.kind === 'crew') {
    const crew = ctx.repo.getCrew(room.refId);
    return crew ? { room, kind: 'crew', crew, context: { crewId: crew.id }, title: crew.name } : null;
  }
  // v6 A13: Dritte Raumart — der gemeinsame temporäre Meet-Raum. Sein Kontext ist das
  // Meet selbst; dadurch lesen Karte, Teilnahme, Varianten, Liste und Umfragen genau
  // dieselben Daten wie die Meet-Details, statt sie über eine zufällige Person zu suchen.
  if (room.kind === 'meet') {
    const meet = ctx.repo.getMeet(room.refId);
    return meet ? { room, kind: 'meet', meet, context: { meetId: meet.id }, title: meet.title } : null;
  }
  const person = ctx.repo.getPerson(room.refId);
  return person ? { room, kind: 'person', person, context: { personId: person.id }, title: person.name } : null;
}

// Teilnehmende eines temporären Meet-Raums: ich zuerst nicht — im Kopf stehen die anderen.
function meetRoomOthers(ctx, meet) {
  return [...new Set([meet.creatorId, ...(meet.personIds || []), ...Object.keys(meet.participation || {})])]
    .filter((id) => id && id !== ME)
    .map((id) => ctx.repo.getPerson(id))
    .filter(Boolean);
}

function sharedCrews(ctx, personId) {
  return ctx.repo.getCrews().filter((crew) => crew.memberIds.includes(personId) && crew.memberIds.includes(ME));
}

// v3.1 §3: In einem Raum steht HÖCHSTENS EIN relevantes Panel — aktives Meet zuerst,
// sonst das nächste kommende, sonst kein Panel. Vergangene Meets bleiben im Verlauf
// (getMeets 'upcoming' liefert sie gar nicht), nie als ewige Chat-Karte.
// Im 1:1-Raum zählen nur direkte 1:1-Meets sowie aktive gemeinsame Meets — geplante
// Crew-Meets bleiben im Crew-Raum (reference 07.10: Raum ohne Panel trotz Crew-Planung).
function panelMeetFor(ctx, info) {
  const relevant = roomMeetOptions(ctx, info);
  return relevant.find((meet) => meet.status === 'active') || relevant[0] || null;
}

// Eindeutige Chat-Sätze („Ich bring … mit", „I'll bring …", „J'apporte …", „Yo llevo …")
// → Listen-Übernahme mit Rückgängig (07.3). Die Muster liegen in core/chat-erkennung.js.
function bringAdoptionLabel(text) {
  return mitbringWort(text);
}

function derivedBringEntries(ctx, info, meet) {
  if (!meet) return [];
  const undone = ctx.ui.undoneAdoptions || {};
  const entries = [];
  for (const message of info.room.messages) {
    if (message.kind !== 'text' || undone[message.id] || loeschenVorgemerkt(info.room.id, message.id)) continue;
    const label = bringAdoptionLabel(message.text);
    if (!label) continue;
    const exists = (meet.bring || []).some((item) => item.label.toLowerCase() === label.toLowerCase());
    if (exists) continue;
    entries.push({ id: `adopt:${message.id}`, label, takenBy: [message.authorId], derived: true, messageId: message.id });
  }
  return entries;
}

// =====================================================================================
// Mitdenken im Chat (Runde 3, K3)
//
// Jonathan: „Ich schreibe ‚morgen Skifahren', ‚wer will bei mir mitfahren', ‚kann ich irgendwo
// mitfahren' oder eine Uhrzeit — nirgends ein Vorschlag." Crew liest jetzt mit und bietet
// unter der Nachricht EINE kleine Handlung an (die Erkennung liegt in core/chat-erkennung.js):
//   Plan (Aktivität + Zeit)    → „Als Meet vorschlagen" — öffnet den Composer vorbelegt
//   Mitfahrt angeboten/gesucht → „Mitfahrt ins Meet übernehmen", „Bei Mira mitfahren",
//                                „Ayla mitnehmen" — ein Punkt auf der Liste des Meets
//   Uhrzeit, Tag oder Ort      → Runde 8 (R8-26): „16:00 ins Meet", „Sa 26.9. ins Meet",
//   (Meet noch nicht im Gang)    „Strandbad Lochau ins Meet" — EIN Tipp, und es steht am Meet
//                                (insMeetVorschlag / insMeetUebernehmen)
// Damit es ruhig bleibt:
//   • nur die letzten sechs Textnachrichten und nur solche der letzten 36 Stunden,
//   • je Art nur die jüngste Nachricht, höchstens zwei Vorschläge im ganzen Raum,
//   • nichts, was es schon gibt (gleiches Meet, gleicher Listenpunkt, gleiche Zeit),
//   • jeder Vorschlag lässt sich wegtippen (✕) und kommt danach nicht wieder,
//   • gespeichert wird nur, was jemand antippt — und auch das erst nach sechs Sekunden, in
//     denen „Rückgängig" ehrlich alles zurücknimmt (es gibt dann nichts zu löschen).
// =====================================================================================

const HINWEIS_FENSTER = 6;
const HINWEIS_HOECHSTENS = 2;
const HINWEIS_ALTER_MS = 36 * 60 * 60 * 1000;
const RUECKGAENGIG_MS = 6000;
const WEG_MERKER = 'crew.raum.hinweise.weg';
// Ohne Gerätespeicher (manches private Fenster) gilt das Wegtippen wenigstens bis zum Neuladen.
const wegImSpeicher = new Set();

function weggelegteHinweise() {
  const menge = new Set(wegImSpeicher);
  try { JSON.parse(globalThis.localStorage?.getItem(WEG_MERKER) || '[]').forEach((eintrag) => menge.add(eintrag)); } catch { /* egal */ }
  return menge;
}

function hinweisWeglegen(schluessel) {
  wegImSpeicher.add(schluessel);
  try {
    const liste = [...weggelegteHinweise()].slice(-300);
    globalThis.localStorage?.setItem(WEG_MERKER, JSON.stringify(liste));
  } catch { /* egal */ }
}

const hinweisSchluessel = (roomId, messageId, art) => `${roomId}|${messageId}|${art}`;
// Runde 4 (E8): Eine eigene Nachricht, deren Löschen gerade vorgemerkt ist (Rückgängig-Frist).
// Sie trägt in dieser Zeit keinen Vorschlag und keine Listen-Übernahme mehr.
const loeschenVorgemerkt = (roomId, messageId) => vorgemerkteHinweise.has(hinweisSchluessel(roomId, messageId, 'loeschen'));

// Vorgemerkt: angetippt, die Rückgängig-Frist läuft noch. Übernommen: in dieser Sitzung
// ausgeführt — die Quittung bleibt unter der Nachricht stehen.
const vorgemerkteHinweise = new Map();
const uebernommeneHinweise = new Set();

function vorgemerkteAusfuehren() {
  for (const [schluessel, eintrag] of [...vorgemerkteHinweise]) {
    window.clearTimeout(eintrag.timer);
    vorgemerkteHinweise.delete(schluessel);
    if (eintrag.ausfuehren() !== false) uebernommeneHinweise.add(schluessel);
  }
}
// Wer die App in der Frist verlässt, hat trotzdem bewusst getippt — dann gilt es sofort.
globalThis.document?.addEventListener?.('visibilitychange', () => {
  if (document.visibilityState === 'hidden') vorgemerkteAusfuehren();
});

// Welche Nachricht trägt welchen Vorschlag? → Map(messageId → Hinweis)
function raumHinweise(ctx, info, panelMeet) {
  const { repo } = ctx;
  const hinweise = new Map();
  const texte = info.room.messages.filter((message) => message.kind === 'text' && !loeschenVorgemerkt(info.room.id, message.id));
  if (!texte.length) return hinweise;
  const weg = weggelegteHinweise();
  const jetzt = now();
  const zielPanel = panelMeet && panelMeet.status !== 'done' ? panelMeet : null;
  // Runde 4 (E7, gemessen): Im 1:1-Chat gab es für „ich fahr mit dem auto, wer will mit" nie ein
  // Ziel — ein Meet mit einer Gruppe steht dort nicht als Panel, sondern als Zeile zum
  // gemeinsamen Raum. Eine Mitfahrt gehört dann zu genau diesem Meet (sichtbar oben im Chat),
  // und der Knopf nennt es. Zeitvorschläge bleiben beim Panel: Eine Uhrzeit unter vier Augen
  // ist noch kein Vorschlag an die ganze Gruppe.
  const geteilt = zielPanel ? null : sharedMeetRoom(ctx, info)?.meet || null;
  const zielMitfahrt = zielPanel || (geteilt && geteilt.status !== 'done' ? geteilt : null);
  const kommende = repo.getMeets({ context: info.context, direction: 'upcoming' });
  const ich = repo.getMe();
  const vergeben = new Set();
  const orte = bekannteOrte(repo);

  for (const message of texte.slice(-HINWEIS_FENSTER).reverse()) {
    if (hinweise.size >= HINWEIS_HOECHSTENS) break;
    if (jetzt.getTime() - messageDateValue(message).getTime() > HINWEIS_ALTER_MS) continue;
    if (bringAdoptionLabel(message.text)) continue; // trägt schon die Listen-Übernahme
    const eigen = message.authorId === ME;
    const name = (eigen ? ich : repo.getPerson(message.authorId))?.name || t('Jemand');
    const kandidaten = [];

    const plan = planErkennen(message.text, jetzt);
    if (plan) {
      // Runde 4 (E7): Gab es das Vorhaben schon als Meet, stand bisher einfach NICHTS da — wer
      // „morgen skifahren" schreibt und schon ein Skifahren-Meet hat, hielt Crew für taub. Am
      // selben Tag (oder ohne Tag) zeigt Crew jetzt das vorhandene Meet; an einem anderen Tag
      // ist es ein neues Vorhaben. Steht das Meet ohnehin als Panel im Raum, bleibt es still.
      const gleiches = plan.aktivitaet
        ? kommende.find((meet) => gleichesVorhaben(plan.aktivitaet, meet.title) && (!plan.datum || meet.date === plan.datum))
        : null;
      if (gleiches) {
        if (gleiches.id !== panelMeet?.id) kandidaten.push({ art: 'meet', meetZiel: gleiches.id, knopf: t('{titel} ansehen', { titel: gleiches.title }) });
      } else if (plan.aktivitaet || !panelMeet || (plan.datum && plan.datum !== panelMeet.date)) {
        // Ohne Aktivität („wer hat heute Abend Zeit") nur, wo nicht schon ein Meet am selben Tag steht.
        kandidaten.push({ art: 'plan', plan, knopf: t('Als Meet vorschlagen') });
      }
    }
    if (zielMitfahrt) {
      const angebot = bietetMitfahrt(message.text);
      const zu = zielMitfahrt === zielPanel ? '' : zielMitfahrt.title;
      const mitZiel = (knopf) => (zu ? `${knopf} · ${zu}` : knopf);
      // Runde 5 (P4, E1): Die Mitfahrt geht in die Fahrten des Meets (ui/mitfahren.js mitfahrtAusChat),
      // nicht mehr als Punkt auf die Mitbringen-Liste. Der Vorschlag kennt dafür Art, Autor und Plätze.
      const fahrt = { autorId: message.authorId };
      // Runde 6 (Chef, gemessen): „Bei Mira mitfahren" stand auch dann da, wenn Mira dieses Meet
      // ABGESAGT hat. Ein Tipp tat dann scheinbar nichts — die Fahrten-Ansicht lässt niemanden in
      // das Auto einer Person steigen, die gar nicht mitkommt (ui/mitfahren.js, `dabei`), und man
      // landete stattdessen still bei „sucht noch". Wer abgesagt hat, fährt hier weder mit noch
      // nimmt er jemanden mit — dann gibt es zu dieser Nachricht gar keinen Fahrt-Hinweis.
      const autorKommt = (zielMitfahrt.participation || {})[message.authorId] !== 'no';
      if (!autorKommt) {
        // nichts anbieten
      } else if (angebot) {
        kandidaten.push({ art: 'mitfahrt', ziel: zielMitfahrt, ...fahrt, fahrt: 'angebot', plaetze: angebot.plaetze || null, knopf: mitZiel(eigen ? t('Mitfahrt ins Meet übernehmen') : t('Bei {name} mitfahren', { name })) });
      } else if (suchtMitfahrt(message.text)) {
        kandidaten.push({ art: 'mitfahrt', ziel: zielMitfahrt, ...fahrt, fahrt: 'suche', plaetze: null, knopf: mitZiel(eigen ? t('Mitfahrt ins Meet übernehmen') : t('{name} mitnehmen', { name })) });
      }
    }
    // Runde 8 (R8-26): Uhrzeit, Tag oder Ort → mit EINEM Tipp ins Meet. Ein laufendes Meet hat
    // seine Zeit und seinen Ort — „bin um 19:10 da" ist dann eine Ankunft, kein Vorschlag.
    if (zielPanel && zielPanel.status !== 'active') {
      const vorschlag = insMeetVorschlag(zielPanel, message.text, jetzt, plan, orte);
      if (vorschlag) kandidaten.push({ ...vorschlag, ziel: zielPanel });
    }

    for (const kandidat of kandidaten) {
      if (vergeben.has(kandidat.art)) continue;
      vergeben.add(kandidat.art);
      const schluessel = hinweisSchluessel(info.room.id, message.id, kandidat.art);
      if (weg.has(schluessel)) continue;
      const ziel = kandidat.ziel;
      let zustand = 'offen';
      if (vorgemerkteHinweise.has(schluessel)) zustand = 'wartet';
      else if (uebernommeneHinweise.has(schluessel)) zustand = 'fertig';
      else if (kandidat.art === 'mitfahrt' && mitfahrtSchonErfasst(repo, ziel.id, { art: kandidat.fahrt, autorId: kandidat.autorId })) continue;
      // Runde 8 (R8-26): Was schon am Meet steht, wird nicht noch einmal angeboten.
      else if (kandidat.art === 'ins-meet' && kandidat.schonErfasst) continue;
      const { ziel: _ziel, ...ohneZiel } = kandidat;
      hinweise.set(message.id, { ...ohneZiel, zustand, schluessel, meetId: ziel?.id || null });
      break; // eine Handlung je Nachricht
    }
  }
  return hinweise;
}

const HINWEIS_ZEICHEN = {
  plan: '<svg width="14" height="14" viewBox="0 0 24 24" fill="none"><rect x="3.8" y="5.2" width="16.4" height="15" rx="3" stroke="var(--green-dark)" stroke-width="1.9"></rect><path d="M3.8 9.8h16.4M8.4 3v3.4M15.6 3v3.4M12 12.6v4M10 14.6h4" stroke="var(--green-dark)" stroke-width="1.9" stroke-linecap="round"></path></svg>',
  mitfahrt: '<svg width="14" height="14" viewBox="0 0 24 24" fill="none"><path d="M4.5 15.5v-3.3l1.9-4.5a1.9 1.9 0 0 1 1.7-1.2h7.8a1.9 1.9 0 0 1 1.7 1.2l1.9 4.5v3.3M3.6 15.5h16.8M5 12.2h14" stroke="var(--green-dark)" stroke-width="1.9" stroke-linecap="round" stroke-linejoin="round"></path><circle cx="7.7" cy="17.4" r="1.9" fill="var(--green-dark)"></circle><circle cx="16.3" cy="17.4" r="1.9" fill="var(--green-dark)"></circle></svg>',
  zeit: '<svg width="14" height="14" viewBox="0 0 24 24" fill="none"><circle cx="12" cy="12" r="8.6" stroke="var(--green-dark)" stroke-width="1.9"></circle><path d="M12 7.2V12l3.2 2" stroke="var(--green-dark)" stroke-width="1.9" stroke-linecap="round" stroke-linejoin="round"></path></svg>',
  // Runde 4 (E7): das Vorhaben gibt es schon als Meet — Kalenderblatt mit Pfeil hinein.
  meet: '<svg width="14" height="14" viewBox="0 0 24 24" fill="none"><rect x="3.8" y="5.2" width="16.4" height="15" rx="3" stroke="var(--green-dark)" stroke-width="1.9"></rect><path d="M3.8 9.8h16.4M8.4 3v3.4M15.6 3v3.4" stroke="var(--green-dark)" stroke-width="1.9" stroke-linecap="round"></path><path d="M9.6 15h5M12.6 12.8l2.2 2.2-2.2 2.2" stroke="var(--green-dark)" stroke-width="1.9" stroke-linecap="round" stroke-linejoin="round"></path></svg>',
  // Runde 8 (R8-26): ein Tag bzw. ein Ort, der mit einem Tipp ins Meet geht.
  tag: '<svg width="14" height="14" viewBox="0 0 24 24" fill="none"><rect x="3.8" y="5.2" width="16.4" height="15" rx="3" stroke="var(--green-dark)" stroke-width="1.9"></rect><path d="M3.8 9.8h16.4M8.4 3v3.4M15.6 3v3.4" stroke="var(--green-dark)" stroke-width="1.9" stroke-linecap="round"></path><circle cx="12" cy="14.8" r="1.8" fill="var(--green-dark)"></circle></svg>',
  ort: '<svg width="14" height="14" viewBox="0 0 24 24" fill="none"><path d="M12 21.5s7-6.1 7-11a7 7 0 1 0-14 0c0 4.9 7 11 7 11Z" stroke="var(--green-dark)" stroke-width="1.9" stroke-linejoin="round"></path><circle cx="12" cy="10.5" r="2.4" stroke="var(--green-dark)" stroke-width="1.9"></circle></svg>',
};

// --- Runde 8 (R8-26): Uhrzeit, Tag oder Ort mit EINEM Tipp ins Meet -----------------------------
//
// Jonathan: „Chat-Erkennung: ‚wie wäre 16 Uhr' o. ä. → Vorschlag mit einem Tipp ins Meet übernehmen."
// Erkannt wird mit dem, was core/chat-erkennung.js schon kann (uhrzeitIn, tagIn) — dazu ortIn für
// Orte, die die App kennt. Unter der Nachricht steht dann EIN Knopf: „16:00 ins Meet",
// „Sa 26.9. ins Meet", „Strandbad Lochau ins Meet". Ein Tipp (mit derselben Frist zum Rückgängig-
// machen wie jeder Vorschlag hier) legt es ans Meet:
//   · Uhrzeit/Tag → ein Zeitvorschlag (Uhrzeit bleibt beim bloßen Tag die des Meets).
//   · Ort         → ein Vorschlag „<Titel des Meets> an diesem Ort" — Meets kennen Orts-Vorschläge
//                   nur als Aktivitätsvorschlag mit Ort (Datenvertrag); die Karte der Vorschläge
//                   schreibt ihn deshalb „Kochabend · Strandbad Lochau" (meet-panels vorschlagTitel).
//   · Hat das Meet an dieser Stelle noch NICHTS (Zeit offen bzw. Ort offen), gibt es keine anderen
//     Vorschläge dafür und bin ich es, die es angelegt hat, dann steht es sofort fest — denn dann
//     gibt es nichts, wogegen abzustimmen wäre. Sonst ist es ein Vorschlag, über den alle abstimmen.
// Ein Tag allein zählt nur, wenn der Satz nach Vorschlag klingt (klingtNachVorschlag) — „ich war heute
// beim Arzt" schlägt keinen Tag vor. Ein Satz mit Uhrzeit UND Ort geht als Zeit ins Meet: ein Tipp,
// eine Aussage (das Meet nimmt kurz nacheinander keinen zweiten neuen Vorschlag an).
function bekannteOrte(repo) {
  try {
    const liste = typeof repo.searchPlaces === 'function' ? repo.searchPlaces('') : [];
    return (Array.isArray(liste) ? liste : []).filter((ort) => ort?.name && hatKoordinaten(ort));
  } catch {
    return [];
  }
}

function zeitSchonAmMeet(meet, datum, zeit, jetzt) {
  const varianten = (meet.variants || []).filter((variant) => variant.kind === 'time');
  if (jetzt) return istJetzt(meet) || varianten.some((variant) => istJetzt(variant));
  if (!zeit) return meet.date === datum || varianten.some((variant) => (variant.date || meet.date) === datum);
  return (meet.time === zeit && meet.date === datum)
    || varianten.some((variant) => variant.time === zeit && (variant.date || meet.date) === datum);
}

function ortSchonAmMeet(meet, ort) {
  if ((meet.place?.name || '') === ort.name) return true;
  return (meet.variants || []).some((variant) => variant.kind === 'activity' && variant.place?.name === ort.name);
}

// Ein Ortsvorschlag ist ein Aktivitätsvorschlag mit dem Titel des Meets. Der Datenvertrag führt
// Aktivitätsvorschläge nach dem TITEL zusammen und hält je Person EINEN davon: Steht schon ein
// gleichnamiger Vorschlag mit anderem Ort da oder habe ich schon eine andere Aktivität vorgeschlagen,
// würde der Tipp etwas Falsches tun (eine Stimme für den falschen Ort bzw. meinen Vorschlag
// überschreiben). Dann wird der Ort nicht angeboten — lieber still als falsch.
function ortVorschlagMoeglich(meet, ort) {
  const titel = String(meet.title || '').toLowerCase();
  return !(meet.variants || []).some((variant) => variant.kind === 'activity' && (
    ((variant.title || '').toLowerCase() === titel && variant.place?.name !== ort.name)
    || (variant.authorId === ME && (variant.title || '').toLowerCase() !== titel)));
}

function insMeetVorschlag(meet, text, jetzt, plan, orte) {
  const zeit = uhrzeitIn(text);
  const tag = tagIn(text, jetzt);
  const ort = ortIn(text, orte);
  const mitJetzt = !zeit && Boolean(plan?.jetzt);
  const nurTag = !zeit && !mitJetzt && Boolean(tag?.datum) && tag.datum !== meet.date && klingtNachVorschlag(text);
  const datum = zeit ? (tag?.datum || meet.date) : (mitJetzt ? toISODate(jetzt) : (nurTag ? tag.datum : null));
  if (zeit || mitJetzt || nurTag) {
    const teile = mitJetzt ? [t('Jetzt')] : [...(datum !== meet.date ? [meetDateLabel(datum)] : []), ...(zeit ? [zeit] : [])];
    return {
      art: 'ins-meet',
      zeichen: zeit || mitJetzt ? 'zeit' : 'tag',
      datum,
      zeit: zeit || null,
      jetzt: mitJetzt,
      ort: null,
      knopf: t('{was} ins Meet', { was: teile.join(' · ') }),
      schonErfasst: zeitSchonAmMeet(meet, datum, zeit, mitJetzt),
    };
  }
  if (ort && !meet.placePending && ortVorschlagMoeglich(meet, ort)) {
    const platz = { name: ort.name, address: ort.address || '', lat: ort.lat, lon: ort.lon };
    return {
      art: 'ins-meet',
      zeichen: 'ort',
      datum: null,
      zeit: null,
      jetzt: false,
      ort: platz,
      knopf: t('{was} ins Meet', { was: ort.name }),
      schonErfasst: ortSchonAmMeet(meet, platz),
    };
  }
  return null;
}

// Darf der Vorschlag gleich feststehen? Nur wenn das Feld am Meet noch leer ist, niemand sonst
// etwas dafür vorgeschlagen hat und ich das Meet angelegt habe (nur dann nimmt es decideMeet an).
function gleichFestlegen(meet, art, variantId) {
  if (!meet || meet.creatorId !== ME || typeof meet !== 'object') return false;
  const andere = (meet.variants || []).filter((variant) => variant.kind === art && variant.id !== variantId);
  if (andere.length) return false;
  if (art === 'time') return !meet.time || Boolean(meet.openTime);
  return !meet.place?.name && !meet.placePending;
}

function insMeetUebernehmen(ctx, meetId, hinweis) {
  const { repo } = ctx;
  const meet = repo.getMeet(meetId);
  if (!meet) return false;
  let variante;
  let art;
  if (hinweis.ort) {
    if (ortSchonAmMeet(meet, hinweis.ort)) return true;
    art = 'activity';
    variante = { kind: 'activity', title: meet.title, icon: meet.icon, category: meet.category, place: hinweis.ort };
  } else {
    if (zeitSchonAmMeet(meet, hinweis.datum, hinweis.zeit, hinweis.jetzt)) return true;
    art = 'time';
    if (hinweis.jetzt) variante = { kind: 'time', ...jetztTermin() };
    else {
      const uhrzeit = hinweis.zeit || (meet.openTime ? '' : meet.time) || '';
      variante = uhrzeit
        ? { kind: 'time', date: hinweis.datum || meet.date, time: uhrzeit }
        : { kind: 'time', date: hinweis.datum || meet.date, time: null, open: true };
    }
  }
  const ergebnis = repo.addVariant(meetId, variante);
  if (!ergebnis?.ok) {
    ctx.toast(ergebnis?.reason || t('Gerade nicht möglich'));
    return false;
  }
  if (ergebnis.variantId && gleichFestlegen(repo.getMeet(meetId), art, ergebnis.variantId) && typeof repo.decideMeet === 'function') {
    repo.decideMeet(meetId, { variantId: ergebnis.variantId });
  }
  return true;
}

// Der Vorschlag unter einer Nachricht: dieselbe ruhige grüne Pille wie bisher „Als Meet
// vorschlagen", daneben ein leises ✕. Nach dem Tippen: Quittung plus „Rückgängig".
function hinweisChipHtml(message, hinweis, eigen) {
  const seite = eigen ? 'flex-end' : 'flex-start';
  const daten = `data-msg="${esc(message.id)}" data-art="${esc(hinweis.art)}"`;
  if (hinweis.zustand === 'offen') {
    return `<span data-role="raum-hinweis" data-art="${esc(hinweis.art)}" data-zustand="offen" style="display:flex;align-items:center;align-self:${seite};max-width:100%;animation:raumHinweisRein .3s ease-out both">
<button data-act="hinweis-los" ${daten} data-treffer style="display:flex;align-items:center;gap:6px;min-width:0;border:1.5px solid var(--green-a40);color:var(--green-dark);font:650 12px 'Instrument Sans',sans-serif;padding:6px 12px 6px 9px;border-radius:999px;background:transparent;cursor:pointer;appearance:none"><span style="pointer-events:none;display:flex;flex:none">${HINWEIS_ZEICHEN[hinweis.zeichen] || HINWEIS_ZEICHEN[hinweis.art] || ''}</span><span style="pointer-events:none;white-space:nowrap;overflow:hidden;text-overflow:ellipsis">${esc(hinweis.knopf)}</span></button>
<button data-act="hinweis-weg" ${daten} data-treffer aria-label="${esc(t('Vorschlag ausblenden'))}" title="${esc(t('Vorschlag ausblenden'))}" style="width:30px;height:30px;border:0;background:transparent;display:flex;align-items:center;justify-content:center;cursor:pointer;appearance:none;padding:0;flex:none"><span style="pointer-events:none;display:flex">${crossSmallSvg}</span></button>
</span>`;
  }
  const quittung = t('Im Meet vermerkt');
  const haken = '<svg width="12" height="12" viewBox="0 0 24 24" fill="none" style="flex:none"><path d="m6 12.5 4 4 8-9" stroke="var(--green-dark)" stroke-width="2.6" stroke-linecap="round" stroke-linejoin="round"></path></svg>';
  const zurueck = hinweis.zustand === 'wartet'
    ? `<button data-act="hinweis-zurueck" ${daten} style="border:0;background:transparent;padding:6px 2px 6px 9px;cursor:pointer;font-family:'Instrument Sans',sans-serif;appearance:none"><span style="pointer-events:none;font-size:12px;font-weight:650;color:var(--muted);text-decoration:underline">${t('Rückgängig')}</span></button>`
    : '';
  return `<span data-role="raum-hinweis" data-art="${esc(hinweis.art)}" data-zustand="${hinweis.zustand}" style="display:flex;align-items:center;align-self:${seite};max-width:100%">
<span ${daten} style="background:var(--green-tint);border:1.5px solid var(--green-a40);color:var(--green-dark);font:650 12px 'Instrument Sans',sans-serif;padding:5px 12px 5px 9px;border-radius:999px;display:flex;align-items:center;gap:6px;white-space:nowrap">${haken}${esc(quittung)}</span>${zurueck}
</span>`;
}

function messageDateValue(message) {
  // Runde 4 (E7): Der Server liefert den genauen Zeitpunkt mit (at) — der gilt dann.
  if (Number.isFinite(message?.at)) return new Date(message.at);
  const base = message.date ? fromISODate(message.date) : now();
  const [h, m] = String(message.time || '12:00').split(':').map(Number);
  base.setHours(h || 0, m || 0, 0, 0);
  return base;
}

// --- Catch-up (07.9): NUR freie Chat-Infos — Lust auf etwas, Bedarf, erwähnte Ressource.
// Teilnahme, Varianten, Liste und Umfragen stehen im Panel und werden nicht wiederholt.

// v4 P0-4-3: „Ressourcen-Tags existieren weder im Profil noch im Chat." Der Catch-up hebt
// jedes Stichwort gleich hervor — auch den Ressourcennamen. Die frühere Pille
// (keywordChip) war der letzte Ressourcen-Tag der App und ist ersatzlos entfallen.
const keywordBold = (word) => `<b style="font-weight:700;color:var(--ink)">${esc(word)}</b>`;

function catchUpEntries(ctx, info, unseen) {
  const knownResources = new Set();
  for (const person of ctx.repo.getPeople()) {
    for (const resource of person.resources || []) knownResources.add(String(resource));
  }
  for (const resource of ctx.repo.getSettings().resources || []) knownResources.add(String(resource));

  const entries = [];
  const seenKinds = new Set();
  for (const message of unseen) {
    const text = message.text || '';
    if (bringAdoptionLabel(text)) continue; // steht schon strukturiert in der Liste
    const person = ctx.repo.getPerson(message.authorId);
    if (!person) continue;

    // Runde 2: in allen vier Sprachen („Bock auf …", „up for …", „chaud pour …", „se apunta a …").
    {
      const keyword = lustAuf(text);
      if (keyword && !seenKinds.has(`lust:${person.id}`)) {
        seenKinds.add(`lust:${person.id}`);
        entries.push({ person, html: t('{name} hätte Lust auf {wort}', { name: esc(person.name), wort: keywordBold(keyword) }) });
        continue;
      }
    }
    // Runde 3: Wer eine Mitfahrt ANBIETET, steht jetzt auch hier. Vorher las der Catch-up
    // „wer will bei mir mitfahren" als Suche.
    if (bietetMitfahrt(text)) {
      if (!seenKinds.has(`fahrt:${person.id}`)) {
        seenKinds.add(`fahrt:${person.id}`);
        entries.push({ person, html: t('{name} bietet eine {an}Mitfahrt{aus} an', { name: esc(person.name), an: '<b style="font-weight:700;color:var(--ink)">', aus: '</b>' }) });
        continue;
      }
    }
    if (suchtMitfahrt(text)) {
      if (!seenKinds.has(`fahrt:${person.id}`)) {
        seenKinds.add(`fahrt:${person.id}`);
        entries.push({ person, html: t('{name} sucht eine {an}Mitfahrgelegenheit{aus}', { name: esc(person.name), an: '<b style="font-weight:700;color:var(--ink)">', aus: '</b>' }) });
        continue;
      }
    }
    for (const resource of knownResources) {
      const pattern = new RegExp(`(?:^|[\\s@])${resource.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}\\b`, 'i');
      if (pattern.test(text) && !seenKinds.has(`res:${person.id}:${resource.toLowerCase()}`)) {
        seenKinds.add(`res:${person.id}:${resource.toLowerCase()}`);
        entries.push({ person, html: t('{name} erwähnt {wort}', { name: esc(person.name), wort: keywordBold(resource) }) });
        break;
      }
    }
  }
  return entries.slice(0, 4);
}

// =====================================================================================
// room.view — 07.1 / 07.2 / 07.3 (+ Catch-up 07.8/07.9, Anstupsen 07.10, Plus-Menü)
// =====================================================================================

// Ruhiger grüner Statuspuls des aktiven Raums (§5): NUR Opacity des Header-Fades —
// keine Flächenanimation, keine Positions-/Größenänderung, kein grüner Trennstrich.
// Runde 4: kleine Menüs (Nachricht, Gruppe) gehen am Auslöser auf — kurz, ohne Sprung.
const MENUE_STYLE = `<style>@keyframes raumMenueRein{from{opacity:0;transform:scale(.96)}to{opacity:1;transform:none}}
@media (prefers-reduced-motion: reduce){[data-role="nachricht-menue"],[data-role="crew-menu"]{animation:none!important}}</style>`;
// Runde 4 (E7): Ein neuer Vorschlag blendet kurz ein, damit das Auge ihn findet. (E8) Eine
// Nachricht markiert beim langen Drücken keinen Text und öffnet kein Systemmenü — Kopieren
// steht im eigenen Menü.
const ROOM_STYLE = `<style>@keyframes roomPulse{0%,100%{opacity:.72}50%{opacity:1}}
@keyframes raumHinweisRein{from{opacity:0;transform:translateY(4px)}to{opacity:1;transform:none}}
#room-composer::placeholder{color:var(--muted-light)}
[data-nachricht]{-webkit-user-select:none;user-select:none;-webkit-touch-callout:none}
@media (prefers-reduced-motion: reduce){[data-role="raum-hinweis"]{animation:none!important}}</style>${MENUE_STYLE}`;

function renderRoomView(ctx) {
  const { repo, ui, params } = ctx;
  const info = resolveRoom(ctx, params.roomId);
  if (!info) return { html: emptyScreen(''), bind() {} };

  // Beim Öffnen: Catch-up-Stand einfrieren, dann als gelesen markieren (kein notify).
  if (!ui.opened) {
    ui.opened = true;
    const unseen = info.room.messages.slice(info.room.lastReadCount)
      .filter((message) => message.kind === 'text' && message.authorId !== ME);
    ui.unreadCount = unseen.length;
    ui.catchUp = catchUpEntries(ctx, info, unseen);
    repo.markRoomRead(params.roomId);
  }

  // §3: höchstens EIN relevantes Panel — aktiv zuerst, sonst das nächste kommende.
  const panelMeet = panelMeetFor(ctx, info);
  const activeMeet = panelMeet && panelMeet.status === 'active' ? panelMeet : null;

  // Bottom-Ebene: über dem Composer steht der Catch-up — oder, wenn kein Panel und kein
  // Catch-up da ist und das Gegenüber gerade frei ist, der Weg zum Meet (freiAngebot).
  // Runde 8 (R8-8): Der Platz der Frage „Hast du Zeit?" ist leer; die Frage gibt es nicht mehr.
  const catchUp = catchupArea(ctx);
  const angebot = !panelMeet && !catchUp ? freiAngebot(ctx, info) : null;
  let extra = '';
  let extraHeight = 0;
  if (catchUp) {
    extra = catchUp;
    extraHeight = ui.catchOpen ? 92 + 44 * (ui.catchUp?.length || 0) : 60;
  } else if (angebot) {
    extra = freiAngebotArea(angebot);
    extraHeight = 116;
  }

  // Die Timeline: EIN Nachrichtenkoerper in der einen Scrollflaeche — Textnachrichten und
  // strukturierte Ereignisse (Anstupsen, Standort) in ihrer echten Reihenfolge.
  const body = chatBody(ctx, info, panelMeet);

  // Der Zusatzblock bekommt eine ID: die @-Auswahl blendet ihn aus, solange sie offen
  // ist — so bleibt jede Ebene für sich, kein überdeckter Text (§5).
  //
  // v4 P0-5e: Der Composer-Träger ist KEIN deckendes Rechteck mehr. Der Hintergrund sitzt
  // nur noch auf der runden Eingabepille und den beiden runden Knöpfen; der Träger selbst
  // ist durchsichtig und fängt keine Eingaben ab (pointer-events kommen erst auf den
  // echten Bedienelementen zurück).
  // v7 A41 / spec/08 §5: Panel und Linkhinweis liegen als FESTE ÜBERLAGERUNG zwischen
  // Kopf (z 5) und Scrollfläche (z 1). Sie nehmen keinen Layoutplatz mehr weg: die
  // Nachrichten laufen darunter weiter und verschwinden ausschliesslich an der Unterkante
  // des Raumkopfs. Der Innenabstand oben (overlayTopInset) hält die erste Nachricht
  // ruhig unter der Überlagerung, ohne dass die Überlagerung selbst clippt oder fadet.
  const panelHtml = panelMeet ? panelArea(ctx, info, panelMeet) : '';
  // R6 D6 (Jonathan: „Bewertungshinweis könnten wir eventuell woanders hin geben"): Ist hier
  // gerade kein Meet zu planen, aber eines dieser Runde eben vorbei, steht an der Stelle der
  // Meet-Box die Frage danach — genau dort, wo man nach dem Treffen ohnehin hinschaut.
  const bewertungsMeet = panelMeet ? null : bewertungsMeetIn(ctx.repo, info.context);
  const bewertungHtml = bewertungsMeet ? raumBewertungsBox(ctx, bewertungsMeet) : '';
  const hintHtml = meetRoomHints(ctx, info);
  const versatz = panelLageFuer(ctx, params.roomId).versatz;
  const overlayTop = panelHtml || bewertungHtml || hintHtml
    ? `<div data-role="room-panel-layer" style="padding-top:${versatz}px">${panelHtml}${bewertungHtml}${hintHtml}</div>`
    : '';

  // Die ECHTE Höhe der Composer-Zeile: 6 px oben + 40 px Eingabezeile + 26 px unterer
  // Innenabstand. Die Höhe der Zeile bestimmt das Eingabefeld (40 px), nicht die beiden
  // runden 38-px-Knöpfe — hier stand deshalb bisher 70 und damit 2 px zu wenig. Gemessen
  // an .screen-bottom > letztes Kind in 360x740, 390x844, 430x932 und 768x1024: überall
  // 72 px. Mit 70 blieb der Leseraum bei 86 px und damit UNTER der von spec/08 §5
  // geforderten Rechnung (Composer + Safe-Area + 16 = 88 px); die letzte Nachricht hatte
  // nur 14 px Luft zum Textfeld statt der verlangten 16.
  const composerHeight = 72;
  // v7 spec/08 §5: Leseraum unten = Composer-Höhe + Safe-Area + 16 px. Die frühere
  // v4-Entscheidung (bottomInset 58, „die letzte Blase läuft unter die Pille") ist damit
  // ausdrücklich aufgehoben: die letzte Nachricht berührt weder Textfeld noch Plus.
  const leseRaum = composerHeight + SAFE_AREA_UNTEN + 16;
  const html = screenScaffold({
    header: `${ROOM_STYLE}${roomHeader(ctx, info, Boolean(activeMeet))}`,
    body,
    overlayTop,
    overlayTopInset: overlayTop ? panelLageFuer(ctx, params.roomId).inset(Boolean(panelHtml), Boolean(hintHtml), Boolean(bewertungHtml)) : 0,
    bottom: `${bottomFade(8)}${extra ? `<div id="room-extra" style="pointer-events:none">${extra}</div>` : ''}${bottomBar(composerRow(ctx), 'pointer-events:none')}`,
    bottomInset: leseRaum + extraHeight,
    bottomFadeHeight: composerHeight + extraHeight,
    // Runde 8 (R8-12): Das „···" im Kopf oeffnet DIESELBEN Menues wie Chatliste und Profil —
    // friendMenu bzw. crewMenu aus profile.js, samt ihren Folge-Sheets. Kein Nachbau.
    overlays: `${ui.plusMenu ? plusSheet() : ''}${ui.suggestPick ? suggestSheet() : ''}${ui.variantPick && panelMeet ? variantSheet(ctx, panelMeet) : ''}${ui.standort ? standortSheet(ctx, info) : ''}${ui.standortAnsicht ? standortAnsichtSheet(ctx, info) : ''}${ui.create ? createSheet(ctx, info) : ''}${nachrichtMenue(ctx, info)}${gruppeOeffnenSheet(ctx, info)}${ui.menuFor ? friendMenu(ctx, ui.menuFor) : ''}${ui.sheet === 'mark' ? gemeinsamesMarkSheet(ctx) : ''}${markSwitchSheet(ctx)}${gemeinsamesEntfernenSheet(ctx)}${info.kind === 'crew' ? crewMenu(ctx, info.crew.id) : ''}${blockSheet(ctx)}${reportSheet(ctx)}${discardSheet(ctx)}${bildGrossHtml(ctx)}`,
    scrollKey: `room-${params.roomId}`,
  });

  return { html, bind: bindRoomView };
}

// Der Handyrahmen der Demo hat keine echte Safe-Area; die 26 px Innenabstand unter der
// Composer-Zeile tragen sie. Der Wert steht hier trotzdem als eigener Posten, damit die
// Rechnung aus spec/08 §5 (Composer + Safe-Area + 16) im Code sichtbar bleibt.
const SAFE_AREA_UNTEN = 0;

// v7 A41: Lage der festen Panel-Ebene. Der Versatz ist der Weg von der Oberkante der
// Ebene (sie beginnt am Rahmen, nicht am Kopf) bis unter den Raumkopf; der Innenabstand
// ist die Höhe der Ebene ab Kopfunterkante. Beide Werte misst bindRoomView nach dem
// ersten Aufbau am echten Baum nach und legt sie hier ab — der nächste Aufbau trägt sie
// dann schon im Markup, sodass nichts springt. Die Startwerte sind gemessene Richtwerte.
function panelLageFuer(ctx, roomId) {
  const gemerkt = ctx.ui.panelLage;
  const passt = gemerkt && gemerkt.roomId === roomId;
  return {
    versatz: passt ? gemerkt.versatz : 99,
    inset: (mitPanel, mitHinweis, mitBewertung) => {
      if (passt && gemerkt.inset) return gemerkt.inset;
      // R6 D6: Die Bewertungs-Box ist eine Zeile hoch (gemessener Richtwert wie die anderen).
      return (mitPanel ? 196 : 0) + (mitBewertung ? 80 : 0) + (mitHinweis ? 64 : 0) || 64;
    },
  };
}

// Fallback für einen nicht auflösbaren Raum: gleiche Ebenenordnung, nur Kopfzeile.
//
// Runde 7, Welle 3 (Prüferfund, vorbestehend): Hier stand ein LEERER Bildschirm — ein
// Zurückpfeil, sonst nichts. Wer einen alten Link öffnet oder einen Raum, den es nicht mehr
// gibt, sah eine weisse Fläche und konnte nicht wissen, ob die App lädt, hängt oder fertig
// ist. Hausregel 8: fehlt etwas, sagt die App das ehrlich. Jetzt steht da ein Satz — und
// bewusst KEIN erfundener Name, auch nicht die rohe Raum-Kennung aus der Adresse.
function emptyScreen(title, satz = t('Diesen Chat gibt es nicht mehr')) {
  return screenScaffold({
    header: `<div style="display:flex;align-items:center;gap:10px;padding:8px 20px 10px;border-bottom:1px solid var(--ink-a07)">
<button data-act="back" style="border:0;background:transparent;padding:0;display:flex;cursor:pointer"><span style="pointer-events:none;display:flex">${backArrow('var(--ink)', 22)}</span></button>
<span style="font-size:16px;font-weight:650;letter-spacing:-.01em">${esc(title || t('Nicht gefunden'))}</span></div>`,
    body: `<div data-role="raum-fehlt" style="padding:44px 26px;display:flex;flex-direction:column;align-items:center;gap:7px;text-align:center">
<span style="font-size:15px;font-weight:650;color:var(--ink)">${esc(satz)}</span>
<span style="font-size:13px;line-height:1.45;color:var(--muted);max-width:260px">${esc(t('Vielleicht gelöscht, vielleicht ist der Link alt.'))}</span>
</div>`,
    scrollKey: 'room-empty',
  });
}

// Runde 6 (Jonathan): Das „···" steht jetzt DIREKT im Kopf des Raumes — nicht erst in den
// Details. Im 1:1-Chat oeffnet es das Personenmenue, im Gruppen- und Meet-Raum das Gruppenmenue.
// Es sind genau dieselben Menues wie an den anderen Stellen; hier wird nur der Einstieg gesetzt.
//
// Runde 7 (K2, Jonathan): „Das ··· im Raum ist kein runder Knopf. Überall sonst ist es einer."
// Er ist derselbe Baustein wie in den Meet-Details und der Gruppenansicht: punkteKreis, 34 px,
// Trefferfläche 44 px über negative Aussenabstände, damit die Kopfzeile ihre Höhe behält.
//
// Runde 8 (R8-12, Jonathan: „Menü überall identisch — Chat, Profil, Liste; Person und Gruppe.
// ‚Alle Meets' heißt ‚Gemeinsame Meets'."): Der Knopf ist nur noch der ÖFFNER des einen Menüs aus
// profile.js — data-act="menu-open" (Person) bzw. "crew-menu" (Gruppe), dieselben Öffner wie in
// Chatliste und Profil. Der eigene Kalender-Knopf „Alle Meets" daneben ist weg: „Gemeinsame
// Meets" ist jetzt die erste Zeile genau dieses Menüs. Ein Meet-Raum hat kein ···-Menü — sein
// Meet steht in der Meet-Box.
function raumMehrKnopf(ctx, info) {
  if (info.kind === 'meet') return '';
  const person = info.kind === 'person';
  const wen = person ? t('Optionen f\u00fcr {name}', { name: info.person?.name || '' }) : t('Optionen');
  const offen = person ? ctx.ui?.menuFor === info.person?.id : ctx.ui?.crewMenuFor === info.crew?.id;
  const oeffner = person
    ? `data-act="menu-open" data-person="${esc(info.person.id)}"`
    : `data-act="crew-menu" data-crew="${esc(info.crew.id)}"`;
  return `<button ${oeffner} data-role="raum-mehr" data-treffer aria-haspopup="menu" aria-expanded="${offen}" aria-label="${esc(wen)}" style="position:relative;z-index:1;width:44px;height:44px;margin:-5px -5px -5px 0;border:0;background:transparent;display:flex;align-items:center;justify-content:center;flex:none;cursor:pointer;padding:0;appearance:none">${punkteKreis(offen, 34)}</button>`;
}

function roomHeader(ctx, info, active) {
  // Aktives Meet: der Raum-Header trägt den grünen Fade — volle Farbe oben, weich nach
  // unten auf null; die Trennlinie bleibt die normale graue Linie (reference 07.3).
  // v3.1 §5: der Fade pulst sehr ruhig, aber NUR über seine Opacity (eigene Ebene unter
  // dem Inhalt) — keine Flächenanimation, kein zusätzlicher grüner Trennstrich.
  const fade = active
    ? `<span aria-hidden="true" style="position:absolute;inset:0;z-index:0;pointer-events:none;background:linear-gradient(180deg, var(--green-a30), var(--green-a10) 55%, var(--green-a00) 100%);animation:roomPulse 5.2s ease-in-out infinite"></span>`
    : '';
  let identity;
  let nameHtml;
  let subtitle;
  let subtitleHtml = '';
  let bildKnopf = '';
  const settings = ctx.repo.getSettings();
  if (info.kind === 'crew') {
    const others = info.crew.memberIds.filter((id) => id !== ME).map((id) => ctx.repo.getPerson(id)).filter(Boolean);
    // Runde 4 (E6): Wer gerade frei ist, steht vorn im Stapel (sein grüner Punkt ist zu sehen),
    // und die Zeile unter dem Namen sagt es grün: „● 2 frei · 7 Mitglieder ›".
    const frei = others.filter(istGeradeFrei);
    const reihe = [...frei, ...others.filter((person) => !istGeradeFrei(person))];
    // v7 spec/08 §2: Das Gruppenbild ist der primäre Kreis; der Mitgliedsstapel steht
    // klar nachgeordnet daneben (kleiner, ohne eigenen Rahmen) und ersetzt es nie.
    // Runde 6 (Jonathan): nur das Gruppenbild — kein zweiter Stapel daneben.
    identity = `<span style="display:flex;align-items:center;gap:6px;flex:none;pointer-events:none">${gruppenKreis(info.crew, 34, 13)}</span>`;
    nameHtml = `<span style="font-size:16px;font-weight:650;letter-spacing:-.01em;white-space:nowrap;overflow:hidden;text-overflow:ellipsis">${esc(info.title)}</span>`;
    subtitle = tn(info.crew.memberIds.length, '{n} Mitglied ›', '{n} Mitglieder ›');
    if (frei.length) subtitleHtml = `${freiAnzahlText(frei.length)}<span> · ${esc(subtitle)}</span>`;
  } else if (info.kind === 'meet') {
    // v6 A13: Der temporäre Meet-Raum trägt den Meet-Titel und den Teilnehmerstapel —
    // er ist erkennbar KEIN 1:1-Chat und keine dauerhafte Gruppe.
    const others = meetRoomOthers(ctx, info.meet);
    identity = avatarStack(others, { size: 30, font: 11, border: 'var(--paper)', max: 3, more: false, settings });
    nameHtml = `<span style="font-size:16px;font-weight:650;letter-spacing:-.01em;white-space:nowrap;overflow:hidden;text-overflow:ellipsis">${esc(info.title)}</span>`;
    subtitle = tn(others.length + 1, '{n} teilnehmende Person ›', '{n} Teilnehmende ›');
  } else {
    // v4 P0-3-1: Die Markierung kommt aus personMarker/personAvatar — Bester Freund =
    // goldener Ring um den Avatar, Besondere Person = Symbol UNTEN LINKS AM AVATAR
    // (nicht mehr neben dem Namen; v3.2 verlangte das Gegenteil und ist überholt).
    // Neben dem Namen steht nur noch das private Label, und auch das nur, wenn eines
    // tatsächlich eingegeben wurde.
    const marker = personMarker(info.person.id, settings);
    // Runde 5 (B4): Das Profilbild im Kopf ist ein eigener Knopf — ein Tipp zeigt es groß. Name und
    // Unterzeile führen wie bisher ins Profil. Lage und Abstände bleiben genau dieselben.
    bildKnopf = `<button data-act="bild-gross" data-person="${esc(info.person.id)}" data-treffer aria-label="${esc(t('Profilbild von {name} groß ansehen', { name: info.person.name }))}" style="position:relative;z-index:1;display:flex;flex:none;border:0;background:transparent;padding:0;cursor:pointer;appearance:none;border-radius:50%"><span style="display:flex;pointer-events:none">${personAvatar(info.person, { size: 34, fontSize: 13, marker })}</span></button>`;
    identity = '';
    nameHtml = `<span style="display:flex;align-items:center;gap:6px;min-width:0"><span style="font-size:16px;font-weight:650;letter-spacing:-.01em;white-space:nowrap;overflow:hidden;text-overflow:ellipsis">${esc(info.title)}</span>${specialLabelChip(marker)}</span>`;
    const shared = sharedCrews(ctx, info.person.id).length;
    subtitle = shared ? tn(shared, '{n} gemeinsame Crew ›', '{n} gemeinsame Crews ›') : t('Profil ›');
  }
  return `<div style="position:relative;display:flex;align-items:center;gap:10px;padding:8px 20px 10px;border-bottom:1px solid var(--ink-a07);flex:none">
${fade}
<button data-act="back" style="position:relative;z-index:1;border:0;background:transparent;padding:0;display:flex;cursor:pointer;flex:none"><span style="pointer-events:none;display:flex">${backArrow('var(--ink)', 22)}</span></button>
${bildKnopf}
<button data-act="open-details" style="position:relative;z-index:1;display:flex;align-items:center;gap:10px;flex:1;min-width:0;border:0;background:transparent;padding:0;text-align:left;cursor:pointer;font-family:'Instrument Sans',sans-serif;color:var(--ink)">
${identity}
<span style="display:flex;flex-direction:column;min-width:0;flex:1;pointer-events:none">${nameHtml}<span style="font-size:11.5px;color:var(--muted);white-space:nowrap;overflow:hidden;text-overflow:ellipsis">${subtitleHtml || esc(subtitle)}</span></span>
</button>
${raumMehrKnopf(ctx, info)}
</div>`;
}

// =====================================================================================
// Gruppenbild: EIN Weg für „Neue Crew" und „Crew bearbeiten" (v7 spec/08 §2 / A37)
//
// Runde 4 (B3, Jonathan): „Bei den Gruppenprofilbildern soll es gleich einstellbar sein wie bei
// den normalen Profilbildern." Der eigene Weg (Datei wählen → Bildmitte quadratisch → Vorschau)
// ist entfallen. Beide Stellen öffnen denselben Baukasten wie das Profil
// (ui/profilbild-baukasten.js): Hintergrund · Motiv · Foto mit Zuschnitt, eine große Vorschau.
// Übernommen wird erst mit „Übernehmen" in den Entwurf der Seite; Abbrechen ändert nichts.
// =====================================================================================

function gruppenBaukastenSheet(ctx) {
  const pb = ctx.ui.gruppenPb;
  return pb ? pbSheet(pb, { titel: t('Gruppenbild'), abbrechen: 'gpb-abbrechen', uebernehmen: 'gpb-uebernehmen', scrollKey: 'gruppenbild' }) : '';
}

// Aktionen und Bindungen des Baukastens. `uebernehmen({ photo, color })` legt das Ergebnis in den
// Entwurf der aufrufenden Seite (gespeichert wird dort, wie bisher, mit „Speichern"/„Erstellen").
function gruppenBaukastenAktionen(root, ctx, uebernehmen) {
  const holen = () => ctx.ui.gruppenPb || null;
  pbFotoBinden(root, ctx, holen);
  return {
    ...pbActs(ctx, holen),
    'gpb-abbrechen': () => { ctx.ui.gruppenPb = null; ctx.render(); },
    'gpb-uebernehmen': () => {
      const pb = holen();
      if (!pb) return;
      const ergebnis = pbErgebnis(pb);
      ctx.ui.gruppenPb = null;
      uebernehmen(ergebnis);
      ctx.render();
    },
  };
}

// Die Gruppenfarbe nur ersetzen, wenn im Baukasten wirklich eine andere gewählt wurde — sonst würde
// schon das bloße Öffnen und Übernehmen „var(--blue)" in den gleichwertigen Palettenwert umschreiben.
function neueGruppenfarbe(vorher, nachher) {
  return farbSchluessel(vorher || CREW_COLORS[1]) === farbSchluessel(nachher) ? vorher : nachher;
}

// Runde 4 (E6): „frei" heißt dasselbe wie der grüne Punkt am Profilbild (personAvatar): Frei
// gemeldet und nicht gerade in einem Meet.
function istGeradeFrei(person) {
  return Boolean(person?.free?.active && !person.activeMeetId);
}

const freiPunkt = '<span style="display:inline-block;width:7px;height:7px;border-radius:50%;background:var(--green);flex:none"></span>';

// Im Raumkopf: grüne Schrift in der Unterzeile. In den Gruppen-Details: eine kleine grüne Pille.
function freiAnzahlText(n) {
  return `<span data-role="frei-anzahl" style="color:var(--green-dark);font-weight:650;display:inline-flex;align-items:center;gap:4px">${freiPunkt}${esc(t('{n} frei', { n }))}</span>`;
}

function freiAnzahlChip(n) {
  return `<span data-role="frei-anzahl" style="display:inline-flex;align-items:center;gap:5px;font-size:12px;font-weight:650;color:var(--green-dark);background:var(--green-tint);border-radius:999px;padding:3px 9px 3px 7px">${freiPunkt}${esc(t('{n} frei', { n }))}</span>`;
}

// v7 spec/08 §2: EIN Bild für die Gruppe — das kanonische groupImage, sonst ein ruhiges
// neutrales Monogramm auf der Gruppenfarbe. Ausdrücklich KEINE Mitglieder-Collage: die
// wäre eine irreführende Ersatzidentität (spec/08 §2, A37d).
// Runde 8 (R8-2, Jonathan: „Person rund · Gruppe eckig mit KLEINEREM Eckradius"): Die Form kommt
// nicht mehr von hier. Das Bild gibt sich als [data-role="gruppen-bild"] zu erkennen, und die EINE
// Regel dafür steht in styles.css (20 % der Kante) — dieselbe wie in der Chatliste (crew.js
// gruppenKachel). So ist die Gruppe im Raumkopf, auf der Gruppenseite, beim Anlegen und Bearbeiten,
// in „Mit wem" (new-meet.js) und im Profil (profile.js) überall dasselbe Viereck mit runden Ecken.
export function gruppenKreis(crew, size = 34, fontSize = 13) {
  const bild = bildVon(crew);
  const base = crew?.color || 'var(--blue)';
  if (bild) {
    return `<span data-role="gruppen-bild" style="width:${size}px;height:${size}px;overflow:hidden;flex:none;display:block"><img src="${esc(bild)}" alt="" aria-hidden="true" style="width:100%;height:100%;object-fit:cover;display:block"></span>`;
  }
  return `<span data-role="gruppen-bild" style="width:${size}px;height:${size}px;background:linear-gradient(150deg,${base},${shade(base, -0.18)});color:var(--on-accent);display:flex;align-items:center;justify-content:center;flex:none;font:650 ${fontSize}px 'Bricolage Grotesque',sans-serif">${esc(crewInitials(crew?.name))}</span>`;
}

// Runde 5 (B3): Vorschau einer Gruppe, die gerade entsteht oder bearbeitet wird — derselbe Kreis wie
// überall. Solange sie weder Bild noch Namen hat, steht ein ruhiges Gruppenzeichen darauf statt einer
// leeren Farbfläche.
function gruppenVorschau(crew, size, fontSize) {
  if (bildVon(crew) || crewInitials(crew?.name)) return gruppenKreis(crew, size, fontSize);
  const base = crew?.color || 'var(--blue)';
  return `<span data-role="gruppen-bild" style="width:${size}px;height:${size}px;background:linear-gradient(150deg,${base},${shade(base, -0.18)});display:flex;align-items:center;justify-content:center;flex:none">${groupIcon('var(--on-accent)', Math.round(size * 0.42))}</span>`;
}

// Jonathan (B3): „Bei Gruppe erstellen, mache es ähnlich wie bei eigenem Profil, mittig oben Profilbild-
// Vorschau." Aufbau, Größen und Abstände sind die von „Profil bearbeiten" (profile.js): 84-px-Scheibe,
// 30-px-Stift unten rechts, darunter der ausdrückliche Textknopf in Grün. Beide öffnen den Baukasten.
const stiftPlakette = `<span style="position:absolute;right:-3px;bottom:-3px;width:30px;height:30px;border-radius:50%;background:var(--surface);border:1px solid var(--ink-a12);box-shadow:0 2px 6px var(--shadow-14);display:flex;align-items:center;justify-content:center;pointer-events:none"><svg width="12" height="12" viewBox="0 0 24 24" fill="none"><path d="M4 20h4L20 8l-4-4L4 16v4Z" stroke="var(--ink)" stroke-width="1.8" stroke-linejoin="round"></path></svg></span>`;

function gruppenBildKopf({ act, crew, text, rolle }) {
  return `<div data-role="${rolle}" style="display:flex;flex-direction:column;align-items:center;gap:6px">
<button data-act="${act}" aria-label="${esc(text)}" style="position:relative;display:block;width:84px;height:84px;border:0;background:transparent;padding:0;cursor:pointer;appearance:none;flex:none;border-radius:20%">
<span data-role="gruppenbild-vorschau" style="position:relative;display:block;width:84px;height:84px;pointer-events:none">${gruppenVorschau(crew, 84, 28)}</span>
${stiftPlakette}</button>
<button data-act="${act}" style="border:0;background:transparent;padding:8px 10px 2px;min-height:34px;cursor:pointer;appearance:none;font:650 13.5px 'Instrument Sans',sans-serif;color:var(--green-dark)">${esc(text)}</button>
</div>`;
}

// Runde 5 (C1): Wer die Gruppe verwaltet — dieselbe Regel wie die Datenschicht (adminIds, sonst creatorId).
function crewAdmins(crew) {
  if (Array.isArray(crew?.adminIds) && crew.adminIds.length) return crew.adminIds;
  return crew?.creatorId ? [crew.creatorId] : [];
}
const darfHinzufuegen = (crew) => crewAdmins(crew).includes(ME);

// v6 A12: Gruppen bekommen dasselbe Drei-Punkte-Menü, das Personen längst haben.
// v7 A07/A19c kehrt das für den RAUM um: im Raumkopf gibt es keinen Gruppen-Overflow
// mehr. Der Knopf und sein Menü existieren nur noch in room.crewDetails.
// Runde 4 (C3): „Die drei Punkte sind relativ klein." Der sichtbare Kreis wächst von 34 auf 40 px,
// die Punkte werden ein echtes Zeichen statt drei Textpunkten, und die Trefferfläche ist 44 px —
// über negative Außenabstände, damit die Kopfzeile ihre Höhe behält.
const punkteSvg = '<svg width="20" height="20" viewBox="0 0 24 24" fill="none" style="pointer-events:none;display:block"><circle cx="5.5" cy="12" r="1.9" fill="var(--ink-soft)"></circle><circle cx="12" cy="12" r="1.9" fill="var(--ink-soft)"></circle><circle cx="18.5" cy="12" r="1.9" fill="var(--ink-soft)"></circle></svg>';
const punkteKreis = (offen, groesse = 40) => `<span data-kreis="1" style="pointer-events:none;width:${groesse}px;height:${groesse}px;border-radius:50%;background:${offen ? 'var(--field)' : 'var(--surface)'};border:1.5px solid ${offen ? 'var(--ink-a22)' : 'var(--ink-a10)'};box-sizing:border-box;display:flex;align-items:center;justify-content:center">${punkteSvg}</span>`;

// --- R6 D3/D4 — Sichtbare Zeilen im Raum, „···" gleich an der Zeile -------------------------
//
// Jonathan (Runde 6): „vielleicht sollte man chats usw nicht in einer unsichtbaren zeile
// haben sondern eine sichtbare zeile" und „die drei punkte sollten nicht erst im profil
// einer person sein, sondern früher da sein."
//
// Gemessen war eine Mitgliederzeile bisher ein Knopf OHNE jede eigene Fläche: kein Rahmen,
// keine Trennlinie, kein Pfeil — man musste wissen, dass sie antippbar ist.
//
// Bauform und Klassen sind EXAKT die der Crew-Seite (P1, styles.css „Runde 6 (P1)"):
// `.r6-zeile` färbt sich beim Drücken, `.r6-mehr` ist das 44-px-Ziel der drei Punkte.
// Eine Zeile sieht damit im Crew-Tab und im Raum gleich aus und verhält sich gleich —
// zwei Bauformen für dieselbe Sache wären genau der Fehler, den D3 abstellen soll.
// Im Raum liegen die Zeilen schon in einer Karte; die Haarlinie dazwischen setzt
// `.r6-zeilen` (P6-Block), einen zweiten Kasten braucht es nicht.
//
// `zeilePunkte` öffnet DASSELBE Menü wie das Profil (friendMenu/friendMenuActs aus
// screens/profile.js) — kein zweiter Nachbau, kein zweiter Wortlaut.
function raumZeile(inhalt, attrs = '') {
  return `<div class="r6-zeile"${attrs} style="display:flex;align-items:center;gap:2px">${inhalt}</div>`;
}

function zeilePunkte(ctx, personId, name) {
  return `<button data-act="menu-open" data-person="${esc(personId)}" data-treffer data-role="person-mehr" class="r6-mehr" aria-haspopup="menu" aria-expanded="${ctx.ui.menuFor === personId}" aria-label="${esc(t('Optionen für {name}', { name }))}" style="flex:none;width:44px;height:44px;margin-right:4px;border:0;border-radius:50%;background:transparent;display:flex;align-items:center;justify-content:center;cursor:pointer;appearance:none;padding:0"><span style="pointer-events:none;color:var(--muted);letter-spacing:1.5px;font:650 14px/1 'Instrument Sans',sans-serif">···</span></button>`;
}

function crewDotsButton(crewId, open) {
  return `<button data-act="crew-menu" data-crew="${esc(crewId)}" aria-label="${esc(t('Gruppenoptionen'))}" aria-expanded="${open}" style="position:relative;z-index:1;width:44px;height:44px;margin:-5px -2px -5px 0;border:0;background:transparent;display:flex;align-items:center;justify-content:center;flex:none;cursor:pointer;padding:0;appearance:none">${punkteKreis(open)}</button>`;
}

// =============================================================================================
// Runde 8 (R8-8): „Hast du Zeit?" ist weg — der Knopf, das Band, die Antworten und die alten
// Anstupser im Verlauf. Die Datenmethoden (frageStellen, respondNudge …) bleiben im Vertrag;
// dieser Raum ruft keine davon mehr.
// =============================================================================================

// Runde 7 — der kürzeste Weg von Reden zu Tun:
// Wer GERADE frei gemeldet ist, hat schon gesagt, dass er Zeit hat. Steht der Raum also einer
// freien Person (oder einer Gruppe mit freien Leuten) gegenüber, liegt über der Eingabe der
// kürzeste Weg zu einem Treffen: das Meet.
function freiAngebot(ctx, info) {
  if (info.kind === 'person') {
    const person = ctx.repo.getPerson(info.person.id);
    if (!istGeradeFrei(person)) return null;
    return { text: t('{name} ist gerade frei', { name: person.name }) };
  }
  if (info.kind === 'crew') {
    const frei = (info.crew.memberIds || [])
      .filter((id) => id !== ME)
      .map((id) => ctx.repo.getPerson(id))
      .filter((person) => istGeradeFrei(person));
    if (!frei.length) return null;
    return { text: frei.length === 1 ? t('{name} ist gerade frei', { name: frei[0].name }) : t('{n} sind gerade frei', { n: frei.length }) };
  }
  return null;
}

const freiAngebotGlyph = `<svg width="17" height="17" viewBox="0 0 24 24" fill="none" style="display:block"><path d="M12 5v14M5 12h14" stroke="var(--on-accent)" stroke-width="2.4" stroke-linecap="round"></path></svg>`;

function freiAngebotArea(angebot) {
  return bottomBar(`<div style="display:flex;flex-direction:column;align-items:center;gap:9px;padding:6px 0 10px">
<button data-act="meet-suggest" data-role="frei-angebot" style="pointer-events:auto;border:0;background:var(--green);color:var(--on-accent);border-radius:999px;min-height:52px;padding:0 24px;display:flex;align-items:center;gap:8px;cursor:pointer;appearance:none;font:650 14.5px 'Instrument Sans',sans-serif;box-shadow:0 4px 14px var(--shadow-12)"><span style="pointer-events:none;display:flex">${freiAngebotGlyph}</span><span style="pointer-events:none">${esc(t('Meet vorschlagen'))}</span></button>
<span style="font-size:11.5px;font-weight:650;color:var(--green-dark);pointer-events:none;background:var(--paper-a92);border-radius:8px;padding:1px 8px">${esc(angebot.text)}</span>
</div>`, 'pointer-events:none');
}

// =====================================================================================
// Standort teilen (v7 spec/08 §3) — EINMALIG, bewusst, nur an die Mitglieder dieses Raums
//
// Es gibt keine Live-Position, keine Hintergrundortung und keinen automatischen Versand.
// Die Berechtigung wird ERST beim Weg „Aktueller Standort" abgefragt; eine Ablehnung
// lässt den Kartenweg offen und rührt die globale Standortfreigabe (Profil) nicht an.
// =====================================================================================

// Runde 3 (Jonathan, K5): „Überall, wo Kartenansichten sind, ist noch keine echte Karte,
// sondern unser gezeichnetes Bild. Und der Standort wird nicht als Nachricht geschickt,
// sondern allgemein." Beides ist jetzt anders:
//   • Auswahl, Bestätigung und Ansicht zeigen die ECHTE Karte (ui/map.js — MapLibre, OSM).
//   • Im Verlauf steht der Standort als Nachricht der Person, die ihn geschickt hat — die
//     eigene rechts, die fremde links mit Profilbild — mit einem Kartenbild des Ortes.
//   • Sparsam: Das Kartenbild entsteht erst, wenn die Nachricht sichtbar wird; genau EINE
//     Karte zeichnet es, danach bleibt nur das Bild — keine laufende Karte je Nachricht.
//     Ein Tipp öffnet die große, bedienbare Karte mit dem Weg in die Karten-App.

function koordinatenText(ort) {
  if (!ort || typeof ort.lat !== 'number' || !Number.isFinite(ort.lat)) return '';
  return `${ort.lat.toFixed(4)}, ${ort.lon.toFixed(4)}`;
}

const standortPinSvg = `<svg width="15" height="15" viewBox="0 0 24 24" fill="none" style="flex:none;pointer-events:none"><path d="M12 21s7-6.1 7-11a7 7 0 1 0-14 0c0 4.9 7 11 7 11Z" stroke="var(--ink)" stroke-width="1.8" stroke-linejoin="round"></path><circle cx="12" cy="10" r="2.6" stroke="var(--ink)" stroke-width="1.8"></circle></svg>`;
const zielKreuzSvg = `<svg width="17" height="17" viewBox="0 0 24 24" fill="none" style="flex:none;pointer-events:none"><circle cx="12" cy="12" r="6.4" stroke="var(--ink)" stroke-width="1.8"></circle><path d="M12 2.6v3.2M12 18.2v3.2M2.6 12h3.2M18.2 12h3.2" stroke="var(--ink)" stroke-width="1.8" stroke-linecap="round"></path></svg>`;

// Die Stecknadel über jeder Kartenfläche des Raums — dieselbe grüne Form wie bisher.
function standortNadel(gross = false) {
  const kreis = gross ? 30 : 22;
  const punkt = gross ? 8 : 6;
  return `<div aria-hidden="true" style="position:absolute;left:50%;top:50%;transform:translate(-50%,-100%);display:flex;flex-direction:column;align-items:center;pointer-events:none;z-index:2">
<span style="width:${kreis}px;height:${kreis}px;border-radius:50%;background:var(--green);border:${gross ? 3 : 2.5}px solid var(--surface);box-sizing:border-box;box-shadow:0 3px 9px var(--shadow-25);display:flex;align-items:center;justify-content:center"><span style="width:${punkt}px;height:${punkt}px;border-radius:50%;background:var(--surface)"></span></span>
<span style="width:2.5px;height:${gross ? 12 : 9}px;background:var(--green)"></span>
</div>`;
}

// Die Ortsabfrage nennt an einer Stelle gern das nächste Geschäft („Kosmetikstudio …"). Für
// einen geteilten Standort sagt die Straße mehr: Sie steht vorn, wenn es eine gibt; darunter
// Postleitzahl und Ort (ohne Bundesland). Ohne Straße bleibt der Name, den die Abfrage liefert.
function ortInWorten(treffer) {
  const teile = String(treffer?.address || '').split(',').map((teil) => teil.trim()).filter(Boolean);
  const strasse = teile[0] && !/^\d/.test(teile[0]) ? teile[0] : '';
  const ort = teile.find((teil) => /^\d/.test(teil)) || (strasse ? teile[1] : teile[0]) || '';
  return { name: strasse || treffer?.name || '', address: ort };
}

// OpenStreetMap verlangt die Herkunftsangabe auch unter einem Kartenbild.
const OSM_HINWEIS = `<span aria-hidden="true" style="position:absolute;right:5px;bottom:4px;z-index:2;font:600 8.5px/1.35 'Instrument Sans',sans-serif;color:var(--muted);background:var(--paper-a92);border-radius:5px;padding:0 4px;pointer-events:none">© OpenStreetMap</span>`;

// Kartenfläche der Bestätigung. Die echte Karte hängt sich in bind an den Knoten mit
// data-fremd (den der Abgleich nicht anfasst). Ohne Koordinaten bleibt die ruhige Fläche.
function standortKartenFlaeche(rolle, ort, hoehe) {
  const echt = hatKoordinaten(ort);
  return `<div style="position:relative;height:${hoehe}px;border-radius:14px;overflow:hidden;background:var(--field);flex:none">
${echt ? `<div data-fremd="1" data-role="${rolle}" data-lat="${ort.lat}" data-lon="${ort.lon}" style="position:absolute;inset:0"></div>` : ''}
${standortNadel(hoehe >= 160)}
</div>`;
}

// Was über dem Ort steht: der Name aus der Ortsabfrage, sonst die feste Bezeichnung in der
// Sprache der Lesenden (loc-send speichert sie deutsch), sonst schlicht „Standort".
function standortTitel(eintrag) {
  if (eintrag?.name) return eintrag.name;
  if (eintrag?.label === 'Aktueller Standort') return t('Aktueller Standort');
  if (eintrag?.label === 'Auf der Karte gewählt') return t('Auf der Karte gewählt');
  return eintrag?.label || t('Standort');
}

function standortUnterzeile(eintrag) {
  if (eintrag?.name && eintrag.address) return eintrag.address;
  return koordinatenText({ lat: Number(eintrag?.lat), lon: Number(eintrag?.lon) });
}

// Der Standort im Verlauf ist eine NACHRICHT der Person, die ihn geschickt hat: dieselbe
// Blasengeometrie wie Text (eigene rechts, fremde links mit Profilbild), darin das Kartenbild
// (standortBilderBinden), Ort und Uhrzeit. Ein Tipp öffnet die große Karte.
function standortEintrag(ctx, message) {
  const eigen = message.authorId === ME;
  const lat = Number(message.lat);
  const lon = Number(message.lon);
  const echt = Number.isFinite(lat) && Number.isFinite(lon);
  const titel = standortTitel(message);
  const karte = `<span style="position:relative;display:block;height:124px;border-radius:12px;overflow:hidden;background:var(--field)">
${echt ? `<span data-fremd="1" data-role="standort-bild" data-msg="${esc(message.id)}" data-lat="${lat}" data-lon="${lon}" style="position:absolute;inset:0;display:block"></span>` : ''}
${standortNadel(false)}${echt ? OSM_HINWEIS : ''}
</span>`;
  const zeile = `<span style="display:flex;align-items:center;gap:8px;padding:8px 6px 3px;min-width:0">
<span style="display:flex;flex:none">${standortPinSvg}</span>
<span style="display:flex;flex-direction:column;gap:1px;min-width:0;flex:1">
<span style="font-size:13px;font-weight:650;color:${eigen ? 'var(--green-dark)' : 'var(--ink)'};white-space:nowrap;overflow:hidden;text-overflow:ellipsis">${esc(titel)}</span>
<span style="font-size:11px;color:var(--muted);white-space:nowrap;overflow:hidden;text-overflow:ellipsis;font-variant-numeric:tabular-nums">${esc(standortUnterzeile(message))}</span>
</span>
<span style="font-size:10.5px;color:var(--muted-light);flex:none;align-self:flex-end;font-variant-numeric:tabular-nums">${esc(message.time || '')}</span>
</span>`;
  const gedrueckt = ctx.ui.nachrichtMenue?.id === message.id ? ';box-shadow:0 0 0 2px var(--ink-a14),0 8px 20px var(--shadow-12)' : '';
  const blase = (form) => `<button data-act="standort-oeffnen" data-blase="1" data-msg="${esc(message.id)}" aria-label="${esc(t('Standort ansehen: {ort}', { ort: titel }))}" style="display:block;width:236px;max-width:100%;padding:4px;cursor:pointer;appearance:none;font-family:'Instrument Sans',sans-serif;text-align:left;${form}"><span style="display:block;pointer-events:none">${karte}${zeile}</span></button>`;
  if (eigen) {
    return `<div data-role="standort-nachricht" data-nachricht="${esc(message.id)}" data-eigen="1" style="display:flex;justify-content:flex-end">${blase(`background:var(--green-tint);border:0;border-radius:16px 16px 5px 16px${gedrueckt}`)}</div>`;
  }
  const avatar = nachrichtBild(ctx, ctx.repo.getPerson(message.authorId));
  return `<div data-role="standort-nachricht" data-nachricht="${esc(message.id)}" data-person="${esc(message.authorId)}" style="display:flex;gap:8px;align-items:flex-end">${avatar}${blase(`background:var(--surface);border:1px solid var(--ink-a07);border-radius:16px 16px 16px 5px${gedrueckt}`)}</div>`;
}

const routeSvg = '<svg width="15" height="15" viewBox="0 0 24 24" fill="none" style="flex:none;pointer-events:none"><circle cx="6" cy="18" r="2.4" stroke="var(--ink)" stroke-width="1.8"></circle><circle cx="18" cy="6" r="2.4" stroke="var(--ink)" stroke-width="1.8"></circle><path d="M8.4 18H15a3 3 0 0 0 0-6H9a3 3 0 0 1 0-6h6.6" stroke="var(--ink)" stroke-width="1.8" stroke-linecap="round"></path></svg>';

// Große Ansicht eines geteilten Standorts: bedienbare Karte mit Markierung genau am Ort
// (sie bleibt dort, wenn man die Karte schiebt), darunter der Weg in die Karten-App.
function standortAnsichtSheet(ctx, info) {
  const message = info.room.messages.find((entry) => entry.id === ctx.ui.standortAnsicht && entry.kind === 'location');
  if (!message) return '';
  const author = ctx.repo.getPerson(message.authorId);
  const wer = message.authorId === ME ? t('Du') : (author?.name || t('Jemand'));
  const lat = Number(message.lat);
  const lon = Number(message.lon);
  const echt = Number.isFinite(lat) && Number.isFinite(lon);
  const knopf = (anbieter, name) => `<button data-act="standort-route" data-provider="${anbieter}" style="flex:1;display:flex;align-items:center;justify-content:center;gap:7px;border:1.5px solid var(--ink-a14);background:var(--surface);color:var(--ink);font:650 13.5px/1 'Instrument Sans',sans-serif;padding:12px 0;border-radius:999px;cursor:pointer;appearance:none">${routeSvg}<span style="pointer-events:none">${name}</span></button>`;
  return sheet(`<div style="display:flex;flex-direction:column;gap:13px;font-family:'Instrument Sans',sans-serif">
<div style="display:flex;align-items:center;gap:11px">
<span style="width:38px;height:38px;border-radius:12px;background:var(--paper);display:flex;align-items:center;justify-content:center;flex:none">${standortPinSvg}</span>
<span style="display:flex;flex-direction:column;gap:1px;min-width:0">
<span style="font-family:'Bricolage Grotesque',sans-serif;font-size:19px;font-weight:650;white-space:nowrap;overflow:hidden;text-overflow:ellipsis">${esc(standortTitel(message))}</span>
<span style="font-size:11.5px;color:var(--muted);white-space:nowrap;overflow:hidden;text-overflow:ellipsis;font-variant-numeric:tabular-nums">${esc(wer)} · ${esc(message.time || '')}</span>
</span>
</div>
<div style="position:relative;height:380px;border-radius:16px;overflow:hidden;background:var(--field);flex:none">
${echt ? `<div data-fremd="1" data-role="standort-grosskarte" data-lat="${lat}" data-lon="${lon}" style="position:absolute;inset:0"></div>` : standortNadel(true)}
</div>
<span style="font-size:12px;color:var(--muted);font-variant-numeric:tabular-nums">${esc(standortUnterzeile(message))}</span>
${echt ? `<div style="display:flex;flex-direction:column;gap:7px"><span style="font-size:11px;font-weight:650;letter-spacing:.09em;text-transform:uppercase;color:var(--muted-light)">${t('Route')}</span><div style="display:flex;gap:8px">${knopf('apple', 'Apple Maps')}${knopf('google', 'Google Maps')}</div></div>` : ''}
</div>`, { closeAct: 'standort-zu', scrollKey: 'raum-standort-ansicht' });
}

// --- Echte Karten des Standortwegs (Runde 3, K5) --------------------------------------------
const STANDORT_WAHL = 'raum-standort-wahl';
const STANDORT_VORSCHAU = 'raum-standort-vorschau';
const STANDORT_GROSS = 'raum-standort-gross';

// Wo die Auswahl anfängt: am schon gewählten Ort, sonst am Ort des Meets im Raum, sonst zu
// Hause bzw. im Land des Geräts (startAnsicht) — nie an einem erfundenen Punkt.
function standortStart(ctx, panelMeet) {
  const zuvor = ctx.ui.standort?.start;
  if (hatKoordinaten(zuvor)) return { mitte: { lat: zuvor.lat, lon: zuvor.lon }, zoom: 15.5 };
  if (hatKoordinaten(panelMeet?.place)) return { mitte: { lat: panelMeet.place.lat, lon: panelMeet.place.lon }, zoom: 14.5 };
  return startAnsicht(ctx.repo.getSettings());
}

// Die Markierung der großen Ansicht hängt an der Koordinate (maplibregl.Marker), nicht an
// der Mitte des Rahmens — sie bleibt am Ort, wenn man die Karte schiebt.
function standortMarke() {
  const marke = document.createElement('div');
  marke.setAttribute('aria-hidden', 'true');
  marke.style.cssText = 'display:flex;flex-direction:column;align-items:center;pointer-events:none';
  marke.innerHTML = '<span style="width:30px;height:30px;border-radius:50%;background:var(--green);border:3px solid var(--surface);box-sizing:border-box;box-shadow:0 3px 9px var(--shadow-25);display:flex;align-items:center;justify-content:center"><span style="width:8px;height:8px;border-radius:50%;background:var(--surface)"></span></span><span style="width:2.5px;height:12px;background:var(--green)"></span>';
  return marke;
}

function standortKartenBinden(root, ctx, panelMeet) {
  const wahl = root.querySelector('[data-role="standort-wahlkarte"]');
  if (wahl) {
    const start = standortStart(ctx, panelMeet);
    // Runde 4 (D7): Jede bedienbare Karte trägt dieselbe Bedienspalte (Höhenregler + ⓘ, ui/map.js
    // KARTEN_SPALTE) — dafür ist die Kartenfläche mindestens 380 px hoch.
    karteHalten(wahl, STANDORT_WAHL, { mitte: start.mitte, zoom: start.zoom, folgen: false, interaktiv: true, hoehenRegler: true }).catch(() => {});
  }
  const vorschau = root.querySelector('[data-role="standort-vorschau"]');
  if (vorschau) {
    karteHalten(vorschau, STANDORT_VORSCHAU, {
      mitte: { lat: Number(vorschau.dataset.lat), lon: Number(vorschau.dataset.lon) }, zoom: 15.5, interaktiv: false, folgen: true,
    }).catch(() => {});
  }
  const gross = root.querySelector('[data-role="standort-grosskarte"]');
  if (gross && !gross.__markiert) {
    gross.__markiert = true;
    const ort = { lat: Number(gross.dataset.lat), lon: Number(gross.dataset.lon) };
    karteHalten(gross, STANDORT_GROSS, { mitte: ort, zoom: 15.5, interaktiv: true, folgen: false, hoehenRegler: true })
      .then(async (karte) => {
        if (!karte) return;
        const maplibregl = await ladeMapLibre();
        new maplibregl.Marker({ element: standortMarke(), anchor: 'bottom' }).setLngLat([ort.lon, ort.lat]).addTo(karte);
      })
      .catch(() => {});
  }
}

// Kartenbilder im Verlauf: je Nachricht EIN Bild, gezeichnet von EINER kurzlebigen Karte —
// erst wenn die Nachricht (fast) sichtbar ist, eine nach der anderen. Danach bleibt nur das
// Bild im Speicher; beim nächsten Öffnen des Raums steht es sofort da.
const standortBilder = new Map();
const standortLebendeKarten = new Set();
let standortMalerei = Promise.resolve();

function standortBildEinsetzen(flaeche, url) {
  flaeche.innerHTML = '';
  const bild = document.createElement('img');
  bild.alt = '';
  bild.src = url;
  // Dieselbe Klasse wie die Zeichenfläche der Karte: So gilt die dunkle Darstellung aus
  // styles.css (umgekehrte Kartenfarben) auch für das Bild — eine Regel, kein Nachbau.
  bild.className = 'maplibregl-canvas';
  bild.style.cssText = 'position:absolute;inset:0;width:100%;height:100%;object-fit:cover;display:block';
  flaeche.appendChild(bild);
}

function standortBildMalen(flaeche, id) {
  if (!flaeche.isConnected || flaeche.__fuer !== id) return Promise.resolve();
  const traeger = document.createElement('div');
  traeger.style.cssText = 'position:absolute;inset:0';
  flaeche.appendChild(traeger);
  const mitte = { lat: Number(flaeche.dataset.lat), lon: Number(flaeche.dataset.lon) };
  return karteAnlegen(traeger, { mitte, zoom: 15, interaktiv: false }).then((karte) => new Promise((fertig) => {
    if (!karte) { traeger.remove(); fertig(); return; }
    let erledigt = false;
    const ende = (url) => {
      if (erledigt) return;
      erledigt = true;
      const passt = flaeche.isConnected && flaeche.__fuer === id;
      // Ein echtes Kartenbild ist viele Kilobyte groß; eine leere Fläche (ohne Kacheln) nicht.
      if (url && url.length > 12000 && passt) {
        standortBilder.set(id, url);
        try { karte.remove(); } catch { /* egal */ }
        standortBildEinsetzen(flaeche, url);
      } else if (passt) {
        // Kein Bild (kein Netz, keine lesbare Zeichenfläche): Die Karte selbst bleibt stehen —
        // ruhig und nicht bedienbar. Lieber die echte Karte als gar keine.
        standortLebendeKarten.add({ flaeche, karte });
      } else {
        try { karte.remove(); } catch { /* egal */ }
      }
      fertig();
    };
    // Gelesen wird im selben Durchlauf, in dem die Karte gezeichnet hat: MapLibre meldet
    // „idle" am Ende genau dieses Durchlaufs — danach wäre die Zeichenfläche schon geleert.
    karte.once('idle', () => {
      try { ende(karte.getCanvas().toDataURL('image/jpeg', 0.84)); } catch { ende(null); }
    });
    window.setTimeout(() => ende(null), 10000);
  })).catch(() => {});
}

function standortBilderBinden(root) {
  for (const eintrag of [...standortLebendeKarten]) {
    if (eintrag.flaeche.isConnected) continue;
    try { eintrag.karte.remove(); } catch { /* egal */ }
    standortLebendeKarten.delete(eintrag);
  }
  const flaechen = root.querySelectorAll('[data-role="standort-bild"]');
  if (!flaechen.length) return;
  const scroll = root.querySelector('.screen-scroll');
  flaechen.forEach((flaeche) => {
    const id = flaeche.dataset.msg;
    if (flaeche.__fuer === id) return;
    flaeche.__fuer = id;
    flaeche.innerHTML = '';
    const fertig = standortBilder.get(id);
    if (fertig) { standortBildEinsetzen(flaeche, fertig); return; }
    const malen = () => { standortMalerei = standortMalerei.then(() => standortBildMalen(flaeche, id)); };
    if (typeof IntersectionObserver !== 'function') { malen(); return; }
    const wache = new IntersectionObserver((eintraege) => {
      if (!eintraege.some((eintrag) => eintrag.isIntersecting)) return;
      wache.disconnect();
      malen();
    }, { root: scroll || null, rootMargin: '240px 0px' });
    wache.observe(flaeche);
  });
}

function standortSheet(ctx, info) {
  const zustand = ctx.ui.standort || {};
  const schritt = zustand.schritt || 'wahl';
  const kopf = (titel, unter) => `<div style="display:flex;align-items:center;gap:11px">
<span style="width:38px;height:38px;border-radius:12px;background:var(--paper);display:flex;align-items:center;justify-content:center;flex:none">${standortPinSvg}</span>
<span style="display:flex;flex-direction:column;gap:1px;min-width:0">
<span style="font-family:'Bricolage Grotesque',sans-serif;font-size:20px;font-weight:650">${esc(titel)}</span>
<span style="font-size:11.5px;color:var(--muted);white-space:nowrap;overflow:hidden;text-overflow:ellipsis">${esc(unter)}</span>
</span>
</div>`;
  const empfaenger = info.kind === 'crew'
    ? tn(info.crew.memberIds.length, 'einmalig an {n} Mitglied von {name}', 'einmalig an {n} Mitglieder von {name}', { name: info.crew.name })
    : (info.kind === 'meet' ? tn(meetRoomOthers(ctx, info.meet).length + 1, 'einmalig an {n} teilnehmende Person', 'einmalig an {n} Teilnehmende') : (info.person?.name ? t('einmalig an {name}', { name: info.person.name }) : t('einmalig an diesen Raum')));

  if (schritt === 'karte') {
    // Runde 3 (K5): die echte, bedienbare Karte. Die Nadel steht fest in der Mitte, bewegt wird
    // die Karte darunter — gewählt ist, was unter der Nadel liegt (karteVon(...).getCenter()).
    return sheet(`<div style="display:flex;flex-direction:column;gap:13px;font-family:'Instrument Sans',sans-serif">
${kopf(t('Auf Karte wählen'), t('Karte bewegen — der Pin bleibt in der Mitte'))}
<div style="position:relative;height:380px;border-radius:14px;overflow:hidden;background:var(--field);flex:none">
<div data-fremd="1" data-role="standort-wahlkarte" style="position:absolute;inset:0"></div>
${standortNadel(true)}
</div>
<button data-act="loc-map-confirm" style="border:0;border-radius:999px;padding:14px 0;background:var(--green);cursor:pointer;appearance:none;font-family:'Instrument Sans',sans-serif"><span style="pointer-events:none;font:650 14px/1 'Instrument Sans',sans-serif;color:var(--on-accent)">${t('Diesen Ort wählen')}</span></button>
</div>`, { closeAct: 'loc-close', scrollKey: 'raum-standort' });
  }

  if (schritt === 'bestaetigen') {
    const ort = zustand.ort || {};
    // Runde 3 (K5): Wo die Ortsabfrage einen Namen findet („Kornmarktstraße 3"), steht er
    // oben; die Herkunft (aktuell/auf der Karte) rückt in die Zeile darunter.
    const quelle = ort.quelle === 'aktuell' ? t('Aktueller Standort') : t('Auf der Karte gewählt');
    const bezeichnung = ort.name || quelle;
    const unter = ort.name ? [ort.address, quelle].filter(Boolean).join(' · ') : koordinatenText(ort);
    return sheet(`<div style="display:flex;flex-direction:column;gap:13px;font-family:'Instrument Sans',sans-serif">
${kopf(t('Standort senden?'), empfaenger)}
${standortKartenFlaeche('standort-vorschau', ort, 170)}
<div style="display:flex;flex-direction:column;gap:2px">
<span data-role="standort-bezeichnung" style="font-size:14px;font-weight:650">${esc(bezeichnung)}</span>
<span style="font-size:12px;color:var(--muted);font-variant-numeric:tabular-nums">${esc(unter)}</span>
</div>
<span style="font-size:11.5px;color:var(--muted);line-height:1.45">${t('Einmalige Freigabe. Crew sendet danach keine weitere Position und ortet dich nicht im Hintergrund.')}</span>
<div style="display:flex;gap:8px">
<button data-act="loc-back" style="flex:1;border:1.5px solid var(--ink-a14);background:var(--surface);color:var(--ink-soft);font:650 14px/1 'Instrument Sans',sans-serif;padding:13px 0;border-radius:999px;cursor:pointer;appearance:none"><span style="pointer-events:none">${t('Zurück')}</span></button>
<button data-act="loc-send" style="flex:1;background:var(--green);border:0;color:var(--on-accent);font:650 14px/1 'Instrument Sans',sans-serif;padding:14px 0;border-radius:999px;cursor:pointer;appearance:none"><span style="pointer-events:none">${t('Senden')}</span></button>
</div>
</div>`, { closeAct: 'loc-close', scrollKey: 'raum-standort' });
  }

  const zeile = (act, svg, label, sub, last) => `<button data-act="${act}" style="display:flex;align-items:center;gap:11px;padding:13px 2px;border:0;${last ? '' : 'border-bottom:1px solid var(--ink-a06);'}background:transparent;width:100%;text-align:left;cursor:pointer;appearance:none;font-family:'Instrument Sans',sans-serif">
<span style="width:34px;height:34px;border-radius:11px;background:var(--paper);display:flex;align-items:center;justify-content:center;flex:none;pointer-events:none">${svg}</span>
<span style="display:flex;flex-direction:column;gap:1px;pointer-events:none;min-width:0;flex:1">
<span style="font-size:14px;font-weight:650;color:var(--ink)">${esc(label)}</span>
<span style="font-size:11.5px;color:var(--muted)">${esc(sub)}</span></span>
<span style="pointer-events:none;display:flex">${rowChevron}</span>
</button>`;
  const hinweis = zustand.fehler
    ? `<div style="background:var(--paper-soft);border:1px solid var(--orange-a32);border-radius:14px;padding:10px 12px;font-size:12px;color:var(--ink-soft);line-height:1.4">${esc(zustand.fehler)}</div>`
    : '';
  return sheet(`<div style="display:flex;flex-direction:column;gap:11px;font-family:'Instrument Sans',sans-serif">
${kopf(t('Standort teilen'), empfaenger)}
${hinweis}
<div style="display:flex;flex-direction:column">
${zeile('loc-current', zielKreuzSvg, t('Aktueller Standort'), zustand.laeuft ? t('Freigabe wird abgefragt …') : t('fragt jetzt nach Freigabe'))}
${zeile('loc-map', standortPinSvg, t('Auf Karte wählen'), t('ohne Standortfreigabe'), true)}
</div>
</div>`, { closeAct: 'loc-close', scrollKey: 'raum-standort' });
}

// --- Meet-Panel (07.2/07.3 + Board „07 Panel-Zustände"): EIN schwebendes Panel ---

// v6 A18b: Wer als Gastgeber:in vorgeschlagen wurde, entscheidet das selbst — und zwar
// dort, wo das Meet besprochen wird. Vor der Zustimmung steht hier bewusst keine Adresse;
// die Anfrage nennt nur, wer fragt und worum es geht.
function placeRequestCard(ctx, meet) {
  const { repo } = ctx;
  const offen = repo.getPlaceRequests({ meetId: meet.id, status: 'open' });
  if (!offen.length) return '';
  const anfrage = offen[0];

  if (anfrage.hostId === ME) {
    const fragende = repo.getPerson(anfrage.requesterId);
    const name = fragende?.name || t('Jemand');
    const knopf = (act, label, aussehen) => `<button data-act="${act}" data-request="${esc(anfrage.id)}" style="flex:1;${aussehen};border-radius:999px;padding:11px 0;font:650 13.5px 'Instrument Sans',sans-serif;cursor:pointer;appearance:none;box-sizing:border-box"><span style="pointer-events:none">${label}</span></button>`;
    return `<div data-role="place-request" style="background:var(--paper-soft);border:1px solid var(--orange-a32);border-radius:14px;padding:11px 12px;display:flex;flex-direction:column;gap:9px">
<div style="display:flex;flex-direction:column;gap:2px">
<span style="font-size:13px;font-weight:650;color:var(--ink)">${t('Meet bei dir?')}</span>
<span style="font-size:12px;color:var(--ink-soft);line-height:1.35">${t('{name} fragt, ob {titel} bei dir stattfinden kann. Deine Adresse sehen die anderen erst, wenn du zustimmst.', { name: esc(name), titel: esc(meet.title) })}</span>
</div>
<div style="display:flex;gap:8px">
${knopf('place-accept', t('Ja, bei mir'), 'background:var(--green);color:var(--on-accent);border:1.5px solid var(--green-dark)')}
${knopf('place-decline', t('Lieber nicht'), 'background:var(--surface);color:var(--ink);border:1.5px solid var(--ink-a18)')}
</div>
</div>`;
  }

  // Die andere Seite derselben Anfrage: ruhig, ohne Adresse und ohne erfundene Nachricht.
  const gastgeber = repo.getPerson(anfrage.hostId);
  return `<div data-role="place-pending" style="display:flex;align-items:center;gap:8px;background:var(--paper-soft);border:1px solid var(--orange-a28);border-radius:14px;padding:10px 12px">
<span style="width:7px;height:7px;border-radius:50%;background:var(--orange);flex:none"></span>
<span style="font-size:12px;color:var(--ink-soft);line-height:1.35">${gastgeber?.name ? t('Ort angefragt bei {name} — Zustimmung steht noch aus.', { name: esc(gastgeber.name) }) : t('Ort angefragt bei der Person — Zustimmung steht noch aus.')}</span>
</div>`;
}

// v7 spec/04 §4 / A20a: Ist genau ein Feld offen, trägt GENAU DIESES Feld den warmen
// Vorschlagsstatus. Welches Feld das ist, entscheidet dieselbe Regel wie im Abstimmblock:
// das Feld mit den meisten Vorschlägen.
function offeneVarianteArt(meet) {
  if (!meet || meet.status === 'active' || meet.status === 'done') return null;
  const arten = [...new Set((meet.variants || []).map((variant) => variant.kind))];
  if (!arten.length) return null;
  return arten.sort((a, b) => meet.variants.filter((v) => v.kind === b).length
    - meet.variants.filter((v) => v.kind === a).length)[0];
}

const VORSCHLAG_ORANGE = 'var(--orange-dark)';
const VORSCHLAG_FLAECHE = 'var(--orange-dark-a10)';

// Runde 8 (R8-27): Im Panel steht über „Liste | Umfragen" nur noch EIN Knopf, „Anreise planen"
// (ui/mitfahren.js anreiseKnopf). Der frühere aufklappbare Block mit eigener Scrollfläche und
// gemessener Höhe ist weg — geplant wird auf der eigenen Seite „Anreise".

function panelArea(ctx, info, meet) {
  const { ui } = ctx;
  const active = meet.status === 'active';
  const offeneArt = offeneVarianteArt(meet);
  const zeitOffen = offeneArt === 'time';
  const aktivitaetOffen = offeneArt === 'activity';
  // Runde 4 (F2): Ein als „Jetzt" angelegtes Meet zeigt „Jetzt", nicht die Uhrzeit des Anlegens.
  const zeitText = active
    ? `${esc(meetDateLabel(meet.date))} · ${t('seit {zeit}', { zeit: esc(meet.time) })}`
    : esc(terminText(meet, { datum: meetDateLabel }));
  // Die Zeitzeile ist bei offener Zeitvariante selbst das Bedienelement (A20c) und
  // trägt dann den warmen Status; sonst bleibt sie die ruhige Zeile wie bisher.
  const subtitle = zeitOffen
    ? `<span style="font-size:12px;font-weight:650;color:${VORSCHLAG_ORANGE};background:${VORSCHLAG_FLAECHE};border-radius:7px;padding:1px 7px;font-variant-numeric:tabular-nums;pointer-events:none">${zeitText} · ${t('offen')}</span>`
    : (active
      ? `<span style="font-size:12px;color:var(--green-dark);font-weight:600;font-variant-numeric:tabular-nums;pointer-events:none">${zeitText}</span>`
      : `<span style="font-size:12px;color:var(--ink-soft);font-variant-numeric:tabular-nums;pointer-events:none">${zeitText}</span>`);

  const derived = derivedBringEntries(ctx, info, meet);
  // Runde 5 (P4, E1): Mitfahrten stehen nicht mehr auf der Liste, sondern im Mitfahren darüber.
  const listItems = [...(meet.bring || []), ...derived];
  const listCount = listItems.length;
  const pollCount = (meet.polls || []).length;
  const listOpen = ui.panel === 'bring';
  const pollsOpen = ui.panel === 'polls';

  // v5 A15: Eine LEERE Kachel klappt nichts auf — sie fuehrt direkt in den
  // Erstellungsweg. Ein aufgeklappter leerer Kasten waere eine Flaeche ohne Inhalt.
  const tile = (panel, icon, label, open, leer = false) => `<button data-act="${leer ? 'panel-empty' : 'panel-toggle'}" data-panel="${panel}" data-treffer style="flex:1;background:var(--paper);border:0;border-radius:12px;padding:9px 11px;display:flex;align-items:center;gap:7px;min-width:0;cursor:pointer;appearance:none;font-family:'Instrument Sans',sans-serif;color:var(--ink);text-align:left">
<span style="pointer-events:none;display:flex">${icon}</span>
<span style="font-size:12px;font-weight:650;flex:1;min-width:0;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;pointer-events:none">${label}</span>
<span style="pointer-events:none;display:flex">${tileChevron(open, open)}</span>
</button>`;

  // v7 A20c: Titel/Icon und Zeitzeile sind eigene Trefferflächen. Ist ihr Feld offen,
  // öffnet der Tap den kompakten Abstimmzustand im vorhandenen Sheet-Host (kein
  // Routenwechsel); sonst führt er wie bisher in die Meet-Details.
  const feldAkt = (offen) => (offen ? 'variant-pick' : 'open-meet');
  const knopfBasis = 'border:0;background:transparent;padding:0;cursor:pointer;appearance:none;font-family:\'Instrument Sans\',sans-serif;color:var(--ink);text-align:left';
  const iconFlaeche = aktivitaetOffen
    ? `background:${VORSCHLAG_FLAECHE};box-shadow:inset 0 0 0 1.5px var(--orange-dark-a34)`
    : 'background:var(--paper)';
  const titelStil = aktivitaetOffen
    ? `font-size:14.5px;font-weight:650;letter-spacing:-.01em;color:${VORSCHLAG_ORANGE};white-space:nowrap;overflow:hidden;text-overflow:ellipsis;pointer-events:none`
    : 'font-size:14.5px;font-weight:650;letter-spacing:-.01em;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;pointer-events:none';

  // Runde 3: Der Verlauf läuft absichtlich unter dem Panel durch (v7 A41). Mit den Vorschlägen
  // unter Nachrichten landete dabei ein „Rückgängig" unter der Karte, und der Kontroll-Sweep
  // hielt das Panel für eine Phantomfläche. z-index 10 wirkt nur innerhalb der Panel-Ebene
  // (eigener Stapel, z 4 — unter Kopf, Composer und Sheets): optisch ändert sich nichts, die
  // Karte ist aber ausdrücklich die bewusste Deckebene über dem Verlauf.
  return `<div style="flex:none;padding:12px 20px 0;pointer-events:none">
<div data-role="raum-panel-karte" style="position:relative;z-index:10;pointer-events:auto;background:var(--surface);border:1px solid var(--ink-a10);border-radius:18px;box-shadow:0 8px 20px var(--shadow-12);padding:12px;display:flex;flex-direction:column;gap:10px">
<div data-leiste style="display:flex;align-items:center;gap:10px;width:100%">
<button data-act="${feldAkt(aktivitaetOffen)}" data-kind="activity" data-meet="${esc(meet.id)}" data-treffer aria-label="${esc(aktivitaetOffen ? t('Aktivität abstimmen') : t('Meet öffnen'))}" style="${knopfBasis};width:34px;height:34px;border-radius:11px;${iconFlaeche};display:flex;align-items:center;justify-content:center;flex:none"><span style="pointer-events:none;display:flex">${activityIconSvg(meet, aktivitaetOffen ? VORSCHLAG_ORANGE : 'var(--ink)', 17)}</span></button>
<span style="display:flex;flex-direction:column;gap:2px;flex:1;min-width:0;align-items:flex-start">
<button data-act="${feldAkt(aktivitaetOffen)}" data-kind="activity" data-meet="${esc(meet.id)}" style="${knopfBasis};max-width:100%;min-width:0"><span style="${titelStil}">${esc(meet.title)}</span></button>
<button data-act="${feldAkt(zeitOffen)}" data-kind="time" data-meet="${esc(meet.id)}" style="${knopfBasis};max-width:100%;min-width:0;display:flex">${subtitle}</button>
</span>
<button data-act="open-meet" data-meet="${esc(meet.id)}" data-leiste-ziel aria-label="${esc(t('Meet öffnen'))}" style="${knopfBasis};display:flex;flex:none"><span style="pointer-events:none;display:flex">${panelChevronRight}</span></button>
</div>
${placeRequestCard(ctx, meet)}
${participationSection(ctx, meet, { compact: true, bare: true })}
<div style="display:flex;flex-direction:column;gap:8px">
${anreiseKnopf(ctx, meet, { kompakt: true })}
<div style="display:flex;gap:8px">
${tile('bring', listCheckSvg, t('Liste · {n}', { n: listCount }), listOpen, listCount === 0)}
${tile('polls', pollBarsSvg(), t('Umfragen · {n}', { n: pollCount }), pollsOpen, pollCount === 0)}
</div>
${listOpen ? listBox(ctx, listItems) : ''}
${pollsOpen ? pollBox(ctx, meet) : ''}
</div>
</div>
</div>`;
}

// R6 D6 — Die Bewertungs-Frage an der Stelle der Meet-Box.
//
// Sie steht in derselben Bauform wie das Panel (Karte auf der festen Ebene über dem Verlauf),
// trägt links das Zeichen der Aktivität und rechts die drei Stufen aus dem gemeinsamen
// Baustein. Sie kommt nur, wenn hier nichts zu planen ist — so konkurriert sie nie mit einem
// laufenden oder kommenden Meet. Ein Tipp auf ✕ nimmt sie dauerhaft weg.
function raumBewertungsBox(ctx, meet) {
  const zeile = bewertungsZeile(ctx, meet, { variante: 'blank', titel: false });
  if (!zeile) return '';
  return `<div style="flex:none;padding:12px 20px 0;pointer-events:none">
<div data-role="raum-bewertung-karte" data-meet="${esc(meet.id)}" style="position:relative;z-index:10;pointer-events:auto;background:var(--surface);border:1px solid var(--ink-a10);border-radius:18px;box-shadow:0 8px 20px var(--shadow-12);padding:8px 10px 8px 12px;display:flex;align-items:center;gap:10px">
<button data-act="open-meet" data-meet="${esc(meet.id)}" aria-label="${esc(t('Meet öffnen'))}" style="width:34px;height:34px;border-radius:11px;background:var(--paper);border:0;padding:0;display:flex;align-items:center;justify-content:center;flex:none;cursor:pointer;appearance:none"><span style="pointer-events:none;display:flex">${activityIconSvg(meet, 'var(--ink)', 17)}</span></button>
${zeile}
</div>
</div>`;
}

// Offene Variante: die Hauptkachel zeigt NUR das betroffene Feld mit Optionen,
// Stimmen und „+ Vorschlag" — das Original bleibt sichtbar und wählbar (Board 07).
function variantBlocks(ctx, meet, options = {}) {
  if (meet.status === 'active' || meet.status === 'done') return '';
  // Genau EIN betroffenes Feld (Board „07 Panel-Zustände") — bei mehreren offenen
  // Feldern das mit den meisten Vorschlägen. options.art wählt ausdrücklich das Feld,
  // das im Panel markiert und angetippt wurde.
  const allKinds = [...new Set((meet.variants || []).map((variant) => variant.kind))];
  const kinds = (options.art && allKinds.includes(options.art) ? [options.art] : allKinds)
    .sort((a, b) => meet.variants.filter((v) => v.kind === b).length - meet.variants.filter((v) => v.kind === a).length)
    .slice(0, 1);
  return kinds.map((kind) => {
    const variants = meet.variants.filter((variant) => variant.kind === kind);
    const groups = participationGroups(ctx.repo, meet);
    const votedIds = new Set(variants.flatMap((variant) => variant.votes));
    const originalVotes = groups.yes.filter((person) => !votedIds.has(person.id)).length;
    const iVotedVariant = variants.find((variant) => variant.votes.includes(ME));
    const iOnOriginal = !iVotedVariant && (meet.participation?.[ME] === 'yes');
    const total = Math.max(1, originalVotes + variants.reduce((sum, variant) => sum + variant.votes.length, 0));

    const bar = (label, votes, mine, act, data) => {
      const share = Math.max(12, Math.round((votes / total) * 100));
      const surface = mine ? 'background:var(--green-tint)' : 'background:var(--paper)';
      const fill = mine ? 'background:var(--green-a22)' : 'background:var(--field)';
      const color = mine ? 'var(--green-dark)' : 'var(--ink-soft)';
      const attrs = act ? `data-act="${act}" ${Object.entries(data || {}).map(([k, v]) => `data-${k}="${esc(v)}"`).join(' ')}` : '';
      const tag = act ? 'button' : 'div';
      return `<div style="display:flex;align-items:center;gap:8px">
<${tag} ${attrs} style="flex:1;min-width:0;height:30px;border-radius:10px;${surface};position:relative;overflow:hidden;border:0;padding:0;cursor:${act ? 'pointer' : 'default'};appearance:none;font-family:'Instrument Sans',sans-serif;text-align:left">
<span style="position:absolute;inset:0;width:${share}%;${fill};pointer-events:none"></span>
<span style="position:absolute;left:11px;top:7px;right:8px;font-size:12px;font-weight:650;color:${color};white-space:nowrap;overflow:hidden;text-overflow:ellipsis;pointer-events:none">${label}${mine ? ' ✓' : ''}</span>
</${tag}>
<span style="font-size:12px;font-weight:650;color:${mine ? 'var(--green-dark)' : 'var(--muted)'};font-variant-numeric:tabular-nums;flex:none">${votes}</span>
</div>`;
    };

    const originalLabel = kind === 'activity'
      ? `${esc(meet.title)} · ${t('Original')}`
      : `${esc(terminText(meet, { datum: meetDateLabel }))} · ${t('Original')}`;
    const originalBar = bar(
      originalLabel, originalVotes, iOnOriginal,
      iVotedVariant ? 'variant-vote' : null, iVotedVariant ? { variant: iVotedVariant.id } : null,
    );
    const variantBars = variants.map((variant) => {
      const label = variant.kind === 'activity'
        ? esc(vorschlagTitel(variant, meet))
        : esc(terminText(variant, { datum: meetDateLabel }));
      return bar(label, variant.votes.length, variant.votes.includes(ME), 'variant-vote', { variant: variant.id });
    }).join('');

    const heading = kind === 'activity'
      ? tn(variants.length + 1, 'Aktivität · {n} Vorschlag', 'Aktivität · {n} Vorschläge')
      : tn(variants.length + 1, 'Zeit · {n} Vorschlag', 'Zeit · {n} Vorschläge');
    return `<div style="display:flex;flex-direction:column;gap:7px;border-top:1px solid var(--ink-a07);padding-top:10px">
<div style="display:flex;justify-content:space-between;align-items:center;gap:8px"><span style="font-size:10px;font-weight:650;letter-spacing:.07em;text-transform:uppercase;color:var(--orange-dark)">${heading}</span><span style="font-size:10.5px;color:var(--muted-light);flex:none">${t('nur dieses Feld offen')}</span></div>
${originalBar}
${variantBars}
<button data-act="variant-add" data-kind="${kind}" data-meet="${esc(meet.id)}" style="align-self:flex-start;border:1.5px dashed var(--ink-a18);border-radius:999px;padding:7px 12px;font:650 11.5px 'Instrument Sans',sans-serif;color:var(--ink-soft);background:transparent;cursor:pointer;appearance:none"><span style="pointer-events:none">${t('+ Vorschlag')}</span></button>
</div>`;
  }).join('');
}

// v7 A20b/A20c: Der Abstimminhalt steht NICHT mehr offen in der kompakten Raum-Meet-Box
// (dort wuchs sie um 145 px auf eine Poll-Wand), sondern in einem kompakten Zustand aus
// dem BESTEHENDEN Sheet-Host über dem Raum. Der Raum bleibt dabei stehen — kein
// Routenwechsel, kein zweites Overlay, kein Neuaufbau der Timeline.
function variantSheet(ctx, meet) {
  const art = ctx.ui.variantPick?.kind === 'activity' ? 'activity' : 'time';
  const titel = art === 'activity' ? t('Aktivität abstimmen') : t('Zeit abstimmen');
  const unter = t('Das Original bleibt wählbar. Deine Stimme ist jederzeit änderbar.');
  return sheet(`<div style="display:flex;flex-direction:column;gap:13px;font-family:'Instrument Sans',sans-serif">
<div style="display:flex;align-items:center;gap:11px">
<span style="width:38px;height:38px;border-radius:12px;background:${VORSCHLAG_FLAECHE};display:flex;align-items:center;justify-content:center;flex:none">${activityIconSvg(meet, VORSCHLAG_ORANGE, 18)}</span>
<span style="display:flex;flex-direction:column;gap:1px;min-width:0">
<span style="font-family:'Bricolage Grotesque',sans-serif;font-size:20px;font-weight:650">${esc(titel)}</span>
<span style="font-size:11.5px;color:var(--muted);white-space:nowrap;overflow:hidden;text-overflow:ellipsis">${esc(meet.title)}</span>
</span>
</div>
${variantBlocks(ctx, meet, { art })}
<span style="font-size:11.5px;color:var(--muted);line-height:1.4">${esc(unter)}</span>
</div>`, { closeAct: 'variant-close', scrollKey: 'raum-variante' });
}

// v4 D2-1: Die Teilnahme-Dreiteilung im Raum-Panel ist KEINE zweite, nur anzeigende
// Variante mehr. Es ist dieselbe participationSection wie in den Meet-Details — also
// zugleich der antippbare Zustand (data-act="set-part"), nur kompakt und ohne
// Kartenrahmen. Vorher waren es reine DIVs ohne data-act: Maus und Touch bewirkten nichts.

// Liste aufgeklappt: die Kacheln bleiben oben, die Einträge ziehen sich darunter über
// die ganze Breite — dieselbe beige Fläche, nur leichte Linien zwischen den Einträgen.
// v3.1 §7 / v5 A16b: Übernimmt jemand einen Punkt, ersetzt sein Profilbild den Haken.
// v5 dreht den Rest um: die Zeile zeigt NUR den Gegenstand — keine Statuswörter wie
// „Offen", „noch niemand" oder „Mira bringt’s". Wer übernommen hat, sagt das Profilbild;
// dass niemand übernommen hat, sagt der leere ORANGE Control — Orange lädt zum
// Übernehmen ein, Grün wäre schon Bestätigung.
// v6 A11a: Der offene Listenpunkt trug einen orangen HAKEN — ein Haken heißt „erledigt"
// und war damit die falsche Einladung. Jetzt steht dort eine ruhige, warme Geste: eine
// kleine offene Hand, die etwas annimmt. Kein Statuswort, keine grelle Fläche.
// Genau dieselbe Geste benutzt ui/meet-panels.js (bringTakerControl), damit dieselbe
// Liste im Raum und in den Meet-Details nicht unterschiedlich aussieht.
export function adoptGlyph(color = 'var(--orange-dark)', size = 13) {
  return `<svg width="${size}" height="${size}" viewBox="0 0 24 24" fill="none" style="flex:none"><path d="M8.6 11V5.6a1.5 1.5 0 0 1 3 0V11m0-.6V4.4a1.5 1.5 0 0 1 3 0V11m0-.4V6.4a1.5 1.5 0 0 1 3 0v6.4c0 4-2.4 6.6-5.7 6.6-2.2 0-3.6-1-4.7-2.8L5.9 13.4a1.5 1.5 0 0 1 2.6-1.5l1 1.7" stroke="${color}" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round"></path></svg>`;
}

function adoptControl(itemId, size = 22) {
  return `<button data-act="toggle-bring" data-item="${esc(itemId)}" aria-pressed="false" aria-label="${esc(t('Übernehmen'))}" style="width:${size}px;height:${size}px;border-radius:50%;border:1.5px solid var(--orange-dark-a34);background:var(--orange-dark-a08);box-sizing:border-box;display:flex;align-items:center;justify-content:center;flex:none;cursor:pointer;appearance:none;padding:0"><span style="pointer-events:none;display:flex">${adoptGlyph('var(--orange-dark)', Math.round(size * 0.62))}</span></button>`;
}

function listBox(ctx, items) {
  // Runde 3 (Jonathan, K4): „Wenn man noch keine Liste hat und auf ‚Liste' drückt, kommt
  // direkt das Slide-up zum Erstellen eines Listenpunkts — stattdessen erst die Liste öffnen,
  // sehen, dass es nichts gibt, und dort ‚Listenpunkt erstellen' wählen." Genau das steht hier.
  if (!items.length) {
    return `<div data-role="liste-leer" style="background:var(--paper);border-radius:12px;padding:12px;display:flex;flex-direction:column;align-items:flex-start;gap:10px">
<span style="font-size:12.5px;color:var(--muted);line-height:1.4">${t('Noch nichts auf der Liste — hier steht, wer was mitbringt.')}</span>
<button data-act="liste-erstellen" style="display:flex;align-items:center;gap:7px;border:0;background:var(--green-tint);color:var(--green-dark);font:650 12.5px/1 'Instrument Sans',sans-serif;padding:9px 14px 9px 11px;border-radius:999px;cursor:pointer;appearance:none"><span style="pointer-events:none;display:flex">${plus('var(--green-dark)', 12)}</span><span style="pointer-events:none">${t('Listenpunkt erstellen')}</span></button>
</div>`;
  }
  const check = (stroke) => `<svg width="11" height="11" viewBox="0 0 24 24" fill="none"><path d="m7.5 12.5 3 3 6-6.5" stroke="${stroke}" stroke-width="2.8" stroke-linecap="round" stroke-linejoin="round"></path></svg>`;
  // v6 A11b: KEINE lokale Initialenscheibe mehr. Das Profilbild kommt aus derselben
  // Komponente wie überall — nur so trägt es Goldring und Zeichen der Person.
  const settings = ctx.repo.getSettings();
  const face = (person) => personAvatar(person, { size: 22, fontSize: 8, marker: personMarker(person.id, settings) });

  const rows = items.map((item, index) => {
    const done = Boolean(item.done);
    const takenBy = item.takenBy || [];
    const mine = takenBy.includes(ME);
    const taker = takenBy.length ? ctx.repo.getPerson(takenBy[0]) : null;

    let meta;
    let control;
    if (done) {
      meta = '';
      control = `<span style="width:22px;height:22px;border-radius:50%;background:var(--field);display:flex;align-items:center;justify-content:center;flex:none">${check('var(--muted)')}</span>`;
    } else if (taker) {
      // Das Profilbild IST die Zustandsanzeige; daneben nur noch der Name.
      meta = '';
      control = mine
        ? `<button data-act="toggle-bring" data-item="${esc(item.id)}" aria-pressed="true" aria-label="${esc(t('Nicht mehr übernehmen'))}" style="border:0;background:transparent;padding:0;display:flex;flex:none;cursor:pointer;appearance:none;border-radius:50%;box-shadow:0 0 0 1.5px var(--green)"><span style="pointer-events:none;display:flex">${face(taker)}</span></button>`
        : `<span style="display:flex;flex:none;border-radius:50%;box-shadow:0 0 0 1.5px var(--green-a55)">${face(taker)}</span>`;
    } else {
      meta = '';
      control = adoptControl(item.id, 22);
    }

    return `<div style="display:flex;align-items:center;gap:6px;padding:10px 0;${index ? 'border-top:1px solid var(--ink-a07);' : ''}">
<span style="font-size:12.5px;font-weight:650;flex:none;max-width:130px;white-space:nowrap;overflow:hidden;text-overflow:ellipsis">${esc(item.label)}</span>
${meta}
<span style="flex:1"></span>
${control}
</div>`;
  }).join('');

  // Die Eingabezeile steht immer am Ende der offenen Liste — gleiche Grammatik wie in den
  // Meet-Details (bringSection). Ihr Text lebt in ui.bringDraft und überlebt damit jedes
  // Rerender (Stimme abgeben, Punkt übernehmen) und die Ü4-Nachfrage.
  const addRow = `<div style="display:flex;gap:8px;align-items:center;padding:10px 0;${items.length ? 'border-top:1px solid var(--ink-a07);' : ''}">
<input id="bring-input" value="${esc(ctx.ui.bringDraft || '')}" placeholder="${esc(t('Etwas hinzufügen'))}" maxlength="40" style="flex:1;min-width:0;border:1.5px dashed var(--ink-a18);border-radius:10px;padding:7px 11px;font:500 12px 'Instrument Sans',sans-serif;color:var(--ink);background:transparent;outline:none">
<button data-act="add-bring" aria-label="${esc(t('Hinzufügen'))}" style="width:24px;height:24px;border-radius:50%;background:var(--field);border:0;display:flex;align-items:center;justify-content:center;cursor:pointer;appearance:none;padding:0;flex:none"><span style="pointer-events:none;font-size:13px;font-weight:600;color:var(--ink)">+</span></button>
</div>`;
  return `<div style="background:var(--paper);border-radius:12px;padding:1px 12px">${rows}${addRow}</div>`;
}

// Umfragen aufgeklappt: genau eine Umfrage offen, dieselben Balken wie die Varianten.
function pollBox(ctx, meet) {
  const { ui } = ctx;
  const polls = meet.polls || [];
  // Runde 3 (K4): dieselbe Ordnung wie bei der Liste — erst sehen, dass es noch nichts gibt,
  // dann bewusst erstellen. Vorher sprang die leere Kachel direkt in das Erstellen-Sheet.
  if (!polls.length && !ui.pollForm) {
    return `<div data-role="umfragen-leer" style="background:var(--paper);border-radius:12px;padding:12px;display:flex;flex-direction:column;align-items:flex-start;gap:10px">
<span style="font-size:12.5px;color:var(--muted);line-height:1.4">${t('Noch keine Umfrage — hier stimmt ihr gemeinsam ab.')}</span>
<button data-act="umfrage-erstellen" style="display:flex;align-items:center;gap:7px;border:0;background:var(--green-tint);color:var(--green-dark);font:650 12.5px/1 'Instrument Sans',sans-serif;padding:9px 14px 9px 11px;border-radius:999px;cursor:pointer;appearance:none"><span style="pointer-events:none;display:flex">${plus('var(--green-dark)', 12)}</span><span style="pointer-events:none">${t('Umfrage erstellen')}</span></button>
</div>`;
  }
  const openId = ui.openPoll || polls[0]?.id;

  const blocks = polls.map((poll, index) => {
    const border = index ? 'border-top:1px solid var(--ink-a07);' : '';
    const total = poll.options.reduce((sum, option) => sum + option.votes.length, 0);
    if (poll.id !== openId) {
      // §9: erst border:0 (sonst bleibt der dunkle Button-Standardrahmen als Linie stehen),
      // dann die eine gewollte Hairline zwischen gestapelten Umfragen.
      return `<button data-act="room-poll-open" data-poll="${esc(poll.id)}" style="display:flex;align-items:center;gap:6px;padding:10px 0;width:100%;border:0;${border}background:transparent;cursor:pointer;appearance:none;font-family:'Instrument Sans',sans-serif;color:var(--ink);text-align:left">
<span style="font-size:12px;font-weight:650;flex:1;min-width:0;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;pointer-events:none">${esc(poll.question)}</span>
<span style="font-size:10.5px;color:var(--muted);font-variant-numeric:tabular-nums;flex:none;pointer-events:none">${total} ›</span>
</button>`;
    }
    const bars = poll.options.map((option) => {
      const mine = option.votes.includes(ME);
      const share = total ? Math.max(12, Math.round((option.votes.length / total) * 100)) : 0;
      return `<div style="display:flex;align-items:center;gap:7px">
<button data-act="vote-poll" data-poll="${esc(poll.id)}" data-option="${esc(option.id)}" style="flex:1;min-width:0;height:26px;border-radius:8px;background:${mine ? 'var(--green-tint)' : 'var(--field)'};position:relative;overflow:hidden;border:0;padding:0;cursor:pointer;appearance:none;font-family:'Instrument Sans',sans-serif;text-align:left">
<span style="position:absolute;inset:0;width:${share}%;background:${mine ? 'var(--green-a22)' : 'var(--ink-a06)'};pointer-events:none"></span>
<span style="position:absolute;left:9px;top:6px;right:6px;font-size:11px;font-weight:650;color:${mine ? 'var(--green-dark)' : 'var(--ink-soft)'};white-space:nowrap;overflow:hidden;text-overflow:ellipsis;pointer-events:none">${esc(option.label)}${mine ? ' ✓' : ''}</span>
</button>
<span style="font-size:11px;font-weight:650;color:${mine ? 'var(--green-dark)' : 'var(--muted)'};font-variant-numeric:tabular-nums;flex:none">${option.votes.length}</span>
</div>`;
    }).join('');
    return `<div style="display:flex;flex-direction:column;gap:7px;padding:10px 0;${border}">
<div style="display:flex;justify-content:space-between;align-items:baseline;gap:6px"><span style="font-size:12px;font-weight:650;min-width:0;white-space:nowrap;overflow:hidden;text-overflow:ellipsis">${esc(poll.question)}</span><span style="font-size:10.5px;color:var(--muted);font-variant-numeric:tabular-nums;flex:none">${tn(total, '{n} Stimme', '{n} Stimmen')}</span></div>
${bars}
</div>`;
  }).join('');

  const draft = ui.pollDraft || {};
  const form = ui.pollForm
    ? `<div style="display:flex;flex-direction:column;gap:7px;padding:10px 0;${polls.length ? 'border-top:1px solid var(--ink-a07);' : ''}">
<input id="poll-q" value="${esc(draft.q || '')}" placeholder="${esc(t('Frage'))}" maxlength="60" style="border:1px solid var(--ink-a12);border-radius:10px;padding:8px 11px;font:500 12px 'Instrument Sans',sans-serif;color:var(--ink);background:var(--surface);outline:none">
<input id="poll-o1" value="${esc(draft.a || '')}" placeholder="${esc(t('Option {n}', { n: 1 }))}" maxlength="40" style="border:1px solid var(--ink-a12);border-radius:10px;padding:8px 11px;font:500 12px 'Instrument Sans',sans-serif;color:var(--ink);background:var(--surface);outline:none">
<input id="poll-o2" value="${esc(draft.b || '')}" placeholder="${esc(t('Option {n}', { n: 2 }))}" maxlength="40" style="border:1px solid var(--ink-a12);border-radius:10px;padding:8px 11px;font:500 12px 'Instrument Sans',sans-serif;color:var(--ink);background:var(--surface);outline:none">
<button data-act="add-poll" style="align-self:flex-end;background:var(--ink);color:var(--on-ink);border-radius:999px;padding:8px 14px;font:650 12px 'Instrument Sans',sans-serif;border:0;cursor:pointer;appearance:none"><span style="pointer-events:none">${t('Hinzufügen')}</span></button>
</div>`
    : `<div style="padding:10px 0;${polls.length ? 'border-top:1px solid var(--ink-a07);' : ''}">
<button data-act="toggle-add-poll" style="border:1.5px dashed var(--ink-a18);border-radius:999px;padding:7px 12px;font:650 11.5px 'Instrument Sans',sans-serif;color:var(--ink-soft);background:transparent;cursor:pointer;appearance:none"><span style="pointer-events:none">${t('+ Umfrage')}</span></button>
</div>`;

  return `<div style="background:var(--paper);border-radius:12px;padding:1px 12px">${blocks}${form}</div>`;
}

// --- Chat ---

// Nachrichtenkörper — KEINE eigene Scrollfläche: Panel und Chat teilen sich die eine
// Scrollfläche des Scaffolds (§1). Oben blendet der Header-Fade weich aus, unten der
// bottomFade vor dem Composer.
// v6 A09b: Eine freie Raum-Umfrage gehört keinem Meet. Sie steht deshalb über dem Verlauf
// und trägt dieselben Balken wie die Umfrage im Meet-Panel — dieselbe Sache, dieselbe Form.
function roomPollCards(ctx, roomId) {
  const umfragen = ctx.repo.getRoomPolls(roomId);
  if (!umfragen.length) return '';
  const karten = umfragen.map((poll) => {
    const gesamt = poll.options.reduce((summe, option) => summe + option.votes.length, 0);
    const balken = poll.options.map((option) => {
      const meine = option.votes.includes(ME);
      const anteil = gesamt ? Math.round((option.votes.length / gesamt) * 100) : 0;
      return `<div style="display:flex;align-items:center;gap:7px">
<button data-act="vote-room-poll" data-poll="${esc(poll.id)}" data-option="${esc(option.id)}" style="flex:1;min-width:0;height:26px;border-radius:8px;background:${meine ? 'var(--green-tint)' : 'var(--field)'};position:relative;overflow:hidden;border:0;padding:0;cursor:pointer;appearance:none;font-family:'Instrument Sans',sans-serif;text-align:left">
<span style="position:absolute;inset:0;width:${anteil}%;background:${meine ? 'var(--green-a22)' : 'var(--ink-a06)'};pointer-events:none"></span>
<span style="position:absolute;left:9px;top:6px;right:6px;font-size:11px;font-weight:650;color:${meine ? 'var(--green-dark)' : 'var(--ink-soft)'};white-space:nowrap;overflow:hidden;text-overflow:ellipsis;pointer-events:none">${esc(option.label)}${meine ? ' ✓' : ''}</span>
</button>
<span style="font-size:11px;font-weight:650;color:${meine ? 'var(--green-dark)' : 'var(--muted)'};font-variant-numeric:tabular-nums;flex:none">${option.votes.length}</span>
</div>`;
    }).join('');
    return `<div data-role="room-poll" style="background:var(--paper);border-radius:12px;padding:11px 12px;display:flex;flex-direction:column;gap:7px">
<div style="display:flex;justify-content:space-between;align-items:baseline;gap:6px"><span style="font-size:12px;font-weight:650;min-width:0;white-space:nowrap;overflow:hidden;text-overflow:ellipsis">${esc(poll.question)}</span><span style="font-size:10.5px;color:var(--muted);font-variant-numeric:tabular-nums;flex:none">${tn(gesamt, '{n} Stimme', '{n} Stimmen')}</span></div>
${balken}
</div>`;
  }).join('');
  return karten;
}

function chatBody(ctx, info, panelMeet) {
  const { ui } = ctx;
  const derived = derivedBringEntries(ctx, info, panelMeet);
  const adoptionByMessage = new Map(derived.map((entry) => [entry.messageId, entry]));
  // Bereits real übernommene Einträge (gleiches Label) zeigen den Chip ebenfalls.
  for (const message of info.room.messages) {
    if (message.kind !== 'text' || adoptionByMessage.has(message.id) || loeschenVorgemerkt(info.room.id, message.id)) continue;
    const label = bringAdoptionLabel(message.text);
    if (!label || (ctx.ui.undoneAdoptions || {})[message.id]) continue;
    const item = (panelMeet?.bring || []).find((entry) => entry.label.toLowerCase() === label.toLowerCase());
    if (item) adoptionByMessage.set(message.id, { label, takenBy: item.takenBy.length ? item.takenBy : [message.authorId] });
  }

  // v7 spec/08 §4 und §5: EINE Timeline trägt Textnachrichten UND strukturierte
  // Ereignisse (Anstupsen, Standort) in ihrer echten zeitlichen Reihenfolge. Vorher
  // filterte diese Stelle hart auf kind === 'text' und warf damit jeden strukturierten
  // Datensatz aus dem Verlauf (der Anstupser landete als schwebende Karte im Bottom-Layer).
  // Runde 3 (K3): Unter einer Nachricht steht höchstens EIN Vorschlag — welche und wie selten,
  // regelt raumHinweise. Die Listen-Übernahme („Ich bring … mit") geht weiterhin vor.
  const hinweise = raumHinweise(ctx, info, panelMeet);
  const messages = info.room.messages.map((message) => {
    if (loeschenVorgemerkt(info.room.id, message.id)) return geloeschtPlatzhalter(info.room.id, message);
    // Runde 8 (R8-8): Alte Anstupser („Hast du Zeit?") stehen nicht mehr im Verlauf — sie sind
    // keine Nachrichten, und die Frage gibt es nicht mehr. `kind !== 'text'` blendet sie aus.
    if (message.kind === 'location') return standortEintrag(ctx, message);
    if (message.kind !== 'text') return '';
    const adoption = adoptionByMessage.get(message.id);
    const hinweis = adoption ? null : hinweise.get(message.id);
    return renderMessage(ctx, message, { adoption, hinweis });
  }).join('');

  return `<div style="display:flex;flex-direction:column;gap:10px;padding:14px 20px 4px">
${roomPollCards(ctx, info.room.id)}
${messages}
</div>`;
}

function renderMessage(ctx, message, extras = {}) {
  const own = message.authorId === ME;
  const adoptionChip = extras.adoption ? adoptionChipHtml(ctx, message, extras.adoption) : '';
  const suggestChip = extras.hinweis ? hinweisChipHtml(message, extras.hinweis, own) : '';

  // Runde 4 (E8): Jede Nachricht trägt data-nachricht — langes Drücken öffnet ihr Menü. Solange
  // es offen ist, hebt sich die Blase leicht ab, damit klar ist, welche gemeint ist.
  const gedrueckt = ctx.ui.nachrichtMenue?.id === message.id ? ';box-shadow:0 0 0 2px var(--ink-a14),0 8px 20px var(--shadow-12)' : '';
  if (own) {
    const bubble = `<div data-nachricht="${esc(message.id)}" data-eigen="1" style="display:flex;gap:8px;align-items:flex-end;justify-content:flex-end"><div data-blase="1" style="background:var(--green-tint);border-radius:16px 16px 5px 16px;padding:9px 13px;font-size:13.5px;color:var(--green-dark);max-width:240px;overflow-wrap:break-word${gedrueckt}">${chatText(message.text)}</div></div>`;
    if (!adoptionChip && !suggestChip) return bubble;
    return `<div style="display:flex;flex-direction:column;gap:5px;align-items:flex-end">${bubble}${adoptionChip}${suggestChip}</div>`;
  }
  // v7 spec/08 §1: keine lokale Avatar-Nachbildung mehr — die Chatblase liest dieselbe
  // Primitive wie jede andere Fläche und zeigt damit dasselbe kanonische Profilbild.
  const avatar = nachrichtBild(ctx, ctx.repo.getPerson(message.authorId));
  // T6 / Runde 4 (E8): Melden bleibt eine Geste ohne sichtbaren Knopf — aber erst nach bewusstem
  // Halten, und über das kleine Menü statt direkt als Sheet.
  const bubble = `<div data-nachricht="${esc(message.id)}" data-person="${esc(message.authorId)}" style="display:flex;gap:8px;align-items:flex-end">${avatar}<div data-blase="1" style="background:var(--surface);border:1px solid var(--ink-a07);border-radius:16px 16px 16px 5px;padding:9px 13px;font-size:13.5px;max-width:240px;overflow-wrap:break-word${gedrueckt}">${chatText(message.text)}</div></div>`;
  if (!adoptionChip && !suggestChip) return bubble;
  return `<div style="display:flex;flex-direction:column;gap:5px">${bubble}<div style="margin-left:34px;display:flex;flex-direction:column;gap:5px;align-items:flex-start">${adoptionChip}${suggestChip}</div></div>`;
}

// Runde 8 (R8-17, Jonathan): Ein Tipp auf das Bild neben einer Nachricht öffnet die Person —
// dieselbe Seite wie ein Tipp auf den Namen im Kopf eines 1:1-Chats. Das Bild sieht aus wie
// vorher (26 px); die Trefferfläche ist über data-treffer 46 px groß. Langes Drücken auf das Bild
// öffnet NICHT das Nachrichtenmenü (bindNachrichtMenue) — das Bild ist keine Nachricht.
function nachrichtBild(ctx, author) {
  if (!author) return '';
  return `<button data-act="nachricht-person" data-person="${esc(author.id)}" data-role="nachricht-bild" data-treffer aria-label="${esc(author.name || '')}" style="display:flex;flex:none;border:0;background:transparent;padding:0;cursor:pointer;appearance:none;border-radius:50%"><span style="display:flex;pointer-events:none">${personAvatar(author, { size: 26, fontSize: 10, marker: personMarker(author.id, ctx.repo.getSettings()) })}</span></button>`;
}

// v4 D2-2 / COMPONENT_RULES 5: „Übernommener Mitbringenpunkt zeigt Avatar statt
// generischem Haken." Die Chat-Quittung zeigt deshalb dasselbe Profilbild wie die Liste
// und das Panel (listBox/bringTakerControl) — den generischen grünen Haken gibt es hier
// nicht mehr. Nur wenn die Person nicht auflösbar ist, bleibt eine neutrale Scheibe.
function adoptionChipHtml(ctx, message, adoption) {
  const taker = ctx.repo.getPerson((adoption.takenBy || [])[0]);
  const who = taker ? (taker.id === ME ? t('Du bringst’s') : t('{name} bringt’s', { name: taker.name })) : t('übernommen');
  // v7 spec/08 §1: dieselbe Primitive wie Liste und Panel — echtes Profilbild statt
  // lokal gezeichneter Initialenscheibe.
  const face = taker
    ? `<span style="display:flex;flex:none;border-radius:50%;box-shadow:0 0 0 1.5px var(--green-a55)">${personAvatar(taker, { size: 20, fontSize: 7.5, marker: personMarker(taker.id, ctx.repo.getSettings()), compact: true })}</span>`
    : `<span style="width:20px;height:20px;border-radius:50%;background:var(--field);flex:none"></span>`;
  return `<span style="background:var(--green-tint);border:1.5px solid var(--green-a40);color:var(--green-dark);font-size:12px;font-weight:650;padding:5px 12px 5px 5px;border-radius:999px;display:flex;align-items:center;gap:7px;align-self:flex-start">${face}${t('Liste übernommen · {wer}', { wer: esc(who) })}</span>
<button data-act="undo-adopt" data-msg="${esc(message.id)}" style="border:0;background:transparent;padding:0 0 0 4px;cursor:pointer;font-family:'Instrument Sans',sans-serif;align-self:flex-start"><span style="pointer-events:none;font-size:12px;font-weight:650;color:var(--muted);text-decoration:underline">${t('Rückgängig')}</span></button>`;
}

// --- Catch-up (07.8 geschlossen / 07.9 offen) ---

function catchupArea(ctx) {
  const { ui } = ctx;
  if (!ui.unreadCount || ui.unreadCount < 8 || !ui.catchUp?.length || ui.catchDismissed) return '';
  if (!ui.catchOpen) {
    return bottomBar(`<div style="pointer-events:auto;margin:0 20px;background:var(--surface);border:1.5px solid var(--ink-a12);border-radius:14px;padding:11px 14px;display:flex;align-items:center;gap:9px;box-shadow:0 4px 12px var(--shadow-08)">
<span style="font-size:12.5px;font-weight:600;color:var(--ink-soft);flex:1;font-variant-numeric:tabular-nums">${tn(ui.unreadCount, '{n} neue Nachricht', '{n} neue Nachrichten')}</span>
<button data-act="catch-open" style="border:0;background:transparent;padding:0;cursor:pointer;font-family:'Instrument Sans',sans-serif"><span style="pointer-events:none;font-size:12.5px;font-weight:650;color:var(--green-dark)">${t('Zusammenfassen')}</span></button>
</div>`, 'pointer-events:none;padding:2px 0 8px');
  }
  const cards = ui.catchUp.map((entry) => `<div style="background:var(--paper);border-radius:12px;padding:10px 12px;display:flex;align-items:center;gap:9px">
<span style="display:flex;flex:none;pointer-events:none">${personAvatar(entry.person, { size: 22, fontSize: 8.5, marker: personMarker(entry.person.id, ctx.repo.getSettings()), compact: true, dotBorder: 'var(--paper)' })}</span>
<span style="font-size:12.5px;font-weight:550;color:var(--ink-soft);flex:1;min-width:0">${entry.html}</span>
</div>`).join('');
  return bottomBar(`<div style="pointer-events:auto;margin:0 20px;background:var(--surface);border:1.5px solid var(--ink-a12);border-radius:16px;padding:13px 14px;display:flex;flex-direction:column;gap:9px;box-shadow:0 6px 16px var(--shadow-10)">
<div style="display:flex;justify-content:space-between;align-items:center;padding:0 2px"><span style="font-size:11px;font-weight:650;letter-spacing:.09em;text-transform:uppercase;color:var(--muted-light)">${tn(ui.unreadCount, '{n} neue Nachricht', '{n} neue Nachrichten')}</span><button data-act="catch-close" style="border:0;background:transparent;padding:0 2px;cursor:pointer;font-family:'Instrument Sans',sans-serif"><span style="pointer-events:none;font-size:13px;color:var(--muted-light)">✕</span></button></div>
${cards}
</div>`, 'pointer-events:none;padding:2px 0 8px');
}

// --- Eingabezeile + @-Auswahl + Plus-Menü ---

// §5: der Composer ist eine echte Overlay-Ebene über der Nachrichtenfläche.
// v4 P0-5e: Deckend ist ausschließlich das echte Bedienelement — die runde Pille und die
// beiden runden Knöpfe. Die Zeile selbst ist durchsichtig und pointer-events:none, damit
// keine unsichtbare Rechteckzone entsteht, die 52 % funktionslos wäre und die Nachrichten
// dahinter blockiert. Die Nachrichten laufen sichtbar unter den Composer und faden dort aus.
function composerRow(ctx) {
  const { ui } = ctx;
  const open = Boolean(ui.plusMenu);
  const live = 'pointer-events:auto';
  return `<div style="display:flex;gap:8px;align-items:center;padding:6px 20px 26px;position:relative;pointer-events:none">
<button data-act="plus-menu" data-treffer aria-expanded="${open}" style="${live};width:38px;height:38px;border-radius:50%;${open ? 'background:var(--field);border:1.5px solid var(--ink-a22);color:var(--ink)' : 'background:var(--paper-soft);border:1.5px solid var(--ink-a14);color:var(--ink)'};display:flex;align-items:center;justify-content:center;cursor:pointer;flex:none;padding:0;box-shadow:0 1px 3px var(--shadow-08)"><span style="pointer-events:none;font-size:18px;font-weight:500;display:block;transform:rotate(${open ? 45 : 0}deg);transition:transform .18s ease-out">+</span></button>
<input id="room-composer" placeholder="${esc(t('Nachricht …'))}" value="${esc(ui.draftMsg || '')}" autocomplete="off" style="${live};flex:1;min-width:0;background:var(--surface);border:1.5px solid var(--ink-a10);border-radius:999px;padding:11px 16px;font-size:13.5px;font-family:'Instrument Sans',sans-serif;color:var(--ink);outline:none;box-shadow:0 1px 3px var(--shadow-08)">
<button id="room-send" data-act="send" aria-label="${esc(t('Senden'))}" style="${live};width:38px;height:38px;border-radius:50%;background:var(--green);border:0;display:${(ui.draftMsg || '').trim() ? 'flex' : 'none'};align-items:center;justify-content:center;cursor:pointer;flex:none;padding:0"><span style="pointer-events:none;display:flex">${sendSvg}</span></button>
<div id="mention-box" style="${live};position:absolute;left:66px;bottom:72px;background:var(--surface);border-radius:14px;border:1px solid var(--ink-a08);box-shadow:0 8px 24px var(--shadow-16);overflow:hidden;width:148px;display:none;z-index:13"></div>
</div>`;
}

// =====================================================================================
// §7 — kleiner Erstellungsflow für Liste und Umfrage
// Standardziel ist das aktive, sonst das nächste Meet im Raum; das Ziel ist änderbar.
// Nach Senden steht der Inhalt im Chat UND beim zugeordneten Meet.
// =====================================================================================

function roomMeetOptions(ctx, info) {
  const upcoming = ctx.repo.getMeets({ context: info.context, direction: 'upcoming' });
  if (info.kind !== 'person') return upcoming;
  // v6 A13b: Ein Meet mit eigenem gemeinsamem Raum (meet.roomId) darf NICHT mehr als
  // vollwertiges Panel in jedem beteiligten 1:1-Raum stehen. Vorher zeigten zwei
  // getrennte Chats dieselbe Karte, während die Nachrichten auseinanderliefen.
  // v7 A18c: Ein Meet, dessen gemeinsamer Raum ANDERSWO liegt — im eigenen temporären
  // Meet-Raum (meet.roomId) ODER im Crew-Raum (meet.crewId) —, darf im 1:1-Chat keine
  // zweite vollständige Meet-Box mehr erzeugen. Vorher stand das aktive Crew-Meet
  // gleichzeitig als Vollbox in vier Räumen, jeder mit eigener Teilnahmeauswahl.
  // Ein echtes 1:1-Meet (genau zwei Personen) trägt weder roomId noch crewId und behält
  // seine Vollbox — genau so verlangt es spec/04 §2.
  return upcoming
    .filter((meet) => !meet.roomId && !meet.crewId)
    .filter((meet) => meet.status === 'active' || meet.personIds?.includes(info.person.id));
}

// v7 A18a: GENAU EIN Meet, dessen gemeinsamer Raum woanders geführt wird — aktives
// zuerst, sonst das zeitlich nächste. Alle weiteren gehören in den Bereich
// „Temporäre Räume" auf der Crew-Startseite, nicht als Mini-Liste unter jede Person.
function sharedMeetRoom(ctx, info) {
  if (info.kind !== 'person') return null;
  const kandidaten = ctx.repo.getMeets({ context: info.context, direction: 'upcoming' })
    .filter((meet) => meet.roomId || meet.crewId)
    .filter((meet) => meet.status === 'active' || (meet.personIds || []).includes(info.person.id)
      || Boolean(meet.participation?.[info.person.id]));
  const meet = kandidaten.find((entry) => entry.status === 'active') || kandidaten[0];
  if (!meet) return null;
  const roomId = meet.roomId || (meet.crewId ? roomIdForCrew(meet.crewId) : null);
  return roomId ? { meet, roomId } : null;
}

// Der kompakte Linkhinweis (spec/04 §2): Aktivität, wer zusätzlich beteiligt ist,
// nächster Zeitpunkt bzw. aktiver Status. Keine Teilnahmeauswahl, keine Liste, keine
// Umfrage — der Tap führt in den EINEN gemeinsamen Raum.
function meetRoomHints(ctx, info) {
  const treffer = sharedMeetRoom(ctx, info);
  if (!treffer) return '';
  const { meet, roomId } = treffer;
  const weitere = [...new Set([meet.creatorId, ...(meet.personIds || []), ...Object.keys(meet.participation || {})])]
    .filter((id) => id && id !== ME && id !== info.person.id)
    .map((id) => ctx.repo.getPerson(id)?.name)
    .filter(Boolean);
  const mit = weitere.length
    ? (weitere.length > 2
      ? t('mit {namen} +{n}', { namen: esc(weitere.slice(0, 2).join(', ')), n: weitere.length - 2 })
      : t('mit {namen}', { namen: esc(weitere.slice(0, 2).join(', ')) }))
    : t('gemeinsamer Raum');
  const wann = meet.status === 'active'
    ? t('läuft')
    : esc(terminText(meet, { datum: meetDateLabel }));
  return `<div style="flex:none;padding:10px 20px 0;pointer-events:none">
<button data-act="open-meet-room" data-room="${esc(roomId)}" data-meet="${esc(meet.id)}" style="pointer-events:auto;display:flex;align-items:center;gap:9px;width:100%;background:var(--surface);border:1px solid var(--ink-a10);border-radius:14px;padding:9px 12px;cursor:pointer;appearance:none;font-family:'Instrument Sans',sans-serif;color:var(--ink);text-align:left;box-shadow:0 4px 12px var(--shadow-07)">
<span style="width:26px;height:26px;border-radius:9px;background:var(--paper);display:flex;align-items:center;justify-content:center;flex:none;pointer-events:none">${activityIconSvg(meet, 'var(--ink)', 14)}</span>
<span style="display:flex;flex-direction:column;gap:1px;flex:1;min-width:0;pointer-events:none">
<span style="font-size:12.5px;font-weight:650;white-space:nowrap;overflow:hidden;text-overflow:ellipsis">${esc(meet.title)}</span>
<span style="font-size:11px;color:var(--muted);white-space:nowrap;overflow:hidden;text-overflow:ellipsis">${mit}</span>
</span>
<span style="font-size:11.5px;font-weight:650;color:${meet.status === 'active' ? 'var(--green-dark)' : 'var(--muted)'};flex:none;pointer-events:none;font-variant-numeric:tabular-nums">${wann}</span>
<span style="pointer-events:none;display:flex">${rowChevron}</span>
</button>
</div>`;
}

// v6 A09: „Gehört zu" ist ein strukturiertes Auswahlmenü mit drei sauber getrennten
// Gruppen. Die Gruppenüberschrift trägt dieselbe Typografie wie „Gehört zu" selbst,
// damit die Liste eine Ordnung hat statt einer flachen Reihe gleichrangiger Zeilen.
function createGroupLabel(text) {
  return `<span style="font-size:11px;font-weight:650;letter-spacing:.09em;text-transform:uppercase;color:var(--muted-light);padding:9px 0 3px">${esc(text)}</span>`;
}

function createTargetRow(meet, selected) {
  // Ohne Meet ist eine echte Zeile mit demselben Auswahlkreis — nicht nur ein Hinweistext.
  const titel = meet ? esc(meet.title) : t('Ohne Meet');
  let sub = t('freie Umfrage im Chat');
  if (meet) sub = meet.status === 'active' ? `${esc(meetDateLabel(meet.date))} · ${t('läuft')}` : esc(terminText(meet, { datum: meetDateLabel }));
  const icon = meet ? activityIconSvg(meet, 'var(--ink)', 15) : pollBarsSvg('var(--muted)', 15);
  return `<button data-act="cr-target" data-meet="${meet ? esc(meet.id) : ''}" style="display:flex;align-items:center;gap:10px;padding:10px 0;border:0;background:transparent;cursor:pointer;appearance:none;font-family:'Instrument Sans',sans-serif;text-align:left;width:100%">
<span style="width:30px;height:30px;border-radius:10px;background:var(--paper);display:flex;align-items:center;justify-content:center;flex:none;pointer-events:none">${icon}</span>
<span style="display:flex;flex-direction:column;gap:1px;flex:1;min-width:0;pointer-events:none"><span style="font-size:14px;font-weight:650;white-space:nowrap;overflow:hidden;text-overflow:ellipsis">${titel}</span><span style="font-size:11.5px;color:${meet?.status === 'active' ? 'var(--green-dark)' : 'var(--muted)'}">${sub}</span></span>
<span style="pointer-events:none;display:flex">${selected
    ? '<svg width="20" height="20" viewBox="0 0 24 24" fill="none"><circle cx="12" cy="12" r="10" fill="var(--green)"></circle><path d="m8 12 2.6 2.6L16.4 9" stroke="var(--on-accent)" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"></path></svg>'
    : '<span style="width:20px;height:20px;border-radius:50%;border:1.8px solid var(--line-solid);box-sizing:border-box;display:block"></span>'}</span>
</button>`;
}

function createSheet(ctx, info) {
  const { ui } = ctx;
  const create = ui.create;
  const meets = roomMeetOptions(ctx, info);
  const isPoll = create.kind === 'poll';
  // v6 A09b: `meetId === null` ist ein GÜLTIGER Zustand — die freie Chat-Umfrage.
  // Vorher fiel die Funktion hier still aus, sobald kein Meet auflösbar war.
  const target = create.meetId ? meets.find((meet) => meet.id === create.meetId) : null;
  if (!target && !isPoll) return ''; // Ein Listenpunkt braucht ein Meet, an dem er hängt.
  const aktiv = meets.filter((meet) => meet.status === 'active');
  const kommend = meets.filter((meet) => meet.status !== 'active');

  const field = (id, placeholder, value, max) => `<input id="${id}" value="${esc(value || '')}" placeholder="${esc(placeholder)}" maxlength="${max}" autocomplete="off" style="background:var(--paper);border:1.5px solid var(--ink-a09);border-radius:14px;padding:12px 14px;font-size:14px;font-family:'Instrument Sans',sans-serif;color:var(--ink);outline:none;width:100%;box-sizing:border-box">`;

  const targetRows = create.pick
    ? `<div style="display:flex;flex-direction:column;padding-top:2px;border-top:1px solid var(--ink-a05)">
${isPoll ? `${createGroupLabel(t('Ohne Meet'))}${createTargetRow(null, !target)}` : ''}
${aktiv.length ? `${createGroupLabel(t('Aktiv'))}${aktiv.map((meet) => createTargetRow(meet, target?.id === meet.id)).join('')}` : ''}
${kommend.length ? `${createGroupLabel(t('Kommend'))}${kommend.map((meet) => createTargetRow(meet, target?.id === meet.id)).join('')}` : ''}
</div>`
    : '';

  // Während der Picker offen ist, sagt der Kopf nur noch, worum es geht — sonst stünde
  // dasselbe Meet zweimal untereinander (einmal als Knopf, einmal als Zeile). Welches
  // Ziel gewählt ist, sagt der grüne Haken in der Liste.
  const kopfIcon = create.pick || !target ? pollBarsSvg('var(--muted)', 15) : activityIconSvg(target, 'var(--ink)', 15);
  const kopfTitel = create.pick ? t('Ziel wählen') : (target ? esc(target.title) : t('Ohne Meet'));
  let kopfSub;
  if (create.pick) kopfSub = isPoll ? t('ohne Meet, aktiv oder kommend') : t('aktiv oder kommend');
  else if (target) kopfSub = target.status === 'active' ? `${esc(meetDateLabel(target.date))} · ${t('läuft gerade')}` : esc(terminText(target, { datum: meetDateLabel }));
  else kopfSub = t('freie Umfrage im Chat');
  const targetBlock = `<div style="display:flex;flex-direction:column;gap:8px">
<span style="font-size:11px;font-weight:650;letter-spacing:.09em;text-transform:uppercase;color:var(--muted-light)">${t('Gehört zu')}</span>
<button data-act="cr-pick" aria-expanded="${Boolean(create.pick)}" style="background:var(--paper);border:0;border-radius:14px;padding:11px 14px;display:flex;align-items:center;gap:11px;cursor:pointer;appearance:none;font-family:'Instrument Sans',sans-serif;width:100%;text-align:left">
<span style="width:30px;height:30px;border-radius:10px;background:var(--surface);display:flex;align-items:center;justify-content:center;flex:none;pointer-events:none">${kopfIcon}</span>
<span style="display:flex;flex-direction:column;gap:1px;flex:1;min-width:0;pointer-events:none"><span style="font-size:14px;font-weight:650;color:var(--ink);white-space:nowrap;overflow:hidden;text-overflow:ellipsis">${kopfTitel}</span><span style="font-size:11.5px;color:${!create.pick && target?.status === 'active' ? 'var(--green-dark)' : 'var(--muted)'}">${kopfSub}</span></span>
<span style="pointer-events:none;display:flex">${tileChevron(Boolean(create.pick), true)}</span>
</button>
${targetRows}
</div>`;

  // v6 A09c: Frage und Antworten sind zwei GETRENNTE Blöcke — eigene Überschrift, eigene
  // Optik, eigenes Zustandsfeld. Vorher lagen Frage und zwei fest verdrahtete Optionen
  // als drei gleich aussehende Felder unter einer einzigen Überschrift „Frage".
  const optionen = create.options && create.options.length >= 2 ? create.options : ['', ''];
  const fields = isPoll
    ? `<div style="display:flex;flex-direction:column;gap:8px">
<span style="font-size:11px;font-weight:650;letter-spacing:.09em;text-transform:uppercase;color:var(--muted-light)">${t('Frage')}</span>
<input id="cr-q" value="${esc(create.question || '')}" placeholder="${esc(t('Worüber soll abgestimmt werden?'))}" maxlength="60" autocomplete="off" style="background:var(--surface);border:1.5px solid var(--green-a45);border-radius:16px;padding:13px 16px;font:650 15.5px 'Instrument Sans',sans-serif;color:var(--ink);outline:none;width:100%;box-sizing:border-box">
</div>
<div style="display:flex;flex-direction:column;gap:8px">
<span style="font-size:11px;font-weight:650;letter-spacing:.09em;text-transform:uppercase;color:var(--muted-light)">${t('Antworten')}</span>
${optionen.map((wert, i) => `<div style="display:flex;gap:8px;align-items:center">
${field(`cr-opt-${i}`, t('Antwort {n}', { n: i + 1 }), wert, 40)}
${i < 2 ? '' : `<button data-act="cr-opt-remove" data-index="${i}" aria-label="${esc(t('Antwort entfernen'))}" style="width:34px;height:34px;border-radius:50%;border:0;background:var(--paper);display:flex;align-items:center;justify-content:center;cursor:pointer;appearance:none;flex:none;padding:0"><span style="pointer-events:none;display:flex">${cross('var(--muted)', 12)}</span></button>`}
</div>`).join('')}
<button data-act="cr-opt-add" style="display:flex;align-items:center;gap:9px;padding:9px 2px 2px;border:0;background:transparent;cursor:pointer;appearance:none;font-family:'Instrument Sans',sans-serif;text-align:left;width:100%">
<span style="width:20px;height:20px;border-radius:50%;background:var(--green-tint);display:flex;align-items:center;justify-content:center;flex:none;pointer-events:none">${plus('var(--green-dark)', 12)}</span>
<span style="font-size:13.5px;font-weight:650;color:var(--green-dark);pointer-events:none">${t('Antwort hinzufügen')}</span></button>
</div>`
    // v5 A16a: Erste PFLICHTZEILE plus „Element hinzufügen" für beliebig viele weitere.
    // Vorher gab es genau ein Textfeld; zwei Gegenstände bedeuteten zwei Durchläufe und
    // zwei Chatnachrichten.
    : `<div style="display:flex;flex-direction:column;gap:8px">
<span style="font-size:11px;font-weight:650;letter-spacing:.09em;text-transform:uppercase;color:var(--muted-light)">${t('Auf die Liste')}</span>
${(create.items || ['']).map((wert, i) => `<div style="display:flex;gap:8px;align-items:center">
${field(`cr-item-${i}`, i === 0 ? t('Was soll jemand mitbringen?') : t('Noch etwas'), wert, 40)}
${i === 0 ? '' : `<button data-act="cr-item-remove" data-index="${i}" aria-label="${esc(t('Zeile entfernen'))}" style="width:34px;height:34px;border-radius:50%;border:0;background:var(--paper);display:flex;align-items:center;justify-content:center;cursor:pointer;appearance:none;flex:none;padding:0"><span style="pointer-events:none;display:flex">${cross('var(--muted)', 12)}</span></button>`}
</div>`).join('')}
<button data-act="cr-item-add" style="display:flex;align-items:center;gap:9px;padding:9px 2px 2px;border:0;background:transparent;cursor:pointer;appearance:none;font-family:'Instrument Sans',sans-serif;text-align:left;width:100%">
<span style="width:20px;height:20px;border-radius:50%;background:var(--green-tint);display:flex;align-items:center;justify-content:center;flex:none;pointer-events:none">${plus('var(--green-dark)', 12)}</span>
<span style="font-size:13.5px;font-weight:650;color:var(--green-dark);pointer-events:none">${t('Element hinzufügen')}</span></button>
</div>`;

  return sheet(`<div style="display:flex;flex-direction:column;gap:15px;font-family:'Instrument Sans',sans-serif">
<div style="display:flex;align-items:center;gap:11px">
<span style="width:38px;height:38px;border-radius:12px;background:var(--paper);display:flex;align-items:center;justify-content:center;flex:none">${isPoll ? pollBarsSvg('var(--ink)', 18) : menuListSvg}</span>
<span style="font-family:'Bricolage Grotesque',sans-serif;font-size:20px;font-weight:650">${isPoll ? t('Neue Umfrage') : t('Neuer Listenpunkt')}</span>
</div>
${targetBlock}
${fields}
<button data-act="cr-send" style="border:0;border-radius:999px;padding:15px 0;background:var(--green);cursor:pointer;appearance:none;font-family:'Instrument Sans',sans-serif"><span style="pointer-events:none;font:650 14.5px/1 'Instrument Sans',sans-serif;color:var(--on-accent)">${t('Senden')}</span></button>
</div>`, { closeAct: 'cr-close' });
}

// v5 A13: Glühbirne für „Vorschlag" — dieselbe ruhige Strichstärke wie die anderen
// Menü-Icons, damit die Zeile nicht aus der Reihe fällt.
const menuSuggestSvg = `<svg width="17" height="17" viewBox="0 0 24 24" fill="none" style="flex:none;pointer-events:none"><path d="M9.4 17.5h5.2M10.2 20.4h3.6" stroke="var(--ink)" stroke-width="1.8" stroke-linecap="round"></path><path d="M12 3.4a6 6 0 0 0-3.6 10.8c.5.4.8 1 .8 1.6h5.6c0-.6.3-1.2.8-1.6A6 6 0 0 0 12 3.4Z" stroke="var(--ink)" stroke-width="1.8" stroke-linejoin="round"></path></svg>`;

// v7 A38 / spec/08 §3: Das Plus ist ein kleines, ruhiges Slide-up im BESTEHENDEN
// Sheet-Host (nicht mehr ein verankertes 170-px-Popover) mit GENAU zwei benannten
// Bereichen: „Planen" (Meet · Vorschlag · Umfrage · Liste — alle vier direkt sichtbar)
// und „Teilen" (Standort). Es gibt bewusst keine allgemeine Restkategorie und keinen
// Foto-/Kamera-Eintrag: eine Bildnachricht wäre in v7 eine halbfertige Funktion.
function plusSheet() {
  const zeile = (act, svg, label, sub, last) => `<button data-act="${act}" style="display:flex;align-items:center;gap:11px;padding:11px 2px;border:0;${last ? '' : 'border-bottom:1px solid var(--ink-a06);'}background:transparent;width:100%;text-align:left;cursor:pointer;appearance:none;font-family:'Instrument Sans',sans-serif">
<span style="width:34px;height:34px;border-radius:11px;background:var(--paper);display:flex;align-items:center;justify-content:center;flex:none;pointer-events:none">${svg}</span>
<span style="display:flex;flex-direction:column;gap:1px;pointer-events:none;min-width:0;flex:1">
<span style="font-size:14px;font-weight:650;color:var(--ink)">${esc(label)}</span>
<span style="font-size:11.5px;color:var(--muted)">${esc(sub)}</span></span>
</button>`;
  const kapitel = (titel) => `<span style="font-size:11px;font-weight:650;letter-spacing:.09em;text-transform:uppercase;color:var(--muted-light);padding:2px 2px 0">${titel}</span>`;
  return sheet(`<div style="display:flex;flex-direction:column;gap:9px;font-family:'Instrument Sans',sans-serif">
${kapitel(t('Planen'))}
<div style="display:flex;flex-direction:column">
${zeile('menu-meet', menuMeetSvg, 'Meet', t('Treffen planen'))}
${zeile('menu-suggest', menuSuggestSvg, t('Vorschlag'), t('Aktivität oder Zeit'))}
${zeile('menu-poll', pollBarsSvg('var(--ink)', 17), t('Umfrage'), t('abstimmen lassen'))}
${zeile('menu-list', menuListSvg, t('Liste'), t('wer bringt was mit'), true)}
</div>
${kapitel(t('Teilen'))}
<div style="display:flex;flex-direction:column">
${zeile('menu-location', standortPinSvg, t('Standort'), t('einmalig an diesen Raum'), true)}
</div>
</div>`, { closeAct: 'plus-close', scrollKey: 'raum-plus' });
}

// v6 A10: „Vorschlag" sprang bisher sofort auf eine eigene Route — Chat, Composer und
// Hintergrund des Raums wurden dabei komplett neu gebaut. Der zweite Auswahlzustand
// liegt jetzt als kleines verankertes Menü im SELBEN Host wie das Plus-Menü, an
// derselben Stelle und in derselben Bauart. Erst die Wahl führt weiter.
const menuTimeSvg = `<svg width="17" height="17" viewBox="0 0 24 24" fill="none" style="flex:none;pointer-events:none"><circle cx="12" cy="12" r="8.6" stroke="var(--ink)" stroke-width="1.8"></circle><path d="M12 7.2V12l3.2 2" stroke="var(--ink)" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"></path></svg>`;
const menuActivitySvg = `<svg width="17" height="17" viewBox="0 0 24 24" fill="none" style="flex:none;pointer-events:none"><path d="M12 2.8l1.9 5.6 5.6 1.9-5.6 1.9L12 17.8l-1.9-5.6-5.6-1.9 5.6-1.9L12 2.8Z" stroke="var(--ink)" stroke-width="1.8" stroke-linejoin="round"></path><path d="M19 16.5v4M17 18.5h4" stroke="var(--ink)" stroke-width="1.8" stroke-linecap="round"></path></svg>`;

// v7 A21: derselbe Sheet-Host, zweiter kleiner Auswahlzustand. Kein Routenwechsel,
// kein zweites Overlay — und nichts bereits Eingegebenes geht verloren.
function suggestSheet() {
  const zeile = (act, svg, label, sub, last) => `<button data-act="${act}" style="display:flex;align-items:center;gap:11px;padding:12px 2px;border:0;${last ? '' : 'border-bottom:1px solid var(--ink-a06);'}background:transparent;width:100%;text-align:left;cursor:pointer;appearance:none;font-family:'Instrument Sans',sans-serif">
<span style="width:34px;height:34px;border-radius:11px;background:var(--paper);display:flex;align-items:center;justify-content:center;flex:none;pointer-events:none">${svg}</span>
<span style="display:flex;flex-direction:column;gap:1px;pointer-events:none;min-width:0;flex:1">
<span style="font-size:14px;font-weight:650;color:var(--ink)">${esc(label)}</span>
<span style="font-size:11.5px;color:var(--muted)">${esc(sub)}</span></span>
<span style="pointer-events:none;display:flex">${rowChevron}</span>
</button>`;
  return sheet(`<div style="display:flex;flex-direction:column;gap:9px;font-family:'Instrument Sans',sans-serif">
<span style="font-family:'Bricolage Grotesque',sans-serif;font-size:20px;font-weight:650">${t('Vorschlag')}</span>
<div style="display:flex;flex-direction:column">
${zeile('suggest-activity', menuActivitySvg, t('Aktivität'), t('Was machen wir?'))}
${zeile('suggest-time', menuTimeSvg, t('Zeit'), t('Wann passt es?'), true)}
</div>
</div>`, { closeAct: 'suggest-close', scrollKey: 'raum-vorschlag' });
}

// =====================================================================================
// Nachrichten-Menü (Runde 4, E8)
//
// Jonathan: „Wenn ich scrolle oder eine Nachricht antippe oder generell etwas mache, bekomme ich
// das Slide-up, dass ich eine Nachricht reporten will. Das sollte sehr versteckt sein." Und:
// „Ich muss meine eigenen Nachrichten auch löschen können."
//
// Gemessen (Touch, scratch/r4-raum.mjs): Ein Fingertipp startete ZWEI Zeitgeber — touchstart
// und pointerdown riefen beide denselben Beginn auf, der zweite überschrieb den Merker des
// ersten. Loslassen und Scrollen stoppten nur den zweiten; der erste lief nach 550 ms ab und
// öffnete das Melden-Sheet. Jetzt gibt es EINEN Weg über Pointer-Ereignisse (Finger, Maus,
// Stift) mit EINEM Zeitgeber, und alles, was nach Scrollen aussieht, bricht ab: mehr als
// 10 px Bewegung, pointercancel (der Browser übernimmt das Scrollen), ein scroll-Ereignis.
// Erst nach bewusstem Halten geht an der Nachricht ein kleines Menü auf — kein Sheet mehr:
// Kopieren · Melden (fremde Nachricht) · Löschen (eigene, mit Rückgängig).
// =====================================================================================
const LANG_DRUECKEN_MS = 450;
const DRUECK_TOLERANZ_PX = 10;
const MENUE_ZEILE = 48;
const MENUE_BREITE = 212;

// Der Finger, der das Menü geöffnet hat, hebt danach ab. Dieser eine Klick darf nichts auslösen —
// weder die Nachricht (Standort öffnen) noch eine Menüzeile, die jetzt unter ihm liegt. Jede neue
// Berührung hebt die Sperre auf.
let klickSperre = false;
if (globalThis.window?.addEventListener) {
  window.addEventListener('pointerdown', () => { klickSperre = false; }, true);
  window.addEventListener('click', (event) => {
    if (!klickSperre) return;
    klickSperre = false;
    event.preventDefault();
    event.stopPropagation();
  }, true);
}

// Lage eines Knotens im Handyrahmen (dort liegen die Überlagerungen), unabhängig von einer
// Skalierung des Rahmens.
function imRahmen(knoten) {
  const rahmen = knoten?.closest?.('.runtime-phone');
  if (!rahmen) return null;
  const f = rahmen.getBoundingClientRect();
  const skala = rahmen.offsetWidth ? f.width / rahmen.offsetWidth : 1;
  const r = knoten.getBoundingClientRect();
  return {
    oben: (r.top - f.top) / skala,
    unten: (r.bottom - f.top) / skala,
    links: (r.left - f.left) / skala,
    rechts: (f.right - r.right) / skala,
    breite: rahmen.offsetWidth,
    hoehe: rahmen.offsetHeight,
  };
}

function bindNachrichtMenue(root, ctx) {
  const flaeche = root.querySelector('.screen-scroll');
  if (!flaeche) return;
  // Die Scrollfläche bleibt über Renders (und Raumwechsel) derselbe Knoten — die Handler lesen
  // deshalb immer den zuletzt gebundenen Zustand.
  flaeche.__menueCtx = ctx;
  flaeche.__menueRoot = root;
  if (flaeche.__menueGebunden) return;
  flaeche.__menueGebunden = true;
  let halt = null;
  const loslassen = () => {
    if (halt) window.clearTimeout(halt.timer);
    halt = null;
  };
  const oeffnen = (ziel) => {
    loslassen();
    const aktuell = flaeche.__menueCtx;
    if (!aktuell || !ziel.isConnected || aktuell.ui.nachrichtMenue) return;
    const lage = imRahmen(ziel.querySelector('[data-blase]') || ziel);
    if (!lage) return;
    const wurzel = flaeche.__menueRoot || root;
    lage.grenzeOben = (imRahmen(wurzel.querySelector('.screen-header'))?.unten ?? 100) + 6;
    lage.grenzeUnten = (imRahmen(wurzel.querySelector('#room-composer'))?.oben ?? lage.hoehe - 80) - 8;
    klickSperre = true;
    rueckmeldung('tipp');
    aktuell.ui.nachrichtMenue = { id: ziel.dataset.nachricht, lage };
    aktuell.render();
  };
  flaeche.addEventListener('pointerdown', (event) => {
    loslassen();
    if (!event.isPrimary || (event.pointerType === 'mouse' && event.button !== 0)) return;
    const ziel = event.target.closest?.('[data-nachricht]');
    if (!ziel || !flaeche.contains(ziel)) return;
    if (event.target.closest?.('[data-role="nachricht-bild"]')) return; // R8-17: das Bild öffnet die Person
    halt = { x: event.clientX, y: event.clientY, timer: window.setTimeout(() => oeffnen(ziel), LANG_DRUECKEN_MS) };
  });
  flaeche.addEventListener('pointermove', (event) => {
    if (halt && Math.hypot(event.clientX - halt.x, event.clientY - halt.y) > DRUECK_TOLERANZ_PX) loslassen();
  });
  flaeche.addEventListener('pointerup', loslassen);
  flaeche.addEventListener('pointercancel', loslassen);
  flaeche.addEventListener('scroll', loslassen, { passive: true });
  // Rechtsklick (Maus) und das Systemmenü nach langem Drücken (Android) öffnen dasselbe Menü.
  flaeche.addEventListener('contextmenu', (event) => {
    const ziel = event.target.closest?.('[data-nachricht]');
    if (!ziel || !flaeche.contains(ziel)) return;
    event.preventDefault();
    if (event.target.closest?.('[data-role="nachricht-bild"]')) return; // R8-17: auch hier gilt das Bild als Person
    oeffnen(ziel);
  });
}

const kopierenSvg = '<svg width="18" height="18" viewBox="0 0 24 24" fill="none" style="flex:none;pointer-events:none"><rect x="8.5" y="8.5" width="11" height="11" rx="2.6" stroke="var(--ink)" stroke-width="1.8"></rect><path d="M15.5 5.6V5a1.5 1.5 0 0 0-1.5-1.5H6A2.5 2.5 0 0 0 3.5 6v8A1.5 1.5 0 0 0 5 15.5h.6" stroke="var(--ink)" stroke-width="1.8" stroke-linecap="round"></path></svg>';
const meldenSvg = '<svg width="18" height="18" viewBox="0 0 24 24" fill="none" style="flex:none;pointer-events:none"><path d="M5.5 21V4.5M5.5 4.5h11.5l-2.4 4 2.4 4H5.5" stroke="var(--danger)" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"></path></svg>';
const loeschenSvg = '<svg width="18" height="18" viewBox="0 0 24 24" fill="none" style="flex:none;pointer-events:none"><path d="M4.5 7h15M9.5 7V5a1.5 1.5 0 0 1 1.5-1.5h2A1.5 1.5 0 0 1 14.5 5v2M6.5 7l.9 12a1.8 1.8 0 0 0 1.8 1.6h5.6a1.8 1.8 0 0 0 1.8-1.6l.9-12M10 11v5.5M14 11v5.5" stroke="var(--danger)" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"></path></svg>';

// Das Menü sitzt an der Blase: darunter, wenn Platz ist, sonst darüber — nie unter dem Kopf oder
// der Eingabezeile. Eigene Nachrichten rechtsbündig, fremde linksbündig mit der Blase.
function nachrichtMenue(ctx, info) {
  const zustand = ctx.ui.nachrichtMenue;
  if (!zustand?.lage) return '';
  const message = info.room.messages.find((entry) => entry.id === zustand.id);
  if (!message || loeschenVorgemerkt(info.room.id, message.id)) return '';
  const eigen = message.authorId === ME;
  const eintraege = [];
  if (message.kind === 'text' && message.text) eintraege.push(['nachricht-kopieren', kopierenSvg, t('Kopieren'), 'var(--ink)']);
  if (eigen && typeof ctx.repo.deleteMessage === 'function') eintraege.push(['nachricht-loeschen', loeschenSvg, t('Löschen'), 'var(--danger)']);
  if (!eigen) eintraege.push(['nachricht-melden', meldenSvg, t('Melden'), 'var(--danger)']);
  if (!eintraege.length) return '';
  const { lage } = zustand;
  const hoehe = eintraege.length * MENUE_ZEILE + 2;
  const RAND = 12;
  let oben = lage.unten + 8;
  if (oben + hoehe > lage.grenzeUnten) oben = lage.oben - hoehe - 8;
  oben = Math.max(lage.grenzeOben, Math.min(oben, lage.grenzeUnten - hoehe));
  const seite = eigen ? `right:${Math.max(RAND, Math.round(lage.rechts))}px` : `left:${Math.max(RAND, Math.round(lage.links))}px`;
  const zeilen = eintraege.map(([act, svg, label, farbe], index) => `<button data-act="${act}" data-msg="${esc(message.id)}" role="menuitem" style="display:flex;align-items:center;gap:12px;width:100%;min-height:${MENUE_ZEILE}px;padding:0 16px;border:0;${index < eintraege.length - 1 ? 'border-bottom:1px solid var(--ink-a06);' : ''}background:transparent;cursor:pointer;appearance:none;font:650 14px 'Instrument Sans',sans-serif;color:${farbe};text-align:left">${svg}<span style="pointer-events:none;flex:1">${esc(label)}</span></button>`).join('');
  return `<div data-act="nachricht-menue-zu" data-role="nachricht-menue-scrim" style="position:absolute;inset:0;z-index:12"></div>
<div role="menu" data-role="nachricht-menue" data-msg="${esc(message.id)}" style="position:absolute;top:${Math.round(oben)}px;${seite};width:${MENUE_BREITE}px;max-width:calc(100% - ${RAND * 2}px);box-sizing:border-box;background:var(--surface);border:1px solid var(--ink-a07);border-radius:16px;box-shadow:0 10px 28px var(--shadow-16);overflow:hidden;z-index:13;transform-origin:${eigen ? 'top right' : 'top left'};animation:raumMenueRein .16s ease-out">${zeilen}</div>`;
}

async function textKopieren(text) {
  try {
    await navigator.clipboard.writeText(text);
    return true;
  } catch { /* Rückfall unten */ }
  // Rückfall ohne Zwischenablage-Schnittstelle. Das Hilfsfeld nimmt kurz den Fokus — wer inzwischen
  // schon wieder im Eingabefeld tippt, bekommt ihn sofort zurück.
  const vorher = document.activeElement;
  try {
    const feld = document.createElement('textarea');
    feld.value = text;
    feld.setAttribute('readonly', '');
    feld.style.cssText = 'position:fixed;left:-9999px;opacity:0';
    document.body.appendChild(feld);
    feld.select();
    const ok = document.execCommand('copy');
    feld.remove();
    return ok;
  } catch {
    return false;
  } finally {
    if (vorher && vorher !== document.body && vorher.isConnected) vorher.focus?.({ preventScroll: true });
  }
}

// Löschen einer eigenen Nachricht (E8). Entscheidung: Die Nachricht VERSCHWINDET — für alle,
// ohne „Nachricht gelöscht"-Zeile. Crew ist ein Chat unter Freunden zum Planen; Grabsteine
// zwischen den Absprachen wären Rauschen, und alles, was an der Nachricht hing (Vorschlag,
// Listen-Übernahme, Zusammenfassung), verschwindet damit von selbst. Damit ein Fehlgriff nicht
// endgültig ist, steht sechs Sekunden lang an ihrer Stelle „Nachricht gelöscht · Rückgängig" —
// dieselbe ehrliche Frist wie bei den Vorschlägen: Gelöscht wird erst danach (oder sofort, wenn
// man die App in der Frist verlässt). Der Platzhalter hält die Höhe der Blase, damit nichts springt.
function geloeschtPlatzhalter(roomId, message) {
  const eintrag = vorgemerkteHinweise.get(hinweisSchluessel(roomId, message.id, 'loeschen'));
  const hoehe = Math.max(28, Math.round(eintrag?.hoehe || 34));
  // Die Trefferfläche von „Rückgängig" ist 44 px hoch, ragt aber über negative Außenabstände über
  // die Zeile hinaus — die Zeile selbst ist genau so hoch wie die Blase war (gemessen: sonst 10 px Sprung).
  return `<div data-role="nachricht-geloescht" data-msg="${esc(message.id)}" style="display:flex;justify-content:flex-end;align-items:center;gap:2px;height:${hoehe}px">
<span style="font-size:12.5px;font-style:italic;color:var(--muted);border:1.5px dashed var(--ink-a14);border-radius:16px 16px 5px 16px;padding:0 12px;height:${hoehe}px;box-sizing:border-box;display:flex;align-items:center;white-space:nowrap">${t('Nachricht gelöscht')}</span>
<button data-act="loeschen-zurueck" data-msg="${esc(message.id)}" style="height:44px;min-width:44px;margin:${Math.min(0, (hoehe - 44) / 2)}px 0;padding:0 6px;border:0;background:transparent;cursor:pointer;appearance:none;font-family:'Instrument Sans',sans-serif"><span style="pointer-events:none;font-size:12px;font-weight:650;color:var(--muted);text-decoration:underline">${t('Rückgängig')}</span></button>
</div>`;
}

// =====================================================================================
// „Gruppe öffnen?" (Runde 4, E5)
//
// Jonathan: „Wenn ich in einem Chat mit nur einer Person ein Meet habe, welches aber mit einer
// ganzen Gruppe ist, dann will ich beim Draufklicken nicht direkt zur Gruppe kommen, sondern
// erst den Hinweis bekommen, dass die Gruppe geöffnet wird: Gruppe öffnen oder nicht öffnen."
// Der Hinweis nennt, WOHIN es geht (Gruppenbild bzw. die Leute des Meet-Raums), und bietet als
// dritten, leisen Weg das Meet selbst an — wer nur nachsehen will, muss den Chat nicht wechseln.
// =====================================================================================
function gruppeOeffnenSheet(ctx, info) {
  const zustand = ctx.ui.gruppeOeffnen;
  if (!zustand || info.kind !== 'person') return '';
  const meet = ctx.repo.getMeet(zustand.meetId);
  if (!meet) return '';
  const crew = meet.crewId ? ctx.repo.getCrew(meet.crewId) : null;
  const settings = ctx.repo.getSettings();
  const bild = crew
    ? gruppenKreis(crew, 44, 16)
    : `<span style="display:flex;flex:none">${avatarStack(meetRoomOthers(ctx, meet), { size: 30, font: 11, border: 'var(--surface)', max: 3, more: false, settings })}</span>`;
  const werte = { titel: esc(meet.title), gruppe: esc(crew?.name || ''), name: esc(info.person.name) };
  const text = crew
    ? t('„{titel}“ läuft in der Gruppe {gruppe}. Dort schreibt ihr alle zusammen — du verlässt dafür den Chat mit {name}.', werte)
    : t('„{titel}“ hat einen eigenen Gruppenchat mit allen, die dabei sind. Du verlässt dafür den Chat mit {name}.', werte);
  return sheet(`<div data-role="gruppe-oeffnen" style="display:flex;flex-direction:column;gap:13px;font-family:'Instrument Sans',sans-serif">
<div style="display:flex;align-items:center;gap:12px">
${bild}
<span style="display:flex;flex-direction:column;gap:1px;min-width:0">
<span style="font-family:'Bricolage Grotesque',sans-serif;font-size:20px;font-weight:650">${t('Gruppe öffnen?')}</span>
<span style="font-size:12px;color:var(--muted);white-space:nowrap;overflow:hidden;text-overflow:ellipsis">${esc(crew ? crew.name : meet.title)}</span>
</span>
</div>
<span style="font-size:13px;color:var(--ink-soft);line-height:1.45;text-wrap:pretty">${text}</span>
<div style="display:flex;gap:8px">
<button data-act="gruppe-oeffnen-nein" style="flex:1;min-height:48px;border:1.5px solid var(--ink-a14);background:var(--surface);color:var(--ink-soft);font:650 14px/1 'Instrument Sans',sans-serif;border-radius:999px;cursor:pointer;appearance:none"><span style="pointer-events:none">${t('Nicht öffnen')}</span></button>
<button data-act="gruppe-oeffnen-ja" style="flex:1;min-height:48px;background:var(--green);border:0;color:var(--on-accent);font:650 14px/1 'Instrument Sans',sans-serif;border-radius:999px;cursor:pointer;appearance:none"><span style="pointer-events:none">${t('Gruppe öffnen')}</span></button>
</div>
<button data-act="gruppe-oeffnen-meet" style="align-self:center;min-height:44px;padding:0 12px;border:0;background:transparent;cursor:pointer;appearance:none;font-family:'Instrument Sans',sans-serif"><span style="pointer-events:none;font-size:13px;font-weight:650;color:var(--green-dark)">${t('Nur das Meet ansehen')}</span></button>
</div>`, { closeAct: 'gruppe-oeffnen-nein', scrollKey: 'raum-gruppe-oeffnen' });
}

function bindRoomView(root, ctx) {
  const { repo, nav, ui, params } = ctx;
  const info = resolveRoom(ctx, params.roomId);
  if (!info) return;
  bindNachrichtMenue(root, ctx);
  const panelMeet = panelMeetFor(ctx, info);

  // v6 A18b: Beide Wege sind eine bewusste Handlung. Der Raum bleibt stehen; nur die Karte
  // verschwindet, weil die Anfrage nicht mehr offen ist.
  const antworten = (requestId, ja) => {
    const ergebnis = repo.respondPlaceRequest(requestId, ja);
    if (!ergebnis?.ok) return;
    ctx.toast(ja ? t('Ort freigegeben') : t('Ort abgelehnt'));
    ctx.render();
  };

  const draftFuerRaum = () => {
    let input;
    if (info.kind === 'crew') input = { withCrewId: info.crew.id };
    // v6 A13: Aus dem gemeinsamen Meet-Raum heraus sind ALLE Teilnehmenden vorbelegt.
    else if (info.kind === 'meet') input = { withPersonIds: meetRoomOthers(ctx, info.meet).map((person) => person.id) };
    else input = { withPersonIds: [info.person.id] };
    return repo.createDraft(input);
  };

  const startDraft = () => {
    const draft = draftFuerRaum();
    nav.go('newMeet.discover', { draftId: draft.id });
  };

  // Runde 3 (K3): „Als Meet vorschlagen" öffnet denselben Composer — nur schon mit dem, was im
  // Satz stand: die Aktivität als eigene Idee, der Tag und (falls genannt) die Uhrzeit, sonst
  // „Zeit offen". Gespeichert ist damit nichts; gesendet wird erst mit „Meet senden".
  const planAlsMeet = (plan) => {
    const draft = draftFuerRaum();
    const patch = {};
    if (plan?.aktivitaet) {
      patch.idea = { title: plan.aktivitaet, icon: null, category: null, details: '', source: 'chat', suggestionId: null, ownId: null, place: null };
    }
    // Runde 4 (F2): „wer hat jetzt Zeit" → der Composer steht auf „Jetzt", nicht auf der Uhrzeit.
    if (plan?.jetzt) patch.when = jetztTermin();
    else if (plan?.datum || plan?.uhrzeit) {
      patch.when = { date: plan.datum || toISODate(now()), time: plan.uhrzeit || '', open: !plan.uhrzeit };
    }
    if (Object.keys(patch).length) repo.updateDraft(draft.id, patch);
    nav.go('newMeet.discover', { draftId: draft.id });
  };

  const send = () => {
    const text = (ui.draftMsg || '').trim();
    if (!text) return;
    ui.draftMsg = '';
    // Runde 3 (gefunden beim Prüfen von K3): Wer mit Enter sendet, behält den Fokus im Feld —
    // und der Abgleich (core/html.js) lässt ein fokussiertes Feld bewusst in Ruhe. Der
    // gesendete Text blieb deshalb stehen, und die nächste Nachricht wurde an ihn angehängt
    // („ich fahre mit dem Autkann ich irgendwo mitfahreno"). Das Feld wird hier selbst geleert.
    const feld = root.querySelector('#room-composer');
    if (feld) feld.value = '';
    const sendeKnopf = root.querySelector('#room-send');
    if (sendeKnopf) sendeKnopf.style.display = 'none';
    ui.catchDismissed = true;
    ui.refocusComposer = true;
    ui.chatPinned = false; // eigene Nachricht: wieder ans Ende springen
    repo.sendMessage(params.roomId, text);
  };

  // Ü4: Der Erstellungsflow ist ein editierbares Formular — Scrim/Schließen darf getippten
  // Text nicht still wegwerfen. createValue() ist der geschützte Zustand (ohne Aufklapp-
  // Zustand des Ziel-Pickers, der nichts verliert).
  const createGuard = dirtyGuard(ctx, 'room-create');
  const createValue = () => {
    if (!ui.create) return null;
    const { kind, meetId, question, options, items } = ui.create;
    return { kind, meetId, question, options: [...(options || [])], items: [...(items || [])] };
  };

  // §7: Erstellungsflow öffnen — Standardziel aktiv, sonst nächstes Meet im Raum.
  // v6 A09b: Eine Umfrage OHNE Meet ist ein gültiger Fall (freie Chat-Umfrage). Nur der
  // Listenpunkt braucht zwingend ein Meet, an dem er hängt.
  const openCreate = (kind) => {
    ui.plusMenu = false;
    const meets = roomMeetOptions(ctx, info);
    if (!meets.length && kind !== 'poll') {
      ctx.toast(t('Dafür braucht es zuerst ein Meet'));
      return;
    }
    const target = meets.find((meet) => meet.status === 'active') || meets[0];
    ui.create = {
      kind, meetId: target ? target.id : null, pick: false, question: '', options: ['', ''], items: [''],
    };
    createGuard.reset(createValue());
    ctx.render();
  };

  // v7 A39: Der Weg „Aktueller Standort" fragt ERST HIER nach der Berechtigung — nicht
  // beim Öffnen des Raums und nicht beim Öffnen des Plus. Eine Ablehnung lässt den
  // Kartenweg offen und ändert keine globale Standortfreigabe (die lebt im Profil).
  // Runde 3 (K5): Zur Bestätigung gehört der Ort in Worten. Die Abfrage (ui/map.js ortAnPunkt —
  // dieselbe wie „Ort auf der Karte wählen" im Meet) läuft im Hintergrund; bis sie antwortet,
  // steht die Herkunft da. Findet sie nichts, bleibt es bei der Koordinate.
  const standortBestaetigen = (ort) => {
    ui.standort = { schritt: 'bestaetigen', laeuft: false, ort };
    ctx.render();
    ortAnPunkt(ort.lat, ort.lon).then((treffer) => {
      const jetzt = ui.standort?.ort;
      const worte = ortInWorten(treffer);
      if (!worte.name || !jetzt || jetzt.lat !== ort.lat || jetzt.lon !== ort.lon) return;
      ui.standort = { ...ui.standort, ort: { ...jetzt, name: worte.name, address: worte.address } };
      ctx.render();
    }).catch(() => {});
  };

  const standortAbfragen = (_daten, _knopf, ereignis) => {
    ui.standort = { ...(ui.standort || {}), schritt: 'wahl', laeuft: true, fehler: '' };
    ctx.render();
    if (!navigator.geolocation) {
      ui.standort = { schritt: 'wahl', laeuft: false, fehler: t('Dieses Gerät liefert keinen Standort. „Auf Karte wählen" geht weiterhin.') };
      ctx.render();
      return;
    }
    navigator.geolocation.getCurrentPosition(
      (position) => {
        standortBestaetigen({ quelle: 'aktuell', lat: position.coords.latitude, lon: position.coords.longitude });
      },
      () => {
        ui.standort = { schritt: 'wahl', laeuft: false, fehler: t('Ohne Standortfreigabe geht es nicht automatisch — „Auf Karte wählen" bleibt offen. Deine allgemeine Standort-Einstellung bleibt unverändert.') };
        ctx.render();
      },
      { enableHighAccuracy: false, timeout: 8000, maximumAge: 0, ausloeser: ereignis },
    );
  };

  bindActions(root, {
    ...blockActs(ctx),
    ...bildGrossAktionen(ctx),
    // R6 D6: Die Bewertungs-Frage an der Stelle der Meet-Box (raumBewertungsBox).
    ...bewertungsZeileAktionen(ctx),
    'open-details': () => {
      if (info.kind === 'crew') { nav.go('room.crewDetails', { crewId: info.crew.id }); return; }
      // v6 A13: Der Kopf des temporären Meet-Raums führt in das Meet, nicht in ein Profil.
      if (info.kind === 'meet') { nav.go('meet.details', { meetId: info.meet.id }); return; }
      nav.go('room.personDetails', { personId: info.person.id });
    },
    // R8-17: das Bild neben einer Nachricht → die Person.
    'nachricht-person': (data) => { if (data.person) nav.go('room.personDetails', { personId: data.person }); },
    // R8-12: das eine Personen- und das eine Gruppenmenü (profile.js) — Öffner im Kopf siehe raumMehrKnopf.
    ...friendMenuActs(ctx),
    ...crewMenuActs(ctx, { crewId: info.kind === 'crew' ? info.crew.id : null }),
    'open-meet': (data) => nav.go('meet.details', { meetId: data.meet }),
    'vote-room-poll': (data) => repo.voteRoomPoll(params.roomId, data.poll, data.option),
    'place-accept': (data) => antworten(data.request, true),
    'place-decline': (data) => antworten(data.request, false),
    'plus-menu': () => { ui.plusMenu = !ui.plusMenu; ctx.render(); },
    'plus-close': () => { ui.plusMenu = false; ctx.render(); },
    'menu-meet': () => { ui.plusMenu = false; startDraft(); },
    'menu-poll': () => openCreate('poll'),
    // Runde 3 (K4): „Liste" im Plus öffnet die Liste selbst — mit ihrem Inhalt oder dem
    // Leerzustand samt „Listenpunkt erstellen". Ohne Meet im Raum bleibt es beim Erstellen-Weg,
    // der das Meet zur Wahl stellt.
    'menu-list': () => {
      if (!panelMeet) { openCreate('list'); return; }
      ui.plusMenu = false;
      ui.panel = 'bring';
      ui.pollForm = false;
      ctx.render();
    },
    'liste-erstellen': () => openCreate('list'),
    'umfrage-erstellen': () => openCreate('poll'),
    // v7 A39: „Teilen → Standort" öffnet den einmaligen Standortweg im selben Host.
    'menu-location': () => { ui.plusMenu = false; ui.standort = { schritt: 'wahl' }; ctx.render(); },
    'loc-close': () => { ui.standort = null; ctx.render(); },
    'loc-back': () => { ui.standort = { schritt: 'wahl' }; ctx.render(); },
    'loc-current': standortAbfragen,
    'loc-map': () => { ui.standort = { schritt: 'karte', start: ui.standort?.ort || null }; ctx.render(); },
    // Gewählt ist, was unter der Nadel liegt: die Mitte der echten Karte.
    'loc-map-confirm': () => {
      const mitte = karteVon(STANDORT_WAHL)?.getCenter();
      if (!mitte) { ctx.toast(t('Die Karte lädt noch')); return; }
      standortBestaetigen({ quelle: 'karte', lat: mitte.lat, lon: mitte.lng });
    },
    'loc-send': () => {
      const ort = ui.standort?.ort;
      if (!ort) return;
      // Eigener strukturierter Datensatz (kind 'location') — im Verlauf gezeigt als Nachricht der
      // Person, die ihn geschickt hat. Name und Adresse nur, wenn die Abfrage sie gefunden hat.
      raumEreignisSchreiben(repo, params.roomId, {
        kind: 'location',
        label: ort.quelle === 'aktuell' ? 'Aktueller Standort' : 'Auf der Karte gewählt',
        lat: ort.lat,
        lon: ort.lon,
        quelle: ort.quelle,
        ...(ort.name ? { name: ort.name, address: ort.address || '' } : {}),
      });
      ui.standort = null;
      ui.chatPinned = false;
      // Kein Toast mehr: Die Nachricht im Verlauf IST die Rückmeldung — wie bei Text.
      ctx.render();
    },
    'standort-oeffnen': (data) => { ui.standortAnsicht = data.msg; ctx.render(); },
    'standort-zu': () => { ui.standortAnsicht = null; ctx.render(); },
    'standort-route': (data) => {
      const message = info.room.messages.find((entry) => entry.id === ui.standortAnsicht);
      if (!message) return;
      oeffneRoute({ name: standortTitel(message), address: message.address || '', lat: Number(message.lat), lon: Number(message.lon) }, data.provider);
    },
    // v7 A20c: Der markierte Titel bzw. die markierte Zeitzeile öffnet den kompakten
    // Abstimmzustand im vorhandenen Sheet-Host — ohne Routenwechsel.
    'variant-pick': (data) => { ui.variantPick = { kind: data.kind === 'activity' ? 'activity' : 'time' }; ctx.render(); },
    'variant-close': () => { ui.variantPick = null; ctx.render(); },
    // Runde 3 (K4) statt v5 A15: Eine leere Kachel öffnet ihren Bereich wie jede andere. Dort
    // steht, dass noch nichts da ist, und der Knopf zum Erstellen. Nochmals tippen schließt.
    'panel-empty': (data) => {
      ui.panel = ui.panel === data.panel ? null : data.panel;
      ui.pollForm = false;
      ctx.render();
    },
    // v5 A16a: weitere Elemente im Builder
    'cr-item-add': () => {
      readCreateFields(root, ui);
      ui.create.items = [...(ui.create.items || ['']), ''];
      ctx.render();
    },
    'cr-item-remove': (data) => {
      readCreateFields(root, ui);
      const index = Number(data.index);
      ui.create.items = (ui.create.items || []).filter((_, i) => i !== index);
      if (!ui.create.items.length) ui.create.items = [''];
      ctx.render();
    },
    // v6 A09c: beliebig viele Antworten, die ersten zwei sind Pflicht.
    'cr-opt-add': () => {
      readCreateFields(root, ui);
      ui.create.options = [...(ui.create.options || ['', '']), ''];
      ctx.render();
    },
    'cr-opt-remove': (data) => {
      readCreateFields(root, ui);
      const index = Number(data.index);
      ui.create.options = (ui.create.options || []).filter((_, i) => i !== index);
      while (ui.create.options.length < 2) ui.create.options.push('');
      ctx.render();
    },
    // v6 A10: „Vorschlag" öffnet den zweiten Auswahlzustand IM Raum. Erst Aktivität oder
    // Zeit führt in den gemeinsamen Flow — der Raum wird dabei nicht neu gebaut.
    'menu-suggest': () => { ui.plusMenu = false; ui.suggestPick = true; ctx.render(); },
    'suggest-close': () => { ui.suggestPick = false; ctx.render(); },
    'suggest-activity': () => {
      ui.suggestPick = false;
      nav.go('meet.proposeActivity', { meetId: panelMeet?.id || '', roomId: params.roomId });
    },
    'suggest-time': () => {
      ui.suggestPick = false;
      nav.go('meet.proposeTime', { meetId: panelMeet?.id || '', roomId: params.roomId });
    },
    // v6 A13b: Ein Mehrpersonen-Meet lebt in seinem eigenen Raum — die schmale Zeile im
    // 1:1-Chat führt dorthin, statt eine zweite Karte mit getrenntem Verlauf zu zeigen.
    // Runde 4 (E5): erst fragen, dann wechseln — siehe gruppeOeffnenSheet.
    'open-meet-room': (data) => { ui.gruppeOeffnen = { roomId: data.room, meetId: data.meet }; ctx.render(); },
    'gruppe-oeffnen-nein': () => { ui.gruppeOeffnen = null; ctx.render(); },
    'gruppe-oeffnen-ja': () => {
      const ziel = ui.gruppeOeffnen;
      ui.gruppeOeffnen = null;
      if (ziel?.roomId) nav.go('room.view', { roomId: ziel.roomId });
      else ctx.render();
    },
    'gruppe-oeffnen-meet': () => {
      const ziel = ui.gruppeOeffnen;
      ui.gruppeOeffnen = null;
      if (ziel?.meetId) nav.go('meet.details', { meetId: ziel.meetId });
      else ctx.render();
    },
    // Runde 4 (E8): das kleine Menü nach langem Drücken.
    'nachricht-menue-zu': () => { ui.nachrichtMenue = null; ctx.render(); },
    'nachricht-kopieren': (data) => {
      const message = info.room.messages.find((entry) => entry.id === data.msg);
      ui.nachrichtMenue = null;
      ctx.render();
      if (!message?.text) return;
      textKopieren(message.text).then((ok) => ctx.toast(ok ? t('Kopiert') : t('Kopieren ging nicht')));
    },
    'nachricht-melden': (data) => {
      const message = info.room.messages.find((entry) => entry.id === data.msg);
      ui.nachrichtMenue = null;
      if (message && message.authorId !== ME) {
        ui.reportFor = { messageId: message.id, personId: message.authorId, text: message.kind === 'text' ? message.text : standortTitel(message) };
        ui.blockGrund = null;
      }
      ctx.render();
    },
    'nachricht-loeschen': (data) => {
      const message = info.room.messages.find((entry) => entry.id === data.msg);
      const lage = ui.nachrichtMenue?.lage;
      ui.nachrichtMenue = null;
      if (!message || message.authorId !== ME || typeof repo.deleteMessage !== 'function') { ctx.render(); return; }
      const roomId = params.roomId;
      const schluessel = hinweisSchluessel(roomId, message.id, 'loeschen');
      const ausfuehren = () => {
        const ergebnis = repo.deleteMessage(roomId, message.id);
        if (ergebnis?.ok) return true;
        ctx.toast(t('Löschen hat nicht geklappt'));
        return false;
      };
      const timer = window.setTimeout(() => {
        const eintrag = vorgemerkteHinweise.get(schluessel);
        if (!eintrag) return;
        vorgemerkteHinweise.delete(schluessel);
        eintrag.ausfuehren();
        ctx.render();
      }, RUECKGAENGIG_MS);
      vorgemerkteHinweise.set(schluessel, {
        timer, ausfuehren, schluessel, roomId, meetId: null, hoehe: lage ? lage.unten - lage.oben : 0,
      });
      rueckmeldung('zurueck');
      ctx.render();
    },
    'loeschen-zurueck': (data) => {
      const schluessel = hinweisSchluessel(params.roomId, data.msg, 'loeschen');
      const eintrag = vorgemerkteHinweise.get(schluessel);
      if (eintrag) window.clearTimeout(eintrag.timer);
      vorgemerkteHinweise.delete(schluessel);
      ctx.render();
    },
    'cr-close': () => {
      readCreateFields(root, ui);
      const close = () => { ui.create = null; ctx.render(); };
      if (!createGuard.confirm(createValue(), close)) return;
      close();
    },
    'cr-pick': () => { readCreateFields(root, ui); ui.create.pick = !ui.create.pick; ctx.render(); },
    // Leerer data-meet = „Ohne Meet"; die Auswahl schließt den Picker ruhig zurück.
    'cr-target': (data) => { readCreateFields(root, ui); ui.create.meetId = data.meet || null; ui.create.pick = false; ctx.render(); },
    'cr-send': () => submitCreate(root, ctx, info, createGuard),
    'meet-suggest': () => startDraft(),
    // Runde 3 (K3): die Vorschläge unter Nachrichten (Regeln bei raumHinweise).
    'hinweis-los': (data) => {
      const hinweis = raumHinweise(ctx, info, panelMeet).get(data.msg);
      if (!hinweis || hinweis.art !== data.art || hinweis.zustand !== 'offen') return;
      if (hinweis.art === 'plan') { planAlsMeet(hinweis.plan); return; }
      if (hinweis.art === 'meet') { nav.go('meet.details', { meetId: hinweis.meetZiel }); return; }
      const { schluessel, meetId } = hinweis;
      let ausfuehren;
      if (hinweis.art === 'mitfahrt') {
        // Runde 5 (P4, E1): eigenes Angebot → ich fahre (Plätze aus dem Satz) · fremdes Angebot → ich
        // steige ein (fährt die Person noch nicht: „sucht noch" + Hinweis) · eigene Suche → ich suche ·
        // fremde Suche → ich fahre und nehme die Person mit. Dieselbe Frist mit „Rückgängig" wie bisher.
        const { fahrt, autorId, plaetze } = hinweis;
        ausfuehren = () => {
          const melden = (ergebnis) => {
            const meldung = mitfahrMeldung(ergebnis, repo.getPerson(autorId)?.name || '');
            if (ergebnis?.ok === false) rueckmeldung('abgelehnt');
            if (meldung) ctx.toast(meldung);
            return ergebnis?.ok !== false;
          };
          const ergebnis = mitfahrtAusChat(ctx, meetId, { art: fahrt, autorId, plaetze });
          if (ergebnis && typeof ergebnis.then === 'function') {
            ergebnis.then((antwort) => { melden(antwort); ctx.render(); }, () => {});
            return true;
          }
          return melden(ergebnis);
        };
      } else {
        // Runde 8 (R8-26): Uhrzeit, Tag oder Ort ans Meet — siehe insMeetUebernehmen.
        ausfuehren = () => insMeetUebernehmen(ctx, meetId, hinweis);
      }
      const timer = window.setTimeout(() => {
        const eintrag = vorgemerkteHinweise.get(schluessel);
        if (!eintrag) return;
        vorgemerkteHinweise.delete(schluessel);
        if (eintrag.ausfuehren() !== false) uebernommeneHinweise.add(schluessel);
        ctx.render();
      }, RUECKGAENGIG_MS);
      vorgemerkteHinweise.set(schluessel, {
        timer, ausfuehren, schluessel, roomId: params.roomId, meetId,
      });
      rueckmeldung('tipp');
      ctx.render();
    },
    'hinweis-zurueck': (data) => {
      const schluessel = hinweisSchluessel(params.roomId, data.msg, data.art);
      const eintrag = vorgemerkteHinweise.get(schluessel);
      if (eintrag) window.clearTimeout(eintrag.timer);
      vorgemerkteHinweise.delete(schluessel);
      ctx.render();
    },
    'hinweis-weg': (data) => {
      hinweisWeglegen(hinweisSchluessel(params.roomId, data.msg, data.art));
      ctx.render();
    },
    'undo-adopt': (data) => {
      if (!ui.undoneAdoptions) ui.undoneAdoptions = {};
      ui.undoneAdoptions[data.msg] = true;
      ctx.render();
    },
    'room-poll-open': (data) => { ui.openPoll = data.poll; ctx.render(); },
    'variant-vote': (data) => { if (panelMeet) repo.voteVariant(panelMeet.id, data.variant); },
    // v5 A14: Der Chooser bekommt den Raum mit, damit das Ergebnis auch im Chat landet.
    'variant-add': (data) => nav.go(data.kind === 'activity' ? 'meet.proposeActivity' : 'meet.proposeTime', { meetId: data.meet, roomId: params.roomId }),
    'catch-open': () => { ui.catchOpen = true; ctx.render(); },
    'catch-close': () => { ui.catchOpen = false; ui.catchDismissed = true; ctx.render(); },
    send,
    ...discardActions(ctx),
  });

  // Geteilte Panel-Interaktionen (panel-toggle, toggle-bring, add-bring, vote-poll,
  // toggle-add-poll, add-poll) — dokumentierte API aus ui/meet-panels.js.

  if (panelMeet) bindMeetPanels(root, ctx, panelMeet);

  // Erstellungsflow: Tippen bleibt lokal (Fokus-Konvention), Enter sendet.
  if (ui.create) {
    const felder = [
      'cr-q',
      ...(ui.create.options || []).map((_, i) => `cr-opt-${i}`),
      ...(ui.create.items || []).map((_, i) => `cr-item-${i}`),
    ];
    felder.forEach((id) => {
      const field = root.querySelector(`#${id}`);
      if (!field) return;
      field.addEventListener('input', () => readCreateFields(root, ui));
      field.addEventListener('keydown', (event) => {
        if (event.key !== 'Enter') return;
        event.preventDefault();
        submitCreate(root, ctx, info);
      });
    });
    // Fokus nur beim Öffnen setzen — ein Zielwechsel soll den Cursor nicht zurückreißen.
    if (!ui.create.focused) {
      ui.create.focused = true;
      root.querySelector('#cr-q, #cr-item')?.focus();
    }
  }

  // Eingaben lokal halten (Fokus-Konvention) — Repo erst beim Absenden.
  const composer = root.querySelector('#room-composer');
  const sendButton = root.querySelector('#room-send');
  const mentionBox = root.querySelector('#mention-box');
  let members;
  if (info.kind === 'crew') members = info.crew.memberIds.filter((id) => id !== ME).map((id) => repo.getPerson(id)).filter(Boolean);
  else if (info.kind === 'meet') members = meetRoomOthers(ctx, info.meet);
  else members = [info.person];

  // Solange die @-Auswahl offen ist, tritt der Zusatzblock (Catch-up/Anstupsen/Impuls)
  // zurück — die Auswahl liegt sauber über der Chatfläche statt über einer Karte.
  const extraBlock = root.querySelector('#room-extra');
  const closeMentions = () => {
    if (mentionBox) mentionBox.style.display = 'none';
    if (extraBlock) extraBlock.style.display = '';
  };
  const applyMention = (name) => {
    if (!composer) return;
    composer.value = composer.value.replace(/@([\wÄÖÜäöüß-]*)$/, `@${name} `);
    ui.draftMsg = composer.value;
    if (sendButton) sendButton.style.display = composer.value.trim() ? 'flex' : 'none';
    closeMentions();
    composer.focus();
  };
  const updateMentions = () => {
    if (!mentionBox || !composer) return;
    const match = /(?:^|\s)@([\wÄÖÜäöüß-]*)$/.exec(composer.value);
    if (!match) { closeMentions(); return; }
    const query = match[1].toLowerCase();
    const hits = members.filter((person) => person.name.toLowerCase().startsWith(query)).slice(0, 4);
    if (!hits.length) { closeMentions(); return; }
    // Namenszeile wie 07.8: „Lena (Tina)" — das private Label der besonderen Person in Klammern.
    const settings = repo.getSettings();
    mentionBox.innerHTML = hits.map((person, index) => {
      const marker = personMarker(person.id, settings);
      const suffix = marker?.kind === 'special' && marker.label ? ` (${marker.label})` : '';
      // v5 A32c: ALLE Zeilen haben dieselbe Geometrie. Vorher bekam die oberste Zeile den
      // Hintergrund STATT der Trennlinie und war dadurch 1 px niedriger. Jetzt trägt jede
      // Zeile dieselbe Trennlinie (die erste transparent), und die Hervorhebung der
      // vorgeschlagenen Person ist ausschließlich Farbe.
      // Außerdem stehen Best-/Special-Markierungen hier sichtbar am Avatar — dafür sorgt
      // dieselbe Avatar-Komponente wie überall, statt eines lokal gebauten Kreises.
      return `<div data-mention="${esc(person.name)}" style="display:flex;align-items:center;gap:9px;padding:9px 12px;cursor:pointer;border-top:1px solid ${index === 0 ? 'transparent' : 'var(--ink-a05)'};${index === 0 ? 'background:var(--paper);' : ''}">
<span style="display:flex;flex:none;pointer-events:none">${personAvatar(person, { size: 24, fontSize: 9, marker })}</span>
<span style="font-size:13px;font-weight:${index === 0 ? 650 : 600};${index === 0 ? '' : 'color:var(--ink-soft);'}pointer-events:none;min-width:0;overflow:hidden;text-overflow:ellipsis;white-space:nowrap">${esc(person.name + suffix)}</span>
</div>`;
    }).join('');
    mentionBox.style.display = 'block';
    if (extraBlock) extraBlock.style.display = 'none';
    mentionBox.querySelectorAll('[data-mention]').forEach((row) => {
      row.addEventListener('mousedown', (event) => { event.preventDefault(); applyMention(row.dataset.mention); });
    });
  };

  if (composer) {
    composer.addEventListener('input', () => {
      ui.draftMsg = composer.value;
      if (sendButton) sendButton.style.display = composer.value.trim() ? 'flex' : 'none';
      updateMentions();
    });
    composer.addEventListener('keydown', (event) => {
      if (event.key === 'Enter') {
        event.preventDefault();
        const firstMention = mentionBox?.style.display === 'block' && mentionBox.querySelector('[data-mention]');
        if (firstMention) applyMention(firstMention.dataset.mention);
        else send();
      }
      if (event.key === 'Escape') closeMentions();
    });
    composer.addEventListener('blur', () => window.setTimeout(closeMentions, 120));
    if (ui.refocusComposer) {
      ui.refocusComposer = false;
      composer.focus();
    }
  }
  // Runde 3 (K5): echte Karten statt der gezeichneten, per Zeiger verschobenen Fläche —
  // Auswahl, Vorschau, große Ansicht und die Kartenbilder im Verlauf.
  standortKartenBinden(root, ctx, panelMeet);
  standortBilderBinden(root);
  bildGrossBinden(root, ctx);

  // v7 A41: Die feste Panel-Ebene beginnt am Rahmen, nicht am Kopf. Versatz und
  // Leseraum werden am echten Baum gemessen und gemerkt; der nächste Aufbau trägt sie
  // schon im Markup. So bleibt die Ebene eine Überlagerung, ohne dass die Scrollfläche
  // ihre Höhe von ihr bezieht.
  const scroll = root.querySelector('.screen-scroll');
  const panelEbene = root.querySelector('.screen-overlay-top');
  const kopfEbene = root.querySelector('.screen-header');
  const panelLageMessen = () => {
    if (!document.contains(panelEbene) || !document.contains(scroll)) return;
    const traeger = panelEbene.firstElementChild;
    const kopfUnten = kopfEbene.offsetTop + kopfEbene.offsetHeight;
    const versatz = Math.max(0, Math.round(kopfUnten - panelEbene.offsetTop));
    if (traeger && Math.round(parseFloat(getComputedStyle(traeger).paddingTop) || 0) !== versatz) {
      traeger.style.paddingTop = `${versatz}px`;
    }
    const inset = Math.max(0, Math.round(panelEbene.offsetTop + panelEbene.offsetHeight - kopfUnten + 10));
    const vorher = Math.round(parseFloat(getComputedStyle(scroll).paddingTop) || 0);
    if (vorher !== inset) {
      // Wächst oder schrumpft das Panel (Liste/Umfragen aufklappen), verschiebt der
      // geänderte Innenabstand den gesamten Inhalt. Der gelesene Ausschnitt bleibt nur
      // stehen, wenn die Scrollposition um denselben Betrag mitgeht. Die Position wird
      // VOR der Änderung gelesen: beim Schrumpfen klemmt der Browser sie sonst schon
      // selbst, und ein zusätzlicher Abzug würde die Ansicht doppelt verschieben.
      const vorherTop = scroll.scrollTop;
      scroll.style.paddingTop = `${inset}px`;
      const gemerkt = ui.panelLage && ui.panelLage.roomId === params.roomId;
      if (gemerkt && vorherTop > 0) scroll.scrollTop = vorherTop + (inset - vorher);
    }
    ui.panelLage = { roomId: params.roomId, versatz, inset };
  };
  if (scroll && panelEbene && kopfEbene) {
    panelLageMessen();
    // Beim allerersten Aufbau sind die Schriften unter Umständen noch nicht geladen; die
    // Panelkarte ist dann ein paar Pixel niedriger. Sobald sie stehen, wird EINMAL
    // nachgemessen — ohne Rerender, damit nichts blinkt.
    if (document.fonts && document.fonts.status !== 'loaded') {
      document.fonts.ready.then(panelLageMessen).catch(() => {});
    }
  } else if (!panelEbene) {
    ui.panelLage = null;
  }

  // Die EINE Scrollfläche (Panel + Chat) startet am jüngsten Ende und bleibt dort,
  // solange man unten steht; weiter oben gescrollt bleibt die Position erhalten.
  if (scroll) {
    const nearBottom = scroll.scrollHeight - scroll.clientHeight - scroll.scrollTop < 60;
    if (!ui.chatPinned || nearBottom) {
      scroll.scrollTop = scroll.scrollHeight;
      ui.chatPinned = true;
    }
    // Runde 4 (gemessen): app.js setzt nach dem Binden die beim Render-Beginn gemerkte Lage noch
    // einmal (restoreScroll, C4). Ohne diesen Schritt fiel der Chat danach auf die alte Lage zurück:
    // Die eigene Nachricht — und der Vorschlag darunter — lagen unter der Eingabezeile, und nach
    // oben gescrollt sprang der Chat beim Senden gar nicht mehr ans Ende. Die Entscheidung des
    // Raums (ans Ende bzw. Panel-Ausgleich oben) wird deshalb sofort als gemerkte Lage übernommen —
    // im selben Durchlauf, also ohne ein Zwischenbild.
    captureScroll(root);
  }
}

// Eingaben des Erstellungsflows lokal übernehmen (Rerender zerstört sonst den Fokus).
function readCreateFields(root, ui) {
  if (!ui.create) return;
  const value = (id) => root.querySelector(`#${id}`)?.value;
  if (value('cr-q') !== undefined) ui.create.question = value('cr-q');
  // v6 A09c: Die Antworten sind eine Liste — Frage und Antworten liegen auch im
  // Zustandsmodell getrennt, nicht mehr als question/optionA/optionB nebeneinander.
  const antworten = [...root.querySelectorAll('[id^="cr-opt-"]')];
  if (antworten.length) ui.create.options = antworten.map((feld) => feld.value);
  // v5 A16a: beliebig viele Zeilen — jede lebt an ihrer Stelle im Entwurf.
  const zeilen = [...root.querySelectorAll('[id^="cr-item-"]')];
  if (zeilen.length) ui.create.items = zeilen.map((feld) => feld.value);
}

// §7: leere Pflichtfelder → kurzer Toast (kein Sheet). Danach steht der Inhalt im Chat
// UND beim zugeordneten Meet; das Panel öffnet den passenden Bereich.
function submitCreate(root, ctx, info, guard) {
  const { repo, ui, params } = ctx;
  if (!ui.create) return;
  readCreateFields(root, ui);
  const done = () => guard?.clear();
  const create = ui.create;
  const meets = roomMeetOptions(ctx, info);
  // v6 A09b: Ohne Meet ist erlaubt — dann ist `target` bewusst null.
  const target = create.meetId ? meets.find((meet) => meet.id === create.meetId) : null;
  if (!target && create.kind !== 'poll') { ctx.toast(t('Dafür braucht es zuerst ein Meet')); return; }
  // Der Panel-Bereich öffnet sich nur, wenn das Ziel auch das Panel-Meet ist.
  const inPanel = Boolean(target) && panelMeetFor(ctx, info)?.id === target.id;

  if (create.kind === 'poll') {
    const question = (create.question || '').trim();
    const options = [...new Set((create.options || []).map((wert) => (wert || '').trim()).filter(Boolean))];
    if (!question) { ctx.toast(t('Die Frage fehlt noch')); return; }
    if (options.length < 2) { ctx.toast(t('Zwei Antworten braucht es mindestens')); return; }
    done();
    ui.create = null;
    if (inPanel) { ui.panel = 'polls'; ui.openPoll = null; }
    ui.catchDismissed = true;
    ui.chatPinned = false;
    if (!target) {
      // v6 A09b: Die freie Umfrage gehört dem Raum. Sie ist dort abstimmbar — ein reiner
      // Chatsatz wäre eine Wahl gewesen, die zu nichts führt.
      repo.addRoomPoll(params.roomId, { question, options });
      ctx.toast(t('Umfrage im Raum'));
      return;
    }
    repo.addPoll(target.id, { question, options });
    repo.sendMessage(params.roomId, `Umfrage zu „${target.title}“: ${question} · ${options.join(' / ')}`);
    ctx.toast(t('Umfrage bei „{titel}“', { titel: target.title }));
    return;
  }

  // v5 A16a: Die erste Zeile ist Pflicht, weitere sind freiwillig. Leere Zeilen fallen
  // still weg, Doppelte werden zusammengefasst.
  const labels = [...new Set((create.items || []).map((wert) => (wert || '').trim()).filter(Boolean))];
  if (!labels.length) { ctx.toast(t('Da fehlt noch ein Eintrag')); return; }
  done();
  ui.create = null;
  if (inPanel) ui.panel = 'bring';
  ui.catchDismissed = true;
  ui.chatPinned = false;
  labels.forEach((label) => repo.addBringItem(target.id, label));
  // v5 A16a: EINE Nachricht für den ganzen Vorgang — sonst flutet jede Liste den Chat.
  repo.sendMessage(params.roomId, `Auf der Liste für „${target.title}“: ${labels.join(', ')}`);
  ctx.toast(tn(labels.length, 'Auf der Liste bei „{titel}“', '{n} Punkte bei „{titel}“', { titel: target.title }));
}

// =====================================================================================
// room.allMeets — 07.4 (der EINE gemeinsame Meet-Browser-Body, Kontext aus dem Raum)
// =====================================================================================

function renderAllMeets(ctx) {
  const { params } = ctx;
  const info = resolveRoom(ctx, params.roomId);
  if (!info) return { html: emptyScreen(t('Gemeinsame Meets')), bind() {} };
  // Eigene Topbar (07.4: Zurück + Titel + Raumname); der geteilte Browser-Header trägt
  // darunter die Umschalter Kommend|Verlauf und Liste|Kalender|Karte.
  // v3.1 §3: Der Raum nutzt denselben Browser MIT Kommend/Verlauf-Umschalter
  // (history:'switch'); der Default des Browsers bleibt davon unberührt.
  const opts = {
    context: info.context, uiKey: 'room-all-meets', title: ' ', back: false, history: 'switch',
  };
  // Runde 8 (R8-12): Die Seite heißt wie die Menüzeile, die hierher führt — „Gemeinsame Meets".
  const topbar = `<div style="display:flex;align-items:center;gap:10px;padding:12px 20px 0">
<button data-act="back" style="border:0;background:transparent;padding:0;display:flex;cursor:pointer"><span style="pointer-events:none;display:flex">${backArrow('var(--ink)', 22)}</span></button>
<div style="display:flex;flex-direction:column;min-width:0"><span style="font-family:'Bricolage Grotesque',sans-serif;font-size:22px;font-weight:650">${t('Gemeinsame Meets')}</span><span style="font-size:11.5px;color:var(--muted);white-space:nowrap;overflow:hidden;text-overflow:ellipsis">${esc(info.title)}</span></div>
</div>`;
  // v6 A14: Die Bausteinform statt der String-Doppelform. Die String-Form hängt „+ Meet"
  // ans ENDE DES INHALTS (inflowCta) — der Knopf wanderte deshalb beim Scrollen mit und
  // lag bei Scrollposition 0 mehrere hundert Pixel unter der Screenkante. Header, Inhalt,
  // CTA und Picker gehen jetzt sauber auf die drei Scaffold-Ebenen; der Knopf liegt fest
  // in .screen-bottom und der Inhalt bleibt über bottomInset vollständig erreichbar.
  const parts = meetBrowserParts(ctx, opts);
  const html = screenScaffold({
    header: `${topbar}${parts.header}`,
    body: parts.body,
    // Runde 6 (D7): „+ Meet" schwebt in jeder Ansicht unten rechts — auch über der Karte.
    bottom: parts.cta,
    bottomInset: parts.contentInset,
    overlays: parts.overlays,
    scrollKey: `room-all-meets-${params.roomId}-${parts.view}`,
  });
  return {
    html,
    bind(root) {
      bindMeetBrowserBody(root, ctx, opts);
    },
  };
}

// =====================================================================================
// Ressourcen im Profil-Stil (07.5/07.6): Verfügbarkeit · Kapazität · wer sie hat
// =====================================================================================

// v3.1 §6: ALLE Interessen-/Ressourcendaten kommen projiziert aus
// repo.projectProfile(person, {crewId}) — Interessen nach echter Punktebewertung,
// Ressourcen nur, wenn der Besitzer sie für diesen Betrachter freigegeben hat,
// Verfügbarkeit zweistufig ('immer' | 'manchmal'), Kapazität als Zahl.
// Es gibt KEINE Ressourcen-Tags mehr (weder hier noch im Chat): ein Klick klappt nur
// die Details je Besitzer auf. Eigene Ressourcen bearbeitet man im eigenen Profil.

// repo.getMe() liefert nur die Identität — die eigenen Profildaten stehen in den
// Settings. Sie werden hier zu einer Person zusammengesetzt und ebenso projiziert,
// damit nichts statisch kopiert wird.
function meAsPerson(ctx) {
  const settings = ctx.repo.getSettings();
  return {
    ...ctx.repo.getMe(),
    interests: settings.interests || [],
    interestLevels: settings.interestLevels || {},
    resources: settings.resources || [],
    resourceShares: settings.resourceShares || {},
    resourceMeta: settings.resourceMeta || {},
  };
}

function profileOf(ctx, person, viewerContext = {}) {
  const source = person.id === ME ? meAsPerson(ctx) : person;
  return ctx.repo.projectProfile(source, viewerContext) || { interestList: [], resourceList: [] };
}

function availabilityDot(kind) {
  if (kind === 'immer') {
    return `<span style="width:20px;height:20px;border-radius:50%;background:var(--green);border:2px solid var(--surface);box-sizing:border-box;display:flex;align-items:center;justify-content:center;flex:none;margin-left:-7px"><svg width="10" height="10" viewBox="0 0 24 24" fill="none"><path d="m6.5 12.5 3.5 3.5 7.5-8" stroke="var(--on-accent)" stroke-width="3" stroke-linecap="round" stroke-linejoin="round"></path></svg></span>`;
  }
  // v6 A19g: „Manchmal" trug einen GRAUEN Halbkreis auf beigem Grund — neben dem grünen
  // „Immer" las sich das als „nichts", nicht als eigener Zustand. Warmes Amber macht die
  // Teilzeit-Verfügbarkeit zu einer eigenen Aussage, ohne ein Ablehnungs-Rot zu benutzen.
  return `<span aria-label="${esc(t('Manchmal verfügbar'))}" style="width:20px;height:20px;border-radius:50%;background:${AMBER_FLAECHE};border:2px solid var(--surface);box-sizing:border-box;display:flex;overflow:hidden;flex:none;margin-left:-7px"><span style="width:50%;background:${AMBER_ZEICHEN}"></span></span>`;
}

// Ein Wert für beide Stellen (Zeile und aufgeklappte Details) — die Farbe ist Bedeutung.
const AMBER_FLAECHE = 'var(--orange-tint)';
const AMBER_ZEICHEN = 'var(--orange)';

// Aufgeklappte Details je Besitzer — ruhige Zeilen, keine Tags, keine Bearbeitung.
function ownerDetails(ctx, entry) {
  const owners = [...entry.owners].sort((a, b) => (a.person.id === ME ? 1 : 0) - (b.person.id === ME ? 1 : 0));
  const rows = owners.map((owner, index) => {
    const mine = owner.person.id === ME;
    const always = owner.meta.availability === 'immer';
    // v6 A19f: Eigenschaften LINKS, Person RECHTS. Vorher stand die Person ganz links und
    // die Kapazität klebte an der rechten Kante — beim Aufklappen sprangen die Spalten
    // gegenüber der geschlossenen Zeile. Der Avatar ist jetzt der rechte Anker, die
    // Verfügbarkeit fluchtet mit fester Breite untereinander.
    return `<div style="display:flex;align-items:center;gap:9px;padding:9px 0;${index ? 'border-top:1px solid var(--ink-a05);' : ''}">
<span style="display:flex;align-items:center;gap:6px;flex:none;width:104px;padding-left:7px">${availabilityDot(owner.meta.availability)}<span style="font-size:11.5px;font-weight:650;color:${always ? 'var(--green-dark)' : AMBER_ZEICHEN}">${always ? t('Immer') : t('Manchmal')}</span></span>
<span style="display:flex;align-items:center;gap:3px;flex:none;width:34px">${owner.meta.capacity
      ? `${personCapSvg}<span style="font-size:11.5px;font-weight:650;color:var(--ink-soft);font-variant-numeric:tabular-nums">${owner.meta.capacity}</span>`
      : ''}</span>
<span style="flex:1;min-width:0"></span>
<span style="font-size:13px;font-weight:650;color:var(--ink);flex:none;max-width:120px;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;text-align:right">${mine ? t('Du') : esc(owner.person.name)}</span>
<span style="display:flex;flex:none;pointer-events:none">${personAvatar(owner.person, { size: 24, fontSize: 9, marker: personMarker(owner.person.id, ctx.repo.getSettings()) })}</span>
</div>`;
  }).join('');
  // v7 A31 (spec/06 §1): Der Satz „Deine Ressource im Profil bearbeiten" entfällt.
  // Eine eigene Ressource öffnet ihre Bearbeitung direkt über die Zeile selbst — ein
  // zusätzlicher Hinweis darunter war ein Umweg und keine Information.
  const mineHint = '';
  return `<div style="background:var(--paper);border-radius:12px;padding:1px 12px;margin:0 0 10px">${rows}${mineHint}</div>`;
}

// entry: {label, owners:[{person, meta}]} — Zeile: Icon · Name · Verfügbarkeit · für · wer.
//
// v4 C7-Besitzer / COMPONENT_RULES 7: „In Personenzeilen ist der Besitzer einer Ressource
// klar." Vorher stand hier das MAXIMUM der Kapazität aller Besitzer direkt neben dem Namen
// der besuchten Person — auf Tobis Seite las man „12" (mein Wert) statt seiner 6.
// Jetzt gilt: options.ownerId nennt die Person, um die es in dieser Zeile geht (Personen-
// profil) → es steht ausschließlich IHR Wert. Ohne ownerId (Crew-Zusammenfassung) ist die
// Zahl ausdrücklich eine Gruppenangabe: gleiche Werte als eine Zahl, verschiedene als
// Spanne „6–12". Nie ein einzelner Wert, der wie der Wert einer Person aussieht.
function capacitySummary(entry, ownerId) {
  if (ownerId) {
    const owner = entry.owners.find((item) => item.person.id === ownerId);
    return owner?.meta.capacity ? String(owner.meta.capacity) : '';
  }
  const values = [...new Set(entry.owners.map((owner) => owner.meta.capacity).filter(Boolean))].sort((a, b) => a - b);
  if (!values.length) return '';
  if (values.length === 1) return String(values[0]);
  return `${values[0]}–${values[values.length - 1]}`;
}

// v5 A11: Geschlossen zeigt die Zeile die kompakte Zusammenfassung. Aufgeklappt loest
// sie sich AUF — Verfuegbarkeitspunkte, Kapazitaet und Besitzerstapel verschwinden aus
// der Zeile, weil dieselbe Information darunter je Person in einer eigenen Zeile steht.
// Vorher standen beide Darstellungen gleichzeitig auf gleicher Hoehe.
function resourceRow(ctx, entry, index, options = {}) {
  const open = ctx.ui.resOpen === entry.label;
  const kinds = [...new Set(entry.owners.map((owner) => owner.meta.availability))]
    .sort((a, b) => (a === 'immer' ? 1 : 0) - (b === 'immer' ? 1 : 0)); // besseres vorn (zuletzt)
  const stack = `<span style="display:flex;align-items:center;padding-left:7px;flex:none">${kinds.map((kind) => availabilityDot(kind)).join('')}</span>`;
  const capacity = capacitySummary(entry, options.ownerId);
  const capacityHtml = capacity
    ? `<span style="display:flex;align-items:center;justify-content:flex-end;gap:3px;width:52px;flex:none">${personCapSvg}<span style="font-size:12px;font-weight:650;color:var(--ink-soft);font-variant-numeric:tabular-nums">${esc(capacity)}</span></span>`
    : `<span style="width:52px;flex:none"></span>`;
  // v7 spec/08 §1: auch dieser kleine Besitzerstapel liest den kanonischen Bilddatensatz.
  const ownerAvatars = `<span style="display:flex;justify-content:flex-end;width:34px;flex:none"><span style="display:flex;padding-left:7px">${entry.owners.slice(0, 2).map(({ person }) => `<span style="position:relative;display:inline-block;width:18px;height:18px;margin-left:-7px;isolation:isolate"><span style="display:block;width:18px;height:18px;border-radius:50%;${stackSeparator('var(--surface)')}">${personAvatar(person, { size: 18, fontSize: 7, compact: true, dotBorder: 'var(--surface)', marker: personMarker(person.id, ctx.repo.getSettings()) })}</span></span>`).join('')}</span></span>`;
  return `<div data-act="res-open" data-label="${esc(entry.label)}" aria-expanded="${open}" style="display:flex;align-items:center;gap:10px;padding:11px 0;border-top:1px solid var(--ink-a05);cursor:pointer">
<span style="pointer-events:none;display:flex">${ressourcenZeichen(entry)}</span>
<span style="font-size:14px;font-weight:600;flex:1;min-width:0;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;pointer-events:none">${esc(wortAnzeige(entry.label))}</span>
<span style="pointer-events:none;display:contents">${open ? '' : `${stack}${capacityHtml}${ownerAvatars}`}</span>
<span style="pointer-events:none;display:flex;transform:rotate(${open ? 90 : 0}deg);transition:transform .16s ease-out">${rowChevron}</span>
</div>${open ? ownerDetails(ctx, entry) : ''}`;
}

function interestDots(level, color, empty = 'var(--field-deep)') {
  return `<span style="display:flex;gap:3px;flex:none">${[1, 2, 3].map((step) => `<span style="width:7px;height:7px;border-radius:50%;background:${step <= level ? color : empty}"></span>`).join('')}</span>`;
}

function profileBox(title, rowsHtml, headerRight = '', rolle = '') {
  return `<div${rolle ? ` data-role="${rolle}"` : ''} style="background:var(--surface);border-radius:20px;border:1px solid var(--ink-a07);padding:6px 16px;flex:none">
<div style="display:flex;justify-content:space-between;align-items:baseline;padding:10px 0 4px"><span style="font-size:11px;font-weight:650;letter-spacing:.09em;text-transform:uppercase;color:var(--muted-light)">${title}</span>${headerRight}</div>
${rowsHtml}
</div>`;
}

// =====================================================================================
// room.crewDetails — die Gruppenseite
//
// Runde 8 (R8-25, Jonathan: „Gruppenseite: Mitglieder (eine Liste, hinzufügen, Admin sichtbar, zum
// Admin machen) → Gemeinsame Meets (nächste 2 + klares ‚Alle') → Interessen → Ressourcen. Bei
// Interessen/Ressourcen nur der Titel. Beim Aufklappen wandern die Bilder vom Stapel in die Liste
// und zurück."):
//   · Mitglieder: EINE Liste von oben nach unten — ich, dann wer gerade frei ist, dann die anderen,
//     zuletzt wer laut seinen festen Zeiten keine Zeit hat. Keine Überschriften mehr („Gerade frei",
//     „Alle anderen"): frei sagen der grüne Punkt am Bild und die Zeile darunter. Wer Admin ist, steht
//     rechts in seiner Zeile. Admins sehen „Personen hinzufügen" und „Admins wählen".
//   · Beim Aufklappen fliegen die Bilder aus dem Stapel an ihren Platz in der Liste, beim Zuklappen
//     zurück; wer im Stapel nur als „+n" stand, kommt aus dieser Scheibe und geht dorthin.
//   · Gemeinsame Meets: die nächsten zwei (ein laufendes zuerst), darunter klar „Alle ansehen".
//   · Interessen und Ressourcen: nur der Titel. Eine Ressource zeigt beim Antippen, wer sie hat —
//     rechts in der Zeile steht nichts mehr.
// =====================================================================================

// Alle folgenden Listen lesen ausschließlich projizierte Profile (repo.projectProfile):
// Interessen kommen bereits nach echter Punktebewertung sortiert, Ressourcen nur, wenn
// sie für diesen Betrachter (Crew bzw. Freund) freigegeben sind.

function crewPeople(ctx, crew) {
  return [ctx.repo.getMe(), ...crew.memberIds.filter((id) => id !== ME).map((id) => ctx.repo.getPerson(id)).filter(Boolean)];
}

function crewSharedInterests(ctx, crew) {
  const owners = new Map();
  const viewer = { crewId: crew.id };
  for (const person of crewPeople(ctx, crew)) {
    for (const entry of profileOf(ctx, person, viewer).interestList || []) {
      const key = entry.label.toLowerCase();
      if (!owners.has(key)) owners.set(key, { label: entry.label, people: [], score: 0 });
      const bucket = owners.get(key);
      bucket.people.push(person);
      bucket.score += entry.level;
    }
  }
  // „wie oft gemeinsam" ist eine echte Zahl; bei Gleichstand entscheidet die echte
  // Punktesumme — nichts wird als Beliebtheit erfunden.
  return [...owners.values()].filter((entry) => entry.people.length >= 2)
    .sort((a, b) => (b.people.length - a.people.length) || (b.score - a.score));
}

function crewResourceEntries(ctx, crew) {
  const entries = new Map();
  const viewer = { crewId: crew.id };
  for (const person of crewPeople(ctx, crew)) {
    for (const resource of profileOf(ctx, person, viewer).resourceList || []) {
      const key = resource.label.toLowerCase();
      if (!entries.has(key)) entries.set(key, { label: resource.label, owners: [] });
      entries.get(key).owners.push({ person, meta: resource });
    }
  }
  // Im Avatar-Stapel steht das eigene Bild vorn (reference 07.5: „To" hinten, „Jo" davor).
  for (const entry of entries.values()) {
    entry.owners.sort((a, b) => (a.person.id === ME ? 1 : 0) - (b.person.id === ME ? 1 : 0));
  }
  // v4 P0-4-Res-Sortierung: „Ressourcen nach realer Verfügbarkeit" (APP_REQUIREMENTS).
  // Vorher war die Besitzeranzahl der Primärschlüssel — dadurch stand „Große Küche"
  // (durchgehend IMMER verfügbar) hinter drei nur MANCHMAL verfügbaren Einträgen und die
  // von repo.projectProfile gelieferte Verfügbarkeitsordnung war verworfen.
  const availabilityRank = (entry) => (entry.owners.some((owner) => owner.meta.availability === 'immer') ? 0 : 1);
  return [...entries.values()].sort((a, b) => (availabilityRank(a) - availabilityRank(b))
    || (b.owners.length - a.owners.length)
    || a.label.localeCompare(b.label));
}

// R6 D3: Auch die Meet-Zeilen unter „Gemeinsam erlebt" sind jetzt sichtbare Zeilen — vorher
// trennte sie nur eine Haarlinie, und dass sie in das Meet führen, stand nirgends.
// Der Pfeil rechts sagt es zusätzlich, ohne dass die Zeile höher wird.
function meetHistoryRow(ctx, meet) {
  const settings = ctx.repo.getSettings();
  return raumZeile(`<div data-act="dt-meet" data-meet="${esc(meet.id)}" style="flex:1;min-width:0;display:flex;align-items:center;gap:10px;min-height:52px;padding:4px 2px;cursor:pointer">
<div style="display:flex;flex-direction:column;gap:1px;min-width:0;flex:1;pointer-events:none"><span style="font-size:14px;font-weight:600;white-space:nowrap;overflow:hidden;text-overflow:ellipsis">${esc(meet.title)}</span><span style="font-size:11.5px;color:var(--muted)">${esc(meetDateLabel(meet.date))}</span></div>
<span style="pointer-events:none;display:flex">${avatarStack(participantsYes(ctx, meet), { size: 22, font: 8.5, max: 2, settings })}</span>
<span style="pointer-events:none;display:flex;flex:none">${rowChevron}</span>
</div>`, ' data-role="meet-zeile"');
}

function activeMeetRow(ctx, meet) {
  const settings = ctx.repo.getSettings();
  return `<div data-act="dt-meet" data-meet="${esc(meet.id)}" data-treffer style="position:relative;margin:6px 0;border-radius:14px;padding:11px 14px;display:flex;justify-content:space-between;align-items:center;cursor:pointer">
${cardEdgeFade(14)}
<div style="display:flex;flex-direction:column;gap:1px;min-width:0;pointer-events:none"><span style="font-size:14px;font-weight:600;white-space:nowrap;overflow:hidden;text-overflow:ellipsis">${esc(meet.title)}</span><span style="font-size:11.5px;color:var(--muted)">${esc(meetDateLabel(meet.date))} · ${t('seit {zeit}', { zeit: esc(meet.time) })}</span></div>
<span style="pointer-events:none;display:flex">${avatarStack(participantsYes(ctx, meet), { size: 22, font: 8.5, max: 2, settings })}</span>
</div>`;
}

function participantsYes(ctx, meet) {
  return Object.entries(meet.participation || {})
    .filter(([, value]) => value === 'yes')
    .map(([id]) => ctx.repo.getPerson(id))
    .filter(Boolean)
    .sort((a, b) => (a.id === ME) - (b.id === ME));
}

// Die eine Reihenfolge der Mitglieder — für den Stapel oben UND die Liste. Die ersten drei der Liste
// sind genau die drei Bilder im Stapel; daran hängt, dass beim Aufklappen jedes Bild an SEINEN Platz
// fliegt.
function mitgliederReihe(ctx, crew) {
  const { repo } = ctx;
  const andere = crew.memberIds.filter((id) => id !== ME).map((id) => repo.getPerson(id)).filter(Boolean);
  // Wer laut seinen festen Zeiten sicher keine Zeit hat, steht ruhig am Ende — mit „Keine Zeit bis …",
  // nie mit dem Grund. Frei gewinnt immer.
  const keineZeit = (person) => (!istGeradeFrei(person) && !person.free?.from ? belegtHinweis(person.belegt) : '');
  const frei = andere.filter(istGeradeFrei).map((person) => ({ person, frei: true }));
  const rest = andere.filter((person) => !istGeradeFrei(person))
    .map((person, index) => ({ person, index, belegt: keineZeit(person) }))
    .sort((a, b) => (Number(Boolean(a.belegt)) - Number(Boolean(b.belegt))) || (a.index - b.index))
    .map(({ person, belegt }) => ({ person, belegt }));
  return [{ person: repo.getMe(), ich: true }, ...frei, ...rest];
}

// R6 D3/D4 bleibt: Jede Mitgliederzeile ist eine sichtbare Fläche und trägt ihr „···" gleich hier —
// nicht erst im Profil. Die eigene Zeile bekommt keines. Neu (R8-25): Wer Admin ist, steht rechts.
function mitgliedZeile(ctx, eintrag, settings, admins) {
  const { person } = eintrag;
  const ich = person.id === ME;
  const admin = admins.includes(person.id);
  let optionen;
  if (ich) optionen = { status: t('Du'), action: 'cd-me' };
  else if (eintrag.frei) optionen = { action: 'cd-person', statusArt: 'frei', status: person.status ? t('Frei · {status}', { status: person.status }) : t('Gerade frei') };
  else optionen = { action: 'cd-person', ...(eintrag.belegt ? { status: eintrag.belegt, statusArt: 'belegt' } : {}) };
  const marke = admin ? `<span data-role="admin-marke" style="flex:none;font-size:12px;font-weight:650;color:var(--muted);padding:0 4px 0 6px">${esc(t('Admin'))}</span>` : '';
  const rechts = ich ? '<span style="flex:none;width:48px"></span>' : zeilePunkte(ctx, person.id, person.name);
  return raumZeile(
    `<span style="flex:1;min-width:0;display:flex">${personRow(person, settings, optionen)}</span>${marke}${rechts}`,
    ` data-role="person-zeile" data-person="${esc(person.id)}"${admin ? ' data-admin="1"' : ''}`,
  );
}

const schildSvg = '<svg width="15" height="15" viewBox="0 0 24 24" fill="none" style="display:block"><path d="M12 3.5 5 6.3v5.2c0 4.3 2.9 7.4 7 9 4.1-1.6 7-4.7 7-9V6.3L12 3.5Z" stroke="var(--ink-soft)" stroke-width="1.8" stroke-linejoin="round"></path><path d="m9 12 2.1 2.1L15.2 10" stroke="var(--ink-soft)" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"></path></svg>';

// „Admins wählen" — nur für Admins, und nur, wenn der Datenweg dafür da ist (Hausregel 9: kein Knopf
// ohne Wirkung).
function adminWahlZeile(ctx, crew) {
  if (!darfHinzufuegen(crew) || typeof ctx.repo.setCrewAdmin !== 'function') return '';
  return `<button data-act="cd-admins" data-role="admins-waehlen" style="display:flex;align-items:center;gap:12px;width:100%;min-height:52px;padding:0 4px;border:0;border-top:1px solid var(--ink-a05);background:transparent;cursor:pointer;appearance:none;font-family:'Instrument Sans',sans-serif;text-align:left;box-sizing:border-box">
<span style="width:30px;height:30px;border-radius:50%;background:var(--field);display:flex;align-items:center;justify-content:center;flex:none;pointer-events:none">${schildSvg}</span>
<span style="font-size:14px;font-weight:650;color:var(--ink);flex:1;min-width:0;pointer-events:none">${esc(t('Admins wählen'))}</span>
<span style="pointer-events:none;display:flex">${rowChevron}</span>
</button>`;
}

function adminWahlSheet(ctx, crew) {
  const wahl = ctx.ui.adminWahl;
  if (!wahl || !crew || wahl.crewId !== crew.id) return '';
  const settings = ctx.repo.getSettings();
  const auswahl = new Set(wahl.auswahl);
  const zeilen = mitgliederReihe(ctx, crew).map(({ person }, index) => {
    const an = auswahl.has(person.id);
    const name = person.id === ME ? t('Du') : person.name;
    return `<button data-act="aw-person" data-person="${esc(person.id)}" aria-pressed="${an}" style="display:flex;align-items:center;gap:11px;width:100%;min-height:52px;padding:8px 0;border:0;${index ? 'border-top:1px solid var(--ink-a05);' : ''}background:transparent;cursor:pointer;appearance:none;font-family:'Instrument Sans',sans-serif;text-align:left;box-sizing:border-box">
<span style="display:flex;flex:none;pointer-events:none">${personAvatar(person, { size: 36, fontSize: 13, marker: personMarker(person.id, settings) })}</span>
<span style="font-size:14.5px;font-weight:${an ? 650 : 600};color:${an ? 'var(--ink)' : 'var(--ink-soft)'};flex:1;min-width:0;pointer-events:none;white-space:nowrap;overflow:hidden;text-overflow:ellipsis">${esc(name)}</span>
<span style="pointer-events:none;display:flex;flex:none">${auswahlKreis(an)}</span>
</button>`;
  }).join('');
  const leer = !wahl.auswahl.length;
  const gleich = [...wahl.auswahl].sort().join('|') === [...crewAdmins(crew)].sort().join('|');
  const bereit = !leer && !gleich;
  return sheet(`<div data-role="admin-wahl" style="font-family:'Instrument Sans',sans-serif">
<div style="display:flex;align-items:center;gap:10px;padding-bottom:6px">
<span style="display:flex;flex-direction:column;gap:1px;min-width:0;flex:1">
<span style="font-family:'Bricolage Grotesque',sans-serif;font-size:19px;font-weight:650">${esc(t('Admins'))}</span>
<span style="font-size:12px;color:var(--muted);white-space:nowrap;overflow:hidden;text-overflow:ellipsis">${esc(crew.name)}</span>
</span>
${gruppenKreis(crew, 34, 12)}
</div>
<span style="display:block;font-size:12.5px;color:var(--muted);line-height:1.45;padding-bottom:6px">${esc(t('Admins holen neue Leute dazu und bestimmen, wer noch Admin ist.'))}</span>
<div data-role="admin-liste">${zeilen}</div>
${leer ? `<span data-role="admin-leer" style="display:block;font-size:12.5px;color:var(--orange-dark);padding:8px 0 0">${esc(t('Mindestens eine Person bleibt Admin.'))}</span>` : ''}
<div style="display:flex;gap:8px;padding-top:14px">
<button data-act="aw-zu" style="flex:1;min-height:46px;border:1.5px solid var(--ink-a14);background:var(--surface);color:var(--ink-soft);font:650 14px/1 'Instrument Sans',sans-serif;border-radius:999px;cursor:pointer;appearance:none"><span style="pointer-events:none">${esc(t('Abbrechen'))}</span></button>
<button data-act="aw-speichern" aria-disabled="${!bereit}" style="flex:1.4;min-height:46px;border:0;background:${bereit ? 'var(--green)' : 'var(--field)'};color:${bereit ? 'var(--on-accent)' : 'var(--muted-light)'};font:650 14px/1 'Instrument Sans',sans-serif;border-radius:999px;cursor:${bereit ? 'pointer' : 'default'};appearance:none"><span style="pointer-events:none">${esc(t('Speichern'))}</span></button>
</div>
</div>`, { closeAct: 'aw-zu', scrollKey: 'admin-wahl' });
}

function adminWahlAktionen(ctx, crew) {
  const { repo, ui } = ctx;
  const guard = dirtyGuard(ctx, 'admin-wahl');
  const wert = () => [...(ui.adminWahl?.auswahl || [])].sort();
  const GRUENDE = {
    keinAdmin: t('Nur Admins können das ändern'),
    letzterAdmin: t('Mindestens eine Person bleibt Admin.'),
    keinMitglied: t('Diese Person ist nicht mehr in der Gruppe'),
  };
  return {
    'cd-admins': () => {
      ui.adminWahl = { crewId: crew.id, auswahl: [...crewAdmins(repo.getCrew(crew.id) || crew)] };
      guard.reset(wert());
      rueckmeldung('tipp');
      ctx.render();
    },
    'aw-person': (data) => {
      const wahl = ui.adminWahl;
      if (!wahl || !data.person) return;
      wahl.auswahl = wahl.auswahl.includes(data.person)
        ? wahl.auswahl.filter((id) => id !== data.person)
        : [...wahl.auswahl, data.person];
      rueckmeldung('auswahl');
      ctx.render();
    },
    'aw-zu': () => {
      const zu = () => { ui.adminWahl = null; ctx.render(); };
      if (!guard.confirm(wert(), zu)) return;
      zu();
    },
    'aw-speichern': async () => {
      const wahl = ui.adminWahl;
      if (!wahl) return;
      if (!wahl.auswahl.length) { rueckmeldung('abgelehnt'); ctx.toast(GRUENDE.letzterAdmin); return; }
      const vorher = crewAdmins(repo.getCrew(crew.id) || crew);
      const dazu = wahl.auswahl.filter((id) => !vorher.includes(id));
      // Erst dazu, dann weg — und mich selbst zuletzt: Wer sich die Rolle nimmt, kann danach nichts
      // mehr ändern, und die Gruppe ist nie auch nur einen Schritt lang ohne Admin.
      const weg = vorher.filter((id) => !wahl.auswahl.includes(id)).sort((a, b) => Number(a === ME) - Number(b === ME));
      if (!dazu.length && !weg.length) { guard.clear(); ui.adminWahl = null; ctx.render(); return; }
      for (const [id, an] of [...dazu.map((id) => [id, true]), ...weg.map((id) => [id, false])]) {
        const ergebnis = await Promise.resolve(repo.setCrewAdmin(crew.id, id, an));
        if (!ergebnis?.ok) {
          rueckmeldung('abgelehnt');
          ctx.toast(GRUENDE[ergebnis?.reason] || t('Das hat nicht geklappt'));
          ctx.render();
          return;
        }
      }
      guard.clear();
      ui.adminWahl = null;
      rueckmeldung('erfolg');
      ctx.render();
      ctx.toast(t('Admins gespeichert'));
    },
  };
}

// Gemeinsame Meets: dieselbe Kachel wie in der Chatliste und im Kalender (components.js meetKachel).
function gemeinsamesMeetZeile(ctx, meet) {
  const aktiv = meet.status === 'active';
  // Solange Zeitvorschläge offen sind, nennt die Zeile keine Uhrzeit, die noch niemand beschlossen
  // hat — dieselbe Aussage wie die Meet-Karte und der Kalender („Zeit offen").
  const zeitOffen = !aktiv && (meet.variants || []).some((variant) => variant.kind === 'time');
  let wann = terminText(meet, { datum: meetDateLabel });
  if (aktiv) wann = `${meetDateLabel(meet.date)} · ${t('seit {zeit}', { zeit: meet.time })}`;
  else if (zeitOffen) wann = `${meetDateLabel(meet.date)} · ${t('Zeit offen')}`;
  return raumZeile(`<div data-act="dt-meet" data-meet="${esc(meet.id)}" style="flex:1;min-width:0;display:flex;align-items:center;gap:12px;min-height:56px;padding:4px 2px;cursor:pointer">
<span style="display:flex;flex:none;pointer-events:none">${meetKachel(meet, 38)}</span>
<span style="display:flex;flex-direction:column;gap:1px;min-width:0;flex:1;pointer-events:none"><span style="font-size:14.5px;font-weight:650;white-space:nowrap;overflow:hidden;text-overflow:ellipsis">${esc(meet.title)}</span><span style="font-size:12px;color:${aktiv ? 'var(--green-dark)' : 'var(--muted)'};font-variant-numeric:tabular-nums;white-space:nowrap;overflow:hidden;text-overflow:ellipsis">${esc(wann)}</span></span>
<span style="pointer-events:none;display:flex;flex:none">${rowChevron}</span>
</div>`, ' data-role="meet-zeile"');
}

const rowChevronGruen = `<svg width="12" height="12" viewBox="0 0 24 24" fill="none" style="flex:none"><path d="M9.5 5.5 16 12l-6.5 6.5" stroke="var(--green-dark)" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round"></path></svg>`;

function alleMeetsZeile() {
  return `<button data-act="cd-all" data-role="alle-meets" style="display:flex;align-items:center;gap:8px;width:100%;min-height:48px;padding:0 2px;border:0;border-top:1px solid var(--ink-a05);background:transparent;cursor:pointer;appearance:none;font-family:'Instrument Sans',sans-serif;text-align:left;box-sizing:border-box">
<span style="flex:1;font-size:14px;font-weight:650;color:var(--green-dark);pointer-events:none">${esc(t('Alle ansehen'))}</span>
<span style="pointer-events:none;display:flex">${rowChevronGruen}</span>
</button>`;
}

// Ressourcen: nur der Titel. Ein Tipp klappt auf, WER sie hat (ownerDetails) — rechts in der Zeile
// steht nichts mehr. data-verfuegbar sagt Prüfläufen, welche Verfügbarkeit die Reihenfolge trägt.
function ressourceTitelZeile(ctx, entry) {
  const open = ctx.ui.resOpen === entry.label;
  const verfuegbar = entry.owners.some((owner) => owner.meta.availability === 'immer') ? 'immer' : 'manchmal';
  return `<div data-act="res-open" data-label="${esc(entry.label)}" data-verfuegbar="${verfuegbar}" role="button" aria-expanded="${open}" style="display:flex;align-items:center;min-height:44px;border-top:1px solid var(--ink-a05);cursor:pointer">
<span style="font-size:14.5px;font-weight:600;flex:1;min-width:0;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;pointer-events:none">${esc(wortAnzeige(entry.label))}</span>
</div>${open ? ownerDetails(ctx, entry) : ''}`;
}

// --- Die wandernden Bilder (R8-25) --------------------------------------------------------------
// FLIP: Lage vorher messen, neu zeichnen, Lage nachher messen, mit einer Transformation an die alte
// Stelle zurücksetzen und in die neue gleiten lassen. Nur transform und opacity — nichts, was das
// Layout verschiebt. Wer Bewegung abgestellt hat, bekommt keine.
const WANDERN_MS = 380;
const WANDERN_KURVE = 'cubic-bezier(.22,.8,.24,1)';

function bewegungGedaempft() {
  try { return Boolean(globalThis.matchMedia?.('(prefers-reduced-motion: reduce)').matches); } catch { return false; }
}

function mitgliederLagen(root, { abbilder = false } = {}) {
  const lagen = new Map();
  const kopien = new Map();
  root.querySelectorAll('[data-stapel-person]').forEach((el) => lagen.set(el.dataset.stapelPerson, el.getBoundingClientRect()));
  const liste = root.querySelector('[data-role="mitglieder-liste"]');
  if (liste) {
    liste.querySelectorAll('[data-role="person-zeile"]').forEach((zeile) => {
      const bild = zeile.querySelector('[data-role="person-avatar"]');
      if (!bild) return;
      const rect = bild.getBoundingClientRect();
      lagen.set(zeile.dataset.person, rect);
      if (abbilder) kopien.set(zeile.dataset.person, { knoten: bild.cloneNode(true), rect });
    });
  }
  return {
    offen: Boolean(liste),
    lagen,
    kopien,
    rest: root.querySelector('[data-stapel-rest]')?.getBoundingClientRect() || null,
    titel: root.querySelector('[data-role="mitglieder-titel"]')?.getBoundingClientRect() || null,
  };
}

function wandern(el, von, nach, skala, { verblassen = false, mitGroesse = true } = {}) {
  if (!el || !von || !nach || !nach.width) return;
  const dx = (von.left - nach.left) / skala;
  const dy = (von.top - nach.top) / skala;
  if (Math.abs(dx) < 0.5 && Math.abs(dy) < 0.5) return;
  const faktor = mitGroesse && nach.width ? von.width / nach.width : 1;
  el.style.transition = 'none';
  el.style.transformOrigin = '0 0';
  el.style.transform = `translate(${dx}px, ${dy}px) scale(${faktor})`;
  if (verblassen) el.style.opacity = '0';
  el.getBoundingClientRect();
  requestAnimationFrame(() => {
    el.style.transition = `transform ${WANDERN_MS}ms ${WANDERN_KURVE}, opacity ${WANDERN_MS}ms ease-out`;
    el.style.transform = '';
    el.style.opacity = '';
    window.setTimeout(() => { el.style.transition = ''; el.style.transformOrigin = ''; }, WANDERN_MS + 60);
  });
}

function bilderWandern(root, vorher) {
  if (bewegungGedaempft()) return;
  const nachher = mitgliederLagen(root);
  const rahmen = root.querySelector('.runtime-phone');
  const skala = rahmen?.offsetWidth ? (rahmen.getBoundingClientRect().width / rahmen.offsetWidth) || 1 : 1;
  if (nachher.offen && !vorher.offen) {
    // Aufklappen: jedes Bild kommt aus dem Stapel — wer dort nur als „+n" stand, aus dieser Scheibe.
    root.querySelectorAll('[data-role="mitglieder-liste"] [data-role="person-zeile"]').forEach((zeile) => {
      const bild = zeile.querySelector('[data-role="person-avatar"]');
      const imStapel = vorher.lagen.get(zeile.dataset.person);
      if (bild) wandern(bild, imStapel || vorher.rest, bild.getBoundingClientRect(), skala, { verblassen: !imStapel });
    });
  } else if (!nachher.offen && vorher.offen) {
    // Zuklappen: Die drei Bilder im Stapel kommen aus der Liste zurück; alle anderen fliegen als
    // Abbild in die Scheibe „+n" und verblassen dort.
    const imStapel = new Set();
    root.querySelectorAll('[data-stapel-person]').forEach((el) => {
      imStapel.add(el.dataset.stapelPerson);
      wandern(el, vorher.lagen.get(el.dataset.stapelPerson), el.getBoundingClientRect(), skala);
    });
    const ziel = nachher.rest;
    if (ziel && rahmen) {
      const f = rahmen.getBoundingClientRect();
      for (const [id, { knoten, rect }] of vorher.kopien) {
        if (imStapel.has(id)) continue;
        knoten.setAttribute('aria-hidden', 'true');
        knoten.style.position = 'absolute';
        knoten.style.left = `${(rect.left - f.left) / skala}px`;
        knoten.style.top = `${(rect.top - f.top) / skala}px`;
        knoten.style.margin = '0';
        knoten.style.zIndex = '30';
        knoten.style.pointerEvents = 'none';
        knoten.style.transformOrigin = '0 0';
        rahmen.appendChild(knoten);
        knoten.getBoundingClientRect();
        requestAnimationFrame(() => {
          knoten.style.transition = `transform ${WANDERN_MS}ms ${WANDERN_KURVE}, opacity ${WANDERN_MS}ms ease-in`;
          knoten.style.transform = `translate(${(ziel.left - rect.left) / skala}px, ${(ziel.top - rect.top) / skala}px) scale(${ziel.width / rect.width})`;
          knoten.style.opacity = '0';
        });
        window.setTimeout(() => knoten.remove(), WANDERN_MS + 80);
      }
    }
  }
  // Die Zahl rückt mit, statt zu springen.
  const titel = root.querySelector('[data-role="mitglieder-titel"]');
  if (titel && vorher.titel && nachher.titel) wandern(titel, vorher.titel, nachher.titel, skala, { mitGroesse: false });
}

function renderCrewDetails(ctx) {
  const { repo, ui, params } = ctx;
  const crew = repo.getCrew(params.crewId);
  if (!crew) return { html: emptyScreen('', t('Diese Gruppe gibt es nicht mehr')), bind() {} };
  const settings = repo.getSettings();
  const roomId = roomIdForCrew(crew.id);
  const reihe = mitgliederReihe(ctx, crew);
  const frei = reihe.filter((eintrag) => eintrag.frei);
  const admins = crewAdmins(crew);
  const offen = Boolean(ui.members);

  // 1 · Mitglieder — zugeklappt der Stapel, aufgeklappt die EINE Liste.
  const kopf = `<div data-act="cd-members" data-role="mitglieder-kopf" aria-expanded="${offen}" style="padding:13px 16px;min-height:58px;box-sizing:border-box;display:flex;align-items:center;gap:12px;cursor:pointer;-webkit-tap-highlight-color:transparent">
${offen ? '' : `<span data-role="mitglieder-stapel" style="display:flex;flex:none;pointer-events:none">${avatarStack(reihe.map((eintrag) => eintrag.person), { size: 30, font: 11, max: 3, settings, kennung: true })}</span>`}
<span data-role="mitglieder-titel" style="font-size:14.5px;font-weight:650;flex:1;min-width:0;pointer-events:none;display:flex;align-items:center;flex-wrap:wrap;gap:4px 8px">${tn(crew.memberIds.length, '{n} Mitglied', '{n} Mitglieder')}${frei.length ? freiAnzahlChip(frei.length) : ''}</span>
<span style="pointer-events:none;display:flex;flex:none;transform:rotate(${offen ? 90 : 0}deg);transition:transform .2s ease-out">${rowChevron}</span>
</div>`;
  const liste = offen
    ? `<div class="r6-zeilen" data-role="mitglieder-liste" style="padding:0 12px 6px;border-top:1px solid var(--ink-a05)">
${reihe.map((eintrag) => mitgliedZeile(ctx, eintrag, settings, admins)).join('')}
${adminWahlZeile(ctx, crew)}
${nurAdminsHinweis(ctx, crew, { innen: 4 })}
</div>`
    : '';
  const mitglieder = `<div data-role="mitglieder" style="background:var(--surface);border-radius:20px;border:1px solid var(--ink-a07);overflow:hidden">
${kopf}
${darfHinzufuegen(crew) ? personenHinzuZeile() : ''}
${liste}
</div>`;

  // 2 · Gemeinsame Meets — die nächsten zwei, darunter klar „Alle ansehen".
  const kommend = repo.getMeets({ context: { crewId: crew.id }, direction: 'upcoming' });
  const vergangen = repo.getMeets({ context: { crewId: crew.id }, direction: 'history' });
  const naechste = kommend.slice(0, 2);
  const meetZeilen = naechste.length
    ? `<div class="r6-zeilen">${naechste.map((meet) => gemeinsamesMeetZeile(ctx, meet)).join('')}</div>`
    : `<div data-role="meets-leer" style="padding:11px 0 13px;border-top:1px solid var(--ink-a05);font-size:13px;color:var(--muted)">${esc(vergangen.length ? t('Gerade ist nichts geplant.') : t('Noch keine gemeinsamen Meets.'))}</div>`;
  const alle = kommend.length + vergangen.length ? alleMeetsZeile() : '';

  // 3 · Interessen und 4 · Ressourcen — nur der Titel.
  const interessen = crewSharedInterests(ctx, crew).map((entry) => `<div data-role="interesse-zeile" style="display:flex;align-items:center;min-height:44px;border-top:1px solid var(--ink-a05)"><span style="font-size:14.5px;font-weight:600;flex:1;min-width:0;white-space:nowrap;overflow:hidden;text-overflow:ellipsis">${esc(wortAnzeige(entry.label))}</span></div>`).join('');
  const ressourcen = crewResourceEntries(ctx, crew).map((entry) => ressourceTitelZeile(ctx, entry)).join('');

  const html = screenScaffold({
    header: `${MENUE_STYLE}${neuDabeiStil(ui)}<div style="display:flex;align-items:center;padding:8px 20px 0"><button data-act="back" style="border:0;background:transparent;padding:0;display:flex;cursor:pointer"><span style="pointer-events:none;display:flex">${backArrow('var(--ink)', 22)}</span></button>
<span style="flex:1"></span>${crewDotsButton(crew.id, ui.crewMenuFor === crew.id)}</div>`,
    body: `
<div style="display:flex;flex-direction:column;align-items:center;gap:10px;padding:8px 24px 18px">
<div style="position:relative;width:92px;height:92px;flex:none">
<button data-act="cd-bild-gross" aria-label="${esc(t('Gruppenbild groß ansehen'))}" style="display:block;width:92px;height:92px;border:0;background:transparent;padding:0;cursor:pointer;appearance:none;border-radius:20%"><span style="display:block;pointer-events:none">${gruppenKreis(crew, 92, 26)}</span></button>
<button data-act="cd-edit" aria-label="${esc(t('Gruppe bearbeiten'))}" style="position:absolute;right:-10px;bottom:-8px;width:44px;height:44px;border:0;background:transparent;padding:0;cursor:pointer;appearance:none;display:flex;align-items:center;justify-content:center;border-radius:50%">${pencilBadge}</button>
</div>
<span style="font-family:'Bricolage Grotesque',sans-serif;font-size:23px;font-weight:650;text-align:center;max-width:100%;overflow:hidden;text-overflow:ellipsis;white-space:nowrap">${esc(crew.name)}</span>
</div>
<div style="display:flex;flex-direction:column;gap:13px;padding:0 20px 8px">
${mitglieder}
${profileBox(t('Gemeinsame Meets'), `${meetZeilen}${alle}`, '', 'gemeinsame-meets')}
${interessen ? profileBox(t('Interessen'), interessen, '', 'interessen') : ''}
${ressourcen ? profileBox(t('Ressourcen'), ressourcen, '', 'ressourcen') : ''}
</div>`,
    bottomInset: 26,
    // Runde 5 (B3/C1): Baukasten und „Personen hinzufügen" treten an die Stelle des Bearbeiten-Sheets
    // (wie im Profil) — kein doppelter Schleier; zurück steht der Entwurf unverändert da.
    // R6 D4: Das Personen-Menü der Zeilen ist dasselbe wie im Profil — samt seiner
    // Folge-Sheets (Markieren, Wechsel, Entfernen, Blockieren, Melden).
    overlays: `${ui.editSheet && !ui.gruppenPb && !ui.personenWahl ? crewEditSheet(ctx, crew) : ''}${gruppenBaukastenSheet(ctx)}${personenWahlSheet(ctx, crew)}${adminWahlSheet(ctx, crew)}${crewMenu(ctx, crew.id)}${ui.menuFor ? friendMenu(ctx, ui.menuFor) : ''}${ui.sheet === 'mark' ? gemeinsamesMarkSheet(ctx) : ''}${markSwitchSheet(ctx)}${gemeinsamesEntfernenSheet(ctx)}${blockSheet(ctx)}${reportSheet(ctx)}${ctx.freundHinzufuegen?.overlay(ctx) || ''}${discardSheet(ctx)}${bildGrossHtml(ctx)}`,
    scrollKey: `crew-details-${crew.id}`,
  });

  // Ü4: Name/Farbe sind ein echtes Formular — Scrim oder Schließen dürfen eine Änderung
  // nicht kommentarlos verlieren. Das Gruppenbild gehört seit v7 dazu.
  const editGuard = dirtyGuard(ctx, 'crew-edit');
  const editValue = () => ({
    name: ui.editName ?? crew.name,
    color: ui.editColor || crew.color,
    bild: ui.editBild === undefined ? (crew.groupImage || null) : ui.editBild,
  });

  return {
    html,
    bind(root) {
      bindActions(root, {
        ...discardActions(ctx),
        ...crewMenuActs(ctx, { crewId: crew.id }),
        ...bildGrossAktionen(ctx),
        ...personenWahlAktionen(root, ctx, crew),
        // Runde 8 (R8-25): „Admins wählen" — andere zu Admins machen (repo.setCrewAdmin).
        ...adminWahlAktionen(ctx, crew),
        // R6 D4: dieselben Menü-Aktionen wie in der Freundesliste und im Personenprofil.
        ...friendMenuActs(ctx),
        ...markSheetActs(ctx),
        ...blockActs(ctx),
        ...(ctx.freundHinzufuegen?.aktionen(root, ctx) || {}),
        // Runde 5 (B4): Die Gruppen-Scheibe zeigt das Bild groß; bearbeitet wird über den Stift daneben
        // oder den Knopf in der großen Ansicht.
        'cd-bild-gross': (data, el) => bildGrossOeffnen(ctx, el, {
          art: 'gruppe',
          id: crew.id,
          zeichnen: (d) => gruppenKreis(repo.getCrew(crew.id) || crew, d, Math.round(d * 0.28)),
          knopf: { act: 'cd-edit', text: t('Gruppe bearbeiten') },
        }),
        // Runde 4 (B3): Ergebnis des Baukastens in den Entwurf des Bearbeiten-Sheets.
        ...gruppenBaukastenAktionen(root, ctx, ({ photo, color }) => {
          ui.editBild = photo;
          ui.editColor = neueGruppenfarbe(editValue().color, color);
        }),
        // Runde 8 (R8-25): Beim Auf- und Zuklappen wandern die Bilder zwischen Stapel und Liste.
        'cd-members': () => {
          const vorher = mitgliederLagen(root, { abbilder: Boolean(ui.members) });
          ui.members = !ui.members;
          ctx.render();
          bilderWandern(root, vorher);
        },
        'cd-me': () => ctx.nav.setTab('profil'),
        'cd-person': (data) => ctx.nav.go('room.personDetails', { personId: data.person }),
        'cd-all': () => ctx.nav.go('room.allMeets', { roomId }),
        'dt-meet': (data) => ctx.nav.go('meet.details', { meetId: data.meet }),
        // §6: Klick klappt nur die Details je Besitzer auf — kein Sheet, keine Tags.
        'res-open': (data) => { ui.resOpen = ui.resOpen === data.label ? null : data.label; ctx.render(); },
        'res-edit': () => ctx.nav.setTab('profil'),
        'cd-edit': () => { bildGrossZu(ctx); ui.editSheet = true; editGuard.reset(editValue()); ctx.render(); },
        'cd-edit-close': () => {
          const close = () => {
            ui.editSheet = false;
            ui.editName = undefined;
            ui.editColor = null;
            ui.editBild = undefined;
            ui.gruppenPb = null;
            ctx.render();
          };
          if (!editGuard.confirm(editValue(), close)) return;
          close();
        },
        // Runde 4 (B3): derselbe Baukasten wie beim Anlegen und im Profil.
        'cd-bild': () => {
          const jetzt = editValue();
          // Dieselbe Rückfallfarbe wie Kreis und Farbwahl (var(--blue)) — sonst begänne der
          // Baukasten bei einer Gruppe ohne gespeicherte Farbe auf einer anderen als der sichtbaren.
          ui.gruppenPb = pbStart({ photo: jetzt.bild, color: jetzt.color || CREW_COLORS[1], initials: crewInitials(jetzt.name), art: 'gruppe' });
          ctx.render();
        },
        'cd-edit-save': () => {
          const name = (ui.editName ?? crew.name).trim();
          if (!name) { ctx.toast(t('Die Crew braucht einen Namen')); return; }
          editGuard.clear();
          ui.editSheet = false;
          // groupImage bleibt unangetastet, solange niemand ein Bild gewählt oder
          // entfernt hat (undefined). null löscht es ausdrücklich.
          repo.updateCrew(crew.id, {
            name,
            color: ui.editColor || crew.color,
            ...(ui.editBild === undefined ? {} : { groupImage: ui.editBild }),
          });
          ui.editBild = undefined;
          ctx.toast(t('Gruppe gespeichert'));
        },
      });
      // Runde 5 (B3): Die Vorschau oben zieht die Initialen beim Tippen mit. Das Feld im Fokus fasst
      // der Abgleich nicht an; der Handler hängt nur einmal je Feld.
      const nameInput = root.querySelector('#cd-name');
      if (nameInput && !nameInput.__cdGebunden) {
        nameInput.__cdGebunden = true;
        nameInput.addEventListener('input', () => { ui.editName = nameInput.value; ctx.render(); });
      }
      // R6 D4: Die Eingabefelder des gemeinsamen Markieren-Sheets hängen an input-Ereignissen.
      bindMarkSheetInputs(root, ctx);
      bildGrossBinden(root, ctx);
      bildGrossInZeilen(root, ctx, '[data-act="cd-person"]');
    },
  };
}

// Runde 5 (B3): „Crew bearbeiten" im Aufbau von „Profil bearbeiten" (profile.js): Titel, darunter
// mittig die 84-px-Scheibe mit Stift und der Textknopf — beide öffnen denselben Baukasten (Foto mit
// Kamera, Motiv, Hintergrund, Emoji). Die Farbe wählt man dort unter „Hintergrund"; die frühere
// eigene Farbreihe und „Entfernen" sind entfallen (Foto entfernen steht im Baukasten). Darunter Name
// und Mitglieder — wer die Gruppe verwaltet, holt hier Leute dazu (C1).
const FELD_WIE_PROFIL = "width:100%;padding:13px 14px;border:1.5px solid var(--ink-a12);border-radius:14px;background:var(--paper);outline:none;color:var(--ink);font:600 16px 'Instrument Sans',sans-serif;box-sizing:border-box";
const sheetLabel = (text) => `<span style="font-size:10.5px;font-weight:650;letter-spacing:.09em;text-transform:uppercase;color:var(--muted-light);padding-left:4px">${esc(text)}</span>`;

function crewEditSheet(ctx, crew) {
  const { ui, repo } = ctx;
  const farbe = ui.editColor || crew.color || CREW_COLORS[1];
  const bild = ui.editBild === undefined ? (crew.groupImage || null) : ui.editBild;
  const name = ui.editName ?? crew.name;
  const settings = repo.getSettings();
  const mitglieder = crew.memberIds.map((id) => (id === ME ? repo.getMe() : repo.getPerson(id))).filter(Boolean);
  return sheet(`<span style="font-family:'Bricolage Grotesque',sans-serif;font-size:19px;font-weight:650;display:block;padding-bottom:6px">${t('Crew bearbeiten')}</span>
<div style="padding:14px 0 2px;border-top:1px solid var(--ink-a07)">
${gruppenBildKopf({ act: 'cd-bild', crew: { ...crew, name, color: farbe, groupImage: bild }, text: t('Gruppenbild ändern'), rolle: 'crew-bearbeiten-bild' })}
</div>
<div style="display:flex;flex-direction:column;gap:6px;padding-top:12px">
${sheetLabel(t('Name'))}
<input id="cd-name" value="${esc(name)}" aria-label="${esc(t('Name'))}" autocomplete="off" style="${FELD_WIE_PROFIL}">
</div>
<div data-role="crew-bearbeiten-mitglieder" style="display:flex;flex-direction:column;gap:6px;padding-top:14px">
${sheetLabel(t('Mitglieder'))}
<div style="border:1.5px solid var(--ink-a12);border-radius:14px;background:var(--paper);overflow:hidden">
<div style="display:flex;align-items:center;gap:12px;padding:10px 14px">${avatarStack(mitglieder, { size: 28, font: 10, max: 5, border: 'var(--paper)', settings })}<span style="font-size:14px;font-weight:650;color:var(--ink);flex:1;min-width:0">${esc(tn(crew.memberIds.length, '{n} Mitglied', '{n} Mitglieder'))}</span></div>
${darfHinzufuegen(crew) ? personenHinzuZeile({ innen: 14, rand: 'var(--ink-a07)' }) : nurAdminsHinweis(ctx, crew, { innen: 14 })}
</div>
</div>
<button data-act="cd-edit-save" style="display:block;width:100%;border:0;border-radius:999px;padding:14px 0;margin-top:16px;background:var(--green);cursor:pointer;appearance:none;font-family:'Instrument Sans',sans-serif"><span style="pointer-events:none;font-size:14px;font-weight:650;color:var(--on-accent)">${t('Speichern')}</span></button>`, { closeAct: 'cd-edit-close' });
}

// =====================================================================================
// Personen zu einer Gruppe hinzufügen (Runde 5, C1)
//
// Jonathan: „Man muss Personen zu Gruppen hinzufügen können." Wer die Gruppe verwaltet (Admin), sieht
// „Personen hinzufügen" in den Gruppen-Details direkt unter der Mitgliederzeile und beim Bearbeiten;
// alle anderen lesen dort ruhig, wer neue Leute dazuholt. Das Sheet zeigt Freunde, die noch nicht
// dabei sind — Mehrfachauswahl, ab acht eine Suche. Erst „Hinzufügen" schreibt (repo.addCrewMembers);
// die Neuen stehen sofort in der aufgeklappten Liste und leuchten kurz grün auf. Wer mit Auswahl
// schließt, wird wie überall gefragt, ob die Auswahl verworfen werden soll.
// =====================================================================================
const SUCHE_AB = 8;
const suchText = (wert) => String(wert || '').normalize('NFD').replace(/\p{M}/gu, '').toLowerCase().trim();
const auswahlKreis = (an) => (an
  ? '<svg width="22" height="22" viewBox="0 0 24 24" fill="none"><circle cx="12" cy="12" r="10" fill="var(--green)"></circle><path d="m8 12 2.6 2.6L16.4 9" stroke="var(--on-accent)" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"></path></svg>'
  : '<span style="width:22px;height:22px;border-radius:50%;border:1.8px solid var(--line-solid);box-sizing:border-box;display:block"></span>');

function personenHinzuZeile({ innen = 16, rand = 'var(--ink-a05)' } = {}) {
  return `<button data-act="cd-personen" data-role="personen-hinzufuegen" style="display:flex;align-items:center;gap:12px;width:100%;min-height:52px;padding:0 ${innen}px;border:0;border-top:1px solid ${rand};background:transparent;cursor:pointer;appearance:none;font-family:'Instrument Sans',sans-serif;text-align:left;box-sizing:border-box">
<span style="width:30px;height:30px;border-radius:50%;background:var(--green-tint);display:flex;align-items:center;justify-content:center;flex:none;pointer-events:none">${plus('var(--green-dark)', 15)}</span>
<span style="font-size:14px;font-weight:650;color:var(--green-dark);flex:1;min-width:0;pointer-events:none">${t('Personen hinzufügen')}</span>
<span style="color:var(--line-strong);pointer-events:none">›</span>
</button>`;
}

function nurAdminsHinweis(ctx, crew, { innen = 0 } = {}) {
  if (darfHinzufuegen(crew)) return '';
  const namen = crewAdmins(crew).map((id) => ctx.repo.getPerson(id)?.name).filter(Boolean);
  if (!namen.length) return '';
  const text = tn(namen.length, 'Neue Mitglieder fügt {namen} hinzu.', 'Neue Mitglieder fügen {namen} hinzu.', { namen: namen.join(', ') });
  return `<div data-role="nur-admins" style="padding:10px ${innen}px;border-top:1px solid var(--ink-a05);font-size:12px;color:var(--muted);line-height:1.45">${esc(text)}</div>`;
}

// Gerade Hinzugefügte leuchten in der Mitgliederliste kurz auf (Keyframes im P2-Block von styles.css).
function neuDabeiStil(ui) {
  const neu = ui.neuDabei;
  if (!neu?.ids?.length || neu.bis < Date.now()) return '';
  const wahl = neu.ids.map((id) => `[data-act="cd-person"][data-person="${String(id).replace(/[^\w-]/g, '')}"]`).join(',');
  return `<style>${wahl}{animation:r5NeuDabei 2.6s ease-out both;border-radius:12px}</style>`;
}

function personenKandidaten(ctx, crew) {
  const dabei = new Set(crew.memberIds);
  return ctx.repo.getPeople().filter((person) => !dabei.has(person.id));
}

function personenWahlSheet(ctx, crew) {
  const wahl = ctx.ui.personenWahl;
  if (!wahl || !crew) return '';
  const settings = ctx.repo.getSettings();
  const kandidaten = personenKandidaten(ctx, crew);
  const auswahl = new Set(wahl.auswahl);
  const mitSuche = kandidaten.length >= SUCHE_AB;
  const suche = mitSuche ? suchText(wahl.suche) : '';
  // Gewählte bleiben stehen, auch wenn die Suche sie nicht trifft — nichts verschwindet unter dem Finger.
  const treffer = suche ? kandidaten.filter((person) => suchText(person.name).includes(suche)) : kandidaten;
  const sichtbar = suche ? kandidaten.filter((person) => auswahl.has(person.id) || treffer.includes(person)) : kandidaten;

  const kopf = `<div style="display:flex;align-items:center;gap:10px;padding-bottom:12px">
${wahl.zurueck ? `<button data-act="pw-zu" data-treffer aria-label="${esc(t('Zurück'))}" style="width:30px;height:30px;border-radius:50%;background:var(--paper);border:1px solid var(--ink-a08);display:flex;align-items:center;justify-content:center;flex:none;cursor:pointer;appearance:none;padding:0"><span style="pointer-events:none;display:flex">${backArrow('var(--ink)', 15)}</span></button>` : ''}
<span style="display:flex;flex-direction:column;gap:1px;min-width:0;flex:1">
<span style="font-family:'Bricolage Grotesque',sans-serif;font-size:19px;font-weight:650">${t('Personen hinzufügen')}</span>
<span style="font-size:12px;color:var(--muted);white-space:nowrap;overflow:hidden;text-overflow:ellipsis">${esc(crew.name)}</span>
</span>
${gruppenKreis(crew, 34, 12)}
</div>`;

  const suchfeld = mitSuche
    ? `<label data-role="pw-suchfeld" style="position:sticky;top:-14px;z-index:3;box-shadow:0 0 0 6px var(--surface);display:flex;align-items:center;gap:9px;height:46px;padding:0 8px 0 14px;margin-bottom:6px;border-radius:14px;background:var(--paper);border:1.5px solid var(--ink-a12);box-sizing:border-box;cursor:text"><span style="display:flex;flex:none;pointer-events:none">${search('var(--muted)', 17)}</span><input id="pw-suche" type="search" value="${esc(wahl.suche || '')}" placeholder="${esc(t('Freunde suchen'))}" aria-label="${esc(t('Freunde suchen'))}" autocomplete="off" enterkeyhint="search" style="flex:1;min-width:0;border:0;background:transparent;outline:none;padding:0;font:600 16px 'Instrument Sans',sans-serif;color:var(--ink)">${wahl.suche ? `<button type="button" data-act="pw-suche-leeren" data-treffer aria-label="${esc(t('Suche leeren'))}" style="width:30px;height:30px;border:0;border-radius:50%;background:var(--field);display:flex;align-items:center;justify-content:center;flex:none;cursor:pointer;appearance:none;padding:0"><span style="pointer-events:none;display:flex">${cross('var(--muted)', 11, 2.4)}</span></button>` : ''}</label>`
    : '';

  let liste;
  if (!kandidaten.length) {
    liste = `<div data-role="personen-alle-dabei" style="display:flex;flex-direction:column;align-items:center;gap:12px;text-align:center;padding:16px 8px 6px">
<span style="width:48px;height:48px;border-radius:50%;background:var(--green-tint);display:flex;align-items:center;justify-content:center">${groupIcon('var(--green-dark)', 22)}</span>
<span style="font-size:13.5px;color:var(--ink-soft);line-height:1.45;max-width:270px">${esc(t('Alle deine Freunde sind schon in {name}.', { name: crew.name }))}</span>
${ctx.freundHinzufuegen ? `<button data-act="pw-freunde" style="min-height:44px;padding:0 16px;border-radius:999px;border:1.5px solid var(--green-a50);background:var(--green-tint);color:var(--green-dark);font:650 13.5px 'Instrument Sans',sans-serif;cursor:pointer;appearance:none"><span style="pointer-events:none">${t('Freunde hinzufügen')}</span></button>` : ''}
</div>`;
  } else {
    // Kein Treffer: der ruhige Hinweis steht oben — schon Gewählte bleiben darunter sichtbar.
    const keineTreffer = suche && !treffer.length
      ? `<div data-role="personen-keine-treffer" style="padding:14px 4px 16px;font-size:13px;color:var(--muted);text-align:center">${esc(t('Niemand gefunden für „{suche}“', { suche: String(wahl.suche || '').trim() }))}</div>`
      : '';
    liste = keineTreffer + sichtbar.map((person, index) => {
      const an = auswahl.has(person.id);
      return `<button data-act="pw-person" data-person="${esc(person.id)}" aria-pressed="${an}" style="display:flex;align-items:center;gap:11px;width:100%;min-height:52px;padding:8px 0;border:0;${index ? 'border-top:1px solid var(--ink-a05);' : ''}background:transparent;cursor:pointer;appearance:none;font-family:'Instrument Sans',sans-serif;text-align:left;box-sizing:border-box">
<span style="display:flex;flex:none;pointer-events:none">${personAvatar(person, { size: 36, fontSize: 13, marker: personMarker(person.id, settings) })}</span>
<span style="font-size:14.5px;font-weight:${an ? 650 : 600};color:${an ? 'var(--ink)' : 'var(--ink-soft)'};flex:1;min-width:0;pointer-events:none;white-space:nowrap;overflow:hidden;text-overflow:ellipsis">${esc(person.name)}</span>
<span style="pointer-events:none;display:flex;flex:none">${auswahlKreis(an)}</span>
</button>`;
    }).join('');
  }
  // Mit Suche behält die Liste ihre Höhe, solange man tippt — das Sheet springt nicht auf und zu.
  const listenHoehe = mitSuche ? `min-height:${kandidaten.length * 53}px;` : '';

  const n = wahl.auswahl.length;
  const fuss = `<div data-role="pw-fuss" style="position:sticky;bottom:-28px;margin:14px -20px -28px;padding:12px 20px 28px;background:var(--surface);display:flex;gap:8px;box-shadow:0 -1px 0 var(--ink-a07);z-index:2">
<button data-act="pw-zu" style="flex:1;min-height:46px;border:1.5px solid var(--ink-a14);background:var(--surface);color:var(--ink-soft);font:650 14px/1 'Instrument Sans',sans-serif;border-radius:999px;cursor:pointer;appearance:none"><span style="pointer-events:none">${kandidaten.length ? t('Abbrechen') : t('Schließen')}</span></button>
${kandidaten.length ? `<button data-act="pw-hinzufuegen" aria-disabled="${!n}" style="flex:1.4;min-height:46px;border:0;background:${n ? 'var(--green)' : 'var(--field)'};color:${n ? 'var(--on-accent)' : 'var(--muted-light)'};font:650 14px/1 'Instrument Sans',sans-serif;border-radius:999px;cursor:${n ? 'pointer' : 'default'};appearance:none;white-space:nowrap"><span style="pointer-events:none">${n ? esc(tn(n, '{n} Person hinzufügen', '{n} Personen hinzufügen')) : t('Hinzufügen')}</span></button>` : ''}
</div>`;

  return sheet(`<div data-role="personen-wahl" data-kandidaten="${kandidaten.length}" style="font-family:'Instrument Sans',sans-serif">
${kopf}
${suchfeld}
<div data-role="personen-liste" style="${listenHoehe}">${liste}</div>
${fuss}
</div>`, { closeAct: 'pw-zu', scrollKey: 'personen-wahl' });
}

function personenWahlAktionen(root, ctx, crew) {
  const { repo, ui } = ctx;
  const guard = dirtyGuard(ctx, 'personen-wahl');
  const auswahlWert = () => [...(ui.personenWahl?.auswahl || [])].sort();
  const suchfeld = root.querySelector('#pw-suche');
  if (suchfeld && !suchfeld.__pwGebunden) {
    suchfeld.__pwGebunden = true;
    suchfeld.addEventListener('input', () => {
      if (!ui.personenWahl) return;
      ui.personenWahl.suche = suchfeld.value;
      ctx.render();
    });
  }
  const GRUENDE = {
    keinAdmin: t('Nur Admins können Personen hinzufügen'),
    keinFreund: t('Nur Freunde lassen sich hinzufügen'),
    keineCrew: t('Gruppe nicht gefunden'),
  };
  return {
    'cd-personen': () => {
      ui.personenWahl = { crewId: crew.id, auswahl: [], suche: '', zurueck: Boolean(ui.editSheet) };
      guard.reset([]);
      rueckmeldung('tipp');
      ctx.render();
    },
    'pw-person': (data) => {
      const wahl = ui.personenWahl;
      if (!wahl) return;
      wahl.auswahl = wahl.auswahl.includes(data.person)
        ? wahl.auswahl.filter((id) => id !== data.person)
        : [...wahl.auswahl, data.person];
      rueckmeldung('auswahl');
      ctx.render();
    },
    'pw-zu': () => {
      const zu = () => { ui.personenWahl = null; ctx.render(); };
      if (!guard.confirm(auswahlWert(), zu)) return;
      zu();
    },
    'pw-suche-leeren': (data, el) => {
      if (!ui.personenWahl) return;
      ui.personenWahl.suche = '';
      ctx.render();
      const feld = (el?.ownerDocument || document).getElementById('pw-suche');
      if (feld) { feld.value = ''; feld.focus({ preventScroll: true }); }
    },
    'pw-freunde': () => ctx.freundHinzufuegen?.oeffnen(ctx),
    'pw-hinzufuegen': () => {
      const wahl = ui.personenWahl;
      if (!wahl?.auswahl.length) return;
      const ergebnis = repo.addCrewMembers(crew.id, wahl.auswahl);
      if (!ergebnis?.ok) {
        rueckmeldung('abgelehnt');
        ctx.toast(GRUENDE[ergebnis?.reason] || t('Das hat nicht geklappt'));
        return;
      }
      const neu = Array.isArray(ergebnis.added) ? ergebnis.added : [];
      guard.clear();
      ui.personenWahl = null;
      // Aus den Details heraus klappt die Liste auf, damit man die Neuen sofort sieht. Aus dem
      // Bearbeiten-Sheet geht es dorthin zurück — Zahl und Stapel sind dort schon aktuell.
      if (!wahl.zurueck) ui.members = true;
      ui.neuDabei = { ids: neu, bis: Date.now() + 2800 };
      rueckmeldung('erfolg');
      ctx.render();
      const gruppe = repo.getCrew(crew.id)?.name || crew.name;
      if (neu.length === 1) ctx.toast(t('{name} ist jetzt in {crew}', { name: repo.getPerson(neu[0])?.name || '', crew: gruppe }));
      else if (neu.length > 1) ctx.toast(tn(neu.length, '{n} Person ist jetzt in {crew}', '{n} Personen sind jetzt in {crew}', { crew: gruppe }));
    },
  };
}

// =====================================================================================
// room.personDetails — 07.5/07.6 Details (+ Personen-Menü, Markieren-Sheet 06.11b)
// =====================================================================================

// Freundesansicht: Ressourcen der Person (freigegeben für Freunde) plus meine eigene,
// wenn ich dieselbe habe und sie für Freunde freigegeben ist — alles projiziert.
function personResourceEntries(ctx, person) {
  const me = ctx.repo.getMe();
  const mine = new Map((profileOf(ctx, me).resourceList || [])
    .map((resource) => [resource.label.toLowerCase(), resource]));
  return (profileOf(ctx, person).resourceList || []).map((resource) => {
    const owners = [{ person, meta: resource }];
    const own = mine.get(resource.label.toLowerCase());
    if (own) owners.push({ person: me, meta: own });
    return { label: resource.label, owners };
  });
}

function renderPersonDetails(ctx) {
  const { repo, ui, params } = ctx;
  const person = repo.getPerson(params.personId);
  if (!person) return { html: emptyScreen('', t('Diese Person gibt es nicht mehr')), bind() {} };
  const settings = repo.getSettings();
  const roomId = roomIdForPerson(person.id);
  const active = Boolean(person.activeMeetId);
  const marker = personMarker(person.id, settings);

  const crews = sharedCrews(ctx, person.id);
  // R6 D3: sichtbare Zeile statt Haarlinie — der Weg in die Gruppe ist jetzt zu sehen.
  const crewRows = crews.map((crew) => {
    const others = crew.memberIds.filter((id) => id !== ME).map((id) => repo.getPerson(id)).filter(Boolean);
    return raumZeile(`<div data-act="pd-crew" data-crew="${crew.id}" style="flex:1;min-width:0;display:flex;align-items:center;gap:11px;min-height:52px;padding:4px 2px;cursor:pointer">
${avatarStack(others, { size: 26, font: 10, max: 2, settings })}
<span style="font-size:14px;font-weight:600;flex:1;min-width:0;pointer-events:none;white-space:nowrap;overflow:hidden;text-overflow:ellipsis">${esc(crew.name)}</span>
<span style="font-size:12px;font-weight:650;color:var(--muted);font-variant-numeric:tabular-nums;pointer-events:none">${crew.memberIds.length}</span>
<span style="pointer-events:none;display:flex;flex:none">${rowChevron}</span>
</div>`, ' data-role="crew-zeile"');
  }).join('');

  // Gemeinsame Interessen: beide echten Bewertungen nebeneinander — deine Punkte grün,
  // ihre blau.
  // v4 P0-4-4: „Interessen sortieren nach ihren Punkten absteigend (3, dann 2, dann 1)."
  // Vorher wurde nach der SUMME beider Bewertungen sortiert; dadurch war KEINE der beiden
  // Spalten absteigend (sichtbar z. B. bei Elif: 1 Punkt oben, 2 Punkte darunter). Jetzt
  // führt die zuerst gezeigte eigene Spalte streng absteigend, danach entscheidet die
  // Spalte der Person und zuletzt der Name — stabil und ohne Gleichstands-Zufall.
  const myLevels = new Map((profileOf(ctx, repo.getMe()).interestList || [])
    .map((entry) => [entry.label.toLowerCase(), entry.level]));
  const interestRows = (profileOf(ctx, person).interestList || [])
    .filter((entry) => myLevels.has(entry.label.toLowerCase()))
    .map((entry) => ({ ...entry, mine: myLevels.get(entry.label.toLowerCase()) }))
    .sort((a, b) => (b.mine - a.mine) || (b.level - a.level) || a.label.localeCompare(b.label))
    .map((entry) => `<div style="display:flex;align-items:center;gap:10px;padding:10px 0;border-top:1px solid var(--ink-a05)">
${detailIcon(interestIconKey(entry.label))}
<span style="font-size:14px;font-weight:600;flex:1;min-width:0;white-space:nowrap;overflow:hidden;text-overflow:ellipsis">${esc(wortAnzeige(entry.label))}</span>
${interestDots(entry.mine, 'var(--green)')}
<span style="width:1px;height:12px;background:var(--ink-a10);flex:none"></span>
${interestDots(entry.level, 'var(--blue)')}
</div>`).join('');

  // v4 C7-Besitzer: In der Zeile steht die Kapazität DIESER Person, nicht das Maximum
  // aller Besitzer — der Besitzer der Zahl ist damit eindeutig.
  const resources = personResourceEntries(ctx, person);
  const resourceRows = resources.map((entry, index) => resourceRow(ctx, entry, index, { ownerId: person.id })).join('');

  const upcoming = repo.getMeets({ context: { personId: person.id }, direction: 'upcoming' });
  const activeMeet = upcoming.find((meet) => meet.status === 'active');
  const history = repo.getMeets({ context: { personId: person.id }, direction: 'history' }).slice(0, 3);
  const historyRows = history.map((meet) => meetHistoryRow(ctx, meet)).join('');
  const meetsRows = (activeMeet || historyRows) ? `<div class="r6-zeilen">${activeMeet ? activeMeetRow(ctx, activeMeet) : ''}${historyRows}</div>` : ''
    || `<div style="padding:9px 0;font-size:12.5px;color:var(--muted-light)">${t('Noch nichts zusammen erlebt')}</div>`;

  const html = screenScaffold({
    header: `<div style="display:flex;align-items:center;padding:8px 20px 0">
<button data-act="back" style="border:0;background:transparent;padding:0;display:flex;cursor:pointer"><span style="pointer-events:none;display:flex">${backArrow('var(--ink)', 22)}</span></button>
<button data-act="pd-menu" aria-label="${esc(t('Optionen'))}" style="margin:-4px -2px -4px auto;width:44px;height:44px;border:0;background:transparent;display:flex;align-items:center;justify-content:center;cursor:pointer;padding:0;appearance:none;flex:none">${punkteKreis(Boolean(ui.menuFor))}</button>
</div>`,
    body: `
<div style="display:flex;flex-direction:column;align-items:center;gap:10px;padding:8px 24px 16px">
<button data-act="bild-gross" data-person="${esc(person.id)}" aria-label="${esc(t('Profilbild von {name} groß ansehen', { name: person.name }))}" style="display:block;border:0;background:transparent;padding:0;cursor:pointer;appearance:none;border-radius:50%;flex:none"><span style="display:block;pointer-events:none">${personAvatar(person, { size: 92, fontSize: 30, active, free: person.free?.active && !active, marker })}</span></button>
<span style="display:flex;align-items:center;gap:8px;font-family:'Bricolage Grotesque',sans-serif;font-size:23px;font-weight:650">${esc(person.name)}${specialLabelChip(marker)}</span>
</div>
<div style="display:flex;flex-direction:column;gap:13px;padding:0 20px 8px">
${busyKarte(ctx, person.id)}
${crewRows ? `<div style="background:var(--surface);border-radius:20px;border:1px solid var(--ink-a07);padding:6px 16px"><div style="display:flex;justify-content:space-between;align-items:baseline;padding:10px 0 4px"><span style="font-size:11px;font-weight:650;letter-spacing:.09em;text-transform:uppercase;color:var(--muted-light)">${t('Gemeinsame Crews')}</span></div><div class="r6-zeilen">${crewRows}</div></div>` : ''}
${interestRows ? profileBox(t('Gemeinsame Interessen'), interestRows, `<span style="font-size:10.5px;color:var(--line-solid)">${t('du · {name}', { name: esc(person.name) })}</span>`) : ''}
${resourceRows ? profileBox(t('Gemeinsame Ressourcen'), resourceRows, `<span style="font-size:10.5px;color:var(--line-solid)">${t('verfügbar · für · wer')}</span>`) : ''}
${profileBox(t('Gemeinsam erlebt'), meetsRows, `<button data-act="pd-all" data-treffer style="position:relative;z-index:1;border:0;background:transparent;padding:0;cursor:pointer;font-family:'Instrument Sans',sans-serif"><span style="pointer-events:none;font-size:12px;font-weight:650;color:var(--green-dark)">${t('Alle ›')}</span></button>`)}
</div>`,
    bottomInset: 26,
    overlays: `${ui.menuFor ? friendMenu(ctx, ui.menuFor) : ''}${ui.sheet === 'mark' ? gemeinsamesMarkSheet(ctx) : ''}${markSwitchSheet(ctx)}${gemeinsamesEntfernenSheet(ctx)}${blockSheet(ctx)}${reportSheet(ctx)}${discardSheet(ctx)}${bildGrossHtml(ctx)}`,
    scrollKey: `person-details-${person.id}`,
  });

  // Ü4: Das Markieren-Sheet ist ein Formular (Label, Symbol, Farbe) — eine begonnene
  // Änderung darf beim Tap auf den Scrim nicht still verschwinden.
  // v4 P0-3-3: Es gibt in diesem Sheet KEINE Beste-Freund-Auswahl mehr, deshalb auch
  // keinen zweiten Schalter, der gleichzeitig an sein könnte.
  const markGuard = dirtyGuard(ctx, 'person-mark');
  const markValue = () => ({
    label: (ui.mkLabel || '').trim(),
    symbol: ui.mkSymbol,
    emoji: ui.mkEmoji,
    color: ui.mkColor,
  });

  return {
    html,
    bind(root) {
      bindActions(root, {
        ...discardActions(ctx),
        ...blockActs(ctx),
        ...bildGrossAktionen(ctx),
        // v7 A06: derselbe Zustand wie in der Freundesliste (ui.menuFor/ui.menuMark),
        // damit friendMenu und friendMenuActs unveraendert wiederverwendet werden koennen.
        'pd-menu': (data, el) => {
          // Runde 4 (C3): gemessen am sichtbaren Kreis, im Rahmen gerechnet.
          const lage = imRahmen(el?.querySelector?.('[data-kreis]') || el);
          const top = lage ? lage.unten + 6 : 92;
          ui.menuFor = ui.menuFor ? null : person.id;
          ui.menuTop = top;
          ui.menuMark = false;
          ui.menuNote = null;
          ctx.render();
        },
        ...friendMenuActs(ctx),
        // v7 A06 (spec/01 §4): Das Personenprofil im Raum rendert seit v7 das GEMEINSAME
        // Markieren-Sheet (gemeinsamesMarkSheet, siehe overlays). Dessen Schaltflaechen
        // heissen mark-* und waren hier nie gebunden — „Speichern" schrieb dadurch nichts
        // in die Datenschicht. Dieselbe Fabrik wie in der Freundesliste schliesst die Luecke,
        // damit Bauform UND Aktionen an beiden Stellen wirklich dieselben sind.
        ...markSheetActs(ctx),
        'pd-crew': (data) => ctx.nav.go('room.crewDetails', { crewId: data.crew }),
        'dt-meet': (data) => ctx.nav.go('meet.details', { meetId: data.meet }),
        'pd-all': () => ctx.nav.go('room.allMeets', { roomId }),
        // §6: nur Details je Besitzer aufklappen; bearbeitet wird im eigenen Profil.
        'res-open': (data) => { ui.resOpen = ui.resOpen === data.label ? null : data.label; ctx.render(); },
        'res-edit': () => ctx.nav.setTab('profil'),
        // v4 P0-3-5 / P0-3-7: „Als bester Freund markieren" markiert direkt und meldet sich
        // sichtbar zurück (dieselben Toasts wie in der Freundesliste). Der WECHSEL von der
        // Besonderen Person zum Besten Freund ist ein Statuswechsel und braucht laut
        // COMPONENT_RULES 3 eine eindeutige Bestätigung — er läuft deshalb über
        // ui.confirmSwitch und nicht mehr still im Hintergrund.
        'pd-best': () => {
          const isBest = (settings.bestFriendIds || []).includes(person.id);
          const isSpecial = settings.specialPerson?.personId === person.id;
          if (isBest) {
            ui.menu = false;
            repo.setBestFriend(person.id, false);
            ctx.toast(t('Bester Freund entfernt'));
            return;
          }
          if (isSpecial) {
            ui.menu = false;
            ui.confirmSwitch = { to: 'best' };
            ctx.render();
            return;
          }
          const result = repo.setBestFriend(person.id, true);
          if (!result.ok) { ui.menuNote = result.reason; ctx.render(); ctx.toast(result.reason); return; }
          ui.menu = false;
          ctx.toast(t('Als bester Freund markiert'));
        },
        // v6 A05a: Der Schalter steuert ausschließlich den EMPFANG des Frei-Hinweises.
        // Die eigene Frei-Meldung (repo.setFree) bleibt davon unberührt.
        'pd-frei-hint': () => {
          const aktuell = repo.getSettings();
          const an = freiHintAktiv(aktuell, person.id);
          const menge = new Set(freiHintPersonen(ctx, aktuell));
          if (an) menge.delete(person.id); else menge.add(person.id);
          repo.updateSettings({ freiHints: { mode: 'individuell', customIds: [...menge] } });
          ctx.toast(an ? t('Frei-Hinweis von {name} aus', { name: person.name }) : t('Frei-Hinweis von {name} an', { name: person.name }));
        },
        // v6 A05b: destruktiv, deshalb erst die Bestätigung — nie sofort ausführen.
        'pd-remove-friend': () => { ui.menu = false; ui.confirmRemove = true; ctx.render(); },
        'rm-cancel': () => { ui.confirmRemove = false; ctx.render(); },
        'rm-confirm': () => {
          ui.confirmRemove = false;
          repo.removeFriend(person.id);
          ctx.toast(t('{name} entfernt', { name: person.name }));
          ctx.nav.resetTo('crew.home');
        },
        // Besondere Person direkt entfernen (Menüvariante für die markierte Person).
        'pd-mark-remove': () => {
          ui.menu = false;
          repo.setSpecialPerson(person.id, null);
          ctx.toast(t('Besondere Person entfernt'));
        },
        // Bestätigter Statuswechsel — der andere Status wird atomar ersetzt.
        'sw-cancel': () => { ui.confirmSwitch = null; ctx.render(); },
        'sw-confirm': () => {
          const pending = ui.confirmSwitch;
          ui.confirmSwitch = null;
          if (!pending) { ctx.render(); return; }
          if (pending.to === 'best') {
            const result = repo.setBestFriend(person.id, true);
            if (!result.ok) { ctx.render(); ctx.toast(result.reason); return; }
            ctx.toast(t('Bester Freund — besonderes Zeichen ersetzt'));
            return;
          }
          // Bestätigt ist der Wechsel; jetzt folgt das reine Besondere-Person-Sheet.
          ui.sheet = 'mark';
          ui.mkLabel = '';
          ui.mkSymbol = SPECIAL_SYMBOL_KEYS[0];
          ui.mkEmoji = '';
          ui.mkColor = MARK_COLORS[0][0];
          ui.mkPalette = false;
          markGuard.reset(markValue());
          ctx.render();
        },
        // v4 P0-3-2/P0-3-7: „Besondere Person" öffnet AUSSCHLIESSLICH das Besondere-Person-
        // Sheet — Symbol, Akzentfarbe, optionales Label, Entfernen. Keine Beste-Freund-
        // Auswahl darin, kein zweiter Auswahlweg für beide Markierungsarten.
        'pd-mark': () => {
          ui.menu = false;
          const isBest = (settings.bestFriendIds || []).includes(person.id);
          const isSpecial = settings.specialPerson?.personId === person.id;
          if (isBest && !isSpecial) {
            ui.confirmSwitch = { to: 'special' };
            ctx.render();
            return;
          }
          ui.sheet = 'mark';
          const special = isSpecial ? settings.specialPerson : null;
          ui.mkLabel = special?.label || '';
          ui.mkSymbol = specialSymbolKey(special?.symbol);
          ui.mkEmoji = special?.emoji || '';
          ui.mkColor = special?.color || MARK_COLORS[0][0];
          ui.mkPalette = false;
          markGuard.reset(markValue());
          ctx.render();
        },
        'mk-close': () => {
          const close = () => { ui.sheet = null; ui.mkPalette = false; ctx.render(); };
          if (!markGuard.confirm(markValue(), close)) return;
          close();
        },
        'mk-symbol': (data) => { ui.mkSymbol = data.symbol; ui.mkEmoji = ''; ctx.render(); },
        // v6 A04b: Das Feld traegt die Eingabe; der Klick fokussiert nur.
        'mk-emoji-focus': (data, el) => { el.querySelector('#mk-emoji')?.focus(); },
        'mk-palette': () => { ui.mkPalette = !ui.mkPalette; ctx.render(); },
        'mk-color': (data) => { ui.mkColor = data.color; ui.mkPalette = false; ctx.render(); },
        'mk-remove': () => {
          markGuard.clear();
          ui.sheet = null;
          if (settings.specialPerson?.personId === person.id) repo.setSpecialPerson(person.id, null);
          ctx.render();
          ctx.toast(t('Besondere Person entfernt'));
        },
        // v4 P0-3-3: Speichern setzt genau EINE Markierung — die Besondere Person. Der
        // Goldring wird dabei atomar zurückgenommen; bestätigt wurde das bereits vor dem
        // Öffnen des Sheets (P0-3-5).
        'mk-save': () => {
          const wasBest = (settings.bestFriendIds || []).includes(person.id);
          markGuard.clear();
          ui.sheet = null;
          repo.setSpecialPerson(person.id, {
            label: (ui.mkLabel || '').trim(),
            symbol: specialSymbolKey(ui.mkSymbol),
            emoji: ui.mkEmoji || '',
            color: ui.mkColor || MARK_COLORS[0][0],
          });
          ctx.toast(wasBest ? t('Besondere Person — Goldring zurückgenommen') : t('Als besondere Person markiert'));
        },
      });
      // v7 A06: Auch die beiden Eingabefelder des gemeinsamen Sheets (#mark-label und
      // #mark-emoji) haengen an input-Ereignissen statt an data-act. Ohne diese Bindung
      // nahm dasselbe Sheet im Raum keinen Text an.
      bindMarkSheetInputs(root, ctx);
      bildGrossBinden(root, ctx);
      // v6 A04b: genau EIN Emoji aus der Systemtastatur uebernehmen.
      root.querySelector('#mk-emoji')?.addEventListener('input', (event) => {
        const zeichen = ersterEmojiCluster(event.target.value);
        ui.mkEmoji = zeichen;
        if (event.target.value !== zeichen) event.target.value = zeichen;
        ctx.render();
      });
      const label = root.querySelector('#mk-label');
      if (label) {
        label.addEventListener('input', () => {
          ui.mkLabel = label.value;
          const counter = root.querySelector('#mk-count');
          if (counter) counter.textContent = `${label.value.length}/18`;
        });
      }
    },
  };
}

// ···-Menü einer Person (COMPONENT_RULES 3).
//
// v4 P0-3-6: Das Menü hat DREI Varianten statt einer festen Liste mit Zustandsanzeige.
// Vorher stand in allen drei Zuständen wortgleich „Bester Freund/in · Besondere Person ·
// Frei-Hinweis" — der Nutzer sah nicht, ob der Klick markiert oder entfernt. Jetzt sagt
// jede Zeile die Aktion:
//   unmarkiert       → „Als besten Freund markieren" · „Als besondere Person markieren"
//   Bester Freund    → „Besten Freund entfernen"     · „Zu besonderer Person wechseln" (Rückfrage)
//   Besondere Person → „Besondere Person bearbeiten" · „Besondere Person entfernen"
//                      · „Zu bestem Freund wechseln" (Rückfrage)
//
// v4 P0-3-7: Wortlaut, Reihenfolge, Verhalten und Rückmeldung sind identisch mit dem
// Drei-Punkte-Menü der Freundesliste (web/screens/profile.js friendMenu).
// v4 P7-1: Der personenbezogene Frei-Hinweis-Schalter ist raus — er ist eine GLOBALE
// Benachrichtigungseinstellung (profile.notifications) und war hier eine zweite,
// konkurrierende Bedienstelle.
// v6 A05a: Der wirksame Zustand ergibt sich aus dem globalen Modus UND der Einzelliste —
// beide Bedienstellen (Profil-Benachrichtigungen und dieses Menü) lesen dieselbe Quelle.
function freiHintAktiv(settings, personId) {
  const hints = settings.freiHints || { mode: 'niemand', customIds: [] };
  if (hints.mode === 'alle') return true;
  if (hints.mode === 'beste') return (settings.bestFriendIds || []).includes(personId);
  if (hints.mode === 'individuell') return (hints.customIds || []).includes(personId);
  return false;
}

// Die aktuell wirksame Menge materialisieren, bevor auf 'individuell' umgeschaltet wird —
// sonst verlieren beim ersten Umschalten alle anderen Personen still ihren Hinweis.
function freiHintPersonen(ctx, settings) {
  const hints = settings.freiHints || { mode: 'niemand', customIds: [] };
  if (hints.mode === 'alle') return ctx.repo.getPeople().map((person) => person.id);
  if (hints.mode === 'beste') return [...(settings.bestFriendIds || [])];
  if (hints.mode === 'individuell') return [...(hints.customIds || [])];
  return [];
}

const freiGlyph = (on) => `<svg width="15" height="15" viewBox="0 0 24 24" fill="none" style="flex:none"><circle cx="12" cy="12" r="8.4" stroke="${on ? 'var(--green)' : 'var(--muted-light)'}" stroke-width="1.8"></circle>${on ? '<circle cx="12" cy="12" r="4" fill="var(--green)"></circle>' : ''}</svg>`;
const personMinusSvg = `<svg width="15" height="15" viewBox="0 0 24 24" fill="none" style="flex:none"><circle cx="10" cy="8" r="3.6" stroke="var(--danger)" stroke-width="1.8"></circle><path d="M3.5 19.5c0-3.3 2.9-5.2 6.5-5.2 1.2 0 2.3.2 3.2.6M16 17.5h5" stroke="var(--danger)" stroke-width="1.8" stroke-linecap="round"></path></svg>`;

// Bestätigung für das Beenden einer Freundschaft (A05b) — dieselbe Bauart wie der
// Markierungswechsel. Benennt ausdrücklich, was NICHT verloren geht.
function removeFriendSheet(ctx, person) {
  if (!ctx.ui.confirmRemove) return '';
  return `<div style="position:absolute;inset:0;z-index:22;display:flex;align-items:flex-end">
<div data-act="rm-cancel" style="position:absolute;inset:0;background:var(--scrim);-webkit-backdrop-filter:var(--scrim-filter);backdrop-filter:var(--scrim-filter)"></div>
<div style="position:relative;width:100%;padding:16px 20px 26px;border-radius:26px 26px 0 0;background:var(--surface);box-shadow:0 -10px 30px var(--shadow-15);font-family:'Instrument Sans',sans-serif;display:flex;flex-direction:column;gap:11px">
<div style="width:38px;height:4px;margin:0 auto 2px;border-radius:999px;background:var(--handle)"></div>
<span style="font-family:'Bricolage Grotesque',sans-serif;font-size:19px;font-weight:650">${t('Freundschaft mit {name} beenden?', { name: esc(person.name) })}</span>
<span style="font-size:13px;color:var(--ink-soft);line-height:1.45;text-wrap:pretty">${t('Ihr seht danach weder eure freie Zeit noch eure Profile. Gemeinsame Meets und deine eigenen Bewertungen bleiben in deinem Verlauf.')}</span>
<div style="display:flex;gap:8px;padding-top:2px">
<button data-act="rm-cancel" style="flex:1;border:1.5px solid var(--ink-a14);background:var(--surface);color:var(--ink-soft);font:650 14px/1 'Instrument Sans',sans-serif;padding:13px 0;border-radius:999px;cursor:pointer;appearance:none"><span style="pointer-events:none">${t('Abbrechen')}</span></button>
<button data-act="rm-confirm" style="flex:1;background:var(--danger);border:0;color:var(--on-accent);font:650 14px/1 'Instrument Sans',sans-serif;padding:14px 0;border-radius:999px;cursor:pointer;appearance:none"><span style="pointer-events:none">${t('Entfernen')}</span></button>
</div>
</div></div>`;
}

// =====================================================================================
// room.newCrew — 07.7 (Name, Bild oder Farbe, Mitglieder → createCrew)
// =====================================================================================

function renderNewCrew(ctx) {
  const { repo, ui } = ctx;
  if (!ui.selected) ui.selected = [];
  if (!ui.color) ui.color = CREW_COLORS[0];

  // v3.2 Ü4/D4: Das Vollbild-Formular ist ein editierbarer Zustand. Das ✕ und der
  // Sprung zur schon vorhandenen Crew dürfen einen getippten Namen und die gewählten
  // Mitglieder nicht still verwerfen. D4 nennt seine Liste ausdrücklich als Minimum.
  const ncGuard = dirtyGuard(ctx, 'new-crew');
  const ncValue = () => ({
    name: (ui.name || '').trim(), selected: [...ui.selected].sort(),
    color: ui.color, photo: ui.photoActive ? ui.photo : null,
  });
  ncGuard.track(ncValue());
  const people = repo.getPeople();
  const valid = Boolean((ui.name || '').trim()) && ui.selected.length > 0;

  // Existiert dieselbe Kombination schon, nur dezent zeigen (reference 07.7).
  const chosen = [ME, ...ui.selected].sort().join('|');
  const duplicate = repo.getCrews().find((crew) => [...crew.memberIds].sort().join('|') === chosen);
  const chosenNames = ui.selected.map((id) => repo.getPerson(id)?.name).filter(Boolean).join(' + ');

  const memberRows = people.map((person) => {
    const selected = ui.selected.includes(person.id);
    return `<div data-act="nc-toggle" data-person="${person.id}" style="display:flex;align-items:center;gap:11px;padding:8px 0;border-top:1px solid var(--ink-a05);cursor:pointer">
<span style="display:flex;flex:none;pointer-events:none">${personAvatar(person, { size: 34, fontSize: 12.5, marker: personMarker(person.id, repo.getSettings()) })}</span>
<span style="font-size:14px;font-weight:600;flex:1;${selected ? '' : 'color:var(--ink-soft);'}pointer-events:none;white-space:nowrap;overflow:hidden;text-overflow:ellipsis">${esc(person.name)}</span>
<span style="pointer-events:none;display:flex">${selected
    ? `<svg width="20" height="20" viewBox="0 0 24 24" fill="none"><circle cx="12" cy="12" r="10" fill="var(--green)"></circle><path d="m8 12 2.6 2.6L16.4 9" stroke="var(--on-accent)" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"></path></svg>`
    : `<span style="width:20px;height:20px;border-radius:50%;border:1.8px solid var(--line-solid);box-sizing:border-box;display:block"></span>`}</span>
</div>`;
  }).join('');

  // v7 A37b gilt weiter: Die Vorschau zeigt nur, was im Baukasten bestätigt wurde.
  // Runde 5 (B3): Sie steht groß oben mittig wie in „Profil bearbeiten" — mit den Initialen des
  // Namens, der gerade im Feld steht; die Farbe wählt man im Baukasten unter „Hintergrund".
  const vorschauCrew = { name: ui.name || '', color: ui.color, groupImage: ui.photoActive ? ui.photo : null };
  // Runde 8: Der Titel heißt wie der Weg hierher — „Neue Gruppe" im „+"-Blatt der Crew-Seite.

  const html = screenScaffold({
    header: `<style>#nc-name::placeholder{color:var(--muted-light);font-weight:600}</style>
<div style="display:flex;align-items:center;gap:10px;padding:10px 20px 12px">
<button data-act="nc-close" aria-label="${esc(t('Schließen'))}" style="width:36px;height:36px;border-radius:50%;background:var(--surface);border:1.5px solid var(--ink-a10);display:flex;align-items:center;justify-content:center;cursor:pointer;padding:0"><span style="pointer-events:none;font-size:14px;color:var(--ink)">✕</span></button>
<span style="font-family:'Bricolage Grotesque',sans-serif;font-size:22px;font-weight:650">${t('Neue Gruppe')}</span>
</div>`,
    body: `<div style="display:flex;flex-direction:column;gap:14px;padding:2px 20px 12px">
<div style="padding:4px 0 2px">${gruppenBildKopf({ act: 'nc-photo', crew: vorschauCrew, text: ui.bildGewaehlt ? t('Gruppenbild ändern') : t('Gruppenbild wählen'), rolle: 'neue-crew-bild' })}</div>
<div style="background:var(--surface);border:1.5px solid var(--ink-a09);border-radius:20px;padding:14px 16px;display:flex;flex-direction:column;gap:7px">
<span style="font-size:11px;font-weight:650;letter-spacing:.09em;text-transform:uppercase;color:var(--muted-light)">${t('Name')}</span>
<input id="nc-name" value="${esc(ui.name || '')}" placeholder="${esc(t('Wie heißt ihr?'))}" autocomplete="off" style="border:0;background:transparent;padding:0;font-size:16px;font-weight:650;font-family:'Instrument Sans',sans-serif;color:var(--ink);outline:none;width:100%">
</div>
<div style="background:var(--surface);border:1.5px solid var(--ink-a09);border-radius:20px;padding:6px 16px">
<div style="display:flex;justify-content:space-between;align-items:center;padding:9px 0"><span style="font-size:11px;font-weight:650;letter-spacing:.09em;text-transform:uppercase;color:var(--muted-light)">${t('Mitglieder')}</span><span style="font-size:11.5px;font-weight:650;color:var(--ink-soft)">${t('{n} gewählt', { n: ui.selected.length })}</span></div>
${memberRows}
<div data-act="nc-more" style="display:flex;align-items:center;gap:11px;padding:9px 0;border-top:1px solid var(--ink-a05);cursor:pointer">
<span style="width:34px;height:34px;border-radius:50%;background:var(--field);display:flex;align-items:center;justify-content:center;flex:none;pointer-events:none">${searchCircleSvg}</span>
<span style="font-size:14px;font-weight:650;color:var(--green-dark);flex:1;pointer-events:none">${t('Weitere Freunde')}</span>
<span style="color:var(--line-strong);pointer-events:none">›</span>
</div>
</div>
${duplicate ? `<div data-act="nc-open" data-room="${roomIdForCrew(duplicate.id)}" style="font-size:11px;color:var(--muted-light);line-height:1.45;padding:0 4px;cursor:pointer">${t(`{namen} gibt's schon als {an}„{name}" ›{aus} — du kannst trotzdem neu erstellen.`, { namen: esc(chosenNames), name: esc(duplicate.name), an: '<b style="color:var(--ink-soft);pointer-events:none">', aus: '</b>' })}</div>` : ''}
</div>`,
    bottom: `${bottomFade(24)}${bottomBar(`<div style="padding:4px 20px 28px;pointer-events:none">
<button data-act="nc-create" aria-disabled="${!valid}" style="pointer-events:auto;display:block;width:100%;border:0;border-radius:999px;padding:16px 0;text-align:center;cursor:${valid ? 'pointer' : 'default'};background:${valid ? 'var(--green)' : 'var(--field)'};${valid ? 'box-shadow:0 8px 22px var(--green-a30);' : ''}font-family:'Instrument Sans',sans-serif"><span style="pointer-events:none;font:650 15px/1 'Instrument Sans',sans-serif;color:${valid ? 'var(--on-accent)' : 'var(--muted-light)'}">${t('Gruppe erstellen')}</span></button>
</div>`, 'pointer-events:none')}`,
    bottomInset: 96,
    scrollKey: 'new-crew',
    // Runde 3 (D5): „Weitere Freunde" öffnet das Einladungs-Sheet über der neuen Gruppe — der
    // halb ausgefüllte Entwurf bleibt dabei stehen.
    overlays: `${gruppenBaukastenSheet(ctx)}${discardSheet(ctx)}${ctx.freundHinzufuegen?.overlay(ctx) || ''}`,
  });

  return {
    html,
    bind(root) {
      bindActions(root, {
        ...discardActions(ctx),
        // Eigene Aktion statt „back": app.js hat einen globalen back-Handler auf
        // derselben Wurzel — ein zweiter würde zusätzlich feuern und doppelt zurückgehen.
        'nc-close': () => {
          const leave = () => ctx.nav.back('crew.home');
          if (ncGuard.confirm(ncValue(), leave)) leave();
        },
        'nc-toggle': (data) => {
          ui.selected = ui.selected.includes(data.person)
            ? ui.selected.filter((id) => id !== data.person)
            : [...ui.selected, data.person];
          ctx.render();
        },
        // Runde 4 (B3): derselbe Baukasten wie im Profil. Abbrechen ändert nichts — weder ui.photo
        // noch die Farbwahl (v7 A37b gilt weiter).
        'nc-photo': () => {
          ui.gruppenPb = pbStart({ photo: ui.photoActive ? ui.photo : null, color: ui.color, initials: crewInitials(ui.name), art: 'gruppe' });
          ctx.render();
        },
        ...gruppenBaukastenAktionen(root, ctx, ({ photo, color }) => {
          ui.photo = photo;
          ui.photoActive = Boolean(photo);
          ui.color = neueGruppenfarbe(ui.color, color);
          ui.bildGewaehlt = true;
        }),
        ...(ctx.freundHinzufuegen?.aktionen(root, ctx) || {}),
        'nc-more': () => (ctx.freundHinzufuegen ? ctx.freundHinzufuegen.oeffnen(ctx) : ctx.nav.go('profile.friendAdd')),
        'nc-open': (data) => {
          const open = () => ctx.nav.replace('room.view', { roomId: data.room });
          if (ncGuard.confirm(ncValue(), open)) open();
        },
        'nc-create': () => {
          const name = (ui.name || '').trim();
          if (!name || !ui.selected.length) return;
          const crew = ctx.repo.createCrew({ name, memberIds: ui.selected, color: ui.color });
          // v7 A37b: Das Bild ging bisher beim Speichern verloren. Es wird jetzt über den
          // EINEN Schreibweg für Gruppenbilder persistiert (repo.updateCrew).
          if (ui.photoActive && ui.photo) ctx.repo.updateCrew(crew.id, { groupImage: ui.photo });
          ncGuard.clear(); // bewusste Übernahme — keine Nachfrage
          ctx.nav.replace('room.view', { roomId: roomIdForCrew(crew.id) });
        },
      });
      // Runde 5 (B3): Beim Tippen ziehen die Initialen in der Vorschau mit, und „Crew erstellen" wird
      // sofort bedienbar. Das Feld im Fokus fasst der Abgleich nicht an; der Handler hängt einmal je Feld.
      const nameInput = root.querySelector('#nc-name');
      if (nameInput && !nameInput.__ncGebunden) {
        nameInput.__ncGebunden = true;
        nameInput.addEventListener('input', () => { ui.name = nameInput.value; ctx.render(); });
      }
    },
  };
}

export const roomScreens = {
  'room.view': renderRoomView,
  'room.allMeets': renderAllMeets,
  'room.crewDetails': renderCrewDetails,
  'room.personDetails': renderPersonDetails,
  'room.newCrew': renderNewCrew,
};
