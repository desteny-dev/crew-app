// Seed: Entdecken-Vorschläge, Orte und Gespeichertes (Quelle: reference/current 08.x, v14).
// Struktur/IDs stabil; Inhalte referenzgetreu (08.2 Liste, 08.2b Eigene Ideen, 08.3 Details,
// 08.4 Karte, 08.7/08.8/08.8b Gespeichert).
//   kind: 'ort' | 'event' | 'idee' (Tag links auf der Vorschlagskarte; 'idee' erscheint
//         zusätzlich unter „Eigene Idee" → „Deine Ideen")
//   home: true  = findet WIRKLICH zuhause statt (v5 A27b). Vorher war „Daheim" rein
//         negativ als „hat kein place-Objekt" definiert — dadurch landeten Spikeball im
//         Park und Grillen am Damm dort. Ortlos heißt nicht zuhause.
//   price: € pro Person (0 = gratis, null = unbekannt) · open/when/extra: Meta-Zeile
//   gradient: Hero-/Kartenkachel-Fläche · links: nur echte Ziele (08.3/08.3b)
import { PEOPLE } from '../ids.js';
import { t } from '../../core/sprache.js';

export const seedSuggestions = [
  {
    id: 's-strandbad', title: t('Strandbad Bregenz'), shortTitle: t('Strandbad'), icon: '🌊', iconKey: 'waves',
    // Runde 3: Jahreszeit (siehe saisonPasst in web/engine/suggestion-engine.js).
    saison: 'sommer',
    // Runde 2: echte Fotos genau dieser Orte (Wikimedia Commons, freie Lizenzen; Urheber und
    // Lizenz stehen auf der Seite der Datei und im Bild-Hinweis).
    bild: 'https://commons.wikimedia.org/wiki/Special:FilePath/Bregenz_Seebad_Strandbad_Schr%C3%A4gluftbild_NNO.jpg?width=640',
    bildSeite: 'https://commons.wikimedia.org/wiki/File:Bregenz_Seebad_Strandbad_Schr%C3%A4gluftbild_NNO.jpg',
    bildUrheber: 'Herbert Heim · CC BY-SA 4.0',
    kind: 'ort', category: 'chillen',
    place: { name: 'Strandbad Bregenz', address: 'Strandweg 1, Bregenz', lat: 47.5054, lon: 9.7342, x: 0.32, y: 0.28 },
    distanceKm: 2, priceLevel: 'gratis', price: 0,
    reason: t('Nah & draußen'),
    blurb: t('See, Wiese und Pizza direkt daneben'),
    description: t('Wiese am See mit Sprungturm und Kiosk — Eintritt frei.'),
    gradient: 'linear-gradient(155deg,#C7DCE2 0%,#8FB4BE 60%,#75A0AC 100%)',
    // Runde 3 (G3, Jonathan: „Website und Social führen nirgends hin"): Nur Ziele, die es
    // wirklich gibt — am 13.09.2026 abgerufen. Ohne bestätigte Seite kein Knopf.
    links: { website: null, social: [], maps: ['apple', 'google'] },
  },
  {
    id: 's-cineplexx', title: t('Open-Air Kino'), shortTitle: t('Open-Air Kino'), icon: '🎬', iconKey: 'film',
    saison: 'sommer',
    // Runde 3 (H1, Jonathan: „Open-Air-Kino zeigt nur den Bodensee"): ein echtes Open-Air-Kino —
    // Leinwand, Stuhlreihen, Publikum (Luxemburg, Juli 2025; Commons, CC0). Angesehen.
    bild: 'https://commons.wikimedia.org/wiki/Special:FilePath/Luxembourg_City_Open_Air_Cinema%2C_July_2025%2C_Knuedler.jpg?width=640',
    bildSeite: 'https://commons.wikimedia.org/wiki/File:Luxembourg_City_Open_Air_Cinema,_July_2025,_Knuedler.jpg',
    bildUrheber: 'Bdx · CC0',
    // Runde 2: selten = gibt es nicht jede Woche; besonders nur, wenn es zu jemandem passt.
    selten: true,
    kind: 'event', category: 'ausgehen',
    place: { name: 'Open-Air Kino Seepromenade', address: 'Seepromenade 2, Bregenz', lat: 47.50374, lon: 9.74039, x: 0.55, y: 0.52 },
    distanceKm: 4, priceLevel: 'günstig', price: 9, when: t('Samstag'),
    reason: t('Euer Kino-Klassiker'),
    blurb: t('Kino unter freiem Himmel direkt am See'),
    description: t('Kino unter freiem Himmel direkt am See — Decken mitbringen.'),
    gradient: 'linear-gradient(160deg,#3A3630,#1E1B17)',
    links: { website: null, social: [], maps: ['apple', 'google'] },
  },
  {
    id: 's-spikeball', title: t('Spikeball im Park'), shortTitle: t('Spikeball'), icon: '🏐', iconKey: 'ball',
    saison: 'warm',
    kind: 'idee', category: 'sport',
    place: null,
    distanceKm: null, priceLevel: 'gratis', price: 0, extra: t('ab 4 Personen'),
    reason: t('Schnell startklar'),
    blurb: t('Park, weicher Rasen, ab 4 Personen'),
    description: t('Schnelle Runde im Park — Ball und Netz mitbringen.'),
    gradient: 'linear-gradient(160deg,#BFD8C2,#8FB99A)',
    links: { website: null, social: [], maps: [] },
  },
  {
    id: 's-k1', title: t('Boulderhalle K1'), shortTitle: t('Boulderhalle K1'), icon: '🧗', iconKey: 'mountain',
    kind: 'ort', category: 'sport',
    place: { name: 'Kletterhalle K1', address: 'Färbergasse 1, Dornbirn', lat: 47.41881, lon: 9.74051, x: 0.62, y: 0.78 },
    distanceKm: 6, priceLevel: 'mittel', price: 12,
    reason: t('Oft gemacht'),
    blurb: t('Abends meist frei, Anfänger willkommen'),
    description: t('Abends meist frei, Anfänger willkommen — Schuhe gibt es vor Ort.'),
    gradient: 'linear-gradient(160deg,#E0CDB1,#C9A87A)',
    links: { website: null, social: [], maps: ['apple', 'google'] },
  },
  {
    id: 's-weinfest', title: t('Weinfest Lochau'), shortTitle: t('Weinfest'), icon: '🍷', iconKey: 'drink',
    // Runde 4 (Jonathan, G3: Weinfest Lochau muss ein Bild von dort sein): Gesucht (Commons,
    // 13.09.2026) — es gibt kein Foto des Weinfests. Die Landschaftsaufnahme war falsch; ohne echtes
    // Foto steht die ruhige Farbfläche.
    selten: true,
    kind: 'event', category: 'event',
    place: { name: 'Dorfplatz Lochau', address: 'Landstraße 1, Lochau', lat: 47.53111, lon: 9.7525, x: 0.74, y: 0.2 },
    distanceKm: 8, priceLevel: 'günstig', price: null, when: t('Samstag'),
    reason: t('Neu für euch'),
    blurb: t('Stände am Dorfplatz und Livemusik'),
    description: t('Stände am Dorfplatz und Livemusik — Eintritt frei, Gläser gegen Pfand.'),
    gradient: 'linear-gradient(160deg,#D9C1CE,#B98AA5)',
    links: { website: null, social: [], maps: ['apple', 'google'] },
  },
  {
    id: 's-pfaender', title: t('Wandern am Pfänder'), shortTitle: t('Pfänder'), icon: '⛰️', iconKey: 'boots',
    bild: 'https://commons.wikimedia.org/wiki/Special:FilePath/Lago_Constanza_desde_el_monte_Pf%C3%A4nder%2C_Bregenz%2C_Austria%2C_2022-10-23%2C_DD_07.jpg?width=640',
    bildSeite: 'https://commons.wikimedia.org/wiki/File:Lago_Constanza_desde_el_monte_Pf%C3%A4nder,_Bregenz,_Austria,_2022-10-23,_DD_07.jpg',
    bildUrheber: 'Diego Delso · CC BY-SA 4.0',
    kind: 'ort', category: 'sport',
    place: { name: 'Pfänderbahn Talstation', address: 'Steinbruchgasse 4, Bregenz', lat: 47.50494, lon: 9.75306, x: 0.74, y: 0.2 },
    distanceKm: 2.8, priceLevel: 'gratis', price: 0,
    reason: t('Panorama oben'),
    blurb: t('Bahn oder zu Fuß, oben Panorama'),
    description: t('Bahn oder zu Fuß, oben Panorama über den ganzen See.'),
    gradient: 'linear-gradient(160deg,#C9D6C2,#93A98B)',
    links: { website: 'https://www.pfaenderbahn.at/', social: [], maps: ['apple', 'google'] },
  },
  {
    id: 's-spieleabend', title: t('Spieleabend'), shortTitle: t('Spieleabend'), icon: '🎲', iconKey: 'dice',
    // Runde 3 (H1): Stimmungsbild für daheim (Commons). Angesehen.
    bild: 'https://commons.wikimedia.org/wiki/Special:FilePath/Carcassonne_Miples.jpg?width=640',
    bildSeite: 'https://commons.wikimedia.org/wiki/File:Carcassonne_Miples.jpg',
    bildUrheber: 'Júlio Reis · CC BY-SA 2.5',
    kind: 'idee', category: 'chillen',
    place: null, home: true,
    distanceKm: null, priceLevel: 'gratis', price: 0, extra: t('ab 4 Personen am besten'),
    reason: t('Gemütlich daheim'),
    blurb: t('Zuhause, ab 4 Personen am besten'),
    description: t('Zuhause, ab 4 Personen am besten — ein paar Spiele reichen.'),
    gradient: 'linear-gradient(160deg,#D9CDC1,#B9A48A)',
    links: { website: null, social: [], maps: [] },
  },
  {
    id: 's-seebuehne', title: t('Festspiele Seebühne'), shortTitle: t('Seebühne'), icon: '🎭', iconKey: 'ticket',
    bild: 'https://commons.wikimedia.org/wiki/Special:FilePath/Carmen_Festspiele_Bregenz_2017_by_Olaf_Kosinsky-17.jpg?width=640',
    bildSeite: 'https://commons.wikimedia.org/wiki/File:Carmen_Festspiele_Bregenz_2017_by_Olaf_Kosinsky-17.jpg',
    bildUrheber: 'Olaf Kosinsky · CC BY-SA 3.0 DE',
    // Runde 2: besonders = bemerkenswert für alle (die Festspiele gibt es nur im Sommer).
    besonders: true,
    kind: 'event', category: 'event',
    place: { name: 'Seebühne Bregenz', address: 'Platz der Wiener Symphoniker 1', lat: 47.50469, lon: 9.73724, x: 0.26, y: 0.34 },
    distanceKm: 1.6, priceLevel: 'teuer', price: 38, when: t('Freitag'),
    reason: t('Früh buchen'),
    blurb: t('Früh buchen, nur bei gutem Wetter'),
    description: t('Oper unter freiem Himmel — früh buchen, nur bei gutem Wetter.'),
    gradient: 'linear-gradient(160deg,#C6CBE0,#8E96BE)',
    links: { website: 'https://bregenzerfestspiele.com/', social: [{ provider: 'instagram', url: 'https://www.instagram.com/bregenzerfestspiele/' }], maps: ['apple', 'google'] },
  },
  // Eigene Ideen (08.2b „Deine Ideen" — bleiben gespeichert, tauchen auch im Entdecken auf)
  {
    id: 's-kartenabend', title: t('Kartenabend'), shortTitle: t('Kartenabend'), icon: '🎲', iconKey: 'cards',
    // Runde 3 (H1): Stimmungsbild für daheim (Commons). Angesehen.
    bild: 'https://commons.wikimedia.org/wiki/Special:FilePath/Hand_holding_playing_cards-4530227761.jpg?width=640',
    bildSeite: 'https://commons.wikimedia.org/wiki/File:Hand_holding_playing_cards-4530227761.jpg',
    bildUrheber: 'Jiahui Huang · CC BY-SA 2.0',
    kind: 'idee', category: 'chillen',
    place: null, home: true,
    distanceKm: null, priceLevel: 'gratis', price: 0, extra: t('ab 3 Personen'),
    reason: '',
    blurb: t('Karten und Snacks, ab 3 Personen'),
    description: t('Karten und Snacks — ab 3 Personen.'),
    gradient: 'linear-gradient(160deg,#D9CDC1,#B9A48A)',
    links: { website: null, social: [], maps: [] },
  },
  {
    id: 's-grillen-damm', title: t('Grillen im Grünen'), shortTitle: t('Grillen'), icon: '🔥', iconKey: 'grill',
    saison: 'warm',
    kind: 'idee', category: 'essen',
    place: null,
    distanceKm: null, priceLevel: 'gratis', price: null, extra: t('Grill und Kohle mitnehmen'),
    reason: '',
    blurb: t('Wiese oder Grillplatz, Grill und Kohle mitnehmen'),
    description: t('Auf einer Wiese oder am Grillplatz — Grill und Kohle mitnehmen.'),
    gradient: 'linear-gradient(160deg,#E0CDB1,#C9A87A)',
    links: { website: null, social: [], maps: [] },
  },
  // v5 A27b: echte Zuhause-Aktivitäten — damit „Daheim" auch etwas anzeigt, das wirklich
  // zuhause stattfindet, statt nur alles Ortlose einzusammeln.
  {
    id: 's-filmabend', title: t('Filmabend'), shortTitle: t('Filmabend'), icon: '🍿', iconKey: 'film',
    // Runde 3 (H1, Jonathan: „Filmabend ohne Bild"): Ideen für daheim zeigen ein Stimmungsbild,
    // keinen Ort (Commons, CC0). Angesehen.
    bild: 'https://commons.wikimedia.org/wiki/Special:FilePath/Bowl_of_Popcorn_%28Unsplash%29.jpg?width=640',
    bildSeite: 'https://commons.wikimedia.org/wiki/File:Bowl_of_Popcorn_(Unsplash).jpg',
    bildUrheber: 'Alex Munsell · CC0',
    kind: 'idee', category: 'chillen',
    place: null, home: true,
    distanceKm: null, priceLevel: 'gratis', price: 0, extra: t('Beamer oder Fernseher'),
    reason: t('Gemütlich daheim'),
    blurb: t('Beamer, Decken, zwei Filme zur Wahl'),
    description: t('Beamer oder Fernseher, Decken — zwei Filme zur Wahl.'),
    gradient: 'linear-gradient(160deg,#CFC6D9,#9A8FB4)',
    links: { website: null, social: [], maps: [] },
  },
  {
    id: 's-kochen', title: t('Gemeinsam kochen'), shortTitle: t('Kochen'), icon: '🍝', iconKey: 'fork',
    kind: 'idee', category: 'essen',
    place: null, home: true,
    distanceKm: null, priceLevel: 'günstig', price: 8, extra: t('zusammen kochen'),
    reason: t('Gemütlich daheim'),
    blurb: t('Pasta für alle, zusammen in einer Küche'),
    description: t('Pasta für alle — wer die größte Küche hat, lädt ein.'),
    gradient: 'linear-gradient(160deg,#E4D3B8,#C8A97E)',
    links: { website: null, social: [], maps: [] },
  },
  {
    id: 's-schwimmen', title: t('Schwimmen im See'), shortTitle: t('Schwimmen'), icon: '🏊', iconKey: 'swim',
    saison: 'sommer',
    kind: 'idee', category: 'sport',
    place: null,
    distanceKm: null, priceLevel: 'gratis', price: 0, extra: t('kurze Runde'),
    reason: '',
    blurb: t('Kurze Runde im See, danach Kaffee'),
    description: t('Kurze Runde im See — danach gemeinsam Kaffee.'),
    gradient: 'linear-gradient(155deg,#C7DCE2 0%,#8FB4BE 60%,#75A0AC 100%)',
    links: { website: null, social: [], maps: [] },
  },
];

// Gespeichert (08.7/08.8, v3.1 §8): Ordner sind Sichten derselben Menge. Oben stehen
// kompakte Ordnerfilter, darunter EINE Liste der gewählten Sicht — „Weitere" enthält
// ausschließlich Einträge ohne folderId, niemals Kopien aus einem Ordner.
export const seedFolders = [
  { id: 'f-sommer', name: t('Sommer') },
  { id: 'f-sport', name: t('Sport') },
];

export const seedSavedIdeas = [
  {
    id: 'idea-1', folderId: null,
    title: t('Pfänder-Runde'), icon: '⛰️', iconKey: 'boots', activity: 'Sport',
    personsHint: 'Freitag-Crew', listHint: '',
    note: t('Bahn fährt erst ab 8, also zu Fuß hoch'), createdAt: 1,
  },
  {
    id: 'idea-2', folderId: null,
    title: t('Pizza bei Mira'), icon: '🍕', iconKey: 'pizza', activity: 'Essen',
    personsHint: 'Freitag-Crew', listHint: '',
    note: '', createdAt: 2,
  },
  {
    id: 'idea-3', folderId: 'f-sommer',
    title: t('Grillen am See'), icon: '🔥', iconKey: 'grill', activity: 'Essen',
    personsHint: 'Ayla, Tobi', listHint: t('1 auf der Liste'),
    place: { name: t('Strandbad Bregenz'), address: 'Strandweg 1, Bregenz', lat: 47.5054, lon: 9.7342, x: 0.32, y: 0.28 },
    note: t('Kohle nicht vergessen'), createdAt: 3,
  },
  {
    id: 'idea-4', folderId: 'f-sommer',
    title: t('Pizza am Hafen'), icon: '🍕', iconKey: 'pizza', activity: 'Essen',
    personsHint: 'Freitag-Crew · 7', listHint: '',
    note: '', createdAt: 4,
  },
  {
    id: 'idea-5', folderId: 'f-sommer',
    title: t('Spikeball im Park'), icon: '🏐', iconKey: 'ball', activity: 'Sport',
    personsHint: 'Noah, Tobi', listHint: '',
    note: '', createdAt: 5,
  },
  {
    id: 'idea-6', folderId: 'f-sommer',
    title: t('Sonnenaufgang Pfänder'), icon: '⛰️', iconKey: 'sun', activity: 'Sport',
    personsHint: 'Mira, Sam', listHint: '',
    note: '', createdAt: 6,
  },
  {
    id: 'idea-7', folderId: 'f-sport',
    title: t('Boulderhalle K1'), icon: '🧗', iconKey: 'mountain', activity: 'Sport',
    personsHint: 'Sam, Tobi', listHint: '',
    place: { name: t('Kletterhalle K1'), address: 'Färbergasse 1, Dornbirn', lat: 47.41881, lon: 9.74051, x: 0.62, y: 0.78 },
    note: '', createdAt: 7,
  },
  {
    id: 'idea-8', folderId: 'f-sport',
    title: t('Laufrunde am See'), icon: '🏐', iconKey: 'boots', activity: 'Sport',
    personsHint: 'Ayla', listHint: '',
    note: '', createdAt: 8,
  },
  {
    id: 'idea-9', folderId: 'f-sport',
    title: t('Spikeball-Turnier'), icon: '🏐', iconKey: 'ball', activity: 'Sport',
    personsHint: 'See & Chill', listHint: '',
    note: '', createdAt: 9,
  },
];

// Koordinaten aus OpenStreetMap (Photon, 12.09.2026) — ohne sie ließe sich ein Zuhause
// auf der echten Karte nicht zeigen, und die Crew-Karte müsste Punkte erfinden (§5.1).
export const seedPersonPlaces = {
  [PEOPLE.MIRA]: { name: t('Bei {name}', { name: 'Mira' }), address: 'Kirchstraße 12, Bregenz', approved: false, lat: 47.50385, lon: 9.74744 },
  [PEOPLE.LENA]: { name: t('Bei {name}', { name: 'Lena' }), address: 'Schillerstraße 3, Bregenz', approved: false, lat: 47.50098, lon: 9.74110 },
  [PEOPLE.TOBI]: { name: t('Bei {name}', { name: 'Tobi' }), address: 'Marktstraße 4, Dornbirn', approved: false, lat: 47.41273, lon: 9.74285 },
};

// Runde 4 (D7): Geteilte Standorte der Demo — ungefähr, auf 3 Nachkommastellen gerundet wie im Gerät
// (≈ 100 m) und bewusst NICHT die Wohnadressen oben. Nur wer `sharesLocation` hat, bekommt einen.
export const seedStandorte = {
  [PEOPLE.MIRA]: { lat: 47.506, lon: 9.734 }, // am Strandbad Bregenz (aktives Meet)
  [PEOPLE.SAM]: { lat: 47.503, lon: 9.747 }, // Bregenz, Kornmarkt
  [PEOPLE.TOBI]: { lat: 47.414, lon: 9.742 }, // Dornbirn, Marktplatz
  [PEOPLE.JONAS]: { lat: 47.505, lon: 9.739 }, // Bregenz, Festspielhaus
  [PEOPLE.KIRA]: { lat: 47.417, lon: 9.739 }, // Dornbirn, Bahnhof
};
