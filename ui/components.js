// Zentrale, wiederverwendbare Crew-Bausteine — exakt aus reference/source transkribiert.
// Abweichungen von der Referenz nur dort, wo spec/PRODUCT_CONTRACT.md es verlangt
// (z. B. aktiver Frei-Zustand mit weißem „Frei", private Marker aus Settings).

import { esc, rueckmeldung } from '../core/html.js';
import { istHuelle } from '../core/native.js';
import { currentTimeHHMM } from '../core/dates.js';
import { istMotiv, motivBildAdresse } from './tiermotive.js';
import { t as tx } from '../core/sprache.js';
import { activityIconSvg } from './activity-icons.js';
// R8-66: Die Reihenfolge der Tab-Leiste ist die der Bahn — eine Quelle (core/router.js).
import { TAB_ORDER } from '../core/router.js';

// --- Handy-Rahmen: exakt der innere 390×844-Referenzrahmen ---

export function phoneFrame(innerHtml, options = {}) {
  const background = options.background || 'var(--paper)';
  // Runde 3 (S1): overflow:clip statt nur hidden — ein beschnittener Rahmen ist damit auch
  // nicht mehr programmatisch scrollbar. Vorher scrollte der Browser den ganzen Rahmen, um
  // ein fokussiertes Feld in einem noch hereinfahrenden Sheet zu zeigen (gemessen 251 px).
  // hidden bleibt davor als Rückfall für Browser ohne clip.
  return `<div class="runtime-phone" style="background:${background};border-radius:44px;border:1px solid var(--ink-a14);box-shadow:0 16px 40px var(--shadow-12);overflow:hidden;overflow:clip;display:flex;flex-direction:column;color:var(--ink);position:relative">${innerHtml}</div>`;
}

// --- StatusBar (reference/source/StatusBar.dc.html) ---

// Läuft die App als APP — auf dem Startbildschirm abgelegt oder in der nativen Hülle?
// Dann zeichnet das Gerät seine eigene Statusleiste, und eine zweite darunter wäre ein
// Fehler: zwei Uhrzeiten, zwei Batterien. Im Browser dagegen gehört sie zum Bild, weil die
// App dort in einem Telefonrahmen sitzt.
export function alsAppGestartet() {
  if (typeof window === 'undefined') return false;
  return Boolean(
    istHuelle()
    || window.navigator?.standalone
    || window.matchMedia?.('(display-mode: standalone)')?.matches
    || window.matchMedia?.('(display-mode: fullscreen)')?.matches,
  );
}

export function statusBar(time) {
  // Als App: nur der Platz, den das Gerät für seine eigene Leiste braucht. Auf Android liegt
  // der Inhalt ohnehin darunter (Einzug 0), auf dem iPhone sind es rund 47 Pixel.
  // data-role: Beim Gleiten bleibt die Statusleiste stehen (app.js misst ihre Höhe).
  if (alsAppGestartet()) {
    return '<div data-role="statusleiste" style="flex:none;height:calc(env(safe-area-inset-top, 0px) + 8px)"></div>';
  }
  const shown = time || currentTimeHHMM();
  return `<div data-role="statusleiste" style="display:flex;justify-content:space-between;align-items:center;height:46px;padding:12px 28px 0;flex:none;font-family:'Instrument Sans',sans-serif;color:inherit">
<span style="font-size:15px;font-weight:600;letter-spacing:.02em">${esc(shown)}</span>
<span style="display:flex;gap:6px;align-items:center">
<svg width="18" height="11" viewBox="0 0 18 11"><rect x="0" y="7" width="3" height="4" rx="1" fill="currentColor"></rect><rect x="5" y="4.5" width="3" height="6.5" rx="1" fill="currentColor"></rect><rect x="10" y="2" width="3" height="9" rx="1" fill="currentColor"></rect><rect x="15" y="0" width="3" height="11" rx="1" fill="currentColor" opacity=".3"></rect></svg>
<svg width="16" height="11" viewBox="0 0 16 11"><path d="M8 10.6 1.4 4.2a9.4 9.4 0 0 1 13.2 0Z" fill="currentColor"></path></svg>
<svg width="25" height="12" viewBox="0 0 25 12"><rect x=".5" y=".5" width="21" height="11" rx="3.5" fill="none" stroke="currentColor" opacity=".4"></rect><rect x="2" y="2" width="14" height="8" rx="2" fill="currentColor"></rect><path d="M23 4v4a2.2 2.2 0 0 0 0-4" fill="currentColor" opacity=".4"></path></svg>
</span></div>`;
}

// --- v14-Kanten-Fades (reference/current: geblurrte Border-Ringe in beschnittenem Wrapper) ---
// Karten: cardEdgeFade(outerRadius) + grüne 1px-Hairline (der graue Rahmen wird im aktiven
// Zustand grün). Avatare: avatarEdgeFade('s'|'xs') — fadet nach innen ins Bild.

// Runde 3 (O5, Jonathan): „Der grüne Fade hat einen Rand, und zwischen Rand und Fade ist ein
// Schlitz." Angesehen (4-fach vergrößert): Der Fade war auf die INNENkante der Karte
// beschnitten, die Haarlinie lag getrennt darüber — halbtransparent (65 %) und mit 19 statt
// 18 px Rundung. Zwischen beiden stand deshalb ein hellerer (hell) bzw. dunklerer (dunkel)
// Streifen. Jetzt gibt es EINE Fläche: Sie deckt die Kartenkante mit ab (inset:-1px, genau
// die äußere Rundung), und der Ring reicht so weit hinein, dass die Kante selbst voll grün
// ist. Die sichtbare Tiefe des Fades und sein Atmen bleiben wie bisher.
// Runde 4 (C2, Jonathan): „Die pulsierenden grünen Fades bei Gruppen und Profilbildern sind gut,
// aber außen ist eine eckige Box." Der Fade ist ein weichgezeichneter Ring, der atmet — und genau
// solche Ebenen (filter + animation) schneidet WebKit (iPhone, iOS-App) mit overflow:hidden NUR
// rechteckig zu; border-radius am Träger gilt dort für sie nicht. Der Unschärfe-Saum stand als
// eckiger Kasten um Kachel und Profilbild. clip-path schneidet in jeder Engine exakt in der Form:
// die Kachel mit ihrem Radius, das Profilbild als Kreis. overflow:hidden bleibt als Rückfall.
export function cardEdgeFade(radius = 18) {
  const ring = `<span style="position:absolute;inset:-11px;border-radius:${radius + 11}px;border:13px solid var(--green);filter:blur(4px);animation:fadeKante 3.2s ease-in-out infinite"></span>`;
  return `<span data-role="kanten-fade" style="position:absolute;inset:-1px;border-radius:${radius}px;overflow:hidden;clip-path:inset(0 round ${radius}px);-webkit-clip-path:inset(0 round ${radius}px);isolation:isolate;pointer-events:none">${ring}${ring}${ring}</span>`;
}

export function avatarEdgeFade(size = 's') {
  const config = size === 'xs'
    ? { inset: -6, border: 7, blur: 2, animation: 'fadeKanteXS' }
    : { inset: -8, border: 9, blur: 2.6, animation: 'fadeKanteS' };
  const ring = `<span style="position:absolute;inset:${config.inset}px;border-radius:50%;border:${config.border}px solid var(--green);filter:blur(${config.blur}px);animation:${config.animation} 3.2s ease-in-out infinite"></span>`;
  return `<span data-role="avatar-fade" style="position:absolute;inset:0;border-radius:50%;overflow:hidden;clip-path:circle(50% at 50% 50%);-webkit-clip-path:circle(50% at 50% 50%);isolation:isolate;pointer-events:none">${ring}${ring}${ring}</span>`;
}

// --- Privates Markierungs-Plättchen am Avatar (v14: links unten, weißes 19px-Plättchen) ---
// Stern (Bester Freund, ohne Textlabel) bzw. Symbol der Besonderen Person in ihrer Akzentfarbe.

// v4 P0-3-8: EINE Symboltabelle fuer die ganze App. Vorher gab es drei Kopien
// (hier, in profile.js und in room.js), die sich bei 'herzlos' widersprachen: das
// Raum-Sheet zeigte ein Herz, die Markierung danach ein abgerundetes Quadrat.
// v6 A04: Es gibt GENAU vier Standardsymbole — Herz, Stern, Blitz, Mond. Alle früheren
// nicht auswählbaren Fallbacks (raute, quadrat, herzlos, punkt, ring, welle, dreieck)
// sind entfernt. Sie waren nirgends wählbar, aber 'raute' stand an sechs Stellen als
// Rückfallwert: wer eine besondere Person markierte, ohne eine Kachel anzutippen, bekam
// zwangsläufig ein gedrehtes Viereck. Wer sein eigenes Zeichen will, nimmt ein Emoji.
export const SPECIAL_SYMBOLS = {
  herz: (color) => `<svg width="12" height="12" viewBox="0 0 24 24"><path d="M12 20.4c-1.2-.9-8.2-5.2-8.2-10A4.6 4.6 0 0 1 12 7.2a4.6 4.6 0 0 1 8.2 3.2c0 4.8-7 9.1-8.2 10Z" fill="${color}"></path></svg>`,
  stern: (color) => `<svg width="12.5" height="12.5" viewBox="0 0 24 24"><path d="m12 3.5 2.6 5.3 5.9.9-4.3 4.1 1 5.9L12 16.9l-5.2 2.8 1-5.9-4.3-4.1 5.9-.9L12 3.5Z" fill="${color}"></path></svg>`,
  blitz: (color) => `<svg width="11" height="11" viewBox="0 0 24 24"><path d="M13 2 4.5 13.5H11L9.5 22 19 10h-6.5L13 2Z" fill="${color}"></path></svg>`,
  mond: (color) => `<svg width="11" height="11" viewBox="0 0 24 24"><path d="M20 14.5A8.5 8.5 0 0 1 9.5 4a8.5 8.5 0 1 0 10.5 10.5Z" fill="${color}"></path></svg>`,
};

// Ein gespeicherter Altwert (etwa 'raute' aus einem früheren Stand) wird beim Lesen auf
// das Herz migriert, damit nirgends mehr ein Viereck auftaucht.
export function specialSymbolKey(key) {
  return SPECIAL_SYMBOLS[key] ? key : 'herz';
}

export function markerPlate(symbolKey, color, options = {}) {
  const plateSize = options.size || 19;
  const small = plateSize <= 15;
  let symbol = (SPECIAL_SYMBOLS[specialSymbolKey(symbolKey)])(color);
  // Kleine Plättchen (Karten-Pins, 28px-Avatare) skalieren das Symbol herunter (reference 04.3).
  if (small) {
    symbol = symbol
      .replace('width="12.5" height="12.5"', 'width="10" height="10"')
      .replace('width:9px;height:9px', 'width:7px;height:7px')
      .replace('width:10px;height:10px', 'width:8px;height:8px');
  }
  const offset = small ? -3 : -4;
  return `<span style="position:absolute;left:${offset}px;bottom:${offset}px;width:${plateSize}px;height:${plateSize}px;border-radius:50%;background:var(--surface);box-shadow:0 1px 3px var(--shadow-22);display:flex;align-items:center;justify-content:center;pointer-events:none">${symbol}</span>`;
}

// v3.2 Ü3: Bester Freund = schmaler warm-goldener Ring um den Avatar, KEIN Icon und
// KEIN Default-Label. Besondere Person = kleiner Marker neben dem Namen, Label nur wenn
// tatsächlich eingegeben (nie ein Fallback wie „Besondere Person" oder „Freundin").
// Beide schließen einander aus; die Quelle ist immer settings.
// Runde 4 (B4, Schnittstelle P1): Die Markierung ALLER besten Freunde ist einstellbar —
// settings.besteFreundeMarke = { symbol: 'herz'|'stern'|'blitz'|'mond', color: '#RRGGBB' }.
// Fehlt oder ist sie ungültig, bleibt es beim heutigen goldenen Stern. Dieselbe Regel wie P1s
// besteFreundeMarke() (ui/beste-freunde-marke.js); hier ohne Import, damit die Markierung auch
// ohne diese Datei nie ausfällt.
export function besteFreundeMarkeAus(settings) {
  const roh = settings?.besteFreundeMarke || {};
  const symbol = SPECIAL_SYMBOL_KEYS.includes(roh.symbol) ? roh.symbol : 'stern';
  const color = /^#[0-9a-f]{6}$/i.test(String(roh.color || '')) ? roh.color : BEST_FRIEND_GOLD;
  return { symbol, color };
}

export function personMarker(personId, settings) {
  if (settings.bestFriendIds?.includes(personId)) {
    return { kind: 'best', ...besteFreundeMarkeAus(settings), label: '' };
  }
  const special = settings.specialPerson;
  if (special && special.personId === personId) {
    return {
      kind: 'special',
      symbol: special.symbol || 'raute',
      // v5 A10: Ein gewähltes Emoji ersetzt das Vektorsymbol — beides zusammen wäre
      // doppelt. Der Ring in der Akzentfarbe bleibt in beiden Fällen.
      emoji: special.emoji || '',
      color: special.color || '#7E6BA8',
      label: (special.label || '').trim(),
    };
  }
  return null;
}

// Runde 6 (Jonathan): Gold war unpassend — jetzt das Gelb aus der Palette (#E1B72E).
// Der Name bleibt, damit kein Aufrufer bricht.
export const BEST_FRIEND_GOLD = '#E1B72E';

// v4 P0-3-1: Das Symbol der Besonderen Person steht NICHT mehr neben dem Namen,
// sondern unten links am Profilbild (specialAvatarMark in personAvatar). v3.2 verlangte
// das Gegenteil und ist an dieser Stelle überholt. Die Funktion bleibt als leerer
// Platzhalter, damit kein Aufrufer bricht — sie zeichnet bewusst nichts mehr.
export function specialNameMarker() {
  return '';
}

// v14 06.11b: zehn Symbole in Referenzreihenfolge (der Stern ist auch als Symbol wählbar).
// v5 A10: Die Basisauswahl sind genau vier Zeichen — Herz, Stern, Blitz, Mond.
// Zusaetzlich kann ein einzelnes Emoji gewaehlt werden (marker.emoji); dann braucht es
// keine Symbolfarbe. v4 bot zehn geometrische Formen an, darunter kein Herz.
export const SPECIAL_SYMBOL_KEYS = ['herz', 'stern', 'blitz', 'mond'];

// Vorschlaege fuer die Emoji-Auswahl im Sheet (frei eintragbar bleibt moeglich).
// v6 A04: Die frühere feste Achter-Wand ist entfallen. „Eigenes Emoji" ist jetzt ein
// echtes Eingabefeld in beiden Markieren-Sheets — nur so öffnet sich auf Mobilgeräten
// die System-Emoji-Tastatur. Ein Emoji ist genau ein Grapheme-Cluster.
export function ersterEmojiCluster(text) {
  const zeichen = [...String(text || '').trim()];
  if (!zeichen.length) return '';
  // Variantenselektoren und Zero-Width-Joiner gehören noch zum selben Zeichen.
  let ende = 1;
  while (ende < zeichen.length && /[\u200d\ufe0f\u{1f3fb}-\u{1f3ff}]/u.test(zeichen[ende])) {
    ende += (zeichen[ende] === '\u200d') ? 2 : 1;
  }
  return zeichen.slice(0, ende).join('');
}

// v3.2 D3: EINE kuratierte Akzentfarben-Liste für die Besondere Person. Bewusst ohne
// Grün, Blau, Orange und Rot — diese vier tragen in der App Zustandsbedeutung (frei,
// Loop, Hinweis, Absage) und dürfen keine private Markierung sein. Profil und Raum
// zeigen dieselbe Auswahl, weil sie dieselbe Liste lesen.
// v5 A10: eine klar geordnete, echte Regenbogenabfolge — Blau, Türkis, Grün, Gelb,
// Orange, Rot, Violett, je in zwei Stufen. v4 hatte hier 14 gedämpfte Töne in zufälliger
// Reihenfolge; v5 kehrt das ausdrücklich um.
// Die Töne sind bewusst gegen die Statusfarben abgesetzt (Frei var(--green), Loop var(--blue-dark),
// Absage var(--danger)), damit die private Markierung nicht mit einem Zustand verwechselt wird.
// v6 A04: geordnete Regenbogenfolge mit allen acht geforderten Stufen — Blau, Türkis,
// Grün, Gelb, Orange, Rot, PINK, Violett. Pink fehlte bisher vollständig. Je Stufe ein
// kräftiger und ein heller Ton, damit die Palette in zwei Reihen à acht aufgeht.
// v7 A04c/spec 01 §3: Genau diese 15 Farben in genau dieser Reihenfolge — ein
// gefuelltes, gleichmaessiges Spektrum von links nach rechts, Zeile fuer Zeile.
// Vorher lagen hier 16 Werte mit doppelten Blautoenen und einem isolierten Violett am
// Ende; die Profilansicht hielt deshalb eine zweite, eigene Liste. Eine Quelle genuegt.
export const MARKER_COLORS = [
  ['#4D63C8', tx('Indigo')], ['#3576D3', tx('Königsblau')], ['#2A9BD1', tx('Himmelblau')], ['#18A8B5', tx('Cyan')], ['#159D86', tx('Türkis')],
  ['#319B5B', tx('Smaragd')], ['#71AA42', tx('Grün')], ['#A8BE39', tx('Limette')], ['#E1B72E', tx('Gelb')], ['#DB9626', tx('Amber')],
  ['#E6752A', tx('Orange')], ['#E45E4D', tx('Koralle')], ['#D74B58', tx('Rot')], ['#D64291', tx('Pink')], ['#8C54C6', tx('Violett')],
];

// Die Standardfarbe einer frisch markierten Person ist der erste Palettenton — vorher
// stand dort ein Wert, der gar nicht mehr in der Palette vorkam („Eigene Farbe").
export const MARKER_COLOR_DEFAULT = MARKER_COLORS[0][0];

export function markerColorName(hex) {
  return (MARKER_COLORS.find(([value]) => value === hex) || ['', tx('Eigene')])[1];
}

// --- TabBar (reference/current/TabBar.dc.html) — Buttons mit data-act="tab" ---
// options.dot: oranger Anfragen-Punkt am Profil-Icon (v14).
// options.tabs: welche Bereiche die Leiste zeigt (Standard: alle aus core/router.js › TAB_ORDER).
//   app.js laesst einen Bereich weg, dessen Seite (noch) nicht geladen ist — ein Tab ohne Seite
//   waere ein Knopf ohne Wirkung (Hausregel 9).

export function tabBar(active, options = {}) {
  const color = (key) => (active === key ? 'var(--ink)' : 'var(--muted-light)');
  const weight = (key) => (active === key ? 650 : 500);
  // R8-15 (Jonathan): „ganzer Tab-Bereich antippbar". Gemessen vorher (360/390/430 px): Die Leiste
  // war 76 px hoch, die Knoepfe nur 41 — der Rand oben (10 px), unten (24 px) und links/rechts
  // (je 12 px) gehoerte der <nav>, keinem Tab. Ein Tipp dorthin — unten, wo der Daumen liegt —
  // tat nichts. Jetzt IST jeder Tab ein gleich breiter Teil der Leiste, von Kante zu Kante und von
  // oben bis unten: Die Luft steckt im Knopf (padding), nicht mehr in der Leiste. Die Teile sind
  // gleich breit (flex:1 1 0), Zeichen und Wort stehen in ihrer Mitte. Damit sind auch die
  // Abstaende einheitlich und folgen dem Layout statt festen Werten: vom Rand bis zum ersten
  // Zeichen genau der halbe Abstand zwischen zwei Zeichen — bei jeder Breite und jeder Zahl von
  // Tabs (R8-66: fuenf, je ein Fuenftel).
  const item = (key, label, svg) => `<button data-act="tab" data-tab="${key}" data-treffer aria-current="${active === key ? 'page' : 'false'}" style="flex:1 1 0;min-width:0;display:flex;flex-direction:column;align-items:center;justify-content:flex-start;gap:3px;padding:10px 0 24px;margin:0;border:0;background:transparent;cursor:pointer;font-family:'Instrument Sans',sans-serif">
${svg}
<span style="font-size:11px;font-weight:${weight(key)};color:${color(key)};pointer-events:none;max-width:100%;white-space:nowrap;overflow:hidden;text-overflow:ellipsis">${label}</span></button>`;

  const meetSvg = `<svg width="24" height="24" viewBox="0 0 24 24" fill="none" style="pointer-events:none"><rect x="3.8" y="5.2" width="16.4" height="15" rx="3" stroke="${color('meet')}" stroke-width="1.8"></rect><path d="M3.8 9.8h16.4M8.4 3v3.4M15.6 3v3.4" stroke="${color('meet')}" stroke-width="1.8" stroke-linecap="round"></path><circle cx="12" cy="14.8" r="1.7" fill="${color('meet')}"></circle></svg>`;
  const crewSvg = `<svg width="24" height="24" viewBox="0 0 24 24" fill="none" style="pointer-events:none"><circle cx="4.7" cy="7.6" r="2.05" stroke="${color('crew')}" stroke-width="1.55"></circle><circle cx="19.3" cy="7.6" r="2.05" stroke="${color('crew')}" stroke-width="1.55"></circle><path d="M1.6 17.6a4.1 4.1 0 0 1 3.4-3.2M22.4 17.6a4.1 4.1 0 0 0-3.4-3.2" stroke="${color('crew')}" stroke-width="1.55" stroke-linecap="round"></path><circle cx="12" cy="8.6" r="3.3" fill="var(--paper-soft)" stroke="${color('crew')}" stroke-width="1.8"></circle><path d="M5.7 21a6.3 6.3 0 0 1 12.6 0Z" fill="var(--paper-soft)" stroke="${color('crew')}" stroke-width="1.8" stroke-linejoin="round"></path></svg>`;
  // Runde 5 (C2, Jonathan: „Freundes anfragen soll stärker kommuniziert werden"): Offene Anfragen stehen als
  // Zahl am Crew-Tab — dort steht jetzt auch die Karte zum Annehmen. options.zahlen = { crew: n }.
  const crewZahl = Number(options.zahlen?.crew) || 0;
  const crewMitZahl = crewZahl > 0
    ? `<span style="position:relative;display:flex;pointer-events:none">${crewSvg}<span data-role="tab-zahl" aria-label="${esc(tx('{n} offene Anfragen', { n: crewZahl }))}" style="position:absolute;left:18px;top:-2px;width:9px;height:9px;border-radius:50%;background:var(--orange);box-shadow:0 0 0 2px var(--nav)"></span></span>`
    : crewSvg;
  const profilDot = options.dot
    ? `<span style="position:absolute;right:-2px;top:0;width:9px;height:9px;border-radius:50%;background:var(--orange);border:2px solid var(--paper-soft);box-sizing:border-box"></span>`
    : '';
  const profilSvg = `<span style="position:relative;display:flex;pointer-events:none"><svg width="24" height="24" viewBox="0 0 24 24" fill="none"><circle cx="12" cy="8.4" r="3.7" stroke="${color('profil')}" stroke-width="1.8"></circle><path d="M4.8 19.5a7.2 7.2 0 0 1 14.4 0" stroke="${color('profil')}" stroke-width="1.8" stroke-linecap="round"></path></svg>${profilDot}</span>`;
  // Runde 7 (Jonathan, wiederholt: „wir haben immernoch 3 taps, anstatt 4 haupttaps"):
  // Die Karte ist ein eigener Hauptbereich, kein Unterpunkt von Crew und Meet. Das Zeichen
  // ist dasselbe gefaltete Blatt wie der Karten-Umschalter (ui/symbole.js › 'karte'), hier
  // in derselben 24er-Machart wie die anderen Tab-Zeichen.
  const karteSvg = `<svg width="24" height="24" viewBox="0 0 24 24" fill="none" style="pointer-events:none"><path d="M9.2 3.8 3.5 5.9v14.3l5.7-2.1 5.6 2.1 5.7-2.1V3.8l-5.7 2.1-5.6-2.1Z" stroke="${color('karte')}" stroke-width="1.8" stroke-linejoin="round"></path><path d="M9.2 3.8v14.3M14.8 5.9v14.3" stroke="${color('karte')}" stroke-width="1.8" stroke-linejoin="round"></path></svg>`;
  // R8-66 (Jonathan: „Der fünfte Bereich wird JETZT gebaut (Mitte)"): Find — hier findet man, was
  // man mit der Crew unternehmen kann. Das Zeichen ist ein Kompass: Er sagt „Richtung finden,
  // hinausgehen" und nicht „Suchwort eingeben" (die Lupe steht schon oben in Crew, und der Finder
  // fragt ausdruecklich nach Gefuehlen statt nach Suchworten, R8-50). Kreis und Nadel in derselben
  // 24er-Machart und Strichstaerke wie die anderen Zeichen; die Nadel ist voll, damit sie auch bei
  // 24 px eine Richtung zeigt und nicht zu einer Raute im Ring verschwimmt.
  const findSvg = `<svg width="24" height="24" viewBox="0 0 24 24" fill="none" style="pointer-events:none"><circle cx="12" cy="12" r="8.9" stroke="${color('find')}" stroke-width="1.8"></circle><path d="M16.1 7.9 13.6 13.6 7.9 16.1 10.4 10.4Z" fill="${color('find')}" stroke="${color('find')}" stroke-width="1.4" stroke-linejoin="round"></path></svg>`;

  // Reihenfolge = Reihenfolge der Bahn (core/router.js › TAB_ORDER): Crew zuerst, weil dort
  // die Frage „kann ich jetzt etwas machen" beantwortet wird; Find in der Mitte (R8-66).
  const zeichen = {
    crew: [tx('Crew'), crewMitZahl],
    meet: [tx('Meet'), meetSvg],
    find: [tx('Find'), findSvg],
    karte: [tx('Karte'), karteSvg],
    profil: [tx('Profil'), profilSvg],
  };
  const tabs = (Array.isArray(options.tabs) ? options.tabs : TAB_ORDER).filter((tab) => zeichen[tab]);
  return `<nav aria-label="${esc(tx('Hauptnavigation'))}" style="flex:none;display:flex;align-items:stretch;border-top:1px solid var(--ink-a08);background:var(--nav);padding:0;font-family:'Instrument Sans',sans-serif">
${tabs.map((tab) => item(tab, ...zeichen[tab])).join('')}</nav>`;
}

// --- Avatare ---

// =====================================================================================
// Runde 7 (K4) — EINE Regel fuer alle Groessen
// =====================================================================================
//
// Jonathan: „Im Chat wirkt der Beste-Freund-Kreis sehr gross im Vergleich zum Profilbild."
// Das war kein Einzelfall, sondern ein fehlendes System. Gemessen im alten Stand:
//
//   Bild 92 px → Plakette 40 px (0,435)   Bild 34 px → 16 px (0,470)
//   Bild 44 px → Plakette 19 px (0,432)   Bild 30 px → 16 px (0,533)
//   Bild 26 px → Plakette 16 px (0,615)   Bild 24 px → 12 px (0,500)
//
// Ursache waren drei Dinge, die jede Proportion zerstoeren: ein zweiter Satz Regeln fuer
// „compact", Untergrenzen per Math.max und Rundung auf ganze Pixel. Auf kleinen Bildern
// blaehte sich das Zeichen dadurch auf bis zu 0,62 der Bildgroesse auf.
//
// Jetzt gilt: JEDE Groesse am Avatar ist ein fester ANTEIL der Bildgroesse, an jeder Stelle
// der App aus DIESER Tabelle gerechnet. Keine Untergrenze, keine Rundung auf ganze Pixel
// (Bruchteile sind erlaubt und genau das, was die Proportion haelt), kein zweiter Satz fuer
// kleine Bilder. (Bis Runde 7 fiel unter einer Grenze das SYMBOL in der Plakette weg; seit
// R8-7 steht es in jeder Groesse da — siehe den Abschnitt direkt unter MASS.)
export const MASS = Object.freeze({
  zeichen: 0.28,   // Plakette (bester Freund / besondere Person) : Bild — seit R8-7 = Frei-Punkt
  punkt: 0.28,     // Frei-Punkt : Bild
  spalt: 0.05,     // Luecke zwischen Plakette/Punkt und Bild : Bild
  // ALT (bis R8-61): wie weit Plakette/Punkt ueber die Bildkante ragten : Plakette. Seit R8-61
  // liegt jeder Mittelpunkt AUF dem Rand (kreisPunkt, unten) — components.js rechnet nicht mehr
  // damit. Der Wert bleibt nur, weil web/screens/profile.js (bfPlakette, Vorschau im Sheet der
  // besten Freunde) ihn noch liest; stellt sie auf kreisPunkt um, faellt er ersatzlos weg.
  versatz: 0.12,
  schrift: 0.36,   // Initialen : Bild
  symbol: 0.74,    // Zeichen IN der Plakette : Plakette
  ring: 0.11,      // Ringbreite, wenn die Plakette ohne Bild darunter steht : Plakette
  ueberlapp: 0.28, // Ueberlappung im Stapel : Bild (Empfehlung fuer neue Stapel)
});

// =====================================================================================
// Runde 8 (R8-7) — die Marke ist so gross wie der Frei-Punkt, und ihr Zeichen bleibt
// =====================================================================================
//
// Jonathan: „Marken links (beste/besondere) gleich gross wie der Frei-Punkt, Position bleibt …
// Stern bleibt auch im Chatkopf." Bis Runde 7 war die Plakette 0,44 des Bildes, der Frei-Punkt
// 0,28: links unten sass ein Knopf, rechts unten ein Punkt, und die Marke war das Lauteste am
// Bild. Jetzt sind beide 0,28 und ragen gleich weit heraus (versatz) — zwei gleiche Punkte,
// links WER die Person mir ist, rechts OB sie frei ist. Die Ecke bleibt dieselbe.
//
// Die fruehere Untergrenze MASS_MIN_SYMBOL (12 px Plakette) ist ersatzlos gestrichen. Sie liess
// den Stern unter 27,3 px Bildgroesse zu einem nackten gelben Kreis werden — genau das hat
// Jonathan im Chat gesehen (26-px-Bilder neben den Nachrichten). Mit der kleineren Plakette
// haette sie den Stern sogar unter 43 px geloescht, also auch im Chatkopf (34 px). Das Zeichen
// steht jetzt in JEDER Groesse da. Damit es klein erkennbar bleibt, fuellt es die Plakette
// staerker (symbol 0,74 statt 0,64) — die Plakette selbst waechst dafuer nicht.

// Zwei Nachkommastellen genuegen fuer jede Bildschirmdichte und halten das Verhaeltnis
// exakt — ganze Pixel taeten das nicht (19/44 = 0,432 statt 0,44).
const px2 = (wert) => Math.round(wert * 100) / 100;

// Alle abgeleiteten Masse einer Bildscheibe an EINER Stelle. Wer eine Flaeche baut, die
// zu einem Avatar passen soll, rechnet sie hiermit — nicht von Hand.
export function avatarMasse(size) {
  const bild = Number(size) || 0;
  return {
    bild,
    zeichen: px2(bild * MASS.zeichen),
    punkt: px2(bild * MASS.punkt),
    spalt: px2(bild * MASS.spalt),
    schrift: px2(bild * MASS.schrift),
    ueberlapp: px2(bild * MASS.ueberlapp),
  };
}

// =====================================================================================
// Runde 8 (R8-61) — EINE Regel fuer jeden Punkt an einem Kreis
// =====================================================================================
//
// Jonathan: „EINE Regel für alle Punkte an Kreisen: Mittelpunkt auf dem Kreisrand unter 45°,
// Größe = fester Anteil des Kreisdurchmessers." Sie gilt für den Frei-Punkt (unten rechts), die
// Marke der besten Freunde und der besonderen Person (unten links), die Mitteilung an
// Profilbildern (oben rechts) — und für die Mitteilung am runden „+"-Knopf. Es ist die Geometrie
// des App-Zeichens selbst (web/icons/icon.svg: Ring, Punkt unten rechts AUF dem Ring): jeder
// Punkt an einem Bild wiederholt das Zeichen.
//
// Bis Runde 8 hing der Punkt mit einem Versatz UEBER der Bildkante (0,12 des Punkts nach
// aussen): sein Mittelpunkt lag 0,557 des Durchmessers von der Bildmitte entfernt, also neben
// dem Kreis; die Mitteilung am angehefteten Gesicht war eine 18-px-Pille in der Ecke des
// Quadrats, groesser als jeder andere Punkt. Jetzt liegt jeder Mittelpunkt GENAU auf dem Rand
// (0,5 des Durchmessers von der Mitte, unter 45°), und jeder Punkt ist 0,28 des Durchmessers
// gross — derselbe Anteil wie bisher der Frei-Punkt. Keine Untergrenze, keine Rundung auf ganze
// Pixel (K4): an 26, 44, 52 und 92 px ist es dasselbe Bild, nur groesser.
//
//   kreisPunkt(durchmesser, ecke, stil) → Markup des Punkts, absolut im Traeger (durchmesser²,
//                                         position:relative)
//     ecke  'or' oben rechts · 'ur' unten rechts · 'ul' unten links · 'ol' oben links
//     stil  { farbe, inhalt?, luecke?, attribute?, ebene?, ring? }
//           luecke     Breite der durchsichtigen Luecke um den Punkt (Standard: 0,05 des
//                      Durchmessers, wie am Bild; 0 oder false = keine). Durchsichtig machen kann
//                      sie nur der TRAEGER: seine Flaeche bekommt kreisMaske(durchmesser, ecken)
//                      — man sieht dann durch die Luecke auf den Untergrund, nicht auf eine
//                      geratene Farbe (J11). personAvatar tut das selbst.
//           attribute  weitere Attribute als fertiger Text (data-role, aria-label …)
//           ebene      z-index (Standard 5)
//           ring       nur fuer einen Punkt OHNE Traeger darunter: Ring in dieser Farbe
//   kreisPunktLage(durchmesser, ecke) → { x, y, groesse, luecke } — Mittelpunkt im Traeger
//   kreisMaske(durchmesser, ecken, vorab?) → CSS der Maske fuer die Traegerflaeche
//     ecken  ['or', 'ur', …] oder [['or', luecke], …]; vorab = Maskenebenen davor
//
// Der „+"-Knopf (web/screens/crew.js) baut sich so: aussen ein durchsichtiger Knopf, darin die
// runde Flaeche mit Rand und Hintergrund als EIGENES Element mit kreisMaske(38, ['or']), daneben
// das Zeichen und kreisPunkt(38, 'or', { farbe: 'var(--orange)' }). Laege die Maske am Knopf
// selbst, schnitte sie auch den Punkt weg (eine Maske gilt fuer alle Kinder).
const KREIS_ECKEN = Object.freeze({ or: [1, -1], ur: [1, 1], ul: [-1, 1], ol: [-1, -1] });

export function kreisPunktLage(durchmesser, ecke = 'ur') {
  const d = Number(durchmesser) || 0;
  const [sx, sy] = KREIS_ECKEN[ecke] || KREIS_ECKEN.ur;
  const halb = d / 2;
  // cos 45° = sin 45°: der Punkt liegt auf der Diagonalen, genau einen Radius von der Mitte.
  const schraeg = halb * Math.SQRT1_2;
  return { x: halb + sx * schraeg, y: halb + sy * schraeg, groesse: px2(d * MASS.punkt), luecke: px2(d * MASS.spalt) };
}

export function kreisPunkt(durchmesser, ecke = 'ur', stil = {}) {
  const lage = kreisPunktLage(durchmesser, ecke);
  const g = lage.groesse;
  const luecke = stil.luecke === false ? 0 : (Number.isFinite(stil.luecke) ? stil.luecke : lage.luecke);
  const ring = stil.ring ? `box-shadow:0 0 0 ${px2(g * MASS.ring)}px ${stil.ring};` : '';
  const ecken = KREIS_ECKEN[ecke] ? ecke : 'ur';
  return `<span data-kreis-punkt="${ecken}" data-luecke="${luecke}"${stil.attribute ? ` ${stil.attribute}` : ''} style="position:absolute;left:${px2(lage.x - g / 2)}px;top:${px2(lage.y - g / 2)}px;width:${g}px;height:${g}px;border-radius:50%;background:${stil.farbe || 'var(--green)'};${ring}box-sizing:border-box;display:flex;align-items:center;justify-content:center;pointer-events:none;z-index:${Number.isFinite(stil.ebene) ? stil.ebene : 5}">${stil.inhalt || ''}</span>`;
}

// Ein Loch in der Traegerflaeche: der Punkt plus seine Luecke. Weiche Kante von 0,6 px, damit
// der Rand bei jeder Bildschirmdichte glatt ist (derselbe Wert wie seit Runde 6).
function kreisLoch(durchmesser, ecke, luecke) {
  const lage = kreisPunktLage(durchmesser, ecke);
  const spalt = Number.isFinite(luecke) ? luecke : lage.luecke;
  const r = lage.groesse / 2 + spalt;
  return `radial-gradient(circle ${(r + 0.6).toFixed(2)}px at ${lage.x.toFixed(2)}px ${lage.y.toFixed(2)}px, transparent ${r.toFixed(2)}px, #000 ${(r + 0.6).toFixed(2)}px)`;
}

// Mehrere Loecher = mehrere Masken, die sich ueberschneiden muessen (nur wo ALLE schwarz sind,
// bleibt Flaeche). `intersect` ist der heutige Name, `source-in` der aeltere von WebKit.
export function kreisMaske(durchmesser, ecken = [], vorab = []) {
  const ebenen = [...vorab, ...ecken.map((eintrag) => {
    const [ecke, luecke] = Array.isArray(eintrag) ? eintrag : [eintrag];
    return kreisLoch(durchmesser, ecke, luecke);
  })];
  if (!ebenen.length) return '';
  const liste = ebenen.join(',');
  return `-webkit-mask-image:${liste};-webkit-mask-composite:source-in;mask-image:${liste};mask-composite:intersect;`;
}


// v4 P0-3-9 / COMPONENT_RULES 2: Der Trenner im Avatar-Stapel WAR ein Ring HINTER dem
// Avatar (box-shadow) in der geratenen Farbe des Untergrunds.
//
// Runde 7 (J11, Jonathan): „bis nach ganz hinten durch, bzw. nur durch die bilder" — durch
// die Trennung soll man den UNTERGRUND sehen, nicht eine Farbe, die wie der Untergrund
// aussieht. Eine geratene Farbe ist schon auf getoentem Grund falsch und wird mit dem
// gekachelten Hintergrund (J12) endgueltig zu einem sichtbaren Fleck. Der Ring entfaellt
// deshalb ersatzlos; die Trennung stanzt `luecken()` nach jedem Zeichnen als echtes Loch
// aus dem Bild darunter.
//
// ALTLAST, offen gelegt statt stillschweigend mitgeschleppt: Die Funktion liefert seit
// Runde 7 nichts mehr, wird aber weiter aufgerufen — NACHGEZAEHLT in Welle 4:
//   web/screens/room.js      3 Aufrufe (Zeilen 171, 172, 3654)
//   web/ui/meet-panels.js    5 Aufrufe (Zeilen 464, 474, 830, 834, 1068)
//   web/ui/mitfahren.js      1 Aufruf  (Zeile 517)
// Zusammen 9 Aufrufe in 3 Dateien. Bis Welle 3 stand hier „4 Stellen" fuer meet-panels.js —
// es sind 5; wer nach der alten Liste aufgeraeumt haette, haette einen Aufruf stehenlassen.
// Zeilennummern altern, die Dateien nicht. Wer aufraeumt, zaehlt selbst nach:
//   grep -n "stackSeparator(" web/screens/room.js web/ui/meet-panels.js web/ui/mitfahren.js
// Diese Dateien gehoeren anderen Paketen; wer sie das
// naechste Mal anfasst, streicht den Aufruf UND das Argument ersatzlos. Solange sie bleiben,
// kostet der Aufruf nichts und zeichnet nichts — er ist keine stille Zusage, sondern hier
// benannt. Dasselbe gilt fuer `options.compact`, das avatarMark noch entgegennimmt und
// bewusst nicht mehr auswertet (siehe dort).
export function stackSeparator() {
  return '';
}

// v4 P0-3-10: Markierungen gehören auch in die Avatar-Stapel — dort waren sie überall
// unsichtbar, obwohl dieselben Personen zu sehen sind. Eine Quelle für alle Stapel.
export function stackMarker(person, size, settings, ring = 'var(--surface)') {
  if (!settings || !person?.id) return '';
  const marker = personMarker(person.id, settings);
  if (!marker) return '';
  // Fable 4 (J2): kein Ring mehr — die Markierung ist ein Zeichen unten links (avatarMark).
  // K4: kein „compact" mehr — es gibt genau eine Groessenregel (MASS).
  return avatarMark(marker, size, { ring });
}
export function miniAvatar(person, options = {}) {
  const groesse = Number(options.size) || 23;
  const m = avatarMasse(groesse);
  // v4 C.1: Auch die Karten-Stapel tragen den Marker-Layer.
  const marker = options.settings ? stackMarker(person, groesse, options.settings) : '';
  // v6 A03: eigene Stacking-Unit, damit die Dekoration nicht über den Nachbarn steigt.
  // K4: Breite, Schrift und Ueberlappung kommen aus derselben Regel wie ueberall.
  return `<span style="position:relative;flex:none;width:${groesse}px;height:${groesse}px;margin-left:-${m.ueberlapp}px;display:block;isolation:isolate"><span style="display:block;width:${groesse}px;height:${groesse}px;border-radius:50%;background:${person.color};color:var(--on-accent);font:600 ${m.schrift}px/${groesse}px 'Instrument Sans',sans-serif;text-align:center">${esc(person.initials)}</span>${marker}</span>`;
}

// options: {size, active, free, marker?: personMarker(...)-Ergebnis}
//
// ALTLAST, benannt statt still verschluckt — genau der Punkt, an dem Text und Code seit K4
// auseinanderliefen: Drei Optionen werden von Aufrufern weiter mitgegeben und hier bewusst
// UEBERGANGEN. Stand Welle 4, nachgezaehlt:
//   options.fontSize   45 Stellen in 8 Dateien (crew.js 6, karte.js 1, meet-details.js 1,
//                      new-meet.js 5, profile.js 12, room.js 16, meet-panels.js 3,
//                      mitfahren.js 1) — die Schrift kommt aus avatarMasse(size), weil genau
//                      diese Handwerte (7 / 8,5 / 11 / 16 …) der Grund waren, warum dieselbe
//                      Scheibe an zwei Stellen unterschiedlich aussah.
//   options.compact     9 Stellen (crew.js 1, room.js 5, meet-panels.js 2, mitfahren.js 1) —
//                      ein zweiter Groessensatz fuer kleine Bilder, siehe avatarMark().
//   options.dotBorder  15 Stellen (crew.js 5, karte.js 1, new-meet.js 1, profile.js 1,
//                      room.js 5, meet-panels.js 2) — der Frei-Punkt hat seit J11 keinen Ring
//                      mehr, sondern eine gestanzte Luecke.
// Alle drei beim naechsten Anfassen der Aufrufer ersatzlos streichen (fremde Dateien).
// Nachzaehlen statt glauben:
//   grep -rn "dotBorder\|compact:" web --include=*.js | grep -v components.js
// v7 spec/08 §1: Genau eine Stelle beantwortet die Frage „welches Bild hat diese
// Person/Gruppe?". Kein Screen darf daneben eine eigene Darstellung erzeugen.
// Runde 2: Ein Profilbild aus dem Baukasten ist nur ein Wort (`motiv:fuchs:see`). Hier wird
// es zur Bildadresse — damit zeigt JEDE Fläche, die heute ein Foto zeigt, auch das Tier.
export function bildVon(eintrag) {
  const quelle = eintrag?.photo || eintrag?.groupImage || null;
  if (istMotiv(quelle)) return motivBildAdresse(quelle);
  return typeof quelle === 'string' && quelle.trim() ? quelle.trim() : null;
}

// Die Bildflaeche einer Avatar-Unit: entweder das kanonische Foto oder der stabile
// Fallback aus Farbe und Initialen. Der Fallback ist kein Fehlerzustand — er sieht
// ueberall gleich aus und erzeugt keinen weissen Ring-/Abstandsfehler.
export function avatarFlaeche(eintrag, size, fontSize) {
  const bild = bildVon(eintrag);
  const rund = 'width:100%;height:100%;border-radius:50%;display:block;box-sizing:border-box';
  if (bild) {
    return `<img src="${esc(bild)}" alt="" aria-hidden="true" style="${rund};object-fit:cover;background:${eintrag?.color || 'var(--field)'}">`;
  }
  return `<span style="${rund};background:${eintrag?.color || 'var(--field)'};color:var(--on-accent);font:600 ${fontSize}px/${size}px 'Instrument Sans',sans-serif;text-align:center">${esc(eintrag?.initials || '')}</span>`;
}

// Fable 4 (J2/J3) — EINE Regel für jede Personenscheibe, an jeder Stelle der App:
//   Bildfläche: Foto oder Initialen auf Personenfarbe, rund (avatarFlaeche).
//   Rechts unten = ZUSTAND: grüner Frei-Punkt, automatisch aus person.free.active — nicht,
//     wenn die Person gerade in einem Meet ist. options.free (true/false) überstimmt.
//   Innen = AKTIV: grüner Kantenfade, automatisch aus person.activeMeetId; options.active überstimmt.
//   Links unten = WER SIE MIR IST: goldener Stern (bester Freund) oder das Zeichen der
//     besonderen Person (options.marker aus personMarker). KEIN Ring mehr — Jonathan (J2).
//   Der Trenner in Stapeln ist KEIN Ring mehr (Runde 7, J11): `luecken()` stanzt nach jedem
//     Zeichnen ein echtes Loch durch das Bild darunter — man sieht den Untergrund, nicht eine
//     geratene Farbe. `stackSeparator()` liefert deshalb nichts mehr.
//   Rechts oben = MITTEILUNG (R8-61): oranger Punkt, wenn options.mitteilung gesetzt ist.
//   Alle drei Punkte sind kreisPunkt(): Mittelpunkt auf dem Rand unter 45°, 0,28 des Bildes.
// Ebenen in der Unit: Bild → Aktiv-Fade (z 1) → Zeichen (z 3) → Frei-Punkt (z 5) → Mitteilung (z 6);
// isolation:isolate.
export function personAvatar(person, options = {}) {
  const size = options.size || 42;
  const m = avatarMasse(size);
  // K4: Auch die Schrift der Initialen gehoert zur einen Regel. Eine von Hand mitgegebene
  // Groesse wird bewusst UEBERGANGEN — genau diese Handwerte (7 / 8,5 / 11 / 16 …) waren der
  // Grund, warum dieselbe Scheibe an zwei Stellen unterschiedlich aussah.
  const fontSize = m.schrift;
  const inMeet = Boolean(person?.activeMeetId);
  const active = options.active ?? inMeet;
  const free = options.free ?? Boolean(person?.free?.active && !inMeet);
  const activeFade = active
    ? `<span style="position:absolute;inset:0;border-radius:50%;overflow:hidden;clip-path:circle(50% at 50% 50%);-webkit-clip-path:circle(50% at 50% 50%);pointer-events:none;z-index:1">${avatarEdgeFade(size <= 30 ? 'xs' : 's')}</span>`
    : '';
  // R8-61: Jeder Punkt am Bild ist ein kreisPunkt — Mittelpunkt auf dem Rand unter 45°, Groesse
  // 0,28 des Bildes. Frei unten rechts, Marke unten links (avatarMark), Mitteilung oben rechts.
  // Runde 6 (Jonathan): Statt eines Rings in der Papierfarbe steht eine LÜCKE zwischen Punkt und
  // Bild — sie wird aus dem Bild ausgestanzt (kreisMaske unten). Damit ist sie in jedem Thema und
  // auf jedem Untergrund richtig: Man sieht durch, statt eine geratene Farbe zu sehen.
  const freeDot = free
    ? kreisPunkt(size, 'ur', { farbe: 'var(--green)', attribute: 'data-role="frei-punkt"', ebene: 5 })
    : '';
  const mark = options.marker ? avatarMark(options.marker, size, { ohneRing: true }) : '';
  // Die Mitteilung (R8-61): ein Punkt, so gross wie die anderen — die Zahl steht in der Zeile
  // (R8-3), nicht auf dem Gesicht. options.mitteilung: true oder die Zahl der ungelesenen.
  const mitteilung = Number(options.mitteilung) > 0 || options.mitteilung === true;
  const mitteilungsPunkt = mitteilung
    ? kreisPunkt(size, 'or', { farbe: 'var(--orange)', attribute: 'data-role="mitteilung-punkt" aria-hidden="true"', ebene: 6 })
    : '';

  // J11: Die ERSTE Maskenebene ist die Luecke fuer ein Bild, das auf DIESEM liegt. Sie steht
  // als eigene Eigenschaft `--stapel-luecke` da, weil erst nach dem Zeichnen feststeht, ob und
  // wo ein Nachbar aufliegt — `luecken()` (unten, laeuft nach jedem Render) traegt sie ein.
  // Ohne Nachbar bleibt der Rueckfall eine volle Flaeche und aendert nichts. Dahinter je Punkt
  // ein Loch (kreisMaske): Mitte und Radius des Punkts, um den Spalt groesser.
  const ecken = [free && 'ur', options.marker && 'ul', mitteilung && 'or'].filter(Boolean);
  const maske = kreisMaske(size, ecken, ['var(--stapel-luecke, linear-gradient(#000,#000))']);
  return `<div data-role="person-avatar" data-free="${free}" data-active="${active}" style="position:relative;flex:none;width:${size}px;height:${size}px;isolation:isolate">
<div data-role="avatar-bild" style="width:${size}px;height:${size}px;border-radius:50%;position:relative;overflow:hidden;${maske}">${avatarFlaeche(person, size, fontSize)}${activeFade}</div>${freeDot}${mark}${mitteilungsPunkt}</div>`;
}

// =====================================================================================
// Runde 8 (R8-2) — das Bild eines Meet-Chats
// =====================================================================================
//
// Jonathan: „Person rund · Gruppe eckig mit KLEINEREM Eckradius · Meet-Chat = Zeichen des
// Meets auf getoenter Kachel (Look wie im Kalender)." Drei Arten, drei Formen, kein Wort noetig:
//   Person  Foto, rund                          personAvatar
//   Gruppe  Foto, eckig, Ecke 20 % der Kante    styles.css [data-role="gruppen-bild"]
//   Meet    Zeichen auf getoenter Kachel, 30 %   meetKachel
// Die Quelle des Zeichens ist dieselbe wie im Kalender (web/screens/meet-browser.js › iconTile
// → activityIconSvg aus ui/activity-icons.js), ebenso die Ecke (0,3 der Kante), die
// Zeichengroesse (0,46) und die Farben: Tinte auf warmem Grund, ein Loop blau auf Blau.
// Einziger Unterschied, mit Absicht: Der Grund ist var(--field) statt des Kalender-Papiers. Im
// Kalender liegt die Kachel auf einer weissen Karte, in der Chatliste direkt auf dem Papier —
// Papier auf Papier waere unsichtbar. --field steht zum Papier im selben Abstand wie das Papier
// zur weissen Karte (je Farbkanal 9/11/14 gegen 9/12/17), die Kachel liest sich an beiden Orten
// gleich. Kein Foto, kein Kreis: Sie ist auf den ersten Blick weder Person noch Gruppe.
const MEET_KACHEL = Object.freeze({ ecke: 0.3, zeichen: 0.46 });

export function meetKachel(meet, groesse = 44) {
  const kante = Number(groesse) || 44;
  const loop = Boolean(meet?.loop);
  const grund = loop ? 'var(--blue-tint)' : 'var(--field)';
  const farbe = loop ? 'var(--blue-dark)' : 'var(--ink)';
  return `<span data-role="meet-kachel" aria-hidden="true" style="flex:none;display:flex;align-items:center;justify-content:center;width:${kante}px;height:${kante}px;border-radius:${px2(kante * MEET_KACHEL.ecke)}px;background:${grund};pointer-events:none">${activityIconSvg(meet || {}, farbe, px2(kante * MEET_KACHEL.zeichen))}</span>`;
}

// =====================================================================================
// Runde 7 (J11) — die Luecke geht durch ALLE Bilder
// =====================================================================================
//
// Jonathan: „bis nach ganz hinten durch, bzw. nur durch die bilder." Wo Bilder gestapelt
// uebereinander liegen (Chatliste, Gruppen, Teilnahme, Mitfahren, Karte), war die Trennung
// bisher ein RING in einer geratenen Untergrundfarbe. Auf getoentem Grund, in Karten und
// erst recht auf dem gekachelten Hintergrund (J12) ist diese Farbe falsch.
//
// Jetzt wird die Trennung aus dem Bild DARUNTER ausgestanzt: man sieht durch die Luecke
// hindurch auf den Untergrund, nicht auf eine Farbe und nicht auf das naechste Bild.
//
// Warum nach dem Zeichnen und nicht beim Bauen? Die Ueberlappung wird in jeder Datei neu
// erfunden, und keine zwei sind gleich. Nachgemessen in Welle 4 (vorher stand hier „sechs
// Dateien, 0,21 bis 0,39" — beides falsch; die 0,39 gibt es nirgends):
//   profile.js 0,21 · meet-panels.js 0,27 und 0,30 · mitfahren.js 0,28 · crew.js 0,34
//   room.js gar kein Anteil, sondern feste 7 / 6 / 5 px je nach Groesse — bei 26 px sind das
//   0,27, bei 44 px nur noch 0,16. Also 0,16 bis 0,34, und in room.js sogar von der
//   Bildgroesse abhaengig.
// Ein geratener Wert wuerde die Luecke mal zu schmal, mal als Bissen aus dem Bild zeichnen.
// Gemessen stimmt sie in jedem Stapel — auch in einem, den es heute noch nicht gibt.
//
// Kosten: ein Lesedurchgang ueber die Bildscheiben der Seite (alle Messungen zuerst, dann
// alle Schreibvorgaenge — kein Layout-Pingpong).

// Ein Trenner, der den Untergrund nur NACHAHMT, ist an seiner FARBE zu erkennen: sie ist
// einer der neutralen Toene der App. Ein gruener oder bunter Ring dagegen ist eine Aussage
// („das bin ich", „aktiv") und bleibt unangetastet.
//
// Erkannt wird ueber die GEMESSENE Farbe, nicht ueber den Text im style-Attribut. Der Text
// war zweimal falsch: er ist nach dem ersten Umschreiben nicht mehr da, und ein Ring kann
// auch aus einem Stilblatt kommen, wo gar kein style-Attribut steht.
function neutraleToene() {
  const cs = getComputedStyle(document.documentElement);
  const toene = new Set();
  for (const name of ['--surface', '--paper', '--paper-soft', '--field', '--nav']) {
    const wert = String(cs.getPropertyValue(name) || '').trim();
    const hex = /^#([0-9a-f]{6})$/i.exec(wert);
    if (hex) {
      const z = parseInt(hex[1], 16);
      toene.add(`rgb(${(z >> 16) & 255}, ${(z >> 8) & 255}, ${z & 255})`);
    } else if (wert) {
      toene.add(wert.replace(/\s+/g, ' '));
    }
  }
  return toene;
}

// Die Zelle, in der diese Bildscheibe im Stapel sitzt: von der Scheibe aus nach oben, bis
// ein Element einen naechsten Nachbarn hat. Damit ist es egal, wie tief der Aufrufer die
// Scheibe eingepackt hat (ein bis drei Ebenen kommen in der App vor).
function stapelZelle(bild, root) {
  let knoten = bild;
  while (knoten && knoten !== root && !knoten.nextElementSibling) knoten = knoten.parentElement;
  return knoten && knoten !== root && knoten.nextElementSibling ? knoten : null;
}

// Lesephase: Was in dieser Zelle wuerde die frisch gestanzte Luecke wieder zuschmieren?
function trennerFinden(zelle, toene, gefunden) {
  if (!zelle) return;
  for (const knoten of [zelle, ...zelle.querySelectorAll('span,div')].slice(0, 4)) {
    if (gefunden.has(knoten)) continue;
    const cs = getComputedStyle(knoten);
    const schatten = /^(rgba?\([^)]*\))/.exec(cs.boxShadow || '');
    if (schatten && toene.has(schatten[1])) { gefunden.set(knoten, 'schatten'); continue; }
    // Die zweite Bauart: eine Scheibe in Papierfarbe HINTER dem Bild (position:absolute,
    // negativer Einzug). Sie ist derselbe geratene Untergrund, nur als Flaeche.
    if (cs.position === 'absolute' && toene.has(cs.backgroundColor)
      && (parseFloat(cs.top) < 0 || parseFloat(cs.left) < 0)) {
      gefunden.set(knoten, 'scheibe');
      continue;
    }
    // Die dritte Bauart, vom Pruefer gefunden: ein RAND (border) in einem neutralen Ton.
    // Er sieht aus wie die beiden anderen, kam aber bisher durch — die „+N"-Scheibe am Ende
    // eines Stapels trug genau so einen Ring, waehrend die Bilder direkt daneben keinen mehr
    // hatten. Nur runde Knoten: ein eckiger Rand ist eine Karte, keine Trennscheibe.
    const randBreite = parseFloat(cs.borderTopWidth) || 0;
    if (randBreite > 0 && randBreite <= 4 && toene.has(cs.borderTopColor)
      && /%|9999px/.test(cs.borderRadius || '')) {
      gefunden.set(knoten, 'rand');
    }
  }
}

// Liegt hinter diesem Nachbarn ueberhaupt etwas, das ein Bild verdecken KANN? Die Frage
// beantwortet der Baum allein — ohne den Baum zu VERMESSEN. Ohne diesen Vorfilter wird jede
// Bildscheibe der Seite vermessen, auch die in einer Zeile, auf die nur Text folgt.
// Gemessen in scratch/r7b-kosten.mjs (crew.home, 28 Bildscheiben; zwei Durchgaenge, beide
// Male dieselbe Zahl): 61 Messungen ohne den Vorfilter, 23 mit ihm. (Welle 4 stand hier 21;
// die zwei mehr sind die Ungelesen-Zahl, die seit Welle 5 ihre Luecke bekommt — markenFinden.)
//
// Und das Ergebnis ist NICHT Zeichen fuer Zeichen dasselbe: an genau einer Stelle ist der
// Vorfilter enger — an der, die der naechste Absatz erklaert. Bis Welle 3 stand
// hier die Zahl 25 und dazu die Behauptung, beide Staende kaemen auf dasselbe Ergebnis;
// beide Haelften hat der eigene Lauf widerlegt. Die gueltigen Zahlen stehen in der Ausgabe
// von r7b-kosten.mjs unter „ZAHLEN FUER DEN BERICHT" — wer sie hier aendert, liest sie dort
// ab, statt sie zu erinnern. r7b-kosten.mjs prueft diesen Absatz seit Welle 4 gegen die
// Messung: driften Text und Zahl wieder auseinander, faehrt der Lauf rot.
//
// Welle 3, offen gelegt statt verschwiegen: Der Vorfilter ist nicht nur billiger, er ist
// auch ENGER als ein Lauf ohne ihn. Gemessen (r7b-kosten.mjs, crew.home): an genau einer
// Stelle stanzt ein Lauf OHNE Vorfilter ein Loch, das es mit ihm nicht gibt — am Frei-Punkt,
// den web/screens/crew.js bei den angehefteten Gesichtern NEBEN das Bild haengt statt ihn von
// personAvatar zeichnen zu lassen. (Die Ungelesen-Zahl daneben war bis Welle 4 die zweite
// Stelle; seit Welle 5 stanzt markenFinden ihr Loch — siehe dort.)
//
// Das ist Absicht und kein Verlust: Die Regel heisst „die Luecke geht durch die BILDER".
// Wuerde jeder absolut gesetzte Nachbar zaehlen, bekaeme auch die Kamera-Plakette am grossen
// Profilbild ein Loch — gemessen, und dort ist es falsch (das Bild steht allein). Die
// richtige Stelle fuer den fehlenden Abstand am angehefteten Gesicht ist crew.js: wer den
// Frei-Punkt von personAvatar zeichnen laesst, bekommt die Luecke geschenkt. Steht im
// Bericht unter „fuer_chef". r7b-kosten.mjs sichert beides zu: an jedem Bild-auf-Bild sind
// ALT und NEU gleich, und die Abweichungen sind genau diese angehaengten Plaketten.
function nachbarDeckt(nachbar) {
  if (!nachbar) return false;
  if (nachbar.matches('[data-role="person-avatar"]')) return true;
  if (nachbar.querySelector('[data-role="person-avatar"]')) return true;
  // Die „+3"-Scheibe am Ende eines Stapels ist kein Bild, liegt aber genauso auf.
  return /^\+\d/.test((nachbar.textContent || '').trim());
}

// Welle 5 (J11, Jonathan: jede Marke mit transparenter Luecke durch das Bild): Eine Marke,
// die ein Aufrufer NEBEN das Bild haengt statt sie von personAvatar zeichnen zu lassen, liegt
// genauso auf dem Bild — die Ungelesen-Zahl an den angehefteten Gesichtern auf crew.home sass
// ohne jede Trennung direkt auf dem Foto. Gefunden wird sie im Baum, ohne zu messen: ein
// absolut gesetztes Geschwister der Bildscheibe mit eigener, nicht neutraler Farbe.
// Ausgenommen, und warum:
//   - Knoepfe und alles mit data-act: eine Bedienflaeche (Kamera/Stift am Profilbild) ist
//     keine Marke; dort waere ein Loch falsch (das Bild steht allein).
//   - Flaechen in einem neutralen Ton: das sind Kaertchen, keine Marken.
//   - Marken, die schon einen EIGENEN Trenner tragen (Ring oder Rand in einem neutralen Ton,
//     heute der angeheftete Frei-Punkt): die Trennung ist dort bereits sichtbar da; ob der
//     Ring einer echten Luecke weicht, entscheidet der Aufrufer (gemeldet an den Chef).
function markenFinden(bild, toene) {
  const eltern = bild.parentElement;
  if (!eltern || eltern.children.length < 2) return [];
  const raus = [];
  for (const k of eltern.children) {
    if (k === bild || k.matches('button,a,[data-act]') || k.querySelector('[data-role="person-avatar"]')) continue;
    const cs = getComputedStyle(k);
    if (cs.position !== 'absolute') continue;
    const farbe = cs.backgroundColor || '';
    if (!farbe || farbe === 'transparent' || /^rgba\([^)]*,\s*0\)$/.test(farbe) || toene.has(farbe)) continue;
    const schatten = /^(rgba?\([^)]*\))/.exec(cs.boxShadow || '');
    if (schatten && toene.has(schatten[1])) continue;
    if ((parseFloat(cs.borderTopWidth) || 0) > 0 && toene.has(cs.borderTopColor)) continue;
    raus.push(k);
  }
  return raus;
}

// =====================================================================================
// Runde 8 (R8-7) — der Ring gehoert zum Bild
// =====================================================================================
//
// Jonathan: „Jeder Punkt schneidet mit transparenter Luecke auch durch einen Ring (der Ring
// gehoert zum Bild)." Einige Stellen legen einen farbigen Ring UM ein Profilbild — die eigene
// Uebernahme in der Mitbringliste (room.js, meet-panels.js), das eigene Bild auf der Karte
// (map.js). Der Ring sitzt dort als box-shadow am Traeger, also AUSSERHALB der Bildscheibe. Die
// Luecke um Frei-Punkt und Marke wird aber aus der Bildscheibe gestanzt (Maske in personAvatar)
// — der Ring lief deshalb ungebrochen unter dem Punkt durch, als laege die Marke auf einem Reifen.
//
// Jetzt wird ein solcher Ring nach dem Zeichnen IN die Bildscheibe geholt: dieselbe Farbe,
// dieselbe Breite, als Innenring am Rand des Bildes (styles.css, [data-ring="im-bild"]). Er liegt
// damit unter derselben Maske und bekommt jede Luecke mit. Nur wo es noetig ist: an Bildern MIT
// Punkt oder Marke, nur ein einzelner, eng anliegender Ring (0 0 0 N px, N bis 4) in einer
// Nicht-Grundfarbe — ein Ring in Grundfarbe ist ein Trenner und gehoert trennerFinden. Gemessen
// wird erst, wenn der Stil einen solchen Ring ueberhaupt zeigt: eine Seite ohne farbigen Ring
// kostet keine einzige zusaetzliche Messung.
const RING_MUSTER = /^(rgba?\([^)]*\)) 0px 0px 0px ([\d.]+)px$/;

function schattenListe(wert) {
  const liste = [];
  let tiefe = 0;
  let start = 0;
  for (let i = 0; i < wert.length; i += 1) {
    if (wert[i] === '(') tiefe += 1;
    else if (wert[i] === ')') tiefe -= 1;
    else if (wert[i] === ',' && tiefe === 0) { liste.push(wert.slice(start, i).trim()); start = i + 1; }
  }
  liste.push(wert.slice(start).trim());
  return liste.filter(Boolean);
}

// Lesephase: Traegt ein Traeger dieses Bildes (bis zu drei Ebenen hoch) einen farbigen Ring?
function ringFinden(bild, toene) {
  // R8-61: jeder Punkt an diesem Bild (Frei, Marke, Mitteilung) — alle kommen aus kreisPunkt().
  if (!bild.querySelector(':scope > [data-kreis-punkt]')) return null;
  let knoten = bild.parentElement;
  for (let stufe = 0; stufe < 3 && knoten; stufe += 1, knoten = knoten.parentElement) {
    const liste = schattenListe(String(getComputedStyle(knoten).boxShadow || ''));
    const treffer = liste.length ? RING_MUSTER.exec(liste[0]) : null;
    if (!treffer) continue;
    const farbe = treffer[1];
    const breite = parseFloat(treffer[2]);
    if (!(breite > 0 && breite <= 4) || toene.has(farbe) || /,\s*0\)$/.test(farbe)) continue;
    const a = bild.getBoundingClientRect();
    const b = knoten.getBoundingClientRect();
    const eng = Math.abs(a.left - b.left) <= 1.5 && Math.abs(a.top - b.top) <= 1.5
      && Math.abs(a.right - b.right) <= 1.5 && Math.abs(a.bottom - b.bottom) <= 1.5;
    return eng ? { knoten, farbe, breite, rest: liste.slice(1).join(', ') || 'none' } : null;
  }
  return null;
}

// Schreibphase: Ring am Traeger abschalten, derselbe Ring innen am Bildrand.
function ringInsBild(bild, ring) {
  const flaeche = bild.querySelector(':scope > [data-role="avatar-bild"]');
  if (!flaeche) return;
  ring.knoten.style.setProperty('box-shadow', ring.rest, 'important');
  ring.knoten.dataset.luecke = 'ring-ins-bild';
  flaeche.style.setProperty('--bild-ring', `inset 0 0 0 ${ring.breite}px ${ring.farbe}`);
  bild.dataset.ring = 'im-bild';
}

export function luecken(root) {
  if (!root || typeof root.querySelectorAll !== 'function') return;
  const scheiben = [...root.querySelectorAll('[data-role="person-avatar"]')];
  if (!scheiben.length) return;
  const toene = neutraleToene();
  // 1. LESEN — alles auf einmal, damit kein Schreiben ein neues Layout erzwingt.
  const messungen = scheiben.map((bild) => {
    const ring = ringFinden(bild, toene);
    const zelle = stapelZelle(bild, root);
    const nachbar = zelle && nachbarDeckt(zelle.nextElementSibling) ? zelle.nextElementSibling : null;
    const marken = markenFinden(bild, toene).filter((k) => k !== nachbar);
    if (!nachbar && !marken.length) return { bild, zelle, nachbar: null, liegtDrauf: false, marken: [], ring };
    const eigen = bild.getBoundingClientRect();
    const markenRechtecke = marken.map((k) => k.getBoundingClientRect()).filter((r) => r.width > 0
      && r.left < eigen.right - 0.3 && r.right > eigen.left + 0.3
      && r.top < eigen.bottom - 0.3 && r.bottom > eigen.top + 0.3);
    if (!nachbar) return { bild, zelle, nachbar: null, eigen, liegtDrauf: false, marken: markenRechtecke, ring };
    const fremd = nachbar ? nachbar.getBoundingClientRect() : null;
    const liegtDrauf = Boolean(fremd) && fremd.width > 0 && fremd.height > 0 && eigen.width > 0
      && fremd.left < eigen.right - 0.5 && fremd.right > eigen.left + 0.5
      && fremd.top < eigen.bottom - 0.5 && fremd.bottom > eigen.top + 0.5;
    // Auch das ZEICHEN des Nachbarn liegt auf diesem Bild: die Plakette ragt unten links
    // aus seinem Bild heraus, der Frei-Punkt unten rechts. Ohne diese Loecher waere die
    // Luecke nur halb da (angesehen: shots/r7b-luecke-stapel.png, erster Stand).
    const fremdeZeichen = liegtDrauf
      ? [...nachbar.querySelectorAll('[data-kreis-punkt]')]
        .map((k) => k.getBoundingClientRect())
      : [];
    return { bild, zelle, nachbar, eigen, fremd, liegtDrauf, fremdeZeichen, marken: markenRechtecke, ring };
  });
  const trenner = new Map();
  for (const m of messungen) {
    if (!m.liegtDrauf) continue;
    trennerFinden(m.zelle, toene, trenner);
    trennerFinden(m.nachbar, toene, trenner);
  }
  // 2. SCHREIBEN — ab hier wird nichts mehr gemessen.
  for (const { bild, eigen, fremd, liegtDrauf, fremdeZeichen, marken } of messungen) {
    if (!liegtDrauf && !marken.length) {
      if (bild.style.getPropertyValue('--stapel-luecke')) bild.style.removeProperty('--stapel-luecke');
      if (bild.dataset.luecke) delete bild.dataset.luecke;
      continue;
    }
    const spalt = eigen.width * MASS.spalt;
    // Alles, was von oben auf dieses Bild faellt: das Nachbarbild und jedes Zeichen daran.
    const drauf = (liegtDrauf ? [fremd, ...fremdeZeichen] : []).filter((r) => r.width > 0
      && r.left < eigen.right - 0.3 && r.right > eigen.left + 0.3
      && r.top < eigen.bottom - 0.3 && r.bottom > eigen.top + 0.3);
    const loch = (r) => {
      const halb = r.width / 2 + spalt;
      const x = r.left + r.width / 2 - eigen.left;
      const y = r.top + r.height / 2 - eigen.top;
      const innen = Math.max(0, halb - 0.6);
      return `radial-gradient(circle ${halb.toFixed(1)}px at ${x.toFixed(1)}px ${y.toFixed(1)}px, transparent ${innen.toFixed(1)}px, #000 ${halb.toFixed(1)}px)`;
    };
    // Eine angehaengte Marke ist oft eine Pille (zweistellige Zahl), kein Kreis. Ihr Loch
    // ist deshalb eine Reihe gleich grosser Kreise entlang der langen Seite (Abstand hoechstens
    // 1 px) — zusammen die Pillenform plus Spalt. Eine runde Marke ergibt genau EIN Loch.
    const pille = (r) => {
      const d = Math.min(r.width, r.height);
      const lang = Math.max(r.width, r.height) - d;
      const schritte = Math.ceil(lang);
      const quer = r.width >= r.height;
      const kreise = [];
      for (let i = 0; i <= schritte; i += 1) {
        const a = schritte ? (lang * i) / schritte : 0;
        const left = quer ? r.left + a : r.left;
        const top = quer ? r.top : r.top + a;
        kreise.push({ width: d, height: d, left, top, right: left + d, bottom: top + d });
      }
      return kreise;
    };
    const loecher = [...drauf.map(loch), ...marken.flatMap(pille).map(loch)];
    // Mehrere Loecher stehen als Liste in EINER Eigenschaft — die Maske in personAvatar
    // setzt sie als eigene Ebenen ein (Komma-Liste), die sich alle ueberschneiden muessen.
    bild.style.setProperty('--stapel-luecke', loecher.join(','));
    bild.dataset.luecke = String(drauf.length + marken.length);
  }
  for (const [knoten, art] of trenner) {
    // `important` schlaegt auch eine Regel aus einem Stilblatt — ein Ring, der die Luecke
    // zuschmiert, darf nicht davon abhaengen, WO er herkommt.
    if (art === 'schatten') knoten.style.setProperty('box-shadow', 'none', 'important');
    else if (art === 'rand') knoten.style.setProperty('border-color', 'transparent', 'important');
    else knoten.style.setProperty('background-color', 'transparent', 'important');
    // Der Wert bleibt `trenner-aus` (mehrere Prueflaeufe greifen genau darauf zu); die
    // Bauart steht daneben, damit nachvollziehbar ist, WAS abgeschaltet wurde.
    knoten.dataset.luecke = 'trenner-aus';
    knoten.dataset.trennerArt = art;
  }
  // R8-7: farbige Ringe am Bild in die Bildscheibe holen (siehe ringFinden).
  for (const { bild, ring } of messungen) if (ring) ringInsBild(bild, ring);
}

// Wie groß die Plakette einer Markierung ist — an EINER Stelle, damit die Lücke im Bild und die
// Plakette selbst nie auseinanderlaufen.
// K4: genau ein Anteil, keine Untergrenze, kein zweiter Satz fuer kleine Bilder.
function markePlatte(avatarSize) {
  return px2((Number(avatarSize) || 0) * MASS.zeichen);
}

// Fable 4: Markierung am Avatar, unten links — goldener Stern (bester Freund) oder Zeichen/
// Emoji der besonderen Person.
//
// Runde 3 (C1, Jonathan): „Das Icon links ist so klein und filigran, unübersichtlich — besser
// und erkennbarer machen." Das Zeichen war ein nackter 12-px-Pfad mit heller Kontur; auf einem
// Foto oder einer Farbfläche verschwand er. Jetzt ist es eine kleine, VOLLE Plakette in der
// Farbe der Markierung (Gold bzw. die gewählte Farbe) mit dem Zeichen in Weiß — dieselbe
// Formensprache wie der grüne Frei-Punkt rechts unten, nur links. Ein Ring in der Farbe des
// Untergrunds trennt sie vom Bild. Kein Ring um den Avatar (J2 bleibt), kein weißes Plättchen.
// Ein gewähltes Emoji steht auf einer hellen Plakette, weil es seine Farben selbst mitbringt.
export function avatarMark(marker, avatarSize = 42, options = {}) {
  if (!marker) return '';
  const best = marker.kind === 'best';
  const emoji = !best && marker.emoji ? marker.emoji : '';
  const farbe = marker.color || (best ? BEST_FRIEND_GOLD : MARKER_COLOR_DEFAULT);
  // K4: Plakette, Zeichen, Ring und Versatz sind Anteile — an jeder Stelle dieselben.
  // `options.compact` wird von Aufrufern noch mitgegeben, aber NICHT mehr ausgewertet: ein
  // zweiter Groessensatz fuer kleine Bilder war genau der Fehler, den K4 beschreibt. Der
  // Wert wird nicht heimlich verschluckt, sondern steht hier als Altlast (Aufrufer:
  // room.js, meet-panels.js) — beim naechsten Anfassen dort ersatzlos streichen.
  // R8-7: Die Plakette ist so gross wie der Frei-Punkt und traegt ihr Zeichen in JEDER Groesse
  // (die fruehere Untergrenze, unter der sie ein voller Punkt wurde, ist gestrichen — siehe MASS).
  // R8-61: Sie ist ein kreisPunkt unten links — Mittelpunkt auf dem Rand unter 45°. Der fruehere
  // Ueberstand ueber die Bildkante (MASS.versatz) ist damit abgeloest; Frei-Punkt und Marke liegen
  // spiegelgleich auf dem Rand (scratch/r8b-form.mjs misst es an 26/44/52/92 px).
  const plate = markePlatte(avatarSize);
  let inhalt = '';
  if (emoji) {
    inhalt = `<span style="font-size:${px2(plate * MASS.symbol)}px;line-height:1">${esc(emoji)}</span>`;
  } else {
    const px = px2(plate * MASS.symbol);
    const svg = SPECIAL_SYMBOLS[best ? (SPECIAL_SYMBOLS[marker.symbol] ? marker.symbol : 'stern') : specialSymbolKey(marker.symbol)]('var(--on-accent)');
    inhalt = svg.replace(/width="[\d.]+" height="[\d.]+"/, `width="${px}" height="${px}"`);
  }
  const attrs = best
    ? `aria-label="${esc(tx('Bester Freund'))}" data-role="best-zeichen" data-marker="best-star"`
    : `aria-label="${esc(tx('Besondere Person'))}" data-role="special-zeichen" data-marker="special-symbol"`;
  // Runde 6 (Jonathan): Am Avatar wird die Trennung als LÜCKE aus dem Bild gestanzt
  // (personAvatar) — dort braucht die Plakette keinen Ring mehr. Steht sie ausnahmsweise allein
  // (ohne Bild darunter), bleibt der alte Ring, damit sie nicht in der Fläche verschwimmt.
  const ring = options.ohneRing ? '' : (options.ring || 'var(--paper)');
  return kreisPunkt(avatarSize, 'ul', { farbe: emoji ? 'var(--surface)' : farbe, inhalt, attribute: attrs, ebene: 3, ring });
}

// Altname (nur besondere Person) — bleibt für bestehende Aufrufer.
export function specialAvatarMark(marker, avatarSize = 42, options = {}) {
  if (!marker || marker.kind !== 'special') return '';
  return avatarMark(marker, avatarSize, options);
}
// v13-Altfunktion (Marker vor dem Namen) — v14 zeigt Marker als Plättchen am Avatar
// (markerPlate/personMarker) und nur bei der besonderen Person einen Label-Chip nach dem Namen.
export function nameMarkers() {
  return '';
}

// v6 A04: Der Chip trägt die GEWÄHLTE Farbe als transparent getönte Fläche mit klarer
// Kontur — vorher war der Grund fest var(--paper-soft) (blasses Lavendel aus einer alten
// Standardfarbe) und der Chip damit auf weißer Karte kaum zu sehen. Ohne Label
// erscheint weiterhin gar nichts.
export function hexToRgba(hex, alpha) {
  const v = String(hex || '').replace('#', '');
  if (v.length !== 6) return `rgba(33,30,26,${alpha})`;
  return `rgba(${parseInt(v.slice(0, 2), 16)},${parseInt(v.slice(2, 4), 16)},${parseInt(v.slice(4, 6), 16)},${alpha})`;
}

export function specialLabelChip(marker) {
  const label = (marker?.kind === 'special' ? marker.label : '') || '';
  if (!label.trim()) return '';
  const farbe = marker.color || MARKER_COLOR_DEFAULT;
  return `<span style="flex:none;font-size:11px;font-weight:650;letter-spacing:.01em;color:${farbe};background:${hexToRgba(farbe, 0.14)};border:1px solid ${hexToRgba(farbe, 0.38)};box-sizing:border-box;padding:2px 8px;border-radius:7px;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;max-width:96px">${esc(label.trim())}</span>`;
}// --- CrewCard (reference/source/CrewCard.dc.html) ---
// crew: aus repo.getCrews(); members: Personen ohne mich; meta/aktiv abgeleitet.

// ALTLAST, benannt statt verschwiegen: crewCard(), newCrewCard(), crewBrauchtFreundeCard(),
// CREW_KACHEL und miniAvatar() ruft nach dem Crew-Umbau (Runde 7) niemand mehr auf — im
// ganzen web/ geprueft. Sie sind auf die neue Groessenregel mitgezogen, damit sie nicht
// falsch dastehen, aber sie zeichnen heute nichts. Wegraeumen ist eine Chef-Entscheidung
// (mitten in der Welle koennte ein anderes Paket daran haengen) und steht im Bericht.
// miniAvatar() nimmt bewusst KEIN options.separator entgegen — ein Trennring ist seit J11
// nicht mehr vorgesehen, und ein Wert, der still verfaellt, waere eine Zusage ohne Wirkung.
export function crewCard(crew, members, options = {}) {
  const shown = members.slice(0, 3);
  const extraCount = members.length - shown.length;
  const isActive = Boolean(options.activeMeet);
  const meta = options.meta || '';
  const fade = isActive ? cardEdgeFade(18) : '';
  const badge = crew.unread
    ? `<div style="position:absolute;top:-8px;right:-6px;min-width:21px;height:21px;border-radius:11px;background:var(--orange);color:var(--on-accent);font:650 11.5px/21px 'Instrument Sans',sans-serif;text-align:center;padding:0 6px;z-index:2">${crew.unread}</div>`
    : '';
  return `<button data-act="open-crew" data-crew="${crew.id}" style="position:relative;flex:none;width:128px;background:var(--surface);border-radius:18px;padding:14px 15px 13px;display:flex;flex-direction:column;gap:9px;font-family:'Instrument Sans',sans-serif;border:1px solid var(--ink-a09);box-shadow:0 1px 2px var(--shadow-04);color:var(--ink);text-align:left;appearance:none;cursor:pointer">
${fade}${badge}
<div style="display:flex;align-items:center;padding-left:6px;position:relative;z-index:1;pointer-events:none">${shown.map((person) => miniAvatar(person, { settings: options.settings })).join('')}${extraCount > 0 ? `<div style="width:27px;height:27px;border-radius:50%;background:var(--field);box-sizing:border-box;color:var(--muted);font:600 ${avatarMasse(27).schrift}px/27px 'Instrument Sans',sans-serif;text-align:center;margin-left:-${avatarMasse(27).ueberlapp}px;flex:none">+${extraCount}</div>` : ''}</div>
<div style="display:flex;flex-direction:column;gap:2px;position:relative;z-index:1;pointer-events:none">
<div style="font-size:14px;font-weight:650;letter-spacing:-.01em;white-space:nowrap;overflow:hidden;text-overflow:ellipsis">${esc(crew.name)}</div>
<div style="font-size:12px;font-weight:550;color:${isActive ? 'var(--green-dark)' : 'var(--ink-soft)'};white-space:nowrap;overflow:hidden;text-overflow:ellipsis">${esc(meta)}</div>
</div></button>`;
}

// Auftrag §3.2: Die Kachel in der Crew-Reihe hat IMMER genau die Maße einer Crew-Karte —
// egal ob eine Crew da ist oder nicht. Vorher war sie 118 statt 128 breit und bekam ihre
// Höhe nur geliehen, indem die Reihe sie an den echten Karten streckte; ohne Crew fiel sie
// deshalb in sich zusammen und die Seite sprang. Die Maße stehen hier EINMAL und gelten
// für beide Kacheln.
export const CREW_KACHEL = { breite: 128, hoehe: 119 };

function crewKachelRahmen(act, innen, { gestrichelt = true } = {}) {
  return `<button data-act="${act}" style="flex:none;width:${CREW_KACHEL.breite}px;height:${CREW_KACHEL.hoehe}px;border:1.5px ${gestrichelt ? 'dashed' : 'solid'} var(--ink-a22);border-radius:18px;display:flex;flex-direction:column;align-items:flex-start;justify-content:center;gap:7px;color:var(--muted);padding:0 14px;box-sizing:border-box;background:transparent;cursor:pointer;font-family:'Instrument Sans',sans-serif;appearance:none;text-align:left">${innen}</button>`;
}

export function newCrewCard() {
  return crewKachelRahmen('new-crew', `<span style="width:30px;height:30px;border-radius:50%;background:var(--field);display:flex;align-items:center;justify-content:center;font-size:16px;font-weight:600;pointer-events:none">+</span>
<span style="font-size:12px;font-weight:650;white-space:nowrap;pointer-events:none">${tx('Neue Gruppe')}</span>`);
}

// Auftrag §3.3: Ohne Freunde gibt es die Möglichkeit, eine Crew zu erstellen, gar nicht —
// eine Crew ohne Menschen ergibt keinen Sinn. An ihrer Stelle steht der Hinweis, zuerst
// Freunde hinzuzufügen. Gleiche Kachel, gleiche Maße, kein Sprung.
export function crewBrauchtFreundeCard() {
  return crewKachelRahmen('go-friend-add', `<span style="width:30px;height:30px;border-radius:50%;background:var(--field);display:flex;align-items:center;justify-content:center;flex:none;pointer-events:none"><svg width="16" height="16" viewBox="0 0 24 24" fill="none"><circle cx="10" cy="9" r="3.6" stroke="var(--muted)" stroke-width="1.8"></circle><path d="M3.8 19.5a6.2 6.2 0 0 1 12.4 0" stroke="var(--muted)" stroke-width="1.8" stroke-linecap="round"></path><path d="M19 8v5.6M16.2 10.8h5.6" stroke="var(--muted)" stroke-width="1.8" stroke-linecap="round"></path></svg></span>
<span style="font-size:11.5px;font-weight:650;line-height:1.3;pointer-events:none">${tx('Zuerst Freunde<br>hinzufügen')}</span>`);
}

// Auftrag §3.1/§3.4: EIN leerer Zustand für alle Listen — ein kurzer Satz und direkt
// daneben die Möglichkeit zu handeln. Vorher stand an diesen Stellen nichts außer einem
// Strich; das sah nach einem Fehler aus, nicht nach einem Anfang.
export function leerZeile({ text, aktLabel, act, data = {} }) {
  const attrs = Object.entries(data).map(([key, value]) => `data-${key}="${esc(value)}"`).join(' ');
  return `<div style="display:flex;align-items:center;gap:12px;padding:15px 15px 15px 17px;border-radius:18px;border:1.5px dashed var(--ink-a18);background:var(--paper-soft)">
<span style="flex:1;min-width:0;font:500 13px/1.45 'Instrument Sans',sans-serif;color:var(--ink-soft);text-wrap:pretty">${esc(text)}</span>
${aktLabel ? `<button data-act="${act}" ${attrs} data-treffer style="flex:none;border:0;background:var(--green);color:var(--on-accent);font:650 12.5px/1 'Instrument Sans',sans-serif;padding:11px 14px;border-radius:999px;cursor:pointer;appearance:none"><span style="pointer-events:none">${esc(aktLabel)}</span></button>` : ''}
</div>`;
}

// --- PersonRow (reference/source/PersonRow.dc.html) ---

// =====================================================================================
// Runde 7 (K3) — die Zeile springt nicht mehr
// =====================================================================================
//
// Jonathan: „Die Zeilen unter dem Gruppennamen brauchen eine feste Hoehe … Wenn der Text mal
// einzeilig, mal zweizeilig ist, springt die ganze Zeile."
//
// Gemessen: Der Name stand mal in der Mitte der Bildspalte (Zeile ohne zweite Zeile), mal
// darueber (Zeile mit). Zwei Zeilen untereinander trugen den Namen dadurch auf zwei
// verschiedenen Hoehen — die Liste hatte keine Namensachse. Das ist der Grund, warum sich
// Listen „unruhig" lesen, obwohl jede einzelne Zeile fuer sich richtig aussieht.
//
// Die Textspalte hat deshalb IMMER dieselbe Hoehe: Name + Abstand + zweite Zeile. Fehlt die
// zweite Zeile, bleibt ihr Platz leer — reserviert, nicht nachtraeglich gefangen. Dieselben
// Werte gelten in web/styles.css fuer die Zeilen der Chatliste (Person, Gruppe, Runde), die
// ein anderes Paket baut: eine Regel, zwei Orte, die sie anwenden.
export const ZEILE_NAME_HOEHE = 20;    // Zeilenhoehe des Namens (15 px Schrift)
export const ZEILE_ZWEITE_HOEHE = 17;  // Zeilenhoehe der zweiten Zeile (12,5 px Schrift)
export const ZEILE_TEXT_ABSTAND = 2;
export const ZEILE_TEXT_HOEHE = ZEILE_NAME_HOEHE + ZEILE_TEXT_ABSTAND + ZEILE_ZWEITE_HOEHE;


// v5 A31c: Der gruene Frei-Punkt IST der empfangene Frei-Hinweis. Von wem man ihn sehen
// moechte, regelt die persoenliche Empfangseinstellung — der Aufrufer kann ihn deshalb
// ausdruecklich unterdruecken (options.free). Ohne Angabe bleibt das bisherige Verhalten.
export function personRow(person, settings, options = {}) {
  const marker = personMarker(person.id, settings);
  const freiPunkt = options.free ?? Boolean(person.free?.active && !person.activeMeetId);
  const status = options.status ?? person.status ?? '';
  // Runde 4 (E6/B5): Die Zeile unter dem Namen kann eine Art tragen. 'frei' steht klar in Grün
  // (Jonathan: „dass man wirklich sieht, dass sie frei sind, und es nicht so ein grauer Text ist"),
  // 'belegt' ruhig und leise mit einem hohlen Punkt („Keine Zeit bis 17:00"). Ohne Art wie bisher.
  const statusArt = options.statusArt || 'text';
  const statusStil = statusArt === 'frei'
    ? 'font-weight:650;color:var(--green-dark)'
    : 'font-weight:500;color:var(--muted)';
  const statusZeichen = statusArt === 'frei'
    ? '<span style="flex:none;width:7px;height:7px;border-radius:50%;background:var(--green)"></span>'
    : statusArt === 'belegt'
      ? '<span style="flex:none;width:7px;height:7px;border-radius:50%;box-shadow:inset 0 0 0 1.5px var(--muted-light)"></span>'
      : '';
  const badge = person.unread
    ? `<div style="min-width:21px;height:21px;border-radius:11px;background:var(--orange);color:var(--on-accent);font:650 11.5px/21px 'Instrument Sans',sans-serif;text-align:center;padding:0 6px;flex:none">${person.unread}</div>`
    : '';
  return `<button data-act="${options.action || 'open-person'}" data-person="${person.id}" style="display:flex;align-items:center;gap:12px;padding:9px 0;font-family:'Instrument Sans',sans-serif;color:var(--ink);border:0;background:transparent;width:100%;text-align:left;appearance:none;cursor:pointer">
<span style="pointer-events:none;display:contents">${personAvatar(person, { active: Boolean(person.activeMeetId), free: freiPunkt, marker })}</span>
<div data-role="zeilen-text" style="flex:1;min-width:0;display:flex;flex-direction:column;gap:${ZEILE_TEXT_ABSTAND}px;height:${ZEILE_TEXT_HOEHE}px;justify-content:flex-start;pointer-events:none">
<div style="display:flex;align-items:center;gap:5px;min-width:0;height:${ZEILE_NAME_HOEHE}px"><span style="font-size:15px;font-weight:600;letter-spacing:-.01em;white-space:nowrap;overflow:hidden;text-overflow:ellipsis">${esc(person.name)}</span>${specialNameMarker(marker)}${specialLabelChip(marker)}</div>
<div data-role="person-status" data-art="${status ? statusArt : 'leer'}" style="display:flex;align-items:center;gap:6px;min-width:0;height:${ZEILE_ZWEITE_HOEHE}px;font-size:12.5px;${statusStil}">${status ? `${statusZeichen}<span style="white-space:nowrap;overflow:hidden;text-overflow:ellipsis">${esc(status)}</span>` : ''}</div>
</div>${badge}</button>`;
}

// --- FreiKreis (reference/source/FreiKreis.dc.html + Vertrag §3) ---
// ruhe: matter grüner Punkt ohne Inhalt. frei: gleicher Punkt mit weißem „Frei".
// Position/Größe identisch in beiden Zuständen; große Touch-Fläche via Padding.

// v3.2 Ü2: Der ruhende Button trägt den geplanten Zustand selbst.
//   – sofort frei      → voll grün, weißes „Frei"
//   – geplant („Frei ab") → zeitbasierter grüner Fortschritt von unten, darunter dezent
//     „frei ab HH:MM" und bei kurzen Zeiträumen zusätzlich „in N Min."
//   – inaktiv          → helle Fläche mit grüner Kontur
// Der Fortschritt wird live aktualisiert (Ticker in bindFreiControl) und läuft bei
// Fälligkeit in den echten Frei-Zustand über.
// v4 P0-2d/P0-2e: Der Zustandswechsel läuft als BENANNTE CSS-Animation. Eine Transition
// kann hier grundsätzlich nicht laufen, weil jeder Rerender den Knoten austauscht und ein
// frisch eingefügtes Element keinen Startwert hat. Eine Keyframe-Animation startet dagegen
// auch am neuen Knoten; das `from` trägt den vorherigen Zustand, das implizite `to` ist der
// eigene Stil des Elements. Ein negatives animation-delay lässt sie über mehrere Renders
// hinweg an derselben Stelle weiterlaufen.
export function freiKreis(freeState, options = {}) {
  // v5 A06: Das Grün ist ein INSET-Ring, dessen Spread von der Kante nach innen wächst.
  // FILL_MAX ist der halbe Kreisdurchmesser (64/2) plus etwas Reserve, damit die Mitte
  // sicher geschlossen ist. Der Hintergrund bleibt in allen Zuständen weiß — dadurch
  // ist der Übergang eine echte radiale Bewegung und kein Farbwechsel der Fläche.
  // v6 A06: `--freiFill` ist der Anteil der grünen Außenkante, 0 % = ganz hell,
  // 100 % = ganz grün. Der Verlauf setzt drei Stopps: innen Weiß, dann eine
  // Übergangszone von FEATHER Prozentpunkten Breite, dann volles Grün. Genau diese Zone
  // fehlte vorher — der inset-Schatten konnte sie gar nicht erzeugen.
  // v7 A08: --freiP ist der Fortschritt 0..1, NICHT mehr eine wandernde Grenze.
  // Die drei Stopps stehen fest; nur ihre Deckkraft waechst — aussen frueher und
  // staerker, zur Mitte spaeter und weicher. So faerbt sich die GANZE Flaeche
  // kontinuierlich, statt dass eine Kante nach innen laeuft.
  const GRUEN = '27,158,95';
  const deckung = (faktor, versatz) => `clamp(0, calc(var(--freiP, 0) * ${faktor} - ${versatz}), 1)`;
  const FEATHER = 13;      // nur noch fuer den Halte-Ring unten in dieser Datei
  // `--freiInnen` ist der Radiusanteil, der noch hell ist: 100 % = ganz hell,
  // 0 % = ganz grün. Die Eigenschaft ist per @property als <percentage> REGISTRIERT —
  // nur dann interpoliert der Browser sie flüssig. Ein direkt animierter Farbverlauf
  // sprang stattdessen von Keyframe zu Keyframe (gemessen vier sichtbare Stufen),
  // weil die ausgerechneten Stopps gemischte Einheiten (0px und %) tragen.
  const fuellung = (anteil) => `--freiP:${(Math.max(0, Math.min(100, anteil)) / 100).toFixed(3)}`;
  // Der Verlauf selbst ist in allen Zuständen derselbe — nur --freiInnen wandert.
  // max() haelt die Stopps in Reihenfolge, wenn die Fuellung die Mitte erreicht —
  // sonst rutschen die inneren Stopps rechnerisch ins Negative.
  // Weiss liegt als Grundfarbe darunter; der Verlauf ist die getoente Schicht darueber.
  const VERLAUF = 'background-color:var(--surface);background-image:radial-gradient(circle closest-side,'
    + ` rgba(${GRUEN},${deckung(1.45, '0.45')}) 0%,`
    + ` rgba(${GRUEN},${deckung(1.45, '0.22')}) 45%,`
    + ` rgba(${GRUEN},${deckung(1.60, '0')}) 100%)`;
  const FREI_LOOKS = {
    idle: `${fuellung(0)};${VERLAUF};border:1.5px solid var(--green-a42);box-shadow:0 1px 4px var(--shadow-07)`,
    pending: `${fuellung(0)};${VERLAUF};border:1.5px solid var(--green);box-shadow:0 1px 4px var(--shadow-07)`,
    active: `${fuellung(100)};${VERLAUF};border:1.5px solid var(--green);box-shadow:0 2px 8px var(--green-a22)`,
  };
  // Runde 2 (Jonathan): „Der Free-Text muss immer erkennbar sein, nicht einfach von grün
  // zu weiß werden." Vorher sprang die Schriftfarbe mit dem ZUSTAND, die Füllung aber lief
  // animiert hinterher — einen Moment lang stand weiße Schrift auf fast weißem Grund.
  // Jetzt hängt die Schrift an DERSELBEN Größe wie die Füllung (--freiP): Sie bleibt
  // dunkelgrün, bis die Mitte wirklich grün ist, und wechselt dann in einem kurzen Stück
  // auf Weiß. Ein weicher Schein in der jeweils anderen Farbe trägt sie durch die Mitte.
  // Angesehen und gemessen (scratch/r2-frei-lesbar.mjs): Jedes Überblenden der Schriftfarbe
  // erzeugt blasses Grün-auf-Grün. Deshalb ist der Wechsel ein echter SCHRITT, und zwar bei
  // 82 % Füllung — dort, wo dunkelgrüne und weiße Schrift auf der Knopfmitte gleich viel
  // Kontrast haben (beide rund 2,6:1). Davor trägt ein heller Schein die dunkle Schrift,
  // danach ein dunkler die weiße.
  //
  // Runde 3 (O1, Jonathan): „Bei der Animation fadet die Textfarbe nicht — sie ist die ganze
  // Zeit grün und springt am Ende von Grün zu Weiß." Der Schritt war die Antwort auf das blasse
  // Grün-auf-Grün; als Bild wirkt er aber wie ein Fehler. Jetzt blendet die Schrift WEICH
  // (sanfte S-Kurve) über das Stück der Füllung, in dem die Mitte grün wird (--freiP .52 → .92),
  // und die Lesbarkeit trägt der Schein: Der helle Schein um die dunkle Schrift nimmt im selben
  // Maß ab, wie der dunkle um die helle zunimmt — in der Mitte des Wechsels stützt ein kurzer,
  // etwas kräftigerer dunkler Schein die Buchstabenkanten. Kein Sprung, kein Flackern.
  const FREI_S = 'clamp(0,(var(--freiP,0) - .52) * 2.5,1)';
  const FREI_G = `(${FREI_S} * ${FREI_S} * (3 - 2 * ${FREI_S}))`;
  const FREI_MITTE = `(4 * ${FREI_G} * (1 - ${FREI_G}))`;
  const SCHRIFT = `color:color-mix(in srgb,var(--on-accent) calc(${FREI_G} * 100%),var(--green-dark));`
    // Der Schein ist schmal (3 px) — breiter lässt die Schrift unscharf wirken (angesehen).
    + `text-shadow:0 0 3px color-mix(in srgb,var(--surface) calc((1 - ${FREI_G}) * 70%),transparent),`
    + `0 0 3px color-mix(in srgb,var(--shadow-30) calc(${FREI_G} * 100%),transparent),`
    + `0 0 1.5px color-mix(in srgb,var(--shadow-30) calc(${FREI_MITTE} * 100%),transparent)`;

  // Die Keyframes tragen nur das `from`; das implizite `to` ist der eigene Stil des
  // Knotens. So läuft der Übergang auch an einem frisch eingefügten Element (jeder
  // Render ersetzt den Teilbaum — eine CSS-Transition hätte keinen Startwert).
  // v6 A06: Der Übergang animiert den RADIALEN VERLAUF in mehreren Stufen. Ein
  // Farbverlauf lässt sich nicht linear interpolieren, deshalb werden Zwischenschritte
  // ausgeschrieben — das Auge sieht eine ruhige, weiche Bewegung von außen nach innen,
  // und die innere Grenze bleibt in jeder Stufe eine Feather-Zone, nie eine Schnittkante.
  // v6 A06: Registrierte Eigenschaft — sonst interpoliert der Browser den Verlauf nicht.
  // Die Keyframes tragen nur das `from`; das implizite `to` ist der eigene Stil des
  // Knotens. So läuft der Übergang auch an einem frisch eingefügten Element.
  const FREI_KEYFRAMES = '<style>'
    + '@property --freiP{syntax:"<number>";inherits:false;initial-value:0}'
    + '@keyframes freiFromIdle{from{--freiP:0;border-color:var(--green-a42);'
    + 'box-shadow:0 1px 4px var(--shadow-07)}}'
    // v7 A10: Der Wechsel aus dem GEPLANTEN Zustand beginnt bei dem Fuellstand, den der
    // Antrieb zuletzt geschrieben hat — nicht bei 0. Sonst setzt der Keyframe den bereits
    // gefuellten Knopf zurueck und er faerbt sich ein zweites Mal.
    + '@keyframes freiFromPending{from{border-color:var(--green);'
    + 'box-shadow:0 1px 4px var(--shadow-07)}}'
    + '@keyframes freiFromActive{from{--freiP:1;border-color:var(--green);'
    + 'box-shadow:0 2px 8px var(--green-a22)}}'
    // A07: ruhiges Atmen NACH AUSSEN — nur box-shadow, kein transform und keine
    // Größenänderung, damit sich die Liste darunter nicht verschiebt.
    + '@keyframes freiPuls{0%,100%{box-shadow:0 0 0 0 var(--green-a30)}'
    + '50%{box-shadow:0 0 0 9px var(--green-a00)}}'
    + '</style>';

  const active = Boolean(freeState?.active);
  const pending = active && Boolean(freeState?.pending) && Boolean(freeState?.fromAt);
  const hidden = options.hidden ? 'visibility:hidden;' : '';

  let progress = 0;
  if (pending) {
    const start = Number(freeState.setAt) || (Number(freeState.fromAt) - 60 * 60000);
    const span = Math.max(1, Number(freeState.fromAt) - start);
    progress = Math.max(0, Math.min(1, (Date.now() - start) / span));
  }

  const state = active && !pending ? 'active' : pending ? 'pending' : 'idle';
  const look = FREI_LOOKS[state];

  // options.anim = { from: 'idle'|'pending'|'active', elapsed: ms, ms: Dauer }
  const anim = options.anim && FREI_LOOKS[options.anim.from] && options.anim.from !== state
    ? options.anim
    : null;
  const animMs = Math.max(1, Math.round(Number(anim?.ms) || 340));
  const animAt = Math.max(0, Math.min(animMs - 1, Math.round(Number(anim?.elapsed) || 0)));
  const animName = anim ? `freiFrom${anim.from[0].toUpperCase()}${anim.from.slice(1)}` : '';
  const animCss = anim ? `animation:${animName} ${animMs}ms cubic-bezier(.4,0,.2,1) -${animAt}ms;` : '';

  // v5 A06: Der geplante Fortschritt nutzt DIESELBE Transformation wie der Tap — der
  // grüne Ring wächst von der Kante nach innen, über die REALE Restdauer bis zur
  // absoluten Zielzeit. Kein Rechteck, kein Balken, keine Richtung von unten.
  // v6 A06: Der geplante Fortschritt benutzt exakt dieselbe Feather-Füllung wie der Tap —
  // eine Transformation für beide Wege, damit sie sich nicht auseinanderentwickeln.
  // v7 A10: Der SICHTBARE Fortschritt folgt einer sanften Ease-in-Kurve — frueh sehr
  // zurueckhaltend, in der letzten Phase merklich staerker. Der fachliche Timer bleibt
  // davon unberuehrt: er rechnet weiter linear und monoton, nur die Farbe holt spaeter auf.
  // Die Transition ueberbrueckt den Abstand zwischen zwei Aktualisierungen, damit der
  // Verlauf kontinuierlich wirkt statt in Renderstufen zu springen.
  const sichtbar = Math.pow(Math.max(0, Math.min(1, progress)), 2.2);
  const progressLook = pending
    ? `${fuellung(sichtbar * 100)};transition:--freiP .9s linear,color .9s linear;`
    : '';
  // Der Text folgt derselben Bewegung: Grün → Weiß, sobald die Füllung ihn erreicht.
  const mixChannel = (a, b, t) => Math.round(a + (b - a) * t);
  const textColor = ''; // Runde 2: Die Schrift folgt --freiP (SCHRIFT), nicht mehr einer eigenen Rechnung.
  const fill = '';

  // v4 P0-2k: Der Countdown-Text kommt aus EINER Quelle (crew.js) und kennt auch grobe
  // Einheiten („in 8 Std"). Ohne Übergabe bleibt nur die Startzeit stehen.
  const captionText = pending
    ? (typeof options.caption === 'string' ? options.caption : tx('frei ab {zeit}', { zeit: freeState.from || '' }))
    : '';

  // v4 P0-2j: Die Bildunterschrift liegt auf einer ÜBERLAGERTEN Ebene. Vorher war sie eine
  // zusätzliche Flex-Zeile, für die der Button von 108 auf 78 px schrumpfte — dadurch sprang
  // der grüne Kreis (und mit ihm die Ringmitte) im geplanten Zustand um 10 px nach oben.
  // A07: eigene Ebene für das Außenpulsieren. Sie liegt im Knopf, hat keine eigene
  // Größe im Fluss und verändert nur ihren Schatten — das Layout bleibt exakt stehen.
  const pulse = state === 'active'
    ? '<span aria-hidden="true" style="position:absolute;inset:0;border-radius:50%;pointer-events:none;animation:freiPuls 2.8s ease-in-out infinite"></span>'
    : '';

  const caption = captionText
    // Lesbarkeit ohne Fläche: ein weicher Schein an den Buchstaben selbst (kein Rechteck,
    // keine deckende Leiste — der Inhalt darf sichtbar darunter durchlaufen, P0-5).
    ? `<span id="free-caption" style="position:absolute;left:50%;top:calc(50% + 36px);transform:translateX(-50%);white-space:nowrap;font-family:'Instrument Sans',sans-serif;font-size:11.5px;font-weight:600;color:var(--green-dark);text-align:center;letter-spacing:-.01em;pointer-events:none;text-shadow:0 0 5px var(--paper),0 0 5px var(--paper),0 0 2px var(--paper)">${esc(captionText)}</span>`
    : '';

  // v4 P0-2: Der Träger der Bottom-Ebene ist durchlässig (P0-5). Deshalb trägt NUR das reale
  // Bedienelement pointer-events:auto — ohne das war der Frei-Knopf nicht bedienbar und
  // jeder Druck landete auf der Personenzeile darunter.
  // data-hdrag markiert den Knopf als eigenes horizontales Control: der Zeitring dreht,
  // er wechselt keinen Tab (ownsHorizontalGesture in app.js).
  return `<div style="position:relative;display:flex;align-items:center;justify-content:center;pointer-events:none">${FREI_KEYFRAMES}
<button id="free-button" data-ueber-karte data-hdrag="frei" aria-pressed="${active}" aria-label="${esc(pending ? tx('Frei ab {zeit}', { zeit: freeState.from || '' }) : active ? tx('Frei — aktiv') : tx('Frei setzen'))}" style="width:108px;height:108px;display:flex;align-items:center;justify-content:center;padding:0;border:0;background:transparent;cursor:pointer;appearance:none;touch-action:none;pointer-events:auto">
<span id="free-dot" style="${hidden}position:relative;width:64px;height:64px;border-radius:50%;${look};${progressLook}${SCHRIFT};${textColor ? `color:${textColor};` : ''}box-sizing:border-box;display:flex;align-items:center;justify-content:center;pointer-events:none;font-family:'Instrument Sans',sans-serif;font-size:15px;font-weight:650;letter-spacing:-.01em;${animCss}">${fill}<span style="position:relative">FREE</span>${pulse}</span></button>
${caption}</div>`;
}

// Halte-/Zieh-Overlay (reference 04.2 / 04.2b). hold: {holding, dragging, dotX, dotY, ringX, ringY, angleDeg, timeLabel}
// Koordinaten relativ zum Handy-Screen; Ringzentrum liegt 103px über dem ruhenden Punkt.

export function freiHoldOverlay(hold) {
  if (!hold?.holding) return '';
  const ringLeft = hold.ringX - 114;
  const ringTop = hold.ringY - 114;

  // v3.1 §4: Beim Halten ist KEIN statischer Vollring sichtbar. Erst der Uhrzeiger-Drag lädt
  // einen weich gefadeten Bogen in Bewegungsrichtung auf — eine volle Umdrehung = 60 Minuten.
  //
  // v5 §1 „Korrigierte Fade-Richtung": Der Startpunkt bei 6 Uhr ist transparent, der
  // BEWEGTE Punkt trägt die volle Deckkraft. Die Deckkraft steigt also kontinuierlich
  // vom Start zum Punkt; der Gegenbogen bleibt transparent.
  //
  // v5 „Überrundung": Es bleibt EIN Ring. Jede weitere volle Umdrehung hebt denselben
  // Verlauf um eine Stufe an — kein zweiter, paralleler oder überlappender Stroke.
  // Umgesetzt in EINEM conic-gradient: der bereits umrundete Teil liegt auf dem Niveau
  // der vorigen Runde (`base`), der frisch gezogene Bogen läuft von dort auf `lead`.
  const A_MAX = 0.92;     // Obergrenze, damit nie eine schwarze Fläche entsteht

  const turns = Math.max(0, Math.floor(hold.turns || 0));
  const sweep = Math.max(0, Math.min(360, Number(hold.sweepDeg) || 0));
  const totalDeg = turns * 360 + sweep;
  const ink = (a) => `rgba(var(--ring-rgb),${Math.max(0, Math.min(A_MAX, a)).toFixed(3)})`; // Fable: --ring-rgb hell/dunkel

  // Fable J7: Der bewegte Punkt trägt IMMER die volle Deckkraft, die Startlage ist leer,
  // dazwischen fällt die Deckkraft LINEAR mit dem Abstand zum Punkt ab — vom ersten Grad
  // an, nicht erst nach anderthalb Umdrehungen (vorher exponentielle Sättigung über 540°,
  // die den Ring in der ersten Runde blass ließ). Bezugsgröße ist der gesamte gezogene
  // Bogen: je länger gezogen wurde, desto dunkler bleibt der Schweif hinter dem Punkt.
  const alphaNachLaenge = (laenge) => (laenge <= 0 || totalDeg <= 0 ? 0 : A_MAX * Math.min(1, laenge / totalDeg));

  const ringLayer = (turns > 0 || sweep > 0.05)
    ? (() => {
      const radius = 114;
      const inner = 92;
      const size = radius * 2;
      const left = hold.ringX - radius;
      const top = hold.ringY - radius;
      const mask = `radial-gradient(circle closest-side, transparent ${inner}px, #000 ${inner + 1}px)`;
      // Der Ring wird aus den LETZTEN 360 Grad des gezogenen Bogens gezeichnet.
      //
      // Der Kniff: Die Naht des Farbverlaufs liegt GENAU am bewegten Punkt. Dadurch
      // laufen die Stützstellen streng monoton von „am längsten her" (Verlaufswinkel 0,
      // direkt hinter dem Punkt) bis „gerade eben" (Verlaufswinkel 360, der Punkt
      // selbst). Ohne diese Drehung träfen am Punkt zwei Werte aufeinander und der
      // Verlauf bekäme dort eine sichtbare Kante.
      //
      // Verlaufswinkel g entspricht dem Bildschirmwinkel sweep + g; diese Stelle wurde
      // zuletzt vor (360 - g) Grad überfahren, ist also seit (totalDeg - 360 + g) Grad
      // in Arbeit. Ist dieser Wert <= 0, wurde sie noch nie erreicht — der Gegenbogen
      // bleibt transparent, genau wie in der ersten Umdrehung.
      // Fable J7: keine Huellkurve mehr — der lineare Abfall (alphaNachLaenge) ist selbst
      // die Feder: am Punkt (g = 360) voll, zur aeltesten Stelle (g = 0) hin auslaufend.
      // 60 Stuetzstellen: 6 Grad je Stopp, damit der Verlauf nicht facettiert.
      const N = 60;
      const stopListe = [];
      for (let i = 0; i <= N; i += 1) {
        const g = (360 * i) / N;
        stopListe.push(`${ink(alphaNachLaenge(totalDeg - 360 + g))} ${g.toFixed(2)}deg`);
      }
      const startWinkel = (180 + sweep).toFixed(2);
      return `<div id="frei-ring" style="position:absolute;left:${left}px;top:${top}px;width:${size}px;height:${size}px;border-radius:50%;background:conic-gradient(from ${startWinkel}deg, ${stopListe.join(', ')});-webkit-mask:${mask};mask:${mask}"></div>`;
    })()
    : '';

  // Zentrum zeigt ab dem Halten die echte Frei-ab-Zeit (Offset 0 = jetzt).
  const offsetLine = hold.offsetLabel
    ? `<span style="font-size:11px;font-weight:600;color:rgba(255,255,255,.62);font-family:'Instrument Sans',sans-serif">${esc(hold.offsetLabel)}</span>`
    : '';
  const cappedLine = hold.capped
    ? `<span style="font-size:10px;font-weight:650;letter-spacing:.04em;color:rgba(255,255,255,.58);font-family:'Instrument Sans',sans-serif;padding-top:2px">${tx('Spätestens {zeit}', { zeit: esc(hold.capLabel || '') })}</span>`
    : '';
  const centre = `<div style="position:absolute;left:${ringLeft}px;top:${ringTop}px;width:228px;height:228px;display:flex;flex-direction:column;align-items:center;justify-content:center;gap:2px;pointer-events:none">
<span style="font-size:10px;font-weight:650;letter-spacing:.07em;text-transform:uppercase;color:rgba(255,255,255,.7);font-family:'Instrument Sans',sans-serif">${tx('Frei ab')}</span>
<span id="frei-arc-time" style="font-size:22px;font-weight:650;color:var(--on-accent);font-variant-numeric:tabular-nums;font-family:'Instrument Sans',sans-serif">${esc(hold.timeLabel || tx('jetzt'))}</span>
${offsetLine}${cappedLine}</div>`;

  // v4 P0-2a: EIN Wurzelknoten (#frei-hold) mit inset:0. Er ist damit deckungsgleich mit
  // seinem Bezugsrahmen (der aktiven Tab-Seite) — crew.js misst genau an ihm und kann ihn
  // während des Ziehens gezielt ersetzen, ohne die ganze Seite neu zu rendern.
  return `<div id="frei-hold" style="position:absolute;inset:0;z-index:10;pointer-events:none">
<div style="position:absolute;inset:0;background:var(--scrim);-webkit-backdrop-filter:var(--scrim-filter);backdrop-filter:var(--scrim-filter)"></div>
<div id="frei-hold-layer" style="position:absolute;inset:0;z-index:11">
${ringLayer}
${centre}
<div style="position:absolute;left:${hold.dotX - 32}px;top:${hold.dotY - 32}px;width:64px;height:64px;border-radius:50%;background:var(--green);border:1.5px solid var(--green);box-sizing:border-box;display:flex;align-items:center;justify-content:center;box-shadow:0 2px 8px var(--green-a22)"><span style="font-size:15px;font-weight:650;letter-spacing:-.01em;color:var(--on-accent);font-family:'Instrument Sans',sans-serif">FREE</span></div>
</div></div>`;
}

// --- Icon-Umschalter (Segment mit weißem aktivem Feld, reference 04.1/05.1) ---
// items: [{act, data?, svg, active}]

export function iconSwitch(items) {
  const inner = items.map((item) => {
    const dataAttrs = Object.entries(item.data || {}).map(([key, value]) => `data-${key}="${esc(value)}"`).join(' ');
    // Runde 4 (C3): 14 px seitlich — zwei Felder nebeneinander können sich keine unsichtbare Fläche
    // teilen, also muss jedes selbst 44 px breit sein (16 px Zeichen + 28 px).
    return `<button data-act="${item.act}" ${dataAttrs} data-treffer style="padding:7px 14px;display:flex;align-items:center;border:0;border-radius:999px;cursor:pointer;appearance:none;${item.active ? 'background:var(--surface);box-shadow:0 1px 3px var(--shadow-08)' : 'background:transparent'}"><span style="pointer-events:none;display:flex">${item.svg}</span></button>`;
  }).join('');
  return `<div style="background:var(--field);border-radius:999px;padding:3px;display:flex">${inner}</div>`;
}

// --- Runde Auswahl-Controls (Teilnahme/Loop/Auswahl, reference 05.x) ---
// kind: 'check' | 'x' ; state: aktiv gefüllt

export function roundControl(kind, options = {}) {
  const active = Boolean(options.active);
  const size = options.size || 34;
  const green = 'var(--green)';
  const red = 'var(--danger)';
  const color = kind === 'check' ? green : red;
  const stroke = active ? 'var(--on-accent)' : color;
  const icon = kind === 'check'
    ? `<svg width="15" height="15" viewBox="0 0 24 24" fill="none"><path d="m6.5 12.5 3.6 3.6L17.5 8" stroke="${stroke}" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round"></path></svg>`
    : `<svg width="13" height="13" viewBox="0 0 24 24" fill="none"><path d="m7 7 10 10M17 7 7 17" stroke="${stroke}" stroke-width="2.4" stroke-linecap="round"></path></svg>`;
  const dataAttrs = Object.entries(options.data || {}).map(([key, value]) => `data-${key}="${esc(value)}"`).join(' ');
  return `<button data-act="${options.act || ''}" ${dataAttrs} data-treffer aria-pressed="${active}" style="width:${size}px;height:${size}px;border-radius:50%;display:flex;align-items:center;justify-content:center;padding:0;cursor:pointer;appearance:none;border:1.5px solid ${active ? color : 'var(--ink-a16)'};background:${active ? color : 'var(--surface)'}"><span style="pointer-events:none;display:flex">${icon}</span></button>`;
}

// --- Bottom-Sheet-Gerüst ---

export function sheet(contentHtml, options = {}) {
  return `<div style="position:absolute;inset:0;z-index:14;display:flex;align-items:flex-end">
<div class="ui-sheet-scrim" data-act="${options.closeAct || 'close-sheet'}" style="position:absolute;inset:0;background:var(--scrim);-webkit-backdrop-filter:var(--scrim-filter);backdrop-filter:var(--scrim-filter)"></div>
<div class="ui-sheet-card" data-scroll-keep="sheet-${esc(options.scrollKey || options.closeAct || 'sheet')}" style="position:relative;width:100%;max-height:86%;overflow-y:auto;padding:14px 20px 28px;border-radius:26px 26px 0 0;background:var(--surface);box-shadow:0 -10px 30px var(--shadow-15)">
<div style="width:38px;height:4px;margin:0 auto 15px;border-radius:999px;background:var(--handle)"></div>
${contentHtml}</div></div>`;
}

// --- Orange Zähl-Badge (allein stehend) ---

export function orangeBadge(count) {
  if (!count) return '';
  return `<div style="min-width:21px;height:21px;border-radius:11px;background:var(--orange);color:var(--on-accent);font:650 11.5px/21px 'Instrument Sans',sans-serif;text-align:center;padding:0 6px;flex:none">${count}</div>`;
}

// =====================================================================================
// v3.1 — Gemeinsame Ebenenordnung (RUNTIME_QUALITY_CONTRACT §1)
//
//   1 durchgehender warmer App-Hintergrund
//   2 GENAU EINE Scrollfläche für den gesamten Inhaltskörper
//   3 Sticky Header darüber
//   4 fixe Bottom-Ebene (Navigation / CTA / Composer) darüber
//   5 Sheets und Toasts als höchste Ebene
//
// Die Bottom-Ebene liegt ABSOLUT über der Scrollfläche: Inhalt läuft sichtbar darunter
// durch und bleibt durch `bottomInset` trotzdem vollständig nach oben scrollbar.
// Dadurch kann keine „beige Phantomleiste" mehr entstehen, die Inhalt hart abschneidet.
//
//   screenScaffold({ statusTime, header, body, bottom, bottomInset, overlays,
//                    scrollKey, background, headerFade })
// =====================================================================================

export function screenScaffold(options = {}) {
  const {
    statusTime,
    header = '',
    body = '',
    bottom = '',
    bottomInset = bottom ? 96 : 16,
    overlays = '',
    scrollKey = 'screen',
    background = 'var(--paper)',
    headerFade = true,
    // v4 P0-1: Im Seitenmodus liefert der Screen NUR seine Seite — Statusleiste und
    // Bottom-Navigation stellt die gemeinsame Chrome in app.js. Nur so kann die Geste
    // die Seiten bewegen, während Statusleiste und Navigation stehen bleiben.
    page = false,
    // v4 P0-5: Der Inhalt fadet an seiner eigenen Unterkante aus (Maske auf der
    // Scrollfläche). Es wird KEINE Farbfläche darübergelegt — genau die war die
    // verbotene Phantomfläche aus dem Beweisbild.
    bottomFadeHeight = 22,
    // v7 A41: Feste Ueberlagerung ZWISCHEN Kopf und Inhalt. Sie nimmt keinen
    // Layoutplatz ein; der Inhalt scrollt darunter weiter. overlayTopInset ist der
    // ruhige Leseraum, mit dem die Flaeche startet, damit die erste Nachricht nicht
    // unlesbar unter der Ueberlagerung beginnt.
    overlayTop = '',
    overlayTopInset = 0,
    // Runde 7 (Bahn): Diese Seite trägt einen LEBENDEN, fremden Teilbaum — eine echte Karte.
    // Ein solcher Baum darf beim Tabwechsel nicht mit der Seite sterben: MapLibre wäre sonst
    // bei jeder Ankunft neu zu bauen (neuer WebGL-Kontext, neue Kacheln, sichtbares Blitzen).
    // Das Merkmal sagt der Tab-Bahn, dass sie die data-fremd-Knoten dieser Seite aufbewahren
    // und in die nächste Fassung derselben Seite zurücksetzen soll (app.js › fremdesRetten).
    behalten = false,
  } = options;

  // Weiche Kanten: Inhalt verschwindet unter Header und Navigation, statt hart zu clippen.
  // Beide Seiten sind Masken AUF dem Inhalt, keine Flächen darüber.
  //
  // v5 A21: Die OBERE Maske war statisch und hat den ersten Eintrag, den Titel, den
  // Avatar und das Zähl-Badge schon bei Scrollposition 0 ausgeblasst (gemessen bis
  // Zeile 14 teiltransparent). Jetzt steht die Tiefe in der CSS-Variablen --fade-top,
  // beginnt bei 0 und wächst erst mit dem tatsächlichen Scrollweg — bindTopFade() in
  // app.js zieht sie am Scroll-Ereignis nach. Ohne JavaScript bleibt es damit scharf,
  // was der richtige Ausgangszustand ist.
  // Auftrag §5.3: Auf der Karte war der weiche Übergang nur UNTEN — oben schnitt sie hart
  // unter der Kopfzeile ab. `randFade` legt denselben Abstand an beide Kanten; er ist fest
  // und wächst nicht mit dem Scrollweg, weil eine Karte nicht scrollt.
  const topDepth = options.randFade
    ? `${options.randFade}px`
    : (headerFade ? 'var(--fade-top, 0px)' : '0px');
  const untenFade = options.randFade ?? bottomFadeHeight;
  const maskValue = `linear-gradient(180deg,transparent 0,#000 ${topDepth},#000 calc(100% - ${untenFade}px),transparent 100%)`;
  const mask = `--fade-top:0px;--fade-top-max:${headerFade ? 14 : 0}px;mask-image:${maskValue};-webkit-mask-image:${maskValue};`;
  // Eine Karte blendet an beiden Kanten gleich aus (§5.3) — passeUntereKanteAn lässt sie in Ruhe.
  // Runde 3 (O2, Jonathan): „Die Freundesliste soll direkt an der Fußzeile ausfaden, und der
  // FREE-Button ist einfach über der Liste darüber." `untenSchwebend`: Die untere Ebene
  // schwebt über dem Inhalt; die Liste blendet an ihrer eigenen Unterkante aus (dort beginnt
  // die Navigation), nicht über dem schwebenden Knopf.
  const randAttr = `${options.randFade ? ' data-randfade="1"' : ''}${options.untenSchwebend ? ' data-unten-schwebt="1"' : ''}`;

  const bottomLayer = bottom
    ? `<div class="screen-bottom" style="position:absolute;left:0;right:0;bottom:0;z-index:6;display:flex;flex-direction:column;pointer-events:none">${bottom}</div>`
    : '';

  // z 4: ueber der Scrollflaeche (z 1), unter dem Kopf (z 5). Keine Maske, kein
  // overflow — an der Unterkante dieser Ebene darf nichts verschwinden.
  const overlayTopLayer = overlayTop
    ? `<div class="screen-overlay-top" style="position:absolute;left:0;right:0;z-index:4;pointer-events:none">${overlayTop}</div>`
    : '';

  // Runde 7 (J12, Jonathan): „wie man es von whats app kennt, aber halt in unserem design und
  // unauffaellig aber gut." Eine eigene, tote Ebene GANZ HINTEN (z 0) traegt das Muster; die
  // Zeichnung selbst steht in web/styles.css (--grund-muster), hell und dunkel. Sie liegt
  // ausserhalb der Scrollflaeche und bewegt sich deshalb beim Rollen nicht — der Browser malt
  // sie einmal und nie wieder (gemessen: keine zusaetzliche Malarbeit pro Bild).
  const grundEbene = '<div class="crew-grund" data-role="grund" aria-hidden="true"></div>';

  const inner = `${grundEbene}
${page || statusTime === false ? '' : statusBar(statusTime)}
${header ? `<div class="screen-header" style="flex:none;position:relative;z-index:5">${header}</div>` : ''}
<div class="screen-scroll" data-scroll-keep="${esc(scrollKey)}"${randAttr} style="flex:1;min-height:0;overflow-y:auto;overflow-x:hidden;position:relative;z-index:1;${overlayTopInset ? `padding-top:${overlayTopInset}px;` : ''}padding-bottom:${bottomInset}px;${mask}">${body}</div>
${overlayTopLayer}
${bottomLayer}
${overlays}`;

  // Seitenmodus: nur der Seitenkörper, ohne Handyrahmen — app.js setzt ihn in die Bahn.
  // Die Overlays (Sheets, Scrims, Halte-Ring) liegen dabei in einem eigenen Träger mit
  // display:contents. app.js hängt ihn aus der Seite heraus in den Handyrahmen um, sonst
  // endet ein Scrim an der Seitenkante und Statusleiste und Navigation blieben hell.
  if (page) {
    // Runde 8 (Jonathan): Beim Seitenwechsel sollen sich die Muster nicht ueberschneiden, sondern
    // fortgesetzt werden. Deshalb traegt eine Tab-Seite weder Tapete noch Papierfarbe: beides liegt
    // EINMAL hinter der Bahn (app.js), und die Seiten gleiten darueber.
    const pageInner = `
${header ? `<div class="screen-header" style="flex:none;position:relative;z-index:5">${header}</div>` : ''}
<div class="screen-scroll" data-scroll-keep="${esc(scrollKey)}"${randAttr} style="flex:1;min-height:0;overflow-y:auto;overflow-x:hidden;position:relative;z-index:1;padding-bottom:${bottomInset}px;${mask}">${body}</div>
${bottomLayer}`;
    // v5 A19: Die Overlays stehen NEBEN der Seite, nicht darin. app.js setzt die Seite in
    // die Bahn und den Overlay-Träger direkt in den Handyrahmen. Vorher wurde der Träger
    // nach jedem Render aus der Seite herausgehängt — ein Verschieben fügt den Knoten neu
    // ein und startet damit seine Öffnungsanimation bei JEDER Eingabe erneut.
    return `<div class="tab-page"${behalten ? ' data-behalten="1"' : ''} style="position:absolute;inset:0;display:flex;flex-direction:column;background:transparent;overflow:hidden;overflow:clip;touch-action:pan-y">${pageInner}</div>`
      + (overlays ? `<div class="page-overlays" style="display:contents">${overlays}</div>` : '');
  }
  return phoneFrame(inner, { background });
}

// v4 P0-1 / COMPONENT_RULES 1: EINE Kopfachse für alle Tab-Wurzeln. Padding, Höhe und
// vertikale Ausrichtung kommen von hier, damit beim Tabwechsel nichts springt.
// left/right sind der bereichseigene Inhalt.
export const TAB_HEADER_PAD_X = 20;
export const TAB_HEADER_HEIGHT = 48;

export function tabHeader(left, right = '') {
  return `<div style="display:flex;justify-content:space-between;align-items:center;gap:12px;height:${TAB_HEADER_HEIGHT}px;padding:6px ${TAB_HEADER_PAD_X}px 0;box-sizing:content-box">
<div style="display:flex;align-items:center;min-width:0">${left}</div>
<div style="display:flex;align-items:center;gap:8px;flex:none">${right}</div></div>`;
}

// v4 P0-5: Es gibt keinen Farbverlaufs-Block mehr über dem Inhalt. Das weiche Ausblenden
// macht die Maske der Scrollfläche (screenScaffold, bottomFadeHeight). Diese Funktion
// bleibt als reiner ABSTANDHALTER erhalten: sie hält die Bottom-Ebene auf Höhe, färbt
// aber nichts ein und fängt keine Eingaben ab.
// Runde 2 (Jonathan): „Der Fade-out ist manchmal an einer unpassenden Stelle — bei
// ‚Was machen‘ ist er UNTER der Suchleiste statt DARÜBER."
//
// Gemessen (scratch/r2-fade-blick.mjs): Die Maske begann an der Oberkante der unteren EBENE
// und lief von dort noch 56 px nach unten. Die Ebene beginnt aber mit einem durchsichtigen
// Abstandhalter; die Suchleiste lag 44 px tiefer. Der Inhalt war also hinter dem oberen Teil
// der Bedienelemente noch halb zu sehen — bei „Was machen", in allen Sheets und im Composer.
//
// Jetzt gilt EINE Regel für alle Flächen: Gemessen wird die Oberkante des obersten ECHTEN
// Bedienelements. Genau dort ist der Inhalt vollständig verschwunden; darüber blendet er
// auf UNTERE_FADE_LAENGE weich aus. Der Innenabstand unten reicht immer so weit, dass der
// letzte Eintrag ganz über diese Kante gescrollt werden kann.
export const UNTERE_FADE_LAENGE = 40;

function abstandZurBedienung(scroll, bottom) {
  const rects = [...bottom.querySelectorAll('button, input, textarea, select, [data-act]')]
    .map((knoten) => knoten.getBoundingClientRect())
    .filter((r) => r.width > 0 && r.height > 0);
  if (!rects.length) return null;
  const oben = Math.min(...rects.map((r) => r.top));
  return Math.max(0, Math.round(scroll.getBoundingClientRect().bottom - oben));
}

export function untereMaskeWert(obenCss, abstand) {
  const stops = [obenCss];
  if (abstand > 0) {
    stops.push(`#000 calc(100% - ${abstand + UNTERE_FADE_LAENGE}px)`, `transparent calc(100% - ${abstand}px)`, 'transparent 100%');
  } else {
    stops.push('#000 100%');
  }
  return `linear-gradient(180deg,${stops.join(',')})`;
}

export function passeUntereKanteAn(root) {
  if (!root) return;
  // J11: Dieselbe Stelle, an der die App nach jedem Zeichnen ohnehin einmal misst — hier
  // stanzt luecken() die Trennung durch die gestapelten Bilder. Ein eigener Aufruf in app.js
  // waere sauberer, app.js gehoert diesem Paket aber nicht (steht im Bericht).
  luecken(root);
  const paare = [];
  root.querySelectorAll('[data-layerbox]').forEach((box) => {
    const scroll = box.querySelector(':scope > [data-layerscroll]');
    const bottom = box.querySelector(':scope > [data-layerbottom]');
    if (scroll && bottom) paare.push([scroll, bottom]);
  });
  root.querySelectorAll('.screen-scroll').forEach((scroll) => {
    if (scroll.dataset.randfade || scroll.dataset.untenSchwebt) return;
    // Eine Karte scrollt nicht und liegt bis unten durch — der Frei-Knopf schwebt über ihr.
    // Mit mehr Innenabstand endete sie mitten auf dem Schirm (angesehen: Crew-Karte).
    // Dasselbe gilt für die Umkreis-Karte in „Was machen?" (data-disc-karte).
    if (scroll.querySelector('[data-map-viewport], [data-disc-karte]')) return;
    const bottom = scroll.parentElement ? scroll.parentElement.querySelector(':scope > .screen-bottom') : null;
    if (bottom) paare.push([scroll, bottom]);
  });
  for (const [scroll, bottom] of paare) {
    const abstand = abstandZurBedienung(scroll, bottom);
    if (abstand == null) continue; // unten liegt nichts Bedienbares — die Maske bleibt, wie sie ist
    const obenMax = parseFloat(getComputedStyle(scroll).getPropertyValue('--fade-top-max')) || 0;
    const obenCss = obenMax > 0 ? 'transparent 0,#000 var(--fade-top, 0px)' : '#000 0';
    const wert = untereMaskeWert(obenCss, abstand);
    scroll.style.maskImage = wert;
    scroll.style.webkitMaskImage = wert;
    const noetig = abstand + UNTERE_FADE_LAENGE + 6;
    const jetzt = parseFloat(getComputedStyle(scroll).paddingBottom) || 0;
    if (jetzt < noetig) scroll.style.paddingBottom = `${noetig}px`;
  }
}

export function bottomFade(height = 28) {
  return `<div style="height:${height}px;flex:none;pointer-events:none"></div>`;
}

// Zeile mit echten Bedienelementen in der Bottom-Ebene.
// v4 P0-5: Der vollbreite Träger ist DURCHLÄSSIG; nur sein Inhalt fängt Eingaben.
// Vorher trug er selbst pointer-events:auto und wurde damit zur unsichtbaren Wand über
// dem Inhalt. Ein deckender Hintergrund gehört ebenfalls nur auf das reale Bedienelement.
export function bottomBar(innerHtml, extraStyle = '') {
  return `<div style="pointer-events:none;${extraStyle}"><span style="display:contents;pointer-events:auto">${innerHtml}</span></div>`;
}

// Horizontale Reihe (Crew-/Loop-Streifen) mit sanfter Sichtmaskierung an beiden Rändern.
// Die Maske ist rein visuell: Kartenbreite, Scrollweite, Touch-Ziel und Radius bleiben exakt.
// data-hdrag markiert die Reihe als eigenes horizontales Control (Gesten-Priorität).
export function edgeFadeRow(innerHtml, options = {}) {
  const { gap = 9, padLeft = 20, padRight = 20, padY = '8px 0 0', scrollKey } = options;
  const fade = 'mask-image:linear-gradient(90deg,transparent 0,#000 16px,#000 calc(100% - 16px),transparent 100%);-webkit-mask-image:linear-gradient(90deg,transparent 0,#000 16px,#000 calc(100% - 16px),transparent 100%);';
  return `<div data-hdrag="row"${scrollKey ? ` data-scroll-keep="${esc(scrollKey)}"` : ''} style="display:flex;gap:${gap}px;padding:${padY};padding-left:${padLeft}px;padding-right:${padRight}px;overflow-x:auto;overflow-y:visible;scrollbar-width:none;flex:none;${fade}">${innerHtml}</div>`;
}

// =====================================================================================
// v3.2 Ü4 — Schutz vor still verworfenen Bearbeitungen
//
// Wurde ein Formular TATSÄCHLICH verändert, dürfen Scrim-Tap, Zurück, Tabwechsel oder
// Schließen die Änderung nicht kommentarlos wegwerfen. Unverändert schließt normal.
//
//   const guard = dirtyGuard(ctx, 'profil');   // je Sheet ein Schlüssel
//   guard.track(aktuellerWert)                 // Ausgangswert beim Öffnen merken
//   guard.isDirty(aktuellerWert)               // hat sich etwas geändert?
//   guard.confirm(aktuellerWert, onDiscard)    // true = darf schließen; sonst Nachfrage
//   discardSheet(ctx)                          // rendert die Nachfrage (in overlays)
// =====================================================================================

export function dirtyGuard(ctx, key) {
  const store = (ctx.ui.__dirty = ctx.ui.__dirty || {});
  const snapshot = (value) => JSON.stringify(value ?? null);
  return {
    track(value) {
      if (store[key] === undefined) store[key] = snapshot(value);
    },
    reset(value) { store[key] = snapshot(value); },
    clear() { delete store[key]; },
    isDirty(value) {
      return store[key] !== undefined && store[key] !== snapshot(value);
    },
    // true → schließen ist erlaubt. false → Nachfrage wurde geöffnet.
    confirm(value, onDiscard) {
      if (!this.isDirty(value)) { this.clear(); return true; }
      ctx.ui.__discard = {
        key,
        onDiscard: () => { this.clear(); onDiscard?.(); },
      };
      ctx.render();
      return false;
    },
  };
}

// Kompakte Entscheidung: Weiter bearbeiten oder Änderungen verwerfen (Ü4).
export function discardSheet(ctx) {
  const pending = ctx.ui.__discard;
  if (!pending) return '';
  return `<div style="position:absolute;inset:0;z-index:24;display:flex;align-items:flex-end">
<div class="ui-sheet-scrim" data-act="discard-keep" style="position:absolute;inset:0;background:var(--scrim);-webkit-backdrop-filter:var(--scrim-filter);backdrop-filter:var(--scrim-filter)"></div>
<div class="ui-sheet-card" style="position:relative;width:100%;padding:16px 20px 26px;border-radius:26px 26px 0 0;background:var(--surface);box-shadow:0 -10px 30px var(--shadow-15);font-family:'Instrument Sans',sans-serif">
<div style="width:38px;height:4px;margin:0 auto 14px;border-radius:999px;background:var(--handle)"></div>
<span style="display:block;font-family:'Bricolage Grotesque',sans-serif;font-size:18px;font-weight:650;padding-bottom:4px">${tx('Änderungen behalten?')}</span>
<span style="display:block;font-size:13px;color:var(--ink-soft);line-height:1.45;padding-bottom:14px">${tx('Du hast etwas bearbeitet, aber noch nicht gespeichert.')}</span>
<button data-act="discard-keep" style="width:100%;border:0;background:var(--ink);color:var(--on-ink);font:650 14px/1 'Instrument Sans',sans-serif;padding:14px 0;border-radius:999px;cursor:pointer;appearance:none">${tx('Weiter bearbeiten')}</button>
<button data-act="discard-drop" style="width:100%;margin-top:9px;border:1.5px solid var(--ink-a14);background:var(--surface);color:var(--danger);font:650 14px/1 'Instrument Sans',sans-serif;padding:13px 0;border-radius:999px;cursor:pointer;appearance:none">${tx('Änderungen verwerfen')}</button>
</div></div>`;
}

// Handler für discardSheet — einmal je Screen in bindActions einhängen.
export function discardActions(ctx) {
  return {
    'discard-keep': () => { ctx.ui.__discard = null; ctx.render(); },
    'discard-drop': () => {
      const pending = ctx.ui.__discard;
      ctx.ui.__discard = null;
      pending?.onDiscard?.();
      ctx.render();
    },
  };
}

// =====================================================================================
// Auftrag §4.3 — Ziehen von Zahlen und Uhrzeiten
//
// Vorher gab es ZWEI Räder: eines im Meet-Composer, das dem Finger folgte und beim
// Loslassen einrastete, und eines im Profil (Frei-Zeit, Kapazität, Erinnerung), das beim
// Ziehen in Stufen von 24 Pixeln von Wert zu Wert SPRANG. Dasselbe Bedienelement, zwei
// Gefühle. Hier steht es genau einmal:
//
//   radSpalte(rolle, werte, gewaehlt, optionen) → Markup
//   bindRad(root, rolle, onChange)              → Zieh-Logik
//
// Die Bewegung folgt dem Finger Pixel für Pixel; beim Loslassen rastet sie weich auf den
// nächsten Wert ein. Während des Ziehens wandert die Hervorhebung mit — ohne dass der
// Bildschirm neu gezeichnet wird, denn das würde die Bewegung abreißen lassen.
export const RAD_ZEILE = 30;
export const RAD_SICHTBAR = 5;

function radWerteliste(werte, runden) {
  const out = [];
  for (let c = 0; c < runden; c += 1) for (const wert of werte) out.push(wert);
  return out;
}

// optionen: { runden } wie oft die Werte hintereinander liegen (1 = begrenzter Bereich statt
// Zylinder) · { width } · { sichtbar } · { text } Formatierung · { act } data-act beim Tippen
export function radSpalte(rolle, werte, gewaehlt, optionen = {}) {
  const runden = optionen.runden || (werte.length <= 6 ? 7 : 3);
  const breite = optionen.width || 52;
  const text = optionen.text || ((wert) => String(wert).padStart(2, '0'));
  const hoehe = RAD_ZEILE * (optionen.sichtbar || RAD_SICHTBAR);
  const mitte = (hoehe - RAD_ZEILE) / 2;
  const alle = radWerteliste(werte, runden);
  const inRunde = Math.max(0, werte.indexOf(gewaehlt));
  const index = Math.floor(runden / 2) * werte.length + inRunde;
  const versatz = mitte - index * RAD_ZEILE;
  const act = optionen.act || 'rad-waehlen';
  // Wie weit reicht das Fenster? Nur Zellen INNERHALB sind sichtbar — alles andere liegt
  // hinter `overflow:hidden`. Diese Zellen dürfen auch keine Eingaben fangen: Sie hätten
  // sonst ein Rechteck außerhalb des Rads, in dem ein Tipp ins Leere ginge.
  const rand = Math.floor((optionen.sichtbar || RAD_SICHTBAR) / 2);
  const zellen = alle.map((wert, i) => {
    const d = Math.abs(i - index);
    const look = d === 0 ? 'font-size:17px;font-weight:650;color:var(--ink)'
      : d === 1 ? 'font-size:14px;font-weight:600;color:var(--muted-light)'
        : 'font-size:13px;font-weight:600;color:var(--line-solid)';
    const draussen = d > rand;
    // data-col trägt denselben Wert wie data-role: Das Profil liest `data.col`, der
    // Meet-Composer `data.role`. Zwei Namen für dieselbe Sache — beide bleiben, damit kein
    // Bildschirm umgeschrieben werden muss.
    return `<button data-act="${act}" data-role="${rolle}" data-col="${rolle}" data-value="${esc(String(wert))}" data-i="${i}"${draussen ? ' aria-hidden="true" tabindex="-1"' : ''} style="height:${RAD_ZEILE}px;display:flex;align-items:center;justify-content:center;border:0;background:transparent;cursor:pointer;appearance:none;padding:0;font-family:'Instrument Sans',sans-serif;font-variant-numeric:tabular-nums;${draussen ? 'pointer-events:none;' : ''}${look}"><span style="pointer-events:none">${esc(text(wert))}</span></button>`;
  }).join('');
  const fade = 'mask-image:linear-gradient(180deg,transparent 0,#000 26%,#000 74%,transparent 100%);-webkit-mask-image:linear-gradient(180deg,transparent 0,#000 26%,#000 74%,transparent 100%);';
  // data-layerscroll: Das Rad ist ein Ausschnitt wie eine Scrollflaeche — was ausserhalb
  // liegt, ist nicht „tot", sondern nur nicht dran.
  return `<div data-role="wheel-${rolle}" data-layerscroll="rad" data-hdrag="wheel" data-index="${index}" data-count="${alle.length}" data-center="${mitte}" data-sichtbar="${optionen.sichtbar || RAD_SICHTBAR}" style="width:${breite}px;height:${hoehe}px;overflow:hidden;position:relative;touch-action:none;cursor:grab;${fade}">
<div data-role="wheel-${rolle}-inner" style="position:absolute;left:0;right:0;top:0;transform:translateY(${versatz}px);display:flex;flex-direction:column;will-change:transform">${zellen}</div>
</div>`;
}

const radKlemme = (v, min, max) => Math.min(max, Math.max(min, v));

export function bindRad(root, rolle, onChange) {
  const box = root.querySelector(`[data-role="wheel-${rolle}"]`);
  const inner = root.querySelector(`[data-role="wheel-${rolle}-inner"]`);
  if (!box || !inner || box.__radGebunden) return;
  box.__radGebunden = true;
  const zellen = [...inner.children];
  const anzahl = zellen.length;
  const mitte = Number(box.dataset.center ?? 0);
  let versatz = mitte - Number(box.dataset.index || 0) * RAD_ZEILE;
  let start = null;
  let gezogen = false;
  let klickSchlucken = false;

  const sichtbarRand = Math.floor((Number(box.dataset.sichtbar) || RAD_SICHTBAR) / 2);
  const malen = (idx) => zellen.forEach((el, i) => {
    const d = Math.abs(i - idx);
    el.style.fontSize = d === 0 ? '17px' : d === 1 ? '14px' : '13px';
    el.style.fontWeight = d === 0 ? '650' : '600';
    el.style.color = d === 0 ? 'var(--ink)' : d === 1 ? 'var(--muted-light)' : 'var(--line-solid)';
    // Zellen außerhalb des Fensters liegen hinter `overflow:hidden`. Sie dürfen keine
    // Eingaben fangen — sonst gäbe es Tippflächen, die niemand sieht.
    const draussen = d > sichtbarRand;
    el.style.pointerEvents = draussen ? 'none' : '';
    if (draussen) el.setAttribute('aria-hidden', 'true'); else el.removeAttribute('aria-hidden');
  });
  const indexVon = (wert) => radKlemme(Math.round((mitte - wert) / RAD_ZEILE), 0, anzahl - 1);

  box.addEventListener('click', (event) => {
    if (!klickSchlucken) return;
    klickSchlucken = false;
    event.stopPropagation();
    event.preventDefault();
  }, true);

  box.addEventListener('pointerdown', (event) => {
    start = { y: event.clientY, versatz, id: event.pointerId };
    gezogen = false;
    inner.style.transition = 'none';
  });
  box.addEventListener('pointermove', (event) => {
    if (!start) return;
    event.preventDefault();
    const dy = event.clientY - start.y;
    if (!gezogen && Math.abs(dy) > 3) { gezogen = true; box.setPointerCapture?.(start.id); }
    if (!gezogen) return;
    // Leicht magnetisch: Je näher an einem Wert, desto stärker zieht es dorthin — aber es
    // springt nie. Der Anteil ist klein (0,18), sonst fühlt es sich klebrig an.
    const roh = radKlemme(start.versatz + dy, mitte - (anzahl - 1) * RAD_ZEILE, mitte);
    const naechster = mitte - indexVon(roh) * RAD_ZEILE;
    versatz = roh + (naechster - roh) * 0.18;
    inner.style.transform = `translateY(${versatz}px)`;
    malen(indexVon(versatz));
  });
  const schluss = () => {
    if (!start) return;
    start = null;
    const idx = indexVon(versatz);
    versatz = mitte - idx * RAD_ZEILE;
    inner.style.transition = 'transform .16s ease-out';
    inner.style.transform = `translateY(${versatz}px)`;
    malen(idx);
    if (!gezogen) return;
    klickSchlucken = true;
    onChange(zellen[idx].dataset.value, idx);
  };
  box.addEventListener('pointerup', schluss);
  box.addEventListener('pointercancel', schluss);
}

// =====================================================================================
// Runde 4 (E3, Jonathan): „Nice wäre, wenn man das Anstupsen wieder abwählen kann … ich stupse
// jemand an, wähle es wieder ab, kann aber dennoch nur in fünf Minuten erneut anstupsen. Nice wäre
// generell auch Feedback wie Vibration."
// -------------------------------------------------------------------------------------
// EIN Ablauf für jeden Anstups-Knopf (Raum groß und klein, künftig auch anderswo):
//   anstupsZustand(repo, roomId) → { state: 'idle'|'sent'|'zurueck', label, gate, sentAt, self? }
//   anstupsen(ctx, roomId, { gesendet, zurueckgenommen, abgelehnt })
//     1. Tipp  (frei)                → repo.nudge(roomId), Rückmeldung 'tipp', gesendet()
//     2. Tipp  (eben gesendet)       → repo.nudgeZuruecknehmen(roomId), Rückmeldung 'zurueck',
//                                      zurueckgenommen({ ok, sperreBis }) — die Sperre bleibt
//     3. Tipp  (zurückgenommen/Sperre) → Rückmeldung 'abgelehnt', abgelehnt(gate) — Restzeit zeigen
//   Rückgabe: { art: 'gesendet'|'zurueckgenommen'|'abgelehnt'|'selbst', sperreBis? }
// Die Haken sind für das Bild am Knopf (Impuls, Wackeln); Daten und Vibration macht der Ablauf.
// =====================================================================================
const anstupsRestMin = (ms) => Math.max(1, Math.ceil(Math.max(0, ms) / 60000));
const anstupsVor = (ms) => {
  const min = Math.max(0, Math.round(ms / 60000));
  return min < 1 ? tx('gerade eben') : tx('vor {n} min', { n: min });
};

export function anstupsZustand(repo, roomId) {
  const gate = repo.canNudge(roomId);
  if (gate.self) return { self: true, state: 'idle', label: '', gate };
  if (gate.ok) return { state: 'idle', label: tx('Anstupsen'), gate };
  const sentAt = repo.nudgeSentAt?.(roomId) || 0;
  if (repo.nudgeZurueckgenommen?.(roomId)) {
    return { state: 'zurueck', label: tx('Zurückgenommen · wieder in {n} min', { n: anstupsRestMin(gate.remainingMs) }), gate, sentAt };
  }
  const label = sentAt ? tx('Angestupst · {zeit}', { zeit: anstupsVor(Date.now() - sentAt) }) : tx('Angestupst');
  return { state: 'sent', label, gate, sentAt };
}

export function anstupsen(ctx, roomId, haken = {}) {
  const { repo } = ctx;
  const zustand = anstupsZustand(repo, roomId);
  if (zustand.self) return { art: 'selbst' };
  if (zustand.state === 'idle') {
    rueckmeldung('tipp');
    const ergebnis = repo.nudge(roomId);
    if (ergebnis && ergebnis.ok === false) {
      rueckmeldung('abgelehnt');
      haken.abgelehnt?.(repo.canNudge(roomId));
      return { art: 'abgelehnt' };
    }
    haken.gesendet?.(ergebnis);
    return { art: 'gesendet' };
  }
  if (zustand.state === 'sent' && typeof repo.nudgeZuruecknehmen === 'function') {
    const ergebnis = repo.nudgeZuruecknehmen(roomId);
    if (ergebnis?.ok) {
      rueckmeldung('zurueck');
      haken.zurueckgenommen?.(ergebnis);
      return { art: 'zurueckgenommen', sperreBis: ergebnis.sperreBis };
    }
  }
  rueckmeldung('abgelehnt');
  haken.abgelehnt?.(repo.canNudge(roomId));
  return { art: 'abgelehnt' };
}
