// Der Crew-Score-Ring (ALGORITHMUS §2.11) für die Website — ohne Importe.
//
// Form wie das Crew-Zeichen (scratch/entwuerfe/crew-score-skizze.html): ein Ring, der sich um den Punkt
// unten rechts füllt; die Zahl steht in der Mitte. Drei Stufen, je eine Farbe (Farben in ort.css):
//   70–79 gut · 80–89 sehr gut · 90–100 herausragend (goldener Punkt)
// „Neu“ = gestrichelter Ring ohne Zahl. Unter 70 = grauer Ring (nur auf der Website, nie in der App).
// Paket G baut den Ring der App; wer ihn dort braucht, kann dieses Modul übernehmen (keine Abhängigkeiten).

export const STUFEN = Object.freeze({
  gut: 'gut',
  sehr_gut: 'sehr gut',
  herausragend: 'herausragend',
  unter_70: 'nicht unter den Empfehlungen',
  neu: 'Neu',
});

export function stufeVon(wert, neu = false) {
  if (neu) return 'neu';
  if (typeof wert !== 'number' || Number.isNaN(wert)) return null;
  if (wert >= 90) return 'herausragend';
  if (wert >= 80) return 'sehr_gut';
  if (wert >= 70) return 'gut';
  return 'unter_70';
}

let zaehler = 0;
const PUNKT_WINKEL = (Math.atan2(16, 17.5) * 180) / Math.PI; // Mitte (36,36) → Punkt (53.5,52)
const FREI = 40;                                               // um den Punkt bleibt der Ring offen
const SPANNE = 360 - 2 * FREI;

export function scoreRing({ wert = null, neu = false, groesse = 96, beschriftung = '' } = {}) {
  const stufe = stufeVon(wert, neu) || 'ohne';
  zaehler += 1;
  const maske = `ort-ring-luecke-${zaehler}`;
  const zahl = neu || typeof wert !== 'number' ? '' : String(Math.round(wert));
  const laenge = zahl ? ((SPANNE / 360) * 100 * Math.max(0, Math.min(100, wert))) / 100 : 0;
  const titel = beschriftung || (neu ? 'Neu — noch keine Bewertung' : zahl ? `Crew Score ${zahl} von 100` : 'Noch nicht bewertet');
  return `<svg class="ort-ring" data-stufe="${stufe}" data-role="score-ring" role="img" aria-label="${titel}" width="${groesse}" height="${groesse}" viewBox="0 0 72 72">
    <defs><mask id="${maske}" maskUnits="userSpaceOnUse" x="0" y="0" width="72" height="72"><rect width="72" height="72" fill="#fff"/><circle cx="53.5" cy="52" r="14" fill="#000"/></mask></defs>
    <g mask="url(#${maske})">
      <circle class="ort-ring-spur" cx="36" cy="36" r="24" fill="none" stroke-width="7"${zahl ? '' : ' stroke-dasharray="3 5"'}/>
      ${zahl ? `<circle class="ort-ring-wert" cx="36" cy="36" r="24" fill="none" stroke-width="7" stroke-linecap="round" pathLength="100" stroke-dasharray="${laenge.toFixed(2)} 100" transform="rotate(${(PUNKT_WINKEL + FREI).toFixed(2)} 36 36)"/>` : ''}
    </g>
    <circle class="ort-ring-punkt" cx="53.5" cy="52" r="9.5"/>
    ${zahl ? `<text class="ort-ring-zahl" x="35" y="36.5" text-anchor="middle" dominant-baseline="central">${zahl}</text>` : ''}
  </svg>`;
}
