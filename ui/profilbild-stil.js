// Profilbild — gemeinsame Zeichensprache aller Motive (Runde 3).
//
// Jonathan: „Die Tierbilder sind extremst kindisch gemacht. Eher spielerisch cool."
// Deshalb gilt für JEDES Motiv (Tiere, Flaggen, Autos, Weltall, Schiffe, Flugzeuge):
//   - 96er-Raster, Mitte (48|48). Wichtiges liegt innerhalb von etwa 36 px um die Mitte —
//     die Scheibe ist rund, die Ecken fallen weg.
//   - Flache Flächen, klare geometrische Formen, höchstens vier Farbtöne je Motiv.
//   - Keine Glanzpunkte in den Augen, keine rosa Bäckchen, keine Schnurrhaare, keine Umrisse.
//   - Tiefe kommt aus EINER dunkleren Facette (Tiere: die rechte Gesichtshälfte, siehe
//     `facette` in profilbild.js), nicht aus Verläufen im Motiv.
//   - Augen sind kleine, dunkle, ruhige Formen. Der Ausdruck (neutral · lächelnd · grimmig)
//     entsteht nur aus Lid, Braue und Mund — dieselben Helfer für jedes Tier.

export const DUNKEL = '#1E1A17';
export const CREME = '#F6EFE4';
export const WEISS = '#FBF8F3';

// Ausdruck: '' (neutral) · 'froh' (lächelnd) · 'grimmig'.
// l/r: Augenmitte links/rechts, gr: Augenradius, haut: Fläche um das Auge (für das Lid).
// innen(punkt): optional, was im Auge liegt (Pupille einer Eule) — es liegt UNTER den Lidern.
// braue: Farbe der grimmigen Braue (Standard: Augenfarbe) — für helle Augen auf dunklem Fell.
export function augen({ l, r, gr = 3.4, haut, hautR = haut, ausdruck = '', farbe = DUNKEL, hoch = 1.15, innen = null, braue = null }) {
  const auge = ([x, y]) => `<ellipse cx="${x}" cy="${y}" rx="${gr}" ry="${(gr * hoch).toFixed(2)}" fill="${farbe}"/>${innen ? innen([x, y]) : ''}`;
  let teile = auge(l) + auge(r);
  if (ausdruck === 'froh') {
    // Das untere Lid schiebt sich rund hoch: das Auge wird zur ruhigen, gefüllten Sichel —
    // auch bei 44 px noch als Lächeln lesbar, aber kein Comic-Strich.
    const ry = gr * hoch;
    const lid = ([x, y], h) => `<ellipse cx="${x}" cy="${(y + ry * 1.2).toFixed(2)}" rx="${(gr * 1.4).toFixed(2)}" ry="${(ry * 1.1).toFixed(2)}" fill="${h}"/>`;
    teile += lid(l, haut) + lid(r, hautR);
  }
  if (ausdruck === 'grimmig') {
    // Oberes Lid schräg zur Mitte hin gesenkt, darüber eine kurze Braue.
    const seite = ([x, y], h, innenRechts) => {
      const s = innenRechts ? 1 : -1;       // Richtung zur Gesichtsmitte
      const aussen = x - s * gr * 1.9;
      const innen = x + s * gr * 1.9;
      const lid = `<path d="M${aussen.toFixed(2)} ${(y - gr * 2.2).toFixed(2)}L${innen.toFixed(2)} ${(y - gr * 2.2).toFixed(2)}L${innen.toFixed(2)} ${(y - gr * 0.05).toFixed(2)}L${aussen.toFixed(2)} ${(y - gr * 1.05).toFixed(2)}Z" fill="${h}"/>`;
      const strich = `<path d="M${(x - s * gr * 1.55).toFixed(2)} ${(y - gr * 1.75).toFixed(2)}L${(x + s * gr * 1.45).toFixed(2)} ${(y - gr * 0.72).toFixed(2)}" stroke="${braue || farbe}" stroke-width="${(gr * 0.72).toFixed(2)}" stroke-linecap="round"/>`;
      return lid + strich;
    };
    teile += seite(l, haut, true) + seite(r, hautR, false);
  }
  return teile;
}

// Runde 5 (B2, Jonathan: „Nicht jedes Tier hat einen Mund, z. B. Vögel haben Schnabel, und du hast
// dort einfach Lächeln drauf getan."): Jedes Tier legt in profilbild-tiere.js fest, was es hat
// (anatomie: 'mund' · 'schnabel' · 'ohne'). Schnabel und „ohne" zeigen den Ausdruck nur über Lid
// und Braue. Tiere mit Schnauze (Fuchs, Katze, Hund …) haben eine geteilte Oberlippe: Von der
// Nasenspitze führt ein kurzer Strich nach unten, dort teilt sich die Lippe in zwei Bögen —
// beim Lächeln ω, grimmig nach außen gesenkt. Neutral: nichts, wie bisher.
// spitze: y der Nasenspitze · b: Breite der Lippe.
export function schnauze({ spitze, b = 8, ausdruck = '', farbe = DUNKEL, dicke = 2 }) {
  if (ausdruck !== 'froh' && ausdruck !== 'grimmig') return '';
  const r = (n) => Math.round(n * 100) / 100;
  const x = 48;
  const h = b / 2;
  const knoten = spitze + b * 0.26;
  const stiel = `M${x} ${r(spitze)}V${r(knoten)}`;
  const boegen = ausdruck === 'froh'
    ? `M${r(x - h - 0.5)} ${r(knoten - b * 0.06)}Q${r(x - h * 0.5)} ${r(knoten + b * 0.62)} ${x} ${r(knoten)}Q${r(x + h * 0.5)} ${r(knoten + b * 0.62)} ${r(x + h + 0.5)} ${r(knoten - b * 0.06)}`
    : `M${r(x - h)} ${r(knoten + b * 0.52)}Q${r(x - h * 0.45)} ${r(knoten - b * 0.1)} ${x} ${r(knoten)}Q${r(x + h * 0.45)} ${r(knoten - b * 0.1)} ${r(x + h)} ${r(knoten + b * 0.52)}`;
  return `<path d="${stiel}${boegen}" stroke="${farbe}" stroke-width="${dicke}" fill="none" stroke-linecap="round" stroke-linejoin="round"/>`;
}

// Mund unter Nase/Schnauze. neutral: optional kurzer ruhiger Strich (neutralStrich).
export function mund({ x = 48, y, b = 8, ausdruck = '', farbe = DUNKEL, dicke = 2, neutralStrich = false, tiefe = 1 }) {
  const h = b / 2;
  if (ausdruck === 'froh') {
    return `<path d="M${x - h} ${y}Q${x} ${(y + b * 0.8 * tiefe).toFixed(2)} ${x + h} ${y}" stroke="${farbe}" stroke-width="${dicke}" fill="none" stroke-linecap="round"/>`;
  }
  if (ausdruck === 'grimmig') {
    return `<path d="M${x - h} ${(y + b * 0.28).toFixed(2)}Q${x} ${(y - b * 0.2 * tiefe).toFixed(2)} ${x + h} ${(y + b * 0.28).toFixed(2)}" stroke="${farbe}" stroke-width="${dicke}" fill="none" stroke-linecap="round"/>`;
  }
  return neutralStrich
    ? `<path d="M${x - h * 0.6} ${y + 1}H${x + h * 0.6}" stroke="${farbe}" stroke-width="${dicke}" stroke-linecap="round"/>`
    : '';
}
