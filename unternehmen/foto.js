// Fotos vorbereiten, BEVOR sie das Gerät verlassen (Paket H, ALGORITHMUS §6.4) — ohne Importe.
//
// Jedes Bild wird im Browser neu gezeichnet und als JPEG neu geschrieben. Dabei fällt alles weg, was die
// Kamera hineingeschrieben hat: EXIF samt Aufnahmeort (GPS), Kameramodell, Uhrzeit, Vorschaubild. Die
// Ausrichtung wird vorher angewendet (imageOrientation), damit nichts auf dem Kopf steht. Die Funktion
// `unternehmen` prüft danach noch einmal (kein APP1/EXIF, ≤ 5 MB) — wer an dieser Seite vorbei hochlädt,
// wird dort abgelehnt.

export const MAX_BYTES = 5 * 1024 * 1024;
const LANGE_SEITE = 2048;

export async function fotoVorbereiten(datei) {
  if (!datei || typeof datei.size !== 'number') return { ok: false, grund: 'kein_bild' };
  if (datei.size > MAX_BYTES) return { ok: false, grund: 'zu_gross' };
  if (datei.type && !/^image\//.test(datei.type)) return { ok: false, grund: 'kein_bild' };
  let bild;
  try {
    bild = await createImageBitmap(datei, { imageOrientation: 'from-image' });
  } catch {
    return { ok: false, grund: 'kaputt' };
  }
  const faktor = Math.min(1, LANGE_SEITE / Math.max(bild.width, bild.height));
  const breite = Math.max(1, Math.round(bild.width * faktor));
  const hoehe = Math.max(1, Math.round(bild.height * faktor));
  const flaeche = document.createElement('canvas');
  flaeche.width = breite;
  flaeche.height = hoehe;
  const ctx = flaeche.getContext('2d');
  ctx.fillStyle = '#ffffff';                 // Transparenz (PNG) wird weiß statt schwarz
  ctx.fillRect(0, 0, breite, hoehe);
  ctx.drawImage(bild, 0, 0, breite, hoehe);
  bild.close?.();
  let blob = null;
  for (const qualitaet of [0.86, 0.75, 0.6]) {
    blob = await new Promise((fertig) => flaeche.toBlob(fertig, 'image/jpeg', qualitaet));
    if (blob && blob.size <= MAX_BYTES) break;
  }
  if (!blob || blob.size > MAX_BYTES) return { ok: false, grund: 'zu_gross' };
  return { ok: true, blob, breite, hoehe };
}
