// Seed: Meets & Loops (Quelle: reference/current 05.x / 07.x, v14).
// Daten relativ zu heute, damit Kalender und Kommend/Verlauf echt funktionieren.
// Orte sind echte Orte: Länge und Breite aus OpenStreetMap (nachgesehen am 13.09.2026 über Photon
// und Overpass). Die Meet-Karte zeigt damit die Fälle der Referenz: Einzelkacheln, Links/Rechts-
// Paar, echter Stack (05.5). x/y sind Anteile der früheren gezeichneten Karte und ungenutzt.
import { ME, PEOPLE, CREWS, MEETS } from '../ids.js';
import { dayOffset } from '../../core/dates.js';
import { t } from '../../core/sprache.js';

// Nächster Wochentag (0=So..6=Sa) ab heute+1.
function nextWeekday(weekday) {
  for (let offset = 1; offset <= 7; offset += 1) {
    const iso = dayOffset(offset);
    if (new Date(iso).getDay() === weekday) return iso;
  }
  return dayOffset(7);
}

// Seebühne: EIN Ort mit drei Meets → echter Stack mit +2 (reference 05.5/05.5b).
// Runde 3: Der Punkt lag auf dem Vorplatz des Festspielhauses; jetzt auf der Seebühne (OSM theatre).
const SEEBUEHNE_PLACE = { name: 'Seebühne', address: 'Platz der Wiener Symphoniker 1, Bregenz', lat: 47.5054, lon: 9.73805, x: 0.6, y: 0.88 };
// Cineplexx: EIN Ort mit ZWEI Meets → Links/Rechts-Paar, kein Stack (COMPONENT_RULES 6).
// Beide Meets teilen bewusst dieselben Koordinaten, damit der Kollisionsfall „exakt
// gleicher Ort" geprüft werden kann und nicht nur der Fall „nahe beieinander"
// (Boulderhalle K1 / Trattoria Momento weiter unten).
// x war 0.72; bei ZWEI Meets am selben Punkt liegt die rechte Kachel dort ausserhalb des
// Bildes (die Karte begrenzt ein Links/Rechts-Paar am Rand noch nicht). 0.56 zeigt das
// Paar vollstaendig — der Randfall ist als Meldung an die Karte weitergegeben.
// x bewusst nah am rechten Rand: so wird der Links/Rechts-Fall aus COMPONENT_RULES 6
// im Standardzustand wirklich geprüft (die Kachelbreite wird per clamp begrenzt).
// Runde 3: Der Punkt lag auf einer Trafostation (Weiherstraße 1); jetzt auf Weiherstraße 8.
const CINEPLEXX_PLACE = { name: 'Cineplexx Bregenz', address: 'Weiherstraße 8, Bregenz', lat: 47.50257, lon: 9.74346, x: 0.72, y: 0.58 };

export const seedMeets = [
  {
    id: MEETS.STRANDBAD,
    title: t('Strandbad + Pizza'),
    icon: '🌊', iconKey: 'waves',
    category: 'chillen',
    date: dayOffset(0),
    time: '19:00',
    // Runde 3: Der Punkt lag 350 m westlich des Bades an der Bahnlinie; jetzt im Strandbad am Strandweg.
    place: { name: 'Strandbad Bregenz', address: 'Strandweg 1, Bregenz', lat: 47.5054, lon: 9.7342, x: 0.32, y: 0.3 },
    crewId: CREWS.SEE_CHILL,
    creatorId: PEOPLE.MIRA,
    status: 'active',
    participation: { [ME]: 'yes', [PEOPLE.AYLA]: 'yes', [PEOPLE.MIRA]: 'yes', [PEOPLE.SAM]: 'yes' },
    variants: [],
    bring: [
      { id: 'b-1', label: t('Frisbee'), takenBy: [PEOPLE.MIRA] },
      { id: 'b-2', label: t('Kühlbox'), takenBy: [] },
    ],
    polls: [],
  },
  {
    id: MEETS.KINO,
    title: t('Kino: Dune Part 3'),
    icon: '🎬', iconKey: 'film',
    category: 'ausgehen',
    date: nextWeekday(4),
    time: '20:15',
    place: { ...CINEPLEXX_PLACE },
    personIds: [PEOPLE.LENA, PEOPLE.AYLA],
    creatorId: PEOPLE.LENA,
    status: 'open',
    // reference 05.1: „Nicht dabei" — rotes X aktiv, Karte bleibt voll lesbar.
    participation: { [PEOPLE.LENA]: 'yes', [PEOPLE.AYLA]: 'yes', [ME]: 'no' },
    variants: [],
    bring: [],
    polls: [],
  },
  {
    id: MEETS.WANDERN,
    title: t('Wandern Pfänder'),
    icon: '⛰️', iconKey: 'boots',
    category: 'sport',
    date: nextWeekday(6),
    time: '15:00',
    place: { name: 'Pfänderbahn Talstation', address: 'Steinbruchgasse 4, Bregenz', lat: 47.50494, lon: 9.75306, x: 0.74, y: 0.12 },
    crewId: CREWS.FREITAG,
    creatorId: ME,
    status: 'decided',
    participation: { [ME]: 'yes', [PEOPLE.TOBI]: 'yes', [PEOPLE.SAM]: 'yes', [PEOPLE.LENA]: 'open', [PEOPLE.MIRA]: 'no' },
    variants: [],
    bring: [{ id: 'b-3', label: t('Jause'), takenBy: [PEOPLE.TOBI] }],
    polls: [],
  },
  {
    id: MEETS.KOCHABEND,
    title: t('Kochabend'),
    icon: '🍝', iconKey: 'fork',
    category: 'essen',
    date: dayOffset(5),
    time: '18:30',
    // „Bei Lena" = private Adresse — bewusst ohne Karten-Koordinaten (kein Pin auf 05.5).
    place: { name: t('Bei {name}', { name: 'Lena' }), address: '' },
    crewId: CREWS.FREITAG,
    creatorId: PEOPLE.LENA,
    status: 'open',
    participation: { [PEOPLE.LENA]: 'yes', [ME]: 'open', [PEOPLE.NOAH]: 'open' },
    variants: [
      { id: 'v-1', kind: 'time', authorId: PEOPLE.NOAH, date: dayOffset(6), time: '19:00', votes: [PEOPLE.NOAH] },
      // Aktivitätsvarianten (reference 05.6d): zusammengeführte Vorschläge („2ד) + Einzelvorschlag.
      { id: 'v-2', kind: 'activity', authorId: PEOPLE.MIRA, title: t('Bouldern + Pizza'), icon: '🧗', iconKey: 'mountain', category: 'sport', votes: [PEOPLE.MIRA, PEOPLE.NOAH] },
      { id: 'v-3', kind: 'activity', authorId: PEOPLE.LENA, title: t('Kino: Dune Part 3'), icon: '🎬', iconKey: 'film', category: 'ausgehen', votes: [PEOPLE.LENA] },
    ],
    bring: [],
    polls: [
      {
        id: 'poll-1',
        question: t('Was kochen wir?'),
        options: [
          { id: 'po-1', label: t('Pasta'), votes: [PEOPLE.LENA] },
          { id: 'po-2', label: t('Curry'), votes: [PEOPLE.NOAH] },
        ],
      },
    ],
  },
  {
    id: MEETS.GRILLEN,
    title: t('Grillen am See'),
    icon: '🔥', iconKey: 'grill',
    category: 'essen',
    date: dayOffset(-1),
    time: '18:00',
    endTime: '22:30',
    // Runde 3 (Jonathan: „Grillen am See — da ist die Position extremst schlecht gewählt"): Gegrillt
    // wird nicht im Strandbad, sondern an den öffentlichen Grillstellen am Mehrerauer Seeufer
    // (OpenStreetMap: amenity=bbq, 47.5056/9.7004 und 47.5058/9.7016).
    place: { name: 'Grillplatz Mehrerauer Seeufer', address: 'Mehrerauer Seeufer, Bregenz', lat: 47.50565, lon: 9.701, x: 0.32, y: 0.3, distanceKm: 3.5 },
    crewId: CREWS.FREITAG,
    creatorId: PEOPLE.TOBI,
    status: 'done',
    loopCount: 4,
    participation: {
      [ME]: 'yes', [PEOPLE.TOBI]: 'yes', [PEOPLE.MIRA]: 'yes',
      [PEOPLE.SAM]: 'yes', [PEOPLE.LENA]: 'yes', [PEOPLE.NOAH]: 'yes',
      [PEOPLE.AYLA]: 'no',
    },
    variants: [],
    bring: [
      { id: 'b-g1', label: t('Kohle'), takenBy: [PEOPLE.TOBI] },
      { id: 'b-g2', label: t('Cola'), takenBy: [PEOPLE.MIRA] },
      { id: 'b-g3', label: t('Frisbee'), takenBy: [ME] },
    ],
    polls: [],
  },
  // --- Seebühne-Stack: drei Meets am selben Ort (reference 05.5/05.5b) ---
  {
    id: MEETS.SEEBUEHNE,
    title: t('Seebühne: Carmen'),
    icon: 'film', iconKey: 'ticket',
    category: 'event',
    date: nextWeekday(6),
    time: '17:00',
    place: { ...SEEBUEHNE_PLACE },
    personIds: [PEOPLE.AYLA, PEOPLE.LENA],
    creatorId: PEOPLE.AYLA,
    status: 'open',
    participation: { [PEOPLE.AYLA]: 'yes', [PEOPLE.LENA]: 'yes', [ME]: 'open' },
    variants: [],
    bring: [],
    polls: [],
  },
  {
    id: MEETS.FEUERWERK,
    title: t('Feuerwerk am See'),
    icon: 'sun', iconKey: 'sun',
    category: 'event',
    date: nextWeekday(6),
    time: '22:00',
    place: { ...SEEBUEHNE_PLACE },
    personIds: [PEOPLE.MIRA, PEOPLE.TOBI, PEOPLE.SAM, PEOPLE.LENA],
    creatorId: PEOPLE.MIRA,
    status: 'open',
    participation: { [PEOPLE.MIRA]: 'yes', [PEOPLE.TOBI]: 'yes', [ME]: 'open' },
    variants: [],
    bring: [],
    polls: [],
  },
  {
    id: 'm-jazz',
    title: t('Jazz am See'),
    icon: 'note', iconKey: 'note',
    category: 'event',
    date: nextWeekday(0),
    time: '19:30',
    place: { ...SEEBUEHNE_PLACE },
    personIds: [PEOPLE.SAM, PEOPLE.NOAH],
    creatorId: PEOPLE.SAM,
    status: 'open',
    participation: { [PEOPLE.SAM]: 'yes', [ME]: 'open' },
    variants: [],
    bring: [],
    polls: [],
  },
  // --- Links/Rechts-Paar am EXAKT gleichen Ort: zweites Meet im Cineplexx (COMPONENT_RULES 6) ---
  {
    id: 'm-kurzfilm',
    title: t('Kurzfilmnacht'),
    icon: '🎬', iconKey: 'film',
    category: 'ausgehen',
    date: nextWeekday(5),
    time: '21:00',
    place: { ...CINEPLEXX_PLACE },
    personIds: [PEOPLE.AYLA, PEOPLE.KIRA],
    creatorId: PEOPLE.KIRA,
    status: 'open',
    participation: { [PEOPLE.KIRA]: 'yes', [PEOPLE.AYLA]: 'open', [ME]: 'open' },
    variants: [],
    bring: [],
    polls: [],
  },
  // --- Links/Rechts-Paar: zwei nahe Orte, kein +1-Stack (reference 05.5) ---
  {
    id: MEETS.BOULDERN,
    title: t('Boulder-Dienstag'),
    icon: '🧗', iconKey: 'mountain',
    category: 'sport',
    date: nextWeekday(2),
    time: '18:00',
    place: { name: 'Boulderhalle K1', address: 'Färbergasse 1, Dornbirn', lat: 47.41881, lon: 9.74051, x: 0.475, y: 0.74 },
    crewId: CREWS.FREITAG,
    creatorId: PEOPLE.SAM,
    status: 'open',
    participation: { [PEOPLE.SAM]: 'yes' },
    variants: [],
    bring: [],
    polls: [],
    loop: { repeat: 'weekly', weekday: 2, time: '18:00', active: true, responses: {} },
  },
  {
    id: 'm-pasta',
    // v6 A18b: Sam hat vorgeschlagen, das Meet bei mir zu machen. Solange ich nicht
    // zugestimmt habe, steht hier bewusst keine Adresse — sie erscheint erst danach.
    placePending: true,
    title: t('Pasta danach'),
    icon: '🍝', iconKey: 'fork',
    category: 'essen',
    date: nextWeekday(2),
    time: '20:30',
    place: { name: 'Trattoria Momento', address: 'Kirchstraße 4, Bregenz', lat: 47.50193, lon: 9.74684, x: 0.5, y: 0.74 },
    personIds: [PEOPLE.SAM, PEOPLE.MIRA],
    creatorId: PEOPLE.SAM,
    status: 'open',
    participation: { [PEOPLE.SAM]: 'yes', [PEOPLE.MIRA]: 'yes', [ME]: 'open' },
    variants: [],
    bring: [],
    polls: [],
  },
  // --- Zweiter Loop (reference 05.2: „Spikeball · 11:00 · Reutepark · Loop") ---
  {
    id: 'm-spikeball',
    title: t('Spikeball'),
    icon: '🏐', iconKey: 'ball',
    category: 'sport',
    date: nextWeekday(6),
    time: '11:00',
    place: { name: 'Reutepark', address: '', lat: 47.50253, lon: 9.72326, x: 0.14, y: 0.46 },
    personIds: [PEOPLE.NOAH],
    creatorId: PEOPLE.NOAH,
    status: 'open',
    participation: { [PEOPLE.NOAH]: 'yes' },
    variants: [],
    bring: [],
    polls: [],
    loop: { repeat: 'weekly', weekday: 6, time: '11:00', active: true, responses: {} },
  },
  // --- v3.2 B6: weitere abgeschlossene Meets für einen echten Verlauf ---
  {
    id: MEETS.KLETTERN_ALT,
    title: t('Klettern Rheintal'), icon: '🧗', iconKey: 'mountain', category: 'sport',
    date: dayOffset(-6), time: '17:00', endTime: '20:00',
    place: { name: 'Boulderhalle K1', address: 'Färbergasse 1, Dornbirn', lat: 47.41881, lon: 9.74051, x: 0.475, y: 0.74 },
    crewId: CREWS.SPORT, creatorId: PEOPLE.SAM, status: 'done',
    participation: { [ME]: 'yes', [PEOPLE.SAM]: 'yes', [PEOPLE.JONAS]: 'yes', [PEOPLE.KIRA]: 'no' },
    variants: [], bring: [], polls: [],
  },
  {
    id: MEETS.BRUNCH_ALT,
    title: t('Brunch bei Kira'), icon: '🍝', iconKey: 'fork', category: 'essen',
    date: dayOffset(-11), time: '10:30', endTime: '13:00',
    place: { name: t('Bei {name}', { name: 'Kira' }), address: '' },
    personIds: [PEOPLE.KIRA, PEOPLE.ELIF], creatorId: PEOPLE.KIRA, status: 'done',
    participation: { [ME]: 'yes', [PEOPLE.KIRA]: 'yes', [PEOPLE.ELIF]: 'yes' },
    variants: [], bring: [], polls: [],
  },
  {
    id: MEETS.SPIELEABEND_ALT,
    title: t('Spieleabend bei Noah'), icon: '🎲', iconKey: 'dice', category: 'chillen',
    date: dayOffset(-8), time: '19:30', endTime: '23:00',
    place: { name: t('Bei {name}', { name: 'Noah' }), address: '' },
    crewId: CREWS.FREITAG, creatorId: PEOPLE.NOAH, status: 'done',
    participation: {
      [ME]: 'yes', [PEOPLE.NOAH]: 'yes', [PEOPLE.MIRA]: 'yes',
      [PEOPLE.TOBI]: 'yes', [PEOPLE.LENA]: 'no', [PEOPLE.AYLA]: 'open',
    },
    variants: [], bring: [], polls: [],
  },
  {
    id: MEETS.KONZERT_ALT,
    title: t('Konzert Kammgarn'), icon: 'note', iconKey: 'note', category: 'event',
    date: dayOffset(-19), time: '20:00', endTime: '23:30',
    // Runde 3: Die Kulturwerkstatt Kammgarn steht in der Spinnereistraße 10 (die Färbergasse 15 ist in Dornbirn).
    place: { name: 'Kammgarn', address: 'Spinnereistraße 10, Hard', lat: 47.49791, lon: 9.69294, x: 0.2, y: 0.62 },
    personIds: [PEOPLE.KIRA, PEOPLE.BEN], creatorId: PEOPLE.KIRA, status: 'done',
    participation: { [ME]: 'yes', [PEOPLE.KIRA]: 'yes', [PEOPLE.BEN]: 'yes' },
    variants: [], bring: [], polls: [],
  },
];
