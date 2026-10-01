// Texte des Unternehmens-Bereichs (Paket H) — deutsch, an EINER Stelle. Ohne Importe.
// Jeder Grund, den Datenbank oder Funktion `unternehmen` zurückgeben (0062, kern.js), hat hier einen Satz;
// ein unbekannter Grund wird nie verschluckt, sondern als „Hat nicht geklappt (grund)“ gezeigt.

export const ARTEN = {
  restaurant: 'Restaurant', cafe: 'Café', bar: 'Bar', club: 'Club', kino: 'Kino', buehne: 'Bühne', museum: 'Museum',
  bad: 'Bad', therme: 'Therme', fitness: 'Fitness', aktiv_spass: 'Aktiv & Spaß', natur: 'Natur & Aussicht',
  wandern: 'Wandern', klettern: 'Klettern', rad: 'Rad', wintersport: 'Wintersport', wassersport: 'Wassersport',
  spiele_hobby: 'Spiele & Hobby', musik_machen: 'Musik machen',
};
export const artText = (art) => ARTEN[art] || (art ? String(art) : 'Ort');
// Stile mit Umlaut (die Kennung ist ASCII); Restaurants tragen seit dem Feinschliff ihre Küche als Stil.
const STILE_UMLAUT = {
  tuerkisch: 'Türkisch', thailaendisch: 'Thailändisch', franzoesisch: 'Französisch', huette: 'Hütte', hoehle: 'Höhle',
  baeckerei_cafe: 'Bäckerei-Café', offene_buehne: 'Offene Bühne', sup_kanu: 'SUP & Kanu', sonstige: 'Sonstige Küche', regional: 'Regionale Küche',
};
export const stilText = (stil) => (stil ? STILE_UMLAUT[stil] || String(stil).replace(/_/g, ' ').replace(/^./, (c) => c.toUpperCase()) : '');

export const ACHSEN = [
  ['bestaendigkeit', 'Beständigkeit', 'Wie lange es den Ort gibt und ob er gepflegt wird'],
  ['bekanntheit', 'Bekanntheit', 'Wie viele Menschen ihn kennen und eintragen'],
  ['pflege', 'Pflege', 'Wie vollständig die öffentlichen Angaben in OpenStreetMap sind'],
  ['erlebnis', 'Erlebnis', 'Was echte Besuche mit Crew sagen'],
  ['umfeld', 'Umfeld', 'Wo der Ort liegt'],
];

export const STUFE_TEXT = { gut: 'gut', sehr_gut: 'sehr gut', herausragend: 'herausragend', unter_70: 'unter den Empfehlungen nicht dabei', neu: 'Neu' };

export const WEGE = {
  email_domain: { titel: 'E-Mail an Ihre Domain', stufe: 'am stärksten' },
  website_datei: { titel: 'Datei auf Ihrer Website', stufe: 'stark' },
  sms: { titel: 'SMS an Ihre Nummer', stufe: 'einfach' },
  anruf: { titel: 'Anruf an Ihre Nummer', stufe: 'für Festnetz' },
};

export const MELDUNG_ARTEN = { falsch: 'Angaben falsch', geschlossen: 'Geschlossen gemeldet', unpassend: 'Unpassend', dein_unternehmen: 'Hinweis „dein Unternehmen“', bild_problem: 'Problem mit einem Bild' };

export const KLASSEN = {
  besonderheit: 'Besonderheit — wird einzeln gezeigt.',
  institution: 'Feste Einrichtung — wird als Serie gezeigt, wenn der nächste Termin in den nächsten 14 Tagen liegt.',
  grundbetrieb: 'Als Normalbetrieb erkannt: gleicher Tag, gleiche Zeit, gleicher Preis, wechselnder Name — erscheint nicht als Event. Ihr Ort bleibt sichtbar.',
  unklar: 'Noch zu wenige Events an Ihrem Ort, um es sicher einzuordnen — vorerst als Besonderheit.',
};

export const AENDERUNG_FELDER = {
  oeffnungszeiten: 'Öffnungszeiten', beschreibung: 'Beschreibung', preisniveau: 'Preisniveau', reservierung_url: 'Reservierungs-Link',
  geschlossen: '„Geschlossen“ gemeldet', umgezogen: '„Umgezogen“ gemeldet', foto_neu: 'Foto hinzugefügt', foto_weg: 'Foto entfernt',
  foto_titel: 'Titelbild gewählt', event_neu: 'Event eingetragen', event_weg: 'Event entfernt', inhaber: 'Prüfung', rueckgaengig: 'Wieder geöffnet',
};

const datum = (wert) => {
  try { return new Date(wert).toLocaleString('de-AT', { day: 'numeric', month: 'long', hour: '2-digit', minute: '2-digit' }); } catch { return String(wert || ''); }
};
export const tagText = (wert) => {
  try { return new Date(wert).toLocaleDateString('de-AT', { day: 'numeric', month: 'long', year: 'numeric' }); } catch { return String(wert || ''); }
};

// Ein Satz je Grund. d = die ganze Antwort (für bis, rest, domain …)
export function grundText(grund, d = {}) {
  const s = {
    anmelden: 'Bitte melden Sie sich an.',
    offline: 'Keine Verbindung. Bitte gleich noch einmal.',
    fehler: 'Hat nicht geklappt. Bitte gleich noch einmal.',
    unbekannt: 'Diesen Ort gibt es bei Crew nicht (mehr).',
    nicht_inhaber: 'Das kann nur, wer den Ort verwaltet.',
    beansprucht: 'Bitte bestätigen Sie Ihr Unternehmen erneut — bis dahin ist Bearbeiten gesperrt.',
    streit: 'Zwei Personen haben diesen Ort über gleich starke Wege bestätigt. Bis das geklärt ist, bleibt alles, wie es ist. Lösen können Sie es mit einem stärkeren Weg.',
    gesperrt: 'Dieser Eintrag ist gesperrt.',
    weg: 'Diesen Weg gibt es nicht.',
    weg_nicht_moeglich: 'Dieser Weg ist für diesen Ort nicht möglich.',
    sms_nicht_eingerichtet: 'SMS und Anruf sind noch nicht eingerichtet.',
    adresse: 'Das ist keine gültige E-Mail-Adresse.',
    freemail: `Adressen bei Gratis-Anbietern (Gmail, GMX, Outlook …) beweisen nicht, dass Ihnen die Website gehört. Bitte eine Adresse auf ${d.domain || 'Ihrer Domain'} — oder den nächsten Weg.`,
    nicht_auf_domain: `Die Adresse muss auf @${d.domain || 'Ihrer Domain'} enden — genau die Domain Ihrer Website.`,
    zu_viele_ort: 'Für diesen Ort gab es heute schon 3 Versuche. Morgen geht es wieder.',
    zu_viele_ip: 'Von diesem Anschluss gab es heute schon 5 Versuche. Morgen geht es wieder.',
    gesperrt_24h: `Zu viele falsche Codes. Aus Sicherheitsgründen gesperrt bis ${datum(d.bis)}.`,
    falsch: `Der Code stimmt nicht. Noch ${d.rest ?? 'einige'} ${d.rest === 1 ? 'Versuch' : 'Versuche'}.`,
    abgelaufen: 'Der Code ist abgelaufen (er gilt 10 Minuten). Bitte fordern Sie einen neuen an.',
    erledigt: 'Diese Prüfung ist schon abgeschlossen. Bitte neu beginnen.',
    mail: 'Die E-Mail konnte nicht verschickt werden. Bitte später noch einmal.',
    sms: 'Die SMS konnte nicht verschickt werden. Bitte später noch einmal.',
    nicht_gefunden: 'Unter der Adresse ist (noch) keine Datei erreichbar. Liegt sie genau unter /.well-known/crew-verify.txt?',
    zeichen_fehlt: 'Die Datei ist da, aber das Zeichen steht nicht darin.',
    schwaecher: 'Dieser Ort ist schon über einen stärkeren Weg bestätigt. Beanspruchen geht nur mit einem mindestens gleich starken Weg.',
    osm_nicht_erreichbar: 'OpenStreetMap antwortet gerade nicht. Bitte gleich noch einmal.',
    zu_viele_osm: 'Sie haben in dieser Stunde schon mehrmals geprüft. OpenStreetMap braucht manchmal ein paar Minuten — bitte später noch einmal.',
    link: 'Bitte ohne Links, Web- oder Mailadressen.',
    preiswerbung: 'Bitte ohne Preise, Prozente oder Rabatt-Werbung — die Beschreibung ist keine Anzeige.',
    zu_lang: 'Höchstens 300 Zeichen.',
    preisniveau: 'Bitte €, €€ oder €€€ wählen.',
    nur_https: 'Nur sichere Adressen (https://).',
    fremde_domain: `Der Link muss auf Ihre Website${d.domain ? ` (${d.domain})` : ''} oder zu einem bekannten Reservierungsdienst führen.`,
    oeffnungszeiten_gesperrt: `Die Öffnungszeiten wurden in 7 Tagen schon 3× geändert. Wieder möglich ab ${datum(d.bis)}.`,
    format: 'Das Format stimmt nicht.',
    feld: 'Dieses Feld kann nicht geändert werden.',
    schon_rueckgaengig: 'Schon rückgängig gemacht.',
    inzwischen_geaendert: 'Inzwischen wurde das Feld noch einmal geändert — bitte die neuere Änderung zurücknehmen.',
    nicht_rueckgaengig: 'Das lässt sich nicht rückgängig machen.',
    name: 'Bitte einen Namen (bis 120 Zeichen).',
    beginn: 'Der Beginn muss in der Zukunft liegen (höchstens gut ein Jahr).',
    ende: 'Das Ende muss nach dem Beginn liegen (höchstens 7 Tage).',
    preis: 'Der Preis stimmt nicht.',
    rechte: 'Bitte bestätigen Sie, dass Sie die Rechte am Bild haben.',
    art: 'Diese Art gibt es nicht.',
    schon_da: 'Dieses Event ist schon eingetragen.',
    nach: 'Bitte die neue Adresse angeben (bis 160 Zeichen).',
    zu_viele: 'Höchstens 10 Fotos. Entfernen Sie erst eines.',
    zu_gross: 'Das Bild ist größer als 5 MB.',
    doppelt: 'Dieses Bild ist schon da.',
    fremdes_bild: 'Dieses Bild wird schon bei einem anderen Ort verwendet (z. B. ein Stockfoto) — bitte ein eigenes.',
    metadaten: 'Das Bild trägt noch Metadaten (z. B. den Aufnahmeort). Bitte über diese Seite hochladen.',
    kein_jpeg: 'Das Bild konnte nicht umgewandelt werden.',
    kein_bild: 'Das ist kein Bild.',
    kaputt: 'Dieses Bildformat kann Ihr Browser nicht lesen — bitte JPEG oder PNG.',
    hochladen: 'Das Hochladen hat nicht geklappt.',
    datei_fehlt: 'Die Datei kam nicht an. Bitte noch einmal.',
    pfad: 'Hat nicht geklappt (Pfad).',
  };
  return s[grund] || `Hat nicht geklappt (${grund || 'unbekannt'}).`;
}
