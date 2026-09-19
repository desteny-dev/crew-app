// Runde 7 (C1, C2, H3) — der Einstieg läuft IN der echten Ansicht, und die Berechtigungen.
//
// Jonathan: „am besten das er direkt in der offiziellen ansicht ist, und dort die nutzer direkt
// die buttons und funktionen selber verwenden koennen." — „der titel sagt schon alles was man
// wissen muss, der text ist nur detail." — „generell sind berechtigungen für die app das
// wichtigste, damit sie auch funktioniert." — „berechtigungen werden das erste mal erst
// abgefragt wenn es sinnhaft ist."
//
// Bis Runde 6 lagen VIER gezeichnete Karten ÜBER der App: man las vier Bilder und stand danach
// vor einer Liste, ohne einen einzigen Knopf berührt zu haben. Jetzt steht der Mensch IN der App.
// Über allem liegt ein Dunkel mit EINEM Loch — genau um das Bedienelement, um das es geht. Der
// Tipp geht durch das Loch an das ECHTE Element. Weiter geht es, weil die App die Wirkung
// gemerkt hat (getFreeState().active, die Route) — nicht, weil jemand „Weiter" gedrückt hat.
//
// Der Weg geht durch die vier Bereiche (core/router.js › TAB_ORDER), aber NICHT durch alles.
// Vier Schritte, vier Handgriffe — und in zweien davon die beiden Fragen (L1):
//
//   1  crew    FREE drücken            → danach: wer sonst frei ist … und dort die MITTEILUNGEN
//   2  karte   Karten-Tab öffnen       → danach: die Ebenen (Leute / Meets) … und der STANDORT
//   3  meet    Meet-Tab öffnen         → danach: der runde „+" der FREE-Reihe (Vorschläge) (H3)
//   4  profil  Profil-Tab öffnen       → danach: die Ressourcen und was sie bewirken      (H3)
//
// L1 (Jonathan: „nutzer müssen in einem sinnvollen moment die anfrage bekommen, und das gleiche
// für standort, am besten in dem guide, wo die karte gezeigt wird"): Bis Runde 7/Welle 1 war der
// Baustein „Erlaubnis erklären und holen" fertig — und hatte im ganzen web/-Baum KEINEN Aufrufer.
// Eine Zusage ohne Funktion. Jetzt wird gefragt, NACHDEM der Mensch gesehen hat, wozu es dient:
// die Mitteilungen in dem Moment, in dem es um „wer ist gerade frei" geht, der Standort auf der
// Karte. Beides höchstens EINMAL (erlaubnisLage), beides ohne Sackgasse: wer ablehnt, behält
// eine vollständig benutzbare App — beide Fragen sind Zugaben, keine Bedingungen.
// Die fünfte, gezeichnete Mitteilungs-Karte am Ende ist damit WEG: Sie fragte dasselbe an einer
// Stelle, an der man nichts davon gesehen hatte, und kostete einen Handgriff mehr.
//
// Wer den Guide überspringt, darf trotzdem nicht für immer ungefragt bleiben — dafür gibt es den
// zweiten sinnvollen Moment (erlaubnisWacht, weiter unten).
//
// H3 („was bringen die Ressourcen, wo sind die Empfehlungen"): Beides wird DORT gesagt, wo es
// steht. Nach dem Handgriff wandert das Loch auf die Stelle und die Karte sagt in EINEM Satz,
// was sie bringt — keine Aufzählung in einem Erklärbild, das man nie wiederfindet.
//
// C2 („kein Titel ist eine Frage"): Das Feld heißt nicht mehr `frage`, sondern `titel`. Damit
// fällt ein zurückkehrender Fragetitel schon beim Schreiben auf, nicht erst beim Lesen.
//
// Beide Fragen benutzen denselben Baustein wie jede andere Stelle der App: „Erlaubnis erklären
// und holen" (zweiter Teil dieser Datei). EIN Sheet, EIN Satz, EIN Knopf — und was danach gilt,
// steht als ruhige Zeile in der Guide-Karte, statt einfach zu verschwinden.
//
// ============================================================================================
// Schnittstelle
// --------------------------------------------------------------------------------------------
// Einstieg (app.js, Profil):
//   guideBeimStart(ctx)            einmal nach dem Start — zeigt den Guide nur beim ersten Mal.
//                                  Gibt ein Versprechen: true, wenn er lief (nach dem Schließen).
//   guideStarten(ctx, { … })       den Guide von Hand öffnen („Kurzer Einstieg" im Profil).
//   guideGesehen() / guideZuruecksetzen()
//   guideOffen()                   läuft der Guide gerade?
//   guideBlockiert()               läuft er als DECKENDE Karte? Nur dann gehören Zurück-Geste
//                                  und Wisch ihm; im Live-Modus gehören sie dem echten Bild.
//                                  ANGEBOT an app.js (zurueckMoeglich prüft dort noch guideOffen()
//                                  — eine Zeile, die dem Chef gehört). Bis dahin ist die Geste
//                                  strenger als nötig, nie falsch.
//
// Berechtigungen (jedes Paket):
//   erlaubnisHolen(ctx, 'standort', { zweck })   erklärt kurz und holt die Erlaubnis — EINMAL.
//                                  Versprechen auf { ok, lage, lat, lon }. Wurde schon gefragt,
//                                  kommt sofort das Ergebnis zurück, ohne jede Rückfrage.
//   erlaubnisLage('standort')      'offen' | 'erteilt' | 'abgelehnt' | 'unmoeglich'
//   erlaubnisHinweis('standort')   ruhige Zeile für die Stelle, an der die Erlaubnis FEHLT —
//                                  kein Popup, sondern eine Erklärung mit einem Weg zurück.
//   erlaubnisAktionen(ctx)         in bindActions einhängen ('erlaubnis-holen', data-art).
//   erlaubnisWacht(ctx)            der zweite sinnvolle Moment für alle, die den Guide nicht
//                                  gesehen haben — läuft von selbst mit (guideBeimStart). Er
//                                  stellt die Frage EINMAL und zeigt dort, wo jemand „Nicht
//                                  jetzt" getippt hat, EINMAL die ruhige Zeile mit dem Knopf
//                                  (erlaubnisHinweis + erlaubnisAktionen, selbst eingehängt).
//
// Der Guide und das Erlaubnis-Sheet hängen sich SELBST in den Handyrahmen (ebeneAnlegen) und
// überleben jeden Render: core/html.js lässt Knoten mit __morphFrei unangetastet. Dadurch
// braucht app.js weder Markup- noch Bindungs-Haken.
// ============================================================================================
import { esc, rueckmeldung, offenesSheet } from '../core/html.js';
import { t as tx } from '../core/sprache.js';
// Runde 7: EINE Wahrheit ueber Tab -> Wurzelroute (core/router.js). Der Guide fuehrt
// zwischen den Bereichen hin und her und darf diese Zuordnung nicht ein zweites Mal fuehren.
import { TAB_ROUTE } from '../core/router.js';
// P3 (web/ui/mitteilungen.js) — nur benutzt, nicht geändert. Statisch geladen, weil die
// Erlaubnis SYNCHRON im Tipp angefragt werden muss (iOS verlangt die Berührung als Auslöser).
import { pushEinschalten, pushLage } from './mitteilungen.js';
import { istApple } from '../data/push.js';
// Hausregel 3 (ein Datenvertrag): Was dieses Gerät wirklich kann, sagt EINE Stelle —
// web/core/native.js. Bis Runde 7/Welle 2 fragte geraetKann() hier selbst globalThis.Notification
// ab. In der nativen Hülle gibt es das gar nicht (dort trägt das Plugin PushNotifications die
// Fähigkeit) — der Guide hätte dort „dieses Gerät kann das nicht" gesagt, während die App längst
// Mitteilungen schickt. Zwei Wahrheiten über dasselbe Ding sind ein Fehler, kein Kompromiss.
import { kann } from '../core/native.js';

const FONT = "'Instrument Sans',sans-serif";
const TITEL_FONT = "'Bricolage Grotesque',sans-serif";
const GUIDE_MERKER = 'crew.guide.gesehen';
// Chef (Runde 6, beim Einhängen): Der Guide hängt am EINRICHTEN, nicht am fehlenden Merker.
// app.js setzt diesen Merker, sobald jemand ins Onboarding geschickt wird — das ist der einzige
// Moment, in dem sicher ein neuer Mensch vor der App sitzt. Ein Demo-Bestand (Seed, ?reset=1)
// kennt das Einrichten nicht und bekommt deshalb auch keinen Guide über den Schirm gelegt.
const GUIDE_FAELLIG = 'crew.guide.faellig';
const ERLAUBNIS_MERKER = 'crew.erlaubnis';
const GUIDE_FASSUNG = 1;
const WECHSEL_MS = 260;
const KURVE = 'cubic-bezier(.22,.61,.36,1)';

// --- kleine Helfer ----------------------------------------------------------------------------

function lesen(schluessel) {
  try { return JSON.parse(globalThis.localStorage?.getItem(schluessel) || 'null'); } catch { return null; }
}

function schreiben(schluessel, wert) {
  try { globalThis.localStorage?.setItem(schluessel, JSON.stringify(wert)); } catch { /* privates Fenster */ }
}

function loeschen(schluessel) {
  try { globalThis.localStorage?.removeItem(schluessel); } catch { /* egal */ }
}

function reduziert() {
  try { return Boolean(globalThis.matchMedia?.('(prefers-reduced-motion: reduce)').matches); } catch { return false; }
}

// ---------------------------------------------------------------------------------------------
// Wann und WO hat der letzte Fingerdruck BEGONNEN — irgendwo im Rahmen, nicht nur auf unseren
// Ebenen. Gebraucht wird das an zwei Stellen, und beide Male für dieselbe Frage: Hat dieser Tipp
// gemeint, was unter ihm liegt — oder ist ihm etwas unter den Finger gefahren?
//
// Runde 7/Welle 3, beides GEMESSEN (360 px, dunkles Thema, leerer Bestand):
//   · Drei Tipps auf dieselbe Stelle im Abstand von 0,45 s. Tipp 2 holte die Standort-Frage vor,
//     Tipp 3 landete 450 ms später auf dem Blatt, das genau dorthin gefahren war → „Nicht jetzt".
//     Ergebnis {lage:'abgelehnt', gefragt:true, systemGefragt:0}: Die einzige Frage war verbraucht,
//     und das System hatte nie jemand gesehen. Das ist die schlimmste Form dieses Fehlers.
//   · Der Handgriff-Tipp auf FREE: 4 ms nach dem Loslassen kam sein eigener click auf der
//     Sperrfläche an — in der Zwischenzeit hatte der 120-ms-Takt auf 'zeigen' geschaltet und die
//     Sperrflächen neu gelegt. Der Tipp, der den Erklärteil aufgeschlagen hat, blätterte ihn damit
//     sofort wieder weg: in 2 von 3 Läufen war er ohne einen einzigen zusätzlichen Tipp fort.
//
// Ein Klick trägt seine Vorgeschichte nicht mit sich. Also wird sie hier geführt: EIN Zeitstempel,
// EINE Stelle, zwei Zeilen Auswertung — statt zwei Sonderwege an zwei Stellen.
let letzterTipp = { am: 0, x: 0, y: 0 };
if (globalThis.document?.addEventListener) {
  const merken = (x, y) => { letzterTipp = { am: Date.now(), x, y }; };
  globalThis.document.addEventListener('touchstart', (ereignis) => {
    const punkt = ereignis.touches?.[0] || ereignis.changedTouches?.[0];
    if (punkt) merken(punkt.clientX, punkt.clientY);
  }, { capture: true, passive: true });
  globalThis.document.addEventListener('pointerdown', (ereignis) => {
    // Eine Berührung ist über touchstart schon gezählt — sonst stünde sie hier ein zweites Mal.
    if (ereignis.pointerType === 'touch') return;
    merken(ereignis.clientX, ereignis.clientY);
  }, { capture: true, passive: true });
}

const TIPP_FRISCH_MS = 1500;
const TIPP_NAH_PX = 44;
/**
 * Wann hat der Tipp begonnen, zu dem DIESER Klick gehört?
 *
 * Nur wenn der Klick wirklich aus einer Berührung stammt, gilt deren Zeitstempel: Er muss frisch
 * sein UND an derselben Stelle liegen (ein Finger, der 200 px weiter loslässt, hat gewischt, nicht
 * getippt). Sonst — und bei jedem Klick, den nicht ein Mensch ausgelöst hat (isTrusted === false:
 * el.click() aus einem Prüflauf, aus app.js, aus der Vorlesefunktion) — beginnt der Tipp jetzt.
 *
 * Gemessen, warum das nötig ist: Ohne die beiden Wachen erbte ein synthetischer Klick den
 * Zeitstempel einer ganz anderen Berührung von vorhin und galt als „war schon unten" — das hat in
 * scratch/r7b-guide.mjs zwölf Zusicherungen umgeworfen, weil ein `zu.click()` auf „Nicht jetzt"
 * nicht mehr ankam.
 */
function tippBeginn(ereignis) {
  const jetzt = Date.now();
  if (!letzterTipp.am || jetzt - letzterTipp.am >= TIPP_FRISCH_MS) return jetzt;
  if (ereignis && ereignis.isTrusted === false) return jetzt;
  const x = ereignis?.clientX;
  const y = ereignis?.clientY;
  if (!x && !y) return jetzt;
  if (Math.abs(letzterTipp.x - x) > TIPP_NAH_PX || Math.abs(letzterTipp.y - y) > TIPP_NAH_PX) return jetzt;
  return letzterTipp.am;
}

// =============================================================================================
// Eigene Ebenen im Handyrahmen
// ---------------------------------------------------------------------------------------------
// Sie liegen NEBEN der Seite im Rahmen, nicht darin: So decken sie Statusleiste und Navigation
// mit ab, und der DOM-Abgleich fasst sie nicht an (core/html.js laufzeitKnoten → __morphFrei).
// Ein Wächter setzt sie zurück, falls die Hülle doch einmal ersetzt wird.
// =============================================================================================

const ebenen = new Set();
let wachtUhr = 0;

function traegerFinden() {
  const dok = globalThis.document;
  if (!dok) return null;
  return dok.querySelector('#app > .runtime-shell:not(.gleit-ebene)') || dok.querySelector('#app') || dok.body || null;
}

function wachtPruefen() {
  for (const knoten of ebenen) {
    if (knoten.isConnected) continue;
    const traeger = traegerFinden();
    if (traeger) traeger.appendChild(knoten);
  }
  if (!ebenen.size && wachtUhr) { clearInterval(wachtUhr); wachtUhr = 0; }
}

export function ebeneAnlegen(rolle) {
  const dok = globalThis.document;
  const traeger = traegerFinden();
  if (!dok || !traeger) return null;
  const vorhanden = [...ebenen].find((knoten) => knoten.dataset.ebene === rolle);
  if (vorhanden) return vorhanden;
  const knoten = dok.createElement('div');
  knoten.className = 'p5-ebene';
  knoten.dataset.ebene = rolle;
  knoten.__morphFrei = true;   // core/html.js: keine Zuordnung, kein Entfernen durch den Abgleich
  traeger.appendChild(knoten);
  ebenen.add(knoten);
  if (!wachtUhr) wachtUhr = setInterval(wachtPruefen, 250);
  return knoten;
}

export function ebeneSchliessen(knoten, optionen = {}) {
  if (!knoten) return Promise.resolve();
  ebenen.delete(knoten);
  if (!ebenen.size && wachtUhr) { clearInterval(wachtUhr); wachtUhr = 0; }
  const weg = () => knoten.remove();
  if (optionen.sofort || typeof knoten.animate !== 'function') { weg(); return Promise.resolve(); }
  const lauf = knoten.animate([{ opacity: 1 }, { opacity: 0 }], { duration: optionen.dauer || 200, easing: 'ease-in', fill: 'forwards' });
  return lauf.finished.then(weg, weg);
}

// =============================================================================================
// Gezeichnete Bilder (kein Foto)
// ---------------------------------------------------------------------------------------------
// Alle Farben sind Tokens, also stimmen sie in Hell und Dunkel. Jedes Bild steht in EINEM
// Seitenverhältnis (260 × 190), damit beim Wechsel der Karte nichts springt.
// =============================================================================================

let bildZaehler = 0;

function kopfZeichen(cx, cy, r, farbe) {
  const kopf = (r * 0.3).toFixed(1);
  const links = (cx - r * 0.52).toFixed(1);
  const unten = (cy + r * 0.66).toFixed(1);
  const breite = (r * 1.04).toFixed(1);
  return `<circle cx="${cx}" cy="${(cy - r * 0.2).toFixed(1)}" r="${kopf}" fill="${farbe}"></circle>`
    + `<path d="M${links} ${unten} a ${(r * 0.52).toFixed(1)} ${(r * 0.5).toFixed(1)} 0 0 1 ${breite} 0" fill="${farbe}"></path>`;
}

function avatarZeichen(cx, cy, r, optionen = {}) {
  const { frei = false, grund = 'var(--surface)' } = optionen;
  const punkt = frei
    ? `<circle cx="${(cx + r * 0.72).toFixed(1)}" cy="${(cy + r * 0.72).toFixed(1)}" r="${(r * 0.34).toFixed(1)}" fill="var(--green)" stroke="var(--surface)" stroke-width="2"></circle>`
    : '';
  return `<g><circle cx="${cx}" cy="${cy}" r="${r}" fill="${grund}" stroke="var(--ink-a12)" stroke-width="1.5"></circle>${kopfZeichen(cx, cy, r, 'var(--muted-light)')}${punkt}</g>`;
}

function bildFree() {
  return `<circle cx="86" cy="96" r="70" fill="none" stroke="var(--green-a12)" stroke-width="2"></circle>
<circle cx="86" cy="96" r="56" fill="none" stroke="var(--green-a22)" stroke-width="2"></circle>
<circle cx="86" cy="96" r="41" fill="var(--green)"></circle>
<text x="86" y="103" text-anchor="middle" font-family="${TITEL_FONT}" font-size="19" font-weight="650" letter-spacing="0.6" fill="var(--on-accent)">FREE</text>
<circle cx="126" cy="136" r="9.5" fill="var(--ink-a28)" stroke="var(--paper)" stroke-width="3"></circle>
<path d="M139 125 l6 -5 M143 136 h8 M139 147 l6 5" stroke="var(--ink-a22)" stroke-width="2.4" stroke-linecap="round"></path>
<path d="M130 70 C 158 50, 178 50, 194 60" fill="none" stroke="var(--ink-a22)" stroke-width="2" stroke-linecap="round" stroke-dasharray="5 6"></path>
${avatarZeichen(212, 50, 19, { frei: true })}
${avatarZeichen(212, 100, 19, { frei: true })}
${avatarZeichen(212, 150, 19)}`;
}

function bildKarte() {
  const id = `p5k${++bildZaehler}`;
  return `<defs><clipPath id="${id}"><rect x="6" y="14" width="248" height="162" rx="20"></rect></clipPath></defs>
<rect x="6" y="14" width="248" height="162" rx="20" fill="var(--map-tint)"></rect>
<g clip-path="url(#${id})">
<rect x="150" y="14" width="104" height="62" fill="var(--green-a12)"></rect>
<path d="M6 122 H254" stroke="var(--paper)" stroke-width="11" stroke-linecap="square"></path>
<path d="M92 14 V176" stroke="var(--paper)" stroke-width="9" stroke-linecap="square"></path>
<path d="M150 14 L208 176" stroke="var(--paper)" stroke-width="7" stroke-linecap="square"></path>
<circle cx="128" cy="96" r="30" fill="var(--green-a16)"></circle>
<circle cx="128" cy="96" r="11" fill="var(--green)" stroke="var(--karte-ich-rand)" stroke-width="2.5"></circle>
</g>
<rect x="6" y="14" width="248" height="162" rx="20" fill="none" stroke="var(--ink-a10)" stroke-width="1.5"></rect>
<path d="M56 74 l7 12 l7 -12 z" fill="var(--surface)" stroke="var(--ink-a12)" stroke-width="1.5"></path>
${avatarZeichen(63, 60, 17, { frei: true })}
<path d="M192 62 l7 12 l7 -12 z" fill="var(--surface)" stroke="var(--ink-a12)" stroke-width="1.5"></path>
${avatarZeichen(199, 48, 17, { frei: true })}`;
}

function bildMeet() {
  // Der Zipfel wird VOR der Sprechblase gezeichnet — sonst liefe seine Kontur quer durch sie.
  return `<path d="M30 92 L26 122 L54 104 z" fill="var(--surface)" stroke="var(--ink-a12)" stroke-width="1.5" stroke-linejoin="round"></path>
<rect x="8" y="46" width="86" height="60" rx="16" fill="var(--surface)" stroke="var(--ink-a12)" stroke-width="1.5"></rect>
<path d="M51 62 l4.6 10.4 L66 77 l-10.4 4.6 L51 92 l-4.6 -10.4 L36 77 l10.4 -4.6 z" fill="var(--green)"></path>
<path d="M100 92 H132" stroke="var(--ink-a22)" stroke-width="2.4" stroke-linecap="round"></path>
<path d="M124 84 l8 8 l-8 8" fill="none" stroke="var(--ink-a22)" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round"></path>
<rect x="142" y="26" width="110" height="138" rx="18" fill="var(--surface)" stroke="var(--ink-a12)" stroke-width="1.5"></rect>
<circle cx="164" cy="56" r="10" fill="none" stroke="var(--green)" stroke-width="2.2"></circle>
<path d="M164 50 v6 l4 3" fill="none" stroke="var(--green)" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"></path>
<rect x="182" y="51" width="52" height="10" rx="5" fill="var(--field)"></rect>
<path d="M164 84 c -7 0 -9 6 -9 9 c 0 6 9 13 9 13 c 0 0 9 -7 9 -13 c 0 -3 -2 -9 -9 -9 z" fill="none" stroke="var(--green)" stroke-width="2.2"></path>
<rect x="182" y="90" width="40" height="10" rx="5" fill="var(--field)"></rect>
${avatarZeichen(165, 134, 13)}
${avatarZeichen(196, 134, 13, { frei: true })}
${avatarZeichen(227, 134, 13)}`;
}

function bildGlocke() {
  return `<rect x="72" y="12" width="116" height="166" rx="22" fill="var(--paper-soft)" stroke="var(--ink-a14)" stroke-width="1.5"></rect>
<rect x="110" y="20" width="40" height="6" rx="3" fill="var(--ink-a10)"></rect>
<rect x="82" y="40" width="96" height="46" rx="13" fill="var(--surface)" stroke="var(--ink-a10)" stroke-width="1.5"></rect>
<rect x="92" y="52" width="22" height="22" rx="7" fill="var(--green-tint)"></rect>
<path d="M103 57 c -4 0 -6 3 -6 6 v3 l-2 3 h16 l-2 -3 v-3 c 0 -3 -2 -6 -6 -6 z" fill="var(--green-dark)"></path>
<path d="M101 71 h4" stroke="var(--green-dark)" stroke-width="2" stroke-linecap="round"></path>
<rect x="122" y="53" width="46" height="8" rx="4" fill="var(--field)"></rect>
<rect x="122" y="66" width="30" height="7" rx="3.5" fill="var(--field)"></rect>
<path d="M196 44 a 26 26 0 0 1 0 34" fill="none" stroke="var(--green-a40)" stroke-width="3" stroke-linecap="round"></path>
<path d="M210 32 a 44 44 0 0 1 0 58" fill="none" stroke="var(--green-a22)" stroke-width="3" stroke-linecap="round"></path>
<circle cx="172" cy="44" r="7" fill="var(--green)" stroke="var(--surface)" stroke-width="2"></circle>
${avatarZeichen(106, 132, 18, { frei: true })}
<rect x="134" y="118" width="40" height="9" rx="4.5" fill="var(--field)"></rect>
<rect x="134" y="134" width="26" height="8" rx="4" fill="var(--field)"></rect>`;
}

// Runde 7 (C1/H3): Der vierte Bereich ist das Profil — dort stehen die Ressourcen. Für den
// Rückfall auf die gezeichnete Karte (kein Anker gefunden) braucht auch dieser Schritt ein Bild.
function bildProfil() {
  const zeile = (y, breite) => `<rect x="76" y="${y}" width="17" height="17" rx="5.5" fill="var(--green-tint)"></rect>`
    + `<rect x="80.5" y="${y + 5.5}" width="8" height="6" rx="2" fill="var(--green-dark)"></rect>`
    + `<rect x="100" y="${y + 4.5}" width="${breite}" height="8" rx="4" fill="var(--field)"></rect>`
    + `<circle cx="186" cy="${y + 8.5}" r="5.5" fill="none" stroke="var(--green-a40)" stroke-width="2"></circle>`;
  return `<rect x="40" y="10" width="180" height="170" rx="22" fill="var(--paper-soft)" stroke="var(--ink-a14)" stroke-width="1.5"></rect>
${avatarZeichen(130, 48, 22)}
<rect x="108" y="78" width="44" height="8" rx="4" fill="var(--field)"></rect>
<rect x="60" y="98" width="140" height="70" rx="16" fill="var(--surface)" stroke="var(--ink-a10)" stroke-width="1.5"></rect>
<rect x="76" y="108" width="54" height="7" rx="3.5" fill="var(--ink-a14)"></rect>
${zeile(124, 58)}
${zeile(146, 42)}`;
}

const BILDER = { free: bildFree, karte: bildKarte, meet: bildMeet, glocke: bildGlocke, profil: bildProfil };

/** Ein gezeichnetes Bild als SVG (auch von update-info.js benutzt). */
export function guideBild(name, optionen = {}) {
  const zeichnen = BILDER[name] || bildFree;
  const { hoehe = '100%', breite = '100%' } = optionen;
  return `<svg data-bild="${esc(name)}" viewBox="0 0 260 190" width="${breite}" height="${hoehe}" preserveAspectRatio="xMidYMid meet" fill="none" role="img" aria-hidden="true" style="display:block;max-width:100%">${zeichnen()}</svg>`;
}

// =============================================================================================
// Berechtigungen — einmal, im richtigen Moment, danach nie wieder
// =============================================================================================

function erlaubnisAlle() {
  const stand = lesen(ERLAUBNIS_MERKER);
  return stand && typeof stand === 'object' ? stand : {};
}

function erlaubnisEintrag(art) {
  return erlaubnisAlle()[art] || null;
}

/** Merkt, dass gefragt wurde — und was dabei herauskam ('erteilt' | 'abgelehnt' | 'spaeter'). */
export function erlaubnisMerken(art, ergebnis) {
  const alle = erlaubnisAlle();
  alle[art] = { gefragt: true, ergebnis, am: Date.now() };
  schreiben(ERLAUBNIS_MERKER, alle);
}

/** Wurde für diese Sache schon einmal gefragt? Dann wird nie wieder gefragt. */
export function erlaubnisGefragt(art) {
  return Boolean(erlaubnisEintrag(art)?.gefragt);
}

function geraetKann(art) {
  if (art !== 'standort' && art !== 'mitteilungen') return true;
  // kann() kennt beide Wege: das Plugin in der Hülle UND den Browser-Weg. 'nein' heißt wirklich
  // nein — und nur dann sagt der Guide „dieses Gerät kann das nicht".
  return kann(art).wie !== 'nein';
}

/**
 * 'offen'      es wurde noch nie gefragt — an der passenden Stelle darf einmal gefragt werden
 * 'erteilt'    erlaubt: einfach benutzen
 * 'abgelehnt'  abgelehnt oder zurückgestellt: ruhig erklären, nie wieder fragen
 * 'unmoeglich' dieses Gerät kann es nicht
 */
export function erlaubnisLage(art) {
  if (!geraetKann(art)) return 'unmoeglich';
  const eintrag = erlaubnisEintrag(art);
  // Die Browser-Wahrheit gilt NUR, solange die Mitteilungen wirklich über den Browser laufen.
  // Trägt sie in der Hülle das Plugin (kann(...).wie === 'nativ'), gibt es globalThis.Notification
  // dort nicht — dann ist unser Merker das Gedächtnis, und die Hülle antwortet beim Fragen.
  if (art === 'mitteilungen' && kann('mitteilungen').wie === 'web' && typeof globalThis.Notification !== 'undefined') {
    if (globalThis.Notification.permission === 'granted') return 'erteilt';
    if (globalThis.Notification.permission === 'denied') return 'abgelehnt';
  }
  if (!eintrag?.gefragt) return 'offen';
  return eintrag.ergebnis === 'erteilt' ? 'erteilt' : 'abgelehnt';
}

// Still nachziehen: Wer den Standort später in den Systemeinstellungen erlaubt hat, soll ihn
// benutzen können, ohne dass ihn jemand noch einmal fragt. Umgekehrt wird nichts zurückgesetzt.
let laeuftAbgleich = false;
export function erlaubnisAbgleichen(nachher) {
  const erlaubnis = globalThis.navigator?.permissions;
  if (laeuftAbgleich || !erlaubnis?.query) return;
  laeuftAbgleich = true;
  erlaubnis.query({ name: 'geolocation' }).then((stand) => {
    const vorher = erlaubnisLage('standort');
    if (stand.state === 'granted' && vorher !== 'erteilt') {
      erlaubnisMerken('standort', 'erteilt');
      nachher?.();
    } else if (stand.state === 'denied' && vorher === 'offen') {
      erlaubnisMerken('standort', 'abgelehnt');
      nachher?.();
    }
  }).catch(() => {}).finally(() => { laeuftAbgleich = false; });
}

const ERLAUBNIS_TEXTE = {
  standort: () => ({
    titel: tx('Freunde in der Nähe sehen'),
    satz: tx('Dafür braucht Crew einmal deinen Standort — nur solange die App offen ist.'),
    knopf: tx('Standort erlauben'),
    bild: 'karte',
    fehltApple: tx('Standort ist aus. Einschalten geht in den Einstellungen des iPhones: Datenschutz → Ortungsdienste → Crew.'),
    fehltSonst: tx('Standort ist aus. Einschalten geht in den Einstellungen des Browsers für diese Seite.'),
  }),
  mitteilungen: () => ({
    titel: tx('Wir sagen dir Bescheid'),
    satz: tx('Sobald jemand aus deiner Crew frei ist, bekommst du eine kurze Mitteilung — sonst nichts.'),
    knopf: tx('Mitteilungen erlauben'),
    bild: 'glocke',
    fehltApple: tx('Erlauben lässt es sich in den iPhone-Einstellungen: Mitteilungen → Crew.'),
    fehltSonst: tx('Die Erlaubnis wurde abgelehnt. Zurücknehmen lässt sie sich nur in den Einstellungen des Browsers für diese Seite.'),
  }),
};

function texteFuer(art) {
  return (ERLAUBNIS_TEXTE[art] || ERLAUBNIS_TEXTE.standort)();
}

/**
 * Die ruhige Zeile für die Stelle, an der die Erlaubnis FEHLT. Kein Popup, keine zweite Frage:
 * Wurde vom System abgelehnt, steht hier der Weg über die Systemeinstellungen. Wurde nur
 * „Nicht jetzt" getippt, steht hier ein Knopf — den tippt der Mensch selbst an, wenn er will.
 */
export function erlaubnisHinweis(art, optionen = {}) {
  const lage = erlaubnisLage(art);
  if (lage === 'erteilt') return '';
  const texte = texteFuer(art);
  const eintrag = erlaubnisEintrag(art);
  const zurueckholbar = lage === 'abgelehnt' && eintrag?.ergebnis === 'spaeter';
  const satz = lage === 'unmoeglich'
    ? tx('Dieses Gerät kann das nicht.')
    : zurueckholbar ? texte.satz : (istApple() ? texte.fehltApple : texte.fehltSonst);
  const knopf = zurueckholbar || lage === 'offen'
    ? `<button data-act="erlaubnis-holen" data-art="${esc(art)}" data-treffer style="margin-top:8px;align-self:flex-start;min-height:38px;padding:0 14px;border-radius:999px;border:1px solid var(--ink-a12);background:var(--surface);color:var(--ink);font:650 12.5px/1 ${FONT};cursor:pointer;appearance:none"><span style="pointer-events:none">${esc(texte.knopf)}</span></button>`
    : '';
  return `<div data-role="erlaubnis-hinweis" data-art="${esc(art)}" data-lage="${esc(lage)}" style="display:flex;flex-direction:column;align-items:flex-start;padding:${optionen.kompakt ? '2px 0' : '10px 0'};font-family:${FONT}">
<span style="font-size:12px;line-height:1.45;color:var(--muted)">${esc(satz)}</span>${knopf}</div>`;
}

/** In bindActions einhängen, wenn erlaubnisHinweis() irgendwo im Markup steht. */
export function erlaubnisAktionen(ctx) {
  return {
    'erlaubnis-holen': (daten) => {
      rueckmeldung('tipp');
      erlaubnisHolen(ctx, daten.art || 'standort', { erneut: true }).then(() => ctx.render?.());
    },
  };
}

function standortHolen() {
  return new Promise((fertig) => {
    const geo = globalThis.navigator?.geolocation;
    if (!geo) { fertig({ ok: false, grund: 'geraet' }); return; }
    geo.getCurrentPosition(
      (stand) => fertig({ ok: true, lat: stand.coords.latitude, lon: stand.coords.longitude, genauigkeit: stand.coords.accuracy }),
      (fehler) => fertig({ ok: false, grund: fehler?.code === 1 ? 'verweigert' : 'unbekannt' }),
      { enableHighAccuracy: false, timeout: 12000, maximumAge: 60000 },
    );
  });
}

// Das Erlaubnis-Sheet: EINE Erklärung, EIN Knopf. Es kommt von unten, lässt sich nach unten
// wegwischen (core/html.js sheetWischen greift über .ui-sheet-card und den Schleier davor).
function erlaubnisSheet(art) {
  const texte = texteFuer(art);
  return `<div data-act="erlaubnis-scrim" data-guide-act="erlaubnis-spaeter" style="position:absolute;inset:0;background:var(--scrim);-webkit-backdrop-filter:var(--scrim-filter);backdrop-filter:var(--scrim-filter)"></div>
<div class="ui-sheet-card" data-role="erlaubnis-sheet" data-art="${esc(art)}" role="dialog" aria-modal="true" aria-label="${esc(texte.titel)}" style="position:absolute;left:0;right:0;bottom:0;background:var(--surface);border-radius:26px 26px 0 0;box-shadow:0 -10px 30px var(--shadow-15);padding:14px 20px calc(24px + env(safe-area-inset-bottom, 0px));display:flex;flex-direction:column;align-items:stretch;gap:14px;font-family:${FONT};color:var(--ink)">
<span style="width:38px;height:4px;border-radius:999px;background:var(--handle);align-self:center;flex:none"></span>
<span style="height:120px;display:flex;align-items:center;justify-content:center;flex:none">${guideBild(texte.bild, { hoehe: '120' })}</span>
<span style="display:flex;flex-direction:column;gap:6px">
<span style="font-family:${TITEL_FONT};font-size:21px;font-weight:650;letter-spacing:-.02em">${esc(texte.titel)}</span>
<span style="font-size:14px;line-height:1.5;color:var(--ink-soft)">${esc(texte.satz)}</span>
</span>
<span style="display:flex;flex-direction:column;gap:8px">
<button data-guide-act="erlaubnis-ja" data-treffer style="min-height:50px;border:0;border-radius:999px;background:var(--green);color:var(--on-accent);font:650 15px/1 ${FONT};cursor:pointer;appearance:none"><span style="pointer-events:none">${esc(texte.knopf)}</span></button>
<button data-guide-act="erlaubnis-spaeter" data-treffer style="min-height:44px;border:0;border-radius:999px;background:transparent;color:var(--muted);font:650 14px/1 ${FONT};cursor:pointer;appearance:none"><span style="pointer-events:none">${esc(tx('Nicht jetzt'))}</span></button>
</span>
</div>`;
}

let erlaubnisLauf = null;
// Solange die Systemfrage läuft, ist das Sheet taub. Gemessen (Welle 2): zwei Tipps ohne Pause
// auf „Standort erlauben" haben das System ZWEIMAL gefragt. Und ein Fehltipp auf den Schleier
// (data-guide-act="erlaubnis-spaeter") hätte in derselben Zeit die laufende Frage als „Nicht
// jetzt" abgehakt — die einzige Frage wäre verbraucht gewesen, bevor sie beantwortet war.
let frageLaeuft = false;

// Welle 3: Derselbe Riegel greift zu SPÄT — er schützt erst, NACHDEM „Standort erlauben" getippt
// wurde. Die Zeitspanne, in der das Blatt unter den Finger fährt, war ungeschützt.
//
// So eng liegen die Tipps EINER Tippserie beieinander — zeitlich und örtlich. Gemessen wurde der
// Fall mit 450 ms Abstand auf DIESELBE Stelle; 44 px ist eine Fingerbreite, dasselbe Maß, das
// überall in dieser App eine Trefferfläche ausmacht.
//
// Bewusst KEINE pauschale Taubheit über die ersten paar hundert Millisekunden: Das hätte auch den
// geduldigen Menschen getroffen, der das Blatt kommen sah und antwortet, sobald es steht (und
// jeden Prüflauf der Nachbarpakete, der genau das tut — einmal gemessen und wieder ausgebaut).
// Geprüft wird die Vorgeschichte dieses einen Tipps, nicht die Uhr.
const SERIE_MS = 700;
const SERIE_PX = 44;

/**
 * Zählt dieser Klick als Antwort auf das Blatt — oder ist ihm das Blatt unter den Finger gefahren?
 * Zwei Gründe, beide gemessen:
 *   1  Der Finger war schon unten, als das Blatt kam. Er hat es nie gesehen.
 *   2  Der Tipp DAVOR ging auf fast dieselbe Stelle und lag noch VOR dem Blatt. Da tippt jemand
 *      weiter, weil an dieser Stelle eben noch etwas anderes war.
 * Alles andere zählt — auch ein schneller Tipp, sobald das Blatt steht.
 */
function tippZaehltFuerSheet(ereignis) {
  const lauf = erlaubnisLauf;
  if (!lauf) return false;
  const beginn = tippBeginn(ereignis);
  if (beginn < lauf.ab) return false;
  const vor = lauf.tippDavor;
  const x = ereignis?.clientX;
  const y = ereignis?.clientY;
  // Ein Klick ohne Stelle (Tastatur, synthetisch) trägt keine Vorgeschichte — der zählt.
  if (!vor?.am || !x || !y) return true;
  if (vor.am >= lauf.ab || beginn - vor.am >= SERIE_MS) return true;
  return Math.abs(vor.x - x) > SERIE_PX || Math.abs(vor.y - y) > SERIE_PX;
}

/**
 * Erlaubnis erklären und holen — der Baustein für jeden Moment, in dem etwas wirklich gebraucht
 * wird. Gefragt wird höchstens EINMAL; danach kommt das Ergebnis ohne jede Rückfrage zurück.
 *   erlaubnisHolen(ctx, 'standort', { zweck })  →  { ok, lage, lat?, lon? }
 * `erneut: true` nur für einen ausdrücklichen Tipp des Menschen (erlaubnisHinweis-Knopf).
 */
export function erlaubnisHolen(ctx, art = 'standort', optionen = {}) {
  const lage = erlaubnisLage(art);
  if (lage === 'unmoeglich') return Promise.resolve({ ok: false, lage });
  if (lage === 'erteilt') {
    if (art !== 'standort') return Promise.resolve({ ok: true, lage });
    return standortHolen().then((ergebnis) => ({ ok: ergebnis.ok, lage: ergebnis.ok ? 'erteilt' : 'abgelehnt', ...ergebnis }));
  }
  // Schon gefragt: nichts mehr fragen. Nur ein ausdrücklicher Tipp darf es noch einmal versuchen,
  // und auch nur, wenn damals bloß „Nicht jetzt" gewählt wurde.
  if (lage === 'abgelehnt' && !(optionen.erneut && erlaubnisEintrag(art)?.ergebnis === 'spaeter')) {
    return Promise.resolve({ ok: false, lage });
  }
  if (erlaubnisLauf) return erlaubnisLauf.versprechen;

  const knoten = ebeneAnlegen('erlaubnis');
  if (!knoten) return Promise.resolve({ ok: false, lage });
  knoten.innerHTML = erlaubnisSheet(art);
  knoten.dataset.art = art;

  let loesen = null;
  const versprechen = new Promise((fertig) => { loesen = fertig; });
  const ab = Date.now();
  const tippDavor = { ...letzterTipp };
  erlaubnisLauf = { art, ctx, versprechen, loesen, knoten, ab, tippDavor };

  // Der taube Moment steht auch im DOM: Was die App sich selbst zusichert, muss von außen zu
  // sehen sein (Prüflauf, Entwicklerkonsole), ohne den Code zu lesen. Er dauert nur so lange, wie
  // die Tippserie reicht, die das Blatt aufgeschlagen hat — meist gar nicht.
  const taubBis = tippDavor.am && ab - tippDavor.am < SERIE_MS ? tippDavor.am + SERIE_MS : 0;
  knoten.dataset.taub = taubBis > Date.now() ? '1' : '0';
  if (taubBis > Date.now()) {
    setTimeout(() => { if (erlaubnisLauf?.knoten === knoten) knoten.dataset.taub = '0'; }, taubBis - Date.now());
  }

  knoten.addEventListener('click', (ereignis) => {
    const ziel = ereignis.target.closest('[data-guide-act]');
    if (!ziel || !knoten.contains(ziel)) return;
    ereignis.preventDefault();
    if (frageLaeuft) return;   // die Systemfrage steht schon — jeder weitere Tipp ist keiner
    // … und der Tipp muss diesem Blatt gegolten haben, nicht der Stelle, an der es eben erschien.
    if (!tippZaehltFuerSheet(ereignis)) return;
    if (ziel.dataset.guideAct === 'erlaubnis-ja') erlaubnisJa();
    // Welle 5: Als „gefragt" gilt NUR, was das System wirklich gezeigt hat, oder UNSER Knopf
    // „Nicht jetzt", bewusst gedrückt. Alles andere — der Schleier, ein Tipp daneben, das
    // Wegwischen (core/html.js sheetWischen schließt über schleier.click()) — legt das Blatt nur
    // weg. Gemessen (scratch/r7d-pruef-guide.mjs P1/P2): beides hatte die einzige Frage verbraucht.
    // Der Schleier trägt dasselbe data-guide-act wie der Knopf; der KNOPF allein hat data-treffer.
    else if (ziel.hasAttribute('data-treffer')) erlaubnisSpaeter();
    else erlaubnisWeglegen();
  });
  return versprechen;
}

function erlaubnisEnde(ergebnis) {
  const lauf = erlaubnisLauf;
  if (!lauf) return;
  erlaubnisLauf = null;
  frageLaeuft = false;
  ebeneSchliessen(lauf.knoten, { dauer: 180 });
  lauf.ctx?.render?.();
  lauf.loesen(ergebnis);
}

// Weggelegt, nicht beantwortet: Die Frage bleibt offen — aber nicht im selben Moment noch einmal
// (das wäre Nachbohren). Die Wache fragt erst wieder, wenn der Mensch den Moment verlassen hat
// und beim nächsten Mal wiederkommt.
const weggelegt = { standort: false, mitteilungen: false };
function erlaubnisWeglegen() {
  const lauf = erlaubnisLauf;
  if (!lauf || frageLaeuft) return;
  weggelegt[lauf.art] = true;
  erlaubnisEnde({ ok: false, lage: 'offen' });
}

function erlaubnisSpaeter() {
  const lauf = erlaubnisLauf;
  if (!lauf || frageLaeuft) return;
  rueckmeldung('schliessen');
  erlaubnisMerken(lauf.art, 'spaeter');
  erlaubnisEnde({ ok: false, lage: 'abgelehnt' });
}

// MUSS synchron im Tipp laufen: iOS verlangt die Berührung als Auslöser für die Systemfrage.
function erlaubnisJa() {
  const lauf = erlaubnisLauf;
  if (!lauf || frageLaeuft) return;
  frageLaeuft = true;
  rueckmeldung('tipp');
  const { art, ctx } = lauf;
  if (art === 'mitteilungen') {
    pushEinschalten(ctx).then((ergebnis) => {
      erlaubnisMerken('mitteilungen', ergebnis === 'an' ? 'erteilt' : 'abgelehnt');
      erlaubnisEnde({ ok: ergebnis === 'an', lage: ergebnis === 'an' ? 'erteilt' : 'abgelehnt', push: ergebnis });
    });
    return;
  }
  standortHolen().then((ergebnis) => {
    erlaubnisMerken('standort', ergebnis.ok ? 'erteilt' : 'abgelehnt');
    if (ergebnis.ok) rueckmeldung('erfolg');
    erlaubnisEnde({ ...ergebnis, lage: ergebnis.ok ? 'erteilt' : 'abgelehnt' });
  });
}

/**
 * Darf an DIESER Stelle ueberhaupt gefragt werden? (Hausregel 9: keine Zusage ohne Funktion.)
 * 'offen' allein reicht nicht: Mitteilungen kann dieses Geraet vielleicht gar nicht schicken —
 * im Demo-Bestand gibt es niemanden, der etwas schicken koennte, und auf dem iPhone braucht
 * Safari die App erst auf dem Home-Bildschirm. Dann wird NICHT gefragt, sondern gesagt, warum.
 */
export function erlaubnisFragbar(art, ctx) {
  if (erlaubnisLage(art) !== 'offen') return false;
  if (art !== 'mitteilungen') return true;
  return pushLage(ctx?.repo) === 'bereit';
}

// =============================================================================================
// Der zweite sinnvolle Moment
// ---------------------------------------------------------------------------------------------
// Der Guide fragt beides an der Stelle, an der man sieht, wozu es dient. Wer ihn überspringt,
// stünde sonst FÜR IMMER ohne Frage da — die App wäre für ihn dauerhaft halb so nützlich, ohne
// dass er je eine Wahl hatte. Deshalb wacht der Baustein selbst, genau zweimal:
//
//   Standort      beim ersten Aufenthalt im Karten-Bereich — dort sieht man, wozu er dient.
//   Mitteilungen  wenn jemand selbst FREE setzt — genau dann geht es um „wer ist frei".
//
// Gefragt wird trotzdem höchstens EINMAL je Sache (erlaubnisLage) und nie im Vorbeigehen: Die
// Lage muss zwei Runden hintereinander gelten. Wer ablehnt, behält eine vollständig benutzbare
// App — beide Fragen sind Zugaben, keine Bedingungen.
// =============================================================================================

const WACHT_MS = 700;
// Ist gerade nichts zu holen, wird auch nicht siebenmal je Sekunde nachgesehen. Gemessen in
// Welle 2: Im Demo-Bestand (und auf dem iPhone ohne Home-Bildschirm) ist 'mitteilungen' dauerhaft
// 'offen' und zugleich nicht fragbar — der 700-ms-Takt lief damit für die GANZE Laufzeit der App
// weiter und las bei jedem Takt localStorage und pushLage. Der Kommentar sagte „hört auf, sobald
// beide Fragen beantwortet sind"; für diesen Fall stimmte das nie.
const WACHT_RUHE_MS = 5000;
const WACHT_HALTEN = 2;
let wachtLauf = 0;
const wachtZaehler = { standort: 0, mitteilungen: 0 };

function wachtMoment(art, ctx) {
  if (art === 'standort') return String(ctx?.nav?.current?.()?.id || '').startsWith('karte.');
  return Boolean(ctx?.repo?.getFreeState?.()?.active);
}

/**
 * Läuft von selbst mit (guideBeimStart). Er tut drei Dinge, und hört ehrlich auf, wenn keins
 * davon mehr ansteht:
 *   1  die noch offene Frage im zweiten sinnvollen Moment stellen (höchstens EINMAL je Sache),
 *   2  wer „Nicht jetzt" getippt hat, bekommt dort EINMAL die ruhige Zeile mit dem Knopf,
 *   3  sonst nichts.
 * Kann gerade keine der beiden Fragen gestellt werden, fällt der Takt auf WACHT_RUHE_MS zurück.
 * Er schläft dann, er stirbt nicht: Sobald ein Konto da ist, ist die Frage wieder dran.
 */
export function erlaubnisWacht(ctx) {
  if (wachtLauf || typeof globalThis.setTimeout !== 'function') return;
  const arten = ['standort', 'mitteilungen'];
  const takt = () => {
    wachtLauf = 0;
    // Die ruhige Zeile gehört an den Moment, nicht an die App: wer den Bereich verlässt, ist sie los.
    if (hinweisKnoten && hinweisArt && !wachtMoment(hinweisArt, ctx)) hinweisSchliessen();
    const ruhig = zustand.offen || Boolean(erlaubnisLauf) || Boolean(hinweisKnoten);
    const nachholbar = arten.filter((art) => !hinweisGezeigt[art] && hinweisZurueckholbar(art));
    for (const art of nachholbar) {
      // Nicht im selben Atemzug: Wer gerade „Nicht jetzt" getippt hat, bekommt die Zeile NICHT
      // sofort daneben gestellt — das wäre Nachbohren. Sie wartet, bis der Mensch den Moment
      // einmal verlassen hat und beim NÄCHSTEN Mal wiederkommt.
      if (!wachtMoment(art, ctx)) { hinweisScharf[art] = true; continue; }
      if (ruhig || !hinweisScharf[art]) continue;
      hinweisZeigen(art, ctx);
      break;
    }
    for (const art of arten) if (weggelegt[art] && !wachtMoment(art, ctx)) weggelegt[art] = false;
    const offen = arten.filter((art) => erlaubnisLage(art) === 'offen');
    const fragbar = offen.filter((art) => erlaubnisFragbar(art, ctx));
    for (const art of arten) if (!fragbar.includes(art)) wachtZaehler[art] = 0;
    // Während der Guide läuft, fragt der Guide — nicht zwei Stellen gleichzeitig.
    if (!ruhig) {
      for (const art of fragbar) {
        if (!wachtMoment(art, ctx) || weggelegt[art]) { wachtZaehler[art] = 0; continue; }
        wachtZaehler[art] += 1;
        if (wachtZaehler[art] < WACHT_HALTEN) continue;
        wachtZaehler[art] = 0;
        erlaubnisHolen(ctx, art);
        break;
      }
    }
    // Nichts mehr zu fragen und nichts mehr nachzuholen: fertig, kein Takt mehr.
    if (!offen.length && !nachholbar.length && !hinweisKnoten) return;
    const eilig = fragbar.length || nachholbar.length || hinweisKnoten;
    wachtLauf = setTimeout(takt, eilig ? WACHT_MS : WACHT_RUHE_MS);
  };
  wachtLauf = setTimeout(takt, WACHT_MS);
}

// =============================================================================================
// Die ruhige Zeile DORT, wo die Erlaubnis fehlt — der Weg zurück zur verbrauchten Frage
// ---------------------------------------------------------------------------------------------
// erlaubnisHinweis() und erlaubnisAktionen() waren bis Runde 7/Welle 2 fertig gebaut und hatten
// im ganzen web/-Baum KEINEN Aufrufer: Der Knopf data-act="erlaubnis-holen" stand auf keinem
// Bildschirm — und hätte er dort gestanden, hätte er nichts getan, weil app.js erlaubnisAktionen
// nirgends einhängt. Genau der Mangel, den dieses Paket eine Welle lang abzustellen behauptet hat,
// nur an der anderen Hälfte.
//
// Gebraucht wird die Zeile für EINEN Fall, und nur für den: Wer „Nicht jetzt" getippt hat — oder
// daneben, auf den Schleier — hat seine einzige Frage verbraucht. Ohne einen Weg zurück wäre das
// endgültig. Deshalb steht am zweiten sinnvollen Moment (Karte / FREE gesetzt) EINMAL eine ruhige
// Zeile mit EINEM Knopf da, der wirklich fragt. Kein Popup, keine zweite Frage von selbst.
//
// Wo nichts zu holen ist, steht auch nichts: vom System abgelehnt (dann führt der Weg nur über die
// Systemeinstellungen, und das sagt die Zeile dort, wo jemand danach sucht), Gerät kann es nicht,
// oder Demo-Bestand ohne Absender. Eine Zeile, die nur „geht hier nicht" sagt, ist Lärm.
//
// Sie hängt sich SELBST in den Rahmen (ebeneAnlegen), wie der Guide und das Sheet — dadurch
// braucht kein fremder Bildschirm Markup oder Bindung. Wer sie auf einem eigenen Bildschirm fest
// haben will (Profil-Einstellungen, Umkreis), nimmt weiter erlaubnisHinweis() + erlaubnisAktionen().
// =============================================================================================

let hinweisKnoten = null;
let hinweisArt = '';
const hinweisGezeigt = { standort: false, mitteilungen: false };
// Scharf wird die Zeile erst, wenn der Moment einmal vorbei war — siehe erlaubnisWacht.
const hinweisScharf = { standort: false, mitteilungen: false };

function hinweisZurueckholbar(art) {
  return erlaubnisLage(art) === 'abgelehnt' && erlaubnisEintrag(art)?.ergebnis === 'spaeter';
}

function hinweisSchliessen() {
  const knoten = hinweisKnoten;
  if (!knoten) return;
  hinweisKnoten = null;
  hinweisArt = '';
  ebeneSchliessen(knoten, { dauer: 160 });
}

// Was schwebt hier über dem Inhalt und würde vom Band zugedeckt? Gemessen wird, nicht geraten:
// Es zählt jedes Bedienelement, das in den Streifen des Bandes ragt UND frei über dem Inhalt
// liegt (ein absolut/fix gesetzter Halter, der nicht die halbe Seite ist — die Ebenen-Schalter
// der Karte sind 44 px hoch, ein Seitencontainer ist es nicht). Eine lange Liste schiebt das
// Band damit NICHT vor sich her; ein schwebender Schalter schon.
function schwebendHindernis(wurzel, streifen) {
  const stil = globalThis.getComputedStyle;
  if (!stil) return 0;
  const rahmenHoehe = streifen.rahmenHoehe || 0;
  let oben = 0;
  for (const el of wurzel.querySelectorAll('button, [data-act], [role="button"], [role="slider"], input, select, textarea, a[href]')) {
    if (el.closest('.p5-ebene, .tab-depot, .gleit-ebene, [data-exit]')) continue;
    const r = el.getBoundingClientRect();
    if (r.width < 6 || r.height < 6) continue;
    if (r.bottom <= streifen.top || r.top >= streifen.bottom) continue;
    if (r.right <= streifen.left || r.left >= streifen.right) continue;
    let schwebt = false;
    let halter = el;
    for (let i = 0; i < 5 && halter && halter !== wurzel; i += 1) {
      const pos = stil(halter).position;
      if ((pos === 'absolute' || pos === 'fixed' || pos === 'sticky')
        && halter.getBoundingClientRect().height <= rahmenHoehe * 0.4) { schwebt = true; break; }
      halter = halter.parentElement;
    }
    if (!schwebt) continue;
    oben = oben ? Math.min(oben, r.top) : r.top;
  }
  return oben;
}

function hinweisZeigen(art, ctx) {
  if (hinweisKnoten || !hinweisZurueckholbar(art)) return false;
  const knoten = ebeneAnlegen('erlaubnis-hinweis');
  if (!knoten) return false;
  hinweisKnoten = knoten;
  hinweisArt = art;
  hinweisGezeigt[art] = true;
  // Die Ebene selbst lässt alles durch — nur das Band nimmt Tipps an. Die App bleibt bedienbar.
  knoten.style.pointerEvents = 'none';
  knoten.style.touchAction = 'auto';
  // Über der Fußleiste, nicht darauf: die Leiste wird GEMESSEN, nicht geraten — und zwar an
  // ihren eigenen Knöpfen, nicht an einer Klasse (die Leiste trägt ihre Maße inline,
  // components.js › tabBar). Gibt es keine (Einstellungen, Onboarding), sitzt das Band unten.
  const rahmen = knoten.getBoundingClientRect();
  const wurzel = globalThis.document?.querySelector('#app > .runtime-shell:not(.gleit-ebene)');
  const tabKnopf = wurzel?.querySelector('nav [data-act="tab"]') || wurzel?.querySelector('[data-act="tab"]') || null;
  const leiste = tabKnopf?.closest('nav') || tabKnopf || null;
  const leisteOben = leiste ? leiste.getBoundingClientRect().top : 0;
  const unten = leiste && leisteOben > rahmen.top
    ? Math.max(12, Math.round(rahmen.bottom - leisteOben) + 10)
    : 12;
  knoten.innerHTML = `<div data-role="erlaubnis-band" data-art="${esc(art)}" style="position:absolute;left:12px;right:12px;bottom:${unten}px;box-sizing:border-box;display:flex;align-items:flex-start;gap:8px;padding:10px 6px 10px 13px;border-radius:18px;background:var(--surface);border:1px solid var(--ink-a09);box-shadow:0 8px 24px var(--shadow-16);pointer-events:auto;font-family:${FONT};color:var(--ink)">
<span style="flex:1;min-width:0">${erlaubnisHinweis(art, { kompakt: true })}</span>
<button data-guide-act="hinweis-zu" data-treffer aria-label="${esc(tx('Schließen'))}" style="flex:none;width:44px;height:44px;margin:-3px 0 -3px 0;display:flex;align-items:center;justify-content:center;padding:0;border:0;background:transparent;color:var(--muted);cursor:pointer;appearance:none"><svg width="15" height="15" viewBox="0 0 15 15" fill="none" style="pointer-events:none"><path d="M3.5 3.5l8 8M11.5 3.5l-8 8" stroke="currentColor" stroke-width="1.8" stroke-linecap="round"></path></svg></button>
</div>`;
  // Und jetzt, mit dem fertig gesetzten Band, das GEMESSENE Ausweichen nach oben.
  //
  // GEMESSEN (Welle 3, 360 px, dunkles Thema): Das Band lag genau auf den Ebenen-Schaltern der
  // Karte (screens/karte.js › [data-role="karte-ebenen"], bottom:12px) und schluckte deren Tipps
  // (pointer-events:auto). Ein Hinweis, der die Bedienung zudeckt, von der er redet, ist schlimmer
  // als kein Hinweis. Die Fußleiste allein zu messen reichte nicht — über ihr schwebt noch etwas.
  const band = knoten.querySelector('[data-role="erlaubnis-band"]');
  if (band && wurzel) {
    // Drei Durchgänge: Jedes Ausweichen legt das Band in einen NEUEN Streifen, in dem wieder
    // etwas schweben kann (die Karte trägt Schalter, einen Zeitraum und eine Leiste am Rand).
    for (let runde = 0; runde < 3; runde += 1) {
      const r = band.getBoundingClientRect();
      const hoch = schwebendHindernis(wurzel, {
        top: r.top, bottom: r.bottom, left: r.left, right: r.right, rahmenHoehe: rahmen.height,
      });
      if (!hoch) break;
      // Nicht beliebig weit: Ein Band unter der Statusleiste wäre kein Band mehr, sondern ein
      // zweiter Deckel. Weiter oben als die halbe Seite geht es nicht.
      const neu = Math.min(Math.round(rahmen.bottom - hoch) + 10, Math.round(rahmen.height * 0.5));
      if (neu <= Math.round(rahmen.bottom - r.bottom)) break;
      band.style.bottom = `${neu}px`;
    }
  }
  // Genau der Weg, der jedem Bildschirm angeboten wird: erlaubnisAktionen(ctx)['erlaubnis-holen'].
  // Damit ist der Knopf nicht nur da, sondern nachweislich derselbe, den ein Screen einhängen würde.
  const aktionen = erlaubnisAktionen(ctx);
  knoten.addEventListener('click', (ereignis) => {
    if (ereignis.target.closest?.('[data-guide-act="hinweis-zu"]')) {
      ereignis.preventDefault();
      rueckmeldung('schliessen');
      hinweisSchliessen();
      return;
    }
    const holen = ereignis.target.closest?.('[data-act="erlaubnis-holen"]');
    if (!holen || !knoten.contains(holen)) return;
    ereignis.preventDefault();
    const gewaehlt = holen.dataset.art || art;
    hinweisSchliessen();
    aktionen['erlaubnis-holen']({ art: gewaehlt });
  });
  return true;
}

// =============================================================================================
// Der Guide — in der echten Ansicht
// ---------------------------------------------------------------------------------------------
// ZWEI Betriebsarten, und immer nur EINE Ebene im Rahmen:
//
//   live   'guide-live'  — die App ist sichtbar und bedienbar. Die Ebene selbst ist durchlässig
//                          (pointer-events:none); nur VIER Sperrflächen um das Loch fangen
//                          Berührungen ab. Bewusst vier Rechtecke statt eines clip-path-Lochs:
//                          das Loch ist dann eine echte Lücke im DOM, und der Tipp trifft
//                          garantiert das echte Element — auch den FREE-Knopf mit seiner
//                          eigenen Halte-Geste (components.js › data-hdrag="frei").
//   karte  'guide'       — die gezeichnete Vollbildkarte von Runde 6. Sie trägt jetzt nur noch
//                          den Mitteilungs-Schritt und den Rückfall, wenn ein Anker fehlt.
//
// Warum nicht auf Klicks lauschen, sondern auf den Zustand: Der FREE-Knopf hat KEIN data-act,
// er hängt an Zeiger-Ereignissen mit Haltezeit (crew.js › bindFreiControl). Ein Klick-Lauscher
// würde das Halten (Frei-ab-Ring) verpassen und bei abgebrochener Geste falsch weiterschalten.
// Gefragt wird deshalb die App selbst: getFreeState().active, nav.current().id.
//
// Der Anker wird in JEDEM Bild neu gesucht, nie gemerkt: der DOM-Abgleich (core/html.js) ersetzt
// Knoten, ein gemerkter wäre ein Zombie — genau dieses Muster hat Runde 6 schon einmal die
// Frei-Geste gekostet (crew.js › „ERSETZT: der Knoten #free-button …").
// =============================================================================================

const LIVE_LUFT = 12;          // Abstand zwischen Anker und Maskenkante. Unter ~10 px fängt die
                               // Maske den Beginn einer Halte-Geste am Knopfrand ab.
// Wie lange die Stelle nach dem Handgriff erklärt wird. Gemessen an dem, was dort steht:
// Titel plus Satz sind rund 130 Zeichen — in ruhigem Tempo etwa vier Sekunden. Lieber etwas
// zu lang: Wer schneller liest, tippt einmal irgendwohin und ist sofort weiter.
const ZEIGEN_MS = 3600;
const ZEIGEN_ANLAUF_MS = 800;  // solange wird auf das Loch gewartet, bevor die Zeit läuft
// L1: So lange darf der Mensch die Stelle ansehen, BEVOR die Frage kommt. Kürzer wirkte wie ein
// Popup beim Betreten; länger, und die Karte wäre schon weitergelaufen.
const ERLAUBNIS_VERZUG = 1500;
const SUCHE_HINFUEHREN_MS = 700;
const SUCHE_RUECKFALL_MS = 2000;
const PRUEF_MS = 120;          // so oft wird der echte Zustand befragt (nicht in jedem Bild)

// Ein Schritt:
//   id, bild            bild nur für den Rückfall auf die gezeichnete Karte
//   ort                 Tab, in dem der Handgriff liegt (Sicherheitsnetz beim Wiederholen)
//   titel, satz         C2: der Titel ist ein AUSSAGESATZ, der Satz ist das Detail
//   anker               { sel: [Selektoren…], form, auf? } — das echte Bedienelement
//   erledigt(ctx)       echter Zustand, sonst geht es nicht weiter
//   zeigen              dieselbe Form plus titel/satz: WAS der Handgriff gebracht hat (H3)
//   zeigen.erlaubnis    'standort' | 'mitteilungen' — hier wird gefragt (L1), 1,5 s nachdem
//                       das Loch steht: erst sehen, dann gefragt werden
//   modus: 'karte'      Schritt ohne echtes Element (heute nur noch der Rückfall)
//
// titel/satz bekommen das GEFUNDENE Element. Wer den Text am Zustand festmacht statt an einer
// festen Stelle, sagt auch dann die Wahrheit, wenn ein anderes Paket die Stelle umbaut — genau
// das ist in Welle 1 passiert: „Wer auch frei ist, steht dann hier bei dir" zeigte auf den
// FREE-Knopf, weil der Anker [data-role="frei-hinweis"] etwas anderes geworden war.
//
// Drei der vier Handgriffe sind ein Tipp auf einen Tab-Knopf. Anker UND Ziel kommen dabei aus
// derselben Quelle wie die Fussleiste selbst (core/router.js TAB_ROUTE) — wer einen Tab
// umbenennt, aendert weiter nur router.js, und der Guide zeigt danach nicht ins Leere.
const tabHandgriff = (tab) => ({
  anker: { sel: [`[data-act="tab"][data-tab="${tab}"]`], form: 'pille' },
  erledigt: (ctx) => ctx?.nav?.current?.()?.id === TAB_ROUTE[tab],
});

const SCHRITTE = [
  {
    id: 'frei',
    bild: 'free',
    ort: 'crew',
    titel: () => tx('Ein Tipp sagt: Ich habe Zeit'),
    satz: () => tx('Tipp auf FREE.'),
    anker: { sel: ['#free-button'], form: 'kreis' },
    erledigt: (ctx) => Boolean(ctx?.repo?.getFreeState?.()?.active),
    zeigen: {
      // Runde 8 (R8-8): Die Gesichter der Freien neben FREE (crew.js › frei-gesichter) gibt es
      // nicht mehr — und mit ihnen der Satz „ein Tipp auf ein Gesicht öffnet den Raum". Was jetzt
      // da ist: die FREE-Reihe selbst, und wer frei ist, zeigt es in der Liste mit dem grünen
      // Punkt am Bild (components.js personAvatar › frei-punkt). Genau das sagt der Satz — nicht
      // mehr (Hausregel 9: keine Zusage ohne Funktion).
      sel: ['[data-role="frei-reihe"]', '#free-button'],
      form: 'pille',
      erlaubnis: 'mitteilungen',
      titel: () => tx('Deine Freunde sehen es sofort'),
      satz: () => tx('Deine Freunde sehen ab jetzt, dass du Zeit hast. Wer auch frei ist, hat einen grünen Punkt am Bild.'),
    },
  },
  {
    id: 'karte',
    bild: 'karte',
    ort: 'crew',
    titel: () => tx('Die Karte zeigt, wer in der Nähe ist'),
    satz: () => tx('Tipp unten auf Karte.'),
    ...tabHandgriff('karte'),
    zeigen: {
      sel: ['[data-act="karte-ebene"]'],
      auf: 1,
      form: 'pille',
      erlaubnis: 'standort',
      titel: () => tx('Leute und Meets auf einer Karte'),
      // Bewusst ohne Zahl: Wie viele Ebenen die Karte führt, entscheidet screens/karte.js —
      // ein Satz mit „beide" wäre beim nächsten Ausbau still falsch geworden.
      satz: () => tx('Hier schaltest du an und aus, was auf der Karte liegen soll.'),
    },
  },
  {
    id: 'meet',
    bild: 'meet',
    ort: 'karte',
    titel: () => tx('Aus einer Idee wird ein Treffen'),
    satz: () => tx('Tipp unten auf Meet.'),
    ...tabHandgriff('meet'),
    zeigen: {
      // Runde 8 (R8-9): Die „+ Meet"-Pille ist weg. Ein neues Meet beginnt am runden „+" oben im
      // Kopf des Meet-Tabs (meet-browser.js plusKnopf, neben „Liste | Woche"); die FREE-Reihe gibt
      // es dort nicht mehr. Er öffnet „Was machen?" mit den Vorschlägen (newMeet.discover).
      sel: ['[data-role="mb-neu-meet"]'],
      form: 'kreis',
      titel: () => tx('Hinter dem Plus stehen Vorschläge fürs Meet'),
      satz: () => tx('Crew schlägt vor, was zu euch passt. Zeit, Ort und wer mitkommt klärt ihr dort.'),
    },
  },
  {
    id: 'profil',
    bild: 'profil',
    ort: 'meet',
    titel: () => tx('Was du hast, macht die Vorschläge besser'),
    satz: () => tx('Tipp unten auf Profil.'),
    ...tabHandgriff('profil'),
    zeigen: {
      sel: ['[data-act="res-add-row"]'],
      auf: 2,
      form: 'kasten',
      titel: () => tx('Ressourcen: Auto, Grill, Beamer'),
      satz: () => tx('Was hier steht, taucht in den Vorschlägen als „Ihr habt …" wieder auf.'),
      dauer: 4200,
    },
  },
];

const zustand = {
  offen: false, schritt: 0, ctx: null, knoten: null, loesen: null, wiederholung: false, grund: '',
  // guideZeigen(): EIN Hinweis auf EIN echtes Bedienelement, ohne den ganzen Weg.
  einzel: null,
  modus: '', phase: 'tun', rueckfall: false,
  raf: 0, uhr: 0, letztePruefung: 0, letzteSheetPruefung: 0, phaseAb: 0, zeigenAb: 0,
  suchenSeit: 0, hingefuehrt: false, gescrollt: false, daneben: 0, lochStand: '',
  // L1: das gefundene Element (die Texte richten sich danach), die Frage in diesem Schritt,
  // und seit wann ein Sheet den Bildschirm hat — solange läuft die Lesezeit NICHT weiter.
  ankerEl: null, textStand: '', erlaubnisAb: 0, ruhtSeit: 0,
};

export function guideGesehen() {
  return Boolean(lesen(GUIDE_MERKER)?.fassung);
}

/** Merkt vor: Dieser Mensch richtet gerade ein und bekommt danach den Einstieg. */
export function guideFaelligMerken() {
  if (guideGesehen()) return;
  schreiben(GUIDE_FAELLIG, { am: Date.now() });
}

export function guideFaellig() {
  return Boolean(lesen(GUIDE_FAELLIG));
}

export function guideZuruecksetzen() {
  loeschen(GUIDE_MERKER);
}

export function guideOffen() {
  return zustand.offen;
}

/**
 * Deckt der Guide gerade das ganze Bild ab? Nur dann gehören Zurück-Geste und Wisch ihm.
 * Im Live-Modus ist die App bedienbar — dort gehören sie dem echten Bildschirm.
 * (app.js › zurueckMoeglich; solange dort guideOffen() steht, ist das nur strenger, nie falsch.)
 */
export function guideBlockiert() {
  return zustand.offen && zustand.modus === 'karte';
}

function aktuellerSchritt() {
  if (zustand.einzel) return zustand.einzel;
  return SCHRITTE[Math.max(0, Math.min(SCHRITTE.length - 1, zustand.schritt))];
}

function schritteAnzahl() {
  return zustand.einzel ? 1 : SCHRITTE.length;
}

function letzterSchritt() {
  return zustand.schritt >= schritteAnzahl() - 1;
}

// Der Schritt läuft live, solange er ein echtes Element hat und dieses gefunden werden kann.
function liveSchritt() {
  const schritt = aktuellerSchritt();
  return schritt.modus !== 'karte' && !zustand.rueckfall;
}

// --- Fortschritt und der Weg zurück -----------------------------------------------------------
// Die Punkte bleiben ANZEIGE: Ein Sprung nach VORN über einen Punkt würde einen Handgriff
// überspringen, den der Schritt im nächsten Bild sofort wieder einfordert — ein Knopf, der sich
// selbst zurücknimmt (Hausregel 9). Jeder Punkt sagt aber, welcher Schritt gerade gilt
// (aria-current="step"), damit die Vorlesefunktion dasselbe weiß wie das Auge.
//
// Runde 7/Welle 3 — gemessener Mangel: Im Guide gab es GAR KEINEN Weg zurück. Bis Runde 6 waren
// die Punkte Knöpfe und ein Wisch blätterte; beim Umbau auf den Live-Guide fiel beides weg, und
// die zugehörigen Zusicherungen verschwanden aus der Kern-Suite, ohne dass es irgendwo stand.
// Zusammen mit dem ungeduldigen Tipp hieß das: ein Tipp zu viel, und der Schritt samt Frage war
// unwiederbringlich weg. Der Weg zurück ist jetzt ein eigener Knopf (44 × 44) plus ein Wisch
// nach rechts auf der Karte — rückwärts immer, vorwärts nur im Erklärteil.
function fortschritt() {
  if (zustand.einzel) return '';
  const punkte = SCHRITTE.map((_, nr) => {
    const aktiv = nr === zustand.schritt;
    const erledigt = nr < zustand.schritt;
    const farbe = aktiv ? 'var(--green)' : erledigt ? 'var(--green-a40)' : 'var(--ink-a14)';
    return `<span data-role="guide-punkt" data-nr="${nr}"${aktiv ? ' aria-current="step"' : ''} style="width:${aktiv ? 20 : 7}px;height:7px;border-radius:999px;background:${farbe};flex:none;transition:width .24s ${KURVE},background .24s ease"></span>`;
  }).join('');
  return `<span data-role="guide-punkte" role="progressbar" aria-valuemin="1" aria-valuemax="${SCHRITTE.length}" aria-valuenow="${zustand.schritt + 1}" aria-label="${esc(tx('Schritt {n} von {gesamt}', { n: zustand.schritt + 1, gesamt: SCHRITTE.length }))}" style="display:flex;align-items:center;gap:5px">${punkte}</span>`;
}

// Der Knopf steht nur da, wo es wirklich etwas zurückzugehen gibt — auf dem ersten Schritt ist
// „zurück" das Beenden, und dafür gibt es „Überspringen" daneben.
function zurueckKnopf() {
  if (zustand.einzel || zustand.schritt <= 0) return '';
  return `<button data-guide-act="zurueck" data-treffer aria-label="${esc(tx('Zurück'))}" style="flex:none;width:44px;height:44px;margin-left:-11px;display:flex;align-items:center;justify-content:center;padding:0;border:0;background:transparent;color:var(--muted);cursor:pointer;appearance:none;border-radius:999px"><svg width="17" height="17" viewBox="0 0 17 17" fill="none" style="pointer-events:none"><path d="M10.8 3.4 5.6 8.5l5.2 5.1" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"></path></svg></button>`;
}

/** Einen Schritt zurück. Der Schritt davor ist längst getan — er zeigt darum gleich, was er brachte. */
function zurueckGehen() {
  if (zustand.einzel || zustand.schritt <= 0) return false;
  rueckmeldung('tipp');
  schrittBetreten(zustand.schritt - 1);
  return true;
}

// Ein einzelner Hinweis (guideZeigen) ist kein Weg — da gibt es nichts zu überspringen,
// sondern nur etwas zur Kenntnis zu nehmen.
function ueberspringenKnopf() {
  const wort = zustand.einzel ? tx('Alles klar') : tx('Überspringen');
  return `<button data-guide-act="ueberspringen" data-treffer style="min-height:36px;padding:0 4px;border:0;background:transparent;color:var(--muted);font:650 13px/1 ${FONT};cursor:pointer;appearance:none;border-radius:999px"><span style="pointer-events:none">${esc(wort)}</span></button>`;
}

// =============================================================================================
// Live-Modus: Maske, Ring, Karte
// =============================================================================================

// Eigenes Dunkel-Token: --scrim ist im hellen Thema rgba(246,243,238,.26) und lebt vom Blur —
// ohne Blur dimmt das nichts. Und mit Blur kostet jede Nachführung auf dem iPhone ein Bild.
// Die Regeln liegen hier statt in web/styles.css, weil styles.css dem Chef gehört.
const LIVE_CSS = `
[data-ebene="guide-live"]{--guide-dunkel:rgba(10,8,6,.44)}
/* Im dunklen Thema ist der Grund selbst schon fast schwarz — dieselbe Deckkraft dimmt dort
   sichtbar weniger. Deshalb etwas mehr, sonst ist das Loch kaum als Loch zu erkennen. */
:root[data-theme="dark"] [data-ebene="guide-live"]{--guide-dunkel:rgba(0,0,0,.64)}
/* Getrennte Aufgaben, mit Absicht: Die VIER Sperrflächen fangen Berührungen ab (das Loch ist
   dadurch eine echte Lücke im DOM, kein clip-path, auf dessen Trefferprüfung man sich verlassen
   müsste). Gezeichnet wird das Dunkel dagegen von EINEM Knoten, der auf dem Loch liegt und
   seinen Schatten nach außen wirft — nur so hat das Loch runde Ecken statt eines weißen Kastens. */
[data-ebene="guide-live"] [data-role="guide-maske"]{position:absolute;background:transparent;pointer-events:auto;touch-action:none}
[data-ebene="guide-live"] [data-role="guide-dunkel"]{position:absolute;pointer-events:none;opacity:0;transition:opacity .2s ease}
[data-ebene="guide-live"][data-loch="1"] [data-role="guide-dunkel"]{opacity:1}
[data-ebene="guide-live"][data-loch="0"] [data-role="guide-maske"]{pointer-events:none}
[data-ebene="guide-live"][data-ruht="1"]{opacity:0;pointer-events:none}
[data-ebene="guide-live"] [data-role="guide-ring"]{position:absolute;border:2px solid var(--green);pointer-events:none;opacity:0;transition:opacity .2s ease}
[data-ebene="guide-live"][data-loch="1"] [data-role="guide-ring"]{opacity:1;animation:guideRing 2.4s ease-in-out infinite}
[data-ebene="guide-live"] [data-role="guide-karte"][data-eng="1"] [data-role="guide-satz"]{display:none}
[data-ebene="guide-live"] [data-role="guide-karte"] button:focus{outline:none}
[data-ebene="guide-live"] [data-role="guide-karte"] button:focus-visible{outline:2px solid var(--green);outline-offset:2px}
@keyframes guideRing{0%,100%{box-shadow:0 0 0 3px var(--green-a22)}50%{box-shadow:0 0 0 9px var(--green-a12)}}
@media (prefers-reduced-motion: reduce){[data-ebene="guide-live"] [data-role="guide-ring"]{animation:none}}
`;

function liveGeruest(knoten) {
  const maske = (seite) => `<div data-role="guide-maske" data-seite="${seite}"></div>`;
  knoten.innerHTML = `<style>${LIVE_CSS}</style>
<div data-role="guide-dunkel" aria-hidden="true"></div>
${maske('oben')}${maske('unten')}${maske('links')}${maske('rechts')}
<div data-role="guide-ring" aria-hidden="true"></div>
<div data-role="guide-karte" role="dialog" aria-modal="false" style="position:absolute;left:12px;right:12px;bottom:12px;box-sizing:border-box;background:var(--surface);border-radius:22px;box-shadow:0 10px 30px var(--shadow-20);border:1px solid var(--ink-a09);padding:12px 15px 14px;display:flex;flex-direction:column;gap:7px;pointer-events:auto;font-family:${FONT};color:var(--ink)"></div>`;
  knoten.dataset.loch = '0';
}

/**
 * Die ruhige Zeile unter dem Satz: was mit der Erlaubnis JETZT gilt (L1). Kein zweiter Knopf —
 * gefragt wird einmal im Sheet; hier steht danach nur noch die Wahrheit. Und wenn gar nicht
 * gefragt werden kann, steht hier der Grund, statt dass die Stelle so tut, als ginge es.
 */
function erlaubnisZeile(art, ctx) {
  if (!art) return '';
  const lage = erlaubnisLage(art);
  const texte = texteFuer(art);
  const spaeter = erlaubnisEintrag(art)?.ergebnis === 'spaeter';
  const vomSystem = istApple() ? texte.fehltApple : texte.fehltSonst;
  let satz = '';
  let gut = false;
  if (art === 'mitteilungen') {
    const push = pushLage(ctx?.repo);
    if (lage === 'erteilt' || push === 'an') { satz = tx('Mitteilungen sind an.'); gut = true; }
    else if (push === 'konto') satz = tx('Im Demo-Modus gibt es keine Mitteilungen — es gibt niemanden, der etwas schicken könnte.');
    else if (push === 'homescreen') satz = tx('Auf dem iPhone kommen Mitteilungen erst, wenn Crew auf dem Home-Bildschirm liegt.');
    else if (lage === 'unmoeglich' || push === 'unmoeglich') satz = tx('Dieses Gerät kann das nicht.');
    else if (lage === 'abgelehnt') satz = spaeter ? tx('Gut — du siehst es dann, wenn du die App öffnest.') : vomSystem;
  } else {
    if (lage === 'erteilt') { satz = tx('Standort ist an.'); gut = true; }
    else if (lage === 'unmoeglich') satz = tx('Dieses Gerät kann das nicht.');
    else if (lage === 'abgelehnt') satz = spaeter ? tx('Gut — die Karte zeigt dann nur, wo deine Freunde sind, nicht wo du bist.') : vomSystem;
  }
  if (!satz) return '';
  return `<span data-role="guide-erlaubnis" data-art="${esc(art)}" data-lage="${esc(lage)}" style="font-size:12px;line-height:1.4;font-weight:${gut ? 650 : 500};color:var(--${gut ? 'green-dark' : 'muted'})">${esc(satz)}</span>`;
}

// Der Satz steht auch im aria-label: Wird die Karte eng (data-eng), verschwindet er sichtbar,
// aber nicht für die Vorlesefunktion.
function liveKarteZeichnen() {
  const karte = zustand.knoten?.querySelector('[data-role="guide-karte"]');
  if (!karte) return;
  const schritt = aktuellerSchritt();
  const zeigt = zustand.phase === 'zeigen' && schritt.zeigen;
  const teil = zeigt ? schritt.zeigen : schritt;
  // Die Texte bekommen das GEFUNDENE Element: der Satz richtet sich nach dem, was dort steht.
  const titel = teil.titel(zustand.ankerEl);
  const satz = teil.satz(zustand.ankerEl);
  const balken = zustand.phase === 'zeigen'
    ? `<span data-role="guide-lauf" style="height:3px;border-radius:2px;background:var(--ink-a09);overflow:hidden;margin-top:2px"><span data-role="guide-lauf-fuellung" style="display:block;height:100%;width:0;border-radius:2px;background:var(--green)"></span></span>`
    : '';
  const erlaubnis = zeigt ? erlaubnisZeile(teil.erlaubnis, zustand.ctx) : '';
  zustand.textStand = `${titel}|${satz}|${erlaubnis}`;
  karte.dataset.phase = zustand.phase;
  karte.dataset.schritt = String(zustand.schritt);
  karte.dataset.karte = schritt.id;
  karte.setAttribute('aria-label', `${titel}. ${satz}`);
  karte.innerHTML = `<span style="display:flex;align-items:center;gap:10px;min-height:44px">${zurueckKnopf()}${fortschritt()}<span style="flex:1"></span>${ueberspringenKnopf()}</span>
<span data-role="guide-titel" style="font-family:${TITEL_FONT};font-size:18.5px;font-weight:650;letter-spacing:-.02em;line-height:1.22">${esc(titel)}</span>
<span data-role="guide-satz" style="font-size:13.5px;line-height:1.45;color:var(--ink-soft)">${esc(satz)}</span>
${erlaubnis}
${balken}`;
}

// Hat sich der Text geändert (anderes Element gefunden, Erlaubnis beantwortet), wird die Karte
// neu gezeichnet — und der Laufbalken dort fortgesetzt, wo er stand, statt von vorn zu beginnen.
function karteAuffrischen() {
  if (!zustand.knoten || !liveSchritt()) return;
  const schritt = aktuellerSchritt();
  const zeigt = zustand.phase === 'zeigen' && schritt.zeigen;
  const teil = zeigt ? schritt.zeigen : schritt;
  const stand = `${teil.titel(zustand.ankerEl)}|${teil.satz(zustand.ankerEl)}|${zeigt ? erlaubnisZeile(teil.erlaubnis, zustand.ctx) : ''}`;
  if (stand === zustand.textStand) return;
  liveKarteZeichnen();
  zustand.lochStand = '';       // die Karte ist jetzt anders hoch: Platz neu rechnen
  balkenFortsetzen();
}

function balkenFortsetzen() {
  if (zustand.phase !== 'zeigen' || !zustand.zeigenAb) return;
  const dauer = aktuellerSchritt().zeigen?.dauer || ZEIGEN_MS;
  const gelaufen = Math.min(dauer, Math.max(0, Date.now() - zustand.zeigenAb));
  laufBalken(dauer - gelaufen, gelaufen / dauer);
}

// Nur der Hinweis „daneben" tauscht eine Zeile — kein Neuaufbau, sonst flackert die Karte.
function danebenGetippt() {
  const karte = zustand.knoten?.querySelector('[data-role="guide-karte"]');
  if (!karte || zustand.phase !== 'tun') return;
  zustand.daneben += 1;
  rueckmeldung('schliessen');
  const satz = karte.querySelector('[data-role="guide-satz"]');
  const schritt = aktuellerSchritt();
  if (satz) {
    satz.textContent = tx('Tipp auf die helle Stelle.');
    clearTimeout(zustand.uhr);
    zustand.uhr = setTimeout(() => {
      if (zustand.phase === 'tun' && satz.isConnected) satz.textContent = schritt.satz();
    }, 1600);
  }
  // Zweimal daneben heißt: Dieser Mensch will gerade etwas anderes. Der Ausgang wird sichtbar.
  // INLINE gesetzt, nicht über eine CSS-Regel: Der Knopf trägt seine Farben selbst inline, und
  // inline schlägt jeden Selektor. Bis Runde 7/Welle 1 wurde nur data-hinweis gesetzt — gemessen
  // war die Farbe vorher wie nachher, die Zusage war tot.
  if (zustand.daneben >= 2) {
    const aus = karte.querySelector('[data-guide-act="ueberspringen"]');
    if (aus) {
      aus.setAttribute('data-hinweis', '1');
      aus.style.background = 'var(--green-tint)';
      aus.style.color = 'var(--green-dark)';
      aus.style.padding = '0 13px';
    }
  }
}

// --- Anker finden ------------------------------------------------------------------------------

function brauchbar(el, rahmen) {
  if (!el || typeof el.getBoundingClientRect !== 'function') return false;
  // Weder die eigene Ebene noch das Depot, eine abziehende Seite oder das Gleit-Abbild.
  if (el.closest('.p5-ebene, .tab-depot, .gleit-ebene, [data-exit], .tab-page[data-role="incoming"], .tab-page[data-role^="passing"]')) return false;
  const r = el.getBoundingClientRect();
  if (r.width < 6 || r.height < 6) return false;
  return r.bottom > rahmen.top && r.top < rahmen.bottom && r.right > rahmen.left && r.left < rahmen.right;
}

function ankerVon(spez) {
  const knoten = zustand.knoten;
  if (!spez || !knoten) return null;
  const wurzel = globalThis.document?.querySelector('#app > .runtime-shell:not(.gleit-ebene)');
  if (!wurzel) return null;
  const rahmen = knoten.getBoundingClientRect();
  for (const sel of spez.sel) {
    for (const el of wurzel.querySelectorAll(sel)) {
      if (!brauchbar(el, rahmen)) continue;
      let ziel = el;
      for (let i = 0; i < (spez.auf || 0); i += 1) {
        const eltern = ziel.parentElement;
        if (!eltern || eltern === wurzel) break;
        ziel = eltern;
      }
      // Zu weit hinaufgeklettert (fremdes Markup kann sich ändern): dann lieber das Element
      // selbst hervorheben als die halbe Seite.
      const r = ziel.getBoundingClientRect();
      if (r.height > rahmen.height * 0.55 || r.width > rahmen.width * 0.98) ziel = el;
      return ziel;
    }
  }
  return null;
}

function aktuelleSpez() {
  const schritt = aktuellerSchritt();
  return zustand.phase === 'zeigen' ? (schritt.zeigen || null) : (schritt.anker || null);
}

// --- Loch messen und nachführen ----------------------------------------------------------------

function lochAus() {
  const knoten = zustand.knoten;
  if (!knoten || knoten.dataset.loch === '0') return;
  knoten.dataset.loch = '0';
  zustand.lochStand = '';
  liveKarteStellen(null);
}

function lochSetzen(loch, form) {
  const knoten = zustand.knoten;
  if (!knoten) return;
  const rahmen = knoten.getBoundingClientRect();
  const stelle = (seite, stil) => {
    const el = knoten.querySelector(`[data-role="guide-maske"][data-seite="${seite}"]`);
    if (el) el.style.cssText = `position:absolute;${stil}`;
  };
  const u = Math.max(0, rahmen.height - (loch.o + loch.h));
  const r = Math.max(0, rahmen.width - (loch.l + loch.b));
  stelle('oben', `left:0;right:0;top:0;height:${Math.max(0, loch.o)}px`);
  stelle('unten', `left:0;right:0;bottom:0;height:${u}px`);
  stelle('links', `left:0;top:${loch.o}px;height:${loch.h}px;width:${Math.max(0, loch.l)}px`);
  stelle('rechts', `right:0;top:${loch.o}px;height:${loch.h}px;width:${r}px`);
  const radius = form === 'kasten' ? 18 : loch.h / 2;
  const ring = knoten.querySelector('[data-role="guide-ring"]');
  if (ring) ring.style.cssText = `position:absolute;left:${loch.l}px;top:${loch.o}px;width:${loch.b}px;height:${loch.h}px;border-radius:${radius}px;box-sizing:border-box`;
  // Der Schatten deckt alles außerhalb des Lochs ab. Die Streuung wird auf den Rahmen gerechnet
  // statt auf einen Fantasiewert wie 9999px — ein riesiger Schatten kostet auf dem Telefon in
  // JEDEM Bild der Nachführung Rechenzeit.
  const streuung = Math.ceil(Math.max(rahmen.width, rahmen.height));
  const dunkel = knoten.querySelector('[data-role="guide-dunkel"]');
  if (dunkel) dunkel.style.cssText = `position:absolute;left:${loch.l}px;top:${loch.o}px;width:${loch.b}px;height:${loch.h}px;border-radius:${radius}px;box-shadow:0 0 0 ${streuung}px var(--guide-dunkel)`;
  knoten.dataset.loch = '1';
}

// Liegt die Lochmitte unten, steht die Karte oben — und nie über dem Loch. Gemessen wird gegen
// die EBENE, nicht gegen window.innerHeight: auf dem Schreibtisch ist der Rahmen 390×844.
function liveKarteStellen(loch) {
  const knoten = zustand.knoten;
  const karte = knoten?.querySelector('[data-role="guide-karte"]');
  if (!karte) return;
  const rahmen = knoten.getBoundingClientRect();
  const hoehe = karte.offsetHeight || 120;
  const rand = 12;
  const platzOben = loch ? loch.o - rand : rahmen.height;
  const platzUnten = loch ? rahmen.height - (loch.o + loch.h) - rand : rahmen.height;
  const mitte = loch ? loch.o + loch.h / 2 : rahmen.height * 0.75;
  let lage = mitte > rahmen.height / 2 ? 'oben' : 'unten';
  if (lage === 'oben' && platzOben < hoehe + rand && platzUnten >= hoehe + rand) lage = 'unten';
  else if (lage === 'unten' && platzUnten < hoehe + rand && platzOben >= hoehe + rand) lage = 'oben';
  const platz = lage === 'oben' ? platzOben : platzUnten;
  karte.dataset.eng = platz < hoehe + rand ? '1' : '0';
  karte.dataset.lage = lage;
  if (lage === 'oben') {
    karte.style.top = `calc(env(safe-area-inset-top, 0px) + ${rand}px)`;
    karte.style.bottom = 'auto';
  } else {
    karte.style.bottom = `calc(env(safe-area-inset-bottom, 0px) + ${rand}px)`;
    karte.style.top = 'auto';
  }
}

function inSichtHolen(el, rahmen) {
  if (zustand.gescrollt) return;
  const r = el.getBoundingClientRect();
  if (r.top >= rahmen.top + 60 && r.bottom <= rahmen.bottom - 60) return;
  zustand.gescrollt = true;
  try { el.scrollIntoView({ block: 'center', behavior: reduziert() ? 'auto' : 'smooth' }); } catch { el.scrollIntoView(); }
}

function lochNachfuehren() {
  const knoten = zustand.knoten;
  if (!knoten) return;
  const spez = aktuelleSpez();
  const el = spez ? ankerVon(spez) : null;
  if (el !== zustand.ankerEl) {
    zustand.ankerEl = el;
    if (spez?.dynamisch) karteAuffrischen();
  }
  if (!el) {
    lochAus();
    if (!zustand.suchenSeit) zustand.suchenSeit = Date.now();
    const gewartet = Date.now() - zustand.suchenSeit;
    // Ein einzelner Hinweis (guideZeigen) hat nur den Erklärteil — für ihn gelten beide Stufen
    // trotzdem, sonst stünde bei „Zeig mir wo" eine Karte über einer Seite, auf der die gezeigte
    // Sache gar nicht vorkommt (gemessen in Welle 1, shots/r7-pruef-10-…).
    const notfall = zustand.phase === 'tun' || Boolean(zustand.einzel);
    // 1. hinführen — der Handgriff liegt in einem anderen Bereich (nach dem Einrichten landet
    //    man je nach Weg auf profile.friendAdd oder in einem Raum, nicht auf crew.home).
    if (!zustand.hingefuehrt && gewartet > SUCHE_HINFUEHREN_MS && notfall) {
      zustand.hingefuehrt = true;
      const ort = aktuellerSchritt().ort;
      if (ort) zustand.ctx?.nav?.setTab?.(ort);
    }
    // 2. Rückfall auf die gezeichnete Karte — im Erklärteil des Weges nicht: dort ist ein
    //    fehlender Anker keine Störung, sondern nur eine Stelle, die dieses Konto noch nicht hat
    //    (z. B. „+ Meet" ohne einen einzigen Freund). Dann bleibt der Satz stehen, ohne Loch.
    if (gewartet > SUCHE_RUECKFALL_MS && notfall) rueckfallZeigen();
    return;
  }
  zustand.suchenSeit = 0;
  const rahmen = knoten.getBoundingClientRect();
  inSichtHolen(el, rahmen);
  const r = el.getBoundingClientRect();
  const luft = spez.luft ?? LIVE_LUFT;
  const o = Math.max(0, Math.round(r.top - rahmen.top - luft));
  const l = Math.max(0, Math.round(r.left - rahmen.left - luft));
  const b = Math.min(Math.round(r.width + luft * 2), Math.round(rahmen.width) - l);
  const h = Math.min(Math.round(r.height + luft * 2), Math.round(rahmen.height) - o);
  const stand = `${o}|${l}|${b}|${h}|${spez.form || ''}`;
  if (stand === zustand.lochStand) return;
  zustand.lochStand = stand;
  const loch = { o, l, b, h };
  lochSetzen(loch, spez.form);
  liveKarteStellen(loch);
}

// --- Schleife -----------------------------------------------------------------------------------

function schleife() {
  if (!zustand.offen || !liveSchritt()) { zustand.raf = 0; return; }
  zustand.raf = requestAnimationFrame(schleife);
  const knoten = zustand.knoten;
  if (!knoten) return;
  const jetzt = Date.now();
  // Liegt ein Sheet über der Seite, gehört der Bildschirm dem Sheet. Der Schritt pausiert und
  // lebt weiter, sobald es zu ist — kein Loch ins Leere, kein zweiter Schleier.
  // offenesSheet() misst berechnete Stile über die ganze Seite: das gehört NICHT in jedes Bild.
  if (jetzt - zustand.letzteSheetPruefung > 250) {
    zustand.letzteSheetPruefung = jetzt;
    const ruht = Boolean(offenesSheet(globalThis.document?.body || undefined));
    if (ruht !== (knoten.dataset.ruht === '1')) {
      knoten.dataset.ruht = ruht ? '1' : '0';
      zustand.lochStand = '';
      // Die Lesezeit läuft NICHT weiter, während ein Sheet den Bildschirm hat — sonst wäre der
      // Schritt vorbei, kaum dass das Erlaubnis-Sheet zu ist, und niemand hätte ihn gelesen.
      if (ruht) zustand.ruhtSeit = jetzt;
      else if (zustand.ruhtSeit) {
        if (zustand.zeigenAb) zustand.zeigenAb += jetzt - zustand.ruhtSeit;
        zustand.ruhtSeit = 0;
        balkenFortsetzen();
      }
    }
  }
  if (knoten.dataset.ruht === '1') return;
  lochNachfuehren();
  if (zustand.phase === 'tun') {
    if (jetzt - zustand.letztePruefung < PRUEF_MS) return;
    zustand.letztePruefung = jetzt;
    const schritt = aktuellerSchritt();
    if (typeof schritt.erledigt === 'function' && schritt.erledigt(zustand.ctx)) geschafft();
    return;
  }
  if (zustand.phase === 'zeigen') {
    const teil = aktuellerSchritt().zeigen;
    if (!zustand.zeigenAb) {
      const bereit = knoten.dataset.loch === '1' || jetzt - zustand.phaseAb > ZEIGEN_ANLAUF_MS;
      if (!bereit) return;
      zustand.zeigenAb = jetzt;
      laufBalken(teil?.dauer || ZEIGEN_MS);
      return;
    }
    // L1: Erst sieht der Mensch, wozu es dient — dann wird gefragt. Einmal je Schritt.
    if (teil?.erlaubnis && !zustand.erlaubnisAb && jetzt - zustand.zeigenAb >= ERLAUBNIS_VERZUG) {
      zustand.erlaubnisAb = jetzt;
      erlaubnisImSchritt(teil.erlaubnis);
      return;
    }
    if (jetzt - zustand.zeigenAb >= (teil?.dauer || ZEIGEN_MS)) weiterSchalten();
  }
}

// Die Frage MITTEN im Schritt: Das Sheet legt sich über die Stelle, die gerade erklärt wurde,
// der Guide ruht solange (offenesSheet). Danach bekommt der Schritt seine Lesezeit neu — mit
// der Zeile, die sagt, was jetzt gilt. Kann hier gar nicht gefragt werden, wird nicht gefragt,
// sondern nur gesagt, warum (Hausregel 9).
function erlaubnisImSchritt(art) {
  const ctx = zustand.ctx;
  if (!erlaubnisFragbar(art, ctx)) { karteAuffrischen(); return; }
  erlaubnisHolen(ctx, art).then(() => {
    if (!zustand.offen || zustand.phase !== 'zeigen') return;
    zustand.zeigenAb = Date.now();
    liveKarteZeichnen();
    zustand.lochStand = '';
    balkenFortsetzen();
  });
}

function laufBalken(dauer, ab = 0) {
  const fuellung = zustand.knoten?.querySelector('[data-role="guide-lauf-fuellung"]');
  if (!fuellung) return;
  const anfang = `${Math.round(Math.min(1, Math.max(0, ab)) * 100)}%`;
  if (typeof fuellung.animate !== 'function' || reduziert()) { fuellung.style.width = '100%'; return; }
  fuellung.animate([{ width: anfang }, { width: '100%' }], { duration: Math.max(0, dauer), easing: 'linear', fill: 'forwards' });
}

function schleifeStarten() {
  if (zustand.raf || !liveSchritt()) return;
  zustand.raf = requestAnimationFrame(schleife);
}

// --- Schritte ------------------------------------------------------------------------------------

function phaseSetzen(phase) {
  zustand.phase = phase;
  zustand.phaseAb = Date.now();
  zustand.zeigenAb = 0;
  zustand.erlaubnisAb = 0;
  zustand.ruhtSeit = 0;
  zustand.ankerEl = null;
  zustand.gescrollt = false;
  zustand.lochStand = '';
  liveKarteZeichnen();
  liveKarteStellen(null);
  lochNachfuehren();
}

function geschafft() {
  const schritt = aktuellerSchritt();
  rueckmeldung('erfolg');
  if (!schritt.zeigen) { weiterSchalten(); return; }
  phaseSetzen('zeigen');
}

function weiterSchalten() {
  if (letzterSchritt()) { guideBeenden('fertig'); return; }
  schrittBetreten(zustand.schritt + 1);
}

/**
 * Was ein Tipp (oder ein Wisch nach links) IM ERKLÄRTEIL bewirkt.
 *
 * Runde 7/Welle 3 — gemessener Mangel: Vorher schaltete jeder Tipp sofort weiter („wer schneller
 * liest, wartet nicht"), die Frage kam aber erst ERLAUBNIS_VERZUG nach dem Loch. Der Seitenwechsel
 * nach dem Handgriff dauert rund 500 ms, in denen sichtbar nichts passiert — ein zweiter Tipp ist
 * genau die natürliche Reaktion darauf, und er hat die Standort-Frage ersatzlos verschluckt
 * (gemessen: zweimal auf den Karten-Knopf im Abstand von 0,5 s → Schritt 2, kein Sheet).
 *
 * Jetzt heißt der ungeduldige Tipp: „ich habe gelesen" — er HOLT die Frage dieses Schrittes VOR,
 * statt sie zu überspringen. Erst der Tipp DANACH blättert weiter. Wo gar nicht gefragt werden
 * kann (Demo-Bestand, abgelehnt, Gerät kann es nicht), steht der Grund schon in der Karte, und
 * der Tipp blättert wie bisher sofort weiter — ein Tipp, der nichts tut, wäre schlimmer.
 */
function zeigenWeiter() {
  const teil = aktuellerSchritt().zeigen;
  rueckmeldung('tipp');
  if (teil?.erlaubnis && !zustand.erlaubnisAb && erlaubnisFragbar(teil.erlaubnis, zustand.ctx)) {
    zustand.erlaubnisAb = Date.now();
    erlaubnisImSchritt(teil.erlaubnis);
    return true;
  }
  weiterSchalten();
  return true;
}

function schrittBetreten(nr) {
  zustand.schritt = Math.max(0, Math.min(schritteAnzahl() - 1, nr));
  zustand.rueckfall = false;
  zustand.daneben = 0;
  zustand.hingefuehrt = false;
  zustand.suchenSeit = 0;
  zustand.letztePruefung = 0;
  clearTimeout(zustand.uhr);
  const schritt = aktuellerSchritt();
  if (schritt.modus === 'karte') { modusSetzen('karte'); return; }
  modusSetzen('live');
  // Liegt der Handgriff in einem anderen Bereich, wird EINMAL hingeführt — sonst sucht die
  // Maske ein Element, das auf dieser Seite gar nicht vorkommt.
  const ort = schritt.ort;
  if (ort && zustand.ctx?.nav?.current) {
    const jetzt = zustand.ctx.nav.current().id;
    if (jetzt !== TAB_ROUTE[ort] && !ankerVon(schritt.anker)) {
      zustand.hingefuehrt = true;
      zustand.ctx.nav.setTab?.(ort);
    }
  }
  // Schon getan (Wiederholung aus den Einstellungen, FREE steht bereits): dann wird nicht
  // verlangt, es noch einmal zu tun — der Schritt zeigt gleich, was dahintersteckt.
  const fertig = typeof schritt.erledigt === 'function' && schritt.erledigt(zustand.ctx);
  phaseSetzen(fertig && schritt.zeigen ? 'zeigen' : 'tun');
  schleifeStarten();
}

// Kein Anker, auch nach dem Hinführen nicht: dann die gezeichnete Karte — derselbe Titel,
// derselbe Satz, ein Bild und ein ehrliches „Weiter". Lieber ein sauberes Bild als ein Loch
// ins Leere.
function rueckfallZeigen() {
  if (zustand.rueckfall) return;
  zustand.rueckfall = true;
  modusSetzen('karte');
}

// =============================================================================================
// Karten-Modus — nur noch der Rückfall
// ---------------------------------------------------------------------------------------------
// Findet ein Schritt sein echtes Bedienelement auch nach dem Hinführen nicht, wird daraus kein
// Loch ins Leere, sondern eine ehrliche gezeichnete Karte: dasselbe Bild, derselbe Titel,
// derselbe Satz, ein Knopf. Die frühere fünfte Karte („Mitteilungen erlauben") gibt es nicht
// mehr — gefragt wird dort, wo man sieht, worum es geht (SCHRITTE › zeigen.erlaubnis).
// =============================================================================================

function karteMarkup() {
  const schritt = aktuellerSchritt();
  const letzte = letzterSchritt();
  const haupttext = letzte
    ? (zustand.einzel ? tx('Alles klar') : zustand.wiederholung ? tx('Fertig') : tx('Los geht’s'))
    : tx('Weiter');
  const ueberspringen = letzte ? '' : ueberspringenKnopf();

  return `<div data-role="guide" data-schritt="${zustand.schritt}" data-karte="${esc(schritt.id)}" data-rueckfall="${zustand.rueckfall ? '1' : '0'}" role="dialog" aria-modal="true" aria-label="${esc(tx('Kurzer Einstieg'))}" style="position:absolute;inset:0;display:flex;flex-direction:column;background:var(--paper);color:var(--ink);font-family:${FONT};padding:calc(env(safe-area-inset-top, 0px) + 10px) 22px calc(env(safe-area-inset-bottom, 0px) + 24px);box-sizing:border-box;border-radius:inherit;overflow:hidden">
<span style="display:flex;align-items:center;gap:10px;flex:none;min-height:44px">${zurueckKnopf()}<span style="flex:1"></span>${ueberspringen}</span>
<span data-role="guide-inhalt" style="flex:1;min-height:0;display:flex;flex-direction:column;justify-content:center;gap:24px;padding-bottom:10px">
<span data-role="guide-bild" style="flex:0 1 auto;min-height:150px;max-height:320px;margin:0 -22px;display:flex;align-items:center;justify-content:center">${guideBild(schritt.bild, { hoehe: '100%' })}</span>
<span data-role="guide-text" style="display:flex;flex-direction:column;align-items:center;gap:8px;flex:none;text-align:center">
<span data-role="guide-titel" style="font-family:${TITEL_FONT};font-size:23px;font-weight:650;letter-spacing:-.025em;line-height:1.2;color:var(--ink)">${esc(schritt.titel())}</span>
<span data-role="guide-satz" style="font-size:15px;line-height:1.5;color:var(--ink-soft);max-width:300px">${esc(schritt.satz())}</span>
</span>
</span>
<span style="display:flex;flex-direction:column;align-items:center;gap:14px;flex:none">
${fortschritt()}
<button data-guide-act="weiter" data-treffer style="width:100%;min-height:52px;border:0;border-radius:999px;background:var(--green);color:var(--on-accent);font:650 15.5px/1 ${FONT};cursor:pointer;appearance:none;box-shadow:0 2px 10px var(--green-a26)"><span style="pointer-events:none">${esc(haupttext)}</span></button>
</span>
</div>`;
}

function karteZeichnen() {
  const knoten = zustand.knoten;
  if (!knoten) return;
  knoten.innerHTML = karteMarkup();
  const inhalt = knoten.querySelector('[data-role="guide-inhalt"]');
  if (inhalt && typeof inhalt.animate === 'function' && !reduziert()) {
    inhalt.animate([{ opacity: 0, transform: 'translateX(20px)' }, { opacity: 1, transform: 'none' }], { duration: WECHSEL_MS, easing: KURVE });
  }
}

function karteWeiter() {
  if (!letzterSchritt()) { weiterSchalten(); return; }
  rueckmeldung('erfolg');
  guideBeenden('fertig');
}

// =============================================================================================
// Ebene wechseln, binden, beenden
// =============================================================================================

// Es darf immer nur EINE Guide-Ebene im Rahmen hängen: Der Wächter (wachtPruefen) hängt jede
// registrierte Ebene wieder ein — zwei offene wären ein sichtbarer Fehler.
function modusSetzen(modus) {
  const alt = zustand.knoten;
  const gleich = zustand.modus === modus && alt?.isConnected;
  zustand.modus = modus;
  if (gleich) { if (modus === 'karte') karteZeichnen(); return; }
  const knoten = ebeneAnlegen(modus === 'live' ? 'guide-live' : 'guide');
  if (!knoten) return;
  zustand.knoten = knoten;
  knoten.dataset.grund = zustand.grund || (zustand.wiederholung ? 'wiederholung' : 'erststart');
  if (modus === 'live') {
    // Die Ebene selbst lässt alles durch; styles.css setzt .p5-ebene auf touch-action:none,
    // hier muss die Seite darunter aber wischen und scrollen können.
    knoten.style.pointerEvents = 'none';
    knoten.style.touchAction = 'auto';
    liveGeruest(knoten);
    liveKarteZeichnen();
  } else {
    knoten.style.pointerEvents = '';
    knoten.style.touchAction = '';
    karteZeichnen();
    if (zustand.raf) { cancelAnimationFrame(zustand.raf); zustand.raf = 0; }
  }
  guideBinden(knoten);
  // SOFORT, nicht ausgeblendet: Zwei Guide-Ebenen gleichzeitig im Rahmen wären ein sichtbarer
  // Fehler — und alles, was „den Guide" sucht (Prüfläufe, update-info.js), fände für ein paar
  // Bilder die falsche. Die neue Ebene blendet ohnehin auf.
  if (alt && alt !== zustand.knoten) ebeneSchliessen(alt, { sofort: true });
  if (typeof knoten.animate === 'function' && !reduziert()) {
    knoten.animate([{ opacity: 0 }, { opacity: 1 }], { duration: 200, easing: 'ease-out' });
  }
  if (modus === 'live') schleifeStarten();
}

function guideBinden(knoten) {
  if (knoten.__guideGebunden) return;
  knoten.__guideGebunden = true;
  knoten.addEventListener('click', (ereignis) => {
    const ziel = ereignis.target.closest?.('[data-guide-act]');
    if (ziel && knoten.contains(ziel)) {
      ereignis.preventDefault();
      ereignis.stopPropagation();
      const was = ziel.dataset.guideAct;
      if (was === 'weiter') karteWeiter();
      else if (was === 'zurueck') zurueckGehen();
      else if (was === 'ueberspringen') { rueckmeldung('schliessen'); guideBeenden('uebersprungen'); }
      else if (was === 'fertig') { rueckmeldung('tipp'); guideBeenden('spaeter'); }
      return;
    }
    if (zustand.modus !== 'live') return;
    // Im Erklärteil führt ein Tipp irgendwohin weiter — aber nie an der Frage dieses Schrittes
    // vorbei (zeigenWeiter), und nie mit dem Tipp, der den Erklärteil gerade aufgeschlagen hat.
    //
    // GEMESSEN (Welle 3): touchstart/touchend auf #free-button, und 4 ms nach dem Loslassen ein
    // click auf [data-role="guide-maske"] — der 120-ms-Takt hatte in der Zwischenzeit auf
    // 'zeigen' geschaltet und die Sperrflächen neu unter den Finger gelegt. Dieser Klick wurde
    // als „gelesen, weiter" gewertet; weil 'mitteilungen' im Demo-Bestand nicht fragbar ist,
    // blätterte zeigenWeiter() sofort weiter. In 2 von 3 Läufen war der Erklärteil von Schritt 1
    // damit ohne einen einzigen zusätzlichen Tipp weg — niemand las „Deine Freunde sehen es
    // sofort", niemand die ehrliche Demo-Zeile.
    //
    // Der Riegel ist die Vorgeschichte des Tipps, keine Karenzzeit: Ein Tipp, dessen Berührung
    // VOR dem Phasenwechsel begann, hat den Erklärteil nie gesehen. Ein Tipp danach schon — der
    // wirkt sofort, auch nach 50 ms. Der Guide wird davon nicht zäh.
    if (zustand.phase === 'zeigen') {
      if (tippBeginn(ereignis) < zustand.phaseAb) return;
      zeigenWeiter();
      return;
    }
    // Ein Tipp auf die Maske beendet NICHTS. Er sagt einmal, wo es langgeht.
    if (ereignis.target.closest?.('[data-role="guide-maske"]')) danebenGetippt();
  });

  // Wischen auf der KARTE des Guides — nicht auf der Ebene: Im Live-Modus gehören Wische der
  // App darunter (Tab-Bahn, Listen). Die Karte ist die eine Fläche, die dem Guide gehört.
  // Rechts = zurück, immer. Links = vorwärts, aber NUR im Erklärteil: nach vorn zu wischen, ohne
  // den Handgriff getan zu haben, hieße einen Schritt zu überspringen, den die App im nächsten
  // Bild wieder einfordert.
  let wischAb = null;
  const griff = (ereignis) => ereignis.touches?.[0] || ereignis.changedTouches?.[0] || null;
  knoten.addEventListener('touchstart', (ereignis) => {
    const flaeche = ereignis.target.closest?.('[data-role="guide-karte"], [data-role="guide"]');
    const punkt = flaeche ? griff(ereignis) : null;
    wischAb = punkt ? { x: punkt.clientX, y: punkt.clientY, am: Date.now() } : null;
  }, { passive: true });
  // Der letzte Punkt der BEWEGUNG zählt. Manche Ereignisquellen (und jeder Prüflauf, der über
  // CDP tippt) schicken beim Loslassen keine changedTouches mehr mit — dann wäre ein Wisch nach
  // dem Loslassen nicht mehr messbar, obwohl der Finger die ganze Strecke gegangen ist.
  knoten.addEventListener('touchmove', (ereignis) => {
    const punkt = wischAb ? griff(ereignis) : null;
    if (punkt) { wischAb.zuletztX = punkt.clientX; wischAb.zuletztY = punkt.clientY; }
  }, { passive: true });
  knoten.addEventListener('touchend', (ereignis) => {
    const ab = wischAb;
    wischAb = null;
    if (!ab) return;
    const punkt = griff(ereignis)
      || (Number.isFinite(ab.zuletztX) ? { clientX: ab.zuletztX, clientY: ab.zuletztY } : null);
    if (!punkt) return;
    const dx = punkt.clientX - ab.x;
    const dy = punkt.clientY - ab.y;
    // Schräg ist kein Wisch, langsam auch nicht: sonst wird jedes Verrutschen zum Blättern.
    if (Math.abs(dx) < 48 || Math.abs(dx) < Math.abs(dy) * 1.5 || Date.now() - ab.am > 900) return;
    if (dx > 0) { zurueckGehen(); return; }
    if (zustand.modus === 'live' && zustand.phase === 'zeigen') zeigenWeiter();
  }, { passive: true });
}

if (globalThis.document?.addEventListener) {
  globalThis.document.addEventListener('keydown', (ereignis) => {
    if (!zustand.offen) return;
    if (ereignis.key === 'Escape') { ereignis.preventDefault(); guideBeenden('uebersprungen'); }
  });
}

function guideBeenden(grund = 'fertig') {
  if (!zustand.offen) return;
  zustand.offen = false;
  if (zustand.raf) { cancelAnimationFrame(zustand.raf); zustand.raf = 0; }
  clearTimeout(zustand.uhr);
  // Ein einzelner Hinweis (guideZeigen) ist nicht der Einstieg: Er darf ihn nicht als
  // „gesehen" abhaken, sonst bekaeme ein neuer Mensch nach einer Update-Info nie den Guide.
  const einzel = Boolean(zustand.einzel);
  zustand.einzel = null;
  if (!einzel) schreiben(GUIDE_MERKER, { fassung: GUIDE_FASSUNG, am: Date.now(), grund });
  const knoten = zustand.knoten;
  zustand.knoten = null;
  const ctx = zustand.ctx;
  const loesen = zustand.loesen;
  zustand.loesen = null;
  // Wer den ganzen Weg gegangen ist, steht am Ende im Profil — da ist er nur hingeschickt
  // worden. Zum Schluss geht es dorthin zurück, wo die Frage „kann ich jetzt etwas machen"
  // beantwortet wird (core/router.js › TAB_ORDER: Crew steht zuerst). Beim Überspringen NICHT:
  // dann wollte der Mensch gerade etwas anderes tun.
  const zurueckZuCrew = !einzel && (grund === 'fertig' || grund === 'mitteilungen' || grund === 'spaeter');
  ebeneSchliessen(knoten, { dauer: 220 }).then(() => {
    if (zurueckZuCrew && ctx?.nav?.current && ctx.nav.current().id !== TAB_ROUTE.crew) ctx.nav.setTab?.('crew');
    else ctx?.render?.();
    loesen?.(true);
  });
}

/**
 * Öffnet den Guide. Gibt ein Versprechen, das beim Schließen erfüllt wird.
 * ctx: { repo, nav, render, toast } — dasselbe, das auch die Screens bekommen.
 */
export function guideStarten(ctx, optionen = {}) {
  if (zustand.offen) return Promise.resolve(false);
  if (!globalThis.document || !traegerFinden()) return Promise.resolve(false);
  zustand.offen = true;
  zustand.einzel = null;
  zustand.ctx = ctx || zustand.ctx;
  zustand.knoten = null;
  zustand.modus = '';
  zustand.wiederholung = Boolean(optionen.wiederholung);
  zustand.grund = optionen.grund || (optionen.wiederholung ? 'wiederholung' : 'erststart');
  // Nach dem Einrichten steht man je nach Weg auf profile.friendAdd oder in einem Raum
  // (profile.js) — der erste Handgriff liegt aber auf crew.home.
  const erster = SCHRITTE[0];
  if (erster.ort && ctx?.nav?.current && ctx.nav.current().id !== TAB_ROUTE[erster.ort]) ctx.nav.setTab?.(erster.ort);
  schrittBetreten(0);
  if (zustand.knoten) zustand.knoten.dataset.grund = zustand.grund;
  if (!zustand.knoten) { zustand.offen = false; return Promise.resolve(false); }
  return new Promise((fertig) => { zustand.loesen = fertig; });
}


/**
 * EIN Hinweis auf EIN echtes Bedienelement — dieselbe Maschine wie der Guide, aber ohne Weg:
 * das Dunkel mit einem Loch, ein Titel, ein Satz, und nach `dauer` (oder einem Tipp) ist er weg.
 *
 *   guideZeigen(ctx, { sel, titel, satz, form, auf, dauer, bild, ort, rueckfall })
 *
 * Gebraucht von ui/update-info.js: Eine neue Funktion wird dort gezeigt, WO sie steht, statt
 * nur beschrieben zu werden. Das Loch sperrt nichts weg, was es zeigt — wer gleich tippt,
 * benutzt die neue Sache sofort.
 *
 * `ort` ist der Bereich, in dem die Stelle liegt: Ist sie gerade nicht da, wird EINMAL
 * hingeführt. Findet sich danach immer noch nichts, wird der Hinweis nicht zur Lüge — er wird
 * zur gezeichneten Karte mit `rueckfall` ({ titel, satz }; ohne Angabe derselbe Text). Bis
 * Runde 7/Welle 1 stand in diesem Fall „Tipp drauf" über einer Seite ohne den gezeigten Knopf.
 * Gibt ein Versprechen auf true, wenn der Hinweis lief.
 */
export function guideZeigen(ctx, hinweis = {}) {
  if (zustand.offen || !globalThis.document || !traegerFinden()) return Promise.resolve(false);
  const sel = [].concat(hinweis.sel || []).filter(Boolean);
  if (!sel.length) return Promise.resolve(false);
  const titel = () => String(hinweis.titel || '');
  const satz = () => String(hinweis.satz || '');
  const rTitel = () => String(hinweis.rueckfall?.titel ?? hinweis.titel ?? '');
  const rSatz = () => String(hinweis.rueckfall?.satz ?? hinweis.satz ?? '');
  zustand.offen = true;
  zustand.ctx = ctx || zustand.ctx;
  zustand.knoten = null;
  zustand.modus = '';
  zustand.wiederholung = false;
  zustand.grund = 'hinweis';
  zustand.einzel = {
    id: 'hinweis',
    bild: hinweis.bild || 'meet',
    ort: hinweis.ort || '',
    // titel/satz gelten fuer den Rueckfall, zeigen.titel/satz fuer das Loch — die Stelle lässt
    // sich nur dann mit „Tipp drauf" beschreiben, wenn sie auch wirklich da ist.
    titel: rTitel,
    satz: rSatz,
    // Es gibt nichts zu tun: Der Hinweis beginnt sofort im Erklaerteil.
    erledigt: () => true,
    zeigen: { sel, auf: hinweis.auf, form: hinweis.form || 'pille', titel, satz, dauer: hinweis.dauer || 3400 },
  };
  schrittBetreten(0);
  if (zustand.knoten) zustand.knoten.dataset.grund = 'hinweis';
  if (!zustand.knoten) { zustand.offen = false; zustand.einzel = null; return Promise.resolve(false); }
  return new Promise((fertig) => { zustand.loesen = fertig; });
}

/**
 * Einmal nach dem Start aufrufen. Zeigt den Guide NUR beim ersten Mal und nur, wenn die
 * Einrichtung schon durch ist — sonst käme er über das Onboarding.
 */
export function guideBeimStart(ctx) {
  if (!ctx?.repo) return Promise.resolve(false);
  zustand.ctx = ctx;
  erlaubnisAbgleichen(() => ctx.render?.());
  if (!ctx.repo.getSettings?.()?.onboarded) return Promise.resolve(false);
  // L1: Auch wer den Guide überspringt oder ihn schon gesehen hat, bekommt die beiden Fragen —
  // im zweiten sinnvollen Moment (Karten-Bereich, FREE gesetzt). Höchstens einmal je Sache.
  erlaubnisWacht(ctx);
  if (guideGesehen() || !guideFaellig()) return Promise.resolve(false);
  loeschen(GUIDE_FAELLIG);
  return guideStarten(ctx, { grund: 'erststart' });
}
