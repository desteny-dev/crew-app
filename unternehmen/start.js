// Ortsseite (Paket H) — der Einstieg. Fragt den Server SOFORT (öffentlich, ohne Bibliothek); das Zeichnen
// lädt währenddessen (ort.html lädt es per modulepreload vor) — wie die Einladungsseite (web/e/start.js).

import { ortAusAdresse } from './pfad.js';
import { ortSeite } from './daten.js';

const MERKER = 'crew.unternehmen.ort';

// Ohne ?ort= kommt man hier nur über einen Rückweg an (Link aus der Bestätigungsmail, Apple/Google):
// dann gilt der Ort, den diese Seite sich zuletzt gemerkt hat.
let ort = ortAusAdresse();
if (!ort) {
  try { ort = globalThis.localStorage?.getItem(MERKER) || ''; } catch { ort = ''; }
}
const erste = ort ? ortSeite(ort) : Promise.resolve({ ok: false, grund: 'unbekannt' });

import('./ansicht.js')
  .then(({ seiteZeigen }) => seiteZeigen({ ort, erste }))
  .catch(() => {
    const ziel = document.getElementById('ort');
    if (!ziel) return;
    ziel.dataset.zustand = 'offline';
    ziel.setAttribute('aria-busy', 'false');
    ziel.innerHTML = '<section class="ort-lage" data-role="ort-lage"><h1>Keine Verbindung</h1>'
      + '<p class="ort-text">Die Seite konnte nicht vollständig laden.</p>'
      + '<a class="ort-knopf" href="">Nochmal versuchen</a></section>';
  });
