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
  if (/rate limit|too many requests/i.test(t)) return tx('Zu viele Versuche. Bitte später noch einmal.');
  if (/new password should be different/i.test(t)) return tx('Das ist dasselbe Passwort wie bisher');
  if (/password/i.test(t) && /least|short/i.test(t)) return tx('Das Passwort ist zu kurz');
  if (/for security purposes/i.test(t)) return tx('Einen Moment noch — kurz warten und noch einmal versuchen');
  if (/failed to fetch|network/i.test(t)) return tx('Keine Verbindung. Netz prüfen und noch einmal versuchen.');
  return t;
}
