// Profilbild groß ansehen (Runde 5, B4) — EIN Baustein für jede Stelle, an der man das Bild
// einer anderen Person (oder einer Gruppe) antippen kann.
//
// Jonathan: „Und im Profil will ich von anderen das Bild groß machen."
//
// Was man sieht (Runde 7, C3 — Jonathan: „nur das bild gross wird und der rest im hintergrund
// blurry, das soll standart design psylosophy sein"): Das Bild wächst aus der angetippten Scheibe
// in die Mitte, und dahinter bleibt die Seite stehen — unscharf, nicht zugedeckt. Sonst steht da
// nichts: Name, Zeichen und Zustand sind kein fester Zettel mehr, sondern kommen auf einen Tipp
// aufs Bild und gehen mit dem nächsten wieder. Echte Fotos stehen in voller Größe im <img> — der
// Browser rechnet sie aus der Quelle, nicht aus einem kleinen Vorschaubild. Gestaltete Bilder
// (Motiv, Emoji, Initialen) zeichnet avatarFlaeche direkt in der großen Größe; nichts wird per
// Transformation hochgezogen. Die Animation arbeitet nur mit transform/opacity auf dem fertig
// gezeichneten großen Bild — am Ende steht es scharf und ohne Transformation da.
//
// Schließen: Tipp irgendwohin außer aufs Bild · nach unten wischen (das Bild folgt dem Finger) ·
// Zurück (Knopf oben links an der Stelle des Zurück-Pfeils der Seite, Escape, Zurück-Geste des
// Browsers bzw. Android). Der Zurück-Knopf bleibt sichtbar: Eine Ebene ohne sichtbaren Ausweg ist
// eine Falle — für Tastatur und Vorlesen sowieso.
//
// Die Regel dahinter, für jede weitere Stelle, die etwas groß zeigt: EIN unscharfer Grund
// (var(--scrim) + blur), das Ding selbst ohne Rahmen in der Mitte, Beschreibendes nur auf Wunsch,
// Handlungen (Zurück, ein mitgegebener Knopf) bleiben sichtbar.
//
// Schnittstelle (Zustand lebt in ctx.ui.bildGross, wie bei Sheets):
//   bildGrossHtml(ctx)                    → Markup für overlays ('' wenn zu)
//   bildGrossBinden(root, ctx)            → nach jedem Rendern im bind aufrufen
//   bildGrossAktionen(ctx)                → in bindActions einhängen: 'bild-gross' (data-person
//                                           oder data-crew am Knopf) und 'bild-gross-zu'
//   bildGrossOeffnen(ctx, element, { art: 'person' | 'gruppe', id, zeichnen?, knopf? })
//                                           element = die angetippte Scheibe (Startpunkt)
//                                           zeichnen(d) = eigenes Markup der Scheibe (z. B. Gruppenkreis)
//                                           knopf = { act, text } — eine Handlung unter dem Namen;
//                                           ihr Handler ruft bildGrossZu(ctx) selbst auf
//   bildGrossZu(ctx)                      → sofort schließen (ohne Animation)
//   bildGrossInZeilen(root, ctx, selektor) → Personenzeilen (personRow): Tipp auf das Profilbild
//                                           öffnet die große Ansicht, der Rest der Zeile bleibt,
//                                           wie er ist. Die Zeile braucht data-person.

import { esc, rueckmeldung } from '../core/html.js';
import { t, tn } from '../core/sprache.js';
import { avatarFlaeche, personMarker, specialLabelChip } from './components.js';
import { backArrow } from './icons.js';

const AUF_MS = 320;
const ZU_MS = 240;
const KURVE = 'cubic-bezier(.22,.61,.36,1)';
const WISCH_SCHWELLE = 110;
const ZUG_START_PX = 8;

const reduziert = () => typeof matchMedia === 'function' && matchMedia('(prefers-reduced-motion: reduce)').matches;

function initialenAus(name) {
  const worte = String(name || '').split(/[^\p{L}\d]+/u).filter(Boolean);
  return `${worte[0]?.[0] || ''}${worte[1]?.[0] || worte[0]?.[1] || ''}`.toUpperCase();
}

function rahmenVon(element) {
  return element?.closest?.('.runtime-phone') || globalThis.document?.querySelector('.runtime-phone') || null;
}

// Skalierung des Handyrahmens (in der Vorschau am PC ist er verkleinert).
function skalaVon(rahmen) {
  if (!rahmen || !rahmen.offsetWidth) return 1;
  return rahmen.getBoundingClientRect().width / rahmen.offsetWidth || 1;
}

// Mitte und Durchmesser einer Scheibe im Fenster.
function scheibeLage(element) {
  if (!element?.getBoundingClientRect) return null;
  const r = element.getBoundingClientRect();
  if (!r.width || !r.height) return null;
  return { x: r.left + r.width / 2, y: r.top + r.height / 2, d: Math.min(r.width, r.height) };
}

// --- Zurück-Geste (Browser, Android) ----------------------------------------------------------
// Beim Öffnen steht ein Eintrag im Verlauf; die Zurück-Geste nimmt ihn und schließt das Bild,
// statt die Seite zu verlassen. Schließt man anders, wird der Eintrag wieder freigegeben.
let verlaufEintrag = false;

function verlaufMerken() {
  if (verlaufEintrag) return;
  try {
    globalThis.history?.pushState({ crewBildGross: true }, '');
    verlaufEintrag = true;
  } catch { /* ohne Verlauf bleibt Tipp, Wischen und der Knopf */ }
}

function verlaufFreigeben() {
  if (!verlaufEintrag) return;
  verlaufEintrag = false;
  try {
    if (globalThis.history?.state?.crewBildGross) globalThis.history.back();
  } catch { /* egal */ }
}

if (globalThis.window?.addEventListener) {
  window.addEventListener('popstate', () => {
    if (!verlaufEintrag) return;
    verlaufEintrag = false;
    const offen = document.querySelector('[data-role="bild-gross"]');
    if (offen?.__schliessen) offen.__schliessen('zurueck');
  });
  document.addEventListener('keydown', (event) => {
    if (event.key !== 'Escape') return;
    const offen = document.querySelector('[data-role="bild-gross"]');
    if (!offen?.__schliessen) return;
    event.preventDefault();
    offen.__schliessen('taste');
  });
}

// --- Öffnen und Schließen ---------------------------------------------------------------------

export function bildGrossOeffnen(ctx, element, { art = 'person', id, zeichnen = null, knopf = null } = {}) {
  if (!ctx?.ui || !id) return;
  const rahmen = rahmenVon(element);
  const breite = rahmen?.offsetWidth || globalThis.innerWidth || 390;
  const hoehe = rahmen?.offsetHeight || globalThis.innerHeight || 844;
  // Groß, aber mit Luft zum Rand (32 px je Seite — eine Scheibe an der Kante wirkt nicht groß,
  // sondern angeschnitten). Die alte Deckelung auf die halbe Höhe gab es nur wegen des Zettels
  // darunter; ohne ihn entscheidet die kürzere Seite.
  const groesse = Math.round(Math.max(160, Math.min(breite - 64, hoehe - 160, 400)));
  ctx.ui.bildGross = { art: art === 'gruppe' ? 'gruppe' : 'person', id, von: scheibeLage(element), groesse, zeichnen, knopf, knopfLage: null, angaben: false };
  rueckmeldung('tipp');
  verlaufMerken();
  ctx.render();
}

export function bildGrossZu(ctx) {
  if (!ctx?.ui?.bildGross) return;
  ctx.ui.bildGross = null;
  verlaufFreigeben();
}

export function bildGrossAktionen(ctx) {
  return {
    'bild-gross': (daten, element) => {
      if (daten.crew) bildGrossOeffnen(ctx, element, { art: 'gruppe', id: daten.crew });
      else if (daten.person) bildGrossOeffnen(ctx, element?.querySelector?.('[data-role="person-avatar"]') || element, { art: 'person', id: daten.person });
    },
    // Runde 7 (C3): Ein Tipp aufs Bild zeigt die Angaben und nimmt sie wieder weg. Bewusst ohne
    // ctx.render() — die Ebene lebt weiter (Animation, Zug, Verlauf), nur ihr Fuß ändert sich.
    'bild-gross-info': (daten, element) => {
      const offen = element?.closest?.('[data-role="bild-gross"]');
      if (offen?.__angaben) offen.__angaben();
    },
    'bild-gross-zu': (daten, element) => {
      const offen = element?.closest?.('[data-role="bild-gross"]');
      if (offen?.__schliessen) offen.__schliessen('knopf');
      else { bildGrossZu(ctx); ctx.render(); }
    },
  };
}

// --- Inhalt -----------------------------------------------------------------------------------

function inhaltVon(ctx, zustand) {
  const d = zustand.groesse;
  const schrift = Math.round(d * 0.34);
  if (zustand.art === 'gruppe') {
    const crew = ctx.repo.getCrew?.(zustand.id);
    if (!crew) return null;
    return {
      name: crew.name,
      label: t('Gruppenbild von {name}', { name: crew.name }),
      flaeche: zustand.zeichnen ? zustand.zeichnen(d) : avatarFlaeche({ photo: crew.groupImage, color: crew.color, initials: initialenAus(crew.name) }, d, schrift),
      zusatz: '',
      unter: `<span style="font-size:13.5px;color:var(--muted)">${esc(tn((crew.memberIds || []).length, '{n} Mitglied', '{n} Mitglieder'))}</span>`,
    };
  }
  const person = ctx.repo.getPerson(zustand.id);
  if (!person) return null;
  const marker = personMarker(person.id, ctx.repo.getSettings());
  // Runde 11 (A13): Nur „frei" zählt — ob jemand gerade in einem Meet steckt, steht nirgends mehr.
  let unter = '';
  if (person.free?.active && !person.activeMeetId) {
    unter = `<span data-role="bild-gross-zustand" data-art="frei" style="display:inline-flex;align-items:center;gap:6px;font-size:13.5px;font-weight:650;color:var(--green-dark)"><span style="width:8px;height:8px;border-radius:50%;background:var(--green);flex:none"></span>${esc(t('Gerade frei'))}</span>`;
  }
  return {
    name: person.name,
    label: t('Profilbild von {name}', { name: person.name }),
    flaeche: avatarFlaeche(person, d, schrift),
    zusatz: specialLabelChip(marker),
    unter,
  };
}

export function bildGrossHtml(ctx) {
  const zustand = ctx?.ui?.bildGross;
  if (!zustand) return '';
  const inhalt = inhaltVon(ctx, zustand);
  if (!inhalt) return '';
  const d = zustand.groesse;
  const lage = zustand.knopfLage;
  const zurueckLage = lage ? `left:${lage.links}px;top:${lage.oben}px` : 'left:12px;top:48px';
  const an = Boolean(zustand.angaben);
  // Eine mitgegebene Handlung ist kein Beiwerk, sondern der Grund, warum jemand die Ansicht
  // geöffnet hat — sie steht unten und bleibt sichtbar, auch wenn die Angaben aus sind.
  const knopf = zustand.knopf
    ? `<button data-act="${esc(zustand.knopf.act)}" data-role="bild-gross-knopf" style="pointer-events:auto;min-height:44px;padding:0 18px;border-radius:999px;border:1.5px solid var(--ink-a14);background:var(--surface);color:var(--ink);font:650 14px 'Instrument Sans',sans-serif;cursor:pointer;appearance:none;box-shadow:0 2px 8px var(--shadow-08)"><span style="pointer-events:none">${esc(zustand.knopf.text)}</span></button>`
    : '';
  return `<div data-role="bild-gross" data-art="${zustand.art}" data-angaben="${an ? '1' : '0'}" data-sheet-kein-zug role="dialog" aria-modal="true" aria-label="${esc(inhalt.label)}" style="position:absolute;inset:0;z-index:40;display:flex;align-items:center;justify-content:center;touch-action:none;user-select:none;-webkit-user-select:none;-webkit-touch-callout:none;cursor:zoom-out;font-family:'Instrument Sans',sans-serif">
<div data-role="bild-gross-grund" aria-hidden="true" style="position:absolute;inset:0;background:var(--scrim);-webkit-backdrop-filter:blur(26px) saturate(1.04);backdrop-filter:blur(26px) saturate(1.04)"></div>
<button data-act="bild-gross-zu" data-role="bild-gross-zurueck" aria-label="${esc(t('Zurück'))}" style="position:absolute;${zurueckLage};z-index:2;width:44px;height:44px;border-radius:50%;border:0;padding:0;background:transparent;display:flex;align-items:center;justify-content:center;cursor:pointer;appearance:none"><span style="width:38px;height:38px;border-radius:50%;background:var(--surface);box-shadow:0 2px 8px var(--shadow-12);display:flex;align-items:center;justify-content:center;pointer-events:none">${backArrow('var(--ink)', 20)}</span></button>
<div data-role="bild-gross-buehne" style="position:relative;z-index:1;display:flex;align-items:center;justify-content:center;max-width:100%;pointer-events:none">
<button data-act="bild-gross-info" data-role="bild-gross-scheibe" aria-expanded="${an ? 'true' : 'false'}" aria-label="${esc(an ? t('Angaben ausblenden') : t('Angaben anzeigen'))}" style="position:relative;display:block;width:${d}px;height:${d}px;padding:0;border:0;box-sizing:border-box;border-radius:${zustand.art === 'gruppe' ? '20%' : '50%'};overflow:hidden;flex:none;background:var(--field);box-shadow:0 18px 46px var(--shadow-22);transform-origin:50% 50%;pointer-events:auto;cursor:pointer;appearance:none">${inhalt.flaeche}</button>
</div>
<div data-role="bild-gross-fuss" style="position:absolute;left:0;right:0;bottom:30px;z-index:1;display:flex;flex-direction:column;align-items:center;gap:12px;padding:0 20px;pointer-events:none">
<div data-role="bild-gross-text" style="display:${an ? 'flex' : 'none'};flex-direction:column;align-items:center;gap:4px;max-width:100%;text-align:center;background:var(--surface);border-radius:18px;padding:10px 16px;box-shadow:0 2px 10px var(--shadow-12)">
<span style="display:flex;align-items:center;gap:8px;max-width:100%;font-family:'Bricolage Grotesque',sans-serif;font-size:21px;font-weight:650;color:var(--ink);letter-spacing:-.01em"><span style="white-space:nowrap;overflow:hidden;text-overflow:ellipsis">${esc(inhalt.name)}</span>${inhalt.zusatz}</span>
${inhalt.unter}
</div>
${knopf}
</div>
</div>`;
}

// --- Gesten und Animation ---------------------------------------------------------------------

export function bildGrossBinden(root, ctx) {
  const overlay = root?.querySelector?.('[data-role="bild-gross"]') || null;
  if (!overlay) {
    // Das Bild ist ohne unser Zutun verschwunden (Routenwechsel): Zurück-Eintrag freigeben.
    if (!ctx?.ui?.bildGross && verlaufEintrag && !globalThis.document?.querySelector('[data-role="bild-gross"]')) verlaufFreigeben();
    return;
  }
  overlay.__ctx = ctx;
  const zustand = ctx.ui.bildGross;
  const rahmen = rahmenVon(overlay);
  const skala = skalaVon(rahmen);

  // Der Zurück-Knopf steht genau dort, wo auf der Seite darunter der Zurück-Pfeil sitzt.
  if (zustand && !zustand.knopfLage) {
    const pfeile = [...(rahmen || document).querySelectorAll('.screen-header [data-act="back"]')]
      .filter((pfeil) => !overlay.contains(pfeil) && pfeil.getBoundingClientRect().width > 0);
    const pfeil = pfeile.find((kandidat) => !kandidat.closest('.tab-page[data-role="incoming"], .gleit-ebene')) || pfeile[0];
    const o = overlay.getBoundingClientRect();
    if (pfeil) {
      const p = pfeil.getBoundingClientRect();
      zustand.knopfLage = {
        links: Math.max(6, Math.round((p.left + p.width / 2 - o.left) / skala - 22)),
        oben: Math.max(6, Math.round((p.top + p.height / 2 - o.top) / skala - 22)),
      };
    } else {
      zustand.knopfLage = { links: 12, oben: 48 };
    }
    const knopf = overlay.querySelector('[data-role="bild-gross-zurueck"]');
    if (knopf) { knopf.style.left = `${zustand.knopfLage.links}px`; knopf.style.top = `${zustand.knopfLage.oben}px`; }
  }

  if (overlay.__gebunden) return;
  overlay.__gebunden = true;

  const teil = (rolle) => overlay.querySelector(`[data-role="${rolle}"]`);
  const flip = () => {
    const von = overlay.__ctx?.ui?.bildGross?.von;
    const scheibe = teil('bild-gross-scheibe');
    const ziel = scheibeLage(scheibe);
    if (!von || !ziel) return null;
    return `translate(${((von.x - ziel.x) / skala).toFixed(1)}px, ${((von.y - ziel.y) / skala).toFixed(1)}px) scale(${(von.d / ziel.d).toFixed(4)})`;
  };

  // Öffnen: aus der angetippten Scheibe heraus.
  if (typeof overlay.animate === 'function') {
    if (reduziert()) {
      overlay.animate([{ opacity: 0 }, { opacity: 1 }], { duration: 160, easing: 'ease-out' });
    } else {
      const start = flip();
      teil('bild-gross-grund')?.animate([{ opacity: 0 }, { opacity: 1 }], { duration: 220, easing: 'ease-out' });
      teil('bild-gross-scheibe')?.animate(
        start ? [{ transform: start }, { transform: 'none' }] : [{ transform: 'scale(.86)', opacity: 0 }, { transform: 'none', opacity: 1 }],
        { duration: AUF_MS, easing: KURVE },
      );
      teil('bild-gross-fuss')?.animate([{ opacity: 0, transform: 'translateY(10px)' }, { opacity: 1, transform: 'none' }], { duration: 260, delay: 90, easing: 'ease-out', fill: 'backwards' });
      teil('bild-gross-zurueck')?.animate([{ opacity: 0 }, { opacity: 1 }], { duration: 200, delay: 80, fill: 'backwards' });
    }
  }
  try { teil('bild-gross-zurueck')?.focus({ preventScroll: true }); } catch { /* egal */ }

  // Runde 7 (C3): Angaben auf Wunsch. Sie stehen unten in der Ebene, nicht in der Bühne — das
  // Bild bleibt beim Ein- und Ausblenden genau da, wo es ist, und springt nicht.
  const angabenSetzen = (an) => {
    const text = teil('bild-gross-text');
    if (!text) return;
    const scheibe = teil('bild-gross-scheibe');
    if (overlay.__ctx?.ui?.bildGross) overlay.__ctx.ui.bildGross.angaben = an;
    overlay.dataset.angaben = an ? '1' : '0';
    if (scheibe) {
      scheibe.setAttribute('aria-expanded', an ? 'true' : 'false');
      scheibe.setAttribute('aria-label', an ? t('Angaben ausblenden') : t('Angaben anzeigen'));
    }
    if (an) {
      text.style.display = 'flex';
      if (!reduziert() && typeof text.animate === 'function') {
        text.animate([{ opacity: 0, transform: 'translateY(8px)' }, { opacity: 1, transform: 'none' }], { duration: 200, easing: 'ease-out' });
      }
      return;
    }
    const weg = () => { text.style.display = 'none'; };
    if (reduziert() || typeof text.animate !== 'function') { weg(); return; }
    text.animate([{ opacity: 1 }, { opacity: 0 }], { duration: 140, easing: 'ease-in' }).finished.then(weg, weg);
  };
  overlay.__angaben = () => {
    if (overlay.__schliesst) return;
    // Nach einem Zug, der zurückgefedert ist, kommt noch ein Klick — der darf nichts umschalten.
    if (overlay.__gewischt) { overlay.__gewischt = false; return; }
    rueckmeldung('tipp');
    angabenSetzen(teil('bild-gross-text')?.style.display === 'none');
  };

  const fertig = () => {
    const aktuell = overlay.__ctx;
    if (!aktuell?.ui?.bildGross) return;
    aktuell.ui.bildGross = null;
    aktuell.render();
  };

  overlay.__schliessen = (art = 'tipp') => {
    if (overlay.__schliesst) return;
    overlay.__schliesst = true;
    overlay.dataset.zu = art;
    if (art !== 'zurueck') verlaufFreigeben();
    if (typeof overlay.animate !== 'function' || reduziert()) {
      if (typeof overlay.animate === 'function') overlay.animate([{ opacity: 1 }, { opacity: 0 }], { duration: 140, fill: 'forwards' }).finished.then(fertig, fertig);
      else fertig();
      return;
    }
    const buehne = teil('bild-gross-buehne');
    const optionen = { duration: ZU_MS, easing: 'cubic-bezier(.4,0,.2,1)', fill: 'forwards' };
    let laeuft;
    if (art === 'wisch') {
      // Weiter in Richtung des Fingers, dabei kleiner und durchsichtig.
      const translate = buehne.style.translate || '0 0';
      const weg = parseFloat(translate.split(' ')[1]) || 0;
      laeuft = buehne.animate([
        { translate, scale: buehne.style.scale || '1', opacity: 1 },
        { translate: `0 ${Math.round(weg + 220)}px`, scale: '.82', opacity: 0 },
      ], optionen);
    } else {
      const ziel = flip();
      laeuft = teil('bild-gross-scheibe').animate(
        ziel ? [{ transform: 'none' }, { transform: ziel }] : [{ transform: 'none', opacity: 1 }, { transform: 'scale(.86)', opacity: 0 }],
        optionen,
      );
      teil('bild-gross-fuss')?.animate([{ opacity: 1 }, { opacity: 0 }], { duration: 120, fill: 'forwards' });
    }
    teil('bild-gross-grund')?.animate([{ opacity: getComputedStyle(teil('bild-gross-grund')).opacity }, { opacity: 0 }], optionen);
    teil('bild-gross-zurueck')?.animate([{ opacity: 1 }, { opacity: 0 }], { duration: 120, fill: 'forwards' });
    laeuft.finished.then(fertig, fertig);
  };

  // Gemessen (Runde 7): Seit das Bild ein Knopf ist, startet die Maus auf dem <img> darin einen
  // echten Datei-Zug des Browsers. Der schickt sofort ein pointercancel — und damit brach das
  // Wischen nach unten mit der Maus ab, während es mit dem Finger weiter lief. Ein Bild in einer
  // Ansicht, die man wegwischt, wird nicht irgendwohin gezogen: der Zug wird abgesagt.
  overlay.addEventListener('dragstart', (event) => event.preventDefault());

  // Tipp irgendwohin schließt — außer auf einem Knopf (der hat seinen eigenen Weg).
  overlay.addEventListener('click', (event) => {
    if (event.target.closest('[data-act]')) return;
    if (overlay.__gewischt) { overlay.__gewischt = false; return; }
    event.preventDefault();
    overlay.__schliessen('tipp');
  });

  // Nach unten wischen: das Bild folgt dem Finger, der Grund wird durchsichtiger.
  let zug = null;
  const malen = (weg) => {
    const buehne = teil('bild-gross-buehne');
    const nachUnten = Math.max(0, weg);
    buehne.style.translate = `0 ${(weg / skala).toFixed(1)}px`;
    buehne.style.scale = String(1 - Math.min(nachUnten, 500) / 2200);
    const grund = teil('bild-gross-grund');
    if (grund) grund.style.opacity = String(Math.max(0.12, 1 - nachUnten / 420).toFixed(3));
    const zurueck = teil('bild-gross-zurueck');
    if (zurueck) zurueck.style.opacity = String(Math.max(0, 1 - nachUnten / 160).toFixed(3));
    const fuss = teil('bild-gross-fuss');
    if (fuss) fuss.style.opacity = String(Math.max(0, 1 - nachUnten / 160).toFixed(3));
  };
  const federn = () => {
    const buehne = teil('bild-gross-buehne');
    const grund = teil('bild-gross-grund');
    const zurueck = teil('bild-gross-zurueck');
    const fuss = teil('bild-gross-fuss');
    const aufraeumen = () => {
      buehne.style.removeProperty('translate');
      buehne.style.removeProperty('scale');
      grund?.style.removeProperty('opacity');
      zurueck?.style.removeProperty('opacity');
      fuss?.style.removeProperty('opacity');
    };
    if (typeof buehne.animate !== 'function') { aufraeumen(); return; }
    const anim = buehne.animate([
      { translate: buehne.style.translate || '0 0', scale: buehne.style.scale || '1' },
      { translate: '0 0', scale: '1' },
    ], { duration: 260, easing: 'cubic-bezier(.34,1.4,.64,1)' });
    grund?.animate([{ opacity: grund.style.opacity || '1' }, { opacity: 1 }], { duration: 200 });
    aufraeumen();
    anim.finished.catch(() => {});
  };

  // Das Bild ist seit Runde 7 selbst ein Knopf (Angaben). Ein Zug darf trotzdem auf ihm beginnen —
  // sonst wäre genau die Fläche, die man anfasst, die einzige, von der aus man nicht wischen kann.
  const fremdeHandlung = (ziel) => {
    const k = ziel?.closest?.('[data-act]');
    return k && k.dataset.act !== 'bild-gross-info' ? k : null;
  };

  overlay.addEventListener('pointerdown', (event) => {
    if (!event.isPrimary || overlay.__schliesst || fremdeHandlung(event.target)) return;
    overlay.__gewischt = false;
    zug = { id: event.pointerId, x0: event.clientX, y0: event.clientY, weg: 0, aktiv: false, spur: [{ y: event.clientY, t: event.timeStamp }] };
  });
  overlay.addEventListener('pointermove', (event) => {
    if (!zug || event.pointerId !== zug.id) return;
    const dx = event.clientX - zug.x0;
    const dy = event.clientY - zug.y0;
    if (!zug.aktiv) {
      if (Math.abs(dy) < ZUG_START_PX || Math.abs(dy) < Math.abs(dx)) {
        if (Math.hypot(dx, dy) > 14) zug = null; // seitlich: kein Zug, aber auch kein Tipp mehr
        if (!zug) overlay.__gewischt = true;
        return;
      }
      zug.aktiv = true;
      overlay.__gewischt = true;
      try { overlay.setPointerCapture(event.pointerId); } catch { /* egal */ }
    }
    // Nach oben gibt es nur leisen Widerstand.
    zug.weg = dy > 0 ? dy : dy * 0.18;
    zug.spur.push({ y: event.clientY, t: event.timeStamp });
    if (zug.spur.length > 8) zug.spur.shift();
    malen(zug.weg);
  });
  const ende = (event) => {
    if (!zug || event.pointerId !== zug.id) return;
    const z = zug;
    zug = null;
    if (!z.aktiv) return;
    const letzte = z.spur[z.spur.length - 1];
    const fenster = z.spur.filter((p) => p.t >= letzte.t - 100);
    const v = fenster.length > 1 ? (letzte.y - fenster[0].y) / Math.max(1, letzte.t - fenster[0].t) : 0;
    overlay.dataset.wisch = JSON.stringify({ weg: Math.round(z.weg), v: Number(v.toFixed(3)) });
    if (event.type !== 'pointercancel' && v > -0.2 && (z.weg > WISCH_SCHWELLE || (v > 0.55 && z.weg > 36))) {
      rueckmeldung('schliessen');
      overlay.__schliessen('wisch');
    } else {
      federn();
    }
  };
  overlay.addEventListener('pointerup', ende);
  overlay.addEventListener('pointercancel', ende);
}

// --- Personenzeilen: Tipp auf das Profilbild -------------------------------------------------
// personRow (ui/components.js) ist EIN Knopf für die ganze Zeile. Eine zweite Trefferfläche darin
// wäre ein Knopf im Knopf; deshalb entscheidet hier die Stelle des Tipps: Wer auf das Profilbild
// (mindestens 44 px breit, die ganze Zeilenhöhe) tippt, bekommt das Bild groß — sonst gilt die Zeile.
//
// Gemessen: app.js bindet je Knoten und Ereignisart genau EINEN Zuhörer (bindeEinmalig) — ein zweiter
// Klick-Zuhörer an der Seitenwurzel kam dort nie an, der Tipp öffnete wie immer das Profil. Deshalb
// hängt EIN Zuhörer beim Laden am Fenster (Erfassungsphase, vor allen Seiten-Zuhörern); die Seiten
// melden bei jedem Binden nur, welche Zeilen in welcher Wurzel gelten.
const zeilenAnmeldungen = new Map(); // selektor → { root, ctx }

if (globalThis.window?.addEventListener) {
  window.addEventListener('click', (event) => {
    if (!zeilenAnmeldungen.size || !event.clientX) return; // Tastatur: die Zeile tut, was sie immer tut
    for (const [selektor, { root, ctx }] of zeilenAnmeldungen) {
      const zeile = event.target?.closest?.(selektor);
      if (!zeile || !root?.isConnected || !root.contains(zeile) || !zeile.dataset.person) continue;
      const avatar = zeile.querySelector('[data-role="person-avatar"]');
      if (!avatar) continue;
      const a = avatar.getBoundingClientRect();
      const z = zeile.getBoundingClientRect();
      const rechts = a.right + Math.max(4, (44 - a.width) / 2);
      if (event.clientX < z.left - 2 || event.clientX > rechts || event.clientY < z.top || event.clientY > z.bottom) continue;
      event.preventDefault();
      event.stopPropagation();
      bildGrossOeffnen(ctx, avatar, { art: 'person', id: zeile.dataset.person });
      return;
    }
  }, true);
}

export function bildGrossInZeilen(root, ctx, selektor) {
  if (!root || !selektor) return;
  zeilenAnmeldungen.set(selektor, { root, ctx });
}
