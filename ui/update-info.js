// Runde 6 (P5, B4) — kurze Info nach einer neuen Fassung.
//
// Jonathan: „eventuell bei updates kurze info, nur kleines popup wenn nichts relevantes, und
// slideup wenn es spezielle funktionen gibt die man verstehen sollte mit genauer
// veranschaulichung."
//
// Zwei Formen, mehr nicht:
//   klein  — ein schmaler Streifen oben: „Neu: …". Er verschwindet von selbst.
//   groß   — ein Slide-up mit EINEM Bild, EINEM Satz und EINEM Knopf, der direkt zur Funktion
//            führt. Nur für Funktionen, die man verstehen sollte.
//
// Runde 7 (C1, Jonathan zum Guide: „am besten das er direkt in der offiziellen ansicht ist"):
// Derselbe Gedanke gilt hier. Der Knopf eines großen Eintrags kann jetzt nicht nur irgendwohin
// führen, sondern die STELLE zeigen — mit demselben Loch im Dunkel wie der Guide
// (ui/guide.js › guideZeigen). Wer „Zeig mir wo" tippt, sieht den echten Knopf und kann ihn
// im selben Moment drücken; das Loch sperrt nicht weg, was es zeigt.
//
// Gesteuert wird alles über FASSUNG und INHALTE hier im Modul:
//   · höchstens EINE Info je Fassung (es gewinnt der neueste Eintrag über dem gemerkten Stand),
//   · NIE beim ersten Start — wer die App neu hat, bekommt den Guide, nicht die Update-Info.
//
// Schnittstelle:
//   updateInfoBeimStart(ctx)        einmal nach dem Start (nach guideBeimStart) aufrufen
//   updateInfoZeigen(ctx, eintrag)  eine Info von Hand zeigen
//   updateInfoFassung() / updateInfoStand() / updateInfoZuruecksetzen()

import { esc, rueckmeldung } from '../core/html.js';
import { t as tx } from '../core/sprache.js';
import { ebeneAnlegen, ebeneSchliessen, guideBild, guideOffen, guideZeigen } from './guide.js';

const FONT = "'Instrument Sans',sans-serif";
const TITEL_FONT = "'Bricolage Grotesque',sans-serif";
const MERKER = 'crew.update.fassung';
const STREIFEN_MS = 5200;

/** Die Fassung dieser App. Wird sie erhöht, darf genau EIN Eintrag dazukommen. */
export const FASSUNG = 9;

// Ein Eintrag:
//   { fassung, art: 'klein' | 'gross', satz, titel?, bild?, knopf? }
//   bild:  'free' | 'karte' | 'meet' | 'glocke' | 'profil'  (gezeichnet, aus ui/guide.js)
//   knopf: { text, tab?: 'crew'|'meet'|'karte'|'profil', route?, params?, zeigen? }
//   zeigen: { sel, titel, satz, form?, auf?, dauer?, ort?, rueckfall? } — Runde 7 (C1): Statt nur
//           zu SAGEN, dass es etwas Neues gibt, führt der Knopf zu der STELLE und legt für einen
//           Moment das Loch darum (ui/guide.js › guideZeigen). Der Titel ist ein Aussagesatz,
//           keine Frage. Das Loch sperrt nicht weg, was es zeigt: Wer gleich tippt, benutzt die
//           Sache sofort.
//           `ort` und `rueckfall` sind die Ehrlichkeit dazu (Welle 2): Gibt es die Stelle gerade
//           nicht — die Fußleiste fehlt zum Beispiel in den Einstellungen —, wird einmal
//           hingeführt, und wenn sie dann immer noch fehlt, sagt eine gezeichnete Karte, was es
//           Neues gibt, statt „Tipp drauf" über einen Bildschirm ohne den Knopf zu legen.
// Klein sieht so aus:  { fassung: 10, art: 'klein', satz: () => t('…') } — ein Satz, kein Bild,
// kein Knopf; der Streifen verschwindet von selbst.
const INHALTE = [
  {
    fassung: 8,
    art: 'gross',
    bild: 'karte',
    titel: () => tx('Die Karte in groß'),
    satz: () => tx('Tipp auf eine kleine Karte — sie öffnet sich jetzt als große Karte in der App.'),
    knopf: { text: () => tx('Karte ansehen'), tab: 'crew' },
  },
  {
    // Runde 7: Der größte sichtbare Umbau ist der vierte Bereich (core/router.js › TAB_ORDER).
    // Wer die App schon hat, findet ihn sonst nur zufällig — deshalb zeigt der Knopf ihn.
    fassung: 9,
    art: 'gross',
    bild: 'karte',
    titel: () => tx('Die Karte ist ein eigener Bereich'),
    satz: () => tx('Leute und Meets liegen jetzt zusammen auf einer Karte — unten in der Leiste.'),
    knopf: {
      text: () => tx('Zeig mir wo'),
      // tab: der Knopf bringt zuerst dorthin, wo es die Fußleiste überhaupt gibt (aus einem
      // Einstellungs-Bildschirm heraus gibt es sie nicht). `ort` ist das Netz darunter.
      tab: 'crew',
      zeigen: {
        sel: '[data-act="tab"][data-tab="karte"]',
        form: 'pille',
        ort: 'crew',
        titel: () => tx('Hier ist die Karte'),
        satz: () => tx('Tipp drauf — du kannst gleich hin.'),
        rueckfall: {
          titel: () => tx('Die Karte ist ein eigener Bereich'),
          satz: () => tx('Sie liegt unten in der Leiste — gleich neben Crew.'),
        },
        dauer: 3600,
      },
    },
  },
];

function lesen() {
  try {
    const wert = globalThis.localStorage?.getItem(MERKER);
    return wert === null || wert === undefined ? null : Number(wert);
  } catch { return null; }
}

function schreiben(fassung) {
  try { globalThis.localStorage?.setItem(MERKER, String(fassung)); } catch { /* privates Fenster */ }
}

function text(wert) {
  return typeof wert === 'function' ? wert() : String(wert ?? '');
}

export function updateInfoFassung() { return FASSUNG; }
export function updateInfoStand() { return lesen(); }
export function updateInfoZuruecksetzen() {
  try { globalThis.localStorage?.removeItem(MERKER); } catch { /* egal */ }
}

// --- klein: der Streifen ----------------------------------------------------------------------

let streifenUhr = null;

function statusHoehe() {
  const leiste = globalThis.document?.querySelector('#app > .runtime-shell:not(.gleit-ebene) .runtime-phone > [data-role="statusleiste"]');
  return leiste ? Math.round(leiste.getBoundingClientRect().height) : 46;
}

function streifenZeigen(ctx, eintrag) {
  const knoten = ebeneAnlegen('update-klein');
  if (!knoten) return Promise.resolve(false);
  // Der Streifen liegt ÜBER der Seite, fängt aber nichts ab außer sich selbst.
  knoten.style.pointerEvents = 'none';
  knoten.innerHTML = `<div data-role="update-streifen" style="position:absolute;left:14px;right:14px;top:${statusHoehe() + 6}px;pointer-events:auto">
<button data-update-act="zu" data-treffer style="width:100%;display:flex;align-items:center;gap:9px;padding:10px 14px;border:1px solid var(--ink-a10);border-radius:999px;background:var(--surface);box-shadow:0 6px 18px var(--shadow-12);color:var(--ink);font-family:${FONT};text-align:left;cursor:pointer;appearance:none">
<span style="width:8px;height:8px;border-radius:50%;background:var(--green);flex:none;pointer-events:none"></span>
<span style="font-size:13px;font-weight:600;line-height:1.35;flex:1;min-width:0;pointer-events:none">${esc(tx('Neu: {was}', { was: text(eintrag.satz) }))}</span>
</button></div>`;
  const streifen = knoten.firstElementChild;
  if (typeof streifen.animate === 'function') {
    streifen.animate([{ opacity: 0, transform: 'translateY(-12px)' }, { opacity: 1, transform: 'none' }], { duration: 260, easing: 'cubic-bezier(.22,.61,.36,1)' });
  }
  let fertig = null;
  const versprechen = new Promise((loesen) => { fertig = loesen; });
  const schliessen = () => {
    clearTimeout(streifenUhr);
    streifenUhr = null;
    knoten.style.pointerEvents = '';
    ebeneSchliessen(knoten, { dauer: 200 }).then(() => fertig(true));
  };
  knoten.addEventListener('click', (ereignis) => {
    if (!ereignis.target.closest('[data-update-act]')) return;
    ereignis.preventDefault();
    rueckmeldung('schliessen');
    schliessen();
  });
  clearTimeout(streifenUhr);
  streifenUhr = setTimeout(schliessen, STREIFEN_MS);
  return versprechen;
}

// --- groß: das Slide-up -----------------------------------------------------------------------

function sheetZeigen(ctx, eintrag) {
  const knoten = ebeneAnlegen('update-gross');
  if (!knoten) return Promise.resolve(false);
  const titel = text(eintrag.titel) || tx('Neu in Crew');
  const knopfText = eintrag.knopf ? text(eintrag.knopf.text) : '';
  knoten.innerHTML = `<div data-act="update-scrim" data-update-act="zu" style="position:absolute;inset:0;background:var(--scrim);-webkit-backdrop-filter:var(--scrim-filter);backdrop-filter:var(--scrim-filter)"></div>
<div class="ui-sheet-card" data-role="update-sheet" data-fassung="${eintrag.fassung || FASSUNG}" role="dialog" aria-modal="true" aria-label="${esc(titel)}" style="position:absolute;left:0;right:0;bottom:0;background:var(--surface);border-radius:26px 26px 0 0;box-shadow:0 -10px 30px var(--shadow-15);padding:14px 20px calc(24px + env(safe-area-inset-bottom, 0px));display:flex;flex-direction:column;gap:14px;font-family:${FONT};color:var(--ink)">
<span style="width:38px;height:4px;border-radius:999px;background:var(--handle);align-self:center;flex:none"></span>
<span style="height:150px;display:flex;align-items:center;justify-content:center;flex:none;background:var(--paper);border-radius:18px;padding:10px;box-sizing:border-box">${guideBild(eintrag.bild || 'meet', { hoehe: '130' })}</span>
<span style="display:flex;flex-direction:column;gap:6px">
<span style="font-family:${TITEL_FONT};font-size:21px;font-weight:650;letter-spacing:-.02em">${esc(titel)}</span>
<span style="font-size:14px;line-height:1.5;color:var(--ink-soft)">${esc(text(eintrag.satz))}</span>
</span>
<span style="display:flex;flex-direction:column;gap:8px">
${knopfText ? `<button data-update-act="los" data-treffer style="min-height:50px;border:0;border-radius:999px;background:var(--green);color:var(--on-accent);font:650 15px/1 ${FONT};cursor:pointer;appearance:none"><span style="pointer-events:none">${esc(knopfText)}</span></button>` : ''}
<button data-update-act="zu" data-treffer style="min-height:44px;border:0;border-radius:999px;background:transparent;color:var(--muted);font:650 14px/1 ${FONT};cursor:pointer;appearance:none"><span style="pointer-events:none">${esc(tx('Alles klar'))}</span></button>
</span>
</div>`;
  let fertig = null;
  const versprechen = new Promise((loesen) => { fertig = loesen; });
  const schliessen = (los) => {
    ebeneSchliessen(knoten, { dauer: 200 }).then(() => {
      const ziel = los && eintrag.knopf ? eintrag.knopf : null;
      if (ziel?.route) ctx?.nav?.resetTo?.(ziel.route, ziel.params || {});
      else if (ziel?.tab) ctx?.nav?.setTab?.(ziel.tab);
      ctx?.render?.();
      // Runde 7 (C1): „Zeig mir wo" tut genau das — es legt das Loch um die echte Stelle,
      // statt sie zu beschreiben. Erst nach dem Render, sonst misst der Hinweis die alte Seite.
      if (ziel?.zeigen) {
        const h = ziel.zeigen;
        const rueckfall = h.rueckfall
          ? { titel: text(h.rueckfall.titel), satz: text(h.rueckfall.satz) }
          : null;
        requestAnimationFrame(() => {
          guideZeigen(ctx, { ...h, titel: text(h.titel), satz: text(h.satz), rueckfall, bild: eintrag.bild })
            .then(() => fertig(true));
        });
        return;
      }
      fertig(true);
    });
  };
  knoten.addEventListener('click', (ereignis) => {
    const ziel = ereignis.target.closest('[data-update-act]');
    if (!ziel || !knoten.contains(ziel)) return;
    ereignis.preventDefault();
    ereignis.stopPropagation();
    rueckmeldung(ziel.dataset.updateAct === 'los' ? 'tipp' : 'schliessen');
    schliessen(ziel.dataset.updateAct === 'los');
  });
  return versprechen;
}

/** Eine Info von Hand zeigen — 'klein' oder 'gross'. */
export function updateInfoZeigen(ctx, eintrag) {
  if (!eintrag) return Promise.resolve(false);
  return eintrag.art === 'klein' ? streifenZeigen(ctx, eintrag) : sheetZeigen(ctx, eintrag);
}

/**
 * Einmal nach dem Start aufrufen — am besten NACH guideBeimStart(), damit auf einem frischen
 * Gerät nur der Guide läuft. Gibt ein Versprechen auf true, wenn eine Info gezeigt wurde.
 */
export function updateInfoBeimStart(ctx) {
  const gesehen = lesen();
  // Erster Start dieses Geräts: Stand merken, nichts zeigen.
  if (gesehen === null || Number.isNaN(gesehen)) { schreiben(FASSUNG); return Promise.resolve(false); }
  if (gesehen >= FASSUNG) return Promise.resolve(false);
  const eintrag = INHALTE.filter((e) => e.fassung > gesehen).sort((a, b) => b.fassung - a.fassung)[0];
  schreiben(FASSUNG);
  if (!eintrag || guideOffen()) return Promise.resolve(false);
  return updateInfoZeigen(ctx, eintrag);
}
