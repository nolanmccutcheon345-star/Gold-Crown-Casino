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

/* The live-app failure mode (found in browser verification): the session tick renders
 * a transient busy state whose panel is far shorter than the real one, then renders
 * the real panel ~200ms later. In the short render the saved position cannot fit and
 * the clamp wins; the next snapshot then reads the clamped 0. Positions that cannot
 * fit are remembered across renders and retried until the content can hold them. */
interface RichEl {
  id: string; className: string; isConnected: boolean; children: RichEl[];
  scrollHeight: number; scrollWidth: number; clientHeight: number; clientWidth: number;
  dataset: Record<string, string>;
  _top: number; _left: number; scrollTop: number; scrollLeft: number;
  closest: (sel: string) => RichEl | null;
  querySelectorAll: (sel: string) => RichEl[];
  querySelector: (sel: string) => RichEl | null;
}
function richEl(id: string, children: RichEl[] = []): RichEl {
  const node: RichEl = {
    id, className: '', isConnected: true, children,
    scrollHeight: 0, scrollWidth: 0, clientHeight: 0, clientWidth: 0,
    dataset: {}, _top: 0, _left: 0,
    get scrollTop() { return node._top; },
    set scrollTop(v: number) { node._top = Math.max(0, Math.min(v, Math.max(0, node.scrollHeight - node.clientHeight))); },
    get scrollLeft() { return node._left; },
    set scrollLeft(v: number) { node._left = Math.max(0, Math.min(v, Math.max(0, node.scrollWidth - node.clientWidth))); },
    closest() { return null; },
    querySelectorAll(sel: string) {
      const all: RichEl[] = [];
      const walk = (n: RichEl) => { for (const c of n.children) { all.push(c); walk(c); } };
      walk(node);
      return sel === '[id]' ? all.filter(c => c.id) : all;
    },
    querySelector(sel: string) {
      return node.querySelectorAll('*').find(c => sel === `#${c.id}`) ?? null;
    },
  } as RichEl;
  return node;
}

describe('P10-F02 scroll memory across transient short renders', () => {
  it('recovers the position when a later render restores the tall content', () => {
    const panel = richEl('panel-a');
    panel.scrollHeight = 1457; panel.clientHeight = 673; panel.dataset.decisionToken = 'hand-1:6';
    panel.scrollTop = 784;
    const root = richEl('', [panel]);
    const snap1 = snapshotScroll(root as never);
    // The busy render: content collapses, the browser clamps, restore cannot fit 784.
    panel.scrollHeight = 190; panel.clientHeight = 190; panel.scrollTop = 0;
    restoreScroll(root as never, snap1);
    expect(panel.scrollTop).toBe(0);
    // The real render ~200ms later: its snapshot reads the clamped 0, yet the
    // remembered position is retried and now fits.
    panel.scrollHeight = 1457; panel.clientHeight = 673;
    const snap2 = snapshotScroll(root as never);
    restoreScroll(root as never, snap2);
    expect(panel.scrollTop).toBe(784);
  });

  it('drops the remembered position when the decision changes', () => {
    const panel = richEl('panel-b');
    panel.scrollHeight = 1457; panel.clientHeight = 673; panel.dataset.decisionToken = 'hand-1:6';
    panel.scrollTop = 500;
    const root = richEl('', [panel]);
    const snap1 = snapshotScroll(root as never);
    panel.scrollHeight = 190; panel.clientHeight = 190; panel.scrollTop = 0;
    restoreScroll(root as never, snap1);
    panel.scrollHeight = 1457; panel.clientHeight = 673; panel.dataset.decisionToken = 'hand-1:7';
    restoreScroll(root as never, snapshotScroll(root as never));
    expect(panel.scrollTop).toBe(0);
  });
});
