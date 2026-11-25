// In-place DOM update for the string-rendered UI.
//
// render() used to assign `innerHTML`, which destroyed and rebuilt every element on every
// state change. morphInto() parses the same markup into an inert template and edits the live
// tree to match it, so elements that did not change are not touched: a button being pressed
// stays the same node, focus and scroll positions survive, and a screen reader keeps its place.
//
// Form controls are reset to the value a freshly created element would have, exactly as the
// innerHTML assignment did. The caller's existing draft/focus restoration then runs unchanged.

const ELEMENT = 1;
const FORM_CONTROL = /^(?:INPUT|SELECT|TEXTAREA)$/;

function syncAttributes(from: Element, to: Element): void {
  for (const name of from.getAttributeNames()) if (!to.hasAttribute(name)) from.removeAttribute(name);
  for (const name of to.getAttributeNames()) {
    const value = to.getAttribute(name)!;
    if (from.getAttribute(name) !== value) from.setAttribute(name, value);
  }
}

function reusable(current: Node, next: Node): boolean {
  if (current.nodeType !== next.nodeType) return false;
  if (current.nodeType !== ELEMENT) return true;
  const a = current as Element, b = next as Element;
  if (a.tagName !== b.tagName || a.id !== b.id) return false;
  // An input keeps internal state per type; never turn a checkbox into a text field in place.
  return a.tagName !== 'INPUT' || a.getAttribute('type') === b.getAttribute('type');
}

function morphNode(from: Node, to: Node): void {
  if (from.nodeType !== ELEMENT) {
    if (from.nodeValue !== to.nodeValue) from.nodeValue = to.nodeValue;
    return;
  }
  const a = from as Element, b = to as Element;
  // Fast path: an identical subtree with no form controls has nothing to update.
  // (Controls are always visited so their live value is reset as described above.)
  if (a.isEqualNode(b) && !FORM_CONTROL.test(a.tagName) && !a.querySelector('input,select,textarea')) return;
  syncAttributes(a, b);
  if (a instanceof HTMLInputElement && b instanceof HTMLInputElement) {
    if (a.type === 'checkbox' || a.type === 'radio') { if (a.checked !== b.checked) a.checked = b.checked; }
    else if (a.type !== 'file' && a.value !== b.value) a.value = b.value;
    return;
  }
  // Read the fresh control state first: morphChildren moves new child nodes out of `b`.
  const freshText = b instanceof HTMLTextAreaElement ? b.value : null;
  const freshIndex = b instanceof HTMLSelectElement ? b.selectedIndex : null;
  morphChildren(a, b);
  if (a instanceof HTMLTextAreaElement && freshText !== null) { if (a.value !== freshText) a.value = freshText; }
  else if (a instanceof HTMLSelectElement && freshIndex !== null) { if (a.selectedIndex !== freshIndex) a.selectedIndex = freshIndex; }
}

function morphChildren(from: Node, to: Node): void {
  let cursor = from.firstChild;
  for (const next of Array.from(to.childNodes)) {
    let match: ChildNode | null = null;
    const id = next.nodeType === ELEMENT ? (next as Element).id : '';
    if (id) {
      // Elements with an id are matched by id among the remaining siblings, so they keep their identity when neighbours come and go.
      for (let candidate = cursor; candidate; candidate = candidate.nextSibling) if (reusable(candidate, next)) { match = candidate; break; }
    } else if (cursor && reusable(cursor, next)) match = cursor;
    if (!match) { from.insertBefore(next, cursor); continue; }
    if (match === cursor) cursor = cursor.nextSibling; else from.insertBefore(match, cursor);
    morphNode(match, next);
  }
  while (cursor) { const stale = cursor; cursor = cursor.nextSibling; from.removeChild(stale); }
}

/** Make `root`'s contents match `html`, reusing the existing nodes wherever they still fit. */
export function morphInto(root: HTMLElement, html: string): void {
  const template = document.createElement('template');
  template.innerHTML = html;
  morphChildren(root, template.content);
}

/* Phase 10 (P10-F02): scroll preservation across a morph.
 *
 * morphChildren removes stale children at the end of its pass, so a scrollable element's
 * content transiently collapses mid-morph; the browser clamps scrollTop to fit the momentary
 * height and nothing put it back — a panel scrolled to the bottom snapped to the top on the
 * next bot action or the 5-second session tick. renderBody already preserved drafts, focus
 * and open <details>; scroll positions join that list: snapshot before the morph, restore
 * after it. Nodes that survive the morph are restored by identity; a node the morph replaced
 * is restored through its id. */
export interface ScrollSpot { top: number; left: number }
export interface ScrollSnapshot { byNode: Map<Element, ScrollSpot>; byId: Map<string, ScrollSpot> }

export function snapshotScroll(root: ParentNode): ScrollSnapshot {
  const byNode = new Map<Element, ScrollSpot>(), byId = new Map<string, ScrollSpot>();
  root.querySelectorAll('*').forEach(el => {
    if (el.scrollTop || el.scrollLeft) {
      const spot = { top: el.scrollTop, left: el.scrollLeft };
      byNode.set(el, spot);
      if (el.id) byId.set(el.id, spot);
    }
  });
  return { byNode, byId };
}

export function restoreScroll(root: ParentNode, snap: ScrollSnapshot): void {
  for (const [el, spot] of snap.byNode) {
    if ((el as Element).isConnected) {
      if (el.scrollTop !== spot.top) el.scrollTop = spot.top;
      if (el.scrollLeft !== spot.left) el.scrollLeft = spot.left;
    }
  }
  if (snap.byId.size) {
    root.querySelectorAll('[id]').forEach(el => {
      const spot = snap.byId.get(el.id);
      if (spot && !snap.byNode.has(el)) {
        if (el.scrollTop !== spot.top) el.scrollTop = spot.top;
        if (el.scrollLeft !== spot.left) el.scrollLeft = spot.left;
      }
    });
  }
}
