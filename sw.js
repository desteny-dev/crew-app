// Service Worker — die App-Hülle liegt im Gerät.
//
// Zweck (Prüfschritt T3b): Wer die App vom Startbildschirm öffnet, soll nicht auf eine weiße
// Seite starren, wenn das Netz gerade schlecht ist. Die Hülle — Seite, Schriften, Programm —
// kommt dann aus dem Gerät. Die INHALTE kommen weiterhin nur vom Server; nichts von dem, was
// Freunde einander schreiben, wird hier zwischengelagert.
//
// Aktualisierung ohne Handarbeit: Jede neue Fassung bekommt eine neue VERSION. Der neue
// Worker übernimmt sofort (skipWaiting + clients.claim), löscht die alten Ablagen und
// meldet den Seiten, dass sie sich einmal neu laden dürfen.

const VERSION = 'crew-v22';
const HUELLE = `huelle-${VERSION}`;
// Runde 2: Ersatztext, falls ein Paket einmal ohne Inhalt kommt — in der Sprache des Geräts
// (der Worker kann die Module der App nicht laden; die echten Texte kommen vom Server).
const ERSATZ_TEXT = ({ en: 'New message', fr: 'Nouveau message', es: 'Mensaje nuevo' })[String(self.navigator?.language || '').slice(0, 2)] || 'Neue Nachricht';

// Was beim ersten Start sicher da sein muss. Alles Weitere (die einzelnen Module) legt sich
// beim ersten Besuch von selbst dazu — siehe unten.
const KERN = [
  './',
  './index.html',
  './styles.css',
  './fonts.css',
  './manifest.json',
  // Runde 6 (B3): Die Start-Fläche zeigt „crew." in Bricolage. Kämen die Schriften erst später,
  // stünde der Schriftzug beim ersten Start kurz in der Systemschrift und würde dann sichtbar
  // getauscht — genau das Zusammenruckeln, das nicht sein soll. Zusammen 107 KB, einmalig.
  './fonts/BricolageGrotesque-latin.woff2',
  './fonts/InstrumentSans-latin.woff2',
  './icons/icon-192.png',
  './icons/icon-512.png',
];

self.addEventListener('install', (event) => {
  event.waitUntil((async () => {
    const ablage = await caches.open(HUELLE);
    // Einzeln, damit ein fehlendes Stück nicht die ganze Einrichtung scheitern lässt.
    await Promise.all(KERN.map((pfad) => ablage.add(pfad).catch(() => {})));
    await self.skipWaiting();
  })());
});

self.addEventListener('activate', (event) => {
  event.waitUntil((async () => {
    const namen = await caches.keys();
    await Promise.all(namen.filter((n) => n !== HUELLE).map((n) => caches.delete(n)));
    await self.clients.claim();
  })());
});

// Nur eigene Dateien. Alles, was zu Supabase geht, läuft unberührt durch — Daten gehören
// nicht in eine Ablage auf dem Gerät.
function istEigen(url) {
  return url.origin === self.location.origin && url.pathname.startsWith(new URL('./', self.location).pathname);
}

self.addEventListener('fetch', (event) => {
  const anfrage = event.request;
  if (anfrage.method !== 'GET') return;
  const url = new URL(anfrage.url);
  if (!istEigen(url)) return;

  // Der Aufruf der Seite selbst: zuerst das Netz (damit Neues sofort kommt), sonst die Hülle.
  if (anfrage.mode === 'navigate') {
    event.respondWith((async () => {
      try {
        const frisch = await fetch(anfrage);
        const ablage = await caches.open(HUELLE);
        ablage.put('./index.html', frisch.clone()).catch(() => {});
        return frisch;
      } catch {
        const ablage = await caches.open(HUELLE);
        return (await ablage.match('./index.html')) || (await ablage.match('./')) || Response.error();
      }
    })());
    return;
  }

  // Programmteile, Schriften, Symbole: sofort aus der Ablage, im Hintergrund erneuern.
  event.respondWith((async () => {
    const ablage = await caches.open(HUELLE);
    const bekannt = await ablage.match(anfrage);
    const ausDemNetz = fetch(anfrage).then((antwort) => {
      if (antwort && antwort.status === 200 && antwort.type === 'basic') ablage.put(anfrage, antwort.clone()).catch(() => {});
      return antwort;
    }).catch(() => null);
    return bekannt || (await ausDemNetz) || Response.error();
  })());
});

// Die Seite kann fragen, welche Fassung gerade läuft (für den Nachweis und für Fehlerberichte).
self.addEventListener('message', (event) => {
  if (event.data === 'version') { event.source?.postMessage({ version: VERSION }); return; }
  // Auftrag R1 §8: „Öffnet man die Gruppe, verschwindet sie." Die App sagt beim Öffnen
  // eines Raumes Bescheid; hier fällt die zugehörige Mitteilung weg — auch dann, wenn sie
  // längst auf dem gesperrten Bildschirm steht und niemand sie angetippt hat.
  const daten = event.data;
  if (daten && daten.typ === 'mitteilung-schliessen' && daten.tag) {
    event.waitUntil((async () => {
      const offene = await self.registration.getNotifications({ tag: daten.tag });
      for (const mitteilung of offene) mitteilung.close();
    })());
  }
});

// --- Mitteilungen (Prüfschritt T4) ---------------------------------------------------------
// Der Browser weckt diesen Worker, wenn eine Mitteilung eintrifft — die App muss dafür nicht
// laufen. Angezeigt wird sie IMMER: Wer eine Push-Anmeldung mit userVisibleOnly hat und dann
// nichts zeigt, dem nimmt der Browser die Erlaubnis wieder weg. Steht ausnahmsweise kein
// lesbarer Inhalt im Paket, wird das auch so gesagt, statt etwas zu erfinden.
// Runde 5 (P5, G2): Jede Art fühlt sich anders an. Android spielt das Muster ab, iOS nicht (dort
// entscheidet das System) — das ist in Ordnung. Muster in ms: Brummen, Pause, Brummen …
//   nachricht   zwei kurze Stöße
//   anstupser   „klopf-klopf-klopf", kurz und verspielt
//   frei        lang, dann zwei kurze — jemand ist frei
//   anfrage     zwei ruhige Stöße und ein langer
//   meet        zwei mittlere Stöße (Einladung, Änderung)
const VIBRATION = {
  nachricht: [70, 50, 70],
  anstupser: [35, 45, 35, 45, 110],
  frei: [140, 70, 45, 60, 45],
  anfrage: [90, 90, 90, 90, 220],
  meet: [110, 60, 110],
  probe: [70, 50, 70],
};

// Die Art steht bevorzugt im Paket (`art`). Ältere Pakete tragen sie nur im Merkmal — die Tags
// kommen aus den Migrationen: 'raum-…' (0012/0019), 'stups-…' (0027), 'meet-…'.
function artVon(daten) {
  if (daten.art && VIBRATION[daten.art]) return daten.art;
  const tag = String(daten.tag || '');
  if (tag.startsWith('stups-')) return 'anstupser';
  if (tag.startsWith('frei-')) return 'frei';
  if (tag.startsWith('anfrage-') || tag.startsWith('freund-')) return 'anfrage';
  if (tag.startsWith('meet-')) return 'meet';
  return 'nachricht';
}

// G3d: „Mira ist frei" trägt die Aktion „Ich auch" — wo das Gerät Aktionen kann (Android,
// Desktop-Chrome). Der Worker kann die Übersetzungen der App nicht laden; deshalb wie oben
// in der Sprache des Geräts.
const ICH_AUCH = ({ en: 'Me too', fr: 'Moi aussi', es: 'Yo también' })[String(self.navigator?.language || '').slice(0, 2)] || 'Ich auch';
// Wohin „Ich auch" führt: Crew-Seite, die dort sofort frei setzt (crew.js liest `aktion=frei`).
const ICH_AUCH_ZIEL = './?route=crew.home&aktion=frei';

self.addEventListener('push', (event) => {
  let daten = {};
  try { daten = event.data ? event.data.json() : {}; } catch { daten = { body: event.data?.text?.() || '' }; }
  const titel = daten.title || 'Crew';
  const art = artVon(daten);
  const still = daten.renotify === false;
  const optionen = {
    body: daten.body || ERSATZ_TEXT,
    icon: './icons/icon-192.png',
    badge: './icons/badge-96.png',
    // Gleiches Tag = gleiche Mitteilung: Der zweite Satz aus demselben Raum ersetzt den
    // ersten, statt den Sperrbildschirm zuzustellen.
    tag: daten.tag || 'crew',
    // R1 §8: Die ERSTE Mitteilung eines Raumes macht auf sich aufmerksam. Jede
    // Fortschreibung („3 Personen haben geschrieben") schreibt dieselbe Mitteilung still
    // fort — sonst brummt ein Gespräch mit zehn Sätzen zehnmal.
    renotify: !still,
    silent: still,
    data: { url: daten.url || './', art },
  };
  // Nie beides: silent zusammen mit vibrate wirft laut Norm einen TypeError — die Mitteilung
  // käme dann gar nicht. Still heißt still.
  if (!still) optionen.vibrate = VIBRATION[art];
  if (art === 'frei') optionen.actions = [{ action: 'ich-auch', title: ICH_AUCH }];
  event.waitUntil(self.registration.showNotification(titel, optionen));
});

// Antippen führt genau dorthin, wovon die Mitteilung handelt — und in ein bereits offenes
// Fenster, statt ein zweites aufzumachen.
self.addEventListener('notificationclick', (event) => {
  event.notification.close();
  const adresse = event.action === 'ich-auch' ? ICH_AUCH_ZIEL : (event.notification.data?.url || './');
  // Runde 6 (Jonathan: „die benachrichtigungen anklicken führt zu einer schwarzen wand mit weißem code"):
  // Die Adressen vom Server beginnen mit „?route=…". Gegen `self.location` aufgelöst ergibt das
  // …/crew-app/sw.js?route=… — ein Tipp öffnete also den PROGRAMMTEXT des Workers statt der App.
  // Aufgelöst wird deshalb immer gegen den Ordner der App (den Geltungsbereich), nie gegen die
  // Datei des Workers. Das gilt auch für Mitteilungen, die vor dieser Fassung abgeschickt wurden.
  const wurzel = new URL('./', self.location);
  const ziel = new URL(adresse, wurzel).href;
  event.waitUntil((async () => {
    const fenster = await self.clients.matchAll({ type: 'window', includeUncontrolled: true });
    for (const fenst of fenster) {
      if (fenst.url.startsWith(new URL('./', self.location).href)) {
        await fenst.focus();
        if ('navigate' in fenst) await fenst.navigate(ziel).catch(() => {});
        return;
      }
    }
    await self.clients.openWindow(ziel);
  })());
});

// Der Push-Dienst darf eine Anmeldung austauschen. Dann erfährt es zuerst der Worker —
// er sagt der App Bescheid, die sie beim nächsten Start neu hinterlegt.
self.addEventListener('pushsubscriptionchange', (event) => {
  event.waitUntil((async () => {
    const fenster = await self.clients.matchAll({ type: 'window', includeUncontrolled: true });
    for (const fenst of fenster) fenst.postMessage({ typ: 'push-anmeldung-erneuern' });
  })());
});
