// Anmeldung des Service Workers — die App-Hülle im Gerät (Prüfschritt T3b).
//
// Bewusst NICHT im örtlichen Entwicklungsbetrieb: Dort würde eine Ablage im Gerät die
// Prüfläufe verfälschen, weil sie Dateien ausliefern könnte, die gerade geändert wurden.
// Angemeldet wird deshalb nur unter https (also dort, wo die App wirklich veröffentlicht
// ist) — oder wenn man es örtlich ausdrücklich mit ?sw=1 verlangt.

// Auftrag R1 §8: „Öffnet man die Gruppe, verschwindet sie."
//
// Zwei Wege, weil beide nötig sind: Läuft ein Service Worker, kennt NUR er die Mitteilungen,
// die schon auf dem gesperrten Bildschirm stehen — ihm wird Bescheid gesagt. Läuft keiner
// (örtlicher Betrieb, native Hülle), schließt die Seite, was sie selbst kennt. Fehlt beides,
// passiert nichts — und nichts geht kaputt.
export function schliesseMitteilung(tag) {
  if (!tag) return;
  try {
    // Ohne einen laufenden Worker gäbe es nichts zu schließen — und `ready` käme nie
    // zurück, was bei jedem Rendern ein hängendes Versprechen mehr hinterließe.
    if ('serviceWorker' in navigator && navigator.serviceWorker.controller) {
      navigator.serviceWorker.ready
        .then((registrierung) => {
          registrierung.active?.postMessage({ typ: 'mitteilung-schliessen', tag });
          return registrierung.getNotifications?.({ tag });
        })
        .then((offene) => (offene || []).forEach((m) => m.close()))
        .catch(() => {});
    }
  } catch { /* ohne Mitteilungen gibt es nichts zu schließen */ }
}

// Der Merkname einer Raum-Mitteilung. Er entsteht in der Datenbank (Migration 0012) aus der
// Kennung des Raumes auf dem Server — die App kennt sie erst, wenn sie den Raum wirklich hat.
export function raumMitteilungsTag(serverRaumId) {
  return serverRaumId ? `raum-${serverRaumId}` : null;
}

export function registriereServiceWorker() {
  if (!('serviceWorker' in navigator)) return;

  // In der nativen Hülle (Capacitor) NICHT. Dort liegen alle Dateien ohnehin im Gerät —
  // eine zweite Ablage darüber brächte nichts und richtete Schaden an: Die Hülle meldet
  // sich unter https://localhost, also unter derselben Herkunft wie beim letzten Mal. Ein
  // alter Service Worker überlebte damit das Aktualisieren der App und lieferte weiter den
  // Stand von gestern aus. Genau das war zu sehen, nachdem die Hülle neu gebaut war.
  if (globalThis.Capacitor) {
    navigator.serviceWorker.getRegistrations?.()
      .then((alle) => alle.forEach((r) => r.unregister()))
      .catch(() => {});
    return;
  }

  const ausdruecklich = new URLSearchParams(globalThis.location?.search || '').has('sw');
  const veroeffentlicht = globalThis.location?.protocol === 'https:';
  if (!veroeffentlicht && !ausdruecklich) return;

  globalThis.addEventListener('load', () => {
    navigator.serviceWorker.register('./sw.js').catch((fehler) => {
      console.warn('[Crew] Service Worker nicht angemeldet:', fehler?.message || fehler);
    });
  });

  // Neue Fassung übernimmt: einmal neu laden, damit niemand mit halb altem Stand arbeitet.
  // Nur, wenn vorher schon einer lief — beim allerersten Besuch wäre ein Neuladen sinnlos.
  let hatteSchonEinen = Boolean(navigator.serviceWorker.controller);
  navigator.serviceWorker.addEventListener('controllerchange', () => {
    if (!hatteSchonEinen) { hatteSchonEinen = true; return; }
    globalThis.location.reload();
  });
}
