// SuggestionEngine — plattformneutraler Vertrag (siehe spec/PRODUCT_ARCHITECTURE.md).
//
//   Eingabe: freigegebener, strukturierter Kontext
//   Ausgabe: validierte Aktivitätsideen, Sortierung oder knappe Chat-Zusammenfassung
//
// M2 implementiert NUR die deterministische RulesEngine. OnDeviceModelEngine und
// ServerModelEngine sind spätere optionale Adapter hinter demselben Vertrag.
// Die Engine macht ausschließlich Vorschläge/Zusammenfassungen — sie verschickt nichts,
// sagt nichts zu oder ab und macht nichts sichtbar.

import { entfernungKm, hatLage } from '../core/entfernung.js';
import { activityIconKey, iconKeyForText } from '../ui/activity-icons.js';
import { t } from '../core/sprache.js';

export class SuggestionEngine {
  // context: { suggestions:[..], filter:{category?, radiusKm?, price?, query?}, interests:[..],
  //            resources:[..], lernen:{arten,nein}, weekdayNow:0-6, hourNow:0-23, mitte:{lat,lon} }
  // → sortierte Liste von Vorschlägen (Teilmenge von context.suggestions), jeder mit `art` und `stufe`
  rankSuggestions(context) { throw new Error('nicht implementiert'); }

  // messages: [{authorName, text}] (nur freie Chat-Texte, keine strukturierten Meet-Daten)
  // → [{label, detail?}] knappe Stichpunkte; leer, wenn nichts zusammenzufassen ist
  summarizeChat(messages) { throw new Error('nicht implementiert'); }
}

// Runde 2: Wo ein Ort echte Koordinaten hat, wird seine Entfernung von der Suchmitte aus
// GERECHNET (context.mitte, das eigene Zuhause) — Liste, Detail-Sheet und Umkreis-Karte zeigen
// dieselben Kilometer. Ohne Suchmitte bleibt der mitgelieferte Wert.
export function mitAbstand(item, mitte) {
  if (!item || !hatLage(mitte) || !hatLage(item.place)) return item;
  return { ...item, distanceKm: Math.round(entfernungKm(mitte, item.place) * 10) / 10 };
}

// Runde 2 (Jonathan): „Gut wären klare besondere Vorschläge, gute Vorschläge und allgemeine
// Vorschläge. Das System merkt sich, wenn Dinge nicht gewählt werden."
//
//   Besonders     — Seltenes, das zu euch passt (ein Fest, ein Open-Air-Kino), oder etwas,
//                   das ausdrücklich bemerkenswert ist (besonders: true). Höchstens drei.
//                   Nie etwas Wöchentliches: ein Wochenmarkt ist nicht besonders.
//   Passt zu euch — trifft Interessen, vorhandene Ressourcen oder Gelerntes.
//   Geht immer    — alles andere.
export const STUFEN = [
  { key: 'besonders', wort: t('Besonders') },
  { key: 'passend', wort: t('Passt zu euch') },
  { key: 'immer', wort: t('Geht immer') },
];
const BESONDERS_MAX = 3;
const STUFEN_RANG = { besonders: 0, passend: 1, immer: 2 };

export function artVon(item) {
  return activityIconKey({ iconKey: item?.iconKey, icon: item?.icon, title: item?.title, category: item?.category });
}

// Gelerntes je Art: gewählt (g) zieht nach oben, übergangen (u) sanft nach unten,
// „Nicht für mich" (n) deutlich. Alles gedeckelt — drei Mal gewählt ist genug Beweis.
export function lernWert(lernen, art) {
  const a = lernen?.arten?.[art];
  if (!a) return 0;
  return Math.min(3, a.g || 0) * 10 - Math.min(5, a.u || 0) * 3 - Math.min(3, a.n || 0) * 12;
}

// Runde 3 (Jonathan: „Nicht ins Strandbad im Winter — ins Hallenbad schon."): Orte tragen
// eine Jahreszeit — 'sommer' (Freibad, Badestrand: Mai bis September), 'warm' (Biergarten,
// Minigolf, Grillplatz: April bis Oktober), 'winter' (Eisplatz draußen: November bis März)
// oder keine (geht immer). Auf der Südhalbkugel umgekehrt; in den Tropen passt alles.
const SAISON_MONATE = { sommer: [4, 5, 6, 7, 8], warm: [3, 4, 5, 6, 7, 8, 9], winter: [10, 11, 0, 1, 2] };
const WEIT_WEG_KM = 80;

export function saisonPasst(saison, monat, breite) {
  const monate = SAISON_MONATE[saison];
  if (!monate) return true;
  if (Number.isFinite(breite) && Math.abs(breite) < 23.5) return true;
  const hier = Number.isFinite(breite) && breite < 0 ? (monat + 6) % 12 : monat;
  return monate.includes(hier);
}

export class RulesEngine extends SuggestionEngine {
  rankSuggestions(context) {
    const {
      suggestions = [], filter = {}, interests = [], resources = [], lernen = null, hourNow = 12, mitte = null,
      monatNow = new Date().getMonth(),
      wetter = null,
    } = context;
    const query = (filter.query || '').trim().toLowerCase();
    const interessenArten = new Set((interests || []).map((name) => iconKeyForText(name)).filter(Boolean));
    const ressourcenArten = new Set((resources || []).map((r) => iconKeyForText(typeof r === 'string' ? r : r?.name)).filter(Boolean));
    const ausgeblendet = lernen?.nein || {};

    const bewertet = suggestions
      .map((item) => mitAbstand(item, mitte))
      .filter((item) => !ausgeblendet[item.id])
      .filter((item) => saisonPasst(item.saison, monatNow, Number(mitte?.lat ?? item.place?.lat)))
      // Runde 4 (Jonathan, G1): Orte aus der Umgebung erst, wenn man Vorschlaege aus seiner Umgebung
      // will (freigegebener Standort oder Zuhause). Ohne Mitte bleiben nur Ideen ohne festen Ort.
      .filter((item) => Boolean(mitte) || item.home || !hatLage(item.place))
      .filter((item) => {
        if (filter.category && filter.category !== 'egal' && item.category !== filter.category) return false;
        // Runde 3 (Jonathan: „In Salzburg zeigt es Vorarlberg"): Was weit weg von zuhause liegt,
        // gehört nicht in die Vorschläge — auch ohne gesetzten Umkreis.
        const grenzeKm = filter.radiusKm != null ? filter.radiusKm : WEIT_WEG_KM;
        if (item.distanceKm != null && item.distanceKm > grenzeKm) return false;
        if (filter.price && filter.price !== 'egal' && item.priceLevel !== filter.price && !(filter.price === 'günstig' && item.priceLevel === 'gratis')) return false;
        // Budget-Obergrenze in € pro Person (null = ohne Limit; Einträge ohne Preis passieren).
        if (filter.budget != null && item.price != null && item.price > filter.budget) return false;
        // Ort: 'daheim' = nur Vorschläge, die WIRKLICH zuhause stattfinden (item.home),
        // 'unterwegs' = nur Vorschläge mit Ort.
        if (filter.placeMode === 'daheim' && !item.home) return false;
        if (filter.placeMode === 'unterwegs' && !item.place) return false;
        if (query && !`${item.title} ${item.blurb || ''} ${item.category}`.toLowerCase().includes(query)) return false;
        return true;
      })
      .map((item) => {
        const art = artVon(item);
        let score = 0;
        let passt = false;
        // Interessen-Übereinstimmung wiegt am stärksten — im Wortlaut ODER in der Art
        // („Bouldern" passt zur Boulderhalle, auch wenn das Wort nicht im Titel steht).
        // Runde 2 (angesehen am echten Bestand): Das Interesse muss am WORTANFANG stehen —
        // „See" passt zu „Seebühne" und „Seebad", aber nicht zum „Golfclub Bodensee", und
        // „Club" nicht zum „Miniatur-Golfsport-Club" (ein Bindestrich beginnt kein Wort).
        const text = `${item.title} ${item.blurb || ''}`.toLowerCase();
        for (const interest of interests) {
          const wort = String(interest).toLowerCase().trim();
          if (!wort) continue;
          const stelle = text.indexOf(wort);
          if (stelle >= 0 && (stelle === 0 || /[\s("„'/]/.test(text[stelle - 1]))) { score += 30; passt = true; }
        }
        if (interessenArten.has(art)) { score += 25; passt = true; }
        // Was die Runde schon hat, macht einen Vorschlag leicht (Grill → Grillen).
        if (ressourcenArten.has(art)) { score += 12; passt = true; }
        const gelernt = lernWert(lernen, art);
        score += gelernt;
        if (gelernt >= 10) passt = true;
        if (gelernt <= -12) passt = false;
        // Nähe: näher = besser (ortlose Ideen neutral).
        if (item.distanceKm != null) score += Math.max(0, 20 - item.distanceKm);
        // Tageszeit: Abends ruhige/essen/ausgehen leicht bevorzugen, tagsüber Sport/draußen.
        const eveningCategories = ['essen', 'ausgehen', 'chillen'];
        if (hourNow >= 17 && eveningCategories.includes(item.category)) score += 8;
        if (hourNow < 17 && item.category === 'sport') score += 8;
        // Runde 4 (G6, Jonathan: Wetter gehoert in die Empfehlungen): Regnet es heute wahrscheinlich
        // (ab 60 %), ruecken Orte unter freiem Himmel nach hinten und Orte drinnen nach vorn.
        // Unbekannt (null) bleibt neutral. Kein Ausblenden: Wer trotzdem wandern will, findet es.
        const heute = Array.isArray(wetter) ? wetter[0] : null;
        const nass = Boolean(heute && typeof heute.regen === 'number' && heute.regen >= 60);
        if (nass && item.draussen === true) score -= 15;
        if (nass && item.draussen === false) score += 8;
        const woechentlich = item.wiederholung === 'woechentlich';
        const besonders = !woechentlich && (item.besonders === true || (item.selten === true && passt));
        const stufe = besonders ? 'besonders' : passt ? 'passend' : 'immer';
        const wetterHinweis = Array.isArray(wetter) && wetter[0] && wetter[0].regen >= 60 && item.draussen === true ? 'regen' : null;
        return { item: { ...item, art, stufe, wetterHinweis }, score, tie: item.id };
      })
      .sort((a, b) => (b.score - a.score) || (a.tie < b.tie ? -1 : 1));

    // Runde 2 (angesehen am echten Bestand: Hörbranz lieferte 29 × Wandern, Berlin 34
    // Fitnessstudios): Jede weitere Karte DERSELBEN Art zählt weniger. So stehen oben
    // verschiedene Dinge, und die zehnte Anhöhe rutscht ans Ende statt nach vorn.
    const jeArt = new Map();
    for (const eintrag of bewertet) {
      const schon = jeArt.get(eintrag.item.art) || 0;
      jeArt.set(eintrag.item.art, schon + 1);
      eintrag.score -= schon * 12;
    }
    bewertet.sort((a, b) => (b.score - a.score) || (a.tie < b.tie ? -1 : 1));

    // Höchstens drei besondere — und nie zwei derselben Art.
    let besondere = 0;
    const besondereArten = new Set();
    for (const eintrag of bewertet) {
      if (eintrag.item.stufe !== 'besonders') continue;
      if (besondere >= BESONDERS_MAX || besondereArten.has(eintrag.item.art)) { eintrag.item.stufe = 'passend'; continue; }
      besondere += 1;
      besondereArten.add(eintrag.item.art);
    }
    const sortiert = bewertet
      .sort((a, b) => (STUFEN_RANG[a.item.stufe] - STUFEN_RANG[b.item.stufe]) || (b.score - a.score) || (a.tie < b.tie ? -1 : 1))
      .map((eintrag) => eintrag.item);
    // Ohne Suche eine Liste, die man lesen kann: je Stufe begrenzt. Wer etwas Bestimmtes will,
    // sucht — dann kommt alles, was passt.
    if (query) return sortiert;
    const grenze = { besonders: BESONDERS_MAX, passend: 15, immer: 15 };
    const gezaehlt = { besonders: 0, passend: 0, immer: 0 };
    return sortiert.filter((item) => {
      gezaehlt[item.stufe] += 1;
      return gezaehlt[item.stufe] <= grenze[item.stufe];
    });
  }

  summarizeChat(messages) {
    const points = [];
    for (const message of messages) {
      const text = (message.text || '').trim();
      if (!text) continue;
      // Zeitangaben ("um 19:10", "ab 19 Uhr") → Ankunft/Zeit-Hinweis.
      const timeMatch = text.match(/\b(?:um|ab)\s?(\d{1,2}(?::\d{2})?)(?:\s?Uhr)?\b/i);
      if (timeMatch) {
        points.push({ label: `${message.authorName}: ${timeMatch[0]}`, detail: text });
        continue;
      }
      // Mitbring-/Besorgungs-Hinweise in freiem Text.
      if (/\b(nehm|bringe?|mitbring|besorg)\w*\b/i.test(text)) {
        points.push({ label: t('{name} bringt etwas mit', { name: message.authorName }), detail: text });
        continue;
      }
      // Wetter-/Zustands-Infos.
      if (/\b(grad|wetter|regen|sonne|voll|leer)\b/i.test(text)) {
        points.push({ label: t('Info zur Lage'), detail: `${message.authorName}: ${text}` });
      }
    }
    return points.slice(0, 4);
  }
}
