// Bereich Neues Meet (reference/current 08.1–08.13, v14 Konzept 2a): Composer + „Was machen?".
// Alle Routen arbeiten über ctx.repo (getDraft/updateDraft/publishDraft/discardDraft).
//
// v3.1-Runtime-Grammatik: JEDE Route baut auf screenScaffold() — genau EINE Scrollfläche,
// CTA/Composer als absolute Bottom-Ebene darüber (bottomBar), Sheets als höchste Ebene.
// Panels dieses Bereichs nutzen dieselbe Ordnung über nmPanel() (Kopf · eine Scrollfläche ·
// Bottom-Ebene). Keine weiße Bodenleiste schneidet mehr Inhalt ab; fitInsets() misst die
// Bottom-Ebene und hält den letzten Inhalt vollständig nach oben scrollbar.
//
// Exportiert zusätzlich renderDiscoverCore/bindDiscoverCore — die „Was machen?"-Fähigkeiten
// (Suche, Filter, Karte, Vorschlagsliste, Eigene Idee) als eingebettbarer Block für
// „Aktivität vorschlagen" (05.6e):
//   opts = { draftId?, onPick?, uiKey, submitLabel?, searchTop?, hideSubmit?, hideSheets? }
//   searchTop:true   → Suchfeld/Idee-Feld oben unter der Filterzeile statt in der unteren Leiste
//   hideSubmit:true  → keine eigene untere Leiste; der aufrufende Screen stellt seinen eigenen
//                      CTA (in seiner Bottom-Ebene). Ohne die Option: 08.2-Optik.
//   hideSheets:true  → Sheets (08.3/08.5) liefert der Aufrufer über discoverOverlays() in die
//                      overlays-Ebene seines Scaffolds.
// Die Entdecken-Fläche fließt (keine eigene Scrollfläche), wenn sie in einer Scrollfläche
// liegt; steht sie in einer alten Flex-Kette, stellt bindDiscoverCore das Scrollen selbst her.

import { esc, bindActions, scrollFor, rueckmeldung } from '../core/html.js';
// Sprachen: als tx/tnx importiert — die Datei hat lokale Bindungen namens `t` (Regler-Anteil, Termine).
import { t as tx, tn as tnx, tk, zahl, sprache } from '../core/sprache.js';
import { activityIconSvg, activityIconKey, iconKeyForText } from '../ui/activity-icons.js';
import { STUFEN, artVon } from '../engine/suggestion-engine.js';
import { ME } from '../data/ids.js';
// v7 A37 (spec/08 §2): Auch die kompakte Gruppenzeile im Sheet „Mit wem" zeigt das
// kanonische Gruppenbild — dieselbe Darstellung wie Crew-Rail und Gruppenliste.
import { gruppenKreis } from './room.js';
import {
  screenScaffold, bottomBar, bottomFade, edgeFadeRow, personAvatar, personMarker,
  dirtyGuard, discardSheet, discardActions, avatarFlaeche,
  radSpalte, bindRad, RAD_ZEILE, RAD_SICHTBAR, leerZeile, passeUntereKanteAn, cardEdgeFade,
} from '../ui/components.js';
import { cross as crossSmallIcon } from '../ui/icons.js';
import { startAnsicht, karteHalten, ortAnPunkt, passeAufPunkte, routenZiel, oeffneRoute } from '../ui/map.js';
// Runde 4: Die gemeinsamen Karten-Bausteine von P3 (ortMarken, KARTEN_SPALTE) kommen gerade erst
// dazu. Über den Namensraum gelesen, bricht nichts, solange einer noch fehlt.
import * as kartenBausteine from '../ui/map.js';
import {
  STUFEN_KM, entfernungKm, bildpunkt,
  meterProPixel, zoomFuerRadius, hatLage, kmText,
} from '../core/entfernung.js';
import {
  now, toISODate, fromISODate, weekdayShort, weekdayLong, monthLongByIndex, tagMonatKurz, wochenInitialen,
  istJetzt, terminText, jetztTermin, gleicherTermin,
} from '../core/dates.js';

const FONT = "'Instrument Sans',sans-serif";
const TITLE_FONT = "'Bricolage Grotesque',sans-serif";

// Kategorien (08.5): nur im Filter, nie als Reihe in der Hauptansicht.
// Sprachen: `label` bleibt deutsch — es wird als Aktivität einer Vorlage gespeichert und beim
// Übernehmen verglichen (sv-use). Angezeigt wird `anzeige`.
const CATEGORIES = [
  { id: 'egal', label: 'Egal', anzeige: tx('Egal') },
  { id: 'sport', label: 'Sport', anzeige: tx('Sport') },
  { id: 'essen', label: 'Essen', anzeige: tx('Essen') },
  { id: 'ausgehen', label: 'Ausgehen', anzeige: tx('Ausgehen') },
  { id: 'chillen', label: 'Chillen', anzeige: tx('Chillen') },
  { id: 'event', label: 'Event', anzeige: tx('Event') },
];

const DEFAULT_FILTER = { category: 'egal', placeMode: 'egal', radiusKm: 10, budget: null };

// Ein Ort im Entwurf trägt mehr als seinen Namen: seit der echten Karte gehören Länge und
// Breite dazu. Diese Stelle übernimmt ihn unverändert und lässt nur das weg, was allein den
// Entwurf angeht (Modus, Automatik, Person).
function ortAusEntwurf(place) {
  if (!place) return null;
  const { mode, auto, personId, ...ort } = place;
  return { ...ort, address: ort.address || '' };
}

// --- Bereichseigene Icons (1:1 aus reference/current/source/08-NeuesMeet.dc.html) ---

const bookmarkIcon = (c = 'var(--ink)', s = 16) => `<svg width="${s}" height="${s}" viewBox="0 0 24 24" fill="none" style="pointer-events:none"><path d="M6.5 3.5h11a1 1 0 0 1 1 1V21l-6.5-3.8L5.5 21V4.5a1 1 0 0 1 1-1Z" stroke="${c}" stroke-width="1.8" stroke-linejoin="round"></path></svg>`;
const bookmarkPlusIcon = (c = 'var(--green-dark)', s = 16) => `<svg width="${s}" height="${s}" viewBox="0 0 24 24" fill="none" style="pointer-events:none"><path d="M6.5 3.5h11a1 1 0 0 1 1 1V21l-6.5-3.8L5.5 21V4.5a1 1 0 0 1 1-1Z" stroke="${c}" stroke-width="1.8" stroke-linejoin="round"></path><path d="M12 8v5M9.5 10.5h5" stroke="${c}" stroke-width="1.8" stroke-linecap="round"></path></svg>`;
const bookmarkCheckIcon = (c = 'var(--green-dark)', s = 20) => `<svg width="${s}" height="${s}" viewBox="0 0 24 24" fill="none" style="pointer-events:none"><path d="M6.5 3.5h11a1 1 0 0 1 1 1V21l-6.5-3.8L5.5 21V4.5a1 1 0 0 1 1-1Z" stroke="${c}" stroke-width="1.8" stroke-linejoin="round"></path><path d="m9.3 9.8 2 2 3.6-4" stroke="${c}" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"></path></svg>`;
const greenSearchIcon = (s = 20) => `<svg width="${s}" height="${s}" viewBox="0 0 24 24" fill="none" style="pointer-events:none"><circle cx="11" cy="11" r="7" stroke="var(--green-dark)" stroke-width="1.8"></circle><path d="m16.5 16.5 4 4" stroke="var(--green-dark)" stroke-width="1.8" stroke-linecap="round"></path></svg>`;
const filterIcon = (c = 'var(--ink)') => `<svg width="14" height="14" viewBox="0 0 24 24" fill="none" style="pointer-events:none"><path d="M4 6h16M7 12h10M10 18h4" stroke="${c}" stroke-width="2" stroke-linecap="round"></path></svg>`;
const routeIcon = (c = 'var(--ink)') => `<svg width="13" height="13" viewBox="0 0 24 24" fill="none" style="pointer-events:none"><path d="M6 19h9a3.5 3.5 0 0 0 0-7H9a3.5 3.5 0 0 1 0-7h9" stroke="${c}" stroke-width="1.8" stroke-linecap="round"></path><circle cx="4.5" cy="19" r="1.8" fill="${c}"></circle><circle cx="19.5" cy="5" r="1.8" fill="${c}"></circle></svg>`;
const globeIcon = (c = 'var(--ink)', s = 13) => `<svg width="${s}" height="${s}" viewBox="0 0 24 24" fill="none" style="pointer-events:none"><circle cx="12" cy="12" r="8.6" stroke="${c}" stroke-width="1.8"></circle><path d="M3.4 12h17.2M12 3.4c-4.8 4.9-4.8 12.3 0 17.2 4.8-4.9 4.8-12.3 0-17.2Z" stroke="${c}" stroke-width="1.8"></path></svg>`;
const instagramIcon = (c = 'var(--ink)', s = 13) => `<svg width="${s}" height="${s}" viewBox="0 0 24 24" fill="none" style="pointer-events:none"><rect x="4" y="4" width="16" height="16" rx="5" stroke="${c}" stroke-width="1.8"></rect><circle cx="12" cy="12" r="3.4" stroke="${c}" stroke-width="1.8"></circle><circle cx="16.6" cy="7.4" r="1.2" fill="${c}"></circle></svg>`;
// Echtes TikTok-Noten-Logo (ein Pfad, gefüllt — reference 08 „Social-Auswahl").
const tiktokIcon = (c = 'var(--ink)', s = 13) => `<svg width="${s}" height="${s}" viewBox="0 0 24 24" style="pointer-events:none"><path fill="${c}" d="M16.6 2h-2.9v12.4a2.5 2.5 0 1 1-2.5-2.5c.26 0 .5.04.74.11V9.03a5.5 5.5 0 1 0 4.66 5.44V8.2a6.3 6.3 0 0 0 3.44 1.02V6.3A3.44 3.44 0 0 1 16.6 2Z"></path></svg>`;
const pinIcon = (c = 'var(--ink)', s = 17) => `<svg width="${s}" height="${s}" viewBox="0 0 24 24" fill="none" style="pointer-events:none"><path d="M12 21.5s7-6.1 7-11a7 7 0 1 0-14 0c0 4.9 7 11 7 11Z" stroke="${c}" stroke-width="1.8" stroke-linejoin="round"></path><circle cx="12" cy="10.5" r="2.4" stroke="${c}" stroke-width="1.8"></circle></svg>`;
const houseIcon = (c = 'var(--ink)', s = 15) => `<svg width="${s}" height="${s}" viewBox="0 0 24 24" fill="none" style="pointer-events:none"><path d="m4 11 8-7.5 8 7.5M6 9.5V20h12V9.5" stroke="${c}" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"></path></svg>`;
const personIcon = (c = 'var(--ink)', s = 16) => `<svg width="${s}" height="${s}" viewBox="0 0 24 24" fill="none" style="pointer-events:none"><circle cx="12" cy="8.4" r="3.5" stroke="${c}" stroke-width="1.8"></circle><path d="M5.2 19.5a6.8 6.8 0 0 1 13.6 0" stroke="${c}" stroke-width="1.8" stroke-linecap="round"></path></svg>`;
const groupIcon = (c = 'var(--ink)', s = 16) => `<svg width="${s}" height="${s}" viewBox="0 0 24 24" fill="none" style="pointer-events:none"><circle cx="9.5" cy="8.5" r="3.2" stroke="${c}" stroke-width="1.8"></circle><path d="M3.5 19.5c0-3.2 2.7-5 6-5s6 1.8 6 5" stroke="${c}" stroke-width="1.8" stroke-linecap="round"></path><path d="M16 6.2a3 3 0 0 1 0 5.6M17.5 14.9c1.9.5 3 1.9 3 4.6" stroke="${c}" stroke-width="1.8" stroke-linecap="round"></path></svg>`;
const noteRowIcon = (c = 'var(--muted-light)', s = 17) => `<svg width="${s}" height="${s}" viewBox="0 0 24 24" fill="none" style="flex:none;pointer-events:none"><path d="M5 4.5h14v15H5zM8 9h8M8 13h5" stroke="${c}" stroke-width="1.8" stroke-linecap="round"></path></svg>`;
const loopIcon = (c = 'var(--blue-dark)', s = 17) => `<svg width="${s}" height="${s}" viewBox="0 0 24 24" fill="none" style="flex:none;pointer-events:none"><path d="M4 12a8 8 0 0 1 8-8h4M20 12a8 8 0 0 1-8 8H8" stroke="${c}" stroke-width="1.8" stroke-linecap="round"></path><path d="M13.5 1.5 16.5 4l-3 2.5M10.5 22.5 7.5 20l3-2.5" stroke="${c}" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"></path></svg>`;
const clockIcon = (c = 'var(--ink)', s = 16) => `<svg width="${s}" height="${s}" viewBox="0 0 24 24" fill="none" style="flex:none;pointer-events:none"><circle cx="12" cy="12" r="8.5" stroke="${c}" stroke-width="1.8"></circle><path d="M12 7.5V12l3.2 2" stroke="${c}" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"></path></svg>`;
const folderIcon = (c = 'var(--ink)', s = 17) => `<svg width="${s}" height="${s}" viewBox="0 0 24 24" fill="none" style="flex:none;pointer-events:none"><path d="M3.5 7A1.5 1.5 0 0 1 5 5.5h3.4l1.9 2.1h8.2A1.5 1.5 0 0 1 20 9.1v8.4a1.5 1.5 0 0 1-1.5 1.5H5A1.5 1.5 0 0 1 3.5 17.5V7Z" stroke="${c}" stroke-width="1.8" stroke-linejoin="round"></path></svg>`;
const pizzaIcon = (c = 'var(--ink)', s = 17) => `<svg width="${s}" height="${s}" viewBox="0 0 24 24" fill="none" style="flex:none;pointer-events:none"><path d="M12 3 3.5 20.5h17L12 3Z" stroke="${c}" stroke-width="1.8" stroke-linejoin="round"></path><circle cx="12" cy="11" r="1.2" fill="${c}"></circle><circle cx="10" cy="16" r="1.2" fill="${c}"></circle><circle cx="14.2" cy="16.4" r="1.2" fill="${c}"></circle></svg>`;
const handleIcon = (c = 'var(--line-solid)', s = 14) => `<svg width="${s}" height="${s}" viewBox="0 0 24 24" fill="none" style="flex:none;pointer-events:none"><path d="M6 8h12M6 12h12M6 16h12" stroke="${c}" stroke-width="1.8" stroke-linecap="round"></path></svg>`;
const xSmallIcon = (c = 'var(--muted)', s = 13) => `<svg width="${s}" height="${s}" viewBox="0 0 24 24" fill="none" style="flex:none;pointer-events:none"><path d="M7 7l10 10M17 7 7 17" stroke="${c}" stroke-width="2.2" stroke-linecap="round"></path></svg>`;
const xLargeIcon = (c = 'var(--ink)', s = 22) => `<svg width="${s}" height="${s}" viewBox="0 0 24 24" fill="none" style="pointer-events:none"><path d="M6 6l12 12M18 6 6 18" stroke="${c}" stroke-width="2" stroke-linecap="round"></path></svg>`;
const backChevronIcon = (c = 'var(--ink)', s = 18) => `<svg width="${s}" height="${s}" viewBox="0 0 24 24" fill="none" style="pointer-events:none"><path d="M14.5 5.5 8 12l6.5 6.5" stroke="${c}" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"></path></svg>`;
const chevronUpIcon = (c = 'var(--green-dark)', s = 13) => `<svg width="${s}" height="${s}" viewBox="0 0 24 24" fill="none" style="flex:none;pointer-events:none"><path d="m6 14.5 6-6 6 6" stroke="${c}" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"></path></svg>`;
const chevronDownIcon = (c = 'var(--green-dark)', s = 13) => `<svg width="${s}" height="${s}" viewBox="0 0 24 24" fill="none" style="flex:none;pointer-events:none"><path d="m6 9.5 6 6 6-6" stroke="${c}" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"></path></svg>`;
const rowChevronIcon = (c = 'var(--muted-light)', s = 14) => `<svg width="${s}" height="${s}" viewBox="0 0 24 24" fill="none" style="flex:none;pointer-events:none"><path d="M9.5 5.5 16 12l-6.5 6.5" stroke="${c}" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"></path></svg>`;
const searchSmallIcon = (c = 'var(--muted-light)', s = 14) => `<svg width="${s}" height="${s}" viewBox="0 0 24 24" fill="none" style="pointer-events:none;flex:none"><circle cx="11" cy="11" r="6.5" stroke="${c}" stroke-width="1.8"></circle><path d="m15.8 15.8 4.2 4.2" stroke="${c}" stroke-width="1.8" stroke-linecap="round"></path></svg>`;
const redoIcon = (c = 'var(--green-dark)', s = 11) => `<svg width="${s}" height="${s}" viewBox="0 0 24 24" fill="none" style="pointer-events:none"><path d="M4 12a8 8 0 1 0 2.3-5.6M4 4v4h4" stroke="${c}" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"></path></svg>`;

// --- kleine Helfer ---

const pad2 = (n) => String(n).padStart(2, '0');
const nowHHMM = () => { const d = now(); return `${pad2(d.getHours())}:${pad2(d.getMinutes())}`; };
const fmtKm = (km) => zahl(km);
const dayMonth = (iso) => tagMonatKurz(fromISODate(iso));
const clamp = (v, min, max) => Math.min(max, Math.max(min, v));
const categoryLabel = (id) => CATEGORIES.find((c) => c.id === id)?.label || '';
const categoryAnzeige = (id) => CATEGORIES.find((c) => c.id === id)?.anzeige || '';
const labelStyle = 'font-size:11px;font-weight:650;letter-spacing:.09em;text-transform:uppercase;color:var(--muted-light)';

// Runde 4 (F2): „Jetzt" im Entwurf — ohne Termin (when null) ODER ein Termin mit Marke now.
// Ein Entwurf schreibt „Jetzt" erst beim Senden fest, deshalb gilt es hier ohne Zeitfenster.
const entwurfIstJetzt = (draft) => !draft?.when || istJetzt(draft.when, { fensterMin: Infinity });
const terminAnzeige = (termin) => terminText(termin, { fensterMin: Infinity, datum: (iso) => `${weekdayShort(iso)} ${dayMonth(iso)}` });

// Runde 4 (F1, Jonathan: „so ein Feld, wie man es von Profilbildern kennt"): Was „Jetzt" ist,
// trägt denselben weichen grünen Randpuls wie ein freies Profilbild oder eine freie Gruppe
// (cardEdgeFade aus components.js). Außen keine eckige Box: clip-path mit Rundung schneidet
// den unscharfen Ring auch dort rund, wo WebKit overflow:hidden an gefilterten Ebenen übergeht.
function jetztPuls(radius) {
  return `<span data-role="jetzt-puls" aria-hidden="true" style="position:absolute;inset:0;border-radius:${radius}px;clip-path:inset(0 round ${radius}px);isolation:isolate;pointer-events:none">${cardEdgeFade(radius)}</span>`;
}

// v5 A29b: Der Knauf wird über transform bewegt, nicht über die Flex-Ausrichtung —
// nur so gibt es einen Ausgangswert, von dem aus animiert werden kann. Da der Knoten
// beim In-Place-Abgleich (v5 A19) erhalten bleibt, läuft der Übergang wirklich sichtbar.
function switchHtml(on, color = 'var(--green)', size = 'm') {
  const w = size === 's' ? 36 : 42;
  const h = size === 's' ? 21 : 25;
  const knob = h - 6;
  const weg = w - knob - 6;
  return `<span data-switch="${on ? 'an' : 'aus'}" style="width:${w}px;height:${h}px;border-radius:999px;background:${on ? color : 'var(--handle)'};display:block;position:relative;padding:3px;box-sizing:border-box;flex:none;pointer-events:none;transition:background-color .22s ease-out"><span data-switch-knob style="position:absolute;left:3px;top:3px;width:${knob}px;height:${knob}px;border-radius:50%;background:var(--surface);transform:translateX(${on ? weg : 0}px);transition:transform .22s cubic-bezier(.4,0,.2,1)"></span></span>`;
}

// Runder Mehrfach-Control wie RSVP (08.2): 26px, gefüllt grün mit Haken / leerer Ring.
function selCircle(on) {
  return on
    ? '<span style="width:26px;height:26px;border-radius:50%;background:var(--green);display:flex;align-items:center;justify-content:center;flex:none;pointer-events:none"><svg width="12" height="12" viewBox="0 0 24 24" fill="none"><path d="m7.5 12.5 3 3 6-6.5" stroke="var(--on-accent)" stroke-width="2.6" stroke-linecap="round" stroke-linejoin="round"></path></svg></span>'
    : '<span style="width:26px;height:26px;border-radius:50%;border:1.5px solid var(--ink-a16);box-sizing:border-box;flex:none;pointer-events:none"></span>';
}

function checkCircle(active) {
  return active
    ? '<svg width="20" height="20" viewBox="0 0 24 24" fill="none" style="pointer-events:none;flex:none"><circle cx="12" cy="12" r="10" fill="var(--green)"></circle><path d="m8 12 2.6 2.6L16.4 9" stroke="var(--on-accent)" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"></path></svg>'
    : '<span style="width:20px;height:20px;border-radius:50%;border:1.8px solid var(--line-solid);box-sizing:border-box;pointer-events:none;flex:none"></span>';
}

// --- Panel-Gerüst im 08.x-Stil, gebaut wie screenScaffold (v3.1 §1) -------------------
// Kopf (Handle/Titel/Umschalter) · GENAU EINE Scrollfläche · Bottom-Ebene absolut darüber.
// Der Inhalt läuft sichtbar unter die Bottom-Ebene und bleibt durch fitInsets() vollständig
// nach oben scrollbar — keine weiße Bodenleiste schneidet mehr etwas ab.
//   nmPanel({ title, header, body, bottom, top, scrollKey, closeAct, dim, gap, pad })

// v4 P0-5/P0-5d: Über dem Inhalt liegt KEINE Farbfläche mehr. Diese Funktion ist — wie
// bottomFade() im Fundament — nur noch ein DURCHSICHTIGER Abstandhalter, der die Bottom-Ebene
// auf Höhe hält. Das weiche Ausblenden macht die Maske der Panel-Scrollfläche (fitInsets).
function panelFade(height = 22) {
  return `<div style="height:${height}px;flex:none;pointer-events:none"></div>`;
}

// Weiche Kante als MASKE AUF dem Inhalt (nie als Fläche darüber). Gibt CSS-Text zurück.
// topPx = Fadehöhe unter dem Kopf. bottomPx = Höhe der REALEN Bedienebene: dort beginnt der
// Inhalt auszublenden (über BOTTOM_FADE_LEN weich), und darunter ist er ganz weg — so guckt
// er nicht durch die Lücken zwischen den Knöpfen, ohne dass eine Farbfläche nötig wäre.
const BOTTOM_FADE_LEN = 56;

// v5 A21: Der obere Fade steht als VARIABLE im Verlauf. Sie beginnt bei 0 — im
// Ausgangszustand ist die Oberkante also scharf — und wächst erst mit dem echten
// Scrollweg (bindTopFade in app.js zieht --fade-top nach).
function softMaskValue(topPx, bottomPx) {
  const stops = topPx > 0 ? ['transparent 0', '#000 var(--fade-top, 0px)'] : ['#000 0'];
  if (bottomPx > 0) {
    const len = Math.max(12, Math.min(BOTTOM_FADE_LEN, bottomPx));
    const rest = bottomPx - len;
    stops.push(`#000 calc(100% - ${bottomPx}px)`);
    stops.push(rest > 0 ? `transparent calc(100% - ${rest}px)` : 'transparent 100%');
    if (rest > 0) stops.push('transparent 100%');
  } else {
    stops.push('#000 100%');
  }
  return `linear-gradient(180deg,${stops.join(',')})`;
}

function softMaskCss(topPx, bottomPx) {
  if (!topPx && !bottomPx) return '';
  const value = softMaskValue(topPx, bottomPx);
  return `--fade-top:0px;--fade-top-max:${topPx || 0}px;mask-image:${value};-webkit-mask-image:${value};`;
}

function setSoftMask(el, topPx, bottomPx) {
  const value = softMaskValue(topPx, bottomPx);
  // v5 A21: Die Obergrenze wird mitgesetzt; die aktuelle Tiefe bleibt beim bereits
  // erreichten Scrollwert, damit ein Neuberechnen der Ebenenhöhe nicht zurückspringt.
  el.style.setProperty('--fade-top-max', `${topPx || 0}px`);
  if (!el.style.getPropertyValue('--fade-top')) el.style.setProperty('--fade-top', '0px');
  el.style.maskImage = value;
  el.style.webkitMaskImage = value;
}

// Ab welcher Höhe über der Unterkante ausgeblendet wird: genau die real gemessene Höhe der
// Bedienebene. Vor der Messung gilt der Mindestwert.
const BOTTOM_FADE_MIN = 24;
const bottomFadeFor = (heightPx) => Math.max(BOTTOM_FADE_MIN, Math.round(heightPx));

function nmPanel(options = {}) {
  const {
    title = '', header = '', body = '', bottom = '', top = null,
    scrollKey = 'nm-panel', closeAct = 'sheet-close', dim = '.4', gap = 13, pad = 20, mark = '',
    after = '', height = null, fade = false, boxExtra = '', scrollExtra = '',
  } = options;
  // height: feste Sheet-Höhe (zweistufiges Sheet, D5/F1) · top: von oben fixiert · sonst inhaltshoch.
  const panelPos = height != null ? `bottom:0;height:${height};`
    : top != null ? `top:${top}px;bottom:0;` : 'bottom:0;max-height:92%;';
  // Innerer Fade: durchlaufender Inhalt blendet unter dem Sheet-Kopf UND über der
  // Bottom-Ebene weich aus (D5) — beides als Maske auf dem Inhalt, keine Farbfläche.
  // fitInsets() ersetzt den unteren Wert später durch die real gemessene Ebenenhöhe.
  const fadeTop = fade ? 16 : 0;
  const scrollMask = softMaskCss(fadeTop, bottom ? BOTTOM_FADE_MIN : 0);
  const head = `<div style="flex:none;position:relative;z-index:3;display:flex;flex-direction:column;gap:11px;padding:14px 0 ${title || header ? '11px' : '4px'}">
<span style="width:36px;height:4px;border-radius:2px;background:var(--handle);align-self:center;flex:none"></span>
${title ? `<span style="font-family:${TITLE_FONT};font-size:19px;font-weight:650;padding:0 ${pad}px">${esc(title)}</span>` : ''}
${header}</div>`;
  const bottomLayer = bottom
    ? `<div data-layerbottom style="position:absolute;left:0;right:0;bottom:0;z-index:4;display:flex;flex-direction:column;pointer-events:none">${panelFade()}${bottom}</div>`
    : '';
  return `<div ${mark} style="position:absolute;inset:0;z-index:14">
<div data-act="${closeAct}" style="position:absolute;inset:0;background:rgba(33,30,26,${dim})"></div>
<div data-layerbox style="position:absolute;left:0;right:0;${panelPos}border-radius:28px 28px 0 0;background:var(--surface);box-shadow:0 -8px 24px var(--shadow-18);display:flex;flex-direction:column;overflow:hidden;${boxExtra}">
${head}
<div data-layerscroll data-fadetop="${fadeTop}" data-scroll-keep="${esc(scrollKey)}" style="flex:1;min-height:0;overflow-y:auto;overflow-x:hidden;scrollbar-width:none;position:relative;z-index:1;display:flex;flex-direction:column;gap:${gap}px;padding:0 ${pad}px ${bottom ? (EINSATZ_GEMESSEN.get(scrollKey) ?? 96) : 30}px;${scrollMask}${scrollExtra}">${body}</div>
${bottomLayer}</div>${after}</div>`;
}

// Bottom-Ebene eines Panels: NUR die echten Bedienelemente sind klickbar und tragen einen
// eigenen Grund. v4 P0-5: kein deckender vollbreiter Träger mehr — der Inhalt läuft sichtbar
// dahinter durch und blendet über die Maske der Scrollfläche weich aus.
function panelBottom(innerHtml, extraStyle = '') {
  return `<div style="pointer-events:auto;padding:2px 20px 28px;display:flex;flex-direction:column;gap:9px;${extraStyle}">${innerHtml}</div>`;
}

// Misst jede Bottom-Ebene und setzt den passenden Innenabstand der zugehörigen Scrollfläche.
// So bleibt die letzte Karte immer vollständig erreichbar — unabhängig von Viewport/Inhalt.
// Dieselbe Messung bestimmt die untere Maskenkante: der Inhalt fadet exakt über der real
// gerenderten Bedienebene aus, statt an einer harten Kante zu enden (P0-5d).
// Runde 4 (C4, gemessen: „Was machen" unten gewählt → scrollTop 756 → 681, „Mit wem" 181 → 161):
// Jeder Neuaufbau setzte den Innenabstand zurück auf den Wert aus dem Markup (96 px) — die
// Scrollfläche wurde kürzer, der Browser kappte die Scrollposition, und fitInsets() stellte
// danach zwar den Abstand wieder her, aber nicht die Position. Jetzt steht der gemessene
// Abstand schon im Markup (EINSATZ_GEMESSEN), und die gemerkte Position wird nach dem Einpassen
// noch einmal gesetzt — im selben Durchlauf, also bevor irgendetwas gezeichnet wird.
const EINSATZ_GEMESSEN = new Map();

function scrollHalten(flaeche) {
  const schluessel = flaeche?.dataset?.scrollKeep;
  const gemerkt = schluessel ? scrollFor(schluessel) : null;
  if (!gemerkt || Math.abs(flaeche.scrollTop - gemerkt.top) < 1) return;
  flaeche.scrollTop = gemerkt.top;
}

function fitInsets(root) {
  const flaechen = [];
  const scaffoldScroll = root.querySelector('.screen-scroll');
  const scaffoldBottom = root.querySelector('.screen-bottom');
  if (scaffoldScroll && scaffoldBottom) {
    const h = Math.round(scaffoldBottom.offsetHeight);
    scaffoldScroll.style.paddingBottom = `${h + 14}px`;
    setSoftMask(scaffoldScroll, 14, bottomFadeFor(h));
    scrollHalten(scaffoldScroll);
    flaechen.push([scaffoldScroll, false]);
  }
  root.querySelectorAll('[data-layerbox]').forEach((box) => {
    const scroll = box.querySelector(':scope > [data-layerscroll]');
    const bottom = box.querySelector(':scope > [data-layerbottom]');
    if (!scroll) return;
    const h = bottom ? Math.round(bottom.offsetHeight) : 0;
    scroll.style.paddingBottom = bottom ? `${h + 12}px` : '30px';
    setSoftMask(scroll, Number(scroll.dataset.fadetop || 0), bottom ? bottomFadeFor(h) : 0);
    scrollHalten(scroll);
    flaechen.push([scroll, Boolean(bottom && h > 0)]);
  });
  // Runde 4 (C4, gemessen: „Mit wem" sprang danach noch 10 px): Nach dieser Bindung hebt
  // passeUntereKanteAn() (app.js → components.js) den Innenabstand noch einmal an. Gemerkt wird
  // deshalb erst der ENDGÜLTIGE Wert, und die Scrollposition wird danach noch einmal gesetzt —
  // als Mikroaufgabe: nach dem ganzen Zeichnen, vor dem nächsten Bild.
  queueMicrotask(() => {
    for (const [flaeche, merken] of flaechen) {
      if (!flaeche.isConnected) continue;
      if (merken) EINSATZ_GEMESSEN.set(flaeche.dataset.scrollKeep, Math.round(parseFloat(flaeche.style.paddingBottom) || 0));
      scrollHalten(flaeche);
    }
  });
  // Runde 2: Die Maske endet an der Oberkante der echten Bedienelemente, nicht der Ebene.
  passeUntereKanteAn(root);
}

// --- Draft-Beschaffung: fehlt/ungültig → sofort neuen Draft anlegen, Route ersetzen ---

function ensureDraft(ctx) {
  const { repo, params, ui } = ctx;
  const existing = params.draftId ? repo.getDraft(params.draftId) : null;
  if (existing) return { draft: existing, replaced: false };
  if (!ui.autoDraftId || !repo.getDraft(ui.autoDraftId)) ui.autoDraftId = repo.createDraft({}).id;
  return { draft: repo.getDraft(ui.autoDraftId), replaced: true };
}

function scheduleReplace(ctx, draft, replaced) {
  if (!replaced || ctx.ui.replaceScheduled) return;
  ctx.ui.replaceScheduled = true;
  const routeId = ctx.route.id;
  const params = { ...ctx.params, draftId: draft.id };
  window.setTimeout(() => {
    const current = ctx.nav.current();
    if (current.id === routeId && current.params?.draftId !== draft.id) {
      ctx.nav.replace(routeId, params);
    } else if (!current.id.startsWith('newMeet.')) {
      ctx.repo.discardDraft(draft.id);
    }
  }, 0);
}

// =====================================================================
// Auswahl-Modell (08.2): Erste Wahl = Hauptvorschlag (draft.idea),
// alle weiteren = Alternativen (draft.ideaAlternatives). Live im Draft.
// =====================================================================

const descKey = (d) => (d.suggestionId ? `s:${d.suggestionId}` : d.ownId ? `o:${d.ownId}` : `t:${(d.title || '').toLowerCase()}`);

function descFromSuggestion(s) {
  return {
    title: s.title, icon: s.icon || null, category: s.category || null,
    source: 'suggestion', suggestionId: s.id, ownId: null,
    place: s.place ? { ...s.place } : null,
  };
}

// v7 A26 (spec/05 §3): Eine eigene Idee trägt KEIN selbst gewähltes Symbol mehr. Das Feld
// bleibt leer, damit die gemeinsame Ableitung aus Kategorie und Titel greift — ein
// mitgeschlepptes Emoji würde dort nur eine Wahl vortäuschen, die nirgends ankommt.
function descFromOwn(o) {
  return { title: o.title, icon: null, category: o.category || eigeneKategorie(o.title), source: 'own', suggestionId: null, ownId: o.id, place: null };
}

// --- v7 A26: abgeleitetes Aktivitätsicon statt manueller Auswahl -----------------------
// Die Ableitung ist bewusst schlicht und in dieser Reihenfolge nachlesbar — keine
// geratene Automatik und keine behauptete KI:
//   1. KATEGORIE zuerst. Sie bestimmt die Grundfamilie des Symbols (KATEGORIE_SYMBOL).
//      Eine eigene Idee bringt keine von Hand gewählte Kategorie mit; für sie liest
//      eigeneKategorie() eine aus dem Titel ab und speichert sie an der Idee.
//   2. STICHWORT im Titel danach. Ein eindeutiges Wort schärft das Symbol innerhalb der
//      Familie („Plattenabend" → Note statt allgemeinem Ausgehen-Symbol).
//   3. Bleibt beides stumm, zeichnet activityIconSvg das neutrale Funkeln — ein Symbol,
//      nie eine leere Fläche.
const EIGENE_WORTE = [
  [/koch|pasta|pizza|essen|brunch|dinner|grill|bbq|backen|frühstück|fruehstueck|café|cafe|kaffee/i, 'essen'],
  [/kino|film|serie|konzert|jazz|musik|platten|bar|club|tanz|theater|oper|karaoke|festival|open.?air|bier|wein|cocktail|trink|party|feier|disco/i, 'ausgehen'],
  [/lauf|joggen|wander|spazier|kletter|boulder|schwimm|baden|rad|bike|yoga|ball|fußball|fussball|volleyball|spikeball|tennis|training|sport/i, 'sport'],
  [/markt|messe|fest|feuerwerk|ausstellung|vernissage|turnier/i, 'event'],
  [/see|strand|sonne|picknick|brettspiel|spieleabend|chill|lesen|sauna/i, 'chillen'],
];

// Kategorie einer eigenen Idee aus dem Titel (EIGENE_WORTE); ohne Treffer „chillen".
function eigeneKategorie(title) {
  const text = String(title || '');
  for (const [muster, kategorie] of EIGENE_WORTE) if (muster.test(text)) return kategorie;
  return 'chillen';
}

// Fable 4 (J14): KEINE eigene Symboltabelle mehr. Das Symbol kommt aus dem einen Katalog
// in ui/activity-icons.js (expliziter Schlüssel → Emoji → Stichwort → Kategorie) — dieselbe
// Ableitung wie auf Meet-Karten, Vorschlägen und Interessen. Vorher stand hier eine zweite
// Stichwortliste, die z. B. „Bier trinken" auf die Welle und „Gaming" auf den Würfel legte.
function abgeleitetesSymbol(title, category) {
  return activityIconKey({ title, category });
}

// Der Beschreibungssatz, den activityIconSvg braucht. Bringt ein Seed-Vorschlag seinen
// eigenen Schlüssel mit, bleibt der unangetastet; sonst greift die Ableitung.
function iconBeschreibung(entry = {}) {
  const title = String(entry.title || '').trim();
  const category = entry.category || null;
  if (entry.icon) return { icon: entry.icon, title, category };
  // Runde 2: Orte aus der Umgebung bringen ihre Art als Schlüssel mit (iconKey) — angesehen:
  // ohne das bekam „Hochberg" den Berg und „Tatzen" den Wanderer, obwohl beides Wanderziele sind.
  if (entry.iconKey) return { iconKey: entry.iconKey, title, category };
  // Ohne Titel gibt es noch nichts abzuleiten. Dann steht bewusst das neutrale Funkeln —
  // sichtbar, aber ohne eine Aussage zu behaupten, die die Idee noch gar nicht trägt.
  if (!title) return { icon: 'sparkle', title, category: null };
  return { icon: abgeleitetesSymbol(title, category), title, category };
}

// Einheitliche Symbolkachel vor dem Titel — dieselbe Grammatik in Vorschlagskarte,
// „Spontanes Treffen" und der Vorschau im Erstellbereich.
function aktivitaetsKachel(eintrag, options = {}) {
  const size = options.size || 32;
  const grund = options.grund || 'var(--paper)';
  const farbe = options.farbe || 'var(--ink)';
  return `<span data-role="aktivitaets-icon" style="width:${size}px;height:${size}px;border-radius:10px;background:${grund};display:flex;align-items:center;justify-content:center;flex:none;pointer-events:none">${activityIconSvg(iconBeschreibung(eintrag), farbe, options.icon || 17)}</span>`;
}

function selectionEntries(draft) {
  const out = [];
  if (draft?.idea?.title) out.push({ ...draft.idea });
  for (const alt of draft?.ideaAlternatives || []) out.push({ ...alt });
  return out;
}

// Schreibt eine Auswahl-Liste zurück in den Draft (inkl. Auto-Ort des Hauptvorschlags).
function applySelection(ctx, draftId, entries) {
  const draft = ctx.repo.getDraft(draftId);
  if (!draft) return;
  const main = entries[0] || null;
  const patch = {
    // v5 A28b: Der Ort gehört zum Hauptvorschlag und wird MITGESCHRIEBEN. Vorher fiel er
    // hier heraus; beim nächsten Lesen war main.place undefined und der automatisch
    // übernommene Treffpunkt verschwand still.
    // v7 A26: Kein '✨'-Ersatzicon mehr. Ein leeres Feld ist hier die richtige Aussage —
    // die Anzeige leitet das Symbol aus Kategorie und Titel ab (activityIconSvg).
    idea: main
      ? {
        title: main.title, icon: main.icon || null, category: main.category || null,
        details: main.details || '', source: main.source || 'suggestion',
        suggestionId: main.suggestionId || null, ownId: main.ownId || null,
        place: main.place ? { ...main.place } : null,
      }
      : null,
    ideaAlternatives: entries.slice(1).map((e) => ({
      title: e.title, icon: e.icon || null, category: e.category || null,
      suggestionId: e.suggestionId || null, ownId: e.ownId || null,
      place: e.place ? { ...e.place } : null,
    })),
  };
  const autoPlace = !draft.place || draft.place.auto;
  if (autoPlace) {
    patch.place = main?.place
      ? { ...main.place, mode: 'search', auto: true }
      : null;
  }
  ctx.repo.updateDraft(draftId, patch);
}

// Runde 2 (Jonathan): Es gibt keinen Alternativen-Schalter mehr. Eine Wahl ist EINE Wahl.
// Ist schon etwas anderes gewählt, fragt die App beim nächsten Tipp kurz nach (wahlFrageHtml):
// „Auswählen" ersetzt, „Als Alternative" sammelt (options.dazu).
function toggleEntry(ctx, draftId, desc, options = {}) {
  const entries = selectionEntries(ctx.repo.getDraft(draftId));
  const key = descKey(desc);
  const index = entries.findIndex((e) => descKey(e) === key);
  const neu = { ...desc, place: desc.place ? { ...desc.place } : null };
  if (index >= 0) entries.splice(index, 1);
  else if (options.dazu) entries.push(neu);
  else entries.splice(0, entries.length, neu);
  applySelection(ctx, draftId, entries);
}

// v6 A16a: „Hauptvorschlag" ist eine RANGAUSSAGE — sie ergibt nur Sinn, wenn es einen
// zweiten Vorschlag gibt. Bei genau einer Wahl ist die Karte schlicht gewählt ('only');
// alle Aufrufer prüfen ohnehin nur auf Wahrheitswert, den Rang liest allein der Chip.
function selState(entries, key) {
  const index = entries.findIndex((e) => descKey(e) === key);
  if (index < 0) return null;
  if (entries.length <= 1) return 'only';
  return index === 0 ? 'main' : 'alt';
}

// Eigene getippte Ideen (08.2b) — private Nutzer-Daten in den Settings, bleiben gespeichert.
function typedOwnIdeas(ctx) {
  return ctx.repo.getSettings().ownIdeas || [];
}

// v7 A26: Die neue Idee bekommt kein Emoji, sondern eine aus dem Titel abgeleitete
// Kategorie. Aus ihr entsteht das Symbol überall gleich — und der Filter kennt die Idee.
function addTypedOwnIdea(ctx, title, extra) {
  const idea = { id: `own-${Date.now()}`, title, extra: extra || tx('eben hinzugefügt'), category: eigeneKategorie(title) };
  ctx.repo.updateSettings({ ownIdeas: [idea, ...typedOwnIdeas(ctx)] });
  return idea;
}

// =====================================================================
// Composer-Bausteine (08.1)
// =====================================================================

// v14 Index: Schloss im Composer ist entfallen (Sichtbarkeit = Aktivitätsstatus in 06.5).
// v5 A29c: Der Loop-Schalter ist die GLOBALE Steuerung dieses Meets und steht deshalb
// genau einmal — in der Kopfzeile. Vorher lag dieselbe Zeile zusaetzlich im Scrollkoerper
// und in der unteren Leiste des Choosers; drei Orte fuer dieselbe Entscheidung.
// v7 A29b (spec/05 §5): Der Loop-Zugang ist ein RUNDER Knopf mit einem Kreis aus zwei
// Pfeilen — kein Switch-Track. Der Zustand steckt in Fläche und Farbe: aus = neutraler
// Umriss, an = ruhige blaue Füllung. Den Namen trägt das aria-label, damit der Knopf ohne
// sichtbaren Text vorgelesen werden kann.
const loopArrowsIcon = (c = 'var(--ink-soft)', s = 18) => `<svg width="${s}" height="${s}" viewBox="0 0 24 24" fill="none" style="pointer-events:none"><path d="M20 12a8 8 0 0 1-8 8 8 8 0 0 1-6.9-4M4 12a8 8 0 0 1 8-8 8 8 0 0 1 6.9 4" stroke="${c}" stroke-width="1.9" stroke-linecap="round"></path><path d="M18.4 3.6V8h-4.4M5.6 20.4V16h4.4" stroke="${c}" stroke-width="1.9" stroke-linecap="round" stroke-linejoin="round"></path></svg>`;

// Runde 3 (Jonathan I8): Ein runder Kopfknopf trifft man auch knapp daneben. Die Trefferfläche
// ist 44 × 44 px (Apple und Google empfehlen mindestens 44 pt); der sichtbare Kreis bleibt so
// groß wie bisher, der negative Rand hält die Abstände in der Zeile unverändert.
function kopfKnopf(kreisHtml, attrs, size) {
  const rand = (44 - size) / 2;
  return `<button ${attrs} style="width:44px;height:44px;margin:-${rand}px;border:0;background:transparent;padding:0;display:flex;align-items:center;justify-content:center;flex:none;cursor:pointer;appearance:none">${kreisHtml}</button>`;
}

function loopRoundButton(loopAn) {
  const kreis = `<span style="width:36px;height:36px;border-radius:50%;box-sizing:border-box;border:1.5px solid ${loopAn ? LOOP_BLUE : 'var(--ink-a14)'};background:${loopAn ? 'var(--blue-tint)' : 'var(--surface)'};display:flex;align-items:center;justify-content:center;pointer-events:none;transition:background-color .2s ease-out,border-color .2s ease-out">${loopArrowsIcon(loopAn ? LOOP_BLUE : 'var(--ink-soft)', 18)}</span>`;
  return kopfKnopf(kreis, `data-act="loop-switch" aria-label="${esc(tx('Loop'))}" aria-pressed="${loopAn}"`, 36);
}

// Runde 3 (Jonathan I1): „Spontanes Treffen" ist keine Zeile mehr zwischen den Pflichtangaben,
// sondern ein leiser Kopfknopf neben Loop und Gespeichert — dieselbe Grammatik wie der Loop:
// aus = neutraler Umriss, an = ruhige grüne Füllung mit grüner Kontur.
function spontanRoundButton(aktiv) {
  const kreis = `<span style="width:36px;height:36px;border-radius:50%;box-sizing:border-box;border:1.5px solid ${aktiv ? 'var(--green)' : 'var(--ink-a14)'};background:${aktiv ? 'var(--green-tint)' : 'var(--surface)'};display:flex;align-items:center;justify-content:center;pointer-events:none;transition:background-color .2s ease-out,border-color .2s ease-out">${activityIconSvg({ icon: 'sparkle' }, aktiv ? 'var(--green-dark)' : 'var(--ink-soft)', 17)}</span>`;
  return kopfKnopf(kreis, `data-act="spontan-pick" data-role="spontan-kopf" aria-label="${esc(tx('Spontanes Treffen'))}" aria-pressed="${aktiv}"`, 36);
}

function composerHeader(draft) {
  const kreis = (size, inner) => `<span style="width:${size}px;height:${size}px;border-radius:50%;box-sizing:border-box;background:var(--surface);border:1.5px solid var(--ink-a10);display:flex;align-items:center;justify-content:center;pointer-events:none">${inner}</span>`;
  const loopAn = Boolean(draft?.loop);
  return `<div style="display:flex;align-items:center;gap:10px;padding:8px 20px 12px">
${kopfKnopf(kreis(36, `<span style="font-size:14px;color:var(--ink);font-family:${FONT}">✕</span>`), `data-act="draft-cancel" aria-label="${esc(tx('Abbrechen'))}"`, 36)}
<span style="font-family:${TITLE_FONT};font-size:21px;font-weight:650;flex:1;min-width:0;white-space:nowrap;overflow:hidden;text-overflow:ellipsis">${tx('Neues Meet')}</span>
${spontanRoundButton(istSpontan(draft?.idea))}
${loopRoundButton(loopAn)}
${kopfKnopf(kreis(34, bookmarkIcon('var(--ink)', 16)), `data-act="open-saved" aria-label="${esc(tx('Gespeichert'))}"`, 34)}
</div>`;
}

function withLabel(ctx, draft) {
  if (draft.withCrewId) {
    const crew = ctx.repo.getCrew(draft.withCrewId);
    if (crew) return { value: crew.name, sub: tnx(crew.memberIds.length, '{n} Person', '{n} Personen') };
  }
  if (draft.withPersonIds?.length) {
    const names = draft.withPersonIds.map((id) => ctx.repo.getPerson(id)?.name).filter(Boolean);
    const value = names.slice(0, 2).join(', ') + (names.length > 2 ? ` +${names.length - 2}` : '');
    return { value, sub: tnx(names.length, '{n} Person', '{n} Personen') };
  }
  return { value: tx('Wählen'), sub: tx('Crew oder Freunde') };
}

function whenText(draft) {
  if (entwurfIstJetzt(draft)) return tx('Jetzt');
  return terminAnzeige(draft.when);
}

function withWhenCards(ctx, draft) {
  const card = 'flex:1;background:var(--surface);border:1.5px solid var(--ink-a09);border-radius:20px;padding:12px 14px;display:flex;flex-direction:column;align-items:flex-start;gap:5px;min-width:0;text-align:left;cursor:pointer;appearance:none;color:var(--ink)';
  const w = withLabel(ctx, draft);
  const proposals = (draft.whenProposals || []).length;
  const jetzt = entwurfIstJetzt(draft);
  // Gleiche Grammatik wie 08.1: fette Hauptzeile, darunter die Detailzeile mit ›.
  const timeText = !jetzt && draft.when && !draft.when.open && draft.when.time ? draft.when.time : tx('Zeit offen');
  // Runde 4 (F1/F2): „Jetzt" zeigt KEINE Uhrzeit mehr („in fünf Minuten ist die Uhrzeit
  // Vergangenheit"). Die Karte trägt stattdessen den weichen grünen Randpuls eines freien
  // Profilbilds; darunter nur „Heute" (und die Zahl weiterer Termine).
  const whenBody = jetzt
    ? `<span data-role="wann-jetzt" style="position:relative;font-size:14.5px;font-weight:650;pointer-events:none">${tx('Jetzt')}</span>
<span style="position:relative;font-size:12px;color:var(--ink-soft);pointer-events:none;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;max-width:100%">${esc(proposals ? tnx(proposals, '{zeit} · +{n} Termin', '{zeit} · +{n} Termine', { zeit: tx('Heute') }) : tx('Heute'))} ›</span>`
    : `<span style="font-size:14.5px;font-weight:650;font-variant-numeric:tabular-nums;pointer-events:none;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;max-width:100%">${esc(`${weekdayShort(draft.when.date)} ${dayMonth(draft.when.date)}`)}</span>
<span style="font-size:12px;color:var(--ink-soft);font-variant-numeric:tabular-nums;pointer-events:none;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;max-width:100%">${esc(proposals ? tnx(proposals, '{zeit} · +{n} Termin', '{zeit} · +{n} Termine', { zeit: timeText }) : timeText)} ›</span>`;
  // v6 A18c: Fehlt die Pflichtangabe „Mit wem" beim Sendeversuch, markiert sich genau
  // diese Karte — sichtbar, aber ohne Dauerbanner und ohne Sheet.
  const fehltWith = Boolean(ctx.ui?.missWith) && !draftHatTeilnehmende(draft);
  const withCard = fehltWith
    ? `${card};border-color:var(--orange);background:var(--orange-tint)`
    : card;
  return `<div style="display:flex;gap:10px">
<button data-act="open-with" style="${withCard};font-family:${FONT}">
<span style="${labelStyle};pointer-events:none">${tx('Mit wem')}</span>
<span style="font-size:14.5px;font-weight:650;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;pointer-events:none;max-width:100%">${esc(w.value)}</span>
<span style="font-size:12px;color:${fehltWith ? 'var(--orange-dark)' : 'var(--ink-soft)'};pointer-events:none">${esc(fehltWith ? tx('wird gebraucht') : w.sub)} ›</span>
</button>
<button data-act="open-when" data-jetzt="${jetzt}" style="${card};position:relative;font-family:${FONT};${jetzt ? 'border-color:var(--green);' : ''}">
${jetzt ? jetztPuls(19) : ''}<span style="${labelStyle};position:relative;pointer-events:none">${tx('Wann')}</span>
${whenBody}
</button>
</div>`;
}

// „Was machen?" — die einzige grün umrandete Pflichtzeile (08.1).
function whatRow(draft) {
  const idea = draft.idea?.title ? draft.idea : null;
  const altCount = (draft.ideaAlternatives || []).length;
  const tileInner = idea ? activityIconSvg(iconBeschreibung(idea), 'var(--green-dark)', 20) : greenSearchIcon(20);
  // Sprachen: „Spontanes Treffen" liegt deutsch im Entwurf (istSpontan vergleicht den Titel).
  const title = idea ? (istSpontan(idea) ? tx('Spontanes Treffen') : idea.title) : tx('Was machen?');
  const sub = idea
    ? (altCount ? tnx(altCount, '+ {n} Alternative', '+ {n} Alternativen')
      : istSpontan(idea) ? tx('Ohne feste Aktivität') : (categoryAnzeige(idea.category) || tx('Eigene Idee')))
    : tx('Entdecken oder eigene Idee');
  return `<button data-act="open-what" style="background:var(--surface);border:1.5px solid var(--green-a50);border-radius:22px;padding:16px 18px;display:flex;align-items:center;gap:13px;box-shadow:0 2px 10px var(--shadow-06);width:100%;cursor:pointer;appearance:none;font-family:${FONT};color:var(--ink);text-align:left">
<span style="width:44px;height:44px;border-radius:14px;background:var(--green-tint);display:flex;align-items:center;justify-content:center;flex:none;pointer-events:none">${tileInner}</span>
<div style="display:flex;flex-direction:column;gap:2px;flex:1;min-width:0;pointer-events:none"><span style="font-size:17px;font-weight:650;letter-spacing:-.01em;white-space:nowrap;overflow:hidden;text-overflow:ellipsis">${esc(title)}</span><span style="font-size:12px;color:var(--muted);white-space:nowrap;overflow:hidden;text-overflow:ellipsis">${esc(sub)}</span></div>
<span style="color:var(--line-strong);font-size:18px;flex:none;pointer-events:none">›</span></button>`;
}

const composerRowStyle = `background:var(--surface);border:1.5px solid var(--ink-a09);border-radius:20px;padding:14px 16px;display:flex;align-items:center;gap:11px;width:100%;cursor:pointer;appearance:none;font-family:${FONT};color:var(--ink);text-align:left`;

function ortRow(ctx, draft) {
  const p = draft.place;
  if (!p || !p.mode) {
    return `<button data-act="open-place" style="${composerRowStyle}">${pinIcon('var(--muted-light)', 17)}
<div style="display:flex;flex-direction:column;gap:2px;flex:1;min-width:0;pointer-events:none"><span style="font-size:15px;font-weight:600;color:var(--muted-light);white-space:nowrap;overflow:hidden;text-overflow:ellipsis">${tx('Ort hinzufügen')}</span></div>
<span style="color:var(--line-strong);font-size:18px;flex:none;pointer-events:none">›</span></button>`;
  }
  const personPlace = p.mode === 'person' ? ctx.repo.getPersonPlace(p.personId) : null;
  const pending = p.mode === 'person' && !personPlace?.approved;
  const icon = p.mode === 'person' ? personIcon('var(--ink)', 17) : p.mode === 'mine' ? houseIcon('var(--ink)', 16) : pinIcon('var(--ink)', 17);
  // Sprachen: „Bei mir"/„Bei Mira" liegen deutsch im Entwurf (gespeichert wie in den Gateways) —
  // übersetzt wird hier beim Anzeigen.
  const personName = p.mode === 'person' ? ctx.repo.getPerson(p.personId)?.name : null;
  const ortName = p.mode === 'mine' ? tx('Bei mir') : personName ? tx('Bei {name}', { name: personName }) : p.name;
  const title = pending ? tx('{ort} angefragt', { ort: ortName }) : ortName;
  const address = p.mode === 'person' ? (personPlace?.approved ? personPlace.address : '') : p.address || '';
  const sub = pending
    ? `<span style="display:flex;align-items:center;gap:6px;font-size:11.5px;font-weight:650;color:var(--orange-dark)"><span style="width:7px;height:7px;border-radius:50%;background:var(--orange);flex:none"></span>${tx('Adresse erst nach Zustimmung')}</span>`
    : (address ? `<span style="font-size:12px;color:var(--muted);white-space:nowrap;overflow:hidden;text-overflow:ellipsis">${esc(address)}</span>` : '');
  return `<button data-act="open-place" style="${composerRowStyle}">${icon}
<div style="display:flex;flex-direction:column;gap:2px;flex:1;min-width:0;pointer-events:none"><span style="font-size:15px;font-weight:650;white-space:nowrap;overflow:hidden;text-overflow:ellipsis">${esc(title)}</span>${sub}</div>
<span style="color:var(--line-strong);font-size:18px;flex:none;pointer-events:none">›</span></button>`;
}

function noteRow(draft) {
  const note = (draft.note || '').trim();
  return `<button data-act="open-note" style="${composerRowStyle}">${noteRowIcon(note ? 'var(--ink)' : 'var(--muted-light)', 17)}
<div style="display:flex;flex-direction:column;gap:2px;flex:1;min-width:0;pointer-events:none"><span style="font-size:15px;font-weight:${note ? 650 : 600};color:${note ? 'var(--ink)' : 'var(--muted-light)'};white-space:nowrap;overflow:hidden;text-overflow:ellipsis">${note ? esc(note) : tx('Notiz hinzufügen')}</span></div>
<span style="color:var(--line-strong);font-size:18px;flex:none;pointer-events:none">›</span></button>`;
}

function loopStartIso(draft) {
  // Ein „Jetzt"-Termin trägt das Datum seines Anlegens — gestartet wird aber heute.
  return draft.when?.date && !draft.when.now ? draft.when.date : toISODate(now());
}

// =====================================================================
// Loop im Entwurf (Ü5/E2/E3) — EIN editierbarer Flow für Zeit und Rhythmus
//
// Die Loop-Zeile im Composer (08.1) und der Loop-Schalter auf „Was machen?" (08.2/08.2b)
// zeigen denselben Zustand (draft.loop) und öffnen dasselbe Sheet. Der Schalter ist keine
// Dekoration: Einschalten öffnet den Flow, gespeichert wird erst dort.
// =====================================================================

const LOOP_BLUE = 'var(--blue-dark)';
// v5 A29a: Die Wiederholung kennt nur noch Woche, Monat und Jahr. Der frühere
// „Eigen"-Modus samt Einheiten-Zyklus (Tage/Wochen/Monate) ist vollständig entfallen.
// Sprachen: ganze Sätze je Abstand („Jeden zweiten Montag") statt eingesetzter Ordnungswörter.
const LOOP_ORDINALS = ['', '',
  (wochentag) => tx('Jeden zweiten {wochentag}', { wochentag }),
  (wochentag) => tx('Jeden dritten {wochentag}', { wochentag }),
  (wochentag) => tx('Jeden vierten {wochentag}', { wochentag }),
  (wochentag) => tx('Jeden fünften {wochentag}', { wochentag }),
  (wochentag) => tx('Jeden sechsten {wochentag}', { wochentag }),
];
const LOOP_INTERVALS = [1, 2, 3, 4, 5, 6];

function loopUnitWord(state) {
  const n = state.interval;
  // Eigene Schlüssel für die Einheit hinter der Walze: „Woche" allein ist auch der Knopf, und
  // dort schreibt Englisch „Week", hier „week" (sonst stand „every 1 Month").
  if (state.repeat === 'monthly') return n === 1 ? tk('Monat', 'Einheit') : tk('Monate', 'Einheit');
  if (state.repeat === 'yearly') return n === 1 ? tk('Jahr', 'Einheit') : tk('Jahre', 'Einheit');
  return n === 1 ? tk('Woche', 'Einheit') : tk('Wochen', 'Einheit');
}

function loopSummaryText(state, startIso) {
  const d = fromISODate(startIso);
  const time = state.timeMode === 'open' ? tx('Zeit offen') : `${pad2(state.hour)}:${pad2(state.minute)}`;
  const n = state.interval;
  let base;
  if (state.repeat === 'weekly') {
    const wochentag = weekdayLong(startIso);
    base = n === 1 ? tx('Jeden {wochentag}', { wochentag }) : (LOOP_ORDINALS[n] ? LOOP_ORDINALS[n](wochentag) : tx('Jeden {n}. {wochentag}', { n, wochentag }));
  } else if (state.repeat === 'monthly') {
    base = tnx(n, 'Jeden Monat am {tag}.', 'Alle {n} Monate am {tag}.', { tag: d.getDate() });
  } else {
    // v5 A29a: nur noch Woche, Monat, Jahr — hier bleibt der Jahresfall.
    base = tnx(n, 'Jedes Jahr am {tag}.{monat}.', 'Alle {n} Jahre am {tag}.{monat}.', { tag: d.getDate(), monat: d.getMonth() + 1 });
  }
  return `${base} · ${time}`;
}

// Sheet-Zustand aus dem Entwurf: bestehender Loop wird bearbeitet, sonst sinnvolle Startwerte.
function loopStateFromDraft(draft) {
  const loop = draft.loop || null;
  const source = loop?.time || (draft.when && !draft.when.open ? draft.when.time : null) || nowHHMM();
  const [h, m] = String(source).split(':').map(Number);
  return {
    exists: Boolean(loop),
    timeMode: loop ? (loop.open || !loop.time ? 'open' : 'fix') : (draft.when?.open ? 'open' : 'fix'),
    hour: Number.isFinite(h) ? h : 19,
    minute: Number.isFinite(m) ? (Math.round(m / 5) * 5) % 60 : 0,
    // v5 A29a: Ein alter Entwurf mit 'custom' faellt auf die Woche zurueck.
    repeat: ['weekly', 'monthly', 'yearly'].includes(loop?.repeat) ? loop.repeat : 'weekly',
    interval: loop?.interval || 1,
  };
}

function loopPatchFromState(state) {
  return {
    repeat: state.repeat,
    interval: state.interval,
    open: state.timeMode === 'open',
    time: state.timeMode === 'open' ? null : `${pad2(state.hour)}:${pad2(state.minute)}`,
  };
}

function loopSubText(draft) {
  if (draft.loop) return loopSummaryText(loopStateFromDraft(draft), loopStartIso(draft));
  const start = loopStartIso(draft);
  return tx('aus · Start wäre {datum}', { datum: `${weekdayShort(start)} ${dayMonth(start)}` });
}

// Dieselbe Zeile in zwei Dichten: voll im Composer (08.1), kompakt auf „Was machen?" (E3).
// Loop-Sheet (Vertrag §5): oben die blaue Zusammenfassung, darunter NUR Zeit und
// Wiederholung; ein bestehender Loop hat die Stopp-Aktion.
function loopSheetHtml(ctx, draft) {
  const state = ctx.ui.loopSheet;
  if (!state) return '';
  // v5 A27d: EIN gleitendes weißes Feld statt zweier Buttons, die ihre Farbe tauschen.
  // Der Indikator liegt als eigene Ebene darunter und fährt per transform an seine
  // Position; die Knöpfe selbst sind durchsichtig.
  const segGruppe = (act, key, werte, aktiv) => {
    const index = Math.max(0, werte.findIndex((w) => w.value === aktiv));
    const breite = 100 / werte.length;
    const knoepfe = werte.map((w) => `<button data-act="${act}" data-${key}="${w.value}" aria-pressed="${w.value === aktiv}" style="position:relative;z-index:1;flex:1;border-radius:11px;padding:9px 0;text-align:center;font-size:12.5px;font-weight:${w.value === aktiv ? 650 : 600};color:${w.value === aktiv ? 'var(--ink)' : 'var(--muted)'};border:0;background:transparent;cursor:pointer;appearance:none;font-family:${FONT};transition:color .2s ease-out"><span style="pointer-events:none;display:flex;align-items:center;justify-content:center;gap:6px">${w.icon || ''}${w.label}</span></button>`).join('');
    return `<div style="position:relative;background:var(--field);border-radius:14px;padding:3px;display:flex;gap:0">
<span data-seg-indicator aria-hidden="true" style="position:absolute;left:3px;top:3px;bottom:3px;width:calc(${breite}% - 6px);border-radius:11px;background:var(--surface);box-shadow:0 1px 3px var(--shadow-08);transform:translateX(calc(${index * 100}% + ${index * 6}px));transition:transform .24s cubic-bezier(.4,0,.2,1)"></span>
${knoepfe}</div>`;
  };
  const timeArea = state.timeMode === 'fix'
    ? `<div style="display:flex;gap:12px;align-items:center;justify-content:center;position:relative;padding:2px 0">
<div style="position:absolute;left:96px;right:96px;top:50%;transform:translateY(-50%);height:38px;border-radius:12px;background:var(--paper)"></div>
${wheelColumn('loop-hour', WHEEL_HOURS, state.hour)}
<span style="font-size:17px;font-weight:650;position:relative">:</span>
${wheelColumn('loop-minute', WHEEL_MINUTES, state.minute)}
</div>`
    // v5 A25: Der Umschalter sagt bereits „Zeit offen" — eine zweite Pille darunter
    // beschriftet denselben Zustand ein zweites Mal. Der Bereich entfaellt einfach.
    : '';

  // v7 A29c (spec/05 §5): Die Zahl steht im optischen Mittelpunkt des Pickers. Vorher war
  // die Zeile ein zentrierter Flex-Container aus drei verschieden breiten Kindern — er
  // zentriert deren SUMME, weshalb die Walze je nach Einheitenwort (Woche/Monat/Jahr)
  // unterschiedlich weit aus der Bandmitte rutschte. Ein Raster mit gleich breiten
  // Außenspalten hält die Walze fest in der Mitte; „alle" endet rechtsbündig davor,
  // das Einheitenwort beginnt linksbündig dahinter.
  const unitWord = `<span style="font-size:15px;font-weight:650;position:relative;padding-bottom:2px;text-align:left">${loopUnitWord(state)}</span>`;

  const stopButton = state.exists
    ? `<button data-act="loop-remove" style="width:100%;border:1.5px solid rgba(192,68,44,.3);color:var(--danger);font:650 13.5px/1 ${FONT};padding:12px 0;border-radius:999px;text-align:center;background:transparent;cursor:pointer;appearance:none">${tx('Loop stoppen')}</button>`
    : '';

  return nmPanel({
    title: state.exists ? tx('Loop bearbeiten') : tx('Loop'),
    closeAct: 'loop-close',
    scrollKey: 'nm-loop',
    gap: 14,
    dim: '.45',
    // Runde 4 (C4): feste Höhe — „Zeit offen" blendet das Rad aus, ohne dass das Sheet springt.
    height: 'min(calc(100% - 64px), 700px)',
    header: `<div style="padding:0 20px"><div style="background:var(--blue-tint);border-radius:14px;padding:12px 14px"><span style="font-size:16px;font-weight:650;letter-spacing:-.01em;color:${LOOP_BLUE};font-variant-numeric:tabular-nums;display:block;overflow:hidden;text-overflow:ellipsis;white-space:nowrap">${esc(loopSummaryText(state, loopStartIso(draft)))}</span></div></div>`,
    body: `<div style="display:flex;flex-direction:column;gap:9px">
<span style="${labelStyle}">${tx('Zeit')}</span>
${segGruppe('loop-timemode', 'mode', [{ value: 'fix', label: tx('Fixe Uhrzeit') }, { value: 'open', label: tx('Zeit offen') }], state.timeMode)}
${timeArea}
</div>
<div style="display:flex;flex-direction:column;gap:9px;border-top:1px solid var(--ink-a07);padding-top:12px">
<span style="${labelStyle}">${tx('Wiederholung')}</span>
${/* v5 A29a: NUR Woche, Monat, Jahr — „Eigen" ist vollständig entfallen. */ ''}
${segGruppe('loop-repeat', 'repeat', [{ value: 'weekly', label: tx('Woche') }, { value: 'monthly', label: tx('Monat') }, { value: 'yearly', label: tx('Jahr') }], state.repeat)}
<div style="position:relative;display:grid;grid-template-columns:1fr 34px 1fr;column-gap:14px;align-items:center;justify-items:center;padding:2px 0">
<div style="position:absolute;left:44px;right:44px;top:50%;transform:translateY(-50%);height:38px;border-radius:12px;background:var(--paper)"></div>
<span style="font-size:15px;font-weight:650;position:relative;padding-bottom:2px;justify-self:end;text-align:right">${tx('alle')}</span>
${wheelColumn('loop-interval', LOOP_INTERVALS, state.interval, { cycles: 1, width: 34, pad: false, visible: 3 })}
<span style="position:relative;justify-self:start">${unitWord}</span>
</div>
${stopButton}
</div>`,
    bottom: panelBottom(`<div style="display:flex;gap:8px">
<button data-act="loop-close" style="flex:1;border:1.5px solid var(--ink-a14);color:var(--ink-soft);font:650 14px/1 ${FONT};padding:13px 0;border-radius:999px;text-align:center;background:transparent;cursor:pointer;appearance:none">${tx('Abbrechen')}</button>
<button data-act="loop-save" style="flex:1.4;background:var(--green);color:var(--on-accent);font:650 14px/1 ${FONT};padding:14px 0;border-radius:999px;text-align:center;border:0;cursor:pointer;appearance:none">${state.exists ? tx('Speichern') : tx('Loop aktivieren')}</button>
</div>`),
  });
}

// Aktionen des Loop-Flows — einmal je Screen, der die Loop-Zeile zeigt.
function bindLoopActions(root, ctx, draft) {
  const openSheet = () => {
    const fresh = ctx.repo.getDraft(draft.id) || draft;
    ctx.ui.loopSheet = loopStateFromDraft(fresh);
    dirtyGuard(ctx, 'nm-loop').reset(ctx.ui.loopSheet);
    ctx.render();
  };
  const closeSheet = () => { ctx.ui.loopSheet = null; dirtyGuard(ctx, 'nm-loop').clear(); };

  bindActions(root, {
    'loop-open': openSheet,
    // v5 A29c: Der Schalter in der Kopfzeile ist der EINE Zugang zur Wiederholung.
    // Er oeffnet in beiden Zustaenden die Loop-Einstellungen: aus dem Aus-Zustand zum
    // Aktivieren, aus dem An-Zustand zum Bearbeiten oder Stoppen („Loop stoppen" im
    // Sheet). Vorher schaltete ein Tipp im An-Zustand sofort ab — der Loop liess sich
    // ueberhaupt nicht mehr bearbeiten, seit die zweite Zeile entfallen ist.
    'loop-switch': openSheet,
    'loop-close': () => {
      const guard = dirtyGuard(ctx, 'nm-loop');
      if (!guard.confirm(ctx.ui.loopSheet, () => { ctx.ui.loopSheet = null; })) return;
      closeSheet();
      ctx.render();
    },
    'loop-timemode': (data) => { if (ctx.ui.loopSheet) { ctx.ui.loopSheet.timeMode = data.mode; ctx.render(); } },
    'loop-repeat': (data) => { if (ctx.ui.loopSheet) { ctx.ui.loopSheet.repeat = data.repeat; ctx.render(); } },
    'loop-save': () => {
      const state = ctx.ui.loopSheet;
      if (!state) return;
      closeSheet();
      ctx.repo.updateDraft(draft.id, { loop: loopPatchFromState(state) });
    },
    'loop-remove': () => { closeSheet(); ctx.repo.updateDraft(draft.id, { loop: null }); },
    'wheel-pick': (data) => {
      const state = ctx.ui.loopSheet;
      if (!state) return;
      if (data.role === 'loop-hour') state.hour = Number(data.value);
      else if (data.role === 'loop-minute') state.minute = Number(data.value);
      else if (data.role === 'loop-interval') state.interval = Number(data.value);
      else return;
      ctx.render();
    },
  });

  if (!ctx.ui.loopSheet) return;
  bindWheel(root, 'loop-hour', (value) => { ctx.ui.loopSheet.hour = value; ctx.render(); });
  bindWheel(root, 'loop-minute', (value) => { ctx.ui.loopSheet.minute = value; ctx.render(); });
  bindWheel(root, 'loop-interval', (value) => { ctx.ui.loopSheet.interval = value; ctx.render(); });
}

const draftHatIdee = (draft) => Boolean(draft?.idea && (draft.idea.title || '').trim());
// v6 A18c: Ein Meet ist eine Verabredung — ohne andere Teilnehmende gibt es niemanden,
// der es empfängt. Mindestens eine Person oder Crew ist deshalb Pflicht.
const draftHatTeilnehmende = (draft) => Boolean(draft?.withCrewId || (draft?.withPersonIds || []).length);

function draftReady(draft) {
  return draftHatIdee(draft) && draftHatTeilnehmende(draft);
}

function ctaButton(ready) {
  return `<button data-act="publish-draft" data-role="publish-cta" style="display:block;width:100%;border:0;cursor:pointer;appearance:none;background:${ready ? 'var(--green)' : 'var(--handle)'};color:var(--on-accent);font:650 15px/1 ${FONT};padding:16px 0;border-radius:999px;text-align:center;${ready ? 'box-shadow:0 8px 22px var(--green-a30)' : ''}">${tx('Meet senden')}</button>`;
}

// v3.1 §7: leere Pflichtfelder melden sich als kurzer Toast — kein Sheet, kein Dauerbanner.
// v6 A18c: Der CTA bleibt sichtbar; was fehlt, sagt der Toast, und die betroffene Zeile
// markiert sich sichtbar (ctx.ui.missWith) statt still zu bleiben.
function publishDraftAction(ctx, draft) {
  const fresh = ctx.repo.getDraft(draft.id);
  if (!draftHatIdee(fresh || {})) {
    ctx.ui.missWith = false;
    ctx.toast(tx('Erst eine Idee wählen — oder „Spontanes Treffen"'));
    return;
  }
  if (!draftHatTeilnehmende(fresh)) {
    ctx.ui.missWith = true;
    ctx.toast(tx('Erst mindestens eine Person oder Crew wählen'));
    ctx.render();
    return;
  }
  ctx.ui.missWith = false;
  // Runde 4 (F2): „Jetzt" wird erst beim Senden festgeschrieben — auf den Moment des Sendens
  // und MIT Marke (now), damit das Meet „Jetzt" zeigt statt einer Uhrzeit, die in fünf Minuten
  // Vergangenheit ist. Dasselbe gilt für einen weiteren Terminvorschlag „Jetzt".
  const auffrischen = (termin) => (termin?.now ? jetztTermin() : termin);
  if (!fresh.when || fresh.when.now || (fresh.whenProposals || []).some((termin) => termin.now)) {
    ctx.repo.updateDraft(draft.id, {
      when: fresh.when ? auffrischen(fresh.when) : jetztTermin(),
      whenProposals: (fresh.whenProposals || []).map(auffrischen),
    });
  }
  // Der Ort „Bei Person" ist bis hierher nur eine Absicht im Entwurf. Erst jetzt gibt es
  // ein Meet, auf das sich die Zustimmungsanfrage beziehen kann (A18/A18b).
  const personPlaceId = fresh.place?.mode === 'person' ? fresh.place.personId : null;
  const result = ctx.repo.publishDraft(draft.id);
  if (result.ok) {
    if (personPlaceId) ctx.repo.requestPersonPlace(personPlaceId, { meetId: result.meetId });
    ctx.nav.resetTo('meet.details', { meetId: result.meetId });
  } else ctx.toast(result.reason || tx('Das hat gerade nicht geklappt'));
}

// Composer-Körper: die EINE Scrollfläche des Composers (auch Hintergrund der Unter-Routen).
function composerBody(ctx, draft) {
  // Runde 3 (Jonathan I1): Die frühere Zeile „Spontanes Treffen" unter „Was machen?" ist
  // entfallen — die Wahl sitzt als Kopfknopf neben dem Loop (spontanRoundButton). Ist sie
  // getroffen, zeigt die Zeile „Was machen?" selbst „Spontanes Treffen".
  return `<div style="display:flex;flex-direction:column;gap:9px;padding:0 20px">
${withWhenCards(ctx, draft)}
${whatRow(draft)}
${ortRow(ctx, draft)}
${noteRow(draft)}
</div>`;
}

// Composer als Scaffold: Header sticky, ein Scrollkörper, „Meet senden" in der Bottom-Ebene.
function composerScaffold(ctx, draft, overlays = '') {
  return screenScaffold({
    header: composerHeader(draft),
    body: composerBody(ctx, draft),
    // v4 P0-5: kein beiger Träger mehr unter dem CTA — deckend ist nur der Knopf selbst.
    // Der Inhalt läuft sichtbar dahinter durch und fadet über die Maske aus (fitInsets).
    bottom: `${bottomFade(24)}${bottomBar(ctaButton(draftReady(draft)), 'padding:0 20px 30px')}`,
    scrollKey: 'nm-composer',
    overlays,
  });
}

// --- Mit-wem-Sheet: echte Auswahl aus repo.getCrews()/getPeople() in den Draft ---

function withSheetHtml(ctx, draft) {
  const crews = ctx.repo.getCrews();
  const people = ctx.repo.getPeople();
  const row = (act, data, iconHtml, title, sub, active, border) => `<button data-act="${act}" ${data} style="display:flex;align-items:center;gap:11px;padding:10px 0;border:0;background:transparent;width:100%;cursor:pointer;appearance:none;font-family:${FONT};color:var(--ink);${border ? 'border-top:1px solid var(--ink-a05);' : ''}">
${iconHtml}
<div style="flex:1;min-width:0;text-align:left;pointer-events:none"><div style="font-size:14px;font-weight:650;white-space:nowrap;overflow:hidden;text-overflow:ellipsis">${esc(title)}</div>${sub ? `<div style="font-size:11.5px;color:var(--muted)">${esc(sub)}</div>` : ''}</div>
${checkCircle(active)}</button>`;

  const crewRows = crews.map((crew, i) => row(
    'with-crew', `data-crew="${crew.id}"`,
    `<span style="display:flex;flex:none;pointer-events:none">${gruppenKreis(crew, 34, 13)}</span>`,
    crew.name, tnx(crew.memberIds.length, '{n} Person', '{n} Personen'), draft.withCrewId === crew.id, i > 0,
  )).join('');

  // v7 spec/08 §1: KEINE lokale Avatar-Nachbildung mehr. Die Zeile benutzt dieselbe
  // Primitive wie Crew, Raum und Profil — sonst zeigte genau diese Fläche das
  // Profilbild nicht, sondern nur Farbe und Initialen.
  const settings = ctx.repo.getSettings();
  const personRows = people.map((p, i) => row(
    'with-person', `data-person="${p.id}"`,
    `<span style="flex:none;pointer-events:none;display:flex">${personAvatar(p, { size: 34, fontSize: 12.5, marker: personMarker(p.id, settings) })}</span>`,
    p.name, '', !draft.withCrewId && draft.withPersonIds?.includes(p.id), i > 0,
  )).join('');

  // Eine Scrollfläche für Crews UND Freunde — keine zweite Liste mit eigener Höhe.
  return nmPanel({
    title: tx('Mit wem'),
    closeAct: 'with-done',
    scrollKey: 'with-people',
    // Runde 2 (Jonathan): Ohne Crew stand hier eine leere Karte, deren Rahmen wie ein
    // einzelner Strich aussah. Jetzt derselbe kurze Hinweis wie in der Freundesliste.
    body: `<div style="display:flex;flex-direction:column;gap:6px">
<span style="${labelStyle}">${tx('Crews')}</span>
${crews.length
    ? `<div style="background:var(--surface);border:1.5px solid var(--ink-a09);border-radius:20px;padding:2px 14px">${crewRows}</div>`
    : leerZeile({ text: tx('Noch keine Crew') })}
</div>
<div style="display:flex;flex-direction:column;gap:6px">
<span style="${labelStyle}">${tx('Freunde')}</span>
${people.length
    ? `<div style="background:var(--surface);border:1.5px solid var(--ink-a09);border-radius:20px;padding:2px 14px">${personRows}</div>`
    : leerZeile({ text: tx('Noch keine Freunde') })}
</div>`,
    bottom: panelBottom('<button data-act="with-done" style="background:var(--green);color:var(--on-accent);font:650 14px/1 '
      + FONT + ';padding:14px 0;border-radius:999px;text-align:center;border:0;cursor:pointer;appearance:none;width:100%">' + tx('Fertig') + '</button>'),
  });
}

// Vergleichswert für den Dirty-Guard (Ü4): nur die inhaltlichen Felder des Entwurfs.
function draftSnapshot(draft) {
  if (!draft) return null;
  return {
    idea: draft.idea || null,
    alternatives: draft.ideaAlternatives || [],
    place: draft.place || null,
    note: draft.note || '',
    when: draft.when || null,
    whenProposals: draft.whenProposals || [],
    withCrewId: draft.withCrewId || null,
    withPersonIds: draft.withPersonIds || [],
    loop: draft.loop || null,
  };
}

// Gemeinsame Composer-Aktionen (Header, Karten, Zeilen, CTA).
function bindComposerCommon(root, ctx, draft) {
  const guard = dirtyGuard(ctx, 'nm-composer');
  const dropDraft = () => { ctx.repo.discardDraft(draft.id); ctx.nav.back(); };
  bindActions(root, {
    // Ü4: ein begonnener Entwurf geht beim Schließen nicht still verloren.
    'draft-cancel': () => {
      const fresh = ctx.repo.getDraft(draft.id) || draft;
      if (!guard.confirm(draftSnapshot(fresh), dropDraft)) return;
      dropDraft();
    },
    'open-saved': () => ctx.nav.go('newMeet.saved', { draftId: draft.id }),
    'open-when': () => ctx.nav.go('newMeet.when', { draftId: draft.id }),
    'open-what': () => ctx.nav.go('newMeet.what', { draftId: draft.id }),
    'open-place': () => ctx.nav.go('newMeet.place', { draftId: draft.id }),
    'open-note': () => ctx.nav.go('newMeet.note', { draftId: draft.id }),
    'open-with': () => { ctx.ui.withSheet = true; ctx.render(); },
    'with-crew': (data) => {
      const fresh = ctx.repo.getDraft(draft.id);
      const next = fresh.withCrewId === data.crew ? null : data.crew;
      if (next) ctx.ui.missWith = false;
      ctx.repo.updateDraft(draft.id, { withCrewId: next, withPersonIds: [] });
    },
    'with-person': (data) => {
      const fresh = ctx.repo.getDraft(draft.id);
      const current = fresh.withCrewId ? [] : [...(fresh.withPersonIds || [])];
      const index = current.indexOf(data.person);
      if (index >= 0) current.splice(index, 1); else current.push(data.person);
      if (current.length) ctx.ui.missWith = false;
      ctx.repo.updateDraft(draft.id, { withCrewId: null, withPersonIds: current });
    },
    // A17d: „Spontanes Treffen" direkt aus dem Composer — dieselbe Idee wie im Chooser.
    'spontan-pick': () => {
      const fresh = ctx.repo.getDraft(draft.id);
      applySelection(ctx, draft.id, istSpontan(fresh?.idea) ? [] : [spontanDesc()]);
    },
    'with-done': () => { ctx.ui.withSheet = false; ctx.render(); },
    'publish-draft': () => publishDraftAction(ctx, draft),
  });
}

// =====================================================================
// DiscoverCore — „Was machen?"-Fähigkeiten (08.2/08.2b/08.4/08.5, 08.3 als Sheet)
// opts = { draftId?, onPick(idea)?, uiKey, submitLabel? }
// draftId-Modus: Mehrfachauswahl live im Draft. onPick-Modus: Einzelauswahl, CTA/Sheet → onPick.
// =====================================================================

function coreUi(ctx, opts) {
  const key = opts.uiKey || 'discover';
  if (!ctx.ui[key]) ctx.ui[key] = { tab: 'discover', view: 'list', query: '' };
  return ctx.ui[key];
}

function coreFilter(ctx, opts) {
  if (opts.draftId) {
    const draft = ctx.repo.getDraft(opts.draftId);
    return { ...DEFAULT_FILTER, ...(draft?.filter || {}) };
  }
  const ui = coreUi(ctx, opts);
  if (!ui.filter) ui.filter = { ...DEFAULT_FILTER };
  return ui.filter;
}

function filterCount(filter) {
  return (filter.category !== 'egal' ? 1 : 0) + (filter.placeMode !== 'egal' ? 1 : 0) + (filter.budget != null ? 1 : 0);
}

function coreEntries(ctx, opts) {
  if (opts.draftId) return selectionEntries(ctx.repo.getDraft(opts.draftId));
  const ui = coreUi(ctx, opts);
  return ui.picked ? [ui.picked] : [];
}

// Runde 2: Ist schon etwas ANDERES gewählt, klärt eine kurze Rückfrage, wie die neue Wahl
// gemeint ist. „Spontanes Treffen" ist keine Aktivität — daneben gibt es nichts abzuwägen:
// Es ersetzt still und wird still ersetzt.
// Runde 2: Lernen (Jonathan: „das System merkt sich, wenn Dinge nicht gewählt werden, und
// speichert intern eigene Desinteressen oder neutrale Interessen"). Gespeichert werden nur
// ARTEN (Klettern, Kino, …) und ausgeblendete Vorschläge — keine Zeitpunkte, keine Orte, an
// denen man war. Es liegt in den privaten Einstellungen und ist unter Einstellungen →
// „Was Crew gelernt hat" einsehbar und löschbar.
function lernen(ctx, aenderung) {
  const alt = ctx.repo.getSettings().lernen || {};
  const neu = { arten: { ...(alt.arten || {}) }, nein: { ...(alt.nein || {}) } };
  aenderung(neu);
  // Leere Einträge (etwa nach „Rückgängig") sind kein Wissen — weg damit.
  for (const [art, a] of Object.entries(neu.arten)) if (!a.g && !a.u && !a.n) delete neu.arten[art];
  const kuerzen = (objekt, max) => {
    const schluessel = Object.keys(objekt);
    while (schluessel.length > max) delete objekt[schluessel.shift()];
  };
  kuerzen(neu.arten, 60);
  kuerzen(neu.nein, 150);
  ctx.repo.updateSettings({ lernen: neu });
}

function zaehleArt(arten, art, feld, schritt = 1) {
  if (!art) return;
  const eintrag = { g: 0, u: 0, n: 0, ...(arten[art] || {}) };
  eintrag[feld] = Math.max(0, (eintrag[feld] || 0) + schritt);
  arten[art] = eintrag;
}

// Gewählt zählt für die Art. Was in der Liste DAVOR stand und nicht gewählt wurde, gilt als
// übergangen — höchstens fünf, und je Entwurf nur einmal.
function lerneWahl(ctx, opts, desc) {
  if (!desc?.suggestionId) return;
  const ui = coreUi(ctx, opts);
  const merker = `${opts.draftId || 'ohne'}:${desc.suggestionId}`;
  if (ui.gelernt?.[merker]) return;
  ui.gelernt = { ...(ui.gelernt || {}), [merker]: true };
  const liste = suggestionsFor(ctx, coreFilter(ctx, opts), (ui.query || '').trim(), { opts });
  const index = liste.findIndex((s) => s.id === desc.suggestionId);
  const art = index >= 0 ? liste[index].art : artVon(ctx.repo.getSuggestion(desc.suggestionId));
  lernen(ctx, ({ arten }) => {
    zaehleArt(arten, art, 'g');
    if (index > 0) {
      for (const s of liste.slice(Math.max(0, index - 5), index)) if (s.art !== art) zaehleArt(arten, s.art, 'u');
    }
  });
}

// „Nicht für mich": der Vorschlag verschwindet (auch aus der Auswahl), seine Art zählt.
// Runde 4 (C4): `hoehe` ist die Höhe der Karte, die verschwindet — die Rückgängig-Zeile nimmt
// genau diesen Platz ein, damit darunter nichts nachrutscht.
function sageNein(ctx, opts, suggestionId, hoehe = 0) {
  const s = ctx.repo.getSuggestion(suggestionId);
  if (!s) return;
  const ui = coreUi(ctx, opts);
  reiheFesthalten(ctx, opts);
  ui.zuletztNein = { id: s.id, title: s.shortTitle || s.title, art: artVon(s), hoehe };
  if (opts.draftId) {
    const entries = selectionEntries(ctx.repo.getDraft(opts.draftId));
    const rest = entries.filter((e) => e.suggestionId !== s.id);
    if (rest.length !== entries.length) applySelection(ctx, opts.draftId, rest);
  }
  lernen(ctx, ({ arten, nein }) => { nein[s.id] = 1; zaehleArt(arten, ui.zuletztNein.art, 'n'); });
}

function brauchtWahlFrage(entries, desc) {
  if (!entries.length || istSpontan(desc)) return false;
  if (entries.some((e) => descKey(e) === descKey(desc))) return false;
  return !entries.every((e) => istSpontan(e));
}

function coreToggle(ctx, opts, desc) {
  if (opts.draftId) {
    const vorher = selectionEntries(ctx.repo.getDraft(opts.draftId));
    if (brauchtWahlFrage(vorher, desc)) {
      coreUi(ctx, opts).wahlFrage = desc;
      ctx.render();
      return;
    }
    toggleEntry(ctx, opts.draftId, desc);
    if (!vorher.some((e) => descKey(e) === descKey(desc))) lerneWahl(ctx, opts, desc);
    return;
  }
  const ui = coreUi(ctx, opts);
  ui.picked = ui.picked && descKey(ui.picked) === descKey(desc) ? null : desc;
  ctx.render();
}

// Runde 4 (D9): Wer ist dabei? Aus dem Entwurf — oder, beim Vorschlagen zu einem bestehenden
// Meet, aus opts.crewId / opts.personIds.
function teilnehmendeVon(ctx, opts = {}) {
  const draft = opts.draftId ? ctx.repo.getDraft(opts.draftId) : null;
  return {
    crewId: draft ? (draft.withCrewId || null) : (opts.crewId || null),
    personIds: draft ? [...(draft.withPersonIds || [])] : [...(opts.personIds || [])],
  };
}

// Vorschläge über die RulesEngine (Kategorie, Radius, Ort-Modus, Budget, Suche).
// Runde 4: crewId/personIds gehen mit, damit die Datenschicht Entfernungen von DERSELBEN Mitte
// rechnen kann wie Ring und Karte (Wunsch an Chef: getSuggestions nutzt sie für die Mitte).
function suggestionsFor(ctx, filter, query, { ignoreRadius = false, opts = {} } = {}) {
  const unterwegs = !ignoreRadius && filter.placeMode === 'unterwegs';
  const items = ctx.repo.getSuggestions({
    category: filter.category,
    query: query || '',
    radiusKm: unterwegs ? filter.radiusKm : null,
    placeMode: filter.placeMode === 'egal' ? null : filter.placeMode,
    budget: filter.budget,
    price: 'egal',
    ...teilnehmendeVon(ctx, opts),
  }) || [];
  const mitte = vorschlagsMitte(ctx, opts);
  // G1 (Jonathan: „Vorschläge aus meiner Region, obwohl ich noch nicht gesagt habe, dass ich das
  // will"): Ohne Mitte gibt es keine Einwilligung — dann nur Ideen ohne festen Ort. Die Engine
  // filtert das seit Runde 4 selbst; die Oberfläche hält dieselbe Regel.
  let liste = mitte ? items : items.filter((s) => s.home || !hatLage(s.place));
  // D9: Im Umkreis ist, wessen EXAKTER Punkt im Radius liegt — gemessen von derselben Mitte wie
  // der Ring auf der Karte (nicht die gerundete Entfernung, nicht der Kachelrand).
  if (unterwegs && mitte) liste = liste.filter((s) => !hatLage(s.place) || entfernungKm(mitte, s.place) <= Number(filter.radiusKm));
  return liste;
}

// Runde 2 (Jonathan: „warum sind dort Uhrzeiten, wenn es nur um das geht, was man macht?"):
// Uhrzeiten fliegen aus jedem Kurztext — „Sa 20:30" → „Sa", „ab 19 Uhr" → „", „6:30" → „".
function ohneUhrzeit(text) {
  if (!text) return '';
  return String(text)
    .replace(/\b(?:ab|bis|um)?\s*\d{1,2}(?:[:.]\d{2})?\s*Uhr\b/gi, '')
    .replace(/\b(?:ab|bis|um)?\s*\d{1,2}:\d{2}\b/gi, '')
    .replace(/\s{2,}/g, ' ')
    .replace(/[\s·,–-]+$/, '')
    .trim();
}

function metaLine(s) {
  const price = s.price == null ? null : `${s.price} €`;
  const km = s.distanceKm != null ? `${fmtKm(s.distanceKm)} km` : null;
  // Keine Öffnungszeiten, kein Beginn. Bei Events bleibt der Tag — er entscheidet, ob es passt.
  const parts = s.kind === 'event' ? [ohneUhrzeit(s.when), km, price]
    : s.kind === 'idee' ? [price, ohneUhrzeit(s.extra)]
      : [km, price];
  // v7 A25d: Der Typ eröffnet die Kontextzeile — kurz, in derselben ruhigen Schrift.
  return [kindWord(s.kind), ...parts.filter(Boolean)].join(' · ');
}

// v7 A25d (spec/05 §2): Der Kartentyp ist ein Metadatum, keine Hierarchiespitze — und das
// frühere EVENT-Badge war die einzige Volltonfläche des Screens. Der Typ steht jetzt als
// ruhiges Wort am Anfang der Kontextzeile; die Spitze der Karte ist das Aktivitätsicon.
const KIND_WORT = { event: tx('Event'), idee: tx('Idee') };
function kindWord(kind) {
  return KIND_WORT[kind] || tx('Ort');
}

const mainChipHtml = `<span style="font-size:10px;font-weight:650;letter-spacing:.04em;padding:3px 7px;border-radius:6px;white-space:nowrap;flex:none;color:var(--green-dark);background:var(--surface);pointer-events:none">${tx('Hauptvorschlag')}</span>`;

// Vorschlagskarte (08.2): Body-Tap öffnet Details, runder Control wählt mehrfach.
// v7 A25d (spec/05 §2): Die Hierarchie der Karte ist verbindlich — Symbol, Aktivitätstitel,
// kurzer Kontext, optional Ort/Kosten. Die Spitze ist eine Symbolkachel mit dem aus Kategorie und
// Titel ABGELEITETEN Aktivitätsicon. Eine Kontur, ruhige helle Fläche, ein Schatten.
// Runde 3 (Jonathan I8): Der Auswahlkreis ist 26 px groß, getroffen wird aber die ganze rechte
// Spalte der Karte — volle Kartenhöhe, gut 46 px breit. Der negative Rand frisst genau den
// Innenabstand der Karte; sichtbar ändert sich nichts.
function toggleKnopfHtml(toggle, sel, randV = 12, randH = 14) {
  return `<button data-act="${toggle.act}" ${toggle.data} aria-pressed="${sel}" aria-label="${esc(sel ? tx('Abwählen') : tx('Auswählen'))}" style="align-self:stretch;margin:-${randV}px -${randH}px -${randV}px -6px;padding:0 ${randH}px 0 6px;border:0;background:transparent;cursor:pointer;appearance:none;flex:none;display:flex;align-items:center">${selCircle(sel)}</button>`;
}

// Runde 4 (G2, Jonathan: „‚richtig für dich' ist der Text genau gleich und sieht auch nicht
// besonders aus"): Ein Vorschlag, der zu euch passt, sagt jetzt WARUM — mit denselben Gründen, aus
// denen die Engine ihn in diese Stufe legt: ein Interesse (im Wortlaut oder in der Art), etwas, das
// ihr habt, oder etwas, das ihr schon gewählt habt. Kein erfundener Grund: passt nichts, bleibt es leer.
function grundFuer(ctx, s) {
  const settings = ctx.repo.getSettings() || {};
  const art = s.art || artVon(s);
  const text = `${s.title || ''} ${s.blurb || ''}`.toLowerCase();
  const interessen = (settings.interests || []).map((x) => String(x || '').trim()).filter(Boolean);
  // Als Etikett mit Doppelpunkt: Interessen sind Wörter ohne Artikel („See", „Bouldern") — ein
  // Satz („Passt zu See") läse sich falsch.
  for (const interesse of interessen) {
    const stelle = text.indexOf(interesse.toLowerCase());
    if (stelle >= 0 && (stelle === 0 || /[\s("„'/]/.test(text[stelle - 1]))) return tx('Passt zu: {interesse}', { interesse });
  }
  for (const interesse of interessen) {
    if (art && iconKeyForText(interesse) === art) return tx('Passt zu: {interesse}', { interesse });
  }
  for (const ressource of settings.resources || []) {
    const name = typeof ressource === 'string' ? ressource : ressource?.name;
    if (name && art && iconKeyForText(name) === art) return tx('Ihr habt: {ding}', { ding: name });
  }
  if ((settings.lernen?.arten?.[art]?.g || 0) > 0) return tx('Habt ihr schon gewählt');
  return '';
}

// Runde 3 (Jonathan I9): Gewählt heißt unverwechselbar gewählt — volle grüne Kontur und grüne
// Symbolkachel, in beiden Themen. Runde 4 (G2): `grund` steht vor dem Kontext, mit dem Zeichen der
// Gruppe — so liest sich „Passt zu euch" auch mitten in der Liste als eigene Stufe.
function ideaCardHtml({ title, meta, state, open, toggle, icon, grund = '' }) {
  const sel = Boolean(state);
  const box = sel
    ? 'background:var(--green-tint);border:2px solid var(--green);padding:11.5px 13.5px'
    : 'background:var(--surface);border:1.5px solid var(--ink-a09);padding:12px 14px';
  const bodyAttrs = open ? `data-act="${open.act}" ${open.data}` : `data-act="${toggle.act}" ${toggle.data}`;
  const kachel = aktivitaetsKachel(icon || { title, category: null }, {
    size: 34, grund: sel ? 'var(--green)' : 'var(--paper)', farbe: sel ? 'var(--on-accent)' : 'var(--ink)', icon: 18,
  });
  const unter = grund
    ? `<span data-role="vorschlag-grund" style="display:flex;align-items:center;gap:5px;min-width:0;font-size:12px;color:var(--ink-soft);font-variant-numeric:tabular-nums"><span aria-hidden="true" style="display:flex;flex:none">${activityIconSvg({ icon: 'gruppe' }, 'var(--ink-soft)', 13)}</span><span style="white-space:nowrap;overflow:hidden;text-overflow:ellipsis"><span style="color:var(--ink);font-weight:600">${esc(grund)}</span>${meta ? ` · ${esc(meta)}` : ''}</span></span>`
    : `<span style="font-size:12px;color:var(--ink-soft);font-variant-numeric:tabular-nums;white-space:nowrap;overflow:hidden;text-overflow:ellipsis">${esc(meta)}</span>`;
  return `<div data-role="vorschlag-karte" data-gewaehlt="${sel}" style="${box};border-radius:16px;display:flex;align-items:center;gap:12px;box-shadow:0 1px 2px var(--shadow-05);flex:none">
<button ${bodyAttrs} style="display:flex;align-items:center;gap:12px;flex:1;min-width:0;border:0;background:transparent;padding:0;cursor:pointer;appearance:none;font-family:${FONT};color:var(--ink);text-align:left">
${kachel}
<div style="display:flex;flex-direction:column;gap:2px;min-width:0;flex:1;pointer-events:none"><span style="display:flex;align-items:center;gap:6px;min-width:0"><span style="font-size:14.5px;font-weight:650;letter-spacing:-.01em;white-space:nowrap;overflow:hidden;text-overflow:ellipsis">${esc(title)}</span>${state === 'main' ? mainChipHtml : ''}</span>${unter}</div>
</button>
${toggleKnopfHtml(toggle, sel)}
</div>`;
}

// Runde 4 (G2): „Geht immer" ist die ruhigste Stufe — keine einzelnen Karten mehr, sondern eine
// schlichte Liste in EINEM Rahmen, mit kleinerem Zeichen und leiserer Schrift. Die Trefferflächen
// bleiben voll hoch (52 px, Auswahlspalte über die ganze Zeile), das Wischen bleibt.
function kurzZeileHtml({ title, meta, state, open, toggle, icon }) {
  const sel = Boolean(state);
  const kachel = aktivitaetsKachel(icon || { title, category: null }, {
    size: 28, grund: sel ? 'var(--green)' : 'var(--paper)', farbe: sel ? 'var(--on-accent)' : 'var(--ink-soft)', icon: 15,
  });
  return `<div data-role="vorschlag-karte" data-kurz="1" data-gewaehlt="${sel}" style="display:flex;align-items:center;gap:11px;padding:8px 14px;min-height:52px;box-sizing:border-box;background:${sel ? 'var(--green-tint)' : 'var(--surface)'};flex:none">
<button data-act="${open.act}" ${open.data} style="display:flex;align-items:center;gap:11px;flex:1;min-width:0;border:0;background:transparent;padding:0;cursor:pointer;appearance:none;font-family:${FONT};color:var(--ink);text-align:left">
${kachel}
<div style="display:flex;flex-direction:column;gap:1px;min-width:0;flex:1;pointer-events:none"><span style="display:flex;align-items:center;gap:6px;min-width:0"><span style="font-size:14px;font-weight:600;white-space:nowrap;overflow:hidden;text-overflow:ellipsis">${esc(title)}</span>${state === 'main' ? mainChipHtml : ''}</span><span style="font-size:11.5px;color:var(--muted);font-variant-numeric:tabular-nums;white-space:nowrap;overflow:hidden;text-overflow:ellipsis">${esc(meta)}</span></div>
</button>
${toggleKnopfHtml(toggle, sel, 8, 14)}
</div>`;
}

// Runde 4 (G4, Jonathan: „Das Bild hat immer so einen Hinweis, von wem das Foto ist und das
// Copyright … verstecke das hinter einem Info-Button, nur ein i"): Urheber, Lizenz und Quelle
// stehen einen Tipp entfernt hinter ⓘ (Treffer 44 px). bildUrheber trägt „Urheber · Lizenz".
// Chef (Runde 4): Texte aus Wikivoyage (quelle 'wikivoyage', quelleSeite) stehen unter CC BY-SA —
// ihre Namensnennung gehört hinter DENSELBEN ⓘ-Knopf wie der Foto-Urheber.
const echteAdresse = (url) => (/^https?:\/\//.test(url || '') ? url : null);

function quellenNachweis(s) {
  const teile = [];
  if (s?.bild) {
    const stuecke = String(s.bildUrheber || '').split(' · ').map((x) => x.trim()).filter(Boolean);
    const lizenz = stuecke.length > 1 ? stuecke.pop() : '';
    teile.push({ art: 'foto', wer: stuecke.join(' · ') || 'Wikimedia Commons', lizenz, seite: echteAdresse(s.bildSeite) });
  }
  if (s?.quelle === 'wikivoyage') {
    teile.push({ art: 'text', wer: 'Wikivoyage', lizenz: s.quelleLizenz || 'CC BY-SA', seite: echteAdresse(s.quelleSeite) });
  }
  return teile;
}

function fotoInfoHtml(s, schluessel, offen, lage = 'oben') {
  const teile = quellenNachweis(s);
  if (!teile.length) return '';
  const kante = lage === 'oben' ? 'top' : 'bottom';
  const knopf = `<button data-act="foto-info" data-foto="${esc(schluessel)}" data-role="foto-info" aria-label="${esc(tx('Bildnachweis'))}" aria-expanded="${offen}" style="position:absolute;right:3px;${kante}:3px;width:44px;height:44px;border:0;background:transparent;padding:0;display:flex;align-items:center;justify-content:center;cursor:pointer;appearance:none;z-index:4"><span style="width:26px;height:26px;border-radius:50%;background:var(--glass);-webkit-backdrop-filter:blur(10px);backdrop-filter:blur(10px);box-shadow:0 1px 4px var(--shadow-10);display:flex;align-items:center;justify-content:center;pointer-events:none">${activityIconSvg({ icon: 'info' }, 'var(--ink)', 15)}</span></button>`;
  const tafel = offen
    ? `<div data-role="foto-nachweis" style="position:absolute;left:8px;right:50px;${kante}:8px;z-index:4;background:var(--glass);-webkit-backdrop-filter:blur(14px);backdrop-filter:blur(14px);border-radius:12px;padding:8px 11px;box-shadow:0 2px 10px var(--shadow-14);display:flex;flex-direction:column;gap:2px;font-family:${FONT};text-align:left">
${teile.map((teil, i) => `<span style="display:flex;flex-direction:column;gap:2px;${i ? 'border-top:1px solid var(--ink-a07);margin-top:5px;padding-top:6px;' : ''}">
<span style="font-size:11.5px;font-weight:650;color:var(--ink);line-height:1.3">${teil.art === 'foto' ? tx('Foto: {urheber}', { urheber: esc(teil.wer) }) : tx('Text: {quelle}', { quelle: esc(teil.wer) })}</span>
${teil.lizenz ? `<span style="font-size:11px;color:var(--ink-soft);line-height:1.3">${tx('Lizenz: {lizenz}', { lizenz: esc(teil.lizenz) })}</span>` : ''}
${teil.seite ? `<a href="${esc(teil.seite)}" target="_blank" rel="noopener" style="font-size:11.5px;font-weight:650;color:var(--green-dark);text-decoration:none;padding:5px 0 1px">${tx('Quelle öffnen')} ›</a>` : ''}
</span>`).join('')}
</div>`
    : '';
  return `${tafel}${knopf}`;
}

// Runde 3 (Jonathan H3) / Runde 4 (G2: „Besonders wirklich besonders"): eine Bildkarte mit höherem
// Foto, warmer Kontur, warmer Symbolkachel und dem Grund in Orange. Grün bleibt der Auswahl
// vorbehalten — gewählt wird auch diese Karte grün. Das Funkeln trägt das warme Orange.
function besondersKarteHtml(s, { meta, state, open, toggle, icon, grund = '', fotoOffen = false }) {
  const sel = Boolean(state);
  const rahmen = sel
    ? 'background:var(--green-tint);border:2px solid var(--green)'
    : 'background:var(--surface);border:1.5px solid var(--orange-a40)';
  const foto = s.bild
    ? `<img data-role="besonders-foto" src="${esc(s.bild)}" alt="" loading="lazy" referrerpolicy="no-referrer" style="position:absolute;inset:0;width:100%;height:100%;object-fit:cover;pointer-events:none" onerror="this.remove()">`
    : '';
  const kachel = aktivitaetsKachel(icon, {
    size: 34, grund: sel ? 'var(--green)' : 'var(--orange-tint)', farbe: sel ? 'var(--on-accent)' : 'var(--orange-dark)', icon: 18,
  });
  const warum = grund
    ? `<span data-role="besonders-grund" style="display:flex;align-items:center;gap:5px;min-width:0;font-size:12px;font-weight:650;color:var(--orange-dark)"><span aria-hidden="true" style="display:flex;flex:none">${activityIconSvg({ icon: 'sparkle' }, 'var(--orange)', 12)}</span><span style="white-space:nowrap;overflow:hidden;text-overflow:ellipsis">${esc(grund)}</span></span>`
    : '';
  return `<div data-role="vorschlag-karte" data-gewaehlt="${sel}" data-besonders="1" style="${rahmen};border-radius:18px;overflow:hidden;box-shadow:0 4px 16px var(--shadow-10);flex:none">
<div data-role="besonders-bildflaeche" style="position:relative;height:104px;background:${s.gradient || 'var(--field)'};overflow:hidden">${foto}
<button data-act="${open.act}" ${open.data} data-role="besonders-bild" tabindex="-1" aria-hidden="true" style="position:absolute;inset:0;width:100%;height:100%;border:0;padding:0;margin:0;background:transparent;cursor:pointer;appearance:none"></button>
<span data-role="besonders-marke" aria-label="${esc(tx('Besonders'))}" style="position:absolute;left:10px;top:10px;width:28px;height:28px;display:flex;align-items:center;justify-content:center;border-radius:50%;background:var(--glass);-webkit-backdrop-filter:blur(10px);backdrop-filter:blur(10px);pointer-events:none;box-shadow:0 1px 4px var(--shadow-10)">${activityIconSvg({ icon: 'sparkle' }, 'var(--orange)', 15)}</span>
${fotoInfoHtml(s, `karte:${s.id}`, fotoOffen, 'oben')}
</div>
<div style="display:flex;align-items:center;gap:12px;padding:11px 14px">
<button data-act="${open.act}" ${open.data} style="display:flex;align-items:center;gap:12px;flex:1;min-width:0;border:0;background:transparent;padding:0;cursor:pointer;appearance:none;font-family:${FONT};color:var(--ink);text-align:left">
${kachel}
<div style="display:flex;flex-direction:column;gap:2px;min-width:0;flex:1;pointer-events:none"><span style="display:flex;align-items:center;gap:6px;min-width:0"><span style="font-size:15px;font-weight:650;letter-spacing:-.01em;white-space:nowrap;overflow:hidden;text-overflow:ellipsis">${esc(s.title)}</span>${state === 'main' ? mainChipHtml : ''}</span>${warum}<span style="font-size:12px;color:var(--ink-soft);font-variant-numeric:tabular-nums;white-space:nowrap;overflow:hidden;text-overflow:ellipsis">${esc(meta)}</span></div>
</button>
${toggleKnopfHtml(toggle, sel, 11, 14)}
</div>
</div>`;
}

// Runde 2 (Jonathan: „Wischen für ‚Nicht für mich' soll nicht stören, aber verständlich
// sein"): Eine Vorschlagskarte lässt sich nach links ziehen — dahinter steht, was dann
// passiert. Ein kurzer Zug schnappt zurück; zum Scrollen bleibt die Senkrechte frei.
function vorschlagZugHtml(s, karte, radius = 16, trenner = false) {
  return `<div data-role="vorschlag-zug" data-suggestion="${esc(s.id)}" data-hdrag="vorschlag" style="position:relative;flex:none;border-radius:${radius}px;touch-action:pan-y;${trenner ? 'border-top:1px solid var(--ink-a06);' : ''}">
<div data-role="vorschlag-zug-grund" aria-hidden="true" style="position:absolute;inset:0;border-radius:${radius}px;background:var(--orange-tint);display:flex;align-items:center;justify-content:flex-end;gap:8px;padding-right:18px;color:var(--orange-dark);font:650 13px/1 ${FONT};opacity:0;pointer-events:none"><span style="display:flex">${activityIconSvg({ icon: 'augeZu' }, 'var(--orange-dark)', 16)}</span><span>${tx('Nicht für mich')}</span></div>
<div data-role="vorschlag-zug-karte" style="position:relative;will-change:transform">${karte}</div>
</div>`;
}

// Überschrift einer Stufe. Runde 4 (G2): drei unterscheidbare Köpfe — „Besonders" mit dem
// orangen Funkeln in voller Schrift, „Passt zu euch" mit dem Gruppenzeichen, „Geht immer" leise.
function stufeKopfHtml(key, wort, ersteZeile) {
  const abstand = `padding:${ersteZeile ? 2 : 16}px 2px 0`;
  if (key === 'besonders') {
    return `<span data-role="vorschlag-stufe" data-stufe="${key}" style="display:flex;align-items:center;gap:6px;${abstand};flex:none"><span aria-hidden="true" style="display:flex">${activityIconSvg({ icon: 'sparkle' }, 'var(--orange)', 14)}</span><span style="${labelStyle};color:var(--ink)">${esc(wort)}</span></span>`;
  }
  if (key === 'passend') {
    return `<span data-role="vorschlag-stufe" data-stufe="${key}" style="display:flex;align-items:center;gap:6px;${abstand};flex:none"><span aria-hidden="true" style="display:flex">${activityIconSvg({ icon: 'gruppe' }, 'var(--ink-soft)', 14)}</span><span style="${labelStyle};color:var(--ink-soft)">${esc(wort)}</span></span>`;
  }
  return `<span data-role="vorschlag-stufe" data-stufe="${key}" style="${labelStyle};display:block;${abstand};flex:none">${esc(wort)}</span>`;
}

// Runde 4 (C4, Jonathan: „ich bin ganz unten, wähle etwas aus und dann springt es nach oben"):
// Gemessen — eine Wahl LERNT (lerneWahl), die Engine sortiert neu, und die gewählte Karte rutschte
// 98 px weg. Die Liste hält deshalb ihre Reihenfolge fest, sobald man mit ihr arbeitet (wählen,
// öffnen, wischen). Gelernt wird trotzdem — es wirkt beim nächsten Öffnen oder bei einem neuen
// Filter. Neues (nachgeladene Orte) kommt ans Ende seiner Stufe; was ausgeblendet wurde, behält
// seinen Platz für die Rückgängig-Zeile. Beim Suchen zählt nur der Treffer.
const STUFEN_REIHE = ['besonders', 'passend', 'immer'];

function stabileReihe(ui, items, signatur, suche) {
  const stufeVon = (s) => (STUFEN_REIHE.includes(s.stufe) ? s.stufe : 'immer');
  const frisch = () => items.map((s) => ({ s, stufe: stufeVon(s) }));
  if (suche) return frisch();
  const alt = ui.reihe;
  if (!alt || alt.signatur !== signatur || !alt.fest) {
    const liste = frisch();
    ui.reihe = { signatur, fest: false, ordnung: liste.map((e) => ({ id: e.s.id, stufe: e.stufe })) };
    return liste;
  }
  const nachId = new Map(items.map((s) => [s.id, s]));
  const neinId = ui.zuletztNein?.id || null;
  const gruppen = { besonders: [], passend: [], immer: [] };
  const bekannt = new Set();
  for (const eintrag of alt.ordnung) {
    bekannt.add(eintrag.id);
    const s = nachId.get(eintrag.id);
    if (s) gruppen[eintrag.stufe].push({ s, stufe: eintrag.stufe });
    else if (eintrag.id === neinId) gruppen[eintrag.stufe].push({ platzhalter: true, id: eintrag.id, stufe: eintrag.stufe });
  }
  for (const s of items) if (!bekannt.has(s.id)) gruppen[stufeVon(s)].push({ s, stufe: stufeVon(s) });
  const liste = [...gruppen.besonders, ...gruppen.passend, ...gruppen.immer];
  alt.ordnung = liste.map((e) => ({ id: e.s ? e.s.id : e.id, stufe: e.stufe }));
  return liste;
}

function reiheFesthalten(ctx, opts) {
  const ui = coreUi(ctx, opts);
  if (ui.reihe) ui.reihe.fest = true;
}

// Was gerade ausgeblendet wurde, lässt sich an Ort und Stelle zurückholen — in der Höhe der Karte,
// die dort stand, damit darunter nichts nachrutscht.
function neinZeileHtml(nein, inGruppe = false, trenner = false) {
  const hoehe = Math.max(inGruppe ? 52 : 50, Math.round(nein.hoehe || 0));
  return `<div data-role="vorschlag-nein" data-suggestion="${esc(nein.id)}" style="display:flex;align-items:center;gap:10px;background:var(--field);border-radius:${inGruppe ? 0 : 14}px;padding:9px 10px 9px 14px;min-height:${hoehe}px;box-sizing:border-box;flex:none;${trenner ? 'border-top:1px solid var(--ink-a06);' : ''}">
<span style="flex:1;min-width:0;font-size:12.5px;color:var(--ink-soft);white-space:nowrap;overflow:hidden;text-overflow:ellipsis">${tx('„{titel}" ausgeblendet', { titel: esc(nein.title) })}</span>
<button data-act="wm-nein-zurueck" data-suggestion="${esc(nein.id)}" style="border:1.5px solid var(--ink-a14);background:var(--surface);color:var(--ink);border-radius:999px;padding:7px 12px;font:650 12px/1 ${FONT};cursor:pointer;appearance:none;flex:none"><span style="pointer-events:none">${tx('Rückgängig')}</span></button></div>`;
}

// Kontext ohne das vorangestellte Art-Wort („Ort · 2 km · 0 €" → „2 km · 0 €").
const metaOhneArt = (s) => metaLine(s).split(' · ').slice(1).join(' · ');

function listInnerHtml(ctx, opts, filter) {
  const ui = coreUi(ctx, opts);
  const query = (ui.query || '').trim();
  const mitte = vorschlagsMitte(ctx, opts);
  const roh = suggestionsFor(ctx, filter, query, { opts });
  const signatur = [filter.category, filter.placeMode, filter.radiusKm, filter.budget, query, mitte ? `${mitte.lat.toFixed(3)},${mitte.lon.toFixed(3)}` : '-'].join('|');
  const reihe = stabileReihe(ui, roh, signatur, Boolean(query));
  const entries = coreEntries(ctx, opts);
  const nein = ui.zuletztNein;
  let neinGesetzt = false;
  // Runde 2 (Jonathan: „klare besondere, gute und allgemeine Vorschläge"): Die drei Stufen stehen
  // als Überschriften zwischen den Karten. Runde 4 (G2): und jede Stufe sieht anders aus.
  const teile = [];
  let gruppe = [];
  const gruppeSchliessen = () => {
    if (!gruppe.length) return;
    teile.push(`<div data-role="vorschlag-gruppe" style="background:var(--surface);border:1.5px solid var(--ink-a09);border-radius:16px;overflow:hidden;flex:none;box-shadow:0 1px 2px var(--shadow-05)">${gruppe.join('')}</div>`);
    gruppe = [];
  };
  let stufe = null;
  for (const eintrag of reihe) {
    if (!query && eintrag.stufe !== stufe) {
      gruppeSchliessen();
      const wort = STUFEN.find((x) => x.key === eintrag.stufe)?.wort || '';
      teile.push(stufeKopfHtml(eintrag.stufe, wort, !stufe));
      stufe = eintrag.stufe;
    }
    const kompakt = !query && eintrag.stufe === 'immer';
    if (eintrag.platzhalter) {
      if (nein && eintrag.id === nein.id) {
        neinGesetzt = true;
        if (kompakt) gruppe.push(neinZeileHtml(nein, true, gruppe.length > 0));
        else teile.push(neinZeileHtml(nein));
      }
      continue;
    }
    const s = eintrag.s;
    const karte = {
      meta: metaLine(s),
      // Der Seed-Vorschlag bringt seinen Schlüssel mit; fehlt er, greift die Ableitung
      // aus Titel und Kategorie (activityIconSvg).
      icon: { icon: s.icon, iconKey: s.iconKey, title: s.title, category: s.category },
      state: selState(entries, `s:${s.id}`),
      open: { act: 'wm-open', data: `data-suggestion="${s.id}"` },
      toggle: { act: 'wm-toggle', data: `data-kind="sug" data-id="${s.id}"` },
    };
    if (!query && eintrag.stufe === 'besonders') {
      teile.push(vorschlagZugHtml(s, besondersKarteHtml(s, { ...karte, grund: s.reason || grundFuer(ctx, s), fotoOffen: ui.fotoInfo === `karte:${s.id}` }), 18));
    } else if (kompakt) {
      gruppe.push(vorschlagZugHtml(s, kurzZeileHtml({ title: s.title, ...karte }), 0, gruppe.length > 0));
    } else {
      const grund = !query && eintrag.stufe === 'passend' ? (grundFuer(ctx, s) || s.reason || '') : '';
      teile.push(vorschlagZugHtml(s, ideaCardHtml({ title: s.title, ...karte, meta: grund ? metaOhneArt(s) : karte.meta, grund })));
    }
  }
  gruppeSchliessen();
  const empty = reihe.length === 0
    ? `<div style="padding:26px 0;text-align:center;font-size:13px;color:var(--muted);flex:none">${tx('Keine Vorschläge — Filter oder Suche anpassen')}</div>`
    : '';
  // Hat die Liste keinen Platz für die Zeile (etwa beim Suchen), steht sie oben — nie verloren.
  const ausgeblendet = nein && !neinGesetzt ? neinZeileHtml(nein) : '';
  // Chef H4 / Runde 4 (G1): Ohne Mitte (keine Einwilligung) gibt es nur Ideen ohne festen Ort — und
  // ganz oben die ruhige Zeile „Orte in deiner Nähe zeigen". Gefragt wird ausschließlich auf Tippen.
  const laeuft = Boolean(ui.standortLaeuft);
  const standortZeile = !query && !mitte && typeof ctx.repo.standortFuerVorschlaege === 'function'
    ? `<button data-act="wm-standort" data-role="wm-standort" aria-busy="${laeuft}" style="display:flex;align-items:center;gap:12px;width:100%;padding:10px 14px;border:1.5px dashed var(--green-a45);border-radius:16px;background:transparent;cursor:pointer;appearance:none;font-family:${FONT};text-align:left;flex:none">
<span style="width:34px;height:34px;border-radius:11px;background:var(--green-tint);display:flex;align-items:center;justify-content:center;flex:none;pointer-events:none">${ortungIcon('var(--green-dark)', 17)}</span>
<span style="display:flex;flex-direction:column;gap:2px;flex:1;min-width:0;pointer-events:none"><span style="font-size:13.5px;font-weight:650;color:var(--green-dark)">${tx('Orte in deiner Nähe zeigen')}</span><span style="font-size:11.5px;color:var(--muted);white-space:nowrap;overflow:hidden;text-overflow:ellipsis">${laeuft ? tx('Standort wird abgefragt …') : tx('Mit deinem Standort — nur für Vorschläge')}</span></span>
${rowChevronIcon('var(--green-dark)', 14)}</button>`
    : '';
  return `${ausgeblendet}${standortZeile}${teile.join('')}${empty}`;
}

// v7 A26b (spec/05 §3): Die Kosten der eigenen Idee kommen über einen KURZEN Slider —
// nicht mehr über drei Grobstufen-Chips. Kurz heißt: 0 bis 50 € in 5-€-Schritten; ganz
// links steht „kostenlos". Ein längerer Bereich hilft beim Anlegen einer Idee nicht.
const OWN_COST_MAX = 50;
const OWN_COST_STEP = 5;
const ownCostFromT = (t) => Math.round((clamp(t, 0, 1) * OWN_COST_MAX) / OWN_COST_STEP) * OWN_COST_STEP;
const ownCostT = (cost) => clamp((cost || 0) / OWN_COST_MAX, 0, 1);
const ownCostLabel = (cost) => (!cost ? tx('kostenlos') : tx('bis {betrag} €', { betrag: cost }));

// Sprachen: Die Zeile landet als Anzeigetext in der eigenen Idee (settings.ownIdeas[].extra) und
// wird nirgends verglichen — sie entsteht deshalb gleich in der Sprache der App.
function ownCostExtra(cost) {
  if (cost == null) return tx('eben hinzugefügt');
  return tx('eben hinzugefügt · {kosten}', { kosten: ownCostLabel(cost) });
}

// v6 A17d: „Ohne Aktivität" ist eine zulässige Entscheidung, kein Fehlerzustand. Der
// Eintrag ist deshalb eine ECHTE Idee mit klarem Titel und neutralem Symbol — im Meet
// entsteht dadurch kein leeres Feld und kein erfundener Aktivitätsname.
const SPONTAN_TITLE = 'Spontanes Treffen';
const spontanDesc = () => ({
  title: SPONTAN_TITLE, icon: 'sparkle', category: null,
  source: 'spontan', suggestionId: null, ownId: null, place: null,
});
const istSpontan = (idea) => Boolean(idea) && (idea.source === 'spontan' || idea.title === SPONTAN_TITLE);

function ownListInnerHtml(ctx, opts) {
  const entries = coreEntries(ctx, opts);
  const ui = coreUi(ctx, opts);
  // v7 A26a: Gespeicherte eigene Ideen tragen KEINEN Symbolknopf mehr. Ihr Symbol wird
  // wie überall aus Kategorie und Titel abgeleitet und ist damit dasselbe, das später
  // im Composer und im Meet steht.
  const typedCards = typedOwnIdeas(ctx).map((o) => ideaCardHtml({
    kind: 'idee',
    title: o.title,
    meta: o.extra || tx('eben hinzugefügt'),
    icon: { title: o.title, category: o.category || eigeneKategorie(o.title) },
    state: selState(entries, `o:${o.id}`),
    open: null,
    toggle: { act: 'wm-toggle', data: `data-kind="own" data-id="${o.id}"` },
  })).join('');
  // v6 A17b: Der Erstellweg steht GESCHLOSSEN oben — Titel und Kosten in einer Karte,
  // darunter der Anlege-Knopf. Diese Ordnung bleibt unverändert.
  const getippt = (ui.ownTitle || '').trim();
  // v7 A26a: An der Stelle des früheren Symbolknopfs steht jetzt eine VORSCHAU des
  // abgeleiteten Symbols — kein Bedienelement, sondern die sichtbare Erklärung der
  // Ableitung. Sie folgt beim Tippen sofort (spiegeln() in bindDiscoverCore).
  const vorschau = `<span data-role="wm-own-preview" aria-hidden="true" style="width:44px;height:44px;border-radius:14px;background:var(--paper);display:flex;align-items:center;justify-content:center;flex:none;pointer-events:none">${activityIconSvg(iconBeschreibung({ title: getippt, category: eigeneKategorie(getippt) }), 'var(--ink)', 20)}</span>`;
  // v7 A26b: kurzer Kosten-Slider (0–50 € in 5-€-Schritten) statt drei Grobstufen-Chips.
  const kosten = Number(ui.ownCost) || 0;
  const kostenSlider = `<div style="display:flex;flex-direction:column;gap:8px;flex:none">
<div style="display:flex;justify-content:space-between;align-items:center"><span style="${labelStyle};font-size:10px">${tx('Kosten {an}optional{aus}', { an: '<span style="text-transform:none;letter-spacing:0;font-weight:600;color:var(--line-strong)">', aus: '</span>' })}</span><span data-role="owncost-label" style="font-size:12.5px;font-weight:650;font-variant-numeric:tabular-nums">${esc(ownCostLabel(kosten))}</span></div>
<div data-role="owncost-track" data-hdrag="slider" role="slider" aria-label="${esc(tx('Kosten'))}" aria-valuemin="0" aria-valuemax="${OWN_COST_MAX}" aria-valuenow="${kosten}" aria-valuetext="${esc(ownCostLabel(kosten))}" style="position:relative;height:24px;display:flex;align-items:center;touch-action:none;cursor:pointer">
<div style="position:absolute;left:0;right:0;height:5px;border-radius:3px;background:var(--field)"></div>
<div data-role="owncost-fill" style="position:absolute;left:0;width:${(ownCostT(kosten) * 100).toFixed(1)}%;height:5px;border-radius:3px;background:var(--green)"></div>
<div data-role="owncost-thumb" style="position:absolute;left:${(ownCostT(kosten) * 100).toFixed(1)}%;width:22px;height:22px;border-radius:50%;background:var(--surface);border:2.5px solid var(--green);box-sizing:border-box;transform:translateX(-11px);box-shadow:0 2px 6px var(--shadow-20)"></div>
</div>
<div style="display:flex;justify-content:space-between;font-size:10.5px;color:var(--muted-light);font-variant-numeric:tabular-nums"><span>${tx('kostenlos')}</span><span>${OWN_COST_MAX} €</span></div>
</div>`;
  const vordergrund = `<div data-role="wm-own-create" style="display:flex;flex-direction:column;gap:12px;background:var(--surface);border:1.5px solid ${getippt ? 'var(--green-a40)' : 'var(--ink-a12)'};border-radius:18px;padding:13px;flex:none">
<div style="display:flex;align-items:center;gap:11px">
${vorschau}
<label style="flex:1;min-width:0;display:flex;flex-direction:column;gap:1px;cursor:text">
<span style="${labelStyle};font-size:10px">${tx('Titel')}</span>
<input data-role="wm-own-title" placeholder="${esc(tx('Was habt ihr vor?'))}" value="${esc(ui.ownTitle || '')}" style="width:100%;min-width:0;border:0;outline:none;background:transparent;font:650 15px ${FONT};color:var(--ink);padding:0">
</label>
</div>
${kostenSlider}
<button data-act="wm-own-add" data-role="wm-own-add" style="display:flex;align-items:center;justify-content:center;gap:8px;background:${getippt ? 'var(--green)' : 'var(--field)'};color:${getippt ? 'var(--on-accent)' : 'var(--muted-light)'};border:0;border-radius:999px;padding:13px 0;font:650 14px/1 ${FONT};cursor:pointer;appearance:none;width:100%"><span style="pointer-events:none">${tx('Idee anlegen')}</span></button>
</div>`;
  // Runde 2: „Spontanes Treffen" steht jetzt oben rechts im Chooser-Kopf (spontanChipHtml).
  // v6 A17c: Unter „Schon gespeichert" stehen ausschließlich EIGENE Ideen. Sie bleiben
  // eingeklappt und damit sekundär — der Erstellweg ist die Hauptsache dieses Reiters.
  const anzahl = typedOwnIdeas(ctx).length;
  const offen = Boolean(ui.savedOpen);
  const gespeichert = anzahl
    ? `<button data-act="wm-own-saved" aria-expanded="${offen}" style="display:flex;align-items:center;gap:8px;background:transparent;border:0;padding:10px 0 0;width:100%;cursor:pointer;appearance:none;font-family:${FONT};flex:none">
<span style="${labelStyle};flex:1;text-align:left;pointer-events:none">${tx('Schon gespeichert · {n}', { n: anzahl })}</span>
${offen ? chevronUpIcon('var(--muted-light)', 13) : chevronDownIcon('var(--muted-light)', 13)}</button>${offen ? typedCards : ''}`
    : '';
  return `${vordergrund}${gespeichert}`;
}

// Umkreis-Karte (08.4) — Runde 2.
// Unter Ring und Markierungen liegt eine ECHTE Karte (MapLibre, freie OSM-Daten, data-fremd).
// Ring, Mitte, Beschriftung und Griff hängen an EINEM Punkt — der Suchmitte —, und ihre
// Bildschirmstellen kommen aus derselben Web-Mercator-Rechnung, mit der MapLibre zeichnet
// (core/entfernung.js). Sie liegen damit auch ohne geladene Karte richtig und beim Schieben
// exakt auf ihr.
//
// Runde 4 (D8, Jonathan: „ist immer noch so falsch, wie ich es letztens schon sagte"):
//   · KEINE Abschwächung mehr außen („dunkel unübersichtlich durch den Fade") — der Umkreis ist
//     ein klarer Ring mit einem Hauch Grün innen; was draußen liegt, tritt als Markierung zurück.
//   · Markierungen wie auf der Meet-Karte: die gemeinsamen Bausteine aus ui/map.js (ortMarken,
//     P3) — Mini-Box oder Zeichen, exakt auf dem Ort, Gesten gehören der Karte. Solange es den
//     Baustein noch nicht gibt, stehen die bisherigen Kacheln exakt an ihrem Ort (ohne Ausweichen).
//   · Runde 5 (D3): Schilder und Hinweis laufen über die volle Breite (je 20 px) und tragen
//     data-ueber-karte — die Bedienung der Karte (Regler mittig rechts, ⓘ unten rechts) weicht ihnen aus.
//     Nur der Griff am Ring hält die Spalte frei: Er hängt an der Karte, nicht an der Seite.
// Runde 4 (D9): Mitte = Mittel der geteilten Standorte der gewählten Gruppe (getVorschlagsMitte),
// Regler stufenlos auf ganze Kilometer, drin ist, wessen exakter Punkt im Radius liegt.
const RADIUS_MIN_KM = STUFEN_KM[0];
const RADIUS_MAX_KM = STUFEN_KM[STUFEN_KM.length - 1];
const RING_ANTEIL = 0.34; // Ring-Halbmesser nach dem Einpassen, gemessen an der kürzeren Kante
const KARTE_W = 390;      // angenommene Größe, bis die Fläche wirklich gemessen ist
const KARTE_H = 400;
const KARTE_MIN_H = 380;  // P3: Karten mit Höhenregler mindestens 380 px hoch
const kartenFrei = () => kartenBausteine.KARTEN_SPALTE?.frei ?? 64;
const radiusMapLabel = (km, inside) => tnx(inside, 'Umkreis · bis {km} km · {n} Ort', 'Umkreis · bis {km} km · {n} Orte', { km });
const radiusGripIcon = (c = 'var(--green)', s = 15) => `<svg width="${s}" height="${s}" viewBox="0 0 24 24" fill="none" style="pointer-events:none"><path d="M6 8.5 2.5 12 6 15.5M18 8.5 21.5 12 18 15.5M4 12h16" stroke="${c}" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"></path></svg>`;

// Runde 4 (D9, Jonathan: „richtig smooth, Kilometer für Kilometer"): Der Regler rastet nicht mehr
// auf Stufen ein. Er folgt dem Finger stufenlos; der Wert ist eine ganze Kilometerzahl. Die
// Skala ist logarithmisch — in der Nähe ist jeder Kilometer einzeln erreichbar, weit weg reicht
// dieselbe Spur trotzdem bis 500 km (Runde 2: „irgendwann größere Sprünge").
const RADIUS_LOG = Math.log(RADIUS_MAX_KM / RADIUS_MIN_KM);
const anteilAusKm = (km) => clamp(Math.log(clamp(Number(km) || RADIUS_MIN_KM, RADIUS_MIN_KM, RADIUS_MAX_KM) / RADIUS_MIN_KM) / RADIUS_LOG, 0, 1);
const kmAusAnteil = (anteil) => clamp(Math.round(RADIUS_MIN_KM * Math.exp(clamp(Number(anteil) || 0, 0, 1) * RADIUS_LOG)), RADIUS_MIN_KM, RADIUS_MAX_KM);
const radiusKm = (filter) => clamp(Math.round(Number(filter?.radiusKm) || DEFAULT_FILTER.radiusKm), RADIUS_MIN_KM, RADIUS_MAX_KM);

// Runde 3 (Chef H4) / Runde 4 (D9): Die Mitte der Vorschläge kommt aus der Datenschicht — mit den
// Teilnehmenden des Entwurfs: das Mittel der Standorte, die sie mit mir teilen (quelle 'gruppe'),
// sonst der freigegebene Gerätestandort bzw. das Zuhause. Liste, Entfernungen und Umkreis-Karte
// rechnen von DERSELBEN Stelle aus. Ohne Mitte (keine Einwilligung) bleibt die Startansicht.
function vorschlagsMitte(ctx, opts = {}) {
  const mitte = ctx.repo.getVorschlagsMitte?.(teilnehmendeVon(ctx, opts));
  return mitte && typeof mitte.lat === 'number' && typeof mitte.lon === 'number' ? mitte : null;
}

function suchMitte(ctx, opts = {}) {
  const mitte = vorschlagsMitte(ctx, opts);
  return mitte ? { lat: mitte.lat, lon: mitte.lon } : startAnsicht(ctx.repo.getSettings()).mitte;
}

function eingepassterAusschnitt(mitte, km, mass) {
  const kante = Math.min(mass?.w || KARTE_W, mass?.h || KARTE_H);
  return { mitte: { lat: mitte.lat, lon: mitte.lon }, zoom: clamp(zoomFuerRadius(mitte.lat, km, kante * RING_ANTEIL), 2.5, 17) };
}

function discAusschnitt(ctx, opts, mitte, km) {
  const ui = coreUi(ctx, opts);
  // Wandert die Mitte (Standort neu freigegeben, andere Gruppe), passt die Karte den Umkreis dort neu ein.
  const schluessel = `${mitte.lat.toFixed(4)},${mitte.lon.toFixed(4)}`;
  if (ui.discMitte !== schluessel) { ui.discMitte = schluessel; ui.discAusschnitt = null; }
  if (!ui.discAusschnitt) {
    // Ohne Mitte (keine Einwilligung) gibt es keinen Umkreis, auf den man einpassen könnte — die
    // Karte zeigt dann die gewohnte Startansicht (Land, Europa), nicht zehn Kilometer um die Landesmitte.
    ui.discAusschnitt = vorschlagsMitte(ctx, opts)
      ? eingepassterAusschnitt(mitte, km, ui.discMass)
      : (() => { const start = startAnsicht(ctx.repo.getSettings()); return { mitte: { ...start.mitte }, zoom: start.zoom }; })();
  }
  return ui.discAusschnitt;
}

function umkreisLage(ausschnitt, breite, hoehe, mitte, km) {
  const c = bildpunkt(ausschnitt, breite, hoehe, mitte);
  return { x: c.x, y: c.y, R: (km * 1000) / meterProPixel(mitte.lat, ausschnitt.zoom) };
}

// Runde 3 (Jonathan I10: „ohne Standort kein Umkreis, ohne aktiven Filter kein Umkreis"):
// Ring, Griff und Umkreis-Schild erscheinen nur mit einer Mitte UND dem Ortsfilter „Unterwegs".
function standortBekannt(ctx, opts = {}) {
  return Boolean(vorschlagsMitte(ctx, opts));
}

// Chef H4: „Orte in deiner Nähe zeigen" — solange die Vorschläge nicht vom echten Standort
// ausgehen. Gefragt wird ausschließlich auf Tippen.
function standortAnbieten(ctx, opts = {}) {
  return typeof ctx.repo.standortFuerVorschlaege === 'function' && vorschlagsMitte(ctx, opts)?.quelle !== 'standort';
}

const ortungIcon = (c = 'var(--green-dark)', s = 16) => `<svg width="${s}" height="${s}" viewBox="0 0 24 24" fill="none" style="pointer-events:none;flex:none"><path d="M19.6 4.4 4.6 10.6l6.5 2.3 2.3 6.5 6.2-15Z" stroke="${c}" stroke-width="1.8" stroke-linejoin="round"></path></svg>`;

function umkreisAktiv(ctx, filter, opts = {}) {
  return filter.placeMode === 'unterwegs' && standortBekannt(ctx, opts);
}

const kachelMeta = (d, s) => [d != null ? `${kmText(d)} km` : null, s.price != null ? `${s.price} €` : null].filter(Boolean).join(' · ');
const umkreisIcon = (c = 'var(--green-dark)', s = 15) => `<svg width="${s}" height="${s}" viewBox="0 0 24 24" fill="none" style="pointer-events:none;flex:none"><circle cx="12" cy="12" r="8.6" stroke="${c}" stroke-width="1.8" stroke-dasharray="3.2 2.6"></circle><circle cx="12" cy="12" r="2.3" fill="${c}"></circle></svg>`;

// Rückfall, solange ui/map.js › ortMarken noch fehlt: die Kachel der Meet-Karte mit der scharfen
// Ecke und dem grünen Ortspunkt darauf — Runde 4: immer EXAKT an ihrem Ort, kein Ausweichen.
const KACHEL_ECKE = 3;
const punktVersatz = (sel) => -5 - (sel ? 2 : 1);
const griffPunkt = (u, R, w, h) => ({
  x: Math.round(clamp(u.x + R * Math.SQRT1_2, 22, w - kartenFrei() - 22)),
  y: Math.round(clamp(u.y + R * Math.SQRT1_2, 22, h - 22)),
});

function discAnkerHtml(s, { d, drin, sel, p }) {
  const rand = sel ? 2 : 1;
  const icon = aktivitaetsKachel({ icon: s.icon, iconKey: s.iconKey, title: s.title, category: s.category }, {
    size: 30, grund: sel ? 'var(--green)' : 'var(--paper)', farbe: sel ? 'var(--on-accent)' : 'var(--ink)', icon: 16,
  });
  return `<div data-role="disc-anker" data-suggestion="${s.id}" data-lat="${s.place.lat}" data-lon="${s.place.lon}" data-distance="${(d ?? 0).toFixed(3)}" data-gewaehlt="${sel}" style="position:absolute;left:0;top:0;transform:translate(${Math.round(p.x)}px,${Math.round(p.y)}px) translate(0,-100%);z-index:${sel ? 4 : 3};pointer-events:none">
<button data-act="wm-open" data-suggestion="${s.id}" data-role="disc-kachel" data-gewaehlt="${sel}" style="position:relative;display:flex;gap:8px;align-items:center;padding:6px 11px 6px 6px;background:var(--surface);border:${rand}px solid ${sel ? 'var(--green)' : 'var(--ink-a12)'};border-radius:14px 14px 14px ${KACHEL_ECKE}px;box-shadow:${sel ? '0 6px 16px var(--ink-a18)' : '0 3px 10px var(--ink-a12)'};cursor:pointer;appearance:none;font-family:${FONT};color:var(--ink);white-space:nowrap;pointer-events:auto">
<span data-role="disc-kachel-innen" style="display:flex;gap:8px;align-items:center;pointer-events:none;${drin ? '' : 'opacity:.45;'}">
${icon}
<span data-role="disc-kachel-text" style="display:flex;flex-direction:column;gap:1px;pointer-events:none;text-align:left"><span style="font-size:12px;font-weight:650">${esc(s.shortTitle || s.title)}</span><span style="font-size:10.5px;color:var(--ink-soft);font-variant-numeric:tabular-nums">${esc(kachelMeta(d, s))}</span></span></span>
<span data-role="disc-punkt" aria-hidden="true" style="position:absolute;left:${punktVersatz(sel)}px;bottom:${punktVersatz(sel)}px;width:10px;height:10px;border-radius:50%;box-sizing:border-box;background:var(--green);border:2px solid var(--surface);box-shadow:0 1px 3px var(--shadow-20);pointer-events:none;${drin ? '' : 'opacity:.55;'}"></span>
</button></div>`;
}

// Die Orte der Karte mit ihrer Entfernung von der Suchmitte (exakter Punkt) und ihrer Wahl.
function umkreisEintraege(ctx, opts, filter) {
  const ui = coreUi(ctx, opts);
  const mitte = suchMitte(ctx, opts);
  const entries = coreEntries(ctx, opts);
  return suggestionsFor(ctx, filter, (ui.query || '').trim(), { ignoreRadius: true, opts })
    .filter((s) => hatLage(s.place))
    .map((s) => ({ s, d: entfernungKm(mitte, s.place), sel: Boolean(selState(entries, `s:${s.id}`)) }));
}

// Die Schilder oben links auf der Karte, nebeneinander:
//   · Umkreis aktiv: „Umkreis · bis 10 km · 6 Orte ×" — sonst mit Mitte der Knopf „Umkreis".
//   · Geht die Mitte nicht vom Gerätestandort aus, sitzt daneben ein runder Standort-Knopf.
//   · Ohne Mitte gibt es keine Schilder — dann steht mitten auf der Karte das Angebot (G1).
function umkreisSchildHtml(ctx, opts, filter, km, inside, laeuft) {
  const pille = 'height:36px;box-sizing:border-box;border-radius:999px;box-shadow:0 3px 10px var(--shadow-14);background:var(--surface);pointer-events:auto;flex:none';
  const teile = [];
  const mitte = vorschlagsMitte(ctx, opts);
  if (!mitte) return '';
  if (umkreisAktiv(ctx, filter, opts)) {
    teile.push(`<div data-role="disc-umkreis-chip" data-ueber-karte style="${pille};flex:0 1 auto;min-width:0;display:flex;align-items:center;border:1.5px solid var(--green)">
<span style="display:flex;padding-left:10px;pointer-events:none">${umkreisIcon('var(--green-dark)', 14)}</span>
<span data-role="disc-radius-label" style="padding:0 2px 0 7px;min-width:0;font:650 11.5px/1 ${FONT};color:var(--green-dark);white-space:nowrap;overflow:hidden;text-overflow:ellipsis;pointer-events:none">${esc(radiusMapLabel(km, inside))}</span>
<button data-act="disc-umkreis-aus" data-role="disc-umkreis-aus" aria-label="${esc(tx('Umkreis entfernen'))}" style="width:40px;height:34px;border:0;background:transparent;padding:0;display:flex;align-items:center;justify-content:center;cursor:pointer;appearance:none;flex:none;border-radius:0 999px 999px 0">${xSmallIcon('var(--green-dark)', 12)}</button></div>`);
  } else {
    teile.push(`<button data-act="disc-umkreis-an" data-role="disc-umkreis-an" data-ueber-karte style="${pille};display:flex;align-items:center;gap:7px;padding:0 14px 0 11px;border:1.5px solid var(--ink-a12);font:650 12px/1 ${FONT};color:var(--ink);cursor:pointer;appearance:none">${umkreisIcon('var(--green-dark)', 15)}<span style="pointer-events:none">${tx('Umkreis')}</span></button>`);
  }
  if (standortAnbieten(ctx, opts)) {
    teile.push(`<button data-act="wm-standort" data-role="disc-standort" data-ueber-karte aria-label="${esc(tx('Orte in deiner Nähe zeigen'))}" aria-busy="${laeuft}" style="${pille};width:36px;display:flex;align-items:center;justify-content:center;padding:0;border:1.5px solid var(--ink-a12);cursor:pointer;appearance:none;${laeuft ? 'opacity:.6;' : ''}">${ortungIcon('var(--green-dark)', 16)}</button>`);
  }
  return `<div data-role="disc-schilder" style="position:absolute;left:20px;right:20px;top:14px;z-index:6;display:flex;align-items:center;gap:8px;pointer-events:none">${teile.join('')}</div>`;
}

// Runde 4 (G1): Ohne Einwilligung zeigt die Karte keine Orte — mitten auf ihr steht dasselbe ruhige
// Angebot wie oben in der Liste. Ein Tipp fragt nach dem Standort, sonst nichts.
function umkreisHinweisHtml(laeuft) {
  return `<div data-role="disc-hinweis" style="position:absolute;left:20px;right:20px;top:50%;transform:translateY(-50%);z-index:6;display:flex;justify-content:center;pointer-events:none">
<button data-act="wm-standort" data-role="disc-standort" data-ueber-karte aria-busy="${laeuft}" style="pointer-events:auto;display:flex;align-items:center;gap:12px;width:100%;max-width:320px;padding:12px 14px;border:1.5px solid var(--green-a45);border-radius:18px;background:var(--surface);box-shadow:0 8px 24px var(--shadow-14);cursor:pointer;appearance:none;font-family:${FONT};text-align:left">
<span style="width:36px;height:36px;border-radius:11px;background:var(--green-tint);display:flex;align-items:center;justify-content:center;flex:none;pointer-events:none">${ortungIcon('var(--green-dark)', 17)}</span>
<span style="display:flex;flex-direction:column;gap:2px;flex:1;min-width:0;pointer-events:none"><span style="font-size:13.5px;font-weight:650;color:var(--green-dark)">${tx('Orte in deiner Nähe zeigen')}</span><span style="font-size:11.5px;color:var(--muted);white-space:nowrap;overflow:hidden;text-overflow:ellipsis">${laeuft ? tx('Standort wird abgefragt …') : tx('Mit deinem Standort — nur für Vorschläge')}</span></span></button></div>`;
}

function mapInnerHtml(ctx, opts, filter) {
  const ui = coreUi(ctx, opts);
  const mitteDaten = vorschlagsMitte(ctx, opts);
  const mitte = suchMitte(ctx, opts);
  const km = radiusKm(filter);
  const aktiv = umkreisAktiv(ctx, filter, opts);
  const ausschnitt = discAusschnitt(ctx, opts, mitte, km);
  const w = ui.discMass?.w || KARTE_W;
  const h = ui.discMass?.h || KARTE_H;
  const eintraege = umkreisEintraege(ctx, opts, filter);
  const u = umkreisLage(ausschnitt, w, h, mitte, km);
  const R = Math.round(u.R);
  const drinnen = (e) => !aktiv || (e.d != null && e.d <= km);
  const inside = eintraege.filter(drinnen).length;
  const anker = typeof kartenBausteine.ortMarken === 'function'
    ? ''
    : eintraege.map((e) => discAnkerHtml(e.s, { d: e.d, drin: drinnen(e), sel: e.sel, p: bildpunkt(ausschnitt, w, h, e.s.place) })).join('');
  const gruppe = mitteDaten?.quelle === 'gruppe' && (mitteDaten.anzahl || 0) > 1;
  const umkreis = aktiv
    ? `<div data-role="disc-radius-ring" style="position:absolute;left:${Math.round(u.x - R)}px;top:${Math.round(u.y - R)}px;width:${R * 2}px;height:${R * 2}px;border-radius:50%;box-sizing:border-box;border:2px solid var(--green-a62);background:var(--green-a05);pointer-events:none;z-index:1"></div>
<div data-role="disc-mitte" style="position:absolute;left:${Math.round(u.x)}px;top:${Math.round(u.y)}px;width:0;height:0;z-index:2;pointer-events:none"><span style="position:absolute;left:-7px;top:-7px;width:14px;height:14px;border-radius:50%;box-sizing:border-box;background:var(--surface);border:3.5px solid var(--green);box-shadow:0 1px 4px var(--shadow-25)"></span>${gruppe ? `<span data-role="disc-mitte-text" style="position:absolute;left:0;top:12px;transform:translateX(-50%);white-space:nowrap;background:var(--surface);color:var(--green-dark);border-radius:999px;padding:3px 8px;font:650 10.5px/1.2 ${FONT};box-shadow:0 2px 8px var(--shadow-14)">${esc(tnx(mitteDaten.anzahl, 'Mitte von {n} Standort', 'Mitte von {n} Standorten'))}</span>` : ''}</div>`
    : '';
  // Der Griff trifft auf 44 px; sichtbar bleibt der 30-px-Knopf auf dem Ring, unten rechts (45°).
  const griffLage = griffPunkt(u, R, w, h);
  const griff = aktiv
    ? `<button data-role="disc-radius-handle" data-hdrag="radius" role="slider" aria-label="${esc(tx('Umkreis'))}" aria-valuemin="${RADIUS_MIN_KM}" aria-valuemax="${RADIUS_MAX_KM}" aria-valuenow="${km}" aria-valuetext="${esc(radiusLabelText(km))}" style="position:absolute;left:${griffLage.x}px;top:${griffLage.y}px;transform:translate(-50%,-50%);width:44px;height:44px;border:0;background:transparent;padding:0;display:flex;align-items:center;justify-content:center;cursor:nwse-resize;appearance:none;touch-action:none;pointer-events:auto;z-index:5"><span style="width:30px;height:30px;border-radius:50%;background:var(--surface);border:2.5px solid var(--green);box-sizing:border-box;box-shadow:0 3px 9px var(--shadow-22);display:flex;align-items:center;justify-content:center;pointer-events:none"><span style="display:flex;transform:rotate(45deg)">${radiusGripIcon('var(--green)', 15)}</span></span></button>`
    : '';
  const hinweis = !mitteDaten && typeof ctx.repo.standortFuerVorschlaege === 'function' ? umkreisHinweisHtml(Boolean(ui.standortLaeuft)) : '';
  return `${umkreis}${anker}${umkreisSchildHtml(ctx, opts, filter, km, inside, Boolean(ui.standortLaeuft))}${griff}${hinweis}`;
}

// --- Filter-Sheet (08.5): Was? → Ort → Entfernung (nur Unterwegs) → Budget → Anwenden ---


const tFromBudget = (b) => (b == null ? 1 : clamp(b / 60, 0, 1));
const budgetFromT = (t) => (t >= 0.99 ? null : Math.round((t * 60) / 5) * 5);
const radiusLabelText = (km) => tx('bis {km} km', { km });
const budgetLabelText = (b) => (b == null ? tx('ohne Limit') : b === 0 ? tx('nur kostenlos') : tx('bis {betrag} € p. P.', { betrag: b }));

// Runde 2: `raster` = Anzahl gleich weit auseinanderliegender Einraststellen (Entfernung:
// STUFEN_KM). Sie stehen als feine Striche unter der Spur — man sieht, dass der Regler
// springt, und wohin.
function sliderRow(label, valueText, t, role, minLabel, maxLabel, raster = 0) {
  const pct = Math.round(t * 1000) / 10;
  const striche = raster > 1
    ? `<div aria-hidden="true" data-role="${role}-raster" style="position:absolute;left:0;right:0;top:18px;height:5px;pointer-events:none">${Array.from({ length: raster }, (_, i) => `<span style="position:absolute;left:${((i / (raster - 1)) * 100).toFixed(2)}%;top:0;width:1.5px;height:5px;margin-left:-.75px;border-radius:1px;background:var(--ink-a14)"></span>`).join('')}</div>`
    : '';
  return `<div style="display:flex;flex-direction:column;gap:9px">
<div style="display:flex;justify-content:space-between;align-items:center"><span style="${labelStyle}">${label}</span><span data-role="${role}-label" style="font-size:12.5px;font-weight:650;font-variant-numeric:tabular-nums">${valueText}</span></div>
<div data-role="${role}-track" data-hdrag="slider" role="slider" aria-label="${esc(label)}" aria-valuetext="${esc(valueText)}"${raster > 1 ? ` data-raster="${raster}"` : ''} style="position:relative;height:24px;display:flex;align-items:center;touch-action:none;cursor:pointer">
<div style="position:absolute;left:0;right:0;height:5px;border-radius:3px;background:var(--field)"></div>
${striche}
<div data-role="${role}-fill" style="position:absolute;left:0;width:${pct}%;height:5px;border-radius:3px;background:var(--green)"></div>
<div data-role="${role}-thumb" style="position:absolute;left:${pct}%;width:22px;height:22px;border-radius:50%;background:var(--surface);border:2.5px solid var(--green);box-sizing:border-box;transform:translateX(-11px);box-shadow:0 2px 6px var(--shadow-20)"></div>
</div>
<div style="display:flex;justify-content:space-between;font-size:10.5px;color:var(--muted-light);font-variant-numeric:tabular-nums"><span>${minLabel}</span><span>${maxLabel}</span></div>
</div>`;
}

function filterSheetHtml(ctx, opts) {
  const f = coreUi(ctx, opts).filterDraft || { ...DEFAULT_FILTER };
  // v6 A08f: gewählte Kategorie als ruhige getönte Fläche mit grüner Kontur statt als
  // vollschwarzer Chip — Auswahl braucht keinen maximalen Kontrast, nur Eindeutigkeit.
  const catChip = (c) => (f.category === c.id
    ? `<button data-act="disc-filter-cat" data-category="${c.id}" style="background:var(--green-tint);color:var(--green-dark);border:1.5px solid var(--green);border-radius:999px;padding:6.5px 0;text-align:center;font-size:12px;font-weight:650;cursor:pointer;appearance:none;font-family:${FONT}"><span style="pointer-events:none">${c.anzeige}</span></button>`
    : `<button data-act="disc-filter-cat" data-category="${c.id}" style="border:1px solid var(--ink-a14);border-radius:999px;padding:8px 0;text-align:center;font-size:12px;font-weight:600;color:var(--ink-soft);background:transparent;cursor:pointer;appearance:none;font-family:${FONT}"><span style="pointer-events:none">${c.anzeige}</span></button>`);
  const placeSegBtn = (id, label) => (f.placeMode === id
    ? `<button data-act="disc-filter-place" data-place="${id}" style="flex:1;background:var(--surface);border-radius:11px;padding:9px 0;text-align:center;font-size:12.5px;font-weight:650;box-shadow:0 1px 3px var(--shadow-08);border:0;cursor:pointer;appearance:none;font-family:${FONT};color:var(--ink)"><span style="pointer-events:none">${label}</span></button>`
    : `<button data-act="disc-filter-place" data-place="${id}" style="flex:1;border-radius:11px;padding:9px 0;text-align:center;font-size:12.5px;font-weight:600;color:var(--muted);border:0;background:transparent;cursor:pointer;appearance:none;font-family:${FONT}"><span style="pointer-events:none">${label}</span></button>`);
  const radiusRow = f.placeMode === 'unterwegs'
    ? sliderRow(tx('Entfernung'), radiusLabelText(radiusKm(f)), anteilAusKm(radiusKm(f)), 'radius', '1 km', '500 km')
    : '';
  return nmPanel({
    closeAct: 'disc-filter-close',
    scrollKey: 'disc-filter',
    gap: 16,
    mark: 'data-disc-sheet',
    // Runde 4 (C4, gemessen: „Unterwegs" antippen → der Knopf rückte 86 px nach oben): feste Höhe,
    // die auch die Entfernungszeile trägt. Erscheint sie, bleibt alles darüber, wo es war.
    height: 'min(calc(100% - 64px), 600px)',
    header: `<div style="display:flex;justify-content:space-between;align-items:baseline;padding:0 20px"><span style="font-family:${TITLE_FONT};font-size:19px;font-weight:650">${tx('Filter')}</span><button data-act="disc-filter-reset" style="font-size:12.5px;font-weight:650;color:var(--muted);border:0;background:transparent;cursor:pointer;appearance:none;font-family:${FONT};padding:0">${tx('Zurücksetzen')}</button></div>`,
    body: `<div style="display:flex;flex-direction:column;gap:8px">
<span style="${labelStyle}">${tx('Was?')}</span>
<div style="display:grid;grid-template-columns:1fr 1fr 1fr;gap:6px">${CATEGORIES.map(catChip).join('')}</div>
</div>
<div style="display:flex;flex-direction:column;gap:8px">
<span style="${labelStyle}">${tx('Ort')}</span>
<div style="background:var(--field);border-radius:14px;padding:3px;display:flex;gap:3px">${placeSegBtn('egal', tx('Egal'))}${placeSegBtn('daheim', tx('Daheim'))}${placeSegBtn('unterwegs', tx('Unterwegs'))}</div>
</div>
${radiusRow}
${sliderRow(tx('Budget'), budgetLabelText(f.budget), tFromBudget(f.budget), 'budget', tx('kostenlos'), tx('ohne Limit'))}`,
    bottom: panelBottom(`<button data-act="disc-filter-apply" style="background:var(--green);color:var(--on-accent);font:650 14px/1 ${FONT};padding:14px 0;border-radius:999px;text-align:center;border:0;cursor:pointer;appearance:none;width:100%">${tx('Anwenden')}</button>`),
  });
}

// --- Untere Leiste (08.2/08.2b): Auswahl-Zeile · Suche/Idee-Feld · Übernehmen ---

function altLabel(n) {
  return tnx(n, '+ {n} Alternative', '+ {n} Alternativen');
}

const termChipHtml = `<span style="font-size:10px;font-weight:650;letter-spacing:.04em;padding:4px 8px;border-radius:6px;white-space:nowrap;flex:none;color:var(--green-dark);background:var(--green-tint);pointer-events:none">${tx('Hauptvorschlag')}</span>`;

function selectionSummaryHtml(ctx, opts, entries) {
  const ui = coreUi(ctx, opts);
  // v6 A16b: Eine EINZELNE Wahl braucht keine zweite Darstellung — die grün markierte
  // Karte in der Liste sagt bereits alles. Die Box ist die Verwaltung MEHRERER Vorschläge
  // und erscheint deshalb erst, wenn es sie wirklich gibt.
  if (entries.length <= 1) return '';
  const main = entries[0];
  const alts = entries.length - 1;
  // v7 A25b: Die Anzahl gewählter Elemente steht jetzt HIER — in der Variantenübersicht,
  // wo sie eine Liste erklärt. In der Kopfzeile stand sie ohne Bezug.
  const header = `<button data-act="wm-selopen" style="display:flex;align-items:center;gap:9px;width:100%;border:0;background:transparent;padding:0;cursor:pointer;appearance:none;font-family:${FONT}">
<span style="font-size:12.5px;font-weight:650;color:var(--green-dark);flex:1;min-width:0;text-align:left;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;pointer-events:none">${esc(main.title)}${alts ? ` <span style="font-weight:600;color:var(--ink-soft)">${altLabel(alts)}</span>` : ''}</span>
<span style="font-size:11.5px;font-weight:650;color:var(--ink-soft);font-variant-numeric:tabular-nums;flex:none;pointer-events:none;white-space:nowrap">${tx('{n} gewählt', { n: entries.length })}</span>
${ui.selOpen ? chevronDownIcon('var(--green-dark)', 13) : chevronUpIcon('var(--green-dark)', 13)}
</button>`;
  const rows = ui.selOpen ? entries.map((e, i) => `<div style="display:flex;align-items:center;gap:10px;padding:9px 0;border-top:1px solid var(--ink-a06)">
${handleIcon('var(--line-solid)', 14)}
<button data-act="wm-selmain" data-key="${esc(descKey(e))}" style="font-size:13.5px;font-weight:${i === 0 ? 650 : 600};color:var(--ink);flex:1;min-width:0;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;text-align:left;border:0;background:transparent;padding:0;cursor:pointer;appearance:none;font-family:${FONT}"><span style="pointer-events:none">${esc(e.title)}</span></button>
${i === 0 && entries.length > 1 ? termChipHtml : ''}
<button data-act="wm-selremove" data-key="${esc(descKey(e))}" aria-label="${esc(tx('Entfernen'))}" style="border:0;background:transparent;padding:15px;margin:-15px -15px -15px -9px;cursor:pointer;appearance:none;flex:none;display:flex">${xSmallIcon('var(--muted)', 13)}</button>
</div>`).join('') : '';
  return `<div data-ueber-karte style="background:var(--green-tint);border:1px solid var(--green-a35);border-radius:14px;padding:10px 13px;display:flex;flex-direction:column;flex:none">${header}${ui.selOpen ? `<div style="display:flex;flex-direction:column;margin-top:8px">${rows}</div>` : ''}</div>`;
}

// v5 A27d / v6 A18d: EIN Liste/Karte-Umschalter für den ganzen Bereich — Meet-Browser und
// Ort-Sheet benutzen dieselbe Funktion, damit die beiden Ansichten nicht auseinanderlaufen.
// Icons plus ein GLEITENDES weißes Feld: der aktive Bereich fährt an seine Position,
// statt dass nur die Farbe umspringt.
const VIEW_ICONS = {
  list: '<svg width="13" height="13" viewBox="0 0 24 24" fill="none" style="pointer-events:none"><path d="M4 7h16M4 12h16M4 17h11" stroke="currentColor" stroke-width="2" stroke-linecap="round"></path></svg>',
  map: '<svg width="13" height="13" viewBox="0 0 24 24" fill="none" style="pointer-events:none"><path d="m9 4.5 6 2.4 4.5-2.4v15L15 21.5l-6-2.4L4.5 21.5v-15L9 4.5Zm0 0v14.6m6-12.2v14.6" stroke="currentColor" stroke-width="1.8" stroke-linejoin="round"></path></svg>',
};

function viewGroupHtml(aktivView, act, options = {}) {
  const keys = ['list', 'map'];
  const index = Math.max(0, keys.indexOf(aktivView));
  return `<div style="position:relative;background:var(--field);border-radius:999px;padding:3px;display:flex;flex:none">
<span data-seg-indicator aria-hidden="true" style="position:absolute;left:3px;top:3px;bottom:3px;width:calc(50% - 3px);border-radius:999px;background:var(--surface);box-shadow:0 1px 3px var(--shadow-08);transform:translateX(${index * 100}%);transition:transform .24s cubic-bezier(.4,0,.2,1)"></span>
${keys.map((key) => {
    const aktiv = key === aktivView;
    const gesperrt = Boolean(options.lockedMap) && key === 'map';
    return `<button data-act="${act}" data-view="${key}" aria-pressed="${aktiv}"${gesperrt ? ' aria-disabled="true"' : ''} style="position:relative;z-index:1;display:flex;align-items:center;gap:6px;padding:7px 14px;font-size:12px;font-weight:${aktiv ? 650 : 600};color:${gesperrt ? '#C0B9AE' : aktiv ? 'var(--ink)' : 'var(--muted)'};border:0;background:transparent;border-radius:999px;cursor:pointer;appearance:none;font-family:${FONT};transition:color .2s ease-out"><span style="pointer-events:none;display:flex">${VIEW_ICONS[key]}</span><span style="pointer-events:none">${key === 'list' ? tx('Liste') : tx('Karte')}</span></button>`;
  }).join('')}</div>`;
}

// Runde 2 (Jonathan): Oben rechts sitzt „Spontanes Treffen" — die Wahl OHNE feste Aktivität.
// Ein kompakter Chip im Zustands-Look jeder Auswahl: Fläche, Kontur und Farbe, zusätzlich
// über aria-pressed vorgelesen.
function spontanChipHtml(aktiv) {
  const an = Boolean(aktiv);
  return `<button data-act="wm-spontan" data-role="wm-spontan-chip" aria-pressed="${an}" style="display:flex;align-items:center;gap:5px;border:1.5px solid ${an ? 'var(--green-a45)' : 'var(--ink-a12)'};background:${an ? 'var(--green-tint)' : 'var(--surface)'};border-radius:999px;padding:6px 11px 6px 8px;cursor:pointer;appearance:none;font-family:${FONT};flex:none;transition:background-color .2s ease-out,border-color .2s ease-out">
<span aria-hidden="true" style="display:flex;pointer-events:none">${activityIconSvg({ icon: 'sparkle' }, 'var(--green-dark)', 14)}</span>
<span style="font-size:11.5px;font-weight:650;letter-spacing:.01em;color:${an ? 'var(--green-dark)' : 'var(--ink-soft)'};pointer-events:none;white-space:nowrap">${tx('Spontanes Treffen')}</span></button>`;
}

// Runde 2: Die kurze Rückfrage bei einer zweiten Wahl — ein kleines Sheet statt eines
// Modus-Schalters. Wer schon etwas gewählt hat und etwas anderes antippt, entscheidet genau
// in diesem Moment, wie es gemeint ist.
function wahlFrageHtml(desc, entries) {
  const bisher = entries.filter((e) => !istSpontan(e));
  const erste = bisher[0]?.title || '';
  const frage = bisher.length > 1
    ? tx('Statt „{titel}" und {n} weitere — oder als Alternative dazu?', { titel: esc(erste), n: bisher.length - 1 })
    : tx('Statt „{titel}" — oder als Alternative dazu?', { titel: esc(erste) });
  const knopf = `flex:1;font:650 14px/1 ${FONT};padding:14px 0;border-radius:999px;text-align:center;cursor:pointer;appearance:none`;
  return nmPanel({
    closeAct: 'wm-wahl-zu',
    scrollKey: 'wm-wahl',
    mark: 'data-disc-sheet data-role="wm-wahlfrage"',
    body: `<div style="display:flex;align-items:center;gap:12px;flex:none">
${aktivitaetsKachel(desc, { size: 42, grund: 'var(--paper)', farbe: 'var(--ink)', icon: 21 })}
<div style="display:flex;flex-direction:column;gap:3px;min-width:0"><span style="font-family:${TITLE_FONT};font-size:19px;font-weight:650;white-space:nowrap;overflow:hidden;text-overflow:ellipsis">${esc(desc.title)}</span>
<span style="font-size:12.5px;color:var(--ink-soft);line-height:1.35">${frage}</span></div>
</div>`,
    bottom: panelBottom(`<div style="display:flex;gap:8px"><button data-act="wm-wahl-alt" style="${knopf};border:1.5px solid var(--green-a45);background:var(--green-tint);color:var(--green-dark)">${tx('Als Alternative')}</button><button data-act="wm-wahl-ersetzen" style="${knopf};border:0;background:var(--green);color:var(--on-accent)">${tx('Auswählen')}</button></div>`),
  });
}

function coreInputHtml(ctx, opts) {
  const ui = coreUi(ctx, opts);
  // v6 A17a: Die Suche gehört ausschließlich zu „Entdecken". Unter „Eigene Idee" gibt es
  // keine Suchleiste mehr — der Titel der neuen Idee wird oben im Erstellbereich
  // eingegeben (ownListInnerHtml). Vorher war dieselbe Pille beides zugleich und
  // deshalb unverzichtbar; genau das hat die Suche in den falschen Tab getragen.
  if (ui.tab === 'own') return '';
  // Die ganze Pille ist das Bedienelement (label): ein Tipp irgendwo darauf setzt den
  // Schreibcursor — sie ist damit kein passiver Farbträger, sondern echtes Control.
  // v7 A25c (spec/05 §2): Rechts in der Pille sass ein Mikrofon-Symbol ohne jede Wirkung —
  // es versprach eine Sprachsuche, die es nicht gibt. Es ist ersatzlos entfallen; Rand,
  // Radius und Innenabstand der Pille bleiben unveraendert.
  return `<label data-ueber-karte style="background:var(--surface);border:1.5px solid var(--ink-a12);border-radius:999px;padding:13px 18px;display:flex;align-items:center;gap:10px;cursor:text;flex:none">
<input data-role="wm-search" placeholder="${esc(tx('Suchen …'))}" value="${esc(ui.query || '')}" style="flex:1;min-width:0;border:0;outline:none;background:transparent;font:400 14px ${FONT};color:var(--ink);padding:0">
</label>`;
}

// Untere Leiste (08.2): echtes Bedienelement der Bottom-Ebene — Auswahl, Loop, Suche, Übernehmen.
// Die Loop-Zeile (opts.showLoop) steht in BEIDEN Tabs an derselben Stelle und öffnet den
// editierbaren Loop-Flow (Ü5/E3).
// v4 P0-5d: KEIN vollbreites weißes Rechteck mit Trennlinie mehr. Der Träger ist durchsichtig;
// einen deckenden Grund haben nur die echten Bedienelemente darin (Auswahlkasten, Loop-Zeile,
// Suchpille, Übernehmen-Knopf). Der Inhalt endet nicht an einer harten Kante, sondern blendet
// über der Ebene aus — die Maske dafür setzt fitInsets() nach echter Messung.
function coreBottomHtml(ctx, opts, entries) {
  const label = opts.submitLabel || tx('Übernehmen');
  const loopDraft = opts.showLoop && opts.draftId ? ctx.repo.getDraft(opts.draftId) : null;
  // Runde 2 (gefunden vom Bedienelement-Sweep): Der Träger stand auf pointer-events:auto — sein
  // Innenabstand und die Lücken zwischen Suchpille und Knopf fingen Tipps ab, auch auf
  // Vorschlagszeilen, die sichtbar dahinter ausblenden (P0-5). Jetzt ist er durchlässig; nur die
  // echten Bedienelemente nehmen Tipps an. display:contents ändert am Layout nichts.
  return `<div style="pointer-events:none;padding:10px 20px 26px;display:flex;flex-direction:column;gap:9px">
<div style="display:contents;pointer-events:auto">${selectionSummaryHtml(ctx, opts, entries)}
${opts.searchTop ? '' : coreInputHtml(ctx, opts)}</div>
<button data-act="wm-apply" data-ueber-karte style="pointer-events:auto;display:block;width:100%;background:var(--green);color:var(--on-accent);font:650 15px/1 ${FONT};padding:16px 0;border-radius:999px;text-align:center;border:0;cursor:pointer;appearance:none">${esc(label)}</button>
</div>`;
}

// Sheets der Entdecken-Fläche (08.3 Details, 08.3b Anbieter, 08.5 Filter) — höchste Ebene.
// Der Aufrufer legt sie in die overlays-Ebene seines Scaffolds (opts.hideSheets).
export function discoverOverlays(ctx, opts = {}) {
  const ui = coreUi(ctx, opts);
  return (ui.filterSheet ? filterSheetHtml(ctx, opts) : '')
    + (ui.sheetSuggestionId ? suggestionSheetHtml(ctx.repo.getSuggestion(ui.sheetSuggestionId, teilnehmendeVon(ctx, opts)), { chooser: ui.chooser, entries: opts.draftId ? coreEntries(ctx, opts) : null, fotoInfo: ui.fotoInfo === `sheet:${ui.sheetSuggestionId}` }) : '')
    + (ui.wahlFrage && opts.draftId ? wahlFrageHtml(ui.wahlFrage, coreEntries(ctx, opts)) : '');
}

export function renderDiscoverCore(ctx, opts = {}) {
  const ui = coreUi(ctx, opts);
  const filter = coreFilter(ctx, opts);
  // v5 A27a: „Daheim" hat keine Karte und keinen Radius — es gibt dort schlicht nichts
  // zu verorten. Der Umschalter bleibt sichtbar, ist aber erkennbar gesperrt.
  const daheim = filter.placeMode === 'daheim';
  const view = ui.view || 'list';
  const tab = ui.tab || 'discover';
  const entries = coreEntries(ctx, opts);

  // v5 A27d: gleitender Indikator auch hier — dieselbe Mechanik wie beim Liste/Karte-Umschalter.
  const tabKeys = ['discover', 'own'];
  const tabIndex = Math.max(0, tabKeys.indexOf(tab));
  const toggleRow = `<div style="position:relative;background:var(--field);border-radius:16px;padding:4px;display:flex">
<span data-seg-indicator aria-hidden="true" style="position:absolute;left:4px;top:4px;bottom:4px;width:calc(50% - 4px);border-radius:12px;background:var(--surface);box-shadow:0 1px 3px var(--shadow-08);transform:translateX(${tabIndex * 100}%);transition:transform .24s cubic-bezier(.4,0,.2,1)"></span>
${tabKeys.map((key) => `<button data-act="disc-tab" data-tab="${key}" aria-pressed="${tab === key}" style="position:relative;z-index:1;flex:1;border-radius:12px;padding:11px 0;text-align:center;font-size:13.5px;font-weight:${tab === key ? 650 : 600};color:${tab === key ? 'var(--ink)' : 'var(--muted)'};border:0;background:transparent;cursor:pointer;appearance:none;font-family:${FONT};transition:color .2s ease-out"><span style="pointer-events:none">${key === 'discover' ? tx('Entdecken') : tx('Eigene Idee')}</span></button>`).join('')}</div>`;

  const count = filterCount(filter);
  const aktivView = daheim ? 'list' : view;
  const viewGroup = viewGroupHtml(aktivView, 'disc-view', { lockedMap: daheim });
  const filterRow = tab === 'discover'
    ? `<div style="display:flex;justify-content:space-between;align-items:center">
<button data-act="disc-filter-open" style="display:flex;align-items:center;gap:7px;background:var(--surface);border:1.5px solid var(--ink-a10);border-radius:999px;padding:9px 13px;font-size:12px;font-weight:650;cursor:pointer;appearance:none;font-family:${FONT};color:var(--ink)">${filterIcon()}<span style="pointer-events:none">${tx('Filter')}</span>${/* v7 spec/05 §1: keine vollschwarze Füllung als Zustandsanzeige — der Zähler trägt
     denselben ruhigen Grünton wie jede andere Auswahl im Bereich. */ ''}${count ? `<span style="background:var(--green-tint);color:var(--green-dark);border:1px solid var(--green-a40);box-sizing:border-box;border-radius:999px;font-size:10px;font-weight:650;padding:2px 6px;pointer-events:none">${count}</span>` : ''}</button>
${viewGroup}
</div>`
    : '';

  // v7 A25b: Der Bereichskopf trägt nur noch das Label. Oben rechts im Chooser-Kopf
  // (chooserHeaderHtml) sitzt seit Runde 2 „Spontanes Treffen".
  // Runde 2: In der Liste tragen die Stufen die Überschriften — „In der Nähe" wäre doppelt.
  const bereichsLabel = tab === 'own' ? tx('Neue Idee') : (view === 'map' && !daheim ? tx('Auf der Karte') : '');
  const sectionHead = bereichsLabel ? `<div style="display:flex;align-items:center"><span style="${labelStyle}">${bereichsLabel}</span></div>` : '';

  // v7 A27a: Die Hinweiszeile ist ein ruhiger Teil des Bereichs — kein Sheet, keine
  // neue Seite, keine Volltonfläche. Sie trägt die direkte Aktion „Daheim entfernen"
  // und lässt sich schließen, ohne den Filter anzufassen.
  const daheimHinweis = tab === 'discover' && daheim && ui.daheimHinweis
    ? `<div style="display:flex;align-items:center;gap:10px;background:var(--orange-tint);border:1px solid var(--orange-a22);border-radius:14px;padding:10px 11px 10px 13px">
<span style="font-size:12px;font-weight:600;color:var(--orange-dark);flex:1;min-width:0;line-height:1.35">${tx('„Daheim" hat keine Karte — es gibt dort nichts zu verorten.')}</span>
<button data-act="disc-daheim-off" style="border:1.5px solid var(--orange-a40);background:var(--surface);color:var(--orange-dark);border-radius:999px;padding:7px 11px;font:650 11.5px/1 ${FONT};cursor:pointer;appearance:none;flex:none;white-space:nowrap"><span style="pointer-events:none">${tx('Daheim entfernen')}</span></button>
<button data-act="disc-daheim-hint-close" aria-label="${esc(tx('Hinweis schließen'))}" style="border:0;background:transparent;padding:15px;margin:-15px -11px -15px -13px;cursor:pointer;appearance:none;flex:none;display:flex">${xSmallIcon('var(--orange-dark)', 13)}</button>
</div>`
    : '';

  const showMap = tab === 'discover' && view === 'map' && !daheim;
  // Die Fläche fließt im Scrollkörper des Screens (v3.1 §1). Die Karte ist ein eigenes
  // horizontales Control (data-hdrag) mit fester Höhe statt einer zweiten Scrollfläche.
  const body = showMap
    ? `<div data-role="disc-body" data-hdrag="map" data-disc-karte="1" style="height:400px;min-height:400px;position:relative;background:var(--field);overflow:hidden;touch-action:none">
<div data-fremd="1" data-role="disc-karte" style="position:absolute;inset:0"></div>
<div data-role="disc-map-stage" style="position:absolute;inset:0;pointer-events:none;overflow:hidden">${mapInnerHtml(ctx, opts, filter)}</div></div>`
    : `<div data-role="disc-body" style="padding:12px 20px 10px;display:flex;flex-direction:column;gap:8px">${tab === 'own' ? ownListInnerHtml(ctx, opts) : listInnerHtml(ctx, opts, filter)}</div>`;

  const sheets = opts.hideSheets ? '' : discoverOverlays(ctx, opts);

  // opts.searchTop / opts.hideSubmit: Variante für eingebettete Nutzung (05.6e) —
  // Suchfeld oben, kein eigener CTA. Ohne die Optionen bleibt 08.2 unverändert.
  const topSearch = opts.searchTop ? coreInputHtml(ctx, opts) : '';
  const bottom = opts.hideSubmit ? '' : coreBottomHtml(ctx, opts, entries);

  return `<div style="display:flex;flex-direction:column;gap:10px;padding:0 20px ${showMap ? '12px' : '0'}">${toggleRow}${filterRow}${daheimHinweis}${topSearch}${sectionHead}</div>${body}${bottom}${sheets}`;
}

// Runde 4 (gemessen: ein Tipp auf „Entfernung" bewegte „Budget"): Erscheint die Entfernungszeile,
// verwendet der Abgleich den bisherigen Budget-Regler als Knoten für die Entfernung weiter — und
// bindeEinmalig (app.js) lässt an einem Knoten den ERSTEN Handler stehen. Welcher Regler gemeint
// ist, liest der Handler deshalb erst beim Ereignis vom Knoten selbst.
function bindFilterSliders(root, ctx, opts) {
  root.querySelectorAll('[data-role="radius-track"], [data-role="budget-track"]').forEach((track) => {
    track.addEventListener('pointerdown', (event) => {
      const role = String(track.dataset.role || '').replace(/-track$/, '');
      if (role !== 'radius' && role !== 'budget') return;
      filterReglerZiehen(root, coreUi(ctx, opts), track, role, event);
    });
  });
}

function filterReglerZiehen(root, ui, track, role, startEvent) {
  {
    const apply = (clientX) => {
      const rect = track.getBoundingClientRect();
      const t = clamp((clientX - rect.left) / rect.width, 0, 1);
      if (!ui.filterDraft) ui.filterDraft = { ...DEFAULT_FILTER };
      if (role === 'radius') ui.filterDraft.radiusKm = kmAusAnteil(t);
      else ui.filterDraft.budget = budgetFromT(t);
      // Runde 4 (D9): Der Entfernungsregler rastet nicht mehr ein — sein Knopf sitzt, wo der Finger ist.
      const pct = (role === 'radius' ? t : tFromBudget(ui.filterDraft.budget)) * 100;
      const fill = root.querySelector(`[data-role="${role}-fill"]`);
      const thumb = root.querySelector(`[data-role="${role}-thumb"]`);
      const labelEl = root.querySelector(`[data-role="${role}-label"]`);
      if (fill) fill.style.width = `${pct}%`;
      if (thumb) thumb.style.left = `${pct}%`;
      if (labelEl) labelEl.textContent = role === 'radius' ? radiusLabelText(ui.filterDraft.radiusKm) : budgetLabelText(ui.filterDraft.budget);
      track.setAttribute('aria-valuetext', labelEl?.textContent || '');
    };
    startEvent.preventDefault();
    track.setPointerCapture?.(startEvent.pointerId);
    apply(startEvent.clientX);
    const move = (ev) => apply(ev.clientX);
    const up = () => {
      track.removeEventListener('pointermove', move);
      track.removeEventListener('pointerup', up);
      track.removeEventListener('pointercancel', up);
    };
    track.addEventListener('pointermove', move);
    track.addEventListener('pointerup', up);
    track.addEventListener('pointercancel', up);
  }
}

// D3-1 / Runde 2: Die Umkreis-Karte lebt über viele Zeichnungen hinweg (karteHalten,
// data-fremd). Alles, was an der KARTE oder am Griff hängt, wird genau EINMAL angemeldet und
// arbeitet mit dem jeweils frischesten Stand (umkreisStand) — Knoten, ctx und Filter können
// beim nächsten Zeichnen andere sein.
let umkreisStand = null;

function bindUmkreisKarte(root, ctx, opts) {
  const body = root.querySelector('[data-role="disc-body"][data-disc-karte]');
  if (!body) { umkreisStand = null; return; }
  const ui = coreUi(ctx, opts);
  const filter = coreFilter(ctx, opts);
  const mitte = suchMitte(ctx, opts);
  const stand = { km: radiusKm(filter), anzeigeKm: null, aktiv: umkreisAktiv(ctx, filter, opts) };
  const eintraege = umkreisEintraege(ctx, opts, filter);
  const knoten = (rolle) => body.querySelector(`[data-role="${rolle}"]`);
  const drinnen = (e) => !stand.aktiv || (e.d != null && e.d <= stand.km);

  // Alles an seine Stelle: Ring, Mitte, Griff — und im Rückfall die Kacheln, exakt am Ort.
  const stellen = () => {
    const w = body.clientWidth || KARTE_W;
    const h = body.clientHeight || KARTE_H;
    ui.discMass = { w, h };
    const ausschnitt = discAusschnitt(ctx, opts, mitte, stand.km);
    // Beim Ziehen folgt der Ring dem Finger stufenlos; der Wert ist die ganze Zahl (stand.km).
    const u = umkreisLage(ausschnitt, w, h, mitte, stand.anzeigeKm ?? stand.km);
    const R = Math.round(u.R);
    const ring = knoten('disc-radius-ring');
    if (ring) Object.assign(ring.style, { left: `${Math.round(u.x - R)}px`, top: `${Math.round(u.y - R)}px`, width: `${R * 2}px`, height: `${R * 2}px` });
    const mitteEl = knoten('disc-mitte');
    if (mitteEl) { mitteEl.style.left = `${Math.round(u.x)}px`; mitteEl.style.top = `${Math.round(u.y)}px`; }
    body.querySelectorAll('[data-role="disc-anker"]').forEach((el) => {
      const p = bildpunkt(ausschnitt, w, h, { lat: Number(el.dataset.lat), lon: Number(el.dataset.lon) });
      const drin = !stand.aktiv || Number(el.dataset.distance) <= stand.km;
      const innen = el.querySelector('[data-role="disc-kachel-innen"]');
      if (innen) innen.style.opacity = drin ? '' : '.45';
      const punkt = el.querySelector('[data-role="disc-punkt"]');
      if (punkt) punkt.style.opacity = drin ? '' : '.55';
      el.style.transform = `translate(${Math.round(p.x)}px,${Math.round(p.y)}px) translate(0,-100%)`;
    });
    const label = knoten('disc-radius-label');
    if (label && stand.aktiv) label.textContent = radiusMapLabel(stand.km, eintraege.filter(drinnen).length);
    const griff = knoten('disc-radius-handle');
    if (griff) {
      const lage = griffPunkt(u, R, w, h);
      griff.style.left = `${lage.x}px`;
      griff.style.top = `${lage.y}px`;
      griff.setAttribute('aria-valuenow', String(stand.km));
      griff.setAttribute('aria-valuetext', radiusLabelText(stand.km));
    }
  };

  // Markierungen über den gemeinsamen Baustein (ui/map.js › ortMarken, P3): gewählt = 'gewaehlt'
  // (vorne), außerhalb des Umkreises = 'blass'. Ein Tipp öffnet den Vorschlag (wm-open).
  const markenSetzen = () => {
    const st = umkreisStand;
    if (!st?.marken) return;
    st.marken.setzen(eintraege.map((e, i) => {
      const drin = drinnen(e);
      const unter = kachelMeta(e.d, e.s) || kindWord(e.s.kind);
      return {
        key: e.s.id,
        lat: e.s.place.lat,
        lon: e.s.place.lon,
        rang: (e.sel ? 0 : drin ? 1 : 2) + i / 1000,
        eintraege: [{
          id: e.s.id,
          zeichen: activityIconSvg({ icon: e.s.icon, iconKey: e.s.iconKey, title: e.s.title, category: e.s.category }, 'currentColor', 16),
          titel: e.s.shortTitle || e.s.title,
          unter,
          attrs: `data-act="wm-open" data-suggestion="${esc(e.s.id)}"`,
          ton: e.sel ? 'gewaehlt' : (drin ? '' : 'blass'),
          label: [e.s.title, unter].filter(Boolean).join(', '),
        }],
      };
    }));
  };
  let markenBild = 0;
  const markenBald = () => {
    if (markenBild) return;
    markenBild = window.requestAnimationFrame(() => { markenBild = 0; markenSetzen(); });
  };

  umkreisStand = {
    ctx, opts, ui, mitte, stand, stellen, markenBald,
    karte: umkreisStand?.karte || null, marken: umkreisStand?.marken || null,
  };
  stellen();

  const start = discAusschnitt(ctx, opts, mitte, stand.km);
  // Runde 3 (I10: „Man braucht das Scroll-Ding"): derselbe Höhenregler wie auf der Meet-Karte —
  // Lage und Höhe setzt seit Runde 4 die gemeinsame Bedienspalte (P3). EINE Karte je Knoten: jede
  // Bindung wartet auf dieselbe Anlage, sonst legen zwei schnelle Zeichnungen zwei Karten übereinander.
  const kartenKnotenUmkreis = knoten('disc-karte');
  if (kartenKnotenUmkreis) {
    kartenKnotenUmkreis.__crewKarte ||= karteHalten(kartenKnotenUmkreis, 'disc-karte', { mitte: start.mitte, zoom: start.zoom, folgen: false, hoehenRegler: true });
  }
  Promise.resolve(kartenKnotenUmkreis?.__crewKarte || null).then((karte) => {
    if (!karte || umkreisStand?.stellen !== stellen) return;
    umkreisStand.karte = karte;
    // Runde 5: meine Lage (D4) und die Bedienspalte nach jedem Zeichnen (Schilder kommen und gehen).
    kartenBausteine.kartenLageQuelle?.(ctx.repo);
    kartenBausteine.bedienSpalteOrdnen?.(karte);
    if (typeof kartenBausteine.ortMarken === 'function') {
      umkreisStand.marken = kartenBausteine.ortMarken(karte, { schluessel: 'nm-vorschlaege' });
      markenSetzen();
    }
    if (!karte.__crewUmkreis) {
      karte.__crewUmkreis = true;
      karte.on('move', () => {
        const st = umkreisStand;
        if (!st) return;
        const c = karte.getCenter();
        st.ui.discAusschnitt = { mitte: { lat: c.lat, lon: c.lng }, zoom: karte.getZoom() };
        st.stellen();
      });
    }
    // Ohne Mitte gibt es nichts, worauf man den Ausschnitt legen könnte — mit Orten zeigt die Karte
    // beim ersten Öffnen alle Orte.
    if (!standortBekannt(ctx, opts) && !ui.discOrteEingepasst) {
      ui.discOrteEingepasst = true;
      const orte = eintraege.map((e) => e.s.place);
      if (orte.length) { passeAufPunkte(karte, orte, { padding: 90, maxZoom: 14 }); return; }
    }
    // Soll die Karte woanders stehen (Umkreis eingeschaltet, andere Mitte), fährt sie dorthin.
    const soll = discAusschnitt(ctx, opts, mitte, stand.km);
    const c = karte.getCenter();
    const anders = Math.abs(c.lat - soll.mitte.lat) > 1e-5 || Math.abs(c.lng - soll.mitte.lon) > 1e-5
      || Math.abs(karte.getZoom() - soll.zoom) > 0.01;
    if (anders) karte.easeTo({ center: [soll.mitte.lon, soll.mitte.lat], zoom: soll.zoom, duration: 380 });
  });

  // Rückfall (ohne ortMarken): Rad und Zug über einer Kachel gehören der KARTE. Ein kurzer Tipp
  // bleibt ein Tipp; ab sechs Pixeln ist es ein Zug, und der folgende Klick wird verschluckt.
  if (!body.__crewKachelZug) {
    body.__crewKachelZug = true;
    let zug = null;
    const schluck = (ereignis) => { ereignis.stopPropagation(); ereignis.preventDefault(); };
    const ueberSchild = '[data-role="disc-kachel"], [data-role="disc-schilder"] > *';
    body.addEventListener('pointerdown', (ereignis) => {
      if (ereignis.button || !ereignis.target.closest?.('[data-role="disc-kachel"]')) { zug = null; return; }
      zug = { x: ereignis.clientX, y: ereignis.clientY, id: ereignis.pointerId, weit: false };
    });
    body.addEventListener('pointermove', (ereignis) => {
      const karte = umkreisStand?.karte;
      if (!zug || ereignis.pointerId !== zug.id || !karte) return;
      const dx = ereignis.clientX - zug.x;
      const dy = ereignis.clientY - zug.y;
      if (!zug.weit && Math.hypot(dx, dy) < 6) return;
      if (!zug.weit) { zug.weit = true; body.setPointerCapture?.(ereignis.pointerId); }
      karte.panBy([-dx, -dy], { animate: false });
      zug.x = ereignis.clientX;
      zug.y = ereignis.clientY;
      ereignis.preventDefault();
    });
    const loslassen = () => {
      if (zug?.weit) {
        body.addEventListener('click', schluck, { capture: true });
        window.setTimeout(() => body.removeEventListener('click', schluck, { capture: true }), 350);
      }
      zug = null;
    };
    body.addEventListener('pointerup', loslassen);
    body.addEventListener('pointercancel', loslassen);
    body.addEventListener('wheel', (ereignis) => {
      const karte = umkreisStand?.karte;
      if (!karte || !ereignis.target.closest?.(ueberSchild)) return;
      const ziel = karte.getCanvasContainer?.();
      if (!ziel) return;
      ereignis.preventDefault();
      ziel.dispatchEvent(new WheelEvent('wheel', {
        deltaX: ereignis.deltaX,
        deltaY: ereignis.deltaY,
        deltaMode: ereignis.deltaMode,
        clientX: ereignis.clientX,
        clientY: ereignis.clientY,
        bubbles: false,
        cancelable: true,
      }));
    }, { passive: false });
  }

  // Der Griff: Maus, Stift und Finger laufen über denselben Zeiger-Pfad. Runde 4 (D9): Der Ring
  // folgt dem Zug stufenlos, der Wert springt Kilometer für Kilometer; beim Loslassen wird er
  // wirksam. Die Karte bleibt dabei stehen (commitRadius passt nur ein, wenn der Ring nicht mehr
  // ins Bild passt). Koordinaten aus dem real gerenderten Rechteck inkl. Skalierung.
  const griff = knoten('disc-radius-handle');
  if (griff && !griff.__crewUmkreis) {
    griff.__crewUmkreis = true;
    let zeiger = null;
    const kmAm = (ereignis) => {
      const st = umkreisStand;
      const flaeche = griff.closest('[data-role="disc-body"]');
      if (!st || !flaeche) return null;
      const feld = flaeche.getBoundingClientRect();
      const skala = flaeche.offsetWidth ? feld.width / flaeche.offsetWidth : 1;
      const ausschnitt = st.ui.discAusschnitt || discAusschnitt(st.ctx, st.opts, st.mitte, st.stand.km);
      const u = umkreisLage(ausschnitt, flaeche.clientWidth || KARTE_W, flaeche.clientHeight || KARTE_H, st.mitte, st.stand.km);
      const dx = (ereignis.clientX - feld.left) / skala - u.x;
      const dy = (ereignis.clientY - feld.top) / skala - u.y;
      return (Math.hypot(dx, dy) * meterProPixel(st.mitte.lat, ausschnitt.zoom)) / 1000;
    };
    const zeigen = (roh) => {
      const st = umkreisStand;
      if (!st || roh == null || !Number.isFinite(roh)) return;
      st.stand.anzeigeKm = clamp(roh, RADIUS_MIN_KM, RADIUS_MAX_KM);
      const km = clamp(Math.round(roh), RADIUS_MIN_KM, RADIUS_MAX_KM);
      if (km !== st.stand.km) { st.stand.km = km; st.markenBald(); }
      st.stellen();
    };
    griff.addEventListener('pointerdown', (ereignis) => {
      if (ereignis.button !== undefined && ereignis.button !== 0) return;
      ereignis.preventDefault();
      ereignis.stopPropagation();
      zeiger = ereignis.pointerId;
      griff.setPointerCapture?.(zeiger);
      rueckmeldung('auswahl');
    });
    griff.addEventListener('pointermove', (ereignis) => {
      if (zeiger === null || ereignis.pointerId !== zeiger) return;
      ereignis.preventDefault();
      zeigen(kmAm(ereignis));
    });
    const fertig = (ereignis) => {
      if (zeiger === null || (ereignis && ereignis.pointerId !== undefined && ereignis.pointerId !== zeiger)) return;
      griff.releasePointerCapture?.(zeiger);
      zeiger = null;
      const st = umkreisStand;
      if (!st) return;
      st.stand.anzeigeKm = null;
      rueckmeldung('auswahl');
      commitRadius(st.ctx, st.opts, st.stand.km);
    };
    griff.addEventListener('pointerup', fertig);
    griff.addEventListener('pointercancel', fertig);
    // Tastatur: ein Kilometer je Pfeiltaste, mit Umschalt zehn.
    griff.addEventListener('keydown', (ereignis) => {
      const st = umkreisStand;
      const richtung = ereignis.key === 'ArrowLeft' || ereignis.key === 'ArrowDown' ? -1
        : ereignis.key === 'ArrowRight' || ereignis.key === 'ArrowUp' ? 1 : 0;
      if (!richtung || !st) return;
      ereignis.preventDefault();
      zeigen(st.stand.km + richtung * (ereignis.shiftKey ? 10 : 1));
      st.stand.anzeigeKm = null;
      commitRadius(st.ctx, st.opts, st.stand.km);
    });
  }
}

// Runde 3 (I10): Ein- und Ausschalten des Umkreises schreibt in denselben Filter wie das
// Filter-Sheet — der Umkreis IST der Entfernungswert des Ortsfilters „Unterwegs".
function schreibeFilter(ctx, opts, next) {
  if (opts.draftId) {
    const draft = ctx.repo.getDraft(opts.draftId);
    ctx.repo.updateDraft(opts.draftId, { filter: { ...(draft?.filter || {}), ...next } });
  } else {
    coreUi(ctx, opts).filter = next;
    ctx.render();
  }
}

// Der auf der Karte gezogene Radius wird echt wirksam: er landet im Filter und schaltet den
// Ortsmodus auf „unterwegs", sonst bliebe der Wert (DEFAULT_FILTER placeMode „egal") folgenlos.
// v5 A27c: Wer „Daheim" gewählt hat, verliert seinen Filter nicht unbemerkt beim Ziehen.
// Runde 4 (D9): Die Karte bleibt nach dem Loslassen stehen — vorher passte sie den Umkreis jedes
// Mal neu ein, und der eben gezogene Ring sprang auf dieselbe Größe zurück. Neu eingepasst wird
// nur, wenn der Ring nicht mehr ins Bild passt oder kaum noch zu sehen ist.
function commitRadius(ctx, opts, km) {
  const current = coreFilter(ctx, opts);
  const modus = current.placeMode === 'daheim' ? 'daheim' : 'unterwegs';
  const ui = coreUi(ctx, opts);
  const mitte = suchMitte(ctx, opts);
  const mass = ui.discMass || { w: KARTE_W, h: KARTE_H };
  if (ui.discAusschnitt) {
    const u = umkreisLage(ui.discAusschnitt, mass.w, mass.h, mitte, km);
    if (u.R > Math.min(mass.w, mass.h) * 0.5 || u.R < 24) ui.discAusschnitt = eingepassterAusschnitt(mitte, km, mass);
  } else {
    ui.discAusschnitt = eingepassterAusschnitt(mitte, km, mass);
  }
  if (current.radiusKm === km && current.placeMode === modus) { ctx.render(); return; }
  const next = { ...current, radiusKm: km, placeMode: modus };
  if (opts.draftId) {
    const draft = ctx.repo.getDraft(opts.draftId);
    ctx.repo.updateDraft(opts.draftId, { filter: { ...(draft?.filter || {}), ...next } });
  } else {
    ui.filter = next;
    ctx.render();
  }
}

function commitCoreFilter(ctx, opts) {
  const ui = coreUi(ctx, opts);
  const next = { ...(ui.filterDraft || DEFAULT_FILTER) };
  ui.filterSheet = false;
  // Runde 2: Ein neuer Umkreis aus dem Filter wird auf der Karte ebenfalls eingepasst.
  if (next.radiusKm !== coreFilter(ctx, opts).radiusKm) ui.discAusschnitt = null;
  if (opts.draftId) {
    const draft = ctx.repo.getDraft(opts.draftId);
    ctx.repo.updateDraft(opts.draftId, { filter: { ...(draft?.filter || {}), ...next } });
  } else {
    ui.filter = next;
    ctx.render();
  }
}

function descForKindId(ctx, kind, id) {
  if (kind === 'sug') {
    const s = ctx.repo.getSuggestion(id);
    return s ? descFromSuggestion(s) : null;
  }
  const o = typedOwnIdeas(ctx).find((entry) => entry.id === id);
  return o ? descFromOwn(o) : null;
}

// Die Entdecken-Fläche passt sich ihrer Umgebung an: Liegt sie in einer Scrollfläche
// (screenScaffold), fließt sie darin mit. Steht sie in einer alten Flex-Kette, stellt sie
// ihr Scrollen selbst her — so bleibt jeder Aufrufer ohne Signaturänderung lauffähig.
function adaptDiscoverLayout(root) {
  const body = root.querySelector('[data-role="disc-body"]');
  const scroll = body?.closest('.screen-scroll') || body?.closest('[data-layerscroll]');
  if (body && !scroll) {
    body.style.flex = '1';
    body.style.minHeight = body.dataset.hdrag ? `${KARTE_MIN_H}px` : '0';
    if (!body.dataset.hdrag) {
      body.style.overflowY = 'auto';
      body.style.scrollbarWidth = 'none';
      body.dataset.scrollKeep = 'disc-list';
    }
  }
  // Kartenansicht (08.4): die Karte füllt die freie Fläche und läuft unter die Bottom-Ebene,
  // statt über einem beigen Rest zu enden.
  if (body && scroll && body.dataset.hdrag === 'map') {
    scroll.style.paddingBottom = '0px';
    const top = body.getBoundingClientRect().top - scroll.getBoundingClientRect().top + scroll.scrollTop;
    const height = scroll.clientHeight - top;
    body.style.height = `${Math.max(KARTE_MIN_H, Math.round(height))}px`;
    body.style.minHeight = '0';
  }
  // Sheets gehören auf die höchste Ebene des Handy-Rahmens, nie in eine Scrollfläche.
  const phone = root.querySelector('.runtime-phone');
  if (!phone) return;
  root.querySelectorAll('[data-disc-sheet]').forEach((layer) => {
    if (layer.parentElement !== phone) phone.appendChild(layer);
  });
}

export function bindDiscoverCore(root, ctx, opts = {}) {
  const ui = coreUi(ctx, opts);
  adaptDiscoverLayout(root);

  const refreshBody = () => {
    const body = root.querySelector('[data-role="disc-body"]');
    if (!body) return;
    const filter = coreFilter(ctx, opts);
    const stage = body.querySelector('[data-role="disc-map-stage"]');
    if (stage) {
      // Runde 2: Nur die Ebene über der Karte wird neu gebaut — die Karte selbst lebt weiter.
      stage.innerHTML = mapInnerHtml(ctx, opts, filter);
      bindUmkreisKarte(root, ctx, opts);
      return;
    }
    body.innerHTML = ui.tab === 'own' ? ownListInnerHtml(ctx, opts) : listInnerHtml(ctx, opts, filter);
    bindVorschlagZug(root, ctx, opts);
  };

  // v5: Der Zustand wird zur EREIGNISZEIT aufgeloest, nicht beim Binden. Seit dem
  // In-Place-Abgleich ueberlebt der Eingabeknoten mehrere Renders; haengt der Handler an
  // einem alten ui-Objekt (etwa weil die Route ihre Parameter ergaenzt hat), schreibt er
  // ins Leere — der getippte Text war beim naechsten Render weg.
  const search = root.querySelector('[data-role="wm-search"]');
  if (search) {
    search.addEventListener('input', () => { coreUi(ctx, opts).query = search.value; refreshBody(); });
    search.addEventListener('keydown', (event) => { if (event.key === 'Enter') search.blur(); });
  }
  // v6 A17b/A22: Das Titelfeld steht MITTEN im Auswahlbereich. Ein refreshBody() würde
  // beim Tippen genau den Knoten ersetzen, in dem der Cursor steht — deshalb aktualisiert
  // der Handler nur den Anlege-Knopf und die Kartenkontur direkt am DOM. Nichts wird
  // neu gemountet, der Fokus bleibt.
  const ownTitle = root.querySelector('[data-role="wm-own-title"]');
  if (ownTitle) {
    const karte = root.querySelector('[data-role="wm-own-create"]');
    const addBtn = root.querySelector('[data-role="wm-own-add"]');
    // v7 A26a: Die Symbolvorschau zeigt beim Tippen sofort, welches Symbol die Ableitung
    // liefert — deshalb wird sie hier direkt am DOM nachgezogen, ohne Rerender.
    const vorschau = root.querySelector('[data-role="wm-own-preview"]');
    const spiegeln = () => {
      const text = ownTitle.value.trim();
      const gefuellt = Boolean(text);
      if (addBtn) {
        addBtn.style.background = gefuellt ? 'var(--green)' : 'var(--field)';
        addBtn.style.color = gefuellt ? 'var(--on-accent)' : 'var(--muted-light)';
      }
      if (karte) karte.style.borderColor = gefuellt ? 'var(--green-a40)' : 'var(--ink-a12)';
      if (vorschau) vorschau.innerHTML = activityIconSvg(iconBeschreibung({ title: text, category: eigeneKategorie(text) }), 'var(--ink)', 20);
    };
    ownTitle.addEventListener('input', () => { coreUi(ctx, opts).ownTitle = ownTitle.value; spiegeln(); });
    ownTitle.addEventListener('keydown', (event) => { if (event.key === 'Enter') ownTitle.blur(); });
  }

  // v7 A26b: Der Kosten-Slider schreibt direkt in den ui-Zustand und aktualisiert nur
  // Füllung, Griff und Beschriftung am DOM. Ein Rerender würde hier den Titel-Eingabe-
  // knoten ersetzen, in dem der Cursor steht — genau das darf beim Ziehen nicht passieren.
  const costTrack = root.querySelector('[data-role="owncost-track"]');
  if (costTrack) {
    const setzen = (clientX) => {
      const rect = costTrack.getBoundingClientRect();
      const wert = ownCostFromT((clientX - rect.left) / rect.width);
      coreUi(ctx, opts).ownCost = wert;
      const pct = (ownCostT(wert) * 100).toFixed(1);
      const fill = root.querySelector('[data-role="owncost-fill"]');
      const thumb = root.querySelector('[data-role="owncost-thumb"]');
      const label = root.querySelector('[data-role="owncost-label"]');
      if (fill) fill.style.width = `${pct}%`;
      if (thumb) thumb.style.left = `${pct}%`;
      if (label) label.textContent = ownCostLabel(wert);
      costTrack.setAttribute('aria-valuenow', String(wert));
      costTrack.setAttribute('aria-valuetext', ownCostLabel(wert));
    };
    costTrack.addEventListener('pointerdown', (event) => {
      event.preventDefault();
      costTrack.setPointerCapture?.(event.pointerId);
      setzen(event.clientX);
      const move = (ev) => setzen(ev.clientX);
      const up = () => {
        costTrack.removeEventListener('pointermove', move);
        costTrack.removeEventListener('pointerup', up);
      };
      costTrack.addEventListener('pointermove', move);
      costTrack.addEventListener('pointerup', up);
    });
  }

  bindActions(root, {
    'disc-tab': (data) => {
      if ((ui.tab || 'discover') === data.tab) return;
      ui.tab = data.tab;
      ctx.render();
    },
    'disc-view': (data) => {
      // v7 A27a (spec/05 §4): Bei „Daheim" gibt es keine Karte. Der Tap führt ruhig zur
      // Liste zurück und blendet eine kurze Hinweiszeile MIT direkter Aktion ein. Der
      // frühere Toast konnte konstruktionsbedingt keinen Knopf tragen (pointer-events:none)
      // und verschwand nach 2,6 s — es gab also keinen Weg aus dem Zustand heraus.
      if (data.view === 'map' && coreFilter(ctx, opts).placeMode === 'daheim') {
        ui.view = 'list';
        ui.daheimHinweis = true;
        ctx.render();
        return;
      }
      ui.view = data.view;
      ui.daheimHinweis = false;
      ctx.render();
    },
    // Entfernt den Daheim-Filter und zeigt die Karte, die der Tap eigentlich wollte.
    'disc-daheim-off': () => {
      ui.daheimHinweis = false;
      if (opts.draftId) {
        const draft = ctx.repo.getDraft(opts.draftId);
        ctx.repo.updateDraft(opts.draftId, { filter: { ...DEFAULT_FILTER, ...(draft?.filter || {}), placeMode: 'egal' } });
      } else {
        ui.filter = { ...coreFilter(ctx, opts), placeMode: 'egal' };
      }
      ui.view = 'map';
      ctx.render();
    },
    'disc-daheim-hint-close': () => { ui.daheimHinweis = false; ctx.render(); },
    // Runde 3 (I10): Umkreis direkt auf der Karte ein- und ausschalten. Einschalten setzt den
    // Ortsfilter auf „Unterwegs" (mit dem bisherigen Entfernungswert) und passt die Karte auf den
    // ganzen Umkreis ein; Ausschalten nimmt „Unterwegs" zurück, die Karte bleibt, wo sie ist.
    'disc-umkreis-an': () => {
      const aktuell = coreFilter(ctx, opts);
      ui.discAusschnitt = null;
      ui.daheimHinweis = false;
      schreibeFilter(ctx, opts, { ...aktuell, placeMode: 'unterwegs', radiusKm: radiusKm(aktuell) });
    },
    'disc-umkreis-aus': () => {
      schreibeFilter(ctx, opts, { ...coreFilter(ctx, opts), placeMode: 'egal' });
    },
    // Chef H4: Standort NUR auf Tippen erfragen. Gelingt es, meldet die Datenschicht selbst eine
    // Änderung (neue Mitte, nachgeladene Orte). Verweigert: ein kurzer Hinweis, wo man es
    // erlaubt — kein Dauer-Banner.
    'wm-standort': () => {
      if (ui.standortLaeuft || typeof ctx.repo.standortFuerVorschlaege !== 'function') return;
      ui.standortLaeuft = true;
      ctx.render();
      Promise.resolve(ctx.repo.standortFuerVorschlaege())
        .catch(() => ({ ok: false, grund: 'unbekannt' }))
        .then((ergebnis) => {
          ui.standortLaeuft = false;
          if (!ergebnis?.ok) {
            ctx.toast(ergebnis?.grund === 'verweigert'
              ? tx('Standort nicht erlaubt — du kannst ihn in den Einstellungen deines Geräts freigeben.')
              : tx('Standort gerade nicht verfügbar'));
          }
          ctx.render();
        });
    },
    // Runde 2: die Rückfrage bei einer zweiten Wahl (wahlFrageHtml).
    'wm-wahl-zu': () => { ui.wahlFrage = null; ctx.render(); },
    'wm-wahl-ersetzen': () => {
      const desc = ui.wahlFrage;
      ui.wahlFrage = null;
      if (desc && opts.draftId) {
        applySelection(ctx, opts.draftId, [{ ...desc, place: desc.place ? { ...desc.place } : null }]);
        lerneWahl(ctx, opts, desc);
      } else ctx.render();
    },
    'wm-wahl-alt': () => {
      const desc = ui.wahlFrage;
      ui.wahlFrage = null;
      if (desc && opts.draftId) {
        toggleEntry(ctx, opts.draftId, desc, { dazu: true });
        lerneWahl(ctx, opts, desc);
      } else ctx.render();
    },
    'disc-filter-open': () => { ui.filterSheet = true; ui.filterDraft = { ...coreFilter(ctx, opts) }; ctx.render(); },
    'disc-filter-close': () => { ui.filterSheet = false; ctx.render(); },
    'disc-filter-reset': () => { ui.filterDraft = { ...DEFAULT_FILTER }; ctx.render(); },
    'disc-filter-cat': (data) => { ui.filterDraft.category = data.category; ctx.render(); },
    'disc-filter-place': (data) => { ui.filterDraft.placeMode = data.place; ctx.render(); },
    'disc-filter-apply': () => { ui.daheimHinweis = false; commitCoreFilter(ctx, opts); },
    // Runde 4 (C4): Wer wählt oder öffnet, arbeitet mit der Liste — ab jetzt bleibt ihre Reihenfolge.
    'wm-toggle': (data) => {
      const desc = descForKindId(ctx, data.kind, data.id);
      if (!desc) return;
      reiheFesthalten(ctx, opts);
      rueckmeldung('auswahl');
      coreToggle(ctx, opts, desc);
    },
    'wm-open': (data) => { reiheFesthalten(ctx, opts); ui.sheetSuggestionId = data.suggestion; ui.chooser = null; ui.fotoInfo = null; ctx.render(); },
    // Runde 4 (G4): Bildnachweis hinter ⓘ auf- und zuklappen (Karte in der Liste und Detail-Sheet).
    'foto-info': (data) => { reiheFesthalten(ctx, opts); ui.fotoInfo = ui.fotoInfo === data.foto ? null : data.foto; ctx.render(); },
    'sug-karte': (data) => vorschlagRoute(ctx, ui, data.suggestion),
    'wm-selopen': () => { ui.selOpen = !ui.selOpen; ctx.render(); },
    'wm-selmain': (data) => {
      if (!opts.draftId) return;
      const entries = selectionEntries(ctx.repo.getDraft(opts.draftId));
      const index = entries.findIndex((e) => descKey(e) === data.key);
      if (index > 0) {
        const [entry] = entries.splice(index, 1);
        entries.unshift(entry);
        applySelection(ctx, opts.draftId, entries);
      }
    },
    'wm-selremove': (data) => {
      if (opts.draftId) {
        const entries = selectionEntries(ctx.repo.getDraft(opts.draftId));
        const index = entries.findIndex((e) => descKey(e) === data.key);
        if (index >= 0) { entries.splice(index, 1); applySelection(ctx, opts.draftId, entries); }
      } else {
        ui.picked = null;
        ctx.render();
      }
    },
    // v7 A26a: Die Handler wm-own-icon-open / wm-own-icon / wm-own-icon-set sind
    // ersatzlos entfallen. Es gibt keine manuelle Symbolwahl mehr — das Symbol leitet
    // sich aus Kategorie und Titel ab (eigeneKategorie/activityIconSvg).
    'wm-own-add': () => {
      const input = root.querySelector('[data-role="wm-own-title"]');
      const title = (input?.value || ui.ownTitle || '').trim();
      if (!title) { ctx.toast(tx('Erst einen Titel eingeben')); return; }
      const kosten = ui.ownCost;
      // Das Feld wird direkt geleert: hat es noch den Fokus, lässt der In-Place-Abgleich
      // den Wert bewusst stehen (NIE_UEBERSCHREIBEN) — sonst bliebe der alte Titel sichtbar.
      if (input) input.value = '';
      ui.ownTitle = '';
      ui.ownCost = null;
      // Die eigene Idee erscheint sofort in der Auswahl — deshalb darf die neu angelegte
      // Idee auch unter „Schon gespeichert" sichtbar werden, ohne dass jemand sucht.
      ui.savedOpen = true;
      if (opts.draftId) {
        const idea = addTypedOwnIdea(ctx, title, ownCostExtra(kosten));
        coreToggle(ctx, opts, descFromOwn(idea));
      } else if (opts.onPick) {
        opts.onPick({ title, icon: null, category: eigeneKategorie(title), source: 'own' });
      }
    },
    'wm-own-saved': () => { ui.savedOpen = !ui.savedOpen; ctx.render(); },
    // A17d / Runde 2: „Spontanes Treffen" ersetzt die bestehende Wahl still — neben
    // „ohne feste Aktivität" gibt es keine Alternative abzuwägen (brauchtWahlFrage).
    // Runde 3 (Jonathan I2: „Wenn man draufklickt, soll es direkt übernommen werden und man
    // sieht in der Hauptansicht, dass Spontanes Treffen ausgewählt ist"): Wer es wählt, ist
    // fertig — die Seite schließt und das Meet zeigt „Spontanes Treffen". Nur das Abwählen
    // (Chip war schon an) bleibt auf der Seite, damit man gleich etwas anderes wählen kann.
    'wm-spontan': () => {
      if (opts.draftId) {
        const warSpontan = selectionEntries(ctx.repo.getDraft(opts.draftId)).some((e) => istSpontan(e));
        coreToggle(ctx, opts, spontanDesc());
        if (!warSpontan && String(ctx.nav.current()?.id || '').startsWith('newMeet.')) {
          if (ctx.nav.depth() > 1) ctx.nav.back();
          else ctx.nav.replace('newMeet.discover', { draftId: opts.draftId });
        }
      } else if (opts.onPick) opts.onPick(spontanDesc());
    },
    'wm-apply': () => {
      if (opts.draftId) { ctx.nav.back(); return; }
      if (opts.onPick && ui.picked) {
        opts.onPick({ title: ui.picked.title, icon: ui.picked.icon || null, category: ui.picked.category || eigeneKategorie(ui.picked.title), place: ui.picked.place || null, source: ui.picked.source || 'own' });
      }
    },
    // Detail-Sheet (08.3) + Anbieterauswahl (08.3b) als ui-Zustand
    'sug-close': () => { ui.sheetSuggestionId = null; ui.chooser = null; ctx.render(); },
    'sug-choose': (data) => {
      const s = ctx.repo.getSuggestion(data.suggestion);
      if (!s) return;
      ui.sheetSuggestionId = null;
      ui.chooser = null;
      if (opts.draftId) {
        // Runde 2: „Auswählen" ist eine Wahl — sie ersetzt. Sammeln heißt „Als Alternative".
        const desc = descFromSuggestion(s);
        const entries = selectionEntries(ctx.repo.getDraft(opts.draftId));
        if (!entries.some((e) => descKey(e) === descKey(desc))) {
          applySelection(ctx, opts.draftId, [desc]);
          lerneWahl(ctx, opts, desc);
        } else ctx.render();
      } else if (opts.onPick) {
        opts.onPick({ title: s.title, icon: s.icon || null, category: s.category, place: s.place ? { ...s.place } : null, source: 'suggestion', suggestionId: s.id });
      }
    },
    'sug-alt': (data) => {
      const s = ctx.repo.getSuggestion(data.suggestion);
      ui.sheetSuggestionId = null;
      ui.chooser = null;
      if (s && opts.draftId) {
        const desc = descFromSuggestion(s);
        const entries = selectionEntries(ctx.repo.getDraft(opts.draftId));
        if (!entries.some((e) => descKey(e) === descKey(desc))) {
          toggleEntry(ctx, opts.draftId, desc, { dazu: true });
          lerneWahl(ctx, opts, desc);
          return;
        }
      }
      ctx.render();
    },
    'sug-unchoose': (data) => {
      ui.sheetSuggestionId = null;
      ui.chooser = null;
      if (opts.draftId) {
        const entries = selectionEntries(ctx.repo.getDraft(opts.draftId));
        const rest = entries.filter((e) => descKey(e) !== `s:${data.suggestion}`);
        if (rest.length !== entries.length) { applySelection(ctx, opts.draftId, rest); return; }
      }
      ctx.render();
    },
    // Runde 2: „Nicht für mich" auch im Detail-Sheet — für alle, die nicht wischen.
    'sug-nein': (data) => {
      const karte = [...document.querySelectorAll('[data-role="vorschlag-zug"]')].find((n) => n.dataset.suggestion === data.suggestion);
      ui.sheetSuggestionId = null;
      ui.chooser = null;
      sageNein(ctx, opts, data.suggestion, karte?.offsetHeight || 0);
    },
    'wm-nein-zurueck': (data) => {
      const art = ui.zuletztNein?.art;
      ui.zuletztNein = null;
      lernen(ctx, ({ arten, nein }) => { delete nein[data.suggestion]; zaehleArt(arten, art, 'n', -1); });
    },
    'sug-route': () => { ui.chooser = 'route'; ctx.render(); },
    'sug-social': () => { ui.chooser = 'social'; ctx.render(); },
    'sug-chooser-close': () => { ui.chooser = null; ctx.render(); },
  });

  bindFilterSliders(root, ctx, opts);
  bindUmkreisKarte(root, ctx, opts);
  bindVorschlagZug(root, ctx, opts);
  bindVorschlagOrtkarte(root);
}

// Runde 4 (D8): die echte Karte im Vorschlags-Detail — erst nach dem Zeichnen, sie braucht einen
// Knoten. EINE Karte je Knoten; verschwindet das Sheet, räumt karteHalten sie selbst weg.
function bindVorschlagOrtkarte(root) {
  root.querySelectorAll('[data-role="vorschlag-ortkarte-flaeche"]').forEach((knoten) => {
    knoten.__crewKarte ||= karteHalten(knoten, knoten.dataset.schluessel, {
      mitte: { lat: Number(knoten.dataset.lat), lon: Number(knoten.dataset.lon) },
      zoom: 14.6,
      interaktiv: false,
      folgen: true,
    }).catch(() => null);
  });
}

// Runde 4 (D8): Tipp auf die kleine Karte → Route. Mehrere Anbieter: dieselbe Auswahl wie „Route".
function vorschlagRoute(c, ui, suggestionId) {
  const s = c.repo.getSuggestion(suggestionId);
  if (!s?.place) return;
  if ((s.links?.maps || []).length > 1) { ui.chooser = 'route'; c.render(); return; }
  rueckmeldung('tipp');
  oeffneRoute(s.place, s.links?.maps?.[0]);
}

function bindVorschlagZug(root, ctx, opts) {
  root.querySelectorAll('[data-role="vorschlag-zug"]').forEach((zug) => {
    if (zug.__crewZug) return;
    zug.__crewZug = true;
    const karte = zug.querySelector('[data-role="vorschlag-zug-karte"]');
    const grund = zug.querySelector('[data-role="vorschlag-zug-grund"]');
    if (!karte || !grund) return;
    let stand = null;
    const setzen = (weg) => {
      karte.style.transform = weg ? `translateX(${Math.round(weg)}px)` : '';
      grund.style.opacity = String(Math.min(1, -weg / 70));
    };
    zug.addEventListener('pointerdown', (ereignis) => {
      if (ereignis.button) return;
      stand = { x: ereignis.clientX, y: ereignis.clientY, id: ereignis.pointerId, aktiv: false, weg: 0 };
    });
    zug.addEventListener('pointermove', (ereignis) => {
      if (!stand || ereignis.pointerId !== stand.id) return;
      const dx = ereignis.clientX - stand.x;
      const dy = ereignis.clientY - stand.y;
      if (!stand.aktiv) {
        if (Math.abs(dy) > 12 && Math.abs(dy) > Math.abs(dx)) { stand = null; return; }
        if (dx > -12 || Math.abs(dx) < Math.abs(dy) * 1.3) return;
        stand.aktiv = true;
        reiheFesthalten(ctx, opts);
        zug.setPointerCapture?.(ereignis.pointerId);
        karte.style.transition = 'none';
      }
      ereignis.preventDefault();
      stand.weg = Math.min(0, dx);
      setzen(stand.weg);
    });
    const ende = () => {
      if (!stand) return;
      const { aktiv, weg } = stand;
      stand = null;
      if (!aktiv) return;
      // Nach einem Zug öffnet der folgende Klick nichts.
      const schlucken = (klick) => { klick.stopPropagation(); klick.preventDefault(); };
      zug.addEventListener('click', schlucken, { capture: true });
      setTimeout(() => zug.removeEventListener('click', schlucken, { capture: true }), 350);
      karte.style.transition = 'transform .2s ease-out';
      if (-weg > zug.offsetWidth * 0.38) {
        const hoehe = zug.offsetHeight;
        setzen(-zug.offsetWidth * 1.05);
        rueckmeldung('zurueck');
        setTimeout(() => sageNein(ctx, opts, zug.dataset.suggestion, hoehe), 190);
      } else {
        setzen(0);
      }
    };
    zug.addEventListener('pointerup', ende);
    zug.addEventListener('pointercancel', ende);
  });
}

// =====================================================================
// Vorschlag-Details (08.3) + Anbieterauswahl (08.3b)
// =====================================================================

// Kleine Anbieterauswahl — nur bei mehreren echten Zielen (08.3b).
function chooserHtml(kind, s) {
  const providerIcon = (provider) => (provider === 'tiktok' ? tiktokIcon('var(--ink)', 17) : instagramIcon('var(--ink)', 17));
  const providerName = (provider) => (provider === 'tiktok' ? 'TikTok' : 'Instagram');
  const rows = kind === 'route'
    // Runde 3 (G3, Jonathan: „Route- und Social-Links funktionieren nicht"): Gemessen — jede Zeile
    // war ein Knopf, der nur die Auswahl schloss. Jetzt trägt jede Zeile ihr echtes Ziel; ohne
    // echtes Ziel (kein Ort, Social ohne Adresse) steht die Zeile gar nicht erst da.
    ? [
      { icon: pinIcon('var(--ink)', 17), label: tx('Apple Karten'), href: routenZiel(s.place, 'apple') },
      { icon: pinIcon('var(--ink)', 17), label: 'Google Maps', href: routenZiel(s.place, 'google') },
    ].filter((row) => row.href)
    : (s.links?.social || [])
      .filter((link) => /^https?:\/\//.test(link.url || ''))
      .map((link) => ({ icon: providerIcon(link.provider), label: providerName(link.provider), href: link.url }));
  const title = kind === 'route' ? tx('Route öffnen') : tx('Social öffnen');
  const sub = kind === 'route'
    ? `${s.title}${s.distanceKm != null ? ` · ${fmtKm(s.distanceKm)} km` : ''}`
    : s.title;
  return `<div style="position:absolute;inset:0;z-index:16">
<div data-act="sug-chooser-close" style="position:absolute;inset:0;background:var(--scrim);-webkit-backdrop-filter:var(--scrim-filter);backdrop-filter:var(--scrim-filter)"></div>
<div style="position:absolute;left:0;right:0;bottom:0;background:var(--surface);border-radius:28px 28px 0 0;padding:14px 20px 30px;display:flex;flex-direction:column;gap:2px;box-shadow:0 -8px 24px var(--shadow-18)">
<span style="width:36px;height:4px;border-radius:2px;background:var(--handle);align-self:center;margin-bottom:10px"></span>
<span style="font-family:${TITLE_FONT};font-size:19px;font-weight:650;padding-bottom:4px">${esc(title)}</span>
<span style="font-size:12.5px;color:var(--muted);padding-bottom:8px;font-variant-numeric:tabular-nums">${esc(sub)}</span>
${rows.map((row) => `<a href="${esc(row.href)}" target="_blank" rel="noopener" style="display:flex;align-items:center;gap:12px;padding:13px 4px;border:0;border-top:1px solid var(--ink-a06);background:transparent;width:100%;box-sizing:border-box;cursor:pointer;text-decoration:none;font-family:${FONT};color:var(--ink)">
<span style="width:34px;height:34px;border-radius:11px;background:var(--paper);display:flex;align-items:center;justify-content:center;flex:none;pointer-events:none">${row.icon}</span>
<div style="display:flex;flex-direction:column;gap:1px;flex:1;min-width:0;text-align:left;pointer-events:none"><span style="font-size:14.5px;font-weight:650">${esc(row.label)}</span></div>
${rowChevronIcon('var(--muted-light)', 14)}
</a>`).join('')}
<button data-act="sug-chooser-close" style="border:1.5px solid var(--ink-a14);color:var(--ink-soft);font:650 14px/1 ${FONT};padding:14px 0;border-radius:999px;text-align:center;margin-top:14px;background:transparent;cursor:pointer;appearance:none">${tx('Abbrechen')}</button>
</div></div>`;
}

// Großes Detail-Sheet (08.3): Bild, Titel, Chips, Info, Mini-Karte, echte Links, Auswählen.
// Runde 2: Unten im Detail-Sheet steht, was mit DIESEM Vorschlag geht. Ist er gewählt:
// „Abwählen". Ist schon etwas anderes gewählt: „Als Alternative" oder „Auswählen" (ersetzt).
// Sonst schlicht „Auswählen". Beim Vorschlagen zu einem bestehenden Meet (entries null)
// gibt es nur die eine Wahl.
function sheetWahlHtml(s, entries) {
  const knopf = `font:650 14px/1 ${FONT};padding:14px 0;border-radius:999px;text-align:center;cursor:pointer;appearance:none`;
  const auswaehlen = `<button data-act="sug-choose" data-suggestion="${s.id}" style="${knopf};flex:1;width:100%;background:var(--green);color:var(--on-accent);border:0">${tx('Auswählen')}</button>`;
  const liste = entries || [];
  if (liste.some((e) => descKey(e) === `s:${s.id}`)) {
    return `<button data-act="sug-unchoose" data-suggestion="${s.id}" style="${knopf};width:100%;background:var(--surface);color:var(--ink-soft);border:1.5px solid var(--ink-a14)">${tx('Abwählen')}</button>`;
  }
  if (liste.some((e) => !istSpontan(e))) {
    return `<div style="display:flex;gap:8px"><button data-act="sug-alt" data-suggestion="${s.id}" style="${knopf};flex:1;background:var(--green-tint);color:var(--green-dark);border:1.5px solid var(--green-a45)">${tx('Als Alternative')}</button>${auswaehlen}</div>`;
  }
  return auswaehlen;
}

function suggestionSheetHtml(s, options = {}) {
  if (!s) return '';
  const chips = [];
  if (s.price != null) chips.push(tx('{preis} € p. P.', { preis: s.price }));
  // Runde 2: keine Uhrzeiten. Bei Events bleibt der Tag.
  if (s.kind === 'event' && s.when) chips.push(ohneUhrzeit(s.when));
  if (s.distanceKm != null) chips.push(`${fmtKm(s.distanceKm)} km`);
  // Chef (Runde 4): Regen ab 60 % für einen Ort draußen — ein ruhiger Hinweis, keine Warnung.
  if (s.wetterHinweis === 'regen' && s.draussen) chips.push(tx('Regen angesagt'));
  const chipHtml = chips.map((chip) => `<span style="background:var(--paper);font-size:12px;font-weight:650;padding:6px 11px;border-radius:999px;font-variant-numeric:tabular-nums">${esc(chip)}</span>`).join('');

  // Runde 4 (D8, Jonathan: „Die Karte von Events oder von Vorschlägen ist immer noch eine Dummy-
  // Karte … eines der größten Probleme"): eine ECHTE Karte — klein und ruhig (nicht bedienbar), der
  // Ort mit derselben grünen Namenspille wie im Meet, und ein Tipp darauf öffnet die Route. Die
  // Herkunftsangabe (ⓘ) der Karte bleibt antippbar. Ohne Koordinaten keine Karte: eine gezeichnete
  // Andeutung wäre erfunden.
  const miniMap = hatLage(s.place)
    ? `<div data-act="sug-karte" data-suggestion="${esc(s.id)}" data-role="vorschlag-ortkarte" role="button" aria-label="${esc(tx('Route öffnen'))}" style="border-radius:14px;overflow:hidden;clip-path:inset(0 round 14px);position:relative;height:132px;background:var(--field);flex:none;cursor:pointer">
<div data-fremd="1" data-role="vorschlag-ortkarte-flaeche" data-schluessel="sug-karte-${esc(s.id)}" data-lat="${s.place.lat}" data-lon="${s.place.lon}" style="position:absolute;inset:0"></div>
<div style="position:absolute;left:50%;top:50%;transform:translate(-50%,-100%);display:flex;flex-direction:column;align-items:center;pointer-events:none;z-index:2"><span style="background:var(--green);color:var(--on-accent);border-radius:999px;padding:6px 11px;font-size:11px;font-weight:650;box-shadow:0 3px 9px var(--green-a40);white-space:nowrap;max-width:220px;overflow:hidden;text-overflow:ellipsis">${esc(s.place.name || s.shortTitle || s.title)}</span><span style="width:2.5px;height:7px;background:var(--green)"></span></div>
<span data-role="vorschlag-ortkarte-route" style="position:absolute;left:8px;bottom:8px;z-index:2;display:flex;align-items:center;gap:5px;height:26px;padding:0 10px 0 8px;border-radius:13px;background:var(--glass);-webkit-backdrop-filter:blur(10px);backdrop-filter:blur(10px);box-shadow:0 1px 4px var(--shadow-10);font:650 11px/1 ${FONT};color:var(--ink);pointer-events:none">${routeIcon('var(--ink)')}${tx('Route')}</span>
</div>`
    : '';

  const btnStyle = `flex:1;border:1.5px solid var(--ink-a12);border-radius:999px;padding:10px 0;display:flex;align-items:center;justify-content:center;gap:6px;font-size:12px;font-weight:650;color:var(--ink);font-family:${FONT}`;
  const buttons = [];
  if (s.place && s.links?.maps?.length) {
    buttons.push(s.links.maps.length > 1
      ? `<button data-act="sug-route" style="${btnStyle};background:transparent;cursor:pointer;appearance:none">${routeIcon()}<span style="pointer-events:none">${tx('Route')}</span></button>`
      : `<a href="${esc(routenZiel(s.place, s.links.maps[0]) || '')}" target="_blank" rel="noopener" style="${btnStyle};text-decoration:none">${routeIcon()}${tx('Route')}</a>`);
  }
  // Runde 2: Echte Adressen (aus OpenStreetMap) öffnen wirklich; die Seed-Beispiele tragen „#".
  if (s.links?.website) {
    const echt = /^https?:\/\//.test(s.links.website);
    buttons.push(`<a href="${echt ? esc(s.links.website) : '#'}"${echt ? ' target="_blank" rel="noopener"' : ''} style="${btnStyle};text-decoration:none">${globeIcon()}${s.kind === 'event' ? tx('Tickets & Infos') : tx('Website')}</a>`);
  }
  // Runde 3 (G3): Nur Social-Einträge mit echter Adresse. Einer → direkt als Link (vorher „#",
  // gemessen an der Seebühne); mehrere → Auswahl mit echten Links (chooserHtml).
  const echteSocial = (s.links?.social || []).filter((link) => /^https?:\/\//.test(link.url || ''));
  if (echteSocial.length) {
    const icon = echteSocial.length === 1 && echteSocial[0].provider === 'tiktok' ? tiktokIcon() : instagramIcon();
    buttons.push(echteSocial.length > 1
      ? `<button data-act="sug-social" style="${btnStyle};background:transparent;cursor:pointer;appearance:none">${icon}<span style="pointer-events:none">${tx('Social')}</span></button>`
      : `<a href="${esc(echteSocial[0].url)}" target="_blank" rel="noopener" style="${btnStyle};text-decoration:none">${icon}${tx('Social')}</a>`);
  }

  // Runde 2 (Jonathan: „die Bilder müssen real sein — beim Strandbad Bregenz Bilder vom
  // Strandbad Bregenz"): ein echtes Foto von Wikimedia Commons, wenn es eines gibt; sonst die
  // ruhige Farbfläche. Urheber und Lizenz stehen einen Tipp entfernt auf der Seite der Datei.
  const foto = s.bild
    ? `<img data-role="vorschlag-foto" src="${esc(s.bild)}" alt="${esc(s.title)}" loading="lazy" referrerpolicy="no-referrer" style="position:absolute;inset:0;width:100%;height:100%;object-fit:cover" onerror="this.remove()">`
    : '';
  // Runde 4 (G4): Urheber, Lizenz und Quelle hinter ⓘ unten rechts im Bild (oben rechts sitzt ✕).
  const fotoQuelle = fotoInfoHtml(s, `sheet:${s.id}`, Boolean(options.fotoInfo), 'unten');
  const body = `<div style="height:${s.bild ? 160 : 112}px;border-radius:16px;background:${s.gradient || 'var(--field)'};position:relative;overflow:hidden;flex:none">${foto}${fotoQuelle}
${/* Runde 3 (Jonathan G2: „Das X und der Ort sind in einem weißen Ton — nicht auf das neue
     Design aktualisiert"): Art-Zeichen und Schließen-Knopf liegen jetzt auf dem Glas-Token der
     App (hell: weißes Glas, dunkel: dunkles Glas) mit Weichzeichner — lesbar auf Foto UND
     Farbfläche, in beiden Themen. Der Knopf trifft auf 44 px. */ ''}<span data-role="vorschlag-art" style="position:absolute;left:10px;top:10px;font-size:9.5px;font-weight:650;letter-spacing:.06em;color:var(--ink);background:var(--glass);-webkit-backdrop-filter:blur(10px);backdrop-filter:blur(10px);padding:5px 8px;border-radius:7px;box-shadow:0 1px 4px var(--shadow-10);pointer-events:none">${s.kind === 'event' ? tx('EVENT') : s.kind === 'idee' ? tx('IDEE') : tx('ORT')}</span>
<button data-act="sug-close" aria-label="${esc(tx('Schließen'))}" style="position:absolute;right:3px;top:3px;width:44px;height:44px;border:0;background:transparent;padding:0;display:flex;align-items:center;justify-content:center;cursor:pointer;appearance:none"><span style="width:30px;height:30px;border-radius:50%;background:var(--glass);-webkit-backdrop-filter:blur(10px);backdrop-filter:blur(10px);box-shadow:0 1px 4px var(--shadow-10);display:flex;align-items:center;justify-content:center;pointer-events:none">${xLargeIcon('var(--ink)', 15)}</span></button>
</div>
<div style="display:flex;flex-direction:column;gap:8px;flex:none">
<span style="font-family:${TITLE_FONT};font-size:20px;font-weight:650">${esc(s.title)}</span>
${chipHtml ? `<div style="display:flex;gap:7px;flex-wrap:wrap">${chipHtml}</div>` : ''}
<span style="font-size:12.5px;color:var(--ink-soft);line-height:1.45">${esc(s.description || s.blurb || '')}</span>
</div>
${miniMap}
${buttons.length ? `<div style="display:flex;gap:8px;flex:none">${buttons.join('')}</div>` : ''}
${/* Runde 3 (Jonathan H2: „Der Button ‚Nicht für mich' ist irgendwie unpassend"): Er stand als
     einzelnes graues Wort mitten zwischen Links und Auswahl — weder Knopf noch Text. Jetzt ist
     er eine ruhige Zeile am Ende der Angaben, in der Grammatik der übrigen Zeilen (Symbol ·
     Titel · Erklärung), und sagt, was passiert: der Vorschlag verschwindet, und die App lernt
     daraus. Das Lernen selbst (sageNein) ist unverändert. */ ''}<button data-act="sug-nein" data-suggestion="${s.id}" data-role="vorschlag-nein-zeile" style="display:flex;align-items:center;gap:12px;width:100%;border:0;border-top:1px solid var(--ink-a07);background:transparent;padding:14px 2px 2px;cursor:pointer;appearance:none;font-family:${FONT};text-align:left;flex:none">
<span style="width:34px;height:34px;border-radius:11px;background:var(--paper);display:flex;align-items:center;justify-content:center;flex:none;pointer-events:none">${activityIconSvg({ icon: 'augeZu' }, 'var(--ink-soft)', 17)}</span>
<span style="display:flex;flex-direction:column;gap:2px;flex:1;min-width:0;pointer-events:none"><span style="font-size:13.5px;font-weight:650;color:var(--ink)">${tx('Nicht für mich')}</span><span style="font-size:11.5px;color:var(--muted);line-height:1.35">${tx('Blendet den Vorschlag aus — Ähnliches kommt seltener')}</span></span>
</button>`;

  return nmPanel({
    closeAct: 'sug-close',
    scrollKey: 'sug-sheet',
    mark: 'data-disc-sheet',
    body,
    bottom: panelBottom(sheetWahlHtml(s, options.entries)),
    after: options.chooser ? chooserHtml(options.chooser, s) : '',
  });
}

// =====================================================================
// Screens
// =====================================================================

// 08.1 Composer — Einstieg (newMeet.discover bleibt der Alias für andere Bereiche).
function renderComposer(ctx) {
  const { draft, replaced } = ensureDraft(ctx);
  // Ausgangszustand für Ü4 merken (nur beim ersten Öffnen dieser Routen-Ebene).
  dirtyGuard(ctx, 'nm-composer').track(draftSnapshot(draft));
  const overlays = `${ctx.ui.withSheet ? withSheetHtml(ctx, draft) : ''}${loopSheetHtml(ctx, draft)}${discardSheet(ctx)}`;
  return {
    html: composerScaffold(ctx, draft, overlays),
    bind(root, c) {
      bindComposerCommon(root, c, draft);
      bindLoopActions(root, c, draft);
      bindActions(root, discardActions(c));
      scheduleReplace(c, draft, replaced);
      fitInsets(root);
    },
  };
}

// „Was machen?"-Seite (08.2/08.2b/08.4): sticky Kopf · EINE Scrollfläche · untere Leiste
// als Bottom-Ebene darüber. Die Liste läuft sichtbar darunter durch und bleibt vollständig
// nach oben scrollbar (v3.1 §1/§3).
// v5 A14: EIN Kopf für alle Aufrufer des Choosers — nur der Titel unterscheidet sich.
// Die Höhe bleibt dadurch identisch, und damit auch die Lage von Tabs, Filterzeile und
// erster Karte. Genau das verlangt „gleicher Chooser wie Neues Meet → Was machen".
// Runde 2 (Jonathan): Oben rechts sitzt „Spontanes Treffen" — nur im echten Entwurf, nicht
// beim Vorschlagen zu einem bestehenden Meet. Den Alternativen-Schalter gibt es nicht mehr;
// die Anzahl gewählter Elemente steht in der unteren Variantenübersicht.
function chooserHeaderHtml(title, spontan) {
  return `<div style="display:flex;align-items:center;gap:12px;padding:8px 20px 10px">
<button data-act="back" aria-label="${esc(tx('Schließen'))}" style="border:0;background:transparent;padding:0;cursor:pointer;appearance:none;display:flex">${xLargeIcon('var(--ink)', 22)}</button>
<span style="font-family:${TITLE_FONT};font-size:20px;font-weight:650;flex:1;min-width:0;overflow:hidden;text-overflow:ellipsis;white-space:nowrap">${esc(title)}</span>
${spontan ? spontanChipHtml(spontan.aktiv) : ''}
</div>`;
}

// v5 A14: Der vollständige Chooser-Bildschirm. „Was machen?" und der Vorschlag aus dem
// Raum benutzen dieselbe Funktion — es gibt keinen zweiten Aufbau mehr, der auseinander
// laufen könnte. options: { title, entries, extraOverlays, scrollKey }
export function chooserScaffold(ctx, opts, options = {}) {
  const entries = options.entries || coreEntries(ctx, opts);
  return screenScaffold({
    header: chooserHeaderHtml(options.title || tx('Was machen?'), opts.draftId ? { aktiv: entries.some((e) => istSpontan(e)) } : null),
    body: renderDiscoverCore(ctx, opts),
    bottom: `${bottomFade(20)}${bottomBar(coreBottomHtml(ctx, opts, entries))}`,
    overlays: `${discoverOverlays(ctx, opts)}${options.extraOverlays || ''}`,
    scrollKey: options.scrollKey || 'nm-what',
  });
}

// Die Einpassung der unteren Ebene gehört zum Chooser und wird deshalb mit exportiert.
export { fitInsets as fitChooserInsets };

function whatScaffold(ctx, draft, opts, extraOverlay = '') {
  const entries = selectionEntries(draft);
  return chooserScaffold(ctx, opts, {
    title: tx('Was machen?'),
    entries,
    extraOverlays: `${opts.showLoop ? loopSheetHtml(ctx, draft) : ''}${extraOverlay}${discardSheet(ctx)}`,
  });
}

function renderWhat(ctx) {
  const { draft, replaced } = ensureDraft(ctx);
  const opts = { draftId: draft.id, uiKey: 'what', hideSubmit: true, hideSheets: true, showLoop: true };
  if (ctx.route.id === 'newMeet.ownIdea') {
    const ui = coreUi(ctx, opts);
    if (!ui.tabInit) { ui.tabInit = true; ui.tab = 'own'; }
  }
  return {
    html: whatScaffold(ctx, ctx.repo.getDraft(draft.id), opts),
    bind(root, c) {
      // Erst den echten Bottom-Inset messen, dann die Fläche einpassen (Karte füllt den Rest).
      fitInsets(root);
      bindDiscoverCore(root, c, opts);
      bindLoopActions(root, c, draft);
      bindActions(root, discardActions(c));
      scheduleReplace(c, draft, replaced);
    },
  };
}

// 08.3 als eigene Route (Tiefe Links/Prüf-Harness): Sheet über der „Was machen?"-Seite.
function renderSuggestionRoute(ctx) {
  const { draft, replaced } = ensureDraft(ctx);
  const opts = { draftId: draft.id, uiKey: 'what', hideSubmit: true, hideSheets: true, showLoop: true };
  const suggestion = ctx.repo.getSuggestion(ctx.params.suggestionId, teilnehmendeVon(ctx, opts));
  const html = whatScaffold(ctx, ctx.repo.getDraft(draft.id), opts,
    suggestion ? suggestionSheetHtml(suggestion, { chooser: ctx.ui.chooser, entries: selectionEntries(ctx.repo.getDraft(draft.id)), fotoInfo: ctx.ui.fotoInfo === `sheet:${suggestion.id}` }) : '');
  return {
    html,
    bind(root, c) {
      if (!suggestion) {
        window.setTimeout(() => c.nav.replace('newMeet.what', { draftId: draft.id }), 0);
        return;
      }
      bindActions(root, {
        'sug-close': () => c.nav.back(),
        'sug-choose': (data) => {
          const s = c.repo.getSuggestion(data.suggestion);
          if (s) {
            const desc = descFromSuggestion(s);
            const entries = selectionEntries(c.repo.getDraft(draft.id));
            if (!entries.some((e) => descKey(e) === descKey(desc))) applySelection(c, draft.id, [desc]);
          }
          c.nav.back();
        },
        'sug-alt': (data) => {
          const s = c.repo.getSuggestion(data.suggestion);
          if (s) {
            const desc = descFromSuggestion(s);
            const entries = selectionEntries(c.repo.getDraft(draft.id));
            if (!entries.some((e) => descKey(e) === descKey(desc))) toggleEntry(c, draft.id, desc, { dazu: true });
          }
          c.nav.back();
        },
        'sug-unchoose': (data) => {
          const entries = selectionEntries(c.repo.getDraft(draft.id));
          applySelection(c, draft.id, entries.filter((e) => descKey(e) !== `s:${data.suggestion}`));
          c.nav.back();
        },
        'sug-route': () => { c.ui.chooser = 'route'; c.render(); },
        'sug-social': () => { c.ui.chooser = 'social'; c.render(); },
        'sug-chooser-close': () => { c.ui.chooser = null; c.render(); },
        'foto-info': (data) => { c.ui.fotoInfo = c.ui.fotoInfo === data.foto ? null : data.foto; c.render(); },
        'sug-karte': (data) => vorschlagRoute(c, c.ui, data.suggestion),
      });
      bindVorschlagOrtkarte(root);
      bindLoopActions(root, c, draft);
      bindActions(root, discardActions(c));
      scheduleReplace(c, draft, replaced);
      fitInsets(root);
    },
  };
}

// =====================================================================
// 08.6 Wann-Picker: Monatskalender · Fixe Uhrzeit/Zeit offen · Walze · Termine + Vorschlag
// =====================================================================

// Kalender (08.6): voller Monat. Tage aus Nachbarmonaten sind echte Ziele — ihre Wahl
// lässt die Monatsansicht mitspringen (v3.1 §7).
// Runde 3 (I8): Zeilenhöhe eines Kalendertags — so hoch, dass man den Tag nicht exakt treffen muss.
const TAG_H = 32;

function calendarHtml(ui) {
  const first = new Date(ui.year, ui.month, 1);
  const startCol = (first.getDay() + 6) % 7;
  const daysIn = new Date(ui.year, ui.month + 1, 0).getDate();
  const todayIso = toISODate(now());

  const cell = (date, dim) => {
    const iso = toISODate(date);
    const day = date.getDate();
    const past = iso < todayIso;
    if (iso === ui.date) {
      // v6 A08 (keine vollschwarzen Controls): Der gewählte Tag war eine schwarze
      // Vollfläche. „Heute" bleibt die grüne Kachel, jeder andere gewählte Tag bekommt
      // eine ruhige weiße Fläche mit grüner Kontur — Auswahl braucht Eindeutigkeit,
      // nicht maximalen Kontrast.
      const heute = iso === todayIso;
      const kreis = heute
        ? 'background:var(--green);color:var(--on-accent);border:0'
        : 'background:var(--green-a10);box-shadow:inset 0 0 0 1.5px var(--green);color:var(--ink);border:0';
      // Runde 3 (I8): Der ganze Tag ist Trefferfläche, nicht nur der Kreis.
      return `<button data-act="when-day" data-date="${iso}" aria-pressed="true" style="width:100%;height:${TAG_H}px;border:0;background:transparent;padding:0;display:flex;align-items:center;justify-content:center;cursor:pointer;appearance:none;font-family:${FONT}"><span style="width:26px;height:26px;border-radius:50%;${kreis};box-sizing:border-box;display:flex;align-items:center;justify-content:center;font-weight:650;font-size:12px;pointer-events:none">${day}</span></button>`;
    }
    if (past) return `<span style="height:${TAG_H}px;display:flex;align-items:center;justify-content:center;color:var(--line-solid)">${day}</span>`;
    const color = dim ? 'var(--line-solid)' : iso === todayIso ? 'var(--muted)' : 'var(--ink)';
    return `<button data-act="when-day" data-date="${iso}" aria-pressed="false" style="width:100%;height:${TAG_H}px;padding:0;border:0;background:transparent;cursor:pointer;appearance:none;font-family:${FONT};font-size:12px;font-weight:600;color:${color};font-variant-numeric:tabular-nums"><span style="pointer-events:none">${day}</span></button>`;
  };

  const cells = [];
  for (let i = startCol; i > 0; i -= 1) cells.push(cell(new Date(ui.year, ui.month, 1 - i), true));
  for (let day = 1; day <= daysIn; day += 1) cells.push(cell(new Date(ui.year, ui.month, day), false));
  let nextDay = 1;
  // Runde 4 (C4): IMMER sechs Wochenzeilen. Mit fünf oder sechs Zeilen je nach Monat wuchs das
  // Sheet beim Monatswechsel — und alles darin rückte unter dem Finger weg (gemessen: 132 px).
  while (cells.length < 42) { cells.push(cell(new Date(ui.year, ui.month + 1, nextDay), true)); nextDay += 1; }
  return `<div style="display:flex;flex-direction:column;gap:4px">
<div style="display:grid;grid-template-columns:repeat(7,1fr);gap:2px;font-size:10px;font-weight:650;color:var(--muted-light);text-align:center">${wochenInitialen().map((b) => `<span>${b}</span>`).join('')}</div>
<div style="display:grid;grid-template-columns:repeat(7,1fr);gap:1px;font-size:12px;font-weight:600;text-align:center;font-variant-numeric:tabular-nums;align-items:center">${cells.join('')}</div>
</div>`;
}

// --- Zeitrad (08.6, v3.1 §7): echtes ziehbares Stunden-/Minutenrad mit Snap -----------
// Die Walze folgt dem Finger kontinuierlich und rastet beim Loslassen ein. Sie ist ein
// eigenes Control (data-hdrag) — der Tab-Swipe bekommt die Geste nie.

const WHEEL_ITEM_H = RAD_ZEILE;
const WHEEL_VISIBLE = RAD_SICHTBAR;
const WHEEL_H = WHEEL_ITEM_H * WHEEL_VISIBLE;
const WHEEL_HOURS = Array.from({ length: 24 }, (_, i) => i);
// v5 A26: FUENF-Minuten-Raster. Vorher gab es nur [0,15,30,45]; 14:20 war nicht
// einstellbar und ein gespeichertes 14:20 wurde beim Oeffnen still zu 14:15 verfaelscht.
const WHEEL_MINUTES = Array.from({ length: 12 }, (_, i) => i * 5);
const MINUTE_STEP = 5;

// §4.3: Das Rad steht jetzt EINMAL in ui/components.js (radSpalte/bindRad) und wird von
// hier und vom Profil benutzt. Vorher gab es zwei Fassungen — diese hier folgte dem Finger,
// die im Profil sprang in Stufen von 24 Pixeln. Dieselbe Bedienung, zwei Gefühle.
function wheelColumn(role, values, selected, options = {}) {
  return radSpalte(role, values, selected, {
    runden: options.cycles,
    width: options.width,
    sichtbar: options.visible,
    text: options.pad === false ? String : undefined,
    act: 'wheel-pick',
  });
}

function termOf(ui) {
  const open = ui.timeMode === 'open';
  return { date: ui.date, time: open ? null : `${pad2(ui.hour)}:${pad2(ui.minute)}`, open };
}

// Runde 4 (F2): Ein Termin „Jetzt" heißt in der Liste „Jetzt" — keine Uhrzeit, die gleich
// Vergangenheit ist.
function termLabel(t) {
  return terminAnzeige(t);
}

function sameTerm(a, b) {
  return gleicherTermin(a, b);
}

// Rad, Kalender und Datum auf „jetzt" stellen (aufgerundet auf das Fünf-Minuten-Raster).
function zeigeJetzt(ui) {
  const d = now();
  let h = d.getHours();
  let m = Math.ceil(d.getMinutes() / MINUTE_STEP) * MINUTE_STEP;
  if (m === 60) { m = 0; h = (h + 1) % 24; }
  ui.date = toISODate(d);
  ui.timeMode = 'fix';
  ui.hour = h;
  ui.minute = m;
  ui.year = d.getFullYear();
  ui.month = d.getMonth();
}

function initWhenUi(ctx, draft) {
  const ui = ctx.ui;
  if (ui.init) return ui;
  ui.init = true;
  const fest = draft.when && !draft.when.now ? draft.when : null;
  ui.nowActive = entwurfIstJetzt(draft);
  ui.terms = draft.when ? [ { ...draft.when }, ...(draft.whenProposals || []).map((p) => ({ ...p })) ] : [];
  zeigeJetzt(ui);
  if (fest) {
    ui.date = fest.date;
    ui.timeMode = fest.open || !fest.time ? 'open' : 'fix';
    if (fest.time) {
      const [h, m] = fest.time.split(':').map(Number);
      ui.hour = h;
      ui.minute = m - (m % MINUTE_STEP);
    }
    const md = fromISODate(ui.date);
    ui.year = md.getFullYear();
    ui.month = md.getMonth();
  }
  return ui;
}

// v7 A24b (spec/05 §1): Vergleichswert für den Verwerfen-Guard. Der gesamte Zustand des
// Wann-Sheets lebt in ctx.ui und wird beim Routenwechsel verworfen — genau deshalb muss
// vor dem Schließen gefragt werden, wenn er sich seit dem Öffnen verändert hat. Bei
// unverändertem Zustand ist der Schnappschuss gleich und das Sheet schließt direkt.
function whenSnapshot(ui) {
  return {
    date: ui.date,
    timeMode: ui.timeMode,
    hour: ui.hour,
    minute: ui.minute,
    nowActive: Boolean(ui.nowActive),
    terms: (ui.terms || []).map((t) => ({ date: t.date, time: t.time || null, open: Boolean(t.open), now: Boolean(t.now) })),
  };
}

function renderWhen(ctx) {
  const { draft, replaced } = ensureDraft(ctx);
  const ui = initWhenUi(ctx, draft);
  const guard = dirtyGuard(ctx, 'nm-when');
  guard.track(whenSnapshot(ui));

  const modeSeg = (id, label) => (ui.timeMode === id
    ? `<button data-act="when-mode" data-mode="${id}" style="flex:1;background:var(--surface);border-radius:11px;padding:8px 0;text-align:center;font-size:12.5px;font-weight:650;box-shadow:0 1px 3px var(--shadow-08);border:0;cursor:pointer;appearance:none;font-family:${FONT};color:var(--ink)"><span style="pointer-events:none">${label}</span></button>`
    : `<button data-act="when-mode" data-mode="${id}" style="flex:1;border-radius:11px;padding:8px 0;text-align:center;font-size:12.5px;font-weight:600;color:var(--muted);border:0;background:transparent;cursor:pointer;appearance:none;font-family:${FONT}"><span style="pointer-events:none">${label}</span></button>`);
  // Auswahlfläche über der Walze: grünlich, wenn die eingestellte Zeit schon zählt —
  // also bei „Jetzt" oder wenn sie bereits als Termin in der Liste steht (08.6).
  // Runde 3 (Jonathan I7): Steht die Zeit auf „Jetzt", ist sie LIVE. Die Fläche trägt dann das
  // Originalgrün der App (Kontur var(--green), Füllung aus demselben Grün) statt des dunklen
  // Grüntons, und eine zweite grüne Schicht atmet darüber (.jetzt-atmen aus styles.css — ruht
  // bei „Bewegung reduzieren"). Ein Termin, der schon in der Liste steht, bleibt ruhig getönt.
  const imTermin = !ui.nowActive && (ui.terms || []).some((t) => sameTerm(t, termOf(ui)));
  // Runde 4 (F1): Der Puls ist der weiche grüne Rand eines freien Profilbilds, rund wie die Fläche.
  const band = ui.nowActive
    ? 'background:var(--green-a10);border:1.5px solid var(--green);box-sizing:border-box'
    : imTermin
      ? 'background:var(--green-tint);border:1px solid var(--green-a28);box-sizing:border-box'
      : 'background:var(--paper)';
  const bandPuls = ui.nowActive ? jetztPuls(10.5) : '';
  // „Zeit offen" versteckt das GESAMTE Rad — auch die Auswahlfläche dahinter (v3.1 §7).
  const timeArea = ui.timeMode === 'fix'
    ? `<div style="display:flex;gap:12px;align-items:center;justify-content:center;position:relative;padding:4px 0">
<div data-role="zeit-band" data-live="${ui.nowActive ? 'ja' : 'nein'}" style="position:absolute;left:110px;right:110px;top:50%;transform:translateY(-50%);height:38px;border-radius:12px;${band}">${bandPuls}</div>
${wheelColumn('hour', WHEEL_HOURS, ui.hour)}
<span style="font-size:17px;font-weight:650;position:relative">:</span>
${wheelColumn('minute', WHEEL_MINUTES, ui.minute)}
</div>`
    // v5 A25: siehe oben — kein doppeltes „Zeit offen" unter dem Umschalter.
    : '';

  const termRows = (ui.terms || []).map((t, i) => `<div style="display:flex;align-items:center;gap:10px;padding:9px 0;border-top:1px solid var(--ink-a06)">
${handleIcon('var(--line-solid)', 14)}
<button data-act="when-pickterm" data-i="${i}" style="font-size:13.5px;font-weight:${i === 0 ? 650 : 600};flex:1;min-width:0;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;font-variant-numeric:tabular-nums;text-align:left;border:0;background:transparent;padding:0;cursor:pointer;appearance:none;font-family:${FONT};color:var(--ink)"><span style="pointer-events:none">${esc(termLabel(t))}</span></button>
${i === 0 ? termChipHtml : ''}
<button data-act="when-removeterm" data-i="${i}" aria-label="${esc(tx('Entfernen'))}" style="border:0;background:transparent;padding:15px;margin:-15px -15px -15px -9px;cursor:pointer;appearance:none;flex:none;display:flex">${xSmallIcon('var(--muted)', 13)}</button>
</div>`).join('');
  const termsBlock = `<div style="display:flex;flex-direction:column;gap:2px;border-top:1px solid var(--ink-a07);padding-top:10px">
<div style="display:flex;justify-content:space-between;align-items:center;padding-bottom:2px">
<span style="${labelStyle}">${tx('Termine · {n}', { n: (ui.terms || []).length })}</span>
<button data-act="when-add" style="display:flex;align-items:center;gap:6px;border:1.5px dashed var(--green-a45);border-radius:999px;padding:6px 11px;font-size:11.5px;font-weight:650;color:var(--green-dark);background:transparent;cursor:pointer;appearance:none;font-family:${FONT}"><span style="font-size:14px;line-height:1;pointer-events:none">+</span><span style="pointer-events:none">${tx('Vorschlag')}</span></button>
</div>
${termRows}
</div>`;

  const jetztLook = ui.nowActive
    ? 'border:1.5px solid var(--green);color:var(--green-dark)'
    : 'border:1.5px solid var(--ink-a14);color:var(--ink-soft)';
  const sheet = nmPanel({
    title: tx('Wann'),
    scrollKey: 'nm-when',
    gap: 14,
    // Runde 4 (C4): feste Höhe. Ein inhaltshohes Sheet wuchs und schrumpfte mit „Zeit offen",
    // Monat und Terminliste — seine Oberkante und alles darin sprang unter dem Finger.
    height: 'min(calc(100% - 64px), 800px)',
    body: `<div style="display:flex;justify-content:space-between;align-items:center;padding:0 4px">
<button data-act="when-month" data-dir="-1" aria-label="${esc(tx('Vorheriger Monat'))}" style="width:28px;height:28px;border-radius:50%;background:var(--paper);display:flex;align-items:center;justify-content:center;color:var(--ink-soft);font-size:13px;border:0;cursor:pointer;appearance:none;font-family:${FONT}"><span style="pointer-events:none">‹</span></button>
<span data-role="when-month-label" style="font-size:14.5px;font-weight:650">${monthLongByIndex(ui.month)} ${ui.year}</span>
<button data-act="when-month" data-dir="1" aria-label="${esc(tx('Nächster Monat'))}" style="width:28px;height:28px;border-radius:50%;background:var(--paper);display:flex;align-items:center;justify-content:center;color:var(--ink-soft);font-size:13px;border:0;cursor:pointer;appearance:none;font-family:${FONT}"><span style="pointer-events:none">›</span></button>
</div>
${calendarHtml(ui)}
<div style="display:flex;justify-content:center;padding-top:2px;border-top:1px solid var(--ink-a07)"><div style="background:var(--field);border-radius:14px;padding:3px;display:flex;gap:3px;width:100%">${modeSeg('fix', tx('Fixe Uhrzeit'))}${modeSeg('open', tx('Zeit offen'))}</div></div>
${timeArea}
${termsBlock}`,
    bottom: panelBottom(`<div style="display:flex;gap:8px">
<button data-act="when-now" data-role="jetzt-knopf" aria-pressed="${ui.nowActive}" style="flex:1;position:relative;${jetztLook};font:650 14px/1 ${FONT};padding:13px 0;border-radius:999px;display:flex;align-items:center;justify-content:center;gap:6px;background:${ui.nowActive ? 'var(--surface)' : 'transparent'};cursor:pointer;appearance:none">${ui.nowActive ? jetztPuls(20.5) : ''}<span style="position:relative;display:flex;pointer-events:none">${ui.nowActive ? activityIconSvg({ icon: 'haken' }, 'var(--green-dark)', 14) : redoIcon('var(--ink-soft)', 12)}</span><span style="position:relative;pointer-events:none">${tx('Jetzt')}</span></button>
<button data-act="when-apply" style="flex:1;background:var(--green);color:var(--on-accent);font:650 14px/1 ${FONT};padding:14px 0;border-radius:999px;text-align:center;border:0;cursor:pointer;appearance:none">${tx('Übernehmen')}</button>
</div>`),
  });

  const syncMonthTo = (iso) => {
    const md = fromISODate(iso);
    ui.year = md.getFullYear();
    ui.month = md.getMonth();
  };

  // Übernehmen: die Terminliste, wie sie steht. Ist „Jetzt" vorgewählt, wird „Jetzt" der
  // Hauptvorschlag: Steht es schon in der Liste, rückt es nach vorn; sonst tritt es an die Stelle
  // des bisherigen Haupttermins (wer von „morgen 19 Uhr" auf „Jetzt" wechselt, meint „statt").
  // Weitere, selbst hinzugefügte Vorschläge bleiben. Ohne Liste: „Jetzt" (when null) oder der
  // eingestellte Termin.
  const uebernehmen = () => {
    let terms = (ui.terms || []).map((t) => ({ ...t }));
    if (ui.nowActive && terms.length) {
      const i = terms.findIndex((t) => t.now);
      if (i < 0) terms = [jetztTermin(), ...terms.slice(1)];
      else if (i > 0) terms.unshift(...terms.splice(i, 1));
      if (terms.length === 1) terms = [];
    }
    // Übernommen heißt gespeichert — danach gibt es nichts mehr zu verwerfen.
    guard.clear();
    if (terms.length) {
      ctx.repo.updateDraft(draft.id, { when: terms[0], whenProposals: terms.slice(1) });
    } else if (ui.nowActive) {
      ctx.repo.updateDraft(draft.id, { when: null, whenProposals: [] });
    } else {
      ctx.repo.updateDraft(draft.id, { when: termOf(ui), whenProposals: [] });
    }
    ctx.nav.back();
  };

  return {
    html: composerScaffold(ctx, draft, `${sheet}${discardSheet(ctx)}`),
    bind(root, c) {
      bindActions(root, discardActions(c));
      bindActions(root, {
        // v7 A24b: Schließen fragt NUR bei wirklich geänderten, noch nicht übernommenen
        // Werten nach. guard.confirm() gibt bei unverändertem Zustand true zurück —
        // dann geht das Sheet ohne jede Rückfrage zu.
        'sheet-close': () => {
          if (!guard.confirm(whenSnapshot(ui), () => c.nav.back())) return;
          c.nav.back();
        },
        'when-month': (data) => {
          let month = ui.month + Number(data.dir);
          let year = ui.year;
          if (month < 0) { month = 11; year -= 1; }
          if (month > 11) { month = 0; year += 1; }
          ui.month = month;
          ui.year = year;
          c.render();
        },
        // Ein Tag aus einem Nachbarmonat lässt die Monatsansicht mitspringen (§7).
        'when-day': (data) => { ui.date = data.date; syncMonthTo(data.date); ui.nowActive = false; c.render(); },
        'when-mode': (data) => { ui.timeMode = data.mode; ui.nowActive = false; c.render(); },
        'wheel-pick': (data) => {
          if (data.role === 'hour') ui.hour = Number(data.value);
          else ui.minute = Number(data.value);
          ui.nowActive = false;
          c.render();
        },
        // Runde 4 (F2): Steht die Zeit auf „Jetzt", wird „Jetzt" der Vorschlag — nicht die
        // Uhrzeit dieses Augenblicks.
        'when-add': () => {
          const candidate = ui.nowActive ? jetztTermin() : termOf(ui);
          if (!(ui.terms || []).some((t) => sameTerm(t, candidate))) ui.terms.push(candidate);
          rueckmeldung('tipp');
          c.render();
        },
        'when-pickterm': (data) => {
          const t = ui.terms[Number(data.i)];
          if (!t) return;
          if (t.now) { ui.nowActive = true; zeigeJetzt(ui); c.render(); return; }
          ui.nowActive = false;
          ui.date = t.date;
          ui.timeMode = t.open || !t.time ? 'open' : 'fix';
          if (t.time) {
            const [h, m] = t.time.split(':').map(Number);
            ui.hour = h;
            ui.minute = m - (m % MINUTE_STEP);
          }
          const md = fromISODate(t.date);
          ui.year = md.getFullYear();
          ui.month = md.getMonth();
          c.render();
        },
        'when-removeterm': (data) => { ui.terms.splice(Number(data.i), 1); c.render(); },
        // Runde 4 (F1, Jonathan: „wenn man auf Jetzt klickt, dass es nicht direkt ausgewählt wird,
        // sondern dass man dann noch einmal drücken muss"): Der erste Tipp ist eine sichtbare
        // VORWAHL — Rad, Kalender und Knopf stehen auf „Jetzt", der Puls läuft. Ein zweiter Tipp
        // auf „Jetzt" (oder „Übernehmen") übernimmt und schließt. (Löst v7 A24a ab.)
        'when-now': () => {
          rueckmeldung('tipp');
          if (!ui.nowActive) {
            ui.nowActive = true;
            zeigeJetzt(ui);
            c.render();
            return;
          }
          uebernehmen();
        },
        'when-apply': () => uebernehmen(),
      });
      bindWheel(root, 'hour', (value) => { ui.hour = value; ui.nowActive = false; c.render(); });
      bindWheel(root, 'minute', (value) => { ui.minute = value; ui.nowActive = false; c.render(); });
      scheduleReplace(c, draft, replaced);
      fitInsets(root);
    },
  };
}

// Zieh-Logik: siehe ui/components.js (bindRad). Sie folgt dem Finger und rastet weich ein.
function bindWheel(root, role, onChange) {
  bindRad(root, role, (wert) => onChange(Number(wert)));
}

// =====================================================================
// 08.9/08.10/08.11 Ort hinzufügen + 08.13 Auf Karte wählen
// =====================================================================

function homeAddress(ctx) {
  return ctx.repo.getSettings().homeAddress || { name: 'Rathausstraße 12', city: 'Bregenz' };
}



// T5: Die Trefferliste vereint zwei Quellen — die Orte, die die App schon kennt, und die
// echte Ortssuche aus OpenStreetMap. Gesucht wird erst nach dem Tippen (ortssuche unten);
// gezeichnet wird immer aus ui.placeResults, damit die Liste nicht flackert.
function bekannteOrte(ctx, frage) {
  const alle = ctx.repo.searchPlaces(frage || '') || [];
  return alle.slice(0, 3);
}

function placeResultsHtml(ctx, ui) {
  const results = (ui.placeResults && ui.placeResults.length ? ui.placeResults : bekannteOrte(ctx, ui.query)).slice(0, 6);
  if (ui.placeSearching && !results.length) {
    return `<div style="padding:14px 4px;font-size:12.5px;color:var(--muted)">${tx('Suche läuft …')}</div>`;
  }
  if (!results.length) return `<div style="padding:14px 4px;font-size:12.5px;color:var(--muted)">${tx('Kein Ort gefunden')}</div>`;
  return results.map((p, index) => {
    const selected = ui.selectedPlace?.name === p.name;
    const fern = typeof p.lat === 'number' ? '' : '';
    return `<button data-act="place-pick" data-index="${index}" data-name="${esc(p.name)}" style="display:flex;align-items:center;gap:11px;padding:11px 4px;border:0;background:transparent;width:100%;cursor:pointer;appearance:none;font-family:${FONT};color:var(--ink);${index < results.length - 1 ? 'border-bottom:1px solid var(--ink-a06);' : ''}">
<span style="width:32px;height:32px;border-radius:10px;background:var(--paper);display:flex;align-items:center;justify-content:center;flex:none;pointer-events:none">${pinIcon('var(--ink)', 14)}</span>
<div style="display:flex;flex-direction:column;gap:1px;flex:1;min-width:0;pointer-events:none;text-align:left"><span style="font-size:13.5px;font-weight:650;white-space:nowrap;overflow:hidden;text-overflow:ellipsis">${esc(p.name)}${fern}</span><span style="font-size:11.5px;color:var(--muted);font-variant-numeric:tabular-nums;white-space:nowrap;overflow:hidden;text-overflow:ellipsis">${esc(p.address || '')}</span></div>
${selected ? checkCircle(true) : ''}
</button>`;
  }).join('');
}

// Sucht bei jedem Tippen — verzögert, damit nicht jede Taste eine Anfrage auslöst, und mit
// Nummer, damit eine langsame ältere Antwort eine neuere nicht überschreibt.
let ortssucheNummer = 0;
let ortssucheTimer = null;
function ortssuche(ctx, ui, zeichneNeu) {
  clearTimeout(ortssucheTimer);
  const frage = (ui.query || '').trim();
  if (frage.length < 2) {
    ui.placeResults = bekannteOrte(ctx, frage);
    ui.placeSearching = false;
    zeichneNeu();
    return;
  }
  const meine = (ortssucheNummer += 1);
  ui.placeSearching = true;
  ui.placeResults = bekannteOrte(ctx, frage);
  zeichneNeu();
  ortssucheTimer = setTimeout(async () => {
    let gefunden = [];
    try {
      const { ortSuchen } = await import('../ui/map.js');
      gefunden = await ortSuchen(frage, { limit: 6 });
    } catch { /* ohne Netz bleibt es bei den bekannten Orten */ }
    if (meine !== ortssucheNummer) return;
    const bekannt = bekannteOrte(ctx, frage);
    const zusammen = [...bekannt];
    for (const treffer of gefunden) {
      if (!zusammen.some((p) => p.name.toLowerCase() === treffer.name.toLowerCase())) zusammen.push(treffer);
    }
    ui.placeResults = zusammen;
    ui.placeSearching = false;
    zeichneNeu();
  }, 280);
}

// KARTEN-GRENZE (spec/DATA_AND_MAP_BOUNDARY.md): Für Personen gibt es im Bestand KEINE
// Koordinaten. Die Karte im Modus „Bei Person" zeigt deshalb ausschließlich eine GROBE
// Umgebung — den Ortsnamen aus der von dieser Person selbst hinterlegten Adresse, nie
// Straße, Hausnummer oder einen Pin. Die Zonen liegen auf der Demo-Kartenfläche.
const GROB_ZONEN = { Bregenz: { x: 0.42, y: 0.44 }, Dornbirn: { x: 0.74, y: 0.66 }, Lochau: { x: 0.28, y: 0.2 } };

const ortAusAdresse = (address) => String(address || '').split(',').pop().trim().replace(/^\d{4,6}\s*/, '');

function grobeZone(ort) {
  if (GROB_ZONEN[ort]) return GROB_ZONEN[ort];
  // Deterministische, bewusst grobe Streuung für Orte außerhalb des Demo-Bestands —
  // nur damit zwei verschiedene Orte nicht übereinander liegen.
  let h = 0;
  for (const ch of String(ort)) h = (h * 31 + ch.charCodeAt(0)) % 997;
  return { x: 0.22 + (h % 55) / 100, y: 0.18 + (Math.floor(h / 8) % 55) / 100 };
}

// Grobe Umgebung als weiche Fläche: gefüllter Kreis mit Ortsnamen, kein Pin, keine Straße.
// Die Zone liegt in Prozent der Kartenbühne — sie sitzt damit in jedem Viewport an
// derselben Stelle der Fläche und ist ein echtes Bedienelement: ein Tipp darauf wählt
// dieselbe Person wie die Zeile in der Liste.
function zoneHtml(entry) {
  const { zone, label, aktiv, personId, person, marker } = entry;
  const r = 62;
  const farbe = aktiv ? 'var(--green-a20)' : 'var(--ink-a09)';
  const kante = aktiv ? 'var(--green-a55)' : 'var(--ink-a16)';
  return `<button data-act="place-person" data-person="${esc(personId)}" aria-pressed="${aktiv}" style="position:absolute;left:${(clamp(zone.x, 0.1, 0.9) * 100).toFixed(1)}%;top:${(clamp(zone.y, 0.1, 0.9) * 100).toFixed(1)}%;transform:translate(-50%,-50%);width:${r * 2}px;height:${r * 2}px;border-radius:50%;background:radial-gradient(circle at 50% 50%, ${farbe} 0%, ${farbe} 46%, rgba(255,255,255,0) 100%);border:1.5px dashed ${kante};box-sizing:border-box;display:flex;align-items:center;justify-content:center;pointer-events:auto;cursor:pointer;appearance:none;padding:0;font-family:${FONT}">
<span style="background:var(--surface);border:1px solid ${kante};color:${aktiv ? 'var(--green-dark)' : 'var(--ink-soft)'};border-radius:999px;padding:4px 10px 4px 4px;font:650 11px/1 ${FONT};white-space:nowrap;box-shadow:0 2px 7px var(--shadow-12);pointer-events:none;display:flex;align-items:center;gap:6px">${person ? personAvatar(person, { size: 18, fontSize: 7.5, marker, dotBorder: 'var(--surface)' }) : ''}<span>${esc(label)}</span></span></button>`;
}

// Kartenfläche im Ort-Sheet: „Auf Karte wählen" ändert nicht das Layout — fester Pin in der
// Mitte, aus der Pille wird „Diesen Ort wählen" (08.9); voller Picker: 08.13.
// v6 A18d: Die Bühne ist ein FESTER Karten-Viewport wie im Meet-Browser — randlos, vom
// Bereichskopf bis zur Unterkante des Sheets. Ihre Höhe hängt nicht mehr davon ab, wie
// viel Inhalt der jeweilige Modus darüber hat (fitPlaceMap).
// v6 A18d: EIN fester Karten-Viewport. Die Bühne reicht vom Bereichskopf bis zur
// Unterkante des Sheets — unabhängig davon, welcher Ort-Modus gerade aktiv ist. Vorher
// rechnete diese Funktion den freien REST über der Bedienebene aus; dadurch bestimmte
// die Höhe der Suchleiste bzw. der Adresszeile die Kartenhöhe (329 px gegen 485 px).
function fitPlaceMap(root) {
  const map = root.querySelector('[data-role="place-map"]');
  const scroll = map?.closest('[data-layerscroll]');
  if (!map || !scroll) return;
  scroll.style.paddingBottom = '0px';
  const top = map.getBoundingClientRect().top - scroll.getBoundingClientRect().top + scroll.scrollTop;
  map.style.height = `${Math.max(200, Math.round(scroll.clientHeight - top))}px`;
}

// Auftrag §5.4 — „Ort wählen" hat genau ZWEI Möglichkeiten, mehr nicht.
//
// Vorher: drei Segmente (Ort suchen · Bei mir · Bei Person), dazu ein zweiter Umschalter
// Liste/Karte. Zwei Umschalter neben drei Bereichen sind sechs Zustände — das versteht
// niemand. Dazu kamen erfundene Adressen aus dem Zugversatz.
//
// Jetzt:
//   1. ORT SUCHEN — man sieht EINE Karte, oben eine Suchleiste. Tippt man, legt sich die
//      Trefferliste von oben über die Karte; die Karte bleibt darunter sichtbar. Ein Tipp
//      auf einen Treffer schließt die Liste, der Ort erscheint auf der Karte, dann kann man
//      ihn übernehmen.
//   2. BEI JEMANDEM DAHEIM — dieselbe Karte, aber statt der Suchleiste ein Knopf, der die
//      Freundesliste aufklappt. Man wählt sich selbst oder eine Freundin. Bei einer anderen
//      Person geht eine Anfrage raus, so wie bisher.
//
// Kein Umschalter zwischen Liste und Karte. Die Karte ist immer da.

// Wen kann man überhaupt fragen? Nur, wer im Meet eingeladen ist.
function invitedPeople(ctx, draft) {
  if (draft.withCrewId) {
    const crew = ctx.repo.getCrew(draft.withCrewId);
    if (crew) return crew.memberIds.filter((id) => id !== ME).map((id) => ctx.repo.getPerson(id)).filter(Boolean);
  }
  if (draft.withPersonIds?.length) return draft.withPersonIds.map((id) => ctx.repo.getPerson(id)).filter(Boolean);
  return [];
}

// Was die Karte über eine eingeladene Person zeigen darf: NIE die genaue Adresse, solange
// die Zustimmung nicht da ist — nur die grobe Umgebung, die diese Person selbst hinterlegt
// hat, oder ehrlich „Lage nicht freigegeben".
function personLage(ctx, person) {
  const place = ctx.repo.getPersonPlace(person.id);
  if (!place) return { ort: null, status: 'keine', text: tx('Lage nicht freigegeben') };
  const ort = ortAusAdresse(place.address);
  if (place.approved) return { ort, status: 'frei', text: place.address || tx('Adresse freigegeben') };
  if (place.requested) return { ort, status: 'offen', text: ort ? tx('Zustimmung steht aus · {ort}', { ort }) : tx('Zustimmung steht aus') };
  return { ort, status: 'grob', text: ort ? tx('grobe Umgebung · {ort}', { ort }) : tx('Lage nicht freigegeben') };
}

// Runde 3 (I6): Der Knopf schwebt über der Karte — ein weicher Schatten hebt ihn von ihr ab.
const placeApplyBtn = (ready) => `<button data-act="place-apply" style="background:${ready ? 'var(--green)' : 'var(--field)'};color:${ready ? 'var(--on-accent)' : 'var(--muted-light)'};font:650 14px/1 ${FONT};padding:14px 0;border-radius:999px;text-align:center;width:100%;border:0;cursor:pointer;appearance:none;box-shadow:0 8px 22px var(--shadow-18)">${tx('Ort übernehmen')}</button>`;

function placeSeg(active) {
  const seg = (id, label) => (active === id
    ? `<button data-act="place-mode" data-mode="${id}" style="flex:1;background:var(--surface);border-radius:11px;padding:9px 0;text-align:center;font-size:12.5px;font-weight:650;box-shadow:0 1px 3px var(--shadow-08);border:0;cursor:pointer;appearance:none;font-family:${FONT};color:var(--ink)"><span style="pointer-events:none">${label}</span></button>`
    : `<button data-act="place-mode" data-mode="${id}" style="flex:1;border-radius:11px;padding:9px 0;text-align:center;font-size:12.5px;font-weight:600;color:var(--muted);border:0;background:transparent;cursor:pointer;appearance:none;font-family:${FONT}"><span style="pointer-events:none">${label}</span></button>`);
  return `<div style="background:var(--field);border-radius:14px;padding:3px;display:flex;gap:3px">${seg('search', tx('Ort suchen'))}${seg('home', tx('Bei jemandem daheim'))}</div>`;
}

// Runde 3 (Jonathan I5/I6): Oben auf der Karte liegt EIN Feld — im Suchen-Modus die Suchpille,
// in „Bei jemandem daheim" die Wer-Pille. Beide öffnen SICH SELBST: die Liste klappt innerhalb
// der Pille auf, statt als zweite Fläche darunter hervorzuschieben („Ich will, dass sich die
// Pille öffnet"). Seitlich 20 px wie jede andere Zeile des Sheets — vorher 12 px, weshalb die
// Karte „anders gepolstert" wirkte als die übrigen Schritte.
const PLACE_RAND = 20;
// Runde 5 (D3, Jonathan: „es darf keine anderen Elemente, welche über einer Karte liegen, nach links
// drücken"): Suchfeld, Hinweis und Knopf laufen wieder über die volle Breite (je 20 px Rand). Die
// Bedienung der Karte weicht ihnen aus — sie tragen data-ueber-karte (ui/map.js › spalteOrdnen).
const PLACE_LISTE_MAX = 318;

function placeFeld(kopf, liste, offen) {
  return `<div data-role="place-feld" data-ueber-karte data-offen="${offen ? 'ja' : 'nein'}" style="position:absolute;left:${PLACE_RAND}px;right:${PLACE_RAND}px;top:12px;z-index:4;background:var(--surface);border:1.5px solid ${offen ? 'var(--ink-a14)' : 'var(--ink-a10)'};border-radius:24px;box-shadow:0 6px 18px var(--shadow-14);overflow:hidden;transition:border-color .18s ease-out">
${kopf}
<div data-role="place-liste" style="display:${offen ? 'block' : 'none'};border-top:1px solid var(--ink-a07);max-height:${PLACE_LISTE_MAX}px;overflow-y:auto;overscroll-behavior:contain;scrollbar-width:none;padding:6px">${liste}</div>
</div>`;
}

function placeTrefferZeile(eintrag, index) {
  return `<button data-act="place-pick" data-index="${index}" data-name="${esc(eintrag.name)}" style="display:flex;align-items:center;gap:11px;padding:10px 8px;width:100%;border:0;border-radius:14px;background:transparent;text-align:left;cursor:pointer;appearance:none;font-family:${FONT}">
<span style="width:32px;height:32px;border-radius:11px;background:var(--paper);display:flex;align-items:center;justify-content:center;flex:none;pointer-events:none">${pinIcon('var(--ink-soft)', 15)}</span>
<span style="display:flex;flex-direction:column;gap:1px;flex:1;min-width:0;pointer-events:none">
<span style="font-size:14px;font-weight:650;color:var(--ink);white-space:nowrap;overflow:hidden;text-overflow:ellipsis">${esc(eintrag.name)}</span>
${eintrag.address ? `<span style="font-size:11.5px;color:var(--muted);white-space:nowrap;overflow:hidden;text-overflow:ellipsis">${esc(eintrag.address)}</span>` : ''}
</span></button>`;
}

// --- 1. Ort suchen --------------------------------------------------------------------------
// Die Trefferzeilen allein — beim Tippen tauscht die Bindung NUR diesen Inhalt aus.
// Ein ganzer Neuaufbau würde das Eingabefeld unter den Fingern ersetzen und den Fokus
// mitnehmen; man müsste nach jedem Buchstaben neu hineintippen.
function placeTrefferListe(ctx, ui) {
  const treffer = (ui.placeResults && ui.placeResults.length ? ui.placeResults : bekannteOrte(ctx, ui.query)).slice(0, 8);
  if (!treffer.length) {
    return `<div style="padding:12px 10px;font:500 13px/1.5 ${FONT};color:var(--muted)">${tx('Kein Ort gefunden. Tipp: Name des Lokals, der Halle oder der Straße.')}</div>`;
  }
  return treffer.map(placeTrefferZeile).join('');
}

function placeSuchen(ctx, ui) {
  const offen = Boolean(ui.listeOffen) && String(ui.query || '').trim().length > 0;
  const kopf = `<label style="display:flex;align-items:center;gap:9px;min-height:45px;padding:0 3px 0 15px;cursor:text">
${searchSmallIcon('var(--ink-soft)', 15)}
<input data-role="place-search" value="${esc(ui.query || '')}" placeholder="${esc(tx('Ort suchen …'))}" style="flex:1;min-width:0;border:0;outline:none;background:transparent;font:650 13.5px ${FONT};color:var(--ink);padding:12px 0">
<button data-act="place-clear" aria-label="${esc(tx('Suche leeren'))}" style="width:40px;height:40px;border:0;background:transparent;padding:0;display:${ui.query ? 'flex' : 'none'};align-items:center;justify-content:center;cursor:pointer;appearance:none;flex:none">${crossSmallIcon('var(--muted)', 14)}</button>
</label>`;
  return placeFeld(kopf, offen ? placeTrefferListe(ctx, ui) : '', offen);
}

// --- 2. Bei jemandem daheim -----------------------------------------------------------------
// Runde 3 (I5): „Die Auswahl, bei wem, kann ich nicht abwählen … Man kann wählen bei wem —
// nicht nur bei mir, auch bei Freunden."
//   · Ein zweiter Tipp auf die gewählte Zeile hebt die Wahl auf; dasselbe tut das × in der Pille.
//   · Ohne Crew stehen neben den Eingeladenen auch alle übrigen Freunde zur Wahl. Wer gewählt
//     wird, kommt beim Anfragen mit ins Meet („Wird mit eingeladen") — bei jemandem daheim zu
//     sein, heißt dabei zu sein. Bei einem Crew-Meet bleibt es bei der Crew.
function placeDaheim(ctx, draft, ui) {
  const settings = ctx.repo.getSettings();
  const addr = homeAddress(ctx);
  const offen = Boolean(ui.listeOffen);
  const eingeladen = invitedPeople(ctx, draft);
  const eingeladenIds = new Set(eingeladen.map((p) => p.id));
  const weitere = draft.withCrewId ? [] : ctx.repo.getPeople().filter((p) => p.id !== ME && !eingeladenIds.has(p.id));

  const person = ui.personId && ui.personId !== ME ? ctx.repo.getPerson(ui.personId) : null;
  const gewaehlt = ui.personId === ME
    ? { name: tx('Bei mir'), sub: `${addr.name}, ${addr.city}` }
    : person
      ? { name: tx('Bei {name}', { name: person.name }), sub: eingeladenIds.has(person.id) ? personLage(ctx, person).text : tx('Wird mit eingeladen') }
      : null;
  const zeichen = ui.personId === ME
    ? `<span style="width:26px;height:26px;border-radius:50%;overflow:hidden;flex:none;display:flex">${avatarFlaeche({ photo: settings.photo, color: settings.color, initials: settings.initials }, 26, 10)}</span>`
    : person ? personAvatar(person, { size: 26, fontSize: 10 }) : houseIcon('var(--ink-soft)', 16);

  const kopf = `<div style="display:flex;align-items:center;min-height:45px">
<button data-act="place-liste" data-role="place-wer" aria-expanded="${offen}" style="flex:1;min-width:0;display:flex;align-items:center;gap:10px;padding:8px 6px 8px 13px;border:0;background:transparent;cursor:pointer;appearance:none;font-family:${FONT};text-align:left">
<span style="display:flex;justify-content:center;width:26px;flex:none;pointer-events:none">${zeichen}</span>
<span style="display:flex;flex-direction:column;gap:1px;flex:1;min-width:0;pointer-events:none">
<span style="font-size:13.5px;font-weight:650;color:${gewaehlt ? 'var(--ink)' : 'var(--muted)'};white-space:nowrap;overflow:hidden;text-overflow:ellipsis">${esc(gewaehlt ? gewaehlt.name : tx('Bei wem?'))}</span>
${gewaehlt?.sub ? `<span style="font-size:11px;color:var(--muted);white-space:nowrap;overflow:hidden;text-overflow:ellipsis">${esc(gewaehlt.sub)}</span>` : ''}
</span>
<span style="pointer-events:none;display:flex;transform:rotate(${offen ? 180 : 0}deg);transition:transform .18s ease-out">${chevronDownIcon('var(--muted)', 14)}</span>
</button>
${gewaehlt ? `<button data-act="place-person-weg" aria-label="${esc(tx('Auswahl aufheben'))}" style="width:44px;height:44px;border:0;border-left:1px solid var(--ink-a07);background:transparent;padding:0;display:flex;align-items:center;justify-content:center;cursor:pointer;appearance:none;flex:none">${crossSmallIcon('var(--muted)', 13)}</button>` : ''}
</div>`;

  const zeile = (inhalt, personId, aktiv) => `<button data-act="place-person" data-person="${esc(personId)}" aria-pressed="${aktiv}" style="display:flex;align-items:center;gap:11px;padding:9px 8px;width:100%;border:0;border-radius:14px;background:${aktiv ? 'var(--green-tint)' : 'transparent'};text-align:left;cursor:pointer;appearance:none;font-family:${FONT}">${inhalt}${checkCircle(aktiv)}</button>`;
  const texte = (titel, sub, farbe) => `<span style="display:flex;flex-direction:column;gap:1px;flex:1;min-width:0;pointer-events:none"><span style="font-size:14px;font-weight:650;color:var(--ink);white-space:nowrap;overflow:hidden;text-overflow:ellipsis">${esc(titel)}</span>${sub ? `<span style="font-size:11.5px;color:${farbe};white-space:nowrap;overflow:hidden;text-overflow:ellipsis">${esc(sub)}</span>` : ''}</span>`;
  const rubrik = (wort) => `<span style="${labelStyle};display:block;padding:12px 8px 4px">${esc(wort)}</span>`;

  // „Bei mir" trägt zusätzlich einen leisen Weg, das eigene Zuhause genau zu setzen.
  const ichZeile = `<div style="display:flex;align-items:center;gap:2px">
<div style="flex:1;min-width:0">${zeile(`<span style="width:32px;height:32px;border-radius:50%;overflow:hidden;flex:none;pointer-events:none">${avatarFlaeche({ photo: settings.photo, color: settings.color, initials: settings.initials }, 32, 12)}</span>${texte(tx('Bei mir'), `${addr.name}, ${addr.city}`, 'var(--muted)')}`, ME, ui.personId === ME)}</div>
<button data-act="mine-map" style="flex:none;border:0;background:transparent;padding:14px 8px;font:650 11.5px ${FONT};color:var(--green-dark);cursor:pointer;appearance:none;white-space:nowrap"><span style="pointer-events:none">${tx('genauer')}</span></button>
</div>`;

  const personZeile = (p, neu) => {
    const lage = personLage(ctx, p);
    const farbe = neu ? 'var(--muted)' : lage.status === 'frei' ? 'var(--green-dark)' : lage.status === 'offen' ? 'var(--orange-dark)' : 'var(--muted)';
    return zeile(`<span style="pointer-events:none;display:flex">${personAvatar(p, { size: 32, fontSize: 12, marker: personMarker(p.id, settings) })}</span>${texte(p.name, neu ? tx('Wird mit eingeladen') : lage.text, farbe)}`, p.id, ui.personId === p.id);
  };

  const teile = [ichZeile];
  if (eingeladen.length) teile.push(rubrik(tx('Eingeladen')), ...eingeladen.map((p) => personZeile(p, false)));
  if (weitere.length) teile.push(rubrik(eingeladen.length ? tx('Weitere Freunde') : tx('Freunde')), ...weitere.map((p) => personZeile(p, true)));
  if (!eingeladen.length && !weitere.length) {
    teile.push(`<div style="padding:10px 8px;font:500 12.5px/1.5 ${FONT};color:var(--muted)">${tx('Noch keine Freunde')}</div>`);
  }
  return placeFeld(kopf, teile.join(''), offen);
}

// Runde 3 (I4/I6): Die Karte füllt die Bühne bis zur Unterkante des Sheets und ist bedienbar —
// schieben, zoomen (Finger, Rad, Höhenregler) und antippen. Der Pin sitzt auf dem ORT, nicht fest
// in der Mitte: er folgt der Karte beim Schieben (placeKarteBinden). Der Knopf unten schwebt über
// der Karte, an genau der Stelle, an der er in jedem anderen Schritt steht (panelBottom: 20 px
// seitlich, 28 px unten). Vorher endete die Karte über einem leeren Streifen, weil die Maske der
// unteren Bedienebene sie oberhalb des einen Knopfs ausblendete.
function placeBuehne(ctx, ui, { feld, ort, pinLabel, hinweis, cta }) {
  const hatLageOrt = Boolean(ort && typeof ort.lat === 'number' && typeof ort.lon === 'number');
  const pin = pinLabel && hatLageOrt
    ? `<div data-role="place-pin" data-lat="${ort.lat}" data-lon="${ort.lon}" style="position:absolute;left:50%;top:50%;transform:translate(-50%,-100%);display:flex;flex-direction:column;align-items:center;pointer-events:none;z-index:2">
<span data-role="place-pin-name" style="background:var(--green);color:var(--on-accent);border-radius:999px;padding:6px 11px;font-size:11px;font-weight:650;box-shadow:0 3px 9px var(--green-a40);white-space:nowrap;max-width:220px;overflow:hidden;text-overflow:ellipsis">${esc(pinLabel)}</span>
<span style="width:2.5px;height:9px;background:var(--green)"></span></div>`
    : '';
  const hinweisHtml = hinweis
    ? `<span data-role="place-hinweis" data-ueber-karte style="position:absolute;left:${PLACE_RAND}px;right:${PLACE_RAND}px;top:70px;z-index:2;background:var(--surface);border-radius:14px;padding:10px 13px;font:600 11.5px/1.4 ${FONT};color:var(--ink-soft);box-shadow:0 4px 14px var(--shadow-14);text-align:center;pointer-events:none">${esc(hinweis)}</span>`
    : '';
  const ctaHtml = `<div data-role="place-cta" data-ueber-karte style="position:absolute;left:0;right:0;bottom:0;z-index:5;padding:2px ${PLACE_RAND}px 28px;display:flex;flex-direction:column;pointer-events:none"><span style="display:contents;pointer-events:auto">${cta}</span></div>`;
  return `<div data-role="place-map" data-hdrag="karte" style="margin:0 -20px;flex:1;min-height:300px;position:relative;background:var(--field);overflow:hidden;touch-action:none">
${/* isolation: Die Bedienelemente der Karte (ⓘ, Höhenregler) tragen eigene hohe z-Werte. Sie
     bleiben INNERHALB der Karte gestapelt und damit unter Suchfeld, Pin und Knopf dieses Sheets. */ ''}<div data-fremd="1" data-role="place-map-canvas" style="position:absolute;inset:0;isolation:isolate"></div>
${pin}
${hinweisHtml}
${feld}
${ctaHtml}
</div>`;
}

const PLACE_KNOPF = `font:650 14px/1 ${FONT};padding:14px 0;border-radius:999px;text-align:center;width:100%;border:0;cursor:pointer;appearance:none;box-shadow:0 8px 22px var(--shadow-18)`;

// Der eine Knopf unten in „Bei jemandem daheim": bei mir übernehmen, bei anderen fragen.
function placeDaheimCta(ctx, draft, ui) {
  if (ui.personId === ME) return placeApplyBtn(true);
  const person = ui.personId ? ctx.repo.getPerson(ui.personId) : null;
  if (!person) {
    // Runde 3 (I5): Wer die Wahl aufhebt, kann einen schon übernommenen Ort auch entfernen.
    if (draft.place && (draft.place.mode === 'mine' || draft.place.mode === 'person')) {
      return `<button data-act="place-remove" style="${PLACE_KNOPF};background:var(--surface);color:var(--ink-soft);border:1.5px solid var(--ink-a14)">${tx('Ort entfernen')}</button>`;
    }
    return `<button data-act="place-request" style="${PLACE_KNOPF};background:var(--field);color:var(--muted-light)">${tx('Anfrage senden')}</button>`;
  }
  const schonGefragt = draft.place?.mode === 'person' && draft.place.personId === ui.personId;
  if (schonGefragt) {
    return `<button data-act="sheet-close" style="${PLACE_KNOPF};background:var(--green);color:var(--on-accent)">${tx('Fertig')}</button>`;
  }
  return `<button data-act="place-request" style="${PLACE_KNOPF};background:var(--green);color:var(--on-accent)">${tx('Anfrage an {name} senden', { name: esc(person.name) })}</button>`;
}

// Der jüngste Stand des Ort-Sheets — die Karte lebt über viele Zeichnungen hinweg, ihr
// Tipp-Ereignis wird nur einmal angemeldet und liest von hier (wie umkreisStand).
let ortStand = null;

// Runde 4 (D10): Welche Beschriftung der Karte liegt unter dem Finger? Nur, was einen Ort meint
// (Orte und Einrichtungen, Siedlungen, Gipfel, Flughäfen, Parks) — keine Straßen, Gewässer,
// Hausnummern oder Grenzen. Gesucht wird in Fingerbreite um die Tippstelle; es gewinnt die
// Beschriftung, deren Punkt am nächsten liegt. → { name, lat, lon, art } | null
const KARTEN_ORT_EBENEN = /^(poi|place|aerodrome_label|mountain_peak|park)$/;

// Gemessen: Das Kartenbild (OpenFreeMap „Positron") zeigt KEINE Einrichtungen — kein Spa, keinen
// Bahnhof —, und MapLibre behält nur Datenebenen, die eine Kartenebene benutzt. Die Ortskarte legt
// deshalb eine ruhige Ebene mit Punkt und Namen der Einrichtungen (OpenMapTiles „poi") dazu, ab
// Zoom 14.5, wichtige zuerst. Farben und Schrift kommen von den Ortsnamen der Karte selbst — so
// sieht sie aus wie ein Teil davon, auch dunkel (dort kehrt styles.css das ganze Kartenbild um).
// Angesehen (erste Fassung): Punkte als eigene Kreis-Ebene standen auch dort, wo der Name der
// Platzprobe zum Opfer fiel — schwarze Punkte überall. Jetzt ist der Punkt das Symbol DESSELBEN
// Eintrags wie der Name: Beide erscheinen zusammen oder gar nicht, weniger wichtige zuerst weg.
const POI_EBENEN = ['crew-orte'];

function ortsBeschriftungenZeigen(karte) {
  if (!karte?.getStyle || karte.getLayer?.('crew-orte')) return;
  const anlegen = () => {
    if (karte.getLayer('crew-orte')) return;
    const stil = karte.getStyle();
    const quelle = Object.entries(stil.sources || {}).find(([, s]) => s.type === 'vector')?.[0];
    if (!quelle) return;
    const vorbild = stil.layers.find((l) => l.id === 'label_village') || stil.layers.find((l) => l.type === 'symbol' && l['source-layer'] === 'place');
    const schrift = vorbild?.layout?.['text-font'] || ['Noto Sans Regular'];
    const farbe = typeof vorbild?.paint?.['text-color'] === 'string' ? vorbild.paint['text-color'] : 'rgb(110,110,110)';
    const halo = typeof vorbild?.paint?.['text-halo-color'] === 'string' ? vorbild.paint['text-halo-color'] : 'rgb(255,255,255)';
    if (!karte.hasImage?.('crew-orte-punkt')) {
      const px = 2 * Math.max(1, Math.round(globalThis.devicePixelRatio || 1));
      const leinwand = document.createElement('canvas');
      leinwand.width = 9 * px;
      leinwand.height = 9 * px;
      const g = leinwand.getContext('2d');
      g.beginPath();
      g.arc(4.5 * px, 4.5 * px, 3.6 * px, 0, Math.PI * 2);
      g.fillStyle = halo;
      g.fill();
      g.beginPath();
      g.arc(4.5 * px, 4.5 * px, 2.4 * px, 0, Math.PI * 2);
      g.fillStyle = farbe;
      g.globalAlpha = 0.7;
      g.fill();
      const bild = g.getImageData(0, 0, leinwand.width, leinwand.height);
      karte.addImage('crew-orte-punkt', { width: leinwand.width, height: leinwand.height, data: bild.data }, { pixelRatio: px });
    }
    const code = sprache();
    const name = ['coalesce', ['get', `name:${code}`], ['get', `name_${code}`], ['get', 'name']];
    karte.addLayer({
      id: 'crew-orte', type: 'symbol', source: quelle, 'source-layer': 'poi', minzoom: 15, filter: ['has', 'name'],
      layout: {
        'icon-image': 'crew-orte-punkt', 'icon-anchor': 'center',
        'text-field': name, 'text-font': schrift, 'text-size': 11, 'text-anchor': 'top', 'text-offset': [0, 0.5],
        'text-max-width': 8, 'text-padding': 6, 'symbol-sort-key': ['coalesce', ['get', 'rank'], 99],
        'text-optional': false, 'icon-optional': false,
      },
      paint: { 'text-color': farbe, 'text-halo-color': halo, 'text-halo-width': 1.4, 'text-opacity': 0.9 },
    });
  };
  if (karte.isStyleLoaded?.()) anlegen();
  else karte.once('load', anlegen);
}

function kartenOrtAmFinger(karte, punkt) {
  if (!karte?.queryRenderedFeatures || !punkt) return null;
  const R = 16;
  let treffer = [];
  try {
    treffer = karte.queryRenderedFeatures([[punkt.x - R, punkt.y - R], [punkt.x + R, punkt.y + R]]) || [];
  } catch {
    return null;
  }
  const code = sprache();
  let bester = null;
  for (const f of treffer) {
    if (f.layer?.type !== 'symbol' && !POI_EBENEN.includes(f.layer?.id)) continue;
    if (!KARTEN_ORT_EBENEN.test(f.sourceLayer || f['source-layer'] || '')) continue;
    const p = f.properties || {};
    const name = String(p[`name:${code}`] || p[`name_${code}`] || p.name || p['name:latin'] || '').trim();
    if (!name) continue;
    const koord = f.geometry?.type === 'Point' ? f.geometry.coordinates : null;
    const lage = koord ? karte.project(koord) : punkt;
    const abstand = Math.hypot(lage.x - punkt.x, lage.y - punkt.y);
    if (!bester || abstand < bester.abstand) {
      bester = { name, koord, abstand, art: p.subclass || p.class || f.sourceLayer || '' };
    }
  }
  if (!bester) return null;
  const ort = bester.koord ? { lat: bester.koord[1], lon: bester.koord[0] } : (() => { const l = karte.unproject([punkt.x, punkt.y]); return { lat: l.lat, lon: l.lng }; })();
  return { name: bester.name, lat: ort.lat, lon: ort.lon, art: String(bester.art || '') };
}

// Runde 3 (I4: „nicht auf die Karte klicken, um einen Ort zu wählen"): Ein Tipp auf die Karte
// wählt im Suchen-Modus genau diese Stelle. Der Name kommt vom Rückwärts-Nachschlagen (derselbe
// Dienst wie „Auf Karte wählen"); bis er da ist, heißt der Pin „Diese Stelle". Ist eine Liste
// offen, schließt der Tipp zuerst nur die Liste — wie ein Tipp neben ein Menü.
function ortKartenTipp(ereignis) {
  const st = ortStand;
  if (!st || st.c.nav.current()?.id !== 'newMeet.place') return;
  const { c, ui } = st;
  const listeSichtbar = ui.listeOffen && (ui.mode === 'home' || String(ui.query || '').trim().length > 0);
  if (listeSichtbar) {
    ui.listeOffen = false;
    document.activeElement?.blur?.();
    c.render();
    return;
  }
  if (ui.mode !== 'search' || !ereignis?.lngLat) return;
  // Runde 4 (D10, Jonathan: „wenn man direkt etwas anwählen kann, zum Beispiel Spa oder Bahnhof —
  // Sachen, die auf der Karte sind"): Liegt unter dem Finger eine Beschriftung der Karte (ein Ort,
  // eine Haltestelle, ein Gipfel, ein Dorf), wird GENAU dieser Ort übernommen — mit seinem Namen und
  // seiner Lage; nachgeschlagen wird nur noch die Adresse. Sonst wie bisher: diese Stelle.
  const poi = kartenOrtAmFinger(ereignis.target, ereignis.point);
  const lat = poi ? poi.lat : ereignis.lngLat.lat;
  const lon = poi ? poi.lon : ereignis.lngLat.lng;
  document.activeElement?.blur?.();
  ui.listeOffen = false;
  ui.placeGezeigt = `${lat.toFixed(6)},${lon.toFixed(6)}`;
  const markiert = { name: poi ? poi.name : tx('Diese Stelle'), address: '', lat, lon, fromMap: true, ...(poi ? { poi: poi.art || true } : {}) };
  ui.selectedPlace = markiert;
  rueckmeldung('auswahl');
  c.render();
  ortAnPunkt(lat, lon).then((treffer) => {
    if (ui.selectedPlace !== markiert) return;
    const strasse = poi && treffer?.name && treffer.name !== poi.name ? treffer.name : '';
    ui.selectedPlace = poi
      ? { ...markiert, address: [strasse, treffer?.address].filter(Boolean).join(', ') }
      : treffer
        ? { name: treffer.name || tx('Diese Stelle'), address: treffer.address || '', lat, lon, fromMap: true }
        : { ...markiert, address: `${lat.toFixed(4)}, ${lon.toFixed(4)}` };
    if (ortStand?.ui === ui && ortStand.c.nav.current()?.id === 'newMeet.place') ortStand.c.render();
  }).catch(() => {});
}

function renderPlace(ctx) {
  const { draft, replaced } = ensureDraft(ctx);
  const ui = ctx.ui;
  if (!ui.init) {
    ui.init = true;
    // §5.4: nur noch zwei Möglichkeiten. Alte Entwürfe mit 'mine'/'person' landen in
    // „Bei jemandem daheim" — dort sind beide zu Hause.
    ui.mode = (draft.place?.mode === 'person' || draft.place?.mode === 'mine') ? 'home' : 'search';
    ui.query = '';
    ui.listeOffen = false;
    ui.personId = draft.place?.mode === 'mine' ? ME : (draft.place?.personId || null);
    if (draft.place && (draft.place.mode === 'search' || draft.place.mode === 'map' || draft.place.auto)) {
      ui.selectedPlace = ortAusEntwurf(draft.place);
      if (typeof ui.selectedPlace?.lat === 'number') ui.placeGezeigt = `${ui.selectedPlace.lat.toFixed(6)},${ui.selectedPlace.lon.toFixed(6)}`;
    }
  }

  const fresh = ctx.repo.getDraft(draft.id);
  const daheim = ui.mode === 'home';

  // Was zeigt der Pin, und wo liegt er? Im Daheim-Modus entsteht der Ort aus der Person — er
  // überschreibt NICHT den gesuchten Ort (vorher stand nach dem Zurückwechseln „Bei mir" in der Suche).
  let feld;
  let ort = null;
  let pinLabel = null;
  let hinweis = null;
  if (daheim) {
    feld = placeDaheim(ctx, fresh, ui);
    if (ui.personId === ME) {
      const addr = homeAddress(ctx);
      pinLabel = tx('Bei mir');
      if (typeof addr.lat === 'number') ort = { lat: addr.lat, lon: addr.lon };
    } else if (ui.personId) {
      const person = ctx.repo.getPerson(ui.personId);
      const personOrt = person ? ctx.repo.getPersonPlace(person.id) : null;
      if (person && personOrt && typeof personOrt.lat === 'number') {
        pinLabel = tx('Bei {name}', { name: person.name });
        ort = { lat: personOrt.lat, lon: personOrt.lon };
        if (!personOrt.approved) hinweis = tx('Nur die grobe Umgebung — die genaue Adresse erst nach Zustimmung.');
      } else {
        hinweis = tx('Diese Person hat ihren Ort noch nicht geteilt. Die Anfrage geht trotzdem raus.');
      }
    } else {
      hinweis = tx('Wähle oben, bei wem ihr euch trefft.');
    }
  } else {
    feld = placeSuchen(ctx, ui);
    ort = ui.selectedPlace;
    pinLabel = ort ? ort.name : null;
    if (!ort) hinweis = tx('Suche oben — oder tippe auf die Karte.');
  }

  const cta = daheim ? placeDaheimCta(ctx, fresh, ui) : placeApplyBtn(Boolean(ui.selectedPlace));

  const panel = nmPanel({
    top: 64,
    title: tx('Ort hinzufügen'),
    scrollKey: 'nm-place',
    gap: 12,
    // §5.4: EIN Umschalter mit ZWEI Feldern. Der zweite Umschalter (Liste/Karte) ist weg —
    // die Karte ist immer da, die Liste klappt bei Bedarf in der Pille auf.
    header: `<div style="padding:0 20px">${placeSeg(ui.mode)}</div>`,
    body: placeBuehne(ctx, ui, { feld, ort, pinLabel, hinweis, cta }),
    // Runde 3 (I6): Der Knopf liegt IN der Bühne (placeBuehne), nicht in einer eigenen unteren
    // Ebene — sonst blendete deren Maske die Karte über dem Knopf aus.
    // Die Bühne füllt das Sheet — hier wird nicht gescrollt, sondern auf der Karte bewegt.
    scrollExtra: 'overflow:hidden;',
  });

  return {
    html: composerScaffold(ctx, fresh, panel),
    bind(root, c) {
      ortStand = { c, ui, draftId: draft.id };
      const kartenKnoten = root.querySelector('[data-role="place-map-canvas"]');
      // Der Höhenregler steht rechts auf der Karte — unter einer offenen Liste hätte er nichts verloren.
      const reglerZeigen = () => {
        const regler = kartenKnoten?.querySelector('[data-role="hoehenregler"]');
        const liste = root.querySelector('[data-role="place-liste"]');
        if (regler) regler.style.visibility = liste && liste.style.display === 'block' ? 'hidden' : '';
      };

      const searchInput = root.querySelector('[data-role="place-search"]');
      if (searchInput) {
        const listeZeigen = () => {
          const feldKnoten = root.querySelector('[data-role="place-feld"]');
          const knoten = feldKnoten?.querySelector('[data-role="place-liste"]');
          if (!knoten) return;
          const offen = Boolean(ui.listeOffen) && String(ui.query || '').trim().length > 0;
          knoten.style.display = offen ? 'block' : 'none';
          feldKnoten.dataset.offen = offen ? 'ja' : 'nein';
          feldKnoten.style.borderColor = offen ? 'var(--ink-a14)' : 'var(--ink-a10)';
          if (offen) knoten.innerHTML = placeTrefferListe(c, ui);
          const leeren = root.querySelector('[data-act="place-clear"]');
          if (leeren) leeren.style.display = ui.query ? 'flex' : 'none';
          // Runde 5: Die offene Liste macht das Suchfeld hoch — die Bedienung der Karte weicht neu aus.
          if (ui.placeKarte) kartenBausteine.bedienSpalteOrdnen?.(ui.placeKarte);
          const hinweisKnoten = root.querySelector('[data-role="place-hinweis"]');
          if (hinweisKnoten) hinweisKnoten.style.visibility = offen ? 'hidden' : '';
          reglerZeigen();
        };
        searchInput.addEventListener('focus', () => { ui.listeOffen = true; listeZeigen(); });
        searchInput.addEventListener('input', () => {
          ui.query = searchInput.value;
          ui.listeOffen = Boolean(searchInput.value.trim());
          listeZeigen();
          // T5: echte Ortssuche. Nur die Trefferliste wird ausgetauscht — ein ganzer
          // Render würde das Eingabefeld unter den Fingern neu aufbauen.
          ortssuche(c, ui, listeZeigen);
        });
      }

      // T5 / Runde 3 (I4): Die echte Karte im Ort-Sheet ist jetzt IMMER bedienbar. Vorher hing
      // das an einem Merker (data-pick), den kein Markup mehr setzte — die Karte war starr.
      if (kartenKnoten) {
        const pinKnoten = root.querySelector('[data-role="place-pin"]');
        const lat = Number(pinKnoten?.dataset.lat);
        const lon = Number(pinKnoten?.dataset.lon);
        const hatZiel = Number.isFinite(lat) && Number.isFinite(lon);
        const start = startAnsicht(c.repo.getSettings());
        // EINE Karte je Knoten: karteHalten merkt sich eine Karte erst, wenn sie fertig angelegt
        // ist. Zwei schnelle Zeichnungen hintereinander legten sonst zwei MapLibre-Karten in
        // denselben Knoten (gemessen: die zweite Herkunftsangabe lag über „Ort übernehmen").
        // Jede Bindung wartet deshalb auf DIESELBE Anlage.
        kartenKnoten.__crewKarte ||= karteHalten(kartenKnoten, 'nm-place', {
          mitte: hatZiel ? { lat, lon } : start.mitte,
          zoom: hatZiel ? 15 : start.zoom,
          interaktiv: true,
          folgen: false,
          hoehenRegler: true,
        });
        kartenKnoten.__crewKarte.then((karte) => {
          if (!karte) return;
          ui.placeKarte = karte;
          // Runde 5: meine Lage (D4) und die Bedienspalte nach jedem Zeichnen (Hinweis, Knopf, Feld).
          kartenBausteine.kartenLageQuelle?.(c.repo);
          kartenBausteine.bedienSpalteOrdnen?.(karte);
          ortsBeschriftungenZeigen(karte);
          const pinStellen = () => {
            const pin = karte.getContainer()?.parentElement?.querySelector('[data-role="place-pin"]');
            if (!pin) return;
            const p = karte.project([Number(pin.dataset.lon), Number(pin.dataset.lat)]);
            pin.style.left = `${Math.round(p.x)}px`;
            pin.style.top = `${Math.round(p.y)}px`;
          };
          if (!karte.__crewOrt) {
            karte.__crewOrt = true;
            karte.on('move', pinStellen);
            karte.on('resize', pinStellen);
            karte.on('click', ortKartenTipp);
          }
          // Runde 5: ⓘ unten rechts, direkt über „Ort übernehmen"; der Regler mittig rechts (P3, ui/map.js).
          // Ein neu gewählter Ort (Treffer, Person, Zuhause) — die Karte fährt hin. Ein Tipp auf
          // die Karte setzt placeGezeigt schon selbst: dort bleibt sie stehen.
          if (hatZiel) {
            const schluessel = `${lat.toFixed(6)},${lon.toFixed(6)}`;
            if (ui.placeGezeigt !== schluessel) {
              ui.placeGezeigt = schluessel;
              karte.easeTo({ center: [lon, lat], zoom: Math.max(karte.getZoom(), 14.5), duration: 420 });
            }
          }
          pinStellen();
          reglerZeigen();
          window.setTimeout(reglerZeigen, 400);
        }).catch(() => {});
      }

      bindActions(root, {
        'sheet-close': () => c.nav.back(),
        'place-mode': (data) => { ui.mode = data.mode; ui.listeOffen = false; c.render(); },
        // Die Liste klappt in der Pille auf und beim Wählen wieder zu.
        'place-liste': () => { ui.listeOffen = !ui.listeOffen; c.render(); },
        // Das eigene Zuhause genau setzen — Einzelheit von „Bei jemandem daheim".
        'mine-map': () => c.nav.go('newMeet.mapPick', { draftId: draft.id, target: 'mine' }),
        'place-clear': () => { ui.query = ''; ui.placeResults = []; ui.listeOffen = false; c.render(); },
        'place-pick': (data) => {
          // Der Treffer kommt aus der gezeigten Liste — sie kann auch echte Orte aus der
          // Ortssuche enthalten, die der App vorher unbekannt waren.
          const liste = (ui.placeResults && ui.placeResults.length ? ui.placeResults : bekannteOrte(c, ui.query));
          const place = liste[Number(data.index)] || liste.find((p) => p.name === data.name)
            || (c.repo.searchPlaces('') || []).find((p) => p.name === data.name);
          if (place) {
            ui.selectedPlace = { ...place };
            ui.listeOffen = false;
            document.activeElement?.blur?.();
            c.render();
          }
        },

        'place-apply': () => {
          if (ui.mode === 'home' && ui.personId === ME) {
            const freshDraft = c.repo.getDraft(draft.id);
            if (freshDraft.place?.mode === 'mine' && freshDraft.place.picked) { c.nav.back(); return; }
            const addr = homeAddress(c);
            c.repo.updateDraft(draft.id, { place: { mode: 'mine', name: 'Bei mir', address: `${addr.name}, ${addr.city}` } });
            c.nav.back();
          } else if (ui.mode === 'search' && ui.selectedPlace) {
            const p = ui.selectedPlace;
            // T5: Länge und Breite wandern mit — daran hängt die Karte im Meet und die Route.
            c.repo.updateDraft(draft.id, {
              place: {
                mode: p.fromMap ? 'map' : 'search',
                name: p.name,
                address: p.address || '',
                x: p.x, y: p.y,
                ...(typeof p.lat === 'number' ? { lat: p.lat, lon: p.lon } : {}),
              },
            });
            c.nav.back();
          } else {
            c.toast(tx('Erst einen Ort wählen'));
          }
        },
        // Runde 3 (I5): Ein zweiter Tipp auf dieselbe Zeile hebt die Wahl auf — die Liste bleibt
        // dann offen, damit gleich jemand anderes gewählt werden kann.
        'place-person': (data) => {
          if (ui.personId === data.person) { ui.personId = null; ui.listeOffen = true; }
          else { ui.personId = data.person; ui.listeOffen = false; }
          c.render();
        },
        'place-person-weg': () => { ui.personId = null; c.render(); },
        'place-remove': () => {
          c.repo.updateDraft(draft.id, { place: null });
          c.nav.back();
        },
        'place-request': () => {
          if (!ui.personId) { c.toast(tx('Erst eine Person wählen')); return; }
          const person = c.repo.getPerson(ui.personId);
          if (!person) return;
          // A18: echte offene Anfrage — die Datenschicht stimmt NICHT selbst zu. Den
          // Meet-Bezug bekommt sie beim Senden des Meets (publishDraftAction).
          c.repo.requestPersonPlace(person.id, {});
          // Keine Adresse in den Draft vor Zustimmung — der Composer trägt den Status.
          const aktuell = c.repo.getDraft(draft.id) || fresh;
          const patch = { place: { mode: 'person', personId: person.id, name: `Bei ${person.name}`, approved: false } };
          // Runde 3 (I5): Wer nicht eingeladen war, kommt mit ins Meet — ohne Crew ist das die
          // Freundesauswahl des Entwurfs.
          if (!aktuell.withCrewId && !(aktuell.withPersonIds || []).includes(person.id)) {
            patch.withPersonIds = [...(aktuell.withPersonIds || []), person.id];
          }
          c.repo.updateDraft(draft.id, patch);
          c.nav.back();
        },
      });
      scheduleReplace(c, draft, replaced);
      fitInsets(root);
      fitPlaceMap(root);
    },
  };
}

// 08.13 „Auf Karte wählen" — der EINE Karten-Picker: Pin fix in der Mitte, Karte bewegt sich.
//
// T5: Bis hierher war diese Karte gezeichnet, und die Adresse darunter wurde aus dem
// Zugversatz ERFUNDEN („Seestraße 17", je nachdem wie weit man geschoben hatte). Der Auftrag
// nennt genau das in §2 beim Namen und verbietet es in §5: Kein Bildschirm darf so tun als ob.
// Jetzt liegt hier dieselbe echte Karte wie überall sonst, und die Adresse kommt vom
// Rückwärts-Nachschlagen des Punktes, auf den der Pin zeigt.
function renderMapPick(ctx) {
  const { draft, replaced } = ensureDraft(ctx);
  const ui = ctx.ui;
  // Der zuletzt gewählte Punkt überlebt ein Neuzeichnen; die Adresse dazu wird nachgereicht,
  // sobald der Nachschlagedienst antwortet.
  if (!ui.pickPunkt) {
    const vorhanden = draft.place && typeof draft.place.lat === 'number' ? draft.place : null;
    ui.pickPunkt = vorhanden ? { lat: vorhanden.lat, lon: vorhanden.lon } : null;
  }
  const addr = ui.pickAdresse || { name: tx('Diese Stelle'), city: tx('Wird nachgeschlagen …') };

  const header = `<div style="display:flex;align-items:center;gap:12px;padding:8px 20px 10px;position:relative;z-index:2;background:var(--paper)">
<button data-act="back" aria-label="${esc(tx('Zurück'))}" style="width:36px;height:36px;border-radius:50%;background:var(--surface);border:1.5px solid var(--ink-a10);display:flex;align-items:center;justify-content:center;flex:none;cursor:pointer;appearance:none;padding:0">${backChevronIcon('var(--ink)', 18)}</button>
<span style="font-family:${TITLE_FONT};font-size:19px;font-weight:650;flex:1">${tx('Auf Karte wählen')}</span>
</div>`;

  // Die Karte ist der Inhaltskörper und füllt die Fläche; die Adress-/CTA-Leiste liegt als
  // Bottom-Ebene darüber — die Karte läuft sichtbar darunter durch, statt an einer weißen
  // Kante zu enden. data-fremd: Der Kartenknoten gehört MapLibre, nicht dem DOM-Abgleich.
  const body = `<div data-role="pick-map" style="height:100%;min-height:420px;position:relative;background:var(--field);overflow:hidden;touch-action:none;cursor:grab">
<div data-fremd="1" data-role="pick-canvas" style="position:absolute;inset:0"></div>
<div data-role="pick-pin" style="position:absolute;left:50%;top:50%;transform:translate(-50%,-100%);display:flex;flex-direction:column;align-items:center;pointer-events:none;z-index:2">
<span style="width:34px;height:34px;border-radius:50% 50% 50% 50%/55% 55% 45% 45%;background:var(--green);border:3px solid var(--surface);box-sizing:border-box;box-shadow:0 4px 12px var(--shadow-25);display:flex;align-items:center;justify-content:center"><span style="width:9px;height:9px;border-radius:50%;background:var(--surface)"></span></span>
<span style="width:2.5px;height:14px;background:var(--green)"></span>
</div>
<span data-role="pick-center" style="position:absolute;left:50%;top:50%;transform:translate(-50%,-50%);width:9px;height:9px;border-radius:50%;background:var(--ink-a35);pointer-events:none;z-index:2"></span>
</div>`;

  // v4 P0-5: die Adress-/CTA-Ebene ist eine echte KARTE mit eigenem Radius, kein vollbreites
  // deckendes Rechteck mit Trennlinie. Die Karte läuft links/rechts und darunter sichtbar weiter.
  const bottom = bottomBar(`<div data-ueber-karte style="background:var(--surface);border:1px solid var(--ink-a08);border-radius:24px;box-shadow:0 8px 24px var(--shadow-14);margin:0 16px 22px;padding:14px 16px 16px;display:flex;flex-direction:column;gap:12px">
<div style="display:flex;align-items:center;gap:11px">
<span style="width:34px;height:34px;border-radius:11px;background:var(--paper);display:flex;align-items:center;justify-content:center;flex:none">${pinIcon('var(--ink)', 17)}</span>
<div style="display:flex;flex-direction:column;gap:1px;flex:1;min-width:0"><span data-role="pick-name" style="font-size:14.5px;font-weight:650;white-space:nowrap;overflow:hidden;text-overflow:ellipsis">${esc(addr.name)}</span><span data-role="pick-city" style="font-size:12px;color:var(--ink-soft)">${esc(addr.city)}</span></div>
</div>
<button data-act="pick-confirm" style="display:block;width:100%;background:var(--green);color:var(--on-accent);font:650 15px/1 ${FONT};padding:16px 0;border-radius:999px;text-align:center;border:0;cursor:pointer;appearance:none">${tx('Diesen Ort wählen')}</button>
</div>`);

  return {
    html: screenScaffold({
      header, body, bottom, bottomInset: 0, scrollKey: 'nm-mappick', headerFade: false,
    }),
    bind(root, c) {
      const kartenKnoten = root.querySelector('[data-role="pick-canvas"]');
      const nameEl = root.querySelector('[data-role="pick-name"]');
      const cityEl = root.querySelector('[data-role="pick-city"]');
      // Die Karte füllt die ganze Fläche und läuft unter die Leiste; der Pin bleibt trotzdem
      // in der Mitte des FREIEN Kartenraums.
      const barHeight = root.querySelector('.screen-bottom')?.offsetHeight || 0;
      root.querySelectorAll('[data-role="pick-pin"],[data-role="pick-center"]').forEach((el) => {
        el.style.top = `calc(50% - ${Math.round(barHeight / 2)}px)`;
      });

      if (kartenKnoten) {
        import('../ui/map.js').then(async ({ karteHalten, ortAnPunkt, START_MITTE, kartenLageQuelle }) => {
          kartenLageQuelle?.(c.repo);
          // Runde 5: dieselbe Bedienung wie jede bedienbare Karte — Regler mittig rechts, ⓘ direkt über
          // der Adress-Karte mit „Diesen Ort wählen" (sie trägt data-ueber-karte).
          const karte = await karteHalten(kartenKnoten, 'nm-mappick', {
            mitte: ui.pickPunkt || START_MITTE,
            zoom: 15,
            folgen: false,
            hoehenRegler: true,
          });
          if (!karte) {
            // Ohne Karte (kein Netz, kein WebGL) wird hier nichts erfunden: Der Bildschirm
            // sagt, dass er die Stelle nicht nachschlagen kann.
            if (nameEl) nameEl.textContent = tx('Karte nicht verfügbar');
            if (cityEl) cityEl.textContent = tx('Ohne Netz lässt sich kein Ort wählen');
            return;
          }
          // Der Pin sitzt nicht in der Mitte der Karte, sondern in der Mitte des FREIEN
          // Raums über der Leiste. Nachgeschlagen wird deshalb der Punkt UNTER DEM PIN,
          // nicht die geometrische Kartenmitte.
          const nachschlagen = async () => {
            const punkt = karte.unproject([
              karte.getContainer().clientWidth / 2,
              karte.getContainer().clientHeight / 2 - Math.round(barHeight / 2),
            ]);
            ui.pickPunkt = { lat: punkt.lat, lon: punkt.lng };
            if (nameEl) nameEl.textContent = tx('Wird nachgeschlagen …');
            const treffer = await ortAnPunkt(punkt.lat, punkt.lng);
            // Nur übernehmen, wenn die Karte seitdem nicht weitergewandert ist.
            if (!ui.pickPunkt || Math.abs(ui.pickPunkt.lat - punkt.lat) > 1e-9) return;
            ui.pickAdresse = treffer
              ? { name: [treffer.name, treffer.address].filter(Boolean)[0] || tx('Diese Stelle'), city: treffer.address || '' }
              : { name: tx('Diese Stelle'), city: `${punkt.lat.toFixed(4)}, ${punkt.lng.toFixed(4)}` };
            if (nameEl) nameEl.textContent = ui.pickAdresse.name;
            if (cityEl) cityEl.textContent = ui.pickAdresse.city;
          };
          if (!karte.__crewPick) {
            karte.__crewPick = true;
            karte.setPadding?.({ top: 0, bottom: barHeight, left: 0, right: 0 });
            karte.on('moveend', nachschlagen);
            karte.on('zoomend', nachschlagen);
          }
          if (!ui.pickAdresse) nachschlagen();
          else { if (nameEl) nameEl.textContent = ui.pickAdresse.name; if (cityEl) cityEl.textContent = ui.pickAdresse.city; }
        }).catch(() => { /* ohne Karte bleibt die Leiste, wie sie ist */ });
      }

      bindActions(root, {
        'pick-confirm': () => {
          const punkt = ui.pickPunkt;
          const gewaehlt = ui.pickAdresse || { name: tx('Diese Stelle'), city: '' };
          const koordinaten = punkt ? { lat: punkt.lat, lon: punkt.lon } : {};
          // Die ausführliche Zeile enthält den Namen oft schon („Am Brand" · „Am Brand 3,
          // 6900 Bregenz"). Dann wird er nicht noch einmal davorgesetzt.
          const anschrift = gewaehlt.city && gewaehlt.city.includes(gewaehlt.name)
            ? gewaehlt.city
            : [gewaehlt.name, gewaehlt.city].filter(Boolean).join(', ');
          if (c.params.target === 'mine') {
            c.repo.updateDraft(draft.id, {
              place: { mode: 'mine', name: 'Bei mir', address: anschrift, picked: gewaehlt.name, ...koordinaten },
            });
          } else {
            c.repo.updateDraft(draft.id, { place: { mode: 'map', name: gewaehlt.name, address: gewaehlt.city, ...koordinaten } });
          }
          ui.pickAdresse = null;
          c.nav.back();
        },
      });
      scheduleReplace(c, draft, replaced);
      // Kein Bottom-Inset: die Karte IST der Inhalt und läuft absichtlich unter die Leiste.
    },
  };
}

// --- 08.12 Notiz: echtes Textfeld, keine Beispieltexte ---

function renderNote(ctx) {
  const { draft, replaced } = ensureDraft(ctx);
  const ui = ctx.ui;
  // Der getippte Text lebt im ui-Zustand: ein Rerender (z. B. die Ü4-Nachfrage) darf ihn
  // nicht verlieren.
  if (ui.noteValue === undefined) ui.noteValue = draft.note || '';
  const guard = dirtyGuard(ctx, 'nm-note');
  guard.track((draft.note || '').trim());
  const sheet = nmPanel({
    title: tx('Notiz'),
    scrollKey: 'nm-note',
    body: `<textarea data-role="note-input" style="border:1.5px solid var(--green-a50);border-radius:16px;padding:13px 15px;min-height:92px;font:400 14px/1.55 ${FONT};color:var(--ink);outline:none;resize:none;background:transparent;width:100%;box-sizing:border-box">${esc(ui.noteValue)}</textarea>`,
    bottom: panelBottom(`<div style="display:flex;gap:8px">
<button data-act="sheet-close" style="flex:1;border:1.5px solid var(--ink-a14);color:var(--ink-soft);font:650 14px/1 ${FONT};padding:13px 0;border-radius:999px;text-align:center;background:transparent;cursor:pointer;appearance:none">${tx('Abbrechen')}</button>
<button data-act="note-save" style="flex:1.4;background:var(--green);color:var(--on-accent);font:650 14px/1 ${FONT};padding:14px 0;border-radius:999px;text-align:center;border:0;cursor:pointer;appearance:none">${tx('Speichern')}</button>
</div>`),
  });
  return {
    html: composerScaffold(ctx, draft, `${sheet}${discardSheet(ctx)}`),
    bind(root, c) {
      const input = root.querySelector('[data-role="note-input"]');
      const live = () => ((input ? input.value : ui.noteValue) || '').trim();
      if (input) input.addEventListener('input', () => { ui.noteValue = input.value; });
      const close = () => c.nav.back();
      bindActions(root, {
        // Ü4: geänderte Notiz fragt beim Schließen nach, unveränderte schließt direkt.
        'sheet-close': () => {
          ui.noteValue = input ? input.value : ui.noteValue;
          if (!guard.confirm(live(), close)) return;
          close();
        },
        'note-save': () => {
          const value = live();
          guard.clear();
          ui.noteValue = value;
          c.repo.updateDraft(draft.id, { note: value });
          c.nav.back();
        },
      });
      bindActions(root, discardActions(c));
      if (!c.ui.__discard) input?.focus();
      scheduleReplace(c, draft, replaced);
      fitInsets(root);
    },
  };
}

// =====================================================================
// 08.7/08.8 Gespeichert · 08.8b Ordner · 08.8c Neuer Ordner · 08.7b Speichern · 08.7c Bestätigung
// =====================================================================

function savedIdeaIcon(idea) {
  if (idea.icon === '🍕') return pizzaIcon('var(--ink)', 17);
  return activityIconSvg(iconBeschreibung(idea), 'var(--ink)', 17);
}

function savedIdeaRowHtml(idea) {
  // Sprachen: idea.activity ist das deutsche Kategorie-Label (gespeichert, verglichen) — angezeigt
  // wird seine Übersetzung.
  const sub = [idea.personsHint || CATEGORIES.find((cat) => cat.label === idea.activity)?.anzeige || idea.activity, idea.listHint].filter(Boolean).join(' · ');
  return `<button data-act="sv-use" data-idea="${idea.id}" style="background:var(--paper);border-radius:16px;padding:13px 15px;display:flex;align-items:center;gap:11px;flex:none;width:100%;border:0;cursor:pointer;appearance:none;font-family:${FONT};color:var(--ink);text-align:left">
${savedIdeaIcon(idea)}
<div style="display:flex;flex-direction:column;gap:1px;flex:1;min-width:0;pointer-events:none"><span style="font-size:14px;font-weight:650;white-space:nowrap;overflow:hidden;text-overflow:ellipsis">${esc(istSpontan(idea) ? tx('Spontanes Treffen') : idea.title)}</span>${sub ? `<span style="font-size:12px;color:var(--ink-soft);white-space:nowrap;overflow:hidden;text-overflow:ellipsis">${esc(sub)}</span>` : ''}</div>
<span style="color:var(--line-strong);pointer-events:none">›</span></button>`;
}

// --- Gespeichert (v3.1 §8): kompakte Ordnerfilter oben, darunter EINE eindeutige Liste ---
// Ordner sind Filter derselben Menge: kein Eintrag erscheint gleichzeitig als Ordnerinhalt
// und in einer zweiten Liste. „Weitere" zeigt ausschließlich unzugeordnete Einträge.

function savedEntries(ctx, view, query = '') {
  const all = ctx.repo.getSavedIdeas(null);
  const scoped = view === 'all' ? all
    : view === 'unfiled' ? all.filter((idea) => !idea.folderId)
      : all.filter((idea) => idea.folderId === view);
  const q = String(query || '').trim().toLowerCase();
  if (!q) return scoped;
  return scoped.filter((idea) => `${idea.title} ${idea.activity || ''} ${idea.personsHint || ''} ${idea.note || ''}`
    .toLowerCase().includes(q));
}

// Ordner sind kompakte KARTEN in der Sprache der Crew-/Loop-Karten (F1/Ü5), keine Pillen:
// Icon-Kachel, Name, Anzahl. Die Reihe ist ein eigenes horizontales Control (edgeFadeRow).
// Auftrag §7: Alle Kacheln dieser Reihe sind gleich hoch — sonst springt die Reihe, sobald
// ein Text umbricht. Die Höhe steht EINMAL hier.
const SAVED_CARD_H = 62;

function savedFolderCard(options) {
  const { active, view, label, count, icon } = options;
  // v6 A08f: Der aktive Ordner war eine invertierte, vollschwarze Kachel mit schwarzem
  // Rahmen — die einzige Stelle der App mit beidem. Jetzt trägt er dieselbe ruhige grüne
  // Fläche wie die aktive „Was machen?"-Kachel; die Reihe bleibt lesbar statt dominiert.
  const box = active
    ? 'background:var(--green-tint);border:1.5px solid var(--green);color:var(--green-dark)'
    : 'background:var(--surface);border:1.5px solid var(--ink-a09);color:var(--ink)';
  const tile = active ? 'var(--surface)' : 'var(--paper)';
  const meta = active ? 'var(--green-dark)' : 'var(--muted)';
  return `<button data-act="sv-view" data-view="${esc(view)}" aria-pressed="${active}" style="${box};flex:none;width:128px;min-height:${SAVED_CARD_H}px;box-sizing:border-box;border-radius:18px;padding:11px 12px;display:flex;align-items:center;gap:9px;box-shadow:0 1px 2px var(--shadow-04);cursor:pointer;appearance:none;font-family:${FONT};text-align:left">
<span style="width:30px;height:30px;border-radius:10px;background:${tile};display:flex;align-items:center;justify-content:center;flex:none;pointer-events:none">${icon}</span>
<span style="display:flex;flex-direction:column;gap:1px;min-width:0;flex:1;pointer-events:none">
<span style="font-size:13px;font-weight:650;letter-spacing:-.01em;white-space:nowrap;overflow:hidden;text-overflow:ellipsis">${esc(label)}</span>
<span style="font-size:11px;font-weight:600;color:${meta};font-variant-numeric:tabular-nums;white-space:nowrap">${tnx(count, '{n} Idee', '{n} Ideen')}</span>
</span></button>`;
}

function savedFolderRowHtml(ctx, view) {
  const folders = ctx.repo.getSavedFolders();
  const all = ctx.repo.getSavedIdeas(null);
  const unfiled = all.filter((idea) => !idea.folderId).length;
  const ink = (active) => (active ? 'var(--green-dark)' : 'var(--ink)');
  const cards = [savedFolderCard({
    active: view === 'all', view: 'all', label: tx('Alle'), count: all.length, icon: bookmarkIcon(ink(view === 'all'), 16),
  })];
  for (const folder of folders) {
    cards.push(savedFolderCard({
      active: view === folder.id, view: folder.id, label: folder.name,
      count: ctx.repo.getSavedIdeas(folder.id).length, icon: folderIcon(ink(view === folder.id), 17),
    }));
  }
  // „Weitere" enthält ausschließlich nicht zugeordnete Einträge — nie Kopien aus einem Ordner.
  if (unfiled) {
    cards.push(savedFolderCard({
      active: view === 'unfiled', view: 'unfiled', label: tx('Weitere'), count: unfiled, icon: folderIcon(ink(view === 'unfiled'), 17),
    }));
  }
  // Auftrag §7: Der Text lief aus der Box. Er stand mit `white-space:nowrap` NEBEN dem
  // Pluszeichen — bei 128 px Breite blieben dafür 63 px, „Neuer Ordner" braucht rund 85.
  // Jetzt steht das Zeichen ÜBER dem Text (wie bei der Crew-Kachel), der Text darf
  // umbrechen, und die Kachel ist so hoch wie die Ordner-Karten daneben. Damit passt
  // jede Sprache hinein — auch „Neue collection de dossiers".
  cards.push(`<button data-act="sv-newfolder" style="flex:none;width:128px;min-height:${SAVED_CARD_H}px;border:1.5px dashed var(--ink-a20);border-radius:18px;padding:11px 12px;display:flex;flex-direction:column;align-items:flex-start;justify-content:center;gap:8px;background:transparent;cursor:pointer;appearance:none;font-family:${FONT};color:var(--ink-soft);text-align:left;box-sizing:border-box">
<span style="width:30px;height:30px;border-radius:10px;background:var(--paper);display:flex;align-items:center;justify-content:center;flex:none;font-size:17px;font-weight:600;line-height:1;pointer-events:none">+</span>
<span style="font-size:12.5px;font-weight:650;line-height:1.25;text-wrap:pretty;pointer-events:none">${tx('Neuer Ordner')}</span></button>`);
  return edgeFadeRow(cards.join(''), { gap: 9, padY: '2px 0 2px', scrollKey: 'sv-folders' });
}

// Suche bleibt sichtbar (Vertrag §6) und filtert innerhalb der gewählten Ordnersicht.
function savedSearchHtml(query) {
  return `<label style="margin:0 20px;background:var(--paper);border:1px solid var(--ink-a07);border-radius:999px;padding:10px 15px;display:flex;align-items:center;gap:9px;cursor:text">
${searchSmallIcon('var(--muted)', 14)}
<input data-role="sv-search" value="${esc(query || '')}" placeholder="${esc(tx('Gespeichertes suchen …'))}" style="flex:1;min-width:0;border:0;outline:none;background:transparent;font:600 13.5px ${FONT};color:var(--ink);padding:0">
</label>`;
}

function savedEmptyText(view) {
  if (view === 'unfiled') return tx('Alles liegt in Ordnern');
  if (view !== 'all') return tx('Dieser Ordner ist noch leer');
  return tx('Noch keine Vorlagen gespeichert');
}

function savedListHtml(ctx, view, query = '') {
  const items = savedEntries(ctx, view, query);
  const inner = items.length
    ? items.map(savedIdeaRowHtml).join('')
    : `<div style="padding:10px 2px;font-size:13px;color:var(--muted);flex:none">${esc(String(query || '').trim() ? tx('Nichts gefunden') : savedEmptyText(view))}</div>`;
  return `<div data-role="sv-items" style="display:flex;flex-direction:column;gap:8px">${inner}</div>`;
}

// --- Gespeichert als volles Sheet (Runde 3) --------------------------------------------
// Jonathan I3: „Die gespeicherten Elemente direkt als Slide-up, das alles bedeckt, nicht nur den
// unteren Rand." Das Sheet öffnet deshalb gleich in voller Höhe (bis knapp unter die
// Statusleiste). Vorher begann es bei 54 % und musste erst hochgezogen werden.
//
// Gesten — Maus, Stift und Finger über denselben Zeiger-Pfad mit Pointer Capture:
//   · senkrecht: der Inhalt scrollt. Wer oben angekommen weiter nach unten zieht, nimmt das
//     Sheet mit; über SAVED_ZU_PX (oder mit Schwung) geht es zu, sonst federt es zurück. Beginnt
//     der Zug mitten in der Liste, braucht es erst UEBERGABE_PX Weg über den Anfang hinaus —
//     sonst zöge man das Sheet mit, obwohl man nur zum ersten Eintrag zurück wollte (v7 A14a).
//   · waagerecht auf der Ordnerreihe: die Reihe folgt dem Finger UND der gezogenen Maus, mit
//     Schwung beim Loslassen; auch das senkrechte Mausrad schiebt sie. Vorher ging nur das Rad
//     (Jonathan: „Ich kann nicht nach links und rechts wischen") — [data-layerbox] trägt
//     touch-action:none, damit das Sheet seine Gesten selbst führt, und so nahm der Browser der
//     Reihe auch das native Wischen.
// Das Sheet wird über `translate` bewegt, nicht über `transform`: Die Einfahr-Animation hält
// transform per fill-mode fest und würde jeden eigenen Wert überdecken.
const SAVED_TOP_GAP = 64;
const SAVED_ZU_PX = 120;
const UEBERGABE_PX = 56;

function bindSavedSheet(root, ctx, schliessen) {
  const box = root.querySelector('[data-sv-sheet] [data-layerbox]');
  const scroll = box?.querySelector(':scope > [data-layerscroll]');
  if (!box || !scroll) return;
  // Der Kasten überlebt viele Zeichnungen (In-Place-Abgleich) — seine Gesten werden genau einmal
  // angemeldet; was sich ändern kann, liest er beim Ereignis frisch.
  box.__crewSchliessen = schliessen;
  if (box.__crewGespeichert) return;
  box.__crewGespeichert = true;

  const reihe = () => box.querySelector('[data-hdrag="row"]');
  const scrim = () => box.parentElement?.querySelector(':scope > [data-act]');
  let zug = null;
  let versatz = 0;
  let swallowUntil = 0;

  const setVersatz = (wert, weich = false) => {
    versatz = Math.max(0, wert);
    box.style.transition = weich ? 'translate .22s cubic-bezier(.22,.61,.36,1)' : 'none';
    box.style.translate = versatz ? `0 ${Math.round(versatz)}px` : '';
    const s = scrim();
    if (s) {
      s.style.transition = weich ? 'opacity .22s ease-out' : 'none';
      s.style.opacity = versatz ? String(Math.max(0, 1 - versatz / (box.offsetHeight || 1))) : '';
    }
  };

  const schwung = (v0) => {
    const r = reihe();
    if (!r || Math.abs(v0) < 1) return;
    let v = Math.max(-60, Math.min(60, v0));
    const schritt = () => {
      if (Math.abs(v) < 0.4) return;
      r.scrollLeft -= v;
      v *= 0.93;
      window.requestAnimationFrame(schritt);
    };
    window.requestAnimationFrame(schritt);
  };

  // Nach einem echten Zug darf der Loslass-Klick keine Karte öffnen. Das Zeitfenster ist eng,
  // damit ein späterer echter Klick nie verschluckt wird.
  box.addEventListener('click', (event) => {
    if (Date.now() > swallowUntil) return;
    swallowUntil = 0;
    event.stopPropagation();
    event.preventDefault();
  }, true);

  box.addEventListener('pointerdown', (event) => {
    if (event.button !== undefined && event.button !== 0) return;
    if (event.target.closest('input,textarea')) return;
    const r = reihe();
    zug = {
      id: event.pointerId,
      x0: event.clientX, y0: event.clientY, x: event.clientX, y: event.clientY,
      modus: null,
      inReihe: Boolean(r && r.contains(event.target)),
      vonOben: scroll.scrollTop <= 0,
      konto: 0, v: 0, t: performance.now(),
    };
  });

  box.addEventListener('pointermove', (event) => {
    if (!zug || event.pointerId !== zug.id) return;
    if (!zug.modus) {
      const gx = event.clientX - zug.x0;
      const gy = event.clientY - zug.y0;
      if (Math.max(Math.abs(gx), Math.abs(gy)) < 5) return;
      zug.modus = zug.inReihe && Math.abs(gx) > Math.abs(gy) ? 'x' : 'y';
      box.setPointerCapture?.(zug.id);
    }
    const dx = event.clientX - zug.x;
    const dy = event.clientY - zug.y;
    const jetzt = performance.now();
    const dt = Math.max(1, jetzt - zug.t);
    zug.t = jetzt;
    zug.x = event.clientX;
    zug.y = event.clientY;
    event.preventDefault();
    if (zug.modus === 'x') {
      const r = reihe();
      if (r) r.scrollLeft -= dx;
      zug.v = zug.v * 0.5 + ((dx / dt) * 16) * 0.5;
      return;
    }
    zug.v = zug.v * 0.5 + ((dy / dt) * 16) * 0.5;
    if (dy < 0) {
      // aufwärts: erst das Sheet zurück an seinen Platz, dann den Inhalt scrollen
      zug.konto = 0;
      const zurueck = Math.min(-dy, versatz);
      if (zurueck) setVersatz(versatz - zurueck);
      const rest = -dy - zurueck;
      if (rest) scroll.scrollTop += rest;
    } else if (dy > 0) {
      // abwärts: erst zurückscrollen, dann (mit Schwelle) das Sheet mitnehmen
      const back = Math.min(dy, scroll.scrollTop);
      if (back) scroll.scrollTop -= back;
      let rest = dy - back;
      if (!rest) return;
      if (!zug.vonOben && zug.konto < UEBERGABE_PX) {
        const nimm = Math.min(rest, UEBERGABE_PX - zug.konto);
        zug.konto += nimm;
        rest -= nimm;
      }
      if (rest) setVersatz(versatz + rest);
    }
  });

  const ende = (event) => {
    if (!zug || (event && event.pointerId !== zug.id)) return;
    const { modus, v } = zug;
    zug = null;
    if (!modus) return;
    swallowUntil = Date.now() + 400;
    if (modus === 'x') { schwung(v); return; }
    if (!versatz) return;
    if (versatz > SAVED_ZU_PX || (v > 8 && versatz > 24)) {
      setVersatz((box.offsetHeight || 800) + 40, true);
      window.setTimeout(() => box.__crewSchliessen?.(), 200);
    } else {
      setVersatz(0, true);
    }
  };
  box.addEventListener('pointerup', ende);
  box.addEventListener('pointercancel', ende);

  // Das Mausrad über der Ordnerreihe schiebt die Reihe; ein waagerechtes Rad (Trackpad) bleibt nativ.
  box.addEventListener('wheel', (event) => {
    const r = reihe();
    if (!r || !r.contains(event.target)) return;
    if (Math.abs(event.deltaY) <= Math.abs(event.deltaX)) return;
    r.scrollLeft += event.deltaY;
    event.preventDefault();
  }, { passive: false });
}

function saveActionRowHtml(hasDraft) {
  if (!hasDraft) return '';
  return `<button data-act="sv-save" style="border:1.5px dashed var(--green-a45);border-radius:16px;padding:13px 15px;display:flex;align-items:center;justify-content:center;gap:9px;flex:none;width:100%;background:var(--surface);cursor:pointer;appearance:none;font-family:${FONT}">
${bookmarkPlusIcon('var(--green-dark)', 16)}
<span style="font-size:13.5px;font-weight:650;color:var(--green-dark);pointer-events:none">${tx('Aktuellen Entwurf speichern')}</span>
</button>`;
}

const saveSheetSnapshot = (saveUi) => ({ folderId: saveUi?.folderId ?? null, include: { ...(saveUi?.include || {}) } });

function renderSaved(ctx) {
  const { repo, ui } = ctx;
  // Wie alle newMeet-Routen: fehlt der Entwurf, entsteht er sofort — dahinter steht dann
  // der echte Composer statt einer leeren Fläche, und „Entwurf speichern" bleibt sichtbar.
  const { draft, replaced } = ensureDraft(ctx);
  const folders = repo.getSavedFolders();
  const view = ui.view || 'all';
  const query = ui.query || '';
  const saveGuard = dirtyGuard(ctx, 'nm-save');

  let overlay = '';
  if (ui.sub === 'confirm' && ui.confirm) {
    const c = ui.confirm;
    overlay = `<div style="position:absolute;inset:0;z-index:15">
<div data-act="sv-ok" style="position:absolute;inset:0;background:var(--ink-a28)"></div>
<div style="position:absolute;left:0;right:0;bottom:0;background:var(--surface);border-radius:28px 28px 0 0;padding:16px 22px 30px;display:flex;flex-direction:column;gap:14px;box-shadow:0 -8px 24px var(--shadow-18)">
<span style="width:36px;height:4px;border-radius:2px;background:var(--handle);align-self:center;flex:none"></span>
<div style="display:flex;align-items:center;gap:13px">
<span style="width:44px;height:44px;border-radius:14px;background:var(--green-tint);display:flex;align-items:center;justify-content:center;flex:none">${bookmarkCheckIcon('var(--green-dark)', 20)}</span>
<div style="display:flex;flex-direction:column;gap:2px;flex:1;min-width:0">
<span style="font-size:16px;font-weight:650;letter-spacing:-.01em;white-space:nowrap;overflow:hidden;text-overflow:ellipsis">${esc(c.folderName ? tx('In {ordner} gespeichert', { ordner: c.folderName }) : tx('Vorlage gespeichert'))}</span>
<span style="font-size:12.5px;color:var(--muted);white-space:nowrap;overflow:hidden;text-overflow:ellipsis">${esc(c.sub)}</span>
</div>
<span style="width:30px;height:30px;border-radius:50%;background:var(--green);display:flex;align-items:center;justify-content:center;flex:none"><svg width="15" height="15" viewBox="0 0 24 24" fill="none"><path d="m6 12.5 4 4L18 8" stroke="var(--on-accent)" stroke-width="2.6" stroke-linecap="round" stroke-linejoin="round"></path></svg></span>
</div>
<div style="display:flex;gap:9px">
<button data-act="sv-undo" style="flex:1;border:1.5px solid var(--ink-a14);color:var(--ink-soft);font:650 14px/1 ${FONT};padding:13px 0;border-radius:999px;text-align:center;background:transparent;cursor:pointer;appearance:none">${tx('Rückgängig')}</button>
<button data-act="sv-ok" style="flex:1.3;background:var(--green);color:var(--on-accent);font:650 14px/1 ${FONT};padding:14px 0;border-radius:999px;text-align:center;border:0;cursor:pointer;appearance:none">${tx('Passt')}</button>
</div>
</div></div>`;
  } else if (ui.sub === 'newFolder') {
    overlay = nmPanel({
      title: tx('Neuer Ordner'),
      closeAct: 'sv-newfolder-cancel',
      scrollKey: 'sv-newfolder',
      gap: 14,
      body: `<div style="display:flex;flex-direction:column;gap:7px">
<span style="${labelStyle}">${tx('Name')}</span>
<div style="background:var(--surface);border:1.5px solid var(--green-a50);border-radius:16px;padding:15px 16px;display:flex;align-items:center;gap:9px"><input data-role="sv-folder-name" style="font:650 16px ${FONT};color:var(--ink);flex:1;min-width:0;border:0;outline:none;background:transparent;padding:0"></div>
</div>
<div style="display:flex;align-items:center;gap:10px;background:var(--paper);border-radius:14px;padding:12px 14px">${folderIcon('var(--muted)', 17)}<span style="font-size:11.5px;color:var(--muted);line-height:1.45;flex:1">${tx('Eine Ebene, keine Unterordner. Neue Ordner erscheinen sofort als Filter und im Speichern-Sheet.')}</span></div>`,
      bottom: panelBottom(`<div style="display:flex;gap:8px">
<button data-act="sv-newfolder-cancel" style="flex:1;border:1.5px solid var(--ink-a14);color:var(--ink-soft);font:650 14px/1 ${FONT};padding:13px 0;border-radius:999px;text-align:center;background:transparent;cursor:pointer;appearance:none">${tx('Abbrechen')}</button>
<button data-act="sv-newfolder-create" style="flex:1.4;background:var(--green);color:var(--on-accent);font:650 14px/1 ${FONT};padding:14px 0;border-radius:999px;text-align:center;border:0;cursor:pointer;appearance:none">${tx('Ordner erstellen')}</button>
</div>`),
    });
  } else if (ui.sub === 'save' && draft) {
    overlay = saveSheetHtml(ctx, draft);
  } else {
    // 08.7/08.8 als zweistufiges Sheet (D5/F1): Suche und Ordnerkarten im Kopf, EINE
    // eindeutige Liste darunter, „Aktuellen Entwurf speichern" ganz unten beim Daumen.
    overlay = nmPanel({
      title: tx('Gespeichert'),
      mark: 'data-sv-sheet',
      // Runde 3 (I3): gleich in voller Höhe — das Sheet deckt alles bis unter die Statusleiste.
      height: `calc(100% - ${SAVED_TOP_GAP}px)`,
      // D4-2: Das Sheet steuert Höhe UND Scrollen selbst — deshalb darf der Browser die
      // vertikale Touch-Geste nicht übernehmen. touch-action:none steht direkt am Kasten
      // (nicht nur zentral in styles.css), sonst feuert der Compositor pointercancel und
      // Touch bliebe nach wenigen Pixeln stehen, während die Maus weiterzieht.
      // Die horizontale Ordnerreihe im Kopf behält ihre eigene Geste (edgeFadeRow).
      boxExtra: 'touch-action:none;',
      scrollExtra: 'touch-action:none;',
      fade: true,
      scrollKey: 'sv-list',
      gap: 8,
      header: `${savedSearchHtml(query)}${savedFolderRowHtml(ctx, view)}`,
      body: savedListHtml(ctx, view, query),
      bottom: panelBottom(saveActionRowHtml(true)),
    });
  }

  // Verlassen: normal zurück in den Composer; beim Direkteinstieg (kein Stack) an dessen Stelle.
  const leaveSaved = (c) => {
    if (c.nav.depth() > 1) c.nav.back();
    else c.nav.replace('newMeet.discover', { draftId: draft.id });
  };

  return {
    html: composerScaffold(ctx, draft, `${overlay}${discardSheet(ctx)}`),
    bind(root, c) {
      const search = root.querySelector('[data-role="sv-search"]');
      if (search) {
        search.addEventListener('input', () => {
          ui.query = search.value;
          const list = root.querySelector('[data-role="sv-items"]');
          if (list) list.outerHTML = savedListHtml(c, ui.view || 'all', ui.query);
        });
        search.addEventListener('keydown', (event) => { if (event.key === 'Enter') search.blur(); });
      }
      bindActions(root, discardActions(c));
      bindActions(root, {
        'sheet-close': () => leaveSaved(c),
        'sv-view': (data) => { ui.view = data.view; c.render(); },
        'sv-newfolder': () => { ui.newFolderFrom = ui.sub === 'save' ? 'save' : 'list'; ui.sub = 'newFolder'; c.render(); },
        'sv-newfolder-cancel': () => { ui.sub = ui.newFolderFrom === 'save' ? 'save' : null; c.render(); },
        'sv-newfolder-create': () => {
          const name = (root.querySelector('[data-role="sv-folder-name"]')?.value || '').trim();
          if (!name) { c.toast(tx('Erst einen Namen eingeben')); return; }
          const folder = c.repo.createFolder(name);
          if (ui.newFolderFrom === 'save') {
            ui.sub = 'save';
            if (ui.saveUi) { ui.saveUi.folderId = folder.id; ui.saveUi.dropdown = false; }
          } else {
            ui.sub = null;
            ui.view = folder.id;
          }
          // createFolder rendert bereits — der neue ui-Zustand braucht einen zweiten Durchlauf.
          c.render();
        },
        'sv-save': () => {
          // v6 A18c: Eine Vorlage braucht nur die Idee — die Teilnehmerpflicht gilt fürs
          // SENDEN, nicht fürs Speichern. Sonst ließe sich keine Vorlage mehr anlegen.
          if (!draftHatIdee(c.repo.getDraft(draft.id) || draft)) { c.toast(tx('Erst eine Idee wählen')); return; }
          ui.sub = 'save';
          ui.saveUi = {
            folderId: folders[0]?.id ?? null,
            dropdown: false,
            include: { ort: Boolean(draft.place && draft.place.mode !== 'person'), zeit: false, personen: false },
          };
          saveGuard.reset(saveSheetSnapshot(ui.saveUi));
          c.render();
        },
        'sv-dropdown': () => { ui.saveUi.dropdown = !ui.saveUi.dropdown; c.render(); },
        'sv-pickfolder': (data) => {
          ui.saveUi.folderId = data.folder === 'none' ? null : data.folder;
          ui.saveUi.dropdown = false;
          c.render();
        },
        'sv-inc': (data) => { ui.saveUi.include[data.k] = !ui.saveUi.include[data.k]; c.render(); },
        // Ü4: geändertes Speichern-Sheet fragt nach, unverändertes schließt direkt.
        'sv-save-cancel': () => {
          const closeSave = () => { ui.sub = null; };
          if (!saveGuard.confirm(saveSheetSnapshot(ui.saveUi), closeSave)) return;
          closeSave();
          c.render();
        },
        'sv-save-confirm': () => {
          const fresh = c.repo.getDraft(draft.id);
          const w = withLabel(c, fresh);
          const inc = ui.saveUi.include;
          const withOrt = inc.ort && fresh.place && fresh.place.mode !== 'person';
          const withZeit = inc.zeit && fresh.when;
          const withPersonen = inc.personen && (fresh.withCrewId || fresh.withPersonIds?.length);
          const saved = c.repo.saveIdea({
            title: fresh.idea.title,
            icon: fresh.idea.icon || null,
            activity: categoryLabel(fresh.idea.category) || tx('Aktivität'),
            personsHint: withPersonen ? w.value : '',
            listHint: '',
            timeHint: withZeit ? whenText(fresh) : '',
            when: withZeit ? { ...fresh.when } : null,
            withCrewId: withPersonen ? fresh.withCrewId : null,
            withPersonIds: withPersonen ? [...(fresh.withPersonIds || [])] : [],
            place: withOrt ? { ...fresh.place } : null,
            note: fresh.note || '',
          }, { folderId: ui.saveUi.folderId });
          // Sprachen: ganze Sätze statt einer zusammengesetzten Aufzählung.
          const parts = [withOrt && 'o', withZeit && 'z', withPersonen && 'p'].filter(Boolean).join('');
          const partText = {
            '': tx('Nur die Aktivität übernommen'),
            o: tx('Ort übernommen'),
            z: tx('Zeit übernommen'),
            p: tx('Personen übernommen'),
            oz: tx('Ort und Zeit übernommen'),
            op: tx('Ort und Personen übernommen'),
            zp: tx('Zeit und Personen übernommen'),
            ozp: tx('Ort, Zeit und Personen übernommen'),
          }[parts];
          ui.confirm = {
            savedId: saved.id,
            folderName: folders.find((f) => f.id === ui.saveUi.folderId)?.name || '',
            sub: `${fresh.idea.title} · ${partText}`,
          };
          // Der neue Eintrag ist danach genau in EINER Sicht zu finden — dort steht der Filter.
          ui.view = ui.saveUi.folderId || 'unfiled';
          ui.query = '';
          ui.sub = 'confirm';
          ui.confirmTimerSet = false;
          saveGuard.clear();
          c.render();
        },
        'sv-undo': () => {
          if (ui.confirm?.savedId) c.repo.removeSavedIdea(ui.confirm.savedId);
          leaveSaved(c);
        },
        'sv-ok': () => leaveSaved(c),
        'sv-use': (data) => {
          const idea = c.repo.getSavedIdeas(null).find((entry) => entry.id === data.idea);
          if (!idea) return;
          // Vorlage übernimmt Titel, Aktivität, Ort, Notiz (+ Zeit/Personen nur falls gespeichert)
          // — nie alte RSVPs (08.7).
          const category = CATEGORIES.find((cat) => cat.label === idea.activity)?.id || null;
          const patch = {
            idea: { title: idea.title, icon: idea.icon || null, category, details: '', source: 'saved', suggestionId: null, ownId: null },
            ideaAlternatives: [],
          };
          if (idea.place) patch.place = { ...idea.place, mode: idea.place.mode || 'search' };
          if (idea.note) patch.note = idea.note;
          if (idea.when) patch.when = { ...idea.when };
          if (idea.withCrewId) { patch.withCrewId = idea.withCrewId; patch.withPersonIds = []; }
          else if (idea.withPersonIds?.length) { patch.withCrewId = null; patch.withPersonIds = [...idea.withPersonIds]; }
          c.repo.updateDraft(draft.id, patch);
          leaveSaved(c);
        },
      });

      // 08.7c verschwindet von selbst; der Entwurf im Composer bleibt unverändert stehen.
      if (ui.sub === 'confirm' && !ui.confirmTimerSet) {
        ui.confirmTimerSet = true;
        window.setTimeout(() => {
          const current = c.nav.current();
          if (current.id === 'newMeet.saved' && ui.sub === 'confirm') leaveSaved(c);
        }, 4000);
      }
      scheduleReplace(c, draft, replaced);
      fitInsets(root);
      bindSavedSheet(root, c, () => leaveSaved(c));
    },
  };
}

// 08.7b „Entwurf speichern" — Ordner als eigener Dropdown-Button, dann die Schalter.
function saveSheetHtml(ctx, draft) {
  const ui = ctx.ui;
  const saveUi = ui.saveUi || { folderId: null, dropdown: false, include: { ort: true, zeit: false, personen: false } };
  const folders = ctx.repo.getSavedFolders();
  const folder = folders.find((f) => f.id === saveUi.folderId) || null;
  const folderCount = folder ? ctx.repo.getSavedIdeas(folder.id).length : null;

  const dropdown = saveUi.dropdown ? `<div style="position:absolute;left:0;right:0;top:calc(100% + 6px);background:var(--surface);border-radius:16px;border:1px solid var(--ink-a07);box-shadow:0 10px 28px var(--shadow-20);overflow:hidden;z-index:4">
${folders.map((f) => {
    const selected = f.id === saveUi.folderId;
    const count = ctx.repo.getSavedIdeas(f.id).length;
    return `<button data-act="sv-pickfolder" data-folder="${f.id}" style="display:flex;align-items:center;gap:10px;padding:12px 15px;width:100%;border:0;background:${selected ? 'var(--green-tint)' : 'transparent'};border-bottom:1px solid var(--ink-a06);cursor:pointer;appearance:none;font-family:${FONT}">
<span style="font-size:13.5px;font-weight:${selected ? 650 : 600};color:${selected ? 'var(--green-dark)' : 'var(--ink)'};flex:1;text-align:left;pointer-events:none">${esc(f.name)}</span>
<span style="font-size:11px;font-weight:650;color:${selected ? 'var(--green-dark)' : 'var(--muted-light)'};font-variant-numeric:tabular-nums;pointer-events:none">${count}</span>
${selected ? '<svg width="13" height="13" viewBox="0 0 24 24" fill="none" style="pointer-events:none"><path d="m5 12.5 4.5 4.5L19 7.5" stroke="var(--green-dark)" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round"></path></svg>' : ''}
</button>`;
  }).join('')}
<button data-act="sv-pickfolder" data-folder="none" style="display:flex;align-items:center;gap:10px;padding:12px 15px;width:100%;border:0;background:${saveUi.folderId == null ? 'var(--green-tint)' : 'transparent'};border-bottom:1px solid var(--ink-a06);cursor:pointer;appearance:none;font-family:${FONT}"><span style="font-size:13.5px;font-weight:600;color:var(--ink-soft);flex:1;text-align:left;pointer-events:none">${tx('Kein Ordner')}</span></button>
<button data-act="sv-newfolder" style="display:flex;align-items:center;gap:10px;padding:12px 15px;width:100%;border:0;background:transparent;cursor:pointer;appearance:none;font-family:${FONT}"><span style="font-size:13.5px;font-weight:650;color:var(--green-dark);flex:1;text-align:left;pointer-events:none">${tx('Neuer Ordner')}</span><span style="font-size:15px;color:var(--green-dark);line-height:1;pointer-events:none">+</span></button>
</div>` : '';

  const rows = [];
  if (draft.place && draft.place.mode !== 'person') {
    rows.push({
      k: 'ort', icon: pinIcon('var(--ink)', 16), main: draft.place.mode === 'mine' ? tx('Bei mir') : draft.place.name, label: tx('Ort'),
      on: saveUi.include.ort, extra: '',
    });
  }
  if (draft.when) {
    rows.push({ k: 'zeit', icon: clockIcon('var(--ink)', 16), main: whenText(draft), label: tx('Zeit'), on: saveUi.include.zeit, extra: '' });
  }
  if (draft.withCrewId || draft.withPersonIds?.length) {
    const w = withLabel(ctx, draft);
    let persons = [];
    let total = 0;
    if (draft.withCrewId) {
      const crew = ctx.repo.getCrew(draft.withCrewId);
      total = crew?.memberIds.length || 0;
      persons = (crew?.memberIds || []).map((id) => ctx.repo.getPerson(id)).filter(Boolean);
    } else {
      persons = draft.withPersonIds.map((id) => ctx.repo.getPerson(id)).filter(Boolean);
      total = persons.length;
    }
    const shown = persons.slice(0, 3);
    const rest = total - shown.length;
    // v7 spec/08 §1: auch dieser Stapel geht über die gemeinsame Primitive. Der weiße
    // Trenner sitzt als box-shadow AUSSEN am Kreis — so verkleinert er die Bildfläche
    // nicht und das Foto bleibt vollständig sichtbar.
    const stackSettings = ctx.repo.getSettings();
    const stackZelle = (inner) => `<span style="display:flex;margin-left:-7px;border-radius:50%;box-shadow:0 0 0 2px var(--surface);flex:none">${inner}</span>`;
    const stack = `<span style="display:flex;padding-left:7px;flex:none;pointer-events:none">${shown.map((p) => stackZelle(personAvatar(p, { size: 22, fontSize: 8.5, marker: personMarker(p.id, stackSettings) }))).join('')}${rest > 0 ? stackZelle(`<span style="width:22px;height:22px;border-radius:50%;background:var(--field);color:var(--muted);font:600 8.5px/22px ${FONT};text-align:center;display:block">+${rest}</span>`) : ''}</span>`;
    rows.push({ k: 'personen', icon: groupIcon('var(--ink)', 16), main: w.value, label: tx('Personen · {n}', { n: total }), on: saveUi.include.personen, extra: stack });
  }

  const rowsHtml = rows.map((r, i) => `<button data-act="sv-inc" data-k="${r.k}" style="display:flex;align-items:center;gap:11px;padding:11px 2px;border:0;${i ? 'border-top:1px solid var(--ink-a06);' : ''}width:100%;background:transparent;cursor:pointer;appearance:none;font-family:${FONT};color:var(--ink);text-align:left">
<span style="width:30px;height:30px;border-radius:10px;background:var(--paper);display:flex;align-items:center;justify-content:center;flex:none;pointer-events:none">${r.icon}</span>
<div style="display:flex;flex-direction:column;gap:1px;flex:1;min-width:0;pointer-events:none"><span style="font-size:14.5px;font-weight:650;letter-spacing:-.01em;white-space:nowrap;overflow:hidden;text-overflow:ellipsis">${esc(r.main)}</span><span style="font-size:10.5px;font-weight:600;letter-spacing:.04em;text-transform:uppercase;color:var(--muted-light)">${esc(r.label)}</span></div>
${r.extra}
${switchHtml(r.on)}
</button>`).join('');

  return nmPanel({
    title: tx('Entwurf speichern'),
    closeAct: 'sv-save-cancel',
    scrollKey: 'sv-save',
    gap: 16,
    dim: '.45',
    body: `<div style="display:flex;align-items:center;gap:12px">
<span style="width:44px;height:44px;border-radius:14px;background:var(--paper);display:flex;align-items:center;justify-content:center;flex:none">${activityIconSvg(iconBeschreibung(draft.idea || {}), 'var(--ink)', 20)}</span>
<div style="display:flex;flex-direction:column;gap:2px;flex:1;min-width:0"><span style="font-size:17px;font-weight:650;letter-spacing:-.01em;white-space:nowrap;overflow:hidden;text-overflow:ellipsis">${esc(istSpontan(draft.idea) ? tx('Spontanes Treffen') : draft.idea?.title || '')}</span><span style="font-size:11px;font-weight:600;letter-spacing:.04em;text-transform:uppercase;color:var(--muted-light)">${tx('Aktivität')}</span></div>
<span style="font-size:10px;font-weight:650;letter-spacing:.05em;text-transform:uppercase;color:var(--green-dark);background:var(--green-tint);padding:4px 8px;border-radius:6px;flex:none">${tx('immer dabei')}</span>
</div>
<div style="display:flex;flex-direction:column;gap:8px;position:relative">
<span style="${labelStyle};padding:0 2px">${tx('Ordner')}</span>
<button data-act="sv-dropdown" style="background:var(--paper);border:1.5px solid var(--ink-a08);border-radius:16px;padding:15px 16px;display:flex;align-items:center;gap:11px;width:100%;cursor:pointer;appearance:none;font-family:${FONT};color:var(--ink);text-align:left">
${folderIcon('var(--ink)', 18)}
<span style="font-size:15.5px;font-weight:650;flex:1;min-width:0;pointer-events:none;white-space:nowrap;overflow:hidden;text-overflow:ellipsis">${esc(folder ? folder.name : tx('Kein Ordner'))}</span>
${folderCount != null ? `<span style="font-size:12px;font-weight:650;color:var(--muted);font-variant-numeric:tabular-nums;flex:none;pointer-events:none">${folderCount}</span>` : ''}
<svg width="13" height="13" viewBox="0 0 24 24" fill="none" style="flex:none;pointer-events:none"><path d="m6 9.5 6 6 6-6" stroke="var(--ink)" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"></path></svg>
</button>
${dropdown}
</div>
${rows.length ? `<div style="display:flex;flex-direction:column;gap:2px">
<span style="${labelStyle};padding:0 2px 4px">${tx('Was die Vorlage mitnimmt')}</span>${rowsHtml}</div>` : ''}`,
    bottom: panelBottom(`<div style="display:flex;gap:8px">
<button data-act="sv-save-cancel" style="flex:1;border:1.5px solid var(--ink-a14);color:var(--ink-soft);font:650 14px/1 ${FONT};padding:13px 0;border-radius:999px;text-align:center;background:transparent;cursor:pointer;appearance:none">${tx('Abbrechen')}</button>
<button data-act="sv-save-confirm" style="flex:1.4;background:var(--green);color:var(--on-accent);font:650 14px/1 ${FONT};padding:14px 0;border-radius:999px;text-align:center;border:0;cursor:pointer;appearance:none">${tx('Speichern')}</button>
</div>`),
  });
}

export const newMeetScreens = {
  'newMeet.discover': renderComposer,
  'newMeet.what': renderWhat,
  'newMeet.ownIdea': renderWhat,
  'newMeet.suggestion': renderSuggestionRoute,
  'newMeet.when': renderWhen,
  'newMeet.place': renderPlace,
  'newMeet.mapPick': renderMapPick,
  'newMeet.note': renderNote,
  'newMeet.saved': renderSaved,
};
