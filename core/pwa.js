// Anmeldung des Service Workers — die App-Hülle im Gerät (Prüfschritt T3b).
//
// Bewusst NICHT im örtlichen Entwicklungsbetrieb: Dort würde eine Ablage im Gerät die
// Prüfläufe verfälschen, weil sie Dateien ausliefern könnte, die gerade geändert wurden.
// Angemeldet wird deshalb nur unter https (also dort, wo die App wirklich veröffentlicht
// ist) — oder wenn man es örtlich ausdrücklich mit ?sw=1 verlangt.

// Auftrag R1 §8: „Öffnet man die Gruppe, verschwindet sie."
//
// Zwei Wege, weil beide nötig sind: Läuft ein Service Worker, kennt NUR er die Mitteilungen,
// die schon auf dem gesperrten Bildschirm stehen — ihm wird Bescheid gesagt. Läuft keiner
// (örtlicher Betrieb, native Hülle), schließt die Seite, was sie selbst kennt. Fehlt beides,
// passiert nichts — und nichts geht kaputt.
export function schliesseMitteilung(tag) {
  if (!tag) return;
  try {
    // Ohne einen laufenden Worker gäbe es nichts zu schließen — und `ready` käme nie
    // zurück, was bei jedem Rendern ein hängendes Versprechen mehr hinterließe.
    if ('serviceWorker' in navigator && navigator.serviceWorker.controller) {
      navigator.serviceWorker.ready
        .then((registrierung) => {
          registrierung.active?.postMessage({ typ: 'mitteilung-schliessen', tag });
          return registrierung.getNotifications?.({ tag });
        })
        .then((offene) => (offene || []).forEach((m) => m.close()))
        .catch(() => {});
    }
  } catch { /* ohne Mitteilungen gibt es nichts zu schließen */ }
}

// Der Merkname einer Raum-Mitteilung. Er entsteht in der Datenbank (Migration 0012) aus der
// Kennung des Raumes auf dem Server — die App kennt sie erst, wenn sie den Raum wirklich hat.
export function raumMitteilungsTag(serverRaumId) {
  return serverRaumId ? `raum-${serverRaumId}` : null;
}

import { istHuelle, erlaubnisStand } from './native.js';
import { t as tx } from './sprache.js';

// --- Mitteilungen beim Start (Runde 9) ----------------------------------------------------------
// Jonathan: „Beim App-Start: wenn Mitteilungen noch nie entschieden wurden, einmal nachfragen; bei
// ‚erteilt' das Push-Abo aktualisieren." Für bestehende UND neue Konten — ohne Umweg über den Guide.
//   · erteilt    → nur abgleichen (die Anmeldung dieses Geräts beim Server auffrischen). Wer die
//                  Mitteilungen im Profil selbst ausgeschaltet hat, bleibt dabei: nichts wird neu
//                  angeschaltet, was jemand ausgeschaltet hat.
//   · abgelehnt / unmöglich → nichts. Ein Nein nimmt nur der Mensch selbst zurück.
//   · offen      → EINMAL fragen (gemerkt im Gerät), und nur, wo es wirklich etwas bringt (`fragbar`:
//                  ein Konto, ein Gerät, das Push kann). In der App-Hülle fragt das System direkt.
//                  Im Browser darf die Systemfrage nicht ohne Berührung kommen (Safari verweigert sie,
//                  Chrome stellt sie still ab) — dort steht ein kleines Blatt mit EINEM Knopf, dessen
//                  Tipp sofort das Browser-Fenster auslöst, dazu leise „Später". Höchstens einmal je
//                  Konto und Gerät; ein Nein des Systems heißt: nie wieder fragen.
// Die Wege selbst (abgleichen, anschalten, fragbar) reicht app.js herein; dieses Modul kennt nur die
// Reihenfolge und das Blatt.
const STARTFRAGE = 'crew.mitteilungen.startfrage';
let startfrageKonto = '';
const BLATT_WARTEN_MS = 1500;
const BLATT_VERSUCHE = 40;

function startfrageGemerkt() {
  try { return Boolean(globalThis.localStorage?.getItem(`${STARTFRAGE}:${startfrageKonto}`)); } catch { return false; }
}

function startfrageMerken() {
  try { globalThis.localStorage?.setItem(`${STARTFRAGE}:${startfrageKonto}`, String(Date.now())); } catch { /* privates Fenster: dann eben noch einmal */ }
}

// Was das System zuletzt gesagt hat — damit die App einer ÄNDERUNG folgen kann (Runde 9, Zusatz 3:
// „Einstellungen folgen der System-Entscheidung"), ohne eine eigene Entscheidung bei jedem Start zu
// überschreiben.
function zuletztLesen(art) {
  try { return globalThis.localStorage?.getItem(`crew.erlaubnis.zuletzt.${art}`) || ''; } catch { return ''; }
}

function zuletztMerken(art, stand) {
  try { globalThis.localStorage?.setItem(`crew.erlaubnis.zuletzt.${art}`, String(stand || '')); } catch { /* egal */ }
}

// Runde 10 (Jonathan): Der schwebende Hinweis „Mitteilungen aus — …" über der App ist weg. Er
// stand mitten im Bild, erklärte in einem ganzen Satz und war trotzdem unklar. An seine Stelle
// treten kurze Pillen dort, wo die Sache hingehört: im Crew-Tab („Mitteilungen aktivieren"),
// auf Karte und Find („Standort aktivieren"). Dieses Modul fragt nur noch — es zeigt nichts mehr.
//
// `konto`: höchstens EINMAL je Konto und Gerät (ein zweites Konto auf demselben Gerät wird gefragt).
export async function mitteilungenBeimStart({ fragbar, anschalten, abgleichen, konto = '' } = {}) {
  startfrageKonto = String(konto || '');
  let stand = 'offen';
  try { stand = await erlaubnisStand('mitteilungen'); } catch { return 'fehler'; }
  const vorher = zuletztLesen('mitteilungen');
  zuletztMerken('mitteilungen', stand);
  let ergebnis = stand;
  if (stand === 'erteilt') {
    // Folgt dem System: Wurde die Erlaubnis SEIT dem letzten Start gegeben (etwa in den Einstellungen
    // des Telefons), ist die App ab jetzt an. Sonst nur abgleichen — wer sie in der App selbst
    // ausgeschaltet hat, bleibt dabei.
    try { await (vorher && vorher !== 'erteilt' ? anschalten?.() : abgleichen?.()); } catch { /* beim nächsten Start */ }
    ergebnis = 'abgeglichen';
  } else if (stand === 'offen' && !startfrageGemerkt()) {
    let darf = false;
    try { darf = Boolean(await fragbar?.()); } catch { darf = false; }
    if (darf) {
      startfrageMerken();
      if (istHuelle()) { anschalten?.(); return 'gefragt'; }
      mitteilungenBlatt(anschalten);
      return 'blatt';
    }
  }
  return ergebnis;
}

// --- Standort folgt dem System (Runde 9, Zusatz 3) ---------------------------------------------
// „Standort verwenden" steht nie auf an, wenn das System den Standort verbietet (Hausregel 9). Und
// wer ihn im System (neu) erlaubt, hat ihn damit auch in der App an. Geprüft wird beim Start und —
// wo der Browser es meldet — sobald sich die Erlaubnis ändert.
let standortLauscher = false;
export async function standortBeimStart({ istAn, an, aus } = {}) {
  let stand = 'offen';
  try { stand = await erlaubnisStand('standort'); } catch { return 'fehler'; }
  const vorher = zuletztLesen('standort');
  zuletztMerken('standort', stand);
  let aktiv = false;
  try { aktiv = Boolean(istAn?.()); } catch { aktiv = false; }
  if ((stand === 'abgelehnt' || stand === 'unmoeglich') && aktiv) aus?.();
  else if (stand === 'erteilt' && vorher && vorher !== 'erteilt' && !aktiv) an?.();
  if (!standortLauscher && typeof globalThis.navigator?.permissions?.query === 'function') {
    standortLauscher = true;
    globalThis.navigator.permissions.query({ name: 'geolocation' })
      .then((status) => { if (status) status.onchange = () => { standortBeimStart({ istAn, an, aus }); }; })
      .catch(() => {});
  }
  return stand;
}

// Das Blatt wartet, bis kein anderes Blatt (Guide, Erlaubnis) mehr offen ist — zwei Fragen
// übereinander beantwortet niemand.
function mitteilungenBlatt(anschalten, versuch = 0) {
  const dok = globalThis.document;
  if (!dok?.body) return;
  const belegt = [...dok.querySelectorAll('.p5-ebene')].some((ebene) => ebene.childElementCount > 0);
  if (belegt && versuch < BLATT_VERSUCHE) { setTimeout(() => mitteilungenBlatt(anschalten, versuch + 1), BLATT_WARTEN_MS); return; }
  if (dok.querySelector('[data-role="mitteilungen-start"]')) return;
  const schrift = "'Instrument Sans',sans-serif";
  const knoten = dok.createElement('div');
  knoten.dataset.role = 'mitteilungen-start';
  knoten.style.cssText = 'position:fixed;inset:0;z-index:10000;display:flex;align-items:flex-end;justify-content:center';
  knoten.innerHTML = `<div data-mitteilungen-start="spaeter" style="position:absolute;inset:0;background:var(--scrim)"></div>
<div role="dialog" aria-modal="true" aria-label="${tx('Mitteilungen erlauben')}" style="position:relative;width:100%;max-width:520px;box-sizing:border-box;background:var(--surface);color:var(--ink);border-radius:26px 26px 0 0;box-shadow:0 -10px 30px var(--shadow-15);padding:14px 20px calc(22px + env(safe-area-inset-bottom, 0px));display:flex;flex-direction:column;gap:14px;font-family:${schrift}">
<span aria-hidden="true" style="width:38px;height:4px;border-radius:999px;background:var(--handle);align-self:center"></span>
<span style="display:flex;flex-direction:column;gap:6px">
<span style="font:650 20px/1.25 'Bricolage Grotesque',sans-serif">${tx('Mitteilungen erlauben?')}</span>
<span style="font-size:14px;line-height:1.5;color:var(--ink-soft)">${tx('Crew sagt dir Bescheid, wenn Freunde frei sind oder dir schreiben.')}</span>
</span>
<span style="display:flex;flex-direction:column;gap:8px">
<button type="button" data-mitteilungen-start="ja" style="min-height:50px;border:0;border-radius:999px;background:var(--green);color:var(--on-accent);font:650 15px/1 ${schrift};cursor:pointer;appearance:none">${tx('Mitteilungen erlauben')}</button>
<button type="button" data-mitteilungen-start="spaeter" style="min-height:44px;border:0;border-radius:999px;background:transparent;color:var(--muted);font:650 14px/1 ${schrift};cursor:pointer;appearance:none">${tx('Später')}</button>
</span>
</div>`;
  knoten.addEventListener('click', (ereignis) => {
    const ziel = ereignis.target.closest?.('[data-mitteilungen-start]');
    if (!ziel) return;
    ereignis.preventDefault();
    // JETZT, noch in der Berührung: anschalten() ruft die Systemfrage synchron auf (data/push.js).
    if (ziel.dataset.mitteilungenStart === 'ja') anschalten?.();
    knoten.remove();
  });
  dok.body.appendChild(knoten);
}

export function registriereServiceWorker() {
  if (!('serviceWorker' in navigator)) return;

  // In der nativen Hülle (Capacitor) NICHT. Dort liegen alle Dateien ohnehin im Gerät —
  // eine zweite Ablage darüber brächte nichts und richtete Schaden an: Die Hülle meldet
  // sich unter https://localhost, also unter derselben Herkunft wie beim letzten Mal. Ein
  // alter Service Worker überlebte damit das Aktualisieren der App und lieferte weiter den
  // Stand von gestern aus. Genau das war zu sehen, nachdem die Hülle neu gebaut war.
  if (istHuelle()) {
    navigator.serviceWorker.getRegistrations?.()
      .then((alle) => alle.forEach((r) => r.unregister()))
      .catch(() => {});
    return;
  }

  const ausdruecklich = new URLSearchParams(globalThis.location?.search || '').has('sw');
  const veroeffentlicht = globalThis.location?.protocol === 'https:';
  if (!veroeffentlicht && !ausdruecklich) return;

  const anmelden = () => {
    navigator.serviceWorker.register('./sw.js').catch((fehler) => {
      console.warn('[Crew] Service Worker nicht angemeldet:', fehler?.message || fehler);
    });
  };
  // Runde 8: Das Programm startet inzwischen oft erst NACH dem load-Ereignis (gemessen: load
  // bei 404 ms, dieser Aufruf bei 454 ms). Ein Warten auf „load" hiesse dann: nie. Ist die
  // Seite schon fertig, sofort anmelden.
  if (document.readyState === 'complete') anmelden();
  else globalThis.addEventListener('load', anmelden, { once: true });

  // Neue Fassung übernimmt: einmal neu laden, damit niemand mit halb altem Stand arbeitet.
  // Nur, wenn vorher schon einer lief — beim allerersten Besuch wäre ein Neuladen sinnlos.
  let hatteSchonEinen = Boolean(navigator.serviceWorker.controller);
  navigator.serviceWorker.addEventListener('controllerchange', () => {
    if (!hatteSchonEinen) { hatteSchonEinen = true; return; }
    globalThis.location.reload();
  });
}
