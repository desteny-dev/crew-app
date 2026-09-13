// Runde 4 (B1) — Foto justieren: im Kreis verschieben und zoomen.
//
// Jonathan: „Beim Profilbild muss man das Bild justieren können und zoomen, dass man das im
// Bild hat, was man auch will."
//
// Zustand eines Zuschnitts (zs), in Pixeln der Quelle:
//   { src, w, h, z, cx, cy }
//   src   Bildadresse der Quelle (Blob-Adresse einer frisch gewählten Datei oder das gespeicherte Foto)
//   w/h   Größe der Quelle (0, solange sie noch nicht geladen ist)
//   z     Zoom ≥ 1 — bei 1 passt die kürzere Seite genau in den Kreis
//   cx/cy Mitte des Ausschnitts
// Der Ausschnitt ist das Quadrat um den Kreis. Er liegt IMMER ganz im Bild (zuschnittKlemmen) —
// deshalb gibt es nie einen leeren Rand.
//
// Gespeichert wird nicht der Zustand, sondern das Ergebnis: ein JPEG ZUSCHNITT_KANTE × ZUSCHNITT_KANTE
// (zuschnittRendern).
// So passt jede bestehende Anzeige (rund, object-fit:cover) ohne Änderung.

import { haptik } from './haptik.js';

// Runde 5 (B6, Hinweis P2): Die große Ansicht fremder Profilbilder zeigt einen Kreis von 326 px, auf dem
// iPhone (DPR 3) rund 980 Bildpunkte — 512 px sahen dort weich aus. Gemessen (scratch/r5-profil-fotogroesse.mjs,
// Daten-URL wie in profiles.photo_path): glatte Fotos 768 px ≈ 90 kB, 1024 px ≈ 140 kB; detailreiche
// Fotos 768 px ≈ 180–260 kB, 1024 px ≈ 290–420 kB (Qualität 0,8). 1024 liegt damit über 150 kB je Bild,
// deshalb 768 px mit Qualität 0,82 — bei glatten Motiven wie Gesichtern ≥ 40 dB, also unsichtbar.
export const ZUSCHNITT_KANTE = 768;
const ZUSCHNITT_QUALITAET = 0.82;
// Runde 5 (B6, Jonathan: „Auflösung ist etwas schlecht"): Gemessen wurde die Quelle bisher auf 2048 px
// verkleinert und ein Ausschnitt bis 128 Quellpixel erlaubt — bei einem Handyfoto (kurze Seite 1536)
// war der Ausschnitt ab Zoom 3 kleiner als die 512 gespeicherten Pixel und wurde bis 2-fach
// hochgerechnet. Jetzt: Quelle bis 3072 px (kurze Seite 2304, unter der iOS-Canvas-Grenze) und der
// Höchstzoom endet dort, wo der Ausschnitt noch 512 Quellpixel hat. Kleine Bilder dürfen weiter bis
// 3-fach zoomen — schärfer als ihre Pixel werden sie ohnehin nicht.
const QUELLE_MAX = 3072;          // große Handyfotos werden einmal verkleinert — schont Speicher
const MIN_QUELLE_PX = 128;         // kleinster Ausschnitt kleiner Bilder (höchstens 3-fach)

const ladend = new Map();          // src → Promise<HTMLImageElement>
const geladen = new Map();         // src → HTMLImageElement (fertig)

export function bildLaden(src) {
  if (geladen.has(src)) return Promise.resolve(geladen.get(src));
  if (!ladend.has(src)) {
    ladend.set(src, new Promise((fertig, fehler) => {
      const bild = new Image();
      bild.decoding = 'async';
      bild.onload = () => {
        geladen.set(src, bild);
        ladend.delete(src);
        if (geladen.size > 8) geladen.delete(geladen.keys().next().value);
        fertig(bild);
      };
      bild.onerror = () => { ladend.delete(src); fehler(new Error('Bild nicht lesbar')); };
      bild.src = src;
    }));
  }
  return ladend.get(src);
}

// Eine gewählte Datei als Quelle vorbereiten → { src, w, h } oder null.
export async function fotoQuelleAusDatei(datei) {
  if (!datei) return null;
  const roh = URL.createObjectURL(datei);
  try {
    const bild = await bildLaden(roh);
    const w = bild.naturalWidth;
    const h = bild.naturalHeight;
    if (!w || !h) throw new Error('leer');
    const faktor = Math.min(1, QUELLE_MAX / Math.max(w, h));
    if (faktor >= 1) return { src: roh, w, h };
    const cw = Math.round(w * faktor);
    const ch = Math.round(h * faktor);
    const flaeche = document.createElement('canvas');
    flaeche.width = cw;
    flaeche.height = ch;
    const g = flaeche.getContext('2d');
    g.imageSmoothingQuality = 'high';
    g.drawImage(bild, 0, 0, cw, ch);
    const blob = await new Promise((fertig) => flaeche.toBlob(fertig, 'image/jpeg', 0.92));
    if (!blob) return { src: roh, w, h };
    const klein = URL.createObjectURL(blob);
    await bildLaden(klein);
    geladen.delete(roh);
    URL.revokeObjectURL(roh);
    return { src: klein, w: cw, h: ch };
  } catch {
    geladen.delete(roh);
    URL.revokeObjectURL(roh);
    return null;
  }
}

export function zuschnittStart({ src, w = 0, h = 0 }) {
  return { src, w, h, z: 1, cx: w / 2, cy: h / 2 };
}

export function zoomMax(zs) {
  if (!zs?.w || !zs?.h) return 1;
  const kurz = Math.min(zs.w, zs.h);
  // Scharf bis der Ausschnitt ZUSCHNITT_KANTE Quellpixel hat; kleine Bilder mindestens bis 3-fach.
  return Math.max(1, Math.min(6, Math.max(Math.min(3, kurz / MIN_QUELLE_PX), kurz / ZUSCHNITT_KANTE)));
}

// Zoom in seine Grenzen, Mitte so, dass das Quadrat um den Kreis ganz im Bild liegt.
export function zuschnittKlemmen(zs) {
  if (!zs?.w || !zs?.h) return zs;
  const basis = Math.min(zs.w, zs.h);
  const z = Math.min(zoomMax(zs), Math.max(1, Number(zs.z) || 1));
  const halb = basis / z / 2;
  const cx = Math.min(zs.w - halb, Math.max(halb, Number.isFinite(zs.cx) ? zs.cx : zs.w / 2));
  const cy = Math.min(zs.h - halb, Math.max(halb, Number.isFinite(zs.cy) ? zs.cy : zs.h / 2));
  return { ...zs, z, cx, cy };
}

// Transform eines <img> in einem Kreis der Kantenlänge `kante` (CSS-Pixel). Die Breite/Höhe
// des Bildes entspricht z = 1; gezoomt wird nur über transform — flüssig, ohne Layout.
export function zuschnittTransform(zs, kante) {
  const basis = Math.min(zs.w, zs.h);
  const k = (kante / basis) * zs.z;
  const tx = kante / 2 - zs.cx * k;
  const ty = kante / 2 - zs.cy * k;
  return `translate(${tx.toFixed(2)}px,${ty.toFixed(2)}px) scale(${zs.z.toFixed(4)})`;
}

export function zuschnittBildStil(zs, kante) {
  const fest = 'position:absolute;left:0;top:0;display:block;pointer-events:none;user-select:none;-webkit-user-select:none;-webkit-user-drag:none;max-width:none';
  if (!zs?.w || !zs?.h) return `${fest};width:100%;height:100%;object-fit:cover`;
  const f = kante / Math.min(zs.w, zs.h);
  return `${fest};width:${(zs.w * f).toFixed(2)}px;height:${(zs.h * f).toFixed(2)}px;transform-origin:0 0;transform:${zuschnittTransform(zs, kante)}`;
}

// Das Ergebnis als JPEG-Adresse (ZUSCHNITT_KANTE²). null, wenn die Quelle nicht (mehr) lesbar ist —
// z. B. ein fremdes Bild ohne Freigabe; dann bleibt das bisherige Foto.
export function zuschnittRendern(zs, kante = ZUSCHNITT_KANTE) {
  const bild = geladen.get(zs?.src);
  if (!bild || !zs.w || !zs.h) return null;
  const k = zuschnittKlemmen(zs);
  const seite = Math.min(k.w, k.h) / k.z;
  try {
    const flaeche = document.createElement('canvas');
    flaeche.width = kante;
    flaeche.height = kante;
    const g = flaeche.getContext('2d');
    g.imageSmoothingQuality = 'high';
    g.drawImage(bild, k.cx - seite / 2, k.cy - seite / 2, seite, seite, 0, 0, kante, kante);
    return flaeche.toDataURL('image/jpeg', ZUSCHNITT_QUALITAET);
  } catch {
    return null;
  }
}

// Zoomregler: logarithmisch, damit sich jeder Millimeter gleich anfühlt.
export const REGLER_MAX = 1000;
export function reglerWert(zs) {
  const max = zoomMax(zs);
  return max <= 1 ? 0 : Math.round((Math.log(zs.z || 1) / Math.log(max)) * REGLER_MAX);
}
function zoomAusRegler(zs, wert) {
  const max = zoomMax(zs);
  return max <= 1 ? 1 : Math.exp((Number(wert) / REGLER_MAX) * Math.log(max));
}

// Gesten auf der Bühne ([data-role="zuschnitt"]):
//   ein Finger / Maus ziehen → verschieben · zwei Finger → zoomen um ihre Mitte
//   Mausrad / Trackpad → zoomen um den Zeiger · Regler und ± → zoomen um die Mitte
// Während der Geste wird NICHT neu gezeichnet: Jedes <img data-zs-bild data-zs-kante="…"> im
// Baukasten folgt per transform (requestAnimationFrame). Erst beim Loslassen meldet
// `fertig(zs)` den neuen Stand — der Aufrufer rendert daraus das Ergebnis.
export function zuschnittBinden(buehne, { holen, fertig }) {
  if (!buehne || buehne.__zuschnittGebunden) return;
  buehne.__zuschnittGebunden = true;

  const zeiger = new Map();
  let geste = null;
  let aktuell = null;
  let bild = 0;
  let radUhr = 0;
  let anschlag = false;

  const bereich = () => buehne.closest('[data-role="pb"]') || buehne;
  const regler = () => bereich().querySelector('[data-role="zuschnitt-zoom"]');
  const kreis = () => (buehne.querySelector('[data-role="zuschnitt-kreis"]') || buehne).getBoundingClientRect();
  const stand = () => {
    const zs = holen();
    return zs?.w ? zuschnittKlemmen(aktuell || zs) : null;
  };

  const malen = () => {
    bild = 0;
    if (!aktuell) return;
    bereich().querySelectorAll('img[data-zs-bild]').forEach((img) => {
      const kante = Number(img.dataset.zsKante) || 0;
      if (kante) img.style.transform = zuschnittTransform(aktuell, kante);
    });
    const r = regler();
    if (r && document.activeElement !== r) r.value = String(reglerWert(aktuell));
  };
  const planen = () => { if (!bild) bild = requestAnimationFrame(malen); };

  const setzen = (neu) => {
    const vorher = aktuell;
    aktuell = zuschnittKlemmen(neu);
    // Anschlag spüren: einmal je Geste, wenn der Zoom an Minimum oder Maximum stößt.
    const amRand = neu.z > zoomMax(aktuell) + 1e-3 || neu.z < 1 - 1e-3;
    if (amRand && !anschlag && vorher) { anschlag = true; haptik('grenze'); }
    if (!amRand) anschlag = false;
    planen();
  };

  const abschliessen = () => {
    if (!aktuell) return;
    const ergebnis = aktuell;
    aktuell = null;
    geste = null;
    anschlag = false;
    if (bild) { cancelAnimationFrame(bild); bild = 0; }
    fertig(ergebnis);
  };

  // Eine Geste beginnt neu, sobald ein Finger dazukommt oder geht — sonst spränge das Bild.
  const gesteNeu = () => {
    const basisStand = stand();
    if (!basisStand) { geste = null; return; }
    aktuell = basisStand;
    const punkte = [...zeiger.values()];
    const r = kreis();
    const proQuelle = (r.width / Math.min(basisStand.w, basisStand.h));
    if (punkte.length >= 2) {
      const [a, b] = punkte;
      const mx = (a.x + b.x) / 2 - (r.left + r.width / 2);
      const my = (a.y + b.y) / 2 - (r.top + r.height / 2);
      geste = {
        art: 'zwicken',
        d0: Math.hypot(a.x - b.x, a.y - b.y) || 1,
        z0: basisStand.z,
        qx: basisStand.cx + mx / (proQuelle * basisStand.z),
        qy: basisStand.cy + my / (proQuelle * basisStand.z),
      };
    } else if (punkte.length === 1) {
      geste = { art: 'ziehen', x0: punkte[0].x, y0: punkte[0].y, cx0: basisStand.cx, cy0: basisStand.cy, z: basisStand.z };
    } else {
      geste = null;
    }
  };

  const bewegen = () => {
    if (!geste || !aktuell) return;
    const r = kreis();
    const basis = Math.min(aktuell.w, aktuell.h);
    const proQuelle = r.width / basis;
    const punkte = [...zeiger.values()];
    if (geste.art === 'zwicken' && punkte.length >= 2) {
      const [a, b] = punkte;
      const d = Math.hypot(a.x - b.x, a.y - b.y) || 1;
      const z = geste.z0 * (d / geste.d0);
      const mx = (a.x + b.x) / 2 - (r.left + r.width / 2);
      const my = (a.y + b.y) / 2 - (r.top + r.height / 2);
      const zk = Math.min(zoomMax(aktuell), Math.max(1, z));
      setzen({ ...aktuell, z, cx: geste.qx - mx / (proQuelle * zk), cy: geste.qy - my / (proQuelle * zk) });
    } else if (geste.art === 'ziehen' && punkte.length === 1) {
      const p = punkte[0];
      setzen({ ...aktuell, cx: geste.cx0 - (p.x - geste.x0) / (proQuelle * geste.z), cy: geste.cy0 - (p.y - geste.y0) / (proQuelle * geste.z) });
    }
  };

  // Die Bühne gehört ganz der Geste: kein Sheet-Zug, kein Tab-Wischen (stopPropagation). Das
  // Scrollen verhindert touch-action:none an der Bühne. Bewusst KEIN preventDefault auf touchmove:
  // Gemessen blockierte das während eines Zwei-Finger-Zugs danach jeden weiteren Wisch-Zug im Tab
  // (Tippen ging noch) — touch-action:none leistet dasselbe ohne diese Nebenwirkung.
  const halten = (event) => event.stopPropagation();
  buehne.addEventListener('touchstart', halten, { passive: true });
  buehne.addEventListener('touchmove', halten, { passive: true });

  buehne.addEventListener('pointerdown', (event) => {
    if (event.pointerType === 'mouse' && event.button !== 0) return;
    if (!holen()?.w) return;
    event.stopPropagation();
    zeiger.set(event.pointerId, { x: event.clientX, y: event.clientY });
    try { buehne.setPointerCapture(event.pointerId); } catch { /* egal */ }
    buehne.style.cursor = 'grabbing';
    gesteNeu();
  });
  buehne.addEventListener('pointermove', (event) => {
    if (!zeiger.has(event.pointerId)) return;
    event.stopPropagation();
    zeiger.set(event.pointerId, { x: event.clientX, y: event.clientY });
    bewegen();
  });
  const los = (event) => {
    if (!zeiger.has(event.pointerId)) return;
    zeiger.delete(event.pointerId);
    if (zeiger.size) { gesteNeu(); return; }
    buehne.style.cursor = '';
    abschliessen();
  };
  buehne.addEventListener('pointerup', los);
  buehne.addEventListener('pointercancel', los);
  buehne.addEventListener('lostpointercapture', los);

  buehne.addEventListener('wheel', (event) => {
    const basisStand = stand();
    if (!basisStand) return;
    if (event.cancelable) event.preventDefault();
    event.stopPropagation();
    const r = kreis();
    const proQuelle = r.width / Math.min(basisStand.w, basisStand.h);
    const mx = event.clientX - (r.left + r.width / 2);
    const my = event.clientY - (r.top + r.height / 2);
    const schritt = event.deltaMode === 1 ? event.deltaY * 16 : event.deltaY;
    const z = basisStand.z * Math.exp(-schritt * 0.0022);
    const zk = Math.min(zoomMax(basisStand), Math.max(1, z));
    const qx = basisStand.cx + mx / (proQuelle * basisStand.z);
    const qy = basisStand.cy + my / (proQuelle * basisStand.z);
    aktuell = basisStand;
    setzen({ ...basisStand, z, cx: qx - mx / (proQuelle * zk), cy: qy - my / (proQuelle * zk) });
    clearTimeout(radUhr);
    radUhr = setTimeout(abschliessen, 220);
  }, { passive: false });

  // Regler und ±: gebunden am Baukasten, weil sie unter der Bühne stehen.
  const zone = bereich();
  if (!zone.__zuschnittRegler) {
    zone.__zuschnittRegler = true;
    zone.addEventListener('input', (event) => {
      if (!event.target.matches?.('[data-role="zuschnitt-zoom"]')) return;
      const basisStand = stand();
      if (!basisStand) return;
      aktuell = basisStand;
      setzen({ ...basisStand, z: zoomAusRegler(basisStand, event.target.value) });
    });
    zone.addEventListener('change', (event) => {
      if (event.target.matches?.('[data-role="zuschnitt-zoom"]')) abschliessen();
    });
    zone.addEventListener('click', (event) => {
      const knopf = event.target.closest?.('[data-zs-schritt]');
      if (!knopf || !zone.contains(knopf)) return;
      event.preventDefault();
      const basisStand = stand();
      if (!basisStand) return;
      const faktor = Number(knopf.dataset.zsSchritt) > 0 ? 1.25 : 0.8;
      aktuell = basisStand;
      setzen({ ...basisStand, z: basisStand.z * faktor });
      haptik('tipp');
      abschliessen();
    });
  }
}
