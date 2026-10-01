// Gemeinsame, reine Regeln beider Gateways (DemoDataGateway und SupabaseGateway).
//
// Warum es diese Datei gibt: Freigabe-Sichtbarkeit, Profil-Sortierung, Code-Form und die
// Kommend/Verlauf-Regel sind ENTSCHEIDUNGEN DES PRODUKTS, nicht des Speichers. Stünden sie
// in beiden Gateways, gäbe es zwei Wahrheiten für dieselbe Frage — genau der Fehler, den der
// Datenvertrag an anderer Stelle ausdrücklich verbietet („GENAU EINE Regel").
//
// Alles hier ist frei von Zustand: Eingaben rein, Ergebnis raus. Wer Mitgliedschaften
// braucht, bekommt sie als Funktion übergeben.

import { toISODate, now, meetSortKey } from '../core/dates.js';
import { entfernungKm, hatLage } from '../core/entfernung.js';
import { t } from '../core/sprache.js';
// Runde 8 (R8-39): Busy rechnet die Woche mit DERSELBEN Funktion wie bisher (Nachtschicht,
// Sommerzeit) — nur je Fenster, damit jeder Block seinen Titel behält.
import { belegtBereinigen, woche } from '../core/belegt.js';
// §6: Die Vorschau eines geteilten Tipps nimmt ihr Zeichen aus derselben Regel wie „Entdecken".
import { artVon } from '../engine/suggestion-engine.js';
import { CODE_ALPHABET, istTeilCode, teilCodeNorm, neuerTeilCode, TEIL_CODE_LAENGE } from '../core/einladung.js';

// v4 P0-4-Res-Sortierung: eine Ressource ist entweder immer oder manchmal verfügbar.
// Der Rang ist der dokumentierte Sortierschlüssel — kleiner = weiter oben.
export const AVAILABILITY_RANK = { immer: 0, manchmal: 1 };

// v4 P0-4-Datenquelle-tot: Es gibt GENAU EINE Regel, wer eine Ressource sieht — die
// Freigabe an der Ressource selbst. Ohne Eintrag ist sie für Freunde sichtbar; 'privat'
// verbirgt sie, eine Crew-Liste beschränkt sie auf diese Crews, { personen:[…] } auf
// ausgewählte Freund:innen (v5 A30d).
//
// crewMemberIds(crewId) → Array der Mitglieder-IDs; nur für den Crew-Fall nötig.
export function isSharedWith(share, viewerContext = {}, crewMemberIds = () => []) {
  if (share === undefined || share === null || share === 'freunde') return true;
  if (share === 'privat') return false;
  if (Array.isArray(share)) return share.includes(viewerContext.crewId);
  if (share && typeof share === 'object' && Array.isArray(share.personen)) {
    const ids = share.personen;
    if (!ids.length) return false;
    if (viewerContext.personId) return ids.includes(viewerContext.personId);
    // In einer Crew-Ansicht zählt, ob überhaupt jemand aus dieser Crew dabei ist.
    if (viewerContext.crewId) return crewMemberIds(viewerContext.crewId).some((id) => ids.includes(id));
    // Ohne Kontext (eigene Sicht) ist alles sichtbar — im eigenen Profil sieht man die eigene Ressource immer.
    return true;
  }
  return true;
}

// v3.1 §6: Interessen nach echter Punktebewertung, Ressourcen nach Verfügbarkeit und
// danach nach Namen (deutsche Sortierung). Nichts wird als Häufigkeit erfunden.
export function projectProfile(person, viewerContext = {}, crewMemberIds = () => []) {
  if (!person) return null;
  const levels = person.interestLevels || {};
  const interests = [...(person.interests || [])]
    .map((label) => ({ label, level: levels[label] || 1 }))
    .sort((a, b) => (b.level - a.level) || a.label.localeCompare(b.label));

  const meta = person.resourceMeta || {};
  const shares = person.resourceShares || {};
  const resources = [...(person.resources || [])]
    .filter((label) => isSharedWith(shares[label], viewerContext, crewMemberIds))
    .map((label) => {
      const availability = meta[label]?.availability === 'immer' ? 'immer' : 'manchmal';
      return {
        label,
        availability,
        availabilityRank: AVAILABILITY_RANK[availability],
        capacity: meta[label]?.capacity ?? null,
        // R1 §6.2: Ein selbst ausgesuchtes Zeichen gehört zur Ressource und reist mit —
        // sonst sähe „Rechenknecht" bei der Besitzerin nach PC aus und bei den Freunden
        // wieder nach neutralem Anhänger.
        icon: meta[label]?.icon || null,
      };
    })
    .sort((a, b) => (a.availabilityRank - b.availabilityRank) || a.label.localeCompare(b.label, 'de'));

  return { ...person, interests: interests.map((entry) => entry.label), interestList: interests, resourceList: resources };
}

// v4 QR-2: Ein Einladungscode hat die Form VIER-4821. Eingaben werden zuerst auf diese Form
// gebracht, damit „nina 5027" und „nina5027" denselben Code meinen wie „NINA-5027".
// Auftrag §2.1: Der Freundescode hat nichts mit dem Namen zu tun. Neun Zeichen aus einem
// Alphabet OHNE Verwechslungen — kein O neben 0, kein I oder L neben 1 —, in drei
// Dreiergruppen: XXX-XXX-XXX, weil genau so jemand einen Code am Telefon vorliest.
// Dieselbe Form prüft die Datenbank (Migration 0010); beide Seiten müssen zusammenpassen,
// sonst weist eine ab, was die andere ausgibt.
// V1-Kern: Das Alphabet steht im Einladungsmodul (core/einladung.js), weil auch die Einladungsseite
// es braucht, ohne diese Datei zu laden. Eine Quelle, hier nur weitergereicht.
export { CODE_ALPHABET };
const CODE_ZEICHEN = /^[2-9A-HJKMNP-Z]{9}$/;
const CODE_FORM = /^[2-9A-HJKMNP-Z]{3}-[2-9A-HJKMNP-Z]{3}-[2-9A-HJKMNP-Z]{3}$/;

export function normalizeInviteCode(code) {
  const kompakt = String(code ?? '').toUpperCase().replace(/[^A-Z0-9]/g, '');
  if (CODE_ZEICHEN.test(kompakt)) return `${kompakt.slice(0, 3)}-${kompakt.slice(3, 6)}-${kompakt.slice(6)}`;
  return String(code ?? '').trim().toUpperCase();
}

export function isInviteCodeFormat(code) {
  return CODE_FORM.test(code);
}

// Nur für den Demo-Modus: derselbe Vorrat, dieselbe Form. Im Server-Modus erzeugt die
// Datenbank den Code (private.generate_invite_code) — dort gibt es genau eine Quelle.
export function zufaelligerInviteCode() {
  const zieh = () => CODE_ALPHABET[Math.floor(Math.random() * CODE_ALPHABET.length)];
  const gruppe = () => `${zieh()}${zieh()}${zieh()}`;
  return `${gruppe()}-${gruppe()}-${gruppe()}`;
}

// v4 (APP_REQUIREMENTS): 'upcoming' liefert aktive Meets IMMER zuerst und enthält nie
// Vergangenes; 'history' enthält nie ein aktives Meet.
export function sortAndFilterMeets(meets, direction = 'upcoming', date) {
  const today = toISODate(now());
  let result = [...meets];
  if (direction === 'upcoming') {
    result = result.filter((meet) => meet.status !== 'done' && (meet.status === 'active' || meet.date >= today));
    result.sort((a, b) => {
      const activeDiff = (b.status === 'active' ? 1 : 0) - (a.status === 'active' ? 1 : 0);
      return activeDiff || meetSortKey(a).localeCompare(meetSortKey(b));
    });
  } else {
    result = result.filter((meet) => meet.status !== 'active'
      && (meet.status === 'done' || meet.date < today) && !meet.hiddenFromHistory);
    result.sort((a, b) => meetSortKey(b).localeCompare(meetSortKey(a)));
  }
  if (date) result = result.filter((meet) => meet.date === date);
  return result;
}

// context: {} | {crewId} | {personId} | {meetId} | {mine:true} — welche Meets gehören zur Ansicht.
export function meetMatchesContext(meet, context = {}, me) {
  if (context.meetId) return meet.id === context.meetId;
  if (context.crewId) return meet.crewId === context.crewId;
  if (context.personId) {
    return Boolean(
      meet.personIds?.includes(context.personId)
      || meet.participation?.[context.personId]
      || meet.creatorId === context.personId,
    );
  }
  if (context.mine) return Boolean(meet.participation?.[me] || meet.creatorId === me);
  return true;
}

// --- Runde 11 (B10, D10): Wann wird ein Meet bewertet? ------------------------------------------
// Jonathan: „Bewertet wird NUR, wo ich dabei war." Genau EINE Regel für beide Gateways und für jede
// Oberfläche (Meet-Zeile, Rückblick, Bewertungsseite, Chat-Raum) — sie liest nur das Meet, keinen
// Speicher, und steht deshalb hier und nicht in einer Ansicht.
//   (a) ich war dabei (Zusage 'yes') und das Meet ist vorbei; abgesagt oder unentschieden = nie
//   (b) das Meet hat klaren Inhalt — eine Aktivität ODER einen Ort. Ein spontanes „Treffen" ohne
//       beides sagt nichts, wonach man fragen könnte
// Dass beim Fragen IMMER steht, worum es ging (Titel, Tag, Ort), ist Sache der Oberfläche; sie
// bekommt mit meetBewertungsTitel einen Namen, der nie leer ist, wenn gefragt werden darf.
// Der Titel eines spontanen Meets ist gespeichert deutsch (new-meet.js SPONTAN_TITLE).
export const SPONTAN_TITEL = 'Spontanes Treffen';

export function meetKlarerInhalt(meet) {
  const titel = String(meet?.title || '').trim();
  const aktivitaet = Boolean(titel) && titel !== SPONTAN_TITEL && titel !== t('Spontanes Treffen');
  return aktivitaet || Boolean(String(meet?.place?.name || '').trim());
}

// Der Name, unter dem nach dem Meet gefragt wird: der Titel, sonst der Ort (b: einer von beiden ist da).
export function meetBewertungsTitel(meet) {
  const titel = String(meet?.title || '').trim();
  if (titel && titel !== SPONTAN_TITEL && titel !== t('Spontanes Treffen')) return titel;
  return String(meet?.place?.name || '').trim() || titel;
}

// „Vorbei" — dieselbe Regel wie der Verlauf (meet-panels.js meetVorbei liest sie hierher).
// heute: 'YYYY-MM-DD' des Geräts.
export function meetIstVorbei(meet, heute = toISODate(now())) {
  if (!meet || meet.status === 'draft' || meet.status === 'active') return false;
  if (meet.loop?.active && meet.status !== 'done') return false;
  if (meet.status === 'done') return true;
  return Boolean(meet.date) && meet.date < heute;
}

export function meetBewertbar(meet, me, heute = toISODate(now())) {
  if (!meet || meet.cancelled) return false;
  if (!meetIstVorbei(meet, heute)) return false;
  if (meet.participation?.[me] !== 'yes') return false;
  return meetKlarerInhalt(meet);
}

// --- Orte (T5) -----------------------------------------------------------------------------
// Ein Ort besteht seit der echten Karte aus Name, Adresse UND Koordinaten. Vorher wurde er an
// einem halben Dutzend Stellen von Hand umkopiert — und dabei jedes Mal auf Name/Adresse
// zusammengestrichen, sodass die Koordinaten auf dem Weg vom Entwurf ins Meet verloren gingen.
// Ab hier geht jede Kopie durch diese eine Stelle.
//
// x/y (0…1) stammen aus der Zeit der gezeichneten Karte und beschreiben eine Stelle auf einem
// gedachten Blatt. Sie bleiben erhalten, solange es Daten gibt, die nur sie haben; sobald
// Koordinaten da sind, zählen die Koordinaten.
// Runde 2 (Sprachen): Ein offener Ort wird LEER gespeichert, nicht als „Ort offen". Das Meet
// sehen Menschen in verschiedenen Sprachen; ein gespeicherter deutscher Satz stünde bei allen
// deutsch da. Die Anzeige sagt „Ort offen" in der Sprache der Lesenden.
export function uebernimmOrt(quelle, zusatz = {}) {
  if (!quelle || !quelle.name) return { name: '', address: '', x: 0.5, y: 0.5, ...zusatz };
  const ort = {
    ...zusatz,
    name: quelle.name,
    address: quelle.address || '',
    x: typeof quelle.x === 'number' ? quelle.x : 0.5,
    y: typeof quelle.y === 'number' ? quelle.y : 0.5,
  };
  if (typeof quelle.lat === 'number' && typeof quelle.lon === 'number') {
    ort.lat = quelle.lat;
    ort.lon = quelle.lon;
  }
  // Paket G1: Der Eintrag hinter dem Ort (Algorithmus 2: 'osm:node/…', 'ev:<uuid>', 'idee:<id>') reist mit.
  // Am Server lesen die Trigger aus 0058 `meets.place->>'eintragId'` und schreiben daraus die Signale
  // zugesagt / bewertung / meet_stattgefunden. Wer den Ort ändert, gibt einen neuen Ort ohne Kennung
  // hierher — dann steht auch keine mehr am Meet.
  if (typeof quelle.eintragId === 'string' && quelle.eintragId.trim()) ort.eintragId = quelle.eintragId.trim();
  return ort;
}

// Paket G1: der Ort eines neuen Meets aus dem Entwurf — beide Gateways (publishDraft). Kommt die Idee
// aus Find („Meet planen" → idea.findId) und steht noch ihr eigener Ort im Entwurf (auto, gleicher Name),
// trägt der Ort ihren Eintrag. Ein gewählter Vorschlag bringt ihn ohnehin mit (place.eintragId).
export function meetOrtAusEntwurf(draft) {
  const ort = uebernimmOrt(draft?.place);
  const findId = draft?.idea?.findId ? String(draft.idea.findId) : '';
  if (ort.name && !ort.eintragId && findId && draft.place?.auto && (!draft.idea.place?.name || draft.idea.place.name === ort.name)) {
    ort.eintragId = findId;
  }
  return ort;
}

export function hatOrtKoordinaten(ort) {
  return Boolean(ort && typeof ort.lat === 'number' && typeof ort.lon === 'number');
}

// =============================================================================================
// Runde 7 — gemeinsame Regeln für BEIDE Gateways. Alles hier ist rein: Eingaben rein, Ergebnis
// raus. Eine Regel, die in beiden Gateways nachgebaut würde, wäre wieder zwei Wahrheiten.
// =============================================================================================

// --- H1: „Frei zurücksetzen um HH:MM" ---------------------------------------------------------
// Bis Runde 6 war settings.freeResetTime eine Zusage ohne Funktion: gespeichert, angezeigt,
// von niemandem gelesen. Die Wirkung braucht genau zwei Dinge — einen Zeitpunkt, an dem „frei"
// gesetzt wurde (free.setAt), und diese Rechnung.
//
// Gerechnet wird LOKAL über Jahr/Monat/Tag, nie über „+24 h": Sommerzeit verschiebt sonst die
// eingestellte Uhrzeit, und wer 00:00 einstellt, meint Mitternacht seiner Zeitzone — nicht
// Mitternacht in UTC. Zieht jemand in eine andere Zeitzone, gilt ab da die neue Uhr; das ist
// gewollt, denn „frei" ist eine Aussage über den Abend, an dem man gerade steht.
export const FREI_ZEIT = /^([01]\d|2[0-3]):([0-5]\d)$/;

// Runde 11 (B7): Es gibt kein „frei ohne Ende". Bis Runde 10 hieß eine fehlende oder kaputte
// Uhrzeit „wird nie zurückgesetzt" — und genau daran blieb in der echten Datenbank „frei"
// tagelang stehen (gemessen am 21.09.2026: von fünf aktiven Zeilen hatten drei weder Grenze
// noch Anker, also kein Ende). Abschalten kann man die Einstellung ohnehin nicht — die
// Oberfläche schreibt immer HH:MM. Fehlt der Wert trotzdem, gilt Mitternacht: „frei" ist eine
// Aussage über heute Abend, nicht über die Woche.
export const FREI_ZEIT_STANDARD = '00:00';
export function freiZeit(freeResetTime) {
  const wert = String(freeResetTime ?? '');
  return FREI_ZEIT.test(wert) ? wert : FREI_ZEIT_STANDARD;
}

// Der nächste Zeitpunkt NACH `seit`, an dem die Uhr `freeResetTime` lokal überschritten wird.
// → ms | null (null nur ohne Anker: dann ist gar nicht bekannt, seit wann „frei" steht)
export function naechsteFreiGrenze(freeResetTime, seit) {
  const treffer = FREI_ZEIT.exec(freiZeit(freeResetTime));
  const start = Number(seit) || 0;
  if (!treffer || !start) return null;
  const stunde = Number(treffer[1]);
  const minute = Number(treffer[2]);
  const von = new Date(start);
  const grenze = new Date(von.getFullYear(), von.getMonth(), von.getDate(), stunde, minute, 0, 0);
  // Genau auf der Grenze gesetzt: dann gilt erst die von morgen — sonst wäre „frei" im selben
  // Augenblick wieder weg, in dem es jemand eingeschaltet hat.
  if (grenze.getTime() <= start) grenze.setDate(grenze.getDate() + 1);
  return grenze.getTime();
}

// Muss „frei" jetzt zurückgesetzt werden? Deckt alle drei Fälle ab:
//   · die App war zwei Tage zu  → die Grenze liegt längst hinter uns, jetzt >= Grenze
//   · die Uhrzeit wurde geändert, während frei aktiv war → gerechnet wird beim LESEN, also
//     immer mit der aktuell eingestellten Uhrzeit ab demselben setAt
//   · kein setAt (Altbestand) → false; das Gateway setzt beim Migrieren einen Anker, damit ein
//     altes „frei" nicht für immer stehen bleibt.
// Woran hängt das Zurücksetzen? Normalerweise am Zeitpunkt des Einschaltens (setAt). Bei einem
// geplanten „Frei ab" am GEPLANTEN Start: wer um 23:00 ein „frei ab 02:00" stellt, will nicht,
// dass die Mitternachtsgrenze es vorher wegräumt.
export function freiAnker(free) {
  if (free?.pending && Number(free.fromAt) > 0) return Number(free.fromAt);
  return Number(free?.setAt) || 0;
}

export function freiAbgelaufen(free, freeResetTime, jetzt = Date.now()) {
  if (!free?.active) return false;
  const grenze = naechsteFreiGrenze(freeResetTime, freiAnker(free));
  return Boolean(grenze && jetzt >= grenze);
}

// Runde 11 (B7): Ein aktives „frei" OHNE Anker kann nie ablaufen — das ist der Altbestand aus
// der Zeit vor Runde 7, als es setAt noch nicht gab. Statt es für immer stehen zu lassen,
// bekommt es beim ersten Lesen einen Anker; ab da greift die eingestellte Uhrzeit. Beide
// Gateways rufen DIESE Funktion (Gerät beim Laden des Bestands, Server beim Lesen der Zeile),
// damit ein altes „frei" nicht in der einen Welt verschwindet und in der anderen bleibt.
// → dasselbe Objekt, wenn nichts fehlt; sonst eine Kopie mit Anker.
export function freiMitAnker(free, jetzt = Date.now()) {
  if (!free?.active || freiAnker(free) > 0) return free;
  return { ...free, setAt: Number(jetzt) || Date.now() };
}

export const FREI_LEER = { active: false, pending: false, from: null, fromAt: null, setAt: null, lust: null };

// Was ein FREUND von einem fremden „frei" sieht — und zwar JETZT, nicht beim letzten Laden.
// Die Uhrzeit der anderen Person ist privat und bleibt es: Auf dem Server rechnet ihr eigenes
// Gerät die Grenze aus und legt sie als Zeitpunkt in die Zeile (free_status.gilt_bis); `grenze`
// ist genau dieser Zeitpunkt. Im Gerät gibt es keine fremde Einstellung — dort gilt der
// Standard, gerechnet vom Anker. Beide Wege geben dieselbe Antwortform zurück: ein abgelaufenes
// „frei" ist schlicht nicht mehr aktiv.
// Und ein „frei", das keine Grenze nennen kann, zählt nicht mehr: Es ist kein Versprechen für
// heute Abend, sondern ein Rest aus einer Sitzung, die niemand beendet hat.
export function freiFuerAndere(free, grenze, jetzt = Date.now()) {
  if (!free?.active) return free || { ...FREI_LEER };
  const ende = Number(grenze) || naechsteFreiGrenze(FREI_ZEIT_STANDARD, freiAnker(free));
  return ende && jetzt < ende ? free : { ...FREI_LEER };
}

// --- Runde 8 (R8-39): Busy — mit Titel, mit Schloss, ohne Sichtbarkeits-Einstellung -----------
// Jonathan: „Busy: … keine Sichtbarkeits-Einstellung. Freunde sehen die Titel; Schloss für
// private Einträge (wie bei Ressourcen) = nur ‚busy'. Eine Farbe. Busy sperrt nichts."
//
// Bis Runde 7 trug ein Fenster AUSSCHLIESSLICH tage/von/bis, und eine Freigabe in der Grammatik
// der Ressourcen ('freunde' | 'privat' | [crewId…] | {personen}) bestimmte, wer die Blöcke sieht.
// Beides ist abgeschafft — ausdrücklich von Jonathan, nicht nebenbei:
//   · Ein Fenster darf einen TITEL tragen (höchstens BUSY_TITEL_MAX Zeichen) und ein SCHLOSS
//     (privat: true). Mehr nicht: kein Ort, kein Grund, keine Teilnehmer — Busy ist kein Kalender.
//   · FREUNDE sehen Busy immer. Wer kein Freund ist (oder blockiert), sieht nichts.
//   · Mit Schloss sehen Freunde nur „busy": der Titel verlässt das eigene Gerät gar nicht erst in
//     ihre Richtung. Auf dem Server sorgt die Sicht belegte_zeiten_sicht dafür (0037,
//     private.busy_fuer_andere), im Gerät genau EINE Funktion hier: busyFuerFreunde.
//   · Busy sperrt nichts: es setzt niemanden frei, nimmt niemandem das Frei, verhindert keine
//     Einladung (core/belegt.js).
//
// Zwei Formen desselben Fensters — eine zum SPEICHERN, eine zum LESEN, jede mit genau einem Zweck:
//   busyBereinigen    → { tage, von, bis, titel?, privat? }   gespeichert (settings.belegt, Tabelle
//                        belegte_zeiten): titel nur, wenn es einen gibt; privat nur, wenn das Schloss
//                        zu ist. Ein Fenster ohne beides sieht genau so aus wie vor Runde 8 — nichts,
//                        was schon gespeichert ist, ändert seine Form. Die Datenbank nimmt nur diese.
//   busyVollstaendig  → { tage, von, bis, titel: string|null, privat: boolean }   gelesen (getBelegt,
//                        getMe().belegt): jede Frage hat eine Antwort, niemand muss „fehlt" von
//                        „null" unterscheiden.
//   busyFuerFreunde   → wie busyVollstaendig, aber titel immer null, privat immer false (person.belegt;
//                        Runde 11, D5: Freunde sehen nur noch die Zeit)
// Die BLÖCKE der Woche (busyWoche) tragen titel und privat ebenfalls immer ausdrücklich.
export const BUSY_TITEL_MAX = 60;

// Steuerzeichen raus, Leerraum zusammengezogen, höchstens BUSY_TITEL_MAX Zeichen (gezählt wie in
// der Datenbank: char_length, also Zeichen und nicht Bytes). Leer heißt: kein Titel (null).
export function busyTitel(roh) {
  const text = String(roh ?? '').replace(/[\x00-\x1f\x7f]/g, ' ').replace(/\s+/g, ' ').trim();
  if (!text) return null;
  return [...text].slice(0, BUSY_TITEL_MAX).join('').trim() || null;
}

// Die Zeitform prüft weiter core/belegt.js (Tage 0–6, HH:MM, von ≠ bis) — hier kommen nur Titel
// und Schloss dazu. Alles andere am Fenster fällt weg, wie bisher. Genau so wird auch gespeichert:
// Die Datenbank nimmt `titel` nur als Text von 1–60 Zeichen und `privat` nur als true/false an
// (0037) — ein leerer Titel oder ein offenes Schloss wird deshalb gar nicht erst geschrieben.
export function busyBereinigen(roh) {
  if (!Array.isArray(roh)) return [];
  const sauber = [];
  for (const fenster of roh) {
    const [form] = belegtBereinigen([fenster]);
    if (!form) continue;
    const titel = busyTitel(fenster.titel);
    sauber.push({ ...form, ...(titel ? { titel } : {}), ...(fenster.privat === true ? { privat: true } : {}) });
  }
  return sauber;
}

// Die Leseform: jedes Fenster mit titel (string|null) und privat (boolean) — immer in derselben
// Reihenfolge der Felder, gleich woher es kommt (Gerät oder Server, mit oder ohne Titel).
export function busyVollstaendig(roh) {
  return busyBereinigen(roh).map((fenster) => ({
    tage: fenster.tage, von: fenster.von, bis: fenster.bis, titel: fenster.titel || null, privat: fenster.privat === true,
  }));
}

// Was eine Freundin von meinen Fenstern bekommt: die Leseform — NUR die Zeit.
// Runde 11 (D5, Jonathan): „fremde Meets und Busy der Person immer als graue Blöcke ohne Titel".
// Seitdem zeigt keine Oberfläche mehr den Titel eines fremden Busy-Eintrags — dann gehört er auch
// nicht mehr auf fremde Geräte: titel ist bei anderen IMMER null, und das Schloss sagt dort nichts
// mehr (privat immer false). Auf dem Server nimmt die Sicht belegte_zeiten_sicht beides schon in
// der Datenbank heraus (0041, private.busy_fuer_andere); hier steht die zweite Uhr im Gerät.
export function busyFuerFreunde(roh) {
  return busyVollstaendig(roh).map((fenster) => ({ ...fenster, titel: null, privat: false }));
}

// --- Runde 11 (B4/D5): Zeitfenster zugesagter Meets — nur die Zeit ------------------------------
// Die Karte „Zusammen" im Profil einer Freundin zeigt ihre Meets, in denen ich NICHT bin, als graue
// Blöcke „beschäftigt". Im Server-Modus liegen diese Meets gar nicht auf meinem Gerät (ich darf sie
// nicht sehen). Deshalb gibt es dafür eine eigene, datensparsame Antwort: je Meet Datum, Beginn und
// Ende — kein Titel, kein Ort, keine Leute, keine Id (Sicht meet_zeiten_sicht, 0041).
//
// Roh (vom Server oder aus dem Geräte-Bestand):  [{ datum:'YYYY-MM-DD', von:'HH:MM', bis:'HH:MM'|null }]
// Gelesen (getBelegtWoche(freund).meetZeiten):    [{ datum, vonMin, bisMin, offen }]
//   sieben Tage ab heute, nach Datum und Beginn, jede Zeit einmal.
// Beide Gateways rechnen mit DIESEN Funktionen — und profile.js mit derselben meetSpanne, damit ein
// Meet, das ich sehe, und seine Zeit aus dieser Liste auf die Minute gleich liegen.
export const ZUSAMMEN_TAGE = 7;
// Wie im Meet-Kalender: ohne Ende läuft ein Meet 4 h aus (eine Stunde fest, dann linear weg).
export const MEET_OHNE_ENDE_MIN = 240;

function meetMinuten(zeit) {
  const treffer = /^(\d{1,2}):(\d{2})/.exec(String(zeit || ''));
  if (!treffer) return null;
  const wert = Number(treffer[1]) * 60 + Number(treffer[2]);
  return wert >= 0 && wert <= 1440 ? wert : null;
}

// Beginn/Ende in Minuten. Ohne Uhrzeit hat ein Meet keinen Platz im Kalender (null); ohne Ende
// läuft es aus (offen); ein Ende vor dem Beginn heißt: bis Mitternacht.
export function meetSpanne(zeit, ende) {
  const von = meetMinuten(zeit);
  if (von === null || von >= 1440) return null;
  const bis = meetMinuten(ende);
  if (bis === null) return { vonMin: von, bisMin: Math.min(1440, von + MEET_OHNE_ENDE_MIN), offen: true };
  return { vonMin: von, bisMin: bis <= von ? 1440 : bis, offen: false };
}

// Die sieben Kalendertage ab heute (ISO), in der Zeitzone des Geräts.
export function zusammenTageIso(bezug = new Date()) {
  return Array.from({ length: ZUSAMMEN_TAGE }, (_, i) => {
    const tag = new Date(bezug.getFullYear(), bezug.getMonth(), bezug.getDate() + i);
    return toISODate(tag);
  });
}

// Roh → Leseform. Was außerhalb der sieben Tage liegt oder keine Uhrzeit hat, fällt weg; dieselbe
// Zeit am selben Tag kommt einmal.
export function meetZeiten(roh, { bezug = new Date() } = {}) {
  const tage = new Set(zusammenTageIso(bezug));
  const gesehen = new Set();
  const liste = [];
  for (const eintrag of Array.isArray(roh) ? roh : []) {
    const datum = String(eintrag?.datum || '');
    if (!tage.has(datum)) continue;
    const spanne = meetSpanne(eintrag.von, eintrag.bis);
    if (!spanne) continue;
    const schluessel = `${datum}|${spanne.vonMin}|${spanne.bisMin}`;
    if (gesehen.has(schluessel)) continue;
    gesehen.add(schluessel);
    liste.push({ datum, vonMin: spanne.vonMin, bisMin: spanne.bisMin, offen: spanne.offen });
  }
  return liste.sort((a, b) => a.datum.localeCompare(b.datum) || (a.vonMin - b.vonMin) || (a.bisMin - b.bisMin));
}

// Der Geräte-Bestand in der Roh-Form des Servers — dieselbe Regel wie private.meet_zeiten_fuer_mich:
//   · zugesagt ('yes') — oder Erstellerin ohne eigene Antwort
//   · keine Entwürfe, nichts Abgesagtes, nichts Abgeschlossenes
//   · ein LAUFENDER Loop zählt an den Tagen, für die die Person „dabei" gesagt hat (am Wochentag
//     des Loops), mit der Uhrzeit des Loops
export function meetZeitenRoh(meets, personId) {
  const roh = [];
  for (const meet of Array.isArray(meets) ? meets : []) {
    if (!meet || meet.cancelled || meet.status === 'draft') continue;
    if (meet.loop?.active) {
      for (const [datum, antworten] of Object.entries(meet.loop.responses || {})) {
        if (antworten?.[personId] !== 'yes') continue;
        if (!/^\d{4}-\d{2}-\d{2}$/.test(datum)) continue;
        const [j, m, t] = datum.split('-').map(Number);
        if (new Date(j, m - 1, t).getDay() !== Number(meet.loop.weekday)) continue;
        roh.push({ datum, von: meet.loop.time || meet.time || '', bis: meet.loop.endTime || meet.endTime || null });
      }
      continue;
    }
    if (meet.status === 'done') continue;
    const antwort = meet.participation?.[personId];
    if (!(antwort === 'yes' || (antwort === undefined && meet.creatorId === personId))) continue;
    roh.push({ datum: meet.date, von: meet.time || '', bis: meet.endTime || null });
  }
  return roh;
}

// Die Woche als Blöcke MIT Titel. Gerechnet wird mit core/belegt.js woche() — JE FENSTER, damit
// jeder Block weiß, woher er kommt. Aneinanderstoßende oder überlappende Blöcke eines Tages
// verschmelzen, wenn sie DASSELBE sagen (gleicher Titel, gleiches Schloss): 08–12 und 12–17
// „Arbeit" bleiben EIN Block ohne Fuge, wie bisher. Sagen sie Verschiedenes, bleiben es zwei —
// ein Titel darf beim Zeichnen nicht verschwinden.
//   eigen:true  → jeder Block trägt `indizes`: welche Fenster in ihm stecken (zum Bearbeiten)
//   eigen:false → Titel mit Schloss werden null — auch wenn ein Aufrufer vergäße, vorher
//                 busyFuerFreunde anzuwenden (die Grenze steht lieber zweimal als keinmal)
// → [{ tag, streifen:[{ vonMin, bisMin, titel, privat, indizes? }] }] — sieben Tage ab Montag
export function busyWoche(roh, { eigen = false, bezug = new Date() } = {}) {
  const liste = eigen ? busyVollstaendig(roh) : busyFuerFreunde(roh);
  const leer = woche([], bezug);
  const jeFenster = liste.map((fenster) => woche([fenster], bezug));
  return leer.map((eintrag, tagIndex) => {
    const roheBloecke = [];
    liste.forEach((fenster, index) => {
      for (const s of jeFenster[index][tagIndex].streifen) {
        roheBloecke.push({ vonMin: s.vonMin, bisMin: s.bisMin, titel: fenster.titel, privat: fenster.privat, index });
      }
    });
    roheBloecke.sort((a, b) => (a.vonMin - b.vonMin) || (a.bisMin - b.bisMin) || (a.index - b.index));
    const streifen = [];
    for (const block of roheBloecke) {
      const letzter = streifen[streifen.length - 1];
      if (letzter && block.vonMin <= letzter.bisMin && letzter.titel === block.titel && letzter.privat === block.privat) {
        letzter.bisMin = Math.max(letzter.bisMin, block.bisMin);
        if (eigen && !letzter.indizes.includes(block.index)) letzter.indizes.push(block.index);
        continue;
      }
      streifen.push({
        vonMin: block.vonMin, bisMin: block.bisMin, titel: block.titel, privat: block.privat,
        ...(eigen ? { indizes: [block.index] } : {}),
      });
    }
    return { tag: eintrag.tag, streifen };
  });
}

// --- Runde 8 (R8-25): „zum Admin machen" -------------------------------------------------------
// Eine Regel für beide Gateways. Die Datenbank setzt dieselbe noch einmal durch: Rollen ändern
// dürfen nur Admins (crew_members_update, 0001), und crew_members_guard lässt keine Gruppe ohne
// Admin zurück — hier wird sie nur vorweg beantwortet, damit die Oberfläche ehrlich sagen kann,
// warum etwas nicht geht.
//   crew      die Gruppe (oder null)       adminIds  ihre Admins
//   ich       die eigene Id (ME)           personId  wen es betrifft · an  true = Admin machen
// → null (erlaubt) | 'keinAdmin' | 'keinMitglied' | 'letzterAdmin'
export function crewAdminGrund(crew, adminIds, ich, personId, an) {
  const admins = Array.isArray(adminIds) ? adminIds : [];
  if (!crew || !admins.includes(ich)) return 'keinAdmin';
  if (!(crew.memberIds || []).includes(personId)) return 'keinMitglied';
  if (!an && admins.length === 1 && admins[0] === personId) return 'letzterAdmin';
  return null;
}

// --- E5: „Hast du Zeit?" — die flüchtige Frage ------------------------------------------------
// Sie ist KEINE Nachricht: sie landet in keinem Raum, hinterlässt keinen Verlauf und vergeht
// von selbst. Halbwertszeit: zwei Stunden. Eine Frage von gestern ist wertlos — wer morgens
// liest „hat gestern um 21:00 gefragt", kann damit nichts mehr anfangen und fühlt sich nur
// schuldig. Zwei Stunden decken den Abend ab, an dem sie gestellt wurde, und nicht mehr.
export const FRAGE_GUELTIG_MS = 2 * 60 * 60 * 1000;
// Missbrauch: nicht zwanzig Fragen in einer Minute. Pro Ziel eine offene Frage und danach
// 15 Minuten Ruhe; über alle Ziele hinweg höchstens sechs Fragen in einer Stunde.
export const FRAGE_SPERRE_MS = 15 * 60 * 1000;
export const FRAGE_PRO_STUNDE = 6;
export const FRAGE_ANTWORTEN = ['ja', 'spaeter', 'nein'];

export function frageGueltig(frage, jetzt = Date.now()) {
  return Boolean(frage && !frage.zurueckgenommen && jetzt < (Number(frage.bis) || 0));
}

// Runde 7, Welle 5: Eine zurückgenommene Frage ist für die gefragte Person spurlos weg — für die
// Stundengrenze aber WAR sie gestellt. Bis hierher wurde sie gelöscht und zählte danach nicht
// mehr: fragen · zurücknehmen · wieder fragen ging beliebig oft, „höchstens sechs je Stunde"
// stand nur auf dem Papier. Jetzt bleibt sie, als `zurueckgenommen` markiert, eine Stunde lang
// im EIGENEN Bestand und zählt dort mit. Zu sehen ist sie nirgends (frageGueltig ist für sie
// falsch). Die 15 Minuten Ruhe je Ziel gelten weiter nur für gestellte, nicht zurückgenommene
// Fragen — daran ändert sich hier nichts.
export function frageZaehltNoch(frage, jetzt = Date.now()) {
  if (frageGueltig(frage, jetzt)) return true;
  return Boolean(frage?.zurueckgenommen && jetzt - (Number(frage.at) || 0) < 60 * 60 * 1000);
}

// Darf ich dieses Ziel jetzt fragen? → { ok } | { ok:false, grund, wiederInMs }
//   'laeuft'  an dieses Ziel läuft schon eine unbeantwortete Frage
//   'sperre'  dasselbe Ziel wurde eben erst gefragt
//   'zuOft'   zu viele Fragen in der letzten Stunde
export function frageErlaubt(fragen, zielSchluessel, jetzt = Date.now()) {
  const meine = (fragen || []).filter((f) => f.zielSchluessel === zielSchluessel);
  const offen = meine.find((f) => frageGueltig(f, jetzt) && !f.antwort);
  if (offen) return { ok: false, grund: 'laeuft', wiederInMs: Math.max(0, offen.bis - jetzt) };
  const letzte = meine.filter((f) => !f.zurueckgenommen).reduce((max, f) => Math.max(max, Number(f.at) || 0), 0);
  if (letzte && jetzt - letzte < FRAGE_SPERRE_MS) {
    return { ok: false, grund: 'sperre', wiederInMs: FRAGE_SPERRE_MS - (jetzt - letzte) };
  }
  const letzteStunde = (fragen || []).filter((f) => jetzt - (Number(f.at) || 0) < 60 * 60 * 1000);
  if (letzteStunde.length >= FRAGE_PRO_STUNDE) {
    const aeltestes = Math.min(...letzteStunde.map((f) => Number(f.at) || 0));
    return { ok: false, grund: 'zuOft', wiederInMs: Math.max(0, 60 * 60 * 1000 - (jetzt - aeltestes)) };
  }
  return { ok: true };
}

// --- E6: Anreise ------------------------------------------------------------------------------
// Bis Runde 6 gab es nur fahrer/mitfahrer/selbst — „ich komme mit dem Rad" war nicht sagbar,
// und „selbst" hieß alles und nichts. Ab jetzt sagt die Anreise die ART; wer FÄHRT und wen
// mitnimmt, bleibt genau wie bisher erhalten (plaetze/fahrerId), sonst verlöre eine
// bestehende Mitfahrt beim Umstieg ihren Sinn.
export const ANREISE_ARTEN = ['auto', 'oeffi', 'rad', 'fuss', 'selbst', 'mitfahrt'];

// Übersetzung der bestehenden Einträge — ohne zu erfinden, was niemand gesagt hat:
//   'fahrer'    → 'auto' mit Plätzen        (bietet mit)
//   'mitfahrer' → 'mitfahrt'                (braucht eine Mitfahrt)
//   'selbst'    → 'selbst'                  (kommt allein — WIE, hat nie jemand gesagt)
export function anreiseAusRolle(rolle) {
  if (rolle === 'fahrer') return 'auto';
  if (rolle === 'mitfahrer') return 'mitfahrt';
  if (rolle === 'selbst') return 'selbst';
  return null;
}

// Rückwärts, für alles, was weiter in Rollen denkt (bestehende Ansichten, der Server-Trigger).
export function rolleAusAnreise(art, plaetze) {
  if (art === 'auto' && Number(plaetze) >= 1) return 'fahrer';
  if (art === 'mitfahrt') return 'mitfahrer';
  if (!art) return null;
  return 'selbst';
}

// Eine gespeicherte Zeile auf die neue Form heben (beide Gateways lesen Altbestand).
export function anreiseZeile(zeile) {
  if (!zeile) return null;
  const art = ANREISE_ARTEN.includes(zeile.art) ? zeile.art : anreiseAusRolle(zeile.rolle);
  if (!art) return null;
  const plaetze = art === 'auto' ? (Number(zeile.plaetze) > 0 ? Math.min(8, Math.round(Number(zeile.plaetze))) : null) : null;
  return {
    art,
    plaetze,
    fahrerId: art === 'mitfahrt' ? (zeile.fahrerId || null) : null,
    // Routen speichern (0047): 'standort' = ausdrücklich vom aktuellen Standort abholen; sonst (null) gilt die Abholadresse.
    abholung: art === 'mitfahrt' && zeile.abholung === 'standort' ? 'standort' : null,
    am: Number(zeile.am) || 0,
    rolle: rolleAusAnreise(art, plaetze),
  };
}

// --- F9 / M1: Genauigkeit als Radius, und wie genau überhaupt ---------------------------------
// Runde 7, Welle 2 (M1, Jonathan: „aktuell sind 20 m oder was auch immer zu ungenau"): Gemessen
// war es GRÖBER als gedacht. Jeder geteilte Standort wurde auf 0,001° gerundet (≈ 100 m) — im
// Gerät (seit 0025) und seit Welle 1 noch einmal auf dem Server (0034). Auf 100 m lässt sich
// nicht sagen, in welchem Lokal jemand sitzt, und genau das ist die Frage, um die es in dieser
// App geht.
//
// Die alte Entscheidung ist ZURÜCKGENOMMEN: genau ist der Normalfall. Begründung: Der Standort
// geht ohnehin nur an Freunde, die man selbst ausgewählt hat — „wer darf mich sehen" ist
// entschieden, bevor überhaupt eine Koordinate entsteht. Eine zweite, versteckte Abschwächung
// obendrauf ist keine Zurückhaltung, sondern eine stille Verschlechterung: sie nimmt der
// Funktion den Sinn, ohne dass jemand es merkt oder es hätte wählen können.
//
// Wer es anders will, kann umstellen — für alle oder je Person:
//   settings.standortGenauigkeit = { modus:'genau'|'ungefaehr',
//                                    ausnahmen:{ [personId]:'genau'|'ungefaehr' } }
// 'ungefaehr' rundet wieder auf UNGEFAEHR_GRAD und meldet mindestens UNGEFAEHR_M Halbmesser.
//
// EHRLICH DAZU (Runde 7, Welle 3): Eine Stelle in der App, an der ein Mensch das umstellen kann,
// gibt es HEUTE NICHT. Bis Welle 2 sagten hier, in 0025, in 0034 und im Bericht gleich vier Texte
// ein sichtbares Umstellen zu — erreichbar war es nur über die Konsole. Das ist Hausregel 9 von der anderen
// Seite: Wirkung ohne Knopf, und drei Texte, die einem Menschen etwas zusagen, was die App ihm
// nicht gibt. Die Oberfläche gehört dem Profil-Paket; bis sie steht, gilt für JEDE:N, der/die
// mich sehen darf, die Vorgabe 'genau'. Die vier Methoden des Vertrags (repository.js, Abschnitt
// M1) sind fertig und in beiden Gateways gleich — es fehlt nur der Bildschirm.
//
// `genauigkeitM` ist und bleibt der Halbmesser in Metern, in dem die Person wirklich ist:
//   · geteilt, genau     → was das GERÄT gemeldet hat (position.coords.accuracy) — die echte
//                          Zahl, keine Rundung und keine Schätzung
//   · geteilt, ungefähr  → mindestens UNGEFAEHR_M; dann IST die Rundung die Unschärfe
//   · zuhause, gesucht   → null: eine über die Suche eingetragene Adresse ist wirklich ein Punkt;
//                          dort zeichnet die Karte keinen Kreis (nicht „0 Meter")
//   · zuhause, aus dem Standort übernommen → der Halbmesser des Rasters, aus dem der Punkt
//                          stammt: VORSCHLAGS_GRAD, gerechnet (0,01° → 787 m). Runde 7, Welle 3:
//                          Bis hierher stand in beiden Gateways eine getippte 1000, während hier
//                          „kein Kreis" zugesagt war — zwei Wahrheiten über dieselbe Zahl, und
//                          eine davon erfunden (Hausregel 8). Jetzt sagt der Vertrag, was der
//                          Code tut: Wer sein Zuhause aus dem Standort übernimmt, übernimmt ein
//                          Rasterfeld von rund 800 m, und die Karte darf das zeigen. Wer einen
//                          Punkt will, sucht die Adresse.
//   · geraet             → der Vorschlags-Raster (web/data/orte-vorschlaege.js) bleibt bei 0,01°
//                          → gerechnete 787 m (nicht „rund 1000", das war nie gemessen). Das ist
//                          eine ANDERE Entscheidung und bleibt bestehen: dieser
//                          Punkt geht an die Orte-Funktion, also an einen Dritten, nicht an
//                          Freunde. Deshalb ist er seit M1 auch nicht mehr die Quelle für
//                          „wo bin ich" auf der Karte — dafür fragt das Gerät selbst.
export const UNGEFAEHR_GRAD = 0.001;
// Das Raster der Orts-Vorschläge (web/data/orte-vorschlaege.js) — absichtlich gröber, weil dieser
// Punkt an einen Dritten geht. Steht hier, damit die Zahl dazu aus derselben Rechnung kommt.
export const VORSCHLAGS_GRAD = 0.01;
// Meter je Grad Breite (WGS84-Mittel). Die einzige Erdzahl in dieser Datei — nachschlagbar.
export const GRAD_M = 111320;
// Wer auf ein Raster rundet, sitzt irgendwo in DIESER Zelle. Der Kreis, der die Zelle sicher
// enthält, hat den halben Diagonalen-Halbmesser: √2 · halbe Zellbreite · Meter je Grad. In der
// Länge ist die Zelle schmäler (× cos φ) — der Wert ist also eine OBERGRENZE und beschönigt nie.
export function rasterHalbmesserM(grad) {
  const g = Number(grad);
  return Number.isFinite(g) && g > 0 ? Math.round(Math.SQRT2 * (g / 2) * GRAD_M) : null;
}
// Runde 7, Welle 3 (Hausregel 8): UNGEFAEHR_M war 100 — eine Zahl, die niemand gemessen hatte,
// direkt neben einem Kommentar, der sagte, man erfinde keine. Jetzt ist sie GERECHNET: der
// Halbmesser genau der Rasterzelle, auf die 'ungefaehr' rundet (0,001° → 79 m). Ändert sich
// UNGEFAEHR_GRAD, ändert sie sich mit, statt nebenher falsch zu werden.
export const UNGEFAEHR_M = rasterHalbmesserM(UNGEFAEHR_GRAD);

// Ober- und Untergrenze der Genauigkeit. Bis Welle 2 standen sie NUR auf dem Server (0034: 1 m
// bis 20 km) und das Gerät kannte sie nicht — dieselbe Regel an zwei Orten mit zwei Ergebnissen
// (Hausregel 3). Gemessen war: eine Meldung mit accuracy 400000 landete im Gerät ungeklemmt auf
// der Karte. Jetzt steht die Regel HIER, und beide Gateways rechnen darüber.
//   · unten 1 m: ein „0 m genau“ gibt es auf der Erde nicht.
//   · oben 20 km: darüber ist die Meldung keine Auskunft mehr, sondern ein Fehler — ein Kreis
//     über halb Österreich sagt einem Menschen nichts.
export const GENAUIGKEIT_MIN_M = 1;
export const GENAUIGKEIT_MAX_M = 20000;

// Eine Zahl daraus machen — oder ehrlich KEINE. null heißt „unbekannt“ und nie „Ersatzwert“.
export function genauigkeitKlemmen(wert) {
  const zahl = Number(wert);
  if (!Number.isFinite(zahl) || zahl <= 0) return null;
  return Math.min(GENAUIGKEIT_MAX_M, Math.max(GENAUIGKEIT_MIN_M, Math.round(zahl)));
}

// Trägt eine Zeile selbst keine Genauigkeit, gibt es je Quelle genau EINE ehrliche Antwort:
//   · geraet  → der Vorschlags-Raster IST die Unschärfe, und die ist gerechnet (0,01° → 787 m).
//               Dieselbe Zahl gilt für ein Zuhause, das aus diesem Raster übernommen wurde —
//               beide Gateways holen sie hier (GENAUIGKEIT_M.geraet), keiner tippt sie.
//   · geteilt → NICHTS. Bis Welle 2 stand hier 100 m mit der Begründung „so grob war die Zeile
//               damals“. Seit M1 trägt aber auch eine FRISCHE Zeile keine Zahl, wenn das Gerät
//               keine meldet — alt und frisch sähen gleich aus. Also wird nichts behauptet.
//   · zuhause → null, aber aus dem anderen Grund: eine über die Suche eingetragene Adresse IST
//               ein Punkt. Ein aus dem Standort übernommenes Zuhause trägt seine 787 m selbst
//               (genauigkeitM am Ort) und kommt bei dieser Rückfallzahl gar nicht an.
// Für die Oberfläche heißt null in beiden Fällen: KEINEN Kreis zeichnen. Den Unterschied sagt
// `quelle` — bei 'zuhause' (über die Suche eingetragen) ein echter Punkt, sonst „Genauigkeit unbekannt“.
export const GENAUIGKEIT_M = { geraet: rasterHalbmesserM(VORSCHLAGS_GRAD), geteilt: null, zuhause: null };

export function genauigkeitVon(lage, quelle) {
  const eigen = lage == null ? null : genauigkeitKlemmen(lage.genauigkeitM);
  if (eigen != null) return eigen;
  return GENAUIGKEIT_M[quelle] ?? null;
}

// Die Einstellung in EINER Form — egal, was im Bestand liegt (nichts, Altbestand, Unsinn).
// Vorgabe ist 'genau'; nur die beiden bekannten Wörter kommen durch.
export function standortGenauigkeitNorm(roh) {
  const modus = roh?.modus === 'ungefaehr' ? 'ungefaehr' : 'genau';
  const ausnahmen = {};
  for (const [id, wert] of Object.entries(roh?.ausnahmen || {})) {
    if (id && (wert === 'genau' || wert === 'ungefaehr')) ausnahmen[id] = wert;
  }
  return { modus, ausnahmen };
}

// Was sieht DIESE Person von mir? Die Ausnahme schlägt den Modus — sonst wäre „für alle genau,
// außer für Tobi" nicht sagbar, und genau das ist der Fall, für den es den Schalter gibt.
// Runde 7, Welle 3 (Hausregel 3): MICH SELBST sehe ich immer genau. Der Server sagt das seit 0034
// ausdrücklich (`when besitzer = betrachter then true`), das Gerät sagte es NICHT — gemessen:
// setStandortGenauigkeitFuer('p-me','ungefaehr') machte die eigene Lage im Gerät grob, auf dem
// Server nicht. Zwei Wahrheiten über dieselbe Sache. `ich` ist die eigene personId; beide
// Gateways geben sie mit. Wer sie nicht mitgibt, bekommt wie bisher Modus/Ausnahme — die Regel
// greift nur, wo tatsächlich bekannt ist, wer „ich“ ist.
export function standortGenauigkeitFuer(einstellung, personId, ich = null) {
  if (personId && ich && personId === ich) return 'genau';
  const norm = standortGenauigkeitNorm(einstellung);
  if (personId && norm.ausnahmen[personId]) return norm.ausnahmen[personId];
  return norm.modus;
}

// Dieselbe Rundung wie früher — jetzt aber nur noch dort, wo jemand sie ausdrücklich WILL.
export function lageGroeber(lage) {
  if (!hatLage(lage)) return null;
  const raster = (wert) => Number((Math.round(Number(wert) / UNGEFAEHR_GRAD) * UNGEFAEHR_GRAD).toFixed(3));
  return {
    ...lage,
    lat: raster(lage.lat),
    lon: raster(lage.lon),
    // Die Rundung IST die Unschärfe: mindestens der Halbmesser der Rasterzelle. War die Messung
    // schon gröber, bleibt die gröbere Zahl — beschönigt wird nie, geklemmt wird wie überall.
    genauigkeitM: genauigkeitKlemmen(Math.max(UNGEFAEHR_M, genauigkeitVon(lage, 'geteilt') ?? 0)),
  };
}

// Aus einer GeolocationPosition die Lage, die im Vertrag steht. Die Genauigkeit ist die des
// Geräts, nicht unsere. Meldet es keine, steht KEINE da (null = „unbekannt“): bis Welle 2 stand
// dort UNGEFAEHR_M, also 100 — und die Karte zeichnete daraus einen 100-m-Kreis, der nichts
// bedeutete. Ober- und Untergrenze sind dieselben wie auf dem Server (genauigkeitKlemmen), damit
// eine kaputte Meldung (gemessen: accuracy 400000) nicht im Gerät ungeklemmt auf der Karte landet.
export function lageAusPosition(position, jetzt = Date.now()) {
  const c = position?.coords;
  if (!c || !Number.isFinite(Number(c.latitude)) || !Number.isFinite(Number(c.longitude))) return null;
  return {
    lat: Number(c.latitude),
    lon: Number(c.longitude),
    at: jetzt,
    genauigkeitM: genauigkeitKlemmen(c.accuracy),
  };
}

// --- Runde 7, Welle 3: eine Erlaubnisfrage entsteht NIE ohne Zutun ----------------------------
// Gemessen war: `ready()` beim Start und JEDES visibilitychange riefen standortSenden(), und das
// rief getCurrentPosition/watchPosition. Beides lässt den Browser nach der Standort-Erlaubnis
// fragen — ohne dass ein Mensch etwas getippt hat. Wer beim Öffnen einer App unvermittelt gefragt
// wird, sagt Nein; die Frage gehört in den Moment, in dem jemand etwas davon hat. „Im richtigen
// Moment fragen" heißt auch: im falschen Moment NICHT fragen.
//
// Ohne Zutun wird darum nur noch gemessen, wenn die Erlaubnis SCHON erteilt ist. Das beantwortet
// diese Funktion — sie fragt nicht den Menschen, sie fragt den Browser. Dieselbe Bauart benutzt
// web/data/orte-vorschlaege.js (vorschlagsStandortAuffrischen) seit Runde 3; sie steht jetzt hier,
// damit beide Gateways EINE Regel haben statt zwei.
//
// Kann der Browser es nicht sagen (navigator.permissions fehlt oder kennt 'geolocation' nicht —
// ältere WebViews, Safari), bleibt ein Merker: Hat dieses Gerät hier schon einmal eine Position
// geliefert, war die Erlaubnis erteilt. Der Merker ist NUR der Rückfall — wo der Browser
// antwortet, entscheidet der Browser (auch mit „nein"). Er kann niemanden in eine Frage schicken,
// der noch nie zugestimmt hat.
const ERLAUBNIS_MERKER = 'crew-standort-erlaubt';

export function standortErlaubnisMerken() {
  try { globalThis.localStorage?.setItem(ERLAUBNIS_MERKER, '1'); } catch { /* egal */ }
}

function merkerSagtJa() {
  try { return globalThis.localStorage?.getItem(ERLAUBNIS_MERKER) === '1'; } catch { return false; }
}

export function standortErlaubnisSchonDa() {
  const erlaubnis = globalThis.navigator?.permissions;
  if (!erlaubnis?.query) return Promise.resolve(merkerSagtJa());
  try {
    return erlaubnis.query({ name: 'geolocation' })
      .then((status) => status?.state === 'granted')
      .catch(() => merkerSagtJa());
  } catch {
    return Promise.resolve(merkerSagtJa());
  }
}

// Lohnt es, die neue Lage zu senden? Genaue Koordinaten ändern sich bei jedem Atemzug des
// Empfängers; „hat sich der gerundete Wert geändert" (bis Runde 6) gibt es nicht mehr. Statt
// dessen eine echte Strecke: erst ab `meter` Bewegung geht etwas raus.
export function lageWeitGenugAnders(alt, neu, meter = 25) {
  if (!hatLage(neu)) return false;
  if (!hatLage(alt)) return true;
  return entfernungKm(alt, neu) * 1000 >= meter;
}

// Runde 11 (A12, Jonathan): Solange die App OFFEN ist, wird der Standort alle 5 Sekunden aktualisiert
// (nicht mehr erst nach 25 m oder zehn Minuten). Genaue Koordinaten wackeln, darum geht in einem
// 5-s-Takt nur raus, wer sich mindestens 5 m bewegt hat; wer steht, meldet sich einmal je Minute
// (Herzschlag), damit „vor x Min" stimmt. Beide Gateways lesen DIESE Regel.
export const STANDORT_TAKT_MS = 5000;
const STANDORT_HERZSCHLAG_MS = 60000;
export function lageSendenLohnt(alt, neu, gesendetAm, jetzt = Date.now()) {
  if (!hatLage(neu)) return false;
  const seit = jetzt - (Number(gesendetAm) || 0);
  if (seit < STANDORT_TAKT_MS) return false;
  return lageWeitGenugAnders(alt, neu, 5) || seit >= STANDORT_HERZSCHLAG_MS;
}

// --- A4/A5: EINE Chatliste --------------------------------------------------------------------
// Bis Runde 6 standen Gruppen (Kachelreihe), „Temporäre Räume" (Abschnitt) und Personen (Liste)
// als drei Bauformen mit drei Ordnungen untereinander. Welche Ordnung richtig ist, ist eine
// PRODUKTentscheidung — deshalb steht sie hier und nicht in einem Bildschirm, und deshalb gilt
// sie für beide Gateways.
//
// Runde 8 (R8-6): Die dritte Art heißt jetzt so, wie Jonathan sie nennt und wie die Oberfläche
// sie zeigt — MEET (art:'meet'): der Chat eines Meets, das weder genau eine Person noch genau eine
// bestehende Gruppe betrifft. „Runde" (Runde 7) war ein zweites Wort für dieselbe Sache; die
// Oberfläche zeigt ohnehin das Zeichen und den Namen des Meets, nicht das Wort.
//
// Ein Meet-Chat ist VERGANGEN ab Mitternacht nach dem Tag seines Meets. Dann verlässt er die
// Liste (getChats) und steht nur noch unter getVergangeneChats — sieben Tage lang, danach ist er
// weg. Siehe meetChatVergangen / meetChatAbgelaufen weiter unten.
//
// eingabe:
//   me        eigene personId
//   settings  { specialPerson, bestFriendIds, freiHints }
//   people    [Person]  — bereits gefiltert (keine Blockierten, keine gelösten Freundschaften)
//   crews     [Crew]    — meine Gruppen
//   meets     [Meet]    — meine Meets, kommend UND Verlauf
//   raumVon   (roomId) → { messages, lastReadCount } | null
//   jetzt     ms
export function chatEintraege(eingabe = {}) {
  const { me, settings = {}, people = [], crews = [], meets = [], jetzt = Date.now() } = eingabe;
  const raumVon = eingabe.raumVon || (() => null);
  const namenVon = new Map(people.map((p) => [p.id, p.name]));

  // EINE Ungelesen-Regel und EINE Letzte-Aktivität-Regel für alle drei Arten (raumStand).
  const ausRaum = (roomId) => raumStand(roomId ? raumVon(roomId) : null, me);

  const eintraege = [];

  for (const person of people) {
    const raum = ausRaum(`r:${person.id}`);
    eintraege.push({
      art: 'person',
      id: person.id,
      roomId: `r:${person.id}`,
      name: person.name,
      person,
      ...raum,
      kurzlebig: false,
      vergangen: false,
      laeuft: Boolean(person.activeMeetId),
      zustand: person.free?.active ? 'frei' : (person.activeMeetId ? 'laeuft' : ''),
    });
  }

  for (const crew of crews) {
    const raum = ausRaum(`r:${crew.id}`);
    eintraege.push({
      art: 'gruppe',
      id: crew.id,
      roomId: `r:${crew.id}`,
      name: crew.name,
      crew,
      ...raum,
      kurzlebig: false,
      vergangen: false,
      laeuft: Boolean(crew.activeMeetId),
      zustand: crew.activeMeetId ? 'laeuft' : '',
    });
  }

  // Runde 8 (R8-6): Vergangene Meet-Chats stehen NICHT in dieser Liste — sie gehören unter
  // „Vergangene Chats" (vergangeneMeetChats). Die eine Regel dafür steht in meetChatVergangen.
  for (const eintrag of meetChatEintraege(meets, { me, jetzt, ausRaum, namenVon })) {
    if (!eintrag.vergangen) eintraege.push(eintrag);
  }

  // Die eine Ordnung. Ungelesen ist BEWUSST keine Stufe: eine Zeile, die beim Lesen nach oben
  // springt und danach zurück, war schon einmal der gemessene Grund für Ärger.
  // Runde 11 (A11, Jonathan): Die Chat-Liste ist NUR nach Zeit sortiert — jüngste Aktivität zuerst.
  // Frei-Leute, laufende Meets, beste Freunde und die besondere Person stehen nicht mehr oben
  // (die markierten Leute haben ihre eigene Reihe über der Suche).
  eintraege.sort((a, b) => {
    if ((b.zeit || 0) !== (a.zeit || 0)) return (b.zeit || 0) - (a.zeit || 0);
    return String(a.name || '').localeCompare(String(b.name || ''), 'de');
  });
  return eintraege;
}

// Ungelesen und letzte Aktivität eines Raums — EINE Regel für jede Art und für beide Listen.
// Runde 8 (R8-8): Alte Anstupser („Hast du Zeit?") zählen nicht mehr. Der Raum zeigt sie nicht
// mehr an; eine Zahl oder Vorschau, die auf etwas Unsichtbares zeigt, wäre gelogen.
function raumStand(raum, me) {
  const nachrichten = raum?.messages || [];
  const zaehlbar = (n) => n.kind === 'text';
  const letzteN = [...nachrichten].reverse().find((n) => zaehlbar(n));
  const unread = nachrichten
    .slice(Math.max(0, raum?.lastReadCount || 0))
    .filter((n) => n.authorId !== me && zaehlbar(n)).length;
  const at = letzteN ? nachrichtenZeit(letzteN) : 0;
  return {
    letzte: letzteN ? { text: letzteN.text || '', authorId: letzteN.authorId, kind: letzteN.kind, at } : null,
    zeit: at,
    unread,
    // Alles, was der Raum zeigt (Text, Standort …) — nur die unsichtbaren Anstupser nicht.
    anzahl: nachrichten.filter((n) => n.kind !== 'nudge').length,
  };
}

// Die Meet-Chats eines Bestands — aktive UND vergangene, jeder mit `vergangen`. Aufgeteilt wird
// von chatEintraege (aktive) und vergangeneMeetChats (vergangene); die Form ist dieselbe.
//
// Nur GEMISCHTE Runden haben einen eigenen Chat (roomId, mehr als eine andere Person, keine
// Gruppe): Mit genau einer Person gilt deren Chat, mit einer Gruppe deren Chat.
function meetChatEintraege(meets, { me, jetzt, ausRaum, namenVon }) {
  const liste = [];
  for (const meet of meets) {
    if (meet.crewId || !meet.roomId || (meet.personIds || []).length <= 1) continue;
    if (!(meet.participation?.[me] || meet.creatorId === me)) continue;
    const raum = ausRaum(meet.roomId);
    const laeuft = meet.status === 'active';
    const vergangen = meetChatVergangen(meet, jetzt);
    // Ein vergangener Chat, in dem nie jemand etwas geschrieben hat, hat unter „Vergangene
    // Chats" nichts zu zeigen — und einer, der älter als sieben Tage ist, ist weg.
    // Runde 11 (B7): Ein ABGESAGTES Meet ist beides zugleich (meetChatAbgesagt) und fällt damit
    // aus beiden Listen — ohne dass hier ein Sonderweg entsteht.
    if (vergangen && (!raum.anzahl || meetChatAbgelaufen(meet, jetzt))) continue;
    liste.push({
      art: 'meet',
      id: meet.id,
      roomId: meet.roomId,
      name: meetChatName(meet, (id) => namenVon.get(id), me),
      benannt: Boolean(String(meet.title || '').trim()),
      meet,
      personIds: [me, ...(meet.personIds || [])].filter((id, i, alle) => id && alle.indexOf(id) === i),
      ...raum,
      kurzlebig: true,
      vergangen,
      laeuft,
      zustand: laeuft ? 'laeuft' : (vergangen ? 'vorbei' : 'geplant'),
    });
  }
  return liste;
}

// Runde 8 (R8-6): die Liste hinter „Vergangene Chats" — dieselbe Eingabe und dieselbe
// Eintragsform wie chatEintraege, nur die vergangenen Meet-Chats, jüngste Aktivität zuerst.
export function vergangeneMeetChats(eingabe = {}) {
  const { me, people = [], meets = [], jetzt = Date.now() } = eingabe;
  const raumVon = eingabe.raumVon || (() => null);
  const namenVon = new Map(people.map((p) => [p.id, p.name]));
  const ausRaum = (roomId) => raumStand(roomId ? raumVon(roomId) : null, me);
  return meetChatEintraege(meets, { me, jetzt, ausRaum, namenVon })
    .filter((eintrag) => eintrag.vergangen)
    .sort((a, b) => (b.zeit - a.zeit) || String(b.meet?.date || '').localeCompare(String(a.meet?.date || '')));
}

// --- Runde 8 (R8-6): Wann ist ein Meet-Chat vergangen, wann weg? --------------------------------
// Vergangen ab MITTERNACHT NACH dem Tag des Meets, weg sieben Tage danach. Gerechnet in der
// Zeitzone des Geräts über Jahr/Monat/Tag — nie „+24 h", sonst verschiebt die Sommerzeit die
// Grenze um eine Stunde. Ein laufendes Meet und ein laufender Loop sind nie vergangen: ihr Chat
// wird ja noch gebraucht.
export const VERGANGENE_CHATS_TAGE = 7;

function tagesGrenze(dateISO, tageDanach) {
  const [jahr, monat, tag] = String(dateISO || '').split('-').map(Number);
  if (!jahr || !monat || !tag) return null;
  return new Date(jahr, monat - 1, tag + tageDanach).getTime();
}

// Runde 11 (B7, Jonathan): ABGESAGT ist sofort vorbei — und zwar ganz. Ein abgesagtes Meet hat
// keinen Chat mehr: nicht in der Chat-Liste, nicht unter „Vergangene Chats". Vorher hing der
// Chat am DATUM: Wer ein Meet für nächsten Samstag absagte, behielt seinen Chat bis Sonntag in
// der Liste (Zustand „geplant") und danach noch sieben Tage darunter. Genau EINE Regel hier —
// die beiden Listen und das Aufräumen in beiden Gateways lesen sie, ohne etwas Eigenes zu tun.
// Der Gruppenchat einer echten Gruppe ist davon nie betroffen: er gehört der Gruppe, nicht dem
// Meet (meetChatEintraege überspringt Meets mit crewId).
export function meetChatAbgesagt(meet) {
  return Boolean(meet?.cancelled);
}

export function meetChatVergangen(meet, jetzt = Date.now()) {
  if (!meet) return false;
  if (meetChatAbgesagt(meet)) return true;
  if (meet.status === 'active' || meet.loop?.active) return false;
  const ab = tagesGrenze(meet.date, 1);
  return ab !== null && jetzt >= ab;
}

export function meetChatAbgelaufen(meet, jetzt = Date.now()) {
  if (meetChatAbgesagt(meet)) return true;
  if (!meetChatVergangen(meet, jetzt)) return false;
  return jetzt >= tagesGrenze(meet.date, 1 + VERGANGENE_CHATS_TAGE);
}

// Runde 8 (R8-6): Beim Anlegen eines Meets — gibt es eine Gruppe mit GENAU diesen Leuten (ich
// eingeschlossen)? Nur dann fragt die Oberfläche „Gruppe nehmen oder eigener Chat". Fehlt auch
// nur einer der Gruppe oder ist einer zu viel, gibt es keine Frage: dann ist es ein eigener Chat.
// Mit genau EINER anderen Person gibt es ebenfalls keine Frage — dann gilt deren Chat.
// → crewId | null (bei mehreren passenden die erste, in der Reihenfolge von getCrews)
export function gruppeMitGenau(crews = [], personIds = [], me) {
  const andere = [...new Set((personIds || []).filter((id) => id && id !== me))];
  if (andere.length <= 1) return null;
  const soll = new Set([me, ...andere]);
  const passend = crews.find((crew) => {
    const mitglieder = new Set(crew?.memberIds || []);
    return mitglieder.size === soll.size && [...soll].every((id) => mitglieder.has(id));
  });
  return passend?.id || null;
}

// Der Name eines Meet-Chats. Hat das Meet einen Titel, gilt der — er ist gewählt worden. Hat es
// keinen, heißt der Chat nach den Leuten, die dabei sind: das ist keine Erfindung, sondern genau
// das, was dieser Chat ist. Namen, die diese App nicht kennt (keine Freundschaft mehr, blockiert),
// werden GEZÄHLT und nicht geraten — „Mira, Sam +2" ist wahr, „Mira, Sam und Lena" wäre es nicht.
// Kennt sie gar keinen, sagt die Zeile ehrlich, dass der Titel fehlt, statt leer zu bleiben.
// Runde 8: ohne das Wort „Runde" — die Zeile trägt das Zeichen des Meets, das sagt, was sie ist.
export function meetChatName(meet, namenVon, me) {
  const titel = String(meet?.title || '').trim();
  if (titel) return titel;
  const ids = (meet?.personIds || []).filter((id, i, alle) => id && id !== me && alle.indexOf(id) === i);
  const namen = ids.map((id) => String(namenVon?.(id) || '').trim()).filter(Boolean);
  if (!namen.length) return t('Meet ohne Titel');
  const sichtbar = namen.slice(0, 3);
  const rest = ids.length - sichtbar.length;
  return rest > 0 ? `${sichtbar.join(', ')} +${rest}` : sichtbar.join(', ');
}

// Zeitstempel einer Nachricht aus date ('YYYY-MM-DD') und time ('H:MM'). Räume speichern beides
// getrennt; die Liste braucht EINE Zahl, sonst sortiert sie Text.
// Runde 9 (Jonathan): Zwei Nachrichten in derselben Minute — oben steht die wirklich letzte. Wo
// die Nachricht ihren vollen Zeitstempel trägt (`at`, ms — Server UND Gerät), zählt er; `date` und
// `time` (Minuten) sind nur noch der Rückfall für ältere Einträge. Angezeigt wird weiter kurz.
export function nachrichtenZeit(nachricht) {
  const genau = Number(nachricht?.at);
  if (Number.isFinite(genau) && genau > 0) return genau;
  if (!nachricht?.date) return 0;
  const [jahr, monat, tag] = String(nachricht.date).split('-').map(Number);
  const [stunde, minute] = String(nachricht.time || '0:00').split(':').map(Number);
  const wert = new Date(jahr, (monat || 1) - 1, tag || 1, stunde || 0, minute || 0).getTime();
  return Number.isFinite(wert) ? wert : 0;
}

// Runde 11 (C1, D3): „Chat löschen" (Wischen in der Chatliste) leert den Verlauf NUR für mich.
// settings.chatGeleert[roomId] ist die Zeit der Nachricht, die beim Löschen die letzte war — nicht
// „jetzt": Eine Geräteuhr, die vorgeht, würde sonst die nächste echte Nachricht mit verschlucken.
// Beide Gateways filtern ihre Räume (roomFromId) mit DIESER Regel; Liste und Raum lesen daraus.
export function nachGeleert(nachricht, settings, roomId) {
  const grenze = Number(settings?.chatGeleert?.[roomId]) || 0;
  return !grenze || nachrichtenZeit(nachricht) > grenze;
}

// --- Find (Runde 8, R8-50/R8-66; seit Paket G2 nach dem Algorithmus) ---------------------------
// Find rechnet nichts mehr selbst: Was gut ist, sagt der Crew Score (Algorithmus 1), was zu wem passt,
// Algorithmus 2 (web/data/auswahl-regeln.js) — beide kommen fertig über die Gateways (repository.js,
// Abschnitt „Algorithmus 2"). Die frühere eigene Form (findListe mit vorläufiger Zahl) und das Anlegen
// von Hand (addFindEintrag, Tabelle find_admins) sind entfallen: Einträge ohne Crew Score gingen am
// Algorithmus vorbei — eine zweite Wahrheit (ALGORITHMUS_ZUSATZ §4: keine Freigabe von Hand).

// EIN Eintrag nach seiner Kennung (repo.findEintrag) — dieselbe Regel in beiden Gateways. `liste` ist die
// Ausgabe von auswahl-regeln.js › suchen({ nameTreffer: true, … }) über die Kandidaten zu dieser Kennung:
// Sie findet auch, was nicht freigegeben ist (unter 70 → nichtEmpfohlen, ohne Zahl). Ein Vorschlag ist der
// Eintrag damit nicht — „Gefunden über die Suche" wäre für Gemerktes oder einen geteilten Link falsch. Darum
// trägt er keinen Satz „Warum sehe ich das?", außer dem Hinweis, dass er nicht unter den Empfehlungen ist.
export function eintragNachKennung(liste, kennung) {
  const e = (Array.isArray(liste) ? liste : []).find((x) => x && x.id === kennung);
  if (!e) return null;
  if (e.nichtEmpfohlen) return e;
  return { ...e, warum: '', texte: { ...(e.texte || {}), warum: null } };
}

// settings.gemerktIds — die gemerkten Find-Einträge. Privat, nur Ids, keine Doppelten, in der
// Reihenfolge des Merkens. Beide Gateways schreiben sie über updateSettings.
export function gemerktIdsBereinigen(roh) {
  return [...new Set((Array.isArray(roh) ? roh : []).map((id) => String(id ?? '').trim()).filter(Boolean))].slice(0, 500);
}

// --- A6: „Ich bin da" -------------------------------------------------------------------------
// Ankunftsstempel am Meet: Reihenfolge und Anzahl, mehr nicht. AUSDRÜCKLICH kein Punktestand,
// kein Verlauf über Meets hinweg, keine Verspätungsminuten, kein Geld — ein von einer App
// geführter Pranger für die Person, die immer zu spät kommt, arbeitet gegen das Ziel der App.
// Der Wert der Funktion liegt woanders: „drei sind schon da" beantwortet „soll ich los?".
export function ankunftListe(stempel = {}, jetzt = Date.now()) {
  return Object.entries(stempel)
    .filter(([, at]) => Number(at) > 0 && Number(at) <= jetzt + 60000)
    .sort((a, b) => a[1] - b[1])
    .map(([personId, at], index) => ({ personId, at: Number(at), position: index + 1 }));
}

// =============================================================================================
// V1-Kern (AUFTRAG_V1_KERN.md, 26.09.2026) — Regeln, die für BEIDE Gateways gelten.
// =============================================================================================

// --- §7 Mindestalter ---------------------------------------------------------------------------
// Angefragt wird nur das Geburtsjahr (Datensparsamkeit). Gerechnet wird das Alter, das die Person im
// laufenden Kalenderjahr erreicht — wer 2012 geboren ist, gilt 2026 als 14. Das ist die Regel, die
// sich mit einem Jahr ehrlich treffen lässt; ein genaueres Alter bräuchte den Geburtstag.
export const MINDESTALTER = 14;
// Bis einschließlich dieses Alters gelten die Schutzregeln (VERSION_1.md §4.3).
export const JUGEND_BIS = 15;

export function alterAus(geburtsjahr, jetzt = Date.now()) {
  const jahr = Number(geburtsjahr);
  if (!Number.isInteger(jahr)) return null;
  const heute = new Date(jetzt).getFullYear();
  if (jahr < 1900 || jahr > heute) return null;
  return heute - jahr;
}

// → { ok:true, jahr } | { ok:false, grund:'ungueltig'|'zu-jung' }
export function geburtsjahrPruefen(geburtsjahr, jetzt = Date.now()) {
  const alter = alterAus(geburtsjahr, jetzt);
  if (alter === null) return { ok: false, grund: 'ungueltig' };
  if (alter < MINDESTALTER) return { ok: false, grund: 'zu-jung' };
  return { ok: true, jahr: Number(geburtsjahr) };
}

// 14 oder 15: Standort nur für Freunde und ab Werk aus, keine Tipps mit Alkohol-Schwerpunkt,
// nicht über eine Suche auffindbar. Unbekanntes Alter ist KEIN Freibrief — die App fragt es nach.
export function jugendlich(geburtsjahr, jetzt = Date.now()) {
  const alter = alterAus(geburtsjahr, jetzt);
  return alter !== null && alter >= MINDESTALTER && alter <= JUGEND_BIS;
}

// Dieselbe Regel für Vorschläge (Entdecken, Orte aus der Funktion `vorschlaege`: art 'glas'/'feiern').
export function ohneAlkoholFuerJugend(liste = [], jugendlich = false) {
  return jugendlich ? (liste || []).filter((eintrag) => !hatAlkoholSchwerpunkt(eintrag)) : (liste || []);
}

// Tipps mit Alkohol-Schwerpunkt (Bar, Pub, Club, Weinfest …) — für 14- und 15-Jährige ausgeblendet.
// Ein Restaurant, das auch Wein ausschenkt, ist KEIN Alkohol-Schwerpunkt; ein Konzert im Club
// schon, wenn der Eintrag selbst Bar/Club/Party als Kern nennt. Geprüft wird Titel, Art und Tags.
const ALKOHOL_SCHWERPUNKT = /\b(bar|bars|cocktail\w*|pub|pubs|kneipe\w*|beisl|club|clubs|nachtclub\w*|disco\w*|diskothek\w*|party|partys|parties|feiern|rave\w*|shots?|weinfest\w*|weinverkostung\w*|bierfest\w*|oktoberfest|brauerei\w*|biergarten\w*|schnaps\w*|whisk(e)?y\w*|tasting)\b/;
const ALKOHOL_ARTEN = new Set(['glas', 'feiern']);

export function hatAlkoholSchwerpunkt(eintrag) {
  if (!eintrag || typeof eintrag !== 'object') return false;
  if (ALKOHOL_ARTEN.has(String(eintrag.iconKey || eintrag.art || ''))) return true;
  const text = [eintrag.titel, eintrag.title, eintrag.kategorie, ...(Array.isArray(eintrag.tags) ? eintrag.tags : [])]
    .map((wert) => String(wert || '').toLowerCase())
    .join(' ')
    .normalize('NFD').replace(/[\u0300-\u036f]/g, '');
  return ALKOHOL_SCHWERPUNKT.test(text);
}

// --- §6 Geteilte Links -------------------------------------------------------------------------
// Form und Erzeugung des Link-Codes stehen in core/einladung.js (die Einladungsseite braucht sie
// ohne diese Datei); hier für die Gateways weitergereicht.
export { istTeilCode, teilCodeNorm, neuerTeilCode, TEIL_CODE_LAENGE };

// Ein Meet lässt sich teilen, solange es nicht abgesagt und nicht vorbei ist.
// → null (teilbar) | 'abgesagt' | 'vorbei'
export function meetNichtTeilbar(meet, heute = toISODate(now())) {
  if (!meet) return 'unbekannt';
  if (meet.cancelled || meet.status === 'cancelled') return 'abgesagt';
  if (meetIstVorbei(meet, heute)) return 'vorbei';
  return null;
}

// Die öffentliche Vorschau eines geteilten Meets/Tipps (Einladungsseite) — genau diese Felder, in
// beiden Gateways gleich. Keine Namen anderer Teilnehmer (nur die Zahl): Wer den Link hat, soll
// sehen, WAS los ist, nicht WER alles dabei ist.
// vonId: wer den Link geteilt hat — damit die Seite ehrlich „Nina + 2 sind dabei" schreiben kann (vonDabei).
// bild/bildUrheber/bildSeite: das Ortsfoto wie auf der Meet-Seite (freie Lizenzen verlangen den Urheber).
export function teilMeetVorschau(meet, heute = toISODate(now()), vonId = null) {
  const teilnahme = meet?.participation || {};
  return {
    vonDabei: Boolean(vonId) && teilnahme[vonId] === 'yes',
    bild: meet?.bild || null,
    bildUrheber: meet?.bildUrheber || null,
    bildSeite: meet?.bildSeite || null,
    title: String(meet?.title || ''),
    icon: meet?.icon || '',
    iconKey: meet?.iconKey || null,
    date: meet?.date || null,
    time: meet?.time || '',
    openTime: Boolean(meet?.openTime),
    nowTime: Boolean(meet?.nowTime),
    placeName: String(meet?.place?.name || ''),
    dabei: Object.values(teilnahme).filter((stand) => stand === 'yes').length,
    abgesagt: Boolean(meet?.cancelled),
    vorbei: meet ? meetIstVorbei(meet, heute) : false,
  };
}

export function teilTippVorschau(tipp) {
  return {
    title: String(tipp?.titel || tipp?.title || ''),
    iconKey: tipp ? artVon({ title: tipp.titel || tipp.title, category: tipp.art, iconKey: tipp.iconKey }) : null,
    bild: tipp?.bild || null,
    bildUrheber: tipp?.bildUrheber || null,
    bildSeite: tipp?.bildSeite || null,
    ort: tipp?.ort?.adresse || tipp?.ort?.name || null,
    art: tipp?.art || null,
  };
}

// --- §2 Stumm schalten --------------------------------------------------------------------------
// settings.stumm = { personen:[id…], crews:[id…] } — privat, nur Ids, keine Doppelten.
export function stummNorm(roh) {
  const liste = (werte) => [...new Set((Array.isArray(werte) ? werte : []).map((id) => String(id ?? '').trim()).filter(Boolean))];
  return { personen: liste(roh?.personen), crews: liste(roh?.crews) };
}

export function stummMit(roh, { personId, crewId, stumm } = {}) {
  const neu = stummNorm(roh);
  const id = String(personId || crewId || '').trim();
  if (!id) return null;
  const liste = personId ? neu.personen : neu.crews;
  const stelle = liste.indexOf(id);
  if (stumm && stelle < 0) liste.push(id);
  if (!stumm && stelle >= 0) liste.splice(stelle, 1);
  return neu;
}

export function istStummIn(roh, { personId, crewId } = {}) {
  const s = stummNorm(roh);
  if (personId) return s.personen.includes(String(personId));
  if (crewId) return s.crews.includes(String(crewId));
  return false;
}

// --- §4 Abstimmung im Meet ---------------------------------------------------------------------
// EINE Regel für Demo, Server-Datenweg und Server (die Datenbank rechnet dieselbe Regel in SQL,
// supabase/migrations/0050_abstimmung.sql — Prüfung scratch/v1k-abstimmung-server.mjs vergleicht beide).
//
//   · Mehrfachwahl: Jede Person tippt ALLE Optionen an, die für sie passen.
//   · Höchstens ABSTIMMUNG_MAX Optionen je Frage (Zeit bzw. Was).
//   · Kommt zu einem festen Wert der erste Gegenvorschlag, wird der bisherige Wert selbst eine Option
//     (`bisher: true`). Wer schon zugesagt hatte (und der Ersteller), hat den bisherigen Plan gewählt:
//     Er zählt dort STILL mit (`stillschweigend`), gilt aber NICHT als „hat abgestimmt" — sonst endete
//     jede Frage beim ersten Gegenvorschlag, bevor jemand sie gesehen hat. Tippt er selbst, gilt nur
//     noch, was er getippt hat. So kippt ein einzelner Gegenvorschlag, auf den niemand reagiert, nie
//     einen Plan, dem alle schon zugesagt hatten.
//   · Stimmberechtigt: Ersteller + Eingeladene (Crew-Meet: die Crew), ohne wer abgesagt hat.
//   · Ende: alle Stimmberechtigten haben in dieser Frage gewählt (ab zwei Personen — allein entscheidet
//     nur die Frist oder der Ersteller) ODER die Frist ist erreicht. Dann gilt die führende Option.
//   · Gleichstand: die bisherige Option, sonst die zuerst angelegte. Nur Stimmen Stimmberechtigter zählen.
export const ABSTIMMUNG_MAX = 4;
export const ABSTIMMUNG_FRIST_MS = 24 * 60 * 60 * 1000;
const STUNDE_MS = 60 * 60 * 1000;

function startMs(datum, zeit) {
  if (!datum || !zeit || !/^\d{1,2}:\d{2}/.test(String(zeit))) return NaN;
  const [jahr, monat, tag] = String(datum).split('-').map(Number);
  const [stunde, minute] = String(zeit).split(':').map(Number);
  return new Date(jahr, monat - 1, tag, stunde, minute, 0, 0).getTime();
}

export function abstimmungStimmberechtigt(meet, crewMitglieder = []) {
  const ids = new Set();
  if (meet?.creatorId) ids.add(meet.creatorId);
  for (const id of meet?.personIds || []) ids.add(id);
  if (meet?.crewId) for (const id of crewMitglieder || []) ids.add(id);
  const teilnahme = meet?.participation || {};
  for (const [id, stand] of Object.entries(teilnahme)) if (stand !== 'no') ids.add(id);
  for (const [id, stand] of Object.entries(teilnahme)) if (stand === 'no') ids.delete(id);
  return [...ids];
}

// Wer hat in dieser Frage selbst getippt (egal welche Option)?
function aktiveIn(optionen) {
  return new Set(optionen.flatMap((o) => (Array.isArray(o?.votes) ? o.votes : [])));
}

// Wer zählt für eine Option: selbst Getipptes, dazu die stille Zustimmung zum bisherigen Plan von allen,
// die noch nicht selbst getippt haben. Nur Stimmberechtigte zählen (wer abgesagt hat, fällt heraus).
function gueltigeStimmen(option, berechtigt, aktive = new Set()) {
  const getippt = Array.isArray(option?.votes) ? option.votes : [];
  const still = (Array.isArray(option?.stillschweigend) ? option.stillschweigend : []).filter((id) => !aktive.has(id));
  const alle = [...new Set([...getippt, ...still])];
  return berechtigt ? alle.filter((id) => berechtigt.has(id)) : alle;
}

// → id der führenden Option (Reihenfolge = Reihenfolge des Anlegens)
export function abstimmungGewinner(optionen = [], stimmberechtigt = null) {
  const berechtigt = stimmberechtigt ? new Set(stimmberechtigt) : null;
  const aktive = aktiveIn(optionen);
  let beste = null;
  let besteZahl = -1;
  for (const option of optionen) {
    const zahl = gueltigeStimmen(option, berechtigt, aktive).length;
    if (zahl > besteZahl || (zahl === besteZahl && option.bisher && !beste?.bisher)) {
      beste = option;
      besteZahl = zahl;
    }
  }
  return beste?.id ?? null;
}

// Standard-Frist ab jetzt: 24 h, aber spätestens 1 h vor der frühesten festen Zeit (Option oder Plan),
// frühestens 1 h ab jetzt.
export function abstimmungFristFuer(meet, jetzt = Date.now()) {
  const zeiten = (meet?.variants || [])
    .filter((v) => v.kind === 'time' && !v.open && !v.now)
    .map((v) => startMs(v.date, v.time));
  if (meet?.time && !meet.openTime && !meet.nowTime) zeiten.push(startMs(meet.date, meet.time));
  const frueheste = Math.min(...zeiten.filter(Number.isFinite));
  let bis = jetzt + ABSTIMMUNG_FRIST_MS;
  if (Number.isFinite(frueheste)) bis = Math.min(bis, frueheste - STUNDE_MS);
  return Math.max(bis, jetzt + STUNDE_MS);
}

export function abstimmungStand(meet, { stimmberechtigt = [], jetzt = Date.now(), ich = null } = {}) {
  const berechtigt = new Set(stimmberechtigt);
  const fragen = [];
  for (const art of ['time', 'activity']) {
    const optionen = (meet?.variants || []).filter((v) => v.kind === art);
    if (!optionen.length) continue;
    const aktive = aktiveIn(optionen);
    const abgestimmt = stimmberechtigt.filter((id) => aktive.has(id));
    const fuehrendId = abstimmungGewinner(optionen, stimmberechtigt);
    fragen.push({
      art,
      optionen: optionen.map((o) => {
        const stimmen = gueltigeStimmen(o, berechtigt, aktive);
        const still = stimmen.filter((id) => !(o.votes || []).includes(id));
        return {
          id: o.id, variant: o, stimmen, still, anzahl: stimmen.length, fuehrend: o.id === fuehrendId,
          meine: Boolean(ich) && (o.votes || []).includes(ich), bisher: Boolean(o.bisher),
        };
      }),
      abgestimmt,
      fehlt: stimmberechtigt.filter((id) => !abgestimmt.includes(id)),
      fuehrendId,
      voll: optionen.length >= ABSTIMMUNG_MAX,
    });
  }
  const bis = Number(meet?.abstimmungBis) || null;
  return { offen: fragen.length > 0, bis, abgelaufen: Boolean(bis) && jetzt >= bis, stimmberechtigt: [...stimmberechtigt], fragen };
}

// Welche Fragen jetzt enden: → [{ art, variantId }]
export function abstimmungFaellig(meet, { stimmberechtigt = [], jetzt = Date.now() } = {}) {
  const stand = abstimmungStand(meet, { stimmberechtigt, jetzt });
  return stand.fragen
    .filter((frage) => stand.abgelaufen || (stimmberechtigt.length >= 2 && frage.fehlt.length === 0))
    .map((frage) => ({ art: frage.art, variantId: frage.fuehrendId }));
}

// Die gewählte Option wird zum Plan. Verändert `meet` (beide Gateways rufen das auf einer eigenen Kopie
// bzw. ihrem Zustand auf) und gibt zurück, was entschieden wurde.
export function abstimmungAnwenden(meet, art, variantId, jetzt = Date.now()) {
  const optionen = (meet.variants || []).filter((v) => v.kind === art);
  const gewaehlt = optionen.find((v) => v.id === variantId) || null;
  if (gewaehlt && art === 'time') {
    // Die DAUER gehört zum Meet, nicht zur Uhrzeit (Befund P2): 19:00–21:00 und gewählt wird Sa 14:00 →
    // 14:00–16:00. Ohne feste neue Zeit (offen/„Jetzt") gibt es kein Ende.
    const dauer = meetDauerMin(meet);
    if (gewaehlt.date) meet.date = gewaehlt.date;
    meet.time = gewaehlt.open ? '' : (gewaehlt.time || meet.time);
    meet.openTime = Boolean(gewaehlt.open);
    meet.nowTime = Boolean(gewaehlt.now);
    meet.endTime = dauer && meet.time && !meet.openTime && !meet.nowTime ? zeitPlus(meet.time, dauer) : undefined;
  } else if (gewaehlt && art === 'activity') {
    if (gewaehlt.title) meet.title = gewaehlt.title;
    if (gewaehlt.icon) meet.icon = gewaehlt.icon;
    if (gewaehlt.iconKey) meet.iconKey = gewaehlt.iconKey;
    if (gewaehlt.category) meet.category = gewaehlt.category;
    if (gewaehlt.place) meet.place = gewaehlt.place;
  }
  meet.variants = (meet.variants || []).filter((v) => v.kind !== art);
  meet.entschiedenAm = jetzt;
  if (!meet.variants.length) {
    meet.abstimmungBis = null;
    if (meet.status === 'open') meet.status = 'decided';
  }
  return { art, variantId: gewaehlt?.id || null, bisher: Boolean(gewaehlt?.bisher) };
}

// Dauer eines Meets in Minuten aus time/endTime (über Mitternacht: Ende < Beginn) — null ohne beides.
export function meetDauerMin(meet) {
  const beginn = /^(\d{1,2}):(\d{2})/.exec(String(meet?.time || ''));
  const ende = /^(\d{1,2}):(\d{2})/.exec(String(meet?.endTime || ''));
  if (!beginn || !ende || meet.openTime || meet.nowTime) return null;
  const von = Number(beginn[1]) * 60 + Number(beginn[2]);
  const bis = Number(ende[1]) * 60 + Number(ende[2]);
  const dauer = bis > von ? bis - von : bis + 1440 - von;
  return dauer > 0 && dauer < 1440 ? dauer : null;
}

function zeitPlus(zeit, minuten) {
  const [h, m] = String(zeit).split(':').map(Number);
  const summe = (h * 60 + m + minuten) % 1440;
  return `${String(Math.floor(summe / 60)).padStart(2, '0')}:${String(summe % 60).padStart(2, '0')}`;
}

// Wann sind zwei Vorschläge DERSELBE (zusammenführen statt zweite Option)? Zeit: Tag, Uhrzeit, „offen".
// Was: Titel UND Ort — „Wandern Pfänder" am Strandbad ist ein anderer Vorschlag als an der Talstation
// (Befund P4: der Chip „… ins Meet" aus dem Chat schlägt denselben Titel an einem anderen Ort vor; nur
// über den Titel verglichen, verpuffte er). Groß-/Kleinschreibung und Ränder zählen nicht.
export function gleicherVorschlag(a, b) {
  if (!a || !b || a.kind !== b.kind) return false;
  const norm = (wert) => String(wert || '').trim().toLowerCase();
  if (a.kind === 'time') {
    return a.date === b.date && Boolean(a.open) === Boolean(b.open) && (Boolean(a.open) || norm(a.time) === norm(b.time));
  }
  // Nennt einer der beiden keinen Ort, entscheidet der Titel (ein Vorschlag ohne Ort meint: dieselbe Sache).
  if (norm(a.title) !== norm(b.title)) return false;
  return !norm(a.place?.name) || !norm(b.place?.name) || norm(a.place?.name) === norm(b.place?.name);
}

// Der bisherige Plan-Wert als Option (beim ersten Gegenvorschlag). null, wenn es keinen gibt
// (Zeit offen / „Jetzt" ist kein fester Wert, um den man abstimmen müsste).
export function abstimmungBisherOption(meet, art, id, stimmberechtigt = []) {
  const berechtigt = new Set(stimmberechtigt);
  const zugesagt = Object.entries(meet?.participation || {})
    .filter(([pid, stand]) => stand === 'yes' && berechtigt.has(pid)).map(([pid]) => pid);
  const still = [...new Set([...(berechtigt.has(meet?.creatorId) ? [meet.creatorId] : []), ...zugesagt])];
  if (art === 'time') {
    if (!meet?.date || !meet.time || meet.openTime || meet.nowTime) return null;
    return { id, kind: 'time', authorId: meet.creatorId, bisher: true, votes: [], stillschweigend: still, date: meet.date, time: meet.time, open: false, now: false };
  }
  // Ein „Spontanes Treffen" hat keine Aktivität, um die man abstimmen müsste.
  const titel = String(meet?.title || '').trim();
  if (!titel || titel === SPONTAN_TITEL) return null;
  return {
    id, kind: 'activity', authorId: meet.creatorId, bisher: true, votes: [], stillschweigend: still,
    title: meet.title, icon: meet.icon || '', iconKey: meet.iconKey || null, category: meet.category || null, place: meet.place || null,
  };
}
