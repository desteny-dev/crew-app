// Seed: Find — Beispielbestand (Runde 8, R8-50/R8-66). Nur für den Geräte-Datenweg (Demo); auf dem
// Server legt ausschließlich das Admin-Konto Einträge an (Tabelle find_eintraege, 0038) — dort
// steht nichts aus dieser Datei, denn Beispiele sind für echte Menschen keine Auskunft.
//
// ORTE sind echt: Name und Lage aus OpenStreetMap (abgefragt am 19.09.2026 über Overpass,
// © OpenStreetMap-Mitwirkende, ODbL), bei Restaurants auch die Küche, wie sie dort eingetragen ist.
// Über diese Orte ist NICHTS erfunden — keine Preise, keine Öffnungszeiten, keine Namen von
// Künstlern oder Veranstaltern.
// EVENTS sind Beispiele der Art, wie sie an diesen Orten stattfinden (Konzert, Theaterabend,
// Führung). Ihre Zeiten liegen am laufenden bzw. kommenden Wochenende und am Wochenende danach —
// „Dieses Wochenende" ist so nie leer und nie schon vorbei.
// TESTER-BEWERTUNGEN sind als Beispiel gekennzeichnet: `beispiel: true`, und der Text beginnt mit
// „Beispiel:". Einen Score gibt es hier nicht — er wird gerechnet (projections.js findScore).
// Kein Eintrag ist gesponsert: eine Anzeige zu erfinden hieße, einem echten Lokal eine Zahlung
// anzudichten.
// Bilder stehen nur dort, wo sie im Projekt liegen (seed/fotos.js, web/assets/demo/HERKUNFT.md).
// `tags` sind deutsche Stichwörter für den Abgleich mit Interessen — Daten, keine Anzeigetexte.
import { t } from '../../core/sprache.js';
import { DEMO_FOTOS } from './fotos.js';

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
      wann: [1, 1, '21:00', '01:00'], tags: ['konzert', 'musik', 'feiern'],
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

function wannAus(freitag, [woche, tag, von, bis]) {
  const beginn = zeitpunkt(freitag, woche, tag, von);
  let ende = zeitpunkt(freitag, woche, tag, bis);
  if (ende <= beginn) ende = zeitpunkt(freitag, woche, tag + 1, bis);
  return { von: beginn, bis: ende };
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
        ...(wann ? { wann: wannAus(freitag, wann) } : {}),
        ...(foto?.pfad ? { bild: foto.pfad, bildUrheber: foto.urheber || null, bildSeite: foto.seite || null } : {}),
        gesponsert: false,
      };
    });
}

// Runde 8: ein Eintrag ist im Beispielbestand schon gemerkt — sonst wäre „Gemerkt" beim ersten
// Blick leer und die Funktion nicht zu sehen.
export const FIND_GEMERKT_BEISPIEL = ['f-rappenloch'];
