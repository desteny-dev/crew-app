// Runde 4 — fühlbare Rückmeldung für die Bausteine von Profil, Profilbild und Zeichenauswahl.
// Runde 6 (P3, A4) — und die Anmeldung des nativen Haptik-Plugins, ohne die es auf dem iPhone
// überhaupt keine Vibration gab.
//
// Es gibt dafür EINE Funktion in der App: rueckmeldung() in web/core/html.js (Capacitor Haptics in
// der nativen Hülle, sonst navigator.vibrate). Diese Datei ist die Übersetzung der Namen, die die
// Bausteine hier benutzen — so bleibt es bei einem Mechanismus.
//
//   haptik('tipp')        leichter Stoß: Kategorie, Tag, Symbol angetippt
//   haptik('auswahl')     feine Rastung: ein Wert springt weiter
//   haptik('grenze')      Anschlag: Zoom am Ende, Schließ-Schwelle erreicht (= feine Rastung)
//   haptik('erfolg')      gespeichert
//   haptik('schliessen')  ein Sheet wurde weggewischt
// Unbekannte Namen gehen unverändert an rueckmeldung().
//
// =====================================================================================
// Runde 6 (A4, Jonathan: „vibration und töne gehen noch nicht") — GEMESSENE URSACHE
// -------------------------------------------------------------------------------------
// rueckmeldung() sucht `Capacitor.Plugins.Haptics`. Dieses Objekt füllt NUR registerPlugin()
// aus @capacitor/core (node_modules/@capacitor/core/dist/index.js: `Plugins[pluginName] = proxy`).
// Crew ist eine Vanilla-App OHNE Bündler und lädt @capacitor/core nirgends — in der nativen Hülle
// liegt allein native-bridge.js im Fenster, und darin kommt `cap.Plugins` nur LESEND vor, es wird
// nie angelegt. Also war `Capacitor.Plugins.Haptics` immer undefiniert, rueckmeldung() fiel auf
// navigator.vibrate zurück — und das gibt es in WebKit (iPhone, Safari wie WKWebView) nicht.
// Ergebnis: auf dem iPhone passierte gar nichts, in keinem der beiden Gehäuse.
//
// DIE LÖSUNG hier: Wir melden das Plugin selbst an. Die Hülle schickt `Capacitor.PluginHeaders`
// mit (iOS: JSExport.swift, Android: JSExport.java) — daraus entsteht der Zugang aus genau den
// Methoden, die die Hülle wirklich kennt, jede über die bridge-eigene `nativePromise()`.
// Es bleibt bei EINEM Mechanismus: rueckmeldung() findet das Plugin danach ganz normal.
// =====================================================================================

import { rueckmeldung } from '../core/html.js';
// Runde 6 (Chef, F4): Die Anmeldung des Plugins steht jetzt EINMAL in der App — in core/native.js.
// Der Weg dorthin ist derselbe, den P3 gemessen hat (PluginHeaders + nativePromise); er gilt nur
// nicht mehr allein für Haptics, sondern für jedes Plugin, das wir je einbauen.
import { huellePlugin, huelleVergessen, istHuelle } from '../core/native.js';
import { istApple } from '../data/push.js';

const NAMEN = { grenze: 'auswahl' };

// Was wir vom Plugin brauchen; fehlt eine Methode in den Headern, bleibt sie weg (rueckmeldung()
// ruft jede ohnehin mit `?.` auf).
const HAPTIK_METHODEN = ['impact', 'notification', 'selectionStart', 'selectionChanged', 'selectionEnd', 'vibrate'];

// Meldet Capacitor.Plugins.Haptics an, wenn die native Hülle das Plugin mitbringt.
// Gibt den Zugang zurück oder null (Browser, oder Hülle ohne Haptik-Plugin).
export function haptikAnmelden() {
  return huellePlugin('Haptics', HAPTIK_METHODEN);
}

// Für Prüfungen und für den Neustart nach einer nachgebildeten Hülle.
haptikAnmelden.zuruecksetzen = () => huelleVergessen();

// Beim Laden: die Hülle spritzt native-bridge.js vor jedem Modul ein, also ist sie schon da.
// mitteilungen.js ruft es beim Start noch einmal — dann gilt es app-weit, auch für den
// FREE-Knopf, der rueckmeldung() direkt aus core/html.js benutzt.
haptikAnmelden();

// Was dieses Gerät wirklich kann — ohne Schätzen, aus den vorhandenen Schnittstellen.
//   weg 'haptik'    natives Plugin (iPhone- und Android-App): echte Haptik
//       'vibration' navigator.vibrate (Android-Browser, Android-Hülle): Vibration
//       'keine'     weder noch — im Safari auf dem iPhone gibt es navigator.vibrate nicht
export function haptikLage() {
  const nativ = istHuelle();
  const plugin = Boolean(haptikAnmelden());
  const vibrate = typeof globalThis.navigator?.vibrate === 'function';
  return {
    weg: plugin ? 'haptik' : vibrate ? 'vibration' : 'keine',
    nativ,
    plugin,
    vibrate,
    apple: istApple(),
  };
}

export function haptik(art = 'auswahl') {
  return rueckmeldung(NAMEN[art] || art);
}
