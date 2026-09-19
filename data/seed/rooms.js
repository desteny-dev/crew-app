// Seed: Raum-Nachrichten (Quelle: reference 07.x). Räume existieren pro Crew und pro Person;
// hier liegen nur die vorbefüllten Nachrichten. Referenzgetreu verfeinert:
//   Freitag-Crew  → 07.1/07.2-Verlauf + genug Ungelesenes für Catch-up (07.8/07.9)
//   Mira (1:1)    → 07.3-Verlauf zum aktiven Meet
//   Tobi (1:1)    → simulierte EMPFANGENE Anstups-Karte (Vertrag §8)
import { ME, PEOPLE, CREWS, MEETS, roomIdForCrew, roomIdForPerson, roomIdForMeet } from '../ids.js';
import { dayOffset } from '../../core/dates.js';
import { t } from '../../core/sprache.js';

export const seedMessages = {
  [roomIdForCrew(CREWS.SEE_CHILL)]: [
    { id: 'msg-1', authorId: PEOPLE.MIRA, kind: 'text', text: t('Wasser hat 24 Grad 🌊'), date: dayOffset(0), time: '17:42' },
    { id: 'msg-2', authorId: PEOPLE.AYLA, kind: 'text', text: t('Ich nehm die Frisbee mit'), date: dayOffset(0), time: '17:48' },
    { id: 'msg-3', authorId: PEOPLE.SAM, kind: 'text', text: t('Bin um 19:10 da, komme direkt von der Arbeit'), date: dayOffset(0), time: '18:05' },
  ],
  [roomIdForCrew(CREWS.FREITAG)]: [
    { id: 'msg-4', authorId: PEOPLE.TOBI, kind: 'text', text: t('Freitag wieder was machen?'), date: dayOffset(-1), time: '20:12' },
    { id: 'msg-5', authorId: PEOPLE.LENA, kind: 'text', text: t('Ich wäre für Kochen bei mir'), date: dayOffset(-1), time: '20:31' },
    { id: 'msg-10', authorId: PEOPLE.MIRA, kind: 'text', text: t('Wie war der See gestern?'), date: dayOffset(0), time: '17:02' },
    { id: 'msg-11', authorId: ME, kind: 'text', text: t('Perfekt, bis 21 Uhr geblieben'), date: dayOffset(0), time: '17:05' },
    { id: 'msg-12', authorId: PEOPLE.MIRA, kind: 'text', text: t('Ich nehm die Seile mit'), date: dayOffset(0), time: '17:31' },
    { id: 'msg-13', authorId: ME, kind: 'text', text: t('Top — ich fahr, 3 Plätze frei'), date: dayOffset(0), time: '17:33' },
    { id: 'msg-14', authorId: PEOPLE.TOBI, kind: 'text', text: t('Wer hätte Samstag Bock auf den Pfänder?'), date: dayOffset(0), time: '17:40' },
    { id: 'msg-15', authorId: PEOPLE.AYLA, kind: 'text', text: t('Bin dabei, ab 9 passt mir'), date: dayOffset(0), time: '17:44' },
    { id: 'msg-16', authorId: PEOPLE.SAM, kind: 'text', text: t('Ich bring Snacks für oben mit'), date: dayOffset(0), time: '17:52' },
    { id: 'msg-17', authorId: PEOPLE.LENA, kind: 'text', text: t('Wetter soll top werden, viel Sonne'), date: dayOffset(0), time: '18:03' },
    { id: 'msg-22', authorId: PEOPLE.AYLA, kind: 'text', text: t('Kann mich jemand mitnehmen? Ich bräuchte eine Mitfahrgelegenheit'), date: dayOffset(0), time: '18:05' },
    { id: 'msg-23', authorId: PEOPLE.MIRA, kind: 'text', text: t('Mein Auto ist startklar, ich kann fahren'), date: dayOffset(0), time: '18:07' },
    { id: 'msg-18', authorId: PEOPLE.MIRA, kind: 'text', text: t('Treffpunkt bleibt Fluh, oder?'), date: dayOffset(0), time: '18:10' },
    { id: 'msg-19', authorId: PEOPLE.TOBI, kind: 'text', text: t('Ja. @Jonny bringst du die Kohle mit?'), date: dayOffset(0), time: '18:14' },
    { id: 'msg-20', authorId: PEOPLE.AYLA, kind: 'text', text: t('Ich übernehm die Snacks @Mira du die Seile?'), date: dayOffset(0), time: '18:20' },
  ],
  [roomIdForPerson(PEOPLE.MIRA)]: [
    { id: 'msg-6', authorId: PEOPLE.MIRA, kind: 'text', text: t('Bin am Kiosk, links vom Eingang'), date: dayOffset(0), time: '19:02' },
    { id: 'msg-7', authorId: ME, kind: 'text', text: t('2 Minuten!'), date: dayOffset(0), time: '19:03' },
    { id: 'msg-8', authorId: PEOPLE.MIRA, kind: 'text', text: t('Ich bring Cola, Chips und Kohle mit'), date: dayOffset(0), time: '19:06' },
  ],
  [roomIdForPerson(PEOPLE.TOBI)]: [
    { id: 'msg-9', authorId: PEOPLE.TOBI, kind: 'text', text: t('Diese Woche mal wieder Bouldern?'), date: dayOffset(-2), time: '19:40' },
    { id: 'msg-21', authorId: PEOPLE.TOBI, kind: 'nudge', date: dayOffset(0), time: '17:50' },
  ],
  // v4: Ayla (unread 1) und Ben (unread 2) trugen einen Ungelesen-Zähler, ihre Räume waren
  // aber leer — der Zähler zeigte auf nichts. Jetzt liegen dort echte fremde Nachrichten,
  // damit die Zahl in der Crew-Liste einem lesbaren Raum entspricht.
  [roomIdForPerson(PEOPLE.AYLA)]: [
    { id: 'msg-24', authorId: ME, kind: 'text', text: t('Wie schaut’s Donnerstag aus?'), date: dayOffset(-1), time: '21:10' },
    { id: 'msg-25', authorId: PEOPLE.AYLA, kind: 'text', text: t('Kino Donnerstag um 20:15 — kommst du mit?'), date: dayOffset(0), time: '16:20' },
  ],
  [roomIdForPerson(PEOPLE.BEN)]: [
    { id: 'msg-26', authorId: PEOPLE.BEN, kind: 'text', text: t('Servus! Am Wochenende was am Damm machen?'), date: dayOffset(0), time: '15:02' },
    { id: 'msg-27', authorId: PEOPLE.BEN, kind: 'text', text: t('Kohle und Snacks bring ich mit'), date: dayOffset(0), time: '15:04' },
  ],
  // Runde 8 (R8-6): der Chat des Pizzaabends von vorgestern — ein Beispiel für „Vergangene Chats".
  [roomIdForMeet(MEETS.PIZZA_ALT)]: [
    { id: 'msg-28', authorId: PEOPLE.LENA, kind: 'text', text: t('Danke fürs Kommen, war ein schöner Abend 🍕'), date: dayOffset(-2), time: '22:40' },
    { id: 'msg-29', authorId: PEOPLE.TOBI, kind: 'text', text: t('Nächstes Mal bei mir!'), date: dayOffset(-2), time: '22:46' },
    { id: 'msg-30', authorId: ME, kind: 'text', text: t('Bin dabei 🙌'), date: dayOffset(-1), time: '9:12' },
  ],
};

// Runde 8: Lesestand je Raum. Im Pizzaabend-Chat habe ich zuletzt selbst geschrieben — alles
// davor ist also gelesen. Ohne diesen Eintrag stünde dort eine Ungelesen-Zahl, die nicht stimmt.
export const seedRoomRead = {
  [roomIdForMeet(MEETS.PIZZA_ALT)]: 3,
};
