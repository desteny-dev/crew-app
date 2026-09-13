// Bereich Meet-Details (reference/current 05.6–05.11): Details mit Varianten,
// Stift-Sheet, Drei-Punkte-Dropdown (05.6f), Loop-Sheet (05.9), Zeit-/Aktivitätsvorschlag
// (05.6c/d/e) und Bewertung (05.10/05.11). v14: neutrale Hauptkarte ohne Zustands-Chips.
//
// v3.1-Runtime-Grammatik: jeder Screen dieses Bereichs läuft über screenScaffold —
// genau EINE Scrollfläche, der CTA („Chat öffnen", „Vorschlagen", „Speichern") liegt als
// echte Bottom-Ebene darüber. Keine zweite Scrollfläche, kein zusätzliches overflow:hidden.

import { esc, bindActions, rueckmeldung } from '../core/html.js';
import { activityIconSvg } from '../ui/activity-icons.js';
import { ME, roomIdForCrew, roomIdForPerson, roomIdForMeet } from '../data/ids.js';
import {
  screenScaffold, bottomBar as bottomLayerBar, bottomFade, sheet,
  dirtyGuard, discardSheet, discardActions,
  personAvatar, personMarker,
} from '../ui/components.js';
import { backArrow, trash } from '../ui/icons.js';
import { schliesseMitteilung } from '../core/pwa.js';
import {
  meetMainCard, participationSection, bindMeetPanels,
  meetDateLabel, meetMemberIds, pencilIcon,
  variantPickSheet, meetVorbei, bringRueckblick, pollRueckblick,
  meetFoto, meetFotoKopf, meetFotoAktionen, meetOrtKarte, bindeMeetOrtKarte, meetOrtAktionen,
  meetPanelReihe,
} from '../ui/meet-panels.js';
import { renderDiscoverCore, bindDiscoverCore, chooserScaffold, fitChooserInsets } from './new-meet.js';
import {
  toISODate, now, fromISODate, weekdayShort, weekdayLong, monthLongByIndex, wochenInitialen,
  istJetzt, zeitText,
} from '../core/dates.js';
import { t, tn, tk, zahl } from '../core/sprache.js';

const pad2 = (value) => String(value).padStart(2, '0');
const FONT = "'Instrument Sans',sans-serif";
const TITLE_FONT = "'Bricolage Grotesque',sans-serif";

// --- Bewertung: Stufen, Themen, Farben (R3 E2/E3) -----------------------------------------
//
// Jonathan: „Die Dreifachauswahl ist Pflicht … entweder schlecht, neutral oder gut, drei klare
// Stufen, bessere Wörter als ‚okay'." Die drei Stufen antworten direkt auf „Wie war’s?" — so,
// wie man es einer Freundin sagen würde: „Nicht gut", „Mittel", „Gut". Jede trägt ein Gesicht,
// damit die Stufe auch ohne Lesen erkennbar ist. Die Reihenfolge ist die einer Skala:
// links schlecht, rechts gut (R4 H1: so bleibt es).
const STUFEN = [
  { id: 'nicht-gut', label: t('Nicht gut'), ton: 'rot', gesicht: 'traurig' },
  { id: 'mittel', label: t('Mittel'), ton: 'blau', gesicht: 'neutral' },
  { id: 'gut', label: t('Gut'), ton: 'gruen', gesicht: 'froh' },
];
const STUFE = Object.fromEntries(STUFEN.map((stufe) => [stufe.id, stufe]));
const STUFEN_IDS = STUFEN.map((stufe) => stufe.id);
const NICHT_STATT = 'fand-nicht-statt';

// R4 H2 (Jonathan: „Ich würde es sehr allgemein machen und nicht so viele Dinge, die man
// bewerten kann … People würd ich generell rauslöschen. Location/Place lassen, Kosten lassen,
// Wetter ist uninteressant, Aktivität würd ich auch nehmen … die drei Dinge fassen alles schon
// zusammen."): Genau diese drei. Sie sind zugleich die drei Stellschrauben, an denen die App
// künftige Vorschläge ausrichten kann — WAS, WO, WIE TEUER. Ein viertes Thema bringt keinen
// klaren Gewinn: „Zeitpunkt" lernt die App schon aus Zu- und Absagen, „Leute" bewertet man
// nicht, „Anfahrt" gehört zum Ort, „Wetter" ist nicht steuerbar. Jedes Thema bleibt freiwillig.
// Alte Bewertungen mit anderen Themen gehen nicht verloren (bewertungLesen → fremd).
const THEMEN = [
  { id: 'aktivitaet', label: t('Aktivität'), hilfe: t('Was ihr gemacht habt') },
  { id: 'ort', label: t('Ort'), hilfe: t('Der Ort selbst') },
  { id: 'kosten', label: t('Kosten'), hilfe: t('Was es gekostet hat') },
];
const THEMEN_IDS = THEMEN.map((thema) => thema.id);

// „Fand nicht statt" war ein Grund unter „Nicht passend" — als hätte das Meet schlecht
// gepasst. Es ist jetzt ein eigener, klarer Weg mit einer freiwilligen Nachfrage.
const NICHT_STATT_GRUENDE = [
  { id: 'abgesagt', label: t('Abgesagt') },
  { id: 'verschoben', label: t('Verschoben') },
  { id: 'nicht-dabei', label: t('Ich war nicht dabei') },
];

// v6 A23b bleibt: Ablehnung spricht Rot, Zustimmung Grün, die Mitte ist neutral. `glyph` ist
// die Zeichenfarbe AUF der gefüllten Fläche — die neutrale Fläche ist im dunklen Thema hell,
// darauf braucht das Gesicht die dunkle Grundfarbe.
// R3: nur Tokens. Die frühere Rotschrift #8E2F1E war fest gesetzt und im dunklen Thema
// kaum lesbar; var(--danger) ist die abgedunkelte Rotschrift beider Themen.
//
// R4 H1 (Jonathan: „Mach neutral, vielleicht blau oder so, oder überleg dir eine bessere Farbe
// als grau"): „Mittel" ist jetzt BLAU. Warum Blau und nicht Gelb/Orange als Ampelmitte:
//   · Orange ist in dieser App dem Vorschlags- und Hinweiszustand vorbehalten.
//   · Blau urteilt nicht — es ist ruhig, weder Lob noch Tadel.
//   · Blau bleibt auch bei Rot-Grün-Schwäche klar von Rot UND Grün getrennt; Gelb nicht.
// Die Fläche ist eine Mischung aus vorhandenen Tokens, damit sie in BEIDEN Themen eine
// mittlere Helligkeit hat wie Rot und Grün und das weiße Gesicht darauf lesbar bleibt
// (hell ≈ #6983A7, dunkel ≈ #869DBC). Grau bleibt nur für „Hat nicht stattgefunden".
const REVIEW_TONE = {
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

// R4 C4: Die Bottom-Ebene mit EINEM runden Knopf (Chat öffnen · Fertig · Bewerten) braucht
// unten 122 px Innenabstand — so viel setzt components.passeUntereKanteAn nach jedem Zeichnen
// ohnehin. Stand im Gerüst weniger (68), schrumpfte die Seite beim Abgleich kurz um 54 px, der
// Browser zog die Scrollposition nach oben, und nach dem Wiederherstellen fehlte der Weg:
// Gemessen sprang die Bewertung beim Antippen eines Themas unten um genau 54 px.
const CTA_INSET = 122;

// --- Bereichs-Icons (1:1 aus reference/current/source/05-Meet.dc.html) ---

const chatIcon = () => `<svg width="16" height="16" viewBox="0 0 24 24" fill="none"><path d="M12 20.5a8.5 8.5 0 1 0-8.5-8.5c0 1.5.4 2.9 1.1 4.1L3.5 20.5l4.6-1.1a8.5 8.5 0 0 0 3.9.9Z" stroke="var(--on-accent)" stroke-width="1.8" stroke-linejoin="round"></path></svg>`;
const legsIcon = () => `<svg width="16" height="16" viewBox="0 0 24 24" fill="none"><path d="M4 16v-2.3C4 11.6 3 10.6 3 8.2 3 5.6 4.5 2.5 7.5 2.5 9.4 2.5 10 4.3 10 6c0 3-2 5.6-2 8.7V16a2 2 0 1 1-4 0Z" stroke="var(--ink)" stroke-width="1.8" stroke-linejoin="round"></path><path d="M20 20v-2.3c0-2.1 1-3.1 1-5.5 0-2.6-1.5-5.7-4.5-5.7-1.9 0-2.5 1.8-2.5 3.5 0 3 2 5.6 2 8.7V20a2 2 0 1 0 4 0Z" stroke="var(--ink)" stroke-width="1.8" stroke-linejoin="round"></path><path d="M16 17.5h4M4 13.5h4" stroke="var(--ink)" stroke-width="1.8" stroke-linecap="round"></path></svg>`;
const clockIcon = (color = 'var(--ink)', size = 16) => `<svg width="${size}" height="${size}" viewBox="0 0 24 24" fill="none" style="flex:none"><circle cx="12" cy="12" r="9" stroke="${color}" stroke-width="1.8"></circle><path d="M12 7v5l3.2 2" stroke="${color}" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"></path></svg>`;
const pinIcon = (color = 'var(--muted)', size = 14) => `<svg width="${size}" height="${size}" viewBox="0 0 24 24" fill="none" style="flex:none"><path d="M12 21.5s7-6.1 7-11a7 7 0 1 0-14 0c0 4.9 7 11 7 11Z" stroke="${color}" stroke-width="1.8" stroke-linejoin="round"></path><circle cx="12" cy="10.5" r="2.4" stroke="${color}" stroke-width="1.8"></circle></svg>`;
const peopleIcon = (color = 'var(--muted)', size = 14) => `<svg width="${size}" height="${size}" viewBox="0 0 24 24" fill="none" style="flex:none"><circle cx="9" cy="8.5" r="3.4" stroke="${color}" stroke-width="1.8"></circle><path d="M3.5 19a5.5 5.5 0 0 1 11 0M16 6.2a3.2 3.2 0 0 1 0 5.9M17.5 19a5 5 0 0 0-2.2-3.7" stroke="${color}" stroke-width="1.8" stroke-linecap="round"></path></svg>`;
const arrowRightIcon = () => `<svg width="15" height="15" viewBox="0 0 24 24" fill="none"><path d="M5 12h14M13 6l6 6-6 6" stroke="var(--ink)" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"></path></svg>`;
const circleXIcon = (color = 'var(--ink)') => `<svg width="15" height="15" viewBox="0 0 24 24" fill="none"><circle cx="12" cy="12" r="9" stroke="${color}" stroke-width="1.8"></circle><path d="M9 9l6 6M15 9l-6 6" stroke="${color}" stroke-width="1.8" stroke-linecap="round"></path></svg>`;
const loopIcon = (color = 'var(--blue-dark)') => `<svg width="15" height="15" viewBox="0 0 24 24" fill="none"><path d="M20 12a8 8 0 1 1-2.4-5.7M20 3.5V8h-4.5" stroke="${color}" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"></path></svg>`;
const eyeOffIcon = () => `<svg width="15" height="15" viewBox="0 0 24 24" fill="none"><path d="m4 4 16 16" stroke="var(--ink)" stroke-width="1.8" stroke-linecap="round"></path><path d="M9.9 5.3A9.7 9.7 0 0 1 12 5c5 0 8.5 4.2 9.5 7-.4 1-1.1 2.2-2.1 3.3M6.4 6.6C4.3 8 2.9 10.1 2.5 12c1 2.8 4.5 7 9.5 7 1.4 0 2.7-.3 3.9-.9" stroke="var(--ink)" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"></path><path d="M9.9 9.9a3 3 0 0 0 4.2 4.2" stroke="var(--ink)" stroke-width="1.8" stroke-linecap="round"></path></svg>`;
const closeXIcon = () => `<svg width="22" height="22" viewBox="0 0 24 24" fill="none"><path d="M6 6l12 12M18 6 6 18" stroke="var(--ink)" stroke-width="2" stroke-linecap="round"></path></svg>`;

// --- Gemeinsame Kopfzeile (Zurück + Drei-Punkte, reference 05.6/05.6f) ---

// v6 A08e: Der geöffnete Zustand war eine vollschwarze Kreisfläche (36×36 px reines
// var(--ink)) — zusammen mit „Chat öffnen" standen dadurch zwei schwarze Flächen im Screen.
// „Gedrückt" sagt jetzt die getönte Fläche des Produkts (var(--field)) mit klarer Kontur;
// die Glyphe wird dunkler statt weiß, der Knopf bleibt also eindeutig aktiv.
// R4: options.titel setzt eine Überschrift zwischen Zurück und Menü (Bewertung „Wie war’s?") —
// die Kopfzeile bleibt dabei gleich hoch.
function headerRow(menuOpen, options = {}) {
  const dotsButton = options.noMenu ? '' : `<button data-act="menu" data-treffer aria-label="${esc(t('Menü'))}" style="margin-left:auto;width:40px;height:40px;border-radius:50%;background:${menuOpen ? 'var(--field)' : 'var(--surface)'};border:1px solid ${menuOpen ? 'var(--ink-a22)' : 'var(--ink-a10)'};display:flex;align-items:center;justify-content:center;cursor:pointer;appearance:none;padding:0;font-family:${FONT};flex:none"><span style="pointer-events:none;color:${menuOpen ? 'var(--ink)' : 'var(--ink-soft)'};letter-spacing:1px;font-weight:800;font-size:17px;line-height:1">···</span></button>`;
  const titel = options.titel
    ? `<span data-role="kopf-titel" style="font-family:${TITLE_FONT};font-size:20px;line-height:26px;font-weight:650;letter-spacing:-.01em;flex:1;min-width:0;white-space:nowrap;overflow:hidden;text-overflow:ellipsis">${esc(options.titel)}</span>`
    : '';
  return `<div style="display:flex;align-items:center;gap:10px;padding:10px 20px 4px;flex:none;position:relative;z-index:16">
<button data-act="back" aria-label="${esc(t('Zurück'))}" style="width:36px;height:36px;margin-left:-8px;border:0;background:transparent;display:flex;align-items:center;justify-content:center;cursor:pointer;appearance:none;padding:0;flex:none"><span style="pointer-events:none;display:flex">${backArrow('var(--ink)', 22)}</span></button>
${titel}${dotsButton}</div>`;
}

// Fullscreen-Kopf mit X (reference 05.6e).
function closeHeader(title) {
  return `<div style="display:flex;align-items:center;gap:12px;padding:8px 20px 6px;flex:none">
<button data-act="back" aria-label="${esc(t('Schließen'))}" style="width:36px;height:36px;margin-left:-7px;border:0;background:transparent;display:flex;align-items:center;justify-content:center;cursor:pointer;appearance:none;padding:0"><span style="pointer-events:none;display:flex">${closeXIcon()}</span></button>
<span style="font-family:${TITLE_FONT};font-size:20px;font-weight:650;flex:1">${esc(title)}</span>
</div>`;
}

// v6 A08b: Der Knopf war ein durchgehend schwarzer Balken über fast der ganzen
// Screenbreite (gemessen 350×48 px reines var(--ink)) und damit die dominanteste Fläche des
// Screens. Er trägt jetzt die Bedeutungsfarbe des Produkts mit klarer Kontur — dieselbe
// Sprache wie alle anderen bestätigenden Aktionen, nur eine Spur ruhiger als Volltonschwarz.
function chatButton() {
  return `<button data-act="open-chat" style="pointer-events:auto;width:100%;display:flex;align-items:center;justify-content:center;gap:8px;background:var(--green);color:var(--on-accent);font:650 15px/1 ${FONT};padding:16px 0;border-radius:999px;border:1.5px solid var(--green-dark);box-sizing:border-box;box-shadow:0 6px 18px var(--green-a26);cursor:pointer;appearance:none"><span style="pointer-events:none;display:flex">${chatIcon()}</span><span style="pointer-events:none">${t('Chat öffnen')}</span></button>`;
}

// --- Bottom-Ebene (v3.1 §1/§8) ------------------------------------------------------
// Genau EIN echtes Bedienelement. „Chat öffnen" ist die eine wichtigste Aktion dieses
// Screens und damit der einzige dunkle Ink-Button; die Teilnahme wird direkt in der
// Dreifach-Control im Inhalt gesetzt (keine zweite Variante derselben Funktion).
//
// v4 P0-5: Der Träger ist durchsichtig und fängt keine Eingaben ab. Vorher lag hier eine
// vollbreite, fast deckende Fläche (var(--paper-a94) plus Blur) mit pointer-events:auto
// über dem Inhalt — genau die verbotene Phantom-/Wandebene. Deckend ist jetzt nur noch der
// runde Knopf selbst; das weiche Ausblenden macht die Unterkanten-Maske des Scaffolds.
// Den Innenabstand darunter setzt CTA_INSET (R4 C4, siehe oben).

function bottomLayer(innerHtml, options = {}) {
  return `${bottomFade(options.fade ?? 8)}${bottomLayerBar(`<div style="padding:${options.padding || '6px 20px 26px'};pointer-events:none">${innerHtml}</div>`, 'pointer-events:none')}`;
}

function detailBottom() {
  return bottomLayer(chatButton());
}

// Zwei Aktionen nebeneinander (Abbrechen · bestätigen) — der bestätigende Knopf trägt
// die Bedeutungsfarbe Grün, kein zweiter Ink-Button. Beide sind eigenständig deckend,
// damit sie ohne Trägerfläche über dem Inhalt lesbar bleiben.
function actionsBottom(cancelLabel, confirmAct, confirmLabel) {
  return bottomLayer(`<div style="display:flex;gap:8px;pointer-events:none">
<button data-act="back" style="pointer-events:auto;flex:1;border:1.5px solid var(--ink-a14);color:var(--ink-soft);font:650 14px/1 ${FONT};padding:13px 0;border-radius:999px;background:var(--paper-soft);box-shadow:0 2px 8px var(--shadow-08);cursor:pointer;appearance:none">${cancelLabel}</button>
<button data-act="${confirmAct}" style="pointer-events:auto;flex:1.4;background:var(--green);color:var(--on-accent);font:650 14px/1 ${FONT};padding:14px 0;border-radius:999px;border:0;box-shadow:0 4px 14px var(--green-a28);cursor:pointer;appearance:none">${confirmLabel}</button>
</div>`);
}

// v6 A13a: „Chat öffnen" führt ALLE Teilnehmenden in denselben Raum.
//
// Vorher wählte die Funktion bei fehlender Crew einfach die erste andere Person und
// öffnete deren 1:1-Chat — bei einem Meet mit Lena und Noah landete man in Lenas Raum,
// in dem Noah gar nicht vorkommt, und beide sahen getrennte Verläufe unter derselben
// Meet-Karte. Die Reihenfolge ist jetzt: gemeinsamer Meet-Raum → Crew-Raum → 1:1.
//
// Der Meet-Raum wird bevorzugt aus meet.roomId gelesen (dort legt ihn das Veröffentlichen
// an). Ältere Meets aus dem Seed tragen dieses Feld nicht; weil die Raum-ID rein aus der
// Meet-ID ableitbar ist, führt roomIdForMeet dort trotzdem alle in denselben Raum.
function chatRoomId(meet) {
  if (meet.roomId) return meet.roomId;
  if (meet.crewId) return roomIdForCrew(meet.crewId);
  const andere = [...new Set([meet.creatorId, ...(meet.personIds || [])].filter((id) => id && id !== ME))];
  if (andere.length > 1) return roomIdForMeet(meet.id);
  return andere.length === 1 ? roomIdForPerson(andere[0]) : null;
}

// --- Varianten-Karte (reference 05.6c / 05.6d) ---

// Auftrag §7: Ein Vorschlag zeigte nur eine Uhrzeit — „18:00". An welchem Tag, stand
// nirgends, solange er auf denselben Tag fiel wie das Meet; man musste es sich denken.
// Jetzt steht immer da, WANN: „jetzt", „heute, 18:00", „morgen, 18:00", „Sonntag, 18:00".
// R4 F2 (Jonathan: „die Zeit wäre jetzt … dann wird nicht die Uhrzeit angezeigt, sondern
// einfach nur jetzt"): Ein als „Jetzt" gewählter Vorschlag trägt die Marke `now` und heißt
// „Jetzt" (core/dates.js istJetzt). Geraten wird nicht mehr — vorher hieß jede Uhrzeit
// zwischen einer Stunde zurück und fünf Minuten voraus „jetzt", auch eine fest gewählte.
function variantTimeLabel(variant, meet) {
  const datum = variant.date || meet?.date;
  const termin = { ...variant, date: datum };
  if (istJetzt(termin)) return t('Jetzt');
  const zeit = zeitText(termin);
  if (!datum) return zeit;
  const heute = toISODate(now());
  const morgen = toISODate(new Date(fromISODate(heute).getTime() + 86400000));
  if (datum === heute) return t('heute, {zeit}', { zeit });
  if (datum === morgen) return t('morgen, {zeit}', { zeit });
  return `${weekdayLong(datum)}, ${zeit}`;
}

function variantsCard(ctx, meet, kind) {
  const variants = (meet.variants || []).filter((variant) => variant.kind === kind);
  if (!variants.length) return '';
  const { repo } = ctx;

  const votedIds = new Set(variants.flatMap((variant) => variant.votes));
  const yesIds = meetMemberIds(repo, meet).filter((id) => meet.participation?.[id] === 'yes');
  const originalVotes = yesIds.filter((id) => !votedIds.has(id)).length;
  const total = Math.max(1, originalVotes + variants.reduce((sum, variant) => sum + variant.votes.length, 0));
  const myVariant = variants.find((variant) => variant.votes.includes(ME));
  const iVoteOriginal = !myVariant && meet.participation?.[ME] === 'yes';

  const share = (votes) => Math.min(92, Math.max(14, Math.round((votes / total) * 100)));

  // v5 A14c: Meine Wahl ist an der FLÄCHE erkennbar — vollflächig grün statt beige mit
  // Rahmen und Etikett. Das Etikett „Deine Stimme" entfällt ersatzlos; es sagte dasselbe
  // ein zweites Mal und drängte den Titel auf 42 % Breite zusammen.
  const frame = `<span style="position:absolute;inset:0;border-radius:11px;border:1.5px solid var(--green-a60);box-sizing:border-box;pointer-events:none;z-index:1"></span>`;

  const rows = [];

  const originalLabel = kind === 'time'
    ? `${t('{zeit} · Original', { zeit: esc(zeitText(meet)) })} ✓`
    : t('{titel} · Original', { titel: esc(meet.title) });
  rows.push(`<div style="position:relative">
<button data-act="vote-original" data-kind="${kind}" style="display:flex;align-items:center;gap:9px;width:100%;border:0;background:transparent;padding:0;cursor:pointer;appearance:none;font-family:${FONT}">
<span style="flex:1;height:34px;border-radius:11px;background:${iVoteOriginal ? 'var(--green-tint)' : 'var(--paper)'};position:relative;overflow:hidden;display:block;pointer-events:none">
<span style="position:absolute;inset:0;width:${share(originalVotes)}%;background:${iVoteOriginal ? 'var(--green-a22)' : 'var(--field)'}"></span>
<span style="position:absolute;left:12px;top:8px;font-size:12.5px;font-weight:650;color:var(--green-dark);max-width:80%;overflow:hidden;text-overflow:ellipsis;white-space:nowrap">${originalLabel}</span>
${iVoteOriginal ? frame : ''}
</span>
<span style="font-size:12.5px;font-weight:650;color:var(--green-dark);font-variant-numeric:tabular-nums;min-width:14px;text-align:right;pointer-events:none">${originalVotes}</span>
</button></div>`);

  for (const variant of variants) {
    const own = variant.authorId === ME;
    const mine = variant.votes.includes(ME);
    const author = repo.getPerson(variant.authorId);
    const authorName = author?.name || '—';
    let label;
    if (kind === 'time') {
      label = own
        ? t('{zeit} · Vorschlag von dir', { zeit: esc(variantTimeLabel(variant, meet)) })
        : t('{zeit} · Vorschlag von {name}', { zeit: esc(variantTimeLabel(variant, meet)), name: esc(authorName) });
    } else {
      label = variant.votes.length > 1
        ? `${esc(variant.title || '')} · ${variant.votes.length}×`
        : (own
          ? t('{titel} · von dir', { titel: esc(variant.title || '') })
          : t('{titel} · von {name}', { titel: esc(variant.title || ''), name: esc(authorName) }));
    }
    // v5 A14c: Der Stift sitzt INNERHALB des Balkens (nicht am Rand des Zeilen-Wrappers,
    // der die Stimmenzahl mit einschließt). Vorher lag er mit z-index 5 über der Zahl.
    const pencilButton = own
      ? `<button data-act="edit-variant" data-variant="${esc(variant.id)}" data-kind="${kind}" aria-label="${esc(t('Bearbeiten'))}" style="position:absolute;right:5px;top:5px;width:24px;height:24px;border-radius:50%;background:var(--surface);border:1px solid var(--ink-a12);display:flex;align-items:center;justify-content:center;cursor:pointer;appearance:none;padding:0;z-index:5"><span style="pointer-events:none;display:flex">${pencilIcon('var(--ink)', 11)}</span></button>`
      : '';
    const maxWidth = own ? '58%' : '80%';
    rows.push(`<div style="position:relative">
<button data-act="vote-variant" data-variant="${esc(variant.id)}" style="display:flex;align-items:center;gap:9px;width:100%;border:0;background:transparent;padding:0;cursor:pointer;appearance:none;font-family:${FONT}">
<span style="flex:1;height:34px;border-radius:11px;background:${mine ? 'var(--green-tint)' : 'var(--paper)'};position:relative;overflow:hidden;display:block;pointer-events:none">
<span style="position:absolute;inset:0;width:${share(variant.votes.length)}%;background:${mine ? 'var(--green-a22)' : 'var(--field)'}"></span>
<span style="position:absolute;left:12px;top:8px;font-size:12.5px;font-weight:650;color:${mine ? 'var(--green-dark)' : 'var(--ink-soft)'};max-width:${maxWidth};overflow:hidden;text-overflow:ellipsis;white-space:nowrap">${label}</span>
${mine ? frame : ''}${pencilButton}
</span>
<span style="font-size:12.5px;font-weight:650;color:${mine ? 'var(--green-dark)' : 'var(--muted)'};font-variant-numeric:tabular-nums;min-width:14px;text-align:right;pointer-events:none">${variant.votes.length}</span>
</button></div>`);
  }

  const canDecide = meet.creatorId === ME && meet.status === 'open' && typeof ctx.repo.decideMeet === 'function';
  const footer = `<div style="display:flex;gap:7px;align-items:center">
<button data-act="propose" data-kind="${kind}" style="border:1.5px dashed var(--ink-a20);border-radius:999px;padding:8px 14px;font:650 12px ${FONT};color:var(--ink-soft);background:transparent;cursor:pointer;appearance:none">${t('+ Vorschlag')}</button>
${canDecide ? `<button data-act="decide" data-kind="${kind}" style="margin-left:auto;background:var(--green);color:var(--on-accent);border-radius:999px;padding:9px 16px;font:650 12.5px ${FONT};border:0;cursor:pointer;appearance:none">${t('Festlegen')}</button>` : ''}
</div>`;

  const headline = kind === 'time' ? t('Zeit') : t('Aktivität');
  return `<div style="background:var(--surface);border:1px solid var(--ink-a10);border-radius:20px;padding:13px 16px;display:flex;flex-direction:column;gap:9px;flex:none">
<div style="display:flex;justify-content:space-between;align-items:center"><span style="font-size:11px;font-weight:650;letter-spacing:.09em;text-transform:uppercase;color:var(--orange-dark)">${headline} · ${tn(variants.length + 1, '{n} Vorschlag', '{n} Vorschläge')}</span><span style="font-size:11px;color:var(--muted-light)">${t('nur dieses Feld offen')}</span></div>
${rows.join('')}
${footer}</div>`;
}

// „Als Vorlage nutzen": neuer Entwurf mit Idee/Ort dieses Meets im Composer (Vertrag §7).
function alsVorlageNutzen(ctx, meet) {
  const { repo, nav, ui } = ctx;
  ui.menu = false;
  const draft = repo.createDraft(meet.crewId
    ? { withCrewId: meet.crewId }
    : { withPersonIds: (meet.personIds || []).filter((id) => id !== ME) });
  repo.updateDraft(draft.id, {
    idea: { title: meet.title, icon: meet.icon, category: meet.category, source: 'own', suggestionId: null },
    place: meet.place?.name
      ? { ...meet.place, mode: 'search' }
      : null,
  });
  nav.go('newMeet.discover', { draftId: draft.id });
}

// --- Drei-Punkte-Dropdown (05.6f: klein, am Icon verankert; eine Zeile = Icon + Bezeichnung) ---

function menuRows(items) {
  return items.map((item, index) => {
    const border = index < items.length - 1 ? 'border-bottom:1px solid var(--ink-a06)' : '';
    if (item.disabled) {
      return `<div style="display:flex;align-items:center;gap:10px;padding:11px 15px;${border}"><span style="display:flex;flex:none">${item.icon}</span><span style="font-size:13px;font-weight:650;color:var(--line-solid)">${item.label}</span></div>`;
    }
    return `<button data-act="${item.act}" style="display:flex;align-items:center;gap:10px;padding:11px 15px;width:100%;border:0;background:transparent;cursor:pointer;appearance:none;font-family:${FONT};text-align:left;${border}"><span style="pointer-events:none;display:flex;flex:none">${item.icon}</span><span style="font-size:13px;font-weight:650;color:${item.color || 'var(--ink)'};pointer-events:none">${item.label}</span></button>`;
  }).join('');
}

function menuShell(items) {
  return `<div style="position:absolute;inset:0;z-index:15">
<div data-act="close-menu" style="position:absolute;inset:0"></div>
<div style="position:absolute;right:18px;top:92px;width:200px;background:var(--surface);border-radius:16px;border:1px solid var(--ink-a07);box-shadow:0 8px 24px var(--shadow-18);overflow:hidden">${menuRows(items)}</div>
</div>`;
}

function detailsMenu(ctx, meet) {
  const items = [];
  items.push({ act: 'menu-template', icon: arrowRightIcon(), label: t('Als Vorlage nutzen') });
  items.push({ act: 'menu-loop', icon: loopIcon(), label: meet.loop?.active ? t('Loop bearbeiten') : t('Als Loop starten'), color: 'var(--blue-dark)' });
  items.push({ act: 'menu-leave', icon: circleXIcon('var(--ink)'), label: t('Teilnahme absagen') });
  if (meet.creatorId === ME && meet.status !== 'draft') {
    items.push({ act: 'menu-cancel', icon: circleXIcon('var(--red)'), label: t('Meet absagen'), color: 'var(--red)' });
  }
  if (meet.status === 'draft') {
    items.push({ act: 'menu-delete', icon: trash('var(--red)', 15), label: t('Löschen'), color: 'var(--red)' });
  } else {
    // Löschen gibt es nur für leere Entwürfe — hier bewusst stumm (reference 05.6f).
    items.push({ disabled: true, icon: trash('var(--line-solid)', 15), label: t('Löschen') });
  }
  return menuShell(items);
}

// --- Stift-Sheet (reference 05.6b): NUR Aktivität vorschlagen & Zeit vorschlagen ---

function pencilSheet() {
  const row = (act, icon, title, subtitle, last) => `<button data-act="${act}" style="width:100%;background:var(--paper);border-radius:16px;padding:14px 15px;display:flex;align-items:center;gap:11px;border:0;cursor:pointer;appearance:none;font-family:${FONT};text-align:left${last ? '' : ';margin-bottom:12px'}">
<span style="width:36px;height:36px;border-radius:12px;background:var(--surface);display:flex;align-items:center;justify-content:center;flex:none;pointer-events:none">${icon}</span>
<span style="display:flex;flex-direction:column;gap:1px;flex:1;pointer-events:none"><span style="font-size:14.5px;font-weight:650;color:var(--ink)">${title}</span><span style="font-size:11.5px;color:var(--muted)">${subtitle}</span></span>
<span style="color:var(--line-strong);pointer-events:none">›</span>
</button>`;
  return sheet(`<span style="font-family:${TITLE_FONT};font-size:19px;font-weight:650;display:block;margin-bottom:12px">${t('Vorschlagen')}</span>
${row('go-propose-activity', legsIcon(), t('Aktivität vorschlagen'), t('als Variante dieses Meets'))}
${row('go-propose-time', clockIcon('var(--ink)', 16), t('Zeit vorschlagen'), t('Original bleibt wählbar'), true)}`, { closeAct: 'close-sheet' });
}

// --- Segmente & Walzen (reference 05.9: drei sichtbare Werte, Auswahlfläche dahinter) ---

function segment(items, act, dataKey, padding = 8) {
  return `<div style="background:var(--field);border-radius:14px;padding:3px;display:flex;gap:3px">${items.map((item) => `<button data-act="${act}" data-${dataKey}="${esc(item.value)}" style="flex:1;border-radius:11px;padding:${padding}px 0;text-align:center;font:${item.active ? 650 : 600} 12.5px ${FONT};border:0;cursor:pointer;appearance:none;overflow:hidden;white-space:nowrap;${item.active ? 'background:var(--surface);box-shadow:0 1px 3px var(--shadow-08);color:var(--ink)' : 'background:transparent;color:var(--muted)'}">${esc(item.label)}</button>`).join('')}</div>`;
}

// --- Ziehbares Rad (v3.1 §7 + RUNTIME_QUALITY_CONTRACT §3) ---------------------------
// Echtes iPhone-artiges Rad: der Inhalt folgt dem Pointer kontinuierlich, der Wert rastet
// in echten Schritten ein. Tippen auf einen Nachbarwert bleibt zusätzlich möglich.
// data-hdrag markiert das Rad als eigenes Bedienelement (Gesten-Priorität).
//
// Aufbau: `visible` sichtbare Zeilen (Referenz 08.6 = 5, Referenz 05.9 = 3) plus je eine
// verdeckte Pufferzeile oben/unten, damit beim Ziehen nie eine Lücke entsteht.

const WHEEL_ROW = 26;

function wheelValueAt(config, center, delta) {
  const raw = center + delta * config.step;
  if (config.mode === 'mod') return ((raw % config.modulo) + config.modulo) % config.modulo;
  return raw < config.min || raw > config.max ? null : raw;
}

function wheelLabel(config, value) {
  if (value === null) return '';
  return config.format === 'pad2' ? pad2(value) : String(value);
}

// config: {name, value, step, visible, mode:'mod'|'range', modulo?, min?, max?, format, width}
function wheel(config) {
  const visible = config.visible || 3;
  const centerIndex = (visible + 1) / 2;
  const count = visible + 2;
  const rows = [];
  for (let index = 0; index < count; index += 1) {
    const value = wheelValueAt(config, config.value, index - centerIndex);
    const center = index === centerIndex;
    const look = center
      ? `font-size:${config.centerSize || 20}px;font-weight:650;color:var(--ink)`
      : 'font-size:13px;font-weight:600;color:var(--line-solid)';
    rows.push(`<span data-wheel-row="${index}" data-value="${value === null ? '' : value}" style="display:block;height:${WHEEL_ROW}px;line-height:${WHEEL_ROW}px;text-align:center;${look}">${esc(wheelLabel(config, value))}</span>`);
  }
  const range = config.mode === 'range' ? ` data-min="${config.min}" data-max="${config.max}"` : ` data-modulo="${config.modulo}"`;
  return `<div data-wheel="${esc(config.name)}" data-hdrag="wheel" role="slider" aria-label="${esc(config.label || config.name)}" aria-valuenow="${config.value}" data-mode="${config.mode}" data-step="${config.step}" data-format="${config.format}" data-center="${centerIndex}" data-value="${config.value}"${range} style="width:${config.width || 56}px;height:${visible * WHEEL_ROW}px;position:relative;overflow:hidden;flex:none;touch-action:none;cursor:grab;user-select:none;-webkit-user-select:none;font-variant-numeric:tabular-nums;font-family:${FONT}">
<div data-wheel-track style="position:absolute;left:0;right:0;top:${-WHEEL_ROW}px;will-change:transform">${rows.join('')}</div>
</div>`;
}

// Stunden-/Minutenrad. options: {visible, band, bandBorder}
function timeWheel(hour, minute, options = {}) {
  const visible = options.visible || 3;
  const band = options.band || 'var(--paper)';
  const border = options.bandBorder ? `border:1.5px solid ${options.bandBorder};` : '';
  return `<div style="display:flex;gap:14px;align-items:center;justify-content:center;position:relative;padding:6px 0 2px">
<div style="position:absolute;left:50%;margin-left:-93px;width:186px;top:50%;transform:translateY(-50%);height:${WHEEL_ROW + 14}px;border-radius:13px;background:${band};${border}box-sizing:border-box"></div>
${wheel({ name: 'hour', label: t('Stunde'), value: hour, step: 1, mode: 'mod', modulo: 24, format: 'pad2', visible })}
<span style="font-size:20px;font-weight:650;position:relative;padding-bottom:2px">:</span>
${wheel({ name: 'minute', label: t('Minute'), value: minute, step: 15, mode: 'mod', modulo: 60, format: 'pad2', visible })}
</div>`;
}

// Bindet alle Räder eines Screens. onCommit(name, value) läuft erst beim Loslassen —
// währenddessen folgt der Inhalt dem Pointer, ohne den Screen neu zu rendern.
function bindWheels(root, onCommit) {
  root.querySelectorAll('[data-wheel]').forEach((element) => {
    const track = element.querySelector('[data-wheel-track]');
    const rows = [...element.querySelectorAll('[data-wheel-row]')];
    if (!track || !rows.length) return;
    const config = {
      mode: element.dataset.mode,
      step: Number(element.dataset.step),
      modulo: Number(element.dataset.modulo),
      min: Number(element.dataset.min),
      max: Number(element.dataset.max),
      format: element.dataset.format,
    };
    const centerIndex = Number(element.dataset.center);
    const name = element.dataset.wheel;
    let value = Number(element.dataset.value);
    let start = null;
    let moved = false;

    const paint = () => {
      rows.forEach((row, index) => {
        const next = wheelValueAt(config, value, index - centerIndex);
        row.textContent = wheelLabel(config, next);
        row.dataset.value = next === null ? '' : String(next);
      });
      element.setAttribute('aria-valuenow', String(value));
    };

    element.addEventListener('pointerdown', (event) => {
      if (event.button !== undefined && event.button !== 0) return;
      // Pointer-Capture leitet spätere Events auf das Rad um — die angetippte Zeile
      // wird deshalb schon beim Drücken gemerkt.
      start = { y: event.clientY, value, id: event.pointerId, row: event.target?.closest?.('[data-wheel-row]') || null };
      moved = false;
      track.style.transition = 'none';
      element.setPointerCapture?.(event.pointerId);
    });

    element.addEventListener('pointermove', (event) => {
      if (!start || event.pointerId !== start.id) return;
      event.preventDefault();
      const dy = event.clientY - start.y;
      if (Math.abs(dy) > 3) moved = true;
      const steps = Math.round(dy / WHEEL_ROW);
      let next = start.value - steps * config.step;
      if (config.mode === 'mod') next = ((next % config.modulo) + config.modulo) % config.modulo;
      else next = Math.min(config.max, Math.max(config.min, next));
      if (next !== value) { value = next; paint(); }
      // Rest-Weg unter einer Rasterstufe: das Rad folgt dem Finger sichtbar weiter.
      track.style.transform = `translateY(${dy - steps * WHEEL_ROW}px)`;
    });

    const finish = () => {
      if (!start) return;
      const tapped = moved ? null : start.row;
      start = null;
      track.style.transition = 'transform .16s ease-out';
      track.style.transform = 'translateY(0px)';
      if (tapped && tapped.dataset.value !== '') value = Number(tapped.dataset.value);
      element.dataset.value = String(value);
      paint();
      onCommit(name, value);
    };

    element.addEventListener('pointerup', finish);
    element.addEventListener('pointercancel', finish);
  });
}

// --- Monatskalender (Familie 08.6, für Zeit vorschlagen) ---

function calendarCard(view, selectedISO) {
  const [year, month] = view.split('-').map(Number);
  const todayISO = toISODate(now());
  const first = new Date(year, month - 1, 1);
  const lead = (first.getDay() + 6) % 7;
  const daysInMonth = new Date(year, month, 0).getDate();
  const prevMonthDays = new Date(year, month - 1, 0).getDate();

  // v3.1 §7: Tage aus Nachbarmonaten sind echte Auswahlflächen — die Monatsansicht
  // springt beim Antippen passend mit (cal-day setzt view aus dem Datum).
  // v6 A08c: Der ausgewählte Tag war ein voll schwarzer Kreis (var(--ink)) — die härteste
  // Fläche des Screens für eine reine Auswahl. Auswahl spricht jetzt in der Akzentfarbe:
  // heute UND gewählt bleibt gefüllt grün, ein anderer gewählter Tag bekommt die ruhige
  // weiße Fläche mit grüner Kontur.
  const cell = (iso, day, muted) => {
    if (iso === selectedISO) {
      const look = iso === todayISO
        ? 'background:var(--green);color:var(--on-accent)'
        : 'background:var(--green-a10);box-shadow:inset 0 0 0 1.5px var(--green);color:var(--ink)';
      return `<button data-act="cal-day" data-date="${iso}" style="display:flex;align-items:center;justify-content:center;padding:2px 0;border:0;background:transparent;cursor:pointer;appearance:none;font-family:${FONT}"><span style="width:26px;height:26px;border-radius:50%;${look};box-sizing:border-box;display:flex;align-items:center;justify-content:center;font:650 12px ${FONT};pointer-events:none">${day}</span></button>`;
    }
    // R3: Token statt fester Farbe — #D6D0C6 leuchtete im dunklen Thema wie ein wählbarer Tag.
    if (iso < todayISO) return `<span style="padding:5px 0;color:var(--line-solid)">${day}</span>`;
    return `<button data-act="cal-day" data-date="${iso}" style="padding:5px 0;border:0;background:transparent;font:600 12px ${FONT};color:${muted ? 'var(--line-strong)' : 'var(--ink)'};cursor:pointer;appearance:none">${day}</button>`;
  };

  const isoOf = (date) => `${date.getFullYear()}-${pad2(date.getMonth() + 1)}-${pad2(date.getDate())}`;

  const cells = [];
  for (let i = 0; i < lead; i += 1) {
    const day = prevMonthDays - lead + 1 + i;
    cells.push(cell(isoOf(new Date(year, month - 2, day)), day, true));
  }
  for (let day = 1; day <= daysInMonth; day += 1) {
    cells.push(cell(`${year}-${pad2(month)}-${pad2(day)}`, day, false));
  }
  let trailing = 0;
  while (cells.length % 7 !== 0) {
    trailing += 1;
    cells.push(cell(isoOf(new Date(year, month, trailing)), trailing, true));
  }

  return `<div style="background:var(--surface);border:1px solid var(--ink-a10);border-radius:20px;padding:14px 16px;display:flex;flex-direction:column;gap:10px;flex:none">
<div style="display:flex;justify-content:space-between;align-items:center;padding:0 4px">
<button data-act="cal-prev" aria-label="${esc(t('Voriger Monat'))}" style="width:28px;height:28px;border-radius:50%;background:var(--paper);border:0;display:flex;align-items:center;justify-content:center;color:var(--ink-soft);font-size:13px;cursor:pointer;appearance:none">‹</button>
<span style="font-size:14.5px;font-weight:650">${monthLongByIndex(month - 1)} ${year}</span>
<button data-act="cal-next" aria-label="${esc(t('Nächster Monat'))}" style="width:28px;height:28px;border-radius:50%;background:var(--paper);border:0;display:flex;align-items:center;justify-content:center;color:var(--ink-soft);font-size:13px;cursor:pointer;appearance:none">›</button>
</div>
<div style="display:grid;grid-template-columns:repeat(7,1fr);gap:2px;font-size:10px;font-weight:650;color:var(--muted-light);text-align:center">${wochenInitialen().map((b) => `<span>${b}</span>`).join("")}</div>
<div style="display:grid;grid-template-columns:repeat(7,1fr);gap:1px;font-size:12px;font-weight:600;text-align:center;font-variant-numeric:tabular-nums;align-items:center">${cells.join('')}</div>
</div>`;
}

// --- Loop-Sheet (reference 05.9: nur so hoch wie der Inhalt, Blöcke stoßen aneinander) ---

function initLoopSheet(meet) {
  const loop = meet.loop?.active ? meet.loop : null;
  const timeSource = loop ? loop.time : meet.time;
  const [hour, minute] = (timeSource || '19:00').split(':').map(Number);
  return {
    exists: Boolean(loop),
    timeMode: loop && loop.time === null ? 'open' : 'fix',
    hour: Number.isFinite(hour) ? hour : 19,
    minute: Number.isFinite(minute) ? (Math.round(minute / 5) * 5) % 60 : 0,
    // v5 A29a: ein alter 'custom'-Loop faellt auf die Woche zurueck.
    repeat: ['weekly', 'monthly', 'yearly'].includes(loop?.repeat) ? loop.repeat : 'weekly',
    interval: loop?.interval || 1,
  };
}

const ORDINALS = [null, null,
  (tag) => t('Jeden zweiten {tag}', { tag }),
  (tag) => t('Jeden dritten {tag}', { tag }),
  (tag) => t('Jeden vierten {tag}', { tag }),
  (tag) => t('Jeden fünften {tag}', { tag }),
  (tag) => t('Jeden sechsten {tag}', { tag }),
];
// v5 A29a: Nur Woche, Monat, Jahr. Der frühere „Eigen"-Modus mit eigenen Einheiten
// (Tage/Wochen/Monate) ist entfallen — auch hier im Meet-Detail.
function loopUnitWord(state, werte) {
  const n = state.interval;
  if (state.repeat === 'monthly') return tn(n, '{an}alle{aus}{rad}{an}Monat{aus}', '{an}alle{aus}{rad}{an}Monate{aus}', werte);
  if (state.repeat === 'yearly') return tn(n, '{an}alle{aus}{rad}{an}Jahr{aus}', '{an}alle{aus}{rad}{an}Jahre{aus}', werte);
  return tn(n, '{an}alle{aus}{rad}{an}Woche{aus}', '{an}alle{aus}{rad}{an}Wochen{aus}', werte);
}

function loopSummary(state, meet) {
  const date = fromISODate(meet.date);
  const time = state.timeMode === 'open' ? t('Zeit offen') : `${pad2(state.hour)}:${pad2(state.minute)}`;
  const n = state.interval;
  let base;
  if (state.repeat === 'weekly') {
    base = n === 1
      ? t('Jeden {tag}', { tag: weekdayLong(meet.date) })
      : (ORDINALS[n] ? ORDINALS[n](weekdayLong(meet.date)) : t('Jeden {n}. {tag}', { n, tag: weekdayLong(meet.date) }));
  } else if (state.repeat === 'monthly') {
    base = tn(n, 'Jeden Monat am {tag}.', 'Alle {n} Monate am {tag}.', { tag: date.getDate() });
  } else {
    base = tn(n, 'Jedes Jahr am {tag}.{monat}.', 'Alle {n} Jahre am {tag}.{monat}.', { tag: date.getDate(), monat: date.getMonth() + 1 });
  }
  return `${base} · ${time}`;
}

function loopSheet(ctx, meet) {
  const state = ctx.ui.loopSheet;
  const label = (text) => `<span style="font-size:11px;font-weight:650;letter-spacing:.09em;text-transform:uppercase;color:var(--muted-light)">${text}</span>`;

  // Auswahlfläche umfasst den vollständigen Satz „alle 2 Wochen" (reference 05.9).
  const unitWord = loopUnitWord(state, {
    an: '<span style="font-size:15px;font-weight:650;position:relative;padding-bottom:2px">',
    aus: '</span>',
    rad: `\n${wheel({ name: 'interval', label: t('Abstand'), value: state.interval, step: 1, mode: 'range', min: 1, max: 6, format: 'plain', visible: 3, width: 34, centerSize: 18 })}\n`,
  });
  const intervalWheel = `<div style="position:relative;display:flex;gap:14px;align-items:center;justify-content:center;padding:8px 0 4px">
<div style="position:absolute;left:0;right:0;top:calc(50% - 2px);transform:translateY(-50%);height:44px;border-radius:12px;background:var(--paper)"></div>
${unitWord}
</div>`;

  const trashButton = state.exists
    ? `<button data-act="loop-stop-ask" aria-label="${esc(t('Loop stoppen'))}" style="width:32px;height:32px;border-radius:50%;background:var(--red-tint);border:0;display:flex;align-items:center;justify-content:center;cursor:pointer;appearance:none;padding:0;flex:none"><span style="pointer-events:none;display:flex">${trash('var(--red)', 14)}</span></button>`
    : '';

  return `<div style="position:absolute;inset:0;z-index:16">
<div data-act="close-loop" style="position:absolute;inset:0;background:var(--scrim);-webkit-backdrop-filter:var(--scrim-filter);backdrop-filter:var(--scrim-filter)"></div>
<div style="position:absolute;left:0;right:0;bottom:0;background:var(--surface);border-radius:28px 28px 0 0;display:flex;flex-direction:column;box-shadow:0 -8px 24px var(--shadow-18)">
<span style="width:36px;height:4px;border-radius:2px;background:var(--handle);align-self:center;flex:none;margin:11px 0 0"></span>
<div style="padding:10px 20px 12px;display:flex;flex-direction:column;gap:9px">
<div style="display:flex;align-items:center;justify-content:space-between">
<span style="font-family:${TITLE_FONT};font-size:19px;font-weight:650">${state.exists ? t('Loop bearbeiten') : t('Loop erstellen')}</span>
${trashButton}
</div>
<div style="background:var(--blue-tint);border-radius:14px;padding:12px 14px"><span style="font-size:16px;font-weight:650;letter-spacing:-.01em;color:var(--blue-dark);font-variant-numeric:tabular-nums;display:block;overflow:hidden;text-overflow:ellipsis;white-space:nowrap">${esc(loopSummary(state, meet))}</span></div>
</div>
<div style="border-top:1px solid var(--ink-a07);padding:11px 20px 8px;display:flex;flex-direction:column;gap:9px">
${label(t('Zeit'))}
${segment([
    { value: 'fix', label: t('Fixe Uhrzeit'), active: state.timeMode === 'fix' },
    { value: 'open', label: t('Zeit offen'), active: state.timeMode === 'open' },
  ], 'loop-timemode', 'mode')}
${state.timeMode === 'fix' ? timeWheel(state.hour, state.minute, { visible: 3 }) : ''}
</div>
<div style="border-top:1px solid var(--ink-a07);padding:11px 20px 8px;display:flex;flex-direction:column;gap:9px">
${label(t('Wiederholung'))}
${segment([
    { value: 'weekly', label: t('Woche'), active: state.repeat === 'weekly' },
    { value: 'monthly', label: t('Monat'), active: state.repeat === 'monthly' },
    { value: 'yearly', label: t('Jahr'), active: state.repeat === 'yearly' },
  ], 'loop-repeat', 'repeat', 9)}
${intervalWheel}
</div>
<div style="border-top:1px solid var(--ink-a07);display:flex;gap:8px;padding:12px 20px 26px">
<button data-act="close-loop" style="flex:1;border:1.5px solid var(--ink-a14);color:var(--ink-soft);font:650 14px/1 ${FONT};padding:13px 0;border-radius:999px;background:transparent;cursor:pointer;appearance:none">${t('Abbrechen')}</button>
<button data-act="save-loop" style="flex:1.4;background:var(--green);color:var(--on-accent);font:650 14px/1 ${FONT};padding:14px 0;border-radius:999px;border:0;cursor:pointer;appearance:none">${state.exists ? t('Speichern') : t('Loop aktivieren')}</button>
</div>
</div></div>`;
}

// --- Bestätigungs-Sheet ---

const CONFIRMS = {
  'cancel-meet': { title: t('Meet absagen?'), text: t('Alle Beteiligten sehen die Absage.'), label: t('Meet absagen') },
  'stop-loop': { title: t('Loop stoppen?'), text: t('Die Wiederholung endet, das Meet bleibt.'), label: t('Loop stoppen') },
  'delete-draft': { title: t('Entwurf löschen?'), text: t('Der Entwurf verschwindet endgültig.'), label: t('Löschen') },
};

function confirmSheet(kind) {
  const config = CONFIRMS[kind];
  if (!config) return '';
  return `<div style="position:absolute;inset:0;z-index:18;display:flex;align-items:flex-end">
<div data-act="close-confirm" style="position:absolute;inset:0;background:var(--scrim);-webkit-backdrop-filter:var(--scrim-filter);backdrop-filter:var(--scrim-filter)"></div>
<div style="position:relative;width:100%;padding:14px 20px 30px;border-radius:26px 26px 0 0;background:var(--surface);box-shadow:0 -10px 30px var(--shadow-15);display:flex;flex-direction:column;gap:11px">
<div style="width:38px;height:4px;margin:0 auto;border-radius:999px;background:var(--handle)"></div>
<span style="font-family:${TITLE_FONT};font-size:19px;font-weight:650">${config.title}</span>
<span style="font-size:12.5px;color:var(--muted)">${config.text}</span>
<div style="display:flex;gap:8px;margin-top:3px">
<button data-act="close-confirm" style="flex:1;border:1.5px solid var(--ink-a14);color:var(--ink-soft);font:650 14px/1 ${FONT};padding:13px 0;border-radius:999px;background:transparent;cursor:pointer;appearance:none">${t('Abbrechen')}</button>
<button data-act="confirm-yes" style="flex:1.4;background:var(--red);color:var(--on-accent);font:650 14px/1 ${FONT};padding:14px 0;border-radius:999px;border:0;cursor:pointer;appearance:none">${config.label}</button>
</div></div></div>`;
}

function missingScreen() {
  return {
    html: screenScaffold({
      header: headerRow(false, { noMenu: true }),
      body: `<div style="display:flex;align-items:center;justify-content:center;padding:120px 40px"><span style="font-size:13.5px;color:var(--muted);text-align:center">${t('Dieses Meet gibt es nicht mehr.')}</span></div>`,
      scrollKey: 'meet-missing',
    }),
    bind: () => {},
  };
}

// --- Teilnehmende bearbeiten (v6 A13c) ------------------------------------------------
//
// Bisher stand die Teilnehmerliste eines Meets nach dem Veröffentlichen für immer fest —
// es gab weder eine Aktion noch einen Weg, jemanden nachträglich einzuladen. Der Weg
// existiert nur für Meets OHNE Crew: bei einem Crew-Meet ergibt sich die Runde aus der
// Gruppe, dort wäre eine zweite Teilnehmerquelle widersprüchlich.

function darfTeilnehmerBearbeiten(meet) {
  return !meet.crewId && meet.status !== 'draft' && meet.status !== 'done';
}

function participantsRow(ctx, meet) {
  if (!darfTeilnehmerBearbeiten(meet)) return '';
  const anzahl = (meet.personIds || []).filter((id) => id !== ME).length;
  return `<button data-act="edit-participants" style="background:var(--surface);border:1px solid var(--ink-a10);border-radius:18px;padding:12px 14px;display:flex;align-items:center;gap:9px;width:100%;box-sizing:border-box;cursor:pointer;appearance:none;font-family:${FONT};color:var(--ink);text-align:left;flex:none">
<span style="pointer-events:none;display:flex">${peopleIcon('var(--ink)', 16)}</span>
<span style="font-size:13px;font-weight:650;flex:1;min-width:0;pointer-events:none">${t('Teilnehmende bearbeiten')}</span>
<span style="font-size:12.5px;color:var(--muted);font-variant-numeric:tabular-nums;pointer-events:none">${anzahl}</span>
<span style="color:var(--line-strong);pointer-events:none">›</span>
</button>`;
}

// Auswahl-Sheet im BESTEHENDEN Host (overlays desselben screenScaffold). Es darf beim
// Antippen einer Person weder schließen noch neu entstehen — der Zustand liegt deshalb
// in ctx.ui.partSheet und wird in place abgeglichen (A22).
function participantsSheet(ctx, meet) {
  const state = ctx.ui.partSheet;
  if (!state) return '';
  const people = ctx.repo.getPeople();
  const einstellungen = ctx.repo.getSettings();
  const fest = meet.creatorId && meet.creatorId !== ME ? meet.creatorId : null;

  const row = (person, first) => {
    const aktiv = state.ids.includes(person.id);
    const gesperrt = person.id === fest;
    // v7 spec/08 §1: dieselbe Avatar-Unit wie überall — hier stand vorher eine lokal
    // nachgebaute Farbscheibe, die das echte Profilbild nie zeigen konnte.
    const avatar = `<span style="display:flex;flex:none;pointer-events:none">${personAvatar(person, { size: 34, fontSize: 12.5, marker: personMarker(person.id, einstellungen) })}</span>`;
    const name = `<div style="flex:1;min-width:0;text-align:left;pointer-events:none"><div style="font-size:14px;font-weight:650;white-space:nowrap;overflow:hidden;text-overflow:ellipsis">${esc(person.name)}</div>${gesperrt ? `<div style="font-size:11.5px;color:var(--muted)">${t('lädt ein')}</div>` : ''}</div>`;
    const control = aktiv
      ? `<span style="width:24px;height:24px;border-radius:50%;background:var(--green);display:flex;align-items:center;justify-content:center;flex:none;pointer-events:none"><svg width="11" height="11" viewBox="0 0 24 24" fill="none">${reviewCheckPath('var(--on-accent)', 2.8)}</svg></span>`
      : '<span style="width:24px;height:24px;border-radius:50%;border:1.5px solid var(--ink-a16);box-sizing:border-box;flex:none;pointer-events:none"></span>';
    const rahmen = `display:flex;align-items:center;gap:11px;padding:10px 0;width:100%;background:transparent;font-family:${FONT};color:var(--ink);${first ? 'border:0' : 'border:0;border-top:1px solid var(--ink-a05)'}`;
    if (gesperrt) return `<div style="${rahmen};opacity:.75">${avatar}${name}${control}</div>`;
    return `<button data-act="toggle-participant" data-person="${person.id}" aria-pressed="${aktiv}" style="${rahmen};cursor:pointer;appearance:none">${avatar}${name}${control}</button>`;
  };

  const rows = people.map((person, index) => row(person, index === 0)).join('');
  const neue = state.ids.filter((id) => !(meet.personIds || []).includes(id)).length;
  const hinweis = neue
    ? tn(neue, '{n} neu — sie bekommt eine Einladung und denselben Meet-Chat.', '{n} neu — sie bekommen eine Einladung und denselben Meet-Chat.')
    : t('Alle sehen denselben Meet-Chat.');

  return sheet(`<span style="font-family:${TITLE_FONT};font-size:19px;font-weight:650;display:block;margin-bottom:2px">${t('Teilnehmende')}</span>
<span style="font-size:12px;color:var(--muted);display:block;margin-bottom:12px">${esc(hinweis)}</span>
<div data-part-list style="background:var(--surface);border:1.5px solid var(--ink-a09);border-radius:20px;padding:2px 14px">${rows}</div>
<button data-act="save-participants" style="margin-top:14px;background:var(--green);color:var(--on-accent);font:650 14px/1 ${FONT};padding:14px 0;border-radius:999px;border:0;cursor:pointer;appearance:none;width:100%">${t('Fertig')}</button>`,
  { closeAct: 'close-part-sheet', scrollKey: 'participants' });
}

// --- meet.details (05.6 / 05.6c / 05.6d / 05.7 / 05.8) ---

function renderMeetDetails(ctx) {
  const meet = ctx.repo.getMeet(ctx.params.meetId);
  if (!meet) return missingScreen();
  // R3 E5: Ein vorbeies Meet öffnet die feste Übersicht mit „Bewerten" — nicht mehr direkt
  // die Bewertung. „Vorbei" folgt derselben Regel wie der Verlauf (meetVorbei).
  if (meetVorbei(meet)) return renderRueckblick(ctx, meet);
  const { ui } = ctx;

  const activityCard = variantsCard(ctx, meet, 'activity');
  const timeCard = variantsCard(ctx, meet, 'time');
  const hasVariants = Boolean(activityCard || timeCard);

  // R4 C4: Mitbringen | Umfragen bleiben als Kachelreihe stehen; der geöffnete Inhalt
  // erscheint darunter (meetPanelReihe). Vorher wurde die angetippte Kachel selbst zur Box
  // und „Umfragen" sprang unter „Mitbringen".
  const panels = meetPanelReihe(ctx, meet);

  // R4 E9 (Jonathan: „Das Foto sollte ganz oben sein … darunter die Bezeichnung und so weiter
  // und darunter erst die Karte"): Die Hauptkarte trägt oben das Foto, darunter Titel, Zeit und
  // Ort. Offene Vorschläge gehören zu diesen Feldern und folgen direkt. Dann kommt die ECHTE
  // Karte als eigene Karte — Foto und Karte berühren sich nie mehr. Danach die Runde und
  // Mitbringen/Umfragen. Gleiche Folge in jedem Zustand.
  const map = meetOrtKarte(ctx, meet, { kartenHoehe: hasVariants ? 132 : 150 });
  // Die Zeile „Teilnehmende bearbeiten" steht direkt unter der Teilnahme-Dreifachkontrolle:
  // dort steht die Runde, dort wird sie auch geändert.
  const teilnehmende = `${participationSection(ctx, meet)}${participantsRow(ctx, meet)}`;
  const sections = `${activityCard}${timeCard}${map}${teilnehmende}${panels}`;

  // EINE Scrollfläche: Hauptkarte und alle Abschnitte scrollen zusammen; die Bottom-Ebene
  // liegt darüber, der Inhalt läuft sichtbar darunter durch (v3.1 §1).
  const body = `<div style="padding-top:10px">
${meetMainCard(ctx, meet)}
<div style="display:flex;flex-direction:column;gap:9px;padding:12px 20px 0">${sections}</div>
</div>`;

  const html = screenScaffold({
    header: headerRow(Boolean(ui.menu)),
    body,
    bottom: detailBottom(),
    bottomInset: CTA_INSET,
    bottomFadeHeight: 118,
    // v7 A20c: Der kompakte Abstimmzustand liegt im SELBEN overlays-Host wie jedes
    // andere Sheet dieses Screens — er ersetzt weder die Seite noch löst er einen
    // Routenwechsel aus.
    overlays: `${ui.menu ? detailsMenu(ctx, meet) : ''}${ui.pencilSheet ? pencilSheet() : ''}${ui.loopSheet ? loopSheet(ctx, meet) : ''}${participantsSheet(ctx, meet)}${variantPickSheet(ctx, meet)}${ui.confirm ? confirmSheet(ui.confirm) : ''}${discardSheet(ctx)}`,
    scrollKey: 'meet-details',
  });

  // R1 §8: Das Meet ist offen — die Einladung dazu hat auf dem gesperrten Bildschirm
  // nichts mehr verloren.
  return { html, bind: (root) => { schliesseMitteilung(`meet-${meet.id}`); bindMeetDetails(root, ctx, meet); } };
}

function bindMeetDetails(root, ctx, meet) {
  const { repo, nav, ui } = ctx;
  const meetId = meet.id;

  bindeMeetOrtKarte(root, meet);

  // Ü4: Das Loop-Sheet stellt Zeit und Rhythmus wirklich ein — eine begonnene Änderung
  // darf beim Tap auf den Scrim oder auf „Abbrechen" nicht still verschwinden.
  const loopGuard = dirtyGuard(ctx, 'meet-loop');
  const closeLoop = () => { loopGuard.clear(); ui.loopSheet = null; ctx.render(); };

  bindActions(root, {
    ...discardActions(ctx),
    menu: () => { ui.menu = !ui.menu; ctx.render(); },
    'close-menu': () => { ui.menu = false; ctx.render(); },
    'main-pencil': () => { ui.pencilSheet = true; ctx.render(); },
    'close-sheet': () => { ui.pencilSheet = false; ctx.render(); },
    'go-propose-time': () => { ui.pencilSheet = false; nav.go('meet.proposeTime', { meetId }); },
    'go-propose-activity': () => { ui.pencilSheet = false; nav.go('meet.proposeActivity', { meetId }); },
    propose: (data) => nav.go(data.kind === 'time' ? 'meet.proposeTime' : 'meet.proposeActivity', { meetId }),
    'edit-variant': (data) => nav.go(data.kind === 'time' ? 'meet.proposeTime' : 'meet.proposeActivity', { meetId, variantId: data.variant }),
    'vote-variant': (data) => repo.voteVariant(meetId, data.variant),
    'vote-original': (data) => {
      const mine = (meet.variants || []).find((variant) => variant.kind === data.kind && variant.votes.includes(ME));
      if (mine) repo.voteVariant(meetId, mine.id);
    },
    decide: (data) => {
      if (typeof repo.decideMeet !== 'function') return;
      const result = repo.decideMeet(meetId, { kind: data.kind });
      if (result?.ok === false) ctx.toast?.(result.reason || t('Gerade nicht möglich'));
      else ctx.toast?.(data.kind === 'time' ? t('Zeit festgelegt') : t('Aktivität festgelegt'));
    },
    'menu-leave': () => { ui.menu = false; repo.setParticipation(meetId, 'no'); },
    'menu-template': () => alsVorlageNutzen(ctx, meet),
    'menu-loop': () => {
      ui.menu = false;
      ui.loopSheet = initLoopSheet(meet);
      loopGuard.reset(ui.loopSheet);
      ctx.render();
    },
    'menu-cancel': () => { ui.menu = false; ui.confirm = 'cancel-meet'; ctx.render(); },
    'menu-delete': () => { ui.menu = false; ui.confirm = 'delete-draft'; ctx.render(); },
    'close-loop': () => {
      if (!loopGuard.confirm(ui.loopSheet, closeLoop)) return;
      closeLoop();
    },
    'loop-timemode': (data) => { ui.loopSheet.timeMode = data.mode; ctx.render(); },
    'loop-repeat': (data) => { ui.loopSheet.repeat = data.repeat; ctx.render(); },
    'loop-stop-ask': () => { ui.confirm = 'stop-loop'; ctx.render(); },
    'save-loop': () => {
      const state = ui.loopSheet;
      const existed = state.exists;
      loopGuard.clear();
      ui.loopSheet = null;
      repo.saveLoop(meetId, {
        repeat: state.repeat,
        interval: state.interval,
        weekday: fromISODate(meet.date).getDay(),
        time: state.timeMode === 'open' ? null : `${pad2(state.hour)}:${pad2(state.minute)}`,
      });
      ctx.toast?.(existed ? t('Loop geändert') : t('Loop aktiviert'));
    },
    'close-confirm': () => { ui.confirm = null; ctx.render(); },
    'confirm-yes': () => {
      const kind = ui.confirm;
      ui.confirm = null;
      if (kind === 'cancel-meet') { repo.cancelMeet(meetId); ctx.toast?.(t('Meet abgesagt')); }
      else if (kind === 'stop-loop') { loopGuard.clear(); ui.loopSheet = null; repo.stopLoop(meetId); ctx.toast?.(t('Loop gestoppt')); }
      else if (kind === 'delete-draft') {
        const result = repo.deleteDraftMeet(meetId);
        if (result?.ok) nav.back(); else ctx.render();
      } else ctx.render();
    },
    // v6 A13c: Teilnehmende nachträglich ändern. Das Sheet lebt in der overlays-Ebene
    // desselben Screens; jedes Antippen ändert nur ui.partSheet.ids und wird in place
    // abgeglichen — Sheet, Seite und Hintergrund bleiben stehen (A22).
    'edit-participants': () => {
      ui.partSheet = { ids: [...(meet.personIds || []).filter((id) => id !== ME)] };
      ctx.render();
    },
    'toggle-participant': (data) => {
      if (!ui.partSheet) return;
      const set = new Set(ui.partSheet.ids);
      if (set.has(data.person)) set.delete(data.person); else set.add(data.person);
      ui.partSheet.ids = [...set];
      ctx.render();
    },
    'close-part-sheet': () => { ui.partSheet = null; ctx.render(); },
    'save-participants': () => {
      const gewaehlt = ui.partSheet?.ids || [];
      const vorher = (meet.personIds || []).filter((id) => id !== ME);
      const neu = gewaehlt.filter((id) => !vorher.includes(id)).length;
      const result = repo.updateMeetParticipants(meetId, gewaehlt);
      if (result?.ok === false) { ctx.toast?.(result.reason || t('Gerade nicht möglich')); return; }
      ui.partSheet = null;
      if (neu) ctx.toast?.(tn(neu, '{n} Person eingeladen', '{n} Personen eingeladen'));
      else ctx.toast?.(t('Teilnehmende aktualisiert'));
      ctx.render();
    },
    ...meetOrtAktionen(ctx, meet),
    // v3.1 §8: „Chat öffnen" ERSETZT die Detailroute durch den Raum — Zurück führt in den
    // Raum, es entsteht kein Detail-Stack.
    'open-chat': () => {
      const roomId = chatRoomId(meet);
      if (roomId) nav.replace('room.view', { roomId });
      else ctx.toast?.(t('Für dieses Meet gibt es keinen Raum'));
    },
  });

  bindMeetPanels(root, ctx, meet);

  // Loop-Räder: ziehen folgt dem Pointer, der Wert rastet beim Loslassen ein.
  bindWheels(root, (name, value) => {
    if (!ui.loopSheet) return;
    if (name === 'hour') ui.loopSheet.hour = value;
    else if (name === 'minute') ui.loopSheet.minute = value;
    else if (name === 'interval') ui.loopSheet.interval = value;
    ctx.render();
  });
}

// --- meet.proposeTime (Familie 05.6c/08.6: Datum UND Uhrzeit inkl. „Zeit offen") ---

function renderProposeTime(ctx) {
  const meet = ctx.repo.getMeet(ctx.params.meetId);
  if (!meet) return missingScreen();
  const { ui } = ctx;
  const editing = Boolean(ctx.params.variantId);

  if (!ui.pt) {
    const variant = editing ? (meet.variants || []).find((entry) => entry.id === ctx.params.variantId) : null;
    const baseDate = variant?.date || meet.date;
    const [hour, minute] = (variant?.time || meet.time || '19:00').split(':').map(Number);
    ui.pt = {
      date: baseDate,
      open: Boolean(variant?.open || (variant && !variant.time)),
      hour: Number.isFinite(hour) ? hour : 19,
      minute: Number.isFinite(minute) ? (Math.round(minute / 15) * 15) % 60 : 0,
      view: baseDate.slice(0, 7),
    };
  }
  const state = ui.pt;

  const header = `${closeHeader(t('Zeit vorschlagen'))}
<div style="padding:2px 20px 8px">
<span style="font-size:12.5px;color:var(--ink-soft);display:block;overflow:hidden;text-overflow:ellipsis;white-space:nowrap">${t('Für {titel} · Original bleibt wählbar', { titel: `<b style="color:var(--ink)">${esc(meet.title)}</b>` })}</span>
</div>`;

  // „Zeit offen" versteckt das GESAMTE Rad (Band inbegriffen), nicht nur Teile (v3.1 §7).
  const body = `<div style="display:flex;flex-direction:column;gap:10px;padding:10px 20px 0">
${calendarCard(state.view, state.date)}
<div style="background:var(--surface);border:1px solid var(--ink-a10);border-radius:20px;padding:13px 16px;display:flex;flex-direction:column;gap:9px">
${segment([
    { value: 'fix', label: t('Fixe Uhrzeit'), active: !state.open },
    { value: 'open', label: t('Zeit offen'), active: state.open },
  ], 'pt-timemode', 'mode')}
${state.open ? '' : timeWheel(state.hour, state.minute, { visible: 5, band: 'var(--green-tint)', bandBorder: 'var(--green-a35)' })}
</div>
</div>`;

  const html = screenScaffold({
    header,
    body,
    bottom: actionsBottom(t('Abbrechen'), 'submit-time', editing ? t('Speichern') : t('Vorschlagen')),
    bottomInset: 92,
    bottomFadeHeight: 118,
    scrollKey: 'propose-time',
  });

  return {
    html,
    bind: (root) => {
      const { repo, nav } = ctx;
      bindWheels(root, (name, value) => {
        if (name === 'hour') state.hour = value;
        else if (name === 'minute') state.minute = value;
        ctx.render();
      });
      bindActions(root, {
        'cal-prev': () => {
          const [year, month] = state.view.split('-').map(Number);
          const date = new Date(year, month - 2, 1);
          state.view = `${date.getFullYear()}-${pad2(date.getMonth() + 1)}`;
          ctx.render();
        },
        'cal-next': () => {
          const [year, month] = state.view.split('-').map(Number);
          const date = new Date(year, month, 1);
          state.view = `${date.getFullYear()}-${pad2(date.getMonth() + 1)}`;
          ctx.render();
        },
        // Datum aus einem Nachbarmonat: die Monatsansicht springt mit (v3.1 §7).
        'cal-day': (data) => { state.date = data.date; state.view = data.date.slice(0, 7); ctx.render(); },
        'pt-timemode': (data) => { state.open = data.mode === 'open'; ctx.render(); },
        'submit-time': () => {
          const time = state.open ? null : `${pad2(state.hour)}:${pad2(state.minute)}`;
          if (!editing && !state.open && state.date === meet.date && time === meet.time) {
            ctx.toast?.(t('Das ist bereits der Originaltermin'));
            return;
          }
          const payload = { date: state.date, time, open: state.open || undefined };
          const result = editing
            ? repo.editVariant(meet.id, ctx.params.variantId, payload)
            : repo.addVariant(meet.id, { kind: 'time', ...payload });
          if (result?.ok) nav.back();
          else ctx.toast?.(result?.reason || t('Gerade nicht möglich'));
        },
      });
    },
  };
}

// --- meet.proposeActivity (05.6e: eigener Fullscreen mit ALLEN Entdecken-Fähigkeiten) ---

const PA_UI_KEY = 'propose-activity';

function renderProposeActivity(ctx) {
  const meet = ctx.repo.getMeet(ctx.params.meetId);
  const { ui } = ctx;
  const editing = Boolean(ctx.params.variantId);

  if (!ui.paInit) {
    ui.paInit = true;
    if (editing && meet) {
      const variant = (meet.variants || []).find((entry) => entry.id === ctx.params.variantId);
      if (variant) {
        // Eigenen Vorschlag bearbeiten: Eigene-Idee-Fläche vorbelegen.
        ui[PA_UI_KEY] = {
          tab: 'own',
          ownTitle: variant.title || '',
          ownCategory: variant.category || meet.category || 'chillen',
          picked: { title: variant.title, icon: variant.icon, category: variant.category, place: variant.place || null, source: 'own' },
        };
      }
    }
  }

  // v5 A14: EXAKT dieselben Optionen wie „Was machen?" — kein searchTop, keine zweite
  // CTA-Leiste. Dadurch stehen Suche, Tabs und erste Karte an derselben Stelle.
  //
  // v5 A14: Und es gibt nur noch EINEN Auswahlzustand. Vorher markierte ein Tipp auf die
  // Karte `ui.picked`, während der Senden-Knopf `ui.paPick` las — die Karte sah gewählt
  // aus und das Senden meldete trotzdem „Erst eine Aktivität wählen".
  const opts = {
    uiKey: PA_UI_KEY,
    hideSubmit: true,
    hideSheets: true,
    submitLabel: editing ? t('Speichern') : t('Vorschlag senden'),
    // Runde 4 (D9): Umkreis und Entfernungen von der Mitte der Meet-Runde (geteilte Standorte).
    crewId: meet?.crewId || null,
    personIds: meet && !meet.crewId ? meetMemberIds(ctx.repo, meet).filter((id) => id !== ME) : [],
    onPick: (idea) => {
      const coreState = ui[PA_UI_KEY] || (ui[PA_UI_KEY] = {});
      coreState.picked = idea;
      if (coreState.tab === 'own') coreState.tab = 'discover';
      ctx.render();
    },
  };
  const gewaehlt = ui[PA_UI_KEY]?.picked || null;
  const titel = editing ? t('Vorschlag bearbeiten') : (meet ? t('Vorschlag für {titel}', { titel: meet.title }) : t('Vorschlag'));

  const html = chooserScaffold(ctx, opts, {
    title: titel,
    entries: gewaehlt ? [gewaehlt] : [],
    scrollKey: 'propose-activity',
  });

  return {
    html,
    bind: (root) => {
      // Die eigene Aktion wird VOR bindDiscoverCore registriert und gewinnt damit gegen
      // deren Standardverhalten für 'wm-apply' (erste passende Handler-Karte zählt).
      bindActions(root, {
        'wm-apply': () => {
          const picked = ui[PA_UI_KEY]?.picked;
          if (!picked || !(picked.title || '').trim()) {
            ctx.toast?.(t('Erst eine Aktivität wählen'));
            return;
          }
          const payload = {
            kind: 'activity',
            title: picked.title,
            icon: picked.icon || '✨',
            category: picked.category || meet?.category,
            place: picked.place || undefined,
          };
          let result = { ok: true };
          if (meet) {
            result = editing
              ? ctx.repo.editVariant(meet.id, ctx.params.variantId, { title: payload.title, icon: payload.icon, category: payload.category, place: payload.place })
              : ctx.repo.addVariant(meet.id, payload);
          }
          if (!result?.ok) { ctx.toast?.(result?.reason || t('Gerade nicht möglich')); return; }
          // v5 A14: Das Ergebnis erscheint im Chat UND am Meet. Vorher landete es nur am
          // Meet, sodass im Raum nichts davon zu sehen war.
          const roomId = ctx.params.roomId || (meet ? chatRoomId(meet) : null);
          if (roomId && !editing) {
            ctx.repo.sendMessage(roomId, meet
              ? t('Vorschlag für „{titel}": {idee}', { titel: meet.title, idee: picked.title })
              : t('Vorschlag: {idee}', { idee: picked.title }));
          }
          ctx.toast?.(editing ? t('Vorschlag gespeichert') : t('Vorschlag gesendet'));
          ctx.nav.back();
        },
      });
      bindDiscoverCore(root, ctx, opts);
      fitChooserInsets(root);
    },
  };
}

// --- meet.review (R3 E2/E3/E4 · R4 H1/H2/C4) ----------------------------------------------
//
// Jonathan (R3): „Die Dreifachauswahl ist Pflicht. … Die Themen muss man nicht auswählen, um
// fertig zu sein. Der Fertig-Knopf soll ein richtiger Button sein und wird grün, sobald man
// fertig sein kann. Kein extra Slide-up für ‚woran lag's', sondern die Seite geht weiter."
// Jonathan (R4): „… nicht so viele Dinge, die man bewerten kann … Dann könnte man alles auf
// eine Seite packen, ohne scrollen zu müssen. Das finde ich sogar am besten." Und: „Wenn man
// etwas auswählt, dann muss die Ansicht gleich bleiben und darf nicht herumspringen."
//
// Aufbau auf EINER Seite ohne Scrollen (gemessen auf 390×844 und 360×640):
//   Kopf   ‹  Wie war’s?  ···
//   1. Welches Meet (Zeichen, Titel, wann · wo) — rechts „Nur für dich".
//   2. Nicht gut · Mittel · Gut als drei große Kacheln, darunter „Hat nicht stattgefunden".
//   3. „Woran lag’s genau?" — Aktivität, Ort, Kosten, je dreifach, freiwillig. Bei „Hat nicht
//      stattgefunden" steht an GENAU dieser Stelle und in derselben Höhe die Nachfrage.
//   4. Notiz. Unten „Fertig" — grün, sobald eine Stufe gewählt ist.
// Nichts klappt mehr zu: In R3 schrumpfte die Skala nach der Wahl zu einer Zeile, und alles
// darunter rückte nach oben. Jetzt bleibt jede Fläche an ihrem Platz; die Wahl erkennt man an
// Fläche und Gesicht. Die Abstände wachsen auf großen Geräten mit (luft), auf kleinen gehen sie
// bis auf ihr Mindestmaß zurück. Themen dürfen auch VOR der Stufe angetippt werden — sie
// werden mit der Stufe gespeichert. Jede Wahl ist sofort gespeichert; „Fertig" schließt nur.

function durationLabel(start, end) {
  if (!start || !end) return '';
  const [h1, m1] = start.split(':').map(Number);
  const [h2, m2] = end.split(':').map(Number);
  let minutes = (h2 * 60 + m2) - (h1 * 60 + m1);
  if (minutes <= 0) minutes += 24 * 60;
  if (minutes < 60) return t('{n} Min', { n: minutes });
  const hours = Math.round((minutes / 60) * 10) / 10;
  return t('{n} Std', { n: zahl(hours) });
}

// Maße der Bewertung. Die Mindestmaße passen auf 360×640 ohne Scrollen (dort bleiben zwischen
// Kopfzeile und „Fertig" 422 px). Auf größeren Handys wachsen Kacheln und Themenzeilen bis zu
// ihren Höchstmaßen mit, statt eine leere halbe Seite zu lassen. Die Größen hängen NUR vom
// Bildschirm ab, nie von der Auswahl — beim Antippen bewegt sich deshalb nichts.
const KACHEL_MIN = 78;
const KACHEL_MAX = 112;
const NICHT_STATT_HOEHE = 44;
const THEMA_ZEILE_MIN = 50;
const THEMA_ZEILE_MAX = 62;
const ABSCHNITT_KOPF = 16;
const SKALA_MIN = KACHEL_MIN + 4 + NICHT_STATT_HOEHE;
const SKALA_MAX = KACHEL_MAX + 4 + NICHT_STATT_HOEHE;
const WEITER_MIN = ABSCHNITT_KOPF + 6 + THEMEN.length * THEMA_ZEILE_MIN + 4 + 2;
const WEITER_MAX = ABSCHNITT_KOPF + 6 + THEMEN.length * THEMA_ZEILE_MAX + 4 + 2;

// Ein Abstand, der wächst, wenn Platz ist, und bis auf `min` schrumpft, wenn keiner ist.
const luft = (min, max) => `<span aria-hidden="true" style="display:block;flex:1 1 0;min-height:${min}px;max-height:${max}px"></span>`;

// --- Zeichen der Bewertung ---

// Ein Gesicht je Stufe (froh · neutral · traurig). Ohne Kreis gezeichnet, wenn es auf einer
// gefüllten Fläche oder in einem umrandeten Knopf sitzt — die Fläche IST dann das Gesicht.
function gesichtSvg(art, farbe, groesse = 24, mitKreis = true) {
  const mund = art === 'froh'
    ? 'M8.4 14.2c.9 1.4 2.2 2.1 3.6 2.1s2.7-.7 3.6-2.1'
    : art === 'traurig'
      ? 'M8.4 16.5c.9-1.4 2.2-2.1 3.6-2.1s2.7.7 3.6 2.1'
      : 'M8.7 15.3h6.6';
  const kreis = mitKreis ? `<circle cx="12" cy="12" r="9.2" stroke="${farbe}" stroke-width="1.7"></circle>` : '';
  return `<svg width="${groesse}" height="${groesse}" viewBox="0 0 24 24" fill="none" style="flex:none;display:block">${kreis}<circle cx="9.2" cy="10" r="1.2" fill="${farbe}"></circle><circle cx="14.8" cy="10" r="1.2" fill="${farbe}"></circle><path d="${mund}" stroke="${farbe}" stroke-width="1.7" stroke-linecap="round"></path></svg>`;
}

function gesichtRund(stufe, groesse) {
  const ton = REVIEW_TONE[stufe.ton];
  return `<span style="width:${groesse}px;height:${groesse}px;border-radius:50%;background:${ton.fill};display:flex;align-items:center;justify-content:center;flex:none;pointer-events:none">${gesichtSvg(stufe.gesicht, ton.glyph, Math.round(groesse * 0.9), false)}</span>`;
}

const kalenderXIcon = (color = 'var(--ink-soft)', size = 18) => `<svg width="${size}" height="${size}" viewBox="0 0 24 24" fill="none" style="flex:none;display:block"><rect x="3.6" y="5" width="16.8" height="15.4" rx="3" stroke="${color}" stroke-width="1.7"></rect><path d="M3.6 9.6h16.8M8 3.2v3.6M16 3.2v3.6" stroke="${color}" stroke-width="1.7" stroke-linecap="round"></path><path d="m10 12.6 4 4M14 12.6l-4 4" stroke="${color}" stroke-width="1.7" stroke-linecap="round"></path></svg>`;

const schlossIcon = (color = 'var(--muted)', size = 12) => `<svg width="${size}" height="${size}" viewBox="0 0 24 24" fill="none" style="flex:none;display:block"><rect x="5" y="10.5" width="14" height="10" rx="2.6" stroke="${color}" stroke-width="2"></rect><path d="M8.2 10.5V8a3.8 3.8 0 0 1 7.6 0v2.5" stroke="${color}" stroke-width="2" stroke-linecap="round"></path></svg>`;

function nichtStattZeichen(groesse) {
  return `<span style="width:${groesse}px;height:${groesse}px;border-radius:50%;background:var(--surface);border:1px solid var(--ink-a14);box-sizing:border-box;display:flex;align-items:center;justify-content:center;flex:none;pointer-events:none">${kalenderXIcon('var(--ink-soft)', Math.round(groesse * 0.5))}</span>`;
}

// Haken für Auswahl-Controls (auch im Teilnehmenden-Sheet benutzt).
const reviewCheckPath = (stroke, width) => `<path d="m7.5 12.5 3 3 6-6.5" stroke="${stroke}" stroke-width="${width}" stroke-linecap="round" stroke-linejoin="round"></path>`;

// --- Speicherform --------------------------------------------------------------------------
//
// Gespeichert wird über das vorhandene repo.submitReview:
//   verdict  'nicht-gut' | 'mittel' | 'gut' | 'fand-nicht-statt'
//   topics   { aktivitaet:'gut', kosten:'nicht-gut', … }
//   aspects  ['aktivitaet:gut', 'kosten:nicht-gut', …]     ← Übergang, gleiche Aussage
//   reasons  Themen mit 'nicht-gut' — bzw. bei „fand nicht statt" der Grund
//   note     Freitext
// Gelesen wird `topics`, sonst `aspects`. Alte Bewertungen (v6: nicht-passend / gut /
// wieder-machen mit Gründen) werden sinngemäß übernommen.
//
// R4 H2: Themen, die es nicht mehr gibt (Leute, Anfahrt, Zeitpunkt, Organisation, Wetter),
// werden nicht gezeigt, aber auch nicht gelöscht: Sie stehen in `fremd` und gehen beim
// nächsten Speichern unverändert wieder mit.
const ALT_VERDIKT = { 'nicht-passend': 'nicht-gut', 'wieder-machen': 'gut' };
const ALT_THEMA = { zeit: 'zeitpunkt', gruppe: 'leute', preis: 'kosten', weg: 'anfahrt' };

function bewertungLesen(review) {
  const r = review || {};
  let verdict = ALT_VERDIKT[r.verdict] || r.verdict || null;
  if (r.verdict === 'nicht-passend' && (r.reasons || []).includes(NICHT_STATT)) verdict = NICHT_STATT;
  if (verdict !== NICHT_STATT && !STUFE[verdict]) verdict = null;
  const themen = {};
  const fremd = {};
  const merken = (id, wert) => {
    if (!id || !STUFEN_IDS.includes(wert)) return;
    if (THEMEN_IDS.includes(id)) themen[id] = wert;
    else fremd[id] = wert;
  };
  // Das Demo-Gateway legt `topics` immer an, auch leer — dann gelten weiter die aspects.
  const hatTopics = r.topics && typeof r.topics === 'object' && !Array.isArray(r.topics) && Object.keys(r.topics).length > 0;
  if (hatTopics) {
    for (const [id, wert] of Object.entries(r.topics)) merken(id, wert);
  } else {
    for (const eintrag of r.aspects || []) {
      const [roh, wert] = String(eintrag).split(':');
      const id = ALT_THEMA[roh] || roh;
      if (THEMEN_IDS.includes(id)) themen[id] = STUFEN_IDS.includes(wert) ? wert : 'gut';
      else merken(id, wert);
    }
    if (r.verdict === 'nicht-passend') {
      for (const roh of r.reasons || []) {
        const id = ALT_THEMA[roh] || roh;
        if (THEMEN_IDS.includes(id) && !themen[id]) themen[id] = 'nicht-gut';
      }
    }
  }
  const nichtStatt = verdict === NICHT_STATT;
  const grund = nichtStatt
    ? ((r.reasons || []).find((id) => NICHT_STATT_GRUENDE.some((g) => g.id === id)) || null)
    : null;
  return { verdict, themen: nichtStatt ? {} : themen, fremd: nichtStatt ? {} : fremd, grund, note: r.note || '' };
}

function bewertungSchreiben(stand) {
  const nichtStatt = stand.verdict === NICHT_STATT;
  const alle = nichtStatt ? {} : { ...(stand.fremd || {}), ...stand.themen };
  return {
    verdict: stand.verdict,
    topics: alle,
    reasons: nichtStatt
      ? (stand.grund ? [stand.grund] : [])
      : Object.keys(alle).filter((id) => alle[id] === 'nicht-gut'),
    aspects: Object.entries(alle).map(([id, wert]) => `${id}:${wert}`),
    note: stand.note || '',
  };
}

// --- Kopf des Rückblicks: Foto (falls es eines gibt) · Titel · wann · wo ---

function meetKopfKarte(ctx, meet) {
  const loopCount = meet.loopCount || null;
  const loopChip = loopCount
    ? `<span style="flex:none;font-size:10px;font-weight:650;letter-spacing:.05em;color:var(--blue-dark);background:var(--blue-tint);padding:4px 8px;border-radius:6px">${loopCount === 1 ? tk('Loop · {n}. Mal', 'erstes', { n: loopCount }) : t('Loop · {n}. Mal', { n: loopCount })}</span>`
    : '';
  const dauer = durationLabel(meet.time, meet.endTime);
  const uhrzeit = meet.time && meet.endTime ? `${meet.time} – ${meet.endTime}` : (meet.time || '');
  const wann = [meetDateLabel(meet.date), uhrzeit, dauer].filter(Boolean).join(' · ');
  // Auch im Rückblick gilt spec/04 §7: ohne Zustimmung kein Ortsname.
  // Offener Ort ist leer gespeichert (Sprachen) — hier steht er in der Sprache der Lesenden.
  const ort = meet.placePending ? t('Ort blieb offen') : (meet.place?.name || t('Ort offen'));
  const zeile = (icon, text) => `<span style="display:flex;align-items:center;gap:6px;font-size:12.5px;color:var(--ink-soft);min-width:0"><span style="display:flex;flex:none">${icon}</span><span style="white-space:nowrap;overflow:hidden;text-overflow:ellipsis;font-variant-numeric:tabular-nums">${esc(text)}</span></span>`;
  const text = `<div style="display:flex;flex-direction:column;gap:4px;flex:1;min-width:0">
<span style="font-family:${TITLE_FONT};font-size:20px;font-weight:650;letter-spacing:-.01em;white-space:nowrap;overflow:hidden;text-overflow:ellipsis">${esc(meet.title)}</span>
${wann ? zeile(clockIcon('var(--muted)', 13), wann) : ''}
${zeile(pinIcon('var(--muted)', 13), ort)}
${loopChip ? `<span style="display:flex;margin-top:2px">${loopChip}</span>` : ''}
</div>`;
  // R4 E9: Das Foto steht OBEN in derselben Karte und trägt das Zeichen der Aktivität.
  const foto = meetFoto(ctx.repo, meet);
  if (foto) {
    return `<div data-role="meet-kopf" data-foto="1" style="margin:6px 16px 0;background:var(--surface);border:1px solid var(--ink-a10);border-radius:20px;overflow:hidden;display:flex;flex-direction:column;flex:none">
${meetFotoKopf(ctx, meet, foto)}
<div style="padding:12px 16px 14px;display:flex">${text}</div>
</div>`;
  }
  return `<div data-role="meet-kopf" style="margin:6px 16px 0;background:var(--surface);border:1px solid var(--ink-a10);border-radius:20px;padding:14px 16px;display:flex;align-items:center;gap:13px;flex:none">
<span style="width:46px;height:46px;border-radius:14px;background:var(--paper);display:flex;align-items:center;justify-content:center;flex:none">${activityIconSvg(meet, 'var(--ink)', 21)}</span>
${text}
</div>`;
}

// --- Bewertung: welches Meet (eine ruhige Zeile statt einer ganzen Karte) ---

function reviewMeetZeile(meet) {
  const wann = [meetDateLabel(meet.date), meet.time || ''].filter(Boolean).join(' · ');
  const ort = meet.placePending ? t('Ort blieb offen') : (meet.place?.name || '');
  return `<div data-role="meet-kopf" style="display:flex;align-items:center;gap:11px;height:42px;flex:none">
<span style="width:40px;height:40px;border-radius:12px;background:var(--surface);border:1px solid var(--ink-a10);box-sizing:border-box;display:flex;align-items:center;justify-content:center;flex:none">${activityIconSvg(meet, 'var(--ink)', 19)}</span>
<span style="display:flex;flex-direction:column;gap:1px;flex:1;min-width:0">
<span style="font-size:15px;font-weight:650;line-height:19px;white-space:nowrap;overflow:hidden;text-overflow:ellipsis">${esc(meet.title)}</span>
<span style="font-size:12px;line-height:16px;color:var(--ink-soft);white-space:nowrap;overflow:hidden;text-overflow:ellipsis;font-variant-numeric:tabular-nums">${esc([wann, ort].filter(Boolean).join(' · '))}</span>
</span>
<span data-role="review-privat" title="${esc(t('Nur für dich — niemand sonst sieht deine Antwort.'))}" style="flex:none;display:flex;align-items:center;gap:5px;font-size:11.5px;font-weight:600;color:var(--muted)">${schlossIcon('var(--muted)', 12)}<span>${t('Nur für dich')}</span></span>
</div>`;
}

// --- Die Pflichtwahl: bleibt immer stehen ---

function stufenWahl(stand) {
  const kacheln = STUFEN.map((stufe) => {
    const aktiv = stand.verdict === stufe.id;
    const ton = REVIEW_TONE[stufe.ton];
    const look = aktiv
      ? `background:${ton.tint};border:1.5px solid ${ton.line}`
      : 'background:var(--surface);border:1.5px solid var(--ink-a10)';
    const gesicht = aktiv ? gesichtRund(stufe, 38) : `<span style="display:flex;pointer-events:none">${gesichtSvg(stufe.gesicht, 'var(--ink-soft)', 38)}</span>`;
    return `<button data-act="review-stufe" data-stufe="${stufe.id}" aria-pressed="${aktiv}" style="flex:1;min-width:0;align-self:stretch;display:flex;flex-direction:column;align-items:center;justify-content:center;gap:6px;padding:0 4px;${look};border-radius:18px;box-sizing:border-box;cursor:pointer;appearance:none;font-family:${FONT};box-shadow:0 1px 2px var(--shadow-05);transition:background-color .15s ease,border-color .15s ease">
${gesicht}
<span style="pointer-events:none;font-size:14px;line-height:17px;font-weight:650;color:${aktiv ? ton.ink : 'var(--ink)'};white-space:nowrap;overflow:hidden;text-overflow:ellipsis;max-width:100%">${stufe.label}</span>
</button>`;
  }).join('');
  const nichtStatt = stand.verdict === NICHT_STATT;
  return `<div data-role="review-skala" style="display:flex;flex-direction:column;gap:4px;flex:2 1 0;min-height:${SKALA_MIN}px;max-height:${SKALA_MAX}px">
<div style="display:flex;gap:8px;flex:1 1 0;min-height:${KACHEL_MIN}px">${kacheln}</div>
<button data-act="review-stufe" data-stufe="${NICHT_STATT}" aria-pressed="${nichtStatt}" style="height:${NICHT_STATT_HOEHE}px;flex:none;display:flex;align-items:center;justify-content:center;gap:8px;padding:0;border-radius:14px;box-sizing:border-box;border:1.5px solid ${nichtStatt ? 'var(--ink-a22)' : 'transparent'};background:${nichtStatt ? 'var(--field)' : 'transparent'};cursor:pointer;appearance:none;font:650 13px/1 ${FONT};color:${nichtStatt ? 'var(--ink)' : 'var(--ink-soft)'}"><span style="pointer-events:none;display:flex">${kalenderXIcon(nichtStatt ? 'var(--ink)' : 'var(--ink-soft)', 16)}</span><span style="pointer-events:none">${t('Hat nicht stattgefunden')}</span></button>
</div>`;
}

function abschnittsKopf(titel, zusatz) {
  return `<div style="display:flex;align-items:center;gap:8px;height:${ABSCHNITT_KOPF}px;flex:none"><span style="font-size:11px;line-height:${ABSCHNITT_KOPF}px;font-weight:650;letter-spacing:.09em;text-transform:uppercase;color:var(--muted-light);flex:1;min-width:0;white-space:nowrap;overflow:hidden;text-overflow:ellipsis">${titel}</span><span style="font-size:11.5px;line-height:${ABSCHNITT_KOPF}px;color:var(--muted-light);flex:none">${zusatz}</span></div>`;
}

// Die Themen: jede Zeile trägt Name und Erklärung, rechts dreimal Nicht gut · Mittel · Gut
// (44-px-Knöpfe). Gewählt ist der gefüllte Kreis; die beiden anderen treten dann zurück.
function themenBlock(themen) {
  const zeilen = THEMEN.map((thema, index) => {
    const wert = themen[thema.id] || null;
    const gewaehlt = wert ? STUFE[wert] : null;
    const knoepfe = STUFEN.map((stufe) => {
      const aktiv = wert === stufe.id;
      const ton = REVIEW_TONE[stufe.ton];
      const look = aktiv ? `background:${ton.fill};border:1.5px solid transparent` : 'background:var(--surface);border:1.5px solid var(--ink-a16)';
      const zurueck = wert && !aktiv ? 'opacity:.45;' : '';
      return `<button data-act="review-thema" data-thema="${thema.id}" data-wert="${stufe.id}" aria-pressed="${aktiv}" aria-label="${esc(`${thema.label}: ${stufe.label}`)}" style="width:44px;height:44px;border-radius:50%;${look};${zurueck}box-sizing:border-box;display:flex;align-items:center;justify-content:center;flex:none;cursor:pointer;appearance:none;padding:0;transition:opacity .15s ease,background-color .15s ease"><span style="pointer-events:none;display:flex">${gesichtSvg(stufe.gesicht, aktiv ? ton.glyph : 'var(--ink-soft)', 38, false)}</span></button>`;
    }).join('');
    return `<div data-thema-zeile="${thema.id}" data-wert="${wert || ''}" style="flex:1 1 0;min-height:${THEMA_ZEILE_MIN}px;box-sizing:border-box;display:flex;align-items:center;gap:10px;${index ? 'border-top:1px solid var(--ink-a06)' : ''}">
<span style="display:flex;flex-direction:column;gap:1px;flex:1;min-width:0"><span style="font-size:14.5px;line-height:18px;font-weight:650;color:${gewaehlt ? REVIEW_TONE[gewaehlt.ton].ink : 'var(--ink)'};white-space:nowrap;overflow:hidden;text-overflow:ellipsis">${thema.label}</span><span style="font-size:11.5px;line-height:15px;color:var(--muted);white-space:nowrap;overflow:hidden;text-overflow:ellipsis">${thema.hilfe}</span></span>
<div role="group" aria-label="${esc(thema.label)}" style="display:flex;gap:6px;flex:none">${knoepfe}</div>
</div>`;
  }).join('');
  return `<div data-role="review-themen-block" style="display:flex;flex-direction:column;gap:6px;flex:1 1 0;min-height:0">
${abschnittsKopf(t('Woran lag’s genau?'), t('freiwillig'))}
<div data-role="review-themen" style="background:var(--surface);border:1px solid var(--ink-a10);border-radius:18px;padding:2px 14px;flex:1 1 0;display:flex;flex-direction:column">${zeilen}</div>
</div>`;
}

// „Hat nicht stattgefunden": keine Themen (es gab nichts zu bewerten), nur freiwillig, warum.
function nichtStattBlock(stand) {
  const chips = NICHT_STATT_GRUENDE.map((grund) => {
    const aktiv = stand.grund === grund.id;
    const look = aktiv
      ? 'background:var(--field);border:1.5px solid var(--ink-a35);color:var(--ink)'
      : 'background:var(--surface);border:1.5px solid var(--ink-a12);color:var(--ink-soft)';
    const haken = aktiv ? `<svg width="13" height="13" viewBox="0 0 24 24" fill="none" style="pointer-events:none;flex:none">${reviewCheckPath('var(--ink)', 2.8)}</svg>` : '';
    return `<button data-act="review-grund" data-grund="${grund.id}" aria-pressed="${aktiv}" style="display:flex;align-items:center;gap:6px;${look};border-radius:999px;height:44px;box-sizing:border-box;padding:0 15px;font:650 13px/1 ${FONT};cursor:pointer;appearance:none">${haken}<span style="pointer-events:none">${grund.label}</span></button>`;
  }).join('');
  return `<div data-role="review-nicht-statt" style="display:flex;flex-direction:column;gap:8px;flex:none">
${abschnittsKopf(t('Was war los?'), t('freiwillig'))}
<div style="display:flex;flex-wrap:wrap;gap:8px">${chips}</div>
</div>`;
}

function notizFeld(stand) {
  return `<input id="review-note" placeholder="${esc(t('Notiz (optional)'))}" maxlength="120" value="${esc(stand.note)}" style="height:44px;background:var(--surface);border:1.5px solid var(--ink-a10);border-radius:14px;padding:0 15px;font:500 13.5px ${FONT};color:var(--ink);outline:none;width:100%;box-sizing:border-box;flex:none">`;
}

// Ein ECHTER Knopf. Grau, solange noch keine Stufe gewählt ist — er bleibt trotzdem antippbar
// und sagt dann kurz, was fehlt (v3.1 §7: Pflichtfelder melden sich per Toast, nie als Sheet).
function fertigKnopf(bereit) {
  const look = bereit
    ? 'background:var(--green);color:var(--on-accent);border:1.5px solid var(--green-dark);box-shadow:0 6px 18px var(--green-a26)'
    : 'background:var(--field);color:var(--muted);border:1.5px solid var(--ink-a08);box-shadow:none';
  const haken = bereit ? `<svg width="16" height="16" viewBox="0 0 24 24" fill="none" style="pointer-events:none;flex:none">${reviewCheckPath('var(--on-accent)', 2.6)}</svg>` : '';
  return `<button data-act="review-fertig" data-bereit="${bereit ? '1' : '0'}" aria-disabled="${!bereit}" style="pointer-events:auto;width:100%;display:flex;align-items:center;justify-content:center;gap:8px;${look};font:650 15px/1 ${FONT};padding:16px 0;border-radius:999px;box-sizing:border-box;cursor:pointer;appearance:none;transition:background-color .2s ease,color .2s ease,box-shadow .2s ease,border-color .2s ease">${haken}<span style="pointer-events:none">${t('Fertig')}</span></button>`;
}

function reviewMenu(hatBewertung) {
  const items = [{ act: 'menu-hide', icon: eyeOffIcon(), label: t('Aus Verlauf ausblenden') }];
  if (hatBewertung) items.push({ act: 'menu-review-delete', icon: trash('var(--red)', 15), label: t('Bewertung löschen'), color: 'var(--red)' });
  return menuShell(items);
}

// Vor der Stufe angetippte Themen leben nur in ui (für genau dieses Meet).
function vorabThemen(ui, meetId) {
  return ui.reviewVorab && ui.reviewVorab.meetId === meetId ? ui.reviewVorab.themen : null;
}

function renderMeetReview(ctx) {
  const meet = ctx.repo.getMeet(ctx.params.meetId);
  if (!meet) return missingScreen();
  const { ui } = ctx;
  const stand = bewertungLesen(meet.review);
  const gewaehlt = Boolean(stand.verdict);
  const weiter = stand.verdict === NICHT_STATT
    ? nichtStattBlock(stand)
    : themenBlock(gewaehlt ? stand.themen : (vorabThemen(ui, meet.id) || {}));

  // Die Hülle ist mindestens so hoch wie die Fläche über „Fertig" — die Abstände verteilen den
  // Platz, der Inhalt selbst verschiebt sich nie. „review-weiter" hat eine FESTE Höhe: Themen
  // und Nachfrage tauschen sich darin, ohne dass die Notiz darunter wandert.
  const body = `<div data-role="review" style="min-height:100%;box-sizing:border-box;display:flex;flex-direction:column;padding:2px 20px 0">
${reviewMeetZeile(meet)}
${luft(6, 22)}
${stufenWahl(stand)}
${luft(8, 26)}
<div data-role="review-weiter" style="flex:2 1 0;min-height:${WEITER_MIN}px;max-height:${WEITER_MAX}px;display:flex;flex-direction:column">${weiter}</div>
${luft(6, 18)}
${notizFeld(stand)}
</div>`;

  const html = screenScaffold({
    header: headerRow(Boolean(ui.menu), { titel: t('Wie war’s?') }),
    body,
    bottom: bottomLayer(fertigKnopf(gewaehlt)),
    bottomInset: CTA_INSET,
    bottomFadeHeight: 118,
    overlays: ui.menu ? reviewMenu(gewaehlt) : '',
    scrollKey: 'meet-review',
  });

  return { html, bind: (root) => bindMeetReview(root, ctx, meet) };
}

function bindMeetReview(root, ctx, meet) {
  const { repo, nav, ui } = ctx;
  const aktuell = () => bewertungLesen(repo.getMeet(meet.id)?.review);
  // Beim Tippen wird NICHT gerendert — sonst verlöre das Feld bei jedem Zeichen seinen Platz
  // im Abgleich. Gesichert wird beim Verlassen des Feldes, bei jeder Wahl und bei „Fertig".
  const notizImFeld = () => {
    const feld = root.querySelector('#review-note');
    return feld ? feld.value.trim() : null;
  };
  const speichern = (stand) => {
    const notiz = notizImFeld();
    if (notiz !== null) stand.note = notiz;
    repo.submitReview(meet.id, bewertungSchreiben(stand));
  };
  const noteInput = root.querySelector('#review-note');
  if (noteInput && !noteInput.dataset.noteBound) {
    noteInput.dataset.noteBound = '1';
    noteInput.addEventListener('change', () => {
      const stand = aktuell();
      if (stand.verdict) speichern(stand);
    });
  }

  bindActions(root, {
    menu: () => { ui.menu = !ui.menu; ctx.render(); },
    'close-menu': () => { ui.menu = false; ctx.render(); },
    'menu-hide': () => {
      ui.menu = false;
      repo.hideFromHistory(meet.id);
      nav.back();
    },
    // Privat UND löschbar (v6 A23): Löschen steht ausdrücklich im Menü.
    'menu-review-delete': () => {
      ui.menu = false;
      ui.reviewVorab = null;
      repo.submitReview(meet.id, null);
      ctx.toast?.(t('Bewertung gelöscht'));
      ctx.render();
    },
    'review-stufe': (data) => {
      const stand = aktuell();
      stand.verdict = data.stufe;
      if (data.stufe === NICHT_STATT) {
        stand.themen = {};
      } else {
        stand.grund = null;
        // Vor der Stufe angetippte Themen gehen mit der Stufe in die Bewertung.
        const vorab = vorabThemen(ui, meet.id);
        if (vorab) stand.themen = { ...stand.themen, ...vorab };
      }
      ui.reviewVorab = null;
      rueckmeldung('auswahl');
      speichern(stand);
    },
    'review-thema': (data) => {
      const stand = aktuell();
      if (stand.verdict === NICHT_STATT) return;
      rueckmeldung('auswahl');
      if (!stand.verdict) {
        if (!vorabThemen(ui, meet.id)) ui.reviewVorab = { meetId: meet.id, themen: {} };
        const vorab = ui.reviewVorab.themen;
        if (vorab[data.thema] === data.wert) delete vorab[data.thema];
        else vorab[data.thema] = data.wert;
        ctx.render();
        return;
      }
      if (stand.themen[data.thema] === data.wert) delete stand.themen[data.thema];
      else stand.themen[data.thema] = data.wert;
      speichern(stand);
    },
    'review-grund': (data) => {
      const stand = aktuell();
      if (stand.verdict !== NICHT_STATT) return;
      rueckmeldung('auswahl');
      stand.grund = stand.grund === data.grund ? null : data.grund;
      speichern(stand);
    },
    'review-fertig': () => {
      const stand = aktuell();
      if (!stand.verdict) {
        ctx.toast?.(t('Wähl zuerst, wie es war'));
        return;
      }
      const notiz = notizImFeld();
      if (notiz !== null && notiz !== stand.note) speichern(stand);
      ui.reviewVorab = null;
      ctx.toast?.(t('Bewertung gespeichert'));
      nav.back('meet.home');
    },
  });
}

// --- Rückblick: das vorbeie Meet als feste Übersicht (R3 E5 · R4 E9) -----------------------
//
// Jonathan: „Wenn ich auf ein Meet aus meinen vergangenen Meets klicke, brauche ich eine fixe
// Übersicht und nicht direkt die Bewertung. Standardansicht mit einem Knopf ‚Bewerten'."
// Aufbau (R4 E9): Foto · Titel · wann · wo → (eigene Bewertung) → echte Karte → wer dabei war
// → Mitbringen → Umfragen — alles zum Nachsehen. Unten EIN Knopf: „Bewerten" bzw.
// „Bewertung ändern". Ein abgesagtes Meet sagt das und bietet keine Bewertung an.

function rueckblickMenu() {
  return menuShell([
    { act: 'menu-template', icon: arrowRightIcon(), label: t('Als Vorlage nutzen') },
    { act: 'menu-hide', icon: eyeOffIcon(), label: t('Aus Verlauf ausblenden') },
  ]);
}

function rueckblickBewertung(meet) {
  const stand = bewertungLesen(meet.review);
  if (!stand.verdict) return '';
  const nichtStatt = stand.verdict === NICHT_STATT;
  const stufe = STUFE[stand.verdict];
  const ton = nichtStatt ? REVIEW_TONE.grau : REVIEW_TONE[stufe.ton];
  const zeichen = nichtStatt ? nichtStattZeichen(36) : gesichtRund(stufe, 36);
  const wert = nichtStatt ? t('Hat nicht stattgefunden') : stufe.label;
  const chip = (text, farbe) => `<span style="font-size:11.5px;font-weight:650;color:${farbe.ink};background:${farbe.tint};border-radius:999px;padding:5px 9px;white-space:nowrap">${esc(text)}</span>`;
  const chips = nichtStatt
    ? NICHT_STATT_GRUENDE.filter((grund) => grund.id === stand.grund).map((grund) => chip(grund.label, REVIEW_TONE.grau))
    : THEMEN.filter((thema) => stand.themen[thema.id]).map((thema) => {
      const gewaehlt = STUFE[stand.themen[thema.id]];
      return chip(`${thema.label} · ${gewaehlt.label}`, REVIEW_TONE[gewaehlt.ton]);
    });
  return `<button data-act="open-review" data-role="rueckblick-bewertung" aria-label="${esc(t('Bewertung ändern'))}" style="display:flex;flex-direction:column;gap:10px;width:100%;box-sizing:border-box;background:var(--surface);border:1px solid var(--ink-a10);border-radius:20px;padding:13px 14px;cursor:pointer;appearance:none;font-family:${FONT};color:var(--ink);text-align:left;flex:none">
<span style="display:flex;align-items:center;gap:11px;width:100%;pointer-events:none">${zeichen}<span style="display:flex;flex-direction:column;gap:2px;flex:1;min-width:0"><span style="font-size:10.5px;font-weight:650;letter-spacing:.08em;text-transform:uppercase;color:var(--muted)">${t('Deine Bewertung')}</span><span style="font-size:16px;font-weight:650;color:${ton.ink};line-height:1.2">${esc(wert)}</span></span><span style="font-size:11.5px;color:var(--muted);flex:none">${t('Nur für dich')}</span></span>
${chips.length ? `<span style="display:flex;flex-wrap:wrap;gap:6px;pointer-events:none">${chips.join('')}</span>` : ''}
${stand.note ? `<span style="font-size:13px;color:var(--ink-soft);line-height:1.45;pointer-events:none">„${esc(stand.note)}“</span>` : ''}
</button>`;
}

function rueckblickKnopf(bewertet) {
  if (!bewertet) {
    return `<button data-act="open-review" style="pointer-events:auto;width:100%;display:flex;align-items:center;justify-content:center;gap:8px;background:var(--green);color:var(--on-accent);font:650 15px/1 ${FONT};padding:16px 0;border-radius:999px;border:1.5px solid var(--green-dark);box-sizing:border-box;box-shadow:0 6px 18px var(--green-a26);cursor:pointer;appearance:none"><span style="pointer-events:none;display:flex">${gesichtSvg('froh', 'var(--on-accent)', 19)}</span><span style="pointer-events:none">${t('Bewerten')}</span></button>`;
  }
  return `<button data-act="open-review" style="pointer-events:auto;width:100%;display:flex;align-items:center;justify-content:center;gap:8px;background:var(--paper-soft);color:var(--ink);font:650 15px/1 ${FONT};padding:15px 0;border-radius:999px;border:1.5px solid var(--ink-a14);box-sizing:border-box;box-shadow:0 2px 8px var(--shadow-08);cursor:pointer;appearance:none"><span style="pointer-events:none;display:flex">${pencilIcon('var(--ink)', 15)}</span><span style="pointer-events:none">${t('Bewertung ändern')}</span></button>`;
}

function renderRueckblick(ctx, meet) {
  const { ui } = ctx;
  const abgesagt = Boolean(meet.cancelled);
  const bewertet = Boolean(bewertungLesen(meet.review).verdict);
  const abgesagtHinweis = abgesagt
    ? `<div data-role="rueckblick-abgesagt" style="display:flex;align-items:center;gap:10px;background:var(--red-tint);border:1px solid var(--red-a25);border-radius:18px;padding:12px 14px;flex:none">${circleXIcon('var(--danger)')}<span style="font-size:13px;font-weight:600;color:var(--danger);flex:1;min-width:0">${t('Dieses Meet wurde abgesagt.')}</span></div>`
    : '';
  const sections = [
    abgesagtHinweis,
    abgesagt ? '' : rueckblickBewertung(meet),
    meetOrtKarte(ctx, meet, { kartenHoehe: 160 }),
    participationSection(ctx, meet, { editable: false }),
    bringRueckblick(ctx, meet),
    pollRueckblick(ctx, meet),
  ].join('');

  const body = `<div data-role="rueckblick" style="padding-top:10px">
${meetKopfKarte(ctx, meet)}
<div style="display:flex;flex-direction:column;gap:9px;padding:12px 20px 0">${sections}</div>
</div>`;

  const knopf = abgesagt ? '' : rueckblickKnopf(bewertet);
  const html = screenScaffold({
    header: headerRow(Boolean(ui.menu)),
    body,
    bottom: knopf ? bottomLayer(knopf) : '',
    bottomInset: knopf ? CTA_INSET : 24,
    bottomFadeHeight: knopf ? 118 : 22,
    overlays: ui.menu ? rueckblickMenu() : '',
    scrollKey: 'meet-rueckblick',
  });

  return {
    html,
    bind: (root) => {
      schliesseMitteilung(`meet-${meet.id}`);
      const { repo, nav } = ctx;
      bindeMeetOrtKarte(root, meet);
      bindActions(root, {
        menu: () => { ui.menu = !ui.menu; ctx.render(); },
        'close-menu': () => { ui.menu = false; ctx.render(); },
        'menu-template': () => alsVorlageNutzen(ctx, meet),
        'menu-hide': () => {
          ui.menu = false;
          repo.hideFromHistory(meet.id);
          nav.back();
        },
        'open-review': () => nav.go('meet.review', { meetId: meet.id }),
        ...meetOrtAktionen(ctx, meet),
        ...meetFotoAktionen(ctx),
      });
    },
  };
}

export const meetDetailScreens = {
  'meet.details': renderMeetDetails,
  'meet.proposeTime': renderProposeTime,
  'meet.proposeActivity': renderProposeActivity,
  'meet.review': renderMeetReview,
};
