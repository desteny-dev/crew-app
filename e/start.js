// Einladungsseite (V1-Kern §6) — der Einstieg.
//
// Warum zwei Module (start.js + ansicht.js)? Wer den Link im Messenger antippt, wartet auf zwei
// Dinge: die Vorschau vom Server und den Code, der sie zeichnet (Übersetzungen, Zeichen, Daten).
// Dieses Modul hat nur winzige Abhängigkeiten und fragt den Server SOFORT; das Zeichnen lädt
// währenddessen (index.html lädt es per modulepreload vor). Die Wartezeit ist so das Längere der
// beiden, nicht ihre Summe. Bis dahin steht der Platzhalter aus index.html — ohne Skript.

import { einladungDaten, codeAusAdresse } from './daten.js';

const code = codeAusAdresse();
const daten = einladungDaten();
const ersteAntwort = code ? daten.ansehen(code) : Promise.resolve({ ok: false, grund: 'unbekannt' });

import('./ansicht.js')
  .then(({ einladungZeigen }) => einladungZeigen({ code, daten, ersteAntwort }))
  .catch(() => {
    // Das Zeichnen ließ sich nicht laden (Netz weg mitten im Laden). Ehrlich sagen, nicht ewig drehen.
    const ziel = document.getElementById('einladung');
    if (!ziel) return;
    ziel.dataset.zustand = 'offline';
    ziel.innerHTML = '<section class="ein-lage" data-role="einladung-lage"><h1 class="ein-satz">Keine Verbindung</h1>'
      + '<p class="ein-text">Die Seite konnte nicht vollständig laden.</p>'
      + '<a class="ein-knopf" href="" data-role="einladung-nochmal">Nochmal versuchen</a></section>';
  });
