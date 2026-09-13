// Was Crew in freien Chat-Sätzen erkennt (Raum, 07.1/07.3/07.9) — in allen vier Sprachen.
//
// Runde 2 (Sprachen): Die Erkennung hing an deutschen Wörtern („Ich bring … mit",
// „Bock auf …", „Mitfahrgelegenheit"). Menschen schreiben in IHRER Sprache, unabhängig davon,
// welche Sprache die App gerade spricht — deshalb gelten hier alle vier Sprachen zugleich.
// Die deutschen Muster sind Buchstabe für Buchstabe die bisherigen (room-e2e prüft sie).
// Alles hier ist nur ein Vorschlag mit Rückgängig — lieber einmal zu wenig erkannt als falsch.
//
// Runde 3 (Jonathan, K3): „Ich schreibe ‚morgen Skifahren', ‚wer will bei mir mitfahren',
// ‚ich fahre mit Auto', ‚kann ich irgendwo mitfahren' oder eine Uhrzeit — nirgends ein
// Vorschlag." Dazu kommen jetzt:
//   planErkennen      Aktivität + Zeitwort („morgen Skifahren", „heute Abend Kino")
//   bietetMitfahrt    jemand fährt und hat Platz („ich fahr, 3 Plätze frei")
//   suchtMitfahrt     jemand braucht einen Platz (wie bisher, jetzt ohne die Angebote)
//   uhrzeitIn         eine Uhrzeit, die nach Vorschlag klingt („um 19 Uhr", „19:30")
// Diese Datei entscheidet nur, WAS in einem Satz steht. Ob daraus sichtbar etwas wird (und
// wie selten), entscheidet der Raum (screens/room.js).

const APOSTROPH = /[’]/g;
const norm = (text) => String(text || '').replace(APOSTROPH, "'");

// \b kennt nur ASCII — vor „übermorgen", „é" oder „ñ" gäbe es keine Wortgrenze. Diese Grenze
// zählt jeden Buchstaben und jede Ziffer aller Schriften.
const GRENZE_VOR = '(?<![\\p{L}\\p{N}])';
const GRENZE_NACH = '(?![\\p{L}\\p{N}])';
const wortMuster = (quelle, flags = 'iu') => new RegExp(`${GRENZE_VOR}(?:${quelle})${GRENZE_NACH}`, flags);

const ohneAkzent = (text) => String(text || '').normalize('NFD').replace(/\p{M}/gu, '').toLowerCase();

// --- „Ich bring … mit" → Listen-Übernahme --------------------------------------------------
const MITBRING_MUSTER = [
  { muster: /(?:^|[.!?]\s*)ich bring(?:e)?\s+(.+?)\s+mit\b/i, artikel: /^(die|den|das|der|meine?n?|eine?n?|noch|dann|morgen|heute)\s+/gi, und: /\s+und\s+/gi },
  { muster: /(?:^|[.!?]\s*)i(?:'ll| will)? bring\s+([^.!?]+)/i, artikel: /^(the|some|my|a|an|also|too)\s+/gi, und: /\s+and\s+/gi },
  { muster: /(?:^|[.!?]\s*)j'apporte\s+([^.!?]+)/i, artikel: /^(le|la|les|l'|des|du|de la|un|une|mon|ma|mes|aussi)\s*/gi, und: /\s+et\s+/gi },
  { muster: /(?:^|[.!?¡¿]\s*)(?:yo\s+)?llevo\s+([^.!?]+)/i, artikel: /^(el|la|los|las|un|una|unos|unas|mi|mis|algo de|también)\s+/gi, und: /\s+y\s+/gi },
];

// Runde 3: „Yo llevo el coche" / „Ich bring das Auto mit" ist keine Liste, sondern eine
// Mitfahrt — das Fahrzeug allein wird nicht als Mitbringsel übernommen.
const NUR_FAHRZEUG = /^(auto|wagen|bus|car|voiture|coche|carro)$/i;

export function mitbringWort(text) {
  const satz = norm(text);
  for (const { muster, artikel, und } of MITBRING_MUSTER) {
    const treffer = muster.exec(satz);
    if (!treffer) continue;
    const wort = treffer[1].replace(artikel, '').replace(und, ', ').replace(/[.!?,;\s]+$/, '').trim();
    if (NUR_FAHRZEUG.test(wort)) return null;
    if (wort) return wort.charAt(0).toUpperCase() + wort.slice(1);
  }
  return null;
}

// --- „Bock auf …" → Stichwort im Catch-up -------------------------------------------------
// Nachgestellte Zeitangaben gehören nicht zum Stichwort („up for the Pfänder on Saturday").
const ZEITWORTE = /^(on|at|this|next|tonight|today|tomorrow|samedi|dimanche|lundi|mardi|mercredi|jeudi|vendredi|ce|cette|demain|ce soir|el|la|este|esta|mañana|hoy|sábado|domingo|lunes|martes|miércoles|jueves|viernes)$/i;
const LUST_MUSTER = [
  // Deutsch wie bisher: „Bock"/„Lust" irgendwo, dann „auf …".
  { pruefe: (s) => /\b(bock|lust)\b/i.test(s) && /\bauf\b/i.test(s), muster: /\bauf\s+(?:den|die|das|einen?|eine|'?n)?\s*([\wÄÖÜäöüß-]+(?:\s[\wÄÖÜäöüß-]+)?)/i },
  // \p{L} statt \w: \w kennt keine Umlaute — aus „Pfänder" wurde sonst „Pf".
  { muster: /\b(?:up for|fancy|in the mood for|feel like)\s+(?:the|a|an|some|doing|going to)?\s*([\p{L}\p{N}'-]+(?:\s[\p{L}\p{N}'-]+)?)/iu },
  { muster: /\b(?:chaude?s? pour|partante?s? pour|envie d(?:e\s+|'))\s*(?:le|la|les|l'|un|une|du|des|faire)?\s*([\p{L}\p{N}'-]+(?:\s[\p{L}\p{N}'-]+)?)/iu },
  { muster: /(?:se apunta a(?:l)?|ganas de|me apetece|te apetece|os apetece)\s+(?:el|la|los|las|un|una|al)?\s*([\p{L}\p{N}'-]+(?:\s[\p{L}\p{N}'-]+)?)/iu },
];

export function lustAuf(text) {
  const satz = norm(text);
  for (const { pruefe, muster } of LUST_MUSTER) {
    if (pruefe && !pruefe(satz)) continue;
    const treffer = muster.exec(satz);
    if (!treffer) continue;
    const worte = treffer[1].replace(/[.!?,;¿¡]+$/, '').trim().split(/\s+/);
    // „Fancy doing something …" nennt nichts Bestimmtes — kein Stichwort.
    if (/^(something|anything|stuff|it|that|this|truc|quelque|algo|etwas|was)$/i.test(worte[0])) continue;
    if (worte.length > 1 && (ZEITWORTE.test(worte[worte.length - 1]) || /^(at|in|to|à|au|en|a|de)$/i.test(worte[worte.length - 1]))) worte.pop();
    const wort = worte.join(' ').replace(/[.!?,;]+$/, '').trim();
    if (wort && !ZEITWORTE.test(wort)) return wort;
  }
  return null;
}

// --- Zahlen in Worten („zwei Plätze", „three seats", „deux places", „dos plazas") ---------
const ZAHLWORTE = {
  ein: 1, eins: 1, einen: 1, eine: 1, zwei: 2, drei: 3, vier: 4, 'fünf': 5, fuenf: 5, sechs: 6, sieben: 7,
  one: 1, two: 2, three: 3, four: 4, five: 5, six: 6, seven: 7,
  un: 1, une: 1, deux: 2, trois: 3, quatre: 4, cinq: 5, sept: 7,
  uno: 1, una: 1, dos: 2, tres: 3, cuatro: 4, cinco: 5, seis: 6, siete: 7,
};
const ZAHL = `\\p{N}{1,2}|${Object.keys(ZAHLWORTE).join('|')}`;
function zahlAus(wort) {
  if (!wort) return null;
  if (/^\d+$/.test(wort)) return Number(wort);
  return ZAHLWORTE[String(wort).toLowerCase()] ?? null;
}

// --- Mitfahrt ANBIETEN -------------------------------------------------------------------
// Jede Zeile: ein Muster und (optional) welche Gruppe die Zahl der freien Plätze trägt.
const ANGEBOT_MUSTER = [
  // Deutsch
  { muster: wortMuster('wer (?:will|möchte|moechte|mag|kommt|fährt|faehrt)(?: (?:noch|gern|gerne|alles))? (?:bei|mit) mir mit(?:fahren|kommen)?') },
  { muster: wortMuster('wer (?:will|möchte|moechte) (?:noch )?mitfahren') },
  { muster: wortMuster(`(?:ich )?nehm(?:e)? (?:dich|euch|jemanden|wen|leute|(?:${ZAHL})(?: leute| personen)?)(?: gern| gerne| noch)? mit`) },
  { muster: wortMuster(`(?:ich )?kann (?:dich|euch|jemanden|wen|leute|(?:${ZAHL})(?: leute| personen)?) mitnehmen`) },
  { muster: wortMuster(`(?:hab|habe|hätte|haette|hätt) (?:noch )?(${ZAHL}) (?:freie[n]? )?pl[aä]tze?`), zahl: 1 },
  { muster: wortMuster(`(${ZAHL}) (?:freie[n]? )?pl[aä]tze? (?:frei|im auto)`), zahl: 1 },
  { muster: wortMuster('pl[aä]tze? (?:im auto )?frei') },
  { muster: wortMuster('auto ist (?:startklar|dabei|vollgetankt|voll getankt|bereit)') },
  { muster: wortMuster('(?:ich )?kann fahren') },
  { muster: wortMuster('(?:ich )?(?:fahr|fahre|komm|komme) mit (?:dem|meinem|m|nem) auto') },
  // Englisch
  { muster: wortMuster("i'?m driving|i am driving|i(?:'ll| will| can) drive") },
  { muster: wortMuster(`i can (?:take|give|pick up) (?:you|someone|anyone|people|(?:${ZAHL}))`) },
  { muster: wortMuster('give (?:you|someone|anyone|people) a (?:lift|ride)') },
  { muster: wortMuster(`(${ZAHL}) (?:free |spare |empty )?seats?`), zahl: 1 },
  { muster: wortMuster(`room for (${ZAHL})`), zahl: 1 },
  { muster: wortMuster('(?:anyone|who) (?:wants|needs) a (?:lift|ride)') },
  // Französisch
  { muster: wortMuster('je conduis|je prends (?:la|ma) voiture') },
  { muster: wortMuster("je (?:peux|pourrais) (?:vous |t'|te )(?:emmener|prendre|déposer|deposer)") },
  { muster: wortMuster(`(${ZAHL}) places? (?:libres?|dispo(?:nibles?)?)`), zahl: 1 },
  { muster: wortMuster('qui (?:veut|vient) (?:venir )?avec moi') },
  { muster: wortMuster("j'ai (?:encore )?(?:de la )?place(?: dans (?:la|ma) voiture)?") },
  // Spanisch
  { muster: wortMuster('(?:yo )?conduzco|(?:llevo|cojo) (?:el |mi )?coche') },
  { muster: wortMuster(`puedo llevar(?:os|te| a (?:alguien|(?:${ZAHL})(?: personas)?))`) },
  { muster: wortMuster(`(${ZAHL}) plazas? libres?`), zahl: 1 },
  { muster: wortMuster('tengo sitio|(?:quién|quien) se viene (?:conmigo|en mi coche)') },
];

// „ich fahr(e)" allein ist mehrdeutig: „ich fahr, 3 Plätze frei" bietet an, „ich fahre mit
// dem Zug", „ich fahre bei dir mit" oder „ich fahre nach Wien" nicht.
function ichFahreSelbst(satz) {
  if (!wortMuster('ich fahr(?:e)?').test(satz)) return false;
  if (wortMuster('zug|bus|bahn|öffis|oeffis|rad|fahrrad|bike|tram|straßenbahn|strassenbahn|u-bahn').test(satz)) return false;
  if (wortMuster('(?:bei|mit) (?!mir(?![\\p{L}])|dem(?![\\p{L}])|meinem(?![\\p{L}])|nem(?![\\p{L}]))@?\\p{L}+ mit').test(satz)) return false;
  if (wortMuster('ich fahr(?:e)? (?:nach|heim|weg|zurück|zurueck|los|vor|gleich|jetzt)').test(satz) && !wortMuster('auto|pl[aä]tze?').test(satz)) return false;
  return true;
}

/** Bietet der Satz eine Mitfahrt an? → null oder { plaetze: Zahl|null }. */
export function bietetMitfahrt(text) {
  const satz = norm(text);
  let gefunden = false;
  let plaetze = null;
  for (const { muster, zahl } of ANGEBOT_MUSTER) {
    const treffer = muster.exec(satz);
    if (!treffer) continue;
    gefunden = true;
    if (zahl && plaetze == null) plaetze = zahlAus(treffer[zahl]);
  }
  if (!gefunden && ichFahreSelbst(satz)) gefunden = true;
  if (!gefunden) return null;
  // „ich fahr, 3 Plätze frei" — die Zahl kann in einem zweiten Satzteil stehen.
  if (plaetze == null) {
    const zahlTreffer = wortMuster(`(${ZAHL}) (?:freie[n]? |free |spare )?(?:pl[aä]tze?|seats?|places?|plazas?)`).exec(satz);
    if (zahlTreffer) plaetze = zahlAus(zahlTreffer[1]);
  }
  return { plaetze: plaetze && plaetze > 0 && plaetze < 10 ? plaetze : null };
}

// --- Mitfahrt SUCHEN ----------------------------------------------------------------------
const MITFAHR_MUSTER = [
  /mitfahrgelegenheit|mitfahren|mitnehmen|mitnimmt/i,
  /\b(?:give (?:me|us) a (?:lift|ride)|need a (?:lift|ride)|get a (?:lift|ride)|carpool|pick me up)\b/i,
  /\b(?:covoit(?:urage)?|m'emmener|me d[ée]poser|me prendre en voiture)\b/i,
  /(?:me (?:puede|puedes|podéis|podeis) llevar|llevarme|alguien me lleva|me llevas|me recoge|coche compartido|compartir coche)/i,
  // Runde 3
  wortMuster('nimmt mich (?:wer|jemand|einer|eine)(?: von euch)? mit|wer nimmt mich mit|brauch(?:e)? (?:noch )?(?:eine )?(?:mitfahrt|fahrt)|hat (?:wer|jemand|einer) (?:noch )?(?:einen )?platz'),
  wortMuster("can i (?:get a (?:lift|ride)|come with (?:you|someone)|ride with)|(?:is )?anyone driving|any room in (?:your|a|the|someone's) car|need a seat"),
  wortMuster("je peux venir avec (?:toi|vous|quelqu'un)|quelqu'un (?:a de la place|conduit|va en voiture)"),
  wortMuster('puedo ir (?:con|contigo)|alguien (?:tiene sitio|va en coche|conduce)'),
];

export function suchtMitfahrt(text) {
  const satz = norm(text);
  if (!MITFAHR_MUSTER.some((muster) => muster.test(satz))) return false;
  // Runde 3: „wer will bei mir mitfahren" enthält „mitfahren", sucht aber nichts — es bietet an.
  return !bietetMitfahrt(satz);
}

// --- Klingt nach Unternehmung → Chip „Als Meet vorschlagen" ---------------------------------
const UNTERNEHMUNG_MUSTER = [
  /\b(bock|lust|wer|wollen wir|sollen wir|jemand|zusammen)\b/i,
  /\b(anyone|who|shall we|should we|wanna|want to|fancy|up for|together|let's)\b/i,
  /\b(qui|quelqu'un|on fait|on refait|ça (?:vous|te) dit|chaude?s?|ensemble|on va)\b/i,
  /(quién|alguien|vamos|quedamos|repetimos|hacemos algo|os apetece|te apetece|se apunta|juntos)/i,
];

export function klingtNachUnternehmung(text) {
  const satz = norm(text);
  return /[?¿]/.test(satz) && UNTERNEHMUNG_MUSTER.some((muster) => muster.test(satz));
}

// Runde 4 (E7, gemessen): Am Handy tippt kaum jemand ein Fragezeichen. „wer hat heute Abend
// Zeit" blieb deshalb ohne Vorschlag, „wer hat heute abend zeit?" bekam einen. Ohne Fragezeichen
// zählt ein Satz jetzt, wenn er eindeutig einlädt oder nach freier Zeit fragt — und (siehe
// planErkennen) zusätzlich einen Tag, eine Uhrzeit oder „jetzt" nennt. „wer hat heute
// Geburtstag" oder „ich hab morgen keine Zeit" bleiben still.
const WORTE_BIS = (n) => `(?:[\\p{L}\\p{N}'-]+ ){0,${n}}`;
const EINLADUNG_MUSTER = [
  // Deutsch
  wortMuster(`wer (?:hat|hätte|haette|hätt|hätten) ${WORTE_BIS(3)}(?:zeit|lust|bock)`),
  wortMuster(`(?:hat|hätte|haette) (?:jemand|wer|einer|eine|irgendwer|ihr) ${WORTE_BIS(3)}(?:zeit|lust|bock)`),
  wortMuster(`(?:habt|hättet|haettet) ihr ${WORTE_BIS(3)}(?:zeit|lust|bock)`),
  wortMuster(`wer (?:kommt|käme|kaeme|will|möchte|moechte|mag|geht|ist|wäre|waere|wär) ${WORTE_BIS(4)}(?:mit|dabei|frei)`),
  wortMuster('(?:wollen|sollen|wolln|gehen|machen|treffen) wir|jemand (?:lust|bock|zeit)|(?:lust|bock) auf'),
  // Englisch
  wortMuster(`(?:who(?:'s| is| else is)?|anyone|anybody|everyone) ${WORTE_BIS(3)}(?:free|up for|keen|around|coming|down for|in for)`),
  wortMuster("(?:shall|should) we|let'?s|wanna|(?:are )?(?:you|u) free"),
  // Französisch
  wortMuster(`(?:qui|quelqu'un) ${WORTE_BIS(3)}(?:dispo|disponible|libre|chaud|chaude|partant|partante|vient)`),
  wortMuster("(?:on|si on) (?:va|fait|se fait)|ça (?:vous|te) dit"),
  // Spanisch
  wortMuster(`(?:quién|quien|alguien) ${WORTE_BIS(3)}(?:libre|puede|se apunta|viene|tiene tiempo)`),
  wortMuster('vamos|quedamos|(?:os|te) apetece'),
];

export function laedtEin(text) {
  const satz = norm(text);
  return EINLADUNG_MUSTER.some((muster) => muster.test(satz));
}

// Runde 4 (F2): „jetzt" ist ein Zeitpunkt wie „um 19 Uhr" — und wird als „Jetzt" vorgeschlagen,
// nicht als Uhrzeit, die eine Minute später schon Vergangenheit ist. Bewusst eng: „gleich"
// heißt auch „dasselbe", „ya" heißt auch „schon".
const JETZT_MUSTER = wortMuster("jetzt|grad jetzt|gerade jetzt|sofort|right now|now|maintenant|tout de suite|ahora(?: mismo)?");
const KEIN_JETZT = wortMuster('bis jetzt|ab jetzt|jetzt schon|jetzt erst|until now|by now|for now|know now|jusqu\'à maintenant|hasta ahora');

export function jetztIn(text) {
  const satz = norm(text);
  return JETZT_MUSTER.test(satz) && !KEIN_JETZT.test(satz);
}

// --- Aktivitäten ------------------------------------------------------------------------
// Bewusst eine eigene, geschlossene Liste: Ein Vorschlag „Als Meet" soll nur bei Dingen
// kommen, die man zusammen UNTERNIMMT — nicht bei „morgen Arbeit" oder „morgen Regen".
// Deutsche Zusammensetzungen dürfen weiterlaufen („Skitour", „Grillabend", „Kinoabend").
const AKTIVITAETEN = [
  // Deutsch
  'ski(?:fahren|tour\\p{L}*|tag|urlaub|gebiet|en)?', 'snowboard\\p{L}*', 'rodeln', 'schlitten\\p{L}*', 'langlauf\\p{L}*',
  'wander\\p{L}*', 'bergtour\\p{L}*', 'klettersteig\\p{L}*', 'kletter\\p{L}*', 'boulder\\p{L}*',
  'kino\\p{L}*', 'filmabend', 'konzert\\p{L}*', 'festival\\p{L}*', 'party\\p{L}*', 'feiern', 'grill\\p{L}*',
  'baden', 'badesee', 'schwimm\\p{L}*', 'sauna\\p{L}*', 'therme', 'joggen', 'laufen', 'lauftreff', 'radtour\\p{L}*',
  'radfahren', 'radeln', 'fahrradtour', 'mountainbike\\p{L}*', 'fußball\\p{L}*', 'fussball\\p{L}*', 'volleyball\\p{L}*',
  'beachvolleyball', 'basketball', 'tennis\\p{L}*', 'padel', 'squash', 'badminton', 'tischtennis', 'yoga', 'fitness\\p{L}*',
  'spieleabend\\p{L}*', 'brettspiel\\p{L}*', 'zocken', 'bowling', 'billard', 'darts', 'minigolf', 'eislaufen',
  'schlittschuh\\p{L}*', 'eishockey', 'museum', 'ausstellung', 'theater\\p{L}*', 'oper', 'kaffee trinken', 'brunch\\p{L}*',
  'frühstück\\p{L}*', 'fruehstueck', 'pizza\\p{L}*', 'sushi', 'burger', 'döner', 'kochen', 'kochabend', 'essen gehen',
  'abendessen', 'mittagessen', 'picknick', 'shoppen', 'flohmarkt', 'camping', 'zelten', 'kajak\\p{L}*', 'kanu\\p{L}*',
  'paddeln', 'segeln', 'surfen', 'angeln', 'spazieren', 'spaziergang', 'ausflug', 'roadtrip', 'karaoke', 'pubquiz', 'quiz',
  'tanzen', 'clubben', 'biergarten', 'weinprobe', 'cocktails?', 'golf\\p{L}*', 'escape ?room', 'lasertag', 'paintball',
  'an den see', 'zum see', 'eis essen',
  // Englisch
  'skiing', 'snowboarding', 'sledding', 'hiking', 'a hike', 'climbing', 'bouldering', 'cinema', 'the movies', 'a movie',
  'movie night', 'concert', 'a gig', 'drinks', 'the pub', 'pub', 'beers?', 'dinner', 'lunch', 'breakfast', 'bbq', 'barbecue',
  'swimming', 'a swim', 'the beach', 'the lake', 'spa day', 'running', 'jogging', 'a run', 'cycling', 'a bike ride', 'football',
  'soccer', 'the gym', 'board games', 'game night', 'gaming', 'ice skating', 'exhibition', 'theatre', 'coffee', 'ice cream',
  'picnic', 'shopping', 'kayaking', 'canoeing', 'sailing', 'surfing', 'fishing', 'a walk', 'pub quiz', 'dancing', 'clubbing',
  // Französisch
  'ski', 'luge', 'rando(?:nnée)?', 'randonnee', 'escalade', 'cinéma', 'ciné', 'concert', 'soirée', 'soiree', 'fête', 'apéro',
  'apero', 'un verre', 'resto', 'restaurant', 'dîner', 'déjeuner', 'dejeuner', 'piscine', 'baignade', 'plage', 'lac', 'footing',
  'vélo', 'velo', 'foot', 'volley', 'basket', 'jeux de société', 'soirée jeux', 'patinoire', 'musée', 'expo(?:sition)?',
  'théâtre', 'café', 'glace', 'pique-nique', 'marché', 'canoë', 'voile', 'surf', 'pêche', 'balade', 'promenade', 'karaoké', 'danse',
  // Spanisch
  'esquí', 'esqui', 'esquiar', 'senderismo', 'excursión', 'excursion', 'escalada', 'cine', 'peli', 'película', 'pelicula',
  'concierto', 'fiesta', 'cervezas?', 'birras?', 'copas?', 'tapas', 'cena', 'cenar', 'almuerzo', 'desayuno', 'barbacoa',
  'playa', 'lago', 'correr', 'bici', 'fútbol', 'futbol', 'voley', 'baloncesto', 'tenis', 'pádel', 'gimnasio',
  'juegos de mesa', 'bolos', 'billar', 'dardos', 'patinaje', 'museo', 'exposición', 'teatro', 'helado', 'compras',
  'mercadillo', 'piragüismo', 'pesca', 'paseo', 'bailar', 'discoteca',
];
const AKTIVITAET_MUSTER = wortMuster(AKTIVITAETEN.join('|'));
const ARTIKEL_VORN = /^(?:an den|zum|zur|am|ins|in die|to the|the|a|an|un|une|le|la|les|el|los|las)\s+/i;

/** Die erste Aktivität im Satz, so geschrieben wie getippt („Skifahren", „Kino") — oder null. */
export function aktivitaetIn(text) {
  const treffer = AKTIVITAET_MUSTER.exec(norm(text));
  if (!treffer) return null;
  const wort = treffer[0].replace(ARTIKEL_VORN, '').trim();
  return wort ? wort.charAt(0).toUpperCase() + wort.slice(1) : null;
}

// --- Tage -------------------------------------------------------------------------------
const WOCHENTAGE = [
  ['sonntag', 'sunday', 'dimanche', 'domingo'],
  ['montag', 'monday', 'lundi', 'lunes'],
  ['dienstag', 'tuesday', 'mardi', 'martes'],
  ['mittwoch', 'wednesday', 'mercredi', 'miércoles', 'miercoles'],
  ['donnerstag', 'thursday', 'jeudi', 'jueves'],
  ['freitag', 'friday', 'vendredi', 'viernes'],
  ['samstag', 'saturday', 'samedi', 'sábado', 'sabado'],
];
const DE_TAGESTEIL = '(?:abend|nachmittag|vormittag|mittag|früh|frueh|morgen|nacht)?s?';

const RELATIVE_TAGE = [
  { versatz: 2, muster: wortMuster('übermorgen|uebermorgen|après-demain|apres-demain|pasado ma[nñ]ana|the day after tomorrow') },
  { versatz: 1, muster: wortMuster('(?<!guten |heute |gestern |am |jeden |schönen |schoenen |einen schönen )morgen|tomorrow|tmrw|(?<!après-|apres-)demain|(?<!por la |de la |esta |pasado |la |cada )ma[nñ]ana') },
  { versatz: 0, muster: wortMuster("heute|heut|today|tonight|tonite|aujourd'hui|ce soir|cet après-midi|hoy|esta noche|esta tarde") },
];
const WOCHENENDE = wortMuster('wochenende|weekend|week-end|finde|fin de semana');
const WOCHE_OHNE_TAG = wortMuster('diese woche|nächste woche|naechste woche|this week|next week|cette semaine|la semaine prochaine|esta semana|la semana que viene|la pr[oó]xima semana');

function isoTag(datum) {
  return `${datum.getFullYear()}-${String(datum.getMonth() + 1).padStart(2, '0')}-${String(datum.getDate()).padStart(2, '0')}`;
}
function plusTage(heute, tage) {
  const datum = new Date(heute.getFullYear(), heute.getMonth(), heute.getDate());
  datum.setDate(datum.getDate() + tage);
  return isoTag(datum);
}

/**
 * Welcher Tag ist gemeint? → { datum: 'YYYY-MM-DD'|null, zeitwort: true } oder null.
 * „diese Woche" ist ein Zeitwort ohne festen Tag (datum null). Ein Wochentag meint den
 * nächsten dieses Namens — am Samstag gesagt „Samstag" also den in einer Woche.
 */
export function tagIn(text, heute = new Date()) {
  const satz = norm(text);
  const kandidaten = [];
  for (const { versatz, muster } of RELATIVE_TAGE) {
    const treffer = muster.exec(satz);
    if (treffer) kandidaten.push({ stelle: treffer.index, datum: plusTage(heute, versatz) });
  }
  WOCHENTAGE.forEach((namen, tag) => {
    const muster = wortMuster(`(?:${namen[0]})${DE_TAGESTEIL}|${namen.slice(1).join('|')}`);
    const treffer = muster.exec(satz);
    if (!treffer) return;
    const abstand = (tag - heute.getDay() + 7) % 7 || 7;
    kandidaten.push({ stelle: treffer.index, datum: plusTage(heute, abstand) });
  });
  const wochenende = WOCHENENDE.exec(satz);
  if (wochenende) {
    const tag = heute.getDay();
    kandidaten.push({ stelle: wochenende.index, datum: plusTage(heute, tag === 6 || tag === 0 ? 0 : 6 - tag) });
  }
  if (kandidaten.length) {
    kandidaten.sort((a, b) => a.stelle - b.stelle);
    return { datum: kandidaten[0].datum, zeitwort: true };
  }
  if (WOCHE_OHNE_TAG.test(satz)) return { datum: null, zeitwort: true };
  return null;
}

// --- Uhrzeiten --------------------------------------------------------------------------
// Nur, was nach einem Zeitpunkt klingt: „19:30", „um 19 Uhr", „at 7pm", „à 19h", „a las 8".
// „bis 21 Uhr geblieben", „seit 18 Uhr", „until 9" sind keine Vorschläge. Ein nacktes „ab 9"
// ohne „Uhr" bleibt ebenfalls stehen — es war in der Freitag-Crew die Antwort auf eine Wanderung.
const UHR_MUSTER = [
  { muster: /(?<![\p{L}\p{N}:])([01]?\d|2[0-3]):([0-5]\d)(?![\p{N}])/gu },
  { muster: /(?<![\p{L}\p{N}])([01]?\d|2[0-3])(?:[.:]([0-5]\d))?\s*uhr(?![\p{L}])/giu },
  { muster: /(?<![\p{L}\p{N}])(?:um|at|à|a las|a la)\s+([01]?\d|2[0-3])(?:[.:h]([0-5]\d))?(?:\s*(am|pm|h))?(?![\p{L}\p{N}])/giu, englischOhne: true },
  { muster: /(?<![\p{L}\p{N}])(1[0-2]|0?[1-9])(?::([0-5]\d))?\s*(am|pm)(?![\p{L}])/giu },
  { muster: /(?<![\p{L}\p{N}])([01]?\d|2[0-3])h([0-5]\d)(?![\p{N}])/giu },
  { muster: /(?<![\p{L}\p{N}])(?:vers|dès|des)\s+([01]?\d|2[0-3])\s*h(?![\p{L}\p{N}])/giu },
];
// „halb 8" ist bewusst nicht dabei: morgens oder abends lässt sich daraus nicht ablesen, und
// ein Vorschlag „07:30" für ein Abendtreffen wäre genau die Sorte Mitdenken, die nervt.
const KEIN_ZEITPUNKT_DAVOR = /(?<![\p{L}])(?:bis|seit|vor|nach|until|till|since|before|after|jusqu'à|jusqu'a|depuis|avant|après|apres|hasta|desde|antes de|después de|despues de)\s*(?:um|at|à|a las)?\s*$/iu;

/** Die erste Uhrzeit, die nach Zeitpunkt klingt, als „HH:MM" — oder null. */
export function uhrzeitIn(text) {
  const satz = norm(text);
  const funde = [];
  for (const { muster, englischOhne } of UHR_MUSTER) {
    muster.lastIndex = 0;
    let treffer;
    while ((treffer = muster.exec(satz))) {
      if (KEIN_ZEITPUNKT_DAVOR.test(satz.slice(0, treffer.index))) continue;
      let stunde = Number(treffer[1]);
      const minute = Number(treffer[2] || 0);
      const zusatz = String(treffer[3] || '').toLowerCase();
      if (zusatz === 'pm' && stunde < 12) stunde += 12;
      if (zusatz === 'am' && stunde === 12) stunde = 0;
      // „at 7" ohne am/pm: unter Freund:innen ist das Abend.
      if (englischOhne && !zusatz && /^at\s/i.test(treffer[0]) && stunde >= 1 && stunde <= 6) stunde += 12;
      if (stunde > 23 || minute > 59) continue;
      funde.push({ stelle: treffer.index, zeit: `${String(stunde).padStart(2, '0')}:${String(minute).padStart(2, '0')}` });
    }
  }
  if (!funde.length) return null;
  funde.sort((a, b) => a.stelle - b.stelle);
  return funde[0].zeit;
}

// --- Plan: Aktivität + Zeit → „Als Meet vorschlagen" ----------------------------------------
/**
 * Klingt der Satz nach einem Vorhaben? → null oder
 * { aktivitaet: 'Skifahren'|null, datum: 'YYYY-MM-DD'|null, uhrzeit: 'HH:MM'|null }.
 * Entweder eine Aktivität mit Zeitwort bzw. Uhrzeit („morgen Skifahren", „Kino um 20 Uhr")
 * oder die bisherige Frage nach einer Unternehmung („Wer hätte Samstag Bock auf …?").
 */
export function planErkennen(text, heute = new Date()) {
  const satz = norm(text);
  const aktivitaet = aktivitaetIn(satz);
  const tag = tagIn(satz, heute);
  const uhrzeit = uhrzeitIn(satz);
  const frage = klingtNachUnternehmung(satz);
  // Runde 4 (E7): Einladungen ohne Fragezeichen („wer hat heute Abend Zeit") zählen, wenn ein
  // Zeitpunkt dabei ist — sonst wäre jedes „wer will mit" ein Plan.
  const einladung = laedtEin(satz);
  // Runde 4 (F2): „jetzt" ist ein Zeitpunkt — aber nur in einer Frage, Einladung oder einem ganz
  // kurzen Satz („kino jetzt"). „Das Kino war super, jetzt heim" ist kein Plan.
  const kurz = satz.trim().split(/\s+/).filter(Boolean).length <= 3;
  const jetzt = !tag && !uhrzeit && jetztIn(satz) && (frage || einladung || kurz);
  const mitJetzt = (plan) => (jetzt ? { ...plan, datum: plan.datum || isoTag(heute), jetzt: true } : plan);
  if (aktivitaet && (tag || uhrzeit || jetzt)) return mitJetzt({ aktivitaet, datum: tag?.datum || null, uhrzeit });
  if (frage || (einladung && (tag || uhrzeit || jetzt))) {
    return mitJetzt({ aktivitaet: aktivitaet || lustAuf(satz), datum: tag?.datum || null, uhrzeit });
  }
  return null;
}

/**
 * Meinen zwei Bezeichnungen dasselbe Vorhaben? „Bouldern" ↔ „Boulder-Dienstag",
 * „Kino" ↔ „Kino: Dune Part 3". Verglichen werden Wortanfänge ab vier Buchstaben.
 */
export function gleichesVorhaben(a, b) {
  const worte = (text) => ohneAkzent(text).split(/[^\p{L}\p{N}]+/u).filter((w) => w.length >= 4);
  const links = worte(a);
  const rechts = worte(b);
  return links.some((l) => rechts.some((r) => {
    const laenge = Math.min(5, l.length, r.length);
    return l.slice(0, laenge) === r.slice(0, laenge);
  }));
}
