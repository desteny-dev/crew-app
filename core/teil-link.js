// V1-Kern §6: Adresse und Begleittext eines geteilten Links — für BEIDE Gateways dieselbe Regel.
//
// Die Adresse zeigt immer auf die Einladungsseite (<Ordner der Web-App>e/?c=<code>). In der Handy-App
// gibt es keinen öffentlichen Ordner (die Hülle läuft unter https://localhost bzw. capacitor://…),
// dort gilt MARKE.webAdresse. Im Browser gilt der Ordner, aus dem die App gerade läuft — so zeigt ein
// örtlicher Prüflauf auf die örtliche Einladungsseite und die veröffentlichte App auf die öffentliche.

import { istHuelle } from './native.js';
import { MARKE } from './marke.js';
import { teilLinkAdresse } from './einladung.js';
import { t } from './sprache.js';
import { terminText } from './dates.js';

export function teilLinkBasis() {
  if (istHuelle()) return MARKE.webAdresse;
  const ort = globalThis.location;
  if (!ort || !/^https?:$/.test(ort.protocol)) return MARKE.webAdresse;
  return `${ort.origin}${ort.pathname.replace(/[^/]*$/, '')}`;
}

export function teilLinkUrl(code) {
  return teilLinkAdresse(code, teilLinkBasis());
}

// Der Satz, der im Messenger ÜBER dem Link steht. Die Vorschau-Karte darunter ist für alle Links
// gleich (die Einladungsseite ist eine feste Seite — Supabase liefert keine eigenen HTML-Seiten aus,
// siehe STAND.md); deshalb trägt dieser Satz das, was die Karte nicht sagen kann: was und wann.
export function teilText({ art, meet, tipp } = {}) {
  if (art === 'meet' && meet) {
    const was = String(meet.title || '').trim() || t('Treffen');
    return t('{was} · {wann}. Bist du dabei?', { was, wann: terminText(meet) });
  }
  if (art === 'tipp' && tipp) {
    const was = String(tipp.titel || tipp.title || '').trim();
    return was ? t('{was} — hast du Lust?', { was }) : t('Hast du Lust?');
  }
  return '';
}
