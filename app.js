// Crew — App-Bootstrap: Repository, Router, Render-Schleife, Runtime-Grammatik v3.1.
// Screens kommen aus screens/index.js; Daten ausschließlich aus dem CrewRepository.

import { createRouter, tabForRoute } from './core/router.js';
import { bindActions, resetActions, captureScroll, restoreScroll, esc, morphInto, scrollFor, sheetWischen, rueckmeldung } from './core/html.js';
import { createRepository, starteDemo } from './data/gateway.js';
import { RulesEngine } from './engine/suggestion-engine.js';
import { screens, ROUTE_REFERENCE_FALLBACK } from './screens/index.js';
// Runde 3 (D5): Das Einladungs-Sheet „Freund hinzufügen" für jeden Screen (siehe profile.js).
import { freundHinzufuegen } from './screens/profile.js';
import { resolveReferenceScreen } from './core/reference-adapter.js';
import { phoneFrame, statusBar, tabBar, passeUntereKanteAn } from './ui/components.js';
import { renderAuthScreen, renderNeuesPasswortScreen } from './ui/auth-screen.js';
import { applyTheme } from './core/theme.js';
import { registriereServiceWorker } from './core/pwa.js';
import { sprache, sprachWahl, merkeSprachWahl, t as tx } from './core/sprache.js';

const appElement = document.querySelector('#app');
const engine = new RulesEngine();
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
    const nachziehen = () => {
      const tiefe = Math.max(0, Math.min(max, flaeche.scrollTop));
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

const TAB_ORDER = ['meet', 'crew', 'profil'];
// v7 P0: friendAdd ist das QR-Sheet ueber der Profilseite und gehoert deshalb in
// dieselbe Tab-Wurzel — sonst baut app.js eine andere Huelle mit anderer Scrollhoehe.
const TAB_ROOTS = { 'meet.home': 'meet', 'crew.home': 'crew', 'profile.home': 'profil', 'profile.friendAdd': 'profil' };
const TAB_ROUTE = { meet: 'meet.home', crew: 'crew.home', profil: 'profile.home' };

// Eigener UI-Zustand je Tab-Wurzel: eine Vorschau muss dasselbe zeigen wie die Seite,
// auf der man nach dem Wechsel landet.
const tabUi = { meet: {}, crew: {}, profil: {} };

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

// Seiten-HTML einer Tab-Wurzel OHNE Bindung — reine Vorschau für die Bahn.
function pageHtmlFor(tab) {
  const routeId = TAB_ROUTE[tab];
  const definition = screens[routeId];
  if (!definition) return '';
  const previewCtx = {
    repo, nav, engine,
    route: { id: routeId, params: {} },
    params: {},
    ui: tabUi[tab],
    render: () => {},          // eine Vorschau rendert nichts nach
    toast: () => {},
    preview: true,
  };
  // v6 A15b: Das Merkmal bleibt am Knoten. Es wird gebraucht, um die gemerkte Position
  // schon beim Einsetzen der Nachbarseite zu setzen (ensureNeighbour). Damit die Vorschau
  // die gemerkten Werte nicht ihrerseits überschreibt, überspringt captureScroll alles,
  // was nicht die aktive Seite ist.
  return definition(previewCtx).html;
}

function trackOf(root) {
  return root.querySelector('.tab-track');
}

function activePageOf(track) {
  return track.querySelector('.tab-page[data-role="active"]');
}

// Nachbarseite in die Bahn setzen (rechts bei dir>0, links bei dir<0) und zurückgeben.
function ensureNeighbour(track, tab, dir) {
  const existing = track.querySelector('.tab-page[data-role="incoming"]');
  if (existing && existing.dataset.tab === tab) return existing;
  if (existing) existing.remove();
  const holder = document.createElement('div');
  holder.innerHTML = pageHtmlFor(tab);
  const page = holder.firstElementChild;
  if (!page) return null;
  page.dataset.role = 'incoming';
  page.dataset.tab = tab;
  page.style.pointerEvents = 'none';
  page.style.transform = `translateX(${dir > 0 ? 100 : -100}%)`;
  track.appendChild(page);
  // v6 A15b: Die gemerkte Scrollposition wird SOFORT gesetzt — vor dem ersten Frame, in
  // dem die Seite sichtbar wird. Vorher erschien die zurückkehrende Seite rund 35 Frames
  // lang am Listenanfang und sprang danach in einem Schritt um 200 px nach unten.
  page.querySelectorAll('[data-scroll-keep]').forEach((flaeche) => {
    const gemerkt = scrollFor(flaeche.dataset.scrollKeep);
    if (gemerkt) {
      flaeche.scrollTop = gemerkt.top;
      flaeche.scrollLeft = gemerkt.left;
    }
  });
  return page;
}

// v7 A15a: Wie ensureNeighbour, aber fuer eine beliebige Position in der Bahn. Damit
// laesst sich die MITTLERE Seite eines Zwei-Felder-Sprungs mit einhaengen, statt sie zu
// ueberspringen. Die Rolle 'passing' unterscheidet sie von der Zielseite ('incoming').
function ensurePageAt(track, tab, offset, rolle) {
  const vorhanden = track.querySelector(`.tab-page[data-role="${rolle}"]`);
  if (vorhanden && vorhanden.dataset.tab === tab) return vorhanden;
  if (vorhanden) vorhanden.remove();
  const holder = document.createElement('div');
  holder.innerHTML = pageHtmlFor(tab);
  const page = holder.firstElementChild;
  if (!page) return null;
  page.dataset.role = rolle;
  page.dataset.tab = tab;
  page.style.pointerEvents = 'none';
  page.style.transform = `translateX(${offset * 100}%)`;
  track.appendChild(page);
  page.querySelectorAll('[data-scroll-keep]').forEach((flaeche) => {
    const gemerkt = scrollFor(flaeche.dataset.scrollKeep);
    if (gemerkt) {
      flaeche.scrollTop = gemerkt.top;
      flaeche.scrollLeft = gemerkt.left;
    }
  });
  return page;
}

function neighbourTab(tab, dir) {
  const index = TAB_ORDER.indexOf(tab) + dir;
  return index >= 0 && index < TAB_ORDER.length ? TAB_ORDER[index] : null;
}

// Gemeinsame Abschlussbewegung für Tap UND Drag. fromRatio ist der bereits gezogene
// Anteil (0 bei Tap), damit die Bewegung dort fortsetzt, wo der Finger aufgehört hat.
function slideTo(targetTab, options = {}) {
  const root = appElement.firstElementChild;
  const track = root && trackOf(root);
  const currentTab = TAB_ROOTS[nav.current().id];
  if (!track || !currentTab || sliding) return;
  if (targetTab === currentTab) { settleTrack(track, 0); return; }
  const vonIndex = TAB_ORDER.indexOf(currentTab);
  const zuIndex = TAB_ORDER.indexOf(targetTab);
  const dir = zuIndex > vonIndex ? 1 : -1;
  // v7 A15a: Die DISTANZ entscheidet, wie viele Seiten die Bahn traegt. Ein Sprung ueber
  // zwei Felder (Profil <-> Meet) legt die mittlere Seite mit in die Bahn, damit sie
  // sichtbar durchlaeuft, statt uebersprungen zu werden.
  const distanz = Math.abs(zuIndex - vonIndex);

  const current = activePageOf(track);
  const incoming = ensureNeighbour(track, targetTab, dir);
  if (!current || !incoming) { nav.setTab(targetTab); return; }
  // Die Zielseite liegt bei einem Zwei-Felder-Sprung zwei Breiten entfernt.
  const zwischenTab = distanz === 2 ? TAB_ORDER[vonIndex + dir] : null;
  const zwischen = zwischenTab ? ensurePageAt(track, zwischenTab, dir, 'passing') : null;

  sliding = true;
  const ease = `transform ${SWIPE_MS}ms cubic-bezier(.22,.61,.36,1), opacity ${SWIPE_MS}ms ease-out`;
  // Startwerte erzwingen, damit der Übergang einen Ausgangszustand hat.
  const startRatio = options.fromRatio || 0;
  const bewegte = [current, incoming, ...(zwischen ? [zwischen] : [])];
  bewegte.forEach((el) => { el.style.transition = 'none'; });
  current.style.transform = `translateX(${startRatio * 100}%)`;
  if (zwischen) zwischen.style.transform = `translateX(${(startRatio + dir) * 100}%)`;
  incoming.style.transform = `translateX(${(startRatio + dir * distanz) * 100}%)`;
  void current.offsetWidth;

  // Die Bahn faehrt um genau DISTANZ Breiten; jede Seite behaelt ihren Abstand zu den
  // anderen. Die Zwischenseite laeuft dadurch sichtbar durch das Fenster.
  const dauer = distanz === 2 ? Math.round(SWIPE_MS * 1.45) : SWIPE_MS;
  const easeN = `transform ${dauer}ms cubic-bezier(.22,.61,.36,1), opacity ${dauer}ms ease-out`;
  bewegte.forEach((el) => { el.style.transition = easeN; });
  current.style.transform = `translateX(${-dir * distanz * 100}%)`;
  current.style.opacity = '0';           // Gegen-Fade
  if (zwischen) zwischen.style.transform = `translateX(${-dir * (distanz - 1) * 100}%)`;
  incoming.style.transform = 'translateX(0)';
  incoming.style.opacity = '1';

  window.setTimeout(() => {
    sliding = false;
    deferredRender = false;   // der Tabwechsel rendert ohnehin neu
    if (zwischen) zwischen.remove();
    nav.setTab(targetTab);
    tabZustandLeeren(currentTab);
    if (zwischenTab) tabZustandLeeren(zwischenTab);
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
    if (incoming) incoming.remove();
    track.querySelectorAll('.tab-page[data-role="passing"]').forEach((el) => el.remove());
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
function tabZustandLeeren(tab) {
  const zustand = tabUi[tab];
  if (!zustand) return;
  Object.keys(zustand).forEach((schluessel) => {
    if (!RESET_AUSNAHMEN.includes(schluessel)) delete zustand[schluessel];
  });
}

function resetTab(tab) {
  tabZustandLeeren(tab);
  const wurzel = TAB_ROUTE[tab];
  if (nav.current().id !== wurzel) nav.resetTo(wurzel, {});
  else render();
}

// v7 P0: Seit morphInto immer abgleicht, ueberlebt die Bahn jeden Tabwechsel — und
// damit auch dieser Handler. Ein ueber activeTab GESCHLOSSENER Wert waere danach
// veraltet: nach crew -> meet haette der Trackpad-Wisch weiter mit 'crew' gerechnet und
// waere von meet aus zu profil gesprungen statt zu crew. Der aktive Tab wird deshalb bei
// JEDEM Ereignis frisch aus der Route gelesen.
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
function festeFlaechenHalten(event) {
  const el = event.target;
  if (!(el instanceof Element) || !appElement.contains(el)) return;
  if (/^(INPUT|TEXTAREA|SELECT)$/.test(el.tagName) || el.isContentEditable || el.closest('[data-fremd]')) return;
  if (!el.scrollTop && !el.scrollLeft) return;
  const stil = getComputedStyle(el);
  if (el.scrollTop && !/(auto|scroll)/.test(stil.overflowY)) el.scrollTop = 0;
  if (el.scrollLeft && !/(auto|scroll)/.test(stil.overflowX)) el.scrollLeft = 0;
}
appElement.addEventListener('scroll', festeFlaechenHalten, { capture: true, passive: true });

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

  // Onboarding-Weiche: ohne abgeschlossenes Onboarding zeigt die App nur Onboarding-Routen.
  const settings = repo.getSettings();
  applyTheme(settings.appearance?.theme); // Fable: Thema (hell/dunkel/System) vor dem Zeichnen setzen
  if (!settings.onboarded && !route.id.startsWith('onboarding.') && screens['onboarding.welcome']) {
    nav.resetTo(ERSTER_SCHRITT());
    return;
  }

  const definition = screens[route.id];
  const activeTab = TAB_ROOTS[route.id];
  // Die Art des Wechsels steuert den Eintrittsuebergang (COMPONENT_RULES 1).
  let move = nav.consumeMove ? nav.consumeMove() : 'none';
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
  if (definition) {
    const result = definition(ctx);
    html = result.html;
    bind = result.bind || null;
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
<div class="tab-track" style="position:relative;flex:1;min-height:0;overflow:hidden;overflow:clip">${seiteHtml.replace('class="tab-page"', 'class="tab-page" data-role="active" data-tab="' + activeTab + '"')}</div>
<div class="tab-nav" style="flex:none;position:relative;z-index:8">${tabBar(activeTab, { zahlen: { crew: openRequests } })}</div>
${overlayHtml}`);
    markup = `<div class="runtime-shell" data-route="${route.id}" data-morph-group="${gruppe}" data-move="${move}">${shell}${toastLayer()}</div>`;
  } else {
    markup = `<div class="runtime-shell" data-route="${route.id}" data-morph-group="${gruppe}" data-move="${move}">${html}${toastLayer()}</div>`;
  }
  morphInto(appElement, markup);
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
      back: () => nav.back(tabForRoute(route.id) === 'meet' ? 'meet.home' : tabForRoute(route.id) === 'profil' ? 'profile.home' : 'crew.home'),
    });
    if (bind) bind(root, ctx);
    if (activeTab) bindTabTrack(root, activeTab);
    // Der Routenschluessel entscheidet, ob ein vorhandener Handler weiterlebt oder
    // gegen einen mit frischem Zustand getauscht wird.
  }, route.id);
  bindTopFade(root);
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
    return;
  }

  if (gestartet.neuesPasswort) {
    renderNeuesPasswortScreen(appElement, {
      client: gestartet.client,
      onFertig: () => window.location.replace(window.location.pathname),
    });
    return;
  }

  if (gestartet.needsAuth) {
    renderAuthScreen(appElement, {
      client: gestartet.client,
      onSignedIn: () => window.location.reload(),
      onDemo: () => { starteDemo(); window.location.reload(); },
    });
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
  window.__crew = { repo, nav, engine, toast: showToast, mode: gestartet.mode, client: gestartet.client || null, rueckmeldung };
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

  // Auftrag §2.2: Der QR-Code trägt die Adresse dieser App mit `?einladung=CODE`. Wer ihn
  // mit der Kamera scannt, landet also HIER — und dann muss auch etwas passieren. Vorher
  // stand im Code eine erfundene Adresse; ein Scan führte ins Leere.
  const einladung = bootSearch.get('einladung');
  if (einladung) {
    // Die Kennung gehört nicht in die Adresszeile und nicht in den Verlauf des Browsers.
    const rest = new URLSearchParams(window.location.search);
    rest.delete('einladung');
    const suche = rest.toString();
    window.history.replaceState(null, '', `${window.location.pathname}${suche ? `?${suche}` : ''}`);
    nav.resetTo('profile.friendAdd');
    Promise.resolve(repo.redeemInviteCode(einladung))
      .then((ergebnis) => showToast(ergebnis?.reason || tx('Anfrage gesendet')))
      .catch(() => showToast(tx('Der Code ließ sich nicht einlösen')));
  }
}

await starteApp();
