// Runde 4 (B7) — Zeichen aussuchen, nach Kategorien.
//
// Jonathan: „Die ganzen Icons würde ich kategorisieren. Das wär sehr wichtig."
//
// Bauform wie die Emoji-Tastatur am Handy: oben eine waagrecht wischbare Leiste mit den
// Kategorien, darunter ALLE Zeichen in Abschnitten. Ein Tipp auf eine Kategorie gleitet zu ihrem
// Abschnitt; beim Scrollen wandert die Markierung in der Leiste mit. Nichts wird ein- oder
// ausgeblendet — deshalb springt beim Wechsel nichts, und jedes Zeichen bleibt auffindbar.
//
// Schnittstelle (für jede Auswahl in der App — Ressourcen, Meet-, Gruppen-Zeichen …):
//   zeichenAuswahlHtml({ act, gewaehlt, worte, ohne, stickyTop })  → Markup
//   zeichenAuswahlBinden(root)                                      → Leiste + Mitlaufen (einmal je Knoten)
//   ZEICHEN_KATEGORIEN · zeichenKategorieVon(key) · zeichenWort(key)
// Jede Zeichen-Kachel trägt data-act=<act> und data-key=<Symbolname aus ui/symbole.js>.

import { esc } from '../core/html.js';
import { t } from '../core/sprache.js';
import { SYMBOLE, symbol } from './symbole.js';
import { RESSOURCEN_WORTE, ART_WORTE } from './activity-icons.js';
import { haptik } from './haptik.js';

// Ein Zeichen darf in zwei Kategorien stehen, wenn man es an beiden Stellen sucht (Fahrrad bei
// Sport und bei Fahrzeugen). Seine „eigene" Kategorie ist die erste.
export const ZEICHEN_KATEGORIEN = [
  { key: 'sport', name: t('Sport'), zeichen: ['hantel', 'yoga', 'fussball', 'volleyball', 'tischtennis', 'rad', 'wandern', 'berg', 'schwimmen'] },
  { key: 'wasser', name: t('Wasser & Schnee'), zeichen: ['wellen', 'pool', 'surfbrett', 'kanu', 'boot', 'schnee', 'ski', 'snowboard', 'schlitten'] },
  { key: 'draussen', name: t('Draußen'), zeichen: ['sonne', 'zelt', 'pavillon', 'sonnenschirm', 'campingstuhl', 'haengematte', 'schlafsack', 'rucksack', 'fernglas', 'picknickkorb'] },
  { key: 'essen', name: t('Essen & Trinken'), zeichen: ['gabel', 'pizza', 'grill', 'raclette', 'tasse', 'glas', 'kuehlbox', 'thermoskanne'] },
  { key: 'ausgehen', name: t('Ausgehen'), zeichen: ['feiern', 'ticket', 'film', 'museum', 'tasche', 'buch'] },
  { key: 'spiele', name: t('Spiele'), zeichen: ['wuerfel', 'karten', 'gamepad', 'vrbrille', 'dart'] },
  { key: 'musik', name: t('Musik'), zeichen: ['note', 'gitarre', 'klavier', 'mikrofon', 'lautsprecher', 'kopfhoerer', 'plattenspieler'] },
  { key: 'technik', name: t('Technik'), zeichen: ['laptop', 'pc', 'monitor', 'tablet', 'drucker', 'beamer', 'leinwand', 'kamera', 'drohne', 'stativ'] },
  { key: 'fahrzeuge', name: t('Fahrzeuge'), zeichen: ['auto', 'motorrad', 'rad', 'anhaenger', 'bollerwagen', 'boot', 'flugzeug'] },
  { key: 'werkzeug', name: t('Werkzeug & Garten'), zeichen: ['werkzeug', 'bohrmaschine', 'leiter', 'rasenmaeher', 'schubkarre'] },
  { key: 'alltag', name: t('Zuhause & Alltag'), zeichen: ['haus', 'sofa', 'koffer', 'uhr', 'funkeln', 'anhaengerNeutral'] },
].map((kat) => ({ ...kat, zeichen: kat.zeichen.filter((key) => SYMBOLE[key]) }));

// Worte unter den Zeichen, wo die Ressourcen- und Aktivitätsworte nicht passen: Hier heißt ein
// Zeichen nach dem, was es zeigt („Fußball"), nicht nach einer Art von Unternehmung („Ballsport").
const ZEICHEN_WORTE = {
  wellen: t('Wellen'), schwimmen: t('Schwimmen'), wandern: t('Wandern'), berg: t('Berg'), schnee: t('Schnee'),
  hantel: t('Fitness'), yoga: t('Yoga'), fussball: t('Fußball'), volleyball: t('Volleyball'), sonne: t('Sonne'),
  gabel: t('Essen'), pizza: t('Pizza'), tasse: t('Kaffee'), glas: t('Getränke'), feiern: t('Party'),
  sofa: t('Sofa'), haus: t('Zuhause'), buch: t('Buch'), film: t('Film'), note: t('Musik'), ticket: t('Tickets'),
  museum: t('Museum'), tasche: t('Shopping'), uhr: t('Uhr'), funkeln: t('Anderes'), flugzeug: t('Flugzeug'),
};

export function zeichenWort(key, worte = null) {
  return worte?.[key] || ZEICHEN_WORTE[key] || RESSOURCEN_WORTE[key] || ART_WORTE[key] || key;
}

export function zeichenKategorieVon(key) {
  return ZEICHEN_KATEGORIEN.find((kat) => kat.zeichen.includes(key))?.key || null;
}

const FONT = "'Instrument Sans',sans-serif";

function chip(kat, an) {
  // 44 px hoch (Trefferfläche), die sichtbare Pille ist 34 px.
  return `<button type="button" data-zeichen-kat="${esc(kat.key)}" aria-pressed="${an}" style="height:44px;padding:0;border:0;background:transparent;cursor:pointer;appearance:none;flex:none;font-family:${FONT}">
<span data-role="zeichen-kat-pille" style="display:flex;align-items:center;gap:6px;height:34px;padding:0 12px 0 10px;border-radius:999px;box-sizing:border-box;border:1.5px solid ${an ? 'var(--green-a50)' : 'var(--ink-a09)'};background:${an ? 'var(--green-tint)' : 'var(--surface)'};color:${an ? 'var(--green-dark)' : 'var(--ink-soft)'};pointer-events:none;transition:background .16s ease-out,border-color .16s ease-out,color .16s ease-out">
${symbol(kat.zeichen[0], 'currentColor', 16)}<span style="font-size:12.5px;font-weight:650;white-space:nowrap">${esc(kat.name)}</span></span></button>`;
}

function kachel(act, key, an, worte) {
  return `<button data-act="${esc(act)}" data-key="${esc(key)}" aria-pressed="${an}" style="display:flex;flex-direction:column;align-items:center;gap:5px;min-height:70px;padding:11px 3px 9px;border-radius:15px;border:1.5px solid ${an ? 'var(--green-a50)' : 'var(--ink-a07)'};background:${an ? 'var(--green-tint)' : 'var(--surface)'};cursor:pointer;appearance:none;font-family:${FONT};box-sizing:border-box;min-width:0">
<span style="pointer-events:none;display:flex">${symbol(key, an ? 'var(--green-dark)' : 'var(--ink-soft)', 23)}</span>
<span style="font-size:10px;font-weight:600;line-height:1.2;text-align:center;color:${an ? 'var(--green-dark)' : 'var(--muted)'};width:100%;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;pointer-events:none">${esc(zeichenWort(key, worte))}</span></button>`;
}

// optionen:
//   act        data-act jeder Zeichen-Kachel (Pflicht)
//   gewaehlt   Symbolname mit Auswahlrahmen (oder null)
//   worte      eigene Worte je Symbol (z. B. RESSOURCEN_WORTE), sonst zeichenWort
//   ohne       Symbolnamen, die hier nicht angeboten werden
//   stickyTop  Lage der Kategorien-Leiste beim Scrollen (Standard -14: bündig im Sheet von
//              components.js › sheet, dessen Karte oben 14 px Innenabstand hat)
//   rand       seitlicher Innenabstand des Sheets (Standard 20) — die Leiste läuft bis an den Rand
export function zeichenAuswahlHtml({ act, gewaehlt = null, worte = null, ohne = [], stickyTop = -14, rand = 20 } = {}) {
  const kategorien = ZEICHEN_KATEGORIEN
    .map((kat) => ({ ...kat, zeichen: kat.zeichen.filter((key) => !ohne.includes(key)) }))
    .filter((kat) => kat.zeichen.length);
  const aktiv = (gewaehlt && kategorien.find((kat) => kat.zeichen.includes(gewaehlt))?.key) || kategorien[0]?.key;
  const leiste = `<div data-role="zeichen-kats" style="position:sticky;top:${stickyTop}px;z-index:3;margin:0 -${rand}px;padding:2px 0 4px;background:var(--surface);box-shadow:0 1px 0 var(--ink-a06)">
<div data-hdrag="row" data-role="zeichen-kats-reihe" style="display:flex;gap:6px;overflow-x:auto;scrollbar-width:none;padding:0 ${rand}px;scroll-padding:0 ${rand}px">${kategorien.map((kat) => chip(kat, kat.key === aktiv)).join('')}</div></div>`;
  const abschnitte = kategorien.map((kat) => `<section data-zeichen-abschnitt="${esc(kat.key)}" aria-label="${esc(kat.name)}" style="padding-top:14px">
<span style="display:block;font-size:11px;font-weight:650;letter-spacing:.09em;text-transform:uppercase;color:var(--muted-light);padding:0 2px 8px">${esc(kat.name)}</span>
<div style="display:grid;grid-template-columns:repeat(4,minmax(0,1fr));gap:8px">${kat.zeichen.map((key) => kachel(act, key, key === gewaehlt, worte)).join('')}</div></section>`).join('');
  return `<div data-role="zeichen-auswahl" data-aktiv="${esc(aktiv || '')}">${leiste}${abschnitte}</div>`;
}

function scrollFlaeche(knoten) {
  for (let n = knoten.parentElement; n; n = n.parentElement) {
    const stil = getComputedStyle(n);
    if (/(auto|scroll)/.test(stil.overflowY) && n.scrollHeight > n.clientHeight + 1) return n;
  }
  return null;
}

function leisteMalen(box, key) {
  if (box.dataset.aktiv === key) return;
  box.dataset.aktiv = key;
  box.querySelectorAll('[data-zeichen-kat]').forEach((knopf) => {
    const an = knopf.dataset.zeichenKat === key;
    knopf.setAttribute('aria-pressed', String(an));
    const pille = knopf.firstElementChild;
    if (!pille) return;
    pille.style.borderColor = an ? 'var(--green-a50)' : 'var(--ink-a09)';
    pille.style.background = an ? 'var(--green-tint)' : 'var(--surface)';
    pille.style.color = an ? 'var(--green-dark)' : 'var(--ink-soft)';
    if (an) {
      // Die aktive Pille bleibt in der Leiste sichtbar — nur waagrecht, die Seite bleibt stehen.
      const reihe = knopf.parentElement;
      const links = knopf.offsetLeft - 20;
      const rechts = knopf.offsetLeft + knopf.offsetWidth + 20 - reihe.clientWidth;
      if (reihe.scrollLeft > links) reihe.scrollTo({ left: Math.max(0, links), behavior: 'smooth' });
      else if (reihe.scrollLeft < rechts) reihe.scrollTo({ left: rechts, behavior: 'smooth' });
    }
  });
}

// Einmal je Auswahl-Knoten: Tipp auf eine Kategorie gleitet zu ihrem Abschnitt, beim Scrollen
// läuft die Markierung mit. Beim ersten Binden steht die Auswahl, falls vorhanden, im Blick.
export function zeichenAuswahlBinden(root) {
  root.querySelectorAll('[data-role="zeichen-auswahl"]').forEach((box) => {
    if (box.__zeichenGebunden) return;
    box.__zeichenGebunden = true;
    const flaeche = scrollFlaeche(box);
    const leiste = box.querySelector('[data-role="zeichen-kats"]');
    // Wo die Leiste steht, wenn sie klebt: Oberkante der Scrollfläche + Innenabstand + ihr `top`.
    // (Vor dem Scrollen steht sie noch weiter unten — daran darf sich das Ziel nicht messen.)
    const unterKlebenderLeiste = () => {
      if (!leiste || !flaeche) return 0;
      const stil = getComputedStyle(flaeche);
      return flaeche.getBoundingClientRect().top + flaeche.clientTop + parseFloat(stil.paddingTop || 0)
        + parseFloat(getComputedStyle(leiste).top || 0) + leiste.offsetHeight;
    };
    const unterLeiste = () => (leiste ? leiste.getBoundingClientRect().bottom : 0);

    const zuAbschnitt = (key, sanft = true) => {
      const abschnitt = box.querySelector(`[data-zeichen-abschnitt="${key}"]`);
      if (!abschnitt || !flaeche) return;
      const ziel = flaeche.scrollTop + abschnitt.getBoundingClientRect().top - unterKlebenderLeiste();
      flaeche.scrollTo({ top: Math.max(0, Math.min(ziel, flaeche.scrollHeight - flaeche.clientHeight)), behavior: sanft ? 'smooth' : 'auto' });
    };

    box.addEventListener('click', (event) => {
      const knopf = event.target.closest('[data-zeichen-kat]');
      if (!knopf || !box.contains(knopf)) return;
      event.preventDefault();
      haptik('tipp');
      box.__zeichenZiel = knopf.dataset.zeichenKat;
      leisteMalen(box, knopf.dataset.zeichenKat);
      zuAbschnitt(knopf.dataset.zeichenKat);
      clearTimeout(box.__zeichenUhr);
      box.__zeichenUhr = setTimeout(() => { box.__zeichenZiel = null; }, 700);
    });

    if (!flaeche) return;
    flaeche.__zeichenBox = box;
    if (!flaeche.__zeichenMitlauf) {
      flaeche.__zeichenMitlauf = true;
      flaeche.addEventListener('scroll', () => {
        const aktuell = flaeche.__zeichenBox;
        if (!aktuell || !aktuell.isConnected || aktuell.__zeichenZiel) return;
        const grenze = (aktuell.querySelector('[data-role="zeichen-kats"]')?.getBoundingClientRect().bottom || 0) + 24;
        let key = null;
        aktuell.querySelectorAll('[data-zeichen-abschnitt]').forEach((abschnitt) => {
          if (abschnitt.getBoundingClientRect().top <= grenze) key = abschnitt.dataset.zeichenAbschnitt;
        });
        // Ganz unten gehört die Markierung dem letzten Abschnitt, auch wenn er kurz ist.
        if (flaeche.scrollTop + flaeche.clientHeight >= flaeche.scrollHeight - 2) {
          const alle = aktuell.querySelectorAll('[data-zeichen-abschnitt]');
          key = alle[alle.length - 1]?.dataset.zeichenAbschnitt || key;
        }
        leisteMalen(aktuell, key || aktuell.querySelector('[data-zeichen-abschnitt]')?.dataset.zeichenAbschnitt);
      }, { passive: true });
    }

    // Beim Öffnen: Ist schon ein Zeichen gewählt und liegt es außer Sicht, steht sein Abschnitt oben.
    const gewaehlt = box.querySelector('[aria-pressed="true"][data-key]');
    if (gewaehlt) {
      const r = gewaehlt.getBoundingClientRect();
      const f = flaeche.getBoundingClientRect();
      if (r.bottom > f.bottom || r.top < unterLeiste()) zuAbschnitt(box.dataset.aktiv, false);
    }
  });
}
