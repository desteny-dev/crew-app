// Runde 7, Welle 5 — der abgelegte Einladungscode, EINE Wahrheit (Regel 3).
// -------------------------------------------------------------------------------------
// Bis Welle 4 gab es denselben localStorage-Eintrag zweimal: web/app.js hielt eine eigene
// Kopie (EINLADUNG_ABLAGE, eigenes einladungLesen) und web/screens/profile.js eine zweite.
// Die zwei Lesarten liefen auseinander — gemessen: Der Einrichten-Schirm zeigte von zwei
// liegenden Codes nur einen, „Einladung annehmen" löste aber beide ein; und ein Eintrag, der
// einem anderen Konto gehörte, stand dort als annehmbar, obwohl app.js ihn still wegwarf.
// Jetzt lesen, schreiben und räumen BEIDE nur über dieses Modul.
//
// Ablage: localStorage['crew.einladung.offen'] = JSON.stringify({
//   code,        der aktive Code (der zuletzt angetippte Link)
//   am,          ms-Zeitstempel; älter als 30 Tage gilt als verfallen
//   versuche?,   wie oft das Einlösen schon scheiterte
//   konto?,      wer es versucht hat — gilt für 'code' und für jeden Text-Eintrag in 'weitere'
//   weitere?,    noch offene Codes: Text ODER { code, konto } mit eigenem Besitzer
// })
// localStorage und nicht sessionStorage: Wer sich anmeldet, verlässt den Browser für die
// Bestätigungsmail und kommt zurück — eine Sitzungsablage wäre dann leer.
//
// Besitzer: Ein Code, den schon ein ANDERES Konto auf diesem Gerät zu lösen versucht hat,
// gehört diesem anderen. Er wird für mich weder gezeigt noch eingelöst — beides fragt
// dieselbe Funktion (einladungCodesFuer), damit Schirm und Einlösen nie verschieden zählen.

export const EINLADUNG_SCHLUESSEL = 'crew.einladung.offen';
const EINLADUNG_FRIST_MS = 30 * 24 * 60 * 60 * 1000;
export const EINLADUNG_VERSUCHE = 3;
// Wie viele noch nicht eingelöste Codes höchstens warten dürfen. Mehr als eine Handvoll
// offener Einladungen gleichzeitig gibt es nicht; die Grenze hält die Ablage klein.
const EINLADUNG_WEITERE_MAX = 4;

// Wer gerade angemeldet ist, so wie der Einladungs-Eintrag ihn nennt. Im Beispielbestand
// gibt es keine Kennung — dort ist es immer dasselbe Gerätekonto.
export function einladungKonto(repo) {
  return String(repo?.myUid || 'demo');
}

export function einladungWeg() {
  try { globalThis.localStorage?.removeItem(EINLADUNG_SCHLUESSEL); } catch { /* privates Fenster */ }
}

function schreiben(eintrag) {
  try { globalThis.localStorage?.setItem(EINLADUNG_SCHLUESSEL, JSON.stringify(eintrag)); } catch { /* privates Fenster */ }
}

// Liefert { code, am, versuche, konto, weitere: [{ code, konto }] } oder null.
// Verfallen oder unlesbar heißt: beim Lesen weggeräumt.
export function einladungLesen() {
  let roh = null;
  try { roh = globalThis.localStorage?.getItem(EINLADUNG_SCHLUESSEL) || null; } catch { return null; }
  if (!roh) return null;
  let eintrag = null;
  // GEMESSEN (Welle 2): Ein kaputter Eintrag ('{kein json') überlebte jeden Start — was sich
  // nicht lesen lässt, ist keine Einladung und kommt weg.
  try { eintrag = JSON.parse(roh); } catch { einladungWeg(); return null; }
  const code = String(eintrag?.code || '').trim();
  const am = Number(eintrag?.am) || 0;
  // Ein Eintrag ohne Zeitstempel ist kein gültiger Eintrag, sonst wäre er unbegrenzt haltbar.
  if (!code || !am || Date.now() - am > EINLADUNG_FRIST_MS) { einladungWeg(); return null; }
  const konto = String(eintrag?.konto || '');
  const weitere = [];
  for (const wert of (Array.isArray(eintrag?.weitere) ? eintrag.weitere : [])) {
    const w = wert && typeof wert === 'object'
      ? { code: String(wert.code || '').trim(), konto: String(wert.konto || '') }
      : { code: String(wert || '').trim(), konto };
    if (w.code && w.code !== code && !weitere.some((x) => x.code === w.code)) weitere.push(w);
  }
  return { code, am, versuche: Number(eintrag?.versuche) || 0, konto, weitere: weitere.slice(0, EINLADUNG_WEITERE_MAX) };
}

// Die Codes, die DIESES Konto sehen und einlösen darf — der aktive zuerst. Der Einrichten-
// Schirm zeigt genau diese, und app.js löst genau diese ein.
export function einladungCodesFuer(eintrag, konto) {
  if (!eintrag) return [];
  const meins = (k) => !k || k === konto;
  return [{ code: eintrag.code, konto: eintrag.konto }, ...eintrag.weitere]
    .filter((c) => meins(c.konto))
    .map((c) => c.code);
}

// Ein neuer Link wird der AKTIVE Code (auf ihn hat der Mensch gerade getippt), der bisherige
// rückt in die Warteschlange — MIT seinem Besitzer. Welle 4 hatte hier {code, am, weitere}
// ohne 'konto' geschrieben: Ein Code, den ein anderes Konto liegen ließ, wurde danach für mich
// eingelöst (gemessen, r7d-pruef-bahn P1c). Der neue Code selbst gehört noch niemandem.
export function einladungAblegen(code) {
  const sauber = String(code || '').trim();
  if (!sauber) return;
  const alt = einladungLesen();
  const bisher = alt ? [{ code: alt.code, konto: alt.konto }, ...alt.weitere] : [];
  const weitere = bisher
    .filter((w, i, alle) => w.code !== sauber && alle.findIndex((x) => x.code === w.code) === i)
    .slice(0, EINLADUNG_WEITERE_MAX)
    .map((w) => (w.konto ? { code: w.code, konto: w.konto } : w.code));
  // 'am' wird neu gesetzt: Die Frist hängt am jüngsten Link, sonst könnte ein alter Eintrag
  // eine frische Einladung mit in den Verfall reißen.
  schreiben(weitere.length ? { code: sauber, am: Date.now(), weitere } : { code: sauber, am: Date.now() });
}

// Das Einlösen ist gelaufen. 'offen' sind die Codes dieses Kontos, die NICHT durchkamen.
// Leer → der Eintrag ist erledigt. Sonst bleibt genau das liegen, gestempelt mit dem Konto,
// das es versucht hat — aber nicht ewig: nach drei Anläufen ist entweder der Code kaputt
// oder der Server dauerhaft stumm. Codes anderer Konten kommen dabei weg: Sie gehören nicht
// mir, und ein Nachhol-Versuch von mir wäre genau das, wogegen der Besitzer-Schutz steht.
export function einladungErgebnisMerken(eintrag, offen, konto) {
  const reihe = (offen || []).filter((wert, i, alle) => wert && alle.indexOf(wert) === i);
  if (!eintrag || !reihe.length) { einladungWeg(); return; }
  const versuche = eintrag.versuche + 1;
  if (versuche >= EINLADUNG_VERSUCHE) { einladungWeg(); return; }
  const weitere = reihe.slice(1, 1 + EINLADUNG_WEITERE_MAX);
  schreiben({ code: reihe[0], am: eintrag.am, versuche, konto, ...(weitere.length ? { weitere } : {}) });
}
