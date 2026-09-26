// Neue Freundschaftsanfrage: EINMAL groß — danach nur noch der orange Punkt am „+".
//
// Runde 8 (R8-11, Jonathan): „Neue Anfrage: einmal groß oben, schrumpft zum orangen Punkt am ‚+',
// danach nur der Punkt."
// Runde 8 (R8-60, Jonathan, 19.09.): „legt sich ÜBER den Inhalt (schiebt nichts nach unten), bleibt
// ~10 s, bedeckt nur die Hälfte der Reihe mit den markierten Leuten und die Hälfte der Suchleiste —
// alles bleibt bedienbar. Schrumpft dann zum Punkt am ‚+'."
//
// Eine Anfrage ist nur einmal NEU. Die Karte ist deshalb eine Mitteilung, kein Formular: Sie kommt,
// steht ANFRAGE_HINWEIS_MS da und wird dann zu dem Punkt, der danach allein bleibt. Beantwortet wird
// dort, wo alle Anfragen stehen (Crew: das Blatt hinter „+", Profil: „Freunde"). Ein Tipp auf die
// Karte bringt direkt dorthin — aber nur, wenn der Aufrufer diesen Weg mitgibt (optionen.act). Ohne
// ihn ist die Karte kein Knopf und verspricht keinen (Hausregel 9).
//
// Zwei Formen, EIN Inhalt, EIN Zeitplan:
//
//   ÜBER dem Inhalt (Crew, R8-60) — anfrageHinweisHtml(ctx, { act, form: 'hoch' | 'flach' })
//     Die Karte füllt den Platz, den ihr der Aufrufer gibt (er liegt absolut über dem Inhalt, es
//     rückt nichts). 'hoch' steht über Suche UND Reihe: Bild, darunter Name und Satz. 'flach' ist so
//     hoch wie die Suchleiste und steht nur über ihr (keine Reihe da, oder gar keine Suche).
//     anfrageHinweisBinden(seite, ctx, { ziel }) lässt sie nach der Zeit in EINER Bewegung in den
//     Punkt `ziel` schrumpfen: Die Wege sind gemessen, nicht geschätzt — die Karte liegt in der
//     Scrollfläche, der Punkt im Kopf, und die Seite kann in einem skalierten Rahmen stehen.
//     Weil die Scrollfläche alles abschneidet, was über ihren Rand hinausragt, fliegt eine Kopie
//     auf der Seite selbst (über dem Kopf); das Original ist solange unsichtbar.
//   IM FLUSS (Profil) — anfrageHinweisHtml(ctx, { act })
//     Wie bisher eine Karte oben auf der Seite, die per CSS nach derselben Zeit zum „+" schrumpft.
//
// Gemerkt wird „schon gezeigt" je Anfrage auf DIESEM Gerät (localStorage). Ein zweites Gerät zeigt
// dieselbe Anfrage noch einmal groß — das ist ehrlich und billiger als ein neues Feld im
// Datenvertrag. Ohne Speicher (privates Fenster) gilt es für diese Sitzung.
//
//   anfrageHinweisHtml(ctx, { act, form })  die Karte (oder '') — Crew und Profil benutzen DIESELBE
//   anfrageHinweisGesehen(ctx, ids)         nach dem Zeichnen aufrufen: diese Anfragen gelten als
//                                           gezeigt. ids fehlt → die, die die Karte gerade zeigt.
//   anfrageHinweisIds(wurzel)               die ids der gezeichneten Karte (für den Aufruf oben)
//   anfrageHinweisBinden(seite, ctx, { ziel })  Form „über": Eintritt und Flug in den Punkt planen
//   anfrageHinweisFliegen()                 Form „über": jetzt schon in den Punkt (der Mensch tut
//                                           gerade etwas anderes, z. B. tippt in die Suche)
//   anfrageHinweisBeenden(ctx)              ohne Flug beenden — die Anfragen stehen gerade ohnehin
//                                           groß da (Blatt hinter „+" offen)
//   ANFRAGE_HINWEIS_MS                      so lange steht die Karte, bevor sie zum Punkt wird

import { esc, offenesSheet } from '../core/html.js';
import { personAvatar } from './components.js';
import { t as tx, tn as tnx } from '../core/sprache.js';

const SPEICHER = 'crew.anfragen.gesehen';
// R8-60: „bleibt ~10 s". Vorher 5,2 s — zu kurz, um zwei Namen zu lesen UND zu entscheiden, ob man
// gleich antwortet; die Karte verdeckt dafür jetzt nichts mehr, was man braucht.
export const ANFRAGE_HINWEIS_MS = 10000;
// Form „im Fluss": die Karte schrumpft per CSS (Profil).
const SCHRUMPF_MS = 520;
// Form „über": der Flug in den Punkt.
const FLUG_MS = 560;
// So lange gehört eine gezeigte Anfrage zur Karte — die Bewegung am Ende inklusive, mit Luft für
// einen verspäteten Zeitgeber. Danach nie wieder.
const FENSTER_MS = ANFRAGE_HINWEIS_MS + 1000;
// Ein Eintritt nur beim allerersten Erscheinen — nicht bei jedem Zeichnen, nicht beim Zurückkommen.
const EINTRITT_MS = 400;

// id → Zeitpunkt, an dem die Karte diese Anfrage in DIESER Sitzung zum ersten Mal gezeigt hat.
// Solange das Fenster läuft, zeichnet jeder Render die Karte weiter (sonst verschwände sie beim
// nächsten Datenereignis mitten im Lesen); danach nie wieder.
const gezeigt = new Map();
// Anfragen, deren Karte schon zum Punkt geworden ist (Flug gelandet, oder vorher beendet).
const erledigt = new Set();
let gesehen = null;
let aufraeumen = 0;
let flugTimer = 0;
let letzterCtx = null;
let flugZiel = '';

function gesehenLesen() {
  if (gesehen) return gesehen;
  let liste = [];
  try { liste = JSON.parse(globalThis.localStorage?.getItem(SPEICHER) || '[]'); } catch { liste = []; }
  gesehen = new Set(Array.isArray(liste) ? liste.map(String) : []);
  return gesehen;
}

function gesehenSchreiben() {
  try { globalThis.localStorage?.setItem(SPEICHER, JSON.stringify([...gesehenLesen()].slice(-200))); } catch { /* privates Fenster: gilt für diese Sitzung */ }
}

function anfragen(repo) {
  return (typeof repo?.getFriendRequests === 'function' ? repo.getFriendRequests() : null) || [];
}

function sichtbar(ctx, jetzt = Date.now()) {
  const schon = gesehenLesen();
  return anfragen(ctx.repo).filter((anfrage) => {
    const id = String(anfrage.id);
    if (erledigt.has(id)) return false;
    const seit = gezeigt.get(id);
    if (seit !== undefined) return jetzt - seit < FENSTER_MS;
    return !schon.has(id);
  });
}

const wenigerBewegung = () => Boolean(globalThis.matchMedia?.('(prefers-reduced-motion: reduce)')?.matches);

// Das Gesicht einer Anfrage ist (noch) kein Freund — keine privaten Markierungen, kein Frei-Punkt.
function gesicht(anfrage, groesse) {
  return personAvatar({ id: anfrage.id, name: anfrage.name, initials: anfrage.initials, color: anfrage.color, photo: anfrage.photo || null }, { size: groesse, free: false, active: false });
}

// Zwei Gesichter übereinander, das erste vorn — dieselbe Stapelung wie überall (luecken() stanzt die
// Trennung nach dem Zeichnen durch das hintere Bild).
function stapel(liste, groesse) {
  const ueber = Math.round(groesse * 0.34);
  return `<span style="display:flex;flex:none;align-items:center">${liste.slice(0, 2).map((anfrage, i) => `<span style="display:flex;${i ? `margin-left:-${ueber}px;` : ''}position:relative;z-index:${2 - i}">${gesicht(anfrage, groesse)}</span>`).join('')}</span>`;
}

const vorname = (anfrage) => String(anfrage?.name || '').trim().split(/\s+/)[0] || '';

function texte(liste) {
  const eine = liste.length === 1;
  return {
    titel: eine ? String(liste[0].name || '') : tnx(liste.length, '{n} neue Anfrage', '{n} neue Anfragen'),
    unter: eine ? tx('möchte dich hinzufügen') : liste.map(vorname).filter(Boolean).join(', '),
  };
}

// --- Form „im Fluss" (Profil) ------------------------------------------------------------------
// Die Stil-Zeichenkette der Karte bleibt über alle Renders GLEICH: Der Abgleich (core/html.js)
// lässt den Knoten dann stehen, und die Animation läuft einfach weiter, statt neu zu beginnen.
const ANIMATION = `<style>@keyframes anfrageHinweisRein{from{opacity:0;transform:translateY(-6px) scale(.98)}}`
  + '@keyframes anfrageHinweisWeg{to{opacity:0;transform:translateY(-52px) scale(.05)}}'
  + '@keyframes anfrageHinweisZu{to{max-height:0;padding-top:0;padding-bottom:0}}'
  + '@media (prefers-reduced-motion:reduce){[data-role="anfrage-hinweis"],[data-role="anfrage-hinweis-karte"]{animation-duration:1ms!important}}</style>';

function imFlussHtml(liste, optionen) {
  const eine = liste.length === 1;
  const bild = eine ? `<span style="display:flex;flex:none">${gesicht(liste[0], 44)}</span>` : stapel(liste, 36);
  const { titel, unter } = texte(liste);
  const act = optionen.act ? ` data-act="${esc(optionen.act)}"` : '';
  const pfeil = optionen.act
    ? '<svg width="15" height="15" viewBox="0 0 24 24" fill="none" aria-hidden="true" style="flex:none;pointer-events:none"><path d="m9 5 7 7-7 7" stroke="var(--muted-light)" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"></path></svg>'
    : '';
  const tag = optionen.act ? 'button' : 'div';
  // Der äußere Träger klappt am Ende zu (die Seite rückt nach), die Karte darin schrumpft zum
  // „+" rechts oben. Beides mit fester Verzögerung — siehe ANIMATION.
  return `${ANIMATION}<div data-role="anfrage-hinweis" data-ids="${esc(liste.map((anfrage) => anfrage.id).join(','))}" style="max-height:140px;padding:6px 20px 8px;box-sizing:border-box;overflow:visible;animation:anfrageHinweisZu .36s ease-in ${ANFRAGE_HINWEIS_MS + SCHRUMPF_MS - 200}ms forwards">
<${tag}${act} data-role="anfrage-hinweis-karte" style="display:flex;align-items:center;gap:12px;width:100%;box-sizing:border-box;min-height:66px;padding:11px 14px;border:1px solid var(--orange-a28);border-radius:20px;background:var(--surface);box-shadow:0 8px 24px var(--shadow-10);text-align:left;appearance:none;font-family:'Instrument Sans',sans-serif;color:var(--ink);${optionen.act ? 'cursor:pointer;' : ''}transform-origin:calc(100% - 20px) 0;animation:anfrageHinweisRein .32s ease-out both,anfrageHinweisWeg ${SCHRUMPF_MS}ms cubic-bezier(.5,0,.75,0) ${ANFRAGE_HINWEIS_MS}ms forwards">
<span style="pointer-events:none;display:contents">${bild}</span>
<span style="pointer-events:none;flex:1;min-width:0;display:flex;flex-direction:column;gap:3px">
<span data-role="anfrage-hinweis-titel" style="font-size:15px;font-weight:650;letter-spacing:-.01em;white-space:nowrap;overflow:hidden;text-overflow:ellipsis">${esc(titel)}</span>
<span style="font-size:13px;color:var(--muted);white-space:nowrap;overflow:hidden;text-overflow:ellipsis">${esc(unter)}</span>
</span>${pfeil}</${tag}></div>`;
}

// --- Form „über dem Inhalt" (Crew, R8-60) --------------------------------------------------------
// Kein Pfeil, keine Deko: Die Karte ist ein Banner. Was man mit ihr tun kann, sagt sie
// dadurch, dass sie ein Knopf ist; wohin sie gehört, sagt der Punkt, zu dem sie wird.
// `data-fliegt` setzt der Flug zur Laufzeit (der Abgleich lässt solche Merkmale stehen): Solange
// die Kopie fliegt, ist das Original unsichtbar.
const UEBER_STIL = '<style>[data-role="anfrage-hinweis-karte"][data-fliegt]{visibility:hidden!important}'
  + '[data-role="anfrage-hinweis-karte"][data-form]{-webkit-tap-highlight-color:transparent}'
  + '[data-role="anfrage-hinweis-karte"][data-form]:focus-visible{outline:2px solid var(--green);outline-offset:2px}</style>';

function ueberHtml(liste, optionen) {
  const flach = optionen.form === 'flach';
  const eine = liste.length === 1;
  // Oben steht, WER fragt (ein Name oder die Vornamen), darunter, WAS — bei einer Anfrage der Satz,
  // bei mehreren ihre Zahl. Das Wichtigste ist damit auch in der schmalen Form nie abgeschnitten.
  const titel = eine ? String(liste[0].name || '') : liste.map(vorname).filter(Boolean).join(', ');
  const unter = eine ? tx('möchte dich hinzufügen') : tnx(liste.length, '{n} neue Anfrage', '{n} neue Anfragen');
  const act = optionen.act ? ` data-act="${esc(optionen.act)}"` : '';
  const tag = optionen.act ? 'button' : 'div';
  const karte = `position:absolute;left:0;top:0;width:100%;height:100%;box-sizing:border-box;margin:0;border:1px solid var(--orange-a28);background:var(--surface);box-shadow:0 10px 28px var(--shadow-16);text-align:left;appearance:none;overflow:hidden;font-family:'Instrument Sans',sans-serif;color:var(--ink);pointer-events:auto;transform-origin:100% 0;${optionen.act ? 'cursor:pointer;' : ''}`;
  const ellipse = 'white-space:nowrap;overflow:hidden;text-overflow:ellipsis';
  // „flach": so hoch wie die Suchleiste, mit ihrem Eckradius — EIN Bild links (auch bei mehreren
  // Anfragen: ein zweites Gesicht nähme dem Namen genau den Platz, den er braucht), zwei kurze Zeilen.
  // Gemessen bei 360 px (die schmalste Breite): 118 px Platz für den Satz, „möchte dich hinzufügen"
  // braucht bei 10,5 px 116,7 px — bei 11 px wären es 122,3 und er würde abgeschnitten.
  // „hoch": über Suche und Reihe — Bild, darunter Name und Satz, als EIN Block mittig (der Satz darf
  // zwei Zeilen haben).
  const inhalt = flach
    ? `<span data-role="anfrage-hinweis-inhalt" style="pointer-events:none;display:flex;align-items:center;gap:6px;height:100%;min-width:0">
<span style="display:flex;flex:none">${gesicht(liste[0], 22)}</span>
<span style="flex:1;min-width:0;display:flex;flex-direction:column;gap:1px">
<span data-role="anfrage-hinweis-titel" style="font-size:13px;font-weight:650;line-height:15px;letter-spacing:-.01em;${ellipse}">${esc(titel)}</span>
<span data-role="anfrage-hinweis-satz" style="font-size:10.5px;line-height:13px;color:var(--muted);${ellipse}">${esc(unter)}</span>
</span></span>`
    : `<span data-role="anfrage-hinweis-inhalt" style="pointer-events:none;display:flex;flex-direction:column;justify-content:center;gap:8px;height:100%;min-width:0">
${eine ? `<span style="display:flex;flex:none">${gesicht(liste[0], 36)}</span>` : stapel(liste, 32)}
<span style="display:flex;flex-direction:column;gap:2px;min-width:0">
<span data-role="anfrage-hinweis-titel" style="font-size:15px;font-weight:650;line-height:19px;letter-spacing:-.01em;${ellipse}">${esc(titel)}</span>
<span data-role="anfrage-hinweis-satz" style="font-size:12.5px;line-height:16px;color:var(--muted);display:-webkit-box;-webkit-line-clamp:2;-webkit-box-orient:vertical;overflow:hidden">${esc(unter)}</span>
</span></span>`;
  return `${UEBER_STIL}<div data-role="anfrage-hinweis" data-form="${flach ? 'flach' : 'hoch'}" data-ids="${esc(liste.map((anfrage) => anfrage.id).join(','))}" style="position:absolute;left:0;top:0;width:100%;height:100%;pointer-events:none">
<${tag}${act} data-role="anfrage-hinweis-karte" data-form style="${karte}border-radius:${flach ? 12 : 18}px;padding:${flach ? '0 6px' : '12px 13px'}">
${inhalt}</${tag}></div>`;
}

export function anfrageHinweisHtml(ctx, optionen = {}) {
  const liste = sichtbar(ctx);
  if (!liste.length) return '';
  return optionen.form ? ueberHtml(liste, optionen) : imFlussHtml(liste, optionen);
}

export function anfrageHinweisIds(wurzel) {
  const karte = wurzel?.querySelector?.('[data-role="anfrage-hinweis"]');
  return karte ? String(karte.dataset.ids || '').split(',').filter(Boolean) : [];
}

export function anfrageHinweisGesehen(ctx, ids) {
  letzterCtx = ctx;
  const liste = (Array.isArray(ids) ? ids : sichtbar(ctx).map((anfrage) => anfrage.id)).map(String).filter(Boolean);
  if (!liste.length) return;
  const jetzt = Date.now();
  const schon = gesehenLesen();
  let neu = false;
  for (const id of liste) {
    if (!gezeigt.has(id)) { gezeigt.set(id, jetzt); neu = true; }
    if (!schon.has(id)) { schon.add(id); neu = true; }
  }
  if (!neu) return;
  gesehenSchreiben();
  // Ist das Fenster um, verschwindet die (dann schon unsichtbare) Karte auch aus dem Markup — auch
  // dann, wenn kein Flug stattfand (Seite nicht im Blick, anderer Tab).
  const ende = Math.max(...liste.map((id) => gezeigt.get(id) || jetzt)) + FENSTER_MS + 80;
  globalThis.clearTimeout?.(aufraeumen);
  aufraeumen = globalThis.setTimeout?.(() => { ctx.render?.(); }, Math.max(0, ende - Date.now()));
}

// --- Der Flug in den Punkt (Form „über") --------------------------------------------------------

function aktiveSeite() {
  return globalThis.document?.querySelector('.tab-page[data-role="active"]') || null;
}

function idsVon(huelle) {
  return String(huelle?.dataset.ids || '').split(',').filter(Boolean);
}

// Die Karte ist zum Punkt geworden (oder wurde vorher beendet): Ab jetzt zeigt der nächste Render
// nur noch den Punkt.
function landen(ids) {
  globalThis.clearTimeout?.(flugTimer);
  for (const id of ids) erledigt.add(String(id));
  letzterCtx?.render?.();
}

export function anfrageHinweisBinden(seite, ctx, optionen = {}) {
  letzterCtx = ctx;
  flugZiel = optionen.ziel || '';
  globalThis.clearTimeout?.(flugTimer);
  const huelle = seite?.querySelector?.('[data-role="anfrage-hinweis"][data-form]');
  if (!huelle) return;
  const zeiten = idsVon(huelle).map((id) => gezeigt.get(id)).filter((zeit) => zeit !== undefined);
  if (!zeiten.length) return;
  const neueste = Math.max(...zeiten);
  const karte = huelle.querySelector('[data-role="anfrage-hinweis-karte"]');
  if (karte && !karte.__eingetreten) {
    karte.__eingetreten = true;
    if (Date.now() - neueste < EINTRITT_MS && !wenigerBewegung() && typeof karte.animate === 'function') {
      karte.animate([
        { opacity: 0, transform: 'translateY(-6px) scale(.96)' },
        { opacity: 1, transform: 'none' },
      ], { duration: 280, easing: 'cubic-bezier(.2,.8,.2,1)' });
    }
  }
  // Jede Anfrage steht ihre volle Zeit: Kommt während der Karte eine neue dazu, fliegt die Karte
  // erst nach deren Zeit.
  flugTimer = globalThis.setTimeout?.(fliegen, Math.max(0, neueste + ANFRAGE_HINWEIS_MS - Date.now()));
}

export function anfrageHinweisFliegen() {
  fliegen();
}

// Ohne Flug beenden: Die Anfragen stehen gerade ohnehin groß da. Alle offenen gelten damit als
// gesehen — auch eine, die die Karte noch gar nicht gezeigt hatte.
export function anfrageHinweisBeenden(ctx) {
  globalThis.clearTimeout?.(flugTimer);
  const liste = anfragen((ctx || letzterCtx)?.repo).map((anfrage) => String(anfrage.id));
  const schon = gesehenLesen();
  let neu = false;
  for (const id of [...gezeigt.keys(), ...liste]) {
    erledigt.add(id);
    if (!schon.has(id)) { schon.add(id); neu = true; }
  }
  if (neu) gesehenSchreiben();
}

function fliegen() {
  globalThis.clearTimeout?.(flugTimer);
  const seite = aktiveSeite();
  const huelle = seite?.querySelector('[data-role="anfrage-hinweis"][data-form]');
  if (!huelle) return;
  const ids = idsVon(huelle);
  const karte = huelle.querySelector('[data-role="anfrage-hinweis-karte"]');
  if (!karte || karte.hasAttribute('data-fliegt')) return;
  const punkt = flugZiel ? seite.querySelector(flugZiel) : null;
  const kr = karte.getBoundingClientRect();
  const zr = punkt?.getBoundingClientRect();
  // Fliegen nur, wenn man es auch sieht: mindestens die halbe Karte im Bild (in ihrer Scrollfläche,
  // sonst auf der Seite), Punkt da, kein Blatt darüber. Sonst wird die Karte still zum Punkt —
  // dasselbe Ergebnis ohne eine Bewegung, die keiner sieht.
  const flaeche = (karte.closest('.screen-scroll') || seite).getBoundingClientRect();
  const sichtbar = Math.max(0, Math.min(kr.bottom, flaeche.bottom) - Math.max(kr.top, flaeche.top));
  const imBlick = kr.width > 0 && kr.height > 0 && sichtbar >= kr.height / 2;
  const kann = imBlick && zr && zr.width > 0 && !offenesSheet()
    && globalThis.document?.visibilityState !== 'hidden' && !wenigerBewegung() && typeof karte.animate === 'function';
  if (!kann) { landen(ids); return; }

  // Maße in CSS-Pixeln der Seite: Der Rahmen kann skaliert sein (Vorschau am Rechner).
  const sr = seite.getBoundingClientRect();
  const skala = seite.offsetWidth ? sr.width / seite.offsetWidth : 1;
  const breite = karte.offsetWidth;
  const hoehe = karte.offsetHeight;
  const links = (kr.left - sr.left) / skala;
  const oben = (kr.top - sr.top) / skala;
  const ziel = {
    x: (zr.left - sr.left) / skala,
    y: (zr.top - sr.top) / skala,
    b: zr.width / skala,
    h: zr.height / skala,
  };
  const ecke = getComputedStyle(karte).borderTopLeftRadius || '18px';

  const flieger = karte.cloneNode(true);
  flieger.removeAttribute('data-act');
  flieger.setAttribute('data-role', 'anfrage-hinweis-flug');
  flieger.setAttribute('aria-hidden', 'true');
  flieger.inert = true;
  // Der Abgleich fasst diesen Knoten nie an (core/html.js › laufzeitKnoten): Ein Render mitten im
  // Flug lässt ihn weiterfliegen.
  flieger.__morphFrei = true;
  Object.assign(flieger.style, {
    position: 'absolute', left: `${links}px`, top: `${oben}px`, width: `${breite}px`, height: `${hoehe}px`,
    right: 'auto', bottom: 'auto', margin: '0', zIndex: '7', pointerEvents: 'none', transformOrigin: '0 0', animation: 'none',
  });
  seite.appendChild(flieger);
  karte.setAttribute('data-fliegt', '');

  // EINE Bewegung: Die Karte zieht sich auf den Punkt zusammen (Lage und Größe), wird dabei rund
  // und nimmt seine Farbe an; ihr Inhalt ist nach dem ersten Drittel schon weg.
  const bewegung = flieger.animate([
    { transform: 'translate(0px, 0px) scale(1, 1)', borderRadius: ecke },
    { transform: `translate(${ziel.x - links}px, ${ziel.y - oben}px) scale(${ziel.b / breite}, ${ziel.h / hoehe})`, borderRadius: '50%' },
  ], { duration: FLUG_MS, easing: 'cubic-bezier(.45,0,.2,1)', fill: 'forwards' });
  flieger.animate([
    { backgroundColor: 'var(--surface)', borderColor: 'var(--orange-a28)', boxShadow: '0 10px 28px var(--shadow-16)' },
    { offset: 0.3, backgroundColor: 'var(--surface)', borderColor: 'var(--orange-a28)', boxShadow: '0 10px 28px var(--shadow-16)' },
    { offset: 0.85, backgroundColor: 'var(--orange)', borderColor: 'var(--orange)', boxShadow: '0 0 0 transparent' },
    { backgroundColor: 'var(--orange)', borderColor: 'var(--orange)', boxShadow: '0 0 0 transparent' },
  ], { duration: FLUG_MS, fill: 'forwards' });
  flieger.querySelector('[data-role="anfrage-hinweis-inhalt"]')?.animate([
    { opacity: 1 }, { offset: 0.32, opacity: 0 }, { opacity: 0 },
  ], { duration: FLUG_MS, fill: 'forwards' });
  // Ist die Liste ein Stück gerollt, liegt der obere Teil der Karte schon unter dem Kopf. Die Kopie
  // beginnt deshalb genauso abgeschnitten und gibt sich erst im ersten Viertel der Bewegung frei —
  // sonst tauchte dieser Teil im ersten Bild über dem Kopf auf.
  const verdeckt = Math.max(0, (flaeche.top - kr.top) / skala);
  if (verdeckt > 0.5) {
    flieger.animate([
      { clipPath: `inset(${verdeckt}px 0 0 0)` }, { offset: 0.25, clipPath: 'inset(0px 0 0 0)' }, { clipPath: 'inset(0px 0 0 0)' },
    ], { duration: FLUG_MS, fill: 'forwards' });
  }

  let fertig = false;
  const ende = () => {
    if (fertig) return;
    fertig = true;
    // Erst zeichnen (der Punkt erscheint), dann die Kopie weg — beides vor dem nächsten Bild.
    landen(ids);
    flieger.remove();
  };
  bewegung.finished.then(ende, ende);
  // Netz für den Fall, dass die Bewegung nie fertig meldet (etwa gedrosselt im Hintergrund).
  globalThis.setTimeout?.(ende, FLUG_MS + 1500);
}
