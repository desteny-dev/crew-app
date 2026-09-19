// Bereich Find (Route 'find.home') — der fünfte Haupt-Tab, in der Mitte der Fußleiste.
//
// Runde 8, R8-66 / R8-50 (Jonathan): „Dashboard — ‚Dieses Wochenende' (Besonderes zum Ausgehen und
// unter Leute kommen, keine wöchentlichen Standard-Clubs), beste Restaurants, beste Erlebnisse,
// ‚Für dich'. Bewertung: Algorithmus-Score + getrennte Tester-Bewertung. Finder im Akinator-Stil.
// Merken, ‚Mit Crew machen', eigene Kartenansicht, Anzeigen klar gekennzeichnet, das Label nie
// käuflich. Admin darf Einträge anlegen."
//
// Aufbau, von oben:
//   · Kopf: „Find" · rechts Karte/Liste (und für Admins „+").
//   · Ganz oben, ohne Kasten, der Finder: „Worauf hast du Lust?" mit den Gefühlen, zu denen es
//     etwas gibt. Ein Tipp IST die erste Antwort — das Blatt öffnet gleich mit der zweiten Frage
//     (eine Handlung weniger); „Zurück" führt zur ersten, dort sind mehrere möglich.
//   · Reihen: Dieses Wochenende · Für dich · Beste Restaurants · Beste Erlebnisse · Demnächst ·
//     Gemerkt. Eine leere Reihe steht nicht da. Was wo steht, entscheidet data/find-auswahl.js.
//   · Ein Tipp auf eine Karte öffnet das Blatt: Score, getrennt davon die Tester-Bewertung,
//     „Meet planen", „Merken", „Karte".
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
  dirtyGuard, discardSheet, discardActions,
} from '../ui/components.js';
import { symbol } from '../ui/symbole.js';
import { activityIconSvg, iconKeyForText } from '../ui/activity-icons.js';
import { plus, mapIcon, listIcon } from '../ui/icons.js';
import { karteGrossOeffnen } from '../ui/karte-gross.js';
import {
  grobeZeit, kurzName, karteHalten, karteVon, ortMarken, passeAufPunkte, startAnsicht,
  kartenLageQuelle, bedienSpalteOrdnen, bedienFlaechen, KARTEN_SPALTE, ortSuchen,
} from '../ui/map.js';
import * as auswahl from '../data/find-auswahl.js';

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
.fnd-kopf{margin:0;padding:20px ${RAND}px 9px;font:650 11px/1.2 ${FONT};letter-spacing:.09em;text-transform:uppercase;color:var(--muted-light)}
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
const UMSTANDS_TAGS = new Set(['see', 'draussen', 'drinnen', 'natur', 'aussicht', 'regional', 'historisch', 'stadt', 'ausflug', 'kultur', 'ausgehen', 'gratis', 'gemuetlich', 'gesellig']);

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

// Eine Karte in einer Reihe. `grund` (Für dich) ersetzt die Zeile unter dem Titel.
function karteHtml(eintrag, stand, { grund = null } = {}) {
  const unter = grund
    ? `<span class="fnd-unter" data-role="find-grund">${symbol('funkeln', 'var(--green-dark)', 12)}<span>${esc(grund.map((w) => wort(w)).join(' · '))}</span></span>`
    : `<span class="fnd-unter"><span>${esc(wannOderOrt(eintrag, stand))}</span></span>`;
  return `<button type="button" class="fnd-karte" data-act="find-oeffnen" data-id="${esc(eintrag.id)}" data-role="find-karte" data-anzeige="${eintrag.gesponsert ? '1' : '0'}" data-tipp="${stand.tipps.has(eintrag.id) ? '1' : '0'}">
<span class="fnd-bild">${bildInhalt(eintrag, 34)}${bildMarken(eintrag, stand)}</span>
<span class="fnd-titel">${esc(eintrag.titel)}</span>
${unter}
</button>`;
}

function reiheHtml(id, titel, liste, stand, { gruende = null } = {}) {
  if (!liste.length) return '';
  const karten = liste.map((eintrag, index) => karteHtml(eintrag, stand, { grund: gruende ? gruende[index] : null })).join('');
  return `<section data-role="find-abschnitt" data-abschnitt="${esc(id)}" aria-label="${esc(titel)}">
<h2 class="fnd-kopf">${esc(titel)}</h2>
${edgeFadeRow(karten, { gap: 10, padLeft: RAND, padRight: RAND, padY: '0', scrollKey: `find-reihe-${id}` })}
</section>`;
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

// Der Zustand des Finders lebt im UI-Zustand des Tabs — wer den Tab verlässt, findet beim
// Zurückkommen wieder das Dashboard (Runde 5, F1).
//   ctx.ui.finder = { antworten:[{frage, optionen}], auswahl:[…] (offene Mehrfachwahl), ergebnis }
function finderStand(stand, finder) {
  return auswahl.finderStand(stand.eintraege, finder.antworten, stand.jetzt);
}

// Der Finder oben auf dem Dashboard: die erste Frage mit ihren Antworten. Nur Antworten, nach
// denen etwas übrig bliebe (find-auswahl.js › finderOptionen).
function finderKarte(stand) {
  const start = auswahl.finderStand(stand.eintraege, [], stand.jetzt);
  if (!start.frage || !start.optionen.length) return '';
  const chips = start.optionen.map((option) => `<button type="button" class="fnd-chip" data-act="find-lust" data-option="${esc(option.id)}" aria-pressed="false">${esc(antwortText(start.frage.id, option.id))}</button>`).join('');
  return `<section class="fnd-finder" data-role="find-finder" aria-label="${esc(frageText(start.frage.id))}">
<h2 class="fnd-finder-titel">${esc(frageText(start.frage.id))}</h2>
<div class="fnd-chips">${chips}</div>
</section>`;
}

function zurueckKnopf(act) {
  return `<button type="button" class="fnd-zurueck" data-act="${act}" aria-label="${esc(tx('Zurück'))}">${symbol('zurueck', 'var(--ink)', 20)}</button>`;
}

function finderSchrittHtml(stand, finder, zustand) {
  const frage = zustand.frage;
  const mehrfach = Boolean(frage.mehrfach);
  const gewaehlt = mehrfach ? finder.auswahl : [];
  // Was bliebe, wenn man JETZT weiterginge: mit der offenen Mehrfachwahl.
  const vorschau = mehrfach && gewaehlt.length
    ? auswahl.finderKandidaten(stand.eintraege, [...finder.antworten, { frage: frage.id, optionen: gewaehlt }], stand.jetzt).length
    : zustand.kandidaten.length;
  const chips = zustand.optionen.map((option) => `<button type="button" class="fnd-chip" data-act="find-option" data-option="${esc(option.id)}" aria-pressed="${gewaehlt.includes(option.id) ? 'true' : 'false'}">${esc(antwortText(frage.id, option.id))}</button>`).join('');
  const zurueck = finder.antworten.length ? zurueckKnopf('find-zurueck') : '';
  const weiterWort = mehrfach && gewaehlt.length ? tx('Weiter') : tx('Egal');
  // Der Schritt trägt seine Nummer im NAMEN eines Merkmals: Der Abgleich (core/html.js) setzt
  // ihn dadurch für jede neue Frage frisch ein, und sie gleitet weich herein — ohne Sprung.
  const schritt = finder.antworten.length;
  return `<div class="fnd-schritt" data-role="find-frage" data-frage="${esc(frage.id)}" data-schritt-${schritt}="">
<div class="fnd-blatt-kopf">${zurueck}</div>
<h2 class="fnd-frage">${esc(frageText(frage.id))}</h2>
${mehrfach ? `<p class="fnd-hinweis">${esc(tx('Mehrere möglich'))}</p>` : ''}
<div class="fnd-chips">${chips}</div>
<div class="fnd-fuss">
<button type="button" class="fnd-knopf" data-act="find-zeigen" data-role="find-zahl" data-zahl="${vorschau}" data-art="leise">${esc(tn(vorschau, '{n} Idee zeigen', '{n} Ideen zeigen'))}</button>
<button type="button" class="fnd-knopf" data-act="find-weiter" data-art="${mehrfach && gewaehlt.length ? 'haupt' : 'leise'}">${esc(weiterWort)}</button>
</div>
</div>`;
}

function zeileHtml(eintrag, stand) {
  const unter = [eintrag.gesponsert ? tx('Anzeige') : '', wannOderOrt(eintrag, stand)].filter(Boolean).join(' · ');
  return `<button type="button" class="fnd-zeile" data-act="find-oeffnen" data-id="${esc(eintrag.id)}" data-role="find-zeile" data-anzeige="${eintrag.gesponsert ? '1' : '0'}">
<span class="fnd-daumen">${bildInhalt(eintrag, 22)}</span>
<span class="fnd-zeile-text"><span class="fnd-zeile-titel">${esc(eintrag.titel)}</span><span class="fnd-unter"><span>${esc(unter)}</span></span></span>
${eintrag.score == null ? '' : `<span class="fnd-score" data-tipp="${stand.tipps.has(eintrag.id) ? '1' : '0'}"${stand.tipps.has(eintrag.id) ? ' style="color:var(--green-dark);gap:3px"' : ''}>${stand.tipps.has(eintrag.id) ? symbol('haken', 'var(--green-dark)', 11) : ''}${esc(scoreText(eintrag.score))}</span>`}
</button>`;
}

function finderErgebnisHtml(stand, finder, zustand) {
  const liste = zustand.kandidaten.slice(0, ERGEBNIS_ZAHL).map((kandidat) => kandidat.eintrag);
  if (!liste.length) {
    return `<div class="fnd-schritt" data-role="find-ergebnis" data-schritt-e="">
<div class="fnd-blatt-kopf">${zurueckKnopf('find-zurueck')}</div>
<h2 class="fnd-frage">${esc(tx('Dazu passt gerade nichts.'))}</h2>
<button type="button" class="fnd-textknopf" data-act="find-von-vorn">${esc(tx('Nochmal von vorn'))}</button>
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
  return `<div class="fnd-schritt" data-role="find-ergebnis" data-schritt-e="">
<div class="fnd-blatt-kopf">${zurueckKnopf('find-zurueck')}</div>
<h2 class="fnd-frage">${esc(tx('Wie wär’s damit?'))}</h2>
${gross}
<div class="fnd-aktionen"><button type="button" class="fnd-knopf" data-act="find-planen" data-id="${esc(erster.id)}" data-art="haupt">${esc(tx('Meet planen'))}</button></div>
${weitere}
<button type="button" class="fnd-textknopf" data-act="find-von-vorn">${esc(tx('Nochmal von vorn'))}</button>
</div>`;
}

function finderBlatt(stand, finder) {
  const zustand = finderStand(stand, finder);
  const inhalt = finder.ergebnis || zustand.fertig
    ? finderErgebnisHtml(stand, finder, zustand)
    : finderSchrittHtml(stand, finder, zustand);
  return sheet(`<div class="fnd-blatt" data-role="find-finder-blatt">${inhalt}</div>`, { closeAct: 'find-finder-zu', scrollKey: `find-finder-${finder.antworten.length}-${finder.ergebnis || zustand.fertig ? 'e' : 'f'}` });
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
</div>`;
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

function finderNeu(ui, antworten = [], auswahlListe = []) {
  ui.finder = { antworten, auswahl: auswahlListe, ergebnis: false };
}

// =============================================================================================
// Die Seite
// =============================================================================================
function kopf(ctx, stand) {
  const karteAn = ctx.ui.findAnsicht === 'karte';
  const knoepfe = [
    stand.admin ? `<button type="button" class="fnd-rund" data-act="find-neu" data-role="find-neu-knopf" aria-label="${esc(tx('Eintrag anlegen'))}"><span style="pointer-events:none;display:flex">${plus('var(--ink)', 18)}</span></button>` : '',
    stand.eintraege.length ? `<button type="button" class="fnd-rund" data-act="find-ansicht" data-role="find-ansicht" aria-label="${esc(karteAn ? tx('Liste') : tx('Karte'))}"><span style="pointer-events:none;display:flex">${karteAn ? listIcon('var(--ink)', 18) : mapIcon('var(--ink)', 18)}</span></button>` : '',
  ].join('');
  return `${tabHeader(`<span style="font-family:${TITEL_FONT};font-size:22px;font-weight:650">Find</span>`, knoepfe)}${STIL}`;
}

function leerHtml(stand) {
  return `<div class="fnd" data-role="find-seite"><div class="fnd-leer" data-role="find-leer">
<span style="font:650 16px/1.3 ${FONT};color:var(--ink)">${esc(tx('Noch nichts zu finden.'))}</span>
${stand.admin ? `<div class="fnd-aktionen" style="margin-top:10px"><button type="button" class="fnd-knopf" data-act="find-neu" data-art="haupt">${esc(tx('Eintrag anlegen'))}</button></div>` : ''}
</div></div>`;
}

// Die Überschriften der Reihen — einzeln ausgeschrieben (Sprachprüfung).
function abschnittTitel(id) {
  switch (id) {
    case 'wochenende': return tx('Dieses Wochenende');
    case 'fuerdich': return tx('Für dich');
    case 'restaurants': return tx('Beste Restaurants');
    case 'erlebnisse': return tx('Beste Erlebnisse');
    case 'demnaechst': return tx('Demnächst');
    case 'gemerkt': return tk('Gemerkt', 'Liste');
    default: return '';
  }
}

function dashboardHtml(stand) {
  if (!stand.eintraege.length) return leerHtml(stand);
  const abschnitte = auswahl.dashboardAbschnitte(stand.eintraege, {
    interessen: stand.settings.interests, gemerktIds: stand.gemerktIds, jetzt: stand.jetzt,
  });
  return `<div class="fnd" data-role="find-seite">
${finderKarte(stand)}
${abschnitte.map((abschnitt) => reiheHtml(abschnitt.id, abschnittTitel(abschnitt.id), abschnitt.liste, stand, { gruende: abschnitt.gruende || null })).join('\n')}
</div>`;
}

function overlaysHtml(ctx, stand) {
  const { ui } = ctx;
  const teile = [];
  if (ui.finder) teile.push(finderBlatt(stand, ui.finder));
  const detail = ui.findDetail ? stand.nachId.get(ui.findDetail) : null;
  if (detail) teile.push(detailBlatt(stand, detail, ui.findFoto === detail.id));
  if (ui.findNeu && stand.admin) teile.push(neuBlatt(ctx));
  teile.push(discardSheet(ctx));
  return teile.join('');
}

function renderFindHome(ctx) {
  const stand = findStand(ctx);
  // Ohne Einträge gibt es auch nichts auf einer Karte — die Seite bleibt dann bei der Liste.
  const karte = ctx.ui.findAnsicht === 'karte' && stand.eintraege.length > 0 && !ctx.preview;
  const html = screenScaffold({
    page: true,
    header: kopf(ctx, stand),
    body: karte ? kartenRumpf(stand) : dashboardHtml(stand),
    bottom: '',
    scrollKey: karte ? 'find-karte' : 'find',
    ...(karte ? { bottomInset: 0, headerFade: false, bottomFadeHeight: 0 } : {}),
    overlays: overlaysHtml(ctx, stand),
  });
  return { html, bind: bindFindHome };
}

function bindFindHome(root, ctx) {
  const { ui } = ctx;
  const stand = findStand(ctx);
  const eintragVon = (daten) => stand.nachId.get(String(daten.id || '')) || findStand(ctx).nachId.get(String(daten.id || ''));
  if (ui.findAnsicht === 'karte' && stand.eintraege.length) karteEinrichten(root, ctx, stand);
  neuFelderBinden(root, ctx);
  const neuWache = dirtyGuard(ctx, 'find-neu');
  if (ui.findNeu) neuWache.track(neuWert(ui));

  const weiterMit = (antwort) => {
    const finder = ui.finder;
    if (!finder) return;
    finder.antworten = [...finder.antworten, antwort];
    finder.auswahl = [];
    finder.ergebnis = false;
    rueckmeldung('auswahl');
    ctx.render();
  };

  bindActions(root, {
    ...discardActions(ctx),
    'find-ansicht': () => {
      ui.findAnsicht = ui.findAnsicht === 'karte' ? 'liste' : 'karte';
      rueckmeldung('tipp');
      ctx.render();
    },
    'find-lust': (daten) => {
      // Ein Gefühl auf dem Dashboard IST die erste Antwort — das Blatt beginnt bei der zweiten.
      finderNeu(ui, [{ frage: auswahl.FINDER_START, optionen: [String(daten.option)] }]);
      rueckmeldung('auswahl');
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
      rueckmeldung('tipp');
      ctx.render();
    },
    'find-zurueck': () => {
      const finder = ui.finder;
      if (!finder) return;
      if (finder.ergebnis) {
        finder.ergebnis = false;
        // Kam das Ergebnis von selbst (nichts mehr zu fragen), geht „zurück" eine Antwort zurück.
        if (!finderStand(findStand(ctx), finder).fertig) { ctx.render(); return; }
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
      if (eintrag) meetPlanen(ctx, eintrag);
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
