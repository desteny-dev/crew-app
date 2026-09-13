// Stack-basierter Router. Eine Route = { id, params }.
// Tabs (meet/crew/profil) setzen den Stack auf ihre Wurzel zurück.

const TAB_ROOTS = {
  meet: { id: 'meet.home', params: {} },
  crew: { id: 'crew.home', params: {} },
  profil: { id: 'profile.home', params: {} },
};

// Welcher Tab in der Tabbar aktiv ist, ergibt sich aus dem Routen-Präfix.
export function tabForRoute(routeId) {
  if (routeId.startsWith('meet.') || routeId.startsWith('newMeet.')) return 'meet';
  if (routeId.startsWith('profile.') || routeId.startsWith('onboarding.')) return 'profil';
  return 'crew';
}

export function createRouter(onChange) {
  let stack = [{ id: 'crew.home', params: {} }];
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
