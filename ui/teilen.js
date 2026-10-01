// Einen Meet oder einen Find-Tipp als Link teilen (V1-Kern, Auftrag §6) — EIN Weg für alle Stellen
// (Neues Meet ohne Personen, Meet-Seite, Find-Tipp).
//
//   import { linkTeilen } from '../ui/teilen.js';
//   const ergebnis = await linkTeilen({ repo, art: 'meet', id: meetId, toast: ctx.toast });
//   // → { ok, weg: 'teilen'|'kopiert'|'abgebrochen'|'fehler', code, url }
//
// WICHTIG für Aufrufer: linkTeilen SOFORT im Tipp-Handler aufrufen, ohne `await` davor. Safari gibt
// das Teilen-Blatt nur her, solange die Berührung „frisch" ist — nach ein paar awaits ist sie
// verbraucht und das Blatt kommt nie. Deshalb liefert repo.teilLinkErstellen den Link synchron
// (Code entsteht im Gerät; der Server bekommt ihn im Hintergrund) und das erste await hier ist das
// Teilen selbst.

import { kann, huellePlugin } from '../core/native.js';
import { t } from '../core/sprache.js';
import { MARKE } from '../core/marke.js';

async function inZwischenablage(text) {
  try {
    if (globalThis.navigator?.clipboard?.writeText) { await globalThis.navigator.clipboard.writeText(text); return true; }
  } catch { /* verweigert — dann der alte Weg */ }
  try {
    const feld = document.createElement('textarea');
    feld.value = text;
    feld.setAttribute('readonly', '');
    feld.style.cssText = 'position:fixed;left:-9999px;top:0';
    document.body.appendChild(feld);
    feld.select();
    const ok = document.execCommand('copy');
    feld.remove();
    return Boolean(ok);
  } catch { return false; }
}

// Ein abgebrochenes Teilen-Blatt ist KEIN Fehler — da hat der Mensch selbst „nein" gesagt.
const abgebrochen = (fehler) => fehler?.name === 'AbortError' || /abort|cancel/i.test(String(fehler?.message || ''));

/**
 * Teilt den Link zu einem Meet oder Tipp. Reihenfolge: Teilen-Blatt der Hülle → Teilen-Blatt des
 * Browsers → Zwischenablage (mit Toast „Link kopiert"). Nie ein stiller Fehlschlag.
 */
export async function linkTeilen({ repo, art, id, toast } = {}) {
  const link = typeof repo?.teilLinkErstellen === 'function' ? repo.teilLinkErstellen({ art, id }) : null;
  if (!link?.ok || !link.url) {
    toast?.(link?.grund === 'vorbei' ? t('Dieses Meet ist schon vorbei') : t('Link konnte nicht erstellt werden'));
    return { ok: false, weg: 'fehler', code: '', url: '' };
  }
  const { code, url } = link;
  const text = link.text || '';
  const lage = kann('teilen');
  if (lage.wie === 'nativ') {
    const plugin = huellePlugin('Share', ['share']);
    if (typeof plugin?.share === 'function') {
      try { await plugin.share({ title: MARKE.name, text, url }); return { ok: true, weg: 'teilen', code, url }; } catch (fehler) {
        if (abgebrochen(fehler)) return { ok: true, weg: 'abgebrochen', code, url };
      }
    }
  } else if (lage.wie === 'web' && typeof globalThis.navigator?.share === 'function') {
    try { await globalThis.navigator.share({ title: MARKE.name, text, url }); return { ok: true, weg: 'teilen', code, url }; } catch (fehler) {
      if (abgebrochen(fehler)) return { ok: true, weg: 'abgebrochen', code, url };
    }
  }
  const ok = await inZwischenablage(text ? `${text} ${url}` : url);
  toast?.(ok ? t('Link kopiert') : t('Link konnte nicht kopiert werden'));
  return { ok, weg: ok ? 'kopiert' : 'fehler', code, url };
}
