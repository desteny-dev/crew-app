// Seed: alles, was nur RELATIV ZU JETZT einen Sinn ergibt (Runde 7).
//
// Ankünfte und flüchtige Fragen sind Minuten alt, nicht Tage. Ein fester Zeitstempel im Seed
// wäre nach einer Stunde falsch und nach einem Tag abgelaufen — genau die Sorte Beispieldaten,
// die beim Vorführen nichts mehr zeigt. Deshalb sind es Funktionen, die beim Anlegen des
// Demo-Bestands laufen.
import { ME, PEOPLE, MEETS } from '../ids.js';

const MIN = 60000;

// A6: Am laufenden Meet (Strandbad + Pizza) sind zwei schon da — Mira zuerst, dann Ayla.
// Genau dieser Zustand macht „zwei sind schon da" ohne einen einzigen Handgriff sichtbar;
// meine eigene Ankunft fehlt bewusst, damit „Ich bin da" wirklich etwas zu tun hat.
export function seedAnkuenfte(jetzt = Date.now()) {
  return {
    [MEETS.STRANDBAD]: {
      [PEOPLE.MIRA]: jetzt - 23 * MIN,
      [PEOPLE.AYLA]: jetzt - 6 * MIN,
    },
  };
}

// E5: Eine erhaltene Frage „Hast du Zeit?", 25 Minuten alt und unbeantwortet — sie lebt noch
// gut eine Stunde. Dazu eine eigene, bereits beantwortete Frage an Sam, damit auch der Zustand
// „beantwortet" sofort zu sehen ist, ohne dass man erst selbst fragen muss.
export function seedFragen(jetzt = Date.now(), gueltigMs = 2 * 60 * MIN) {
  return [
    {
      id: 'frage-seed-1',
      vonId: PEOPLE.TOBI,
      anId: ME,
      crewId: null,
      zielSchluessel: `p:${ME}`,
      at: jetzt - 25 * MIN,
      bis: jetzt - 25 * MIN + gueltigMs,
      antwort: null,
      antwortAt: 0,
    },
    {
      id: 'frage-seed-2',
      vonId: ME,
      anId: PEOPLE.SAM,
      crewId: null,
      zielSchluessel: `p:${PEOPLE.SAM}`,
      at: jetzt - 40 * MIN,
      bis: jetzt - 40 * MIN + gueltigMs,
      antwort: 'ja',
      antwortAt: jetzt - 36 * MIN,
    },
  ];
}
