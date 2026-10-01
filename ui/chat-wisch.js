// Runde 11 (C1, Jonathan D3) — Schnellaktionen an den Zeilen der Chatliste (Crew-Tab).
//
// „Die Mitte gehört der Seite: Crew-Zeilen wischen = Schnellaktionen (Ausblenden, Löschen,
// Anpinnen)." Wie in jedem Messenger:
//   · nach RECHTS ziehen legt links „Anheften" frei (bzw. „Lösen", wenn der Chat schon oben steht),
//   · nach LINKS ziehen legt rechts „Ausblenden" und „Löschen" frei.
// Ein Tipp auf die freigelegte Aktion wirkt; ein Tipp daneben, Rollen oder ein neuer Zug schließt.
//
// Was die Aktionen WIRKLICH tun (Hausregel 9 — keine Aktion ohne Wirkung):
//   Anheften   settings.pinnedIds (gab es schon, profile.js crewMenu): der Chat steht in der Reihe
//              über der Suche. Für die besondere Person und beste Freunde gibt es das nicht — sie
//              stehen dort ohnehin, der Knopf wäre ohne Wirkung.
//   Ausblenden settings.chatAusgeblendet[id] = Zeit der letzten Aktivität: Die Zeile verschwindet aus
//              der Liste, bis dort etwas Neues passiert. Die Suche findet sie weiter.
//   Löschen    settings.chatGeleert[roomId] = Zeit der letzten Nachricht: Der Verlauf ist für MICH
//              leer (projections.js nachGeleert, beide Gateways), die anderen behalten alles. Dazu
//              ausgeblendet wie oben. Weil das nicht rückgängig zu machen ist, fragt ein zweiter Tipp
//              („Wirklich löschen?") — auf derselben Stelle, kein Blatt.
// Beide Einstellungen schreiben beide Gateways über updateSettings (Regel 3).
import { rueckmeldung } from '../core/html.js';
import { t } from '../core/sprache.js';
import { symbol } from './symbole.js';
import { waagrechtZiehen, klickSchlucken } from './gesten.js';
import { nachrichtenZeit } from '../data/projections.js';

const AKTION_BREITE = 76;
const DAUER = '.2s cubic-bezier(.22,.61,.36,1)';

// Steht der Chat gerade ausgeblendet? (Anzeige der Crew-Liste; getChats() liefert ihn unverändert.)
export function chatAusgeblendet(settings, eintrag) {
  const marke = settings?.chatAusgeblendet?.[eintrag?.id];
  if (marke === undefined || marke === null) return false;
  return (Number(eintrag?.zeit) || 0) <= Number(marke);
}

// Die eine offene Zeile (es ist immer höchstens eine offen).
let offen = null;

function grundfarbe(knoten) {
  for (let el = knoten; el && el.nodeType === 1; el = el.parentElement) {
    const farbe = getComputedStyle(el).backgroundColor;
    if (farbe && farbe !== 'transparent' && !/rgba\(0, 0, 0, 0\)/.test(farbe)) return farbe;
  }
  return 'var(--paper)';
}

function aktionenFuer(ctx, zeile) {
  const settings = ctx.repo.getSettings() || {};
  const id = zeile.dataset.id;
  const markiert = settings.specialPerson?.personId === id || (settings.bestFriendIds || []).includes(id);
  const angeheftet = (settings.pinnedIds || []).includes(id);
  return {
    links: markiert ? [] : [{ akt: 'anheften', wort: angeheftet ? t('Lösen') : t('Anheften'), zeichen: 'auf', farbe: 'var(--green)' }],
    rechts: [
      { akt: 'ausblenden', wort: t('Ausblenden'), zeichen: 'augeZu', farbe: 'var(--muted)' },
      { akt: 'loeschen', wort: t('Löschen'), zeichen: 'papierkorb', farbe: 'var(--danger)' },
    ],
  };
}

function knopfHtml(a) {
  return `<button type="button" data-zeilen-aktion="${a.akt}" data-role="zeile-${a.akt}" style="flex:none;width:${AKTION_BREITE}px;height:100%;border:0;margin:0;padding:0 4px;background:${a.farbe};color:var(--on-accent);display:flex;flex-direction:column;align-items:center;justify-content:center;gap:4px;cursor:pointer;appearance:none;font:650 12px/1.1 'Instrument Sans',sans-serif;transition:width ${DAUER}"><span style="pointer-events:none;display:flex">${symbol(a.zeichen, 'var(--on-accent)', 19)}</span><span data-wort style="pointer-events:none;white-space:nowrap">${a.wort}</span></button>`;
}

function ebeneBauen(zeile, aktionen) {
  const ebene = document.createElement('div');
  ebene.dataset.role = 'zeilen-aktionen';
  ebene.__morphFrei = true;   // core/html.js: der Abgleich lässt diese Laufzeit-Ebene stehen
  ebene.style.cssText = 'position:absolute;inset:0;z-index:0;display:flex;justify-content:space-between;overflow:hidden';
  ebene.innerHTML = `<div data-seite="links" style="display:flex;height:100%">${aktionen.links.map(knopfHtml).join('')}</div><div data-seite="rechts" style="display:flex;height:100%;margin-left:auto">${aktionen.rechts.map(knopfHtml).join('')}</div>`;
  zeile.appendChild(ebene);
  return ebene;
}

function setzen(z, versatz, weich) {
  z.versatz = versatz;
  const { knopf, ebene } = z;
  knopf.style.transition = weich ? `transform ${DAUER}` : 'none';
  knopf.style.transform = versatz ? `translateX(${versatz.toFixed(1)}px)` : '';
  knopf.style.position = 'relative';
  knopf.style.zIndex = '1';
  knopf.style.background = z.grund;
  // Nur die Seite, die gerade frei liegt, ist zu sehen — sonst schimmerte die andere am Rand durch.
  const links = ebene.querySelector('[data-seite="links"]');
  const rechts = ebene.querySelector('[data-seite="rechts"]');
  if (links) links.style.visibility = versatz > 0 ? 'visible' : 'hidden';
  if (rechts) rechts.style.visibility = versatz < 0 ? 'visible' : 'hidden';
}

function schliessen(weich = true) {
  const z = offen;
  offen = null;
  if (!z) return;
  if (!z.knopf.isConnected) { z.ebene.remove(); return; }
  setzen(z, 0, weich);
  globalThis.setTimeout(() => {
    if (offen === z) return;
    z.ebene.remove();
    z.knopf.style.transition = '';
    z.knopf.style.position = '';
    z.knopf.style.zIndex = '';
    z.knopf.style.background = '';
  }, weich ? 230 : 0);
}

function letzteNachrichtZeit(ctx, roomId) {
  const raum = roomId ? ctx.repo.getRoom?.(roomId) : null;
  return (raum?.messages || []).reduce((max, n) => Math.max(max, nachrichtenZeit(n)), 0);
}

function aktionAusfuehren(ctx, z, akt, knopf) {
  const { repo } = ctx;
  const id = z.zeile.dataset.id;
  const roomId = z.knopf.dataset.room || '';
  const settings = repo.getSettings() || {};
  const eintrag = (repo.getChats?.() || []).find((e) => e.id === id) || { id, zeit: 0 };
  if (akt === 'anheften') {
    const jetzt = [...(settings.pinnedIds || [])];
    const drin = jetzt.includes(id);
    schliessen(false);
    rueckmeldung('tipp');
    repo.updateSettings({ pinnedIds: drin ? jetzt.filter((e) => e !== id) : [...jetzt, id] });
    ctx.toast?.(drin ? t('Nicht mehr angeheftet') : t('Oben angeheftet'));
    ctx.render();
    return;
  }
  if (akt === 'ausblenden') {
    schliessen(false);
    rueckmeldung('tipp');
    repo.updateSettings({ chatAusgeblendet: { ...(settings.chatAusgeblendet || {}), [id]: Number(eintrag.zeit) || 0 } });
    ctx.toast?.(t('Ausgeblendet – kommt mit der nächsten Nachricht zurück'));
    ctx.render();
    return;
  }
  if (akt === 'loeschen') {
    // Erster Tipp: dieselbe Stelle fragt nach. Der rote Knopf nimmt die ganze Zeile ein.
    if (!z.bestaetigen) {
      z.bestaetigen = true;
      rueckmeldung('tipp');
      const breite = z.zeile.getBoundingClientRect().width;
      z.ebene.querySelectorAll('[data-seite="rechts"] [data-zeilen-aktion]').forEach((b) => { if (b !== knopf) b.style.display = 'none'; });
      knopf.style.width = `${Math.round(breite)}px`;
      const wort = knopf.querySelector('[data-wort]');
      if (wort) wort.textContent = t('Wirklich löschen?');
      knopf.dataset.role = 'zeile-loeschen-bestaetigen';
      setzen(z, -breite, true);
      return;
    }
    const grenze = letzteNachrichtZeit(ctx, roomId);
    schliessen(false);
    rueckmeldung('erfolg');
    const patch = { chatAusgeblendet: { ...(settings.chatAusgeblendet || {}), [id]: Math.max(Number(eintrag.zeit) || 0, grenze) } };
    if (roomId && grenze) patch.chatGeleert = { ...(settings.chatGeleert || {}), [roomId]: Math.max(Number(settings.chatGeleert?.[roomId]) || 0, grenze) };
    repo.updateSettings(patch);
    ctx.toast?.(t('Chat gelöscht – nur bei dir'));
    ctx.render();
  }
}

let dokumentGebunden = false;
function dokumentBinden() {
  if (dokumentGebunden || !globalThis.document) return;
  dokumentGebunden = true;
  // Ein Tipp neben die offenen Aktionen schließt die Zeile — und öffnet dabei NICHT den Chat.
  // Auf der offenen Zeile selbst darf der Finger sie auch weiterziehen; erst wenn er ohne Zug
  // abhebt, geht sie zu.
  document.addEventListener('pointerdown', (ereignis) => {
    if (!offen || offen.ebene.contains(ereignis.target)) return;
    if (offen.knopf.contains(ereignis.target)) {
      klickSchlucken(offen.knopf, 600);
      offen.tippSchliesst = true;
      return;
    }
    schliessen(true);
  }, true);
  document.addEventListener('pointerup', () => {
    if (offen?.tippSchliesst) schliessen(true);
  }, true);
  document.addEventListener('scroll', () => { if (offen) schliessen(true); }, { capture: true, passive: true });
}

// Bindet das Wischen an die Chatliste der Crew-Seite. Läuft bei jedem Render (billig): Eine offene
// Zeile, deren Knopf der Abgleich zurückgesetzt hat, steht danach wieder offen da.
export function chatZeilenWischBinden(seite, ctx) {
  const liste = seite?.querySelector('[data-role="chat-liste"]');
  if (offen) {
    if (!offen.zeile.isConnected || !offen.knopf.isConnected || !liste?.contains(offen.zeile)) { offen.ebene.remove(); offen = null; } else setzen(offen, offen.versatz, false);
  }
  if (!liste) return;
  dokumentBinden();
  waagrechtZiehen(liste, 'chatzeile', {
    beginnt(ziel) {
      const zeile = ziel.closest?.('[data-role="chat-zeile"]');
      const knopf = zeile?.querySelector(':scope > .r8a-knopf');
      if (!zeile || !knopf || !liste.contains(zeile)) return null;
      // Ein Zug auf einer ANDEREN Zeile schließt zuerst die offene (der pointerdown oben).
      if (offen && offen.zeile !== zeile) return null;
      return { zeile, knopf };
    },
    bewegt(d, dx) {
      let z = offen && offen.zeile === d.zeile ? offen : null;
      if (!z) {
        const aktionen = aktionenFuer(ctx, d.zeile);
        z = { zeile: d.zeile, knopf: d.knopf, aktionen, ebene: ebeneBauen(d.zeile, aktionen), grund: grundfarbe(d.zeile.parentElement), versatz: 0, bestaetigen: false };
        // Halten auf einer Aktion öffnet nicht das Menü der Zeile (crew.js › langes Drücken).
        z.ebene.addEventListener('pointerdown', (ereignis) => ereignis.stopPropagation());
        z.ebene.addEventListener('click', (ereignis) => {
          const knopf = ereignis.target.closest?.('[data-zeilen-aktion]');
          if (!knopf || offen !== z) return;
          ereignis.preventDefault();
          ereignis.stopPropagation();
          aktionAusfuehren(ctx, z, knopf.dataset.zeilenAktion, knopf);
        });
        offen = z;
      }
      z.tippSchliesst = false;
      if (d.basis === undefined) d.basis = z.versatz;
      const maxLinks = z.aktionen.links.length * AKTION_BREITE;
      const maxRechts = z.aktionen.rechts.length * AKTION_BREITE;
      let v = d.basis + dx;
      // Über das Ende hinaus zieht es nur noch zäh (und auf einer Seite ohne Aktion gar nicht weit).
      if (v > maxLinks) v = maxLinks + (v - maxLinks) * 0.25;
      if (v < -maxRechts) v = -maxRechts + (v + maxRechts) * 0.25;
      setzen(z, v, false);
    },
    endet(d, dx, schwung) {
      const z = offen && offen.zeile === d.zeile ? offen : null;
      if (!z) return;
      const maxLinks = z.aktionen.links.length * AKTION_BREITE;
      const maxRechts = z.aktionen.rechts.length * AKTION_BREITE;
      const v = z.versatz;
      let ziel = 0;
      if (v < 0 && maxRechts && (v < -maxRechts * 0.4 || schwung < -0.4)) ziel = -maxRechts;
      if (v > 0 && maxLinks && (v > maxLinks * 0.5 || schwung > 0.4)) ziel = maxLinks;
      if (!ziel) { schliessen(true); return; }
      rueckmeldung('tipp');
      setzen(z, ziel, true);
    },
    abbruch() { schliessen(true); },
  });
}
