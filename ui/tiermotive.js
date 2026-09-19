// Profilbild — Schnittstelle für die ganze App (Runde 2 eingeführt, Runde 3 umgebaut).
//
// Runde 3 (Jonathan): Hintergrund und Motiv sind getrennt wählbar, Motive gibt es in
// Kategorien (Tiere, Flaggen, Autos, Weltall, Schiffe, Flugzeuge). Der Baukasten selbst lebt
// in web/ui/profilbild.js (Zeichnen, Wörter) und web/ui/profilbild-baukasten.js (Oberfläche).
//
// Diese Datei bleibt, wie sie heißt: web/ui/components.js zeichnet über istMotiv und
// motivBildAdresse jedes gespeicherte Profilbild an jeder Stelle der App (bildVon). Beide
// Schreibweisen funktionieren darüber — die alte `motiv:fuchs:tanne` und die neue
// `motiv:m=fuchs;a=froh;g=see;v=nacht;r=ru;p=wellen`.

import { PB_FARBEN, PB_MOTIVE, profilbildAusToken, profilbildToken, leererZustand } from './profilbild.js';

export { istMotiv, motivBildAdresse } from './profilbild.js';

// Ältere Namen, weiter gültig (z. B. für scratch/r2-tiermotive-bogen.mjs).
export const MOTIV_FARBEN = PB_FARBEN;
export const MOTIVE = PB_MOTIVE;
export const MOTIV_NAMEN = Object.keys(PB_MOTIVE).filter((key) => !PB_MOTIVE[key].versteckt);

export function motivToken(motiv, farbe) {
  return profilbildToken({ ...leererZustand(), m: motiv, g: farbe });
}

export function motivAusToken(wert) {
  const z = profilbildAusToken(wert);
  return z ? { motiv: z.m, farbe: z.g } : null;
}

// Runde 2 ließ zu jedem Tier nur „passende" Farben zu. Seit Runde 3 trennt ein weicher Schatten
// jedes Motiv von jedem Grund — alle Farben passen.
export function passendeFarben() {
  return PB_FARBEN;
}
