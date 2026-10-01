// V1-Kern §6: Beispiel-Links für den Demo-Modus.
//
// Im Gerät gibt es nur EINE Person (mich). Damit „Link öffnen → Bin dabei → befreundet und zugesagt"
// im Demo-Modus überhaupt vorführbar ist, liegen hier zwei Links, die ANDERE geteilt haben:
//   · KN7BRAND — Nina (noch keine Freundin, steht im Einladungs-Verzeichnis) lädt zu einem Meet ein,
//     bei dem ich noch nicht dabei bin. Einlösen macht Nina zur Freundin und mich zum Teilnehmer.
//   · MR4FND2X — Mira (schon befreundet) teilt einen Find-Tipp.
// Alles hier ist Beispiel und im Demo-Modus als solches erkennbar (wie der ganze Beispielbestand).

import { t } from '../../core/sprache.js';
import { PEOPLE } from '../ids.js';
import { toISODate, now } from '../../core/dates.js';

export const DEMO_NINA_ID = 'p-nina';

// Der Meet, zu dem Nina einlädt — liegt NICHT in meinen Meets, bis ich den Link einlöse.
export function demoFremderMeet(jetzt = now()) {
  const morgen = new Date(jetzt);
  morgen.setDate(morgen.getDate() + 1);
  return {
    id: 'm-nina-openair',
    title: t('Open-Air-Kino am See'),
    icon: '🎬',
    iconKey: 'film',
    category: 'event',
    date: toISODate(morgen),
    time: '20:30',
    endTime: '',
    openTime: false,
    nowTime: false,
    place: { name: t('Seebühne Bregenz'), address: 'Seestraße, 6900 Bregenz', lat: 47.5057, lon: 9.7401 },
    crewId: null,
    personIds: [DEMO_NINA_ID, PEOPLE.KIRA],
    creatorId: DEMO_NINA_ID,
    status: 'open',
    participation: { [DEMO_NINA_ID]: 'yes', [PEOPLE.KIRA]: 'yes' },
    note: '',
    placePending: false,
    variants: [],
    bring: [],
    polls: [],
    loop: null,
  };
}

export const DEMO_FREMDE_LINKS = {
  KN7BRAND: { code: 'KN7BRAND', art: 'meet', id: 'm-nina-openair', von: DEMO_NINA_ID },
  MR4FND2X: { code: 'MR4FND2X', art: 'tipp', id: 'f-rappenloch', von: PEOPLE.MIRA },
};
