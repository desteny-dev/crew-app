// Kanonische Demo-IDs. Alle Seeds und Screens referenzieren Entitäten NUR über diese IDs,
// damit Crew-, Meet-, Raum- und Profil-Seeds konsistent bleiben.

export const ME = 'p-me'; // Jonathan (Jo)

export const PEOPLE = {
  AYLA: 'p-ayla',
  MIRA: 'p-mira',
  SAM: 'p-sam',
  TOBI: 'p-tobi',
  LENA: 'p-lena',
  NOAH: 'p-noah',
  // v3.2 B6: zusätzliche Personen für echte Listen-/Scroll-/Markierungsprüfung
  JONAS: 'p-jonas',
  KIRA: 'p-kira',
  BEN: 'p-ben',
  ELIF: 'p-elif',
};

export const CREWS = {
  FREITAG: 'c-freitag',
  SEE_CHILL: 'c-see',
  SPORT: 'c-sport', // v3.2 B6: dritte Crew
};

// Raum-IDs sind ableitbar: Crew-Raum = `r:${crewId}`, 1:1-Raum = `r:${personId}`,
// temporärer Meet-Raum = `r:${meetId}` (v6 A13). Die Art steckt im Präfix der Referenz:
// c… = Crew, m… = Meet, p… = Person.
export function roomIdForCrew(crewId) {
  return `r:${crewId}`;
}
export function roomIdForPerson(personId) {
  return `r:${personId}`;
}
// v6 A13: Ein Meet mit mehreren Einzelpersonen bekommt EINEN gemeinsamen Raum statt
// mehrerer 1:1-Chats. Er gehört dem Meet und wird mit ihm zusammen sichtbar.
export function roomIdForMeet(meetId) {
  return `r:${meetId}`;
}

export const MEETS = {
  STRANDBAD: 'm-strandbad', // Strandbad + Pizza — heute aktiv (See & Chill)
  KINO: 'm-kino', // Kino: Dune Part 3 · von Lena — offene Einladung
  WANDERN: 'm-wandern', // Wandern Pfänder — entschieden
  KOCHABEND: 'm-kochabend', // Kochabend — offen mit Varianten
  GRILLEN: 'm-grillen', // Grillen am See — abgeschlossen, Bewertung offen
  BOULDERN: 'm-bouldern', // Bouldern + Pizza · von Sam — Loop
  FEUERWERK: 'm-feuerwerk', // Strandbad-Stack-Demo (gleicher Ort, Vertrag §5)
  SEEBUEHNE: 'm-seebuehne', // Strandbad-Stack-Demo (gleicher Ort, Vertrag §5)
  // v3.2 B6: mehr abgeschlossene Meets für einen echten Verlauf
  KLETTERN_ALT: 'm-klettern-alt',
  BRUNCH_ALT: 'm-brunch-alt',
  KONZERT_ALT: 'm-konzert-alt',
  SPIELEABEND_ALT: 'm-spieleabend-alt',
  // Runde 8 (R8-6): ein Meet-Chat von vorgestern — Beispiel für „Vergangene Chats"
  PIZZA_ALT: 'm-pizza-alt',
};
