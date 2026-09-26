// Die Bedien-Zeichen der App. Gezeichnet werden sie in ui/symbole.js — hier stehen nur die
// Namen, unter denen die Screens sie kennen, und ihre Standardfarbe und -größe.
//
// Vorher war das ein eigener, zweiter Satz mit eigenen Strichstärken (1.8 bis 2.2) und
// eigenen Formen. Zwei Sätze nebeneinander heißt: derselbe Pfeil sieht an zwei Stellen
// verschieden aus, und niemand merkt es, weil beide für sich stimmig wirken.

import { symbol, symbolPfad } from './symbole.js';

// Einzelne Stellen brauchen einen kräftigeren Strich (ein Haken auf 15 px in einer grünen
// Scheibe verschwindet sonst). Die FORM bleibt dieselbe — nur die Strichstärke ändert sich.
function dicker(name, color, size, strich) {
  return `<svg width="${size}" height="${size}" viewBox="0 0 24 24" fill="none" style="flex:none;pointer-events:none">${symbolPfad(name, color).replaceAll('stroke-width="1.8"', `stroke-width="${strich}"`)}</svg>`;
}

export function backArrow(color = 'var(--ink)', size = 18) { return symbol('zurueck', color, size); }
export function chevronRight(color = 'var(--muted-light)', size = 16) { return symbol('vor', color, size); }
export function chevronDown(color = 'var(--ink)', size = 13) { return dicker('ab', color, size, 2.2); }
export function plus(color = 'var(--ink)', size = 16) { return symbol('plus', color, size); }
export function search(color = 'var(--muted)', size = 16) { return symbol('suchen', color, size); }
export function dots(color = 'var(--ink)', size = 17) { return symbol('punkte', color, size); }
export function pencil(color = 'var(--ink)', size = 15) { return symbol('stift', color, size); }
export function check(color = 'var(--on-accent)', size = 15, width = 2.4) { return dicker('haken', color, size, width); }
export function cross(color = 'var(--ink)', size = 14, width = 2.2) { return dicker('kreuz', color, size, width); }
export function listIcon(color = 'var(--ink)', size = 16) { return symbol('liste', color, size); }
export function mapIcon(color = 'var(--ink)', size = 16) { return symbol('karte', color, size); }
export function calendarIcon(color = 'var(--ink)', size = 16) { return symbol('kalender', color, size); }
export function upcomingIcon(color = 'var(--ink)', size = 16) { return symbol('kommend', color, size); }
export function historyIcon(color = 'var(--ink)', size = 16) { return symbol('verlauf', color, size); }
export function trash(color = 'var(--danger)', size = 16) { return symbol('papierkorb', color, size); }

// Weitere Zeichen, die es vorher nur als Einzelstück irgendwo im Bildschirm-Code gab.
export function eyeIcon(color = 'var(--muted)', size = 18, offen = true) { return symbol(offen ? 'auge' : 'augeZu', color, size); }
export function signOutIcon(color = 'var(--ink-soft)', size = 17) { return symbol('abmelden', color, size); }
export function personIcon(color = 'var(--ink)', size = 18) { return symbol('person', color, size); }
export function personPlusIcon(color = 'var(--ink)', size = 18) { return symbol('personPlus', color, size); }
export function groupIcon(color = 'var(--ink)', size = 18) { return symbol('gruppe', color, size); }
export function placeIcon(color = 'var(--ink)', size = 18) { return symbol('ort', color, size); }
export function cameraIcon(color = 'var(--ink)', size = 18) { return symbol('kamera', color, size); }
export function qrIcon(color = 'var(--ink)', size = 18) { return symbol('qr', color, size); }
export function shareIcon(color = 'var(--ink)', size = 18) { return symbol('teilen', color, size); }
