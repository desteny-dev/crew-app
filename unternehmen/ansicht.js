// Ortsseite (Paket H, ALGORITHMUS §6.1): die öffentliche Ansicht und der Weg in Beanspruchen / Verwalten.
//
// Öffentlich steht NUR, was die Datenbank-Funktion ort_seite liefert: Name, Adresse, Art, Crew Score mit
// Ring und Stufe (oder „Neu“), ob in der App sichtbar, 3 Gründe, die Angaben des Unternehmens (nur geprüfte
// Fotos) und „Ist das dein Unternehmen?“. Nie Rohwert, Achsen, Vergleichsgruppe — und nie andere Orte.

import { esc } from '../core/html.js';
import { MARKE } from '../core/marke.js';
import { scoreRing } from './ring.js';
import { artText, STUFE_TEXT } from './texte.js';
import { zeilen, abweichung } from './oeffnungszeiten.js';
import { ortSeite, sitzung, rpc, abmelden, kamAusPasswortMail } from './daten.js';
import { schoeneAdresse } from './pfad.js';

const MERKER = 'crew.unternehmen.ort';
const PREIS = { 1: '€', 2: '€€', 3: '€€€' };

function angemeldetGemerkt() {
  try { return Boolean(globalThis.localStorage?.getItem('crew-auth')); } catch { return false; }
}

export async function seiteZeigen({ ort, erste }) {
  const main = document.getElementById('ort');
  const konto = document.getElementById('ort-konto');
  const rahmen = document.getElementById('ort-seite');
  const marke = document.getElementById('ort-marke');
  const wort = marke?.querySelector('[data-role="wortmarke"]');
  if (wort) wort.textContent = MARKE.wortmarke;
  const z = { seite: null, sitzung: null, meine: [], modus: 'oeffentlich' };

  const fertig = () => { main.setAttribute('aria-busy', 'false'); };
  const lage = (titel, text, knopf = true) => {
    main.dataset.zustand = 'lage';
    main.innerHTML = `<section class="ort-lage" data-role="ort-lage"><h1>${esc(titel)}</h1><p class="ort-text">${esc(text)}</p>
      ${knopf ? '<a class="ort-knopf" href="" data-role="ort-nochmal">Nochmal versuchen</a>' : `<a class="ort-knopf-leise" href="./">${esc(MARKE.name)} öffnen</a>`}</section>`;
    fertig();
  };

  z.seite = await erste;
  if (!z.seite?.ok) {
    if (z.seite?.grund === 'offline') return lage('Keine Verbindung', 'Der Ort konnte nicht geladen werden.');
    if (z.seite?.grund === 'fehler') return lage('Hat nicht geklappt', 'Der Server hat nicht geantwortet, wie er sollte.');
    return lage('Diesen Ort gibt es bei Crew nicht', 'Die Adresse ist falsch, oder der Ort ist nicht (mehr) in OpenStreetMap.', false);
  }
  try { globalThis.localStorage?.setItem(MERKER, z.seite.schluessel); } catch { /* egal */ }
  document.title = `${z.seite.name} · ${MARKE.name}`;
  const kanon = document.createElement('link');
  kanon.rel = 'canonical';
  kanon.href = schoeneAdresse(MARKE.webAdresse, z.seite.pfad);
  document.head.appendChild(kanon);

  // Angemeldet? Die Bibliothek (218 kB) lädt nur, wenn auf diesem Gerät schon eine Anmeldung liegt
  // oder gerade ein Link aus einer Mail zurückkommt.
  const linkDa = /access_token|[?&]code=/.test(`${location.hash}${location.search}`);
  if (angemeldetGemerkt() || linkDa) {
    z.sitzung = await sitzung().catch(() => null);
    if (z.sitzung && kamAusPasswortMail()) {
      const { neuesPasswort } = await import('./anmelden.js');
      await neuesPasswort();
    }
  }

  async function kontoAuffrischen() {
    if (!z.sitzung) { z.meine = []; kontoZeichnen(); return; }
    const m = await rpc('unternehmen_meine', {});
    z.meine = Array.isArray(m) ? m : [];
    kontoZeichnen();
  }
  const binInhaber = () => z.meine.some((m) => m.id === z.seite.id && m.status !== 'streit');

  function kontoZeichnen() {
    if (!z.sitzung) {
      konto.innerHTML = '<button class="ort-textknopf" data-role="ort-anmelden-oben">Anmelden</button>';
      konto.querySelector('button').onclick = async () => {
        const { anmelden } = await import('./anmelden.js');
        const s = await anmelden({ ort: z.seite.schluessel });
        if (!s) return;
        z.sitzung = s;
        await kontoAuffrischen();
        if (binInhaber()) verwalten(); else zeichnen();
      };
      return;
    }
    konto.innerHTML = `<span data-role="ort-ich">${esc(z.sitzung.user?.email || '')}</span><button class="ort-textknopf" data-role="ort-abmelden">Abmelden</button>`;
    konto.querySelector('[data-role="ort-abmelden"]').onclick = async () => {
      await abmelden();
      z.sitzung = null;
      z.meine = [];
      z.modus = 'oeffentlich';
      kontoZeichnen();
      zeichnen();
    };
  }

  async function neuLaden() {
    const frisch = await ortSeite(z.seite.id);
    if (frisch?.ok) z.seite = frisch;
    await kontoAuffrischen();
  }

  function verwalten() {
    z.modus = 'inhaber';
    const q = new URLSearchParams(location.search);
    q.set('ort', z.seite.schluessel);
    q.set('verwalten', '1');
    history.replaceState(null, '', `${location.pathname}?${q}`);
    zeichnen();
  }
  function zurOeffentlichen() {
    z.modus = 'oeffentlich';
    const q = new URLSearchParams(location.search);
    q.delete('verwalten');
    history.replaceState(null, '', `${location.pathname}?${q}`);
    zeichnen();
  }

  async function beanspruchen() {
    if (!z.sitzung) {
      const { anmelden } = await import('./anmelden.js');
      const s = await anmelden({ ort: z.seite.schluessel });
      if (!s) return;
      z.sitzung = s;
      await kontoAuffrischen();
    }
    if (binInhaber() && z.seite.inhaber === 'geprueft') { verwalten(); return; }
    const karte = main.querySelector('[data-role="ort-beanspruchen"]');
    const { beanspruchenZeigen } = await import('./beanspruchen.js');
    beanspruchenZeigen(karte, {
      seite: z.seite,
      abbrechen: () => zeichnen(),
      seiteNeu: async () => { await neuLaden(); return z.seite; },
      geschafft: async () => { await neuLaden(); verwalten(); },
    });
    karte.scrollIntoView({ behavior: 'smooth', block: 'start' });
  }

  async function zeichnen() {
    main.dataset.zustand = z.modus;
    rahmen.toggleAttribute('data-breit', z.modus === 'inhaber');
    if (z.modus === 'inhaber') {
      const { inhaberZeigen } = await import('./inhaber.js');
      await inhaberZeigen(main, { seite: z.seite, zurueck: zurOeffentlichen, neuLaden, beanspruchen: async () => { zurOeffentlichen(); await beanspruchen(); } });
      fertig();
      return;
    }
    main.innerHTML = oeffentlichHtml(z.seite, { inhaberBinIch: binInhaber() });
    const knopf = main.querySelector('[data-role="ort-beanspruchen-knopf"]');
    if (knopf) knopf.onclick = () => (knopf.dataset.ziel === 'verwalten' ? verwalten() : beanspruchen());
    fertig();
  }

  await kontoAuffrischen();
  if (new URLSearchParams(location.search).get('verwalten') === '1' && binInhaber()) z.modus = 'inhaber';
  await zeichnen();
}

function scoreKopf(seite) {
  const s = seite.score;
  if (!s) return { ring: scoreRing({}), stufe: 'Noch nicht bewertet', satz: 'Für diesen Ort ist noch kein Crew Score berechnet.' };
  if (s.neu) return { ring: scoreRing({ neu: true }), stufe: STUFE_TEXT.neu, satz: 'Noch keine Bewertung — frisch in OpenStreetMap' };
  return { ring: scoreRing({ wert: s.wert }), stufe: s.wert >= 70 ? STUFE_TEXT[s.stufe] : 'unter 70', satz: '' };
}

function sichtbarPille(seite) {
  if (seite.sichtbar) return '<span class="ort-pille" data-ton="gut" data-role="ort-sichtbar" data-sichtbar="ja">In der App sichtbar</span>';
  if (seite.geschlossen) return '<span class="ort-pille" data-ton="rot" data-role="ort-sichtbar" data-sichtbar="nein">Geschlossen — in der App nicht sichtbar</span>';
  if (seite.score && !seite.score.neu && typeof seite.score.wert === 'number' && seite.score.wert < 70) {
    return '<span class="ort-pille" data-role="ort-sichtbar" data-sichtbar="nein">In der App nicht sichtbar — erst ab Crew Score 70</span>';
  }
  return '<span class="ort-pille" data-role="ort-sichtbar" data-sichtbar="nein">In der App nicht sichtbar</span>';
}

function zeitenHtml(text, rolle) {
  const z = zeilen(text);
  if (!z) return `<p class="ort-text" data-role="${rolle}">${esc(text)}</p>`;
  return `<dl class="ort-zeiten" data-role="${rolle}">${z.map((r) => `<dt>${esc(r.tage)}</dt><dd>${esc(r.zeiten)}</dd>`).join('')}</dl>`;
}

function unternehmenHtml(seite) {
  const u = seite.unternehmen;
  const osmZeiten = seite.osm?.oeffnungszeiten || '';
  const teile = [];
  if (u?.umgezogen_nach) teile.push(`<p class="ort-text" data-role="ort-umgezogen"><b>Umgezogen:</b> ${esc(u.umgezogen_nach)}<span class="ort-vom-unternehmen">vom Unternehmen</span></p>`);
  if (u?.beschreibung) teile.push(`<p class="ort-text" data-role="ort-beschreibung">${esc(u.beschreibung)}<span class="ort-vom-unternehmen">vom Unternehmen</span></p>`);
  if (u?.oeffnungszeiten) {
    const ab = osmZeiten ? abweichung(u.oeffnungszeiten, osmZeiten) : null;
    teile.push(`<div><h3 class="ort-abschnitt-titel">Öffnungszeiten <span class="ort-vom-unternehmen">vom Unternehmen</span></h3>${zeitenHtml(u.oeffnungszeiten, 'ort-zeiten-unternehmen')}</div>`);
    // §6.4: weichen sie um mehr als die Hälfte von OpenStreetMap ab, stehen beide da — und der Weg, OSM zu korrigieren.
    if (ab !== null && ab > 0.5) {
      teile.push(`<div data-role="ort-zeiten-abweichung"><h3 class="ort-abschnitt-titel">Laut OpenStreetMap</h3>${zeitenHtml(osmZeiten, 'ort-zeiten-osm')}
        <a class="ort-textknopf" href="${esc(seite.osm.bearbeiten)}" target="_blank" rel="noopener">In OpenStreetMap korrigieren</a></div>`);
    }
  } else if (osmZeiten) {
    teile.push(`<div><h3 class="ort-abschnitt-titel">Öffnungszeiten laut OpenStreetMap</h3>${zeitenHtml(osmZeiten, 'ort-zeiten-osm')}</div>`);
  }
  if (u?.preisniveau) teile.push(`<p class="ort-text" data-role="ort-preis">Preisniveau: <b>${PREIS[u.preisniveau]}</b><span class="ort-vom-unternehmen">vom Unternehmen</span></p>`);
  if (u?.fotos?.length) teile.push(`<div class="ort-fotos" data-role="ort-fotos">${u.fotos.map((url, i) => `<div class="ort-foto"><img src="${esc(url)}" alt="Foto ${i + 1} von ${esc(seite.name)}" loading="lazy" /></div>`).join('')}</div>`);
  if (u?.reservierung_url) teile.push(`<div><a class="ort-knopf" data-role="ort-reservieren" href="${esc(u.reservierung_url)}" target="_blank" rel="noopener nofollow">Tisch reservieren</a></div>`);
  if (!teile.length) return '';
  return `<section class="ort-karte" data-role="ort-unternehmen" style="display:flex;flex-direction:column;gap:16px"><h2 style="margin:0">Angaben</h2>${teile.join('')}</section>`;
}

function beanspruchenHtml(seite, { inhaberBinIch }) {
  let text;
  let knopf = '<button class="ort-knopf ort-knopf-voll" data-role="ort-beanspruchen-knopf" data-ziel="beanspruchen">Ort beanspruchen</button>';
  if (!seite.beanspruchbar) {
    text = 'Dieser Eintrag kann derzeit nicht beansprucht werden.';
    knopf = '';
  } else if (inhaberBinIch && seite.inhaber === 'geprueft') {
    text = 'Sie verwalten diesen Ort.';
    knopf = '<button class="ort-knopf ort-knopf-voll" data-role="ort-beanspruchen-knopf" data-ziel="verwalten">Verwalten</button>';
  } else if (inhaberBinIch && seite.inhaber === 'beansprucht') {
    text = 'Sie verwalten diesen Ort — bitte bestätigen Sie ihn erneut, dann können Sie wieder bearbeiten.';
    knopf = '<button class="ort-knopf ort-knopf-voll" data-role="ort-beanspruchen-knopf" data-ziel="beanspruchen">Erneut bestätigen</button>';
  } else if (seite.inhaber !== 'keiner') {
    text = 'Dieser Ort wird bereits von seinem Unternehmen verwaltet. Ist es Ihres? Dann bestätigen Sie es — wer den stärkeren Nachweis hat, verwaltet den Ort.';
    knopf = '<button class="ort-knopf-leise" data-role="ort-beanspruchen-knopf" data-ziel="beanspruchen">Trotzdem beanspruchen</button>';
  } else {
    text = 'Betreiben Sie diesen Ort? Beanspruchen Sie ihn kostenlos: Öffnungszeiten, Fotos, Beschreibung und Events pflegen und sehen, wie der Crew Score entsteht. Den Score selbst kann niemand kaufen oder ändern.';
  }
  return `<section class="ort-karte" data-role="ort-beanspruchen">
    <h2 class="ort-titel">Ist das dein Unternehmen?</h2>
    <p class="ort-text">${esc(text)}</p>
    ${knopf ? `<div style="margin-top:16px">${knopf}</div>` : ''}
  </section>`;
}

function oeffentlichHtml(seite, optionen) {
  const k = scoreKopf(seite);
  const gruende = Array.isArray(seite.gruende) ? seite.gruende.slice(0, 3) : [];
  const verwaltet = seite.inhaber === 'geprueft' ? '<span class="ort-pille" data-role="ort-verwaltet">Vom Unternehmen gepflegt</span>' : '';
  return `
    <section class="ort-karte" data-role="ort-kopf">
      <div class="ort-kopf">
        <div style="min-width:0">
          <h1 class="ort-name" data-role="ort-name">${esc(seite.name)}</h1>
          <p class="ort-art" data-role="ort-art">${esc(artText(seite.art))}</p>
          ${seite.adresse ? `<p class="ort-adresse" data-role="ort-adresse">${esc(seite.adresse)}</p>` : ''}
        </div>
        <div class="ort-ringplatz">${k.ring}<span class="ort-stufe" data-role="ort-stufe">${esc(k.stufe)}</span></div>
      </div>
      ${k.satz ? `<p class="ort-neu-text" data-role="ort-score-satz">${esc(k.satz)}</p>` : ''}
      <div class="ort-pillen">${sichtbarPille(seite)}${verwaltet}</div>
    </section>
    ${gruende.length ? `<section class="ort-karte" data-role="ort-gruende"><h2>Warum dieser Score</h2>
      <ul class="ort-liste">${gruende.map((g) => `<li><span class="ort-zeichen" aria-hidden="true">✓</span><span class="ort-zeile-text">${esc(g.text || '')}</span></li>`).join('')}</ul></section>` : ''}
    ${unternehmenHtml(seite)}
    ${beanspruchenHtml(seite, optionen)}
  `;
}

