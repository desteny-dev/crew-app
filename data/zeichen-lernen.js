// Runde 3 (B2, Jonathan: „Klimmzüge" soll das Gym-Zeichen bekommen — ohne Synonymlisten):
// Findet die App für ein Interesse oder eine Ressource kein Zeichen (Stichworte, Wortschatz),
// fragt sie die Funktion `zeichen`. Die schlägt die Oberbegriffe in Wikidata nach. Gelerntes
// bleibt auf dem Gerät (localStorage) und gilt sofort überall, wo Zeichen aus Text entstehen.

import { iconKeyForText, lerneZeichen } from '../ui/activity-icons.js';

const SPEICHER = 'crew-zeichen-gelernt-v1';
let geladen = false;
const gefragt = new Set();

function ladeGelerntes() {
  if (geladen) return;
  geladen = true;
  try {
    lerneZeichen(JSON.parse(globalThis.localStorage?.getItem(SPEICHER) || '{}'));
  } catch { /* privater Modus */ }
}

function merke(neu) {
  lerneZeichen(neu);
  try {
    const alt = JSON.parse(globalThis.localStorage?.getItem(SPEICHER) || '{}');
    globalThis.localStorage?.setItem(SPEICHER, JSON.stringify({ ...alt, ...neu }));
  } catch { /* privater Modus */ }
}

// Namen aus Interessen (Texte) und Ressourcen ({ name } oder Text).
export function namenAusEinstellungen(settings = {}) {
  const namen = [...(settings.interests || [])];
  for (const r of settings.resources || []) namen.push(typeof r === 'string' ? r : r?.name);
  return namen.map((n) => String(n || '').trim()).filter(Boolean);
}

//   anfragen({ worte, sprache }) → Promise<{ data: { zeichen: { wort: key|null } }, error }>
//   geaendert()                  → neu zeichnen, wenn etwas gelernt wurde
// Jedes Wort wird je Sitzung höchstens einmal gefragt — auch wenn der Server gerade nicht antwortet.
export function zeichenNachlernen(namen, anfragen, sprache, geaendert) {
  ladeGelerntes();
  const offen = [...new Set(namen)]
    .filter((name) => name.length >= 2 && !iconKeyForText(name) && !gefragt.has(name.toLowerCase()))
    .slice(0, 12);
  if (!offen.length) return;
  for (const name of offen) gefragt.add(name.toLowerCase());
  Promise.resolve()
    .then(() => anfragen({ worte: offen, sprache }))
    .then(({ data, error } = {}) => {
      if (error || !data?.zeichen) return;
      const neu = Object.fromEntries(Object.entries(data.zeichen).filter(([, key]) => key));
      if (!Object.keys(neu).length) return;
      merke(neu);
      geaendert();
    })
    .catch(() => {});
}

ladeGelerntes();
