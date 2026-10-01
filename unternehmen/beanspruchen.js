// Beanspruchen (Paket H, ALGORITHMUS §6.2): die Wege, stärkster zuerst — der Mensch wählt, was er kann.
//   1. E-Mail an die Domain der Website (Code, 10 Minuten, 5 Versuche)
//   2. Datei auf der Website (/.well-known/crew-verify.txt)
//   3. SMS/Anruf — nur, wenn die Datenbank den Weg anbietet (Twilio eingerichtet; Hausregel 9)
//   4. Nichts davon: ehrlich sagen, was fehlt, mit Link zum OSM-Editor und „Jetzt prüfen“ (§10.8, live)
// Entschieden wird auf dem Server (Funktion `unternehmen` + Migration 0062); hier steht nur die Oberfläche.

import { esc } from '../core/html.js';
import { funktion } from './daten.js';
import { WEGE, grundText } from './texte.js';

export function beanspruchenZeigen(karte, { seite: ersteSeite, abbrechen, seiteNeu, geschafft }) {
  let seite = ersteSeite;
  let schritt = 'wahl';
  let meldung = '';
  let meldungGut = false;
  let laeuft = false;
  let pruefung = null;   // Antwort von „starten“
  let mailEntwurf = '';

  const wege = () => (Array.isArray(seite.wege) ? seite.wege : []);
  const meldungHtml = () => (meldung ? `<p class="ort-meldung" data-role="ort-meldung"${meldungGut ? ' data-gut' : ''}>${esc(meldung)}</p>` : '');
  const zurueckKnopf = '<button class="ort-textknopf" data-role="ort-weg-zurueck">Anderen Weg wählen</button>';

  function wegZeile(weg) {
    const w = WEGE[weg];
    const unter = {
      email_domain: `Wir schicken einen Code an eine Adresse auf ${seite.domain}, z. B. info@${seite.domain}.`,
      website_datei: `Sie legen eine kleine Textdatei auf ${seite.domain} ab.`,
      sms: `Code per SMS an ${seite.telefon_maskiert || 'die Nummer in OpenStreetMap'}.`,
      anruf: `Ein Anruf sagt den Code an — für Festnetz (${seite.telefon_maskiert || ''}).`,
    }[weg];
    return `<button class="ort-weg" data-role="ort-weg" data-weg="${weg}"><span><b>${esc(w.titel)}</b><small>${esc(unter)}</small></span><span class="ort-weg-stufe">${esc(w.stufe)}</span></button>`;
  }

  function keinWegHtml() {
    const telefonOhneSms = seite.hat_telefon && !wege().includes('sms');
    const warum = seite.website_gesperrt
      ? 'Die Website in OpenStreetMap liegt bei einem Baukasten, einem sozialen Netz oder einem Portal — darüber lässt sich nicht nachweisen, dass der Ort Ihnen gehört.'
      : telefonOhneSms
        ? 'In OpenStreetMap steht eine Telefonnummer, aber der Weg per SMS ist bei Crew noch nicht eingeschaltet.'
        : 'In OpenStreetMap steht für diesen Ort weder eine eigene Website noch eine Telefonnummer.';
    return `<div data-role="ort-kein-weg">
      <p class="ort-text">${esc(warum)}</p>
      <p class="ort-text" style="margin-top:12px">Zum Beanspruchen tragen Sie bitte Ihre eigene Website (mit Ihrer Domain) öffentlich in OpenStreetMap ein — dort stehen die Angaben, die Crew automatisch prüfen kann. Das ist kostenlos und hilft auch allen anderen Karten.</p>
      <div class="ort-knopfreihe">
        <a class="ort-knopf-leise" data-role="ort-osm-bearbeiten" href="${esc(seite.osm?.bearbeiten || 'https://www.openstreetmap.org')}" target="_blank" rel="noopener">In OpenStreetMap eintragen</a>
        <button class="ort-textknopf" data-role="ort-osm-live">Eingetragen? Jetzt prüfen</button>
      </div>
    </div>`;
  }

  function html() {
    if (schritt === 'wahl') {
      const liste = wege();
      return `<h2>Ort beanspruchen</h2>
        <p class="ort-text">Wie können Sie nachweisen, dass ${esc(seite.name)} Ihnen gehört? Der stärkste Weg steht oben.</p>
        ${liste.length ? `<div class="ort-wege" style="margin-top:16px">${liste.map(wegZeile).join('')}</div>` : ''}
        ${liste.length ? '' : keinWegHtml()}
        ${meldungHtml()}
        <div class="ort-knopfreihe"><button class="ort-textknopf" data-role="ort-abbrechen">Abbrechen</button></div>`;
    }
    if (schritt === 'email_domain') {
      return `<h2>E-Mail an ${esc(seite.domain)}</h2>
        <p class="ort-text">Geben Sie eine Adresse auf <b>@${esc(seite.domain)}</b> an. Wir schicken dorthin einen 6-stelligen Code (10 Minuten gültig).</p>
        <label class="ort-beschriftung" for="ort-mail">E-Mail-Adresse</label>
        <input id="ort-mail" class="ort-feld" type="email" inputmode="email" autocomplete="email" placeholder="info@${esc(seite.domain)}" value="${esc(mailEntwurf)}" />
        ${meldungHtml()}
        <div class="ort-knopfreihe"><button class="ort-knopf" data-role="ort-code-schicken"${laeuft ? ' disabled' : ''}>${laeuft ? 'Moment …' : 'Code schicken'}</button>${zurueckKnopf}</div>`;
    }
    if (schritt === 'sms' || schritt === 'anruf') {
      return `<h2>${esc(WEGE[schritt].titel)}</h2>
        <p class="ort-text">${schritt === 'sms' ? 'Wir schicken eine SMS' : 'Wir rufen an und sagen den Code an'} — an die Nummer aus OpenStreetMap: <b>${esc(seite.telefon_maskiert || '')}</b>.</p>
        ${meldungHtml()}
        <div class="ort-knopfreihe"><button class="ort-knopf" data-role="ort-code-schicken"${laeuft ? ' disabled' : ''}>${laeuft ? 'Moment …' : 'Code senden'}</button>${zurueckKnopf}</div>`;
    }
    if (schritt === 'code') {
      return `<h2>Code eingeben</h2>
        <p class="ort-text">Wir haben einen Code an <b>${esc(pruefung?.an_maskiert || '')}</b> geschickt. Er gilt 10 Minuten. Sehen Sie notfalls im Spam-Ordner nach.</p>
        <label class="ort-beschriftung" for="ort-code">6-stelliger Code</label>
        <input id="ort-code" class="ort-feld ort-code" inputmode="numeric" autocomplete="one-time-code" maxlength="7" placeholder="••••••" />
        ${meldungHtml()}
        <div class="ort-knopfreihe"><button class="ort-knopf" data-role="ort-code-pruefen"${laeuft ? ' disabled' : ''}>${laeuft ? 'Moment …' : 'Bestätigen'}</button>
        <button class="ort-textknopf" data-role="ort-code-neu">Neuen Code schicken</button>${zurueckKnopf}</div>`;
    }
    if (schritt === 'datei') {
      return `<h2>Datei auf ${esc(pruefung.domain)}</h2>
        <ol class="ort-text" style="padding-left:20px;margin:0">
          <li>Legen Sie auf Ihrem Webserver diese Datei an:<span class="ort-token" data-role="ort-datei-adresse">${esc(pruefung.url)}</span></li>
          <li>Inhalt der Datei (nur diese Zeile):<span class="ort-token" data-role="ort-token">${esc(pruefung.token)}</span></li>
          <li>Dann hier prüfen. Das Zeichen gilt 72 Stunden.</li>
        </ol>
        ${meldungHtml()}
        <div class="ort-knopfreihe"><button class="ort-knopf" data-role="ort-datei-pruefen"${laeuft ? ' disabled' : ''}>${laeuft ? 'Moment …' : 'Jetzt prüfen'}</button>
        <a class="ort-knopf-leise" data-role="ort-datei-laden" download="crew-verify.txt" href="data:text/plain;charset=utf-8,${encodeURIComponent(`${pruefung.token}\n`)}">Datei herunterladen</a>${zurueckKnopf}</div>`;
    }
    if (schritt === 'ergebnis') {
      return `<h2>Ort beanspruchen</h2>${meldungHtml()}<div class="ort-knopfreihe">${zurueckKnopf}<button class="ort-textknopf" data-role="ort-abbrechen">Schließen</button></div>`;
    }
    return '';
  }

  function sage(text, gut = false) { meldung = text; meldungGut = gut; }

  async function ergebnis(r) {
    if (r?.ok) {
      sage(`Geschafft — Sie verwalten ${seite.name} jetzt.`, true);
      schritt = 'ergebnis';
      zeichnen();
      await geschafft();
      return;
    }
    if (r?.grund === 'streit' || r?.grund === 'schwaecher' || r?.grund === 'gesperrt_24h') {
      sage(grundText(r.grund, r));
      schritt = 'ergebnis';
    } else {
      sage(grundText(r?.grund, r));
    }
    zeichnen();
  }

  async function starten(weg) {
    laeuft = true; zeichnen();
    const r = await funktion('starten', { ort: seite.id, weg, ...(weg === 'email_domain' ? { ziel: mailEntwurf } : {}) });
    laeuft = false;
    if (!r?.ok) {
      sage(grundText(r?.grund, r));
      // Freemail/falsche Domain: der nächste Weg liegt eine Zeile tiefer („Anderen Weg wählen“).
      if (r?.grund === 'gesperrt_24h' || r?.grund === 'zu_viele_ort' || r?.grund === 'zu_viele_ip') schritt = 'ergebnis';
      zeichnen();
      return;
    }
    pruefung = r;
    sage('');
    schritt = weg === 'website_datei' ? 'datei' : 'code';
    zeichnen();
  }

  function zeichnen() {
    karte.innerHTML = html();
    karte.dataset.schritt = schritt;
    const an = (rolle, fn) => karte.querySelectorAll(`[data-role="${rolle}"]`).forEach((k) => { k.onclick = fn; });
    an('ort-abbrechen', () => abbrechen());
    an('ort-weg-zurueck', () => { schritt = 'wahl'; sage(''); zeichnen(); });
    karte.querySelectorAll('[data-role="ort-weg"]').forEach((k) => {
      k.onclick = () => {
        const weg = k.dataset.weg;
        sage('');
        if (weg === 'website_datei') { starten(weg); return; }
        schritt = weg;
        zeichnen();
        karte.querySelector('#ort-mail')?.focus();
      };
    });
    const mail = karte.querySelector('#ort-mail');
    if (mail) {
      mail.oninput = () => { mailEntwurf = mail.value.trim(); };
      mail.onkeydown = (e) => { if (e.key === 'Enter') { mailEntwurf = mail.value.trim(); starten('email_domain'); } };
    }
    an('ort-code-schicken', () => { if (mail) mailEntwurf = mail.value.trim(); starten(schritt); });
    an('ort-code-neu', () => { schritt = pruefung?.weg || 'wahl'; sage(''); zeichnen(); });
    const code = karte.querySelector('#ort-code');
    const pruefen = async () => {
      const wert = (code?.value || '').replace(/\D+/g, '');
      if (wert.length !== 6 || laeuft) return;
      laeuft = true; zeichnen();
      const r = await funktion('code', { pruef_id: pruefung.pruef_id, code: wert });
      laeuft = false;
      await ergebnis(r);
    };
    if (code) {
      code.focus();
      code.oninput = () => {
        const sauber = code.value.replace(/\D+/g, '').slice(0, 6);
        if (sauber !== code.value) code.value = sauber;
        if (sauber.length === 6) pruefen();
      };
    }
    an('ort-code-pruefen', pruefen);
    an('ort-datei-pruefen', async () => {
      laeuft = true; zeichnen();
      const r = await funktion('datei', { pruef_id: pruefung.pruef_id });
      laeuft = false;
      await ergebnis(r);
    });
    an('ort-osm-live', async (e) => {
      e.currentTarget.textContent = 'Moment …';
      const r = await funktion('osm_live', { ort: seite.id });
      if (!r?.ok) { sage(grundText(r?.grund, r)); zeichnen(); return; }
      seite = await seiteNeu();
      sage(wege().length ? 'Gefunden — jetzt können Sie einen Weg wählen.' : 'In OpenStreetMap steht noch keine eigene Website. Änderungen dort brauchen manchmal ein paar Minuten.', wege().length > 0);
      zeichnen();
    });
  }

  zeichnen();
}
