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
import { telefonServerLage, telefonServerSetzen, telefonServerVergessen } from '../core/native.js';
import {
  isSharedWith, projectProfile, normalizeInviteCode, isInviteCodeFormat,
  sortAndFilterMeets, meetMatchesContext, uebernimmOrt,
  naechsteFreiGrenze, freiAbgelaufen, freiAnker, freiMitAnker, freiFuerAndere,
  busyBereinigen, busyVollstaendig, busyFuerFreunde, busyWoche, meetZeiten, crewAdminGrund,
  findListe, findEintragPruefen, gemerktIdsBereinigen,
  FRAGE_GUELTIG_MS, FRAGE_ANTWORTEN, frageGueltig, frageErlaubt, frageZaehltNoch,
  ANREISE_ARTEN, anreiseZeile, rolleAusAnreise, genauigkeitVon,
  chatEintraege, ankunftListe, vergangeneMeetChats, gruppeMitGenau,
  standortGenauigkeitNorm, standortGenauigkeitFuer, lageGroeber, lageAusPosition, lageSendenLohnt,
  genauigkeitKlemmen, GENAUIGKEIT_M, standortErlaubnisSchonDa, standortErlaubnisMerken,
} from './projections.js';
// Runde 11 (C1): „Chat löschen" gilt nur für mich — dieselbe Regel wie im Geräte-Gateway.
import { nachGeleert } from './projections.js';
// Runde 7 (E1/E2): Die Wochenrechnung (Nachtschicht, aneinanderstoßende Fenster, Sommerzeit)
// steht in core/belegt.js. Beide Gateways rechnen damit — nachgebaut wäre sie zweimal falsch.
// Runde 8 (R8-39): Die Blöcke mit Titel rechnet projections.js busyWoche — mit derselben Funktion.
import { belegtJetzt } from '../core/belegt.js';
// Der Entdecken-Katalog ist redaktioneller App-Inhalt, keine Nutzerdaten — er wird
// mitgeliefert, nicht gespeichert. Echte Ortssuche kommt mit der Karte (T5).
import { seedSuggestions } from './seed/discover.js';
import { findGrundbestand, findMitGrundbestand } from './seed/find.js';

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

// Fehlt das Objekt in der Datenbank WIRKLICH? PostgREST meldet das entweder mit eigenem Code
// (PGRST205/PGRST202, „Could not find the table … in the schema cache") oder reicht den
// Postgres-Code 42P01 durch. Jeder andere Fehler ist ein ANDERER Fehler — und darf nie dazu
// führen, dass die App auf einen Weg zurückfällt, der MEHR herausgibt (Welle 3, Mangel 5).
function fehltDasObjekt(fehler) {
  if (!fehler) return false;
  const code = String(fehler.code || '');
  if (code === '42P01' || code === 'PGRST205' || code === 'PGRST202') return true;
  return /does not exist|could not find the (table|relation)/i.test(String(fehler.message || ''));
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
        // Runde 7 (E1): Busy-Fenster (Tabelle belegte_zeiten). Runde 8 (R8-39): Titel und Schloss
        // je Fenster; eine Freigabe-Einstellung gibt es nicht mehr.
        belegt: [],
        // Runde 8 (R8-50): gemerkte Find-Einträge (privat, in settings.data).
        gemerktIds: [],
        // Runde 4 (Jonathan): Frei-Hinweise standardmäßig von allen Freunden.
        freiHints: { mode: 'alle', customIds: [] },
        bestFriendIds: [], specialPerson: null,
        notifications: { invitations: true, mentions: true, chat: true, updates: true, reminder: true, reminderMinutes: 15 },
        appearance: { theme: 'system' },
        location: { use: true, shareMode: 'niemand', shareIds: [] },
        // Runde 10: wie im Geräte-Datenweg — der Standard steht schon, nichts nachzustellen.
        standardAn: 1,
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
      // Runde 7 (E5): die flüchtigen Fragen — sie leben nur, solange sie gültig sind.
      fragen: [],
      // Runde 11 (B7): je Person der Zeitpunkt, an dem ihr „frei" endet (free_status.gilt_bis).
      // Steht NEBEN dem Datenvertrag: die Ansichten fragen weiter nur person.free.
      freiGrenzen: {},
      // Runde 7 (A6): Ankunftsstempel je Meet → { [meetId]: { [personId]: ms } }.
      ankuenfte: {},
      // Routen speichern (0047): meine Abholadresse und die Adressen derer, die bei mir mitfahren — { [meetId]: { [personId]: ort } }.
      abholadresse: null,
      abholadressen: {},
      abholzeiten: {},
      // Runde 8 (R8-50): Find — die Einträge (Tabelle find_eintraege) und ob ich sie anlegen darf
      // (Tabelle find_admins, 0038). Beides entscheidet der Server, nicht die App.
      findEintraege: [],
      istAdmin: false,
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
    // Runde 11 (C4, D8): Standort auf Abruf (eigener Kanal) und der Weg der nativen App bei geschlossener App.
    this.standortAnfragenEinrichten();
    this.standortTelefonEinrichten();
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
      belegteZeiten, fragen, ankuenfte, findEintraege, findAdmin, meetZeitenZeilen, abholadresseZeilen, abholadressenAuto, abholzeitZeilen,
    ] = await Promise.all([
      t('profiles'), t('settings'), t('invite_codes'), t('free_status'), t('resources'),
      t('friendships'), t('friend_requests'), t('blocks'),
      t('crews'), t('crew_members'), t('meets'), t('meet_participants'),
      t('meet_variants'), t('meet_variant_votes'), t('meet_bring_items'), t('meet_bring_takers'),
      t('polls'), t('poll_options'), t('poll_votes'), t('loop_responses'), t('meet_private'),
      t('rooms'), c.from('messages').select('*').order('created_at', { ascending: true }), t('room_reads'),
      t('place_requests'), t('saved_folders'), t('saved_ideas'),
      // Runde 4 (D7): geteilte Standorte — die Regel standorte_select liefert nur, was die Person
      // mit mir teilt (0025).
      // Runde 7, Welle 2 (M1): Gelesen wird die SICHT standorte_sicht, nicht die Tabelle. Sie
      // wendet die Entscheidung der jeweiligen Person an („genau" oder „nur ungefähr", für alle
      // oder für mich) — auf dem Server, damit kein Gerät sie umgehen kann. Gibt es die Sicht
      // noch nicht (Migration 0034 nicht eingespielt), gilt der alte Weg: die Tabelle selbst,
      // deren Zeilen dann noch von der alten Rundung stammen.
      //
      // Runde 7, Welle 3 (Mangel 5): Dieser Rückfall gilt jetzt NUR für genau diesen einen Fall.
      // Bis Welle 2 fing er JEDEN Fehler ab — Rechtefehler, Zeitüberschreitung,
      // PostgREST-Schluckauf. In jedem dieser Fälle las die App die ROHE Tabelle; die lässt nach
      // 0025 jeden Freund hinein und umgeht damit die „nur ungefähr"-Entscheidung ANDERER
      // Personen, ohne dass irgendwo etwas davon stand. Eine Entscheidung über fremde
      // Sichtbarkeit darf bei einem Fehler nie nach „mehr zeigen" fallen, sondern nach „nichts
      // zeigen" — dann bleibt die Karte eben leer.
      t('standorte_sicht')
        .then((r) => (fehltDasObjekt(r.error) ? t('standorte') : r))
        .then((r) => (r.error ? { data: [] } : r)),
      // Runde 5 (E1): Mitfahrten (0030). Fehlt die Tabelle noch, bleibt es leer.
      t('meet_rides').then((r) => (r.error ? { data: [] } : r)),
      // Runde 7 (0034). Bis die Migration gelaufen ist, bleibt es leer, statt den Start der App
      // zu kosten — dieselbe Vorsicht wie bei standorte und meet_rides.
      //
      // Runde 8 (R8-39, 0037): Busy wird über die SICHT belegte_zeiten_sicht gelesen, nicht über
      // die Tabelle. Die Sicht gibt meine eigenen Fenster vollständig heraus, die meiner Freunde
      // mit Titel — außer hinter einem Schloss: dort fehlt der Titel schon in der Datenbank. Die
      // Tabelle selbst liest seit 0037 nur noch ihre Besitzerin. Gibt es die Sicht noch nicht
      // (0037 nicht eingespielt), gilt der alte Weg: die Tabelle, in der es noch keine Titel gibt.
      // Jeder ANDERE Fehler fällt nach „nichts zeigen", nie nach „mehr zeigen" (wie standorte_sicht).
      t('belegte_zeiten_sicht')
        .then((r) => (fehltDasObjekt(r.error) ? c.from('belegte_zeiten').select('user_id, fenster') : r))
        .then((r) => (r.error ? { data: [] } : r)),
      t('fragen').then((r) => (r.error ? { data: [] } : r)),
      t('meet_ankuenfte').then((r) => (r.error ? { data: [] } : r)),
      // Runde 8 (R8-50, 0038): Find. Lesen dürfen alle Angemeldeten; ob ICH anlegen darf, sagt
      // meine eigene Zeile in find_admins (die Regel gibt nur sie heraus). Fehlt die Tabelle
      // noch, ist Find leer und niemand Admin.
      t('find_eintraege').then((r) => (r.error ? { data: [] } : r)),
      c.from('find_admins').select('user_id').eq('user_id', this.myUid).then((r) => (r.error ? { data: [] } : r)),
      // Runde 11 (B4/D5, 0041): Zeitfenster der zugesagten Meets meiner Freunde — Datum, Beginn,
      // Ende, sonst nichts. Für die grauen Blöcke „beschäftigt" im Profil: Meets, in denen ich nicht
      // bin, liegen sonst gar nicht auf diesem Gerät. Fehlt die Sicht noch (0041 nicht eingespielt)
      // oder scheitert sie, bleibt es leer — dann zeigt die Karte, was das Gerät selbst kennt.
      t('meet_zeiten_sicht').then((r) => (r.error ? { data: [] } : r)),
      // Routen speichern (0047): meine eigene Abholadresse (die Regel gibt nur meine Zeile heraus) und die Adressen derer,
      // die bei MIR mitfahren — nur die. Fehlt die Migration noch, bleibt beides leer, statt den Start zu kosten.
      t('abholadressen').then((r) => (r.error ? { data: [] } : r)),
      c.rpc('abholadressen_meines_autos').then((r) => (r.error ? { data: [] } : r)),
      // 0048: meine eigene Abholzeit (nur Minuten, keine Adresse der anderen) — der Fahrer hat sie berechnen lassen.
      c.rpc('meine_abholzeit').then((r) => (r.error ? { data: [] } : r)),
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
        // Runde 7 (E6): Die ART kommt vom Server (0034); alte Zeilen ohne Art hebt
        // anreiseZeile() aus der Rolle — dieselbe Übersetzung wie im Geräte-Gateway.
        art: z.art || null,
        rolle: z.rolle, plaetze: z.plaetze, fahrerId: z.fahrer_id ? this.sid(z.fahrer_id) : null, am: Date.parse(z.aktualisiert) || 0,
        // 0047: 'standort' = vom aktuellen Standort abholen; leer = Standard, die Abholadresse.
        abholung: z.abholung === 'standort' ? 'standort' : null,
      };
    }
    this.ridesStand = ridesJeMeet;
    const state = this.emptyState();

    // Routen speichern (0047): meine Abholadresse; dazu die der Mitfahrenden, die bei mir eingestiegen sind.
    const meineAdresse = rows(abholadresseZeilen).find((z) => z.user_id === this.myUid);
    state.abholadresse = meineAdresse && hatLage(meineAdresse)
      ? { name: meineAdresse.name || '', city: meineAdresse.city || '', lat: meineAdresse.lat, lon: meineAdresse.lon, quelle: meineAdresse.quelle === 'standort' ? 'standort' : 'suche', at: Date.parse(meineAdresse.geaendert) || 0 }
      : null;
    for (const z of rows(abholadressenAuto)) {
      if (!hatLage(z)) continue;
      if (!state.abholadressen[z.meet_id]) state.abholadressen[z.meet_id] = {};
      state.abholadressen[z.meet_id][this.sid(z.user_id)] = { name: z.name || '', city: z.city || '', lat: z.lat, lon: z.lon };
    }

    this.abholzeitEintragen(state, rows(abholzeitZeilen));

    // Runde 7 (A6): Ankünfte je Meet — { [meetId]: { [personId]: ms } }.
    for (const z of rows(ankuenfte)) {
      if (!state.ankuenfte[z.meet_id]) state.ankuenfte[z.meet_id] = {};
      state.ankuenfte[z.meet_id][this.sid(z.user_id)] = Date.parse(z.da_seit) || 0;
    }

    // Runde 7 (E5): Fragen. Der Server gibt nur gültige heraus (Regel fragen_select prüft
    // `now() < bis`); die Prüfung hier ist die zweite Uhr im Gerät, nicht eine zweite Regel.
    const zurueckBehalten = (this.state?.fragen || []).filter((frage) => frage.zurueckgenommen && frageZaehltNoch(frage));
    const zurueck = new Set(zurueckBehalten.map((frage) => frage.id));
    state.fragen = rows(fragen).map((z) => ({
      id: z.id,
      vonId: this.sid(z.von_id),
      anId: z.an_id ? this.sid(z.an_id) : null,
      crewId: z.crew_id || null,
      zielSchluessel: z.crew_id ? `c:${z.crew_id}` : `p:${this.sid(z.an_id)}`,
      at: Date.parse(z.gestellt) || 0,
      bis: Date.parse(z.bis) || 0,
      antwort: z.antwort || null,
      antwortAt: Date.parse(z.antwort_am) || 0,
    })).filter((frage) => frageGueltig(frage) && !zurueck.has(frage.id));
    // Zurückgenommene kennt der Server nicht mehr — für die Stundengrenze behält sie das Gerät.
    state.fragen.push(...zurueckBehalten);

    // Runde 8 (R8-39): Busy. Was hier ankommt, hat die Sicht belegte_zeiten_sicht schon
    // entschieden: meine Fenster ganz, die meiner FREUNDE ohne Titel hinter einem Schloss, von
    // allen anderen nichts. busyFuerFreunde unten ist die zweite Uhr im Gerät, nicht eine
    // zweite Regel — dieselbe Funktion, die der Geräte-Datenweg benutzt.
    const belegtVon = new Map(rows(belegteZeiten).map((z) => [z.user_id, z]));

    // Runde 11 (B4/D5): Meet-Zeiten je Freundin, in der Roh-Form von projections.js meetZeiten.
    // Nur Freunde (die Sicht gibt von anderen nichts heraus; hier steht die zweite Uhr).
    state.meetZeiten = {};
    for (const z of rows(meetZeitenZeilen)) {
      const id = this.sid(z.user_id);
      if (id === ME) continue;
      if (!state.meetZeiten[id]) state.meetZeiten[id] = [];
      state.meetZeiten[id].push({ datum: String(z.datum || '').slice(0, 10), von: z.von || '', bis: z.bis || null });
    }

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
    const freeByUser = new Map(rows(freeStatus).map((f) => [f.user_id, this.freiAusZeile(f)]));
    // Runde 11 (B7): Und daneben die Grenze jeder Zeile — sie gehört nicht in den Datenvertrag,
    // aber ohne sie könnte diese App nur sagen, wer BEIM LADEN frei war.
    state.freiGrenzen = {};
    for (const f of rows(freeStatus)) {
      const grenze = this.freiGrenzeAusZeile(f);
      if (grenze) state.freiGrenzen[f.user_id] = grenze;
    }

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
        // Runde 11 (C1): Antwort auf eine Nachricht (Migration 0042) — dieselbe Form wie im Gerät.
        ...(m.reply_to ? { replyTo: m.reply_to } : {}),
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
    // Runde 7 (F9): Ein geteilter Standort trägt seine GENAUIGKEIT in Metern mit. Sie ist keine
    // Schätzung, sondern das, was das Gerät der anderen Person gemeldet hat.
    // Runde 7, Welle 2 (M1): Hat diese Person für mich „nur ungefähr" gewählt, hat der SERVER die
    // Zeile schon gerundet und die Genauigkeit auf mindestens 100 m gesetzt (Sicht
    // standorte_sicht, 0034) — hier kommt also bereits an, was ich sehen darf, und nichts anderes.
    // Die Karte darf aus keiner der beiden Formen einen Punkt machen.
    const standortVon = (id) => {
      const zeile = rows(standorte).find((s) => s.user_id === id);
      return zeile ? {
        lat: zeile.lat,
        lon: zeile.lon,
        at: Date.parse(zeile.aktualisiert) || 0,
        genauigkeitM: genauigkeitVon({ genauigkeitM: zeile.genauigkeit_m }, 'geteilt'),
      } : null;
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
        // Runde 8 (R8-39): Busy. Runde 11 (D5, 0041): nur noch die Zeit — kein Titel, kein Schloss.
        // Nur Freunde haben hier überhaupt etwas stehen; die Sicht gibt von allen anderen nichts heraus.
        belegt: friendIds.has(p.id) ? busyFuerFreunde(belegtVon.get(p.id)?.fenster) : [],
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
      // Runde 8 (R8-39): die eigenen Busy-Fenster, vollständig (Tabelle belegte_zeiten).
      belegt: busyBereinigen(belegtVon.get(this.myUid)?.fenster),
      // Runde 8 (R8-50): gemerkte Find-Einträge — privat, aus settings.data.
      gemerktIds: gemerktIdsBereinigen(meineSettings.gemerktIds),
      standort: standortVon(this.myUid),
      ...resourceBlock(this.myUid),
      // Runde 11 (B7): Ein eigenes „frei" ohne Anker (Altbestand vor Runde 7) bekommt hier
      // einen — sonst könnte es nie ablaufen. Geschrieben wird es gleich danach
      // (freiZeileNachtragen, am Ende von _hydrate).
      free: freiMitAnker(freeByUser.get(this.myUid) || state.settings.free),
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
        // Runde 9: Nicht der Code selbst, sondern der Weg — „über deinen Code".
        return { id: r.id, name: p.name || tx('Unbekannt'), initials: p.initials || '?', color: p.color || '#8A9FB8', photo: p.photo_path || null, code: r.code, meta: tx('über deinen Code') };
      }),
      outgoingRequests: anfragen.filter((r) => r.from_id === this.myUid && r.status === 'open').map((r) => {
        const p = profilVon(r.to_id);
        return { id: r.id, name: p.name || tx('Unbekannt'), initials: p.initials || '?', color: p.color || '#8A9FB8', photo: p.photo_path || null, code: r.code, meta: tx('Kurzcode') };
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

    // Runde 8 (R8-50): Find — Zeilen in die Form des Datenvertrags (projections.js findListe
    // rechnet beim Lesen Score und Sortierung, genau wie im Geräte-Datenweg).
    state.findEintraege = rows(findEintraege).map((z) => this.findAusZeile(z)).filter(Boolean);
    state.istAdmin = rows(findAdmin).some((z) => z.user_id === this.myUid);

    this.state = state;
    // Runde 11 (B7): Jetzt, wo der Bestand steht, die eigene Frei-Zeile in Ordnung bringen.
    this.freiZeileNachtragen(rows(freeStatus).find((f) => f.user_id === this.myUid));
    return state;
  }

  // Runde 11 (B7) — gemessener Fehler: In der echten Datenbank standen Zeilen auf „frei", die
  // weder einen Anker (set_at) noch eine Grenze (gilt_bis) hatten. Solche Zeilen konnten nie
  // ablaufen: das eigene Gerät fand nichts zum Rechnen, und für Freunde ließ die Abfrage sie
  // durch („keine Grenze" hieß „läuft nie ab"). Ergebnis: Leute standen tagelang auf „frei".
  //
  // Reparieren kann das nur das Gerät, dem die Zeile gehört — die Uhrzeit ist privat, und
  // schreiben darf jede:r nur die eigene Zeile. Also: beim Laden EINMAL sauber schreiben.
  // Schon abgelaufen → aus. Noch gültig, aber ohne Grenze → Anker und Grenze nachtragen.
  freiZeileNachtragen(zeile) {
    if (!zeile?.active) return;
    const free = this.state.settings.free;
    if (!free?.active) return;
    if (freiAbgelaufen(free, this.state.settings.freeResetTime)) {
      this.freiAufraeumen();
      return;
    }
    if (!zeile.set_at || !zeile.gilt_bis) this.writeFree(free);
  }

  // Eine Zeile aus find_eintraege → Eintrag des Datenvertrags. Zeitstempel werden zu ms.
  findAusZeile(z) {
    if (!z || !z.id || !z.ort) return null;
    const von = z.wann_von ? Date.parse(z.wann_von) : NaN;
    const bis = z.wann_bis ? Date.parse(z.wann_bis) : NaN;
    return {
      id: z.id,
      titel: z.titel,
      art: z.art,
      ort: { name: z.ort.name, lat: Number(z.ort.lat), lon: Number(z.ort.lon) },
      ...(Number.isFinite(von) && Number.isFinite(bis) ? { wann: { von, bis } } : {}),
      ...(z.bild ? { bild: z.bild, bildUrheber: z.bild_urheber || null, bildSeite: z.bild_seite || null } : {}),
      ...(z.tester_note != null ? { testerBewertung: { note: Number(z.tester_note), text: z.tester_text || '' } } : {}),
      gesponsert: Boolean(z.gesponsert),
      tags: Array.isArray(z.tags) ? z.tags : [],
    };
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
      // Runde 7: Eine Frage („Hast du Zeit?"), eine Ankunft („Ich bin da") und geänderte
      // „Keine Zeit"-Zeiten sollen ankommen, ohne dass jemand die App neu lädt.
      'fragen', 'meet_ankuenfte', 'belegte_zeiten',
      // Runde 8 (R8-50): ein neuer Find-Eintrag erscheint bei allen, ohne dass jemand neu lädt.
      // (Busy-Änderungen von Freunden melden sich seit 0037 über profiles — die Tabelle
      // belegte_zeiten gibt fremde Zeilen nicht mehr heraus, also auch keine Live-Pakete.)
      'find_eintraege',
      // Runde 10 (Jonathan: „manchmal aktualisiert es nicht direkt … z. B. Standort"):
      // `standorte` fehlte hier — als einzige Tabelle, die die Karte anzeigt. Wer sich bewegte,
      // blieb auf den Geräten der anderen stehen, bis jemand die App neu startete (oder bis
      // zufällig eine ANDERE Tabelle ein Paket schickte). Das Paket selbst wird NICHT gelesen:
      // Es trägt die rohe Zeile, also die genauen Koordinaten — die Entscheidung „nur
      // ungefähr" einer anderen Person steht in der Sicht standorte_sicht und wird auf dem
      // Server angewandt. Das Paket löst nur das gewöhnliche Nachladen aus, das genau diese
      // Sicht liest (scheduleRehydrate → _hydrate).
      'standorte',
    ]) {
      this.channel.on('postgres_changes', { event: '*', schema: 'public', table }, (paket) => {
        if (this.eigenesEcho(paket)) return;
        this.scheduleRehydrate();
      });
    }
    globalThis.document?.addEventListener?.('visibilitychange', () => {
      if (globalThis.document.visibilityState === 'visible') this.standortSenden();
      else this.standortWacheBeenden();
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
      ...(row.reply_to ? { replyTo: row.reply_to } : {}),
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

  // Eine Zeile aus free_status in die Form des Datenvertrags — genau das, was die Zeile sagt,
  // ohne etwas hinzuzudenken. Wann dieses „frei" endet, steht daneben (freiGrenzeAusZeile).
  //
  // Runde 7 (H1): Die Spalte `gilt_bis` sagt, wann dieses „frei" von selbst endet. Sie steht auf
  // dem SERVER, damit ein „frei" vom Freitagabend am Sonntag bei niemandem mehr leuchtet — auch
  // wenn die Person ihr Gerät seit Tagen nicht angefasst hat; bei fremden Menschen ist das die
  // EINZIGE Möglichkeit, es zu wissen (ihre Uhrzeit-Einstellung ist privat und bleibt es).
  // In den Datenvertrag wandert sie NICHT: dort steht ein abgelaufenes „frei" schlicht als
  // nicht mehr aktiv. Ein zusätzliches Feld wäre ein zweiter Weg, dieselbe Frage zu stellen.
  //
  // Runde 11 (B7): Das Prüfen der Grenze ist aus dieser Funktion HERAUS gewandert — es geschah
  // hier nur EINMAL, beim Laden. Eine App, die über die Grenze hinweg offen blieb, zeigte die
  // Leute weiter als „frei"; und eine Zeile ohne Grenze (Altbestand vor Runde 7) lief überhaupt
  // nie ab. Jetzt entscheidet das die Leseseite: personWithDerived (fremde) bzw. freiAufraeumen
  // (eigene), beide mit der einen Regel aus projections.js.
  freiAusZeile(row) {
    return {
      active: Boolean(row.active),
      pending: Boolean(row.pending),
      from: row.from_time || null,
      fromAt: row.from_at ? new Date(row.from_at).getTime() : null,
      setAt: row.set_at ? new Date(row.set_at).getTime() : null,
      lust: row.lust || null,
    };
  }

  // → ms | null. Die Grenze der anderen Person, gerechnet mit IHRER Uhrzeit (die privat bleibt).
  freiGrenzeAusZeile(row) {
    return row?.gilt_bis ? new Date(row.gilt_bis).getTime() : null;
  }

  applyFreeStatus(row) {
    if (row.user_id === this.myUid) {
      // Runde 11 (B7): Auch die eigene Zeile bekommt einen Anker, wenn sie keinen hat — sonst
      // liefe sie nie ab (gemessener Altbestand in der echten Datenbank).
      this.state.settings.free = freiMitAnker(this.freiAusZeile(row));
    } else {
      const person = this.state.people.find((p) => p.id === row.user_id);
      if (!person) return this.scheduleRehydrate();
      person.free = this.freiAusZeile(row);
      this.freiGrenzeMerken(row.user_id, this.freiGrenzeAusZeile(row));
    }
    this.notify();
    return undefined;
  }

  // Die Grenzen der anderen liegen NEBEN dem Bestand, nicht im Datenvertrag: die Ansichten
  // fragen weiter nur `person.free`, und personWithDerived beantwortet das mit der Grenze.
  freiGrenzeMerken(userId, grenze) {
    if (!this.state.freiGrenzen) this.state.freiGrenzen = {};
    if (grenze) this.state.freiGrenzen[userId] = grenze;
    else delete this.state.freiGrenzen[userId];
  }

  // ---------------------------------------------------------------------------------------
  // Identität & Einstellungen
  // ---------------------------------------------------------------------------------------
  getMe() {
    this.freiAufraeumen();
    const s = this.state.settings;
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
    zeichenNachlernen(
      namenAusEinstellungen(this.state.settings),
      (body) => this.client.functions.invoke('zeichen', { body }),
      aktiveSprache(),
      () => this.notify(),
    );
    // Runde 7 (H1): Jede Leseseite bekommt einen aufgeräumten Frei-Zustand — auch nach zwei
    // Tagen geschlossener App, ohne dass irgendein Bildschirm daran denken muss.
    this.freiAufraeumen();
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
    // Runde 7 (E1): Zeitfenster gehen immer bereinigt in den Bestand — ungültige Eingaben
    // (Tag 9, „25:00", von === bis) dürfen gar nicht erst liegen bleiben. Die Datenbank nähme
    // sie ohnehin nicht an (Migration 0034/0037, belegte_zeiten_form).
    if (patch && patch.belegt !== undefined) this.state.settings.belegt = busyBereinigen(patch.belegt);
    // Runde 8 (R8-50): gemerkte Find-Einträge — nur Ids, keine Doppelten.
    if (patch && patch.gemerktIds !== undefined) this.state.settings.gemerktIds = gemerktIdsBereinigen(patch.gemerktIds);
    this.notify();
    // Runde 7 (H1): Wird die Uhrzeit geändert, WÄHREND frei aktiv ist, gilt sofort die neue —
    // gerechnet ab demselben Anker. Die neue Grenze muss auch auf den Server, sonst sähen
    // Freunde weiter die alte.
    if (!patch || patch.freeResetTime !== undefined) {
      if (!this.freiAufraeumen()) {
        if (this.state.settings.free?.active) this.writeFree(this.state.settings.free);
        this.freiUhrStellen();
      }
    }

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
      else {
        this.standortWacheBeenden();
        // Runde 7, Welle 2 (M1): auch die gemerkte Lage im Gerät weg. Sie ist jetzt genau, und
        // eine genaue Lage, die niemand mehr sehen darf, hat nirgends mehr etwas verloren.
        this.state.settings.standort = null;
        this.standortGesendetAm = 0;
        this.push(tx('Standort nicht mehr teilen'), () => this.client.from('standorte').delete().eq('user_id', this.myUid));
      }
      // Runde 11 (C4): Die native App bekommt ihren Telefon-Schlüssel bzw. gibt ihn ab.
      this.standortTelefonEinrichten();
    }
    // Runde 7 (E1/E2): Busy hat eine eigene Tabelle (0034). Runde 8 (R8-39): Die Freigabe-Spalte
    // wird nicht mehr geschrieben und nicht mehr gelesen — Freunde sehen Busy immer (0037).
    if (patch.belegt !== undefined) this.schreibeBelegt();

    const privat = {};
    for (const key of ['onboarded', 'freeResetTime', 'activityStatus', 'freiHints', 'bestFriendIds',
      'specialPerson', 'notifications', 'appearance', 'location', 'visibility', 'homeAddress',
      // Runde 7, Welle 2 (M1): `standortGenauigkeit` MUSS in die settings-Zeile (data), denn die
      // Sicht standorte_sicht liest sie dort — sie ist die einzige Stelle, an der die Entscheidung
      // durchgesetzt werden kann. Sie sagt nichts über meinen Aufenthalt, nur über die Schärfe.
      'standortGenauigkeit',
      // Runde 7, Welle 3 (Hausregel 3): `pinnedIds` (angeheftete Chats) fehlte hier — die
      // Crew-Seite schreibt sie seit Welle 2 über updateSettings. Auf dem Gerät überlebte das
      // Anheften den Neustart, auf dem Server nicht (bzw. nur zufällig, wenn später eine andere
      // Einstellung geschrieben wurde und privateSettings den ganzen Stand mitnahm).
      'pinnedIds',
      // Runde 8 (R8-50): gemerkte Find-Einträge — privat wie pinnedIds.
      'gemerktIds',
      // Runde 11 (C1): Wischen in der Chatliste — ausgeblendete und für mich geleerte Chats.
      'chatAusgeblendet', 'chatGeleert',
      // Runde 10: die Markierung, dass „alles an" schon einmal gesetzt wurde — sie MUSS beim Konto
      // liegen, nicht im Gerät, sonst schaltete das zweite Gerät wieder an, was jemand abstellte.
      'standardAn',
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
    // Runde 7: `belegt` hat seine eigene Tabelle, `standort` ebenfalls. Ein zweiter Abdruck in
    // den Einstellungen wäre eine zweite, veraltende Wahrheit.
    for (const key of ['name', 'initials', 'color', 'photo', 'interests', 'interestLevels',
      'resources', 'resourceShares', 'resourceMeta', 'free', 'inviteCode',
      'friendRequests', 'outgoingRequests', 'account',
      'belegt', 'standort']) delete data[key];
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
    // Runde 7: Auch `belegt` und `standort` führt der Server in eigenen Tabellen; ein
    // Zwischenspeicher davon käme beim nächsten Start veraltet zurück.
    for (const key of ['free', 'inviteCode', 'friendRequests', 'outgoingRequests',
      'belegt', 'standort']) delete daten[key];
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

  // Runde 8c: signOut gibt sein Versprechen zurück (der Aufrufer wartet darauf). Scheitert das
  // globale Abmelden — offline, Server weg —, wird wenigstens DIESES Gerät abgemeldet, bevor es zur
  // Anmeldung geht; sonst stünde nach dem Neuladen dieselbe Sitzung wieder da.
  signOut() {
    this.abgemeldet = true;
    clearTimeout(this.rehydrateTimer);
    this.rehydrateTimer = null;
    return this.push(tx('Abmelden'), async () => {
      // Runde 5 (Wunsch P5): Das Push-Abo dieses Geräts gehört dem Konto, das sich abmeldet. Bliebe es stehen,
      // bekäme das Gerät weiter dessen Mitteilungen — und ein anderes Konto im selben Browser könnte es nicht
      // übernehmen (Regel push_subscriptions). Also vor dem Abmelden löschen, solange die Sitzung noch gilt.
      try { const { pushAusschalten } = await import('./push.js'); await pushAusschalten(this.client); } catch { /* egal */ }
      try { await this.channel?.unsubscribe(); } catch { /* egal */ }
      this.channel = null;
      try {
        const { error } = (await this.client.auth.signOut()) || {};
        if (error) throw error;
      } catch {
        try { await this.client.auth.signOut({ scope: 'local' }); } catch { /* egal */ }
      } finally { this.zurAnmeldung(); }
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
    // Ein geplantes „Frei ab" wird zum gewählten Zeitpunkt von selbst wirksam. `setAt` bleibt
    // dabei stehen: es ist der Anker für das Zurücksetzen (H1), nicht der Startzeitpunkt.
    if (free?.pending && free.fromAt && Date.now() >= free.fromAt) {
      free.pending = false;
      free.from = null;
      free.fromAt = null;
      this.writeFree(free);
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
    this.writeFree(s.free);
    // Das Aufräumen passiert MITTEN im Lesen (getSettings wird beim Zeichnen gerufen). Ein
    // notify() an dieser Stelle würde das Zeichnen aus sich selbst heraus neu anstoßen —
    // deshalb erst danach, im nächsten Durchlauf.
    clearTimeout(this.freiNachricht);
    this.freiNachricht = setTimeout(() => { this.freiNachricht = null; this.notify(); }, 0);
    this.freiNachricht?.unref?.();
    this.freiUhrStellen();
    return true;
  }

  // → ms des nächsten Zurücksetzens, oder null (nicht frei / keine gültige Uhrzeit).
  freiZuruecksetzenAm() {
    const s = this.state.settings;
    if (!s.free?.active) return null;
    return naechsteFreiGrenze(s.freeResetTime, freiAnker(s.free));
  }

  // Dieselbe Grenze als Zeitstempel für die Datenbank (Spalte gilt_bis).
  freiGrenzeVon(free) {
    const grenze = naechsteFreiGrenze(this.state.settings.freeResetTime, freiAnker(free));
    return grenze ? new Date(grenze).toISOString() : null;
  }

  // Und während die App offen ist: EINE Uhr, gestellt auf genau die Grenze. Nach dem Schlagen
  // wird der Zustand mit derselben Regel geprüft (der Rechner kann geschlafen haben) und die
  // Uhr auf die nächste Grenze gestellt.
  freiUhrStellen() {
    clearTimeout(this.freiUhr);
    this.freiUhr = null;
    const am = this.freiZuruecksetzenAm();
    if (!am) return;
    this.freiUhr = setTimeout(() => {
      this.freiUhr = null;
      if (!this.freiAufraeumen()) this.freiUhrStellen();
    }, Math.max(0, am - Date.now()) + 250);
    this.freiUhr?.unref?.();
  }

  writeFree(free) {
    this.push(tx('Frei-Status speichern'), () => this.client.from('free_status').update({
      active: free.active,
      pending: free.pending,
      from_time: free.from,
      from_at: free.fromAt ? new Date(free.fromAt).toISOString() : null,
      set_at: free.setAt ? new Date(free.setAt).toISOString() : null,
      // Runde 7 (H1): Der Zeitpunkt, an dem dieses „frei" von selbst endet. Er steht auf dem
      // Server, weil sonst ein „frei" bei allen Freunden stehen bliebe, bis die Person selbst
      // wieder in die App sieht — der Server ist die Wahrheit, nicht der letzte Besuch.
      // Gerechnet wird er mit derselben einen Regel wie überall (projections.js).
      gilt_bis: free.active ? this.freiGrenzeVon(free) : null,
      lust: free.lust || null,
    }).eq('user_id', this.myUid));
  }

  setFree(options = {}) {
    const at = Number(options.at) || 0;
    const offset = Math.max(0, Number(options.fromMinutes) || 0);
    const fromAt = at > Date.now() ? at : (offset > 0 ? Date.now() + offset * 60000 : 0);
    // Runde 5 (G3b): Die Lust bleibt, solange niemand sie ausdrücklich ändert.
    const lust = options.lust !== undefined ? this.lustPruefen(options.lust) : (this.state.settings.free?.lust ?? null);
    // Runde 7 (H1): `setAt` ist ab jetzt IMMER gesetzt — er ist der Anker, an dem „Frei
    // zurücksetzen um HH:MM" rechnet. Vorher stand er nur beim geplanten Frei, weshalb ein
    // normales „frei" überhaupt keinen Zeitpunkt hatte, von dem aus man hätte zurücksetzen können.
    const free = fromAt
      ? { active: true, pending: true, from: options.from || null, setAt: Date.now(), fromAt, lust }
      : { active: true, pending: false, from: null, setAt: Date.now(), fromAt: null, lust };
    this.state.settings.free = free;
    this.writeFree(free);
    this.notify();
    this.freiUhrStellen();
  }

  clearFree() {
    const free = { active: false, pending: false, from: null, setAt: null, fromAt: null, lust: null };
    this.state.settings.free = free;
    this.writeFree(free);
    this.notify();
    this.freiUhrStellen();
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
  // Runde 8 (R8-39): Busy — Titel, Schloss, keine Freigabe-Einstellung
  // ---------------------------------------------------------------------------------------
  // Ein Fenster trägt Zeit, Titel und Schloss — mehr nicht. Die Datenbank nimmt auch nichts
  // anderes an (0037, belegte_zeiten_form), und sie gibt den Titel eines Fensters mit Schloss
  // niemandem außer mir heraus (Sicht belegte_zeiten_sicht). Die Grenze sitzt an der Kante.
  // Gespeichert wird die kompakte Form (busyBereinigen), gelesen die vollständige (busyVollstaendig).
  getBelegt() {
    return busyVollstaendig(this.state.settings.belegt);
  }

  // Eine Zeile, die immer den ganzen Stand trägt — wie die Einstellungen. Mehrere Änderungen
  // kurz hintereinander ergeben so EINEN Schreibvorgang. Geschrieben wird die Form des Vertrags:
  // kein leerer Titel, kein offenes Schloss (die Datenbank nimmt `titel` nur als Text an).
  // Die alte Spalte `sichtbar` wird nicht mehr geschrieben — es gibt die Einstellung nicht mehr.
  schreibeBelegt() {
    const meine = (this.belegtNummer = (this.belegtNummer || 0) + 1);
    this.push(tx('Busy speichern'), () => {
      if (meine !== this.belegtNummer) return { error: null };
      return this.client.from('belegte_zeiten').upsert({
        user_id: this.myUid,
        fenster: busyBereinigen(this.state.settings.belegt),
        aktualisiert: new Date().toISOString(),
      }, { onConflict: 'user_id' });
    });
  }

  setBelegt(liste) {
    this.state.settings.belegt = busyBereinigen(liste);
    this.notify();
    this.schreibeBelegt();
    return { ok: true, belegt: this.getBelegt() };
  }

  addBelegt(fenster) {
    const sauber = busyBereinigen([fenster]);
    if (!sauber.length) return { ok: false, reason: 'ungueltig', belegt: this.getBelegt() };
    const liste = [...busyBereinigen(this.state.settings.belegt), sauber[0]];
    this.state.settings.belegt = liste;
    this.notify();
    this.schreibeBelegt();
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
    this.schreibeBelegt();
    return { ok: true, belegt: this.getBelegt() };
  }

  removeBelegt(index) {
    const liste = busyBereinigen(this.state.settings.belegt);
    if (!liste[index]) return { ok: false, reason: 'unbekannt', belegt: this.getBelegt() };
    liste.splice(index, 1);
    this.state.settings.belegt = liste;
    this.notify();
    this.schreibeBelegt();
    return { ok: true, belegt: this.getBelegt() };
  }

  // Runde 8 (R8-39): Wer sieht Busy? Freunde — und nur sie. Im Server-Modus hat die Sicht das
  // schon entschieden (von allen anderen kommt gar nichts an); die Frage steht hier trotzdem,
  // wortgleich zum Geräte-Datenweg, damit beide dieselbe Antwort geben.
  busySichtbarVon(person) {
    return Boolean(person) && person.friend !== false && !this.isBlocked(person.id);
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
      // Die Sicht meet_zeiten_sicht (0041) hat schon entschieden: nur Freunde, nur die Zeit.
      meetZeiten: meetZeiten(this.state.meetZeiten?.[personId]),
    };
  }

  // ---------------------------------------------------------------------------------------
  // Runde 7 (E5): „Hast du Zeit?" — die flüchtige Frage
  // ---------------------------------------------------------------------------------------
  // Sie ist bewusst KEINE Nachricht: kein Eintrag im Raum, kein Verlauf, keine Spur. Wer nicht
  // antwortet, hat nichts liegen lassen — nach zwei Stunden war sie einfach nie da. Der Server
  // sieht das genauso: die Regel fragen_select gibt abgelaufene Fragen gar nicht erst heraus,
  // und die nächste Frage räumt sie weg (0034).
  fragenListe() {
    if (!Array.isArray(this.state.fragen)) this.state.fragen = [];
    return this.state.fragen;
  }

  fragenAufraeumen(jetzt = Date.now()) {
    const vorher = this.fragenListe().length;
    // Zurückgenommene bleiben bis zum Ende ihrer Stunde — sie zählen für die Grenze (frageZaehltNoch).
    this.state.fragen = this.fragenListe().filter((frage) => frageZaehltNoch(frage, jetzt));
    if (this.state.fragen.length === vorher) return false;
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
      id: uuid(),
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
    this.push(tx('Frage stellen'), () => this.client.from('fragen').insert({
      id: frage.id,
      von_id: this.myUid,
      an_id: frage.anId ? this.uid(frage.anId) : null,
      crew_id: frage.crewId,
      gestellt: new Date(frage.at).toISOString(),
      bis: new Date(frage.bis).toISOString(),
    }));
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
    // Am Server ändert sich ausschließlich die Antwort; alles andere stellt der Trigger
    // frage_nur_antwort zurück, egal was hier stünde.
    this.push(tx('Frage beantworten'), () => this.client.from('fragen')
      .update({ antwort, antwort_am: new Date(frage.antwortAt).toISOString() }).eq('id', frageId));
    return { ok: true };
  }

  // Im Gerät markieren statt löschen (sie zählt für die Stundengrenze); am Server wird sie
  // gelöscht, damit die gefragte Person sie nicht mehr sieht.
  frageZuruecknehmen(frageId) {
    const frage = this.fragenListe().find((entry) => entry.id === frageId && entry.vonId === ME && !entry.zurueckgenommen);
    if (!frage) return { ok: false, grund: 'unbekannt' };
    frage.zurueckgenommen = true;
    this.notify();
    this.push(tx('Frage zurücknehmen'), () => this.client.from('fragen')
      .delete().eq('id', frageId).eq('von_id', this.myUid));
    return { ok: true };
  }

  // ---------------------------------------------------------------------------------------
  // Runde 7 (A4/A5): EINE Chatliste
  // ---------------------------------------------------------------------------------------
  getChats() {
    return chatEintraege({
      me: ME,
      settings: this.getSettings(),
      people: this.getPeople(),
      crews: this.getCrews(),
      meets: this.meineMeets(),
      raumVon: (roomId) => this.roomFromId(roomId),
    });
  }

  // Runde 8 (R8-6): die Chats hinter „Vergangene Chats" — dieselbe Form wie im Geräte-Gateway.
  // Was älter als sieben Tage ist, zeigt projections.js nicht mehr (meetChatAbgelaufen). Das
  // LÖSCHEN auf dem Server kann dieses Gerät nicht selbst: fremde Nachrichten darf nur ihr:e
  // Autor:in löschen (messages_delete, 0001). Das übernimmt eine Aufgabe auf dem Server
  // (Bericht Runde 8, Paket raum → Chef).
  getVergangeneChats() {
    return vergangeneMeetChats({
      me: ME,
      people: this.getPeople(),
      meets: this.meineMeets(),
      raumVon: (roomId) => this.roomFromId(roomId),
    });
  }

  // Ausdrücklich { mine: true }: ohne Kontext liefert getMeets ALLE Meets — im Server-Modus
  // stünden sonst fremde Meet-Chats in meiner Liste.
  meineMeets() {
    return [
      ...this.getMeets({ context: { mine: true }, direction: 'upcoming' }),
      ...this.getMeets({ context: { mine: true }, direction: 'history' }),
    ];
  }

  // Runde 8 (R8-6): Antwort auf „Gruppe nehmen oder eigener Chat" nach dem Anlegen — dieselbe
  // Regel und dieselben Antworten wie im Geräte-Gateway (demo-gateway.js meetChatWaehlen).
  // 'gruppe' setzt crew_id am Meet (meets_update erlaubt das der Erstellerin); ab dann liest
  // _hydrate den Gruppenchat als Raum. 'eigen' legt den Meet-Raum an, den publishDraft in
  // diesem Fall bewusst noch nicht angelegt hat.
  meetChatWaehlen(meetId, wahl) {
    const meet = this.getMeet(meetId);
    if (!meet) return { ok: false, grund: 'keinMeet' };
    if (wahl !== 'gruppe' && wahl !== 'eigen') return { ok: false, grund: 'wahl' };
    if (meet.crewId) return wahl === 'gruppe' ? { ok: true, roomId: `r:${meet.crewId}` } : { ok: false, grund: 'schonGruppe' };
    if (wahl === 'eigen') {
      const roomId = meet.roomId || `r:${meet.id}`;
      if (meet.roomId) this.push(tx('Meet-Chat anlegen'), async () => { await this.ensureRoom(roomId); return { error: null }; });
      return { ok: true, roomId };
    }
    const crewId = gruppeMitGenau(this.getCrews(), meet.personIds, ME);
    if (!crewId) return { ok: false, grund: 'keineGruppe' };
    const eigenerRaum = meet.roomId;
    if (eigenerRaum && (this.state.messages[eigenerRaum] || []).length) return { ok: false, grund: 'schonGeschrieben' };
    meet.crewId = crewId;
    meet.personIds = undefined;
    meet.roomId = `r:${crewId}`;
    if (eigenerRaum) {
      delete this.state.messages[eigenerRaum];
      delete this.state.roomRead[eigenerRaum];
    }
    this.persistLocal();
    this.notify();
    this.push(tx('Meet der Gruppe geben'), () => this.client.from('meets').update({ crew_id: crewId }).eq('id', meetId));
    return { ok: true, roomId: `r:${crewId}` };
  }

  // ---------------------------------------------------------------------------------------
  // Personen & Freundschaft
  // ---------------------------------------------------------------------------------------
  personWithDerived(person) {
    const activeMeet = this.state.meets.find(
      (meet) => meet.status === 'active' && meet.participation[person.id] === 'yes',
    );
    // Runde 11 (B7): „Frei" hat auch bei den ANDEREN ein Ende, und geprüft wird es beim LESEN —
    // nicht beim Laden. Sonst blieben Leute „frei", solange die App offen ist. Die Grenze kommt
    // aus ihrer eigenen Zeile (gilt_bis); wo keine steht, zählt das „frei" nicht mehr.
    const free = freiFuerAndere(person.free, this.state.freiGrenzen?.[person.id]);
    // Ohne eigenen Statustext zeigt die App, was wirklich bekannt ist: Frei oder Gegend.
    const status = free?.active ? tx('Frei')
      : (free?.pending && free.from ? tx('Frei ab {zeit}', { zeit: free.from }) : (person.area || ''));
    return { ...person, free, status: person.status || status, activeMeetId: person.showsActivity && activeMeet ? activeMeet.id : null };
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
    // Runde 11 (B7): Auch hier zählt nur ein „frei", das noch gilt — sonst stünde an der Gruppe
    // „3 frei", während in der Liste niemand mehr grün leuchtet. Dieselbe Regel wie überall.
    const freeCount = crew.memberIds.filter((id) => {
      if (id === ME) {
        return Boolean(this.state.settings.free?.active)
          && !freiAbgelaufen(this.state.settings.free, this.state.settings.freeResetTime);
      }
      const person = this.state.people.find((entry) => entry.id === id);
      return Boolean(freiFuerAndere(person?.free, this.state.freiGrenzen?.[id]).active);
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

  // Runde 8 (R8-25): „zum Admin machen" — und zurück. Dieselbe Regel wie im Geräte-Datenweg
  // (projections.js crewAdminGrund); die Datenbank setzt sie noch einmal durch: Rollen ändern nur
  // Admins (crew_members_update), und crew_members_guard lässt keine Gruppe ohne Admin zurück.
  setCrewAdmin(crewId, personId, an) {
    const crew = this.state.crews.find((entry) => entry.id === crewId) || null;
    const admins = this.crewAdminIds(crew);
    const grund = crewAdminGrund(crew, admins, ME, personId, Boolean(an));
    if (grund) return { ok: false, reason: grund };
    if (admins.includes(personId) === Boolean(an)) return { ok: true };
    crew.adminIds = an ? [...new Set([...admins, personId])] : admins.filter((id) => id !== personId);
    this.notify();
    this.push(tx('Adminrolle ändern'), () => this.client.from('crew_members').update({ role: an ? 'admin' : 'member' }).eq('crew_id', crewId).eq('user_id', this.uid(personId)));
    return { ok: true };
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

  // Runde 8: Übergeben heißt — die Person wird Admin, ich bin es danach nicht mehr; weitere Admins
  // bleiben. Bis Runde 7 blieb ich hier auf dem Server Admin, während die Demo mich (und alle
  // anderen Admins) abräumte — zwei Antworten auf dieselbe Handlung (Hausregel 3). Die Reihenfolge
  // zählt: erst die Person hinauf, dann ich hinunter — sonst stünde die Gruppe einen Augenblick
  // ohne Admin da, und crew_members_guard lehnte ab.
  transferCrewAdmin(crewId, personId) {
    const crew = this.state.crews.find((entry) => entry.id === crewId);
    if (!crew || !crew.memberIds.includes(personId)) return { ok: false, reason: tx('Person ist kein Mitglied') };
    const admins = this.crewAdminIds(crew);
    crew.adminIds = [...new Set([...admins.filter((id) => id !== ME), personId])];
    if (crew.creatorId === ME) crew.creatorId = personId;
    this.notify();
    this.push(tx('Adminrolle übergeben'), async () => {
      const hinauf = await this.client.from('crew_members').update({ role: 'admin' }).eq('crew_id', crewId).eq('user_id', this.uid(personId));
      if (hinauf.error || personId === ME) return hinauf;
      return this.client.from('crew_members').update({ role: 'member' }).eq('crew_id', crewId).eq('user_id', this.myUid);
    });
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
    // Runde 11 (C1): was ich mit „Chat löschen" geleert habe, steht für mich nicht mehr da.
    const messages = all.filter((message) => (!message.date || message.date >= cutoff) && nachGeleert(message, this.state.settings, roomId));
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

  // Runde 11 (C1): optionen.replyTo — die Id der zitierten Nachricht (Spalte reply_to, Migration
  // 0042). Sie muss im selben Raum stehen, sonst geht die Nachricht ohne Zitat raus (wie im Gerät).
  sendMessage(roomId, text, optionen = {}) {
    const trimmed = (text || '').trim();
    if (!trimmed) return;
    const jetzt = now();
    const id = uuid();
    const antwort = optionen?.replyTo && (this.state.messages[roomId] || []).some((m) => m.id === optionen.replyTo)
      ? String(optionen.replyTo) : null;
    this.appendLocalMessage(roomId, {
      id, authorId: ME, kind: 'text', text: trimmed,
      date: toISODate(jetzt), time: hhmm(jetzt), at: jetzt.getTime(),
      ...(antwort ? { replyTo: antwort } : {}),
    });
    this.state.roomRead[roomId] = (this.state.messages[roomId] || []).length;
    this.notify();
    this.push(tx('Nachricht senden'), async () => {
      const room = await this.ensureRoom(roomId);
      const zeile = { id, room_id: room, author_id: this.myUid, kind: 'text', text: trimmed, ...(antwort ? { reply_to: antwort } : {}) };
      let gesendet = await this.client.from('messages').insert(zeile);
      // Ist Migration 0042 noch nicht eingespielt, kennt der Server reply_to nicht. Die Nachricht
      // geht dann ohne Zitat raus, statt verloren zu gehen.
      if (gesendet.error && antwort && /reply_to/i.test(String(gesendet.error.message || ''))) {
        const { reply_to: _ohne, ...ohneZitat } = zeile;
        gesendet = await this.client.from('messages').insert(ohneZitat);
      }
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

  // Runde 4 (D7): Die eigene Lage an die Freunde, die sie sehen dürfen (Regel in 0025).
  // Runde 7, Welle 2 (M1): SO GENAU, wie das Gerät es hergibt. Bis hierher wurde hier auf drei
  // Nachkommastellen gerundet (≈ 100 m) und mit `enableHighAccuracy: false` gefragt — auf 100 m
  // ist nicht zu sagen, in welchem Lokal jemand sitzt, und das ist die Frage dieser App.
  //
  // WAS ES HEUTE NICHT GIBT (Runde 7, Welle 3, Hausregel 9): Hier stand bis Welle 3 ein Satz, der
  // einem Menschen zusagte, er könne die Genauigkeit in der Oberfläche gröber stellen. Eine solche
  // Stelle in der App gibt es NICHT — der Vertrag (repository.js, Abschnitt M1) ist fertig und in
  // beiden Gateways gleich, der Bildschirm dazu gehört dem Profil-Paket und fehlt. Bis er steht,
  // gilt für jede:n, der/die
  // mich sehen darf, die Vorgabe 'genau'. Wird umgestellt, rundet der SERVER für die betroffenen
  // Betrachter (0034) — nicht heimlich das Gerät für alle.
  //
  // Höchstens alle 10 Minuten; nur wenn Teilen an ist. Und: gefragt wird das GERÄT nur, wenn die
  // Erlaubnis schon erteilt ist oder jemand sie gerade eingeschaltet hat (sofort) — der Start der
  // App und ein Wechsel in den Vordergrund lösen von sich aus keine Erlaubnisfrage mehr aus.
  standortSenden({ sofort = false } = {}) {
    const loc = this.state.settings.location || {};
    const geo = globalThis.navigator?.geolocation;
    if (!loc.use || !geo || !this.myUid) return;
    if (sofort) { this.standortJetztHolen(true); return; }
    standortErlaubnisSchonDa().then((schonDa) => { if (schonDa) this.standortJetztHolen(false); });
  }

  // Ab hier wird wirklich gemessen. Hierher kommt nur, wer getippt hat oder die Erlaubnis längst
  // erteilt hat — deshalb steht auch die Wache (watchPosition) erst hinter dieser Tür.
  standortJetztHolen(sofort = false) {
    const geo = globalThis.navigator?.geolocation;
    if (!this.state.settings.location?.use || !geo || !this.myUid) return;
    if (!sofort && Date.now() - (this.standortGesendetAm || 0) < 10 * 60000) { this.standortBeobachten(); return; }
    geo.getCurrentPosition(
      (position) => { standortErlaubnisMerken(); this.standortAusPosition(position); },
      () => { this.standortGesendetAm = 0; },
      { enableHighAccuracy: true, timeout: 15000, maximumAge: 60000 },
    );
    this.standortBeobachten();
  }

  // Runde 6 (C6, Jonathan: „live standort ist immer und wird so oft geprüft wie sinnvoll … wird nur
  // aktualisiert wenn es sich verändert"): Solange die App offen ist, hört das Gerät mit. Im
  // Hintergrund kann die Web-App nichts tun; dann sagt die Karte „vor x Min".
  //
  // Runde 7, Welle 2 (M1): Die Bremse „hat sich der GERUNDETE Wert geändert" gibt es nicht mehr —
  // es wird ja nichts mehr gerundet, und genaue Koordinaten wackeln bei jedem Messwert. An ihre
  // Stelle tritt eine echte Strecke (projections.lageWeitGenugAnders, 25 m). Die Genauigkeit, die
  // mitreist, ist die des GERÄTS (position.coords.accuracy) — nicht mehr die eigene Rundung.
  // Runde 11 (C4): `erzwingen` — jemand hat nach meiner Lage gefragt. Dann geht sie hinaus, auch wenn ich
  // mich nicht bewegt habe: Die Antwort IST die frische Zeile (der Server hakt die Anfrage daran ab).
  standortAusPosition(position, { erzwingen = false } = {}) {
    if (!this.myUid || !this.state.settings.location?.use) return;
    const lage = lageAusPosition(position);
    if (!lage) return;
    const alt = this.state.settings.standort;
    const jetzt = lage.at;
    if (!erzwingen && !lageSendenLohnt(alt, lage, this.standortGesendetAm, jetzt)) return;
    this.standortGesendetAm = jetzt;
    this.state.settings.standort = lage;
    this.notify();
    this.push(tx('Standort teilen'), () => this.client.from('standorte')
      .upsert({
        user_id: this.myUid, lat: lage.lat, lon: lage.lon,
        genauigkeit_m: lage.genauigkeitM, aktualisiert: new Date().toISOString(),
      }, { onConflict: 'user_id' }));
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
    if (!this.myUid || !this.state.settings.location?.use) return;
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

  // --- Runde 11 (C4, D8): Standort auf Abruf (Vertrag: repository.js) ---------------------------
  // Tipp auf eine Freundin → public.standort_anfragen (0044): Der Server prüft Freundschaft, Blockade
  // und ob sie ohnehin mit mir teilt, begrenzt, und legt die Mitteilung in push_outbox. Beantwortet
  // ist die Anfrage, sobald sie eine frische Lage schreibt — das hakt der SERVER ab (Auslöser auf
  // standorte, seine Uhr), und die Änderung kommt über einen eigenen Realtime-Kanal zurück.
  // Ihre Seite steht gleich darunter: Hat jemand nach mir gefragt, antwortet dieses Gerät, sobald es
  // davon erfährt — sofort bei offener App (Kanal), sonst beim Start oder bei der Rückkehr in den
  // Vordergrund (das ist auch der Weg über die Mitteilung).
  standortAnfragen(personId) {
    const an = this.uid(personId);
    if (!an || an === this.myUid || !this.client) return Promise.resolve({ ok: false, grund: 'keinFreund' });
    return Promise.resolve(this.client.rpc('standort_anfragen', { person: an })).then(({ data, error }) => {
      if (error) return { ok: false, grund: /fetch|network|failed/i.test(String(error.message || '')) ? 'offline' : 'fehler' };
      if (!data?.ok) return { ok: false, grund: data?.grund || 'fehler' };
      const eintrag = { at: Number(data.at) || Date.now(), beantwortet: Number(data.beantwortet) || null };
      this.standortAnfragenMeine = { ...this.standortAnfragenMeine, [personId]: eintrag };
      this.notify();
      return { ok: true, neu: Boolean(data.neu), ...eintrag };
    }, () => ({ ok: false, grund: 'offline' }));
  }

  standortAnfrage(personId) {
    const anfrage = this.standortAnfragenMeine?.[personId];
    if (!anfrage || Date.now() - anfrage.at > 30 * 60000) return null;
    return { at: anfrage.at, beantwortet: anfrage.beantwortet || null };
  }

  standortAnfragenEinrichten() {
    if (this.standortAnfragenKanal || !this.client || !this.myUid) return;
    const ich = this.myUid;
    try {
      this.standortAnfragenKanal = this.client.channel('crew-standort-anfragen')
        .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'standort_anfragen', filter: `an=eq.${ich}` }, () => this.standortAnfragenPruefen())
        .on('postgres_changes', { event: 'UPDATE', schema: 'public', table: 'standort_anfragen', filter: `von=eq.${ich}` }, ({ new: zeile }) => this.standortAnfrageZeile(zeile))
        .subscribe();
    } catch { this.standortAnfragenKanal = null; }
    globalThis.document?.addEventListener?.('visibilitychange', () => {
      if (globalThis.document.visibilityState === 'visible') this.standortAnfragenPruefen();
    });
    this.standortAnfragenPruefen();
  }

  standortAnfrageZeile(zeile) {
    if (!zeile?.an || zeile.von !== this.myUid) return;
    const personId = this.sid(zeile.an);
    const at = Date.parse(zeile.erstellt) || 0;
    const alt = this.standortAnfragenMeine?.[personId];
    if (alt && alt.at > at) return;
    this.standortAnfragenMeine = { ...this.standortAnfragenMeine, [personId]: { at, beantwortet: Date.parse(zeile.beantwortet) || null } };
    this.notify();
  }

  // (1) Hat jemand in der letzten halben Stunde nach MIR gefragt und noch keine Antwort? Dann antworten.
  // (2) Meine eigenen Anfragen derselben Zeit — damit „angefragt …" ein Neuladen übersteht.
  // Fehlt die Tabelle (0044 nicht eingespielt), bleibt alles still.
  async standortAnfragenPruefen() {
    if (!this.client || !this.myUid) return;
    try {
      const seit = new Date(Date.now() - 30 * 60000).toISOString();
      const { data, error } = await this.client.from('standort_anfragen')
        .select('von, an, erstellt, beantwortet').gt('erstellt', seit).order('erstellt', { ascending: true });
      if (error || !Array.isArray(data)) return;
      for (const zeile of data) if (zeile.von === this.myUid) this.standortAnfrageZeile(zeile);
      if (data.some((zeile) => zeile.an === this.myUid && !zeile.beantwortet)) this.standortAnfrageBeantworten();
    } catch { /* ohne Netz: beim nächsten Mal */ }
  }

  // Die Antwort: EINE frische Messung, und sie geht hinaus, auch ohne Bewegung (erzwingen). Gefragt
  // wird das Gerät dabei nicht — ohne erteilte Erlaubnis geschieht nichts (dieselbe Regel wie beim Start).
  standortAnfrageBeantworten() {
    const geo = globalThis.navigator?.geolocation;
    if (!this.state.settings.location?.use || !geo || !this.myUid) return;
    if (Date.now() - (this.standortAntwortAm || 0) < 30000) return;
    this.standortAntwortAm = Date.now();
    standortErlaubnisSchonDa().then((schonDa) => {
      if (!schonDa) { this.standortAntwortAm = 0; return; }
      geo.getCurrentPosition(
        (position) => { standortErlaubnisMerken(); this.standortAusPosition(position, { erzwingen: true }); },
        () => { this.standortAntwortAm = 0; },
        { enableHighAccuracy: true, timeout: 15000, maximumAge: 10000 },
      );
    });
  }

  // Die native App meldet ihre Lage auch, wenn sie ZU ist — direkt an den Server, mit einem eigenen
  // engen Telefon-Schlüssel (0044 standort_geraete; iOS CrewStandort.swift, Android StandortServer).
  // Hier bekommt die Hülle ihn: einmal je Konto, solange „Standort verwenden" an ist; aus → vergessen.
  // Im Browser und in einer älteren App-Fassung sagt telefonServerLage() „kann nicht", und es geschieht nichts.
  async standortTelefonEinrichten() {
    if (!this.client || !this.myUid) return;
    try {
      const lage = await telefonServerLage();
      if (!lage.kann) return;
      if (!this.state.settings.location?.use) { if (lage.nutzer) await telefonServerVergessen(); return; }
      if (lage.nutzer === this.myUid) return;
      const { data: geraet, error } = await this.client.rpc('standort_geraet_schluessel');
      if (error || typeof geraet !== 'string' || !geraet) return;
      const { supabaseConfig } = await import('./gateway.js');
      const { url, key } = supabaseConfig();
      await telefonServerSetzen({ adresse: url, oeffentlich: key, geraet, nutzer: this.myUid });
    } catch { /* die Hülle darf die App nie aufhalten */ }
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
      // Runde 9 (R9-11): Ein in der Woche gezogener Zeitraum bringt sein Ende mit.
      endTime: (!draft.when?.open && draft.when?.endTime) || undefined,
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
    // Runde 8 (R8-6): dieselbe Regel wie im Geräte-Gateway. Steht die Frage „Gruppe nehmen oder
    // eigener Chat" noch aus, wird der Meet-Raum NICHT schon jetzt angelegt — sonst bliebe bei
    // „Gruppe" ein leerer Raum auf dem Server zurück. Wer im Meet-Chat schreibt, legt ihn an
    // (sendMessage → ensureRoom), und „eigen" legt ihn in meetChatWaehlen an.
    const gruppeWaehlbar = meet.crewId ? null : gruppeMitGenau(this.getCrews(), personIds, ME);

    this.state.meets.push(meet);
    delete this.state.drafts[id];
    this.persistLocal();
    this.notify();

    const { responses, ...loopOhneAntworten } = meet.loop || {};
    this.push(tx('Meet veröffentlichen'), async () => {
      const angelegt = await this.client.from('meets').insert({
        id: meetId, title: meet.title, icon: meet.icon, icon_key: meet.iconKey || null,
        category: meet.category, date: meet.date, time: meet.time, end_time: meet.endTime || null, open_time: meet.openTime, now_time: Boolean(meet.nowTime),
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
      if (meet.roomId && !gruppeWaehlbar) await this.ensureRoom(meet.roomId);
      await this.hydrate();
      this.notify();
      return { error: null };
    });
    return { ok: true, meetId, gruppeWaehlbar };
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

  // --- Runde 8 (R8-50/R8-66): Find ------------------------------------------------------------
  // Dieselbe Rechnung wie im Geräte-Datenweg (projections.js findListe): vergangene Events fallen
  // weg, jeder Eintrag bekommt seinen Score, sortiert nach Score und Titel.
  // Runde 11 (C2): Neben den Einträgen des Admins steht der Grundbestand (seed/find.js ›
  // findGrundbestand: echte Orte und Ideen für Zuhause, keine erfundenen Termine) — sonst sah, wer
  // angemeldet war, nur die paar Einträge, die das Admin-Konto angelegt hat.
  getFindEintraege() {
    const s = this.state.settings;
    return findListe(findMitGrundbestand(this.state.findEintraege || [], findGrundbestand(now())), {
      interessen: s.interests || [],
      lernen: s.lernen || null,
      // Runde 11 (C2): „Nah bei dir" rechnet vom selben Punkt wie die Entfernung, die Find anzeigt
      // (getMyLocation) — vorher vom gerundeten Vorschlags-Standort dieses Geräts, also zwei Wahrheiten
      // über „wo bin ich". Ohne eigene Lage gilt wie bisher die Mitte der Vorschläge (Zuhause).
      mitte: this.getMyLocation() || this.getVorschlagsMitte(),
      jetzt: Date.now(),
    });
  }

  // Ob ich Einträge anlegen darf, sagt meine Zeile in find_admins (0038) — gesetzt von einer
  // Migration, nie von der App. Eine Zeile anzulegen ist für kein Konto erlaubt.
  istAdmin() {
    return Boolean(this.state.istAdmin);
  }

  // Zuerst lokal (die Oberfläche zeigt ihn sofort), dann an den Server. Lehnt die Regel
  // find_eintraege_insert ab (kein Admin mehr), lädt push() neu — der Eintrag verschwindet
  // wieder, statt zu lügen, und die Oberfläche bekommt die Fehlermeldung.
  addFindEintrag(roh) {
    if (!this.istAdmin()) return { ok: false, reason: 'keinAdmin' };
    const geprueft = findEintragPruefen(roh);
    if (!geprueft.ok) return geprueft;
    const eintrag = { ...geprueft.eintrag, id: uuid() };
    this.state.findEintraege = [...(this.state.findEintraege || []), eintrag];
    this.notify();
    this.push(tx('Eintrag anlegen'), () => this.client.from('find_eintraege').insert({
      id: eintrag.id,
      titel: eintrag.titel,
      art: eintrag.art,
      ort: eintrag.ort,
      wann_von: eintrag.wann ? new Date(eintrag.wann.von).toISOString() : null,
      wann_bis: eintrag.wann ? new Date(eintrag.wann.bis).toISOString() : null,
      bild: eintrag.bild || null,
      bild_urheber: eintrag.bildUrheber || null,
      bild_seite: eintrag.bildSeite || null,
      tester_note: eintrag.testerBewertung ? eintrag.testerBewertung.note : null,
      tester_text: eintrag.testerBewertung ? eintrag.testerBewertung.text : null,
      gesponsert: eintrag.gesponsert,
      tags: eintrag.tags,
    }));
    const sicht = findListe([eintrag], {
      interessen: this.state.settings.interests || [], lernen: this.state.settings.lernen || null,
      mitte: this.getMyLocation() || this.getVorschlagsMitte(), jetzt: Date.now(),
    })[0] || { ...eintrag, score: 0 };
    return { ok: true, eintrag: sicht };
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
  // Runde 7, Welle 2 (M1): Die REIHENFOLGE ist umgedreht — wortgleich zum DemoDataGateway, damit
  // es über die Frage „wo bin ich" nicht zwei Wahrheiten gibt. Bis hierher gewann der
  // Vorschlags-Raster (orte-vorschlaege.js, 0,01° → gerechnete 787 m, GENAUIGKEIT_M.geraet); die
  // eigene Karte zeigte also einen fast kilometerbreiten Kreis, obwohl das Gerät es viel genauer
  // weiß. Der Raster bleibt grob — aber aus einem anderen Grund (er geht an die Orte-Funktion, an
  // einen Dritten) und ist deshalb nur noch der Rückfall. Die Zahl dazu wird gerechnet, nicht
  // getippt: „rund 1000 m" stand hier bis Welle 3 und war nie gemessen.
  getMyLocation() {
    const halbeStunde = 30 * 60000;
    const s = this.state.settings || {};
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

  // --- Runde 7, Welle 2 (M1): „genau" oder „nur ungefähr" ------------------------------------
  // Dieselben vier Methoden wie im DemoDataGateway, dieselbe Antwortform. Der Unterschied liegt
  // nur in der DURCHSETZUNG: hier entscheidet nicht der Client, wer mich wie genau sieht, sondern
  // der Server (Sicht public.standorte_sicht, 0034). Ein Gerät kann die Entscheidung einer
  // anderen Person also nicht umgehen, indem es die rohe Tabelle liest — die gibt sie nicht her.
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
    this.notify();
    this.schreibeSettings();
    return { ok: true, genauigkeit: this.getStandortGenauigkeit() };
  }

  setStandortGenauigkeitFuer(personId, modus) {
    if (!personId) return { ok: false, grund: 'person' };
    if (modus != null && modus !== 'genau' && modus !== 'ungefaehr') return { ok: false, grund: 'modus' };
    const alt = standortGenauigkeitNorm(this.state.settings.standortGenauigkeit);
    const ausnahmen = { ...alt.ausnahmen };
    if (modus == null) delete ausnahmen[personId];
    else ausnahmen[personId] = modus;
    this.state.settings.standortGenauigkeit = { ...alt, ausnahmen };
    this.notify();
    this.schreibeSettings();
    return { ok: true, genauigkeit: this.getStandortGenauigkeit() };
  }

  // Was sieht diese Person wirklich von mir? Gerechnet wird hier mit derselben Regel, die der
  // Server anwendet (projections.lageGroeber ↔ 0034 private.standort_genau_fuer) — das ist eine
  // Vorschau der Serverantwort, keine zweite Entscheidung.
  //
  // Runde 7, Welle 3 (Mangel 2, Hausregel 3): MICH SELBST sehe ich immer und immer genau. Genau
  // das sagt der Server — 0025 private.teilt_standort_mit beginnt mit `besitzer = betrachter`,
  // 0034 private.standort_genau_fuer ebenso. Bis Welle 2 sagte das Gerät etwas anderes (gemessen:
  // eine Ausnahme auf die eigene Person machte die eigene Lage grob) — zwei Wahrheiten über
  // dieselbe Sache. Zuerst geprüft wird, ob es überhaupt eine Zeile gibt: ohne Zeile sieht auch
  // der Server nichts.
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

  // --- Runde 7 (H2): Zuhause ------------------------------------------------------------
  // FEHLT es, ist die Antwort null — und die Oberfläche sagt das ehrlich. Es wird nie eine
  // Adresse erfunden (Hausregel 8; es gab schon einmal eine erfundene Adresse als „Zuhause").
  // Das Zuhause steht in den privaten Einstellungen: Es ist die genaueste Angabe, die es über
  // einen Menschen in dieser App gibt, und sie geht NIEMANDEN sonst etwas an — auch nicht die
  // Freunde, die den geteilten (gerundeten) Standort sehen dürfen.
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
    this.updateSettings({ homeAddress: neu });
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
    this.updateSettings({ homeAddress: null });
    return { ok: true };
  }

  // --- Routen speichern (0047): die Abholadresse ------------------------------------------------
  // Freiwillig, nur was die Person selbst eintippt oder sucht — die App leitet nie selbst einen Wohnort ab.
  // Sie liegt in der Tabelle abholadressen: gelesen und geschrieben nur von der Person selbst. Der Fahrer, bei dem
  // sie mitfährt, bekommt sie über die Funktion abholadressen_meines_autos — sonst niemand.
  getAbholadresse() {
    const ort = this.state.abholadresse;
    return hatLage(ort) ? ort : null;
  }

  setAbholadresse(ort) {
    if (!hatLage(ort)) return { ok: false, grund: 'koordinaten' };
    const name = String(ort.name || '').trim();
    // Ein namenloser Eintrag wäre eine leere Zusage (Hausregel 9): Der Fahrer soll lesen können, wohin er fährt.
    if (!name) return { ok: false, grund: 'name' };
    const neu = { name, city: String(ort.city || ort.address || '').trim(), lat: ort.lat, lon: ort.lon, quelle: 'suche', at: Date.now() };
    this.state.abholadresse = neu;
    this.notify();
    this.push(tx('Abholadresse speichern'), () => this.client.from('abholadressen').upsert({
      user_id: this.myUid, name: neu.name, city: neu.city, lat: neu.lat, lon: neu.lon, quelle: neu.quelle,
    }, { onConflict: 'user_id' }));
    return { ok: true, ort: neu };
  }

  clearAbholadresse() {
    if (!this.state.abholadresse) return { ok: true };
    this.state.abholadresse = null;
    this.notify();
    this.push(tx('Abholadresse entfernen'), () => this.client.from('abholadressen').delete().eq('user_id', this.myUid));
    return { ok: true };
  }

  // Wo wird jemand für dieses Meet abgeholt? 'standort' heißt ausdrücklich: am aktuellen Live-Standort. Sonst gilt die
  // Abholadresse — die eigene, oder die eines Mitfahrenden, der bei mir eingestiegen ist. Ohne beides: null (ehrlich "ohne Standort").
  getAbholort(meetId, personId) {
    const zeile = this.ridesVon(meetId)[personId];
    if (zeile?.abholung === 'standort') return this.getLage(personId);
    const ort = personId === ME ? this.getAbholadresse() : (this.state.abholadressen?.[meetId]?.[personId] || null);
    return hatLage(ort) ? { lat: ort.lat, lon: ort.lon, quelle: 'abholadresse', name: ort.name || '', genauigkeitM: null } : null;
  }

  // „Vom aktuellen Standort abholen“ (wert 'standort') oder zurück zur Abholadresse (wert 'adresse'). Nur wer mitfährt.
  setAbholung(meetId, wert) {
    const abholung = wert === 'standort' ? 'standort' : null;
    const zeile = this.ridesVon(meetId)[ME];
    if (anreiseZeile(zeile)?.art !== 'mitfahrt') return { ok: false, reason: 'keineMitfahrt' };
    if ((zeile.abholung || null) === abholung) return { ok: true };
    zeile.abholung = abholung;
    this.notify();
    this.push(tx('Abholung speichern'), () => this.client.from('meet_rides').update({ abholung }).eq('meet_id', meetId).eq('user_id', this.myUid));
    return { ok: true };
  }

  // --- Runde 7 (A6): „Ich bin da" -------------------------------------------------------
  // Reihenfolge und Anzahl. Kein Punktestand, kein Verlauf über Meets hinweg, keine
  // Verspätungsminuten, kein Geld — und nur die eigene Ankunft ist setzbar (0034: es gibt für
  // meet_ankuenfte nicht einmal eine update-Regel).
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
    const schonDa = Boolean(stempel[ME]);
    if (an) stempel[ME] = stempel[ME] || Date.now();
    else delete stempel[ME];
    this.notify();
    if (an && !schonDa) {
      // `ignoreDuplicates`: Ein zweiter Tipp darf den Stempel NICHT verschieben — die
      // Reihenfolge gehört dem ersten Mal. Auf dem Server heißt das „on conflict do nothing".
      this.push(tx('Ich bin da'), () => this.client.from('meet_ankuenfte').upsert(
        { meet_id: meetId, user_id: this.myUid, da_seit: new Date(stempel[ME]).toISOString() },
        { onConflict: 'meet_id,user_id', ignoreDuplicates: true },
      ));
    } else if (!an && schonDa) {
      this.push(tx('Ankunft zurücknehmen'), () => this.client.from('meet_ankuenfte')
        .delete().eq('meet_id', meetId).eq('user_id', this.myUid));
    }
    const nachher = this.getAnkuenfte(meetId);
    return { ok: true, position: nachher.liste.find((e) => e.personId === ME)?.position || null };
  }

  // --- Runde 5 (E1): Mitfahren. Je Meet und Person { rolle: 'fahrer'|'mitfahrer'|'selbst', plaetze, fahrerId }.
  ridesVon(meetId) {
    if (!this.ridesStand) this.ridesStand = {};
    if (!this.ridesStand[meetId]) this.ridesStand[meetId] = {};
    return this.ridesStand[meetId];
  }

  // Runde 7 (E6): Eine Zeile sagt die ART der Anreise. `rolle` wird daraus abgeleitet, damit
  // alles, was in Fahrer/Mitfahrer/Selbst denkt, unverändert weiterläuft — auf dem Server
  // erledigt das derselbe Gedanke im Trigger anreise_ableiten (0034).
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

  // Runde 7 (E6): der neue Weg — die ART der Anreise. Auf dem Server steht sie in
  // meet_rides.art; `rolle` leitet der Trigger daraus ab, damit die bestehenden Regeln
  // (mitfahrer_freigeben, mitfahrt_zuordnen) unverändert gelten.
  setAnreise(meetId, { art = null, plaetze } = {}) {
    if (!this.getMeet(meetId)) return { ok: false, reason: 'keinMeet' };
    if (art && !ANREISE_ARTEN.includes(art)) return { ok: false, reason: 'art' };
    const { geaendert, plaetze: n } = this.rideRolleLokal(meetId, art, plaetze);
    if (!geaendert) return { ok: true };
    this.notify();
    // Die eigene Zeile schreibt jede:r selbst (Regel meet_rides_*); das Freigeben der Mitfahrer
    // übernimmt der Trigger mitfahrer_freigeben.
    this.push(tx('Mitfahrt speichern'), () => (art
      ? this.client.from('meet_rides').upsert({
        meet_id: meetId, user_id: this.myUid, art,
        // `rolle` steht hier nur, weil die Spalte not null ist; der Trigger setzt sie ohnehin
        // neu — die Wahrheit ist die Art.
        rolle: rolleAusAnreise(art, n), plaetze: art === 'auto' ? n : null, fahrer_id: null,
        aktualisiert: new Date().toISOString(),
      }, { onConflict: 'meet_id,user_id' })
      : this.client.from('meet_rides').delete().eq('meet_id', meetId).eq('user_id', this.myUid)));
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

  // Runde 11 (C3): Echte Route über die Funktion `route` (OpenRouteService; der Schlüssel liegt nur
  // dort). Antwortform wie im Vertrag (repository.js) — Minuten statt Sekunden, wie die Anreise rechnet.
  async routeFragen(punkte = [], optionen = {}) {
    const liste = (Array.isArray(punkte) ? punkte : []).map((p) => [Number(p?.lon), Number(p?.lat)]);
    if (liste.length < 2 || liste.length > 12 || liste.some((p) => !p.every(Number.isFinite))) return { ok: false, reason: 'punkte' };
    try {
      const frist = new Promise((fertig) => { setTimeout(() => fertig({ error: 'frist' }), 12000); });
      const { data, error } = await Promise.race([this.client.functions.invoke('route', { body: this.routeAnfrage(liste, optionen) }), frist]);
      if (error || data?.ok !== true || !Array.isArray(data.linie)) return { ok: false, reason: 'dienst' };
      return {
        ok: true,
        linie: data.linie,
        meter: Number(data.meter) || 0,
        dauerMin: (Number(data.dauerSek) || 0) / 60,
        // Runde 12: die Reihenfolge, in der der Dienst die Punkte gefahren ist (Abholungen nach Fahrzeit).
        reihenfolge: Array.isArray(data.reihenfolge) ? data.reihenfolge.map(Number) : null,
        abschnitte: (data.abschnitte || []).map((a) => ({ meter: Number(a.meter) || 0, dauerMin: (Number(a.dauerSek) || 0) / 60 })),
      };
    } catch {
      return { ok: false, reason: 'dienst' };
    }
  }

  // Abholzeit für mich (0048): { [meetId]: { fahrerId, abMin, gesamtMin } } — Minuten nach dem Start des Fahrers und Dauer der
  // ganzen Fahrt. Mehr weiß mein Gerät nicht über die Route: keine Orte, keine Adressen der anderen.
  abholzeitEintragen(state, zeilen) {
    state.abholzeiten = {};
    for (const z of Array.isArray(zeilen) ? zeilen : []) {
      if (!z || typeof z !== 'object' || !z.meet_id) continue;
      state.abholzeiten[z.meet_id] = { fahrerId: this.sid(z.fahrer_id), abMin: Number(z.ab_min) || 0, gesamtMin: Number(z.gesamt_min) || 0 };
    }
  }

  getAbholzeit(meetId) {
    return this.state.abholzeiten?.[meetId] || null;
  }

  // Der Fahrer rechnet seine Route, wenn sich etwas ändert; ich hole dann meine neue Zeit. Höchstens alle 20 Sekunden.
  async abholzeitNachladen() {
    if (Date.now() - (this.abholzeitAm || 0) < 20000) return;
    this.abholzeitAm = Date.now();
    try {
      const { data, error } = await this.client.rpc('meine_abholzeit');
      if (error || !Array.isArray(data)) return;
      const vorher = JSON.stringify(this.state.abholzeiten || {});
      this.abholzeitEintragen(this.state, data);
      if (JSON.stringify(this.state.abholzeiten) !== vorher) this.notify();
    } catch { /* beim nächsten Laden */ }
  }

  // Nimmt der Fahrer jemanden mit, kennt sein Gerät dessen Abholadresse noch nicht (sie kommt nur über abholadressen_meines_autos,
  // erst wenn die Person bei ihm eingestiegen ist). Nur diese Adressen werden neu geholt, nicht der ganze Bestand.
  async abholadressenNachladen() {
    try {
      const { data, error } = await this.client.rpc('abholadressen_meines_autos');
      if (error || !Array.isArray(data)) return;
      const karte = {};
      for (const z of data) {
        if (!hatLage(z)) continue;
        if (!karte[z.meet_id]) karte[z.meet_id] = {};
        karte[z.meet_id][this.sid(z.user_id)] = { name: z.name || '', city: z.city || '', lat: z.lat, lon: z.lon };
      }
      this.state.abholadressen = karte;
      this.notify();
    } catch { /* der nächste Ladevorgang holt sie */ }
  }

  // Was die Funktion `route` zusätzlich wissen darf (0047): wessen Fahrt es ist und zu welchem Meet (dann wird die Route
  // gespeichert und 30 Tage nach dem Meet gelöscht) und welche Punkte am Live-Standort liegen (die gelten nur kurz).
  // Eine Kennung, die keine Datenbank-Kennung ist, bleibt weg — dann gilt die Fahrt des Fragenden.
  routeAnfrage(liste, { fahrer, meet, live, personen } = {}) {
    const uuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
    const fahrerUid = fahrer ? this.uid(fahrer) : null;
    return {
      punkte: liste,
      live: Array.isArray(live) ? live.filter((i) => Number.isInteger(i) && i >= 0 && i < liste.length) : undefined,
      ...(uuid.test(String(fahrerUid || '')) ? { fahrer: fahrerUid } : {}),
      ...(uuid.test(String(meet || '')) ? { meet } : {}),
      // Wer steht wo (nur der Fahrer selbst schickt das): daraus merkt der Server die Abholzeit je Mitfahrer.
      ...(Array.isArray(personen) && personen.length === liste.length
        ? { personen: personen.map((id) => { const u = id ? this.uid(id) : null; return uuid.test(String(u || '')) ? u : null; }) }
        : {}),
    };
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
      if (data !== 'ok') { await this.hydrate(); this.notify(); } else if (fahrerId === ME) await this.abholadressenNachladen();
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
