// Öffnungszeiten im Unternehmens-Bereich (Paket H, ALGORITHMUS §6.4) — ohne Importe.
//
// Gespeichert wird OSM-Syntax („Mo-Fr 10:00-18:00; Sa 10:00-14:00; Su off“) — dieselbe Sprache wie
// `orte.oeffnungszeiten_osm`, damit die Machbarkeit (Paket C) EINEN Leser hat und die Zeiten des
// Unternehmens dort Vorrang haben können. Der Editor der Seite kennt die übliche Teilmenge: Wochentage,
// Bereiche, mehrere Zeitfenster, „off“, über Mitternacht. Alles andere (Feiertage, Monate, Wochen) liest
// dieser Baustein nicht — dann sagt die Seite ehrlich „kann der Editor nicht lesen“ statt etwas zu erfinden.
//
// HINWEIS für den Chef: Sobald web/data/oeffnungszeiten.js (Paket C) steht, soll `abweichung` dessen
// Leser benutzen — dann gibt es genau EINEN Parser für OSM-Öffnungszeiten.

export const TAGE = ['Mo', 'Tu', 'We', 'Th', 'Fr', 'Sa', 'Su'];
export const TAGE_DE = ['Mo', 'Di', 'Mi', 'Do', 'Fr', 'Sa', 'So'];
const ZEIT = /^([01]?\d|2[0-4]):([0-5]\d)$/;

const minuten = (hhmm) => {
  const m = String(hhmm).match(ZEIT);
  return m ? Number(m[1]) * 60 + Number(m[2]) : NaN;
};
const zweistellig = (hhmm) => {
  const [h, m] = String(hhmm).split(':');
  return `${String(Number(h)).padStart(2, '0')}:${m}`;
};

function tageLesen(text) {
  const tage = new Set();
  for (const teil of text.split(',')) {
    const [von, bis] = teil.trim().split('-');
    const a = TAGE.indexOf(von);
    if (a < 0) return null;
    if (bis === undefined) { tage.add(a); continue; }
    const b = TAGE.indexOf(bis);
    if (b < 0) return null;
    for (let i = a; ; i = (i + 1) % 7) { tage.add(i); if (i === b) break; }
  }
  return tage;
}

function zeitenLesen(text) {
  const t = text.trim().toLowerCase();
  if (t === 'off' || t === 'closed') return [];
  const fenster = [];
  for (const teil of text.split(',')) {
    const [von, bis] = teil.trim().split('-');
    if (!ZEIT.test(von || '') || !ZEIT.test(bis || '')) return null;
    fenster.push([zweistellig(von), zweistellig(bis)]);
  }
  return fenster;
}

// OSM-Text → [7 × (Array von [von, bis] | null)] — null für Tage, über die der Text nichts sagt. Unlesbar → null.
export function lesen(text) {
  const roh = String(text || '').trim();
  if (!roh) return null;
  if (roh === '24/7') return TAGE.map(() => [['00:00', '24:00']]);
  const woche = TAGE.map(() => null);
  for (const regel of roh.split(';').map((r) => r.trim()).filter(Boolean)) {
    if (/^PH\b/.test(regel)) continue;                 // Feiertage: nicht Teil der Woche
    const m = regel.match(/^((?:Mo|Tu|We|Th|Fr|Sa|Su)(?:\s*[-,]\s*(?:Mo|Tu|We|Th|Fr|Sa|Su))*)\s+(.+)$/);
    const tage = m ? tageLesen(m[1].replace(/\s+/g, '')) : new Set([0, 1, 2, 3, 4, 5, 6]);
    const zeiten = zeitenLesen(m ? m[2] : regel);
    if (!tage || !zeiten) return null;
    for (const t of tage) woche[t] = zeiten;           // spätere Regeln gelten (wie in OSM)
  }
  return woche;
}

// [7 × Fenster | [] | null] → OSM-Text. Gleiche aufeinanderfolgende Tage werden zusammengefasst.
export function schreiben(woche) {
  const teile = [];
  let i = 0;
  while (i < 7) {
    const w = woche[i];
    if (w === null || w === undefined) { i += 1; continue; }
    const schluessel = JSON.stringify(w);
    let j = i;
    while (j + 1 < 7 && woche[j + 1] !== null && woche[j + 1] !== undefined && JSON.stringify(woche[j + 1]) === schluessel) j += 1;
    const tage = j === i ? TAGE[i] : j === i + 1 ? `${TAGE[i]},${TAGE[j]}` : `${TAGE[i]}-${TAGE[j]}`;
    const zeiten = w.length ? w.map(([a, b]) => `${zweistellig(a)}-${zweistellig(b)}`).join(',') : 'off';
    teile.push(`${tage} ${zeiten}`);
    i = j + 1;
  }
  return teile.join('; ');
}

// Offene Minuten der Woche (über Mitternacht → in den nächsten Tag) für die Tage, die beide kennen.
function offen(woche, tage) {
  const bits = new Uint8Array(7 * 1440);
  for (const t of tage) {
    for (const [von, bis] of woche[t] || []) {
      const a = minuten(von);
      let b = minuten(bis);
      if (Number.isNaN(a) || Number.isNaN(b)) continue;
      if (b <= a) b += 1440;
      for (let x = a; x < b; x += 1) bits[(t * 1440 + x) % (7 * 1440)] = 1;
    }
  }
  return bits;
}

// Wie stark weichen zwei Angaben ab? 0 = gleich … 1 = ganz anders (Jaccard über die offenen Minuten).
// null, wenn eine der beiden nicht lesbar ist oder sie keinen Tag gemeinsam kennen.
export function abweichung(textA, textB) {
  const a = lesen(textA);
  const b = lesen(textB);
  if (!a || !b) return null;
  const tage = [0, 1, 2, 3, 4, 5, 6].filter((t) => a[t] !== null && b[t] !== null);
  if (!tage.length) return null;
  const x = offen(a, tage);
  const y = offen(b, tage);
  let schnitt = 0;
  let vereint = 0;
  for (let i = 0; i < x.length; i += 1) {
    if (x[i] && y[i]) schnitt += 1;
    if (x[i] || y[i]) vereint += 1;
  }
  return vereint ? 1 - schnitt / vereint : 0;
}

// Für die Anzeige: [{ tage:'Mo–Fr', zeiten:'10:00–18:00' | 'geschlossen' }]
export function zeilen(text) {
  const woche = lesen(text);
  if (!woche) return null;
  const aus = [];
  let i = 0;
  while (i < 7) {
    if (woche[i] === null) { i += 1; continue; }
    const s = JSON.stringify(woche[i]);
    let j = i;
    while (j + 1 < 7 && woche[j + 1] !== null && JSON.stringify(woche[j + 1]) === s) j += 1;
    aus.push({
      tage: j === i ? TAGE_DE[i] : `${TAGE_DE[i]}–${TAGE_DE[j]}`,
      zeiten: woche[i].length ? woche[i].map(([a, b]) => `${a}–${b}`).join(', ') : 'geschlossen',
    });
    i = j + 1;
  }
  return aus;
}
