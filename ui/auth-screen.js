// Anmeldung für den Server-Modus. EINE Anmeldung — danach ist man drin (Auftrag §1.1).
//
// Bewusst klein und ehrlich: Es gibt genau das, was heute WIRKLICH funktioniert — E-Mail und
// Passwort. „Mit Apple anmelden" und „Mit Google anmelden" brauchen Schlüssel und eine native
// Hülle; solange die fehlen, wird kein Knopf gezeigt, der nur so tut (Auftrag §5).
//
// Auftrag §1.2: Hier wird NUR nach E-Mail und Passwort gefragt. Name und Bild kommen danach
// beim Einrichten — vorher standen sie an beiden Stellen, und man tippte seinen Namen zweimal.
// Auftrag §1.3: Ein Auge im Passwortfeld macht sichtbar, was man tippt. Bei der Anmeldung
// genauso wie beim Anlegen: Ein Tippfehler in einem Feld voller Punkte ist nicht zu finden.
//
// Diese Datei ist kein Router-Screen: Sie läuft, BEVOR die App startet, weil ohne Sitzung
// kein Datenbestand existiert, den ein Screen zeigen könnte.

import { esc } from '../core/html.js';
import { uebersetzeAuthFehler, uebersetzeLinkFehler, wartezeitAusFehler, holeLinkFehler } from '../core/auth-texte.js';
import { sprache, t } from '../core/sprache.js';
import { istHuelle } from '../core/native.js';
import { destenyKachel } from './desteny-marke.js';

// Runde 7 (J1, Jonathan: „manchmal werden die confirm mails in der registrierung nicht
// versendet"). Vier Messungen haben das Bild gedreht: Die Mails GEHEN raus (jedes je angelegte
// Konto hat confirmation_sent_at, 14–140 ms nach dem Anlegen). Was fehlte, war alles danach —
// die App behauptete einen Versand auch dort, wo GoTrue gar keinen macht; es gab kein „erneut
// senden", keinen Spam-Hinweis, keinen Absender und keinen zweiten Weg, wenn der Link nicht
// ankam oder nicht mehr galt. Deshalb steht hier jetzt:
//   1. ein Bildschirm NACH dem Anlegen, der sagt, worauf gewartet wird (an welche Adresse,
//      von wem) — und der den Code aus der Mail entgegennimmt (verifyOtp). Der Code wirkt
//      auch dort, wo kein Link wirken kann: in der App-Hülle, nach Ablauf des Links, wenn ein
//      Virenscanner ihn verbraucht hat oder er im falschen Browser landet.
//   2. „Keine E-Mail bekommen?" mit echter Wirkung (resend) und sichtbarer Wartezeit.
//   3. Ehrlichkeit beim Anlegen: eine bereits bestätigte Adresse bekommt KEINE Mail — das
//      sagt die App jetzt, statt „Schau in dein Postfach".

// Wer die Mails schickt. Muss zu scripts/mail-deploy.mjs (ABSENDER) passen — der Mensch
// sucht im Postfach nach genau diesem Namen, auch im Spam-Ordner.
// `node scripts/mail-deploy.mjs --pruefen` vergleicht beides und meldet einen Unterschied.
const ABSENDER_NAME = 'Crew';
const ABSENDER_MAIL = 'development@crew.desteny.at';
// Wohin die Links aus den Mails führen dürfen (uri_allow_list in scripts/mail-deploy.mjs).
// GEMESSEN (Runde 7): In der Hülle liefert location.origin `https://localhost` bzw.
// `capacitor://localhost` — ein Link dorthin führt aus einem Mailprogramm heraus garantiert
// ins Leere. Deshalb zeigt der Link aus der Hülle auf die Web-App; dort bestätigt der Server
// das Konto. Der Code in der Mail bleibt der kürzere Weg: er wird IN der App eingegeben.
const WEB_ADRESSE = 'https://desteny-dev.github.io/crew-app/';
// Gemessen: smtp_max_frequency = 60 (Sekunden zwischen zwei Mails an dieselbe Adresse).
const SPERRE_SEKUNDEN = 60;

const FELD = 'width:100%;box-sizing:border-box;padding:13px 15px;border-radius:14px;border:1px solid var(--line-solid);'
  + "background:var(--surface);color:var(--ink);font:400 16px/1.3 'Instrument Sans',sans-serif;outline:none";
const FELD_MIT_AUGE = `${FELD};padding-right:48px`;
const KNOPF = 'width:100%;box-sizing:border-box;padding:15px 16px;border-radius:14px;border:none;background:var(--ink);'
  + "color:var(--on-ink);font:650 15px/1 'Instrument Sans',sans-serif;cursor:pointer";
// Runde 6 (E1): Der Wechsel zwischen Anmelden und Erstellen ist kein zweiter Hauptknopf mehr,
// sondern eine ruhige Zeile: „Noch kein Konto? · Konto erstellen". So kann nie zweifelhaft sein,
// welcher der beiden Wege gerade läuft — es gibt genau EINEN kräftigen Knopf je Seite.
const WECHSELKNOPF = "border:0;background:transparent;color:var(--ink);font:650 13.5px/1 'Instrument Sans',sans-serif;"
  + 'cursor:pointer;padding:12px 8px;min-height:44px;text-decoration:underline;text-underline-offset:3px;appearance:none';
const TEXTKNOPF = "border:0;background:transparent;color:var(--ink-soft);font:500 13px/1 'Instrument Sans',sans-serif;cursor:pointer;padding:11px 8px;min-height:44px";
// Das Feld für den Code aus der Mail: groß, weit gesetzt, in der Mitte — sechs Ziffern soll
// man tippen können, ohne hinzusehen, und beim Einfügen soll man sofort erkennen, ob sie stimmen.
const CODE_FELD = 'width:100%;box-sizing:border-box;padding:14px 12px;border-radius:14px;border:1px solid var(--line-solid);'
  + "background:var(--surface);color:var(--ink);font:650 23px/1.2 'Instrument Sans',sans-serif;letter-spacing:.28em;"
  + 'text-align:center;text-indent:.28em;outline:none';

// Auge zu / Auge offen. Zwei Zeichen, damit man am Symbol sieht, was der nächste Tipp tut.
function augeSvg(sichtbar) {
  return sichtbar
    ? `<svg width="19" height="19" viewBox="0 0 24 24" fill="none"><path d="M2.5 12S6 5.5 12 5.5 21.5 12 21.5 12 18 18.5 12 18.5 2.5 12 2.5 12Z" stroke="currentColor" stroke-width="1.7" stroke-linejoin="round"></path><circle cx="12" cy="12" r="3.1" stroke="currentColor" stroke-width="1.7"></circle><path d="m4 20 16-16" stroke="currentColor" stroke-width="1.7" stroke-linecap="round"></path></svg>`
    : `<svg width="19" height="19" viewBox="0 0 24 24" fill="none"><path d="M2.5 12S6 5.5 12 5.5 21.5 12 21.5 12 18 18.5 12 18.5 2.5 12 2.5 12Z" stroke="currentColor" stroke-width="1.7" stroke-linejoin="round"></path><circle cx="12" cy="12" r="3.1" stroke="currentColor" stroke-width="1.7"></circle></svg>`;
}

// Runde 3 (L2, Jonathan: „Crew ohne grünen Punkt — das Logo richtig"): Das Zeichen aus
// assets-logo/crew-icon-hell.svg — Ring und Punkt, davor eine echte Lücke (Maske statt Strich
// in Hintergrundfarbe, damit sie hell und dunkel stimmt). Ring in Tinte, Punkt im Logo-Grün.
function logoZeichen(groesse) {
  return `<svg width="${groesse}" height="${groesse}" viewBox="6 6 62 62" aria-hidden="true" style="display:block;overflow:visible">
    <mask id="auth-luecke" maskUnits="userSpaceOnUse" x="0" y="0" width="72" height="72">
      <rect x="0" y="0" width="72" height="72" fill="#fff"/>
      <circle cx="53.5" cy="52" r="11.5" fill="#000"/>
    </mask>
    <circle cx="36" cy="36" r="24" style="fill:none;stroke:var(--ink);stroke-width:7" mask="url(#auth-luecke)"/>
    <circle cx="53.5" cy="52" r="9.5" style="fill:var(--green)"/>
  </svg>`;
}

// Ein Passwortfeld mit Auge. Der Zustand „sichtbar" lebt im DOM, nicht im Modell — ein
// Rerender beim Umschalten würde die Eingabemarke aus dem Feld werfen.
function passwortFeld({ id, placeholder, autocomplete }) {
  return `<div style="position:relative;display:flex;align-items:center">
<input id="${id}" type="password" autocomplete="${autocomplete}" placeholder="${esc(placeholder)}" style="${FELD_MIT_AUGE}" />
<button type="button" data-auge="${id}" aria-label="${esc(t('Passwort anzeigen'))}" aria-pressed="false" style="position:absolute;right:6px;width:38px;height:38px;border:0;background:transparent;color:var(--muted);display:flex;align-items:center;justify-content:center;cursor:pointer;padding:0;appearance:none"><span style="pointer-events:none;display:flex">${augeSvg(false)}</span></button>
</div>`;
}

function bindeAugen(root) {
  root.querySelectorAll('[data-auge]').forEach((knopf) => {
    knopf.onclick = () => {
      const feld = root.querySelector(`#${knopf.getAttribute('data-auge')}`);
      if (!feld) return;
      const sichtbar = feld.type === 'password';
      feld.type = sichtbar ? 'text' : 'password';
      knopf.setAttribute('aria-pressed', String(sichtbar));
      knopf.setAttribute('aria-label', sichtbar ? t('Passwort verbergen') : t('Passwort anzeigen'));
      knopf.firstElementChild.innerHTML = augeSvg(sichtbar);
      // Die Eingabemarke bleibt, wo sie war — sonst springt sie beim Umschalten ans Ende.
      const stelle = feld.value.length;
      feld.focus();
      try { feld.setSelectionRange(stelle, stelle); } catch { /* Feldart erlaubt es nicht */ }
    };
  });
}

// Runde 4 (Jonathan: „Ich will nicht, dass man sich bei Crew anmeldet und nicht checkt, dass man einen
// Desteny-Account hat"): Jede Seite nennt das Desteny-Konto.
//
// Runde 5 (A1) drehte die Hierarchie um: Desteny groß oben, Crew nur als kleine Pille darunter.
//
// Runde 6 (E1, Jonathan: „bei der anmeldung soll es zwar klar sein, das man ein desteny konto
// anlegt für crew, aber man soll nicht das gefühl haben als wenn man sich plötzlich für etwas
// ganz anderes anmeldet und crew gar nicht mehr da ist"): Genau das war der Fehler. Jetzt gilt,
// was auch wirklich stimmt: **Crew ist die App, in die man geht — Desteny ist der Rahmen, der
// das Konto stellt.**
//   oben    CREW, groß, mit seinem Zeichen (und weiterhin #auth-logo: lang drücken → Demo)
//   darunter klein und ruhig: das Desteny-Zeichen mit „Konto von Desteny Development"
//   Titel   was hier gerade passiert: „Bei Crew anmelden" ODER „Konto erstellen"
// Der Kopf steht auf JEDER Seite und in JEDEM Schritt gleich — Crew verschwindet nie.
function markeKopf() {
  return `<div data-role="auth-marke" style="display:flex;flex-direction:column;align-items:center;gap:10px;margin:0 0 2px">
      <span id="auth-logo" style="display:inline-flex;align-items:center;gap:11px;padding:4px 6px;user-select:none;-webkit-user-select:none;-webkit-touch-callout:none;touch-action:manipulation">
        ${logoZeichen(36)}
        <span style="font:700 31px/1 'Bricolage Grotesque',sans-serif;color:var(--ink);letter-spacing:-.025em">Crew</span>
      </span>
      <span data-role="auth-desteny" style="display:inline-flex;align-items:center;gap:8px;color:var(--muted)">
        ${destenyKachel(20)}
        <span style="font:500 12.5px/1.2 'Instrument Sans',sans-serif">${esc(t('Konto von Desteny Development'))}</span>
      </span>
    </div>`;
}

// Wörter mit Bindestrich („Desteny-Konto") brechen nie am Bindestrich um — in jeder Sprache.
const ungetrennt = (text) => esc(text).replace(/(\S+-\S+)/g, '<span style="white-space:nowrap">$1</span>');

// Runde 6 (E1, Jonathan: „mach es klarer das man sich anmeldet oder einen account erstellt"):
// Über dem Titel steht beim Erstellen, im wievielten von zwei Schritten man ist. Damit ist auch
// im Passwort-Schritt ohne Nachdenken klar, welcher der beiden Wege gerade läuft.
function seitenTitel(titel, unter = '', vorlauf = '') {
  return `<div style="text-align:center;display:flex;flex-direction:column;gap:6px">
    ${vorlauf ? `<div data-role="auth-schritt" style="font:650 11px/1.2 'Instrument Sans',sans-serif;letter-spacing:.09em;text-transform:uppercase;color:var(--muted-light)">${esc(vorlauf)}</div>` : ''}
    <div data-role="auth-titel" style="font:650 24px/1.2 'Bricolage Grotesque',sans-serif;color:var(--ink);letter-spacing:-.015em;text-wrap:balance">${ungetrennt(titel)}</div>
    ${unter ? `<div data-role="auth-unter" style="font:400 13px/1.45 'Instrument Sans',sans-serif;color:var(--muted);text-wrap:pretty">${ungetrennt(unter)}</div>` : ''}
  </div>`;
}

// Runde 6 (E1, Jonathan: „bedenke auch das später apple und google anmeldung dazu kommt, es
// bleibt aber so, alle meine apps nutzen einen desteny account"): Die Reihenfolge steht fest —
// **Apple · Google · E-Mail**. Der Platz dafür ist hier im Aufbau schon vorgesehen und liegt
// über den Feldern. Heute steht dort NICHTS: ein Knopf, der nur so täte, wäre schlimmer als
// keiner (Auftrag §5). Sobald Schlüssel und native Hülle da sind, kommen genau hier die beiden
// Knöpfe hinein und die Trennzeile „oder mit E-Mail" darunter wird sichtbar.
function anbieterPlatz() {
  return '<div data-role="auth-anbieter" hidden></div>';
}

// Der ruhige Wechsel zwischen den beiden Wegen — nie zwei gleich starke Knöpfe.
function wechselZeile(frage, knopf) {
  return `<div data-role="auth-wechsel" style="display:flex;align-items:center;justify-content:center;gap:6px;flex-wrap:wrap">
      <span style="font:400 13.5px/1.2 'Instrument Sans',sans-serif;color:var(--muted)">${esc(frage)}</span>
      <button id="auth-switch" style="${WECHSELKNOPF}">${esc(knopf)}</button>
    </div>`;
}

const EMAIL_FORM = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;

function rahmen(inneres) {
  return `<div style="position:fixed;inset:0;display:flex;align-items:center;justify-content:center;background:var(--canvas);padding:24px">
  <div style="width:100%;max-width:360px;display:flex;flex-direction:column;gap:14px">${inneres}</div>
</div>`;
}

// Eine Meldung, und wo es einen gibt, der Weg aus ihr heraus: „Zu dieser E-Mail gibt es schon
// ein Konto" ohne „Passwort vergessen?" daneben lässt jemanden stehen, der sein Passwort nicht
// mehr weiß. Der Knopf trägt `data-meldung-aktion` und wird in zeichne() verbunden.
function meldungHtml(meldung, gut = false, aktion = null) {
  if (!meldung) return '';
  return `<div data-role="auth-meldung" style="display:flex;flex-direction:column;align-items:center;gap:2px;padding:2px 4px">
    <div data-role="auth-meldung-text" style="font:500 13px/1.45 'Instrument Sans',sans-serif;color:${gut ? 'var(--green-dark)' : 'var(--danger)'};text-align:center;text-wrap:balance">${esc(meldung)}</div>
    ${aktion ? `<button data-meldung-aktion="${esc(aktion.ziel)}" style="${WECHSELKNOPF}">${esc(aktion.text)}</button>` : ''}
  </div>`;
}

export function renderAuthScreen(root, { client, onSignedIn, onDemo }) {
  // Runde 3: Vor der Anmeldung gibt es keine Einstellung — die Anmeldung folgt dem Gerät
  // (hell/dunkel), statt im dunklen Handy grell hell aufzuleuchten.
  import('../core/theme.js').then(({ applyTheme }) => applyTheme('system')).catch(() => {});
  // Runde 4 (Jonathan: „Neuen Account erstellen würde ich so machen, dass man die Mail eingibt, und auf
  // der zweiten Seite das Passwort zweimal."): 'registrieren' ist Schritt 1 (E-Mail),
  // 'passwort' Schritt 2 (Passwort + Wiederholung). Die E-Mail bleibt beim Zurückgehen stehen.
  // Runde 7 (J1): 'bestaetigen' ist der Bildschirm NACH dem Anlegen — der einzige Ort, an dem
  // ein Mensch je gewartet hat, ohne zu wissen, worauf.
  let modus = 'anmelden'; // 'anmelden' | 'registrieren' | 'passwort' | 'vergessen' | 'bestaetigen'
  let meldung = '';
  let meldungGut = false;
  let meldungAktion = null; // { text, ziel } — der Weg aus der Meldung heraus
  let laeuft = false;
  let emailEntwurf = '';
  let codeEntwurf = '';
  let sperreBis = 0;   // bis wann „Keine E-Mail bekommen?" gesperrt ist (Zeitstempel)
  let uhr = null;      // der Countdown; läuft nur, solange der Bestätigen-Bildschirm steht

  // Ein abgelaufener oder verbrauchter Link hat die Anmeldemaske schon erreicht, bevor sie
  // gezeichnet wurde (web/data/gateway.js legt ihn ab). Er gilt für genau einen Blick.
  const linkFehler = holeLinkFehler();
  if (linkFehler) {
    meldung = uebersetzeLinkFehler(linkFehler);
    meldungGut = false;
    meldungAktion = { text: t('Neue E-Mail schicken'), ziel: 'bestaetigen' };
  }

  const fussnote = `<div data-role="auth-fussnote" style="font:400 11px/1.5 'Instrument Sans',sans-serif;color:var(--muted-light);text-align:center;margin-top:2px;text-wrap:balance">
      ${ungetrennt(t('Anmeldung mit Apple und Google kommt mit der App-Version.'))}
    </div>`;

  // Wie viele Sekunden die Sperre zwischen zwei E-Mails noch läuft.
  const restSperre = () => Math.max(0, Math.ceil((sperreBis - Date.now()) / 1000));
  // Gesperrt sagt der Knopf, was gleich möglich ist; frei sagt er, wofür er da ist.
  const nochmalText = () => (restSperre()
    ? t('Neu schicken in {n} s', { n: restSperre() })
    : t('Keine E-Mail bekommen? Neu schicken'));

  // Der Countdown fasst NUR den Knopf an. Ein Neuzeichnen würde den halb getippten Code
  // wegwerfen — jede Sekunde einmal.
  function uhrStellen() {
    clearInterval(uhr);
    uhr = null;
    const knopf = root.querySelector('#auth-resend');
    if (!knopf) return;
    const zeigen = () => {
      const rest = restSperre();
      knopf.textContent = nochmalText();
      knopf.disabled = rest > 0 || laeuft;
      knopf.style.opacity = rest > 0 ? '.55' : '1';
      if (!rest) { clearInterval(uhr); uhr = null; }
    };
    zeigen();
    if (restSperre()) uhr = setInterval(zeigen, 500);
  }

  // Der Bildschirm nach dem Anlegen: Er sagt, an WEN die Mail ging, von WEM sie kommt, dass
  // sie im Spam liegen kann — und er nimmt den Code entgegen, damit der Mensch dort bleibt,
  // wo er ohnehin steht.
  function bestaetigenSeite() {
    const adresseBekannt = Boolean(emailEntwurf);
    const zielZeile = adresseBekannt
      ? `<div data-role="auth-ziel" style="display:flex;align-items:center;justify-content:center;gap:6px;font:500 13.5px/1.4 'Instrument Sans',sans-serif;color:var(--ink-soft);margin-top:-4px">
      <span data-role="auth-email-anzeige" style="overflow:hidden;text-overflow:ellipsis;white-space:nowrap;max-width:210px">${esc(emailEntwurf)}</span>
      <button id="auth-zurueck" style="${TEXTKNOPF}">${t('Ändern')}</button>
    </div>`
      : `<input id="auth-email" type="email" inputmode="email" autocomplete="email" placeholder="${esc(t('E-Mail'))}" value="" style="${FELD}" />`;
    return rahmen(`${markeKopf()}
    ${seitenTitel(t('Bestätige deine E-Mail'), adresseBekannt
    ? t('Wir haben dir eine E-Mail geschickt. Tipp auf den Knopf darin — oder gib hier den Code aus der E-Mail ein.')
    : t('Gib die E-Mail deines Kontos ein. Wir schicken dir eine neue Bestätigung mit Knopf und Code.'), t('Fast geschafft'))}
    ${zielZeile}
    ${/* Die Beschriftung steht ÜBER dem Feld, nicht darin: Im weit gesetzten Feld wäre der
         Satz „Code aus der E-Mail" hinter dem Rand abgeschnitten (gemessen im Prüflauf). */ ''}
    <div data-role="auth-code-label" style="font:500 12.5px/1.4 'Instrument Sans',sans-serif;color:var(--muted);text-align:center;margin-bottom:-8px">${esc(t('Code aus der E-Mail'))}</div>
    <input id="auth-code" type="text" inputmode="numeric" autocomplete="one-time-code" maxlength="16" placeholder="––––––" aria-label="${esc(t('Code aus der E-Mail'))}" value="${esc(codeEntwurf)}" style="${CODE_FELD}" />
    <button id="auth-go" style="${KNOPF};opacity:${laeuft ? '.6' : '1'}" ${laeuft ? 'disabled' : ''}>${laeuft ? t('Moment …') : t('Bestätigen')}</button>
    <div data-role="auth-absender" style="font:400 12px/1.5 'Instrument Sans',sans-serif;color:var(--muted);text-align:center;text-wrap:pretty">
      ${ungetrennt(t('Die E-Mail kommt von {absender} ({adresse}). Sieh auch im Spam-Ordner nach.', { absender: ABSENDER_NAME, adresse: ABSENDER_MAIL }))}
    </div>
    <div style="display:flex;justify-content:center;margin-top:-4px"><button id="auth-resend" style="${TEXTKNOPF}">${esc(nochmalText())}</button></div>
    ${wechselZeile(t('Schon bestätigt?'), t('Zur Anmeldung'))}
    ${meldungHtml(meldung, meldungGut, meldungAktion)}`);
  }

  function zeichne() {
    if (modus === 'bestaetigen') {
      root.innerHTML = bestaetigenSeite();
    } else if (modus === 'vergessen') {
      root.innerHTML = rahmen(`${markeKopf()}
    ${seitenTitel(t('Passwort vergessen'), t('Gib die E-Mail deines Desteny-Kontos ein. Wir schicken dir einen Link für ein neues Passwort.'))}
    <input id="auth-email" type="email" inputmode="email" autocomplete="email" placeholder="${esc(t('E-Mail'))}" value="${esc(emailEntwurf)}" style="${FELD}" />
    <button id="auth-go" style="${KNOPF};opacity:${laeuft ? '.6' : '1'}" ${laeuft ? 'disabled' : ''}>${laeuft ? t('Moment …') : t('Link schicken')}</button>
    ${wechselZeile(t('Passwort wieder da?'), t('Zurück zur Anmeldung'))}
    ${meldungHtml(meldung, meldungGut, meldungAktion)}`);
    } else if (modus === 'registrieren') {
      root.innerHTML = rahmen(`${markeKopf()}
    ${seitenTitel(t('Konto erstellen'), t('Ein Desteny-Konto für Crew und alle Apps von Desteny Development.'), t('Schritt 1 von 2 · E-Mail'))}
    ${anbieterPlatz()}
    <input id="auth-email" type="email" inputmode="email" autocomplete="email" placeholder="${esc(t('E-Mail'))}" value="${esc(emailEntwurf)}" style="${FELD}" />
    <button id="auth-go" style="${KNOPF}">${t('Weiter')}</button>
    ${wechselZeile(t('Schon ein Konto?'), t('Anmelden'))}
    ${meldungHtml(meldung, meldungGut, meldungAktion)}
    ${fussnote}`);
    } else if (modus === 'passwort') {
      root.innerHTML = rahmen(`${markeKopf()}
    ${seitenTitel(t('Konto erstellen'), '', t('Schritt 2 von 2 · Passwort'))}
    <div style="display:flex;align-items:center;justify-content:center;gap:6px;font:500 13.5px/1.4 'Instrument Sans',sans-serif;color:var(--ink-soft);margin-top:-4px">
      <span data-role="auth-email-anzeige" style="overflow:hidden;text-overflow:ellipsis;white-space:nowrap;max-width:210px">${esc(emailEntwurf)}</span>
      <button id="auth-zurueck" style="${TEXTKNOPF}">${t('Ändern')}</button>
    </div>
    ${passwortFeld({ id: 'auth-pass', placeholder: t('Passwort'), autocomplete: 'new-password' })}
    ${passwortFeld({ id: 'auth-pass2', placeholder: t('Passwort wiederholen'), autocomplete: 'new-password' })}
    <div style="font:400 12px/1.4 'Instrument Sans',sans-serif;color:var(--muted);text-align:center;margin-top:-6px">${t('Mindestens 8 Zeichen. Deinen Namen fragen wir gleich danach.')}</div>
    <button id="auth-go" style="${KNOPF};opacity:${laeuft ? '.6' : '1'}" ${laeuft ? 'disabled' : ''}>${laeuft ? t('Moment …') : t('Konto erstellen')}</button>
    ${meldungHtml(meldung, meldungGut, meldungAktion)}`);
    } else {
      root.innerHTML = rahmen(`${markeKopf()}
    ${seitenTitel(t('Bei Crew anmelden'), t('Mit deinem Desteny-Konto — es gilt für Crew und alle Apps von Desteny Development.'))}
    ${anbieterPlatz()}
    <input id="auth-email" type="email" inputmode="email" autocomplete="email" placeholder="${esc(t('E-Mail'))}" value="${esc(emailEntwurf)}" style="${FELD}" />
    ${passwortFeld({ id: 'auth-pass', placeholder: t('Passwort'), autocomplete: 'current-password' })}
    <button id="auth-go" style="${KNOPF};opacity:${laeuft ? '.6' : '1'}" ${laeuft ? 'disabled' : ''}>${laeuft ? t('Moment …') : t('Anmelden')}</button>
    ${/* Trägt die Meldung selbst schon „Passwort vergessen?", steht es NICHT zweimal auf der
         Seite: Dann zählt der Knopf direkt an der Meldung — dort schaut der Mensch hin. */ ''}
    ${meldungAktion?.ziel === 'vergessen' ? '' : `<div style="display:flex;justify-content:center;margin-top:-4px"><button id="auth-forgot" style="${TEXTKNOPF}">${t('Passwort vergessen?')}</button></div>`}
    ${wechselZeile(t('Noch kein Konto?'), t('Konto erstellen'))}
    ${meldungHtml(meldung, meldungGut, meldungAktion)}
    ${fussnote}`);
    }

    const emailFeld = root.querySelector('#auth-email');
    if (emailFeld) emailFeld.oninput = () => { emailEntwurf = emailFeld.value.trim(); };
    const codeFeld = root.querySelector('#auth-code');
    if (codeFeld) {
      // Nur Ziffern, und was aus der Zwischenablage kommt („123 456", „123-456"), wird sauber
      // übernommen. Wer sechs Ziffern voll hat, ist fertig — dann geht es von selbst weiter.
      codeFeld.oninput = () => {
        const sauber = codeFeld.value.replace(/\D+/g, '').slice(0, 6);
        if (sauber !== codeFeld.value) codeFeld.value = sauber;
        codeEntwurf = sauber;
        if (sauber.length === 6 && !laeuft) absenden();
      };
    }
    const nochmal = root.querySelector('#auth-resend');
    if (nochmal) nochmal.onclick = nochmalSchicken;
    const umschalten = root.querySelector('#auth-switch');
    if (umschalten) {
      umschalten.onclick = () => {
        modus = modus === 'anmelden' ? 'registrieren' : 'anmelden';
        zuruecksetzenMeldung();
        zeichne();
      };
    }
    const zurueck = root.querySelector('#auth-zurueck');
    if (zurueck) {
      zurueck.onclick = () => {
        // Im Bestätigen-Bildschirm heißt „Ändern": die Adresse war falsch — hier stehen
        // bleiben und sie neu eingeben, statt das ganze Anlegen noch einmal zu durchlaufen.
        if (modus === 'bestaetigen') { emailEntwurf = ''; sperreBis = 0; } else { modus = 'registrieren'; }
        zuruecksetzenMeldung();
        zeichne();
        root.querySelector('#auth-email')?.focus();
      };
    }
    const vergessen = root.querySelector('#auth-forgot');
    if (vergessen) vergessen.onclick = () => { modus = 'vergessen'; zuruecksetzenMeldung(); zeichne(); };
    // Der Weg aus einer Meldung heraus („Passwort vergessen?", „Neue E-Mail schicken").
    root.querySelectorAll('[data-meldung-aktion]').forEach((knopf) => {
      knopf.onclick = () => {
        modus = knopf.getAttribute('data-meldung-aktion');
        if (modus === 'bestaetigen') { codeEntwurf = ''; sperreBis = 0; }
        zuruecksetzenMeldung();
        zeichne();
      };
    });
    // Runde 2 (Jonathan: „Die Demo soll noch unauffälliger sein — kein offensichtlicher
    // Knopf"): Wer das Logo lange gedrückt hält (0,8 s), landet in der Demo. Zweiter Weg: `?demo`.
    const logo = root.querySelector('#auth-logo');
    if (logo) {
      let uhr = null;
      const los = () => { clearTimeout(uhr); uhr = null; };
      logo.onpointerdown = () => { los(); uhr = setTimeout(() => { uhr = null; onDemo(); }, 800); };
      logo.onpointerup = los;
      logo.onpointerleave = los;
      logo.onpointercancel = los;
      logo.oncontextmenu = (ereignis) => ereignis.preventDefault();
    }
    root.querySelector('#auth-go').onclick = absenden;
    root.querySelectorAll('input').forEach((feld) => {
      feld.onkeydown = (event) => {
        if (event.key !== 'Enter') return;
        // Im Passwort-Schritt springt Enter vom ersten ins zweite Feld, erst dort wird abgeschickt.
        if (feld.id === 'auth-pass' && root.querySelector('#auth-pass2')) { root.querySelector('#auth-pass2').focus(); return; }
        absenden();
      };
    });
    bindeAugen(root);
    uhrStellen();
  }

  function zuruecksetzenMeldung() {
    meldung = '';
    meldungGut = false;
    meldungAktion = null;
  }

  function sage(text, gut = false, aktion = null) {
    laeuft = false;
    meldung = text;
    meldungGut = gut;
    meldungAktion = aktion;
    zeichne();
  }

  // „Keine E-Mail bekommen?" — mit Wirkung. GEMESSEN: Ohne diesen Knopf war eine verlorene
  // Mail endgültig; client.auth.resend kam in der ganzen App nicht vor.
  async function nochmalSchicken() {
    if (laeuft || restSperre()) return;
    const feld = root.querySelector('#auth-email');
    if (feld) emailEntwurf = feld.value.trim();
    if (!emailEntwurf) { sage(t('E-Mail ausfüllen')); return; }
    if (!EMAIL_FORM.test(emailEntwurf)) { sage(t('Das sieht nicht nach einer E-Mail-Adresse aus')); return; }
    const adresse = emailEntwurf;
    laeuft = true; zuruecksetzenMeldung(); zeichne();
    try {
      const { error } = await client.auth.resend({ type: 'signup', email: adresse, options: { emailRedirectTo: adresseOhneAnhang() } });
      if (error) throw error;
      sperreBis = Date.now() + SPERRE_SEKUNDEN * 1000;
      sage(t('Neue E-Mail an {adresse} unterwegs. Sie kommt von {absender}.', { adresse, absender: ABSENDER_NAME }), true);
    } catch (error) {
      // Sagt der Server selbst, wie lange noch zu warten ist, gilt SEINE Zahl — nicht unsere.
      const rest = wartezeitAusFehler(error?.message || '');
      if (rest) sperreBis = Date.now() + rest * 1000;
      sage(uebersetzeAuthFehler(error?.message || t('Das hat nicht geklappt')));
    }
  }

  async function absenden() {
    if (laeuft) return;
    const emailFeld = root.querySelector('#auth-email');
    if (emailFeld) emailEntwurf = emailFeld.value.trim();
    const email = emailEntwurf;
    const passwort = root.querySelector('#auth-pass')?.value || '';

    // Der Code aus der Bestätigungsmail. Er tut genau das, was der Knopf in der Mail tut —
    // nur ohne Browserwechsel, ohne Hülle-Adresse, ohne verbrauchten Link.
    if (modus === 'bestaetigen') {
      if (!email) { sage(t('E-Mail ausfüllen')); return; }
      const code = (root.querySelector('#auth-code')?.value || '').replace(/\D+/g, '');
      codeEntwurf = code;
      if (code.length !== 6) { sage(t('Der Code besteht aus sechs Ziffern — er steht in der E-Mail.')); return; }
      laeuft = true; zuruecksetzenMeldung(); zeichne();
      try {
        // Genau EIN Versuch je Code. Ein zweiter mit einem anderen Typ (etwa 'email') sähe
        // hilfsbereit aus, kann hier aber nichts finden — dieser Bildschirm wird nur nach einer
        // Registrierung erreicht — und würde jeden Tippfehler zweimal gegen die Stundengrenze
        // zählen. Gemessen im Prüflauf: Er verschluckte außerdem den Fehlersatz.
        const antwort = await client.auth.verifyOtp({ email, token: code, type: 'signup' });
        if (antwort.error) throw antwort.error;
        if (antwort.data?.session) { onSignedIn(antwort.data.session); return; }
        modus = 'anmelden';
        codeEntwurf = '';
        sage(t('Bestätigt. Melde dich jetzt mit deinem Passwort an.'), true);
      } catch (error) {
        sage(uebersetzeAuthFehler(error?.message || t('Das hat nicht geklappt')));
        // Nach einem falschen Code steht die Eingabemarke wieder im Feld, der alte Code ist
        // markiert: einmal tippen und der neue steht drin — kein zweiter Weg zurück ins Feld.
        const feld = root.querySelector('#auth-code');
        if (feld) { feld.focus(); try { feld.select(); } catch { /* Feldart erlaubt es nicht */ } }
      }
      return;
    }

    if (modus === 'vergessen') {
      if (!email) { sage(t('E-Mail ausfüllen')); return; }
      laeuft = true; zuruecksetzenMeldung(); zeichne();
      const { error } = await client.auth.resetPasswordForEmail(email, { redirectTo: adresseOhneAnhang() });
      if (error) { sage(uebersetzeAuthFehler(error.message)); return; }
      sage(t('Schau in dein Postfach — die E-Mail kommt von {absender}. Sieh notfalls im Spam-Ordner nach.', { absender: ABSENDER_NAME }), true);
      return;
    }

    if (modus === 'registrieren') {
      if (!email) { sage(t('E-Mail ausfüllen')); return; }
      if (!EMAIL_FORM.test(email)) { sage(t('Das sieht nicht nach einer E-Mail-Adresse aus')); return; }
      modus = 'passwort';
      zuruecksetzenMeldung();
      zeichne();
      root.querySelector('#auth-pass')?.focus();
      return;
    }

    if (modus === 'passwort') {
      const wiederholt = root.querySelector('#auth-pass2')?.value || '';
      if (passwort.length < 8) { sage(t('Das Passwort braucht mindestens 8 Zeichen')); return; }
      if (passwort !== wiederholt) { sage(t('Die Passwörter stimmen nicht überein')); return; }
      laeuft = true; zuruecksetzenMeldung(); zeichne();
      try {
        // §1.2: kein Name hier. Er wird beim Einrichten gefragt — genau einmal.
        // Runde 2: Die Sprache reist im Konto mit — die Bestätigungsmail kommt schon in ihr.
        const { data, error } = await client.auth.signUp({ email, password: passwort, options: { emailRedirectTo: adresseOhneAnhang(), data: { sprache: sprache() } } });
        if (error) throw error;
        if (data.session) { onSignedIn(data.session); return; }

        // Runde 7 (J1) — hier stand der Satz, der einen Versand behauptete, den es nicht immer
        // gab. GEMESSEN: mailer_autoconfirm ist aus, bei der Registrierung gibt es also NIE
        // eine Sitzung; jeder fehlerfreie signUp landete im grünen „Wir haben dir eine E-Mail
        // geschickt" — auch der, bei dem GoTrue gar nichts verschickt hat.
        //
        // Die beiden Fälle sind von außen an EINEM Merkmal zu unterscheiden:
        //   • Adresse schon BESTÄTIGT → GoTrue antwortet absichtlich mehrdeutig (200, ein
        //     verschleierter Nutzer mit `identities: []`) und verschickt NICHTS. Wer das nicht
        //     prüft, schickt einen Menschen in ein Postfach, in das nie etwas kommt.
        //   • Adresse registriert, aber noch UNBESTÄTIGT → GoTrue verschickt sehr wohl wieder
        //     (nach den 60 Sekunden Sperre) und liefert den Nutzer MIT seiner Identität.
        // Deshalb: leeres identities-Array = keine Mail. Alles andere = Mail unterwegs.
        const nutzer = data?.user || null;
        if (Array.isArray(nutzer?.identities) && nutzer.identities.length === 0) {
          modus = 'anmelden';
          // Die Adresse bleibt stehen (emailEntwurf), das Passwortfeld ist leer — und der Weg
          // für den, der sein Passwort nicht mehr weiß, steht direkt unter der Meldung.
          sage(t('Zu dieser E-Mail gibt es schon ein Konto — melde dich an'), false, { text: t('Passwort vergessen?'), ziel: 'vergessen' });
          return;
        }
        modus = 'bestaetigen';
        codeEntwurf = '';
        sperreBis = Date.now() + SPERRE_SEKUNDEN * 1000;
        // Keine grüne Zeile dazu: Der Bildschirm selbst sagt schon, dass eine Mail unterwegs
        // ist, an welche Adresse und von wem. Zweimal dasselbe liest niemand zweimal.
        sage('');
      } catch (error) {
        sage(uebersetzeAuthFehler(error?.message || t('Das hat nicht geklappt')));
      }
      return;
    }

    if (!email || !passwort) { sage(t('E-Mail und Passwort ausfüllen')); return; }
    laeuft = true; zuruecksetzenMeldung(); zeichne();
    try {
      const { data, error } = await client.auth.signInWithPassword({ email, password: passwort });
      if (error) throw error;
      onSignedIn(data.session);
    } catch (error) {
      // „Email not confirmed": Das Konto gibt es, nur die Bestätigung fehlt. Statt einer
      // Sackgasse führt der Weg direkt dorthin, wo Code und neue Mail sind.
      if (/email not confirmed/i.test(error?.message || '')) {
        sage(uebersetzeAuthFehler(error.message), false, { text: t('Jetzt bestätigen'), ziel: 'bestaetigen' });
        return;
      }
      sage(uebersetzeAuthFehler(error?.message || t('Das hat nicht geklappt')));
    }
  }

  zeichne();
}

// Adresse der App ohne Anhang — dorthin führen die Links aus den Mails zurück.
//
// Runde 7 (J1), GEMESSEN: In der nativen Hülle ist `location.origin` https://localhost bzw.
// capacitor://localhost. Ein Bestätigungslink dorthin ist aus einem Mailprogramm heraus tot —
// er öffnet nichts. Aus der Hülle zeigt der Link deshalb auf die Web-App: dort bestätigt der
// Server das Konto wirklich. Der kürzere Weg bleibt der Code aus derselben Mail, der IN der
// App eingegeben wird und die Hülle nie verlässt.
export function adresseOhneAnhang() {
  const ort = globalThis.location;
  if (istHuelle()) return WEB_ADRESSE;
  if (!ort) return WEB_ADRESSE;
  return `${ort.origin}${ort.pathname}`;
}

// --- Nach dem Link aus der „Passwort vergessen"-Mail -------------------------------------
// Der Link bringt eine gültige Sitzung mit. Ohne diesen Bildschirm wäre man einfach
// angemeldet und hätte immer noch das alte (vergessene) Passwort.
export function renderNeuesPasswortScreen(root, { client, onFertig }) {
  let meldung = '';
  let meldungGut = false;
  let laeuft = false;

  function zeichne() {
    root.innerHTML = rahmen(`${markeKopf()}
    ${seitenTitel(t('Neues Passwort setzen'), t('Für dein Desteny-Konto.'))}
    ${passwortFeld({ id: 'np-pass', placeholder: t('Neues Passwort'), autocomplete: 'new-password' })}
    <div style="font:400 12px/1.4 'Instrument Sans',sans-serif;color:var(--muted);text-align:center;margin-top:-6px">${t('Mindestens 8 Zeichen.')}</div>
    <button id="np-go" style="${KNOPF};opacity:${laeuft ? '.6' : '1'}" ${laeuft ? 'disabled' : ''}>${laeuft ? t('Moment …') : t('Speichern und weiter')}</button>
    ${meldungHtml(meldung, meldungGut)}`);
    root.querySelector('#np-go').onclick = speichern;
    root.querySelector('#np-pass').onkeydown = (event) => { if (event.key === 'Enter') speichern(); };
    bindeAugen(root);
    root.querySelector('#np-pass').focus();
  }

  async function speichern() {
    if (laeuft) return;
    const wert = root.querySelector('#np-pass').value;
    if (wert.length < 8) { meldung = t('Das Passwort braucht mindestens 8 Zeichen'); meldungGut = false; zeichne(); return; }
    laeuft = true; meldung = ''; zeichne();
    const { error } = await client.auth.updateUser({ password: wert });
    if (error) { laeuft = false; meldung = uebersetzeAuthFehler(error.message); meldungGut = false; zeichne(); return; }
    onFertig();
  }

  zeichne();
}
