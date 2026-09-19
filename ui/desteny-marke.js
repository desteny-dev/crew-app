// Desteny — Zeichen und Schriftzug (Runde 5, A1/A2).
//
// Jonathan: „Jetzt fühlt es sich an, als wäre es nur der Account von der App, aber Desteny spürt man
// nicht." Das Konto ist ein Desteny-Konto, Crew ist die App darin. Anmeldung (web/ui/auth-screen.js)
// und Konto-Seite (web/screens/profile.js) zeigen deshalb dasselbe Zeichen aus EINER Quelle.
//
// Zeichen: der Pfad aus web/icons/desteny-d.svg (viewBox 0 0 4000 4000, ohne Füllfarbe). Er steht hier
// inline, damit das Zeichen ohne Netz, ohne Laden und in jeder Größe scharf erscheint; die Farbe kommt
// vom Aufrufer (Standard currentColor) — hell und dunkel mit den Tokens der Seite.
//
// Schriftzug: web/icons/desteny-name.svg (liefert Chef). Er wird als Maske in currentColor gezeigt,
// sobald die Datei geladen ist. Fehlt sie, bleibt es beim Zeichen — kein leerer Platz, kein Bruch.

// Aus web/icons/desteny-d.svg, Pfad „4:5" (unverändert).
const D_PFAD = 'M3450,2000c0,991.05-207.15,1250-1000,1250H1000.472c-27.875,0-50.472-22.597-50.472-50.472v-399.057c0-27.875,22.597-50.472,50.472-50.472h1449.528c396.4,0,500-155.4,500-750s-103.6-750-500-750H1000.472c-27.875,0-50.472-22.597-50.472-50.472v-399.057c0-27.875,22.597-50.472,50.472-50.472h1449.528c792.85,0,1000,258.95,1000,1250Z';
// Eng um die Form (x 950–3450, y 750–3250): Die Größe meint das Zeichen selbst, nicht Leerraum.
const D_BOX = '950 750 2500 2500';

// Das Zeichen als SVG. size in px; farbe: CSS-Farbe oder Token (Standard currentColor).
export function destenyZeichen(size = 24, { farbe = 'currentColor', rolle = 'desteny-zeichen' } = {}) {
  return `<svg data-role="${rolle}" width="${size}" height="${size}" viewBox="${D_BOX}" aria-hidden="true" focusable="false" style="display:block;flex:none;overflow:visible"><path d="${D_PFAD}" style="fill:${farbe}"/></svg>`;
}

// Das Zeichen auf einer Kachel — wie ein App-Symbol für das Konto. Tinte als Fläche, Papier als Zeichen:
// hell dunkle Kachel, dunkel helle Kachel; beides ruhig, nie grell.
export function destenyKachel(size = 44, { rolle = 'desteny-kachel' } = {}) {
  const radius = Math.round(size * 0.28);
  return `<span data-role="${rolle}" aria-hidden="true" style="width:${size}px;height:${size}px;border-radius:${radius}px;background:var(--ink);color:var(--paper);display:flex;align-items:center;justify-content:center;flex:none;box-shadow:inset 0 0 0 1px var(--ink-a08)">${destenyZeichen(Math.round(size * 0.46))}</span>`;
}

// --- Schriftzug ------------------------------------------------------------------------------------
const NAME_ADRESSE = new URL('../icons/desteny-name.svg', import.meta.url).href;
const schriftzug = { stand: 'offen', verhaeltnis: 0, warten: null };

// Lädt den Schriftzug einmal. → Promise<boolean> (true, wenn die Datei da und lesbar ist).
export function destenyNameLaden() {
  if (schriftzug.warten) return schriftzug.warten;
  schriftzug.warten = (typeof fetch === 'function' ? fetch(NAME_ADRESSE, { cache: 'force-cache' }) : Promise.reject(new Error('kein fetch')))
    .then((antwort) => (antwort.ok ? antwort.text() : ''))
    .then((svg) => {
      const box = /viewBox\s*=\s*["']\s*[-\d.]+[\s,]+[-\d.]+[\s,]+([\d.]+)[\s,]+([\d.]+)/i.exec(svg || '');
      const breite = box ? Number(box[1]) : 0;
      const hoehe = box ? Number(box[2]) : 0;
      if (!/<svg[\s>]/i.test(svg || '') || !(breite > 0 && hoehe > 0)) { schriftzug.stand = 'fehlt'; return false; }
      schriftzug.stand = 'da';
      schriftzug.verhaeltnis = breite / hoehe;
      // Schon gezeichnete Platzhalter sofort füllen — ohne Neuzeichnen, damit kein Feld den Fokus verliert.
      if (typeof document !== 'undefined') {
        document.querySelectorAll('[data-role="desteny-name"][data-hoehe]').forEach((platz) => {
          platz.setAttribute('style', nameStil(Number(platz.dataset.hoehe)));
          platz.hidden = false;
        });
      }
      return true;
    })
    .catch(() => { schriftzug.stand = 'fehlt'; return false; });
  return schriftzug.warten;
}

function nameStil(hoehe) {
  const breite = Math.round(hoehe * schriftzug.verhaeltnis * 10) / 10;
  // Einfache Anführungszeichen: der Stil steht auch in einem style="…"-Attribut (destenyName).
  const maske = `url('${NAME_ADRESSE}') center / contain no-repeat`;
  return `display:block;flex:none;width:${breite}px;height:${hoehe}px;background:currentColor;-webkit-mask:${maske};mask:${maske}`;
}

// Der Schriftzug „DESTENY" in currentColor, hoehe in px. Solange er (noch) nicht geladen ist, steht ein
// versteckter Platzhalter da, der sich beim Laden selbst füllt.
export function destenyName(hoehe = 12) {
  if (schriftzug.stand === 'da') return `<span data-role="desteny-name" data-hoehe="${hoehe}" aria-hidden="true" style="${nameStil(hoehe)}"></span>`;
  return `<span data-role="desteny-name" data-hoehe="${hoehe}" aria-hidden="true" hidden></span>`;
}

export function destenyNameDa() {
  return schriftzug.stand === 'da';
}
