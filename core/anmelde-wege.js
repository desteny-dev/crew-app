// Welche Anmeldewege es gibt (V1-Kern, Auftrag §8) — EINE Stelle für den Anmeldeschirm.
//
// Mail + Passwort gibt es immer. „Mit Apple" und „Mit Google" erscheinen NUR, wenn sie wirklich
// funktionieren (Hausregel 9: kein Knopf ohne Wirkung). Stand (siehe STAND.md):
//   · Apple:  eingerichtet — App ID at.desteny.crew, Services ID at.desteny.crew.anmeldung, Schlüssel
//             „Crew Sign In", Supabase-Anbieter „Apple" (scripts/apple-anmeldung.mjs, Geheimnis alle
//             6 Monate erneuern). Der Knopf bleibt trotzdem verborgen, bis ein MENSCH sich einmal echt mit
//             Apple angemeldet hat — das kann kein Prüflauf (Apple-ID nötig). Dafür gibt es den
//             Freischalt-Test: <Web-Adresse>?anmeldetest=apple zeigt den Knopf in DIESEM Tab. Klappt die
//             Anmeldung, wird EINGERICHTET.apple auf true gestellt. In der iPhone-App zusätzlich die
//             Brücke `CrewAppleAnmeldung` (ios/App/App), erst ab dem ersten iPhone-Bau.
//   · Google: OAuth-Client (Web + Android + iOS) in der Google Cloud Console, eingetragen im
//             Supabase-Anbieter „Google".
// Sobald ein Anbieter bestätigt ist, wird hier genau EIN Wert auf true gestellt.
//
// Prüfläufe dürfen die Knöpfe über window.CREW_CONFIG.anmeldeWege = { apple:true } sichtbar machen,
// um die Oberfläche zu prüfen — die Wirkung bleibt dieselbe (ohne Anbieter meldet Supabase einen Fehler,
// den der Schirm ehrlich zeigt).

import { istHuelle, plattform, huellePlugin } from './native.js';
import { MARKE } from './marke.js';

const EINGERICHTET = Object.freeze({
  apple: false,
  google: false,
});

// Der Freischalt-Test (siehe oben): ?anmeldetest=apple in der Adresse, gemerkt für diesen Tab — damit der
// Knopf auch nach dem Rückweg von Apple noch stimmt. Nur im Browser; die Hüllen bekommen ihn nicht.
function freischaltTest(anbieter) {
  if (istHuelle()) return false;
  try {
    const wert = new URLSearchParams(globalThis.location?.search || '').get('anmeldetest');
    if (wert) globalThis.sessionStorage?.setItem('crew.anmeldetest', wert);
    return globalThis.sessionStorage?.getItem('crew.anmeldetest') === anbieter;
  } catch {
    return false;
  }
}

export function anmeldeWege() {
  const test = globalThis.window?.CREW_CONFIG?.anmeldeWege || {};
  const apple = Boolean(test.apple ?? (EINGERICHTET.apple || freischaltTest('apple')));
  const google = Boolean(test.google ?? EINGERICHTET.google);
  const huelle = istHuelle();
  const ios = huelle && plattform() === 'ios';
  // Auf dem iPhone läuft „Mit Apple" nativ (Apple verlangt das Systemblatt); fehlt die Brücke in
  // einer älteren Fassung der App, bleibt der Knopf weg statt ins Leere zu führen.
  const appleNativFehlt = ios && !huellePlugin('CrewAppleAnmeldung', ['anmelden']);
  // In der Android-Hülle gäbe es nur die Weiterleitung IM WebView — Google verbietet OAuth in eingebetteten
  // WebViews („disallowed_useragent"), und für Apple ist der Weg dort ungeprüft. Bis es einen nativen Weg
  // (Custom Tabs + Rücksprung) gibt, stehen dort beide Knöpfe NICHT da.
  const androidHuelle = huelle && !ios;
  return {
    apple: {
      an: apple && !appleNativFehlt && !androidHuelle,
      warum: !apple ? 'wartet auf die erste echte Anmeldung (Freischalt-Test ?anmeldetest=apple)'
        : appleNativFehlt ? 'Brücke CrewAppleAnmeldung fehlt in dieser App-Fassung'
          : androidHuelle ? 'in der Android-App fehlt der native Weg' : '',
    },
    google: {
      an: google && !huelle,
      warum: !google ? 'wartet auf Einrichtung (OAuth-Client bei Google, Anbieter in Supabase)'
        : huelle ? 'in der App braucht Google einen nativen Weg (kein OAuth im WebView)' : '',
    },
  };
}

// Ein zufälliger Nonce (roh). Apple bekommt dessen SHA-256 (macht die Brücke), Supabase den rohen Wert.
function zufallsNonce() {
  const bytes = new Uint8Array(24);
  globalThis.crypto.getRandomValues(bytes);
  return [...bytes].map((b) => b.toString(16).padStart(2, '0')).join('');
}

/**
 * Mit Apple oder Google anmelden. → Promise<{ session?, weiterleitung?, abgebrochen?, error? }>
 *   · iPhone-App + Apple: Systemblatt (CrewAppleAnmeldung) → signInWithIdToken (mit Nonce).
 *   · Browser: Weiterleitung über Supabase (verlässt die Seite; zurück kommt man angemeldet).
 * Der Anmeldeschirm zeigt die Knöpfe nur, wenn anmeldeWege() sie einschaltet.
 */
export async function anmeldenMit(client, anbieter) {
  const weg = anmeldeWege()[anbieter];
  if (!client?.auth || !weg?.an) return { error: new Error(weg?.warum || 'nicht eingerichtet') };
  if (anbieter === 'apple' && istHuelle() && plattform() === 'ios') {
    const bruecke = huellePlugin('CrewAppleAnmeldung', ['anmelden']);
    const nonce = zufallsNonce();
    let antwort;
    try {
      antwort = await bruecke.anmelden({ nonce });
    } catch (fehler) {
      const code = String(fehler?.code || fehler?.message || '');
      return { abgebrochen: /abgebrochen|cancel/i.test(code), error: fehler };
    }
    if (!antwort?.identityToken) return { error: new Error('Apple hat kein Zeichen geliefert') };
    const { data, error } = await client.auth.signInWithIdToken({ provider: 'apple', token: antwort.identityToken, nonce });
    if (error) return { error };
    // Apple nennt den Namen nur beim allerersten Mal — dann ins Konto, sonst ist er für immer weg.
    const name = [antwort.vorname, antwort.nachname].filter(Boolean).join(' ').trim();
    if (name) await client.auth.updateUser({ data: { name } }).catch(() => {});
    return { session: data?.session || null };
  }
  const ort = globalThis.location;
  const redirectTo = istHuelle() || !ort ? MARKE.webAdresse : `${ort.origin}${ort.pathname}`;
  const { error } = await client.auth.signInWithOAuth({ provider: anbieter, options: { redirectTo } });
  return error ? { error } : { weiterleitung: true };
}
