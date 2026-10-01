// Private Ideen (ALGORITHMUS.md §2.9, ZUSATZ §4, Paket D „Ideen"): rund 80 Vorschläge, die man
// selbst mit Freunden macht — kein Ort auf der Karte, keine Uhrzeit, kein Score. Erscheinen nur
// unter „Privat" oder wenn die Absicht es nahelegt. Das LLM (dieser Baustein) erzeugt die Ideen;
// ein Mensch gibt nichts frei (ZUSATZ §4) — die automatische Prüfung `ideenPruefen` IST die
// Freigabe: nur `pruefung.ok === true` kommt in die App (Tabelle `ideen_privat`, Spalte
// `pruefung jsonb`, Migration 0059).
//
// Reihenfolge der 12 Merkmale exakt wie ALGORITHMUS.md §3.2 (0 = links, 1 = rechts):
//   0 ruhig↔laut · 1 drinnen↔draußen · 2 günstig↔teuer · 3 spontan↔geplant ·
//   4 sitzend↔körperlich aktiv · 5 vertraut↔neu/ungewöhnlich · 6 kleine Runde↔große Gruppe ·
//   7 Essen im Mittelpunkt↔Tun im Mittelpunkt · 8 ohne Alkohol↔mit Alkohol ·
//   9 Unterhaltung↔Kultur/Bildung · 10 entspannt↔Wettkampf/Spiel · 11 konsumieren↔selbst kreativ
//
// Hausregel 8: nichts erfunden, was wie eine echte Angabe aussieht — jede Idee ist ein
// allgemeines, selbst gemachtes Vorhaben ohne erfundenen Ort, ohne erfundene Öffnungszeit, ohne
// erfundenen Namen einer echten Stelle. Hausregel 9: keine ab-18-Schwerpunkte, kein Alkohol im
// Mittelpunkt — `ideenPruefen` erzwingt das automatisch (§4: „passt zu 16+").
//
// `tags` sind deutsche Stichwörter für den Abgleich mit Interessen (wie web/data/seed/find.js)
// — Daten für die App-Anzeige/den Abgleich, keine Anzeigetexte, deshalb nicht über t().
import { t } from '../../core/sprache.js';

export const ALLE_JAHRESZEITEN = ['fruehling', 'sommer', 'herbst', 'winter'];

const FRUEHSOMMERHERBST = ['fruehling', 'sommer', 'herbst'];

// Ein Eintrag in genau der Feldreihenfolge der Tabelle `ideen_privat` (0055/0059), plus `tags`.
function idee(id, name, beschreibung, personenMin, personenMax, dauerMin, kostenPp, draussen, wetterAbhaengig, jahreszeiten, vorbereitungMin, merkmale, tags, minAlter = 0) {
  return {
    id,
    name,
    beschreibung,
    aktivitaet: `idee·${id}`,
    personen_min: personenMin,
    personen_max: personenMax,
    dauer_min: dauerMin,
    kosten_pp: kostenPp,
    draussen,
    wetter_abhaengig: wetterAbhaengig,
    jahreszeiten,
    vorbereitung_min: vorbereitungMin,
    merkmale,
    min_alter: minAlter,
    tags,
  };
}

export const IDEEN_PRIVAT = [
  // --- Essen & Kochen -------------------------------------------------------------------------
  idee('kochabend-international', t('Kochabend international'), t('Gemeinsam ein Gericht aus einem anderen Land kochen und zusammen essen.'),
    2, 8, 150, 12, 0, false, ALLE_JAHRESZEITEN, 20,
    [0.3, 0, 0.4, 0.6, 0.3, 0.5, 0.5, 0.1, 0.1, 0.3, 0.2, 0.8], ['kochen', 'essen', 'drinnen', 'gesellig']),
  idee('pizza-selber-backen', t('Pizza selber backen'), t('Teig kneten, belegen und gemeinsam im Ofen backen.'),
    2, 10, 120, 6, 0, false, ALLE_JAHRESZEITEN, 15,
    [0.4, 0, 0.2, 0.5, 0.3, 0.2, 0.6, 0.2, 0.05, 0.2, 0.2, 0.8], ['kochen', 'pizza', 'essen', 'drinnen']),
  idee('grillfest-garten', t('Grillfest im Garten'), t('Grillen, plaudern und den Abend im Freien ausklingen lassen.'),
    4, 15, 180, 10, 1, true, ['sommer'], 30,
    [0.6, 1, 0.3, 0.5, 0.3, 0.1, 0.7, 0.4, 0.2, 0.1, 0.4, 0.2], ['grillen', 'garten', 'draussen', 'sommer', 'gesellig']),
  idee('ausgiebiger-sonntagsbrunch', t('Ausgiebiger Sonntagsbrunch'), t('Zusammen ein großes Frühstück vorbereiten und in Ruhe genießen.'),
    2, 10, 150, 9, 0, false, ALLE_JAHRESZEITEN, 30,
    [0.3, 0, 0.3, 0.6, 0.2, 0.1, 0.5, 0.1, 0.1, 0.1, 0.1, 0.5], ['brunch', 'essen', 'drinnen', 'gemuetlich']),
  idee('backwettbewerb-daheim', t('Backwettbewerb daheim'), t('Jeder backt etwas und am Ende wird gemeinsam verkostet.'),
    3, 8, 180, 8, 0, false, ALLE_JAHRESZEITEN, 20,
    [0.4, 0, 0.3, 0.6, 0.3, 0.4, 0.5, 0.2, 0.05, 0.1, 0.6, 0.9], ['backen', 'wettbewerb', 'drinnen', 'essen']),
  idee('fondue-abend', t('Fondue-Abend'), t('Käse- oder Schokofondue und ein gemütlicher Abend zu mehreren.'),
    2, 8, 120, 12, 0, false, ['herbst', 'winter'], 20,
    [0.3, 0, 0.4, 0.6, 0.1, 0.2, 0.4, 0.2, 0.1, 0.1, 0.1, 0.4], ['fondue', 'essen', 'drinnen', 'gemuetlich', 'winter']),
  idee('picknick-im-park', t('Picknick im Park'), t('Decke ausbreiten, Essen mitbringen und einen entspannten Nachmittag draußen verbringen.'),
    2, 12, 120, 5, 1, true, FRUEHSOMMERHERBST, 20,
    [0.3, 1, 0.15, 0.5, 0.2, 0.1, 0.6, 0.4, 0.1, 0.1, 0.1, 0.2], ['picknick', 'park', 'draussen', 'essen']),
  idee('grillen-am-see', t('Grillen am See'), t('Mit Grillzeug an einen See fahren und dort gemeinsam kochen.'),
    3, 12, 180, 12, 1, true, ['sommer'], 40,
    [0.5, 1, 0.35, 0.6, 0.3, 0.2, 0.6, 0.4, 0.2, 0.1, 0.3, 0.2], ['grillen', 'see', 'draussen', 'sommer']),
  idee('streetfood-erkundung', t('Streetfood-Erkundung'), t('Zu Fuß verschiedene Imbissstände ausprobieren und sich das Essen teilen.'),
    2, 8, 150, 15, 1, true, FRUEHSOMMERHERBST, 10,
    [0.6, 0.8, 0.4, 0.3, 0.5, 0.6, 0.5, 0.6, 0.1, 0.2, 0.1, 0.1], ['streetfood', 'essen', 'draussen', 'ausflug']),
  idee('mocktail-werkstatt', t('Mocktail-Werkstatt'), t('Alkoholfreie Cocktails mixen und neue Rezepte ausprobieren.'),
    2, 8, 90, 8, 0, false, ALLE_JAHRESZEITEN, 15,
    [0.4, 0, 0.25, 0.5, 0.2, 0.5, 0.5, 0.3, 0.05, 0.1, 0.2, 0.8], ['mocktail', 'alkoholfrei', 'drinnen', 'kreativ']),

  // --- Draußen & Natur -------------------------------------------------------------------------
  idee('wanderung-in-der-region', t('Wanderung in der Region'), t('Eine Route in der Umgebung aussuchen und gemeinsam loswandern.'),
    1, 10, 180, 0, 1, true, FRUEHSOMMERHERBST, 20,
    [0.2, 1, 0.05, 0.5, 0.8, 0.2, 0.5, 0.4, 0.05, 0.1, 0.2, 0.1], ['wandern', 'natur', 'draussen', 'bewegung']),
  idee('radtour-ins-gruene', t('Radtour ins Grüne'), t('Mit dem Fahrrad eine Strecke ins Umland fahren und unterwegs Pause machen.'),
    1, 8, 150, 0, 1, true, FRUEHSOMMERHERBST, 15,
    [0.3, 1, 0.05, 0.4, 0.8, 0.2, 0.4, 0.4, 0.05, 0.1, 0.2, 0.1], ['rad', 'draussen', 'bewegung', 'ausflug']),
  idee('sonnenaufgang-schauen', t('Sonnenaufgang schauen'), t('Früh aufstehen und gemeinsam den Sonnenaufgang an einem schönen Platz erleben.'),
    1, 6, 90, 0, 1, true, ALLE_JAHRESZEITEN, 10,
    [0.1, 1, 0, 0.5, 0.2, 0.3, 0.3, 0.1, 0.05, 0.1, 0.05, 0.1], ['sonnenaufgang', 'draussen', 'ruhe']),
  idee('sternenhimmel-beobachten', t('Sternenhimmel beobachten'), t('An einem dunklen Ort eine Decke ausbreiten und die Sterne betrachten.'),
    1, 8, 120, 0, 1, true, ALLE_JAHRESZEITEN, 15,
    [0.1, 1, 0, 0.4, 0.1, 0.3, 0.4, 0.1, 0.05, 0.3, 0.05, 0.1], ['sterne', 'draussen', 'nacht', 'ruhe']),
  idee('strandtag-am-see', t('Strandtag am See'), t('Einen Tag am Ufer verbringen, schwimmen und in der Sonne liegen.'),
    2, 12, 240, 3, 1, true, ['sommer'], 15,
    [0.4, 1, 0.1, 0.4, 0.4, 0.1, 0.6, 0.3, 0.1, 0.05, 0.2, 0.1], ['see', 'strand', 'draussen', 'sommer']),
  idee('lagerfeuerabend', t('Lagerfeuerabend'), t('Ein Feuer machen, Stockbrot backen und bis spät draußen sitzen.'),
    3, 12, 180, 5, 1, true, ['sommer', 'herbst'], 30,
    [0.4, 1, 0.15, 0.5, 0.2, 0.2, 0.6, 0.3, 0.15, 0.1, 0.1, 0.2], ['lagerfeuer', 'draussen', 'abend', 'gesellig']),
  idee('drachen-steigen-lassen', t('Drachen steigen lassen'), t('An einem windigen Tag gemeinsam Drachen fliegen lassen.'),
    1, 8, 90, 0, 1, true, ['fruehling', 'herbst'], 10,
    [0.3, 1, 0.05, 0.4, 0.5, 0.2, 0.4, 0.3, 0.02, 0.1, 0.3, 0.2], ['drachen', 'draussen', 'wind', 'spiel']),
  idee('achtsamer-waldspaziergang', t('Achtsamer Waldspaziergang'), t('Langsam durch den Wald gehen und bewusst die Umgebung wahrnehmen.'),
    1, 6, 90, 0, 1, true, ALLE_JAHRESZEITEN, 5,
    [0.1, 1, 0, 0.3, 0.4, 0.2, 0.3, 0.1, 0.02, 0.1, 0.05, 0.1], ['wald', 'natur', 'draussen', 'ruhe']),
  idee('beeren-und-pilze-sammeln', t('Beeren und Pilze sammeln'), t('Im Wald oder auf der Wiese Beeren oder Pilze suchen und mitnehmen.'),
    1, 6, 120, 0, 1, true, ['sommer', 'herbst'], 10,
    [0.2, 1, 0, 0.4, 0.5, 0.3, 0.4, 0.3, 0.02, 0.2, 0.1, 0.2], ['sammeln', 'natur', 'draussen', 'herbst']),
  idee('fackelwanderung-im-schnee', t('Fackelwanderung im Schnee'), t('Am Abend mit Fackeln oder Stirnlampen durch die verschneite Landschaft gehen.'),
    3, 15, 120, 5, 1, true, ['winter'], 25,
    [0.4, 1, 0.15, 0.6, 0.6, 0.4, 0.6, 0.2, 0.1, 0.1, 0.2, 0.1], ['schnee', 'winter', 'draussen', 'wandern']),

  // --- Sport & Bewegung ------------------------------------------------------------------------
  idee('fussballturnier-im-park', t('Fußballturnier im Park'), t('Zwei Teams bilden und ein kleines Turnier im Park austragen.'),
    6, 20, 120, 0, 1, true, FRUEHSOMMERHERBST, 15,
    [0.6, 1, 0, 0.5, 0.9, 0.2, 0.8, 0.4, 0.05, 0.05, 0.8, 0.1], ['fussball', 'sport', 'draussen', 'turnier']),
  idee('beachvolleyball-runde', t('Beachvolleyball-Runde'), t('Ein Netz aufbauen oder nutzen und gemeinsam Volleyball spielen.'),
    4, 12, 90, 0, 1, true, ['sommer'], 15,
    [0.5, 1, 0.05, 0.4, 0.8, 0.2, 0.6, 0.4, 0.05, 0.05, 0.7, 0.1], ['volleyball', 'sport', 'draussen', 'sommer']),
  idee('frisbee-runde-im-park', t('Frisbee-Runde im Park'), t('Mit einer Scheibe im Park werfen oder Ultimate Frisbee spielen.'),
    2, 14, 60, 0, 1, true, FRUEHSOMMERHERBST, 5,
    [0.4, 1, 0, 0.3, 0.7, 0.2, 0.6, 0.4, 0.02, 0.05, 0.5, 0.1], ['frisbee', 'sport', 'draussen', 'spiel']),
  idee('yoga-im-park', t('Yoga im Park'), t('Gemeinsam draußen eine Yoga-Einheit machen, angeleitet per Video oder aus Erfahrung.'),
    1, 10, 60, 0, 1, true, FRUEHSOMMERHERBST, 10,
    [0.1, 1, 0, 0.5, 0.6, 0.2, 0.5, 0.1, 0.02, 0.1, 0.1, 0.3], ['yoga', 'sport', 'draussen', 'entspannung']),
  idee('stand-up-paddeln', t('Stand-up-Paddeln'), t('Mit dem Board auf einem See oder Fluss paddeln.'),
    1, 8, 120, 20, 1, true, ['sommer'], 20,
    [0.3, 1, 0.5, 0.5, 0.8, 0.5, 0.4, 0.4, 0.05, 0.1, 0.3, 0.2], ['sup', 'wasser', 'draussen', 'sommer', 'sport']),
  idee('minigolf-turnier', t('Minigolf-Turnier'), t('Eine Runde Minigolf mit kleiner Wertung unter Freunden spielen.'),
    2, 10, 90, 8, 1, true, FRUEHSOMMERHERBST, 10,
    [0.4, 1, 0.2, 0.5, 0.4, 0.2, 0.5, 0.4, 0.1, 0.05, 0.6, 0.1], ['minigolf', 'sport', 'draussen', 'spiel']),
  idee('bowling-abend', t('Bowling-Abend'), t('Ein paar Bahnen Bowling spielen und dabei Wertungen vergleichen.'),
    2, 12, 120, 15, 0, false, ALLE_JAHRESZEITEN, 10,
    [0.5, 0, 0.4, 0.5, 0.5, 0.1, 0.6, 0.4, 0.15, 0.05, 0.6, 0.1], ['bowling', 'sport', 'drinnen', 'spiel']),
  idee('nachmittag-in-der-kletterhalle', t('Nachmittag in der Kletterhalle'), t('Gemeinsam unter Anleitung an der Kletterwand verschiedene Routen ausprobieren.'),
    2, 8, 150, 18, 0, false, ALLE_JAHRESZEITEN, 15,
    [0.4, 0, 0.5, 0.5, 0.9, 0.5, 0.4, 0.3, 0.05, 0.1, 0.5, 0.2], ['klettern', 'sport', 'drinnen', 'herausfordernd']),
  idee('tanzabend-zuhause', t('Tanzabend zuhause'), t('Möbel zur Seite räumen, Playlist starten und gemeinsam tanzen.'),
    2, 15, 120, 0, 0, false, ALLE_JAHRESZEITEN, 15,
    [0.7, 0, 0, 0.4, 0.8, 0.3, 0.6, 0.1, 0.15, 0.2, 0.3, 0.3], ['tanzen', 'musik', 'drinnen', 'feiern']),
  idee('kubb-turnier-im-garten', t('Kubb-Turnier im Garten'), t('Das schwedische Wurfspiel Kubb im Garten oder Park spielen.'),
    4, 12, 90, 0, 1, true, FRUEHSOMMERHERBST, 10,
    [0.4, 1, 0, 0.4, 0.5, 0.4, 0.6, 0.4, 0.1, 0.05, 0.6, 0.1], ['kubb', 'spiel', 'draussen', 'garten']),

  // --- Kultur & Kreativ ------------------------------------------------------------------------
  idee('gemeinsamer-museumstag', t('Gemeinsamer Museumstag'), t('Ein Museum oder eine Ausstellung besuchen und hinterher darüber reden.'),
    1, 8, 150, 10, 0, false, ALLE_JAHRESZEITEN, 15,
    [0.15, 0, 0.3, 0.6, 0.2, 0.4, 0.4, 0.1, 0.02, 0.8, 0.1, 0.1], ['museum', 'kultur', 'drinnen', 'bildung']),
  idee('wissensquiz-abend', t('Wissensquiz-Abend'), t('Selbst zusammengestellte Quizfragen in Teams beantworten.'),
    4, 16, 120, 3, 0, false, ALLE_JAHRESZEITEN, 30,
    [0.5, 0, 0.1, 0.6, 0.1, 0.3, 0.7, 0.1, 0.15, 0.6, 0.6, 0.4], ['quiz', 'wissen', 'drinnen', 'gesellig']),
  idee('fotospaziergang-durchs-viertel', t('Fotospaziergang durchs Viertel'), t('Mit der Kamera oder dem Handy loslaufen und die Umgebung neu entdecken.'),
    1, 6, 90, 0, 1, true, ALLE_JAHRESZEITEN, 5,
    [0.2, 1, 0, 0.4, 0.5, 0.4, 0.3, 0.1, 0.02, 0.4, 0.1, 0.6], ['fotografie', 'draussen', 'kreativ']),
  idee('malabend-mit-leinwand', t('Malabend mit Leinwand'), t('Mit Farben und Leinwand gemeinsam malen, ganz ohne Vorkenntnisse.'),
    2, 10, 150, 15, 0, false, ALLE_JAHRESZEITEN, 20,
    [0.2, 0, 0.35, 0.6, 0.2, 0.5, 0.4, 0.1, 0.1, 0.3, 0.1, 0.9], ['malen', 'kreativ', 'drinnen']),
  idee('toepfer-workshop-daheim', t('Töpfer-Workshop daheim'), t('Mit lufttrocknendem Ton eigene kleine Gefäße oder Figuren formen.'),
    2, 8, 120, 20, 0, false, ALLE_JAHRESZEITEN, 20,
    [0.2, 0, 0.45, 0.6, 0.3, 0.6, 0.4, 0.1, 0.05, 0.3, 0.1, 0.95], ['toepfern', 'kreativ', 'drinnen']),
  idee('schreibabend-mit-impulsen', t('Schreibabend mit Impulsen'), t('Zu vorgegebenen Anfängen eigene kurze Geschichten schreiben und vorlesen.'),
    2, 8, 120, 0, 0, false, ALLE_JAHRESZEITEN, 15,
    [0.15, 0, 0, 0.6, 0.1, 0.5, 0.4, 0.1, 0.05, 0.5, 0.1, 0.9], ['schreiben', 'kreativ', 'drinnen']),
  idee('sprachaustausch-abend', t('Sprachaustausch-Abend'), t('Gegenseitig eine Fremdsprache üben, in lockerer Runde bei Snacks.'),
    2, 10, 120, 3, 0, false, ALLE_JAHRESZEITEN, 10,
    [0.3, 0, 0.1, 0.6, 0.1, 0.5, 0.5, 0.2, 0.05, 0.7, 0.1, 0.3], ['sprache', 'lernen', 'drinnen']),
  idee('geschichtenabend-am-kerzenlicht', t('Geschichtenabend am Kerzenlicht'), t('Reihum Geschichten oder Erlebnisse erzählen, bei gedämpftem Licht.'),
    3, 10, 90, 0, 0, false, ALLE_JAHRESZEITEN, 10,
    [0.15, 0, 0, 0.5, 0.1, 0.3, 0.5, 0.1, 0.1, 0.4, 0.1, 0.5], ['erzaehlen', 'drinnen', 'gemuetlich']),
  idee('diy-bastelabend', t('DIY-Bastelabend'), t('Kleine Deko- oder Geschenkideen gemeinsam basteln.'),
    2, 8, 120, 10, 0, false, ALLE_JAHRESZEITEN, 20,
    [0.2, 0, 0.25, 0.6, 0.2, 0.4, 0.4, 0.1, 0.05, 0.2, 0.1, 0.9], ['basteln', 'kreativ', 'drinnen']),
  idee('buecherclub-treffen', t('Bücherclub-Treffen'), t('Über ein zuvor gelesenes Buch sprechen und Empfehlungen austauschen.'),
    3, 10, 90, 0, 0, false, ALLE_JAHRESZEITEN, 30,
    [0.15, 0, 0, 0.7, 0.05, 0.3, 0.5, 0.1, 0.05, 0.7, 0.1, 0.3], ['buecher', 'lesen', 'drinnen', 'kultur']),

  // --- Spiele -----------------------------------------------------------------------------------
  idee('brettspielabend', t('Brettspielabend'), t('Ein paar Brettspiele mitbringen und einen langen Abend zusammen spielen.'),
    3, 8, 180, 5, 0, false, ALLE_JAHRESZEITEN, 10,
    [0.3, 0, 0.1, 0.5, 0.1, 0.2, 0.5, 0.1, 0.15, 0.2, 0.5, 0.2], ['brettspiele', 'spiele', 'drinnen', 'gesellig']),
  idee('kartenspielturnier', t('Kartenspielturnier'), t('Ein Kartenspiel auswählen und in mehreren Runden gegeneinander spielen.'),
    3, 10, 120, 2, 0, false, ALLE_JAHRESZEITEN, 5,
    [0.3, 0, 0.05, 0.4, 0.1, 0.1, 0.5, 0.1, 0.15, 0.1, 0.6, 0.1], ['karten', 'spiele', 'drinnen']),
  idee('selbstgebautes-escape-raetsel', t('Selbstgebautes Escape-Rätsel'), t('Ein Rätsel-Parcours in der Wohnung vorbereiten, den die anderen lösen müssen.'),
    3, 8, 90, 10, 0, false, ALLE_JAHRESZEITEN, 60,
    [0.4, 0, 0.2, 0.7, 0.2, 0.6, 0.5, 0.1, 0.05, 0.2, 0.6, 0.7], ['escape', 'raetsel', 'drinnen', 'kreativ']),
  idee('rollenspielabend', t('Rollenspielabend'), t('Gemeinsam eine Geschichte am Tisch spielen, mit verteilten Rollen und Würfeln.'),
    3, 6, 180, 0, 0, false, ALLE_JAHRESZEITEN, 30,
    [0.3, 0, 0.05, 0.7, 0.1, 0.6, 0.4, 0.1, 0.05, 0.3, 0.3, 0.8], ['rollenspiel', 'spiele', 'drinnen', 'fantasie']),
  idee('videospieleabend', t('Videospieleabend'), t('Zusammen an der Konsole oder am PC gegeneinander oder im Team spielen.'),
    2, 8, 150, 0, 0, false, ALLE_JAHRESZEITEN, 10,
    [0.5, 0, 0, 0.4, 0.1, 0.1, 0.4, 0.1, 0.1, 0.1, 0.6, 0.2], ['gaming', 'spiele', 'drinnen']),
  idee('schnitzeljagd-im-viertel', t('Schnitzeljagd im Viertel'), t('Hinweise verstecken und die Gruppe in Teams das Rätsel lösen lassen.'),
    6, 20, 120, 5, 1, true, FRUEHSOMMERHERBST, 60,
    [0.5, 1, 0.1, 0.7, 0.6, 0.4, 0.7, 0.2, 0.05, 0.1, 0.7, 0.6], ['schnitzeljagd', 'spiel', 'draussen', 'team']),
  idee('kegelabend', t('Kegelabend'), t('Auf einer Kegelbahn eine gesellige Runde mit Wertung spielen.'),
    4, 14, 120, 14, 0, false, ALLE_JAHRESZEITEN, 10,
    [0.5, 0, 0.35, 0.5, 0.4, 0.1, 0.6, 0.4, 0.2, 0.05, 0.5, 0.1], ['kegeln', 'spiele', 'drinnen']),
  idee('tischtennisturnier', t('Tischtennisturnier'), t('Ein kleines Turnier am Tischtennistisch mit Ausscheidungsrunden.'),
    2, 8, 90, 0, 0, false, ALLE_JAHRESZEITEN, 5,
    [0.4, 0, 0, 0.4, 0.7, 0.1, 0.5, 0.4, 0.05, 0.05, 0.7, 0.1], ['tischtennis', 'sport', 'drinnen']),
  idee('dart-turnier', t('Dart-Turnier'), t('Verschiedene Dart-Spiele ausprobieren und eine kleine Rangliste führen.'),
    2, 8, 90, 0, 0, false, ALLE_JAHRESZEITEN, 5,
    [0.4, 0, 0.05, 0.4, 0.3, 0.1, 0.5, 0.4, 0.15, 0.05, 0.6, 0.1], ['dart', 'spiele', 'drinnen']),
  idee('wuerfelspieleabend', t('Würfelspieleabend'), t('Verschiedene Würfelspiele nacheinander ausprobieren, schnell erklärt.'),
    2, 8, 90, 3, 0, false, ALLE_JAHRESZEITEN, 5,
    [0.3, 0, 0.05, 0.4, 0.1, 0.2, 0.4, 0.1, 0.1, 0.1, 0.5, 0.1], ['wuerfel', 'spiele', 'drinnen']),

  // --- Musik ------------------------------------------------------------------------------------
  idee('jamsession-abend', t('Jamsession-Abend'), t('Eigene Instrumente mitbringen und gemeinsam frei musizieren.'),
    2, 8, 120, 0, 0, false, ALLE_JAHRESZEITEN, 15,
    [0.6, 0, 0.1, 0.5, 0.3, 0.5, 0.4, 0.1, 0.1, 0.3, 0.2, 0.95], ['musik', 'jamsession', 'drinnen', 'kreativ']),
  idee('karaoke-abend-daheim', t('Karaoke-Abend daheim'), t('Mit Karaoke-App oder -Gerät reihum Lieblingssongs singen.'),
    3, 12, 120, 3, 0, false, ALLE_JAHRESZEITEN, 15,
    [0.8, 0, 0.05, 0.4, 0.3, 0.3, 0.6, 0.1, 0.15, 0.2, 0.4, 0.4], ['karaoke', 'musik', 'drinnen', 'feiern']),
  idee('trommel-workshop', t('Trommel-Workshop'), t('Mit einfachen Trommeln gemeinsame Rhythmen ausprobieren.'),
    3, 10, 90, 15, 0, false, ALLE_JAHRESZEITEN, 15,
    [0.6, 0, 0.35, 0.6, 0.4, 0.6, 0.5, 0.1, 0.05, 0.4, 0.2, 0.9], ['trommeln', 'musik', 'drinnen', 'kreativ']),
  idee('playlist-tauschabend', t('Playlist-Tauschabend'), t('Jeder stellt eine Playlist zusammen, dann gemeinsam anhören und diskutieren.'),
    2, 8, 90, 0, 0, false, ALLE_JAHRESZEITEN, 30,
    [0.4, 0, 0, 0.6, 0.05, 0.3, 0.4, 0.1, 0.1, 0.3, 0.1, 0.5], ['musik', 'playlist', 'drinnen']),
  idee('tanzworkshop-zu-zweit', t('Tanzworkshop zu zweit'), t('Einen Grundschritt per Video lernen und gemeinsam üben.'),
    2, 8, 90, 5, 0, false, ALLE_JAHRESZEITEN, 10,
    [0.5, 0, 0.1, 0.6, 0.7, 0.5, 0.4, 0.1, 0.05, 0.3, 0.3, 0.5], ['tanzen', 'musik', 'drinnen', 'lernen']),
  idee('musizieren-im-park', t('Musizieren im Park'), t('An einem schönen Fleck draußen zusammen spielen oder singen.'),
    2, 10, 90, 0, 1, true, FRUEHSOMMERHERBST, 15,
    [0.5, 1, 0, 0.4, 0.3, 0.4, 0.5, 0.1, 0.1, 0.3, 0.2, 0.85], ['musik', 'draussen', 'park']),

  // --- Entspannung --------------------------------------------------------------------------------
  idee('meditationsabend', t('Meditationsabend'), t('Eine angeleitete Meditation gemeinsam machen und danach in Ruhe austauschen.'),
    1, 8, 60, 0, 0, false, ALLE_JAHRESZEITEN, 10,
    [0.05, 0, 0, 0.5, 0.05, 0.2, 0.4, 0.05, 0.02, 0.2, 0.02, 0.2], ['meditation', 'entspannung', 'drinnen']),
  idee('wellnessabend-daheim', t('Wellnessabend daheim'), t('Gesichtsmasken, Tee und ruhige Musik für einen entspannten Abend.'),
    2, 6, 120, 10, 0, false, ALLE_JAHRESZEITEN, 15,
    [0.1, 0, 0.3, 0.6, 0.05, 0.1, 0.4, 0.05, 0.05, 0.1, 0.02, 0.3], ['wellness', 'entspannung', 'drinnen']),
  idee('gemeinsamer-lesenachmittag', t('Gemeinsamer Lesenachmittag'), t('Jeder liest sein eigenes Buch, zusammen bei Tee oder Kaffee.'),
    1, 6, 120, 3, 0, false, ALLE_JAHRESZEITEN, 5,
    [0.05, 0, 0.1, 0.5, 0.02, 0.1, 0.3, 0.05, 0.05, 0.4, 0.02, 0.2], ['lesen', 'entspannung', 'drinnen']),
  idee('yoga-zum-sonnenuntergang', t('Yoga zum Sonnenuntergang'), t('Eine ruhige Yoga-Einheit draußen, während die Sonne untergeht.'),
    1, 8, 60, 0, 1, true, FRUEHSOMMERHERBST, 10,
    [0.05, 1, 0, 0.5, 0.5, 0.2, 0.4, 0.05, 0.02, 0.1, 0.05, 0.3], ['yoga', 'draussen', 'entspannung']),
  idee('stricktreffen', t('Stricktreffen'), t('Mit Wolle und Nadeln zusammensitzen, häkeln oder stricken und plaudern.'),
    2, 8, 120, 5, 0, false, ALLE_JAHRESZEITEN, 5,
    [0.15, 0, 0.15, 0.5, 0.05, 0.2, 0.4, 0.05, 0.05, 0.2, 0.05, 0.8], ['stricken', 'handarbeit', 'drinnen']),
  idee('gemeinsames-gartenprojekt', t('Gemeinsames Gartenprojekt'), t('Beete anlegen, pflanzen oder umgestalten, gemeinsam an einem Nachmittag.'),
    2, 8, 150, 15, 1, true, ['fruehling', 'sommer'], 20,
    [0.2, 1, 0.3, 0.6, 0.5, 0.2, 0.4, 0.2, 0.02, 0.1, 0.1, 0.8], ['garten', 'draussen', 'kreativ']),
  idee('ruhiger-kaminabend', t('Ruhiger Kaminabend'), t('Bei Kerzen oder Kamin zusammensitzen, reden und den Abend ausklingen lassen.'),
    2, 6, 120, 5, 0, false, ['herbst', 'winter'], 10,
    [0.05, 0, 0.1, 0.5, 0.02, 0.1, 0.3, 0.05, 0.15, 0.2, 0.02, 0.2], ['kamin', 'entspannung', 'drinnen', 'winter']),
  idee('digital-detox-nachmittag', t('Digital-Detox-Nachmittag'), t('Handys weglegen und den Nachmittag ganz ohne Bildschirm gemeinsam verbringen.'),
    2, 8, 180, 0, 0, false, ALLE_JAHRESZEITEN, 5,
    [0.1, 0, 0, 0.5, 0.1, 0.3, 0.4, 0.1, 0.02, 0.2, 0.05, 0.3], ['digital-detox', 'entspannung', 'drinnen']),

  // --- Feiern & Gesellig ----------------------------------------------------------------------
  idee('mottoparty-daheim', t('Mottoparty daheim'), t('Ein Thema aussuchen, passend dekorieren und feiern.'),
    6, 20, 180, 12, 0, false, ALLE_JAHRESZEITEN, 60,
    [0.7, 0, 0.4, 0.7, 0.3, 0.5, 0.8, 0.3, 0.2, 0.2, 0.3, 0.6], ['party', 'motto', 'drinnen', 'feiern']),
  idee('kostuemabend', t('Kostümabend'), t('Verkleidet zusammenkommen und Fotos vom Abend machen.'),
    4, 15, 150, 10, 0, false, ALLE_JAHRESZEITEN, 45,
    [0.6, 0, 0.35, 0.7, 0.2, 0.6, 0.7, 0.2, 0.15, 0.2, 0.2, 0.7], ['kostuem', 'verkleiden', 'drinnen', 'feiern']),
  idee('tanzparty-zuhause', t('Tanzparty zuhause'), t('Möbel zur Seite, Lichter dimmen, gemeinsame Playlist und tanzen bis spät.'),
    5, 20, 180, 0, 0, false, ALLE_JAHRESZEITEN, 20,
    [0.85, 0, 0.1, 0.5, 0.8, 0.3, 0.8, 0.1, 0.25, 0.1, 0.3, 0.3], ['party', 'tanzen', 'drinnen', 'musik']),
  idee('ueberraschungsabend-planen', t('Überraschungsabend planen'), t('Für ein Gruppenmitglied heimlich einen besonderen Abend organisieren.'),
    3, 10, 150, 15, 0, false, ALLE_JAHRESZEITEN, 90,
    [0.4, 0, 0.4, 0.9, 0.2, 0.4, 0.5, 0.2, 0.1, 0.2, 0.1, 0.7], ['ueberraschung', 'planen', 'drinnen', 'feiern']),
  idee('kleines-nachbarschaftsfest', t('Kleines Nachbarschaftsfest'), t('Tische zusammenstellen, jeder bringt etwas mit, gemeinsam im Freien feiern.'),
    10, 40, 210, 8, 1, true, FRUEHSOMMERHERBST, 60,
    [0.6, 1, 0.2, 0.7, 0.3, 0.3, 0.9, 0.4, 0.15, 0.1, 0.2, 0.4], ['nachbarschaft', 'fest', 'draussen', 'gesellig']),
  idee('hofflohmarkt-organisieren', t('Hofflohmarkt organisieren'), t('Gemeinsam Sachen aussortieren und an einem Vormittag verkaufen.'),
    2, 10, 240, 0, 1, true, FRUEHSOMMERHERBST, 90,
    [0.4, 1, 0, 0.8, 0.4, 0.3, 0.6, 0.2, 0.02, 0.1, 0.2, 0.3], ['flohmarkt', 'draussen', 'organisieren']),
  idee('fotobox-abend', t('Fotobox-Abend'), t('Eine Ecke mit Kulissen und Requisiten für lustige Fotos einrichten.'),
    4, 15, 120, 8, 0, false, ALLE_JAHRESZEITEN, 30,
    [0.6, 0, 0.25, 0.6, 0.2, 0.4, 0.7, 0.1, 0.15, 0.1, 0.2, 0.6], ['fotobox', 'fotografie', 'drinnen', 'feiern']),
  idee('krimidinner-abend', t('Krimidinner-Abend'), t('Mit verteilten Rollen einen Kriminalfall beim Essen gemeinsam lösen.'),
    6, 12, 180, 18, 0, false, ALLE_JAHRESZEITEN, 60,
    [0.4, 0, 0.45, 0.8, 0.15, 0.6, 0.7, 0.5, 0.15, 0.3, 0.4, 0.6], ['krimidinner', 'spiel', 'drinnen', 'essen']),

  // --- Saisonal Spezial -----------------------------------------------------------------------
  idee('weihnachtsplaetzchen-backen', t('Weihnachtsplätzchen backen'), t('Verschiedene Plätzchensorten backen und gemeinsam verzieren.'),
    2, 10, 180, 8, 0, false, ['winter'], 20,
    [0.3, 0, 0.2, 0.6, 0.2, 0.1, 0.5, 0.3, 0.05, 0.1, 0.1, 0.7], ['weihnachten', 'backen', 'drinnen', 'winter']),
  idee('laternenwanderung-im-herbst', t('Laternenwanderung im Herbst'), t('Mit selbstgebastelten Laternen einen Abendspaziergang machen.'),
    3, 20, 90, 4, 1, true, ['herbst'], 45,
    [0.4, 1, 0.1, 0.6, 0.4, 0.3, 0.7, 0.2, 0.05, 0.1, 0.1, 0.5], ['laterne', 'herbst', 'draussen', 'abend']),
  idee('ostereier-bemalen', t('Ostereier bemalen'), t('Eier ausblasen oder kochen und bunt bemalen oder verzieren.'),
    2, 10, 90, 5, 0, false, ['fruehling'], 15,
    [0.3, 0, 0.1, 0.5, 0.1, 0.2, 0.5, 0.1, 0.02, 0.1, 0.1, 0.85], ['ostern', 'basteln', 'drinnen', 'fruehling']),
  idee('sommerfest-im-garten', t('Sommerfest im Garten'), t('Girlanden aufhängen, Essen vorbereiten und den Garten für einen Festabend nutzen.'),
    8, 30, 240, 12, 1, true, ['sommer'], 90,
    [0.6, 1, 0.35, 0.7, 0.3, 0.2, 0.85, 0.4, 0.2, 0.1, 0.2, 0.4], ['sommer', 'fest', 'draussen', 'gesellig']),
  idee('kastaniensammeln-im-park', t('Kastaniensammeln im Park'), t('Spazieren gehen und Kastanien oder Blätter für Bastelprojekte sammeln.'),
    1, 10, 60, 0, 1, true, ['herbst'], 5,
    [0.2, 1, 0, 0.3, 0.4, 0.1, 0.4, 0.1, 0.02, 0.1, 0.05, 0.3], ['herbst', 'sammeln', 'draussen', 'spaziergang']),
  idee('winterspaziergang-mit-punsch', t('Winterspaziergang mit Punsch'), t('Eine Runde durch die kalte Luft gehen und danach warmen Kinderpunsch trinken.'),
    2, 12, 90, 4, 1, true, ['winter'], 20,
    [0.2, 1, 0.1, 0.5, 0.4, 0.1, 0.6, 0.3, 0.1, 0.1, 0.1, 0.2], ['winter', 'spaziergang', 'draussen', 'punsch']),
  idee('fruehlings-pflanzaktion', t('Frühlings-Pflanzaktion'), t('Blumen oder Gemüse einpflanzen und den Garten oder Balkon für den Sommer vorbereiten.'),
    2, 8, 120, 15, 1, true, ['fruehling'], 20,
    [0.2, 1, 0.3, 0.6, 0.5, 0.2, 0.4, 0.2, 0.02, 0.1, 0.1, 0.8], ['fruehling', 'garten', 'draussen', 'pflanzen']),
  idee('erntedank-kochabend', t('Erntedank-Kochabend'), t('Mit saisonalem Gemüse ein großes Herbstmenü gemeinsam kochen.'),
    4, 12, 180, 12, 0, false, ['herbst'], 30,
    [0.3, 0, 0.35, 0.6, 0.3, 0.2, 0.6, 0.1, 0.1, 0.2, 0.1, 0.7], ['erntedank', 'kochen', 'drinnen', 'herbst']),
];

const PFLICHTFELDER = [
  'id', 'name', 'beschreibung', 'aktivitaet', 'personen_min', 'personen_max', 'dauer_min',
  'kosten_pp', 'draussen', 'wetter_abhaengig', 'jahreszeiten', 'vorbereitung_min', 'merkmale',
  'min_alter', 'tags',
];

// Wortlisten für die automatische Prüfung (ZUSATZ §4: „keine Gefahr und nichts Illegales").
// Bewusst als mehrteilige, konkrete Wendungen — ein einzelnes Wort wie „Feuer" (Lagerfeuer) oder
// „Klettern" (Kletterhalle) soll nicht anschlagen.
const GEFAHR_MUSTER = [
  'feuerwerk selbst', 'feuerwerk bauen', 'polenboeller', 'pyrotechnik', 'klippenspring',
  'ohne sicherung', 'freeclimb', 'russisch roulette', 'russische roulette', 'schusswaffe',
  'waffe abfeuern', 'messerwurf', 'messerwerfen', 'feuer schlucken', 'auf gleisen',
  'zug surfen', 'dachklettern', 'gebaeudeklettern', 'nachtwanderung auf dem gletscher',
  'gletscheruebergang ohne', 'wildern', 'autorennen', 'raserei', 'wetttrinken', 'trinkspiel',
  'komasauf', 'saufgelage', 'sauftour',
];
const ILLEGAL_MUSTER = [
  'droge', 'kokain', 'cannabis', 'marihuana', 'ecstasy', 'lsd', 'rauschmittel', 'schwarzmarkt',
  'hehlerware', 'einbruch', 'diebstahl', 'vandalismus', 'schwarzfahren', 'sachbeschaedigung',
  'wildcampen verboten', 'graffiti ohne erlaubnis',
];
// Riskante Aktivitäten sind nur zulässig, wenn der Text eine Anleitung/Aufsicht nennt.
const RISIKO_WORTE = [
  'klettern', 'tauchen', 'bungee', 'fallschirm', 'gleitschirm', 'skydiv', 'eisklettern',
  'hochseilgarten', 'canyoning',
];
const SICHERHEITS_WORTE = [
  'anleitung', 'kurs', 'sicherung', 'gefuehrt', 'ausbildung', 'erfahren', 'zertifiziert',
  'trainer', 'lehrer', 'aufsicht',
];

function normalisiert(text) {
  return String(text ?? '').toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/ß/g, 'ss');
}

// Levenshtein-Distanz (klassisch, iterativ) — für die Dubletten-Prüfung reicht die einfache
// Variante, die Listen sind klein (~90 Einträge inkl. Testideen).
function levenshtein(a, b) {
  const m = a.length;
  const n = b.length;
  if (!m) return n;
  if (!n) return m;
  const zeile = new Array(n + 1);
  for (let j = 0; j <= n; j += 1) zeile[j] = j;
  for (let i = 1; i <= m; i += 1) {
    let vorherigeDiagonale = zeile[0];
    zeile[0] = i;
    for (let j = 1; j <= n; j += 1) {
      const temp = zeile[j];
      zeile[j] = a[i - 1] === b[j - 1]
        ? vorherigeDiagonale
        : 1 + Math.min(vorherigeDiagonale, zeile[j], zeile[j - 1]);
      vorherigeDiagonale = temp;
    }
  }
  return zeile[n];
}

function aehnlichkeit(a, b) {
  const laenge = Math.max(a.length, b.length);
  if (!laenge) return 1;
  return 1 - levenshtein(a, b) / laenge;
}

const STOPWOERTER = new Set([
  'im', 'am', 'mit', 'und', 'zu', 'der', 'die', 'das', 'ein', 'eine', 'einen', 'fuer', 'beim',
  'ins', 'als', 'von', 'bei', 'den', 'dem', 'auf', 'aus', 'zum', 'zur',
]);

function kernwoerter(text) {
  return new Set(
    normalisiert(text)
      .replace(/[^a-z0-9 ]+/g, ' ')
      .split(/\s+/)
      .filter((wort) => wort.length >= 4 && !STOPWOERTER.has(wort)),
  );
}

function jaccard(a, b) {
  const schnitt = [...a].filter((wert) => b.has(wert)).length;
  const vereinigung = new Set([...a, ...b]).size;
  return vereinigung ? schnitt / vereinigung : 0;
}

function istLeer(wert) {
  if (wert === undefined || wert === null) return true;
  if (typeof wert === 'string') return !wert.trim();
  if (Array.isArray(wert)) return wert.length === 0;
  return false;
}

// Reine, automatische Prüfung (ZUSATZ §4: kein Mensch gibt frei). Gibt die Liste zurück, jeder
// Eintrag ergänzt um `pruefung: { ok, gruende }` — Pflichtfelder, Wertebereiche, Dubletten,
// Gefahr/Illegales, 16+.
export function ideenPruefen(liste) {
  const gruendeJeIdee = liste.map(() => []);

  liste.forEach((i, index) => {
    const gruende = gruendeJeIdee[index];
    for (const feld of PFLICHTFELDER) {
      if (istLeer(i[feld])) gruende.push(`feld_fehlt:${feld}`);
    }
    if (typeof i.name === 'string' && i.name.length > 40) gruende.push('name_zu_lang');
    if (typeof i.beschreibung === 'string' && i.beschreibung.length > 140) gruende.push('beschreibung_zu_lang');
    if (i.id && i.aktivitaet !== `idee·${i.id}`) gruende.push('aktivitaet_falsch');
    if (Number.isFinite(i.personen_min) && i.personen_min < 1) gruende.push('personen_bereich');
    if (Number.isFinite(i.personen_min) && Number.isFinite(i.personen_max) && i.personen_min > i.personen_max) gruende.push('personen_bereich');
    if (Number.isFinite(i.dauer_min) && i.dauer_min <= 0) gruende.push('dauer_bereich');
    if (Number.isFinite(i.kosten_pp) && (i.kosten_pp < 0 || i.kosten_pp > 500)) gruende.push('kosten_bereich');
    if (Number.isFinite(i.draussen) && (i.draussen < 0 || i.draussen > 1)) gruende.push('draussen_bereich');
    if (Number.isFinite(i.vorbereitung_min) && i.vorbereitung_min < 0) gruende.push('vorbereitung_bereich');
    if (Array.isArray(i.jahreszeiten)) {
      if (!i.jahreszeiten.length || i.jahreszeiten.some((j) => !ALLE_JAHRESZEITEN.includes(j))) gruende.push('jahreszeiten_ungueltig');
    }
    if (!Array.isArray(i.merkmale) || i.merkmale.length !== 12) {
      gruende.push('merkmale_anzahl');
    } else {
      i.merkmale.forEach((wert, merkmalIndex) => {
        if (!Number.isFinite(wert) || wert < 0 || wert > 1) gruende.push(`merkmal_bereich:${merkmalIndex}`);
      });
    }
    if (Number(i.min_alter) > 0) gruende.push('ab_18');
    if (Array.isArray(i.merkmale) && Number.isFinite(i.merkmale[8]) && i.merkmale[8] >= 0.6) gruende.push('alkohol_schwerpunkt');

    const text = normalisiert(`${i.name || ''} ${i.beschreibung || ''} ${(i.tags || []).join(' ')}`);
    for (const muster of GEFAHR_MUSTER) if (text.includes(muster)) gruende.push(`gefahr:${muster}`);
    for (const muster of ILLEGAL_MUSTER) if (text.includes(muster)) gruende.push(`illegal:${muster}`);
    const risikoTreffer = RISIKO_WORTE.find((wort) => text.includes(wort));
    if (risikoTreffer && !SICHERHEITS_WORTE.some((wort) => text.includes(wort))) gruende.push(`gefahr_ohne_anleitung:${risikoTreffer}`);
  });

  // Dubletten: paarweise, O(n²) — bei ~90 Einträgen unproblematisch.
  for (let a = 0; a < liste.length; a += 1) {
    for (let b = a + 1; b < liste.length; b += 1) {
      const ia = liste[a];
      const ib = liste[b];
      if (!ia || !ib || !ia.id || !ib.id) continue;
      if (ia.id === ib.id) {
        gruendeJeIdee[a].push(`dublette_id:${ib.id}`);
        gruendeJeIdee[b].push(`dublette_id:${ia.id}`);
        continue;
      }
      const nameAehnlich = aehnlichkeit(normalisiert(ia.name || ''), normalisiert(ib.name || '')) >= 0.8;
      let merkmaleAehnlich = false;
      if (Array.isArray(ia.merkmale) && Array.isArray(ib.merkmale) && ia.merkmale.length === 12 && ib.merkmale.length === 12) {
        const mittlererAbstand = ia.merkmale.reduce((summe, wert, index) => summe + Math.abs(wert - ib.merkmale[index]), 0) / 12;
        merkmaleAehnlich = mittlererAbstand < 0.12;
      }
      const kernAehnlich = jaccard(kernwoerter(ia.name || ''), kernwoerter(ib.name || '')) >= 0.6;
      if (nameAehnlich || (merkmaleAehnlich && kernAehnlich)) {
        gruendeJeIdee[a].push(`dublette:${ib.id}`);
        gruendeJeIdee[b].push(`dublette:${ia.id}`);
      }
    }
  }

  return liste.map((i, index) => {
    const gruende = [...new Set(gruendeJeIdee[index])];
    return { ...i, pruefung: { ok: gruende.length === 0, gruende } };
  });
}
