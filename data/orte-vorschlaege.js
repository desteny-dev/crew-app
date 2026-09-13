// Orte aus der Funktion `vorschlaege` — für beide Gateways. Runde 3 (Jonathan: „In Salzburg
// zeigt es Vorarlberg"): Auch wer die App nur ausprobiert, sieht echte Orte seiner Gegend.

import { entfernungKm, hatLage } from '../core/entfernung.js';

const TAG_MS = 86400000;

// Runde 3 (G1, Jonathan: „dass man in der Meet-Übersicht die Karte sieht und ein Bild, falls
// vorhanden"): Foto und Herkunft des gewählten Vorschlags gehen mit ans Meet — das Foto nur,
// solange das Meet an dessen Ort stattfindet (gleicher Name oder höchstens 150 m entfernt).
// → { suggestionId, bild?, bildSeite?, bildUrheber? } oder {}
export function vorschlagsFoto(vorschlag, ort) {
  if (!vorschlag?.id) return {};
  const ergebnis = { suggestionId: vorschlag.id };
  if (!vorschlag.bild) return ergebnis;
  const gleicherName = Boolean(ort?.name) && ort.name === vorschlag.place?.name;
  const nah = hatLage(ort) && hatLage(vorschlag.place) && entfernungKm(ort, vorschlag.place) <= 0.15;
  if (!gleicherName && !nah) return ergebnis;
  return { ...ergebnis, bild: vorschlag.bild, bildSeite: vorschlag.bildSeite || null, bildUrheber: vorschlag.bildUrheber || null };
}
const STANDORT_KEY = 'crew-vorschlag-standort';
const STANDORT_AUFFRISCHEN_MS = 3600000;

// Runde 3: Wo Vorschläge gesucht werden. Die Zuhause-Adresse lässt sich (noch) nirgends
// eintragen — ohne Standort bekäme jeder die Bregenzer Beispiele. Wer den Standort für
// Vorschläge freigibt, bekommt seine Gegend. Er bleibt auf dem Gerät, gerundet auf rund einen
// Kilometer — nie im Konto; die Funktion sieht davon nur ihr Rasterfeld.
function gelesenerStandort() {
  try {
    const wert = JSON.parse(globalThis.localStorage?.getItem(STANDORT_KEY) || 'null');
    return hatLage(wert) ? wert : null;
  } catch {
    return null;
  }
}

// Freigegebener Standort zuerst (bewusst gewählt, und unterwegs das Passendere), sonst zuhause.
export function vorschlagsMitte(heim) {
  const standort = gelesenerStandort();
  if (standort) return { lat: standort.lat, lon: standort.lon, quelle: 'standort', am: standort.am || 0 };
  if (hatLage(heim)) return { ...heim, quelle: 'zuhause' };
  return null;
}

// Fragt das Gerät (einmal, im Moment des Tippens). → { ok, lat, lon } | { ok: false, grund }
export function standortFuerVorschlaegeHolen() {
  return new Promise((fertig) => {
    const geo = globalThis.navigator?.geolocation;
    if (!geo) { fertig({ ok: false, grund: 'geraet' }); return; }
    geo.getCurrentPosition(
      (position) => {
        const wert = {
          lat: Math.round(position.coords.latitude * 100) / 100,
          lon: Math.round(position.coords.longitude * 100) / 100,
          am: Date.now(),
        };
        try { globalThis.localStorage?.setItem(STANDORT_KEY, JSON.stringify(wert)); } catch { /* egal */ }
        fertig({ ok: true, lat: wert.lat, lon: wert.lon });
      },
      (fehler) => fertig({ ok: false, grund: fehler?.code === 1 ? 'verweigert' : 'unbekannt' }),
      { enableHighAccuracy: false, timeout: 12000, maximumAge: 30 * 60000 },
    );
  });
}

export function vorschlagsStandortVergessen() {
  try { globalThis.localStorage?.removeItem(STANDORT_KEY); } catch { /* egal */ }
}

// Ist der gemerkte Standort älter als eine Stunde und die Erlaubnis schon erteilt, still
// auffrischen — ohne neue Frage. `nachher()` zeichnet neu, wenn sich etwas geändert hat.
let frischtAuf = false;
export function vorschlagsStandortAuffrischen(nachher) {
  const wert = gelesenerStandort();
  const erlaubnis = globalThis.navigator?.permissions;
  if (!wert || frischtAuf || !erlaubnis?.query || Date.now() - (wert.am || 0) < STANDORT_AUFFRISCHEN_MS) return;
  frischtAuf = true;
  erlaubnis.query({ name: 'geolocation' })
    .then((status) => (status.state === 'granted' ? standortFuerVorschlaegeHolen() : null))
    .then((ergebnis) => {
      if (ergebnis?.ok && (ergebnis.lat !== wert.lat || ergebnis.lon !== wert.lon)) nachher();
    })
    .catch(() => {})
    .finally(() => { frischtAuf = false; });
}

// Ein Ort aus der Funktion `vorschlaege` in der Form, die Liste, Karte und Detail-Sheet kennen.
export function ortAlsVorschlag(o) {
  return {
    id: `ort-${o.id}`, title: o.name, shortTitle: o.name, iconKey: o.art, kind: o.kind || 'ort', category: o.kategorie,
    place: { name: o.name, address: o.adresse || '', lat: o.lat, lon: o.lon },
    distanceKm: null, priceLevel: null, price: null,
    besonders: Boolean(o.besonders), selten: Boolean(o.selten), wiederholung: o.wiederholung || null, saison: o.saison || null,
    bild: o.bild || null, bildSeite: o.bild_seite || null, bildUrheber: o.bild ? 'Wikimedia Commons' : null,
    // Runde 4 (G7): Wikivoyage-Tipps tragen eine Beschreibung und ihre Seite (Namensnennung, CC BY-SA).
    description: o.beschreibung || o.adresse || '', blurb: o.beschreibung ? o.beschreibung.slice(0, 90) : '',
    links: { website: o.website || null, social: [], maps: ['apple', 'google'] },
    quelle: o.quelle === 'wikivoyage' ? 'wikivoyage' : (o.kind === 'event' ? 'wikidata' : 'openstreetmap'),
    quelleSeite: o.quelle_seite || null,
    // Runde 4 (G6): unter freiem Himmel? true | false | null — die Engine gewichtet danach das Wetter.
    draussen: typeof o.draussen === 'boolean' ? o.draussen : null,
  };
}

// Fragt die Funktion für eine Lage und hält die Antwort.
//   anfragen(lage) → Promise<{ data, error }>   (angemeldet: functions.invoke, Gast: fetch)
//   geaendert()    → die App neu zeichnen
// Holt die Funktion gerade Felder im Hintergrund (`laeuft`), fragt der Nachlader nach 8 s noch
// einmal; wurde ein Gast gebremst oder ging etwas schief, nach zwei Minuten.
export class OrteNachlader {
  constructor(anfragen, geaendert) {
    this.anfragen = anfragen;
    this.geaendert = geaendert;
    this.orte = [];
    // Runde 4 (G6): Vorhersage des Feldes aus der Antwort: [{ datum, code, regen, tmin, tmax }] | null
    this.wetter = null;
    this.laeuft = false;
    this.fuer = null;
    this.am = 0;
    this.wartet = null;
  }

  // Frühestens nach `ms` darf wieder gefragt werden.
  spaeter(ms) {
    this.am = Date.now() - TAG_MS + ms;
  }

  lade(lage) {
    if (!hatLage(lage) || this.laeuft) return;
    const schluessel = `${lage.lat.toFixed(2)}:${lage.lon.toFixed(2)}`;
    if (this.fuer === schluessel && Date.now() - this.am < TAG_MS) return;
    // Andere Gegend: die alten Orte sofort weg, nicht erst mit der Antwort.
    if (this.fuer && this.fuer !== schluessel && this.orte.length) {
      this.orte = [];
      this.geaendert();
    }
    this.laeuft = true;
    this.fuer = schluessel;
    this.am = Date.now();
    clearTimeout(this.wartet);
    Promise.resolve()
      .then(() => this.anfragen(lage))
      .then(({ data, error } = {}) => {
        if (error || !Array.isArray(data?.orte)) { this.spaeter(120000); return; }
        this.orte = data.orte.map(ortAlsVorschlag);
        this.wetter = Array.isArray(data.wetter) ? data.wetter : null;
        if ((data.laeuft || []).length) {
          this.spaeter(8000);
          this.wartet = setTimeout(() => this.lade(lage), 8000);
        } else if (data.gebremst) {
          this.spaeter(120000);
        }
        this.geaendert();
      })
      .catch(() => this.spaeter(120000))
      .finally(() => { this.laeuft = false; });
  }
}
