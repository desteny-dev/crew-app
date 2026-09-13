// SupabaseGateway — dieselbe Schnittstelle wie der DemoDataGateway, aber echte, geteilte Daten.
//
// Der Datenvertrag (repository.js) ist SYNCHRON: Screens rufen `repo.getMeets()` auf und
// bekommen sofort ein Array, `repo.createCrew()` liefert sofort die neue Gruppe zurück.
// Supabase ist asynchron. Diese Klasse schlägt die Brücke und macht das an genau einer Stelle:
//
//   Lesen   → immer aus `this.state`, einer vollständigen Kopie dessen, was DIESER Nutzer
//             sehen darf. Sie wird beim Start geladen (`ready()`) und danach von Realtime
//             aktuell gehalten. Lesen erzeugt nie Netzverkehr.
//   Schreiben → zuerst lokal (die Oberfläche reagiert sofort), dann in einer Warteschlange
//             an den Server. IDs werden dafür im Client erzeugt, damit die Rückgabe schon
//             die endgültige ID trägt. Schlägt der Server fehl, wird neu geladen — die
//             optimistische Änderung verschwindet also wieder, statt zu lügen.
//
// Was NICHT hier entschieden wird: wer was sehen darf. Das entscheidet die Datenbank (RLS,
// Prüfschritt T1). Diese Klasse zeigt nur, was der Server herausgibt.
//
// Der DemoDataGateway bleibt unangetastet und lauffähig — er ist der Offline-/Prüfmodus.

import { CrewRepository } from './repository.js';
import { ME } from './ids.js';
import { toISODate, now } from '../core/dates.js';
import { mitAbstand } from '../engine/suggestion-engine.js';
import { hatLage } from '../core/entfernung.js';
import { t as tx, sprache as aktiveSprache } from '../core/sprache.js';

import {
  OrteNachlader, vorschlagsMitte, standortFuerVorschlaegeHolen, vorschlagsStandortVergessen, vorschlagsStandortAuffrischen,
  vorschlagsFoto,
} from './orte-vorschlaege.js';
import { zeichenNachlernen, namenAusEinstellungen } from './zeichen-lernen.js';
import { uebersetzeAuthFehler } from '../core/auth-texte.js';
import { schliesseMitteilung, raumMitteilungsTag } from '../core/pwa.js';
import {
  isSharedWith, projectProfile, normalizeInviteCode, isInviteCodeFormat,
  sortAndFilterMeets, meetMatchesContext, uebernimmOrt,
} from './projections.js';
// Der Entdecken-Katalog ist redaktioneller App-Inhalt, keine Nutzerdaten — er wird
// mitgeliefert, nicht gespeichert. Echte Ortssuche kommt mit der Karte (T5).
import { seedSuggestions } from './seed/discover.js';

const NUDGE_COOLDOWN_MS = 5 * 60000;
const VARIANT_COOLDOWN_MS = 20000;
const LOCAL_KEY = 'crew-supabase-local-v1'; // Entwürfe und Cooldowns: bewusst nur auf diesem Gerät.
// Zwischenspeicher für Einstellungen, deren Speichern der Server noch nicht bestätigt hat.
const SETTINGS_KEY = 'crew-settings-ungesichert-v1';

function uuid() {
  if (globalThis.crypto?.randomUUID) return globalThis.crypto.randomUUID();
  // Fallback für alte Umgebungen; Form genügt Postgres' uuid-Typ.
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, (c) => {
    const r = Math.random() * 16 | 0;
    return (c === 'x' ? r : (r & 0x3 | 0x8)).toString(16);
  });
}

function hhmm(date) {
  // Gleiche Form wie im DemoDataGateway: Stunde ohne führende Null, Minute mit.
  return `${date.getHours()}:${String(date.getMinutes()).padStart(2, '0')}`;
}

export class SupabaseGateway extends CrewRepository {
  // client: Supabase-Client MIT Sitzung · engine: RulesEngine
  // onError: wird bei fehlgeschlagenen Server-Schreibvorgängen gerufen (Toast)
  constructor(engine, { client, userId, authUser, onError, onToast } = {}) {
    super();
    this.engine = engine;
    this.client = client;
    this.myUid = userId;
    // Das echte Konto aus der Sitzung. E-Mail und Anmeldeart stehen NUR hier — nicht in
    // den Einstellungen, wo sie jemand hinschreiben könnte (Auftrag §1.7).
    this.authUser = authUser || null;
    this.onError = onError || (() => {});
    this.onToast = onToast || (() => {});
    this.listeners = new Set();
    this.queue = Promise.resolve();
    this.pendingWrites = 0;
    // Zählt jede Änderung mit. Ein Ladevorgang, während dessen gezählt wurde, hat einen
    // überholten Stand geholt und darf ihn nicht einsetzen (siehe _hydrate).
    this.writeSeq = 0;
    this.abgemeldet = false;
    // Zusammengefasste Schreibvorgänge (siehe schreibeSettings/schreibeProfil/syncResources).
    this.settingsNummer = 0;
    this.settingsGesendet = 0;
    this.profilNummer = 0;
    this.profilGesendet = 0;
    this.profilOffen = {};
    this.ressourcenNummer = 0;
    this.ressourcenGesendet = 0;
    this.rooms = new Map();        // Raumschlüssel (r:<id>) → Raum-UUID in der Datenbank
    this.roomKinds = new Map();    // Raumschlüssel → 'crew' | 'meet' | 'person'
    this.state = this.emptyState();
    this.local = this.loadLocal();
    this.hydrating = null;
    this.rehydrateTimer = null;
  }

  emptyState() {
    return {
      settings: {
        onboarded: false, name: '', initials: '', color: '#C98A5B', photo: null,
        free: { active: false, pending: false, from: null, setAt: null, fromAt: null },
        freeResetTime: '00:00', activityStatus: 'nur-aktiv',
        // Runde 4 (Jonathan): Frei-Hinweise standardmäßig von allen Freunden.
        freiHints: { mode: 'alle', customIds: [] },
        bestFriendIds: [], specialPerson: null,
        notifications: { invitations: true, mentions: true, chat: true, updates: true, reminder: true, reminderMinutes: 15 },
        appearance: { theme: 'system' },
        location: { use: false, shareMode: 'niemand', shareIds: [] },
        visibility: { unknownProfile: 'nichts' },
        account: { email: '', method: 'email' },
        interests: [], interestLevels: {}, resources: [], resourceShares: {}, resourceMeta: {},
        friendRequests: [], outgoingRequests: [], inviteCode: '', homeAddress: null, pendingInvite: null,
      },
      people: [],
      crews: [],
      meets: [],
      messages: {},
      roomRead: {},
      // Entwürfe sind gerätelokal (sie entstehen beim Zusammenstellen eines Meets und
      // gehen erst beim Veröffentlichen an den Server). Sie liegen trotzdem im selben
      // Zustandsobjekt wie alles andere — eine Stelle, an der der Bestand der App steht.
      drafts: {},
      roomPolls: {},
      personPlaces: {},
      placeRequests: [],
      blocked: [],
      blockedPeople: [],
      folders: [],
      savedIdeas: [],
      // Runde 2: Echte Konten bekommen aus dem Seed nur die ALLGEMEINEN Ideen (ohne Ort).
      // Orte kommen aus der Umgebung (vorschlaegeNachladen) — vorher sah jemand in Wien die
      // Bregenzer Beispielorte.
      suggestions: seedSuggestions.filter((s) => !s.place),
    };
  }

  // --- Gerätelokales (Entwürfe, Anstups-Cooldowns) ---------------------------------------
  loadLocal() {
    const leer = { drafts: {}, nudgeCooldowns: {}, nudgeSentAt: {}, variantCooldowns: {} };
    try {
      const raw = globalThis.localStorage?.getItem(LOCAL_KEY);
      return raw ? { ...leer, ...JSON.parse(raw) } : leer;
    } catch { return leer; }
  }

  persistLocal() {
    try {
      const ablage = { ...this.local, drafts: this.state?.drafts || {} };
      globalThis.localStorage?.setItem(LOCAL_KEY, JSON.stringify(ablage));
    } catch { /* egal */ }
  }

  // --- Identität: nach außen heißt der eigene Nutzer ME ('p-me') --------------------------
  uid(screenId) { return screenId === ME ? this.myUid : screenId; }
  sid(dbId) { return dbId === this.myUid ? ME : dbId; }

  // --- Infrastruktur ----------------------------------------------------------------------
  subscribe(listener) {
    this.listeners.add(listener);
    return () => this.listeners.delete(listener);
  }

  notify() {
    this.listeners.forEach((listener) => listener());
  }

  reset() {
    // Es gibt nichts zurückzusetzen: die Wahrheit steht auf dem Server. Neu laden.
    this.refresh();
  }

  // Server-Schreibvorgänge laufen der Reihe nach. Fehler → neu laden und melden.
  // `offen` zählt mit, wie viele Schreibvorgänge noch anstehen — davon hängt ab, ob ein
  // Neuladen gerade erlaubt ist (siehe refresh()).
  push(label, run, { neuladenBeiFehler = true, zaehlt = true } = {}) {
    // Nach dem Abmelden gibt es niemanden mehr, in dessen Namen geschrieben werden könnte.
    if (this.abgemeldet && label !== tx('Abmelden')) return this.queue;
    if (zaehlt) { this.pendingWrites += 1; this.writeSeq += 1; this.zuletztGeschrieben = Date.now(); }
    this.queue = this.queue.then(async () => {
      try {
        const { error } = (await run()) || {};
        if (error) throw error;
      } catch (error) {
        console.error(`[SupabaseGateway] ${label}:`, error?.message || error);
        this.onError(error?.message || tx('{aktion} hat nicht geklappt', { aktion: label }));
        if (neuladenBeiFehler) {
          await this.hydrate();
          this.notify();
        }
      } finally {
        if (zaehlt) this.pendingWrites -= 1;
      }
    });
    return this.queue;
  }

  // Wird gerufen, wenn die Seite verlassen oder in den Hintergrund gelegt wird.
  //
  // Wer etwas ändert und die App im selben Moment schließt, darf die Änderung nicht
  // verlieren. Diese drei Zeilen tragen IMMER den ganzen Stand; sie dürfen deshalb sofort
  // und außer der Reihe raus. Der Browser schickt sie dank `keepalive` zu Ende, auch wenn
  // die Seite schon weg ist.
  flushBeimVerlassen() {
    if (this.abgemeldet) return;
    // Die Abfragen von supabase-js sind erst dann eine echte Anfrage, wenn sie ausgewertet
    // werden — deshalb das ausdrückliche .then(): ohne es bliebe der Aufruf ein Vorhaben.
    const abschicken = (abfrage) => { try { abfrage.then(() => {}, () => {}); } catch { /* egal */ } };
    if (this.settingsNummer !== this.settingsGesendet) {
      this.settingsGesendet = this.settingsNummer;
      abschicken(this.client.from('settings').update({ data: this.privateSettings() }).eq('user_id', this.myUid));
    }
    if (this.profilNummer !== this.profilGesendet && Object.keys(this.profilOffen).length) {
      this.profilGesendet = this.profilNummer;
      abschicken(this.client.from('profiles').update({ ...this.profilOffen }).eq('id', this.myUid));
    }
    if (this.ressourcenNummer !== this.ressourcenGesendet) {
      this.ressourcenGesendet = this.ressourcenNummer;
      const s = this.state.settings;
      const zeilen = (s.resources || []).map((label, index) => ({
        owner_id: this.myUid, label,
        availability: s.resourceMeta?.[label]?.availability === 'immer' ? 'immer' : 'manchmal',
        capacity: s.resourceMeta?.[label]?.capacity ?? null,
        // R1 §6.2: Das von Hand gewählte Zeichen gehört zur Ressource und reist mit.
        icon: s.resourceMeta?.[label]?.icon ?? null,
        share: s.resourceShares?.[label] ?? 'freunde',
        position: index,
      }));
      if (zeilen.length) abschicken(this.client.from('resources').upsert(zeilen, { onConflict: 'owner_id,label' }));
    }
  }

  // Wartet, bis alles durch ist: offene Schreibvorgänge UND ein bereits angemeldetes
  // Neuladen. Für Prüfläufe und vor dem Abmelden.
  async settled(maxMs = 15000) {
    const ende = Date.now() + maxMs;
    await this.queue;
    while ((this.pendingWrites > 0 || this.rehydrateTimer) && Date.now() < ende) {
      await new Promise((r) => setTimeout(r, 30));
      await this.queue;
    }
    return true;
  }

  async ready() {
    await this.hydrate();
    this.standortSenden();
    this.listenRealtime();
    this.notify();
    return this;
  }

  // Neu laden nur, wenn KEIN Schreibvorgang offen ist.
  //
  // Der Grund ist eine echte Verwechslungsgefahr: Eine Änderung wirkt zuerst lokal und geht
  // erst danach zum Server. Ein Neuladen, das dazwischen liegt, holt einen Stand OHNE diese
  // Änderung und überschreibt damit die Oberfläche. Der Server bekommt die Änderung zwar
  // trotzdem — aber die App denkt bis zum nächsten Neuladen das Gegenteil. Die nächste
  // Handlung rechnete dann falsch: „Mitbringen" liefe zweimal in dieselbe Richtung, ein
  // vierter bester Freund wäre plötzlich wieder erlaubt.
  //
  // Deshalb: Läuft noch etwas, wird das Neuladen einfach erneut angemeldet. Sobald die
  // Warteschlange leer ist, liefert es einen Stand, der alles Gesendete enthält.
  async refresh() {
    if (this.pendingWrites > 0 || this.tipptGerade()) {
      this.scheduleRehydrate();
      return;
    }
    await this.push(tx('Neu laden'), async () => {
      await this.hydrate();
      this.notify();
      return { error: null };
    }, { neuladenBeiFehler: false, zaehlt: false });
  }

  // Runde 2 (Jonathan: „der Speicher füllt sich sehr schnell"): Jede fremde Änderung lud das
  // GANZE Abbild neu — 27 Tabellen, auch wenn die App gerade im Hintergrund lag. Jetzt wird im
  // Hintergrund nur vorgemerkt und beim Zurückkommen EINMAL geladen; im Vordergrund werden
  // Änderungen einer knappen Sekunde zu einem Laden gebündelt (ein veröffentlichtes Meet
  // schreibt mehrere Tabellen hintereinander — das waren bisher mehrere volle Ladevorgänge).
  scheduleRehydrate() {
    if (globalThis.document?.visibilityState === 'hidden') {
      this.nachladenVorgemerkt = true;
      return;
    }
    clearTimeout(this.rehydrateTimer);
    this.rehydrateTimer = setTimeout(() => {
      this.rehydrateTimer = null;
      this.refresh();
    }, 900);
  }

  // Schreibt gerade jemand? Dann wird nicht neu gezeichnet. Ein Neuladen baut den Bildschirm
  // neu auf; geschieht das mitten in einer Eingabe, verliert oder verdoppelt sich der Text.
  // Die Änderung der anderen Seite ist nicht dringend genug, um jemandem ins Wort zu fallen.
  tipptGerade() {
    const el = globalThis.document?.activeElement;
    if (!el) return false;
    return el.tagName === 'INPUT' || el.tagName === 'TEXTAREA' || el.isContentEditable === true;
  }

  // ---------------------------------------------------------------------------------------
  // Laden: EIN vollständiges Abbild dessen, was dieser Nutzer sehen darf.
  // ---------------------------------------------------------------------------------------
  async hydrate() {
    if (this.hydrating) return this.hydrating;
    this.hydrating = this._hydrate().finally(() => { this.hydrating = null; });
    return this.hydrating;
  }

  async _hydrate() {
    // Merken, auf welchem Änderungsstand dieser Ladevorgang beginnt.
    const standBeimLaden = this.writeSeq;
    const c = this.client;
    const t = (name) => c.from(name).select('*');
    const [
      profiles, settings, inviteCodes, freeStatus, resources, friendships, friendRequests, blocks,
      crews, crewMembers, meets, participants, variants, variantVotes, bringItems, bringTakers,
      polls, pollOptions, pollVotes, loopResponses, meetPrivate, rooms, messages, roomReads,
      placeRequests, folders, savedIdeas, standorte, mitfahrten,
    ] = await Promise.all([
      t('profiles'), t('settings'), t('invite_codes'), t('free_status'), t('resources'),
      t('friendships'), t('friend_requests'), t('blocks'),
      t('crews'), t('crew_members'), t('meets'), t('meet_participants'),
      t('meet_variants'), t('meet_variant_votes'), t('meet_bring_items'), t('meet_bring_takers'),
      t('polls'), t('poll_options'), t('poll_votes'), t('loop_responses'), t('meet_private'),
      t('rooms'), c.from('messages').select('*').order('created_at', { ascending: true }), t('room_reads'),
      t('place_requests'), t('saved_folders'), t('saved_ideas'),
      // Runde 4 (D7): geteilte Standorte — die Regel standorte_select liefert nur, was die Person
      // mit mir teilt (0025). Fehlt die Tabelle noch, bleibt es leer statt den Start zu kosten.
      t('standorte').then((r) => (r.error ? { data: [] } : r)),
      // Runde 5 (E1): Mitfahrten (0030). Fehlt die Tabelle noch, bleibt es leer.
      t('meet_rides').then((r) => (r.error ? { data: [] } : r)),
    ]);

    const fehler = [profiles, settings, crews, meets, rooms, messages].find((r) => r.error);
    if (fehler) throw fehler.error;

    // Wurde während des Ladens etwas geändert, ist dieser Stand schon überholt. Ihn jetzt
    // einzusetzen würde die frische Änderung wieder wegnehmen — also verwerfen und später
    // erneut laden, wenn nichts mehr offen ist.
    if (this.writeSeq !== standBeimLaden) {
      this.scheduleRehydrate();
      return this.state;
    }

    const rows = (r) => r.data || [];
    // Runde 5 (E1): Mitfahrten je Meet — { [meetId]: { [personId]: { rolle, plaetze, fahrerId, am } } }.
    const ridesJeMeet = {};
    for (const z of rows(mitfahrten)) {
      if (!ridesJeMeet[z.meet_id]) ridesJeMeet[z.meet_id] = {};
      ridesJeMeet[z.meet_id][this.sid(z.user_id)] = {
        rolle: z.rolle, plaetze: z.plaetze, fahrerId: z.fahrer_id ? this.sid(z.fahrer_id) : null, am: Date.parse(z.aktualisiert) || 0,
      };
    }
    this.ridesStand = ridesJeMeet;
    const state = this.emptyState();

    // --- Räume zuerst: ihre Schlüssel brauchen Crew- und Meet-IDs ---
    this.rooms.clear();
    this.roomKinds.clear();
    for (const room of rows(rooms)) {
      const key = room.kind === 'crew' ? `r:${room.crew_id}`
        : room.kind === 'meet' ? `r:${room.meet_id}`
          : `r:${this.sid(room.dm_a === this.myUid ? room.dm_b : room.dm_a)}`;
      this.rooms.set(key, room.id);
      this.roomKinds.set(key, room.kind === 'dm' ? 'person' : room.kind);
    }
    const keyOfRoomId = new Map([...this.rooms.entries()].map(([key, id]) => [id, key]));

    // --- Freundschaft, Blockierung ---
    const friendIds = new Set();
    for (const f of rows(friendships)) friendIds.add(f.user_a === this.myUid ? f.user_b : f.user_a);
    const blockedIds = new Set(rows(blocks).map((b) => b.blocked_id));
    state.blocked = [...blockedIds].map((id) => this.sid(id));

    // --- Ressourcen je Besitzer ---
    const resByOwner = new Map();
    for (const r of rows(resources)) {
      if (!resByOwner.has(r.owner_id)) resByOwner.set(r.owner_id, []);
      resByOwner.get(r.owner_id).push(r);
    }
    const resourceBlock = (ownerId) => {
      const liste = (resByOwner.get(ownerId) || []).slice().sort((a, b) => a.position - b.position);
      return {
        resources: liste.map((r) => r.label),
        resourceShares: Object.fromEntries(liste.map((r) => [r.label, r.share])),
        resourceMeta: Object.fromEntries(liste.map((r) => [r.label, { availability: r.availability, capacity: r.capacity, icon: r.icon ?? null }])),
      };
    };

    // --- Frei-Status je Person ---
    const freeByUser = new Map(rows(freeStatus).map((f) => [f.user_id, {
      active: f.active,
      pending: f.pending,
      from: f.from_time || null,
      fromAt: f.from_at ? new Date(f.from_at).getTime() : null,
      setAt: f.set_at ? new Date(f.set_at).getTime() : null,
      lust: f.lust || null,
    }]));

    // --- Nachrichten je Raumschlüssel (für Ungelesen-Zähler gleich mit) ---
    for (const m of rows(messages)) {
      const key = keyOfRoomId.get(m.room_id);
      if (!key) continue;
      const zeit = new Date(m.created_at);
      if (!state.messages[key]) state.messages[key] = [];
      state.messages[key].push({
        ...(m.payload || {}),
        id: m.id,
        authorId: this.sid(m.author_id),
        kind: m.kind,
        text: m.text || undefined,
        response: m.response || undefined,
        date: toISODate(zeit),
        time: hhmm(zeit),
        at: zeit.getTime(),
      });
    }
    for (const r of rows(roomReads)) {
      const key = keyOfRoomId.get(r.room_id);
      if (key) state.roomRead[key] = r.last_read_count;
    }
    const unreadFor = (key) => Math.max(0, (state.messages[key]?.length || 0) - (state.roomRead[key] || 0));

    // --- Personen ---
    const meProfile = rows(profiles).find((p) => p.id === this.myUid);
    // Namen der blockierten Personen, damit die Liste „Blockiert" jemanden benennen kann.
    // (Der Server gibt ihre Profile nicht mehr heraus — das ist der Sinn der Blockierung.)
    // Die Liste der Blockierten kommt aus den Blockier-Zeilen selbst (Migration 0005):
    // Das Profil gibt der Server nach dem Blockieren nicht mehr heraus — die eigene Liste
    // muss die Person trotzdem benennen können, sonst ließe sich nichts zurücknehmen.
    state.blockedPeople = rows(blocks).map((b) => ({
      id: this.sid(b.blocked_id),
      name: b.blocked_name || tx('Blockierte Person'),
      initials: b.blocked_initials || '–',
      color: b.blocked_color || '#8A9FB8',
      photo: null,
      seit: b.created_at,
    }));
    // Runde 4 (D7): geteilte Standorte je Person (nur was die Regel standorte_select herausgibt).
    const standortVon = (id) => {
      const zeile = rows(standorte).find((s) => s.user_id === id);
      return zeile ? { lat: zeile.lat, lon: zeile.lon, at: Date.parse(zeile.aktualisiert) || 0 } : null;
    };
    for (const p of rows(profiles)) {
      if (p.id === this.myUid) continue;
      if (blockedIds.has(p.id)) continue;
      const key = `r:${p.id}`;
      state.people.push({
        id: p.id,
        name: p.name,
        initials: p.initials,
        color: p.color,
        photo: p.photo_path || null,
        area: p.area || '',
        status: '',
        unread: unreadFor(key),
        free: freeByUser.get(p.id) || { active: false, pending: false, from: null, fromAt: null, setAt: null },
        sharesLocation: p.shares_location,
        showsActivity: p.shows_activity,
        interests: p.interests || [],
        interestLevels: p.interest_levels || {},
        // Runde 4 (B5): nur wann jemand sicher keine Zeit hat, nie was.
        belegt: Array.isArray(p.belegt) ? p.belegt : [],
        standort: standortVon(p.id),
        ...resourceBlock(p.id),
        // Wer nicht befreundet ist, taucht in keiner Freundesliste auf, bleibt aber für
        // Meets und Räume auflösbar — dieselbe Regel wie im DemoDataGateway.
        friend: friendIds.has(p.id) && !blockedIds.has(p.id),
      });
    }

    // --- Eigene Einstellungen ---
    const meineSettings = rows(settings)[0]?.data || {};
    const meinCode = rows(inviteCodes)[0]?.code || '';
    const anfragen = rows(friendRequests);
    const profilVon = (id) => rows(profiles).find((p) => p.id === id) || {};
    state.settings = {
      ...state.settings,
      ...meineSettings,
      name: meProfile?.name || '',
      initials: meProfile?.initials || '',
      color: meProfile?.color || '#C98A5B',
      photo: meProfile?.photo_path || null,
      interests: meProfile?.interests || [],
      interestLevels: meProfile?.interest_levels || {},
      belegt: Array.isArray(meProfile?.belegt) ? meProfile.belegt : [],
      standort: standortVon(this.myUid),
      ...resourceBlock(this.myUid),
      free: freeByUser.get(this.myUid) || state.settings.free,
      inviteCode: meinCode,
      // Auftrag §1.7: Die Konto-Angaben kommen aus der Sitzung, nicht aus den
      // Einstellungen. Dort stand vorher ein leerer String — und der Bildschirm malte
      // „Apple" dazu, obwohl das Konto über E-Mail und Passwort entstanden war.
      account: this.kontoAusSitzung(),
      // Eine Anfrage traegt bewusst KEINE Personen-ID: Sie ist noch keine Person in meiner
      // Welt, sondern eine Bitte. Markierungen und Avatare beziehen sich deshalb auf die
      // Anfrage selbst — dieselbe Form wie im DemoDataGateway.
      friendRequests: anfragen.filter((r) => r.to_id === this.myUid && r.status === 'open').map((r) => {
        const p = profilVon(r.from_id);
        return { id: r.id, name: p.name || tx('Unbekannt'), initials: p.initials || '?', color: p.color || '#8A9FB8', code: r.code, meta: tx('Kurzcode') };
      }),
      outgoingRequests: anfragen.filter((r) => r.from_id === this.myUid && r.status === 'open').map((r) => {
        const p = profilVon(r.to_id);
        return { id: r.id, name: p.name || tx('Unbekannt'), initials: p.initials || '?', color: p.color || '#8A9FB8', code: r.code, meta: tx('Kurzcode') };
      }),
      // Die privaten Markierungen bleiben so, wie sie gespeichert sind. Sie beim Laden
      // stillschweigend zu filtern hieße, eine bewusst gesetzte Markierung ohne Zutun
      // wieder wegzunehmen; aufgeräumt wird dort, wo die Freundschaft endet (removeFriend).
      bestFriendIds: meineSettings.bestFriendIds || [],
      specialPerson: meineSettings.specialPerson || null,
    };

    // Lag beim letzten Mal noch etwas Ungesichertes im Gerät, gilt DAS — es ist jünger als
    // alles, was der Server kennt. Es wird übernommen und gleich nachgesendet.
    const ungesichert = this.ungesicherteSettings();
    if (ungesichert && !this.nachgesendet) {
      this.nachgesendet = true;
      Object.assign(state.settings, ungesichert);
      setTimeout(() => {
        this.profilOffen = {
          name: state.settings.name, initials: state.settings.initials, color: state.settings.color,
          photo_path: state.settings.photo ?? null,
          interests: state.settings.interests || [], interest_levels: state.settings.interestLevels || {},
        };
        this.schreibeProfil();
        this.schreibeSettings();
        this.syncResources();
      }, 0);
    }

    // --- Crews ---
    const membersByCrew = new Map();
    for (const m of rows(crewMembers)) {
      if (!membersByCrew.has(m.crew_id)) membersByCrew.set(m.crew_id, []);
      membersByCrew.get(m.crew_id).push(m);
    }
    for (const crew of rows(crews)) {
      const mitglieder = membersByCrew.get(crew.id) || [];
      state.crews.push({
        id: crew.id,
        name: crew.name,
        color: crew.color || null,
        groupImage: crew.group_image_path || null,
        memberIds: mitglieder.map((m) => this.sid(m.user_id)),
        adminIds: mitglieder.filter((m) => m.role === 'admin').map((m) => this.sid(m.user_id)),
        creatorId: crew.creator_id ? this.sid(crew.creator_id) : null,
        unread: unreadFor(`r:${crew.id}`),
      });
    }

    // --- Meets mit allem, was daran hängt ---
    const gruppiert = (liste, schluessel) => {
      const map = new Map();
      for (const zeile of liste) {
        const k = zeile[schluessel];
        if (!map.has(k)) map.set(k, []);
        map.get(k).push(zeile);
      }
      return map;
    };
    const teilnahmen = gruppiert(rows(participants), 'meet_id');
    const variantenJeMeet = gruppiert(rows(variants), 'meet_id');
    const stimmenJeVariante = gruppiert(rows(variantVotes), 'variant_id');
    const bringJeMeet = gruppiert(rows(bringItems), 'meet_id');
    const nehmerJeItem = gruppiert(rows(bringTakers), 'item_id');
    const umfragenJeMeet = gruppiert(rows(polls).filter((p) => p.meet_id), 'meet_id');
    const optionenJePoll = gruppiert(rows(pollOptions), 'poll_id');
    const stimmenJePoll = gruppiert(rows(pollVotes), 'poll_id');
    const loopJeMeet = gruppiert(rows(loopResponses), 'meet_id');
    const privatJeMeet = new Map(rows(meetPrivate).map((r) => [r.meet_id, r]));

    const baueUmfrage = (poll) => ({
      id: poll.id,
      question: poll.question,
      createdBy: poll.created_by ? this.sid(poll.created_by) : null,
      createdAt: poll.created_at,
      options: (optionenJePoll.get(poll.id) || [])
        .slice().sort((a, b) => a.position - b.position)
        .map((option) => ({
          id: option.id,
          label: option.label,
          votes: (stimmenJePoll.get(poll.id) || []).filter((v) => v.option_id === option.id).map((v) => this.sid(v.user_id)),
        })),
    });

    for (const meet of rows(meets)) {
      const teil = teilnahmen.get(meet.id) || [];
      const privat = privatJeMeet.get(meet.id);
      const loopAntworten = {};
      for (const antwort of loopJeMeet.get(meet.id) || []) {
        if (!loopAntworten[antwort.date]) loopAntworten[antwort.date] = {};
        loopAntworten[antwort.date][this.sid(antwort.user_id)] = antwort.response;
      }
      const andere = teil.map((p) => this.sid(p.user_id)).filter((id) => id !== ME);
      state.meets.push({
        id: meet.id,
        title: meet.title,
        icon: meet.icon,
        iconKey: meet.icon_key || undefined,
        category: meet.category,
        date: meet.date,
        // Runde 2 (Sprachen): Offene Zeit und offener Ort sind leer. Ältere Meets tragen dort
        // noch den deutschen Satz — er wird beim Laden zu „leer", die Anzeige übersetzt.
        time: meet.time === 'Zeit offen' ? '' : (meet.time || ''),
        endTime: meet.end_time || undefined,
        openTime: meet.open_time,
        // Runde 4 (F2): „Jetzt" bleibt „Jetzt" (0029).
        nowTime: Boolean(meet.now_time) || undefined,
        place: meet.place && meet.place.name !== 'Ort offen' ? meet.place : { ...(meet.place || {}), name: '', address: meet.place?.address || '' },
        // Runde 3 (G1): Foto und Herkunft des Vorschlags stehen im Ort (jsonb).
        suggestionId: meet.place?.vorschlagId || undefined,
        bild: meet.place?.bild || undefined,
        bildSeite: meet.place?.bildSeite || undefined,
        bildUrheber: meet.place?.bildUrheber || undefined,
        placePending: meet.place_pending,
        crewId: meet.crew_id || undefined,
        personIds: meet.crew_id ? undefined : andere,
        creatorId: meet.creator_id ? this.sid(meet.creator_id) : null,
        status: meet.status,
        cancelled: meet.cancelled || undefined,
        note: meet.note || '',
        participation: Object.fromEntries(teil.map((p) => [this.sid(p.user_id), p.state])),
        variants: (variantenJeMeet.get(meet.id) || []).map((v) => ({
          id: v.id,
          kind: v.kind,
          authorId: this.sid(v.author_id),
          date: v.date || undefined,
          time: v.time || undefined,
          open: v.open || undefined,
          now: v.now || undefined,
          title: v.title || undefined,
          icon: v.icon || undefined,
          iconKey: v.icon_key || undefined,
          category: v.category || undefined,
          place: v.place || undefined,
          votes: (stimmenJeVariante.get(v.id) || []).map((s) => this.sid(s.user_id)),
        })),
        bring: (bringJeMeet.get(meet.id) || []).map((item) => ({
          id: item.id,
          label: item.label,
          takenBy: (nehmerJeItem.get(item.id) || []).map((n) => this.sid(n.user_id)),
        })),
        polls: (umfragenJeMeet.get(meet.id) || []).map(baueUmfrage),
        loop: meet.loop ? { ...meet.loop, responses: loopAntworten } : undefined,
        roomId: meet.crew_id ? `r:${meet.crew_id}` : (andere.length > 1 ? `r:${meet.id}` : undefined),
        review: privat?.review || undefined,
        hiddenFromHistory: privat?.hidden || undefined,
      });
    }

    // --- Raum-Umfragen (ohne Meet) ---
    for (const poll of rows(polls).filter((p) => p.room_id)) {
      const key = keyOfRoomId.get(poll.room_id);
      if (!key) continue;
      if (!state.roomPolls[key]) state.roomPolls[key] = [];
      state.roomPolls[key].push(baueUmfrage(poll));
    }

    // --- Ortsanfragen und daraus abgeleitete Orte ---
    state.placeRequests = rows(placeRequests).map((r) => ({
      id: r.id,
      meetId: r.meet_id,
      hostId: this.sid(r.host_id),
      requesterId: this.sid(r.requester_id),
      status: r.status,
      createdAt: r.created_at,
      respondedAt: r.responded_at,
    }));
    for (const anfrage of state.placeRequests) {
      const meet = state.meets.find((m) => m.id === anfrage.meetId);
      state.personPlaces[anfrage.hostId] = {
        name: meet?.place?.name || 'Adresse',
        address: anfrage.status === 'accepted' ? (meet?.place?.address || '') : '',
        approved: anfrage.status === 'accepted',
        requested: anfrage.status === 'open',
      };
    }
    // Die eigene Adresse steht in den Einstellungen, nicht bei den Personen (A19e).
    if (state.settings.homeAddress) {
      state.personPlaces[ME] = {
        name: 'Bei mir',
        address: [state.settings.homeAddress.name, state.settings.homeAddress.city].filter(Boolean).join(', '),
        approved: true,
      };
    }

    // Entwürfe überleben ein Neuladen: sie gehören dem Gerät, nicht dem Server.
    state.drafts = this.state?.drafts && Object.keys(this.state.drafts).length
      ? this.state.drafts
      : (this.local.drafts || {});

    state.folders = rows(folders).map((f) => ({ id: f.id, name: f.name }));
    state.savedIdeas = rows(savedIdeas).map((i) => ({ ...i.data, id: i.id, folderId: i.folder_id, createdAt: new Date(i.created_at).getTime() }));

    this.state = state;
    return state;
  }

  // ---------------------------------------------------------------------------------------
  // Realtime
  // ---------------------------------------------------------------------------------------
  listenRealtime() {
    if (this.channel) return;
    this.channel = this.client.channel('crew-live');
    // Nachricht und Frei-Status werden sofort eingearbeitet — beides muss sich ohne
    // spürbare Verzögerung zeigen. Alles andere löst ein gebündeltes Neuladen aus.
    this.channel.on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'messages' }, ({ new: row }) => {
      this.applyIncomingMessage(row);
    });
    // Runde 4 (E8, Wunsch P6): Eine gelöschte Nachricht verschwindet auch auf den anderen Geräten
    // sofort. Ein DELETE-Paket trägt nur den Primärschlüssel (old.id) — mehr braucht es nicht.
    this.channel.on('postgres_changes', { event: 'DELETE', schema: 'public', table: 'messages' }, ({ old: row }) => {
      this.applyDeletedMessage(row?.id);
    });
    this.channel.on('postgres_changes', { event: '*', schema: 'public', table: 'free_status' }, ({ new: row }) => {
      if (!row?.user_id) return this.scheduleRehydrate();
      return this.applyFreeStatus(row);
    });
    for (const table of [
      'profiles', 'meets', 'meet_participants', 'meet_variants', 'meet_variant_votes',
      'meet_bring_items', 'meet_bring_takers', 'polls', 'poll_options', 'poll_votes',
      'loop_responses', 'friendships', 'friend_requests', 'crews', 'crew_members',
      'place_requests', 'rooms', 'meet_rides',
    ]) {
      this.channel.on('postgres_changes', { event: '*', schema: 'public', table }, (paket) => {
        if (this.eigenesEcho(paket)) return;
        this.scheduleRehydrate();
      });
    }
    globalThis.document?.addEventListener?.('visibilitychange', () => {
      if (globalThis.document.visibilityState === 'visible') this.standortSenden();
      if (globalThis.document.visibilityState === 'visible' && this.nachladenVorgemerkt) {
        this.nachladenVorgemerkt = false;
        this.scheduleRehydrate();
      }
    });
    this.channel.subscribe();
  }

  // Das Echo der EIGENEN Änderung: lokal längst eingetragen, ein volles Neuladen dafür wäre
  // reiner Datenverkehr. Übersprungen wird nur, was eindeutig mir gehört und kurz nach einem
  // eigenen Schreiben kommt. Eine Einladung VON jemand anderem an mich zählt nie als Echo.
  eigenesEcho(paket) {
    if (!this.zuletztGeschrieben || Date.now() - this.zuletztGeschrieben > 4000) return false;
    const neu = paket?.new && Object.keys(paket.new).length ? paket.new : null;
    if (!neu) return false;
    if (neu.invited_by && neu.invited_by !== this.myUid) return false;
    const besitzer = neu.user_id ?? neu.author_id ?? neu.creator_id ?? neu.owner_id ?? neu.from_id ?? (paket.table === 'profiles' ? neu.id : undefined);
    return Boolean(besitzer) && besitzer === this.myUid;
  }

  applyIncomingMessage(row) {
    const key = [...this.rooms.entries()].find(([, id]) => id === row.room_id)?.[0];
    if (!key) return this.scheduleRehydrate();
    const liste = this.state.messages[key] || (this.state.messages[key] = []);
    if (liste.some((m) => m.id === row.id)) return undefined; // eigene optimistische Zeile
    const zeit = new Date(row.created_at);
    liste.push({
      ...(row.payload || {}),
      id: row.id,
      authorId: this.sid(row.author_id),
      kind: row.kind,
      text: row.text || undefined,
      response: row.response || undefined,
      date: toISODate(zeit),
      time: hhmm(zeit),
      at: zeit.getTime(),
    });
    this.bumpUnread(key);
    this.notify();
    return undefined;
  }

  // Runde 4 (E8): Gelöscht auf einem anderen Gerät (oder vom Absender) → hier ebenfalls weg.
  applyDeletedMessage(messageId) {
    if (!messageId) return;
    for (const [key, liste] of Object.entries(this.state.messages)) {
      const stelle = (liste || []).findIndex((m) => m.id === messageId);
      if (stelle < 0) continue;
      liste.splice(stelle, 1);
      if (typeof this.state.roomRead?.[key] === 'number') this.state.roomRead[key] = Math.min(this.state.roomRead[key], liste.length);
      this.notify();
      return;
    }
  }

  bumpUnread(key) {
    const offen = Math.max(0, (this.state.messages[key]?.length || 0) - (this.state.roomRead[key] || 0));
    const refId = key.slice(2);
    const crew = this.state.crews.find((c) => c.id === refId);
    if (crew) crew.unread = offen;
    const person = this.state.people.find((p) => p.id === refId);
    if (person) person.unread = offen;
  }

  applyFreeStatus(row) {
    const frei = {
      active: row.active,
      pending: row.pending,
      from: row.from_time || null,
      fromAt: row.from_at ? new Date(row.from_at).getTime() : null,
      setAt: row.set_at ? new Date(row.set_at).getTime() : null,
      lust: row.lust || null,
    };
    if (row.user_id === this.myUid) this.state.settings.free = frei;
    else {
      const person = this.state.people.find((p) => p.id === row.user_id);
      if (!person) return this.scheduleRehydrate();
      person.free = frei;
    }
    this.notify();
    return undefined;
  }

  // ---------------------------------------------------------------------------------------
  // Identität & Einstellungen
  // ---------------------------------------------------------------------------------------
  getMe() {
    const s = this.state.settings;
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
    zeichenNachlernen(
      namenAusEinstellungen(this.state.settings),
      (body) => this.client.functions.invoke('zeichen', { body }),
      aktiveSprache(),
      () => this.notify(),
    );
    return this.state.settings;
  }

  // Runde 3 (B2): Wörter, die noch nicht in den Einstellungen stehen (Einrichten), gleich nachlernen.
  zeichenLernen(namen = []) {
    zeichenNachlernen(
      namen.map((n) => String(n || '').trim()).filter(Boolean),
      (body) => this.client.functions.invoke('zeichen', { body }),
      aktiveSprache(),
      () => this.notify(),
    );
  }

  // Ein Patch kann Profilfelder, private Einstellungen und Ressourcen mischen. Er wird
  // hier auseinandergenommen und in die jeweils zuständige Tabelle geschrieben.
  updateSettings(patch) {
    Object.assign(this.state.settings, patch);
    this.notify();

    const profil = {};
    if (patch.name !== undefined) profil.name = patch.name;
    if (patch.initials !== undefined) profil.initials = patch.initials;
    if (patch.color !== undefined) profil.color = patch.color;
    if (patch.photo !== undefined) profil.photo_path = patch.photo;
    if (patch.interests !== undefined) profil.interests = patch.interests;
    if (patch.interestLevels !== undefined) profil.interest_levels = patch.interestLevels;
    if (patch.activityStatus !== undefined) profil.shows_activity = patch.activityStatus !== 'aus';
    if (patch.location !== undefined) profil.shares_location = Boolean(patch.location.use);
    // Runde 4 (D7): Teilen an → gleich die ungefähre Lage senden; aus → Zeile löschen.
    if (patch.location !== undefined) {
      if (patch.location.use) this.standortSenden({ sofort: true });
      else this.push(tx('Standort nicht mehr teilen'), () => this.client.from('standorte').delete().eq('user_id', this.myUid));
    }
    // Runde 4 (B5): „Keine Zeit"-Fenster sehen Freunde — deshalb im Profil, nicht in den privaten Einstellungen.
    if (patch.belegt !== undefined) profil.belegt = Array.isArray(patch.belegt) ? patch.belegt : [];

    const privat = {};
    for (const key of ['onboarded', 'freeResetTime', 'activityStatus', 'freiHints', 'bestFriendIds',
      'specialPerson', 'notifications', 'appearance', 'location', 'visibility', 'homeAddress',
      'account', 'pendingInvite', 'lernen', 'sprache', 'spracheAktiv', 'besteFreundeMarke']) {
      if (patch[key] !== undefined) privat[key] = patch[key];
    }

    if (Object.keys(profil).length) {
      Object.assign(this.profilOffen, profil);
      this.schreibeProfil();
    }
    if (Object.keys(privat).length) this.schreibeSettings();
    if (patch.resources !== undefined || patch.resourceShares !== undefined || patch.resourceMeta !== undefined) {
      this.syncResources();
    }
  }

  // Nur Privates in die settings-Zeile; Profilfelder haben ihre eigene Tabelle.
  privateSettings() {
    const data = { ...this.state.settings };
    // Runde 2: `account` (E-Mail, Anmeldeart) kommt aus der Sitzung — es doppelt in die
    // Einstellungen zu schreiben, war nur ein zweiter, veraltender Abdruck derselben Adresse.
    for (const key of ['name', 'initials', 'color', 'photo', 'interests', 'interestLevels',
      'resources', 'resourceShares', 'resourceMeta', 'free', 'inviteCode',
      'friendRequests', 'outgoingRequests', 'account']) delete data[key];
    return data;
  }

  // Mehrere Änderungen kurz hintereinander (drei Markierungen wegnehmen, dann eine setzen)
  // ergeben EINEN Schreibvorgang, nicht vier. Beide Zeilen tragen ohnehin immer den ganzen
  // Stand; vier Runden zum Server hintereinander wären nur langsamer — und wer die App
  // gleich danach schließt, verlöre die letzten davon.
  // Einstellungen werden ZUERST im Gerät gesichert und dann gesendet.
  //
  // Zwischen „gesendet" und „angekommen" liegt eine Netzrunde. Wer in dieser Zeit die App
  // schließt oder die Seite neu lädt, hätte seine Änderung sonst verloren — beim nächsten
  // Start stünde wieder der alte Stand da. Der Zwischenspeicher wird beim nächsten Start
  // gelesen, gilt dann als der wahre Stand und wird nachgesendet. Gelöscht wird er erst,
  // wenn der Server bestätigt hat.
  schreibeSettings() {
    const meine = (this.settingsNummer += 1);
    this.merkeSettingsLokal();
    this.push(tx('Einstellungen speichern'), async () => {
      if (meine !== this.settingsNummer) return { error: null };
      this.settingsGesendet = meine;
      const antwort = await this.client.from('settings').update({ data: this.privateSettings() }).eq('user_id', this.myUid);
      if (!antwort.error && meine === this.settingsNummer && this.ressourcenNummer === this.ressourcenGesendet) this.vergisSettingsLokal();
      return antwort;
    });
  }

  // Gesichert wird alles, was mir gehört und ich gerade geändert haben könnte: die privaten
  // Einstellungen, die Profilfelder und die Ressourcen. Nicht gesichert wird, was der Server
  // führt (Frei-Status, Einladungscode, Anfragen) — das käme sonst veraltet zurück.
  eigenerStand() {
    const daten = { ...this.state.settings };
    for (const key of ['free', 'inviteCode', 'friendRequests', 'outgoingRequests']) delete daten[key];
    return daten;
  }

  merkeSettingsLokal() {
    try { globalThis.localStorage?.setItem(SETTINGS_KEY, JSON.stringify(this.eigenerStand())); } catch { /* egal */ }
  }

  vergisSettingsLokal() {
    try { globalThis.localStorage?.removeItem(SETTINGS_KEY); } catch { /* egal */ }
  }

  ungesicherteSettings() {
    try {
      const roh = globalThis.localStorage?.getItem(SETTINGS_KEY);
      return roh ? JSON.parse(roh) : null;
    } catch { return null; }
  }

  schreibeProfil() {
    const meine = (this.profilNummer += 1);
    this.push(tx('Profil speichern'), () => {
      if (meine !== this.profilNummer) return { error: null };
      this.profilGesendet = meine;
      const felder = { ...this.profilOffen };
      this.profilOffen = {};
      return this.client.from('profiles').update(felder).eq('id', this.myUid);
    });
  }

  // Ressourcen sind Zeilen, keine Liste: die Oberfläche schickt aber immer den ganzen Satz.
  // Wie bei den Einstellungen wird zusammengefasst; der Stand wird erst beim Senden gelesen.
  syncResources() {
    this.merkeSettingsLokal();
    const meine = (this.ressourcenNummer += 1);
    this.push(tx('Ressourcen speichern'), async () => {
      if (meine !== this.ressourcenNummer) return { error: null };
      this.ressourcenGesendet = meine;
      const s = this.state.settings;
      const labels = s.resources || [];
      const zeilen = labels.map((label, index) => ({
        owner_id: this.myUid,
        label,
        availability: s.resourceMeta?.[label]?.availability === 'immer' ? 'immer' : 'manchmal',
        capacity: s.resourceMeta?.[label]?.capacity ?? null,
        // R1 §6.2: Das von Hand gewählte Zeichen gehört zur Ressource und reist mit.
        icon: s.resourceMeta?.[label]?.icon ?? null,
        share: s.resourceShares?.[label] ?? 'freunde',
        position: index,
      }));
      const weg = await this.client.from('resources').delete().eq('owner_id', this.myUid)
        .not('label', 'in', `(${labels.map((l) => `"${l.replace(/"/g, '')}"`).join(',') || '""'})`);
      if (weg.error) return weg;
      const fertig = zeilen.length
        ? await this.client.from('resources').upsert(zeilen, { onConflict: 'owner_id,label' })
        : { error: null };
      if (!fertig.error && meine === this.ressourcenNummer && this.settingsNummer === this.settingsGesendet) this.vergisSettingsLokal();
      return fertig;
    });
  }

  completeOnboarding(profile) {
    this.updateSettings({ ...profile, onboarded: true });
  }

  // --- Das echte Konto --------------------------------------------------------------------
  kontoAusSitzung() {
    const u = this.authUser || {};
    const identitaeten = u.identities || [];
    // app_metadata.provider ist die Anmeldeart, mit der das Konto ENTSTANDEN ist; die
    // Liste der Identitäten sagt, womit man sich außerdem anmelden kann.
    const methode = u.app_metadata?.provider || identitaeten[0]?.provider || 'email';
    return {
      email: u.email || '',
      method: methode,
      methods: identitaeten.map((i) => i.provider).filter(Boolean),
      neueEmail: u.new_email || '',
    };
  }

  getAccountInfo() {
    const konto = this.kontoAusSitzung();
    // Runde 2: kurz — „E-Mail und Passwort" brach in der Zeile um.
    const namen = { email: tx('E-Mail'), apple: 'Apple', google: 'Google' };
    return {
      echt: true,
      email: konto.email,
      methode: konto.method,
      methodeLabel: namen[konto.method] || konto.method,
      // Ein Passwort gibt es nur bei einem E-Mail-Konto. Wer über Apple kam, hat keines,
      // und ein Feld dafür wäre eine Lüge.
      kannPasswort: (konto.methods || []).includes('email') || konto.method === 'email',
      neueEmail: konto.neueEmail,
    };
  }

  async aktualisiereSitzung() {
    const { data } = await this.client.auth.getUser();
    if (data?.user) {
      this.authUser = data.user;
      this.state.settings.account = this.kontoAusSitzung();
      this.notify();
    }
  }

  async changeEmail(email) {
    const wert = String(email || '').trim();
    if (!wert) return { ok: false, meldung: tx('Bitte eine E-Mail-Adresse eingeben.') };
    const { error } = await this.client.auth.updateUser({ email: wert });
    if (error) return { ok: false, meldung: uebersetzeAuthFehler(error.message) };
    await this.aktualisiereSitzung();
    // Supabase wechselt die Adresse erst, wenn der Link in der Mail angeklickt ist —
    // und schickt den je nach Einstellung an BEIDE Adressen. Genau das steht hier.
    return { ok: true, meldung: tx('Wir haben an {email} eine Bestätigung geschickt. Die Adresse gilt, sobald du den Link angeklickt hast.', { email: wert }) };
  }

  // Runde 2 (Jonathan): Ein neues Passwort gibt es nur mit dem aktuellen. Geprüft wird am
  // Server — eine Anmeldung mit genau diesem Passwort. Stimmt es nicht, bleibt alles, wie es war.
  async changePassword(alt, neu) {
    const altWert = String(alt || '');
    const wert = String(neu || '');
    if (!altWert) return { ok: false, meldung: tx('Gib zuerst dein aktuelles Passwort ein.') };
    if (wert.length < 8) return { ok: false, meldung: tx('Das neue Passwort braucht mindestens 8 Zeichen.') };
    const email = this.kontoAusSitzung().email;
    const probe = await this.client.auth.signInWithPassword({ email, password: altWert });
    if (probe.error) {
      return { ok: false, meldung: /invalid login credentials/i.test(probe.error.message) ? tx('Das aktuelle Passwort stimmt nicht.') : uebersetzeAuthFehler(probe.error.message) };
    }
    if (probe.data?.user) this.authUser = probe.data.user;
    const { error } = await this.client.auth.updateUser({ password: wert });
    if (error) return { ok: false, meldung: uebersetzeAuthFehler(error.message) };
    return { ok: true, meldung: tx('Passwort geändert.') };
  }

  // Runde 2: Die Mails von Supabase (Bestätigen, Passwort, neue Adresse) fragen die Sprache
  // aus dem Konto ab (.Data.sprache, supabase/mail). Gemeldet wird nur, wenn sie sich ändert.
  async spracheMelden(code) {
    if (!code || this.authUser?.user_metadata?.sprache === code) return;
    const { data, error } = await this.client.auth.updateUser({ data: { sprache: code } });
    if (!error && data?.user) this.authUser = data.user;
  }

  // „Passwort vergessen?" aus der Konto-Seite: derselbe Link wie in der Anmeldemaske.
  async sendPasswordReset() {
    const email = this.kontoAusSitzung().email;
    if (!email) return { ok: false, meldung: tx('Zu diesem Konto gibt es keine E-Mail-Adresse.') };
    const ort = globalThis.location;
    const { error } = await this.client.auth.resetPasswordForEmail(email, { redirectTo: ort ? `${ort.origin}${ort.pathname}` : undefined });
    if (error) return { ok: false, meldung: uebersetzeAuthFehler(error.message) };
    return { ok: true, meldung: tx('Wir haben dir einen Link an {email} geschickt.', { email }) };
  }

  // Abmelden beendet auch das Zuhören und das Schreiben: Ohne Sitzung schlägt jeder weitere
  // Server-Aufruf fehl, und eine Kette von Fehlermeldungen wäre das Letzte, was jemand beim
  // Abmelden sehen will. Der lokale Bestand bleibt stehen, bis die Seite neu lädt.
  // Runde 3 (Jonathan): „Ich habe meinen Account gelöscht und bin auf der Seite, wo man den
  // Namen eingibt — nicht, wo man sich anmeldet." Ursache: Hier wurde der Bestand geleert
  // (onboarded = false) und neu gezeichnet — die App zeigte das Einrichten eines Kontos, das es
  // nicht mehr gibt. Jetzt bleibt die Seite ruhig stehen, bis der Server fertig ist, und dann
  // lädt die App neu: ohne Sitzung steht die Anmeldemaske da. Auch beim Abmelden.
  zurAnmeldung() {
    try { globalThis.sessionStorage?.setItem('crew-eben-abgemeldet', '1'); } catch { /* egal */ }
    const ort = globalThis.location;
    if (ort?.replace) ort.replace(ort.pathname);
  }

  signOut() {
    this.abgemeldet = true;
    clearTimeout(this.rehydrateTimer);
    this.rehydrateTimer = null;
    this.push(tx('Abmelden'), async () => {
      // Runde 5 (Wunsch P5): Das Push-Abo dieses Geräts gehört dem Konto, das sich abmeldet. Bliebe es stehen,
      // bekäme das Gerät weiter dessen Mitteilungen — und ein anderes Konto im selben Browser könnte es nicht
      // übernehmen (Regel push_subscriptions). Also vor dem Abmelden löschen, solange die Sitzung noch gilt.
      try { const { pushAusschalten } = await import('./push.js'); await pushAusschalten(this.client); } catch { /* egal */ }
      try { await this.channel?.unsubscribe(); } catch { /* egal */ }
      this.channel = null;
      try { await this.client.auth.signOut(); } finally { this.zurAnmeldung(); }
      return { error: null };
    }, { neuladenBeiFehler: false });
  }

  deleteAccount() {
    this.push(tx('Konto löschen'), async () => {
      const { error } = await this.client.rpc('delete_account');
      if (error) return { error };
      this.abgemeldet = true;
      try { await this.client.auth.signOut(); } finally { this.zurAnmeldung(); }
      return { error: null };
    });
  }

  // ---------------------------------------------------------------------------------------
  // Frei-Status
  // ---------------------------------------------------------------------------------------
  getFreeState() {
    const free = this.state.settings.free;
    // Ein geplantes „Frei ab" wird zum gewählten Zeitpunkt von selbst wirksam.
    if (free?.pending && free.fromAt && Date.now() >= free.fromAt) {
      free.pending = false;
      free.from = null;
      free.setAt = null;
      free.fromAt = null;
      this.writeFree(free);
    }
    return free;
  }

  writeFree(free) {
    this.push(tx('Frei-Status speichern'), () => this.client.from('free_status').update({
      active: free.active,
      pending: free.pending,
      from_time: free.from,
      from_at: free.fromAt ? new Date(free.fromAt).toISOString() : null,
      set_at: free.setAt ? new Date(free.setAt).toISOString() : null,
      lust: free.lust || null,
    }).eq('user_id', this.myUid));
  }

  setFree(options = {}) {
    const at = Number(options.at) || 0;
    const offset = Math.max(0, Number(options.fromMinutes) || 0);
    const fromAt = at > Date.now() ? at : (offset > 0 ? Date.now() + offset * 60000 : 0);
    // Runde 5 (G3b): Die Lust bleibt, solange niemand sie ausdrücklich ändert.
    const lust = options.lust !== undefined ? this.lustPruefen(options.lust) : (this.state.settings.free?.lust ?? null);
    const free = fromAt
      ? { active: true, pending: true, from: options.from || null, setAt: Date.now(), fromAt, lust }
      : { active: true, pending: false, from: null, setAt: null, fromAt: null, lust };
    this.state.settings.free = free;
    this.writeFree(free);
    this.notify();
  }

  clearFree() {
    const free = { active: false, pending: false, from: null, setAt: null, fromAt: null, lust: null };
    this.state.settings.free = free;
    this.writeFree(free);
    this.notify();
  }

  // Runde 5 (G3b): nur die Lust ändern — der Frei-Zustand selbst bleibt, wie er ist.
  setFreeLust(lust) {
    const free = { ...(this.state.settings.free || { active: false }), lust: this.lustPruefen(lust) };
    this.state.settings.free = free;
    this.writeFree(free);
    this.notify();
  }

  // Runde 5 (G3b): „Lust" beim Frei-Sein. Erlaubt sind nur diese Wörter — alles andere wird null.
  lustPruefen(lust) {
    return ['kaffee', 'sport', 'draussen', 'essen', 'chillen'].includes(lust) ? lust : null;
  }

  // ---------------------------------------------------------------------------------------
  // Personen & Freundschaft
  // ---------------------------------------------------------------------------------------
  personWithDerived(person) {
    const activeMeet = this.state.meets.find(
      (meet) => meet.status === 'active' && meet.participation[person.id] === 'yes',
    );
    // Ohne eigenen Statustext zeigt die App, was wirklich bekannt ist: Frei oder Gegend.
    const status = person.free?.active ? tx('Frei')
      : (person.free?.pending && person.free.from ? tx('Frei ab {zeit}', { zeit: person.free.from }) : (person.area || ''));
    return { ...person, status: person.status || status, activeMeetId: person.showsActivity && activeMeet ? activeMeet.id : null };
  }

  getPeople() {
    return this.state.people
      .filter((person) => person.friend !== false)
      .map((person) => this.personWithDerived(person));
  }

  getPerson(id) {
    if (id === ME) return this.getMe();
    const person = this.state.people.find((entry) => entry.id === id);
    return person ? this.personWithDerived(person) : null;
  }

  crewMemberIds(crewId) {
    return this.state.crews.find((entry) => entry.id === crewId)?.memberIds || [];
  }

  projectProfile(person, viewerContext = {}) {
    return projectProfile(person, viewerContext, (crewId) => this.crewMemberIds(crewId));
  }

  isSharedWith(share, viewerContext = {}) {
    return isSharedWith(share, viewerContext, (crewId) => this.crewMemberIds(crewId));
  }

  setBestFriend(personId, on) {
    const list = this.state.settings.bestFriendIds || [];
    if (on) {
      const unique = [...new Set(list)];
      if (unique.includes(personId)) return { ok: true };
      if (unique.length >= 3) return { ok: false, reason: tx('Maximal drei beste Freunde') };
      if (this.state.settings.specialPerson?.personId === personId) this.state.settings.specialPerson = null;
      this.updateSettings({ bestFriendIds: [...unique, personId], specialPerson: this.state.settings.specialPerson });
      return { ok: true };
    }
    this.updateSettings({ bestFriendIds: list.filter((id) => id !== personId) });
    return { ok: true };
  }

  setSpecialPerson(personId, marker) {
    if (marker) {
      this.updateSettings({
        bestFriendIds: [...new Set(this.state.settings.bestFriendIds || [])].filter((id) => id !== personId),
        specialPerson: {
          personId,
          label: marker.label || '',
          symbol: marker.symbol || 'herz',
          emoji: marker.emoji || '',
          color: marker.color || '#D64291',
        },
      });
    } else {
      this.updateSettings({ specialPerson: null });
    }
    return { ok: true };
  }

  removeFriend(personId) {
    const person = this.state.people.find((entry) => entry.id === personId);
    if (person) person.friend = false;
    const s = this.state.settings;
    const patch = { bestFriendIds: (s.bestFriendIds || []).filter((id) => id !== personId) };
    if (s.specialPerson?.personId === personId) patch.specialPerson = null;
    if (s.freiHints?.customIds) patch.freiHints = { ...s.freiHints, customIds: s.freiHints.customIds.filter((id) => id !== personId) };
    this.updateSettings(patch);
    const a = this.myUid < personId ? this.myUid : personId;
    const b = this.myUid < personId ? personId : this.myUid;
    this.push(tx('Freundschaft beenden'), () => this.client.from('friendships').delete().eq('user_a', a).eq('user_b', b));
  }

  getFriendRequests() {
    return this.state.settings.friendRequests;
  }

  acceptFriendRequest(requestId) {
    this.state.settings.friendRequests = this.state.settings.friendRequests.filter((entry) => entry.id !== requestId);
    this.notify();
    this.push(tx('Anfrage annehmen'), async () => {
      const { error } = await this.client.rpc('accept_friend_request', { request_id: requestId });
      if (error) return { error };
      await this.hydrate();
      this.notify();
      return { error: null };
    });
  }

  declineFriendRequest(requestId) {
    this.state.settings.friendRequests = this.state.settings.friendRequests.filter((entry) => entry.id !== requestId);
    this.notify();
    this.push(tx('Anfrage ablehnen'), () => this.client.rpc('decline_friend_request', { request_id: requestId }));
  }

  getInviteCode() {
    return this.state.settings.inviteCode;
  }

  normalizeInviteCode(code) { return normalizeInviteCode(code); }

  isInviteCodeFormat(code) { return isInviteCodeFormat(code); }

  // Was lässt sich OHNE Rückfrage über einen Code sagen? Nur der eigene ist bekannt.
  // Die Codes anderer Leute liegen bewusst nicht in diesem Gerät — auch nicht die von
  // Freund:innen (Prüfschritt T1). Alles Weitere beantwortet redeemInviteCode() am Server.
  lookupInviteCode(code) {
    const normalized = normalizeInviteCode(code);
    if (normalized === normalizeInviteCode(this.state.settings.inviteCode)) return { kind: 'self' };
    const freund = this.state.people.find((p) => p.inviteCode && normalizeInviteCode(p.inviteCode) === normalized);
    if (freund) return { kind: 'friend', person: freund };
    return { kind: 'unknown' };
  }

  // Die Fälle, die aus dem eigenen Bestand entscheidbar sind, werden sofort beantwortet.
  // Ob ein fremder Code EXISTIERT, weiß nur der Server — die Codes anderer Leute sind für
  // diesen Client absichtlich unlesbar (T1). Für diesen Fall wird das Versprechen auf die
  // echte Antwort zurückgegeben, statt eine zu erfinden und sie gleich zu widerrufen.
  redeemInviteCode(code) {
    const raw = String(code ?? '').trim();
    if (!raw) return { ok: false, status: 'empty', reason: tx('Code eingeben') };
    const normalized = normalizeInviteCode(raw);
    if (!isInviteCodeFormat(normalized)) return { ok: false, status: 'invalid', code: normalized, reason: tx('Code ungültig') };
    if (normalized === normalizeInviteCode(this.state.settings.inviteCode)) {
      return { ok: false, status: 'self', code: normalized, reason: tx('Das ist dein eigener Code') };
    }
    const freund = this.state.people.find((p) => p.friend !== false && p.inviteCode
      && normalizeInviteCode(p.inviteCode) === normalized);
    if (freund) {
      const vorname = (freund.name || '').split(' ')[0];
      return { ok: false, status: 'already', code: normalized, personId: freund.id, reason: vorname ? tx('{name} ist schon dein Freund', { name: vorname }) : tx('Ihr seid schon befreundet') };
    }
    const laeuft = (this.state.settings.outgoingRequests || []).find((r) => r.code && normalizeInviteCode(r.code) === normalized);
    if (laeuft) {
      const vorname = (laeuft.name || '').split(' ')[0];
      return { ok: false, status: 'pending', code: normalized, reason: vorname ? tx('Anfrage an {name} läuft schon', { name: vorname }) : tx('Anfrage läuft schon') };
    }

    // Die Antwort wird gegeben, sobald der Server sie gesagt hat — das Nachladen des
    // übrigen Bestands darf sie nicht aufhalten.
    let loesen;
    const versprechen = new Promise((fertig) => { loesen = fertig; });
    this.push(tx('Code einlösen'), async () => {
      const { data, error } = await this.client.rpc('redeem_invite_code', { code: normalized });
      if (error) {
        loesen({ ok: false, status: 'invalid', code: normalized, reason: tx('Das hat gerade nicht geklappt') });
        return { error };
      }
      if (data?.ok && data.status === 'sent' && !data.accepted) {
        // Die gesendete Anfrage sofort mitführen: der Server hat sie eben bestätigt.
        this.state.settings.outgoingRequests = [...(this.state.settings.outgoingRequests || []), {
          id: `out-${normalized}`, code: normalized, name: data.name || '', personId: data.personId || null,
          initials: (data.name || '?').slice(0, 2), color: '#8A9FB8', meta: tx('Kurzcode · gerade eben'),
        }];
      }
      loesen(data);
      this.notify();
      await this.hydrate();
      this.notify();
      return { error: null };
    });
    return versprechen;
  }

  // ---------------------------------------------------------------------------------------
  // Crews & Räume
  // ---------------------------------------------------------------------------------------
  crewWithDerived(crew) {
    if ((this.state.blocked || []).length) crew = { ...crew, memberIds: crew.memberIds.filter((id) => !this.isBlocked(id)) };
    const activeMeet = this.state.meets.find((meet) => meet.status === 'active' && meet.crewId === crew.id);
    const freeCount = crew.memberIds.filter((id) => {
      if (id === ME) return this.state.settings.free.active;
      return this.state.people.find((entry) => entry.id === id)?.free?.active;
    }).length;
    return { ...crew, activeMeetId: activeMeet?.id || null, freeCount };
  }

  getCrews() {
    return this.state.crews
      .filter((crew) => (crew.memberIds || []).includes(ME))
      .map((crew) => this.crewWithDerived(crew));
  }

  getCrew(id) {
    const crew = this.state.crews.find((entry) => entry.id === id);
    return crew ? this.crewWithDerived(crew) : null;
  }

  createCrew(input) {
    const id = uuid();
    const crew = {
      id,
      name: input.name,
      color: input.color || null,
      groupImage: input.groupImage || null,
      memberIds: [ME, ...(input.memberIds || []).filter((entry) => entry !== ME)],
      unread: 0,
      creatorId: ME,
      adminIds: [ME],
    };
    this.state.crews.push(crew);
    this.state.messages[`r:${id}`] = [];
    this.notify();
    this.push(tx('Gruppe anlegen'), async () => {
      const angelegt = await this.client.from('crews').insert({
        id, name: crew.name, color: crew.color, group_image_path: crew.groupImage, creator_id: this.myUid,
      });
      if (angelegt.error) return angelegt;
      const weitere = crew.memberIds.filter((entry) => entry !== ME).map((entry) => ({ crew_id: id, user_id: entry }));
      if (weitere.length) {
        const dazu = await this.client.from('crew_members').insert(weitere);
        if (dazu.error) return dazu;
      }
      await this.hydrate();
      this.notify();
      return { error: null };
    });
    return this.crewWithDerived(crew);
  }

  updateCrew(crewId, patch) {
    const crew = this.state.crews.find((entry) => entry.id === crewId);
    if (!crew) return { ok: false, reason: tx('Crew nicht gefunden') };
    if (patch.name != null) crew.name = patch.name;
    if (patch.color != null) crew.color = patch.color;
    if (patch.groupImage !== undefined) crew.groupImage = patch.groupImage;
    this.notify();
    const zeile = {};
    if (patch.name != null) zeile.name = patch.name;
    if (patch.color != null) zeile.color = patch.color;
    if (patch.groupImage !== undefined) zeile.group_image_path = patch.groupImage;
    this.push(tx('Gruppe ändern'), () => this.client.from('crews').update(zeile).eq('id', crewId));
    return { ok: true };
  }

  // Runde 5 (C1): nur Admins, nur Freunde — dieselbe Regel steht in der Datenbank (crew_members_insert).
  addCrewMembers(crewId, personIds = []) {
    const crew = this.state.crews.find((entry) => entry.id === crewId);
    if (!crew) return { ok: false, added: [], reason: 'keineCrew' };
    if (!this.crewAdminIds(crew).includes(ME)) return { ok: false, added: [], reason: 'keinAdmin' };
    const freunde = new Set(this.state.people.filter((p) => p.friend !== false && !this.isBlocked(p.id)).map((p) => p.id));
    const neu = [...new Set(personIds)].filter((id) => id !== ME && !crew.memberIds.includes(id));
    if (neu.some((id) => !freunde.has(id))) return { ok: false, added: [], reason: 'keinFreund' };
    if (!neu.length) return { ok: true, added: [] };
    crew.memberIds.push(...neu);
    this.notify();
    this.push(tx('Personen hinzufügen'), async () => {
      const antwort = await this.client.from('crew_members').insert(neu.map((id) => ({ crew_id: crewId, user_id: this.uid(id) })));
      if (!antwort.error) { await this.hydrate(); this.notify(); }
      return antwort;
    });
    return { ok: true, added: neu };
  }

  crewAdminIds(crew) {
    if (!crew) return [];
    if (Array.isArray(crew.adminIds) && crew.adminIds.length) return crew.adminIds;
    return crew.creatorId ? [crew.creatorId] : [];
  }

  // Dieselben drei Wege wie im Demo-Gateway (v6 A12) — die Datenbank erzwingt dieselbe
  // Regel noch einmal über einen Trigger, hier wird sie nur vorweg beantwortet.
  leaveCrew(crewId) {
    const crew = this.state.crews.find((entry) => entry.id === crewId);
    if (!crew) return { ok: false, reason: tx('Gruppe nicht gefunden') };
    if (!crew.memberIds.includes(ME)) return { ok: false, reason: tx('Du bist kein Mitglied') };
    const andere = crew.memberIds.filter((id) => id !== ME);
    const admins = this.crewAdminIds(crew);
    if (!andere.length) return { ok: false, reason: 'aufloesen' };
    if (admins.length === 1 && admins[0] === ME) return { ok: false, reason: 'adminUebergabe' };
    crew.memberIds = andere;
    crew.adminIds = admins.filter((id) => id !== ME);
    this.state.crews = this.state.crews.filter((entry) => entry.id !== crewId);
    this.notify();
    this.push(tx('Gruppe verlassen'), () => this.client.from('crew_members').delete().eq('crew_id', crewId).eq('user_id', this.myUid));
    return { ok: true };
  }

  transferCrewAdmin(crewId, personId) {
    const crew = this.state.crews.find((entry) => entry.id === crewId);
    if (!crew || !crew.memberIds.includes(personId)) return { ok: false, reason: tx('Person ist kein Mitglied') };
    crew.adminIds = [personId];
    if (crew.creatorId === ME) crew.creatorId = personId;
    this.notify();
    this.push(tx('Adminrolle übergeben'), () => this.client.from('crew_members').update({ role: 'admin' }).eq('crew_id', crewId).eq('user_id', this.uid(personId)));
    return { ok: true };
  }

  dissolveCrew(crewId) {
    this.state.crews = this.state.crews.filter((entry) => entry.id !== crewId);
    delete this.state.messages[`r:${crewId}`];
    delete this.state.roomRead[`r:${crewId}`];
    this.notify();
    this.push(tx('Gruppe auflösen'), () => this.client.from('crews').delete().eq('id', crewId));
    return { ok: true };
  }

  roomKind(refId) {
    if (this.roomKinds.has(`r:${refId}`)) return this.roomKinds.get(`r:${refId}`);
    if (this.state.crews.some((c) => c.id === refId)) return 'crew';
    if (this.state.meets.some((m) => m.id === refId)) return 'meet';
    return 'person';
  }

  roomFromId(roomId) {
    const refId = roomId.slice(2);
    // v14: Raum-Nachrichten älter als 14 Tage werden ausgeblendet; Meet-Daten bleiben.
    const cutoff = toISODate(new Date(Date.now() - 14 * 86400000));
    const all = (this.state.messages[roomId] || []).filter((message) => !this.isBlocked(message.authorId));
    const messages = all.filter((message) => !message.date || message.date >= cutoff);
    const expired = all.length - messages.length;
    return {
      id: roomId,
      kind: this.roomKind(refId),
      refId,
      messages,
      lastReadCount: Math.max(0, (this.state.roomRead[roomId] || 0) - expired),
    };
  }

  getRoom(roomId) { return this.roomFromId(roomId); }

  getRoomForCrew(crewId) { return this.roomFromId(`r:${crewId}`); }

  getRoomForPerson(personId) { return this.roomFromId(`r:${personId}`); }

  // Liefert die Raum-UUID der Datenbank und legt den Raum an, falls es ihn noch nicht gibt.
  async ensureRoom(roomKey) {
    if (this.rooms.has(roomKey)) return this.rooms.get(roomKey);
    const refId = roomKey.slice(2);
    const art = this.roomKind(refId);
    let id = null;
    if (art === 'person') {
      const { data, error } = await this.client.rpc('get_or_create_dm_room', { other: this.uid(refId) });
      if (error) throw error;
      id = data;
    } else if (art === 'meet') {
      const { data, error } = await this.client.rpc('get_or_create_meet_room', { meet: refId });
      if (error) throw error;
      id = data;
    } else {
      const { data, error } = await this.client.from('rooms').select('id').eq('crew_id', refId).maybeSingle();
      if (error) throw error;
      id = data?.id || null;
    }
    if (!id) throw new Error(tx('Raum {raum} nicht auflösbar', { raum: roomKey }));
    this.rooms.set(roomKey, id);
    this.roomKinds.set(roomKey, art);
    return id;
  }

  appendLocalMessage(roomId, message) {
    if (!this.state.messages[roomId]) this.state.messages[roomId] = [];
    this.state.messages[roomId].push(message);
  }

  sendMessage(roomId, text) {
    const trimmed = (text || '').trim();
    if (!trimmed) return;
    const jetzt = now();
    const id = uuid();
    this.appendLocalMessage(roomId, {
      id, authorId: ME, kind: 'text', text: trimmed,
      date: toISODate(jetzt), time: hhmm(jetzt), at: jetzt.getTime(),
    });
    this.state.roomRead[roomId] = (this.state.messages[roomId] || []).length;
    this.notify();
    this.push(tx('Nachricht senden'), async () => {
      const room = await this.ensureRoom(roomId);
      const gesendet = await this.client.from('messages').insert({ id, room_id: room, author_id: this.myUid, kind: 'text', text: trimmed });
      if (gesendet.error) return gesendet;
      return this.client.from('room_reads').upsert({ room_id: room, user_id: this.myUid, last_read_count: this.state.roomRead[roomId] });
    });
  }

  markRoomRead(roomId) {
    const stand = (this.state.messages[roomId] || []).length;
    this.state.roomRead[roomId] = stand;
    this.bumpUnread(roomId);
    // R1 §8: Wer den Raum offen hat, braucht die Mitteilung darüber nicht mehr. Die Ablage
    // räumt der Server (Migration 0012); was schon auf dem Bildschirm steht, geht hier weg.
    schliesseMitteilung(raumMitteilungsTag(this.rooms.get(roomId)));
    this.push(tx('Lesestand merken'), async () => {
      if (!this.rooms.has(roomId)) return { error: null };
      const room = this.rooms.get(roomId);
      return this.client.from('room_reads').upsert({ room_id: room, user_id: this.myUid, last_read_count: stand });
    });
    // bewusst kein notify: Lesen soll den aktuellen Screen nicht neu rendern
  }

  canNudge(roomId) {
    if (roomId === `r:${ME}`) return { ok: false, remainingMs: 0, self: true };
    const last = this.local.nudgeCooldowns?.[roomId] || 0;
    const remaining = Math.max(0, NUDGE_COOLDOWN_MS - (Date.now() - last));
    return { ok: remaining === 0, remainingMs: remaining };
  }

  addRoomEvent(roomId, eintrag) {
    if (!roomId || !eintrag || !eintrag.kind) return null;
    const jetzt = now();
    const id = uuid();
    const datensatz = {
      id,
      authorId: eintrag.authorId || ME,
      kind: eintrag.kind,
      date: eintrag.date || toISODate(jetzt),
      time: eintrag.time || hhmm(jetzt),
      ...eintrag,
      at: jetzt.getTime(),
    };
    this.appendLocalMessage(roomId, datensatz);
    this.notify();
    const { kind, authorId, date, time, at, id: _id, ...rest } = datensatz;
    this.push(tx('Ereignis eintragen'), async () => {
      const room = await this.ensureRoom(roomId);
      return this.client.from('messages').insert({
        id, room_id: room, author_id: this.myUid, kind,
        payload: Object.keys(rest).length ? rest : null,
      });
    });
    return datensatz;
  }

  nudge(roomId) {
    const gate = this.canNudge(roomId);
    if (!gate.ok) {
      const sek = Math.ceil(gate.remainingMs / 1000);
      return { ok: false, reason: gate.self ? tx('Das bist du selbst') : tx('Wieder möglich in {zeit}', { zeit: `${Math.floor(sek / 60)}:${String(sek % 60).padStart(2, '0')}` }) };
    }
    this.local.nudgeCooldowns[roomId] = Date.now();
    this.local.nudgeSentAt[roomId] = Date.now();
    if (this.local.nudgeZurueck) delete this.local.nudgeZurueck[roomId];
    this.persistLocal();
    const ereignis = this.addRoomEvent(roomId, { kind: 'nudge', authorId: ME });
    return { ok: true, eventId: ereignis?.id || null };
  }

  nudgeSentAt(roomId) {
    return this.local.nudgeSentAt?.[roomId] || 0;
  }

  // Runde 4: Anstupser zurücknehmen — der Eintrag verschwindet (auch auf dem Server, eigene Zeile
  // darf man löschen: Regel messages_delete), die Sperre von 5 Minuten bleibt.
  nudgeZuruecknehmen(roomId) {
    const liste = this.state.messages[roomId] || [];
    let stelle = -1;
    for (let i = liste.length - 1; i >= 0; i -= 1) {
      const e = liste[i];
      if (e.kind === 'nudge' && e.authorId === ME && !e.zurueck) { stelle = i; break; }
    }
    const sperreBis = (this.local.nudgeCooldowns?.[roomId] || 0) + 5 * 60000;
    if (stelle < 0) return { ok: false, sperreBis };
    const [eintrag] = liste.splice(stelle, 1);
    this.local.nudgeZurueck = { ...(this.local.nudgeZurueck || {}), [roomId]: true };
    this.persistLocal();
    this.notify();
    if (eintrag?.id) this.push(tx('Anstupser zurücknehmen'), () => this.client.from('messages').delete().eq('id', eintrag.id).eq('author_id', this.myUid));
    return { ok: true, sperreBis };
  }

  nudgeZurueckgenommen(roomId) {
    return Boolean(this.local.nudgeZurueck?.[roomId]);
  }

  // Runde 4 (D7): Die eigene ungefähre Lage an die Freunde, die sie sehen dürfen (Regel in 0025).
  // Gerundet auf 3 Nachkommastellen (~100 m) — im Gerät, bevor etwas das Handy verlässt. Höchstens
  // alle 10 Minuten; nur wenn Teilen an ist und das Gerät die Erlaubnis schon hat oder man es gerade
  // eingeschaltet hat (sofort).
  standortSenden({ sofort = false } = {}) {
    const loc = this.state.settings.location || {};
    const geo = globalThis.navigator?.geolocation;
    if (!loc.use || !geo || !this.myUid) return;
    const jetzt = Date.now();
    if (!sofort && jetzt - (this.standortGesendetAm || 0) < 10 * 60000) return;
    this.standortGesendetAm = jetzt;
    geo.getCurrentPosition((position) => {
      const lat = Math.round(position.coords.latitude * 1000) / 1000;
      const lon = Math.round(position.coords.longitude * 1000) / 1000;
      this.state.settings.standort = { lat, lon, at: Date.now() };
      this.notify();
      this.push(tx('Standort teilen'), () => this.client.from('standorte')
        .upsert({ user_id: this.myUid, lat, lon, aktualisiert: new Date().toISOString() }, { onConflict: 'user_id' }));
    }, () => { this.standortGesendetAm = 0; }, { enableHighAccuracy: false, timeout: 15000, maximumAge: 5 * 60000 });
  }

  // Runde 4 (Jonathan: „Ich muss meine eigenen Nachrichten auch löschen können."): nur eigene.
  deleteMessage(roomId, messageId) {
    const liste = this.state.messages[roomId] || [];
    const stelle = liste.findIndex((e) => e.id === messageId);
    if (stelle < 0 || liste[stelle].authorId !== ME) return { ok: false };
    liste.splice(stelle, 1);
    if (typeof this.state.roomRead?.[roomId] === 'number') this.state.roomRead[roomId] = Math.min(this.state.roomRead[roomId], liste.length);
    this.notify();
    this.push(tx('Nachricht löschen'), () => this.client.from('messages').delete().eq('id', messageId).eq('author_id', this.myUid));
    return { ok: true };
  }

  nudgeSentRecently(roomId, withinMs = 60000) {
    return Date.now() - (this.local.nudgeSentAt?.[roomId] || 0) < withinMs;
  }

  respondNudge(roomId, messageId, response) {
    const message = (this.state.messages[roomId] || []).find((entry) => entry.id === messageId);
    if (message) message.response = response;
    if (response === 'zurueck') {
      this.local.nudgeCooldowns[roomId] = Date.now();
      this.local.nudgeSentAt[roomId] = Date.now();
      this.persistLocal();
      this.addRoomEvent(roomId, { kind: 'nudge', authorId: ME, zurueck: true });
    } else if (response === 'frei') {
      this.setFree({});
    } else {
      this.notify();
    }
    if (messageId) {
      this.push(tx('Antwort auf Anstupser'), () => this.client.rpc('respond_nudge', { message_id: messageId, response }));
    }
  }

  // ---------------------------------------------------------------------------------------
  // Meets
  // ---------------------------------------------------------------------------------------
  matchesContext(meet, context = {}) {
    return meetMatchesContext(meet, context, ME);
  }

  getMeets(query = {}) {
    const { context = {}, direction = 'upcoming', date } = query;
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

  // Ändern und Eintreten sind zwei verschiedene Rechte: Wer eingeladen ist, darf seine
  // Antwort ändern; sich SELBST eintragen darf man nur über die Gruppe (siehe Policies).
  // Ein „upsert" wäre beides in einem und scheiterte deshalb an einem Meet, in das man
  // eingeladen wurde — also genau im Normalfall. Darum: vorhandene Zeile ändern, sonst anlegen.
  setParticipation(meetId, state) {
    const meet = this.getMeet(meetId);
    if (!meet) return;
    const schonDabei = meet.participation[ME] !== undefined;
    meet.participation[ME] = state;
    // Runde 5 (E1): Wer absagt, fällt aus den Mitfahrten; als Fahrer gibt er Mitfahrer frei (Server: 0032).
    if (state === 'no') this.rideRolleLokal(meetId, null);
    this.notify();
    this.push(tx('Teilnahme speichern'), () => (schonDabei
      ? this.client.from('meet_participants').update({ state }).eq('meet_id', meetId).eq('user_id', this.myUid)
      : this.client.from('meet_participants').insert({ meet_id: meetId, user_id: this.myUid, state })));
  }

  setLoopResponse(meetId, dateISO, response) {
    const meet = this.getMeet(meetId);
    if (!meet?.loop) return;
    if (!meet.loop.responses[dateISO]) meet.loop.responses[dateISO] = {};
    const gleich = meet.loop.responses[dateISO][ME] === response;
    if (gleich) delete meet.loop.responses[dateISO][ME];
    else meet.loop.responses[dateISO][ME] = response;
    this.notify();
    this.push(tx('Loop-Antwort speichern'), () => (gleich
      ? this.client.from('loop_responses').delete().eq('meet_id', meetId).eq('date', dateISO).eq('user_id', this.myUid)
      : this.client.from('loop_responses').upsert({ meet_id: meetId, date: dateISO, user_id: this.myUid, response }, { onConflict: 'meet_id,date,user_id' })));
  }

  // --- Varianten ---
  variantRow(meetId, variant, id) {
    return {
      id, meet_id: meetId, kind: variant.kind, author_id: this.myUid,
      date: variant.date || null, time: variant.time || null, open: Boolean(variant.open), now: Boolean(variant.now),
      title: variant.title || null, icon: variant.icon || null, icon_key: variant.iconKey || null,
      category: variant.category || null, place: variant.place || null,
    };
  }

  addVariant(meetId, variant) {
    const meet = this.getMeet(meetId);
    if (!meet) return { ok: false, reason: tx('Meet nicht gefunden') };
    const cooldownUntil = this.local.variantCooldowns[meetId] || 0;
    if (Date.now() < cooldownUntil) return { ok: false, reason: tx('Kurz warten, dann erneut vorschlagen') };

    const same = meet.variants.find((entry) => {
      if (entry.kind !== variant.kind) return false;
      if (variant.kind === 'time') return entry.date === variant.date && entry.time === variant.time;
      return (entry.title || '').toLowerCase() === (variant.title || '').toLowerCase();
    });
    if (same) {
      if (!same.votes.includes(ME)) {
        same.votes.push(ME);
        this.push(tx('Stimme setzen'), () => this.client.from('meet_variant_votes').insert({ variant_id: same.id, user_id: this.myUid }));
      }
      this.notify();
      return { ok: true, merged: true, variantId: same.id };
    }

    const own = meet.variants.find((entry) => entry.kind === variant.kind && entry.authorId === ME);
    if (own) {
      Object.assign(own, variant, { id: own.id, authorId: ME });
      this.notify();
      this.push(tx('Vorschlag ändern'), () => this.client.from('meet_variants')
        .update(this.variantRow(meetId, variant, own.id)).eq('id', own.id));
      return { ok: true, edited: true, variantId: own.id };
    }

    const id = uuid();
    const created = { id, authorId: ME, votes: [ME], ...variant };
    meet.variants.push(created);
    this.local.variantCooldowns[meetId] = Date.now() + VARIANT_COOLDOWN_MS;
    this.persistLocal();
    this.notify();
    this.push(tx('Vorschlag anlegen'), async () => {
      const angelegt = await this.client.from('meet_variants').insert(this.variantRow(meetId, variant, id));
      if (angelegt.error) return angelegt;
      return this.client.from('meet_variant_votes').insert({ variant_id: id, user_id: this.myUid });
    });
    return { ok: true, variantId: id };
  }

  editVariant(meetId, variantId, patch) {
    const meet = this.getMeet(meetId);
    const variant = meet?.variants.find((entry) => entry.id === variantId);
    if (!variant || variant.authorId !== ME) return { ok: false, reason: tx('Nur eigene Vorschläge') };
    Object.assign(variant, patch);
    this.notify();
    this.push(tx('Vorschlag ändern'), () => this.client.from('meet_variants')
      .update(this.variantRow(meetId, variant, variantId)).eq('id', variantId));
    return { ok: true };
  }

  removeVariant(meetId, variantId) {
    const meet = this.getMeet(meetId);
    if (!meet) return;
    const variant = meet.variants.find((entry) => entry.id === variantId);
    if (!variant || variant.authorId !== ME) return;
    meet.variants = meet.variants.filter((entry) => entry.id !== variantId);
    this.notify();
    this.push(tx('Vorschlag entfernen'), () => this.client.from('meet_variants').delete().eq('id', variantId));
  }

  voteVariant(meetId, variantId) {
    const meet = this.getMeet(meetId);
    const variant = meet?.variants.find((entry) => entry.id === variantId);
    if (!variant) return;
    if (variant.votes.includes(ME)) {
      variant.votes = variant.votes.filter((id) => id !== ME);
      this.notify();
      this.push(tx('Stimme zurücknehmen'), () => this.client.from('meet_variant_votes').delete().eq('variant_id', variantId).eq('user_id', this.myUid));
      return;
    }
    // Eine Stimme pro Art (Zeit/Aktivität).
    const vorher = meet.variants.filter((entry) => entry.kind === variant.kind && entry.votes.includes(ME));
    vorher.forEach((entry) => { entry.votes = entry.votes.filter((id) => id !== ME); });
    variant.votes.push(ME);
    this.notify();
    this.push(tx('Stimme setzen'), async () => {
      for (const entry of vorher) {
        const weg = await this.client.from('meet_variant_votes').delete().eq('variant_id', entry.id).eq('user_id', this.myUid);
        if (weg.error) return weg;
      }
      return this.client.from('meet_variant_votes').insert({ variant_id: variantId, user_id: this.myUid });
    });
  }

  // --- Lebenszyklus ---
  decideMeet(meetId, options = {}) {
    const meet = this.getMeet(meetId);
    if (!meet) return { ok: false, reason: tx('Meet nicht gefunden') };
    if (meet.creatorId !== ME) return { ok: false, reason: tx('Nur der Organisator kann festlegen') };

    const { variantId } = options;
    const kind = options.kind || meet.variants.find((entry) => entry.id === variantId)?.kind;
    if (!kind) return { ok: false, reason: tx('Keine Variante gewählt') };

    const candidates = meet.variants.filter((entry) => entry.kind === kind);
    const chosen = variantId
      ? candidates.find((entry) => entry.id === variantId)
      : candidates.slice().sort((a, b) => b.votes.length - a.votes.length)[0];

    if (chosen) {
      if (kind === 'time') {
        if (chosen.date) meet.date = chosen.date;
        meet.time = chosen.open ? '' : (chosen.time || meet.time);
        meet.openTime = Boolean(chosen.open);
        meet.nowTime = Boolean(chosen.now);
      } else {
        if (chosen.title) meet.title = chosen.title;
        if (chosen.icon) meet.icon = chosen.icon;
        if (chosen.place) meet.place = chosen.place;
      }
    }
    const weg = candidates.map((entry) => entry.id);
    meet.variants = meet.variants.filter((entry) => entry.kind !== kind);
    if (!meet.variants.length && meet.status === 'open') meet.status = 'decided';
    this.notify();
    this.push(tx('Meet festlegen'), async () => {
      const geaendert = await this.client.from('meets').update({
        date: meet.date, time: meet.time, open_time: Boolean(meet.openTime), now_time: Boolean(meet.nowTime),
        title: meet.title, icon: meet.icon, place: meet.place, status: meet.status,
      }).eq('id', meetId);
      if (geaendert.error) return geaendert;
      if (!weg.length) return { error: null };
      return this.client.from('meet_variants').delete().in('id', weg);
    });
    return { ok: true, decided: chosen?.id || 'original' };
  }

  cancelMeet(meetId) {
    const meet = this.getMeet(meetId);
    if (!meet || meet.creatorId !== ME) return { ok: false, reason: tx('Nur der Organisator kann absagen') };
    meet.status = 'done';
    meet.cancelled = true;
    this.notify();
    this.push(tx('Meet absagen'), () => this.client.from('meets').update({ status: 'done', cancelled: true }).eq('id', meetId));
    return { ok: true };
  }

  deleteDraftMeet(meetId) {
    const meet = this.getMeet(meetId);
    if (!meet || meet.status !== 'draft') return { ok: false, reason: tx('Nur leere Entwürfe') };
    this.state.meets = this.state.meets.filter((entry) => entry.id !== meetId);
    this.notify();
    this.push(tx('Entwurf löschen'), () => this.client.from('meets').delete().eq('id', meetId));
    return { ok: true };
  }

  hideFromHistory(meetId) {
    const meet = this.getMeet(meetId);
    if (!meet) return;
    meet.hiddenFromHistory = true;
    this.notify();
    this.push(tx('Aus Verlauf ausblenden'), () => this.client.from('meet_private')
      .upsert({ meet_id: meetId, user_id: this.myUid, hidden: true }, { onConflict: 'meet_id,user_id' }));
  }

  // --- Mitbringen & Umfragen ---
  toggleBring(meetId, itemId) {
    const meet = this.getMeet(meetId);
    const item = meet?.bring.find((entry) => entry.id === itemId);
    if (!item) return;
    const drin = item.takenBy.includes(ME);
    item.takenBy = drin ? item.takenBy.filter((id) => id !== ME) : [...item.takenBy, ME];
    this.notify();
    this.push(tx('Mitbringen ändern'), () => (drin
      ? this.client.from('meet_bring_takers').delete().eq('item_id', itemId).eq('user_id', this.myUid)
      : this.client.from('meet_bring_takers').insert({ item_id: itemId, user_id: this.myUid })));
  }

  addBringItem(meetId, label) {
    const meet = this.getMeet(meetId);
    if (!meet || !(label || '').trim()) return;
    const id = uuid();
    meet.bring.push({ id, label: label.trim(), takenBy: [] });
    this.notify();
    this.push(tx('Mitbringen anlegen'), () => this.client.from('meet_bring_items')
      .insert({ id, meet_id: meetId, label: label.trim(), created_by: this.myUid }));
  }

  // Runde 3 (K3, P6): Rückgängig für einen eben angelegten Mitbringen-Punkt. Die Datenbank lässt
  // nur die Person löschen, die ihn angelegt hat (Regel meet_bring_items_delete); Übernahmen
  // hängen mit „on delete cascade" daran und gehen mit.
  removeBringItem(meetId, itemId) {
    const meet = this.getMeet(meetId);
    const vorher = meet?.bring?.length || 0;
    if (!meet || !vorher) return { ok: false };
    meet.bring = meet.bring.filter((entry) => entry.id !== itemId);
    if (meet.bring.length === vorher) return { ok: false };
    this.notify();
    this.push(tx('Mitbringen löschen'), () => this.client.from('meet_bring_items').delete().eq('id', itemId));
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
    this.push(tx('Abstimmen'), () => this.client.from('poll_votes')
      .upsert({ poll_id: pollId, user_id: this.myUid, option_id: optionId }, { onConflict: 'poll_id,user_id' }));
  }

  addPoll(meetId, pollInput) {
    const meet = this.getMeet(meetId);
    if (!meet) return;
    const pollId = uuid();
    const optionen = (pollInput.options || []).map((label, index) => ({ id: uuid(), label, votes: [], position: index }));
    meet.polls.push({ id: pollId, question: pollInput.question, options: optionen.map(({ position, ...rest }) => rest) });
    this.notify();
    this.push(tx('Umfrage anlegen'), async () => {
      const angelegt = await this.client.from('polls').insert({ id: pollId, meet_id: meetId, question: pollInput.question, created_by: this.myUid });
      if (angelegt.error) return angelegt;
      return this.client.from('poll_options').insert(optionen.map((o) => ({ id: o.id, poll_id: pollId, label: o.label, position: o.position })));
    });
  }

  getRoomPolls(roomId) {
    return this.state.roomPolls[roomId] || [];
  }

  addRoomPoll(roomId, pollInput) {
    if (!roomId) return null;
    const pollId = uuid();
    const optionen = (pollInput.options || []).map((label, index) => ({ id: uuid(), label, votes: [], position: index }));
    const poll = {
      id: pollId,
      question: pollInput.question,
      options: optionen.map(({ position, ...rest }) => rest),
      createdBy: ME,
      createdAt: new Date().toISOString(),
    };
    if (!this.state.roomPolls[roomId]) this.state.roomPolls[roomId] = [];
    this.state.roomPolls[roomId].push(poll);
    this.notify();
    this.push(tx('Umfrage im Raum anlegen'), async () => {
      const room = await this.ensureRoom(roomId);
      const angelegt = await this.client.from('polls').insert({ id: pollId, room_id: room, question: pollInput.question, created_by: this.myUid });
      if (angelegt.error) return angelegt;
      return this.client.from('poll_options').insert(optionen.map((o) => ({ id: o.id, poll_id: pollId, label: o.label, position: o.position })));
    });
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
    this.push(tx('Abstimmen'), () => this.client.from('poll_votes')
      .upsert({ poll_id: pollId, user_id: this.myUid, option_id: optionId }, { onConflict: 'poll_id,user_id' }));
  }

  setMeetIcon(meetId, icon) {
    const meet = this.getMeet(meetId);
    if (!meet || !icon) return;
    meet.icon = icon;
    this.notify();
    this.push(tx('Symbol ändern'), () => this.client.from('meets').update({ icon }).eq('id', meetId));
  }

  // --- Loop-Editor ---
  saveLoop(meetId, config) {
    const meet = this.getMeet(meetId);
    if (!meet) return;
    meet.loop = { active: true, responses: meet.loop?.responses || {}, ...config };
    if (config.time) meet.time = config.time;
    this.notify();
    const { responses, ...ohneAntworten } = meet.loop;
    this.push(tx('Loop speichern'), () => this.client.from('meets')
      .update({ loop: ohneAntworten, time: meet.time }).eq('id', meetId));
  }

  stopLoop(meetId) {
    const meet = this.getMeet(meetId);
    if (!meet?.loop) return;
    meet.loop.active = false;
    this.notify();
    const { responses, ...ohneAntworten } = meet.loop;
    this.push(tx('Loop stoppen'), () => this.client.from('meets').update({ loop: ohneAntworten }).eq('id', meetId));
  }

  // --- Teilnehmende nachtragen (v6 A13) ---
  updateMeetParticipants(meetId, personIds) {
    const meet = this.getMeet(meetId);
    if (!meet) return { ok: false, reason: tx('Meet nicht gefunden') };
    const gewuenscht = [...new Set((personIds || []).filter((id) => id && id !== ME))];
    if (!gewuenscht.length) return { ok: false, reason: tx('Mindestens eine Person') };
    const vorher = meet.personIds || [];
    meet.personIds = gewuenscht;
    for (const id of gewuenscht) if (!meet.participation[id]) meet.participation[id] = 'open';
    for (const id of vorher) if (!gewuenscht.includes(id)) delete meet.participation[id];
    if (!meet.crewId && meet.personIds.length > 1 && !meet.roomId) meet.roomId = `r:${meet.id}`;
    this.notify();
    const dazu = gewuenscht.filter((id) => !vorher.includes(id));
    const weg = vorher.filter((id) => !gewuenscht.includes(id));
    this.push(tx('Teilnehmende ändern'), async () => {
      if (dazu.length) {
        const ein = await this.client.from('meet_participants')
          .insert(dazu.map((id) => ({ meet_id: meetId, user_id: this.uid(id), state: 'open', invited_by: this.myUid })));
        if (ein.error) return ein;
      }
      if (weg.length) {
        const aus = await this.client.from('meet_participants').delete().eq('meet_id', meetId).in('user_id', weg.map((id) => this.uid(id)));
        if (aus.error) return aus;
      }
      if (meet.roomId === `r:${meet.id}`) await this.ensureRoom(meet.roomId);
      return { error: null };
    });
    return { ok: true, personIds: meet.personIds };
  }

  // --- Bewertung (privat) ---
  submitReview(meetId, review) {
    const meet = this.getMeet(meetId);
    if (!meet) return;
    if (!review) {
      delete meet.review;
      this.notify();
      this.push(tx('Bewertung löschen'), () => this.client.from('meet_private').update({ review: null }).eq('meet_id', meetId).eq('user_id', this.myUid));
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
    this.push(tx('Bewertung speichern'), () => this.client.from('meet_private')
      .upsert({ meet_id: meetId, user_id: this.myUid, review: meet.review }, { onConflict: 'meet_id,user_id' }));
  }

  getReviews() {
    return this.state.meets
      .filter((meet) => meet.review && meet.review.verdict)
      .map((meet) => ({ ...meet.review, meetId: meet.id, title: meet.title, date: meet.date }));
  }

  // ---------------------------------------------------------------------------------------
  // Entwürfe — gerätelokal, bis sie veröffentlicht werden
  // ---------------------------------------------------------------------------------------
  createDraft(input = {}) {
    const draft = {
      id: `d-${uuid().slice(0, 8)}`,
      withCrewId: input.withCrewId || null,
      withPersonIds: input.withPersonIds || [],
      when: null,
      whenProposals: [],
      idea: null,
      ideaAlternatives: [],
      loop: null,
      place: null,
      note: '',
      filter: { category: 'egal', radiusKm: 10, price: 'egal', query: '' },
    };
    this.state.drafts[draft.id] = draft;
    this.persistLocal();
    return draft;
  }

  getDraft(id) {
    return this.state.drafts[id] || null;
  }

  updateDraft(id, patch) {
    const draft = this.state.drafts[id];
    if (!draft) return;
    Object.assign(draft, patch);
    this.persistLocal();
    this.notify();
  }

  discardDraft(id) {
    delete this.state.drafts[id];
    this.persistLocal();
  }

  publishDraft(id) {
    const draft = this.state.drafts[id];
    if (!draft || !draft.idea) return { ok: false, reason: tx('Erst eine Idee wählen') };
    const meetId = uuid();
    const personIds = draft.withPersonIds.length ? draft.withPersonIds : undefined;
    const meet = {
      id: meetId,
      title: draft.idea.title,
      icon: draft.idea.icon || '✨',
      iconKey: draft.idea.iconKey,
      category: draft.idea.category || 'chillen',
      date: draft.when?.date || toISODate(now()),
      time: draft.when?.open ? '' : (draft.when?.time || '19:00'),
      openTime: Boolean(draft.when?.open),
      // Runde 4 (F2, P2-Vertrag .r4-api-zeit.md): „Jetzt" bleibt „Jetzt" — Marke neben der Uhrzeit.
      nowTime: Boolean(draft.when?.now),
      place: uebernimmOrt(draft.place),
      crewId: draft.withCrewId || undefined,
      personIds,
      creatorId: ME,
      status: 'open',
      participation: { [ME]: 'yes' },
      variants: [],
      bring: [],
      polls: [],
      note: draft.note || '',
      placePending: draft.place?.mode === 'person' && !draft.place?.approved,
    };
    // Runde 3 (G1): Foto und Herkunft des Vorschlags (siehe vorschlagsFoto). Gespeichert im Ort
    // (jsonb) — ändert sich der Ort später, geht das Foto mit ihm, wie es sein soll.
    Object.assign(meet, vorschlagsFoto(draft.idea.suggestionId ? this.getSuggestion(draft.idea.suggestionId) : null, meet.place));
    for (const alternative of draft.ideaAlternatives || []) {
      meet.variants.push({
        id: uuid(), kind: 'activity', authorId: ME, votes: [ME],
        title: alternative.title, icon: alternative.icon || '✨', place: alternative.place || null,
      });
    }
    for (const proposal of draft.whenProposals || []) {
      meet.variants.push({
        id: uuid(), kind: 'time', authorId: ME, votes: [ME],
        date: proposal.date, time: proposal.time || null, open: Boolean(proposal.open), now: Boolean(proposal.now),
      });
    }
    if (draft.loop) {
      const openTime = Boolean(draft.loop.open) || draft.loop.time === null;
      meet.loop = {
        active: true, responses: {},
        repeat: draft.loop.repeat || 'weekly',
        weekday: draft.loop.weekday ?? new Date(meet.date).getDay(),
        time: openTime ? null : (draft.loop.time || meet.time),
        interval: Math.max(1, Number(draft.loop.interval) || 1),
      };
    }
    const teilnehmende = [ME, ...(meet.crewId ? [] : (personIds || []))];
    for (const person of teilnehmende) if (!meet.participation[person]) meet.participation[person] = 'open';
    if (!meet.crewId && (personIds || []).length > 1) meet.roomId = `r:${meetId}`;
    if (meet.crewId) meet.roomId = `r:${meet.crewId}`;

    this.state.meets.push(meet);
    delete this.state.drafts[id];
    this.persistLocal();
    this.notify();

    const { responses, ...loopOhneAntworten } = meet.loop || {};
    this.push(tx('Meet veröffentlichen'), async () => {
      const angelegt = await this.client.from('meets').insert({
        id: meetId, title: meet.title, icon: meet.icon, icon_key: meet.iconKey || null,
        category: meet.category, date: meet.date, time: meet.time, open_time: meet.openTime, now_time: Boolean(meet.nowTime),
        place: {
          ...meet.place,
          ...(meet.suggestionId ? { vorschlagId: meet.suggestionId } : {}),
          ...(meet.bild ? { bild: meet.bild, bildSeite: meet.bildSeite, bildUrheber: meet.bildUrheber } : {}),
        },
        place_pending: meet.placePending, crew_id: meet.crewId || null,
        creator_id: this.myUid, status: 'open', note: meet.note,
        loop: meet.loop ? loopOhneAntworten : null,
      });
      if (angelegt.error) return angelegt;

      const zeilen = [{ meet_id: meetId, user_id: this.myUid, state: 'yes' }];
      for (const person of (personIds || [])) zeilen.push({ meet_id: meetId, user_id: this.uid(person), state: 'open', invited_by: this.myUid });
      const teil = await this.client.from('meet_participants').insert(zeilen);
      if (teil.error) return teil;

      if (meet.variants.length) {
        const varianten = await this.client.from('meet_variants').insert(meet.variants.map((v) => this.variantRow(meetId, v, v.id)));
        if (varianten.error) return varianten;
        const stimmen = await this.client.from('meet_variant_votes').insert(meet.variants.map((v) => ({ variant_id: v.id, user_id: this.myUid })));
        if (stimmen.error) return stimmen;
      }
      if (meet.roomId) await this.ensureRoom(meet.roomId);
      await this.hydrate();
      this.notify();
      return { error: null };
    });
    return { ok: true, meetId };
  }

  // ---------------------------------------------------------------------------------------
  // Entdecken, Orte, Gespeichertes
  // ---------------------------------------------------------------------------------------
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

  setRide(meetId, { rolle = null, plaetze } = {}) {
    if (!this.getMeet(meetId)) return { ok: false, reason: 'keinMeet' };
    if (rolle && !['fahrer', 'mitfahrer', 'selbst'].includes(rolle)) return { ok: false, reason: 'rolle' };
    const { geaendert, plaetze: n } = this.rideRolleLokal(meetId, rolle, plaetze);
    if (!geaendert) return { ok: true };
    this.notify();
    // Die eigene Zeile schreibt jede:r selbst (Regel meet_rides_*); das Freigeben der Mitfahrer
    // übernimmt der Trigger mitfahrer_freigeben.
    this.push(tx('Mitfahrt speichern'), () => (rolle
      ? this.client.from('meet_rides').upsert({
        meet_id: meetId, user_id: this.myUid, rolle, plaetze: rolle === 'fahrer' ? n : null, fahrer_id: null,
        aktualisiert: new Date().toISOString(),
      }, { onConflict: 'meet_id,user_id' })
      : this.client.from('meet_rides').delete().eq('meet_id', meetId).eq('user_id', this.myUid)));
    return { ok: true };
  }

  assignRide(meetId, mitfahrerId, fahrerId = null) {
    const antwort = this.rideZuordnenPruefen(meetId, mitfahrerId, fahrerId);
    if (antwort !== 'ok') return { ok: false, reason: antwort };
    this.rideZuordnenLokal(meetId, mitfahrerId, fahrerId);
    this.notify();
    this.push(tx('Mitfahrt zuordnen'), async () => {
      const { data, error } = await this.client.rpc('mitfahrt_zuordnen', {
        p_meet: meetId, p_mitfahrer: this.uid(mitfahrerId), p_fahrer: fahrerId ? this.uid(fahrerId) : null,
      });
      if (error) return { error };
      // Der Server hat anders entschieden (z. B. inzwischen voll) → wahren Stand holen.
      if (data !== 'ok') { await this.hydrate(); this.notify(); }
      return { error: null };
    });
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

  // Runde 2: Orte in der Umgebung kommen von unserer Funktion `vorschlaege` (Overpass,
  // Wikimedia Commons, Wikidata — nie vom Gerät). Gefragt wird mit dem eigenen Zuhause; die
  // Antwort gilt einen Tag. Bis sie da ist, stehen die allgemeinen Ideen da. Holt die Funktion
  // gerade neue Nachbarfelder, wird kurz darauf noch einmal gefragt.
  vorschlaegeNachladen() {
    this.orteNachlader ||= new OrteNachlader(
      (lage) => this.client.functions.invoke('vorschlaege', { body: { lat: lage.lat, lon: lage.lon, sprache: aktiveSprache() } }),
      () => this.notify(),
    );
    vorschlagsStandortAuffrischen(() => this.notify());
    this.orteNachlader.lade(this.getVorschlagsMitte());
  }

  // Bis zur echten Karte (T5) ist der Ortsbestand der mitgelieferte Katalog.
  searchPlaces(query) {
    const extra = [
      { name: 'Strandbad Lochau', address: 'Seestraße 1, Lochau', lat: 47.52482, lon: 9.74779, x: 0.68, y: 0.14 },
      { name: 'Reutepark', address: 'Reutegasse, Bregenz', lat: 47.50253, lon: 9.72326, x: 0.4, y: 0.58 },
      { name: 'Molo Bregenz', address: 'Seepromenade 4, Bregenz', lat: 47.50427, lon: 9.73945, x: 0.3, y: 0.36 },
    ];
    const fromSuggestions = this.state.suggestions.filter((entry) => entry.place).map((entry) => ({ ...entry.place }));
    const all = [...fromSuggestions, ...extra];
    const q = (query || '').trim().toLowerCase();
    if (!q) return all;
    return all.filter((place) => `${place.name} ${place.address || ''}`.toLowerCase().includes(q));
  }

  getPersonPlace(personId) {
    return this.state.personPlaces[personId] || null;
  }

  requestPersonPlace(personId, options = {}) {
    if (!this.state.personPlaces[personId]) {
      this.state.personPlaces[personId] = { name: 'Adresse', address: '', approved: false };
    }
    this.state.personPlaces[personId].requested = true;
    const offen = this.state.placeRequests.find((r) => r.hostId === personId && r.status === 'open'
      && (!options.meetId || r.meetId === options.meetId || r.meetId === null));
    if (!offen) {
      const id = uuid();
      this.state.placeRequests.push({
        id, meetId: options.meetId || null, hostId: personId, requesterId: ME,
        status: 'open', createdAt: new Date().toISOString(),
      });
      this.push(tx('Ort anfragen'), () => this.client.from('place_requests').insert({
        id, meet_id: options.meetId || null, host_id: this.uid(personId), requester_id: this.myUid,
      }));
    }
    this.notify();
  }

  getPlaceRequests(query = {}) {
    return this.state.placeRequests.filter((r) => (!query.meetId || r.meetId === query.meetId)
      && (!query.hostId || r.hostId === query.hostId)
      && (!query.status || r.status === query.status));
  }

  respondPlaceRequest(requestId, accept) {
    const request = this.state.placeRequests.find((r) => r.id === requestId);
    if (!request || request.status !== 'open') return { ok: false };
    request.status = accept ? 'accepted' : 'declined';
    request.respondedAt = new Date().toISOString();
    const meet = request.meetId ? this.getMeet(request.meetId) : null;
    if (meet) {
      meet.placePending = false;
      if (accept) {
        const zuhause = this.state.settings.homeAddress || {};
        meet.place = uebernimmOrt({
          ...zuhause,
          name: `Bei ${this.state.settings.name || ''}`.trim(),
          address: [zuhause.name, zuhause.city].filter(Boolean).join(', '),
        });
      } else {
        meet.place = { name: '', address: '', x: 0.5, y: 0.5 };
      }
    }
    this.notify();
    this.push(tx('Ortsanfrage beantworten'), async () => {
      const { error } = await this.client.rpc('respond_place_request', { request_id: requestId, accept: Boolean(accept) });
      if (error) return { error };
      await this.hydrate();
      this.notify();
      return { error: null };
    });
    return { ok: true, status: request.status };
  }

  approvePersonPlace(personId) {
    const place = this.state.personPlaces[personId];
    if (!place || place.approved) return;
    place.approved = true;
    this.notify();
  }

  getSavedFolders() {
    return this.state.folders;
  }

  createFolder(name) {
    const id = uuid();
    const folder = { id, name };
    this.state.folders.push(folder);
    this.notify();
    this.push(tx('Ordner anlegen'), () => this.client.from('saved_folders').insert({ id, user_id: this.myUid, name }));
    return folder;
  }

  getSavedIdeas(folderId) {
    const all = [...this.state.savedIdeas].sort((a, b) => b.createdAt - a.createdAt);
    if (!folderId || folderId === 'all') return all;
    return all.filter((idea) => idea.folderId === folderId);
  }

  saveIdea(idea, options = {}) {
    const id = uuid();
    const created = { id, folderId: options.folderId || null, createdAt: Date.now(), ...idea };
    this.state.savedIdeas.push(created);
    this.notify();
    const { id: _id, folderId, createdAt, ...daten } = created;
    this.push(tx('Idee speichern'), () => this.client.from('saved_ideas')
      .insert({ id, user_id: this.myUid, folder_id: options.folderId || null, data: daten }));
    return created;
  }

  removeSavedIdea(id) {
    this.state.savedIdeas = this.state.savedIdeas.filter((idea) => idea.id !== id);
    this.notify();
    this.push(tx('Idee entfernen'), () => this.client.from('saved_ideas').delete().eq('id', id));
  }

  // ---------------------------------------------------------------------------------------
  // Catch-up
  // ---------------------------------------------------------------------------------------
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

  // ---------------------------------------------------------------------------------------
  // Melden & Blockieren (Rechtspflicht, Prüfschritt T6)
  //
  // Der Server setzt die Blockierung bereits durch: ein blockiertes Profil ist nicht mehr
  // lesbar, eine Freundschaft wird per Trigger beendet, ein Kurzcode führt nicht mehr
  // zueinander (T1). Was der Server NICHT kann, ist alte Nachrichten in einem gemeinsamen
  // Gruppenraum verschwinden zu lassen — sie gehören der Gruppe, nicht der Blockierung.
  // Deshalb blendet diese Seite sie aus: Was blockiert ist, sieht man nicht mehr.
  // ---------------------------------------------------------------------------------------
  isBlocked(personId) {
    return (this.state.blocked || []).includes(personId);
  }

  getBlockedPeople() {
    return (this.state.blockedPeople || []);
  }

  blockPerson(personId, options = {}) {
    if (!personId || personId === ME) return { ok: false, reason: tx('Das bist du selbst') };
    const person = this.state.people.find((p) => p.id === personId);
    this.state.blocked = [...new Set([...(this.state.blocked || []), personId])];
    if (person) {
      this.state.blockedPeople = [...(this.state.blockedPeople || []),
        { id: person.id, name: person.name, initials: person.initials, color: person.color, photo: person.photo }];
    }
    this.state.people = this.state.people.filter((p) => p.id !== personId);
    const s = this.state.settings;
    const patch = { bestFriendIds: (s.bestFriendIds || []).filter((id) => id !== personId) };
    if (s.specialPerson?.personId === personId) patch.specialPerson = null;
    this.updateSettings(patch);
    this.notify();

    this.push(tx('Person blockieren'), async () => {
      const geblockt = await this.client.from('blocks').insert({
        blocker_id: this.myUid,
        blocked_id: this.uid(personId),
        blocked_name: person?.name || null,
        blocked_initials: person?.initials || null,
        blocked_color: person?.color || null,
      });
      if (geblockt.error) return geblockt;
      if (options.grund) {
        const gemeldet = await this.client.from('reports').insert({
          reporter_id: this.myUid, reported_id: this.uid(personId), reason: options.grund, note: options.notiz || null,
        });
        if (gemeldet.error) return gemeldet;
      }
      await this.hydrate();
      this.notify();
      return { error: null };
    });
    return { ok: true };
  }

  unblockPerson(personId) {
    this.state.blocked = (this.state.blocked || []).filter((id) => id !== personId);
    this.state.blockedPeople = (this.state.blockedPeople || []).filter((p) => p.id !== personId);
    this.notify();
    this.push(tx('Blockierung aufheben'), async () => {
      const weg = await this.client.from('blocks').delete().eq('blocker_id', this.myUid).eq('blocked_id', this.uid(personId));
      if (weg.error) return weg;
      await this.hydrate();
      this.notify();
      return { error: null };
    });
    return { ok: true };
  }

  reportContent(input = {}) {
    if (!input.grund) return { ok: false, reason: tx('Grund fehlt') };
    this.push(tx('Melden'), () => this.client.from('reports').insert({
      reporter_id: this.myUid,
      reported_id: input.personId ? this.uid(input.personId) : null,
      message_id: input.messageId || null,
      meet_id: input.meetId || null,
      reason: input.grund,
      note: input.notiz || null,
    }));
    return { ok: true };
  }
}
