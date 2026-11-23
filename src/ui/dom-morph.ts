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
