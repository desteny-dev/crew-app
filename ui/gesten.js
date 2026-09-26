// Runde 11 (C1, Jonathan D3) — WEM gehört ein waagrechter Zug?
//
// „Tab-Wischen nur am äußeren Rand (~24 px). Die Mitte gehört der Seite: Crew-Zeilen wischen =
// Schnellaktionen; Meet-Tab wischen = Liste↔Kalender. Zurück-Wischen zieht die Ebene weg und zeigt
// die vorherige Seite darunter." Und im Chat: eine Nachricht wischen = auf sie antworten.
//
// Die Regel steht HIER, einmal — app.js (Tab-Bahn, Zurück) und jede Seite lesen dieselbe:
//   · Beginnt ein Finger in den äußeren WISCH_RAND px des Rahmens, gehört der Zug der App: links
//     „zurück", wenn es etwas zurückzugehen gibt, sonst (und rechts) die Tab-Bahn. Keine Seite
//     nimmt ihn.
//   · Beginnt er weiter innen, gehört er der Seite — sofern sie dort eine eigene Geste hat
//     (waagrechtZiehen). Hat sie keine, passiert nichts. Die Mitte wechselt keinen Tab mehr.
//   · Eine Fläche mit eigener waagrechter Bedienung (Reihe zum Rollen, Karte, Regler) behält ihren
//     Zug immer (eigeneWaagrechteGeste — dieselbe Regel, die die Bahn schon vorher las).
//
// Gemessen wird am Rahmen (.runtime-phone), nicht am Fenster: In der Desktop-Vorschau steht das
// Telefon mitten im Fenster, auf dem Gerät füllt es den Bildschirm — beides ist derselbe Rand.

export const WISCH_RAND = 24;

// 'links' | 'rechts' | null — liegt x im Randstreifen des Rahmens, in dem `bezug` steht?
export function randSeite(x, bezug) {
  const knoten = bezug?.closest?.('.runtime-phone') || bezug?.querySelector?.('.runtime-phone') || bezug;
  const r = knoten?.getBoundingClientRect?.();
  if (!r || !r.width) return null;
  if (x - r.left <= WISCH_RAND) return 'links';
  if (r.right - x <= WISCH_RAND) return 'rechts';
  return null;
}

// Gehört ein waagrechter Zug, der auf `ziel` beginnt, einem eigenen Bedienelement?
export function eigeneWaagrechteGeste(ziel, grenze) {
  for (let knoten = ziel; knoten && knoten !== grenze && knoten.nodeType === 1; knoten = knoten.parentElement) {
    if (knoten.dataset?.hdrag) return true;
    // Eine echte Karte gehört MapLibre (data-fremd, siehe core/html.js).
    if (knoten.dataset?.fremd) return true;
    if (knoten.getAttribute?.('role') === 'slider') return true;
    const stil = globalThis.getComputedStyle?.(knoten);
    if (stil && /(auto|scroll)/.test(stil.overflowX) && knoten.scrollWidth > knoten.clientWidth + 2) return true;
  }
  return false;
}

// Der Klick, der auf einen echten Zug folgt, gehört noch zum Zug — sonst öffnete das Loslassen
// zusätzlich die Zeile, auf der der Finger lag.
export function klickSchlucken(knoten, ms = 350) {
  if (!knoten) return;
  const sperre = (ereignis) => { ereignis.stopPropagation(); ereignis.preventDefault(); };
  knoten.addEventListener('click', sperre, { capture: true });
  globalThis.setTimeout(() => knoten.removeEventListener('click', sperre, { capture: true }), ms);
}

// Ein waagrechter Zug auf einer Fläche einer Seite — Finger und Maus, dieselbe Schwelle wie die
// Tab-Bahn (12 px waagrecht, klar waagrechter als senkrecht; wer senkrecht zieht, rollt).
//
//   waagrechtZiehen(flaeche, schluessel, {
//     beginnt(ziel, x, y) → daten | null   (null: hier gibt es nichts zu ziehen)
//     darf?(daten, dx)    → boolean         (z. B. nur nach rechts; false gibt den Zug frei)
//     bewegt(daten, dx, dy)
//     endet(daten, dx, schwung)             (schwung in px/ms, mit Vorzeichen)
//     abbruch?(daten)
//   })
//
// Die Fläche wird einmal gebunden; jeder Aufruf (jeder Render) ersetzt nur die Handler, damit sie
// den frischen Zustand lesen. Der NICHT-passive touchmove-Horcher hängt nur, solange ein Zug läuft
// (Runde 7, K8: ein dauerhafter nimmt dem Browser den schnellen Rollweg über der ganzen Fläche).
export function waagrechtZiehen(flaeche, schluessel, handler) {
  if (!flaeche) return;
  const merker = `__wisch_${schluessel}`;
  flaeche[merker] = handler;
  const gebunden = `${merker}_gebunden`;
  if (flaeche[gebunden]) return;
  flaeche[gebunden] = true;

  let zug = null;
  let horcht = false;
  const h = () => flaeche[merker] || {};

  function bewegungFinger(ereignis) {
    if (!zug) { hoerAuf(); return; }
    const t = [...ereignis.touches].find((punkt) => punkt.identifier === zug.id);
    if (t) bewegen(t.clientX, t.clientY, ereignis);
  }
  function hoerAuf() {
    if (!horcht) return;
    horcht = false;
    flaeche.removeEventListener('touchmove', bewegungFinger, { capture: false });
  }
  function horchen() {
    if (horcht) return;
    horcht = true;
    flaeche.addEventListener('touchmove', bewegungFinger, { passive: false });
  }

  function starten(ziel, x, y, id) {
    zug = null;
    if (randSeite(x, flaeche)) return false;
    if (eigeneWaagrechteGeste(ziel, flaeche)) return false;
    const daten = h().beginnt?.(ziel, x, y);
    if (!daten) return false;
    zug = { x, y, id, t: Date.now(), aktiv: false, daten, dx: 0 };
    return true;
  }

  function bewegen(x, y, ereignis) {
    if (!zug) return;
    const dx = x - zug.x;
    const dy = y - zug.y;
    if (!zug.aktiv) {
      if (Math.abs(dy) > 10 && Math.abs(dy) >= Math.abs(dx)) { abbrechen(); return; }
      if (!(Math.abs(dx) > 12 && Math.abs(dx) > Math.abs(dy) * 1.2)) return;
      if (h().darf && !h().darf(zug.daten, dx)) { abbrechen(); return; }
      zug.aktiv = true;
    }
    zug.dx = dx;
    if (ereignis?.cancelable) ereignis.preventDefault();
    h().bewegt?.(zug.daten, dx, dy);
  }

  function loslassen() {
    hoerAuf();
    const z = zug;
    zug = null;
    if (!z || !z.aktiv) return;
    klickSchlucken(flaeche);
    const dauer = Math.max(1, Date.now() - z.t);
    h().endet?.(z.daten, z.dx, z.dx / dauer);
  }

  function abbrechen() {
    hoerAuf();
    const z = zug;
    zug = null;
    if (z?.aktiv) h().abbruch?.(z.daten);
  }

  // --- Finger ---
  flaeche.addEventListener('touchstart', (ereignis) => {
    if (ereignis.touches.length !== 1) { abbrechen(); return; }
    const t = ereignis.touches[0];
    if (starten(ereignis.target, t.clientX, t.clientY, t.identifier)) horchen();
  }, { passive: true });
  flaeche.addEventListener('touchend', loslassen);
  flaeche.addEventListener('touchcancel', abbrechen);

  // --- Maus (Web am Rechner): dieselbe Regel ---
  const mausBewegt = (ereignis) => { if (ereignis.pointerType === 'mouse') bewegen(ereignis.clientX, ereignis.clientY, ereignis); };
  const mausLos = (ereignis) => {
    if (ereignis.pointerType !== 'mouse') return;
    globalThis.removeEventListener('pointermove', mausBewegt);
    globalThis.removeEventListener('pointerup', mausLos);
    loslassen();
  };
  flaeche.addEventListener('pointerdown', (ereignis) => {
    if (ereignis.pointerType !== 'mouse' || ereignis.button !== 0) return;
    if (!starten(ereignis.target, ereignis.clientX, ereignis.clientY, 'maus')) return;
    globalThis.addEventListener('pointermove', mausBewegt);
    globalThis.addEventListener('pointerup', mausLos);
  });
}
