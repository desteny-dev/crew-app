// Kleine HTML-Helfer für Template-Strings.

export function esc(value) {
  return String(value ?? '')
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;');
}

// Event-Delegation: Elemente tragen data-act="name" plus beliebige data-*-Argumente.
// bindActions(root, { name: (dataset, element, event) => {} })
// v5 A19: Seit der In-Place-Aktualisierung bleibt die Wurzel über Renders hinweg
// derselbe Knoten. Würde bindActions jedes Mal einen weiteren Klick-Listener anhängen,
// liefe jede Aktion mehrfach. Stattdessen hängt EIN Listener an der Wurzel, und die
// Handler-Karten liegen in einer Liste, die resetActions() vor jedem Bindedurchlauf
// leert. So sind die Handler immer frisch und feuern trotzdem genau einmal.
export function resetActions(root) {
  if (root.__actionMaps) root.__actionMaps.length = 0;
}

export function bindActions(root, handlers) {
  if (!root.__actionMaps) {
    root.__actionMaps = [];
    root.addEventListener('click', (event) => {
      const target = event.target.closest('[data-act]');
      if (!target || !root.contains(target)) return;
      for (const map of root.__actionMaps) {
        const handler = map[target.dataset.act];
        if (handler) {
          event.preventDefault();
          handler(target.dataset, target, event);
          return;
        }
      }
    });
  }
  root.__actionMaps.push(handlers);
}

// Merkt sich Scrollpositionen von Elementen mit [data-scroll-keep="key"] über Rerenders.
const scrollMemory = new Map();

export function captureScroll(root) {
  if (!root) return;
  root.querySelectorAll('[data-scroll-keep]').forEach((element) => {
    // v6 A15b: Die Vorschau-Nachbarseite in der Tab-Bahn trägt dieselben Schlüssel wie
    // die echte Seite. Würde sie mitgeschrieben, überschriebe ihr frischer Nullwert die
    // gemerkte Position der aktiven Seite.
    if (element.closest('.tab-page[data-role="incoming"]')) return;
    // Runde 3: Das Standbild beim Gleiten trägt dieselben Schlüssel wie die Seite darunter.
    if (element.closest('.gleit-ebene')) return;
    scrollMemory.set(element.dataset.scrollKeep, { top: element.scrollTop, left: element.scrollLeft });
  });
}

// v6 A15b: Die Bahn braucht die gemerkte Position, BEVOR die Nachbarseite zum ersten
// Mal gezeichnet wird. Ohne diesen Lesezugriff blieb nur der Weg über restoreScroll —
// und der greift erst nach dem Rendern, wodurch die Seite sichtbar am Listenanfang
// erschien und erst rund 230 ms später an ihre Position sprang.
export function scrollFor(key) {
  return scrollMemory.get(key) || null;
}

export function restoreScroll(root) {
  if (!root) return;
  root.querySelectorAll('[data-scroll-keep]').forEach((element) => {
    // Das Standbild hält die Lage, mit der es aufgenommen wurde — ein Render mitten im
    // Gleiten darf es nicht an den Listenanfang setzen.
    if (element.closest('.gleit-ebene')) return;
    const saved = scrollMemory.get(element.dataset.scrollKeep);
    // v7 P0: Seit der Abgleich auch ueber Routengrenzen laeuft, wird dieselbe
    // Scrollflaeche fuer die naechste Seite WIEDERVERWENDET. Ohne den Nullfall behielte
    // eine frisch geoeffnete Seite die Scrollposition der vorigen.
    if (saved) {
      element.scrollTop = saved.top;
      element.scrollLeft = saved.left;
    } else if (element.scrollTop || element.scrollLeft) {
      element.scrollTop = 0;
      element.scrollLeft = 0;
    }
  });
}

// Horizontale Reihen mit der linken Maus/dem Trackpad ziehen.
// v4 P0-1h: Diese Mechanik lag lokal im Meet-Browser, weshalb sich dieselbe Reihe je
// nach Bereich unterschiedlich verhielt (Crew-Reihe war mit der Maus gar nicht ziehbar).
// Sie gehoert zentral hierher und wird von allen Bereichen benutzt.
// Bewegungsschwelle, Pointer Capture, und ein Drag löst danach keinen Karten-Tap aus.
// Touch/Pen behalten das native Scrollen der Reihe.
export function bindRowDrag(root) {
  root.querySelectorAll('[data-hdrag="row"]').forEach((row) => {
    if (row.dataset.dragBound) return;
    row.dataset.dragBound = '1';
    let start = null;
    let moved = false;

    row.addEventListener('pointerdown', (event) => {
      if (event.pointerType !== 'mouse' || event.button !== 0) return;
      start = { x: event.clientX, y: event.clientY, left: row.scrollLeft, id: event.pointerId };
      moved = false;
    });

    row.addEventListener('pointermove', (event) => {
      if (!start || event.pointerId !== start.id) return;
      const dx = event.clientX - start.x;
      const dy = event.clientY - start.y;
      if (!moved) {
        if (Math.abs(dy) > 10 && Math.abs(dy) >= Math.abs(dx)) { start = null; return; }
        if (Math.abs(dx) < 6) return;
        moved = true;
        row.setPointerCapture?.(event.pointerId);
      }
      row.scrollLeft = start.left - dx;
      event.preventDefault();
    });

    const end = () => {
      if (!start) return;
      const wasDrag = moved;
      start = null;
      moved = false;
      if (!wasDrag) return;
      const blocker = (click) => { click.stopPropagation(); click.preventDefault(); };
      row.addEventListener('click', blocker, { capture: true, once: true });
      window.setTimeout(() => row.removeEventListener('click', blocker, { capture: true }), 350);
    };
    row.addEventListener('pointerup', end);
    row.addEventListener('pointercancel', end);
  });
}

// =====================================================================================
// In-Place-Aktualisierung des DOM (v5 A19/A24)
// -------------------------------------------------------------------------------------
// Statt den Teilbaum zu ersetzen, wird er abgeglichen: gleiche Position + gleicher Tag
// bedeutet derselbe Knoten. Dadurch überleben laufende Animationen, Scrollpositionen,
// der Fokus und die Schreibmarke in Eingabefeldern.
//
// Bewusst einfach gehalten (Positionsvergleich statt Schlüssel): Die App erzeugt ihr
// HTML deterministisch aus dem Zustand, deshalb stimmen die Positionen überein. Wo ein
// Element bewusst neu entstehen SOLL (etwa ein frisch geöffnetes Sheet), unterscheidet
// sich der Tag oder es fehlt vorher — dann wird ersetzt und die Animation läuft.
// =====================================================================================

const NIE_UEBERSCHREIBEN = new Set(['value', 'checked', 'selected']);

// Merker, die Binder zur Laufzeit selbst setzen. Sie stehen nie im Markup und duerfen
// beim Abgleich weder entfernt werden (sonst bindet jeder Render erneut) noch als
// Rollenwechsel gelten.
const LAUFZEIT_MERKER = new Set(['data-drag-bound', 'data-pan-bound', 'data-week-bound']);

// Rolle eines Elements: welche data-Merkmale traegt es im Markup?
//
// Der Abgleich ordnet Knoten ueber ihre Position zu. Wechselt ein Bereich seine
// Ansicht (Meet-Browser: Liste -> Kalender), steht an derselben Stelle ploetzlich ein
// voellig anderes Element. Attribute wuerden korrekt nachgezogen — die direkt
// angehaengten Zeiger-Handler des alten Elements blieben aber kleben. Genau daran
// starb der Wochenzug: der alte Reihen-Zieher der Liste fing den Pointer weg, den
// die Wochenleiste schon hielt.
//
// Deshalb gilt: unterscheiden sich die data-Merkmale, ist es ein anderes Element.
// Es wird ersetzt statt abgeglichen, und die alten Handler verschwinden mit ihm.
// Bedingt ausgegebene data-Attribute gibt es in diesem Markup nicht, die Signatur
// eines gleich bleibenden Elements ist also stabil.
//
// Runde 3 (Jonathan: „manchmal zuckt das ganze Programm"): Gemessen ersetzte der Abgleich
// ganze Bäume, sobald ein Binder zur LAUFZEIT ein data-Merkmal gesetzt hatte — die Liste
// oben kannte nur drei davon. Beispiele aus der Messung: der Tages-Feed im Kalender
// (data-feed-bound, 537 Knoten bei JEDEM Render), der Anstups-Knopf (data-impuls) und die
// ganze App-Hülle während des Gleitens (data-gleiten, 73 Knoten samt Seite). Jeder solche
// Neuaufbau startet Animationen neu und verliert Scrollstände und Binder-Zustand.
// Deshalb zählt jetzt nur, was im MARKUP stand: Jeder Knoten merkt sich seine Vorlage
// (__vorlage), und die Rolle wird aus deren Merkmalen gelesen. Zur Laufzeit gesetzte
// data-Merkmale sind keine Rollenwechsel und werden beim Abgleich nicht entfernt.
function rolleVon(element) {
  const quelle = element.__vorlage && element.__vorlage.nodeType === Node.ELEMENT_NODE ? element.__vorlage : element;
  const teile = [];
  for (const attr of quelle.attributes) {
    if (!attr.name.startsWith('data-') || LAUFZEIT_MERKER.has(attr.name)) continue;
    teile.push(attr.name === 'data-hdrag' ? `${attr.name}=${attr.value}` : attr.name);
  }
  return teile.sort().join(' ');
}

// Ein zur Laufzeit gesetztes data-Merkmal: steht am Knoten, aber nicht in seiner Vorlage.
function laufzeitMerkmal(alt, name) {
  return name.startsWith('data-') && Boolean(alt.__vorlage) && !alt.__vorlage.hasAttribute(name);
}

// Knoten und Vorlage (gleiche Struktur, etwa nach cloneNode) miteinander verbinden.
function vorlageVerknuepfen(knoten, vorlage) {
  if (!knoten || !vorlage || knoten.nodeType !== Node.ELEMENT_NODE) return;
  knoten.__vorlage = vorlage;
  if (knoten.hasAttribute('data-fremd')) return;
  const a = [...knoten.children].filter((kind) => !laufzeitKnoten(kind));
  const b = vorlage.children;
  for (let i = 0; i < a.length && i < b.length; i += 1) vorlageVerknuepfen(a[i], b[i]);
}

function klonMitVorlage(vorlage) {
  const klon = vorlage.cloneNode(true);
  vorlageVerknuepfen(klon, vorlage);
  return klon;
}

function attributeAbgleichen(alt, neu) {
  const aktiv = document.activeElement;
  for (const attr of [...alt.attributes]) {
    if (LAUFZEIT_MERKER.has(attr.name)) continue;
    // Was ein Binder zur Laufzeit gesetzt hat, gehört ihm (data-gleiten, data-impuls …).
    if (laufzeitMerkmal(alt, attr.name)) continue;
    if (!neu.hasAttribute(attr.name)) alt.removeAttribute(attr.name);
  }
  for (const attr of [...neu.attributes]) {
    if (alt.getAttribute(attr.name) === attr.value) continue;
    // Ein Feld, in dem gerade getippt wird, darf seinen Wert nicht verlieren.
    if (alt === aktiv && NIE_UEBERSCHREIBEN.has(attr.name)) continue;
    alt.setAttribute(attr.name, attr.value);
  }
  // Der Wert eines Eingabefelds lebt als PROPERTY, nicht als Attribut.
  if ('value' in alt && alt.tagName === 'INPUT' && alt !== aktiv) {
    const gewuenscht = neu.getAttribute('value');
    if (gewuenscht !== null && alt.value !== gewuenscht) alt.value = gewuenscht;
  }
}

// Ein Binder hat den Knoten mit einem eigenen „…-bound"-Merker übernommen (etwa der
// Tages-Feed) und hält Listen seiner Kinder fest. Solange das neue Markup nur bestätigt,
// was zur Laufzeit ohnehin schon am Knoten steht, bleibt er unangetastet — sonst wird er
// wie bisher frisch eingesetzt, damit der Binder mit dem neuen Aufbau neu anfängt.
function gebundenerKnoten(alt) {
  if (!alt.__vorlage) return false;
  for (const attr of alt.attributes) {
    if (/^data-.+-bound$/.test(attr.name) && !LAUFZEIT_MERKER.has(attr.name) && laufzeitMerkmal(alt, attr.name)) return true;
  }
  return false;
}

// `nachziehen` sammelt reine Zustandsspiegel (aria-*), die das Markup geändert hat und die der
// Binder nicht selbst nachgeführt hat — sie werden am stehenden Knoten gesetzt, statt dafür
// den ganzen Baum neu einzusetzen (gemessen: aria-expanded am Tageskopf des Kalenders).
function schonAngewandt(live, vorher, neu, nachziehen = []) {
  if (!live || !vorher || !neu) return false;
  if (vorher.nodeType !== neu.nodeType || vorher.nodeName !== neu.nodeName) return false;
  if (neu.nodeType === Node.TEXT_NODE) return vorher.nodeValue === neu.nodeValue || live.nodeValue === neu.nodeValue;
  if (neu.nodeType !== Node.ELEMENT_NODE) return true;
  if (live.nodeName !== neu.nodeName) return false;
  const namen = new Set([...vorher.getAttributeNames(), ...neu.getAttributeNames()]);
  for (const name of namen) {
    if (vorher.getAttribute(name) === neu.getAttribute(name)) continue;
    if (live.getAttribute(name) === neu.getAttribute(name)) continue;
    if (name.startsWith('aria-')) { nachziehen.push([live, name, neu.getAttribute(name)]); continue; }
    return false;
  }
  const liveKinder = [...live.childNodes].filter((k) => !laufzeitKnoten(k));
  if (vorher.childNodes.length !== neu.childNodes.length || liveKinder.length !== neu.childNodes.length) return false;
  for (let i = 0; i < neu.childNodes.length; i += 1) {
    if (!schonAngewandt(liveKinder[i], vorher.childNodes[i], neu.childNodes[i], nachziehen)) return false;
  }
  return true;
}

function knotenAbgleichen(alt, neu) {
  if (alt.nodeType !== neu.nodeType || alt.nodeName !== neu.nodeName) {
    alt.replaceWith(klonMitVorlage(neu));
    return;
  }
  if (alt.nodeType === Node.TEXT_NODE) {
    if (alt.nodeValue !== neu.nodeValue) alt.nodeValue = neu.nodeValue;
    return;
  }
  if (alt.nodeType !== Node.ELEMENT_NODE) return;
  if (rolleVon(alt) !== rolleVon(neu)) {
    alt.replaceWith(klonMitVorlage(neu));
    return;
  }
  if (gebundenerKnoten(alt)) {
    const nachziehen = [];
    if (schonAngewandt(alt, alt.__vorlage, neu, nachziehen)) {
      for (const [knoten, name, wert] of nachziehen) {
        if (wert === null) knoten.removeAttribute(name); else knoten.setAttribute(name, wert);
      }
      vorlageVerknuepfen(alt, neu);
      return;
    }
    alt.replaceWith(klonMitVorlage(neu));
    return;
  }
  attributeAbgleichen(alt, neu);
  alt.__vorlage = neu;
  // T5: Ein Knoten mit data-fremd gehört nicht dem Abgleich, sondern einer fremden
  // Bibliothek — die echte Karte baut ihren Inhalt selbst auf (Zeichenfläche, Kacheln,
  // Bedienelemente). Würde der Abgleich dort hineinfassen, risse er die Karte bei jedem
  // Render heraus und baute sie neu auf. Attribute werden weiter gepflegt, der Inhalt nicht.
  if (alt.hasAttribute('data-fremd')) return;
  kinderAbgleichen(alt, neu);
}

// v7 A12 (spec/03 §1): Ein Sheet, das aus dem Markup verschwindet, wurde bisher im
// selben Frame entfernt — es gab gar keinen Knoten mehr, der sich hätte bewegen können.
// Solche Knoten bleiben jetzt kurz stehen, laufen nach unten aus und verschwinden danach.
// Alles andere wird weiterhin sofort entfernt; nur Sheet-Karten und ihr Scrim bekommen
// den Aufschub.
const AUSLAUF_MS = 240;

// Runde 3 (D2): Auch ein Schleier ohne Klasse (die meisten Sheets tragen ihren Blur inline)
// blendet aus, statt im selben Bild zu verschwinden — sonst springt der ganze Hintergrund
// beim Schließen von unscharf auf scharf.
// Der Halte-Schleier des Frei-Knopfs ist kein Sheet: er folgt dem Finger und endet mit ihm.
const SHEET_WAHL = '.ui-sheet-card, .ui-sheet-scrim, [data-layerbox], [style*="--scrim-filter"]:not(#frei-hold *)';

// Knoten, die der Abgleich nicht zuordnen darf: ein Sheet, das gerade ausläuft, und
// Ebenen, die die App zur Laufzeit neben die Seite legt (das Standbild beim Gleiten).
// Gemessen (Runde 3): Ein Render mitten im Auslaufen — typisch „Speichern" mit Toast —
// ordnete das auslaufende Sheet dem nächsten Knoten zu oder entfernte es sofort; Sheet und
// Blur verschwanden in einem Bild. Beim Gleiten riss derselbe Render das Standbild weg.
function laufzeitKnoten(knoten) {
  return knoten.nodeType === Node.ELEMENT_NODE && (knoten.hasAttribute('data-exit') || Boolean(knoten.__morphFrei));
}

// Trägt der Knoten selbst eine Sheet-Fläche — oder enthält sein Teilbaum eine?
function sheetTeile(el) {
  if (el.nodeType !== Node.ELEMENT_NODE) return [];
  const eigene = el.matches(SHEET_WAHL) ? [el] : [];
  return [...eigene, ...el.querySelectorAll(SHEET_WAHL)];
}

function knotenEntfernen(el) {
  const teile = sheetTeile(el);
  // Nichts Bewegliches dabei, oder der Auslauf läuft schon: sofort entfernen.
  if (!teile.length || (el.nodeType === Node.ELEMENT_NODE && el.hasAttribute('data-exit'))) {
    el.remove();
    return;
  }
  // Der Träger bleibt kurz stehen, damit die Karten darin nach unten auslaufen können.
  if (el.nodeType === Node.ELEMENT_NODE) el.setAttribute('data-exit', '');
  teile.forEach((teil) => teil.setAttribute('data-exit', ''));
  window.setTimeout(() => el.remove(), AUSLAUF_MS);
}

function kinderAbgleichen(alt, neu) {
  const alteKinder = [...alt.childNodes].filter((kind) => !laufzeitKnoten(kind));
  const neueKinder = [...neu.childNodes];
  const anzahl = Math.max(alteKinder.length, neueKinder.length);
  for (let i = 0; i < anzahl; i += 1) {
    const a = alteKinder[i];
    const b = neueKinder[i];
    if (a && b) knotenAbgleichen(a, b);
    else if (b) {
      // Neue Knoten gehören VOR eine Laufzeit-Ebene, die hinten anhängt — sonst läge eine
      // frisch geöffnete Seite unter dem auslaufenden Standbild.
      const klon = klonMitVorlage(b);
      const letzter = alteKinder[alteKinder.length - 1];
      if (letzter && letzter.parentNode === alt && letzter.nextSibling) alt.insertBefore(klon, letzter.nextSibling);
      else alt.appendChild(klon);
      alteKinder.push(klon);
    } else if (a) knotenEntfernen(a);
  }
}

// Aktualisiert host mit dem gelieferten HTML. Gibt true zurueck, wenn in place
// abgeglichen wurde, und false, wenn der Baum neu aufgebaut werden musste.
export function morphInto(host, markup) {
  const schablone = document.createElement('div');
  schablone.innerHTML = markup;
  if (!host.firstElementChild || !schablone.firstElementChild) {
    host.innerHTML = markup;
    for (let i = 0; i < host.children.length; i += 1) vorlageVerknuepfen(host.children[i], schablone.children[i]);
    return false;
  }
  // v7 P0: Es wird IMMER abgeglichen — auch ueber Routengrenzen hinweg.
  //
  // Bis v6 baute ein Routenwechsel den Baum komplett neu auf (host.innerHTML = markup),
  // weil dort die Eintrittsanimation laufen sollte. Gemessen kostete das 434 entfernte
  // Elemente je Tabwechsel und 221 beim Oeffnen des QR-Sheets; App-Shell, Tab-Bahn und
  // Sheet-Host starben bei jedem dieser Schritte. v7 verlangt ausdruecklich das
  // Gegenteil: Shell, Pager und Sheet-Host bleiben persistent, Bewegung entsteht ueber
  // transform/opacity statt ueber einen Neuaufbau.
  //
  // Der Abgleich kann das: knotenAbgleichen ersetzt einen Knoten, sobald Typ oder Rolle
  // nicht mehr passen, und laesst alles Uebrige stehen. Die Eintrittsanimation haengt
  // weiterhin am Attribut data-move der Shell — sie greift, weil die CSS-Regel erst
  // durch den Attributwechsel zu passen beginnt.
  kinderAbgleichen(host, schablone);
  return true;
}

// =====================================================================================
// Runde 4 (Basis: „Rückmeldung per Vibration") — EINE Funktion für jede fühlbare Rückmeldung
// -------------------------------------------------------------------------------------
// Vorher standen verstreute navigator.vibrate(6|8|12)-Aufrufe in room.js und profile.js. Auf dem
// iPhone tun die gar nichts: WKWebView kennt navigator.vibrate nicht. In der nativen Hülle geht
// die Rückmeldung deshalb über das Capacitor-Haptics-Plugin (falls eingebaut), sonst über
// navigator.vibrate (Android, Browser). Aufrufer sagen nur, WAS passiert ist:
//
//   rueckmeldung('tipp')        leichter Stoß — etwas wurde ausgelöst (Anstupsen, Frei)
//   rueckmeldung('auswahl')     feine Rastung — ein Wert springt weiter (Rad, Ring, Chips)
//   rueckmeldung('erfolg')      doppelter Stoß — etwas ist gelungen (gespeichert, gesendet)
//   rueckmeldung('zurueck')     etwas wurde zurückgenommen (Anstupser abgewählt, Rückgängig)
//   rueckmeldung('abgelehnt')   geht gerade nicht (Sperre, Fehler)
//   rueckmeldung('schliessen')  ein Sheet wurde weggewischt
//
// Rückgabe: 'haptik' | 'vibration' | 'abgelehnt' (Browser hat es nicht erlaubt) | '' (nichts da).
// =====================================================================================
const RUECKMELDUNGEN = {
  tipp: { muster: 8, weg: 'impact', stil: 'LIGHT' },
  auswahl: { muster: 5, weg: 'auswahl' },
  erfolg: { muster: [10, 45, 14], weg: 'notification', stil: 'SUCCESS' },
  zurueck: { muster: [6, 35, 6], weg: 'impact', stil: 'MEDIUM' },
  abgelehnt: { muster: [16, 55, 16], weg: 'notification', stil: 'WARNING' },
  schliessen: { muster: 10, weg: 'impact', stil: 'LIGHT' },
};

export function rueckmeldung(art = 'tipp') {
  const eintrag = RUECKMELDUNGEN[art] || RUECKMELDUNGEN.tipp;
  let weg = '';
  try {
    const haptik = globalThis.Capacitor?.Plugins?.Haptics;
    const still = (versprechen) => { Promise.resolve(versprechen).catch(() => {}); };
    if (haptik) {
      if (eintrag.weg === 'auswahl') {
        still(haptik.selectionStart?.());
        still(haptik.selectionChanged?.());
        still(haptik.selectionEnd?.());
      } else if (eintrag.weg === 'notification') {
        still(haptik.notification?.({ type: eintrag.stil }));
      } else {
        still(haptik.impact?.({ style: eintrag.stil }));
      }
      weg = 'haptik';
    } else if (typeof globalThis.navigator?.vibrate === 'function') {
      weg = globalThis.navigator.vibrate(eintrag.muster) ? 'vibration' : 'abgelehnt';
    }
  } catch { weg = ''; }
  rueckmeldung.letzte = { art, weg, at: Date.now() };
  return weg;
}

// =====================================================================================
// Runde 4 (C1, Jonathan): „Jede Slide-up soll geschlossen werden können, wenn man es weit genug
// nach unten slidet." — und: „Es ist etwas ruckelig, das Sheet zu schieben. Mach es flüssiger."
// -------------------------------------------------------------------------------------
// EIN Mechanismus am #app für jedes Sheet der App, auch für die der anderen Bereiche. Er muss
// nichts von einem Sheet wissen außer seiner Form:
//   · Karte  = `.ui-sheet-card`, `[data-layerbox]`, `[data-sheet-karte]` — oder jede unten
//              angedockte Karte mit runden oberen und eckigen unteren Ecken, vor der ein
//              vollflächiger Schleier mit data-act liegt (so sind alle Bestätigungs-Sheets gebaut).
//   · Schleier = der vollflächige Knoten mit data-act vor der Karte. Geschlossen wird mit
//              schleier.click() — also GENAU der Weg eines Tipps auf den Hintergrund. Dessen
//              Handler entscheidet: Zustand leeren, Kamera beenden, oder (bearbeitet) nachfragen.
//              Bleibt das Sheet danach stehen (Nachfrage), federt es zurück.
// Bewegung:
//   · Der Finger bewegt NUR die Eigenschaft `translate` der Karte und die Deckkraft des
//     Schleiers, gebündelt auf einen Wert je Bild (requestAnimationFrame). Kein Neuzeichnen, kein
//     Layout-Lesen während des Zugs (die Höhe wird einmal beim Aufsetzen gemessen). `translate`
//     statt `transform`: Die Einfahr-Animation hält `transform` per fill-mode fest und würde jeden
//     eigenen Wert überdecken — `translate` ist eine eigene Transform-Eigenschaft, die der
//     Compositor genauso ohne Layout bewegt. will-change nur während des Zugs (data-sheet-zug).
//   · Zu geht es über die Schwelle (28 % der Höhe, 72–160 px) ODER mit Schwung (> 0,5 px/ms);
//     sonst federt es zurück. Abschluss und Zurückfedern laufen mit derselben Kurve wie das Öffnen.
//   · Beginnt der Zug in scrollbarem Inhalt, gehört er erst dem Inhalt. Steht der Inhalt oben,
//     übernimmt das Sheet nach weiteren 18 px — ein schneller Scroll an den Anfang schließt nicht.
// Ausgenommen: Sheets mit eigenem Zug (QR-Einladung, Gespeichert-Sheet, [data-sheet-eigen]) und
// Züge, die in einem eigenen Bedienelement beginnen (Rad, Regler, Karte, Zuschnitt-Fläche mit
// touch-action:none, Textfeld, [data-sheet-kein-zug]).
// =====================================================================================
const SHEET_KURVE = 'cubic-bezier(.22,.61,.36,1)';   // dieselbe Kurve wie sheetRise (styles.css)
const SHEET_AUF_MS = 300;                            // dieselbe Dauer wie sheetRise
const ZUG_START_PX = 6;
const ZUG_UEBERGABE_PX = 18;
const SHEET_KARTE = '.ui-sheet-card, [data-layerbox], [data-sheet-karte]';
const SHEET_EIGENER_ZUG = '[data-qr-card], [data-sv-sheet] [data-layerbox], [data-sheet-eigen]';
const SHEET_NICHT_ZIEHEN = 'textarea, select, [contenteditable="true"], [contenteditable=""], input[type="range"], [data-fremd], [role="slider"], [data-hdrag]:not([data-hdrag="row"]), [data-sheet-kein-zug]';

function vollflaechig(el, traeger) {
  if (!traeger || getComputedStyle(el).position !== 'absolute') return false;
  return Math.abs(el.offsetWidth - traeger.offsetWidth) <= 2 && Math.abs(el.offsetHeight - traeger.offsetHeight) <= 2;
}

function schleierVor(karte) {
  for (let el = karte.previousElementSibling; el; el = el.previousElementSibling) {
    if (el.hasAttribute('data-act') && !el.firstElementChild && vollflaechig(el, karte.parentElement)) return el;
  }
  return null;
}

function untenAngedockt(el) {
  const traeger = el.parentElement;
  if (!traeger) return false;
  const r = el.getBoundingClientRect();
  const t = traeger.getBoundingClientRect();
  return r.height >= 60 && Math.abs(r.bottom - t.bottom) <= 2 && r.top >= t.top + 12;
}

function sheetForm(el) {
  const stil = getComputedStyle(el);
  return parseFloat(stil.borderTopLeftRadius) >= 12 && parseFloat(stil.borderBottomLeftRadius) < 2;
}

// Das Sheet, in dem ein Zug beginnt: { karte, schleier } oder null.
export function sheetUnter(ziel, wurzel = document.body) {
  for (let el = ziel instanceof Element ? ziel : ziel?.parentElement; el && el !== wurzel; el = el.parentElement) {
    const ausdruecklich = el.matches(SHEET_KARTE);
    if (!ausdruecklich && !el.previousElementSibling?.hasAttribute('data-act')) continue;
    if (!untenAngedockt(el) || (!ausdruecklich && !sheetForm(el))) continue;
    const schleier = schleierVor(el);
    if (schleier) return { karte: el, schleier };
  }
  return null;
}

function scrollflaecheIn(ziel, karte) {
  for (let el = ziel; el; el = el.parentElement) {
    if (el.scrollHeight > el.clientHeight + 1 && /(auto|scroll)/.test(getComputedStyle(el).overflowY)) return el;
    if (el === karte) break;
  }
  return null;
}

function eigenerZug(ziel, karte, maus) {
  if (karte.matches(SHEET_EIGENER_ZUG) || karte.closest('[data-exit], .gleit-ebene, .tab-page[data-role="incoming"]')) return true;
  const sperre = ziel.closest(SHEET_NICHT_ZIEHEN);
  if (sperre && karte.contains(sperre)) return true;
  if (maus && ziel.closest('input')) return true;
  for (let el = ziel; el && el !== karte; el = el.parentElement) {
    if (getComputedStyle(el).touchAction === 'none') return true;
  }
  return false;
}

export function sheetWischen(wurzel) {
  let zug = null;
  let klickSperreBis = 0;
  let eigenerKlick = false;

  const deckkraft = (weg, hoehe) => Math.max(0.08, 1 - Math.max(0, weg) / hoehe).toFixed(3);

  const malen = () => {
    if (!zug) return;
    zug.bild = 0;
    zug.karte.style.translate = `0 ${zug.weg.toFixed(1)}px`;
    zug.schleier.style.opacity = deckkraft(zug.weg, zug.hoehe);
  };

  const beginn = (x, y, ziel, quelle, id) => {
    if (zug || !(ziel instanceof Element)) return;
    const treffer = sheetUnter(ziel, wurzel);
    if (!treffer || eigenerZug(ziel, treffer.karte, quelle !== 'touch')) return;
    zug = {
      ...treffer, act: treffer.schleier.getAttribute('data-act'), quelle, id, x0: x, y0: y, basis: y, weg: 0, modus: null, uebergabe: false,
      scroller: scrollflaecheIn(ziel, treffer.karte), hoehe: treffer.karte.offsetHeight || 1, spur: [], bild: 0,
    };
  };

  const uebernehmen = (y) => {
    zug.modus = 'zug';
    zug.basis = y;
    zug.karte.setAttribute('data-sheet-zug', 'aktiv');
    zug.schleier.setAttribute('data-sheet-schleier', 'aktiv');
  };

  // true → die Bewegung gehört dem Sheet (der Aufrufer verhindert dann das native Scrollen).
  const bewegung = (x, y, zeit) => {
    if (!zug) return false;
    if (!zug.karte.isConnected) { zug = null; return false; }
    if (zug.modus === 'weg') return false;
    if (zug.modus === null) {
      const dx = x - zug.x0;
      const dy = y - zug.y0;
      if (Math.max(Math.abs(dx), Math.abs(dy)) < ZUG_START_PX) return false;
      if (Math.abs(dx) > Math.abs(dy) || dy < 0) { zug.modus = 'weg'; return false; }
      if (zug.scroller && zug.scroller.scrollTop > 0) {
        // Mit der Maus scrollt ein Zug nichts — dort bleibt der Inhalt beim Rad.
        if (zug.quelle !== 'touch') { zug.modus = 'weg'; return false; }
        zug.modus = 'warten';
      } else {
        uebernehmen(y);
      }
    }
    if (zug.modus === 'warten') {
      if (zug.scroller.scrollTop > 0) return false;
      uebernehmen(y + ZUG_UEBERGABE_PX);
      zug.uebergabe = true;
    }
    let weg = y - zug.basis;
    if (weg < 0) weg = zug.uebergabe ? 0 : -Math.min(12, Math.sqrt(-weg) * 1.6);
    zug.weg = weg;
    zug.spur.push({ t: zeit, y });
    if (zug.spur.length > 8) zug.spur.shift();
    if (!zug.bild) zug.bild = requestAnimationFrame(malen);
    return true;
  };

  const aufraeumen = (karte, schleier, zustand) => {
    if (zug && zug.karte === karte) return;
    if (karte.getAttribute('data-sheet-zug') === zustand) {
      karte.removeAttribute('data-sheet-zug');
      karte.style.removeProperty('translate');
      karte.style.removeProperty('transition');
    }
    if (schleier.getAttribute('data-sheet-schleier') === zustand) {
      schleier.removeAttribute('data-sheet-schleier');
      schleier.style.removeProperty('opacity');
      schleier.style.removeProperty('transition');
    }
  };

  const federn = (z) => {
    const { karte, schleier } = z;
    if (!karte.isConnected) return;
    karte.setAttribute('data-sheet-zug', 'federt');
    schleier.setAttribute('data-sheet-schleier', 'federt');
    // Ein Render (etwa die Nachfrage „Änderungen behalten?") kann den Stil zurückgesetzt haben —
    // dann steht die Karte vor dem ersten Bild wieder dort, wo der Finger sie losließ.
    karte.style.transition = 'none';
    karte.style.translate = `0 ${z.weg.toFixed(1)}px`;
    schleier.style.opacity = deckkraft(z.weg, z.hoehe);
    requestAnimationFrame(() => {
      if (!karte.isConnected) return;
      karte.style.transition = `translate ${SHEET_AUF_MS}ms ${SHEET_KURVE}`;
      karte.style.translate = '0px 0px';
      schleier.style.transition = `opacity ${SHEET_AUF_MS}ms ${SHEET_KURVE}`;
      schleier.style.opacity = '1';
      window.setTimeout(() => aufraeumen(karte, schleier, 'federt'), SHEET_AUF_MS + 40);
    });
  };

  const schliessen = (z) => {
    const { karte, schleier } = z;
    karte.setAttribute('data-sheet-zug', 'zu');
    schleier.setAttribute('data-sheet-schleier', 'zu');
    rueckmeldung('schliessen');
    eigenerKlick = true;
    try { schleier.click(); } finally { eigenerKlick = false; }
    if (!karte.isConnected) return;
    if (!karte.closest('[data-exit]')) {
      // Gemessen (Profilbild-Baukasten über „Profil bearbeiten"): Das Schließen zeigt an derselben
      // Stelle ein ANDERES Sheet — der Abgleich verwendet dieselbe Karte weiter. Das neue Sheet
      // steht sofort an seinem Platz, statt vom Finger aus hochzufedern.
      if (!schleier.isConnected || schleier.getAttribute('data-act') !== z.act) {
        [[karte, 'data-sheet-zug', ['translate', 'transition']], [schleier, 'data-sheet-schleier', ['opacity', 'transition']]].forEach(([el, merkmal, props]) => {
          el.removeAttribute(merkmal);
          props.forEach((prop) => el.style.removeProperty(prop));
        });
        return;
      }
      federn(z);
      return;
    }
    // Das Sheet läuft aus (core/html.js knotenEntfernen): von der Stelle des Fingers weiter nach
    // unten, mit der Kurve des Öffnens. Die Standard-Auslaufanimation ist für diese Karte aus.
    requestAnimationFrame(() => {
      karte.style.transition = `translate ${AUSLAUF_MS}ms ${SHEET_KURVE}`;
      karte.style.translate = `0 ${Math.round(z.hoehe + 24)}px`;
      schleier.style.transition = `opacity ${AUSLAUF_MS}ms ${SHEET_KURVE}`;
      schleier.style.opacity = '0';
    });
  };

  const loslassen = () => {
    if (!zug) return;
    const z = zug;
    zug = null;
    if (z.bild) { cancelAnimationFrame(z.bild); z.bild = 0; }
    if (z.modus !== 'zug') return;
    if (z.quelle !== 'touch') klickSperreBis = Date.now() + 350;
    // Bilder vor dem Loslassen zeigen den letzten Stand; der Endwert wird hier einmal gesetzt.
    z.karte.style.translate = `0 ${z.weg.toFixed(1)}px`;
    const letzte = z.spur[z.spur.length - 1];
    const fenster = letzte ? z.spur.filter((p) => p.t >= letzte.t - 100) : [];
    const v = fenster.length > 1 ? (letzte.y - fenster[0].y) / Math.max(1, letzte.t - fenster[0].t) : 0;
    const schwelle = Math.max(72, Math.min(160, z.hoehe * 0.28));
    const schwung = v > 0.5 && z.weg > (z.uebergabe ? schwelle * 0.5 : 24);
    const zu = v > -0.2 && (z.weg > schwelle || schwung);
    wurzel.__sheetWischen = { ergebnis: zu ? 'zu' : 'zurueck', weg: Math.round(z.weg), v: Number(v.toFixed(3)), schwelle: Math.round(schwelle), uebergabe: z.uebergabe };
    if (zu) schliessen(z); else federn(z);
  };

  // --- Finger: Touch-Ereignisse (nur so lässt sich das native Scrollen übernehmen) ---------
  wurzel.addEventListener('touchstart', (event) => {
    if (event.touches.length !== 1) { if (zug) loslassen(); return; }
    const t = event.touches[0];
    beginn(t.clientX, t.clientY, event.target, 'touch', t.identifier);
  }, { passive: true, capture: true });
  wurzel.addEventListener('touchmove', (event) => {
    if (!zug || zug.quelle !== 'touch') return;
    const t = [...event.touches].find((punkt) => punkt.identifier === zug.id);
    if (t && bewegung(t.clientX, t.clientY, event.timeStamp) && event.cancelable) event.preventDefault();
  }, { passive: false, capture: true });
  const touchEnde = (event) => {
    if (!zug || zug.quelle !== 'touch') return;
    if (event.type === 'touchend' && [...event.touches].some((punkt) => punkt.identifier === zug.id)) return;
    loslassen();
  };
  wurzel.addEventListener('touchend', touchEnde, { capture: true });
  wurzel.addEventListener('touchcancel', touchEnde, { capture: true });

  // --- Maus und Stift: Zeiger-Ereignisse ---------------------------------------------------
  wurzel.addEventListener('pointerdown', (event) => {
    if (event.pointerType === 'touch' || event.button !== 0) return;
    beginn(event.clientX, event.clientY, event.target, 'maus', event.pointerId);
  }, true);
  wurzel.addEventListener('pointermove', (event) => {
    if (!zug || zug.quelle !== 'maus' || event.pointerId !== zug.id) return;
    const vorher = zug.modus;
    if (!bewegung(event.clientX, event.clientY, event.timeStamp)) return;
    if (vorher !== 'zug') { try { zug.karte.setPointerCapture(event.pointerId); } catch { /* egal */ } }
    event.preventDefault();
  }, true);
  const zeigerEnde = (event) => {
    if (zug && zug.quelle === 'maus' && event.pointerId === zug.id) loslassen();
  };
  wurzel.addEventListener('pointerup', zeigerEnde, true);
  wurzel.addEventListener('pointercancel', zeigerEnde, true);

  // Nach einem Mauszug landet der Loslass-Klick auf dem, was darunter liegt — oft der Schleier.
  wurzel.addEventListener('click', (event) => {
    if (eigenerKlick || Date.now() >= klickSperreBis) return;
    klickSperreBis = 0;
    event.stopPropagation();
    event.preventDefault();
  }, true);

  return {
    // Ein Render mitten im Zug setzt das style-Attribut der Karte auf das Markup zurück.
    // app.js ruft dies nach jedem Abgleich; die Karte steht dann weiter unter dem Finger.
    nachRender() {
      if (!zug || zug.modus !== 'zug') return;
      if (!zug.karte.isConnected) { zug = null; return; }
      zug.karte.style.translate = `0 ${zug.weg.toFixed(1)}px`;
      zug.schleier.style.opacity = deckkraft(zug.weg, zug.hoehe);
    },
  };
}
