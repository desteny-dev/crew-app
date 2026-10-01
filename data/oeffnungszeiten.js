// Öffnungszeiten aus OpenStreetMap (`opening_hours`) lesen und zu einem Zeitpunkt auswerten
// (ALGORITHMUS §3.3, Paket C). Rein, ohne Importe: läuft unverändert in der App (Demo-Gateway) und
// im Server (Kopie in supabase/functions/_shared/, erzeugt von scripts/auswahl-deploy.mjs).
//
// Was verstanden wird (die Formen, die in OSM wirklich vorkommen):
//   24/7 · Mo-Fr 08:00-18:00 · Mo,We,Fr … · mehrere Spannen (10:00-12:00,14:00-18:00) · über
//   Mitternacht (22:00-04:00, 18:00-26:00) · offenes Ende (10:00+) · off/closed/open ·
//   PH (Feiertage, mit Liste) · Sa[1]/Su[-1] (n-ter Wochentag im Monat) · Monate und Tage
//   (Apr-Oct, Dec 24, Dec 24-26, Dec 24-Jan 06) · Zusatzregeln mit Komma · Rückfall mit „||" ·
//   Kommentare in Anführungszeichen · die deutschen Kürzel Di/Mi/Do/So, die Menschen oft eintragen.
// Was NICHT verstanden wird (sunrise/sunset, SH-Schulferien, Wochennummern, Jahre, Ostern …),
// gibt „unbekannt" zurück — NIE „geschlossen". Ein Ort, dessen Zeiten wir nicht lesen können, ist
// nicht zu; er bekommt nur den Hinweis „Öffnungszeiten unbekannt" (§3.3).

const WOCHENTAG = Object.freeze({ mo: 1, tu: 2, we: 3, th: 4, fr: 5, sa: 6, su: 0, di: 2, mi: 3, do: 4, so: 0 });
const MONAT = Object.freeze({ jan: 1, feb: 2, mar: 3, apr: 4, may: 5, jun: 6, jul: 7, aug: 8, sep: 9, oct: 10, nov: 11, dec: 12,
  mär: 3, mai: 5, okt: 10, dez: 12 });
const TAG_MIN = 24 * 60;
// Nach einem offenen Ende („22:00+") gilt der frühe Morgen als unbekannt, nicht als geschlossen.
// Keine Stellschraube des Algorithmus, sondern Lesart der OSM-Syntax — deshalb hier und nicht in der Konfig.
const OFFENES_ENDE_BIS_MIN = 6 * 60;

// --- Ortszeit ohne Bibliothek (Intl kennt jede Zone samt Sommerzeit) -------------------------------
const FORMATE = new Map();
function format(zone) {
  if (!FORMATE.has(zone)) {
    FORMATE.set(zone, new Intl.DateTimeFormat('en-GB', {
      timeZone: zone, hourCycle: 'h23', year: 'numeric', month: '2-digit', day: '2-digit',
      hour: '2-digit', minute: '2-digit', weekday: 'short',
    }));
  }
  return FORMATE.get(zone);
}
const KURZ = { Sun: 0, Mon: 1, Tue: 2, Wed: 3, Thu: 4, Fri: 5, Sat: 6 };

// Dieselben Zeitpunkte werden je Liste für Hunderte Orte gefragt (Intl ist teuer: gemessen 130 ms je
// Liste ohne Merkspeicher). Gemerkt wird nur das Ergebnis der reinen Umrechnung — kein Zustand der Regel.
const GEMERKT = new Map();

// → { jahr, monat (1–12), tag, wochentag (0 So … 6 Sa), minuten, datum:'YYYY-MM-DD' }
export function ortszeit(ms, zone = 'Europe/Vienna') {
  const schluessel = `${zone}|${ms}`;
  const bekannt = GEMERKT.get(schluessel);
  if (bekannt) return bekannt;
  if (GEMERKT.size > 5000) GEMERKT.clear();
  const wert = Object.freeze(ortszeitRechnen(ms, zone));
  GEMERKT.set(schluessel, wert);
  return wert;
}

function ortszeitRechnen(ms, zone) {
  let teile;
  try { teile = format(zone || 'Europe/Vienna').formatToParts(new Date(ms)); } catch { teile = format('Europe/Vienna').formatToParts(new Date(ms)); }
  const wert = (typ) => teile.find((t) => t.type === typ)?.value || '';
  const jahr = Number(wert('year'));
  const monat = Number(wert('month'));
  const tag = Number(wert('day'));
  const stunde = Number(wert('hour')) % 24;
  return {
    jahr, monat, tag, wochentag: KURZ[wert('weekday')] ?? 0,
    minuten: stunde * 60 + Number(wert('minute')),
    datum: `${wert('year')}-${wert('month')}-${wert('day')}`,
  };
}

function tageImMonat(jahr, monat) {
  return new Date(Date.UTC(jahr, monat, 0)).getUTCDate();
}

// --- Zerlegen ------------------------------------------------------------------------------------
// Ein Muster je Baustein; was keinem Muster entspricht, macht den ganzen Text „unbekannt".
const MUSTER = [
  ['kommentar', /^"([^"]*)"/],
  ['rundum', /^24\/7/],
  ['zeit', /^(\d{1,2}):(\d{2})\s*-\s*(\d{1,2}):(\d{2})(\+)?/],
  ['offenesEnde', /^(\d{1,2}):(\d{2})\+/],
  ['wochentag', /^(mo|tu|we|th|fr|sa|su|di|mi|do|so)(?:\[(-?\d)\])?(?:\s*-\s*(mo|tu|we|th|fr|sa|su|di|mi|do|so))?(?![a-z])/i],
  ['feiertag', /^ph(?![a-z])/i],
  ['monat', /^(jan|feb|mar|mär|apr|may|mai|jun|jul|aug|sep|oct|okt|nov|dec|dez)(?:\s+(\d{1,2}))?(?:\s*-\s*(?:(jan|feb|mar|mär|apr|may|mai|jun|jul|aug|sep|oct|okt|nov|dec|dez)\s*)?(\d{1,2})?)?(?![a-z])/i],
  ['aus', /^(off|closed|geschlossen)(?![a-z])/i],
  ['auf', /^open(?![a-z])/i],
  ['unbekanntWort', /^(sunrise|sunset|dawn|dusk|sh|week|easter|unknown)(?![a-z])/i],
  ['jahr', /^\d{4}(?![:\d])/],
  ['oder', /^\|\|/],
  ['semikolon', /^;/],
  ['komma', /^,/],
  ['doppelpunkt', /^:/],
  ['leer', /^\s+/],
];

function zerlegen(text) {
  const bausteine = [];
  let rest = String(text ?? '').trim();
  while (rest.length) {
    let treffer = null;
    for (const [art, muster] of MUSTER) {
      const m = muster.exec(rest);
      if (m) { treffer = { art, m }; break; }
    }
    if (!treffer) return null;
    rest = rest.slice(treffer.m[0].length);
    if (treffer.art === 'leer' || treffer.art === 'doppelpunkt') continue;
    if (treffer.art === 'unbekanntWort' || treffer.art === 'jahr') return null;
    bausteine.push(treffer);
  }
  return bausteine;
}

function monatsTag(monat, tag) {
  return monat * 100 + tag;
}

// Baut aus den Bausteinen die Regeln: [{ art:'normal'|'zusatz'|'rueckfall', monate, tage, ph, zeiten, zustand }]
// zustand: 'zeiten' | 'aus' | 'kommentar'
function regelnBauen(bausteine) {
  const regeln = [];
  let regel = null;
  let naechsteArt = 'normal';
  let phase = 'auswahl'; // 'auswahl' → Wähler (Monat, Tag); 'zeit' → Zeiten; nach Zeiten kann ein Komma eine Zusatzregel beginnen
  const neu = () => {
    regel = { art: naechsteArt, monate: null, tage: null, ph: false, zeiten: [], zustand: null, kommentar: '' };
    regeln.push(regel);
    phase = 'auswahl';
  };
  for (let i = 0; i < bausteine.length; i += 1) {
    const { art, m } = bausteine[i];
    if (art === 'semikolon') { regel = null; naechsteArt = 'normal'; continue; }
    if (art === 'oder') { regel = null; naechsteArt = 'rueckfall'; continue; }
    if (art === 'komma') {
      const weiter = bausteine[i + 1]?.art;
      if (!regel) return null;
      if (phase === 'zeit' && (weiter === 'zeit' || weiter === 'offenesEnde')) continue;
      if (phase === 'auswahl' && (weiter === 'wochentag' || weiter === 'feiertag' || weiter === 'monat')) continue;
      if (phase === 'zeit' || regel.zustand) { regel = null; naechsteArt = 'zusatz'; continue; }
      return null;
    }
    if (!regel) neu();
    if (art === 'kommentar') {
      regel.kommentar = m[1];
      if (!regel.zustand) regel.zustand = 'kommentar';
      continue;
    }
    if (art === 'rundum') { regel.zustand = 'zeiten'; regel.zeiten.push({ von: 0, bis: TAG_MIN }); phase = 'zeit'; continue; }
    if (art === 'auf') { regel.zustand = 'zeiten'; regel.zeiten.push({ von: 0, bis: TAG_MIN }); phase = 'zeit'; continue; }
    if (art === 'aus') { regel.zustand = 'aus'; phase = 'zeit'; continue; }
    if (art === 'zeit' || art === 'offenesEnde') {
      if (phase === 'zeit' && regel.zustand && regel.zustand !== 'zeiten' && regel.zustand !== 'kommentar') return null;
      const von = Number(m[1]) * 60 + Number(m[2]);
      if (Number(m[1]) > 24 || Number(m[2]) > 59) return null;
      if (art === 'offenesEnde') {
        regel.zeiten.push({ von, bis: TAG_MIN, offenesEnde: true });
      } else {
        if (Number(m[3]) > 48 || Number(m[4]) > 59) return null;
        let bis = Number(m[3]) * 60 + Number(m[4]);
        if (bis <= von) bis += TAG_MIN;          // über Mitternacht: 22:00-04:00
        regel.zeiten.push({ von, bis, offenesEnde: Boolean(m[5]) });
      }
      regel.zustand = 'zeiten';
      phase = 'zeit';
      continue;
    }
    // Wähler: nach den Zeiten beginnt ein Wähler ohne Trenner eine neue (normale) Regel nicht —
    // das wäre kein gültiges opening_hours. Lieber unbekannt als falsch.
    if (phase === 'zeit') return null;
    if (art === 'wochentag') {
      const von = WOCHENTAG[m[1].toLowerCase()];
      const bis = m[3] ? WOCHENTAG[m[3].toLowerCase()] : von;
      const nth = m[2] != null ? Number(m[2]) : null;
      if (nth != null && (nth === 0 || nth > 5 || nth < -5)) return null;
      regel.tage = regel.tage || [];
      let t = von;
      for (let schritt = 0; schritt < 7; schritt += 1) {
        regel.tage.push({ tag: t, nth });
        if (t === bis) break;
        t = (t + 1) % 7;
      }
      continue;
    }
    if (art === 'feiertag') { regel.ph = true; continue; }
    if (art === 'monat') {
      const m1 = MONAT[m[1].toLowerCase()];
      const t1 = m[2] ? Number(m[2]) : null;
      const m2 = m[3] ? MONAT[m[3].toLowerCase()] : null;
      const t2 = m[4] ? Number(m[4]) : null;
      regel.monate = regel.monate || [];
      if (t1 == null && t2 == null) {
        // Apr oder Apr-Oct
        regel.monate.push({ von: monatsTag(m1, 1), bis: monatsTag(m2 || m1, 31) });
      } else if (t1 != null) {
        // Dec 24 · Dec 24-26 · Dec 24-Jan 06
        const bisMonat = m2 || m1;
        const bisTag = t2 != null ? t2 : (m2 ? 31 : t1);
        regel.monate.push({ von: monatsTag(m1, t1), bis: monatsTag(bisMonat, bisTag) });
      } else {
        return null;
      }
      continue;
    }
    return null;
  }
  if (!regeln.length) return null;
  // Eine Regel ohne Zeiten und ohne „off" gilt als „offen" nur mit ausdrücklichem open/24/7 —
  // „Mo-Fr" allein ist unvollständig und damit unbekannt.
  for (const r of regeln) if (!r.zustand) return null;
  return regeln;
}

// Liest einen opening_hours-Text. → { ok:true, regeln } | { ok:false }
export function oeffnungszeitenLesen(text) {
  const roh = String(text ?? '').trim();
  if (!roh) return { ok: false };
  const bausteine = zerlegen(roh);
  if (!bausteine) return { ok: false };
  const regeln = regelnBauen(bausteine);
  return regeln ? { ok: true, regeln } : { ok: false };
}

// --- Auswerten -----------------------------------------------------------------------------------
function trifftTag(regel, tag, feiertage) {
  const { jahr, monat, tag: t, wochentag, datum } = tag;
  if (regel.monate) {
    const md = monatsTag(monat, t);
    const imBereich = regel.monate.some(({ von, bis }) => (von <= bis ? md >= von && md <= bis : md >= von || md <= bis));
    if (!imBereich) return false;
  }
  const istFeiertag = feiertage.has(datum);
  if (regel.tage || regel.ph) {
    const wochentagPasst = (regel.tage || []).some(({ tag: w, nth }) => {
      if (w !== wochentag) return false;
      if (nth == null) return true;
      if (nth > 0) return Math.ceil(t / 7) === nth;
      return t + 7 * (-nth - 1) > tageImMonat(jahr, monat) - 7;
    });
    if (!(wochentagPasst || (regel.ph && istFeiertag))) return false;
  }
  return true;
}

// Die Spannen eines Tages: { spannen:[{von,bis,offenesEnde}], unbekannt:boolean, getroffen:boolean }
function tagesSpannen(regeln, tag, feiertage) {
  let spannen = null;
  let unbekannt = false;
  const anwenden = (r) => {
    if (r.zustand === 'kommentar') { unbekannt = true; spannen = spannen || []; return; }
    if (r.zustand === 'aus') { if (r.art !== 'zusatz') spannen = []; unbekannt = false; return; }
    if (r.art === 'zusatz') spannen = [...(spannen || []), ...r.zeiten];
    else { spannen = [...r.zeiten]; unbekannt = false; }
  };
  const haupt = regeln.filter((r) => r.art !== 'rueckfall');
  const rueckfall = regeln.filter((r) => r.art === 'rueckfall');
  // Ein Kommentar ohne Wähler („nach Vereinbarung") ersetzt keine Zeiten anderer Tage — er gilt nur,
  // wo sonst nichts steht (wie ein Rückfall).
  const kommentarOhneWaehler = (r) => r.zustand === 'kommentar' && !r.tage && !r.ph && !r.monate;
  for (const r of haupt) if (!kommentarOhneWaehler(r) && trifftTag(r, tag, feiertage)) anwenden(r);
  if (spannen === null) {
    for (const r of [...haupt.filter(kommentarOhneWaehler), ...rueckfall]) if (trifftTag(r, tag, feiertage)) anwenden(r);
  }
  return { spannen: spannen || [], unbekannt, getroffen: spannen !== null };
}

function uhr(minuten) {
  const m = ((minuten % TAG_MIN) + TAG_MIN) % TAG_MIN;
  return `${String(Math.floor(m / 60)).padStart(2, '0')}:${String(m % 60).padStart(2, '0')}`;
}

// Hauptfunktion. zeitpunkt: ms. optionen: { feiertage: Iterable<'YYYY-MM-DD'>, zeitzone }
// → { status:'offen'|'geschlossen'|'unbekannt', schliesstUm?, oeffnetUm?, offenesEnde? }
//   schliesstUm: 'HH:MM' (nur wenn offen und bekannt); oeffnetUm: nächste Öffnung am selben Tag.
export function oeffnungsStatus(text, zeitpunkt, { feiertage = [], zeitzone = 'Europe/Vienna' } = {}) {
  const gelesen = oeffnungszeitenLesen(text);
  if (!gelesen.ok) return { status: 'unbekannt' };
  const fei = feiertage instanceof Set ? feiertage : new Set(feiertage || []);
  const heute = ortszeit(zeitpunkt, zeitzone);
  const gestern = ortszeit(zeitpunkt - TAG_MIN * 60000, zeitzone);
  const h = tagesSpannen(gelesen.regeln, heute, fei);
  const g = tagesSpannen(gelesen.regeln, gestern, fei);
  const jetzt = heute.minuten;
  // Was gestern über Mitternacht hinausging, gilt heute früh (22:00-04:00 → heute 00:00-04:00).
  const ueberhang = g.spannen.filter((s) => s.bis > TAG_MIN).map((s) => ({ von: 0, bis: s.bis - TAG_MIN, offenesEnde: s.offenesEnde }));
  const alle = [...ueberhang, ...h.spannen];
  const offen = alle.find((s) => jetzt >= s.von && jetzt < s.bis);
  if (offen) {
    if (offen.offenesEnde) return { status: 'offen', offenesEnde: true };
    return { status: 'offen', schliesstUm: uhr(offen.bis) };
  }
  if (h.unbekannt) return { status: 'unbekannt' };
  // „22:00+" (offenes Ende) am Vortag: In den frühen Stunden weiß niemand, ob noch offen ist.
  if (jetzt < OFFENES_ENDE_BIS_MIN && g.spannen.some((s) => s.offenesEnde)) return { status: 'unbekannt' };
  const spaeter = h.spannen.filter((s) => s.von > jetzt).sort((a, b) => a.von - b.von)[0];
  return spaeter ? { status: 'geschlossen', oeffnetUm: uhr(spaeter.von), oeffnetInMin: spaeter.von - jetzt } : { status: 'geschlossen' };
}
