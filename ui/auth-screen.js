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
import { uebersetzeAuthFehler } from '../core/auth-texte.js';
import { sprache, t } from '../core/sprache.js';
import { destenyZeichen, destenyName, destenyNameLaden } from './desteny-marke.js';

const FELD = 'width:100%;box-sizing:border-box;padding:13px 15px;border-radius:14px;border:1px solid var(--line-solid);'
  + "background:var(--surface);color:var(--ink);font:400 16px/1.3 'Instrument Sans',sans-serif;outline:none";
const FELD_MIT_AUGE = `${FELD};padding-right:48px`;
const KNOPF = 'width:100%;box-sizing:border-box;padding:14px 16px;border-radius:14px;border:none;background:var(--ink);'
  + "color:var(--on-ink);font:600 15px/1 'Instrument Sans',sans-serif;cursor:pointer";
const ZWEITKNOPF = 'width:100%;box-sizing:border-box;padding:12px 16px;border-radius:14px;border:1px solid var(--line-solid);'
  + "background:transparent;color:var(--ink-soft);font:500 14px/1 'Instrument Sans',sans-serif;cursor:pointer";
const TEXTKNOPF = "border:0;background:transparent;color:var(--ink-soft);font:500 13px/1 'Instrument Sans',sans-serif;cursor:pointer;padding:8px 6px";

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
// Desteny-Account hat"): Der Titel jeder Seite nennt das Desteny-Konto.
//
// Runde 5 (A1, Jonathan: „Bei der Anmeldung soll klar sein, dass es ein Desteny-Account ist für Crew …
// Jetzt fühlt es sich an, als wäre es nur der Account von der App, aber Desteny spürt man nicht."):
// Vorher stand das große Crew-Zeichen oben, Desteny nur als kleine Zeile darunter — das Bild sagte
// „Crew-Konto", der Text „Desteny-Konto". Jetzt steht die Hierarchie im Bild:
//   oben     Desteny — das Konto (Zeichen, Schriftzug sobald geliefert)
//   Titel    was man hier tut, mit dem Desteny-Konto
//   darunter Crew — die App, in die man damit kommt („weiter zu Crew", wie bei großen Konten üblich)
// Das Crew-Zeichen bleibt #auth-logo (Ring und Punkt; lang drücken führt in die Demo).
function kopf() {
  return `<div data-role="auth-desteny" style="display:flex;flex-direction:column;align-items:center;gap:10px;color:var(--ink);margin:0 0 4px">
      ${destenyZeichen(40)}
      ${destenyName(11)}
    </div>`;
}

// Crew als Ziel: „weiter zu [Crew]" beim Anmelden, „damit nutzt du [Crew]" beim Erstellen.
function crewZiel(vorwort) {
  return `<div data-role="auth-ziel" style="display:flex;align-items:center;justify-content:center;flex-wrap:wrap;gap:8px;font:500 13.5px/1.2 'Instrument Sans',sans-serif;color:var(--muted);margin:-2px 0 6px">
      <span>${esc(vorwort)}</span>
      <span id="auth-logo" style="display:inline-flex;align-items:center;gap:7px;height:34px;box-sizing:border-box;padding:0 13px 0 7px;border-radius:999px;background:var(--surface);border:1px solid var(--line-solid);user-select:none;-webkit-user-select:none;-webkit-touch-callout:none;touch-action:manipulation">
        ${logoZeichen(22)}
        <span style="font:700 16px/1 'Bricolage Grotesque',sans-serif;color:var(--ink);letter-spacing:-.01em">Crew</span>
      </span>
    </div>`;
}

// Wörter mit Bindestrich („Desteny-Konto") brechen nie am Bindestrich um — in jeder Sprache.
const ungetrennt = (text) => esc(text).replace(/(\S+-\S+)/g, '<span style="white-space:nowrap">$1</span>');

function seitenTitel(titel, unter = '') {
  return `<div style="text-align:center;display:flex;flex-direction:column;gap:6px">
    <div data-role="auth-titel" style="font:650 22px/1.25 'Bricolage Grotesque',sans-serif;color:var(--ink);letter-spacing:-.01em;text-wrap:balance">${ungetrennt(titel)}</div>
    ${unter ? `<div style="font:400 13px/1.45 'Instrument Sans',sans-serif;color:var(--muted);text-wrap:pretty">${esc(unter)}</div>` : ''}
  </div>`;
}

const EMAIL_FORM = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;

function rahmen(inneres) {
  return `<div style="position:fixed;inset:0;display:flex;align-items:center;justify-content:center;background:var(--canvas);padding:24px">
  <div style="width:100%;max-width:360px;display:flex;flex-direction:column;gap:14px">${inneres}</div>
</div>`;
}

function meldungHtml(meldung, gut = false) {
  if (!meldung) return '';
  return `<div style="font:500 13px/1.45 'Instrument Sans',sans-serif;color:${gut ? 'var(--green-dark)' : 'var(--danger)'};text-align:center;padding:2px 4px">${esc(meldung)}</div>`;
}

export function renderAuthScreen(root, { client, onSignedIn, onDemo }) {
  // Runde 3: Vor der Anmeldung gibt es keine Einstellung — die Anmeldung folgt dem Gerät
  // (hell/dunkel), statt im dunklen Handy grell hell aufzuleuchten.
  import('../core/theme.js').then(({ applyTheme }) => applyTheme('system')).catch(() => {});
  // Runde 4 (Jonathan: „Neuen Account erstellen würde ich so machen, dass man die Mail eingibt, und auf
  // der zweiten Seite das Passwort zweimal."): 'registrieren' ist Schritt 1 (E-Mail),
  // 'passwort' Schritt 2 (Passwort + Wiederholung). Die E-Mail bleibt beim Zurückgehen stehen.
  let modus = 'anmelden'; // 'anmelden' | 'registrieren' | 'passwort' | 'vergessen'
  let meldung = '';
  let meldungGut = false;
  let laeuft = false;
  let emailEntwurf = '';

  // Runde 5: Den Schriftzug „DESTENY" einmal laden — er füllt seinen Platz selbst, sobald er da ist.
  destenyNameLaden();

  const fussnote = `<div data-role="auth-fussnote" style="font:400 11px/1.5 'Instrument Sans',sans-serif;color:var(--muted-light);text-align:center;margin-top:6px;text-wrap:balance">
      ${ungetrennt(t('Dein Desteny-Konto gilt für Crew und alle Apps von Desteny Development.'))}<br>${ungetrennt(t('Anmeldung mit Apple und Google kommt mit der App-Version.'))}
    </div>`;

  function zeichne() {
    if (modus === 'vergessen') {
      root.innerHTML = rahmen(`${kopf()}
    ${seitenTitel(t('Link schicken'), t('Gib die E-Mail deines Desteny-Kontos ein. Wir schicken dir einen Link für ein neues Passwort.'))}
    <input id="auth-email" type="email" inputmode="email" autocomplete="email" placeholder="${esc(t('E-Mail'))}" value="${esc(emailEntwurf)}" style="${FELD}" />
    <button id="auth-go" style="${KNOPF};opacity:${laeuft ? '.6' : '1'}" ${laeuft ? 'disabled' : ''}>${laeuft ? t('Moment …') : t('Link schicken')}</button>
    <button id="auth-switch" style="${ZWEITKNOPF}">${t('Zurück zur Anmeldung')}</button>
    ${meldungHtml(meldung, meldungGut)}`);
    } else if (modus === 'registrieren') {
      root.innerHTML = rahmen(`${kopf()}
    ${seitenTitel(t('Desteny-Konto erstellen'))}
    ${crewZiel(t('damit nutzt du'))}
    <input id="auth-email" type="email" inputmode="email" autocomplete="email" placeholder="${esc(t('E-Mail'))}" value="${esc(emailEntwurf)}" style="${FELD}" />
    <button id="auth-go" style="${KNOPF}">${t('Weiter')}</button>
    <button id="auth-switch" style="${ZWEITKNOPF}">${t('Schon ein Desteny-Konto? Anmelden')}</button>
    ${meldungHtml(meldung, meldungGut)}
    ${fussnote}`);
    } else if (modus === 'passwort') {
      root.innerHTML = rahmen(`${kopf()}
    ${seitenTitel(t('Passwort festlegen'))}
    <div style="display:flex;align-items:center;justify-content:center;gap:8px;font:500 13.5px/1.4 'Instrument Sans',sans-serif;color:var(--ink-soft)">
      <span data-role="auth-email-anzeige" style="overflow:hidden;text-overflow:ellipsis;white-space:nowrap;max-width:240px">${esc(emailEntwurf)}</span>
      <button id="auth-zurueck" style="${TEXTKNOPF}">${t('Ändern')}</button>
    </div>
    ${passwortFeld({ id: 'auth-pass', placeholder: t('Passwort'), autocomplete: 'new-password' })}
    ${passwortFeld({ id: 'auth-pass2', placeholder: t('Passwort wiederholen'), autocomplete: 'new-password' })}
    <div style="font:400 12px/1.4 'Instrument Sans',sans-serif;color:var(--muted);text-align:center;margin-top:-6px">${t('Mindestens 8 Zeichen. Deinen Namen fragen wir gleich danach.')}</div>
    <button id="auth-go" style="${KNOPF};opacity:${laeuft ? '.6' : '1'}" ${laeuft ? 'disabled' : ''}>${laeuft ? t('Moment …') : t('Desteny-Konto erstellen')}</button>
    ${meldungHtml(meldung, meldungGut)}`);
    } else {
      root.innerHTML = rahmen(`${kopf()}
    ${seitenTitel(t('Mit deinem Desteny-Konto anmelden'))}
    ${crewZiel(t('weiter zu'))}
    <input id="auth-email" type="email" inputmode="email" autocomplete="email" placeholder="${esc(t('E-Mail'))}" value="${esc(emailEntwurf)}" style="${FELD}" />
    ${passwortFeld({ id: 'auth-pass', placeholder: t('Passwort'), autocomplete: 'current-password' })}
    <button id="auth-go" style="${KNOPF};opacity:${laeuft ? '.6' : '1'}" ${laeuft ? 'disabled' : ''}>${laeuft ? t('Moment …') : t('Anmelden')}</button>
    <button id="auth-switch" style="${ZWEITKNOPF}">${t('Noch kein Desteny-Konto? Erstellen')}</button>
    <div style="display:flex;justify-content:center"><button id="auth-forgot" style="${TEXTKNOPF}">${t('Passwort vergessen?')}</button></div>
    ${meldungHtml(meldung, meldungGut)}
    ${fussnote}`);
    }

    const emailFeld = root.querySelector('#auth-email');
    if (emailFeld) emailFeld.oninput = () => { emailEntwurf = emailFeld.value.trim(); };
    const umschalten = root.querySelector('#auth-switch');
    if (umschalten) {
      umschalten.onclick = () => {
        modus = modus === 'anmelden' ? 'registrieren' : 'anmelden';
        meldung = '';
        zeichne();
      };
    }
    const zurueck = root.querySelector('#auth-zurueck');
    if (zurueck) zurueck.onclick = () => { modus = 'registrieren'; meldung = ''; zeichne(); root.querySelector('#auth-email')?.focus(); };
    const vergessen = root.querySelector('#auth-forgot');
    if (vergessen) vergessen.onclick = () => { modus = 'vergessen'; meldung = ''; zeichne(); };
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
  }

  function sage(text, gut = false) {
    laeuft = false;
    meldung = text;
    meldungGut = gut;
    zeichne();
  }

  async function absenden() {
    if (laeuft) return;
    const emailFeld = root.querySelector('#auth-email');
    if (emailFeld) emailEntwurf = emailFeld.value.trim();
    const email = emailEntwurf;
    const passwort = root.querySelector('#auth-pass')?.value || '';

    if (modus === 'vergessen') {
      if (!email) { sage(t('E-Mail ausfüllen')); return; }
      laeuft = true; meldung = ''; zeichne();
      const { error } = await client.auth.resetPasswordForEmail(email, { redirectTo: adresseOhneAnhang() });
      if (error) { sage(uebersetzeAuthFehler(error.message)); return; }
      sage(t('Schau in dein Postfach. Der Link ist eine Stunde gültig.'), true);
      return;
    }

    if (modus === 'registrieren') {
      if (!email) { sage(t('E-Mail ausfüllen')); return; }
      if (!EMAIL_FORM.test(email)) { sage(t('Das sieht nicht nach einer E-Mail-Adresse aus')); return; }
      modus = 'passwort';
      meldung = '';
      zeichne();
      root.querySelector('#auth-pass')?.focus();
      return;
    }

    if (modus === 'passwort') {
      const wiederholt = root.querySelector('#auth-pass2')?.value || '';
      if (passwort.length < 8) { sage(t('Das Passwort braucht mindestens 8 Zeichen')); return; }
      if (passwort !== wiederholt) { sage(t('Die Passwörter stimmen nicht überein')); return; }
      laeuft = true; meldung = ''; zeichne();
      try {
        // §1.2: kein Name hier. Er wird beim Einrichten gefragt — genau einmal.
        // Runde 2: Die Sprache reist im Konto mit — die Bestätigungsmail kommt schon in ihr.
        const { data, error } = await client.auth.signUp({ email, password: passwort, options: { emailRedirectTo: adresseOhneAnhang(), data: { sprache: sprache() } } });
        if (error) throw error;
        if (data.session) { onSignedIn(data.session); return; }
        // Ohne Sitzung heißt: Supabase hat eine Bestätigungsmail verschickt.
        modus = 'anmelden';
        sage(t('Wir haben dir eine E-Mail geschickt. Bestätige sie und melde dich dann an.'), true);
      } catch (error) {
        sage(uebersetzeAuthFehler(error?.message || t('Das hat nicht geklappt')));
      }
      return;
    }

    if (!email || !passwort) { sage(t('E-Mail und Passwort ausfüllen')); return; }
    laeuft = true; meldung = ''; zeichne();
    try {
      const { data, error } = await client.auth.signInWithPassword({ email, password: passwort });
      if (error) throw error;
      onSignedIn(data.session);
    } catch (error) {
      sage(uebersetzeAuthFehler(error?.message || t('Das hat nicht geklappt')));
    }
  }

  zeichne();
}

// Adresse der App ohne Anhang — dorthin führen die Links aus den Mails zurück.
export function adresseOhneAnhang() {
  const ort = globalThis.location;
  if (!ort) return '';
  return `${ort.origin}${ort.pathname}`;
}

// --- Nach dem Link aus der „Passwort vergessen"-Mail -------------------------------------
// Der Link bringt eine gültige Sitzung mit. Ohne diesen Bildschirm wäre man einfach
// angemeldet und hätte immer noch das alte (vergessene) Passwort.
export function renderNeuesPasswortScreen(root, { client, onFertig }) {
  let meldung = '';
  let meldungGut = false;
  let laeuft = false;

  destenyNameLaden();

  function zeichne() {
    root.innerHTML = rahmen(`${kopf()}
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
