// Profilbild-Emojis (Runde 5, B1). Jonathan: „Füge bei Profilbild auch Emoji hinzu, nichts Komplexes."
//
// Runde 8 (R8-13, Jonathan: „Emoji über die eigene Tastatur, Buchstaben abgelehnt."): Die feste
// Auswahl von 35 Emojis ist entfallen. Stattdessen ein Eingabefeld — jedes Emoji, das die
// Tastatur des Handys kennt, und nur Emojis: Was kein Bildzeichen ist, nimmt emojiAusEingabe()
// nicht an. Das Emoji steht groß auf dem gewählten Hintergrund, genau wie ein Motiv.
//
// Gespeichert wird es im Wort des Profilbilds als `e=` mit den Unicode-Codepunkten in Hex,
// getrennt durch „-" (web/ui/profilbild.js):  motiv:e=1f60e;g=see
// So bleibt das Wort reines ASCII und kurz; jedes gültige Wort wird gezeichnet — auch eines aus
// der früheren festen Auswahl.

// Ein Beispiel für die Kachel „Emoji" — gewählt wird damit nichts.
export const BEISPIEL_EMOJI = '1f600';

// Bis zu zwölf Codepunkte: auch Familien- und Paar-Emojis mit Hautton passen hinein.
const HEX_FOLGE = /^[0-9a-f]{2,6}(-[0-9a-f]{2,6}){0,11}$/;
// Ein Bildzeichen: Emoji im engeren Sinn (Extended_Pictographic), Flaggen (zwei regionale
// Buchstaben) und Tasten-Emojis (1️⃣ — Ziffer mit Tastenrahmen U+20E3).
const BILDZEICHEN = /\p{Extended_Pictographic}|\p{Regional_Indicator}|\u20E3/u;

// Das Zeichen zu einem Schlüssel — '' wenn der Schlüssel nicht lesbar ist.
export function emojiZeichen(key) {
  const wert = String(key || '').toLowerCase();
  if (!HEX_FOLGE.test(wert)) return '';
  try {
    const punkte = wert.split('-').map((teil) => Number.parseInt(teil, 16));
    if (punkte.some((p) => !Number.isFinite(p) || p > 0x10ffff)) return '';
    return String.fromCodePoint(...punkte);
  } catch {
    return '';
  }
}

export function gueltigesEmoji(key) {
  return Boolean(emojiZeichen(key));
}

// Schlüssel eines Zeichens: seine Codepunkte in Hex, getrennt durch „-".
export function emojiSchluessel(zeichen) {
  return [...String(zeichen || '')].map((z) => z.codePointAt(0).toString(16)).join('-');
}

function graphemeVon(text) {
  if (typeof Intl !== 'undefined' && typeof Intl.Segmenter === 'function') {
    return [...new Intl.Segmenter(undefined, { granularity: 'grapheme' }).segment(text)].map((g) => g.segment);
  }
  return [text];
}

// Was jemand ins Emoji-Feld getippt hat → das (letzte) Emoji darin, oder null.
// Buchstaben, Ziffern und Satzzeichen allein sind kein Emoji — sie werden abgelehnt.
export function emojiAusEingabe(text) {
  const wert = String(text || '').normalize('NFC').trim();
  if (!wert) return null;
  const treffer = graphemeVon(wert).filter((g) => BILDZEICHEN.test(g)
    && ![...g].some((z) => /\p{L}/u.test(z)));
  const zeichen = treffer[treffer.length - 1];
  if (!zeichen) return null;
  const key = emojiSchluessel(zeichen);
  return gueltigesEmoji(key) ? { key, zeichen: emojiZeichen(key) } : null;
}
