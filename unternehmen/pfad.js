// Adressen der Ortsseiten (Paket H, ALGORITHMUS §6.1) — EINE Stelle, ohne Importe.
//
// Schön:    <webAdresse>ort/<land>/<slug>-<schluessel>     z. B. …/crew-app/ort/at/cafe-seeblick-n123456
// Wirklich: <webAdresse>ort.html?ort=<schluessel>
//
// GitHub Pages kennt keine dynamischen Pfade. Jede unbekannte Adresse bekommt dort web/404.html; die lädt
// dieses Modul und leitet /ort/…-n123 auf ort.html?ort=n123 weiter. Der Schlüssel ist n|w|r + OSM-Nummer
// (node/way/relation) — derselbe, den die Datenbank bildet (private.ort_schluessel).

const SCHLUESSEL = /^[nwr][0-9]{1,15}$/;

export function schluesselGueltig(wert) {
  return SCHLUESSEL.test(String(wert || ''));
}

// 'osm:node/123' | 'n123' → 'n123' (oder '' wenn es kein OSM-Ort ist)
export function schluesselVon(id) {
  const s = String(id || '');
  if (SCHLUESSEL.test(s)) return s;
  const m = s.match(/^osm:(node|way|relation)\/([0-9]{1,15})$/);
  return m ? `${m[1][0]}${m[2]}` : '';
}

// Aus einem Pfad wie /crew-app/ort/at/cafe-seeblick-n123 → { basis:'/crew-app/', land:'at', slug, schluessel } | null
export function ortAusPfad(pfad) {
  const m = String(pfad || '').match(/^(.*?\/)ort\/([a-z]{2,3})\/(?:([a-z0-9-]*)-)?([nwr][0-9]{1,15})\/?$/);
  if (!m) return null;
  return { basis: m[1], land: m[2], slug: m[3] || '', schluessel: m[4] };
}

// Welcher Ort ist gemeint? ?ort=… (auch 'osm:node/…') schlägt den Pfad.
export function ortAusAdresse(ort = globalThis.location) {
  try {
    const q = new URLSearchParams(ort?.search || '').get('ort');
    const aus = schluesselVon(q);
    if (aus) return aus;
  } catch { /* unlesbar */ }
  return ortAusPfad(ort?.pathname || '')?.schluessel || '';
}

// Für web/404.html: Ziel der Weiterleitung oder null (dann ist es wirklich „nicht gefunden“).
export function zielAus404(pfad, suche = '', anhang = '') {
  const o = ortAusPfad(pfad);
  if (!o) return null;
  const rest = new URLSearchParams(String(suche || '').replace(/^\?/, ''));
  rest.set('ort', o.schluessel);
  return `${o.basis}ort.html?${rest.toString()}${anhang || ''}`;
}

// Die Wurzel der Website aus einem beliebigen Pfad (…/crew-app/irgendwas → /crew-app/), für den Link „zur App“.
export function wurzelVon(pfad, host = '') {
  const o = ortAusPfad(pfad);
  if (o) return o.basis;
  if (/\.github\.io$/.test(host)) {
    const erstes = String(pfad || '/').split('/').filter(Boolean)[0];
    return erstes ? `/${erstes}/` : '/';
  }
  return '/';
}

// Schöne Adresse zum Teilen (webAdresse endet mit „/“, pfad beginnt mit „/ort/…“ — so liefert ihn die Datenbank).
export function schoeneAdresse(webAdresse, pfad) {
  return `${String(webAdresse || '').replace(/\/+$/, '')}${pfad || ''}`;
}
