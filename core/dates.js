// Datums-/Zeit-Helfer. Die App rechnet mit echten Daten; Demo-Meets werden relativ zu heute gesät.

import { sprache, t } from './sprache.js';

// Runde 2: Namen je Sprache, bewusst als Listen statt Intl — Intl schreibt „Fr." mit Punkt
// und in Österreich „Jänner"; hier steht genau das, was auf die kleinen Flächen passt.
const NAMEN = {
  de: {
    kurz: ['So', 'Mo', 'Di', 'Mi', 'Do', 'Fr', 'Sa'],
    lang: ['Sonntag', 'Montag', 'Dienstag', 'Mittwoch', 'Donnerstag', 'Freitag', 'Samstag'],
    monate: ['Januar', 'Februar', 'März', 'April', 'Mai', 'Juni', 'Juli', 'August', 'September', 'Oktober', 'November', 'Dezember'],
  },
  en: {
    kurz: ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'],
    lang: ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'],
    monate: ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'],
  },
  fr: {
    kurz: ['dim', 'lun', 'mar', 'mer', 'jeu', 'ven', 'sam'],
    lang: ['dimanche', 'lundi', 'mardi', 'mercredi', 'jeudi', 'vendredi', 'samedi'],
    monate: ['janvier', 'février', 'mars', 'avril', 'mai', 'juin', 'juillet', 'août', 'septembre', 'octobre', 'novembre', 'décembre'],
  },
  es: {
    kurz: ['dom', 'lun', 'mar', 'mié', 'jue', 'vie', 'sáb'],
    lang: ['domingo', 'lunes', 'martes', 'miércoles', 'jueves', 'viernes', 'sábado'],
    monate: ['enero', 'febrero', 'marzo', 'abril', 'mayo', 'junio', 'julio', 'agosto', 'septiembre', 'octubre', 'noviembre', 'diciembre'],
  },
};
const namen = () => NAMEN[sprache()] || NAMEN.de;

export function now() {
  return new Date();
}

export function toISODate(date) {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, '0');
  const d = String(date.getDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
}

export function fromISODate(iso) {
  const [y, m, d] = iso.split('-').map(Number);
  return new Date(y, m - 1, d);
}

// offsetDays relativ zu heute → ISO-Datum (für Seeds).
export function dayOffset(offsetDays) {
  const date = now();
  date.setDate(date.getDate() + offsetDays);
  return toISODate(date);
}

export function isToday(iso) {
  return iso === toISODate(now());
}

export function isTomorrow(iso) {
  return iso === dayOffset(1);
}

export function weekdayShort(iso) {
  return namen().kurz[fromISODate(iso).getDay()];
}

export function weekdayLong(iso) {
  return namen().lang[fromISODate(iso).getDay()];
}

export function monthLong(iso) {
  return namen().monate[fromISODate(iso).getMonth()];
}

export function monthLongByIndex(index) {
  return namen().monate[index];
}

// Tag und Monat in der Reihenfolge der Sprache: „12. Juli" · „12 July" · „12 juillet" · „12 de julio".
export function tagUndMonat(date) {
  const tag = date.getDate();
  const monat = namen().monate[date.getMonth()];
  switch (sprache()) {
    case 'en': case 'fr': return `${tag} ${monat}`;
    case 'es': return `${tag} de ${monat}`;
    default: return `${tag}. ${monat}`;
  }
}

// Kurz: „22.8." · „22/8".
export function tagMonatKurz(date) {
  return sprache() === 'de' ? `${date.getDate()}.${date.getMonth() + 1}.` : `${date.getDate()}/${date.getMonth() + 1}`;
}

// Kopfzeile eines Monats: „September 2026" · „Septembre 2026" · „Septiembre de 2026".
export function monatUndJahr(date) {
  const monat = namen().monate[date.getMonth()];
  const gross = monat.charAt(0).toUpperCase() + monat.slice(1);
  return sprache() === 'es' ? `${gross} de ${date.getFullYear()}` : `${gross} ${date.getFullYear()}`;
}

// Kurze Monatsnamen für Auswahlraster. Nicht einfach die ersten drei Buchstaben: im
// Französischen wären juin und juillet beide „jui".
const MONATE_KURZ = {
  de: ['Jan', 'Feb', 'Mär', 'Apr', 'Mai', 'Jun', 'Jul', 'Aug', 'Sep', 'Okt', 'Nov', 'Dez'],
  en: ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'],
  fr: ['janv', 'févr', 'mars', 'avr', 'mai', 'juin', 'juil', 'août', 'sept', 'oct', 'nov', 'déc'],
  es: ['ene', 'feb', 'mar', 'abr', 'may', 'jun', 'jul', 'ago', 'sep', 'oct', 'nov', 'dic'],
};
export function monatKurz(index) {
  return (MONATE_KURZ[sprache()] || MONATE_KURZ.de)[index];
}

// Anfangsbuchstaben der Wochentage ab Montag: „M D M D F S S" · „M T W T F S S".
const WOCHE_INITIALEN = {
  de: ['M', 'D', 'M', 'D', 'F', 'S', 'S'],
  en: ['M', 'T', 'W', 'T', 'F', 'S', 'S'],
  fr: ['L', 'M', 'M', 'J', 'V', 'S', 'D'],
  es: ['L', 'M', 'X', 'J', 'V', 'S', 'D'],
};
export function wochenInitialen() {
  return WOCHE_INITIALEN[sprache()] || WOCHE_INITIALEN.de;
}

// "Fr · 12. Juli" bzw. "Heute" / "Morgen" vorangestellt.
export function formatMeetDate(iso) {
  const date = fromISODate(iso);
  if (isToday(iso)) return t('Heute');
  if (isTomorrow(iso)) return t('Morgen');
  return `${namen().kurz[date.getDay()]} · ${tagUndMonat(date)}`;
}

// „Fr 12.7.2026" · „Fri 12/7/2026" (Tag vor Monat auch im Englischen: en-GB).
export function formatShortDate(iso) {
  const date = fromISODate(iso);
  const trenner = sprache() === 'de' ? '.' : '/';
  return `${namen().kurz[date.getDay()]} ${date.getDate()}${trenner}${date.getMonth() + 1}${trenner}${date.getFullYear()}`;
}

// ISO-8601-Kalenderwoche.
export function isoWeek(iso) {
  const date = fromISODate(iso);
  const target = new Date(date.valueOf());
  const dayNumber = (date.getDay() + 6) % 7;
  target.setDate(target.getDate() - dayNumber + 3);
  const firstThursday = target.valueOf();
  target.setMonth(0, 1);
  if (target.getDay() !== 4) target.setMonth(0, 1 + ((4 - target.getDay()) + 7) % 7);
  return 1 + Math.ceil((firstThursday - target) / 604800000);
}

// Montag der Woche, in der iso liegt.
export function weekStart(iso) {
  const date = fromISODate(iso);
  const dayNumber = (date.getDay() + 6) % 7;
  date.setDate(date.getDate() - dayNumber);
  return toISODate(date);
}

export function addDays(iso, days) {
  const date = fromISODate(iso);
  date.setDate(date.getDate() + days);
  return toISODate(date);
}

// Sieben ISO-Daten der Woche ab Montag.
export function weekDays(mondayISO) {
  return Array.from({ length: 7 }, (_, index) => addDays(mondayISO, index));
}

export function currentTimeHHMM() {
  const date = now();
  // v4: Stunde MIT führender Null — eine Statusleiste zeigt „00:18", nicht „0:18".
  // Ohne das Padding sah die Uhr zwischen Mitternacht und 10 Uhr falsch aus.
  return `${String(date.getHours()).padStart(2, '0')}:${String(date.getMinutes()).padStart(2, '0')}`;
}

// Vergleich "jetzt" gegen Datum+Uhrzeit eines Meets.
export function meetSortKey(meet) {
  return `${meet.date} ${meet.time || '00:00'}`;
}

// --- Runde 4 (Jonathan F2): „Jetzt" bleibt „Jetzt" ------------------------------------------
// „Wenn man eine Zeit wählt als Vorschlag und die Zeit wäre jetzt, dann wird nicht die Uhrzeit
// angezeigt, sondern einfach nur jetzt … in fünf Minuten ist die Uhrzeit Vergangenheit."
//
// Ein Zeitpunkt, der als „Jetzt" gewählt wurde, trägt eine Marke: `now: true` an Terminen
// (draft.when, draft.whenProposals[], Zeit-Varianten eines Meets) bzw. `nowTime: true` am Meet
// selbst (neben `openTime`). `time` bleibt trotzdem gefüllt — mit dem Moment, in dem „Jetzt"
// gesetzt wurde. Solange dieser Moment weniger als JETZT_FENSTER_MIN zurückliegt, heißt der
// Zeitpunkt „Jetzt"; danach zeigt die App ehrlich die Uhrzeit (am nächsten Tag wäre „Jetzt"
// falsch). Ohne Marke wird NIE geraten: eine zufällig passende Uhrzeit bleibt eine Uhrzeit.
export const JETZT_FENSTER_MIN = 180;

const hatJetztMarke = (zeit) => Boolean(zeit && (zeit.now === true || zeit.nowTime === true));
const zeitIstOffen = (zeit) => Boolean(!zeit || zeit.open || zeit.openTime || !zeit.time);

function startVon(zeit) {
  if (!zeit?.date || !zeit?.time) return null;
  const [h, m] = String(zeit.time).split(':').map(Number);
  if (!Number.isFinite(h)) return null;
  const start = fromISODate(zeit.date);
  start.setHours(h, Number.isFinite(m) ? m : 0, 0, 0);
  return start;
}

// Ist dieser Zeitpunkt (Termin, Zeit-Variante oder Meet) gerade „Jetzt"?
//   optionen.bezug      Vergleichszeitpunkt (Standard: now())
//   optionen.fensterMin wie lange „Jetzt" gilt (Standard JETZT_FENSTER_MIN; Infinity für Entwürfe,
//                       deren „Jetzt" erst beim Senden festgeschrieben wird)
export function istJetzt(zeit, optionen = {}) {
  if (!hatJetztMarke(zeit)) return false;
  const bezug = optionen.bezug || now();
  const fensterMin = optionen.fensterMin ?? JETZT_FENSTER_MIN;
  const start = startVon(zeit);
  if (!start) return !zeit.date || zeit.date === toISODate(bezug) || fensterMin === Infinity;
  return (bezug - start) / 60000 < fensterMin;
}

// Nur die Uhrzeit: „Jetzt" · „Zeit offen" · „19:30".
export function zeitText(zeit, optionen = {}) {
  if (istJetzt(zeit, optionen)) return t('Jetzt');
  if (zeitIstOffen(zeit)) return t('Zeit offen');
  return String(zeit.time);
}

// Datum und Uhrzeit: „Jetzt" (ohne Datum — Jetzt ist immer heute) · „Sa 13.9. · 19:30" ·
// „Sa 13.9. · Zeit offen". optionen.datum(iso) ersetzt die Datumsschreibweise des Bildschirms
// (z. B. meetDateLabel → „Heute · 19:30").
export function terminText(zeit, optionen = {}) {
  if (istJetzt(zeit, optionen)) return t('Jetzt');
  if (!zeit?.date) return zeitText(zeit, optionen);
  const datum = optionen.datum || ((iso) => `${weekdayShort(iso)} ${tagMonatKurz(fromISODate(iso))}`);
  return `${datum(zeit.date)} · ${zeitText(zeit, optionen)}`;
}

// Ein neuer Termin „Jetzt": { date, time, open:false, now:true } — time ist der Moment selbst.
export function jetztTermin(bezug = now()) {
  return {
    date: toISODate(bezug),
    time: `${String(bezug.getHours()).padStart(2, '0')}:${String(bezug.getMinutes()).padStart(2, '0')}`,
    open: false,
    now: true,
  };
}

// Zwei Termine sind gleich, wenn beide „Jetzt" sind — oder Datum, Offenheit und Uhrzeit stimmen.
export function gleicherTermin(a, b) {
  if (!a || !b) return false;
  if (hatJetztMarke(a) || hatJetztMarke(b)) return hatJetztMarke(a) && hatJetztMarke(b);
  return a.date === b.date && zeitIstOffen(a) === zeitIstOffen(b) && (zeitIstOffen(a) || a.time === b.time);
}
