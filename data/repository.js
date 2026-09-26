// CrewRepository — der EINZIGE Datenvertrag der App (M0–M2: DemoDataGateway, M3: ServerDataGateway).
// Screens greifen nie direkt auf Arrays/Fixtures zu, sondern nur auf diese Methoden.
//
// Datenformen (informell):
//   Person   { id, name, initials, color, status?, free:{active,until?}, activeMeetId?, sharesLocation?,
//              area?, unread, interests:[..], resources:[..],
//              belegt:[{tage,von,bis,titel,privat}] (Runde 8 R8-39 — Busy: bei Freunden immer,
//                titel null hinter einem Schloss; bei allen anderen []),
//              standort:{lat,lon,at,genauigkeitM}|null (Runde 7 F9) }
//   Crew     { id, name, memberIds:[..], unread }
//   Room     { id, kind:'crew'|'meet'|'person', refId, messages:[{id,authorId,kind:'text'|'nudge'|'system',text,date,time,at?:ms,nudge?}], lastReadCount }
//   v6 A13: 'meet' ist der gemeinsame Raum EINER RUNDE (r:<meetId>). Er entsteht beim
//   Veröffentlichen eines Meets mit mehr als einer Einzelperson ohne gemeinsame Gruppe
//   und trägt genau dessen Teilnehmerliste. Er ist KEINE dauerhafte Crew-Gruppe.
//   Runde 7 (A4/A5): Das Wort „temporär" ist aus den Daten verschwunden — es beschrieb eine
//   technische Nebenwirkung. Die Sache heißt RUNDE: die Leute, die für diese eine
//   Verabredung zusammenkommen. Siehe getChats().
//   Runde 8 (R8-6): In der Chatliste heißt dieser Eintrag jetzt art:'meet' (Meet-Chat) — und er
//   verlässt sie ab Mitternacht nach dem Meet (getVergangeneChats). Wann ein Meet überhaupt einen
//   eigenen Raum bekommt, steht bei publishDraft.
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
//              pinnedIds:[chatId..] (Runde 7 A4 — angeheftete Chats, oben in getChats();
//                die id ist die des Eintrags: personId, crewId oder meetId. Beide Gateways
//                schreiben sie über updateSettings; sie ist privat und wird nie geteilt),
//              notifications, appearance, location, visibility, account, interests, resources,
//              standardAn (Runde 10: Markierung, dass Mitteilungen und Standort einmal auf den
//              Standard „an" gesetzt wurden — beide Gateways führen sie mit),
//              belegt:[{tage,von,bis,titel?,privat?}] (Runde 8 R8-39 — Busy, GESPEICHERTE Form:
//                titel/privat nur, wenn gesetzt; gelesen wird über getBelegt(); `belegtSichtbar` ist
//                entfallen: Freunde sehen Busy immer, das Schloss je Eintrag verbirgt nur den Titel),
//              gemerktIds:[findId…] (Runde 8 R8-50 — gemerkte Find-Einträge, privat; beide Gateways
//                schreiben sie über updateSettings),
//              chatAusgeblendet:{[chatId]:ms} (Runde 11 C1 — per Wischen ausgeblendete Chats: die Zeile
//                steht nicht in der Liste, solange ihre letzte Aktivität nicht NACH ms liegt; die Suche
//                findet sie weiter. Reine Anzeige der Crew-Liste, getChats() liefert sie unverändert),
//              chatGeleert:{[roomId]:ms} (Runde 11 C1 — „Chat löschen": Nachrichten bis einschließlich
//                ms stehen für MICH nicht mehr im Raum; beide Gateways filtern in roomFromId über
//                projections.js nachGeleert. Für die anderen ändert sich nichts),
//              homeAddress:{name,city,lat,lon,quelle,at}|null (Runde 7 H2 — null heißt: fehlt),
//              location:{use, shareMode:'niemand'|'alle'|'ausgewaehlte', shareIds:[personId…],
//                shareModeVorher?:'alle'|'ausgewaehlte'} — shareModeVorher (Runde 11 B5) merkt sich die Wahl
//                vor „Standort ausblenden" (Karte, Tipp auf mich), damit „zeigen" sie wiederherstellt; es steht
//                nur, solange shareMode 'niemand' durch das Ausblenden ist. Beide Gateways speichern das
//                ganze location-Objekt unverändert (der Server liest nur use/shareMode/shareIds),
//              standortGenauigkeit:{modus:'genau'|'ungefaehr',
//                ausnahmen:{[personId]:'genau'|'ungefaehr'}} (Runde 7 M1 — Vorgabe 'genau'),
//              free:{active,pending,from,fromAt,setAt,lust} — setAt trägt Runde 7 H1 }
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

  // --- Runde 7 (H1): „Frei zurücksetzen um HH:MM" hat eine WIRKUNG -----------------------
  // settings.freeResetTime war bis Runde 6 eine Zusage ohne Funktion: gespeichert, angezeigt
  // (profile.js), von niemandem gelesen. Jetzt gilt:
  //   · free.setAt hält fest, WANN „frei" gesetzt wurde (jedes setFree schreibt ihn).
  //   · Beim LESEN des Zustands (getFreeState/getSettings/getMe) wird geprüft, ob die
  //     eingestellte Uhrzeit seitdem überschritten wurde — deckt „App war zwei Tage zu" ab.
  //   · Solange die App offen ist, schlägt EINE Uhr genau zur Grenze (kein Minutentakt) und
  //     setzt zurück; danach stellt sie sich auf die nächste Grenze.
  //   · Wird die Uhrzeit geändert, während frei aktiv ist, gilt ab dem nächsten Lesen die
  //     NEUE Uhrzeit, gerechnet ab demselben setAt.
  //   · Gerechnet wird in der Zeitzone des Geräts über Jahr/Monat/Tag (nie „+24 h"), damit
  //     Sommerzeit die Uhrzeit nicht verschiebt (Regel in projections.js naechsteFreiGrenze).
  // → ms des nächsten Zurücksetzens, oder null (nicht frei / kein Anker).
  //
  // Runde 11 (B7) — gemessen in der echten Datenbank: Von fünf aktiven Frei-Zeilen hatten drei
  // weder Anker noch Grenze. Solche Zeilen liefen NIE ab, und Leute standen tagelang auf „frei".
  // Seitdem gilt in beiden Gateways:
  //   · Es gibt kein „frei ohne Ende". Fehlt die Uhrzeit oder ist sie kaputt, gilt Mitternacht
  //     (projections.js freiZeit) — abschalten lässt sich das Zurücksetzen ohnehin nicht.
  //   · Ein aktives „frei" ohne Anker bekommt beim Laden einen (projections.js freiMitAnker);
  //     ab da greift die Uhrzeit. Der Server-Datenweg schreibt die Zeile danach sauber zurück.
  //   · Auch das „frei" der ANDEREN endet, und geprüft wird es beim LESEN, nicht beim Laden
  //     (projections.js freiFuerAndere): Ihre Uhrzeit bleibt privat — auf dem Server steht in
  //     ihrer Zeile der fertige Zeitpunkt (free_status.gilt_bis), im Gerät gilt der Standard.
  //     Ein fremdes „frei", das nicht sagen kann, wann es endet, zählt nicht mehr als frei.
  //     `person.free` trägt die Grenze NICHT — der Datenvertrag beantwortet weiter genau eine
  //     Frage: ist diese Person JETZT frei.
  freiZuruecksetzenAm() { throw new Error('nicht implementiert'); }

  // --- Runde 8 (R8-39): Busy — feste Zeiten, die jede Woche wiederkommen -----------------------
  // Busy-Fenster { tage:[0…6], von:'HH:MM', bis:'HH:MM', titel?:string, privat?:boolean }
  // (Zeitform wie bisher: core/belegt.js; Titel und Schloss: projections.js).
  // GESPEICHERT (settings.belegt, Tabelle belegte_zeiten) steht titel nur, wenn es einen gibt, und
  // privat nur, wenn das Schloss zu ist — ein Fenster ohne beides sieht aus wie vor Runde 8.
  // GELESEN (getBelegt, getMe().belegt, person.belegt, Blöcke von getBelegtWoche) trägt jedes
  // Fenster beides ausdrücklich: titel string|null, privat boolean.
  //
  // (Runde 11, D5: Freunde sehen keine Titel mehr — siehe getBelegtWoche unten.)
  // Jonathan (R8-39): „keine Sichtbarkeits-Einstellung. Freunde sehen die Titel; Schloss für
  // private Einträge (wie bei Ressourcen) = nur ‚busy'." Deshalb gilt ab Runde 8:
  //   · Freunde sehen Busy IMMER — `setBelegtSichtbar` und `settings.belegtSichtbar` sind
  //     ersatzlos entfallen. Wer kein Freund ist (oder blockiert), sieht nichts.
  //   · Ein Fenster mit Schloss (privat:true) zeigt Freunden nur „busy": sein Titel kommt bei
  //     ihnen als null an. Im Server-Modus verlässt er die Datenbank gar nicht erst in ihre
  //     Richtung (Sicht belegte_zeiten_sicht, 0037) — die Grenze sitzt an der Kante.
  //   · Mehr als Titel und Schloss trägt ein Fenster nie: kein Ort, kein Grund, keine Leute.
  //   · Busy sperrt nichts — es setzt niemanden frei und verhindert keine Einladung.
  //
  // getBelegt()                → eigene Fenster, bereinigt: [{ tage, von, bis, titel, privat }]
  // setBelegt(liste)           → { ok, belegt } — ersetzt alle Fenster (ungültige fallen weg)
  // addBelegt(fenster)         → { ok, index, belegt } | { ok:false, reason:'ungueltig' }
  //   fenster nimmt titel (leer = kein Titel, höchstens 60 Zeichen) und privat an.
  // updateBelegt(index, patch) → { ok, belegt } | { ok:false, reason:'unbekannt'|'ungueltig' }
  //   patch darf auch nur { titel } oder nur { privat } sein; titel '' oder null nimmt ihn weg.
  // removeBelegt(index)        → { ok, belegt } | { ok:false, reason:'unbekannt' }
  getBelegt() { throw new Error('nicht implementiert'); }
  setBelegt(liste) { throw new Error('nicht implementiert'); }
  addBelegt(fenster) { throw new Error('nicht implementiert'); }
  updateBelegt(index, patch) { throw new Error('nicht implementiert'); }
  removeBelegt(index) { throw new Error('nicht implementiert'); }
  // Die Woche einer Person als BLÖCKE (projections.js busyWoche):
  //   eigen  → { ok:true, eigen:true, sichtbar:true,
  //              tage:[{ tag, streifen:[{ vonMin, bisMin, titel, privat, indizes:[fensterIndex…] }] }],
  //              fenster:[…eigene Fenster…], jetzt:{ belegt, bis, ende }, meetZeiten:[] }
  //   Freund → { ok:true, eigen:false, sichtbar:true,
  //              tage:[{ tag, streifen:[{ vonMin, bisMin, titel:null, privat:false }] }],
  //              fenster:null, jetzt,
  //              meetZeiten:[{ datum:'YYYY-MM-DD', vonMin, bisMin, offen:boolean }] }
  //   kein Freund / blockiert → { ok:true, eigen:false, sichtbar:false, tage:[], fenster:null, jetzt:null, meetZeiten:[] }
  //   unbekannt              → { ok:false, eigen:false, sichtbar:false, tage:[], fenster:null, jetzt:null, meetZeiten:[] }
  // Runde 11 (D5, Jonathan): „fremde Meets und Busy der Person immer als graue Blöcke ohne Titel".
  //   · Busy einer Freundin kommt OHNE Titel und ohne Schloss an (titel null, privat false) — im
  //     Server-Modus nimmt die Datenbank beides schon heraus (0041, private.busy_fuer_andere).
  //   · meetZeiten: die Zeitfenster der Meets, zu denen sie zugesagt hat (oder die sie angelegt hat
  //     und nicht beantwortet), die nächsten sieben Tage ab heute — NUR Datum, Beginn, Ende. Auch
  //     Meets, die ich selbst nicht sehen darf (Sicht meet_zeiten_sicht, 0041). offen = ohne Ende
  //     (läuft 4 h aus, projections.js meetSpanne). Jede Zeit eines Tages steht einmal.
  //     Ein Meet, das ich sehe, steht hier AUCH — die Oberfläche zeichnet eine Zeit, die sie schon als
  //     Meet kennt, nicht ein zweites Mal (profile.js zusammenTage).
  // Blöcke eines Tages verschmelzen nur, wenn sie dasselbe sagen (gleicher Titel, gleiches
  // Schloss) — 08–12 und 12–17 „Arbeit" sind ein Block. `indizes` sagt in der eigenen Sicht,
  // welche Fenster in einem Block stecken (Tipp auf den Block → dieses Fenster bearbeiten).
  // `fenster` ist NUR in der eigenen Sicht gefüllt; bei anderen ist es immer null.
  getBelegtWoche(personId) { throw new Error('nicht implementiert'); }

  // --- Runde 7 (E5): „Hast du Zeit?" — die flüchtige Frage -------------------------------
  // Runde 8 (R8-8, Jonathan): Die OBERFLÄCHE der Frage ist weg — kein Knopf, kein Band, keine
  // Antworten im Raum. Die Methoden bleiben (ausdrücklich erlaubt); gezeigt wird nichts davon.
  // Ersatz für das Anstupsen. Sie ist KEINE Nachricht: sie landet in keinem Raum, hinterlässt
  // keinen Verlauf und vergeht nach zwei Stunden von selbst (projections.js FRAGE_GUELTIG_MS).
  // Eine Frage von gestern ist wertlos — sie erzeugt nur schlechtes Gewissen.
  // Missbrauchsschutz: je Ziel eine offene Frage, danach 15 Minuten Ruhe, höchstens sechs
  // Fragen je Stunde insgesamt (FRAGE_SPERRE_MS, FRAGE_PRO_STUNDE).
  //
  // Frage { id, vonId, anId|null, crewId|null, zielSchluessel, at, bis, antwort:null|'ja'|'spaeter'|'nein', antwortAt }
  //
  // frageStellen({personId?|crewId?})  → { ok, frage } | { ok:false, grund:'ziel'|'laeuft'|'sperre'|'zuOft', wiederInMs }
  // getFragen()                        → { erhalten:[Frage…], gestellt:[Frage…] } (nur gültige, neueste zuerst)
  // frageBeantworten(id, antwort)      → { ok } | { ok:false, grund:'unbekannt'|'abgelaufen'|'fremd'|'antwort' }
  //   antwort 'ja' setzt NICHTS automatisch — wer frei ist, sagt das selbst über FREE.
  // frageZuruecknehmen(id)             → { ok } — nur die eigene; für die gefragte Person ist sie
  //   danach spurlos weg. Für die Grenze von sechs Fragen je Stunde zählt sie weiter
  //   (projections.js frageZaehltNoch) — sonst wäre die Grenze mit Zurücknehmen umgehbar.
  // frageDarfIch({personId?|crewId?})  → { ok } | { ok:false, grund, wiederInMs } (für graue Knöpfe)
  frageStellen(ziel) { throw new Error('nicht implementiert'); }
  getFragen() { throw new Error('nicht implementiert'); }
  frageBeantworten(frageId, antwort) { throw new Error('nicht implementiert'); }
  frageZuruecknehmen(frageId) { throw new Error('nicht implementiert'); }
  frageDarfIch(ziel) { throw new Error('nicht implementiert'); }

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
  // Runde 8 (R8-25): „zum Admin machen" — und zurück. Nur Admins dürfen das, nur für Mitglieder,
  // und die letzte Admin-Rolle einer Gruppe kann niemand wegnehmen (die Gruppe wäre herrenlos).
  // Die Regel steht einmal in projections.js (crewAdminGrund); die Datenbank setzt sie auf dem
  // Server noch einmal durch (crew_members_update, crew_members_guard).
  //   an true  → Person wird Admin (war sie es schon: ok, nichts passiert)
  //   an false → Person ist kein Admin mehr — auch ich selbst, wenn es noch andere Admins gibt
  // → { ok:true } | { ok:false, reason:'keinAdmin'|'keinMitglied'|'letzterAdmin' }
  setCrewAdmin(crewId, personId, an) { throw new Error('nicht implementiert'); }
  // v6 A12: Admin-Rolle ÜBERGEBEN (vor dem Verlassen). Seit Runde 8 in beiden Gateways dasselbe:
  // die Person wird Admin, ich bin es danach nicht mehr (vorher blieb ich auf dem Server Admin).
  transferCrewAdmin(crewId, personId) { throw new Error('nicht implementiert'); }
  dissolveCrew(crewId) { throw new Error('nicht implementiert'); } // {name, memberIds, color?} → Crew
  updateCrew(crewId, patch) { throw new Error('nicht implementiert'); } // {name?, color?} → {ok}
  getRoom(roomId) { throw new Error('nicht implementiert'); }
  getRoomForCrew(crewId) { throw new Error('nicht implementiert'); }
  getRoomForPerson(personId) { throw new Error('nicht implementiert'); }
  // Runde 11 (C1, D3): optionen = { replyTo?: messageId } — Antwort auf eine Nachricht DESSELBEN
  // Raums (sonst geht sie ohne Zitat raus). Die gesendete Nachricht trägt dann `replyTo` (nur die
  // Id, nie eine Kopie des Textes); auf dem Server ist das die Spalte messages.reply_to (0042).
  // Wird die zitierte Nachricht gelöscht, zeigt `replyTo` ins Leere — die Oberfläche sagt das.
  sendMessage(roomId, text, optionen) { throw new Error('nicht implementiert'); }
  markRoomRead(roomId) { throw new Error('nicht implementiert'); }

  // --- Runde 7 (A4/A5): EINE Chatliste ---------------------------------------------------
  // Personen-, Gruppen- und Meet-Chats in EINER nach Zeit sortierten Liste. Die Ordnung ist
  // eine Produktentscheidung und steht deshalb in projections.js (chatEintraege), nicht im
  // Bildschirm: sonst hätte jede Ansicht ihre eigene.
  //
  // Runde 8 (R8-6): Die dritte Art heißt 'meet' (bis Runde 7 'runde'): der eigene Chat eines
  // Meets mit einer GEMISCHTEN Runde. Wer wann welchen Chat bekommt, steht bei publishDraft.
  //
  // → [{ art:'person'|'gruppe'|'meet', id, roomId, name,
  //      person?|crew?|meet?, personIds? (nur Meet),
  //      letzte:{ text, authorId, kind, at }|null, zeit:ms, unread:number, anzahl:number,
  //      vergangen:boolean, kurzlebig:boolean, laeuft:boolean,
  //      zustand:''|'frei'|'laeuft'|'geplant'|'vorbei', benannt?:boolean (nur Meet) }]
  // `name` ist bei einem Meet-Chat NIE leer. Hat das Meet einen Titel, gilt der (benannt:true).
  // Hat es keinen, heißt der Chat nach seinen Leuten — „Mira, Sam" (benannt:false); Namen, die
  // diese App nicht kennt, werden GEZÄHLT („+2") und nicht geraten. Kennt sie gar keinen, sagt
  // die Zeile „Meet ohne Titel" — ehrlich statt leer (projections.js meetChatName).
  // Reihenfolge (Runde 11, A11): NUR nach Zeit — letzte Aktivität zuerst, bei Gleichstand nach Name.
  // Ungelesen verändert die Reihenfolge ABSICHTLICH nicht.
  // In getChats() ist `vergangen` immer false: vergangene Meet-Chats stehen NUR in
  // getVergangeneChats(). Alte Anstupser zählen weder als Ungelesen noch als letzte Nachricht.
  //
  // Runde 11 (B7, Jonathan): Ein ABGESAGTES Meet hat keinen Chat mehr — weder hier noch in
  // getVergangeneChats(). Vorher hing der Chat am Datum: Ein für nächsten Samstag abgesagtes
  // Meet behielt seine Zeile („geplant") bis Sonntag und stand danach noch sieben Tage unter
  // „Vergangene Meets". Die Regel steht in projections.js (meetChatAbgesagt) und gilt für beide
  // Gateways. Der Chat einer echten GRUPPE ist nie betroffen: er gehört der Gruppe, nicht dem
  // Meet — ein abgesagtes Gruppen-Meet nimmt der Gruppe ihren Chat nicht weg.
  getChats() { throw new Error('nicht implementiert'); }

  // Runde 8 (R8-6): „Vergangene Chats". Ein Meet-Chat ist VERGANGEN ab Mitternacht nach dem Tag
  // seines Meets (Gerätezeit; ein laufendes Meet und ein aktiver Loop nie) und steht dann sieben
  // Tage lang hier — dieselbe Eintragsform wie getChats(), vergangen:true, zustand 'vorbei',
  // jüngste Aktivität zuerst. Ein Chat ohne jede Nachricht steht nicht hier. Nach sieben Tagen
  // ist er weg: im Gerät beim Lesen gelöscht, auf dem Server nicht mehr gezeigt (das Löschen dort
  // ist eine Server-Aufgabe, siehe Bericht Runde 8).
  getVergangeneChats() { throw new Error('nicht implementiert'); }

  // Runde 8 (R8-6): Antwort auf die Frage nach dem Anlegen (publishDraft → gruppeWaehlbar).
  //   wahl 'gruppe' → das Meet gehört der Gruppe mit genau diesen Leuten; Chat = Gruppenchat.
  //   wahl 'eigen'  → es bleibt beim eigenen Meet-Chat.
  // → { ok:true, roomId } | { ok:false, grund:'keinMeet'|'wahl'|'schonGruppe'|'keineGruppe'|'schonGeschrieben' }
  meetChatWaehlen(meetId, wahl) { throw new Error('nicht implementiert'); }

  // Runde 7 (E5): VERALTET. Das Anstupsen wird durch die flüchtige Frage „Hast du Zeit?"
  // ersetzt (frageStellen/getFragen/frageBeantworten). Die nudge-Methoden bleiben vorläufig
  // bedienbar, damit bestehende Räume nicht mitten im Umbau brechen; neue Oberflächen bauen
  // ausschließlich auf die Frage. Sobald kein Bildschirm mehr nudge ruft, fällt dieser Block
  // hier und in beiden Gateways weg.
  //
  // Stand Runde 7, Welle 3 (18.09.2026), in web/ nachgezählt — der Block bleibt noch.
  // OHNE ZEILENNUMMERN, mit Absicht: in Welle 2 standen hier welche, und sie waren beim Melden
  // schon falsch — die genannten Stellen in room.js lagen um gut zwei Dutzend Zeilen daneben,
  // weil andere Pakete dieselben Dateien gerade umbauten. Eine Notiz, die den nächsten in die
  // Irre führt, ist schlechter als keine.
  // Nachzählen mit: grep -rn "\.canNudge(\|\.nudge(\|\.nudgeZuruecknehmen(" web/
  //   · web/ui/components.js, Funktionen anstupsZustand() und anstupsen(): rufen canNudge, nudge,
  //     nudgeSentAt, nudgeZurueckgenommen und nudgeZuruecknehmen. Eine Zahl steht hier bewusst
  //     nicht: beim Nachzählen in Welle 3 waren es binnen weniger Minuten zehn, dann neun, dann
  //     acht Aufrufstellen — das Paket baut die Datei gerade um. Beide sind exportiert und werden von KEINEM
  //     Bildschirm mehr importiert (room.js sagt das selbst) — aber components.js gehört dem
  //     Paket „Proportionen und Laufruhe", nicht der Datenschicht. Erst wenn die zwei Funktionen
  //     dort fallen, dürfen diese fünf Methoden fallen.
  //   · web/screens/room.js ruft seit Runde 8 (R8-8) KEINE dieser Methoden mehr: Der Raum zeigt
  //     alte Anstupser nicht mehr an, also gibt es auch nichts mehr zu beantworten, und die
  //     Chatliste zählt sie nicht (projections.js raumStand). respondNudge und nudgeSentRecently
  //     sind damit ohne Aufrufer in web/screens; sie bleiben, bis der Block als Ganzes fällt
  //     (Datenmethoden dürfen bleiben, Auftrag Runde 8).
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
  //
  // Runde 11 (B10, Jonathan D10): WER BEWERTET WIRD, ist eine Regel der Daten — projections.js ›
  // meetBewertbar(meet, me, heute), von beiden Gateways und jeder Oberfläche gelesen, nie
  // nachgebaut: ich war dabei (Zusage 'yes'), das Meet ist vorbei (meetIstVorbei), nicht abgesagt und
  // hat klaren Inhalt (meetKlarerInhalt: eine Aktivität ODER ein Ort — ein „Spontanes Treffen" ohne
  // Ort nicht). Gefragt wird zusätzlich nur, solange es unbewertet und höchstens sieben Tage her ist
  // (ui/meet-panels.js bewertungOffen). Unter welchem Namen gefragt wird, sagt meetBewertungsTitel
  // (Titel, sonst Ort) — nie leer. submitReview und getReviews prüfen die Regel bewusst NICHT selbst:
  // eine schon gespeicherte Bewertung bleibt les- und änderbar, auch wenn die Regel sie heute nicht
  // mehr anfragen würde.
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
  // → { ok:true, meetId, gruppeWaehlbar:crewId|null } | { ok:false, reason }
  // Runde 8 (R8-6) — welcher Chat gehört zum neuen Meet?
  //   · mit einer Gruppe angelegt        → der Gruppenchat
  //   · genau EINE andere Person         → der Chat mit ihr (kein eigener Raum)
  //   · genau die Leute einer Gruppe     → vorerst ein eigener Meet-Chat, und gruppeWaehlbar
  //                                        trägt die crewId: die Oberfläche fragt „Gruppe nehmen
  //                                        oder eigener Chat" und ruft meetChatWaehlen
  //   · jede andere Mischung             → ein eigener Meet-Chat (r:<meetId>)
  publishDraft(id) { throw new Error('nicht implementiert'); }
  discardDraft(id) { throw new Error('nicht implementiert'); }

  // --- Entdecken & Gespeichert ---
  getSuggestions(filter) { throw new Error('nicht implementiert'); } // via SuggestionEngine (RulesEngine)
  getSuggestion(id, opts) { throw new Error('nicht implementiert'); } // Runde 4: opts { crewId?, personIds? } → Entfernung von der Gruppenmitte
  searchPlaces(query) { throw new Error('nicht implementiert'); } // Demo-Ortsbestand für Ort suchen
  // Runde 3: Wo Vorschläge gesucht werden. Freigegebener Standort (bleibt gerundet auf dem Gerät)
  // vor Zuhause-Adresse. → { lat, lon, quelle: 'standort' | 'zuhause' } | null
  getVorschlagsMitte(opts) { throw new Error('nicht implementiert'); }
  // Runde 5 (D4): { lat, lon, genau, quelle: 'geraet'|'geteilt'|'zuhause' } | null — nur mit Freigabe
  // Runde 7 (F9): zusätzlich `genauigkeitM` — der Halbmesser in Metern, innerhalb dessen die
  // Person wirklich ist. Die Karte zeichnet daraus einen Kreis statt eines Punktes, der
  // Genauigkeit vortäuscht.
  // Runde 7, Welle 3 (Hausregel 8): `genauigkeitM` ist null, wenn es KEINE ehrliche Zahl gibt.
  // Das hat zwei Gründe, und `quelle` sagt welchen:
  //   · quelle 'zuhause'            → eine über die Suche eingetragene Adresse IST ein Punkt.
  //     Ein aus dem Standort übernommenes Zuhause hat dagegen eine Zahl (787 m, siehe
  //     setHomeAddressAusStandort) — es ist KEIN Punkt und fällt nicht unter null.
  //   · sonst (geteilt/geraet)      → das Gerät hat keine Genauigkeit gemeldet: unbekannt
  // Ohne Zahl zeichnet die Karte in beiden Fällen keinen Kreis; wo Text steht,
  // gehört im zweiten Fall „Genauigkeit unbekannt" hin. Bis Welle 2 stand dort 100 — eine Zahl, die niemand gemessen
  // hatte, aus der die Karte einen 100-m-Kreis zeichnete, der nichts bedeutete.
  // Runde 7 (M1): Die Zahl ist jetzt die ECHTE Messgenauigkeit des Geräts (oft 5–30 m), nicht
  // mehr die eigene Rundung. Reihenfolge der Quellen, in beiden Gateways gleich: der geteilte
  // (genaue) Standort zuerst, dann der grobe Vorschlags-Raster (0,01° → gerechnete 787 m — der
  // geht an die Orte-Funktion, also an einen Dritten, und bleibt deshalb grob), zuletzt das
  // Zuhause (über die Suche eingetragen: echter Punkt, genauigkeitM null; aus dem Standort
  // übernommen: die 787 m, die es trägt). Siehe projections.js, Abschnitt F9/M1.
  getMyLocation() { throw new Error('nicht implementiert'); }
  // Runde 5 (E1): Lage für die Mitfahr-Rechnung — für andere nur der geteilte Standort
  // Runde 7 (F9): → { lat, lon, quelle, genauigkeitM } | null
  getLage(personId) { throw new Error('nicht implementiert'); }

  // --- Runde 7 (M1): Wie GENAU sehen mich die, die mich sehen dürfen? --------------------
  // Jonathan: „aktuell sind 20 m oder was auch immer zu ungenau." Gemessen war es gröber: jeder
  // geteilte Standort lag auf 0,001° ≈ 100 m — gerundet im Gerät (0025) und noch einmal auf dem
  // Server (0034). Auf 100 m ist nicht zu sagen, in welchem Lokal jemand sitzt, und genau das
  // ist die Frage dieser App. Die Rundung ist zurückgenommen: GENAU ist der Normalfall.
  // Begründung: Der Standort geht ohnehin nur an Freunde, die man selbst ausgewählt hat — „wer
  // darf mich sehen" ist entschieden, bevor eine Koordinate entsteht. Eine zweite, versteckte
  // Abschwächung obendrauf ist keine Zurückhaltung, sondern eine stille Verschlechterung.
  //
  // Wer es anders will, kann umstellen — für alle ODER je Person:
  //   settings.standortGenauigkeit = { modus, ausnahmen:{[personId]:…} }; 'ungefaehr' rundet auf
  //   0,001° und meldet mindestens UNGEFAEHR_M Halbmesser — das sind 79 m, GERECHNET als
  //   Halbmesser genau dieser Rasterzelle (projections.js rasterHalbmesserM), nicht geraten.
  //
  // WAS ES HEUTE NICHT GIBT (Runde 7, Welle 3, ehrlich statt Zusage): eine Stelle in der App, an
  // der ein Mensch das umstellt. Bis Welle 2 sagten hier, in 0025, in 0034 und im Bericht gleich
  // vier Texte ein sichtbares Umstellen zu — erreichbar war es nur über die Konsole. Das ist
  // Hausregel 9 von der anderen Seite: Wirkung ohne Knopf. Die Oberfläche gehört dem Profil-Paket; solange sie
  // fehlt, gilt für alle, die mich sehen dürfen, die Vorgabe 'genau'. Die vier Methoden unten
  // sind fertig, in beiden Gateways gleich und halten jeden Bestand aus: fehlt die Einstellung
  // ganz oder steht Unsinn darin, ist die Antwort 'genau' mit leeren Ausnahmen.
  // Durchgesetzt wird es im SupabaseGateway nicht vom Client, sondern von der Sicht
  // public.standorte_sicht (0034) — ein fremdes Gerät kann die Entscheidung nicht umgehen.
  //
  // WANN DAS GERÄT GEFRAGT WIRD (Runde 7, Welle 3 — gilt für BEIDE Gateways): Eine
  // Erlaubnisfrage entsteht NIE ohne Zutun. Gemessen war das Gegenteil: `ready()` beim Start und
  // jeder Wechsel in den Vordergrund riefen standortSenden(), und das rief getCurrentPosition —
  // der Browser fragte also, ohne dass jemand getippt hatte. Wer beim Öffnen unvermittelt gefragt
  // wird, sagt Nein, und danach ist der Weg für lange zu. Die Regel lautet jetzt:
  //   · standortSenden({ sofort: true }) — jemand hat GERADE getippt: fragen ist erlaubt.
  //   · standortSenden() ohne `sofort` — Start, Vordergrund, Zeitablauf: nur messen, wenn die
  //     Erlaubnis SCHON erteilt ist (projections.standortErlaubnisSchonDa fragt den Browser, nicht
  //     den Menschen). Sonst geschieht gar nichts — auch keine Wache (watchPosition).
  //
  // getStandortGenauigkeit()          → { modus, ausnahmen }
  // getStandortGenauigkeit(personId)  → 'genau' | 'ungefaehr' (die Ausnahme schlägt den Modus)
  // setStandortGenauigkeit(modus)     → { ok, genauigkeit } | { ok:false, grund:'modus' }
  // setStandortGenauigkeitFuer(personId, modus|null) → { ok, genauigkeit } | { ok:false, grund }
  //   modus null nimmt die Ausnahme zurück; danach gilt wieder, was für alle gilt.
  // standortFuerFreund(personId)      → { lat, lon, at, genauigkeitM, genau } | null
  //   Was diese Person WIRKLICH von mir sieht — null, wenn sie meinen Standort gar nicht sieht
  //   (dann gehört die Zeile weggelassen statt grau) oder wenn es gar keinen gibt.
  //   Ohne diese Antwort wäre die Einstellung eine Zusage ohne nachweisbare Wirkung (Hausregel 9).
  //   Für MICH SELBST (personId === die eigene Id) ist die Antwort immer meine genaue Lage —
  //   wie auf dem Server (0025 `besitzer = betrachter`, 0034 standort_genau_fuer). Welle 2 sagte
  //   im Gerät etwas anderes als am Server; das war ein Vertragsbruch (Hausregel 3).
  getStandortGenauigkeit(personId) { throw new Error('nicht implementiert'); }
  setStandortGenauigkeit(modus) { throw new Error('nicht implementiert'); }
  setStandortGenauigkeitFuer(personId, modus) { throw new Error('nicht implementiert'); }
  standortFuerFreund(personId) { throw new Error('nicht implementiert'); }

  // --- Runde 11 (C4, D8): einen frischen Standort anfragen ------------------------------------
  // Tipp auf eine Freundin (Karte) → bei ihr wird ein frischer Standort angefragt (Mitteilung an
  // ihr Gerät). Erlaubt nur bei Freunden, nicht bei Blockierten und nur, wenn sie ihren Standort
  // ohnehin mit mir teilt — eine Anfrage gibt nie mehr heraus, als sie freigegeben hat. Je Paar
  // höchstens eine Anfrage in 10 Minuten (die zweite gibt die erste zurück, ohne neue Mitteilung).
  // Server: public.standort_anfragen (0044). BEANTWORTET heißt: Sie hat danach eine frische Lage
  // geschrieben — das hakt der Server ab (Auslöser auf standorte), mit SEINER Uhr. Ihr Gerät
  // antwortet von selbst: sofort, wenn Crew bei ihr offen ist, sonst beim Öffnen (auch über die
  // Mitteilung); die native App auch bei geschlossener App, soweit das Telefon sie weckt.
  // standortAnfragen(personId) → Promise<{ ok:true, neu:boolean, at, beantwortet:number|null }
  //                                      | { ok:false, grund:'keinFreund'|'teiltNicht'|'zuOft'|'offline'|'fehler' }>
  // standortAnfrage(personId)  → { at, beantwortet:number|null } | null
  //   Meine letzte Anfrage an diese Person, höchstens 30 Minuten alt — für „angefragt …" und
  //   „noch keine Antwort" auf der Karte.
  standortAnfragen(personId) { throw new Error('nicht implementiert'); }
  standortAnfrage(personId) { throw new Error('nicht implementiert'); }

  // --- Runde 7 (H2): Zuhause -------------------------------------------------------------
  // settings.homeAddress war bei jedem echten Konto null und stand nur im Beispielbestand;
  // festlegen konnte man es nirgends. Ab jetzt gehört es zum Vertrag.
  //   Ort { name, city, lat, lon, quelle:'suche'|'standort', at }
  // FEHLT es, liefert getHomeAddress() null — und die Oberfläche muss das aushalten und
  // ehrlich sagen. Es wird NIE eine Ersatzadresse erfunden (Hausregel 8).
  //
  // getHomeAddress()             → Ort | null
  // setHomeAddress(ort)          → { ok, ort } | { ok:false, grund:'koordinaten'|'name' }
  //   ort braucht lat/lon (Zahlen) und einen Namen; city ist freiwillig.
  //   `genauigkeitM` ist freiwillig und wird geklemmt wie überall sonst (1 m … 20 km,
  //   projections.genauigkeitKlemmen). Steht keine brauchbare Zahl da, steht GAR KEINE da.
  // setHomeAddressAusStandort()  → Promise<{ ok, ort? } | { ok:false, grund:'verweigert'|'geraet'|'unbekannt' }>
  //   Nur auf Tippen. Aus dem Gerätestandort entsteht ein Ort OHNE erfundenen Straßennamen:
  //   name bleibt leer, `quelle:'standort'` sagt der Oberfläche, dass sie „Aktueller Standort"
  //   schreiben soll statt eine Adresse zu behaupten.
  //   Runde 7, Welle 3: Der Punkt kommt aus dem Raster der Orts-Vorschläge (0,01°), und der Ort
  //   trägt dessen GERECHNETEN Halbmesser (projections.GENAUIGKEIT_M.geraet, 787 m) — vorher eine
  //   getippte 1000 (Hausregel 8). Ein so übernommenes Zuhause ist also KEIN Punkt; ein über die
  //   Suche eingetragenes schon (dort steht keine Zahl). Wer das unterscheiden muss, liest
  //   `quelle`. Der Vertrag zur Zahl selbst steht bei GENAUIGKEIT_M in projections.js.
  // clearHomeAddress()           → { ok } — danach ist es wieder null, nicht „leer aber da".
  getHomeAddress() { throw new Error('nicht implementiert'); }
  setHomeAddress(ort) { throw new Error('nicht implementiert'); }
  setHomeAddressAusStandort() { throw new Error('nicht implementiert'); }
  clearHomeAddress() { throw new Error('nicht implementiert'); }

  // --- Routen speichern: die Abholadresse (Auftrag AUFTRAG_ROUTEN_SPEICHER.md, Migration 0047) -------------------
  // Freiwillig, getrennt vom Zuhause: Das Zuhause bleibt privat; die Abholadresse ist ausdrücklich für den Fahrer
  // gedacht, bei dem man mitfährt. Sie ist der Standard-Startpunkt, wenn man mitfährt. Nur wer „vom aktuellen
  // Standort abholen" wählt, wird am Live-Standort abgeholt. Es zählt nur, was die Person selbst einträgt — die App
  // leitet nie selbst einen Wohnort ab (VERSION_1.md, Abschnitt 4).
  // Sichtbar ist sie nur für die Person selbst und für den Fahrer eines Meets, bei dem sie mitfährt — sonst für niemanden.
  //
  // getAbholadresse()            → { name, city, lat, lon, quelle:'suche', at } | null   (null heißt: fehlt)
  // setAbholadresse(ort)         → { ok, ort } | { ok:false, grund:'koordinaten'|'name' }   (ort: { name, city|address, lat, lon })
  // clearAbholadresse()          → { ok }
  // setAbholung(meetId, wert)    → { ok } | { ok:false, reason:'keineMitfahrt' }
  //                                wert 'standort' = vom aktuellen Standort abholen, 'adresse' = wieder die Abholadresse.
  // getAbholort(meetId, personId) → { lat, lon, quelle:'abholadresse'|'geteilt', name?, genauigkeitM } | null
  //                                Wo wird diese Person für dieses Meet abgeholt? 'standort' gewählt → ihr Live-Standort
  //                                (wie getLage). Sonst ihre Abholadresse — die eigene, oder die einer Person, die bei mir
  //                                eingestiegen ist. Sonst null: ehrlich „ohne Standort", nichts wird erfunden.
  // getRides(...).anreisen[].abholung → 'standort' | null.
  // getAbholzeit(meetId)        → { fahrerId, abMin, gesamtMin } | null — MEINE Abholzeit, vom Server aus der Route des Fahrers
  //                                gerechnet: Minuten nach dem Start des Fahrers und Dauer der ganzen Fahrt bis zum Treffpunkt.
  //                                Keine Adresse, keine Koordinate, nichts über die anderen. null = unbekannt (Demo, oder der
  //                                Fahrer hat noch nicht gerechnet). Uhrzeit = Meet-Zeit − (gesamtMin − abMin).
  getAbholzeit(meetId) { throw new Error('nicht implementiert'); }
  getAbholadresse() { throw new Error('nicht implementiert'); }
  setAbholadresse(ort) { throw new Error('nicht implementiert'); }
  clearAbholadresse() { throw new Error('nicht implementiert'); }
  setAbholung(meetId, wert) { throw new Error('nicht implementiert'); }
  getAbholort(meetId, personId) { throw new Error('nicht implementiert'); }

  // --- Runde 5 (E1) / Runde 7 (E6): Anreise ----------------------------------------------
  // Bis Runde 6 gab es nur fahrer/mitfahrer/selbst. „Ich komme mit dem Rad" war nicht sagbar,
  // und „selbst" hieß alles und nichts. Ab jetzt sagt die ANREISE die Art:
  //   'auto' | 'oeffi' | 'rad' | 'fuss' | 'selbst' | 'mitfahrt'
  // 'auto' mit plaetze ≥ 1 ist zugleich das alte „fahrer" (bietet mit), 'mitfahrt' das alte
  // „mitfahrer" (braucht eine Mitfahrt). 'selbst' bleibt für alle bestehenden Einträge, bei
  // denen niemand je gesagt hat, WIE — es wird nichts dazuerfunden.
  //
  // getRides(meetId) → {
  //   fahrer:[{personId, plaetze, mitfahrer:[personId…]}],   // unverändert
  //   suchen:[personId…],                                    // unverändert
  //   selbst:[personId…],                                    // jetzt auch Öffi/Rad/zu Fuß
  //   anreisen:[{personId, art, plaetze, fahrerId, rolle}],  // NEU: die volle Wahrheit
  //   nachArt:{ auto:[…], oeffi:[…], rad:[…], fuss:[…], selbst:[…], mitfahrt:[…] } }
  // setAnreise(meetId, { art, plaetze? }) → { ok, reason?:'keinMeet'|'art' }; art null löscht.
  // setRide bleibt für Altaufrufer und übersetzt intern auf setAnreise.
  getRides(meetId) { throw new Error('nicht implementiert'); }
  setAnreise(meetId, options) { throw new Error('nicht implementiert'); }
  setRide(meetId, options) { throw new Error('nicht implementiert'); } // { rolle: 'fahrer'|'mitfahrer'|'selbst'|null, plaetze? } → { ok, reason? }
  // Runde 11 (C3): eine echte Route über Straßen (Supabase-Funktion `route` → OpenRouteService; der
  // Schlüssel liegt nur auf dem Server). punkte: [{lat,lon}, …] in Fahrtreihenfolge, 2–12 Stück.
  // → Promise<{ ok:true, linie:[[lon,lat],…], meter, dauerMin, abschnitte:[{ meter, dauerMin }],
  //               reihenfolge?:[Index in punkte je Halt der Fahrt] }
  //           | { ok:false, reason:'ohneKonto'|'punkte'|'dienst' }>
  // Runde 12: Der Dienst fährt mit preference "fastest" und darf die Abholungen (alles zwischen dem
  // ersten und dem letzten Punkt) nach echter Fahrzeit umstellen. `reihenfolge` nennt dann die Indizes der
  // gefragten Punkte in Fahrtreihenfolge (Start und Ziel bleiben); linie und abschnitte gelten für
  // DIESE Reihenfolge. Fehlt `reihenfolge`, ist es die gefragte.
  // Nur angemeldet; die Demo hat kein Konto und antwortet immer ok:false — dann rechnet
  // web/ui/route.js ehrlich geschätzt (`geschaetzt: true`).
  // Routen speichern (0047): Der Dienst merkt sich die Route je Fahrer und Menge der Halte — dieselbe Menge kostet beim
  // Routen-Dienst nichts mehr. Dafür kennt die Anfrage optionen: { fahrer: personId (wessen Fahrt), meet: meetId (dann wird
  // die Route 30 Tage nach dem Meet gelöscht), personen: [personId|null je Punkt] (nur der Fahrer selbst: daraus merkt der Server
  // die Abholzeit je Mitfahrer, getAbholzeit), live: [Index in punkte, …] (Punkte am Live-Standort — die gelten höchstens
  // 10 Minuten, weil sich der Standort bewegt) }. Ohne optionen läuft alles wie vorher, nur mit kurzer Gültigkeit.
  routeFragen(punkte, optionen) { throw new Error('nicht implementiert'); }

  // --- Runde 7 (A6): „Ich bin da" --------------------------------------------------------
  // Ankunftsstempel am Meet. Er beantwortet eine Alltagsfrage, die die App bisher nicht
  // stellen konnte: „drei sind schon da — soll ich los?". AUSDRÜCKLICH NICHT dabei und auch
  // später nicht: kein Punktestand, kein Verlauf über Meets hinweg, keine Verspätungsminuten,
  // kein Geld (Begründung in scratch/entwuerfe/challenges-einsaetze-entwurf-gegen-den-e.md).
  // Nur die EIGENE Ankunft ist setzbar, und sie ist zurücknehmbar — jemand tippt aus Versehen.
  //
  // getAnkuenfte(meetId)     → { liste:[{personId, at, position}], anzahl, ichDa, meineZeit }
  // setAnkunft(meetId, an)   → { ok, position? } | { ok:false, reason:'keinMeet'|'nichtDabei' }
  getAnkuenfte(meetId) { throw new Error('nicht implementiert'); }
  setAnkunft(meetId, an) { throw new Error('nicht implementiert'); }
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

  // --- Runde 8 (R8-50/R8-66): Find — der fünfte Bereich --------------------------------------
  // Eintrag { id, titel, art:'event'|'restaurant'|'erlebnis', ort:{ name, lat, lon },
  //           wann?:{ von:ms, bis:ms }, bild?, bildUrheber?, bildSeite?, score:0…100,
  //           testerBewertung?:{ note:1…5 (halbe Schritte), text, beispiel?:true },
  //           gesponsert:boolean, tags:[…] }
  // `score` ist die VORLÄUFIGE Regel aus projections.js findScore (Interessen, Gelerntes, Nähe,
  // bald beginnende Events), bis Jonathans Algorithmus sie ersetzt — für jede Person anders.
  // Die Tester-Bewertung steht getrennt daneben und fließt NICHT ein; `gesponsert` ebenso wenig.
  // `testerBewertung.beispiel` ist nur im Beispielbestand gesetzt: Die Oberfläche kennzeichnet
  // solche Bewertungen als Beispiel (der Text beginnt ohnehin mit „Beispiel:").
  // `bildUrheber`/`bildSeite` sind die Namensnennung, die freie Bildlizenzen verlangen — wo ein
  // Bild steht, gehört sie mit auf die Fläche (wie bei „Entdecken").
  // Runde 11 (C2): `scoreGruende:[{ grund:'interesse'|'art'|'gelernt'|'naehe'|'weit'|'bald', wert:±n,
  // wort?, km? }]` — die Teile der Rechnung (projections.js › findScoreTeile), damit man sieht, warum
  // derselbe Eintrag für zwei Menschen verschiedene Zahlen trägt. „Nähe" rechnet von getMyLocation(),
  // sonst von der Mitte der Vorschläge (Zuhause).
  //
  // getFindEintraege()        → [Eintrag…] — vergangene Events fallen weg; sortiert nach score,
  //                              dann Titel. Gemerkt ist, was in settings.gemerktIds steht.
  //                              Runde 11 (C2): Am Server stehen neben den Einträgen des Admins
  //                              die Einträge des Grundbestands (seed/find.js › findGrundbestand).
  // istAdmin()                → boolean — darf dieses Konto Einträge anlegen? Im Server-Modus
  //                              entscheidet die Tabelle find_admins (0038), nie die App. Im
  //                              Demo-Modus gibt es kein Konto und damit keinen Admin: false.
  // addFindEintrag(eintrag)   → { ok:true, eintrag } | { ok:false, reason:'keinAdmin'|'ungueltig', feld? }
  //   eintrag wie oben, ohne id und score (beides entsteht hier); ein Event braucht `wann`.
  getFindEintraege() { throw new Error('nicht implementiert'); }
  istAdmin() { throw new Error('nicht implementiert'); }
  addFindEintrag(eintrag) { throw new Error('nicht implementiert'); }

  // --- Raum-Catch-up (RulesEngine-Zusammenfassung freier Chat-Infos) ---
  // sinceCount: Nachrichtenstand vor markRoomRead (Raum-Screen merkt ihn sich beim Öffnen).
  getCatchUp(roomId, sinceCount) { throw new Error('nicht implementiert'); }
}
