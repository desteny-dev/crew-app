// FREE-Mitteilungen und Gruppen-Vorschlag — die EINE Regel (V1-Kern, Auftrag §2; VERSION_1.md B).
//
// Diese Datei läuft an zwei Stellen, unverändert:
//   · in der App (beide Gateways): Gruppen-Vorschlag in „Wer ist frei", Hinweise bei offener App;
//   · im Server: Die Supabase-Funktion `push` bekommt eine Kopie (supabase/functions/_shared/frei-regeln.js,
//     erzeugt von scripts/push-deploy.mjs; `npm run lint` meldet jede Abweichung) und plant damit die
//     Mitteilungen, wenn jemand frei wird.
// Deshalb: KEINE Importe, keine Oberfläche, kein Zustand — Eingaben rein, Ergebnis raus. Die wenigen
// Texte (Mitteilungen ≤ 5 Wörter, Knöpfe, Aktivitäten) stehen hier in vier Sprachen, weil der Server
// das Wörterbuch der App nicht hat.
//
// Die Regeln (Auftrag §2, wichtigste Regel: NICHT FLUTEN):
//   1. Ein Freund wird frei → „Lena ist frei" mit [Auch frei] (wirkt ohne die App zu öffnen).
//   2. Ich bin frei, ein anderer wird frei → „Tom ist auch frei" mit [Meet planen].
//   3. Ab 3 Freien (mit einem Besten Freund ab 2) → ein Vorschlag: nur Personen und eine Aktivität,
//      nie eine Uhrzeit („Lena und Tom: Bouldern?") mit [Planen]. Einfache Regeln bis zum Algorithmus:
//      gemeinsame Interessen, Wochentag, Tageszeit.
//   4. Nicht fluten: wer innerhalb weniger Minuten frei wird, landet in EINER Mitteilung (still
//      fortgeschrieben); Ruhe 22–9 Uhr; höchstens 3 am Tag, davon 1 Vorschlag; Vorschlags-Mitteilungen nur
//      zu Zeiten, zu denen die Gruppe schon öfter Meets hatte (ohne gemeinsame Meets: nur in der App);
//      3× hintereinander ignoriert → 7 Tage nur direkte Einladungen; Personen und Crews stumm schaltbar.
//   5. Texte: Name zuerst, höchstens 5 Wörter, kein App-Name, keine Ausrufezeichen.
// „Wann hat jemand meistens Zeit": nur aus Meet-Teilnahmen und Busy-Einträgen. Nach dem Ende eines
// Busy-Eintrags gilt ein weicher Puffer (bis 17:00 busy → frühestens ca. 17:30–18:00 frei).

export const FREI_REGELN = Object.freeze({
  ruheVon: 22,
  ruheBis: 9,
  proTag: 3,
  vorschlaegeProTag: 1,
  buendelMin: 10,
  ignoriertGrenze: 3,
  pauseTage: 7,
  // Nach so vielen Minuten ohne Tipp gilt eine Mitteilung als ignoriert (für die 3×-Regel).
  reaktionsFristMin: 120,
  vorschlagAb: 3,
  vorschlagAbBeste: 2,
  // „schon öfter" = mindestens so viele gemeinsame Meets zu dieser Zeit.
  meetsFuerVorschlag: 2,
  // Vorschläge kommen in den Stunden VOR der gewohnten Meet-Zeit (Freitagabend → Freitagnachmittag).
  vorschlagVorlaufStd: 6,
  historieTage: 180,
  // Weicher Puffer nach Busy: bis Ende+30 Min sicher beschäftigt, bis Ende+60 abnehmend.
  pufferMinVon: 30,
  pufferMinBis: 60,
  maxWoerter: 5,
  maxVorschlagPersonen: 6,
});

const TAG_MS = 24 * 60 * 60 * 1000;
const MIN_MS = 60 * 1000;
const SPRACHEN = ['de', 'en', 'fr', 'es'];
export const FREI_ARTEN = Object.freeze(['frei', 'frei_auch', 'vorschlag']);

// --- Zeit in der Zone der Person (ohne Bibliothek: Intl kennt jede Zone, auch Sommerzeit) ---------------
const ZONEN_FORMAT = new Map();
function formatFuer(zone) {
  if (!ZONEN_FORMAT.has(zone)) {
    ZONEN_FORMAT.set(zone, new Intl.DateTimeFormat('en-GB', {
      timeZone: zone, hourCycle: 'h23', year: 'numeric', month: '2-digit', day: '2-digit',
      hour: '2-digit', minute: '2-digit', weekday: 'short',
    }));
  }
  return ZONEN_FORMAT.get(zone);
}
const WOCHENTAGE = { Sun: 0, Mon: 1, Tue: 2, Wed: 3, Thu: 4, Fri: 5, Sat: 6 };

export function ortszeit(ms, zeitzone = 'Europe/Vienna') {
  let teile;
  try { teile = formatFuer(zeitzone || 'Europe/Vienna').formatToParts(new Date(ms)); } catch { teile = formatFuer('Europe/Vienna').formatToParts(new Date(ms)); }
  const wert = (typ) => teile.find((t) => t.type === typ)?.value || '';
  const stunde = Number(wert('hour')) % 24;
  const minute = Number(wert('minute'));
  const datum = `${wert('year')}-${wert('month')}-${wert('day')}`;
  return { datum, stunde, minute, minuten: stunde * 60 + minute, wochentag: WOCHENTAGE[wert('weekday')] ?? 0 };
}

export function inRuhezeit(ms, zeitzone) {
  const { stunde } = ortszeit(ms, zeitzone);
  return stunde >= FREI_REGELN.ruheVon || stunde < FREI_REGELN.ruheBis;
}

function hhmm(text) {
  const treffer = /^(\d{1,2}):(\d{2})/.exec(String(text || ''));
  return treffer ? Number(treffer[1]) * 60 + Number(treffer[2]) : null;
}

// Wie sicher ist jemand laut Busy JETZT beschäftigt? 1 = ja, 0 = nein, dazwischen der weiche Puffer.
// belegt: [{ tage:[0–6], von:'HH:MM', bis:'HH:MM' }] — bis < von heißt: über Mitternacht.
export function beschaeftigtGrad(belegt, ms, zeitzone) {
  const jetzt = ortszeit(ms, zeitzone);
  let grad = 0;
  for (const fenster of Array.isArray(belegt) ? belegt : []) {
    const von = hhmm(fenster?.von);
    const bis = hhmm(fenster?.bis);
    if (von === null || bis === null || von === bis) continue;
    const tage = Array.isArray(fenster.tage) ? fenster.tage.map(Number) : [];
    // Ende relativ zu „jetzt" in Minuten, für heute und (bei Nachtschicht / Puffer über Mitternacht) gestern.
    for (const [tagVersatz, wochentag] of [[0, jetzt.wochentag], [-1, (jetzt.wochentag + 6) % 7]]) {
      if (!tage.includes(wochentag)) continue;
      const start = von + tagVersatz * 1440;
      const ende = (bis > von ? bis : bis + 1440) + tagVersatz * 1440;
      const t = jetzt.minuten;
      if (t >= start && t < ende) return 1;
      const danach = t - ende;
      if (danach >= 0 && danach < FREI_REGELN.pufferMinBis) {
        const g = danach < FREI_REGELN.pufferMinVon ? 1
          : 1 - (danach - FREI_REGELN.pufferMinVon) / (FREI_REGELN.pufferMinBis - FREI_REGELN.pufferMinVon);
        grad = Math.max(grad, g);
      }
    }
  }
  return grad;
}

export function wohlBeschaeftigt(belegt, ms, zeitzone) {
  return beschaeftigtGrad(belegt, ms, zeitzone) >= 0.5;
}

// --- Texte ------------------------------------------------------------------------------------
const SAETZE = {
  frei1: { de: '{a} ist frei', en: '{a} is free', fr: '{a} est libre', es: '{a} está libre' },
  frei2: { de: '{a} und {b} sind frei', en: '{a} and {b} are free', fr: '{a} et {b} sont libres', es: '{a} y {b} están libres' },
  freiN: { de: '{a} + {n} sind frei', en: '{a} + {n} are free', fr: '{a} + {n} sont libres', es: '{a} + {n} están libres' },
  auch1: { de: '{a} ist auch frei', en: '{a} is free too', fr: '{a} est libre aussi', es: '{a} también está libre' },
  auch2: { de: '{a} und {b} auch frei', en: '{a} and {b} free too', fr: '{a} et {b} aussi libres', es: '{a} y {b} también libres' },
  auchN: { de: '{a} + {n} auch frei', en: '{a} + {n} free too', fr: '{a} + {n} aussi libres', es: '{a} + {n} también libres' },
  vorschlag1: { de: '{a} und du: {x}?', en: '{a} and you: {x}?', fr: '{a} et toi : {x} ?', es: '{a} y tú: ¿{x}?' },
  vorschlag2: { de: '{a} und {b}: {x}?', en: '{a} and {b}: {x}?', fr: '{a} et {b} : {x} ?', es: '{a} y {b}: ¿{x}?' },
  vorschlagN: { de: '{a} + {n}: {x}?', en: '{a} + {n}: {x}?', fr: '{a} + {n} : {x} ?', es: '{a} + {n}: ¿{x}?' },
  jemand: { de: 'Jemand', en: 'Someone', fr: 'Quelqu’un', es: 'Alguien' },
  knopf_auch_frei: { de: 'Auch frei', en: 'Free too', fr: 'Libre aussi', es: 'También libre' },
  knopf_meet_planen: { de: 'Meet planen', en: 'Plan meet', fr: 'Planifier', es: 'Planear' },
  knopf_planen: { de: 'Planen', en: 'Plan', fr: 'Planifier', es: 'Planear' },
  du_bist_frei: { de: 'Du bist frei', en: 'You’re free', fr: 'Tu es libre', es: 'Estás libre' },
};

function spracheVon(code) {
  const kurz = String(code || 'de').slice(0, 2);
  return SPRACHEN.includes(kurz) ? kurz : 'de';
}

export function freiSatz(schluessel, werte = {}, sprache = 'de') {
  const satz = SAETZE[schluessel]?.[spracheVon(sprache)] ?? SAETZE[schluessel]?.de ?? '';
  return satz.replace(/\{(\w)\}/g, (_, k) => String(werte[k] ?? ''));
}

// Wörter = Teile mit mindestens einem Buchstaben oder einer Ziffer („+" zählt nicht).
export function woerter(text) {
  return String(text || '').split(/\s+/).filter((teil) => /[\p{L}\p{N}]/u.test(teil)).length;
}

// Vorname (bis zum ersten Leerzeichen) — „Name zuerst" heißt der Name, den man ruft.
export function rufname(name, sprache = 'de') {
  const erster = String(name || '').trim().split(/\s+/)[0];
  return erster || freiSatz('jemand', {}, sprache);
}

// Die Mitteilung zu Personen: 1 → „Lena ist frei", 2 → „Lena und Tom sind frei", mehr → „Lena + 2 sind frei".
// Passt der längere Satz nicht in 5 Wörter (lange Namen gibt es nicht, aber Doppelnamen), gilt die kurze Form.
export function freiText(art, namen = [], sprache = 'de') {
  const rufe = namen.map((n) => rufname(n, sprache));
  const [a, b] = rufe;
  const stamm = art === 'frei_auch' ? 'auch' : 'frei';
  const kandidaten = rufe.length <= 1 ? [`${stamm}1`] : rufe.length === 2 ? [`${stamm}2`, `${stamm}N`] : [`${stamm}N`];
  for (const k of kandidaten) {
    const text = freiSatz(k, { a, b, n: rufe.length - 1 }, sprache);
    if (woerter(text) <= FREI_REGELN.maxWoerter) return text;
  }
  return freiSatz(`${stamm}1`, { a }, sprache);
}

export function vorschlagText(namen = [], aktivitaet, sprache = 'de') {
  const rufe = namen.map((n) => rufname(n, sprache));
  const titel = aktivitaetTitel(aktivitaet?.key, sprache) || aktivitaet?.title || '';
  const kurz = aktivitaetTitel(aktivitaet?.key, sprache, true) || titel;
  const [a, b] = rufe;
  const versuche = rufe.length <= 1
    ? [['vorschlag1', titel], ['vorschlag1', kurz]]
    : [...(rufe.length === 2 ? [['vorschlag2', titel], ['vorschlag2', kurz]] : []), ['vorschlagN', titel], ['vorschlagN', kurz]];
  for (const [k, x] of versuche) {
    const text = freiSatz(k, { a, b, n: rufe.length - 1, x }, sprache);
    if (woerter(text) <= FREI_REGELN.maxWoerter) return text;
  }
  return freiSatz(rufe.length <= 1 ? 'vorschlag1' : 'vorschlagN', { a, n: rufe.length - 1, x: kurz.split(/\s+/)[0] }, sprache);
}

// --- Aktivitäten für den Gruppen-Vorschlag (einfache Regeln bis zum Algorithmus) -----------------
// Tageszeiten: morgen 5–10 · vormittag 10–12 · mittag 12–14 · nachmittag 14–18 · abend 18–23 · nacht 23–5.
export function tageszeit(stunde) {
  if (stunde >= 5 && stunde < 10) return 'morgen';
  if (stunde < 12 && stunde >= 10) return 'vormittag';
  if (stunde >= 12 && stunde < 14) return 'mittag';
  if (stunde >= 14 && stunde < 18) return 'nachmittag';
  if (stunde >= 18 && stunde < 23) return 'abend';
  return 'nacht';
}

// title/kurz: deutsch (so wird es als Meet-Titel gespeichert, wie überall in der App); titel: vier Sprachen.
const AKTIVITAETEN = [
  { key: 'essen', gruppe: 'essen', icon: '🍝', iconKey: 'gabel', category: 'essen', wann: ['mittag', 'abend'],
    titel: { de: 'Essen gehen', en: 'Dinner out', fr: 'Aller manger', es: 'Salir a comer' }, kurz: { de: 'Essen', en: 'Food', fr: 'Manger', es: 'Comer' } },
  { key: 'kaffee', gruppe: 'essen', icon: '☕', iconKey: 'tasse', category: 'essen', wann: ['morgen', 'vormittag', 'nachmittag'],
    titel: { de: 'Kaffee trinken', en: 'Coffee', fr: 'Un café', es: 'Un café' }, kurz: { de: 'Kaffee', en: 'Coffee', fr: 'Café', es: 'Café' } },
  { key: 'pizza', gruppe: 'essen', icon: '🍕', iconKey: 'pizza', category: 'essen', wann: ['abend'],
    titel: { de: 'Pizza essen', en: 'Pizza', fr: 'Une pizza', es: 'Pizza' }, kurz: { de: 'Pizza', en: 'Pizza', fr: 'Pizza', es: 'Pizza' } },
  { key: 'bouldern', gruppe: 'sport', icon: '🧗', iconKey: 'berg', category: 'sport', wann: ['nachmittag', 'abend'],
    titel: { de: 'Bouldern', en: 'Bouldering', fr: 'Escalade', es: 'Escalada' }, kurz: { de: 'Bouldern', en: 'Bouldering', fr: 'Escalade', es: 'Escalada' } },
  { key: 'radtour', gruppe: 'sport', icon: '🚲', iconKey: 'rad', category: 'sport', wann: ['vormittag', 'mittag', 'nachmittag'],
    titel: { de: 'Radtour', en: 'Bike ride', fr: 'Balade à vélo', es: 'Ruta en bici' }, kurz: { de: 'Radtour', en: 'Biking', fr: 'Vélo', es: 'Bici' } },
  { key: 'volleyball', gruppe: 'sport', icon: '🏐', iconKey: 'volleyball', category: 'sport', wann: ['nachmittag', 'abend'],
    titel: { de: 'Volleyball', en: 'Volleyball', fr: 'Volley', es: 'Vóley' }, kurz: { de: 'Volleyball', en: 'Volleyball', fr: 'Volley', es: 'Vóley' } },
  { key: 'spaziergang', gruppe: 'natur', icon: '🌄', iconKey: 'sonne', category: 'chillen', wann: ['morgen', 'vormittag', 'mittag', 'nachmittag'],
    titel: { de: 'Spaziergang', en: 'A walk', fr: 'Une balade', es: 'Un paseo' }, kurz: { de: 'Spaziergang', en: 'Walk', fr: 'Balade', es: 'Paseo' } },
  { key: 'wandern', gruppe: 'natur', icon: '⛰️', iconKey: 'wandern', category: 'sport', wann: ['morgen', 'vormittag', 'mittag'], nurWochenende: true,
    titel: { de: 'Wandern', en: 'Hiking', fr: 'Randonnée', es: 'Senderismo' }, kurz: { de: 'Wandern', en: 'Hiking', fr: 'Rando', es: 'Senderismo' } },
  { key: 'see', gruppe: 'natur', icon: '🌊', iconKey: 'wellen', category: 'chillen', wann: ['nachmittag', 'abend'],
    titel: { de: 'An den See', en: 'To the lake', fr: 'Au lac', es: 'Al lago' }, kurz: { de: 'See', en: 'Lake', fr: 'Lac', es: 'Lago' } },
  { key: 'kino', gruppe: 'kultur', icon: '🎬', iconKey: 'film', category: 'ausgehen', wann: ['abend'],
    titel: { de: 'Kino', en: 'Cinema', fr: 'Ciné', es: 'Cine' }, kurz: { de: 'Kino', en: 'Cinema', fr: 'Ciné', es: 'Cine' } },
  { key: 'museum', gruppe: 'kultur', icon: '🏛', iconKey: 'museum', category: 'event', wann: ['vormittag', 'mittag', 'nachmittag'],
    titel: { de: 'Museum', en: 'Museum', fr: 'Musée', es: 'Museo' }, kurz: { de: 'Museum', en: 'Museum', fr: 'Musée', es: 'Museo' } },
  { key: 'trinken', gruppe: 'club bar', icon: '🍻', iconKey: 'glas', category: 'ausgehen', wann: ['abend'], alkohol: true,
    titel: { de: 'Was trinken', en: 'Drinks', fr: 'Un verre', es: 'Unas copas' }, kurz: { de: 'Trinken', en: 'Drinks', fr: 'Un verre', es: 'Copas' } },
  { key: 'bowling', gruppe: 'club bar', icon: '🎳', iconKey: 'fussball', category: 'ausgehen', wann: ['nachmittag', 'abend'],
    titel: { de: 'Bowling', en: 'Bowling', fr: 'Bowling', es: 'Bolos' }, kurz: { de: 'Bowling', en: 'Bowling', fr: 'Bowling', es: 'Bolos' } },
  { key: 'spieleabend', gruppe: 'zuhause', icon: '🎲', iconKey: 'wuerfel', category: 'chillen', wann: ['abend', 'nacht'],
    titel: { de: 'Spieleabend', en: 'Game night', fr: 'Soirée jeux', es: 'Noche de juegos' }, kurz: { de: 'Spiele', en: 'Games', fr: 'Jeux', es: 'Juegos' } },
  { key: 'kochen', gruppe: 'zuhause', icon: '🍳', iconKey: 'gabel', category: 'essen', wann: ['mittag', 'abend'],
    titel: { de: 'Zusammen kochen', en: 'Cook together', fr: 'Cuisiner ensemble', es: 'Cocinar juntos' }, kurz: { de: 'Kochen', en: 'Cooking', fr: 'Cuisiner', es: 'Cocinar' } },
  { key: 'filmabend', gruppe: 'zuhause', icon: '🍿', iconKey: 'film', category: 'chillen', wann: ['abend', 'nacht'],
    titel: { de: 'Filmabend', en: 'Movie night', fr: 'Soirée ciné', es: 'Noche de cine' }, kurz: { de: 'Film', en: 'Movie', fr: 'Film', es: 'Peli' } },
];
export const AKTIVITAETS_KEYS = Object.freeze(AKTIVITAETEN.map((a) => a.key));
const GRUPPEN = ['zuhause', 'essen', 'club bar', 'sport', 'natur', 'kultur'];

export function aktivitaetTitel(key, sprache = 'de', kurz = false) {
  const a = AKTIVITAETEN.find((x) => x.key === key);
  if (!a) return '';
  const quelle = kurz ? a.kurz : a.titel;
  return quelle[spracheVon(sprache)] || quelle.de;
}

// Gespeicherte Interessen → Gruppe. Seit Runde 11 wählt man nur noch die sechs Gruppen („Natur" …);
// ältere Konten (und der Beispielbestand) tragen noch eigene Wörter wie „Bouldern" oder „Spieleabend".
// Die werden über ihren Wortstamm einer Gruppe zugeordnet, sonst zählten sie für den Vorschlag gar nicht.
const GRUPPEN_WOERTER = [
  ['sport', /(sport|boulder|kletter|lauf|jogg|\brad\b|fahrrad|radfahr|\bbike|fussball|volley|spikeball|tennis|padel|schwimm|fitness|yoga|box|ski|snowboard|surf|sup|kajak|kanu|tanz)/],
  ['natur', /(draussen|wander|\bsee|berg|natur|picknick|grill|camp|zelt|garten|strand|alm|huette|park|spazier|slackline|radtour)/],
  ['essen', /(essen|koch|pizza|sushi|burger|brunch|fruehstueck|kaffee|cafe|restaurant|food|backen)/],
  ['kultur', /(kultur|kino|film|museum|theater|konzert|musik|lesen|buch|kunst|ausstellung|oper|slam|fotograf)/],
  ['club bar', /(ausgehen|party|feiern|club|\bbar\b|kneipe|pub|festival|karaoke|bowling|billard|quiz)/],
  ['zuhause', /(zuhause|spiele|gaming|ps5|konsole|serie|netflix|filmabend|karten|brettspiel|puzzle|chillen|sofa)/],
];

export function interessenGruppe(wert) {
  const norm = String(wert || '').toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/ß/g, 'ss').trim();
  if (!norm) return null;
  if (GRUPPEN.includes(norm)) return norm;
  const treffer = GRUPPEN_WOERTER.find(([, muster]) => muster.test(norm));
  return treffer ? treffer[0] : null;
}

function aktivitaetOeffentlich(a) {
  return { key: a.key, title: a.titel.de, icon: a.icon, iconKey: a.iconKey, category: a.category, gruppe: a.gruppe };
}

// Beste Aktivität für eine Gruppe von Menschen: gemeinsame Interessen (die Gruppe mit den meisten
// Stimmen), dazu Wochentag und Tageszeit. Jugendliche dabei → nie etwas mit Alkohol-Schwerpunkt.
// → { aktivitaet, alternativen:[2], grund:'interessen'|'tageszeit' }
export function aktivitaetFuer({ interessen = [], jetzt = Date.now(), zeitzone = 'Europe/Vienna', jugendlich = false } = {}) {
  const { stunde, wochentag } = ortszeit(jetzt, zeitzone);
  const zeit = tageszeit(stunde);
  const wochenende = wochentag === 0 || wochentag === 6;
  const passtZeit = (a) => a.wann.includes(zeit) && (!a.nurWochenende || wochenende) && !(jugendlich && a.alkohol);
  const zaehler = new Map(GRUPPEN.map((g) => [g, 0]));
  for (const liste of interessen) {
    for (const g of new Set((Array.isArray(liste) ? liste : []).map(interessenGruppe).filter(Boolean))) zaehler.set(g, zaehler.get(g) + 1);
  }
  // Rangfolge der Gruppen: Stimmen, bei Gleichstand die Reihenfolge, die zur Tageszeit passt.
  const zeitVorliebe = {
    morgen: ['essen', 'natur', 'sport', 'kultur', 'zuhause', 'club bar'],
    vormittag: ['natur', 'essen', 'sport', 'kultur', 'zuhause', 'club bar'],
    mittag: ['essen', 'natur', 'sport', 'kultur', 'zuhause', 'club bar'],
    nachmittag: ['natur', 'sport', 'essen', 'kultur', 'club bar', 'zuhause'],
    abend: ['essen', 'club bar', 'zuhause', 'kultur', 'sport', 'natur'],
    nacht: ['zuhause', 'club bar', 'essen', 'kultur', 'sport', 'natur'],
  }[zeit];
  const rang = [...GRUPPEN].sort((x, y) => (zaehler.get(y) - zaehler.get(x)) || (zeitVorliebe.indexOf(x) - zeitVorliebe.indexOf(y)));
  const kandidaten = [];
  for (const gruppe of rang) {
    // Am Wochenende zuerst, was es nur am Wochenende gibt (Wandern statt Spaziergang).
    const passend = AKTIVITAETEN.filter((x) => x.gruppe === gruppe && passtZeit(x))
      .sort((x, y) => Number(Boolean(y.nurWochenende)) - Number(Boolean(x.nurWochenende)));
    kandidaten.push(...passend);
  }
  if (!kandidaten.length) kandidaten.push(...AKTIVITAETEN.filter((a) => !(jugendlich && a.alkohol)));
  // Eine Aktivität je Gruppe zuerst (Abwechslung in den Alternativen), dann der Rest.
  const erste = [];
  const rest = [];
  for (const a of kandidaten) (erste.some((x) => x.gruppe === a.gruppe) ? rest : erste).push(a);
  const reihe = [...erste, ...rest];
  const grund = (zaehler.get(reihe[0].gruppe) || 0) > 0 ? 'interessen' : 'tageszeit';
  return { aktivitaet: aktivitaetOeffentlich(reihe[0]), alternativen: reihe.slice(1, 3).map(aktivitaetOeffentlich), grund };
}

// --- Gruppen-Vorschlag ------------------------------------------------------------------------
// freie: Freunde, die JETZT frei sind: [{ id, name, interessen, jugendlich }] (ohne mich).
// → { personIds, aktivitaet, alternativen, grund } | null
// Wer nicht in den Vorschlag gehört, obwohl FREE: stumm geschaltete Personen (stummIds) und wer gerade in
// einem laufenden Meet steckt (imMeet) — „Wer ist frei" zeigt beide auch nicht.
export function gruppenVorschlag({ ich = null, freie = [], besteIds = [], jetzt = Date.now(), zeitzone = 'Europe/Vienna', stummIds = [] } = {}) {
  if (!ich) return null;
  const stumm = new Set(stummIds || []);
  const andere = (Array.isArray(freie) ? freie : []).filter((p) => p && p.id && p.id !== ich.id && !p.imMeet && !stumm.has(p.id));
  const beste = new Set(besteIds || []);
  const mitBestem = andere.some((p) => beste.has(p.id));
  const noetig = mitBestem ? FREI_REGELN.vorschlagAbBeste : FREI_REGELN.vorschlagAb;
  if (andere.length + 1 < noetig) return null;
  const sortiert = [...andere].sort((x, y) => (Number(beste.has(y.id)) - Number(beste.has(x.id))) || String(x.name || '').localeCompare(String(y.name || ''), 'de'));
  const auswahl = sortiert.slice(0, FREI_REGELN.maxVorschlagPersonen);
  const jugendlich = Boolean(ich.jugendlich) || auswahl.some((p) => p.jugendlich);
  const wahl = aktivitaetFuer({ interessen: [ich.interessen, ...auswahl.map((p) => p.interessen)], jetzt, zeitzone, jugendlich });
  return { personIds: auswahl.map((p) => p.id), ...wahl };
}

// --- Gewohnte Meet-Zeiten einer Gruppe -----------------------------------------------------------
// historie: [{ datum:'YYYY-MM-DD', zeit:'HH:MM'|null, teilnehmer:[ids] }] — vergangene Meets, Teilnehmer =
// Zusage 'yes'. Es zählt ein Meet, bei dem der Empfänger und mindestens zwei Drittel der Gruppe dabei waren
// (mindestens 2 Personen), am selben Wochentag, mit Beginn in den nächsten vorschlagVorlaufStd Stunden
// (oder vor höchstens einer Stunde). Ohne Uhrzeit zählt der Wochentag allein.
export function gewohnteMeetZeit({ empfaengerId, gruppe = [], historie = [], jetzt = Date.now(), zeitzone = 'Europe/Vienna' } = {}) {
  const jetztOrt = ortszeit(jetzt, zeitzone);
  const mitglieder = new Set([empfaengerId, ...gruppe].filter(Boolean));
  const noetig = Math.max(2, Math.ceil((mitglieder.size * 2) / 3));
  const grenze = jetzt - FREI_REGELN.historieTage * TAG_MS;
  let anzahl = 0;
  for (const meet of Array.isArray(historie) ? historie : []) {
    const teilnehmer = new Set(meet?.teilnehmer || []);
    if (!teilnehmer.has(empfaengerId)) continue;
    if ([...mitglieder].filter((id) => teilnehmer.has(id)).length < noetig) continue;
    const [j, m, t] = String(meet.datum || '').split('-').map(Number);
    if (!j || !m || !t) continue;
    const tagMs = Date.UTC(j, m - 1, t, 12);
    if (tagMs < grenze || tagMs > jetzt + TAG_MS) continue;
    if (new Date(tagMs).getUTCDay() !== jetztOrt.wochentag) continue;
    const beginn = hhmm(meet.zeit);
    if (beginn !== null) {
      const abstand = beginn - jetztOrt.minuten;
      if (abstand < -60 || abstand > FREI_REGELN.vorschlagVorlaufStd * 60) continue;
    }
    anzahl += 1;
  }
  return { passt: anzahl >= FREI_REGELN.meetsFuerVorschlag, anzahl };
}

// --- Wer bekommt überhaupt Hinweise über wen (Einstellung „Bescheid, wenn jemand frei ist") -------
// freiHints: { mode:'alle'|'beste'|'markierte'|'individuell'|'niemand', customIds:[…] } — die Einstellung
// des EMPFÄNGERS. 'markierte' = Beste Freunde und die besondere Person.
export function freiHinweisErlaubt({ freiHints, besteIds = [], besondereId = null, stumm = null } = {}, werId) {
  if (!werId) return false;
  if ((stumm?.personen || []).includes(werId)) return false;
  switch (freiHints?.mode || 'alle') {
    case 'alle': return true;
    case 'beste': return (besteIds || []).includes(werId);
    case 'markierte': return (besteIds || []).includes(werId) || besondereId === werId;
    case 'individuell': return (freiHints?.customIds || []).includes(werId);
    default: return false;
  }
}

// --- Planung der Mitteilungen, wenn jemand frei wird (Server) --------------------------------------
// Eingabe:
//   jetzt       ms
//   wer         { id, name }                      — ist gerade frei geworden
//   empfaenger  [{ id, sprache, zeitzone, frei (bool), freiHints, besteIds, besondereId, stumm,
//                  belegt:[Busy-Fenster], pauseBis (ms|null),
//                  heute:{ frei:n, vorschlaege:n }        — FREE-Mitteilungen heute (Ortstag des Empfängers)
//                  letzte:[{ art, at, reagiert }]         — die letzten FREE-Mitteilungen, neueste zuerst
//                  offen:{ tag, art, personen:[ids], at } | null — jüngste FREE-Mitteilung (zum Bündeln)
//                  interessen, jugendlich,
//                  freieFreunde:[{ id, name, interessen, jugendlich }] — seine Freunde, die JETZT frei sind (inkl. wer)
//                  namen:{ [id]: name } — Namen für gebündelte Personen, die nicht in freieFreunde stehen }]
//   historie    { [empfaengerId]: [{ datum, zeit, teilnehmer:[ids] }] }
// Ausgabe:
//   { mitteilungen:[{ empfaengerId, art, titel, text, tag, still, fortschreiben, zaehlt, personen:[ids],
//                     aktionen:[{ id, titel, hintergrund, url? }], url, aktivitaet? }],
//     pausen:[{ empfaengerId, bis }], uebersprungen:[{ empfaengerId, grund }] }
// „fortschreiben" heißt: dieselbe Mitteilung (gleiches tag) still ersetzen — zählt NICHT als neue.
export function freiMitteilungenPlanen({ jetzt = Date.now(), wer, empfaenger = [], historie = {} } = {}) {
  const ergebnis = { mitteilungen: [], pausen: [], uebersprungen: [] };
  if (!wer?.id) return ergebnis;
  for (const r of Array.isArray(empfaenger) ? empfaenger : []) {
    if (!r?.id || r.id === wer.id) continue;
    const ueberspringen = (grund) => ergebnis.uebersprungen.push({ empfaengerId: r.id, grund });
    const sprache = spracheVon(r.sprache);
    const zone = r.zeitzone || 'Europe/Vienna';
    if (!freiHinweisErlaubt(r, wer.id)) { ueberspringen((r.stumm?.personen || []).includes(wer.id) ? 'stumm' : 'hinweise-aus'); continue; }
    if (Number(r.pauseBis) > jetzt) { ueberspringen('pause'); continue; }
    // 3× hintereinander ignoriert → 7 Tage nur direkte Einladungen. Als ignoriert gilt, was reaktionsFristMin
    // lang ohne Tipp blieb; eine Pause setzt die Zählung zurück (nur Mitteilungen NACH der letzten Pause zählen).
    const alt = (r.letzte || []).filter((m) => FREI_ARTEN.includes(m.art) && Number(m.at) <= jetzt - FREI_REGELN.reaktionsFristMin * MIN_MS);
    const serie = alt.slice(0, FREI_REGELN.ignoriertGrenze);
    if (serie.length === FREI_REGELN.ignoriertGrenze && serie.every((m) => !m.reagiert)) {
      const bis = jetzt + FREI_REGELN.pauseTage * TAG_MS;
      ergebnis.pausen.push({ empfaengerId: r.id, bis });
      ueberspringen('pause-neu');
      continue;
    }
    if (inRuhezeit(jetzt, zone)) { ueberspringen('ruhezeit'); continue; }
    if (!r.frei && wohlBeschaeftigt(r.belegt, jetzt, zone)) { ueberspringen('beschaeftigt'); continue; }

    const art = r.frei ? 'frei_auch' : 'frei';
    const namen = { ...(r.namen || {}), [wer.id]: wer.name };
    for (const f of r.freieFreunde || []) namen[f.id] = f.name;

    // Bündeln: Eine FREE-Mitteilung der letzten buendelMin Minuten wird still fortgeschrieben.
    const offen = r.offen && (r.offen.art === 'frei' || r.offen.art === 'frei_auch')
      && Number(r.offen.at) > jetzt - FREI_REGELN.buendelMin * MIN_MS ? r.offen : null;

    // Vorschlag: nur, wer selbst frei ist; genug Freie; heute noch keiner; gewohnte Meet-Zeit der Gruppe.
    let vorschlag = null;
    if (r.frei) {
      const kandidat = gruppenVorschlag({
        ich: { id: r.id, interessen: r.interessen, jugendlich: r.jugendlich },
        freie: r.freieFreunde || [], besteIds: r.besteIds || [], jetzt, zeitzone: zone, stummIds: r.stumm?.personen || [],
      });
      if (kandidat && Number(r.heute?.vorschlaege || 0) < FREI_REGELN.vorschlaegeProTag
        && Number(r.heute?.frei || 0) < FREI_REGELN.proTag
        && gewohnteMeetZeit({ empfaengerId: r.id, gruppe: kandidat.personIds, historie: historie[r.id] || [], jetzt, zeitzone: zone }).passt) {
        vorschlag = kandidat;
      }
    }

    if (vorschlag) {
      const personen = vorschlag.personIds;
      const planUrl = routeUrl('newMeet.discover', {
        personIds: personen, ideaTitle: aktivitaetTitel(vorschlag.aktivitaet.key, sprache), ideaIcon: vorschlag.aktivitaet.icon,
        ideaIconKey: vorschlag.aktivitaet.iconKey, ideaCategory: vorschlag.aktivitaet.category, ideaSource: 'frei',
      });
      ergebnis.mitteilungen.push({
        empfaengerId: r.id, art: 'vorschlag', personen,
        titel: vorschlagText(personen.map((id) => namen[id] || ''), vorschlag.aktivitaet, sprache), text: '',
        tag: 'frei', still: false, fortschreiben: false, zaehlt: true,
        aktionen: [{ id: 'planen', titel: freiSatz('knopf_planen', {}, sprache), hintergrund: false, url: planUrl }],
        url: planUrl, aktivitaet: vorschlag.aktivitaet,
      });
      continue;
    }

    if (offen) {
      const personen = [...new Set([...(offen.personen || []), wer.id])];
      ergebnis.mitteilungen.push(mitteilungFuer(r, art, personen, namen, sprache, { tag: offen.tag || 'frei', still: true, fortschreiben: true, zaehlt: false }));
      continue;
    }
    if (Number(r.heute?.frei || 0) >= FREI_REGELN.proTag) { ueberspringen('tagesgrenze'); continue; }
    ergebnis.mitteilungen.push(mitteilungFuer(r, art, [wer.id], namen, sprache, { tag: 'frei', still: false, fortschreiben: false, zaehlt: true }));
  }
  return ergebnis;
}

function routeUrl(route, params) {
  return `?route=${encodeURIComponent(route)}&params=${encodeURIComponent(JSON.stringify(params))}`;
}

function mitteilungFuer(r, art, personen, namen, sprache, extra) {
  const titel = freiText(art, personen.map((id) => namen[id] || ''), sprache);
  const aktionen = art === 'frei'
    ? [{ id: 'auch_frei', titel: freiSatz('knopf_auch_frei', {}, sprache), hintergrund: true }]
    : [{ id: 'meet_planen', titel: freiSatz('knopf_meet_planen', {}, sprache), hintergrund: false, url: routeUrl('newMeet.discover', { personIds: personen }) }];
  return { empfaengerId: r.id, art, titel, text: '', personen, aktionen, url: routeUrl('crew.home', {}), ...extra };
}
