// Seed: Find — Beispielbestand (Runde 8, R8-50/R8-66) und Grundbestand (Runde 11, C2).
//
// Runde 11 (C2, Jonathan: „mit meinem Admin-Account sehe ich nicht die ganzen Empfehlungen durch den
// normalen Algorithmus. Das fehlt."): Auf dem Server stand bis hierher NUR, was das Admin-Konto
// angelegt hat (Tabelle find_eintraege, 0038) — wer angemeldet war, sah fast nichts. Jetzt gilt:
//   · findGrundbestand — was davon WAHR ist, gilt für alle, auch am Server: die echten Orte
//     (Restaurants, Erlebnisse; Name, Lage, Küche aus OpenStreetMap) und die Ideen für Zuhause.
//     Die Beispiel-Events (Zeiten sind erfunden) und die Beispiel-Tester-Bewertungen bleiben
//     draußen — für echte Menschen wären sie keine Auskunft (Hausregel 8).
//   · findBeispiele — der ganze Bestand für den Geräte-Datenweg (Demo), mit Events und Beispiel-Bewertungen.
//   · findMitGrundbestand — der Server-Datenweg legt den Grundbestand neben seine eigenen Einträge;
//     ein Eintrag des Admins zum selben Ort (gleiche Art, gleicher Titel) ersetzt den aus dem Grundbestand.
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

// Runde 11 (C2): Was vom Beispielbestand wahr ist — für den Server-Datenweg (siehe oben).
export function findGrundbestand(jetzt = new Date()) {
  return findBeispiele(jetzt)
    .filter((eintrag) => eintrag.art !== 'event')
    .map(({ testerBewertung, ...eintrag }) => { void testerBewertung; return eintrag; });
}

function gleicherName(text) {
  return String(text ?? '').toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/[^a-z0-9]+/g, ' ').trim();
}

// Eigene Einträge (Server) zuerst; aus dem Grundbestand kommt nur dazu, was es dort noch nicht gibt.
export function findMitGrundbestand(eigene = [], grund = []) {
  const ids = new Set(eigene.map((eintrag) => eintrag.id));
  const namen = new Set(eigene.map((eintrag) => `${eintrag.art}|${gleicherName(eintrag.titel)}`));
  return [...eigene, ...grund.filter((eintrag) => !ids.has(eintrag.id) && !namen.has(`${eintrag.art}|${gleicherName(eintrag.titel)}`))];
}
