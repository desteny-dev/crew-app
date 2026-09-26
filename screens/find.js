// Bereich Find (Route 'find.home') — der fünfte Haupt-Tab, in der Mitte der Fußleiste.
//
// Runde 8, R8-66 / R8-50 (Jonathan): „Dashboard — ‚Dieses Wochenende' (Besonderes zum Ausgehen und
// unter Leute kommen, keine wöchentlichen Standard-Clubs), beste Restaurants, beste Erlebnisse,
// ‚Für dich'. Bewertung: Algorithmus-Score + getrennte Tester-Bewertung. Finder im Akinator-Stil.
// Merken, ‚Mit Crew machen', eigene Kartenansicht, Anzeigen klar gekennzeichnet, das Label nie
// käuflich. Admin darf Einträge anlegen."
//
// Aufbau, von oben (Runde 11, C2/D7 — ersetzt den Aufbau aus Runde 8/10):
//   · Kopf: „Find" · rechts das Lesezeichen (Gemerktes, nur wenn es welches gibt) und für Admins „+".
//   · Hero: der beste Tipp groß, mit „Meet planen" darunter.
//   · Dieses Wochenende (Reihe) · Beste Restaurants (Rangliste) · Beste Erlebnisse (Reihe) ·
//     Ideen für Zuhause (Kacheln). Eine leere Stelle steht nicht da. Was wo steht, entscheidet
//     data/find-auswahl.js › findUebersicht. Höchstens anderthalb Bildschirme.
//   · Über der Tab-Leiste schweben „Worauf hast du Lust?" (das Erlebnis aus vier Seiten) und
//     links der Schalter Karte/Liste — wie FREE im Crew-Tab.
//   · Ein Tipp auf einen Eintrag öffnet das Blatt: Score mit seinen Gründen, getrennt davon die
//     Tester-Bewertung, „Meet planen", „Merken", „Karte".
//   · Anzeigen tragen „Anzeige" und stehen in ihrer Reihe höchstens an zweiter Stelle; der
//     Crew-Tipp (bestes Fünftel nach Score) liest nie, wer zahlt (data/find-auswahl.js).
//
// Namen (Jonathans Wörter sind Arbeitstitel):
//   „Mit Crew machen" heißt hier „Meet planen" — es sagt genau, was als Nächstes passiert (ein
//   Meet-Entwurf mit Ort und Idee), mit dem Wort, das die App für das Ding schon hat.
//   Das Label heißt „Crew-Tipp" (engl. „Crew pick"): Es sagt, wer dafür bürgt — Crew selbst.
//   Anzeigen heißen „Anzeige" (engl. „Ad"): das kürzeste Wort, das in Österreich und Deutschland
//   auch rechtlich als Kennzeichnung gilt.
//
// Eigene Regeln stehen im <style> dieser Seite (Präfix .fnd), nicht in styles.css (gemeinsames
// Gut). Kein Knopf ohne Wirkung: Admin-„+" nur für Admins, „Karte" nur mit Koordinaten.

import { esc, bindActions, rueckmeldung } from '../core/html.js';
import { now, toISODate, weekdayShort, weekdayLong, tagUndMonat } from '../core/dates.js';
import { t as tx, tk, tn, zahl, wort } from '../core/sprache.js';
import { entfernungKm, kmText } from '../core/entfernung.js';
import {
  screenScaffold, tabHeader, sheet, edgeFadeRow, TAB_HEADER_PAD_X,
  dirtyGuard, discardSheet, discardActions, hinweisPille,
} from '../ui/components.js';
import { symbol } from '../ui/symbole.js';
import { activityIconSvg, iconKeyForText } from '../ui/activity-icons.js';
import { plus, mapIcon, listIcon } from '../ui/icons.js';
import { karteGrossOeffnen } from '../ui/karte-gross.js';
import { crewFigur } from '../ui/crew-figur.js';
import {
  grobeZeit, kurzName, karteHalten, karteVon, ortMarken, passeAufPunkte, startAnsicht,
  kartenLageQuelle, bedienSpalteOrdnen, bedienFlaechen, KARTEN_SPALTE, ortSuchen,
} from '../ui/map.js';
import { erlaubnisStand, erlaubnisFragen } from '../core/native.js';
import * as auswahl from '../data/find-auswahl.js';
import { FIND_GRUNDWERT } from '../data/projections.js';

const FONT = "'Instrument Sans',sans-serif";
const TITEL_FONT = "'Bricolage Grotesque',sans-serif";
const RAND = TAB_HEADER_PAD_X;
const KARTE_SCHLUESSEL = 'find-karte';
// Wie auf dem Karten-Tab: schmale Streifen am Rand, über die die Tab-Bahn die waagrechte Geste
// zurückbekommt — die Fläche dazwischen gehört der Karte (screens/karte.js › Wischausgang).
const RAND_ZONE = 28;
const RAND_UNTEN_FREI = 64;
// So viele Treffer zeigt der Finder am Schluss: einen groß, den Rest als Zeilen.
const ERGEBNIS_ZAHL = 5;

// ---------------------------------------------------------------------------------------------
// Die Seite trägt ihre Regeln selbst. Der Block steht im Kopf HINTER der Kopfzeile, damit
// die gemeinsame Kopfachse (v4-headerachse) ihr erstes Kind weiter als Kopfzeile misst.
// ---------------------------------------------------------------------------------------------
const STIL = `<style>
.fnd{padding:2px 0 10px}
.fnd [hidden],.fnd-blatt [hidden]{display:none!important}
.fnd-kopf{margin:0;padding:16px ${RAND}px 9px;font:650 11px/1.2 ${FONT};letter-spacing:.09em;text-transform:uppercase;color:var(--muted-light)}
.fnd-karte{flex:none;width:150px;display:flex;flex-direction:column;padding:0;margin:0;border:0;background:transparent;text-align:left;cursor:pointer;appearance:none;font-family:${FONT};color:var(--ink);-webkit-tap-highlight-color:transparent}
.fnd-bild{position:relative;display:block;width:100%;height:100px;border-radius:16px;overflow:hidden;background:var(--field);transition:transform .14s ease-out}
.fnd-bild>img{position:absolute;inset:0;width:100%;height:100%;object-fit:cover;display:block}
.fnd-karte:active .fnd-bild,.fnd-zeile:active .fnd-daumen{transform:scale(.97)}
.fnd-zeichen{position:absolute;inset:0;display:flex;align-items:center;justify-content:center;pointer-events:none}
.fnd-marken{position:absolute;left:7px;right:7px;bottom:7px;display:flex;gap:5px;align-items:center;pointer-events:none}
.fnd-anzeige{position:absolute;left:7px;top:7px;pointer-events:none}
.fnd-pille{display:inline-flex;align-items:center;gap:4px;height:22px;padding:0 8px;border-radius:999px;font:700 11px/1 ${FONT};white-space:nowrap;font-variant-numeric:tabular-nums;box-sizing:border-box}
.fnd-glas{background:var(--glass);-webkit-backdrop-filter:blur(10px);backdrop-filter:blur(10px);color:var(--ink);box-shadow:0 1px 3px var(--shadow-10)}
.fnd-leise{color:var(--ink-soft);font-weight:650}
.fnd-tipp{background:var(--green);color:var(--on-accent)}
.fnd-titel{display:-webkit-box;-webkit-line-clamp:2;-webkit-box-orient:vertical;overflow:hidden;margin-top:8px;font-size:14px;font-weight:650;line-height:1.25;letter-spacing:-.01em;pointer-events:none}
.fnd-unter{display:flex;align-items:center;gap:4px;margin-top:3px;font-size:12px;line-height:1.3;color:var(--ink-soft);min-width:0;pointer-events:none}
.fnd-unter>span{white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
.fnd-finder{padding:6px ${RAND}px 2px}
.fnd-finder-titel{margin:0 0 12px;font:650 20px/1.2 ${TITEL_FONT};letter-spacing:-.015em;color:var(--ink)}
.fnd-chips{display:flex;flex-wrap:wrap;gap:8px}
.fnd-chip{display:inline-flex;align-items:center;justify-content:center;gap:6px;min-height:44px;padding:0 15px;border-radius:999px;border:1.5px solid var(--ink-a12);background:var(--surface);color:var(--ink);font:650 13.5px/1 ${FONT};cursor:pointer;appearance:none;box-sizing:border-box;-webkit-tap-highlight-color:transparent;transition:background-color .15s ease-out,border-color .15s ease-out,color .15s ease-out}
.fnd-chip[aria-pressed="true"]{background:var(--green-tint);border-color:var(--green-a45);color:var(--green-dark)}
.fnd-chip:active{transform:scale(.97)}
.fnd-rund{position:relative;flex:none;width:38px;height:38px;border-radius:50%;border:1px solid var(--ink-a12);background:var(--surface);display:flex;align-items:center;justify-content:center;padding:0;cursor:pointer;appearance:none;-webkit-tap-highlight-color:transparent}
.fnd-leer{padding:34px ${RAND + 4}px 0;display:flex;flex-direction:column;gap:6px}
.fnd-blatt{font-family:${FONT};color:var(--ink)}
.fnd-blatt-kopf{display:flex;align-items:center;gap:10px;min-height:44px;margin:-6px -8px 2px}
.fnd-blatt-kopf:empty{display:none}
.fnd-zurueck{width:44px;height:44px;border:0;background:transparent;display:flex;align-items:center;justify-content:center;padding:0;cursor:pointer;appearance:none;border-radius:50%}
.fnd-frage{margin:0;font:650 22px/1.2 ${TITEL_FONT};letter-spacing:-.015em}
.fnd-hinweis{margin:6px 0 0;font-size:12.5px;color:var(--muted)}
.fnd-schritt{animation:fndSchritt .22s cubic-bezier(.22,.61,.36,1) both}
.fnd-blatt .fnd-chips{margin-top:16px}
.fnd-fuss{display:flex;gap:10px;margin-top:22px}
.fnd-knopf{flex:1;min-height:50px;border-radius:999px;display:flex;align-items:center;justify-content:center;gap:8px;padding:0 16px;font:650 14.5px/1 ${FONT};cursor:pointer;appearance:none;box-sizing:border-box;border:1.5px solid var(--ink-a14);background:var(--surface);color:var(--ink);-webkit-tap-highlight-color:transparent}
.fnd-knopf[data-art="haupt"]{border-color:transparent;background:var(--green);color:var(--on-accent);box-shadow:0 6px 18px var(--green-a26)}
.fnd-knopf:active{transform:scale(.98)}
.fnd-gross{display:block;width:100%;margin-top:14px;padding:0;border:0;background:transparent;text-align:left;cursor:pointer;appearance:none;font-family:${FONT};color:var(--ink)}
.fnd-gross .fnd-bild{height:168px;border-radius:18px}
.fnd-gross-titel{display:block;margin-top:11px;font:650 19px/1.25 ${TITEL_FONT};letter-spacing:-.01em}
.fnd-zeile{display:flex;align-items:center;gap:12px;width:100%;min-height:60px;padding:8px 0;border:0;border-top:1px solid var(--ink-a06);background:transparent;text-align:left;cursor:pointer;appearance:none;font-family:${FONT};color:var(--ink)}
.fnd-daumen{position:relative;flex:none;width:48px;height:48px;border-radius:12px;overflow:hidden;background:var(--field);transition:transform .14s ease-out}
.fnd-daumen>img{position:absolute;inset:0;width:100%;height:100%;object-fit:cover}
.fnd-zeile-text{display:flex;flex-direction:column;gap:2px;flex:1;min-width:0;pointer-events:none}
.fnd-zeile-titel{font-size:14.5px;font-weight:650;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
.fnd-score{flex:none;display:inline-flex;align-items:center;justify-content:center;min-width:32px;height:24px;padding:0 7px;border-radius:8px;background:var(--field);color:var(--ink);font:700 12px/1 ${FONT};font-variant-numeric:tabular-nums;box-sizing:border-box;pointer-events:none}
.fnd-label{display:block;margin:22px 0 4px;font:650 11px/1.2 ${FONT};letter-spacing:.09em;text-transform:uppercase;color:var(--muted-light)}
.fnd-textknopf{display:block;margin:18px auto 0;min-height:44px;padding:0 14px;border:0;background:transparent;font:650 13.5px/1 ${FONT};color:var(--ink-soft);cursor:pointer;appearance:none}
.fnd-detail-bild{position:relative;display:block;height:176px;border-radius:18px;overflow:hidden;background:var(--field)}
.fnd-detail-bild>img{position:absolute;inset:0;width:100%;height:100%;object-fit:cover}
.fnd-detail-titel{margin:14px 0 0;font:650 22px/1.2 ${TITEL_FONT};letter-spacing:-.015em}
.fnd-fakten{display:flex;flex-direction:column;margin-top:10px}
.fnd-fakt{display:flex;align-items:center;gap:10px;min-height:40px;font-size:13.5px;color:var(--ink-soft);border:0;background:transparent;padding:0;text-align:left;font-family:${FONT};width:100%}
button.fnd-fakt{cursor:pointer;appearance:none;color:var(--ink)}
.fnd-fakt>span{min-width:0;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
.fnd-wertung{margin-top:12px;border-radius:16px;background:var(--paper);padding:4px 14px}
.fnd-wertung-zeile{display:flex;align-items:center;gap:10px;min-height:48px}
.fnd-wertung-zeile+.fnd-wertung-zeile{border-top:1px solid var(--ink-a06)}
.fnd-wertung-wort{flex:1;min-width:0;display:flex;flex-direction:column;gap:2px;font-size:13.5px;font-weight:650}
.fnd-wertung-wort small{font-size:12px;font-weight:500;color:var(--muted);line-height:1.35}
.fnd-zitat{font-size:13px;font-weight:500;color:var(--ink-soft);line-height:1.4;text-wrap:pretty}
.fnd-aktionen{display:flex;flex-direction:column;gap:9px;margin-top:18px}
.fnd-aktionen-reihe{display:flex;gap:9px}
.fnd-feld{width:100%;height:46px;box-sizing:border-box;border-radius:14px;border:1.5px solid var(--ink-a10);background:var(--surface);padding:0 14px;font:500 14px ${FONT};color:var(--ink);outline:none}
.fnd-feld:focus{border-color:var(--green-a45)}
.fnd-feld::placeholder{color:var(--muted-light);opacity:1}
.fnd-form{display:flex;flex-direction:column;gap:10px;margin-top:14px}
.fnd-form-zeile{display:flex;gap:8px}
.fnd-form-zeile>*{flex:1;min-width:0}
.fnd-zeit{position:relative;display:block}
.fnd-zeit>span{position:absolute;left:14px;top:50%;transform:translateY(-50%);font:600 12.5px/1 ${FONT};color:var(--muted);pointer-events:none}
.fnd-zeit>.fnd-feld{padding-left:60px}
.fnd-segment{display:flex;gap:3px;padding:3px;border-radius:14px;background:var(--field)}
.fnd-segment button{flex:1;min-height:40px;border:0;border-radius:11px;background:transparent;font:650 13px/1 ${FONT};color:var(--muted);cursor:pointer;appearance:none}
.fnd-segment button[aria-pressed="true"]{background:var(--surface);color:var(--ink);box-shadow:0 1px 3px var(--shadow-08)}
.fnd-treffer{display:flex;align-items:center;gap:10px;width:100%;min-height:46px;padding:6px 2px;border:0;border-top:1px solid var(--ink-a05);background:transparent;text-align:left;cursor:pointer;appearance:none;font-family:${FONT};color:var(--ink)}
.fnd-schalter{display:flex;align-items:center;justify-content:space-between;gap:12px;width:100%;min-height:48px;padding:0 2px;border:0;background:transparent;cursor:pointer;appearance:none;font:600 14px/1.3 ${FONT};color:var(--ink);text-align:left}
.fnd-schalter-spur{flex:none;width:44px;height:26px;border-radius:13px;background:var(--field-deep);position:relative;transition:background-color .15s ease-out}
.fnd-schalter-spur::after{content:"";position:absolute;left:3px;top:3px;width:20px;height:20px;border-radius:50%;background:var(--surface);box-shadow:0 1px 3px var(--shadow-20);transition:transform .15s ease-out}
.fnd-schalter[aria-pressed="true"] .fnd-schalter-spur{background:var(--green)}
.fnd-schalter[aria-pressed="true"] .fnd-schalter-spur::after{transform:translateX(18px)}
.fnd-fehler{margin:2px 0 0;font-size:12.5px;font-weight:600;color:var(--danger)}
.fnd-hero{padding:6px ${RAND}px 2px}
.fnd-hero-karte{display:block;width:100%;padding:0;border:0;background:transparent;text-align:left;cursor:pointer;appearance:none;font-family:${FONT};color:var(--ink);-webkit-tap-highlight-color:transparent}
.fnd-hero-bild{position:relative;display:block;width:100%;height:164px;border-radius:22px;overflow:hidden;background:var(--field);transition:transform .14s ease-out}
.fnd-hero-bild>img{position:absolute;inset:0;width:100%;height:100%;object-fit:cover;display:block}
.fnd-hero-karte:active .fnd-hero-bild{transform:scale(.985)}
.fnd-hero-marke{position:absolute;left:10px;top:10px;display:flex;gap:6px;pointer-events:none}
.fnd-hero-titel{display:block;margin-top:11px;font:650 21px/1.2 ${TITEL_FONT};letter-spacing:-.015em}
.fnd-hero-fuss{display:flex;gap:9px;margin-top:10px}
.fnd-hero-fuss .fnd-knopf{min-height:46px}
.fnd-merken-rund{flex:none;width:46px;height:46px;border-radius:50%;border:1.5px solid var(--ink-a14);background:var(--surface);color:var(--ink);display:flex;align-items:center;justify-content:center;padding:0;cursor:pointer;appearance:none}
.fnd-liste{padding:0 ${RAND}px}
.fnd-liste .fnd-zeile:first-child{border-top:0}
.fnd-rang{flex:none;width:18px;text-align:center;font:700 14px/1 ${TITEL_FONT};color:var(--muted);font-variant-numeric:tabular-nums;pointer-events:none}
.fnd-kacheln{display:grid;grid-template-columns:1fr 1fr;gap:8px;padding:0 ${RAND}px}
.fnd-kachel{display:flex;align-items:center;gap:10px;min-width:0;min-height:50px;padding:6px 12px;border-radius:16px;border:1px solid var(--ink-a08);background:var(--surface);text-align:left;cursor:pointer;appearance:none;font-family:${FONT};color:var(--ink);box-sizing:border-box;-webkit-tap-highlight-color:transparent}
.fnd-kachel>svg{flex:none;pointer-events:none}
.fnd-kachel .fnd-titel{font-size:13.5px;min-width:0}
.fnd-kachel:active{transform:scale(.98)}
.fnd-mehr{display:block;margin:0 auto;min-height:38px;padding:0 14px;border:0;background:transparent;font:650 13px/1 ${FONT};color:var(--ink-soft);cursor:pointer;appearance:none}
.fnd-schweben{position:relative;height:84px;display:flex;align-items:center;justify-content:center;gap:10px;padding:0 12px;pointer-events:none}
.fnd-lust{display:flex;align-items:center;gap:10px;min-width:0;flex:0 1 auto;height:54px;padding:0 20px 0 7px;border-radius:999px;border:0;background:var(--green);color:var(--on-accent);font:650 15px/1 ${FONT};letter-spacing:-.01em;white-space:nowrap;box-shadow:0 6px 20px var(--green-a26),0 1px 3px var(--shadow-10);cursor:pointer;appearance:none;pointer-events:auto;-webkit-tap-highlight-color:transparent}
.fnd-lust:active{transform:scale(.97)}
.fnd-lust-figur{flex:none;width:40px;height:40px;border-radius:50%;background:var(--surface);display:flex;align-items:center;justify-content:center;pointer-events:none}
.fnd-lust>span:last-child{overflow:hidden;text-overflow:ellipsis;pointer-events:none}
.fnd-schwebe-rund{flex:none;width:46px;height:46px;border-radius:50%;border:1px solid var(--ink-a12);background:var(--surface);box-shadow:0 4px 14px var(--shadow-14);display:flex;align-items:center;justify-content:center;padding:0;cursor:pointer;appearance:none;pointer-events:auto;-webkit-tap-highlight-color:transparent}
.fnd-schwebe-rund:active{transform:scale(.95)}
.fnd-schwebe-platz{flex:0 1 46px;min-width:0}
.fnd-erlebnis{display:flex;flex-direction:column;min-height:min(560px,68vh)}
.fnd-erlebnis-kopf{display:flex;align-items:center;justify-content:space-between;min-height:44px;margin:-8px -8px 0}
.fnd-fortschritt{display:flex;gap:6px}
.fnd-fortschritt>span{width:26px;height:5px;border-radius:3px;background:var(--field-deep);transition:background-color .2s ease-out}
.fnd-fortschritt>span[data-an="1"]{background:var(--green)}
.fnd-figur-platz{display:flex;justify-content:center;margin:8px 0 14px}
.fnd-erlebnis>.fnd-frage,.fnd-erlebnis>.fnd-hinweis{text-align:center}
.fnd-wahl{display:grid;grid-template-columns:1fr 1fr;gap:9px;margin-top:18px}
.fnd-wahl .fnd-chip{min-height:58px;border-radius:18px;padding:0 12px;font-size:14.5px;line-height:1.2;text-align:center}
.fnd-erlebnis-fuss{display:flex;flex-direction:column;margin-top:auto;padding-top:20px}
.fnd-denkt{flex:1;display:flex;flex-direction:column;align-items:center;justify-content:center;gap:16px;min-height:340px;font:600 14px/1.3 ${FONT};color:var(--ink-soft)}
.fnd-gruende{display:flex;flex-direction:column;gap:3px;padding:0 0 12px 50px}
.fnd-grund{display:flex;gap:8px;font-size:12.5px;line-height:1.35;color:var(--ink-soft)}
.fnd-grund>b{flex:none;min-width:30px;font-weight:700;font-variant-numeric:tabular-nums;color:var(--ink)}
.fnd-gruende+.fnd-wertung-zeile{border-top:1px solid var(--ink-a06)}
@keyframes fndSchritt{from{opacity:0;transform:translateY(8px)}}
@media (prefers-reduced-motion:reduce){.fnd-schritt{animation:none}.fnd-bild,.fnd-daumen{transition:none}}
</style>`;

// =============================================================================================
// Daten: EIN Stand je Zeichnen
// =============================================================================================
function findStand(ctx) {
  const { repo } = ctx;
  const jetzt = now();
  const settings = repo.getSettings?.() || {};
  let roh = [];
  try {
    const wert = typeof repo.getFindEintraege === 'function' ? repo.getFindEintraege() : [];
    roh = Array.isArray(wert) ? wert : [];
  } catch { roh = []; }
  let lage = null;
  try { lage = typeof repo.getMyLocation === 'function' ? repo.getMyLocation() : null; } catch { lage = null; }
  const eintraege = auswahl.eintraegeLesen(roh, { jetzt, settings, lage });
  let admin = false;
  try { admin = typeof repo.istAdmin === 'function' && repo.istAdmin() === true; } catch { admin = false; }
  const gemerktIds = Array.isArray(settings.gemerktIds) ? settings.gemerktIds : [];
  return {
    jetzt,
    settings,
    lage,
    eintraege,
    admin,
    gemerktIds,
    interessen: Array.isArray(settings.interests) ? settings.interests : [],
    gemerkt: new Set(gemerktIds),
    tipps: auswahl.crewTipps(eintraege, jetzt),
    nachId: new Map(eintraege.map((eintrag) => [eintrag.id, eintrag])),
  };
}

// =============================================================================================
// Kleine Bausteine
// =============================================================================================
function zeitText(ms) {
  const d = new Date(ms);
  return `${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`;
}

// Kurz, wie auf der Karte: „Heute 19 Uhr", „Sa 20:30", „22.9. 19 Uhr".
function wannKurz(eintrag) {
  if (!eintrag.wann) return '';
  const d = new Date(eintrag.wann.von);
  return grobeZeit({ date: toISODate(d), time: zeitText(eintrag.wann.von) });
}

// Ausgeschrieben fürs Blatt: „Samstag, 19. September · 19:00–23:30".
function wannLang(eintrag) {
  if (!eintrag.wann) return '';
  const iso = toISODate(new Date(eintrag.wann.von));
  const von = zeitText(eintrag.wann.von);
  const bisGleicherTag = eintrag.wann.bis && toISODate(new Date(eintrag.wann.bis)) === iso;
  const bis = eintrag.wann.bis ? (bisGleicherTag ? zeitText(eintrag.wann.bis) : `${weekdayShort(toISODate(new Date(eintrag.wann.bis)))} ${zeitText(eintrag.wann.bis)}`) : '';
  return `${weekdayLong(iso)}, ${tagUndMonat(new Date(eintrag.wann.von))} · ${bis ? `${von}–${bis}` : von}`;
}

function scoreText(wert) {
  return wert == null ? '' : zahl(wert, 1);
}

// Das Zeichen eines Eintrags kommt aus dem EINEN Katalog (ui/activity-icons.js › iconKeyForText).
// Gefragt werden zuerst die Tags, einzeln und in ihrer Reihenfolge — sie sind gepflegte Stichworte.
// Der Titel ist oft ein Name und führt die Stichwortsuche in die Irre (gemessen am Beispielbestand:
// „vorarlberg museum" → Berg, „Karren" → Spielkarten, „Wirtshaus am See" → Schwimmer). Ein
// Restaurant bekommt immer ein Essens-Zeichen; ohne Treffer gilt die Familie der Art.
const ESSEN_ZEICHEN = new Set(['gabel', 'pizza', 'tasse', 'glas', 'grill']);
const ART_ZEICHEN = { restaurant: 'gabel', event: 'ticket', erlebnis: 'funkeln' };
// Tags, die sagen WO oder WIE etwas ist, nicht WAS man tut, geben kein Zeichen — sonst schwimmt
// „Mit dem Schiff nach Lindau", weil es am See liegt. Dann lieber das ruhige Zeichen der Art.
const UMSTANDS_TAGS = new Set(['see', 'draussen', 'drinnen', 'natur', 'aussicht', 'regional', 'historisch', 'stadt', 'ausflug', 'kultur', 'ausgehen', 'gratis', 'gemuetlich', 'gesellig', 'zuhause']);

function zeichenSchluessel(eintrag) {
  const ausTags = eintrag.tags
    .filter((tag) => !UMSTANDS_TAGS.has(auswahl.normText(tag)))
    .map((tag) => iconKeyForText(tag))
    .filter(Boolean);
  if (eintrag.art === 'restaurant') {
    return [...ausTags, iconKeyForText(eintrag.titel)].find((schluessel) => ESSEN_ZEICHEN.has(schluessel)) || ART_ZEICHEN.restaurant;
  }
  // Der Titel zählt nur, wenn es gar keine Tags gibt (ein schnell angelegter Eintrag) — sonst
  // wird aus „Poetry Slam im Spielboden" ein Würfel.
  const ausTitel = eintrag.tags.length ? null : iconKeyForText(eintrag.titel);
  return ausTags[0] || ausTitel || ART_ZEICHEN[eintrag.art] || 'funkeln';
}

function zeichen(eintrag, farbe, groesse) {
  return activityIconSvg({ iconKey: zeichenSchluessel(eintrag) }, farbe, groesse);
}

// Bildfläche: das Foto, sonst das Zeichen auf ruhigem Grund — dieselbe Machart wie die
// Meet-Kachel im Kalender. Ein Foto, das nicht lädt, räumt sich weg und lässt das Zeichen stehen.
function bildInhalt(eintrag, groesse) {
  const foto = eintrag.bild
    ? `<img src="${esc(eintrag.bild)}" alt="" loading="lazy" referrerpolicy="no-referrer" onerror="this.remove()">`
    : '';
  return `<span class="fnd-zeichen" aria-hidden="true">${zeichen(eintrag, 'var(--ink-soft)', groesse)}</span>${foto}`;
}

function anzeigePille() {
  return `<span class="fnd-pille fnd-glas fnd-leise" data-role="find-anzeige">${esc(tx('Anzeige'))}</span>`;
}

function tippPille() {
  return `<span class="fnd-pille fnd-tipp" data-role="find-tipp">${symbol('haken', 'var(--on-accent)', 11)}${esc(tx('Crew-Tipp'))}</span>`;
}

// Auf den Karten ist der Crew-Tipp kein zweites Schild, sondern ein grüner Haken IN der Zahl —
// ein Schild je Karte ist genug (weniger Visual Noise). Ausgeschrieben steht er im Blatt.
function scorePille(eintrag, tipp = false) {
  if (eintrag.score == null) return '';
  const wort = tipp ? tx('Score {wert}, Crew-Tipp', { wert: scoreText(eintrag.score) }) : tx('Score {wert}', { wert: scoreText(eintrag.score) });
  const haken = tipp ? symbol('haken', 'var(--green-dark)', 12) : '';
  return `<span class="fnd-pille fnd-glas" data-role="find-score" data-tipp="${tipp ? '1' : '0'}" aria-label="${esc(wort)}"${tipp ? ' style="color:var(--green-dark)"' : ''}>${haken}${esc(scoreText(eintrag.score))}</span>`;
}

// Was über dem Bild liegt: oben links „Anzeige", unten links der Score (mit Haken = Crew-Tipp).
function bildMarken(eintrag, stand) {
  const anzeige = eintrag.gesponsert ? `<span class="fnd-anzeige">${anzeigePille()}</span>` : '';
  const unten = scorePille(eintrag, stand.tipps.has(eintrag.id));
  return `${anzeige}${unten ? `<span class="fnd-marken">${unten}</span>` : ''}`;
}

// Heißt der Ort wie der Eintrag („Kornmesser" im „Kornmesser"), sagt er nichts Neues.
function ortWort(eintrag) {
  const name = eintrag.ort?.name || '';
  if (!name) return '';
  const a = auswahl.normText(name);
  const b = auswahl.normText(eintrag.titel);
  return a && (b.includes(a) || a.includes(b)) ? '' : name;
}

// Die Zeile unter dem Titel: wann (bei Terminen) und wo — und wo der Ort nichts Neues sagt, wie
// weit es ist (nur mit bekannter eigener Lage; geraten wird nichts).
function wannOderOrt(eintrag, stand = null) {
  const wann = wannKurz(eintrag);
  const ort = ortWort(eintrag);
  const weit = !wann && !ort && stand ? entfernungText(eintrag, stand) : '';
  return [wann, ort, weit].filter(Boolean).join(' · ');
}

// Eine Karte in einer Reihe: Bild, Titel, darunter wann und wo.
function karteHtml(eintrag, stand) {
  return `<button type="button" class="fnd-karte" data-act="find-oeffnen" data-id="${esc(eintrag.id)}" data-role="find-karte" data-anzeige="${eintrag.gesponsert ? '1' : '0'}" data-tipp="${stand.tipps.has(eintrag.id) ? '1' : '0'}">
<span class="fnd-bild">${bildInhalt(eintrag, 34)}${bildMarken(eintrag, stand)}</span>
<span class="fnd-titel">${esc(eintrag.titel)}</span>
<span class="fnd-unter"><span>${esc(wannOderOrt(eintrag, stand))}</span></span>
</button>`;
}

// =============================================================================================
// Der Finder
// =============================================================================================
// Die Wörter der Fragen und Antworten. find-auswahl.js kennt nur Kennungen — die Texte stehen
// HIER, einzeln ausgeschrieben, damit die Sprachprüfung sie findet (scripts/sprachen-pruefen.mjs).
function frageText(id) {
  switch (id) {
    case 'lust': return tx('Worauf hast du Lust?');
    case 'wo': return tx('Drinnen oder draußen?');
    case 'energie': return tx('Wie viel Energie hast du?');
    case 'anzahl': return tx('Mit wie vielen?');
    case 'budget': return tx('Was darf es kosten?');
    case 'wann': return tx('Wann?');
    case 'was': return tx('Was soll es sein?');
    default: return '';
  }
}

function antwortText(frage, option) {
  const schluessel = `${frage}:${option}`;
  switch (schluessel) {
    case 'lust:runterkommen': return tx('Runterkommen');
    case 'lust:leute': return tx('Unter Leute');
    case 'lust:auspowern': return tx('Auspowern');
    case 'lust:neues': return tx('Was Neues');
    case 'lust:feiern': return tx('Feiern');
    case 'lust:essen': return tx('Gut essen');
    case 'wo:draussen': return tx('Draußen');
    case 'wo:drinnen': return tx('Drinnen');
    case 'energie:wenig': return tk('Wenig', 'Energie');
    case 'energie:viel': return tk('Viel', 'Energie');
    case 'anzahl:zweit': return tx('Zu zweit');
    case 'anzahl:runde': return tx('Kleine Runde');
    case 'anzahl:viele': return tx('Große Gruppe');
    case 'budget:nichts': return tx('Kostenlos');
    case 'budget:wenig': return tk('Wenig', 'Budget');
    case 'budget:mehr': return tx('Darf was kosten');
    case 'wann:heute': return tx('Heute');
    case 'wann:wochenende': return tx('Am Wochenende');
    case 'was:event': return tx('Ein Event');
    case 'was:restaurant': return tx('Essen gehen');
    case 'was:erlebnis': return tx('Ein Erlebnis');
    default: return option;
  }
}

// =============================================================================================
// „Worauf hast du Lust?" — das Erlebnis (Runde 11, C2/D7)
// ---------------------------------------------------------------------------------------------
// Jonathan: „‚Worauf hast du Lust?' = schwebender Knopf über der Tab-Leiste wie FREE; startet ein
// Erlebnis aus ~4 Seiten." Vier Seiten: drei einfache Fragen und das Ergebnis. Die erste Frage ist
// immer „Worauf hast du Lust?"; die zwei danach wählt die Eingrenzung aus find-auswahl.js (die
// Frage, die unter dem, was übrig ist, am meisten entscheidet). Entscheidet keine mehr etwas, kommt
// das Ergebnis früher — keine Frage ohne Wirkung. Das Ergebnis sind Einträge aus den vorhandenen
// Daten, nichts Erfundenes; passt nichts, sagt die Seite das.
// Oben steht die Crew-Figur (ui/crew-figur.js): Sie blinzelt, und bevor das Ergebnis kommt, schaut
// sie kurz hin und her — sie „überlegt".
// Der Zustand lebt im UI-Zustand des Tabs — wer den Tab verlässt, findet beim Zurückkommen wieder
// die Seite (Runde 5, F1).
//   ctx.ui.finder = { antworten:[{frage, optionen}], auswahl:[…] (offene Mehrfachwahl), ergebnis, denkt }
const LUST_SEITEN = 4;
const LUST_FRAGEN = LUST_SEITEN - 1;
// So lange „überlegt" die Figur, bevor das Ergebnis kommt — kurz genug, um nicht zu warten.
const DENK_MS = 950;
const DENK_MS_RUHIG = 300;

function finderStand(stand, finder) {
  return auswahl.finderStand(stand.eintraege, finder.antworten, stand.jetzt, { max: LUST_FRAGEN });
}

function zurueckKnopf(act) {
  return `<button type="button" class="fnd-zurueck" data-act="${act}" data-role="find-zurueck" aria-label="${esc(tx('Zurück'))}">${symbol('zurueck', 'var(--ink)', 20)}</button>`;
}

// Kopf jeder Seite: zurück (ab Seite 2) und die vier Striche.
function erlebnisKopf(seite) {
  const zurueck = seite > 0 ? zurueckKnopf('find-zurueck') : '<span style="width:44px;flex:none"></span>';
  const striche = Array.from({ length: LUST_SEITEN }, (_, index) => `<span data-an="${index <= seite ? '1' : '0'}"></span>`).join('');
  return `<div class="fnd-erlebnis-kopf">${zurueck}<div class="fnd-fortschritt" data-role="find-fortschritt" data-seite="${seite + 1}" role="img" aria-label="${esc(tx('Seite {n} von {m}', { n: seite + 1, m: LUST_SEITEN }))}">${striche}</div><span style="width:44px;flex:none"></span></div>`;
}

function figurPlatz(zustand) {
  return `<div class="fnd-figur-platz">${crewFigur(zustand === 'denkt' ? 72 : 58, { zustand, rolle: 'find-figur' })}</div>`;
}

function finderSchrittHtml(stand, finder, zustand) {
  const frage = zustand.frage;
  const mehrfach = Boolean(frage.mehrfach);
  const gewaehlt = mehrfach ? finder.auswahl : [];
  // Was bliebe, wenn man JETZT zum Ergebnis ginge: mit der offenen Mehrfachwahl.
  const vorschau = mehrfach && gewaehlt.length
    ? auswahl.finderKandidaten(stand.eintraege, [...finder.antworten, { frage: frage.id, optionen: gewaehlt }], stand.jetzt).length
    : zustand.kandidaten.length;
  const knoepfe = zustand.optionen.map((option) => `<button type="button" class="fnd-chip" data-act="find-option" data-option="${esc(option.id)}" data-role="find-wahl" aria-pressed="${gewaehlt.includes(option.id) ? 'true' : 'false'}">${esc(antwortText(frage.id, option.id))}</button>`).join('');
  const seite = finder.antworten.length;
  // Mehrfachwahl: „Weiter" trägt die Wahl. Einfachwahl: ein Tipp auf eine Antwort IST weiter.
  // „Egal" überspringt die Frage — auf jeder Seite, damit niemand festhängt.
  const weiter = mehrfach
    ? `<button type="button" class="fnd-knopf" data-act="find-weiter" data-role="find-weiter" data-art="${gewaehlt.length ? 'haupt' : 'leise'}">${esc(gewaehlt.length ? tx('Weiter') : tx('Egal'))}</button>`
    : `<button type="button" class="fnd-knopf" data-act="find-weiter" data-role="find-weiter" data-art="leise">${esc(tx('Egal'))}</button>`;
  // Der Schritt trägt seine Nummer im NAMEN eines Merkmals: Der Abgleich (core/html.js) setzt
  // ihn dadurch für jede neue Frage frisch ein, und sie gleitet weich herein — ohne Sprung.
  return `<div class="fnd-erlebnis fnd-schritt" data-role="find-frage" data-frage="${esc(frage.id)}" data-schritt-${seite}="">
${erlebnisKopf(seite)}
${figurPlatz('wach')}
<h2 class="fnd-frage">${esc(frageText(frage.id))}</h2>
${mehrfach ? `<p class="fnd-hinweis">${esc(tx('Mehrere möglich'))}</p>` : ''}
<div class="fnd-wahl">${knoepfe}</div>
<div class="fnd-erlebnis-fuss">
${weiter}
<button type="button" class="fnd-textknopf" data-act="find-zeigen" data-role="find-zahl" data-zahl="${vorschau}" style="margin-top:4px">${esc(tn(vorschau, '{n} Idee jetzt zeigen', '{n} Ideen jetzt zeigen'))}</button>
</div>
</div>`;
}

// Eine Zeile (Ergebnis „Passt auch", Beste Restaurants, Gemerkt). `rang` stellt die Platzzahl davor.
function zeileHtml(eintrag, stand, { rang = 0 } = {}) {
  // „Anzeige" steht als eigenes Wort vorn in der Zeile — dieselbe Kennzeichnung wie die Pille auf dem Bild.
  const ort = wannOderOrt(eintrag, stand);
  const anzeige = eintrag.gesponsert ? `<span data-role="find-anzeige" style="flex:none;font-weight:650">${esc(tx('Anzeige'))}</span>${ort ? '<span aria-hidden="true" style="flex:none">·</span>' : ''}` : '';
  const tipp = stand.tipps.has(eintrag.id);
  return `<button type="button" class="fnd-zeile" data-act="find-oeffnen" data-id="${esc(eintrag.id)}" data-role="find-zeile" data-anzeige="${eintrag.gesponsert ? '1' : '0'}">
${rang ? `<span class="fnd-rang" aria-hidden="true">${rang}</span>` : ''}<span class="fnd-daumen">${bildInhalt(eintrag, 22)}</span>
<span class="fnd-zeile-text"><span class="fnd-zeile-titel">${esc(eintrag.titel)}</span><span class="fnd-unter">${anzeige}<span>${esc(ort)}</span></span></span>
${eintrag.score == null ? '' : `<span class="fnd-score" data-role="find-score" data-tipp="${tipp ? '1' : '0'}"${tipp ? ' style="color:var(--green-dark);gap:3px"' : ''}>${tipp ? symbol('haken', 'var(--green-dark)', 11) : ''}${esc(scoreText(eintrag.score))}</span>`}
</button>`;
}

function finderErgebnisHtml(stand, finder, zustand) {
  if (finder.denkt) {
    return `<div class="fnd-erlebnis fnd-schritt" data-role="find-ergebnis" data-denkt="1" data-schritt-d="">
${erlebnisKopf(LUST_SEITEN - 1)}
<div class="fnd-denkt" role="status">${crewFigur(84, { zustand: 'denkt', rolle: 'find-figur' })}<span>${esc(tx('Ich schaue, was passt …'))}</span></div>
</div>`;
  }
  const liste = zustand.kandidaten.slice(0, ERGEBNIS_ZAHL).map((kandidat) => kandidat.eintrag);
  if (!liste.length) {
    return `<div class="fnd-erlebnis fnd-schritt" data-role="find-ergebnis" data-schritt-e="">
${erlebnisKopf(LUST_SEITEN - 1)}
${figurPlatz('wach')}
<h2 class="fnd-frage">${esc(tx('Dazu passt gerade nichts.'))}</h2>
<div class="fnd-erlebnis-fuss"><button type="button" class="fnd-knopf" data-act="find-von-vorn" data-art="haupt">${esc(tx('Nochmal von vorn'))}</button></div>
</div>`;
  }
  const [erster, ...rest] = liste;
  const gross = `<button type="button" class="fnd-gross" data-act="find-oeffnen" data-id="${esc(erster.id)}" data-role="find-bester" data-anzeige="${erster.gesponsert ? '1' : '0'}">
<span class="fnd-bild">${bildInhalt(erster, 44)}${bildMarken(erster, stand)}</span>
<span class="fnd-gross-titel">${esc(erster.titel)}</span>
<span class="fnd-unter"><span>${esc(wannOderOrt(erster, stand))}</span></span>
</button>`;
  const weitere = rest.length
    ? `<span class="fnd-label">${esc(tx('Passt auch'))}</span>${rest.map((eintrag) => zeileHtml(eintrag, stand)).join('')}`
    : '';
  return `<div class="fnd-erlebnis fnd-schritt" data-role="find-ergebnis" data-schritt-e="">
${erlebnisKopf(LUST_SEITEN - 1)}
<h2 class="fnd-frage" style="text-align:left;margin-top:6px">${esc(tx('Wie wär’s damit?'))}</h2>
${gross}
<div class="fnd-aktionen"><button type="button" class="fnd-knopf" data-act="find-planen" data-id="${esc(erster.id)}" data-art="haupt">${esc(tx('Meet planen'))}</button></div>
${weitere}
<button type="button" class="fnd-textknopf" data-act="find-von-vorn">${esc(tx('Nochmal von vorn'))}</button>
</div>`;
}

function finderBlatt(stand, finder) {
  const zustand = finderStand(stand, finder);
  const ergebnis = finder.ergebnis || zustand.fertig;
  const inhalt = ergebnis ? finderErgebnisHtml(stand, finder, zustand) : finderSchrittHtml(stand, finder, zustand);
  return sheet(`<div class="fnd-blatt" data-role="find-finder-blatt">${inhalt}</div>`, { closeAct: 'find-finder-zu', scrollKey: `find-finder-${finder.antworten.length}-${ergebnis ? 'e' : 'f'}` });
}

// =============================================================================================
// Das Blatt eines Eintrags
// =============================================================================================
function merkenZeichen(an) {
  // Ein Lesezeichen — nach den Regeln des Symbolkatalogs (24er-Feld, Strich 1.8, runde Ecken).
  // Es fehlt in ui/symbole.js (steht im Bericht für den Chef); bis dahin zeichnet es diese Seite.
  const pfad = 'M7 3.6h10a1.4 1.4 0 0 1 1.4 1.4v15.6l-6.4-4.4-6.4 4.4V5A1.4 1.4 0 0 1 7 3.6Z';
  return `<svg width="17" height="17" viewBox="0 0 24 24" fill="none" aria-hidden="true" style="display:block;flex:none;pointer-events:none"><path d="${pfad}" stroke="currentColor" stroke-width="1.8" stroke-linejoin="round" fill="${an ? 'currentColor' : 'none'}"></path></svg>`;
}

function entfernungText(eintrag, stand) {
  if (!auswahl.hatKoordinaten(eintrag) || !stand.lage || !Number.isFinite(Number(stand.lage.lat))) return '';
  const km = entfernungKm({ lat: Number(stand.lage.lat), lon: Number(stand.lage.lon) }, { lat: eintrag.ort.lat, lon: eintrag.ort.lon });
  return km == null ? '' : tx('{km} km', { km: kmText(km) });
}

// Freie Bildlizenzen (CC BY, CC BY-SA) verlangen die Namensnennung. Sie steht wie in „Entdecken"
// einen Tipp entfernt hinter einem ⓘ auf dem Bild (Runde 4, G4: „nur ein i").
function bildNachweis(eintrag, offen) {
  if (!eintrag.bild || !eintrag.bildUrheber) return '';
  const knopf = `<button type="button" data-act="find-foto" data-id="${esc(eintrag.id)}" data-role="find-foto" aria-label="${esc(tx('Bildnachweis'))}" aria-expanded="${offen ? 'true' : 'false'}" style="position:absolute;right:3px;top:3px;width:44px;height:44px;border:0;background:transparent;padding:0;display:flex;align-items:center;justify-content:center;cursor:pointer;appearance:none;z-index:4"><span style="width:26px;height:26px;border-radius:50%;background:var(--glass);-webkit-backdrop-filter:blur(10px);backdrop-filter:blur(10px);box-shadow:0 1px 4px var(--shadow-10);display:flex;align-items:center;justify-content:center;pointer-events:none">${symbol('info', 'var(--ink)', 15)}</span></button>`;
  const tafel = offen
    ? `<div data-role="find-foto-nachweis" style="position:absolute;left:8px;right:50px;top:8px;z-index:4;background:var(--glass);-webkit-backdrop-filter:blur(14px);backdrop-filter:blur(14px);border-radius:12px;padding:8px 11px;box-shadow:0 2px 10px var(--shadow-14);display:flex;flex-direction:column;gap:2px;text-align:left">
<span style="font-size:11.5px;font-weight:650;color:var(--ink);line-height:1.3">${esc(tx('Foto: {urheber}', { urheber: eintrag.bildUrheber }))}</span>
${eintrag.bildSeite ? `<a href="${esc(eintrag.bildSeite)}" target="_blank" rel="noopener" style="font-size:11.5px;font-weight:650;color:var(--green-dark);text-decoration:none;padding:5px 0 1px">${esc(tx('Quelle öffnen'))} ›</a>` : ''}
</div>`
    : '';
  return `${tafel}${knopf}`;
}

// Runde 11 (C2): WARUM diese Zahl — die Teile der Rechnung (projections.js › findScoreTeile).
// Jonathan sah denselben Eintrag mit 60 und mit 50 Punkten und wusste nicht, wieso: Die Rechnung
// ist für jede Person anders (Interessen, Nähe, Gelerntes). Jetzt steht es da.
function scoreGrundText(teil) {
  switch (teil.grund) {
    case 'interesse': return tx('„{wort}“ steht im Eintrag', { wort: wort(teil.wort || '') });
    case 'art': return tx('Passt zu deinem Interesse „{wort}“', { wort: wort(teil.wort || '') });
    case 'gelernt': return tx('Aus dem, was du gewählt und übergangen hast');
    case 'naehe': return tx('Nah bei dir · {km} km', { km: kmText(teil.km) });
    case 'weit': return tx('Weit weg · {km} km', { km: kmText(teil.km) });
    case 'bald': return tx('Beginnt bald');
    default: return '';
  }
}

function scoreGruendeHtml(eintrag) {
  if (eintrag.score == null) return '';
  const zeilen = (eintrag.scoreGruende || [])
    .map((teil) => ({ wert: Math.round(Number(teil.wert)), text: scoreGrundText(teil) }))
    .filter((teil) => teil.text && teil.wert);
  const vorzeichen = (wert) => (wert > 0 ? `+${zahl(wert, 0)}` : `−${zahl(Math.abs(wert), 0)}`);
  const zeile = (wert, text) => `<span class="fnd-grund"><b>${esc(wert)}</b><span>${esc(text)}</span></span>`;
  return `<div class="fnd-gruende" data-role="find-score-gruende">${zeile(zahl(FIND_GRUNDWERT, 0), tx('Grundwert'))}${zeilen.map((teil) => zeile(vorzeichen(teil.wert), teil.text)).join('')}</div>`;
}

function detailBlatt(stand, eintrag, offenerNachweis = false) {
  const gemerkt = stand.gemerkt.has(eintrag.id);
  const koordinaten = auswahl.hatKoordinaten(eintrag);
  const wann = wannLang(eintrag);
  const ortName = ortWort(eintrag) || (koordinaten ? tx('Auf der Karte') : eintrag.ort?.name || '');
  const ortZeile = [ortName, entfernungText(eintrag, stand)].filter(Boolean).join(' · ');
  const fakten = [
    wann ? `<span class="fnd-fakt" data-role="find-wann">${symbol('kalender', 'var(--muted)', 17)}<span>${esc(wann)}</span></span>` : '',
    ortZeile
      ? (koordinaten
        ? `<button type="button" class="fnd-fakt" data-act="find-karte-gross" data-id="${esc(eintrag.id)}" data-role="find-ort">${symbol('ort', 'var(--muted)', 17)}<span>${esc(ortZeile)}</span></button>`
        : `<span class="fnd-fakt" data-role="find-ort">${symbol('ort', 'var(--muted)', 17)}<span>${esc(ortZeile)}</span></span>`)
      : '',
  ].join('');
  // Score und Tester-Bewertung stehen GETRENNT: zwei Zeilen, zwei Namen. Die Tester-Zeile sagt
  // dazu, dass sie nicht in den Score einfließt (R8-50).
  const scoreZeile = eintrag.score == null ? '' : `<div class="fnd-wertung-zeile" data-role="find-wertung-score">
<span class="fnd-score" style="min-width:40px;height:30px;font-size:14px">${esc(scoreText(eintrag.score))}</span>
<span class="fnd-wertung-wort">${esc(tx('Score'))}</span>
${stand.tipps.has(eintrag.id) ? tippPille() : ''}
</div>${scoreGruendeHtml(eintrag)}`;
  const tester = eintrag.tester;
  // Eine Bewertung aus dem Beispielbestand ist als solche gekennzeichnet (repository.js). Ihr
  // Text beginnt meist schon mit „Beispiel:" — dann steht das Wort nicht noch einmal da.
  const beispielWort = tx('Beispiel');
  const beispiel = tester?.beispiel && !tester.text.toLowerCase().startsWith(beispielWort.toLowerCase())
    ? ` <span style="font-weight:500;color:var(--muted)">· ${esc(beispielWort)}</span>`
    : '';
  const testerZeile = tester ? `<div class="fnd-wertung-zeile" data-role="find-wertung-tester" style="align-items:flex-start;padding:12px 0">
<span class="fnd-score" style="min-width:40px;height:30px;font-size:14px;background:var(--surface)">${tester.note == null ? '–' : esc(zahl(tester.note, 1))}</span>
<span class="fnd-wertung-wort"><span>${esc(tx('Getestet'))}${beispiel}</span>${tester.text ? `<span class="fnd-zitat">„${esc(tester.text)}“</span>` : ''}<small>${esc(tester.note == null ? tx('Zählt nicht zum Score.') : tx('von 5 · zählt nicht zum Score'))}</small></span>
</div>` : '';
  const wertung = scoreZeile || testerZeile ? `<div class="fnd-wertung" data-role="find-wertung">${scoreZeile}${testerZeile}</div>` : '';
  const anzeige = eintrag.gesponsert ? `<span class="fnd-anzeige">${anzeigePille()}</span>` : '';
  const inhalt = `<div class="fnd-blatt" data-role="find-detail" data-id="${esc(eintrag.id)}">
<div class="fnd-detail-bild">${bildInhalt(eintrag, 52)}${anzeige}${bildNachweis(eintrag, offenerNachweis)}</div>
<h2 class="fnd-detail-titel">${esc(eintrag.titel)}</h2>
<div class="fnd-fakten">${fakten}</div>
${wertung}
<div class="fnd-aktionen">
<button type="button" class="fnd-knopf" data-act="find-planen" data-id="${esc(eintrag.id)}" data-art="haupt">${esc(tx('Meet planen'))}</button>
<div class="fnd-aktionen-reihe">
<button type="button" class="fnd-knopf" data-act="find-merken" data-id="${esc(eintrag.id)}" data-role="find-merken" aria-pressed="${gemerkt ? 'true' : 'false'}" data-art="leise">${merkenZeichen(gemerkt)}<span>${esc(gemerkt ? tx('Gemerkt') : tx('Merken'))}</span></button>
${koordinaten ? `<button type="button" class="fnd-knopf" data-act="find-karte-gross" data-id="${esc(eintrag.id)}" data-art="leise">${symbol('karte', 'currentColor', 17)}<span>${esc(tx('Karte'))}</span></button>` : ''}
</div>
</div>
</div>`;
  return sheet(inhalt, { closeAct: 'find-detail-zu', scrollKey: `find-detail-${eintrag.id}` });
}

// =============================================================================================
// Admin: einen Eintrag anlegen (repo.istAdmin() / repo.addFindEintrag)
// ---------------------------------------------------------------------------------------------
// Schlicht: Titel, Art, Ort (Suche), Zeit, Tester-Bewertung, Stichworte, Anzeige. KEIN Score —
// der wird gerechnet, nicht eingetragen (projections.js › findScore). Geprüft wird an EINER
// Stelle, in der Datenschicht (projections.js › findEintragPruefen): Das Formular übersetzt nur
// die Felder in die Vertragsform und zeigt, welches Feld die Prüfung abgelehnt hat.
// =============================================================================================
const NEU_LEER = Object.freeze({ titel: '', art: 'event', ortSuche: '', ort: null, datum: '', von: '', bis: '', note: '', text: '', anzeige: false, tags: '' });

function neuWert(ui) {
  const neu = ui.findNeu || {};
  return { ...NEU_LEER, ...neu, treffer: undefined, sucht: undefined, fehler: undefined };
}

// `fehler` ist das Feld, das die Prüfung genannt hat (repository.js › addFindEintrag).
function neuFehlerText(fehler) {
  switch (fehler) {
    case 'titel': return tx('Titel fehlt.');
    case 'ort': return tx('Wähle einen Ort aus der Suche.');
    case 'wann': return tx('Ein Event braucht Datum, Beginn und Ende.');
    case 'testerBewertung': return tx('Die Tester-Note geht von 1 bis 5, in halben Schritten.');
    case 'keinAdmin': return tx('Das dürfen nur Admins.');
    case '': case null: case undefined: return '';
    default: return tx('Gerade geht das nicht');
  }
}

function neuBlatt(ctx) {
  const neu = ctx.ui.findNeu;
  const arten = [['event', tx('Event')], ['restaurant', tx('Restaurant')], ['erlebnis', tx('Erlebnis')]];
  const segment = arten.map(([id, wortArt]) => `<button type="button" data-act="find-neu-art" data-art-wahl="${id}" aria-pressed="${neu.art === id ? 'true' : 'false'}">${esc(wortArt)}</button>`).join('');
  const frage = String(neu.ortSuche || '').trim();
  const trefferListe = neu.ort
    ? `<button type="button" class="fnd-treffer" data-act="find-neu-ort-weg" data-role="find-neu-ort">${symbol('haken', 'var(--green-dark)', 17)}<span style="flex:1;min-width:0;display:flex;flex-direction:column;gap:1px"><span style="font-size:14px;font-weight:650;white-space:nowrap;overflow:hidden;text-overflow:ellipsis">${esc(neu.ort.name)}</span><span style="font-size:11.5px;color:var(--muted);white-space:nowrap;overflow:hidden;text-overflow:ellipsis">${esc(neu.ort.adresse || '')}</span></span>${symbol('kreuz', 'var(--muted)', 14)}</button>`
    : (frage.length < 2
      ? ''
      : ((neu.treffer || []).length
        ? neu.treffer.map((ort, index) => `<button type="button" class="fnd-treffer" data-act="find-neu-ort" data-index="${index}" data-role="find-neu-treffer">${symbol('ort', 'var(--muted)', 17)}<span style="flex:1;min-width:0;display:flex;flex-direction:column;gap:1px"><span style="font-size:14px;font-weight:600;white-space:nowrap;overflow:hidden;text-overflow:ellipsis">${esc(ort.name)}</span><span style="font-size:11.5px;color:var(--muted);white-space:nowrap;overflow:hidden;text-overflow:ellipsis">${esc(ort.address || '')}</span></span></button>`).join('')
        : `<span style="display:block;font-size:12.5px;color:var(--muted);padding:10px 2px">${esc(neu.sucht ? tx('Suche läuft …') : tx('Kein Ort gefunden'))}</span>`));
  const inhalt = `<div class="fnd-blatt" data-role="find-neu">
<h2 class="fnd-frage">${esc(tx('Neuer Eintrag'))}</h2>
<div class="fnd-form">
<input id="find-neu-titel" class="fnd-feld" type="text" autocomplete="off" maxlength="80" placeholder="${esc(tx('Titel'))}" aria-label="${esc(tx('Titel'))}">
<div class="fnd-segment" role="group" aria-label="${esc(tx('Art'))}">${segment}</div>
<input id="find-neu-ort" class="fnd-feld" type="search" inputmode="search" autocomplete="off" placeholder="${esc(tx('Ort suchen'))}" aria-label="${esc(tx('Ort suchen'))}"${neu.ort ? ' hidden' : ''}>
<div data-role="find-neu-orte">${trefferListe}</div>
<input id="find-neu-datum" class="fnd-feld" type="date" aria-label="${esc(tx('Datum'))}">
<div class="fnd-form-zeile">
<label class="fnd-zeit"><span>${esc(tx('Von'))}</span><input id="find-neu-von" class="fnd-feld" type="time" aria-label="${esc(tx('Von'))}"></label>
<label class="fnd-zeit"><span>${esc(tx('Bis'))}</span><input id="find-neu-bis" class="fnd-feld" type="time" aria-label="${esc(tx('Bis'))}"></label>
</div>
<input id="find-neu-note" class="fnd-feld" type="text" inputmode="decimal" autocomplete="off" placeholder="${esc(tx('Tester-Note (1 bis 5)'))}" aria-label="${esc(tx('Tester-Note (1 bis 5)'))}">
<input id="find-neu-text" class="fnd-feld" type="text" autocomplete="off" maxlength="280" placeholder="${esc(tx('Was der Tester sagt'))}" aria-label="${esc(tx('Was der Tester sagt'))}">
<input id="find-neu-tags" class="fnd-feld" type="text" autocomplete="off" placeholder="${esc(tx('Stichworte, mit Komma getrennt'))}" aria-label="${esc(tx('Stichworte, mit Komma getrennt'))}">
<button type="button" class="fnd-schalter" data-act="find-neu-anzeige" aria-pressed="${neu.anzeige ? 'true' : 'false'}"><span>${esc(tx('Anzeige (bezahlt)'))}</span><span class="fnd-schalter-spur" aria-hidden="true"></span></button>
<p class="fnd-fehler" data-role="find-neu-fehler"${neu.fehler ? '' : ' hidden'}>${esc(neuFehlerText(neu.fehler))}</p>
</div>
<div class="fnd-aktionen"><button type="button" class="fnd-knopf" data-act="find-neu-anlegen" data-art="haupt">${esc(tx('Hinzufügen'))}</button></div>
</div>`;
  return sheet(inhalt, { closeAct: 'find-neu-zu', scrollKey: 'find-neu' });
}

// Die Felder tragen KEIN value im Markup: Der Abgleich fasst sie so nie an, der Fokus bleibt
// beim Tippen stehen (dieselbe Regel wie im Profil › Zuhause).
const NEU_FELDER = [['find-neu-titel', 'titel'], ['find-neu-ort', 'ortSuche'], ['find-neu-datum', 'datum'], ['find-neu-von', 'von'], ['find-neu-bis', 'bis'], ['find-neu-note', 'note'], ['find-neu-text', 'text'], ['find-neu-tags', 'tags']];

let ortSucheNummer = 0;
let ortSucheUhr = null;

function ortSuche(ctx) {
  const neu = ctx.ui.findNeu;
  if (!neu) return;
  clearTimeout(ortSucheUhr);
  const frage = String(neu.ortSuche || '').trim();
  if (frage.length < 2) { neu.treffer = []; neu.sucht = false; ctx.render(); return; }
  const meine = (ortSucheNummer += 1);
  // Erst die Orte, die die App schon kennt — ohne Netz bleiben die übrig, statt einer leeren Liste.
  const bekannt = (typeof ctx.repo.searchPlaces === 'function' ? ctx.repo.searchPlaces(frage) || [] : [])
    .filter((ort) => Number.isFinite(Number(ort.lat)) && Number.isFinite(Number(ort.lon)));
  neu.treffer = bekannt.slice(0, 6);
  neu.sucht = true;
  ctx.render();
  ortSucheUhr = setTimeout(async () => {
    let gefunden = [];
    try { gefunden = await ortSuchen(frage, { limit: 6 }); } catch { gefunden = []; }
    if (meine !== ortSucheNummer || ctx.ui.findNeu !== neu) return;
    const liste = [...bekannt];
    for (const ort of gefunden || []) {
      if (!Number.isFinite(Number(ort.lat)) || !Number.isFinite(Number(ort.lon))) continue;
      if (!liste.some((da) => String(da.name).toLowerCase() === String(ort.name).toLowerCase())) liste.push(ort);
    }
    neu.treffer = liste.slice(0, 6);
    neu.sucht = false;
    ctx.render();
  }, 280);
}

// Zeitpunkt aus Datum ('YYYY-MM-DD') und Uhrzeit ('HH:MM') in Gerätezeit — null, wenn eins fehlt.
function msAus(datum, uhrzeit, tageDazu = 0) {
  const tag = /^(\d{4})-(\d{2})-(\d{2})$/.exec(String(datum || ''));
  const zeit = /^(\d{1,2}):(\d{2})$/.exec(String(uhrzeit || ''));
  if (!tag || !zeit) return null;
  return new Date(Number(tag[1]), Number(tag[2]) - 1, Number(tag[3]) + tageDazu, Number(zeit[1]), Number(zeit[2])).getTime();
}

// Aus dem Formular wird genau die Vertragsform (repository.js › addFindEintrag): Termin in
// Millisekunden, ein Ende vor dem Beginn liegt am Folgetag (Konzert bis 1 Uhr). Was fehlt, geht
// als Lücke mit — die Prüfung der Datenschicht sagt dann, welches Feld (neuFehlerText).
function neuEintragBauen(neu) {
  const eintrag = {
    titel: String(neu.titel || '').trim(),
    art: auswahl.ARTEN.includes(neu.art) ? neu.art : 'event',
    gesponsert: Boolean(neu.anzeige),
    tags: String(neu.tags || '').split(',').map((tag) => tag.trim()).filter(Boolean),
  };
  if (neu.ort) eintrag.ort = { name: neu.ort.name, lat: Number(neu.ort.lat), lon: Number(neu.ort.lon) };
  if (neu.datum || neu.von || neu.bis) {
    const von = msAus(neu.datum, neu.von);
    let bis = msAus(neu.datum, neu.bis);
    if (von != null && bis != null && bis <= von) bis = msAus(neu.datum, neu.bis, 1);
    eintrag.wann = { von, bis };
  }
  const noteRoh = String(neu.note ?? '').trim().replace(',', '.');
  const text = String(neu.text || '').trim();
  if (noteRoh || text) eintrag.testerBewertung = { note: noteRoh ? Number(noteRoh) : null, text };
  return eintrag;
}

function neuFelderBinden(root, ctx) {
  const neu = ctx.ui.findNeu;
  if (!neu) return;
  for (const [id, feld] of NEU_FELDER) {
    const knoten = root.querySelector(`#${id}`);
    if (!knoten) continue;
    if (document.activeElement !== knoten && knoten.value !== String(neu[feld] ?? '')) knoten.value = String(neu[feld] ?? '');
    knoten.addEventListener('input', () => {
      const aktuell = ctx.ui.findNeu;
      if (!aktuell) return;
      aktuell[feld] = knoten.value;
      if (aktuell.fehler) {
        aktuell.fehler = null;
        const zeile = root.querySelector('[data-role="find-neu-fehler"]');
        if (zeile) zeile.hidden = true;
      }
      if (feld === 'ortSuche') ortSuche(ctx);
    });
  }
}

// =============================================================================================
// Die eigene Karte (vorhandene Bausteine aus ui/map.js — nur benutzt, nicht verändert)
// =============================================================================================
function kartenRumpf(stand) {
  const mitOrt = auswahl.kartenOrte(stand.eintraege, stand.jetzt).length;
  const leer = mitOrt ? '' : `<div data-role="find-karte-hinweis" style="position:absolute;left:0;right:0;top:34px;z-index:5;display:flex;justify-content:center;padding:0 16px;pointer-events:none"><span data-ueber-karte style="background:var(--surface);border-radius:999px;padding:8px 13px;box-shadow:0 4px 14px var(--shadow-14);font:600 12.5px/1 ${FONT};color:var(--ink-soft);white-space:nowrap">${esc(tx('Nichts auf der Karte'))}</span></div>`;
  const streifen = (seite) => `<div data-role="find-karte-rand" data-seite="${seite}" aria-hidden="true" style="position:absolute;${seite}:0;top:0;bottom:${seite === 'right' ? RAND_UNTEN_FREI : 0}px;width:${RAND_ZONE}px;z-index:4"></div>`;
  return `<div data-map-viewport="find" style="height:100%;position:relative;background:var(--field);overflow:hidden">
<div data-fremd="1" data-role="find-karte-flaeche" style="position:absolute;inset:0;z-index:0"></div>
${streifen('left')}${streifen('right')}
${leer}
</div>`;
}

function kartenMarken(stand) {
  return auswahl.kartenOrte(stand.eintraege, stand.jetzt).map((ort, rang) => ({
    key: `find:${ort.key}`,
    lat: ort.lat,
    lon: ort.lon,
    rang,
    eintraege: ort.eintraege.map((eintrag) => {
      const unter = [eintrag.gesponsert ? tx('Anzeige') : '', wannKurz(eintrag)].filter(Boolean).join(' · ');
      return {
        id: eintrag.id,
        zeichen: zeichen(eintrag, 'currentColor', 15),
        titel: kurzName(eintrag.titel),
        unter,
        ton: '',
        attrs: `data-act="find-oeffnen" data-id="${esc(eintrag.id)}"`,
        label: [eintrag.titel, unter].filter(Boolean).join(', '),
      };
    }),
  }));
}

// Der rechte Randstreifen endet über der Bedienspalte der Karte (Höhenregler, ⓘ) — ein Ausgang
// darf der Karte nicht ihre eigene Bedienung nehmen (dieselbe Messung wie auf dem Karten-Tab).
function randAnpassen(flaeche, karte) {
  const streifen = flaeche?.parentElement?.querySelector('[data-role="find-karte-rand"][data-seite="right"]');
  if (!streifen || !karte) return;
  const hoehe = flaeche.clientHeight || 0;
  const oben = (bedienFlaechen(karte) || []).filter((f) => f && f.u > 0).reduce((wert, f) => Math.min(wert, f.o), hoehe);
  const rest = Math.max(0, Math.round(oben - 10));
  streifen.style.bottom = rest > 90 ? `${Math.max(0, hoehe - rest)}px` : `${RAND_UNTEN_FREI}px`;
}

// Ein reiner Tipp auf einen Randstreifen gehört dem, was darunter liegt.
function randDurchreichen(flaeche) {
  const rumpf = flaeche?.parentElement;
  if (!rumpf || rumpf.__findRand) return;
  rumpf.__findRand = true;
  rumpf.querySelectorAll('[data-role="find-karte-rand"]').forEach((streifen) => {
    streifen.addEventListener('click', (ereignis) => {
      streifen.style.pointerEvents = 'none';
      const darunter = document.elementFromPoint(ereignis.clientX, ereignis.clientY);
      streifen.style.pointerEvents = '';
      if (!darunter || darunter === streifen) return;
      darunter.dispatchEvent(new MouseEvent('click', { bubbles: true, cancelable: true, clientX: ereignis.clientX, clientY: ereignis.clientY }));
    });
  });
}

function karteEinrichten(root, ctx, stand) {
  const knoten = root?.querySelector('[data-role="find-karte-flaeche"]');
  if (!knoten) return;
  const marken = kartenMarken(stand);
  const start = startAnsicht(stand.settings);
  const stehend = karteVon(KARTE_SCHLUESSEL);
  const fertig = (karte) => {
    if (!karte || !knoten.isConnected) return;
    karte.resize?.();
    try { kartenLageQuelle?.(ctx.repo); } catch { /* ohne Lage bleibt der eigene Punkt weg */ }
    ortMarken(karte, { schluessel: 'find-orte', rang: 1 })?.setzen(marken);
    bedienSpalteOrdnen?.(karte);
    randDurchreichen(knoten);
    const randStellen = () => randAnpassen(knoten, karte);
    randStellen();
    requestAnimationFrame(() => { randStellen(); requestAnimationFrame(randStellen); });
    if (!karte.__findRand) { karte.__findRand = true; karte.on('resize', randStellen); }
    // Der erste Ausschnitt zeigt alles, was da ist; danach gehört er dem Menschen.
    if (!karte.__findGestellt) {
      karte.__findGestellt = true;
      const punkte = marken.map(({ lat, lon }) => ({ lat, lon }));
      const rand = { top: 70, bottom: 60, left: RAND_ZONE + 12, right: (KARTEN_SPALTE?.frei || 64) + 24 };
      const einpassen = () => punkte.length && passeAufPunkte(karte, punkte, { padding: rand, maxZoom: 14.5 });
      einpassen();
      if (!karte.loaded()) karte.once('load', einpassen);
    }
  };
  if (stehend && stehend.getContainer?.() === knoten) { fertig(stehend); return; }
  karteHalten(knoten, KARTE_SCHLUESSEL, { mitte: start.mitte, zoom: start.zoom, folgen: false, hoehenRegler: true })
    .then(fertig)
    .catch(() => {});
}

// =============================================================================================
// Handlungen
// =============================================================================================
function kategorieVon(eintrag) {
  if (eintrag.art === 'restaurant') return 'essen';
  if (eintrag.art === 'event') return 'event';
  if (/\b(sport\w*|wander\w*|kletter\w*|boulder\w*|rad|bike\w*|surf\w*|sup|ski\w*|lauf\w*|yoga|fitness|schwimm\w*|paddel\w*|kajak\w*)\b/.test(eintrag.text)) return 'sport';
  if (/\b(wellness|sauna\w*|therme\w*|chill\w*|entspann\w*|picknick\w*)\b/.test(eintrag.text)) return 'chillen';
  return 'ausgehen';
}

// „Meet planen": ein Entwurf mit Idee, Ort und — bei einem Termin — der Zeit. Dieselbe Form, die
// „Entdecken" schreibt (new-meet.js › applySelection): Der Ort gehört zur Idee (auto), wer die
// Idee im Entwurf tauscht, tauscht den Ort mit. Danach geht es in denselben Ablauf wie überall.
function meetPlanen(ctx, eintrag) {
  const { repo, nav, ui } = ctx;
  const entwurf = typeof repo.createDraft === 'function' ? repo.createDraft({}) : null;
  if (!entwurf?.id || typeof repo.updateDraft !== 'function') {
    rueckmeldung('abgelehnt');
    ctx.toast?.(tx('Gerade geht das nicht'));
    return;
  }
  const koordinaten = auswahl.hatKoordinaten(eintrag);
  const ort = eintrag.ort?.name || koordinaten
    ? {
      name: eintrag.ort?.name || eintrag.titel,
      address: eintrag.ort?.adresse || '',
      ...(koordinaten ? { lat: eintrag.ort.lat, lon: eintrag.ort.lon } : {}),
    }
    : null;
  const patch = {
    idea: {
      title: eintrag.titel,
      icon: null,
      iconKey: zeichenSchluessel(eintrag),
      category: kategorieVon(eintrag),
      details: '',
      source: 'find',
      suggestionId: null,
      ownId: null,
      findId: eintrag.id,
      place: ort ? { ...ort, mode: 'search' } : null,
    },
    ideaAlternatives: [],
  };
  if (ort) patch.place = { ...ort, mode: 'search', auto: true };
  if (eintrag.wann) patch.when = { date: toISODate(new Date(eintrag.wann.von)), time: zeitText(eintrag.wann.von), open: false };
  repo.updateDraft(entwurf.id, patch);
  rueckmeldung('tipp');
  ui.findDetail = null;
  ui.finder = null;
  nav.go('newMeet.discover', { draftId: entwurf.id });
}

function merken(ctx, id) {
  const settings = ctx.repo.getSettings?.() || {};
  const vorher = Array.isArray(settings.gemerktIds) ? settings.gemerktIds : [];
  const nachher = auswahl.merkenUmschalten(vorher, id);
  if (typeof ctx.repo.updateSettings !== 'function') { ctx.toast?.(tx('Gerade geht das nicht')); return; }
  ctx.repo.updateSettings({ gemerktIds: nachher });
  rueckmeldung(nachher.includes(id) ? 'erfolg' : 'tipp');
  ctx.render();
}

function karteGross(stand, eintrag) {
  if (!auswahl.hatKoordinaten(eintrag)) return;
  karteGrossOeffnen({
    titel: eintrag.titel,
    adresse: eintrag.ort.name || '',
    unter: wannKurz(eintrag),
    lat: eintrag.ort.lat,
    lon: eintrag.ort.lon,
    zeichen: zeichen(eintrag, 'currentColor', 20),
  });
}

function finderNeu(ui) {
  ui.finder = { antworten: [], auswahl: [], ergebnis: false, denkt: false };
}

// =============================================================================================
// Die Seite (Runde 11, C2/D7)
// ---------------------------------------------------------------------------------------------
// Jonathan: „Hero oben, höchstens 1,5 Bildschirme. Reihenfolge: Hero (bester Tipp) → Dieses
// Wochenende → Beste Restaurants (weit oben) → Erlebnisse → Zuhause. Nicht alles als Reihe."
//   · Hero: der beste Tipp groß, mit „Meet planen" direkt darunter (eine Handlung weniger).
//   · Dieses Wochenende und Erlebnisse: Reihen mit Bildern (hier lohnt das Stöbern).
//   · Beste Restaurants: eine Rangliste — drei Plätze, „Alle zeigen" für den Rest.
//   · Zuhause: kleine Kacheln ohne Bild (es gibt keinen Ort und kein Foto dazu).
//   · Gemerktes steht nicht mehr als Reihe unten, sondern hinter dem Lesezeichen im Kopf.
//   · „Worauf hast du Lust?" und Karte/Liste schweben über der Tab-Leiste (wie FREE).
// Was wo steht, entscheidet data/find-auswahl.js › findUebersicht.
// =============================================================================================
const SCHWEBE_HOEHE = 84;

function kopf(ctx, stand, gemerktZahl) {
  const knoepfe = [
    gemerktZahl ? `<button type="button" class="fnd-rund" data-act="find-gemerkt" data-role="find-gemerkt-knopf" aria-label="${esc(`${tk('Gemerkt', 'Liste')} (${gemerktZahl})`)}"><span style="pointer-events:none;display:flex;color:var(--ink)">${merkenZeichen(true)}</span></button>` : '',
    stand.admin ? `<button type="button" class="fnd-rund" data-act="find-neu" data-role="find-neu-knopf" aria-label="${esc(tx('Eintrag anlegen'))}"><span style="pointer-events:none;display:flex">${plus('var(--ink)', 18)}</span></button>` : '',
  ].join('');
  return `${tabHeader(`<span style="font-family:${TITEL_FONT};font-size:22px;font-weight:650">Find</span>`, knoepfe ? `<div style="display:flex;gap:8px">${knoepfe}</div>` : '')}${STIL}`;
}

function leerHtml(stand) {
  return `<div class="fnd" data-role="find-seite"><div class="fnd-leer" data-role="find-leer">
<span style="font:650 16px/1.3 ${FONT};color:var(--ink)">${esc(tx('Noch nichts zu finden.'))}</span>
${stand.admin ? `<div class="fnd-aktionen" style="margin-top:10px"><button type="button" class="fnd-knopf" data-act="find-neu" data-art="haupt">${esc(tx('Eintrag anlegen'))}</button></div>` : ''}
</div></div>`;
}

// Die Überschriften — einzeln ausgeschrieben (Sprachprüfung).
function abschnittTitel(id) {
  switch (id) {
    case 'wochenende': return tx('Dieses Wochenende');
    case 'restaurants': return tx('Beste Restaurants');
    case 'erlebnisse': return tx('Beste Erlebnisse');
    case 'zuhause': return tx('Ideen für Zuhause');
    default: return '';
  }
}

// --- Hinweis-Pille: Standort (Runde 10) --------------------------------------------------------
// Jonathan: „Find, oben: ‚Standort aktivieren', wenn der Standort abgelehnt oder aus ist." Der
// Zustand ist genau der, den die App auch in den Einstellungen zeigt: `location.use`.
// Gezeichnet wird sie mit ui/components.js › hinweisPille — dieselbe Pille wie im Crew-Tab.
function standortPille(stand) {
  if (stand.settings.location?.use) return '';
  return `<div data-role="find-standort-pille" style="padding:8px ${RAND}px 0">${hinweisPille({ text: tx('Standort aktivieren'), act: 'find-standort' })}</div>`;
}

// Warum gerade dieser Tipp? Zuerst ein eigenes Interesse, sonst der stärkste Umstand aus der
// Rechnung (Nähe, beginnt bald). Nichts davon → keine Behauptung.
function heroGrund(eintrag, stand) {
  const interessen = auswahl.interessenGruende(eintrag, stand.interessen);
  if (interessen.length) return tx('Passt zu {was}', { was: interessen.map((name) => wort(name)).join(' · ') });
  const teile = eintrag.scoreGruende || [];
  if (teile.some((teil) => teil.grund === 'naehe')) return tx('Nah bei dir');
  if (teile.some((teil) => teil.grund === 'bald')) return tx('Beginnt bald');
  return '';
}

function heroHtml(eintrag, stand) {
  if (!eintrag) return '';
  const grund = heroGrund(eintrag, stand);
  const gemerkt = stand.gemerkt.has(eintrag.id);
  const unten = scorePille(eintrag, stand.tipps.has(eintrag.id));
  return `<section class="fnd-hero" data-role="find-abschnitt" data-abschnitt="hero" aria-label="${esc(tx('Bester Tipp'))}">
<button type="button" class="fnd-hero-karte" data-act="find-oeffnen" data-id="${esc(eintrag.id)}" data-role="find-hero" data-anzeige="${eintrag.gesponsert ? '1' : '0'}">
<span class="fnd-hero-bild">${bildInhalt(eintrag, 56)}<span class="fnd-hero-marke"><span class="fnd-pille fnd-glas">${esc(tx('Bester Tipp'))}</span>${eintrag.gesponsert ? anzeigePille() : ''}</span>${unten ? `<span class="fnd-marken">${unten}</span>` : ''}</span>
<span class="fnd-hero-titel">${esc(eintrag.titel)}</span>
<span class="fnd-unter"><span>${esc(wannOderOrt(eintrag, stand))}</span></span>
${grund ? `<span class="fnd-unter" data-role="find-grund" style="color:var(--green-dark);font-weight:600">${symbol('funkeln', 'var(--green-dark)', 12)}<span>${esc(grund)}</span></span>` : ''}
</button>
<div class="fnd-hero-fuss">
<button type="button" class="fnd-knopf" data-act="find-planen" data-id="${esc(eintrag.id)}" data-role="find-hero-planen" data-art="haupt">${esc(tx('Meet planen'))}</button>
<button type="button" class="fnd-merken-rund" data-act="find-merken" data-id="${esc(eintrag.id)}" data-role="find-merken" aria-pressed="${gemerkt ? 'true' : 'false'}" aria-label="${esc(gemerkt ? tx('Gemerkt') : tx('Merken'))}">${merkenZeichen(gemerkt)}</button>
</div>
</section>`;
}

function mehrKnopf(id, offen) {
  return `<button type="button" class="fnd-mehr" data-act="find-mehr" data-abschnitt="${esc(id)}" data-role="find-mehr" aria-expanded="${offen ? 'true' : 'false'}">${esc(offen ? tx('Weniger') : tx('Alle zeigen'))}</button>`;
}

function kopfZeile(titel) {
  return `<h2 class="fnd-kopf">${esc(titel)}</h2>`;
}

// Beste Restaurants: eine Rangliste statt einer Reihe.
function ranglisteHtml(id, liste, stand, offen) {
  const zeigen = offen ? liste : liste.slice(0, auswahl.ZEILEN_KURZ);
  return `<section data-role="find-abschnitt" data-abschnitt="${esc(id)}" aria-label="${esc(abschnittTitel(id))}">
${kopfZeile(abschnittTitel(id))}
<div class="fnd-liste">${zeigen.map((eintrag, index) => zeileHtml(eintrag, stand, { rang: index + 1 })).join('')}</div>
${liste.length > auswahl.ZEILEN_KURZ ? mehrKnopf(id, offen) : ''}
</section>`;
}

// Ideen für Zuhause: Kacheln mit Zeichen, ohne Bild und ohne Score-Schild.
function kachelnHtml(id, liste, offen) {
  const zeigen = offen ? liste : liste.slice(0, auswahl.KACHELN_KURZ);
  return `<section data-role="find-abschnitt" data-abschnitt="${esc(id)}" aria-label="${esc(abschnittTitel(id))}">
${kopfZeile(abschnittTitel(id))}
<div class="fnd-kacheln">${zeigen.map((eintrag) => `<button type="button" class="fnd-kachel" data-act="find-oeffnen" data-id="${esc(eintrag.id)}" data-role="find-karte">${zeichen(eintrag, 'var(--green-dark)', 22)}<span class="fnd-titel" style="margin:0">${esc(eintrag.titel)}</span></button>`).join('')}</div>
${liste.length > auswahl.KACHELN_KURZ ? mehrKnopf(id, offen) : ''}
</section>`;
}

function reiheHtml(id, liste, stand) {
  const karten = liste.map((eintrag) => karteHtml(eintrag, stand)).join('');
  return `<section data-role="find-abschnitt" data-abschnitt="${esc(id)}" aria-label="${esc(abschnittTitel(id))}">
${kopfZeile(abschnittTitel(id))}
${edgeFadeRow(karten, { gap: 10, padLeft: RAND, padRight: RAND, padY: '0', scrollKey: `find-reihe-${id}` })}
</section>`;
}

function abschnittHtml(abschnitt, stand, ui) {
  if (!abschnitt.liste.length) return '';
  const offen = Boolean(ui.findMehr?.[abschnitt.id]);
  if (abschnitt.id === 'restaurants') return ranglisteHtml(abschnitt.id, abschnitt.liste, stand, offen);
  if (abschnitt.id === 'zuhause') return kachelnHtml(abschnitt.id, abschnitt.liste, offen);
  return reiheHtml(abschnitt.id, abschnitt.liste, stand);
}

function dashboardHtml(ctx, stand, uebersicht) {
  if (!stand.eintraege.length) return leerHtml(stand);
  return `<div class="fnd" data-role="find-seite">
${standortPille(stand)}
${heroHtml(uebersicht.bester, stand)}
${uebersicht.abschnitte.map((abschnitt) => abschnittHtml(abschnitt, stand, ctx.ui)).join('\n')}
</div>`;
}

function gemerktBlatt(stand, liste) {
  const inhalt = `<div class="fnd-blatt" data-role="find-gemerkt">
<h2 class="fnd-frage">${esc(tk('Gemerkt', 'Liste'))}</h2>
<div style="margin-top:10px">${liste.map((eintrag) => zeileHtml(eintrag, stand)).join('')}</div>
</div>`;
  return sheet(inhalt, { closeAct: 'find-gemerkt-zu', scrollKey: 'find-gemerkt' });
}

// Über der Tab-Leiste, wie FREE: links Karte/Liste, in der Mitte „Worauf hast du Lust?". Rechts
// ein leerer Platz gleicher Breite, damit der große Knopf in der Mitte steht.
function schwebendHtml(ctx, stand) {
  if (!stand.eintraege.length) return '';
  const karteAn = ctx.ui.findAnsicht === 'karte';
  return `<div class="fnd-schweben" data-role="find-schwebend">
<button type="button" class="fnd-schwebe-rund" data-act="find-ansicht" data-role="find-ansicht" data-ueber-karte aria-label="${esc(karteAn ? tx('Liste') : tx('Karte'))}"><span style="pointer-events:none;display:flex">${karteAn ? listIcon('var(--ink)', 19) : mapIcon('var(--ink)', 19)}</span></button>
<button type="button" class="fnd-lust" data-act="find-lust-start" data-role="find-lust-knopf" data-ueber-karte><span class="fnd-lust-figur">${crewFigur(30, { rolle: 'find-figur-knopf' })}</span><span>${esc(tx('Worauf hast du Lust?'))}</span></button>
<span class="fnd-schwebe-platz" aria-hidden="true"></span>
</div>`;
}

function overlaysHtml(ctx, stand, uebersicht) {
  const { ui } = ctx;
  const teile = [];
  if (ui.finder) teile.push(finderBlatt(stand, ui.finder));
  if (ui.findGemerkt && uebersicht.gemerkt.length) teile.push(gemerktBlatt(stand, uebersicht.gemerkt));
  const detail = ui.findDetail ? stand.nachId.get(ui.findDetail) : null;
  if (detail) teile.push(detailBlatt(stand, detail, ui.findFoto === detail.id));
  if (ui.findNeu && stand.admin) teile.push(neuBlatt(ctx));
  teile.push(discardSheet(ctx));
  return teile.join('');
}

function renderFindHome(ctx) {
  const stand = findStand(ctx);
  const uebersicht = auswahl.findUebersicht(stand.eintraege, { gemerktIds: stand.gemerktIds, jetzt: stand.jetzt });
  // Ohne Einträge gibt es auch nichts auf einer Karte — die Seite bleibt dann bei der Liste.
  const karte = ctx.ui.findAnsicht === 'karte' && stand.eintraege.length > 0 && !ctx.preview;
  const schwebend = schwebendHtml(ctx, stand);
  const html = screenScaffold({
    page: true,
    header: kopf(ctx, stand, uebersicht.gemerkt.length),
    body: karte ? kartenRumpf(stand) : dashboardHtml(ctx, stand, uebersicht),
    bottom: schwebend,
    scrollKey: karte ? 'find-karte' : 'find',
    ...(karte
      ? { bottomInset: 0, headerFade: false, bottomFadeHeight: 0 }
      : { bottomInset: schwebend ? SCHWEBE_HOEHE + 4 : 16, bottomFadeHeight: 30, untenSchwebend: true }),
    overlays: overlaysHtml(ctx, stand, uebersicht),
  });
  return { html, bind: bindFindHome };
}

// Nach der kurzen „Überlegung" der Figur kommt das Ergebnis. Die Uhr hängt am Finder-Zustand:
// Wer schließt oder von vorn beginnt, bekommt keinen verspäteten Sprung.
function denkenBeenden(ctx) {
  const finder = ctx.ui.finder;
  if (!finder?.ergebnis || !finder.denkt || finder.denkUhr) return;
  let ruhig = false;
  try { ruhig = Boolean(globalThis.matchMedia?.('(prefers-reduced-motion: reduce)').matches); } catch { ruhig = false; }
  finder.denkUhr = setTimeout(() => {
    finder.denkUhr = null;
    if (ctx.ui.finder !== finder || !finder.denkt) return;
    finder.denkt = false;
    rueckmeldung('erfolg');
    ctx.render();
  }, ruhig ? DENK_MS_RUHIG : DENK_MS);
}

function bindFindHome(root, ctx) {
  const { ui } = ctx;
  const stand = findStand(ctx);
  const eintragVon = (daten) => stand.nachId.get(String(daten.id || '')) || findStand(ctx).nachId.get(String(daten.id || ''));
  if (ui.findAnsicht === 'karte' && stand.eintraege.length) karteEinrichten(root, ctx, stand);
  neuFelderBinden(root, ctx);
  denkenBeenden(ctx);
  const neuWache = dirtyGuard(ctx, 'find-neu');
  if (ui.findNeu) neuWache.track(neuWert(ui));

  // Eine Antwort ist gegeben: Ist danach nichts mehr zu fragen, kommt das Ergebnis — nach der
  // kurzen Überlegung der Figur.
  const weiterMit = (antwort) => {
    const finder = ui.finder;
    if (!finder) return;
    finder.antworten = [...finder.antworten, antwort];
    finder.auswahl = [];
    finder.ergebnis = finderStand(findStand(ctx), finder).fertig;
    finder.denkt = finder.ergebnis;
    rueckmeldung('auswahl');
    ctx.render();
  };

  bindActions(root, {
    ...discardActions(ctx),
    // Ein Tipp fragt das System, wo es noch nicht entschieden hat — sonst führt er in die
    // Einstellung, in der „Standort verwenden" steht (dort steht auch, wenn das System es verbietet).
    'find-standort': () => {
      (async () => {
        if (await erlaubnisStand('standort') !== 'offen') { ctx.nav.go('profile.location'); return; }
        const wort = await erlaubnisFragen('standort');
        const lage = ctx.repo.getSettings()?.location || {};
        if (wort === 'erteilt') {
          ctx.repo.updateSettings({ location: { ...lage, use: true } });
          ctx.repo.standortSenden?.({ sofort: true });
        }
        ctx.render();
      })().catch(() => {});
    },
    'find-ansicht': () => {
      ui.findAnsicht = ui.findAnsicht === 'karte' ? 'liste' : 'karte';
      rueckmeldung('tipp');
      ctx.render();
    },
    'find-mehr': (daten) => {
      const id = String(daten.abschnitt || '');
      ui.findMehr = { ...(ui.findMehr || {}), [id]: !ui.findMehr?.[id] };
      rueckmeldung('tipp');
      ctx.render();
    },
    'find-gemerkt': () => { ui.findGemerkt = true; rueckmeldung('tipp'); ctx.render(); },
    'find-gemerkt-zu': () => { ui.findGemerkt = false; ctx.render(); },
    'find-lust-start': () => {
      finderNeu(ui);
      rueckmeldung('tipp');
      ctx.render();
    },
    'find-option': (daten) => {
      const finder = ui.finder;
      if (!finder) return;
      const zustand = finderStand(findStand(ctx), finder);
      if (!zustand.frage) return;
      const option = String(daten.option);
      if (zustand.frage.mehrfach) {
        finder.auswahl = finder.auswahl.includes(option) ? finder.auswahl.filter((id) => id !== option) : [...finder.auswahl, option];
        rueckmeldung('auswahl');
        ctx.render();
        return;
      }
      weiterMit({ frage: zustand.frage.id, optionen: [option] });
    },
    'find-weiter': () => {
      const finder = ui.finder;
      if (!finder) return;
      const zustand = finderStand(findStand(ctx), finder);
      if (!zustand.frage) return;
      weiterMit({ frage: zustand.frage.id, optionen: zustand.frage.mehrfach ? [...finder.auswahl] : [] });
    },
    'find-zeigen': () => {
      const finder = ui.finder;
      if (!finder) return;
      const zustand = finderStand(findStand(ctx), finder);
      // Eine offene Mehrfachwahl gilt als Antwort — sonst zeigte „12 Ideen" etwas anderes als 12.
      if (zustand.frage?.mehrfach && finder.auswahl.length) {
        finder.antworten = [...finder.antworten, { frage: zustand.frage.id, optionen: [...finder.auswahl] }];
        finder.auswahl = [];
      }
      finder.ergebnis = true;
      finder.denkt = true;
      rueckmeldung('tipp');
      ctx.render();
    },
    'find-zurueck': () => {
      const finder = ui.finder;
      if (!finder) return;
      finder.denkt = false;
      if (finder.ergebnis) {
        finder.ergebnis = false;
        // Kam das Ergebnis von selbst (nichts mehr zu fragen), geht „zurück" eine Antwort zurück.
        if (!finderStand(findStand(ctx), finder).fertig) { rueckmeldung('zurueck'); ctx.render(); return; }
      }
      const letzte = finder.antworten[finder.antworten.length - 1];
      finder.antworten = finder.antworten.slice(0, -1);
      // Eine Mehrfachwahl kommt mit ihrer Auswahl zurück — man will ergänzen, nicht neu anfangen.
      finder.auswahl = letzte && auswahl.finderFrage(letzte.frage)?.mehrfach ? [...letzte.optionen] : [];
      finder.ergebnis = false;
      rueckmeldung('zurueck');
      ctx.render();
    },
    'find-von-vorn': () => {
      finderNeu(ui);
      rueckmeldung('tipp');
      ctx.render();
    },
    'find-finder-zu': () => { ui.finder = null; ctx.render(); },
    'find-oeffnen': (daten) => {
      const eintrag = eintragVon(daten);
      if (!eintrag) return;
      ui.findDetail = eintrag.id;
      rueckmeldung('tipp');
      ctx.render();
    },
    'find-detail-zu': () => { ui.findDetail = null; ui.findFoto = null; ctx.render(); },
    'find-foto': (daten) => {
      ui.findFoto = ui.findFoto === daten.id ? null : String(daten.id || '');
      ctx.render();
    },
    'find-merken': (daten) => merken(ctx, String(daten.id || '')),
    'find-planen': (daten) => {
      const eintrag = eintragVon(daten);
      if (eintrag) { ui.findGemerkt = false; meetPlanen(ctx, eintrag); }
    },
    'find-karte-gross': (daten) => {
      const eintrag = eintragVon(daten);
      if (eintrag) karteGross(stand, eintrag);
    },
    'find-neu': () => {
      if (!findStand(ctx).admin) return;
      ui.findNeu = { ...NEU_LEER, treffer: [], sucht: false, fehler: null };
      dirtyGuard(ctx, 'find-neu').clear();
      rueckmeldung('tipp');
      ctx.render();
    },
    'find-neu-zu': () => {
      if (!ui.findNeu) return;
      if (neuWache.confirm(neuWert(ui), () => { ui.findNeu = null; })) { ui.findNeu = null; ctx.render(); }
    },
    'find-neu-art': (daten) => {
      if (!ui.findNeu) return;
      ui.findNeu.art = auswahl.ARTEN.includes(daten.artWahl) ? daten.artWahl : 'event';
      ctx.render();
    },
    'find-neu-anzeige': () => {
      if (!ui.findNeu) return;
      ui.findNeu.anzeige = !ui.findNeu.anzeige;
      ctx.render();
    },
    'find-neu-ort': (daten) => {
      const neu = ui.findNeu;
      const ort = neu?.treffer?.[Number(daten.index)];
      if (!ort) return;
      neu.ort = { name: String(ort.name || ''), adresse: String(ort.address || ort.city || ''), lat: Number(ort.lat), lon: Number(ort.lon) };
      neu.fehler = null;
      rueckmeldung('auswahl');
      ctx.render();
    },
    'find-neu-ort-weg': () => {
      if (!ui.findNeu) return;
      ui.findNeu.ort = null;
      ctx.render();
    },
    'find-neu-anlegen': () => {
      const neu = ui.findNeu;
      if (!neu) return;
      let ergebnis = null;
      try { ergebnis = typeof ctx.repo.addFindEintrag === 'function' ? ctx.repo.addFindEintrag(neuEintragBauen(neu)) : null; } catch { ergebnis = null; }
      Promise.resolve(ergebnis).then((antwort) => {
        if (!antwort?.ok) {
          // Die Prüfung sagt, welches Feld nicht passt (feld) oder dass nur Admins dürfen.
          if (ui.findNeu) ui.findNeu.fehler = antwort?.reason === 'keinAdmin' ? 'keinAdmin' : (antwort?.feld || 'fehler');
          rueckmeldung('abgelehnt');
          ctx.render();
          return;
        }
        ui.findNeu = null;
        dirtyGuard(ctx, 'find-neu').clear();
        rueckmeldung('erfolg');
        ctx.toast?.(tx('Eintrag angelegt'));
        ctx.render();
      });
    },
  });
}

export const findScreens = {
  'find.home': renderFindHome,
};
