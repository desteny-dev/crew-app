// Datenweg der Ortsseite (Paket H) — immer der Server, nie Demo-Daten.
//
// Warum kein Demo-Weg wie in der App: Diese Seite ist öffentlich und sagt über einen ECHTEN Betrieb etwas
// aus (Crew Score, sichtbar ja/nein). Beispielwerte an einem echten Namen wären erfundene Angaben
// (Hausregel 8). Ohne Server sagt die Seite ehrlich „keine Verbindung“.
//
//   ortSeite(ort)          öffentlich, ohne Anmeldung: PostgREST direkt (keine Bibliothek, wie web/e/daten.js)
//   anmeldung()            Supabase-Client (web/vendor/supabase.js) mit DERSELBEN Ablage wie die App ('crew-auth'):
//                          wer in der App angemeldet ist, ist es hier auch — ein Crew-Konto, nicht zwei.
//   rpc(name, args)        Funktionen der Datenbank mit dem Ausweis des Menschen
//   funktion(aktion, …)    die Funktion `unternehmen` (Beanspruchen, Fotos, geschlossen)

import { serverAdresse } from '../core/server-adresse.js';

const WARTEN_MS = 12000;

export async function ortSeite(ort) {
  const { url, key } = serverAdresse();
  const steuerung = new AbortController();
  const uhr = setTimeout(() => steuerung.abort(), WARTEN_MS);
  try {
    const a = await fetch(`${url.replace(/\/+$/, '')}/rest/v1/rpc/ort_seite`, {
      method: 'POST',
      headers: { apikey: key, 'Content-Type': 'application/json', Accept: 'application/json' },
      body: JSON.stringify({ p_ort: ort }),
      signal: steuerung.signal,
      cache: 'no-store',
      credentials: 'omit',
    });
    if (!a.ok) return { ok: false, grund: 'fehler' };
    const d = await a.json();
    return d && typeof d === 'object' ? d : { ok: false, grund: 'fehler' };
  } catch {
    return { ok: false, grund: 'offline' };
  } finally {
    clearTimeout(uhr);
  }
}

let bibliothek = null;
function bibliothekLaden() {
  if (globalThis.supabase?.createClient) return Promise.resolve(globalThis.supabase);
  if (bibliothek) return bibliothek;
  bibliothek = new Promise((fertig, fehler) => {
    const s = document.createElement('script');
    s.src = new URL('../vendor/supabase.js', import.meta.url).href;
    s.onload = () => fertig(globalThis.supabase);
    s.onerror = () => fehler(new Error('Supabase-Bibliothek nicht ladbar'));
    document.head.appendChild(s);
  });
  return bibliothek;
}

let client = null;
export async function anmeldung() {
  if (client) return client;
  const lib = await bibliothekLaden();
  const { url, key } = serverAdresse();
  client = lib.createClient(url, key, {
    auth: { persistSession: true, autoRefreshToken: true, detectSessionInUrl: false, storageKey: 'crew-auth' },
  });
  await linkEinloesen(client);
  return client;
}

// Links aus Crew-Mails (Konto bestätigen) und der Rückweg von Apple/Google bringen die Sitzung in der Adresse
// mit. Einmal einlösen, dann aus der Adresszeile nehmen (kein Schlüssel im Verlauf).
let wiederherstellung = false;
export const kamAusPasswortMail = () => wiederherstellung;

async function linkEinloesen(c) {
  const ort = globalThis.location;
  const anhang = new URLSearchParams(String(ort.hash || '').replace(/^#/, ''));
  const suche = new URLSearchParams(ort.search || '');
  const zugang = anhang.get('access_token');
  const erneuerung = anhang.get('refresh_token');
  const code = suche.get('code');
  const typ = anhang.get('type') || suche.get('type') || '';
  if (!(zugang && erneuerung) && !code) return;
  try {
    const { error } = zugang && erneuerung
      ? await c.auth.setSession({ access_token: zugang, refresh_token: erneuerung })
      : await c.auth.exchangeCodeForSession(code);
    wiederherstellung = !error && typ === 'recovery';
  } catch { /* abgelaufen: dann eben die Anmeldung */ }
  suche.delete('code');
  suche.delete('type');
  const rest = suche.toString();
  globalThis.history?.replaceState?.(null, '', `${ort.pathname}${rest ? `?${rest}` : ''}`);
}

export async function sitzung() {
  const c = await anmeldung();
  const { data } = await c.auth.getSession();
  return data?.session || null;
}

export async function abmelden() {
  const c = await anmeldung();
  await c.auth.signOut().catch(() => {});
}

// Die Uhr des Datenteils kann in der ersten Sekunde nach dem Anmelden einen Hauch zurückliegen
// („JWT issued at future“, wie in web/data/gateway.js) — kurz warten, noch einmal.
export async function rpc(name, args) {
  const c = await anmeldung();
  for (let v = 0; v < 4; v += 1) {
    try {
      const { data, error } = await c.rpc(name, args);
      if (!error) return data;
      if (!/issued at future/i.test(error.message || '') || v === 3) return { ok: false, grund: 'fehler', text: error.message };
    } catch {
      return { ok: false, grund: 'offline' };
    }
    await new Promise((w) => setTimeout(w, 700 * (v + 1)));
  }
  return { ok: false, grund: 'fehler' };
}

export async function funktion(aktion, koerper = {}) {
  const s = await sitzung();
  if (!s) return { ok: false, grund: 'anmelden' };
  const { url, key } = serverAdresse();
  try {
    const a = await fetch(`${url.replace(/\/+$/, '')}/functions/v1/unternehmen`, {
      method: 'POST',
      headers: { apikey: key, Authorization: `Bearer ${s.access_token}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({ aktion, ...koerper }),
    });
    const d = await a.json().catch(() => null);
    return d && typeof d === 'object' ? d : { ok: false, grund: 'fehler' };
  } catch {
    return { ok: false, grund: 'offline' };
  }
}

// Ein Foto in den privaten Eingang laden (nur der Inhaber darf in seinen Ordner — Regel in 0062).
export async function fotoHochladen(schluessel, blob) {
  const c = await anmeldung();
  const id = globalThis.crypto.randomUUID();
  const pfad = `${schluessel}/${id}.jpg`;
  const { error } = await c.storage.from('unternehmen-eingang').upload(pfad, blob, { contentType: 'image/jpeg', upsert: false });
  return error ? { ok: false, grund: 'hochladen', text: error.message } : { ok: true, pfad, id };
}

// Vorschau der eigenen, noch nicht geprüften Fotos (nur der Inhaber; Links gelten 1 Stunde).
export async function vorschauLinks(pfade) {
  if (!pfade.length) return {};
  const c = await anmeldung();
  const { data } = await c.storage.from('unternehmen-eingang').createSignedUrls(pfade, 3600);
  return Object.fromEntries((data || []).filter((d) => d.signedUrl).map((d) => [d.path, d.signedUrl]));
}
