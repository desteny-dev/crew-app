// Screen-Registry: Routen-ID → render(ctx) → { html, bind? }.
// Routen-IDs sind in docs/FRAMEWORK.md und reference/runtime-state-map.json verankert.

import { crewScreens } from './crew.js';
// Runde 7: Die Karte ist ein eigener Haupt-Tab (Route 'karte.home'), keine Unteransicht mehr.
import { karteScreens } from './karte.js';
import { meetBrowserScreens } from './meet-browser.js';
import { meetDetailScreens } from './meet-details.js';
import { newMeetScreens } from './new-meet.js';
import { roomScreens } from './room.js';
import { profileScreens } from './profile.js';

// Runde 8 (R8-66): Find — der fuenfte Bereich, in der Mitte (Route 'find.home', core/router.js).
// Seine Seiten stehen in screens/find.js. Geladen wird die Datei VOR dem ersten Zeichnen (await),
// damit die Tab-Leiste von Anfang an stimmt — aber so, dass ein Fehler darin nur Find kostet und
// nicht die ganze App: Find haengt an neuen Daten (repo.getFindEintraege) und bekommt spaeter
// Jonathans Algorithmus (R8-50); es ist der juengste und am wenigsten erprobte Teil. Fehlt die
// Seite, bietet app.js den Tab gar nicht erst an (kein Knopf ohne Wirkung, Hausregel 9).
// Laut, nicht still: der Grund steht in der Konsole, und scratch/r8b-form.mjs sichert zu, dass
// Find wirklich da ist.
let findScreens = {};
try {
  const modul = await import('./find.js');
  if (modul.findScreens && typeof modul.findScreens === 'object') findScreens = modul.findScreens;
  else console.error('[Crew] screens/find.js liefert kein findScreens — Find wird nicht angeboten.');
} catch (fehler) {
  console.error('[Crew] Find konnte nicht geladen werden — Find wird nicht angeboten:', fehler?.message || fehler);
}

export const screens = {
  ...crewScreens,
  ...karteScreens,
  ...meetBrowserScreens,
  ...meetDetailScreens,
  ...newMeetScreens,
  ...roomScreens,
  ...profileScreens,
  ...findScreens,
};

// Übergangs-Fallback während des Aufbaus: Solange ein Bereichs-Agent seine Screens noch
// nicht geliefert hat, zeigt die Route den zugehörigen inneren Referenz-Screen statisch an.
export const ROUTE_REFERENCE_FALLBACK = {
  'meet.home': '05.1 Meet Liste',
  'meet.details': '05.6 Einladung ohne Variante',
  'meet.review': '05.10 Abgeschlossen',
  'newMeet.discover': '08.1 Erstellen Entdecken',
  'room.view': '07.2 Crew-Raum Meet-Panel',
  'room.allMeets': '07.4 Alle Meets',
  'room.crewDetails': '07.5 Crew-Details',
  'room.personDetails': '07.6 Person-Details',
  'room.newCrew': '07.7 Neue Crew',
  'profile.home': '06.1 Profil',
  'profile.myMeets': '06.2 Meine Meets',
  'profile.friends': '06.11 Freunde',
};
