// Bereich Meet-Browser (reference/current 05.1–05.5b, Korrektur v2/v14, Runtime-Grammatik v3.1):
// der EINE Meet-Browser mit Liste, einziger Kalenderansicht (KW-Kopf + Tagesleiste + Tagesliste),
// Datums-Picker und stilisierter Meet-Karte inkl. Stack-Deck. Wird identisch von Meet-Tab,
// Meine Meets, Alle Meets (Raum) und Person-Meets verwendet.
//
// ÖFFENTLICHE API (FRAMEWORK „Geteilte Bereichs-APIs")
//
//   opts = {
//     context: {} | { crewId } | { personId } | { mine:true },   // Datenkontext (repo)
//     uiKey:   string,                    // eigener ui-Zustand je Aufrufer
//     title?:  string,                    // Kopfzeilentitel (' ' = nur Umschalter zeigen)
//     back?:   boolean,                   // Zurück-Knopf in der Kopfzeile
//     history?: 'off' | 'switch' | 'only',// v3.1 §3 — Default 'switch' (rückwärtskompatibel)
//     newMeet?: boolean,                  // „+ Meet"-CTA (Default: history !== 'only')
//   }
//
//   history: 'off'    → nur Kommendes/Aktives, KEIN Kommend/Verlauf-Umschalter (Meet-Tab)
//            'switch' → Umschalter sichtbar (Raum / 1:1-Raum, room.allMeets)
//            'only'   → nur Verlauf, kein Umschalter (Profil → Meine Meets)
//
//   meetBrowserParts(ctx, opts) → { header, body, cta, overlays, scrollKey, contentInset }
//       Bausteine für screenScaffold({header, body, bottom, bottomInset, overlays, scrollKey}).
//       `body` ist EIN Inhaltskörper ohne eigene Scrollfläche (v3.1 §1), `cta` gehört in die
//       Bottom-Ebene, `overlays` (Datums-Picker) auf die höchste Ebene.
//   renderMeetBrowserBody(ctx, opts) → Doppelform für die Übergangszeit: als String
//       (Kopf + Inhalt + „+ Meet" im Fluss + Picker, OHNE eigene Scrollfläche — direkt als
//       screenScaffold-`body` verwendbar) und gleichzeitig als Objekt mit denselben
//       Bausteinen (.header/.body/.bottom/.overlays/.bottomInset/.scrollKey).
//   bindMeetBrowserBody(root, ctx, opts)

import { esc, bindActions, bindRowDrag } from '../core/html.js';
import { activityIconSvg } from '../ui/activity-icons.js';
import { ME } from '../data/ids.js';
import {
  screenScaffold, cardEdgeFade, bottomBar, edgeFadeRow, tabHeader, leerZeile,
} from '../ui/components.js';
import { listIcon, mapIcon, calendarIcon, upcomingIcon, historyIcon, backArrow } from '../ui/icons.js';
import { symbol } from '../ui/symbole.js';
import {
  karteHalten, karteVon, passeAufPunkte, startAnsicht, radAnKarte, ortMarken, grobeZeit, kurzName, KARTEN_SPALTE,
  bedienSpalteOrdnen, kartenLageQuelle,
} from '../ui/map.js';
import { PART_TOAST } from '../ui/meet-panels.js';
import { t, tn } from '../core/sprache.js';
import {
  now, toISODate, fromISODate, addDays, weekStart, weekDays, isoWeek,
  monthLongByIndex, monthLong, isToday, isTomorrow, weekdayShort, weekdayLong,
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
// den Textton var(--ink) als Vollfläche. Ein Stil, zwei Einbauorte (Bottom-Ebene und Fluss),
// damit die beiden Varianten nie auseinanderlaufen.
const NEW_MEET_BUTTON = "border:0;appearance:none;cursor:pointer;background:var(--green);color:var(--on-accent);font:650 14px/1 'Instrument Sans',sans-serif;padding:14px 26px;border-radius:999px;box-shadow:0 8px 22px var(--green-a28)";

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

// Oberkante des Zeitraum-Reglers über der Karte.
const ZEITRAUM_OBEN = 24;

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

// v3.1 §3: Der Kontext bestimmt, welche Richtung überhaupt möglich ist.
// 'off' = nur Kommendes · 'only' = nur Verlauf · 'switch' = beides mit Umschalter.
function historyMode(opts = {}) {
  const mode = opts.history || 'switch';
  return mode === 'off' || mode === 'only' ? mode : 'switch';
}

function browserUi(ctx, opts = {}) {
  const key = opts.uiKey || 'meetBrowser';
  const mode = historyMode(opts);
  if (!ctx.ui[key]) {
    ctx.ui[key] = {
      direction: mode === 'only' ? 'history' : 'upcoming',
      view: 'list',
      day: toISODate(now()),
      picker: null,
      stack: null,
    };
  }
  const ui = ctx.ui[key];
  // Feste Kontexte erzwingen ihre Richtung — auch nach Rerendern oder Altzuständen.
  if (mode === 'off') ui.direction = 'upcoming';
  if (mode === 'only') ui.direction = 'history';
  return ui;
}

// --- Datums-Beschriftungen (echte Daten, deutsch) ---

function fmtDayShort(iso) {
  if (isToday(iso)) return t('Heute');
  if (isTomorrow(iso)) return t('Morgen');
  const date = fromISODate(iso);
  return `${weekdayShort(iso)} ${tagMonatKurz(date)}`;
}

function fmtMapDay(iso) {
  if (isToday(iso)) return t('Heute');
  if (isTomorrow(iso)) return t('Morgen');
  return weekdayShort(iso);
}

// Tageslisten-Überschrift der Kalenderansicht (reference 05.2: „Samstag, 22. August").
function dayLabel(iso) {
  const date = fromISODate(iso);
  return `${weekdayLong(iso)}, ${tagUndMonat(date)}`;
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

// Loop-Karte im horizontalen Strip (reference 05.1: 264px, Controls 26 unten rechts im Fluss).
// v6 A16f: dieselbe geschlossene Karten-Grammatik wie listMeetCard — Zeitpunkt und ORT statt
// Kontextname, kein Teilnehmerstapel. Beide Karten liegen im selben Screen übereinander und
// dürfen nicht zwei verschiedene Sprachen sprechen.
function loopStripCard(ctx, meet) {
  const dateKey = loopNextDate(meet);
  const active = meet.status === 'active' && isToday(dateKey);
  const time = meet.loop.time || meet.time;
  const place = meet.place?.name || t('Ort offen');
  const meta = active
    ? `${t('Heute')} · ${t('seit {zeit}', { zeit: esc(time) })} · ${esc(place)}`
    : `${fmtDayShort(dateKey)} · ${esc(time)} · ${esc(place)}`;
  // Aktiv (v3.1 §5): der grüne Fade kommt radiusgenau aus cardEdgeFade; die eigene Kontur wird
  // transparent, damit keine zweite graue/weiße Linie neben der grünen Haarlinie steht.
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

// Meet-Karte in Liste und Tagesliste (reference 05.1/05.2) — variant 'list' | 'day'.
// options.dateKey: angezeigter Tag (Loop-Antwort in der Tagesliste gilt für diesen Tag).
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

  // Zeitpunkt: in der Tagesliste steht das Datum bereits als Überschrift darüber.
  let when;
  if (active) when = variant === 'day' ? t('seit {zeit}', { zeit: esc(time) }) : `${t('Heute')} · ${t('seit {zeit}', { zeit: esc(time) })}`;
  else if (variant === 'day') when = timeText;
  else when = `${fmtDayShort(meet.date)} · ${timeText}`;

  let meta = `${when} · ${esc(place)}`;
  // Zwei kurze Zustandsworte bleiben: sie stehen sonst nirgends auf der Karte und sind
  // keine Metadaten, sondern ändern die Bedeutung des Meets.
  if (isLoop && variant === 'day') meta += ` · ${t('Loop')}`;
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
    if (!meet.review && !meet.cancelled) {
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

// --- Kopfzeile (reference 05.1/05.2/05.5): Titel + Kommend/Verlauf + Liste/Kalender/Karte ---
// Beide Umschalter rein ikonisch, aktiv weiß; in der Kartenansicht entfällt Kommend/Verlauf.

function headerPill(items, padding) {
  const inner = items.map((item) => {
    const dataAttrs = Object.entries(item.data || {}).map(([key, value]) => `data-${key}="${esc(value)}"`).join(' ');
    return `<button data-act="${item.act}" ${dataAttrs} data-treffer aria-pressed="${item.active}" style="padding:${padding};display:flex;align-items:center;border:0;border-radius:999px;cursor:pointer;appearance:none;${item.active ? 'background:var(--surface);box-shadow:0 1px 3px var(--shadow-08)' : 'background:transparent'}"><span style="pointer-events:none;display:flex">${item.svg}</span></button>`;
  }).join('');
  return `<div style="background:var(--field);border-radius:999px;padding:3px;display:flex;flex:none">${inner}</div>`;
}

function browserHeader(ctx, ui, opts) {
  const title = opts.title || t('Meet');
  const isMap = ui.view === 'map';
  const lead = opts.back
    ? `<button data-act="back" data-treffer aria-label="${esc(t('Zurück'))}" style="width:32px;height:32px;border-radius:50%;background:var(--surface);border:1.5px solid var(--ink-a10);display:flex;align-items:center;justify-content:center;padding:0;cursor:pointer;appearance:none;flex:none"><span style="pointer-events:none;display:flex">${backArrow('var(--ink)', 16)}</span></button>`
    : '';
  const dirColor = (key) => (ui.direction === key ? 'var(--ink)' : 'var(--muted-light)');
  const viewColor = (key) => (ui.view === key ? 'var(--ink)' : 'var(--muted-light)');
  // v3.1 §3: Der Umschalter existiert nur im Modus 'switch' (Raum/1:1-Raum).
  // Meet-Tab ('off') und Meine Meets ('only') haben genau einen Kontext.
  const directionPill = (isMap || historyMode(opts) !== 'switch') ? '' : headerPill([
    { act: 'mb-direction', data: { direction: 'upcoming' }, svg: upcomingIcon(dirColor('upcoming'), 15), active: ui.direction === 'upcoming' },
    { act: 'mb-direction', data: { direction: 'history' }, svg: historyIcon(dirColor('history'), 15), active: ui.direction === 'history' },
  ], '6px 10px');
  // Runde 3 (Jonathan): „Die Auswahl ‚Heute' verschiebt das Datum ein wenig. Mach ‚Heute' neben
  // den Umschalter Liste/Kalender/Karte." Der Knopf steht in der Kopfzeile links neben dem
  // Umschalter, nur da, wenn der Kalender gerade NICHT beim heutigen Tag steht, und wächst nach
  // links in freien Platz — Umschalter und Monat bleiben, wo sie sind.
  // Runde 4 (Jonathan): „Mach den Heute-Button ausgeschrieben." Statt des Punkts steht das Wort —
  // der Punkt in der Farbe von „heute" bleibt als kleines Zeichen davor.
  const heuteKnopf = ui.view === 'calendar'
    ? `<button data-act="mb-today" data-role="mb-today" data-treffer${isToday(ui.day) ? ' hidden' : ''} style="display:${isToday(ui.day) ? 'none' : 'flex'};align-items:center;gap:7px;height:36px;box-sizing:border-box;padding:0 14px 0 12px;border-radius:999px;background:var(--field);border:0;cursor:pointer;appearance:none;flex:none;font:650 13.5px/1 'Instrument Sans',sans-serif;color:var(--green-dark);white-space:nowrap"><span style="width:7px;height:7px;border-radius:50%;background:var(--green);box-shadow:0 0 0 3px var(--green-a20);pointer-events:none"></span><span style="pointer-events:none">${esc(t('Heute'))}</span></button>`
    : '';
  const viewPill = headerPill([
    { act: 'mb-view', data: { view: 'list' }, svg: listIcon(viewColor('list'), 16), active: ui.view === 'list' },
    { act: 'mb-view', data: { view: 'calendar' }, svg: calendarIcon(viewColor('calendar'), 16), active: ui.view === 'calendar' },
    { act: 'mb-view', data: { view: 'map' }, svg: mapIcon(viewColor('map'), 16), active: ui.view === 'map' },
  ], '7px 14px'); // Runde 4 (C3): 16 px Zeichen + 28 px = 44 px je Segment (vorher 38)
  // v4 A.4: dieselbe Kopfachse wie Crew und Profil — Padding, Höhe und Ausrichtung
  // kommen aus tabHeader, damit beim Tabwechsel nichts springt.
  return tabHeader(
    `<span style="display:flex;align-items:center;gap:10px;min-width:0">${lead}<span style="font-family:'Bricolage Grotesque',sans-serif;font-size:22px;font-weight:650;white-space:nowrap;overflow:hidden;text-overflow:ellipsis">${esc(title)}</span></span>`,
    `${directionPill}${heuteKnopf}${viewPill}`,
  );
}

// --- Listenansicht (reference 05.1) ---

function sectionLabel(text, padTop) {
  return `<span style="display:block;font-size:11px;font-weight:650;letter-spacing:.09em;text-transform:uppercase;color:var(--ink-soft);padding:${padTop}px 24px 0">${text}</span>`;
}

// v3.1 §5: aktive Loops zuerst (in horizontalen Reihen also links), danach chronologisch.
function loopSortKey(meet) {
  const dateKey = loopNextDate(meet);
  const active = meet.status === 'active' && isToday(dateKey) ? '0' : '1';
  return `${active} ${dateKey} ${meet.loop.time || meet.time || '00:00'}`;
}

// Listenansicht als EIN Inhaltskörper (v3.1 §1): Loops-Reihe und Meet-Liste scrollen zusammen.
// Der „+ Meet"-Knopf liegt nicht mehr im Fluss, sondern in der Bottom-Ebene (siehe ctaBar).
function listBody(ctx, ui, opts) {
  const key = opts.uiKey || 'meetBrowser';
  const loops = ui.direction === 'upcoming'
    ? ctx.repo.getLoops({ context: opts.context }).sort((a, b) => loopSortKey(a).localeCompare(loopSortKey(b)))
    : [];
  // Reihenfolge kommt aus dem Gateway (aktive Meets zuerst) — hier wird NICHT nachsortiert.
  const meets = ctx.repo.getMeets({ context: opts.context, direction: ui.direction });

  const loopsHtml = loops.length
    ? `${sectionLabel(t('Loops'), 10)}
${edgeFadeRow(loops.map((meet) => loopStripCard(ctx, meet)).join(''), { gap: 9, padY: '8px 0 2px', scrollKey: `${key}-loops` })}`
    : '';

  // Auftrag §3: Auch hier war der leere Zustand nur eine graue Zeile. Ohne Freunde steht
  // der erste Schritt daneben — mit Freunden, aber ohne Meet, der zweite.
  const hatFreunde = ctx.repo.getPeople().length > 0;
  const cards = meets.length
    ? meets.map((meet) => listMeetCard(ctx, meet, 'list')).join('')
    : (ui.direction === 'upcoming'
      // Runde 2: kurz — ein Satz, ein Knopf. Ohne Freunde führt der Knopf zum QR-Code.
      ? leerZeile(hatFreunde
        ? { text: t('Noch nichts geplant'), aktLabel: t('Meet anlegen'), act: 'mb-new-meet' }
        : { text: t('Noch keine Freunde'), aktLabel: t('Freunde hinzufügen'), act: 'mb-friend-add' })
      : `<span style="display:block;font-size:12.5px;color:var(--muted);padding:8px 4px">${t('Noch kein Verlauf.')}</span>`);

  return `${loopsHtml}
${sectionLabel(ui.direction === 'upcoming' ? t('Meet') : t('Verlauf'), 12)}
<div style="padding:8px 20px 4px;display:flex;flex-direction:column;gap:9px">${cards}</div>`;
}

// „+ Meet" als echtes Bedienelement der Bottom-Ebene (v3.1 §1): der Inhalt läuft sichtbar
// darunter durch, wird von einem weichen Verlauf ausgeblendet und nie hart beschnitten.
function ctaBar() {
  const button = `<button data-act="mb-new-meet" data-treffer style="${NEW_MEET_BUTTON}">${t('+ Meet')}</button>`;
  // v4 P0-5: KEINE Farbfläche mehr über dem Inhalt. Der Knopf ist das einzige reale
  // Element; der Inhalt läuft sichtbar hinter ihm durch und fadet erst an der Unterkante
  // der Scrollfläche aus (Maske in screenScaffold).
  return `<div style="pointer-events:none;height:${CTA_INSET}px;display:flex;align-items:center;justify-content:center">${bottomBar(button)}</div>`;
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

// Fable 5 (J4/J5): Der Kalender ist ein vertikaler TAGES-FEED — Vergangenheit oben, Zukunft
// unten. Die Wochenleiste sitzt oben fest (sticky) und folgt beim Scrollen dem sichtbaren Tag.
// Erster Tipp auf eine Karte eines ANDEREN Tages wählt den Tag (scrollt ihn nach oben), erst der
// zweite Tipp öffnet das Meet (J4).
//
// Auftrag §4.5: Der Kalender zeigt EINEN Tag klar, nicht zwanzig gleichzeitig — der gewählte Tag
// nimmt die ganze Höhe ein, jeder andere ist genau EINE Zeile.
//
// Runde 4 (Jonathan): „Man kann nicht nach unten scrollen … es geht nur bis zum 20. September,
// danach keine Tage mehr. Es müssen unendlich viele Tage angezeigt werden." — „Dann soll es zu
// der Ansicht snappen, wo man den Tag sieht, also das Label — magnetisch."
// Gemessen vorher: 21 Tage (31.08.–20.09.), der Scrollweg war nach 239 px zu Ende, der nächste
// Tageskopf blieb 188 px unter der Kante stehen — einrasten konnte er nie.
// Jetzt:
//   • Der Feed trägt ein Fenster von Tagen und lädt nach — nach unten schon während der
//     Bewegung, nach oben im Stillstand (die Lage bleibt dabei auf den Pixel gleich).
//   • Jeder Tageskopf ist eine Einraststelle (scroll-snap mandatory, mit Finger UND Rad). Bleibt
//     eine Bewegung trotzdem zwischen zwei Tagen stehen, zieht ein Magnet auf den nächsten Kopf.
//   • Welcher Tag groß aufgeklappt ist, wechselt erst, wenn die Bewegung ruht — und ohne Sprung:
//     Die Höhe, die oben zuklappt, wird im selben Bild gegengerechnet.
const FEED_WOCHEN = [-7, 0, 7];
const FEED_VORLAUF_WOCHEN = 4;
const FEED_NACHLAUF_WOCHEN = 8;
const FEED_NACHLADEN_WOCHEN = 6;

const KALENDER_STIL = `
.screen-scroll:has([data-dayfeed]){scroll-snap-type:y mandatory;overflow-anchor:none}
.ka-tag{scroll-snap-stop:normal}
`;

function kalenderStilEinsetzen() {
  if (typeof document === 'undefined' || document.getElementById('mb-kalender-stil')) return;
  const stil = document.createElement('style');
  stil.id = 'mb-kalender-stil';
  stil.textContent = KALENDER_STIL;
  document.head.appendChild(stil);
}

function calendarBody(ctx, ui, opts) {
  return calendarBodyEinTag(ctx, ui, opts);
}

// Welche Tage der Feed trägt. Liegt der gewählte Tag nicht mehr gut darin (Picker, Pfeile, „Heute"),
// wird das Fenster neu um ihn gelegt; sonst bleibt es — samt allem, was nachgeladen wurde.
function feedFenster(ui) {
  const tag = ui.day;
  const fenster = ui.feed;
  if (fenster && fenster.von <= addDays(tag, -7) && addDays(tag, 21) <= fenster.bis) return fenster;
  const start = weekStart(tag);
  ui.feed = { von: addDays(start, -7 * FEED_VORLAUF_WOCHEN), bis: addDays(start, 7 * FEED_NACHLAUF_WOCHEN - 1) };
  return ui.feed;
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

// Ein Wochenblock der Leiste (sieben Tage, Punkte für Meets und Loops).
function wochenBlockHtml(eintraege, startIso, tag) {
  const zelle = (iso) => {
    const entries = eintraege(iso);
    const hasMeet = entries.some((meet) => !meet.loop);
    const hasLoop = entries.some((meet) => meet.loop);
    return `<button class="wk-day" data-act="mb-day" data-date="${iso}" aria-pressed="${iso === tag}"${isToday(iso) ? ' data-today="1"' : ''}>
<span class="wk-wd">${weekdayShort(iso)}</span><span class="wk-num">${fromISODate(iso).getDate()}</span>
<span class="wk-dots">${hasMeet ? '<i class="wk-dot"></i>' : ''}${hasLoop ? '<i class="wk-dot wk-dot-loop"></i>' : ''}</span></button>`;
  };
  return `<div data-week-block="1" data-week-start="${startIso}" style="flex:none;width:${(100 / 3).toFixed(4)}%;display:flex;gap:4px">${weekDays(startIso).map(zelle).join('')}</div>`;
}

// Kopfzeile mit Monat und Wochenleiste. Runde 4: Die Bahn wird INNERHALB des Innenabstands der
// Leiste beschnitten — vorher schaute links ein Streifen der Vorwoche (grün, wenn dort heute war) herein.
function kalenderKopf(ctx, ui, opts, eintraege = tagesEintraege(ctx, opts)) {
  const day = ui.day;
  const date = fromISODate(day);
  const wsStart = weekStart(day);
  // Runde 2: Die Kalenderwoche ist raus — gelesen wird der Monat. Die Pfeile sind Zeichen aus
  // dem Satz. Runde 3: „Heute" steht in der Kopfzeile (browserHeader) — der Monat bleibt mittig.
  const centerLabel = monatUndJahr(date);
  const arrow = (delta) => `<button data-act="mb-week" data-delta="${delta}" data-treffer aria-label="${esc(delta < 0 ? t('Vorige Woche') : t('Nächste Woche'))}" style="width:32px;height:32px;border-radius:50%;background:var(--surface);border:1.5px solid var(--ink-a10);display:flex;align-items:center;justify-content:center;padding:0;cursor:pointer;appearance:none;flex:none">${symbol(delta < 0 ? 'zurueck' : 'vor', 'var(--ink-soft)', 16)}</button>`;
  const kwRow = `<div style="display:flex;justify-content:space-between;align-items:center;gap:8px;padding:12px 20px 2px">
${arrow(-7)}
<div style="display:flex;align-items:center;gap:6px;min-width:0">
<button data-act="mb-picker-open" style="border:0;background:transparent;padding:2px 6px;cursor:pointer;appearance:none;font-family:'Bricolage Grotesque',sans-serif;font-size:17px;font-weight:650;color:var(--ink);white-space:nowrap;display:flex;align-items:center;gap:5px"><span data-kw-label="1" style="pointer-events:none">${centerLabel}</span><span style="pointer-events:none;display:flex">${symbol('ab', 'var(--muted-light)', 12)}</span></button>
</div>
${arrow(7)}
</div>`;
  return `<div data-dayfeed-head="1" class="df-head">${kwRow}
<div style="padding:8px 20px 8px"><div data-hdrag="weekstrip" data-weekstrip="1" class="wk-strip">
<div style="overflow:hidden;border-radius:11px"><div data-weekstrip-track="1" style="display:flex;width:300%;will-change:transform;transform:translateX(-${(100 / 3).toFixed(4)}%)">${FEED_WOCHEN.map((delta) => wochenBlockHtml(eintraege, addDays(wsStart, delta), day)).join('')}</div></div>
</div></div></div>`;
}

// Punktreihe: ein Punkt je Meet, Loops in ihrer eigenen Farbe.
function tagesPunkte(entries, max = 5) {
  return entries.slice(0, max).map((meet) => `<i class="ka-punkt${meet.loop ? ' ka-punkt-loop' : ''}"></i>`).join('');
}

// Ein Tag des Feeds. Offen ist genau der gewählte Tag; alle anderen sind eine Zeile.
function tagSektionHtml(ctx, ui, eintraege, iso, hatFreunde) {
  const entries = eintraege(iso);
  const datum = fromISODate(iso);
  const zahl = entries.length ? tn(entries.length, '{n} Meet', '{n} Meets') : t('nichts geplant');
  return `<section data-day-section="${iso}" class="df-day ka-tag${isToday(iso) ? ' ka-heute' : ''}" data-offen="${iso === ui.day ? '1' : '0'}">
<button class="ka-kopf" data-act="mb-day" data-date="${iso}" aria-expanded="${iso === ui.day}">
<span class="ka-wd">${weekdayLong(iso)}</span>
<span class="ka-datum">${tagUndMonat(datum)}</span>
<span class="ka-zahl">${zahl}</span>
<span class="ka-punkte">${tagesPunkte(entries, 4)}</span>
</button>
<div class="ka-inhalt">${entries.length
    ? `<div style="display:flex;flex-direction:column;gap:10px;padding:12px 0 0">${entries.map((meet) => listMeetCard(ctx, meet, 'day', { dateKey: iso })).join('')}</div>`
    : (hatFreunde
      ? `<div class="ka-nichts">${t('Nichts geplant.')} <button data-act="mb-new-meet" data-treffer class="ka-nichts-akt">${t('Meet anlegen')}</button></div>`
      // Runde 2: ohne Freunde kein Meet — also auch kein Knopf dafür.
      : `<div class="ka-nichts">${t('Nichts geplant')}</div>`)}</div>
</section>`;
}

function tageHtml(ctx, ui, eintraege, von, bis) {
  const hatFreunde = ctx.repo.getPeople().length > 0;
  const teile = [];
  for (let iso = von; iso <= bis; iso = addDays(iso, 1)) teile.push(tagSektionHtml(ctx, ui, eintraege, iso, hatFreunde));
  return teile.join('');
}

function calendarBodyEinTag(ctx, ui, opts) {
  const { von, bis } = feedFenster(ui);
  const eintraege = tagesEintraege(ctx, opts);
  return `<div data-dayfeed="1" data-day="${ui.day}" data-von="${von}" data-bis="${bis}">
${kalenderKopf(ctx, ui, opts, eintraege)}
<div class="df-feed ka-feed" data-role="ka-feed" style="padding:0 20px 12px">${tageHtml(ctx, ui, eintraege, von, bis)}</div>
</div>`;
}

// Tages-Feed binden: Leiste folgt dem sichtbaren Tag, Tipp auf einen Tag scrollt hin, Tage laden
// nach, der Tag rastet ein. Kein ctx.render() beim Scrollen — nur Attribute, Nachladen und die
// Leistenbahn ändern sich.
function bindDayFeed(root, ctx, ui, opts = {}) {
  const feed = root.querySelector('[data-dayfeed]');
  if (!feed) return;
  feed.__feedStand = { ctx, ui, opts };
  if (feed.__feedGebunden) {
    feed.__feedNachZeichnen?.();
    root.__dayFeed = feed.__feedSteuerung;
    return;
  }
  const scroller = feed.closest('.screen-scroll') || root;
  const head = feed.querySelector('[data-dayfeed-head]');
  const liste = feed.querySelector('[data-role="ka-feed"]');
  if (!head || !liste) return;
  feed.__feedGebunden = true;
  kalenderStilEinsetzen();
  const stand = () => feed.__feedStand;
  const headH = () => head.offsetHeight;
  const sektion = (iso) => liste.querySelector(`[data-day-section="${iso}"]`);
  const gedrosselt = () => { try { return Boolean(globalThis.matchMedia?.('(prefers-reduced-motion: reduce)').matches); } catch { return false; } };

  // §4.5: Der offene Tag ist genau so hoch, dass er den Schirm füllt — gemessen an der echten
  // Scrollfläche. Die Werte stehen am Knoten und werden bei jedem Binden neu gesetzt (ein
  // Neuzeichnen darf sie nicht verlieren, sonst rastet der Kopf unter der Leiste ein).
  const masseSetzen = () => {
    feed.style.setProperty('--df-head', `${headH()}px`);
    const unten = parseFloat(getComputedStyle(scroller).paddingBottom || '0') || 0;
    feed.style.setProperty('--ka-schirm', `${Math.max(300, scroller.clientHeight - headH() - unten - 88)}px`);
  };
  masseSetzen();

  let versuche = 0;
  let fertig = false;
  let sperre = 0;
  let finger = false;

  const sichtbareSektion = () => {
    const alle = liste.children;
    if (!alle.length) return null;
    const linie = scroller.scrollTop + headH() + 6;
    let lo = 0;
    let hi = alle.length - 1;
    let treffer = 0;
    while (lo <= hi) {
      const mitte = (lo + hi) >> 1;
      if (alle[mitte].offsetTop <= linie) { treffer = mitte; lo = mitte + 1; } else hi = mitte - 1;
    }
    return alle[treffer];
  };

  // Die Bahn trägt drei Wochen. Wandert der sichtbare Tag in die Nachbarwoche, gleitet sie hin und
  // wird danach unsichtbar neu belegt (die Woche steht wieder in der Mitte). Weiter weg: sofort.
  const wocheZeigen = (iso) => {
    const track = feed.querySelector('[data-weekstrip-track]');
    if (!track || track.dataset.dragging) return;
    const woche = weekStart(iso);
    const index = [...track.children].findIndex((block) => block.dataset.weekStart === woche);
    if (index === 1) return;
    const neuBelegen = () => {
      const { ctx: c, ui: u, opts: o } = stand();
      const eintraege = tagesEintraege(c, o);
      const mitte = weekStart(u.day);
      track.innerHTML = FEED_WOCHEN.map((delta) => wochenBlockHtml(eintraege, addDays(mitte, delta), u.day)).join('');
      track.style.transition = 'none';
      track.style.transform = `translateX(-${(100 / 3).toFixed(4)}%)`;
    };
    clearTimeout(feed.__wocheZeit);
    if (index === 0 || index === 2) {
      track.style.transition = 'transform .22s ease';
      track.style.transform = `translateX(-${(index * 100 / 3).toFixed(4)}%)`;
      feed.__wocheZeit = setTimeout(neuBelegen, 240);
    } else {
      neuBelegen();
    }
  };

  // Der sichtbare Tag: Leiste, Monat, Heute-Knopf. Nichts ändert dabei seine Höhe.
  const markieren = (iso) => {
    if (!iso || feed.dataset.day === iso) return;
    if (versuche < 12 && !fertig) return; // Erstlage läuft noch: Scroll-Ereignisse aus dem Restore ignorieren
    const { ui: u } = stand();
    feed.dataset.day = iso;
    u.day = iso;
    for (const zelle of feed.querySelectorAll('.wk-day')) zelle.setAttribute('aria-pressed', String(zelle.dataset.date === iso));
    const kwLabel = feed.querySelector('[data-kw-label]');
    if (kwLabel) kwLabel.textContent = monatUndJahr(fromISODate(iso));
    const heuteKnopf = root.querySelector('[data-role="mb-today"]');
    if (heuteKnopf) {
      const heute = isToday(iso);
      heuteKnopf.hidden = heute;
      heuteKnopf.style.display = heute ? 'none' : 'flex';
    }
    wocheZeigen(iso);
  };

  // Den Tag groß aufklappen — ohne dass sich sichtbar etwas verschiebt: Seine Lage im Bild wird
  // vorher gemessen und danach wiederhergestellt (die zuklappende Höhe darüber ist gegengerechnet).
  const tagOeffnen = (iso) => {
    const ziel = sektion(iso);
    if (!ziel || ziel.dataset.offen === '1') return;
    const lage = ziel.offsetTop - scroller.scrollTop;
    for (const offen of liste.querySelectorAll('[data-offen="1"]')) {
      offen.dataset.offen = '0';
      offen.querySelector('.ka-kopf')?.setAttribute('aria-expanded', 'false');
    }
    ziel.dataset.offen = '1';
    ziel.querySelector('.ka-kopf')?.setAttribute('aria-expanded', 'true');
    const soll = Math.max(0, ziel.offsetTop - lage);
    if (Math.abs(scroller.scrollTop - soll) > 0.5) scroller.scrollTop = soll;
  };

  const nachladenUnten = () => {
    if (scroller.scrollTop + scroller.clientHeight * 2.5 < scroller.scrollHeight) return;
    const { ctx: c, ui: u, opts: o } = stand();
    const bis = feed.dataset.bis;
    const neuBis = addDays(bis, 7 * FEED_NACHLADEN_WOCHEN);
    liste.insertAdjacentHTML('beforeend', tageHtml(c, u, tagesEintraege(c, o), addDays(bis, 1), neuBis));
    feed.dataset.bis = neuBis;
    u.feed = { von: feed.dataset.von, bis: neuBis };
  };

  const nachladenOben = () => {
    if (scroller.scrollTop > scroller.clientHeight * 1.5) return;
    const { ctx: c, ui: u, opts: o } = stand();
    const von = feed.dataset.von;
    const neuVon = addDays(von, -7 * FEED_NACHLADEN_WOCHEN);
    const anker = sichtbareSektion();
    const lage = anker ? anker.offsetTop - scroller.scrollTop : 0;
    liste.insertAdjacentHTML('afterbegin', tageHtml(c, u, tagesEintraege(c, o), neuVon, addDays(von, -1)));
    feed.dataset.von = neuVon;
    u.feed = { von: neuVon, bis: feed.dataset.bis };
    if (anker) scroller.scrollTop = Math.max(0, anker.offsetTop - lage);
  };

  // Die Bewegung ruht: auf den nächsten Tageskopf einrasten (falls die Einraststellen des Browsers
  // nicht gegriffen haben), dann diesen Tag aufklappen und oben nachladen.
  const ruhe = () => {
    if (!feed.isConnected || finger || Date.now() < sperre || !fertig) return;
    const s = sichtbareSektion();
    if (!s) return;
    const oben = scroller.scrollTop + headH();
    const unten = scroller.scrollTop + scroller.clientHeight - (parseFloat(getComputedStyle(scroller).paddingBottom || '0') || 0);
    const naechste = [s, s.nextElementSibling].filter(Boolean)
      .sort((a, b) => Math.abs(a.offsetTop - oben) - Math.abs(b.offsetTop - oben))[0];
    const abstand = naechste.offsetTop - oben;
    const imLangenTag = s.offsetTop < oben - 2 && s.offsetTop + s.offsetHeight > unten;
    const amEnde = scroller.scrollTop >= scroller.scrollHeight - scroller.clientHeight - 1;
    if (Math.abs(abstand) > 2 && !imLangenTag && !(abstand > 0 && amEnde)) {
      scroller.scrollTo({ top: Math.max(0, naechste.offsetTop - headH()), behavior: gedrosselt() ? 'auto' : 'smooth' });
      return;
    }
    const iso = (imLangenTag ? s : naechste).dataset.daySection;
    markieren(iso);
    tagOeffnen(iso);
    nachladenOben();
  };

  scroller.__feedAbbruch?.abort?.();
  const abbruch = typeof AbortController === 'function' ? new AbortController() : null;
  scroller.__feedAbbruch = abbruch;
  const mit = (extra = {}) => (abbruch ? { ...extra, signal: abbruch.signal } : extra);
  let ruheZeit = 0;
  const ruhePlanen = (ms = 150) => { clearTimeout(ruheZeit); ruheZeit = setTimeout(ruhe, ms); };
  let tick = 0;
  scroller.addEventListener('scroll', () => {
    if (!feed.isConnected) { abbruch?.abort(); return; }
    ruhePlanen();
    if (tick) return;
    tick = globalThis.requestAnimationFrame(() => {
      tick = 0;
      if (Date.now() >= sperre) markieren(sichtbareSektion()?.dataset.daySection);
      nachladenUnten();
    });
  }, mit({ passive: true }));
  scroller.addEventListener('scrollend', () => { if (feed.isConnected) ruhePlanen(40); }, mit());
  scroller.addEventListener('touchstart', () => { finger = true; clearTimeout(ruheZeit); }, mit({ passive: true }));
  const fingerWeg = () => { finger = false; if (feed.isConnected) ruhePlanen(); };
  scroller.addEventListener('touchend', fingerWeg, mit({ passive: true }));
  scroller.addEventListener('touchcancel', fingerWeg, mit({ passive: true }));

  // Während einer bewussten Auswahl darf das Scroll-Ereignis nicht dazwischenfunken.
  const waehleTag = (iso, sanft) => {
    fertig = true;
    const ziel = sektion(iso);
    const { ctx: c, ui: u } = stand();
    if (!ziel) { u.day = iso; c.render(); return; }
    markieren(iso);
    tagOeffnen(iso);
    sperre = Date.now() + 700;
    globalThis.requestAnimationFrame(() => {
      scroller.scrollTo({ top: Math.max(0, ziel.offsetTop - headH()), behavior: sanft && !gedrosselt() ? 'smooth' : 'auto' });
    });
  };

  // Der gewählte Tag steht oben — außer die Scrollposition zeigt ihn schon (Neuzeichnen nach
  // Zusage/Absage soll die Lage nicht verändern). Die Seite setzt ihre gemerkte Scrollposition
  // erst nach dem Binden; deshalb wird kurz nachgezogen, bis es stimmt (höchstens ~600 ms).
  const ausrichten = () => {
    versuche = 0;
    const schritt = () => {
      versuche += 1;
      const { ui: u } = stand();
      if (feed.isConnected && liste.firstElementChild?.offsetParent) {
        masseSetzen();
        const ziel = sektion(u.day);
        if (ziel && sichtbareSektion() !== ziel) scroller.scrollTop = Math.max(0, ziel.offsetTop - headH());
        if (!ziel || sichtbareSektion() === ziel) { fertig = true; return; }
      }
      if (versuche < 12) window.setTimeout(schritt, 50); else fertig = true;
    };
    globalThis.requestAnimationFrame(schritt);
  };

  feed.__feedNachZeichnen = () => {
    masseSetzen();
    const { ui: u } = stand();
    if (!finger && Date.now() >= sperre && sichtbareSektion()?.dataset.daySection !== u.day) ausrichten();
  };
  feed.__feedSteuerung = { waehleTag, markieren };
  root.__dayFeed = feed.__feedSteuerung;
  ausrichten();
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

// Wochenleiste als echtes horizontales Control: der seitliche Zug bewegt die Leiste sichtbar
// mit und wechselt ab der Schwelle die Woche; darunter snappt sie ruhig zurück. Maus/Stift
// über Pointer-, Finger über Touch-Ereignisse — identische Schwelle und Wirkung.
function bindWeekStrip(root, ctx, ui) {
  const strip = root.querySelector('[data-weekstrip]');
  if (!strip || strip.dataset.weekBound) return;
  const track = strip.querySelector('[data-weekstrip-track]');
  if (!track) return;
  strip.dataset.weekBound = '1';

  const THRESHOLD = 44;
  let start = null;
  let mode = null;              // null = unentschieden · 'drag' · 'reject'
  let laeuft = false;           // Einrast-Animation aktiv — kein zweiter Zug dazwischen

  // v7 A30c: Die Bahn trägt drei Wochenblöcke und ruht um genau einen Block nach links
  // versetzt. Deshalb ist die Ruhelage nicht mehr 0, sondern -1/3 der Bahnbreite; der Zug
  // addiert nur noch einen Offset darauf. Die Prozentangabe bleibt in der Formel, damit
  // Rundungen der Blockbreite nie zu einem Versatz von Bruchteilen eines Pixels führen.
  const RUHE = `-${(100 / 3).toFixed(4)}%`;
  const blockBreite = () => {
    const block = track.firstElementChild;
    return block ? block.offsetWidth : strip.offsetWidth;
  };
  const shift = (dx) => { track.dataset.dragging = '1'; track.style.transition = 'none'; track.style.transform = `translateX(calc(${RUHE} + ${dx}px))`; };
  const settle = () => { delete track.dataset.dragging; track.style.transition = 'transform .18s ease'; track.style.transform = `translateX(${RUHE})`; };

  const begin = (x, y) => { if (laeuft) return; start = { x, y }; mode = null; };

  const moveTo = (x, y) => {
    if (!start || mode === 'reject') return false;
    const dx = x - start.x;
    const dy = y - start.y;
    if (mode === null) {
      if (Math.abs(dy) > 10 && Math.abs(dy) >= Math.abs(dx)) { mode = 'reject'; return false; }
      if (Math.abs(dx) <= 8) return false;
      mode = 'drag';
    }
    // Höchstens bis zum Nachbarblock: weiter gibt es keine gerenderte Woche, und ein
    // Überziehen würde wieder leeren Streifengrund zeigen.
    const limit = blockBreite();
    const lokal = dx * phoneFaktor(strip);
    shift(Math.max(-limit, Math.min(limit, lokal)));
    return true;
  };

  const finish = (x) => {
    if (!start) { mode = null; return; }
    const dx = (x - start.x) * phoneFaktor(strip);
    const wasDrag = mode === 'drag';
    start = null;
    mode = null;
    if (!wasDrag) return;
    swallowNextClick(strip);
    if (Math.abs(dx) > THRESHOLD) {
      // Erst sichtbar auf den Nachbarblock einrasten, DANN neu rendern: der neue
      // Mittelblock ist exakt der Block, auf dem die Animation endet — dadurch gibt es
      // beim Rendern keinen Sprung. Ein sofortiges ctx.render() würde die Woche um eine
      // volle Blockbreite zurückschnellen lassen.
      const zurueck = dx > 0;
      laeuft = true;
      track.style.transition = 'transform .18s ease';
      track.style.transform = zurueck ? 'translateX(0%)' : `translateX(-${(200 / 3).toFixed(4)}%)`;
      window.setTimeout(() => {
        laeuft = false;
        ui.day = addDays(ui.day, zurueck ? -7 : 7);
        ctx.render();
      }, 185);
      return;
    }
    settle();
  };

  strip.addEventListener('pointerdown', (event) => {
    if (event.pointerType === 'touch') return;
    if (event.button !== undefined && event.button !== 0) return;
    begin(event.clientX, event.clientY);
  });
  strip.addEventListener('pointermove', (event) => {
    if (event.pointerType === 'touch') return;
    if (!moveTo(event.clientX, event.clientY)) return;
    event.preventDefault();
    try { strip.setPointerCapture(event.pointerId); } catch { /* egal */ }
  });
  strip.addEventListener('pointerup', (event) => {
    if (event.pointerType === 'touch') return;
    finish(event.clientX);
  });
  strip.addEventListener('pointercancel', (event) => {
    if (event.pointerType === 'touch') return;
    if (mode === 'drag') settle();
    start = null; mode = null;
  });

  strip.addEventListener('touchstart', (event) => {
    if (event.touches.length !== 1) { start = null; mode = 'reject'; return; }
    const touch = event.touches[0];
    begin(touch.clientX, touch.clientY);
  }, { passive: false });
  strip.addEventListener('touchmove', (event) => {
    if (event.touches.length !== 1) return;
    const touch = event.touches[0];
    if (!moveTo(touch.clientX, touch.clientY)) return;
    event.preventDefault();
    event.stopPropagation();
  }, { passive: false });
  strip.addEventListener('touchend', (event) => {
    const touch = event.changedTouches[0];
    finish(touch ? touch.clientX : (start ? start.x : 0));
  });
  strip.addEventListener('touchcancel', () => {
    if (mode === 'drag') settle();
    start = null; mode = null;
  });
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
    let dotMeet = 'var(--green)';
    let dotLoop = 'var(--blue-dark)';
    if (selected && today_) {
      circle = 'background:var(--green);'; color = 'var(--on-accent)'; weight = 650;
      dotMeet = 'rgba(255,255,255,.85)'; dotLoop = 'rgba(255,255,255,.85)';
    } else if (selected) {
      circle = `background:${SEL_TINT};box-shadow:${SEL_RING};`; color = SEL_TEXT; weight = 650;
    } else if (inMonth && today_) {
      circle = `background:${TODAY_TINT};`; color = TODAY_TEXT; weight = 650;
    }
    // Tage aus dem Nachbarmonat sind leiser — ihre Punkte auch, sonst zöge der Rand des
    // Rasters mehr Aufmerksamkeit auf sich als der Monat selbst.
    if (!inMonth) { dotMeet = 'var(--green-a45)'; dotLoop = 'rgba(91,132,196,.45)'; }
    const entries = dayMeets(ctx, opts, iso);
    const hasMeet = entries.some((meet) => !meet.loop);
    const hasLoop = entries.some((meet) => meet.loop);
    const dot = (dotColor) => `<span style="width:4px;height:4px;border-radius:50%;background:${dotColor}"></span>`;
    return `<button data-act="mb-picker-day" data-date="${iso}" aria-pressed="${selected}" style="border:0;background:transparent;appearance:none;cursor:pointer;padding:1px 0 2px;display:flex;flex-direction:column;align-items:center;gap:1px;font-family:'Instrument Sans',sans-serif;font-size:11.5px;font-weight:600;font-variant-numeric:tabular-nums"><span style="pointer-events:none;width:26px;height:26px;border-radius:50%;display:flex;align-items:center;justify-content:center;color:${color};font-weight:${weight};${circle}">${digits}</span><span style="height:4px;display:flex;gap:2px;align-items:center;pointer-events:none">${hasMeet ? dot(dotMeet) : ''}${hasLoop ? dot(dotLoop) : ''}</span></button>`;
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

// --- Meet-Karte (reference 05.5; Runde 4: zwei Formen über den Baukasten ui/map.js › ortMarken) ---

// T5: Auf der Karte erscheint, was einen echten Ort hat — Länge und Breite. Ein Meet mit
// „Ort offen" gehört nicht auf eine Landkarte; es steht in der Liste.
function hatOrt(meet) {
  return Boolean(meet?.place && typeof meet.place.lat === 'number' && typeof meet.place.lon === 'number');
}

// Runde 2 (Jonathan): „Bei Meets wäre ein Slider gut, um einzustellen, wie viele Meets
// angezeigt werden — heute, heute und morgen, nächste 3 Tage, 4 Tage, … 1 Woche, 2 Wochen …"
// Die Stufen liegen auf dem Regler gleich weit auseinander; ganz rechts steht „Alle".
// `tage` zählt den heutigen Tag mit: 1 = nur heute, 2 = heute und morgen.
const ZEITRAUM = [
  { tage: 1, wort: t('Heute') },
  { tage: 2, wort: t('Heute und morgen') },
  { tage: 3, wort: t('3 Tage') },
  { tage: 4, wort: t('4 Tage') },
  { tage: 5, wort: t('5 Tage') },
  { tage: 7, wort: t('1 Woche') },
  { tage: 14, wort: t('2 Wochen') },
  { tage: 21, wort: t('3 Wochen') },
  { tage: 31, wort: t('1 Monat') },
  { tage: null, wort: t('Alle') },
];
const ZEITRAUM_ALLE = ZEITRAUM.length - 1;

function zeitraumStufe(ui) {
  const index = Number.isInteger(ui.zeitraum) ? ui.zeitraum : ZEITRAUM_ALLE;
  return Math.max(0, Math.min(ZEITRAUM_ALLE, index));
}

function collectMapMeets(ctx, ui, opts, stufe = zeitraumStufe(ui)) {
  const meets = ctx.repo.getMeets({ context: opts.context, direction: ui.direction }).filter(hatOrt);
  if (ui.direction === 'upcoming') {
    // Runde 3 (Jonathan): „Ein wöchentlicher Loop bei Zeitraum vier Wochen zählt nur einmal,
    // nicht viermal." Ein Loop steht EINMAL auf der Karte — an seinem nächsten Termin.
    const gesehen = new Set(meets.map((meet) => meet.id));
    for (const loop of ctx.repo.getLoops({ context: opts.context })) {
      if (hatOrt(loop) && !gesehen.has(loop.id)) { gesehen.add(loop.id); meets.push(loop); }
    }
    const { tage } = ZEITRAUM[stufe];
    if (tage != null) {
      const bis = addDays(toISODate(now()), tage - 1);
      return meets.filter((meet) => (meet.loop ? loopNextDate(meet) : meet.date) <= bis);
    }
  }
  return meets;
}

// Runde 3 (Jonathan): „Die Anzahl der Meets darin brauchen wir nicht — oder unauffällig, z. B.
// ‚10 · 3 Loops'." Groß steht der Zeitraum, leise daneben, was er enthält: Meets als Zahl,
// Loops mit ihrem Namen, weil sie eine andere Art Treffen sind.
function zeitraumZahl(ctx, ui, opts, stufe) {
  const liste = collectMapMeets(ctx, ui, opts, stufe);
  const loops = liste.filter((meet) => meet.loop).length;
  const einzeln = liste.length - loops;
  return loops ? `${einzeln} · ${tn(loops, '{n} Loop', '{n} Loops')}` : String(einzeln);
}

// Der Regler schwebt oben über der Karte — dieselbe Grammatik wie jeder Regler der App
// (Spur, grüne Füllung, weißer Knopf), dazu feine Striche an jeder Einraststelle.
// Runde 5 (D3, Jonathan: „es darf keine anderen Elemente, welche über einer Karte liegen, nach links
// drücken"): Er läuft wieder über die volle Breite (je 16 px Rand). Die Bedienung der Karte weicht ihm
// aus — dafür trägt er data-ueber-karte (ui/map.js › spalteOrdnen).
function zeitraumReglerHtml(ctx, ui, opts) {
  const stufe = zeitraumStufe(ui);
  const pct = ((stufe / ZEITRAUM_ALLE) * 100).toFixed(2);
  const schrift = "'Instrument Sans',sans-serif";
  const striche = ZEITRAUM.map((_, i) => `<span style="position:absolute;left:${((i / ZEITRAUM_ALLE) * 100).toFixed(2)}%;top:16px;width:1.5px;height:5px;margin-left:-.75px;border-radius:1px;background:var(--ink-a14)"></span>`).join('');
  return `<div data-role="mb-zeitraum" data-ueber-karte style="position:absolute;left:16px;right:16px;top:${ZEITRAUM_OBEN}px;z-index:6;background:var(--surface);border-radius:16px;box-shadow:0 4px 14px var(--shadow-14);padding:11px 16px 5px;display:flex;flex-direction:column;gap:3px;pointer-events:auto;cursor:default">
<div style="display:flex;justify-content:space-between;align-items:baseline;gap:10px;padding:0 3px"><span data-role="mb-zeitraum-wert" style="font:650 13.5px/1.15 ${schrift};color:var(--ink);white-space:nowrap">${esc(ZEITRAUM[stufe].wort)}</span><span data-role="mb-zeitraum-zahl" style="font:600 11.5px/1.15 ${schrift};color:var(--muted);font-variant-numeric:tabular-nums;white-space:nowrap">${esc(zeitraumZahl(ctx, ui, opts, stufe))}</span></div>
<div data-role="mb-zeitraum-spur" data-hdrag="zeitraum" role="slider" tabindex="0" aria-label="${esc(t('Zeitraum'))}" aria-valuemin="0" aria-valuemax="${ZEITRAUM_ALLE}" aria-valuenow="${stufe}" aria-valuetext="${esc(ZEITRAUM[stufe].wort)}" style="position:relative;height:24px;margin:0 4px;touch-action:none;cursor:pointer">
<div data-role="mb-zeitraum-griff" style="position:absolute;left:-16px;right:-16px;top:-6px;bottom:-8px"></div>
<div style="position:absolute;left:0;right:0;top:9px;height:4px;border-radius:2px;background:var(--field)"></div>
${striche}
<div data-role="mb-zeitraum-fuellung" style="position:absolute;left:0;top:9px;width:${pct}%;height:4px;border-radius:2px;background:var(--green)"></div>
<div data-role="mb-zeitraum-knopf" style="position:absolute;left:${pct}%;top:2px;width:18px;height:18px;margin-left:-9px;border-radius:50%;background:var(--surface);border:2.5px solid var(--green);box-sizing:border-box;box-shadow:0 2px 6px var(--shadow-20)"></div>
</div></div>`;
}

function mapSortKey(meet) {
  return `${meet.loop ? loopNextDate(meet) : meet.date} ${meet.loop?.time || meet.time || '00:00'}`;
}

// --- Runde 4: Markierungen der Meet-Karte ------------------------------------------------------
//
// Jonathan (D1–D3): „Du hast jetzt 4 Darstellungen … nette Idee, ich würde es abändern." Die volle
// Kachel mit Personenstapel, das Etikett, der kleine Hinweis und der Punkt allein sind EINER
// Grammatik gewichen, die jede Karte der App teilt (ui/map.js › ortMarken):
//   • Mini-Box — Zeichen, Kurzname, grobe Zeit. Der Normalfall („die sieht man generell").
//   • nur das Zeichen — wenn wenig Platz ist bzw. weit herausgezoomt.
//   • keine Personen („nimmt zu viel Platz weg"), kein Punkt allein.
// Mehrere Meets am selben Ort sind EINE Markierung mit Zahl; ein Tipp fächert sie auf — ebenso
// Markierungen, die übereinander liegen. Jede Bewegung durch den Menschen schließt den Fächer.
// Ein Tipp auf die Mini-Box öffnet das Meet. Jede Ecke steht exakt auf ihrem Ort (Runde 3).
//
// Runde 4 (E1): Ein abgelehntes Meet bleibt auf der Karte — mit rotem ×-Zeichen und leiserem Titel.
function kartenEintrag(meet) {
  const dateISO = meet.loop ? loopNextDate(meet) : meet.date;
  const isDone = meet.status === 'done';
  const aktiv = meet.status === 'active';
  // Solange Zeitvorschläge offen sind, nennt die Box keine Uhrzeit (wie die Liste: „Zeit offen").
  const zeitOffen = !isDone && !aktiv && (meet.variants || []).some((entry) => entry.kind === 'time');
  const vorschlaege = (meet.variants || []).filter((entry) => entry.kind === 'activity');
  const unentschieden = !isDone && meet.status === 'open' && vorschlaege.length > 0;
  const abgelehnt = meet.participation?.[ME] === 'no' || (Boolean(meet.loop) && meet.loop.responses?.[dateISO]?.[ME] === 'no');
  const titel = unentschieden ? t('{n} Vorschläge', { n: vorschlaege.length + 1 }) : kurzName(meet.title);
  const unter = grobeZeit({ date: dateISO, time: zeitOffen ? '' : (meet.loop?.time || meet.time), status: meet.status });
  return {
    id: meet.id,
    zeichen: meetIconSvg(meet, 'currentColor', 15),
    titel,
    unter,
    ton: abgelehnt ? 'abgelehnt' : aktiv ? 'aktiv' : meet.loop ? 'loop' : '',
    attrs: `data-act="mb-open-meet" data-meet="${esc(meet.id)}"`,
    label: [meet.title, unter, abgelehnt ? t('Nicht dabei') : ''].filter(Boolean).join(', '),
  };
}

// Orte gruppieren (gleicher Ort = eine Markierung) und in Rang-Reihenfolge bringen: was gerade
// läuft, dann was am frühesten kommt.
function kartenOrte(ctx, ui, opts) {
  const gruppen = new Map();
  for (const meet of collectMapMeets(ctx, ui, opts)) {
    const key = `${meet.place.name}|${meet.place.lat.toFixed(5)}|${meet.place.lon.toFixed(5)}`;
    if (!gruppen.has(key)) gruppen.set(key, { key, lat: meet.place.lat, lon: meet.place.lon, meets: [] });
    gruppen.get(key).meets.push(meet);
  }
  const liste = [...gruppen.values()];
  for (const gruppe of liste) {
    gruppe.meets.sort((a, b) => mapSortKey(a).localeCompare(mapSortKey(b)));
    const aktiv = gruppe.meets.some((meet) => meet.status === 'active');
    gruppe.sortierung = `${aktiv ? '0' : '1'} ${mapSortKey(gruppe.meets[0])} ${gruppe.key}`;
  }
  liste.sort((a, b) => a.sortierung.localeCompare(b.sortierung));
  return liste.map((gruppe, rang) => ({
    key: gruppe.key, lat: gruppe.lat, lon: gruppe.lon, rang, eintraege: gruppe.meets.map(kartenEintrag),
  }));
}

// Browser, deren Karte nicht angelegt werden konnte (kein WebGL, kein Netz).
const kartenOhneKarte = new Set();

function mapBody(ctx, ui, opts) {
  const uiKey = opts.uiKey || 'meetBrowser';
  const anzahl = collectMapMeets(ctx, ui, opts).length;

  // Runde 2 (Jonathan): Ist nichts auf der Karte, sagt sie es — kurz, oben, unter der
  // weichen Kante. Der Zeitraum-Regler steht nur dort, wo es Kommendes gibt, das er eingrenzen kann.
  const mitRegler = ui.direction === 'upcoming' && collectMapMeets(ctx, ui, opts, ZEITRAUM_ALLE).length > 0;
  const hinweisText = ui.direction === 'history' ? t('Keine vergangenen Meets')
    : mitRegler ? t('Keine Meets in diesem Zeitraum') : t('Keine aktuellen Meets');
  const leerHinweis = anzahl
    ? ''
    : `<div data-role="mb-map-hinweis" style="position:absolute;left:0;right:0;top:${mitRegler ? ZEITRAUM_OBEN + 76 : 34}px;z-index:5;display:flex;justify-content:center;pointer-events:none;padding:0 16px"><span data-ueber-karte style="background:var(--surface);border-radius:999px;padding:8px 13px;box-shadow:0 4px 14px var(--shadow-14);font:600 12.5px/1 'Instrument Sans',sans-serif;color:var(--ink-soft);white-space:nowrap">${hinweisText}</span></div>`;
  const regler = mitRegler ? zeitraumReglerHtml(ctx, ui, opts) : '';
  const ohneKarte = kartenOhneKarte.has(uiKey);

  // T5: Unter den Markierungen liegt eine ECHTE Karte (MapLibre, freie OSM-Daten). Sie gehört
  // MapLibre und ist deshalb mit data-fremd vom Abgleich ausgenommen. Die Markierungen setzt der
  // Baukasten beim Binden IN die Karte (bindKartenansicht). Ohne Karte stehen sie auf einer
  // ruhigen Ersatzfläche.
  // data-hdrag: Waagerechte Züge auf der Karte gehören der KARTE, nicht der Tab-Bahn.
  return `<div data-act="mb-map-close" data-map-viewport="1" data-hdrag="karte" style="height:100%;position:relative;background:var(--field);overflow:hidden">
<div data-fremd="1" data-role="mb-map" style="position:absolute;inset:0;z-index:0"></div>
${ohneKarte ? '<div data-fremd="1" data-role="mb-map-ersatz" style="position:absolute;inset:0;z-index:1;overflow:hidden"></div>' : ''}
${regler}
${leerHinweis}
</div>`;
}

// Nach einem echten Zug darf der folgende Klick nichts auslösen: sonst öffnet der Zug
// zusätzlich das, worauf er begann.
function swallowNextClick(node) {
  const blocker = (event) => { event.stopPropagation(); event.preventDefault(); };
  node.addEventListener('click', blocker, { capture: true });
  window.setTimeout(() => node.removeEventListener('click', blocker, { capture: true }), 350);
}

// --- Anordnung ------------------------------------------------------------------------------
// Die Karte lebt über viele Zeichnungen (data-fremd); die Markierungen verwaltet ortMarken.
// Hier bleibt nur: welche Orte, welche Fläche frei bleibt, und der erste Ausschnitt.
let kartenStand = null;

// Flächen von Bedienelementen über der Karte, in Karten-Pixeln (auch in der skalierten Vorschau).
function bedienFlaechenVon(viewport, elemente) {
  if (!viewport) return [];
  const basis = viewport.getBoundingClientRect();
  const faktor = viewport.offsetWidth ? basis.width / viewport.offsetWidth : 1;
  return elemente
    .map((el) => el.getBoundingClientRect())
    .filter((r) => r.width > 0 && r.height > 0)
    .map((r) => ({ l: (r.left - basis.left) / faktor, r: (r.right - basis.left) / faktor, o: (r.top - basis.top) / faktor, u: (r.bottom - basis.top) / faktor }));
}

// Wie weit oben ist Platz? Unter dem Zeitraum-Regler.
function kartenObenFrei(viewport) {
  const kasten = viewport?.querySelector('[data-role="mb-zeitraum"]');
  return kasten ? kasten.offsetTop + kasten.offsetHeight : 0;
}

// Ohne Karte stehen die Markierungen auf ruhigem Grund — ungefähr so, wie ihre Orte zueinander liegen.
function geschaetzteProjektion(orte, breite, hoehe) {
  const lats = orte.map((ort) => ort.lat);
  const lons = orte.map((ort) => ort.lon);
  const [minLat, maxLat, minLon, maxLon] = [Math.min(...lats), Math.max(...lats), Math.min(...lons), Math.max(...lons)];
  const anteil = (wert, von, bis) => (Math.abs(bis - von) > 1e-9 ? (wert - von) / (bis - von) : 0.5);
  return (lat, lon) => ({
    x: breite * (0.12 + 0.5 * anteil(lon, minLon, maxLon)),
    y: hoehe * (0.3 + 0.55 * anteil(lat, maxLat, minLat)),
  });
}

// Ein Zug über die Karte endet mit einem Klick auf das, worüber er losließ. Der darf kein Meet öffnen.
function kartenKlickSperre(viewport) {
  if (viewport.__crewKlickSperre) return;
  viewport.__crewKlickSperre = true;
  let start = null;
  viewport.addEventListener('pointerdown', (ereignis) => { start = { x: ereignis.clientX, y: ereignis.clientY }; }, true);
  viewport.addEventListener('click', (ereignis) => {
    const gezogen = start && Math.hypot(ereignis.clientX - start.x, ereignis.clientY - start.y) > 6;
    start = null;
    if (gezogen) { ereignis.stopPropagation(); ereignis.preventDefault(); }
  }, true);
}

// Der Zeitraum-Regler: Beim Ziehen springen Knopf, Füllung und Anzahl sofort mit („1 Woche ·
// 4"); die Karte zeichnet beim Loslassen neu. Ereignisse lesen den frischesten Stand
// (zeitraumStand), weil der Knoten viele Zeichnungen überlebt.
let zeitraumStand = null;

function bindZeitraumRegler(root, ctx, ui, opts) {
  const spur = root.querySelector('[data-role="mb-zeitraum-spur"]');
  const kasten = root.querySelector('[data-role="mb-zeitraum"]');
  if (!spur || !kasten) { zeitraumStand = null; return; }
  zeitraumStand = { ctx, ui, opts, stufe: zeitraumStufe(ui) };
  if (spur.__crewZeitraum) return;
  spur.__crewZeitraum = true;
  const zeigen = (neu) => {
    const st = zeitraumStand;
    if (!st) return;
    st.stufe = neu;
    const pct = `${((neu / ZEITRAUM_ALLE) * 100).toFixed(2)}%`;
    const fuellung = spur.querySelector('[data-role="mb-zeitraum-fuellung"]');
    const knopf = spur.querySelector('[data-role="mb-zeitraum-knopf"]');
    const wert = kasten.querySelector('[data-role="mb-zeitraum-wert"]');
    const zahl = kasten.querySelector('[data-role="mb-zeitraum-zahl"]');
    if (fuellung) fuellung.style.width = pct;
    if (knopf) knopf.style.left = pct;
    if (wert) wert.textContent = ZEITRAUM[neu].wort;
    if (zahl) zahl.textContent = zeitraumZahl(st.ctx, st.ui, st.opts, neu);
    spur.setAttribute('aria-valuenow', String(neu));
    spur.setAttribute('aria-valuetext', ZEITRAUM[neu].wort);
  };
  const stufeAm = (x) => {
    const r = spur.getBoundingClientRect();
    return Math.round(Math.max(0, Math.min(1, (x - r.left) / (r.width || 1))) * ZEITRAUM_ALLE);
  };
  const uebernehmen = () => {
    const st = zeitraumStand;
    if (!st || st.ui.zeitraum === st.stufe) return;
    st.ui.zeitraum = st.stufe;
    st.ui.zeitraumNeu = true;
    st.ctx.render();
  };
  let zieht = false;
  spur.addEventListener('pointerdown', (ereignis) => {
    if (ereignis.button) return;
    ereignis.preventDefault();
    ereignis.stopPropagation();
    zieht = true;
    spur.setPointerCapture?.(ereignis.pointerId);
    zeigen(stufeAm(ereignis.clientX));
  });
  spur.addEventListener('pointermove', (ereignis) => {
    if (!zieht) return;
    ereignis.preventDefault();
    ereignis.stopPropagation();
    const neu = stufeAm(ereignis.clientX);
    if (neu !== zeitraumStand?.stufe) zeigen(neu);
  });
  const los = (ereignis) => {
    if (!zieht) return;
    zieht = false;
    ereignis.stopPropagation();
    uebernehmen();
  };
  spur.addEventListener('pointerup', los);
  spur.addEventListener('pointercancel', los);
  spur.addEventListener('keydown', (ereignis) => {
    const delta = ereignis.key === 'ArrowLeft' ? -1 : ereignis.key === 'ArrowRight' ? 1 : 0;
    if (!delta || !zeitraumStand) return;
    ereignis.preventDefault();
    zeigen(Math.max(0, Math.min(ZEITRAUM_ALLE, zeitraumStand.stufe + delta)));
    uebernehmen();
  });
  // Ein Tipp in den Regler-Kasten ist kein Tipp auf die Karte (mb-map-close).
  kasten.addEventListener('click', (ereignis) => ereignis.stopPropagation());
}

function bindKartenansicht(root, ctx, ui, opts = {}) {
  const viewport = root.querySelector('[data-map-viewport="1"]');
  const knoten = viewport?.querySelector('[data-role="mb-map"]');
  if (!viewport || !knoten) { kartenStand = null; return; }
  const uiKey = opts.uiKey || 'meetBrowser';
  const zeitraum = viewport.querySelector('[data-role="mb-zeitraum"]');
  const orte = kartenOrte(ctx, ui, opts);
  kartenKlickSperre(viewport);
  // Unter dem Zeitraum-Regler und dem Leer-Hinweis wächst keine Mini-Box.
  const frei = () => bedienFlaechenVon(viewport, [...viewport.querySelectorAll('[data-role="mb-zeitraum"], [data-role="mb-map-hinweis"] > *')]);

  const einrichten = (karte) => {
    kartenOhneKarte.delete(uiKey);
    // Runde 5: meine Lage (D4) und die Bedienspalte (D1/D3) nach jedem Zeichnen — Zeitraum-Regler und
    // Leer-Hinweis kommen und gehen mit dem Zeitraum.
    kartenLageQuelle(ctx.repo);
    bedienSpalteOrdnen(karte);
    const marken = ortMarken(karte, { schluessel: uiKey, frei });
    // Das Rad über dem Zeitraum-Regler zoomt die Karte.
    radAnKarte(karte, zeitraum);
    const neuesBild = !karte.__crewGestellt || ui.zeitraumNeu;
    if (neuesBild) {
      ui.zeitraumNeu = false;
      karte.__crewGestellt = true;
      marken?.schliessen();
      // Beim ersten Öffnen — und nach einem neuen Zeitraum — so weit herauszoomen, dass alle
      // gezeigten Orte im Bild sind. Oben Platz für den Regler und die Mini-Boxen über den Punkten,
      // rechts für die Bedienspalte.
      if (orte.length) {
        const rand = { top: kartenObenFrei(viewport) + 56, bottom: 36, left: 28, right: KARTEN_SPALTE.frei + 24 };
        passeAufPunkte(karte, orte, { padding: rand, maxZoom: 14.5 });
        if (!karte.loaded()) karte.once('load', () => passeAufPunkte(karte, orte, { padding: rand, maxZoom: 14.5 }));
      }
    }
    marken?.setzen(orte);
    // Ein Ausschnitt, den die App selbst wählt, ist ein neues Bild: Die Formen werden neu verteilt,
    // statt aus dem alten Ausschnitt mitgenommen. Beim Schieben durch den Menschen gilt dagegen:
    // Was eine Box ist, bleibt eine Box.
    if (neuesBild) marken?.neuVerteilen();
    kartenStand = { uiKey, karte, marken };
  };

  // Steht die Karte schon, geht es ohne Warten: Die Markierungen sind im selben Bild an ihrem
  // Platz, in dem die App neu gezeichnet hat.
  const vorhanden = karteVon('mb-karte');
  if (vorhanden && vorhanden.getContainer() === knoten) { einrichten(vorhanden); return; }

  const ersatz = viewport.querySelector('[data-role="mb-map-ersatz"]');
  if (kartenOhneKarte.has(uiKey) && ersatz && orte.length) {
    const projektion = geschaetzteProjektion(orte, viewport.clientWidth, viewport.clientHeight);
    const marken = ortMarken(null, {
      schluessel: uiKey,
      frei,
      flaeche: { halter: ersatz, ebene: () => ersatz, projiziere: projektion, breite: () => ersatz.clientWidth, hoehe: () => ersatz.clientHeight },
    });
    marken?.setzen(orte);
    kartenStand = { uiKey, karte: null, marken };
  }

  // Runde 2: Start beim eigenen Zuhause oder im eigenen Land statt fest in Bregenz; Höhenregler
  // (Runde 4: in der festen Bedienspalte).
  const start = startAnsicht(ctx.repo.getSettings());
  karteHalten(knoten, 'mb-karte', { mitte: start.mitte, zoom: start.zoom, folgen: false, hoehenRegler: true }).then((karte) => {
    if (!knoten.isConnected) return;
    if (karte) { einrichten(karte); return; }
    if (!kartenOhneKarte.has(uiKey)) { kartenOhneKarte.add(uiKey); ctx.render(); }
  }).catch(() => {});
}

// --- Gemeinsamer Browser-Body (Export, FRAMEWORK „Geteilte Bereichs-APIs") ---

// Bausteine für screenScaffold (v3.1). `body` ist EIN Inhaltskörper ohne eigene Scrollfläche.
//   header        — Titel + Umschalter (sticky)
//   body          — Loops-Reihe + Meets bzw. Kalender bzw. Karte (eine Scrollfläche im Scaffold)
//   cta           — „+ Meet" für die Bottom-Ebene ('' wenn der Kontext keine neuen Meets erlaubt)
//   overlays      — Datums-Picker (höchste Ebene)
//   bottomInset   — Freiraum, wenn der Screen zusätzlich die Bottom-Navigation trägt
//   contentInset  — Freiraum ohne Bottom-Navigation (eingebettete Verwendung)
export function meetBrowserParts(ctx, opts = {}) {
  const ui = browserUi(ctx, opts);
  const key = opts.uiKey || 'meetBrowser';
  const isMap = ui.view === 'map';

  let body;
  if (ui.view === 'calendar') body = calendarBody(ctx, ui, opts);
  else if (isMap) body = mapBody(ctx, ui, opts);
  else body = listBody(ctx, ui, opts);

  // „+ Meet" nur dort, wo neue Meets entstehen (reference 05.1: ausschließlich in der Liste).
  const wantsCta = opts.newMeet ?? (historyMode(opts) !== 'only');
  // Runde 2 (Jonathan): Ohne Freunde kann man kein Meet anlegen — der Knopf ist dann nicht
  // da. Der leere Zustand darüber führt stattdessen zu „Freunde hinzufügen".
  const hatFreunde = ctx.repo.getPeople().length > 0;
  const cta = wantsCta && hatFreunde && ui.view === 'list' ? ctaBar() : '';
  const contentInset = isMap ? 0 : (cta ? CTA_INSET : 24);

  return {
    view: ui.view,
    header: browserHeader(ctx, ui, opts),
    body,
    cta,
    bottom: cta, // Alias: die Bottom-Ebene des Browsers besteht genau aus dem CTA.
    // Runde 3 (D5): „Freund hinzufügen" als Sheet über der Meet-Liste.
    overlays: `${ui.picker ? datePicker(ctx, ui, opts) : ''}${ctx.freundHinzufuegen?.overlay(ctx) || ''}`,
    scrollKey: `${key}-${ui.view}`,
    contentInset,
    bottomInset: isMap ? 0 : contentInset + TABBAR_INSET,
  };
}

// „+ Meet" im normalen Fluss (nur für die String-Form unten): am Ende des Inhalts, damit
// eingebettete Verwendungen ohne eigene Bottom-Ebene den Einstieg trotzdem behalten.
function inflowCta() {
  return `<div style="display:flex;justify-content:center;padding:14px 0 6px"><button data-act="mb-new-meet" data-treffer style="${NEW_MEET_BUTTON}">${t('+ Meet')}</button></div>`;
}

// Kompatible Doppelform (bis alle Bereiche auf meetBrowserParts umgestellt sind):
//   • als String verwendbar  → `${renderMeetBrowserBody(ctx, opts)}` liefert Kopf + Inhalt
//     (+ „+ Meet" im Fluss + Picker) für einen screenScaffold-`body`. KEINE eigene
//     Scrollfläche — der aufrufende Scaffold bleibt die einzige.
//   • als Objekt verwendbar  → .header / .body / .bottom / .overlays / .bottomInset …
//     für Screens, die die Bausteine sauber auf die Scaffold-Ebenen verteilen.
export function renderMeetBrowserBody(ctx, opts = {}) {
  const parts = meetBrowserParts(ctx, opts);
  const flat = `${parts.header}${parts.body}${parts.cta ? inflowCta() : ''}${parts.overlays}`;
  // eslint-disable-next-line no-new-wrappers
  const result = new String(flat);
  return Object.assign(result, parts);
}

export function bindMeetBrowserBody(root, ctx, opts = {}) {
  const ui = browserUi(ctx, opts);
  const { repo, nav } = ctx;

  bindRowDrag(root);
  // Eigene horizontale Controls des Browsers (P0-1: sie behalten ihre Geste).
  bindKartenansicht(root, ctx, ui, opts);
  bindZeitraumRegler(root, ctx, ui, opts);
  bindWeekStrip(root, ctx, ui);
  bindYearRow(root, ctx, ui);
  bindDayFeed(root, ctx, ui, opts);

  bindActions(root, {
    ...(ctx.freundHinzufuegen?.aktionen(root, ctx) || {}),
    'mb-friend-add': () => (ctx.freundHinzufuegen ? ctx.freundHinzufuegen.oeffnen(ctx) : ctx.nav.go('profile.friendAdd')),
    'mb-direction': (data) => {
      // Nur im Modus 'switch' erreichbar; feste Kontexte ignorieren die Aktion.
      if (historyMode(opts) !== 'switch' || ui.direction === data.direction) return;
      ui.direction = data.direction;
      ctx.render();
    },
    'mb-view': (data) => {
      if (ui.view === data.view) return;
      ui.view = data.view;
      ui.picker = null;
      ctx.render();
    },
    'mb-open-meet': (data) => {
      // Fable 5 (J4): Im Tages-Feed wählt der erste Tipp auf eine Karte eines anderen Tages
      // zuerst diesen Tag; erst der zweite Tipp öffnet das Meet.
      if (ui.view === 'calendar' && data.date && data.date !== ui.day && root.__dayFeed) { root.__dayFeed.waehleTag(data.date, true); return; }
      nav.go('meet.details', { meetId: data.meet });
    },
    'mb-review': (data) => nav.go('meet.review', { meetId: data.meet }),
    'mb-new-meet': () => {
      // Raum-/Personen-Kontext des Browsers in den Entwurf übernehmen.
      const context = opts.context || {};
      const input = context.crewId
        ? { withCrewId: context.crewId }
        : context.personId
          ? { withPersonIds: [context.personId] }
          : {};
      const draft = repo.createDraft(input);
      nav.go('newMeet.discover', { draftId: draft.id });
    },
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
    'mb-week': (data) => {
      ui.day = addDays(ui.day, Number(data.delta));
      ctx.render();
    },
    // Runde 2: Der Heute-Knopf springt zum heutigen Tag. Im Kalender weich wie ein Tipp
    // auf den Tag, sonst durch Neuzeichnen.
    'mb-today': () => {
      const heute = toISODate(now());
      const sektion = root.querySelector(`[data-day-section="${heute}"]`);
      if (ui.view === 'calendar' && root.__dayFeed && sektion) { root.__dayFeed.waehleTag(heute, true); return; }
      ui.day = heute;
      ctx.render();
    },
    'mb-day': (data) => {
      if (ui.view === 'calendar' && root.__dayFeed) { root.__dayFeed.waehleTag(data.date, true); return; }
      ui.day = data.date;
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
    // v7 A30b: Die Jahresbahn ist ziehbar UND antippbar — ein Tap auf ein Nachbarjahr
    // rastet es genauso mittig ein wie das Loslassen nach einem Zug.
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
    // v3.1 §7: Ein Tag aus einem anderen Monat ist wählbar; Monatsraster, KW-Kopfzeile und
    // Tagesleiste springen anschließend gemeinsam auf den gewählten Tag.
    'mb-picker-day': (data) => {
      ui.day = data.date;
      ui.picker = null;
      ctx.render();
    },
    // Runde 4: Mini-Boxen, Zeichen und Fächer steuert ortMarken selbst (ui/map.js). Ein Tipp auf die
    // freie Karte schließt einen offenen Fächer — das tut der Baukasten; hier nur für die Ersatzfläche.
    'mb-map-close': () => { kartenStand?.marken?.schliessen(); },
  });
}

// --- Route meet.home (v3.1: screenScaffold, history 'off') ---

// v3.1 §3: Der Meet-Tab zeigt ausschließlich Kommendes/Aktives — kein Verlauf-Umschalter.
const HOME_OPTS = { context: {}, uiKey: 'meetHome', title: t('Meet'), history: 'off' };

function renderMeetHome(ctx) {
  const parts = meetBrowserParts(ctx, HOME_OPTS);

  // Bottom-Ebene: „+ Meet" (Liste) bzw. weicher Auslauf, darunter die Bottom-Navigation.
  // Beides liegt ÜBER der einen Scrollfläche — Inhalt läuft sichtbar darunter durch und
  // bleibt dank bottomInset vollständig nach oben scrollbar.
  // Die Navigation ist ein echtes Bedienelement und deckt daher deckend ab; darüber blendet
  // der Inhalt weich aus, statt als Geisterschrift durch die Leiste zu scheinen.
  // v4 P0-1: Die Bottom-Navigation gehört jetzt der App-Chrome (app.js) und steht
  // außerhalb der Seite. Die Seite trägt nur noch ihr eigenes Bedienelement.
  const bottom = parts.view === 'map' ? '' : (parts.cta || '');

  const html = screenScaffold({
    page: true,
    header: parts.header,
    body: parts.body,
    bottom,
    bottomInset: parts.view === 'map' ? 0 : (parts.cta ? CTA_INSET : 24),
    overlays: parts.overlays,
    scrollKey: parts.scrollKey,
  });
  return { html, bind: (root, boundCtx) => bindMeetBrowserBody(root, boundCtx, HOME_OPTS) };
}

export const meetBrowserScreens = {
  'meet.home': renderMeetHome,
};
