// Runde 4 — fühlbare Rückmeldung für die Bausteine von Profil, Profilbild und Zeichenauswahl.
//
// Es gibt dafür EINE Funktion in der App: rueckmeldung() in web/core/html.js (Capacitor Haptics in
// der nativen Hülle, sonst navigator.vibrate). Diese Datei ist nur die Übersetzung der Namen, die
// die Bausteine hier benutzen — so bleibt es bei einem Mechanismus.
//
//   haptik('tipp')        leichter Stoß: Kategorie, Tag, Symbol angetippt
//   haptik('auswahl')     feine Rastung: ein Wert springt weiter
//   haptik('grenze')      Anschlag: Zoom am Ende, Schließ-Schwelle erreicht (= feine Rastung)
//   haptik('erfolg')      gespeichert
//   haptik('schliessen')  ein Sheet wurde weggewischt
// Unbekannte Namen gehen unverändert an rueckmeldung().

import { rueckmeldung } from '../core/html.js';

const NAMEN = { grenze: 'auswahl' };

export function haptik(art = 'auswahl') {
  return rueckmeldung(NAMEN[art] || art);
}
