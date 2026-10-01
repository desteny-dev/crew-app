// Die Bildschirmtastatur — EINE Regel für jedes Eingabefeld der App (iPhone-Runde 1, A3).
//
// Jonathan (erster Test auf dem iPhone): „Beim Eintippen des Geburtsjahrs schiebt die Tastatur den ganzen
// Bildschirm nach unten. Die Fußleiste liegt halb unter dem Bildschirmrand, der Knopf zum Bestätigen ist
// nicht erreichbar."
//
// WAS DA PASSIERT (iPhone: WKWebView, iPad und Safari genauso; Chrome auf Android seit Version 108 auch)
// -------------------------------------------------------------------------------------------------
// Die Tastatur verkleinert NICHT die Seite, sondern legt sich über sie. Die Seite bleibt 844 px hoch
// (window.innerHeight), sichtbar ist nur noch der Teil darüber (visualViewport.height). Damit das
// fokussierte Feld nicht unter der Tastatur liegt, SCHIEBT das System das ganze Dokument — obwohl die App
// selbst gar nicht scrollt (html/body: overflow hidden, gescrollt wird nur in .screen-scroll). Folgen:
//   · Fußleisten und Knöpfe, die am unteren Rand sitzen (Weiter, Senden), bleiben unter der Tastatur;
//   · der Kopf ist oben aus dem Bild geschoben;
//   · nach dem Schließen stellt die Hülle das Dokument nicht sicher zurück — es bleibt verschoben.
// In der iPhone-App kam dazu `ios.contentInset: "always"` (capacitor.config.json): Damit rückt die
// ScrollView der WebView den Inhalt selbst um den sicheren Bereich ein (env(safe-area-inset-*) wird 0)
// und rechnet beim Öffnen und Schließen der Tastatur mit diesem Einzug — die Stelle, an die sie das
// Dokument zurückstellt, ist nicht die, an der die App steht. Seit dieser Runde steht dort "never":
// Die App rechnet den sicheren Bereich selbst (env(), viewport-fit=cover) — genau wie als Web-App.
//
// DIE REGEL (hier, an einer Stelle — kein Bildschirm muss dafür etwas tun)
// -------------------------------------------------------------------------------------------------
//   1. Solange die Tastatur offen ist, ist die App so hoch wie der sichtbare Teil: <html> bekommt
//      data-tastatur="offen" und die Maße --tastatur (verdeckte Höhe unten), --sicht-hoehe (sichtbare
//      Höhe) und --sicht-oben (um so viel hat das System den sichtbaren Ausschnitt verschoben, meist 0);
//      web/styles.css (Block „Tastatur") setzt damit Dokument, #app und Rahmen genau auf den sichtbaren Teil. Alles, was unten sitzt (Weiter, Senden, Eingabezeile), sitzt dadurch ÜBER der Tastatur.
//      Die Tab-Leiste gehört zu keinem Feld und tritt so lange zurück — wie in jeder iPhone-App.
//   2. Das Dokument selbst steht immer bei 0. Jedes Schieben durch das System wird sofort
//      zurückgestellt — beim Öffnen, beim Tippen und beim Schließen.
//   3. Das fokussierte Feld und sein Knopf (data-tastatur-ziel, freiwillig) werden in IHRER eigenen
//      Scrollfläche sichtbar gemacht, nicht durch Schieben des Ganzen.
//   4. Geht die Tastatur zu, fallen alle Maße weg: Die App steht exakt wie vorher.
//
// Gilt nur auf Touch-Geräten bzw. schmalen Fenstern (dieselbe Bedingung wie in web/styles.css, unter
// der html/body nicht scrollen). Auf dem Schreibtisch darf das Dokument scrollen; dort gibt es auch
// keine Bildschirmtastatur. Mit zwei Fingern vergrößert (scale ≠ 1) bleibt alles, wie der Mensch es will.

// Unter dieser Höhe ist es keine Tastatur, sondern eine ein- oder ausfahrende Adressleiste.
const SCHWELLE = 80;
// So viel Luft bleibt zwischen Feld bzw. Knopf und der Tastatur.
const LUFT = 12;
const TOUCH_LAYOUT = '(pointer: coarse), (max-width: 900px)';
const TEXTARTEN = new Set(['', 'text', 'search', 'email', 'number', 'tel', 'url', 'password']);

let gestartet = false;
let offen = false;

// Ein Feld, zu dem das System eine Tastatur zeigt.
export function istTastaturFeld(el) {
  if (!el || el.nodeType !== 1) return false;
  if (el.isContentEditable) return true;
  if (el.tagName === 'TEXTAREA') return !el.readOnly && !el.disabled;
  if (el.tagName !== 'INPUT') return false;
  return TEXTARTEN.has(String(el.getAttribute('type') || '').toLowerCase()) && !el.readOnly && !el.disabled;
}

/** Ist die Bildschirmtastatur gerade offen? (für Bildschirme, die das wissen wollen) */
export function tastaturOffen() {
  return offen;
}

function vergroessert(vv) {
  return Boolean(vv && Number.isFinite(vv.scale) && Math.abs(vv.scale - 1) > 0.01);
}

// Wo der sichtbare Teil gerade liegt — oder null, wenn keine Tastatur offen ist.
//   voll:  die Höhe der Seite OHNE Tastatur. documentElement.clientHeight liefert für die Wurzel immer die
//          Fensterhöhe (Layout-Viewport), egal wie hoch <html> gerade gesetzt ist; innerHeight zählt mit,
//          weil nicht jede Engine es bei offener Tastatur gleich behandelt — das Größere ist die volle Höhe.
//          Verkleinert das System die ganze WebView (Android-Hülle), sind beide klein: dann ist nichts verdeckt.
//   oben:  WebKit kann statt des Dokuments auch nur den SICHTBAREN Ausschnitt verschieben (offsetTop > 0).
//          Das lässt sich nicht zurückstellen — dann rückt die App um genau diesen Betrag mit (styles.css).
function sichtLage() {
  const vv = globalThis.visualViewport;
  if (!vv || vergroessert(vv)) return null;
  const voll = Math.max(document.documentElement.clientHeight || 0, globalThis.innerHeight || 0);
  const sicht = Math.round(vv.height);
  if (voll - sicht < SCHWELLE) return null;
  const oben = Math.max(0, Math.round(vv.offsetTop || 0));
  return { sicht, oben, unten: Math.max(0, voll - oben - sicht) };
}

function touchLayout() {
  try { return globalThis.matchMedia?.(TOUCH_LAYOUT)?.matches ?? true; } catch { return true; }
}

// Regel 2: Das Dokument steht bei 0. Auch <body> und #app — die kann das System ebenfalls schieben,
// weil overflow:hidden das Scrollen nur dem Menschen verbietet, nicht dem Programm.
function zurueckstellen() {
  if (!touchLayout() || vergroessert(globalThis.visualViewport)) return;
  if (globalThis.scrollX || globalThis.scrollY) globalThis.scrollTo(0, 0);
  const wurzel = document.scrollingElement || document.documentElement;
  for (const el of [wurzel, document.documentElement, document.body, document.getElementById('app')]) {
    if (el && (el.scrollTop || el.scrollLeft)) { el.scrollTop = 0; el.scrollLeft = 0; }
  }
}

// Regel 1 und 4: Maße setzen bzw. restlos entfernen.
function messen() {
  const wurzel = document.documentElement;
  const lage = touchLayout() ? sichtLage() : null;
  const warOffen = offen;
  offen = Boolean(lage);
  if (lage) {
    wurzel.style.setProperty('--tastatur', `${lage.unten}px`);
    wurzel.style.setProperty('--sicht-hoehe', `${lage.sicht}px`);
    wurzel.style.setProperty('--sicht-oben', `${lage.oben}px`);
    if (wurzel.dataset.tastatur !== 'offen') wurzel.dataset.tastatur = 'offen';
  } else if (warOffen || wurzel.dataset.tastatur) {
    wurzel.style.removeProperty('--tastatur');
    wurzel.style.removeProperty('--sicht-hoehe');
    wurzel.style.removeProperty('--sicht-oben');
    delete wurzel.dataset.tastatur;
  }
  return offen !== warOffen;
}

function scrollbarerVorfahr(el) {
  for (let knoten = el.parentElement; knoten && knoten !== document.body; knoten = knoten.parentElement) {
    const stil = getComputedStyle(knoten);
    if (/(auto|scroll)/.test(stil.overflowY) && knoten.scrollHeight > knoten.clientHeight + 1) return knoten;
  }
  return null;
}

// Wo in einer Scrollfläche der sichtbare Teil endet: an ihrer Kante, an der Tastatur — oder dort, wo
// die schwebende Bedienung darüber beginnt (.screen-bottom: Weiter, Eingabezeile, FREE).
function sichtUnten(flaeche) {
  const vv = globalThis.visualViewport;
  let unten = Math.min(flaeche.getBoundingClientRect().bottom, vv ? (vv.offsetTop || 0) + vv.height : globalThis.innerHeight);
  const unterEbene = flaeche.parentElement?.querySelector(':scope > .screen-bottom');
  if (unterEbene) {
    for (const bedien of unterEbene.querySelectorAll('button, input, textarea, [data-act]')) {
      const r = bedien.getBoundingClientRect();
      if (r.width > 0 && r.height > 0 && r.top < unten) unten = r.top;
    }
  }
  return unten;
}

// Regel 3: das Feld (und, falls angegeben, seinen Knopf) in der eigenen Scrollfläche zeigen.
// Der Knopf ist das nächste [data-tastatur-ziel] im selben Rahmen; passt nicht beides hinein, hat das
// Feld Vorrang — wer tippt, muss sehen, was er tippt.
function feldZeigen() {
  const feld = document.activeElement;
  if (!offen || !istTastaturFeld(feld)) return;
  const flaeche = scrollbarerVorfahr(feld);
  if (!flaeche) return;
  const rahmen = feld.closest('[data-tastatur-rahmen]') || flaeche;
  const ziel = rahmen.querySelector('[data-tastatur-ziel]');
  const f = feld.getBoundingClientRect();
  const z = ziel && ziel.getBoundingClientRect().height > 0 ? ziel.getBoundingClientRect() : null;
  const oben = Math.max(flaeche.getBoundingClientRect().top, globalThis.visualViewport?.offsetTop || 0);
  const unten = sichtUnten(flaeche);
  const bereichUnten = Math.max(f.bottom, z ? z.bottom : f.bottom) + LUFT;
  let weg = 0;
  if (bereichUnten > unten) weg = bereichUnten - unten;
  // Nie so weit, dass das Feld selbst oben verschwindet.
  if (f.top - weg < oben + LUFT) weg = f.top - oben - LUFT;
  if (Math.abs(weg) >= 1) flaeche.scrollTop += weg;
}

function beiAenderung() {
  const gewechselt = messen();
  zurueckstellen();
  if (gewechselt && offen) {
    // Erst wenn die neue Höhe gilt (nächstes Bild), stehen die Flächen an ihrem neuen Platz.
    requestAnimationFrame(() => { zurueckstellen(); feldZeigen(); });
  }
}

/**
 * Startet die Regel einmal für die ganze App (web/app.js, vor dem ersten Zeichnen). Ohne
 * visualViewport (sehr alte Browser) bleibt alles, wie es war.
 */
export function tastaturBeobachten() {
  if (gestartet || typeof document === 'undefined') return;
  const vv = globalThis.visualViewport;
  if (!vv || typeof vv.addEventListener !== 'function') return;
  gestartet = true;
  vv.addEventListener('resize', beiAenderung);
  vv.addEventListener('scroll', beiAenderung);
  globalThis.addEventListener('scroll', beiAenderung, { passive: true });
  globalThis.addEventListener('resize', beiAenderung);
  // Ein Feldwechsel bei offener Tastatur (E-Mail → Geburtsjahr) ändert keine Höhe, verlangt aber,
  // dass das neue Feld zu sehen ist. Beim Tippen schiebt das System ebenfalls (Einfügemarke zeigen).
  document.addEventListener('focusin', (ereignis) => {
    if (!istTastaturFeld(ereignis.target)) return;
    requestAnimationFrame(() => { messen(); zurueckstellen(); feldZeigen(); });
  });
  document.addEventListener('input', () => { if (offen) zurueckstellen(); }, true);
  // Beim Schließen: Das System meldet die neue Höhe manchmal erst nach dem Wegblenden — dann steht
  // das Dokument trotzdem schon wieder bei 0.
  document.addEventListener('focusout', () => {
    setTimeout(() => { messen(); zurueckstellen(); }, 0);
  });
  messen();
}
