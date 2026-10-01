// Der Stand für Widgets — die kleine gemeinsame Beschreibung (siehe WIDGETS.md §2).
//
// WARUM DAS HIER LIEGT UND NICHT IM WIDGET
// ---------------------------------------------------------------------------------------------
// Widgets sind der EINE Ort, an dem unser Code nicht mitkommt: iPhone-Widgets sind SwiftUI,
// Android-Widgets sind XML-Bausteine — Web ist auf beiden Systemen verboten. Damit wir trotzdem
// nicht zweimal dieselbe Logik schreiben (und zweimal dieselben Fehler machen), bleibt hier alles,
// was NICHT reine Darstellung ist: was drinsteht, woher es kommt, wie es heißt. Die beiden
// nativen Widgets holen nur noch diese Beschreibung und malen sie ab.
//
// Regeln, die dieses Format erzwingt:
//   · Das Widget rechnet nichts. Es bekommt fertige Namen, Farben und Zeitpunkte.
//   · Nichts Vertrauliches. Ein Widget liegt auf einem Sperrbildschirm, den auch Fremde sehen:
//     keine Adressen, keine Nachrichten, keine Standorte.
//   · Alles darf fehlen. Kein Meet, niemand frei, kein Netz — für jeden Fall gibt es einen Zustand.
//
// Prüfbar ohne Gerät: `node scripts/shot.mjs flow scratch/r6-widget.mjs` und in der laufenden App
// über `window.__crew.widget()`.

const HOECHSTENS_FREI = 5;      // mehr Gesichter passen in kein Widget; der Rest wird zu „+n"
export const WIDGET_FASSUNG = 1;

function zeitpunkt(wert) {
  if (!wert) return null;
  const zahl = typeof wert === 'number' ? wert : Date.parse(wert);
  return Number.isFinite(zahl) ? new Date(zahl).toISOString() : null;
}

// Beginn eines Meets als echter Zeitpunkt — das Widget soll nicht „19:00" von „morgen" trennen
// müssen, sondern nur noch die Differenz zu jetzt bilden.
function meetBeginn(meet) {
  if (!meet?.date) return null;
  const zeit = /^\d{2}:\d{2}$/.test(meet.time || '') ? meet.time : '00:00';
  const wert = Date.parse(`${meet.date}T${zeit}:00`);
  return Number.isFinite(wert) ? new Date(wert).toISOString() : null;
}

function person(eintrag) {
  return {
    id: eintrag.id,
    name: eintrag.name || '',
    kurz: eintrag.initials || (eintrag.name || '').slice(0, 2),
    farbe: eintrag.color || null,
    // Das Bild kommt als Adresse, nicht als Datenstrom: Ein Widget lädt selbst, was es braucht.
    bild: eintrag.photo || eintrag.avatar || null,
    ab: zeitpunkt(eintrag.free?.fromAt) || null,
  };
}

/**
 * Der ganze Stand für ein Widget. Nimmt das Repository, gibt ein einfaches Objekt.
 * Wirft nie: Ein Widget ohne Daten zeigt lieber „keine Verbindung" als gar nichts.
 */
export function widgetStand(repo, jetzt = Date.now()) {
  const leer = { stand: WIDGET_FASSUNG, am: jetzt, ich: { frei: false, ab: null, bis: null }, frei: [], freiGesamt: 0, meet: null };
  if (!repo) return leer;
  try {
    const settings = repo.getSettings?.() || {};
    const frei = settings.free || {};
    const ich = {
      frei: Boolean(frei.active) && !frei.pending,
      ab: frei.pending ? zeitpunkt(frei.fromAt) : null,
      bis: zeitpunkt(frei.until) || null,
    };

    // Wer sonst frei ist: erst die, die JETZT frei sind, dann die mit „frei ab".
    const leute = (repo.getPeople?.() || []).filter((p) => p?.free?.active);
    const sortiert = [...leute].sort((a, b) => {
      const aPending = a.free?.pending ? 1 : 0;
      const bPending = b.free?.pending ? 1 : 0;
      if (aPending !== bPending) return aPending - bPending;
      return (a.name || '').localeCompare(b.name || '');
    });

    // Das nächste Treffen, an dem ich wirklich teilnehme — abgesagte und Entwürfe zählen nicht.
    const meets = (repo.getMeets?.({ direction: 'upcoming' }) || [])
      .filter((m) => m && m.status !== 'draft' && m.participation?.['p-me'] !== 'no')
      .map((m) => ({ meet: m, beginn: meetBeginn(m) }))
      .filter((eintrag) => eintrag.beginn)
      .sort((a, b) => Date.parse(a.beginn) - Date.parse(b.beginn));
    const naechstes = meets.find((eintrag) => eintrag.meet.status === 'active')
      || meets.find((eintrag) => Date.parse(eintrag.beginn) >= jetzt - 2 * 3600 * 1000)
      || null;

    return {
      stand: WIDGET_FASSUNG,
      am: jetzt,
      ich,
      frei: sortiert.slice(0, HOECHSTENS_FREI).map(person),
      freiGesamt: sortiert.length,
      meet: naechstes ? {
        id: naechstes.meet.id,
        titel: naechstes.meet.title || '',
        beginn: naechstes.beginn,
        // Nur der NAME des Orts, nie die Adresse — siehe oben, Sperrbildschirm.
        ort: naechstes.meet.place?.name || '',
        dabei: Object.values(naechstes.meet.participation || {}).filter((z) => z === 'yes').length,
        laeuft: naechstes.meet.status === 'active',
      } : null,
    };
  } catch {
    return leer;
  }
}

// Wo der Stand liegt, bis es die native Brücke gibt: im Gerät, unter einem festen Schlüssel.
// Die native Hülle liest später denselben Inhalt aus der App Group (iPhone) bzw. aus
// SharedPreferences (Android) — das Format ist dasselbe, nur der Ort ändert sich.
export const WIDGET_SCHLUESSEL = 'crew.widget.stand';

let zuletzt = '';

/** Schreibt den Stand weg, wenn er sich geändert hat. Gibt true zurück, wenn geschrieben wurde. */
export function widgetStandMerken(repo, jetzt = Date.now()) {
  const stand = widgetStand(repo, jetzt);
  // `am` ändert sich bei jedem Aufruf — für den Vergleich bleibt es außen vor, sonst schriebe
  // die App bei jedem Render.
  const vergleich = JSON.stringify({ ...stand, am: 0 });
  if (vergleich === zuletzt) return false;
  zuletzt = vergleich;
  try { globalThis.localStorage?.setItem(WIDGET_SCHLUESSEL, JSON.stringify(stand)); } catch { /* privates Fenster */ }
  return true;
}

/** Nur für Prüfungen: den Vergleichsstand vergessen. */
export function widgetVergessen() { zuletzt = ''; }
