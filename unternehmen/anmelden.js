// Anmelden auf der Ortsseite (Paket H) — mit DEMSELBEN Bildschirm wie die App (web/ui/auth-screen.js):
// E-Mail + Passwort, Konto erstellen samt Code aus der Mail, Passwort vergessen, und Apple/Google genau dann,
// wenn web/core/anmelde-wege.js sie einschaltet. Kein zweiter Anmeldeweg, der auseinanderlaufen könnte.
// Er liegt als Ebene über der Seite; „Zurück“ bringt ohne Anmeldung zur Ortsseite.

import { renderAuthScreen, renderNeuesPasswortScreen } from '../ui/auth-screen.js';
import { anmeldung } from './daten.js';

const MERKER = 'crew.unternehmen.ort';

function ebene() {
  const wurzel = document.createElement('div');
  wurzel.className = 'ort-anmelden';
  wurzel.dataset.role = 'ort-anmelden';
  const zu = document.createElement('button');
  zu.type = 'button';
  zu.className = 'ort-anmelden-zu';
  zu.dataset.role = 'ort-anmelden-zu';
  zu.textContent = '‹ Zurück zum Ort';
  document.body.append(wurzel, zu);
  const weg = () => { wurzel.remove(); zu.remove(); };
  return { wurzel, zu, weg };
}

// → Promise<Sitzung | null>
export async function anmelden({ ort } = {}) {
  const client = await anmeldung();
  return new Promise((fertig) => {
    const { wurzel, zu, weg } = ebene();
    const merken = () => { try { if (ort) globalThis.localStorage?.setItem(MERKER, ort); } catch { /* egal */ } };
    zu.onclick = () => { weg(); fertig(null); };
    renderAuthScreen(wurzel, {
      client,
      onSignedIn: (sitzung) => { weg(); fertig(sitzung); },
      onDemo: () => {},   // Die Demo gibt es nur in der App — hier bleibt das lange Drücken wirkungslos.
      // Apple/Google verlassen die Seite; der Rückweg landet auf ort.html — der Ort steht dann im Merker.
      anmeldenMit: async (anbieter) => {
        merken();
        const wege = await import('../core/anmelde-wege.js');
        return wege.anmeldenMit(client, anbieter);
      },
    });
    // Konto erstellen: der Link in der Bestätigungsmail führt auf ort.html zurück (ohne ?ort=) → Merker.
    merken();
  });
}

// Nach dem Link aus „Passwort vergessen“: zuerst ein neues Passwort (wie in der App).
export async function neuesPasswort() {
  const client = await anmeldung();
  return new Promise((fertig) => {
    const { wurzel, zu, weg } = ebene();
    zu.hidden = true;
    renderNeuesPasswortScreen(wurzel, { client, onFertig: () => { weg(); fertig(true); } });
  });
}
