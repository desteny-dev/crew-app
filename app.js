// Crew — App-Bootstrap: Repository, Router, Render-Schleife, Runtime-Grammatik v3.1.
// Screens kommen aus screens/index.js; Daten ausschließlich aus dem CrewRepository.

import { createRouter, tabForRoute, TAB_ORDER, TAB_ROUTE, TAB_WURZELN as TAB_ROOTS } from './core/router.js';
import { bindActions, resetActions, captureScroll, restoreScroll, scrollVergessen, esc, morphInto, sheetWischen, rueckmeldung, offenesSheet, bindRowDrag } from './core/html.js';
import { createRepository, starteDemo } from './data/gateway.js';
import { RulesEngine } from './engine/suggestion-engine.js';
import { screens, ROUTE_REFERENCE_FALLBACK } from './screens/index.js';
// Runde 3 (D5): Das Einladungs-Sheet „Freund hinzufügen" für jeden Screen (siehe profile.js).
import { freundHinzufuegen } from './screens/profile.js';
// Runde 7, Welle 5 (Regel 3): Der abgelegte Einladungscode hat EINE Lesart — dieselbe wie im
// Einrichten-Weg (profile.js). Keine eigene Kopie mehr in dieser Datei.
import { einladungLesen, einladungWeg, einladungAblegen, einladungCodesFuer, einladungErgebnisMerken, einladungKonto } from './core/einladung.js';
import { resolveReferenceScreen } from './core/reference-adapter.js';
import { phoneFrame, statusBar, tabBar, passeUntereKanteAn } from './ui/components.js';
import { renderAuthScreen, renderNeuesPasswortScreen } from './ui/auth-screen.js';
import { applyTheme } from './core/theme.js';
import { registriereServiceWorker } from './core/pwa.js';
import { sprache, sprachWahl, merkeSprachWahl, t as tx } from './core/sprache.js';
// Runde 6 (P5): Einstieg beim ersten Mal, Berechtigungen im richtigen Moment, Update-Info.
import { guideBeimStart, guideOffen, guideFaelligMerken } from './ui/guide.js';
import { updateInfoBeimStart } from './ui/update-info.js';

const appElement = document.querySelector('#app');
const engine = new RulesEngine();

// Runde 6 (B3, Jonathan: „man soll nicht sehen wie sich, auch wenn nur kurz, laggy die seite
// zusammensetzt"): Die Start-Hülle liegt schon im HTML (index.html) und deckt genau die Zeit ab,
// in der Module geladen werden und das Repository entsteht. Sie geht weg, sobald die App das
// erste Mal wirklich gezeichnet hat — nicht früher, sonst sieht man doch wieder den Aufbau.
const START_HUELLE_MIN = 220;   // ganz schnelle Starts sollen nicht blitzen
const START_HUELLE_WEICH = 200; // und der Übergang bleibt weich
const startHuelleAb = Date.now();
let startHuelle = document.querySelector('#start-huelle');
// Einstieg und Update-Info werden je Sitzung genau einmal geprüft (siehe Ende von render()).
let einstiegGeprueft = false;

// Welches Thema JETZT gilt, merken — damit der nächste Start sofort richtig färbt (index.html
// liest denselben Schlüssel, ebenso ui/laden.js).
function themaMerken() {
  try { globalThis.localStorage?.setItem('crew.lade.thema', document.documentElement.dataset.theme || 'light'); } catch { /* privates Fenster */ }
}

function startHuelleWeg() {
  const knoten = startHuelle;
  if (!knoten) return;
  startHuelle = null;
  themaMerken();
  const rest = Math.max(0, START_HUELLE_MIN - (Date.now() - startHuelleAb));
  setTimeout(() => {
    if (typeof knoten.animate !== 'function') { knoten.remove(); return; }
    const lauf = knoten.animate([{ opacity: 1 }, { opacity: 0 }], { duration: START_HUELLE_WEICH, easing: 'ease-in', fill: 'forwards' });
    lauf.finished.then(() => knoten.remove(), () => knoten.remove());
  }, rest);
}
// Auftrag §1.1: Im Server-Modus ist die Anmeldung schon passiert, wenn die App startet.
// Ein zweiter Begrüßungsbildschirm mit „Mit Apple anmelden" wäre genau die doppelte
// Anmeldung, die der Auftrag abschafft. Im Demo-Modus gibt es kein Konto — dort ist die
// Begrüßung der Eingang.
let startModus = 'demo';
const ERSTER_SCHRITT = () => (startModus === 'supabase' ? 'onboarding.name' : 'onboarding.welcome');
// Das Repository steht erst nach dem Start fest: im Demo-Modus sofort, im Server-Modus
// nach dem Laden des eigenen Datenbestands (siehe ganz unten, starteApp()).
let repo = null;

// Ephemerer UI-Zustand pro Stack-Ebene (Sheets, Auswahlen, Zieh-Zustände).
const uiStack = [];

function uiFor(depth, route) {
  // v5 A24: Routen EINER Abgleich-Gruppe teilen sich ihren UI-Zustand. Der Composer für
  // ein neues Meet ist ein Bildschirm mit Unterbereichen — bekäme jede Unterroute (und
  // jede Parameteränderung wie das Nachtragen der draftId) ein eigenes Zustandsobjekt,
  // schrieben die über Renders hinweg erhaltenen Eingabe-Handler in ein totes Objekt:
  // getippter Text wäre beim nächsten Render verschwunden.
  const gruppe = MORPH_GRUPPE[route.id];
  const signature = gruppe || `${route.id}:${JSON.stringify(route.params)}`;
  if (!uiStack[depth] || uiStack[depth].signature !== signature) {
    uiStack[depth] = { signature, state: {} };
  }
  uiStack.length = depth + 1;
  return uiStack[depth].state;
}

// --- Toast (RUNTIME_QUALITY_CONTRACT §4) ---------------------------------------------
// Einheitliche, nicht interaktive Rückmeldung (keine Aktionen darin): kurze Einblendung,
// Auto-Dismiss, per Swipe nach unten schließbar. Die Lage folgt der Bottom-Ebene des Screens,
// damit der Toast keine Bedienelemente überdeckt (Räume haben keine Bottom-Navigation).

let toastState = null;
let toastTimer = null;

function showToast(message) {
  if (!message) return;
  window.clearTimeout(toastTimer);
  toastState = { message: String(message) };
  // Fable 3 (nudge-13): 160 ms toastOut statt hartem Abbruch.
  toastTimer = window.setTimeout(() => {
    if (toastState) { toastState.out = true; render(); }
    toastTimer = window.setTimeout(() => { toastState = null; render(); }, 170);
  }, 2600);
  render();
}

function dismissToast() {
  window.clearTimeout(toastTimer);
  toastState = null;
  render();
}

// v4 APP-2: Der Toast ist kurz, halbtransparent und NICHT interaktiv. Vorher war er mit
// var(--ink-a92) praktisch deckend und trug pointer-events:auto — dadurch lag er im
// Raum vollstaendig im Composer und machte auf crew.home den Frei-Knopf 2,6 s lang
// unbedienbar (P0-2f). Beides ist jetzt ausgeschlossen: er faengt keine Eingaben mehr ab,
// und seine Lage wird nach dem Rendern aus der ECHTEN Bottom-Ebene berechnet.
function toastLayer() {
  if (!toastState) return '';
  const card = 'pointer-events:none;max-width:100%;background:var(--ink-a72);color:var(--paper);'
    + "font:600 13px/1.35 'Instrument Sans',sans-serif;padding:11px 18px;border-radius:16px;"
    + '-webkit-backdrop-filter:blur(10px);backdrop-filter:blur(10px);'
    + `box-shadow:0 8px 24px var(--shadow-18);animation:${toastState.out ? 'toastOut .16s ease-in forwards' : 'toastIn .22s ease-out'};text-align:center`;
  return `<div id="crew-toast" style="position:absolute;left:0;right:0;bottom:24px;z-index:30;display:flex;justify-content:center;pointer-events:none;padding:0 24px">
<div style="${card}">${esc(toastState.message)}</div></div>`;
}

// v5 A18a: Der Toast lässt sich mit einem Wisch nach unten wegschieben.
//
// Der Toast selbst bleibt bewusst DURCHLÄSSIG (pointer-events:none auf Träger und Karte) —
// sonst läge er 2,6 s lang als unsichtbare Wand über dem Frei-Knopf, genau der Fehler aus
// v4 (P0-2f). Die Geste hängt deshalb am Handyrahmen und reagiert nur, wenn sie INNERHALB
// des Toast-Rechtecks beginnt und wirklich nach unten geht. preventDefault gibt es nicht:
// eine Scrollgeste darunter läuft normal weiter, der Toast verschwindet dabei.
function bindToastWisch(root) {
  const rahmen = root.querySelector('.runtime-phone') || root;
  if (rahmen.__toastWisch) return;
  rahmen.__toastWisch = true;
  let start = null;
  const imToast = (x, y) => {
    const wrap = root.querySelector('#crew-toast');
    const karte = wrap?.firstElementChild;
    if (!karte) return false;
    const r = karte.getBoundingClientRect();
    return x >= r.left - 12 && x <= r.right + 12 && y >= r.top - 12 && y <= r.bottom + 12;
  };
  const beginn = (x, y) => { start = imToast(x, y) ? { x, y } : null; };
  const zug = (x, y) => {
    if (!start) return;
    if (y - start.y > 24 && Math.abs(y - start.y) > Math.abs(x - start.x)) {
      start = null;
      dismissToast();
    }
  };
  rahmen.addEventListener('pointerdown', (e) => { if (e.pointerType !== 'touch') beginn(e.clientX, e.clientY); });
  rahmen.addEventListener('pointermove', (e) => { if (e.pointerType !== 'touch') zug(e.clientX, e.clientY); });
  rahmen.addEventListener('pointerup', () => { start = null; });
  rahmen.addEventListener('touchstart', (e) => { const t = e.touches[0]; if (t) beginn(t.clientX, t.clientY); }, { passive: true });
  rahmen.addEventListener('touchmove', (e) => { const t = e.touches[0]; if (t) zug(t.clientX, t.clientY); }, { passive: true });
  rahmen.addEventListener('touchend', () => { start = null; }, { passive: true });
}

// v5 A21: Der obere Fade gehört an den ECHTEN Scrollweg, nicht an den Stil.
// --fade-top startet bei 0 (scharfe Oberkante) und wächst bis --fade-top-max, sobald
// wirklich Inhalt in den Headerbereich läuft. Ein Listener je Fläche genügt; er wird
// über bindeEinmalig ohnehin nur einmal je Knoten gesetzt.
function bindTopFade(root) {
  root.querySelectorAll('.screen-scroll, [data-layerscroll]').forEach((flaeche) => {
    const max = parseFloat(getComputedStyle(flaeche).getPropertyValue('--fade-top-max')) || 0;
    if (!max) return;
    // Runde 7 (K8): Sobald der Fade seinen Hoechstwert erreicht hat, aendert sich nichts mehr —
    // trotzdem schrieb jedes Rollereignis dieselbe Zahl wieder in die Eigenschaft und stiess
    // damit Stil und Anstrich der ganzen Flaeche an. Geschrieben wird nur noch bei Aenderung.
    //
    // Runde 7, Welle 3 (GEMESSEN, Folgefehler aus K8): Verglichen wurde gegen einen Merker am
    // Knoten (flaeche.__fadeOben). Der Abgleich laesst den Knoten stehen, tauscht aber sein
    // style-Attribut gegen das frische Markup — und das bringt --fade-top:0px mit
    // (web/ui/components.js). Der Merker ueberlebte das, der Wert nicht: gemessen auf
    // meet.home bei scrollTop 1484 vor dem Render inline "14px"/Merker 14, nach EINEM Render
    // inline "0px"/Merker 14, derselbe Knoten. nachziehen() stieg dann aus und schrieb den
    // richtigen Wert nie wieder — wer in einer Liste steht und irgendetwas rendert neu (neue
    // Nachricht, Umschalter, repo.notify), verlor die weiche Kante unter der Kopfzeile, bis
    // er zufaellig auf eine ANDERE Tiefe rollte.
    // Verglichen wird deshalb gegen den TATSAECHLICHEN inline-Wert. Das ist genauso billig
    // (das style-Attribut lesen erzwingt keinen Stil-Durchlauf, anders als getComputedStyle)
    // und kann per Konstruktion nicht auseinanderlaufen: die Quelle der Wahrheit ist der
    // Knoten selbst, nicht eine Kopie daneben.
    const nachziehen = () => {
      const tiefe = Math.max(0, Math.min(max, flaeche.scrollTop));
      if (flaeche.style.getPropertyValue('--fade-top') === `${tiefe}px`) return;
      flaeche.style.setProperty('--fade-top', `${tiefe}px`);
    };
    nachziehen();
    // Der Abgleich laesst Knoten stehen: ein zweiter Listener wuerde sich sonst je
    // Render ansammeln. Ein Merker am Knoten genuegt.
    if (flaeche.__fadeGebunden) return;
    flaeche.__fadeGebunden = true;
    flaeche.addEventListener('scroll', nachziehen, { passive: true });
  });
}

// Lage des Toasts an der realen Bottom-Ebene ausrichten: er darf nie ueber einem
// Bedienelement liegen. Gemessen wird die Oberkante der obersten realen Ebene
// (Composer, CTA/Frei-Zeile, Bottom-Navigation).
function placeToast(root) {
  const wrap = root.querySelector('#crew-toast');
  if (!wrap) return;
  const phone = root.querySelector('.runtime-phone');
  if (!phone) return;
  const phoneRect = phone.getBoundingClientRect();
  let anchor = phoneRect.bottom;
  // Auch ein offenes Sheet zählt als reale Ebene — der Toast gehört darüber.
  root.querySelectorAll('.screen-bottom, .tab-nav, .ui-sheet-card').forEach((layer) => {
    const rect = layer.getBoundingClientRect();
    if (rect.height > 0) anchor = Math.min(anchor, rect.top);
  });

  // v5 A17/A18b: Der Toast hängt NEBEN dem Telefon in der unskalierten Shell. Wird der
  // Rahmen per CSS skaliert (die Desktop-Phone-Vorschau tut genau das), stimmen die
  // gemessenen Bildschirmkoordinaten nicht mehr mit dem Koordinatensystem überein, in
  // dem `bottom` wirkt — vorher landete der Toast dadurch weit unterhalb des Rahmens.
  // Deshalb wird die Skalierung aus dem Verhältnis von gemessener zu gelayouteter Breite
  // bestimmt und ausdrücklich mitgemacht: Lage, Breite und Größe folgen dem Rahmen.
  // Ohne Skalierung (echtes Gerät, 1:1-Vorschau) ist skala 1 und alles bleibt wie bisher.
  const shell = wrap.offsetParent || root;
  const shellRect = shell.getBoundingClientRect();
  const skala = phone.offsetWidth ? phoneRect.width / phone.offsetWidth : 1;
  wrap.style.left = `${Math.round(phoneRect.left - shellRect.left)}px`;
  wrap.style.right = 'auto';
  wrap.style.width = `${phone.offsetWidth}px`;
  wrap.style.transformOrigin = 'bottom left';
  wrap.style.transform = Math.abs(skala - 1) < 0.001 ? '' : `scale(${skala})`;
  wrap.style.bottom = `${Math.round(shellRect.bottom - anchor + 12 * skala)}px`;

  // Sheets fahren beim Oeffnen kurz herein; direkt nach dem Render steht die Karte noch
  // 18px zu tief. Nach dem Einlaufen wird die Lage deshalb einmal nachgezogen.
  if (!placeToast.pending) {
    placeToast.pending = true;
    window.setTimeout(() => { placeToast.pending = false; if (toastState) placeToast(root); }, 280);
  }
}

// --- Tab-Ebene: zwei Seiten in einer Bahn, Chrome bleibt stehen (v4 P0-1) ------------
// Die Statusleiste und die Bottom-Navigation gehören der App, nicht der Seite. Sie stehen
// außerhalb der Bahn und bewegen sich nie. In der Bahn liegen die aktuelle und — sobald
// eine seitliche Absicht erkannt ist — die Nachbarseite; beide folgen derselben Geste.
// Tap auf die Navigation und Drag im freien Inhalt rufen DIESELBE Funktion slideTo().

// v5 A24: Routen, die EINEN Bildschirm bilden. Der Composer fuer ein neues Meet hat
// seine Unterbereiche als eigene Routen; fuer den Abgleich zaehlen sie als derselbe Baum.
// v7 P0: Die Gruppe entscheidet nur noch ueber die EINTRITTSANIMATION, nicht mehr
// darueber, ob neu gebaut wird (morphInto gleicht seit v7 immer ab). Routen, die in
// Wahrheit ein Sheet ueber ihrer Elternseite sind, gehoeren deshalb in deren Gruppe —
// sonst flöge der Hintergrund 18 px seitlich ein, waehrend das Sheet hochfaehrt.
// Gemessen war genau das der zweite Teil des Ruckelns (V7_BASELINE, Frames bei 74/115/192/275 ms).
const MORPH_GRUPPE = {
  // Sheets ueber der Einstellungsseite.
  'profile.appearance': 'profile.settings',
  'profile.sprache': 'profile.settings',
  'profile.freiReset': 'profile.settings',
  // Das QR-/Einladungs-Sheet liegt ueber der Profilseite und nutzt deren Koerper.
  'profile.friendAdd': 'profile.home',
  'newMeet.discover': 'newMeet',
  'newMeet.what': 'newMeet',
  'newMeet.ownIdea': 'newMeet',
  'newMeet.when': 'newMeet',
  'newMeet.where': 'newMeet',
  'newMeet.place': 'newMeet',
  'newMeet.note': 'newMeet',
  'newMeet.who': 'newMeet',
  'newMeet.suggestion': 'newMeet',
};

// Runde 7 (Bahn): TAB_ORDER, TAB_ROUTE und TAB_ROOTS standen hier UND in core/router.js
// (dort als tabForRoute). Zwei Wahrheiten ueber dieselbe Zuordnung sind ein Fehler: beim
// vierten Tab haette man eine der beiden vergessen und auf der Karte leuchtete der Crew-Tab.
// Jetzt gibt es nur noch die Tabelle im Router; hier wird sie gelesen.

// Runde 8 (R8-66): Welche Bereiche die Leiste und die Bahn WIRKLICH anbieten — die aus der
// Tabelle, deren Wurzelseite geladen ist. Find (Mitte) kommt aus einem eigenen Modul
// (screens/index.js); faellt es aus, fehlt nur Find, und es steht kein Tab ohne Seite in der
// Leiste (Hausregel 9: kein Knopf ohne Wirkung). Die Screens stehen nach dem Laden fest, die
// Liste also auch.
const TABS = TAB_ORDER.filter((tab) => Boolean(screens[TAB_ROUTE[tab]]));
if (TABS.length !== TAB_ORDER.length) {
  console.error('[Crew] Bereiche ohne Seite werden nicht angeboten:', TAB_ORDER.filter((tab) => !TABS.includes(tab)).join(', '));
}

// Eigener UI-Zustand je Tab-Wurzel: eine Vorschau muss dasselbe zeigen wie die Seite,
// auf der man nach dem Wechsel landet.
const tabUi = Object.fromEntries(TAB_ORDER.map((tab) => [tab, {}]));

const SWIPE_MS = 260;
let sliding = false;          // läuft gerade eine Abschluss-/Rücksprung-Animation?
let deferredRender = false;   // Rerender, der während der Bewegung angefragt wurde
// v5 A19: Wurzelknoten, an dem die Handler aktuell hängen (siehe render()).
let gebundeneWurzel = null;
let suppressClickUntil = 0;   // nach einem echten Drag den folgenden Klick verschlucken

function ownsHorizontalGesture(target, root) {
  for (let node = target; node && node !== root; node = node.parentElement) {
    if (node.dataset?.hdrag) return true;
    // T5: Eine echte Karte gehört MapLibre — sie wird mit demselben Finger geschoben, mit
    // dem man sonst den Tab wechselt. Wer auf der Karte zieht, meint die Karte. `data-fremd`
    // markiert genau solche fremden Teilbäume (siehe core/html.js).
    if (node.dataset?.fremd) return true;
    if (node.getAttribute?.('role') === 'slider') return true;
    const style = window.getComputedStyle(node);
    if (/(auto|scroll)/.test(style.overflowX) && node.scrollWidth > node.clientWidth + 2) return true;
  }
  return false;
}

// Seiten-Ansicht einer Tab-Wurzel für die Bahn: Markup plus eine optionale, bewusst
// schmale Vorschau-Bindung.
//
// Runde 7 (Bahn, c): Hier stand nur `definition(previewCtx).html`, und der Vorschau-Kontext
// trug `render: () => {}`. Die Nachbarseite in der Bahn bekam also NIE eine Bindung. Bei
// Listen fiel das nicht auf; beim Hinwischen zum Karten-Tab sähe man ein graues Rechteck in
// var(--field), und die Karte erschiene erst nach dem Wechsel. Ein Screen darf deshalb neben
// `bind` ein `vorschau(knoten, ctx)` liefern: das Wenige, das schon in der Bahn laufen darf.
// screens/karte.js hängt darin die echte Karte ein — zusammen mit (b) ist das DERSELBE
// Knoten, der nach der Ankunft aktiv wird; MapLibre entsteht also genau einmal.
function pageAnsichtFor(tab) {
  const routeId = TAB_ROUTE[tab];
  const definition = screens[routeId];
  if (!definition) return null;
  const previewCtx = {
    repo, nav, engine,
    route: { id: routeId, params: {} },
    params: {},
    ui: tabUi[tab],
    render: () => {},          // eine Vorschau rendert nichts nach
    toast: () => {},
    preview: true,
  };
  const ergebnis = definition(previewCtx);
  return { html: ergebnis.html, vorschau: ergebnis.vorschau || null, ctx: previewCtx };
}

// Eine Seite in die Bahn setzen: Markup, Rolle, Startversatz — und zuletzt die Vorschau-Bindung.
function seiteAnlegen(track, tab, offset, rolle) {
  const ansicht = pageAnsichtFor(tab);
  if (!ansicht) return null;
  const holder = document.createElement('div');
  holder.innerHTML = ansicht.html;
  const page = holder.firstElementChild;
  if (!page) return null;
  page.dataset.role = rolle;
  page.dataset.tab = tab;
  // Runde 7 (K7): Eine Nachbarseite gehoert der BAHN, nicht dem Abgleich. Ohne diesen Merker
  // ordnet kinderAbgleichen (core/html.js) die Kinder der Bahn nach INDEX zu: das Markup hat
  // genau eine Seite, im Baum liegen zwei — die Nachbarseite wurde also von jedem Render
  // entfernt, der mitten in einer Geste kam. Bei der Karte nahm das die lebende MapLibre-Karte
  // mit, ohne sie ins Depot zu retten. Jetzt fasst der Abgleich sie nie an; verworfen wird sie
  // ausschliesslich ueber seiteVerwerfen(), und das rettet vorher, was lebt.
  page.__morphFrei = true;
  page.style.pointerEvents = 'none';
  page.style.transform = `translateX(${offset * 100}%)`;
  track.appendChild(page);
  // Runde 7 (Bahn): Was beim letzten Mal gelebt hat, kommt an seinen Platz zurueck —
  // die Karte ist danach DERSELBE Knoten mit derselben MapLibre-Karte und demselben
  // Ausschnitt, nur in einer frisch gezeichneten Seite.
  fremdesEinsetzen(track, page);
  // Runde 8 (R8-65, Jonathan: „Tab-Wiedereintritt: Crew wieder ganz oben"): Die einlaufende Seite
  // steht an ihrem ANFANG — genau dort, wo man nach dem Wechsel landet (render() › tabEintritt).
  // Bis hierher setzte die Bahn die gemerkte Scrollposition (v6 A15b), damit eine zurueckkehrende
  // Seite nicht erst am Anfang erschien und dann nach unten sprang. Seit der Anfang das Ziel ist,
  // ist die frisch gezeichnete Seite (Scrollstand null) schon das richtige Bild: kein Sprung, weder
  // in der Vorschau noch nach der Ankunft.
  // Eine Vorschau darf die Bahn nie anhalten: was hier schiefgeht, bleibt in der Vorschau.
  if (ansicht.vorschau) { try { ansicht.vorschau(page, ansicht.ctx); } catch { /* egal */ } }
  return page;
}

function trackOf(root) {
  return root.querySelector('.tab-track');
}

// =========================================================================================
// Runde 7 (Bahn) — das Depot: lebende Teilbaeume ueberleben den Tabwechsel
// -----------------------------------------------------------------------------------------
// Eine Seite in der Bahn wird bei jedem Wechsel NEU aus dem Markup gebaut. Fuer Listen ist
// das richtig. Eine echte Karte ist aber kein Markup: MapLibre haengt an EINEM Knoten, und
// verschwindet der Knoten, raeumt map.js die Karte ab (MutationObserver) — bei jeder Ankunft
// waeren das ein neuer WebGL-Kontext, ein neuer Stil, neue Kacheln und ein sichtbares
// Aufblitzen. Genau das ist der Grund, warum es die Karte bisher nur als Unteransicht gab.
//
// Deshalb: Seiten, die `behalten` setzen (ui/components.js › screenScaffold), geben ihre
// data-fremd-Knoten beim Verschwinden ins Depot ab und bekommen sie in ihrer naechsten
// Fassung zurueck. Das Depot liegt IN der Bahn — ein ausgehaengter Knoten waere fuer den
// Browser weg und die Karte damit tot. Es ist 0 px breit sichtbar, aber voll gross im
// Layout, damit die Karte drinnen ihre Groesse behaelt und beim Zurueckkommen nicht erst
// neu rechnen muss. Der Abgleich fasst es nie an (__morphFrei, core/html.js).
const DEPOT_KLASSE = 'tab-depot';

function depotVon(track, anlegen = true) {
  const vorhanden = track.querySelector(`:scope > .${DEPOT_KLASSE}`);
  if (vorhanden || !anlegen) return vorhanden;
  // Ein Depot aus einer frueheren Bahn haette den Abgleich ueberlebt (__morphFrei) und
  // haenge sonst unsichtbar in einer fremden Seite — samt einer toten Karte darin.
  depotsAufraeumen(track);
  const depot = document.createElement('div');
  depot.className = DEPOT_KLASSE;
  depot.setAttribute('aria-hidden', 'true');
  depot.setAttribute('inert', '');
  depot.style.cssText = 'position:absolute;left:-20000px;top:0;width:100%;height:100%;visibility:hidden;pointer-events:none';
  depot.__morphFrei = true;
  track.appendChild(depot);
  return depot;
}

// Jedes Depot, das nicht zu DIESER Bahn gehoert, ist ein Ueberbleibsel und muss weg: der
// Abgleich fasst es nie an (__morphFrei), es wuerde also ewig weiterleben und einen
// WebGL-Zusammenhang festhalten. Verlaesst die App die Tab-Wurzeln (Raum, Chat, Details),
// gibt es gar keine Bahn mehr — dann fliegen ALLE Depots.
function depotsAufraeumen(track) {
  appElement.querySelectorAll(`.${DEPOT_KLASSE}`).forEach((depot) => {
    if (!track || depot.parentElement !== track) depot.remove();
  });
}

function fremdesRetten(track, page) {
  if (!page || page.dataset.behalten !== '1') return;
  const lebende = page.querySelectorAll('[data-fremd][data-role]');
  if (!lebende.length) return;
  const depot = depotVon(track);
  // appendChild verschiebt in EINEM Schritt — der Knoten ist nie wirklich ausgehaengt.
  lebende.forEach((knoten) => depot.appendChild(knoten));
}

function fremdesEinsetzen(track, page) {
  if (!page || page.dataset.behalten !== '1') return;
  const depot = depotVon(track, false);
  if (!depot) return;
  page.querySelectorAll('[data-fremd][data-role]').forEach((platz) => {
    const gerettet = depot.querySelector(`:scope > [data-fremd][data-role="${platz.dataset.role}"]`);
    if (gerettet) platz.replaceWith(gerettet);
  });
}

// Eine Seite verlaesst die Bahn: erst retten, was lebt, dann entfernen.
function seiteVerwerfen(track, page) {
  if (!page || !page.isConnected) return;
  fremdesRetten(track, page);
  page.remove();
}

// Was von einer Bewegung oder einem Vorbau uebrig ist, wenn die App die Tab-Wurzeln verlaesst.
function bahnResteAufraeumen() {
  appElement.querySelectorAll('.tab-page[data-role="incoming"], .tab-page[data-role^="passing"]')
    .forEach((page) => seiteVerwerfen(page.parentElement, page));
}

function activePageOf(track) {
  return track.querySelector('.tab-page[data-role="active"]');
}

// Nachbarseite in die Bahn setzen (rechts bei dir>0, links bei dir<0) und zurückgeben.
function ensureNeighbour(track, tab, dir) {
  const existing = track.querySelector('.tab-page[data-role="incoming"]');
  if (existing && existing.dataset.tab === tab) return existing;
  if (existing) seiteVerwerfen(track, existing);
  return seiteAnlegen(track, tab, dir > 0 ? 1 : -1, 'incoming');
}

// v7 A15a: Wie ensureNeighbour, aber fuer eine beliebige Position in der Bahn — damit die
// Seiten ZWISCHEN Start und Ziel sichtbar durchlaufen, statt uebersprungen zu werden.
// Runde 7 (Bahn, a): Jede Zwischenseite traegt eine EIGENE Rolle ('passing-1', 'passing-2'),
// weil es bei vier Tabs zwei davon geben kann (Crew -> Profil).
function ensurePageAt(track, tab, offset, rolle) {
  const vorhanden = track.querySelector(`.tab-page[data-role="${rolle}"]`);
  if (vorhanden && vorhanden.dataset.tab === tab) return vorhanden;
  if (vorhanden) seiteVerwerfen(track, vorhanden);
  return seiteAnlegen(track, tab, offset, rolle);
}

function neighbourTab(tab, dir) {
  const index = TABS.indexOf(tab) + dir;
  return index >= 0 && index < TABS.length ? TABS[index] : null;
}

// Gemeinsame Abschlussbewegung für Tap UND Drag. fromRatio ist der bereits gezogene
// Anteil (0 bei Tap), damit die Bewegung dort fortsetzt, wo der Finger aufgehört hat.
// Runde 6 (Jonathan: „wenn ich den Tab wechsle, kommt unten das aktive Zeichen erst nach").
// Gemessen: slideTo() schiebt die Seiten sofort, ruft nav.setTab() aber erst NACH der Bewegung —
// und erst dieser Render zeichnet die Fußleiste neu. Sie schaltete also eine ganze
// Animationslänge zu spät um. Die Leiste liegt außerhalb der Bahn, sie kann sofort umschalten,
// ohne die Bewegung zu stören; das Tippen überlebt es, weil die Handler am Wurzelknoten hängen.
function tabLeisteSofort(tab) {
  if (!repo) return;
  const leiste = appElement.querySelector('.tab-nav');
  if (!leiste) return;
  const offen = (repo.getFriendRequests() || []).length;
  leiste.innerHTML = tabBar(tab, { zahlen: { crew: offen }, tabs: TABS });
}

// Runde 7 (Bahn, b): Die eingelaufene Seite ist die, die der Mensch SIEHT — sie wird die
// aktive. Vorher blieb die alte Seite als 'active' stehen; der folgende Abgleich ordnet nach
// INDEX zu (core/html.js kinderAbgleichen), morphte also die ALTE Seite und entfernte die
// sichtbare. Bei Listen fiel das nicht auf. Für eine Karte heißt es: der data-fremd-Knoten
// verschwindet, karteHalten sieht beim nächsten Bind einen anderen Knoten und baut MapLibre
// bei JEDER Ankunft neu auf — neuer WebGL-Kontext, neue Kacheln, sichtbares Aufblitzen.
function seiteUebernehmen(track, alte, neue, tab) {
  if (!neue || !neue.isConnected) return;
  if (alte && alte !== neue) seiteVerwerfen(track, alte);
  neue.dataset.role = 'active';
  neue.dataset.tab = tab;
  // Ab jetzt ist sie die Seite der Route — der Abgleich gleicht sie wieder ab.
  delete neue.__morphFrei;
  // Die Bewegungswerte gehören der Bewegung, nicht der Seite.
  neue.style.transition = '';
  neue.style.transform = '';
  neue.style.opacity = '';
  neue.style.pointerEvents = '';
}

// Runde 7 (K7, gemessen): Ein Tipp auf einen Tab-Knopf blockierte den Hauptfaden 193 ms
// (6-fach gebremst), BEVOR sich irgendetwas bewegte — in dieser Zeit entsteht die Zielseite:
// Markup, Einhaengen, Layout. Zwischen Finger-runter und Finger-hoch liegen auf einem Telefon
// aber 80-150 ms, in denen nichts zu tun ist. Genau dort wird jetzt gebaut. Findet slideTo die
// Seite schon vor, faengt die Bewegung sofort an.
//
// Die vorgebaute Seite gehoert der Bahn (data-role incoming/passing, __morphFrei, 0 Breite im
// sichtbaren Fenster). Kommt der Tipp nicht, wird sie wieder verworfen — ueber seiteVerwerfen,
// damit eine lebende Karte darin ins Depot zurueckgeht statt zu sterben.
let vorbauMarke = 0;
let vorbauOffen = 0;
let gesteLaeuft = false;

function vorbauVerwerfen(marke) {
  if (vorbauOffen !== marke || sliding || gesteLaeuft) return;
  vorbauOffen = 0;
  const root = appElement.firstElementChild;
  const track = root && trackOf(root);
  if (!track) return;
  track.querySelectorAll('.tab-page[data-role="incoming"], .tab-page[data-role^="passing"]')
    .forEach((page) => seiteVerwerfen(track, page));
}

function bahnVorbauen(zielTab) {
  if (sliding || gesteLaeuft || !zielTab) return;
  const root = appElement.firstElementChild;
  const track = root && trackOf(root);
  const vonTab = TAB_ROOTS[nav.current().id];
  if (!track || !vonTab || zielTab === vonTab) return;
  const vonIndex = TABS.indexOf(vonTab);
  const zuIndex = TABS.indexOf(zielTab);
  if (vonIndex < 0 || zuIndex < 0) return;
  const dir = zuIndex > vonIndex ? 1 : -1;
  const distanz = Math.abs(zuIndex - vonIndex);
  ensureNeighbour(track, zielTab, dir);
  for (let schritt = 1; schritt < distanz; schritt += 1) {
    ensurePageAt(track, TABS[vonIndex + dir * schritt], dir * schritt, `passing-${schritt}`);
  }
  vorbauMarke += 1;
  vorbauOffen = vorbauMarke;
  const marke = vorbauMarke;
  window.setTimeout(() => vorbauVerwerfen(marke), 900);
}

// Der Vorbau haengt an der Fussleiste — sie liegt ausserhalb der Bahn und ueberlebt jeden
// Render (tabLeisteSofort tauscht nur ihren Inhalt).
function bindeVorbau(root) {
  const leiste = root.querySelector('.tab-nav');
  if (!leiste || leiste.__vorbau) return;
  leiste.__vorbau = true;
  const runter = (ziel) => {
    const knopf = ziel?.closest?.('[data-act="tab"]');
    if (knopf?.dataset.tab) bahnVorbauen(knopf.dataset.tab);
  };
  leiste.addEventListener('pointerdown', (ereignis) => { if (ereignis.pointerType !== 'touch') runter(ereignis.target); });
  // Runde 8c (R8-68, Jonathan: „Tabs muessen am Handy oft zweimal gedrueckt werden"): Der Vorbau
  // setzt im touchstart ganze Seiten in die Bahn — sichtbarer neuer Inhalt, waehrend der Finger
  // noch liegt. WebKit (iPhone, WKWebView der App) wertet genau das als „der Tipp hat Inhalt
  // aufgedeckt" und macht aus dem ersten Tipp nur ein Hover: kein click, der Tab bleibt stehen;
  // erst der zweite Tipp kommt durch. Chrome kennt diese Regel nicht (gemessen: 40 von 40 auch
  // ohne Aenderung, scratch/r8c-tipp-mess.mjs) — deshalb fiel es nur am Handy auf.
  // Der Wechsel haengt deshalb nicht mehr am click des Browsers: Ein Finger, der auf demselben
  // Tab-Knopf losgelassen wird, auf dem er aufsetzte, und sich dabei kaum bewegt hat, loest den
  // Tab selbst aus (knopf.click() — derselbe Weg wie jeder Klick, dieselben Handler). Das
  // preventDefault verhindert den nachgeschobenen Browser-click; es gibt keinen doppelten Wechsel.
  let finger = null;
  leiste.addEventListener('touchstart', (ereignis) => {
    const knopf = ereignis.touches.length === 1 ? ereignis.target?.closest?.('[data-act="tab"]') : null;
    const punkt = ereignis.touches[0];
    finger = knopf ? { knopf, x: punkt.clientX, y: punkt.clientY } : null;
    runter(ereignis.target);
  }, { passive: true });
  leiste.addEventListener('touchmove', (ereignis) => {
    const punkt = ereignis.touches[0];
    if (finger && punkt && Math.hypot(punkt.clientX - finger.x, punkt.clientY - finger.y) > 10) finger = null;
  }, { passive: true });
  leiste.addEventListener('touchcancel', () => { finger = null; }, { passive: true });
  leiste.addEventListener('touchend', (ereignis) => {
    const war = finger;
    finger = null;
    const punkt = ereignis.changedTouches[0];
    if (!war || !punkt || ereignis.touches.length) return;
    if (Math.hypot(punkt.clientX - war.x, punkt.clientY - war.y) > 10) return;
    const knopf = document.elementFromPoint(punkt.clientX, punkt.clientY)?.closest?.('[data-act="tab"]');
    if (!knopf || knopf.dataset.tab !== war.knopf.dataset.tab || !leiste.contains(knopf)) return;
    if (ereignis.cancelable) ereignis.preventDefault();
    knopf.click();
  }, { passive: false });
}

function slideTo(targetTab, options = {}) {
  const root = appElement.firstElementChild;
  const track = root && trackOf(root);
  const currentTab = TAB_ROOTS[nav.current().id];
  vorbauOffen = 0;   // ab hier gehoeren die Seiten der Bewegung
  if (!track || !currentTab || sliding) return;
  if (targetTab === currentTab) { settleTrack(track, 0); return; }
  const vonIndex = TABS.indexOf(currentTab);
  const zuIndex = TABS.indexOf(targetTab);
  if (vonIndex < 0 || zuIndex < 0) { nav.setTab(targetTab); return; }
  const dir = zuIndex > vonIndex ? 1 : -1;
  // Runde 7 (Bahn, a): Die DISTANZ entscheidet, wie viele Seiten die Bahn traegt. Vorher
  // kannte slideTo nur Distanz 1 und 2. Bei vier Tabs gibt es Distanz 3 (Crew -> Profil):
  // die alte Seite stand dann bei -3 Breiten, die neue bei +3 — mitten in der Bewegung war
  // das Fenster ZWEI Seitenbreiten lang leer, ein sichtbarer Blitz. Jetzt laeuft JEDE
  // Zwischenseite mit, egal wie weit der Sprung geht.
  const distanz = Math.abs(zuIndex - vonIndex);

  const current = activePageOf(track);
  const incoming = ensureNeighbour(track, targetTab, dir);
  if (!current || !incoming) { nav.setTab(targetTab); return; }
  const zwischenTabs = [];
  for (let schritt = 1; schritt < distanz; schritt += 1) zwischenTabs.push(TABS[vonIndex + dir * schritt]);
  const zwischen = zwischenTabs
    .map((tab, i) => ensurePageAt(track, tab, dir * (i + 1), `passing-${i + 1}`))
    .filter(Boolean);
  // Was von einem frueheren, laengeren Sprung stehengeblieben ist, gehoert nicht in dieses Bild.
  track.querySelectorAll('.tab-page[data-role^="passing"]').forEach((el) => {
    if (!zwischen.includes(el)) seiteVerwerfen(track, el);
  });

  sliding = true;
  // Zeitgleich mit der Bewegung, nicht danach.
  tabLeisteSofort(targetTab);
  // Startwerte erzwingen, damit der Übergang einen Ausgangszustand hat.
  const startRatio = options.fromRatio || 0;
  const bewegte = [current, incoming, ...zwischen];
  bewegte.forEach((el) => { el.style.transition = 'none'; });
  current.style.transform = `translateX(${startRatio * 100}%)`;
  zwischen.forEach((el, i) => { el.style.transform = `translateX(${(startRatio + dir * (i + 1)) * 100}%)`; });
  incoming.style.transform = `translateX(${(startRatio + dir * distanz) * 100}%)`;
  void current.offsetWidth;

  // Die Bahn faehrt um genau DISTANZ Breiten; jede Seite behaelt ihren Abstand zu den
  // anderen. Die Zwischenseiten laufen dadurch sichtbar durch das Fenster. Ein weiterer
  // Sprung darf sich nicht anfuehlen wie ein Schleudern — die Dauer waechst gestaffelt mit.
  // Runde 8 (R8-66): Mit fuenf Tabs gibt es auch den Sprung ueber vier Seiten (Crew → Profil).
  const streckung = [1, 1, 1.45, 1.8, 2.05][distanz] || 2.05;
  const dauer = Math.round(SWIPE_MS * streckung);
  const easeN = `transform ${dauer}ms cubic-bezier(.22,.61,.36,1), opacity ${dauer}ms ease-out`;
  bewegte.forEach((el) => { el.style.transition = easeN; });
  current.style.transform = `translateX(${-dir * distanz * 100}%)`;
  current.style.opacity = '0';           // Gegen-Fade
  zwischen.forEach((el, i) => { el.style.transform = `translateX(${-dir * (distanz - i - 1) * 100}%)`; });
  incoming.style.transform = 'translateX(0)';
  incoming.style.opacity = '1';

  // Runde 7 (K7, gemessen mit 6-fach gebremster Maschine): Hier standen ZWEI Dinge in
  // demselben Bild — die billige Uebergabe (Rollen setzen, alte Seite weg) und der VOLLE
  // Render, der 227 ms braucht. Der Render fiel damit genau in das Bild, in dem die Bewegung
  // ihren letzten Schritt macht: die Seite blieb auf halbem Weg stehen und sass dann mit einem
  // Ruck an ihrem Platz. Aufgeteilt: erst landen, ein Bild spaeter die Route nachziehen.
  window.setTimeout(() => {
    zwischen.forEach((el) => seiteVerwerfen(track, el));
    seiteUebernehmen(track, current, incoming, targetTab);
    requestAnimationFrame(() => {
      sliding = false;
      deferredRender = false;   // der Tabwechsel rendert ohnehin neu
      nav.setTab(targetTab);
      tabZustandLeeren(currentTab);
      zwischenTabs.forEach((tab) => tabZustandLeeren(tab));
    });
  }, dauer);
}

// Ruhig zurückschnappen, ohne die Seite zu wechseln.
function settleTrack(track, ratio) {
  const current = activePageOf(track);
  const incoming = track.querySelector('.tab-page[data-role="incoming"]');
  if (!current) return;
  sliding = true;
  const ease = `transform 200ms ease-out, opacity 200ms ease-out`;
  current.style.transition = ease;
  current.style.transform = 'translateX(0)';
  current.style.opacity = '1';
  if (incoming) {
    const dir = ratio < 0 ? 1 : -1;
    incoming.style.transition = ease;
    incoming.style.transform = `translateX(${dir * 100}%)`;
  }
  window.setTimeout(() => {
    sliding = false;
    if (incoming) seiteVerwerfen(track, incoming);
    // Runde 7 (Bahn, a): Praefix-Auswahl — es kann mehrere Zwischenseiten geben.
    track.querySelectorAll('.tab-page[data-role^="passing"]').forEach((el) => seiteVerwerfen(track, el));
    current.style.transition = '';
    if (deferredRender) { deferredRender = false; render(); }
  }, 210);
}

// v5 A23: Was „Wurzel" fuer einen Tab bedeutet, steht hier an EINER Stelle. Der
// UI-Zustand des Tabs wird geleert (Ansicht, offene Bereiche, Sheets); der Routen-Stack
// geht ueber nav auf die Tab-Wurzel zurueck, falls man tiefer steht.
// v6 A15a: Die frühere Positivliste musste bei jeder neuen Ansicht von Hand gepflegt
// werden — und war es nicht: der Meet-Tab merkte sich seine Ansicht unter 'view' im
// eigenen Browser-Zustand, den die Liste nicht kannte. Ein zweites Tippen ließ die
// Kartenansicht deshalb einfach stehen. Jetzt wird der Tab-Zustand vollständig geleert;
// nur was eine laufende Bewegung trägt, bleibt ausdrücklich erhalten.
const RESET_AUSNAHMEN = ['freeLook', 'freeSwap', 'hold'];

// Runde 5 (F1, Jonathan: „wenn man zu profil, crew oder meet switcht, das man immer direkt auf der
// standart ansicht ist, und nicht die letzte ansicht gespeichert wird wie kalender oder karte"):
// Wer einen Tab VERLÄSST, lässt ihn in der Standardansicht zurück. Geleert wird beim Verlassen, nicht
// beim Ankommen — so zeigt schon die Vorschau beim nächsten Wischen die Liste statt Kalender oder Karte,
// und nichts springt nach dem Wechsel um. Innerhalb eines Tabs (Kalender → Meet → zurück) bleibt alles.
// Runde 7 (Karten-Tab, bewusste Entscheidung): Was hier geleert wird, ist der UI-Zustand des
// Tabs — bei der Karte also die Ebenen-Auswahl (Leute/Meets). Sie kehrt damit wie jede andere
// Ansicht in ihren Ausgangszustand zurück; das ist genau Jonathans Wunsch aus Runde 5 (F1).
// AUSSCHNITT UND ZOOM liegen NICHT hier, sondern in der Karte selbst (ui/map.js hält sie unter
// 'karte-tab'). Sie überleben den Tabwechsel deshalb — und sollen es: wer zurückkommt, sieht
// wieder seine Gegend, statt jedes Mal neu auf das eigene Land herauszuzoomen. Möglich wurde das
// erst dadurch, dass die eingelaufene Seite die aktive wird (seiteUebernehmen) — vorher wurde
// der Kartenknoten bei jeder Ankunft weggeworfen und MapLibre neu gebaut.
function tabZustandLeeren(tab) {
  const zustand = tabUi[tab];
  if (!zustand) return;
  Object.keys(zustand).forEach((schluessel) => {
    if (!RESET_AUSNAHMEN.includes(schluessel)) delete zustand[schluessel];
  });
}

// R8-65: Ein zweiter Tipp auf den aktiven Tab ist ein Betreten wie jeder andere — der Bereich
// steht danach an seinem Anfang (render() › tabEintritt liest und leert den Merker).
let erneutGetippt = null;

function resetTab(tab) {
  tabZustandLeeren(tab);
  erneutGetippt = tab;
  const wurzel = TAB_ROUTE[tab];
  if (nav.current().id !== wurzel) nav.resetTo(wurzel, {});
  else render();
}

// v7 P0: Seit morphInto immer abgleicht, ueberlebt die Bahn jeden Tabwechsel — und
// damit auch dieser Handler. Ein ueber activeTab GESCHLOSSENER Wert waere danach
// veraltet: nach crew -> meet haette der Trackpad-Wisch weiter mit 'crew' gerechnet und
// waere von meet aus zu profil gesprungen statt zu crew. Der aktive Tab wird deshalb bei
// JEDEM Ereignis frisch aus der Route gelesen.
// --- Runde 6 (D1) — Zurück-Wischen vom linken Rand ------------------------------------------
// Jonathan: „ich öffne chat und profil und will zurück, dann wische ich einfach vom linken
// bildschirmrand zur mitte." In der App vom Home-Bildschirm gibt es keine Browser-Geste; die App
// muss sie selbst mitbringen. Sie beginnt nur in den ersten 24 px und nur, wenn es etwas
// zurückzugehen gibt — sonst bleibt der Wisch der Tab-Bahn, wie er ist. Die Seite folgt dem Finger;
// beim Loslassen entscheidet der Weg oder der Schwung.
const ZURUECK_RAND = 24;
const ZURUECK_ANTEIL = 0.3;
let zurueckZug = null;

// Runde 6 (gemessen, nachdem die Geste stand): Lag ein Sheet über der Seite, schob der Wisch die
// SEITE HINTER dem Sheet weg — 287 px gemessen — und sprang eine Ebene zurück. Das Sheet ging mit
// unter, ohne dass sein Screen etwas davon erfuhr (der Schleier-Klick, über den jedes Sheet
// schließt, lief nie). Für den Nutzer ist ein offenes Sheet aber selbst eine Ebene. Also: Solange
// eines offen ist, gehört „zurück" dem Sheet — es schließt auf dem normalen Weg, die Seite bleibt
// stehen. Der nächste Wisch führt dann wie gewohnt eine Seite zurück (Jonathan: „wiederholbar").
function zurueckMoeglich() {
  // Der Guide liegt über allem und hat seine eigenen Wege (Wischen, Überspringen).
  if (guideOffen()) return false;
  if (offenesSheet(appElement)) return true;
  // Eine große Bildansicht hängt sich in den Verlauf; sie geht zuerst zu.
  if (globalThis.history?.state?.crewBildGross) return true;
  return nav.depth() > 1;
}

function zurueckGehen() {
  const sheet = zurueckZug?.sheet?.schleier?.isConnected ? zurueckZug.sheet : offenesSheet(appElement);
  if (sheet) { sheet.schleier.click(); return; }
  if (globalThis.history?.state?.crewBildGross) { globalThis.history.back(); return; }
  const tab = tabForRoute(nav.current().id);
  nav.back(TAB_ROUTE[tab] || 'crew.home');
}

function bindeZurueckWisch(wurzel) {
  if (!wurzel || wurzel.__zurueckWisch) return;
  wurzel.__zurueckWisch = true;
  const seite = () => wurzel.firstElementChild;

  const ruhe = (sanft) => {
    const s = seite();
    if (s) {
      s.style.transition = sanft ? 'translate .22s cubic-bezier(.22,.61,.36,1)' : '';
      s.style.translate = '';
      if (sanft) setTimeout(() => { s.style.transition = ''; s.style.willChange = ''; }, 240);
      else s.style.willChange = '';
    }
    zurueckZug = null;
    hoerAuf();
  };

  // Runde 7, Welle 3 (K8, gemessen) — DIE GRÖSSTE EINZELURSACHE DES RUCKELNS AUS DIESER DATEI:
  // Der touchmove-Horcher unten hing DAUERHAFT und NICHT-PASSIV am #app, also über der ganzen
  // App. Ein nicht-passiver touchmove-Horcher nimmt dem Browser den Compositor-Schnellweg: Er
  // darf erst rollen, wenn der Hauptfaden geantwortet hat — bei JEDER Rollgeste irgendwo in der
  // App, nicht nur am Rand. Genau das ist das Ruckeln, das Jonathan „sehr stark“ nennt.
  // Die Geste beginnt aber nur in den ersten 24 px und nur, wenn es etwas zurückzugehen gibt.
  // Der Horcher wird deshalb erst in touchstart angemeldet, wenn ein solcher Zug wirklich
  // beginnen kann, und beim Loslassen wieder abgemeldet. touchstart läuft vor touchmove — ein
  // dort angemeldeter Horcher sieht jedes folgende touchmove desselben Fingers und darf es
  // weiterhin abbrechen (preventDefault). Im Ruhezustand hängt DIESE Rand-Geste keinen
  // nicht-passiven Horcher mehr an #app; geprüft in scratch/r7b-bahn.mjs (K8-Horcherzählung).
  // Über der App liegen aus app.js im Ruhezustand aber weiterhin ZWEI nicht-passive Horcher:
  // touchmove und wheel an .tab-track (bindTabTrack) — gemessen mit aufgelöster Herkunft auf
  // crew.home bei 360 px (scratch/r7d-pruef-bahn.mjs P2b, scratch/r7e-einladung.mjs E5). Sie
  // brauchen preventDefault für den Tab-Wisch mit dem Finger und die Trackpad-Geste; der
  // Compositor-Schnellweg für touchmove bleibt damit über jeder Tab-Seite aus.
  let zugHorcht = false;
  const hoerAuf = () => {
    if (!zugHorcht) return;
    zugHorcht = false;
    wurzel.removeEventListener('touchmove', zugBewegung, { capture: true });
  };
  const horchen = () => {
    if (zugHorcht) return;
    zugHorcht = true;
    wurzel.addEventListener('touchmove', zugBewegung, { capture: true, passive: false });
  };

  wurzel.addEventListener('touchstart', (ereignis) => {
    if (ereignis.touches.length !== 1) { zurueckZug = null; hoerAuf(); return; }
    const t = ereignis.touches[0];
    if (t.clientX > ZURUECK_RAND || !zurueckMoeglich()) { hoerAuf(); return; }
    zurueckZug = { x: t.clientX, y: t.clientY, id: t.identifier, t: Date.now(), aktiv: false, weg: 0, sheet: offenesSheet(appElement) };
    horchen();
  }, { capture: true, passive: true });

  function zugBewegung(ereignis) {
    if (!zurueckZug) { hoerAuf(); return; }
    const t = [...ereignis.touches].find((punkt) => punkt.identifier === zurueckZug.id);
    if (!t) return;
    const dx = t.clientX - zurueckZug.x;
    const dy = t.clientY - zurueckZug.y;
    if (!zurueckZug.aktiv) {
      // Wer senkrecht zieht, will scrollen — dann gehört die Geste nicht uns.
      if (Math.abs(dy) > 12 && Math.abs(dy) > Math.abs(dx)) { zurueckZug = null; hoerAuf(); return; }
      if (dx < 12) return;
      zurueckZug.aktiv = true;
      // Unter einem offenen Sheet bewegt sich die Seite nicht — sie bleibt ja stehen. Der Zug
      // gehört aber trotzdem UNS: Wer hier einfach aussteigt, überlässt ihn dem Browser, und der
      // macht daraus seine eigene Rand-Geste und verlässt die App (gemessen: die Seite landete
      // außerhalb von Crew). Deshalb wird weiter unten in jedem Fall preventDefault() gerufen.
      if (!zurueckZug.sheet) {
        const s = seite();
        if (s) { s.style.transition = 'none'; s.style.willChange = 'translate'; }
      }
    }
    zurueckZug.weg = Math.max(0, dx);
    if (ereignis.cancelable) ereignis.preventDefault();
    if (zurueckZug.sheet) return;
    const s = seite();
    if (s) s.style.translate = `${(zurueckZug.weg * 0.92).toFixed(1)}px`;
  }

  const schluss = () => {
    hoerAuf();
    if (!zurueckZug) return;
    if (!zurueckZug.aktiv) { zurueckZug = null; return; }
    const breite = wurzel.clientWidth || globalThis.innerWidth || 390;
    const dauer = Math.max(1, Date.now() - zurueckZug.t);
    const schwung = zurueckZug.weg / dauer;
    const geht = zurueckZug.weg > breite * ZURUECK_ANTEIL || (schwung > 0.5 && zurueckZug.weg > 40);
    if (!geht) { ruhe(true); return; }
    // Liegt ein Sheet über der Seite, geht nur das Sheet zu — auf seinem normalen Weg
    // (Klick auf den Schleier), damit sein Screen den Zustand sauber aufräumt.
    const sheet = zurueckZug.sheet?.schleier?.isConnected ? zurueckZug.sheet : null;
    if (sheet) { zurueckZug = null; sheet.schleier.click(); return; }
    const s = seite();
    if (s) { s.style.transition = 'translate .16s ease-out'; s.style.translate = `${breite}px`; }
    zurueckZug = null;
    setTimeout(() => {
      if (s) { s.style.transition = ''; s.style.translate = ''; s.style.willChange = ''; }
      zurueckGehen();
    }, 150);
  };
  wurzel.addEventListener('touchend', schluss, { capture: true });
  wurzel.addEventListener('touchcancel', () => ruhe(true), { capture: true });
}

function bindTabTrack(root, startTab) {
  const aktiverTab = () => TAB_ROOTS[nav.current().id] || startTab;
  const track = trackOf(root);
  if (!track) return;
  const current = activePageOf(track);
  if (!current) return;

  let start = null;
  let last = null;
  let mode = null;             // null unentschieden | 'swipe' | 'reject'
  let incoming = null;
  let dir = 0;

  const width = () => track.getBoundingClientRect().width || 1;

  function apply(dx) {
    const ratio = dx / width();
    current.style.transition = 'none';
    current.style.transform = `translateX(${ratio * 100}%)`;
    current.style.opacity = String(Math.max(0.35, 1 - Math.abs(ratio) * 0.75));
    if (incoming) {
      incoming.style.transition = 'none';
      incoming.style.transform = `translateX(${(ratio + dir) * 100}%)`;
      incoming.style.opacity = String(Math.min(1, 0.35 + Math.abs(ratio) * 0.75));
    }
  }

  // --- Ein gemeinsamer Kern für Maus und Touch -------------------------------------
  // Nur die Quelle der Koordinaten unterscheidet sich; Schwelle, Bewegung, Abschluss
  // und Klicksperre sind identisch. Genau das verlangt P0-1: gleiches Verhalten in
  // Desktop-Maus, Trackpad, Phone-Preview und Touch.

  function begin(x, y, target) {
    if (sliding) return false;
    gesteLaeuft = true;
    vorbauOffen = 0;   // was in der Bahn liegt, gehoert jetzt der Geste
    if (ownsHorizontalGesture(target, track)) { mode = 'reject'; start = null; return false; }
    start = { x, y, t: Date.now() };
    last = { x, y, t: Date.now() };
    mode = null;
    incoming = null;
    dir = 0;
    return true;
  }

  // Rückgabe: true, sobald die Geste uns gehört (Aufrufer ruft dann preventDefault).
  function moveTo(x, y) {
    if (!start || mode === 'reject') return false;
    const dx = x - start.x;
    const dy = y - start.y;
    const prev = last;
    last = { x, y, t: Date.now() };

    if (mode === null) {
      if (Math.abs(dy) > 10 && Math.abs(dy) >= Math.abs(dx)) { mode = 'reject'; return false; }
      if (Math.abs(dx) > 12 && Math.abs(dx) > Math.abs(dy) * 1.2) mode = 'swipe';
      else return false;
    }

    const wantDir = dx < 0 ? 1 : -1;
    const target = neighbourTab(aktiverTab(), wantDir);
    if (!target) {
      if (incoming) { incoming.remove(); incoming = null; }
      dir = 0;
      apply(dx * 0.28);
      return true;
    }
    if (dir !== wantDir) {
      dir = wantDir;
      incoming = ensureNeighbour(track, target, dir);
    }
    apply(dx);
    return true;
  }

  function end(x) {
    gesteLaeuft = false;
    if (!start) { mode = null; return; }
    const dx = x - start.x;
    const dt = Math.max(1, Date.now() - start.t);
    const wasSwipe = mode === 'swipe';
    start = null;
    last = null;
    mode = null;
    if (!wasSwipe) return;

    // Nach einem echten Drag den nachfolgenden Klick verschlucken (P0-1f):
    // sonst öffnet der Zug zusätzlich die Zeile, auf der er begann.
    suppressClickUntil = Date.now() + 350;

    const ratio = dx / width();
    // Abschluss entweder über den zurückgelegten Anteil ODER über die Wurfgeste.
    // Ohne die zweite Bedingung bräuchte ein 768px breites Tablet einen 215px langen
    // Zug — auf breiten Geräten fühlt sich ein rein anteiliger Schwellenwert falsch an.
    const speed = Math.abs(dx) / dt;                       // px pro ms
    const flung = Math.abs(dx) > 48 && speed > 0.35;
    const target = dir !== 0 ? neighbourTab(aktiverTab(), dir) : null;
    if (target && (Math.abs(ratio) > 0.28 || flung)) slideTo(target, { fromRatio: ratio });
    else settleTrack(track, ratio);
  }

  function abort() {
    gesteLaeuft = false;
    if (mode === 'swipe') { suppressClickUntil = Date.now() + 350; settleTrack(track, 0); }
    start = null;
    mode = null;
  }

  // --- Maus/Stift über Pointer-Ereignisse -------------------------------------------
  track.addEventListener('pointerdown', (event) => {
    if (event.pointerType === 'touch') return;      // Touch läuft über den Touch-Pfad
    if (event.button !== undefined && event.button !== 0) return;
    begin(event.clientX, event.clientY, event.target);
  });
  track.addEventListener('pointermove', (event) => {
    if (event.pointerType === 'touch') return;
    if (moveTo(event.clientX, event.clientY)) {
      event.preventDefault();
      // Pointer festhalten: sonst stirbt die Geste am Rand des Rahmens (P0-1e)
      // und die Seite bliebe dauerhaft versetzt stehen.
      try { track.setPointerCapture(event.pointerId); } catch { /* egal */ }
    }
  });
  track.addEventListener('pointerup', (event) => {
    if (event.pointerType === 'touch') return;
    end(event.clientX);
  });
  track.addEventListener('pointercancel', (event) => {
    if (event.pointerType === 'touch') return;
    abort();
  });

  // --- Touch über Touch-Ereignisse ---------------------------------------------------
  // Ein reiner Pointer-Pfad genügt hier NICHT: sobald der Compositor die horizontale
  // Geste als Scrollen deutet, feuert er pointercancel und der Swipe stirbt (genau der
  // gemessene Baseline-Fehler, 0 von 8 Wechseln). Deshalb wird die Absicht am
  // touchmove erkannt und dort mit preventDefault beansprucht — der Listener muss
  // dafür ausdrücklich nicht-passiv sein.
  track.addEventListener('touchstart', (event) => {
    // Beginnt die Geste am linken Rand und gibt es etwas zurückzugehen, gehört sie dem Zurück-Wisch.
    if (zurueckZug) { start = null; mode = 'reject'; return; }
    if (event.touches.length !== 1) { start = null; mode = 'reject'; return; }
    const t = event.touches[0];
    begin(t.clientX, t.clientY, event.target);
  }, { passive: false });

  track.addEventListener('touchmove', (event) => {
    if (event.touches.length !== 1) return;
    const t = event.touches[0];
    if (moveTo(t.clientX, t.clientY)) event.preventDefault();
  }, { passive: false });

  track.addEventListener('touchend', (event) => {
    const t = event.changedTouches[0];
    end(t ? t.clientX : (start ? start.x : 0));
  });
  track.addEventListener('touchcancel', abort);

  // Trackpad: die Zwei-Finger-Geste erzeugt wheel-Ereignisse, keine Pointer-Ereignisse.
  let wheelSum = 0;
  let wheelTimer = null;
  track.addEventListener('wheel', (event) => {
    if (sliding) return;
    if (Math.abs(event.deltaX) <= Math.abs(event.deltaY)) return;
    if (ownsHorizontalGesture(event.target, track)) return;
    event.preventDefault();
    wheelSum += event.deltaX;
    const wantDir = wheelSum < 0 ? -1 : 1;
    const target = neighbourTab(aktiverTab(), wantDir);
    if (target) {
      if (dir !== wantDir) { dir = wantDir; incoming = ensureNeighbour(track, target, dir); }
      apply(-wheelSum);
    } else {
      apply(-wheelSum * 0.28);
    }
    window.clearTimeout(wheelTimer);
    wheelTimer = window.setTimeout(() => {
      const ratio = -wheelSum / width();
      const commitTo = dir !== 0 ? neighbourTab(aktiverTab(), dir) : null;
      wheelSum = 0;
      if (commitTo && Math.abs(ratio) > 0.28) slideTo(commitTo, { fromRatio: ratio });
      else settleTrack(track, ratio);
    }, 90);
  }, { passive: false });

  // Klicksperre unmittelbar nach einem Drag.
  track.addEventListener('click', (event) => {
    if (Date.now() < suppressClickUntil) {
      event.stopPropagation();
      event.preventDefault();
    }
  }, true);
}


// v5 A19: Führt die Bindung aus und lässt dabei je Knoten und Ereignisart höchstens
// einen Handler zu. Der Eingriff gilt nur für die Dauer des Aufrufs und wird danach
// vollständig zurückgenommen — außerhalb verhält sich addEventListener normal.
function bindeEinmalig(fn, routenSchluessel = '') {
  const original = Element.prototype.addEventListener;
  const entfernen = Element.prototype.removeEventListener;
  Element.prototype.addEventListener = function bindGuard(type, handler, options) {
    const merker = `__ev_${type}`;
    const vorher = this[merker];
    // Gleiche Route, gleicher Knoten, gleiche Ereignisart: es bleibt beim vorhandenen
    // Handler — sonst liefe jeder Klick mehrfach.
    if (vorher && vorher.route === routenSchluessel) return undefined;
    // Andere Route: der alte Handler haelt einen veralteten Zustand fest und wird
    // sauber abgemeldet, bevor der neue kommt.
    if (vorher) entfernen.call(this, type, vorher.handler, vorher.options);
    this[merker] = { route: routenSchluessel, handler, options };
    return original.call(this, type, handler, options);
  };
  try {
    fn();
  } finally {
    Element.prototype.addEventListener = original;
  }
}

// Runde 2 (Jonathan): „Einstellungen sliden komplett von rechts ein über das Profil — das
// Profil ist still und bleibt. Auch wenn man einen Bereich in den Einstellungen öffnet."
// Die Unterseiten des Profils gleiten deshalb als ganze Seite ÜBER die stehende, statt mit dem
// kurzen 18-px-Eintritt zu erscheinen; zurück gleiten sie wieder hinaus. Sheets über den
// Einstellungen (MORPH_GRUPPE) und das Einladungs-Sheet sind keine Seiten und gleiten nicht.
// Runde 3 (Jonathan, N2): „Wenn ich eine Gruppe, einen Chat oder ein Profil öffne, sollen sie
// über den Bildschirm drüber gewischt werden, ähnlich wie bei Einstellungen." Vorher liefen dort
// nur Kopf, Liste und Fußleiste 18 px herein — die Aktivitätenbox über dem Chat blieb stehen.
// Jetzt gleitet die ganze Seite, und zurück gleitet sie wieder hinaus.
const GLEIT_RAEUME = new Set(['room.view', 'room.personDetails', 'room.crewDetails', 'room.allMeets']);

function gleitRoute(id) {
  if (GLEIT_RAEUME.has(id)) return true;
  return id.startsWith('profile.') && id !== 'profile.home' && id !== 'profile.friendAdd' && !MORPH_GRUPPE[id];
}

function reduzierteBewegung() {
  try { return Boolean(globalThis.matchMedia?.('(prefers-reduced-motion: reduce)').matches); } catch { return false; }
}

// Ein Standbild der alten Seite — samt Scrollständen, sonst sähe man beim Gleiten ihren Anfang.
function abbildMitScroll(wurzel) {
  const abbild = wurzel.cloneNode(true);
  const staende = [];
  wurzel.querySelectorAll('*').forEach((knoten, index) => {
    if (knoten.scrollTop || knoten.scrollLeft) staende.push([index, knoten.scrollTop, knoten.scrollLeft]);
  });
  abbild.__scrollStaende = staende;
  return abbild;
}

// Runde 3 (Jonathan, N1): „Beim Öffnen der Einstellungen sieht man zwei Handys nebeneinander.
// Es soll nur ein Handy sein, und von rechts wischt langsam eine zweite Seite rein."
// Vorher glitt der ganze Telefonrahmen (Rundung, Kontur, Schatten) von rechts neben dem
// stehenden herein. Jetzt bleibt EIN Rahmen stehen: Die bewegte Ebene wird auf das Innere des
// Rahmens beschnitten (clip-path an der ruhenden Hülle), verliert während der Bewegung ihre
// eigene Rahmenzeichnung und lässt die Statusleiste stehen — wie auf dem Gerät, wo die
// Statusleiste zum System gehört. Das Maß der Statusleiste steht in --gleit-oben am #app,
// weil der Abgleich die Attribute der Hülle selbst bei jedem Render neu setzt.
const GLEIT_MS = { rein: 360, raus: 320 };
let gleitUhr = null;
let gleitZaehler = 0;
function gleitenZeigen(wurzel, abbild, richtung) {
  clearTimeout(gleitUhr);
  const token = ++gleitZaehler;
  appElement.querySelectorAll(':scope > .gleit-ebene').forEach((alt) => alt.remove());
  abbild.classList.add('gleit-ebene');
  abbild.setAttribute('aria-hidden', 'true');
  abbild.setAttribute('inert', '');
  // Der Abgleich ordnet diese Ebene nie einer Seite zu und entfernt sie nicht (core/html.js).
  abbild.__morphFrei = true;
  // Das Standbild darf keinen Eintritt wiederholen, der beim alten Zeichnen lief.
  abbild.setAttribute('data-move', 'none');
  abbild.removeAttribute('data-gleiten');
  abbild.dataset.gleitEbene = richtung === 'rein' ? 'unten' : 'oben';
  const leiste = wurzel.querySelector('.runtime-phone > [data-role="statusleiste"]');
  appElement.style.setProperty('--gleit-oben', `${leiste ? leiste.offsetHeight : 0}px`);
  // Ein zweites Gleiten kurz nach dem ersten muss wieder von vorn anfangen.
  if (wurzel.dataset.gleiten) { delete wurzel.dataset.gleiten; void wurzel.offsetWidth; }
  wurzel.after(abbild);
  const kinder = abbild.querySelectorAll('*');
  for (const [index, oben, links] of abbild.__scrollStaende || []) {
    if (kinder[index]) { kinder[index].scrollTop = oben; kinder[index].scrollLeft = links; }
  }
  if (richtung === 'rein') wurzel.dataset.gleiten = 'rein';
  const bewegt = (richtung === 'rein' ? wurzel : abbild).querySelector('.runtime-phone');
  const ende = (event) => {
    if (event && (event.target !== bewegt || !/^gleiten/.test(event.animationName))) return;
    bewegt?.removeEventListener('animationend', ende);
    if (token !== gleitZaehler) return;
    clearTimeout(gleitUhr);
    abbild.remove();
    if (wurzel.dataset.gleiten) delete wurzel.dataset.gleiten;
  };
  bewegt?.addEventListener('animationend', ende);
  gleitUhr = setTimeout(() => ende(), GLEIT_MS[richtung] + 160);
}

// Runde 3 (S1, gemessen): „Wenn ich Notizen hinzufüge, springt er nach oben." Das Notizfeld
// bekommt beim Öffnen den Fokus, während sein Sheet noch unterhalb des Rahmens steht. Der
// Browser holt es in den Blick, indem er den TELEFONRAHMEN scrollt — eine Fläche, die gar
// nicht scrollen soll (overflow:hidden). Gemessen: 251 px, die ganze Seite fuhr nach oben
// und mit dem Sheet wieder herunter. Dieselbe Falle hat jede nicht scrollende Fläche.
// Rahmen, Bahn und Seite schneiden deshalb mit overflow:clip (nicht scrollbar), und für alle
// übrigen gilt: Eine Fläche ohne eigenes Scrollen bleibt auf null. Das Scroll-Ereignis kommt
// vor dem Zeichnen des Bildes — die Korrektur ist also nie zu sehen.
// Runde 7 (K8, gemessen): Diese Wache hing an JEDEM Rollereignis und fragte dort
// getComputedStyle — 78 Aufrufe in 2,5 s Rollen im Slide-up, jeder davon ein erzwungener
// Stil-Durchlauf mitten in der Bewegung, also an der teuersten Stelle, die es dafuer gibt.
// Ob eine Flaeche rollen DARF, aendert sich aber nur, wenn neu gezeichnet wird. Die Antwort
// wird deshalb je Knoten einmal geholt und bei jedem Render verworfen (siehe render()).
let rollErlaubnisse = new WeakMap();

function rollErlaubnis(el) {
  let erlaubt = rollErlaubnisse.get(el);
  if (!erlaubt) {
    const stil = getComputedStyle(el);
    erlaubt = { y: /(auto|scroll)/.test(stil.overflowY), x: /(auto|scroll)/.test(stil.overflowX) };
    rollErlaubnisse.set(el, erlaubt);
  }
  return erlaubt;
}

function festeFlaechenHalten(event) {
  const el = event.target;
  if (!(el instanceof Element) || !appElement.contains(el)) return;
  if (/^(INPUT|TEXTAREA|SELECT)$/.test(el.tagName) || el.isContentEditable || el.closest('[data-fremd]')) return;
  if (!el.scrollTop && !el.scrollLeft) return;
  const erlaubt = rollErlaubnis(el);
  if (el.scrollTop && !erlaubt.y) el.scrollTop = 0;
  if (el.scrollLeft && !erlaubt.x) el.scrollLeft = 0;
}
appElement.addEventListener('scroll', festeFlaechenHalten, { capture: true, passive: true });
// Die zweite Stelle, an der sich Stile ohne Render aendern koennen: eine andere Fenstergroesse
// (Medienabfrage). Auch dort verfaellt, was sich die Rollwache gemerkt hat.
globalThis.addEventListener?.('resize', () => { rollErlaubnisse = new WeakMap(); }, { passive: true });

// Runde 4 (C1, Jonathan): „Jede Slide-up soll geschlossen werden können, wenn man es weit genug
// nach unten slidet." EIN Mechanismus am #app für jedes Sheet jedes Bereichs (core/html.js).
// Er hängt an #app und nicht an einer Seite, damit er jeden Render und jeden Routenwechsel überlebt.
const sheetZug = sheetWischen(appElement);

const nav = createRouter(() => render());

function render() {
  // Ein Rerender mitten in der Tab-Animation wuerde die Bahn abreissen (der Toast oder
  // ein Repository-Ereignis kann jederzeit rendern wollen). Solche Renders werden bis
  // zum Ende der Bewegung zurueckgestellt und danach genau einmal nachgeholt.
  if (sliding) { deferredRender = true; return; }
  const route = nav.current();
  // Runde 7 (K8): Stile aendern sich in dieser App nur durch Rendern — hier verfaellt deshalb,
  // was sich die Rollwache gemerkt hat.
  rollErlaubnisse = new WeakMap();

  // Onboarding-Weiche: ohne abgeschlossenes Onboarding zeigt die App nur Onboarding-Routen.
  const settings = repo.getSettings();
  applyTheme(settings.appearance?.theme); // Fable: Thema (hell/dunkel/System) vor dem Zeichnen setzen
  if (!settings.onboarded && !route.id.startsWith('onboarding.') && screens['onboarding.welcome']) {
    // Hier sitzt sicher ein neuer Mensch vor der App — nur dann kommt nach dem Einrichten der
    // kurze Einstieg (web/ui/guide.js). Ein Demo-Bestand läuft hier nie durch.
    guideFaelligMerken();
    // Wer sich abmeldet und das Gerät weitergibt, richtet neu ein: Dann gehört der Einstieg
    // wieder geprüft, auch wenn das in dieser Sitzung schon einmal passiert ist.
    einstiegGeprueft = false;
    nav.resetTo(ERSTER_SCHRITT());
    return;
  }

  const definition = screens[route.id];
  const activeTab = TAB_ROOTS[route.id];
  // Runde 7 (Bahn): Ohne Tab-Wurzel gibt es keine Bahn — und damit auch nichts aufzubewahren.
  // Runde 7 (K7): Seit Nachbarseiten __morphFrei tragen, raeumt der Abgleich sie nicht mehr
  // mit weg — also raeumt die Bahn hier selbst auf, und zwar rettend (seiteVerwerfen).
  if (!activeTab) { bahnResteAufraeumen(); depotsAufraeumen(null); }
  // Die Art des Wechsels steuert den Eintrittsuebergang (COMPONENT_RULES 1).
  let move = nav.consumeMove ? nav.consumeMove() : 'none';
  // Runde 8 (R8-65, Jonathan: „Tab-Wiedereintritt: Crew wieder ganz oben; Karte wieder in der
  // Übersichts-Ansicht"): Wer einen Tab BETRITT, landet an seinem Anfang, und der Bereich darf sich
  // in seine Grundansicht zuruecksetzen (beimEintreten der Screen-Definition, weiter unten).
  // Betreten heisst: aus einem ANDEREN Bereich hierher gewechselt (Tipp, Wisch, Guide) — oder den
  // schon aktiven Tab noch einmal angetippt (resetTab). Nicht: aus dem Chat zurueck in die Liste,
  // aus der man kam, oder im selben Bereich von einer Unterseite auf dessen Tab — dort bleibt die
  // Liste, wo sie war (A7: innerhalb eines Tabs bleibt alles).
  const vorigeRoute = appElement.firstElementChild?.getAttribute('data-route') || '';
  const tabEintritt = Boolean(activeTab && definition)
    && ((move === 'tab' && Boolean(vorigeRoute) && tabForRoute(vorigeRoute) !== activeTab) || erneutGetippt === activeTab);
  erneutGetippt = null;
  // v5 A24: Innerhalb einer Abgleich-Gruppe gibt es keinen Seiteneintritt. Vorher rutschte
  // beim Oeffnen von „Wann" der komplette Hintergrund samt Kopfzeile und CTA 18 px von
  // rechts herein (pageEnterForward), obwohl sich nur ein Unterbereich oeffnete.
  const gruppe = MORPH_GRUPPE[route.id] || route.id;
  const alteGruppe = appElement.firstElementChild?.getAttribute('data-morph-group') || null;
  if (alteGruppe && alteGruppe === gruppe) move = 'none';
  // Runde 2: Einstellungen und ihre Bereiche gleiten als ganze Seite über die stehende.
  const alteWurzel = appElement.firstElementChild;
  const alteRoute = alteWurzel?.getAttribute('data-route') || null;
  const gleitRichtung = move === 'push' ? 'rein' : 'raus';
  // Runde 3: auch von Raum zu Raum (ein anderer Chat unter derselben Route) wird geglitten.
  const gleiten = Boolean(alteWurzel && alteRoute && !reduzierteBewegung()
    && ((move === 'push' && gleitRoute(route.id)) || (move === 'back' && gleitRoute(alteRoute))));
  const gleitAbbild = gleiten ? abbildMitScroll(alteWurzel) : null;
  if (gleiten) move = 'gleiten';
  // Runde 3 (S1, gemessen): Ein Render WÄHREND des Eintritts (Toast, Datenereignis, das
  // Nachtragen einer Kennung) setzte data-move sofort auf „none" — die CSS-Animation fiel
  // weg und Kopf, Liste und Fußleiste sprangen mitten in der Bewegung an ihr Ziel. Solange
  // der Eintritt läuft, bleibt die Art des Wechsels deshalb stehen.
  const bewegungNeu = move;
  if (move === 'none' && alteWurzel && alteRoute === route.id && (alteWurzel.__bewegungBis || 0) > performance.now()) {
    move = alteWurzel.getAttribute('data-move') || 'none';
  }
  // Tab-Wurzeln behalten ihren UI-Zustand je Tab (die Vorschau in der Bahn zeigt sonst
  // etwas anderes als die Seite, auf der man nach dem Wechsel landet).
  const ui = activeTab ? tabUi[activeTab] : uiFor(nav.depth() - 1, route);
  const ctx = { repo, nav, engine, route, params: route.params, ui, render, toast: showToast, freundHinzufuegen };

  captureScroll(appElement);

  let html;
  let bind = null;
  let beimEintreten = null;
  if (definition) {
    const result = definition(ctx);
    html = result.html;
    bind = result.bind || null;
    // R8-65: Was ein Bereich beim Betreten tut (die Karte springt in ihre Uebersicht zurueck).
    beimEintreten = typeof result.beimEintreten === 'function' ? result.beimEintreten : null;
  } else {
    // Übergangs-Fallback im Aufbau: statischer Referenz-Screen.
    const label = ROUTE_REFERENCE_FALLBACK[route.id];
    html = (label && resolveReferenceScreen(label)) || resolveReferenceScreen('04.1 Crew');
  }

  // v5 A19/A24: Innerhalb derselben Route wird IN PLACE abgeglichen. Nur so bleiben
  // Sheets gemountet, Scrollpositionen erhalten und der Hintergrund ruhig.
  let markup;
  if (activeTab && definition) {
    // v4 P0-1: Statusleiste und Bottom-Navigation gehören der App und stehen außerhalb
    // der Bahn. In der Bahn liegt die Seite; nur sie bewegt sich mit der Geste.
    const openRequests = (repo.getFriendRequests() || []).length;
    // v5 A19: Der Screen liefert Seite und Overlay-Träger NEBENEINANDER. Die Seite kommt
    // in die Bahn (dort wird geclippt und geschoben), der Träger direkt in den Rahmen —
    // so deckt ein Scrim auch Statusleiste und Navigation ab, ohne dass ein Knoten nach
    // dem Rendern verschoben werden muss.
    const trenner = html.indexOf('<div class="page-overlays"');
    const seiteHtml = trenner >= 0 ? html.slice(0, trenner) : html;
    const overlayHtml = trenner >= 0 ? html.slice(trenner) : '';
    const shell = phoneFrame(`${statusBar()}
<div class="tab-track" style="position:relative;flex:1;min-height:0;overflow:hidden;overflow:clip"><div class="crew-grund" data-role="grund" aria-hidden="true"></div>${seiteHtml.replace('class="tab-page"', 'class="tab-page" data-role="active" data-tab="' + activeTab + '"')}</div>
<div class="tab-nav" style="flex:none;position:relative;z-index:8">${tabBar(activeTab, { zahlen: { crew: openRequests }, tabs: TABS })}</div>
${overlayHtml}`);
    markup = `<div class="runtime-shell" data-route="${route.id}" data-morph-group="${gruppe}" data-move="${move}">${shell}${toastLayer()}</div>`;
  } else {
    markup = `<div class="runtime-shell" data-route="${route.id}" data-morph-group="${gruppe}" data-move="${move}">${html}${toastLayer()}</div>`;
  }
  morphInto(appElement, markup);
  // R8-65: Beim Betreten steht der Bereich an seinem Anfang. Die gemerkten Lagen seiner Flaechen
  // werden hier vergessen — das folgende restoreScroll setzt sie deshalb auf null, statt die Liste
  // an die Stelle von vorhin zurueckzuschieben.
  if (tabEintritt) scrollVergessen(appElement.querySelector('.tab-page[data-role="active"]'));
  // v7 P0: Der Abgleich laeuft jetzt immer und verwendet Scrollflaechen wieder. Die
  // gemerkte Position gehoert deshalb bei JEDEM Render gesetzt — vorher lief das nur
  // im Neuaufbau-Fall, den es nicht mehr gibt.
  restoreScroll(appElement);
  // Ein Render mitten im Wischen (Toast, Datenereignis) darf das Sheet nicht unter dem Finger wegziehen.
  sheetZug.nachRender();
  if (gleitAbbild) gleitenZeigen(appElement.firstElementChild, gleitAbbild, gleitRichtung);

  const root = appElement.firstElementChild;
  if (['push', 'back', 'replace', 'reset'].includes(bewegungNeu)) root.__bewegungBis = performance.now() + 300;

  // v5 A19: Wurde in place abgeglichen, ist die Wurzel DERSELBE Knoten wie vorher — die
  // Ereignis-Handler hängen also noch. Ein erneutes Binden würde sie verdoppeln und
  // jeden Klick mehrfach auslösen. Gebunden wird deshalb genau einmal je Wurzel.
  // Das ist zulässig, weil alle Handler über stabile Referenzen schließen (repo, nav,
  // ctx.ui, render) und ein Routenwechsel den Baum ohnehin neu aufbaut.
  // v5 A19: Der In-Place-Abgleich lässt vorhandene Knoten stehen und legt nur wirklich
  // neue an — etwa die Felder eines gerade geöffneten Sheets. Diese neuen Knoten brauchen
  // ihre Handler, die vorhandenen haben sie noch. Deshalb läuft die Bindung bei JEDEM
  // Render, aber jeder Knoten bekommt pro Ereignisart nur EINEN Handler.
  gebundeneWurzel = root;
  resetActions(root);            // alte Handler-Karten verwerfen, dann frisch fuellen
  bindeEinmalig(() => {
    bindActions(root, {
      // v4 P0-1: Tap und Drag teilen sich denselben Übergang.
      // v5 A23: Ein zweites Tippen auf den BEREITS AKTIVEN Tab setzt seinen Bereich auf
      // die Wurzel zurueck — Kartenansicht wird wieder Liste, aufgeklappte Bereiche und
      // offene Sheets schliessen. Vorher lief der Tap in slideTo() und verpuffte dort.
      tab: (data) => {
        if (activeTab && data.tab === activeTab) { resetTab(activeTab); return; }
        if (activeTab) return slideTo(data.tab);
        // Aus einer Unterseite (z. B. Meet-Details) in einen ANDEREN Tab: der verlassene Tab steht danach
        // wieder in seiner Standardansicht. Derselbe Tab führt zur Wurzel und behält seine Ansicht.
        const verlassen = tabForRoute(route.id);
        nav.setTab(data.tab);
        if (verlassen && verlassen !== data.tab) tabZustandLeeren(verlassen);
        return undefined;
      },
      // Runde 7 (Bahn): Die Ternaerkette kannte nur meet/profil/crew — ein vierter Tab
      // waere still in der falschen Wurzel gelandet. Jetzt entscheidet die eine Tabelle.
      back: () => nav.back(TAB_ROUTE[tabForRoute(route.id)] || TAB_ROUTE.crew),
    });
    if (bind) bind(root, ctx);
    if (activeTab) bindTabTrack(root, activeTab);
    // Der Routenschluessel entscheidet, ob ein vorhandener Handler weiterlebt oder
    // gegen einen mit frischem Zustand getauscht wird.
  }, route.id);
  bindTopFade(root);
  // R8-65: Der Bereich wurde betreten — er darf sich in seine Grundansicht setzen (die Karte:
  // zurueck in die Uebersicht). Nach dem Binden, damit er seine lebenden Teile schon hat. Ein
  // Fehler darin kostet nur diesen Schritt, nicht das Zeichnen.
  if (tabEintritt) {
    if (beimEintreten) {
      try { beimEintreten(root, ctx); } catch (fehler) { console.error('[Crew] beimEintreten:', fehler); }
    }
    // Pruef-Harness (unsichtbar): welcher Bereich wann betreten wurde und ob er beimEintreten hat.
    const protokoll = globalThis.__crew?.eintritte;
    if (Array.isArray(protokoll)) protokoll.push({ tab: activeTab, beimEintreten: Boolean(beimEintreten), zeit: Date.now() });
  }
  // Runde 7 (gemessen): bindRowDrag (core/html.js) macht waagrechte Reihen mit der MAUS
  // ziehbar. Genau dafuer wurde die Mechanik in v4 (P0-1h) aus dem Meet-Browser
  // herausgeholt — „sie gehoert zentral hierher und wird von allen Bereichen benutzt".
  // Tatsaechlich rief sie zuletzt NUR noch meet-browser.js: die Kategorie-Reihe der
  // Zeichenauswahl liess sich mit der Maus nicht bewegen (scrollLeft 0 -> 0 bei 957 px
  // Weg, kein data-drag-bound am Knoten). Jetzt haengt sie wieder an EINER Stelle.
  bindRowDrag(root);
  bindeVorbau(root);
  bindeZurueckWisch(appElement);
  // Runde 2: Die untere weiche Kante endet an der Oberkante der echten Bedienelemente.
  passeUntereKanteAn(root);
  // Runde 4 (C4, von P5 gemessen, hier nachgemessen): Der Abgleich setzt den unteren Innenabstand
  // einer Scrollfläche auf den Wert aus dem Markup zurück, BEVOR passeUntereKanteAn ihn wieder
  // anhebt. Dazwischen ist die Fläche kürzer — ganz unten klemmte der Browser die Scrollposition,
  // und restoreScroll konnte sie noch nicht erreichen (gemessen: Meet-Liste 259 → 232 px bei einem
  // Datenereignis). Jetzt stimmt die Höhe wieder, also wird die gemerkte Lage noch einmal gesetzt.
  // Alles vor dem nächsten Bild — dazwischen wird nichts gezeichnet.
  restoreScroll(appElement);
  bindToastWisch(root);
  placeToast(root);
  // Jetzt steht eine fertige Seite — erst jetzt darf die Start-Hülle gehen (B3).
  startHuelleWeg();

  // Runde 6 (B1/B2/B4): Einstieg und Update-Info kommen NACH dem ersten fertigen Bild — und erst,
  // wenn das Einrichten durch ist. Der Guide zuerst, die Update-Info danach; sie drängelt nie
  // dazwischen. Beides hängt sich selbst in den Rahmen und überlebt jeden Render.
  // Runde 7 (N1): Sobald angemeldet UND eingerichtet, wird eine liegende Einladung eingelöst —
  // auch dann, wenn das Einrichten erst in dieser Sitzung fertig geworden ist.
  if (repo && settings.onboarded && !route.id.startsWith('onboarding.')) einladungEinloesen();

  if (!einstiegGeprueft && repo && settings.onboarded && !route.id.startsWith('onboarding.')) {
    einstiegGeprueft = true;
    const einstiegCtx = { repo, nav, render, toast: showToast };
    Promise.resolve(guideBeimStart(einstiegCtx))
      .then(() => updateInfoBeimStart(einstiegCtx))
      .catch(() => {});
  }
}

// --- Einladung: der Code darf nicht auf den Boden fallen (Runde 7, N1) ------------------
// GEMESSEN war: app.js nahm ?einladung=CODE aus der Adresse und löste ihn SOFORT ein — auch
// bei einem Menschen, der weder angemeldet noch eingerichtet ist. Der Server sagte „nicht
// angemeldet", es kam ein Fehlerhinweis, und der Code war unwiederbringlich weg. Wer eingeladen
// wurde, landete in einer leeren App — genau das, was Jonathan als „leere App" beschreibt.
//
// Ablage, Lesen, Besitzer und das Merken des Ergebnisses stehen in web/core/einladung.js —
// derselbe Eintrag, den der Einrichten-Weg (profile.js) liest und 'onboarding.invite' zeigt.
// Eingelöst wird erst, wenn jemand angemeldet UND eingerichtet ist.
// Statuswerte, die eine ANTWORT auf genau diesen Code sind (web/data/repository.js):
// ein zweiter Versuch brächte dasselbe Ergebnis, der Eintrag darf weg.
//
// 'invalid' steht hier BEWUSST NICHT, obwohl es eine Antwort auf den Code ist. Der Grund
// liegt in redeemInviteCode in web/data/supabase-gateway.js (der Zweig, der bei einem Fehler
// der RPC 'redeem_invite_code' den Grund „Das hat gerade nicht geklappt" liefert): Dort trägt
// ein RPC-FEHLER (kein Netz, Server stumm) denselben Namen wie ein wirklich unbekannter Code
// — beides kommt als status:'invalid' zurück. Würde der Eintrag darauf weggeräumt, verlöre genau der Mensch
// seinen Code, um den es bei N1 geht: der Neuling im Funkloch. Ein kaputter Code kostet
// dafür zwei stille Nachhol-Versuche, danach ist er weg (EINLADUNG_VERSUCHE). Sauber wäre
// ein eigener Status ('offline'); das steht im Bericht für den Chef.
const EINLADUNG_ERLEDIGT = new Set(['sent', 'already', 'self', 'pending', 'empty']);
let einladungVersucht = false;
let einladungZeigen = false;

// Auftrag §2.2: Der QR-Code und der Einladungslink tragen die Adresse dieser App mit
// `?einladung=CODE`. Hier wird der Code nur AUS DER ADRESSE GENOMMEN und abgelegt —
// eingelöst wird er später, sobald jemand angemeldet und eingerichtet ist.
//
// Runde 7, Welle 3 (GEMESSEN): Das stand bisher MITTEN in starteApp, nach dem Laden des
// Datenbestands. starteApp kehrt aber vorher an drei Stellen zurück — Startfehler, „neues
// Passwort setzen" und vor allem needsAuth (Anmeldemaske). Damit galt „der Einladungslink
// fällt nicht mehr auf den Boden" ausgerechnet für den Menschen NICHT, mit dem die ganze
// Begründung argumentiert: den Neuling, der den Link öffnet, BEVOR er ein Konto hat.
// Gemessen auf ?gateway=supabase&einladung=BBD-2SS-JBT: Anmeldemaske sichtbar, die Kennung
// stand noch in der Adresse, die Ablage war leer. Wer sich dann registriert, verlässt den
// Browser für die Bestätigungsmail und kommt über deren Knopf auf origin+pathname OHNE
// Anhang zurück (web/screens/auth-screen.js) — der Code war nie abgelegt und ist weg.
// Deshalb steht das Lesen der Adresse jetzt ganz am Anfang von starteApp, VOR jeder Weiche.
function einladungAusAdresse() {
  const suche = new URLSearchParams(globalThis.location?.search || '');
  if (!suche.has('einladung')) return;
  const code = String(suche.get('einladung') || '').trim();
  // Die Kennung gehört nicht in die Adresszeile und nicht in den Verlauf des Browsers —
  // auch dann nicht, wenn sie leer ist.
  suche.delete('einladung');
  const rest = suche.toString();
  globalThis.history?.replaceState?.(null, '', `${globalThis.location.pathname}${rest ? `?${rest}` : ''}`);
  // Ein leerer Parameter legt nichts ab — und zerstört auch keinen Eintrag, der schon liegt.
  if (!code) return;
  einladungAblegen(code);
  einladungZeigen = true;
}

// Eingelöst wird genau dann, wenn beides steht: ANGEMELDET (ohne Anmeldung kommt die App gar
// nicht bis hierher — starteApp zeigt vorher die Anmeldemaske) und EINGERICHTET.
function einladungEinloesen() {
  if (einladungVersucht || !repo) return;
  if (!repo.getSettings()?.onboarded) return;   // der Einrichten-Weg zeigt 'onboarding.invite'
  const eintrag = einladungLesen();
  if (!eintrag) return;
  // Hat es schon jemand anderes auf diesem Gerät versucht, gehört der Code ihm, nicht mir.
  // Welle 5: je Code, und mit DERSELBEN Funktion, mit der der Einrichten-Schirm entscheidet,
  // was er zeigt — gezeigt und eingelöst wird also immer dasselbe.
  const konto = einladungKonto(repo);
  const codes = einladungCodesFuer(eintrag, konto);
  if (!codes.length) { einladungWeg(); return; }
  einladungVersucht = true;
  // Nur wenn der Code GERADE über die Adresse kam, wird auch etwas gezeigt: Wer die App
  // einfach öffnet, soll nicht irgendwohin gerissen werden.
  const ausDerAdresse = einladungZeigen;
  if (einladungZeigen) {
    einladungZeigen = false;
    Promise.resolve().then(() => nav.resetTo('profile.friendAdd'));
  }
  // Der aktive Code zuerst, dann die, die ein späterer Link nach hinten geschoben hat. Der
  // Reihe nach und nicht alle auf einmal: Der Server soll nicht für denselben Menschen drei
  // Anfragen gleichzeitig verarbeiten, und der Toast soll eine Antwort haben, nicht drei.
  einladungReihe(eintrag, codes, konto, ausDerAdresse);
}

async function einladungReihe(eintrag, codes, konto, ausDerAdresse) {
  const offen = [];
  let fertige = 0;
  let letzterGrund = '';
  let abbruch = null;
  for (const code of codes) {
    try {
      const ergebnis = await repo.redeemInviteCode(code);
      if (ergebnis && EINLADUNG_ERLEDIGT.has(ergebnis.status)) {
        fertige += 1;
        letzterGrund = ergebnis?.reason || letzterGrund;
      } else {
        offen.push(code);
        if (!letzterGrund) letzterGrund = ergebnis?.reason || '';
      }
    } catch (fehler) {
      offen.push(code);
      abbruch = fehler;
      console.warn('[Crew] Einladung nicht eingelöst:', fehler?.message || fehler);
    }
  }
  einladungErgebnisMerken(eintrag, offen, konto);
  if (abbruch) {
    // Ehrlich sagen, was los ist — und dass der Code nicht verloren ist.
    showToast(tx('Die Einladung ging gerade nicht durch — Crew versucht es beim nächsten Start noch einmal.'));
    return;
  }
  // Gesagt wird es, wenn der Mensch GERADE auf den Link getippt hat — oder wenn etwas
  // passiert ist. Ein stiller Nachhol-Versuch beim nächsten Start darf ihn nicht mit
  // derselben Absage empfangen; GEMESSEN waren das dreimal „Code ungültig" für einen
  // einzigen kaputten Code, an drei Starts, ohne dass er irgendetwas getan hätte.
  if (!ausDerAdresse && !fertige) return;
  // Lagen mehrere Einladungen, sagt ein Satz für alle, wie viele angekommen sind — sonst
  // hört der Mensch nur von der letzten und hält die erste für verloren.
  if (codes.length > 1) {
    showToast(fertige
      ? tx('{n} von {gesamt} Einladungen eingelöst', { n: fertige, gesamt: codes.length })
      : (letzterGrund || tx('Anfrage gesendet')));
    return;
  }
  showToast(letzterGrund || tx('Anfrage gesendet'));
}

// Runde 2: Die Sprachwahl liegt im Konto, damit sie auf jedes Gerät mitkommt. Weicht sie von
// der im Gerät gemerkten ab, gilt die aus dem Konto — einmal neu laden, dann steht jeder Text
// in ihr (web/core/sprache.js). Gibt true zurück, wenn die App dafür neu laden muss.
function spracheAbgleichen(bestand) {
  const settings = bestand.getSettings();
  if (settings.sprache && settings.sprache !== sprachWahl() && merkeSprachWahl(settings.sprache)) return true;
  const patch = {};
  if (!settings.sprache) patch.sprache = sprachWahl();
  // Für die Mitteilungen vom Server: in welcher Sprache dieses Konto gerade liest.
  if (settings.spracheAktiv !== sprache()) patch.spracheAktiv = sprache();
  if (Object.keys(patch).length) bestand.updateSettings(patch);
  Promise.resolve(bestand.spracheMelden?.(sprache())).catch(() => {});
  return false;
}

// --- Start ------------------------------------------------------------------------------
// Im Demo-Modus ist das Repository sofort da. Im Server-Modus wird zuerst der eigene
// Datenbestand geladen (SupabaseGateway.ready()), damit der erste Render schon echte Daten
// zeigt und kein leeres Gerüst aufblitzt. Fehlt die Anmeldung, kommt die Anmeldemaske.
async function starteApp() {
  // ALS ALLERERSTES, vor jeder Weiche: den Einladungscode aus der Adresse nehmen und ablegen.
  // Danach kann starteApp zurückkehren, wohin es will (Startfehler, neues Passwort,
  // Anmeldemaske) — der Code liegt sicher und wartet auf den ersten Start, an dem jemand
  // angemeldet UND eingerichtet ist. Siehe einladungAusAdresse().
  einladungAusAdresse();

  // Hülle im Gerät (nur unter https bzw. mit ?sw=1) — siehe core/pwa.js.
  registriereServiceWorker();

  let gestartet;
  try {
    gestartet = await createRepository(engine, { onError: showToast, onToast: showToast });
  } catch (error) {
    console.error('[Crew] Start fehlgeschlagen:', error);
    appElement.innerHTML = `<div style="padding:32px;font:400 15px/1.5 'Instrument Sans',sans-serif;color:var(--ink)">
      ${tx('Die App konnte nicht starten.')}<br><span style="color:var(--muted)">${esc(error?.message || String(error))}</span>
      <br><br><a href="?gateway=demo" style="color:var(--ink)">${tx('Im Demo-Modus öffnen')}</a></div>`;
    startHuelleWeg();
    return;
  }

  if (gestartet.neuesPasswort) {
    renderNeuesPasswortScreen(appElement, {
      client: gestartet.client,
      onFertig: () => window.location.replace(window.location.pathname),
    });
    startHuelleWeg();
    return;
  }

  if (gestartet.needsAuth) {
    renderAuthScreen(appElement, {
      client: gestartet.client,
      onSignedIn: () => window.location.reload(),
      onDemo: () => { starteDemo(); window.location.reload(); },
    });
    startHuelleWeg();
    return;
  }

  repo = gestartet.repo;
  startModus = gestartet.mode;
  if (spracheAbgleichen(repo)) { window.location.reload(); return; }
  repo.subscribe(() => render());
  // Runde 5 (G2, Wunsch P5): Ton und Vibration bei Neuem (Nachricht, Anstupser, jemand frei, Anfrage), solange
  // die App offen ist — von Anfang an, nicht erst, wenn man einmal die Crew-Seite geöffnet hat. Idempotent.
  import('./ui/mitteilungen.js').then((m) => m.mitteilungenBeobachten?.({ repo, nav })).catch(() => {});

  // Prüf-Harness (unsichtbar, keine UI): erlaubt scripts/shot.mjs den direkten Zugriff auf
  // Repository und Router, z. B. window.__crew.repo.getMeet('m-wandern').
  window.__crew = { repo, nav, engine, toast: showToast, mode: gestartet.mode, client: gestartet.client || null, rueckmeldung, eintritte: [] };
  // Runde 5 (D4): Jede Karte zeigt meinen Standort — map.js fragt dafür dieses Repository (nicht window.__crew).
  // map.js lädt nur leichte Module; MapLibre selbst kommt erst mit der ersten Karte.
  import('./ui/map.js').then((karten) => karten.kartenLageQuelle?.(repo)).catch(() => {});

  // T4: Push-Anmeldung dieses Geräts bei jedem Start einmal abgleichen. Der Push-Dienst darf
  // eine Adresse jederzeit austauschen; geschieht das, während die App zu ist, erfährt der
  // Server es erst hier. Ohne diesen Abgleich hörte ein Gerät irgendwann still auf, Mitteilungen
  // zu bekommen — ohne dass jemand etwas falsch gemacht hätte. Gefragt wird dabei nichts:
  // Wer die Erlaubnis nie gegeben hat, merkt von alldem nichts.
  if (gestartet.client) {
    import('./data/push.js').then(({ pushAbgleichen }) => pushAbgleichen(gestartet.client)).catch(() => {});
    navigator.serviceWorker?.addEventListener?.('message', (nachricht) => {
      if (nachricht.data?.typ !== 'push-anmeldung-erneuern') return;
      import('./data/push.js').then(({ pushAbgleichen }) => pushAbgleichen(gestartet.client)).catch(() => {});
    });
  }

  // Direkteinstieg für Prüfläufe: ?route=meet.home&params={"meetId":"m-strandbad"}
  const bootSearch = new URLSearchParams(window.location.search);
  // Runde 2: Nach einem Sprachwechsel geht es dort weiter, wo gewählt wurde.
  let nachSprache = '';
  try {
    nachSprache = globalThis.sessionStorage?.getItem('crew.nachSprache') || '';
    globalThis.sessionStorage?.removeItem('crew.nachSprache');
  } catch { /* egal */ }
  const bootRoute = bootSearch.get('route') || nachSprache;
  if (bootRoute) {
    let bootParams = {};
    try { bootParams = JSON.parse(bootSearch.get('params') || '{}'); } catch { /* leer */ }
    nav.resetTo(bootRoute, bootParams);
  } else {
    render();
  }
}

await starteApp();
