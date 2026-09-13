// CrewRepository — der EINZIGE Datenvertrag der App (M0–M2: DemoDataGateway, M3: ServerDataGateway).
// Screens greifen nie direkt auf Arrays/Fixtures zu, sondern nur auf diese Methoden.
//
// Datenformen (informell):
//   Person   { id, name, initials, color, status?, free:{active,until?}, activeMeetId?, sharesLocation?,
//              area?, unread, interests:[..], resources:[..] }
//   Crew     { id, name, memberIds:[..], unread }
//   Room     { id, kind:'crew'|'meet'|'person', refId, messages:[{id,authorId,kind:'text'|'nudge'|'system',text,date,time,nudge?}], lastReadCount }
//   v6 A13: 'meet' ist der gemeinsame TEMPORÄRE Meet-Raum (r:<meetId>). Er entsteht beim
//   Veröffentlichen eines Meets mit mehr als einer Einzelperson ohne gemeinsame Gruppe
//   und trägt genau dessen Teilnehmerliste. Er ist KEINE dauerhafte Crew-Gruppe.
//   Crew     zusätzlich { creatorId, adminIds:[personId…] } — v6 A12, sonst wäre der
//   Adminfall beim Verlassen nicht darstellbar.
//   Meet     { id, title, icon, category, date:'YYYY-MM-DD', time, endTime?, place:{name,address?,x?,y?},
//              crewId?|personIds?, creatorId, status:'open'|'decided'|'active'|'done'|'draft',
//              participation:{[personId]:'yes'|'open'|'no'},
//              variants:[{id,kind:'time'|'activity',authorId,date?,time?,title?,icon?,place?,votes:[personId]}],
//              bring:[{id,label,takenBy:[personId]}],
//              polls:[{id,question,options:[{id,label,votes:[personId]}]}],
//              loop?:{repeat,weekday,time,active,responses:{[dateISO]:{[personId]:'yes'|'no'}}},
//              roomId?:'r:<meetId>' (v6 A13),
//              review?:{meetId,verdict,reasons:[..],aspects:[..],note,at} (v6 A23), hiddenFromHistory? }
//   PlaceRequest { id, meetId, hostId, requesterId, status:'open'|'accepted'|'declined', createdAt, respondedAt? }
//   v6 A18: echte Zustimmungsanfrage statt Selbstzustimmung per Timer.
//   Draft    { id, withCrewId?, withPersonIds?, when?:{date,time,open?}, whenProposals:[{date,time,open?}],
//              idea?:{title,icon,category,source,suggestionId?}, ideaAlternatives:[{title,icon,place?}],
//              loop?:{repeat,weekday?,time?}|null,
//              place?:{mode:'search'|'map'|'mine'|'person',name?,address?,personId?,approved?}, note?, filter? }
//   Räume: Nachrichten älter als 14 Tage werden automatisch ausgeblendet (v14).
//   v3.1: free = {active, pending, from:'HH:MM'|null, fromAt:ms|null} — „Frei ab".
//   Ressourcen: resourceMeta[label]={availability:'immer'|'manchmal', capacity}, KEINE Tags;
//   resourceShares[label]='freunde'|'privat'|[crewId…]|{personen:[personId…]} (v5 A30d).
//   v4: settings.visibility.resources ist ENTFALLEN — resourceShares ist die einzige Regel.
//   v4: Person.inviteCode = Kurzcode der Person (Form VIER-4821); Personen ohne Freundschaft
//       stehen im Einladungs-Verzeichnis (seed/crew.js, seedInviteDirectory).
//   Settings { onboarded, name, initials, color, freeResetTime, activityStatus,
//              freiHints:{mode:'niemand'|'beste'|'individuell'|'alle', customIds:[..]},
//              bestFriendIds:[..max 3], specialPerson:{personId,label?,symbol,color}|null,
//              notifications, appearance, location, visibility, account, interests, resources }
//
// Private Markierungen (bestFriendIds, specialPerson), Bewertungen und Gespeichertes sind
// lokale, private Daten des aktuellen Nutzers.

export class CrewRepository {
  // --- Infrastruktur ---
  subscribe(listener) { throw new Error('nicht implementiert'); }
  reset() { throw new Error('nicht implementiert'); }

  // --- Identität & Einstellungen ---
  getMe() { throw new Error('nicht implementiert'); }
  getSettings() { throw new Error('nicht implementiert'); }
  updateSettings(patch) { throw new Error('nicht implementiert'); }
  completeOnboarding(profile) { throw new Error('nicht implementiert'); }
  signOut() { throw new Error('nicht implementiert'); }

  // --- Das echte Anmeldekonto ---------------------------------------------------------
  // Was auf der Konto-Seite steht, kommt AUSSCHLIESSLICH von hier — nie aus einem im
  // Bildschirm eingetragenen Wert. Im Demo-Modus gibt es kein Konto; dann ist echt=false
  // und die Seite sagt das, statt eine Anmeldeart zu erfinden.
  //   → { echt, email, methode:'email'|'apple'|'google'|'demo', methodeLabel, kannPasswort }
  getAccountInfo() { throw new Error('nicht implementiert'); }
  // Beide liefern ein Promise auf { ok, meldung } — `meldung` ist fertiger Klartext.
  changeEmail(email) { throw new Error('nicht implementiert'); }
  // Runde 2: nur mit dem aktuellen Passwort.
  changePassword(altesPasswort, neuesPasswort) { throw new Error('nicht implementiert'); }
  // Runde 2: „Passwort vergessen?" aus der Konto-Seite.
  sendPasswordReset() { throw new Error('nicht implementiert'); }
  spracheMelden(code) { throw new Error('nicht implementiert'); } // Runde 2: Sprache ins Konto (für die Mails)

  // --- Frei-Status (eigener) ---
  getFreeState() { throw new Error('nicht implementiert'); }
  setFree(options) { throw new Error('nicht implementiert'); } // {fromMinutes?:number, from?:'HH:MM'} — v3.1: Frei ab
  clearFree() { throw new Error('nicht implementiert'); }
  // Runde 5 (G3b): setFree nimmt zusätzlich { lust }; setFreeLust ändert nur die Lust.
  // lust: 'kaffee'|'sport'|'draussen'|'essen'|'chillen'|null — gelesen als settings.free.lust / person.free.lust
  setFreeLust(lust) { throw new Error('nicht implementiert'); }

  // --- Personen & Freundschaft ---
  getPeople() { throw new Error('nicht implementiert'); }
  // v3.1 §6: Projektion nach Freigaben — Interessen nach echter Punktebewertung sortiert,
  // Ressourcen nur wenn für den Betrachter freigegeben. Jede Ansicht liest hierüber.
  //
  // v4 P0-4-Res-Sortierung — VERBINDLICHE Reihenfolge von `resourceList`:
  //   1. availabilityRank aufsteigend  (immer = 0, manchmal = 1)
  //   2. label, deutsche Sortierung
  // Jeder Eintrag ist { label, availability:'immer'|'manchmal', availabilityRank:0|1,
  // capacity:number|null }. Ansichten, die mehrere Besitzer zu EINER Zeile bündeln,
  // sortieren nach dem kleinsten availabilityRank der Besitzer und danach nach label —
  // nicht nach Besitzeranzahl. Die Quelle erfindet keine Nutzungshäufigkeit.
  //
  // v4 P0-4 — viewerContext bestimmt, WER schaut:
  //   {}                    eigene Sicht auf das eigene Profil
  //   {crewId} | {personId} fremde Sicht (Crew-/Personenansicht)
  projectProfile(person, viewerContext) { throw new Error('nicht implementiert'); }
  // v4 P0-4-Datenquelle-tot: Es gibt GENAU EINE Regel für die Sichtbarkeit einer
  // Ressource — resourceShares[label]. Ein zweiter, globaler Regler existiert nicht
  // mehr (settings.visibility.resources ist entfallen, weil ihn niemand las).
  isSharedWith(share, viewerContext) { throw new Error('nicht implementiert'); }
  getPerson(id) { throw new Error('nicht implementiert'); }
  setBestFriend(personId, on) { throw new Error('nicht implementiert'); } // max. 3
  setSpecialPerson(personId, marker) { throw new Error('nicht implementiert'); } // marker|null; genau eine Person
  removeFriend(personId) { throw new Error('nicht implementiert'); }
  getFriendRequests() { throw new Error('nicht implementiert'); }
  acceptFriendRequest(requestId) { throw new Error('nicht implementiert'); }
  declineFriendRequest(requestId) { throw new Error('nicht implementiert'); }
  getInviteCode() { throw new Error('nicht implementiert'); }
  // v4 QR-2: → { ok, status, reason, code?, name?, personId? } — `reason` ist immer ein
  // fertiger, kurzer Toast-Text. status:
  //   'sent'    ok:true   ERFOLG — ausgehende Anfrage angelegt
  //   'already' ok:false  BEREITS BEFREUNDET — der Code gehört einem Freund
  //   'invalid' ok:false  UNGÜLTIG — falsche Form oder unbekannter Code
  //   'empty'   ok:false  leeres Feld
  //   'self'    ok:false  der eigene Code
  //   'pending' ok:false  an diesen Code läuft bereits eine Anfrage
  //
  // Rückgabe: das Ergebnis ODER ein Promise darauf. Der DemoDataGateway hat alle Codes im
  // Gerät und antwortet sofort. Der SupabaseGateway KANN das nicht: Ob ein fremder Code
  // existiert, weiß nur der Server — und die Codes anderer Leute sind für ihn absichtlich
  // unlesbar (Prüfschritt T1). Statt eine Antwort zu erfinden und sie gleich darauf zu
  // widerrufen, gibt er das Versprechen auf die echte Antwort zurück.
  // Aufrufer behandeln beides gleich: Promise.resolve(repo.redeemInviteCode(code)).then(…)
  redeemInviteCode(code) { throw new Error('nicht implementiert'); }
  deleteAccount() { throw new Error('nicht implementiert'); } // Demo: Zustand löschen + Onboarding

  // --- Melden & Blockieren (Rechtspflicht, Prüfschritt T6) ---------------------------
  // Wer blockiert wird, verschwindet aus JEDER Ansicht dieses Nutzers: Freundesliste,
  // Räume, Crew-Mitgliederlisten, Nachrichten in gemeinsamen Räumen. Die Blockierung ist
  // einseitig und wird der anderen Seite nicht mitgeteilt.
  // options: { grund?:'belaestigung'|'spam'|'inhalte'|'anderes', notiz?:string } — ist ein
  // Grund dabei, entsteht zugleich eine Meldung.
  blockPerson(personId, options) { throw new Error('nicht implementiert'); }
  unblockPerson(personId) { throw new Error('nicht implementiert'); }
  getBlockedPeople() { throw new Error('nicht implementiert'); }
  isBlocked(personId) { throw new Error('nicht implementiert'); }
  // input: { personId?, messageId?, meetId?, grund, notiz? } — eine Meldung ist für die
  // meldende Person nicht wieder lesbar; ausgewertet wird sie ausserhalb der App.
  reportContent(input) { throw new Error('nicht implementiert'); }

  // --- Crews & Räume ---
  getCrews() { throw new Error('nicht implementiert'); }
  getCrew(id) { throw new Error('nicht implementiert'); }
  createCrew(input) { throw new Error('nicht implementiert'); }
  // v6 A12: Gruppe verlassen darf nie eine herrenlose Gruppe hinterlassen.
  // leaveCrew liefert { ok:false, reason:'adminUebergabe' }, wenn ich alleinige:r Admin
  // bin und weitere Mitglieder existieren, und { ok:false, reason:'aufloesen' }, wenn ich
  // letztes Mitglied bin. Die Oberfläche bietet dann den passenden Weg an.
  leaveCrew(crewId) { throw new Error('nicht implementiert'); }
  // Runde 5 (C1): nur Admins, nur Freunde → { ok, added:[personId…], reason?: 'keineCrew'|'keinAdmin'|'keinFreund' }
  addCrewMembers(crewId, personIds) { throw new Error('nicht implementiert'); }
  transferCrewAdmin(crewId, personId) { throw new Error('nicht implementiert'); }
  dissolveCrew(crewId) { throw new Error('nicht implementiert'); } // {name, memberIds, color?} → Crew
  updateCrew(crewId, patch) { throw new Error('nicht implementiert'); } // {name?, color?} → {ok}
  getRoom(roomId) { throw new Error('nicht implementiert'); }
  getRoomForCrew(crewId) { throw new Error('nicht implementiert'); }
  getRoomForPerson(personId) { throw new Error('nicht implementiert'); }
  sendMessage(roomId, text) { throw new Error('nicht implementiert'); }
  markRoomRead(roomId) { throw new Error('nicht implementiert'); }
  canNudge(roomId) { throw new Error('nicht implementiert'); } // → {ok, remainingMs}
  nudge(roomId) { throw new Error('nicht implementiert'); }      // → {ok, reason?} — Impuls mit Cooldown
  // v3.2 B5: Der Impuls erzeugt KEIN Chat-Objekt. Der Raum zeigt stattdessen kurz
  // an, dass gerade gestupst wurde — dafür braucht er diese Abfrage.
  nudgeSentRecently(roomId, withinMs) { throw new Error('nicht implementiert'); } // → boolean
  nudgeSentAt(roomId) { throw new Error('nicht implementiert'); } // → Zeitstempel (ms) des letzten eigenen Anstupsers, 0 wenn keiner (Fable 3)
  // Runde 4: Anstupser zurücknehmen — Eintrag weg, Sperre (5 min) bleibt. → { ok, sperreBis }
  nudgeZuruecknehmen(roomId) { throw new Error('nicht implementiert'); }
  nudgeZurueckgenommen(roomId) { throw new Error('nicht implementiert'); } // → boolean
  // Runde 4: eigene Nachricht löschen. → { ok }
  deleteMessage(roomId, messageId) { throw new Error('nicht implementiert'); }
  respondNudge(roomId, messageId, response) { throw new Error('nicht implementiert'); } // 'frei'|'meet'|'zurueck' (Fable 3: Zurückstupsen)

  // --- Meets (gemeinsamer Browser) ---
  // context: {} | {crewId} | {personId} | {mine:true}; direction: 'upcoming'|'history'; date?: 'YYYY-MM-DD'
  // v4 (APP_REQUIREMENTS): 'upcoming' liefert aktive Meets IMMER zuerst und enthält nie
  // Vergangenes; 'history' enthält nie ein aktives Meet. Ein laufender Loop steht nur in
  // getLoops, ein gestoppter Loop ist wieder ein gewöhnliches Meet.
  getMeets(query) { throw new Error('nicht implementiert'); }
  getLoops(query) { throw new Error('nicht implementiert'); }
  getMeet(id) { throw new Error('nicht implementiert'); }
  setParticipation(meetId, state) { throw new Error('nicht implementiert'); } // 'yes'|'open'|'no'
  setLoopResponse(meetId, dateISO, response) { throw new Error('nicht implementiert'); } // 'yes'|'no'

  // --- Varianten (Vorschläge) ---
  addVariant(meetId, variant) { throw new Error('nicht implementiert'); } // führt gleiche Vorschläge zusammen; Cooldown
  editVariant(meetId, variantId, patch) { throw new Error('nicht implementiert'); } // nur eigene
  removeVariant(meetId, variantId) { throw new Error('nicht implementiert'); }
  voteVariant(meetId, variantId) { throw new Error('nicht implementiert'); } // toggelt eigene Stimme

  // --- Meet-Lebenszyklus ---
  // Ersteller legt eine Variante fest: {variantId?, kind?} → {ok, decided} (v14 05.6c/05.6d).
  decideMeet(meetId, options) { throw new Error('nicht implementiert'); }
  cancelMeet(meetId) { throw new Error('nicht implementiert'); } // nur Organisator
  deleteDraftMeet(meetId) { throw new Error('nicht implementiert'); } // nur leere Entwürfe
  hideFromHistory(meetId) { throw new Error('nicht implementiert'); }

  // --- Mitbringen & Umfragen ---
  toggleBring(meetId, itemId) { throw new Error('nicht implementiert'); }
  addBringItem(meetId, label) { throw new Error('nicht implementiert'); }
  // Runde 3 (K3, P6): Rückgängig für einen eben angelegten Punkt. Löschen darf, wer ihn angelegt hat. → { ok }
  removeBringItem(meetId, itemId) { throw new Error('nicht implementiert'); }
  votePoll(meetId, pollId, optionId) { throw new Error('nicht implementiert'); }
  addPoll(meetId, poll) { throw new Error('nicht implementiert'); }

  // --- Loop-Editor ---
  saveLoop(meetId, config) { throw new Error('nicht implementiert'); } // {repeat, weekday, time}
  stopLoop(meetId) { throw new Error('nicht implementiert'); }

  // --- Abschlussbewertung (privat) ---
  // v6 A23: review = { verdict, reasons:[…], aspects:[…], note }. Das Gateway ergänzt
  // meetId und Zeitpunkt. getReviews() liest alle privaten Bewertungen — Grundlage für
  // ein späteres echtes Empfehlungssystem, ausdrücklich ohne automatische Auswertung.
  getReviews() { throw new Error('nicht implementiert'); }

  // RoomPoll: { id, question, options:[{id,label,votes:[personId]}], createdBy, createdAt }
  // Eine Umfrage ohne Meetbezug. Sie gehört dem Raum und ist dort abstimmbar.
  // RoomEvent: { id, kind:'nudge'|'location', authorId, date, time, ... }
  // Strukturierte Ereignisse liegen in derselben Timeline wie Textnachrichten, sind aber
  // keine Textblasen. 'location' traegt zusaetzlich { label, lat, lon } — seit Runde 3 (K5, P6)
  // auch { name, address, quelle } (Straße und „6900 Bregenz" aus der Adresssuche). Die Nutzlast
  // ist frei (jsonb), deshalb ohne Migration.
  addRoomEvent(roomId, eintrag) { throw new Error('nicht implementiert'); }

  getRoomPolls(roomId) { throw new Error('nicht implementiert'); }

  addRoomPoll(roomId, pollInput) { throw new Error('nicht implementiert'); }

  voteRoomPoll(roomId, pollId, optionId) { throw new Error('nicht implementiert'); }

  // Setzt das Symbol eines eigenen, offenen Meets direkt.
  setMeetIcon(meetId, icon) { throw new Error('nicht implementiert'); }
  submitReview(meetId, review) { throw new Error('nicht implementiert'); } // {verdict, reasons?, note?}

  // --- Neues Meet (Entwürfe) ---
  createDraft(input) { throw new Error('nicht implementiert'); } // {withCrewId?|withPersonIds?} → Draft
  getDraft(id) { throw new Error('nicht implementiert'); }
  updateDraft(id, patch) { throw new Error('nicht implementiert'); }
  publishDraft(id) { throw new Error('nicht implementiert'); } // → Meet
  discardDraft(id) { throw new Error('nicht implementiert'); }

  // --- Entdecken & Gespeichert ---
  getSuggestions(filter) { throw new Error('nicht implementiert'); } // via SuggestionEngine (RulesEngine)
  getSuggestion(id, opts) { throw new Error('nicht implementiert'); } // Runde 4: opts { crewId?, personIds? } → Entfernung von der Gruppenmitte
  searchPlaces(query) { throw new Error('nicht implementiert'); } // Demo-Ortsbestand für Ort suchen
  // Runde 3: Wo Vorschläge gesucht werden. Freigegebener Standort (bleibt gerundet auf dem Gerät)
  // vor Zuhause-Adresse. → { lat, lon, quelle: 'standort' | 'zuhause' } | null
  getVorschlagsMitte(opts) { throw new Error('nicht implementiert'); }
  // Runde 5 (D4): { lat, lon, genau, quelle: 'geraet'|'geteilt'|'zuhause' } | null — nur mit Freigabe
  getMyLocation() { throw new Error('nicht implementiert'); }
  // Runde 5 (E1): Lage für die Mitfahr-Rechnung — für andere nur der geteilte Standort
  getLage(personId) { throw new Error('nicht implementiert'); }
  // Runde 5 (E1): → { fahrer:[{personId, plaetze, mitfahrer:[…]}], suchen:[…], selbst:[…] }
  getRides(meetId) { throw new Error('nicht implementiert'); }
  setRide(meetId, options) { throw new Error('nicht implementiert'); } // { rolle: 'fahrer'|'mitfahrer'|'selbst'|null, plaetze? } → { ok, reason? }
  assignRide(meetId, mitfahrerId, fahrerId) { throw new Error('nicht implementiert'); } // → { ok, reason?: 'verboten'|'keinFahrer'|'voll'|'keinMeet' } // Runde 4: opts { crewId?, personIds? } → Mittel mit geteilten Standorten (quelle 'gruppe')
  standortFuerVorschlaege() { throw new Error('nicht implementiert'); } // nur auf Tippen → Promise<{ ok, grund?: 'verweigert'|'geraet'|'unbekannt' }>
  vorschlagsStandortVergessen() { throw new Error('nicht implementiert'); }
  // Runde 3 (B2): Zeichen für Wörter lernen, die (noch) nicht in den Einstellungen stehen — z. B.
  // eigene Interessen während des Einrichtens. Kein Rückgabewert; gelernt wird still, dann notify.
  zeichenLernen(namen) { throw new Error('nicht implementiert'); }
  getPersonPlace(personId) { throw new Error('nicht implementiert'); }
  // v6 A13: Teilnehmende eines Meets nachträglich ändern; erzeugt bei mehr als einer
  // Person den gemeinsamen temporären Meet-Raum, falls er noch fehlt.
  updateMeetParticipants(meetId, personIds) { throw new Error('nicht implementiert'); }
  // v6 A18: Ortsanfrage und Antwort der betroffenen Person.
  getPlaceRequests(query) { throw new Error('nicht implementiert'); }
  respondPlaceRequest(requestId, accept) { throw new Error('nicht implementiert'); }
  requestPersonPlace(personId, options) { throw new Error('nicht implementiert'); } // Demo: Zustimmung folgt zeitversetzt
  approvePersonPlace(personId) { throw new Error('nicht implementiert'); }
  getSavedFolders() { throw new Error('nicht implementiert'); }
  createFolder(name) { throw new Error('nicht implementiert'); }
  getSavedIdeas(folderId) { throw new Error('nicht implementiert'); } // null/undefined = Alle
  saveIdea(idea, options) { throw new Error('nicht implementiert'); } // {folderId?}
  removeSavedIdea(id) { throw new Error('nicht implementiert'); }

  // --- Raum-Catch-up (RulesEngine-Zusammenfassung freier Chat-Infos) ---
  // sinceCount: Nachrichtenstand vor markRoomRead (Raum-Screen merkt ihn sich beim Öffnen).
  getCatchUp(roomId, sinceCount) { throw new Error('nicht implementiert'); }
}
