// Seed: Personen & Crews (Quelle: reference 04.1 Crew).
import { ME, PEOPLE, CREWS, MEETS } from '../ids.js';
import { t } from '../../core/sprache.js';

export const seedPeople = [
  {
    id: PEOPLE.AYLA, name: 'Ayla', initials: 'Ay', color: '#C9AE6B',
    photo: 'assets/avatars/sand.svg',
    inviteCode: '3BA-4MA-MVN',
    status: t('Lädt dich ein · Kino Do'), unread: 1,
    free: { active: false }, sharesLocation: false, showsActivity: false, area: 'Bregenz',
    interests: ['Kino', 'Bouldern', 'Kaffee'], resources: ['Beamer'],
    interestLevels: { 'Kino': 3, 'Bouldern': 2, 'Kaffee': 1 },
    resourceShares: { 'Beamer': 'freunde' },
    resourceMeta: { 'Beamer': { availability: 'manchmal' } },
  },
  {
    id: PEOPLE.MIRA, name: 'Mira', initials: 'Mi', color: '#7F9FC9',
    photo: 'assets/avatars/see.svg',
    inviteCode: 'J3R-QXA-NPK',
    status: t('Strandbad + Pizza'), unread: 0, activeMeetId: MEETS.STRANDBAD,
    free: { active: false }, sharesLocation: true, showsActivity: true, area: 'Bregenz',
    interests: ['Baden', 'Pizza', 'Volleyball'], resources: ['Auto', 'Kühlbox'],
    // „ab und zu" ergibt in 07.5 zusammen mit meinem eigenen Auto den halb+grünen Stapel (v14).
    interestLevels: { 'Baden': 3, 'Pizza': 2, 'Volleyball': 1 },
    resourceShares: { 'Auto': 'freunde', 'Kühlbox': 'freunde' },
    resourceMeta: { 'Auto': { availability: 'manchmal', capacity: 5 }, 'Kühlbox': { availability: 'manchmal' } },
  },
  {
    id: PEOPLE.SAM, name: 'Sam', initials: 'Sa', color: '#A08FC9',
    photo: 'assets/avatars/wald.svg',
    inviteCode: 'PTT-DBV-MJ4',
    status: t('In {ort}', { ort: 'Bregenz' }), unread: 0,
    free: { active: true }, sharesLocation: true, showsActivity: false, area: 'Bregenz',
    interests: ['Bouldern', 'Wandern'], resources: ['Kletterseil'],
    interestLevels: { 'Bouldern': 3, 'Wandern': 2 },
    resourceShares: { 'Kletterseil': 'freunde' },
    resourceMeta: { 'Kletterseil': { availability: 'manchmal' } },
  },
  {
    id: PEOPLE.TOBI, name: 'Tobi', initials: 'To', color: '#8FAF8A',
    inviteCode: 'KGS-T9N-GSX',
    status: t('Frei ab {zeit}', { zeit: '19:00' }), unread: 0,
    free: { active: false, until: null, from: '19:00' }, sharesLocation: true, showsActivity: false, area: 'Dornbirn',
    interests: ['Grillen', 'Gaming'], resources: ['Grill'],
    interestLevels: { 'Grillen': 3, 'Gaming': 1 },
    resourceShares: { 'Grill': 'freunde' },
    resourceMeta: { 'Grill': { availability: 'manchmal', capacity: 6 } },
  },
  {
    id: PEOPLE.LENA, name: 'Lena', initials: 'Le', color: '#C97F93',
    photo: 'assets/avatars/beere.svg',
    inviteCode: 'EWU-99H-X6B',
    status: '', unread: 0,
    free: { active: false }, sharesLocation: false, showsActivity: false, area: 'Bregenz',
    interests: ['Kino', 'Kochen'], resources: ['Große Küche'],
    interestLevels: { 'Kochen': 3, 'Kino': 2 },
    resourceShares: { 'Große Küche': ['c-freitag'] },
    resourceMeta: { 'Große Küche': { availability: 'immer', capacity: 8 } },
  },
  {
    id: PEOPLE.NOAH, name: 'Noah', initials: 'No', color: '#B0876B',
    photo: 'assets/avatars/stein.svg',
    inviteCode: '97E-PEJ-VJA',
    status: '', unread: 0,
    free: { active: false }, sharesLocation: false, showsActivity: false, area: 'Lindau',
    interests: ['Fußball', 'Spieleabend'], resources: ['Spielesammlung'],
    interestLevels: { 'Spieleabend': 3, 'Fußball': 2 },
    resourceShares: { 'Spielesammlung': 'privat' },
    resourceMeta: { 'Spielesammlung': { availability: 'immer' } },
  },
  // --- v3.2 B6: zusätzliche Personen (Dichte für Listen, Scroll, Markierungen) ---
  {
    id: PEOPLE.JONAS, name: 'Jonas', initials: 'Jn', color: '#8A9FB8',
    inviteCode: '7BH-W5U-EPY',
    status: t('Frei ab {zeit}', { zeit: '20:00' }), unread: 0,
    free: { active: false }, sharesLocation: true, showsActivity: false, area: 'Bregenz',
    interests: ['Bouldern', 'Kaffee'], resources: ['Slackline'],
    interestLevels: { 'Bouldern': 2, 'Kaffee': 3 },
    resourceShares: { 'Slackline': 'freunde' },
    resourceMeta: { 'Slackline': { availability: 'manchmal' } },
  },
  {
    id: PEOPLE.KIRA, name: 'Kira', initials: 'Ki', color: '#C97F93',
    photo: 'assets/avatars/abend.svg',
    inviteCode: 'JX2-RY8-P2H',
    status: t('In {ort}', { ort: 'Dornbirn' }), unread: 0,
    free: { active: true }, sharesLocation: true, showsActivity: false, area: 'Dornbirn',
    interests: ['Kino', 'Konzerte'], resources: ['Boxen'],
    interestLevels: { 'Konzerte': 3, 'Kino': 2 },
    resourceShares: { 'Boxen': 'freunde' },
    resourceMeta: { 'Boxen': { availability: 'immer' } },
  },
  {
    id: PEOPLE.BEN, name: 'Ben', initials: 'Be', color: '#6BAFA5',
    inviteCode: 'NSJ-A3F-KD5',
    status: '', unread: 2,
    free: { active: false }, sharesLocation: false, showsActivity: false, area: 'Lindau',
    interests: ['Fußball', 'Grillen'], resources: ['Grill'],
    interestLevels: { 'Fußball': 3, 'Grillen': 2 },
    resourceShares: { 'Grill': 'privat' },
    resourceMeta: { 'Grill': { availability: 'manchmal' } },
  },
  {
    id: PEOPLE.ELIF, name: 'Elif', initials: 'El', color: '#A08FC9',
    inviteCode: 'MRY-Q9D-JRR',
    status: '', unread: 0,
    free: { active: false }, sharesLocation: false, showsActivity: false, area: 'Bregenz',
    interests: ['Wandern', 'Kochen'], resources: ['Zelt'],
    interestLevels: { 'Wandern': 3, 'Kochen': 1 },
    resourceShares: { 'Zelt': ['c-sport'] },
    resourceMeta: { 'Zelt': { availability: 'manchmal', capacity: 4 } },
  },
];

// v4 QR-2: Einladungs-Verzeichnis — Personen, die es gibt, mit denen ich aber NOCH NICHT
// befreundet bin. Nur ein Code aus dieser Liste (oder ein Freundes-Code, dann „schon
// befreundet") wird überhaupt erkannt; alles andere ist ungültig. Damit sind die drei
// verlangten Zustände ERFOLG / BEREITS BEFREUNDET / UNGÜLTIG real prüfbar:
//   BBD-2SS-JBT  → Erfolg (Anfrage geht raus)
//   J3R-QXA-NPK  → bereits befreundet (Code einer Freundin, seedPeople)
//   5YV-8UT-HP5  → ungültig (Format stimmt, Code existiert nicht)
//   QUATSCH123 → ungültig (Format stimmt nicht)
//   2UJ-46Q-UDC  → eigener Code (seedSettings.inviteCode)
//   E9X-JVB-ZQS  → Anfrage läuft schon (seedSettings.outgoingRequests)
export const seedInviteDirectory = [
  { code: 'BBD-2SS-JBT', name: 'Nina Rauch', initials: 'Ni', color: '#6BAFA5', meta: t('Kurzcode · gerade eben') },
  { code: 'ZPS-Q7H-Q86', name: 'Felix Egger', initials: 'Fe', color: '#8A9FB8', meta: t('Kurzcode · gerade eben') },
  { code: '879-2AH-8DP', name: 'Mara Kaufmann', initials: 'Ma', color: '#C9AE6B', meta: t('Kurzcode · gerade eben') },
];

export const seedCrews = [
  {
    id: CREWS.FREITAG, name: t('Freitag-Crew'),
    memberIds: [ME, PEOPLE.MIRA, PEOPLE.TOBI, PEOPLE.LENA, PEOPLE.AYLA, PEOPLE.SAM, PEOPLE.NOAH],
    unread: 2,
    // v6 A12: Ich bin hier alleinige Admin — das ist der Fall, in dem vor dem Austritt
    // die Rolle übergeben werden muss.
    creatorId: ME, adminIds: [ME],
  },
  {
    id: CREWS.SEE_CHILL, name: t('See & Chill'),
    // v7 spec/08 §2: eigenes Gruppenbild statt Mitglieder-Collage.
    groupImage: 'assets/avatars/moos.svg',
    memberIds: [ME, PEOPLE.AYLA, PEOPLE.MIRA, PEOPLE.SAM],
    unread: 0,
    // Mira führt diese Gruppe — hier ist der Austritt ein normaler Weg.
    creatorId: PEOPLE.MIRA, adminIds: [PEOPLE.MIRA],
  },
  {
    id: CREWS.SPORT, name: t('Sport-Runde'),
    // v7 spec/08 §2: eigenes Gruppenbild statt Mitglieder-Collage.
    groupImage: 'assets/avatars/ocker.svg',
    memberIds: [ME, PEOPLE.SAM, PEOPLE.JONAS, PEOPLE.KIRA, PEOPLE.ELIF],
    unread: 0,
    creatorId: PEOPLE.SAM, adminIds: [PEOPLE.SAM],
  },
];
