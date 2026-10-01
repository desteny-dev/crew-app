// Einladungsseite (V1-Kern §6) — was der Mensch sieht, und was „Bin dabei" tut.
//
// Die Seite entscheidet, ob ein Fremder dabei ist. Deshalb, von oben nach unten:
//   · WER lädt ein (Bild + Vorname) — sonst ist ein Link von einer unbekannten Seite Spam.
//   · WAS und WANN — dieselbe Karte, dieselben Zeichen und Datumswörter wie in der App
//     („Morgen · 20:30"), und wie viele schon dabei sind: nur die ZAHL, keine fremden Namen.
//   · EIN großer Knopf „Bin dabei", der beim Rollen unten stehen bleibt, und darunter in einem
//     Satz, was danach kommt („Geht direkt im Browser …") — die Angst vor dem Download ist der
//     häufigste Absprung.
//   · Jeder andere Zustand ist ehrlich und hat einen Weg weiter: Link unbekannt, Meet abgesagt,
//     Meet vorbei → „Crew ansehen"; kein Netz / Serverfehler → „Nochmal versuchen" (und von
//     selbst, sobald das Netz zurück ist).
//
// „Bin dabei": zählt den Klick (repo.teilLinkKlick), legt den Code für die App ab (einladungAblegen —
// derselbe Speicher, den app.js nach der Anmeldung einlöst) und führt weiter: mit Store-Adresse in
// MARKE zu den passenden Store-Knöpfen plus „Im Browser weiter", sonst sofort in die Web-App
// (../?link=<CODE>). Der Code steht AUCH in der Adresse: Messenger-Browser verlieren localStorage
// gern (eigener Speicher je App, „In Safari öffnen"), die Adresse nimmt er immer mit.

import { t, tn, sprache } from '../core/sprache.js';
import { isToday, isTomorrow, weekdayShort, tagMonatKurz, fromISODate, terminText } from '../core/dates.js';
import { activityIconSvg } from '../ui/activity-icons.js';
import { symbol } from '../ui/symbole.js';
import { MARKE, markeText } from '../core/marke.js';
import { einladungAblegen } from '../core/einladung.js';

const esc = (wert) => String(wert ?? '')
  .replaceAll('&', '&amp;').replaceAll('<', '&lt;').replaceAll('>', '&gt;')
  .replaceAll('"', '&quot;').replaceAll("'", '&#39;');

// Nach „Bin dabei" höchstens so lange auf die Zählung warten — der Mensch soll weiter, nicht warten.
// Am Server geht die Zählung mit keepalive raus und kommt auch nach dem Seitenwechsel an.
const KLICK_HOECHSTENS_MS = 900;

// --- Kleine Bausteine -----------------------------------------------------------------------------

function vorname(name) {
  return String(name || '').trim().split(/\s+/)[0] || '';
}

// Farbe und Foto kommen vom Server — nur, was wirklich eine Farbe bzw. ein Bild ist, landet im Stil.
function sichereFarbe(farbe) {
  return /^#[0-9a-f]{3,8}$/i.test(String(farbe || '')) ? farbe : '#C98A5B';
}
// Ein Bild ist eine https-Adresse, ein eingebettetes Bild (data:image/…) oder ein Pfad im App-Ordner
// (Beispielbestand: 'assets/demo/…jpg' — relativ zur App, also von /e/ aus eine Stufe höher).
function sicheresBild(adresse) {
  const wert = String(adresse || '').trim();
  if (/^data:image\/(png|jpe?g|webp|gif);/i.test(wert)) return wert;
  if (!wert || /^[a-z][a-z0-9+.-]*:(?!\/\/)/i.test(wert)) return '';
  try {
    const ziel = new URL(wert, new URL('../', globalThis.location.href));
    return ziel.protocol === 'https:' || ziel.origin === globalThis.location.origin ? ziel.href : '';
  } catch { return ''; }
}

// Heißt der Ort wie der Tipp („Rappenlochschlucht" in der „Rappenlochschlucht"), sagt er nichts
// Neues — dieselbe Regel wie in Find (find.js › ortWort).
function gleicherName(a, b) {
  const norm = (text) => String(text || '').toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/[^a-z0-9]+/g, ' ').trim();
  const x = norm(a);
  const y = norm(b);
  return Boolean(x && y && (x.includes(y) || y.includes(x)));
}

function avatar(von, groesse = 48) {
  const foto = sicheresBild(von?.photoUrl);
  const kuerzel = String(von?.initials || vorname(von?.name).slice(0, 2) || '').slice(0, 3);
  const flaeche = foto
    ? `<img src="${esc(foto)}" alt="" referrerpolicy="no-referrer" onerror="this.remove()">`
    : '';
  return `<span class="ein-avatar" aria-hidden="true" style="width:${groesse}px;height:${groesse}px;background:${esc(sichereFarbe(von?.color))};font-size:${Math.round(groesse * 0.36)}px">${esc(kuerzel)}${flaeche}</span>`;
}

// „Heute" · „Morgen" · „Sa 27.9." — dieselben Wörter wie die Meet-Liste der App (meet-browser.js).
function tagText(iso) {
  if (isToday(iso)) return t('Heute');
  if (isTomorrow(iso)) return t('Morgen');
  return `${weekdayShort(iso)} ${tagMonatKurz(fromISODate(iso))}`;
}

function dabeiText(meet, name) {
  const anzahl = Math.max(0, Math.round(Number(meet?.dabei) || 0));
  // Ist die einladende Person selbst dabei (Vertragsfeld vonDabei), steht ihr Name vorn: „Nina + 2 sind dabei".
  if (name && meet?.vonDabei === true && anzahl >= 1) {
    return anzahl > 1 ? t('{name} + {n} sind dabei', { name, n: anzahl - 1 }) : t('{name} ist dabei', { name });
  }
  if (!anzahl) return t('Noch keine Zusagen');
  return tn(anzahl, '{n} ist dabei', '{n} sind dabei');
}

function geraet() {
  const nav = globalThis.navigator || {};
  const kennung = String(nav.userAgent || '');
  if (/iPhone|iPad|iPod/.test(kennung) || (/Macintosh/.test(kennung) && Number(nav.maxTouchPoints) > 1)) return 'ios';
  if (/Android/i.test(kennung)) return 'android';
  return 'andere';
}

// Welche Store-Knöpfe dieses Gerät bekommt: iPhone → App Store, Android → Google Play, sonst beide.
// Steht für DIESES Gerät keine Adresse in MARKE, gibt es keinen Umweg über eine Auswahl.
export function storesFuer(art = geraet(), marke = MARKE) {
  const apple = String(marke.storeApple || '').trim();
  const google = String(marke.storeGoogle || '').trim();
  const liste = [];
  if (apple && art !== 'android') liste.push({ id: 'apple', url: apple, text: t('Im App Store laden') });
  if (google && art !== 'ios') liste.push({ id: 'google', url: google, text: t('Bei Google Play laden') });
  return liste;
}

// Die Web-App mit dem Code: ../?link=<CODE>. Am Server steht gateway=supabase dabei — ein geteilter
// Link ist ein Ding auf dem Server, auch wenn dieser Browser früher einmal die Demo gewählt hat.
export function appAdresse(code, modus) {
  const ziel = new URL('../', globalThis.location.href);
  if (code) ziel.searchParams.set('link', code);
  if (code && modus === 'supabase') ziel.searchParams.set('gateway', 'supabase');
  return ziel.href;
}

function appOhneLink() {
  return new URL('../', globalThis.location.href).href;
}

// --- Teile der Seite ---------------------------------------------------------------------------

function kopf(von, satz) {
  return `<header class="ein-von" data-role="einladung-von">${avatar(von, 52)}<h1 class="ein-satz">${esc(satz)}</h1></header>`;
}

function fakt(zeichen, text, rolle) {
  return `<li class="ein-fakt" data-role="${rolle}">${symbol(zeichen, 'var(--muted)', 18)}<span>${esc(text)}</span></li>`;
}

function meetKarte(meet, name) {
  const zeit = { date: meet.date || null, time: meet.time || '', openTime: Boolean(meet.openTime), nowTime: Boolean(meet.nowTime) };
  const titel = String(meet.title || '').trim() || t('Treffen');
  const marke = meet.abgesagt
    ? `<span class="ein-pille ein-pille-rot" data-role="einladung-abgesagt">${esc(t('Abgesagt'))}</span>`
    : meet.vorbei ? `<span class="ein-pille" data-role="einladung-vorbei">${esc(t('Vorbei'))}</span>` : '';
  // Ein Foto des Ortes (wie auf der Meet-Seite der App) zeigt die Seite, sobald der Vertrag es
  // mitliefert (Bericht P5: meet.bild + bildUrheber in teilMeetVorschau) — sonst die Karte ohne Bild.
  const bild = sicheresBild(meet.bild);
  const still = meet.abgesagt || meet.vorbei ? ' ein-karte-still' : '';
  return `<article class="ein-karte${still}${bild ? ' ein-karte-mit-bild' : ''}" data-role="einladung-meet">
${bild ? `<div class="ein-bild"><img src="${esc(bild)}" alt="" referrerpolicy="no-referrer" onerror="this.parentNode.remove()"></div>` : ''}
<div class="ein-karte-innen">
<div class="ein-karte-kopf"><span class="ein-kachel" aria-hidden="true">${activityIconSvg({ title: titel, icon: meet.icon, iconKey: meet.iconKey }, 'var(--ink)', 22)}</span><h2 class="ein-titel" data-role="einladung-titel">${esc(titel)}</h2>${marke}</div>
<ul class="ein-fakten">
${fakt('kalender', terminText(zeit, { datum: tagText }), 'einladung-wann')}
${meet.placeName ? fakt('ort', meet.placeName, 'einladung-ort') : fakt('ort', t('Ort offen'), 'einladung-ort')}
${meet.abgesagt ? '' : fakt('gruppe', dabeiText(meet, name), 'einladung-zahl')}
</ul>
${bild && meet.bildUrheber ? `<p class="ein-nachweis" data-role="einladung-nachweis">${esc(t('Foto: {urheber}', { urheber: meet.bildUrheber }))}</p>` : ''}
</div>
</article>`;
}

function tippKarte(tipp) {
  const titel = String(tipp.title || '').trim() || t('Tipp');
  const bild = sicheresBild(tipp.bild);
  const zeichen = `<span class="ein-bild-zeichen" aria-hidden="true">${activityIconSvg({ title: titel, iconKey: tipp.iconKey, category: tipp.art }, 'var(--ink-soft)', 44)}</span>`;
  return `<article class="ein-karte ein-karte-tipp" data-role="einladung-tipp">
<div class="ein-bild">${zeichen}${bild ? `<img src="${esc(bild)}" alt="" referrerpolicy="no-referrer" onerror="this.remove()">` : ''}</div>
<div class="ein-karte-kopf ein-karte-kopf-tipp"><h2 class="ein-titel" data-role="einladung-titel">${esc(titel)}</h2></div>
${tipp.ort && !gleicherName(tipp.ort, titel) ? `<ul class="ein-fakten">${fakt('ort', tipp.ort, 'einladung-ort')}</ul>` : ''}
${tipp.bildUrheber && bild ? `<p class="ein-nachweis" data-role="einladung-nachweis">${esc(t('Foto: {urheber}', { urheber: tipp.bildUrheber }))}</p>` : ''}
</article>`;
}

function handlung({ art, stores }) {
  const hinweis = stores.length
    ? t('Mit der App oder direkt im Browser.')
    : art === 'tipp'
      ? t('Geht direkt im Browser. Kurz anmelden, dann seid ihr befreundet.')
      : t('Geht direkt im Browser. Kurz anmelden, dann bist du dabei.');
  return `<div class="ein-handlung" data-role="einladung-handlung">
<button type="button" class="ein-knopf" data-act="dabei" data-role="einladung-dabei">${esc(t('Bin dabei'))}</button>
<p class="ein-hinweis" data-role="einladung-hinweis">${esc(hinweis)}</p>
</div>`;
}

function weiterZuCrew(text = t('{name} ansehen', { name: MARKE.name })) {
  return `<div class="ein-handlung" data-role="einladung-handlung">
<a class="ein-knopf ein-knopf-leise" href="${esc(appOhneLink())}" data-role="einladung-crew">${esc(text)}</a>
</div>`;
}

function lage({ zeichen, satz, text, knopf }) {
  return `<section class="ein-lage" data-role="einladung-lage">
<span class="ein-lage-zeichen" aria-hidden="true">${symbol(zeichen, 'var(--ink-soft)', 28)}</span>
<h1 class="ein-satz">${esc(satz)}</h1>
${text ? `<p class="ein-text">${esc(text)}</p>` : ''}
</section>${knopf}`;
}

function nochmalKnopf() {
  return `<div class="ein-handlung" data-role="einladung-handlung">
<button type="button" class="ein-knopf" data-act="nochmal" data-role="einladung-nochmal">${esc(t('Nochmal versuchen'))}</button>
</div>`;
}

// --- Die Zustände ------------------------------------------------------------------------------

function seiteFuer(zustand) {
  const { antwort, stores } = zustand;
  if (zustand.art === 'laden') return null; // der Platzhalter aus index.html bleibt stehen
  if (zustand.art === 'offline') {
    return lage({ zeichen: 'info', satz: t('Keine Verbindung'), text: t('Prüf dein Netz. Die Einladung lädt von selbst weiter, sobald es wieder geht.'), knopf: nochmalKnopf() });
  }
  if (zustand.art === 'fehler') {
    return lage({ zeichen: 'info', satz: t('Das hat gerade nicht geklappt'), text: t('Versuch es gleich noch einmal.'), knopf: nochmalKnopf() });
  }
  if (zustand.art === 'unbekannt') {
    return lage({
      zeichen: 'suchen',
      satz: t('Diesen Link gibt es nicht'),
      text: t('Vielleicht fehlt ein Zeichen. Frag nach einem neuen Link.'),
      knopf: weiterZuCrew(),
    });
  }
  const von = antwort.von || {};
  const name = vorname(von.name);
  if (antwort.art === 'tipp') {
    const satz = name ? t('{name} schickt dir einen Tipp', { name }) : t('Ein Tipp für dich');
    return `${kopf(von, satz)}${tippKarte(antwort.tipp)}${zustand.weiter ? weiterWahl(zustand) : handlung({ art: 'tipp', stores })}`;
  }
  const meet = antwort.meet;
  // Abgesagt oder vorbei: die Einladung GAB es — „lädt dich ein" stimmt dann nicht mehr.
  const vergangen = meet.abgesagt || meet.vorbei;
  const satz = name
    ? (vergangen ? t('{name} hat dich eingeladen', { name }) : t('{name} lädt dich ein', { name }))
    : (vergangen ? t('Du warst eingeladen') : t('Du bist eingeladen'));
  if (meet.abgesagt) {
    return `${kopf(von, satz)}${meetKarte(meet, name)}<p class="ein-text ein-text-mitte" data-role="einladung-grund">${esc(t('Dieses Meet wurde abgesagt.'))}</p>${weiterZuCrew()}`;
  }
  if (meet.vorbei) {
    return `${kopf(von, satz)}${meetKarte(meet, name)}<p class="ein-text ein-text-mitte" data-role="einladung-grund">${esc(t('Dieses Meet ist schon vorbei.'))}</p>${weiterZuCrew()}`;
  }
  return `${kopf(von, satz)}${meetKarte(meet, name)}${zustand.weiter ? weiterWahl(zustand) : handlung({ art: 'meet', stores })}`;
}

// Nach „Bin dabei" mit Store-Adresse: die passenden Store-Knöpfe und der Weg im Browser.
function weiterWahl(zustand) {
  const knoepfe = zustand.stores.map((store) => `<a class="ein-knopf" href="${esc(store.url)}" data-role="einladung-store" data-store="${store.id}" rel="noopener">${esc(store.text)}</a>`).join('');
  return `<div class="ein-handlung" data-role="einladung-weiter">
<p class="ein-hinweis ein-hinweis-oben">${esc(t('Fast geschafft. Lade die App oder mach direkt im Browser weiter.'))}</p>
${knoepfe}
<a class="ein-knopf ein-knopf-leise" href="${esc(zustand.appUrl)}" data-role="einladung-browser">${esc(t('Im Browser weiter'))}</a>
</div>`;
}

function titelFuer(zustand) {
  if (zustand.art === 'meet' || zustand.art === 'tipp') {
    const titel = zustand.art === 'meet' ? zustand.antwort.meet.title : zustand.antwort.tipp.title;
    if (titel) return `${titel} · ${MARKE.name}`;
  }
  return `${t('Einladung')} · ${MARKE.name}`;
}

// --- Start -------------------------------------------------------------------------------------

export async function einladungZeigen({ code, daten, ersteAntwort }) {
  const ziel = document.getElementById('einladung');
  if (!ziel) return;
  // Marke und Slogan aus EINER Stelle (core/marke.js) — auch wenn das statische HTML älter ist.
  for (const knoten of document.querySelectorAll('[data-marke-js="wortmarke"]')) knoten.textContent = MARKE.wortmarke;
  for (const knoten of document.querySelectorAll('[data-marke-js="slogan"]')) knoten.textContent = markeText('slogan', sprache());
  for (const knoten of document.querySelectorAll('[data-marke-js="app"]')) knoten.setAttribute('href', appOhneLink());
  const platzhalter = ziel.innerHTML;

  const zustand = { art: 'laden', antwort: null, stores: storesFuer(), weiter: false, appUrl: appAdresse(code, daten.modus), unterwegs: false };

  const zeichnen = () => {
    ziel.dataset.zustand = zustand.weiter ? 'weiter' : zustand.art;
    const html = seiteFuer(zustand);
    ziel.innerHTML = html == null ? platzhalter : html;
    ziel.setAttribute('aria-busy', zustand.art === 'laden' ? 'true' : 'false');
    document.title = titelFuer(zustand);
  };

  const uebernehmen = (antwort) => {
    zustand.antwort = antwort;
    if (antwort?.ok) zustand.art = antwort.art;
    else zustand.art = ['offline', 'fehler'].includes(antwort?.grund) ? antwort.grund : 'unbekannt';
    zeichnen();
  };

  const laden = async () => {
    zustand.art = 'laden';
    zeichnen();
    uebernehmen(await daten.ansehen(code));
  };

  const dabei = async (knopf) => {
    if (zustand.unterwegs) return;
    zustand.unterwegs = true;
    knopf.disabled = true;
    knopf.setAttribute('aria-busy', 'true');
    knopf.classList.add('ein-knopf-warten');
    // Zuerst ablegen — das geht immer und sofort; die Zählung darf den Weg nicht aufhalten.
    einladungAblegen(code);
    await Promise.race([daten.klick(code), new Promise((weiter) => setTimeout(weiter, KLICK_HOECHSTENS_MS))]);
    if (zustand.stores.length) {
      zustand.weiter = true;
      zustand.unterwegs = false;
      zeichnen();
      return;
    }
    globalThis.location.assign(zustand.appUrl);
  };

  ziel.addEventListener('click', (ereignis) => {
    const knopf = ereignis.target.closest?.('[data-act]');
    if (!knopf || !ziel.contains(knopf)) return;
    if (knopf.dataset.act === 'dabei') dabei(knopf);
    else if (knopf.dataset.act === 'nochmal') laden();
  });

  // Kein Netz: sobald es zurück ist, lädt die Einladung von selbst weiter.
  globalThis.addEventListener('online', () => {
    if (zustand.art === 'offline') laden();
  });
  // Zurück aus der App oder dem Store (Seite aus dem Zwischenspeicher des Browsers): der Knopf
  // darf nicht grau und tot stehen bleiben.
  globalThis.addEventListener('pageshow', (ereignis) => {
    if (!ereignis.persisted) return;
    zustand.unterwegs = false;
    zeichnen();
  });

  uebernehmen(await ersteAntwort);
}
