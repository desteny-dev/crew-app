// Runde 5 (P5, G2) — kurze, angenehme Töne, wenn in der offenen App etwas ankommt.
//
// Jonathan: „… mach Vibrationen und eventuell Sounds." Die Töne sind SYNTHETISIERT (Web Audio):
// keine Tondateien, nichts zu laden, nichts zu übersetzen. Jeder Klang besteht aus zwei bis drei
// weichen Sinus-Tropfen mit leisem Oberton — hörbar, aber nie schrill.
//
//   ton('nachricht')   zwei helle Tropfen, abwärts offen
//   ton('anstupser')   „klopf-klopf", tiefer und kürzer
//   ton('frei')        aufsteigender Dreiklang — jemand ist frei
//   ton('anfrage')     warme Quinte — Freundschaftsanfrage
//   ton('probe')       wie 'nachricht' (Vorhören beim Einschalten)
//
// Rückgabe und ton.letzte: { art, gespielt, grund, at, noten }
//   grund: '' | 'aus' (Schalter „Töne") | 'versteckt' (App im Hintergrund) | 'kein-audio'
//          | 'gesperrt' (noch keine Berührung — iOS) | 'zu-dicht' (eben erst ein Ton)
//
// iOS spielt Web Audio erst nach einer Berührung. tonFreischalten() hängt dafür EINEN leisen
// Lauscher an die Seite: Beim ersten Tipp (irgendwo) wird der Klangraum geöffnet und ein
// unhörbarer Puffer gespielt — danach dürfen ankommende Töne ohne Berührung klingen.
// navigator.audioSession 'ambient' (Safari): Die Töne unterbrechen keine Musik und schweigen,
// wenn das iPhone auf lautlos steht.
//
// Runde 6 (P3, A4) — „töne gehen noch nicht". Gemessen und entschieden:
//   · 'ambient' BLEIBT. Ein Ton gegen den Lautlos-Schalter des iPhones wäre übergriffig: Wer
//     stumm geschaltet hat, meint es so, und keine andere Nachrichten-App bricht das. Der Preis
//     ist, dass auf einem stummen iPhone nichts zu hören ist — dafür muss die Vibration sitzen
//     (siehe ui/haptik.js: das native Plugin war nie angemeldet).
//   · Es gab bisher keine Möglichkeit, den Ton überhaupt zu HÖREN: Die einzige Probe auf der
//     Mitteilungsseite verschickte eine System-Mitteilung und erschien nur, wenn Push schon an
//     war — auf dem iPhone in Safari also nie. tonProbe() ist die Probe ohne Bedingungen.
//   tonProbe(optionen) → Promise auf dasselbe Ergebnis wie ton(), aber:
//     öffnet den Klangraum zuerst (der Aufruf steckt in der Berührung des Knopfes), überspringt
//     den Mindestabstand und wartet, bis wirklich feststeht, ob es geklungen hat.
//   tonLage() → was dieses Gerät kann, ohne Schätzen.

const MIN_ABSTAND_MS = 350;
const LAUTSTAERKE = 0.16;

// [Frequenz Hz, Beginn s, Dauer s, Anteil]
const KLAENGE = {
  nachricht: [[1318.51, 0, 0.15, 0.9], [1760.0, 0.085, 0.24, 0.72]],
  anstupser: [[587.33, 0, 0.1, 1], [880.0, 0.11, 0.17, 0.9]],
  frei: [[1046.5, 0, 0.17, 0.62], [1318.51, 0.075, 0.17, 0.66], [1567.98, 0.15, 0.36, 0.8]],
  anfrage: [[783.99, 0, 0.22, 0.85], [1174.66, 0.13, 0.38, 0.8]],
};
KLAENGE.probe = KLAENGE.nachricht;

let kontext = null;
let lauscherDa = false;
let stillGespielt = false;
let letzterTon = 0;

export function toeneAn(einstellungen) {
  return einstellungen?.notifications?.toene !== false;
}

function kontextHolen() {
  if (kontext) return kontext;
  const Klasse = globalThis.AudioContext || globalThis.webkitAudioContext;
  if (!Klasse) return null;
  try {
    kontext = new Klasse({ latencyHint: 'interactive' });
  } catch {
    try { kontext = new Klasse(); } catch { kontext = null; }
  }
  return kontext;
}

function sitzungRuhig() {
  try {
    const sitzung = globalThis.navigator?.audioSession;
    if (sitzung && sitzung.type !== 'ambient') sitzung.type = 'ambient';
  } catch { /* ältere Browser kennen das nicht */ }
}

function entsperren() {
  const k = kontextHolen();
  if (!k) return;
  sitzungRuhig();
  if (k.state !== 'running') k.resume?.().catch(() => {});
  if (!stillGespielt) {
    try {
      const quelle = k.createBufferSource();
      quelle.buffer = k.createBuffer(1, 1, 22050);
      quelle.connect(k.destination);
      quelle.start(0);
      stillGespielt = true;
    } catch { /* dann beim nächsten Tipp */ }
  }
}

// Einmal je Seite. Die Lauscher bleiben bestehen: iOS unterbricht den Klangraum bei Anrufen
// oder im Hintergrund ('interrupted') — der nächste Tipp öffnet ihn wieder. Solange er läuft,
// kostet ein Tipp nur einen Vergleich.
// Bewusst am ENDE einer Berührung (touchend/pointerup/click), nie bei pointerdown: Das erste
// Anlegen des Klangraums kostet einen Moment, und bei pointerdown fiele er genau in den Beginn
// der Halte-/Drehgeste am FREE-Knopf (gemessen: ein Ring-Messpunkt kam 30° zu spät).
// Alle drei gelten in Safari und Chrome als Nutzer-Aktivierung.
export function tonFreischalten() {
  if (lauscherDa || typeof globalThis.addEventListener !== 'function') return;
  lauscherDa = true;
  // Die Klangart lässt sich ohne Berührung setzen — so steht schon vor dem ersten Ton fest,
  // dass Crew keine Musik unterbricht und den Lautlos-Schalter achtet (und tonLage() weiß es).
  sitzungRuhig();
  const optionen = { capture: true, passive: true };
  const beiBeruehrung = () => {
    if (kontext && kontext.state === 'running' && stillGespielt) return;
    entsperren();
  };
  for (const typ of ['touchend', 'pointerup', 'click', 'keydown']) {
    globalThis.addEventListener(typ, beiBeruehrung, optionen);
  }
}

function spielen(k, noten) {
  const start = k.currentTime + 0.01;
  const summe = k.createGain();
  summe.gain.value = LAUTSTAERKE;
  // Ein sanfter Tiefpass nimmt den Tropfen die Härte, ohne sie dumpf zu machen.
  const weich = k.createBiquadFilter();
  weich.type = 'lowpass';
  weich.frequency.value = 5200;
  summe.connect(weich);
  weich.connect(k.destination);
  let ende = start;
  for (const [frequenz, beginn, dauer, anteil] of noten) {
    const t0 = start + beginn;
    const t1 = t0 + dauer;
    const huelle = k.createGain();
    huelle.gain.setValueAtTime(0.0001, t0);
    huelle.gain.linearRampToValueAtTime(anteil, t0 + 0.008);
    huelle.gain.exponentialRampToValueAtTime(0.0001, t1);
    huelle.connect(summe);
    const grund = k.createOscillator();
    grund.type = 'sine';
    grund.frequency.value = frequenz;
    grund.frequency.setValueAtTime(frequenz, t0);
    grund.connect(huelle);
    // Leiser Oberton (Oktave): macht aus einem Piepen einen Tropfen.
    const oberton = k.createOscillator();
    const obertonPegel = k.createGain();
    oberton.type = 'sine';
    oberton.frequency.value = frequenz * 2;
    oberton.frequency.setValueAtTime(frequenz * 2, t0);
    obertonPegel.gain.value = 0.12;
    oberton.connect(obertonPegel);
    obertonPegel.connect(huelle);
    grund.start(t0);
    oberton.start(t0);
    grund.stop(t1 + 0.03);
    oberton.stop(t1 + 0.03);
    ende = Math.max(ende, t1);
  }
  return Math.round((ende - start) * 1000);
}

export function ton(art = 'nachricht', optionen = {}) {
  const noten = KLAENGE[art] || KLAENGE.nachricht;
  const melden = (gespielt, grund) => {
    ton.letzte = { art, gespielt, grund, at: Date.now(), noten: gespielt ? noten.length : 0 };
    return ton.letzte;
  };
  if (optionen.einstellungen && !toeneAn(optionen.einstellungen)) return melden(false, 'aus');
  if (globalThis.document?.visibilityState === 'hidden') return melden(false, 'versteckt');
  const k = kontextHolen();
  if (!k) return melden(false, 'kein-audio');
  const jetzt = Date.now();
  // `sofort` gilt nur für die Probe auf Knopfdruck: Wer zweimal „Ton testen" tippt, will
  // zweimal etwas hören. Ankommendes bleibt beim Mindestabstand.
  if (!optionen.sofort && jetzt - letzterTon < MIN_ABSTAND_MS) return melden(false, 'zu-dicht');
  if (k.state !== 'running') {
    // Direkt nach einer Berührung (Vorhören) läuft der Klangraum einen Augenblick später —
    // dann klingt es trotzdem. Ohne Berührung bleibt es still, und das ist richtig so.
    k.resume?.().then(() => {
      if (k.state !== 'running' || Date.now() - jetzt > 600) return;
      letzterTon = Date.now();
      spielen(k, noten);
      melden(true, 'nach-freischalten');
    }).catch(() => {});
    return melden(false, 'gesperrt');
  }
  letzterTon = jetzt;
  try {
    spielen(k, noten);
  } catch {
    return melden(false, 'kein-audio');
  }
  return melden(true, '');
}

// Die Probe auf Knopfdruck. MUSS synchron in der Berührung aufgerufen werden — entsperren()
// braucht sie, damit iOS den Klangraum öffnet. Gibt ein Versprechen auf das Ergebnis:
// Bleibt der Klangraum erst gesperrt, wird auf den Abschluss von resume() gewartet, statt
// vorschnell „ging nicht" zu melden.
export function tonProbe(art = 'probe', optionen = {}) {
  if (optionen.einstellungen && !toeneAn(optionen.einstellungen)) {
    return Promise.resolve(ton(art, optionen));   // meldet 'aus' — der Schalter gewinnt
  }
  entsperren();
  const erste = ton(art, { ...optionen, sofort: true });
  if (erste.gespielt || erste.grund !== 'gesperrt') return Promise.resolve(erste);
  // resume() ist unterwegs; ton() spielt beim Gelingen selbst nach und meldet 'nach-freischalten'.
  return new Promise((fertig) => {
    let versuche = 0;
    const schauen = () => {
      versuche += 1;
      if (ton.letzte?.gespielt || versuche > 12) { fertig(ton.letzte); return; }
      setTimeout(schauen, 50);
    };
    setTimeout(schauen, 50);
  });
}

// Was dieses Gerät beim Ton kann — aus den vorhandenen Schnittstellen, ohne Schätzen.
//   moeglich   Web Audio ist da
//   offen      der Klangraum läuft schon (nach der ersten Berührung)
//   ambient    navigator.audioSession steht auf 'ambient' (Safari) — der Lautlos-Schalter gilt
export function tonLage() {
  const Klasse = globalThis.AudioContext || globalThis.webkitAudioContext;
  const sitzung = globalThis.navigator?.audioSession;
  return {
    moeglich: Boolean(Klasse),
    offen: Boolean(kontext && kontext.state === 'running'),
    audioSession: Boolean(sitzung),
    ambient: sitzung ? sitzung.type === 'ambient' : false,
  };
}
