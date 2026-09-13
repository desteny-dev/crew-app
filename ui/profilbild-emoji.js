// Profilbild-Emojis (Runde 5, B1). Jonathan: „Füge bei Profilbild auch Emoji hinzu, nichts Komplexes."
//
// Eine feste, kurze Auswahl gängiger Emojis — keine Tastatur, keine Suche. Das Emoji steht groß
// auf dem gewählten Hintergrund (Farbe, Verlauf, Muster), genau wie ein Motiv.
//
// Gespeichert wird es im Wort des Profilbilds als `e=` mit den Unicode-Codepunkten in Hex,
// getrennt durch „-" (web/ui/profilbild.js):  motiv:e=1f60e;g=see
// So bleibt das Wort reines ASCII, kurz und unabhängig davon, ob ein Emoji später aus dieser
// Liste fällt: Jedes gültige Wort wird weiter gezeichnet.

import { t } from '../core/sprache.js';

const LISTE = [
  // Gesichter
  ['1f600', t('Grinsen')], ['1f60e', t('Sonnenbrille')], ['1f973', t('Party')], ['1f602', t('Tränen lachen')], ['1f60d', t('Verliebt')],
  ['1f913', t('Nerd')], ['1f61c', t('Frech')], ['1f607', t('Engel')], ['1f920', t('Cowboy')], ['1f634', t('Müde')],
  ['1f47b', t('Geist')], ['1f47d', t('Alien')], ['1f916', t('Roboter')], ['1f451', t('Krone')], ['1f48e', t('Diamant')],
  // Zeichen und Natur
  ['2764-fe0f', t('Herz')], ['1f525', t('Feuer')], ['2b50', t('Stern')], ['26a1', t('Blitz')], ['1f308', t('Regenbogen')],
  ['2600-fe0f', t('Sonne')], ['1f319', t('Mond')], ['1f340', t('Kleeblatt')], ['1f338', t('Blüte')], ['1f30a', t('Welle')],
  // Freizeit
  ['26bd', t('Fußball')], ['1f3c0', t('Basketball')], ['1f3ae', t('Gaming')], ['1f3b8', t('Gitarre')], ['1f3a7', t('Kopfhörer')],
  ['1f680', t('Rakete')], ['1f355', t('Pizza')], ['2615', t('Kaffee')], ['1f366', t('Eis')], ['1f389', t('Konfetti')],
];

const HEX_FOLGE = /^[0-9a-f]{2,6}(-[0-9a-f]{2,6}){0,7}$/;

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

export const PB_EMOJIS = LISTE.map(([key, name]) => ({ key, name, zeichen: emojiZeichen(key) }));
