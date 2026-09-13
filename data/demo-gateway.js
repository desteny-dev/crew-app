// DemoDataGateway — lokale M0–M2-Implementierung des CrewRepository.
// Kein Login, keine Echtzeit, keine externen Dienste; Zustand liegt in localStorage.
// In M3 ersetzt ein ServerDataGateway denselben Vertrag, ohne dass Screens neu gebaut werden.

import { CrewRepository } from './repository.js';
import { ME, PEOPLE, roomIdForCrew, roomIdForPerson, roomIdForMeet } from './ids.js';
import { seedPeople, seedCrews, seedInviteDirectory } from './seed/crew.js';
import { seedSettings } from './seed/profile.js';
import { seedMeets } from './seed/meets.js';
import { seedMessages } from './seed/rooms.js';
import { seedSuggestions, seedFolders, seedSavedIdeas, seedPersonPlaces, seedStandorte } from './seed/discover.js';
import { toISODate, now } from '../core/dates.js';
import { t, sprache } from '../core/sprache.js';
import { mitAbstand } from '../engine/suggestion-engine.js';
import { entfernungKm, hatLage } from '../core/entfernung.js';
import {
  OrteNachlader, vorschlagsMitte, standortFuerVorschlaegeHolen, vorschlagsStandortVergessen, vorschlagsStandortAuffrischen,
  vorschlagsFoto,
} from './orte-vorschlaege.js';
import { zeichenNachlernen, namenAusEinstellungen } from './zeichen-lernen.js';
// Die Produktregeln (Freigabe-Sichtbarkeit, Profil-Sortierung, Code-Form, Kommend/Verlauf)
// liegen in projections.js, weil sie für BEIDE Gateways gelten müssen — sonst gäbe es zwei
// Wahrheiten für dieselbe Frage.
import {
  isSharedWith, projectProfile, normalizeInviteCode, isInviteCodeFormat,
  sortAndFilterMeets, meetMatchesContext, uebernimmOrt,
} from './projections.js';

// v4: Der Schlüssel wandert mit, sobald sich die Seed-Form ändert (hier: Einladungscodes,
// Einladungs-Verzeichnis, Ressourcen-Sichtbarkeit). Sonst liest ein Gerät mit altem
// localStorage weiter den alten Bestand und die neuen Zustände wären unerreichbar.
const STORAGE_KEY = 'crew-demo-state-v4';
// Runde 2: Merkmal des versteckten Demo-Einstiegs (gesetzt in data/gateway.js starteDemo).
export const DEMO_NEU_KEY = 'crew-demo-neu';
const VARIANT_COOLDOWN_MS = 20000;

function deepClone(value) {
  return JSON.parse(JSON.stringify(value));
}

function buildSeedState() {
  return {
    settings: deepClone(seedSettings),
    people: deepClone(seedPeople),
    inviteDirectory: deepClone(seedInviteDirectory),
    crews: deepClone(seedCrews),
    meets: deepClone(seedMeets),
    messages: deepClone(seedMessages),
    roomRead: {},
    drafts: {},
    folders: deepClone(seedFolders),
    savedIdeas: deepClone(seedSavedIdeas),
    suggestions: deepClone(seedSuggestions),
    personPlaces: deepClone(seedPersonPlaces),
    // v6 A18: offene Ortsanfragen leben als eigene Liste, nicht als Timer.
    // Eine eingehende Anfrage: Sam möchte das Pasta-Meet bei mir machen. Ohne sie ließe
    // sich die Empfängerseite von A18b in der Demo überhaupt nicht zeigen.
    placeRequests: [{
      id: 'pq-seed-1',
      meetId: 'm-pasta',
      hostId: ME,
      requesterId: PEOPLE.SAM,
      status: 'open',
      createdAt: '2026-08-28T18:20:00.000Z',
    }],
    variantCooldowns: {},
    nextId: 1000,
  };
}

// Auftrag §10 und §3: der Zustand eines ganz neuen Menschen. Nicht der Seed mit gelöschten
// Listen, sondern von Anfang an leer — so, wie jeder Freund die App zum ersten Mal sieht.
function buildLeerState() {
  const state = buildSeedState();
  state.settings = {
    ...deepClone(seedSettings),
    onboarded: false,
    name: '',
    initials: '',
    photo: null,
    interests: [],
    interestLevels: {},
    resources: [],
    resourceShares: {},
    resourceMeta: {},
    bestFriendIds: [],
    specialPerson: null,
    // Runde 4 (Jonathan: „Der Standard ist bei allen Freunden, dass man von allen eine Benachrichtigung kriegt, wenn sie frei sind.")
    freiHints: { mode: 'alle', customIds: [] },
    friendRequests: [],
    outgoingRequests: [],
    free: { active: false, pending: false, from: null, setAt: null, fromAt: null },
    pendingInvite: null,
    // Runde 2: Ein neuer Mensch hat noch kein Zuhause hinterlegt und teilt keinen Standort.
    // Vorher erbte der leere Zustand beides aus dem Seed — die Karte stand deshalb auch beim
    // allerersten Start auf einer Bregenzer Adresse.
    homeAddress: null,
    location: { use: false, shareMode: 'niemand', shareIds: [] },
  };
  state.people = [];
  state.crews = [];
  state.meets = [];
  state.messages = {};
  state.roomRead = {};
  state.drafts = {};
  state.savedIdeas = [];
  state.personPlaces = {};
  state.placeRequests = [];
  state.inviteDirectory = deepClone(seedInviteDirectory);
  return state;
}

export class DemoDataGateway extends CrewRepository {
  constructor(engine) {
    super();
    this.engine = engine;
    this.listeners = new Set();
    this.state = this.load();
  }

  load() {
    try {
      const suche = new URLSearchParams(window.location.search);
      // Auftrag §10: `?neu=1` setzt auf den Zustand eines Menschen, der die App gerade
      // zum ersten Mal öffnet — kein Name, keine Freunde, keine Crew, kein Meet. Genau
      // dieser Zustand ist der am schlechtesten gebaute (§3) und war bisher nur über
      // „Konto löschen" erreichbar, also genau einmal.
      if (suche.has('neu')) {
        window.localStorage.removeItem(STORAGE_KEY);
        const leer = buildLeerState();
        window.localStorage.setItem(STORAGE_KEY, JSON.stringify(leer));
        return this.migrate(leer);
      }
      // Runde 2 (Jonathan: „In der Demo soll man alles haben, was man beim ersten Mal sieht"):
      // Der versteckte Einstieg beginnt wie für jeden neuen Menschen — beim Einrichten. Die
      // Beispiel-Freunde kommen erst danach dazu (completeOnboarding).
      if (window.localStorage.getItem(DEMO_NEU_KEY)) {
        window.localStorage.removeItem(DEMO_NEU_KEY);
        const leer = buildLeerState();
        leer.beispieleNachEinrichten = true;
        window.localStorage.setItem(STORAGE_KEY, JSON.stringify(leer));
        return this.migrate(leer);
      }
      if (suche.has('reset')) {
        window.localStorage.removeItem(STORAGE_KEY);
      }
      const raw = window.localStorage.getItem(STORAGE_KEY);
      if (raw) return this.migrate(JSON.parse(raw));
    } catch { /* privater Modus o. Ä. — dann nur in-memory */ }
    return this.migrate(buildSeedState());
  }

  // Hebt einen älteren gespeicherten Zustand auf das v6-Modell. Läuft auch über den frischen
  // Seed, damit beide Wege garantiert dieselbe Form haben.
  migrate(state) {
    if (!state) return state;
    if (!Array.isArray(state.placeRequests)) state.placeRequests = [];
    if (!state.roomPolls || typeof state.roomPolls !== 'object') state.roomPolls = {};
    if (!state.messages) state.messages = {};
    if (!state.roomRead) state.roomRead = {};
    // Runde 2: Vorschläge sind Katalog, keine Nutzerdaten (eigene Ideen liegen in
    // settings.ownIdeas) — sie kommen immer frisch aus dem Seed. Sonst behielte ein alter
    // Speicherstand Uhrzeiten und übergenaue Titel.
    state.suggestions = deepClone(seedSuggestions);
    (state.meets || []).forEach((meet) => {
      // Ein Meet mehrerer Einzelpersonen ohne Gruppe ist ein gemeinsamer Raum — auch wenn es
      // aus dem Seed stammt und vor dieser Regel angelegt wurde.
      if (meet.crewId || meet.roomId) return;
      if ((meet.personIds || []).length <= 1) return;
      const roomId = roomIdForMeet(meet.id);
      meet.roomId = roomId;
      if (!state.messages[roomId]) state.messages[roomId] = [];
      if (state.roomRead[roomId] === undefined) state.roomRead[roomId] = 0;
    });
    return state;
  }

  persist() {
    try {
      window.localStorage.setItem(STORAGE_KEY, JSON.stringify(this.state));
    } catch { /* in-memory weiter */ }
  }

  notify() {
    this.persist();
    this.listeners.forEach((listener) => listener());
  }

  subscribe(listener) {
    this.listeners.add(listener);
    return () => this.listeners.delete(listener);
  }

  reset() {
    try { window.localStorage.removeItem(STORAGE_KEY); } catch { /* egal */ }
    this.state = buildSeedState();
    this.notify();
  }

  newId(prefix) {
    this.state.nextId += 1;
    return `${prefix}-${this.state.nextId}`;
  }

  // --- Identität & Einstellungen ---

  getMe() {
    const s = this.state.settings;
    // v3.1 §6: dieselbe Datenform wie getPerson(), damit projectProfile(getMe()) trägt.
    return {
      id: ME, name: s.name, initials: s.initials, color: s.color, photo: s.photo,
      isMe: true, free: s.free,
      interests: s.interests || [],
      interestLevels: s.interestLevels || {},
      resources: s.resources || [],
      resourceMeta: s.resourceMeta || {},
      resourceShares: s.resourceShares || {},
      showsActivity: true,
      sharesLocation: true,
      unread: 0,
    };
  }

  getSettings() {
    // Runde 3 (B2): Zeichen für unbekannte Interessen und Ressourcen nachlernen (Funktion `zeichen`).
    zeichenNachlernen(namenAusEinstellungen(this.state.settings), (body) => this.zeichenAnfragen(body), sprache(), () => this.notify());
    return this.state.settings;
  }

  // Runde 3 (B2): Wörter, die noch nicht in den Einstellungen stehen (Einrichten: gewählte, eigene
  // Interessen), gleich nachlernen — sonst trüge der Chip bis zum Ende des Einrichtens kein Zeichen.
  zeichenLernen(namen = []) {
    zeichenNachlernen(namen.map((n) => String(n || '').trim()).filter(Boolean), (body) => this.zeichenAnfragen(body), sprache(), () => this.notify());
  }

  // Als Gast, ohne Anmeldung — wie die Orte (vorschlaegeNachladen).
  async zeichenAnfragen(body) {
    if (typeof fetch !== 'function') return { error: new Error('kein Netz') };
    const { supabaseConfig } = await import('./gateway.js');
    const { url, key } = supabaseConfig();
    const antwort = await fetch(`${url}/functions/v1/zeichen`, {
      method: 'POST',
      headers: { apikey: key, 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    });
    if (!antwort.ok) return { error: new Error(`Status ${antwort.status}`) };
    return { data: await antwort.json() };
  }

  updateSettings(patch) {
    Object.assign(this.state.settings, patch);
    this.notify();
  }

  // Runde 2: Die Demo verschickt keine Mails — es gibt keine Sprache ins Konto zu melden.
  spracheMelden() {}

  completeOnboarding(profile) {
    Object.assign(this.state.settings, profile, { onboarded: true });
    // Runde 2: In der Demo kommen nach dem Einrichten Beispiel-Freunde, Crews und Meets
    // dazu — zuerst genau das, was jeder neue Mensch sieht, danach eine belebte App. Name,
    // Bild und Interessen bleiben die eben eingerichteten.
    if (this.state.beispieleNachEinrichten) {
      const seed = buildSeedState();
      for (const teil of ['people', 'crews', 'meets', 'messages', 'roomRead', 'folders', 'savedIdeas', 'personPlaces', 'placeRequests', 'inviteDirectory']) {
        this.state[teil] = seed[teil];
      }
      const s = this.state.settings;
      if (!(s.bestFriendIds || []).length) s.bestFriendIds = seed.settings.bestFriendIds;
      if (!s.specialPerson) s.specialPerson = seed.settings.specialPerson;
      s.friendRequests = seed.settings.friendRequests;
      this.state.beispieleNachEinrichten = false;
      this.migrate(this.state);
    }
    this.notify();
  }

  signOut() {
    this.state.settings.onboarded = false;
    this.notify();
  }

  // Im Demo-Modus gibt es kein Konto — und die Konto-Seite sagt das, statt eine
  // Anmeldeart zu erfinden (genau der Fehler, den §1.7 des Auftrags meint).
  getAccountInfo() {
    return { echt: false, email: '', methode: 'demo', methodeLabel: t('Demo'), kannPasswort: false };
  }

  async changeEmail() {
    return { ok: false, meldung: t('Im Demo-Modus gibt es kein Konto.') };
  }

  async changePassword() {
    return { ok: false, meldung: t('Im Demo-Modus gibt es kein Konto.') };
  }

  async sendPasswordReset() {
    return { ok: false, meldung: t('Im Demo-Modus gibt es kein Konto.') };
  }

  // --- Frei-Status ---

  getFreeState() {
    const free = this.state.settings.free;
    // Ein geplantes „Frei ab" wird zum gewählten Zeitpunkt von selbst wirksam.
    if (free?.pending && free.fromAt && Date.now() >= free.fromAt) {
      free.pending = false;
      free.from = null;
      free.setAt = null;
      free.fromAt = null;
      this.persist();
    }
    return free;
  }

  // v3.1 §4: Frei ab statt Frei bis. Ohne Offset gilt Frei sofort; mit Offset wird der
  // Start in der Zukunft gemerkt (fromMinutes = Minuten ab jetzt, from = HH:MM absolut).
  // v5 A05: Bevorzugt wird der ABSOLUTE Zielzeitpunkt `at`. Damit ist der gespeicherte
  // Zustand identisch mit der Uhrzeit, die der Nutzer beim Loslassen gesehen hat.
  // `fromMinutes` bleibt als Bequemlichkeit für Tests und Altaufrufer erhalten.
  setFree(options = {}) {
    const at = Number(options.at) || 0;
    const offset = Math.max(0, Number(options.fromMinutes) || 0);
    const fromAt = at > Date.now() ? at : (offset > 0 ? Date.now() + offset * 60000 : 0);
    // Runde 5 (G3b): Die Lust bleibt, solange niemand sie ausdrücklich ändert.
    const lust = options.lust !== undefined ? this.lustPruefen(options.lust) : (this.state.settings.free?.lust ?? null);
    this.state.settings.free = fromAt
      ? { active: true, pending: true, from: options.from || null, setAt: Date.now(), fromAt, lust }
      : { active: true, pending: false, from: null, setAt: null, fromAt: null, lust };
    this.notify();
  }

  clearFree() {
    this.state.settings.free = { active: false, pending: false, from: null, setAt: null, fromAt: null, lust: null };
    this.notify();
  }

  // Runde 5 (G3b): nur die Lust ändern — der Frei-Zustand selbst bleibt, wie er ist.
  setFreeLust(lust) {
    const free = this.state.settings.free || { active: false };
    this.state.settings.free = { ...free, lust: this.lustPruefen(lust) };
    this.notify();
  }

  // Runde 5 (G3b): „Lust" beim Frei-Sein. Erlaubt sind nur diese Wörter — alles andere wird null.
  lustPruefen(lust) {
    return ['kaffee', 'sport', 'draussen', 'essen', 'chillen'].includes(lust) ? lust : null;
  }

  // --- Personen & Freundschaft ---

  personWithDerived(person) {
    const activeMeet = this.state.meets.find(
      (meet) => meet.status === 'active' && meet.participation[person.id] === 'yes',
    );
    // Runde 4 (D7): In der Demo steht fuer Personen, die ihren Standort teilen, ein ungefaehrer
    // Beispiel-Standort (seedStandorte) — nie die Wohnadresse aus personPlaces. Im Server-Modus
    // kommt er aus der Tabelle standorte.
    const lage = seedStandorte[person.id];
    const standort = person.sharesLocation && hatLage(lage) ? { lat: lage.lat, lon: lage.lon, at: 0 } : null;
    return { ...person, standort, activeMeetId: person.showsActivity && activeMeet ? activeMeet.id : null };
  }

  getPeople() {
    // person.friend === false heißt: bleibt für Meets und Bewertungen auflösbar, taucht aber
    // in keiner Freundesliste mehr auf. Blockierte verschwinden zusätzlich überall (T6).
    return this.state.people
      .filter((person) => person.friend !== false && !this.isBlocked(person.id))
      .map((person) => this.personWithDerived(person));
  }

  getPerson(id) {
    if (id === ME) return this.getMe();
    const person = this.state.people.find((entry) => entry.id === id);
    return person ? this.personWithDerived(person) : null;
  }

  // v3.1 §6: Beste Freunde und Besondere Person schließen einander aus. Die Zahl wird
  // aus eindeutigen IDs berechnet, nie aus sichtbaren Zeilen.
  setBestFriend(personId, on) {
    const list = this.state.settings.bestFriendIds;
    if (on) {
      const unique = [...new Set(list)];
      if (unique.includes(personId)) return { ok: true };
      if (unique.length >= 3) return { ok: false, reason: t('Maximal drei beste Freunde') };
      if (this.state.settings.specialPerson?.personId === personId) {
        this.state.settings.specialPerson = null; // Exklusivität
      }
      this.state.settings.bestFriendIds = [...unique, personId];
      this.notify();
      return { ok: true };
    }
    if (true) {
      this.state.settings.bestFriendIds = list.filter((id) => id !== personId);
    }
    this.notify();
    return { ok: true };
  }

  setSpecialPerson(personId, marker) {
    if (marker) {
      // Exklusiv: wer besondere Person wird, ist nicht mehr bester Freund.
      this.state.settings.bestFriendIds = [...new Set(this.state.settings.bestFriendIds)]
        .filter((id) => id !== personId);
      this.state.settings.specialPerson = {
        personId,
        label: marker.label || '',
        symbol: marker.symbol || 'raute',
        emoji: marker.emoji || '',
        color: marker.color || '#7E6BA8',
      };
    } else {
      this.state.settings.specialPerson = null;
    }
    this.notify();
    return { ok: true };
  }

  // --- v3.1 §6: Projektion nach Freigaben ------------------------------------------
  // Alle Ansichten (Profil, Freundesprofil, Crew-Details, Raum) lesen aus derselben
  // Quelle. Interessen sind nach echter Punktebewertung sortiert, Ressourcen nach
  // Verfügbarkeit; nichts wird statisch kopiert oder als Häufigkeit erfunden.
  // v4 P0-4-Res-Sortierung: DOKUMENTIERTE, stabile Reihenfolge — erst nach Verfügbarkeit
  // (immer = Rang 0 vor manchmal = Rang 1), bei gleichem Rang nach dem Namen (deutsche
  // Sortierung). Die Regel selbst steht in projections.js, weil der SupabaseGateway
  // dieselbe braucht.
  projectProfile(person, viewerContext = {}) {
    return projectProfile(person, viewerContext, (crewId) => this.crewMemberIds(crewId));
  }

  crewMemberIds(crewId) {
    return this.state.crews.find((entry) => entry.id === crewId)?.memberIds || [];
  }

  // v4 P0-4-Datenquelle-tot: Es gibt GENAU EINE Regel, wer eine Ressource sieht — die
  // Freigabe an der Ressource selbst. Der frühere Globalregler
  // settings.visibility.resources wurde von keiner Leseseite ausgewertet und ist
  // ersatzlos entfallen (siehe seed/profile.js); er war eine zweite Bedienstelle für
  // dieselbe Entscheidung. `resourceShares` deckt jeden seiner Zustände ab.
  //
  // Freigabe-Regel: ohne Eintrag ist eine Ressource für Freunde sichtbar;
  // 'privat' verbirgt sie, eine Crew-Liste beschränkt sie auf diese Crews.
  // v5 A30d: { personen:[personId…] } — Freigabe an ausgewaehlte Freund:innen. Die Regel
  // steht in projections.js und gilt für beide Gateways.
  isSharedWith(share, viewerContext = {}) {
    return isSharedWith(share, viewerContext, (crewId) => this.crewMemberIds(crewId));
  }

  removeFriend(personId) {
    const person = this.state.people.find((entry) => entry.id === personId);
    if (person) person.friend = false;
    this.state.settings.bestFriendIds = this.state.settings.bestFriendIds.filter((id) => id !== personId);
    if (this.state.settings.specialPerson?.personId === personId) this.state.settings.specialPerson = null;
    const hinweise = this.state.settings.freiHints;
    if (hinweise?.customIds) hinweise.customIds = hinweise.customIds.filter((id) => id !== personId);
    // Gruppen bleiben unangetastet: eine private Entscheidung darf niemanden aus einer
    // Runde werfen, in der andere Leute weiter mit ihr rechnen.
    this.notify();
  }

  getFriendRequests() {
    return this.state.settings.friendRequests;
  }

  acceptFriendRequest(requestId) {
    const request = this.state.settings.friendRequests.find((entry) => entry.id === requestId);
    if (!request) return;
    this.state.settings.friendRequests = this.state.settings.friendRequests.filter((entry) => entry.id !== requestId);
    this.state.people.push({
      id: this.newId('p'), name: request.name, initials: request.initials, color: request.color,
      // v4 QR-2: Bringt die Anfrage einen Code mit, wandert er in die Freundschaft — sonst
      // meldete derselbe Code hinterher „ungültig" statt „schon befreundet".
      inviteCode: request.code || null,
      status: '', unread: 0, free: { active: false }, sharesLocation: false, showsActivity: false,
      interests: [], resources: [],
    });
    this.notify();
  }

  declineFriendRequest(requestId) {
    this.state.settings.friendRequests = this.state.settings.friendRequests.filter((entry) => entry.id !== requestId);
    this.notify();
  }

  getInviteCode() {
    return this.state.settings.inviteCode;
  }

  // v4 QR-2 --------------------------------------------------------------------------
  // Ein Einladungscode hat die Form VIER-4821: 3–8 Großbuchstaben, Bindestrich, vier
  // Ziffern. Eingaben werden zuerst auf diese Form gebracht (Leerzeichen weg, groß,
  // fehlender Bindestrich ergänzt), damit „nina 5027" und „nina5027" denselben Code
  // meinen wie „NINA-5027".
  normalizeInviteCode(code) {
    return normalizeInviteCode(code);
  }

  isInviteCodeFormat(code) {
    return isInviteCodeFormat(code);
  }

  // Eine Quelle für alle Zustände: eigener Code, Codes bestehender Freunde
  // (seedPeople[].inviteCode) und Codes noch unbekannter Personen (seedInviteDirectory).
  lookupInviteCode(code) {
    const normalized = this.normalizeInviteCode(code);
    if (normalized === this.normalizeInviteCode(this.state.settings.inviteCode)) return { kind: 'self' };
    const friend = (this.state.people || [])
      .find((person) => person.inviteCode && this.normalizeInviteCode(person.inviteCode) === normalized);
    if (friend) return { kind: 'friend', person: friend };
    const stranger = (this.state.inviteDirectory || [])
      .find((entry) => this.normalizeInviteCode(entry.code) === normalized);
    if (stranger) return { kind: 'stranger', person: stranger };
    return { kind: 'unknown' };
  }

  // Demo: eingelöster Code legt eine ausgehende Anfrage an (echte Zustellung kommt in M3).
  // Rückgabe IMMER { ok, status, reason } — die drei verlangten Zustände sind
  // status 'sent' (ERFOLG), 'already' (BEREITS BEFREUNDET) und 'invalid' (UNGÜLTIG);
  // dazu die ehrlichen Sonderfälle 'empty', 'self' und 'pending', die früher alle
  // stillschweigend als Erfolg durchgingen. `reason` ist der fertige Toast-Text.
  redeemInviteCode(code) {
    const raw = String(code ?? '').trim();
    if (!raw) return { ok: false, status: 'empty', reason: t('Code eingeben') };

    const normalized = this.normalizeInviteCode(raw);
    if (!this.isInviteCodeFormat(normalized)) {
      return { ok: false, status: 'invalid', code: normalized, reason: t('Code ungültig') };
    }

    const found = this.lookupInviteCode(normalized);
    const firstName = (found.person?.name || '').split(' ')[0];

    if (found.kind === 'self') {
      return { ok: false, status: 'self', code: normalized, reason: t('Das ist dein eigener Code') };
    }
    if (found.kind === 'friend') {
      return {
        ok: false, status: 'already', code: normalized, personId: found.person.id,
        reason: firstName ? t('{name} ist schon dein Freund', { name: firstName }) : t('Ihr seid schon befreundet'),
      };
    }
    // Eine bereits laufende Anfrage wiegt schwerer als „unbekannt": derselbe Code darf
    // nie zweimal rausgehen, auch wenn die Person nur noch in den gesendeten Anfragen steht.
    const outgoing = this.state.settings.outgoingRequests || [];
    const pending = outgoing.find((entry) => entry.code && this.normalizeInviteCode(entry.code) === normalized);
    if (pending) {
      const pendingName = firstName || (pending.name || '').split(' ')[0];
      return {
        ok: false, status: 'pending', code: normalized,
        reason: pendingName ? t('Anfrage an {name} läuft schon', { name: pendingName }) : t('Anfrage läuft schon'),
      };
    }

    if (found.kind === 'unknown') {
      return { ok: false, status: 'invalid', code: normalized, reason: t('Code ungültig') };
    }

    const person = found.person;
    this.state.settings.outgoingRequests = [...outgoing, {
      id: this.newId('out'),
      code: normalized,
      name: person.name,
      initials: person.initials,
      color: person.color,
      meta: person.meta || t('Kurzcode · gerade eben'),
      sentAt: Date.now(),
    }];
    this.notify();
    return {
      ok: true, status: 'sent', code: normalized, name: person.name,
      reason: firstName ? t('Anfrage an {name} gesendet', { name: firstName }) : t('Anfrage gesendet'),
    };
  }

  // Runde 3 (Jonathan): Nach „Konto löschen" stand man im Einrichten statt in der Anmeldung.
  // In der Demo gibt es kein Konto — „löschen" beendet die Demo: Bestand weg, zurück in den
  // Modus, den die App vorgibt (veröffentlicht: Anmeldemaske), und neu laden. Dynamischer
  // Import, weil gateway.js diese Datei selbst lädt.
  deleteAccount() {
    try { window.localStorage.removeItem(STORAGE_KEY); } catch { /* egal */ }
    const ziel = globalThis.CREW_CONFIG?.gateway === 'supabase' ? 'supabase' : 'demo';
    import('./gateway.js').then(({ setGatewayMode }) => {
      setGatewayMode(ziel);
      const ort = globalThis.location;
      if (ort?.replace) ort.replace(ort.pathname);
    });
  }

  // --- Melden & Blockieren (T6) --------------------------------------------------------
  // Im Demo-Modus gibt es keinen Server, an den eine Meldung ginge — sie wird trotzdem
  // festgehalten, damit der Weg vollständig und prüfbar ist und sich im Server-Modus
  // exakt gleich verhält.
  blockedIds() {
    if (!Array.isArray(this.state.blocked)) this.state.blocked = [];
    return this.state.blocked;
  }

  isBlocked(personId) {
    return this.blockedIds().includes(personId);
  }

  blockPerson(personId, options = {}) {
    if (!personId || personId === ME) return { ok: false, reason: t('Das bist du selbst') };
    if (!this.isBlocked(personId)) this.state.blocked = [...this.blockedIds(), personId];
    // Blockieren beendet die Freundschaft — sonst bliebe eine halbe Verbindung stehen.
    const person = this.state.people.find((entry) => entry.id === personId);
    if (person) person.friend = false;
    this.state.settings.bestFriendIds = (this.state.settings.bestFriendIds || []).filter((id) => id !== personId);
    if (this.state.settings.specialPerson?.personId === personId) this.state.settings.specialPerson = null;
    if (options.grund) this.reportContent({ personId, grund: options.grund, notiz: options.notiz });
    this.notify();
    return { ok: true };
  }

  unblockPerson(personId) {
    this.state.blocked = this.blockedIds().filter((id) => id !== personId);
    this.notify();
    return { ok: true };
  }

  getBlockedPeople() {
    return this.blockedIds()
      .map((id) => this.state.people.find((entry) => entry.id === id))
      .filter(Boolean)
      .map((person) => ({ id: person.id, name: person.name, initials: person.initials, color: person.color, photo: person.photo }));
  }

  reportContent(input = {}) {
    if (!input.grund) return { ok: false, reason: t('Grund fehlt') };
    if (!Array.isArray(this.state.reports)) this.state.reports = [];
    this.state.reports.push({
      id: this.newId('rep'),
      personId: input.personId || null,
      messageId: input.messageId || null,
      meetId: input.meetId || null,
      grund: input.grund,
      notiz: input.notiz || '',
      at: new Date().toISOString(),
    });
    this.persist();
    return { ok: true };
  }

  // --- Crews & Räume ---

  crewWithDerived(crew) {
    // Wer blockiert ist, steht auch in keiner Gruppenliste dieses Nutzers mehr.
    if (this.blockedIds().length) crew = { ...crew, memberIds: crew.memberIds.filter((id) => !this.isBlocked(id)) };
    const activeMeet = this.state.meets.find((meet) => meet.status === 'active' && meet.crewId === crew.id);
    const freeCount = crew.memberIds.filter((id) => {
      if (id === ME) return this.state.settings.free.active;
      const person = this.state.people.find((entry) => entry.id === id);
      return person?.free?.active;
    }).length;
    return { ...crew, activeMeetId: activeMeet?.id || null, freeCount };
  }

  getCrews() {
    // Meine Gruppenliste sind die Gruppen, in denen ich Mitglied bin. Nach einem Austritt
    // verschwindet die Gruppe damit dort, wo sie stand — Chat, Meets und Kopfzeile inklusive.
    return this.state.crews
      .filter((crew) => (crew.memberIds || []).includes(ME))
      .map((crew) => this.crewWithDerived(crew));
  }

  getCrew(id) {
    const crew = this.state.crews.find((entry) => entry.id === id);
    return crew ? this.crewWithDerived(crew) : null;
  }

  createCrew(input) {
    const crew = {
      id: this.newId('c'),
      name: input.name,
      color: input.color || null,
      // v7 spec/08 §2: Das beim Anlegen gewaehlte Gruppenbild gehoert in den Datensatz.
      // Vorher fiel es hier still weg — der Picker funktionierte, das Ergebnis verschwand.
      groupImage: input.groupImage || null,
      memberIds: [ME, ...(input.memberIds || []).filter((id) => id !== ME)],
      unread: 0,
      // v6 A12: Wer eine Gruppe anlegt, ist ihr Admin. Ohne diese Rolle liesse sich der
      // Adminfall beim Verlassen gar nicht abbilden.
      creatorId: ME,
      adminIds: [ME],
    };
    this.state.crews.push(crew);
    this.state.messages[roomIdForCrew(crew.id)] = [];
    this.notify();
    return this.crewWithDerived(crew);
  }

  // v7 spec/08 §2: groupImage gehoert zum kanonischen Gruppendatensatz und muss durch
  // denselben Schreibweg gehen wie Name und Farbe. Vorher fiel ein Bild-Patch still weg.
  updateCrew(crewId, patch) {
    const crew = this.state.crews.find((entry) => entry.id === crewId);
    if (!crew) return { ok: false, reason: t('Crew nicht gefunden') };
    if (patch.name != null) crew.name = patch.name;
    if (patch.color != null) crew.color = patch.color;
    // null loescht das Bild ausdruecklich, undefined laesst es unangetastet.
    if (patch.groupImage !== undefined) crew.groupImage = patch.groupImage;
    this.notify();
    return { ok: true };
  }

  // Runde 5 (C1, Jonathan: „Man muss personen zu gruppen hinzufügen können."): nur Admins, nur Freunde.
  addCrewMembers(crewId, personIds = []) {
    const crew = this.state.crews.find((entry) => entry.id === crewId);
    if (!crew) return { ok: false, added: [], reason: 'keineCrew' };
    const admins = crew.adminIds?.length ? crew.adminIds : (crew.creatorId ? [crew.creatorId] : []);
    if (!admins.includes(ME)) return { ok: false, added: [], reason: 'keinAdmin' };
    const freunde = new Set(this.state.people.filter((p) => p.friend !== false && !this.isBlocked(p.id)).map((p) => p.id));
    const neu = [...new Set(personIds)].filter((id) => id !== ME && !crew.memberIds.includes(id));
    if (neu.some((id) => !freunde.has(id))) return { ok: false, added: [], reason: 'keinFreund' };
    if (!neu.length) return { ok: true, added: [] };
    crew.memberIds.push(...neu);
    this.notify();
    return { ok: true, added: neu };
  }

  roomFromId(roomId) {
    const refId = roomId.slice(2);
    // v6 A13: dritte Raumart. Die Referenz-ID verrät die Art: c… Crew, m… temporärer
    // Meet-Raum, sonst 1:1. Ein Meet-Raum hat genau die Teilnehmerliste seines Meets.
    const kind = refId.startsWith('c') ? 'crew' : (refId.startsWith('m') ? 'meet' : 'person');
    // v14: Raum-Nachrichten löschen sich nach 14 Tagen; Meet-Daten bleiben.
    const cutoff = toISODate(new Date(Date.now() - 14 * 86400000));
    const all = (this.state.messages[roomId] || []).filter((message) => !this.isBlocked(message.authorId));
    const messages = all.filter((message) => !message.date || message.date >= cutoff);
    const expired = all.length - messages.length;
    return {
      id: roomId,
      kind,
      refId,
      messages,
      lastReadCount: Math.max(0, (this.state.roomRead[roomId] || 0) - expired),
    };
  }

  getRoom(roomId) {
    return this.roomFromId(roomId);
  }

  getRoomForCrew(crewId) {
    return this.roomFromId(roomIdForCrew(crewId));
  }

  getRoomForPerson(personId) {
    return this.roomFromId(roomIdForPerson(personId));
  }

  appendMessage(roomId, message) {
    if (!this.state.messages[roomId]) this.state.messages[roomId] = [];
    this.state.messages[roomId].push(message);
  }

  sendMessage(roomId, text) {
    const trimmed = (text || '').trim();
    if (!trimmed) return;
    this.appendMessage(roomId, {
      id: this.newId('msg'), authorId: ME, kind: 'text', text: trimmed,
      date: toISODate(now()), time: `${now().getHours()}:${String(now().getMinutes()).padStart(2, '0')}`,
    });
    this.state.roomRead[roomId] = (this.state.messages[roomId] || []).length;
    this.notify();
  }

  markRoomRead(roomId) {
    this.state.roomRead[roomId] = (this.state.messages[roomId] || []).length;
    const refId = roomId.slice(2);
    const crew = this.state.crews.find((entry) => entry.id === refId);
    if (crew) crew.unread = 0;
    const person = this.state.people.find((entry) => entry.id === refId);
    if (person) person.unread = 0;
    this.persist();
    // bewusst kein notify: Lesen soll den aktuellen Screen nicht neu rendern
  }

  // v3.1 §5: leichter Impuls mit Spam-Schutz — kein Abbrechen-Ablauf, keine Dauerkarte.
  canNudge(roomId) {
    // Fable 3 (nudge-10): Der eigene Raum ist kein Ziel — sich selbst anstupsen gibt es nicht.
    if (roomId === `r:${ME}`) return { ok: false, remainingMs: 0, self: true };
    const last = this.state.nudgeCooldowns?.[roomId] || 0;
    const remaining = Math.max(0, 5 * 60000 - (Date.now() - last));
    return { ok: remaining === 0, remainingMs: remaining };
  }

  // v7 spec/08 §4: Anstupsen und Standort sind eigene chronologische EREIGNISSE in
  // derselben Timeline wie Nachrichten — keine eingefuegten Textstrings. Sie brauchen
  // deshalb einen eigenen Schreibweg im Vertrag statt eines Zugriffs am Vertrag vorbei.
  addRoomEvent(roomId, eintrag) {
    if (!roomId || !eintrag || !eintrag.kind) return null;
    const jetzt = now();
    const datensatz = {
      id: this.newId('ev'),
      authorId: eintrag.authorId || ME,
      kind: eintrag.kind,
      date: eintrag.date || toISODate(jetzt),
      time: eintrag.time || `${jetzt.getHours()}:${String(jetzt.getMinutes()).padStart(2, '0')}`,
      ...eintrag,
    };
    this.appendMessage(roomId, datensatz);
    this.notify();
    return datensatz;
  }

  nudge(roomId) {
    const gate = this.canNudge(roomId);
    if (!gate.ok) {
      const sek = Math.ceil(gate.remainingMs / 1000);
      return { ok: false, reason: gate.self ? t('Das bist du selbst') : t('Wieder möglich in {zeit}', { zeit: `${Math.floor(sek / 60)}:${String(sek % 60).padStart(2, '0')}` }) };
    }
    if (!this.state.nudgeCooldowns) this.state.nudgeCooldowns = {};
    this.state.nudgeCooldowns[roomId] = Date.now();
    this.state.nudgeSentAt = { ...(this.state.nudgeSentAt || {}), [roomId]: Date.now() };
    if (this.state.nudgeZurueck) delete this.state.nudgeZurueck[roomId];
    // v7 spec/08 §4: Der Impuls hinterlaesst jetzt einen STRUKTURIERTEN Eintrag in der
    // Timeline — weiterhin ausdruecklich KEINE Chat-Textnachricht im Namen der Person.
    // Die frueher hier notierte Regel („kein automatischer Chattext") bleibt damit
    // vollstaendig erhalten; sichtbar ist eine echte Funktion im Verlauf.
    const ereignis = this.addRoomEvent(roomId, { kind: 'nudge', authorId: ME });
    return { ok: true, eventId: ereignis?.id || null };
  }

  // Runde 4 (Jonathan: „Ich stupse jemand an und wähle es wieder ab, kann aber dennoch nur in fünf
  // Minuten erneut anstupsen."): Der Eintrag verschwindet aus dem Verlauf, die Sperre bleibt.
  nudgeZuruecknehmen(roomId) {
    const liste = this.state.messages[roomId] || [];
    let stelle = -1;
    for (let i = liste.length - 1; i >= 0; i -= 1) {
      const e = liste[i];
      if (e.kind === 'nudge' && e.authorId === ME && !e.zurueck) { stelle = i; break; }
    }
    const sperreBis = (this.state.nudgeCooldowns?.[roomId] || 0) + 5 * 60000;
    if (stelle < 0) return { ok: false, sperreBis };
    liste.splice(stelle, 1);
    this.state.nudgeZurueck = { ...(this.state.nudgeZurueck || {}), [roomId]: true };
    this.notify();
    return { ok: true, sperreBis };
  }

  nudgeZurueckgenommen(roomId) {
    return Boolean(this.state.nudgeZurueck?.[roomId]);
  }

  // Runde 4 (Jonathan: „Ich muss meine eigenen Nachrichten auch löschen können."): nur eigene.
  deleteMessage(roomId, messageId) {
    const liste = this.state.messages[roomId] || [];
    const stelle = liste.findIndex((e) => e.id === messageId);
    if (stelle < 0 || liste[stelle].authorId !== ME) return { ok: false };
    liste.splice(stelle, 1);
    if (typeof this.state.roomRead?.[roomId] === 'number') this.state.roomRead[roomId] = Math.min(this.state.roomRead[roomId], liste.length);
    this.notify();
    return { ok: true };
  }

  // Fable 3: Zeitpunkt des letzten eigenen Anstupsers (für „Angestupst · vor 3 min").
  nudgeSentAt(roomId) {
    return this.state.nudgeSentAt?.[roomId] || 0;
  }

  // Wurde in diesem Raum gerade ein Impuls gesendet? (nur für die kurze Rückmeldung)
  nudgeSentRecently(roomId, withinMs = 60000) {
    const at = this.state.nudgeSentAt?.[roomId] || 0;
    return Date.now() - at < withinMs;
  }

  respondNudge(roomId, messageId, response) {
    const message = (this.state.messages[roomId] || []).find((entry) => entry.id === messageId);
    if (message) message.response = response;
    if (response === 'zurueck') {
      // Fable 3 (Entscheidung Jonathan): Zurückstupsen ist die billigste Antwort und schließt die
      // Schleife. Es geht auch im Cooldown (es ist eine Antwort, kein neuer Vorstoß) und setzt
      // danach denselben Cooldown wie ein eigener Anstupser.
      if (!this.state.nudgeCooldowns) this.state.nudgeCooldowns = {};
      this.state.nudgeCooldowns[roomId] = Date.now();
      this.state.nudgeSentAt = { ...(this.state.nudgeSentAt || {}), [roomId]: Date.now() };
      this.addRoomEvent(roomId, { kind: 'nudge', authorId: ME, zurueck: true });
      return;
    }
    if (response === 'frei') {
      this.setFree({}); // eine Quelle für Frei — kein direktes Schreiben am Zustand vorbei
      return;
    }
    this.notify();
  }

  // --- Meets ---

  // v6 A13: Der temporäre Meet-Raum zeigt genau SEIN Meet — Karte, Teilnahme, Varianten,
  // Listen und Umfragen lesen damit denselben Datenkontext. Regel in projections.js.
  matchesContext(meet, context = {}) {
    return meetMatchesContext(meet, context, ME);
  }

  getMeets(query = {}) {
    const { context = {}, direction = 'upcoming', date } = query;
    // Ein LAUFENDER Loop hat seine eigene Reihe (getLoops). Ein GESTOPPTER Loop
    // (loop.active === false) ist wieder ein gewöhnliches Meet — vorher fiel er aus
    // beiden Listen und war damit unsichtbar.
    const passend = this.state.meets.filter((meet) => meet.status !== 'draft' && !meet.loop?.active && this.matchesContext(meet, context));
    return sortAndFilterMeets(passend, direction, date);
  }

  getLoops(query = {}) {
    const { context = {} } = query;
    return this.state.meets.filter((meet) => meet.loop?.active && this.matchesContext(meet, context));
  }

  getMeet(id) {
    return this.state.meets.find((meet) => meet.id === id) || null;
  }

  setParticipation(meetId, state) {
    const meet = this.getMeet(meetId);
    if (!meet) return;
    meet.participation[ME] = state;
    // Runde 5 (E1): Wer absagt, fällt aus den Mitfahrten; als Fahrer gibt er Mitfahrer frei (Server: 0032).
    if (state === 'no') this.rideRolleLokal(meetId, null);
    this.notify();
  }

  setLoopResponse(meetId, dateISO, response) {
    const meet = this.getMeet(meetId);
    if (!meet?.loop) return;
    if (!meet.loop.responses[dateISO]) meet.loop.responses[dateISO] = {};
    // Gleiche Antwort erneut = zurücknehmen.
    if (meet.loop.responses[dateISO][ME] === response) delete meet.loop.responses[dateISO][ME];
    else meet.loop.responses[dateISO][ME] = response;
    this.notify();
  }

  // --- Varianten ---

  addVariant(meetId, variant) {
    const meet = this.getMeet(meetId);
    if (!meet) return { ok: false, reason: t('Meet nicht gefunden') };
    const cooldownUntil = this.state.variantCooldowns[meetId] || 0;
    if (Date.now() < cooldownUntil) return { ok: false, reason: t('Kurz warten, dann erneut vorschlagen') };

    // Gleiche Vorschläge zusammenführen.
    const same = meet.variants.find((entry) => {
      if (entry.kind !== variant.kind) return false;
      if (variant.kind === 'time') return entry.date === variant.date && entry.time === variant.time;
      return (entry.title || '').toLowerCase() === (variant.title || '').toLowerCase();
    });
    if (same) {
      if (!same.votes.includes(ME)) same.votes.push(ME);
      this.notify();
      return { ok: true, merged: true, variantId: same.id };
    }

    // Eine Person bearbeitet ihren bestehenden Vorschlag statt einen zweiten anzulegen.
    const own = meet.variants.find((entry) => entry.kind === variant.kind && entry.authorId === ME);
    if (own) {
      Object.assign(own, variant, { id: own.id, authorId: ME });
      this.notify();
      return { ok: true, edited: true, variantId: own.id };
    }

    const created = { id: this.newId('v'), authorId: ME, votes: [ME], ...variant };
    meet.variants.push(created);
    this.state.variantCooldowns[meetId] = Date.now() + VARIANT_COOLDOWN_MS;
    this.notify();
    return { ok: true, variantId: created.id };
  }

  editVariant(meetId, variantId, patch) {
    const meet = this.getMeet(meetId);
    const variant = meet?.variants.find((entry) => entry.id === variantId);
    if (!variant || variant.authorId !== ME) return { ok: false, reason: t('Nur eigene Vorschläge') };
    Object.assign(variant, patch);
    this.notify();
    return { ok: true };
  }

  removeVariant(meetId, variantId) {
    const meet = this.getMeet(meetId);
    if (!meet) return;
    const variant = meet.variants.find((entry) => entry.id === variantId);
    if (!variant || variant.authorId !== ME) return;
    meet.variants = meet.variants.filter((entry) => entry.id !== variantId);
    this.notify();
  }

  voteVariant(meetId, variantId) {
    const meet = this.getMeet(meetId);
    const variant = meet?.variants.find((entry) => entry.id === variantId);
    if (!variant) return;
    if (variant.votes.includes(ME)) {
      variant.votes = variant.votes.filter((id) => id !== ME);
    } else {
      // Eine Stimme pro Art (Zeit/Aktivität).
      meet.variants
        .filter((entry) => entry.kind === variant.kind)
        .forEach((entry) => { entry.votes = entry.votes.filter((id) => id !== ME); });
      variant.votes.push(ME);
    }
    this.notify();
  }

  // --- Lebenszyklus ---

  // v14 05.6c/05.6d: Nur der Ersteller legt eine Variante fest. Die gewählte Variante wird
  // ins Meet übernommen, alle Varianten derselben Art verschwinden, das Meet gilt als entschieden.
  decideMeet(meetId, options = {}) {
    const meet = this.getMeet(meetId);
    if (!meet) return { ok: false, reason: t('Meet nicht gefunden') };
    if (meet.creatorId !== ME) return { ok: false, reason: t('Nur der Organisator kann festlegen') };

    const { variantId } = options;
    const kind = options.kind || meet.variants.find((entry) => entry.id === variantId)?.kind;
    if (!kind) return { ok: false, reason: t('Keine Variante gewählt') };

    // Ohne variantId gewinnt die Variante mit den meisten Stimmen (Original = keine Änderung).
    const candidates = meet.variants.filter((entry) => entry.kind === kind);
    const chosen = variantId
      ? candidates.find((entry) => entry.id === variantId)
      : candidates.slice().sort((a, b) => b.votes.length - a.votes.length)[0];

    if (chosen) {
      if (kind === 'time') {
        if (chosen.date) meet.date = chosen.date;
        // Offene Zeit wird leer gespeichert (Sprachen) — die Anzeige sagt „Zeit offen".
        meet.time = chosen.open ? '' : (chosen.time || meet.time);
        meet.openTime = Boolean(chosen.open);
        // Runde 4 (F2): ein gewaehlter Zeitvorschlag "Jetzt" bleibt "Jetzt".
        meet.nowTime = Boolean(chosen.now);
      } else {
        if (chosen.title) meet.title = chosen.title;
        if (chosen.icon) meet.icon = chosen.icon;
        if (chosen.place) meet.place = chosen.place;
      }
    }
    meet.variants = meet.variants.filter((entry) => entry.kind !== kind);
    if (!meet.variants.length && meet.status === 'open') meet.status = 'decided';
    this.notify();
    return { ok: true, decided: chosen?.id || 'original' };
  }

  cancelMeet(meetId) {
    const meet = this.getMeet(meetId);
    if (!meet || meet.creatorId !== ME) return { ok: false, reason: t('Nur der Organisator kann absagen') };
    meet.status = 'done';
    meet.cancelled = true;
    this.notify();
    return { ok: true };
  }

  deleteDraftMeet(meetId) {
    const meet = this.getMeet(meetId);
    if (!meet || meet.status !== 'draft') return { ok: false, reason: t('Nur leere Entwürfe') };
    this.state.meets = this.state.meets.filter((entry) => entry.id !== meetId);
    this.notify();
    return { ok: true };
  }

  hideFromHistory(meetId) {
    const meet = this.getMeet(meetId);
    if (!meet) return;
    meet.hiddenFromHistory = true;
    this.notify();
  }

  // --- Mitbringen & Umfragen ---

  toggleBring(meetId, itemId) {
    const meet = this.getMeet(meetId);
    const item = meet?.bring.find((entry) => entry.id === itemId);
    if (!item) return;
    item.takenBy = item.takenBy.includes(ME) ? item.takenBy.filter((id) => id !== ME) : [...item.takenBy, ME];
    this.notify();
  }

  addBringItem(meetId, label) {
    const meet = this.getMeet(meetId);
    if (!meet || !(label || '').trim()) return;
    meet.bring.push({ id: this.newId('b'), label: label.trim(), takenBy: [] });
    this.notify();
  }

  // Runde 3 (K3, P6): Rückgängig für einen eben angelegten Mitbringen-Punkt.
  removeBringItem(meetId, itemId) {
    const meet = this.getMeet(meetId);
    const vorher = meet?.bring?.length || 0;
    if (!meet || !vorher) return { ok: false };
    meet.bring = meet.bring.filter((entry) => entry.id !== itemId);
    if (meet.bring.length === vorher) return { ok: false };
    this.notify();
    return { ok: true };
  }

  votePoll(meetId, pollId, optionId) {
    const meet = this.getMeet(meetId);
    const poll = meet?.polls.find((entry) => entry.id === pollId);
    if (!poll) return;
    poll.options.forEach((option) => {
      option.votes = option.votes.filter((id) => id !== ME);
      if (option.id === optionId) option.votes.push(ME);
    });
    this.notify();
  }

  addPoll(meetId, pollInput) {
    const meet = this.getMeet(meetId);
    if (!meet) return;
    meet.polls.push({
      id: this.newId('poll'),
      question: pollInput.question,
      options: pollInput.options.map((label) => ({ id: this.newId('po'), label, votes: [] })),
    });
    this.notify();
  }

  // A09b: „Ohne Meet" ist eine bewusste Wahl im Umfrage-Sheet. Eine solche Umfrage gehört
  // dem Raum statt einem Meet — ohne eigenen Speicher wäre sie nur ein Text im Chat und
  // niemand könnte abstimmen.
  getRoomPolls(roomId) {
    if (!this.state.roomPolls) this.state.roomPolls = {};
    return this.state.roomPolls[roomId] || [];
  }

  addRoomPoll(roomId, pollInput) {
    if (!roomId) return null;
    if (!this.state.roomPolls) this.state.roomPolls = {};
    if (!this.state.roomPolls[roomId]) this.state.roomPolls[roomId] = [];
    const poll = {
      id: this.newId('rpoll'),
      question: pollInput.question,
      options: (pollInput.options || []).map((label) => ({ id: this.newId('po'), label, votes: [] })),
      createdBy: ME,
      createdAt: new Date().toISOString(),
    };
    this.state.roomPolls[roomId].push(poll);
    this.notify();
    return poll;
  }

  voteRoomPoll(roomId, pollId, optionId) {
    const poll = this.getRoomPolls(roomId).find((entry) => entry.id === pollId);
    if (!poll) return;
    poll.options.forEach((option) => {
      option.votes = option.votes.filter((id) => id !== ME);
      if (option.id === optionId) option.votes.push(ME);
    });
    this.notify();
  }

  // A16e: Das Symbol der Hauptkarte ist bearbeitbar. Bisher konnte es nur indirekt über die
  // Entscheidung einer Variante wechseln, weshalb ein eigenes Meet sein Symbol nie ändern konnte.
  setMeetIcon(meetId, icon) {
    const meet = this.getMeet(meetId);
    if (!meet || !icon) return;
    meet.icon = icon;
    this.notify();
  }

  // --- Loop-Editor ---

  saveLoop(meetId, config) {
    const meet = this.getMeet(meetId);
    if (!meet) return;
    meet.loop = { active: true, responses: meet.loop?.responses || {}, ...config };
    if (config.time) meet.time = config.time;
    this.notify();
  }

  stopLoop(meetId) {
    const meet = this.getMeet(meetId);
    if (!meet?.loop) return;
    meet.loop.active = false;
    this.notify();
  }

  // --- Bewertung ---

  // v6 A13: Teilnehmende lassen sich nachträglich ergänzen. Sie werden eingeladen und
  // bekommen Zugriff auf DENSELBEN temporären Raum; vorhandene 1:1-Chats bleiben, was
  // sie sind. Wächst ein Meet dadurch auf mehr als eine andere Person, entsteht der
  // gemeinsame Raum jetzt (vorher gab es keinen, weil eine Person allein genügt hat).
  updateMeetParticipants(meetId, personIds) {
    const meet = this.getMeet(meetId);
    if (!meet) return { ok: false, reason: t('Meet nicht gefunden') };
    const gewuenscht = [...new Set((personIds || []).filter((id) => id && id !== ME))];
    if (!gewuenscht.length) return { ok: false, reason: t('Mindestens eine Person') };
    const vorher = meet.personIds || [];
    meet.personIds = gewuenscht;
    for (const id of gewuenscht) {
      if (!meet.participation[id]) meet.participation[id] = 'open';
    }
    for (const id of vorher) {
      if (!gewuenscht.includes(id)) delete meet.participation[id];
    }
    if (!meet.crewId && meet.personIds.length > 1 && !meet.roomId) {
      const roomId = roomIdForMeet(meet.id);
      meet.roomId = roomId;
      if (!this.state.messages[roomId]) this.state.messages[roomId] = [];
      this.state.roomRead[roomId] = 0;
    }
    this.notify();
    return { ok: true, personIds: meet.personIds };
  }

  // --- Gruppen verlassen (v6 A12) -------------------------------------------------------
  // Eine Gruppe darf nie herrenlos zurückbleiben. Deshalb drei getrennte Wege:
  // verlassen (mit weiteren Admins), Adminrolle übergeben, auflösen (letztes Mitglied).
  crewAdminIds(crew) {
    if (!crew) return [];
    if (Array.isArray(crew.adminIds) && crew.adminIds.length) return crew.adminIds;
    return crew.creatorId ? [crew.creatorId] : [];
  }

  leaveCrew(crewId) {
    const crew = this.state.crews.find((entry) => entry.id === crewId);
    if (!crew) return { ok: false, reason: t('Gruppe nicht gefunden') };
    if (!crew.memberIds.includes(ME)) return { ok: false, reason: t('Du bist kein Mitglied') };
    const andere = crew.memberIds.filter((id) => id !== ME);
    const admins = this.crewAdminIds(crew);
    if (!andere.length) return { ok: false, reason: 'aufloesen' };
    if (admins.length === 1 && admins[0] === ME) return { ok: false, reason: 'adminUebergabe' };
    crew.memberIds = andere;
    crew.adminIds = this.crewAdminIds(crew).filter((id) => id !== ME);
    this.notify();
    return { ok: true };
  }

  transferCrewAdmin(crewId, personId) {
    const crew = this.state.crews.find((entry) => entry.id === crewId);
    if (!crew || !crew.memberIds.includes(personId)) return { ok: false, reason: t('Person ist kein Mitglied') };
    crew.adminIds = [personId];
    crew.creatorId = crew.creatorId === ME ? personId : crew.creatorId;
    this.notify();
    return { ok: true };
  }

  dissolveCrew(crewId) {
    const crew = this.state.crews.find((entry) => entry.id === crewId);
    if (!crew) return { ok: false, reason: t('Gruppe nicht gefunden') };
    // Die eigene Meet-Historie bleibt unberührt — nur Gruppe und Raum verschwinden.
    this.state.crews = this.state.crews.filter((entry) => entry.id !== crewId);
    delete this.state.messages[roomIdForCrew(crewId)];
    delete this.state.roomRead[roomIdForCrew(crewId)];
    this.notify();
    return { ok: true };
  }

  // --- Bewertungen (v6 A23) --------------------------------------------------------------
  // Strukturiert und privat: Verdikt, Negativgründe, positive Aspekte, Notiz, Meetbezug
  // und Zeitpunkt. Ausdrücklich OHNE automatische Auswertung und ohne Sichtbarkeit für
  // andere — die Ablage ist die Grundlage für ein späteres echtes Empfehlungssystem.
  submitReview(meetId, review) {
    const meet = this.getMeet(meetId);
    if (!meet) return;
    if (!review) {
      delete meet.review;
      this.notify();
      return;
    }
    meet.review = {
      meetId,
      verdict: review.verdict,
      reasons: [...(review.reasons || [])],
      aspects: [...(review.aspects || [])],
      // Runde 3 (E2, P5): Themen je dreifach bewertet — { anfahrt: 'nicht-gut' | 'mittel' | 'gut', … }.
      topics: review.topics && typeof review.topics === 'object' ? { ...review.topics } : {},
      note: review.note || '',
      at: new Date().toISOString(),
    };
    this.notify();
  }

  getReviews() {
    return this.state.meets
      .filter((meet) => meet.review && meet.review.verdict)
      .map((meet) => ({ ...meet.review, meetId: meet.id, title: meet.title, date: meet.date }));
  }

  // --- Entwürfe (Neues Meet) ---

  createDraft(input = {}) {
    const draft = {
      id: this.newId('d'),
      withCrewId: input.withCrewId || null,
      withPersonIds: input.withPersonIds || [],
      when: null,
      whenProposals: [], // v14 08.6: weitere Terminvorschläge → Zeit-Varianten des Meets
      idea: null,
      ideaAlternatives: [], // v14 08.2: Mehrfachauswahl → Aktivitäts-Varianten des Meets
      loop: null, // v14 08.1 Loop-Zeile: {repeat, weekday, time} | null
      place: null,
      note: '',
      filter: { category: 'egal', radiusKm: 10, price: 'egal', query: '' },
    };
    this.state.drafts[draft.id] = draft;
    this.persist();
    return draft;
  }

  getDraft(id) {
    return this.state.drafts[id] || null;
  }

  updateDraft(id, patch) {
    const draft = this.state.drafts[id];
    if (!draft) return;
    Object.assign(draft, patch);
    this.notify();
  }

  publishDraft(id) {
    const draft = this.state.drafts[id];
    if (!draft || !draft.idea) return { ok: false, reason: t('Erst eine Idee wählen') };
    const meet = {
      id: this.newId('m'),
      title: draft.idea.title,
      icon: draft.idea.icon || '✨',
      category: draft.idea.category || 'chillen',
      date: draft.when?.date || toISODate(now()),
      time: draft.when?.open ? '' : (draft.when?.time || '19:00'),
      openTime: Boolean(draft.when?.open),
      // Runde 4 (F2, P2-Vertrag .r4-api-zeit.md): „Jetzt" bleibt „Jetzt" — Marke neben der Uhrzeit.
      nowTime: Boolean(draft.when?.now),
      place: uebernimmOrt(draft.place),
      crewId: draft.withCrewId || undefined,
      personIds: draft.withPersonIds.length ? draft.withPersonIds : undefined,
      creatorId: ME,
      status: 'open',
      participation: { [ME]: 'yes' },
      variants: [],
      bring: [],
      polls: [],
      note: draft.note || '',
      placePending: draft.place?.mode === 'person' && !draft.place?.approved,
    };
    // Runde 3 (G1): Foto und Herkunft des Vorschlags (siehe vorschlagsFoto).
    Object.assign(meet, vorschlagsFoto(draft.idea.suggestionId ? this.getSuggestion(draft.idea.suggestionId) : null, meet.place));
    // v14: Alternativen aus der Mehrfachauswahl werden Aktivitäts-Varianten,
    // weitere Terminvorschläge werden Zeit-Varianten, Loop-Zeile wird echter Loop.
    for (const alternative of draft.ideaAlternatives || []) {
      meet.variants.push({
        id: this.newId('v'), kind: 'activity', authorId: ME, votes: [ME],
        title: alternative.title, icon: alternative.icon || '✨', place: alternative.place || null,
      });
    }
    for (const proposal of draft.whenProposals || []) {
      meet.variants.push({
        id: this.newId('v'), kind: 'time', authorId: ME, votes: [ME],
        date: proposal.date, time: proposal.time || null, open: Boolean(proposal.open), now: Boolean(proposal.now),
      });
    }
    if (draft.loop) {
      // v3.2 Ü5: Der Entwurf legt Zeit UND Rhythmus fest (repeat, interval, unit, „Zeit
      // offen"). Beim Veröffentlichen müssen alle vier mitgehen — sonst zeigt das Meet
      // wieder „jede Woche" und eine erfundene Uhrzeit. initLoopSheet() liest genau
      // diese Felder und erkennt „Zeit offen" an time === null.
      const openTime = Boolean(draft.loop.open) || draft.loop.time === null;
      meet.loop = {
        active: true, responses: {},
        repeat: draft.loop.repeat || 'weekly',
        weekday: draft.loop.weekday ?? new Date(meet.date).getDay(),
        time: openTime ? null : (draft.loop.time || meet.time),
        interval: Math.max(1, Number(draft.loop.interval) || 1),
      };
    }
    // v6 A13: Mehrere Einzelpersonen ohne gemeinsame Gruppe bekommen EINEN temporären
    // Meet-Raum. Vorher öffnete „Chat öffnen" einen zufälligen 1:1-Chat, in dem die
    // übrigen Teilnehmenden gar nicht vorkamen — obwohl alle dieselbe Teilnahme,
    // dieselben Varianten, Listen und Umfragen sehen müssen.
    if (!meet.crewId && (meet.personIds || []).length > 1) {
      const roomId = roomIdForMeet(meet.id);
      meet.roomId = roomId;
      if (!this.state.messages[roomId]) this.state.messages[roomId] = [];
      this.state.roomRead[roomId] = 0;
    }
    this.state.meets.push(meet);
    delete this.state.drafts[id];
    this.notify();
    return { ok: true, meetId: meet.id };
  }

  discardDraft(id) {
    delete this.state.drafts[id];
    this.persist();
  }

  // --- Entdecken & Gespeichert ---

  getSuggestions(filter = {}) {
    this.vorschlaegeNachladen();
    return this.engine.rankSuggestions({
      suggestions: [...this.state.suggestions, ...(this.orteNachlader?.orte || [])],
      // Runde 2: Entfernungen von zuhause aus gerechnet (Liste = Umkreis-Karte).
      // Runde 3: vom freigegebenen Standort, wenn es einen gibt (getVorschlagsMitte).
      // Runde 4 (D9): Mit Gruppe/Personen von der Gruppenmitte — dieselbe Stelle wie Ring und Karte.
      mitte: this.getVorschlagsMitte({ crewId: filter.crewId, personIds: filter.personIds }),
      filter,
      interests: this.state.settings.interests,
      // Runde 2: Ressourcen machen Vorschläge leicht, Gelerntes sortiert und blendet aus.
      resources: this.state.settings.resources,
      lernen: this.state.settings.lernen,
      weekdayNow: now().getDay(),
      hourNow: now().getHours(),
      monatNow: now().getMonth(),
      // Runde 4 (G6): Vorhersage des Feldes, sobald die Funktion sie geliefert hat.
      wetter: this.orteNachlader?.wetter || null,
    });
  }

  // Runde 3 (Jonathan: „In Salzburg zeigt es Vorarlberg"): Die Demo erzählt ihre Geschichte in
  // Bregenz — dort bleiben die ausgesuchten Beispiele. Liegt die eingetragene Zuhause-Adresse
  // woanders, fragt sie als Gast die Funktion `vorschlaege` nach echten Orten dieser Gegend;
  // die Bregenzer Beispiele blendet die Engine dann aus (weiter als 80 km von zuhause).
  vorschlaegeNachladen() {
    vorschlagsStandortAuffrischen(() => this.notify());
    const heim = this.getVorschlagsMitte();
    if (!hatLage(heim) || typeof fetch !== 'function') return;
    const beispiele = seedSettings.homeAddress;
    if (hatLage(beispiele) && entfernungKm(heim, beispiele) < 40) return;
    this.orteNachlader ||= new OrteNachlader(async (lage) => {
      const { supabaseConfig } = await import('./gateway.js');
      const { url, key } = supabaseConfig();
      const antwort = await fetch(`${url}/functions/v1/vorschlaege`, {
        method: 'POST',
        headers: { apikey: key, 'Content-Type': 'application/json' },
        body: JSON.stringify({ lat: lage.lat, lon: lage.lon, sprache: sprache() }),
      });
      if (!antwort.ok) return { error: new Error(`Status ${antwort.status}`) };
      return { data: await antwort.json() };
    }, () => this.notify());
    this.orteNachlader.lade(heim);
  }

  getSuggestion(id, opts = {}) {
    const alle = [...this.state.suggestions, ...(this.orteNachlader?.orte || [])];
    return mitAbstand(alle.find((entry) => entry.id === id) || null, this.getVorschlagsMitte(opts));
  }

  // Runde 3: Mitte der Vorschläge — { lat, lon, quelle: 'standort' | 'zuhause' } oder null.
  // Runde 4 (D9, Jonathan): Ist eine Gruppe bzw. sind Personen gewählt, ist die Mitte das Mittel
  // aus der eigenen Mitte und den Standorten, die diese Personen mit mir teilen. → quelle 'gruppe'.
  getVorschlagsMitte(opts = {}) {
    const eigene = vorschlagsMitte(this.state.settings.homeAddress);
    const ids = new Set(opts.personIds || []);
    if (opts.crewId) for (const id of (this.state.crews.find((c) => c.id === opts.crewId)?.memberIds || [])) ids.add(id);
    ids.delete(ME);
    const punkte = eigene ? [eigene] : [];
    for (const id of ids) {
      const standort = this.getPerson(id)?.standort;
      if (hatLage(standort)) punkte.push(standort);
    }
    if (!punkte.length) return null;
    if (punkte.length === 1) return eigene || { lat: punkte[0].lat, lon: punkte[0].lon, quelle: 'gruppe', anzahl: 1 };
    const lat = punkte.reduce((summe, p) => summe + p.lat, 0) / punkte.length;
    const lon = punkte.reduce((summe, p) => summe + p.lon, 0) / punkte.length;
    return { lat, lon, quelle: 'gruppe', anzahl: punkte.length };
  }

  // Runde 3: Standort für Vorschläge erfragen (nur auf Tippen). → Promise<{ ok, grund? }>

  // Runde 5 (D4, Jonathan: „Bedenke das jede mapp weis wo ich binn wen ich standort habe"): Wo bin ich —
  // für jede Karte gleich. Nur mit Freigabe: zuerst der Gerätestandort (Vorschläge), dann der geteilte
  // Standort, das Zuhause nur als Rückfall (genau: false).
  getMyLocation() {
    const halbeStunde = 30 * 60000;
    const geraet = vorschlagsMitte(null);
    if (geraet && geraet.quelle === 'standort') {
      return { lat: geraet.lat, lon: geraet.lon, genau: Date.now() - (geraet.am || 0) < halbeStunde, quelle: 'geraet' };
    }
    const s = this.state.settings || {};
    if (s.location?.use && hatLage(s.standort)) {
      return { lat: s.standort.lat, lon: s.standort.lon, genau: Date.now() - (s.standort.at || 0) < halbeStunde, quelle: 'geteilt' };
    }
    if (s.location?.use && hatLage(s.homeAddress)) return { lat: s.homeAddress.lat, lon: s.homeAddress.lon, genau: false, quelle: 'zuhause' };
    return null;
  }

  // Runde 5 (E1): Lage einer Person für die Mitfahr-Rechnung. Für andere NUR ihr geteilter Standort —
  // nie eine Adresse. Für mich wie getMyLocation.
  getLage(personId) {
    if (personId === ME) {
      const ich = this.getMyLocation();
      return ich ? { lat: ich.lat, lon: ich.lon, quelle: ich.quelle === 'zuhause' ? 'zuhause' : 'geteilt' } : null;
    }
    const standort = this.getPerson(personId)?.standort;
    return hatLage(standort) ? { lat: standort.lat, lon: standort.lon, quelle: 'geteilt' } : null;
  }

  // --- Runde 5 (E1): Mitfahren. Je Meet und Person { rolle: 'fahrer'|'mitfahrer'|'selbst', plaetze, fahrerId }.
  ridesVon(meetId) {
    if (!this.ridesStand) this.ridesStand = {};
    if (!this.ridesStand[meetId]) this.ridesStand[meetId] = {};
    return this.ridesStand[meetId];
  }

  getRides(meetId) {
    const zeilen = this.ridesVon(meetId);
    const eintraege = Object.entries(zeilen).sort((a, b) => (a[1].am || 0) - (b[1].am || 0));
    const fahrer = [];
    const suchen = [];
    const selbst = [];
    for (const [personId, z] of eintraege) {
      if (z.rolle === 'fahrer') {
        fahrer.push({
          personId,
          plaetze: z.plaetze || 1,
          mitfahrer: eintraege.filter(([, m]) => m.rolle === 'mitfahrer' && m.fahrerId === personId).map(([id]) => id),
        });
      } else if (z.rolle === 'mitfahrer' && !z.fahrerId) suchen.push(personId);
      else if (z.rolle === 'selbst') selbst.push(personId);
    }
    return { fahrer, suchen, selbst };
  }

  // Eigene Rolle. Wer aufhört zu fahren oder weniger Plätze hat, gibt Mitfahrer frei (wie der Server-Trigger).
  rideRolleLokal(meetId, rolle, plaetze) {
    const zeilen = this.ridesVon(meetId);
    const bisher = zeilen[ME];
    if (rolle === 'mitfahrer' && bisher?.rolle === 'mitfahrer') return { geaendert: false };
    if (bisher?.rolle === 'fahrer' && rolle !== 'fahrer') {
      for (const z of Object.values(zeilen)) if (z.fahrerId === ME) z.fahrerId = null;
    }
    if (!rolle) {
      delete zeilen[ME];
      return { geaendert: true };
    }
    if (rolle === 'fahrer') {
      const n = Math.min(8, Math.max(1, Math.round(Number(plaetze) || bisher?.plaetze || 1)));
      zeilen[ME] = { rolle, plaetze: n, fahrerId: null, am: bisher?.am || Date.now() };
      Object.values(zeilen)
        .filter((z) => z.fahrerId === ME)
        .sort((a, b) => (a.am || 0) - (b.am || 0))
        .slice(n)
        .forEach((z) => { z.fahrerId = null; });
      return { geaendert: true, plaetze: n };
    }
    zeilen[ME] = { rolle, plaetze: null, fahrerId: null, am: Date.now() };
    return { geaendert: true };
  }

  rideZuordnenPruefen(meetId, mitfahrerId, fahrerId) {
    const meet = this.getMeet(meetId);
    if (!meet) return 'keinMeet';
    const zeilen = this.ridesVon(meetId);
    const bisher = zeilen[mitfahrerId];
    const darf = ME === mitfahrerId || ME === meet.creatorId || (fahrerId && ME === fahrerId) || (!fahrerId && bisher?.fahrerId === ME);
    if (!darf) return 'verboten';
    if (bisher?.rolle === 'fahrer' && ME !== mitfahrerId && ME !== meet.creatorId) return 'verboten';
    if (fahrerId) {
      if (fahrerId === mitfahrerId) return 'verboten';
      const f = zeilen[fahrerId];
      if (f?.rolle !== 'fahrer') return 'keinFahrer';
      const belegt = Object.entries(zeilen).filter(([id, z]) => id !== mitfahrerId && z.fahrerId === fahrerId).length;
      if (belegt >= (f.plaetze || 1)) return 'voll';
    }
    return 'ok';
  }

  rideZuordnenLokal(meetId, mitfahrerId, fahrerId) {
    const zeilen = this.ridesVon(meetId);
    if (zeilen[mitfahrerId]?.rolle === 'fahrer') {
      for (const z of Object.values(zeilen)) if (z.fahrerId === mitfahrerId) z.fahrerId = null;
    }
    zeilen[mitfahrerId] = { rolle: 'mitfahrer', plaetze: null, fahrerId: fahrerId || null, am: Date.now() };
  }

  // Demo: Mitfahrten liegen im gespeicherten Zustand (localStorage), damit sie ein Neuladen überleben.
  get ridesStand() { return this.state.rides; }
  set ridesStand(wert) { this.state.rides = wert; }

  setRide(meetId, { rolle = null, plaetze } = {}) {
    if (!this.getMeet(meetId)) return { ok: false, reason: 'keinMeet' };
    if (rolle && !['fahrer', 'mitfahrer', 'selbst'].includes(rolle)) return { ok: false, reason: 'rolle' };
    const { geaendert } = this.rideRolleLokal(meetId, rolle, plaetze);
    if (geaendert) this.notify();
    return { ok: true };
  }

  assignRide(meetId, mitfahrerId, fahrerId = null) {
    const antwort = this.rideZuordnenPruefen(meetId, mitfahrerId, fahrerId);
    if (antwort !== 'ok') return { ok: false, reason: antwort };
    this.rideZuordnenLokal(meetId, mitfahrerId, fahrerId);
    this.notify();
    return { ok: true };
  }

  standortFuerVorschlaege() {
    return standortFuerVorschlaegeHolen().then((ergebnis) => {
      if (ergebnis.ok) { this.vorschlaegeNachladen(); this.notify(); }
      return ergebnis;
    });
  }

  vorschlagsStandortVergessen() {
    vorschlagsStandortVergessen();
    this.notify();
  }

  getPersonPlace(personId) {
    return this.state.personPlaces[personId] || null;
  }

  // v6 A18: Eine Ortsanfrage ist eine ECHTE Anfrage an die betroffene Person, kein
  // Timer. Vorher stimmte die Demo nach 8 Sekunden von selbst zu — damit gab es weder
  // eine Entscheidung noch eine Stelle, an der man sie treffen konnte.
  requestPersonPlace(personId, options = {}) {
    if (!this.state.personPlaces[personId]) {
      this.state.personPlaces[personId] = { name: 'Adresse', address: '', approved: false };
    }
    this.state.personPlaces[personId].requested = true;
    if (!this.state.placeRequests) this.state.placeRequests = [];
    const offen = this.state.placeRequests.find((r) => r.hostId === personId && r.status === 'open'
      && (!options.meetId || r.meetId === options.meetId || r.meetId === null));
    if (offen && options.meetId && offen.meetId === null) offen.meetId = options.meetId;
    if (!offen) {
      this.state.placeRequests.push({
        id: this.newId('pq'),
        meetId: options.meetId || null,
        hostId: personId,
        requesterId: ME,
        status: 'open',
        createdAt: new Date().toISOString(),
      });
    }
    this.notify();
  }

  getPlaceRequests(query = {}) {
    const alle = this.state.placeRequests || [];
    return alle.filter((r) => (!query.meetId || r.meetId === query.meetId)
      && (!query.hostId || r.hostId === query.hostId)
      && (!query.status || r.status === query.status));
  }

  // accept=true gibt den genauen Treffpunkt für die Teilnehmenden frei; accept=false
  // lehnt ab und lässt den Ort offen. Beides ist eine bewusste Handlung der Person.
  respondPlaceRequest(requestId, accept) {
    const request = (this.state.placeRequests || []).find((r) => r.id === requestId);
    if (!request || request.status !== 'open') return { ok: false };
    request.status = accept ? 'accepted' : 'declined';
    request.respondedAt = new Date().toISOString();
    // Werde ICH gefragt, liegt der Ort nicht in personPlaces, sondern in meinen
    // Einstellungen — die private Zuhause-Adresse gehört seit A19e nur noch dorthin.
    if (request.hostId === ME && !this.state.personPlaces[ME]) {
      const zuhause = this.state.settings.homeAddress || {};
      this.state.personPlaces[ME] = {
        name: 'Bei mir',
        address: [zuhause.name, zuhause.city].filter(Boolean).join(', '),
        approved: false,
      };
    }
    const place = this.state.personPlaces[request.hostId];
    if (place) place.approved = Boolean(accept);
    if (request.meetId) {
      const meet = this.getMeet(request.meetId);
      if (meet) {
        // Nach einer Antwort ist nichts mehr offen — egal wie sie ausfaellt.
        meet.placePending = false;
        if (accept && place) {
          // Erst jetzt darf der genaue Treffpunkt bei den Teilnehmenden erscheinen.
          meet.place = uebernimmOrt({ ...place, name: place.name || `Bei ${this.getPerson(request.hostId)?.name || ''}` });
        } else if (!accept) {
          meet.place = { name: '', address: '', x: 0.5, y: 0.5 };
        }
      }
    }
    this.notify();
    return { ok: true, status: request.status };
  }

  approvePersonPlace(personId) {
    const place = this.state.personPlaces[personId];
    if (!place || place.approved) return;
    place.approved = true;
    this.notify();
  }

  // Demo-Ortsbestand: alle Vorschlags-Orte plus einige weitere Orte.
  searchPlaces(query) {
    const extra = [
      { name: 'Strandbad Lochau', address: 'Seestraße 1, Lochau', lat: 47.52482, lon: 9.74779, x: 0.68, y: 0.14 },
      { name: 'Reutepark', address: 'Reutegasse, Bregenz', lat: 47.50253, lon: 9.72326, x: 0.4, y: 0.58 },
      { name: 'Molo Bregenz', address: 'Seepromenade 4, Bregenz', lat: 47.50427, lon: 9.73945, x: 0.3, y: 0.36 },
    ];
    const fromSuggestions = this.state.suggestions
      .filter((entry) => entry.place)
      .map((entry) => ({ ...entry.place }));
    const all = [...fromSuggestions, ...extra];
    const q = (query || '').trim().toLowerCase();
    if (!q) return all;
    return all.filter((place) => `${place.name} ${place.address || ''}`.toLowerCase().includes(q));
  }

  getSavedFolders() {
    return this.state.folders;
  }

  createFolder(name) {
    const folder = { id: this.newId('f'), name };
    this.state.folders.push(folder);
    this.notify();
    return folder;
  }

  getSavedIdeas(folderId) {
    const all = [...this.state.savedIdeas].sort((a, b) => b.createdAt - a.createdAt);
    if (!folderId || folderId === 'all') return all;
    return all.filter((idea) => idea.folderId === folderId);
  }

  saveIdea(idea, options = {}) {
    const created = {
      id: this.newId('idea'),
      folderId: options.folderId || null,
      createdAt: Date.now(),
      ...idea,
    };
    this.state.savedIdeas.push(created);
    this.notify();
    return created;
  }

  removeSavedIdea(id) {
    this.state.savedIdeas = this.state.savedIdeas.filter((idea) => idea.id !== id);
    this.notify();
  }

  // --- Catch-up ---

  // sinceCount optional: Stand VOR markRoomRead (der Raum-Screen merkt ihn sich beim Öffnen).
  getCatchUp(roomId, sinceCount) {
    const room = this.roomFromId(roomId);
    const from = typeof sinceCount === 'number' ? sinceCount : room.lastReadCount;
    const unseen = room.messages
      .slice(from)
      .filter((message) => message.kind === 'text' && message.authorId !== ME)
      .map((message) => ({
        authorName: this.getPerson(message.authorId)?.name || '—',
        text: message.text,
      }));
    return this.engine.summarizeChat(unseen);
  }
}
