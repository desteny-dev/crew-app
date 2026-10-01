// iPhone-Runde 1 (A4): Welche Fassung läuft hier? — an EINER Stelle.
//
// Jonathan meinte nach dem ersten TestFlight-Bau, auf dem iPhone sei „noch die alte Version". Nachsehen
// ließ sich das nicht: Nirgends in der App stand, welcher Stand in ihr steckt. Jetzt steht es im Profil
// ganz unten, klein: „v24 · Build 3" (App) bzw. „v24 · Web" (Browser).
//
//   WEB_FASSUNG   die Nummer des Web-Stands; web/sw.js trägt sie als VERSION `crew-v<Nummer>`.
//                 `npm run lint` bricht ab, wenn die beiden auseinanderlaufen (scripts/check-syntax.mjs).
//   Build         die Build-Nummer der App (CFBundleVersion bzw. versionCode). Die kennt nur die Hülle;
//                 iOS legt sie beim Start als `window.CREW_HUELLE` ins Fenster (CrewBridgeViewController).

export const WEB_FASSUNG = 26;

/** Was die Hülle über sich sagt — oder null im Browser (bzw. in einer Hülle, die es noch nicht sagt). */
export function huellenFassung() {
  const h = globalThis.CREW_HUELLE;
  if (!h || typeof h !== 'object') return null;
  const build = String(h.build ?? '').trim();
  const version = String(h.version ?? '').trim();
  return build || version ? { build, version } : null;
}

/** „v24 · Build 3" · „v24 · App" (Hülle ohne Angabe) · „v24 · Web". */
export function fassungsZeile({ inHuelle = false } = {}) {
  const h = huellenFassung();
  if (h?.build) return `v${WEB_FASSUNG} · Build ${h.build}`;
  return `v${WEB_FASSUNG} · ${inHuelle || h ? 'App' : 'Web'}`;
}
