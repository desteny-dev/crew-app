// Welcher Datenweg? Der Demo-Modus (alles lokal) oder der echte Server (Supabase).
//
// Reihenfolge der Entscheidung:
//   1. ?gateway=supabase | ?gateway=demo   — für einen einzelnen Aufruf
//   2. window.CREW_CONFIG.gateway          — vom Server gesetzt (config.js), für Testläufe
//   3. gespeicherte Wahl im Gerät
//   4. Standard: demo
//
// Der DemoDataGateway bleibt damit jederzeit erreichbar — er ist der Offline- und Prüfmodus.

import { DemoDataGateway, DEMO_NEU_KEY } from './demo-gateway.js';
import { SupabaseGateway } from './supabase-gateway.js';
import { t } from '../core/sprache.js';

const MODE_KEY = 'crew-gateway';
// Runde 2: Eine AUSDRÜCKLICH gewählte Demo gilt auch dort, wo der Server „supabase" vorgibt.
// Vorher schlug die Vorgabe der veröffentlichten App die Wahl — der Demo-Knopf führte nach dem
// Neuladen zurück in die Anmeldung.
const DEMO_GEWAEHLT = 'crew-demo-gewaehlt';
const VENDOR = './vendor/supabase.js';

export function gatewayMode() {
  try {
    const suche = new URLSearchParams(globalThis.location?.search || '');
    // Runde 2: `?demo` ist der versteckte Einstieg. Die Demo beginnt wie für jeden neuen
    // Menschen beim Einrichten; das Merkmal verschwindet aus der Adresszeile.
    if (suche.has('demo')) {
      starteDemo();
      suche.delete('demo');
      const rest = suche.toString();
      globalThis.history?.replaceState?.(null, '', `${globalThis.location.pathname}${rest ? `?${rest}` : ''}`);
      return 'demo';
    }
    const ausUrl = suche.get('gateway');
    if (ausUrl === 'demo' || ausUrl === 'supabase') {
      globalThis.localStorage?.setItem(MODE_KEY, ausUrl);
      return ausUrl;
    }
    if (globalThis.localStorage?.getItem(DEMO_GEWAEHLT)) return 'demo';
    const konfiguriert = globalThis.CREW_CONFIG?.gateway;
    if (konfiguriert === 'demo' || konfiguriert === 'supabase') return konfiguriert;
    const gemerkt = globalThis.localStorage?.getItem(MODE_KEY);
    if (gemerkt === 'demo' || gemerkt === 'supabase') return gemerkt;
  } catch { /* privater Modus o. Ä. */ }
  return 'demo';
}

export function setGatewayMode(mode) {
  try {
    globalThis.localStorage?.setItem(MODE_KEY, mode);
    if (mode === 'demo') globalThis.localStorage?.setItem(DEMO_GEWAEHLT, '1');
    else globalThis.localStorage?.removeItem(DEMO_GEWAEHLT);
  } catch { /* egal */ }
}

// Runde 2: Demo merken und beim nächsten Laden von vorn beginnen (Einrichten, dann Beispiele).
export function starteDemo() {
  setGatewayMode('demo');
  try { globalThis.localStorage?.setItem(DEMO_NEU_KEY, '1'); } catch { /* egal */ }
}

// Die Supabase-Bibliothek liegt als fertiges Bündel im Projekt (web/vendor/supabase.js) und
// wird NUR geladen, wenn der Server-Modus wirklich gebraucht wird. Kein Aufruf an ein CDN:
// die App soll nichts nachladen, was nicht aus ihrer eigenen Adresse kommt.
let vendorPromise = null;
function loadVendor() {
  if (globalThis.supabase?.createClient) return Promise.resolve(globalThis.supabase);
  if (vendorPromise) return vendorPromise;
  vendorPromise = new Promise((resolve, reject) => {
    const script = document.createElement('script');
    script.src = VENDOR;
    script.onload = () => resolve(globalThis.supabase);
    script.onerror = () => reject(new Error(t('Supabase-Bibliothek nicht ladbar')));
    document.head.appendChild(script);
  });
  return vendorPromise;
}

export function supabaseConfig() {
  const config = globalThis.CREW_CONFIG || {};
  return {
    url: config.supabaseUrl || 'https://wuflbpoalrhzynptcexa.supabase.co',
    key: config.supabaseKey || 'sb_publishable_cS3jdDAwGWnXAYBjiruhhg_HnzmfsGi',
  };
}

// Schreibvorgänge müssen auch dann ankommen, wenn die Seite gleich danach geschlossen oder
// neu geladen wird. Ohne `keepalive` bricht der Browser eine laufende Anfrage beim Verlassen
// der Seite ab — wer zusagt und sofort die App wegwischt, hätte nie zugesagt. Lesende
// Anfragen bleiben unverändert; für sie wäre das Weiterleben nach dem Verlassen sinnlos.
// Die Uhren der Server stehen nicht auf die Millisekunde gleich. Das Anmelde-Teil stellt den
// Ausweis aus, das Daten-Teil prüft ihn — steht dessen Uhr einen Wimpernschlag zurück, sieht
// es einen Ausweis „aus der Zukunft" und lehnt ab („JWT issued at future"). Das passiert
// genau in der ersten Sekunde nach dem Anmelden. Statt die App daran scheitern zu lassen,
// wartet sie kurz und fragt noch einmal — mehr ist nicht nötig, denn die Uhr holt auf.
const SKEW_WARTEN = [700, 1500, 2500];

function istUhrenFehler(text) {
  return /issued at future|JWTIssuedAtFuture/i.test(text || '');
}

// Runde 4 (Jonathan: „Profilbild-Upload geht nicht") — gemessen: `keepalive` gibt es nur für
// kleine Anfragen. Alle gleichzeitig laufenden keepalive-Anfragen zusammen dürfen höchstens 64 KB
// tragen (Fetch-Standard; Chrome und Safari setzen das durch). Ein Profilfoto als Daten-Adresse
// (60–150 KB) sprengte das: fetch warf sofort „Failed to fetch", der Schreibvorgang galt als
// gescheitert, die App lud den alten Stand — und das Foto war wieder weg. Vom Rechner aus (ohne
// diese Grenze) ging dieselbe Anfrage mit 150 KB durch. Deshalb: keepalive nur, solange die Summe
// darunter bleibt; größere Anfragen gehen als normale Anfrage (sie kommen an, solange die App offen ist).
const KEEPALIVE_GRENZE = 60 * 1024;
let keepaliveUnterwegs = 0;

function koerperGroesse(body) {
  if (body == null) return 0;
  if (typeof body === 'string') return body.length > KEEPALIVE_GRENZE ? body.length : new TextEncoder().encode(body).length;
  if (typeof Blob !== 'undefined' && body instanceof Blob) return body.size;
  if (body instanceof ArrayBuffer) return body.byteLength;
  if (ArrayBuffer.isView(body)) return body.byteLength;
  return Infinity; // FormData, Stream: Größe unbekannt → ohne keepalive
}

function fetchMitKeepalive(input, init = {}) {
  const methode = (init.method || 'GET').toUpperCase();
  const schreibt = methode !== 'GET' && methode !== 'HEAD';
  const groesse = schreibt ? koerperGroesse(init.body) : 0;
  const versuch = async (nummer) => {
    const mitKeepalive = schreibt && keepaliveUnterwegs + groesse <= KEEPALIVE_GRENZE;
    let antwort;
    if (mitKeepalive) keepaliveUnterwegs += groesse;
    try {
      antwort = await fetch(input, mitKeepalive ? { ...init, keepalive: true } : init);
    } finally {
      if (mitKeepalive) keepaliveUnterwegs -= groesse;
    }
    if (antwort.status !== 401 || nummer >= SKEW_WARTEN.length) return antwort;
    let text = '';
    try { text = await antwort.clone().text(); } catch { return antwort; }
    if (!istUhrenFehler(text)) return antwort;
    await new Promise((weiter) => setTimeout(weiter, SKEW_WARTEN[nummer]));
    return versuch(nummer + 1);
  };
  return versuch(0);
}

export async function createSupabaseClient() {
  const lib = await loadVendor();
  const { url, key } = supabaseConfig();
  return lib.createClient(url, key, {
    auth: { persistSession: true, autoRefreshToken: true, detectSessionInUrl: false, storageKey: 'crew-auth' },
    global: { fetch: fetchMitKeepalive },
  });
}

// Links aus unseren E-Mails (Bestätigung, Passwort vergessen, geänderte Adresse) kommen mit
// einer fertigen Sitzung im Anhang der Adresse zurück. `detectSessionInUrl` steht absichtlich
// auf aus — die Bibliothek würde den Anhang auch dann auflösen, wenn er von irgendwoher
// stammt. Hier wird er EINMAL, bewusst und sichtbar eingelöst und danach aus der Adresszeile
// entfernt, damit kein Zugangsschlüssel im Verlauf des Browsers stehen bleibt.
//
// → 'wiederherstellung', wenn der Link aus „Passwort vergessen" kam (dann muss ein neues
//   Passwort gesetzt werden), sonst '' bzw. der Typ des Links.
async function einloeseLinkAusAdresse(client) {
  const ort = globalThis.location;
  if (!ort) return '';
  const anhang = new URLSearchParams((ort.hash || '').replace(/^#/, ''));
  const suche = new URLSearchParams(ort.search || '');
  const typ = anhang.get('type') || suche.get('type') || '';
  const zugang = anhang.get('access_token');
  const erneuerung = anhang.get('refresh_token');
  const code = suche.get('code');
  let eingeloest = false;

  try {
    if (zugang && erneuerung) {
      const { error } = await client.auth.setSession({ access_token: zugang, refresh_token: erneuerung });
      eingeloest = !error;
    } else if (code) {
      const { error } = await client.auth.exchangeCodeForSession(code);
      eingeloest = !error;
    }
  } catch { /* Ein kaputter Link führt zur normalen Anmeldung, nicht zu einem Absturz. */ }

  if (zugang || code || anhang.get('error')) {
    suche.delete('code');
    suche.delete('type');
    const rest = suche.toString();
    globalThis.history?.replaceState?.(null, '', `${ort.pathname}${rest ? `?${rest}` : ''}`);
  }
  return eingeloest && typ === 'recovery' ? 'wiederherstellung' : '';
}

// R1 §10: Die Rückfrage vor dem Zurücksetzen. `?neu=1&sofort=1` überspringt sie — das ist
// der Weg für Prüfläufe, die niemanden fragen können. Ein Mensch bekommt sie immer.
async function sollZuruecksetzen() {
  const suche = new URLSearchParams(globalThis.location?.search || '');
  if (!suche.has('neu')) return false;
  if (suche.has('sofort')) return true;
  const frage = t('Dieses Konto komplett zurücksetzen?\n\nAlles wird gelöscht: Profil, Freunde, Gruppen, Meets, Nachrichten. Danach läuft das Einrichten von vorn. Die Anmeldung (E-Mail und Passwort) bleibt.');
  return Boolean(globalThis.confirm?.(frage));
}

function gespeicherteAnmeldung() {
  try {
    return Boolean(globalThis.localStorage?.getItem('crew-auth'));
  } catch {
    return false;
  }
}

// Liefert { repo, mode } — oder { needsAuth: true, client }, wenn niemand angemeldet ist.
export async function createRepository(engine, hooks = {}) {
  const mode = gatewayMode();
  if (mode !== 'supabase') return { mode: 'demo', repo: new DemoDataGateway(engine) };

  const client = await createSupabaseClient();
  const wiederherstellung = await einloeseLinkAusAdresse(client);
  let { data: { session } } = await client.auth.getSession();
  // Runde 3 (L1, Jonathan: „Angemeldet bleiben — nicht jedes Mal neu"): Ist der Zugang
  // abgelaufen und das Netz beim Öffnen gerade weg (Tunnel, Flugmodus, App kommt aus dem
  // Hintergrund), liefert getSession() kurz nichts — die gespeicherte Anmeldung ist aber noch da
  // (ein ungültiger Zugang würde von der Bibliothek selbst entfernt). Dann nicht die
  // Anmeldemaske zeigen, sondern kurz warten und noch einmal fragen.
  for (const ms of [700, 1800, 3500]) {
    if (session || !gespeicherteAnmeldung()) break;
    await new Promise((weiter) => setTimeout(weiter, ms));
    ({ data: { session } } = await client.auth.getSession());
  }
  if (!session && gespeicherteAnmeldung()) {
    throw new Error(t('Keine Verbindung zum Server. Deine Anmeldung ist noch da – öffne Crew gleich noch einmal.'));
  }

  // Nach „Passwort vergessen" wird zuerst ein neues Passwort gesetzt — sonst wäre man
  // angemeldet und hätte weiterhin das vergessene Passwort.
  if (wiederherstellung && session) return { mode: 'supabase', neuesPasswort: true, client };

  // Nur für automatische Testläufe: der lokale Server darf ein Prüfkonto mitgeben.
  const auto = globalThis.CREW_CONFIG?.autoLogin;
  // Runde 3 (L4): Wer sich eben abgemeldet oder sein Konto gelöscht hat, sieht die Anmeldung —
  // auch auf dem Prüfserver, der sonst sofort wieder anmelden würde (Merker aus zurAnmeldung()).
  let eben = false;
  try { eben = Boolean(globalThis.sessionStorage?.getItem('crew-eben-abgemeldet')); } catch { /* egal */ }
  if (session) { try { globalThis.sessionStorage?.removeItem('crew-eben-abgemeldet'); } catch { /* egal */ } }
  if (!session && !eben && auto?.email && auto?.password) {
    const { data, error } = await client.auth.signInWithPassword({ email: auto.email, password: auto.password });
    if (error) throw new Error(t('Automatische Anmeldung fehlgeschlagen: {fehler}', { fehler: error.message }));
    session = data.session;
  }

  if (!session) return { mode: 'supabase', needsAuth: true, client };

  // Auftrag R1 §10: `?neu=1` räumt das EIGENE Konto ab und startet das Einrichten von vorn —
  // derselbe Handgriff wie im Demo-Modus, nur dass hier auch der Server mitmacht. Er trifft
  // nie ein fremdes Konto: die Datenbankfunktion kennt kein Argument, sie räumt immer nur
  // den auf, der sie ruft (Migration 0014). Der Zwischenschritt mit der Rückfrage steht
  // bewusst da — eine Adresse ist schnell weitergegeben, und danach ist es weg.
  if (await sollZuruecksetzen()) {
    const { error } = await client.rpc('konto_zuruecksetzen');
    if (error) throw new Error(t('Zurücksetzen fehlgeschlagen: {fehler}', { fehler: error.message }));
    try {
      for (const schluessel of Object.keys(globalThis.localStorage || {})) {
        if (schluessel.startsWith('crew-') && schluessel !== 'crew-auth') globalThis.localStorage.removeItem(schluessel);
      }
    } catch { /* privater Modus */ }
    const ort = globalThis.location;
    const rest = new URLSearchParams(ort.search || '');
    rest.delete('neu');
    ort.replace(`${ort.pathname}${rest.toString() ? `?${rest}` : ''}`);
    await new Promise(() => {}); // die Seite lädt gleich neu — hier geht nichts mehr weiter
  }

  const repo = new SupabaseGateway(engine, {
    client,
    userId: session.user.id,
    authUser: session.user,
    onError: hooks.onError,
    onToast: hooks.onToast,
  });
  await repo.ready();

  // Beim Verlassen der Seite (Neuladen, Tab zu, App in den Hintergrund) geht sofort raus,
  // was noch aussteht. Sonst verlöre genau die letzte Handlung vor dem Schließen ihre Wirkung.
  const verlassen = () => repo.flushBeimVerlassen();
  globalThis.addEventListener?.('pagehide', verlassen);
  globalThis.addEventListener?.('beforeunload', verlassen);
  globalThis.document?.addEventListener?.('visibilitychange', () => {
    if (globalThis.document.visibilityState === 'hidden') verlassen();
  });

  return { mode: 'supabase', repo, client, session };
}
