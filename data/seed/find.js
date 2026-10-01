// Seed: Find — der Beispielbestand des Geräte-Datenwegs (Demo; Runde 8, R8-50/R8-66).
//
// Paket G2 (01.10.2026): Am Server kommt Find ganz aus den Algorithmen (Orte aus OpenStreetMap, Events, private
// Ideen — Edge Function `auswahl`, public.find_eintrag). Der frühere „Grundbestand" für angemeldete Konten
// (findGrundbestand/findMitGrundbestand neben den Einträgen des Admin-Kontos) ist entfallen — er wäre eine
// zweite Liste neben dem Algorithmus. Diese Datei füttert nur noch das Gerät:
//   · findBeispiele — die Vorlagen (Orte, Beispiel-Events, Beispiel-Tester-Bewertungen);
//   · findKandidaten — daraus der Bestand in der Zeilenform der Datenbank (unten).
//
// ORTE sind echt: Name und Lage aus OpenStreetMap (abgefragt am 19.09.2026 über Overpass,
// © OpenStreetMap-Mitwirkende, ODbL), bei Restaurants auch die Küche, wie sie dort eingetragen ist.
// Über diese Orte ist NICHTS erfunden — keine Preise, keine Öffnungszeiten, keine Namen von
// Künstlern oder Veranstaltern.
// EVENTS sind Beispiele der Art, wie sie an diesen Orten stattfinden (Konzert, Theaterabend,
// Führung). Ihre Zeiten liegen am laufenden bzw. kommenden Wochenende und am Wochenende danach;
// was vom laufenden Wochenende schon vorbei ist, rutscht auf einen späteren Tag desselben
// Wochenendes (siehe `wannAus`) — „Dieses Wochenende" ist so an jedem Wochentag gefüllt und nie
// schon vorbei.
// TESTER-BEWERTUNGEN sind als Beispiel gekennzeichnet: `beispiel: true`, und der Text beginnt mit
// „Beispiel:". Die Crew Scores des Geräte-Bestands sind Beispielwerte (siehe unten, CREW SCORE).
// Kein Eintrag ist gesponsert: eine Anzeige zu erfinden hieße, einem echten Lokal eine Zahlung
// anzudichten.
// Bilder stehen nur dort, wo sie im Projekt liegen (seed/fotos.js, web/assets/demo/HERKUNFT.md).
// `tags` sind deutsche Stichwörter für den Abgleich mit Interessen — Daten, keine Anzeigetexte.
import { t } from '../../core/sprache.js';
import { DEMO_FOTOS } from './fotos.js';
import { IDEEN_PRIVAT } from './ideen-privat.js';
import { ideeAlsKandidat } from '../auswahl-weg.js';

// Monate (Date.getMonth: 0 = Jänner), in denen ein Eintrag Sinn ergibt. Ohne Angabe: immer.
const SOMMER = [5, 6, 7, 8];
const SCHIFFSSAISON = [3, 4, 5, 6, 7, 8, 9];

// wann: [woche 0|1, tag 0=Fr 1=Sa 2=So, 'von', 'bis'] — liegt `bis` vor `von`, endet es nach Mitternacht.
function vorlagen() {
  return [
    // --- Events -------------------------------------------------------------------------------
    {
      id: 'f-kammgarn-konzert', titel: t('Konzert in der Kammgarn'), art: 'event',
      ort: { name: 'Kulturwerkstatt Kammgarn', lat: 47.49793, lon: 9.69309 },
      wann: [0, 0, '20:00', '23:00'], tags: ['konzert', 'musik', 'live'],
      testerBewertung: { note: 4.5, text: t('Beispiel: früh da sein lohnt sich, dann steht man vorne.'), beispiel: true },
    },
    {
      id: 'f-open-air-kino', titel: t('Open-Air-Kino am See'), art: 'event',
      ort: { name: 'Seepromenade Bregenz', lat: 47.50374, lon: 9.74039 },
      wann: [0, 0, '20:30', '23:00'], monate: SOMMER, tags: ['kino', 'film', 'draussen', 'see'],
    },
    {
      id: 'f-oberstadt-fuehrung', titel: t('Führung durch die Oberstadt'), art: 'event',
      ort: { name: 'Martinsturm Bregenz', lat: 47.50106, lon: 9.74926 },
      wann: [0, 1, '10:30', '12:00'], tags: ['stadt', 'geschichte', 'führung'],
    },
    {
      id: 'f-theater-kornmarkt', titel: t('Theaterabend am Kornmarkt'), art: 'event',
      ort: { name: 'Theater am Kornmarkt', lat: 47.50459, lon: 9.74724 },
      wann: [0, 1, '19:30', '22:00'], tags: ['theater', 'kultur'],
      testerBewertung: { note: 4, text: t('Beispiel: Karten vorher holen, danach noch auf ein Getränk in die Stadt.'), beispiel: true },
    },
    {
      id: 'f-poetry-slam', titel: t('Poetry Slam im Spielboden'), art: 'event',
      ort: { name: 'Spielboden Dornbirn', lat: 47.42221, lon: 9.73754 },
      wann: [1, 0, '20:00', '22:30'], tags: ['kultur', 'slam', 'ausgehen'],
    },
    {
      id: 'f-conrad-sohm', titel: t('Konzertnacht im Conrad Sohm'), art: 'event',
      ort: { name: 'Conrad Sohm', lat: 47.39386, lon: 9.7664 },
      // Der späte Abend gehört ans laufende Wochenende: so hat „Dieses Wochenende" auch am
      // späten Sonntagabend noch etwas zu zeigen (er endet erst nach Mitternacht).
      wann: [0, 1, '21:00', '01:00'], tags: ['konzert', 'musik', 'feiern'],
    },
    {
      id: 'f-museum-abend', titel: t('Abendführung im vorarlberg museum'), art: 'event',
      ort: { name: 'vorarlberg museum', lat: 47.50455, lon: 9.74666 },
      wann: [1, 1, '18:00', '19:30'], tags: ['museum', 'kultur', 'führung'],
    },
    {
      id: 'f-kub-gespraech', titel: t('Kunstgespräch im Kunsthaus'), art: 'event',
      ort: { name: 'Kunsthaus Bregenz', lat: 47.50499, lon: 9.7473 },
      wann: [1, 2, '11:00', '12:30'], tags: ['kunst', 'kultur'],
    },
    // --- Restaurants (Namen, Lage und Küche aus OpenStreetMap) ----------------------------------
    {
      id: 'f-wirtshaus-am-see', titel: 'Wirtshaus am See', art: 'restaurant',
      ort: { name: 'Wirtshaus am See', lat: 47.5048, lon: 9.74023 },
      tags: ['regional', 'see'],
      testerBewertung: { note: 4.5, text: t('Beispiel: an warmen Abenden draußen sitzen, mit Blick auf den See.'), beispiel: true },
    },
    {
      id: 'f-kornmesser', titel: 'Kornmesser', art: 'restaurant',
      ort: { name: 'Kornmesser', lat: 47.5048, lon: 9.74797 },
      tags: ['regional', 'historisch'],
    },
    {
      id: 'f-goldener-hirschen', titel: 'Goldener Hirschen', art: 'restaurant',
      ort: { name: 'Goldener Hirschen', lat: 47.50175, lon: 9.74694 },
      tags: ['regional', 'historisch'],
      testerBewertung: { note: 4, text: t('Beispiel: gemütliche Stube, gut für einen ruhigen Abend zu zweit.'), beispiel: true },
    },
    {
      id: 'f-gebhardsberg', titel: 'Burgrestaurant Gebhardsberg', art: 'restaurant',
      ort: { name: 'Burgrestaurant Gebhardsberg', lat: 47.49007, lon: 9.74704 },
      tags: ['regional', 'aussicht'],
    },
    {
      id: 'f-poseidon', titel: 'Poseidon', art: 'restaurant',
      ort: { name: 'Poseidon', lat: 47.50405, lon: 9.74758 },
      tags: ['griechisch'],
    },
    {
      id: 'f-sakura', titel: 'Sakura Sushi', art: 'restaurant',
      ort: { name: 'Sakura Sushi', lat: 47.50182, lon: 9.74794 },
      tags: ['sushi', 'asiatisch'],
    },
    // --- Erlebnisse -----------------------------------------------------------------------------
    {
      id: 'f-pfaender', titel: t('Mit der Bahn auf den Pfänder'), art: 'erlebnis',
      ort: { name: 'Pfänderbahn Talstation', lat: 47.50494, lon: 9.75306 },
      tags: ['aussicht', 'berg', 'draussen'],
      testerBewertung: { note: 5, text: t('Beispiel: am schönsten kurz vor Sonnenuntergang.'), beispiel: true },
    },
    {
      id: 'f-rappenloch', titel: 'Rappenlochschlucht', art: 'erlebnis',
      ort: { name: 'Rappenlochschlucht', lat: 47.38378, lon: 9.77948 },
      tags: ['wandern', 'natur', 'draussen'],
    },
    {
      id: 'f-kunsthaus', titel: 'Kunsthaus Bregenz', art: 'erlebnis',
      ort: { name: 'Kunsthaus Bregenz', lat: 47.50499, lon: 9.7473 },
      tags: ['kunst', 'museum'],
    },
    {
      id: 'f-schiff-lindau', titel: t('Mit dem Schiff nach Lindau'), art: 'erlebnis',
      ort: { name: 'Hafen Bregenz', lat: 47.50666, lon: 9.7476 },
      monate: SCHIFFSSAISON, tags: ['see', 'schiff', 'ausflug'],
    },
    {
      id: 'f-karren', titel: t('Mit der Seilbahn auf den Karren'), art: 'erlebnis',
      ort: { name: 'Karrenseilbahn Talstation', lat: 47.40046, lon: 9.75359 },
      tags: ['aussicht', 'berg'],
    },
    {
      id: 'f-inatura', titel: 'inatura', art: 'erlebnis',
      ort: { name: 'inatura Dornbirn', lat: 47.4091, lon: 9.73868 },
      tags: ['museum', 'natur'],
    },
    // --- Ideen fuer Zuhause (Runde 10) ----------------------------------------------------------
    // Privat, ohne Ausgehen: Vorschlaege, die eine Crew bei einem von euch macht. Sie haben keinen
    // Ort auf der Karte und keine Uhrzeit — beides waere erfunden (Hausregel 8). Der Ortsname sagt
    // nur, wo es stattfindet: zuhause. Erkannt werden sie am Stichwort `zuhause` (find-auswahl.js
    // › istZuhause), nicht an einer neuen Art — der Datenvertrag bleibt, wie er ist.
    {
      id: 'f-zh-brettspiele', titel: t('Brettspielabend'), art: 'erlebnis',
      ort: { name: t('Zuhause') }, tags: ['zuhause', 'brettspiele', 'drinnen', 'gesellig'],
    },
    {
      id: 'f-zh-filmabend', titel: t('Filmabend auf der Couch'), art: 'erlebnis',
      ort: { name: t('Zuhause') }, tags: ['zuhause', 'film', 'drinnen', 'gemuetlich'],
    },
    {
      id: 'f-zh-kochen', titel: t('Gemeinsam kochen'), art: 'erlebnis',
      ort: { name: t('Zuhause') }, tags: ['zuhause', 'kochen', 'essen', 'drinnen'],
    },
    {
      id: 'f-zh-pizza', titel: t('Pizza selber machen'), art: 'erlebnis',
      ort: { name: t('Zuhause') }, tags: ['zuhause', 'pizza', 'kochen', 'essen'],
    },
    {
      id: 'f-zh-konsole', titel: t('Spieleabend an der Konsole'), art: 'erlebnis',
      ort: { name: t('Zuhause') }, tags: ['zuhause', 'gaming', 'drinnen', 'gesellig'],
    },
    {
      id: 'f-zh-grillen', titel: t('Grillen im Garten'), art: 'erlebnis',
      ort: { name: t('Zuhause') }, tags: ['zuhause', 'grill', 'draussen', 'gesellig'],
    },
    {
      id: 'f-zh-quiz', titel: t('Quizabend zu Hause'), art: 'erlebnis',
      ort: { name: t('Zuhause') }, tags: ['zuhause', 'quiz', 'drinnen', 'gesellig'],
    },
    {
      id: 'f-zh-brunch', titel: t('Brunch am Sonntag'), art: 'erlebnis',
      ort: { name: t('Zuhause') }, tags: ['zuhause', 'brunch', 'essen', 'gemuetlich'],
    },
  ];
}

// Freitag des laufenden Wochenendes (heute Fr, Sa oder So) oder des nächsten — in Gerätezeit,
// über Jahr/Monat/Tag gerechnet (nie „+24 h", sonst verschiebt die Sommerzeit die Uhrzeiten).
export function wochenendFreitag(jetzt = new Date()) {
  const tag = jetzt.getDay(); // 0 = So … 6 = Sa
  const versatz = tag === 5 ? 0 : tag === 6 ? -1 : tag === 0 ? -2 : 5 - tag;
  return new Date(jetzt.getFullYear(), jetzt.getMonth(), jetzt.getDate() + versatz);
}

function zeitpunkt(freitag, woche, tag, hhmm) {
  const [stunde, minute] = String(hhmm).split(':').map(Number);
  return new Date(freitag.getFullYear(), freitag.getMonth(), freitag.getDate() + woche * 7 + tag, stunde, minute).getTime();
}

function zeitraum(freitag, woche, tag, von, bis) {
  const beginn = zeitpunkt(freitag, woche, tag, von);
  let ende = zeitpunkt(freitag, woche, tag, bis);
  if (ende <= beginn) ende = zeitpunkt(freitag, woche, tag + 1, bis);
  return { von: beginn, bis: ende };
}

// Das Wochenende, das die App gerade meint — dieselbe Rechnung wie in find-auswahl.js
// (`wochenende`): ab Freitag 17 Uhr, frühestens jetzt, bis Sonntag Mitternacht.
const WOCHENENDE_AB_STUNDE = 17;

function wochenendFenster(freitag, jetzt) {
  const ab = new Date(freitag.getFullYear(), freitag.getMonth(), freitag.getDate(), WOCHENENDE_AB_STUNDE).getTime();
  const bis = new Date(freitag.getFullYear(), freitag.getMonth(), freitag.getDate() + 2, 23, 59, 59, 999).getTime();
  return { von: Math.max(ab, jetzt.getTime()), bis };
}

// Runde 9b (gefunden an einem Sonntag): Ein Beispiel-Termin des laufenden Wochenendes, der schon
// vorbei ist, verschwand einfach — am Sonntag lagen Freitag und Samstag hinter uns und die Reihe
// „Dieses Wochenende" war leer. Ein solcher Termin rutscht jetzt auf einen SPÄTEREN Tag desselben
// Wochenendes, zur gleichen Uhrzeit. Dadurch ist die Reihe an jedem Wochentag gefüllt und
// behauptet trotzdem nie einen Termin, der schon gelaufen ist. Ist vom Wochenende nichts mehr
// übrig, steht der Termin am Wochenende darauf.
function wannAus(freitag, [woche, tag, von, bis], jetzt) {
  const termin = zeitraum(freitag, woche, tag, von, bis);
  if (woche !== 0 || termin.bis > jetzt.getTime()) return termin;
  const fenster = wochenendFenster(freitag, jetzt);
  for (let spaeter = tag + 1; spaeter <= 2; spaeter += 1) {
    const verschoben = zeitraum(freitag, 0, spaeter, von, bis);
    // Überschneidung mit dem Fenster genügt — ein Abend, der gerade läuft, ist nicht vorbei.
    if (verschoben.bis > jetzt.getTime() && verschoben.bis >= fenster.von && verschoben.von <= fenster.bis) return verschoben;
  }
  return zeitraum(freitag, 1, tag, von, bis);
}

// Der Beispielbestand für einen Zeitpunkt — die Zeiten der Events hängen am Wochenende von `jetzt`.
export function findBeispiele(jetzt = new Date()) {
  const freitag = wochenendFreitag(jetzt);
  const monat = jetzt.getMonth();
  return vorlagen()
    .filter((vorlage) => !vorlage.monate || vorlage.monate.includes(monat))
    .map(({ wann, monate, ...eintrag }) => {
      const foto = DEMO_FOTOS[eintrag.id];
      return {
        ...eintrag,
        ...(wann ? { wann: wannAus(freitag, wann, jetzt) } : {}),
        ...(foto?.pfad ? { bild: foto.pfad, bildUrheber: foto.urheber || null, bildSeite: foto.seite || null } : {}),
        gesponsert: false,
      };
    });
}

// Runde 8: ein Eintrag ist im Beispielbestand schon gemerkt — sonst wäre „Gemerkt" beim ersten
// Blick leer und die Funktion nicht zu sehen.
export const FIND_GEMERKT_BEISPIEL = ['f-rappenloch'];

// =============================================================================================
// Algorithmus 2 im Gerät (Paket G1): der Kandidaten-Bestand des Demo-Datenwegs
// =============================================================================================
// Der Server holt seine Kandidaten aus public.crew_auswahl_kandidaten (0058). Das Gerät hat keine
// Datenbank — es rechnet mit DERSELBEN Datei (web/data/auswahl-regeln.js) auf diesem Bestand, in
// genau der Zeilenform der Datenbank-Funktion (snake_case, eine Zeile je Eintrag). So gibt es über
// „was passt zu mir" keine zweite Wahrheit, nur einen zweiten, kleineren Bestand.
//
// Was hier steht:
//   · die Orte und Beispiel-Events von oben (Namen und Lage aus OpenStreetMap, Zeiten Beispiele);
//   · wenige weitere echte Orte aus OpenStreetMap (Name, Lage, Adresse wie dort eingetragen, abgefragt
//     am 28.09.2026 über die Prüfwelt, © OpenStreetMap-Mitwirkende, ODbL), damit „Für dich" für
//     verschiedene Interessen sichtbar verschieden wird — vorher gab es keine Bar, keinen Club, kein
//     Kino und keine Kletterhalle;
//   · die 80 privaten Ideen (seed/ideen-privat.js, Paket D) — die Ideen für zuhause von oben
//     (f-zh-…) gehen darin auf und stehen hier nicht doppelt.
// Art, Stil und die 12 Merkmale sind die Startwerte der Klassifizierung (Paket A,
// konfig-klassifizieren.js › MERKMALE_STANDARD) — dieselben Zahlen, die der Server für diese Art
// benutzt. Öffnungszeiten stehen KEINE da: erfundene Zeiten an echten Orten wären eine falsche
// Auskunft (Hausregel 8); die Auswahl sagt dann ehrlich „Öffnungszeiten unbekannt".
//
// CREW SCORE: Die App rechnet keinen Crew Score (PLAN §0.4). Die Zahlen hier sind BEISPIELE — jeder
// Grund beginnt mit „Beispiel:" (wie die Tester-Bewertungen oben), und der Datenweg kennzeichnet die
// Einträge mit `scoreBeispiel: true`.

const M = {
  // Restaurant: der Stil ist die Küche; alle Küchen starten bei denselben Merkmalen (konfig-klassifizieren.js).
  'restaurant·regional': [0.45, 0.30, 0.45, 0.45, 0.05, 0.25, 0.50, 0.05, 0.55, 0.15, 0.05, 0.05],
  'restaurant·griechisch': [0.45, 0.30, 0.45, 0.45, 0.05, 0.25, 0.50, 0.05, 0.55, 0.15, 0.05, 0.05],
  'restaurant·japanisch': [0.45, 0.30, 0.45, 0.45, 0.05, 0.37, 0.50, 0.05, 0.55, 0.15, 0.05, 0.05],
  // „gehoben" ist eine Korrektur (Name/Tags), kein Stil mehr — so wie sie die Klassifizierung rechnet.
  'restaurant·regional·gehoben': [0.45, 0.30, 0.80, 0.75, 0.05, 0.45, 0.35, 0.05, 0.55, 0.30, 0.05, 0.05],
  'cafe·cafe': [0.35, 0.30, 0.30, 0.15, 0.05, 0.25, 0.30, 0.25, 0.15, 0.15, 0.05, 0.05],
  'bar·cocktail': [0.65, 0.25, 0.60, 0.30, 0.05, 0.40, 0.50, 0.60, 0.95, 0.10, 0.10, 0.05],
  'club·club': [0.95, 0.10, 0.50, 0.35, 0.70, 0.40, 0.80, 0.90, 0.90, 0.10, 0.15, 0.20],
  'kino·programmkino': [0.30, 0.00, 0.35, 0.55, 0.00, 0.60, 0.35, 0.90, 0.20, 0.60, 0.00, 0.00],
  'kino·multiplex': [0.40, 0.00, 0.40, 0.55, 0.00, 0.30, 0.50, 0.85, 0.10, 0.20, 0.00, 0.00],
  'buehne·theater': [0.35, 0.05, 0.60, 0.85, 0.00, 0.60, 0.40, 0.90, 0.20, 0.90, 0.00, 0.05],
  'museum·museum': [0.15, 0.10, 0.35, 0.35, 0.20, 0.50, 0.30, 0.95, 0.00, 1.00, 0.00, 0.10],
  'museum·galerie': [0.10, 0.05, 0.25, 0.25, 0.15, 0.65, 0.20, 0.95, 0.05, 0.95, 0.00, 0.15],
  'museum·erlebnismuseum': [0.40, 0.20, 0.45, 0.35, 0.35, 0.55, 0.50, 0.95, 0.00, 0.75, 0.20, 0.30],
  'bad·strandbad': [0.45, 1.00, 0.10, 0.05, 0.55, 0.15, 0.60, 0.90, 0.15, 0.00, 0.10, 0.00],
  'fitness·kletterhalle': [0.45, 0.00, 0.35, 0.30, 0.95, 0.40, 0.40, 1.00, 0.05, 0.05, 0.40, 0.10],
  'aktiv_spass·bowling': [0.70, 0.00, 0.40, 0.45, 0.40, 0.25, 0.70, 0.85, 0.55, 0.00, 0.85, 0.00],
  'aktiv_spass·escape': [0.45, 0.00, 0.55, 0.85, 0.35, 0.70, 0.45, 1.00, 0.00, 0.15, 0.70, 0.35],
  'natur·aussicht': [0.10, 1.00, 0.00, 0.10, 0.35, 0.35, 0.35, 0.90, 0.10, 0.25, 0.00, 0.05],
  'natur·park': [0.20, 1.00, 0.00, 0.05, 0.25, 0.15, 0.50, 0.80, 0.15, 0.10, 0.05, 0.05],
  'natur·wasserfall': [0.30, 1.00, 0.00, 0.25, 0.50, 0.45, 0.35, 0.95, 0.00, 0.30, 0.00, 0.00],
  'natur·tierpark': [0.35, 0.95, 0.20, 0.30, 0.40, 0.35, 0.50, 0.95, 0.00, 0.50, 0.00, 0.00],
  'wandern·gipfel': [0.05, 1.00, 0.00, 0.55, 0.95, 0.40, 0.35, 1.00, 0.10, 0.15, 0.30, 0.00],
  'klettern·fels': [0.15, 1.00, 0.10, 0.70, 1.00, 0.50, 0.30, 1.00, 0.00, 0.05, 0.50, 0.10],
  // Events (Paket F, events-konfig.js › Merkmale je Event-Art)
  konzert: [0.8, 0.3, 0.6, 0.8, 0.3, 0.5, 0.7, 0.6, 0.6, 0.6, 0.1, 0.1],
  kultur: [0.2, 0.2, 0.5, 0.8, 0.1, 0.6, 0.5, 0.7, 0.3, 0.95, 0.05, 0.2],
};

// Die Einträge von oben: Art, Stil, Beispiel-Score, Touristen-Wert (0–1), bei Events der Ort.
const ZU_BEISPIELEN = {
  'f-wirtshaus-am-see': { art: 'restaurant', stil: 'regional', score: 84, touristen: 0.3 },
  'f-kornmesser': { art: 'restaurant', stil: 'regional', score: 88, touristen: 0.35 },
  'f-goldener-hirschen': { art: 'restaurant', stil: 'regional', score: 79, touristen: 0.3 },
  'f-gebhardsberg': { art: 'restaurant', stil: 'regional', merkmaleSchluessel: 'restaurant·regional·gehoben', score: 82, touristen: 0.5 },
  'f-poseidon': { art: 'restaurant', stil: 'griechisch', score: 74, touristen: 0.1 },
  'f-sakura': { art: 'restaurant', stil: 'japanisch', score: 76, touristen: 0.1 },
  'f-pfaender': { art: 'natur', stil: 'aussicht', score: 93, touristen: 0.9 },
  'f-rappenloch': { art: 'natur', stil: 'wasserfall', score: 91, touristen: 0.85 },
  'f-kunsthaus': { art: 'museum', stil: 'museum', score: 93, touristen: 0.7 },
  'f-schiff-lindau': { art: 'natur', stil: 'aussicht', score: 86, touristen: 0.9 },
  'f-karren': { art: 'natur', stil: 'aussicht', score: 90, touristen: 0.8 },
  'f-inatura': { art: 'museum', stil: 'erlebnismuseum', score: 89, touristen: 0.6 },
  'f-kammgarn-konzert': { art: 'konzert', stil: null, score: 81, touristen: 0.35 },
  'f-open-air-kino': { art: 'kultur', stil: null, score: 84, touristen: 0.4 },
  'f-oberstadt-fuehrung': { art: 'kultur', stil: null, score: 78, touristen: 0.6, ort: 'f-martinsturm' },
  'f-theater-kornmarkt': { art: 'kultur', stil: null, score: 85, touristen: 0.35, ort: 'f-landestheater' },
  'f-poetry-slam': { art: 'kultur', stil: 'lesung', score: 76, touristen: 0.2 },
  'f-conrad-sohm': { art: 'konzert', stil: null, score: 82, touristen: 0.2 },
  'f-museum-abend': { art: 'kultur', stil: null, score: 80, touristen: 0.4 },
  'f-kub-gespraech': { art: 'kultur', stil: 'ausstellung', score: 77, touristen: 0.45, ort: 'f-kunsthaus' },
};

// Weitere echte Orte aus OpenStreetMap (Name, Lage und Adresse wie dort eingetragen).
const WEITERE_ORTE = [
  { id: 'f-miles-diner', name: 'Mile’s Diner', art: 'bar', stil: 'cocktail', lat: 47.50398, lon: 9.74582, adresse: 'Inselstraße 5, Bregenz', score: 90, touristen: 0.08 },
  { id: 'f-cuba', name: 'Cuba', art: 'bar', stil: 'cocktail', lat: 47.50416, lon: 9.74536, adresse: 'Bahnhofstraße 6, Bregenz', score: 78, touristen: 0.08 },
  // „Neu" (ALGORITHMUS §2.5): noch kein Crew Score, mit dem Grund wie in public.scores.neu_grund (0057) — über
  // diesen Ort weiß auch der Beispielbestand fast nichts (keine Adresse, keine Öffnungszeiten).
  { id: 'f-beach-bar', name: 'Beach Bar Bregenz', art: 'bar', stil: 'cocktail', lat: 47.50382, lon: 9.74049, neu: true, neuGrund: 'wenig_daten', touristen: 0.15 },
  { id: 'f-club-blue', name: 'Club Blue', art: 'club', stil: 'club', lat: 47.46429, lon: 9.7223, adresse: 'Scheibenstraße 25, Lauterach', score: 77, touristen: 0.05, minAlter: 18 },
  { id: 'f-metro-kino', name: 'Metro Kino', art: 'kino', stil: 'programmkino', lat: 47.49702, lon: 9.7282, adresse: 'Rheinstraße 25, Bregenz', score: 86, touristen: 0.25 },
  { id: 'f-cineplexx', name: 'Cineplexx Lauterach', art: 'kino', stil: 'multiplex', lat: 47.46426, lon: 9.72218, adresse: 'Scheibenstraße 25, Lauterach', score: 75, touristen: 0.2 },
  { id: 'f-landestheater', name: 'Vorarlberger Landestheater', art: 'buehne', stil: 'theater', lat: 47.50471, lon: 9.74701, adresse: 'Seestraße 2, Bregenz', score: 87, touristen: 0.3 },
  { id: 'f-martinsturm', name: 'Martinsturm Bregenz', art: 'museum', stil: 'museum', lat: 47.50106, lon: 9.74926, adresse: 'Martinsgasse 3b, Bregenz', score: 81, touristen: 0.7 },
  { id: 'f-kuenstlerhaus', name: 'Künstlerhaus – Palais Thurn und Taxis', art: 'museum', stil: 'galerie', lat: 47.49943, lon: 9.74458, adresse: 'Gallusstraße 10, Bregenz', score: 84, touristen: 0.5 },
  { id: 'f-museumscafe', name: 'Museumscafé', art: 'cafe', stil: 'cafe', lat: 47.50435, lon: 9.7466, adresse: 'Kornmarktplatz 1, Bregenz', score: 89, touristen: 0.1 },
  { id: 'f-cafe-goetze', name: 'Café Götze', art: 'cafe', stil: 'cafe', lat: 47.50269, lon: 9.74645, adresse: 'Kaiserstraße 9, Bregenz', score: 83, touristen: 0.1 },
  { id: 'f-seebad', name: 'Seebad Bregenz', art: 'bad', stil: 'strandbad', lat: 47.50488, lon: 9.73559, score: 88, touristen: 0.1 },
  { id: 'f-thurn-taxis-park', name: 'Thurn-und-Taxis-Park', art: 'natur', stil: 'park', lat: 47.49962, lon: 9.74407, score: 85, touristen: 0.5 },
  { id: 'f-alpenwildpark', name: 'Alpenwildpark Pfänder', art: 'natur', stil: 'tierpark', lat: 47.50659, lon: 9.7789, score: 92, touristen: 0.8 },
  { id: 'f-kanzele', name: 'Känzele', art: 'klettern', stil: 'fels', lat: 47.48848, lon: 9.75604, score: 80, touristen: 0.2 },
  { id: 'f-k1', name: 'Kletterhalle K1', art: 'fitness', stil: 'kletterhalle', lat: 47.41881, lon: 9.74051, adresse: 'Färbergasse 1, Dornbirn', score: 87, touristen: 0.1 },
  { id: 'f-strike-center', name: 'Strike Center Lauterach', art: 'aktiv_spass', stil: 'bowling', lat: 47.4642, lon: 9.72224, adresse: 'Scheibenstraße 25, Lauterach', score: 82, touristen: 0.15 },
  { id: 'f-reality-escape', name: 'Reality Escape', art: 'aktiv_spass', stil: 'escape', lat: 47.50048, lon: 9.74697, score: 79, touristen: 0.15 },
];

// Jeder Beispiel-Score trägt genau einen Grund — und der sagt, dass er ein Beispiel ist.
function beispielGruende(score) {
  return [{ grund: 'erlebnis', wert: score, text: t('Beispiel: In der Demo ist der Crew Score ein fester Beispielwert.'), beispiel: true }];
}

function ortZeile(o) {
  const aktivitaet = `${o.art}·${o.stil || 'ohne'}`;
  return {
    eintrag_typ: 'ort', id: o.id, name: o.name, art: o.art, stil: o.stil || null, aktivitaet,
    lat: o.lat, lon: o.lon, adresse: o.adresse || null, land: 'AT',
    merkmale: M[o.merkmaleSchluessel || aktivitaet] || null, touristen_wert: o.touristen ?? null, min_alter: o.minAlter ?? null,
    // Küche (Restaurant-Stil) und Treffpunkt-Eignung wie die Klassifizierung (im Beispielbestand gibt es keinen Imbiss).
    kueche: o.art === 'restaurant' && o.stil && o.stil !== 'sonstige' ? o.stil : null, treffpunkt: o.treffpunkt ?? 1,
    oeffnungszeiten_osm: null, beginn: null, ende: null, ort_id: null,
    crew_score: o.neu ? null : o.score, neu: o.neu === true, neu_grund: o.neu ? o.neuGrund || null : null,
    freigegeben: true, gruende: o.neu ? [] : beispielGruende(o.score),
    bild: o.bild || null, bild_seite: o.bildSeite || null, bild_urheber: o.bildUrheber || null,
    beschreibung: null, tags: o.tags || [],
  };
}

// Der ganze Bestand für einen Zeitpunkt (die Beispiel-Events hängen am Wochenende von `jetzt`).
// → Zeilen in der Form von crew_auswahl_kandidaten (ohne entfernung_km/ring/grobrang — die rechnet
//   das Modul selbst).
export function findKandidaten(jetzt = new Date()) {
  const zeilen = [];
  for (const e of findBeispiele(jetzt)) {
    const zu = ZU_BEISPIELEN[e.id];
    if (!zu) continue; // Ideen für zuhause: stehen als private Ideen (Paket D) weiter unten
    if (e.art === 'event') {
      zeilen.push({
        eintrag_typ: 'event', id: e.id, name: e.titel, art: zu.art, stil: zu.stil,
        aktivitaet: `${zu.art}·${zu.stil || 'ohne'}`,
        lat: e.ort.lat, lon: e.ort.lon, adresse: e.ort.name, land: 'AT',
        merkmale: M[zu.art], touristen_wert: zu.touristen, min_alter: null, oeffnungszeiten_osm: null,
        beginn: e.wann.von, ende: e.wann.bis, ort_id: zu.ort || null,
        crew_score: zu.score, neu: false, neu_grund: null, freigegeben: true, gruende: beispielGruende(zu.score),
        bild: e.bild || null, bild_seite: e.bildSeite || null, bild_urheber: e.bildUrheber || null,
        beschreibung: null, tags: e.tags || [],
      });
    } else {
      zeilen.push(ortZeile({
        id: e.id, name: e.titel, art: zu.art, stil: zu.stil, merkmaleSchluessel: zu.merkmaleSchluessel, lat: e.ort.lat, lon: e.ort.lon,
        adresse: e.ort.name !== e.titel ? e.ort.name : null, score: zu.score, touristen: zu.touristen,
        bild: e.bild, bildSeite: e.bildSeite, bildUrheber: e.bildUrheber, tags: e.tags,
      }));
    }
  }
  for (const o of WEITERE_ORTE) zeilen.push(ortZeile(o));
  // Die Ideen in derselben Form wie am Server (auswahl-weg.js › ideeAlsKandidat).
  for (const i of IDEEN_PRIVAT) zeilen.push(ideeAlsKandidat(i));
  return zeilen;
}

// Die Tester-Bewertungen des Beispielbestands (als Beispiel gekennzeichnet) — der Datenweg legt sie
// neben den Eintrag, sie fließen nirgends ein.
export function findTesterBewertungen(jetzt = new Date()) {
  return Object.fromEntries(findBeispiele(jetzt).filter((e) => e.testerBewertung).map((e) => [e.id, { ...e.testerBewertung }]));
}
