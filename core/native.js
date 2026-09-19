// Crew — die EINE Brücke zur nativen Hülle (Capacitor). Chef, Runde 6.
//
// WARUM ES DIESE DATEI GIBT
// -------------------------------------------------------------------------------------------
// Crew ist EIN Code: derselbe Ordner web/ läuft im Browser, als installierte Web-App und —
// in eine Capacitor-Hülle gepackt — als iPhone- und Android-App. Das ist der richtige Weg und
// bleibt so. Aber: manches kann nur die native App (Vibration auf dem iPhone, Standort bei
// geschlossener App, Kamera ohne Umweg, Mitteilungen ohne Installationstrick). Bisher hat sich
// jede Datei ihre Brücke selbst gebaut (ui/haptik.js, ui/profilbild-baukasten.js,
// ui/qr-scanner.js) — dreimal dieselbe Arbeit, und die vierte Funktion vergisst die Hülle.
//
// Hier steht sie einmal, und dazu eine EHRLICHE Tabelle: Was kann dieses Gerät wirklich?
// Nichts wird geraten. Wer eine Funktion baut, fragt kann('…') und bekommt drei mögliche
// Antworten: 'nativ' (die Hülle kann es), 'web' (der Browser kann es) oder 'nein' — mit Grund.
// „Nein" ist eine gültige Antwort: dann sagt die Oberfläche es dem Nutzer, statt so zu tun.
//
// WIE DAS PLUGIN ÜBERHAUPT ERREICHBAR WIRD (gemessen von P3 in Runde 6)
// -------------------------------------------------------------------------------------------
// `Capacitor.Plugins.X` füllt nur registerPlugin() aus @capacitor/core. Crew hat keinen Bündler
// und lädt @capacitor/core nirgends — in der Hülle liegt allein native-bridge.js im Fenster, und
// die legt `Plugins` nie an. Deshalb melden wir das Plugin selbst an: Die Hülle schickt
// `Capacitor.PluginHeaders` mit (iOS JSExport.swift, Android JSExport.java); daraus bauen wir den
// Zugang aus genau den Methoden, die die Hülle wirklich kennt — jede über `Capacitor.nativePromise`.
// Steht ein Plugin nicht in den Headern, ist es nicht eingebaut, und wir geben null zurück.
//
// STAND (Runde 7, 17.09.2026) — eingebaut sind: @capacitor/haptics, @capacitor/camera,
// @capacitor/geolocation, @capacitor/push-notifications, @capacitor/share. Dazu zwei eigene
// kleine Brücken im nativen Projekt: `CrewStandort` (Standort über EREIGNISSE, während die App
// zu ist — siehe NATIVE.md §3b) und `CrewWidget` (schreibt den Widget-Stand dorthin, wo ein
// Widget ihn lesen darf).
//
// Was das ändert: In der Hülle antwortet `kann()` jetzt bei fünf von sechs Fähigkeiten 'nativ'
// statt 'web'. Im Browser ändert sich NICHTS — dieselben Rückfälle wie vorher, dieselben
// ehrlichen Neins. Was hier steht, ist gemessen, nicht gehofft: Die Tabelle kennt nur Plugins,
// die die Hülle in ihren PluginHeaders wirklich nennt. Ist ein Plugin im nativen Projekt nicht
// gebaut (alte Fassung der App, abgelehnte Erlaubnis am Gerät), fällt die Fähigkeit von selbst
// auf den Browser-Weg zurück — ohne dass hier etwas nachgezogen werden muss.

const PLUGIN_ZWISCHENSPEICHER = new Map();
let ZWISCHENSPEICHER_HUELLE = null;

function cap() {
  return globalThis.Capacitor || null;
}

/** Läuft die App in der nativen Hülle (iPhone-/Android-App)? */
export function istHuelle() {
  const c = cap();
  if (!c) return false;
  if (typeof c.isNativePlatform === 'function') { try { return Boolean(c.isNativePlatform()); } catch { /* weiter unten */ } }
  return typeof c.nativePromise === 'function';
}

/** 'ios' | 'android' | 'web' — was die Hülle selbst sagt, nicht was der Kennungstext vermuten lässt. */
export function plattform() {
  const c = cap();
  const roh = typeof c?.getPlatform === 'function' ? c.getPlatform() : c?.platform;
  if (roh === 'ios' || roh === 'android') return roh;
  return istHuelle() ? 'huelle' : 'web';
}

/**
 * Das native Plugin `name`, wenn die Hülle es mitbringt — sonst null.
 * `methoden` grenzt ein, was gebraucht wird; fehlt eine davon in den Headern, bleibt sie weg.
 */
export function huellePlugin(name, methoden = null) {
  // Gemerkt wird nur, was WIRKLICH da ist. Ein „nicht da" wird jedes Mal neu geprüft: Die Hülle
  // schiebt ihre PluginHeaders nach, und in Prüfläufen wechselt sie. Gemessen (P3s Kamera-Suite):
  // Mit gemerktem „nicht da" blieb das Camera-Plugin auch dann weg, als die Hülle es mitbrachte.
  // Die Prüfung selbst ist billig — eine Suche in einer Liste mit wenigen Einträgen.
  const c = cap();
  if (ZWISCHENSPEICHER_HUELLE !== c) { PLUGIN_ZWISCHENSPEICHER.clear(); ZWISCHENSPEICHER_HUELLE = c; }
  const gemerkt = PLUGIN_ZWISCHENSPEICHER.get(name);
  if (gemerkt) return gemerkt;
  let zugang = null;
  try {
    if (!c || typeof c.nativePromise !== 'function') { zugang = null; }
    else if (c.Plugins?.[name]) { zugang = c.Plugins[name]; }
    else {
      const kopf = c.PluginHeaders?.find?.((eintrag) => eintrag?.name === name);
      const namen = (kopf?.methods || []).map((m) => m?.name)
        .filter((m) => typeof m === 'string' && (!methoden || methoden.includes(m)));
      if (namen.length) {
        const plugin = {};
        for (const m of namen) plugin[m] = (optionen) => c.nativePromise(name, m, optionen || {});
        c.Plugins = c.Plugins || {};
        c.Plugins[name] = plugin;
        zugang = plugin;
      }
    }
  } catch {
    zugang = null;   // eine kaputte Hülle darf die App nie aufhalten
  }
  if (zugang) PLUGIN_ZWISCHENSPEICHER.set(name, zugang);
  return zugang;
}

/** Bringt die Hülle dieses Plugin mit? `name` darf auch eine Liste von Namen sein (erster Treffer). */
export function hatPlugin(name) {
  return Boolean(erstesPlugin(name));
}

/**
 * Der erste Zugang aus einer Liste möglicher Namen — für Fähigkeiten, die mehr als ein Plugin
 * bedienen kann. Beispiel Hintergrund-Standort: unsere eigene Brücke `CrewStandort` ist der
 * gewollte Weg (Ereignisse statt Takt), ein fremdes `BackgroundGeolocation` wäre auch gültig.
 *
 * Runde 7, dritte Welle: NICHT mehr ausgeführt. Niemand außerhalb dieser Datei hat sie je
 * gerufen — wer eine Fähigkeit braucht, nimmt `faehigkeitPlugin()` und muss die Plugin-Namen
 * gar nicht kennen. Ein Ausgang ohne Aufrufer ist eine Zusage ohne Funktion (Hausregel 9).
 */
function erstesPlugin(namen, methoden = null) {
  for (const name of Array.isArray(namen) ? namen : [namen]) {
    const zugang = huellePlugin(name, methoden);
    if (zugang) return zugang;
  }
  return null;
}

/** Für Prüfungen und für den Neustart nach einer nachgebildeten Hülle. */
export function huelleVergessen() {
  PLUGIN_ZWISCHENSPEICHER.clear();
  ZWISCHENSPEICHER_HUELLE = null;
}

// --- Die ehrliche Tabelle -----------------------------------------------------------------------
//
// Jede Fähigkeit beantwortet zwei Fragen: Kann die HÜLLE das (Plugin da)? Kann der BROWSER das?
// Ergebnis: { wie: 'nativ' | 'web' | 'nein', warum: '…' }. `warum` ist für uns und für die
// Diagnose im Profil — kein Text für die Oberfläche (der gehört übersetzt in den Screen).

const WEB = {
  vibration: () => typeof globalThis.navigator?.vibrate === 'function',
  kamera: () => typeof globalThis.navigator?.mediaDevices?.getUserMedia === 'function',
  standort: () => Boolean(globalThis.navigator?.geolocation),
  standortHintergrund: () => false,     // kein Browser kann das, auch keine installierte Web-App
  mitteilungen: () => typeof globalThis.Notification === 'function' && 'serviceWorker' in (globalThis.navigator || {}),
  teilen: () => typeof globalThis.navigator?.share === 'function',
};

const FAEHIGKEITEN = {
  vibration: { plugin: 'Haptics', web: WEB.vibration, ohne: 'WebKit (iPhone) kennt navigator.vibrate nicht — fühlbar wird es nur in der App' },
  kamera: { plugin: 'Camera', web: WEB.kamera, ohne: 'Kamera braucht https und eine Berührung; ohne getUserMedia bleibt nur das Auswählen einer Datei' },
  standort: { plugin: 'Geolocation', web: WEB.standort, ohne: 'Gerät oder Browser gibt keinen Standort her' },
  // Zwei gültige Wege, unsere eigene Brücke zuerst: `CrewStandort` meldet sich bei EREIGNISSEN
  // (iPhone: große Ortswechsel und Besuche · Android: sparsame Standortmeldungen). Ein fremdes
  // `BackgroundGeolocation` bliebe gültig, kostet aber Dauermessung und eine feste Mitteilung —
  // deshalb ist es nicht eingebaut, sondern nur anerkannt. Begründung: NATIVE.md §3b.
  'standort-hintergrund': { plugin: ['CrewStandort', 'BackgroundGeolocation'], web: WEB.standortHintergrund, ohne: 'Im Web läuft nichts, während die App zu ist — dort zeigt die Karte „vor x Min"' },
  mitteilungen: { plugin: 'PushNotifications', web: WEB.mitteilungen, ohne: 'Auf dem iPhone nur, wenn die Web-App auf dem Startbildschirm liegt (iOS 16.4+)' },
  teilen: { plugin: 'Share', web: WEB.teilen, ohne: 'Kein Teilen-Blatt im Browser — dann Adresse kopieren' },
};

const pluginNamen = (eintrag) => (Array.isArray(eintrag.plugin) ? eintrag.plugin : [eintrag.plugin]).filter(Boolean);

/** Was dieses Gerät wirklich kann: { wie: 'nativ'|'web'|'nein', warum }. */
export function kann(faehigkeit) {
  const eintrag = FAEHIGKEITEN[faehigkeit];
  if (!eintrag) return { wie: 'nein', warum: `unbekannte Fähigkeit: ${faehigkeit}` };
  const namen = pluginNamen(eintrag);
  for (const name of namen) {
    if (huellePlugin(name)) return { wie: 'nativ', warum: `${name} ist in der Hülle eingebaut` };
  }
  let imWeb = false;
  try { imWeb = Boolean(eintrag.web?.()); } catch { imWeb = false; }
  if (imWeb) {
    return {
      wie: 'web',
      warum: istHuelle() ? `${namen.join(' / ')} fehlt in der Hülle — es läuft über den Browser-Weg` : 'der Browser kann das',
    };
  }
  return { wie: 'nein', warum: eintrag.ohne };
}

/** Welches Plugin eine Fähigkeit gerade trägt — null, wenn sie über den Browser läuft. */
export function faehigkeitPlugin(faehigkeit, methoden = null) {
  const eintrag = FAEHIGKEITEN[faehigkeit];
  if (!eintrag) return null;
  return erstesPlugin(pluginNamen(eintrag), methoden);
}

// --- Widget-Stand an die Hülle ------------------------------------------------------------------
//
// `web/data/widget.js` erzeugt den kleinen Stand (WIDGETS.md §2) und legt ihn im Gerät ab. Ein
// Widget auf dem Startbildschirm kommt an diesen Platz NICHT heran: Es lebt in einem eigenen
// Prozess, ohne Fenster und ohne localStorage. Deshalb reicht die Hülle denselben Text an einen
// Platz weiter, den beide sehen dürfen — iPhone: App Group, Android: SharedPreferences.
//
// Gibt `false` zurück, wenn es keine Hülle gibt (Browser). Das ist kein Fehler: Dort gibt es
// auch kein Widget. Der Aufrufer legt den Stand trotzdem lokal ab, damit der Weg steht.

/**
 * Schiebt den Widget-Stand in die Hülle. Gibt ein Versprechen auf true/false zurück:
 * true = die Hülle hat es angenommen, false = keine Hülle, kein Widget-Plugin, oder die Hülle
 * sagt selbst nein.
 *
 * Runde 7b: Vorher gab diese Funktion true zurück, OHNE die Antwort anzusehen — und der Ruf
 * wurde weder abgewartet noch abgefangen (eine abgelehnte Zusage landete als unhandledrejection
 * im Fenster). Auf einem iPhone ohne App Group antwortet CrewWidget.swift ehrlich
 * { ok: false, grund: 'keine-gruppe' }; diese Ehrlichkeit kam nirgends an. Jetzt schon.
 */
export async function widgetStandAnHuelle(stand) {
  const plugin = huellePlugin('CrewWidget', ['standSetzen']);
  if (typeof plugin?.standSetzen !== 'function') { WIDGET_GRUND.wert = 'keine-huelle'; return false; }
  try {
    const antwort = await plugin.standSetzen({ json: typeof stand === 'string' ? stand : JSON.stringify(stand) });
    // Eine Hülle, die gar nichts zurückgibt, hat den Ruf trotzdem angenommen — nur ein
    // ausdrückliches ok:false ist ein Nein (mit Grund, siehe CrewWidget.swift).
    WIDGET_GRUND.wert = antwort?.ok === false ? (antwort.grund || 'nein') : '';
    return antwort?.ok !== false;
  } catch (fehler) {
    WIDGET_GRUND.wert = String(fehler?.message || fehler || 'fehler');
    return false;   // ein Widget ist nie wichtig genug, um die App aufzuhalten
  }
}

// Was die Hülle beim LETZTEN Schreiben gesagt hat. Dass das hier steht, ist der Punkt:
// Vorher schrieb `widgetStandGrund(stand)` den Stand ein ZWEITES Mal in die Hülle, nur um die
// Antwort zu lesen — wer beide Funktionen nacheinander rief (und genau so stand es im Prüflauf),
// bezahlte jede Diagnose mit einem doppelten Schreiben ins Widget (dritte Welle, Prüfbericht).
const WIDGET_GRUND = { wert: 'keine-huelle' };

/**
 * Der Grund, den die Hülle beim letzten Nein genannt hat — für die Diagnose im Profil.
 * Fragt NICHTS: Es ist der gemerkte Grund des letzten `widgetStandAnHuelle()`. '' heißt „ja".
 */
export function widgetStandGrund() {
  return WIDGET_GRUND.wert;
}

// --- Die nativen Wege wirklich benutzen ---------------------------------------------------------
//
// WARUM DIESER ABSCHNITT EXISTIERT (Runde 7b, nach dem Prüfbericht)
// -----------------------------------------------------------------------------------------------
// Bis hierher beantwortete diese Datei nur eine Frage: „Kann die Hülle das?" — und niemand hat
// die Antwort benutzt. @capacitor/geolocation, @capacitor/share und die eigene Brücke
// CrewStandort waren eingebaut, aber KEINE Zeile der App rief sie auf. Das ist Hausregel 9
// („keine Zusage ohne Funktion") von hinten: die Zusage stand sogar in NATIVE.md.
//
// Der Weg, der KEINE fremde Datei anfasst und trotzdem die ganze App nativ macht:
// Die App fragt an sechs Stellen `navigator.geolocation` (room.js, guide.js, orte-vorschlaege.js,
// supabase-gateway.js) und an einer Stelle `navigator.share` (profile.js). In der Hülle legen wir
// GENAU DIESE beiden Zugänge auf die Plugins um. Ein Vertrag, zwei Wege — kein Aufrufer muss
// wissen, ob er im Browser oder in der App läuft, und keiner kann die Umstellung vergessen.
//
// Das ist kein Trick, sondern der Grund, warum es die Plugins gibt: In der WKWebView des iPhones
// ist `navigator.geolocation` je nach Fassung gar nicht da oder antwortet nie, und
// `navigator.share` verlangt eine Berührung, die nach zwei await verbraucht ist. Wer die Plugins
// einbaut und die Web-Aufrufe stehen lässt, hat beides: das Gewicht UND den kaputten Weg.
//
// Im BROWSER wird kein einziger Zugang ersetzt: `nativeWegeEinrichten()` steigt in der ersten
// Zeile aus, wenn es keine Hülle gibt. Das ist gemessen (scratch/r7b-nativ.mjs, Abschnitt 2: die
// Zugänge sind dieselben Objekte wie vorher, und es geht kein Ruf an die Hülle).
// Genau zwei Dinge geschehen dort trotzdem, und sie stehen hier, weil ein Kommentar, der „kein
// Ereignis angemeldet" behauptete, schon einmal falsch war: Am Fenster hängen zwei Lauscher
// (DOMContentLoaded, load), die den Einrichtungsversuch wiederholen, falls eine Hülle ihr
// `Capacitor` erst spät ins Fenster legt. Im Browser laufen beide ins Leere — sie finden keine
// Hülle, ersetzen nichts und melden nichts an.

function capRueckruf(name, methode, optionen, rueckruf) {
  const c = cap();
  if (typeof c?.nativeCallback !== 'function') return null;
  try { return c.nativeCallback(name, methode, optionen || {}, rueckruf); } catch { return null; }
}

/**
 * Ein Ereignis der Hülle mithören. Das geht NICHT über die Methodenliste (PluginHeaders kennt
 * kein 'standort'), sondern über den Briefkasten der Hülle selbst.
 * Gibt { remove() } zurück oder null, wenn es keine Hülle gibt.
 */
export function huelleLauscher(name, ereignis, rueckruf) {
  const c = cap();
  if (typeof c?.addListener !== 'function') return null;
  try { return c.addListener(name, ereignis, rueckruf); } catch { return null; }
}

// --- Standort: ein Zugang, zwei Quellen ---------------------------------------------------------
//
// In der Hülle speist sich `navigator.geolocation` aus ZWEI Quellen, und die zweite ist der
// eigentliche Gewinn:
//   1. @capacitor/geolocation — solange die App offen ist (dasselbe wie im Browser, nur zuverlässig).
//   2. CrewStandort — die Orte, die das Telefon gemeldet hat, WÄHREND DIE APP ZU WAR (§3b).
// Beide landen in denselben Rückrufen. Damit trägt der bestehende Weg in supabase-gateway.js
// (standortBeobachten → standortAusPosition → an den Server) auch das, was in der Zeit passiert
// ist, in der niemand die App offen hatte — ohne dass diese Datei etwas davon wissen muss.

const STANDORT = {
  wachen: new Map(),      // eigene Nummer -> { erfolg, fehler }
  naechste: 1,
  pluginWache: null,      // die Nummer, unter der das Geolocation-Plugin bei uns meldet
  letzter: null,          // die zuletzt bekannte Position (auch aus der Zeit „App zu")
  wacheLaeuft: false,
};

/** Aus dem, was ein Plugin liefert, das, was jeder Aufrufer im Web erwartet. */
function alsPosition(roh) {
  if (!roh) return null;
  const c = roh.coords || roh;
  const lat = Number(c.latitude ?? c.lat);
  const lon = Number(c.longitude ?? c.lon);
  if (!Number.isFinite(lat) || !Number.isFinite(lon)) return null;
  const genauigkeit = c.accuracy ?? c.genauigkeitM;
  return {
    coords: {
      latitude: lat,
      longitude: lon,
      accuracy: Number.isFinite(Number(genauigkeit)) ? Number(genauigkeit) : null,
      altitude: c.altitude ?? null,
      altitudeAccuracy: c.altitudeAccuracy ?? null,
      heading: c.heading ?? null,
      speed: c.speed ?? null,
    },
    timestamp: Number(roh.timestamp ?? roh.at) || Date.now(),
    // Nur in der Hülle da, und nur zusätzlich: 'bewegung' | 'ankunft' | 'abfahrt' | 'offen'.
    // Wer es nicht kennt, sieht eine ganz normale Position.
    anlass: roh.anlass || (roh.coords ? 'offen' : undefined),
  };
}

/**
 * Ein Ort ist da. `nachfragen` steuert den einen heiklen Nebeneffekt: Nur wenn der Ort aus
 * einer LEBENDEN Quelle kommt (das Telefon meldet sich gerade), ist das der Moment, in dem sich
 * die Frage nach „auch bei zugeklappter App" von selbst erklärt. Der beim Start abgeholte ALTE
 * Ort ist das nicht — sonst stünde das Erlaubnisfenster wieder beim ersten Öffnen da.
 */
function standortMelden(roh, nachfragen = true) {
  const position = alsPosition(roh);
  if (!position) return;
  // Alte Meldungen (die Wache liefert beim Start den letzten bekannten Ort) dürfen einen
  // neueren Stand nie überschreiben.
  if (STANDORT.letzter && position.timestamp < STANDORT.letzter.timestamp) return;
  STANDORT.letzter = position;
  for (const wache of STANDORT.wachen.values()) {
    try { wache.erfolg?.(position); } catch { /* ein Aufrufer darf die anderen nie mitreißen */ }
  }
  // Jetzt, und nur jetzt: Der Standort ist gerade wirklich gebraucht worden.
  if (nachfragen) hintergrundNachfragen().catch(() => {});
}

function standortFehlerMelden(fehler) {
  const antwort = { code: 2, message: String(fehler?.message || fehler || 'kein Standort'), PERMISSION_DENIED: 1, POSITION_UNAVAILABLE: 2, TIMEOUT: 3 };
  if (/denied|permission|erlaub/i.test(antwort.message)) antwort.code = 1;
  for (const wache of STANDORT.wachen.values()) {
    try { wache.fehler?.(antwort); } catch { /* s. o. */ }
  }
}

/** Die Plugin-Wache läuft nur, solange mindestens ein Aufrufer zuhört. */
function pluginWacheStarten() {
  if (STANDORT.pluginWache !== null) return;
  // OHNE Methodenliste: huellePlugin() merkt sich den Zugang unter dem NAMEN und baut ihn
  // beim ersten Mal aus genau den Methoden, nach denen gefragt wurde. Eine engere Liste
  // hier würde einem späteren Aufrufer die restlichen Methoden für immer wegnehmen.
  const plugin = faehigkeitPlugin('standort');
  if (!plugin?.watchPosition) return;
  STANDORT.pluginWache = capRueckruf('Geolocation', 'watchPosition',
    { enableHighAccuracy: false, timeout: 30000, maximumAge: 15000 },
    (daten, fehler) => { if (fehler) standortFehlerMelden(fehler); else standortMelden(daten); });
}

function pluginWacheBeenden() {
  const id = STANDORT.pluginWache;
  if (id === null) return;
  STANDORT.pluginWache = null;
  const plugin = faehigkeitPlugin('standort');
  try { plugin?.clearWatch?.({ id }); } catch { /* dann räumt die Hülle beim Schließen auf */ }
}

function geoBruecke(plugin) {
  return {
    getCurrentPosition(erfolg, fehler, optionen = {}) {
      const hoechstalter = Number(optionen.maximumAge);
      const letzter = STANDORT.letzter;
      if (letzter && Number.isFinite(hoechstalter) && Date.now() - letzter.timestamp <= hoechstalter) {
        setTimeout(() => erfolg?.(letzter), 0);
        return;
      }
      plugin.getCurrentPosition({
        enableHighAccuracy: Boolean(optionen.enableHighAccuracy),
        timeout: Number(optionen.timeout) || 15000,
        maximumAge: Number.isFinite(hoechstalter) ? hoechstalter : 0,
      }).then((roh) => {
        const position = alsPosition(roh);
        if (!position) { fehler?.({ code: 2, message: 'kein Standort' }); return; }
        if (!STANDORT.letzter || position.timestamp >= STANDORT.letzter.timestamp) STANDORT.letzter = position;
        erfolg?.(position);
        // Gefragt wird nur, wenn der Aufrufer den Klick SEINES Knopfes mitgibt
        // (`getCurrentPosition(ok, fehler, { ausloeser: ereignis })`). Ohne ihn: nie.
        hintergrundNachfragen(optionen.ausloeser).catch(() => {});
      }).catch((e) => {
        // Kein stilles Nichts: Wer fragt, bekommt dieselbe Absage wie im Browser.
        const nachricht = String(e?.message || e || '');
        fehler?.({ code: /denied|permission|erlaub/i.test(nachricht) ? 1 : 2, message: nachricht || 'kein Standort' });
      });
    },
    watchPosition(erfolg, fehler, optionen = {}) {
      const nummer = STANDORT.naechste; STANDORT.naechste += 1;
      STANDORT.wachen.set(nummer, { erfolg, fehler });
      pluginWacheStarten();
      // Der zuletzt bekannte Ort — auch der aus der Zeit, in der die App zu war — kommt sofort,
      // so wie ein Browser ihn aus maximumAge liefern würde.
      const letzter = STANDORT.letzter;
      const hoechstalter = Number(optionen.maximumAge);
      if (letzter && (!Number.isFinite(hoechstalter) || Date.now() - letzter.timestamp <= Math.max(hoechstalter, 60000))) {
        setTimeout(() => { if (STANDORT.wachen.has(nummer)) erfolg?.(letzter); }, 0);
      }
      return nummer;
    },
    clearWatch(nummer) {
      STANDORT.wachen.delete(nummer);
      if (!STANDORT.wachen.size) pluginWacheBeenden();
    },
  };
}

// --- Teilen -------------------------------------------------------------------------------------

function teilenBruecke(plugin) {
  return async (daten = {}) => {
    const ergebnis = await plugin.share({
      title: daten.title || '',
      text: daten.text || '',
      url: daten.url || '',
      dialogTitle: daten.title || '',
    });
    // Wer abbricht, bekommt im Web eine AbortError-Ablehnung. Das Teilen-Blatt von Capacitor
    // lehnt ebenfalls ab — beides fangen die Aufrufer schon mit .catch() ab.
    return ergebnis;
  };
}

// --- Die Hintergrund-Wache: anmelden und zuhören -------------------------------------------------

const GEFRAGT_SCHLUESSEL = 'crew.standort.hintergrund.gefragt';

function schonGefragt() {
  try { return globalThis.localStorage?.getItem(GEFRAGT_SCHLUESSEL) === '1'; } catch { return false; }
}

function gefragtMerken() {
  try { globalThis.localStorage?.setItem(GEFRAGT_SCHLUESSEL, '1'); } catch { /* privates Fenster */ }
}

// --- Hat gerade ein MENSCH gedrückt? ------------------------------------------------------------
//
// N4, dritte Welle. Bis hierher hing das „Immer erlauben"-Fenster an einer Frage, die nur fast
// die richtige war: „Ist gerade ein Ort gebraucht worden?" Das ist auch dann wahr, wenn niemand
// etwas getan hat — `data/supabase-gateway.js` holt beim START der App (ready() → standortSenden,
// Zeile 272) und bei jedem Zurückholen in den Vordergrund (visibilitychange, Zeile 826) einen Ort,
// sobald „Standort teilen" einmal eingeschaltet wurde. Gemessen (Prüflauf der dritten Welle):
// App öffnen, kein einziger Tipp — und das Fenster stand da.
//
// Die dritte Welle hat daraus „Hat ein Mensch gerade gedrückt?" gemacht, am Fenster mitgehört.
// Das war zu grob (vierte Welle, siehe istKnopfDruck): Das Mithören bleibt nur für die Diagnose
// (huelleLage().wege.darfFragen); gefragt wird allein über den mitgegebenen Klick.
const BERUEHRUNG_FRIST_MS = 30000;
const BERUEHRUNG = { zuletzt: 0, hoert: false };

function beruehrungenMithoeren() {
  if (BERUEHRUNG.hoert || typeof globalThis.addEventListener !== 'function') return;
  BERUEHRUNG.hoert = true;
  const merken = () => { BERUEHRUNG.zuletzt = Date.now(); };
  // `capture` und `passive`: Diese Lauscher sehen jede Berührung, halten aber keine einzige auf
  // — sie können weder etwas verhindern noch das Scrollen bremsen.
  for (const art of ['pointerdown', 'touchstart', 'touchend', 'mousedown', 'click', 'keydown']) {
    try { globalThis.addEventListener(art, merken, { capture: true, passive: true }); } catch { /* dann eben nicht */ }
  }
}

/** Hat ein Mensch in den letzten Sekunden irgendwo gedrückt? Nur Diagnose — KEIN Tor mehr (s. u.). */
function menschHatGedrueckt() {
  return Boolean(BERUEHRUNG.zuletzt) && Date.now() - BERUEHRUNG.zuletzt <= BERUEHRUNG_FRIST_MS;
}

// N4, vierte Welle. „Irgendein Tipp in den letzten 30 s" war nur verschoben, nicht geschlossen:
// Ein Tipp auf etwas BELIEBIGES galt als Zustimmung, und der nächste Ort ohne Zutun (Start,
// Vordergrund) fragte dann nach „Immer erlauben" (gemessen: Tipp auf „new-crew", danach
// standortSenden() → 1× gefragt). Jetzt fragt nur, wer den Klick SEINES Knopfes ausdrücklich
// mitgibt — das Ereignis aus dem Klick-Handler. Kein Argument, keine Frage.
/** Ist `ausloeser` der echte, frische Klick eines Menschen auf einen Knopf? */
function istKnopfDruck(ausloeser) {
  if (!ausloeser || ausloeser.isTrusted !== true || ausloeser.type !== 'click') return false;
  if (!ausloeser.target?.closest?.('[data-act], button, [role="button"], [role="switch"]')) return false;
  const jetzt = globalThis.performance?.now?.();
  if (!Number.isFinite(jetzt) || !Number.isFinite(ausloeser.timeStamp)) return false;
  return jetzt - ausloeser.timeStamp <= BERUEHRUNG_FRIST_MS;
}

// AUSDRÜCKLICH NICHT über `navigator.userActivation`: Das wäre der nächstliegende Weg — und er
// ist falsch. Gemessen in genau diesem Prueflauf: In einer ferngesteuerten Seite ist
// `userActivation.isActive` true, OHNE dass irgendjemand etwas berührt hat. Ein Tor, das jeden
// durchlässt, ist kein Tor; nur die eigenen Lauscher oben wissen es sicher.

/**
 * Beim Start wird WIEDERAUFGENOMMEN, nicht gefragt.
 *
 * Das ist der Unterschied zwischen einer App, die man behält, und einer, die man löscht: Ein
 * „Immer erlauben"-Fenster beim ersten Öffnen ist die sicherste Art, ein Nein zu bekommen —
 * und Apple lehnt Apps dafür ab. Gefragt wird deshalb erst, wenn der Mensch den Standort
 * WIRKLICH benutzt hat (siehe hintergrundNachfragen), und dann genau einmal.
 */
async function wacheEinrichten() {
  const wache = faehigkeitPlugin('standort-hintergrund');
  if (!wache) return;
  // Erst zuhören, dann alles andere — sonst geht die erste Meldung verloren.
  //
  // `nachfragen: false` ist hier KEIN Detail, sondern der ganze Punkt (Prüfbericht Welle 2, N4):
  // Dieser Lauscher ist genau der Weg, auf dem sich das TELEFON von selbst meldet — iOS startet
  // die App dafür sogar, während niemand sie offen hat. Stünde hier der Standardwert `true`,
  // löste ein Ortswechsel ohne jeden Tipp das „Immer erlauben"-Fenster aus: gefragt würde beim
  // Aufwachen, nicht beim Benutzen. Gefragt wird ausschließlich aus geoBruecke heraus — dort,
  // wo ein Mensch gerade den Standort verlangt hat und der Anlass sich von selbst erklärt.
  huelleLauscher('CrewStandort', 'standort', (ort) => standortMelden(ort, false));
  let zustand = null;
  try { zustand = await wache.zustand?.(); } catch { zustand = null; }
  STANDORT.wacheLaeuft = Boolean(zustand?.hintergrund);
  // Die Erlaubnis liegt schon vor (früher gegeben, oder in den Einstellungen des Telefons
  // erteilt), die Wache ist aber nicht angemeldet — etwa nach einem Neustart oder einer neuen
  // Fassung der App. Dann anmelden, ohne zu fragen.
  if (zustand && zustand.grund === '' && !zustand.laeuft) {
    try {
      const gestartet = await wache.starten?.();
      STANDORT.wacheLaeuft = Boolean(gestartet?.hintergrund ?? gestartet?.laeuft);
    } catch { /* eine Absage ist kein Fehler — sie steht in zustand() */ }
  }
  // Der alte Ort: mitnehmen, nicht fragen. Das tut `letzterStandort()` bereits — und es ist
  // dieselbe Funktion, die eine Oberfläche ruft. Zwei Fassungen desselben Weges wären zwei
  // Wahrheiten über dasselbe Ding (Hausregel 3).
  await letzterStandort();
}

// Genau die zwei Zustände, in denen eine Frage etwas ändern kann — dieselben zwei Wörter, die
// CrewStandort.swift und StandortWache.java in `darfFragen` führen. Alles andere (kein-dienst,
// eine unbekannte Auskunft, eine kaputte Hülle) ist ein ehrliches Nein und keine Frage wert.
const FRAGBAR = new Set(['nur-vordergrund', 'keine-erlaubnis']);

/**
 * Fragt genau EINMAL nach „auch, wenn die App zu ist" — und zwar erst, nachdem ein MENSCH
 * gedrückt und dabei den Standort benutzt hat. Das ist der Moment, in dem die Frage sich von
 * selbst erklärt („du teilst deinen Standort — soll das auch gelten, wenn Crew zu ist?"), und
 * es ist die Reihenfolge, die Apple und Android verlangen: erst das grobe Orten, dann das andere.
 * Beide Bedingungen müssen zusammenkommen; ein Ort allein genügt nicht (N4).
 *
 * Sagt jemand nein, wird nie wieder gefragt. Der Schalter im Telefon bleibt der Weg zurück.
 */
async function hintergrundNachfragen(ausloeser) {
  if (schonGefragt() || !istHuelle()) return;
  // DAS ist die N4-Zeile: kein Klick des fragenden Knopfes, keine Frage. Weder der Start der
  // App noch ein Weckruf des Telefons noch ein Tipp auf etwas anderes kommt hier durch.
  if (!istKnopfDruck(ausloeser)) return;
  const lage = await wacheLage();
  if (lage.grund === 'keine-huelle') return;
  if (lage.grund === '') { gefragtMerken(); return; }   // schon erlaubt: nichts zu fragen
  // Ein Telefon ohne Standortdienst (Android ohne Play-Dienste, iPhone ohne
  // Significant-Change) wird durch keine Erlaubnis der Welt eines, das im Hintergrund meldet.
  // Abgehakt wird NUR auf eine echte Antwort der Hülle hin: 'kein-dienst', oder eines der
  // fragbaren Wörter mit darfFragen:false. 'keine-auskunft' und ein Fehler tragen ebenfalls
  // darfFragen:false — sie sind aber KEINE Antwort und dürfen die Frage nie verbrauchen.
  if (lage.grund === 'kein-dienst' || (lage.darfFragen === false && FRAGBAR.has(lage.grund))) { gefragtMerken(); return; }
  if (!FRAGBAR.has(lage.grund)) return;
  await wacheAnfragen(ausloeser);
}

/** Was die Hintergrund-Wache gerade wirklich tut — ehrlich, mit Grund. Für die Diagnose. */
export async function wacheLage() {
  const wache = faehigkeitPlugin('standort-hintergrund');
  if (!wache?.zustand) return { laeuft: false, hintergrund: false, grund: 'keine-huelle', darfFragen: false };
  try {
    const zustand = await wache.zustand();
    // Gar keine Auskunft ist NICHT dasselbe wie "alles erlaubt". Vorher fiel beides auf grund ''
    // zusammen; damit hätte eine stumme Hülle als "schon erlaubt" gegolten und die Frage wäre
    // für immer abgehakt gewesen, ohne je gestellt worden zu sein.
    if (!zustand || typeof zustand !== 'object') return { laeuft: false, hintergrund: false, grund: 'keine-auskunft', darfFragen: false };
    return {
      laeuft: Boolean(zustand?.laeuft),
      // hintergrund:false heißt: Es läuft nur, solange die App offen ist. Das ist die
      // Wahrheit, die vorher fehlte (Android meldet ohne ACCESS_BACKGROUND_LOCATION nichts,
      // sobald die App zu ist — trotzdem stand hier einmal laeuft:true).
      hintergrund: Boolean(zustand?.hintergrund),
      grund: zustand?.grund || '',
      // Würde eine Frage überhaupt etwas ändern? Die Hülle weiß es; hier wird es nur
      // weitergereicht (fehlt die Auskunft, gilt sie als erlaubt — die Wörter in `grund`
      // entscheiden dann).
      darfFragen: zustand?.darfFragen !== false,
    };
  } catch (fehler) {
    return { laeuft: false, hintergrund: false, grund: String(fehler?.message || fehler || 'fehler'), darfFragen: false };
  }
}

/**
 * Ausdrücklich nach der Hintergrund-Erlaubnis fragen — für einen Schalter in der Oberfläche
 * („Standort auch, wenn Crew zu ist"). Gibt zurück, was DANACH wirklich gilt, nicht was
 * gewünscht war. `ausloeser` ist das Klick-Ereignis dieses Schalters; ohne es wird nicht
 * gefragt, nur die Lage zurückgegeben.
 */
export async function wacheAnfragen(ausloeser) {
  const wache = faehigkeitPlugin('standort-hintergrund');
  if (!wache?.erlaubnisAnfragen || !istKnopfDruck(ausloeser)) return wacheLage();
  gefragtMerken();
  try {
    const danach = await wache.erlaubnisAnfragen();
    STANDORT.wacheLaeuft = Boolean(danach?.hintergrund);
    return { laeuft: Boolean(danach?.laeuft), hintergrund: Boolean(danach?.hintergrund), grund: danach?.grund || '', darfFragen: danach?.darfFragen !== false };
  } catch (fehler) {
    return { laeuft: false, hintergrund: false, grund: String(fehler?.message || fehler || 'fehler'), darfFragen: false };
  }
}

/** Der letzte Ort, den das Telefon gemeldet hat — auch aus der Zeit, in der die App zu war. */
export async function letzterStandort() {
  const wache = faehigkeitPlugin('standort-hintergrund');
  if (wache?.letzte) {
    try {
      const antwort = await wache.letzte();
      const position = alsPosition(antwort?.ort);
      if (position) { standortMelden(antwort.ort, false); return position; }
    } catch { /* weiter unten */ }
  }
  return STANDORT.letzter;
}

// --- Erlaubnisse: EIN Wort für Browser und Hülle -------------------------------------------------
//
// WARUM ES DIESEN ABSCHNITT GIBT (Runde 7b — „zwei Wahrheiten" im Prüfbericht)
// -----------------------------------------------------------------------------------------------
// Zwei Stellen der App entscheiden nicht über `navigator.geolocation`, sondern über die ERLAUBNIS.
// `ui/guide.js` fragt `navigator.permissions.query({ name: 'geolocation' })`; `data/push.js` und
// `data/orte-vorschlaege.js` fragen ebenfalls nach der Erlaubnis. Beides ist die Erlaubnis der
// WEBVIEW — und die benutzt die App in der Hülle gar nicht mehr.
//
// Gemessen, nicht vermutet: Eine Android-WebView ohne `onGeolocationPermissionsShowPrompt`
// antwortet 'denied'. Die App merkte sich daraufhin „Standort: abgelehnt", gab für immer
// { ok:false } zurück und erklärte das mit einem Satz über „Einstellungen des Browsers für diese
// Seite" — in einer App gibt es die nicht, und das Plugin lieferte den Standort die ganze Zeit
// einwandfrei.
//
// WAS DIESE BRÜCKE TUT — UND WAS SIE NICHT GETAN HAT (dritte Welle, Richtigstellung):
// Hier stand, die Brücke habe auch guide.js' Satz „dieses Gerät kann keine Mitteilungen"
// geschlossen. Das stimmt nicht. Nachgesehen: `ui/guide.js` trägt dieses Ergebnis selbst —
// geraetKann() fragt `kann(art).wie !== 'nein'` (guide.js:367) und liest `Notification` nur noch,
// wenn `kann('mitteilungen').wie === 'web'` ist (guide.js:382). In der Hülle mit Push-Plugin
// kommt es dort also gar nicht mehr an. Die Reparatur lag in einer fremden Datei; dieser
// Abschnitt hat sie nicht bewirkt. Was er bewirkt, ist das andere: `navigator.permissions` und
// `Notification.permission` sagen in der Hülle dasselbe wie die Plugins — für jeden Aufrufer,
// auch für einen, der erst morgen geschrieben wird und von Plugins nichts weiß.
//
// Was die Brücke NICHT tut: Mitteilungen anzeigen. `Notification` ist hier ein Objekt mit genau
// zwei Dingen (`permission`, `requestPermission`) — der Erlaubnis, um die es geht. Ein
// vorgetäuschter Konstruktor, der nichts anzeigt, wäre eine Zusage ohne Funktion (Hausregel 9);
// deshalb ist es ausdrücklich KEINE Funktion, und `kann('mitteilungen')` fällt darauf nicht
// herein (WEB.mitteilungen verlangt `typeof … === 'function'`).
//
// Wer es ausdrücklich will, ruft `erlaubnisStand('standort' | 'mitteilungen')` — dieselbe Antwort
// ohne Umweg über den Browser-Zugang, im Web wie in der Hülle mit derselben Bedeutung.

const ERLAUBNIS_ARTEN = {
  standort: { faehigkeit: 'standort', webName: 'geolocation' },
  mitteilungen: { faehigkeit: 'mitteilungen', webName: 'notifications' },
};

// Der zuletzt gemessene Stand. Es gibt Antworten, die SYNCHRON sein müssen
// (`Notification.permission` ist eine Eigenschaft, kein Versprechen) — die kommen von hier.
const ERLAUBNIS_STAND = { standort: 'prompt', mitteilungen: 'prompt' };

const ALS_WORT = { granted: 'erteilt', denied: 'abgelehnt', prompt: 'offen', unmoeglich: 'unmoeglich' };

/** Was ein Plugin auf checkPermissions/requestPermissions antwortet → 'granted'|'denied'|'prompt'. */
function ausPluginStand(art, antwort) {
  if (!antwort || typeof antwort !== 'object') return 'prompt';
  let wert;
  if (art === 'mitteilungen') {
    wert = antwort.receive;
  } else {
    // Grob genügt Crew: Wer nur das ungefähre Orten erlaubt hat, hat erlaubt.
    wert = antwort.location === 'granted' || antwort.coarseLocation === 'granted'
      ? 'granted'
      : (antwort.location || antwort.coarseLocation);
  }
  if (wert === 'granted') return 'granted';
  if (wert === 'denied') return 'denied';
  return 'prompt';   // 'prompt-with-rationale' und alles Unbekannte heißt: noch offen
}

async function nativerErlaubnisStand(art, fragen = false) {
  const eintrag = ERLAUBNIS_ARTEN[art];
  const plugin = eintrag ? faehigkeitPlugin(eintrag.faehigkeit) : null;
  if (typeof plugin?.checkPermissions !== 'function') return null;
  let stand = 'prompt';
  try { stand = ausPluginStand(art, await plugin.checkPermissions()); } catch { stand = 'prompt'; }
  if (fragen && stand === 'prompt' && typeof plugin.requestPermissions === 'function') {
    try { stand = ausPluginStand(art, await plugin.requestPermissions()); } catch { /* ein Nein ist eine Antwort */ }
  }
  ERLAUBNIS_STAND[art] = stand;
  return stand;
}

async function webErlaubnisStand(art, fragen = false) {
  if (art === 'mitteilungen') {
    const glocke = globalThis.Notification;
    if (typeof glocke !== 'function') return 'unmoeglich';
    if (glocke.permission === 'granted' || glocke.permission === 'denied') return glocke.permission;
    if (!fragen) return 'prompt';
    // Safari kannte früher nur die Rückruf-Form; heute gibt es ein Versprechen. Beides abdecken.
    const antwort = await new Promise((fertig) => {
      try {
        const wert = glocke.requestPermission((w) => fertig(w));
        if (wert && typeof wert.then === 'function') wert.then(fertig, () => fertig('default'));
      } catch { fertig('default'); }
    });
    return antwort === 'granted' ? 'granted' : antwort === 'denied' ? 'denied' : 'prompt';
  }
  if (!globalThis.navigator?.geolocation) return 'unmoeglich';
  const erlaubnis = globalThis.navigator?.permissions;
  if (typeof erlaubnis?.query !== 'function') return 'prompt';
  try {
    const stand = await erlaubnis.query({ name: 'geolocation' });
    return stand?.state === 'granted' ? 'granted' : stand?.state === 'denied' ? 'denied' : 'prompt';
  } catch {
    return 'prompt';   // Firefox wirft für unbekannte Namen — das ist kein Nein
  }
}

/**
 * Die Erlaubnis für 'standort' oder 'mitteilungen', in den Wörtern, die die App ohnehin benutzt:
 *   'erteilt' | 'abgelehnt' | 'offen' | 'unmoeglich'
 * In der Hülle antwortet das Plugin, im Browser der Browser — die Bedeutung ist dieselbe.
 */
export async function erlaubnisStand(art) {
  const nativ = await nativerErlaubnisStand(art, false);
  if (nativ) return ALS_WORT[nativ];
  return ALS_WORT[await webErlaubnisStand(art, false)] || 'offen';
}

/**
 * Dasselbe ohne Warten — für Stellen, die synchron antworten müssen (ein Render, eine
 * Eigenschaft). In der Hülle ist es der zuletzt gemessene Stand; `erlaubnisStand()` frischt ihn
 * auf. Solange noch nichts gemessen wurde, lautet die Antwort 'offen' und nicht 'unmoeglich' —
 * „ich weiß es noch nicht" darf nie als „geht nicht" ankommen.
 */
export function erlaubnisStandSofort(art) {
  const eintrag = ERLAUBNIS_ARTEN[art];
  if (!eintrag) return 'unmoeglich';
  if (faehigkeitPlugin(eintrag.faehigkeit)) return ALS_WORT[ERLAUBNIS_STAND[art]] || 'offen';
  if (art === 'mitteilungen') {
    const glocke = globalThis.Notification;
    if (typeof glocke === 'undefined') return 'unmoeglich';
    if (glocke.permission === 'granted') return 'erteilt';
    if (glocke.permission === 'denied') return 'abgelehnt';
    return 'offen';
  }
  return globalThis.navigator?.geolocation ? 'offen' : 'unmoeglich';
}

/**
 * Ausdrücklich fragen — und zurückgeben, was DANACH gilt. Im Browser muss der Aufruf in der
 * Berührung liegen (Safari verlangt das); in der Hülle fragt das Betriebssystem selbst.
 */
export async function erlaubnisFragen(art) {
  const nativ = await nativerErlaubnisStand(art, true);
  if (nativ) return ALS_WORT[nativ];
  return ALS_WORT[await webErlaubnisStand(art, true)] || 'offen';
}

/** Legt in der Hülle `navigator.permissions` und `Notification` auf die Plugins. */
function erlaubnisBrueckeEinrichten(nav) {
  const nachArt = { geolocation: 'standort', notifications: 'mitteilungen' };
  const alt = nav.permissions;
  const tragen = Object.values(nachArt).some((art) => Boolean(faehigkeitPlugin(ERLAUBNIS_ARTEN[art].faehigkeit)));
  if (tragen) {
    const query = async (beschreibung) => {
      const art = nachArt[beschreibung?.name];
      const stand = art ? await nativerErlaubnisStand(art, false) : null;
      if (stand) {
        // Dieselbe Form, die ein Browser zurückgibt — inklusive der Lauscher, die manche
        // Aufrufer anmelden. Ein Wechsel meldet sich hier nicht: Das Betriebssystem sagt es
        // der Hülle, nicht dem Fenster. Wer den Stand neu braucht, fragt neu.
        return { name: beschreibung.name, state: stand, status: stand, onchange: null, addEventListener() {}, removeEventListener() {} };
      }
      if (typeof alt?.query === 'function') return alt.query(beschreibung);
      throw new TypeError(`Erlaubnis unbekannt: ${beschreibung?.name}`);
    };
    try { Object.defineProperty(nav, 'permissions', { value: { query }, configurable: true }); } catch { /* dann bleibt der Weg des Browsers */ }
  }
  // Die Brücke liegt über JEDES vorhandene `Notification` der WebView, sobald das Push-Plugin
  // da ist — nicht nur über ein fehlendes (dritte Welle, Prüfbericht). Der Grund ist eine
  // Annahme, die vorher nirgends als Annahme dastand: Eine WebView, die `Notification` mitbringt
  // und dauerhaft 'denied' sagt (Android-WebView ohne gesetzte Berechtigung), hätte die Brücke
  // nie bekommen — und ihr 'denied' gälte weiter, während das Plugin einwandfrei zustellt. In
  // der Hülle gibt es keinen Service Worker; über den Web-Weg kann dort ohnehin keine Mitteilung
  // erscheinen. Die einzige Bedeutung von `Notification` ist dort die ERLAUBNIS — und die sagt
  // ab jetzt das Plugin. Angezeigt wird weiterhin nichts (kein Konstruktor, s. o.).
  if (faehigkeitPlugin('mitteilungen')) {
    const glocke = {
      get permission() {
        const stand = ERLAUBNIS_STAND.mitteilungen;
        return stand === 'granted' || stand === 'denied' ? stand : 'default';
      },
      requestPermission(rueckruf) {
        return erlaubnisFragen('mitteilungen').then((wort) => {
          const wert = wort === 'erteilt' ? 'granted' : wort === 'abgelehnt' ? 'denied' : 'default';
          try { rueckruf?.(wert); } catch { /* ein Aufrufer darf die Antwort nie verhindern */ }
          return wert;
        });
      },
    };
    try { Object.defineProperty(globalThis, 'Notification', { value: glocke, configurable: true }); } catch { /* s. o. */ }
  }
  // Einmal wirklich nachsehen — danach kann die synchrone Eigenschaft die Wahrheit sagen.
  nativerErlaubnisStand('mitteilungen', false).catch(() => {});
  nativerErlaubnisStand('standort', false).catch(() => {});
}

// --- Einmal einrichten ---------------------------------------------------------------------------

let eingerichtet = false;

/**
 * Legt in der Hülle die nativen Wege auf die Zugänge, die die App ohnehin benutzt.
 * Idempotent, ohne Rückgabe, und im Browser ein sofortiges Nichts.
 *
 * Aufgerufen wird sie beim Laden dieses Moduls (unten). Das ist Absicht: `web/core/html.js`
 * lädt native.js, und html.js lädt jeder Bildschirm — es gibt also keinen Start der App, bei
 * dem sie ausbliebe, und keine fremde Datei muss daran denken. Sie ist trotzdem ausgeführt,
 * damit app.js sie später ausdrücklich aufrufen kann (dann passiert beim zweiten Mal nichts).
 */
export function nativeWegeEinrichten() {
  if (eingerichtet || !istHuelle()) return;
  eingerichtet = true;
  const nav = globalThis.navigator;
  if (!nav) return;

  const geo = faehigkeitPlugin('standort');
  if (geo?.getCurrentPosition) {
    try {
      Object.defineProperty(nav, 'geolocation', { value: geoBruecke(geo), configurable: true });
    } catch {
      // Ein Zugang, der sich nicht ersetzen lässt, bleibt der des Browsers. Schlechter als
      // vorher wird es nie.
    }
  }

  const teilen = faehigkeitPlugin('teilen');
  if (teilen?.share) {
    try {
      Object.defineProperty(nav, 'share', { value: teilenBruecke(teilen), configurable: true });
      Object.defineProperty(nav, 'canShare', { value: () => true, configurable: true });
    } catch { /* s. o. */ }
  }

  // Erlaubnis: dieselbe Antwort für alle, die nach ihr fragen (siehe Abschnitt oben).
  erlaubnisBrueckeEinrichten(nav);

  // Ab jetzt wird mitgehört, ob ein Mensch drückt — die Bedingung dafür, dass das
  // Betriebssystem überhaupt etwas fragen darf (N4, siehe beruehrungenMithoeren). Im Browser
  // wird hier NICHTS angemeldet: nativeWegeEinrichten() steigt oben ohne Hülle sofort aus.
  beruehrungenMithoeren();

  // Die Wache läuft auch ohne offene Karte weiter — sie ist der ganze Sinn von §3b.
  wacheEinrichten().catch(() => { /* eine kaputte Hülle darf die App nie aufhalten */ });
}

// Hier stand `nativeWegeVergessen()` — „für Prüfläufe". Nachgesehen (dritte Welle): Kein
// einziger Aufrufer, weder in der App noch in einem Prüflauf; jeder Lauf legt die Hülle vor
// dem Laden der Seite an und bekommt das Modul dadurch ohnehin frisch. Ersatzlos weg.

nativeWegeEinrichten();
// Die Hülle legt ihr `Capacitor` normalerweise VOR jedem Modul ins Fenster (native-bridge.js
// steht im Kopf des Dokuments). Sollte sie in einer Fassung später dran sein, versuchen wir es
// noch zweimal — der Aufruf ist idempotent und im Browser ein Nichts.
if (!eingerichtet && typeof globalThis.addEventListener === 'function') {
  globalThis.addEventListener('DOMContentLoaded', () => nativeWegeEinrichten(), { once: true });
  globalThis.addEventListener('load', () => nativeWegeEinrichten(), { once: true });
}

/** Die ganze Tabelle auf einmal — für die Diagnose und für Prüfberichte. */
export function huelleLage() {
  const stand = {};
  for (const name of Object.keys(FAEHIGKEITEN)) stand[name] = kann(name);
  return {
    huelle: istHuelle(),
    plattform: plattform(),
    faehigkeiten: stand,
    // Runde 7b: Nicht nur „kann die Hülle das?", sondern auch „läuft es wirklich?". Genau
    // diese Trennung hat gefehlt: eingebaut war alles, benutzt war nichts.
    wege: {
      standort: istHuelle() && Boolean(faehigkeitPlugin('standort')?.getCurrentPosition),
      teilen: istHuelle() && Boolean(faehigkeitPlugin('teilen')?.share),
      wache: STANDORT.wacheLaeuft,
      letzterStandort: STANDORT.letzter ? { at: STANDORT.letzter.timestamp, anlass: STANDORT.letzter.anlass || '' } : null,
      // N4: Hat in den letzten 30 s irgendwo ein Mensch gedrückt? Seit der fünften Welle nur noch
      // eine NOTWENDIGE Bedingung, keine hinreichende: Gefragt wird allein, wenn der Knopf, der
      // fragt, seinen Klick mitgibt (istKnopfDruck). true heißt hier also NICHT „es wird gefragt".
      darfFragen: istHuelle() && menschHatGedrueckt(),
    },
    // Dasselbe Wort, das guide.js benutzt — damit ein Prüfbericht die beiden nebeneinander
    // legen kann und „zwei Wahrheiten" auffliegen, statt still zu wirken.
    erlaubnisse: {
      standort: erlaubnisStandSofort('standort'),
      mitteilungen: erlaubnisStandSofort('mitteilungen'),
    },
  };
}
