// Die große Karte IN der App (Runde 6, C5) — EIN Baustein für jede kleine Karte der App.
//
// Jonathan: „ich will jede karte in der app öffnen können … man kann aber nicht die karte und den
// standort vom meet in der app anklicken und in einer großen ansicht ansehen, sondern es zeigt
// einen immer nur die auswahl für google oder apple maps."
//
// Also: Ein Tipp auf eine kleine Karte öffnet die große Karte in der App — der Ort in der Mitte,
// Titel und Adresse oben, unten „Route" und „Schließen". Die Anbieterwahl (Apple/Google) kommt
// ERST hinter „Route". Wischen nach unten schließt, ebenso Escape und die Zurück-Geste.
//
// Warum eine Ebene und keine eigene Route: Die kleinen Karten stehen oft IN einem Sheet
// (Vorschlag, Raum). Eine Route würde das Sheet verlassen und beim Zurückkommen neu aufbauen —
// der Weg zurück wäre ein anderer als der Weg hin. Diese Ebene legt sich über den Rahmen, lässt
// alles darunter stehen und braucht weder app.js noch den Router. Damit der Abgleich der App sie
// nicht wegräumt, trägt ihr Knoten __morphFrei (core/html.js › laufzeitKnoten).
//
// Schnittstelle:
//   karteGrossOeffnen(ort)              ort = { titel, adresse?, lat, lon, zeichen?, unter? }
//   karteGrossAktionen(fuellen?)        → für bindActions: 'karte-gross'. Ohne `fuellen` kommt der
//                                       Ort aus den data-Merkmalen (lat, lon, titel, adresse).
//   karteGrossZu()                      → schließen
//   karteGrossOffen()                   → true, solange die große Karte steht
//
// Alles Sichtbare läuft über die Übersetzung (core/sprache.js), alle Farben über Tokens.

import { esc, rueckmeldung } from '../core/html.js';
import { t } from '../core/sprache.js';
import {
  karteHalten, karteVon, ortMarken, oeffneRoute, bedienSpalteOrdnen, kartenLageQuelle, hatKoordinaten,
} from './map.js';

const SCHLUESSEL = 'karte-gross';
const FONT = "'Instrument Sans',sans-serif";
const TITEL_FONT = "'Bricolage Grotesque',sans-serif";
const AUF_MS = 280;
const ZU_MS = 200;
const KURVE = 'cubic-bezier(.22,.61,.36,1)';
const WISCH_SCHWELLE = 96;
const ZUG_START_PX = 6;

const reduziert = () => {
  try { return Boolean(globalThis.matchMedia?.('(prefers-reduced-motion: reduce)').matches); } catch { return false; }
};

function rahmen() {
  return globalThis.document?.querySelector('.runtime-phone') || globalThis.document?.body || null;
}

export function karteGrossOffen() {
  return Boolean(globalThis.document?.querySelector('[data-role="karte-gross"]'));
}

// --- Zurück-Geste (Browser, Android) ----------------------------------------------------------
// Wie bei der großen Bildansicht (ui/bild-gross.js): Beim Öffnen steht ein Eintrag im Verlauf, die
// Zurück-Geste nimmt ihn und schließt die Karte, statt die Seite zu verlassen.
let verlaufEintrag = false;

function verlaufMerken() {
  if (verlaufEintrag) return;
  try {
    globalThis.history?.pushState({ crewKarteGross: true }, '');
    verlaufEintrag = true;
  } catch { /* ohne Verlauf bleiben Knopf, Wischen und Escape */ }
}

function verlaufFreigeben() {
  if (!verlaufEintrag) return;
  verlaufEintrag = false;
  try {
    if (globalThis.history?.state?.crewKarteGross) globalThis.history.back();
  } catch { /* egal */ }
}

if (globalThis.window?.addEventListener) {
  window.addEventListener('popstate', () => {
    if (!verlaufEintrag) return;
    verlaufEintrag = false;
    document.querySelector('[data-role="karte-gross"]')?.__schliessen?.('zurueck');
  });
  document.addEventListener('keydown', (ereignis) => {
    if (ereignis.key !== 'Escape') return;
    const offen = document.querySelector('[data-role="karte-gross"]');
    if (!offen?.__schliessen) return;
    ereignis.preventDefault();
    if (offen.dataset.wahl === '1') { offen.__wahl?.(false); return; }
    offen.__schliessen('taste');
  });
}

// --- Markup -----------------------------------------------------------------------------------

const KNOPF = `min-height:50px;padding:0 18px;border-radius:999px;display:flex;align-items:center;justify-content:center;gap:8px;font:650 14.5px/1 ${FONT};cursor:pointer;appearance:none;-webkit-tap-highlight-color:transparent`;

const routeZeichen = () => `<svg width="16" height="16" viewBox="0 0 24 24" fill="none" aria-hidden="true" style="display:block;flex:none"><path d="M6 19h9a3.5 3.5 0 0 0 0-7H9a3.5 3.5 0 0 1 0-7h9" stroke="currentColor" stroke-width="1.9" stroke-linecap="round"></path><circle cx="4.5" cy="19" r="1.9" fill="currentColor"></circle><circle cx="19.5" cy="5" r="1.9" fill="currentColor"></circle></svg>`;
const ortZeichen = () => `<svg width="19" height="19" viewBox="0 0 24 24" fill="none" aria-hidden="true" style="display:block"><path d="M12 21.5s7-6.1 7-11a7 7 0 1 0-14 0c0 4.9 7 11 7 11Z" stroke="currentColor" stroke-width="1.8" stroke-linejoin="round"></path><circle cx="12" cy="10.4" r="2.5" stroke="currentColor" stroke-width="1.8"></circle></svg>`;

function anbieterZeile(anbieter, name) {
  return `<button type="button" data-anbieter="${esc(anbieter)}" style="display:flex;align-items:center;gap:12px;width:100%;min-height:52px;padding:0 6px;border:0;border-top:1px solid var(--ink-a06);background:transparent;cursor:pointer;appearance:none;font:650 14.5px/1 ${FONT};color:var(--ink);text-align:left">
<span style="width:34px;height:34px;border-radius:11px;background:var(--paper);color:var(--ink);display:flex;align-items:center;justify-content:center;flex:none;pointer-events:none">${ortZeichen()}</span>
<span style="pointer-events:none;flex:1;min-width:0">${esc(name)}</span>
</button>`;
}

function markup(ort) {
  const titel = ort.titel || t('Ort');
  const zeichen = ort.zeichen
    ? `<span data-role="karte-gross-zeichen" aria-hidden="true" style="width:38px;height:38px;border-radius:12px;background:var(--paper);color:var(--ink);display:flex;align-items:center;justify-content:center;flex:none">${ort.zeichen}</span>`
    : '';
  const unten = [ort.adresse, ort.unter].filter(Boolean).join(' · ');
  return `<div data-role="karte-gross-buehne" style="position:absolute;inset:0;will-change:transform">
<div data-fremd="1" data-role="karte-gross-karte" data-lat="${esc(ort.lat)}" data-lon="${esc(ort.lon)}" style="position:absolute;inset:0;background:var(--map-tint)"></div>
<div data-role="karte-gross-kopf" data-ueber-karte style="position:absolute;left:12px;right:12px;top:calc(max(env(safe-area-inset-top, 0px), 20px) + 10px);z-index:3;background:var(--surface);border:1px solid var(--ink-a08);border-radius:20px;box-shadow:0 10px 28px var(--shadow-18);padding:9px 14px 13px;display:flex;flex-direction:column;touch-action:none;cursor:grab">
<span aria-hidden="true" style="width:38px;height:4px;border-radius:2px;background:var(--handle);align-self:center;margin-bottom:9px;flex:none"></span>
<span style="display:flex;align-items:center;gap:11px;min-width:0">${zeichen}
<span style="display:flex;flex-direction:column;gap:2px;min-width:0;flex:1">
<span data-role="karte-gross-titel" style="font-family:${TITEL_FONT};font-size:17px;font-weight:650;letter-spacing:-.01em;color:var(--ink);white-space:nowrap;overflow:hidden;text-overflow:ellipsis">${esc(titel)}</span>
${unten ? `<span data-role="karte-gross-adresse" style="font:500 12.5px/1.35 ${FONT};color:var(--ink-soft);white-space:nowrap;overflow:hidden;text-overflow:ellipsis">${esc(unten)}</span>` : ''}
</span></span>
</div>
<div data-role="karte-gross-fuss" data-ueber-karte style="position:absolute;left:12px;right:12px;bottom:calc(max(env(safe-area-inset-bottom, 0px), 6px) + 14px);z-index:3;display:flex;gap:10px">
<button type="button" data-role="karte-gross-route" style="${KNOPF};flex:1;background:var(--green);color:var(--on-accent);border:0;box-shadow:0 8px 22px var(--green-a30)"><span style="pointer-events:none;display:flex">${routeZeichen()}</span><span style="pointer-events:none">${esc(t('Route'))}</span></button>
<button type="button" data-role="karte-gross-zu" style="${KNOPF};flex:1;background:var(--surface);color:var(--ink);border:1.5px solid var(--ink-a14);box-shadow:0 6px 18px var(--shadow-14)"><span style="pointer-events:none">${esc(t('Schließen'))}</span></button>
</div>
</div>
<div data-role="karte-gross-wahl" hidden style="position:absolute;inset:0;z-index:8">
<div data-role="karte-gross-wahl-grund" style="position:absolute;inset:0;background:var(--scrim);-webkit-backdrop-filter:var(--scrim-filter);backdrop-filter:var(--scrim-filter)"></div>
<div data-role="karte-gross-wahl-blatt" style="position:absolute;left:0;right:0;bottom:0;background:var(--surface);border-radius:26px 26px 0 0;box-shadow:0 -10px 30px var(--shadow-18);padding:14px 20px calc(env(safe-area-inset-bottom, 0px) + 24px);display:flex;flex-direction:column">
<span aria-hidden="true" style="width:38px;height:4px;border-radius:2px;background:var(--handle);align-self:center;margin-bottom:12px;flex:none"></span>
<span style="font-family:${TITEL_FONT};font-size:18px;font-weight:650;color:var(--ink);padding-bottom:2px">${esc(t('Route öffnen'))}</span>
<span style="font:500 12.5px/1.35 ${FONT};color:var(--muted);padding-bottom:8px;white-space:nowrap;overflow:hidden;text-overflow:ellipsis">${esc(titel)}</span>
${anbieterZeile('apple', t('Apple Karten'))}
${anbieterZeile('google', 'Google Maps')}
<button type="button" data-role="karte-gross-wahl-zu" style="${KNOPF};margin-top:14px;background:transparent;color:var(--ink-soft);border:1.5px solid var(--ink-a14)"><span style="pointer-events:none">${esc(t('Abbrechen'))}</span></button>
</div>
</div>`;
}

// --- Öffnen -----------------------------------------------------------------------------------

export function karteGrossOeffnen(ort) {
  const ziel = rahmen();
  if (!ziel || !ort || !hatKoordinaten({ lat: Number(ort.lat), lon: Number(ort.lon) })) return false;
  // Schon offen? Dann wird nur der Ort getauscht — nie zwei Ebenen übereinander.
  karteGrossZu();
  const lat = Number(ort.lat);
  const lon = Number(ort.lon);
  const daten = { ...ort, lat, lon };
  const el = document.createElement('div');
  el.dataset.role = 'karte-gross';
  el.dataset.kartenFlaeche = '';
  el.setAttribute('role', 'dialog');
  el.setAttribute('aria-modal', 'true');
  el.setAttribute('aria-label', daten.titel || t('Ort'));
  el.setAttribute('data-sheet-kein-zug', '');
  el.style.cssText = `position:absolute;inset:0;z-index:60;background:var(--paper);overflow:hidden;font-family:${FONT};color:var(--ink)`;
  el.innerHTML = markup(daten);
  // Der Abgleich der App (core/html.js) lässt diesen Knoten in Ruhe — er gehört uns.
  el.__morphFrei = true;
  ziel.appendChild(el);
  rueckmeldung('tipp');
  verlaufMerken();
  binden(el, daten);
  return true;
}

export function karteGrossZu() {
  const offen = document.querySelector('[data-role="karte-gross"]');
  if (!offen) return false;
  verlaufFreigeben();
  offen.remove();
  return true;
}

export function karteGrossAktionen(fuellen) {
  return {
    'karte-gross': (daten, element) => {
      const ort = typeof fuellen === 'function' ? fuellen(daten, element) : {
        titel: daten.titel || '', adresse: daten.adresse || '', lat: Number(daten.lat), lon: Number(daten.lon),
      };
      if (ort) karteGrossOeffnen(ort);
    },
  };
}

// --- Karte, Gesten, Route ---------------------------------------------------------------------

function binden(el, ort) {
  const teil = (rolle) => el.querySelector(`[data-role="${rolle}"]`);
  const buehne = teil('karte-gross-buehne');
  const kopf = teil('karte-gross-kopf');
  const wahl = teil('karte-gross-wahl');

  // Die echte Karte — dieselben Bausteine wie jede andere Karte der App: Bedienleiste unten
  // (Regler und ⓘ), meine Lage, und der Ort als Markierung genau auf seinem Punkt.
  const flaeche = teil('karte-gross-karte');
  karteHalten(flaeche, SCHLUESSEL, {
    mitte: { lat: ort.lat, lon: ort.lon }, zoom: 15.4, interaktiv: true, folgen: false, hoehenRegler: true,
  }).then((karte) => {
    if (!karte || !el.isConnected) return;
    try { kartenLageQuelle(globalThis.__crew?.repo); } catch { /* ohne Repository bleibt der Punkt weg */ }
    bedienSpalteOrdnen(karte);
    const marken = ortMarken(karte, { schluessel: SCHLUESSEL });
    marken?.setzen([{
      key: SCHLUESSEL,
      lat: ort.lat,
      lon: ort.lon,
      eintraege: [{
        id: SCHLUESSEL,
        zeichen: ort.zeichen || ortZeichen(),
        titel: ort.titel || t('Ort'),
        unter: ort.unter || '',
        ton: '',
        label: [ort.titel, ort.adresse].filter(Boolean).join(', '),
      }],
    }]);
  }).catch(() => { /* ohne Karte bleiben Titel, Adresse und die Knöpfe */ });

  // Anbieterwahl — erst HIER, nie beim Tipp auf die kleine Karte.
  const wahlZeigen = (an) => {
    if (an) {
      wahl.hidden = false;
      el.dataset.wahl = '1';
      if (!reduziert()) {
        teil('karte-gross-wahl-grund')?.animate?.([{ opacity: 0 }, { opacity: 1 }], { duration: 160, easing: 'ease-out' });
        teil('karte-gross-wahl-blatt')?.animate?.([{ transform: 'translateY(100%)' }, { transform: 'none' }], { duration: 240, easing: KURVE });
      }
    } else {
      wahl.hidden = true;
      delete el.dataset.wahl;
    }
  };
  el.__wahl = wahlZeigen;

  teil('karte-gross-route')?.addEventListener('click', (ereignis) => {
    ereignis.preventDefault();
    rueckmeldung('tipp');
    wahlZeigen(true);
  });
  teil('karte-gross-zu')?.addEventListener('click', (ereignis) => {
    ereignis.preventDefault();
    el.__schliessen('knopf');
  });
  teil('karte-gross-wahl-grund')?.addEventListener('click', () => wahlZeigen(false));
  teil('karte-gross-wahl-zu')?.addEventListener('click', (ereignis) => { ereignis.preventDefault(); wahlZeigen(false); });
  for (const knopf of wahl.querySelectorAll('[data-anbieter]')) {
    knopf.addEventListener('click', (ereignis) => {
      ereignis.preventDefault();
      rueckmeldung('tipp');
      wahlZeigen(false);
      oeffneRoute({ name: ort.titel || '', address: ort.adresse || '', lat: ort.lat, lon: ort.lon }, knopf.dataset.anbieter);
    });
  }

  // Öffnen: die Ebene kommt von unten herein — derselbe Weg, den das Wischen zurückgeht.
  if (typeof el.animate === 'function') {
    if (reduziert()) el.animate([{ opacity: 0 }, { opacity: 1 }], { duration: 140, easing: 'ease-out' });
    else {
      el.animate([{ opacity: 0.4 }, { opacity: 1 }], { duration: 140, easing: 'ease-out' });
      buehne.animate([{ transform: 'translateY(26px) scale(.985)' }, { transform: 'none' }], { duration: AUF_MS, easing: KURVE });
    }
  }
  try { teil('karte-gross-zu')?.focus({ preventScroll: true }); } catch { /* egal */ }

  el.__schliessen = (art = 'tipp') => {
    if (el.__schliesst) return;
    el.__schliesst = true;
    el.dataset.zu = art;
    if (art !== 'zurueck') verlaufFreigeben();
    const fertig = () => { el.remove(); };
    if (typeof el.animate !== 'function' || reduziert()) { fertig(); return; }
    const weg = parseFloat(buehne.style.translate?.split(' ')[1]) || 0;
    const lauf = buehne.animate(
      [{ transform: `translateY(${weg}px)`, opacity: 1 }, { transform: `translateY(${Math.round(weg + 120)}px)`, opacity: 0 }],
      { duration: ZU_MS, easing: 'cubic-bezier(.4,0,.2,1)', fill: 'forwards' },
    );
    el.animate([{ opacity: 1 }, { opacity: 0 }], { duration: ZU_MS, fill: 'forwards' });
    lauf.finished.then(fertig, fertig);
  };

  // Wischen nach unten schließt. Gezogen wird am Kopf (er trägt den Griff) — die Karte selbst
  // gehört dem Finger zum Schieben, sonst könnte man sie nicht mehr bewegen.
  let zug = null;
  const malen = (dy) => {
    buehne.style.translate = `0 ${Math.max(0, dy).toFixed(1)}px`;
    el.style.opacity = String(Math.max(0.5, 1 - Math.max(0, dy) / 520).toFixed(3));
  };
  const federn = () => {
    const von = buehne.style.translate || '0 0';
    buehne.style.removeProperty('translate');
    el.style.removeProperty('opacity');
    if (typeof buehne.animate === 'function' && !reduziert()) {
      buehne.animate([{ translate: von }, { translate: '0 0' }], { duration: 240, easing: 'cubic-bezier(.34,1.3,.64,1)' }).finished.catch(() => {});
    }
  };
  // Gemessen: Ein Zeiger, der beim Ziehen die Kopfkarte verlässt (schon nach 40 px), verliert sie
  // als Ziel — setPointerCapture allein reichte nicht. Deshalb hört der laufende Zug am FENSTER zu
  // und meldet sich am Ende wieder ab; angefasst wird trotzdem nur der Kopf.
  const bewegung = (ereignis) => {
    if (!zug || ereignis.pointerId !== zug.id) return;
    const dy = ereignis.clientY - zug.y0;
    const dx = ereignis.clientX - zug.x0;
    if (!zug.aktiv) {
      if (Math.abs(dy) < ZUG_START_PX || Math.abs(dy) < Math.abs(dx)) return;
      zug.aktiv = true;
    }
    if (ereignis.cancelable) ereignis.preventDefault();
    zug.dy = dy > 0 ? dy : dy * 0.2;
    malen(zug.dy);
  };
  const ende = (ereignis) => {
    if (!zug || ereignis.pointerId !== zug.id) return;
    const z = zug;
    zug = null;
    globalThis.removeEventListener?.('pointermove', bewegung, true);
    globalThis.removeEventListener?.('pointerup', ende, true);
    globalThis.removeEventListener?.('pointercancel', ende, true);
    if (!z.aktiv) return;
    el.dataset.wisch = String(Math.round(z.dy));
    if (ereignis.type !== 'pointercancel' && z.dy > WISCH_SCHWELLE) {
      rueckmeldung('schliessen');
      el.__schliessen('wisch');
    } else federn();
  };
  kopf.addEventListener('pointerdown', (ereignis) => {
    if (!ereignis.isPrimary || el.__schliesst || zug) return;
    zug = { id: ereignis.pointerId, y0: ereignis.clientY, x0: ereignis.clientX, dy: 0, aktiv: false };
    globalThis.addEventListener?.('pointermove', bewegung, { capture: true, passive: false });
    globalThis.addEventListener?.('pointerup', ende, true);
    globalThis.addEventListener?.('pointercancel', ende, true);
  });

  // Gerät gedreht, Tastatur auf: Die Bedienleiste der Karte misst neu.
  const neuMessen = () => { const karte = karteVon(SCHLUESSEL); if (karte) bedienSpalteOrdnen(karte); };
  globalThis.addEventListener?.('resize', neuMessen);
  const wache = new MutationObserver(() => {
    if (el.isConnected) return;
    wache.disconnect();
    zug = null;
    globalThis.removeEventListener?.('resize', neuMessen);
    globalThis.removeEventListener?.('pointermove', bewegung, true);
    globalThis.removeEventListener?.('pointerup', ende, true);
    globalThis.removeEventListener?.('pointercancel', ende, true);
  });
  wache.observe(document.body, { childList: true, subtree: true });
}
