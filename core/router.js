// Stack-basierter Router. Eine Route = { id, params }.
// Tabs (crew/meet/find/karte/profil) setzen den Stack auf ihre Wurzel zurück.

// Runde 7 (Bahn): Die Zuordnung Tab <-> Route stand ZWEIMAL im Code — einmal hier und
// einmal in app.js (TAB_ORDER/TAB_ROOTS/TAB_ROUTE/tabUi). Zwei Wahrheiten über dasselbe
// Ding laufen irgendwann auseinander: Vergisst man beim vierten Tab eine der beiden, leuchtet
// auf der Karte der Crew-Tab und „zurück" landet in der falschen Wurzel. Jetzt steht sie hier
// an EINER Stelle; app.js liest sie.
//
// Die Reihenfolge ist zugleich die Reihenfolge in der Fußleiste und die Richtung der
// Wischgeste. Crew steht zuerst, weil dort die Frage „kann ich jetzt etwas machen" beantwortet
// wird — die App startet dort (createRouter unten).
// Runde 8 (R8-66, Jonathan: „Der fünfte Bereich wird JETZT gebaut (Mitte)"): Find steht in der
// Mitte — zwischen dem, was man mit Freunden schon vorhat (Meet), und dem, wo sie gerade sind
// (Karte). Die Seiten liefert screens/find.js (Route 'find.home').
export const TAB_ORDER = ['crew', 'meet', 'find', 'karte', 'profil'];

// Tab -> Wurzelroute.
export const TAB_ROUTE = {
  crew: 'crew.home',
  meet: 'meet.home',
  find: 'find.home',
  karte: 'karte.home',
  profil: 'profile.home',
};

// Route -> Tab, aber NUR für Routen, die als Tab-WURZEL gelten (sie bekommen die Bahn,
// die Fußleiste und einen eigenen UI-Zustand).
// v7 P0: friendAdd ist das QR-Sheet über der Profilseite und gehört deshalb in dieselbe
// Tab-Wurzel — sonst baut app.js eine andere Hülle mit anderer Scrollhöhe.
export const TAB_WURZELN = {
  ...Object.fromEntries(Object.entries(TAB_ROUTE).map(([tab, id]) => [id, tab])),
  'profile.friendAdd': 'profil',
};

// Welcher Tab in der Tabbar aktiv ist, ergibt sich aus dem Routen-Präfix. Die Liste wird von
// oben nach unten geprüft; was hier nicht steht, gehört zu Crew (Räume, Chats, Personen).
const TAB_PRAEFIX = [
  ['newMeet.', 'meet'],
  ['meet.', 'meet'],
  ['find.', 'find'],
  ['karte.', 'karte'],
  ['profile.', 'profil'],
  ['onboarding.', 'profil'],
];

export function tabForRoute(routeId) {
  const id = String(routeId || '');
  for (const [praefix, tab] of TAB_PRAEFIX) if (id.startsWith(praefix)) return tab;
  return 'crew';
}

const TAB_ROOTS = Object.fromEntries(Object.entries(TAB_ROUTE).map(([tab, id]) => [tab, { id, params: {} }]));

export function createRouter(onChange) {
  let stack = [{ id: TAB_ROUTE.crew, params: {} }];
  // v4 COMPONENT_RULES 1: Details, Chat und Sheets animieren mit einem kurzen
  // Transform-/Opacity-Uebergang. Dafuer muss die Render-Schleife wissen, WIE
  // gewechselt wurde — vorwaerts in eine Detailebene oder zurueck.
  let lastMove = 'none';

  function current() {
    return stack[stack.length - 1];
  }

  function go(id, params = {}) {
    stack.push({ id, params });
    lastMove = 'push';
    onChange();
  }

  function replace(id, params = {}) {
    stack[stack.length - 1] = { id, params };
    lastMove = 'replace';
    onChange();
  }

  function back(fallbackId) {
    if (stack.length > 1) {
      stack.pop();
    } else if (fallbackId) {
      stack = [{ id: fallbackId, params: {} }];
    }
    lastMove = 'back';
    onChange();
  }

  function setTab(tab) {
    const root = TAB_ROOTS[tab];
    if (!root) return;
    stack = [{ ...root, params: { ...root.params } }];
    lastMove = 'tab';   // die Tab-Bahn animiert selbst
    onChange();
  }

  function resetTo(id, params = {}) {
    stack = [{ id, params }];
    lastMove = 'reset';
    onChange();
  }

  function depth() {
    return stack.length;
  }

  // Die Wechselart wird beim Rendern EINMAL abgeholt und dabei zurueckgesetzt.
  function consumeMove() {
    const move = lastMove;
    lastMove = 'none';
    return move;
  }

  return { current, go, replace, back, setTab, resetTo, depth, tabForRoute, consumeMove };
}
