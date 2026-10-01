// Einladungsseite (V1-Kern §6) — der Datenweg. EIN Modul, zwei Wege, dieselbe Antwortform.
//
// Die Seite lädt NICHT die App. Sie braucht genau zwei Dinge vom Vertrag (web/data/repository.js):
//   ansehen(code) → wie repo.teilLinkAnsehen(code): { ok, art, von, meet?|tipp?, grund? } (zählt einen Aufruf)
//   klick(code)   → wie repo.teilLinkKlick(code):   { ok, grund? }                         („Bin dabei")
// Dazu kommen zwei Gründe, die es nur hier gibt, weil hier ein Netz dazwischen liegt:
//   grund:'offline'  keine Antwort (kein Netz, Zeitgrenze)      → „Keine Verbindung" + nochmal
//   grund:'fehler'   der Server antwortet, aber nicht mit Daten → „Hat nicht geklappt" + nochmal
//
// Welcher Weg gilt:
//   1. ?gateway=demo|supabase in der Adresse (derselbe Schalter wie in der App)
//   2. window.CREW_CONFIG.gateway (../config.js — vom Entwicklungsserver bzw. von deploy-pwa geschrieben)
//   3. sonst der Server. Anders als die App (Standard „demo") — ein geteilter Link ist immer ein
//      Ding auf dem Server; eine gemerkte Demo-Wahl dieses Browsers ändert daran nichts.
//
// Server: PostgREST direkt, OHNE die Supabase-Bibliothek (218 kB) — zwei POST-Anfragen brauchen sie
// nicht. Kopf nur `apikey` (Publishable Key, Hausregel 7); kein Authorization-Kopf, denn ein
// Publishable Key ist kein JWT. Körper `{ "p_code": "<CODE>" }`, Antwort ist das jsonb der Funktion.
// Demo: das Demo-Gateway derselben Herkunft (derselbe localStorage wie die App im selben Tab).

import { teilCodeNorm } from '../core/einladung.js';
// Adresse und Publishable Key stehen an EINER Stelle (core/server-adresse.js, ohne Importe) — dieselbe,
// die die App liest (data/gateway.js › supabaseConfig). Die Seite lädt dafür nicht die ganze Datenschicht.
import { serverAdresse } from '../core/server-adresse.js';

const ANSEHEN_WARTEN_MS = 10000;
const KLICK_WARTEN_MS = 2500;

export function serverZugang() {
  return serverAdresse();
}

export function einladungModus(ort = globalThis.location) {
  try {
    const wahl = new URLSearchParams(ort?.search || '').get('gateway');
    if (wahl === 'demo' || wahl === 'supabase') return wahl;
  } catch { /* Adresse unlesbar: dann gilt die Vorgabe */ }
  return globalThis.CREW_CONFIG?.gateway === 'demo' ? 'demo' : 'supabase';
}

// Der Code aus der Adresse (…/e/?c=KN7BRAND). Messenger hängen gern etwas an (fbclid, utm_…) —
// gelesen wird nur `c`. Kleinschreibung und Leerzeichen verzeiht teilCodeNorm.
export function codeAusAdresse(ort = globalThis.location) {
  try { return teilCodeNorm(new URLSearchParams(ort?.search || '').get('c') || ''); } catch { return ''; }
}

// Was der Vertrag verspricht, wird hier geprüft — eine halbe Antwort zeigt die Seite nicht als Meet.
function vorschauPruefen(antwort) {
  if (!antwort || typeof antwort !== 'object') return { ok: false, grund: 'fehler' };
  if (antwort.ok !== true) return { ok: false, grund: String(antwort.grund || 'unbekannt') };
  if (antwort.art === 'meet' && antwort.meet && typeof antwort.meet === 'object') return antwort;
  if (antwort.art === 'tipp' && antwort.tipp && typeof antwort.tipp === 'object') return antwort;
  return { ok: false, grund: 'unbekannt' };
}

async function rpc(name, code, { wartenMs, keepalive = false } = {}) {
  const { url, key } = serverZugang();
  const steuerung = new AbortController();
  const uhr = setTimeout(() => steuerung.abort(), wartenMs);
  try {
    const antwort = await fetch(`${url.replace(/\/+$/, '')}/rest/v1/rpc/${name}`, {
      method: 'POST',
      headers: { apikey: key, 'Content-Type': 'application/json', Accept: 'application/json' },
      body: JSON.stringify({ p_code: code }),
      // keepalive: „Bin dabei" führt sofort auf die nächste Seite — die Zählung soll trotzdem ankommen.
      keepalive,
      signal: steuerung.signal,
      cache: 'no-store',
      credentials: 'omit',
    });
    if (!antwort.ok) return { ok: false, grund: 'fehler', status: antwort.status };
    try { return await antwort.json(); } catch { return { ok: false, grund: 'fehler' }; }
  } catch {
    // Kein Netz, Zeitgrenze, abgebrochene Verbindung: für den Menschen dasselbe.
    return { ok: false, grund: 'offline' };
  } finally {
    clearTimeout(uhr);
  }
}

let demoRepo = null;
async function demoRepository() {
  if (!demoRepo) {
    const [{ DemoDataGateway }, { RulesEngine }] = await Promise.all([
      import('../data/demo-gateway.js'),
      import('../engine/suggestion-engine.js'),
    ]);
    demoRepo = new DemoDataGateway(new RulesEngine());
  }
  return demoRepo;
}

export function einladungDaten(modus = einladungModus()) {
  return {
    modus,
    async ansehen(roh) {
      const code = teilCodeNorm(roh);
      if (!code) return { ok: false, grund: 'unbekannt' };
      if (modus === 'demo') {
        try { return vorschauPruefen(await (await demoRepository()).teilLinkAnsehen(code)); } catch { return { ok: false, grund: 'fehler' }; }
      }
      return vorschauPruefen(await rpc('teil_link_ansehen', code, { wartenMs: ANSEHEN_WARTEN_MS }));
    },
    async klick(roh) {
      const code = teilCodeNorm(roh);
      if (!code) return { ok: false, grund: 'unbekannt' };
      if (modus === 'demo') {
        try { return await (await demoRepository()).teilLinkKlick(code); } catch { return { ok: false, grund: 'fehler' }; }
      }
      const antwort = await rpc('teil_link_klick', code, { wartenMs: KLICK_WARTEN_MS, keepalive: true });
      return antwort && typeof antwort === 'object' ? antwort : { ok: false, grund: 'fehler' };
    },
  };
}
