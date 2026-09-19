// Seed: Personen & Crews (Quelle: reference 04.1 Crew).
import { ME, PEOPLE, CREWS, MEETS } from '../ids.js';
import { t } from '../../core/sprache.js';
// Runde 8 (R8-63): echte Fotos, sobald sie im Projekt liegen — sonst bleibt das bisherige Bild.
import { demoFoto } from './fotos.js';

export const seedPeople = [
  // Runde 7 (E1/E2): „Keine Zeit“ als Woche. Ohne diese Beispielzeiten zeigte im Demo-Modus
  // KEIN Freund jemals „Keine Zeit“ — die ganze Fremdsicht wäre nicht vorführbar. Bewusst
  // verschiedene Formen: Werktage, Nachtschicht über Mitternacht, Wochenende.
  // Runde 8 (R8-39): Busy trägt Titel („Arbeit", „Volleyball") — Freunde sehen sie. Lena hat ihre
  // Zeiten mit Schloss eingetragen: ihr Titel steht zwar in ihren Daten, bei mir kommt aber nur
  // „busy" an (projections.js busyFuerFreunde). Die Freigabe je Person (belegtSichtbar) gibt es
  // nicht mehr — Freunde sehen Busy immer.
  {
    id: PEOPLE.AYLA, name: 'Ayla', initials: 'Ay', color: '#C9AE6B',
    // Aylas Schicht endet um 17:00 — die Zeile „Keine Zeit bis 17:00“ in der Freundesliste.
    belegt: [{ tage: [1, 2, 3, 4, 5], von: '08:30', bis: '17:00', titel: t('Arbeit') }],
    photo: demoFoto(PEOPLE.AYLA) || 'assets/avatars/sand.svg',
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
    belegt: [{ tage: [2, 4], von: '18:00', bis: '20:30', titel: t('Volleyball') }],
    photo: demoFoto(PEOPLE.MIRA) || 'assets/avatars/see.svg',
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
    // Nachtschicht: bis < von heißt Folgetag — der Grenzfall, an dem jede Wochenrechnung scheitert.
    belegt: [{ tage: [1, 3, 5], von: '22:00', bis: '06:00', titel: t('Nachtschicht') }],
    photo: demoFoto(PEOPLE.SAM) || 'assets/avatars/wald.svg',
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
    belegt: [
      { tage: [1, 2, 3, 4], von: '07:00', bis: '16:00', titel: t('Arbeit') },
      { tage: [6], von: '09:00', bis: '13:00', titel: t('Aushilfe') },
    ],
    ...(demoFoto(PEOPLE.TOBI) ? { photo: demoFoto(PEOPLE.TOBI) } : {}),
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
    // Runde 8 (R8-39): Lena hat ihr Praktikum mit Schloss eingetragen — Freunde sehen, DASS sie
    // busy ist, aber nicht, was. Der Titel bleibt in ihren Daten und kommt bei mir als null an.
    belegt: [{ tage: [1, 2, 3, 4, 5], von: '09:00', bis: '17:30', titel: t('Praktikum'), privat: true }],
    photo: demoFoto(PEOPLE.LENA) || 'assets/avatars/beere.svg',
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
    photo: demoFoto(PEOPLE.NOAH) || 'assets/avatars/stein.svg',
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
    ...(demoFoto(PEOPLE.JONAS) ? { photo: demoFoto(PEOPLE.JONAS) } : {}),
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
    belegt: [{ tage: [0], von: '10:00', bis: '14:00', titel: t('Familie') }],
    photo: demoFoto(PEOPLE.KIRA) || 'assets/avatars/abend.svg',
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
    ...(demoFoto(PEOPLE.BEN) ? { photo: demoFoto(PEOPLE.BEN) } : {}),
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
    ...(demoFoto(PEOPLE.ELIF) ? { photo: demoFoto(PEOPLE.ELIF) } : {}),
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
  { code: 'BBD-2SS-JBT', name: 'Nina Rauch', initials: 'Ni', color: '#6BAFA5', meta: t('Kurzcode · gerade eben'), ...(demoFoto('dir-nina') ? { photo: demoFoto('dir-nina') } : {}) },
  { code: 'ZPS-Q7H-Q86', name: 'Felix Egger', initials: 'Fe', color: '#8A9FB8', meta: t('Kurzcode · gerade eben'), ...(demoFoto('dir-felix') ? { photo: demoFoto('dir-felix') } : {}) },
  { code: '879-2AH-8DP', name: 'Mara Kaufmann', initials: 'Ma', color: '#C9AE6B', meta: t('Kurzcode · gerade eben'), ...(demoFoto('dir-mara') ? { photo: demoFoto('dir-mara') } : {}) },
];

export const seedCrews = [
  {
    id: CREWS.FREITAG, name: t('Freitag-Crew'),
    ...(demoFoto(CREWS.FREITAG) ? { groupImage: demoFoto(CREWS.FREITAG) } : {}),
    memberIds: [ME, PEOPLE.MIRA, PEOPLE.TOBI, PEOPLE.LENA, PEOPLE.AYLA, PEOPLE.SAM, PEOPLE.NOAH],
    unread: 2,
    // v6 A12: Ich bin hier alleinige Admin — das ist der Fall, in dem vor dem Austritt
    // die Rolle übergeben werden muss.
    creatorId: ME, adminIds: [ME],
  },
  {
    id: CREWS.SEE_CHILL, name: t('See & Chill'),
    // v7 spec/08 §2: eigenes Gruppenbild statt Mitglieder-Collage.
    groupImage: demoFoto(CREWS.SEE_CHILL) || 'assets/avatars/moos.svg',
    memberIds: [ME, PEOPLE.AYLA, PEOPLE.MIRA, PEOPLE.SAM],
    unread: 0,
    // Mira führt diese Gruppe — hier ist der Austritt ein normaler Weg.
    creatorId: PEOPLE.MIRA, adminIds: [PEOPLE.MIRA],
  },
  {
    // Runde 7 (A4/A5): hieß „Sport-Runde“. Seit „Runde“ das Wort für einen Meet-Raum ist,
    // stünde sonst „Runde“ neben „Sport-Runde“ — zwei Bedeutungen in einer Liste.
    id: CREWS.SPORT, name: t('Sport-Gruppe'),
    // v7 spec/08 §2: eigenes Gruppenbild statt Mitglieder-Collage.
    groupImage: demoFoto(CREWS.SPORT) || 'assets/avatars/ocker.svg',
    memberIds: [ME, PEOPLE.SAM, PEOPLE.JONAS, PEOPLE.KIRA, PEOPLE.ELIF],
    unread: 0,
    creatorId: PEOPLE.SAM, adminIds: [PEOPLE.SAM],
  },
];
