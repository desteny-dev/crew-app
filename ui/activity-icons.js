// Die Zuordnung Text → Zeichen. Gezeichnet wird in ui/symbole.js; hier steht nur, WELCHES
// Zeichen ein Ding bekommt.
//
// Fable 4 (J14): EIN Katalog für alle Flächen — Meet-Karten, Vorschläge, gespeicherte Ideen,
// eigene Ideen im Composer, Interessen im Profil und in Crew-/Personendetails.
// Auftrag R1 §6.2: Dazu kommen jetzt die RESSOURCEN. Vorher gab es dafür sechs Muster in
// screens/profile.js — „PC", „Beamer-Leinwand", „Bohrmaschine", „Kanu" bekamen alle denselben
// allgemeinen Anhänger. Jetzt greift dieselbe Stichwortliste wie für Aktivitäten, nur mit
// einem eigenen, größeren Vorrat.
//
// Reihenfolge der Zuordnung (activityIconKey):
//   1. expliziter Schlüssel am Datensatz (`iconKey`, ersatzweise `icon`, wenn es ein Katalogname ist)
//   2. Emoji-Schlüssel (EMOJI_KEYS)
//   3. Stichwort im Titel (STICHWORTE — spezifische Dinge vor Orten)
//   4. Kategorie-Familie (CATEGORY_KEYS), zuletzt das neutrale Funkeln.

import { SYMBOLE, symbol, symbolPfad } from './symbole.js';
import { zeichenAusWortschatz } from './wortschatz.js';
import { t as tx } from '../core/sprache.js';

export const ACTIVITY_ICON_KEYS = Object.keys(SYMBOLE);

// Die alten Schlüssel aus v7 leben in gespeicherten Daten weiter (meet.iconKey). Sie zeigen
// hier auf ihren neuen Namen, damit kein Bestand sein Zeichen verliert.
const ALTE_NAMEN = {
  waves: 'wellen', swim: 'schwimmen', boots: 'wandern', mountain: 'berg', snow: 'schnee',
  bike: 'rad', gym: 'hantel', ball: 'fussball', sun: 'sonne', tent: 'zelt', car: 'auto',
  fork: 'gabel', cup: 'tasse', drink: 'glas', party: 'feiern', dice: 'wuerfel',
  cards: 'karten', sofa: 'sofa', home: 'haus', book: 'buch', film: 'film', note: 'note',
  ticket: 'ticket', camera: 'kamera', bag: 'tasche', clock: 'uhr', sparkle: 'funkeln',
};

const EMOJI_KEYS = {
  '🌊': 'wellen', '🏖': 'wellen', '🏄': 'surfbrett', '⛵': 'boot',
  '🏊': 'schwimmen',
  '🎬': 'film', '🎥': 'film', '🍿': 'film', '📺': 'film',
  '⛰️': 'wandern', '⛰': 'wandern', '🌄': 'sonne', '🥾': 'wandern', '🏃': 'wandern',
  '🧗': 'berg',
  '⛷': 'ski', '🎿': 'ski', '🏂': 'snowboard', '❄️': 'schnee', '❄': 'schnee',
  '🚴': 'rad', '🚲': 'rad', '🏍': 'motorrad',
  '🏋': 'hantel', '🧘': 'yoga',
  '🏐': 'volleyball', '⚽': 'fussball', '🎾': 'tischtennis', '🏀': 'fussball', '🎳': 'fussball',
  '🎯': 'dart',
  '🍝': 'gabel', '🍳': 'gabel', '🥘': 'gabel', '🍣': 'gabel', '🍔': 'gabel', '🍦': 'gabel',
  '🍕': 'pizza',
  '🔥': 'grill', '🍖': 'grill',
  '☕': 'tasse', '🍵': 'tasse',
  '🍷': 'glas', '🍺': 'glas', '🍻': 'glas', '🍸': 'glas', '🥂': 'glas',
  '🎉': 'feiern', '🎊': 'feiern', '🪩': 'feiern', '💃': 'feiern',
  '🎲': 'wuerfel', '🧩': 'wuerfel',
  '🃏': 'karten',
  '🎮': 'gamepad', '🕹': 'gamepad',
  '🛋': 'sofa',
  '🏠': 'haus',
  '📚': 'buch', '📖': 'buch',
  '🎭': 'ticket', '🎟': 'ticket', '🎫': 'ticket', '🏛': 'museum',
  '🎵': 'note', '🎶': 'note', '🎸': 'gitarre', '🎤': 'mikrofon', '🎹': 'klavier',
  '📷': 'kamera', '📸': 'kamera',
  '🛍': 'tasche', '🛒': 'bollerwagen',
  '⛺': 'zelt', '🏕': 'zelt',
  '🚗': 'auto', '🚙': 'auto',
  '☀️': 'sonne', '🌅': 'sonne', '🌇': 'sonne', '🎆': 'sonne', '🧺': 'picknickkorb',
  '💻': 'laptop', '🖥': 'monitor', '🖨': 'drucker', '🎧': 'kopfhoerer', '📱': 'tablet',
};

// Stichworte → Zeichen. Reihenfolge IST Bedeutung: Das Spezifische steht vor dem
// Allgemeinen, sonst gewinnt „Rad" gegen „Motorrad" und „Spiel" gegen „Spielkonsole".
const STICHWORTE = [
  // Runde 2: Brettspiele VOR der Konsole — „Board games" ist kein Videospiel.
  [/board.?games?|brett.?spiel|gesellschafts.?spiel|jeux? de soci|juegos? de mesa/i, 'wuerfel'],
  // --- Geräte und Technik (spezifisch zuerst) ---
  // Runde 2: „Gaming" hatte kein Stichwort und fiel auf das Funkeln (den „Stern") zurück.
  [/spielkonsole|konsole|playstation|\bps[45]\b|xbox|nintendo|switch\b|controller|gamepad|\bgam(e|es|ing|er)\b|zocken|videospiel|computerspiel|lan.?party/i, 'gamepad'],
  [/beamer|projektor/i, 'beamer'],
  [/leinwand|projektionsfl/i, 'leinwand'],
  [/lautsprecher|boxen\b|\bbox(en)?\b.*musik|soundbar|anlage|\bpa\b|subwoofer/i, 'lautsprecher'],
  [/mikro(fon|phon)?\b|mic\b/i, 'mikrofon'],
  [/kopfh(ö|oe)rer|headset|ohrh(ö|oe)rer/i, 'kopfhoerer'],
  [/plattenspieler|schallplatte|turntable|dj[- ]?pult/i, 'plattenspieler'],
  [/gitarre|bass\b|ukulele/i, 'gitarre'],
  [/klavier|keyboard|piano|\be[- ]?piano\b/i, 'klavier'],
  [/drohne|quadro(copter)?/i, 'drohne'],
  [/stativ|tripod/i, 'stativ'],
  [/laptop|notebook|macbook/i, 'laptop'],
  [/monitor|bildschirm|display/i, 'monitor'],
  [/tablet|ipad/i, 'tablet'],
  [/drucker|printer|3d[- ]?druck/i, 'drucker'],
  [/vr[- ]?brille|\bvr\b|quest|headset.*vr/i, 'vrbrille'],
  [/\bpc\b|rechner|computer|desktop|tower/i, 'pc'],
  [/kamera|spiegelreflex|dslr|gopro|camcorder/i, 'kamera'],
  [/fernglas|feldstecher/i, 'fernglas'],
  // --- Werkzeug und Garten ---
  [/bohrmaschine|bohrer|akkuschrauber|schrauber|schlagbohr/i, 'bohrmaschine'],
  [/werkzeug|schraubenschl|zange|s(ä|ae)ge|hammer|kiste.*werkzeug/i, 'werkzeug'],
  // Runde 2: Bollerwagen VOR Leiter — sonst wurde der „Leiterwagen" zur Leiter.
  [/bollerwagen|handwagen|leiterwagen|transportwagen/i, 'bollerwagen'],
  [/leiter|tritt\b|stehleiter/i, 'leiter'],
  [/rasenm(ä|ae)her|m(ä|ae)her|vertikutier/i, 'rasenmaeher'],
  [/schubkarre|scheibtruhe/i, 'schubkarre'],
  // --- Fahrzeuge ---
  [/anh(ä|ae)nger|hänger|trailer/i, 'anhaenger'],
  [/motorrad|moped|roller\b|vespa|mofa/i, 'motorrad'],
  [/\bauto\b|\bpkw\b|kombi|\bbus\b|van\b|wagen\b|transporter/i, 'auto'],
  [/fahrrad|\brad\b|\bbike\b|\bmtb\b|rennrad|e-?bike|velo|lastenrad/i, 'rad'],
  // --- Draußen und Wasser ---
  [/surfbrett|surfboard|\bsup\b|stand.?up.?paddle|wellenreit/i, 'surfbrett'],
  [/kanu|kajak|paddelboot|schlauchboot/i, 'kanu'],
  [/\bboot\b|segelboot|segeln|yacht|motorboot/i, 'boot'],
  [/schlitten|rodel|bob\b/i, 'schlitten'],
  [/snowboard/i, 'snowboard'],
  [/\bski(er|ausr|schuh|stöck)?\b|tourenski|langlauf/i, 'ski'],
  [/pool|planschbecken|schwimmbecken|whirlpool/i, 'pool'],
  [/h(ä|ae)ngematte/i, 'haengematte'],
  [/pavillon|partyzelt|faltzelt|sonnensegel/i, 'pavillon'],
  [/sonnenschirm|schirm\b/i, 'sonnenschirm'],
  [/campingstuhl|klappstuhl|hocker|campingtisch|klapptisch/i, 'campingstuhl'],
  [/schlafsack|isomatte|luftmatratze|feldbett/i, 'schlafsack'],
  [/zelt/i, 'zelt'],
  [/k(ü|ue)hl(box|tasche|schrank)|k(ü|ue)hlakku/i, 'kuehlbox'],
  [/thermos|isolierkanne|thermoskanne/i, 'thermoskanne'],
  [/picknick(korb|decke)?|korb\b/i, 'picknickkorb'],
  [/raclette|fondue|waffeleisen|crepes|elektrogrill/i, 'raclette'],
  [/grill|bbq|smoker|lagerfeuer|feuerschale/i, 'grill'],
  [/koffer|reisetasche|trolley/i, 'koffer'],
  [/rucksack|wanderrucksack|backpack/i, 'rucksack'],
  // --- Spiele ---
  [/dart(scheibe)?/i, 'dart'],
  [/tischtennis|pingpong|ping.?pong/i, 'tischtennis'],
  [/karten(spiel)?|poker|\buno\b|skat|jass|schnapsen/i, 'karten'],
  [/brettspiel|spieleabend|gesellschaftsspiel|puzzle|quiz|w(ü|ue)rfel|escape/i, 'wuerfel'],
  // --- Essen & Trinken ---
  [/kaffee|café|cafe|espresso|cappuccino|\btee\b|kaffeemaschine|siebtr/i, 'tasse'],
  [/bier|wein|cocktail|drink|trink|\bbar\b|bar-|pub\b|prosecco|sekt|spritz|schnaps|after.?work|zapfanlage/i, 'glas'],
  [/party|feier|fest\b|festival|club|disco|tanz|karaoke|silvester|geburtstag/i, 'feiern'],
  [/pizza|pizzaofen/i, 'pizza'],
  [/koch|pasta|essen|dinner|abendessen|backen|sushi|\beis\b|burger|restaurant|brunch|fr(ü|ue)hst(ü|ue)ck|mittag/i, 'gabel'],
  // --- Sport & draußen ---
  [/schnee|eislauf|schneeschuh/i, 'schnee'],
  [/schwimm|baden\b|\bsee\b|strand|strandbad|sauna/i, 'schwimmen'],
  [/boulder|kletter|berg\b|gipfel|klettersteig|klettergurt/i, 'berg'],
  [/wander|spazier|hike|pf(ä|ae)nder|trail|\blauf|jogg|nordic/i, 'wandern'],
  [/yoga|pilates|meditation|matte\b/i, 'yoga'],
  [/gym|fitness|training|workout|hantel|kraftraum/i, 'hantel'],
  [/volleyball|beachvolley|spikeball|federball|badminton/i, 'volleyball'],
  [/fu(ß|ss)ball|\bball\b|tennis|basket|padel|bowling|billard|minigolf|golf|kegel|handball/i, 'fussball'],
  // --- Ausgehen & Kultur ---
  [/jazz|konzert|musik|platten|\bband\b|singen|\bgig\b|open.?air/i, 'note'],
  [/kino|film|serie|netflix|movie|filmabend/i, 'film'],
  [/museum|ausstellung|vernissage|galerie/i, 'museum'],
  [/theater|oper\b|b(ü|ue)hne|festspiele|ticket|show|kabarett|comedy/i, 'ticket'],
  [/foto(grafie)?/i, 'kamera'],
  [/lesen|buch|b(ü|ue)cher|lernen|bibliothek|\buni\b/i, 'buch'],
  [/camping/i, 'zelt'],
  [/roadtrip|st(ä|ae)dtetrip|ausflug|\bfahrt|\btrip\b/i, 'auto'],
  [/shopping|einkauf|markt|bummel/i, 'tasche'],
  // --- Orte und Stimmungen zuletzt ---
  [/feuerwerk|sonnenaufgang|sonnenuntergang|sonne/i, 'sonne'],
  [/wasser|kanufahrt|segel/i, 'wellen'],
  [/umzug|zuhause|daheim|wohnung|bei mir|renovier/i, 'haus'],
  [/chill|entspann|nichts|abh(ä|ae)ng|couch|sofa/i, 'sofa'],
];

const CATEGORY_KEYS = { essen: 'gabel', ausgehen: 'ticket', sport: 'hantel', chillen: 'sofa', event: 'ticket' };

// Runde 2: Finden die Muster nichts, fragt der Wortschatz — mit Wortstamm, Zusammensetzungen,
// Tippfehlern und vier Sprachen (ui/wortschatz.js). Erst wenn auch der nichts weiß, bleibt es
// beim Rückfall der jeweiligen Fläche (Kategorie, Funkeln, neutraler Anhänger + eigene Wahl).
export function iconKeyForText(text) {
  const t = String(text || '');
  if (!t.trim()) return null;
  for (const [muster, key] of STICHWORTE) if (muster.test(t)) return key;
  return zeichenAusWortschatz(t) || GELERNT.get(t.trim().toLowerCase().replace(/\s+/g, ' ')) || null;
}

// Runde 3 (B2): Vom Server gelernte Zeichen (data/zeichen-lernen.js, Funktion `zeichen`) —
// erst NACH Stichworten und Wortschatz, damit Bekanntes nie überschrieben wird.
const GELERNT = new Map();
export function lerneZeichen(eintraege) {
  for (const [wort, key] of Object.entries(eintraege || {})) {
    if (SYMBOLE[key]) GELERNT.set(String(wort).trim().toLowerCase().replace(/\s+/g, ' '), key);
  }
}

export function activityIconKey(meetLike = {}) {
  const explizit = meetLike.iconKey || meetLike.icon || '';
  if (SYMBOLE[explizit]) return explizit;
  if (ALTE_NAMEN[explizit]) return ALTE_NAMEN[explizit];
  if (EMOJI_KEYS[explizit]) return EMOJI_KEYS[explizit];
  return iconKeyForText(meetLike.title) || CATEGORY_KEYS[meetLike.category] || 'funkeln';
}

// Roher Pfad eines Katalog-Zeichens (für Flächen mit eigenem <svg>).
export function activityIconPath(key, color = 'var(--ink)', strokeWidth = 1.8) {
  const pfad = symbolPfad(SYMBOLE[key] ? key : (ALTE_NAMEN[key] || 'funkeln'), color);
  return strokeWidth === 1.8 ? pfad : pfad.replaceAll('stroke-width="1.8"', `stroke-width="${strokeWidth}"`);
}

// meetLike: {iconKey?, icon?, title?, category?}
export function activityIconSvg(meetLike, color = 'var(--ink)', size = 17) {
  return symbol(activityIconKey(meetLike), color, size);
}

// --- Ressourcen (Auftrag §6.2) ------------------------------------------------------------
// Dieselbe Stichwortliste, aber ein eigener Rückfall: Wird nichts gefunden, kommt das
// neutrale Anhängeschild — und die App bietet an, selbst ein Zeichen auszusuchen.
export const RESSOURCEN_FALLBACK = 'anhaengerNeutral';

// R1 §6.2: `gewaehlt` ist das SELBST ausgesuchte Zeichen. Es schlaegt die automatische
// Zuordnung — aber nur, wenn es den Katalog auch wirklich gibt; ein alter oder fremder
// Name faellt still auf die Stichwortliste zurueck statt ein leeres Feld zu zeichnen.
export function ressourcenIconKey(name, gewaehlt = null) {
  if (gewaehlt && SYMBOLE[gewaehlt]) return gewaehlt;
  return iconKeyForText(name) || RESSOURCEN_FALLBACK;
}

// Ob fuer diesen Namen ueberhaupt etwas gefunden wurde — sonst steht nur der Ersatz da
// und die Oberflaeche bietet die Liste zum Selbstaussuchen an.
export function ressourcenIconGefunden(name) {
  return Boolean(iconKeyForText(name));
}

export function ressourcenIconSvg(name, color = 'var(--muted)', size = 15, gewaehlt = null) {
  return symbol(ressourcenIconKey(name, gewaehlt), color, size);
}

// Zeichen, die zur Auswahl stehen, wenn die Zuordnung nicht trifft. Reihenfolge ist die
// Wahrscheinlichkeit, dass jemand genau dieses Ding teilt.
export const RESSOURCEN_AUSWAHL = [
  'auto', 'anhaenger', 'bollerwagen', 'rad', 'motorrad', 'boot', 'kanu', 'surfbrett',
  'ski', 'snowboard', 'schlitten', 'zelt', 'pavillon', 'campingstuhl', 'haengematte',
  'schlafsack', 'sonnenschirm', 'picknickkorb', 'kuehlbox', 'thermoskanne', 'grill',
  'raclette', 'pool', 'beamer', 'leinwand', 'lautsprecher', 'mikrofon', 'kopfhoerer',
  'plattenspieler', 'gitarre', 'klavier', 'kamera', 'drohne', 'stativ', 'fernglas',
  'pc', 'laptop', 'monitor', 'tablet', 'drucker', 'vrbrille', 'gamepad', 'wuerfel',
  'karten', 'dart', 'tischtennis', 'bohrmaschine', 'werkzeug', 'leiter', 'rasenmaeher',
  'schubkarre', 'koffer', 'rucksack', 'buch', 'haus', RESSOURCEN_FALLBACK,
];

// Die Worte unter den Zeichen in der Auswahl. Ein Zeichen ohne Wort ist ein Ratespiel —
// gerade bei Stativ, Leinwand und Pavillon, die klein alle wie ein Gestell aussehen.
export const RESSOURCEN_WORTE = {
  auto: tx('Auto'), anhaenger: tx('Anhänger'), bollerwagen: tx('Bollerwagen'), rad: tx('Fahrrad'),
  motorrad: tx('Motorrad'), boot: tx('Boot'), kanu: tx('Kanu'), surfbrett: tx('Surfbrett'),
  ski: tx('Ski'), snowboard: tx('Snowboard'), schlitten: tx('Schlitten'), zelt: tx('Zelt'),
  pavillon: tx('Pavillon'), campingstuhl: tx('Campingstuhl'), haengematte: tx('Hängematte'),
  schlafsack: tx('Schlafsack'), sonnenschirm: tx('Sonnenschirm'), picknickkorb: tx('Picknickkorb'),
  kuehlbox: tx('Kühlbox'), thermoskanne: tx('Thermoskanne'), grill: tx('Grill'), raclette: tx('Raclette'),
  pool: tx('Pool'), beamer: tx('Beamer'), leinwand: tx('Leinwand'), lautsprecher: tx('Lautsprecher'),
  mikrofon: tx('Mikrofon'), kopfhoerer: tx('Kopfhörer'), plattenspieler: tx('Plattenspieler'),
  gitarre: tx('Gitarre'), klavier: tx('Klavier'), kamera: tx('Kamera'), drohne: tx('Drohne'),
  stativ: tx('Stativ'), fernglas: tx('Fernglas'), pc: tx('PC'), laptop: tx('Laptop'), monitor: tx('Monitor'),
  tablet: tx('Tablet'), drucker: tx('Drucker'), vrbrille: tx('VR-Brille'), gamepad: tx('Konsole'),
  wuerfel: tx('Spiele'), karten: tx('Karten'), dart: tx('Dart'), tischtennis: tx('Tischtennis'),
  bohrmaschine: tx('Bohrmaschine'), werkzeug: tx('Werkzeug'), leiter: tx('Leiter'),
  rasenmaeher: tx('Rasenmäher'), schubkarre: tx('Schubkarre'), koffer: tx('Koffer'),
  rucksack: tx('Rucksack'), buch: tx('Buch'), haus: tx('Raum'), [RESSOURCEN_FALLBACK]: tx('Allgemein'),
};

// Runde 2: Worte für ARTEN von Aktivitäten — für „Was Crew gelernt hat".
export const ART_WORTE = {
  ...RESSOURCEN_WORTE,
  wellen: tx('Am Wasser'), schwimmen: tx('Schwimmen'), wandern: tx('Wandern'), berg: tx('Klettern & Berge'),
  schnee: tx('Schnee'), hantel: tx('Fitness'), yoga: tx('Yoga'), fussball: tx('Ballsport'), volleyball: tx('Volleyball'),
  sonne: tx('Draußen'), gabel: tx('Essen'), pizza: tx('Pizza'), tasse: tx('Kaffee'), glas: tx('Trinken gehen'),
  feiern: tx('Feiern'), wuerfel: tx('Spiele'), karten: tx('Karten'), gamepad: tx('Gaming'), sofa: tx('Chillen'),
  haus: tx('Zuhause'), buch: tx('Lesen'), film: tx('Kino & Filme'), note: tx('Musik'), ticket: tx('Kultur & Events'),
  museum: tx('Museum'), tasche: tx('Shopping'), funkeln: tx('Anderes'),
};
