// Seed: Einstellungen & eigenes Profil (Quelle: reference/current 06.x + 09.x, v14).
// Struktur stabil; Werte referenzgetreu verfeinert (06.1/06.3/06.5–06.12, 09.3).
import { PEOPLE, CREWS, MEETS } from '../ids.js';
import { t, schluessel } from '../../core/sprache.js';

// Sprachen: Interessen und Ressourcen der Beispiel-Freunde, die nicht im Katalog stehen. Sie
// bleiben als Daten deutsch (Schlüssel für Stufen, Freigaben, Zeichen); schluessel nimmt sie
// in die Übersetzung auf, damit sie in der Demo über wort() in jeder Sprache erscheinen.
export const DEMO_WORTE = [
  schluessel('See'), schluessel('Kochen draußen'), schluessel('Radtouren'), schluessel('Spikeball'),
  schluessel('Kletterseil'), schluessel('Große Küche'), schluessel('Spieleabend'), schluessel('Spielesammlung'),
  schluessel('Slackline'), schluessel('Boxen'), schluessel('PS5'),
];

export const seedSettings = {
  onboarded: true,
  name: 'Jonathan',
  initials: 'Jo',
  color: '#C98A5B',
  photo: null,

  free: { active: false, pending: false, from: null, fromAt: null },
  freeResetTime: '00:00',
  activityStatus: 'nur-aktiv', // 'aus' | 'nur-aktiv' | 'zeigen'

  // v14 06.9/06.9b: Frei-Hinweise global; „Individuell" mit echter Personen-Auswahl.
  freiHints: { mode: 'individuell', customIds: [PEOPLE.LENA, PEOPLE.MIRA, PEOPLE.TOBI] },
  // v14 (reference/current 04.1): Sam + Tobi tragen den Stern, Lena ist die besondere Person
  // mit frei getipptem Label (06.11/06.11b).
  bestFriendIds: [PEOPLE.SAM, PEOPLE.TOBI], // max. 3
  // v7 A04: 'raute' ist als Symbol entfallen und #7E6BA8 liegt nicht in der 5x3-Palette.
  specialPerson: { personId: PEOPLE.LENA, label: t('Schwester'), symbol: 'herz', color: '#D64291' },

  notifications: {
    invitations: true, // Einladungen & Meet-Änderungen
    mentions: true, // Direkte Erwähnungen
    chat: true, // erste Nachricht meldet, weitere bündeln sich (kein Dauerbanner im Screen)
    updates: true, // Updates & Zusammenfassungen
    // v3.1 §4: Die Meet-Erinnerung ist nie nur An/Aus — sie benennt ihren Zeitpunkt.
    reminder: true,
    reminderMinutes: 15, // Standard: 15 Minuten vor Beginn
  },
  // Fable 3 (Entscheidung Jonathan 06.09.2026): Startwert „System" — folgt dem Gerät.
  // Hell und Dunkel bleiben in Profil → Einstellungen → Darstellung manuell wählbar.
  appearance: { theme: 'system' }, // 'system' | 'hell' | 'dunkel'
  location: {
    use: true, // Standort verwenden (Standard: aus)
    shareMode: 'ausgewaehlte', // 'niemand' | 'alle' | 'ausgewaehlte'
    shareIds: [PEOPLE.MIRA, PEOPLE.SAM],
  },
  // v4 P0-4-Datenquelle-tot: `visibility.resources` ist ERSATZLOS ENTFALLEN. Der Wert
  // wurde von keiner Leseseite ausgewertet und stand als zweiter, folgenloser Regler
  // neben der Freigabe je Ressource. Die EINE wirksame Stelle ist `resourceShares`
  // ('freunde' | 'privat' | [crewId…]) — sie deckt jeden Zustand des alten Reglers ab:
  // „nur ich" statt „aus", eine Crew-Liste statt „nur App", „alle Freunde" statt
  // „App und Freunde". Ein wiederbelebter Globalregler wäre erneut eine zweite
  // Bedienstelle für dieselbe Entscheidung.
  visibility: {
    unknownProfile: 'nichts', // 'nichts' | 'vorname' | 'profil'
  },
  account: { email: 'jonathan@mail.at', method: 'apple' },

  // Interessen bleiben ein String-Array (Vorschlags-Engine); Häufigkeit separat (1–3 Punkte).
  interests: ['Bouldern', 'See', 'Kochen draußen', 'Kino', 'Brettspiele', 'Kochen', 'Wandern', 'Kaffee', 'Gaming', 'Radtouren', 'Spikeball'],
  interestLevels: {
    'Bouldern': 3, 'See': 3, 'Kochen draußen': 2, 'Kino': 2, 'Brettspiele': 1,
    'Kochen': 2, 'Wandern': 1, 'Kaffee': 2, 'Gaming': 1, 'Radtouren': 1, 'Spikeball': 1,
  },
  // v3.1 §6: Ressourcen-Zeilen mit ZWEISTUFIGER Verfügbarkeit ('immer' | 'manchmal') und
  // optionaler Personen-Kapazität (Stepper). Es gibt keine Ressourcen-Tags und kein
  // `mixed`-Flag mehr — „unterschiedlich" ist höchstens eine Gruppenzusammenfassung.
  resources: ['Auto', 'Grill', 'Brettspiele', 'PS5', 'Beamer', 'Kühlbox'],
  // v3.1 §6: Freigaben je Ressource — 'freunde' | 'privat' | [crewId, …]
  resourceShares: {
    'Auto': 'freunde', 'Grill': 'freunde', 'Brettspiele': 'freunde',
    'PS5': ['c-freitag'], 'Beamer': 'freunde', 'Kühlbox': 'privat',
  },
  resourceMeta: {
    'Auto': { availability: 'immer', capacity: 5 },
    'Grill': { availability: 'immer', capacity: 6 },
    'Brettspiele': { availability: 'manchmal', capacity: null },
    'PS5': { availability: 'manchmal', capacity: 4 },
    'Beamer': { availability: 'manchmal', capacity: null },
    'Kühlbox': { availability: 'manchmal', capacity: null },
  },

  // v14 06.3/06.12: erhaltene Anfragen mit Weg-Angabe, eigene gesendete Anfragen.
  // v4 QR-2: Jede erhaltene Anfrage trägt den Code, mit dem sie kam. acceptFriendRequest
  // übernimmt ihn, sodass die neue Person danach einen echten Einladungscode hat und die
  // Zustände „bereits befreundet" und „Anfrage läuft schon" wirklich auslösbar sind.
  friendRequests: [
    { id: 'fr-pia', name: 'Pia Brunner', initials: 'Pi', color: '#6BAFA5', code: '96R-U36-QW5', meta: t('{n} gemeinsame Freunde · über {name}', { n: 3, name: 'Ben' }) },
    { id: 'fr-elias', name: 'Elias Wehr', initials: 'El', color: '#8A9FB8', code: 'U5J-VY7-QHM', meta: t('1 gemeinsamer Freund · Code {code}', { code: '2UJ-46Q-UDC' }) },
  ],
  // v4 QR-2: Die gesendete Anfrage trägt den Code, mit dem sie losging. Nur so kann das
  // Einlösen erkennen, dass dieselbe Anfrage schon läuft (Zustand 'pending').
  outgoingRequests: [
    { id: 'out-david', name: 'David L.', initials: 'Da', color: '#C98A5B', code: 'E9X-JVB-ZQS', meta: t('Link geteilt · gestern') },
  ],
  inviteCode: '2UJ-46Q-UDC',
  homeAddress: { name: 'Rathausstraße 12', city: 'Bregenz', lat: 47.50243, lon: 9.74759 },

  // v14 09.3: liegt eine Einladung vor, landet das Onboarding direkt bei ihrem Ziel.
  pendingInvite: { byId: PEOPLE.TOBI, byName: 'Tobi', crewId: CREWS.FREITAG, meetId: MEETS.WANDERN },
};
