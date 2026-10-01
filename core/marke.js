// Der Name der App an EINER Stelle (V1-Kern, Auftrag §9).
//
// Entschieden am 25.09.2026: Der Name ist „Crew", die Kennung at.desteny.crew bleibt. Trotzdem
// kommen sichtbarer Name, Slogan und die Namen in Mitteilungen, Einladungsseite, Teilen- und
// Store-Texten von HIER — damit eine spätere Textänderung eine Zeile ist und nicht vierzig.
//
// Wer liest was:
//   · Oberfläche (JavaScript): `import { MARKE, markeText } from '../core/marke.js'`. In übersetzten
//     Sätzen steht der Name als Platzhalter: t('{name} braucht …', { name: MARKE.name }).
//   · Dateien ohne JavaScript (index.html, manifest.json, konto-loeschen.html, Einladungsseite,
//     Android-/iOS-Hülle, Capacitor, Mail- und Store-Texte) schreibt `node scripts/marke-anwenden.mjs`
//     aus diesem Modul. `npm run lint` meldet jede Stelle, die davon abweicht.
//
// Funktionen heißen schlicht (Auftrag §9): „Crew Score" (die Zahl 0–100) und „Top Picks" (die besten
// Tipps). Keine anderen Kunstnamen. Der Slogan steht in allen vier Sprachen hier, weil er zur Marke
// gehört und nicht zum Wörterbuch (VERSION_1.md §6: Marke, Name und Slogan werden bewusst gesetzt).
//
// Dieses Modul hat KEINE Importe: Node-Skripte und der Browser laden es gleich.

export const MARKE = Object.freeze({
  name: 'Crew',
  // Der Schriftzug auf Start- und Willkommensschirm („crew." mit grünem Punkt).
  wortmarke: 'crew',
  kennung: 'at.desteny.crew',
  slogan: Object.freeze({
    de: 'Sehen, wer Zeit hat. Und daraus etwas machen.',
    en: "See who's free. And make something of it.",
    fr: 'Voir qui est libre. Et en faire quelque chose.',
    es: 'Mira quién tiene tiempo. Y monta un plan.',
  }),
  // Die kurze Zeile (App-Karte, Manifest, Store-Untertitel).
  kurz: Object.freeze({
    de: 'Wer ist frei? Was machen wir?',
    en: "Who's free? What are we doing?",
    fr: 'Qui est libre ? On fait quoi ?',
    es: '¿Quién está libre? ¿Qué hacemos?',
  }),
  // Ein Satz für Manifest und Store (Untertitel/Kurzbeschreibung).
  beschreibung: Object.freeze({
    de: 'Wer ist frei? Was machen wir? — Treffen mit Freunden, ohne Gruppenchat-Chaos.',
    en: "Who's free? What are we doing? — Meet up with friends, without group-chat chaos.",
    fr: 'Qui est libre ? On fait quoi ? — Se voir entre amis, sans le chaos des groupes.',
    es: '¿Quién está libre? ¿Qué hacemos? — Quedar con amigos, sin el caos del grupo.',
  }),
  score: 'Crew Score',
  topPicks: 'Top Picks',
  topPick: 'Top Pick',
  // Öffentliche Adresse der Web-App; geteilte Links zeigen auf <webAdresse>e/?c=<code>.
  webAdresse: 'https://desteny-dev.github.io/crew-app/',
  // Store-Einträge: leer, solange die App dort nicht steht. Die Einladungsseite zeigt einen
  // Store-Knopf nur, wenn hier eine Adresse steht — sonst führt „Bin dabei" in die Web-App.
  storeApple: '',
  storeGoogle: '',
});

const SPRACHEN = ['de', 'en', 'fr', 'es'];

// Slogan oder Kurzzeile in einer Sprache; unbekannte Sprache → Deutsch.
export function markeText(feld, sprache = 'de') {
  const wert = MARKE[feld];
  if (!wert || typeof wert !== 'object') return String(wert ?? '');
  const code = String(sprache || 'de').slice(0, 2);
  return wert[SPRACHEN.includes(code) ? code : 'de'] || wert.de;
}
