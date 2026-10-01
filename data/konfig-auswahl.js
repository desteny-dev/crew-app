// Algorithmus 2 — Persönliche Auswahl: ALLE Zahlen, Muster und Texte an EINER Stelle
// (PLAN §0.5: „Kein Grenzwert steht verstreut im Code"). Quelle: ALGORITHMUS.md §3 und
// ALGORITHMUS_ZUSATZ.md §5/§6 (der Zusatz hat Vorrang).
//
// Diese Datei läuft unverändert in der App (Demo-Gateway) und im Server (Kopie in
// supabase/functions/_shared/, erzeugt von scripts/auswahl-deploy.mjs; `npm run lint` meldet jede
// Abweichung). `score_konfig.werte.auswahl` (Version 1) wird von scripts/konfig-einspielen.mjs aus
// genau diesem Objekt geschrieben. Keine Importe, kein Zustand.
//
// Die 12 Merkmale (0 = links, 1 = rechts), ALGORITHMUS §3.2. Reihenfolge = Index in jedem Muster:
//   0 ruhig↔laut · 1 drinnen↔draußen · 2 günstig↔teuer · 3 spontan↔geplant · 4 sitzend↔körperlich aktiv ·
//   5 vertraut↔neu · 6 kleine Runde↔große Gruppe · 7 Essen↔Tun im Mittelpunkt · 8 ohne↔mit Alkohol ·
//   9 Unterhaltung↔Kultur · 10 entspannt↔Wettkampf/Spiel · 11 konsumieren↔selbst kreativ
//
// Aktivität (ZUSATZ §5.1, PLAN §1.1) = 'art·stil'. In Mustern steht 'art·*' für alle Stile einer Art.

function tief(o) {
  if (o && typeof o === 'object') { Object.values(o).forEach(tief); Object.freeze(o); }
  return o;
}

export const KONFIG_AUSWAHL = tief({
  version: 1,

  merkmale: [
    { schluessel: 'laut', links: 'ruhig', rechts: 'lebhaft' },
    { schluessel: 'draussen', links: 'drinnen', rechts: 'draußen' },
    { schluessel: 'teuer', links: 'günstig', rechts: 'gehoben' },
    { schluessel: 'geplant', links: 'spontan', rechts: 'gut geplant' },
    { schluessel: 'aktiv', links: 'gemütlich', rechts: 'in Bewegung' },
    { schluessel: 'neu', links: 'vertraut', rechts: 'ungewohnt' },
    { schluessel: 'gross', links: 'in kleiner Runde', rechts: 'in großer Runde' },
    { schluessel: 'tun', links: 'mit gutem Essen', rechts: 'zum Mitmachen' },
    { schluessel: 'alkohol', links: 'ohne Alkohol', rechts: 'mit Drinks' },
    { schluessel: 'kultur', links: 'unterhaltsam', rechts: 'kulturell' },
    { schluessel: 'wettkampf', links: 'entspannt', rechts: 'mit Spiel und Wettkampf' },
    { schluessel: 'kreativ', links: 'zum Genießen', rechts: 'kreativ' },
  ],
  // Index des Merkmals „drinnen↔draußen" (Wetter, Jahreszeit) und „Alkohol" (Jugendschutz).
  merkmalDraussen: 1,
  merkmalAlkohol: 8,

  // --- Arten (PLAN §1.1) ----------------------------------------------------------------------
  // anzeige: Anzeigegruppe der Find-Seite (bleibt 'event'|'restaurant'|'erlebnis').
  // warum: ein Satz für „Warum sehe ich das?" ([ich, wir]) — ZUSATZ §6: „Du warst oft klettern".
  arten: {
    restaurant: { label: 'Restaurant', anzeige: 'restaurant', warum: ['Du gehst oft essen', 'Ihr geht oft zusammen essen'] },
    cafe: { label: 'Café', anzeige: 'restaurant', warum: ['Du bist oft im Café', 'Ihr seid oft zusammen im Café'] },
    bar: { label: 'Bar', anzeige: 'erlebnis', warum: ['Du warst oft in Bars', 'Ihr wart oft zusammen in Bars'] },
    club: { label: 'Club', anzeige: 'erlebnis', warum: ['Du warst oft feiern', 'Ihr wart oft zusammen feiern'] },
    kino: { label: 'Kino', anzeige: 'erlebnis', warum: ['Du warst oft im Kino', 'Ihr wart oft zusammen im Kino'] },
    buehne: { label: 'Bühne', anzeige: 'erlebnis', warum: ['Du warst oft im Theater', 'Ihr wart oft zusammen im Theater'] },
    museum: { label: 'Museum', anzeige: 'erlebnis', warum: ['Du warst oft im Museum', 'Ihr wart oft zusammen im Museum'] },
    bad: { label: 'Bad', anzeige: 'erlebnis', warum: ['Du warst oft baden', 'Ihr wart oft zusammen baden'] },
    therme: { label: 'Therme & Sauna', anzeige: 'erlebnis', warum: ['Du warst oft in der Therme', 'Ihr wart oft zusammen in der Therme'] },
    fitness: { label: 'Sport & Training', anzeige: 'erlebnis', warum: ['Du trainierst oft', 'Ihr trainiert oft zusammen'] },
    aktiv_spass: { label: 'Bowling, Minigolf & Co.', anzeige: 'erlebnis', warum: ['Du warst oft bowlen, beim Minigolf & Co.', 'Ihr wart oft zusammen bowlen, beim Minigolf & Co.'] },
    natur: { label: 'Natur & Aussicht', anzeige: 'erlebnis', warum: ['Du bist oft draußen in der Natur', 'Ihr seid oft zusammen draußen in der Natur'] },
    wandern: { label: 'Wandern', anzeige: 'erlebnis', warum: ['Du warst oft wandern', 'Ihr wart oft zusammen wandern'] },
    klettern: { label: 'Klettern', anzeige: 'erlebnis', warum: ['Du warst oft klettern', 'Ihr wart oft zusammen klettern'] },
    rad: { label: 'Rad & Bike', anzeige: 'erlebnis', warum: ['Du warst oft mit dem Rad unterwegs', 'Ihr wart oft zusammen mit dem Rad unterwegs'] },
    wintersport: { label: 'Wintersport', anzeige: 'erlebnis', warum: ['Du warst oft im Schnee', 'Ihr wart oft zusammen im Schnee'] },
    wassersport: { label: 'Wassersport', anzeige: 'erlebnis', warum: ['Du warst oft auf dem Wasser', 'Ihr wart oft zusammen auf dem Wasser'] },
    spiele_hobby: { label: 'Spiele & Hobby', anzeige: 'erlebnis', warum: ['Du spielst oft', 'Ihr spielt oft zusammen'] },
    musik_machen: { label: 'Musik machen', anzeige: 'erlebnis', warum: ['Du machst oft Musik', 'Ihr macht oft zusammen Musik'] },
    konzert: { label: 'Konzert', anzeige: 'event', warum: ['Du warst oft auf Konzerten', 'Ihr wart oft zusammen auf Konzerten'] },
    party: { label: 'Party', anzeige: 'event', warum: ['Du warst oft auf Partys', 'Ihr wart oft zusammen auf Partys'] },
    markt: { label: 'Markt & Fest', anzeige: 'event', warum: ['Du warst oft auf Märkten und Festen', 'Ihr wart oft zusammen auf Märkten und Festen'] },
    kultur: { label: 'Kultur-Abend', anzeige: 'event', warum: ['Du warst oft bei Kultur-Abenden', 'Ihr wart oft zusammen bei Kultur-Abenden'] },
    sport: { label: 'Sport-Event', anzeige: 'event', warum: ['Du warst oft bei Sport-Events', 'Ihr wart oft zusammen bei Sport-Events'] },
    idee: { label: 'Idee für zuhause', anzeige: 'erlebnis', warum: ['Du machst gern etwas zuhause', 'Ihr macht gern zusammen etwas zuhause'] },
  },
  eventArten: ['konzert', 'party', 'markt', 'kultur', 'sport'],
  // Stil-Wörter für „Was Crew gelernt hat" (Paket A führt die Stil-Listen; unbekannte Stile werden
  // lesbar gemacht, nicht erfunden).
  stile: {
    // Die Stile von Paket A (supabase/functions/_shared/konfig-klassifizieren.js › stile). Ein Schlüssel
    // 'art·stil' gilt vor dem Stil allein (Musik machen · Studio ist ein Tonstudio, kein Fitnessstudio).
    // Restaurant: der Stil ist die Küche (konfig-klassifizieren.js › KUECHE).
    sonstige: 'sonstige Küche', regional: 'regionale Küche', italienisch: 'italienisch', asiatisch: 'asiatisch',
    japanisch: 'japanisch', thailaendisch: 'thailändisch', vietnamesisch: 'vietnamesisch', indisch: 'indisch',
    tuerkisch: 'türkisch', orientalisch: 'orientalisch', griechisch: 'griechisch', balkan: 'Balkan-Küche',
    spanisch: 'spanisch', mexikanisch: 'mexikanisch', franzoesisch: 'französisch', burger: 'Burger & Co.',
    grill: 'Grill & Steak', fisch: 'Fisch', vegetarisch: 'vegetarisch', international: 'international',
    cafe: 'Café', baeckerei_cafe: 'Bäckerei-Café', eisdiele: 'Eisdiele', cocktail: 'Cocktail', pub: 'Pub & Beisl', biergarten: 'Biergarten',
    weinbar: 'Weinbar', livemusik: 'Livemusik', multiplex: 'Multiplex', programmkino: 'Programmkino', freiluft: 'Freiluft',
    theater: 'Theater', konzerthaus: 'Konzerthaus', kleinkunst: 'Kleinkunst', galerie: 'Galerie', erlebnismuseum: 'Erlebnismuseum',
    freibad: 'Freibad', hallenbad: 'Hallenbad', erlebnisbad: 'Erlebnisbad', strandbad: 'Strandbad & See', sauna: 'Sauna', spa: 'Spa',
    studio: 'Studio', 'musik_machen·studio': 'Tonstudio', kletterhalle: 'Kletterhalle', sporthalle: 'Sporthalle',
    bowling: 'Bowling', escape: 'Escape Room', minigolf: 'Minigolf', eislaufen: 'Eislaufen', trampolin: 'Trampolin', karaoke: 'Karaoke',
    kart: 'Kart', lasertag: 'Lasertag', golf: 'Golf', freizeitpark: 'Freizeitpark', sommerrodeln: 'Sommerrodeln', hochseilgarten: 'Hochseilgarten',
    aussicht: 'Aussicht', park: 'Park', wasserfall: 'Wasserfall', tierpark: 'Tierpark', hoehle: 'Höhle', strand: 'Strand',
    gipfel: 'Gipfel', route: 'Route', huette: 'Hütte', themenweg: 'Themenweg',
    fels: 'Fels', klettersteig: 'Klettersteig', boulder: 'Bouldern',
    mtb: 'Mountainbike', radtour: 'Radtour', bikepark: 'Bikepark', pumptrack: 'Pumptrack',
    skigebiet: 'Skigebiet', langlauf: 'Langlauf', rodeln: 'Rodeln', skitour: 'Skitour',
    verleih: 'Verleih', segeln: 'Segeln', sup_kanu: 'SUP & Kanu', surfen: 'Surfen', tauchen: 'Tauchen', wasserski: 'Wasserski', rudern: 'Rudern',
    brettspiel: 'Brettspiele', billard: 'Billard', darts: 'Darts', makerspace: 'Makerspace', spielhalle: 'Spielhalle', kreativ: 'Kreativ-Workshop',
    proberaum: 'Proberaum', offene_buehne: 'offene Bühne',
    // Events (Paket F): Stile, soweit eine Quelle sie liefert.
    flohmarkt: 'Flohmarkt', bauernmarkt: 'Bauernmarkt', fest: 'Fest', rock: 'Rock', klassik: 'Klassik', jazz: 'Jazz', pop: 'Pop',
    lesung: 'Lesung', ausstellung: 'Ausstellung', fussball: 'Fußball', eishockey: 'Eishockey', lauf: 'Lauf',
  },

  // --- Signale (ZUSATZ §5.2) ------------------------------------------------------------------
  // Gewicht je Signal-Art. bewertung: wert 100 (gut 👍) → +2, 50 (mittel 😐) → 0, 0 (nicht gut 👎) → −2.
  // wisch_ja/wisch_nein (Wischspiel, ZUSATZ §5.3) und karte (Onboarding-Interesse) sind Start-Signale.
  signale: {
    meet_stattgefunden: 3,
    meet_unklar: 0.5,
    meet_nicht: 0,
    bewertung: 2,
    zugesagt: 1.5,
    merken: 1,
    teilen: 1,
    angesehen: 0.3,
    ignoriert: -0.3,
    weniger: -3,
    weggewischt: -0.5,
    wisch_ja: 1.2,
    wisch_nein: -1,
    karte: 1.5,
    vorgeschlagen: 0,
    meldung: 0,
  },
  // Bewertungs-Skala der Meet-Signale (Paket G1, 0061): dieselbe wie die des Crew Scores (Paket B,
  // konfig-score.js › bewertung_werte [0, 50, 100]) — EINE Skala für beide Algorithmen. Über der Mitte
  // zählt eine Bewertung positiv, darunter negativ.
  bewertungSkala: { 'nicht-gut': 0, mittel: 50, gut: 100 },
  // Nur diese Arten darf ein Mensch selbst melden (PLAN §1.3); Meet-Signale schreiben Trigger.
  clientSignale: ['merken', 'teilen', 'angesehen', 'ignoriert', 'weniger', 'weggewischt', 'wisch_ja', 'wisch_nein', 'vergessen'],
  signaleProTag: 300,
  // Alte Signale verblassen (ZUSATZ §5.2): Halbwertszeit 6 Monate.
  halbwertszeitTage: 182,
  // Aktivitätswert = tanh(Summe / skala): 1 Onboarding-Karte ≈ 0,36 · 1 Meet ≈ 0,64 · „Weniger davon" ≈ −0,64.
  aktivitaetSkala: 4,
  // Ein Signal zu art·stil zählt zu einem Viertel auch für die anderen Stile derselben Art.
  artUebertrag: 0.25,
  // Die beim Onboarding gewählten Interessen-Gruppen sind der Start (ALGORITHMUS §3.2): bis zu so vielen
  // eigenen Signalen zählen sie voll, dann immer weniger, ab `ausBei` nur noch mit dem Rest-Anteil — das
  // eigene Verhalten zeigt dann besser, wer jemand ist. (Wischkarten sind echte Signale und verblassen normal.)
  start: { vollBis: 5, ausBei: 30, rest: 0.25 },

  // Saison (ZUSATZ §5.2): gemerkt je Jahreszeit — Zerfall zählt nur Tage IN der Saison; außerhalb
  // der Saison ist der Eintrag nicht machbar (Piste im Juli, Freibad im Jänner).
  // Monate der Nordhalbkugel; südlich des Äquators um 6 Monate verschoben.
  saison: [
    { muster: 'wintersport·*', monate: [12, 1, 2, 3] },
    { muster: 'bad·freibad', monate: [5, 6, 7, 8, 9] },
    { muster: 'bad·strandbad', monate: [6, 7, 8, 9] },
    { muster: 'wassersport·*', monate: [5, 6, 7, 8, 9] },
    { muster: 'kino·freiluft', monate: [6, 7, 8] },
    { muster: 'bar·biergarten', monate: [4, 5, 6, 7, 8, 9, 10] },
    { muster: 'aktiv_spass·sommerrodeln', monate: [4, 5, 6, 7, 8, 9, 10] },
    { muster: 'aktiv_spass·hochseilgarten', monate: [4, 5, 6, 7, 8, 9, 10] },
  ],

  // --- Von ähnlichen Menschen lernen (ZUSATZ §5.3) ---------------------------------------------
  cf: {
    // Ab so vielen eigenen Signalen zu einer Aktivität zählt nur noch das Eigene.
    eigeneSignaleVoll: 10,
    // Ein Paar (A, B) wird erst gespeichert, wenn so viele verschiedene Menschen beides mögen.
    minNutzer: 5,
    // Durchschnitt über Profile gilt erst ab so vielen Menschen voll; davor mischt der Standard mit.
    durchschnittAbNutzer: 20,
  },

  // „Wie viel mehr als der Durchschnitt" (ZUSATZ §5.4): Standard-Aktivitätswert je Art, solange es
  // kaum Nutzer gibt. Was alle mögen (Restaurant, Kino, Café) liegt höher — es steigt nur auf, wenn
  // jemand es WIRKLICH überdurchschnittlich oft macht.
  durchschnittStandard: {
    // (Ein Wert von 0,15 heißt: ein durchschnittlicher Mensch hat etwa ein halbes frisches Meet dieser Art.)
    restaurant: 0.15, cafe: 0.12, kino: 0.12, bar: 0.1, natur: 0.08, bad: 0.08, club: 0.05, therme: 0.05,
    wandern: 0.05, markt: 0.05, konzert: 0.05, museum: 0.04, party: 0.04, aktiv_spass: 0.04, fitness: 0.03,
    buehne: 0.03, idee: 0.03, kultur: 0.03, rad: 0.03, wintersport: 0.03, sport: 0.03, spiele_hobby: 0.02,
    klettern: 0.02, wassersport: 0.02, musik_machen: 0.01,
  },

  // --- Passung (ZUSATZ §5.1/§5.4, ALGORITHMUS §3.4) ------------------------------------------------
  passung: {
    // Einzel-Passung = logistisch( gewichtAktivitaet × (Wert − Durchschnitt) + gewichtMerkmale × (Ähnlichkeit − Ähnlichkeit des Durchschnittsprofils) )
    gewichtAktivitaet: 2.2,
    gewichtMerkmale: 6,
    // Gruppe: 0,6 × Minimum + 0,4 × Mittel (§3.4); niemand bekommt, was er nicht mag.
    gruppeMin: 0.6,
    gruppeMittel: 0.4,
    gruppeMinEinzel: 0.3,
    // Gelerntes Gruppen-Profil (Signale mit crew_id, ZUSATZ §5.5) hebt, was diese Crew oft macht.
    crewGewicht: 0.3,
    // Absicht: Passung = 0,6 × Gruppen-Passung + 0,4 × Ähnlichkeit(Absicht, Eintrag).
    absichtGewicht: 0.4,
    // „Für dich" zeigt nur, was passt.
    fuerDichMin: 0.4,
    // Im Rang zählt die Passung gedämpft (Passung^Exponent): die Zahl aus Algorithmus 1 zählt am stärksten
    // (q 0,5–1 ⇒ Faktor 2), die Passung danach (0,4–1 ⇒ Faktor 1,6). Platz je Interesse regelt die Vielfalt.
    rangExponent: 0.5,
    // Ein Merkmal zählt für den Passungs-Text nur, wenn das Profil dort klar ist (|p − 0,5| ≥ …)
    // und der Eintrag auf derselben Seite liegt.
    textKlarheit: 0.15,
  },

  // Absichten (ALGORITHMUS §3.1/§3.4): 12er-Muster + erlaubte Arten.
  absichten: {
    essen: { label: 'Essen', muster: [0.4, 0.3, 0.5, 0.5, 0.05, 0.45, 0.4, 0.05, 0.45, 0.3, 0.05, 0.1], arten: ['restaurant', 'cafe', 'markt', 'idee'] },
    trinken: { label: 'Trinken', muster: [0.65, 0.3, 0.5, 0.3, 0.1, 0.4, 0.5, 0.35, 0.9, 0.15, 0.1, 0.1], arten: ['bar', 'cafe', 'club', 'idee'] },
    feiern: { label: 'Feiern', muster: [0.95, 0.15, 0.5, 0.3, 0.55, 0.4, 0.85, 0.65, 0.85, 0.1, 0.15, 0.15], arten: ['club', 'bar', 'party', 'konzert', 'idee'] },
    entspannen: { label: 'Entspannen', muster: [0.1, 0.5, 0.4, 0.3, 0.1, 0.3, 0.3, 0.4, 0.2, 0.25, 0.0, 0.1], arten: ['therme', 'bad', 'natur', 'cafe', 'kino', 'idee'] },
    draussen: { label: 'Draußen', muster: [0.3, 1.0, 0.2, 0.4, 0.65, 0.45, 0.4, 0.85, 0.2, 0.25, 0.2, 0.2], arten: ['natur', 'wandern', 'klettern', 'rad', 'bad', 'wassersport', 'wintersport', 'markt', 'sport', 'idee'] },
    kultur: { label: 'Kultur', muster: [0.3, 0.2, 0.45, 0.65, 0.1, 0.6, 0.5, 0.7, 0.3, 1.0, 0.05, 0.35], arten: ['museum', 'buehne', 'kino', 'konzert', 'kultur', 'idee'] },
    aktiv: { label: 'Aktiv', muster: [0.5, 0.6, 0.35, 0.45, 0.95, 0.5, 0.45, 0.95, 0.1, 0.1, 0.6, 0.3], arten: ['fitness', 'klettern', 'aktiv_spass', 'rad', 'wandern', 'wintersport', 'wassersport', 'bad', 'sport', 'spiele_hobby', 'musik_machen', 'idee'] },
    egal: { label: 'Egal', muster: null, arten: null },
  },

  // Die 16 Karten (Onboarding und Wischspiel „Würdest du das machen?", ZUSATZ §5.3). Das Wischspiel
  // zieht 10 davon — die, aus denen es gerade am meisten Neues lernt (auswahl-regeln.js › wischKarten).
  karten: [
    { id: 'klettern', label: 'Klettern & Bouldern', muster: [0.4, 0.5, 0.35, 0.4, 0.95, 0.5, 0.35, 1.0, 0.1, 0.1, 0.55, 0.3], aktivitaeten: ['klettern·*', 'fitness·kletterhalle'] },
    { id: 'wandern', label: 'Wandern & Gipfel', muster: [0.15, 1.0, 0.1, 0.55, 0.8, 0.4, 0.35, 0.9, 0.15, 0.3, 0.15, 0.1], aktivitaeten: ['wandern·*', 'natur·aussicht'] },
    { id: 'club', label: 'Feiern im Club', muster: [0.95, 0.1, 0.5, 0.2, 0.55, 0.4, 0.9, 0.7, 0.9, 0.1, 0.15, 0.15], aktivitaeten: ['club·*', 'party·*'] },
    { id: 'bar', label: 'Drinks in der Bar', muster: [0.65, 0.2, 0.55, 0.3, 0.1, 0.4, 0.5, 0.35, 0.95, 0.15, 0.1, 0.1], aktivitaeten: ['bar·*'] },
    { id: 'essen', label: 'Gut essen gehen', muster: [0.4, 0.25, 0.65, 0.6, 0.05, 0.5, 0.4, 0.05, 0.5, 0.3, 0.05, 0.1], aktivitaeten: ['restaurant·*'] },
    { id: 'cafe', label: 'Café & Kuchen', muster: [0.3, 0.3, 0.3, 0.2, 0.05, 0.3, 0.25, 0.15, 0.1, 0.25, 0.05, 0.1], aktivitaeten: ['cafe·*'] },
    { id: 'museum', label: 'Museum & Ausstellung', muster: [0.15, 0.1, 0.35, 0.6, 0.2, 0.65, 0.3, 0.7, 0.05, 1.0, 0.05, 0.3], aktivitaeten: ['museum·*'] },
    { id: 'theater', label: 'Theater & Oper', muster: [0.35, 0.1, 0.65, 0.85, 0.05, 0.6, 0.5, 0.65, 0.3, 0.95, 0.05, 0.2], aktivitaeten: ['buehne·theater', 'buehne·kleinkunst', 'kultur·*'] },
    { id: 'konzert', label: 'Konzerte & Livemusik', muster: [0.85, 0.35, 0.5, 0.7, 0.35, 0.55, 0.8, 0.7, 0.6, 0.6, 0.1, 0.2], aktivitaeten: ['konzert·*', 'club·livemusik', 'buehne·konzerthaus'] },
    { id: 'musik', label: 'Selbst Musik machen', muster: [0.65, 0.15, 0.25, 0.5, 0.35, 0.5, 0.35, 1.0, 0.3, 0.6, 0.2, 1.0], aktivitaeten: ['musik_machen·*'] },
    { id: 'spiele', label: 'Spiele & Wettkampf', muster: [0.55, 0.15, 0.3, 0.4, 0.3, 0.5, 0.5, 0.9, 0.4, 0.15, 0.95, 0.35], aktivitaeten: ['spiele_hobby·*', 'aktiv_spass·*'] },
    { id: 'baden', label: 'Baden & Wellness', muster: [0.25, 0.55, 0.4, 0.3, 0.35, 0.3, 0.4, 0.6, 0.1, 0.05, 0.1, 0.05], aktivitaeten: ['therme·*', 'bad·*', 'wassersport·*'] },
    { id: 'schnee', label: 'Skifahren & Schnee', muster: [0.45, 1.0, 0.6, 0.7, 0.9, 0.4, 0.5, 1.0, 0.3, 0.05, 0.35, 0.1], aktivitaeten: ['wintersport·*'] },
    { id: 'rad', label: 'Radfahren & Biken', muster: [0.3, 1.0, 0.3, 0.45, 0.95, 0.45, 0.35, 1.0, 0.1, 0.1, 0.45, 0.15], aktivitaeten: ['rad·*'] },
    { id: 'maerkte', label: 'Flohmarkt & Märkte', muster: [0.5, 0.7, 0.15, 0.4, 0.25, 0.55, 0.45, 0.5, 0.3, 0.4, 0.05, 0.35], aktivitaeten: ['markt·*'] },
    { id: 'kino', label: 'Kino', muster: [0.2, 0.1, 0.35, 0.5, 0.0, 0.35, 0.35, 0.6, 0.2, 0.45, 0.05, 0.0], aktivitaeten: ['kino·*'] },
  ],
  wischKartenAnzahl: 10,

  // Die sechs Interessen-Gruppen, die es in der App schon gibt (settings.interests, find-auswahl.js ›
  // HAUPTGRUPPEN) → Muster + Aktivitäten. So tragen vorhandene Profile sofort etwas.
  interessenGruppen: {
    zuhause: { label: 'Zuhause', muster: [0.3, 0.1, 0.15, 0.5, 0.2, 0.4, 0.3, 0.6, 0.4, 0.4, 0.6, 0.6], aktivitaeten: ['idee·*'] },
    essen: { label: 'Essen', muster: [0.45, 0.3, 0.55, 0.5, 0.1, 0.45, 0.4, 0.1, 0.5, 0.3, 0.1, 0.15], aktivitaeten: ['restaurant·*', 'cafe·*'] },
    'club bar': { label: 'Club & Bar', muster: [0.85, 0.15, 0.5, 0.3, 0.4, 0.4, 0.75, 0.6, 0.9, 0.15, 0.2, 0.15], aktivitaeten: ['bar·*', 'club·*', 'party·*'] },
    sport: { label: 'Sport', muster: [0.5, 0.6, 0.35, 0.5, 0.9, 0.5, 0.5, 0.95, 0.15, 0.1, 0.7, 0.3], aktivitaeten: ['fitness·*', 'klettern·*', 'aktiv_spass·*', 'rad·*', 'wintersport·*', 'wassersport·*', 'sport·*'] },
    natur: { label: 'Natur', muster: [0.2, 0.95, 0.15, 0.4, 0.7, 0.45, 0.35, 0.85, 0.2, 0.3, 0.15, 0.2], aktivitaeten: ['wandern·*', 'natur·*', 'bad·strandbad', 'bad·freibad'] },
    kultur: { label: 'Kultur', muster: [0.3, 0.2, 0.45, 0.65, 0.15, 0.6, 0.5, 0.7, 0.35, 0.95, 0.1, 0.35], aktivitaeten: ['museum·*', 'buehne·*', 'kino·*', 'konzert·*', 'kultur·*'] },
  },

  // --- Machbarkeit (ALGORITHMUS §3.3, ohne Alters-Dämpfer) ----------------------------------------
  machbarkeit: {
    // Event-Fenster um den Zeitpunkt; bei gewähltem Tag: der ganze Tag.
    eventVorMin: 30,
    eventNachStd: 6,
    // Ein Ort, der innerhalb so vieler Minuten öffnet, ist machbar (mit Hinweis „öffnet um …").
    oeffnetBaldMin: 90,
    // Jugendschutz (V1-Kern §7, gesetzliche Grenze, keine Pauschale): unter 16 nichts mit Alkohol-Schwerpunkt.
    alkoholAbAlter: 16,
    alkoholMerkmalAb: 0.7,
  },
  // Keine Öffnungszeiten bekannt → nicht raus, aber Faktor 0,8 (§3.3/§3.5).
  oeffnungUnbekanntFaktor: 0.8,

  // Wetter (Open-Meteo, WMO-Codes). Starkregen/Gewitter + draußen ≥ 0,8 → nicht machbar.
  wetter: {
    unwetterCodes: [65, 67, 75, 82, 86, 95, 96, 99],
    starkregenMmStunde: 4,
    regenCodes: [51, 53, 55, 61, 63, 80, 81],
    regenWahrscheinlichAb: 60,
    draussenAb: 0.8,
    draussenWetterAb: 0.7,
    drinnenBis: 0.3,
    regenDraussen: 0.5,
    regenDrinnen: 1.1,
    sonnigCodes: [0, 1, 2],
    sonnigAbGrad: 18,
    sonnigDraussen: 1.15,
  },

  // --- Zusammenhang: Tageszeit, Wochentag, Jahreszeit (ZUSATZ §5.5) --------------------------------
  // Tageszeit-Fenster (Ortszeit, Stunde von–bis) und je Art ein Faktor je Fenster:
  //   [morgen 6–11, mittag 11–14, nachmittag 14–18, abend 18–22, nacht 22–6]
  tageszeiten: [[6, 11], [11, 14], [14, 18], [18, 22], [22, 6]],
  tageszeitFaktor: {
    restaurant: [0.3, 1, 0.5, 1, 0.3], cafe: [0.9, 0.9, 1, 0.5, 0.1], bar: [0.05, 0.3, 0.5, 1, 0.9],
    club: [0, 0, 0.05, 0.5, 1], kino: [0.2, 0.4, 0.8, 1, 0.6], buehne: [0.1, 0.3, 0.6, 1, 0.4],
    museum: [0.8, 1, 1, 0.5, 0.05], bad: [0.9, 1, 1, 0.6, 0.05], therme: [0.7, 0.9, 1, 1, 0.4],
    fitness: [1, 1, 1, 1, 0.3], aktiv_spass: [0.4, 0.8, 1, 1, 0.5], natur: [1, 1, 0.9, 0.4, 0.05],
    wandern: [1, 1, 0.8, 0.3, 0.02], klettern: [1, 1, 1, 0.6, 0.05], rad: [1, 1, 0.9, 0.4, 0.02],
    wintersport: [1, 1, 0.8, 0.2, 0.02], wassersport: [0.9, 1, 1, 0.5, 0.02], spiele_hobby: [0.3, 0.6, 1, 1, 0.6],
    musik_machen: [0.3, 0.5, 0.8, 1, 0.6], idee: [0.5, 0.7, 1, 1, 0.7],
  },
  // Clubs und Partys leben am Wochenende (Fr/Sa-Abend); unter der Woche weniger.
  wochentagFaktor: { club: { werktag: 0.6, wochenende: 1 }, party: { werktag: 0.7, wochenende: 1 } },
  // Jahreszeit: Draußen-Lastiges im Winter (Dez–Feb) gedämpft — außer Wintersport (der hat seine Saison).
  winterMonate: [12, 1, 2],
  winterDraussenAb: 0.7,
  winterDraussenFaktor: 0.7,

  // --- Distanz, Frische, Rang (ALGORITHMUS §3.5/§3.6) ------------------------------------------
  komfortradius: { startKm: 15, minKm: 5, maxKm: 60 },
  // Entfernung zählt leicht: Preis = 1 / (1 + d / (halbBeiKomfort × Wohlfühl-Entfernung)) — doppelte Wohlfühl-
  // Entfernung −25 %, sechsfache −50 % (Auftrag Feinschliff: „höchstens rund ein Viertel“).
  distanz: { halbBeiKomfort: 6 },
  frische: {
    vorgeschlagenTage: 14,
    vorgeschlagenFaktor: 0.5,
    // Ein Vorschlag gilt erst als „nicht genommen", wenn er so lange draußen war (sonst würde jedes
    // erneute Öffnen die Liste umwerfen).
    vorgeschlagenMinStd: 20,
    besuchtTage: 30,
    besuchtFaktor: 0.7,
    lieblingsBesuche: 3,
    lieblingsFaktor: 0.9,
  },
  rang: { scoreGrenze: 70, qNeu: 0.55, qIdee: 0.7 },

  // --- Einheimisch oder zu Besuch (ZUSATZ §5.6) ------------------------------------------------
  heimat: {
    monate: 6,
    minMeetOrte: 3,
    // Meet-Orte gehören zur selben Gegend, wenn sie so nah beieinander liegen.
    gegendKm: 25,
    besuchAbKm: 50,
    touristenAb: 0.6,
    faktorEinheimisch: 0.3,
    faktorBesuch: 1.2,
  },

  // --- Filter „Für dich" (Feinschliff 01.10.2026; ersetzt Ringe, Fern-Regel, Ausdünnen, Deckel aus §3.7) -------
  radius: { standardKm: 25, maxKm: 300 },
  // Nur noch Etikett der Entfernung je Eintrag (nah ≤ Wohlfühl-Entfernung, mittel ≤ max(Anteil × Radius, Faktor ×
  // Wohlfühl-Entfernung), sonst fern) — die Auswahl selbst kennt keine Ringe mehr.
  ringe: { mittelAnteil: 0.35, mittelMinFaktor: 2 },
  // Einzugsradius je Art in km (ALGORITHMUS §2.2, früher bei Algorithmus 1): wie weit Menschen dafür fahren.
  // Startwerte; später aus echten Wegen gelernt.
  einzugsradiusKm: {
    fitness: 6, cafe: 6, restaurant: 8, bar: 10, kino: 20, aktiv_spass: 25, bad: 20, club: 25,
    museum: 30, therme: 50, buehne: 60, natur: 40,
    wandern: 40, klettern: 50, rad: 40, wintersport: 60, wassersport: 30, spiele_hobby: 15, musik_machen: 25,
    party: 30, konzert: 120, markt: 25, kultur: 60, sport: 60,
  },
  // Abstandsregel: Im Abdeckungs-Radius (= faktor × Einzugsradius: Kino 5 km, Restaurant 2 km, Café 1,5 km) steht nur
  // der beste Ort derselben Art und desselben Stils (Restaurant: derselben Küche) oben; die anderen rutschen nach unten.
  abstand: { faktor: 0.25 },
  // Treffpunkt-Eignung (0–1, orte.treffpunkt; Schätzung aus OSM in konfig-klassifizieren.js › TREFFPUNKT):
  // darunter nicht in „Für dich" (Suche und Kategorien zeigen alles). Gelernt: jedes stattgefundene Meet dort
  // zählt wie eine Beobachtung „Treffpunkt“ — mit dem Gewicht lernenM für die Schätzung (0067).
  treffpunkt: { min: 0.5, lernenM: 5 },
  // Oben: höchstens `max` Einträge (Crew-Tipp + 7 Zeilen — die Seite bleibt bei ~1,5 Bildschirmen), und nur solange
  // ein Eintrag mindestens `mindestAnteil` so viel Wert hat wie der beste (Wert = Rang × Vielfalt). Alles andere steht
  // darunter („Mehr anzeigen"), `weitere.max` davon werden mitgeliefert.
  oben: { max: 8, mindestAnteil: 0.15 },
  weitere: { max: 40 },
  neuAnteil: 0.2,
  // Vielfalt (abnehmender Nutzen): der n-te weitere Eintrag eines Interesses zählt 1 / (1 + n / (platzSkala × Anteil des
  // Interesses)); dazu × gleicheArt je weiterem Ort derselben Art und × gleicheSorte je weiterem Ort derselben Art und Küche.
  vielfalt: { minInteressen: 3, maxInteressen: 5, staerkeAnteilMin: 0.2, platzSkala: 4, gleicheArt: 0.85, gleicheSorte: 0.6 },
  malWasAnderes: {
    jeEintraege: 10,
    // Merkmal-Ähnlichkeit mindestens so viel über dem Durchschnittsprofil (passt zu den 12 Merkmalen).
    merkmaleUeber: 0.04,
    // Aktivitäten, zu denen die Person schon so viel eigenen Wert hat, sind nicht „anders".
    eigenerWertBis: 0.15,
    minScore: 80,
    platz: 6,
  },

  // Grob-Vorauswahl in der Datenbank (public.crew_auswahl_kandidaten, 0058 liest diese Werte aus
  // score_konfig.werte.auswahl): wie viele Kandidaten, und wie die Vielfalt dabei erhalten bleibt.
  kandidatenLimit: 600,
  sql: {
    // Je Aktivität (Art·Stil) höchstens so viele, die besten nach Grobrang (0067) — sonst verdrängen 500 nahe
    // Cafés das eine Programmkino, das die Person sucht — und die besten `jeAktivitaetSicher` jeder Aktivität
    // kommen immer mit, auch über das Limit hinaus.
    jeAktivitaet: 25,
    jeAktivitaetSicher: 5,
    // So viele nächstgelegene Treffpunkte holt die Datenbank in EINEM Durchgang (Vorarlberg: ~ die nächsten 20 km).
    naechste: 1500,
    // Je Art dazu die so vielen besten nach Crew Score im ganzen Radius (die Entfernung zählt nur leicht).
    besteJeArt: 40,
    // Ab diesem Radius sucht die Datenbank die Besten dem Score-Index entlang, darunter im Umkreis-Index (Leistung, 0067).
    scoreWegAbKm: 80,
    // Events im Umkreis dieses Fensters um den Zeitpunkt (das genaue Fenster prüft die Machbarkeit).
    eventTageVor: 1,
    eventTageNach: 2,
  },

  // --- Server (Edge Function `auswahl`) ---------------------------------------------------------
  server: {
    // Standort nur gerundet benutzen (≈ 1 km, wie orte-vorschlaege.js) und nie speichern.
    standortRundung: 0.01,
    mitgliederMax: 12,
    signaleMax: 3000,
    signaleTage: 730,
    wetterMinuten: 60,
    wetterFeld: 0.1,
    // Ein Eintrag wird höchstens so oft als „vorgeschlagen" gemerkt (Frische-Regel).
    vorgeschlagenAbstandStd: 6,
    // „Region öffnen" nur bei einer Suche mit Radius ≤ so viel (ALGORITHMUS §5.3).
    regionOeffnenBisKm: 100,
    sucheLimit: 200,
    namenssucheLimit: 30,
    // PostgREST lehnt einen Ausweis mit Zeitversatz ab („JWT issued at future“), bevor es etwas ausführt —
    // dann einmal nach so vielen Millisekunden neu (gemessen 1 von 32 unter Last, 01.10.2026).
    ausweisZuFruehWarteMs: 500,
  },
  // Zeitzone je Land (ISO 3166-1); alle anderen: Mitteleuropa.
  zeitzonen: {
    standard: 'Europe/Vienna', GB: 'Europe/London', IE: 'Europe/Dublin', PT: 'Europe/Lisbon', IS: 'Atlantic/Reykjavik',
    FI: 'Europe/Helsinki', EE: 'Europe/Tallinn', LV: 'Europe/Riga', LT: 'Europe/Vilnius', GR: 'Europe/Athens',
    RO: 'Europe/Bucharest', BG: 'Europe/Sofia', CY: 'Asia/Nicosia', UA: 'Europe/Kyiv', MD: 'Europe/Chisinau', TR: 'Europe/Istanbul',
  },

  // --- Texte (Deutsch; Übersetzungsteile: scratch/uebersetzung/{en,fr,es}-alg-c.json) -----------------
  texte: {
    passtDir: 'Passt zu dir: {liste}',
    passtEuch: 'Passt zu euch: {liste}',
    wieLetzteMeets: 'wie eure letzten Meets',
    wieDeineMeets: 'wie deine letzten Meets',
    oeffnungUnbekannt: 'Öffnungszeiten unbekannt',
    offenBis: 'Offen bis {uhr}',
    oeffnetUm: 'Öffnet um {uhr}',
    offenesEnde: 'Offen',
    geschlossen: 'Jetzt geschlossen',
    regen: 'Regen angesagt',
    regenDrinnen: 'Regen angesagt – drinnen trocken',
    sonnig: 'Sonnig, {grad} °C',
    malWasAnderes: 'Mal was anderes',
    nichtEmpfohlen: 'nicht unter den Empfehlungen',
    leer: 'Heute nichts, das gut genug ist – Radius erweitern?',
    warumMalAnders: 'Mal was anderes – passt zu dir, weil du es {a} und {b} magst',
    warumMalAndersEins: 'Mal was anderes – passt zu dir, weil du es {a} magst',
    warumMalAndersEuch: 'Mal was anderes – passt zu euch, weil ihr es {a} und {b} mögt',
    warumMalAndersEinsEuch: 'Mal was anderes – passt zu euch, weil ihr es {a} mögt',
    warumGemerkt: 'Du hast dir Ähnliches gemerkt',
    warumKarte: 'Du hast „{karte}“ als Interesse gewählt',
    warumWisch: 'Du hast beim Wischen Ja zu „{karte}“ gesagt',
    warumAehnlich: 'Wer gern {a} mag, mag oft auch {b}',
    warumMerkmale: 'Passt zu dem, was du magst: {a} und {b}',
    warumMerkmaleEins: 'Passt zu dem, was du magst: {a}',
    warumMerkmaleEuch: 'Passt zu dem, was ihr mögt: {a} und {b}',
    warumMerkmaleEinsEuch: 'Passt zu dem, was ihr mögt: {a}',
    warumAktivitaet: 'Passt zu dir: {aktivitaet}',
    warumAktivitaetEuch: 'Passt zu euch: {aktivitaet}',
    warumBesuch: 'Du bist zu Besuch – ein Klassiker hier, der zu dir passt',
    warumBesuchEuch: 'Ihr seid zu Besuch – ein Klassiker hier, der zu euch passt',
    warumAbsicht: 'Passt zu „{absicht}“',
    warumSuche: 'Gefunden über die Suche',
    warumKategorie: 'Unter den Besten dieser Art in der Nähe',
  },
});
