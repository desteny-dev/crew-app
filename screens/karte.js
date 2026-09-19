// Bereich Karte (Route 'karte.home') — ein Haupt-Tab.
//
// Runde 7, Jonathans wiederholter Vorwurf: „wir haben immernoch 3 taps, anstatt 4 haupttaps."
// Die Karte war bisher zweimal eine Unteransicht: in Crew (wer ist frei und wo) und in Meet
// (was ist geplant und wo). Man musste also RATEN, in welchem Bereich man nachsieht. Hier
// liegen beide Ebenen auf EINER Karte — „kann ich gerade etwas machen, und was" in einem Blick.
//
// Runde 8 (8c) — Jonathan: „So viel Visual Noise weg wie möglich, so einheitlich wie möglich."
//   · R8-30 Meets ohne Striche, IMMER an ihrem Ort (ui/map.js › ortMarken). Trifft ein Meet ein
//     Gesicht, liegen beide übereinander wie ein Stapel (das Gesicht obenauf); niemand wird verschoben.
//   · R8-31 Personen: nur das Bild und rechts die Pille „vor x Min" (ui/map.js › personenMarken).
//     Ein Tipp öffnet ein Blatt von unten; die Karte zoomt auf eine feste Höhe und stellt die
//     Person mittig über das Blatt (personBlattHtml, ui/map.js › punktUeberBlatt).
//   · R8-32 Genauigkeit als klarer grüner Kreis mit pulsierenden Ringen (ui/map.js › genauKreis).
//   · R8-33 Höhenregler gleichmäßig (ui/map.js › HOEHEN).
//   · R8-34 Filter als zwei runde Knöpfe am rechten Rand — Leute und Meets, beide an und beim
//     erneuten Öffnen wieder an; Häuser und Orte sind weg; der Zeitraum-Regler steht unten mittig.
//   · R8-35 Titel „Karte" — übersetzt, groß geschrieben, ohne Punkt.
//   · R8-65 Wer den Tab wieder betritt, sieht wieder die Übersicht (uebersichtStellen,
//     beimEintreten) — MapLibre wird dafür nicht neu gebaut.
//
// Kein eigenes CSS: alles inline, web/styles.css bleibt unangetastet (Aufteilung, Runde 7).

import { esc, bindActions } from '../core/html.js';
import { roomIdForPerson, ME } from '../data/ids.js';
import { now, toISODate, addDays, fromISODate } from '../core/dates.js';
import { genauigkeitVon } from '../data/projections.js';
import { screenScaffold, tabHeader, personAvatar, personMarker } from '../ui/components.js';
import { groupIcon, calendarIcon } from '../ui/icons.js';
import { activityIconSvg } from '../ui/activity-icons.js';
import { symbol } from '../ui/symbole.js';
// Nur Maße und Rechnungen — die schwere Kartenbibliothek lädt map.js erst, wenn eine Karte entsteht.
import { KARTEN_SPALTE, lageFrische } from '../ui/map.js';
import { t as tx, tn } from '../core/sprache.js';

// Der Schlüssel, unter dem ui/map.js die Karte dieses Tabs hält. Er ist stabil, damit die
// Karte über Zeichnungen UND Tabwechsel hinweg dieselbe bleibt.
const KARTE_SCHLUESSEL = 'karte-tab';

// Runde 7 (Wischausgang): Breite der beiden Randstreifen, über die die Tab-Bahn die
// waagerechte Geste zurückbekommt. Siehe kartenRumpf().
const RAND_ZONE = 28;
// Unten rechts liegen ⓘ und Höhenregler (ui/map.js › KARTEN_SPALTE): dort enden die Streifen,
// sonst nähme der Ausgang der Karte ihre eigene Bedienung weg.
const RAND_UNTEN_FREI = 64;

const SCHRIFT = "'Instrument Sans',sans-serif";

// --- Filter (Ebenen) --------------------------------------------------------------------------
// Das Umschalten ist echt: eine ausgeschaltete Ebene verschwindet von der Karte (karteEinrichten
// setzt ihre Liste auf leer).
//
// Runde 8 (R8-34, Jonathan): „Filter als runde Knöpfe am rechten Rand … nur Personen und Meets,
// beide standardmäßig an, beim erneuten Öffnen zurückgesetzt. Häuser/Orte ganz weg." Die dritte
// Ebene („Orte": das Zuhause und die Orte, an denen ihr wart) ist deshalb ersatzlos gestrichen.
// Zurückgesetzt wird beim Verlassen des Tabs (app.js › tabZustandLeeren) — wer wiederkommt, sieht
// wieder beides, und zwar in der Übersicht (R8-65, siehe uebersichtStellen).
const EBENEN_VORGABE = Object.freeze({ leute: true, meets: true });
const EBENEN = Object.keys(EBENEN_VORGABE);

function ebenenStand(ui) {
  if (!ui.ebenen) ui.ebenen = { ...EBENEN_VORGABE };
  for (const name of Object.keys(EBENEN_VORGABE)) {
    if (typeof ui.ebenen[name] !== 'boolean') ui.ebenen[name] = EBENEN_VORGABE[name];
  }
  return ui.ebenen;
}

// --- Leute --------------------------------------------------------------------------------
// Dieselbe Regel wie auf der Crew-Karte, und sie ist eine Datenschutz-Regel, keine Anzeigefrage:
// Freunde stehen NUR an ihrem geteilten Standort (person.standort). Ihr Zuhause ist eine
// Meet-Adresse, die erst nach Zustimmung für EIN Meet gilt — sie hier zu zeigen hieße, eine
// Wohnadresse ohne Einwilligung zu verraten. Wer nichts geteilt hat, steht nicht auf der Karte;
// eine Person an eine ausgedachte Stelle zu setzen wäre schlimmer als sie wegzulassen.
function koordinaten(ort) {
  return ort && Number.isFinite(Number(ort.lat)) && Number.isFinite(Number(ort.lon)) && ort.lat !== null && ort.lon !== null
    ? { lat: Number(ort.lat), lon: Number(ort.lon) }
    : null;
}

function leutePunkte(ctx) {
  const { repo } = ctx;
  const settings = repo.getSettings();
  const punkte = [];
  // Wo ich bin, sagt EINE Stelle — repo.getMyLocation() (Gerät, sonst geteilter Standort).
  //
  // Runde 7 (Paket Karte, Korrektur am Gerüst): Das Zuhause ist KEIN Standort. ui/map.js hält
  // diese Regel für den eigenen Punkt ausdrücklich fest („sonst sähe es aus, als wüsste die
  // Karte, wo man ist"), die erste Fassung dieses Tabs hat sie für das eigene GESICHT trotzdem
  // gebrochen: ohne geteilten Standort stand mein Profilbild auf meiner Wohnadresse. Jetzt
  // steht es nur, wo eine echte Lage bekannt ist. (Das Zuhause hatte bis Runde 7 ein eigenes
  // Gesicht auf der Ebene „Orte" — die gibt es seit R8-34 nicht mehr.)
  const lage = typeof repo.getMyLocation === 'function' ? repo.getMyLocation() : null;
  const eigen = lage && lage.quelle !== 'zuhause' ? koordinaten(lage)
    : (settings.location?.use ? koordinaten(settings.standort) : null);
  if (eigen) {
    punkte.push({
      id: ME,
      person: repo.getMe(),
      ort: eigen,
      ich: true,
      at: Number(settings.standort?.at) || 0,
      // Runde 7 (F9/M1): Nur der grobe Vorschlags-Raster ('geraet') ist gerundet (0,01°, daraus
      // gerechnet 787 m). Ein geteilter Standort ist seit M1 NICHT mehr gerundet: sein Halbmesser
      // ist die Genauigkeit, die das Gerät gemeldet hat — fehlt sie, ist er null (kein Kreis).
      // Auf 0,001° gerundet wird nur, wo 'ungefaehr' eingestellt ist (projections.js › F9/M1).
      genauigkeitM: lage ? genauigkeitVon(lage, lage.quelle) : genauigkeitVon(settings.standort, 'geteilt'),
    });
  }
  for (const person of repo.getPeople()) {
    const ort = koordinaten(person.standort);
    if (!ort) continue;
    punkte.push({
      id: person.id,
      person,
      ort,
      at: Number(person.standort?.at) || 0,
      genauigkeitM: genauigkeitVon(person.standort, 'geteilt'),
    });
  }
  return punkte;
}

function leuteMarken(ctx) {
  const settings = ctx.repo.getSettings();
  // Ich liege oben; wer weiter nördlich steht, liegt weiter hinten (map.js stapelt in dieser
  // Reihenfolge) — dieselbe Ordnung wie auf der Crew-Karte.
  return leutePunkte(ctx)
    .sort((a, b) => (b.ich ? 1 : 0) - (a.ich ? 1 : 0) || a.ort.lat - b.ort.lat)
    .map(({ id, person, ort, ich, at, genauigkeitM }) => {
      const aktiv = Boolean(person?.activeMeetId);
      const vorlage = person || { name: tx('Du'), initials: settings.initials, color: settings.color, photo: settings.photo };
      return {
        id,
        lat: ort.lat,
        lon: ort.lon,
        ich: Boolean(ich),
        at,
        genauigkeitM,
        name: ich ? tx('Du') : person.name,
        bild: personAvatar(vorlage, {
          size: 32, fontSize: 12, active: aktiv,
          free: Boolean(person?.free?.active && !aktiv),
          dotBorder: 'var(--surface)',
          marker: ich ? null : personMarker(id, settings),
        }),
        attrs: ich ? '' : `data-act="karte-person" data-person="${esc(id)}"`,
      };
    });
}

// --- Meets --------------------------------------------------------------------------------
function hatOrt(meet) {
  return Boolean(meet?.place && Number.isFinite(Number(meet.place.lat)) && Number.isFinite(Number(meet.place.lon)));
}

// Nächste echte Wiederholung eines Loops — ein Loop steht EINMAL auf der Karte, an seinem
// nächsten Termin (Runde 3, Jonathan: nicht viermal bei vier Wochen).
function loopNaechsterTag(meet) {
  const heute = toISODate(now());
  if (meet.date >= heute) return meet.date;
  for (let versatz = 0; versatz <= 7; versatz += 1) {
    const iso = addDays(heute, versatz);
    if (fromISODate(iso).getDay() === meet.loop.weekday) return iso;
  }
  return meet.date;
}

// --- Zeitraum (Runde 2, Jonathan: „Bei Meets wäre ein Slider gut, um einzustellen, wie viele
// Meets angezeigt werden — heute, heute und morgen, nächste 3 Tage, 4 Tage, … 1 Woche, 2 Wochen")
//
// Runde 7 (Welle 2): Der Regler stand bis Runde 6 auf der Meet-Karte. Die gibt es als
// Unteransicht nicht mehr — die Frage aber sehr wohl: „Was geht HEUTE?" ist eine andere als
// „Was steht diesen Monat an?". Die Fähigkeit ist mit der Karte hierher gewandert, samt ihrer
// Stufen und ihrer Wörter. `tage` zählt den heutigen Tag mit: 1 = nur heute, 2 = heute und morgen.
// Er steht UNTEN, gleich über der Ebenen-Leiste: dort kommt der Daumen hin, ohne umzugreifen.
// Und er steht nur da, wenn die Ebene „Meets" an ist — ein Regler ohne Wirkung wäre eine Zusage
// ohne Funktion (Hausregel 9).
const ZEITRAUM = [
  { tage: 1, wort: 'Heute' },
  { tage: 2, wort: 'Heute und morgen' },
  { tage: 3, wort: '3 Tage' },
  { tage: 4, wort: '4 Tage' },
  { tage: 5, wort: '5 Tage' },
  { tage: 7, wort: '1 Woche' },
  { tage: 14, wort: '2 Wochen' },
  { tage: 21, wort: '3 Wochen' },
  { tage: 31, wort: '1 Monat' },
  { tage: null, wort: 'Alle' },
];
const ZEITRAUM_ALLE = ZEITRAUM.length - 1;

// Die Stufen stehen oben als Daten; die WÖRTER stehen hier einzeln ausgeschrieben. Nur so
// findet sie die Vollständigkeitsprüfung der Sprachen (scripts/sprachen-pruefen.mjs sieht feste
// Zeichenketten, keine Ausdrücke) — und alle zehn sind seit Runde 2 übersetzt.
function zeitraumWort(stufe) {
  const woerter = [
    tx('Heute'), tx('Heute und morgen'), tx('3 Tage'), tx('4 Tage'), tx('5 Tage'),
    tx('1 Woche'), tx('2 Wochen'), tx('3 Wochen'), tx('1 Monat'), tx('Alle'),
  ];
  return woerter[stufe] || '';
}

function zeitraumStufe(ui) {
  const index = Number.isInteger(ui.zeitraum) ? ui.zeitraum : ZEITRAUM_ALLE;
  return Math.max(0, Math.min(ZEITRAUM_ALLE, index));
}

function alleMeetsMitOrt(ctx) {
  const { repo } = ctx;
  const liste = repo.getMeets({ direction: 'upcoming' }).filter(hatOrt);
  const gesehen = new Set(liste.map((meet) => meet.id));
  for (const loop of repo.getLoops({}) || []) {
    if (hatOrt(loop) && !gesehen.has(loop.id)) { gesehen.add(loop.id); liste.push(loop); }
  }
  return liste;
}

function meetsMitOrt(ctx, stufe = zeitraumStufe(ctx.ui)) {
  const liste = alleMeetsMitOrt(ctx);
  const { tage } = ZEITRAUM[stufe];
  if (tage == null) return liste;
  // Ein Loop zählt EINMAL — an seinem nächsten Termin (Runde 3, Jonathan: nicht viermal bei
  // vier Wochen). meetTag() sagt genau diesen Tag.
  const bis = addDays(toISODate(now()), tage - 1);
  return liste.filter((meet) => meetTag(meet) <= bis);
}

// Runde 3 (Jonathan): „Die Anzahl der Meets darin brauchen wir nicht — oder unauffällig, z. B.
// ‚10 · 3 Loops'." Groß steht der Zeitraum, leise daneben, was er enthält.
function zeitraumZahl(ctx, stufe) {
  const liste = meetsMitOrt(ctx, stufe);
  const loops = liste.filter((meet) => meet.loop).length;
  return loops ? `${liste.length - loops} · ${tn(loops, '{n} Loop', '{n} Loops', { n: loops })}` : String(liste.length);
}

function meetTag(meet) {
  return meet.loop ? loopNaechsterTag(meet) : meet.date;
}

// Mehrere Meets am selben Ort sind EINE Markierung mit Zahl (ui/map.js › ortMarken).
function meetMarken(ctx, grobeZeit, kurzName) {
  const gruppen = new Map();
  for (const meet of meetsMitOrt(ctx)) {
    const lat = Number(meet.place.lat);
    const lon = Number(meet.place.lon);
    const key = `${meet.place.name || ''}|${lat.toFixed(5)}|${lon.toFixed(5)}`;
    if (!gruppen.has(key)) gruppen.set(key, { key, lat, lon, meets: [] });
    gruppen.get(key).meets.push(meet);
  }
  const sortSchluessel = (meet) => `${meetTag(meet)} ${meet.loop?.time || meet.time || '00:00'}`;
  const liste = [...gruppen.values()];
  for (const gruppe of liste) {
    gruppe.meets.sort((a, b) => sortSchluessel(a).localeCompare(sortSchluessel(b)));
    const aktiv = gruppe.meets.some((meet) => meet.status === 'active');
    gruppe.sortierung = `${aktiv ? '0' : '1'} ${sortSchluessel(gruppe.meets[0])} ${gruppe.key}`;
  }
  liste.sort((a, b) => a.sortierung.localeCompare(b.sortierung));
  return liste.map((gruppe, rang) => ({
    key: gruppe.key,
    lat: gruppe.lat,
    lon: gruppe.lon,
    rang,
    eintraege: gruppe.meets.map((meet) => {
      const tag = meetTag(meet);
      const aktiv = meet.status === 'active';
      const abgelehnt = meet.participation?.[ME] === 'no'
        || (Boolean(meet.loop) && meet.loop.responses?.[tag]?.[ME] === 'no');
      const unter = grobeZeit({ date: tag, time: meet.loop?.time || meet.time, status: meet.status });
      return {
        id: meet.id,
        zeichen: activityIconSvg(meet, 'currentColor', 15),
        titel: kurzName(meet.title),
        unter,
        ton: abgelehnt ? 'abgelehnt' : aktiv ? 'aktiv' : meet.loop ? 'loop' : '',
        attrs: `data-act="karte-meet" data-meet="${esc(meet.id)}"`,
        label: [meet.title, unter, abgelehnt ? tx('Nicht dabei') : ''].filter(Boolean).join(', '),
      };
    }),
  }));
}

// --- Orte: seit Runde 8 weg ------------------------------------------------------------------
// Bis Runde 7 (H4) trug die Karte eine dritte Ebene: das Zuhause und die Orte, an denen ihr schon
// wart. Jonathan (R8-34): „Häuser/Orte ganz weg." Das Zuhause bleibt, was es ist — eine Adresse im
// Profil, die ein Meet übernehmen kann —, aber es steht auf keiner Karte mehr.

// --- Kopf ----------------------------------------------------------------------------------
// v4 A.4 / COMPONENT_RULES 1: dieselbe Kopfachse wie Crew, Meet und Profil (tabHeader) —
// beim Tabwechsel darf nichts springen.
// Runde 8 (R8-35, Jonathan): „Titel ‚Karte' übersetzt, groß, ohne Punkt." Bis Runde 7 stand hier die
// Wortmarke „karte." — klein, mit grünem Punkt und in jeder Sprache deutsch. Jetzt ein Titel wie
// „Profil": groß geschrieben, ohne Punkt, übersetzt (Map · Carte · Mapa). R8-16: Crew, Meet und
// Profile bleiben englisch — die Karte wird übersetzt.
function kopf() {
  return tabHeader(
    `<span data-role="karte-titel" style="font-family:'Bricolage Grotesque',sans-serif;font-size:22px;font-weight:650">${esc(tx('Karte'))}</span>`,
  );
}

// --- Filter: zwei runde Knöpfe am rechten Rand (R8-34) -----------------------------------------
// Jonathan: „Filter als runde Knöpfe am rechten Rand (gleicher Abstand wie der Regler)". Sie stehen
// oben in DERSELBEN Spalte wie Höhenregler und ⓘ — auf derselben Achse und mit demselben Abstand zum
// Rand (ui/map.js › KARTEN_SPALTE). Die sichtbare Scheibe ist so breit wie die Spur des Reglers
// (36 px), die Trefferfläche 44 px. Der Regler beginnt darunter (map.js › spalteRechnen).
//   · An  = die Scheibe ist grün getönt, das Zeichen kräftig grün.
//   · Aus = weiße Scheibe, das Zeichen leise und durchgestrichen.
// Bis Runde 7 war das eine Leiste unten links mit drei Feldern und je einer Zahl. Jetzt: zwei
// Zeichen, die man kennt (Leute, Kalender), ohne Zahl und ohne Wort; ihren Zustand sagt der Knopf
// selbst — vorgelesen wird „Leute" bzw. „Meets", gedrückt oder nicht.
const FILTER_SCHEIBE = 36;
const FILTER_TREFFER = 44;

function filterKnopf(name, an, wort, zeichen) {
  const farbe = an ? 'var(--green-dark)' : 'var(--muted)';
  const strich = an ? '' : `<span data-strich aria-hidden="true" style="position:absolute;left:50%;top:50%;width:22px;height:1.8px;margin:-.9px 0 0 -11px;border-radius:1px;background:var(--muted);transform:rotate(-45deg)"></span>`;
  return `<button data-act="karte-ebene" data-ebene="${name}" data-treffer aria-pressed="${an ? 'true' : 'false'}" aria-label="${esc(wort)}" style="position:relative;display:flex;align-items:center;justify-content:center;width:${FILTER_TREFFER}px;height:${FILTER_TREFFER}px;padding:0;border:0;background:transparent;cursor:pointer;appearance:none;-webkit-tap-highlight-color:transparent">
<span data-role="karte-filter-scheibe" aria-hidden="true" style="position:relative;display:flex;align-items:center;justify-content:center;width:${FILTER_SCHEIBE}px;height:${FILTER_SCHEIBE}px;border-radius:50%;background:${an ? 'var(--green-tint)' : 'var(--surface)'};box-shadow:0 0 0 1px var(--ink-a08),0 2px 10px var(--shadow-14);pointer-events:none">${zeichen(farbe, 18)}${strich}</span>
</button>`;
}

// --- Zeitraum-Regler (Runde 7, Welle 2) -------------------------------------------------------
// Dieselbe Grammatik wie jeder Regler der App: Spur, grüne Füllung, weißer Knopf, feine Striche
// an jeder Einraststelle.
// Runde 8 (R8-34, Jonathan): „Zeitraum-Regler unten mittig." Er steht in der Mitte der Unterkante,
// links und rechts gleich weit vom Rand — so weit, dass die Spalte am rechten Rand (ⓘ) frei bleibt:
// Rand + Spaltenbreite + Rand aus ui/map.js › KARTEN_SPALTE.
const ZEITRAUM_UNTEN = 12;
const ZEITRAUM_SEITE = KARTEN_SPALTE.rand + KARTEN_SPALTE.breite + KARTEN_SPALTE.rand;

// Runde 7 (Welle 3, WIEDERHERGESTELLT): Bis Runde 6 sagte die Meet-Karte unter ihrem Regler
// „Keine Meets in diesem Zeitraum", sobald der eingestellte Zeitraum leer war. Mit dem Umbau auf
// den Karten-Tab ist der Satz ersatzlos verschwunden — er stand nur noch in den erzeugten
// Sprachdateien und galt in scripts/sprachen-pruefen.mjs als „unbenutzt". Damit war die Auskunft
// an den Menschen weg: Meets verschwinden von der Karte, und niemand sagt warum. Der Satz steht
// jetzt IM Reglerkasten selbst (der Regler liegt seit Welle 2 unten, „darunter" gehört der
// Ebenen-Leiste) — so steht er genau dort, wo der Finger gerade war.
//
// Runde 7 (Welle 3, RICHTIGGESTELLT): Hier stand „und kann nicht verdeckt werden". Das war
// falsch, und zwar messbar: Das Hinweis-Band des Guides (ui/guide.js › erlaubnis-band) liegt in
// einer eigenen Gleit-Ebene über der ganzen Seite und wusste nichts von diesem Kasten. Auf
// 360 px lag es vollständig darüber (Band 12–348 × 587–694 gegen Zeitraum 36–288 × 587–640 und
// Ebenen-Leiste 36–204 × 648–692) — der Satz war verdeckt, und am Griff des Reglers lag das
// Band. Nichts an der Lage IM Kasten schützt davor. Was wirklich schützt, ist das Ausweichen
// des Bandes selbst (ui/guide.js › schwebendHindernis, seit Welle 3) — und damit es nicht
// wieder still verloren geht, steht die Zusicherung dazu in scratch/r7b-karte.mjs, Abschnitt W4:
// gemessen wird nicht, WO das Band steht, sondern was der Finger am Griff des Reglers trifft.
// Er erscheint nur, wenn es überhaupt Meets mit Ort gibt, der eingestellte Zeitraum aber
// keines enthält: Gibt es gar keine, steht schon „Nichts auf der Karte" da.
function zeitraumLeerHtml(ctx, stufe) {
  if (meetsMitOrt(ctx, stufe).length) return '';
  return `<div data-role="karte-zeitraum-leer" style="padding:1px 3px 5px;font:600 11.5px/1.25 ${SCHRIFT};color:var(--muted)">${esc(tx('Keine Meets in diesem Zeitraum'))}</div>`;
}

function zeitraumReglerHtml(ctx, stufe) {
  const anteil = ((stufe / ZEITRAUM_ALLE) * 100).toFixed(2);
  const striche = ZEITRAUM.map((_, i) => `<span aria-hidden="true" style="position:absolute;left:${((i / ZEITRAUM_ALLE) * 100).toFixed(2)}%;top:16px;width:1.5px;height:5px;margin-left:-.75px;border-radius:1px;background:var(--ink-a14)"></span>`).join('');
  return `<div data-role="karte-zeitraum" data-ueber-karte style="position:absolute;left:${ZEITRAUM_SEITE}px;right:${ZEITRAUM_SEITE}px;bottom:${ZEITRAUM_UNTEN}px;z-index:6;background:var(--surface);border-radius:16px;box-shadow:0 4px 16px var(--shadow-18);padding:9px 14px 3px;display:flex;flex-direction:column;gap:2px;pointer-events:auto;cursor:default">
<div style="display:flex;justify-content:space-between;align-items:baseline;gap:10px;padding:0 3px"><span data-role="karte-zeitraum-wert" style="font:650 13px/1.15 ${SCHRIFT};color:var(--ink);white-space:nowrap">${esc(zeitraumWort(stufe))}</span><span data-role="karte-zeitraum-zahl" style="font:600 11.5px/1.15 ${SCHRIFT};color:var(--muted);font-variant-numeric:tabular-nums;white-space:nowrap">${esc(zeitraumZahl(ctx, stufe))}</span></div>
<div data-role="karte-zeitraum-spur" data-hdrag="zeitraum" data-treffer role="slider" tabindex="0" aria-label="${esc(tx('Zeitraum'))}" aria-valuemin="0" aria-valuemax="${ZEITRAUM_ALLE}" aria-valuenow="${stufe}" aria-valuetext="${esc(zeitraumWort(stufe))}" style="position:relative;height:24px;margin:0 4px;touch-action:none;cursor:pointer;outline:none">
<div aria-hidden="true" style="position:absolute;left:-14px;right:-14px;top:-9px;bottom:-6px"></div>
<div aria-hidden="true" style="position:absolute;left:0;right:0;top:9px;height:4px;border-radius:2px;background:var(--field)"></div>
${striche}
<div data-role="karte-zeitraum-fuellung" aria-hidden="true" style="position:absolute;left:0;top:9px;width:${anteil}%;height:4px;border-radius:2px;background:var(--green)"></div>
<div data-role="karte-zeitraum-knopf" aria-hidden="true" style="position:absolute;left:${anteil}%;top:2px;width:18px;height:18px;margin-left:-9px;border-radius:50%;background:var(--surface);border:2.5px solid var(--green);box-sizing:border-box;box-shadow:0 2px 6px var(--shadow-20)"></div>
</div>${zeitraumLeerHtml(ctx, stufe)}</div>`;
}

// Die Spalte steht so, dass die Scheiben genau auf der Achse der Reglerspur liegen: rechte Kante
// der Trefferflächen = KARTEN_SPALTE.rand, Breite = KARTEN_SPALTE.breite, oben derselbe Rand.
function filterSpalte(ebenen) {
  const oben = KARTEN_SPALTE.rand - (FILTER_TREFFER - FILTER_SCHEIBE) / 2;
  const rechts = KARTEN_SPALTE.rand + (KARTEN_SPALTE.breite - FILTER_TREFFER) / 2;
  return `<div data-role="karte-ebenen" data-ueber-karte role="group" aria-label="${esc(tx('Filter'))}" style="position:absolute;top:${oben}px;right:${rechts}px;z-index:6;display:flex;flex-direction:column;pointer-events:auto">
${filterKnopf('leute', ebenen.leute, tx('Leute'), groupIcon)}
${filterKnopf('meets', ebenen.meets, tx('Meets'), calendarIcon)}
</div>`;
}

// --- Rumpf ---------------------------------------------------------------------------------
function kartenRumpf(ctx, ebenen, zahlen) {
  const settings = ctx.repo.getSettings();
  // Der Zeitraum gehört zu den Meets. Ist die Ebene aus oder gibt es überhaupt keine Meets mit
  // Ort, steht kein Regler da — ein Bedienelement ohne Wirkung wäre eine Zusage ohne Funktion.
  const zeitraum = ebenen.meets && alleMeetsMitOrt(ctx).length
    ? zeitraumReglerHtml(ctx, zeitraumStufe(ctx.ui))
    : '';
  // Keine erfundenen Daten: Ist nichts da, sagt die Karte das — und nennt den Grund, den sie
  // wirklich kennt (keine Ebene an / nichts mit Ort).
  const anzahl = (ebenen.leute ? zahlen.leute : 0) + (ebenen.meets ? zahlen.meets : 0);
  const standortAus = !settings.location?.use || settings.location?.shareMode === 'niemand';
  const leerText = !ebenen.leute && !ebenen.meets
    ? tx('Keine Ebene eingeschaltet')
    : tx('Nichts auf der Karte');
  const kachel = (inhalt) => `<span data-ueber-karte style="background:var(--surface);border-radius:999px;padding:8px 13px;box-shadow:0 4px 14px var(--shadow-14);font:600 12.5px/1 ${SCHRIFT};color:var(--ink-soft);white-space:nowrap">${inhalt}</span>`;
  const pillen = [
    anzahl === 0 ? kachel(esc(leerText)) : '',
    standortAus
      ? `<button data-act="karte-standort" data-treffer data-ueber-karte style="background:var(--surface);border-radius:999px;padding:8px 13px;box-shadow:0 4px 14px var(--shadow-14);font:600 12.5px/1 ${SCHRIFT};white-space:nowrap;pointer-events:auto;border:0;cursor:pointer;appearance:none;display:flex;align-items:center;gap:6px;color:var(--green-dark)"><span style="pointer-events:none;display:flex">${symbol('ort', 'var(--green-dark)', 14)}</span><span style="pointer-events:none">${tx('Standort teilen')}</span></button>`
      : '',
  ].filter(Boolean).join('');
  // Die Hinweise stehen oben in der Mitte — links und rechts so weit vom Rand wie der Zeitraum-Regler
  // unten, damit sie nie unter die Filter der rechten Spalte laufen (auf 360 px brechen sie um).
  const hinweis = pillen
    ? `<div data-role="karte-hinweis" style="position:absolute;left:0;right:0;top:34px;z-index:5;display:flex;justify-content:center;gap:8px;flex-wrap:wrap;padding:0 ${ZEITRAUM_SEITE}px;pointer-events:none">${pillen}</div>`
    : '';

  // =========================================================================================
  // Wischausgang (Runde 7)
  // -----------------------------------------------------------------------------------------
  // ownsHorizontalGesture() in app.js läuft vom berührten Knoten nach oben und gibt die Geste
  // ab, sobald sie auf data-hdrag oder data-fremd trifft. Als UNTERANSICHT war das richtig: die
  // Karte gehört MapLibre, und man verließ sie über den Umschalter. Als TAB wäre die Fußleiste
  // damit der einzige Ausgang — die Zusage „Tabwechsel geht überall per Wisch" (geprüft in
  // v4-tabtrack-touch.mjs) bräche genau hier.
  //
  // Der Kompromiss, in drei Teilen:
  //
  //   1. Die KOPFZEILE ist der breite, sichtbare Weg. Sie liegt in der Bahn, trägt kein
  //      data-hdrag und gehört damit ohne weiteres Zutun der Tab-Geste: ein Wisch über den
  //      Schriftzug wechselt den Tab, in beide Richtungen, ohne der Karte etwas wegzunehmen.
  //   2. Zusätzlich links und rechts je ein 28 px schmaler Streifen ÜBER der Karte, der zu
  //      nichts gehört — dort findet ownsHorizontalGesture nichts und die Bahn bekommt die
  //      Geste. 28 px ist derselbe Größenbereich wie der Zurück-Rand (24 px), eine Geste,
  //      die Menschen vom Telefon kennen.
  //   3. Die Fläche trägt deshalb KEIN data-hdrag mehr — der Kartenknoten selbst hat
  //      data-fremd und nimmt jede Geste, die wirklich auf der Karte beginnt.
  //
  // Der rechte Streifen endet über der Bedienspalte der Karte (Höhenregler und ⓘ, ui/map.js
  // › KARTEN_SPALTE): randAnpassen() misst sie und kürzt den Streifen. Ein Ausgang darf der
  // Karte nicht ihre eigene Bedienung nehmen — das wäre ein neuer Fehler statt einer Lösung.
  // Ein reiner TIPP auf einem Streifen gehört dem, was darunter liegt (randDurchreichen).
  // Die Filter oben rechts liegen ÜBER dem rechten Streifen (z 6 gegen 4): ein Tipp dort trifft sie.
  const randStreifen = (seite) => `<div data-role="karte-rand" data-seite="${seite}" aria-hidden="true" style="position:absolute;${seite}:0;top:0;bottom:${seite === 'right' ? RAND_UNTEN_FREI : 0}px;width:${RAND_ZONE}px;z-index:4"></div>`;

  return `<div data-map-viewport="karte" style="height:100%;position:relative;background:var(--field);overflow:hidden">
<div data-fremd="1" data-role="karte-flaeche" style="position:absolute;inset:0;z-index:0"></div>
${randStreifen('left')}${randStreifen('right')}
${hinweis}
${zeitraum}
${filterSpalte(ebenen)}
</div>`;
}

// Der rechte Randstreifen endet über der Bedienspalte (Höhenregler, ⓘ). Gemessen wird sie bei
// map.js selbst — die Lage wandert mit dem, was die Seite über die Karte legt.
function randAnpassen(flaeche, karte, bedienFlaechen) {
  const streifen = flaeche?.parentElement?.querySelector('[data-role="karte-rand"][data-seite="right"]');
  if (!streifen || !karte) return;
  const hoehe = flaeche.clientHeight || 0;
  const oben = (bedienFlaechen(karte) || [])
    .filter((f) => f && f.u > 0)
    .reduce((wert, f) => Math.min(wert, f.o), hoehe);
  // Mindestens ein Daumen breit muss übrig bleiben, sonst ist der Ausgang keiner.
  const rest = Math.max(0, Math.round(oben - 10));
  streifen.style.bottom = rest > 90 ? `${Math.max(0, hoehe - rest)}px` : `${RAND_UNTEN_FREI}px`;
}

// Das Hinweis-Band des Guides (ui/guide.js › erlaubnis-band) lag auf 360 px vollständig über
// dieser Bedienung (gemessen: Band 12–348 × 587–694 gegen Zeitraum-Regler 36–288 × 587–640 und
// Ebenen-Leiste 36–204 × 648–692; am Griff des Reglers lag das Band). Diese Seite hat dagegen
// KEINE eigene Gegenwehr gebaut: Das Band weicht seit Welle 3 selbst aus (guide.js ›
// schwebendHindernis). Ein zweiter Ausweicher hätte dem ersten in die Quere getreten —
// gemessen landete der Regler mit beidem zusammen wieder unter dem Band. EINE Stelle
// entscheidet; diese Seite PRÜFT nur noch das Ergebnis (scratch/r7b-karte.mjs, Abschnitt W4).

// Ein reiner Tipp auf einem Randstreifen gehört dem, was darunter liegt — eine Markierung am
// Bildrand bleibt anfassbar. Ein ZUG bleibt beim Streifen, das ist ja sein Zweck; die Bahn
// verschluckt den Klick nach einem echten Zug ohnehin (app.js › suppressClickUntil).
function randDurchreichen(flaeche) {
  const rumpf = flaeche?.parentElement;
  if (!rumpf || rumpf.__randDurchreichen) return;
  rumpf.__randDurchreichen = true;
  rumpf.querySelectorAll('[data-role="karte-rand"]').forEach((streifen) => {
    streifen.addEventListener('click', (ereignis) => {
      streifen.style.pointerEvents = 'none';
      const darunter = document.elementFromPoint(ereignis.clientX, ereignis.clientY);
      streifen.style.pointerEvents = '';
      if (!darunter || darunter === streifen) return;
      darunter.dispatchEvent(new MouseEvent('click', {
        bubbles: true, cancelable: true, clientX: ereignis.clientX, clientY: ereignis.clientY,
      }));
    });
  });
}

// Was die Seite über DIESE Karte legt (Ebenen-Leiste, Hinweis-Kacheln), misst die KARTE selbst:
// jedes dieser Teile trägt data-ueber-karte, und ui/map.js › belegteFlaechen liest sie zur
// Laufzeit (Runde 7, V1). Bis dahin hat dieser Bildschirm dieselben Kästen ein zweites Mal
// gemessen und durchgereicht — und die Karte wertete sie nur für die Namensschilder aus. Genau
// daran lag der Fehler des Prüfers: ein Gesicht lag vollständig unter der Leiste. EINE Stelle
// misst, EINE Regel gilt: Eine Mini-Box wächst nicht darunter, eine Pille steht nicht darunter.
// Ausgewichen wird seit Runde 8 nicht mehr (R8-30/31): Was auf der Karte steht, steht auf seinem
// Ort — liegt eine Bedienung darüber, liegt sie eben darüber, und ein Fingerzug holt es hervor.

// --- Übersicht (R8-65) --------------------------------------------------------------------------
// Jonathan: „Tab-Wiedereintritt: … Karte wieder in der Übersichts-Ansicht." Die Übersicht ist der
// Ausschnitt, mit dem die Karte beim ersten Öffnen anfängt: alles, was gerade auf ihr liegt (Leute
// und Meets, nach Filter und Zeitraum), mit Rand für die Bedienung — ohne einen einzigen Punkt der
// Startausschnitt aus ui/map.js › startAnsicht (Zuhause, sonst das Land des Geräts).
// Bis Runde 7 überlebte der Ausschnitt den Tabwechsel („wer zurückkommt, sieht seine Gegend"). Wer
// wiederkommt, will aber den Überblick — nicht den letzten Blick durchs Schlüsselloch.
const UEBERSICHT_MERKER = '__karteUebersicht';
const KAMERA_MERKER = '__karteKamera';
const UEBERSICHT_RAND = Object.freeze({ top: 64, bottom: 96, left: 44, right: 84 });

function uebersichtPunkte(ctx) {
  const ebenen = ebenenStand(ctx.ui);
  return [
    ...(ebenen.leute ? leutePunkte(ctx).map(({ ort }) => ort) : []),
    ...(ebenen.meets ? meetsMitOrt(ctx).map((meet) => ({ lat: Number(meet.place.lat), lon: Number(meet.place.lon) })) : []),
  ];
}

function uebersichtStellen(karte, ctx, karten) {
  if (!karte || !karten) return;
  karte.stop?.();
  const punkte = uebersichtPunkte(ctx);
  if (punkte.length) {
    karten.passeAufPunkte(karte, punkte, { padding: UEBERSICHT_RAND, maxZoom: 14.5 });
    return;
  }
  const start = karten.startAnsicht(ctx.repo.getSettings());
  karte.jumpTo({ center: [start.mitte.lon, start.mitte.lat], zoom: start.zoom });
}

// Für app.js (Tab-Wiedereintritt, Paket form): zurück in die Übersicht, ohne MapLibre neu zu bauen —
// ein offenes Blatt und offene Fächer schließen, die Karte selbst bleibt dieselbe.
function beimEintreten(root, ctx) {
  if (ctx?.ui) {
    ctx.ui.blatt = null;
    ctx.ui[UEBERSICHT_MERKER] = true;
    delete ctx.ui[KAMERA_MERKER];
  }
  return import('../ui/map.js').then((karten) => {
    const karte = karten.karteVon(KARTE_SCHLUESSEL);
    if (!karte) return false;
    karte.__crewOrtMarken?.get('karte-meets')?.schliessen?.();
    karte.__crewPersonen?.get('karte-leute')?.schliessen?.();
    uebersichtStellen(karte, ctx, karten);
    return true;
  }).catch(() => false);
}

// --- Blatt einer Person (R8-31) -------------------------------------------------------------------
// Jonathan: „Tipp auf eine Person → Blatt von unten, die Karte zoomt auf eine feste Höhe und stellt
// die Person mittig ÜBER das Blatt." Bis Runde 7 führte der Tipp sofort in den Chat — man verlor die
// Karte, bevor man sah, wo die Person eigentlich ist. Das Blatt ist bewusst klein: wer es ist (Bild,
// Name), wie alt die Lage ist, und die zwei Wege weiter — Chat und Profil.
// Der Schleier dahinter ist durchsichtig: Die Karte bleibt zu sehen, genau darum geht es. Ein Tipp
// daneben oder ein Wisch nach unten schließt (core/html.js › sheetWischen, derselbe Weg wie überall);
// ein Tipp auf ein ANDERES Gesicht öffnet gleich dessen Blatt (gesichtUnterFinger).
function personBlattHtml(ctx) {
  const id = ctx.ui.blatt;
  if (!id) return '';
  const person = ctx.repo.getPerson?.(id);
  if (!person) return '';
  const settings = ctx.repo.getSettings();
  const frisch = lageFrische(Number(person.standort?.at) || 0);
  const bild = personAvatar(person, { size: 52, marker: personMarker(id, settings) });
  const knopf = 'flex:1;min-height:48px;border-radius:999px;display:flex;align-items:center;justify-content:center;padding:0 16px;cursor:pointer;appearance:none;-webkit-tap-highlight-color:transparent';
  return `<div data-role="karte-blatt-traeger" style="position:absolute;inset:0;z-index:14;display:flex;align-items:flex-end">
<div class="ui-sheet-scrim" data-act="karte-blatt-zu" data-role="karte-blatt-grund" style="position:absolute;inset:0;background:transparent"></div>
<div class="ui-sheet-card" data-role="karte-blatt" data-person="${esc(id)}" role="dialog" aria-label="${esc(person.name)}" style="position:relative;width:100%;box-sizing:border-box;padding:12px 20px calc(22px + env(safe-area-inset-bottom, 0px));border-radius:26px 26px 0 0;background:var(--surface);box-shadow:0 -10px 30px var(--shadow-15);display:flex;flex-direction:column;gap:16px;font-family:${SCHRIFT};color:var(--ink)">
<div aria-hidden="true" style="width:38px;height:4px;border-radius:999px;background:var(--handle);align-self:center;flex:none"></div>
<div style="display:flex;align-items:center;gap:14px;min-width:0">${bild}<div style="display:flex;flex-direction:column;gap:3px;min-width:0">
<span data-role="karte-blatt-name" style="font:650 20px/1.2 'Bricolage Grotesque',sans-serif;color:var(--ink);white-space:nowrap;overflow:hidden;text-overflow:ellipsis">${esc(person.name)}</span>
${frisch.text ? `<span data-role="karte-blatt-zeit" style="font:600 13px/1.3 ${SCHRIFT};color:var(--ink-soft);font-variant-numeric:tabular-nums">${esc(frisch.text)}</span>` : ''}
</div></div>
<div style="display:flex;gap:10px">
<button data-act="karte-blatt-chat" data-person="${esc(id)}" data-treffer style="${knopf};border:0;background:var(--green);color:var(--on-accent);font:650 15px/1 ${SCHRIFT}"><span style="pointer-events:none">${esc(tx('Chat'))}</span></button>
<button data-act="karte-blatt-profil" data-person="${esc(id)}" data-treffer style="${knopf};border:1.5px solid var(--ink-a14);background:var(--surface);color:var(--ink);font:650 15px/1 ${SCHRIFT}"><span style="pointer-events:none">${esc(tx('Profil'))}</span></button>
</div>
</div>
</div>`;
}

// Nach dem Zeichnen des Blattes: die Person mittig über das Blatt stellen. Gemessen wird die Höhe,
// die das Blatt am Ende seiner Einfahrt von der Karte zudeckt (offsetHeight kennt die Bewegung
// nicht) — in Layout-Pixeln, auch wenn der Rahmen skaliert gezeigt wird.
function personUeberBlatt(root, ctx, id) {
  const ort = koordinaten(ctx.repo.getPerson?.(id)?.standort);
  if (!ort) return;
  import('../ui/map.js').then(({ karteVon, punktUeberBlatt }) => {
    const karte = karteVon(KARTE_SCHLUESSEL);
    const blatt = root?.querySelector('[data-role="karte-blatt"]');
    const traeger = blatt?.parentElement;
    if (!karte || !blatt || !traeger) return;
    const t = traeger.getBoundingClientRect();
    const faktor = traeger.offsetHeight ? t.height / traeger.offsetHeight : 1;
    const oberkante = t.bottom - blatt.offsetHeight * faktor;
    const k = karte.getContainer().getBoundingClientRect();
    punktUeberBlatt(karte, ort, { verdeckt: Math.max(0, (k.bottom - oberkante) / (faktor || 1)) });
  }).catch(() => {});
}

function personOeffnen(root, ctx, id) {
  if (!id || !ctx.repo.getPerson?.(id)) return;
  ctx.ui.blatt = id;
  ctx.render();
  personUeberBlatt(root, ctx, id);
}

// Liegt unter dem Finger (unter dem durchsichtigen Schleier) das Gesicht einer Person? Dann gilt der
// Tipp ihr: Wer bei offenem Blatt auf ein anderes Gesicht tippt, will dieses sehen — nicht erst das
// Blatt schließen und noch einmal tippen. Ein Stapel zählt nicht (sein Tipp fächert auf).
function gesichtUnterFinger(ereignis) {
  const x = Number(ereignis?.clientX);
  const y = Number(ereignis?.clientY);
  // Ein Klick ohne Stelle (0/0) kommt nicht von einem Finger, sondern aus dem Code — etwa vom Wisch
  // nach unten (core/html.js › sheetWischen): Der schließt nur.
  if (!Number.isFinite(x) || !Number.isFinite(y) || (!x && !y) || typeof document.elementsFromPoint !== 'function') return '';
  for (const el of document.elementsFromPoint(x, y)) {
    const person = el.closest?.('.crew-person[data-act="karte-person"]');
    if (person) return person.hasAttribute('data-stapel') ? '' : (person.dataset.person || '');
  }
  return '';
}

// --- Karte einhängen -------------------------------------------------------------------------
// Läuft in ZWEI Lagen: beim gewöhnlichen Binden der aktiven Seite UND als Vorschau in der Bahn
// (app.js › seiteAnlegen). Beides hängt dieselbe Karte an denselben Knoten — deshalb entsteht
// MapLibre genau einmal und überlebt die Ankunft (app.js › seiteUebernehmen).
function karteEinrichten(wurzel, ctx, { eintritt = false } = {}) {
  const knoten = wurzel?.querySelector('[data-role="karte-flaeche"]');
  if (!knoten) return;
  const ebenen = ebenenStand(ctx.ui);
  import('../ui/map.js').then(async (karten) => {
    const {
      karteHalten, karteVon, startAnsicht, kartenLageQuelle,
      ortMarken, personenMarken, bedienSpalteOrdnen, bedienFlaechen, grobeZeit, kurzName,
    } = karten;
    kartenLageQuelle?.(ctx.repo);
    const leute = ebenen.leute ? leuteMarken(ctx) : [];
    const meets = ebenen.meets ? meetMarken(ctx, grobeZeit, kurzName) : [];

    // Steht die Karte schon an genau diesem Knoten, geht es ohne Warten weiter. Genau das ist
    // der Normalfall: die Bahn setzt den lebenden Knoten in jede neue Fassung der Seite zurück
    // (app.js › Depot), MapLibre wird also nicht noch einmal gebaut.
    const stehend = karteVon(KARTE_SCHLUESSEL);
    const start = startAnsicht(ctx.repo.getSettings());
    const karte = stehend && stehend.getContainer?.() === knoten
      ? stehend
      : await karteHalten(knoten, KARTE_SCHLUESSEL, { mitte: start.mitte, zoom: start.zoom, folgen: false, hoehenRegler: true });
    if (!karte || !knoten.isConnected) return;
    // Aus dem Depot zurück heißt: eben lag der Knoten woanders. Ein Aufruf, der nichts kostet,
    // wenn sich nichts geändert hat — und die Karte nie verzerrt stehen lässt, wenn doch.
    karte.resize?.();

    // Zwei Ebenen auf DERSELBEN Karte. Ihre Verzeichnisse sind getrennt (map.js:
    // halter.__crewOrtMarken bzw. karte.__crewPersonen), aber ihre Flächen kennen einander über
    // `rang` (map.js › fremdFlaechen): Die Mini-Box eines Meets wächst, wenn sie die Wahl hat, zur
    // Seite ohne Gesicht, und die Pille einer Person weicht einem Meet. Verschoben wird NICHTS
    // (R8-30/31): Trifft ein Meet ein Gesicht, liegen beide übereinander wie ein Stapel — das
    // Gesicht obenauf, das Schild ragt darunter hervor (ein Kreis kann ein kleineres Schild nie ganz
    // verdecken, umgekehrt schon).
    // Die Reihenfolge der Aufrufe ist wichtig: In dieser Reihenfolge hängen sich die Lauscher
    // an die Karte, in dieser Reihenfolge rechnen sie beim Schieben.
    personenMarken(karte, { schluessel: 'karte-leute', rang: 0 })?.setzen(leute);
    ortMarken(karte, { schluessel: 'karte-meets', rang: 1 })?.setzen(meets);
    bedienSpalteOrdnen?.(karte);

    // Der Wischausgang richtet sich nach der Bedienspalte — die ordnet sich im nächsten Bild.
    randDurchreichen(knoten);
    const randStellen = () => randAnpassen(knoten, karte, bedienFlaechen);
    randStellen();
    requestAnimationFrame(() => { randStellen(); requestAnimationFrame(randStellen); });
    if (!karte.__karteTabRand) { karte.__karteTabRand = true; karte.on('resize', randStellen); }

    // Die Übersicht (R8-65) — und wann NICHT:
    //   · Beim BETRETEN des Tabs die Übersicht. Betreten heißt: Die Seite kommt als Vorschau in die
    //     Bahn (`eintritt` — Wischen oder Tipp auf den Tab; die Übersicht steht dann schon, bevor man
    //     die Karte sieht, nichts springt), das allererste Öffnen, oder der zweite Tipp auf den Tab.
    //     In den beiden letzten Fällen fehlt der Merker im Tab-Zustand (app.js leert ihn beim
    //     Verlassen des Tabs und bei resetTab).
    //   · INNERHALB des Tabs (Meet geöffnet und zurück) bleibt der Ausschnitt des Menschen — auch
    //     wenn app.js die Karte dabei neu bauen musste (eine Seite ohne Tab-Wurzel leert das Depot;
    //     gemessen: danach stand die Karte wieder in der Übersicht). Den Ausschnitt merkt sich
    //     deshalb der Tab-Zustand; mit dem Verlassen des Tabs verfällt er.
    const neu = !karte.__karteTabGestellt;
    karte.__karteTabGestellt = true;
    if (!karte.__karteTabKamera) {
      karte.__karteTabKamera = true;
      karte.on('moveend', () => {
        if (!ctx.ui[UEBERSICHT_MERKER]) return;
        const mitte = karte.getCenter();
        ctx.ui[KAMERA_MERKER] = { center: [mitte.lng, mitte.lat], zoom: karte.getZoom() };
      });
    }
    if (eintritt || !ctx.ui[UEBERSICHT_MERKER]) {
      ctx.ui[UEBERSICHT_MERKER] = true;
      delete ctx.ui[KAMERA_MERKER];
      uebersichtStellen(karte, ctx, karten);
      if (!karte.loaded()) karte.once('load', () => uebersichtStellen(karte, ctx, karten));
    } else if (neu) {
      const kamera = ctx.ui[KAMERA_MERKER];
      if (kamera) karte.jumpTo(kamera);
      else uebersichtStellen(karte, ctx, karten);
    }
  }).catch(() => {});
}

// --- Zeitraum bedienen ------------------------------------------------------------------------
// Während des Ziehens wird NICHT die ganze Seite neu gezeichnet: Das Etikett und der Knopf
// wandern direkt mit, und die Karte bekommt ihre neuen Marken. Erst beim Loslassen zeichnet die
// App einmal sauber nach. So folgt der Regler dem Finger ohne Ruckeln — und man sieht beim
// Ziehen sofort, was im Bild bleibt und was verschwindet.
function zeitraumZeichnen(wurzel, ctx, stufe) {
  const kasten = wurzel?.querySelector('[data-role="karte-zeitraum"]');
  if (!kasten) return;
  const anteil = `${((stufe / ZEITRAUM_ALLE) * 100).toFixed(2)}%`;
  const wort = zeitraumWort(stufe);
  const wertFeld = kasten.querySelector('[data-role="karte-zeitraum-wert"]');
  if (wertFeld) wertFeld.textContent = wort;
  const zahlFeld = kasten.querySelector('[data-role="karte-zeitraum-zahl"]');
  if (zahlFeld) zahlFeld.textContent = zeitraumZahl(ctx, stufe);
  const fuellung = kasten.querySelector('[data-role="karte-zeitraum-fuellung"]');
  if (fuellung) fuellung.style.width = anteil;
  const knopf = kasten.querySelector('[data-role="karte-zeitraum-knopf"]');
  if (knopf) knopf.style.left = anteil;
  const spur = kasten.querySelector('[data-role="karte-zeitraum-spur"]');
  if (spur) {
    spur.setAttribute('aria-valuenow', String(stufe));
    spur.setAttribute('aria-valuetext', wort);
  }
  // Der Satz „Keine Meets in diesem Zeitraum" muss schon WÄHREND des Ziehens stimmen — sonst
  // stünde er einen Wimpernschlag lang falsch da (oder fehlte, wo er hingehört).
  const leerAlt = kasten.querySelector('[data-role="karte-zeitraum-leer"]');
  const leerNeu = zeitraumLeerHtml(ctx, stufe);
  if (leerNeu && !leerAlt) kasten.insertAdjacentHTML('beforeend', leerNeu);
  else if (!leerNeu && leerAlt) leerAlt.remove();
}

function zeitraumBinden(wurzel, ctx) {
  const spur = wurzel?.querySelector('[data-role="karte-zeitraum-spur"]');
  if (!spur || spur.__karteZeitraum) return;
  spur.__karteZeitraum = true;
  const stufeAn = (x) => {
    const r = spur.getBoundingClientRect();
    const anteil = r.width ? (x - r.left) / r.width : 0;
    return Math.max(0, Math.min(ZEITRAUM_ALLE, Math.round(anteil * ZEITRAUM_ALLE)));
  };
  const stellen = (stufe) => {
    if (zeitraumStufe(ctx.ui) === stufe) return;
    ctx.ui.zeitraum = stufe;
    zeitraumZeichnen(wurzel, ctx, stufe);
    karteEinrichten(wurzel, ctx);
  };
  let zieht = false;
  spur.addEventListener('pointerdown', (ereignis) => {
    if (ereignis.button) return;
    ereignis.stopPropagation();
    ereignis.preventDefault();
    zieht = true;
    spur.setPointerCapture?.(ereignis.pointerId);
    stellen(stufeAn(ereignis.clientX));
  });
  spur.addEventListener('pointermove', (ereignis) => {
    if (!zieht) return;
    ereignis.stopPropagation();
    stellen(stufeAn(ereignis.clientX));
  });
  const los = (ereignis) => {
    if (!zieht) return;
    zieht = false;
    ereignis.stopPropagation();
    // Einmal sauber nachziehen: Danach steht im Markup, was auf dem Schirm steht.
    ctx.render();
  };
  spur.addEventListener('pointerup', los);
  spur.addEventListener('pointercancel', los);
  spur.addEventListener('click', (ereignis) => { ereignis.stopPropagation(); ereignis.preventDefault(); });
  spur.addEventListener('keydown', (ereignis) => {
    const schritt = ['ArrowRight', 'ArrowUp'].includes(ereignis.key) ? 1 : ['ArrowLeft', 'ArrowDown'].includes(ereignis.key) ? -1 : 0;
    if (!schritt) return;
    ereignis.preventDefault();
    const stufe = Math.max(0, Math.min(ZEITRAUM_ALLE, zeitraumStufe(ctx.ui) + schritt));
    stellen(stufe);
  });
}

// Runde 8 (R8-9, Jonathan): Die „+ Meet"-Pille aus Runde 6/7 ist von der Karte verschwunden. Ein
// Meet legt man in Crew und Meet an — dort sitzt rechts neben FREE der runde „+". Die Karte
// bleibt Karte: nichts schwebt mehr über ihr, was nicht zur Karte gehört.

// --- Screen ---------------------------------------------------------------------------------
function renderKarteHome(ctx) {
  const ebenen = ebenenStand(ctx.ui);
  // Die Zahlen an der Leiste zeigen, was da WÄRE — auch bei ausgeschalteter Ebene. Genau darum
  // werden sie unabhängig von der Wahl gezählt.
  const zahlen = {
    leute: leutePunkte(ctx).length,
    meets: meetsMitOrt(ctx).length,
  };

  const html = screenScaffold({
    page: true,
    header: kopf(),
    body: kartenRumpf(ctx, ebenen, zahlen),
    bottom: '',
    // Eine Karte füllt den Rahmen: kein Auslauf, keine weiche Kante, kein Innenabstand.
    bottomInset: 0,
    headerFade: false,
    bottomFadeHeight: 0,
    scrollKey: 'karte',
    // Die Karte ist ein lebender, fremder Teilbaum: sie darf beim Tabwechsel nicht mit der
    // Seite sterben (app.js › Depot). Ohne das würde MapLibre bei JEDER Ankunft neu gebaut.
    behalten: true,
    // R8-31: das Blatt einer Person liegt über dem ganzen Rahmen (wie jedes Blatt der App).
    overlays: personBlattHtml(ctx),
  });

  return {
    html,
    bind: bindKarteHome,
    // Runde 7 (Bahn, c): Dieselbe Karte schon in der VORSCHAU. Ohne das sähe man beim
    // Hinwischen ein graues Rechteck und die Karte erschiene erst nach dem Wechsel.
    // R8-65: Eine Vorschau entsteht genau dann, wenn die Seite in die Bahn kommt — beim Betreten.
    vorschau: (seite, vorschauCtx) => karteEinrichten(seite, vorschauCtx, { eintritt: true }),
    // R8-65: app.js ruft das beim Betreten des Tabs (siehe beimEintreten).
    beimEintreten,
  };
}
// Dieselbe Angabe an der Definition selbst — für ein app.js, das sie dort statt am Ergebnis sucht.
renderKarteHome.beimEintreten = beimEintreten;

function bindKarteHome(root, ctx) {
  karteEinrichten(root, ctx);
  zeitraumBinden(root, ctx);
  bindActions(root, {
    'karte-ebene': (data) => {
      const ebenen = ebenenStand(ctx.ui);
      const name = EBENEN.includes(data.ebene) ? data.ebene : 'leute';
      ebenen[name] = !ebenen[name];
      ctx.render();
    },
    // R8-31: Ein Tipp auf eine Person öffnet ihr Blatt (nicht mehr sofort den Chat).
    'karte-person': (data) => personOeffnen(root, ctx, data.person),
    'karte-meet': (data) => ctx.nav.go('meet.details', { meetId: data.meet }),
    'karte-standort': () => ctx.nav.go('profile.location'),
    'karte-blatt-zu': (_daten, _el, ereignis) => {
      const andere = gesichtUnterFinger(ereignis);
      if (andere && andere !== ctx.ui.blatt) { personOeffnen(root, ctx, andere); return; }
      ctx.ui.blatt = null;
      ctx.render();
    },
    'karte-blatt-chat': (data) => { ctx.ui.blatt = null; ctx.nav.go('room.view', { roomId: roomIdForPerson(data.person) }); },
    'karte-blatt-profil': (data) => { ctx.ui.blatt = null; ctx.nav.go('room.personDetails', { personId: data.person }); },
  });
}

export const karteScreens = {
  'karte.home': renderKarteHome,
};
