import { describe, expect, it } from 'vitest';
import { snapshotScroll, restoreScroll } from '../../src/ui/dom-morph';

/* Phase 10 (P10-F02): the coach "why" scroll snap-back. render()'s in-place morph
 * transiently collapses a scrollable panel's content; the browser clamps scrollTop
 * to 0 and nothing restored it. renderBody now snapshots scroll positions before
 * the morph and restores them after (the same treatment drafts/focus/details get).
 * These tests pin the snapshot/restore contract with structural stubs: a node that
 * survives the morph is restored by identity, a replaced node by its id. */

interface StubEl {
  id: string; scrollTop: number; scrollLeft: number; isConnected: boolean;
  children: StubEl[];
  querySelectorAll: (sel: string) => StubEl[];
}
function el(id: string, children: StubEl[] = []): StubEl {
  const node: StubEl = {
    id, scrollTop: 0, scrollLeft: 0, isConnected: true, children,
    querySelectorAll(sel: string) {
      const all: StubEl[] = [];
      const walk = (n: StubEl) => { for (const c of n.children) { all.push(c); walk(c); } };
      walk(node);
      return sel === '[id]' ? all.filter(c => c.id) : all;
    },
  };
  return node;
}

describe('P10-F02 scroll preservation across renders', () => {
  it('restores a surviving panel scrolled to the bottom after a render clamps it to 0', () => {
    const panel = el('table-actions'); panel.scrollTop = 821;
    const root = el('', [panel]);
    const snap = snapshotScroll(root as never);
    panel.scrollTop = 0; // the browser clamp during the morph's transient collapse
    restoreScroll(root as never, snap);
    expect(panel.scrollTop).toBe(821);
  });

  it('restores by id when the morph replaced the scrolled node', () => {
    const oldPanel = el('table-actions'); oldPanel.scrollTop = 902;
    const root = el('', [oldPanel]);
    const snap = snapshotScroll(root as never);
    const fresh = el('table-actions'); fresh.scrollTop = 0;
    root.children = [fresh]; oldPanel.isConnected = false;
    restoreScroll(root as never, snap);
    expect(fresh.scrollTop).toBe(902);
  });

  it('keeps horizontal scroll too, and leaves unscrolled elements alone', () => {
    const log = el(''); log.scrollLeft = 40;
    const plain = el('plain');
    const root = el('', [log, plain]);
    const snap = snapshotScroll(root as never);
    log.scrollLeft = 0;
    restoreScroll(root as never, snap);
    expect(log.scrollLeft).toBe(40);
    expect(plain.scrollTop).toBe(0);
  });

  it('does not resurrect scroll on a node that left the document', () => {
    const gone = el(''); gone.scrollTop = 300;
    const root = el('', [gone]);
    const snap = snapshotScroll(root as never);
    gone.isConnected = false; gone.scrollTop = 0;
    restoreScroll(root as never, snap);
    expect(gone.scrollTop).toBe(0);
  });
});
