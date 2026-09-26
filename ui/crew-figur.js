// Die Crew-Figur (Runde 11, C2/D7) — die Crew-Marke mit Augen.
//
// Jonathan: „Logo-Figur: zwei Punkte auf dem Ring als Augen, schauen beim Überlegen hin und her,
// Blinzeln = Oberkante des Punktes flacht kurz ab, kein Mund."
//
// Die Marke ist dieselbe wie beim Laden (ui/laden.js) und bei der Anmeldung (ui/auth-screen.js):
// Ring in Tinte, davor eine echte Lücke (Maske), der Punkt im Logo-Grün. Neu sind nur die zwei
// Augen im Ring. Sie tun genau zwei Dinge:
//   · blinzeln — die Oberkante der Punkte flacht kurz ab (ein Lid von oben, kein Zusammendrücken),
//     etwa alle fünf Sekunden;
//   · im Zustand 'denkt' schauen sie hin und her (Find › „Worauf hast du Lust?", während Crew die
//     passenden Tipps sucht).
// Kein Mund. Bewegt wird mit SMIL (<animate>) statt CSS: Das läuft auch INNERHALB von <clipPath>
// in jedem Browser (Safari malt CSS-Animationen in clipPath nicht neu). Wer weniger Bewegung
// eingestellt hat, bekommt die Figur ruhig: offene Augen, geradeaus.
//
// Kennungen (Maske, Lid) hängen an `rolle` — dieselbe Figur behält beim Neuzeichnen dieselben
// Kennungen, der Abgleich (core/html.js) fasst sie dann nicht an und die Bewegung läuft weiter.

function wenigBewegung() {
  try { return Boolean(globalThis.matchMedia?.('(prefers-reduced-motion: reduce)').matches); } catch { return false; }
}

const AUGE_Y = 31;
const AUGE_R = 3.4;
const LID_OFFEN = AUGE_Y - AUGE_R - 1.5;
// Wie weit das Lid kommt: knapp über die Mitte — die Oberkante ist dann flach, der Punkt halb.
const LID_ZU = AUGE_Y - 0.2;

// size: px. zustand: 'wach' (blinzelt) | 'denkt' (schaut hin und her, blinzelt). rolle: data-role
// und Grundlage der Kennungen.
export function crewFigur(size = 56, { zustand = 'wach', rolle = 'crew-figur' } = {}) {
  const kennung = String(rolle).replace(/[^a-z0-9-]/gi, '');
  const ruhig = wenigBewegung();
  const blinzeln = ruhig
    ? ''
    : `<animate attributeName="y" values="${LID_OFFEN};${LID_OFFEN};${LID_ZU};${LID_OFFEN}" keyTimes="0;0.95;0.975;1" dur="${zustand === 'denkt' ? '2.6s' : '5.2s'}" repeatCount="indefinite"/>`;
  const schauen = ruhig || zustand !== 'denkt'
    ? ''
    : '<animateTransform attributeName="transform" type="translate" values="0 0;-3.4 0.4;-3.4 0.4;3.4 0.4;3.4 0.4;0 0" keyTimes="0;0.16;0.42;0.58;0.84;1" dur="1.9s" repeatCount="indefinite"/>';
  return `<svg data-role="${kennung}" data-zustand="${zustand}" width="${size}" height="${size}" viewBox="2 2 68 68" aria-hidden="true" focusable="false" style="display:block;flex:none;overflow:visible">
<defs>
<mask id="${kennung}-luecke" maskUnits="userSpaceOnUse" x="0" y="0" width="72" height="72"><rect x="0" y="0" width="72" height="72" fill="#fff"/><circle cx="53.5" cy="52" r="11.5" fill="#000"/></mask>
<clipPath id="${kennung}-lid"><rect x="0" y="${LID_OFFEN}" width="72" height="30">${blinzeln}</rect></clipPath>
</defs>
<circle cx="36" cy="36" r="24" style="fill:none;stroke:var(--ink);stroke-width:7" mask="url(#${kennung}-luecke)"/>
<circle cx="53.5" cy="52" r="9.5" style="fill:var(--green)"/>
<g data-role="${kennung}-augen">${schauen}<g clip-path="url(#${kennung}-lid)"><circle cx="29.2" cy="${AUGE_Y}" r="${AUGE_R}" style="fill:var(--ink)"/><circle cx="42.8" cy="${AUGE_Y}" r="${AUGE_R}" style="fill:var(--ink)"/></g></g>
</svg>`;
}
