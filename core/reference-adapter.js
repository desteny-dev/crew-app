// Löst <dc-import>-Platzhalter in extrahierten Referenz-Screens auf.
// Nur für den Vergleichs-Harness (reference.html) und als Übergangs-Fallback im Aufbau —
// die fertige App rendert ihre Screens über die Module in screens/.

import { referenceScreens } from '../reference-screens.js';
import { statusBar, tabBar, cardEdgeFade, avatarEdgeFade, markerPlate } from '../ui/components.js';

const avatarColors = ['#C98A5B', 'var(--blue)', '#C97F93', '#8FAF8A', '#A08FC9', '#C9AE6B', '#6BAFA5'];
const personColors = { J: '#C98A5B', M: 'var(--blue)', L: '#C97F93', T: '#8FAF8A', S: '#A08FC9', A: '#C9AE6B', P: '#6BAFA5', N: '#B0876B', E: '#8A9FB8', D: '#C98A5B' };

function parseAttributes(raw) {
  return Object.fromEntries(
    [...raw.matchAll(/\b([\w-]+)=(?:"([^"]*)"|'([^']*)')/g)].map((match) => [match[1], match[2] ?? match[3] ?? '']),
  );
}

function staticCrewCard(props) {
  const initials = (props.avatars || '').split(',').map((value) => value.trim()).filter(Boolean).slice(0, 3);
  const active = props.state === 'aktiv';
  const avatars = initials.map((text, index) => `<div style="width:27px;height:27px;border-radius:50%;background:${avatarColors[(text.charCodeAt(0) + index) % avatarColors.length]};border:2px solid var(--surface);color:var(--on-accent);font:600 10.5px/23px 'Instrument Sans',sans-serif;text-align:center;margin-left:-7px;flex:none">${text}</div>`).join('');
  const extra = props.extra ? `<div style="width:27px;height:27px;border-radius:50%;background:var(--field);border:2px solid var(--surface);color:var(--muted);font:600 10px/23px 'Instrument Sans',sans-serif;text-align:center;margin-left:-7px;flex:none">${props.extra}</div>` : '';
  const fade = active ? cardEdgeFade(18) : '';
  const badge = props.count ? `<div style="position:absolute;top:-8px;right:-6px;min-width:21px;height:21px;border-radius:11px;background:var(--orange);color:var(--on-accent);font:650 11.5px/21px 'Instrument Sans',sans-serif;text-align:center;padding:0 6px">${props.count}</div>` : '';
  return `<div style="position:relative;flex:none;width:128px;background:var(--surface);border-radius:18px;padding:14px 15px 13px;display:flex;flex-direction:column;gap:9px;font-family:'Instrument Sans',sans-serif;border:1px solid var(--ink-a09);box-shadow:0 1px 2px var(--shadow-04);color:var(--ink)">${fade}${badge}<div style="display:flex;align-items:center;padding-left:6px">${avatars}${extra}</div><div style="display:flex;flex-direction:column;gap:2px"><div style="font-size:14px;font-weight:650;letter-spacing:-.01em;white-space:nowrap;overflow:hidden;text-overflow:ellipsis">${props.nm || 'Crew'}</div><div style="font-size:12px;font-weight:550;color:${active ? 'var(--green-dark)' : 'var(--ink-soft)'};white-space:nowrap;overflow:hidden;text-overflow:ellipsis">${props.meta || ''}</div></div></div>`;
}

function staticPersonRow(props) {
  const color = personColors[(props.init || '?')[0]] || 'var(--muted-light)';
  const fade = props.aktiv ? avatarEdgeFade('s') : '';
  const dot = props.frei && !props.aktiv ? `<div style="position:absolute;right:-1px;bottom:-1px;width:13px;height:13px;border-radius:50%;background:var(--green);border:2.5px solid var(--paper);box-sizing:border-box"></div>` : '';
  const markColor = props.markColor || '#7E6BA8';
  const plate = props.mark ? markerPlate(props.mark, props.mark === 'stern' ? '#C9AE6B' : markColor) : '';
  const labelChip = props.mark && props.mark !== 'stern'
    ? `<span style="font-size:10px;font-weight:650;letter-spacing:.03em;color:${markColor};background:var(--paper-soft);padding:2px 6px;border-radius:5px;flex:none;white-space:nowrap">${props.label || 'Besondere Person'}</span>`
    : '';
  const badge = props.count ? `<div style="min-width:21px;height:21px;border-radius:11px;background:var(--orange);color:var(--on-accent);font:650 11.5px/21px 'Instrument Sans',sans-serif;text-align:center;padding:0 6px;flex:none">${props.count}</div>` : '';
  return `<div style="display:flex;align-items:center;gap:12px;padding:9px 0;font-family:'Instrument Sans',sans-serif;color:var(--ink)"><div style="position:relative;flex:none"><div style="width:42px;height:42px;border-radius:50%;background:${color};color:var(--on-accent);font:600 15px/42px 'Instrument Sans',sans-serif;text-align:center;position:relative;overflow:hidden">${props.init || '?'}${fade}</div>${dot}${plate}</div><div style="flex:1;min-width:0;display:flex;flex-direction:column;gap:1px"><div style="display:flex;align-items:center;gap:6px;min-width:0"><span style="font-size:15px;font-weight:600;letter-spacing:-.01em;white-space:nowrap;overflow:hidden;text-overflow:ellipsis">${props.nm || ''}</span>${labelChip}</div>${props.status ? `<div style="font-size:12.5px;font-weight:500;color:var(--muted);white-space:nowrap;overflow:hidden;text-overflow:ellipsis">${props.status}</div>` : ''}</div>${badge}</div>`;
}

function staticFreiKreis(props) {
  const on = props.state === 'frei';
  const look = on
    ? 'background:var(--green);border:1.5px solid var(--green);color:var(--on-accent);box-shadow:0 2px 8px var(--green-a22)'
    : 'background:var(--surface);border:1.5px solid var(--green-a42);color:var(--green-dark);box-shadow:0 1px 4px var(--shadow-07)';
  return `<div style="display:flex;align-items:center;justify-content:center;font-family:'Instrument Sans',sans-serif;padding:14px"><div style="width:64px;height:64px;border-radius:50%;${look};box-sizing:border-box;display:flex;align-items:center;justify-content:center"><span style="font-size:15px;font-weight:650;letter-spacing:-.01em">Frei</span></div></div>`;
}

function renderImport(rawAttributes) {
  const props = parseAttributes(rawAttributes);
  switch (props.name) {
    case 'StatusBar': return statusBar(props.time || '9:41');
    case 'TabBar': return tabBar(props.active || 'crew', { dot: Boolean(props.dot) });
    case 'CrewCard': return staticCrewCard(props);
    case 'PersonRow': return staticPersonRow(props);
    case 'FreiKreis': return staticFreiKreis(props);
    default: return '';
  }
}

export function resolveReferenceScreen(label) {
  const source = referenceScreens[label];
  if (!source) return null;
  return source.replace(/<dc-import\s+([^>]*?)><\/dc-import>/gi, (_full, attributes) => renderImport(attributes));
}

export function referenceLabels() {
  return Object.keys(referenceScreens);
}
