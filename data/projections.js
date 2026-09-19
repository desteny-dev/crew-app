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
// Runde 8 (R8-66): Der vorläufige Find-Score baut auf denselben Bausteinen wie „Entdecken".
import { artVon, lernWert } from '../engine/suggestion-engine.js';
import { iconKeyForText } from '../ui/activity-icons.js';

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
export const CODE_ALPHABET = '23456789ABCDEFGHJKMNPQRSTUVWXYZ';
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

// Der nächste Zeitpunkt NACH `seit`, an dem die Uhr `freeResetTime` lokal überschritten wird.
// → ms | null (null = keine gültige Uhrzeit eingestellt, dann wird nie zurückgesetzt)
export function naechsteFreiGrenze(freeResetTime, seit) {
  const treffer = FREI_ZEIT.exec(String(freeResetTime ?? ''));
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
//   busyFuerFreunde   → wie busyVollstaendig, aber titel null, wo das Schloss zu ist (person.belegt)
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

// Was eine Freundin von meinen Fenstern bekommt: die Leseform — hinter einem Schloss ohne Titel.
export function busyFuerFreunde(roh) {
  return busyVollstaendig(roh).map((fenster) => (fenster.privat ? { ...fenster, titel: null } : fenster));
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
  const besondere = settings.specialPerson?.personId || null;
  const beste = new Set(settings.bestFriendIds || []);
  const hinweise = settings.freiHints || { mode: 'alle', customIds: [] };
  const freiHinweis = (person) => {
    if (!person?.free?.active) return false;
    if (hinweise.mode === 'niemand') return false;
    if (hinweise.mode === 'beste') return beste.has(person.id);
    if (hinweise.mode === 'individuell') return (hinweise.customIds || []).includes(person.id);
    return true;
  };
  const rang = (eintrag) => {
    if (eintrag.art === 'person' && eintrag.id === besondere) return 0;
    if (eintrag.laeuft) return 1;
    if (eintrag.zeit) return 2;
    if (eintrag.art === 'person' && freiHinweis(eintrag.person)) return 3;
    if (eintrag.art === 'person' && beste.has(eintrag.id)) return 4;
    return 5;
  };
  eintraege.sort((a, b) => {
    const r = rang(a) - rang(b);
    if (r) return r;
    if (b.zeit !== a.zeit) return b.zeit - a.zeit;
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

export function meetChatVergangen(meet, jetzt = Date.now()) {
  if (!meet || meet.status === 'active' || meet.loop?.active) return false;
  const ab = tagesGrenze(meet.date, 1);
  return ab !== null && jetzt >= ab;
}

export function meetChatAbgelaufen(meet, jetzt = Date.now()) {
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
export function nachrichtenZeit(nachricht) {
  if (!nachricht?.date) return 0;
  const [jahr, monat, tag] = String(nachricht.date).split('-').map(Number);
  const [stunde, minute] = String(nachricht.time || '0:00').split(':').map(Number);
  const wert = new Date(jahr, (monat || 1) - 1, tag || 1, stunde || 0, minute || 0).getTime();
  return Number.isFinite(wert) ? wert : 0;
}

// --- Runde 8 (R8-50/R8-66): Find — der fünfte Bereich ------------------------------------------
// Jonathan: „Der fünfte Bereich wird JETZT gebaut (Mitte), auf dem vorhandenen Ergebnis —
// Jonathans eigener Algorithmus kommt später dazu." Deshalb steht hier bewusst wenig: EINE Form
// für einen Eintrag, EINE Prüfung für neue Einträge und EINE vorläufige Regel für den Score.
// Kommt der Algorithmus, ersetzt er genau findScore — sonst muss sich nichts ändern.
//
// Eintrag { id, titel, art:'event'|'restaurant'|'erlebnis', ort:{ name, lat, lon },
//           wann?:{ von:ms, bis:ms }, bild?, bildUrheber?, bildSeite?, score,
//           testerBewertung?:{ note, text, beispiel? }, gesponsert:boolean, tags:[…] }
// bildUrheber/bildSeite sind die Namensnennung, die freie Bildlizenzen (CC BY, CC BY-SA)
// verlangen — wo ein Bild steht, zeigt die Oberfläche sie mit an (wie „Entdecken").
// Die Tester-Bewertung steht NEBEN dem Score und fließt nicht hinein; „gesponsert" genauso wenig
// (Jonathan: „Anzeigen klar gekennzeichnet, das Label nie käuflich" — eine bezahlte Anzeige
// kauft sich auch keinen besseren Platz).
export const FIND_ARTEN = ['event', 'restaurant', 'erlebnis'];
export const FIND_TITEL_MAX = 120;
export const FIND_TEXT_MAX = 280;
export const FIND_TAGS_MAX = 12;
const FIND_KATEGORIE = { event: 'ausgehen', restaurant: 'essen', erlebnis: 'ausgehen' };

function findZeit(wert) {
  if (typeof wert === 'number' && Number.isFinite(wert)) return wert;
  const ms = Date.parse(String(wert ?? ''));
  return Number.isFinite(ms) ? ms : null;
}

function findText(roh, max) {
  const text = String(roh ?? '').replace(/[\x00-\x1f\x7f]/g, ' ').replace(/\s+/g, ' ').trim();
  return text ? [...text].slice(0, max).join('').trim() : '';
}

// Ein neuer Eintrag (addFindEintrag). Was nicht passt, wird abgelehnt — nicht geraten.
// Einen Score nimmt die Prüfung nicht an: er wird gerechnet, nicht eingetragen.
// → { ok:true, eintrag } | { ok:false, reason:'ungueltig', feld }
export function findEintragPruefen(roh) {
  const e = roh && typeof roh === 'object' ? roh : {};
  const titel = findText(e.titel, FIND_TITEL_MAX);
  if (!titel) return { ok: false, reason: 'ungueltig', feld: 'titel' };
  if (!FIND_ARTEN.includes(e.art)) return { ok: false, reason: 'ungueltig', feld: 'art' };
  const ortName = findText(e.ort?.name, FIND_TITEL_MAX);
  const lat = Number(e.ort?.lat);
  const lon = Number(e.ort?.lon);
  if (!ortName || e.ort?.lat == null || e.ort?.lon == null || !Number.isFinite(lat) || !Number.isFinite(lon)
    || Math.abs(lat) > 90 || Math.abs(lon) > 180) {
    return { ok: false, reason: 'ungueltig', feld: 'ort' };
  }
  let wann = null;
  if (e.wann != null) {
    const von = findZeit(e.wann.von);
    const bis = findZeit(e.wann.bis);
    if (von === null || bis === null || bis <= von) return { ok: false, reason: 'ungueltig', feld: 'wann' };
    wann = { von, bis };
  }
  // Ein Event ohne Zeit ist keins: WANN es stattfindet, ist die ganze Aussage.
  if (e.art === 'event' && !wann) return { ok: false, reason: 'ungueltig', feld: 'wann' };
  let bild = null;
  if (e.bild != null && e.bild !== '') {
    bild = String(e.bild).trim();
    if (bild.length > 500 || !/^(https:\/\/|assets\/)/.test(bild)) return { ok: false, reason: 'ungueltig', feld: 'bild' };
  }
  // Ein Bild unter CC BY/CC BY-SA braucht seine Namensnennung — sie reist mit dem Bild.
  const bildUrheber = bild ? findText(e.bildUrheber, FIND_TITEL_MAX) : '';
  let bildSeite = null;
  if (bild && e.bildSeite != null && e.bildSeite !== '') {
    bildSeite = String(e.bildSeite).trim();
    if (bildSeite.length > 500 || !/^https:\/\//.test(bildSeite)) return { ok: false, reason: 'ungueltig', feld: 'bildSeite' };
  }
  let testerBewertung = null;
  if (e.testerBewertung != null) {
    const note = Number(e.testerBewertung.note);
    // 1 bis 5 in halben Schritten — wie ein Stern, der halb voll sein darf.
    if (!Number.isFinite(note) || note < 1 || note > 5 || Math.round(note * 2) !== note * 2) {
      return { ok: false, reason: 'ungueltig', feld: 'testerBewertung' };
    }
    testerBewertung = { note, text: findText(e.testerBewertung.text, FIND_TEXT_MAX) };
  }
  const tags = [...new Set((Array.isArray(e.tags) ? e.tags : [])
    .map((tag) => findText(tag, 30).toLowerCase()).filter(Boolean))].slice(0, FIND_TAGS_MAX);
  return {
    ok: true,
    eintrag: {
      ...(e.id ? { id: String(e.id) } : {}),
      titel,
      art: e.art,
      ort: { name: ortName, lat, lon },
      ...(wann ? { wann } : {}),
      ...(bild ? { bild } : {}),
      ...(bildUrheber ? { bildUrheber } : {}),
      ...(bildSeite ? { bildSeite } : {}),
      ...(testerBewertung ? { testerBewertung } : {}),
      gesponsert: e.gesponsert === true,
      tags,
    },
  };
}

// VORLÄUFIGE Regel, bis Jonathans Algorithmus kommt (R8-50: „WARTET auf Jonathans Algorithmus").
// Sie benutzt nur, was die App schon weiß — dieselben Bausteine wie die Vorschläge in „Entdecken"
// (engine/suggestion-engine.js). 0–100, ganze Zahl, neutral ist 50:
//   +20        ein eigenes Interesse steht im Titel oder in den Tags (am Wortanfang, wie Entdecken)
//   +10        die Art des Eintrags passt zu einem Interesse (Boulderhalle ↔ „Bouldern")
//   −15 … +15  Gelerntes zu dieser Art (gewählt / übergangen / „Nicht für mich"), gedeckelt
//   +10 / +5 / −15   bis 3 km / bis 15 km / weiter als 40 km von der eigenen Mitte
//   +5         ein Event, das in den nächsten 48 Stunden beginnt
// Die Tester-Bewertung und „gesponsert" fließen NIE ein. Ohne Mitte (kein Standort, kein
// Zuhause) zählt die Entfernung nicht — geraten wird sie nicht.
export function findScore(eintrag, { interessen = [], lernen = null, mitte = null, jetzt = Date.now() } = {}) {
  if (!eintrag) return 0;
  let score = 50;
  const text = `${eintrag.titel || ''} ${(eintrag.tags || []).join(' ')}`.toLowerCase();
  const worte = (interessen || []).map((wort) => String(wort || '').toLowerCase().trim()).filter(Boolean);
  const imText = worte.some((wort) => {
    const stelle = text.indexOf(wort);
    return stelle >= 0 && (stelle === 0 || /[\s("„'/]/.test(text[stelle - 1]));
  });
  if (imText) score += 20;
  const art = artVon({ title: text, category: FIND_KATEGORIE[eintrag.art] });
  const interessenArten = new Set(worte.map((wort) => iconKeyForText(wort)).filter(Boolean));
  if (interessenArten.has(art)) score += 10;
  score += Math.max(-15, Math.min(15, lernWert(lernen, art)));
  if (hatLage(mitte) && hatLage(eintrag.ort)) {
    const km = entfernungKm(mitte, eintrag.ort);
    if (km <= 3) score += 10;
    else if (km <= 15) score += 5;
    else if (km > 40) score -= 15;
  }
  const beginn = Number(eintrag.wann?.von);
  if (eintrag.art === 'event' && Number.isFinite(beginn) && beginn >= jetzt && beginn - jetzt <= 48 * 3600000) score += 5;
  return Math.max(0, Math.min(100, Math.round(score)));
}

// Was Find zeigt: vergangene Events fallen weg (ein Konzert von gestern ist kein Vorschlag), jeder
// Eintrag bekommt SEINEN Score, sortiert wird nach Score und bei Gleichstand nach Titel.
// Liefert neue Objekte — der Bestand wird nie verändert.
export function findListe(eintraege = [], kontext = {}) {
  const jetzt = kontext.jetzt ?? Date.now();
  return (eintraege || [])
    .filter((e) => e && FIND_ARTEN.includes(e.art) && e.ort)
    .filter((e) => !e.wann || Number(e.wann.bis) > jetzt)
    .map((e) => ({
      ...e,
      ort: { ...e.ort },
      ...(e.wann ? { wann: { ...e.wann } } : {}),
      ...(e.testerBewertung ? { testerBewertung: { ...e.testerBewertung } } : {}),
      gesponsert: e.gesponsert === true,
      tags: [...(e.tags || [])],
      score: findScore(e, { ...kontext, jetzt }),
    }))
    .sort((a, b) => (b.score - a.score) || String(a.titel).localeCompare(String(b.titel), 'de'));
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
