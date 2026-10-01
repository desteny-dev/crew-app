// iPhone-Runde 1 (B3): Gemeinsame freie Zeit einer Gruppe — die Karte auf der Gruppenseite.
//
// Jonathan: „In einer Gruppe sieht man im Kalender auf einen Blick, wann alle oder fast alle Zeit
// haben. Leer heißt: Hier hat kaum jemand Zeit … Grün erscheint erst, wenn mindestens die Hälfte frei
// ist. Je mehr Mitglieder frei sind, desto kräftiger wird das Grün (#1B9E5F). Volles Grün heißt: Alle
// haben Zeit. Kein Rot und keine Flächen voller Farbe. Antippen eines grünen Bereichs zeigt ‚5 von 6
// frei · Lena fehlt' und den Knopf ‚Meet erstellen' für genau diese Zeit."
//
// Warum auf der GRUPPENSEITE (room.crewDetails): Dort steht schon alles, was eine Gruppe als Ganzes
// ausmacht (wer dabei ist, was geplant ist) — und auf der Seite einer Person steht an derselben Stelle
// der Kalender „Zusammen" (profile.js). Man erreicht sie mit EINEM Tipp auf den Namen im Gruppenchat.
// Ein Kalender im Chat selbst stünde jeder Nachricht im Weg; der Meet-Kalender kennt keine Gruppe.
//
// Die Karte hat dieselbe Bauform wie „Zusammen" (Spalten = die nächsten sieben Tage, Zeit von oben
// nach unten), zeigt aber nur 8–24 Uhr: nachts trägt niemand „schlafen" ein, die Nacht wäre sonst
// immer „alle frei". Gerechnet wird NICHTS hier — alles kommt aus repo.getGruppenZeit (Regel:
// data/gruppen-zeit.js). Hier steht nur, wie Stufe → Deckkraft und Bereich → Satz werden.

import { esc } from '../core/html.js';
import { t, tk } from '../core/sprache.js';
import { tagKurz } from '../core/belegt.js';
import { fromISODate, weekdayLong, tagUndMonat } from '../core/dates.js';
import { sheet, personAvatar } from './components.js';
import { ME } from '../data/ids.js';

const FONT = "'Instrument Sans',sans-serif";
const STUNDE_PX = 15;
const KOPF_PX = 11;
const KOPF_ABSTAND = 6;
const MARKEN = [8, 12, 16, 20, 24];
// Zarte Stufen: die Hälfte frei = kaum getönt, alle frei = kräftig — nie eine volle Fläche.
const DECKKRAFT_HALB = 0.12;
const DECKKRAFT_ALLE = 0.5;
// Tippt der Daumen neben einen Bereich (eine Stunde sind 15 px), gilt der nächste bis 60 min daneben.
const NAEHE_MIN = 60;

export function deckkraft(stufe) {
  const s = Math.max(0, Math.min(1, Number(stufe) || 0));
  return Math.round((DECKKRAFT_HALB + s * (DECKKRAFT_ALLE - DECKKRAFT_HALB)) * 100) / 100;
}

function gruen(alpha) {
  const prozent = Math.round(alpha * 100);
  return `background:rgba(27,158,95,${alpha});background:color-mix(in srgb, var(--green) ${prozent}%, transparent)`;
}

const zeit = (min) => `${String(Math.floor((min % 1440) / 60)).padStart(2, '0')}:${String(min % 60).padStart(2, '0')}`;
const spanne = (b) => `${zeit(b.vonMin)}–${zeit(b.bisMin)}`;

function name(ctx, id) {
  return ctx.repo.getPerson?.(id)?.name || t('Jemand');
}

// „3 von 4 frei" · „Alle 4 frei"
export function freiZahl(bereich) {
  if (bereich.frei >= bereich.gesamt) return t('Alle {n} frei', { n: bereich.gesamt });
  return t('{frei} von {gesamt} frei', { frei: bereich.frei, gesamt: bereich.gesamt });
}

// Wer fehlt — nur WER, nie warum. „Tobi fehlt" · „Lena und Tobi fehlen" · „Du fehlst" · „Tobi und du fehlen"
export function fehltSatz(ctx, fehlend) {
  const andere = (fehlend || []).filter((id) => id !== ME).map((id) => name(ctx, id));
  const ich = (fehlend || []).includes(ME);
  if (!andere.length && !ich) return '';
  if (ich) {
    if (!andere.length) return t('Du fehlst');
    return t('{liste} und du fehlen', { liste: andere.join(', ') });
  }
  if (andere.length === 1) return t('{a} fehlt', { a: andere[0] });
  return t('{liste} und {b} fehlen', { liste: andere.slice(0, -1).join(', '), b: andere[andere.length - 1] });
}

export function bereichSatz(ctx, bereich) {
  const fehlt = fehltSatz(ctx, bereich.fehlend);
  return fehlt ? `${freiZahl(bereich)} · ${fehlt}` : freiZahl(bereich);
}

function lesen(ctx, crewId) {
  try { return ctx.repo.getGruppenZeit?.(crewId) || null; } catch { return null; }
}

function gewaehlt(ctx, crewId) {
  const wahl = ctx.ui?.gruppenZeitWahl;
  return wahl && wahl.crewId === crewId ? wahl : null;
}

// Den gewählten Bereich im aktuellen Stand wiederfinden (die Daten können sich inzwischen bewegt haben).
function bereichZu(stand, wahl) {
  const tag = stand?.tage?.find((eintrag) => eintrag.iso === wahl?.iso);
  if (!tag) return null;
  return tag.bereiche.find((b) => b.vonMin === wahl.vonMin && b.bisMin === wahl.bisMin)
    || tag.bereiche.find((b) => b.vonMin < wahl.bisMin && b.bisMin > wahl.vonMin)
    || null;
}

function blockHtml(ctx, stand, eintrag, bereich, wahl) {
  const hoehe = (stand.bisMin - stand.vonMin);
  const oben = ((bereich.vonMin - stand.vonMin) / hoehe) * 100;
  const hoch = ((bereich.bisMin - bereich.vonMin) / hoehe) * 100;
  const an = wahl && wahl.iso === eintrag.iso && wahl.vonMin === bereich.vonMin && wahl.bisMin === bereich.bisMin;
  const label = `${weekdayLong(eintrag.iso)} ${spanne(bereich)}, ${bereichSatz(ctx, bereich)}`;
  return `<button data-act="gz-bereich" data-role="gz-bereich" data-iso="${eintrag.iso}" data-von="${bereich.vonMin}" data-bis="${bereich.bisMin}" data-frei="${bereich.frei}" data-gesamt="${bereich.gesamt}" data-stufe="${bereich.stufe}" aria-label="${esc(label)}" aria-pressed="${an ? 'true' : 'false'}" style="position:absolute;left:0;right:0;top:${oben.toFixed(3)}%;height:${hoch.toFixed(3)}%;margin:0;padding:0;border:0;appearance:none;cursor:pointer;border-radius:5px;${gruen(deckkraft(bereich.stufe))};box-shadow:0 0 0 1px var(--field)${an ? ',inset 0 0 0 2px var(--green)' : ''};touch-action:manipulation;-webkit-tap-highlight-color:transparent"></button>`;
}

function kalenderHtml(ctx, stand, wahl) {
  const hoehe = ((stand.bisMin - stand.vonMin) / 60) * STUNDE_PX;
  const heute = stand.tage[0]?.iso;
  const achse = `<div aria-hidden="true" style="position:relative;flex:none;width:17px;margin-top:${KOPF_PX + KOPF_ABSTAND}px;height:${hoehe}px">${MARKEN.map((stunde) => `<span style="position:absolute;right:1px;top:${(((stunde * 60 - stand.vonMin) / (stand.bisMin - stand.vonMin)) * 100).toFixed(2)}%;transform:translateY(-50%);font:600 9.5px/1 ${FONT};color:var(--muted-light);font-variant-numeric:tabular-nums;pointer-events:none">${stunde}</span>`).join('')}</div>`;
  const linien = MARKEN.slice(1, -1).map((stunde) => `<span aria-hidden="true" style="position:absolute;left:0;right:0;top:${(((stunde * 60 - stand.vonMin) / (stand.bisMin - stand.vonMin)) * 100).toFixed(2)}%;height:1px;background:var(--ink-a08);pointer-events:none"></span>`).join('');
  const spalten = stand.tage.map((eintrag) => {
    const istHeute = eintrag.iso === heute;
    const bloecke = eintrag.bereiche.map((bereich) => blockHtml(ctx, stand, eintrag, bereich, wahl)).join('');
    return `<div data-role="gz-tag" data-iso="${eintrag.iso}" data-bereiche="${eintrag.bereiche.length}" style="flex:1 1 0;min-width:0">
<span style="display:block;height:${KOPF_PX}px;font:${istHeute ? 750 : 650} 10.5px/${KOPF_PX}px ${FONT};color:${istHeute ? 'var(--ink)' : 'var(--muted-light)'};text-align:center;pointer-events:none">${esc(tagKurz(eintrag.tag))}</span>
<div data-act="gz-spalte" data-role="gz-spalte" data-iso="${eintrag.iso}" style="position:relative;display:block;height:${hoehe}px;margin-top:${KOPF_ABSTAND}px;border-radius:7px;background:var(--field);overflow:hidden;cursor:pointer;-webkit-tap-highlight-color:transparent">${linien}${bloecke}</div>
</div>`;
  }).join('');
  return `<div data-role="gz-kalender" style="display:flex;gap:3px;align-items:flex-start;padding-bottom:6px">${achse}${spalten}</div>`;
}

// Die Karte. Ohne Gruppe oder mit nur einer Person gibt es nichts Gemeinsames — dann steht sie nicht da.
export function gruppenZeitKarte(ctx, crew) {
  if (!crew?.id) return '';
  const stand = lesen(ctx, crew.id);
  if (!stand || !stand.ok || !stand.tage?.length) return '';
  if (stand.geladen && stand.gesamt < 2) return '';
  const wahl = gewaehlt(ctx, crew.id);
  // Das Muster liegt auf demselben Grund wie der Kalender — sonst sähe „Hälfte" hier anders aus als dort.
  const muster = (alpha) => `<span aria-hidden="true" style="display:inline-block;width:12px;height:12px;border-radius:3px;background:var(--field);overflow:hidden"><span style="display:block;width:100%;height:100%;${gruen(alpha)}"></span></span>`;
  const legende = `<span data-role="gz-legende" style="display:flex;align-items:center;gap:5px;font:600 11px/1 ${FONT};color:var(--muted);flex:none">${muster(DECKKRAFT_HALB)}<span>${esc(t('Hälfte'))}</span><span style="width:4px"></span>${muster(DECKKRAFT_ALLE)}<span>${esc(tk('alle', 'Gruppe frei'))}</span></span>`;
  return `<div data-role="gruppen-zeit" data-crew="${esc(crew.id)}" data-geladen="${stand.geladen ? 'true' : 'false'}" style="flex:none;background:var(--surface);border-radius:20px;border:1px solid var(--ink-a07);padding:2px 16px 6px">
<div style="display:flex;align-items:center;gap:8px;padding:8px 0 6px;min-height:30px;box-sizing:border-box"><span data-role="gz-titel" style="font-size:11px;font-weight:650;letter-spacing:.09em;text-transform:uppercase;color:var(--muted-light);flex:1;min-width:0">${esc(t('Gemeinsam frei'))}</span>${legende}</div>
<div style="padding-top:8px;border-top:1px solid var(--ink-a05);${stand.geladen ? '' : 'opacity:.5;'}transition:opacity .2s">${kalenderHtml(ctx, stand, wahl)}</div>
</div>`;
}

// Das Blatt zum angetippten Bereich: wann, wie viele, wer fehlt — und „Meet erstellen" für genau diese Zeit.
export function gruppenZeitBlatt(ctx, crew) {
  const wahl = gewaehlt(ctx, crew?.id);
  if (!wahl) return '';
  const bereich = bereichZu(lesen(ctx, crew.id), wahl);
  if (!bereich) return '';
  const alle = [ME, ...(crew.memberIds || []).filter((id) => id !== ME)];
  const person = (id) => (id === ME ? ctx.repo.getMe?.() : ctx.repo.getPerson?.(id));
  const fehlt = new Set(bereich.fehlend);
  const gesichter = alle.filter((id) => person(id)).map((id) => `<span data-role="gz-gesicht" data-person="${esc(id)}" data-fehlt="${fehlt.has(id) ? '1' : '0'}" style="display:flex;flex:none;${fehlt.has(id) ? 'opacity:.32;filter:grayscale(1)' : ''}">${personAvatar(person(id), { size: 30, compact: true, free: false })}</span>`).join('');
  const datum = `${weekdayLong(wahl.iso)}, ${tagUndMonat(fromISODate(wahl.iso))}`;
  const inhalt = `<div data-role="gz-blatt" style="display:flex;flex-direction:column;gap:12px;font-family:${FONT}">
<div style="display:flex;flex-direction:column;gap:3px;padding:0 2px"><span style="font-family:'Bricolage Grotesque',sans-serif;font-size:19px;font-weight:650">${esc(datum)}</span><span data-role="gz-zeit" style="font-size:13px;color:var(--ink-soft);font-variant-numeric:tabular-nums">${esc(spanne(bereich))}</span></div>
<div style="display:flex;align-items:center;gap:10px;padding:0 2px"><span aria-hidden="true" style="width:14px;height:14px;border-radius:4px;flex:none;background:var(--field);overflow:hidden"><span style="display:block;width:100%;height:100%;${gruen(deckkraft(bereich.stufe))}"></span></span><span data-role="gz-satz" style="font-size:15.5px;font-weight:650;color:var(--ink);line-height:1.3">${esc(bereichSatz(ctx, bereich))}</span></div>
<div data-role="gz-gesichter" style="display:flex;flex-wrap:wrap;gap:6px;padding:0 2px 4px">${gesichter}</div>
<button data-act="gz-meet" data-role="gz-meet" style="border:0;appearance:none;cursor:pointer;background:var(--green);color:var(--on-accent);font:650 15px/1 ${FONT};height:52px;border-radius:26px;display:flex;align-items:center;justify-content:center"><span style="pointer-events:none">${esc(t('Meet erstellen'))}</span></button>
</div>`;
  return sheet(inhalt, { closeAct: 'gz-zu', scrollKey: 'gz-blatt' });
}

// Die Handlungen (für bindActions der Gruppenseite).
export function gruppenZeitAktionen(ctx, crew) {
  const oeffnen = (iso, bereich) => {
    ctx.ui.gruppenZeitWahl = { crewId: crew.id, iso, vonMin: bereich.vonMin, bisMin: bereich.bisMin, seit: Date.now() };
    ctx.render();
  };
  return {
    'gz-bereich': (data) => {
      const stand = lesen(ctx, crew.id);
      const bereich = bereichZu(stand, { iso: data.iso, vonMin: Number(data.von), bisMin: Number(data.bis) });
      if (bereich) oeffnen(data.iso, bereich);
    },
    // Ein Tipp neben einen Bereich: der nächste in dieser Spalte, wenn er nah genug liegt.
    'gz-spalte': (data, el, event) => {
      const stand = lesen(ctx, crew.id);
      const tag = stand?.tage?.find((eintrag) => eintrag.iso === data.iso);
      if (!tag?.bereiche.length || !event) return;
      const r = el.getBoundingClientRect();
      const minute = stand.vonMin + ((event.clientY - r.top) / (r.height || 1)) * (stand.bisMin - stand.vonMin);
      let treffer = null;
      let abstand = Infinity;
      for (const b of tag.bereiche) {
        const weg = minute < b.vonMin ? b.vonMin - minute : (minute > b.bisMin ? minute - b.bisMin : 0);
        if (weg < abstand) { abstand = weg; treffer = b; }
      }
      if (treffer && abstand <= NAEHE_MIN) oeffnen(tag.iso, treffer);
    },
    'gz-zu': () => {
      if (Date.now() - (ctx.ui.gruppenZeitWahl?.seit || 0) < 350) return;
      ctx.ui.gruppenZeitWahl = null;
      ctx.render();
    },
    // Derselbe Weg wie „Meet erstellen" im Meet-Kalender (meet-browser.js mb-zeit-meet): ein Entwurf mit
    // der Gruppe, darin Tag, Beginn und Ende dieses Bereichs — dann die Erstellung.
    'gz-meet': () => {
      const wahl = gewaehlt(ctx, crew.id);
      const bereich = bereichZu(lesen(ctx, crew.id), wahl);
      ctx.ui.gruppenZeitWahl = null;
      if (!bereich) { ctx.render(); return; }
      const draft = ctx.repo.createDraft({ withCrewId: crew.id });
      ctx.repo.updateDraft(draft.id, { when: { date: wahl.iso, time: zeit(bereich.vonMin), endTime: zeit(bereich.bisMin), open: false } });
      ctx.nav.go('newMeet.discover', { draftId: draft.id });
    },
  };
}
