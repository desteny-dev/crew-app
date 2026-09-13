// Screen-Registry: Routen-ID → render(ctx) → { html, bind? }.
// Routen-IDs sind in docs/FRAMEWORK.md und reference/runtime-state-map.json verankert.

import { crewScreens } from './crew.js';
import { meetBrowserScreens } from './meet-browser.js';
import { meetDetailScreens } from './meet-details.js';
import { newMeetScreens } from './new-meet.js';
import { roomScreens } from './room.js';
import { profileScreens } from './profile.js';

export const screens = {
  ...crewScreens,
  ...meetBrowserScreens,
  ...meetDetailScreens,
  ...newMeetScreens,
  ...roomScreens,
  ...profileScreens,
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
