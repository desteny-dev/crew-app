// Profilbild-Baukasten — die Oberfläche (Runde 3, Runde 4). EIN Baukasten für „Wie heißt du?",
// das Profil UND Gruppenbilder (Jonathan, A7 / B3: „gleich einstellbar wie die Profilbilder").
//
// Aufbau des Sheets:
//   oben    EINE große Vorschau (Runde 4, B2: „nur einmal in groß reicht") — sie zeigt IMMER
//           genau das, was „Übernehmen" speichert, auch während man das Foto zurechtrückt
//   Reiter  Hintergrund · Motiv · Foto
//           Hintergrund: Farbe, optional Farbverlauf (zweite Farbe + Richtung), Muster
//           Motiv:       erst die Kategorie, dann das Motiv; bei Tieren der Ausdruck (Runde 5:
//                        nur Ausdrücke, die zum Tier passen — ein Vogel lächelt nicht).
//                        Runde 5 (B1): Kategorie „Emoji" — gängige Emojis auf dem Hintergrund,
//                        statt eines Motivs (nie beides)
//           Foto:        „Foto wählen" / „Kamera", danach die Bühne zum Verschieben und Zoomen
//                        (Runde 4, B1), Zoomregler, Entfernen
//
// Der Zustand (pb) lebt beim Aufrufer: { z, foto, zuschnitt, quelle, tab, kat, art }.
//   z          Gestaltung (siehe web/ui/profilbild.js)
//   foto       das zugeschnittene Foto (JPEG ZUSCHNITT_KANTE², Runde 5: 768 × 768) oder null
//   zuschnitt  Stand des Zuschnitts (web/ui/foto-zuschnitt.js) oder null
//   quelle     'gestaltet' | 'foto' — was gerade gilt. Ein Reiterwechsel allein ändert daran
//              nichts; erst eine Wahl im Reiter. So springt die Vorschau nie beim bloßen Umsehen.
//   art        'person' | 'gruppe' — nur Texte und die Kamera (vorn/hinten) unterscheiden sich
//
// Schnittstelle für andere Bildschirme (Gruppenbild in room.js): scratch/.r4-api-profil.md §2.

import { esc } from '../core/html.js';
import { t } from '../core/sprache.js';
import { avatarFlaeche, sheet } from './components.js';
import { backArrow, cameraIcon, trash, groupIcon } from './icons.js';
import {
  PB_FARBEN, PB_RICHTUNGEN, PB_MUSTER, PB_KATEGORIEN, PB_MOTIVE, ausdrueckeFuer,
  leererZustand, istMotiv, profilbildAusToken, profilbildAdresse, profilbildErgebnis, farbSchluessel, farbWert,
} from './profilbild.js';
import { PB_EMOJIS } from './profilbild-emoji.js';
import {
  bildLaden, fotoQuelleAusDatei, zuschnittStart, zuschnittRendern, zuschnittBildStil, zuschnittBinden,
  reglerWert, REGLER_MAX,
} from './foto-zuschnitt.js';
import { haptik } from './haptik.js';

const FONT = "'Instrument Sans',sans-serif";
const BRICOLAGE = "'Bricolage Grotesque',sans-serif";
const RING_GRUEN = 'box-shadow:0 0 0 2px var(--surface),0 0 0 4px var(--green)';

const VORSCHAU = 112;     // die eine große Vorschau
const BUEHNE_H = 240;     // Bühne zum Zurechtrücken
const KREIS = 216;        // der Kreis darin

// Farbverlauf einschalten: eine zweite Farbe, die zur ersten passt — nie dieselbe.
const PARTNER = {
  mohn: 'kuerbis', kuerbis: 'mohn', ocker: 'kuerbis', tanne: 'petrol', petrol: 'see', see: 'nacht',
  lavendel: 'beere', beere: 'lavendel', karamell: 'nuss', salbei: 'tanne', taube: 'see', flieder: 'lavendel',
  rose: 'beere', nuss: 'karamell', nacht: 'see', graphit: 'nacht',
};

// Zustand aus dem Gespeicherten. photo: Wort, Foto-Adresse oder null.
// art: 'person' (Standard) oder 'gruppe'.
export function pbStart({ photo, color, initials, art = 'person' }) {
  const gestaltet = istMotiv(photo);
  const z = gestaltet ? profilbildAusToken(photo) : { ...leererZustand(), g: farbSchluessel(color) || 'karamell' };
  z.i = initials || '';
  const foto = photo && !gestaltet ? photo : null;
  return {
    z,
    foto,
    // Ein gespeichertes Foto ist schon zugeschnitten; man kann es weiter hineinzoomen.
    // Seine Maße kommen beim Binden dazu (pbFotoBinden).
    zuschnitt: foto ? zuschnittStart({ src: foto }) : null,
    quelle: foto ? 'foto' : 'gestaltet',
    tab: foto ? 'foto' : (z.m || z.e ? 'motiv' : 'grund'),
    kat: z.m ? (PB_MOTIVE[z.m]?.kategorie || null) : (z.e ? 'emoji' : null),
    art: art === 'gruppe' ? 'gruppe' : 'person',
  };
}

// Was „Übernehmen" speichert: { photo, color }.
export function pbErgebnis(pb) {
  if (pb.quelle === 'foto' && pb.foto) return { photo: pb.foto, color: farbWert(pb.z.g) };
  return profilbildErgebnis(pb.z);
}

const personZeichen = (size) => `<svg width="${Math.round(size * 0.44)}" height="${Math.round(size * 0.44)}" viewBox="0 0 24 24" fill="none" aria-hidden="true" style="position:absolute;left:50%;top:50%;transform:translate(-50%,-52%);pointer-events:none"><circle cx="12" cy="8.6" r="3.9" stroke="var(--on-accent)" stroke-width="1.9"></circle><path d="M4.6 20.2a7.4 7.4 0 0 1 14.8 0" stroke="var(--on-accent)" stroke-width="1.9" stroke-linecap="round"></path></svg>`;

// Die Scheibe, wie sie überall erscheinen wird. Ohne Namen (noch keine Initialen) und ohne
// Motiv/Foto steht ein ruhiges Personenzeichen auf der Farbe — nie eine leere Fläche.
// Der Aufrufer gibt den runden Rahmen (position:relative; overflow:hidden).
// Runde 5 (Hinweis P2): Eine Gruppe ohne Bild erscheint überall als gruppenKreis (web/screens/room.js) —
// Verlauf 150° von der Farbe zu 18 % dunkler, Initialen in Bricolage, ohne Namen das Gruppenzeichen.
// Die Vorschau zeigt genau das; vorher lag hier die flache Personenscheibe und die Farbe wirkte im
// Baukasten anders als danach in der Gruppe. Dieselbe Rechnung wie shade() in room.js.
function dunkler(hex, faktor) {
  if (!/^#[0-9a-f]{6}$/i.test(hex)) return hex;
  const n = Number.parseInt(hex.slice(1), 16);
  const kanal = (wert) => Math.max(0, Math.min(255, Math.round(wert * (1 + faktor))));
  return `#${((kanal((n >> 16) & 255) << 16) | (kanal((n >> 8) & 255) << 8) | kanal(n & 255)).toString(16).padStart(6, '0')}`;
}

export function pbAvatar(pb, size, fontSize = Math.round(size * 0.34)) {
  const erg = pbErgebnis(pb);
  if (pb.art === 'gruppe' && !erg.photo) {
    const inhalt = pb.z.i ? esc(pb.z.i) : groupIcon('var(--on-accent)', Math.round(size * 0.42));
    return `<span data-role="pb-gruppenkreis" style="width:100%;height:100%;border-radius:50%;display:flex;align-items:center;justify-content:center;box-sizing:border-box;background:linear-gradient(150deg,${erg.color},${dunkler(erg.color, -0.18)});color:var(--on-accent);font:650 ${fontSize}px 'Bricolage Grotesque',sans-serif">${inhalt}</span>`;
  }
  const flaeche = avatarFlaeche({ photo: erg.photo, color: erg.color, initials: pb.z.i }, size, fontSize);
  const leer = !pb.z.i && !pb.z.m && !pb.z.e && !(pb.quelle === 'foto' && pb.foto);
  return `${flaeche}${leer ? personZeichen(size) : ''}`;
}

const rund = (size, inhalt, extra = '', attrs = '') => `<span ${attrs} style="position:relative;display:block;width:${size}px;height:${size}px;border-radius:50%;overflow:hidden;flex:none;${extra}">${inhalt}</span>`;

function abschnitt(text, rechts = '') {
  return `<div style="display:flex;align-items:center;gap:8px;padding:16px 2px 9px"><span style="flex:1;font-size:11px;font-weight:650;letter-spacing:.09em;text-transform:uppercase;color:var(--muted-light)">${esc(text)}</span>${rechts}</div>`;
}

function schalter(an, act) {
  return `<button data-act="${act}" role="switch" aria-checked="${an}" aria-label="${esc(t('Farbverlauf'))}" style="width:44px;height:26px;border-radius:13px;background:${an ? 'var(--green)' : 'var(--handle)'};position:relative;flex:none;border:0;padding:0;cursor:pointer;appearance:none;transition:background .16s ease-out"><span style="position:absolute;left:3px;top:3px;width:20px;height:20px;border-radius:50%;background:var(--surface);box-shadow:0 1px 3px var(--shadow-20);pointer-events:none;transform:translateX(${an ? 18 : 0}px);transition:transform .16s ease-out"></span></button>`;
}

function farbRaster(act, gewaehlt) {
  return `<div style="display:grid;grid-template-columns:repeat(8,1fr);gap:10px 9px;padding:0 4px">${PB_FARBEN.map((f) => {
    const an = f.key === gewaehlt;
    // Feine Innenkontur: Nacht und Graphit verschwinden sonst im Dunkelmodus auf dem Sheet.
    return `<button data-act="${act}" data-farbe="${f.key}" aria-label="${esc(f.name)}" aria-pressed="${an}" style="width:100%;aspect-ratio:1;border-radius:50%;background:${f.wert};border:0;padding:0;cursor:pointer;appearance:none;box-shadow:${an ? '0 0 0 2px var(--surface),0 0 0 4px var(--ink)' : 'inset 0 0 0 1px var(--ink-a12)'}"></button>`;
  }).join('')}</div>`;
}

const PFEILE = {
  u: '<path d="M12 5.5v13M7 13.5l5 5 5-5"/>',
  r: '<path d="M5.5 12h13M13.5 7l5 5-5 5"/>',
  ru: '<path d="M7 7l10 10M17 9.8V17H9.8"/>',
  lu: '<path d="M17 7 7 17M7 9.8V17h7.2"/>',
  k: '<circle cx="12" cy="12" r="2.2"/><circle cx="12" cy="12" r="6.6"/>',
};
const WINKEL = { u: '180deg', r: '90deg', ru: '135deg', lu: '225deg' };

function richtungen(z) {
  const eins = farbWert(z.g);
  const zwei = farbWert(z.v);
  return `<div style="display:flex;justify-content:space-between;padding:0 4px">${PB_RICHTUNGEN.map((r) => {
    const an = z.r === r.key;
    const verlauf = r.key === 'k' ? `radial-gradient(circle,${eins} 10%,${zwei} 78%)` : `linear-gradient(${WINKEL[r.key]},${eins},${zwei})`;
    return `<button data-act="pb-richtung" data-richtung="${r.key}" aria-label="${esc(r.name)}" aria-pressed="${an}" style="width:46px;height:46px;border-radius:50%;border:0;padding:0;background:${verlauf};display:flex;align-items:center;justify-content:center;cursor:pointer;appearance:none;flex:none;${an ? RING_GRUEN : ''}"><svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="var(--on-accent)" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round" style="pointer-events:none">${PFEILE[r.key]}</svg></button>`;
  }).join('')}</div>`;
}

function kachel({ act, daten = {}, bild, name, an, size = 62 }) {
  const attrs = Object.entries(daten).map(([k, v]) => `data-${k}="${esc(v)}"`).join(' ');
  return `<button data-act="${act}" ${attrs} aria-pressed="${an}" aria-label="${esc(name)}" style="display:flex;flex-direction:column;align-items:center;gap:6px;border:0;background:transparent;padding:2px 0;cursor:pointer;appearance:none;font-family:${FONT};min-width:0">
${rund(size, bild, `pointer-events:none;${an ? RING_GRUEN : ''}`)}
<span style="font-size:11px;line-height:1.2;font-weight:${an ? 650 : 600};color:${an ? 'var(--ink)' : 'var(--ink-soft)'};pointer-events:none;max-width:100%;overflow:hidden;text-overflow:ellipsis;white-space:nowrap">${esc(name)}</span></button>`;
}

const bildTag = (src) => `<img src="${esc(src)}" alt="" style="width:100%;height:100%;display:block;pointer-events:none">`;

function grundReiter(pb) {
  const { z } = pb;
  const verlauf = Boolean(z.v);
  const muster = `<div style="display:grid;grid-template-columns:repeat(4,1fr);gap:12px 6px">${PB_MUSTER.map((p) => kachel({
    act: 'pb-muster', daten: { muster: p.key }, name: p.name, an: z.p === p.key, size: 54,
    bild: bildTag(profilbildAdresse({ ...z, m: '', e: '', i: '', p: p.key })),
  })).join('')}</div>`;
  return `${abschnitt(t('Farbe'))}${farbRaster('pb-farbe', z.g)}
<div style="display:flex;align-items:center;gap:12px;margin-top:16px;padding:12px 14px;border-radius:16px;background:var(--paper)">
<span style="display:flex;flex-direction:column;gap:2px;flex:1;min-width:0"><span style="font-size:14px;font-weight:650;color:var(--ink)">${t('Farbverlauf')}</span><span style="font-size:11.5px;color:var(--muted)">${t('Zwei Farben, die ineinander übergehen')}</span></span>
${schalter(verlauf, 'pb-verlauf')}</div>
${verlauf ? `${abschnitt(t('Zweite Farbe'))}${farbRaster('pb-farbe2', z.v)}${abschnitt(t('Richtung'))}${richtungen(z)}` : ''}
${abschnitt(t('Muster'))}${muster}`;
}

// Kopf einer geöffneten Kategorie: Zurück zu allen Kategorien · Name · Anzahl.
function katKopf(name, anzahl) {
  return `<div style="display:flex;align-items:center;gap:10px;padding:14px 0 10px">
<button data-act="pb-kat-zurueck" data-treffer aria-label="${esc(t('Alle Kategorien'))}" style="width:32px;height:32px;border-radius:50%;background:var(--paper);border:1px solid var(--ink-a08);display:flex;align-items:center;justify-content:center;flex:none;cursor:pointer;appearance:none;padding:0"><span style="pointer-events:none;display:flex">${backArrow('var(--ink)', 15)}</span></button>
<span style="font:650 15px ${FONT};color:var(--ink);flex:1;min-width:0">${esc(name)}</span>
<span style="font-size:12px;color:var(--muted);font-variant-numeric:tabular-nums">${anzahl}</span></div>`;
}

// Runde 5 (B1): Emojis — eine ruhige Fläche aus Scheiben, jede zeigt das Emoji auf DEM Hintergrund,
// der gerade gilt. Kein Name unter der Scheibe: ein Emoji erklärt sich selbst (der Name steht im
// aria-label). Fünf je Reihe, jede Scheibe trifft auf mehr als 44 × 44 px.
function emojiReiter(pb) {
  const { z } = pb;
  const scheiben = PB_EMOJIS.map((em) => {
    const an = z.e === em.key;
    return `<button data-act="pb-emoji" data-emoji="${em.key}" aria-pressed="${an}" aria-label="${esc(em.name)}" style="display:flex;justify-content:center;align-items:center;border:0;background:transparent;padding:4px 0;min-height:58px;cursor:pointer;appearance:none;min-width:0">${rund(52, bildTag(profilbildAdresse({ ...z, i: '', m: '', e: em.key })), `pointer-events:none;${an ? RING_GRUEN : ''}`)}</button>`;
  }).join('');
  return `${katKopf(t('Emoji'), PB_EMOJIS.length)}
<div data-role="pb-emojis" style="display:grid;grid-template-columns:repeat(5,1fr);gap:8px 4px">${scheiben}</div>`;
}

function motivReiter(pb) {
  const { z } = pb;
  if (pb.kat === 'emoji') return emojiReiter(pb);
  const kat = PB_KATEGORIEN.find((k) => k.key === pb.kat);
  if (!kat) {
    // Dieselbe Scheibe wie die große Vorschau — bei Gruppen also der Gruppenkreis.
    const kacheln = [kachel({
      act: 'pb-ohne-motiv', name: t('Initialen'), an: !z.m && !z.e,
      bild: pbAvatar({ ...pb, quelle: 'gestaltet', z: { ...z, m: '', e: '' } }, 62, 21),
    })];
    // Runde 5 (B1): Emoji gleich neben den Initialen — der einfachste Weg zu einem Bild.
    kacheln.push(kachel({
      act: 'pb-kat', daten: { kat: 'emoji' }, name: t('Emoji'), an: Boolean(z.e),
      bild: bildTag(profilbildAdresse({ ...z, i: '', m: '', e: z.e || PB_EMOJIS[0].key })),
    }));
    for (const k of PB_KATEGORIEN) {
      const schluessel = Object.keys(k.motive);
      if (!schluessel.length) continue;
      const hier = z.m && PB_MOTIVE[z.m]?.kategorie === k.key;
      kacheln.push(kachel({
        act: 'pb-kat', daten: { kat: k.key }, name: k.name, an: Boolean(hier),
        bild: bildTag(profilbildAdresse({ ...z, i: '', e: '', m: hier ? z.m : schluessel[0] })),
      }));
    }
    return `${abschnitt(t('Kategorie'))}<div style="display:grid;grid-template-columns:repeat(4,1fr);gap:14px 6px">${kacheln.join('')}</div>`;
  }
  const schluessel = Object.keys(kat.motive);
  // Runde 5 (B2): Die Beschriftung richtet sich nach dem gewählten Tier (ein Vogel lächelt nicht,
  // er schaut „Fröhlich"). Jede Scheibe darunter zeichnet ihr Tier ohnehin passend.
  const ausdruck = kat.ausdruck
    ? `<div role="group" aria-label="${esc(t('Ausdruck'))}" style="display:flex;background:var(--field);border-radius:12px;padding:3px;margin:4px 0 12px">${ausdrueckeFuer(z.m).map((a) => {
      const an = (z.a || '') === a.key;
      return `<button data-act="pb-ausdruck" data-ausdruck="${a.key}" aria-pressed="${an}" style="flex:1;border:0;border-radius:9px;padding:8px 0;font:${an ? 650 : 600} 12.5px/1 ${FONT};color:${an ? 'var(--ink)' : 'var(--muted)'};background:${an ? 'var(--surface)' : 'transparent'};box-shadow:${an ? '0 1px 3px var(--shadow-08)' : 'none'};cursor:pointer;appearance:none"><span style="pointer-events:none">${esc(a.name)}</span></button>`;
    }).join('')}</div>`
    : '';
  return `${katKopf(kat.name, schluessel.length)}
${ausdruck ? `<span style="display:block;font-size:11px;font-weight:650;letter-spacing:.09em;text-transform:uppercase;color:var(--muted-light);padding:0 2px 6px">${t('Ausdruck')}</span>${ausdruck}` : ''}
<div style="display:grid;grid-template-columns:repeat(4,1fr);gap:14px 6px">${schluessel.map((m) => kachel({
    act: 'motiv-wahl', daten: { motiv: m }, name: kat.motive[m].name, an: z.m === m,
    bild: bildTag(profilbildAdresse({ ...z, i: '', m })),
  })).join('')}</div>`;
}

const svgBild = (farbe, size = 18) => `<svg width="${size}" height="${size}" viewBox="0 0 24 24" fill="none" style="pointer-events:none;flex:none"><rect x="3.4" y="4.4" width="17.2" height="15.2" rx="3.2" stroke="${farbe}" stroke-width="1.8"></rect><circle cx="9" cy="10" r="1.8" stroke="${farbe}" stroke-width="1.7"></circle><path d="m4.4 17.6 5-4.6 3.4 3 2.8-2.4 4.2 3.8" stroke="${farbe}" stroke-width="1.8" stroke-linejoin="round" stroke-linecap="round"></path></svg>`;
const svgLupe = (plus) => `<svg width="20" height="20" viewBox="0 0 24 24" fill="none" style="pointer-events:none"><circle cx="10.6" cy="10.6" r="6.4" stroke="currentColor" stroke-width="1.8"></circle><path d="m15.4 15.4 4.4 4.4M7.8 10.6h5.6${plus ? 'M10.6 7.8v5.6' : ''}" stroke="currentColor" stroke-width="1.8" stroke-linecap="round"></path></svg>`;

const VERSTECKT = 'position:absolute;width:1px;height:1px;opacity:0;pointer-events:none;left:-9999px';

// Die Bühne: der Kreis zeigt, was gespeichert wird; ringsum liegt das übrige Foto blass, damit
// man sieht, wohin man schieben kann. Beide Bilder folgen derselben Rechnung.
function zuschnittBuehne(pb) {
  if (pb.fotoLaedt) {
    return `<div data-role="zuschnitt-laedt" style="height:${BUEHNE_H}px;border-radius:22px;background:var(--field);display:flex;align-items:center;justify-content:center"><span style="font-size:13px;color:var(--muted)">${t('Foto wird vorbereitet …')}</span></div>`;
  }
  const zs = pb.zuschnitt || { src: pb.foto, w: 0, h: 0 };
  const bild = `<img data-zs-bild data-zs-kante="${KREIS}" src="${esc(zs.src)}" alt="" draggable="false" style="${zuschnittBildStil(zs, KREIS)}">`;
  const lage = `position:absolute;left:50%;top:50%;width:${KREIS}px;height:${KREIS}px;margin:-${KREIS / 2}px 0 0 -${KREIS / 2}px`;
  return `<div data-role="zuschnitt" data-hdrag="zuschnitt" data-bereit="${zs.w ? 'ja' : 'nein'}" aria-label="${esc(t('Ausschnitt verschieben und zoomen'))}" style="position:relative;height:${BUEHNE_H}px;border-radius:22px;overflow:hidden;background:var(--field);touch-action:none;cursor:${zs.w ? 'grab' : 'default'};user-select:none;-webkit-user-select:none;-webkit-touch-callout:none">
<div aria-hidden="true" style="${lage};opacity:.3;pointer-events:none">${bild}</div>
<div data-role="zuschnitt-kreis" style="${lage};border-radius:50%;overflow:hidden;pointer-events:none;background:var(--field);box-shadow:0 0 0 2px var(--surface),0 6px 20px var(--shadow-22)">${bild}</div>
</div>`;
}

function zoomZeile(zs) {
  const knopf = (richtung, label) => `<button type="button" data-zs-schritt="${richtung}" aria-label="${esc(label)}" style="width:44px;height:44px;border:0;background:transparent;display:flex;align-items:center;justify-content:center;cursor:pointer;appearance:none;padding:0;flex:none;color:var(--ink-soft)">${svgLupe(richtung > 0)}</button>`;
  return `<div style="display:flex;align-items:center;gap:2px;margin:-6px -8px 0">
${knopf(-1, t('Verkleinern'))}
<input type="range" data-role="zuschnitt-zoom" data-hdrag="slider" min="0" max="${REGLER_MAX}" step="1" value="${reglerWert(zs)}" aria-label="${esc(t('Zoom'))}" style="flex:1;min-width:0;height:44px;margin:0;accent-color:var(--green);cursor:pointer">
${knopf(1, t('Vergrößern'))}
</div>`;
}

function fotoReiter(pb, kamera) {
  const blick = pb.art === 'gruppe' ? 'environment' : 'user';
  const felder = `<input id="foto-input" type="file" accept="image/*" aria-hidden="true" tabindex="-1" style="${VERSTECKT}"><input id="foto-kamera" type="file" accept="image/*" capture="${blick}" aria-hidden="true" tabindex="-1" style="${VERSTECKT}">`;
  const knopf = (act, icon, text, haupt) => `<button data-act="${act}" style="flex:1;display:flex;align-items:center;justify-content:center;gap:8px;height:48px;border-radius:999px;border:1.5px solid ${haupt ? 'var(--green-a50)' : 'var(--ink-a14)'};background:${haupt ? 'var(--green-tint)' : 'var(--surface)'};font:650 14px ${FONT};color:${haupt ? 'var(--green-dark)' : 'var(--ink)'};cursor:pointer;appearance:none;box-sizing:border-box;min-width:0"><span style="pointer-events:none;display:flex">${icon}</span><span style="pointer-events:none;white-space:nowrap">${esc(text)}</span></button>`;
  const knoepfe = `<div style="display:flex;gap:8px;width:100%">${knopf('foto-pick', svgBild('var(--green-dark)'), pb.foto ? t('Anderes Foto') : t('Foto wählen'), true)}${kamera ? knopf('foto-kamera', cameraIcon('var(--ink)', 18), t('Kamera'), false) : ''}</div>`;
  if (pb.foto || pb.fotoLaedt) {
    const aktiv = pb.quelle === 'foto';
    const bereit = Boolean(pb.zuschnitt?.w) && !pb.fotoLaedt;
    const hinweis = kamera ? t('Ziehen zum Verschieben · mit zwei Fingern zoomen') : t('Ziehen zum Verschieben · Mausrad oder Regler zum Zoomen');
    return `${felder}<div style="display:flex;flex-direction:column;gap:12px;padding-top:16px">
${aktiv || pb.fotoLaedt ? '' : `<button data-act="pb-foto-nutzen" style="display:flex;align-items:center;gap:12px;padding:10px 12px;border-radius:16px;border:1.5px solid var(--green-a50);background:var(--green-tint);cursor:pointer;appearance:none;font-family:${FONT};text-align:left">${rund(40, `<img src="${esc(pb.foto)}" alt="" style="width:100%;height:100%;object-fit:cover;display:block">`, 'pointer-events:none')}<span style="flex:1;font-size:13.5px;font-weight:650;color:var(--green-dark);pointer-events:none">${t('Dieses Foto verwenden')}</span></button>`}
${zuschnittBuehne(pb)}
${bereit ? `<span data-role="zuschnitt-hinweis" style="display:block;text-align:center;font-size:11.5px;color:var(--muted);line-height:1.4;margin-top:-2px">${esc(hinweis)}</span>${zoomZeile(pb.zuschnitt)}` : ''}
${knoepfe}
${pb.fotoLaedt ? '' : `<button data-act="pb-foto-weg" style="align-self:center;display:flex;align-items:center;gap:7px;border:0;background:transparent;padding:6px 10px;min-height:44px;cursor:pointer;appearance:none;font:650 13.5px ${FONT};color:var(--danger)"><span style="pointer-events:none;display:flex">${trash('var(--danger)', 16)}</span><span style="pointer-events:none">${t('Foto entfernen')}</span></button>`}
</div>`;
  }
  return `${felder}<div style="margin-top:16px;padding:20px 16px 16px;border-radius:18px;background:var(--paper);display:flex;flex-direction:column;align-items:center;gap:12px;text-align:center">
<span style="width:48px;height:48px;border-radius:50%;background:var(--green-tint);display:flex;align-items:center;justify-content:center">${svgBild('var(--green-dark)', 22)}</span>
<span style="font-size:13px;color:var(--ink-soft);line-height:1.45;max-width:270px">${t('Ein eigenes Foto statt Farbe und Motiv. Danach rückst du es im Kreis zurecht.')}</span>
${knoepfe}</div>`;
}

// Die große Vorschau. Gilt gerade ein Foto mit Zuschnitt, zeigt sie die Quelle mit derselben
// Rechnung wie die Bühne — so folgt sie der Geste Bild für Bild, ohne neu zu zeichnen.
function vorschau(pb) {
  const zs = pb.zuschnitt;
  if (pb.quelle === 'foto' && pb.foto && zs?.w) {
    return `<img data-zs-bild data-zs-kante="${VORSCHAU}" src="${esc(zs.src)}" alt="" draggable="false" style="${zuschnittBildStil(zs, VORSCHAU)}">`;
  }
  return pbAvatar(pb, VORSCHAU, 38);
}

// Das ganze Innenleben des Sheets (ohne Titel und ohne Fußknöpfe — die gibt der Aufrufer oder pbSheet).
export function pbHtml(pb) {
  const kamera = typeof matchMedia === 'function' && matchMedia('(pointer: coarse)').matches;
  const reiter = [['grund', t('Hintergrund')], ['motiv', t('Motiv')], ['foto', t('Foto')]];
  const unterschrift = pb.art === 'gruppe' ? t('So sieht eure Gruppe aus') : t('So sieht dich deine Crew');
  const kopf = `<div data-role="pb-kopf" style="display:flex;flex-direction:column;align-items:center;gap:9px;padding:0 0 16px">
${rund(VORSCHAU, vorschau(pb), 'background:var(--field);box-shadow:0 0 0 1px var(--ink-a07),0 8px 22px var(--shadow-12)', 'data-role="pb-vorschau"')}
<span style="font-size:12px;color:var(--muted);line-height:1.35">${esc(unterschrift)}</span></div>`;
  const umschalter = `<div role="tablist" style="background:var(--field);border-radius:14px;padding:3px;display:flex">${reiter.map(([key, name]) => {
    const an = pb.tab === key;
    return `<button data-act="bild-art" data-art="${key}" role="tab" aria-selected="${an}" aria-pressed="${an}" style="flex:1;border:0;border-radius:11px;padding:10px 0;min-height:40px;font:${an ? 650 : 600} 13px/1 ${FONT};color:${an ? 'var(--ink)' : 'var(--muted)'};background:${an ? 'var(--surface)' : 'transparent'};box-shadow:${an ? '0 1px 3px var(--shadow-08)' : 'none'};cursor:pointer;appearance:none"><span style="pointer-events:none">${esc(name)}</span></button>`;
  }).join('')}</div>`;
  const fotoAktiv = pb.quelle === 'foto' && pb.foto && pb.tab !== 'foto'
    ? `<span style="display:block;font-size:11.5px;color:var(--muted);line-height:1.45;padding:10px 2px 0">${t('Gerade gilt dein Foto. Wählst du hier etwas, ersetzt es das Foto.')}</span>`
    : '';
  const inhalt = pb.tab === 'foto' ? fotoReiter(pb, kamera) : pb.tab === 'motiv' ? motivReiter(pb) : grundReiter(pb);
  // Feste Mindesthöhe: Das Sheet springt beim Wechsel zwischen den Reitern nicht auf und zu.
  return `<div data-role="pb" data-tab="${pb.tab}" data-quelle="${pb.quelle}" data-art="${pb.art || 'person'}">${kopf}${umschalter}<div style="min-height:460px">${fotoAktiv}${inhalt}</div></div>`;
}

// Fußzeile des Baukastens: klebt unten im Sheet, damit „Übernehmen" auch bei langen
// Motivlisten ohne Scrollen erreichbar bleibt.
export function pbFuss(abbrechen, uebernehmen) {
  return `<div data-role="pb-fuss" style="position:sticky;bottom:-28px;margin:18px -20px -28px;padding:12px 20px 28px;background:var(--surface);display:flex;gap:8px;box-shadow:0 -1px 0 var(--ink-a07);z-index:2">
<button data-act="${esc(abbrechen)}" style="flex:1;border:1.5px solid var(--ink-a14);background:var(--surface);color:var(--ink-soft);font:650 14px/1 ${FONT};padding:13px 0;min-height:46px;border-radius:999px;cursor:pointer;appearance:none">${t('Abbrechen')}</button>
<button data-act="${esc(uebernehmen)}" style="flex:1;background:var(--green);border:0;color:var(--on-accent);font:650 14px/1 ${FONT};padding:14px 0;min-height:46px;border-radius:999px;cursor:pointer;appearance:none">${t('Übernehmen')}</button>
</div>`;
}

// Das ganze Sheet — Titel, Baukasten, Fuß. `abbrechen` gilt auch für die Fläche daneben.
export function pbSheet(pb, { titel = '', abbrechen, uebernehmen, scrollKey = 'profilbild' } = {}) {
  return sheet(`<span style="font-family:${BRICOLAGE};font-size:19px;font-weight:650;display:block;padding-bottom:12px">${esc(titel || t('Profilbild'))}</span>
${pbHtml(pb)}
${pbFuss(abbrechen, uebernehmen)}`, { closeAct: abbrechen, scrollKey });
}

// Nach einem Reiter- oder Kategoriewechsel stehen die Reiter wieder im Blick — sonst bliebe die
// Scrollposition des vorigen, längeren Reiters stehen und der neue Inhalt begänne außer Sicht.
function reiterInSicht(element) {
  const karte = (element?.ownerDocument || document).querySelector('[data-role="pb"]')?.closest('.ui-sheet-card');
  const reiter = karte?.querySelector('[role="tablist"]');
  if (!karte || !reiter) return;
  const oben = Math.max(0, reiter.offsetTop - 12);
  if (karte.scrollTop > oben) karte.scrollTop = oben;
}

// Aktionen. holen() liefert den aktuellen Zustand — null, wenn kein Baukasten offen ist.
export function pbActs(ctx, holen) {
  const mach = (fn) => (daten, element) => {
    const pb = holen();
    if (!pb) return;
    fn(pb, daten, element);
    ctx.render();
  };
  const machOben = (fn) => (daten, element) => {
    mach(fn)(daten, element);
    reiterInSicht(element);
  };
  const gestaltet = (pb) => { pb.quelle = 'gestaltet'; };
  const feld = (element, id) => (element?.ownerDocument || document).getElementById(id);
  return {
    'bild-art': machOben((pb, d) => { pb.tab = d.art; }),
    'pb-farbe': mach((pb, d) => {
      pb.z.g = d.farbe;
      if (pb.z.v === d.farbe) pb.z.v = PARTNER[d.farbe] || 'nacht';
      gestaltet(pb);
    }),
    'pb-verlauf': mach((pb) => {
      pb.z.v = pb.z.v ? '' : (PARTNER[pb.z.g] || 'nacht');
      gestaltet(pb);
    }),
    'pb-farbe2': mach((pb, d) => { pb.z.v = d.farbe === pb.z.g ? (PARTNER[d.farbe] || 'nacht') : d.farbe; gestaltet(pb); }),
    'pb-richtung': mach((pb, d) => { pb.z.r = d.richtung; gestaltet(pb); }),
    'pb-muster': mach((pb, d) => { pb.z.p = d.muster || ''; gestaltet(pb); }),
    'pb-kat': machOben((pb, d) => { pb.kat = d.kat; }),
    'pb-kat-zurueck': machOben((pb) => { pb.kat = null; }),
    'pb-ohne-motiv': mach((pb) => { pb.z.m = ''; pb.z.e = ''; gestaltet(pb); }),
    // Runde 5 (B1): Ein Emoji ersetzt ein Motiv — und umgekehrt.
    'pb-emoji': mach((pb, d) => {
      pb.z.e = d.emoji || '';
      pb.z.m = '';
      pb.kat = 'emoji';
      gestaltet(pb);
    }),
    'motiv-wahl': mach((pb, d) => {
      pb.z.m = d.motiv;
      pb.z.e = '';
      pb.kat = PB_MOTIVE[d.motiv]?.kategorie || pb.kat;
      gestaltet(pb);
    }),
    'pb-ausdruck': mach((pb, d) => {
      pb.z.a = d.ausdruck || '';
      if (PB_MOTIVE[pb.z.m]?.kategorie === 'tiere') gestaltet(pb);
    }),
    'pb-foto-nutzen': mach((pb) => { if (pb.foto) pb.quelle = 'foto'; }),
    'pb-foto-weg': mach((pb) => { pb.foto = null; pb.zuschnitt = null; pb.quelle = 'gestaltet'; }),
    // Die Knöpfe öffnen den echten Systemdialog der versteckten Dateifelder.
    'foto-pick': (daten, element) => { feld(element, 'foto-input')?.click(); },
    'foto-kamera': (daten, element) => { feld(element, 'foto-kamera')?.click(); },
  };
}

// Dateifelder und Bühne binden — genau einmal je Knoten (der In-Place-Abgleich lässt sie stehen).
// Gespeichert wird hier nichts: das Foto kommt in den Entwurf, „Übernehmen" entscheidet.
export function pbFotoBinden(root, ctx, holen) {
  for (const id of ['foto-input', 'foto-kamera']) {
    const feld = root.querySelector(`#${id}`);
    if (!feld || feld.__pbBereit) continue;
    feld.__pbBereit = true;
    feld.addEventListener('change', async () => {
      const datei = feld.files && feld.files[0];
      if (!datei) return;
      const vorher = holen();
      if (!vorher) return;
      vorher.fotoLaedt = true;
      vorher.tab = 'foto';
      ctx.render();
      const quelle = await fotoQuelleAusDatei(datei);
      feld.value = '';
      const pb = holen();
      if (!pb) return;
      pb.fotoLaedt = false;
      const zs = quelle ? zuschnittStart(quelle) : null;
      const bild = zs ? zuschnittRendern(zs) : null;
      if (!bild) { ctx.render(); ctx.toast(t('Bild konnte nicht gelesen werden')); return; }
      pb.zuschnitt = zs;
      pb.foto = bild;
      pb.quelle = 'foto';
      pb.tab = 'foto';
      haptik('auswahl');
      ctx.render();
    });
  }

  const buehne = root.querySelector('[data-role="pb"] [data-role="zuschnitt"]');
  if (buehne) {
    zuschnittBinden(buehne, {
      holen: () => holen()?.zuschnitt || null,
      fertig: (zs) => {
        const pb = holen();
        if (!pb?.zuschnitt) return;
        const bild = zuschnittRendern(zs);
        // Nicht lesbar (fremdes Bild ohne Freigabe): Der Stand bleibt, wie er gespeichert ist.
        if (bild) {
          pb.zuschnitt = zs;
          pb.foto = bild;
          pb.quelle = 'foto';
        }
        ctx.render();
      },
    });
  }

  // Ein gespeichertes Foto: Maße nachladen, dann ist es verschiebbar und zoombar.
  const pb = holen();
  const zs = pb?.zuschnitt;
  if (zs && !zs.w && !zs.laedt && zs.src) {
    zs.laedt = true;
    bildLaden(zs.src).then((bild) => {
      const jetzt = holen();
      if (!jetzt?.zuschnitt || jetzt.zuschnitt.src !== zs.src || jetzt.zuschnitt.w) return;
      jetzt.zuschnitt = zuschnittStart({ src: zs.src, w: bild.naturalWidth, h: bild.naturalHeight });
      ctx.render();
    }).catch(() => { /* bleibt ein festes Bild */ });
  }
}
