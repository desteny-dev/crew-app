// Push-Mitteilungen (Prüfschritt T4) — die Seite des Geräts.
//
// Was hier passiert, in einem Satz: Das Gerät meldet sich beim Push-Dienst seines Browsers
// an und hinterlegt die dabei entstandene Adresse auf dem Server. Mehr braucht es nicht —
// der Server schickt später an diese Adresse, der Browser weckt den Service Worker, und der
// zeigt die Mitteilung. Die App muss dafür nicht laufen.
//
// RUNDE 7b — ZWEI WEGE, EIN VERTRAG
// ---------------------------------------------------------------------------------------------
// Bis hierher war diese Datei reiner Web-Push: Sie prüfte `globalThis.Notification`, und das
// gibt es in der WKWebView des iPhones NICHT. In der nativen Hülle sagte die App deshalb
// „auf diesem Gerät nicht möglich" oder „erst auf den Home-Bildschirm" — auf einer App, die
// längst auf dem Home-Bildschirm liegt. Mitteilungen konnten dort nie ankommen.
//
// Jetzt gibt es zwei Wege hinter DENSELBEN fünf Funktionen (pushZustand, pushAnschalten,
// pushAusschalten, pushProbe, pushAbgleichen). Welcher gilt, entscheidet allein die Hülle:
//
//   HÜLLE (iPhone-/Android-App)        BROWSER / Web-App
//   @capacitor/push-notifications      Notification + PushManager + Service Worker
//   Erlaubnis: requestPermissions()    Notification.requestPermission()
//   Adresse:  Gerätezeichen (Token)    endpoint + p256dh + auth
//   Ablage:   public.push_geraete      public.push_subscriptions
//
// Die ZUSTÄNDE sind in beiden Wegen dieselben Wörter — der Bildschirm muss den Unterschied
// nicht kennen. Ein Wort kommt dazu: 'server'. Es heißt „dieses Gerät ist beim Betriebssystem
// angemeldet, aber der Server kann App-Geräte noch nicht ablegen" (die Tabelle push_geraete
// fehlt noch, siehe NATIVE.md §3c). Lieber ein ehrliches viertes Wort als ein falsches „An".
//
// Drei Dinge, die dabei oft schiefgehen und deshalb hier ausdrücklich stehen:
//
// 1. **Nie ungefragt fragen.** Ein Erlaubnisfenster beim ersten Start ist die sicherste Art,
//    ein Nein zu bekommen — und ein Nein lässt sich in vielen Browsern nur noch in den
//    Einstellungen zurücknehmen. Gefragt wird deshalb ausschließlich auf einen Tipp
//    (Crew → Karte „Mitteilungen aufs Handy" oder Profil → Mitteilungen).
// 2. **Auf dem iPhone erst nach dem Ablegen.** Safari erlaubt Push nur, wenn die App auf dem
//    Startbildschirm liegt (standalone). Vorher gibt es kein Erlaubnisfenster — das ist kein
//    Fehler, sondern Apples Regel, und die App sagt das auch so.
// 3. **Runde 5 (P5): Die Erlaubnis wird IM Tipp angefragt.** Vorher lagen zwischen Tipp und
//    Notification.requestPermission() ein dynamischer Import und zwei Rückfragen an den Service
//    Worker. Safari verlangt die Berührung als unmittelbaren Auslöser — nach mehreren await
//    kann sie verbraucht sein, und das Fenster kommt nie. pushAnschalten() fragt deshalb
//    SYNCHRON als Erstes, und die aufrufende Stelle muss dieses Modul statisch geladen haben.

import { istHuelle, plattform, faehigkeitPlugin, huelleLauscher, erlaubnisStand, erlaubnisStandSofort, erlaubnisFragen } from '../core/native.js';

const VAPID_PUBLIC_KEY = 'BOlLYYd-HFORcg0R0qpmSplta5pjKg3VqpDWNRfhnwCM-6BJRO1zjQ0-eGbl77yP7YYGYjTt1Qvf6FOifgY7tPg';

// Wie lange auf den Service Worker gewartet wird. Unter https meldet er sich beim Laden an;
// fehlt er (örtlicher Betrieb ohne ?sw=1), käme `ready` sonst nie zurück.
const SW_FRIST_MS = 8000;

function base64UrlZuBytes(text) {
  const gefuellt = (text + '='.repeat((4 - (text.length % 4)) % 4)).replace(/-/g, '+').replace(/_/g, '/');
  const roh = atob(gefuellt);
  const bytes = new Uint8Array(roh.length);
  for (let i = 0; i < roh.length; i += 1) bytes[i] = roh.charCodeAt(i);
  return bytes;
}

function bytesZuBase64Url(buffer) {
  const bytes = new Uint8Array(buffer);
  let roh = '';
  for (const b of bytes) roh += String.fromCharCode(b);
  return btoa(roh).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}

function mitFrist(versprechen, ms) {
  return Promise.race([
    Promise.resolve(versprechen).catch(() => null),
    new Promise((fertig) => { setTimeout(() => fertig(null), ms); }),
  ]);
}

// --- Der native Weg (Hülle) -----------------------------------------------------------------
//
// Alles unter dieser Überschrift läuft AUSSCHLIESSLICH in der Hülle. Im Browser gibt
// nativesPush() null zurück, und jede Funktion weiter unten geht denselben Weg wie bisher.

const SPEICHER_ZEICHEN = 'crew.push.zeichen';     // das Gerätezeichen, damit es nachgereicht werden kann
const ZEICHEN_FRIST_MS = 15000;                   // so lange warten wir auf das Zeichen von Apple/Google

/** Das Push-Plugin der Hülle — oder null. Es gibt keinen dritten Fall. */
function nativesPush() {
  if (!istHuelle()) return null;
  // Ohne Methodenliste: huellePlugin() merkt sich den Zugang unter dem Namen, und eine
  // engere Liste hier nähme einem späteren Aufrufer die restlichen Methoden für immer weg.
  return faehigkeitPlugin('mitteilungen');
}

/** Läuft dieses Gerät über die App und nicht über den Browser? */
export function istNativerWeg() {
  return Boolean(nativesPush());
}

function zeichenLesen() {
  try { return JSON.parse(globalThis.localStorage?.getItem(SPEICHER_ZEICHEN) || 'null'); } catch { return null; }
}

function zeichenSchreiben(wert) {
  try {
    if (wert) globalThis.localStorage?.setItem(SPEICHER_ZEICHEN, JSON.stringify(wert));
    else globalThis.localStorage?.removeItem(SPEICHER_ZEICHEN);
  } catch { /* privates Fenster */ }
}

// Der letzte gemessene native Zustand. pushZustandSofort() darf nicht warten, das Plugin
// antwortet aber nur mit einem Versprechen — deshalb steht hier, was zuletzt galt.
let nativZuletzt = null;

/**
 * Das Gerätezeichen. Es kommt NICHT als Antwort auf register(), sondern als Ereignis
 * 'registration' — deshalb wird zuerst zugehört und dann angemeldet. Kommt stattdessen
 * 'registrationError', ist das eine Absage mit Grund (Android ohne google-services.json).
 */
function zeichenHolen(plugin) {
  return new Promise((fertig) => {
    let erledigt = false;
    const schliessen = (wert) => { if (erledigt) return; erledigt = true; lauscher.forEach((l) => { try { l?.remove?.(); } catch { /* egal */ } }); fertig(wert); };
    const lauscher = [
      huelleLauscher('PushNotifications', 'registration', (ereignis) => schliessen({ zeichen: ereignis?.value || '' })),
      huelleLauscher('PushNotifications', 'registrationError', (ereignis) => schliessen({ fehler: String(ereignis?.error || 'unbekannt') })),
    ];
    setTimeout(() => schliessen({ fehler: 'keine Antwort vom Push-Dienst' }), ZEICHEN_FRIST_MS);
    // register() wirft auf Android, wenn google-services.json fehlt — das ist kein Absturz,
    // sondern genau die Auskunft, die der Bildschirm braucht.
    Promise.resolve(plugin.register()).catch((e) => schliessen({ fehler: String(e?.message || e || 'register scheiterte') }));
  });
}

/**
 * Die Erlaubnis für Mitteilungen in der Hülle → 'erteilt' | 'abgelehnt' | 'offen'.
 *
 * Runde 7, dritte Welle: Vorher stand hier eine ZWEITE Auslegung von `checkPermissions()`
 * (receive === 'granted' …) — dieselbe Wahrheit wie in core/native.js, nur ein zweites Mal
 * geschrieben. Genau davor warnt Hausregel 3. Jetzt fragt diese Datei dort, wo die Antwort
 * herkommt: `erlaubnisStand`/`erlaubnisFragen` sprechen im Browser wie in der Hülle dieselben
 * Wörter, und sie frischen den Stand mit auf, den `erlaubnisStandSofort()` synchron ausgibt.
 *
 * Nur in der HÜLLE: Dort fragt das Betriebssystem selbst, und `await` ist erlaubt. Im Browser
 * bleibt der Weg unverändert synchron im Tipp (siehe Punkt 3 im Kopf dieser Datei).
 */
function nativeErlaubnis({ fragen = false } = {}) {
  return fragen ? erlaubnisFragen('mitteilungen') : erlaubnisStand('mitteilungen');
}

/**
 * Das Gerätezeichen beim Server hinterlegen. Antwort:
 *   'ok'        — abgelegt
 *   'kein-server' — die Tabelle push_geraete gibt es noch nicht (NATIVE.md §3c)
 *   'fehler'    — alles andere
 * Gemerkt wird das Zeichen in jedem Fall lokal, damit pushAbgleichen() es beim nächsten Start
 * nachreicht, sobald die Tabelle da ist.
 */
async function geraetHinterlegen(client, zeichen) {
  const art = plattform() === 'ios' ? 'apns' : 'fcm';
  zeichenSchreiben({ zeichen, art, at: Date.now() });
  if (!client) return 'fehler';
  try {
    const { data: sitzung } = await client.auth.getUser();
    const userId = sitzung?.user?.id;
    if (!userId) return 'fehler';
    const { error } = await client.from('push_geraete').upsert({
      user_id: userId,
      zeichen,
      art,
      plattform: plattform(),
      user_agent: (globalThis.navigator?.userAgent || '').slice(0, 200),
      last_seen_at: new Date().toISOString(),
      gone_at: null,
    }, { onConflict: 'zeichen' });
    if (!error) return 'ok';
    // PostgREST meldet eine fehlende Tabelle als PGRST205 bzw. Postgres als 42P01. Das ist
    // kein Fehler dieses Geräts — der Server ist nur noch nicht so weit.
    const text = `${error.code || ''} ${error.message || ''}`;
    return /PGRST205|42P01|does not exist|Could not find the table/i.test(text) ? 'kein-server' : 'fehler';
  } catch {
    return 'fehler';
  }
}

async function nativerZustand() {
  if (!nativesPush()) return null;
  const erlaubnis = await nativeErlaubnis();
  if (erlaubnis === 'abgelehnt') { nativZuletzt = 'abgelehnt'; return nativZuletzt; }
  if (erlaubnis !== 'erteilt') { nativZuletzt = 'bereit'; return nativZuletzt; }
  const gemerkt = zeichenLesen();
  nativZuletzt = gemerkt?.zeichen ? (gemerkt.server === false ? 'server' : 'an') : 'bereit';
  return nativZuletzt;
}

async function nativAnschalten(client) {
  const plugin = nativesPush();
  if (!plugin) return 'unmoeglich';
  const erlaubnis = await nativeErlaubnis({ fragen: true });
  if (erlaubnis === 'abgelehnt') { nativZuletzt = 'abgelehnt'; return nativZuletzt; }
  if (erlaubnis !== 'erteilt') { nativZuletzt = 'bereit'; return nativZuletzt; }
  const antwort = await zeichenHolen(plugin);
  if (!antwort?.zeichen) {
    nativAnschalten.letzterFehler = antwort?.fehler || 'kein Gerätezeichen';
    nativZuletzt = 'fehler';
    return nativZuletzt;
  }
  const abgelegt = await geraetHinterlegen(client, antwort.zeichen);
  const gemerkt = zeichenLesen() || {};
  zeichenSchreiben({ ...gemerkt, server: abgelegt === 'ok' });
  nativZuletzt = abgelegt === 'ok' ? 'an' : abgelegt === 'kein-server' ? 'server' : 'fehler';
  return nativZuletzt;
}

async function nativAusschalten(client) {
  const plugin = nativesPush();
  if (!plugin) return 'bereit';
  const gemerkt = zeichenLesen();
  try { await plugin.unregister?.(); } catch { /* dann bleibt die Anmeldung beim Dienst stehen */ }
  if (client && gemerkt?.zeichen) {
    try { await client.from('push_geraete').delete().eq('zeichen', gemerkt.zeichen); } catch { /* s. o. */ }
  }
  zeichenSchreiben(null);
  nativZuletzt = 'bereit';
  return nativZuletzt;
}

function hatMitteilungen() {
  return typeof globalThis.Notification === 'function' || typeof globalThis.Notification === 'object';
}

// Der Erlaubnisstand OHNE Warten, in den Wörtern des Web-Wegs ('granted' | 'denied' | 'default').
//
// Runde 7, dritte Welle: Vorher las diese Zeile `globalThis.Notification.permission` direkt.
// Das ist in einer WebView, die `Notification` mitbringt und dauerhaft 'denied' sagt, die
// FALSCHE Wahrheit — das Plugin stellt dort einwandfrei zu. `erlaubnisStandSofort()` kennt beide
// Wege und antwortet in der Hülle mit dem Stand des Plugins, im Browser mit dem des Browsers.
function erlaubnisJetzt() {
  const wort = erlaubnisStandSofort('mitteilungen');
  if (wort === 'erteilt') return 'granted';
  if (wort === 'abgelehnt') return 'denied';
  return 'default';
}

// Liegt die App auf dem Startbildschirm? Nur dann kennt ein iPhone überhaupt Push.
export function alsAppGestartet() {
  return Boolean(globalThis.matchMedia?.('(display-mode: standalone)')?.matches || globalThis.navigator?.standalone);
}

// iPhone und iPad. Ein iPad meldet sich in Safari als Mac — erkennbar an den Berührungspunkten.
export function istApple() {
  const nav = globalThis.navigator || {};
  const kennung = nav.userAgent || '';
  return /iPhone|iPad|iPod/.test(kennung) || (/Macintosh/.test(kennung) && Number(nav.maxTouchPoints) > 1);
}

function kannPush() {
  return Boolean(globalThis.navigator && 'serviceWorker' in globalThis.navigator && 'PushManager' in globalThis && hatMitteilungen());
}

// Was ohne Rückfrage feststeht — für den ersten Render, damit nichts nachträglich aufspringt.
//   'homescreen' | 'unmoeglich' | 'abgelehnt' | 'erlaubt' (Anmeldung noch nicht geprüft) | 'bereit'
export function pushZustandSofort() {
  // Die Hülle ZUERST: In der App ist „erst auf den Home-Bildschirm" die falscheste aller
  // Antworten — sie liegt ja dort. Und Notification gibt es in der WKWebView gar nicht.
  if (istNativerWeg()) return nativZuletzt || 'bereit';
  if (istApple() && !alsAppGestartet()) return 'homescreen';
  if (!kannPush()) return 'unmoeglich';
  const erlaubnis = erlaubnisJetzt();
  if (erlaubnis === 'denied') return 'abgelehnt';
  if (erlaubnis === 'granted') return 'erlaubt';
  return 'bereit';
}

// Was der Bildschirm „Mitteilungen" wissen muss, um ehrlich zu sein.
//   'bereit'        — kann angeschaltet werden
//   'an'            — läuft
//   'abgelehnt'     — jemand hat Nein gesagt; das nimmt nur er selbst zurück
//   'homescreen'    — iPhone, App nicht auf dem Startbildschirm
//   'unmoeglich'    — Browser kann kein Push (oder kein Service Worker da)
//   'server'        — App-Gerät angemeldet, der Server kann es noch nicht ablegen (Hülle)
export async function pushZustand() {
  if (istNativerWeg()) return (await nativerZustand()) || 'bereit';
  const sofort = pushZustandSofort();
  if (sofort === 'homescreen' || sofort === 'unmoeglich' || sofort === 'abgelehnt') return sofort;
  const registrierung = await mitFrist(globalThis.navigator.serviceWorker.getRegistration(), SW_FRIST_MS);
  if (!registrierung?.pushManager) return 'unmoeglich';
  const vorhanden = await mitFrist(registrierung.pushManager.getSubscription(), SW_FRIST_MS);
  if (vorhanden && erlaubnisJetzt() === 'granted') return 'an';
  return 'bereit';
}

// Safari kannte früher nur die Rückruf-Form; heute gibt es ein Versprechen. Beides abdecken.
function erlaubnisAnfragen() {
  return new Promise((fertig) => {
    try {
      const antwort = globalThis.Notification.requestPermission((wert) => fertig(wert));
      if (antwort && typeof antwort.then === 'function') antwort.then(fertig, () => fertig('default'));
    } catch {
      fertig('default');
    }
  });
}

// Anschalten. MUSS synchron im Tipp aufgerufen werden (siehe oben, Punkt 3). Gibt ein
// Versprechen auf das zurück, was danach gilt:
//   'an' | 'bereit' (Fenster ohne Antwort geschlossen) | 'abgelehnt' | 'homescreen' | 'unmoeglich'
//   | 'fehler' (Service Worker fehlt, Anmeldung scheiterte oder ließ sich nicht speichern)
export function pushAnschalten(client) {
  // In der Hülle fragt das Betriebssystem selbst — dort gibt es die Berührungsfrist nicht,
  // die Safari im Browser verlangt. Deshalb darf dieser Zweig await benutzen.
  if (istNativerWeg()) return nativAnschalten(client).catch(() => 'fehler');
  const sofort = pushZustandSofort();
  if (sofort === 'homescreen' || sofort === 'unmoeglich' || sofort === 'abgelehnt') return Promise.resolve(sofort);
  // Jetzt, noch in der Berührung — bevor irgendetwas anderes wartet.
  const erlaubnis = erlaubnisJetzt() === 'granted' ? Promise.resolve('granted') : erlaubnisAnfragen();
  pushAnschalten.letzteAnfrage = { at: Date.now(), gefragt: erlaubnisJetzt() !== 'granted' };

  return (async () => {
    const antwort = await erlaubnis;
    if (antwort !== 'granted') return antwort === 'denied' ? 'abgelehnt' : 'bereit';
    const registrierung = await mitFrist(globalThis.navigator.serviceWorker.ready, SW_FRIST_MS);
    if (!registrierung?.pushManager) return 'fehler';
    let anmeldung = await mitFrist(registrierung.pushManager.getSubscription(), SW_FRIST_MS);
    if (!anmeldung) {
      try {
        anmeldung = await registrierung.pushManager.subscribe({
          userVisibleOnly: true,
          applicationServerKey: base64UrlZuBytes(VAPID_PUBLIC_KEY),
        });
      } catch {
        return 'fehler';
      }
    }
    if (!anmeldung) return 'fehler';
    const gespeichert = await anmeldungHinterlegen(client, anmeldung);
    return gespeichert ? 'an' : 'fehler';
  })().catch(() => 'fehler');
}

// Ausschalten heißt: Diesem Gerät wird nichts mehr geschickt. Die Erlaubnis des Browsers
// bleibt bestehen — sie gehört ihm, nicht uns.
export async function pushAusschalten(client) {
  if (istNativerWeg()) return nativAusschalten(client).catch(() => 'bereit');
  if (!kannPush()) return pushZustandSofort();
  const registrierung = await mitFrist(globalThis.navigator.serviceWorker.getRegistration(), SW_FRIST_MS);
  const anmeldung = await mitFrist(registrierung?.pushManager?.getSubscription?.(), SW_FRIST_MS);
  if (!anmeldung) return 'bereit';
  try {
    await client?.from('push_subscriptions').delete().eq('endpoint', anmeldung.endpoint);
  } catch { /* dann bleibt eine tote Anmeldung stehen; der Versand räumt sie beim ersten Fehler weg */ }
  await anmeldung.unsubscribe().catch(() => {});
  return 'bereit';
}

// Runde 5 (P5): Eine Probe-Mitteilung direkt vom Gerät — ohne Server. So lässt sich am echten
// iPhone sofort sehen, ob Erlaubnis und Service Worker stimmen (Aussehen, Ton, Sperrbildschirm).
export async function pushProbe({ titel, text } = {}) {
  // In der Hülle gibt es diesen Weg NICHT: Eine Mitteilung ohne Server bräuchte
  // @capacitor/local-notifications, und das ist bewusst nicht eingebaut (NATIVE.md §5).
  // Deshalb sagt die Funktion hier ehrlich nein — und der Bildschirm zeigt den Knopf erst
  // gar nicht an (ui/mitteilungen.js).
  if (istNativerWeg()) return false;
  if (!kannPush() || erlaubnisJetzt() !== 'granted') return false;
  const registrierung = await mitFrist(globalThis.navigator.serviceWorker.ready, SW_FRIST_MS);
  if (!registrierung?.showNotification) return false;
  try {
    await registrierung.showNotification(titel || 'Crew', {
      body: text || '',
      icon: './icons/icon-192.png',
      badge: './icons/badge-96.png',
      tag: 'probe',
      renotify: true,
      vibrate: [70, 50, 70],
      data: { url: './?route=profile.notifications', art: 'probe' },
    });
    return true;
  } catch {
    return false;
  }
}

async function anmeldungHinterlegen(client, anmeldung) {
  if (!client) return false;
  try {
    const roh = anmeldung.toJSON();
    const p256dh = roh.keys?.p256dh || bytesZuBase64Url(anmeldung.getKey('p256dh'));
    const auth = roh.keys?.auth || bytesZuBase64Url(anmeldung.getKey('auth'));
    const { data: sitzung } = await client.auth.getUser();
    const userId = sitzung?.user?.id;
    if (!userId) return false;
    const { error } = await client.from('push_subscriptions').upsert({
      user_id: userId,
      endpoint: anmeldung.endpoint,
      p256dh,
      auth,
      user_agent: globalThis.navigator.userAgent.slice(0, 200),
      last_seen_at: new Date().toISOString(),
      gone_at: null,
    }, { onConflict: 'endpoint' });
    return !error;
  } catch {
    return false;
  }
}

// Der Push-Dienst darf eine Anmeldung jederzeit austauschen (pushsubscriptionchange). Passiert
// das, während die App offen ist, wird die neue Adresse sofort nachgetragen; sonst beim
// nächsten Start — deshalb wird sie bei jedem Start einmal abgeglichen.
export async function pushAbgleichen(client) {
  // Hülle: Das Gerätezeichen gilt nicht ewig, und es kann sein, dass es beim Einschalten
  // nirgends abgelegt werden konnte (Tabelle push_geraete fehlte noch). Beides holt dieser
  // Abgleich beim nächsten Start von selbst nach — ohne dass jemand noch einmal tippen muss.
  if (istNativerWeg()) {
    if (!client) return;
    if (!nativesPush() || (await nativeErlaubnis()) !== 'erteilt') return;
    const gemerkt = zeichenLesen();
    if (!gemerkt?.zeichen) return;
    const abgelegt = await geraetHinterlegen(client, gemerkt.zeichen);
    zeichenSchreiben({ ...(zeichenLesen() || {}), server: abgelegt === 'ok' });
    nativZuletzt = abgelegt === 'ok' ? 'an' : abgelegt === 'kein-server' ? 'server' : nativZuletzt;
    return;
  }
  if (!client || !kannPush()) return;
  if (erlaubnisJetzt() !== 'granted') return;
  try {
    const registrierung = await mitFrist(globalThis.navigator.serviceWorker.ready, SW_FRIST_MS);
    const anmeldung = await mitFrist(registrierung?.pushManager?.getSubscription?.(), SW_FRIST_MS);
    if (anmeldung) await anmeldungHinterlegen(client, anmeldung);
  } catch { /* ohne Anmeldung gibt es nichts abzugleichen */ }
}

// --- Was ankommt, während die App läuft (nur Hülle) ------------------------------------------
//
// Im Browser macht das der Service Worker (web/sw.js): Er zeigt die Mitteilung und öffnet beim
// Antippen die richtige Seite. In der Hülle gibt es keinen Service Worker — dort meldet sich
// das Push-Plugin mit zwei Ereignissen, und ohne diese beiden Zeilen wäre ein Tipp auf eine
// Mitteilung nichts als ein Start der App auf der Startseite.
//
//   pushNotificationReceived         — die App ist offen: Ton und Vibration, sonst nichts
//   pushNotificationActionPerformed  — jemand hat die Mitteilung angetippt: auf die Seite gehen

let nativLauscher = null;

/**
 * Meldet die zwei Ereignisse an. Idempotent — die Rückrufe werden bei jedem Aufruf ersetzt,
 * die Anmeldung bei der Hülle bleibt bestehen. Im Browser passiert nichts.
 */
export function nativeMitteilungenBeobachten({ angekommen, geoeffnet } = {}) {
  if (!istNativerWeg()) return false;
  if (nativLauscher) { nativLauscher.angekommen = angekommen; nativLauscher.geoeffnet = geoeffnet; return true; }
  nativLauscher = { angekommen, geoeffnet };
  huelleLauscher('PushNotifications', 'pushNotificationReceived', (mitteilung) => {
    try { nativLauscher.angekommen?.(mitteilung || {}); } catch { /* nie die App aufhalten */ }
  });
  huelleLauscher('PushNotifications', 'pushNotificationActionPerformed', (ereignis) => {
    try { nativLauscher.geoeffnet?.(ereignis?.notification || {}); } catch { /* s. o. */ }
  });
  return true;
}
