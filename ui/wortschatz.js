// Wortschatz für Zeichen (Runde 2).
//
// Jonathan: „Zeichen sollen automatisch verwendet werden, wenn es passend ist — egal wofür,
// nicht nur, wenn man genau das richtige Wort schreibt. Auch Schreibfehler müssen es
// verstehen." (Entscheidung 3.A: große Wortliste + Tippfehler-Toleranz, gilt für alles.)
//
// Zweite Stufe hinter den Stichwort-Mustern in activity-icons.js: Finden die nichts, sucht
// diese Liste — mit Wortstamm und Mehrzahl (Beamers, Zelte), Zusammensetzungen (Grillabend,
// Tischtennisplatte, Kanufahrt) und Tippfehlern (Beamr, Fahhrad, Kletterhale). Deutsch,
// Englisch, Französisch, Spanisch — die App spricht bald alle vier.
//
// Reihenfolge IST Bedeutung: Spezifisches steht vor Allgemeinem. Bei gleich guten Treffern
// gewinnt der frühere Eintrag — deshalb wird „Kanufahrt" zum Kanu und nicht zur Fahrt.
// Allgemeine Köpfe von Zusammensetzungen (Fahrt, Ausflug, Abend, Tour) stehen ganz hinten.

export const WORTSCHATZ = [
  // --- Geräte und Technik ---
  ['gamepad', 'spielkonsole konsole playstation xbox nintendo switch controller gamepad gaming gamer game games zocken videospiel computerspiel lanparty zockerabend console videogame videogames joystick manette jeuvideo jeuxvideo videojuego videojuegos mando steam mariokart fifa fortnite minecraft'],
  ['vrbrille', 'vrbrille virtualreality oculus metaquest vrheadset casquevr gafasvr'],
  ['beamer', 'beamer projektor videoprojektor projector videoprojecteur projecteur proyector'],
  ['leinwand', 'leinwand projektionsleinwand filmleinwand screen ecran pantalla'],
  ['lautsprecher', 'lautsprecher musikbox bluetoothbox soundbox soundbar musikanlage stereoanlage partybox jbl bose subwoofer speaker speakers enceinte altavoz altavoces'],
  ['mikrofon', 'mikrofon mikrophon mikro microphone micro microfono'],
  ['kopfhoerer', 'kopfhoerer headset ohrhoerer airpods headphones earphones casque auriculares'],
  ['plattenspieler', 'plattenspieler schallplatte schallplatten vinyl turntable djpult mischpult platine tocadiscos'],
  ['gitarre', 'gitarre egitarre bassgitarre ukulele guitar guitare guitarra'],
  ['klavier', 'klavier keyboard piano epiano fluegel synthesizer synth clavier teclado'],
  ['drohne', 'drohne quadrocopter dji drone dron'],
  ['stativ', 'stativ tripod gimbal selfiestick trepied tripode'],
  ['laptop', 'laptop notebook macbook chromebook ordinateurportable portatil'],
  ['monitor', 'monitor bildschirm display fernseher tv fernsehen television tele moniteur pantallatv'],
  ['tablet', 'tablet ipad tablette tableta ebook kindle'],
  ['drucker', 'drucker 3ddrucker printer imprimante impresora plotter'],
  ['pc', 'pc rechner computer desktop gamingpc ordinateur ordenador'],
  ['kamera', 'kamera fotokamera spiegelreflex dslr gopro camcorder systemkamera camera appareilphoto camara fotoapparat'],
  ['fernglas', 'fernglas feldstecher teleskop fernrohr binoculars jumelles prismaticos'],
  // --- Werkzeug und Garten ---
  ['bohrmaschine', 'bohrmaschine bohrer akkuschrauber schlagbohrer bohrhammer drill perceuse taladro'],
  ['werkzeug', 'werkzeug werkzeugkiste werkzeugkoffer schraubenzieher schraubendreher schraubenschluessel zange saege hammer akkusaege stichsaege flex winkelschleifer tools toolbox outils herramientas'],
  ['leiter', 'leiter stehleiter trittleiter ladder echelle escalera'],
  ['rasenmaeher', 'rasenmaeher maeher rasentraktor motorsense freischneider heckenschere vertikutierer lawnmower tondeuse cortacesped'],
  ['schubkarre', 'schubkarre scheibtruhe schubkarren wheelbarrow brouette carretilla'],
  ['bollerwagen', 'bollerwagen handwagen leiterwagen transportwagen sackkarre wagon chariot carrito'],
  // --- Fahrzeuge ---
  ['anhaenger', 'anhaenger autoanhaenger fahrradanhaenger haenger trailer remorque remolque'],
  ['motorrad', 'motorrad motorradtour motorradfahren moped roller vespa mofa scooter motorcycle motorbike moto motocicleta'],
  ['auto', 'auto pkw kombi bus van transporter wohnmobil camper kleinbus car voiture coche carro'],
  ['rad', 'fahrrad rad bike mtb mountainbike rennrad ebike velo lastenrad radtour radeln bicycle cycling velo bicicleta bici'],
  // --- Draußen und Wasser ---
  ['surfbrett', 'surfbrett surfboard sup standuppaddle paddleboard wellenreiten surfen surf planchesurf tabladesurf wakeboard kitesurfen'],
  ['kanu', 'kanu kajak kayak paddelboot schlauchboot paddeln canoe canoa piragua'],
  ['boot', 'boot segelboot segeln yacht motorboot tretboot boat sailing bateau voile barco velero'],
  ['schlitten', 'schlitten rodeln rodel bob sled sledge luge trineo'],
  ['snowboard', 'snowboard snowboarden snowboarding'],
  ['ski', 'ski skier skifahren skitour tourenski langlauf skiing skis esqui'],
  ['pool', 'pool planschbecken schwimmbecken whirlpool jacuzzi piscine piscina'],
  ['haengematte', 'haengematte hammock hamac hamaca'],
  ['pavillon', 'pavillon partyzelt faltzelt sonnensegel gazebo tonnelle carpa'],
  ['sonnenschirm', 'sonnenschirm schirm umbrella parasol sombrilla'],
  ['campingstuhl', 'campingstuhl klappstuhl campingtisch klapptisch hocker gartenstuhl gartenmoebel stuhl chair chaise silla'],
  ['schlafsack', 'schlafsack isomatte luftmatratze feldbett sleepingbag sacdecouchage sacodedormir'],
  ['zelt', 'zelt zelten camping campen tent tente tienda acampada'],
  ['kuehlbox', 'kuehlbox kuehltasche kuehlschrank kuehlakku cooler glaciere nevera'],
  ['thermoskanne', 'thermoskanne thermos isolierkanne thermobecher termo'],
  ['picknickkorb', 'picknickkorb picknick picknickdecke picnic piquenique picnic merienda'],
  ['raclette', 'raclette fondue waffeleisen crepes elektrogrill heissluftfritteuse'],
  ['grill', 'grill grillen grillabend grillparty bbq barbecue smoker lagerfeuer feuerschale feuerstelle barbacoa asado'],
  ['koffer', 'koffer reisetasche trolley suitcase valise maleta'],
  ['rucksack', 'rucksack wanderrucksack backpack sacados mochila'],
  // --- Spiele ---
  ['dart', 'dart darts dartscheibe flechettes dardos'],
  ['tischtennis', 'tischtennis pingpong tischtennisplatte tabletennis tennisdetable'],
  ['karten', 'karten kartenspiel poker uno skat jass schnapsen watten doppelkopf cards cartes cartas naipes'],
  ['wuerfel', 'brettspiel brettspiele spieleabend gesellschaftsspiel puzzle quiz pubquiz wuerfel escaperoom exitgame catan monopoly schach boardgame boardgames jeudesociete juegodemesa ajedrez spiele'],
  // --- Essen und Trinken ---
  ['tasse', 'kaffee kaffeetrinken cafe espresso cappuccino latte tee teetrinken kaffeemaschine siebtraeger kaffeeklatsch coffee tea the cafecito'],
  ['glas', 'bier wein cocktail cocktails drink drinks trinken bar pub kneipe beisl weinbar prosecco sekt spritz aperol schnaps afterwork zapfanlage apero aperitif beer wine biere vin cerveza vino copas'],
  ['feiern', 'party feier fest festival club clubbing disco tanzen tanz karaoke silvester geburtstag geburtstagsfeier hochzeit polterabend jga fasching karneval rave dance fete soiree fiesta cumpleanos boda baile'],
  ['pizza', 'pizza pizzaofen pizzeria'],
  ['gabel', 'kochen kochabend pasta essen essengehen dinner abendessen mittagessen backen sushi burger restaurant brunch fruehstueck mittag lunch grillhendl kebab doener tacos ramen food cuisine cuisiner diner dejeuner comida cena cocinar restaurante'],
  // --- Sport ---
  ['schnee', 'schnee eislaufen schlittschuh schneeschuh schneeschuhwandern iceskating snow neige patinage nieve'],
  ['schwimmen', 'schwimmen baden strandbad freibad hallenbad badesee sauna therme swim swimming nager natation nadar playa strand beach plage'],
  ['berg', 'bouldern boulder boulderhalle klettern kletterhalle klettersteig klettergurt berg gipfel gipfelsturm bergtour climbing escalade escalada montagne montana'],
  ['wandern', 'wandern wanderung spazieren spaziergang hike hiking trail laufen joggen jogging nordicwalking pfaender randonnee senderismo caminar correr running'],
  ['yoga', 'yoga pilates meditation meditieren stretching'],
  ['hantel', 'gym fitness fitnessstudio training workout hantel hanteln kraftraum crossfit muckibude salledesport gimnasio'],
  ['volleyball', 'volleyball beachvolleyball spikeball federball badminton voley'],
  ['fussball', 'fussball ball tennis basketball padel bowling billard minigolf golf kegeln handball eishockey hockey football soccer futbol baloncesto petanque boule'],
  // --- Ausgehen und Kultur ---
  ['note', 'jazz konzert konzerte musik band singen gig openair chor musizieren concert musique musica concierto'],
  ['film', 'kino film filme serie serien netflix movie movies filmabend kinoabend cinema cine pelicula'],
  ['museum', 'museum ausstellung vernissage galerie musee exposition museo exposicion'],
  ['ticket', 'theater oper musical festspiele ticket tickets show kabarett comedy standup zirkus theatre spectacle teatro entradas'],
  ['buch', 'lesen buch buecher lernen bibliothek uni lernabend lesekreis book books livre livres libro libros leer'],
  ['tasche', 'shopping einkaufen einkauf markt flohmarkt bummeln stadtbummel shoppen courses marche compras mercado'],
  // --- Orte, Stimmungen und allgemeine Köpfe zuletzt ---
  ['sonne', 'sonnenaufgang sonnenuntergang sonne feuerwerk sunset sunrise soleil sol atardecer'],
  ['wellen', 'wasser see fluss meer ufer bodensee rhein lake river mer lac mar rio'],
  ['haus', 'umzug zuhause daheim wohnung renovieren streichen umziehen hausparty home maison casa mudanza'],
  ['sofa', 'chillen chill entspannen couch sofa abhaengen relaxen gammeln relax detente descansar'],
  ['auto', 'roadtrip staedtetrip ausflug fahrt tagesausflug trip tour excursion viaje escapada', { schwach: true }],
];

const LAENGE_EXAKT = 4;   // kürzere Wörter zählen nur genau so, wie sie dastehen

export function normalisiere(text) {
  return String(text || '')
    .toLowerCase()
    .replace(/ä/g, 'ae').replace(/ö/g, 'oe').replace(/ü/g, 'ue').replace(/ß/g, 'ss')
    .normalize('NFD').replace(/\p{M}/gu, '')
    .replace(/[^a-z0-9]+/g, ' ')
    .trim();
}

const EINTRAEGE = WORTSCHATZ.flatMap(([key, worte, art = {}], rang) => worte.split(/\s+/).filter(Boolean)
  .map((wort) => ({ key, wort: normalisiere(wort).replace(/ /g, ''), rang, schwach: Boolean(art.schwach) })));

// Optimal-String-Alignment-Abstand mit früher Aufgabe, sobald die Grenze sicher überschritten ist.
function abstand(a, b, grenze) {
  if (Math.abs(a.length - b.length) > grenze) return grenze + 1;
  let vorvor = null;
  let vor = Array.from({ length: b.length + 1 }, (_, j) => j);
  for (let i = 1; i <= a.length; i += 1) {
    const jetzt = [i];
    let kleinste = i;
    for (let j = 1; j <= b.length; j += 1) {
      const kosten = a[i - 1] === b[j - 1] ? 0 : 1;
      let wert = Math.min(vor[j] + 1, jetzt[j - 1] + 1, vor[j - 1] + kosten);
      if (vorvor && i > 1 && j > 1 && a[i - 1] === b[j - 2] && a[i - 2] === b[j - 1]) wert = Math.min(wert, vorvor[j - 2] + 1);
      jetzt[j] = wert;
      if (wert < kleinste) kleinste = wert;
    }
    if (kleinste > grenze) return grenze + 1;
    vorvor = vor;
    vor = jetzt;
  }
  return vor[b.length];
}

// Wie viele Fehler ein Wort verträgt: kurze keine, mittlere einen, lange zwei. Der erste
// Buchstabe muss stimmen — sonst würde „Dennis" zu Tennis und „Mario" zu Mario Kart.
const fehlerGrenze = (wort) => (wort.length >= 9 ? 2 : wort.length >= 5 ? 1 : 0);

const merker = new Map();

export function zeichenAusWortschatz(text) {
  const n = normalisiere(text);
  if (!n) return null;
  if (merker.has(n)) return merker.get(n);
  const worte = n.split(' ').filter((t) => t.length >= 2);
  const zusammen = n.replace(/ /g, '');
  let bester = null;
  const nimm = (eintrag, roh) => {
    // Allgemeine Köpfe (Fahrt, Tour, Ausflug) zählen voll nur, wenn sie allein dastehen —
    // sonst würde „Motoradtour" zur Tour statt zum Motorrad.
    const wert = eintrag.schwach && roh < 100 ? roh - 45 : roh;
    if (wert <= 0) return;
    if (!bester || wert > bester.wert || (wert === bester.wert && eintrag.rang < bester.rang)) {
      bester = { key: eintrag.key, wert, rang: eintrag.rang };
    }
  };
  for (const eintrag of EINTRAEGE) {
    const w = eintrag.wort;
    // Mehrwort-Einträge („stand up paddle", „board games") über den ganzen Text. Sie schlagen
    // ihre Einzelwörter — „Board games" ist ein Brettspiel, kein Videospiel.
    if (w.length >= 6 && worte.length > 1 && zusammen.includes(w)) nimm(eintrag, 105);
    for (const t of worte) {
      if (t === w) { nimm(eintrag, 100); continue; }
      if (w.length < LAENGE_EXAKT) continue;
      // Mehrzahl, Wortstamm und Zusammensetzungen: Grill|abend, Kletter|halle, Beamer|s
      // Ein Wortteil zählt umso mehr, je mehr vom Text er abdeckt: „Grill|abend" ist ein
      // Grill, aber „Tischtenisp|latte" ist kein Latte macchiato.
      const deckung = w.length / t.length;
      if (t.length > w.length && (t.startsWith(w) || t.endsWith(w))) { nimm(eintrag, 70 + 20 * deckung); continue; }
      if (w.length >= 6 && t.includes(w)) { nimm(eintrag, 60 + 20 * deckung); continue; }
      const grenze = fehlerGrenze(w);
      if (!grenze || t[0] !== w[0] || t.length < LAENGE_EXAKT) {
        // Ende einer langen Zusammensetzung mit Tippfehler („Kinderschliten"). Nur für lange
        // Wörter — sonst würde „Schlüssel" über „…essel" zum Essen.
        if (w.length >= 7 && t.length >= w.length + 3) {
          const ende = t.slice(-w.length);
          if (abstand(ende, w, 1) <= 1) nimm(eintrag, 40);
        }
        continue;
      }
      const d = abstand(t, w, grenze);
      // Ein langes Wort mit Tippfehler, das den ganzen Text abdeckt, schlägt jeden Wortteil.
      if (d <= grenze) { nimm(eintrag, w.length >= 9 ? (d === 1 ? 88 : 76) : (d === 1 ? 60 : 50)); continue; }
      // Anfang einer Zusammensetzung mit Tippfehler („Kletterhale", „Grilabend")
      if (t.length > w.length + 2) {
        for (const teil of [t.slice(0, w.length), t.slice(0, w.length - 1), t.slice(0, w.length + 1)]) {
          if (abstand(teil, w, 1) <= 1) { nimm(eintrag, 45); break; }
        }
      }
    }
  }
  const key = bester ? bester.key : null;
  merker.set(n, key);
  return key;
}
