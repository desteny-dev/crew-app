// Runde 3 (D4, Jonathan: „Funktioniert die Kamera zum QR-Scannen wirklich?"): Bis hier war das
// Kamerafeld nur eine Fläche mit Sucherecken — gescannt hat nichts. Jetzt echt:
//
//   getUserMedia (Rückkamera) → Video im Kamerafeld → Erkennung etwa 8× pro Sekunde:
//     1. BarcodeDetector, wo der Browser ihn hat (Chrome/Android, Android-WebView),
//     2. sonst jsQR (web/vendor/jsqr.js, Apache-2.0) — erst geladen, wenn wirklich gescannt wird
//        (iPhone-Safari und iOS-WebView kennen keinen BarcodeDetector).
//
// Eine Oberfläche für Web-App UND native App: Die Capacitor-WebView reicht die Kamerafrage an
// Android (CAMERA im Manifest) bzw. iOS (NSCameraUsageDescription) weiter. Gefragt wird erst
// im Moment des Scannens. Kein Bild verlässt das Gerät.

const VENDOR_JSQR = new URL('../vendor/jsqr.js', import.meta.url).href;
let jsqrLaden = null;

function ladeJsqr() {
  if (globalThis.jsQR) return Promise.resolve(globalThis.jsQR);
  if (jsqrLaden) return jsqrLaden;
  jsqrLaden = new Promise((fertig, fehler) => {
    const skript = document.createElement('script');
    skript.src = VENDOR_JSQR;
    skript.onload = () => (globalThis.jsQR ? fertig(globalThis.jsQR) : fehler(new Error('jsQR fehlt')));
    skript.onerror = () => { jsqrLaden = null; fehler(new Error('jsQR nicht ladbar')); };
    document.head.appendChild(skript);
  });
  return jsqrLaden;
}

export function kannScannen() {
  return Boolean(globalThis.navigator?.mediaDevices?.getUserMedia);
}

// Einladungscode aus dem gescannten Text: Crew-Link (…?einladung=CODE) oder der Code selbst.
export function einladungsCodeAus(text) {
  const roh = String(text || '').trim();
  if (!roh) return null;
  try {
    const adresse = new URL(roh);
    const code = adresse.searchParams.get('einladung') || adresse.searchParams.get('invite');
    return code ? code.trim() : null;
  } catch {
    return /^[A-Za-z0-9-]{4,24}$/.test(roh) ? roh : null;
  }
}

async function erkennerBauen() {
  const Detector = globalThis.BarcodeDetector;
  if (Detector) {
    try {
      const formate = Detector.getSupportedFormats ? await Detector.getSupportedFormats() : ['qr_code'];
      if (formate.includes('qr_code')) {
        const detector = new Detector({ formats: ['qr_code'] });
        return async (video) => {
          const funde = await detector.detect(video);
          return funde[0]?.rawValue || null;
        };
      }
    } catch { /* weiter mit jsQR */ }
  }
  const jsQR = await ladeJsqr();
  const leinwand = document.createElement('canvas');
  const zeichner = leinwand.getContext('2d', { willReadFrequently: true });
  return async (video) => {
    const breite = video.videoWidth;
    const hoehe = video.videoHeight;
    if (!breite || !hoehe) return null;
    // Auf höchstens 480 px verkleinert: schnell genug fürs Handy, groß genug für einen QR-Code.
    const massstab = Math.min(1, 480 / Math.max(breite, hoehe));
    leinwand.width = Math.round(breite * massstab);
    leinwand.height = Math.round(hoehe * massstab);
    zeichner.drawImage(video, 0, 0, leinwand.width, leinwand.height);
    const bild = zeichner.getImageData(0, 0, leinwand.width, leinwand.height);
    return jsQR(bild.data, bild.width, bild.height, { inversionAttempts: 'dontInvert' })?.data || null;
  };
}

// Startet die Kamera in `ziel` (ein Element mit fester Größe; das Video füllt es).
//   onText(text)    → jeder erkannte QR-Inhalt (einmal je neuem Inhalt)
//   onFehler(grund) → 'verweigert' | 'keine-kamera' | 'nicht-moeglich' | 'unbekannt'
// Gibt stop() zurück — IMMER aufrufen, wenn das Feld verschwindet (sonst bleibt die Kamera an).
export function starteQrScan(ziel, { onText, onFehler } = {}) {
  let aus = false;
  let strom = null;
  let uhr = null;
  let zuletzt = '';
  const video = document.createElement('video');
  video.setAttribute('playsinline', '');
  video.setAttribute('muted', '');
  video.muted = true;
  video.setAttribute('aria-hidden', 'true');
  video.style.cssText = 'position:absolute;inset:0;width:100%;height:100%;object-fit:cover;border-radius:inherit;background:#000';

  const stop = () => {
    aus = true;
    clearTimeout(uhr);
    for (const spur of strom?.getTracks?.() || []) spur.stop();
    strom = null;
    video.remove();
  };

  if (!kannScannen()) {
    queueMicrotask(() => onFehler?.('nicht-moeglich'));
    return stop;
  }

  (async () => {
    try {
      strom = await navigator.mediaDevices.getUserMedia({ video: { facingMode: { ideal: 'environment' } }, audio: false });
      if (aus) { stop(); return; }
      video.srcObject = strom;
      ziel.appendChild(video);
      // Nicht auf play() warten: Das Versprechen löst manche WebView erst mit dem ersten Bild
      // ein — oder nie. Die Erkennung fragt ohnehin nur, wenn ein Bild da ist (readyState).
      video.play().catch(() => {});
      const erkenne = await erkennerBauen();
      const runde = async () => {
        if (aus) return;
        try {
          const text = video.readyState >= 2 ? await erkenne(video) : null;
          if (text && text !== zuletzt) {
            zuletzt = text;
            onText?.(text);
          }
        } catch { /* ein Bild ging nicht — das nächste */ }
        if (!aus) uhr = setTimeout(runde, 125);
      };
      runde();
    } catch (fehler) {
      const name = fehler?.name || '';
      const grund = name === 'NotAllowedError' || name === 'SecurityError' ? 'verweigert'
        : name === 'NotFoundError' || name === 'OverconstrainedError' ? 'keine-kamera'
          : 'unbekannt';
      stop();
      onFehler?.(grund);
    }
  })();

  return stop;
}
