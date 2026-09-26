// DemoDataGateway — lokale M0–M2-Implementierung des CrewRepository.
// Kein Login, keine Echtzeit, keine externen Dienste; Zustand liegt in localStorage.
// In M3 ersetzt ein ServerDataGateway denselben Vertrag, ohne dass Screens neu gebaut werden.

import { CrewRepository } from './repository.js';
import { ME, PEOPLE, roomIdForCrew, roomIdForPerson, roomIdForMeet } from './ids.js';
import { seedPeople, seedCrews, seedInviteDirectory } from './seed/crew.js';
import { seedSettings } from './seed/profile.js';
import { seedMeets } from './seed/meets.js';
import { seedMessages, seedRoomRead } from './seed/rooms.js';
import { seedSuggestions, seedFolders, seedSavedIdeas, seedPersonPlaces, seedStandorte, seedAbholadressen } from './seed/discover.js';
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
  naechsteFreiGrenze, freiAbgelaufen, freiAnker, freiMitAnker, freiFuerAndere,
  busyBereinigen, busyVollstaendig, busyFuerFreunde, busyWoche, meetZeiten, meetZeitenRoh, crewAdminGrund, findListe, gemerktIdsBereinigen,
  FRAGE_GUELTIG_MS, FRAGE_ANTWORTEN, frageGueltig, frageErlaubt, frageZaehltNoch,
  ANREISE_ARTEN, anreiseZeile, rolleAusAnreise, genauigkeitVon,
  chatEintraege, ankunftListe, vergangeneMeetChats, meetChatAbgelaufen, gruppeMitGenau,
  standortGenauigkeitNorm, standortGenauigkeitFuer, lageGroeber, lageAusPosition, lageSendenLohnt,
  genauigkeitKlemmen, GENAUIGKEIT_M, standortErlaubnisSchonDa, standortErlaubnisMerken,
} from './projections.js';
// Runde 11 (C1): „Chat löschen" gilt nur für mich — dieselbe Regel wie im Server-Datenweg.
import { nachGeleert } from './projections.js';
import { belegtJetzt } from '../core/belegt.js';
import { seedAnkuenfte, seedFragen } from './seed/jetzt.js';
import { findBeispiele } from './seed/find.js';

// v4: Der Schlüssel wandert mit, sobald sich die Seed-Form ändert (hier: Einladungscodes,
// Einladungs-Verzeichnis, Ressourcen-Sichtbarkeit). Sonst liest ein Gerät mit altem
// localStorage weiter den alten Bestand und die neuen Zustände wären unerreichbar.
const STORAGE_KEY = 'crew-demo-state-v4';
// Runde 2: Merkmal des versteckten Demo-Einstiegs (gesetzt in data/gateway.js starteDemo).
export const DEMO_NEU_KEY = 'crew-demo-neu';
// Runde 8 (R8-14, Jonathan: „Die Demo startet bei jedem Öffnen frisch vom Grundbestand — was
// Tester eintippen, bleibt nicht."): Der Bestand liegt weiter in localStorage, damit ein Neuladen
// im selben Tab nichts verliert. Ob dieses Öffnen NEU ist, sagt ein Merker in sessionStorage —
// der lebt genau so lange wie der Tab bzw. die App-Sitzung. Fehlt er, beginnt die Demo vom
// Grundbestand (buildSeedState); was der vorige Mensch eingetippt hat, ist weg.
const SITZUNG_KEY = 'crew-demo-sitzung';

function sitzungLaeuft() {
  try { return Boolean(window.sessionStorage.getItem(SITZUNG_KEY)); } catch { return false; }
}

function sitzungMerken() {
  try { window.sessionStorage.setItem(SITZUNG_KEY, '1'); } catch { /* privater Modus: dann gilt jedes Laden als neu */ }
}
const VARIANT_COOLDOWN_MS = 20000;
// Runde 11 (C4): So lange braucht das nachgespielte Gerät einer Freundin für die Antwort auf „Wo bist du?"
// — und ab so alter Lage (Handy aus) antwortet es gar nicht (standortAnfragen).
const DEMO_ANTWORT_MS = 3000;
const DEMO_STUMM_AB_MIN = 120;

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
    roomRead: deepClone(seedRoomRead),
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
    // Runde 7 (A6): Ankunftsstempel je Meet — { [meetId]: { [personId]: ms } }.
    ankuenfte: seedAnkuenfte(),
    // Runde 7 (E5): flüchtige Fragen „Hast du Zeit?" — sie leben zwei Stunden, nicht länger.
    fragen: seedFragen(),
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
    // Runde 10: Mitteilungen und „Standort verwenden" stehen von Anfang an auf an; `standardAn`
    // sagt, dass das schon gilt — app.js stellt es sonst EINMAL nach (auch für alte Konten).
    standardAn: 1,
    location: { use: true, shareMode: 'niemand', shareIds: [] },
    // Runde 7 (E1): Ein neuer Mensch hat noch keine festen Zeiten eingetragen.
    belegt: [],
    // Runde 8 (R8-50): … und noch nichts in Find gemerkt.
    gemerktIds: [],
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
  state.ankuenfte = {};
  state.fragen = [];
  state.inviteDirectory = deepClone(seedInviteDirectory);
  return state;
}

export class DemoDataGateway extends CrewRepository {
  constructor(engine) {
    super();
    this.engine = engine;
    this.listeners = new Set();
    this.state = this.load();
    // Runde 7 (H1/E5): zwei Uhren, die genau zur Grenze schlagen — keine, die jede Minute
    // nachsieht. Ein Minutentakt kostet Akku und weckt die App für nichts.
    this.freiUhrStellen();
    this.fragenUhrStellen();
  }

  // Runde 10 (Jonathan: „manchmal aktualisiert es nicht direkt … z. B. Standort"):
  // Ein Repository ist nach ready() startbereit — im Gerät genauso wie am Server
  // (SupabaseGateway.ready). Dazu gehört der eigene Standort. GEMESSEN war: Steht
  // „Standort verwenden" an (seit Runde 10 der Standard für alle Konten), fragte im
  // Demo-Modus NIEMAND das Gerät — standortSenden() lief nur beim Umlegen des Schalters.
  // Die Karte zeigte darum das Zuhause statt der wirklichen Lage, und sie blieb dort stehen,
  // solange die App offen war. Gefragt wird hier nichts: Ohne erteilte Erlaubnis geschieht
  // gar nichts (projections.standortErlaubnisSchonDa) — dieselbe Regel wie am Server.
  async ready() {
    this.standortSenden();
    globalThis.document?.addEventListener?.('visibilitychange', () => {
      if (globalThis.document.visibilityState === 'visible') this.standortSenden();
      else this.standortWacheBeenden();
    });
    return this;
  }

  load() {
    try {
      const suche = new URLSearchParams(window.location.search);
      // Auftrag §10: `?neu=1` setzt auf den Zustand eines Menschen, der die App gerade
      // zum ersten Mal öffnet — kein Name, keine Freunde, keine Crew, kein Meet. Genau
      // dieser Zustand ist der am schlechtesten gebaute (§3) und war bisher nur über
      // „Konto löschen" erreichbar, also genau einmal.
      if (suche.has('neu')) {
        sitzungMerken();
        window.localStorage.removeItem(STORAGE_KEY);
        const leer = buildLeerState();
        window.localStorage.setItem(STORAGE_KEY, JSON.stringify(leer));
        return this.migrate(leer);
      }
      // Runde 2 (Jonathan: „In der Demo soll man alles haben, was man beim ersten Mal sieht"):
      // Der versteckte Einstieg beginnt wie für jeden neuen Menschen — beim Einrichten. Die
      // Beispiel-Freunde kommen erst danach dazu (completeOnboarding).
      if (window.localStorage.getItem(DEMO_NEU_KEY)) {
        sitzungMerken();
        window.localStorage.removeItem(DEMO_NEU_KEY);
        const leer = buildLeerState();
        leer.beispieleNachEinrichten = true;
        window.localStorage.setItem(STORAGE_KEY, JSON.stringify(leer));
        return this.migrate(leer);
      }
      // R8-14: Ein neues Öffnen (neuer Tab, App neu gestartet) beginnt beim Grundbestand.
      if (suche.has('reset') || !sitzungLaeuft()) {
        window.localStorage.removeItem(STORAGE_KEY);
      }
      sitzungMerken();
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
    // Runde 7 (A6/E5): neue Ablagen; ein alter Speicherstand kennt sie noch nicht.
    if (!state.ankuenfte || typeof state.ankuenfte !== 'object') state.ankuenfte = {};
    if (!Array.isArray(state.fragen)) state.fragen = [];
    // Runde 8 (R8-39): Die Freigabe der Busy-Zeiten ist abgeschafft — Freunde sehen sie immer.
    // Ein alter Speicherstand verliert das Feld, damit es nirgends mehr als Wahrheit herumsteht.
    if (state.settings) delete state.settings.belegtSichtbar;
    for (const person of state.people || []) delete person.belegtSichtbar;
    // Runde 8 (R8-50): gemerkte Find-Einträge — ein alter Speicherstand kennt sie noch nicht.
    if (state.settings && !Array.isArray(state.settings.gemerktIds)) state.settings.gemerktIds = [];
    // Runde 7 (H1): Ein gespeichertes „frei" aus der Zeit vor dem Zurücksetzen hat keinen
    // Anker. Ohne ihn stünde es für immer — deshalb bekommt es JETZT einen, und die
    // eingestellte Uhrzeit greift ab der nächsten Grenze.
    // Runde 11 (B7): Dieselbe Regel gilt für die anderen Leute im Bestand (Seed und alter
    // Speicherstand tragen „frei" ohne Anker). Sonst blieben Freunde für immer „frei" — genau
    // der Fehler, den es am Server gab. Die Regel selbst steht in projections.js, damit sie
    // hier und im Server-Gateway dieselbe ist.
    if (state.settings?.free) state.settings.free = freiMitAnker(state.settings.free);
    for (const person of state.people || []) {
      if (person?.free) person.free = freiMitAnker(person.free);
    }
    // Runde 7 (E6): Mitfahr-Zeilen tragen künftig eine ANREISE-Art. Bestehende Rollen werden
    // übersetzt, nicht weggeworfen — wer wen mitnimmt, bleibt erhalten.
    if (state.rides && typeof state.rides === 'object') {
      for (const zeilen of Object.values(state.rides)) {
        for (const [personId, zeile] of Object.entries(zeilen || {})) {
          const neu = anreiseZeile(zeile);
          if (neu) zeilen[personId] = neu;
          else delete zeilen[personId];
        }
      }
    }
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
    this.freiUhrStellen();
    this.fragenUhrStellen();
  }

  newId(prefix) {
    this.state.nextId += 1;
    return `${prefix}-${this.state.nextId}`;
  }

  // --- Identität & Einstellungen ---

  getMe() {
    this.freiAufraeumen();
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
      // Runde 7 (E1): Die eigenen „Keine Zeit"-Zeiten gehören zur eigenen Person — sonst
      // müsste jede Ansicht sie an getMe() vorbei aus den Einstellungen holen.
      belegt: busyVollstaendig(s.belegt),
      showsActivity: true,
      sharesLocation: true,
      unread: 0,
    };
  }

  getSettings() {
    // Runde 3 (B2): Zeichen für unbekannte Interessen und Ressourcen nachlernen (Funktion `zeichen`).
    zeichenNachlernen(namenAusEinstellungen(this.state.settings), (body) => this.zeichenAnfragen(body), sprache(), () => this.notify());
    // Runde 7 (H1): Jede Leseseite bekommt einen aufgeräumten Frei-Zustand — auch nach zwei
    // Tagen geschlossener App, ohne dass irgendein Bildschirm daran denken muss.
    this.freiAufraeumen();
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
    // Runde 7 (E1): Zeitfenster gehen immer bereinigt in den Bestand — ungültige Eingaben
    // (Tag 9, „25:00", von === bis) dürfen gar nicht erst liegen bleiben.
    if (patch && patch.belegt !== undefined) this.state.settings.belegt = busyBereinigen(patch.belegt);
    // Runde 8 (R8-50): gemerkte Find-Einträge — nur Ids, keine Doppelten.
    if (patch && patch.gemerktIds !== undefined) this.state.settings.gemerktIds = gemerktIdsBereinigen(patch.gemerktIds);
    // Runde 7, Welle 2 (M1): Teilen an → sofort die echte Lage holen; aus → Wache aus und die
    // gemerkte Lage weg. Eine Lage, die niemand mehr sehen darf, hat auch hier nichts verloren.
    if (patch && patch.location !== undefined) {
      if (patch.location.use) this.standortSenden({ sofort: true });
      else {
        this.standortWacheBeenden();
        this.state.settings.standort = null;
      }
    }
    this.notify();
    // Runde 7 (H1): Wird die Uhrzeit geändert, WÄHREND frei aktiv ist, gilt sofort die neue —
    // gerechnet ab demselben Anker. Die Uhr stellt sich darauf; liegt die neue Grenze schon
    // in der Vergangenheit, räumt freiAufraeumen gleich auf.
    if (!patch || patch.freeResetTime !== undefined || patch.free !== undefined) {
      if (!this.freiAufraeumen()) this.freiUhrStellen();
    }
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
      for (const teil of ['people', 'crews', 'meets', 'messages', 'roomRead', 'folders', 'savedIdeas', 'personPlaces', 'placeRequests', 'inviteDirectory', 'ankuenfte', 'fragen']) {
        this.state[teil] = seed[teil];
      }
      const s = this.state.settings;
      if (!(s.bestFriendIds || []).length) s.bestFriendIds = seed.settings.bestFriendIds;
      if (!s.specialPerson) s.specialPerson = seed.settings.specialPerson;
      s.friendRequests = seed.settings.friendRequests;
      this.state.beispieleNachEinrichten = false;
      this.migrate(this.state);
      // Runde 7: Ankünfte und Fragen sind Minuten alt — beim Einrichten neu gestellt, sonst
      // wären sie zum Zeitpunkt des ersten Blicks schon abgelaufen.
      this.state.ankuenfte = seedAnkuenfte();
      this.state.fragen = seedFragen();
      this.fragenUhrStellen();
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
    // Ein geplantes „Frei ab" wird zum gewählten Zeitpunkt von selbst wirksam. `setAt` bleibt
    // dabei stehen: es ist der Anker für das Zurücksetzen (H1), nicht der Startzeitpunkt.
    if (free?.pending && free.fromAt && Date.now() >= free.fromAt) {
      free.pending = false;
      free.from = null;
      free.fromAt = null;
      this.persist();
    }
    this.freiAufraeumen();
    return this.state.settings.free;
  }

  // --- Runde 7 (H1): „Frei zurücksetzen um HH:MM" ---------------------------------------
  // Beim LESEN. Damit stimmt der Zustand auch dann, wenn die App zwei Tage zu war: gerechnet
  // wird von setAt zur nächsten eingestellten Uhrzeit, nicht „vor 24 Stunden".
  freiAufraeumen(jetzt = Date.now()) {
    const s = this.state.settings;
    if (!freiAbgelaufen(s.free, s.freeResetTime, jetzt)) return false;
    s.free = { active: false, pending: false, from: null, setAt: null, fromAt: null, lust: null };
    this.persist();
    // Das Aufräumen passiert MITTEN im Lesen (getSettings wird beim Zeichnen gerufen). Ein
    // notify() an dieser Stelle würde das Zeichnen aus sich selbst heraus neu anstoßen —
    // deshalb erst danach, im nächsten Durchlauf.
    clearTimeout(this.freiNachricht);
    this.freiNachricht = setTimeout(() => { this.freiNachricht = null; this.notify(); }, 0);
    this.freiNachricht?.unref?.();
    this.freiUhrStellen();
    return true;
  }

  // Und während die App offen ist: EINE Uhr, gestellt auf genau die Grenze. Nach dem Schlagen
  // wird der Zustand mit derselben Regel geprüft (der Rechner kann geschlafen haben) und die
  // Uhr auf die nächste Grenze gestellt.
  freiZuruecksetzenAm() {
    const s = this.state.settings;
    if (!s.free?.active) return null;
    return naechsteFreiGrenze(s.freeResetTime, freiAnker(s.free));
  }

  freiUhrStellen() {
    clearTimeout(this.freiUhr);
    this.freiUhr = null;
    const am = this.freiZuruecksetzenAm();
    if (!am) return;
    const inMs = Math.max(0, am - Date.now());
    // setTimeout ist auf ~24,8 Tage begrenzt; eine Grenze liegt nie weiter als 24 h entfernt.
    this.freiUhr = setTimeout(() => {
      this.freiUhr = null;
      if (!this.freiAufraeumen()) this.freiUhrStellen();
    }, inMs + 250);
    // Im Browser darf diese Uhr die Seite nicht am Leben halten (Node: unref existiert).
    this.freiUhr?.unref?.();
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
    // Runde 7 (H1): `setAt` ist ab jetzt IMMER gesetzt — er ist der Anker, an dem „Frei
    // zurücksetzen um HH:MM" rechnet. Vorher stand er nur beim geplanten Frei, weshalb ein
    // normales „frei" überhaupt keinen Zeitpunkt hatte, von dem aus man hätte zurücksetzen können.
    this.state.settings.free = fromAt
      ? { active: true, pending: true, from: options.from || null, setAt: Date.now(), fromAt, lust }
      : { active: true, pending: false, from: null, setAt: Date.now(), fromAt: null, lust };
    this.notify();
    this.freiUhrStellen();
  }

  clearFree() {
    this.state.settings.free = { active: false, pending: false, from: null, setAt: null, fromAt: null, lust: null };
    this.notify();
    this.freiUhrStellen();
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

  // --- Runde 8 (R8-39): Busy — Titel, Schloss, keine Freigabe-Einstellung ----------------------
  // Ein Fenster trägt Zeit, Titel und Schloss — mehr nicht. Gespeichert wird die kompakte Form
  // (projections.js busyBereinigen), gelesen die vollständige (busyVollstaendig). Die
  // Freigabe-Einstellung (setBelegtSichtbar) ist abgeschafft: Freunde sehen Busy immer, hinter
  // einem Schloss nur „busy". Diese Grenze sitzt an genau einer Stelle — busyFuerFreunde, gerufen
  // in personWithDerived und getBelegtWoche.
  getBelegt() {
    return busyVollstaendig(this.state.settings.belegt);
  }

  setBelegt(liste) {
    this.state.settings.belegt = busyBereinigen(liste);
    this.notify();
    return { ok: true, belegt: this.getBelegt() };
  }

  addBelegt(fenster) {
    const sauber = busyBereinigen([fenster]);
    if (!sauber.length) return { ok: false, reason: 'ungueltig', belegt: this.getBelegt() };
    const liste = [...busyBereinigen(this.state.settings.belegt), sauber[0]];
    this.state.settings.belegt = liste;
    this.notify();
    return { ok: true, index: liste.length - 1, belegt: this.getBelegt() };
  }

  // Der Patch darf auch nur den Titel oder nur das Schloss ändern; titel '' nimmt ihn weg.
  updateBelegt(index, patch) {
    const liste = busyBereinigen(this.state.settings.belegt);
    if (!liste[index]) return { ok: false, reason: 'unbekannt', belegt: this.getBelegt() };
    const sauber = busyBereinigen([{ ...liste[index], ...patch }]);
    if (!sauber.length) return { ok: false, reason: 'ungueltig', belegt: this.getBelegt() };
    liste[index] = sauber[0];
    this.state.settings.belegt = liste;
    this.notify();
    return { ok: true, belegt: this.getBelegt() };
  }

  removeBelegt(index) {
    const liste = busyBereinigen(this.state.settings.belegt);
    if (!liste[index]) return { ok: false, reason: 'unbekannt', belegt: this.getBelegt() };
    liste.splice(index, 1);
    this.state.settings.belegt = liste;
    this.notify();
    return { ok: true, belegt: this.getBelegt() };
  }

  // Die Woche einer Person. Für MICH mit den Fenstern (zum Bearbeiten) und allen Titeln, jeder
  // Block mit `indizes`; für Freunde nur die Zeit (Runde 11, D5: kein Titel, kein Schloss) und
  // dazu `meetZeiten` — die Zeitfenster ihrer zugesagten Meets der nächsten sieben Tage, ohne
  // Titel, Ort oder Leute; für alle anderen nichts. Gerechnet in projections.js busyWoche und
  // meetZeiten, für beide Gateways gleich.
  getBelegtWoche(personId = ME) {
    const eigen = !personId || personId === ME;
    if (eigen) {
      const fenster = this.getBelegt();
      return {
        ok: true, eigen: true, sichtbar: true,
        tage: busyWoche(fenster, { eigen: true }), fenster, jetzt: belegtJetzt(fenster), meetZeiten: [],
      };
    }
    const person = this.state.people.find((entry) => entry.id === personId);
    if (!person) return { ok: false, eigen: false, sichtbar: false, tage: [], fenster: null, jetzt: null, meetZeiten: [] };
    if (!this.busySichtbarVon(person)) {
      return { ok: true, eigen: false, sichtbar: false, tage: [], fenster: null, jetzt: null, meetZeiten: [] };
    }
    const fenster = busyFuerFreunde(person.belegt);
    return {
      ok: true, eigen: false, sichtbar: true,
      // `fenster` bleibt null: nach draußen gehen ausschließlich die Blöcke.
      tage: busyWoche(fenster), fenster: null, jetzt: belegtJetzt(fenster),
      // Im Gerät liegen alle Meets; herausgegeben wird davon nur die Zeit (wie meet_zeiten_sicht, 0041).
      meetZeiten: meetZeiten(meetZeitenRoh(this.state.meets, personId)),
    };
  }

  // --- Runde 7 (E5): „Hast du Zeit?" — die flüchtige Frage -------------------------------
  // Sie ist bewusst KEINE Nachricht: kein Eintrag im Raum, kein Verlauf, keine Spur. Wer
  // nicht antwortet, hat nichts liegen lassen — nach zwei Stunden war sie einfach nie da.
  fragenListe() {
    if (!Array.isArray(this.state.fragen)) this.state.fragen = [];
    return this.state.fragen;
  }

  // Abgelaufene wirklich löschen, nicht nur ausblenden: „vergeht von selbst" heißt vergehen.
  fragenAufraeumen(jetzt = Date.now()) {
    const vorher = this.fragenListe().length;
    // Zurückgenommene bleiben bis zum Ende ihrer Stunde — sie zählen für die Grenze (frageZaehltNoch).
    this.state.fragen = this.fragenListe().filter((frage) => frageZaehltNoch(frage, jetzt));
    if (this.state.fragen.length === vorher) return false;
    this.persist();
    clearTimeout(this.fragenNachricht);
    this.fragenNachricht = setTimeout(() => { this.fragenNachricht = null; this.notify(); }, 0);
    this.fragenNachricht?.unref?.();
    return true;
  }

  // Eine Uhr auf die nächste ablaufende Frage — damit sie vor den Augen verschwindet und nicht
  // erst beim nächsten Antippen.
  fragenUhrStellen() {
    clearTimeout(this.fragenUhr);
    this.fragenUhr = null;
    const naechste = this.fragenListe().reduce((min, f) => (f.bis && f.bis < min ? f.bis : min), Infinity);
    if (!Number.isFinite(naechste)) return;
    this.fragenUhr = setTimeout(() => {
      this.fragenUhr = null;
      this.fragenAufraeumen();
      this.fragenUhrStellen();
    }, Math.max(0, naechste - Date.now()) + 250);
    this.fragenUhr?.unref?.();
  }

  zielSchluessel(ziel = {}) {
    if (ziel.crewId) return `c:${ziel.crewId}`;
    if (ziel.personId) return `p:${ziel.personId}`;
    return '';
  }

  frageDarfIch(ziel = {}) {
    const schluessel = this.zielSchluessel(ziel);
    if (!schluessel) return { ok: false, grund: 'ziel', wiederInMs: 0 };
    if (ziel.personId === ME) return { ok: false, grund: 'ziel', wiederInMs: 0 };
    this.fragenAufraeumen();
    const meine = this.fragenListe().filter((frage) => frage.vonId === ME);
    return frageErlaubt(meine, schluessel);
  }

  frageStellen(ziel = {}) {
    const erlaubt = this.frageDarfIch(ziel);
    if (!erlaubt.ok) return { ok: false, ...erlaubt };
    const jetzt = Date.now();
    const frage = {
      id: this.newId('frage'),
      vonId: ME,
      anId: ziel.personId || null,
      crewId: ziel.crewId || null,
      zielSchluessel: this.zielSchluessel(ziel),
      at: jetzt,
      bis: jetzt + FRAGE_GUELTIG_MS,
      antwort: null,
      antwortAt: 0,
    };
    this.fragenListe().push(frage);
    this.notify();
    this.fragenUhrStellen();
    return { ok: true, frage };
  }

  getFragen() {
    this.fragenAufraeumen();
    const meine = this.state.crews.filter((crew) => (crew.memberIds || []).includes(ME)).map((crew) => crew.id);
    const anMich = (frage) => frage.anId === ME || (frage.crewId && meine.includes(frage.crewId) && frage.vonId !== ME);
    const neueste = (a, b) => b.at - a.at;
    const sichtbar = this.fragenListe().filter((frage) => frageGueltig(frage) && !this.isBlocked(frage.vonId));
    return {
      erhalten: sichtbar.filter(anMich).sort(neueste),
      gestellt: sichtbar.filter((frage) => frage.vonId === ME).sort(neueste),
    };
  }

  frageBeantworten(frageId, antwort) {
    this.fragenAufraeumen();
    const frage = this.fragenListe().find((entry) => entry.id === frageId);
    if (!frage) return { ok: false, grund: 'unbekannt' };
    if (!frageGueltig(frage)) return { ok: false, grund: 'abgelaufen' };
    if (frage.vonId === ME) return { ok: false, grund: 'fremd' };
    if (!FRAGE_ANTWORTEN.includes(antwort)) return { ok: false, grund: 'antwort' };
    frage.antwort = antwort;
    frage.antwortAt = Date.now();
    // Ein „ja" setzt bewusst NICHT automatisch FREE: wer frei ist, sagt das selbst — sonst
    // stünde man auf einmal für alle Freunde frei da, weil man einer Person geantwortet hat.
    this.notify();
    return { ok: true };
  }

  // Nicht löschen, sondern markieren: unsichtbar für alle, aber sie zählt für die Stundengrenze.
  frageZuruecknehmen(frageId) {
    const frage = this.fragenListe().find((entry) => entry.id === frageId && entry.vonId === ME && !entry.zurueckgenommen);
    if (!frage) return { ok: false, grund: 'unbekannt' };
    frage.zurueckgenommen = true;
    this.notify();
    return { ok: true };
  }

  // --- Runde 7 (A4/A5): EINE Chatliste ---------------------------------------------------
  getChats() {
    this.meetChatsAufraeumen();
    return chatEintraege({
      me: ME,
      settings: this.getSettings(),
      people: this.getPeople(),
      crews: this.getCrews(),
      meets: this.meineMeets(),
      raumVon: (roomId) => this.roomFromId(roomId),
    });
  }

  // Runde 8 (R8-6): die Chats hinter „Vergangene Chats" — dieselbe Form wie getChats().
  getVergangeneChats() {
    this.meetChatsAufraeumen();
    return vergangeneMeetChats({
      me: ME,
      people: this.getPeople(),
      meets: this.meineMeets(),
      raumVon: (roomId) => this.roomFromId(roomId),
    });
  }

  // Ausdrücklich { mine: true }: ohne Kontext liefert getMeets ALLE Meets — im Demo-Bestand
  // fällt das nicht auf, im Server-Modus stünden fremde Meet-Chats in meiner Liste.
  meineMeets() {
    return [
      ...this.getMeets({ context: { mine: true }, direction: 'upcoming' }),
      ...this.getMeets({ context: { mine: true }, direction: 'history' }),
    ];
  }

  // Runde 8 (R8-6): Ein vergangener Meet-Chat wird sieben Tage nach dem Meet gelöscht —
  // aufgeräumt beim LESEN, damit es auch nach einer Woche geschlossener App stimmt (dieselbe
  // Haltung wie beim Frei-Zurücksetzen). Das Meet selbst bleibt im Verlauf; nur sein Chat geht.
  // Kein notify: das Aufräumen passiert mitten im Zeichnen.
  // Runde 11 (B7): Ein ABGESAGTES Meet ist sofort abgelaufen (projections.js meetChatAbgesagt) —
  // sein Chat geht damit denselben Weg wie ein sieben Tage alter. Hier steht dafür kein eigener
  // Fall; die Regel kommt aus der einen Funktion.
  meetChatsAufraeumen(jetzt = Date.now()) {
    let geloescht = false;
    for (const meet of this.state.meets) {
      if (meet.crewId || !meet.roomId || meet.roomId !== roomIdForMeet(meet.id)) continue;
      if (!meetChatAbgelaufen(meet, jetzt)) continue;
      const raumId = meet.roomId;
      if (!(this.state.messages[raumId] || []).length && !(this.state.roomPolls?.[raumId] || []).length) continue;
      delete this.state.messages[raumId];
      delete this.state.roomRead[raumId];
      if (this.state.roomPolls) delete this.state.roomPolls[raumId];
      geloescht = true;
    }
    if (geloescht) this.persist();
    return geloescht;
  }

  // Runde 8 (R8-6): Antwort auf „Gruppe nehmen oder eigener Chat" nach dem Anlegen
  // (publishDraft → gruppeWaehlbar).
  //   wahl 'gruppe' → das Meet gehört ab jetzt der Gruppe; sein Chat ist der Gruppenchat.
  //   wahl 'eigen'  → es bleibt beim eigenen Meet-Chat.
  // Die Gruppe wird HIER noch einmal ermittelt, nicht aus der Oberfläche übernommen — eine
  // Gruppe, die inzwischen anders aussieht, bekommt das Meet nicht.
  // → { ok, roomId } | { ok:false, grund:'keinMeet'|'wahl'|'schonGruppe'|'keineGruppe'|'schonGeschrieben' }
  meetChatWaehlen(meetId, wahl) {
    const meet = this.getMeet(meetId);
    if (!meet) return { ok: false, grund: 'keinMeet' };
    if (wahl !== 'gruppe' && wahl !== 'eigen') return { ok: false, grund: 'wahl' };
    if (meet.crewId) return wahl === 'gruppe' ? { ok: true, roomId: roomIdForCrew(meet.crewId) } : { ok: false, grund: 'schonGruppe' };
    if (wahl === 'eigen') return { ok: true, roomId: meet.roomId || roomIdForMeet(meet.id) };
    const crewId = gruppeMitGenau(this.getCrews(), meet.personIds, ME);
    if (!crewId) return { ok: false, grund: 'keineGruppe' };
    // Hat im eigenen Chat schon jemand geschrieben, wird nichts verschoben — sonst wären die
    // Nachrichten weg.
    const eigenerRaum = meet.roomId;
    if (eigenerRaum && (this.state.messages[eigenerRaum] || []).length) return { ok: false, grund: 'schonGeschrieben' };
    meet.crewId = crewId;
    delete meet.personIds;
    delete meet.roomId;
    if (eigenerRaum) {
      delete this.state.messages[eigenerRaum];
      delete this.state.roomRead[eigenerRaum];
    }
    this.notify();
    return { ok: true, roomId: roomIdForCrew(crewId) };
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
    // Runde 6 (C2): `at` ist der Zeitpunkt der Lage. Im Server-Modus kommt er aus der Tabelle standorte;
    // in der Demo aus `vorMin`, damit „jetzt" und „vor 20 Min" überhaupt vorkommen.
    // Runde 7 (F9): Ein geteilter Standort trägt seine GENAUIGKEIT in Metern mit. Er liegt auf
    // 0,001° gerundet im Gerät (≈ 100 m) — die Karte darf daraus keinen Punkt machen, der eine
    // Genauigkeit vortäuscht, die es nie gab.
    const standort = person.sharesLocation && hatLage(lage)
      ? {
        lat: lage.lat,
        lon: lage.lon,
        // Runde 11 (C4): Hat die Person auf meine Anfrage geantwortet, ist ihre Lage so frisch wie die Antwort.
        at: Math.max(Date.now() - (Number(lage.vorMin) || 0) * 60000, Number(this.state.standortAntworten?.[person.id]) || 0),
        genauigkeitM: genauigkeitVon(lage, 'geteilt'),
      }
      : null;
    // Runde 8 (R8-39): Busy sehen Freunde immer. Runde 11 (D5): nur noch die Zeit, ohne Titel.
    const belegt = this.busySichtbarVon(person) ? busyFuerFreunde(person.belegt) : [];
    // Runde 11 (B7): „Frei" hat auch bei den ANDEREN ein Ende. Gerechnet wird beim Lesen (nicht
    // beim Laden), damit eine App, die über die Grenze hinweg offen bleibt, beim nächsten
    // Zeichnen die Wahrheit zeigt. Im Gerät gibt es keine fremde Einstellung — die Grenze
    // entsteht aus dem Anker (projections.js freiFuerAndere); am Server steht sie in der Zeile.
    const free = freiFuerAndere(person.free);
    return { ...person, free, standort, belegt, activeMeetId: person.showsActivity && activeMeet ? activeMeet.id : null };
  }

  // Runde 8 (R8-39): Wer sieht Busy? Freunde — und nur sie. Blockierte sehen ohnehin nichts.
  busySichtbarVon(person) {
    return Boolean(person) && person.friend !== false && !this.isBlocked(person.id);
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
      // Runde 8 (R8-63): Das Foto der Anfrage wird das Foto der neuen Freundin.
      ...(request.photo ? { photo: request.photo } : {}),
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
      ...(person.photo ? { photo: person.photo } : {}),
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
    // Runde 11 (B7): Auch hier zählt nur ein „frei", das noch gilt — sonst stünde an der Gruppe
    // „3 frei", während in der Liste niemand mehr grün leuchtet. Dieselbe Regel wie überall.
    const freeCount = crew.memberIds.filter((id) => {
      if (id === ME) {
        return Boolean(this.state.settings.free?.active)
          && !freiAbgelaufen(this.state.settings.free, this.state.settings.freeResetTime);
      }
      const person = this.state.people.find((entry) => entry.id === id);
      return Boolean(freiFuerAndere(person?.free).active);
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

  // Runde 8 (R8-25): „zum Admin machen" — und zurück. Die Regel steht in projections.js
  // (crewAdminGrund) und gilt für beide Gateways gleich.
  setCrewAdmin(crewId, personId, an) {
    const crew = this.state.crews.find((entry) => entry.id === crewId) || null;
    const admins = this.crewAdminIds(crew);
    const grund = crewAdminGrund(crew, admins, ME, personId, Boolean(an));
    if (grund) return { ok: false, reason: grund };
    crew.adminIds = an ? [...new Set([...admins, personId])] : admins.filter((id) => id !== personId);
    this.notify();
    return { ok: true };
  }

  roomFromId(roomId) {
    const refId = roomId.slice(2);
    // v6 A13: dritte Raumart. Die Referenz-ID verrät die Art: c… Crew, m… temporärer
    // Meet-Raum, sonst 1:1. Ein Meet-Raum hat genau die Teilnehmerliste seines Meets.
    const kind = refId.startsWith('c') ? 'crew' : (refId.startsWith('m') ? 'meet' : 'person');
    // v14: Raum-Nachrichten löschen sich nach 14 Tagen; Meet-Daten bleiben.
    const cutoff = toISODate(new Date(Date.now() - 14 * 86400000));
    const all = (this.state.messages[roomId] || []).filter((message) => !this.isBlocked(message.authorId));
    // Runde 11 (C1): was ich mit „Chat löschen" geleert habe, steht für mich nicht mehr da.
    const messages = all.filter((message) => (!message.date || message.date >= cutoff) && nachGeleert(message, this.state.settings, roomId));
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

  // Runde 11 (C1): optionen.replyTo — die Id der zitierten Nachricht. Sie muss im selben Raum
  // stehen (wie auf dem Server, Migration 0042); sonst geht die Nachricht ohne Zitat raus.
  sendMessage(roomId, text, optionen = {}) {
    const trimmed = (text || '').trim();
    if (!trimmed) return;
    const antwort = optionen?.replyTo && (this.state.messages[roomId] || []).some((m) => m.id === optionen.replyTo)
      ? String(optionen.replyTo) : null;
    this.appendMessage(roomId, {
      id: this.newId('msg'), authorId: ME, kind: 'text', text: trimmed,
      date: toISODate(now()), time: `${now().getHours()}:${String(now().getMinutes()).padStart(2, '0')}`,
      at: now().getTime(),
      ...(antwort ? { replyTo: antwort } : {}),
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
      // Wie der Server: der volle Zeitstempel — nur, wenn der Eintrag keine eigene Zeit mitbringt.
      ...(eintrag.date || eintrag.time ? {} : { at: jetzt.getTime() }),
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

  // Runde 8: Übergeben heißt — die Person wird Admin, ich bin es danach nicht mehr. Weitere Admins
  // BLEIBEN Admins. Bis Runde 7 räumte die Demo sie mit ab, während der Server-Weg mich Admin
  // bleiben ließ: zwei Antworten auf dieselbe Handlung (Hausregel 3).
  transferCrewAdmin(crewId, personId) {
    const crew = this.state.crews.find((entry) => entry.id === crewId);
    if (!crew || !crew.memberIds.includes(personId)) return { ok: false, reason: t('Person ist kein Mitglied') };
    const admins = this.crewAdminIds(crew);
    crew.adminIds = [...new Set([...admins.filter((id) => id !== ME), personId])];
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
      // Runde 9 (R9-11): Ein in der Woche gezogener Zeitraum bringt sein Ende mit.
      endTime: (!draft.when?.open && draft.when?.endTime) || undefined,
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
    // Runde 8 (R8-6): Sind GENAU die Leute einer bestehenden Gruppe eingeladen, fragt die
    // Oberfläche danach „Gruppe nehmen oder eigener Chat" (meetChatWaehlen). Bis zur Antwort gilt
    // der eigene Meet-Chat — antwortet niemand, geht nichts verloren. Mit genau einer Person gilt
    // deren Chat (kein roomId, siehe oben), bei jeder anderen Mischung der eigene Meet-Chat.
    const gruppeWaehlbar = meet.crewId ? null : gruppeMitGenau(this.getCrews(), meet.personIds, ME);
    this.state.meets.push(meet);
    delete this.state.drafts[id];
    this.notify();
    return { ok: true, meetId: meet.id, gruppeWaehlbar };
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

  // --- Runde 8 (R8-50/R8-66): Find ------------------------------------------------------------
  // Der Beispielbestand (seed/find.js) wird bei jedem Lesen für JETZT gebaut: Seine Events hängen
  // am laufenden Wochenende — ein Tab, der über Nacht offen bleibt, zeigt morgen die richtigen.
  // Score, Sortierung und das Wegfallen vergangener Events rechnet projections.js (findListe),
  // für beide Gateways dieselbe Regel.
  getFindEintraege() {
    const s = this.state.settings;
    return findListe(findBeispiele(now()), {
      interessen: s.interests || [],
      lernen: s.lernen || null,
      // Runde 11 (C2): „Nah bei dir" rechnet vom selben Punkt wie die Entfernung, die Find anzeigt
      // (getMyLocation) — vorher vom gerundeten Vorschlags-Standort dieses Geräts, also zwei Wahrheiten
      // über „wo bin ich". Ohne eigene Lage gilt wie bisher die Mitte der Vorschläge (Zuhause).
      mitte: this.getMyLocation() || this.getVorschlagsMitte(),
      jetzt: Date.now(),
    });
  }

  // Im Demo-Modus gibt es kein Konto (getAccountInfo: echt false) — und damit niemanden, der
  // Einträge anlegen dürfte. Admin ist ein echtes Konto, entschieden auf dem Server (0038).
  istAdmin() {
    return false;
  }

  addFindEintrag() {
    return { ok: false, reason: 'keinAdmin' };
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
  // für jede Karte gleich. Nur mit Freigabe.
  //
  // Runde 7, Welle 2 (M1): Die REIHENFOLGE ist umgedreht. Bis hierher gewann der Vorschlags-Raster
  // (orte-vorschlaege.js, 0,01° → gerechnete 787 m) — die App zeigte mir also einen fast
  // kilometerbreiten Kreis als „hier bin ich", obwohl das Gerät es viel genauer weiß. Dieser
  // Raster ist absichtlich grob,
  // aber aus einem ANDEREN Grund: er geht an die Orte-Funktion, also an einen Dritten. Für die
  // eigene Karte ist er die falsche Quelle. Jetzt gilt: der echte Gerätestandort zuerst, der
  // Raster nur noch als Rückfall — dann ehrlich mit dem Halbmesser, den dieses Raster wirklich
  // hat (0,01° → gerechnete 787 m, GENAUIGKEIT_M.geraet; hier stand bis Welle 3 „1000 m", eine
  // Zahl, die niemand gerechnet hatte) —, das Zuhause zuletzt.
  getMyLocation() {
    const halbeStunde = 30 * 60000;
    const s = this.state.settings || {};
    // `quelle` bleibt wie bisher benannt ('geteilt' = die Lage, die auch Freunde sehen;
    // 'geraet' = der grobe Vorschlags-Raster), damit Ansichten nichts umlernen müssen.
    if (s.location?.use && hatLage(s.standort)) {
      return {
        lat: s.standort.lat, lon: s.standort.lon, quelle: 'geteilt',
        genau: Date.now() - (s.standort.at || 0) < halbeStunde,
        genauigkeitM: genauigkeitVon(s.standort, 'geteilt'),
      };
    }
    const geraet = vorschlagsMitte(null);
    if (geraet && geraet.quelle === 'standort') {
      return {
        lat: geraet.lat, lon: geraet.lon, quelle: 'geraet',
        genau: Date.now() - (geraet.am || 0) < halbeStunde,
        genauigkeitM: genauigkeitVon(geraet, 'geraet'),
      };
    }
    // Aus dem Standort übernommen: der Ort trägt seine gerechneten 787 m, genauigkeitVon gibt sie weiter.
    // Eine über die Suche eingetragene Adresse ist ein echter Punkt ohne Zahl, also kein Kreis.
    if (s.location?.use && hatLage(s.homeAddress)) {
      return { lat: s.homeAddress.lat, lon: s.homeAddress.lon, genau: false, quelle: 'zuhause', genauigkeitM: genauigkeitVon(s.homeAddress, 'zuhause') };
    }
    return null;
  }

  // --- Runde 7, Welle 2 (M1): der eigene Standort, so genau wie das Gerät ihn hergibt ---------
  // Die Demo verschickt nichts — aber sie ist die GERÄTE-Datenschicht, und „wo bin ich" muss hier
  // dieselbe Antwort geben wie am Server. Deshalb dieselben drei Schritte wie im SupabaseGateway:
  // einmal fragen, danach mithören, und nur bei echter Bewegung übernehmen.
  //
  // Runde 7, Welle 3: `sofort` heißt „jemand hat gerade getippt" — dann darf das Gerät fragen.
  // Ohne Zutun (App-Start, Wechsel in den Vordergrund) wird NUR gemessen, wenn die Erlaubnis
  // schon da ist; sonst geschieht hier gar nichts, und niemand sieht eine Frage, die er nicht
  // ausgelöst hat (projections.standortErlaubnisSchonDa).
  standortSenden({ sofort = false } = {}) {
    const geo = globalThis.navigator?.geolocation;
    if (!this.state.settings.location?.use || !geo) return;
    if (sofort) { this.standortJetztHolen(true); return; }
    standortErlaubnisSchonDa().then((schonDa) => { if (schonDa) this.standortJetztHolen(false); });
  }

  // Ab hier wird wirklich gemessen. Hierher kommt nur, wer getippt hat oder die Erlaubnis
  // längst erteilt hat — deshalb steht auch die Wache (watchPosition) erst hinter dieser Tür.
  standortJetztHolen(sofort = false) {
    const geo = globalThis.navigator?.geolocation;
    if (!this.state.settings.location?.use || !geo) return;
    if (!sofort && Date.now() - (this.standortGesetztAm || 0) < 10 * 60000) { this.standortBeobachten(); return; }
    geo.getCurrentPosition(
      (position) => { standortErlaubnisMerken(); this.standortAusPosition(position); },
      () => { this.standortGesetztAm = 0; },
      { enableHighAccuracy: true, timeout: 15000, maximumAge: 60000 },
    );
    this.standortBeobachten();
  }

  standortAusPosition(position) {
    if (!this.state.settings.location?.use) return;
    const lage = lageAusPosition(position);
    if (!lage) return;
    const alt = this.state.settings.standort;
    const jetzt = lage.at;
    // Genaue Koordinaten wackeln bei jedem Messwert. Übernommen wird erst ab echter Bewegung —
    // oder wenn seit zehn Minuten nichts kam, damit „vor x Min" stimmt.
    if (!lageSendenLohnt(alt, lage, this.standortGesetztAm, jetzt)) return;
    this.standortGesetztAm = jetzt;
    this.state.settings.standort = lage;
    this.persist();
    this.notify();
  }

  // WAS DAS KOSTET (Runde 7, Welle 3, Mangel 9 — in Welle 2 sagte es niemand): `enableHighAccuracy`
  // ist seit M1 in BEIDEN Aufrufen true und `maximumAge` von 5 min auf 60 s herunter. Das heißt
  // GPS, solange die App offen ist und Standort-Teilen an ist — nicht nur Funkzellen. Die
  // 25-m-Schwelle (projections.lageWeitGenugAnders) spart NETZVERKEHR, keinen Strom; der Empfänger
  // misst trotzdem. Die Abwägung ist bewusst so gefallen: Diese App soll sagen können, in welchem
  // Lokal jemand sitzt — auf 100 m kann sie das nicht, und eine Funktion, die ihre eigene Auskunft
  // bis zur Nutzlosigkeit abschwächt, kostet auch Strom, nur ohne Gegenwert. Wer es billiger will,
  // hat zwei Stellschrauben und sonst keine: die Wache beenden, wenn die App in den Hintergrund
  // geht (standortWacheBeenden), und `maximumAge` hoch. Im nativen Gehäuse ist das NICHT gemessen.
  //
  // DIE ZAHLEN, GENAU (Welle 3): einmaliges Fragen `maximumAge: 60000` (60 s, vorher 5 min), die
  // Wache hier `maximumAge: 15000` (15 s). Bis Welle 3 stand über beiden nur die 60 — die
  // günstigere der zwei. Wer den Verbrauch senken will, dreht an DIESER Zeile, nicht an der 60.
  standortBeobachten() {
    const geo = globalThis.navigator?.geolocation;
    if (!geo?.watchPosition || this.standortWache != null) return;
    if (!this.state.settings.location?.use) return;
    try {
      this.standortWache = geo.watchPosition(
        (position) => { standortErlaubnisMerken(); this.standortAusPosition(position); },
        () => {},
        { enableHighAccuracy: true, maximumAge: 5000, timeout: 30000 },
      );
    } catch { this.standortWache = null; }
  }

  standortWacheBeenden() {
    const geo = globalThis.navigator?.geolocation;
    if (this.standortWache == null) return;
    try { geo?.clearWatch?.(this.standortWache); } catch { /* egal */ }
    this.standortWache = null;
  }

  // --- Runde 11 (C4, D8): frischen Standort anfragen (Vertrag: repository.js) ---------------------
  // Im Gerät gibt es kein zweites Telefon. Die Demo spielt das Gerät der Freundin nach: Es antwortet
  // nach wenigen Sekunden mit einer frischen Lage — DERSELBE Ort, neue Zeit; erfunden wird kein Ort.
  // Wessen Lage schon Stunden alt ist (Handy aus, kein Netz), antwortet nicht — so sieht man in der
  // Demo auch „noch keine Antwort". Dieselben Grenzen wie am Server (0044): Freund, nicht blockiert,
  // teilt mit mir; je Paar eine Anfrage in 10 Minuten.
  standortAnfragen(personId) {
    const person = this.state.people.find((p) => p.id === personId);
    if (!person || person.friend === false || this.isBlocked(personId)) return Promise.resolve({ ok: false, grund: 'keinFreund' });
    if (!this.getPerson(personId)?.standort) return Promise.resolve({ ok: false, grund: 'teiltNicht' });
    const jetzt = Date.now();
    const alt = this.state.standortAnfragen?.[personId];
    if (alt && jetzt - alt.at < 10 * 60000) return Promise.resolve({ ok: true, neu: false, at: alt.at, beantwortet: alt.beantwortet || null });
    const eintrag = { at: jetzt, beantwortet: null };
    this.state.standortAnfragen = { ...(this.state.standortAnfragen || {}), [personId]: eintrag };
    this.notify();
    const stumm = (Number(seedStandorte[personId]?.vorMin) || 0) >= DEMO_STUMM_AB_MIN;
    if (!stumm) setTimeout(() => this.standortAnfrageDemoAntwort(personId, jetzt), DEMO_ANTWORT_MS);
    return Promise.resolve({ ok: true, neu: true, ...eintrag });
  }

  standortAnfrageDemoAntwort(personId, at) {
    const anfrage = this.state.standortAnfragen?.[personId];
    if (!anfrage || anfrage.at !== at || anfrage.beantwortet) return;
    const jetzt = Date.now();
    this.state.standortAntworten = { ...(this.state.standortAntworten || {}), [personId]: jetzt };
    this.state.standortAnfragen = { ...this.state.standortAnfragen, [personId]: { ...anfrage, beantwortet: jetzt } };
    this.notify();
  }

  standortAnfrage(personId) {
    const anfrage = this.state.standortAnfragen?.[personId];
    if (!anfrage || Date.now() - anfrage.at > 30 * 60000) return null;
    return { at: anfrage.at, beantwortet: anfrage.beantwortet || null };
  }

  // --- Runde 7, Welle 2 (M1): „genau" oder „nur ungefähr" ------------------------------------
  // Ohne Person: die ganze Einstellung. Mit Person: was DIESE Person von mir sieht.
  // Ohne Person: die ganze Einstellung — auch wenn NICHTS im Bestand liegt (dann 'genau', leere
  // Ausnahmen; standortGenauigkeitNorm wirft Unsinn weg). Mit Person: was DIESE Person von mir
  // sieht; ME wird mitgegeben, weil die Antwort für mich selbst immer 'genau' ist (0034).
  getStandortGenauigkeit(personId) {
    const roh = this.state.settings.standortGenauigkeit;
    return personId ? standortGenauigkeitFuer(roh, personId, ME) : standortGenauigkeitNorm(roh);
  }

  setStandortGenauigkeit(modus) {
    if (modus !== 'genau' && modus !== 'ungefaehr') return { ok: false, grund: 'modus' };
    const alt = standortGenauigkeitNorm(this.state.settings.standortGenauigkeit);
    this.state.settings.standortGenauigkeit = { ...alt, modus };
    this.persist();
    this.notify();
    return { ok: true, genauigkeit: this.getStandortGenauigkeit() };
  }

  // modus null nimmt die Ausnahme zurück — danach gilt wieder, was für alle gilt. Ohne das
  // wäre „doch wieder wie alle anderen" nicht sagbar, und die Liste liefe voll.
  setStandortGenauigkeitFuer(personId, modus) {
    if (!personId) return { ok: false, grund: 'person' };
    if (modus != null && modus !== 'genau' && modus !== 'ungefaehr') return { ok: false, grund: 'modus' };
    const alt = standortGenauigkeitNorm(this.state.settings.standortGenauigkeit);
    const ausnahmen = { ...alt.ausnahmen };
    if (modus == null) delete ausnahmen[personId];
    else ausnahmen[personId] = modus;
    this.state.settings.standortGenauigkeit = { ...alt, ausnahmen };
    this.persist();
    this.notify();
    return { ok: true, genauigkeit: this.getStandortGenauigkeit() };
  }

  // Was sieht diese Person WIRKLICH von mir? Ohne diese Antwort wäre die Einstellung eine Zusage
  // ohne Nachweis (Hausregel 9): man könnte sie umlegen und nirgends sehen, dass sie wirkt.
  // Runde 7, Welle 3 (Mangel 2, Hausregel 3): MICH SELBST sehe ich immer und immer genau.
  // Genau das sagt der Server — 0025 private.teilt_standort_mit beginnt mit
  // `besitzer = betrachter`, 0034 private.standort_genau_fuer ebenso. Bis Welle 2 sagte das
  // Gerät etwas anderes (gemessen: eine Ausnahme auf die eigene Person machte die eigene Lage
  // grob), und damit gab es zwei Wahrheiten über dieselbe Sache. Geprüft wird zuerst, ob es
  // überhaupt eine Zeile gibt: ohne Zeile sieht auch der Server nichts.
  standortFuerFreund(personId) {
    const s = this.state.settings || {};
    if (!hatLage(s.standort)) return null;
    if (personId === ME) {
      return {
        lat: s.standort.lat, lon: s.standort.lon, at: s.standort.at || 0,
        genauigkeitM: genauigkeitVon(s.standort, 'geteilt'), genau: true,
      };
    }
    if (!s.location?.use) return null;
    const teilt = s.location.shareMode === 'alle'
      || (s.location.shareMode === 'ausgewaehlte' && (s.location.shareIds || []).includes(personId));
    if (!teilt) return null;
    const genau = this.getStandortGenauigkeit(personId) === 'genau';
    const lage = genau ? s.standort : lageGroeber(s.standort);
    return {
      lat: lage.lat, lon: lage.lon, at: s.standort.at || 0,
      genauigkeitM: genauigkeitVon(lage, 'geteilt'), genau,
    };
  }

  // --- Runde 7 (H2): Zuhause ------------------------------------------------------------
  // FEHLT es, ist die Antwort null — und die Oberfläche sagt das ehrlich. Es wird nie eine
  // Adresse erfunden (Hausregel 8; es gab schon einmal eine erfundene Adresse als „Zuhause").
  getHomeAddress() {
    const ort = this.state.settings.homeAddress;
    return hatLage(ort) ? ort : null;
  }

  setHomeAddress(ort) {
    if (!hatLage(ort)) return { ok: false, grund: 'koordinaten' };
    const name = String(ort.name || '').trim();
    const quelle = ort.quelle === 'standort' ? 'standort' : 'suche';
    // Aus einer Suche MUSS ein Name kommen — ein namenloser Sucheintrag wäre eine leere Zusage.
    // Aus dem Standort darf er fehlen; dann sagt `quelle`, dass es der aktuelle Standort ist.
    if (!name && quelle !== 'standort') return { ok: false, grund: 'name' };
    const neu = {
      name,
      city: String(ort.city || ort.address || '').trim(),
      lat: ort.lat,
      lon: ort.lon,
      quelle,
      at: Date.now(),
    };
    // Runde 7, Welle 3 (Hausregel 3): dieselbe Klemme wie überall sonst (1 m … 20 km). Hier stand
    // `Math.max(0, Math.round(…))` — eine zweite Regel für dieselbe Sache, durch die eine 0 („auf
    // 0 m genau") und eine 400000 ungeklemmt in den Bestand gekommen wären. null heißt weiterhin
    // „unbekannt": dann steht gar keine Zahl in der Adresse.
    const genau = genauigkeitKlemmen(ort.genauigkeitM);
    if (genau != null) neu.genauigkeitM = genau;
    this.state.settings.homeAddress = neu;
    this.notify();
    return { ok: true, ort: neu };
  }

  // Nur auf Tippen. Der Gerätestandort liefert Koordinaten, keinen Straßennamen — und die App
  // erfindet keinen dazu. Sie merkt sich stattdessen, WOHER der Punkt kommt.
  //
  // Runde 7, Welle 3 (Hausregel 8): Hier stand `genauigkeitM: 1000` — eine getippte Zahl, dieselbe
  // Sorte wie die gelöschte 100. Der Punkt kommt aus dem Raster der Orts-Vorschläge (0,01°), und
  // dessen Halbmesser ist gerechnet: GENAUIGKEIT_M.geraet (787 m). Ändert sich das Raster, ändert
  // sich diese Zahl mit, statt nebenher falsch zu werden.
  setHomeAddressAusStandort() {
    return standortFuerVorschlaegeHolen().then((ergebnis) => {
      if (!ergebnis.ok) return { ok: false, grund: ergebnis.grund || 'unbekannt' };
      return this.setHomeAddress({
        name: '', city: '', lat: ergebnis.lat, lon: ergebnis.lon,
        quelle: 'standort', genauigkeitM: GENAUIGKEIT_M.geraet,
      });
    });
  }

  clearHomeAddress() {
    this.state.settings.homeAddress = null;
    this.notify();
    return { ok: true };
  }

  // --- Routen speichern (0047): die Abholadresse — dieselbe Antwortform wie im Server-Datenweg ----------------
  getAbholadresse() {
    const ort = this.state.abholadresse;
    return hatLage(ort) ? ort : null;
  }

  setAbholadresse(ort) {
    if (!hatLage(ort)) return { ok: false, grund: 'koordinaten' };
    const name = String(ort.name || '').trim();
    if (!name) return { ok: false, grund: 'name' };
    const neu = { name, city: String(ort.city || ort.address || '').trim(), lat: ort.lat, lon: ort.lon, quelle: 'suche', at: Date.now() };
    this.state.abholadresse = neu;
    this.notify();
    return { ok: true, ort: neu };
  }

  clearAbholadresse() {
    this.state.abholadresse = null;
    this.notify();
    return { ok: true };
  }

  // Wo wird jemand für dieses Meet abgeholt? Am Live-Standort nur, wenn die Person das ausdrücklich gewählt hat. Sonst an
  // ihrer Abholadresse — der eigenen, oder der einer Person, die bei MIR eingestiegen ist (fremde Adressen sieht sonst niemand).
  getAbholort(meetId, personId) {
    const zeile = this.ridesVon(meetId)[personId];
    if (zeile?.abholung === 'standort') return this.getLage(personId);
    let ort = null;
    if (personId === ME) ort = this.getAbholadresse();
    else if (zeile?.fahrerId === ME) ort = seedAbholadressen[personId] || null;
    return hatLage(ort) ? { lat: ort.lat, lon: ort.lon, quelle: 'abholadresse', name: ort.name || '', genauigkeitM: null } : null;
  }

  // Die Abholzeit vom Server (0048) gibt es in der Demo nicht: null. Die Anreise rechnet dann selbst, soweit sie alle Halte kennt.
  getAbholzeit() {
    return null;
  }

  setAbholung(meetId, wert) {
    const abholung = wert === 'standort' ? 'standort' : null;
    const zeile = this.ridesVon(meetId)[ME];
    if (anreiseZeile(zeile)?.art !== 'mitfahrt') return { ok: false, reason: 'keineMitfahrt' };
    if ((zeile.abholung || null) !== abholung) { zeile.abholung = abholung; this.notify(); }
    return { ok: true };
  }

  // --- Runde 7 (A6): „Ich bin da" -------------------------------------------------------
  // Reihenfolge und Anzahl. Kein Punktestand, kein Verlauf über Meets hinweg, keine
  // Verspätungsminuten, kein Geld — und nur die eigene Ankunft ist setzbar.
  ankuenfteVon(meetId) {
    if (!this.state.ankuenfte || typeof this.state.ankuenfte !== 'object') this.state.ankuenfte = {};
    if (!this.state.ankuenfte[meetId]) this.state.ankuenfte[meetId] = {};
    return this.state.ankuenfte[meetId];
  }

  getAnkuenfte(meetId) {
    const stempel = this.state.ankuenfte?.[meetId] || {};
    const liste = ankunftListe(stempel).filter((eintrag) => !this.isBlocked(eintrag.personId));
    return {
      liste,
      anzahl: liste.length,
      ichDa: Boolean(stempel[ME]),
      meineZeit: Number(stempel[ME]) || 0,
    };
  }

  setAnkunft(meetId, an = true) {
    const meet = this.getMeet(meetId);
    if (!meet) return { ok: false, reason: 'keinMeet' };
    // Wer abgesagt hat, kommt nicht an. Wer gar nicht eingeladen ist, erst recht nicht.
    const dabei = meet.participation?.[ME] && meet.participation[ME] !== 'no';
    if (!dabei && meet.creatorId !== ME) return { ok: false, reason: 'nichtDabei' };
    const stempel = this.ankuenfteVon(meetId);
    if (an) stempel[ME] = stempel[ME] || Date.now();
    else delete stempel[ME];
    this.notify();
    const nachher = this.getAnkuenfte(meetId);
    return { ok: true, position: nachher.liste.find((e) => e.personId === ME)?.position || null };
  }

  // Runde 5 (E1): Lage einer Person für die Mitfahr-Rechnung. Für andere NUR ihr geteilter Standort —
  // nie eine Adresse. Für mich wie getMyLocation.
  getLage(personId) {
    if (personId === ME) {
      const ich = this.getMyLocation();
      return ich
        ? { lat: ich.lat, lon: ich.lon, quelle: ich.quelle === 'zuhause' ? 'zuhause' : 'geteilt', genauigkeitM: ich.genauigkeitM ?? null }
        : null;
    }
    const standort = this.getPerson(personId)?.standort;
    return hatLage(standort)
      ? { lat: standort.lat, lon: standort.lon, quelle: 'geteilt', genauigkeitM: standort.genauigkeitM ?? null }
      : null;
  }

  // --- Runde 5 (E1): Mitfahren. Je Meet und Person { rolle: 'fahrer'|'mitfahrer'|'selbst', plaetze, fahrerId }.
  ridesVon(meetId) {
    if (!this.ridesStand) this.ridesStand = {};
    if (!this.ridesStand[meetId]) this.ridesStand[meetId] = {};
    return this.ridesStand[meetId];
  }

  // Runde 7 (E6): Eine Zeile sagt die ART der Anreise. `rolle` wird daraus abgeleitet, damit
  // alles, was in Fahrer/Mitfahrer/Selbst denkt, unverändert weiterläuft.
  anreiseVon(meetId, personId) {
    return anreiseZeile(this.ridesVon(meetId)[personId]);
  }

  getRides(meetId) {
    const zeilen = this.ridesVon(meetId);
    const eintraege = Object.entries(zeilen)
      .map(([personId, z]) => [personId, anreiseZeile(z)])
      .filter(([, z]) => Boolean(z))
      .sort((a, b) => (a[1].am || 0) - (b[1].am || 0));
    const fahrer = [];
    const suchen = [];
    const selbst = [];
    const nachArt = { auto: [], oeffi: [], rad: [], fuss: [], selbst: [], mitfahrt: [] };
    for (const [personId, z] of eintraege) {
      nachArt[z.art].push(personId);
      if (z.rolle === 'fahrer') {
        fahrer.push({
          personId,
          plaetze: z.plaetze || 1,
          mitfahrer: eintraege.filter(([, m]) => m.art === 'mitfahrt' && m.fahrerId === personId).map(([id]) => id),
        });
      } else if (z.art === 'mitfahrt' && !z.fahrerId) suchen.push(personId);
      // „Kommt selbst" heißt jetzt auch Öffi, Rad, zu Fuß und Auto ohne freien Platz — alle
      // vier brauchen keine Mitfahrt. Die alte Liste bleibt damit inhaltlich dieselbe Aussage.
      else if (z.rolle === 'selbst') selbst.push(personId);
    }
    return {
      fahrer,
      suchen,
      selbst,
      anreisen: eintraege.map(([personId, z]) => ({ personId, ...z })),
      nachArt,
    };
  }

  // Eigene Anreise. Wer aufhört zu fahren oder weniger Plätze hat, gibt Mitfahrer frei (wie der Server-Trigger).
  rideRolleLokal(meetId, art, plaetze) {
    const zeilen = this.ridesVon(meetId);
    const bisher = anreiseZeile(zeilen[ME]);
    if (art === 'mitfahrt' && bisher?.art === 'mitfahrt') return { geaendert: false };
    if (bisher?.rolle === 'fahrer' && !(art === 'auto' && Number(plaetze) >= 1)) {
      for (const z of Object.values(zeilen)) if (z.fahrerId === ME) z.fahrerId = null;
    }
    if (!art) {
      delete zeilen[ME];
      return { geaendert: true };
    }
    if (art === 'auto') {
      // Ohne Platzangabe fährt man allein — das ist eine gültige Aussage („ich nehme das Auto"),
      // nur eben kein Angebot. Wer Plätze angibt, bietet mit.
      const roh = plaetze === undefined ? bisher?.plaetze : plaetze;
      const n = Number(roh) >= 1 ? Math.min(8, Math.round(Number(roh))) : null;
      zeilen[ME] = { art, plaetze: n, fahrerId: null, am: bisher?.am || Date.now(), rolle: rolleAusAnreise(art, n) };
      if (n) {
        Object.values(zeilen)
          .filter((z) => z.fahrerId === ME)
          .sort((a, b) => (a.am || 0) - (b.am || 0))
          .slice(n)
          .forEach((z) => { z.fahrerId = null; });
      }
      return { geaendert: true, plaetze: n };
    }
    zeilen[ME] = { art, plaetze: null, fahrerId: null, am: Date.now(), rolle: rolleAusAnreise(art, null) };
    return { geaendert: true };
  }

  rideZuordnenPruefen(meetId, mitfahrerId, fahrerId) {
    const meet = this.getMeet(meetId);
    if (!meet) return 'keinMeet';
    const zeilen = this.ridesVon(meetId);
    const bisher = anreiseZeile(zeilen[mitfahrerId]);
    const darf = ME === mitfahrerId || ME === meet.creatorId || (fahrerId && ME === fahrerId) || (!fahrerId && bisher?.fahrerId === ME);
    if (!darf) return 'verboten';
    if (bisher?.rolle === 'fahrer' && ME !== mitfahrerId && ME !== meet.creatorId) return 'verboten';
    if (fahrerId) {
      if (fahrerId === mitfahrerId) return 'verboten';
      const f = anreiseZeile(zeilen[fahrerId]);
      if (f?.rolle !== 'fahrer') return 'keinFahrer';
      const belegt = Object.entries(zeilen).filter(([id, z]) => id !== mitfahrerId && z.fahrerId === fahrerId).length;
      if (belegt >= (f.plaetze || 1)) return 'voll';
    }
    return 'ok';
  }

  rideZuordnenLokal(meetId, mitfahrerId, fahrerId) {
    const zeilen = this.ridesVon(meetId);
    if (anreiseZeile(zeilen[mitfahrerId])?.rolle === 'fahrer') {
      for (const z of Object.values(zeilen)) if (z.fahrerId === mitfahrerId) z.fahrerId = null;
    }
    const abholung = zeilen[mitfahrerId]?.abholung || null;
    zeilen[mitfahrerId] = { art: 'mitfahrt', plaetze: null, fahrerId: fahrerId || null, am: Date.now(), rolle: 'mitfahrer', abholung };
  }

  // Demo: Mitfahrten liegen im gespeicherten Zustand (localStorage), damit sie ein Neuladen überleben.
  get ridesStand() { return this.state.rides; }
  set ridesStand(wert) { this.state.rides = wert; }

  // Runde 7 (E6): der neue Weg — die ART der Anreise.
  setAnreise(meetId, { art = null, plaetze } = {}) {
    if (!this.getMeet(meetId)) return { ok: false, reason: 'keinMeet' };
    if (art && !ANREISE_ARTEN.includes(art)) return { ok: false, reason: 'art' };
    const { geaendert } = this.rideRolleLokal(meetId, art, plaetze);
    if (geaendert) this.notify();
    return { ok: true };
  }

  // Altaufrufer: dieselbe Wirkung über die alten Rollen. Sie bleiben gültig, damit bestehende
  // Ansichten während des Umbaus nicht brechen — übersetzt wird an genau einer Stelle.
  setRide(meetId, { rolle = null, plaetze } = {}) {
    if (rolle && !['fahrer', 'mitfahrer', 'selbst'].includes(rolle)) return { ok: false, reason: 'rolle' };
    const art = rolle === 'fahrer' ? 'auto' : (rolle === 'mitfahrer' ? 'mitfahrt' : (rolle === 'selbst' ? 'selbst' : null));
    // „fahrer" hieß immer: ich biete mit. Ohne Zahl ist das mindestens ein Platz.
    const sitze = rolle === 'fahrer' ? (Number(plaetze) >= 1 ? plaetze : 1) : plaetze;
    return this.setAnreise(meetId, { art, plaetze: sitze });
  }

  // Runde 11 (C3): Echte Routen gibt es nur angemeldet (Funktion `route`, Schlüssel auf dem Server).
  // Die Demo hat kein Konto — sie sagt das ehrlich, und die Anreise rechnet geschätzt.
  routeFragen() {
    return Promise.resolve({ ok: false, reason: 'ohneKonto' });
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
