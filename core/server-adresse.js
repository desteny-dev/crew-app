// Adresse und öffentlicher Schlüssel des Servers — EINE Stelle (V1-Kern).
//
// Hier stehen nur die zwei Werte, die laut SUPABASE.md für den Browser gedacht sind (Projekt-URL und
// Publishable Key, Hausregel 7). Geschützt wird ausschließlich durch die Regeln je Zeile (RLS).
// window.CREW_CONFIG (config.js) darf beide überschreiben — so laufen Prüfläufe gegen die Prüfwelt.
//
// Ohne Importe: Die App (data/gateway.js) und die Einladungsseite (web/e/daten.js) laden dieses Modul,
// ohne die ganze Datenschicht mitzunehmen.

export const SERVER_STANDARD = Object.freeze({
  url: 'https://wuflbpoalrhzynptcexa.supabase.co',
  key: 'sb_publishable_cS3jdDAwGWnXAYBjiruhhg_HnzmfsGi',
});

export function serverAdresse() {
  const config = globalThis.CREW_CONFIG || {};
  return { url: config.supabaseUrl || SERVER_STANDARD.url, key: config.supabaseKey || SERVER_STANDARD.key };
}
