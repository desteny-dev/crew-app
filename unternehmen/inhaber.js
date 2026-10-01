// Inhaber-Ansicht (Paket H, ALGORITHMUS §6.3) und Bearbeiten (§6.4).
//
// Links, was das Unternehmen SIEHT: Crew Score, Rohwert-Satz, fünf Achsen mit dem Median der Vergleichsgruppe,
// Gründe, Verbesserungen (mit Weg in den OSM-Editor), was fehlt, Gruppe (Art, Stil, Radius, Anzahl — nie
// Namen), Verlauf, seit wann sichtbar, Meldungen (nur Art und Datum).
// Rechts, was es ÄNDERN darf — Anzeige, nie Score: Beschreibung, Preisniveau, Reservierung, Öffnungszeiten,
// Fotos, Events, „geschlossen/umgezogen“. Jede Änderung steht unten und ist rückgängig machbar.
// Alle Regeln prüft der Server (0062); diese Datei zeigt nur, was er sagt.

import { esc } from '../core/html.js';
import { scoreRing } from './ring.js';
import { ACHSEN, AENDERUNG_FELDER, KLASSEN, MELDUNG_ARTEN, STUFE_TEXT, WEGE, artText, stilText, grundText, tagText } from './texte.js';
import { TAGE_DE, lesen, schreiben } from './oeffnungszeiten.js';
import { rpc, funktion, fotoHochladen, vorschauLinks } from './daten.js';
import { fotoVorbereiten } from './foto.js';

const PREIS = { 1: '€', 2: '€€', 3: '€€€' };
const RUECKGAENGIG = new Set(['oeffnungszeiten', 'beschreibung', 'preisniveau', 'reservierung_url', 'geschlossen', 'umgezogen', 'event_neu', 'event_weg']);
const EVENT_ARTEN = [['', 'Art wählen (optional)'], ['konzert', 'Konzert'], ['party', 'Party'], ['markt', 'Markt'], ['kultur', 'Kultur'], ['sport', 'Sport']];

export async function inhaberZeigen(main, { seite, zurueck, neuLaden, beanspruchen }) {
  let a = null;               // Antwort von unternehmen_inhaber_ansicht
  let faehig = { bildpruefung: false };
  let vorschau = {};
  const meldungen = {};       // je Bereich eine Rückmeldung { text, gut }
  let woche = null;           // Entwurf der Öffnungszeiten
  let wocheQuelle = '';
  let bestaetigen = '';       // 'geschlossen' | 'umgezogen' — zweiter Tipp nötig

  const melde = (bereich, text, gut = false) => { meldungen[bereich] = text ? { text, gut } : null; };
  const meldungHtml = (bereich) => {
    const m = meldungen[bereich];
    return m ? `<p class="ort-meldung" data-role="ort-meldung-${bereich}"${m.gut ? ' data-gut' : ''}>${esc(m.text)}</p>` : '';
  };

  async function laden() {
    a = await rpc('unternehmen_inhaber_ansicht', { p_ort: seite.id });
    if (!a?.ok) return;
    const offen = (a.daten?.fotos || []).filter((f) => f.pruefung !== 'ok' && f.pfad).map((f) => f.pfad);
    vorschau = offen.length ? await vorschauLinks(offen).catch(() => ({})) : {};
    const text = a.daten?.oeffnungszeiten || '';
    const osm = a.osm?.oeffnungszeiten || '';
    woche = lesen(text) || (text ? null : lesen(osm));
    wocheQuelle = text ? (lesen(text) ? 'unternehmen' : 'unlesbar') : (lesen(osm) ? 'osm' : 'leer');
    if (!woche) woche = TAGE_DE.map(() => null);
  }

  // ------------------------------------------------------------------------------------------------
  function statusHtml() {
    const weg = a.pruefweg ? WEGE[a.pruefweg]?.titel : '';
    if (a.status === 'geprueft') {
      return `<section class="ort-karte" data-role="ort-status"><h2>Ihr Unternehmen</h2>
        <p class="ort-text">Bestätigt${weg ? ` über „${esc(weg)}“` : ''}${a.pruef_kontakt ? ` (${esc(a.pruef_kontakt)})` : ''} am ${esc(tagText(a.geprueft_am))}. Nächste Bestätigung fällig am ${esc(tagText(a.erneut_pruefen_am))} — wir erinnern Sie per Mail.</p></section>`;
    }
    return `<section class="ort-karte ort-hinweis-karte" data-role="ort-status" data-status="${esc(a.status)}"><h2>Bearbeiten ist gesperrt</h2>
      <p class="ort-text">${esc(grundText(a.bearbeiten_grund || a.status))}</p>
      ${a.status === 'beansprucht' || a.status === 'streit' ? '<div class="ort-knopfreihe"><button class="ort-knopf" data-role="ort-neu-bestaetigen">Jetzt bestätigen</button></div>' : ''}
      <p class="ort-leise" style="margin-top:8px">Ihre Angaben bleiben öffentlich sichtbar.</p></section>`;
  }

  function scoreHtml() {
    const s = a.score;
    let ring = scoreRing({});
    let satz = 'Für Ihren Ort ist noch kein Crew Score berechnet. Er entsteht automatisch aus öffentlichen Daten und echten Besuchen.';
    let stufe = 'Noch nicht bewertet';
    if (s) {
      if (s.neu) {
        ring = scoreRing({ neu: true });
        stufe = STUFE_TEXT.neu;
        satz = `Noch keine Bewertung — frisch in OpenStreetMap.${s.rohwert != null ? ` Ihr Rohwert heute: ${s.rohwert}.` : ''}`;
      } else {
        ring = scoreRing({ wert: s.wert });
        stufe = s.wert >= 70 ? STUFE_TEXT[s.stufe] : 'unter 70';
        satz = `Ihr Rohwert ${s.rohwert ?? '–'} — damit besser als ${s.wert} % der Orte dieser Art im Land.`;
      }
    }
    const sichtbar = a.sichtbar
      ? `In der App sichtbar${a.sichtbar_seit ? ` seit ${tagText(a.sichtbar_seit)}` : ''}.`
      : s?.ko_grund ? 'In der App versteckt: als geschlossen gemeldet.'
        : 'In der App nicht sichtbar — sichtbar wird ein Ort ab Crew Score 70 (oder als „Neu“).';
    return `<section class="ort-karte" data-role="ort-inhaber-score">
      <div class="ort-kopf"><div style="min-width:0">
        <h2 class="ort-abschnitt-titel">Crew Score</h2>
        <p class="ort-rohsatz" data-role="ort-rohwert-satz">${esc(satz)}</p>
        <p class="ort-leise" style="margin-top:8px" data-role="ort-sichtbar-seit">${esc(sichtbar)}</p>
      </div><div class="ort-ringplatz">${ring}<span class="ort-stufe">${esc(stufe)}</span></div></div>
      <p class="ort-leise" style="margin-top:12px">Was Sie hier eintragen, verbessert die Darstellung — der Score folgt nur öffentlichen Daten und echten Besuchen. Kaufen lässt er sich nicht.</p>
    </section>`;
  }

  function achsenHtml() {
    const achsen = a.score?.achsen;
    if (!achsen) return '';
    const median = a.gruppe?.median || {};
    const zeilenHtml = ACHSEN.map(([k, name, erklaerung]) => {
      const w = Math.max(0, Math.min(100, Math.round(Number(achsen[k] ?? 0))));
      const m = median[k] != null ? Math.max(0, Math.min(100, Math.round(Number(median[k])))) : null;
      return `<div class="ort-achse" data-role="ort-achse" data-achse="${k}" title="${esc(erklaerung)}">
        <div class="ort-achse-kopf"><b>${esc(name)}</b><span>${w}${m != null ? ` · Median ${m}` : ''}</span></div>
        <div class="ort-achse-spur" role="img" aria-label="${esc(`${name}: ${w} von 100${m != null ? `, Median der Vergleichsgruppe ${m}` : ''}`)}">
          <span class="ort-achse-wert" style="width:${w}%"${m != null && w < m ? ' data-unter' : ''}></span>
          ${m != null ? `<span class="ort-achse-median" style="left:${m}%" data-role="ort-median"></span>` : ''}
        </div></div>`;
    }).join('');
    const g = a.gruppe;
    const gruppe = g
      // Feinschliff 01.10.2026: verglichen wird mit allen Orten derselben Art im ganzen Land (kein Umkreis, kein Stil);
      // sind es im Land zu wenige, mit allen Ländern, für die Crew Orte kennt.
      ? `Verglichen mit ${g.anzahl} Orten der Art ${artText(g.art)}${g.ersatz_land ? ' in allen Ländern, die Crew kennt — im eigenen Land gibt es zu wenige' : ' im ganzen Land'}. Namen anderer Orte zeigt Crew nie.`
      : 'Die Vergleichsgruppe wird beim nächsten Monatslauf gebildet.';
    return `<section class="ort-karte" data-role="ort-achsen"><h2>Die fünf Teilwerte</h2>
      <div class="ort-achsen">${zeilenHtml}</div>
      <div class="ort-legende"><span><i></i>Ihr Wert</span><span><i data-median></i>Median vergleichbarer Orte</span></div>
      <p class="ort-leise" style="margin-top:12px" data-role="ort-gruppe">${esc(gruppe)}</p></section>`;
  }

  function gruendeHtml() {
    const s = a.score;
    if (!s) return '';
    const gruende = (s.gruende || []).slice(0, 3);
    const verb = (s.verbesserungen || []).slice(0, 3);
    const fehlt = (s.fehlt || []).map((f) => (typeof f === 'string' ? f : f?.text || '')).filter(Boolean);
    const osmLink = a.osm?.bearbeiten;
    return `<section class="ort-karte" data-role="ort-gruende-inhaber"><h2>Was für Sie spricht</h2>
      ${gruende.length ? `<ul class="ort-liste">${gruende.map((g) => `<li><span class="ort-zeichen" aria-hidden="true">✓</span><span class="ort-zeile-text">${esc(g.text || '')}</span></li>`).join('')}</ul>` : '<p class="ort-leise">Noch keine Gründe berechnet.</p>'}
      <h2 style="margin-top:20px">Was Sie tun können</h2>
      ${verb.length ? `<ul class="ort-liste" data-role="ort-verbesserungen">${verb.map((v) => {
        const text = typeof v === 'string' ? v : v?.text || '';
        const link = (typeof v === 'object' && v?.link) || ((typeof v === 'object' && v?.achse === 'pflege') || /OpenStreetMap/.test(text) ? osmLink : '');
        return `<li><span class="ort-zeichen" data-ton="warn" aria-hidden="true">→</span><span class="ort-zeile-text">${esc(text)}${link ? ` <a class="ort-textknopf" href="${esc(link)}" target="_blank" rel="noopener">Zum OSM-Editor</a>` : ''}</span></li>`;
      }).join('')}</ul>` : '<p class="ort-leise">Gerade gibt es nichts, das Sie selbst verbessern könnten.</p>'}
      ${fehlt.length ? `<p class="ort-leise" style="margin-top:12px" data-role="ort-fehlt">Fehlt: ${esc(fehlt.join(', '))}.</p>` : ''}
    </section>`;
  }

  function verlaufHtml() {
    const v = (a.verlauf || []).filter((p) => p.crew_score != null);
    if (v.length < 2) {
      return `<section class="ort-karte" data-role="ort-verlauf"><h2>Verlauf</h2><p class="ort-leise">${v.length === 1 ? `${esc(monat(v[0].monat))}: Crew Score ${v[0].crew_score}. ` : ''}Die Kurve entsteht mit den Monatsläufen (jeweils am 1.).</p></section>`;
    }
    const B = 320; const H = 132; const L = 26; const R = 12; const O = 12; const U = 22;
    const x = (i) => L + (i * (B - L - R)) / (v.length - 1);
    const y = (w) => O + ((100 - w) * (H - O - U)) / 100;
    const pfad = v.map((p, i) => `${i ? 'L' : 'M'}${x(i).toFixed(1)},${y(p.crew_score).toFixed(1)}`).join(' ');
    const letzte = v[v.length - 1];
    return `<section class="ort-karte" data-role="ort-verlauf"><h2>Verlauf des Crew Scores</h2>
      <svg class="ort-verlauf" viewBox="0 0 ${B} ${H}" role="img" aria-label="${esc(v.map((p) => `${monat(p.monat)}: ${p.crew_score}`).join(', '))}">
        <line class="v-grenze" x1="${L}" x2="${B - R}" y1="${y(70)}" y2="${y(70)}"/>
        <text class="v-text" x="${L - 4}" y="${y(70) + 4}" text-anchor="end">70</text>
        <path class="v-linie" d="${pfad}"/>
        ${v.map((p, i) => `<circle class="v-punkt" cx="${x(i).toFixed(1)}" cy="${y(p.crew_score).toFixed(1)}" r="${i === v.length - 1 ? 4 : 2.5}"/>`).join('')}
        <text class="v-wert" x="${x(v.length - 1).toFixed(1)}" y="${(y(letzte.crew_score) - 9).toFixed(1)}" text-anchor="end">${letzte.crew_score}</text>
        ${v.map((p, i) => (i === 0 || i === v.length - 1 || v.length <= 6 ? `<text class="v-text" x="${x(i).toFixed(1)}" y="${H - 6}" text-anchor="${i === 0 ? 'start' : i === v.length - 1 ? 'end' : 'middle'}">${esc(monat(p.monat, true))}</text>` : '')).join('')}
      </svg>
      <p class="ort-leise">Gestrichelt: ab 70 in der App sichtbar.</p></section>`;
  }

  function meldungenHtml() {
    const m = a.meldungen || [];
    return `<section class="ort-karte" data-role="ort-meldungen"><h2>Meldungen zu Ihrem Eintrag</h2>
      ${m.length ? `<ul class="ort-liste">${m.map((x) => `<li><span class="ort-zeichen" data-ton="leise" aria-hidden="true">!</span><span class="ort-zeile-text">${esc(MELDUNG_ARTEN[x.art] || x.art)}</span><span class="ort-zeile-neben">${esc(tagText(x.datum))}</span></li>`).join('')}</ul>
        <p class="ort-leise" style="margin-top:8px">Meldungen sind anonym. Crew prüft sie automatisch; nur bestätigte wirken sich aus.</p>` : '<p class="ort-leise">Keine Meldungen.</p>'}</section>`;
  }

  // ------------------------------------------------------------------------------------------------
  const darf = () => a.bearbeiten === true;
  const aus = () => (darf() ? '' : ' disabled');

  function angabenHtml() {
    const d = a.daten || {};
    const text = d.beschreibung || '';
    return `<section class="ort-karte" data-role="ort-angaben"><h2>Angaben <span class="ort-vom-unternehmen">vom Unternehmen</span></h2>
      <label class="ort-beschriftung" for="ort-beschreibung">Beschreibung <span class="ort-zaehler" data-role="ort-zaehler">${text.length}/300</span></label>
      <textarea id="ort-beschreibung" class="ort-bereich" maxlength="300" data-role="ort-beschreibung-feld"${aus()}>${esc(text)}</textarea>
      <p class="ort-leise" style="margin-top:6px">Ohne Links und ohne Preise oder Rabatte.</p>
      <div class="ort-knopfreihe"><button class="ort-knopf-leise" data-role="ort-beschreibung-speichern"${aus()}>Beschreibung speichern</button></div>
      ${meldungHtml('beschreibung')}
      <span class="ort-beschriftung">Preisniveau</span>
      <div class="ort-segmente" role="group" aria-label="Preisniveau" data-role="ort-preisniveau">
        ${[1, 2, 3].map((p) => `<button data-preis="${p}" aria-pressed="${d.preisniveau === p}"${aus()}>${PREIS[p]}</button>`).join('')}
        <button data-preis="" aria-pressed="${!d.preisniveau}"${aus()}>keine Angabe</button>
      </div>
      ${meldungHtml('preisniveau')}
      <label class="ort-beschriftung" for="ort-reservierung">Link zum Reservieren</label>
      <input id="ort-reservierung" class="ort-feld" type="url" inputmode="url" placeholder="https://…" value="${esc(d.reservierung_url || '')}"${aus()} />
      <p class="ort-leise" style="margin-top:6px">Auf Ihrer Website oder bei einem bekannten Reservierungsdienst (OpenTable, Quandoo, TheFork, resmio …).</p>
      <div class="ort-knopfreihe"><button class="ort-knopf-leise" data-role="ort-reservierung-speichern"${aus()}>Link speichern</button></div>
      ${meldungHtml('reservierung_url')}
    </section>`;
  }

  function zeitenHtml() {
    const quelle = {
      unternehmen: '', osm: 'Vorgefüllt aus OpenStreetMap — speichern Sie, um sie als Ihre Zeiten zu übernehmen.',
      unlesbar: `Ihre gespeicherten Zeiten („${a.daten?.oeffnungszeiten || ''}“) kann der Editor nicht lesen. Neu eintragen ersetzt sie.`,
      leer: 'Noch keine Öffnungszeiten — weder von Ihnen noch in OpenStreetMap.',
    }[wocheQuelle];
    const sperre = a.sperre_oeffnungszeiten_bis ? `<p class="ort-meldung">${esc(grundText('oeffnungszeiten_gesperrt', { bis: a.sperre_oeffnungszeiten_bis }))}</p>` : '';
    const zeilenHtml = TAGE_DE.map((tag, i) => {
      const w = woche[i];
      const zu = !w || w.length === 0;
      const [e1 = ['', ''], e2 = ['', '']] = w || [];
      return `<div class="ort-tag" data-role="ort-tag" data-tag="${i}"${zu ? ' data-zu' : ''}>
        <b>${tag}</b>
        <label class="ort-tag-offen" title="${tag} geöffnet"><input type="checkbox" data-role="ort-tag-offen" aria-label="${tag} geöffnet"${zu ? '' : ' checked'}${aus()} /></label>
        <span class="ort-tag-zu-text">geschlossen</span>
        <div class="ort-tag-zeiten">
          <span class="ort-fenster"><input type="time" data-feld="v1" value="${esc(e1[0])}" aria-label="${tag} von"${aus()} />–<input type="time" data-feld="b1" value="${esc(e1[1] === '24:00' ? '23:59' : e1[1])}" aria-label="${tag} bis"${aus()} /></span>
          <span class="ort-fenster" data-role="ort-fenster-2"${e2[0] ? '' : ' hidden'}><input type="time" data-feld="v2" value="${esc(e2[0])}" aria-label="${tag} zweites Fenster von"${aus()} />–<input type="time" data-feld="b2" value="${esc(e2[1] === '24:00' ? '23:59' : e2[1])}" aria-label="${tag} zweites Fenster bis"${aus()} /></span>
          ${e2[0] || !darf() ? '' : '<button class="ort-textknopf" data-role="ort-fenster-dazu" aria-label="Zweites Zeitfenster (z. B. nach der Mittagspause)">+ Pause</button>'}
        </div></div>`;
    }).join('');
    return `<section class="ort-karte" data-role="ort-oeffnungszeiten"><h2>Öffnungszeiten <span class="ort-vom-unternehmen">vom Unternehmen</span></h2>
      ${quelle ? `<p class="ort-leise" style="margin-bottom:12px">${esc(quelle)}</p>` : ''}
      <div class="ort-woche">${zeilenHtml}</div>
      <p class="ort-leise" style="margin-top:8px">„+ Pause“ fügt ein zweites Zeitfenster hinzu (z. B. nach der Mittagspause). Ihre Zeiten haben in der App Vorrang vor OpenStreetMap. Mehr als 3 Änderungen in 7 Tagen sperren das Feld für 7 Tage.</p>
      ${sperre}
      <div class="ort-knopfreihe"><button class="ort-knopf-leise" data-role="ort-zeiten-speichern"${aus()}>Öffnungszeiten speichern</button>
        ${a.daten?.oeffnungszeiten ? `<button class="ort-textknopf" data-role="ort-zeiten-loeschen"${aus()}>Meine Zeiten entfernen</button>` : ''}</div>
      ${meldungHtml('oeffnungszeiten')}
      ${a.osm?.oeffnungszeiten ? `<p class="ort-leise" style="margin-top:8px">In OpenStreetMap: ${esc(a.osm.oeffnungszeiten)} · <a class="ort-textknopf" href="${esc(a.osm.bearbeiten)}" target="_blank" rel="noopener">dort ändern</a></p>` : ''}
    </section>`;
  }

  function fotosHtml() {
    const fotos = a.daten?.fotos || [];
    const marke = { ok: 'Geprüft', ausstehend: 'Wartet auf Prüfung', abgelehnt: 'Abgelehnt' };
    const offene = fotos.some((f) => f.pruefung === 'ausstehend');
    return `<section class="ort-karte" data-role="ort-fotos-inhaber"><h2>Fotos (${fotos.length}/10)</h2>
      ${fotos.length ? `<div class="ort-fotos">${fotos.map((f, i) => {
        const src = f.url || vorschau[f.pfad] || '';
        return `<div class="ort-foto" data-role="ort-foto" data-foto="${esc(f.id)}" data-pruefung="${esc(f.pruefung)}">
          ${src ? `<img src="${esc(src)}" alt="Foto ${i + 1}" loading="lazy" />` : ''}
          <span class="ort-foto-marke">${i === 0 ? 'Titelbild · ' : ''}${esc(marke[f.pruefung] || f.pruefung)}</span>
          ${darf() ? `<button class="ort-foto-knopf" data-role="ort-foto-weg" aria-label="Foto ${i + 1} entfernen">✕</button>` : ''}
          ${darf() && i > 0 ? `<button class="ort-foto-knopf" data-links data-role="ort-foto-titel">Als Titelbild</button>` : ''}
        </div>`;
      }).join('')}</div>` : '<p class="ort-leise">Noch keine Fotos. Das erste wird in der App zum Titelbild.</p>'}
      ${offene || !faehig.bildpruefung ? `<p class="ort-leise" style="margin-top:12px" data-role="ort-bildpruefung">${faehig.bildpruefung
        ? 'Neue Fotos werden automatisch auf Nacktheit und Gewalt geprüft und erscheinen danach öffentlich.'
        : 'Öffentlich erscheinen Fotos erst nach einer automatischen Prüfung auf Nacktheit und Gewalt. Diese Prüfung ist bei Crew noch nicht eingeschaltet — bis dahin sieht nur Ihr Konto Ihre Fotos.'}</p>` : ''}
      <label class="ort-haekchen" data-role="ort-rechte"><input type="checkbox" id="ort-rechte"${aus()} />Ich besitze die Rechte an diesen Fotos oder habe die ausdrückliche Erlaubnis, sie zu zeigen.</label>
      <div class="ort-knopfreihe">
        <label class="ort-knopf-leise" data-role="ort-foto-waehlen" aria-disabled="true" style="opacity:.5">Fotos wählen<input id="ort-foto-datei" type="file" accept="image/*" multiple hidden disabled /></label>
      </div>
      <p class="ort-leise" data-role="ort-foto-fortschritt" aria-live="polite"></p>
      <p class="ort-leise" style="margin-top:6px">Je Bild höchstens 5 MB. Ihr Browser rechnet jedes Bild neu und entfernt dabei Metadaten wie den Aufnahmeort.</p>
      ${meldungHtml('fotos')}
    </section>`;
  }

  function eventsHtml() {
    const ev = a.events || [];
    const zeile = (e) => {
      const wann = e.beginn ? new Date(e.beginn).toLocaleString('de-AT', { weekday: 'short', day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' }) : '';
      const score = e.neu ? 'Neu' : e.crew_score != null ? `Crew Score ${e.crew_score}` : 'noch nicht bewertet';
      const sicht = e.abgesagt ? 'abgesagt' : e.freigegeben ? 'in der App sichtbar' : e.crew_score != null || e.klasse ? 'nicht in der App' : '';
      const quellen = (e.quellen || []).map((q) => (q === 'unternehmen' ? 'Sie' : q)).join(', ');
      return `<li data-role="ort-event" data-event="${esc(e.id)}"><span class="ort-zeichen" data-ton="${e.freigegeben ? '' : 'leise'}" aria-hidden="true">♪</span>
        <span class="ort-zeile-text"><b>${esc(e.name)}</b><br /><span class="ort-leise">${esc(wann)} · ${esc(score)}${sicht ? ` · ${esc(sicht)}` : ''}${quellen ? ` · Quelle: ${esc(quellen)}` : ''}</span>
        ${e.klasse ? `<br /><span class="ort-leise" data-role="ort-event-klasse">${esc(KLASSEN[e.klasse] || e.klasse)}</span>` : '<br /><span class="ort-leise">Wird beim nächsten Lauf eingeordnet und bewertet.</span>'}</span>
        ${e.von_ihnen && darf() && (!e.beginn || new Date(e.beginn) > new Date()) ? `<button class="ort-textknopf" data-role="ort-event-weg">Zurückziehen</button>` : ''}</li>`;
    };
    return `<section class="ort-karte" data-role="ort-events"><h2>Events an Ihrem Ort</h2>
      ${ev.length ? `<ul class="ort-liste">${ev.map(zeile).join('')}</ul>` : '<p class="ort-leise">Keine Events in den letzten 90 Tagen oder demnächst.</p>'}
      <p class="ort-leise" style="margin-top:12px">Ihre Events laufen durch dieselbe Bewertung wie alle anderen. Sie machen Ihren Ort nicht bekannter — erst, wenn eine unabhängige Quelle (z. B. der Veranstaltungskalender der Gemeinde) dasselbe Event nennt.</p>
      ${darf() ? `<details data-role="ort-event-neu" style="margin-top:12px"><summary class="ort-textknopf">Event eintragen</summary>
        <label class="ort-beschriftung" for="ev-name">Name</label><input id="ev-name" class="ort-feld" maxlength="120" />
        <label class="ort-beschriftung" for="ev-beginn">Beginn</label><input id="ev-beginn" class="ort-feld" type="datetime-local" />
        <label class="ort-beschriftung" for="ev-ende">Ende (optional)</label><input id="ev-ende" class="ort-feld" type="datetime-local" />
        <label class="ort-beschriftung" for="ev-preis">Preis ab (€, optional)</label><input id="ev-preis" class="ort-feld" type="number" min="0" step="0.5" inputmode="decimal" />
        <label class="ort-beschriftung" for="ev-url">Link (optional, https)</label><input id="ev-url" class="ort-feld" type="url" placeholder="https://…" />
        <label class="ort-beschriftung" for="ev-art">Art</label><select id="ev-art" class="ort-auswahl">${EVENT_ARTEN.map(([w, t]) => `<option value="${w}">${t}</option>`).join('')}</select>
        <div class="ort-knopfreihe"><button class="ort-knopf" data-role="ort-event-speichern">Event eintragen</button></div>
      </details>` : ''}
      ${meldungHtml('events')}
    </section>`;
  }

  function geschlossenHtml() {
    const d = a.daten || {};
    let stand = '';
    if (d.geschlossen_bestaetigt_am) stand = `Als geschlossen gemeldet — in der App versteckt seit ${tagText(d.geschlossen_bestaetigt_am)}.`;
    else if (d.geschlossen_frist_bis) stand = `Als ${d.umgezogen_nach ? 'umgezogen' : 'geschlossen'} gemeldet. Wir warten bis ${tagText(d.geschlossen_frist_bis)}, dann wird der Ort in der App versteckt.`;
    return `<section class="ort-karte" data-role="ort-geschlossen"><h2>Geschlossen oder umgezogen?</h2>
      ${stand ? `<p class="ort-text" data-role="ort-geschlossen-stand">${esc(stand)} Zurücknehmen können Sie das unten unter „Ihre Änderungen“.</p>` : `
      <p class="ort-text">Crew prüft sofort Ihre Website. Antwortet sie nicht mehr (oder sagt OpenStreetMap ebenfalls „geschlossen“), wird der Ort gleich versteckt — sonst nach 14 Tagen. Ein Umzug überträgt keinen Score: der neue Ort beginnt als „Neu“.</p>
      ${bestaetigen === 'umgezogen' ? '<label class="ort-beschriftung" for="ort-nach">Neue Adresse</label><input id="ort-nach" class="ort-feld" maxlength="160" placeholder="Straße, Ort" />' : ''}
      <div class="ort-knopfreihe">
        <button class="ort-knopf-leise ort-knopf-gefahr" data-role="ort-melde-geschlossen"${aus()}>${bestaetigen === 'geschlossen' ? 'Wirklich als geschlossen melden' : 'Dauerhaft geschlossen'}</button>
        <button class="ort-knopf-leise" data-role="ort-melde-umgezogen"${aus()}>${bestaetigen === 'umgezogen' ? 'Umzug melden' : 'Umgezogen'}</button>
      </div>`}
      ${meldungHtml('geschlossen')}
    </section>`;
  }

  function aenderungenHtml() {
    const liste = a.aenderungen || [];
    const kurz = (w) => {
      if (w == null) return '–';
      if (typeof w === 'string') return w.length > 60 ? `${w.slice(0, 57)}…` : w;
      if (typeof w === 'number') return PREIS[w] || String(w);
      if (w.name) return w.name;
      if (w.weg) return WEGE[w.weg]?.titel || w.weg;
      if (w.nach) return w.nach;
      return '';
    };
    return `<section class="ort-karte" data-role="ort-aenderungen"><h2>Ihre Änderungen</h2>
      ${liste.length ? `<ul class="ort-liste">${liste.map((x) => `<li data-role="ort-aenderung" data-aenderung="${x.id}">
        <span class="ort-zeile-text"><b>${esc(AENDERUNG_FELDER[x.feld] || x.feld)}</b>${x.feld === 'inhaber' ? '' : `<br /><span class="ort-leise">${esc(kurz(x.neu ?? x.alt))}</span>`}</span>
        <span class="ort-zeile-neben">${esc(tagText(x.am))}</span>
        ${x.rueckgaengig_am ? '<span class="ort-zeile-neben">zurückgenommen</span>'
          : RUECKGAENGIG.has(x.feld) && darf() ? '<button class="ort-textknopf" data-role="ort-rueckgaengig">Rückgängig</button>' : ''}</li>`).join('')}</ul>` : '<p class="ort-leise">Noch keine Änderungen.</p>'}
      ${meldungHtml('aenderungen')}
    </section>`;
  }

  // ------------------------------------------------------------------------------------------------
  function zeichnen() {
    if (!a?.ok) {
      main.innerHTML = `<section class="ort-lage"><h1>Kein Zugang</h1><p class="ort-text">${esc(grundText(a?.grund, a || {}))}</p>
        <button class="ort-knopf-leise" data-role="ort-zurueck">Zur öffentlichen Seite</button></section>`;
      main.querySelector('[data-role="ort-zurueck"]').onclick = zurueck;
      return;
    }
    main.innerHTML = `
      <div class="ort-knopfreihe" style="margin-top:0"><button class="ort-textknopf" data-role="ort-zurueck">‹ Öffentliche Seite</button></div>
      <header><h1 class="ort-name" data-role="ort-inhaber-name">${esc(a.name)}</h1>
        <p class="ort-art">${esc(artText(a.art))}${a.stil ? ` · ${esc(stilText(a.stil))}` : ''} · Unternehmens-Bereich</p></header>
      <div class="ort-raster">
        <div class="ort-spalte">${statusHtml()}${scoreHtml()}${achsenHtml()}${gruendeHtml()}${verlaufHtml()}${meldungenHtml()}</div>
        <div class="ort-spalte">${angabenHtml()}${zeitenHtml()}${fotosHtml()}${eventsHtml()}${geschlossenHtml()}${aenderungenHtml()}</div>
      </div>`;
    binden();
  }

  async function nachAenderung(bereich, r, gutText) {
    for (const k of Object.keys(meldungen)) meldungen[k] = null;   // nur die Rückmeldung der letzten Handlung steht da
    if (r?.ok) melde(bereich, r.unveraendert ? 'Unverändert.' : gutText, true);
    else melde(bereich, grundText(r?.grund, r || {}));
    await laden();
    await neuLaden();
    zeichnen();
    main.querySelector(`[data-role="ort-meldung-${bereich}"]`)?.scrollIntoView({ block: 'nearest' });
  }
  const aendern = (feld, wert) => rpc('unternehmen_aendern', { p_ort: a.id, p_feld: feld, p_wert: wert });

  function wocheAusFormular() {
    const neu = TAGE_DE.map(() => []);
    for (const zeile of main.querySelectorAll('[data-role="ort-tag"]')) {
      const i = Number(zeile.dataset.tag);
      if (!zeile.querySelector('[data-role="ort-tag-offen"]').checked) continue;
      const wert = (f) => zeile.querySelector(`[data-feld="${f}"]`).value;
      const bis = (b) => (b === '23:59' ? '24:00' : b);
      if (wert('v1') && wert('b1')) neu[i].push([wert('v1'), bis(wert('b1'))]);
      if (wert('v2') && wert('b2')) neu[i].push([wert('v2'), bis(wert('b2'))]);
      if (!neu[i].length) return { fehler: `${TAGE_DE[i]}: bitte eine Zeit eintragen oder „offen“ abwählen.` };
    }
    return { woche: neu };
  }

  function binden() {
    // Jeder Knopf zeigt sofort, dass er arbeitet: alte Rückmeldung seiner Karte weg, Knopf gesperrt, bis der
    // Server antwortet (sonst stünde nach dem zweiten Speichern noch das „gespeichert“ vom ersten da).
    const an = (rolle, fn) => main.querySelectorAll(`[data-role="${rolle}"]`).forEach((k) => {
      k.onclick = async (e) => {
        if (k.dataset.laeuft) return;
        k.dataset.laeuft = '1';
        k.closest('.ort-karte')?.querySelectorAll('.ort-meldung').forEach((m) => m.remove());
        if ('disabled' in k) k.disabled = true;
        try { await fn(e, k); } finally { delete k.dataset.laeuft; if ('disabled' in k && k.isConnected) k.disabled = false; }
      };
    });
    an('ort-zurueck', () => zurueck());
    an('ort-neu-bestaetigen', () => beanspruchen());

    const beschreibung = main.querySelector('#ort-beschreibung');
    if (beschreibung) beschreibung.oninput = () => { main.querySelector('[data-role="ort-zaehler"]').textContent = `${beschreibung.value.length}/300`; };
    an('ort-beschreibung-speichern', async () => nachAenderung('beschreibung', await aendern('beschreibung', beschreibung.value), 'Beschreibung gespeichert.'));
    main.querySelectorAll('[data-role="ort-preisniveau"] button').forEach((k) => {
      k.onclick = async () => nachAenderung('preisniveau', await aendern('preisniveau', k.dataset.preis ? Number(k.dataset.preis) : null), 'Preisniveau gespeichert.');
    });
    an('ort-reservierung-speichern', async () => nachAenderung('reservierung_url', await aendern('reservierung_url', main.querySelector('#ort-reservierung').value), 'Link gespeichert.'));

    an('ort-fenster-dazu', (e, k) => { k.parentElement.querySelector('[data-role="ort-fenster-2"]').hidden = false; k.remove(); });
    main.querySelectorAll('[data-role="ort-tag-offen"]').forEach((k) => {
      k.onchange = () => { k.closest('[data-role="ort-tag"]').toggleAttribute('data-zu', !k.checked); };
    });
    an('ort-zeiten-speichern', async () => {
      const f = wocheAusFormular();
      if (f.fehler) { melde('oeffnungszeiten', f.fehler); zeichnen(); return; }
      await nachAenderung('oeffnungszeiten', await aendern('oeffnungszeiten', schreiben(f.woche) || null), 'Öffnungszeiten gespeichert.');
    });
    an('ort-zeiten-loeschen', async () => nachAenderung('oeffnungszeiten', await aendern('oeffnungszeiten', null), 'Ihre Zeiten sind entfernt — es gelten wieder die aus OpenStreetMap.'));

    const rechte = main.querySelector('#ort-rechte');
    const datei = main.querySelector('#ort-foto-datei');
    const waehlen = main.querySelector('[data-role="ort-foto-waehlen"]');
    if (rechte && datei) {
      rechte.onchange = () => {
        datei.disabled = !rechte.checked;
        waehlen.style.opacity = rechte.checked ? '1' : '.5';
        waehlen.setAttribute('aria-disabled', String(!rechte.checked));
      };
      datei.onchange = async () => {
        const liste = [...datei.files];
        const ergebnisse = [];
        for (const [i, f] of liste.entries()) {
          const fortschritt = main.querySelector('[data-role="ort-foto-fortschritt"]');
          if (fortschritt) fortschritt.textContent = `Foto ${i + 1} von ${liste.length} wird vorbereitet und geprüft …`;
          const v = await fotoVorbereiten(f);
          if (!v.ok) { ergebnisse.push(`${f.name}: ${grundText(v.grund)}`); continue; }
          const h = await fotoHochladen(a.schluessel, v.blob);
          if (!h.ok) { ergebnisse.push(`${f.name}: ${grundText(h.grund)}`); continue; }
          const r = await funktion('foto', { ort: a.id, pfad: h.pfad, rechte: true });
          if (typeof r?.bildpruefung === 'boolean') faehig.bildpruefung = r.bildpruefung;
          ergebnisse.push(r?.ok ? `${f.name}: aufgenommen${r.pruefung === 'ok' ? ' und geprüft' : r.pruefung === 'abgelehnt' ? ' — aber von der Bildprüfung abgelehnt' : ''}.` : `${f.name}: ${grundText(r?.grund, r || {})}`);
        }
        melde('fotos', ergebnisse.join(' '), ergebnisse.every((e) => /aufgenommen/.test(e)));
        await laden();
        await neuLaden();
        zeichnen();
      };
    }
    an('ort-foto-weg', async (e, k) => {
      const r = await funktion('foto_entfernen', { ort: a.id, foto: k.closest('[data-role="ort-foto"]').dataset.foto });
      await nachAenderung('fotos', r, 'Foto entfernt.');
    });
    an('ort-foto-titel', async (e, k) => {
      const r = await rpc('unternehmen_foto_titel', { p_ort: a.id, p_foto: k.closest('[data-role="ort-foto"]').dataset.foto });
      await nachAenderung('fotos', r, 'Titelbild gewählt.');
    });

    an('ort-event-speichern', async () => {
      const wert = (id) => main.querySelector(`#${id}`).value.trim();
      const iso = (v) => (v ? new Date(v).toISOString() : null);
      const ev = { name: wert('ev-name'), beginn: iso(wert('ev-beginn')), ende: iso(wert('ev-ende')), preis: wert('ev-preis') || null, url: wert('ev-url') || null, art: wert('ev-art') || null };
      if (!ev.name) { melde('events', grundText('name')); zeichnen(); return; }
      if (!ev.beginn) { melde('events', grundText('beginn')); zeichnen(); return; }
      await nachAenderung('events', await rpc('unternehmen_event_speichern', { p_ort: a.id, p_event: ev }), 'Event eingetragen. Es wird beim nächsten Lauf bewertet.');
    });
    an('ort-event-weg', async (e, k) => nachAenderung('events', await rpc('unternehmen_event_entfernen', { p_ort: a.id, p_event: k.closest('[data-role="ort-event"]').dataset.event }), 'Event zurückgezogen.'));

    an('ort-melde-geschlossen', async () => {
      if (bestaetigen !== 'geschlossen') { bestaetigen = 'geschlossen'; melde('geschlossen', 'Bitte noch einmal tippen, um es zu bestätigen.'); zeichnen(); return; }
      bestaetigen = '';
      const r = await funktion('geschlossen', { ort: a.id, art: 'geschlossen' });
      await nachAenderung('geschlossen', r, r?.sofort ? 'Gemeldet. Ihre Website antwortet nicht mehr — der Ort ist in der App ab sofort versteckt.'
        : `Gemeldet. ${r?.grund === 'meet_30_tage' ? 'In den letzten 30 Tagen war jemand mit Crew dort' : 'Ihre Website antwortet noch'} — deshalb wird der Ort erst nach 14 Tagen versteckt.`);
    });
    an('ort-melde-umgezogen', async () => {
      if (bestaetigen !== 'umgezogen') { bestaetigen = 'umgezogen'; melde('geschlossen', 'Neue Adresse eintragen, dann noch einmal tippen.'); zeichnen(); main.querySelector('#ort-nach')?.focus(); return; }
      const nach = main.querySelector('#ort-nach')?.value || '';
      const r = await funktion('geschlossen', { ort: a.id, art: 'umgezogen', nach });
      if (r?.ok) bestaetigen = '';
      await nachAenderung('geschlossen', r, r?.sofort ? 'Umzug gemeldet — der alte Ort ist in der App versteckt.' : 'Umzug gemeldet — der Hinweis auf die neue Adresse steht auf Ihrer Seite; der alte Ort wird nach 14 Tagen versteckt.');
    });

    an('ort-rueckgaengig', async (e, k) => nachAenderung('aenderungen', await rpc('unternehmen_rueckgaengig', { p_aenderung: Number(k.closest('[data-role="ort-aenderung"]').dataset.aenderung) }), 'Zurückgenommen.'));
  }

  main.innerHTML = '<div class="ort-karte ort-lade"><span class="ort-leise">Lädt …</span></div>';
  const [, f] = await Promise.all([laden(), funktion('faehigkeiten', {}).catch(() => null)]);
  if (f?.ok) faehig = f;
  zeichnen();
}

function monat(wert, kurz = false) {
  try { return new Date(wert).toLocaleDateString('de-AT', kurz ? { month: 'short', year: '2-digit' } : { month: 'long', year: 'numeric' }); } catch { return String(wert || ''); }
}
