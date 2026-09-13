// Runde 5 (P5, G1/G2) — Mitteilungen am Handy wirklich einschalten, und hören, was ankommt.
//
// Jonathan: „Wenn möglich mach Benachrichtigung in die Web-App, dass man sie am Handy bekommt,
// und mach Vibrationen und eventuell Sounds." Gemessen (Chef): Web-Push war gebaut, aber im echten
// Projekt gab es 0 Push-Abos — der Schalter lag tief im Profil, und auf dem iPhone ist Push nur
// möglich, wenn Crew auf dem Home-Bildschirm liegt. Diese Datei macht den Weg sichtbar:
//
//   mitteilungsKarte(ctx)            ruhige Karte oben im Crew-Tab, solange Mitteilungen aus sind
//   mitteilungsKarteAktionen(ctx)    ihre Handler ('push-karte-an', 'push-karte-weg')
//   pushSeitenKarte(ctx, { schalter })  die Karte in Profil → Mitteilungen (alle Zustände)
//   pushSeitenAktionen(ctx)          'push-toggle', 'push-probe'
//   homescreenAnleitung({ gross })   iPhone: Teilen → Zum Home-Bildschirm → Öffnen, als Bildzeichen
//   pushLage(repo) / pushLageAuffrischen(ctx)   Zustand dieses Geräts (sofort / nach Rückfrage)
//   mitteilungenBeobachten(ctx)      Ton + Vibration, wenn in der OFFENEN App etwas ankommt
//   freiHinweisVon(settings, person) die Empfangsregel „Frei-Hinweise von Freunden"
//
// Zustände (pushLage): 'an' · 'bereit' (aus) · 'abgelehnt' (vom System blockiert) · 'homescreen'
// (iPhone, nicht installiert) · 'unmoeglich' (dieses Gerät kann es nicht) · 'konto' (Demo, kein
// Server) · 'laeuft' (Erlaubnis wird eingeholt) · 'fehler' (Einschalten scheiterte).

import { esc, rueckmeldung } from '../core/html.js';
import { t as tx } from '../core/sprache.js';
import { ME, roomIdForCrew, roomIdForPerson } from '../data/ids.js';
import { pushZustand, pushZustandSofort, pushAnschalten, pushAusschalten, pushProbe, istApple } from '../data/push.js';
import { ton, toeneAn, tonFreischalten } from './ton.js';
import { symbol } from './symbole.js';

const FONT = "'Instrument Sans',sans-serif";
const SPEICHER_LAGE = 'crew.push.lage';
const SPEICHER_KARTE = 'crew.push.karte';
// Wegtippen merkt sich die App: erst zwei Wochen Ruhe, dann zwei Monate, danach nie wieder.
// Die Mitteilungsseite im Profil bleibt der dauerhafte Ort.
const KARTE_PAUSE_TAGE = [14, 60];

function lesen(schluessel) {
  try { return JSON.parse(globalThis.localStorage?.getItem(schluessel) || 'null'); } catch { return null; }
}

function schreiben(schluessel, wert) {
  try { globalThis.localStorage?.setItem(schluessel, JSON.stringify(wert)); } catch { /* privates Fenster */ }
}

// --- Zustand dieses Geräts -----------------------------------------------------------------

const lage = { wert: null, laeuft: false, ausKarte: false, render: null, sichtbarLauscher: false };

// Sofort, ohne Rückfrage — damit der erste Render schon stimmt und nichts nachträglich aufspringt.
// Ist die Erlaubnis erteilt, gilt bis zur Antwort des Browsers das, was zuletzt galt.
export function pushLage(repo) {
  if (!repo?.client) return 'konto';
  if (lage.wert) return lage.wert;
  const sofort = pushZustandSofort();
  if (sofort === 'erlaubt') return lesen(SPEICHER_LAGE) === 'bereit' ? 'bereit' : 'an';
  return sofort;
}

// Einmal je Start beim Browser nachfragen; und wieder, wenn die App zurück in den Vordergrund
// kommt — wer in den iPhone-Einstellungen Mitteilungen erlaubt hat, sieht es dann sofort.
export function pushLageAuffrischen(ctx) {
  const repo = ctx?.repo;
  if (!repo?.client) return;
  lage.render = () => ctx.render?.();
  if (!lage.sichtbarLauscher && globalThis.document?.addEventListener) {
    lage.sichtbarLauscher = true;
    globalThis.document.addEventListener('visibilitychange', () => {
      if (globalThis.document.visibilityState !== 'visible' || lage.wert === 'laeuft') return;
      lage.wert = null;
      holen(repo);
    });
  }
  if (lage.laeuft || lage.wert) return;
  holen(repo);
}

function holen(repo) {
  if (lage.laeuft) return;
  lage.laeuft = true;
  const vorher = pushLage(repo);
  pushZustand().catch(() => 'unmoeglich').then((wert) => {
    lage.laeuft = false;
    if (lage.wert === 'laeuft') return; // inzwischen wurde eingeschaltet — das Ergebnis gewinnt
    lage.wert = wert;
    schreiben(SPEICHER_LAGE, wert);
    if (wert !== vorher) lage.render?.();
  });
}

// Einschalten. MUSS synchron im Tipp laufen: pushAnschalten() fragt die Erlaubnis sofort an
// (iOS verlangt die Berührung als Auslöser). Deshalb ist push.js hier statisch geladen.
export function pushEinschalten(ctx, { ausKarte = false } = {}) {
  const client = ctx?.repo?.client;
  if (!client) return Promise.resolve('konto');
  const versprechen = pushAnschalten(client);
  const vorher = pushLage(ctx.repo);
  lage.wert = 'laeuft';
  lage.ausKarte = ausKarte;
  lage.render = () => ctx.render?.();
  ctx.render?.();
  return versprechen.then((ergebnis) => {
    lage.wert = ergebnis;
    lage.ausKarte = false;
    schreiben(SPEICHER_LAGE, ergebnis === 'fehler' ? vorher : ergebnis);
    if (ergebnis === 'an') {
      rueckmeldung('erfolg');
      // Die Berührung hat den Klangraum eben geöffnet — so hört man gleich, wie es klingt.
      ton('probe', { einstellungen: ctx.repo.getSettings?.() });
      ctx.toast?.(tx('Mitteilungen sind an'));
    } else if (ergebnis === 'abgelehnt') {
      rueckmeldung('abgelehnt');
      ctx.toast?.(tx('Mitteilungen sind vom System blockiert'));
    } else if (ergebnis === 'fehler') {
      rueckmeldung('abgelehnt');
      ctx.toast?.(tx('Das Einschalten hat nicht geklappt'));
    }
    lage.render?.();
    return ergebnis;
  });
}

export function pushAusschaltenFuer(ctx) {
  const client = ctx?.repo?.client;
  if (!client) return Promise.resolve('konto');
  lage.wert = 'laeuft';
  ctx.render?.();
  return pushAusschalten(client).catch(() => 'bereit').then((ergebnis) => {
    lage.wert = ergebnis;
    schreiben(SPEICHER_LAGE, ergebnis);
    rueckmeldung('tipp');
    ctx.render?.();
    return ergebnis;
  });
}

// --- Bildzeichen ---------------------------------------------------------------------------

// Das Teilen-Zeichen, wie es in Safari aussieht (Kasten mit Pfeil nach oben) — nicht das
// Android-Zeichen aus symbole.js. Wer die Anleitung liest, soll genau DIESES Zeichen suchen.
function iosTeilen(farbe, groesse) {
  return `<svg width="${groesse}" height="${groesse}" viewBox="0 0 24 24" fill="none" aria-hidden="true" style="display:block"><path d="M12 14.2V3.6M8.2 7.2 12 3.4l3.8 3.8" stroke="${farbe}" stroke-width="1.9" stroke-linecap="round" stroke-linejoin="round"></path><path d="M8.6 10.1H7.2a2 2 0 0 0-2 2v7.1a2 2 0 0 0 2 2h9.6a2 2 0 0 0 2-2v-7.1a2 2 0 0 0-2-2h-1.4" stroke="${farbe}" stroke-width="1.9" stroke-linecap="round"></path></svg>`;
}

function iosPlusKasten(farbe, groesse) {
  return `<svg width="${groesse}" height="${groesse}" viewBox="0 0 24 24" fill="none" aria-hidden="true" style="display:block"><rect x="4" y="4" width="16" height="16" rx="4.2" stroke="${farbe}" stroke-width="1.9"></rect><path d="M12 8.4v7.2M8.4 12h7.2" stroke="${farbe}" stroke-width="1.9" stroke-linecap="round"></path></svg>`;
}

function appZeichen(groesse) {
  return `<img src="./icons/apple-touch-icon.png" alt="" aria-hidden="true" width="${groesse}" height="${groesse}" style="display:block;width:${groesse}px;height:${groesse}px;border-radius:24%">`;
}

function kleinerPfeil() {
  return '<svg width="9" height="9" viewBox="0 0 24 24" fill="none" aria-hidden="true" style="flex:none;display:block"><path d="m9 5 7 7-7 7" stroke="var(--muted-light)" stroke-width="2.6" stroke-linecap="round" stroke-linejoin="round"></path></svg>';
}

// iPhone, Safari, nicht installiert: drei Bildzeichen statt eines Absatzes.
export function homescreenAnleitung({ gross = false } = {}) {
  const kachel = gross ? 34 : 26;
  const zeichen = gross ? 20 : 16;
  const schritte = [
    { rolle: 'teilen', bild: iosTeilen('var(--blue)', zeichen), text: tx('Teilen') },
    { rolle: 'home', bild: iosPlusKasten('var(--ink)', zeichen), text: tx('Zum Home-Bildschirm') },
    { rolle: 'oeffnen', bild: appZeichen(gross ? 22 : 18), text: tx('Öffnen') },
  ];
  // Der Pfeil hängt am ENDE eines Schritts: Bricht die Zeile um (360 px, längere Sprachen), beginnt
  // die neue Zeile mit dem nächsten Bildzeichen — nie mit einem verwaisten Pfeil (angesehen).
  return `<span data-role="homescreen-anleitung" style="display:flex;align-items:center;flex-wrap:wrap;column-gap:${gross ? 8 : 6}px;row-gap:6px;font-family:${FONT}">${schritte.map((schritt, index) => `<span data-schritt="${schritt.rolle}" style="display:flex;align-items:center;gap:${gross ? 7 : 5}px;flex:none">
<span style="display:flex;width:${kachel}px;height:${kachel}px;border-radius:${gross ? 10 : 8}px;background:var(--field);align-items:center;justify-content:center;flex:none">${schritt.bild}</span>
<span style="font-size:${gross ? 12.5 : 11.5}px;font-weight:650;color:var(--ink-soft);white-space:nowrap">${esc(schritt.text)}</span>${index < schritte.length - 1 ? kleinerPfeil() : ''}</span>`).join('')}</span>`;
}

// --- Karte oben im Crew-Tab ----------------------------------------------------------------

function karteVerborgen() {
  const stand = lesen(SPEICHER_KARTE);
  if (!stand) return false;
  return Boolean(stand.nie) || Date.now() < Number(stand.bis || 0);
}

function karteWegtippen() {
  const stand = lesen(SPEICHER_KARTE) || {};
  const mal = (Number(stand.mal) || 0) + 1;
  const tage = KARTE_PAUSE_TAGE[mal - 1];
  schreiben(SPEICHER_KARTE, tage ? { mal, bis: Date.now() + tage * 86400000 } : { mal, nie: true });
}

// Nur, wenn es wirklich etwas zu tun gibt: aus (einschaltbar) oder iPhone ohne Home-Bildschirm.
// Blockiert oder unmöglich lässt sich hier nicht lösen — das steht ruhig auf der Mitteilungsseite.
export function mitteilungsKarte(ctx, { margin = '0' } = {}) {
  const wert = pushLage(ctx.repo);
  const zeigen = wert === 'bereit' || wert === 'homescreen' || wert === 'fehler' || (wert === 'laeuft' && lage.ausKarte);
  if (!zeigen || karteVerborgen()) return '';
  const kreuz = `<button data-act="push-karte-weg" data-treffer aria-label="${esc(tx('Hinweis ausblenden'))}" style="position:absolute;right:7px;top:${wert === 'homescreen' ? '10px' : '50%'};transform:${wert === 'homescreen' ? 'none' : 'translateY(-50%)'};width:34px;height:34px;border-radius:50%;border:0;background:transparent;display:flex;align-items:center;justify-content:center;cursor:pointer;appearance:none;padding:0"><span style="pointer-events:none;display:flex">${symbol('kreuz', 'var(--muted)', 15)}</span></button>`;
  const kachel = `<span style="width:42px;height:42px;border-radius:13px;background:var(--green-tint);display:flex;align-items:center;justify-content:center;flex:none;pointer-events:none">${symbol('glocke', 'var(--green-dark)', 21)}</span>`;
  const rahmen = 'background:var(--surface);border:1px solid var(--ink-a10);border-radius:18px;box-shadow:0 1px 2px var(--shadow-05);font-family:' + FONT + ';color:var(--ink);text-align:left';

  if (wert === 'homescreen') {
    return `<div data-role="push-karte" data-lage="homescreen" style="position:relative;flex:none;margin:${margin}">
<div style="display:flex;flex-direction:column;gap:10px;padding:12px 12px 13px;${rahmen}">
<div style="display:flex;align-items:center;gap:12px;padding-right:36px">${kachel}
<span style="display:flex;flex-direction:column;gap:3px;min-width:0">
<span style="font-size:14px;font-weight:650;letter-spacing:-.005em">${tx('Mitteilungen aufs iPhone')}</span>
<span style="font-size:12px;color:var(--ink-soft);line-height:1.35">${tx('Nur vom Home-Bildschirm aus')}</span></span></div>
<div style="padding-left:2px">${homescreenAnleitung()}</div>
</div>${kreuz}</div>`;
  }

  const unterzeile = wert === 'laeuft'
    ? `<span style="color:var(--muted)">${tx('Einen Moment …')}</span>`
    : wert === 'fehler'
      ? `${tx('Hat nicht geklappt')} · <b style="font-weight:650;color:var(--green-dark)">${tx('Nochmal')}</b>`
      : `${tx('Wer schreibt, wer frei ist')} · <b style="font-weight:650;color:var(--green-dark)">${tx('Einschalten')}</b>`;
  // Die ganze Karte ist die Aktion (wie „Wie war …?"); das Kreuz ist ein eigenes Ziel am Rand.
  return `<div data-role="push-karte" data-lage="${esc(wert)}" style="position:relative;flex:none;margin:${margin}">
<div role="button" tabindex="0" data-act="push-karte-an" aria-label="${esc(tx('Mitteilungen einschalten'))}" style="display:flex;align-items:center;gap:12px;padding:12px 48px 12px 12px;cursor:pointer;${rahmen}">
${kachel}
<span style="display:flex;flex-direction:column;gap:3px;flex:1;min-width:0;pointer-events:none">
<span style="font-size:14px;font-weight:650;letter-spacing:-.005em;white-space:nowrap;overflow:hidden;text-overflow:ellipsis">${tx('Mitteilungen aufs Handy')}</span>
<span style="font-size:12px;color:var(--ink-soft);white-space:nowrap;overflow:hidden;text-overflow:ellipsis">${unterzeile}</span>
</span></div>${kreuz}</div>`;
}

export function mitteilungsKarteAktionen(ctx) {
  return {
    'push-karte-an': () => {
      if (lage.wert === 'laeuft') return;
      rueckmeldung('tipp');
      pushEinschalten(ctx, { ausKarte: true });
    },
    'push-karte-weg': (data, knopf) => {
      rueckmeldung('schliessen');
      karteWegtippen();
      // Kurz zuklappen statt schlagartig verschwinden: die Liste rückt sichtbar nach.
      const karte = knopf?.closest?.('[data-role="push-karte"]');
      if (!karte || typeof karte.animate !== 'function') { ctx.render(); return; }
      const hoehe = karte.getBoundingClientRect().height;
      const lauf = karte.animate([
        { height: `${hoehe}px`, opacity: 1 },
        { height: '0px', opacity: 0, marginTop: '0px', marginBottom: '0px' },
      ], { duration: 220, easing: 'cubic-bezier(.4,0,.2,1)', fill: 'forwards' });
      karte.style.overflow = 'hidden';
      lauf.onfinish = () => ctx.render();
    },
  };
}

// --- Karte in Profil → Mitteilungen --------------------------------------------------------

function seitenTexte(wert) {
  const apple = istApple();
  switch (wert) {
    case 'an': return { status: tx('An'), farbe: 'var(--green-dark)', grund: 'var(--green-tint)', hinweis: tx('Dieses Gerät wird benachrichtigt.') };
    case 'bereit': return { status: tx('Aus'), farbe: 'var(--muted)', grund: 'var(--field)', hinweis: tx('Antippen, um Mitteilungen auf dieses Gerät zu erlauben.') };
    case 'abgelehnt': return {
      status: tx('Vom System blockiert'), farbe: 'var(--orange-dark)', grund: 'var(--orange-tint)',
      hinweis: apple
        ? tx('Erlauben lässt es sich in den iPhone-Einstellungen: Mitteilungen → Crew.')
        : tx('Die Erlaubnis wurde abgelehnt. Zurücknehmen lässt sie sich nur in den Einstellungen des Browsers für diese Seite.'),
    };
    case 'homescreen': return { status: tx('Erst auf den Home-Bildschirm'), farbe: 'var(--ink-soft)', grund: 'var(--field)', hinweis: tx('Auf dem iPhone kommen Mitteilungen nur, wenn Crew auf dem Home-Bildschirm liegt. In Safari:') };
    case 'unmoeglich': return { status: tx('Auf diesem Gerät nicht möglich'), farbe: 'var(--muted)', grund: 'var(--field)', hinweis: tx('Dieser Browser kennt keine Mitteilungen.') };
    case 'konto': return { status: tx('Nur mit Konto'), farbe: 'var(--muted)', grund: 'var(--field)', hinweis: tx('Im Demo-Modus gibt es keine Mitteilungen — es gibt niemanden, der etwas schicken könnte.') };
    case 'fehler': return { status: tx('Aus'), farbe: 'var(--orange-dark)', grund: 'var(--orange-tint)', hinweis: tx('Das Einschalten hat nicht geklappt. Bitte noch einmal versuchen.') };
    default: return { status: tx('Einen Moment …'), farbe: 'var(--muted)', grund: 'var(--field)', hinweis: tx('Die Erlaubnis wird gerade eingeholt.') };
  }
}

// schalter(on) kommt von der Seite selbst (dieselbe Schalter-Bauform wie die Zeilen darunter).
export function pushSeitenKarte(ctx, { schalter } = {}) {
  const wert = pushLage(ctx.repo);
  const text = seitenTexte(wert);
  const schaltbar = wert === 'an' || wert === 'bereit' || wert === 'fehler';
  const rechts = schaltbar && typeof schalter === 'function'
    ? schalter(wert === 'an')
    : '';
  const zusatz = wert === 'homescreen'
    ? `<div style="padding-top:9px">${homescreenAnleitung({ gross: true })}</div>`
    : wert === 'an'
      ? `<button data-act="push-probe" data-treffer style="margin-top:9px;align-self:flex-start;border:1px solid var(--ink-a12);background:var(--surface);color:var(--ink);font:650 12.5px/1 ${FONT};padding:9px 13px;border-radius:999px;cursor:pointer;appearance:none;display:flex;align-items:center;gap:6px"><span style="pointer-events:none;display:flex">${symbol('glocke', 'var(--ink-soft)', 14)}</span><span style="pointer-events:none">${tx('Probe-Mitteilung senden')}</span></button>`
      : '';
  return `<div data-role="push-seite" data-lage="${esc(wert)}" style="background:var(--surface);border-radius:18px;border:1px solid var(--ink-a07);overflow:hidden;font-family:${FONT};color:var(--ink)">
<div style="display:flex;align-items:center;gap:12px;padding:12px 16px 4px">
<span style="width:36px;height:36px;border-radius:11px;background:${text.grund};display:flex;align-items:center;justify-content:center;flex:none">${symbol('glocke', text.farbe === 'var(--muted)' ? 'var(--ink-soft)' : text.farbe, 19)}</span>
<div style="display:flex;flex-direction:column;gap:2px;flex:1;min-width:0">
<span style="font-size:14px;font-weight:600">${tx('Mitteilungen auf diesem Gerät')}</span>
<span data-role="push-status" style="font-size:12px;font-weight:650;color:${text.farbe}">${esc(text.status)}</span>
</div>${rechts}</div>
<div style="display:flex;flex-direction:column;padding:4px 16px 13px 64px"><span style="font-size:11.5px;color:var(--muted);line-height:1.45">${esc(text.hinweis)}</span>${zusatz}</div>
</div>`;
}

export function pushSeitenAktionen(ctx) {
  return {
    // Der Schalter fragt nach der Erlaubnis — und zwar NUR auf diesen Tipp, synchron darin.
    'push-toggle': () => {
      const wert = pushLage(ctx.repo);
      if (wert === 'laeuft' || !ctx.repo?.client) return;
      if (wert === 'an') pushAusschaltenFuer(ctx);
      else pushEinschalten(ctx);
    },
    'push-probe': () => {
      rueckmeldung('tipp');
      pushProbe({ titel: 'Crew', text: tx('So kommen Mitteilungen von Crew an.') }).then((ok) => {
        if (!ok) ctx.toast?.(tx('Die Probe ging nicht — sind Mitteilungen erlaubt?'));
      });
    },
  };
}

// --- Ankunft in der offenen App: Ton + Vibration -------------------------------------------

// „Frei-Hinweise von Freunden" (Profil → Mitteilungen) ist die Empfangsregel. Fehlt sie, gilt
// wie auf der Seite „Alle" (Runde 4, B6).
export function freiHinweisVon(settings, person) {
  const hinweise = settings?.freiHints || { mode: 'alle', customIds: [] };
  const beste = settings?.bestFriendIds || [];
  const besondere = settings?.specialPerson?.personId || null;
  switch (hinweise.mode) {
    case 'niemand': return false;
    case 'beste': return beste.includes(person.id);
    case 'markierte': return beste.includes(person.id) || besondere === person.id;
    case 'individuell': return (hinweise.customIds || []).includes(person.id);
    default: return true;
  }
}

const jetztFrei = (person) => Boolean(person?.free?.active && !person.free.pending && !person.activeMeetId);
const nachrichtSchluessel = (m) => m.id || `${m.authorId}|${m.date || ''}|${m.time || ''}|${m.kind}|${m.text || ''}`;
// Welche Rückmeldung zu welcher Ankunft passt (Namen aus core/html.js rueckmeldung).
const HAPTIK = { nachricht: 'tipp', anstupser: 'zurueck', frei: 'erfolg', anfrage: 'erfolg' };
const RANG = ['anfrage', 'anstupser', 'frei', 'nachricht'];
const MIN_ABSTAND_MS = 1500;

function raumIds(repo) {
  const ids = new Set();
  for (const crew of repo.getCrews?.() || []) ids.add(roomIdForCrew(crew.id));
  for (const person of repo.getPeople?.() || []) ids.add(roomIdForPerson(person.id));
  for (const meet of repo.getMeets?.() || []) if (meet.roomId) ids.add(meet.roomId);
  return ids;
}

function standAufnehmen(repo) {
  const nachrichten = new Map();
  for (const id of raumIds(repo)) {
    const fremde = new Map();
    for (const m of repo.getRoom?.(id)?.messages || []) {
      if (!m || !m.authorId || m.authorId === ME) continue;
      if (m.kind !== 'text' && m.kind !== 'nudge' && m.kind !== 'location') continue;
      fremde.set(nachrichtSchluessel(m), m.kind);
    }
    nachrichten.set(id, fremde);
  }
  const leute = repo.getPeople?.() || [];
  return {
    nachrichten,
    personen: new Set(leute.map((p) => p.id)),
    frei: new Set(leute.filter(jetztFrei).map((p) => p.id)),
    anfragen: new Set((repo.getFriendRequests?.() || []).map((a) => a.id)),
  };
}

function offenerRaum(nav) {
  const route = nav?.current?.();
  return route?.id === 'room.view' ? route.params?.roomId || null : null;
}

let waechter = null;

// Einmal je Repository. Crew und Mitteilungsseite rufen es beim Binden (idempotent); besser noch
// app.js direkt nach repo.subscribe — dann hört die App auch, wenn sie im Meet-Tab startet.
export function mitteilungenBeobachten(ctx) {
  const repo = ctx?.repo;
  if (!repo || typeof repo.subscribe !== 'function') return;
  tonFreischalten();
  if (waechter && waechter.repo === repo) {
    if (ctx.nav) waechter.nav = ctx.nav;
    return;
  }
  const eigener = { repo, nav: ctx.nav || null, stand: standAufnehmen(repo), letzte: 0 };
  waechter = eigener;
  repo.subscribe(() => {
    if (waechter !== eigener) return;
    try { pruefen(eigener); } catch { /* ein Fehler hier darf die App nie stören */ }
  });
}

function pruefen(w) {
  const alt = w.stand;
  const neu = standAufnehmen(w.repo);
  w.stand = neu;
  if (globalThis.document?.visibilityState === 'hidden') return; // dann spricht die Push-Mitteilung
  const settings = w.repo.getSettings?.() || {};
  const schalter = settings.notifications || {};
  const hierOffen = offenerRaum(w.nav);
  const arten = new Set();

  for (const [raumId, fremde] of neu.nachrichten) {
    const vorher = alt.nachrichten.get(raumId);
    if (!vorher) continue; // neu dazugekommener Raum (angenommene Freundschaft …): keine alte Geschichte melden
    for (const [schluessel, art] of fremde) {
      if (vorher.has(schluessel)) continue;
      if (art === 'nudge') {
        if (schalter.anstupser !== false) arten.add('anstupser');
      } else if (raumId !== hierOffen && schalter.chat !== false) {
        // Im gerade offenen Raum klingelt es nicht bei jeder Nachricht — man liest ja mit.
        arten.add('nachricht');
      }
    }
  }
  const leute = new Map((w.repo.getPeople?.() || []).map((p) => [p.id, p]));
  for (const id of neu.frei) {
    if (alt.frei.has(id) || !alt.personen.has(id)) continue;
    if (freiHinweisVon(settings, leute.get(id) || { id })) arten.add('frei');
  }
  for (const id of neu.anfragen) if (!alt.anfragen.has(id)) arten.add('anfrage');

  const art = RANG.find((eintrag) => arten.has(eintrag));
  if (!art) return;
  const jetzt = Date.now();
  if (jetzt - w.letzte < MIN_ABSTAND_MS) return;
  w.letzte = jetzt;
  const an = toeneAn(settings);
  const klang = ton(art, { einstellungen: settings });
  // Vor der ersten Berührung verweigert der Browser navigator.vibrate (Chrome meldet es als Fehler).
  // Die native Hülle (Capacitor Haptics) braucht keine Berührung.
  const aktivierung = globalThis.navigator?.userActivation;
  const darfVibrieren = Boolean(globalThis.Capacitor?.Plugins?.Haptics) || !aktivierung || aktivierung.hasBeenActive;
  if (an && darfVibrieren) rueckmeldung(HAPTIK[art]);
  mitteilungenBeobachten.letzte = { art, at: jetzt, ton: klang, vibration: an && darfVibrieren };
}
