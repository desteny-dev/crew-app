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
//
// =====================================================================================
// Runde 8 (R8-38, Jonathan: „Kamera: bei manchen schwarz — Ursache prüfen, beheben oder ehrlich
// melden")
// -------------------------------------------------------------------------------------
// Ein schwarzes Feld hatte hier drei Wege, und KEINER davon sagte ein Wort — die Fläche blieb
// einfach schwarz (der Videogrund ist #000), bis man das Blatt schloss:
//
//   1. play() wurde abgewiesen. iOS lässt ein Video im Stromsparmodus nicht von selbst laufen —
//      auch stumm nicht —, und manche WebView weist play() ab, wenn es nicht direkt aus einem
//      Tipp kommt. Der Fehler wurde mit `.catch(() => {})` verschluckt. Jetzt: das Feld sagt
//      „Tippen, um die Kamera zu starten", und DIESER Tipp ruft play() direkt im Tipp auf
//      (stop.antippen) — dort, wo jeder Browser es erlaubt.
//   2. Die „Rückkamera" liefert kein Bild. Handys mit mehreren Linsen melden mehrere Kameras mit
//      facingMode „environment"; auf manchen ist die, die der Browser dafür nimmt, eine Tiefen-,
//      Tele- oder Infrarot-Linse, deren Bilder schwarz bleiben. Jetzt: nach dem Start wird das Bild
//      laufend geprüft, bis ein echtes Bild da ist. Bleibt es 1,4 s lang rabenschwarz — nicht nur
//      dunkel: jeder Bildpunkt fast 0, wie ihn ein echter Sensor nicht einmal im dunklen Zimmer
//      liefert — oder kommt nach 6 s noch gar kein Bild (manche Kamera braucht lange, deshalb so
//      großzügig), geht es mit der nächsten Kamera weiter. Hilft keine, sagt das Feld
//      ehrlich „Die Kamera zeigt kein Bild"; der Code darunter geht immer.
//   3. Die Kamera ist belegt (NotReadableError — eine andere App hält sie). Das hieß bisher
//      „startet gerade nicht". Jetzt steht da, was los ist.
// Dazu: Das Video steht im Dokument, BEVOR es seinen Strom bekommt, und trägt autoplay,
// playsinline und muted als Merkmal UND als Eigenschaft (ältere iOS lesen nur das eine oder das
// andere). Fällt die Kamera mitten im Scannen weg (Spur „ended"), meldet sich das Feld.
//
// Was hier NICHT geprüft werden kann, offen gesagt: ein Bild, das die Kamera richtig liefert, das
// aber der Bildschirm schwarz ZEICHNET (ein Fehler im Grafiktreiber mancher Geräte). Das Bild
// selbst ist dann in Ordnung — der Test auf Schwärze liest es ja —, nur die Anzeige nicht. Das
// ist ohne das betroffene Gerät nicht nachzustellen.
//
//   starteQrScan(ziel, { onText, onFehler, onZustand }) → stop
//     onText(text)       jeder erkannte QR-Inhalt (einmal je neuem Inhalt)
//     onFehler(grund)    Kamera aus: 'verweigert' | 'keine-kamera' | 'nicht-moeglich' | 'belegt' |
//                        'schwarz' | 'unbekannt'
//     onZustand(zustand) Kamera läuft weiter: 'antippen' (das Bild wartet auf einen Tipp) |
//                        'laeuft' (das Bild läuft)
//     stop()             IMMER aufrufen, wenn das Feld verschwindet (sonst bleibt die Kamera an)
//     stop.antippen()    im Tipp aufrufen, solange 'antippen' gilt → Promise<boolean>

const VENDOR_JSQR = new URL('../vendor/jsqr.js', import.meta.url).href;
let jsqrLaden = null;

// Wie lange ein Bild rabenschwarz sein muss, bevor die nächste Kamera drankommt, wie lange auf ein
// erstes Bild gewartet wird — und ab wann ein Bildpunkt als „nicht schwarz" zählt (0…255). Ein
// echter Sensor rauscht auch im Dunkeln über diesen Wert.
export const SCHWARZ_DAUER_MS = 1400;
export const KEIN_BILD_MS = 6000;
const SCHWARZ_GRENZE = 8;

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

// Welcher Grund steckt hinter einem Fehler von getUserMedia?
export function kameraGrund(fehler) {
  const name = fehler?.name || '';
  if (name === 'NotAllowedError' || name === 'SecurityError' || name === 'PermissionDeniedError') return 'verweigert';
  if (name === 'NotFoundError' || name === 'OverconstrainedError' || name === 'DevicesNotFoundError') return 'keine-kamera';
  if (name === 'NotReadableError' || name === 'TrackStartError') return 'belegt';
  return 'unbekannt';
}

// Ist das Bild rabenschwarz? null = es gibt noch gar kein Bild.
function bildSchwarz(video, probe) {
  if (!video.videoWidth || !video.videoHeight || video.readyState < 2) return null;
  try {
    probe.zeichner.drawImage(video, 0, 0, probe.leinwand.width, probe.leinwand.height);
    const punkte = probe.zeichner.getImageData(0, 0, probe.leinwand.width, probe.leinwand.height).data;
    for (let i = 0; i < punkte.length; i += 4) {
      if (punkte[i] > SCHWARZ_GRENZE || punkte[i + 1] > SCHWARZ_GRENZE || punkte[i + 2] > SCHWARZ_GRENZE) return false;
    }
    return true;
  } catch {
    return false; // nicht lesbar heißt nicht schwarz — im Zweifel läuft das Bild weiter
  }
}

// Rückkameras zuerst: Wörter, mit denen Geräte ihre Linsen benennen. Tiefen-, Infrarot- und
// Telelinsen hinten an.
function kameraRang(geraet) {
  const name = String(geraet?.label || '').toLowerCase();
  let rang = 0;
  if (/back|rear|environment|rück|hinten|arrière|trasera/.test(name)) rang -= 2;
  if (/front|user|facetime|vorder|avant|frontal/.test(name)) rang += 2;
  if (/depth|tiefe|infrared|\bir\b|tele/.test(name)) rang += 4;
  return rang;
}

// Startet die Kamera in `ziel` (ein Element mit fester Größe; das Video füllt es).
export function starteQrScan(ziel, { onText, onFehler, onZustand } = {}) {
  let aus = false;
  let strom = null;
  let uhr = null;
  let wachen = [];
  let zuletzt = '';
  let erkenne = null;
  let blockiert = false;
  const schwarzeKameras = new Set();
  const video = document.createElement('video');
  for (const merkmal of ['playsinline', 'webkit-playsinline', 'muted', 'autoplay']) video.setAttribute(merkmal, '');
  video.muted = true;
  video.playsInline = true;
  video.autoplay = true;
  video.setAttribute('aria-hidden', 'true');
  video.setAttribute('data-role', 'kamera-bild');
  video.style.cssText = 'position:absolute;inset:0;width:100%;height:100%;object-fit:cover;border-radius:inherit;background:#000';
  const probe = { leinwand: document.createElement('canvas') };
  probe.leinwand.width = 16;
  probe.leinwand.height = 16;
  probe.zeichner = probe.leinwand.getContext('2d', { willReadFrequently: true });

  const wachenLoeschen = () => { wachen.forEach(clearTimeout); wachen = []; };
  const spurenAus = () => {
    for (const spur of strom?.getTracks?.() || []) spur.stop();
    strom = null;
  };
  const stop = () => {
    aus = true;
    clearTimeout(uhr);
    wachenLoeschen();
    spurenAus();
    try { video.srcObject = null; } catch { /* egal */ }
    video.remove();
  };
  const scheitern = (grund) => {
    if (aus) return;
    stop();
    onFehler?.(grund);
  };

  // play() im Tipp: dort erlaubt es jeder Browser. (Ganz alte Browser geben kein Versprechen zurück.)
  const abspielen = () => {
    let versprechen;
    try { versprechen = video.play(); } catch (fehler) { versprechen = Promise.reject(fehler); }
    return Promise.resolve(versprechen).then(() => {
    if (aus) return false;
    const warBlockiert = blockiert;
    blockiert = false;
    if (warBlockiert) { onZustand?.('laeuft'); wacheStellen(); }
    return true;
  }, (fehler) => {
    if (aus) return false;
    // AbortError: ein neuer Strom kam dazwischen — der bringt sein eigenes play() mit.
    if (fehler?.name === 'AbortError') return false;
    // Manche Browser weisen das Versprechen ab und spielen trotzdem (autoplay) — dann läuft es.
    if (!video.paused) return true;
    if (!blockiert) { blockiert = true; wachenLoeschen(); onZustand?.('antippen'); }
    return false;
    });
  };
  stop.antippen = () => (aus ? Promise.resolve(false) : abspielen());

  if (!kannScannen()) {
    queueMicrotask(() => onFehler?.('nicht-moeglich'));
    return stop;
  }

  // Ein Strom öffnen — zuerst „die Rückkamera", danach gezielt ein bestimmtes Gerät.
  const oeffnen = (geraet) => navigator.mediaDevices.getUserMedia({
    audio: false,
    video: geraet
      ? { deviceId: { exact: geraet }, width: { ideal: 1280 }, height: { ideal: 720 } }
      : { facingMode: { ideal: 'environment' }, width: { ideal: 1280 }, height: { ideal: 720 } },
  });

  const geraetVon = (s) => {
    try { return s?.getVideoTracks?.()[0]?.getSettings?.().deviceId || ''; } catch { return ''; }
  };

  const anschliessen = (neu) => {
    strom = neu;
    for (const spur of neu.getVideoTracks?.() || []) {
      spur.addEventListener?.('ended', () => { if (!aus && strom === neu) scheitern('unbekannt'); });
    }
    video.srcObject = neu;
    abspielen();
    wacheStellen();
  };

  // Die nächste Kamera, die noch nicht schwarz war — Rückkameras zuerst.
  const naechsteKamera = async () => {
    let geraete = [];
    try { geraete = (await navigator.mediaDevices.enumerateDevices?.()) || []; } catch { geraete = []; }
    return geraete
      .filter((g) => g.kind === 'videoinput' && g.deviceId && !schwarzeKameras.has(g.deviceId))
      .sort((a, b) => kameraRang(a) - kameraRang(b))[0]?.deviceId || '';
  };

  const schwarzBehandeln = async () => {
    if (aus || blockiert) return;
    schwarzeKameras.add(geraetVon(strom) || `unbekannt-${schwarzeKameras.size}`);
    const weiter = await naechsteKamera();
    if (aus) return;
    if (!weiter) { scheitern('schwarz'); return; }
    spurenAus();
    try {
      const neu = await oeffnen(weiter);
      if (aus) { for (const spur of neu.getTracks()) spur.stop(); return; }
      anschliessen(neu);
    } catch (fehler) {
      schwarzeKameras.add(weiter);
      scheitern(kameraGrund(fehler) === 'belegt' ? 'belegt' : 'schwarz');
    }
  };

  // Hinsehen, bis ein echtes Bild da ist. Ein einzelnes schwarzes Bild reicht nicht — die erste
  // Belichtung ist oft kurz dunkel —, erst SCHWARZ_DAUER_MS am Stück. Ist einmal ein echtes Bild
  // da, ist die Kamera in Ordnung und es wird nicht mehr nachgesehen.
  function wacheStellen() {
    wachenLoeschen();
    const beginn = Date.now();
    let schwarzSeit = 0;
    const pruefen = () => {
      if (aus || blockiert) return;
      const schwarz = bildSchwarz(video, probe);
      if (schwarz === false) { onZustand?.('laeuft'); return; }
      const jetzt = Date.now();
      if (schwarz === true) {
        if (!schwarzSeit) schwarzSeit = jetzt;
        if (jetzt - schwarzSeit >= SCHWARZ_DAUER_MS) { schwarzBehandeln(); return; }
      } else {
        schwarzSeit = 0;
      }
      if (jetzt - beginn >= KEIN_BILD_MS) { schwarzBehandeln(); return; }
      wachen.push(setTimeout(pruefen, 400));
    };
    wachen.push(setTimeout(pruefen, 800));
  }

  (async () => {
    try {
      // Das Video steht im Dokument, BEVOR es seinen Strom bekommt (iOS zeichnet sonst manchmal
      // nur Schwarz).
      ziel.appendChild(video);
      const neu = await oeffnen('');
      if (aus) { for (const spur of neu.getTracks()) spur.stop(); return; }
      anschliessen(neu);
      erkenne = await erkennerBauen();
      const runde = async () => {
        if (aus) return;
        try {
          const text = !blockiert && video.readyState >= 2 ? await erkenne(video) : null;
          if (text && text !== zuletzt) {
            zuletzt = text;
            onText?.(text);
          }
        } catch { /* ein Bild ging nicht — das nächste */ }
        if (!aus) uhr = setTimeout(runde, 125);
      };
      runde();
    } catch (fehler) {
      scheitern(kameraGrund(fehler));
    }
  })();

  return stop;
}
