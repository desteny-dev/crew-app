// Bereich Meet-Browser (reference/current 05.1–05.5b, Korrektur v2/v14, Runtime-Grammatik v3.1):
// der EINE Meet-Browser. Wird identisch von Meet-Tab, Meine Meets, Gemeinsame Meets (Raum) und
// Person-Meets verwendet.
//
// Runde 7 (A2) — der Meet-Tab IST der Kalender. Die Kartenansicht ist entfallen; die Karte ist
// ein eigener Haupt-Tab (screens/karte.js) — zwei Karten wären zwei Wahrheiten über dasselbe Ding.
//
// Runde 8c (R8-69, Jonathan 19.09., endgültig) — zwei Ansichten, umgeschaltet oben im Kopf:
//   • LISTE (Standard): die Listenansicht wie vor Runde 8b — Loops von links nach rechts, Meets von
//     oben nach unten (listBody).
//   • WOCHE: Pfeile und Wochenauswahl, darunter Mo–So als Spalten und die Uhrzeiten als Zeilen;
//     Meets als Blöcke zu ihrer Zeit, Meets ohne Ende laufen weich aus, die eigenen Busy-Zeiten
//     liegen ruhig dahinter (wocheBody).
//   Der Tages-Feed von Runde 8b (Bühne, Einrasten, Tages-Wisch, Wochenleiste) ist ersatzlos weg.
//   Im Meet-Tab gibt es keine FREE-Reihe mehr; neues Meet über den runden „+" oben rechts.
//   Eingebettet (Gemeinsame Meets, Meine Meets) steht die Liste allein, ohne Umschalter.
//
// ÖFFENTLICHE API (FRAMEWORK „Geteilte Bereichs-APIs")
//
//   opts = {
//     context: {} | { crewId } | { personId } | { mine:true },   // Datenkontext (repo)
//     uiKey:   string,                    // eigener ui-Zustand je Aufrufer
//     title?:  string,                    // Kopfzeilentitel (' ' = eingebettet: keine eigene Kopfzeile)
//     back?:   boolean,                   // Zurück-Knopf in der Kopfzeile
//     history?: 'off' | 'switch' | 'only',// seit R8-20 nur noch die Vorgabe für newMeet ('only' = kein CTA)
//     newMeet?: boolean,                  // „+ Meet"-CTA (Default: history !== 'only')
//     plus?:   boolean,                   // runder „+" im Kopf statt „+ Meet" unten (Meet-Tab)
//   }
//
//   meetBrowserParts(ctx, opts) → { view, header, body, cta, bottom, overlays, scrollKey, contentInset, bottomInset }
//       Bausteine für screenScaffold({header, body, bottom, bottomInset, overlays, scrollKey}).
//       `body` ist die Liste oder die Woche (die Woche füllt die Scrollfläche genau und rollt in
//       ihrem Raster). `cta` gehört in die Bottom-Ebene, `overlays` (Monatsblatt)
//       auf die höchste Ebene. `view` ist 'list' | 'week' (Teil der Scroll-Schlüssel der Aufrufer).
//   bindMeetBrowserBody(root, ctx, opts)

import { esc, bindActions, bindRowDrag } from '../core/html.js';
import { activityIconSvg } from '../ui/activity-icons.js';
import { ME } from '../data/ids.js';
import {
  screenScaffold, cardEdgeFade, bottomBar, edgeFadeRow, tabHeader, leerZeile, meetKachel,
} from '../ui/components.js';
import { backArrow, plus } from '../ui/icons.js';
import { symbol } from '../ui/symbole.js';
// R6 D6: Die Bewertungs-Frage am vergangenen Meet kommt aus dem gemeinsamen Baustein.
import {
  PART_TOAST, bewertungOffen, bewertungsZeile, bewertungsZeileAktionen,
} from '../ui/meet-panels.js';
import { t } from '../core/sprache.js';
import {
  now, toISODate, fromISODate, addDays, weekStart, weekDays,
  isToday, isTomorrow, weekdayShort, weekdayLong,
  tagUndMonat, tagMonatKurz, monatUndJahr, monatKurz, wochenInitialen,
} from '../core/dates.js';

// v5 A18: Wortlaut der Loop-Antwort — dieselbe Grammatik wie PART_TOAST.
const LOOP_TOAST = { yes: t('Du bist dabei'), no: t('Du bist raus'), open: t('Antwort offen') };

// Runde 4 (C3): Kleine Knöpfe dieses Bereichs (Zusage/Absage 26–28 px, Umschalter 38×30, „+ Meet" 42 hoch,
// Wochenpfeile, Zurück, Heute, „Wie war's?") tragen data-treffer — eine unsichtbare Fläche von
// mindestens 44 px (Regel in styles.css).
//
// v6 A08a (spec/02 §3): „+ Meet" ist die Hauptaktion des Browsers und spricht deshalb
// dieselbe Sprache wie der zweite Primär-CTA der App („Meet senden", var(--green)) — nicht
// den Textton var(--ink) als Vollfläche.
//
// Runde 6 (D7, Jonathan: „eventuell der meet button könnte besser aussehen"): Er war eine
// breite Pille MITTIG über der Liste — und es gab ihn NUR in der Liste. Gemessen: im
// Kalender und auf der Karte war der wichtigste Weg der App gar nicht erreichbar, und in
// der Liste lag die Pille (208 × 46 px) genau über den Karten der nächsten Meets.
// Jetzt ist er ein schwebender Knopf UNTEN RECHTS — in allen drei Ansichten derselbe:
//   • Zeichen UND Wort („+ Meet"), damit er auch beim ersten Mal zu lesen ist,
//   • 52 px hoch (Daumenhöhe), am rechten Rand, wo der Daumen ohnehin liegt,
//   • er verdeckt keinen Inhalt mehr: die Spalte in der Mitte bleibt frei, unter ihm läuft
//     der Inhalt sichtbar durch, und bottomInset hält den letzten Eintrag erreichbar.
// Runde 7 (E7): Er nimmt den Tag mit, auf dem man gerade steht — welcher das ist, wird erst
// beim Tippen gelesen (die Bühne wechselt den Tag beim Blättern OHNE neu zu zeichnen — Runde 8,
// R8-21 —, ein data-Attribut am Knopf wäre nach dem ersten Wisch falsch).
const NEW_MEET_BUTTON = "border:0;appearance:none;cursor:pointer;background:var(--green);color:var(--on-accent);font:650 15px/1 'Instrument Sans',sans-serif;height:52px;padding:0 20px 0 15px;border-radius:26px;display:flex;align-items:center;gap:7px;box-shadow:0 10px 26px var(--green-a35),0 2px 6px var(--shadow-14)";

function neuMeetKnopf() {
  return `<button data-act="mb-new-meet" data-role="mb-neu-meet" aria-label="${esc(t('Meet anlegen'))}" style="pointer-events:auto;${NEW_MEET_BUTTON}"><span style="pointer-events:none;display:flex">${plus('var(--on-accent)', 21)}</span><span style="pointer-events:none">${t('Meet')}</span></button>`;
}

// v6 A08c (spec/02 §3): Der Kalender kennt drei Zustände und braucht dafür keine zweite
// Vollfarbe. „Heute" bleibt die ruhige grüne Fläche ohne Kontur, „ausgewählt" bekommt
// dieselbe Farbfamilie als getönte Fläche MIT grüner Kontur und dunkler Schrift, und nur
// „heute UND ausgewählt" füllt kräftig grün. Damit bleiben alle drei unterscheidbar,
// ohne dass irgendwo Schwarz als Auswahlfarbe auftritt.
// Die Kontur ist bewusst ein INNENLIEGENDER Schatten und kein border: ein Rahmen würde
// jede Zelle beim Auswählen um seine Breite wachsen lassen (und Chrome rundet 1,5 px je
// nach Pixeldichte unterschiedlich) — die Wochenleiste würde sichtbar zucken.
const SEL_TINT = 'var(--green-a10)';                  // getönte Auswahlfläche
const SEL_RING = 'inset 0 0 0 1.5px var(--green)';            // Kontur der Auswahl
const SEL_TEXT = 'var(--ink)';                              // dunkle Schrift auf der hellen Auswahl
const TODAY_TINT = 'var(--green-a16)'; // „heute", unverändert aus reference 05.2
const TODAY_TEXT = 'var(--green-dark)';

// Bottom-Ebene (v3.1 §1): Höhe der echten Bedienelemente — daraus entsteht der bottomInset,
// damit der letzte Inhalt vollständig nach oben scrollbar bleibt.
const TABBAR_INSET = 88;
const CTA_INSET = 80;

// v7 A30b (spec/05 §6): Schrittweite und Umfang der ziehbaren Jahresbahn im Datums-Picker.
// Ungerade Anzahl mit der 0 in der Mitte — nur so hält `translateX(-50%)` das gewählte
// Jahr bei jeder Pickerbreite exakt auf der Mitte.
const YEAR_STEP = 66;
const YEAR_SPAN = [-3, -2, -1, 0, 1, 2, 3];

// Bereichseigene Aktivitäts-Icons aus reference 05.5b (Deck-Karten), die es im geteilten
// Icon-Bestand (ui/activity-icons.js) nicht gibt. Seeds nutzen die Schlüssel 'sun'/'note';
// andere Bereiche fallen über activityIconSvg auf Titel-/Kategorie-Zuordnung zurück.
const EXTRA_ICONS = {
  sun: (color, size) => `<svg width="${size}" height="${size}" viewBox="0 0 24 24" fill="none"><path d="M12 3v4M12 21v-4M5.6 5.6l2.8 2.8M18.4 18.4l-2.8-2.8M3 12h4M21 12h-4M5.6 18.4l2.8-2.8M18.4 5.6l-2.8 2.8" stroke="${color}" stroke-width="1.8" stroke-linecap="round"></path></svg>`,
  note: (color, size) => `<svg width="${size}" height="${size}" viewBox="0 0 24 24" fill="none"><path d="M9 18V5.5l10-2V16" stroke="${color}" stroke-width="1.8" stroke-linejoin="round"></path><ellipse cx="6.5" cy="18" rx="2.5" ry="2.2" stroke="${color}" stroke-width="1.8"></ellipse><ellipse cx="16.5" cy="16" rx="2.5" ry="2.2" stroke="${color}" stroke-width="1.8"></ellipse></svg>`,
};

function meetIconSvg(meet, color, size) {
  const extra = EXTRA_ICONS[meet.icon];
  return extra ? extra(color, size) : activityIconSvg(meet, color, size);
}

// --- UI-Zustand des Browsers (pro uiKey, lebt in ctx.ui) ---

// v3.1 §3: Der Kontext bestimmt, ob hier neue Meets entstehen ('only' = reiner Rückblick,
// „Meine Meets"). Seit R8-20 gibt es keine zweite Ansicht und keine Richtung mehr — der Zustand
// ist nur noch der offene Tag, das Monatsblatt und die Stufe in einem langen Tag.
function historyMode(opts = {}) {
  const mode = opts.history || 'switch';
  return mode === 'off' || mode === 'only' ? mode : 'switch';
}

function browserUi(ctx, opts = {}) {
  const key = opts.uiKey || 'meetBrowser';
  // R8-69: Standard ist die Liste. `day` verankert die gezeigte Woche, `wahl` ist der angetippte Tag.
  if (!ctx.ui[key]) ctx.ui[key] = { view: 'list', day: toISODate(now()), wahl: null, picker: null };
  const ui = ctx.ui[key];
  if (!ui.day) ui.day = toISODate(now());
  // Eingebettet (kein eigener Kopf) gibt es keinen Umschalter — dort ist es immer die Liste.
  // Altzustände ('calendar' aus Runde 7/8b) führen nie in eine leere Ansicht.
  const hatKopf = opts.title === undefined || Boolean(String(opts.title).trim()) || Boolean(opts.back);
  if (!hatKopf || (ui.view !== 'list' && ui.view !== 'week')) ui.view = 'list';
  return ui;
}

// Nächste echte Wiederholung eines Loops (Datum-Schlüssel für setLoopResponse).
function loopNextDate(meet) {
  const today = toISODate(now());
  if (meet.date >= today) return meet.date;
  for (let offset = 0; offset <= 7; offset += 1) {
    const iso = addDays(today, offset);
    if (fromISODate(iso).getDay() === meet.loop.weekday) return iso;
  }
  return meet.date;
}

function loopOccursOn(meet, iso) {
  return iso >= toISODate(now()) && fromISODate(iso).getDay() === meet.loop.weekday;
}

// --- Karten-Bausteine ---

// v6 A16f: contextName (Crew- bzw. Ortsname als dritte Metaspalte) ist entfallen —
// die geschlossene Karte zeigt statt des Kontexts den Ort, und wo die Liste zu einem
// festen Kontext gehört (Raum, Person), war der Name ohnehin doppelt.

function iconTile(meet, size, radius, svgSize) {
  const background = meet.loop ? 'var(--blue-tint)' : 'var(--paper)';
  const color = meet.loop ? 'var(--blue-dark)' : 'var(--ink)';
  return `<span style="width:${size}px;height:${size}px;border-radius:${radius}px;background:${background};display:flex;align-items:center;justify-content:center;flex:none">${meetIconSvg(meet, color, svgSize)}</span>`;
}

// RSVP-Paar (reference 05.1/05.2, drei Zustände):
//   ja → Check grün gefüllt · offen → Check hohl mit grüner Kontur · nein → X rot gefüllt,
//   das jeweils andere Control neutral hohl. Nie ein rot angedeutetes X im offenen Zustand.
function rsvpPair(answer, { size, act, yesData, noData }) {
  const checkSvg = size >= 28 ? 13 : 12;
  const xSvg = size >= 28 ? 11 : 10;
  const gap = Math.max(size >= 28 ? 6 : 5, 44 - size); // Runde 4 (C3): Mitte zu Mitte mind. 44 px, sonst teilen sich ✓ und × die Tippfläche
  const attrs = (data) => Object.entries(data || {}).map(([key, value]) => `data-${key}="${esc(value)}"`).join(' ');
  const base = `width:${size}px;height:${size}px;border-radius:50%;box-sizing:border-box;display:flex;align-items:center;justify-content:center;padding:0;cursor:pointer;appearance:none`;

  let checkStyle;
  let checkStroke;
  if (answer === 'yes') { checkStyle = 'border:0;background:var(--green)'; checkStroke = 'var(--on-accent)'; }
  else if (answer === 'no') { checkStyle = 'border:1.5px solid var(--ink-a14);background:transparent'; checkStroke = 'var(--muted)'; }
  else { checkStyle = 'border:1.5px solid var(--green-a45);background:transparent'; checkStroke = 'var(--green-dark)'; }
  const xStyle = answer === 'no' ? 'border:0;background:var(--red)' : 'border:1.5px solid var(--ink-a14);background:transparent';
  const xStroke = answer === 'no' ? 'var(--on-accent)' : 'var(--muted)';

  return `<div style="display:flex;gap:${gap}px;flex:none;align-self:flex-end">
<button data-act="${act}" ${attrs(yesData)} data-treffer aria-pressed="${answer === 'yes'}" aria-label="${esc(t('Dabei'))}" style="${base};${checkStyle}"><svg width="${checkSvg}" height="${checkSvg}" viewBox="0 0 24 24" fill="none" style="pointer-events:none"><path d="m7.5 12.5 3 3 6-6.5" stroke="${checkStroke}" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round"></path></svg></button>
<button data-act="${act}" ${attrs(noData)} data-treffer aria-pressed="${answer === 'no'}" aria-label="${esc(t('Nicht dabei'))}" style="${base};${xStyle}"><svg width="${xSvg}" height="${xSvg}" viewBox="0 0 24 24" fill="none" style="pointer-events:none"><path d="M7 7l10 10M17 7 7 17" stroke="${xStroke}" stroke-width="2.4" stroke-linecap="round"></path></svg></button>
</div>`;
}

function meetRsvp(meet, size) {
  const mine = meet.participation?.[ME];
  const answer = mine === 'yes' || mine === 'no' ? mine : null;
  return rsvpPair(answer, {
    size,
    act: 'mb-participation',
    yesData: { meet: meet.id, state: 'yes' },
    noData: { meet: meet.id, state: 'no' },
  });
}

function loopRsvp(meet, dateKey, size) {
  const answer = meet.loop.responses?.[dateKey]?.[ME] || null;
  return rsvpPair(answer, {
    size,
    act: 'mb-loop-response',
    yesData: { meet: meet.id, date: dateKey, response: 'yes' },
    noData: { meet: meet.id, date: dateKey, response: 'no' },
  });
}

// Meet-Karte der Liste (reference 05.1). variant 'list' (Datum in der Zeile) | 'day'.
// options.dateKey: angezeigter Tag (die Loop-Antwort gilt für genau diesen Tag).
//
// v6 A16f (spec/04 §3): Die GESCHLOSSENE Karte trägt nur Icon, Aktivitätstitel, Zeitpunkt,
// Ort und die direkte Teilnahmeauswahl. Der Kontextname (Crew/Person) und der Teilnehmer-
// stapel sind Metadaten bzw. eine Liste — sie gehören in die geöffnete Detailansicht, wo
// die Teilnahme-Dreiteilung sie ohnehin vollständig zeigt. Der Ort war umgekehrt gar nicht
// zu sehen, obwohl er vor dem Öffnen die wichtigere Entscheidungsinformation ist.
function listMeetCard(ctx, meet, variant, options = {}) {
  const isLoop = Boolean(meet.loop);
  const isDone = meet.status === 'done';
  const active = meet.status === 'active';
  const time = isLoop ? (meet.loop.time || meet.time) : meet.time;
  // „Ort offen" statt einer leeren Stelle: ein noch unbestimmter Ort ist ein echter Zustand.
  const place = meet.place?.name || t('Ort offen');

  // Solange Zeitvorschläge offen sind, nennt die Karte keine Uhrzeit, die noch niemand
  // beschlossen hat — dieselbe Aussage wie die Hauptkarte der Detailansicht („Zeit offen").
  const timeOpen = !isDone && !active && (meet.variants || []).some((entry) => entry.kind === 'time');
  const timeText = timeOpen ? t('Zeit offen') : esc(time);

  // Zeitpunkt: In der Liste steht das Datum in der Zeile (R8-69: die Liste ist zurück).
  let when;
  if (active) when = variant === 'day' ? t('seit {zeit}', { zeit: esc(time) }) : `${t('Heute')} · ${t('seit {zeit}', { zeit: esc(time) })}`;
  else if (variant === 'day') when = timeText;
  else when = `${fmtDayShort(isLoop ? (options.dateKey || loopNextDate(meet)) : meet.date)} · ${timeText}`;

  let meta = `${when} · ${esc(place)}`;
  // Zwei kurze Zustandsworte bleiben: sie stehen sonst nirgends auf der Karte und sind
  // keine Metadaten, sondern ändern die Bedeutung des Meets.
  if (isLoop) meta += ` · ${t('Loop')}`;
  if (isDone && meet.cancelled) meta += ` · <b style="color:var(--muted);font-weight:650">${t('Abgesagt')}</b>`;

  // Noch nicht entschiedene Aktivität: Die Karte zeigt den echten Variantenstand statt eines
  // Haupttitels, den niemand gewählt hat. Gezählt wird wie in der Detailansicht — der
  // ursprüngliche Titel ist der erste Vorschlag, die Aktivitätsvarianten die weiteren.
  const activityVariants = (meet.variants || []).filter((entry) => entry.kind === 'activity');
  const undecided = !isDone && meet.status === 'open' && activityVariants.length > 0;
  const title = undecided ? t('{n} Vorschläge', { n: activityVariants.length + 1 }) : meet.title;
  // Dasselbe Ocker, mit dem die Detailansicht offene Vorschläge beschriftet — keine neue Farbe.
  const titleColor = undecided ? 'color:var(--orange-dark);' : (isLoop ? 'color:var(--blue-dark);' : '');

  let right = '';
  if (isDone) {
    // R6 D6: Wartet das Meet gerade auf seine Bewertung, steht die Frage als leise Zeile
    // UNTER der Karte (meetEintrag) — dann hier keine zweite Einladung zur selben Sache.
    if (!meet.review && !meet.cancelled && !bewertungOffen(meet)) {
      right = `<button data-act="mb-review" data-meet="${meet.id}" data-treffer style="border:0;appearance:none;cursor:pointer;background:var(--orange-tint);color:var(--orange-dark);font:650 11px/1 'Instrument Sans',sans-serif;padding:7px 11px;border-radius:999px;flex:none;align-self:flex-end">${t("Wie war's?")}</button>`;
    }
  } else if (isLoop) {
    right = loopRsvp(meet, options.dateKey || loopNextDate(meet), 28);
  } else {
    right = meetRsvp(meet, 28);
  }

  return `<div data-act="mb-open-meet" data-meet="${meet.id}"${options.dateKey ? ` data-date="${options.dateKey}"` : ''} role="button" style="position:relative;background:var(--surface);border:1px solid ${active ? 'transparent' : 'var(--ink-a10)'};border-radius:20px;padding:12px 14px;display:flex;align-items:center;gap:11px;box-shadow:0 1px 2px var(--shadow-05);cursor:pointer;font-family:'Instrument Sans',sans-serif;flex:none">
${active ? cardEdgeFade(20) : ''}
<span style="pointer-events:none;display:contents">${iconTile(meet, 34, 10, 17)}</span>
<div style="display:flex;flex-direction:column;gap:2px;min-width:0;flex:1;pointer-events:none;position:relative">
<span style="font-size:15px;font-weight:650;letter-spacing:-.01em;${titleColor}white-space:nowrap;overflow:hidden;text-overflow:ellipsis">${esc(title)}</span>
<span style="font-size:12px;color:${active ? 'var(--green-dark)' : 'var(--ink-soft)'};font-variant-numeric:tabular-nums;white-space:nowrap;overflow:hidden;text-overflow:ellipsis">${meta}</span>
</div>
${right}
</div>`;
}

// R6 D6 (Jonathan: „Bewertungshinweis könnten wir eventuell woanders hin geben"): In der
// Liste gehört die Frage zum vergangenen Meet — als LEISE ZEILE unter seiner Karte, nicht
// als eigene Kachel weiter oben. Sie erscheint nur, wo sie etwas bedeutet (bewertungOffen),
// und verschwindet nach einem Tipp auf ein Gesicht oder auf ✕ endgültig.
function meetEintrag(ctx, meet, variant, options = {}) {
  const karte = listMeetCard(ctx, meet, variant, options);
  const frage = bewertungsZeile(ctx, meet, { variante: 'liste', titel: false });
  if (!frage) return karte;
  return `<div style="display:flex;flex-direction:column;flex:none">${karte}${frage}</div>`;
}

// --- Kopfzeile (Runde 8c, R8-69) ---
// Jonathan (19.09.): „Umschalter oben rechts im Kopf: Liste · Woche. STANDARD = Liste … Keine
// FREE-Reihe im Meet-Tab; neues Meet über runden ‚+' oben rechts." Der Kopf trägt deshalb rechts
// eine zweigeteilte Pille mit WORTEN und daneben denselben runden „+" wie der Crew-Tab
// (crew.js › header: 38 px, Kreis mit Haarlinie). Eingebettet (title ' ': Gemeinsame Meets, Meine
// Meets) gibt es keinen eigenen Kopf — dort steht die Liste allein (R8-20: keine Umschalter).
const PLUS_KNOPF = 38;

function ansichtPille(ui) {
  const feld = (view, wort) => `<button data-act="mb-view" data-view="${view}" data-role="mb-ansicht-${view}" data-treffer aria-pressed="${ui.view === view}" style="height:30px;padding:0 13px;border:0;border-radius:999px;cursor:pointer;appearance:none;font:650 13px/1 'Instrument Sans',sans-serif;white-space:nowrap;${ui.view === view ? 'background:var(--surface);color:var(--ink);box-shadow:0 1px 3px var(--shadow-08)' : 'background:transparent;color:var(--muted)'}">${esc(wort)}</button>`;
  return `<div role="group" aria-label="${esc(t('Ansicht'))}" data-role="mb-ansicht" style="background:var(--field);border-radius:999px;padding:3px;display:flex;flex:none">${feld('list', t('Liste'))}${feld('week', t('Woche'))}</div>`;
}

function plusKnopf() {
  return `<button data-act="mb-new-meet" data-role="mb-neu-meet" data-treffer aria-label="${esc(t('Neues Meet'))}" style="position:relative;flex:none;width:${PLUS_KNOPF}px;height:${PLUS_KNOPF}px;border:1px solid var(--ink-a12);border-radius:50%;background:var(--surface);box-sizing:border-box;display:flex;align-items:center;justify-content:center;padding:0;cursor:pointer;appearance:none"><span style="pointer-events:none;display:flex">${plus('var(--ink)', 18)}</span></button>`;
}

function browserHeader(ctx, ui, opts) {
  const title = opts.title ?? t('Meet');
  if (!String(title).trim() && !opts.back) return '';
  const lead = opts.back
    ? `<button data-act="back" data-treffer aria-label="${esc(t('Zurück'))}" style="width:32px;height:32px;border-radius:50%;background:var(--surface);border:1.5px solid var(--ink-a10);display:flex;align-items:center;justify-content:center;padding:0;cursor:pointer;appearance:none;flex:none"><span style="pointer-events:none;display:flex">${backArrow('var(--ink)', 16)}</span></button>`
    : '';
  // v4 A.4: dieselbe Kopfachse wie Crew und Profil — Padding, Höhe und Ausrichtung
  // kommen aus tabHeader, damit beim Tabwechsel nichts springt.
  return tabHeader(
    `<span style="display:flex;align-items:center;gap:10px;min-width:0">${lead}<span style="font-family:'Bricolage Grotesque',sans-serif;font-size:22px;font-weight:650;white-space:nowrap;overflow:hidden;text-overflow:ellipsis">${esc(title)}</span></span>`,
    `${ansichtPille(ui)}${opts.plus ? plusKnopf() : ''}`,
  );
}

// --- Listenansicht (reference 05.1; Runde 8c, R8-69: wieder da, und sie ist der Standard) ---
// Der Stand vor Runde 8b (git f7c559a), in der Sache unverändert: oben die Loops als Reihe von
// links nach rechts, darunter die Meets von oben nach unten. Die Wahl kommend/vergangen bleibt weg
// (R8-20): Der Meet-Tab zeigt Kommendes, „Meine Meets" den Verlauf, „Gemeinsame Meets" beides
// untereinander — Kommendes zuerst, darunter der Verlauf, ohne Umschalter.

function fmtDayShort(iso) {
  if (isToday(iso)) return t('Heute');
  if (isTomorrow(iso)) return t('Morgen');
  return `${weekdayShort(iso)} ${tagMonatKurz(fromISODate(iso))}`;
}

// Loop-Karte im horizontalen Strip (reference 05.1). v6 A16f: dieselbe geschlossene Karten-
// Grammatik wie listMeetCard — Zeitpunkt und ORT, kein Kontextname, kein Teilnehmerstapel.
function loopStripCard(ctx, meet) {
  const dateKey = loopNextDate(meet);
  const active = meet.status === 'active' && isToday(dateKey);
  const time = meet.loop.time || meet.time;
  const place = meet.place?.name || t('Ort offen');
  const meta = active
    ? `${t('Heute')} · ${t('seit {zeit}', { zeit: esc(time) })} · ${esc(place)}`
    : `${fmtDayShort(dateKey)} · ${esc(time)} · ${esc(place)}`;
  return `<div data-act="mb-open-meet" data-meet="${meet.id}" role="button" style="position:relative;flex:none;width:212px;box-sizing:border-box;background:var(--surface);border:1px solid ${active ? 'transparent' : 'var(--ink-a09)'};border-radius:18px;padding:14px 15px 13px;display:flex;flex-direction:column;gap:9px;box-shadow:0 1px 2px var(--shadow-04);cursor:pointer;font-family:'Instrument Sans',sans-serif">
${active ? cardEdgeFade(18) : ''}
<div style="display:flex;align-items:center;justify-content:space-between;gap:8px;position:relative;z-index:1;pointer-events:none">
<span style="display:flex">${iconTile(meet, 46, 14, 21)}</span>
<span style="display:flex;pointer-events:auto">${loopRsvp(meet, dateKey, 26)}</span>
</div>
<div style="display:flex;flex-direction:column;gap:2px;position:relative;z-index:1;pointer-events:none;min-width:0">
<span style="font-size:14px;font-weight:650;letter-spacing:-.01em;color:var(--blue-dark);white-space:nowrap;overflow:hidden;text-overflow:ellipsis">${esc(meet.title)}</span>
<span style="font-size:11.5px;color:${active ? 'var(--green-dark)' : 'var(--ink-soft)'};font-variant-numeric:tabular-nums;white-space:nowrap;overflow:hidden;text-overflow:ellipsis">${meta}</span>
</div>
</div>`;
}

function sectionLabel(text, padTop) {
  return `<span style="display:block;font-size:11px;font-weight:650;letter-spacing:.09em;text-transform:uppercase;color:var(--ink-soft);padding:${padTop}px 24px 0">${text}</span>`;
}

// v3.1 §5: aktive Loops zuerst (in der Reihe also links), danach chronologisch.
function loopSortKey(meet) {
  const dateKey = loopNextDate(meet);
  const active = meet.status === 'active' && isToday(dateKey) ? '0' : '1';
  return `${active} ${dateKey} ${meet.loop.time || meet.time || '00:00'}`;
}

function listBody(ctx, ui, opts) {
  const key = opts.uiKey || 'meetBrowser';
  const mode = historyMode(opts);
  const kommend = mode !== 'only';
  const verlauf = mode !== 'off';
  const loops = kommend
    ? ctx.repo.getLoops({ context: opts.context }).sort((a, b) => loopSortKey(a).localeCompare(loopSortKey(b)))
    : [];
  // Reihenfolge kommt aus dem Gateway (aktive Meets zuerst) — hier wird NICHT nachsortiert.
  const bevor = kommend ? ctx.repo.getMeets({ context: opts.context, direction: 'upcoming' }) : [];
  const vorbei = verlauf ? ctx.repo.getMeets({ context: opts.context, direction: 'history' }) : [];

  const loopsHtml = loops.length
    ? `${sectionLabel(t('Loops'), 10)}
${edgeFadeRow(loops.map((meet) => loopStripCard(ctx, meet)).join(''), { gap: 9, padY: '8px 0 2px', scrollKey: `${key}-loops` })}`
    : '';
  const hatFreunde = ctx.repo.getPeople().length > 0;
  const karten = (liste) => `<div style="padding:8px 20px 4px;display:flex;flex-direction:column;gap:9px">${liste.map((meet) => meetEintrag(ctx, meet, 'list')).join('')}</div>`;

  let kommendHtml = '';
  if (kommend) {
    // Runde 2: kurz — ein Satz, ein Knopf. Ohne Freunde führt der Knopf zum QR-Code.
    const leer = hatFreunde
      ? leerZeile({ text: t('Noch nichts geplant'), aktLabel: t('Meet anlegen'), act: 'mb-new-meet' })
      : leerZeile({ text: t('Noch keine Freunde'), aktLabel: t('Freunde hinzufügen'), act: 'mb-friend-add' });
    kommendHtml = `${sectionLabel(t('Meet'), 12)}
${bevor.length ? karten(bevor) : `<div style="padding:8px 20px 4px">${leer}</div>`}`;
  }
  let verlaufHtml = '';
  if (verlauf && (vorbei.length || !kommend)) {
    verlaufHtml = `${sectionLabel(t('Verlauf'), 12)}
${vorbei.length ? karten(vorbei) : `<span style="display:block;font-size:12.5px;color:var(--muted);padding:8px 24px">${t('Noch kein Verlauf.')}</span>`}`;
  }
  return `<div data-role="mb-liste">${loopsHtml}
${kommendHtml}
${verlaufHtml}</div>`;
}

// „+ Meet" als echtes Bedienelement der Bottom-Ebene (v3.1 §1): der Inhalt läuft sichtbar
// darunter durch, wird von einem weichen Verlauf ausgeblendet und nie hart beschnitten.
// Runde 6 (D7): unten RECHTS statt mittig — und in jeder Ansicht (E7: auch im Kalender).
function ctaBar() {
  // v4 P0-5: KEINE Farbfläche mehr über dem Inhalt. Der Knopf ist das einzige reale
  // Element; der Inhalt läuft sichtbar hinter ihm durch und fadet erst an der Unterkante
  // der Scrollfläche aus (Maske in screenScaffold).
  return `<div style="pointer-events:none;height:${CTA_INSET}px;display:flex;align-items:center;justify-content:flex-end;padding:0 16px;box-sizing:border-box">${bottomBar(neuMeetKnopf())}</div>`;
}

// --- Kalenderansicht (reference 05.2 — genau EINE Ansicht: KW-Kopf, Tagesleiste, Tagesliste) ---

function dayMeets(ctx, opts, iso) {
  const seen = new Set();
  const merged = [];
  for (const direction of ['upcoming', 'history']) {
    for (const meet of ctx.repo.getMeets({ context: opts.context, direction, date: iso })) {
      if (!seen.has(meet.id)) { seen.add(meet.id); merged.push(meet); }
    }
  }
  for (const loop of ctx.repo.getLoops({ context: opts.context })) {
    if (loopOccursOn(loop, iso) && !seen.has(loop.id)) { seen.add(loop.id); merged.push(loop); }
  }
  // v3.1 §5: aktive Meets stehen auch in der Tagesliste oben, danach chronologisch.
  merged.sort((a, b) => {
    const activeDiff = (b.status === 'active' ? 1 : 0) - (a.status === 'active' ? 1 : 0);
    return activeDiff || (a.loop?.time || a.time || '').localeCompare(b.loop?.time || b.time || '');
  });
  return merged;
}

// Einträge je Tag für viele Tage auf einmal — nicht drei Abfragen je Tag.
function tagesEintraege(ctx, opts) {
  const jeTag = new Map();
  const gesehen = new Set();
  for (const direction of ['upcoming', 'history']) {
    for (const meet of ctx.repo.getMeets({ context: opts.context, direction })) {
      if (gesehen.has(meet.id)) continue;
      gesehen.add(meet.id);
      if (!jeTag.has(meet.date)) jeTag.set(meet.date, []);
      jeTag.get(meet.date).push(meet);
    }
  }
  const loops = ctx.repo.getLoops({ context: opts.context });
  const merker = new Map();
  return (iso) => {
    if (merker.has(iso)) return merker.get(iso);
    const liste = [...(jeTag.get(iso) || [])];
    const ids = new Set(liste.map((meet) => meet.id));
    for (const loop of loops) if (loopOccursOn(loop, iso) && !ids.has(loop.id)) liste.push(loop);
    // v3.1 §5: aktive Meets stehen auch in der Tagesliste oben, danach chronologisch.
    liste.sort((a, b) => {
      const activeDiff = (b.status === 'active' ? 1 : 0) - (a.status === 'active' ? 1 : 0);
      return activeDiff || (a.loop?.time || a.time || '').localeCompare(b.loop?.time || b.time || '');
    });
    merker.set(iso, liste);
    return liste;
  };
}

// Punkte im Monatsblatt: einer je Meet, höchstens drei (R8-23); Farbe --kalender-punkt (Stil der Woche).
const PUNKTE_HOECHSTENS = 3;

// --- Der Entwurf nimmt den Tag mit (Runde 7, E7) ---------------------------------------------
// Bis hierher warf jeder Weg aus dem Kalender heraus den Tag weg: Wer am Samstag stand und
// „+ Meet" drückte, bekam einen Entwurf ohne Datum und musste den Samstag im nächsten Schritt
// noch einmal suchen. Jetzt steht der Tag im Entwurf, bevor der erste Schritt getan ist.
//
// HEUTE (und alles davor) bleibt bewusst OHNE festen Termin: ein Entwurf ohne `when` heißt in
// der Erstellung „Jetzt" (new-meet.js › entwurfIstJetzt) — das ist für den heutigen Tag die
// richtigere und kürzere Aussage als eine Uhrzeit, die niemand gewählt hat.
function entwurfTermin(iso) {
  if (!iso || iso <= toISODate(now())) return null;
  return { date: iso, time: null, open: true };
}

// Einen Entwurf beginnen — von überall im Browser aus, immer mit dem Tag, auf dem man steht.
// Runde 8 (R8-20): Die beiden Wege aus dem leeren Tag (eine Person, eine Idee) sind mit den
// Vorschlägen entfallen. Es bleibt der Tag — über den runden „+" im Kopf (Meet-Tab; R8-69: in der
// Woche der angetippte Tag) und über „+ Meet" (Gemeinsame Meets).
function entwurfBeginnen(ctx, opts, { date = null } = {}) {
  const context = opts.context || {};
  // Raum-/Personen-Kontext des Browsers in den Entwurf übernehmen.
  const input = context.crewId
    ? { withCrewId: context.crewId }
    : context.personId
      ? { withPersonIds: [context.personId] }
      : {};
  const draft = ctx.repo.createDraft(input);
  const termin = entwurfTermin(date);
  if (termin) ctx.repo.updateDraft(draft.id, { when: termin });
  ctx.nav.go('newMeet.discover', { draftId: draft.id });
}

// --- Wochenansicht (Runde 8c, R8-69) ----------------------------------------------------------
// Jonathan (19.09.): „Woche: die Tagesansicht fällt weg; Pfeile und Wochenauswahl bleiben, darunter
// eine Wochenansicht Mo–So mit Uhrzeiten, Meets als Blöcke, Meets ohne festes Ende laufen nach
// unten aus, Busy-Zeiten stehen mit drin."
//
// Der Tages-Feed von Runde 8b (eine Bühne, die Tag für Tag blätterte und einrastete) ist damit
// vollständig entfallen — samt Wochenleiste, Tages-Wisch und Stufen. Was bleibt:
//   • oben die Pfeile und dazwischen die Wochenauswahl (Monat → Monatsblatt; ein Tag darin wählt
//     seine Woche). Ein Pfeil ist genau eine Woche.
//   • darunter sieben Spalten Mo–So und Uhrzeiten als Zeilen. Sichtbar ist ein Ausschnitt; gerollt
//     wird über den ganzen Tag (0–24 Uhr). Beim Öffnen steht die Ansicht um die aktuelle Uhrzeit
//     (diese Woche) bzw. kurz vor dem ersten Meet der Woche.
//   • Meets sind Blöcke zu ihrer Zeit, mit Zeichen und Titel; ein Tipp öffnet das Meet. Ein Meet
//     OHNE festes Ende hat keine Unterkante — es läuft über zwei Stunden weich aus.
//   • Die eigenen Busy-Zeiten (repo.getBelegt) liegen als ruhige Flächen dahinter; sie nehmen
//     keinen Tipp an und verdecken nichts.
//   • Ein Tipp auf einen Wochentag (Kopf oder freie Stelle der Spalte) wählt ihn: der „+" oben
//     nimmt dann diesen Tag mit. Ohne gewählten Tag beginnt der Entwurf ohne Datum.
// Die Seite selbst rollt nicht: Kopf und Raster füllen die Scrollfläche genau, gerollt wird im
// Raster (senkrecht). Waagerecht bleibt der Wisch der Tab-Bahn.
const STUNDE = 44;              // px je Stunde
const ZEIT_SPALTE = 38;         // Breite der Uhrzeiten links
const OHNE_ENDE_MIN = 120;      // so weit läuft ein Meet ohne Ende sichtbar aus
const KUERZESTER_BLOCK = 26;    // px — auch ein kurzes Meet bleibt antippbar

const WOCHE_STIL = `
:root{--kalender-punkt:#2654ab}
:root[data-theme="dark"]{--kalender-punkt:#6392e3}
.screen-scroll:has(> [data-woche]){overflow:hidden!important}
[data-woche]{position:relative;height:100%;display:flex;flex-direction:column;font-family:'Instrument Sans',sans-serif}
.wo-kopf{display:grid;grid-template-columns:${ZEIT_SPALTE}px repeat(7,1fr);padding:6px 10px 6px 4px;flex:none}
.wo-tag{border:0;background:transparent;appearance:none;cursor:pointer;padding:4px 0 5px;margin:0 1px;border-radius:12px;display:flex;flex-direction:column;align-items:center;gap:2px;color:var(--ink);font-family:inherit}
.wo-tag .wo-wd{font-size:10.5px;font-weight:650;color:var(--muted);letter-spacing:.02em}
.wo-tag .wo-nr{font-size:15px;font-weight:650;font-variant-numeric:tabular-nums;width:28px;height:28px;border-radius:50%;display:flex;align-items:center;justify-content:center}
.wo-tag[data-heute="1"] .wo-nr{background:var(--green-a16);color:var(--green-dark)}
.wo-tag[aria-pressed="true"]{background:var(--green-a10);box-shadow:inset 0 0 0 1.5px var(--green)}
.wo-raster{position:relative;flex:1;min-height:0;overflow-y:auto;overflow-x:hidden;overscroll-behavior:contain;-webkit-mask-image:linear-gradient(180deg,transparent 0,#000 10px,#000 calc(100% - 18px),transparent 100%);mask-image:linear-gradient(180deg,transparent 0,#000 10px,#000 calc(100% - 18px),transparent 100%)}
.wo-flaeche{position:relative;height:${24 * STUNDE}px;margin:0 10px 0 4px}
.wo-linie{position:absolute;left:${ZEIT_SPALTE}px;right:0;border-top:1px solid var(--ink-a07)}
.wo-uhr{position:absolute;left:0;width:${ZEIT_SPALTE - 6}px;text-align:right;font-size:10px;font-weight:600;color:var(--muted-light);font-variant-numeric:tabular-nums;transform:translateY(-50%)}
.wo-spalten{position:absolute;left:${ZEIT_SPALTE}px;right:0;top:0;bottom:0;display:grid;grid-template-columns:repeat(7,1fr)}
.wo-spalte{position:relative;border-left:1px solid var(--ink-a05);cursor:pointer}
.wo-spalte[data-heute="1"]{background:var(--green-a05, rgba(47,158,103,.05))}
.wo-busy{position:absolute;left:1px;right:1px;border-radius:6px;background:var(--ink-a05);pointer-events:none;overflow:hidden}
.wo-busy span{display:block;padding:3px 4px;font-size:9px;font-weight:600;color:var(--muted);line-height:1.2;overflow:hidden;word-break:break-word}
.wo-meet{position:absolute;box-sizing:border-box;border:0;margin:0;appearance:none;cursor:pointer;text-align:left;padding:4px 4px 3px;border-radius:7px;background:var(--surface);box-shadow:inset 3px 0 0 var(--green),0 1px 2px var(--shadow-08);color:var(--ink);font-family:inherit;display:flex;flex-direction:column;align-items:flex-start;gap:2px;overflow:hidden;z-index:2}
.wo-meet.wo-loop{box-shadow:inset 3px 0 0 var(--kalender-punkt),0 1px 2px var(--shadow-08)}
.wo-meet.wo-aktiv{background:var(--green-a16)}
.wo-meet.wo-offen{box-shadow:inset 3px 0 0 var(--green);-webkit-mask-image:linear-gradient(180deg,#000 45%,transparent);mask-image:linear-gradient(180deg,#000 45%,transparent)}
.wo-meet.wo-loop.wo-offen{box-shadow:inset 3px 0 0 var(--kalender-punkt)}
.wo-meet .wo-zeichen{display:flex;pointer-events:none;padding-left:2px}
.wo-meet .wo-titel{pointer-events:none;font-size:10px;font-weight:650;line-height:1.2;letter-spacing:-.01em;-webkit-hyphens:auto;hyphens:auto;overflow-wrap:anywhere;padding-left:2px}
.wo-jetzt{position:absolute;left:-1px;right:0;height:0;border-top:2px solid var(--green);z-index:3;pointer-events:none}
.wo-jetzt::before{content:'';position:absolute;left:-4px;top:-5px;width:8px;height:8px;border-radius:50%;background:var(--green)}
.wo-ohne{display:grid;grid-template-columns:${ZEIT_SPALTE}px repeat(7,1fr);padding:0 10px 6px 4px;flex:none}
.wo-ohne .wo-ohne-tag{display:flex;flex-wrap:wrap;justify-content:center;gap:3px}
.wo-ohne button{border:0;appearance:none;padding:0;background:transparent;cursor:pointer;display:flex}
.wo-ohne .wo-ohne-wort{font-size:9.5px;font-weight:600;color:var(--muted-light);align-self:center;text-align:right;padding-right:6px}
@media (prefers-color-scheme: dark){:root:not([data-theme="light"]){--kalender-punkt:#6392e3}}
`;

function wocheStilEinsetzen() {
  if (typeof document === 'undefined' || !document.head || document.getElementById('mb-woche-stil')) return;
  const stil = document.createElement('style');
  stil.id = 'mb-woche-stil';
  stil.textContent = WOCHE_STIL;
  document.head.appendChild(stil);
}
// Schon beim Laden: Die Nachbarseite in der Tab-Bahn wird gezeichnet, ohne gebunden zu werden.
wocheStilEinsetzen();

function minuten(zeit) {
  const treffer = /^(\d{1,2}):(\d{2})/.exec(String(zeit || ''));
  if (!treffer) return null;
  const wert = Number(treffer[1]) * 60 + Number(treffer[2]);
  return wert >= 0 && wert <= 24 * 60 ? wert : null;
}

const px = (min) => Math.round((min * STUNDE) / 60);

// Beginn und Ende eines Eintrags in Minuten. ende null = kein festes Ende (läuft aus).
function zeitspanne(meet) {
  const beginn = minuten(meet.loop ? (meet.loop.time || meet.time) : meet.time);
  if (beginn === null) return null;
  let ende = minuten(meet.loop ? (meet.loop.endTime || meet.endTime) : meet.endTime);
  if (ende !== null && ende <= beginn) ende = 24 * 60;       // über Mitternacht: bis zum Tagesende
  return { beginn, ende };
}

// Überlappende Blöcke eines Tages nebeneinander: jede Gruppe teilt sich die Spaltenbreite.
function bahnenVerteilen(bloecke) {
  bloecke.sort((a, b) => a.beginn - b.beginn || b.bis - a.bis);
  let gruppe = [];
  let gruppeBis = -1;
  const abschliessen = () => { const n = Math.max(...gruppe.map((b) => b.bahn)) + 1; gruppe.forEach((b) => { b.bahnen = n; }); gruppe = []; };
  for (const block of bloecke) {
    if (gruppe.length && block.beginn >= gruppeBis) { abschliessen(); gruppeBis = -1; }
    const belegt = new Set(gruppe.filter((b) => b.bis > block.beginn).map((b) => b.bahn));
    let bahn = 0;
    while (belegt.has(bahn)) bahn += 1;
    block.bahn = bahn;
    gruppe.push(block);
    gruppeBis = Math.max(gruppeBis, block.bis);
  }
  if (gruppe.length) abschliessen();
  return bloecke;
}

// Busy-Fenster eines Tages ({ tage, von, bis, titel, privat }, tage wie Date.getDay()). Ein Fenster
// über Mitternacht (bis ≤ von) gehört bis 24 Uhr zu seinem Tag und ab 0 Uhr zum nächsten.
function busyAmTag(fenster, iso) {
  const tag = fromISODate(iso).getDay();
  const vortag = (tag + 6) % 7;
  const teile = [];
  for (const f of fenster) {
    const von = minuten(f.von);
    const bis = minuten(f.bis);
    if (von === null || bis === null) continue;
    const tage = Array.isArray(f.tage) ? f.tage : [];
    if (tage.includes(tag)) teile.push({ von, bis: bis > von ? bis : 24 * 60, titel: f.titel });
    if (bis <= von && bis > 0 && tage.includes(vortag)) teile.push({ von: 0, bis, titel: f.titel });
  }
  return teile;
}

function wocheMontag(ui) {
  return weekStart(ui.day);
}

// Wo das Raster beim Öffnen steht: diese Woche um die aktuelle Uhrzeit, sonst kurz vor dem ersten
// Meet der Woche, sonst um 8 Uhr.
function startMinute(ctx, opts, montag, eintraege) {
  const tage = weekDays(montag);
  if (tage.includes(toISODate(now()))) {
    const jetzt = now();
    return Math.max(0, jetzt.getHours() * 60 + jetzt.getMinutes() - 90);
  }
  let frueh = null;
  for (const iso of tage) {
    for (const meet of eintraege(iso)) {
      const spanne = zeitspanne(meet);
      if (spanne && (frueh === null || spanne.beginn < frueh)) frueh = spanne.beginn;
    }
  }
  return frueh === null ? 8 * 60 : Math.max(0, frueh - 45);
}

function meetBlockHtml(meet, block) {
  const breite = 100 / block.bahnen;
  const offen = block.ende === null;
  const hoehe = offen ? px(OHNE_ENDE_MIN) : Math.max(KUERZESTER_BLOCK, px(block.ende - block.beginn) - 2);
  const klassen = ['wo-meet', meet.loop ? 'wo-loop' : '', offen ? 'wo-offen' : '', meet.status === 'active' ? 'wo-aktiv' : ''].filter(Boolean).join(' ');
  const zeit = meet.loop ? (meet.loop.time || meet.time) : meet.time;
  const label = `${meet.title}, ${zeit}${offen ? '' : `–${meet.loop ? (meet.loop.endTime || meet.endTime) : meet.endTime}`}`;
  const farbe = meet.loop ? 'var(--kalender-punkt)' : 'var(--green-dark)';
  return `<button class="${klassen}" data-act="mb-open-meet" data-meet="${esc(meet.id)}" data-date="${block.iso}" data-beginn="${block.beginn}"${offen ? ' data-ohne-ende="1"' : ''} aria-label="${esc(label)}" style="top:${px(block.beginn) + 1}px;height:${hoehe}px;left:calc(${(breite * block.bahn).toFixed(3)}% + 1px);width:calc(${breite.toFixed(3)}% - 2px)"><span class="wo-zeichen">${meetIconSvg(meet, farbe, 13)}</span><span class="wo-titel">${esc(meet.title)}</span></button>`;
}

function wocheBody(ctx, ui, opts) {
  const eintraege = tagesEintraege(ctx, opts);
  const montag = wocheMontag(ui);
  const tage = weekDays(montag);
  const heute = toISODate(now());
  const belegt = typeof ctx.repo.getBelegt === 'function' ? (ctx.repo.getBelegt() || []) : [];

  const arrow = (delta) => `<button data-act="mb-week" data-delta="${delta}" data-treffer aria-label="${esc(delta < 0 ? t('Vorige Woche') : t('Nächste Woche'))}" style="width:32px;height:32px;border-radius:50%;background:var(--surface);border:1.5px solid var(--ink-a10);display:flex;align-items:center;justify-content:center;padding:0;cursor:pointer;appearance:none;flex:none">${symbol(delta < 0 ? 'zurueck' : 'vor', 'var(--ink-soft)', 16)}</button>`;
  const dieseWoche = tage.includes(heute);
  const heuteChip = dieseWoche ? '' : `<button data-act="mb-today" data-role="mb-today" data-treffer style="display:flex;align-items:center;gap:6px;height:28px;padding:0 11px 0 9px;border-radius:999px;background:var(--field);border:0;cursor:pointer;appearance:none;flex:none;font:650 12px/1 'Instrument Sans',sans-serif;color:var(--green-dark);white-space:nowrap"><span style="width:6px;height:6px;border-radius:50%;background:var(--green);pointer-events:none"></span><span style="pointer-events:none">${esc(t('Heute'))}</span></button>`;
  // Die Wochenauswahl: der Monat der Woche (gezählt am Donnerstag — so gehört eine Woche über den
  // Monatswechsel dem Monat, in dem die meisten ihrer Tage liegen). Ein Tipp öffnet das Monatsblatt.
  const navZeile = `<div style="display:flex;justify-content:space-between;align-items:center;gap:8px;padding:10px 20px 2px;flex:none">
${arrow(-7)}
<div style="display:flex;align-items:center;gap:6px;min-width:0">
<button data-act="mb-picker-open" data-role="mb-wochenwahl" style="border:0;background:transparent;padding:2px 6px;cursor:pointer;appearance:none;font-family:'Bricolage Grotesque',sans-serif;font-size:17px;font-weight:650;color:var(--ink);white-space:nowrap;display:flex;align-items:center;gap:5px"><span data-kw-label="1" style="pointer-events:none">${monatUndJahr(fromISODate(addDays(montag, 3)))}</span><span style="pointer-events:none;display:flex">${symbol('ab', 'var(--muted-light)', 12)}</span></button>
${heuteChip}
</div>
${arrow(7)}
</div>`;

  const kopf = `<div class="wo-kopf" data-role="wo-kopf"><span></span>${tage.map((iso) => `<button class="wo-tag" data-act="mb-wahl" data-date="${iso}" aria-pressed="${ui.wahl === iso}"${iso === heute ? ' data-heute="1"' : ''} aria-label="${esc(`${weekdayLong(iso)}, ${tagUndMonat(fromISODate(iso))}`)}"><span class="wo-wd" style="pointer-events:none">${weekdayShort(iso)}</span><span class="wo-nr" style="pointer-events:none">${fromISODate(iso).getDate()}</span></button>`).join('')}</div>`;

  // Einträge ohne Uhrzeit (noch offen) haben keinen Platz im Raster — sie stehen als Zeichen in
  // einer Zeile unter den Tagen, nur wenn es sie gibt.
  const ohneZeit = tage.map((iso) => eintraege(iso).filter((meet) => !zeitspanne(meet)));
  const ohneZeile = ohneZeit.some((liste) => liste.length)
    ? `<div class="wo-ohne" data-role="wo-ohne-zeit"><span class="wo-ohne-wort">${esc(t('offen'))}</span>${ohneZeit.map((liste, i) => `<span class="wo-ohne-tag">${liste.map((meet) => `<button data-act="mb-open-meet" data-meet="${esc(meet.id)}" data-date="${tage[i]}" aria-label="${esc(`${meet.title}, ${t('Zeit offen')}`)}">${meetKachel(meet, 22)}</button>`).join('')}</span>`).join('')}</div>`
    : '';

  const linien = Array.from({ length: 23 }, (_, i) => i + 1).map((h) => `<div class="wo-linie" style="top:${h * STUNDE}px"></div><span class="wo-uhr" style="top:${h * STUNDE}px">${String(h).padStart(2, '0')}:00</span>`).join('');

  const spalten = tage.map((iso) => {
    const busy = busyAmTag(belegt, iso).map((b) => `<div class="wo-busy" data-role="wo-busy" style="top:${px(b.von)}px;height:${Math.max(4, px(b.bis - b.von))}px">${b.titel && px(b.bis - b.von) >= 22 ? `<span>${esc(b.titel)}</span>` : ''}</div>`).join('');
    const bloecke = bahnenVerteilen(eintraege(iso)
      .map((meet) => ({ meet, spanne: zeitspanne(meet) }))
      .filter((e) => e.spanne)
      .map((e) => ({ meet: e.meet, iso, beginn: e.spanne.beginn, ende: e.spanne.ende, bis: e.spanne.ende === null ? e.spanne.beginn + OHNE_ENDE_MIN : Math.max(e.spanne.ende, e.spanne.beginn + 30) })));
    const meets = bloecke.map((b) => meetBlockHtml(b.meet, b)).join('');
    let jetzt = '';
    if (iso === heute) {
      const d = now();
      jetzt = `<div class="wo-jetzt" data-role="wo-jetzt" style="top:${px(d.getHours() * 60 + d.getMinutes())}px"></div>`;
    }
    return `<div class="wo-spalte" data-act="mb-wahl" data-date="${iso}" data-spalte="${iso}"${iso === heute ? ' data-heute="1"' : ''}>${busy}${meets}${jetzt}</div>`;
  }).join('');

  const start = startMinute(ctx, opts, montag, eintraege);
  return `<div data-woche="1" data-montag="${montag}">
${navZeile}
${kopf}
${ohneZeile}
<div class="wo-raster" data-role="wo-raster" data-start="${px(start)}"><div class="wo-flaeche">${linien}<div class="wo-spalten">${spalten}</div></div></div>
</div>`;
}

// Das Raster auf seine Startstelle stellen — einmal je Woche, damit ein Tipp (der neu zeichnet) die
// Lage nicht zurücksetzt. Die Merkfahne ist eine JS-Eigenschaft, kein data-Attribut (der Abgleich in
// core/html.js liest data-Merkmale als Rolle).
function rasterStellen(seite) {
  const raster = seite?.querySelector?.('[data-role="wo-raster"]');
  const woche = raster?.closest('[data-woche]')?.dataset.montag;
  if (!raster || !woche || raster.__woche === woche) return;
  raster.__woche = woche;
  raster.scrollTop = Number(raster.dataset.start) || 0;
}

// Zeigerwege kommen in VIEWPORT-Pixeln an, die Leisten rechnen aber in Phone-Pixeln.
// In der skalierten Desktop-Vorschau (.runtime-phone{transform:scale(.72)}) sind das zwei
// verschiedene Maßstäbe: ein Mausweg von 95 px entspricht dort 132 Phone-Pixeln. Ohne
// Umrechnung liefe die Leiste dem Zeiger hinterher und die Einrast-Schwelle wäre bei
// Maus und Finger verschieden. Der Faktor kommt aus dem Element selbst (gerenderte Breite
// gegen Layoutbreite) und stimmt deshalb bei jeder Skalierung.
function phoneFaktor(node) {
  const gerendert = node.getBoundingClientRect().width;
  const layout = node.offsetWidth;
  if (!gerendert || !layout) return 1;
  return layout / gerendert;
}

// v7 A30b (spec/05 §6): Jahresauswahl als echtes horizontales Control — dieselbe Mechanik
// wie die Wochenleiste, nur mit fester Schrittweite YEAR_STEP. Ruhelage ist translateX(-50%);
// die Bahn hat ungerade viele gleich breite Zellen mit dem gewählten Jahr in der Mitte,
// deshalb liegt dieses Jahr bei JEDER Pickerbreite exakt auf der Pickermitte.
function bindYearRow(root, ctx, ui) {
  const row = root.querySelector('[data-yearrow]');
  // Die Merkfahne ist bewusst eine JS-EIGENSCHAFT und kein data-Attribut: der Abgleich
  // in core/html.js liest die data-Merkmale eines Knotens als seine Rolle. Ein zur
  // Laufzeit gesetztes data-Attribut, das im Markup fehlt, wuerde die Rolle veraendern —
  // die Zeile wuerde bei JEDEM Rendern ersetzt statt abgeglichen und der Zug stuerbe
  // mitten in der Geste. Eine Eigenschaft sieht der Abgleich gar nicht.
  if (!row || row.__jahrGebunden) return;
  const track = row.querySelector('[data-yearrow-track]');
  if (!track) return;
  row.__jahrGebunden = true;

  let start = null;
  let mode = null;

  const shift = (dx) => { track.style.transition = 'none'; track.style.transform = `translateX(calc(-50% + ${dx}px))`; };
  const settle = () => { track.style.transition = 'transform .16s ease'; track.style.transform = 'translateX(-50%)'; };

  const begin = (x, y) => { start = { x, y }; mode = null; };

  const moveTo = (x, y) => {
    if (!start || mode === 'reject') return false;
    const dx = x - start.x;
    const dy = y - start.y;
    if (mode === null) {
      if (Math.abs(dy) > 12 && Math.abs(dy) > Math.abs(dx)) { mode = 'reject'; return false; }
      if (Math.abs(dx) <= 5) return false;
      mode = 'drag';
    }
    // Nur bis zum äußersten gerenderten Jahr — dahinter gibt es nichts zu zeigen.
    const limit = YEAR_STEP * ((YEAR_SPAN.length - 1) / 2);
    const lokal = dx * phoneFaktor(row);
    shift(Math.max(-limit, Math.min(limit, lokal)));
    return true;
  };

  const finish = (x) => {
    if (!start) { mode = null; return; }
    const dx = (x - start.x) * phoneFaktor(row);
    const wasDrag = mode === 'drag';
    start = null;
    mode = null;
    if (!wasDrag) return;
    swallowNextClick(row);
    // Nach rechts ziehen holt frühere Jahre in die Mitte — deshalb das negative Vorzeichen.
    const schritte = -Math.round(dx / YEAR_STEP);
    if (schritte === 0) { settle(); return; }
    ui.picker.year += schritte;
    ctx.render();
  };

  row.addEventListener('pointerdown', (event) => {
    if (event.pointerType === 'touch') return;
    if (event.button !== undefined && event.button !== 0) return;
    begin(event.clientX, event.clientY);
  });
  row.addEventListener('pointermove', (event) => {
    if (event.pointerType === 'touch') return;
    if (!moveTo(event.clientX, event.clientY)) return;
    event.preventDefault();
    try { row.setPointerCapture(event.pointerId); } catch { /* egal */ }
  });
  row.addEventListener('pointerup', (event) => {
    if (event.pointerType === 'touch') return;
    finish(event.clientX);
  });
  row.addEventListener('pointercancel', (event) => {
    if (event.pointerType === 'touch') return;
    if (mode === 'drag') settle();
    start = null; mode = null;
  });

  row.addEventListener('touchstart', (event) => {
    if (event.touches.length !== 1) { start = null; mode = 'reject'; return; }
    const touch = event.touches[0];
    begin(touch.clientX, touch.clientY);
  }, { passive: false });
  row.addEventListener('touchmove', (event) => {
    if (event.touches.length !== 1) return;
    const touch = event.touches[0];
    if (!moveTo(touch.clientX, touch.clientY)) return;
    event.preventDefault();
    event.stopPropagation();
  }, { passive: false });
  row.addEventListener('touchend', (event) => {
    const touch = event.changedTouches[0];
    finish(touch ? touch.clientX : (start ? start.x : 0));
  });
  row.addEventListener('touchcancel', () => {
    if (mode === 'drag') settle();
    start = null; mode = null;
  });
}

// --- Datums-Picker (reference 05.3: Jahr, Monat, Monatskalender, genau ein Tag) ---

function datePicker(ctx, ui, opts) {
  const { year, month } = ui.picker;
  const selDate = fromISODate(ui.day);

  // v7 A30b (spec/05 §6): Die Jahreszeile war eine statische Reihe aus drei Elementen mit
  // ±1-Knöpfen — ein echter Zug bewegte gemessen nichts (kein data-hdrag, touch-action auto).
  // Jetzt ist sie eine ziehbare Bahn mit fester Schrittweite. Weil die Bahn eine ungerade
  // Zahl gleich breiter Zellen hat und das gewählte Jahr die MITTLERE ist, hält
  // `left:50% / translateX(-50%)` das gewählte Jahr bei jeder Breite exakt auf der
  // Pickermitte — auch während des Zugs, der nur den Offset dahinter verschiebt.
  const yearCell = (value) => {
    const selected = value === year;
    const inner = selected
      ? `background:${SEL_TINT};box-shadow:${SEL_RING};color:${SEL_TEXT};font-size:14px;font-weight:650;padding:6px 16px;border-radius:999px`
      : 'color:var(--muted-light);font-size:13px;font-weight:600;padding:6px 8px';
    return `<button data-act="mb-picker-year-set" data-year="${value}" aria-pressed="${selected}" aria-label="${esc(t('Jahr {jahr}', { jahr: value }))}" style="width:${YEAR_STEP}px;flex:none;border:0;background:transparent;padding:0;cursor:pointer;appearance:none;display:flex;justify-content:center;font-family:'Instrument Sans',sans-serif"><span style="pointer-events:none;display:block;white-space:nowrap;${inner}">${value}</span></button>`;
  };
  // Ein weicher Auslauf an beiden Enden: die angeschnittenen Nachbarjahre wirken damit
  // wie eine weiterlaufende Bahn und nicht wie abgeschnittener Text.
  const yearFade = (side) => `<span style="position:absolute;${side}:0;top:0;bottom:0;width:42px;pointer-events:none;background:linear-gradient(to ${side === 'left' ? 'right' : 'left'},var(--surface) 32%,rgba(255,255,255,0))"></span>`;
  const yearRow = `<div data-hdrag="years" data-yearrow="1" role="group" aria-label="${esc(t('Jahr wählen'))}" style="position:relative;height:34px;overflow:hidden;touch-action:none;font-variant-numeric:tabular-nums">
<div data-yearrow-track="1" style="position:absolute;left:50%;top:0;height:100%;display:flex;align-items:center;transform:translateX(-50%);will-change:transform">${YEAR_SPAN.map((delta) => yearCell(year + delta)).join('')}</div>
${yearFade('left')}${yearFade('right')}
</div>`;

  const monthCell = (index) => {
    const selected = index === month;
    // v6 A08c: gewählter Monat = getönte Fläche mit Kontur statt schwarzer Vollfläche.
    const style = selected
      ? `background:${SEL_TINT};box-shadow:${SEL_RING};color:${SEL_TEXT};font-weight:650;border-radius:999px`
      : 'color:var(--ink-soft)';
    return `<button data-act="mb-picker-month" data-month="${index}" style="border:0;background:transparent;appearance:none;cursor:pointer;padding:0;font-family:'Instrument Sans',sans-serif"><span style="pointer-events:none;display:block;padding:7px 0;font-size:11px;font-weight:600;${style}">${monatKurz(index)}</span></button>`;
  };
  const monthRows = `<div style="display:flex;flex-direction:column;gap:4px;border-top:1px solid var(--ink-a07);padding-top:11px">
<div style="display:grid;grid-template-columns:repeat(6,1fr);gap:3px;text-align:center;align-items:center">${[0, 1, 2, 3, 4, 5].map(monthCell).join('')}</div>
<div style="display:grid;grid-template-columns:repeat(6,1fr);gap:3px;text-align:center;align-items:center">${[6, 7, 8, 9, 10, 11].map(monthCell).join('')}</div>
</div>`;

  // Tage: außerhalb des Monats stumm-grau (kein Ziel), heute hellgrün gefüllt,
  // Auswahl hell getönt mit grüner Kontur (v6 A08c), beides zusammen kräftig grün.
  //
  // v7 A30a (spec/05 §6): Der Picker zeigte 42 Tageszahlen und NULL Punkte, obwohl die
  // Wochenleiste im selben Screen an denselben Tagen Meets und Loops markierte. Ursache
  // war der fehlende Kontext — datePicker() bekam `opts` gar nicht und konnte dayMeets()
  // deshalb nicht fragen. Jetzt hat jede Zelle denselben Aufbau (Kreis + feste Punktzeile),
  // damit die Zeilenhöhe unabhängig davon stabil bleibt, ob ein Tag Punkte trägt.
  const dayCell = (iso) => {
    const date = fromISODate(iso);
    const inMonth = date.getMonth() === month && date.getFullYear() === year;
    const digits = date.getDate();
    // v3.1 §7: Ein Tag aus dem Nachbarmonat ist wählbar — die Monatsansicht springt dabei mit.
    const selected = inMonth && date.getFullYear() === selDate.getFullYear()
      && date.getMonth() === selDate.getMonth() && digits === selDate.getDate();
    const today_ = isToday(iso);
    let circle = '';
    let color = inMonth ? 'var(--ink)' : 'var(--line-solid)';
    let weight = 600;
    // Runde 8 (R8-23): dieselben Punkte wie in der Wochenleiste — eine Farbe, einer je Meet. Sie
    // stehen hier UNTER dem Kreis auf dem weißen Blatt, am gewählten heutigen Tag also ebenfalls
    // blau (weiß wären sie dort unsichtbar — so war es bisher).
    const punkt = 'var(--kalender-punkt)';
    let punktDeckkraft = 1;
    if (selected && today_) {
      circle = 'background:var(--green);'; color = 'var(--on-accent)'; weight = 650;
    } else if (selected) {
      circle = `background:${SEL_TINT};box-shadow:${SEL_RING};`; color = SEL_TEXT; weight = 650;
    } else if (inMonth && today_) {
      circle = `background:${TODAY_TINT};`; color = TODAY_TEXT; weight = 650;
    }
    // Tage aus dem Nachbarmonat sind leiser — ihre Punkte auch, sonst zöge der Rand des
    // Rasters mehr Aufmerksamkeit auf sich als der Monat selbst.
    if (!inMonth) punktDeckkraft = 0.45;
    const entries = dayMeets(ctx, opts, iso);
    const punkte = `<span style="width:4px;height:4px;border-radius:50%;background:${punkt};opacity:${punktDeckkraft}"></span>`.repeat(Math.min(PUNKTE_HOECHSTENS, entries.length));
    return `<button data-act="mb-picker-day" data-date="${iso}" aria-pressed="${selected}" style="border:0;background:transparent;appearance:none;cursor:pointer;padding:1px 0 2px;display:flex;flex-direction:column;align-items:center;gap:1px;font-family:'Instrument Sans',sans-serif;font-size:11.5px;font-weight:600;font-variant-numeric:tabular-nums"><span style="pointer-events:none;width:26px;height:26px;border-radius:50%;display:flex;align-items:center;justify-content:center;color:${color};font-weight:${weight};${circle}">${digits}</span><span style="height:4px;display:flex;gap:2px;align-items:center;pointer-events:none">${punkte}</span></button>`;
  };
  const start = weekStart(toISODate(new Date(year, month, 1)));
  const cells = Array.from({ length: 42 }, (_, index) => addDays(start, index));
  const weekRows = Array.from({ length: 6 }, (_, row) => `<div style="display:grid;grid-template-columns:repeat(7,1fr);gap:2px;text-align:center;font-size:11.5px;font-weight:600;align-items:center">${cells.slice(row * 7, row * 7 + 7).map(dayCell).join('')}</div>`).join('');
  const calendar = `<div style="display:flex;flex-direction:column;gap:2px;border-top:1px solid var(--ink-a07);padding-top:12px;font-variant-numeric:tabular-nums">
<div style="display:grid;grid-template-columns:repeat(7,1fr);gap:2px;text-align:center;font-size:10px;font-weight:650;color:var(--muted-light)">${wochenInitialen().map((b) => `<span>${b}</span>`).join('')}</div>
${weekRows}
</div>`;

  // Eigenes Control (v3.1 Gesten-Priorität): data-hdrag hält den horizontalen Drag im Picker.
  return `<div style="position:absolute;inset:0;z-index:14">
<div data-act="mb-picker-close" style="position:absolute;inset:0;background:var(--scrim);-webkit-backdrop-filter:var(--scrim-filter);backdrop-filter:var(--scrim-filter)"></div>
<div data-hdrag="picker" style="position:absolute;left:26px;right:26px;top:158px;background:var(--surface);border-radius:26px;padding:20px;display:flex;flex-direction:column;gap:13px;box-shadow:0 18px 44px var(--shadow-30)">
${yearRow}
${monthRows}
${calendar}
</div>
</div>`;
}

// Nach einem echten Zug darf der folgende Klick nichts auslösen: sonst öffnet der Zug
// zusätzlich das, worauf er begann.
function swallowNextClick(node) {
  const blocker = (event) => { event.stopPropagation(); event.preventDefault(); };
  node.addEventListener('click', blocker, { capture: true });
  window.setTimeout(() => node.removeEventListener('click', blocker, { capture: true }), 350);
}

// --- Gemeinsamer Browser-Body (Export, FRAMEWORK „Geteilte Bereichs-APIs") ---

// Bausteine für screenScaffold (v3.1).
//   header        — Titel, Umschalter Liste/Woche, „+" ('' eingebettet: dort trägt der Aufrufer die Kopfzeile)
//   body          — die Liste (Standard) oder die Woche
//   cta           — „+ Meet" für die Bottom-Ebene ('' wenn der Kontext keine neuen Meets erlaubt oder
//                   der Kopf den „+" trägt)
//   overlays      — Monatsblatt (höchste Ebene)
//   bottomInset   — Freiraum, wenn der Screen zusätzlich die Bottom-Navigation trägt
//   contentInset  — Freiraum ohne Bottom-Navigation (eingebettete Verwendung)
export function meetBrowserParts(ctx, opts = {}) {
  const ui = browserUi(ctx, opts);
  const key = opts.uiKey || 'meetBrowser';

  // „+ Meet" überall dort, wo neue Meets entstehen dürfen und der Kopf keinen „+" trägt. Der
  // Verlauf („Meine Meets") bleibt ohne ihn, dort entsteht nichts Neues.
  const wantsCta = !opts.plus && (opts.newMeet ?? (historyMode(opts) !== 'only'));
  // Runde 2 (Jonathan): Ohne Freunde kann man kein Meet anlegen — der Knopf ist dann nicht da.
  const hatFreunde = ctx.repo.getPeople().length > 0;
  const cta = wantsCta && hatFreunde ? ctaBar() : '';
  const contentInset = cta ? CTA_INSET : 24;
  const woche = ui.view === 'week';

  return {
    view: ui.view,
    header: browserHeader(ctx, ui, opts),
    body: woche ? wocheBody(ctx, ui, opts) : listBody(ctx, ui, opts),
    cta,
    bottom: cta, // Alias: die Bottom-Ebene des Browsers besteht genau aus dem CTA.
    // Runde 3 (D5): „Freund hinzufügen" als Sheet über dem Browser.
    overlays: `${woche && ui.picker ? datePicker(ctx, ui, opts) : ''}${ctx.freundHinzufuegen?.overlay(ctx) || ''}`,
    scrollKey: `${key}-${ui.view}`,
    contentInset,
    bottomInset: contentInset + TABBAR_INSET,
  };
}

// Runde 6 (Chef, nach P6s Hinweis): Hier stand `renderMeetBrowserBody` — eine Doppelform aus
// String UND Objekt. Es gibt keinen Aufrufer mehr.

export function bindMeetBrowserBody(root, ctx, opts = {}) {
  const ui = browserUi(ctx, opts);
  const { repo, nav } = ctx;

  bindRowDrag(root);
  // Eigenes horizontales Control des Monatsblatts (P0-1: es behält seine Geste).
  bindYearRow(root, ctx, ui);
  if (ui.view === 'week') rasterStellen(root);

  // Eine andere Woche: der gewählte Tag gilt nur in seiner Woche.
  const zuWoche = (iso) => {
    ui.day = iso;
    if (ui.wahl && weekStart(ui.wahl) !== weekStart(iso)) ui.wahl = null;
    ctx.render();
  };

  bindActions(root, {
    ...(ctx.freundHinzufuegen?.aktionen(root, ctx) || {}),
    // R6 D6: die drei Gesichter unter dem vergangenen Meet, „mehr" und das Wegtippen.
    ...bewertungsZeileAktionen(ctx),
    'mb-friend-add': () => (ctx.freundHinzufuegen ? ctx.freundHinzufuegen.oeffnen(ctx) : ctx.nav.go('profile.friendAdd')),
    'mb-view': (data) => {
      if (data.view !== 'list' && data.view !== 'week') return;
      if (ui.view === data.view) return;
      ui.view = data.view;
      ui.picker = null;
      ctx.render();
    },
    'mb-open-meet': (data) => nav.go('meet.details', { meetId: data.meet }),
    'mb-review': (data) => nav.go('meet.review', { meetId: data.meet }),
    // R8-69: In der Woche nimmt der Entwurf den angetippten Tag mit, sonst beginnt er ohne Datum.
    'mb-new-meet': () => entwurfBeginnen(ctx, opts, { date: ui.view === 'week' ? ui.wahl : null }),
    'mb-participation': (data) => {
      const meet = repo.getMeet(data.meet);
      const current = meet?.participation?.[ME];
      const next = current === data.state ? 'open' : data.state;
      repo.setParticipation(data.meet, next);
      ctx.toast?.(PART_TOAST[next] || t('Zusage geändert'));                 // v5 A18
    },
    'mb-loop-response': (data) => {
      repo.setLoopResponse(data.meet, data.date, data.response);
      ctx.toast?.(LOOP_TOAST[data.response] || t('Antwort gespeichert'));    // v5 A18
    },
    'mb-week': (data) => zuWoche(addDays(ui.day, Number(data.delta))),
    'mb-today': () => zuWoche(toISODate(now())),
    // Ein Tag der Woche wird gewählt (Kopf oder freie Stelle seiner Spalte); ein zweiter Tipp
    // auf denselben Tag nimmt die Wahl zurück.
    'mb-wahl': (data) => {
      ui.wahl = ui.wahl === data.date ? null : data.date;
      ctx.render();
    },
    'mb-picker-open': () => {
      const date = fromISODate(ui.day);
      ui.picker = { year: date.getFullYear(), month: date.getMonth() };
      ctx.render();
    },
    'mb-picker-close': () => {
      ui.picker = null;
      ctx.render();
    },
    // v7 A30b: Die Jahresbahn ist ziehbar UND antippbar.
    'mb-picker-year-set': (data) => {
      const jahr = Number(data.year);
      if (!Number.isFinite(jahr) || jahr === ui.picker.year) return;
      ui.picker.year = jahr;
      ctx.render();
    },
    'mb-picker-month': (data) => {
      ui.picker.month = Number(data.month);
      ctx.render();
    },
    // Ein Tag im Monatsblatt wählt seine Woche — und ist darin gleich gewählt.
    'mb-picker-day': (data) => {
      ui.picker = null;
      ui.wahl = data.date;
      zuWoche(data.date);
    },
  });
}

// --- Route meet.home (v3.1: screenScaffold, history 'off') ---

// Runde 8c (R8-69): Keine FREE-Reihe mehr im Meet-Tab — der Weg zum neuen Meet ist der runde „+"
// im Kopf (plus: true), wie im Crew-Tab. Die untere Ebene ist leer; die Liste läuft bis an die
// Navigation und blendet dort weich aus.
const HOME_OPTS = { context: {}, uiKey: 'meetHome', title: t('Meet'), history: 'off', plus: true };

function renderMeetHome(ctx) {
  const parts = meetBrowserParts(ctx, HOME_OPTS);
  const html = screenScaffold({
    page: true,
    header: parts.header,
    body: parts.body,
    bottom: '',
    bottomInset: parts.view === 'week' ? 0 : 24,
    bottomFadeHeight: parts.view === 'week' ? 0 : 30,
    overlays: parts.overlays,
    scrollKey: parts.scrollKey,
  });
  return {
    html,
    bind: (root, boundCtx) => bindMeetBrowserBody(root, boundCtx, HOME_OPTS),
    // Die Nachbarseite in der Tab-Bahn wird nicht gebunden — die Woche soll trotzdem schon beim
    // Hinwischen auf ihrer Uhrzeit stehen, nicht um Mitternacht.
    vorschau: (seite) => rasterStellen(seite),
  };
}

export const meetBrowserScreens = {
  'meet.home': renderMeetHome,
};
