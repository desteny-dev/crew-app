// Bereich Crew (reference 04.x): Start mit Gruppen/Personen, In-Place-Karte, Frei-Steuerung.
// Muster-Modul für alle Bereichs-Screens: render(ctx) → { html, bind(root, ctx) }.

import { esc, bindActions, bindRowDrag, rueckmeldung } from '../core/html.js';
import { roomIdForCrew, roomIdForPerson, ME } from '../data/ids.js';
import { formatMeetDate, jetztTermin } from '../core/dates.js';
import {
  screenScaffold, tabBar, newCrewCard, leerZeile, personRow, edgeFadeRow,
  freiKreis, freiHoldOverlay, iconSwitch, personAvatar, personMarker,
  tabHeader, avatarFlaeche, cardEdgeFade, sheet,
} from '../ui/components.js';
import { listIcon, mapIcon, chevronRight, chevronDown } from '../ui/icons.js';
// Runde 3 (E4, Chef/P5): Hinweis „Wie war …?" nach einem Meet — gebaut in meet-panels.js.
import { bewertungsHinweis, bewertungsHinweisAktionen } from '../ui/meet-panels.js';
import { symbol } from '../ui/symbole.js';
import { t as tx, tn as tnx } from '../core/sprache.js';
// Runde 5 (P5, G1/G2): Mitteilungen einschalten (Karte oben) und hören, was in der offenen App ankommt.
import { mitteilungsKarte, mitteilungsKarteAktionen, pushLageAuffrischen, mitteilungenBeobachten } from '../ui/mitteilungen.js';

function crewMeta(repo, crew) {
  if (crew.activeMeetId) {
    const meet = repo.getMeet(crew.activeMeetId);
    const yes = Object.values(meet?.participation || {}).filter((value) => value === 'yes').length;
    return { meta: tx('{n} dabei', { n: yes }), activeMeet: true };
  }
  return { meta: tx('{frei}/{alle} frei', { frei: crew.freeCount, alle: crew.memberIds.length }), activeMeet: false };
}

// --- Gruppen-Identität und Mitgliedsstapel (v7 A37, spec/01 §1, spec/08 §2) ---

// Ruhiger, neutraler Grund für das Monogramm einer Gruppe ohne eigenes Bild. Bewusst
// KEINE Statusfarbe (frei/Loop/Absage) und keine zufällige Mitgliedsfarbe — die Fläche
// soll nichts behaupten, was die Gruppe nicht hat. Es ist derselbe Rückfallton, den das
// Gruppenprofil verwendet (room.js gruppenKreis), damit dieselbe Gruppe in Rail und
// Detail dasselbe Gesicht trägt.
const GRUPPE_NEUTRAL = 'var(--blue)';

// „Freitag-Crew" → „FC". Dieselbe Regel wie im Gruppenprofil (room.js crewInitials),
// damit dieselbe Gruppe in Rail und Detail dasselbe Monogramm trägt.
function gruppenMonogramm(name) {
  const worte = String(name || '').split(/[^\p{L}\d]+/u).filter(Boolean);
  return `${worte[0]?.[0] || ''}${worte[1]?.[0] || worte[0]?.[1] || ''}`.toUpperCase();
}

// v7 A37: Der große Kreis einer Gruppe ist ihr KANONISCHES Gruppenbild. Vorher stand
// dort eine Collage aus drei Mitgliedern — sie beantwortet die Frage „welche Gruppe ist
// das?" nicht, weil dieselben Personen in mehreren Gruppen sind, und sie ändert sich mit
// jedem Beitritt. Gelesen wird das Bild über dieselbe Primitive wie bei Personen
// (avatarFlaeche/bildVon); fehlt es, erscheint der ruhige Monogramm-Fallback.
function gruppenBild(crew, size, fontSize) {
  // Der Datensatz der Gruppe geht unverändert in die Primitive; ergänzt werden nur die
  // beiden abgeleiteten Rückfallwerte. So entscheidet weiterhin bildVon() allein, welches
  // Bild eine Gruppe hat — dieser Screen hält keine eigene Bildquelle.
  const eintrag = {
    ...crew,
    initials: gruppenMonogramm(crew.name),
    color: crew.color || GRUPPE_NEUTRAL,
  };
  return `<span data-role="gruppen-bild" style="position:relative;flex:none;display:block;width:${size}px;height:${size}px;border-radius:50%">${avatarFlaeche(eintrag, size, fontSize)}</span>`;
}

// Kleiner, klar sekundärer Mitgliedsstapel. Er benutzt dieselbe Avatar-Primitive wie
// jede andere Fläche der App (personAvatar) — nur so zeigt er dasselbe Profilbild und
// dieselben privaten Markierungen wie die Personenliste darunter.
// spec/01 §1: Der weiße Überlappungstrenner liegt am WRAPPER und der Wrapper bildet mit
// `position:relative;z-index:0` eine eigene Stapel-Einheit. Dadurch liegt jede hintere
// Unit samt Ring, Fade und Zeichen vollständig hinter jeder vorderen Unit.
function mitgliederStapel(people, options = {}) {
  const size = options.size || 17;
  const max = options.max || 3;
  const trenner = options.separator || 'var(--surface)';
  const ueberlappung = Math.round(size * 0.34);
  const zellen = people.slice(0, max).map((person, index) => {
    const marker = options.settings ? personMarker(person.id, options.settings) : null;
    const avatar = personAvatar(person, {
      size,
      fontSize: Math.max(7, Math.round(size * 0.44)),
      marker,
      compact: true,
      dotBorder: trenner,
    });
    return `<span style="position:relative;z-index:0;display:block;flex:none;border-radius:50%;box-shadow:0 0 0 2px ${trenner};${index ? `margin-left:-${ueberlappung}px` : ''}">${avatar}</span>`;
  }).join('');
  return `<span style="display:flex;align-items:center;flex:none">${zellen}</span>`;
}

// Gruppenkachel der Crew-Rail. Aufbau: primärer Gruppenkreis, daneben der sekundäre
// Mitgliedsstapel, darunter Name und Meta. Die frühere crewCard() aus components.js
// konnte kein Gruppenbild zeigen (sie rendert fest members.slice(0,3)).
// Runde 4 (E6, Jonathan): „Dass man in den Gruppen wirklich sieht, dass sie frei sind, und es nicht
// so ein grauer Text ist." Sind Mitglieder frei, trägt die Zeile den grünen Frei-Punkt und steht in
// Grün; ist niemand frei, bleibt sie leise. Ein laufendes Meet behält seine eigene grüne Zeile.
function kachelMeta(meta, { isActive, frei }) {
  const istFrei = !isActive && frei > 0;
  const farbe = isActive || istFrei ? 'var(--green-dark)' : 'var(--muted)';
  const punkt = istFrei
    ? '<span style="flex:none;width:7px;height:7px;border-radius:50%;background:var(--green);box-shadow:0 0 0 2.5px var(--green-a20)"></span>'
    : '';
  return `<div data-role="kachel-meta" data-frei="${istFrei}" style="display:flex;align-items:center;gap:6px;min-width:0;font-size:12px;font-weight:${isActive || istFrei ? 650 : 550};color:${farbe}">${punkt}<span style="white-space:nowrap;overflow:hidden;text-overflow:ellipsis">${esc(meta || '')}</span></div>`;
}

function crewKarte(crew, members, options = {}) {
  const isActive = Boolean(options.activeMeet);
  const fade = isActive ? cardEdgeFade(18) : '';
  const badge = crew.unread
    ? `<div style="position:absolute;top:-8px;right:-6px;min-width:21px;height:21px;border-radius:11px;background:var(--orange);color:var(--on-accent);font:650 11.5px/21px 'Instrument Sans',sans-serif;text-align:center;padding:0 6px;z-index:2">${crew.unread}</div>`
    : '';
  return `<button data-act="open-crew" data-crew="${crew.id}" style="position:relative;flex:none;width:128px;background:var(--surface);border-radius:18px;padding:14px 15px 13px;display:flex;flex-direction:column;gap:9px;font-family:'Instrument Sans',sans-serif;border:1px solid var(--ink-a09);box-shadow:0 1px 2px var(--shadow-04);color:var(--ink);text-align:left;appearance:none;cursor:pointer">
${fade}${badge}
<div style="display:flex;align-items:center;gap:8px;position:relative;z-index:1;pointer-events:none">${gruppenBild(crew, 46, 17)}${mitgliederStapel(members, { size: 17, max: 3, settings: options.settings })}</div>
<div style="display:flex;flex-direction:column;gap:2px;position:relative;z-index:1;pointer-events:none">
<div style="font-size:14px;font-weight:650;letter-spacing:-.01em;white-space:nowrap;overflow:hidden;text-overflow:ellipsis">${esc(crew.name)}</div>
${kachelMeta(options.meta, { isActive, frei: Number(options.frei) || 0 })}
</div></button>`;
}

// Runde 4 (B5, Schnittstelle P1 web/core/belegt.js): Wer laut seinen Belegt-Zeiten gerade sicher
// keine Zeit hat, zeigt das ruhig unter dem Namen („Keine Zeit bis 17:00") — nie den Plan selbst.
// Frei gewinnt: wer FREE gesetzt hat, zeigt kein „Keine Zeit". Die Datei wird erst geladen, wenn
// eine Person überhaupt Belegt-Zeiten mitbringt; bis dahin (oder ohne die Datei) steht nichts da.
let belegtModul = null;
let belegtLaedt = false;
function belegtHinweisFuer(ctx, person) {
  if (!Array.isArray(person?.belegt) || !person.belegt.length) return '';
  if (person.free?.active) return '';
  if (!belegtModul) {
    if (!belegtLaedt) {
      belegtLaedt = true;
      import('../core/belegt.js').then((modul) => { belegtModul = modul; ctx.render?.(); }).catch(() => {});
    }
    return '';
  }
  try { return belegtModul.belegtHinweis?.(person.belegt) || ''; } catch { return ''; }
}

// --- Temporäre Räume (v7 spec/04 §1) ---

// Ein Meet mehrerer einzeln gewählter Personen hat GENAU EINEN gemeinsamen temporären
// Raum (meet.roomId). Diese Räume sind keine Crews: sie stehen deshalb nicht in der Rail
// und nicht in der Personenliste, sondern in einem kompakten, aufklappbaren Bereich
// dazwischen — und nur dann, wenn es solche Meets überhaupt gibt.
// repo.getMeets() liefert bereits die richtige Ordnung: aktives Meet zuerst, danach das
// nächste. Abgeschlossene Meets sind darin nicht enthalten; ihr Raum bleibt über den
// Meet-Verlauf erreichbar und drängt sich hier nicht in die Hauptliste.
// Runde 3 (O4, Jonathan): „Temporäre Chats finde ich gut — man könnte offener kommunizieren,
// wenn es dort eine Benachrichtigung gibt: da ist was los, da muss ich antworten." Neu ist,
// was seit dem letzten Lesen in einem Raum von anderen kam (Nachricht oder Anstupser). Es
// erscheint in derselben Sprache wie überall in der Liste: die orange Zahl. Dazu steht, was
// zuletzt geschrieben wurde — auch im zugeklappten Kopf, damit man nicht erst aufklappen muss.
function neuImRaum(repo, roomId) {
  const raum = roomId ? repo.getRoom?.(roomId) : null;
  if (!raum) return { zahl: 0, letzte: null };
  const neu = (raum.messages || []).slice(raum.lastReadCount || 0)
    .filter((nachricht) => nachricht.authorId !== ME && (nachricht.kind === 'text' || nachricht.kind === 'nudge'));
  return { zahl: neu.length, letzte: neu[neu.length - 1] || null };
}

function vorschauText(repo, nachricht) {
  if (!nachricht) return '';
  const name = repo.getPerson(nachricht.authorId)?.name || '';
  if (nachricht.kind === 'nudge') return tx('{name} hat angestupst', { name });
  return tx('{name}: {text}', { name, text: String(nachricht.text || '').replace(/\s+/g, ' ').trim() });
}

function orangeZahl(zahl) {
  return `<span data-role="temp-neu" style="flex:none;min-width:20px;height:20px;border-radius:10px;background:var(--orange);color:var(--on-accent);font:650 11px/20px 'Instrument Sans',sans-serif;text-align:center;padding:0 6px;box-sizing:border-box;pointer-events:none">${zahl}</span>`;
}

// =====================================================================================
// Runde 5 (P5) — FREE mehr genutzt und sinnvoller (G3), Freundschaftsanfragen oben (C2).
// =====================================================================================
//
// Jonathan: „Mache, dass der FREE-Button viel mehr genutzt wird und eventuell sinnvoller ist." —
// „Freundschaftsanfragen sollen stärker kommuniziert werden."
//
// G3a  Wer frei wird, sieht sofort, wer AUCH frei ist, und startet mit einem Tipp „Spontan treffen"
//      (Neues Meet mit „Jetzt" und diesen Personen). Ist niemand frei: ein ruhiger Satz als Toast.
//      Der Hinweis liegt über dem Knopf und ist DURCHLÄSSIG — nur „Spontan treffen" und das Kreuz
//      nehmen Tipps an, die Liste darunter bleibt bedienbar. Er blendet nach 12 s aus. Wird, während
//      man frei ist, noch jemand frei, erscheint er wieder — genau dann lohnt sich ein Treffen.
// G3b  Lust (Kaffee, Sport, Draußen, Essen, Chillen) als Pille rechts neben dem Knopf, solange man
//      frei ist. Frei-Setzen bleibt EIN Tipp; die Lust ist ein zweiter, freiwilliger. Freunde lesen
//      „frei · Lust auf Kaffee" in der Crew-Liste (repo.setFreeLust, person.free.lust — Chef).
// G3c  Ist ein „Keine Zeit"-Fenster gerade zu Ende (web/core/belegt.js, P1), fragt die Seite beim
//      Öffnen einmal je Fenster leise „Jetzt frei?".
// G3d  „Ich auch" aus einer Frei-Mitteilung öffnet ./?route=crew.home&aktion=frei → sofort frei.

const AUCH_FREI_MS = 12000;
const JETZT_FREI_SPEICHER = 'crew.frei.jetztGefragt';
const JETZT_FREI_FENSTER_MIN = 180;

// Die Schlüssel sind die festen Werte der Datenschicht (Chef, Migration 0030).
function lustListe() {
  return [
    { key: 'kaffee', label: tx('Kaffee'), satz: tx('Lust auf Kaffee'), zeichen: 'tasse', kategorie: null },
    { key: 'sport', label: tx('Sport'), satz: tx('Lust auf Sport'), zeichen: 'fussball', kategorie: 'sport' },
    { key: 'draussen', label: tx('Draußen'), satz: tx('Lust auf draußen'), zeichen: 'sonne', kategorie: null },
    { key: 'essen', label: tx('Essen'), satz: tx('Lust auf Essen'), zeichen: 'gabel', kategorie: 'essen' },
    { key: 'chillen', label: tx('Chillen'), satz: tx('Lust zu chillen'), zeichen: 'sofa', kategorie: 'chillen' },
  ];
}

function lustVon(key) {
  return key ? lustListe().find((eintrag) => eintrag.key === key) || null : null;
}

const istJetztFrei = (person) => Boolean(person?.free?.active && !person.free.pending && !person.activeMeetId);

function freiMitLust(person) {
  return istJetztFrei(person) ? lustVon(person.free.lust) : null;
}

// Wer gerade frei ist: besondere Person, dann beste Freunde, dann die übrigen wie in den Daten.
function freieFreunde(repo) {
  const settings = repo.getSettings();
  const beste = settings.bestFriendIds || [];
  const besondere = settings.specialPerson?.personId || null;
  const rang = (person) => (person.id === besondere ? 0 : beste.includes(person.id) ? 1 : 2);
  return repo.getPeople().filter(istJetztFrei).sort((a, b) => rang(a) - rang(b));
}

function namenSatz(leute) {
  const [a, b] = leute.map((person) => person.name);
  if (leute.length === 1) return tx('{name} ist auch frei', { name: a });
  if (leute.length === 2) return tx('{a} und {b} sind auch frei', { a, b });
  if (leute.length === 3) return tx('{a}, {b} und eine weitere Person sind auch frei', { a, b });
  return tx('{a}, {b} und {n} weitere sind auch frei', { a, b, n: leute.length - 2 });
}

function auchFreiZeigen(ctx) {
  const { ui } = ctx;
  window.clearTimeout(ui.freiHinweisTimer);
  const hinweis = { art: 'auchFrei', bis: Date.now() + AUCH_FREI_MS };
  ui.freiHinweis = hinweis;
  ui.freiHinweisTimer = window.setTimeout(() => {
    if (ui.freiHinweis !== hinweis) return;
    ui.freiHinweis = null;
    if (document.querySelector('#free-button')) ctx.render();
  }, AUCH_FREI_MS);
}

// Nach dem Frei-Werden (Tipp, Loslassen ohne Zeit, „Jetzt frei?", „Ich auch").
function nachFreiWerden(ctx) {
  if (freieFreunde(ctx.repo).length) { auchFreiZeigen(ctx); return; }
  window.clearTimeout(ctx.ui.freiHinweisTimer);
  ctx.ui.freiHinweis = null;
  ctx.toast?.(tx('Deine Freunde sehen, dass du frei bist'));
}

// Läuft im Render: Wird, während ich frei bin, jemand frei, zeigt der nächste Render den Hinweis.
function freiBekanntAbgleichen(ctx, look) {
  const { ui, repo } = ctx;
  if (look !== 'active') {
    ui.freiBekannt = null;
    if (ui.freiHinweis?.art === 'auchFrei') ui.freiHinweis = null;
    return;
  }
  const jetzt = freieFreunde(repo).map((person) => person.id);
  const vorher = ui.freiBekannt;
  ui.freiBekannt = jetzt;
  if (vorher && jetzt.some((id) => !vorher.includes(id))) auchFreiZeigen(ctx);
}

function spontanTreffen(ctx) {
  const { repo, ui, nav } = ctx;
  const leute = freieFreunde(repo);
  if (!leute.length || typeof repo.createDraft !== 'function') return;
  rueckmeldung('tipp');
  window.clearTimeout(ui.freiHinweisTimer);
  ui.freiHinweis = null;
  // Derselbe Einstieg wie „Neues Meet" aus einem Raum (room.js draftFuerRaum/planAlsMeet).
  const entwurf = repo.createDraft({ withPersonIds: leute.map((person) => person.id) });
  if (!entwurf?.id) return;
  const patch = { when: jetztTermin() };
  // Mit Lust auf Sport, Essen oder Chillen stehen die Vorschläge gleich in dieser Kategorie.
  const lust = lustVon(repo.getFreeState()?.lust);
  if (lust?.kategorie) patch.filter = { ...(entwurf.filter || {}), category: lust.kategorie };
  repo.updateDraft?.(entwurf.id, patch);
  nav.go('newMeet.discover', { draftId: entwurf.id });
}

function freiHinweisHtml(ctx, free) {
  const { ui, repo } = ctx;
  const hinweis = ui.freiHinweis;
  if (!hinweis) return '';
  const settings = repo.getSettings();
  let bild = '';
  let titel = '';
  let unter = '';
  let knopf = null;
  if (hinweis.art === 'auchFrei') {
    const leute = freieFreunde(repo);
    if (!free?.active || free.pending || !leute.length) return '';
    bild = mitgliederStapel(leute, { size: 34, max: 3, settings });
    titel = namenSatz(leute);
    const mitLust = leute.find((person) => lustVon(person.free?.lust));
    unter = mitLust ? tx('{name}: {lust}', { name: mitLust.name, lust: lustVon(mitLust.free.lust).satz }) : '';
    knopf = { act: 'frei-spontan', label: tx('Spontan treffen') };
  } else if (hinweis.art === 'jetztFrei') {
    if (free?.active) return '';
    bild = `<span style="width:38px;height:38px;border-radius:12px;background:var(--green-tint);display:flex;align-items:center;justify-content:center;flex:none">${symbol('uhr', 'var(--green-dark)', 20)}</span>`;
    titel = tx('Jetzt frei?');
    unter = tx('Keine Zeit ist seit {zeit} vorbei', { zeit: hinweis.zeit || '' });
    knopf = { act: 'frei-jetzt', label: tx('Ich bin frei') };
  } else {
    return '';
  }
  return `<div data-role="frei-hinweis" data-art="${hinweis.art}" style="pointer-events:none;display:flex;justify-content:center;padding:0 16px 8px">
<div data-role="frei-hinweis-karte" style="pointer-events:none;position:relative;box-sizing:border-box;width:100%;max-width:440px;display:flex;align-items:flex-start;gap:12px;padding:12px 44px 12px 12px;background:var(--surface);border:1px solid var(--green-a28);border-radius:20px;box-shadow:0 10px 28px var(--shadow-16);font-family:'Instrument Sans',sans-serif;color:var(--ink)">
<span style="display:flex;flex:none;padding-top:1px">${bild}</span>
<span style="display:flex;flex-direction:column;gap:3px;flex:1;min-width:0">
<span data-role="frei-hinweis-titel" style="font-size:14px;font-weight:650;letter-spacing:-.005em;line-height:1.3;display:-webkit-box;-webkit-line-clamp:2;-webkit-box-orient:vertical;overflow:hidden">${esc(titel)}</span>
${unter ? `<span style="font-size:12px;color:var(--ink-soft);white-space:nowrap;overflow:hidden;text-overflow:ellipsis">${esc(unter)}</span>` : ''}
<button data-act="${knopf.act}" data-treffer style="pointer-events:auto;align-self:flex-start;margin-top:7px;height:36px;padding:0 16px;border:0;border-radius:999px;background:var(--green);color:var(--on-accent);font:650 13px/1 'Instrument Sans',sans-serif;cursor:pointer;appearance:none;white-space:nowrap"><span style="pointer-events:none">${esc(knopf.label)}</span></button>
</span>
<button data-act="frei-hinweis-zu" data-treffer aria-label="${esc(tx('Hinweis ausblenden'))}" style="pointer-events:auto;position:absolute;right:6px;top:6px;width:32px;height:32px;border:0;border-radius:50%;background:transparent;display:flex;align-items:center;justify-content:center;cursor:pointer;appearance:none;padding:0"><span style="pointer-events:none;display:flex">${symbol('kreuz', 'var(--muted)', 14)}</span></button>
</div></div>`;
}

// Rechts neben dem Knopf, außerhalb seiner 108-px-Trefferfläche — ein Tipp auf FREE bleibt FREE.
function lustPilleHtml(free) {
  const lust = lustVon(free?.lust);
  const inhalt = lust
    ? `<span style="pointer-events:none;display:flex">${symbol(lust.zeichen, 'var(--green-dark)', 14)}</span><span style="pointer-events:none">${esc(lust.label)}</span>`
    : `<span style="pointer-events:none;display:flex">${symbol('plus', 'var(--muted)', 12)}</span><span style="pointer-events:none;color:var(--ink-soft)">${tx('Lust?')}</span>`;
  return `<button data-act="lust-waehlen" data-treffer data-role="lust-pille" data-lust="${lust ? lust.key : ''}" aria-label="${esc(lust ? lust.satz : tx('Worauf hast du Lust?'))}" style="position:absolute;left:calc(50% + 58px);top:50%;margin-top:-15px;height:30px;padding:0 11px 0 9px;display:flex;align-items:center;gap:5px;box-sizing:border-box;border-radius:999px;border:1px solid ${lust ? 'var(--green-a35)' : 'var(--ink-a12)'};background:${lust ? 'var(--green-tint)' : 'var(--surface)'};box-shadow:0 3px 10px var(--shadow-10);font:650 12px/1 'Instrument Sans',sans-serif;color:var(--green-dark);white-space:nowrap;cursor:pointer;appearance:none;pointer-events:auto">${inhalt}</button>`;
}

function lustSheetHtml(ctx) {
  const aktuell = ctx.repo.getFreeState()?.lust || null;
  const kacheln = lustListe().map((lust) => {
    const an = lust.key === aktuell;
    return `<button data-act="lust-setzen" data-lust="${lust.key}" aria-pressed="${an}" style="display:flex;flex-direction:column;align-items:center;justify-content:center;gap:7px;min-width:0;min-height:76px;padding:10px 2px;box-sizing:border-box;border-radius:16px;border:1.5px solid ${an ? 'var(--green)' : 'var(--ink-a10)'};background:${an ? 'var(--green-tint)' : 'var(--surface)'};color:${an ? 'var(--green-dark)' : 'var(--ink)'};font:650 12px/1.1 'Instrument Sans',sans-serif;cursor:pointer;appearance:none">
<span style="pointer-events:none;display:flex">${symbol(lust.zeichen, an ? 'var(--green-dark)' : 'var(--ink-soft)', 24)}</span>
<span style="pointer-events:none;max-width:100%;white-space:nowrap;overflow:hidden;text-overflow:ellipsis">${esc(lust.label)}</span></button>`;
  }).join('');
  const ohne = aktuell
    ? `<button data-act="lust-setzen" data-lust="" style="display:block;margin:12px auto 0;border:0;background:transparent;color:var(--muted);font:600 13px/1 'Instrument Sans',sans-serif;padding:14px 18px;cursor:pointer;appearance:none">${tx('Keine Angabe')}</button>`
    : '';
  return sheet(`<div data-role="lust-sheet" style="font-family:'Instrument Sans',sans-serif;color:var(--ink)">
<div style="font-family:'Bricolage Grotesque',sans-serif;font-size:19px;font-weight:650">${tx('Worauf hast du Lust?')}</div>
<div style="font-size:12.5px;color:var(--muted);margin:4px 0 14px">${tx('Deine Freunde sehen es neben „frei".')}</div>
<div style="display:grid;grid-template-columns:repeat(5,minmax(0,1fr));gap:6px">${kacheln}</div>
${ohne}</div>`, { closeAct: 'lust-zu', scrollKey: 'lust' });
}

function freiAktionen(ctx) {
  const { repo, ui } = ctx;
  return {
    'frei-spontan': () => spontanTreffen(ctx),
    'frei-jetzt': () => {
      rueckmeldung('erfolg');
      ui.freiHinweis = null;
      repo.setFree({});
      nachFreiWerden(ctx);
      ctx.render();
    },
    'frei-hinweis-zu': () => {
      rueckmeldung('schliessen');
      window.clearTimeout(ui.freiHinweisTimer);
      ui.freiHinweis = null;
      ctx.render();
    },
    'lust-waehlen': () => { rueckmeldung('tipp'); ui.lustSheet = true; ctx.render(); },
    'lust-zu': () => { ui.lustSheet = false; ctx.render(); },
    'lust-setzen': (data) => {
      const key = data.lust || null;
      rueckmeldung('auswahl');
      ui.lustSheet = false;
      if (typeof repo.setFreeLust === 'function') {
        repo.setFreeLust(key);
      } else {
        const free = repo.getFreeState();
        if (free?.active && !free.pending) repo.setFree({ lust: key });
      }
      ctx.render();
    },
  };
}

// G3c — „Jetzt frei?" einmal je beendetem Fenster. Gemerkt wird das Ende des Fensters (ms).
function jetztFreiPruefen(ctx) {
  const { repo, ui } = ctx;
  if (ui.jetztFreiGeprueft) return;
  ui.jetztFreiGeprueft = true;
  const belegt = repo.getSettings().belegt;
  if (!Array.isArray(belegt) || !belegt.length || repo.getFreeState()?.active) return;
  import('../core/belegt.js').then(({ belegtJetzt, uhrzeitText }) => {
    const jetzt = Date.now();
    if (belegtJetzt(belegt, new Date(jetzt)).belegt) return;
    let ende = 0;
    for (let minuten = 1; minuten <= JETZT_FREI_FENSTER_MIN; minuten += 1) {
      const zustand = belegtJetzt(belegt, new Date(jetzt - minuten * 60000));
      const zeit = zustand.belegt && zustand.ende ? zustand.ende.getTime() : 0;
      if (zeit && zeit <= jetzt && zeit > ende) ende = zeit;
    }
    if (!ende) return;
    const schluessel = String(ende);
    let gefragt = [];
    try { gefragt = JSON.parse(globalThis.localStorage?.getItem(JETZT_FREI_SPEICHER) || '[]'); } catch { gefragt = []; }
    if (!Array.isArray(gefragt)) gefragt = [];
    if (gefragt.includes(schluessel)) return;
    try { globalThis.localStorage?.setItem(JETZT_FREI_SPEICHER, JSON.stringify([...gefragt, schluessel].slice(-20))); } catch { /* privates Fenster */ }
    if (repo.getFreeState()?.active || ui.freiHinweis) return;
    ui.freiHinweis = { art: 'jetztFrei', zeit: uhrzeitText(new Date(ende)), schluessel };
    if (document.querySelector('#free-button')) ctx.render();
  }).catch(() => {});
}

// Wer die App aus dem Hintergrund holt, „öffnet" sie auch — dann wird noch einmal geschaut.
let crewAnsicht = null;
let crewSichtbarLauscher = false;
function crewBeimZurueckkommen(ctx) {
  crewAnsicht = ctx;
  if (crewSichtbarLauscher || !globalThis.document?.addEventListener) return;
  crewSichtbarLauscher = true;
  document.addEventListener('visibilitychange', () => {
    if (document.visibilityState !== 'visible' || !crewAnsicht) return;
    if (crewAnsicht.nav?.current?.()?.id !== 'crew.home') return;
    crewAnsicht.ui.jetztFreiGeprueft = false;
    jetztFreiPruefen(crewAnsicht);
  });
}

// G3d — `aktion=frei` in der Adresse (aus sw.js „Ich auch") oder in den Routen-Parametern.
// Einmal je Seitenaufruf; danach verschwindet sie aus der Adresse, damit Neuladen nichts wiederholt.
let aktionErledigt = false;
function aktionAusAdresse(ctx) {
  if (aktionErledigt) return null;
  let aktion = ctx.params?.aktion || null;
  try { aktion = aktion || new URLSearchParams(globalThis.location?.search || '').get('aktion'); } catch { /* ohne Adresse */ }
  if (aktion !== 'frei') return null;
  aktionErledigt = true;
  try {
    const adresse = new URL(globalThis.location.href);
    adresse.searchParams.delete('aktion');
    const params = adresse.searchParams.get('params');
    if (params) {
      const werte = JSON.parse(params);
      if (werte && typeof werte === 'object' && 'aktion' in werte) {
        delete werte.aktion;
        adresse.searchParams.set('params', JSON.stringify(werte));
      }
    }
    globalThis.history?.replaceState?.(globalThis.history.state, '', `${adresse.pathname}${adresse.search}${adresse.hash}`);
  } catch { /* dann bleibt sie stehen — aktionErledigt verhindert trotzdem eine Wiederholung */ }
  return aktion;
}

function ichAuchFrei(ctx) {
  const free = ctx.repo.getFreeState();
  // Keine Rückmeldung hier: Die Seite ist eben erst geladen (aus der Mitteilung), der Browser
  // verweigert vor einer Berührung die Vibration — gebrummt hat die Mitteilung selbst.
  if (!free?.active || free.pending) ctx.repo.setFree({});
  nachFreiWerden(ctx);
  ctx.render();
}

// C2 — Freundschaftsanfragen stark sichtbar oben in der Crew-Liste, direkt beantwortbar.
// Ablehnen fragt einmal nach: eine abgelehnte Anfrage lässt sich nicht zurückholen.
const ANFRAGE_KNOPF = "flex:none;height:36px;padding:0 16px;border-radius:999px;font:650 13px/1 'Instrument Sans',sans-serif;cursor:pointer;appearance:none;white-space:nowrap";

function anfragenKarte(ctx) {
  const { repo, ui } = ctx;
  const anfragen = (typeof repo.getFriendRequests === 'function' ? repo.getFriendRequests() : null) || [];
  if (!anfragen.length) return '';
  const sichtbar = anfragen.slice(0, 3);
  const zeilen = sichtbar.map((anfrage, index) => {
    const trenner = index ? 'border-top:1px solid var(--ink-a07);' : '';
    const id = esc(anfrage.id);
    if (ui.anfrageAblehnen === anfrage.id) {
      return `<div data-role="anfrage" data-anfrage="${id}" data-zustand="ablehnen" style="display:flex;flex-direction:column;gap:10px;padding:13px 14px;${trenner}">
<span style="font-size:13.5px;font-weight:600;line-height:1.35">${esc(tx('Anfrage von {name} ablehnen?', { name: anfrage.name }))}</span>
<span style="display:flex;gap:8px">
<button data-act="anfrage-ablehnen-nein" data-anfrage="${id}" data-treffer style="${ANFRAGE_KNOPF};border:1px solid var(--ink-a14);background:var(--surface);color:var(--ink-soft)"><span style="pointer-events:none">${tx('Abbrechen')}</span></button>
<button data-act="anfrage-ablehnen-ja" data-anfrage="${id}" data-treffer style="${ANFRAGE_KNOPF};border:0;background:var(--red);color:var(--on-accent)"><span style="pointer-events:none">${tx('Ablehnen')}</span></button>
</span></div>`;
    }
    const avatar = personAvatar({ id: anfrage.id, name: anfrage.name, initials: anfrage.initials, color: anfrage.color, photo: anfrage.photo || null }, { size: 44, fontSize: 15, free: false, active: false, dotBorder: 'var(--surface)' });
    return `<div data-role="anfrage" data-anfrage="${id}" style="display:flex;gap:12px;padding:13px 14px;${trenner}">
<span style="display:flex;flex:none">${avatar}</span>
<div style="flex:1;min-width:0;display:flex;flex-direction:column;gap:2px">
<span style="font-size:15px;font-weight:650;letter-spacing:-.01em;white-space:nowrap;overflow:hidden;text-overflow:ellipsis">${esc(anfrage.name)}</span>
${anfrage.meta ? `<span style="font-size:12px;color:var(--muted);white-space:nowrap;overflow:hidden;text-overflow:ellipsis">${esc(anfrage.meta)}</span>` : ''}
<span style="display:flex;gap:8px;margin-top:9px">
<button data-act="anfrage-annehmen" data-anfrage="${id}" data-treffer style="${ANFRAGE_KNOPF};border:0;background:var(--green);color:var(--on-accent)"><span style="pointer-events:none">${tx('Annehmen')}</span></button>
<button data-act="anfrage-ablehnen" data-anfrage="${id}" data-treffer style="${ANFRAGE_KNOPF};border:1px solid var(--ink-a14);background:var(--surface);color:var(--ink-soft)"><span style="pointer-events:none">${tx('Ablehnen')}</span></button>
</span></div></div>`;
  }).join('');
  const mehr = anfragen.length > sichtbar.length
    ? `<button data-act="anfragen-alle" style="display:flex;align-items:center;justify-content:space-between;width:100%;min-height:44px;padding:0 14px;border:0;border-top:1px solid var(--ink-a07);background:transparent;font:650 13px/1 'Instrument Sans',sans-serif;color:var(--ink-soft);cursor:pointer;appearance:none"><span style="pointer-events:none">${esc(tx('Alle {n} Anfragen', { n: anfragen.length }))}</span><span style="pointer-events:none;display:flex">${chevronRight('var(--line-strong)', 15)}</span></button>`
    : '';
  return `<div data-role="anfragen-karte" style="background:var(--surface);border-radius:18px;border:1px solid var(--orange-a28);box-shadow:0 1px 2px var(--shadow-05);overflow:hidden;font-family:'Instrument Sans',sans-serif;color:var(--ink)">
<div style="display:flex;align-items:center;gap:8px;padding:12px 14px 0">
<span style="display:flex;pointer-events:none">${symbol('personPlus', 'var(--orange-dark)', 17)}</span>
<span style="flex:1;min-width:0;font-size:13px;font-weight:650;letter-spacing:-.005em">${tx('Freundschaftsanfragen')}</span>
${orangeZahl(anfragen.length)}
</div>
${zeilen}${mehr}</div>`;
}

function anfragenAktionen(ctx) {
  const { repo, ui, nav } = ctx;
  const finde = (id) => (repo.getFriendRequests?.() || []).find((eintrag) => eintrag.id === id);
  return {
    'anfrage-annehmen': (data) => {
      const anfrage = finde(data.anfrage);
      if (!anfrage) return;
      rueckmeldung('erfolg');
      Promise.resolve(repo.acceptFriendRequest(anfrage.id)).catch(() => {});
      // Derselbe Wortlaut wie in Profil → Anfragen.
      const vorname = String(anfrage.name || '').split(' ')[0];
      ctx.toast?.(vorname ? tx('{name} ist jetzt dein Freund', { name: vorname }) : tx('Anfrage angenommen'));
    },
    'anfrage-ablehnen': (data) => { rueckmeldung('tipp'); ui.anfrageAblehnen = data.anfrage; ctx.render(); },
    'anfrage-ablehnen-nein': () => { ui.anfrageAblehnen = null; ctx.render(); },
    'anfrage-ablehnen-ja': (data) => {
      const anfrage = finde(data.anfrage);
      ui.anfrageAblehnen = null;
      if (!anfrage) { ctx.render(); return; }
      rueckmeldung('zurueck');
      Promise.resolve(repo.declineFriendRequest(anfrage.id)).catch(() => {});
      ctx.toast?.(tx('Anfrage abgelehnt'));
    },
    'anfragen-alle': () => nav.go('profile.friendRequests'),
  };
}

function temporaereRaeume(ctx) {
  const { repo, ui } = ctx;
  const settings = repo.getSettings();
  const meets = repo.getMeets().filter((meet) => meet.roomId && (meet.personIds || []).length > 1);
  if (!meets.length) return '';

  const neu = new Map(meets.map((meet) => [meet.id, neuImRaum(repo, meet.roomId)]));
  const neuGesamt = [...neu.values()].reduce((summe, eintrag) => summe + eintrag.zahl, 0);
  // Der Kopf nennt den Raum mit der jüngsten neuen Nachricht.
  const juengster = meets.filter((meet) => neu.get(meet.id).zahl > 0).slice(-1)[0] || null;

  const offen = Boolean(ui.tempRaeume);
  const zeilen = offen ? meets.map((meet) => {
    const leute = (meet.personIds || []).map((id) => repo.getPerson(id)).filter(Boolean);
    const { zahl, letzte } = neu.get(meet.id);
    const wann = meet.status === 'active'
      ? tx('läuft gerade')
      : `${formatMeetDate(meet.date)}${meet.time ? ` · ${meet.time}` : ''}`;
    const unterzeile = zahl
      ? `<span style="font-size:11.5px;font-weight:600;color:var(--ink-soft);white-space:nowrap;overflow:hidden;text-overflow:ellipsis">${esc(vorschauText(repo, letzte))}</span>`
      : `<span style="font-size:11.5px;font-weight:500;color:${meet.status === 'active' ? 'var(--green-dark)' : 'var(--muted)'};white-space:nowrap;overflow:hidden;text-overflow:ellipsis">${esc(wann)}</span>`;
    return `<button data-act="open-temp-room" data-room="${esc(meet.roomId)}" style="display:flex;align-items:center;gap:10px;width:100%;padding:8px 13px 8px 12px;border:0;border-top:1px solid var(--ink-a07);background:transparent;text-align:left;appearance:none;cursor:pointer;font-family:'Instrument Sans',sans-serif;color:var(--ink)">
${mitgliederStapel(leute, { size: 20, max: 3, settings })}
<span style="flex:1;min-width:0;display:flex;flex-direction:column;gap:1px;pointer-events:none">
<span style="font-size:13.5px;font-weight:${zahl ? 700 : 600};letter-spacing:-.01em;white-space:nowrap;overflow:hidden;text-overflow:ellipsis">${esc(meet.title)}</span>
${unterzeile}
</span>
${zahl ? orangeZahl(zahl) : ''}
<span style="display:flex;flex:none;pointer-events:none">${chevronRight('var(--line-strong)', 15)}</span></button>`;
  }).join('') : '';

  const kopfVorschau = !offen && juengster
    ? `<span data-role="temp-vorschau" style="display:block;font-size:11.5px;font-weight:550;color:var(--ink-soft);white-space:nowrap;overflow:hidden;text-overflow:ellipsis;pointer-events:none">${esc(`${juengster.title} · ${vorschauText(repo, neu.get(juengster.id).letzte)}`)}</span>`
    : '';

  return `<div style="padding:2px 24px 0">
<div style="background:var(--surface);border-radius:16px;border:1px solid ${neuGesamt ? 'var(--orange-a28)' : 'var(--ink-a07)'};overflow:hidden">
<button data-act="temp-raeume" aria-expanded="${offen}" style="display:flex;align-items:center;gap:8px;width:100%;min-height:44px;box-sizing:border-box;padding:10px 13px 10px 14px;border:0;background:transparent;text-align:left;appearance:none;cursor:pointer;font-family:'Instrument Sans',sans-serif;color:var(--ink)">
<span style="flex:1;min-width:0;display:flex;flex-direction:column;gap:1px;pointer-events:none"><span style="font-size:13px;font-weight:650;letter-spacing:-.01em">${tx('Temporäre Räume')}</span>${kopfVorschau}</span>
${neuGesamt ? orangeZahl(neuGesamt) : `<span style="flex:none;font-size:11.5px;font-weight:600;color:var(--muted);pointer-events:none">${meets.length}</span>`}
<span style="display:flex;flex:none;pointer-events:none">${offen ? chevronDown('var(--muted-light)', 13) : chevronRight('var(--muted-light)', 14)}</span></button>
${zeilen}</div></div>`;
}

// Zeitpunkt der jüngsten Nachricht oder des jüngsten Anstupsers im 1:1-Chat (ms, 0 = nie).
// Nachrichten tragen Datum und Uhrzeit getrennt (repository.js: date 'YYYY-MM-DD', time 'H:MM').
function letzteChatAktivitaet(repo, personId) {
  const raum = repo.getRoomForPerson?.(personId);
  let zeit = 0;
  for (const nachricht of raum?.messages || []) {
    if (nachricht.kind !== 'text' && nachricht.kind !== 'nudge') continue;
    let wann = Number(new Date(nachricht.at || nachricht.createdAt || 0)) || 0;
    if (!wann && nachricht.date) {
      const [stunde, minute] = String(nachricht.time || '0:00').split(':').map(Number);
      const tag = new Date(`${nachricht.date}T00:00:00`);
      tag.setHours(stunde || 0, minute || 0, 0, 0);
      wann = tag.getTime() || 0;
    }
    if (wann > zeit) zeit = wann;
  }
  return zeit;
}

// v4 A.4 / COMPONENT_RULES 1: gemeinsame Kopfachse aller Tab-Wurzeln (tabHeader).
function header(view) {
  return tabHeader(
    `<span style="font-family:'Bricolage Grotesque',sans-serif;font-size:22px;font-weight:650">crew<span style="color:var(--green)">.</span></span>`,
    iconSwitch([
      { act: 'crew-view', data: { view: 'list' }, svg: listIcon(view === 'list' ? 'var(--ink)' : 'var(--muted-light)'), active: view === 'list' },
      { act: 'crew-view', data: { view: 'map' }, svg: mapIcon(view === 'map' ? 'var(--ink)' : 'var(--muted-light)'), active: view === 'map' },
    ]),
  );
}

function listBody(ctx) {
  const { repo } = ctx;
  const settings = repo.getSettings();
  const crews = repo.getCrews();
  const people = repo.getPeople();

  // COMPONENT_RULES 2 + v5 A32e: Aktive Meets stehen in horizontalen Reihen zuerst links,
  // danach die beliebteren Gruppen. „Beliebt" ist hier keine erfundene Kennzahl, sondern
  // das, was wirklich in den Daten steht: erst eine laufende Verabredung, dann wie viele
  // Mitglieder gerade frei sind, dann die Größe der Gruppe. Gleichstand behält die
  // ursprüngliche Reihenfolge (stabile Sortierung).
  const beliebtheit = (crew) => [
    crewMeta(repo, crew).activeMeet ? 0 : 1,
    -(crew.freeCount || 0),
    -(crew.memberIds?.length || 0),
  ];
  const crewOrder = [...crews].sort((a, b) => {
    const ra = beliebtheit(a);
    const rb = beliebtheit(b);
    for (let i = 0; i < ra.length; i += 1) if (ra[i] !== rb[i]) return ra[i] - rb[i];
    return 0;
  });

  const cards = crewOrder.map((crew) => {
    // Avatare wie in der Referenz: andere zuerst, ich zuletzt (See & Chill zeigt „Jo" an dritter Stelle).
    // Runde 4 (E6): Unter den anderen stehen die Freien vorn — der Stapel zeigt nur drei, und
    // gerade die mit grünem Punkt sollen sichtbar sein. Sonst bleibt die Reihenfolge der Daten.
    const istFrei = (person) => Boolean(person?.free?.active && !person.activeMeetId);
    const andere = crew.memberIds.filter((id) => id !== ME).map((id) => repo.getPerson(id)).filter(Boolean);
    const members = [...andere.filter(istFrei), ...andere.filter((person) => !istFrei(person)), repo.getPerson(ME)].filter(Boolean);
    const { meta, activeMeet } = crewMeta(repo, crew);
    return crewKarte(crew, members, { meta, activeMeet, settings, frei: crew.freeCount || 0 });
  }).join('');

  // Reihenfolge ist Relevanz (reference 04.1): offene Aktion → aktives Meet → frei → Übrige.
  // Fable 4 (J3): Der Frei-Punkt folgt überall derselben Regel (personAvatar: frei = Punkt).
  // Die Frei-Hinweise bleiben eine Empfangs-Einstellung für Benachrichtigungen und den Rang.
  //
  // v5 A32e: Darüber liegt jetzt eine erste Stufe — beste Freund:innen und die besondere
  // Person stehen oben. Das ändert NICHTS an der Privatsphäre der Markierungen: sie sind
  // ohnehin nur für mich sichtbar, und die Reihenfolge steht nur in meiner eigenen Liste.
  //
  // v5 A31c: „Frei-Hinweise" ist eine EMPFANGS-Einstellung. Wenn ich selbst frei bin,
  // sehen das ALLE meine Freund:innen — das regelt sie nicht. Sie regelt nur, von wem ich
  // selbst einen Hinweis bekommen möchte: nur diese Personen zeigen mir ihren grünen
  // Frei-Punkt und rücken deswegen in meiner Liste nach oben. Vorher wurde die
  // Einstellung nirgends gelesen und war damit folgenlos.
  // v6 A01: Die Markierung ist DREISTUFIG, nicht zweistufig. Vorher lagen die besondere
  // Person und die besten Freund:innen in EINEM Set mit demselben Rang; wer innerhalb
  // dieser Gruppe oben stand, entschied dann nur noch der Relevanzrang und bei Gleichstand
  // die Seed-Reihenfolge — die besondere Person landete dadurch hinter beiden besten
  // Freund:innen. Jetzt gilt: besondere Person (0) → beste Freund:innen (1) → übrige (2).
  // Die Reihenfolge INNERHALB einer Gruppe bleibt unverändert der bestehende rank().
  //
  // Runde 3 (O3, Jonathan): „Ich habe eine Benachrichtigung von Ben, er ist relativ weit oben.
  // Wenn ich draufdrücke und rausgehe, ist er ganz unten. Extremst komisch. Nur die besondere
  // Person ist immer ganz oben; alle anderen nach Aktivität — wer zuletzt geschrieben oder
  // angestupst hat, steht oben." Die Stufe „Ungelesen" hing an einem Zustand, den das Öffnen
  // löscht — deshalb sprang Ben. Jetzt zählt, wann im gemeinsamen Chat zuletzt etwas passiert
  // ist (Nachricht oder Anstupser, von wem auch immer). Das ändert sich beim Lesen nicht.
  // Wer noch nie geschrieben hat, folgt danach in der bisherigen Relevanz (aktives Meet, frei).
  const specialId = settings.specialPerson?.personId || null;
  const hints = settings.freiHints || { mode: 'niemand', customIds: [] };
  const freiHinweisVon = (person) => {
    if (hints.mode === 'alle') return true;
    if (hints.mode === 'beste') return (settings.bestFriendIds || []).includes(person.id);
    if (hints.mode === 'individuell') return (hints.customIds || []).includes(person.id);
    return false;
  };
  const aktivitaet = new Map(people.map((person) => [person.id, letzteChatAktivitaet(repo, person.id)]));
  const rank = (person) => (person.unread ? 0 : person.activeMeetId ? 1 : (person.free?.active && freiHinweisVon(person)) ? 2 : 3);
  const sorted = [...people].sort((a, b) => {
    const besondersA = a.id === specialId ? 0 : 1;
    const besondersB = b.id === specialId ? 0 : 1;
    if (besondersA !== besondersB) return besondersA - besondersB;
    const zeitA = aktivitaet.get(a.id) || 0;
    const zeitB = aktivitaet.get(b.id) || 0;
    if (zeitA !== zeitB) return zeitB - zeitA;
    return rank(a) - rank(b);
  });

  // Auftrag §3.3: Ohne Freunde keine Crew. Statt „Neue Crew" steht dort der Hinweis,
  // zuerst Freunde hinzuzufügen — in einer Kachel derselben Größe, damit nichts springt.
  // Runde 2 (Jonathan): Ohne Freunde gibt es KEINEN Knopf zum Crew-Erstellen — auch keinen
  // Hinweis-Knopf an seiner Stelle. Der eine Weg ist „Freunde hinzufügen" darunter.
  const hatFreunde = people.length > 0;
  const kachel = hatFreunde ? newCrewCard() : '';

  // Kurz: ein Satz, ein Knopf. Der Knopf führt direkt zum QR-Code.
  const personen = hatFreunde
    ? sorted.map((person) => {
      // Runde 5 (G3b): Wer frei ist und eine Lust gewählt hat, zeigt „frei · Lust auf Kaffee" in Grün.
      const lust = freiMitLust(person);
      if (lust) return personRow(person, settings, { status: tx('frei · {lust}', { lust: lust.satz }), statusArt: 'frei' });
      const belegt = belegtHinweisFuer(ctx, person);
      return personRow(person, settings, belegt ? { status: belegt, statusArt: 'belegt' } : {});
    }).join('')
    : leerZeile({
      text: tx('Noch keine Freunde'),
      aktLabel: tx('Freunde hinzufügen'),
      act: 'go-friend-add',
    });

  // E4: Der Bewertungshinweis steht über der Freundesliste. Ohne passendes Meet ist er leer —
  // dann entsteht auch kein Abstand, und nichts verschiebt sich.
  // Angesehen: Mit 20 px stand die Karte 4 px breiter als der Kasten „Temporäre Räume" direkt
  // darüber und die Freundesliste darunter (beide 24 px) — deshalb dieselbe Flucht.
  const hinweis = bewertungsHinweis(ctx, { margin: '0 24px 10px' });
  // Runde 5 (C2, G1): Ganz oben, was eine Antwort braucht — offene Freundschaftsanfragen — und
  // darunter ruhig „Mitteilungen aufs Handy", solange Mitteilungen auf diesem Gerät aus sind.
  const oben = [anfragenKarte(ctx), mitteilungsKarte(ctx)].filter(Boolean);
  const obenHtml = oben.length
    ? `<div data-role="crew-oben" style="display:flex;flex-direction:column;gap:10px;padding:10px 24px 0">${oben.join('')}</div>`
    : '';
  return `${obenHtml}${edgeFadeRow(`${cards}${kachel}`, { gap: 10, padY: '14px 0 6px', scrollKey: 'crew-strip' })}
${temporaereRaeume(ctx)}
${hinweis ? `<div style="padding-top:10px">${hinweis}</div>` : ''}
<div style="padding:${hinweis ? 0 : 10}px 24px 0">
${personen}
</div>`;
}

// Auftrag §5.1: In der Crew-Ansicht fehlte die Karte GANZ. Was hier stand, war eine
// gezeichnete Fläche mit fünf festen Pin-Positionen — die Leute standen also an erfundenen
// Stellen, unabhängig davon, wo sie wirklich sind. Jetzt dieselbe echte Karte wie im
// Meet-Bereich (MapLibre, freie OSM-Daten), und darauf NUR, was wirklich bekannt ist:
// das eigene Zuhause und die Zuhause der Freunde, die es geteilt haben.
//
// Wer keinen Ort geteilt hat, steht nicht auf der Karte. Eine Person an eine ausgedachte
// Stelle zu setzen wäre schlimmer als sie wegzulassen.
// Runde 4 (D7, Jonathan): „Ich kann meine Location nicht teilen bzw. sie wird auf der Karte nicht
// angezeigt." Gemessen: Die Karte las nur Zuhause-Orte (homeAddress, getPersonPlace) — einen
// geteilten Standort gab es in den Daten gar nicht. Seit Chefs Datenteil tragen Personen
// `person.standort = { lat, lon, at }` (nur wenn sie ihn mit mir teilen) und die Einstellungen die
// eigene Lage `settings.standort`. Freunde stehen NUR an ihrem geteilten Standort (Chef, Datenschutz):
// Ihr Zuhause-Ort (personPlaces) ist eine Meet-Adresse, die erst nach Zustimmung für EIN Meet gilt —
// ihn auf der Crew-Karte zu zeigen hieße, eine Wohnadresse ohne Einwilligung zu verraten.
function koordinaten(ort) {
  return ort && Number.isFinite(Number(ort.lat)) && Number.isFinite(Number(ort.lon)) && ort.lat !== null && ort.lon !== null
    ? { lat: Number(ort.lat), lon: Number(ort.lon) }
    : null;
}

function kartenPunkte(ctx) {
  const { repo } = ctx;
  const settings = repo.getSettings();
  const punkte = [];
  // Runde 5 (D4): Wo ich bin, sagt EINE Stelle — repo.getMyLocation() (Gerät, sonst geteilter Standort).
  // Dieselbe Lage zeigt jede andere Karte als blauen Punkt; hier stehe ich als Person („Du"), und der
  // Punkt entfällt (ui/map.js › personenMarken mit ich: true). Ohne Freigabe bleibt es beim Zuhause.
  const lage = typeof repo.getMyLocation === 'function' ? repo.getMyLocation() : null;
  const eigenLive = lage && lage.quelle !== 'zuhause' ? koordinaten(lage)
    : (settings.location?.use ? koordinaten(settings.standort) : null);
  const eigen = eigenLive || koordinaten(settings.homeAddress);
  if (eigen) {
    punkte.push({ id: ME, person: repo.getMe(), ort: { name: tx('Du'), ...eigen }, ich: true, live: Boolean(eigenLive) });
  }
  for (const person of repo.getPeople()) {
    const ort = koordinaten(person.standort);
    if (!ort) continue;
    punkte.push({ id: person.id, person, ort, live: true });
  }
  return punkte;
}

function mapBody(ctx) {
  const settings = ctx.repo.getSettings();
  // Runde 4 (D6): Wer weiter südlich steht, liegt auf dem Bild weiter unten und damit obenauf;
  // ich selbst liege immer ganz oben. Überlappen ist erlaubt — nichts wird weggeschoben.
  const punkte = kartenPunkte(ctx).sort((a, b) => (a.ich ? 1 : 0) - (b.ich ? 1 : 0) || b.ort.lat - a.ort.lat);
  const anker = punkte.map(({ id, person, ort, ich }) => {
    const aktiv = Boolean(person?.activeMeetId);
    const frei = person?.free?.active && !aktiv;
    const marker = ich ? null : personMarker(id, settings);
    return `<button data-act="${ich ? 'noop' : 'open-person'}" data-person="${esc(id)}" data-anchor="${esc(id)}" data-lat="${ort.lat}" data-lon="${ort.lon}" style="position:absolute;left:0;top:0;transform:translate(-50%,-50%);display:flex;align-items:center;gap:8px;background:var(--surface);border-radius:999px;padding:5px 12px 5px 5px;box-shadow:0 6px 16px var(--shadow-18);border:0;cursor:pointer;appearance:none;font-family:'Instrument Sans',sans-serif;color:var(--ink);white-space:nowrap">
<span style="pointer-events:none;display:contents">${personAvatar(person || { name: tx('Du'), initials: settings.initials, color: settings.color, photo: settings.photo }, { size: 28, fontSize: 11, active: aktiv, free: frei, dotBorder: 'var(--surface)', marker })}</span>
<span data-role="anker-name" style="font-size:12.5px;font-weight:650;pointer-events:none">${esc(ich ? tx('Du') : person.name)}</span></button>`;
  }).join('');

  // Runde 2 (Jonathan): Der lange Hinweis lag UNTER dem Frei-Knopf und war dort nicht zu
  // lesen. Jetzt steht oben, kurz und nur wenn nötig, was fehlt: ein Satz, solange keine
  // Freunde auf der Karte stehen, und ein Knopf zum Standort, solange man ihn nicht teilt.
  const freundeDrauf = punkte.some((punkt) => !punkt.ich);
  // Runde 4 (D7): „Standort teilen" bleibt sichtbar, solange er mit niemandem geteilt wird — vorher
  // verschwand der Hinweis schon beim Einschalten, obwohl „Teilen mit: Niemand" eingestellt war.
  const standortAus = !settings.location?.use || settings.location?.shareMode === 'niemand';
  const pillen = [
    freundeDrauf ? '' : `<span data-ueber-karte style="background:var(--surface);border-radius:999px;padding:8px 13px;box-shadow:0 4px 14px var(--shadow-14);font:600 12.5px/1 'Instrument Sans',sans-serif;color:var(--ink-soft);white-space:nowrap">${tx('Keine Freunde auf der Karte')}</span>`,
    standortAus ? `<button data-act="go-location" data-treffer data-ueber-karte style="background:var(--surface);border-radius:999px;padding:8px 13px;box-shadow:0 4px 14px var(--shadow-14);font:600 12.5px/1 'Instrument Sans',sans-serif;color:var(--ink-soft);white-space:nowrap;pointer-events:auto;border:0;cursor:pointer;appearance:none;display:flex;align-items:center;gap:6px;color:var(--green-dark)"><span style="pointer-events:none;display:flex">${symbol('ort', 'var(--green-dark)', 14)}</span><span style="pointer-events:none">${tx('Standort teilen')}</span></button>` : '',
  ].filter(Boolean).join('');
  // Unter der oberen weichen Kante (26 px), damit nichts halb ausgeblendet steht.
  const hinweis = pillen
    ? `<div data-role="crew-map-hinweis" style="position:absolute;left:0;right:0;top:34px;z-index:5;display:flex;justify-content:center;gap:8px;flex-wrap:wrap;padding:0 16px;pointer-events:none">${pillen}</div>`
    : '';

  return `<div data-act="crew-map-noop" data-map-viewport="crew" data-hdrag="karte" style="height:100%;position:relative;background:var(--field);overflow:hidden">
<div data-fremd="1" data-role="crew-map" style="position:absolute;inset:0"></div>
<div data-role="crew-map-anker" style="position:absolute;inset:0;pointer-events:none">
<div style="position:absolute;inset:0">${anker}</div>
</div>
${hinweis}
</div>`;
}

// Die Kacheln liegen ÜBER der Karte und werden bei jeder Bewegung an ihre Stelle gerechnet.
// Dieselbe Bauweise wie im Meet-Bereich: Die App zeichnet ihre Kacheln selbst, die Karte
// liefert nur die Stelle.
function bindCrewKarte(root, ctx) {
  const knoten = root.querySelector('[data-role="crew-map"]');
  if (!knoten) return;
  const anker = [...root.querySelectorAll('[data-anchor][data-lat]')];
  const orte = anker.map((el) => ({ lat: Number(el.dataset.lat), lon: Number(el.dataset.lon) }));
  import('../ui/map.js').then(async ({ karteHalten, passeAufPunkte, startAnsicht, personenMarken, kartenLageQuelle, bedienSpalteOrdnen }) => {
    // Runde 2: Ohne Freunde mit Ort fängt die Karte beim eigenen Zuhause oder im eigenen
    // Land an — nicht mehr fest in Bregenz. Dazu der Höhenregler.
    kartenLageQuelle?.(ctx.repo);
    const start = startAnsicht(ctx.repo.getSettings());
    const karte = await karteHalten(knoten, 'crew-karte', { mitte: start.mitte, zoom: start.zoom, folgen: false, hoehenRegler: true });
    if (!karte) return;
    // Runde 4 (D6): Sobald P3s gemeinsamer Personen-Baustein da ist, zeichnet ER die Personen —
    // dieselbe Regel auf jeder Karte. Die eigenen Anker bleiben dann unsichtbar im Markup stehen.
    if (typeof personenMarken === 'function') {
      root.querySelector('[data-role="crew-map-anker"]')?.setAttribute('data-baustein', '1');
      const settings = ctx.repo.getSettings();
      const punkte = kartenPunkte(ctx).sort((a, b) => (b.ich ? 1 : 0) - (a.ich ? 1 : 0) || a.ort.lat - b.ort.lat);
      personenMarken(karte, { schluessel: 'crew' }).setzen(punkte.map(({ id, person, ort, ich }) => {
        const aktiv = Boolean(person?.activeMeetId);
        return {
          id, lat: ort.lat, lon: ort.lon, ich: Boolean(ich),
          name: ich ? tx('Du') : person.name,
          bild: personAvatar(person || { name: tx('Du'), initials: settings.initials, color: settings.color, photo: settings.photo },
            { size: 32, fontSize: 12, active: aktiv, free: Boolean(person?.free?.active && !aktiv), dotBorder: 'var(--surface)', marker: ich ? null : personMarker(id, settings) }),
          attrs: ich ? '' : `data-act="open-person" data-person="${esc(id)}"`,
        };
      }));
      // Runde 5 (D5): Liegen Personen am selben oder fast selben Ort (auch ich), zeigt der Baustein sie als
      // Stapel mit Zahl; ein Tipp fächert auf. D3: Die Hinweis-Pillen oben tragen data-ueber-karte.
      bedienSpalteOrdnen?.(karte);
      if (!karte.__crewStart) {
        karte.__crewStart = true;
        karte.once('load', () => passeAufPunkte(karte, orte, { padding: 90, maxZoom: 14 }));
      }
      return;
    }
    // Runde 4 (D6, Jonathan): „Personen-Standorte: exakte Lage, dürfen überlappen, nichts schiebt
    // sich weg (Person in Italien); weit rausgezoomt nur Profilbilder, überlappend." Vorher wurden
    // die Kacheln entstapelt — wer einer anderen zu nahe kam, rutschte darunter, bei weitem Zoom um
    // Hunderte Kilometer. Jetzt steht jede Person genau an ihrem Punkt. Unter Zoom 9 zeigt die
    // Karte nur noch das Profilbild (data-kompakt), damit überlappende Namen nicht zur Wand werden.
    // Bis P3s gemeinsamer Personen-Baustein da ist, lebt diese Regel hier.
    const ebene = root.querySelector('[data-role="crew-map-anker"]');
    const stellen = () => {
      const kompakt = karte.getZoom() < 9 ? '1' : '0';
      if (ebene && ebene.getAttribute('data-kompakt') !== kompakt) ebene.setAttribute('data-kompakt', kompakt);
      for (const el of anker) {
        const p = karte.project([Number(el.dataset.lon), Number(el.dataset.lat)]);
        el.style.transform = `translate(${Math.round(p.x)}px, ${Math.round(p.y)}px) translate(-50%,-50%)`;
      }
    };
    if (!karte.__crewStart) {
      karte.__crewStart = true;
      karte.once('load', () => { passeAufPunkte(karte, orte, { padding: 90, maxZoom: 14 }); stellen(); });
    }
    karte.on('move', stellen);
    karte.on('zoom', stellen);
    stellen();
  }).catch(() => {});
}

function renderCrewHome(ctx) {
  const { repo, ui } = ctx;
  const view = ui.view || 'list';
  const free = repo.getFreeState();

  // v4 P0-2d/P0-2e: Zustandswechsel am Frei-Knopf werden als benannte CSS-Animation
  // gerendert (freiKreis). Damit der Übergang mehrere Renders in Folge überlebt — Tap löst
  // setFree → notify → render, danach Toast → render und zuletzt ctx.render() aus — merkt
  // sich der Tab-UI-Zustand den VORHERIGEN Look samt Startzeitpunkt; die Animation läuft
  // per negativem Delay an derselben Stelle weiter, statt bei jedem Render neu zu springen.
  const look = free?.active ? (free.pending && free.fromAt ? 'pending' : 'active') : 'idle';
  const now = Date.now();
  if (ui.freeLook && ui.freeLook !== look) ui.freeSwap = { from: ui.freeLook, at: now };
  ui.freeLook = look;
  const swap = ui.freeSwap && now - ui.freeSwap.at < FREI_ANIM_MS ? ui.freeSwap : null;
  const anim = swap ? { from: swap.from, elapsed: now - swap.at, ms: FREI_ANIM_MS } : null;

  const minutesLeft = look === 'pending' ? minutesUntil(free.fromAt) : 0;
  const caption = look === 'pending' ? freiCaption(free, minutesLeft) : '';

  // Bottom-Ebene: Frei-Steuerung und Bottom-Navigation liegen ÜBER der Scrollfläche;
  // der Inhalt läuft sichtbar darunter durch und bleibt per bottomInset erreichbar.
  // v4 P0-5: Der Träger ist durchsichtig UND durchlässig — nur der Frei-Knopf selbst ist
  // ein reales Element (er trägt pointer-events:auto, siehe freiKreis). Vorher lag hier eine
  // 390x112 große Fläche mit background:var(--paper-a90) und pointer-events:auto: sie hat
  // den Inhalt zu 95% ausgelöscht und Klicks auf die darunterliegende Personenzeile abgefangen.
  // v4 P0-1: Die Bottom-Navigation steht jetzt in der App-Chrome (app.js).
  // Runde 5 (G3): Über dem Knopf der durchlässige Frei-Hinweis, rechts daneben die Lust, solange man
  // frei ist. Beides verschiebt den Knopf nicht: die untere Ebene wächst nach oben, die Reihe mit
  // FREE bleibt, wo sie ist. Während des Haltens liegt nur der Zeitring da.
  if (look !== 'active') ui.lustSheet = false;
  freiBekanntAbgleichen(ctx, look);
  const holding = Boolean(ui.hold?.holding);
  const bottom = `${holding ? '' : freiHinweisHtml(ctx, free)}<div style="pointer-events:none;height:26px"></div>
<div style="pointer-events:none;position:relative;display:flex;align-items:center;justify-content:center;height:112px">${freiKreis(free, { hidden: holding, anim, caption })}${look === 'active' && !holding ? lustPilleHtml(free) : ''}</div>`;

  const html = screenScaffold({
    page: true,
    header: header(view),
    body: view === 'map' ? mapBody(ctx) : listBody(ctx),
    bottom,
    // v5 A22: In der Kartenansicht gibt es keinen Auslauf — die Karte fuellt den Rahmen.
    bottomInset: view === 'map' ? 0 : 138,
    headerFade: view !== 'map',
    // Runde 3 (O2): Die Liste blendet an der Navigation aus; FREE schwebt darüber.
    bottomFadeHeight: view === 'map' ? 0 : 30,
    untenSchwebend: view !== 'map',
    // Runde 3 (D5): „Freund hinzufügen" als Sheet über der Crew-Seite.
    overlays: `${freiHoldOverlay(ui.hold)}${ui.lustSheet ? lustSheetHtml(ctx) : ''}${ctx.freundHinzufuegen?.overlay(ctx) || ''}`,
    scrollKey: `crew-${view}`,
  });

  return { html, bind: bindCrewHome };
}

function bindCrewHome(root, ctx) {
  const { repo, nav, ui } = ctx;
  // Runde 5: Das Binden läuft bei jedem Render — alles hier ist deshalb einmalig bzw. billig.
  mitteilungenBeobachten(ctx);      // G2: Ankunft hören (einmal je Repository, danach app-weit)
  pushLageAuffrischen(ctx);         // G1: Zustand dieses Geräts einmal beim Browser nachfragen
  crewBeimZurueckkommen(ctx);
  jetztFreiPruefen(ctx);            // G3c
  if (aktionAusAdresse(ctx) === 'frei') window.setTimeout(() => ichAuchFrei(ctx), 0); // G3d
  // v4 P0-1h: Die Crew-Reihe verhaelt sich jetzt wie die Loop-Reihe im Meet-Tab —
  // mit Maus/Trackpad ziehbar, und ein Zug loest danach keinen Karten-Tap aus.
  bindRowDrag(root);
  // §5.1: In der Kartenansicht lebt hier eine echte Karte.
  if ((ui.view || 'list') === 'map') bindCrewKarte(root, ctx);

  bindActions(root, {
    'crew-view': (data) => { ui.view = data.view; ctx.render(); },
    'open-crew': (data) => nav.go('room.view', { roomId: roomIdForCrew(data.crew) }),
    'open-person': (data) => nav.go('room.view', { roomId: roomIdForPerson(data.person) }),
    'new-crew': () => nav.go('room.newCrew'),
    'go-location': () => nav.go('profile.location'),
    // §3.1/§3.3: beide leeren Zustände führen an dieselbe Stelle — Freunde hinzufügen.
    // Runde 3 (D5): nicht mehr ins Profil springen — das Sheet kommt über diese Seite, und wer es
    // schließt, ist wieder hier.
    ...(ctx.freundHinzufuegen?.aktionen(root, ctx) || {}),
    'go-friend-add': () => (ctx.freundHinzufuegen ? ctx.freundHinzufuegen.oeffnen(ctx) : nav.go('profile.friendAdd')),
    // spec/04 §1: nur auf- und zuklappen — kein Routenwechsel, kein Sheet, kein neuer
    // Hauptbereich. Der Zustand hängt am Tab-UI und überlebt damit Tabwechsel.
    'temp-raeume': () => { ui.tempRaeume = !ui.tempRaeume; ctx.render(); },
    'open-temp-room': (data) => nav.go('room.view', { roomId: data.room }),
    ...bewertungsHinweisAktionen(ctx),
    ...mitteilungsKarteAktionen(ctx),
    ...anfragenAktionen(ctx),
    ...freiAktionen(ctx),
  });

  bindFreiControl(root, ctx, {
    onTap: () => {
      const free = repo.getFreeState();
      // Runde 4: fühlbar — frei werden ist ein kleiner Erfolg, frei beenden ein leichter Tipp.
      if (free.active) {
        rueckmeldung('tipp');
        repo.clearFree();
        window.clearTimeout(ui.freiHinweisTimer);
        ui.freiHinweis = null;
        ui.lustSheet = false;
      } else {
        rueckmeldung('erfolg');
        repo.setFree();
        nachFreiWerden(ctx);   // Runde 5 (G3a): wer ist auch frei?
      }
    },
    onRelease: (hold) => {
      // v3.1: Frei ab statt Frei bis. Ohne Drag bleibt es der direkte Frei-Zustand.
      // v5 A05: Der absolute Zeitpunkt wird übergeben — nicht der nominale Offset.
      // Sonst wird die App später frei, als sie zugesagt hat.
      rueckmeldung('erfolg');
      repo.setFree(hold ? { at: hold.targetAt, from: hold.timeLabel } : {});
      // Runde 5 (G3a): Geplant bleibt es „Frei ab …"; sofort frei zeigt, wer auch frei ist.
      if (hold) ctx.toast?.(tx('Frei ab {zeit}', { zeit: hold.timeLabel }));
      else nachFreiWerden(ctx);
    },
  });
}

// --- Frei-Steuerung v3.1 (PRODUCT_DECISIONS §4, RUNTIME_QUALITY_CONTRACT §3) ---
// Tap setzt sofort Frei. Halten öffnet den Frei-ab-Controller am ruhenden Button;
// erst ein Uhrzeiger-Drag lädt einen Bogen auf: eine volle Umdrehung = 60 Minuten,
// weitere Umdrehungen zählen fortlaufend weiter. Werte rasten in 5-Minuten-Schritten,
// rückwärts nur bis Offset null. Obergrenze sichtbar begrenzt.

const RING_RADIUS = 103;
const HOLD_DELAY_MS = 300;
const SNAP_MINUTES = 5;
const MAX_OFFSET_MINUTES = 12 * 60; // klare, im Controller sichtbare Obergrenze
const MAX_DEG = (MAX_OFFSET_MINUTES / 60) * 360; // eine Umdrehung = 60 Minuten
const REST_ANGLE = 90;   // atan2-Grad der 6-Uhr-Ruhelage (y wächst nach unten)
const DEAD_ZONE = 34;    // zu nah am Zentrum wäre der Winkel unruhig
// v7 A08 (spec/02 §1): Der Uebergang dauert 0,8-1,0 s. Mit den frueheren 340 ms war die
// Flaeche gefaerbt, bevor das Auge der Bewegung folgen konnte.
const FREI_ANIM_MS = 900;

function formatClock(date) {
  return `${String(date.getHours()).padStart(2, '0')}:${String(date.getMinutes()).padStart(2, '0')}`;
}

// v4 P0-2g: Angezeigte Zeit UND Obergrenze werden auf dieselbe Weise gerundet. Vorher wurde
// nur der gewählte Wert gerundet, die Obergrenze nicht — am Anschlag stand deshalb
// „Frei ab 10:10 … Spätestens 10:09", also eine Minute VOR dem gewählten Zeitpunkt.
function roundedClock(msFromNow) {
  const date = new Date(Date.now() + msFromNow);
  date.setSeconds(0, 0);
  date.setMinutes(Math.round(date.getMinutes() / 5) * 5);
  return date;
}

function minutesUntil(at) {
  return Math.max(0, Math.round((Number(at) - Date.now()) / 60000));
}

// v4 P0-2k: Der Countdown kannte nur Minuten und war hart auf 90 Minuten begrenzt — bei
// längerem Vorlauf fehlte er komplett. Jetzt gibt es eine gröbere Einheit, und die Regel
// steht nur an dieser einen Stelle (Render UND Ticker lesen sie).
function countdownLabel(minutes) {
  if (minutes <= 0) return '';
  if (minutes < 60) return tx('in {min} Min.', { min: minutes });
  const hours = Math.floor(minutes / 60);
  const rest = minutes % 60;
  if (hours >= 3 || rest === 0) return tx('in {std} Std', { std: hours });
  return tx('in {std} Std {min} Min', { std: hours, min: rest });
}

function freiCaption(state, minutesLeft) {
  const countdown = countdownLabel(minutesLeft);
  return `${tx('frei ab {zeit}', { zeit: state?.from || '' })}${countdown ? ` · ${countdown}` : ''}`;
}

// Nach einem Halten liegt der Zeiger beim Loslassen über fremdem Inhalt (Ringbahn statt
// Knopf). Der darauf folgende Klick würde sonst die Zeile darunter öffnen.
function swallowNextClick() {
  const stop = (event) => { event.stopPropagation(); event.preventDefault(); };
  window.addEventListener('click', stop, true);
  window.setTimeout(() => window.removeEventListener('click', stop, true), 350);
}

// v3.2 Ü2: Solange ein geplantes „Frei ab" läuft, aktualisiert ein leichter Ticker den
// Fortschritt und den Countdown DIREKT im DOM (kein voller Rerender, damit Eingaben und
// Scrollposition unberührt bleiben).
//
// v4 P0-2e: Der Ticker terminiert jetzt EXAKT auf die Fälligkeit. Vorher lief ein
// setInterval(10000); der Übergang in den echten Frei-Zustand kam dadurch bis zu 7,5 s zu
// spät. Die nächste Weckzeit ist min(1000 ms, Restzeit) — der letzte Schlag fällt also genau
// auf den gewählten Zeitpunkt. Der Timer hängt am Tab-UI-Zustand, damit ein erneutes Binden
// (jeder Render bindet neu) keinen zweiten Ticker stehen lässt.
function startFreiTicker(ctx) {
  const { ui } = ctx;
  if (ui.freeTimer) { window.clearTimeout(ui.freeTimer); ui.freeTimer = null; }

  const schedule = () => {
    const state = ctx.repo.getFreeState();
    if (!state?.pending || !state.fromAt) return;
    const msLeft = Number(state.fromAt) - Date.now();
    // Grober Takt solange viel Zeit bleibt, feiner Takt kurz davor — der letzte Schlag
    // fällt immer exakt auf fromAt, weil msLeft selbst die Obergrenze ist.
    const period = msLeft > 90000 ? 10000 : 1000;
    ui.freeTimer = window.setTimeout(step, Math.max(16, Math.min(period, msLeft)));
  };

  const step = () => {
    ui.freeTimer = null;
    if (!document.querySelector('#free-button')) return; // Seite nicht mehr sichtbar
    const state = ctx.repo.getFreeState();               // wird zur Fälligkeit selbst wirksam
    if (!state?.pending) { ctx.render(); return; }        // genau ein Render beim Übergang
    // v7 A10: Der Ticker ist NUR noch fachlich — er hält den Countdown-Text exakt und
    // trifft die Fälligkeit auf die Millisekunde. Den sichtbaren Fortschritt malt der
    // Antrieb unten Frame für Frame. Vorher schrieb genau diese Stelle einen
    // inset-Schatten (`inset 0 0 0 ${progress*34}px`) — eine harte, nach innen
    // wandernde Kreisblende, die v7 für den Frei-Knopf ausschließt, und sie sprang im
    // Ticker-Takt (gemessen 3 Stufen in 32 s bei 10-Minuten-Vorlauf).
    const caption = document.querySelector('#free-caption');
    if (caption) caption.textContent = freiCaption(state, minutesUntil(state.fromAt));
    schedule();
  };

  schedule();
  startFreiAntrieb(ctx);
}

// --- Optischer Antrieb des geplanten Freiwerdens (v7 A10, spec/02 §2) ---

// Der fachliche Zeitanteil ist linear und monoton. Der SICHTBARE Fortschritt ist eine
// sanfte Ease-in-Kurve: früh sehr zurückhaltend, in der letzten Phase merklich stärker.
// Exponent und Formel sind identisch mit dem Renderpfad (components.js freiKreis), damit
// Antrieb und Render nie auseinanderlaufen und ein zwischendurch ausgelöster Render
// keinen Sprung erzeugt.
const SICHT_KURVE = 2.2;

// spec/02 §2 Punkte 3 und 4: Über dem Basiswert liegt eine kleine, nullmittige optische
// Atembewegung. Ihre Hüllkurve 4·b·(1−b) ist an Start und Ende exakt null, in der Mitte
// eins — dadurch gibt es weder beim Setzen noch beim Übergang in „frei" einen Sprung.
// Die Auslenkung bleibt damit unter 2 Prozentpunkten und verändert weder Timer noch
// Zielzeit noch Status: sie wird ausschließlich in die CSS-Variable geschrieben.
const ATEM_AMPLITUDE = 0.018;
const ATEM_PERIODE_MS = 4200;

function sichtbarerFortschritt(anteil) {
  return Math.pow(Math.max(0, Math.min(1, anteil)), SICHT_KURVE);
}

function atemAuslenkung(basis, jetzt) {
  const huelle = 4 * basis * (1 - basis);
  return ATEM_AMPLITUDE * huelle * Math.sin((2 * Math.PI * jetzt) / ATEM_PERIODE_MS);
}

// v7 A10: Der Fortschritt aktualisiert AUSSCHLIESSLICH die CSS-Variablen des Frei-Knopfes
// — kein ctx.render(), kein Layout, kein Sheet- oder Pager-Ruckeln. Ein eigener
// requestAnimationFrame-Lauf ersetzt die frühere Ticker-Stufung: der Takt des fachlichen
// Tickers (1 s bzw. 10 s) war vorher direkt die sichtbare Stufung.
function malenFreiFortschritt(dot, state) {
  const start = Number(state.setAt) || (Number(state.fromAt) - 60 * 60000);
  const span = Math.max(1, Number(state.fromAt) - start);
  const jetzt = Date.now();
  const anteil = Math.max(0, Math.min(1, (jetzt - start) / span));
  const basis = sichtbarerFortschritt(anteil);
  const wert = Math.max(0, Math.min(1, basis + atemAuslenkung(basis, jetzt)));
  // Der Renderpfad setzt eine 0,9-s-Transition, die den Abstand zwischen zwei Renders
  // überbrückt. Der Antrieb schreibt jeden Frame selbst — mit der Transition würde er
  // um fast eine Sekunde nachhinken und die Atembewegung wegglätten.
  dot.style.setProperty('transition', 'none');
  // Fünf Nachkommastellen: in der sehr zurückhaltenden Anfangsphase einer langen Spanne
  // wäre eine gröbere Zahl selbst die sichtbare Stufung (0,01 Prozentpunkte je Schritt).
  dot.style.setProperty('--freiP', wert.toFixed(5));
  // Der Text folgt dem BASISWERT, nicht der Atembewegung: sonst flackerte die Schrift.
  // Runde 3 (O1): dieselbe weiche Kurve wie beim Tippen (components.js SCHRIFT) und dieselben
  // Farben aus den Tokens — vorher lief hier eine eigene, lineare Mischung mit festen Werten,
  // die schon bei halber Füllung fast weiße Schrift auf fast weißem Grund ergab.
  const s = Math.max(0, Math.min(1, (basis - 0.52) * 2.5));
  const g = s * s * (3 - 2 * s);
  dot.style.color = `color-mix(in srgb,var(--on-accent) ${(g * 100).toFixed(1)}%,var(--green-dark))`;
}

function startFreiAntrieb(ctx) {
  const { ui } = ctx;
  if (ui.freeRaf) { window.cancelAnimationFrame(ui.freeRaf); ui.freeRaf = null; }
  const zustand = ctx.repo.getFreeState();
  if (!zustand?.pending || !zustand.fromAt) return;

  const frame = () => {
    ui.freeRaf = null;
    const dot = document.querySelector('#free-dot');
    const state = ctx.repo.getFreeState();
    // Seite verlassen oder Zustand vorbei: der Lauf endet von selbst, es bleibt kein
    // zweiter Antrieb stehen (jeder Render bindet neu und ruft startFreiAntrieb erneut).
    if (!dot || !state?.pending || !state.fromAt) return;
    malenFreiFortschritt(dot, state);
    ui.freeRaf = window.requestAnimationFrame(frame);
  };
  ui.freeRaf = window.requestAnimationFrame(frame);
}

export function bindFreiControl(root, ctx, handlers) {
  const button = root.querySelector('#free-button');
  if (!button) return;
  const { ui } = ctx;
  startFreiTicker(ctx);

  let holdTimer = null;
  let pointerId = null;
  let lastAngle = null;      // Bezugswinkel der letzten Messung (Grad)
  let totalDeg = 0;          // EINZIGE Größe: kumulierte Drehung ab der 6-Uhr-Ruhelage
  let startPoint = null;

  // v4 P0-2a: Der Bezugsrahmen wird bei JEDER Bewegung frisch aus dem LEBENDEN Dokument
  // geholt. Vorher schloss der Controller über das beim Binden übergebene `root`; spätestens
  // der Halte-Render hängte dieses root ab, getBoundingClientRect() lieferte {0,0,0,0},
  // die Skala fiel auf 1 zurück und die App rechnete mit ROHEN Client-Koordinaten
  // (Winkelfehler bis 171° auf 768x1024, 43° in der skalierten Preview).
  //
  // Bezug ist die aktive Tab-Seite: genau sie ist der Container, in dem das Halte-Overlay
  // absolut positioniert liegt (screenScaffold rendert `overlays` als letztes Kind der
  // .tab-page). Dadurch stimmen Overlay-Koordinaten und Messung ohne Umrechnungsoffset —
  // und der 1-px-Versatz aus P0-2h entfällt, weil nicht mehr die Rahmen-AUSSENkante
  // (.runtime-phone inklusive 1-px-Kontur) gemessen wird.
  // Bezugsrahmen ist GENAU der Kasten, in dem das Halte-Overlay positioniert wird.
  // app.js hängt die Overlays einer Tab-Wurzel aus der Seite in den Handyrahmen um
  // (damit der Schleier auch Statusleiste und Navigation abdeckt) — wird hier die Seite
  // gemessen, sitzt der Ring um die Höhe der Statusleiste daneben.
  // Deshalb: erst den echten Positionsrahmen des Overlays nehmen, sonst den Rahmen.
  function frameEl() {
    const holder = document.querySelector('.page-overlays');
    if (holder && holder.parentElement) return holder.parentElement;
    return document.querySelector('.runtime-phone')
      || document.querySelector('.tab-page[data-role="active"]')
      || document.querySelector('.tab-page');
  }

  function metrics() {
    const el = frameEl();
    if (!el) return null;
    const rect = el.getBoundingClientRect();
    const layoutWidth = el.offsetWidth || rect.width || 0;
    if (!rect.width || !layoutWidth) return null;
    return { rect, scale: rect.width / layoutWidth || 1 };
  }

  // Clientpunkt → CSS-Pixel innerhalb der aktiven Seite (skalierungsfest).
  function toLocal(clientX, clientY, m) {
    return { x: (clientX - m.rect.left) / m.scale, y: (clientY - m.rect.top) / m.scale };
  }

  // Ruhelage = Mitte des SICHTBAREN grünen Kreises, ebenfalls live gemessen.
  function restCenter(m) {
    const circle = document.querySelector('#free-dot') || document.querySelector('#free-button');
    if (!circle) return null;
    const rect = circle.getBoundingClientRect();
    if (!rect.width) return null;
    return {
      x: (rect.left - m.rect.left + rect.width / 2) / m.scale,
      y: (rect.top - m.rect.top + rect.height / 2) / m.scale,
    };
  }

  function angleAt(point, ring) {
    return Math.atan2(point.y - ring.y, point.x - ring.x) * 180 / Math.PI;
  }

  // v4 P0-2b/P0-2i: Es gibt nur EINE Größe — totalDeg. Punkt, Bogen und Zeit werden alle
  // daraus abgeleitet, der Punkt ist damit wirklich der Griff am Bogenende. Vorher wurde der
  // Punkt aus dem absoluten Zeigerwinkel und der Bogen aus totalDeg gesetzt; sobald totalDeg
  // geklemmt wurde, liefen beide bis zu 180° auseinander.
  // Nullpunkt ist die 6-Uhr-Ruhelage (REST_ANGLE), NICHT der erste verarbeitete Zug —
  // deshalb ergibt dieselbe Geste mit Maus und Touch jetzt denselben Wert.
  function applyRotation(ring) {
    if (totalDeg < 0) totalDeg = 0;
    if (totalDeg > MAX_DEG) totalDeg = MAX_DEG;
    const capped = totalDeg >= MAX_DEG - 0.01;

    const rawMinutes = (totalDeg / 360) * 60;                       // stufenlos
    const snapped = Math.round(rawMinutes / SNAP_MINUTES) * SNAP_MINUTES;
    const offset = Math.max(0, Math.min(MAX_OFFSET_MINUTES, snapped));

    const hold = ui.hold;
    hold.offsetMinutes = offset;                                    // gerastet (fachlich)
    hold.rawMinutes = rawMinutes;                                   // stufenlos (visuell)
    hold.totalDeg = totalDeg;
    hold.rounds = Math.floor(totalDeg / 360);
    // P0-2c: beide Bogen-Ebenen laufen monoton und kollabieren an keiner Rundengrenze.
    // v5 A04: EIN Ring. Statt einer zweiten Ebene liefert der Controller jetzt die
    // Rundenzahl und den Bogen der aktuellen Runde; die Darstellung hebt den Verlauf
    // pro Runde um eine Stufe an.
    hold.turns = Math.floor(totalDeg / 360);
    hold.sweepDeg = totalDeg - hold.turns * 360;
    // v5 A05: Es gibt genau EINE Zielgröße — den absoluten Zeitpunkt targetAt auf dem
    // Fünf-Minuten-Raster. Anzeige, Countdown und der gespeicherte Zustand lesen alle
    // ihn. Der Zusatz ist die REALE Differenz bis dorthin, nicht die Auswahlstufe:
    // bei 14:12 und Ziel 14:20 also "in 8 Min.", nicht "in 10 Min.".
    const target = offset > 0 ? roundedClock(offset * 60000) : null;
    hold.targetAt = target ? target.getTime() : null;
    hold.timeLabel = target ? formatClock(target) : tx('jetzt');
    hold.offsetLabel = target ? countdownLabel(minutesUntil(hold.targetAt)) : '';
    hold.capped = capped;
    hold.capLabel = formatClock(roundedClock(MAX_OFFSET_MINUTES * 60000));
    hold.dragging = totalDeg > 0;

    hold.ringX = ring.x;
    hold.ringY = ring.y;
    const radians = (REST_ANGLE + totalDeg) * Math.PI / 180;
    hold.dotX = ring.x + Math.cos(radians) * RING_RADIUS;
    hold.dotY = ring.y + Math.sin(radians) * RING_RADIUS;
  }

  // v4 P0-2i: Während des Ziehens wird NUR das Halte-Overlay ersetzt, nicht die ganze Seite.
  // Der frühere Vollrender pro Bewegung (appElement.innerHTML) verschluckte Ereignisse —
  // je nach Eingabegerät unterschiedlich viele, weshalb dieselbe Geste mit Touch einen
  // anderen Wert ergab als mit der Maus.
  function paint() {
    const host = document.querySelector('#frei-hold');
    if (host && host.parentElement) host.outerHTML = freiHoldOverlay(ui.hold);
    else ctx.render();
  }

  function begin(event) {
    if (event.button !== undefined && event.button !== 0) return;
    const m = metrics();
    const rest = m && restCenter(m);
    if (!m || !rest) return;
    pointerId = event.pointerId;
    button.setPointerCapture?.(pointerId);
    const ring = { x: rest.x, y: rest.y - RING_RADIUS };
    const press = toLocal(event.clientX, event.clientY, m);
    startPoint = { x: event.clientX, y: event.clientY };
    totalDeg = 0;
    // Bezug der Drehung ist der Druckpunkt (deterministisch, unabhängig von der Ereignis-
    // bündelung des Eingabegeräts). Liegt er im Totbereich, gilt die 6-Uhr-Ruhelage.
    lastAngle = Math.hypot(press.x - ring.x, press.y - ring.y) >= DEAD_ZONE
      ? angleAt(press, ring)
      : REST_ANGLE;
    ui.hold = {
      holding: false, dragging: false,
      dotX: rest.x, dotY: rest.y,
      ringX: ring.x, ringY: ring.y,
      turns: 0, sweepDeg: 0, rounds: 0, totalDeg: 0, targetAt: null,
      offsetMinutes: 0, rawMinutes: 0,
      timeLabel: tx('jetzt'), offsetLabel: '', capped: false, capLabel: '',
    };
    holdTimer = window.setTimeout(() => {
      if (!ui.hold) return;
      ui.hold.holding = true;
      rueckmeldung('auswahl');
      // Ringmitte zum Haltezeitpunkt noch einmal live nachmessen.
      const hm = metrics();
      const hr = hm && restCenter(hm);
      if (hr) {
        ui.hold.ringX = hr.x;
        ui.hold.ringY = hr.y - RING_RADIUS;
        ui.hold.dotX = hr.x;
        ui.hold.dotY = hr.y;
      }
      ctx.render();
    }, HOLD_DELAY_MS);
    window.addEventListener('pointermove', move);
    window.addEventListener('pointerup', end);
    window.addEventListener('pointercancel', cancel);
  }

  function move(event) {
    if (event.pointerId !== pointerId || !ui.hold) return;

    // Vor Ablauf der Haltezeit: deutliche Bewegung bricht den Frei-Griff ab,
    // damit ein Scroll- oder Tab-Swipe nicht versehentlich Frei auslöst.
    if (!ui.hold.holding) {
      const dx = event.clientX - startPoint.x;
      const dy = event.clientY - startPoint.y;
      if (Math.hypot(dx, dy) > 12) cancel(event);
      return;
    }

    const m = metrics();
    const rest = m && restCenter(m);
    if (!m || !rest) return;
    const ring = { x: rest.x, y: rest.y - RING_RADIUS };

    const local = toLocal(event.clientX, event.clientY, m);
    if (Math.hypot(local.x - ring.x, local.y - ring.y) < DEAD_ZONE) return;

    const angle = angleAt(local, ring);            // -180..180, 90 = unten (Ruhelage)
    if (lastAngle === null) lastAngle = REST_ANGLE;

    let delta = angle - lastAngle;
    if (delta > 180) delta -= 360;      // Sprung über die ±180-Grenze glätten
    if (delta < -180) delta += 360;
    lastAngle = angle;

    // Uhrzeigersinn lädt auf, Gegenrichtung reduziert — aber nie unter null und nie über
    // die Obergrenze. lastAngle folgt trotzdem weiter, damit eine Richtungsumkehr sofort
    // greift (kein aufgestauter Nachholweg).
    totalDeg = Math.max(0, Math.min(MAX_DEG, totalDeg + delta));
    const rastVorher = ui.hold.offsetMinutes;
    applyRotation(ring);
    // Runde 4: Jede 5-Minuten-Rastung ist fühlbar, wie bei einem Zeitrad.
    if (ui.hold.offsetMinutes !== rastVorher) rueckmeldung('auswahl');
    paint();
  }

  function end(event) {
    if (event.pointerId !== pointerId) return;
    window.clearTimeout(holdTimer);
    const hold = ui.hold;
    detach();
    ui.hold = null;
    if (hold?.holding) {
      swallowNextClick();
      handlers.onRelease(hold.offsetMinutes > 0 ? hold : null);
    } else handlers.onTap();
    ctx.render();
  }

  function cancel(event) {
    if (event.pointerId !== pointerId) return;
    window.clearTimeout(holdTimer);
    const wasHolding = Boolean(ui.hold?.holding);
    detach();
    ui.hold = null;
    if (wasHolding) swallowNextClick();
    ctx.render();
  }

  function detach() {
    pointerId = null;
    lastAngle = null;
    window.removeEventListener('pointermove', move);
    window.removeEventListener('pointerup', end);
    window.removeEventListener('pointercancel', cancel);
  }

  button.addEventListener('pointerdown', begin);
}

export const crewScreens = {
  'crew.home': renderCrewHome,
};
