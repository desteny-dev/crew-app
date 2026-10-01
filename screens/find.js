// Bereich Find (Route 'find.home') — der fünfte Haupt-Tab, in der Mitte der Fußleiste.
//
// Paket G2 (Algorithmus, 28.09.2026): Find zeigt, was die beiden Algorithmen liefern, und rechnet selbst
// NICHTS mehr (ALGORITHMUS.md §2.11, §3.7, §7.1; ZUSATZ §5.3, §5.4, §6).
//
// Aufbau, von oben:
//   · Kopf: „Find" · rechts das Lesezeichen (Gemerktes, nur wenn es welches gibt).
//   · Suche (ZUSATZ §6): ein Feld für Namen — findet JEDEN importierten Ort, auch unter 70 (dann ohne
//     Zahl, „nicht unter den Empfehlungen") — und darunter die Kategorien als Knöpfe (alles Freigegebene
//     nach Crew Score, dann Entfernung, ohne Personenfilter). Die früheren Abschnitte leben hier weiter:
//     „Dieses Wochenende" → Events, „Beste Restaurants" → Essen, „Beste Erlebnisse" → Kultur/Natur/Sport/…,
//     „Ideen für Zuhause" → Zuhause. Als eigene Abschnitte auf der Seite hätten sie „Für dich" verdoppelt
//     und die Seite über 1,5 Bildschirme gezogen; als Knöpfe kosten sie eine Zeile.
//   · „Crew kennt dich noch kaum" (ZUSATZ §5.3) — eine leise Karte, nur solange Crew aus dem eigenen
//     Verhalten weniger als drei Interessen kennt. Sie startet das Wischspiel (10 Karten, ~20 Sekunden).
//     Kein Pflichtschritt beim Einrichten: Wer gleich loslegen will, soll es können (eine Handlung weniger).
//   · „Für dich" (Algorithmus 2): der Crew-Tipp (Platz 1) groß, dann die Ringe Nah · Mittel · „Weiter weg,
//     aber lohnt sich" — leere Ringe gibt es nicht. „Mal was anderes" steht sichtbar am Eintrag. Leere
//     Liste → „Heute nichts, das gut genug ist — Radius erweitern?" mit einem Knopf, der es wirklich tut.
//   · Crew Score (Algorithmus 1): ein Ring, der sich füllt — drei Stufen, Zahl in der Mitte
//     (web/unternehmen/ring.js — DERSELBE Ring wie auf der Website). Ein Tipp auf die Zahl zeigt die drei
//     Gründe. „Neu" statt Ring. Private Ideen ohne Ring. Die persönliche Passung nie als Zahl.
//   · An jedem Eintrag: „Warum sehe ich das?" und „Weniger davon" (sofort weg, Rückgängig), und unten rechts
//     am Bild das „?" (§7.1): Fehler melden · Ist das dein Unternehmen? · Warum sehe ich das?
//   · Über der Tab-Leiste schweben „Worauf hast du Lust?" (Absicht + Zeitpunkt an Algorithmus 2) und der
//     Schalter Karte/Liste (die Karte zeigt „Für dich").
//
// Signale (ZUSATZ §5.2), jedes genau einmal: angesehen (Blatt ≥ 2 s offen, mit Sekunden), merken, teilen,
// weniger (erst, wenn Rückgängig nicht mehr geht — am Server lässt sich ein Signal nicht zurücknehmen),
// ignoriert (im Gerät gezählt: drei Anzeigen ohne jede Handlung → einmal), wisch_ja / wisch_nein.
//
// Eigene Regeln stehen im <style> dieser Seite (Präfix .fnd), nicht in styles.css (gemeinsames Gut).

import { esc, bindActions, rueckmeldung } from '../core/html.js';
import { now, toISODate, weekdayShort, weekdayLong, tagUndMonat } from '../core/dates.js';
import { t as tx } from '../core/sprache.js';
import { kmText } from '../core/entfernung.js';
import { screenScaffold, tabHeader, sheet, edgeFadeRow, TAB_HEADER_PAD_X, hinweisPille } from '../ui/components.js';
import { symbol } from '../ui/symbole.js';
import { activityIconSvg, iconKeyForText } from '../ui/activity-icons.js';
import { mapIcon, listIcon } from '../ui/icons.js';
import { karteGrossOeffnen } from '../ui/karte-gross.js';
import { crewFigur } from '../ui/crew-figur.js';
import { waagrechtZiehen } from '../ui/gesten.js';
import {
  grobeZeit, kurzName, karteHalten, karteVon, ortMarken, passeAufPunkte, startAnsicht,
  kartenLageQuelle, bedienSpalteOrdnen, bedienFlaechen, KARTEN_SPALTE,
} from '../ui/map.js';
import { erlaubnisStand, erlaubnisFragen } from '../core/native.js';
import * as auswahl from '../data/find-auswahl.js';
import { hatAlkoholSchwerpunkt } from '../data/projections.js';
import { auswahlAlsVorschlag, ortSeiteSchluessel, ortSeiteAdresse, RADIUS_STUFEN, MELDUNG_TEXT_MAX } from '../data/auswahl-weg.js';
import { KONFIG_AUSWAHL } from '../data/konfig-auswahl.js';
import { scoreRing, stufeVon } from '../unternehmen/ring.js';
import { MARKE } from '../core/marke.js';
import { linkTeilen } from '../ui/teilen.js';

const FONT = "'Instrument Sans',sans-serif";
const TITEL_FONT = "'Bricolage Grotesque',sans-serif";
const RAND = TAB_HEADER_PAD_X;
const KARTE_SCHLUESSEL = 'find-karte';
const RAND_ZONE = 28;
const RAND_UNTEN_FREI = 64;
const TOP_PICK = MARKE.topPick || String(MARKE.topPicks).replace(/s$/, '');
// „Weniger davon": so lange steht „Rückgängig" da; erst danach geht das Signal hinaus.
const WENIGER_MS = 6000;
// „Angesehen" zählt erst, wenn das Blatt so lange offen war — ein versehentlicher Tipp ist kein Interesse.
const ANGESEHEN_AB_MS = 2000;
// So viele Treffer zeigt der Finder am Schluss: einen groß, den Rest als Zeilen.
const ERGEBNIS_ZAHL = 5;
const DENK_MS = 950;
const DENK_MS_RUHIG = 300;
const SCHWEBE_HOEHE = 84;
// Früher legte die Seite gesehene Einträge im Gerät ab (Kennung → Eintrag); das löst jetzt die Datenschicht.
const SPEICHER_BEKANNT_ALT = 'crew-find-bekannt';
const SPEICHER_ANZEIGEN = 'crew-find-anzeigen';
const SPEICHER_WISCH = 'crew-find-wisch';
const BEKANNT_MAX = 300;

// ---------------------------------------------------------------------------------------------
// Die Seite trägt ihre Regeln selbst. Der Block steht im Kopf HINTER der Kopfzeile, damit die
// gemeinsame Kopfachse (v4-headerachse) ihr erstes Kind weiter als Kopfzeile misst.
// ---------------------------------------------------------------------------------------------
const STIL = `<style>
.fnd{padding:2px 0 10px}
.fnd [hidden],.fnd-blatt [hidden]{display:none!important}
.fnd-kopf{margin:0;padding:18px ${RAND}px 8px;font:650 11px/1.2 ${FONT};letter-spacing:.09em;text-transform:uppercase;color:var(--muted-light)}
.fnd-kopf-zeile{display:flex;align-items:center;justify-content:space-between;gap:8px;padding-right:${RAND - 8}px}
.fnd-kopf-zeile .fnd-kopf{padding-right:0}
.fnd-suche{display:flex;align-items:center;gap:8px;margin:6px ${RAND}px 0;height:44px;padding:0 6px 0 13px;border-radius:14px;background:var(--field);box-sizing:border-box}
.fnd-suche input{flex:1;min-width:0;height:100%;border:0;background:transparent;outline:none;font:500 16px ${FONT};color:var(--ink);-webkit-appearance:none;appearance:none}
.fnd-suche input::placeholder{color:var(--muted);opacity:1}
.fnd-suche input::-webkit-search-cancel-button{display:none}
.fnd-suche:focus-within{box-shadow:0 0 0 2px var(--green-a45)}
.fnd-x{flex:none;width:32px;height:32px;border:0;border-radius:50%;background:transparent;display:flex;align-items:center;justify-content:center;padding:0;cursor:pointer;appearance:none}
.fnd-kats{padding-top:10px!important}
.fnd-kat{flex:none;display:inline-flex;align-items:center;gap:6px;height:36px;padding:0 13px;border-radius:999px;border:1px solid var(--ink-a12);background:var(--surface);color:var(--ink);font:650 13px/1 ${FONT};white-space:nowrap;cursor:pointer;appearance:none;-webkit-tap-highlight-color:transparent;transition:background-color .15s ease-out,border-color .15s ease-out}
.fnd-kat[aria-pressed="true"]{background:var(--green-tint);border-color:var(--green-a45);color:var(--green-dark)}
.fnd-kat>svg{pointer-events:none}
.fnd-kat:active{transform:scale(.97)}
.fnd-bild{position:relative;display:block;width:100%;height:100px;border-radius:16px;overflow:hidden;background:var(--field)}
.fnd-bild>img,.fnd-hero-bild>img,.fnd-detail-bild>img,.fnd-daumen>img{position:absolute;inset:0;width:100%;height:100%;object-fit:cover;display:block}
.fnd-zeichen{position:absolute;inset:0;display:flex;align-items:center;justify-content:center;pointer-events:none}
.fnd-pille{display:inline-flex;align-items:center;gap:4px;height:22px;padding:0 8px;border-radius:999px;font:700 11px/1 ${FONT};white-space:nowrap;box-sizing:border-box}
.fnd-glas{background:var(--glass);-webkit-backdrop-filter:blur(10px);backdrop-filter:blur(10px);color:var(--ink);box-shadow:0 1px 3px var(--shadow-10)}
.fnd-leise{color:var(--ink-soft);font-weight:650}
.fnd-anzeige{position:absolute;left:7px;top:7px;pointer-events:none}
.fnd-titel{display:-webkit-box;-webkit-line-clamp:2;-webkit-box-orient:vertical;overflow:hidden;font-size:14px;font-weight:650;line-height:1.25;letter-spacing:-.01em;pointer-events:none}
.fnd-unter{display:flex;align-items:center;gap:4px;margin-top:3px;font-size:12px;line-height:1.3;color:var(--ink-soft);min-width:0;pointer-events:none}
.fnd-unter>span{white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
.fnd-grund-zeile{color:var(--green-dark);font-weight:600}
.fnd-chips{display:flex;flex-wrap:wrap;gap:8px}
.fnd-chip{display:inline-flex;align-items:center;justify-content:center;gap:6px;min-height:44px;padding:0 15px;border-radius:999px;border:1.5px solid var(--ink-a12);background:var(--surface);color:var(--ink);font:650 13.5px/1 ${FONT};cursor:pointer;appearance:none;box-sizing:border-box;-webkit-tap-highlight-color:transparent;transition:background-color .15s ease-out,border-color .15s ease-out,color .15s ease-out}
.fnd-chip[aria-pressed="true"]{background:var(--green-tint);border-color:var(--green-a45);color:var(--green-dark)}
.fnd-chip:active{transform:scale(.97)}
.fnd-rund{position:relative;flex:none;width:38px;height:38px;border-radius:50%;border:1px solid var(--ink-a12);background:var(--surface);display:flex;align-items:center;justify-content:center;padding:0;cursor:pointer;appearance:none;-webkit-tap-highlight-color:transparent}
.fnd-blatt{font-family:${FONT};color:var(--ink)}
.fnd-zurueck{width:44px;height:44px;border:0;background:transparent;display:flex;align-items:center;justify-content:center;padding:0;cursor:pointer;appearance:none;border-radius:50%}
.fnd-frage{margin:0;font:650 22px/1.2 ${TITEL_FONT};letter-spacing:-.015em}
.fnd-hinweis{margin:6px 0 0;font-size:12.5px;color:var(--muted);line-height:1.45}
.fnd-schritt{animation:fndSchritt .22s cubic-bezier(.22,.61,.36,1) both}
.fnd-knopf{flex:1;min-height:50px;border-radius:999px;display:flex;align-items:center;justify-content:center;gap:8px;padding:0 16px;font:650 14.5px/1 ${FONT};cursor:pointer;appearance:none;box-sizing:border-box;border:1.5px solid var(--ink-a14);background:var(--surface);color:var(--ink);-webkit-tap-highlight-color:transparent;text-decoration:none}
.fnd-knopf[data-art="haupt"]{border-color:transparent;background:var(--green);color:var(--on-accent);box-shadow:0 6px 18px var(--green-a26)}
.fnd-knopf[disabled]{opacity:.45;cursor:default;box-shadow:none}
.fnd-knopf:active{transform:scale(.98)}
.fnd-knopf-klein{flex:none;min-height:36px;padding:0 14px;font-size:13px}
.fnd-textknopf{display:block;margin:14px auto 0;min-height:44px;padding:0 14px;border:0;background:transparent;font:650 13.5px/1 ${FONT};color:var(--ink-soft);cursor:pointer;appearance:none}
.fnd-gross{display:block;width:100%;margin-top:14px;padding:0;border:0;background:transparent;text-align:left;cursor:pointer;appearance:none;font-family:${FONT};color:var(--ink)}
.fnd-gross .fnd-bild{height:168px;border-radius:18px}
.fnd-gross-titel{display:block;margin-top:11px;font:650 19px/1.25 ${TITEL_FONT};letter-spacing:-.01em}
.fnd-liste{padding:0 ${RAND}px}
.fnd-zeile{position:relative;display:flex;align-items:center;gap:8px;width:100%;min-height:62px;border-top:1px solid var(--ink-a06);box-sizing:border-box}
.fnd-liste>.fnd-zeile:first-child{border-top:0}
.fnd-zeile-haupt{flex:1;min-width:0;display:flex;align-items:center;gap:12px;min-height:62px;padding:8px 0;border:0;background:transparent;text-align:left;cursor:pointer;appearance:none;font-family:${FONT};color:var(--ink);-webkit-tap-highlight-color:transparent}
.fnd-daumen{position:relative;flex:none;width:48px;height:48px;border-radius:12px;overflow:hidden;background:var(--field);transition:transform .14s ease-out}
.fnd-zeile-haupt:active .fnd-daumen{transform:scale(.96)}
.fnd-zeile-text{display:flex;flex-direction:column;gap:1px;flex:1;min-width:0;pointer-events:none}
.fnd-zeile-titel{font-size:14.5px;font-weight:650;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
.fnd-anders{align-self:flex-start;display:inline-flex;align-items:center;gap:4px;margin-bottom:2px;padding:2px 7px;border-radius:6px;background:var(--orange-tint);color:var(--orange-dark);font:700 10.5px/1.3 ${FONT};letter-spacing:.02em}
.fnd-ring-knopf{flex:none;position:relative;width:48px;height:48px;border:0;background:transparent;padding:0;display:flex;align-items:center;justify-content:center;cursor:pointer;appearance:none;border-radius:50%;-webkit-tap-highlight-color:transparent}
.fnd-ring-knopf:active{transform:scale(.94)}
.fnd-ring-knopf>*{pointer-events:none}
.fnd-ring{display:flex}
.fnd-ring .ort-ring{display:block}
.fnd-ring .ort-ring-spur{stroke:var(--field-deep)}
.fnd-ring .ort-ring-wert{stroke:var(--ink)}
.fnd-ring .ort-ring-punkt{fill:var(--green)}
.fnd-ring .ort-ring-zahl{fill:var(--ink);font:700 21px/1 ${TITEL_FONT};letter-spacing:-.03em;font-variant-numeric:tabular-nums}
.fnd-ring[data-stufe="gut"] .ort-ring-wert{stroke:var(--blue-dark)}
.fnd-ring[data-stufe="sehr_gut"] .ort-ring-wert{stroke:var(--green)}
.fnd-ring[data-stufe="herausragend"] .ort-ring-wert{stroke:var(--ink)}
.fnd-ring[data-stufe="herausragend"] .ort-ring-punkt{fill:#c8a04a}
.fnd-ring-glas{width:46px;height:46px;border-radius:50%;background:var(--glass);-webkit-backdrop-filter:blur(10px);backdrop-filter:blur(10px);box-shadow:0 1px 4px var(--shadow-14);display:flex;align-items:center;justify-content:center}
.fnd-neu{flex:none;display:inline-flex;align-items:center;justify-content:center;min-width:44px;height:26px;padding:0 9px;border-radius:999px;border:1.5px dashed var(--line-strong,var(--ink-a20));background:var(--surface);color:var(--ink-soft);font:700 11.5px/1 ${FONT};cursor:pointer;appearance:none;box-sizing:border-box}
.fnd-neu-platz{flex:none;width:48px;display:flex;align-items:center;justify-content:center}
.fnd-hero{padding:0 ${RAND}px 2px}
.fnd-hero-kasten{position:relative}
.fnd-hero-karte{display:block;width:100%;padding:0;border:0;background:transparent;text-align:left;cursor:pointer;appearance:none;font-family:${FONT};color:var(--ink);-webkit-tap-highlight-color:transparent}
.fnd-hero-bild{position:relative;display:block;width:100%;height:172px;border-radius:22px;overflow:hidden;background:var(--field);transition:transform .14s ease-out}
.fnd-hero-karte:active .fnd-hero-bild{transform:scale(.985)}
.fnd-hero-marke{position:absolute;left:10px;top:10px;display:flex;gap:6px;pointer-events:none}
.fnd-hero-titel{display:block;margin-top:11px;font:650 21px/1.2 ${TITEL_FONT};letter-spacing:-.015em}
.fnd-auf-bild-links{position:absolute;left:6px;top:120px;z-index:2}
.fnd-auf-bild-links .fnd-neu{height:30px}
.fnd-auf-bild-rechts{position:absolute;right:4px;top:124px;z-index:2}
.fnd-hero-fuss{display:flex;gap:9px;margin-top:10px}
.fnd-hero-fuss .fnd-knopf{min-height:46px}
.fnd-merken-rund{flex:none;width:46px;height:46px;border-radius:50%;border:1.5px solid var(--ink-a14);background:var(--surface);color:var(--ink);display:flex;align-items:center;justify-content:center;padding:0;cursor:pointer;appearance:none}
.fnd-frage-knopf{width:44px;height:44px;border:0;background:transparent;padding:0;display:flex;align-items:center;justify-content:center;cursor:pointer;appearance:none}
.fnd-frage-knopf>span{width:26px;height:26px;border-radius:50%;background:var(--glass);-webkit-backdrop-filter:blur(10px);backdrop-filter:blur(10px);box-shadow:0 1px 4px var(--shadow-10);display:flex;align-items:center;justify-content:center;font:700 13px/1 ${FONT};color:var(--ink-soft);pointer-events:none}
.fnd-mehr{display:block;margin:0 auto;min-height:40px;padding:0 14px;border:0;background:transparent;font:650 13px/1 ${FONT};color:var(--ink-soft);cursor:pointer;appearance:none}
.fnd-platzhalter{justify-content:space-between;gap:10px;padding:0 2px;color:var(--ink-soft);font:600 13px/1.3 ${FONT}}
.fnd-platzhalter>span{min-width:0;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}
.fnd-kasten{margin:14px ${RAND}px 0;padding:14px 16px;border-radius:18px;background:var(--surface);box-shadow:0 1px 3px var(--shadow-08);display:flex;flex-direction:column;gap:10px}
.fnd-kasten-text{font:600 14px/1.4 ${FONT};color:var(--ink)}
.fnd-kasten-reihe{display:flex;gap:8px;flex-wrap:wrap}
.fnd-leise-zeile{margin:0;padding:6px ${RAND}px 0;font:500 12px/1.4 ${FONT};color:var(--muted)}
.fnd-leise-zeile button{border:0;background:transparent;padding:0 0 0 6px;font:650 12px/1.4 ${FONT};color:var(--ink-soft);cursor:pointer;appearance:none;min-height:32px}
.fnd-wisch-karte{display:flex;align-items:center;gap:12px;margin:14px ${RAND}px 0;padding:10px 8px 10px 12px;border-radius:18px;background:var(--surface);box-shadow:0 1px 3px var(--shadow-08)}
.fnd-wisch-karte-text{flex:1;min-width:0;display:flex;flex-direction:column;gap:2px;font:650 14px/1.3 ${FONT};color:var(--ink)}
.fnd-wisch-karte-text small{font:500 12px/1.3 ${FONT};color:var(--muted)}
.fnd-laedt{padding:0 ${RAND}px}
.fnd-laedt-flaeche{border-radius:22px;background:var(--field);animation:fndPuls 1.3s ease-in-out infinite}
.fnd-leer{padding:26px ${RAND + 4}px 0;display:flex;flex-direction:column;gap:6px}
.fnd-detail-bild{position:relative;display:block;height:176px;border-radius:18px;overflow:hidden;background:var(--field)}
.fnd-detail-titel{margin:14px 0 0;font:650 22px/1.2 ${TITEL_FONT};letter-spacing:-.015em}
.fnd-fakten{display:flex;flex-direction:column;margin-top:8px}
.fnd-fakt{display:flex;align-items:center;gap:10px;min-height:38px;font-size:13.5px;color:var(--ink-soft);border:0;background:transparent;padding:0;text-align:left;font-family:${FONT};width:100%}
button.fnd-fakt{cursor:pointer;appearance:none;color:var(--ink)}
.fnd-fakt>span{min-width:0;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
.fnd-wertung{margin-top:12px;border-radius:16px;background:var(--paper);padding:4px 14px}
.fnd-wertung-zeile{display:flex;align-items:center;gap:12px;min-height:56px}
.fnd-wertung-zeile+.fnd-wertung-zeile,.fnd-gruende+.fnd-wertung-zeile{border-top:1px solid var(--ink-a06)}
.fnd-wertung-wort{flex:1;min-width:0;display:flex;flex-direction:column;gap:2px;font-size:14px;font-weight:650}
.fnd-wertung-wort small{font-size:12px;font-weight:500;color:var(--muted);line-height:1.35}
.fnd-note{flex:none;display:inline-flex;align-items:center;justify-content:center;min-width:40px;height:30px;padding:0 7px;border-radius:8px;background:var(--surface);font:700 14px/1 ${FONT};font-variant-numeric:tabular-nums}
.fnd-zitat{font-size:13px;font-weight:500;color:var(--ink-soft);line-height:1.4;text-wrap:pretty}
.fnd-gruende{display:flex;flex-direction:column;gap:7px;margin:0;padding:4px 0 12px;list-style:none}
.fnd-grund{display:flex;gap:8px;align-items:flex-start;font-size:13px;line-height:1.4;color:var(--ink-soft)}
.fnd-grund>svg{flex:none;margin-top:2px}
.fnd-warum{margin-top:14px;padding:12px 14px;border-radius:16px;background:var(--paper);display:flex;flex-direction:column;gap:4px}
.fnd-warum-titel{font:650 11px/1.2 ${FONT};letter-spacing:.09em;text-transform:uppercase;color:var(--muted-light)}
.fnd-warum-satz{font:600 14px/1.4 ${FONT};color:var(--ink)}
.fnd-warum-passung{font:500 13px/1.4 ${FONT};color:var(--ink-soft)}
.fnd-warum a,.fnd-warum button{align-self:flex-start;border:0;background:transparent;padding:6px 0 0;font:650 12.5px/1.3 ${FONT};color:var(--green-dark);cursor:pointer;appearance:none;text-decoration:none;min-height:32px}
.fnd-aktionen{display:flex;flex-direction:column;gap:9px;margin-top:18px}
.fnd-aktionen-reihe{display:flex;gap:8px}
.fnd-aktionen-reihe .fnd-knopf{min-width:0;padding:0 10px;gap:7px}
.fnd-aktionen-reihe .fnd-knopf>span{min-width:0;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}
.fnd-menue{display:flex;flex-direction:column;margin-top:12px}
.fnd-menue-punkt{display:flex;align-items:center;gap:12px;width:100%;min-height:54px;padding:0 2px;border:0;border-top:1px solid var(--ink-a06);background:transparent;text-align:left;cursor:pointer;appearance:none;font:600 15px/1.3 ${FONT};color:var(--ink);text-decoration:none;box-sizing:border-box}
.fnd-menue-punkt:first-child{border-top:0}
.fnd-menue-punkt>span{flex:1;min-width:0}
.fnd-menue-punkt small{display:block;font:500 12px/1.35 ${FONT};color:var(--muted)}
.fnd-feld{width:100%;box-sizing:border-box;border-radius:14px;border:1.5px solid var(--ink-a10);background:var(--surface);padding:11px 14px;font:500 16px/1.4 ${FONT};color:var(--ink);outline:none;resize:none}
.fnd-feld:focus{border-color:var(--green-a45)}
.fnd-feld::placeholder{color:var(--muted-light);opacity:1}
.fnd-zaehler{align-self:flex-end;font:500 11.5px/1 ${FONT};color:var(--muted);font-variant-numeric:tabular-nums}
.fnd-fehler{margin:2px 0 0;font-size:12.5px;font-weight:600;color:var(--danger)}
.fnd-schweben{position:relative;height:84px;display:flex;align-items:center;justify-content:center;gap:10px;padding:0 12px;pointer-events:none}
.fnd-lust{display:flex;align-items:center;gap:10px;min-width:0;flex:0 1 auto;height:54px;padding:0 20px 0 7px;border-radius:999px;border:0;background:var(--green);color:var(--on-accent);font:650 15px/1 ${FONT};letter-spacing:-.01em;white-space:nowrap;box-shadow:0 6px 20px var(--green-a26),0 1px 3px var(--shadow-10);cursor:pointer;appearance:none;pointer-events:auto;-webkit-tap-highlight-color:transparent}
.fnd-lust:active{transform:scale(.97)}
.fnd-lust-figur{flex:none;width:40px;height:40px;border-radius:50%;background:var(--surface);display:flex;align-items:center;justify-content:center;pointer-events:none}
.fnd-lust>span:last-child{overflow:hidden;text-overflow:ellipsis;pointer-events:none}
.fnd-schwebe-rund{flex:none;width:46px;height:46px;border-radius:50%;border:1px solid var(--ink-a12);background:var(--surface);box-shadow:0 4px 14px var(--shadow-14);display:flex;align-items:center;justify-content:center;padding:0;cursor:pointer;appearance:none;pointer-events:auto;-webkit-tap-highlight-color:transparent}
.fnd-schwebe-rund:active{transform:scale(.95)}
.fnd-schwebe-platz{flex:0 1 46px;min-width:0}
.fnd-erlebnis{display:flex;flex-direction:column;min-height:min(540px,66vh)}
.fnd-erlebnis-kopf{display:flex;align-items:center;justify-content:space-between;min-height:44px;margin:-8px -8px 0}
.fnd-fortschritt{display:flex;gap:6px}
.fnd-fortschritt>span{width:26px;height:5px;border-radius:3px;background:var(--field-deep);transition:background-color .2s ease-out}
.fnd-fortschritt>span[data-an="1"]{background:var(--green)}
.fnd-figur-platz{display:flex;justify-content:center;margin:8px 0 14px}
.fnd-erlebnis>.fnd-frage,.fnd-erlebnis>.fnd-hinweis{text-align:center}
.fnd-wahl{display:grid;grid-template-columns:1fr 1fr;gap:9px;margin-top:18px}
.fnd-wahl .fnd-chip{min-height:56px;border-radius:18px;padding:0 12px;font-size:14.5px;line-height:1.2;text-align:center}
.fnd-erlebnis-fuss{display:flex;flex-direction:column;margin-top:auto;padding-top:20px}
.fnd-denkt{flex:1;display:flex;flex-direction:column;align-items:center;justify-content:center;gap:16px;min-height:320px;font:600 14px/1.3 ${FONT};color:var(--ink-soft);text-align:center}
.fnd-wisch{display:flex;flex-direction:column;align-items:stretch;min-height:min(520px,64vh)}
.fnd-wisch-stapel{position:relative;height:250px;margin-top:18px}
.fnd-wisch-kachel{position:absolute;inset:0;border-radius:26px;background:var(--surface);box-shadow:0 10px 30px var(--shadow-14),0 1px 3px var(--shadow-10);border:1px solid var(--ink-a06);display:flex;flex-direction:column;align-items:center;justify-content:center;gap:16px;padding:20px;box-sizing:border-box;touch-action:pan-y;user-select:none;-webkit-user-select:none;will-change:transform}
.fnd-wisch-kachel[data-hinten="1"]{transform:scale(.94) translateY(12px);opacity:.6;box-shadow:none}
.fnd-wisch-kachel-zeichen{width:84px;height:84px;border-radius:26px;background:var(--green-tint);display:flex;align-items:center;justify-content:center;pointer-events:none}
.fnd-wisch-kachel-wort{font:650 22px/1.2 ${TITEL_FONT};letter-spacing:-.015em;text-align:center;pointer-events:none}
.fnd-wisch-urteil{position:absolute;top:16px;padding:4px 10px;border-radius:8px;font:800 13px/1 ${FONT};letter-spacing:.06em;text-transform:uppercase;opacity:0;pointer-events:none}
.fnd-wisch-urteil[data-seite="ja"]{left:16px;color:var(--green-dark);border:2px solid var(--green)}
.fnd-wisch-urteil[data-seite="nein"]{right:16px;color:var(--danger);border:2px solid var(--danger)}
.fnd-wisch-knoepfe{display:flex;gap:10px;margin-top:22px}
.fnd-balken{position:relative;flex:none;width:64px;height:6px;border-radius:3px;background:var(--field-deep);overflow:hidden}
.fnd-balken>span{position:absolute;left:0;top:0;bottom:0;border-radius:3px;background:var(--green)}
@keyframes fndSchritt{from{opacity:0;transform:translateY(8px)}}
@keyframes fndPuls{50%{opacity:.55}}
@media (prefers-reduced-motion:reduce){.fnd-schritt{animation:none}.fnd-daumen,.fnd-hero-bild{transition:none}.fnd-laedt-flaeche{animation:none}}
</style>`;

// =============================================================================================
// Gerät: was diese Seite sich merkt (nur Bequemlichkeit — nichts davon ist eine zweite Wahrheit)
// =============================================================================================
function lesen(schluessel, ersatz) {
  try {
    const roh = globalThis.localStorage?.getItem(schluessel);
    return roh ? JSON.parse(roh) : ersatz;
  } catch { return ersatz; }
}
function schreiben(schluessel, wert) {
  try { globalThis.localStorage?.setItem(schluessel, JSON.stringify(wert)); } catch { /* voll oder gesperrt: dann eben nicht */ }
}

// Was die Seite gerade zeigt (Für dich, Suche, Kategorien, Finder) — nur im Speicher dieser Sitzung. Öffnet man
// einen Eintrag, steht im Blatt derselbe Satz „Warum sehe ich das?" wie in der Liste. Alles andere (Gemerktes,
// ein geteilter Link) löst die Datenschicht auf: repo.findEintragStand (Paket G2, Befund 3) — die frühere
// Ablage im Gerät ist entfallen (und wird einmal weggeräumt).
let bekannt = null;
function bekanntMap() {
  if (!bekannt) {
    bekannt = new Map();
    try { globalThis.localStorage?.removeItem(SPEICHER_BEKANNT_ALT); } catch { /* gesperrt: dann eben nicht */ }
  }
  return bekannt;
}
function merkeBekannt(liste) {
  const map = bekanntMap();
  for (const e of liste || []) {
    if (!e?.id || map.get(e.id) === e) continue;
    map.delete(e.id);
    map.set(e.id, e);
  }
  while (map.size > BEKANNT_MAX) map.delete(map.keys().next().value);
}

// =============================================================================================
// Daten: EIN Stand je Zeichnen
// =============================================================================================
// V1-Kern §7: Für 14- und 15-Jährige keine Tipps mit Alkohol-Schwerpunkt — auch in Suche und Kategorien
// (dort gibt es keinen Personenfilter, die gesetzliche Grenze gilt trotzdem). Die Art sagt es sicherer als
// der Name: eine Bar heißt nicht immer „Bar".
const ALKOHOL_ARTEN = new Set(['bar', 'club', 'party']);
function jugendErlaubt(e) {
  return !ALKOHOL_ARTEN.has(e?.crewArt) && !hatAlkoholSchwerpunkt(e);
}

function fuerDichOptionen(ui) {
  return ui.findRadius ? { radiusKm: ui.findRadius } : {};
}

// Kein Springen unter dem Finger: Kommt eine neue Liste (z. B. nach `vorlaeufig`), während ein Finger
// auf der Seite liegt, bleibt die alte stehen, bis er loslässt — dann wird still getauscht.
let beruehrt = false;
let tauschOffen = false;
let angezeigt = null;

function listenZeichen(daten) {
  return (daten?.eintraege || []).map((e) => e.id).join('|');
}

function findStand(ctx) {
  const { repo, ui } = ctx;
  const jetzt = now().getTime();
  const settings = repo.getSettings?.() || {};
  let jung = false;
  try { jung = typeof repo.istJugendlich === 'function' && repo.istJugendlich() === true; } catch { jung = false; }
  const erlaubt = jung ? jugendErlaubt : null;
  const versteckt = ui.findVersteckt instanceof Set ? ui.findVersteckt : (ui.findVersteckt = new Set());
  const opts = fuerDichOptionen(ui);
  const schluessel = JSON.stringify(opts);
  // Unter dem Wischspiel lädt „Für dich" nicht bei jeder Antwort neu (jede Antwort ist ein Signal, und am
  // Server lässt jedes Signal die Liste neu fragen — zehn Anfragen in zwanzig Sekunden, gemessen). Die
  // Liste liegt ohnehin unter dem Blatt; sie kommt EINMAL neu, wenn das Spiel geschlossen wird.
  const unterSpiel = Boolean(ui.findWisch) && angezeigt?.schluessel === schluessel;
  let roh = null;
  if (unterSpiel) roh = { daten: angezeigt.daten, laedt: false, fehler: null };
  else {
    try { roh = typeof repo.findAuswahlStand === 'function' ? repo.findAuswahlStand(opts) : null; } catch { roh = null; }
  }
  let daten = roh?.daten || null;
  if (daten && angezeigt && angezeigt.schluessel === schluessel && beruehrt && listenZeichen(angezeigt.daten) !== listenZeichen(daten)) {
    daten = angezeigt.daten;
    tauschOffen = true;
  } else if (daten) {
    angezeigt = { schluessel, daten };
  }
  const fuerDich = auswahl.fuerDichGliedern(daten, { jetzt, versteckt, erlaubt });
  merkeBekannt(fuerDich.bekannt);
  const gemerktIds = Array.isArray(settings.gemerktIds) ? settings.gemerktIds : [];
  return {
    jetzt,
    settings,
    jung,
    erlaubt,
    versteckt,
    daten,
    laedt: Boolean(roh?.laedt),
    fehler: roh?.laedt ? null : (roh?.fehler || null),
    fuerDich,
    gemerktIds,
    gemerkt: new Set(gemerktIds),
  };
}

// Ein Eintrag nach Kennung: zuerst, wie er gerade auf der Seite steht (mit dem Satz, warum er dort steht), sonst
// aus der Datenschicht (repo.findEintragStand — Gemerktes, Link-Ankunft; am Server beim ersten Mal unterwegs).
function eintragStand(ctx, id) {
  const kennung = String(id || '');
  const da = bekanntMap().get(kennung);
  if (da) return { eintrag: da, laedt: false, fehler: null };
  let s = null;
  try { s = typeof ctx.repo.findEintragStand === 'function' ? ctx.repo.findEintragStand(kennung) : null; } catch { s = null; }
  return s || { eintrag: null, laedt: false, fehler: null };
}

function eintragVon(ctx, id) {
  return eintragStand(ctx, id).eintrag || null;
}

// =============================================================================================
// Kleine Bausteine
// =============================================================================================
function zeitText(ms) {
  const d = new Date(ms);
  return `${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`;
}

function wannKurz(eintrag) {
  const von = auswahl.zeitpunkt(eintrag?.wann?.von);
  if (von == null) return '';
  return grobeZeit({ date: toISODate(new Date(von)), time: zeitText(von) });
}

function wannLang(eintrag) {
  const von = auswahl.zeitpunkt(eintrag?.wann?.von);
  if (von == null) return '';
  const bisMs = auswahl.zeitpunkt(eintrag.wann.bis);
  const iso = toISODate(new Date(von));
  const bisGleicherTag = bisMs != null && toISODate(new Date(bisMs)) === iso;
  const bis = bisMs != null && bisMs > von ? (bisGleicherTag ? zeitText(bisMs) : `${weekdayShort(toISODate(new Date(bisMs)))} ${zeitText(bisMs)}`) : '';
  return `${weekdayLong(iso)}, ${tagUndMonat(new Date(von))} · ${bis ? `${zeitText(von)}–${bis}` : zeitText(von)}`;
}

// Die Öffnungszeit sagt nur etwas, wenn sie bekannt ist — „Öffnungszeiten unbekannt" gehört ins Blatt,
// nicht in jede Zeile.
function oeffnungKurz(eintrag) {
  if (eintrag?.eintragTyp !== 'ort' || !eintrag.oeffnungsHinweis) return '';
  return eintrag.texte?.oeffnung?.text === KONFIG_AUSWAHL.texte.oeffnungUnbekannt ? '' : eintrag.oeffnungsHinweis;
}

function kmWort(eintrag) {
  return typeof eintrag?.entfernungKm === 'number' ? tx('{km} km', { km: kmText(eintrag.entfernungKm) }) : '';
}

// Die Zeile unter dem Titel: bei Terminen wann und wo, bei Orten offen/zu und wie weit, bei Ideen der
// Satz aus ihrer Beschreibung. Unter 70 (Namenssuche) steht, dass es keine Empfehlung ist.
function unterzeile(eintrag) {
  if (eintrag.nichtEmpfohlen) return [tx(KONFIG_AUSWAHL.texte.nichtEmpfohlen), kmWort(eintrag)].filter(Boolean).join(' · ');
  if (eintrag.eintragTyp === 'idee') return eintrag.beschreibung || '';
  if (eintrag.eintragTyp === 'event') return [wannKurz(eintrag), eintrag.ort?.adresse || '', kmWort(eintrag)].filter(Boolean).join(' · ');
  return [oeffnungKurz(eintrag), kmWort(eintrag)].filter(Boolean).join(' · ');
}

// Das Zeichen eines Eintrags: dieselbe Regel wie die Vorschlagskarten (auswahl-weg.js › auswahlAlsVorschlag).
const vorschlagCache = new WeakMap();
function alsVorschlag(eintrag) {
  if (!vorschlagCache.has(eintrag)) vorschlagCache.set(eintrag, auswahlAlsVorschlag(eintrag));
  return vorschlagCache.get(eintrag);
}
function zeichenSchluessel(eintrag) {
  return alsVorschlag(eintrag).iconKey || iconKeyForText(eintrag.titel) || (eintrag.eintragTyp === 'event' ? 'ticket' : 'funkeln');
}
function zeichen(eintrag, farbe, groesse) {
  return activityIconSvg({ iconKey: zeichenSchluessel(eintrag) }, farbe, groesse);
}

function bildInhalt(eintrag, groesse) {
  const foto = eintrag.bild
    ? `<img src="${esc(eintrag.bild)}" alt="" loading="lazy" referrerpolicy="no-referrer" onerror="this.remove()">`
    : '';
  return `<span class="fnd-zeichen" aria-hidden="true">${zeichen(eintrag, 'var(--ink-soft)', groesse)}</span>${foto}`;
}

function anzeigePille() {
  return `<span class="fnd-pille fnd-glas fnd-leise" data-role="find-anzeige">${esc(tx('Anzeige'))}</span>`;
}

function merkenZeichen(an) {
  const pfad = 'M7 3.6h10a1.4 1.4 0 0 1 1.4 1.4v15.6l-6.4-4.4-6.4 4.4V5A1.4 1.4 0 0 1 7 3.6Z';
  return `<svg width="17" height="17" viewBox="0 0 24 24" fill="none" aria-hidden="true" style="display:block;flex:none;pointer-events:none"><path d="${pfad}" stroke="currentColor" stroke-width="1.8" stroke-linejoin="round" fill="${an ? 'currentColor' : 'none'}"></path></svg>`;
}

// --- Crew Score: Ring, Stufe, Gründe (ALGORITHMUS §2.11) ----------------------------------------
function stufeWort(stufe) {
  switch (stufe) {
    case 'herausragend': return tx('herausragend');
    case 'sehr_gut': return tx('sehr gut');
    case 'gut': return tx('gut');
    default: return '';
  }
}

function hatZahl(eintrag) {
  return typeof eintrag?.score === 'number' && !eintrag.nichtEmpfohlen && !eintrag.scoreNeu;
}

// Warum „Neu" statt einer Zahl. Die Datenschicht sagt (noch) nicht, welcher der Fälle aus §2.5 es ist —
// dann steht nur, was immer stimmt. Kommt `neuGrund` mit, gilt B's Satz (konfig-score.js › texte.neu).
function neuText(eintrag) {
  switch (eintrag?.neuGrund) {
    case 'osm_jung': return tx('Noch keine Bewertung — frisch in OpenStreetMap');
    case 'wenig_daten': return tx('Noch keine Bewertung — wir wissen noch zu wenig');
    case 'zu_wenig_vergleich': return tx('Einzigartig hier — noch nichts zum Vergleichen');
    default: return tx('Noch keine Bewertung');
  }
}

function ringSvg(eintrag, groesse) {
  const stufe = stufeVon(eintrag.score) || 'ohne';
  const titel = tx('{score} {n}, {stufe}', { score: MARKE.score, n: Math.round(eintrag.score), stufe: stufeWort(stufe) });
  return `<span class="fnd-ring" data-stufe="${esc(stufe)}">${scoreRing({ wert: eintrag.score, groesse, beschriftung: titel })}</span>`;
}

// Die Anzeige an Karte, Zeile und Blatt: Ring mit Zahl · „Neu" · (Ideen, unter 70) nichts.
// `glas`: auf einem Bild liegend.
function scoreAnzeige(eintrag, { groesse = 40, glas = false } = {}) {
  if (hatZahl(eintrag)) {
    const stufe = stufeVon(eintrag.score);
    const wortLaut = `${MARKE.score} ${Math.round(eintrag.score)}, ${stufeWort(stufe)}`;
    const ring = ringSvg(eintrag, groesse);
    return `<button type="button" class="fnd-ring-knopf" data-act="find-gruende" data-id="${esc(eintrag.id)}" data-role="find-score" data-stufe="${esc(stufe)}" data-zahl="${Math.round(eintrag.score)}" aria-label="${esc(tx('{wort} — Gründe zeigen', { wort: wortLaut }))}">${glas ? `<span class="fnd-ring-glas">${ring}</span>` : ring}</button>`;
  }
  if (eintrag.scoreNeu) {
    return `<button type="button" class="fnd-neu" data-act="find-gruende" data-id="${esc(eintrag.id)}" data-role="find-neu" aria-label="${esc(tx('Neu — {text}', { text: neuText(eintrag) }))}">${esc(tx('Neu'))}</button>`;
  }
  return '';
}

function gruendeListe(eintrag) {
  const gruende = (eintrag.scoreGruende || []).map((g) => String(g?.text || '').trim()).filter(Boolean).slice(0, 3);
  if (!gruende.length) return '';
  return `<ul class="fnd-gruende" data-role="find-score-gruende">${gruende.map((text) => `<li class="fnd-grund" data-role="find-grund">${symbol('haken', 'var(--green-dark)', 14)}<span>${esc(text)}</span></li>`).join('')}</ul>`;
}

// =============================================================================================
// Zeilen, Hero, Abschnitte
// =============================================================================================
function frageKnopf(eintrag, oben = null) {
  return `<span class="fnd-auf-bild-rechts"${oben != null ? ` style="top:${Number(oben)}px"` : ''}><button type="button" class="fnd-frage-knopf" data-act="find-frage" data-id="${esc(eintrag.id)}" data-role="find-frage-knopf" aria-label="${esc(tx('Fragen und Fehler melden'))}"><span>?</span></button></span>`;
}

function platzhalterHtml(eintrag) {
  return `<div class="fnd-zeile fnd-platzhalter" data-role="find-weniger-platz" data-id="${esc(eintrag.id)}">
<span>${esc(tx('„{titel}“ ausgeblendet', { titel: eintrag.titel }))}</span>
<button type="button" class="fnd-knopf fnd-knopf-klein" data-act="find-weniger-zurueck" data-role="find-rueckgaengig">${esc(tx('Rückgängig'))}</button>
</div>`;
}

// Eine Zeile: links öffnet sie das Blatt, rechts der Ring zeigt die Gründe. `zaehlen`: die Anzeige
// zählt für „ignoriert" (nur „Für dich").
function zeileHtml(eintrag, ctx, { zaehlen = false } = {}) {
  if (ctx.ui.findWeniger?.id === eintrag.id) return platzhalterHtml(eintrag);
  const unter = unterzeile(eintrag);
  const anzeige = eintrag.gesponsert ? `<span data-role="find-anzeige" style="flex:none;font-weight:650">${esc(tx('Anzeige'))}</span>${unter ? '<span aria-hidden="true" style="flex:none">·</span>' : ''}` : '';
  const anders = eintrag.malWasAnderes ? `<span class="fnd-anders" data-role="find-mal-was-anderes">${symbol('funkeln', 'var(--orange-dark)', 11)}${esc(tx(KONFIG_AUSWAHL.texte.malWasAnderes))}</span>` : '';
  return `<div class="fnd-zeile" data-role="find-zeile" data-id="${esc(eintrag.id)}"${zaehlen ? ' data-zaehlen="1"' : ''}${eintrag.malWasAnderes ? ' data-anders="1"' : ''}${eintrag.nichtEmpfohlen ? ' data-nicht-empfohlen="1"' : ''}>
<button type="button" class="fnd-zeile-haupt" data-act="find-oeffnen" data-id="${esc(eintrag.id)}" data-role="find-zeile-knopf">
<span class="fnd-daumen">${bildInhalt(eintrag, 22)}</span>
<span class="fnd-zeile-text">${anders}<span class="fnd-zeile-titel">${esc(eintrag.titel)}</span>${unter || anzeige ? `<span class="fnd-unter">${anzeige}<span>${esc(unter)}</span></span>` : ''}</span>
</button>
${scoreAnzeige(eintrag)}
</div>`;
}

function heroHtml(eintrag, ctx, stand) {
  if (!eintrag) return '';
  if (ctx.ui.findWeniger?.id === eintrag.id) return `<div class="fnd-liste">${platzhalterHtml(eintrag)}</div>`;
  const gemerkt = stand.gemerkt.has(eintrag.id);
  const unter = unterzeile(eintrag);
  const anders = eintrag.malWasAnderes ? `<span class="fnd-anders" data-role="find-mal-was-anderes" style="margin-top:8px">${esc(tx(KONFIG_AUSWAHL.texte.malWasAnderes))}</span>` : '';
  return `<section class="fnd-hero" data-role="find-abschnitt" data-abschnitt="hero" aria-label="${esc(TOP_PICK)}">
<div class="fnd-hero-kasten" data-zaehlen="1" data-id="${esc(eintrag.id)}">
<button type="button" class="fnd-hero-karte" data-act="find-oeffnen" data-id="${esc(eintrag.id)}" data-role="find-hero" data-anzeige="${eintrag.gesponsert ? '1' : '0'}">
<span class="fnd-hero-bild">${bildInhalt(eintrag, 56)}<span class="fnd-hero-marke"><span class="fnd-pille fnd-glas" data-role="find-top-pick">${esc(TOP_PICK)}</span>${eintrag.gesponsert ? anzeigePille() : ''}</span></span>
${anders}
<span class="fnd-hero-titel">${esc(eintrag.titel)}</span>
${unter ? `<span class="fnd-unter"><span>${esc(unter)}</span></span>` : ''}
${eintrag.warum ? `<span class="fnd-unter fnd-grund-zeile" data-role="find-grund">${symbol('funkeln', 'var(--green-dark)', 12)}<span>${esc(eintrag.warum)}</span></span>` : ''}
</button>
${scoreAnzeige(eintrag) ? `<span class="fnd-auf-bild-links">${scoreAnzeige(eintrag, { groesse: 40, glas: true })}</span>` : ''}
${frageKnopf(eintrag)}
</div>
<div class="fnd-hero-fuss">
<button type="button" class="fnd-knopf" data-act="find-planen" data-id="${esc(eintrag.id)}" data-role="find-hero-planen" data-art="haupt">${esc(tx('Meet planen'))}</button>
<button type="button" class="fnd-merken-rund" data-act="find-merken" data-id="${esc(eintrag.id)}" data-role="find-merken" aria-pressed="${gemerkt ? 'true' : 'false'}" aria-label="${esc(gemerkt ? tx('Gemerkt') : tx('Merken'))}">${merkenZeichen(gemerkt)}</button>
</div>
</section>`;
}

function mehrKnopf(id, offen, anzahl) {
  return `<button type="button" class="fnd-mehr" data-act="find-mehr" data-abschnitt="${esc(id)}" data-role="find-mehr" aria-expanded="${offen ? 'true' : 'false'}">${esc(offen ? tx('Weniger zeigen') : tx('Alle {n} zeigen', { n: anzahl }))}</button>`;
}

// „Für dich" unter dem Crew-Tipp: oben die Besten nach den Regeln der Auswahl (Abstandsregel, Vielfalt), in
// ihrer Reihenfolge. Darunter, was nach unten gerutscht ist — hinter „Mehr anzeigen", nicht gelöscht.
function fuerDichListeHtml(fuerDich, ctx) {
  const oben = fuerDich.oben.length
    ? `<section data-role="find-abschnitt" data-abschnitt="oben" aria-label="${esc(tx('Für dich'))}">
<div class="fnd-liste">${fuerDich.oben.map((e) => zeileHtml(e, ctx, { zaehlen: true })).join('')}</div>
</section>`
    : '';
  if (!fuerDich.weitere.length) return oben;
  const offen = Boolean(ctx.ui.findMehr?.weitere);
  const knopf = `<button type="button" class="fnd-mehr" data-act="find-mehr" data-abschnitt="weitere" data-role="find-mehr" aria-expanded="${offen ? 'true' : 'false'}">${esc(offen ? tx('Weniger zeigen') : tx('Mehr anzeigen'))}</button>`;
  return `${oben}
<section data-role="find-abschnitt" data-abschnitt="weitere" aria-label="${esc(tx('Weitere Vorschläge'))}">
${offen ? `<h2 class="fnd-kopf">${esc(tx('Weitere Vorschläge'))}</h2>
<div class="fnd-liste" data-role="find-weitere">${fuerDich.weitere.map((e) => zeileHtml(e, ctx, { zaehlen: true })).join('')}</div>` : ''}
${knopf}
</section>`;
}

// =============================================================================================
// Suche und Kategorien (ZUSATZ §6)
// =============================================================================================
function kategorieWort(id) {
  switch (id) {
    case 'events': return tx('Events');
    case 'essen': return tx('Essen');
    case 'clubbar': return tx('Club & Bar');
    case 'kultur': return tx('Kultur');
    case 'natur': return tx('Natur');
    case 'sport': return tx('Sport');
    case 'wellness': return tx('Baden & Wellness');
    case 'hobby': return tx('Spiele & Hobby');
    case 'zuhause': return tx('Zuhause');
    default: return '';
  }
}

const KATEGORIE_ZEICHEN = { events: 'ticket', essen: 'gabel', clubbar: 'glas', kultur: 'museum', natur: 'berg', sport: 'hantel', wellness: 'wellen', hobby: 'wuerfel', zuhause: 'sofa' };

function sucheHtml(ctx, stand) {
  const suche = ctx.ui.findSuche;
  const text = String(suche?.text || '');
  const kats = auswahl.KATEGORIEN
    .filter((k) => !(stand.jung && k.id === 'clubbar'))
    .map((k) => `<button type="button" class="fnd-kat" data-act="find-kategorie" data-kategorie="${esc(k.id)}" data-role="find-kategorie" aria-pressed="${ctx.ui.findKat?.id === k.id ? 'true' : 'false'}">${symbol(KATEGORIE_ZEICHEN[k.id] || 'funkeln', 'currentColor', 15)}${esc(kategorieWort(k.id))}</button>`).join('');
  return `<div data-role="find-suche-bereich">
<label class="fnd-suche" data-role="find-suche">${symbol('suchen', 'var(--muted)', 17)}<input id="find-suche-feld" type="search" inputmode="search" enterkeyhint="search" autocomplete="off" autocorrect="off" spellcheck="false" maxlength="80" placeholder="${esc(tx('Orte, Events, Ideen suchen'))}" aria-label="${esc(tx('Suchen'))}">${text ? `<button type="button" class="fnd-x" data-act="find-suche-leeren" data-role="find-suche-leeren" aria-label="${esc(tx('Suche löschen'))}">${symbol('kreuz', 'var(--muted)', 14)}</button>` : ''}</label>
${edgeFadeRow(kats, { gap: 8, padLeft: RAND, padRight: RAND, padY: '10px 0 0', scrollKey: 'find-kategorien' })}
</div>`;
}

function ladeHtml(text) {
  return `<div class="fnd-laedt" data-role="find-laedt" aria-busy="true" role="status">
<div class="fnd-laedt-flaeche" style="height:172px"></div>
<div class="fnd-laedt-flaeche" style="height:52px;margin-top:14px;border-radius:14px"></div>
<div class="fnd-laedt-flaeche" style="height:52px;margin-top:8px;border-radius:14px"></div>
<p class="fnd-hinweis" style="text-align:center">${esc(text)}</p>
</div>`;
}

function fehlerHtml(act, extra = '') {
  return `<div class="fnd-kasten" data-role="find-fehler" role="alert">
<span class="fnd-kasten-text">${esc(tx('Hat nicht geklappt'))}</span>
<div class="fnd-kasten-reihe"><button type="button" class="fnd-knopf fnd-knopf-klein" data-act="${esc(act)}" data-role="find-nochmal" ${extra}>${esc(tx('Nochmal'))}</button></div>
</div>`;
}

function trefferKopf(titel, zu) {
  return `<div class="fnd-kopf-zeile"><h2 class="fnd-kopf">${esc(titel)}</h2><button type="button" class="fnd-x" data-act="${esc(zu)}" data-role="find-ergebnis-zu" aria-label="${esc(tx('Schließen'))}">${symbol('kreuz', 'var(--ink-soft)', 14)}</button></div>`;
}

function suchergebnisHtml(ctx, stand) {
  const suche = ctx.ui.findSuche;
  const text = String(suche.text || '').trim();
  const liste = auswahl.eintraegeSaeubern(suche.liste, { jetzt: stand.jetzt, versteckt: stand.versteckt, erlaubt: stand.erlaubt });
  merkeBekannt(liste);
  let inhalt;
  if (suche.fehler) inhalt = fehlerHtml('find-suche-nochmal');
  else if (suche.laedt && !suche.liste) inhalt = `<p class="fnd-leise-zeile" role="status">${esc(tx('Suche läuft …'))}</p>`;
  else if (!liste.length) inhalt = `<p class="fnd-leise-zeile" data-role="find-nichts">${esc(tx('Nichts gefunden für „{text}“', { text }))}</p>`;
  else inhalt = `<div class="fnd-liste">${liste.map((e) => zeileHtml(e, ctx)).join('')}</div>`;
  return `<section data-role="find-suchergebnis" data-text="${esc(text)}" aria-label="${esc(tx('Suche'))}">
${trefferKopf(tx('Treffer für „{text}“', { text }), 'find-suche-leeren')}
${inhalt}
</section>`;
}

function kategorieHtml(ctx, stand) {
  const kat = ctx.ui.findKat;
  const liste = auswahl.kategorieListe(kat.antworten || [], { jetzt: stand.jetzt, versteckt: stand.versteckt, erlaubt: stand.erlaubt });
  merkeBekannt(liste);
  const offen = Boolean(ctx.ui.findMehr?.[`kat-${kat.id}`]);
  const kurz = 12;
  let inhalt;
  if (kat.fehler) inhalt = fehlerHtml('find-kategorie-nochmal');
  else if (kat.laedt && !kat.antworten) inhalt = `<p class="fnd-leise-zeile" role="status">${esc(tx('Lädt …'))}</p>`;
  else if (!liste.length) inhalt = `<p class="fnd-leise-zeile" data-role="find-nichts">${esc(tx('Hier in der Gegend gibt es dazu gerade nichts.'))}</p>`;
  else {
    inhalt = `<div class="fnd-liste">${(offen ? liste : liste.slice(0, kurz)).map((e) => zeileHtml(e, ctx)).join('')}</div>${liste.length > kurz ? mehrKnopf(`kat-${kat.id}`, offen, liste.length) : ''}`;
  }
  return `<section data-role="find-kategorie-ergebnis" data-kategorie="${esc(kat.id)}" aria-label="${esc(kategorieWort(kat.id))}">
${trefferKopf(kat.id === 'zuhause' ? kategorieWort(kat.id) : tx('{kategorie} · nach {score}', { kategorie: kategorieWort(kat.id), score: MARKE.score }), 'find-kategorie-zu')}
${inhalt}
</section>`;
}

// =============================================================================================
// „Für dich"
// =============================================================================================
function standortPille(stand) {
  if (stand.settings.location?.use) return '';
  return `<div data-role="find-standort-pille" style="padding:8px ${RAND}px 0">${hinweisPille({ text: tx('Standort aktivieren'), act: 'find-standort' })}</div>`;
}

// Das Wischspiel kennt nur, wer wenig von sich gezeigt hat (find-auswahl.js › wischKarteZeigen).
// Nach dem Spiel frisch fragen — das Gerät rechnet sofort, der Server hält die neue Antwort (gelerntesStand).
function gelerntLaden(ctx) {
  if (ctx.preview || typeof ctx.repo.getGelerntes !== 'function') return;
  Promise.resolve(ctx.repo.getGelerntes()).catch(() => {}).finally(() => ctx.render());
}

// Chef (01.10., r7b K7 gemessen): Die Karte kam erst NACH dem Tabwechsel — das Gelernte lud erst in der
// Bindung, als Promise — und schob „Für dich" 88 px nach unten, während der Mensch schon hinsah. Jetzt
// entscheidet sich beim AUFBAU der Seite (auch der vorgebauten in der Bahn), ob sie steht: aus dem, was
// gelerntesStand() in diesem Moment weiß (im Gerät sofort, am Server die gehaltene Antwort). Die Entscheidung
// gilt für diesen Besuch (ctx.ui gehört dem Tab und wird beim Verlassen geleert). Später eintreffende Daten
// schieben nichts über den sichtbaren Inhalt — sie wirken beim nächsten Aufbau. Wegnehmen darf sie, was der
// Mensch selbst tut („Später", gespielt → Pause): das wirkt sofort.
function wischKarteHtml(ctx, inhaltSichtbar = true) {
  const pause = lesen(SPEICHER_WISCH, 0);
  if (ctx.ui.findWischKarte === undefined) {
    let gelernt = null;
    let unterwegs = false;
    try {
      const g = typeof ctx.repo.gelerntesStand === 'function' ? ctx.repo.gelerntesStand() : null;
      gelernt = g?.daten || null;
      unterwegs = !gelernt && !g?.fehler && Boolean(g?.laedt);
    } catch { gelernt = null; }
    // Noch unterwegs und „Für dich" zeigt erst den Lade-Hinweis: offen lassen — die Karte darf noch kommen,
    // ohne fertigen Inhalt zu verschieben. Sonst gilt die Entscheidung für diesen Besuch.
    if (unterwegs && !inhaltSichtbar) return '';
    ctx.ui.findWischKarte = auswahl.wischKarteZeigen(gelernt, pause, Date.now());
  }
  if (!ctx.ui.findWischKarte || auswahl.wischPausiert(pause, Date.now())) return '';
  return `<div class="fnd-wisch-karte" data-role="find-wisch-karte">
${crewFigur(38, { rolle: 'find-wisch-figur' })}
<span class="fnd-wisch-karte-text">${esc(tx('{name} kennt dich noch kaum', { name: MARKE.name }))}<small>${esc(tx('10 Karten, 20 Sekunden'))}</small></span>
<button type="button" class="fnd-knopf fnd-knopf-klein" data-act="find-wisch-start" data-role="find-wisch-start" data-art="haupt">${esc(tx('Los'))}</button>
<button type="button" class="fnd-x" data-act="find-wisch-spaeter" data-role="find-wisch-spaeter" aria-label="${esc(tx('Später'))}">${symbol('kreuz', 'var(--muted)', 13)}</button>
</div>`;
}

function radiusZeile(ctx) {
  if (!ctx.ui.findRadius) return '';
  return `<p class="fnd-leise-zeile" data-role="find-radius">${esc(tx('Im Umkreis von {km} km', { km: ctx.ui.findRadius }))}<button type="button" data-act="find-radius-zurueck" data-role="find-radius-zurueck">${esc(tx('Zurücksetzen'))}</button></p>`;
}

function leerHtml(ctx, stand) {
  const daten = stand.daten;
  if (daten?.ohneStandort) {
    return `<div class="fnd-kasten" data-role="find-ohne-standort">
<span class="fnd-kasten-text">${esc(tx('Für Vorschläge braucht {name} deinen Standort oder dein Zuhause.', { name: MARKE.name }))}</span>
<div class="fnd-kasten-reihe"><button type="button" class="fnd-knopf fnd-knopf-klein" data-act="find-standort" data-art="haupt">${esc(tx('Standort aktivieren'))}</button></div>
</div>`;
  }
  const jetzigerKm = ctx.ui.findRadius || KONFIG_AUSWAHL.radius.standardKm;
  const naechster = auswahl.naechsterRadius(RADIUS_STUFEN, jetzigerKm);
  return `<div class="fnd-kasten" data-role="find-leer">
<span class="fnd-kasten-text">${esc(daten?.leerText || tx(KONFIG_AUSWAHL.texte.leer))}</span>
${naechster
    ? `<div class="fnd-kasten-reihe"><button type="button" class="fnd-knopf fnd-knopf-klein" data-act="find-radius" data-km="${naechster}" data-role="find-radius-erweitern" data-art="haupt">${esc(tx('Auf {km} km erweitern', { km: naechster }))}</button></div>`
    : `<span class="fnd-hinweis">${esc(tx('Auch im Umkreis von {km} km nicht. In der Suche und den Kategorien oben steht alles.', { km: jetzigerKm }))}</span>`}
</div>`;
}

function fuerDichHtml(ctx, stand) {
  const { fuerDich, daten } = stand;
  let rumpf;
  if (!daten && stand.fehler) rumpf = fehlerHtml('find-nochmal');
  else if (!daten) rumpf = ladeHtml(tx('{name} sucht, was zu dir passt …', { name: MARKE.name }));
  else if (!fuerDich.hero) rumpf = leerHtml(ctx, stand);
  else {
    rumpf = `${heroHtml(fuerDich.hero, ctx, stand)}
${daten.vorlaeufig ? `<p class="fnd-leise-zeile" data-role="find-vorlaeufig" role="status">${esc(tx('Weitere Orte in der Gegend werden geladen …'))}</p>` : ''}
${stand.fehler ? `<p class="fnd-leise-zeile" role="alert">${esc(tx('Hat nicht geklappt'))}<button type="button" data-act="find-nochmal" data-role="find-nochmal">${esc(tx('Nochmal'))}</button></p>` : ''}
${fuerDichListeHtml(fuerDich, ctx)}`;
  }
  return `<section data-role="find-fuer-dich" aria-label="${esc(tx('Für dich'))}">
${wischKarteHtml(ctx, Boolean(daten))}
<h2 class="fnd-kopf" data-role="find-fuer-dich-kopf">${esc(tx('Für dich'))}</h2>
${radiusZeile(ctx)}
${rumpf}
</section>`;
}

function seiteHtml(ctx, stand) {
  const suche = ctx.ui.findSuche;
  const sucht = String(suche?.text || '').trim().length >= 2;
  const inhalt = sucht ? suchergebnisHtml(ctx, stand) : (ctx.ui.findKat ? kategorieHtml(ctx, stand) : fuerDichHtml(ctx, stand));
  return `<div class="fnd" data-role="find-seite">
${standortPille(stand)}
${sucheHtml(ctx, stand)}
${inhalt}
</div>`;
}

// =============================================================================================
// Blätter: Gründe · Eintrag · „?" · Gemerkt · Finder · Wischspiel
// =============================================================================================
function gruendeBlatt(eintrag) {
  const kopf = hatZahl(eintrag)
    ? `<div class="fnd-wertung-zeile">${ringSvg(eintrag, 56)}<span class="fnd-wertung-wort"><span data-role="find-gruende-zahl">${esc(`${MARKE.score} ${Math.round(eintrag.score)}`)}</span><small data-role="find-stufe">${esc(stufeWort(stufeVon(eintrag.score)))}</small></span></div>`
    : `<div class="fnd-wertung-zeile"><span class="fnd-neu" style="cursor:default">${esc(tx('Neu'))}</span><span class="fnd-wertung-wort"><span data-role="find-neu-text">${esc(neuText(eintrag))}</span></span></div>`;
  const inhalt = `<div class="fnd-blatt" data-role="find-gruende-blatt" data-id="${esc(eintrag.id)}">
<h2 class="fnd-frage" style="font-size:19px">${esc(eintrag.titel)}</h2>
<div class="fnd-wertung">${kopf}${hatZahl(eintrag) ? gruendeListe(eintrag) : ''}</div>
${eintrag.passungText ? `<p class="fnd-hinweis" data-role="find-passung" style="font-size:13px;color:var(--ink-soft)">${esc(eintrag.passungText)}</p>` : ''}
</div>`;
  return sheet(inhalt, { closeAct: 'find-gruende-zu', scrollKey: `find-gruende-${eintrag.id}` });
}

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

function warumBlock(eintrag, { mitLink = true } = {}) {
  if (!eintrag.warum && !eintrag.passungText) return '';
  return `<div class="fnd-warum" data-role="find-warum">
<span class="fnd-warum-titel">${esc(tx('Warum sehe ich das?'))}</span>
${eintrag.warum ? `<span class="fnd-warum-satz" data-role="find-warum-satz">${esc(eintrag.warum)}</span>` : ''}
${eintrag.passungText ? `<span class="fnd-warum-passung" data-role="find-warum-passung">${esc(eintrag.passungText)}</span>` : ''}
${mitLink ? `<button type="button" data-act="find-gelernt" data-role="find-gelernt-link">${esc(tx('Was {name} gelernt hat', { name: MARKE.name }))} ›</button>` : ''}
</div>`;
}

function detailBlatt(ctx, stand, eintrag) {
  const gemerkt = stand.gemerkt.has(eintrag.id);
  const koordinaten = auswahl.hatKoordinaten(eintrag);
  const wann = wannLang(eintrag);
  const ortName = eintrag.eintragTyp === 'event' ? (eintrag.ort?.adresse || '') : (eintrag.eintragTyp === 'ort' ? (eintrag.ort?.adresse || tx('Auf der Karte')) : '');
  const ortZeile = [ortName, kmWort(eintrag)].filter(Boolean).join(' · ');
  const fakten = [
    wann ? `<span class="fnd-fakt" data-role="find-wann">${symbol('kalender', 'var(--muted)', 17)}<span>${esc(wann)}</span></span>` : '',
    ortZeile
      ? (koordinaten
        ? `<button type="button" class="fnd-fakt" data-act="find-karte-gross" data-id="${esc(eintrag.id)}" data-role="find-ort">${symbol('ort', 'var(--muted)', 17)}<span>${esc(ortZeile)}</span></button>`
        : `<span class="fnd-fakt" data-role="find-ort">${symbol('ort', 'var(--muted)', 17)}<span>${esc(ortZeile)}</span></span>`)
      : '',
    eintrag.eintragTyp === 'ort' && eintrag.oeffnungsHinweis ? `<span class="fnd-fakt" data-role="find-oeffnung">${symbol('uhr', 'var(--muted)', 17)}<span>${esc(eintrag.oeffnungsHinweis)}</span></span>` : '',
    eintrag.wetterHinweis ? `<span class="fnd-fakt" data-role="find-wetter">${symbol('sonne', 'var(--muted)', 17)}<span>${esc(eintrag.wetterHinweis)}</span></span>` : '',
    eintrag.nichtEmpfohlen ? `<span class="fnd-fakt" data-role="find-nicht-empfohlen">${symbol('info', 'var(--muted)', 17)}<span>${esc(tx(KONFIG_AUSWAHL.texte.nichtEmpfohlen))}</span></span>` : '',
  ].join('');
  // Der Crew-Tipp (Platz 1 von „Für dich") trägt sein Schild auch im Blatt — dasselbe Wort wie oben am Bild.
  const tippPille = stand.fuerDich.hero?.id === eintrag.id
    ? `<span class="fnd-pille" data-role="find-tipp" style="background:var(--green);color:var(--on-accent)">${symbol('haken', 'var(--on-accent)', 11)}${esc(TOP_PICK)}</span>` : '';
  // Crew Score und Tester-Bewertung stehen GETRENNT: zwei Zeilen, zwei Namen (R8-50).
  const scoreZeile = hatZahl(eintrag)
    ? `<div class="fnd-wertung-zeile" data-role="find-wertung-score">${ringSvg(eintrag, 48)}<span class="fnd-wertung-wort"><span>${esc(MARKE.score)}</span><small data-role="find-stufe">${esc(stufeWort(stufeVon(eintrag.score)))}</small></span>${tippPille}</div>${gruendeListe(eintrag)}`
    : (eintrag.scoreNeu ? `<div class="fnd-wertung-zeile" data-role="find-wertung-neu"><span class="fnd-neu" style="cursor:default">${esc(tx('Neu'))}</span><span class="fnd-wertung-wort"><span>${esc(neuText(eintrag))}</span></span></div>` : '');
  const tester = eintrag.testerBewertung;
  const beispielWort = tx('Beispiel');
  const testerText = String(tester?.text || '');
  const beispiel = tester?.beispiel && !testerText.toLowerCase().startsWith(beispielWort.toLowerCase())
    ? ` <span style="font-weight:500;color:var(--muted)">· ${esc(beispielWort)}</span>` : '';
  const testerZeile = tester ? `<div class="fnd-wertung-zeile" data-role="find-wertung-tester" style="align-items:flex-start;padding:12px 0">
<span class="fnd-note">${tester.note == null ? '–' : esc(String(tester.note).replace('.', ','))}</span>
<span class="fnd-wertung-wort"><span>${esc(tx('Getestet'))}${beispiel}</span>${testerText ? `<span class="fnd-zitat">„${esc(testerText)}“</span>` : ''}<small>${esc(tester.note == null ? tx('Zählt nicht zum {score}.', { score: MARKE.score }) : tx('von 5 · zählt nicht zum {score}', { score: MARKE.score }))}</small></span>
</div>` : '';
  const wertung = scoreZeile || testerZeile ? `<div class="fnd-wertung" data-role="find-wertung">${scoreZeile}${testerZeile}</div>` : '';
  const anzeige = eintrag.gesponsert ? `<span class="fnd-anzeige">${anzeigePille()}</span>` : '';
  const inhalt = `<div class="fnd-blatt" data-role="find-detail" data-id="${esc(eintrag.id)}">
<div class="fnd-detail-bild">${bildInhalt(eintrag, 52)}${anzeige}${bildNachweis(eintrag, ctx.ui.findFoto === eintrag.id)}${frageKnopf(eintrag, 128)}</div>
<h2 class="fnd-detail-titel">${esc(eintrag.titel)}</h2>
${eintrag.eintragTyp === 'idee' && eintrag.beschreibung ? `<p class="fnd-hinweis" style="font-size:14px;color:var(--ink-soft)">${esc(eintrag.beschreibung)}</p>` : ''}
<div class="fnd-fakten">${fakten}</div>
${wertung}
${warumBlock(eintrag)}
<div class="fnd-aktionen">
<button type="button" class="fnd-knopf" data-act="find-planen" data-id="${esc(eintrag.id)}" data-art="haupt">${esc(tx('Meet planen'))}</button>
<div class="fnd-aktionen-reihe">
<button type="button" class="fnd-knopf" data-act="find-merken" data-id="${esc(eintrag.id)}" data-role="find-merken" aria-pressed="${gemerkt ? 'true' : 'false'}" data-art="leise">${merkenZeichen(gemerkt)}<span>${esc(gemerkt ? tx('Gemerkt') : tx('Merken'))}</span></button>
<button type="button" class="fnd-knopf" data-act="find-teilen" data-id="${esc(eintrag.id)}" data-role="find-teilen" data-art="leise">${symbol('teilen', 'currentColor', 17)}<span>${esc(tx('Teilen'))}</span></button>
${koordinaten ? `<button type="button" class="fnd-knopf" data-act="find-karte-gross" data-id="${esc(eintrag.id)}" data-art="leise">${symbol('karte', 'currentColor', 17)}<span>${esc(tx('Karte'))}</span></button>` : ''}
</div>
</div>
<button type="button" class="fnd-textknopf" data-act="find-weniger" data-id="${esc(eintrag.id)}" data-role="find-weniger">${esc(tx('Weniger davon'))}</button>
</div>`;
  return sheet(inhalt, { closeAct: 'find-detail-zu', scrollKey: `find-detail-${eintrag.id}` });
}

// --- „?" (ALGORITHMUS §7.1) ---------------------------------------------------------------------
const MELDE_ARTEN = ['falsch', 'geschlossen', 'unpassend', 'bild_problem'];
function meldeArtWort(art) {
  switch (art) {
    case 'falsch': return tx('Falsch (Name, Lage oder Art)');
    case 'geschlossen': return tx('Geschlossen');
    case 'unpassend': return tx('Unpassend (nicht, was es vorgibt)');
    case 'bild_problem': return tx('Problem mit dem Bild');
    default: return '';
  }
}
function meldeGrundText(grund) {
  switch (grund) {
    case 'schon-gemeldet': return tx('Das hast du schon gemeldet — danke.');
    case 'zu-viele': return tx('Heute schon viele Meldungen — morgen wieder.');
    case 'text': return tx('Höchstens {n} Zeichen.', { n: MELDUNG_TEXT_MAX });
    case 'nicht-angemeldet': return tx('Dafür musst du angemeldet sein.');
    case 'eintrag': return tx('Diesen Eintrag gibt es so nicht mehr.');
    default: return tx('Hat nicht geklappt');
  }
}

function frageBlatt(ctx, eintrag) {
  const f = ctx.ui.findFrage;
  const idee = eintrag.eintragTyp === 'idee';
  const schluessel = eintrag.eintragTyp === 'ort' ? ortSeiteSchluessel(eintrag.id) : '';
  const seite = schluessel ? ortSeiteAdresse(`ort.html?ort=${schluessel}`) : '';
  let inhalt;
  if (f.schritt === 'melden') {
    const arten = MELDE_ARTEN.filter((art) => art !== 'bild_problem' || eintrag.bild);
    const wahl = arten.map((art) => `<button type="button" class="fnd-chip" data-act="find-melde-art" data-art-wahl="${art}" data-role="find-melde-art" aria-pressed="${f.art === art ? 'true' : 'false'}" style="justify-content:flex-start;width:100%">${esc(meldeArtWort(art))}</button>`).join('');
    const laenge = [...String(f.text || '')].length;
    inhalt = `<div class="fnd-schritt" data-role="find-melden" data-schritt-m="">
<div style="display:flex;align-items:center;gap:6px;margin:-8px 0 0 -10px">${`<button type="button" class="fnd-zurueck" data-act="find-frage-zurueck" aria-label="${esc(tx('Zurück'))}">${symbol('zurueck', 'var(--ink)', 20)}</button>`}<h2 class="fnd-frage" style="font-size:19px">${esc(tx('Fehler melden'))}</h2></div>
<p class="fnd-hinweis">${esc(eintrag.titel)}</p>
<div class="fnd-chips" style="flex-direction:column;margin-top:14px">${wahl}</div>
<div style="display:flex;flex-direction:column;gap:6px;margin-top:12px">
<textarea id="find-melde-text" class="fnd-feld" rows="3" maxlength="${MELDUNG_TEXT_MAX}" placeholder="${esc(tx('Was stimmt nicht? (freiwillig)'))}" aria-label="${esc(tx('Was stimmt nicht? (freiwillig)'))}"></textarea>
<span class="fnd-zaehler" data-role="find-melde-zaehler">${laenge}/${MELDUNG_TEXT_MAX}</span>
</div>
${f.fehler ? `<p class="fnd-fehler" data-role="find-melde-fehler" role="alert">${esc(meldeGrundText(f.fehler))}</p>` : ''}
<div class="fnd-aktionen"><button type="button" class="fnd-knopf" data-act="find-melden-senden" data-role="find-melden-senden" data-art="haupt"${f.art && !f.sendet ? '' : ' disabled'}>${esc(f.sendet ? tx('Wird gesendet …') : tx('Senden'))}</button></div>
</div>`;
  } else if (f.schritt === 'gesendet') {
    inhalt = `<div class="fnd-schritt" data-role="find-gemeldet" data-schritt-g="" style="display:flex;flex-direction:column;align-items:center;gap:12px;padding:12px 0 4px;text-align:center">
${crewFigur(64, { rolle: 'find-figur' })}
<h2 class="fnd-frage" style="font-size:19px">${esc(tx('Danke, ist gemeldet.'))}</h2>
<p class="fnd-hinweis" style="margin:0">${esc(tx('{name} prüft das automatisch.', { name: MARKE.name }))}</p>
<button type="button" class="fnd-knopf" data-act="find-frage-zu" data-art="haupt" style="width:100%;flex:none">${esc(tx('Fertig'))}</button>
</div>`;
  } else {
    const punkte = [
      idee ? '' : `<button type="button" class="fnd-menue-punkt" data-act="find-melden-start" data-role="find-melden-start">${symbol('info', 'var(--ink-soft)', 19)}<span>${esc(tx('Fehler melden'))}<small>${esc(tx('Falsch, geschlossen, unpassend, Bild'))}</small></span></button>`,
      seite ? `<a class="fnd-menue-punkt" href="${esc(seite)}" target="_blank" rel="noopener" data-role="find-unternehmen">${symbol('haus', 'var(--ink-soft)', 19)}<span>${esc(tx('Ist das dein Unternehmen?'))}<small>${esc(tx('Öffnet die Seite des Orts im Browser'))}</small></span>${symbol('vor', 'var(--muted-light)', 15)}</a>` : '',
      `<button type="button" class="fnd-menue-punkt" data-act="find-frage-warum" data-role="find-frage-warum" aria-expanded="${f.warum ? 'true' : 'false'}">${symbol('funkeln', 'var(--ink-soft)', 19)}<span>${esc(tx('Warum sehe ich das?'))}</span></button>`,
    ].join('');
    const warum = f.warum ? `${warumBlock(eintrag)}${hatZahl(eintrag) ? `<div class="fnd-wertung">${gruendeListe(eintrag)}</div>` : ''}` : '';
    inhalt = `<div data-role="find-frage-menue">
<h2 class="fnd-frage" style="font-size:19px">${esc(eintrag.titel)}</h2>
<div class="fnd-menue">${punkte}</div>
${warum}
</div>`;
  }
  return sheet(`<div class="fnd-blatt" data-role="find-frage-blatt" data-id="${esc(eintrag.id)}">${inhalt}</div>`, { closeAct: 'find-frage-zu', scrollKey: `find-frage-${eintrag.id}-${f.schritt}` });
}

function gemerktBlatt(ctx, liste, unterwegs = 0) {
  const inhalt = `<div class="fnd-blatt" data-role="find-gemerkt">
<h2 class="fnd-frage">${esc(tx('Gemerkt'))}</h2>
<div class="fnd-liste" style="padding:0;margin-top:10px">${liste.map((e) => zeileHtml(e, ctx)).join('')}</div>
${unterwegs ? `<p class="fnd-hinweis" data-role="find-gemerkt-laedt" role="status">${esc(tx('Lädt …'))}</p>` : ''}
</div>`;
  return sheet(inhalt, { closeAct: 'find-gemerkt-zu', scrollKey: 'find-gemerkt' });
}

// --- „Worauf hast du Lust?" — Absicht und Zeitpunkt an Algorithmus 2 --------------------------------
// Zwei Fragen, dann das Ergebnis (drei Seiten). Jede Antwort ändert, was die Datenschicht rechnet —
// keine Frage ohne Wirkung (Regel 9). Oben die Crew-Figur; bevor das Ergebnis kommt, „überlegt" sie kurz
// (und so lange, wie der Server rechnet).
const LUST_SEITEN = 3;
function absichtWort(id) {
  switch (id) {
    case 'essen': return tx('Gut essen');
    case 'trinken': return tx('Was trinken');
    case 'feiern': return tx('Feiern');
    case 'entspannen': return tx('Runterkommen');
    case 'draussen': return tx('Raus in die Natur');
    case 'kultur': return tx('Kultur');
    case 'aktiv': return tx('Auspowern');
    default: return tx('Egal');
  }
}
function wannWort(id) {
  switch (id) {
    case 'jetzt': return tx('Jetzt');
    case 'abend': return tx('Heute Abend');
    case 'wochenende': return tx('Am Wochenende');
    default: return '';
  }
}

function erlebnisKopf(seite) {
  const zurueck = seite > 0 ? `<button type="button" class="fnd-zurueck" data-act="find-zurueck" data-role="find-zurueck" aria-label="${esc(tx('Zurück'))}">${symbol('zurueck', 'var(--ink)', 20)}</button>` : '<span style="width:44px;flex:none"></span>';
  const striche = Array.from({ length: LUST_SEITEN }, (_, index) => `<span data-an="${index <= seite ? '1' : '0'}"></span>`).join('');
  return `<div class="fnd-erlebnis-kopf">${zurueck}<div class="fnd-fortschritt" data-role="find-fortschritt" data-seite="${seite + 1}" role="img" aria-label="${esc(tx('Seite {n} von {m}', { n: seite + 1, m: LUST_SEITEN }))}">${striche}</div><span style="width:44px;flex:none"></span></div>`;
}

function figurPlatz(zustand) {
  return `<div class="fnd-figur-platz">${crewFigur(zustand === 'denkt' ? 72 : 58, { zustand, rolle: 'find-figur' })}</div>`;
}

function finderErgebnisHtml(ctx, stand, finder) {
  const anfrage = auswahl.finderAnfrage(finder, stand.jetzt);
  let roh = null;
  try { roh = ctx.repo.findAuswahlStand(anfrage); } catch { roh = null; }
  const daten = roh?.daten || null;
  if (finder.denkt || (!daten && (roh?.laedt || !roh?.fehler))) {
    return `<div class="fnd-erlebnis fnd-schritt" data-role="find-ergebnis" data-denkt="1" data-schritt-d="">
${erlebnisKopf(LUST_SEITEN - 1)}
<div class="fnd-denkt" role="status">${crewFigur(84, { zustand: 'denkt', rolle: 'find-figur' })}<span>${esc(tx('Ich schaue, was passt …'))}</span></div>
</div>`;
  }
  if (!daten) {
    return `<div class="fnd-erlebnis fnd-schritt" data-role="find-ergebnis" data-schritt-f="">${erlebnisKopf(LUST_SEITEN - 1)}${figurPlatz('wach')}${fehlerHtml('find-finder-nochmal')}</div>`;
  }
  const liste = auswahl.eintraegeSaeubern(daten.eintraege, { jetzt: stand.jetzt, versteckt: stand.versteckt, erlaubt: stand.erlaubt }).slice(0, ERGEBNIS_ZAHL);
  merkeBekannt(liste);
  if (!liste.length) {
    const kat = auswahl.ABSICHT_KATEGORIE[anfrage.absicht];
    const zeigeKat = kat && !(stand.jung && kat === 'clubbar');
    return `<div class="fnd-erlebnis fnd-schritt" data-role="find-ergebnis" data-leer="1" data-schritt-e="">
${erlebnisKopf(LUST_SEITEN - 1)}
${figurPlatz('wach')}
<h2 class="fnd-frage" style="text-align:center">${esc(tx('Dazu passt gerade nichts.'))}</h2>
<p class="fnd-hinweis" style="text-align:center">${esc(tx('„Für dich“ zeigt nur, was zu dir passt. Ohne diesen Filter:'))}</p>
<div class="fnd-erlebnis-fuss">
${zeigeKat ? `<button type="button" class="fnd-knopf" data-act="find-finder-kategorie" data-kategorie="${esc(kat)}" data-role="find-finder-kategorie" data-art="haupt">${esc(tx('Alles in „{kategorie}“ ansehen', { kategorie: kategorieWort(kat) }))}</button>` : ''}
<button type="button" class="fnd-textknopf" data-act="find-von-vorn">${esc(tx('Nochmal von vorn'))}</button>
</div>
</div>`;
  }
  const [erster, ...rest] = liste;
  const gross = `<div style="position:relative">
<button type="button" class="fnd-gross" data-act="find-oeffnen" data-id="${esc(erster.id)}" data-role="find-bester">
<span class="fnd-bild">${bildInhalt(erster, 44)}</span>
<span class="fnd-gross-titel">${esc(erster.titel)}</span>
${unterzeile(erster) ? `<span class="fnd-unter"><span>${esc(unterzeile(erster))}</span></span>` : ''}
${erster.warum ? `<span class="fnd-unter fnd-grund-zeile"><span>${esc(erster.warum)}</span></span>` : ''}
</button>
${scoreAnzeige(erster) ? `<span class="fnd-auf-bild-links" style="top:130px">${scoreAnzeige(erster, { glas: true })}</span>` : ''}
</div>`;
  return `<div class="fnd-erlebnis fnd-schritt" data-role="find-ergebnis" data-absicht="${esc(anfrage.absicht)}" data-schritt-e="">
${erlebnisKopf(LUST_SEITEN - 1)}
<h2 class="fnd-frage" style="margin-top:6px">${esc(tx('Wie wär’s damit?'))}</h2>
${gross}
<div class="fnd-aktionen"><button type="button" class="fnd-knopf" data-act="find-planen" data-id="${esc(erster.id)}" data-art="haupt">${esc(tx('Meet planen'))}</button></div>
${rest.length ? `<h3 class="fnd-kopf" style="padding-left:0">${esc(tx('Passt auch'))}</h3><div class="fnd-liste" style="padding:0">${rest.map((e) => zeileHtml(e, ctx)).join('')}</div>` : ''}
<button type="button" class="fnd-textknopf" data-act="find-von-vorn">${esc(tx('Nochmal von vorn'))}</button>
</div>`;
}

function finderBlatt(ctx, stand) {
  const finder = ctx.ui.finder;
  let inhalt;
  if (finder.schritt === 'ergebnis') inhalt = finderErgebnisHtml(ctx, stand, finder);
  else if (finder.schritt === 'wann') {
    inhalt = `<div class="fnd-erlebnis fnd-schritt" data-role="find-frage" data-frage="wann" data-schritt-1="">
${erlebnisKopf(1)}
${figurPlatz('wach')}
<h2 class="fnd-frage">${esc(tx('Wann?'))}</h2>
<div class="fnd-wahl">${auswahl.WANN.map((id) => `<button type="button" class="fnd-chip" data-act="find-wann" data-wann="${id}" data-role="find-wahl" aria-pressed="${finder.wann === id ? 'true' : 'false'}">${esc(wannWort(id))}</button>`).join('')}</div>
</div>`;
  } else {
    inhalt = `<div class="fnd-erlebnis fnd-schritt" data-role="find-frage" data-frage="lust" data-schritt-0="">
${erlebnisKopf(0)}
${figurPlatz('wach')}
<h2 class="fnd-frage">${esc(tx('Worauf hast du Lust?'))}</h2>
<div class="fnd-wahl">${auswahl.ABSICHTEN.filter((id) => !(stand.jung && (id === 'trinken' || id === 'feiern'))).map((id) => `<button type="button" class="fnd-chip" data-act="find-lust" data-absicht="${id}" data-role="find-wahl" aria-pressed="${finder.absicht === id ? 'true' : 'false'}">${esc(absichtWort(id))}</button>`).join('')}</div>
<div class="fnd-erlebnis-fuss"><button type="button" class="fnd-knopf" data-act="find-lust" data-absicht="egal" data-role="find-weiter" data-art="leise">${esc(tx('Egal'))}</button></div>
</div>`;
  }
  return sheet(`<div class="fnd-blatt" data-role="find-finder-blatt">${inhalt}</div>`, { closeAct: 'find-finder-zu', scrollKey: `find-finder-${finder.schritt}` });
}

// --- Das Wischspiel „Würdest du das machen?" (ZUSATZ §5.3) --------------------------------------------
function wischBlatt(ctx) {
  const w = ctx.ui.findWisch;
  let inhalt;
  if (w.laedt) {
    inhalt = `<div class="fnd-denkt" role="status">${crewFigur(72, { zustand: 'denkt', rolle: 'find-figur' })}<span>${esc(tx('Karten werden gemischt …'))}</span></div>`;
  } else if (w.fehler) {
    inhalt = `${figurPlatz('wach')}${fehlerHtml('find-wisch-start')}`;
  } else if (w.fertig) {
    inhalt = `<div class="fnd-schritt" data-role="find-wisch-fertig" data-schritt-w="" style="display:flex;flex-direction:column;align-items:center;gap:12px;padding:30px 0 6px;text-align:center">
${crewFigur(76, { rolle: 'find-figur' })}
<h2 class="fnd-frage">${esc(tx('Danke!'))}</h2>
<p class="fnd-hinweis" style="margin:0;font-size:14px">${esc(tx('„Für dich“ ist jetzt nach deinen Antworten sortiert.'))}</p>
<button type="button" class="fnd-knopf" data-act="find-wisch-zu" data-role="find-wisch-ansehen" data-art="haupt" style="width:100%;flex:none;margin-top:12px">${esc(tx('Ansehen'))}</button>
</div>`;
  } else {
    const karten = w.karten || [];
    const karte = karten[w.i];
    const naechste = karten[w.i + 1];
    const kachel = (k, hinten) => `<div class="fnd-wisch-kachel" data-role="${hinten ? 'find-wisch-hinten' : 'find-wisch-kachel'}" data-karte="${esc(k.id)}"${hinten ? ' data-hinten="1" aria-hidden="true"' : ' data-hdrag="wisch"'}>
<span class="fnd-wisch-urteil" data-seite="ja">${esc(tx('Ja'))}</span><span class="fnd-wisch-urteil" data-seite="nein">${esc(tx('Nein'))}</span>
<span class="fnd-wisch-kachel-zeichen">${activityIconSvg({ iconKey: iconKeyForText(k.label) || 'funkeln' }, 'var(--green-dark)', 44)}</span>
<span class="fnd-wisch-kachel-wort">${esc(k.label)}</span>
</div>`;
    const striche = karten.map((_, index) => `<span data-an="${index <= w.i ? '1' : '0'}" style="width:${Math.max(8, Math.floor(220 / Math.max(1, karten.length)) - 6)}px"></span>`).join('');
    inhalt = `<div class="fnd-wisch" data-role="find-wisch-spiel" data-nr="${w.i + 1}" data-von="${karten.length}">
<div class="fnd-erlebnis-kopf" style="justify-content:center"><div class="fnd-fortschritt" role="img" aria-label="${esc(tx('Karte {n} von {m}', { n: w.i + 1, m: karten.length }))}">${striche}</div></div>
<h2 class="fnd-frage" style="text-align:center;margin-top:10px">${esc(tx('Würdest du das machen?'))}</h2>
<p class="fnd-hinweis" style="text-align:center">${esc(tx('Nach rechts wischen heißt ja, nach links nein.'))}</p>
<div class="fnd-wisch-stapel" data-role="find-wisch-stapel">${naechste ? kachel(naechste, true) : ''}${karte ? kachel(karte, false) : ''}</div>
<div class="fnd-wisch-knoepfe">
<button type="button" class="fnd-knopf" data-act="find-wisch-antwort" data-antwort="nein" data-role="find-wisch-nein">${symbol('kreuz', 'currentColor', 16)}${esc(tx('Nein'))}</button>
<button type="button" class="fnd-knopf" data-act="find-wisch-antwort" data-antwort="ja" data-role="find-wisch-ja" data-art="haupt">${symbol('haken', 'currentColor', 16)}${esc(tx('Ja'))}</button>
</div>
</div>`;
  }
  return sheet(`<div class="fnd-blatt" data-role="find-wisch-blatt">${inhalt}</div>`, { closeAct: 'find-wisch-zu', scrollKey: 'find-wisch' });
}

// =============================================================================================
// Die eigene Karte (vorhandene Bausteine aus ui/map.js) — zeigt „Für dich"
// =============================================================================================
function kartenRumpf(stand) {
  const mitOrt = auswahl.kartenOrte(stand.fuerDich.alle, stand.jetzt).length;
  const leer = mitOrt ? '' : `<div data-role="find-karte-hinweis" style="position:absolute;left:0;right:0;top:34px;z-index:5;display:flex;justify-content:center;padding:0 16px;pointer-events:none"><span data-ueber-karte style="background:var(--surface);border-radius:999px;padding:8px 13px;box-shadow:0 4px 14px var(--shadow-14);font:600 12.5px/1 ${FONT};color:var(--ink-soft);white-space:nowrap">${esc(tx('Nichts auf der Karte'))}</span></div>`;
  const streifen = (seite) => `<div data-role="find-karte-rand" data-seite="${seite}" aria-hidden="true" style="position:absolute;${seite}:0;top:0;bottom:${seite === 'right' ? RAND_UNTEN_FREI : 0}px;width:${RAND_ZONE}px;z-index:4"></div>`;
  return `<div data-map-viewport="find" style="height:100%;position:relative;background:var(--field);overflow:hidden">
<div data-fremd="1" data-role="find-karte-flaeche" style="position:absolute;inset:0;z-index:0"></div>
${streifen('left')}${streifen('right')}
${leer}
</div>`;
}

function kartenMarken(stand) {
  return auswahl.kartenOrte(stand.fuerDich.alle, stand.jetzt).map((ort, rang) => ({
    key: `find:${ort.key}`,
    lat: ort.lat,
    lon: ort.lon,
    rang,
    eintraege: ort.eintraege.map((eintrag) => {
      const unter = [eintrag.gesponsert ? tx('Anzeige') : '', wannKurz(eintrag), hatZahl(eintrag) ? `${MARKE.score} ${Math.round(eintrag.score)}` : ''].filter(Boolean).join(' · ');
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

function randAnpassen(flaeche, karte) {
  const streifen = flaeche?.parentElement?.querySelector('[data-role="find-karte-rand"][data-seite="right"]');
  if (!streifen || !karte) return;
  const hoehe = flaeche.clientHeight || 0;
  const oben = (bedienFlaechen(karte) || []).filter((f) => f && f.u > 0).reduce((wert, f) => Math.min(wert, f.o), hoehe);
  const rest = Math.max(0, Math.round(oben - 10));
  streifen.style.bottom = rest > 90 ? `${Math.max(0, hoehe - rest)}px` : `${RAND_UNTEN_FREI}px`;
}

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
// Ein Signal an die Datenschicht (ZUSATZ §5.2). Nie aus einer Vorschau, nie ohne Kennung.
function signal(ctx, art, eintragId, wert = null) {
  if (ctx.preview || !eintragId || typeof ctx.repo.signalMelden !== 'function') return Promise.resolve({ ok: false });
  return Promise.resolve(ctx.repo.signalMelden({ art, eintragId, ...(wert != null ? { wert } : {}) }))
    .catch(() => ({ ok: false, grund: 'netz' }));
}

// Wer etwas mit einem Eintrag tut, hat ihn beachtet — „ignoriert" wird dann nie gemeldet.
function beachtet(id) {
  if (!id) return;
  schreiben(SPEICHER_ANZEIGEN, auswahl.interaktionMerken(lesen(SPEICHER_ANZEIGEN, {}), id));
}

function angezeigtZaehlen(ctx, id) {
  const { stand, melden } = auswahl.anzeigeZaehlen(lesen(SPEICHER_ANZEIGEN, {}), id, Date.now());
  schreiben(SPEICHER_ANZEIGEN, stand);
  if (melden) signal(ctx, 'ignoriert', id);
}

// Das Blatt eines Eintrags schließt: War es lange genug offen, war es „angesehen" (mit Sekunden).
function detailSchliessen(ctx) {
  const { ui } = ctx;
  const id = ui.findDetail;
  const seit = Number(ui.findDetailSeit) || 0;
  ui.findDetail = null;
  ui.findDetailSeit = 0;
  ui.findFoto = null;
  if (!id || !seit) return;
  const dauer = Date.now() - seit;
  if (dauer >= ANGESEHEN_AB_MS) signal(ctx, 'angesehen', id, Math.min(3600, Math.round(dauer / 1000)));
}

// „Weniger davon": sofort weg (an seiner Stelle „Rückgängig"), das Signal erst, wenn Rückgängig vorbei ist.
let wenigerUhr = null;
function wenigerFestmachen(ctx) {
  clearTimeout(wenigerUhr);
  wenigerUhr = null;
  const offen = ctx.ui.findWeniger;
  if (!offen) return;
  ctx.ui.findWeniger = null;
  ctx.ui.findVersteckt = ctx.ui.findVersteckt instanceof Set ? ctx.ui.findVersteckt : new Set();
  ctx.ui.findVersteckt.add(offen.id);
  signal(ctx, 'weniger', offen.id).then((antwort) => {
    if (antwort?.ok) return;
    ctx.ui.findVersteckt.delete(offen.id);
    ctx.toast?.(tx('Hat nicht geklappt'));
    ctx.render();
  });
}

function weniger(ctx, id) {
  const eintrag = eintragVon(ctx, id);
  if (!eintrag) return;
  if (ctx.ui.findWeniger) wenigerFestmachen(ctx);
  beachtet(id);
  ctx.ui.findWeniger = { id, titel: eintrag.titel };
  rueckmeldung('tipp');
  wenigerUhr = setTimeout(() => { wenigerFestmachen(ctx); ctx.render(); }, WENIGER_MS);
}

function wenigerZurueck(ctx) {
  clearTimeout(wenigerUhr);
  wenigerUhr = null;
  ctx.ui.findWeniger = null;
  rueckmeldung('zurueck');
}

// „Meet planen": ein Entwurf mit Idee, Ort (samt eintragId — daraus entstehen die Meet-Signale) und bei
// einem Termin der Zeit. Dieselbe Form wie die Vorschläge in „Was machen?" (auswahl-weg.js).
function meetPlanen(ctx, eintrag) {
  const { repo, nav, ui } = ctx;
  const entwurf = typeof repo.createDraft === 'function' ? repo.createDraft({}) : null;
  if (!entwurf?.id || typeof repo.updateDraft !== 'function') {
    rueckmeldung('abgelehnt');
    ctx.toast?.(tx('Gerade geht das nicht'));
    return;
  }
  const vorschlag = alsVorschlag(eintrag);
  const ort = vorschlag.place ? { ...vorschlag.place } : null;
  const patch = {
    idea: {
      title: eintrag.titel,
      icon: null,
      iconKey: zeichenSchluessel(eintrag),
      category: vorschlag.category,
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
  const von = auswahl.zeitpunkt(eintrag.wann?.von);
  if (von != null) patch.when = { date: toISODate(new Date(von)), time: zeitText(von), open: false };
  repo.updateDraft(entwurf.id, patch);
  beachtet(eintrag.id);
  rueckmeldung('tipp');
  detailSchliessen(ctx);
  ui.finder = null;
  ui.findGemerkt = false;
  nav.go('newMeet.discover', { draftId: entwurf.id });
}

function merken(ctx, id) {
  const settings = ctx.repo.getSettings?.() || {};
  const vorher = Array.isArray(settings.gemerktIds) ? settings.gemerktIds : [];
  const nachher = auswahl.merkenUmschalten(vorher, id);
  if (typeof ctx.repo.updateSettings !== 'function') { ctx.toast?.(tx('Gerade geht das nicht')); return; }
  ctx.repo.updateSettings({ gemerktIds: nachher });
  beachtet(id);
  // Das Signal nur beim Merken — ein Zurücknehmen ist kein Lernen gegen den Eintrag.
  if (nachher.includes(id)) signal(ctx, 'merken', id);
  rueckmeldung(nachher.includes(id) ? 'erfolg' : 'tipp');
  ctx.render();
}

function karteGross(eintrag) {
  if (!auswahl.hatKoordinaten(eintrag)) return;
  karteGrossOeffnen({
    titel: eintrag.titel,
    adresse: eintrag.ort.adresse || eintrag.ort.name || '',
    unter: wannKurz(eintrag),
    lat: Number(eintrag.ort.lat),
    lon: Number(eintrag.ort.lon),
    zeichen: zeichen(eintrag, 'currentColor', 20),
  });
}

// --- Suche -----------------------------------------------------------------------------------------
let sucheNummer = 0;
let sucheUhr = null;
function sucheStarten(ctx, text) {
  clearTimeout(sucheUhr);
  const sauber = String(text || '').trim();
  const nummer = (sucheNummer += 1);
  if (sauber.length < 2) return;
  sucheUhr = setTimeout(() => {
    const suche = ctx.ui.findSuche;
    if (!suche || nummer !== sucheNummer) return;
    suche.laedt = true;
    suche.fehler = null;
    ctx.render();
    Promise.resolve(ctx.repo.findSuchen({ text: sauber }))
      .then((liste) => {
        if (nummer !== sucheNummer || ctx.ui.findSuche !== suche) return;
        Object.assign(suche, { liste: Array.isArray(liste) ? liste : [], laedt: false, fehler: null, fuer: sauber });
      })
      .catch(() => {
        if (nummer !== sucheNummer || ctx.ui.findSuche !== suche) return;
        Object.assign(suche, { laedt: false, fehler: true });
      })
      .finally(() => { if (nummer === sucheNummer) ctx.render(); });
  }, 280);
}

// --- Kategorien: je Art eine Anfrage (findSuchen kennt EINE crewArt), zusammen nach Score, dann Nähe --
function kategorieLaden(ctx, id) {
  const kat = auswahl.kategorie(id);
  if (!kat) return;
  const stand = { id, laedt: true, fehler: null, antworten: null };
  ctx.ui.findKat = stand;
  ctx.render();
  Promise.all(kat.arten.map((crewArt) => Promise.resolve(ctx.repo.findSuchen({ crewArt }))))
    .then((antworten) => { if (ctx.ui.findKat === stand) Object.assign(stand, { antworten, laedt: false }); })
    .catch(() => { if (ctx.ui.findKat === stand) Object.assign(stand, { laedt: false, fehler: true }); })
    .finally(() => { if (ctx.ui.findKat === stand) ctx.render(); });
}

// --- Wischspiel -------------------------------------------------------------------------------------
function wischStarten(ctx) {
  if (ctx.preview) return;
  const w = { karten: null, i: 0, laedt: true, fehler: false, fertig: false, antworten: 0 };
  ctx.ui.findWisch = w;
  ctx.render();
  Promise.resolve(ctx.repo.getWischKarten())
    .then((karten) => { if (ctx.ui.findWisch === w) Object.assign(w, { karten: Array.isArray(karten) ? karten : [], laedt: false }); })
    .catch(() => { if (ctx.ui.findWisch === w) Object.assign(w, { laedt: false, fehler: true }); })
    .finally(() => { if (ctx.ui.findWisch === w) { if (!w.fehler && !w.karten?.length) w.fertig = true; ctx.render(); } });
}

function wischAntwort(ctx, antwort) {
  const w = ctx.ui.findWisch;
  const karte = w?.karten?.[w.i];
  if (!karte || w.fertig) return;
  signal(ctx, antwort === 'ja' ? 'wisch_ja' : 'wisch_nein', `karte:${karte.id}`);
  rueckmeldung(antwort === 'ja' ? 'auswahl' : 'tipp');
  w.i += 1;
  w.antworten += 1;
  if (w.i >= w.karten.length) {
    w.fertig = true;
    schreiben(SPEICHER_WISCH, Date.now());
    gelerntLaden(ctx);
  }
  ctx.render();
}

function wischGesteBinden(root, ctx) {
  const kachel = root.querySelector('[data-role="find-wisch-kachel"]');
  if (!kachel) return;
  const setzen = (dx, weich = false) => {
    kachel.style.transition = weich ? 'transform .22s ease-out' : 'none';
    kachel.style.transform = dx ? `translateX(${dx}px) rotate(${dx / 18}deg)` : '';
    kachel.querySelector('[data-seite="ja"]')?.style.setProperty('opacity', String(Math.max(0, Math.min(1, dx / 90))));
    kachel.querySelector('[data-seite="nein"]')?.style.setProperty('opacity', String(Math.max(0, Math.min(1, -dx / 90))));
  };
  waagrechtZiehen(kachel, 'find-wisch', {
    beginnt: () => ({ karte: kachel.dataset.karte }),
    bewegt: (_, dx) => setzen(dx),
    endet: (daten, dx, schwung) => {
      const urteil = auswahl.wischUrteil(dx, schwung);
      if (!urteil || ctx.ui.findWisch?.karten?.[ctx.ui.findWisch.i]?.id !== daten.karte) { setzen(0, true); return; }
      setzen(urteil === 'ja' ? 480 : -480, true);
      setTimeout(() => wischAntwort(ctx, urteil), 170);
    },
    abbruch: () => setzen(0, true),
  });
}

// --- Beim Zeichnen: Ankunft über einen Link, das Wischspiel aus dem Profil -------------------------
// Läuft NACH der Bindung (bindFindHome stellt es als Mikroaufgabe an): zeigen() und wischStarten() zeichnen neu,
// und ein Zeichnen mitten in der Bindung ließ Horcher fallen (app.js › bindeEinmalig ist nicht wiedereintrittsfest;
// gemessen: das Suchfeld nach der Ankunft über einen Link ohne „input"-Horcher).
function routeVerarbeiten(ctx, stand) {
  const { ui, params } = ctx;
  if (ctx.preview || !params || ui.findRouteGesehen === params) return;
  if (params.wisch) {
    ui.findRouteGesehen = params;
    wischStarten(ctx);
    return;
  }
  const id = String(params.eintragId || '');
  if (!id) return;
  const zeigen = (eintrag) => {
    ui.findDetail = eintrag.id;
    ui.findDetailSeit = Date.now();
    ui.finder = null;
    ui.findGemerkt = false;
    ctx.render();
  };
  const s = eintragStand(ctx, id);
  // Am Server beim ersten Mal unterwegs → beim nächsten Zeichnen (notify) wieder fragen.
  if (!s.eintrag && s.laedt) return;
  ui.findRouteGesehen = params;
  if (s.eintrag && (!stand.erlaubt || stand.erlaubt(s.eintrag))) { zeigen(s.eintrag); return; }
  ctx.toast?.(s.fehler ? tx('Hat nicht geklappt') : tx('Diesen Tipp gibt es hier gerade nicht'));
}

// =============================================================================================
// Die Seite
// =============================================================================================
function kopf(gemerktZahl) {
  const knopf = gemerktZahl
    ? `<button type="button" class="fnd-rund" data-act="find-gemerkt" data-role="find-gemerkt-knopf" aria-label="${esc(`${tx('Gemerkt')} (${gemerktZahl})`)}"><span style="pointer-events:none;display:flex;color:var(--ink)">${merkenZeichen(true)}</span></button>`
    : '';
  return `${tabHeader(`<span style="font-family:${TITEL_FONT};font-size:22px;font-weight:650">Find</span>`, knopf)}${STIL}`;
}

function schwebendHtml(ctx) {
  const karteAn = ctx.ui.findAnsicht === 'karte';
  return `<div class="fnd-schweben" data-role="find-schwebend">
<button type="button" class="fnd-schwebe-rund" data-act="find-ansicht" data-role="find-ansicht" data-ueber-karte aria-label="${esc(karteAn ? tx('Liste') : tx('Karte'))}"><span style="pointer-events:none;display:flex">${karteAn ? listIcon('var(--ink)', 19) : mapIcon('var(--ink)', 19)}</span></button>
<button type="button" class="fnd-lust" data-act="find-lust-start" data-role="find-lust-knopf" data-ueber-karte><span class="fnd-lust-figur">${crewFigur(30, { rolle: 'find-figur-knopf' })}</span><span>${esc(tx('Worauf hast du Lust?'))}</span></button>
<span class="fnd-schwebe-platz" aria-hidden="true"></span>
</div>`;
}

function overlaysHtml(ctx, stand, gemerkt, unterwegs = 0) {
  const { ui } = ctx;
  const teile = [];
  if (ui.finder) teile.push(finderBlatt(ctx, stand));
  if (ui.findGemerkt && (gemerkt.length || unterwegs)) teile.push(gemerktBlatt(ctx, gemerkt, unterwegs));
  const detail = ui.findDetail ? eintragVon(ctx, ui.findDetail) : null;
  if (detail) teile.push(detailBlatt(ctx, stand, detail));
  const gruende = ui.findGruende ? eintragVon(ctx, ui.findGruende) : null;
  if (gruende) teile.push(gruendeBlatt(gruende));
  const frage = ui.findFrage ? eintragVon(ctx, ui.findFrage.id) : null;
  if (frage) teile.push(frageBlatt(ctx, frage));
  if (ui.findWisch) teile.push(wischBlatt(ctx));
  return teile.join('');
}

function renderFindHome(ctx) {
  const stand = findStand(ctx);
  const gemerkt = auswahl.gemerktListe((id) => eintragVon(ctx, id), stand.gemerktIds, stand.jetzt).filter((e) => !stand.erlaubt || stand.erlaubt(e));
  const gemerktUnterwegs = stand.gemerktIds.filter((id) => !bekanntMap().has(id) && eintragStand(ctx, id).laedt).length;
  const karte = ctx.ui.findAnsicht === 'karte' && !ctx.preview;
  const html = screenScaffold({
    page: true,
    header: kopf(gemerkt.length + gemerktUnterwegs),
    body: karte ? kartenRumpf(stand) : seiteHtml(ctx, stand),
    bottom: schwebendHtml(ctx),
    scrollKey: karte ? 'find-karte' : 'find',
    ...(karte
      ? { bottomInset: 0, headerFade: false, bottomFadeHeight: 0 }
      : { bottomInset: SCHWEBE_HOEHE + 4, bottomFadeHeight: 30, untenSchwebend: true }),
    overlays: overlaysHtml(ctx, stand, gemerkt, gemerktUnterwegs),
  });
  return { html, bind: bindFindHome };
}

// Nach der kurzen „Überlegung" der Figur kommt das Ergebnis.
function denkenBeenden(ctx) {
  const finder = ctx.ui.finder;
  if (finder?.schritt !== 'ergebnis' || !finder.denkt || finder.denkUhr) return;
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

// Sichtbarkeit zählen („ignoriert"): nur „Für dich", nur was wirklich im Bild war.
let beobachter = null;
function anzeigenBeobachten(root, ctx) {
  beobachter?.disconnect();
  beobachter = null;
  if (ctx.preview || typeof globalThis.IntersectionObserver !== 'function') return;
  const ziele = [...root.querySelectorAll('[data-role="find-fuer-dich"] [data-zaehlen="1"][data-id]')];
  if (!ziele.length) return;
  const gezaehlt = new Set();
  beobachter = new IntersectionObserver((eintraege) => {
    for (const e of eintraege) {
      const id = e.target.dataset.id;
      if (!e.isIntersecting || !id || gezaehlt.has(id)) continue;
      gezaehlt.add(id);
      angezeigtZaehlen(ctx, id);
    }
  }, { threshold: 0.6 });
  for (const ziel of ziele) beobachter.observe(ziel);
}

// Ein Finger liegt auf der Seite: vom Aufsetzen in „Für dich" bis zum Loslassen IRGENDWO (das Ende kann auf
// einem Knoten landen, den das Zeichnen inzwischen ersetzt hat — darum hört das Fenster zu, nicht die Seite).
let fingerCtx = null;
function beruehrungMerken(ctx) {
  fingerCtx = ctx;
  if (globalThis.__findFingerHorcher || typeof globalThis.addEventListener !== 'function') return;
  globalThis.__findFingerHorcher = true;
  globalThis.addEventListener('touchstart', (ereignis) => {
    beruehrt = Boolean(ereignis.target?.closest?.('[data-role="find-seite"]'));
  }, { passive: true, capture: true });
  const aus = () => {
    beruehrt = false;
    if (tauschOffen) { tauschOffen = false; setTimeout(() => fingerCtx?.render(), 0); }
  };
  globalThis.addEventListener('touchend', aus, { passive: true, capture: true });
  globalThis.addEventListener('touchcancel', aus, { passive: true, capture: true });
}

function sucheBinden(root, ctx) {
  const feld = root.querySelector('#find-suche-feld');
  if (!feld) return;
  const text = String(ctx.ui.findSuche?.text || '');
  if (document.activeElement !== feld && feld.value !== text) feld.value = text;
  if (feld.__findGebunden) return;
  feld.__findGebunden = true;
  feld.addEventListener('input', () => {
    const wert = feld.value.slice(0, 80);
    if (!wert.trim()) { ctx.ui.findSuche = null; sucheNummer += 1; ctx.render(); return; }
    const vorher = ctx.ui.findSuche;
    ctx.ui.findSuche = { ...(vorher || {}), text: wert, liste: vorher?.fuer === wert.trim() ? vorher.liste : null };
    if (wert.trim().length >= 2) ctx.ui.findSuche.laedt = true;
    ctx.ui.findKat = null;
    ctx.render();
    sucheStarten(ctx, wert);
  });
  feld.addEventListener('keydown', (ereignis) => { if (ereignis.key === 'Enter') feld.blur(); });
}

function meldeFeldBinden(root, ctx) {
  const feld = root.querySelector('#find-melde-text');
  const f = ctx.ui.findFrage;
  if (!feld || !f) return;
  if (document.activeElement !== feld && feld.value !== String(f.text || '')) feld.value = String(f.text || '');
  if (feld.__findGebunden) return;
  feld.__findGebunden = true;
  feld.addEventListener('input', () => {
    const aktuell = ctx.ui.findFrage;
    if (!aktuell) return;
    aktuell.text = feld.value;
    aktuell.fehler = null;
    const zaehler = root.querySelector('[data-role="find-melde-zaehler"]');
    if (zaehler) zaehler.textContent = `${[...feld.value].length}/${MELDUNG_TEXT_MAX}`;
  });
}

function bindFindHome(root, ctx) {
  const { ui } = ctx;
  const stand = findStand(ctx);
  if (ui.findAnsicht === 'karte') karteEinrichten(root, ctx, stand);
  // Nie synchron aus der Bindung heraus neu zeichnen (siehe routeVerarbeiten): erst binden, dann ankommen.
  queueMicrotask(() => routeVerarbeiten(ctx, stand));
  denkenBeenden(ctx);
  sucheBinden(root, ctx);
  meldeFeldBinden(root, ctx);
  wischGesteBinden(root, ctx);
  anzeigenBeobachten(root, ctx);
  beruehrungMerken(ctx);

  const oeffnen = (id) => {
    const eintrag = eintragVon(ctx, id);
    if (!eintrag) return;
    if (ui.findDetail && ui.findDetail !== eintrag.id) detailSchliessen(ctx);
    ui.findDetail = eintrag.id;
    ui.findDetailSeit = Date.now();
    ui.findGruende = null;
    ui.findFrage = null;
    beachtet(eintrag.id);
    rueckmeldung('tipp');
    ctx.render();
  };

  bindActions(root, {
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
    'find-nochmal': () => {
      Promise.resolve(ctx.repo.getFindAuswahl?.(fuerDichOptionen(ui))).catch(() => {}).finally(() => ctx.render());
      rueckmeldung('tipp');
      ctx.render();
    },
    'find-radius': (daten) => {
      const km = Number(daten.km);
      if (!Number.isFinite(km)) return;
      ui.findRadius = km;
      rueckmeldung('tipp');
      ctx.render();
    },
    'find-radius-zurueck': () => { ui.findRadius = null; rueckmeldung('tipp'); ctx.render(); },
    // --- Suche und Kategorien ---
    'find-suche-leeren': () => {
      ui.findSuche = null;
      sucheNummer += 1;
      const feld = root.querySelector('#find-suche-feld');
      if (feld) feld.value = '';
      rueckmeldung('tipp');
      ctx.render();
    },
    'find-suche-nochmal': () => { if (ui.findSuche) { ui.findSuche.fehler = null; sucheStarten(ctx, ui.findSuche.text); } },
    'find-kategorie': (daten) => {
      const id = String(daten.kategorie || '');
      rueckmeldung('auswahl');
      if (ui.findKat?.id === id) { ui.findKat = null; ctx.render(); return; }
      ui.findSuche = null;
      kategorieLaden(ctx, id);
    },
    'find-kategorie-nochmal': () => { if (ui.findKat) kategorieLaden(ctx, ui.findKat.id); },
    'find-kategorie-zu': () => { ui.findKat = null; rueckmeldung('tipp'); ctx.render(); },
    // --- Einträge ---
    'find-oeffnen': (daten) => oeffnen(daten.id),
    'find-detail-zu': () => { detailSchliessen(ctx); ctx.render(); },
    'find-foto': (daten) => { ui.findFoto = ui.findFoto === daten.id ? null : String(daten.id || ''); ctx.render(); },
    'find-gruende': (daten) => {
      if (!eintragVon(ctx, daten.id)) return;
      ui.findGruende = String(daten.id);
      rueckmeldung('tipp');
      ctx.render();
    },
    'find-gruende-zu': () => { ui.findGruende = null; ctx.render(); },
    'find-merken': (daten) => merken(ctx, String(daten.id || '')),
    // V1-Kern §6: den Tipp als Link teilen. Kein await davor — Safari gibt das Teilen-Blatt nur her,
    // solange die Berührung frisch ist (ui/teilen.js).
    'find-teilen': (daten) => {
      const id = String(daten.id || '');
      if (!id) return;
      beachtet(id);
      signal(ctx, 'teilen', id);
      linkTeilen({ repo: ctx.repo, art: 'tipp', id, toast: ctx.toast });
    },
    'find-planen': (daten) => {
      const eintrag = eintragVon(ctx, daten.id);
      if (eintrag) meetPlanen(ctx, eintrag);
    },
    'find-karte-gross': (daten) => {
      const eintrag = eintragVon(ctx, daten.id);
      if (eintrag) karteGross(eintrag);
    },
    'find-weniger': (daten) => {
      detailSchliessen(ctx);
      weniger(ctx, String(daten.id || ''));
      ctx.render();
    },
    'find-weniger-zurueck': () => { wenigerZurueck(ctx); ctx.render(); },
    'find-gelernt': () => { detailSchliessen(ctx); ui.findFrage = null; ctx.nav.go('profile.gelernt'); },
    // --- „?" ---
    'find-frage': (daten) => {
      if (!eintragVon(ctx, daten.id)) return;
      ui.findFrage = { id: String(daten.id), schritt: 'menue', warum: false, art: null, text: '', fehler: null, sendet: false };
      beachtet(String(daten.id));
      rueckmeldung('tipp');
      ctx.render();
    },
    'find-frage-zu': () => { ui.findFrage = null; ctx.render(); },
    'find-frage-warum': () => { if (ui.findFrage) { ui.findFrage.warum = !ui.findFrage.warum; rueckmeldung('tipp'); ctx.render(); } },
    'find-melden-start': () => { if (ui.findFrage) { ui.findFrage.schritt = 'melden'; rueckmeldung('tipp'); ctx.render(); } },
    'find-frage-zurueck': () => { if (ui.findFrage) { ui.findFrage.schritt = 'menue'; ui.findFrage.fehler = null; rueckmeldung('zurueck'); ctx.render(); } },
    'find-melde-art': (daten) => {
      if (!ui.findFrage) return;
      ui.findFrage.art = MELDE_ARTEN.includes(daten.artWahl) ? daten.artWahl : null;
      ui.findFrage.fehler = null;
      rueckmeldung('auswahl');
      ctx.render();
    },
    'find-melden-senden': () => {
      const f = ui.findFrage;
      if (!f?.art || f.sendet) return;
      f.sendet = true;
      f.fehler = null;
      ctx.render();
      Promise.resolve(ctx.repo.meldungSenden({ eintragId: f.id, art: f.art, text: String(f.text || '').trim() }))
        .catch(() => ({ ok: false, grund: 'netz' }))
        .then((antwort) => {
          if (ui.findFrage !== f) return;
          f.sendet = false;
          if (antwort?.ok) { f.schritt = 'gesendet'; rueckmeldung('erfolg'); } else { f.fehler = antwort?.grund || 'netz'; rueckmeldung('abgelehnt'); }
          ctx.render();
        });
    },
    // --- Gemerkt ---
    'find-gemerkt': () => { ui.findGemerkt = true; rueckmeldung('tipp'); ctx.render(); },
    'find-gemerkt-zu': () => { ui.findGemerkt = false; ctx.render(); },
    // --- Finder ---
    'find-lust-start': () => { ui.finder = { schritt: 'lust', absicht: null, wann: null, denkt: false }; rueckmeldung('tipp'); ctx.render(); },
    'find-lust': (daten) => {
      if (!ui.finder) return;
      ui.finder.absicht = String(daten.absicht || 'egal');
      ui.finder.schritt = 'wann';
      rueckmeldung('auswahl');
      ctx.render();
    },
    'find-wann': (daten) => {
      if (!ui.finder) return;
      ui.finder.wann = auswahl.WANN.includes(daten.wann) ? daten.wann : 'jetzt';
      ui.finder.schritt = 'ergebnis';
      ui.finder.denkt = true;
      rueckmeldung('auswahl');
      ctx.render();
    },
    'find-zurueck': () => {
      const finder = ui.finder;
      if (!finder) return;
      finder.denkt = false;
      finder.schritt = finder.schritt === 'ergebnis' ? 'wann' : 'lust';
      rueckmeldung('zurueck');
      ctx.render();
    },
    'find-von-vorn': () => { ui.finder = { schritt: 'lust', absicht: null, wann: null, denkt: false }; rueckmeldung('tipp'); ctx.render(); },
    'find-finder-nochmal': () => {
      if (!ui.finder) return;
      Promise.resolve(ctx.repo.getFindAuswahl?.(auswahl.finderAnfrage(ui.finder, Date.now()))).catch(() => {}).finally(() => ctx.render());
    },
    'find-finder-kategorie': (daten) => {
      ui.finder = null;
      ui.findSuche = null;
      kategorieLaden(ctx, String(daten.kategorie || ''));
    },
    'find-finder-zu': () => { ui.finder = null; ctx.render(); },
    // --- Wischspiel ---
    'find-wisch-start': () => wischStarten(ctx),
    'find-wisch-spaeter': () => { schreiben(SPEICHER_WISCH, Date.now()); rueckmeldung('tipp'); ctx.render(); },
    'find-wisch-antwort': (daten) => wischAntwort(ctx, daten.antwort === 'ja' ? 'ja' : 'nein'),
    'find-wisch-zu': () => {
      const w = ui.findWisch;
      // Mittendrin geschlossen: Was beantwortet ist, zählt; gefragt wird trotzdem erst wieder später.
      if (w && w.antworten > 0 && !w.fertig) { schreiben(SPEICHER_WISCH, Date.now()); gelerntLaden(ctx); }
      ui.findWisch = null;
      ctx.render();
    },
  });
}

export const findScreens = {
  'find.home': renderFindHome,
};
