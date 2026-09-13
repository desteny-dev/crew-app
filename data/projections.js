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
