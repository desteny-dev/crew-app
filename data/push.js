// Push-Mitteilungen (Prüfschritt T4) — die Seite des Geräts.
//
// Was hier passiert, in einem Satz: Das Gerät meldet sich beim Push-Dienst seines Browsers
// an und hinterlegt die dabei entstandene Adresse auf dem Server. Mehr braucht es nicht —
// der Server schickt später an diese Adresse, der Browser weckt den Service Worker, und der
// zeigt die Mitteilung. Die App muss dafür nicht laufen.
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

function hatMitteilungen() {
  return typeof globalThis.Notification === 'function' || typeof globalThis.Notification === 'object';
}

function erlaubnisJetzt() {
  return hatMitteilungen() ? globalThis.Notification.permission : 'default';
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
export async function pushZustand() {
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
  if (!client || !kannPush()) return;
  if (erlaubnisJetzt() !== 'granted') return;
  try {
    const registrierung = await mitFrist(globalThis.navigator.serviceWorker.ready, SW_FRIST_MS);
    const anmeldung = await mitFrist(registrierung?.pushManager?.getSubscription?.(), SW_FRIST_MS);
    if (anmeldung) await anmeldungHinterlegen(client, anmeldung);
  } catch { /* ohne Anmeldung gibt es nichts abzugleichen */ }
}
