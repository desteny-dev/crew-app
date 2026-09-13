// EIN Symbolkatalog für die ganze App.
//
// Vorher gab es drei: ui/icons.js (Bedienung), ui/activity-icons.js (Aktivitäten) und eine
// sechs Zeilen lange Liste in screens/profile.js (Ressourcen). Sie hatten verschiedene
// Strichstärken (1.6 / 1.7 / 1.8 / 2.2), verschiedene Farbwege und teilweise dasselbe Zeichen
// für verschiedene Dinge. Für Ressourcen gab es überhaupt nur sechs Muster — „PC" bekam
// deshalb den allgemeinen Anhänger (Auftrag §6.2).
//
// DIE REGELN DIESES SATZES (sie gelten für jedes Zeichen, ohne Ausnahme):
//   Feld            24 × 24, Zeichnung in 2…22 — überall derselbe optische Rand
//   Strich          1.8, runde Enden, runde Ecken
//   Füllung         nur für Punkte unter 1,4 Einheiten (Augen, Würfelpunkte, Knöpfe)
//   Farbe           ausschließlich über COL; nie ein Farbwert im Pfad
//   Ecken           Radien 2 / 2.6 / 3.4 — je größer die Fläche, desto größer der Radius
//   Doppelte        gibt es nicht: Gym und Yoga sind zwei Zeichen, Fußball und Volleyball auch
//
// Die drei alten Module bleiben als dünne Weiterleitung bestehen, damit kein Screen
// umgeschrieben werden muss und es trotzdem nur noch EINE Quelle gibt.

const S = 'stroke="COL" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"';
const SR = 'stroke="COL" stroke-width="1.8"';           // Rechtecke/Kreise ohne Kappen
const F = 'fill="COL"';

export const SYMBOLE = {
  // ===========================================================================
  // BEDIENUNG — alles, was die App selbst braucht
  // ===========================================================================
  // Runde 2 (Jonathan: „die Pfeile sind nicht in der Mitte"): Die Winkel lagen einen Punkt
  // neben der Mitte des 24er-Feldes (zurück 7,5–14,5 statt symmetrisch um 12). In einem
  // runden Knopf sieht man genau diesen einen Punkt. Jetzt liegt jede Spitze samt Armen
  // mittig: 8,5–15,5.
  zurueck: `<path d="M15.5 5 8.5 12l7 7" ${S}></path>`,
  vor: `<path d="M8.5 5l7 7-7 7" ${S}></path>`,
  auf: `<path d="M5 15.5 12 8.5l7 7" ${S}></path>`,
  ab: `<path d="M5 8.5 12 15.5l7-7" ${S}></path>`,
  plus: `<path d="M12 4.5v15M4.5 12h15" ${S}></path>`,
  minus: `<path d="M4.5 12h15" ${S}></path>`,
  kreuz: `<path d="m6 6 12 12M18 6 6 18" ${S}></path>`,
  haken: `<path d="m5 12.5 4.8 4.8L19 6.8" ${S}></path>`,
  suchen: `<circle cx="10.6" cy="10.6" r="6.4" ${SR}></circle><path d="m15.4 15.4 4.4 4.4" ${S}></path>`,
  punkte: `<circle cx="5" cy="12" r="1.7" ${F}></circle><circle cx="12" cy="12" r="1.7" ${F}></circle><circle cx="19" cy="12" r="1.7" ${F}></circle>`,
  stift: `<path d="M4 20.2 4.9 16 16.4 4.5a2.2 2.2 0 0 1 3.1 3.1L8 19.1 4 20.2Z" ${S}></path><path d="m14.6 6.3 3.1 3.1" ${S}></path>`,
  papierkorb: `<path d="M4.5 6.5h15M9.6 6V4.6c0-.6.5-1.1 1.1-1.1h2.6c.6 0 1.1.5 1.1 1.1V6" ${S}></path><path d="M6.8 6.5 7.7 19a1.8 1.8 0 0 0 1.8 1.7h5a1.8 1.8 0 0 0 1.8-1.7l.9-12.5" ${S}></path><path d="M10 10.4v6M14 10.4v6" ${S}></path>`,
  liste: `<path d="M8.5 6h11M8.5 12h11M8.5 18h11" ${S}></path><circle cx="4.4" cy="6" r="1.3" ${F}></circle><circle cx="4.4" cy="12" r="1.3" ${F}></circle><circle cx="4.4" cy="18" r="1.3" ${F}></circle>`,
  karte: `<path d="M9.2 3.8 3.5 5.9v14.3l5.7-2.1 5.6 2.1 5.7-2.1V3.8l-5.7 2.1-5.6-2.1Z" ${S}></path><path d="M9.2 3.8v14.3M14.8 5.9v14.3" ${S}></path>`,
  kalender: `<rect x="3.4" y="5" width="17.2" height="15.6" rx="3.4" ${SR}></rect><path d="M3.4 9.8h17.2M8.2 2.8v3.6M15.8 2.8v3.6" ${S}></path>`,
  kommend: `<path d="M4 12h13.4M12.6 6.6 18 12l-5.4 5.4" ${S}></path>`,
  verlauf: `<path d="M4.6 5.2v4.2h4.2" ${S}></path><path d="M5.5 9.4A8 8 0 1 1 4 12" ${S}></path><path d="M12 7.6v4.6l3.2 1.9" ${S}></path>`,
  kamera: `<path d="M3.4 9.2A2.6 2.6 0 0 1 6 6.6h1.6L8.9 4.4c.3-.5.9-.8 1.5-.8h3.2c.6 0 1.2.3 1.5.8l1.3 2.2H18a2.6 2.6 0 0 1 2.6 2.6v8.2A2.6 2.6 0 0 1 18 20H6a2.6 2.6 0 0 1-2.6-2.6V9.2Z" ${S}></path><circle cx="12" cy="13" r="3.4" ${SR}></circle>`,
  auge: `<path d="M2.6 12S6.2 5.6 12 5.6 21.4 12 21.4 12 17.8 18.4 12 18.4 2.6 12 2.6 12Z" ${S}></path><circle cx="12" cy="12" r="3.1" ${SR}></circle>`,
  augeZu: `<path d="M2.6 12S6.2 5.6 12 5.6 21.4 12 21.4 12 17.8 18.4 12 18.4 2.6 12 2.6 12Z" ${S}></path><circle cx="12" cy="12" r="3.1" ${SR}></circle><path d="m4 20 16-16" ${S}></path>`,
  abmelden: `<path d="M14.4 4.4H7.2A2.4 2.4 0 0 0 4.8 6.8v10.4a2.4 2.4 0 0 0 2.4 2.4h7.2" ${S}></path><path d="M19.2 12H10M15.8 8.6 19.2 12l-3.4 3.4" ${S}></path>`,
  schloss: `<rect x="4.6" y="10.4" width="14.8" height="9.8" rx="3" ${SR}></rect><path d="M8.2 10.4V7.8a3.8 3.8 0 0 1 7.6 0v2.6" ${S}></path>`,
  glocke: `<path d="M6.4 10.4a5.6 5.6 0 0 1 11.2 0c0 4 1.4 5.4 1.4 5.4H5s1.4-1.4 1.4-5.4Z" ${S}></path><path d="M10.2 19a2 2 0 0 0 3.6 0" ${S}></path>`,
  teilen: `<circle cx="17.8" cy="5.8" r="2.8" ${SR}></circle><circle cx="6.2" cy="12" r="2.8" ${SR}></circle><circle cx="17.8" cy="18.2" r="2.8" ${SR}></circle><path d="m8.7 10.7 6.6-3.6M8.7 13.3l6.6 3.6" ${S}></path>`,
  qr: `<rect x="3.6" y="3.6" width="6.4" height="6.4" rx="2" ${SR}></rect><rect x="14" y="3.6" width="6.4" height="6.4" rx="2" ${SR}></rect><rect x="3.6" y="14" width="6.4" height="6.4" rx="2" ${SR}></rect><path d="M14 14h3.2v3.2H14zM20.4 17.2v3.2h-3.2" ${S}></path>`,
  person: `<circle cx="12" cy="8.4" r="3.8" ${SR}></circle><path d="M4.8 20.2a7.2 7.2 0 0 1 14.4 0" ${S}></path>`,
  personPlus: `<circle cx="9.6" cy="8.4" r="3.6" ${SR}></circle><path d="M3.4 20.2a6.2 6.2 0 0 1 12.4 0" ${S}></path><path d="M19 8.4v5.6M16.2 11.2h5.6" ${S}></path>`,
  gruppe: `<circle cx="8.6" cy="8.8" r="3.4" ${SR}></circle><circle cx="16.6" cy="10.2" r="2.6" ${SR}></circle><path d="M3 19.8a5.6 5.6 0 0 1 11.2 0M15.6 15.4a5 5 0 0 1 5.4 4.2" ${S}></path>`,
  ort: `<path d="M12 21s7-5.8 7-11a7 7 0 1 0-14 0c0 5.2 7 11 7 11Z" ${S}></path><circle cx="12" cy="10" r="2.8" ${SR}></circle>`,
  info: `<circle cx="12" cy="12" r="8.6" ${SR}></circle><path d="M12 11v5.4M12 7.6v.9" ${S}></path>`,
  // Runde 2 — die Höhen des Kartenreglers, von nah bis ganz weit weg.
  // Angesehen: Die erste Fassung (zwei Bögen) las sich bei 20 px wie ein Haken. Jetzt ein
  // Vogel mit Körper, Flügel, Schnabel und Auge.
  vogel: `<path d="M3.6 13.4c2.4 0 4.4-1 6-3 1.4-1.8 3.2-2.8 5.4-2.8 1.8 0 3.2.9 4 2.4l1.8.6-1.8.8c-.4 3.4-3.2 6-6.8 6H9.2L5.4 19.6l.9-3.4c-1.4-.6-2.4-1.6-2.7-2.8Z" ${S}></path><path d="M9.4 13.6c1.8.2 3.4-.5 4.8-2" ${S}></path><circle cx="16.4" cy="9.8" r=".9" ${F}></circle>`,
  helikopter: `<path d="M4 4.4h16M12 4.4v3" ${S}></path><path d="M5.2 12.2c0-2.7 2.3-4.8 5.4-4.8h3.6c2.1 0 3.8 1.6 3.8 3.6v1.5c0 1.6-1.3 2.9-2.9 2.9H8.6c-1.9 0-3.4-1.4-3.4-3.2Z" ${S}></path><path d="M18 12h3.4M21.4 10.2v3.6M8.2 19h8.6M9.8 15.4V19M15 15.4V19" ${S}></path>`,
  flugzeug: `<path d="M12 2.8c.9 0 1.5.8 1.5 1.9v5.4l7.3 4.2v2.1l-7.3-2.3v4.1l2.2 1.7v1.7L12 20.6l-3.7 1v-1.7l2.2-1.7v-4.1l-7.3 2.3v-2.1l7.3-4.2V4.7c0-1.1.6-1.9 1.5-1.9Z" ${S}></path>`,
  satellit: `<rect x="9.4" y="9.4" width="5.2" height="5.2" rx="1.2" ${SR}></rect><rect x="2.4" y="8.6" width="5.2" height="6.8" rx="1" ${SR}></rect><rect x="16.4" y="8.6" width="5.2" height="6.8" rx="1" ${SR}></rect><path d="M7.6 12h1.8M14.6 12h1.8M12 9.4V6.2" ${S}></path><circle cx="12" cy="4.8" r="1.2" ${F}></circle>`,
  rakete: `<path d="M12 2.8c3.2 2.4 4.8 6 4.8 10.2v3.4H7.2V13c0-4.2 1.6-7.8 4.8-10.2Z" ${S}></path><circle cx="12" cy="10" r="1.8" ${SR}></circle><path d="M7.2 13.4 4.4 16.2v3.2l2.8-1.6M16.8 13.4l2.8 2.8v3.2l-2.8-1.6M10.2 18.8c.3 1.2.9 2 1.8 2.6.9-.6 1.5-1.4 1.8-2.6" ${S}></path>`,

  // ===========================================================================
  // AKTIVITÄTEN — was man miteinander macht
  // ===========================================================================
  wellen: `<path d="M2.4 9.2c1.8-1.7 3.4-1.7 5.2 0s3.4 1.7 5.2 0 3.4-1.7 5.2 0 3.4 1.7 4 .6M2.4 15.6c1.8-1.7 3.4-1.7 5.2 0s3.4 1.7 5.2 0 3.4-1.7 5.2 0 3.4 1.7 4 .6" ${S}></path>`,
  schwimmen: `<circle cx="16.6" cy="6.4" r="2.2" ${SR}></circle><path d="M3.6 11.4 8.8 7.2l4.4 3.6" ${S}></path><path d="M2.4 17.4c1.8-1.7 3.4-1.7 5.2 0s3.4 1.7 5.2 0 3.4-1.7 5.2 0 3.4 1.7 3.6.3" ${S}></path>`,
  wandern: `<path d="M8.2 21V15l-2-1.6 1.4-5.2 3.4-1 2.6 2.4 2.6.8" ${S}></path><circle cx="10.6" cy="4.6" r="2.1" ${SR}></circle><path d="M11.4 15.2 14 21M17.8 6.6V21" ${S}></path>`,
  berg: `<path d="m8 4.2 4.3 8.2L17 7.8 22 20.8H2L8 4.2Z" ${S}></path>`,
  schnee: `<path d="M12 2.8v18.4M4.2 7.4l15.6 9M4.2 16.6l15.6-9M9.6 5 12 7.4 14.4 5M9.6 19 12 16.6l2.4 2.4" ${S}></path>`,
  rad: `<circle cx="5.6" cy="16.4" r="3.9" ${SR}></circle><circle cx="18.4" cy="16.4" r="3.9" ${SR}></circle><path d="M5.6 16.4 9.6 8.8l2.2 7.6M9.6 8.8h6M15.6 8.8l2.8 7.6" ${S}></path><path d="M15.6 8.8 16.6 6.2M15.2 6.2h2.8M8.2 7.8h2.8" ${S}></path>`,
  hantel: `<path d="M2.8 10v4M6.2 7.6v8.8M17.8 7.6v8.8M21.2 10v4M6.2 12h11.6" ${S}></path>`,
  yoga: `<circle cx="12" cy="4.4" r="2.1" ${SR}></circle><path d="M12 8v5.2M12 13.2 7.4 20M12 13.2 16.6 20" ${S}></path><path d="M4.4 9.4 12 11.2l7.6-1.8" ${S}></path>`,
  fussball: `<circle cx="12" cy="12" r="8.6" ${SR}></circle><path d="m12 7.4 3.6 2.6-1.4 4.3H9.8L8.4 10 12 7.4Z" ${S}></path><path d="M12 3.4v4M4.6 9.4 8.4 10M19.4 9.4 15.6 10M8.5 18.6l1.3-4.3M15.5 18.6l-1.3-4.3" ${S}></path>`,
  volleyball: `<circle cx="12" cy="12" r="8.6" ${SR}></circle><path d="M12 3.4c-3 3.6-3.4 11.6 0 17.2M4.2 9.4c4.4 1.6 11.4.6 15.4-3.2M4.8 16.4c4.2-2.6 11.6-2 15 1.8" ${S}></path>`,
  sonne: `<circle cx="12" cy="12" r="3.8" ${SR}></circle><path d="M12 3.2v2.6M12 18.2v2.6M5.6 5.6l1.9 1.9M16.5 16.5l1.9 1.9M3.2 12h2.6M18.2 12h2.6M5.6 18.4l1.9-1.9M16.5 7.5l1.9-1.9" ${S}></path>`,
  zelt: `<path d="M12 3.6 2.8 20.4h18.4L12 3.6Z" ${S}></path><path d="M12 3.6v16.8M8.4 20.4 12 13.6l3.6 6.8" ${S}></path>`,
  gabel: `<path d="M5.6 3v5.4a2 2 0 0 0 4 0V3M7.6 10.4V21" ${S}></path><path d="M18.4 3c-1.6 1.2-2.4 3.2-2.4 5.6 0 1.7.9 2.8 2.4 3V21" ${S}></path>`,
  pizza: `<path d="M12 20.6 4.2 6.8a16.2 16.2 0 0 1 15.6 0L12 20.6Z" ${S}></path><circle cx="10" cy="10" r="1.2" ${F}></circle><circle cx="14" cy="12.4" r="1.2" ${F}></circle><circle cx="10.8" cy="14.6" r="1.2" ${F}></circle>`,
  grill: `<path d="M4.2 8.2h15.6a7.8 7.8 0 0 1-15.6 0Z" ${S}></path><path d="M8.4 15.2 6.2 20.6M15.6 15.2l2.2 5.4M12 15.8v4.8" ${S}></path>`,
  tasse: `<path d="M4.2 6.4h12v6.8a5.2 5.2 0 0 1-10.4 0" ${S}></path><path d="M4.2 6.4v6.8M16.2 8.4h2.4a2.2 2.2 0 0 1 0 4.4h-2.4M5.6 20.2h9.2" ${S}></path>`,
  glas: `<path d="M6.6 3.4h10.8l-1.4 15.2a2 2 0 0 1-2 1.8h-4a2 2 0 0 1-2-1.8L6.6 3.4Z" ${S}></path><path d="M7.4 10.4h9.2" ${S}></path>`,
  feiern: `<path d="M4.4 20 8.6 8.2l7.2 7.2L4.4 20Z" ${S}></path><path d="M14.6 5.4l.6 1.8M19 6.6l-1.5 1.4M19.6 12l-2 .5" ${S}></path><circle cx="13.4" cy="3.4" r="1.1" ${F}></circle><circle cx="20.6" cy="9" r="1.1" ${F}></circle>`,
  wuerfel: `<rect x="3.6" y="3.6" width="16.8" height="16.8" rx="3.4" ${SR}></rect><circle cx="8.6" cy="8.6" r="1.3" ${F}></circle><circle cx="15.4" cy="8.6" r="1.3" ${F}></circle><circle cx="12" cy="12" r="1.3" ${F}></circle><circle cx="8.6" cy="15.4" r="1.3" ${F}></circle><circle cx="15.4" cy="15.4" r="1.3" ${F}></circle>`,
  karten: `<rect x="3.4" y="4.6" width="10.4" height="14.4" rx="2.6" ${SR}></rect><path d="m8.6 8.6 2 2-2 2-2-2 2-2Z" ${F}></path><path d="M15.2 6.4 19.4 7.6 16.6 18.4l-2.8-.8" ${S}></path>`,
  gamepad: `<rect x="2.6" y="7.2" width="18.8" height="10.6" rx="5.3" ${SR}></rect><path d="M7.6 10.6v3.6M5.8 12.4h3.6" ${S}></path><circle cx="15.8" cy="11.4" r="1.2" ${F}></circle><circle cx="18.2" cy="13.8" r="1.2" ${F}></circle>`,
  sofa: `<path d="M5 11V8.4A2.6 2.6 0 0 1 7.6 5.8h8.8A2.6 2.6 0 0 1 19 8.4V11" ${S}></path><path d="M2.8 13.6A1.6 1.6 0 0 1 4.4 12h15.2a1.6 1.6 0 0 1 1.6 1.6v4.6H2.8v-4.6Z" ${S}></path><path d="M5 18.2v2M19 18.2v2" ${S}></path>`,
  haus: `<path d="M3.2 11 12 3.6 20.8 11" ${S}></path><path d="M5.4 9.6v10.8h13.2V9.6M9.8 20.4v-5.2h4.4v5.2" ${S}></path>`,
  buch: `<path d="M3.8 5.4A2.6 2.6 0 0 1 6.4 2.8h13.8v15.6H6.4a2.6 2.6 0 0 0-2.6 2.6V5.4Z" ${S}></path><path d="M3.8 18.4A2.6 2.6 0 0 1 6.4 15.8h13.8" ${S}></path>`,
  film: `<rect x="2.8" y="3.6" width="18.4" height="16.8" rx="3.4" ${SR}></rect><path d="M7.6 3.6v16.8M16.4 3.6v16.8M2.8 8.2h4.8M2.8 15.8h4.8M16.4 8.2h4.8M16.4 15.8h4.8" ${SR}></path>`,
  note: `<path d="M9 17.6V5.2l10-2v12" ${S}></path><ellipse cx="6.4" cy="17.8" rx="2.6" ry="2.3" ${SR}></ellipse><ellipse cx="16.4" cy="15.6" rx="2.6" ry="2.3" ${SR}></ellipse>`,
  ticket: `<path d="M3.2 9.2a2.2 2.2 0 0 1 2.2-2.2h13.2a2.2 2.2 0 0 1 2.2 2.2v1.2a1.8 1.8 0 0 0 0 3.2v1.2a2.2 2.2 0 0 1-2.2 2.2H5.4a2.2 2.2 0 0 1-2.2-2.2v-1.2a1.8 1.8 0 0 0 0-3.2V9.2Z" ${S}></path><path d="M14.4 8.4v1.4M14.4 11.3v1.4M14.4 14.2v1.4" ${S}></path>`,
  museum: `<path d="M3.2 9.4 12 3.8l8.8 5.6" ${S}></path><path d="M5.4 9.4v8.4M9.8 9.4v8.4M14.2 9.4v8.4M18.6 9.4v8.4M3.4 20.4h17.2" ${S}></path>`,
  tasche: `<path d="M4.6 8.4h14.8l-1 11.6a1.8 1.8 0 0 1-1.8 1.6H7.4a1.8 1.8 0 0 1-1.8-1.6l-1-11.6Z" ${S}></path><path d="M8.8 8.4V6.6a3.2 3.2 0 0 1 6.4 0v1.8" ${S}></path>`,
  uhr: `<circle cx="12" cy="12" r="8.6" ${SR}></circle><path d="M12 6.8V12l3.4 2" ${S}></path>`,
  funkeln: `<path d="M12 2.6 14 8.4l5.8 2-5.8 2-2 5.8-2-5.8-5.8-2 5.8-2 2-5.8Z" ${S}></path><path d="M18.6 16.6v4M16.6 18.6h4" ${S}></path>`,

  // ===========================================================================
  // RESSOURCEN — die Dinge, die Menschen wirklich teilen (Auftrag §6.2)
  // ===========================================================================
  auto: `<path d="M4.6 11.4 6.3 6.6a2.2 2.2 0 0 1 2.1-1.5h7.2c.9 0 1.8.6 2.1 1.5l1.7 4.8" ${S}></path><path d="M4.6 11.4h14.8M4.6 11.4a2 2 0 0 0-2 2v4h3M19.4 11.4a2 2 0 0 1 2 2v4h-3" ${S}></path><path d="M5.6 17.4v1.6M18.4 17.4v1.6M7 14.4h2M15 14.4h2" ${S}></path>`,
  anhaenger: `<rect x="3" y="7.4" width="14.4" height="7.8" rx="2" ${SR}></rect><path d="M17.4 11.2h2.2l1.6 2.4v1.6h-3.8" ${S}></path><circle cx="8" cy="17.8" r="2.2" ${SR}></circle><circle cx="16.6" cy="17.8" r="2.2" ${SR}></circle><path d="M3 15.2v2.6H5.8M10.2 17.8h4.2" ${S}></path>`,
  bollerwagen: `<path d="M3.4 7.6h15.2l-1.6 7.4H5.6L3.4 7.6Z" ${S}></path><circle cx="8" cy="18.4" r="2" ${SR}></circle><circle cx="15.4" cy="18.4" r="2" ${SR}></circle><path d="M18.6 7.6 21 4.6M6.6 16.4h3M13.6 16.4h1.4" ${S}></path>`,
  motorrad: `<circle cx="4.8" cy="17.2" r="3" ${SR}></circle><circle cx="19.2" cy="17.2" r="3" ${SR}></circle><rect x="8.6" y="12.6" width="6.4" height="3.6" rx="1.4" ${SR}></rect><path d="M4.8 17.2h3.8M15 14.4l1.8 2.8M8.6 12.6 7.2 10h3.8M15 12.6l-1.4-3.4h-1.4M12.2 9.2h5M17.2 9.2l1-2" ${S}></path>`,
  boot: `<path d="M3 16.6h18l-2.2 4H5.2L3 16.6Z" ${S}></path><path d="M12 16.6V3.4l6.4 7.2H12" ${S}></path><path d="M11 16.6V8.2L6 16.6" ${S}></path>`,
  kanu: `<path d="M2.6 12.4c4 5 14.8 5 18.8 0" ${S}></path><path d="M2.6 12.4c4-2 14.8-2 18.8 0" ${S}></path><path d="M6.6 4.6 17 10.4M15.6 3 18.8 4.8l-1.4 2.4" ${S}></path>`,
  surfbrett: `<path d="M12 2.8c4.4 3.6 6.4 9.6 5 14.6-.6 2.2-2.6 3.8-5 3.8s-4.4-1.6-5-3.8c-1.4-5 .6-11 5-14.6Z" ${S}></path><path d="M12 7v10" ${S}></path>`,
  ski: `<path d="M5 20.4 15.4 5.4c.9-1.5 2.3-2 3.7-1.4" ${S}></path><path d="M19 20.4 8.6 5.4C7.7 3.9 6.3 3.4 4.9 4" ${S}></path><path d="m8.6 15.4 2.8 2M15.4 15.4l-2.8 2" ${S}></path>`,
  snowboard: `<path d="M8.4 2.8c4.2 3 7 9 6.4 14.4-.3 2.4-2 3.9-4.2 3.9-2.6 0-4.6-2-4.6-5 0-5 .6-9.6 2.4-13.3Z" ${S}></path><path d="M7.6 9.2h5.4M7.2 14h6" ${S}></path>`,
  schlitten: `<path d="M4.4 6.4h12.4a2.4 2.4 0 0 1 2.4 2.4v1.6H4.4V6.4Z" ${S}></path><path d="M6.4 10.4v5.2M17 10.4v5.2M3 18.4h17.4a1.6 1.6 0 0 0 0-3.2H3" ${S}></path>`,
  kuehlbox: `<rect x="3.4" y="8.4" width="17.2" height="10.8" rx="2.6" ${SR}></rect><path d="M3.4 12.6h17.2M9 8.4V6.6a2.2 2.2 0 0 1 2.2-2.2h1.6A2.2 2.2 0 0 1 15 6.6v1.8M6.6 19.2v1.4M17.4 19.2v1.4" ${S}></path>`,
  thermoskanne: `<path d="M8.4 3.4h7.2v3.4l1.4 2.2v10a2 2 0 0 1-2 2H9a2 2 0 0 1-2-2v-10l1.4-2.2V3.4Z" ${S}></path><path d="M7 12.4h10" ${S}></path>`,
  picknickkorb: `<path d="M3 9.4h18l-1.4 9.4a2 2 0 0 1-2 1.8H6.4a2 2 0 0 1-2-1.8L3 9.4Z" ${S}></path><path d="M7.6 9.4a4.4 4.4 0 0 1 8.8 0M3.8 13.6h16.4" ${S}></path>`,
  sonnenschirm: `<path d="M2.6 11.4a9.4 9.4 0 0 1 18.8 0c-2.4-1.8-4.2-1.8-6.2 0-1.6-1.8-3.2-1.8-6.4 0-2-1.8-3.8-1.8-6.2 0Z" ${S}></path><path d="M12 11.4V20M12 20a2.2 2.2 0 0 0 3.4 1" ${S}></path>`,
  pavillon: `<path d="M12 2.8 2.8 9.4h18.4L12 2.8Z" ${S}></path><path d="M4.6 9.4v11.2M19.4 9.4v11.2M4.6 12.4c2.4 2 4.6 2 6 0 1.4 2 3.6 2 6 0 1 1.4 2 1.8 2.8 1.2" ${S}></path>`,
  campingstuhl: `<path d="M5.4 3.8 9 13.6h6l3.6-9.8" ${S}></path><path d="M7.4 9h9.2M9 13.6 6.2 20.4M15 13.6l2.8 6.8" ${S}></path>`,
  haengematte: `<path d="M4 4.4v15.2M20 4.4v15.2" ${S}></path><path d="M4 9.6c4.6 6.4 11.4 6.4 16 0" ${S}></path><path d="M6.4 11.6v2.2M9.4 13.8V16M14.6 13.8V16M17.6 11.6v2.2" ${S}></path>`,
  schlafsack: `<rect x="7.4" y="2.8" width="9.2" height="18.4" rx="4.6" ${SR}></rect><path d="M4.8 8.4h14.4M4.8 15.6h14.4" ${S}></path>`,
  beamer: `<rect x="2.8" y="7.8" width="18.4" height="9" rx="2.6" ${SR}></rect><circle cx="15.6" cy="12.3" r="2.6" ${SR}></circle><path d="M6.2 12.3h4M6.6 16.8v2.2M17.4 16.8v2.2" ${S}></path>`,
  leinwand: `<path d="M3.4 3.6h17.2" ${S}></path><rect x="5" y="3.6" width="14" height="11.4" rx="1.4" ${SR}></rect><path d="M12 15v3.6M8.6 20.4h6.8" ${S}></path>`,
  lautsprecher: `<rect x="5.4" y="2.8" width="13.2" height="18.4" rx="3" ${SR}></rect><circle cx="12" cy="14.6" r="3.6" ${SR}></circle><circle cx="12" cy="7" r="1.5" ${SR}></circle>`,
  mikrofon: `<rect x="9" y="2.8" width="6" height="11" rx="3" ${SR}></rect><path d="M5.6 11.6a6.4 6.4 0 0 0 12.8 0M12 18v3.2M9 21.2h6" ${S}></path>`,
  kopfhoerer: `<path d="M4.4 15.4v-3.2a7.6 7.6 0 0 1 15.2 0v3.2" ${S}></path><rect x="2.6" y="13.8" width="4.4" height="7" rx="2.2" ${SR}></rect><rect x="17" y="13.8" width="4.4" height="7" rx="2.2" ${SR}></rect>`,
  plattenspieler: `<rect x="2.8" y="5.4" width="18.4" height="13.2" rx="2.6" ${SR}></rect><circle cx="10" cy="12" r="4.6" ${SR}></circle><circle cx="10" cy="12" r="1.1" ${F}></circle><path d="M17.6 8.6v4.2l-2.4 2.6" ${S}></path>`,
  gitarre: `<circle cx="9" cy="16" r="5.2" ${SR}></circle><circle cx="9" cy="16" r="1.8" ${SR}></circle><path d="m12.8 12.2 6-6M17 4.4l2.6 2.6M18.4 3l2.6 2.6" ${S}></path>`,
  klavier: `<rect x="2.8" y="6.4" width="18.4" height="11.2" rx="2.2" ${SR}></rect><path d="M2.8 12.6h18.4M7.2 6.4v6.2M11.6 6.4v6.2M16 6.4v6.2" ${S}></path>`,
  drohne: `<rect x="9" y="9.4" width="6" height="5.2" rx="1.8" ${SR}></rect><circle cx="4.8" cy="6.6" r="2.6" ${SR}></circle><circle cx="19.2" cy="6.6" r="2.6" ${SR}></circle><circle cx="4.8" cy="17.4" r="2.6" ${SR}></circle><circle cx="19.2" cy="17.4" r="2.6" ${SR}></circle><path d="m6.6 8.4 2.6 1.6M17.4 8.4 14.8 10M6.6 15.6l2.6-1.6M17.4 15.6 14.8 14" ${S}></path>`,
  stativ: `<circle cx="12" cy="4.6" r="1.9" ${SR}></circle><path d="M12 6.5v5.2M12 11.7 5.4 20.6M12 11.7l6.6 8.9M7.6 16.4h8.8" ${S}></path>`,
  pc: `<rect x="3" y="3.4" width="7.2" height="17.2" rx="2.2" ${SR}></rect><path d="M5.6 7.2h2M5.6 10h2" ${S}></path><rect x="12.6" y="6" width="8.4" height="6.8" rx="1.8" ${SR}></rect><path d="M16.8 12.8v3.6M14.2 16.4h5.2" ${S}></path>`,
  laptop: `<rect x="4" y="4.6" width="16" height="10.6" rx="2.2" ${SR}></rect><path d="M2 18.6h20a2 2 0 0 0 0-.2l-1-3.2H3l-1 3.4Z" ${S}></path>`,
  monitor: `<rect x="2.6" y="4" width="18.8" height="12.4" rx="2.6" ${SR}></rect><path d="M12 16.4V20M8.2 20h7.6" ${S}></path>`,
  tablet: `<rect x="5" y="2.6" width="14" height="18.8" rx="3" ${SR}></rect><circle cx="12" cy="18.4" r="1.1" ${F}></circle>`,
  drucker: `<path d="M6.6 8.4V3.6h10.8v4.8" ${S}></path><rect x="2.8" y="8.4" width="18.4" height="8" rx="2.4" ${SR}></rect><path d="M6.6 13.6h10.8v6.8H6.6v-6.8Z" ${S}></path><circle cx="18.2" cy="11.4" r="1" ${F}></circle>`,
  vrbrille: `<path d="M3 9.4a2.6 2.6 0 0 1 2.6-2.6h12.8A2.6 2.6 0 0 1 21 9.4v4.4a2.6 2.6 0 0 1-2.6 2.6h-2.2l-1.6-2h-5.2l-1.6 2H5.6A2.6 2.6 0 0 1 3 13.8V9.4Z" ${S}></path><path d="M8 10.6h1.6M14.4 10.6H16" ${S}></path>`,
  dart: `<circle cx="12" cy="12" r="8.6" ${SR}></circle><circle cx="12" cy="12" r="4.4" ${SR}></circle><circle cx="12" cy="12" r="1.2" ${F}></circle><path d="m15 9 5.6-5.6M18.6 3.2h2.4v2.4" ${S}></path>`,
  tischtennis: `<circle cx="9.4" cy="9.4" r="5.8" ${SR}></circle><path d="m13.6 13.6 5 5a2 2 0 0 1-2.8 2.8l-5-5" ${S}></path><circle cx="18.6" cy="7.4" r="2.2" ${SR}></circle>`,
  bohrmaschine: `<path d="M3.4 8.4h9.2v5.2H3.4a1.4 1.4 0 0 1-1.4-1.4V9.8a1.4 1.4 0 0 1 1.4-1.4Z" ${S}></path><path d="M12.6 9.8h4.6l4 1.2-4 1.2h-4.6" ${S}></path><path d="M6.4 13.6v4a2 2 0 0 0 2 2h1.4" ${S}></path>`,
  werkzeug: `<path d="M14.6 2.8a5 5 0 0 0-1.2 9.8L4 22l-1.4-1.4 9.4-9.4a5 5 0 0 0 6.2-6.6l-2.8 2.8-2.6-.6-.6-2.6 2.4-2.4Z" ${S}></path>`,
  leiter: `<path d="M7.4 2.8v18.4M16.6 2.8v18.4" ${S}></path><path d="M7.4 6.6h9.2M7.4 10.4h9.2M7.4 14.2h9.2M7.4 18h9.2" ${S}></path>`,
  rasenmaeher: `<path d="M2.8 16.4h10.4l1.6-6h6.4v6" ${S}></path><circle cx="6" cy="18.6" r="2.2" ${SR}></circle><circle cx="17.4" cy="18.6" r="2.2" ${SR}></circle><path d="M8.2 18.6h6.8M13.2 10.4 16 4.6h4" ${S}></path>`,
  schubkarre: `<path d="M3 6.4h3l3.4 8.4h9L21 8.2H7.6" ${S}></path><circle cx="9" cy="18.6" r="2.2" ${SR}></circle><path d="M18.4 14.8 20.8 19M11.2 18.6h6.8" ${S}></path>`,
  koffer: `<rect x="2.8" y="7" width="18.4" height="12.6" rx="2.6" ${SR}></rect><path d="M8.4 7V5.2A1.8 1.8 0 0 1 10.2 3.4h3.6a1.8 1.8 0 0 1 1.8 1.8V7M8.4 11v5.4M15.6 11v5.4" ${S}></path>`,
  rucksack: `<path d="M5.4 10.2a6.6 6.6 0 0 1 13.2 0v8.4a2.6 2.6 0 0 1-2.6 2.6H8a2.6 2.6 0 0 1-2.6-2.6v-8.4Z" ${S}></path><path d="M9 10.2V6.6a3 3 0 0 1 6 0v3.6M9 14.6h6" ${S}></path>`,
  fernglas: `<rect x="2.6" y="9" width="6.4" height="11.4" rx="3.2" ${SR}></rect><rect x="15" y="9" width="6.4" height="11.4" rx="3.2" ${SR}></rect><path d="M9 13.4h6M5.8 9V5a1.6 1.6 0 0 1 3.2 0v4M15 9V5a1.6 1.6 0 0 1 3.2 0v4" ${S}></path>`,
  pool: `<path d="M4.4 10.4V5.6a2.2 2.2 0 0 1 4.4 0v4.8M15.2 10.4V5.6a2.2 2.2 0 0 1 4.4 0v4.8" ${S}></path><path d="M4.4 8h4.4M15.2 8h4.4" ${S}></path><path d="M2.4 14.4c1.8-1.6 3.4-1.6 5.2 0s3.4 1.6 5.2 0 3.4-1.6 5.2 0 3 1.5 3.6.6M2.4 19c1.8-1.6 3.4-1.6 5.2 0s3.4 1.6 5.2 0 3.4-1.6 5.2 0 3 1.5 3.6.6" ${S}></path>`,
  raclette: `<rect x="3.4" y="9.6" width="17.2" height="5.6" rx="2.2" ${SR}></rect><path d="M6.2 15.2v2.2M17.8 15.2v2.2M3.4 19.6h17.2" ${S}></path><path d="M8 6.2c0-1 .8-1.4.8-2.4M12 6.2c0-1 .8-1.4.8-2.4M16 6.2c0-1 .8-1.4.8-2.4" ${S}></path>`,
  anhaengerNeutral: `<path d="M4.5 4.5h6.6l8.4 8.4-6.6 6.6-8.4-8.4V4.5Z" ${S}></path><circle cx="8.6" cy="8.6" r="1.2" ${F}></circle>`,
};

export const SYMBOL_NAMEN = Object.keys(SYMBOLE);

// Ein Zeichen zeichnen. Größe und Farbe sind die EINZIGEN Stellschrauben — Strichstärke und
// Rundungen gehören zum Satz und werden nicht von außen verbogen.
export function symbol(name, color = 'var(--ink)', size = 18) {
  const pfad = SYMBOLE[name] || SYMBOLE.funkeln;
  return `<svg width="${size}" height="${size}" viewBox="0 0 24 24" fill="none" style="flex:none;pointer-events:none">${pfad.replaceAll('COL', color)}</svg>`;
}

// Rohe Pfade für Flächen, die ihr eigenes <svg> aufspannen.
export function symbolPfad(name, color = 'var(--ink)') {
  return (SYMBOLE[name] || SYMBOLE.funkeln).replaceAll('COL', color);
}
