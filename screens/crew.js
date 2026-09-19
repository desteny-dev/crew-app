// Bereich Crew: Suche, die markierten Leute als Reihe, EINE Chatliste — und die FREE-Reihe.
// Muster-Modul für alle Bereichs-Screens: render(ctx) → { html, bind(root, ctx) }.
//
// =====================================================================================
// Runde 8 (8a, Jonathan): „So viel Visual Noise weg wie möglich, so einheitlich wie möglich,
// nur das Nötigste."
// -------------------------------------------------------------------------------------
// R8-1  Von oben: Suche · die markierten Leute als Reihe · die Chatliste. Keine Box um die
//       Liste; zwischen zwei Chats nur ein kurzer, eingerückter Strich.
// R8-2  Die Form sagt die Art: Person rund, Gruppe eckig (kleinerer Eckradius), Meet-Chat =
//       Zeichen des Meets auf getönter Kachel (components.js meetKachel) + Name des Meets.
// R8-3  Zeile: Name · darunter NUR die letzte Nachricht · Zeit oben rechts · orange Zahl
//       rechts. Weg sind „Runde"-Pille, Namens-Pille („Schwester"), „läuft", „4 dabei",
//       „2/5 frei" und „Keine Zeit bis …" — wer frei ist, zeigt der grüne Punkt am Bild.
// R8-4  Kein „···" mehr in der Zeile: langes Drücken öffnet DAS Menü (profile.js friendMenu
//       bzw. crewMenu). Beim allerersten Mal sagt eine leise Zeile, dass es das gibt.
// R8-5  Wer frei ist, steht oben, danach zählt die letzte Nachricht. Nie unter dem Finger:
//       Solange die Liste rollt oder berührt wird, bleibt die gezeigte Reihenfolge; steht
//       sie still, rutscht der Eintrag sichtbar nach oben über die anderen.
// R8-6  Vergangene Meet-Chats stehen hinter „Vergangene Meets" ganz unten (Blatt von unten).
//       Nach dem Anlegen eines Meets mit genau einer Gruppe fragt chatWahl*, welcher Chat gilt.
// R8-8  Weg: die Gesichter der Freien am FREE-Knopf, Sponti samt Blatt (und damit „Hast du
//       Zeit?" auf dieser Seite), der grüne Punkt vor Gruppen und das kleine Häkchen neben
//       „See & Chill" — das war die Marke „angeheftet" (Runde 7 J8, pinnedIds). Die Reihe
//       oben zeigt jetzt nur die markierten Leute; Anheften gibt es hier nicht mehr.
// R8-9  freiReiheHtml(ctx): FREE mittig, rechts ein kleiner runder „+" für ein neues Meet.
//       Der Meet-Tab benutzt genau diese Reihe und bindFreiControl.
// R8-10 „+" oben rechts: Blatt mit „Freund hinzufügen" / „Neue Gruppe", darunter die
//       erhaltenen Anfragen (Annehmen / Ignorieren).
// R8-11 Eine neue Anfrage steht EINMAL groß oben (ui/anfragen-hinweis.js) und schrumpft zum
//       orangen Punkt am „+"; danach bleibt nur der Punkt.
// -------------------------------------------------------------------------------------
// Zusätze vom 19.09. (Jonathan: „Ich will, dass alles jetzt geändert wird.")
// R8-60 Die Anfrage-Karte legt sich ÜBER den Inhalt: rechte Hälfte der Suchleiste und der Reihe,
//       nichts rückt, alles andere bleibt bedienbar. Nach ~10 s wird sie in EINER Bewegung zum
//       Punkt am „+" (ui/anfragen-hinweis.js, Form „über"). Wer in die Suche tippt, braucht die
//       Stelle — dann fliegt sie sofort; wer das Blatt hinter „+" öffnet, sieht die Anfragen dort.
// R8-61 Jeder Punkt an einem Kreis kommt aus components.js › kreisPunkt(): der Punkt am „+", der
//       Mitteilungspunkt an den Bildern der Reihe (vorher eine 18-px-Zahl, jetzt so groß wie der
//       Frei-Punkt, ohne Zahl — die Zahl steht in der Zeile darunter; an Personen zeichnet ihn
//       personAvatar, an der Gruppenkachel diese Seite) und alle Punkte an den Bildern der Liste.
// R8-62 Unter dem Namen nur die Nachricht — kein Absender, nie „Du:". In Gruppen (und in
//       Meet-Chats, den Gruppen auf Zeit) „Name: Nachricht", der Name fett.
// =====================================================================================

import { esc, bindActions, rueckmeldung } from '../core/html.js';
import { roomIdForCrew, roomIdForPerson, ME } from '../data/ids.js';
// R8-6: Wie lange ein vergangener Meet-Chat bleibt, sagt die Datenschicht — der Satz im Blatt
// liest dieselbe Zahl (Namensraum: ein fehlender Export bricht so nicht das Modul).
import * as projektionen from '../data/projections.js';
import { weekdayShort, toISODate } from '../core/dates.js';
import {
  screenScaffold, leerZeile, bildVon, edgeFadeRow, TAB_HEADER_PAD_X, TAB_HEADER_HEIGHT,
  freiKreis, freiHoldOverlay, personAvatar, personMarker,
  tabHeader, sheet, discardSheet, discardActions,
} from '../ui/components.js';
// Runde 8: meetKachel (R8-2) und ein zentraler Eckradius für Gruppen kommen aus components.js.
// Gelesen über den Namensraum: Ein benannter Import, den es dort (noch) nicht gibt, bräche das
// ganze Modul — und mit ihm die Crew-Seite. So lädt sie in jedem Stand.
import * as bausteine from '../ui/components.js';
import { activityIconSvg } from '../ui/activity-icons.js';
import { plus, search } from '../ui/icons.js';
// Runde 6 (D4) gilt weiter: Das Menü einer Person ist EINE Bauform (profile.js friendMenu).
// Runde 8 (R8-4/R8-12): Für Gruppen gibt es dasselbe als crewMenu/crewMenuActs — gelesen über
// den Namensraum, aus demselben Grund wie oben.
import {
  friendMenu, friendMenuActs, markSheetActs, bindMarkSheetInputs,
  markSheet, markSwitchSheet, removeFriendSheet, blockSheet, reportSheet, blockActs, inviteUrl,
} from './profile.js';
import * as profil from './profile.js';
import { symbol } from '../ui/symbole.js';
// N5/N3: Der Teilen-Weg geht ausschliesslich ueber die ehrliche Tabelle in core/native.js.
import { kann, huellePlugin } from '../core/native.js';
import { t as tx, tn as tnx } from '../core/sprache.js';
// Runde 5 (P5, G1/G2): Mitteilungen einschalten (Karte oben) und hören, was in der offenen App ankommt.
import { mitteilungsKarte, mitteilungsKarteAktionen, pushLageAuffrischen, mitteilungenBeobachten } from '../ui/mitteilungen.js';
import { anfrageHinweisHtml, anfrageHinweisGesehen, anfrageHinweisIds, anfrageHinweisBinden, anfrageHinweisFliegen, anfrageHinweisBeenden } from '../ui/anfragen-hinweis.js';

// Seitenrand = Kopfachse (tabHeader). Bild, Name und Strich stehen daran.
const RAND = TAB_HEADER_PAD_X;
// Höhe der Bildspalte. Alle Arten teilen sie, damit Namen und Nachrichten auf einer Achse stehen.
const ZEILEN_BILD = 48;
const ZEILEN_LUECKE = 12;
// Der Trennstrich beginnt dort, wo der Text beginnt — eingerückt, nicht über die ganze Breite.
const STRICH_LINKS = RAND + ZEILEN_BILD + ZEILEN_LUECKE;

// Alles, was diese Seite an eigenen Regeln braucht, steht hier — nicht in styles.css (gemeinsames
// Gut). `hidden` gilt auch für Knöpfe mit eigenem display (Suche).
const SEITEN_STIL = `<style>
.r8a [hidden]{display:none!important}
.r8a-chats{position:relative}
.r8a-zeile{position:relative}
.r8a-knopf{-webkit-tap-highlight-color:transparent;transition:background-color .12s ease-out}
.r8a-knopf:active{background-color:var(--ink-a05)}
.r8a-knopf:focus-visible{outline:2px solid var(--green);outline-offset:-2px}
.r8a-strich{display:none;position:absolute;left:${STRICH_LINKS}px;right:${RAND}px;top:0;height:1px;background:var(--ink-a07);pointer-events:none}
.r8a-zeile:not([hidden])~.r8a-zeile .r8a-strich{display:block}
[data-lang-druck]{-webkit-touch-callout:none;-webkit-user-select:none;user-select:none}
[data-role="crew-suche-feld"]::placeholder{color:var(--muted-light);opacity:1}
[data-role="crew-suche-feld"]::-webkit-search-decoration,[data-role="crew-suche-feld"]::-webkit-search-cancel-button{-webkit-appearance:none;display:none}
[data-role="crew-suche-feld"]:placeholder-shown+[data-role="crew-suche-leeren"]{display:none!important}
@media (prefers-reduced-motion:reduce){.r8a-knopf{transition:none}}
</style>`;

// --- R8-61: EIN Punkt an einem Kreis -------------------------------------------------------------
// Jonathan: „EINE Regel für alle Punkte an Kreisen: Mittelpunkt auf dem Kreisrand unter 45°, Größe =
// fester Anteil des Kreisdurchmessers." Die Regel gehört components.js: kreisPunkt() zeichnet den
// Punkt, kreisMaske() stanzt seine durchsichtige Lücke (R8-7) aus der Fläche darunter. An einem
// Personenbild tut personAvatar beides selbst — auch für die Mitteilung (options.mitteilung). Diese
// Seite setzt Punkte nur dort, wo kein Personenbild ist: am „+" und an der Gruppenkachel.
// Gelesen über den Namensraum (siehe oben): Nur solange components.js die beiden nicht liefert,
// zeichnet der Rückfall denselben Punkt nach derselben Regel (Anteil MASS.punkt) — kein zweiter Look.
const kreisRegel = () => typeof bausteine.kreisPunkt === 'function' && typeof bausteine.kreisMaske === 'function';
const PUNKT_ANTEIL = () => Number(bausteine.MASS?.punkt) || 0.28;
const SPALT_ANTEIL = () => Number(bausteine.MASS?.spalt) || 0.05;
const r2 = (wert) => Math.round(wert * 100) / 100;

// Rückfall: Mittelpunkt in der Ecke `ecke` ('or' | 'ur' | 'ul' | 'ol') eines Kreises mit dem
// Durchmesser d, gemessen von der linken oberen Ecke seines Kastens.
function punktMitte(d, ecke) {
  const r = d / 2;
  const k = r * Math.SQRT1_2;
  return { x: ecke === 'or' || ecke === 'ur' ? r + k : r - k, y: ecke === 'or' || ecke === 'ol' ? r - k : r + k };
}

// Der Punkt, absolut in einem Träger von d × d. `attribute` sind seine Merkmale als fertiger Text.
function punktAmKreis(d, ecke, farbe, attribute) {
  if (kreisRegel()) return bausteine.kreisPunkt(d, ecke, { farbe, attribute, ebene: 6 });
  const g = r2(d * PUNKT_ANTEIL());
  const m = punktMitte(d, ecke);
  return `<span ${attribute} style="position:absolute;left:${r2(m.x - g / 2)}px;top:${r2(m.y - g / 2)}px;width:${g}px;height:${g}px;border-radius:50%;background:${farbe};box-sizing:border-box;pointer-events:none;z-index:6"></span>`;
}

// Die durchsichtige Lücke um den Punkt, gestanzt aus der Fläche des Trägers (nicht aus dem Punkt).
function lochMaske(d, ecke) {
  if (kreisRegel()) return bausteine.kreisMaske(d, [ecke]);
  const m = punktMitte(d, ecke);
  const innen = r2(d * (PUNKT_ANTEIL() / 2 + SPALT_ANTEIL()));
  const bild = `radial-gradient(circle ${r2(innen + 0.6)}px at ${r2(m.x)}px ${r2(m.y)}px, transparent ${innen}px, #000 ${r2(innen + 0.6)}px)`;
  return `-webkit-mask-image:${bild};mask-image:${bild};`;
}

// --- Bilder: Person rund, Gruppe eckig, Meet = Zeichen auf getönter Kachel (R8-2) ---------

// Ruhiger, neutraler Grund für das Monogramm einer Gruppe ohne eigenes Bild — derselbe
// Rückfallton wie im Gruppenprofil (room.js gruppenKreis).
const GRUPPE_NEUTRAL = 'var(--blue)';

// „Freitag-Crew" → „FC". Dieselbe Regel wie im Gruppenprofil (room.js crewInitials).
function gruppenMonogramm(name) {
  const worte = String(name || '').split(/[^\p{L}\d]+/u).filter(Boolean);
  return `${worte[0]?.[0] || ''}${worte[1]?.[0] || worte[0]?.[1] || ''}`.toUpperCase();
}

// R8-2: „Gruppe eckig mit KLEINEREM Eckradius." Runde 7 rundete mit 0,3 der Kantenlänge — das
// las sich neben den runden Personen fast wie ein Kreis. Die Ecke steht an EINER Stelle:
// styles.css [data-role="gruppen-bild"] (20 % der Kante). Die Kachel schreibt deshalb keinen
// eigenen Radius ins style-Attribut — dieselbe Regel gilt für room.js gruppenKreis (Raumkopf,
// Gruppenseite, Anlegen/Bearbeiten, „Mit wem", Profil).

function gruppenKachel(crew, size, { loch = false } = {}) {
  const bild = bildVon(crew);
  const inhalt = bild
    ? `<img src="${esc(bild)}" alt="" aria-hidden="true" style="width:100%;height:100%;object-fit:cover;display:block">`
    : `<span style="display:flex;align-items:center;justify-content:center;width:100%;height:100%;color:var(--on-accent);font:600 ${Math.round(size * 0.36)}px/1 'Instrument Sans',sans-serif">${esc(gruppenMonogramm(crew?.name))}</span>`;
  return `<span data-role="gruppen-bild" style="flex:none;display:block;width:${size}px;height:${size}px;overflow:hidden;background:${crew?.color || GRUPPE_NEUTRAL};${loch ? lochMaske(size, 'or') : ''}">${inhalt}</span>`;
}

// R8-2: Das Bild eines Meet-Chats ist das Zeichen des Meets — im selben Look wie im Kalender.
// Die Bauform gehört components.js (meetKachel). Bis sie dort steht, zeichnet der Rückfall
// dieselbe Zutat (activityIconSvg) auf der ruhigen Feldfarbe — nur damit die Zeile nie ohne
// Bild dasteht, kein eigener zweiter Look.
function meetBild(meet, size) {
  if (typeof bausteine.meetKachel === 'function') return bausteine.meetKachel(meet || {}, size);
  return `<span data-role="meet-kachel" style="flex:none;display:flex;align-items:center;justify-content:center;width:${size}px;height:${size}px;border-radius:30%;background:var(--field)">${activityIconSvg(meet || {}, 'var(--ink)', Math.round(size * 0.46))}</span>`;
}

// 'runde' ist der Name aus Runde 7; die Datenschicht sagt seit Runde 8 'meet'. Beides ist
// dieselbe Sache — die Seite nimmt beide, damit sie in keinem Zwischenstand bricht.
const istMeetChat = (eintrag) => eintrag?.art === 'meet' || eintrag?.art === 'runde';
const zeilenArt = (eintrag) => (istMeetChat(eintrag) ? 'meet' : eintrag.art);

function zeilenBild(ctx, eintrag, settings, groesse = ZEILEN_BILD, extra = {}) {
  if (eintrag.art === 'gruppe') return gruppenKachel(eintrag.crew, groesse);
  if (istMeetChat(eintrag)) return meetBild(eintrag.meet, groesse);
  return personAvatar(eintrag.person, { size: groesse, marker: personMarker(eintrag.id, settings), ...extra });
}

// --- Kleine Bausteine -----------------------------------------------------------------------

// Wer gerade wirklich frei ist (nicht erst „frei ab", nicht schon in einem Meet).
const istJetztFrei = (person) => Boolean(person?.free?.active && !person.free.pending && !person.activeMeetId);

function orangeZahl(zahl) {
  return `<span data-role="temp-neu" style="flex:none;min-width:20px;height:20px;border-radius:10px;background:var(--orange);color:var(--on-accent);font:650 11px/20px 'Instrument Sans',sans-serif;text-align:center;padding:0 6px;box-sizing:border-box;pointer-events:none">${zahl}</span>`;
}

// Zeit der letzten Nachricht, kurz wie in jeder Chatliste: heute die Uhrzeit, gestern
// „Gestern", diese Woche der Wochentag, davor das Datum. Ohne Nachricht steht nichts da —
// eine erfundene Zeit wäre schlimmer als keine.
function zeitKurz(ms) {
  const wert = Number(ms) || 0;
  if (!wert) return '';
  const wann = new Date(wert);
  if (Number.isNaN(wann.getTime())) return '';
  const tagAnfang = (d) => new Date(d.getFullYear(), d.getMonth(), d.getDate()).getTime();
  const tage = Math.round((tagAnfang(new Date()) - tagAnfang(wann)) / 86400000);
  if (tage <= 0) return `${String(wann.getHours()).padStart(2, '0')}:${String(wann.getMinutes()).padStart(2, '0')}`;
  if (tage === 1) return tx('Gestern');
  if (tage < 7) return weekdayShort(toISODate(wann));
  return `${wann.getDate()}.${wann.getMonth() + 1}.`;
}

// Die Datenschicht gibt jedem Meet-Chat einen Namen (Titel, sonst die Leute). Nur falls eine
// ältere Fassung ihn leer lässt, stehen hier die Leute — erfunden wird nichts.
function eintragName(ctx, eintrag) {
  const name = String(eintrag.name || '').trim();
  if (name || !istMeetChat(eintrag)) return name;
  const leute = (eintrag.personIds || []).filter((id) => id !== ME).map((id) => ctx.repo.getPerson(id)?.name).filter(Boolean);
  return leute.join(', ') || tx('Meet');
}

// R8-3: Unter dem Namen steht NUR die letzte Nachricht.
// R8-62 (Jonathan): „ohne Absender und ohne ‚Du:' — außer in Gruppen: dort ‚Name: Nachricht', der
// Name fett, die Nachricht normal." Im Chat mit EINER Person ist klar, wer schreibt. Ein Meet-Chat
// ist eine Gruppe auf Zeit (R8-6: es gibt ihn nur für gemischte Runden, also immer mit mehreren
// anderen) — dort gilt dasselbe wie in der Gruppe: Man muss wissen, wer was gesagt hat. Eigene
// Nachrichten tragen nirgends ein Präfix; was man selbst geschrieben hat, erkennt man am Text.
function vorschau(ctx, eintrag) {
  const nachricht = eintrag.letzte;
  const text = String(nachricht?.text || '').replace(/\s+/g, ' ').trim();
  if (!text) return null;
  if (eintrag.art === 'person' || nachricht.authorId === ME) return { text, absender: '' };
  const absender = String(ctx.repo.getPerson(nachricht.authorId)?.name || '').trim().split(/\s+/)[0] || '';
  return { text, absender };
}

// „Name: Nachricht" — Doppelpunkt und Abstand kommen aus der Übersetzung (Französisch
// „{name} : {text}"). Fett ist der Name samt Doppelpunkt; die Nachricht behält das Gewicht der Zeile.
function vorschauHtml(v, unread) {
  if (!v) return '';
  if (!v.absender) return esc(v.text);
  const vorlage = tx('{name}: {text}');
  const stelle = vorlage.indexOf('{text}');
  const vor = stelle >= 0 ? vorlage.slice(0, stelle) : '{name}: ';
  const nach = stelle >= 0 ? vorlage.slice(stelle + '{text}'.length) : '';
  const kopf = vor.trimEnd();
  return `<span data-role="chat-absender" style="font-weight:${unread ? 700 : 650}">${esc(kopf.replace('{name}', () => v.absender))}</span>${esc(vor.slice(kopf.length))}${esc(v.text)}${esc(nach)}`;
}

// --- Suche (R8-1): filtert die Chatliste UND die Reihe --------------------------------------
// Gefiltert wird am vorhandenen Markup (hidden), nicht über einen neuen Render: Das Feld behält
// Fokus und Tastatur, und jeder spätere Render zeichnet aus ui.suche genau dasselbe.
function suchNorm(text) {
  return String(text || '').toLocaleLowerCase('de').normalize('NFD').replace(/[̀-ͯ]/g, '').trim();
}
const passt = (suchText, begriff) => !begriff || String(suchText || '').includes(begriff);

function sucheAnwenden(seite, roh) {
  if (!seite) return;
  const begriff = suchNorm(roh);
  let treffer = 0;
  seite.querySelectorAll('[data-role="chat-liste"] > [data-role="chat-zeile"]').forEach((zeile) => {
    const ja = passt(zeile.dataset.suche, begriff);
    zeile.hidden = !ja;
    if (ja) treffer += 1;
  });
  const reihe = seite.querySelector('[data-role="angeheftet-reihe"]');
  if (reihe) {
    let sichtbar = 0;
    reihe.querySelectorAll('[data-role="angeheftet"]').forEach((zelle) => {
      const ja = passt(zelle.dataset.suche, begriff);
      zelle.hidden = !ja;
      if (ja) sichtbar += 1;
    });
    reihe.hidden = !sichtbar;
  }
  const leer = seite.querySelector('[data-role="crew-suche-leer"]');
  if (leer) leer.hidden = !(begriff && !treffer);
  // Während man sucht, gehört der Platz den Treffern — „Vergangene Meets" wartet so lange.
  const vergangen = seite.querySelector('[data-role="vergangene-platz"]');
  if (vergangen) vergangen.hidden = Boolean(begriff);
  // Die gemessenen Lagen gehören zur gefilterten Liste — sonst hielte der nächste Render das
  // Ausblenden für ein Umsortieren und ließe Zeilen gleiten.
  const liste = seite.querySelector('[data-role="chat-liste"]');
  if (liste && ordnung.liste === liste) ordnung.lage = lageMessen(liste);
}

// R8-60: Oberkante und Höhe der Suchleiste und der untere Rand der Reihe stehen hier einmal — die
// Anfrage-Karte liegt genau über ihrer rechten Hälfte (listBody).
const SUCHE_OBEN = 4;
const SUCHE_HOEHE = 38;
const REIHE_UNTEN = 4;

function sucheHtml(ctx) {
  return `<div data-role="crew-suche" style="padding:${SUCHE_OBEN}px ${RAND}px 6px">
<label style="display:flex;align-items:center;gap:8px;height:${SUCHE_HOEHE}px;padding:0 12px;border-radius:12px;background:var(--ink-a05);cursor:text">
<span style="display:flex;flex:none;pointer-events:none">${search('var(--muted)', 16)}</span>
<input data-role="crew-suche-feld" type="search" enterkeyhint="search" autocomplete="off" autocapitalize="off" spellcheck="false" aria-label="${esc(tx('Suchen'))}" placeholder="${esc(tx('Suchen'))}" value="${esc(ctx.ui.suche || '')}" style="flex:1;min-width:0;height:100%;border:0;padding:0;background:transparent;outline:none;appearance:none;-webkit-appearance:none;font:500 15px/1 'Instrument Sans',sans-serif;color:var(--ink)">
<button type="button" data-role="crew-suche-leeren" data-treffer aria-label="${esc(tx('Suche leeren'))}" style="flex:none;width:24px;height:24px;margin-right:-4px;border:0;border-radius:50%;background:transparent;display:flex;align-items:center;justify-content:center;padding:0;cursor:pointer;appearance:none"><span style="pointer-events:none;display:flex">${symbol('kreuz', 'var(--muted)', 13)}</span></button>
</label></div>`;
}

function sucheBinden(seite, ctx) {
  const feld = seite?.querySelector('[data-role="crew-suche-feld"]');
  if (!feld) return;
  feld.__crewCtx = ctx;
  if (feld.__crewSuche) return;
  feld.__crewSuche = true;
  const anwenden = () => {
    const aktuell = feld.__crewCtx;
    if (aktuell) aktuell.ui.suche = feld.value;
    sucheAnwenden(feld.closest('.r8a'), feld.value);
    // R8-60: Wer sucht, braucht die ganze Leiste (auch ihr Kreuz rechts) — die Anfrage-Karte wird
    // jetzt schon zum Punkt am „+".
    if (feld.value) anfrageHinweisFliegen();
  };
  feld.addEventListener('input', anwenden);
  // Der eigene kleine Kreuz-Knopf (statt des blauen des Browsers) steht nur, solange etwas drin steht.
  const leeren = feld.parentElement?.querySelector('[data-role="crew-suche-leeren"]');
  leeren?.addEventListener('click', (ereignis) => {
    ereignis.preventDefault();
    feld.value = '';
    anwenden();
    feld.focus({ preventScroll: true });
  });
  feld.addEventListener('keydown', (ereignis) => {
    if (ereignis.key === 'Escape' && feld.value) { feld.value = ''; anwenden(); }
    if (ereignis.key === 'Enter') feld.blur();
  });
}

// --- R8-5: Reihenfolge, Stillstand und Gleiten ----------------------------------------------
//
// Die Reihenfolge, die man SIEHT: wer gerade frei ist, oben — genau das beantwortet diese Seite
// („wer kann?"). Danach die letzte Nachricht, jüngste zuerst. Wo beides nichts sagt, bleibt die
// Ordnung der Datenschicht stehen (stabil sortiert).
function anzeigeOrdnung(eintraege) {
  const frei = (eintrag) => (eintrag.art === 'person' && istJetztFrei(eintrag.person) ? 0 : 1);
  return eintraege
    .map((eintrag, index) => [eintrag, index])
    .sort(([a, ia], [b, ib]) => (frei(a) - frei(b)) || ((Number(b.zeit) || 0) - (Number(a.zeit) || 0)) || (ia - ib))
    .map(([eintrag]) => eintrag);
}

// Gemessen am eigenen Finger: Eine Zeile, die unter dem Daumen wegspringt, trifft man nicht.
// Solange die Liste berührt wird oder rollt (auch der Nachlauf nach dem Wischen), bleibt die
// gezeigte Reihenfolge; Neues hängt sich bis dahin unten an. Erst RUHE_MS nach der letzten
// Bewegung wird nachgeholt — dann gleitet die Zeile an ihren Platz (zeilenGleiten).
const RUHE_MS = 380;
const ordnung = { ids: null, beruehrt: false, bewegtBis: 0, nachholen: false, timer: 0, liste: null, lage: null };
const listeBewegt = () => ordnung.beruehrt || Date.now() < ordnung.bewegtBis;

function gezeigteOrdnung(ziel) {
  if (!ordnung.ids || !listeBewegt()) return ziel;
  const vorher = new Map(ordnung.ids.map((id, index) => [id, index]));
  const bekannt = ziel.filter((eintrag) => vorher.has(eintrag.id)).sort((a, b) => vorher.get(a.id) - vorher.get(b.id));
  return [...bekannt, ...ziel.filter((eintrag) => !vorher.has(eintrag.id))];
}

function nachholenPlanen() {
  globalThis.clearTimeout(ordnung.timer);
  ordnung.timer = globalThis.setTimeout(() => {
    if (!ordnung.nachholen || listeBewegt()) return;
    const ctx = crewAnsicht;
    if (!ctx || ctx.nav?.current?.()?.id !== 'crew.home') return;
    ctx.render();
  }, RUHE_MS + 40);
}

function lageMessen(liste) {
  const lage = new Map();
  for (const zeile of liste.querySelectorAll(':scope > [data-role="chat-zeile"]')) {
    if (!zeile.hidden) lage.set(zeile.dataset.id, zeile.offsetTop);
  }
  return lage;
}

const wenigerBewegung = () => Boolean(globalThis.matchMedia?.('(prefers-reduced-motion: reduce)')?.matches);

// FLIP: Wo stand die Zeile beim letzten Zeichnen, wo steht sie jetzt? Der Abstand wird als
// Versatz angesetzt und weich auf null gezogen. Wer nach OBEN rückt, liegt dabei über den
// anderen (Fläche + Schatten); die anderen rutschen darunter nach.
function zeilenGleiten(seite) {
  const liste = seite?.querySelector('[data-role="chat-liste"]') || null;
  const vorher = liste && ordnung.liste === liste ? ordnung.lage : null;
  ordnung.liste = liste;
  ordnung.lage = liste ? lageMessen(liste) : null;
  if (!liste || !vorher || wenigerBewegung()) return;
  for (const zeile of liste.querySelectorAll(':scope > [data-role="chat-zeile"]')) {
    const alt = vorher.get(zeile.dataset.id);
    const neu = ordnung.lage.get(zeile.dataset.id);
    if (alt === undefined || neu === undefined) continue;
    const weg = alt - neu;
    if (Math.abs(weg) < 2 || typeof zeile.animate !== 'function') continue;
    zeile.getAnimations?.().forEach((animation) => animation.cancel());
    const hoch = weg > 0;
    zeile.animate(hoch
      ? [
        { transform: `translateY(${weg}px)`, zIndex: 3, backgroundColor: 'var(--paper)', boxShadow: '0 10px 26px var(--shadow-14)' },
        { transform: 'translateY(0)', zIndex: 3, backgroundColor: 'var(--paper)', boxShadow: '0 0 0 transparent' },
      ]
      : [{ transform: `translateY(${weg}px)` }, { transform: 'translateY(0)' }],
    { duration: hoch ? 540 : 460, easing: 'cubic-bezier(.22,.61,.36,1)' });
  }
}

// --- R8-4: Langes Drücken öffnet DAS Menü ---------------------------------------------------
// Dieselbe Mechanik wie das Nachrichten-Menü im Raum (room.js, Runde 4 E8): EIN Zeitgeber über
// Pointer-Ereignisse, und alles, was nach Rollen aussieht, bricht ab (mehr als 10 px, Scrollen,
// pointercancel). Rechtsklick und das Systemmenü nach langem Drücken (Android) öffnen dasselbe.
const LANG_DRUECKEN_MS = 450;
const DRUECK_TOLERANZ_PX = 10;
const LANG_DRUCK_SPEICHER = 'crew.hinweis.langDruecken';

// Der Finger, der das Menü geöffnet hat, hebt danach ab — dieser eine Klick öffnet NICHT den Chat.
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

function unterkanteImRahmen(el) {
  const rahmen = el?.closest?.('.runtime-phone') || globalThis.document?.querySelector('.runtime-phone');
  if (!rahmen || !el) return 140;
  const f = rahmen.getBoundingClientRect();
  const skala = rahmen.offsetWidth ? f.width / rahmen.offsetWidth : 1;
  return (el.getBoundingClientRect().bottom - f.top) / skala;
}

const hatCrewMenu = () => typeof profil.crewMenu === 'function';

function menueOeffnen(ctx, ziel) {
  const { ui } = ctx;
  const oben = Math.round(unterkanteImRahmen(ziel) + 6);
  if (ziel.dataset.person) {
    ui.crewMenuFor = null;
    ui.menuFor = ziel.dataset.person;
    ui.menuMark = false;
    ui.menuTop = oben;
  } else if (ziel.dataset.crew && hatCrewMenu()) {
    ui.menuFor = null;
    ui.crewMenuFor = ziel.dataset.crew;
    ui.menuTop = oben;
  } else return false;
  rueckmeldung('tipp');
  ctx.render();
  return true;
}

// --- Ereignisse der Liste: EIN Satz Lauscher für Stillstand (R8-5) und langes Drücken (R8-4) ---
// app.js (bindeEinmalig) lässt je Knoten und Ereignisart nur EINEN Lauscher zu — der erste
// gewinnt. Zwei getrennte pointerdown-Lauscher auf derselben Fläche heißen: einer fällt still
// weg. Gemessen: Die Reihenfolge sprang unter dem Finger, weil „berührt" nie gesetzt wurde.
// Deshalb hängt hier alles an EINEM eigenen Knoten (.r8a, gehört nur dieser Seite) mit je
// einem Lauscher pro Art. Scrollen und Abheben hört das Dokument: Scrollen bubbelt nicht, und
// ein Finger hebt auch außerhalb der Liste ab.
let halt = null;
function druckLoslassen() {
  if (halt) globalThis.clearTimeout(halt.timer);
  halt = null;
}

function druckOeffnen(wurzel, ziel) {
  druckLoslassen();
  const aktuell = wurzel.__crewCtx;
  if (!aktuell || !ziel.isConnected) return;
  if (menueOeffnen(aktuell, ziel)) klickSperre = true;
}

function beruehrungEnde() {
  if (!ordnung.beruehrt) return;
  ordnung.beruehrt = false;
  ordnung.bewegtBis = Date.now() + RUHE_MS;
  nachholenPlanen();
}

let dokumentGebunden = false;
function dokumentBinden() {
  if (dokumentGebunden || !globalThis.document?.addEventListener) return;
  dokumentGebunden = true;
  // Im Einfangen sieht das Dokument jedes Scrollen; gezählt wird nur die Fläche dieser Seite.
  document.addEventListener('scroll', (event) => {
    const flaeche = event.target;
    if (!(flaeche instanceof Element) || !flaeche.querySelector(':scope > .r8a')) return;
    druckLoslassen();
    ordnung.bewegtBis = Date.now() + RUHE_MS;
    nachholenPlanen();
  }, { capture: true, passive: true });
  // Ein Finger bleibt „auf der Liste", bis er abhebt — auch wenn der Browser das Rollen
  // übernimmt und pointercancel schickt. Für Finger zählen deshalb die Touch-Ereignisse,
  // für Maus und Stift die Pointer-Ereignisse.
  const fingerWeg = (event) => { if (!event.touches?.length) beruehrungEnde(); };
  document.addEventListener('touchend', fingerWeg, { capture: true, passive: true });
  document.addEventListener('touchcancel', fingerWeg, { capture: true, passive: true });
  const zeigerWeg = (event) => { if (event.pointerType !== 'touch') beruehrungEnde(); };
  window.addEventListener('pointerup', zeigerWeg, true);
  window.addEventListener('pointercancel', zeigerWeg, true);
}

function bindListe(seite, ctx) {
  const wurzel = seite?.querySelector('.r8a');
  if (!wurzel) return;
  wurzel.__crewCtx = ctx;
  dokumentBinden();
  if (wurzel.__crewGebunden) return;
  wurzel.__crewGebunden = true;
  wurzel.addEventListener('touchstart', () => { ordnung.beruehrt = true; }, { passive: true });
  wurzel.addEventListener('pointerdown', (event) => {
    if (event.pointerType !== 'touch') ordnung.beruehrt = true;
    druckLoslassen();
    if (!event.isPrimary || (event.pointerType === 'mouse' && event.button !== 0)) return;
    const ziel = event.target.closest?.('[data-lang-druck]');
    if (!ziel || !wurzel.contains(ziel)) return;
    halt = { x: event.clientX, y: event.clientY, timer: globalThis.setTimeout(() => druckOeffnen(wurzel, ziel), LANG_DRUECKEN_MS) };
  });
  wurzel.addEventListener('pointermove', (event) => {
    if (halt && Math.hypot(event.clientX - halt.x, event.clientY - halt.y) > DRUECK_TOLERANZ_PX) druckLoslassen();
  });
  wurzel.addEventListener('pointerup', druckLoslassen);
  wurzel.addEventListener('pointercancel', druckLoslassen);
  // Rechtsklick (Maus) und das Systemmenü nach langem Drücken (Android) öffnen dasselbe Menü.
  wurzel.addEventListener('contextmenu', (event) => {
    const ziel = event.target.closest?.('[data-lang-druck]');
    if (!ziel || !wurzel.contains(ziel)) return;
    event.preventDefault();
    druckOeffnen(wurzel, ziel);
  });
}

// Der einmalige, leise Hinweis: in der ERSTEN Sitzung, in der es Chats gibt, steht über der
// Liste eine Zeile — danach nie wieder (dieses Gerät). Sie verschwindet bewusst NICHT mitten in
// der Sitzung, auch nicht nach dem ersten langen Drücken: Dann rutschte die ganze Liste unter
// dem gerade geöffneten Menü um eine Zeile hoch.
let langDruckHinweis = null;
function langDruckHinweisZeigen() {
  if (langDruckHinweis === null) {
    let schon = false;
    try { schon = globalThis.localStorage?.getItem(LANG_DRUCK_SPEICHER) === '1'; } catch { schon = false; }
    langDruckHinweis = !schon;
    if (!schon) { try { globalThis.localStorage?.setItem(LANG_DRUCK_SPEICHER, '1'); } catch { /* privates Fenster */ } }
  }
  return langDruckHinweis;
}

// --- Die Zeile (R8-2/R8-3) -----------------------------------------------------------------
function chatZeile(ctx, eintrag, settings, { langDruck = true, begriff = '' } = {}) {
  const art = zeilenArt(eintrag);
  const name = eintragName(ctx, eintrag);
  const text = vorschau(ctx, eintrag);
  const unread = Number(eintrag.unread) || 0;
  const zeit = zeitKurz(eintrag.zeit);
  const suchText = suchNorm(name);
  // EIN Ziel je Zeile — ihr Raum. room.js löst Person, Gruppe und Meet über die Raum-ID auf.
  const akt = art === 'person'
    ? `data-act="open-person" data-person="${esc(eintrag.id)}"`
    : art === 'gruppe'
      ? `data-act="open-crew" data-crew="${esc(eintrag.id)}"`
      : 'data-act="open-chat"';
  // Menü per langem Drücken: Person und Gruppe. Ein Meet-Chat hat kein eigenes Menü.
  const druck = langDruck && art !== 'meet'
    ? ` data-lang-druck ${art === 'person' ? `data-person="${esc(eintrag.id)}"` : `data-crew="${esc(eintrag.id)}"`}`
    : '';
  // Die Textspalte hat eine feste Höhe (styles.css K3: Name + zweite Zeile). Auch ohne Nachricht
  // steht der Name deshalb auf derselben Achse wie in jeder anderen Zeile — Jonathan (K3): „Höhe
  // reservieren, nicht nachträglich fangen"; eine Liste mit springenden Namen liest sich unruhig.
  const zweite = text || unread
    ? `<span data-role="chat-zustand" style="display:flex;align-items:center;gap:8px;min-width:0">
<span data-role="chat-nachricht" style="flex:1;min-width:0;font-size:13.5px;line-height:18px;font-weight:${unread ? 550 : 450};color:${unread ? 'var(--ink-soft)' : 'var(--muted)'};white-space:nowrap;overflow:hidden;text-overflow:ellipsis">${vorschauHtml(text, unread)}</span>
${unread ? orangeZahl(unread) : ''}</span>`
    : '';
  return `<div data-role="chat-zeile" class="r8a-zeile" data-art="${art}" data-id="${esc(eintrag.id)}" data-suche="${esc(suchText)}"${druck}${passt(suchText, begriff) ? '' : ' hidden'}>
<span class="r8a-strich" aria-hidden="true"></span>
<button ${akt} data-room="${esc(eintrag.roomId || '')}" class="r8a-knopf" style="display:flex;align-items:center;gap:${ZEILEN_LUECKE}px;width:100%;box-sizing:border-box;padding:10px ${RAND}px;border:0;background:transparent;text-align:left;appearance:none;cursor:pointer;font-family:'Instrument Sans',sans-serif;color:var(--ink)">
<span style="pointer-events:none;display:flex;flex:none">${zeilenBild(ctx, eintrag, settings)}</span>
<span style="pointer-events:none;flex:1;min-width:0;display:flex;flex-direction:column;gap:3px">
<span style="display:flex;align-items:baseline;gap:8px;min-width:0">
<span data-role="chat-name" style="flex:1;min-width:0;font-size:15.5px;line-height:20px;font-weight:${unread ? 700 : 600};letter-spacing:-.01em;white-space:nowrap;overflow:hidden;text-overflow:ellipsis">${esc(name)}</span>
${zeit ? `<span data-role="chat-zeit" style="flex:none;font:550 12px/1 'Instrument Sans',sans-serif;color:var(--muted-light);font-variant-numeric:tabular-nums;white-space:nowrap">${esc(zeit)}</span>` : ''}
</span>
${zweite}
</span></button></div>`;
}

// --- Die Reihe (R8-1): markierte Leute ------------------------------------------------------
// Markiert = die besondere Person und die besten Freunde (R8-7: dieselben Marken wie am Bild).
// Dahinter, was man im Menü einer Gruppe selbst angeheftet hat (profile.js crewMenu „Anheften",
// settings.pinnedIds) — sonst wäre „Anheften" ein Knopf ohne Wirkung (Hausregel 9). Das kleine
// Häkchen in der Zeile ist weg (R8-8); angeheftet heißt: es steht HIER.
// Die Reihe ist ein schneller Weg, kein Filter — die Liste darunter bleibt vollständig. Sie hat
// eine feste Reihenfolge (besondere Person, beste Freunde, dann Angeheftetes, jeweils wie
// gesetzt): Gesichter, die man mit dem Daumen ansteuert, springen nicht.
const REIHE_BILD = 52;
const REIHE_BREITE = 64;

function reiheIds(settings) {
  const ids = [];
  if (settings.specialPerson?.personId) ids.push(settings.specialPerson.personId);
  for (const id of settings.bestFriendIds || []) if (!ids.includes(id)) ids.push(id);
  for (const id of settings.pinnedIds || []) if (!ids.includes(id)) ids.push(id);
  return ids;
}

function reiheZelle(ctx, eintrag, settings, begriff) {
  const art = zeilenArt(eintrag);
  const akt = art === 'person'
    ? `data-act="open-person" data-person="${esc(eintrag.id)}" data-lang-druck`
    : art === 'gruppe'
      ? `data-act="open-crew" data-crew="${esc(eintrag.id)}" data-lang-druck`
      : 'data-act="open-chat"';
  const name = art === 'person' ? String(eintragName(ctx, eintrag)).split(' ')[0] : eintragName(ctx, eintrag);
  const unread = Number(eintrag.unread) || 0;
  const suchText = suchNorm(eintragName(ctx, eintrag));
  // R8-61: Neues im Chat ist EIN oranger Punkt oben rechts am Bild — ein kreisPunkt, so groß wie
  // der Frei-Punkt. Die Zahl steht in der Zeile der Liste; am Bild wäre sie eine zweite, kleinere
  // Fassung derselben Angabe. Vorgelesen wird sie weiter (aria-label). Am Personenbild zeichnet
  // personAvatar den Punkt samt Lücke (options.mitteilung); an der Gruppenkachel steht er hier.
  const gruppe = art === 'gruppe';
  const bild = gruppe
    ? gruppenKachel(eintrag.crew, REIHE_BILD, { loch: Boolean(unread) })
    : zeilenBild(ctx, eintrag, settings, REIHE_BILD, { mitteilung: unread });
  const punkt = unread && (gruppe || !kreisRegel())
    ? punktAmKreis(REIHE_BILD, 'or', 'var(--orange)', 'data-role="mitteilung-punkt" aria-hidden="true"')
    : '';
  const vorlesen = unread ? ` aria-label="${esc(`${eintragName(ctx, eintrag)}, ${tnx(unread, '{n} neue Nachricht', '{n} neue Nachrichten')}`)}"` : '';
  return `<button ${akt} data-room="${esc(eintrag.roomId || '')}" data-role="angeheftet" data-id="${esc(eintrag.id)}" data-art="${art}" data-suche="${esc(suchText)}" data-treffer${passt(suchText, begriff) ? '' : ' hidden'}${vorlesen} style="flex:none;width:${REIHE_BREITE}px;display:flex;flex-direction:column;align-items:center;gap:5px;padding:2px 0 0;border:0;background:transparent;cursor:pointer;appearance:none;font-family:'Instrument Sans',sans-serif;color:var(--ink)">
<span data-role="angeheftet-bild" style="pointer-events:none;position:relative;display:flex">${bild}${punkt}</span>
<span data-role="angeheftet-name" style="pointer-events:none;max-width:${REIHE_BREITE}px;font:600 11px/1.2 'Instrument Sans',sans-serif;color:var(--ink-soft);white-space:nowrap;overflow:hidden;text-overflow:ellipsis">${esc(name)}</span></button>`;
}

function reiheHtml(ctx, eintraege, settings, begriff) {
  if (!eintraege.length) return '';
  const sichtbar = eintraege.some((eintrag) => passt(suchNorm(eintragName(ctx, eintrag)), begriff));
  const zellen = eintraege.map((eintrag) => reiheZelle(ctx, eintrag, settings, begriff)).join('');
  return `<div data-role="angeheftet-reihe" data-anzahl="${eintraege.length}"${sichtbar ? '' : ' hidden'}>${edgeFadeRow(zellen, { gap: 6, padLeft: RAND - 6, padRight: RAND, padY: `8px 0 ${REIHE_UNTEN}px`, scrollKey: 'crew-angeheftet' })}</div>`;
}

// --- R8-10/R8-11: „+" oben rechts, das Blatt dahinter, die Anfragen ---------------------------

function anfragenListe(repo) {
  return (typeof repo.getFriendRequests === 'function' ? repo.getFriendRequests() : null) || [];
}

const PILLE = "flex:none;height:34px;padding:0 15px;border-radius:999px;font:650 13px/1 'Instrument Sans',sans-serif;cursor:pointer;appearance:none;white-space:nowrap";

function anfrageZeile(anfrage, index) {
  const id = esc(anfrage.id);
  const gesicht = personAvatar({ id: anfrage.id, name: anfrage.name, initials: anfrage.initials, color: anfrage.color, photo: anfrage.photo || null }, { size: 44, free: false, active: false });
  return `<div data-role="anfrage" data-anfrage="${id}" style="display:flex;gap:12px;padding:12px 2px;${index ? 'border-top:1px solid var(--ink-a06);' : ''}">
<span style="display:flex;flex:none">${gesicht}</span>
<span style="flex:1;min-width:0;display:flex;flex-direction:column;gap:2px">
<span style="font-size:15px;font-weight:650;letter-spacing:-.01em;white-space:nowrap;overflow:hidden;text-overflow:ellipsis">${esc(anfrage.name)}</span>
${anfrage.meta ? `<span style="font-size:12.5px;color:var(--muted);white-space:nowrap;overflow:hidden;text-overflow:ellipsis">${esc(anfrage.meta)}</span>` : ''}
<span style="display:flex;gap:8px;margin-top:8px">
<button data-act="anfrage-annehmen" data-anfrage="${id}" data-treffer style="${PILLE};border:0;background:var(--green);color:var(--on-accent)"><span style="pointer-events:none">${esc(tx('Annehmen'))}</span></button>
<button data-act="anfrage-ignorieren" data-anfrage="${id}" data-treffer style="${PILLE};border:1px solid var(--ink-a14);background:var(--surface);color:var(--ink-soft)"><span style="pointer-events:none">${esc(tx('Ignorieren'))}</span></button>
</span></span></div>`;
}

function plusBlattHtml(ctx) {
  const { repo, ui } = ctx;
  if (!ui.plusBlatt) return '';
  // Eine Gruppe ohne Menschen ist kein Angebot, sondern eine Sackgasse (Runde 2) — ohne Freunde
  // gibt es deshalb nur „Freund hinzufügen".
  const hatFreunde = repo.getPeople().length > 0;
  const zeile = (act, icon, label) => `<button data-act="${act}" data-role="${act}" data-treffer style="display:flex;align-items:center;gap:13px;width:100%;min-height:56px;padding:0 2px;border:0;background:transparent;text-align:left;appearance:none;cursor:pointer;font:650 15.5px/1.2 'Instrument Sans',sans-serif;color:var(--ink)"><span style="pointer-events:none;flex:none;width:40px;height:40px;border-radius:50%;background:var(--green-tint);display:flex;align-items:center;justify-content:center">${symbol(icon, 'var(--green-dark)', 20)}</span><span style="pointer-events:none;flex:1;min-width:0">${esc(label)}</span></button>`;
  const anfragen = anfragenListe(repo);
  const liste = anfragen.length
    ? `<div data-role="plus-anfragen" style="margin-top:12px;padding-top:12px;border-top:1px solid var(--ink-a07)">
<div style="display:flex;align-items:center;gap:8px;padding:0 2px 2px"><span style="font:650 13px/1 'Instrument Sans',sans-serif;color:var(--muted)">${esc(tx('Anfragen'))}</span>${orangeZahl(anfragen.length)}</div>
${anfragen.map(anfrageZeile).join('')}</div>`
    : '';
  return sheet(`<div data-role="crew-plus-blatt" style="font-family:'Instrument Sans',sans-serif;color:var(--ink)">
${zeile('plus-freund', 'personPlus', tx('Freund hinzufügen'))}${hatFreunde ? zeile('plus-gruppe', 'gruppe', tx('Neue Gruppe')) : ''}
${liste}</div>`, { closeAct: 'plus-zu', scrollKey: 'crew-plus' });
}

// „Ignorieren" nimmt die Anfrage aus der Liste — still: Wer sie geschickt hat, erfährt davon
// nichts (die App zeigt Absendern keinen Status), und er kann es später noch einmal versuchen.
// Deshalb ohne Nachfrage; das frühere „Ablehnen?"-Zwischenblatt war die zweite Handlung für
// dieselbe Entscheidung.
function anfragenAktionen(ctx) {
  const { repo } = ctx;
  const finde = (id) => anfragenListe(repo).find((eintrag) => eintrag.id === id);
  return {
    'anfrage-annehmen': (data) => {
      const anfrage = finde(data.anfrage);
      if (!anfrage) return;
      rueckmeldung('erfolg');
      Promise.resolve(repo.acceptFriendRequest(anfrage.id)).catch(() => {});
      const vorname = String(anfrage.name || '').split(' ')[0];
      ctx.render();
      ctx.toast?.(vorname ? tx('{name} ist jetzt dein Freund', { name: vorname }) : tx('Anfrage angenommen'));
    },
    'anfrage-ignorieren': (data) => {
      const anfrage = finde(data.anfrage);
      if (!anfrage) return;
      rueckmeldung('zurueck');
      Promise.resolve(repo.declineFriendRequest(anfrage.id)).catch(() => {});
      ctx.render();
      ctx.toast?.(tx('Anfrage ignoriert'));
    },
  };
}

// --- R8-6: Vergangene Meets ------------------------------------------------------------------
// Der Datenvertrag trennt aktiv und vergangen (getChats / getVergangeneChats). Steht in einer
// älteren Datenschicht doch ein vergangener Meet-Chat in getChats(), bleibt er trotzdem draußen.
const istVergangen = (eintrag) => eintrag?.vergangen === true || (istMeetChat(eintrag) && eintrag.zustand === 'vorbei');

function aktiveChats(repo) {
  return (typeof repo.getChats === 'function' ? repo.getChats() || [] : []).filter((eintrag) => !istVergangen(eintrag));
}

function vergangeneChats(repo) {
  if (typeof repo.getVergangeneChats === 'function') return repo.getVergangeneChats() || [];
  return (typeof repo.getChats === 'function' ? repo.getChats() || [] : []).filter(istVergangen);
}

const tageVergangen = () => Number(projektionen.VERGANGENE_CHATS_TAGE) || 7;

function vergangeneKnopf(anzahl) {
  if (!anzahl) return '';
  return `<button data-act="vergangene-oeffnen" data-role="vergangene-knopf" data-treffer style="display:flex;align-items:center;justify-content:center;gap:7px;margin:10px auto 0;min-height:40px;padding:0 16px;border:0;border-radius:999px;background:transparent;color:var(--muted);font:600 13.5px/1 'Instrument Sans',sans-serif;cursor:pointer;appearance:none"><span style="pointer-events:none;display:flex">${symbol('verlauf', 'var(--muted)', 15)}</span><span style="pointer-events:none">${esc(tx('Vergangene Meets'))}</span></button>`;
}

function vergangeneBlattHtml(ctx) {
  if (!ctx.ui.vergangeneOffen) return '';
  const liste = vergangeneChats(ctx.repo);
  const settings = ctx.repo.getSettings();
  const inhalt = liste.length
    ? `<div class="r8a-chats" data-role="vergangene-liste" style="margin:6px -20px 0">${liste.map((eintrag) => chatZeile(ctx, eintrag, settings, { langDruck: false })).join('')}</div>`
    : `<p style="margin:14px 0 4px;text-align:center;font:500 14px/1.4 'Instrument Sans',sans-serif;color:var(--muted)">${esc(tx('Keine vergangenen Meets'))}</p>`;
  return sheet(`<div data-role="vergangene-blatt" style="font-family:'Instrument Sans',sans-serif;color:var(--ink)">
<div style="font-family:'Bricolage Grotesque',sans-serif;font-size:19px;font-weight:650">${esc(tx('Vergangene Meets'))}</div>
<p style="margin:4px 0 0;font-size:13px;line-height:1.4;color:var(--muted)">${esc(tnx(tageVergangen(), 'Die Chats bleiben {n} Tag nach dem Meet.', 'Die Chats bleiben {n} Tage nach dem Meet.'))}</p>
${inhalt}</div>`, { closeAct: 'vergangene-zu', scrollKey: 'vergangene' });
}

// --- R8-6: „Gruppe nehmen oder eigener Chat" --------------------------------------------------
// publishDraft sagt mit gruppeWaehlbar, dass die Eingeladenen GENAU eine bestehende Gruppe sind.
// Dann fragt die App einmal kurz, wo geschrieben wird. Wer anlegt, merkt die Frage vor
// (chatWahlVormerken(ergebnis)); gestellt wird sie von der nächsten Seite, die chatWahlHtml in
// ihren Überlagerungen zeichnet und chatWahlAktionen bindet (hier: die Crew-Seite). Schließen
// ohne Wahl lässt es beim eigenen Chat — so, wie publishDraft es angelegt hat.
let chatWahl = null;

export function chatWahlVormerken(ergebnis) {
  chatWahl = ergebnis?.ok !== false && ergebnis?.meetId && ergebnis?.gruppeWaehlbar
    ? { meetId: ergebnis.meetId, crewId: ergebnis.gruppeWaehlbar }
    : null;
  return Boolean(chatWahl);
}

export function chatWahlHtml(ctx) {
  if (!chatWahl || typeof ctx.repo.meetChatWaehlen !== 'function') return '';
  const crew = typeof ctx.repo.getCrew === 'function' ? ctx.repo.getCrew(chatWahl.crewId) : null;
  if (!crew) return '';
  const knopf = (act, text, primaer) => `<button data-act="${act}" data-role="${act}" data-treffer style="width:100%;min-height:50px;margin-top:${primaer ? 16 : 8}px;border:${primaer ? '0' : '1px solid var(--ink-a14)'};border-radius:16px;background:${primaer ? 'var(--green)' : 'var(--surface)'};color:${primaer ? 'var(--on-accent)' : 'var(--ink)'};font:650 15px/1.2 'Instrument Sans',sans-serif;cursor:pointer;appearance:none;padding:0 16px"><span style="pointer-events:none">${esc(text)}</span></button>`;
  return sheet(`<div data-role="chat-wahl" style="font-family:'Instrument Sans',sans-serif;color:var(--ink)">
<div style="display:flex;align-items:center;gap:12px">${gruppenKachel(crew, 44)}<span style="display:flex;flex-direction:column;gap:3px;min-width:0">
<span style="font-family:'Bricolage Grotesque',sans-serif;font-size:19px;font-weight:650">${esc(tx('Welcher Chat?'))}</span>
<span style="font-size:13px;line-height:1.35;color:var(--muted)">${esc(tx('Alle aus {gruppe} sind eingeladen.', { gruppe: crew.name }))}</span></span></div>
${knopf('chatwahl-gruppe', tx('Chat von {gruppe}', { gruppe: crew.name }), true)}${knopf('chatwahl-eigen', tx('Eigener Chat'), false)}
</div>`, { closeAct: 'chatwahl-eigen', scrollKey: 'chat-wahl' });
}

export function chatWahlAktionen(ctx) {
  const waehlen = (wahl) => {
    const offen = chatWahl;
    chatWahl = null;
    if (!offen || typeof ctx.repo.meetChatWaehlen !== 'function') { ctx.render(); return; }
    const antwort = ctx.repo.meetChatWaehlen(offen.meetId, wahl);
    rueckmeldung(antwort?.ok ? (wahl === 'gruppe' ? 'erfolg' : 'tipp') : 'abgelehnt');
    ctx.render();
    if (!antwort?.ok && wahl === 'gruppe') ctx.toast?.(tx('Gerade geht das nicht'));
  };
  return { 'chatwahl-gruppe': () => waehlen('gruppe'), 'chatwahl-eigen': () => waehlen('eigen') };
}

// --- „Jetzt frei?" nach einem beendeten „Keine Zeit"-Fenster (Runde 5 G3c) --------------------
// Der einzige Hinweis über dem Knopf. Er führt IN den Frei-Zustand hinein.
const JETZT_FREI_SPEICHER = 'crew.frei.jetztGefragt';
const JETZT_FREI_FENSTER_MIN = 180;

function freiHinweisHtml(ctx, free) {
  const hinweis = ctx.ui.freiHinweis;
  if (hinweis?.art !== 'jetztFrei' || free?.active) return '';
  const bild = `<span style="width:38px;height:38px;border-radius:12px;background:var(--green-tint);display:flex;align-items:center;justify-content:center;flex:none">${symbol('uhr', 'var(--green-dark)', 20)}</span>`;
  const titel = tx('Jetzt frei?');
  const unter = tx('Keine Zeit ist seit {zeit} vorbei', { zeit: hinweis.zeit || '' });
  const knopfHtml = `<button data-act="frei-jetzt" data-treffer style="pointer-events:auto;align-self:flex-start;margin-top:7px;height:36px;padding:0 16px;border:0;border-radius:999px;background:var(--green);color:var(--on-accent);font:650 13px/1 'Instrument Sans',sans-serif;cursor:pointer;appearance:none;white-space:nowrap"><span style="pointer-events:none">${esc(tx('Ich bin frei'))}</span></button>`;
  return `<div data-role="frei-hinweis" data-art="${hinweis.art}" style="pointer-events:none;display:flex;justify-content:center;padding:0 16px 8px">
<div data-role="frei-hinweis-karte" style="pointer-events:none;position:relative;box-sizing:border-box;width:100%;max-width:440px;display:flex;align-items:flex-start;gap:12px;padding:12px 44px 12px 12px;background:var(--surface);border:1px solid var(--green-a28);border-radius:20px;box-shadow:0 10px 28px var(--shadow-16);font-family:'Instrument Sans',sans-serif;color:var(--ink)">
<span style="display:flex;flex:none;padding-top:1px">${bild}</span>
<span style="display:flex;flex-direction:column;gap:3px;flex:1;min-width:0">
<span data-role="frei-hinweis-titel" style="font-size:14px;font-weight:650;letter-spacing:-.005em;line-height:1.3;display:-webkit-box;-webkit-line-clamp:2;-webkit-box-orient:vertical;overflow:hidden">${esc(titel)}</span>
${unter ? `<span style="font-size:12px;color:var(--ink-soft);white-space:nowrap;overflow:hidden;text-overflow:ellipsis">${esc(unter)}</span>` : ''}
${knopfHtml}
</span>
<button data-act="frei-hinweis-zu" data-treffer aria-label="${esc(tx('Hinweis ausblenden'))}" style="pointer-events:auto;position:absolute;right:6px;top:6px;width:32px;height:32px;border:0;border-radius:50%;background:transparent;display:flex;align-items:center;justify-content:center;cursor:pointer;appearance:none;padding:0"><span style="pointer-events:none;display:flex">${symbol('kreuz', 'var(--muted)', 14)}</span></button>
</div></div>`;
}

function freiHinweisAktionen(ctx) {
  const { repo, ui } = ctx;
  return {
    'frei-jetzt': () => {
      rueckmeldung('erfolg');
      ui.freiHinweis = null;
      repo.setFree({});
      ctx.render();
    },
    'frei-hinweis-zu': () => {
      rueckmeldung('schliessen');
      ui.freiHinweis = null;
      ctx.render();
    },
  };
}

// G3c — „Jetzt frei?" einmal je beendetem Fenster. Gemerkt wird das Ende des Fensters (ms).
function jetztFreiPruefen(ctx) {
  const { repo, ui } = ctx;
  if (ui.jetztFreiGeprueft) return;
  ui.jetztFreiGeprueft = true;
  const belegt = repo.getSettings().belegt;
  if (!Array.isArray(belegt) || !belegt.length || repo.getFreeState()?.active) return;
  import('../core/belegt.js').then(({ belegtJetzt, uhrzeitText }) => {
    const jetzt = Date.now();
    if (belegtJetzt(belegt, new Date(jetzt)).belegt) return;
    let ende = 0;
    for (let minuten = 1; minuten <= JETZT_FREI_FENSTER_MIN; minuten += 1) {
      const zustand = belegtJetzt(belegt, new Date(jetzt - minuten * 60000));
      const zeit = zustand.belegt && zustand.ende ? zustand.ende.getTime() : 0;
      if (zeit && zeit <= jetzt && zeit > ende) ende = zeit;
    }
    if (!ende) return;
    const schluessel = String(ende);
    let gefragt = [];
    try { gefragt = JSON.parse(globalThis.localStorage?.getItem(JETZT_FREI_SPEICHER) || '[]'); } catch { gefragt = []; }
    if (!Array.isArray(gefragt)) gefragt = [];
    if (gefragt.includes(schluessel)) return;
    try { globalThis.localStorage?.setItem(JETZT_FREI_SPEICHER, JSON.stringify([...gefragt, schluessel].slice(-20))); } catch { /* privates Fenster */ }
    if (repo.getFreeState()?.active || ui.freiHinweis) return;
    ui.freiHinweis = { art: 'jetztFrei', zeit: uhrzeitText(new Date(ende)), schluessel };
    if (document.querySelector('#free-button')) ctx.render();
  }).catch(() => {});
}

// Wer die App aus dem Hintergrund holt, „öffnet" sie auch — dann wird noch einmal geschaut.
// crewAnsicht ist zugleich der zuletzt gebundene Stand für das Nachholen der Reihenfolge (R8-5).
let crewAnsicht = null;
let crewSichtbarLauscher = false;
function crewBeimZurueckkommen(ctx) {
  crewAnsicht = ctx;
  if (crewSichtbarLauscher || !globalThis.document?.addEventListener) return;
  crewSichtbarLauscher = true;
  document.addEventListener('visibilitychange', () => {
    if (document.visibilityState !== 'visible' || !crewAnsicht) return;
    if (crewAnsicht.nav?.current?.()?.id !== 'crew.home') return;
    crewAnsicht.ui.jetztFreiGeprueft = false;
    jetztFreiPruefen(crewAnsicht);
  });
}

// G3d — `aktion=frei` in der Adresse (aus sw.js „Ich auch") oder in den Routen-Parametern.
// Einmal je Seitenaufruf; danach verschwindet sie aus der Adresse, damit Neuladen nichts wiederholt.
let aktionErledigt = false;
function aktionAusAdresse(ctx) {
  if (aktionErledigt) return null;
  let aktion = ctx.params?.aktion || null;
  try { aktion = aktion || new URLSearchParams(globalThis.location?.search || '').get('aktion'); } catch { /* ohne Adresse */ }
  if (aktion !== 'frei') return null;
  aktionErledigt = true;
  try {
    const adresse = new URL(globalThis.location.href);
    adresse.searchParams.delete('aktion');
    const params = adresse.searchParams.get('params');
    if (params) {
      const werte = JSON.parse(params);
      if (werte && typeof werte === 'object' && 'aktion' in werte) {
        delete werte.aktion;
        adresse.searchParams.set('params', JSON.stringify(werte));
      }
    }
    globalThis.history?.replaceState?.(globalThis.history.state, '', `${adresse.pathname}${adresse.search}${adresse.hash}`);
  } catch { /* dann bleibt sie stehen — aktionErledigt verhindert trotzdem eine Wiederholung */ }
  return aktion;
}

function ichAuchFrei(ctx) {
  const free = ctx.repo.getFreeState();
  // Keine Rückmeldung hier: Die Seite ist eben erst geladen (aus der Mitteilung), der Browser
  // verweigert vor einer Berührung die Vibration — gebrummt hat die Mitteilung selbst.
  if (!free?.active || free.pending) ctx.repo.setFree({});
  ctx.render();
}

// --- N5: Jemanden einladen — der Weg, der KEIN Danebenstehen voraussetzt ------------------
async function inZwischenablage(text) {
  try {
    if (globalThis.navigator?.clipboard?.writeText) { await globalThis.navigator.clipboard.writeText(text); return true; }
  } catch { /* verweigert — dann der alte Weg */ }
  try {
    const feld = document.createElement('textarea');
    feld.value = text;
    feld.setAttribute('readonly', '');
    feld.style.cssText = 'position:fixed;left:-9999px;top:0';
    document.body.appendChild(feld);
    feld.select();
    const ok = document.execCommand('copy');
    feld.remove();
    return Boolean(ok);
  } catch { return false; }
}

// Ein abgebrochenes Teilen-Blatt ist KEIN Fehler — da hat der Mensch selbst „nein" gesagt.
const abgebrochen = (fehler) => fehler?.name === 'AbortError' || /abort|cancel/i.test(String(fehler?.message || ''));

async function einladungTeilen(ctx) {
  const code = typeof ctx.repo.getInviteCode === 'function' ? ctx.repo.getInviteCode() : '';
  if (!code) { ctx.toast?.(tx('Noch kein Einladungslink da')); return; }
  const adresse = inviteUrl(code);
  const text = tx('Füge mich in Crew hinzu: {code}', { code });
  const lage = kann('teilen');
  if (lage.wie === 'nativ') {
    const plugin = huellePlugin('Share', ['share']);
    if (typeof plugin?.share === 'function') {
      try { await plugin.share({ title: 'Crew', text, url: adresse }); return; } catch (fehler) { if (abgebrochen(fehler)) return; }
    }
  } else if (lage.wie === 'web' && typeof globalThis.navigator?.share === 'function') {
    try { await globalThis.navigator.share({ title: 'Crew', text, url: adresse }); return; } catch (fehler) { if (abgebrochen(fehler)) return; }
  }
  const ok = await inZwischenablage(`${text} ${adresse}`);
  ctx.toast?.(ok ? tx('Link kopiert') : tx('Link konnte nicht kopiert werden'));
}

function einladenKnopf() {
  return `<button data-act="crew-einladen" data-role="einladen-knopf" data-treffer style="display:flex;align-items:center;justify-content:center;gap:9px;width:100%;min-height:50px;margin-top:10px;box-sizing:border-box;padding:0 16px;border:1px solid var(--ink-a12);border-radius:18px;background:var(--surface);cursor:pointer;appearance:none;font:650 13.5px/1 'Instrument Sans',sans-serif;color:var(--ink)"><span style="pointer-events:none;display:flex">${symbol('teilen', 'var(--ink-soft)', 16)}</span><span style="pointer-events:none">${esc(tx('Jemanden einladen'))}</span></button>`;
}

// --- Kopf: Titel und EIN „+" (R8-10) ---------------------------------------------------------
// Der Punkt am „+" sagt: Da wartet eine Anfrage. Steht die große Karte gerade noch (R8-60), ist er
// noch nicht zu sehen — die Karte WIRD zu ihm (ui/anfragen-hinweis.js fliegt genau auf ihn).
// R8-61: Der Punkt kommt aus kreisPunkt() — Mittelpunkt auf dem Rand des Knopfs unter 45° oben
// rechts, so groß wie der Frei-Punkt an einem gleich großen Bild. Die Lücke um ihn ist durchsichtig
// (R8-7): Sie wird aus der Kreisfläche des Knopfs gestanzt, auch aus seinem Rand. Der Träger
// [data-role="crew-plus-punkt"] ist die Kreisfläche selbst (38 × 38) — der Punkt liegt darin.
const PLUS_KNOPF = 38;
// Oberer Innenabstand des Kopfs (components.js › tabHeader) — der „+" steht mittig darunter.
const KOPF_OBEN = 6;
// Ohne Freunde gibt es weder Suchleiste noch Reihe (R8-60): Dann steht die Anfrage-Karte flach im
// Kopf, links neben dem „+", in den sie gleich fliegt — dort liegt nichts, was sie verdecken könnte.
// Sie hält Abstand zum Schriftzug links (KOPF_FREI) und wird höchstens so breit wie über der Suche.
const KOPF_FREI = 96;

function kopfHinweisHtml(hinweis) {
  if (!hinweis) return '';
  const rechts = RAND + PLUS_KNOPF + 8;
  return `<div data-role="anfrage-hinweis-kopf" style="position:absolute;z-index:6;top:${KOPF_OBEN + (TAB_HEADER_HEIGHT - PLUS_KNOPF) / 2}px;height:${PLUS_KNOPF}px;right:${rechts}px;width:min(220px, calc(100% - ${rechts + KOPF_FREI}px));pointer-events:none">${hinweis}</div>`;
}

function header(ctx, hinweisLaeuft, kopfHinweis = '') {
  const offen = anfragenListe(ctx.repo).length;
  const punkt = offen
    ? `<span data-role="crew-plus-punkt" aria-hidden="true" style="position:absolute;inset:0;pointer-events:none;z-index:2;opacity:${hinweisLaeuft ? 0 : 1}">${punktAmKreis(PLUS_KNOPF, 'or', 'var(--orange)', 'data-punkt="plus-punkt" aria-hidden="true"')}</span>`
    : '';
  const loch = offen && !hinweisLaeuft ? lochMaske(PLUS_KNOPF, 'or') : '';
  const label = offen ? `${tx('Hinzufügen')}, ${tnx(offen, '{n} neue Anfrage', '{n} neue Anfragen')}` : tx('Hinzufügen');
  const knopf = `<button data-act="crew-plus" data-role="crew-plus" data-treffer data-anfragen="${offen}" aria-label="${esc(label)}" style="position:relative;flex:none;width:${PLUS_KNOPF}px;height:${PLUS_KNOPF}px;border:0;border-radius:50%;background:transparent;display:flex;align-items:center;justify-content:center;padding:0;cursor:pointer;appearance:none"><span data-role="crew-plus-kreis" aria-hidden="true" style="position:absolute;inset:0;border-radius:50%;border:1px solid var(--ink-a12);background:var(--surface);box-sizing:border-box;pointer-events:none;${loch}"></span><span style="position:relative;pointer-events:none;display:flex">${plus('var(--ink)', 18)}</span>${punkt}</button>`;
  return tabHeader(
    `<span style="font-family:'Bricolage Grotesque',sans-serif;font-size:22px;font-weight:650">crew<span style="color:var(--green)">.</span></span>`,
    knopf,
  ) + kopfHinweisHtml(kopfHinweis);
}

// --- Die Seite -------------------------------------------------------------------------------
// Jede Stelle hat einen FESTEN Platz mit eigener Rolle, auch wenn sie leer ist. Der Abgleich
// (core/html.js) ordnet nach Index zu: So bleibt das Suchfeld derselbe Knoten (Fokus, Tastatur),
// wenn oben eine Karte kommt oder geht, und die Liste bleibt dieselbe (Gleiten, R8-5).
function listBody(ctx) {
  const { repo, ui } = ctx;
  const settings = repo.getSettings();
  const hatFreunde = repo.getPeople().length > 0;
  const begriff = suchNorm(ui.suche);

  // R8-5: die gezeigte Reihenfolge — und ob nach dem Stillstand noch etwas nachzuholen ist.
  const ziel = hatFreunde ? anzeigeOrdnung(aktiveChats(repo)) : [];
  const eintraege = gezeigteOrdnung(ziel);
  ordnung.ids = eintraege.map((eintrag) => eintrag.id);
  ordnung.nachholen = eintraege.some((eintrag, index) => eintrag !== ziel[index]);

  const markiert = reiheIds(settings)
    .map((id) => eintraege.find((eintrag) => eintrag.id === id))
    .filter(Boolean);
  const karte = mitteilungsKarte(ctx);
  const hatListe = eintraege.length > 0;
  const treffer = eintraege.some((eintrag) => passt(suchNorm(eintragName(ctx, eintrag)), begriff));

  const rumpf = hatListe
    ? `<div class="r8a-chats" data-role="chat-liste">${eintraege.map((eintrag) => chatZeile(ctx, eintrag, settings, { begriff })).join('')}</div>
<p data-role="crew-suche-leer"${begriff && !treffer ? '' : ' hidden'} style="margin:18px ${RAND}px 0;text-align:center;font:500 14px/1.4 'Instrument Sans',sans-serif;color:var(--muted)">${esc(tx('Keine Treffer'))}</p>`
    : `<div style="padding:8px ${RAND}px 0">${leerZeile({ text: tx('Noch keine Freunde'), aktLabel: tx('Freunde hinzufügen'), act: 'go-friend-add' })}${einladenKnopf()}</div>`;

  const langDruck = hatListe && langDruckHinweisZeigen()
    ? `<p data-role="lang-druck-hinweis" style="margin:0;padding:8px ${RAND}px 2px;font:500 12.5px/1.35 'Instrument Sans',sans-serif;color:var(--muted-light)">${esc(tx('Tipp: Chat gedrückt halten für mehr'))}</p>`
    : '';

  // R8-60: Die Anfrage-Karte liegt ÜBER der rechten Hälfte von Suchleiste und Reihe — im selben
  // Träger wie die beiden, damit sie an ihnen klebt (auch unter einer Mitteilungs-Karte und beim
  // Rollen). Steht die Reihe da, reicht sie von der Oberkante der Suche bis unter die Namen der
  // Reihe ('hoch'); sonst ist sie genau so hoch wie die Suchleiste ('flach'). Es rückt nichts.
  // Ohne Suchleiste (noch keine Freunde) steht sie im Kopf (kopfHinweisHtml).
  const reiheSichtbar = hatFreunde && markiert.some((eintrag) => passt(suchNorm(eintragName(ctx, eintrag)), begriff));
  const form = reiheSichtbar ? 'hoch' : 'flach';
  const hinweis = anfrageHinweisHtml(ctx, { act: 'crew-plus', form });
  const inListe = Boolean(hinweis) && hatListe;
  const hinweisLage = inListe
    ? ` style="position:absolute;z-index:4;left:50%;right:${RAND}px;top:${SUCHE_OBEN}px;${form === 'hoch' ? `bottom:${REIHE_UNTEN}px` : `height:${SUCHE_HOEHE}px`};pointer-events:none"`
    : '';

  // Der <style> steht IN der Seite, nicht als eigenes Kind der Scrollfläche: Ein Kind ohne
  // Fläche läge bei (0,0) und „wanderte" beim Tabwechsel scheinbar mit (gemessen, r7b-bahn K7).
  const html = `<div class="r8a" data-role="crew-seite">${SEITEN_STIL}
<div data-role="mitteilung-platz"${karte ? ` style="padding:6px ${RAND}px 4px"` : ''}>${karte}</div>
<div data-role="kopf-platz" style="position:relative">
<div data-role="such-platz">${hatListe ? sucheHtml(ctx) : ''}</div>
<div data-role="reihe-platz">${hatFreunde ? reiheHtml(ctx, markiert, settings, begriff) : ''}</div>
<div data-role="anfrage-hinweis-platz"${hinweisLage}>${inListe ? hinweis : ''}</div>
</div>
<div data-role="hinweis-platz">${langDruck}</div>
<div data-role="chat-abschnitt" style="padding-top:4px">${rumpf}</div>
<div data-role="vergangene-platz"${begriff ? ' hidden' : ''}>${hatFreunde ? vergangeneKnopf(vergangeneChats(repo).length) : ''}</div>
</div>`;
  return { html, hinweis: Boolean(hinweis), kopfHinweis: hinweis && !inListe ? hinweis : '' };
}

// Runde 6 (D4): dieselbe Reihenfolge und dieselben Bausteine wie im Personenprofil
// (room.js renderPersonDetails) — Menü bzw. Markieren-Sheet, darüber die Bestätigungen.
function personMenueOverlays(ctx) {
  const { ui } = ctx;
  const basis = ui.sheet === 'mark' && ui.markFor
    ? markSheet(ctx)
    : (ui.menuFor ? friendMenu(ctx, ui.menuFor) : '');
  return `${basis}${markSwitchSheet(ctx)}${removeFriendSheet(ctx)}${blockSheet(ctx)}${reportSheet(ctx)}${discardSheet(ctx)}`;
}

// R8-4/R8-12: das EINE Gruppenmenü aus profile.js — gezeichnet, solange ui.crewMenuFor gesetzt
// ist (dieselbe Konvention wie friendMenu/ui.menuFor).
function crewMenueOverlay(ctx) {
  return ctx.ui.crewMenuFor && hatCrewMenu() ? profil.crewMenu(ctx, ctx.ui.crewMenuFor) || '' : '';
}

// Die Aktionen des Gruppenmenüs kommen dazu, ohne die des Personenmenüs zu überschreiben.
function crewMenueAktionen(ctx, schon) {
  if (typeof profil.crewMenuActs !== 'function') return {};
  const aktionen = profil.crewMenuActs(ctx, {}) || {};
  return Object.fromEntries(Object.entries(aktionen).filter(([name]) => !(name in schon)));
}

// R8-9: Ein neues Meet — derselbe Weg wie „+ Meet" bisher: Entwurf anlegen, dann Entdecken.
function neuesMeet(ctx) {
  const { repo, nav } = ctx;
  const entwurf = typeof repo.createDraft === 'function' ? repo.createDraft({}) : null;
  if (!entwurf?.id) { rueckmeldung('abgelehnt'); ctx.toast?.(tx('Gerade geht das nicht')); return; }
  rueckmeldung('tipp');
  nav.go('newMeet.discover', { draftId: entwurf.id });
}

// =====================================================================================
// R8-9 — die FREE-Reihe, EINE Bauform für Crew und Meet
// -------------------------------------------------------------------------------------
// FREE steht mittig, rechts daneben ein kleiner runder „+" für ein neues Meet (immer möglich,
// frei oder nicht), links bleibt es frei. Der „+" trägt das Grün von FREE — er gehört zu dieser
// Reihe und ist damit vom „+" oben rechts (Freund/Gruppe) zu unterscheiden. Er sitzt außerhalb
// der 108-px-Trefferfläche von FREE: Ein Tipp auf FREE bleibt FREE.
//
// Runde 6 (A3, Ursache 1) gilt weiter: Die Reihe behält beim Halten IHRE KINDER. Der „+" wird
// dann nur unsichtbar, nicht entfernt — sonst ersetzte der Abgleich den Teilbaum, und der Knoten
// #free-button, auf dem der Finger liegt, fiele mitten in der Geste aus dem Dokument.
//
// Der Zustandswechsel am Knopf läuft als benannte CSS-Animation (v4 P0-2d/P0-2e): Der UI-Zustand
// des Tabs merkt sich den vorherigen Look samt Startzeit, damit der Übergang mehrere Renders
// in Folge überlebt.
export function freiReiheHtml(ctx) {
  const { repo, ui } = ctx;
  const free = repo.getFreeState();
  const look = free?.active ? (free.pending && free.fromAt ? 'pending' : 'active') : 'idle';
  const now = Date.now();
  if (ui.freeLook && ui.freeLook !== look) ui.freeSwap = { from: ui.freeLook, at: now };
  ui.freeLook = look;
  const swap = ui.freeSwap && now - ui.freeSwap.at < FREI_ANIM_MS ? ui.freeSwap : null;
  const anim = swap ? { from: swap.from, elapsed: now - swap.at, ms: FREI_ANIM_MS } : null;
  const caption = look === 'pending' ? freiCaption(free, minutesUntil(free.fromAt)) : '';
  const holding = Boolean(ui.hold?.holding);
  const neu = `<button data-act="frei-neues-meet" data-role="frei-neues-meet" data-treffer aria-label="${esc(tx('Neues Meet'))}" style="position:absolute;left:calc(50% + 62px);top:50%;margin-top:-19px;width:38px;height:38px;box-sizing:border-box;border-radius:50%;border:1.5px solid var(--green-a42);background:var(--surface);box-shadow:0 1px 4px var(--shadow-07);display:flex;align-items:center;justify-content:center;padding:0;cursor:pointer;appearance:none;pointer-events:auto;${holding ? 'visibility:hidden;' : ''}"><span style="pointer-events:none;display:flex">${plus('var(--green-dark)', 18)}</span></button>`;
  return `<div data-role="frei-reihe" style="pointer-events:none;position:relative;display:flex;align-items:center;justify-content:center;height:112px">${freiKreis(free, { hidden: holding, anim, caption })}${neu}</div>`;
}

// EIN Tipp auf FREE — dieselbe Regel für den Tipp UND für das Loslassen an derselben Stelle
// (Runde 6 A3). Ohne eigene Handler benutzt bindFreiControl genau diese beiden.
function freiUmschalten(ctx) {
  const { repo, ui } = ctx;
  const free = repo.getFreeState();
  if (free?.active) {
    rueckmeldung('tipp');
    repo.clearFree();
    ui.freiHinweis = null;
  } else {
    // Runde 7 (E4): EIN Tipp sagt „ich habe Zeit" — mehr nicht.
    rueckmeldung('erfolg');
    repo.setFree();
  }
}

// v3.1: Frei ab statt Frei bis. Ohne Drag zählt das Loslassen wie ein Tipp.
// v5 A05: Der absolute Zeitpunkt wird übergeben — nicht der nominale Offset.
function freiAbLoslassen(ctx, hold, tippen) {
  if (!hold) { tippen(); return; }
  rueckmeldung('erfolg');
  ctx.repo.setFree({ at: hold.targetAt, from: hold.timeLabel });
  ctx.toast?.(tx('Frei ab {zeit}', { zeit: hold.timeLabel }));
}

// Die aktive Seite der Tab-Bahn. Solange eine Nachbarseite hereingleitet, stehen zwei Seiten
// im Dokument — gemessen und gebunden wird immer die, die man sieht.
function aktiveSeite(root) {
  return root.querySelector('.tab-page[data-role="active"]') || root;
}

// Dieselbe Regel für die FREE-Knoten: Seit auch der Meet-Tab FREE trägt (R8-9), kann es sie
// während eines Tabwechsels zweimal geben.
function freiKnoten(selektor) {
  return document.querySelector(`.tab-page[data-role="active"] ${selektor}`) || document.querySelector(selektor);
}

function renderCrewHome(ctx) {
  const { repo, ui } = ctx;
  const free = repo.getFreeState();
  // R8-60: Die Liste weiß, wo die Anfrage-Karte liegt (über Suche und Reihe); der Kopf muss nur
  // wissen, OB sie gerade steht — solange wartet sein Punkt unsichtbar auf sie.
  const koerper = listBody(ctx);

  // Bottom-Ebene: Frei-Steuerung und Bottom-Navigation liegen ÜBER der Scrollfläche;
  // der Inhalt läuft sichtbar darunter durch und bleibt per bottomInset erreichbar.
  // Über der FREE-Reihe steht nur „Jetzt frei?" (G3c) — in einem festen Platz (Runde 6 A3).
  const holding = Boolean(ui.hold?.holding);
  const bottom = `<div data-role="frei-hinweis-platz" style="pointer-events:none">${holding ? '' : freiHinweisHtml(ctx, free)}</div><div style="pointer-events:none;height:26px"></div>
${freiReiheHtml(ctx)}`;

  const html = screenScaffold({
    page: true,
    header: header(ctx, koerper.hinweis, koerper.kopfHinweis),
    body: koerper.html,
    bottom,
    bottomInset: 138,
    headerFade: true,
    // Runde 3 (O2): Die Liste blendet an der Navigation aus; FREE schwebt darüber.
    bottomFadeHeight: 30,
    untenSchwebend: true,
    overlays: `${freiHoldOverlay(ui.hold)}${plusBlattHtml(ctx)}${vergangeneBlattHtml(ctx)}${chatWahlHtml(ctx)}${personMenueOverlays(ctx)}${crewMenueOverlay(ctx)}${ctx.freundHinzufuegen?.overlay(ctx) || ''}`,
    scrollKey: 'crew',
  });

  return { html, bind: bindCrewHome };
}

function bindCrewHome(root, ctx) {
  const { nav, ui } = ctx;
  // Runde 5: Das Binden läuft bei jedem Render — alles hier ist deshalb einmalig bzw. billig.
  mitteilungenBeobachten(ctx);      // G2: Ankunft hören (einmal je Repository, danach app-weit)
  pushLageAuffrischen(ctx);         // G1: Zustand dieses Geräts einmal beim Browser nachfragen
  crewBeimZurueckkommen(ctx);
  jetztFreiPruefen(ctx);            // G3c
  if (aktionAusAdresse(ctx) === 'frei') window.setTimeout(() => ichAuchFrei(ctx), 0); // G3d
  const seite = aktiveSeite(root);
  const aktionen = {
    // EIN Ziel für jede Zeile — ihr Raum.
    'open-chat': (data) => { ui.vergangeneOffen = false; nav.go('room.view', { roomId: data.room }); },
    'open-crew': (data) => nav.go('room.view', { roomId: roomIdForCrew(data.crew) }),
    'open-person': (data) => nav.go('room.view', { roomId: roomIdForPerson(data.person) }),
    // R8-10: das „+" oben rechts und sein Blatt.
    // R8-60: Wer das Blatt öffnet, sieht die Anfragen dort groß — die Karte ist damit erledigt.
    'crew-plus': () => { rueckmeldung('tipp'); anfrageHinweisBeenden(ctx); ui.plusBlatt = true; ctx.render(); },
    'plus-zu': () => { ui.plusBlatt = false; ctx.render(); },
    'plus-freund': () => {
      ui.plusBlatt = false;
      if (ctx.freundHinzufuegen) ctx.freundHinzufuegen.oeffnen(ctx); else nav.go('profile.friendAdd');
    },
    'plus-gruppe': () => { ui.plusBlatt = false; nav.go('room.newCrew'); },
    // R8-6: vergangene Meet-Chats.
    'vergangene-oeffnen': () => { rueckmeldung('tipp'); ui.vergangeneOffen = true; ctx.render(); },
    'vergangene-zu': () => { ui.vergangeneOffen = false; ctx.render(); },
    // Runde 3 (D5): „Freund hinzufügen" als Sheet über der Crew-Seite.
    ...(ctx.freundHinzufuegen?.aktionen(root, ctx) || {}),
    'go-friend-add': () => (ctx.freundHinzufuegen ? ctx.freundHinzufuegen.oeffnen(ctx) : nav.go('profile.friendAdd')),
    ...mitteilungsKarteAktionen(ctx),
    ...anfragenAktionen(ctx),
    // N5: der Weg, der KEIN Danebenstehen voraussetzt.
    'crew-einladen': () => { rueckmeldung('tipp'); einladungTeilen(ctx); },
    // Runde 6 (D4): dasselbe Menü und dieselben Folgewege wie im Personenprofil.
    ...friendMenuActs(ctx),
    ...markSheetActs(ctx),
    ...blockActs(ctx),
    ...discardActions(ctx),
    ...freiHinweisAktionen(ctx),
    ...chatWahlAktionen(ctx),
  };
  bindActions(root, { ...crewMenueAktionen(ctx, aktionen), ...aktionen });
  // Das gemeinsame Markieren-Sheet nimmt Text über input-Ereignisse an, nicht über data-act.
  bindMarkSheetInputs(root, ctx);

  sucheBinden(seite, ctx);
  bindListe(seite, ctx);
  zeilenGleiten(seite);
  // R8-11: Was die Karte gerade zeigt, gilt ab jetzt als gezeigt.
  const gezeigt = anfrageHinweisIds(seite);
  if (gezeigt.length) anfrageHinweisGesehen(ctx, gezeigt);
  // R8-60: Eintritt und Flug in den Punkt am „+" — gemessen wird erst im Moment des Flugs.
  anfrageHinweisBinden(seite, ctx, { ziel: '[data-role="crew-plus-punkt"] > [data-punkt]' });

  // FREE und der „+" daneben (R8-9) — mit der Standardregel (freiUmschalten).
  bindFreiControl(root, ctx);
}

// --- Frei-Steuerung v3.1 (PRODUCT_DECISIONS §4, RUNTIME_QUALITY_CONTRACT §3) ---
// Tap setzt sofort Frei. Halten öffnet den Frei-ab-Controller am ruhenden Button;
// erst ein Uhrzeiger-Drag lädt einen Bogen auf: eine volle Umdrehung = 60 Minuten,
// weitere Umdrehungen zählen fortlaufend weiter. Werte rasten in 5-Minuten-Schritten,
// rückwärts nur bis Offset null. Obergrenze sichtbar begrenzt.

const RING_RADIUS = 103;
const HOLD_DELAY_MS = 300;
const SNAP_MINUTES = 5;
const MAX_OFFSET_MINUTES = 12 * 60; // klare, im Controller sichtbare Obergrenze
const MAX_DEG = (MAX_OFFSET_MINUTES / 60) * 360; // eine Umdrehung = 60 Minuten
const REST_ANGLE = 90;   // atan2-Grad der 6-Uhr-Ruhelage (y wächst nach unten)
const DEAD_ZONE = 34;    // zu nah am Zentrum wäre der Winkel unruhig
// v7 A08 (spec/02 §1): Der Uebergang dauert 0,8-1,0 s. Mit den frueheren 340 ms war die
// Flaeche gefaerbt, bevor das Auge der Bewegung folgen konnte.
const FREI_ANIM_MS = 900;

function formatClock(date) {
  return `${String(date.getHours()).padStart(2, '0')}:${String(date.getMinutes()).padStart(2, '0')}`;
}

// v4 P0-2g: Angezeigte Zeit UND Obergrenze werden auf dieselbe Weise gerundet. Vorher wurde
// nur der gewählte Wert gerundet, die Obergrenze nicht — am Anschlag stand deshalb
// „Frei ab 10:10 … Spätestens 10:09", also eine Minute VOR dem gewählten Zeitpunkt.
function roundedClock(msFromNow) {
  const date = new Date(Date.now() + msFromNow);
  date.setSeconds(0, 0);
  date.setMinutes(Math.round(date.getMinutes() / 5) * 5);
  return date;
}

function minutesUntil(at) {
  return Math.max(0, Math.round((Number(at) - Date.now()) / 60000));
}

// v4 P0-2k: Der Countdown kannte nur Minuten und war hart auf 90 Minuten begrenzt — bei
// längerem Vorlauf fehlte er komplett. Jetzt gibt es eine gröbere Einheit, und die Regel
// steht nur an dieser einen Stelle (Render UND Ticker lesen sie).
function countdownLabel(minutes) {
  if (minutes <= 0) return '';
  if (minutes < 60) return tx('in {min} Min.', { min: minutes });
  const hours = Math.floor(minutes / 60);
  const rest = minutes % 60;
  if (hours >= 3 || rest === 0) return tx('in {std} Std', { std: hours });
  return tx('in {std} Std {min} Min', { std: hours, min: rest });
}

function freiCaption(state, minutesLeft) {
  const countdown = countdownLabel(minutesLeft);
  return `${tx('frei ab {zeit}', { zeit: state?.from || '' })}${countdown ? ` · ${countdown}` : ''}`;
}

// Nach einem Halten liegt der Zeiger beim Loslassen über fremdem Inhalt (Ringbahn statt
// Knopf). Der darauf folgende Klick würde sonst die Zeile darunter öffnen.
function swallowNextClick() {
  const stop = (event) => { event.stopPropagation(); event.preventDefault(); };
  window.addEventListener('click', stop, true);
  window.setTimeout(() => window.removeEventListener('click', stop, true), 350);
}

// v3.2 Ü2: Solange ein geplantes „Frei ab" läuft, aktualisiert ein leichter Ticker den
// Fortschritt und den Countdown DIREKT im DOM (kein voller Rerender, damit Eingaben und
// Scrollposition unberührt bleiben).
//
// v4 P0-2e: Der Ticker terminiert jetzt EXAKT auf die Fälligkeit. Vorher lief ein
// setInterval(10000); der Übergang in den echten Frei-Zustand kam dadurch bis zu 7,5 s zu
// spät. Die nächste Weckzeit ist min(1000 ms, Restzeit) — der letzte Schlag fällt also genau
// auf den gewählten Zeitpunkt. Der Timer hängt am Tab-UI-Zustand, damit ein erneutes Binden
// (jeder Render bindet neu) keinen zweiten Ticker stehen lässt.
function startFreiTicker(ctx) {
  const { ui } = ctx;
  if (ui.freeTimer) { window.clearTimeout(ui.freeTimer); ui.freeTimer = null; }

  const schedule = () => {
    const state = ctx.repo.getFreeState();
    if (!state?.pending || !state.fromAt) return;
    const msLeft = Number(state.fromAt) - Date.now();
    // Grober Takt solange viel Zeit bleibt, feiner Takt kurz davor — der letzte Schlag
    // fällt immer exakt auf fromAt, weil msLeft selbst die Obergrenze ist.
    const period = msLeft > 90000 ? 10000 : 1000;
    ui.freeTimer = window.setTimeout(step, Math.max(16, Math.min(period, msLeft)));
  };

  const step = () => {
    ui.freeTimer = null;
    if (!freiKnoten('#free-button')) return; // Seite nicht mehr sichtbar
    const state = ctx.repo.getFreeState();               // wird zur Fälligkeit selbst wirksam
    if (!state?.pending) { ctx.render(); return; }        // genau ein Render beim Übergang
    // v7 A10: Der Ticker ist NUR noch fachlich — er hält den Countdown-Text exakt und
    // trifft die Fälligkeit auf die Millisekunde. Den sichtbaren Fortschritt malt der
    // Antrieb unten Frame für Frame. Vorher schrieb genau diese Stelle einen
    // inset-Schatten (`inset 0 0 0 ${progress*34}px`) — eine harte, nach innen
    // wandernde Kreisblende, die v7 für den Frei-Knopf ausschließt, und sie sprang im
    // Ticker-Takt (gemessen 3 Stufen in 32 s bei 10-Minuten-Vorlauf).
    const caption = freiKnoten('#free-caption');
    if (caption) caption.textContent = freiCaption(state, minutesUntil(state.fromAt));
    schedule();
  };

  schedule();
  startFreiAntrieb(ctx);
}

// --- Optischer Antrieb des geplanten Freiwerdens (v7 A10, spec/02 §2) ---

// Der fachliche Zeitanteil ist linear und monoton. Der SICHTBARE Fortschritt ist eine
// sanfte Ease-in-Kurve: früh sehr zurückhaltend, in der letzten Phase merklich stärker.
// Exponent und Formel sind identisch mit dem Renderpfad (components.js freiKreis), damit
// Antrieb und Render nie auseinanderlaufen und ein zwischendurch ausgelöster Render
// keinen Sprung erzeugt.
const SICHT_KURVE = 2.2;

// spec/02 §2 Punkte 3 und 4: Über dem Basiswert liegt eine kleine, nullmittige optische
// Atembewegung. Ihre Hüllkurve 4·b·(1−b) ist an Start und Ende exakt null, in der Mitte
// eins — dadurch gibt es weder beim Setzen noch beim Übergang in „frei" einen Sprung.
// Die Auslenkung bleibt damit unter 2 Prozentpunkten und verändert weder Timer noch
// Zielzeit noch Status: sie wird ausschließlich in die CSS-Variable geschrieben.
const ATEM_AMPLITUDE = 0.018;
const ATEM_PERIODE_MS = 4200;

function sichtbarerFortschritt(anteil) {
  return Math.pow(Math.max(0, Math.min(1, anteil)), SICHT_KURVE);
}

function atemAuslenkung(basis, jetzt) {
  const huelle = 4 * basis * (1 - basis);
  return ATEM_AMPLITUDE * huelle * Math.sin((2 * Math.PI * jetzt) / ATEM_PERIODE_MS);
}

// v7 A10: Der Fortschritt aktualisiert AUSSCHLIESSLICH die CSS-Variablen des Frei-Knopfes
// — kein ctx.render(), kein Layout, kein Sheet- oder Pager-Ruckeln. Ein eigener
// requestAnimationFrame-Lauf ersetzt die frühere Ticker-Stufung: der Takt des fachlichen
// Tickers (1 s bzw. 10 s) war vorher direkt die sichtbare Stufung.
function malenFreiFortschritt(dot, state) {
  const start = Number(state.setAt) || (Number(state.fromAt) - 60 * 60000);
  const span = Math.max(1, Number(state.fromAt) - start);
  const jetzt = Date.now();
  const anteil = Math.max(0, Math.min(1, (jetzt - start) / span));
  const basis = sichtbarerFortschritt(anteil);
  const wert = Math.max(0, Math.min(1, basis + atemAuslenkung(basis, jetzt)));
  // Der Renderpfad setzt eine 0,9-s-Transition, die den Abstand zwischen zwei Renders
  // überbrückt. Der Antrieb schreibt jeden Frame selbst — mit der Transition würde er
  // um fast eine Sekunde nachhinken und die Atembewegung wegglätten.
  dot.style.setProperty('transition', 'none');
  // Fünf Nachkommastellen: in der sehr zurückhaltenden Anfangsphase einer langen Spanne
  // wäre eine gröbere Zahl selbst die sichtbare Stufung (0,01 Prozentpunkte je Schritt).
  dot.style.setProperty('--freiP', wert.toFixed(5));
  // Der Text folgt dem BASISWERT, nicht der Atembewegung: sonst flackerte die Schrift.
  // Runde 3 (O1): dieselbe weiche Kurve wie beim Tippen (components.js SCHRIFT) und dieselben
  // Farben aus den Tokens — vorher lief hier eine eigene, lineare Mischung mit festen Werten,
  // die schon bei halber Füllung fast weiße Schrift auf fast weißem Grund ergab.
  const s = Math.max(0, Math.min(1, (basis - 0.52) * 2.5));
  const g = s * s * (3 - 2 * s);
  dot.style.color = `color-mix(in srgb,var(--on-accent) ${(g * 100).toFixed(1)}%,var(--green-dark))`;
}

function startFreiAntrieb(ctx) {
  const { ui } = ctx;
  if (ui.freeRaf) { window.cancelAnimationFrame(ui.freeRaf); ui.freeRaf = null; }
  const zustand = ctx.repo.getFreeState();
  if (!zustand?.pending || !zustand.fromAt) return;

  const frame = () => {
    ui.freeRaf = null;
    const dot = freiKnoten('#free-dot');
    const state = ctx.repo.getFreeState();
    // Seite verlassen oder Zustand vorbei: der Lauf endet von selbst, es bleibt kein
    // zweiter Antrieb stehen (jeder Render bindet neu und ruft startFreiAntrieb erneut).
    if (!dot || !state?.pending || !state.fromAt) return;
    malenFreiFortschritt(dot, state);
    ui.freeRaf = window.requestAnimationFrame(frame);
  };
  ui.freeRaf = window.requestAnimationFrame(frame);
}

// Runde 8 (R8-9): bindet FREE UND den „+" der FREE-Reihe (freiReiheHtml). Handler sind
// freiwillig — ohne sie gilt die Regel der Crew-Seite (freiUmschalten, freiAbLoslassen), und
// der „+" legt ein Meet an (neuesMeet). handlers.onNeuesMeet ersetzt nur diesen Weg, z. B.
// wenn der Meet-Tab den Tag mitgeben will, auf dem man steht.
export function bindFreiControl(root, ctx, handlers = {}) {
  bindActions(root, {
    'frei-neues-meet': () => (typeof handlers.onNeuesMeet === 'function' ? handlers.onNeuesMeet() : neuesMeet(ctx)),
  });
  const button = root.querySelector('.tab-page[data-role="active"] #free-button') || root.querySelector('#free-button');
  if (!button) return;
  const { ui } = ctx;
  const onTap = typeof handlers.onTap === 'function' ? handlers.onTap : () => freiUmschalten(ctx);
  const onRelease = typeof handlers.onRelease === 'function' ? handlers.onRelease : (hold) => freiAbLoslassen(ctx, hold, onTap);
  startFreiTicker(ctx);

  let holdTimer = null;
  let pointerId = null;
  let lastAngle = null;      // Bezugswinkel der letzten Messung (Grad)
  let totalDeg = 0;          // EINZIGE Größe: kumulierte Drehung ab der 6-Uhr-Ruhelage
  let startPoint = null;

  // v4 P0-2a: Der Bezugsrahmen wird bei JEDER Bewegung frisch aus dem LEBENDEN Dokument
  // geholt. Vorher schloss der Controller über das beim Binden übergebene `root`; spätestens
  // der Halte-Render hängte dieses root ab, getBoundingClientRect() lieferte {0,0,0,0},
  // die Skala fiel auf 1 zurück und die App rechnete mit ROHEN Client-Koordinaten
  // (Winkelfehler bis 171° auf 768x1024, 43° in der skalierten Preview).
  //
  // Bezug ist die aktive Tab-Seite: genau sie ist der Container, in dem das Halte-Overlay
  // absolut positioniert liegt (screenScaffold rendert `overlays` als letztes Kind der
  // .tab-page). Dadurch stimmen Overlay-Koordinaten und Messung ohne Umrechnungsoffset —
  // und der 1-px-Versatz aus P0-2h entfällt, weil nicht mehr die Rahmen-AUSSENkante
  // (.runtime-phone inklusive 1-px-Kontur) gemessen wird.
  // Bezugsrahmen ist GENAU der Kasten, in dem das Halte-Overlay positioniert wird.
  // app.js hängt die Overlays einer Tab-Wurzel aus der Seite in den Handyrahmen um
  // (damit der Schleier auch Statusleiste und Navigation abdeckt) — wird hier die Seite
  // gemessen, sitzt der Ring um die Höhe der Statusleiste daneben.
  // Deshalb: erst den echten Positionsrahmen des Overlays nehmen, sonst den Rahmen.
  function frameEl() {
    const holder = document.querySelector('.page-overlays');
    if (holder && holder.parentElement) return holder.parentElement;
    return document.querySelector('.runtime-phone')
      || document.querySelector('.tab-page[data-role="active"]')
      || document.querySelector('.tab-page');
  }

  function metrics() {
    const el = frameEl();
    if (!el) return null;
    const rect = el.getBoundingClientRect();
    const layoutWidth = el.offsetWidth || rect.width || 0;
    if (!rect.width || !layoutWidth) return null;
    return { rect, scale: rect.width / layoutWidth || 1 };
  }

  // Clientpunkt → CSS-Pixel innerhalb der aktiven Seite (skalierungsfest).
  function toLocal(clientX, clientY, m) {
    return { x: (clientX - m.rect.left) / m.scale, y: (clientY - m.rect.top) / m.scale };
  }

  // Ruhelage = Mitte des SICHTBAREN grünen Kreises, ebenfalls live gemessen.
  function restCenter(m) {
    const circle = freiKnoten('#free-dot') || freiKnoten('#free-button');
    if (!circle) return null;
    const rect = circle.getBoundingClientRect();
    if (!rect.width) return null;
    return {
      x: (rect.left - m.rect.left + rect.width / 2) / m.scale,
      y: (rect.top - m.rect.top + rect.height / 2) / m.scale,
    };
  }

  function angleAt(point, ring) {
    return Math.atan2(point.y - ring.y, point.x - ring.x) * 180 / Math.PI;
  }

  // v4 P0-2b/P0-2i: Es gibt nur EINE Größe — totalDeg. Punkt, Bogen und Zeit werden alle
  // daraus abgeleitet, der Punkt ist damit wirklich der Griff am Bogenende. Vorher wurde der
  // Punkt aus dem absoluten Zeigerwinkel und der Bogen aus totalDeg gesetzt; sobald totalDeg
  // geklemmt wurde, liefen beide bis zu 180° auseinander.
  // Nullpunkt ist die 6-Uhr-Ruhelage (REST_ANGLE), NICHT der erste verarbeitete Zug —
  // deshalb ergibt dieselbe Geste mit Maus und Touch jetzt denselben Wert.
  function applyRotation(ring) {
    if (totalDeg < 0) totalDeg = 0;
    if (totalDeg > MAX_DEG) totalDeg = MAX_DEG;
    const capped = totalDeg >= MAX_DEG - 0.01;

    const rawMinutes = (totalDeg / 360) * 60;                       // stufenlos
    const snapped = Math.round(rawMinutes / SNAP_MINUTES) * SNAP_MINUTES;
    const offset = Math.max(0, Math.min(MAX_OFFSET_MINUTES, snapped));

    const hold = ui.hold;
    hold.offsetMinutes = offset;                                    // gerastet (fachlich)
    hold.rawMinutes = rawMinutes;                                   // stufenlos (visuell)
    hold.totalDeg = totalDeg;
    hold.rounds = Math.floor(totalDeg / 360);
    // P0-2c: beide Bogen-Ebenen laufen monoton und kollabieren an keiner Rundengrenze.
    // v5 A04: EIN Ring. Statt einer zweiten Ebene liefert der Controller jetzt die
    // Rundenzahl und den Bogen der aktuellen Runde; die Darstellung hebt den Verlauf
    // pro Runde um eine Stufe an.
    hold.turns = Math.floor(totalDeg / 360);
    hold.sweepDeg = totalDeg - hold.turns * 360;
    // v5 A05: Es gibt genau EINE Zielgröße — den absoluten Zeitpunkt targetAt auf dem
    // Fünf-Minuten-Raster. Anzeige, Countdown und der gespeicherte Zustand lesen alle
    // ihn. Der Zusatz ist die REALE Differenz bis dorthin, nicht die Auswahlstufe:
    // bei 14:12 und Ziel 14:20 also "in 8 Min.", nicht "in 10 Min.".
    const target = offset > 0 ? roundedClock(offset * 60000) : null;
    hold.targetAt = target ? target.getTime() : null;
    hold.timeLabel = target ? formatClock(target) : tx('jetzt');
    hold.offsetLabel = target ? countdownLabel(minutesUntil(hold.targetAt)) : '';
    hold.capped = capped;
    hold.capLabel = formatClock(roundedClock(MAX_OFFSET_MINUTES * 60000));
    hold.dragging = totalDeg > 0;

    hold.ringX = ring.x;
    hold.ringY = ring.y;
    const radians = (REST_ANGLE + totalDeg) * Math.PI / 180;
    hold.dotX = ring.x + Math.cos(radians) * RING_RADIUS;
    hold.dotY = ring.y + Math.sin(radians) * RING_RADIUS;
  }

  // v4 P0-2i: Während des Ziehens wird NUR das Halte-Overlay ersetzt, nicht die ganze Seite.
  // Der frühere Vollrender pro Bewegung (appElement.innerHTML) verschluckte Ereignisse —
  // je nach Eingabegerät unterschiedlich viele, weshalb dieselbe Geste mit Touch einen
  // anderen Wert ergab als mit der Maus.
  function paint() {
    const host = document.querySelector('#frei-hold');
    if (host && host.parentElement) host.outerHTML = freiHoldOverlay(ui.hold);
    else ctx.render();
  }

  function begin(event) {
    if (event.button !== undefined && event.button !== 0) return;
    const m = metrics();
    const rest = m && restCenter(m);
    if (!m || !rest) return;
    pointerId = event.pointerId;
    button.setPointerCapture?.(pointerId);
    const ring = { x: rest.x, y: rest.y - RING_RADIUS };
    const press = toLocal(event.clientX, event.clientY, m);
    startPoint = { x: event.clientX, y: event.clientY };
    totalDeg = 0;
    // Bezug der Drehung ist der Druckpunkt (deterministisch, unabhängig von der Ereignis-
    // bündelung des Eingabegeräts). Liegt er im Totbereich, gilt die 6-Uhr-Ruhelage.
    lastAngle = Math.hypot(press.x - ring.x, press.y - ring.y) >= DEAD_ZONE
      ? angleAt(press, ring)
      : REST_ANGLE;
    ui.hold = {
      holding: false, dragging: false,
      dotX: rest.x, dotY: rest.y,
      ringX: ring.x, ringY: ring.y,
      turns: 0, sweepDeg: 0, rounds: 0, totalDeg: 0, targetAt: null,
      offsetMinutes: 0, rawMinutes: 0,
      timeLabel: tx('jetzt'), offsetLabel: '', capped: false, capLabel: '',
    };
    holdTimer = window.setTimeout(() => {
      if (!ui.hold) return;
      ui.hold.holding = true;
      rueckmeldung('auswahl');
      // Ringmitte zum Haltezeitpunkt noch einmal live nachmessen.
      const hm = metrics();
      const hr = hm && restCenter(hm);
      if (hr) {
        ui.hold.ringX = hr.x;
        ui.hold.ringY = hr.y - RING_RADIUS;
        ui.hold.dotX = hr.x;
        ui.hold.dotY = hr.y;
      }
      ctx.render();
    }, HOLD_DELAY_MS);
    window.addEventListener('pointermove', move);
    window.addEventListener('pointerup', end);
    window.addEventListener('pointercancel', cancel);
  }

  function move(event) {
    if (event.pointerId !== pointerId || !ui.hold) return;

    // Vor Ablauf der Haltezeit: deutliche Bewegung bricht den Frei-Griff ab,
    // damit ein Scroll- oder Tab-Swipe nicht versehentlich Frei auslöst.
    if (!ui.hold.holding) {
      const dx = event.clientX - startPoint.x;
      const dy = event.clientY - startPoint.y;
      if (Math.hypot(dx, dy) > 12) cancel(event);
      return;
    }

    const m = metrics();
    const rest = m && restCenter(m);
    if (!m || !rest) return;
    const ring = { x: rest.x, y: rest.y - RING_RADIUS };

    const local = toLocal(event.clientX, event.clientY, m);
    if (Math.hypot(local.x - ring.x, local.y - ring.y) < DEAD_ZONE) return;

    const angle = angleAt(local, ring);            // -180..180, 90 = unten (Ruhelage)
    if (lastAngle === null) lastAngle = REST_ANGLE;

    let delta = angle - lastAngle;
    if (delta > 180) delta -= 360;      // Sprung über die ±180-Grenze glätten
    if (delta < -180) delta += 360;
    lastAngle = angle;

    // Uhrzeigersinn lädt auf, Gegenrichtung reduziert — aber nie unter null und nie über
    // die Obergrenze. lastAngle folgt trotzdem weiter, damit eine Richtungsumkehr sofort
    // greift (kein aufgestauter Nachholweg).
    totalDeg = Math.max(0, Math.min(MAX_DEG, totalDeg + delta));
    const rastVorher = ui.hold.offsetMinutes;
    applyRotation(ring);
    // Runde 4: Jede 5-Minuten-Rastung ist fühlbar, wie bei einem Zeitrad.
    if (ui.hold.offsetMinutes !== rastVorher) rueckmeldung('auswahl');
    paint();
  }

  // =====================================================================================
  // Runde 6 (A3, Ursache 2) — jede Geste endet mit einem Ergebnis
  // -------------------------------------------------------------------------------------
  // Jonathan: „wenn ich free halte und gleiche stelle los lasse, dann bleibt es deaktiviert".
  // Gemessen (scratch/r6-crew.mjs „A3 Ursache"): Kommt nach dem Halten statt `pointerup` ein
  // `pointercancel` — iOS schickt es, sobald der Knopf während der Berührung aus dem Dokument
  // fällt (Ursache 1) oder der Langdruck-Callout greift —, lief der frühere cancel()-Zweig:
  // ui.hold = null, ctx.render(), SONST NICHTS. Die Geste war damit spurlos weg und FREE blieb
  // genau so, wie es war: deaktiviert. Nachgestellt mit `Input.dispatchTouchEvent`
  // (touchCancel) — Datenstand vorher {active:false}, nachher {active:false}.
  //
  // Regel jetzt: Was nach dem Halten passiert, ist ein ERGEBNIS, egal wie der Zeiger endet —
  // mit gewählter Zeit „frei ab HH:MM", ohne Wahl ein Tipp. Nur ein Abbruch VOR dem Halten
  // (Wischen, Scrollen: move() ruft cancel()) bleibt folgenlos; dort hat der Nutzer nichts
  // ausgelöst, sondern gescrollt.
  function abschluss(hold, { abbruch = false } = {}) {
    window.clearTimeout(holdTimer);
    detach();
    ui.hold = null;
    if (hold?.holding) {
      swallowNextClick();
      onRelease(hold.offsetMinutes > 0 ? hold : null);
    } else if (!abbruch) onTap();
    ctx.render();
  }

  function end(event) {
    if (event.pointerId !== pointerId) return;
    abschluss(ui.hold);
  }

  function cancel(event) {
    if (event.pointerId !== pointerId) return;
    abschluss(ui.hold, { abbruch: true });
  }

  function detach() {
    pointerId = null;
    lastAngle = null;
    window.removeEventListener('pointermove', move);
    window.removeEventListener('pointerup', end);
    window.removeEventListener('pointercancel', cancel);
  }

  button.addEventListener('pointerdown', begin);
}

export const crewScreens = {
  'crew.home': renderCrewHome,
};
