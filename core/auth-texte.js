// Die Fehlertexte von Supabase sind englisch und technisch. Hier stehen sie einmal auf
// Deutsch — für die Anmeldemaske UND für die Konto-Seite. Zwei Fassungen würden
// auseinanderlaufen, und dann hieße derselbe Fehler an zwei Stellen etwas anderes.

import { t as tx } from './sprache.js';

export function uebersetzeAuthFehler(text) {
  const t = String(text || '');
  if (/invalid login credentials/i.test(t)) return tx('E-Mail oder Passwort stimmt nicht');
  if (/email not confirmed/i.test(t)) return tx('Bestätige zuerst die E-Mail, die wir dir geschickt haben');
  if (/user already registered|already been registered/i.test(t)) return tx('Zu dieser E-Mail gibt es schon ein Konto — melde dich an');
  if (/email address .* is invalid|invalid email/i.test(t)) return tx('Diese E-Mail-Adresse sieht nicht richtig aus');
  // Runde 7 (J1): Der Code aus der Bestätigungsmail — vertippt, schon benutzt oder abgelaufen.
  if (/otp_expired|token has expired|expired or is invalid|invalid (otp|token)|(otp|token) is invalid/i.test(t)) {
    return tx('Der Code stimmt nicht oder ist abgelaufen. Lass dir einen neuen schicken.');
  }
  // Runde 7 (J1), GEMESSEN: Scheitert der Versand beim Absender, antwortet GoTrue mit
  // „Error sending confirmation email" / unexpected_failure. Das fiel bisher als englischer
  // Serverrohtext durch bis vor die Augen des Menschen.
  if (/error sending|unexpected_failure/i.test(t)) {
    return tx('Die E-Mail konnte gerade nicht verschickt werden. Das liegt an uns, nicht an dir — versuch es gleich noch einmal.');
  }
  // Die Stundengrenze des Absenders (rate_limit_email_sent). Sie ist unsere Grenze, kein
  // Fehlverhalten des Menschen — und sie steht VOR der allgemeinen Zeile, die sonst greift.
  if (/over_email_send_rate_limit|email rate limit/i.test(t)) {
    return tx('Gerade gehen sehr viele E-Mails von uns raus. In etwa einer Stunde geht es wieder — an dir liegt es nicht.');
  }
  if (/rate limit|too many requests/i.test(t)) return tx('Zu viele Versuche. Bitte später noch einmal.');
  if (/new password should be different/i.test(t)) return tx('Das ist dasselbe Passwort wie bisher');
  if (/password/i.test(t) && /least|short/i.test(t)) return tx('Das Passwort ist zu kurz');
  // „For security purposes, you can only request this after 47 seconds." — das ist die Sperre
  // zwischen zwei E-Mails (smtp_max_frequency, gemessen 60 s). Vorher stand hier „Einen Moment
  // noch"; niemand konnte wissen, worauf er wartet und wie lange.
  const sekunden = wartezeitAusFehler(t);
  if (sekunden) return tx('Die letzte E-Mail ist gerade erst rausgegangen. In {n} Sekunden können wir die nächste schicken.', { n: sekunden });
  if (/for security purposes/i.test(t)) return tx('Die letzte E-Mail ist gerade erst rausgegangen. Gleich können wir die nächste schicken.');
  if (/failed to fetch|network/i.test(t)) return tx('Keine Verbindung. Netz prüfen und noch einmal versuchen.');
  return t;
}

// Der Weg vom Link zurück in die Anmeldemaske. Der Datenweg (web/data/gateway.js) sieht den
// kaputten Link, die Anmeldemaske zeigt den Satz — dazwischen liegt ein Neuaufbau der Seite,
// deshalb ein Merker im Gerät. Er gilt für genau EINEN Blick: wer ihn liest, löscht ihn.
export const LINK_FEHLER_KEY = 'crew-link-fehler';

export function merkeLinkFehler(teile) {
  try { globalThis.sessionStorage?.setItem(LINK_FEHLER_KEY, JSON.stringify(teile || {})); } catch { /* privater Modus */ }
}

export function holeLinkFehler() {
  try {
    const roh = globalThis.sessionStorage?.getItem(LINK_FEHLER_KEY);
    if (!roh) return null;
    globalThis.sessionStorage.removeItem(LINK_FEHLER_KEY);
    return JSON.parse(roh);
  } catch {
    return null;
  }
}

// Wie lange die Sperre zwischen zwei E-Mails noch läuft (Sekunden, 0 = keine Angabe).
// Damit zeigt der „Keine E-Mail bekommen?"-Knopf die Zeit, die der Server WIRKLICH nennt,
// statt einer geratenen Minute.
export function wartezeitAusFehler(text) {
  const treffer = String(text || '').match(/(?:after|in)\s+([0-9]+)\s*second/i);
  return treffer ? Number(treffer[1]) : 0;
}

// Runde 7 (J1), GEMESSEN: Ein Bestätigungslink, der nicht mehr gilt, kommt als Anhang an der
// Adresse zurück (#error=access_denied&error_code=otp_expired&error_description=…). Bisher
// wurde er weggeworfen — der Mensch sah die nackte Anmeldemaske ohne ein Wort. Hier wird
// daraus ein Satz, der sagt, was los ist und was jetzt hilft.
export function uebersetzeLinkFehler({ fehler = '', code = '', beschreibung = '' } = {}) {
  const alles = `${code} ${fehler} ${decodeURIComponent(String(beschreibung).replace(/\+/g, ' '))}`;
  if (/expired/i.test(alles)) return tx('Der Link aus der E-Mail ist abgelaufen. Lass dir hier einen neuen schicken.');
  if (/access_denied|invalid|unauthorized/i.test(alles)) {
    return tx('Dieser Link gilt nicht mehr — er wurde schon benutzt oder ein neuerer hat ihn ersetzt. Lass dir hier einen neuen schicken.');
  }
  if (!alles.trim()) return '';
  const uebersetzt = uebersetzeAuthFehler(decodeURIComponent(String(beschreibung).replace(/\+/g, ' ')) || fehler || code);
  return uebersetzt || tx('Mit dem Link aus der E-Mail hat etwas nicht geklappt. Lass dir hier einen neuen schicken.');
}
