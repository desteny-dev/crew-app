// Runde 4 (B4) — EIN Zeichen für alle besten Freunde.
//
// Jonathan: „Beste-Freunde-Markierungen bearbeiten — aber dann gelten sie für alle besten
// Freunde und nicht nur für eine … damit es allgemein beste Freunde gibt und nur eine
// besondere Person." Die besondere Person behält ihr eigenes Zeichen je Person; die besten
// Freunde teilen sich genau eine Einstellung.
//
// Gespeichert: settings.besteFreundeMarke = { symbol, color }
//   symbol  'herz' | 'stern' | 'blitz' | 'mond'  (dieselben vier wie SPECIAL_SYMBOL_KEYS)
//   color   '#E1B72E' (Gelb) oder ein anderer Farbwert aus MARKER_COLORS
// Fehlt das Feld, gilt das bisherige Aussehen: goldener Stern.
//
// Bewusst OHNE Importe: web/ui/components.js (personMarker/avatarMark) darf diese Datei lesen,
// ohne dass ein Kreis entsteht.

// Runde 6 (Jonathan): „das gold ist unpassend, nimm das gelb" — aus der Palette in
// web/ui/components.js (MARKER_COLORS), Reihe 2: #E1B72E „Gelb". Das alte Gold #C9AE6B lag gar
// nicht in der Palette; im Farbwähler trug deshalb KEIN Feld den Auswahlring, und auf hellem
// Papier wirkte es matt statt festlich. Der Name der Konstante bleibt, damit gespeicherte
// Einstellungen und Aufrufer unverändert weiterlaufen.
export const BESTE_FREUNDE_GOLD = '#E1B72E';
export const MARKE_SYMBOLE = ['herz', 'stern', 'blitz', 'mond'];
export const BESTE_FREUNDE_MARKE_STANDARD = Object.freeze({ symbol: 'stern', color: BESTE_FREUNDE_GOLD });

const FARBE = /^#[0-9a-f]{6}$/i;

export function besteFreundeMarke(settings) {
  const roh = settings?.besteFreundeMarke || {};
  return {
    symbol: MARKE_SYMBOLE.includes(roh.symbol) ? roh.symbol : BESTE_FREUNDE_MARKE_STANDARD.symbol,
    color: FARBE.test(roh.color || '') ? String(roh.color).toUpperCase() : BESTE_FREUNDE_MARKE_STANDARD.color,
  };
}

export function istStandardMarke(marke) {
  return marke?.symbol === BESTE_FREUNDE_MARKE_STANDARD.symbol
    && String(marke?.color || '').toUpperCase() === BESTE_FREUNDE_MARKE_STANDARD.color;
}
