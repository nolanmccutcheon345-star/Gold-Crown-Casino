/**
 * Phase 10 (fun #12 + #13): count quests and the shoe story.
 *
 * Quests are per-shoe challenges computed ONLY from the count state the player can
 * legitimately see (cards seen, the running/true count from those cards, aces seen) —
 * never from the shoe itself. Progress lives in a small versioned record, the same
 * pattern as the stats books. When a shoe ends, its summary is kept as the "shoe
 * story": how deep it went, where the count peaked, how many aces showed.
 */
import { formatCount, type CountState } from './counting';

export const COUNT_QUEST_KEY = 'poker-night-ai:count-quests';

export interface ShoeStory { seen: number; total: number; peakTrue: number; aces: number }
export interface CountQuestBook {
  version: 1;
  /** Cards seen in the shoe currently being tracked. A drop means a new shoe. */
  shoeSeen: number;
  peakTrue: number;
  acesPeak: number;
  /** Quest ids completed in the current shoe. */
  completed: string[];
  /** Quests completed across all shoes. */
  lifetime: number;
  lastShoe?: ShoeStory;
}

export const freshCountQuestBook = (): CountQuestBook => ({ version: 1, shoeSeen: 0, peakTrue: 0, acesPeak: 0, completed: [], lifetime: 0 });

const centsFree = (v: unknown): v is number => typeof v === 'number' && Number.isFinite(v);

export function checkCountQuestBook(raw: unknown): CountQuestBook {
  if (!raw || typeof raw !== 'object') throw new Error('Count quest record is damaged.');
  const v = raw as Record<string, unknown>;
  if (v.version !== 1 || !centsFree(v.shoeSeen) || !centsFree(v.peakTrue) || !centsFree(v.acesPeak) || !centsFree(v.lifetime) || !Array.isArray(v.completed) || !v.completed.every(x => typeof x === 'string')) throw new Error('Count quest record is damaged.');
  const book: CountQuestBook = { version: 1, shoeSeen: v.shoeSeen as number, peakTrue: v.peakTrue as number, acesPeak: v.acesPeak as number, completed: [...(v.completed as string[])], lifetime: v.lifetime as number };
  if (v.lastShoe && typeof v.lastShoe === 'object') {
    const s = v.lastShoe as Record<string, unknown>;
    if (centsFree(s.seen) && centsFree(s.total) && centsFree(s.peakTrue) && centsFree(s.aces)) book.lastShoe = { seen: s.seen as number, total: s.total as number, peakTrue: s.peakTrue as number, aces: s.aces as number };
  }
  return book;
}

export function loadCountQuestBook(): { book: CountQuestBook; notice: string } {
  try {
    const raw = localStorage.getItem(COUNT_QUEST_KEY);
    if (!raw) return { book: freshCountQuestBook(), notice: '' };
    return { book: checkCountQuestBook(JSON.parse(raw)), notice: '' };
  } catch {
    return { book: freshCountQuestBook(), notice: 'Your saved count quests could not be read, so they were restarted. Nothing else was affected.' };
  }
}

export function saveCountQuestBook(book: CountQuestBook): void {
  try { localStorage.setItem(COUNT_QUEST_KEY, JSON.stringify(book)); } catch { /* storage unavailable: quests simply do not persist */ }
}

export interface CountQuest { id: string; label: string; done: boolean; progress: string }

const QUEST_DEFS: { id: string; label: string; met: (s: CountState, total: number, peakTrue: number) => boolean; progress: (s: CountState, total: number, peakTrue: number) => string }[] = [
  { id: 'shoe-quarter', label: 'See a quarter of the shoe', met: (s, t) => s.cardsSeen >= Math.ceil(t / 4), progress: (s, t) => `${s.cardsSeen} of ${Math.ceil(t / 4)} cards` },
  { id: 'shoe-half', label: 'See half the shoe', met: (s, t) => s.cardsSeen >= Math.ceil(t / 2), progress: (s, t) => `${s.cardsSeen} of ${Math.ceil(t / 2)} cards` },
  { id: 'shoe-deep', label: 'Ride the shoe to three-quarters', met: (s, t) => s.cardsSeen >= Math.ceil(t * 3 / 4), progress: (s, t) => `${s.cardsSeen} of ${Math.ceil(t * 3 / 4)} cards` },
  { id: 'count-warm', label: 'True count reaches +2', met: (s, _t, peak) => peak >= 2, progress: (s, _t, peak) => `peak ${formatCount(peak)}` },
  { id: 'count-hot', label: 'True count reaches +4', met: (s, _t, peak) => peak >= 4, progress: (s, _t, peak) => `peak ${formatCount(peak)}` },
  { id: 'ace-watcher', label: 'Spot 8 aces in one shoe', met: s => s.acesSeen >= 8, progress: s => `${s.acesSeen} of 8 aces` },
];

/**
 * Fold the current count state into the book: detect a new shoe (seen count dropped),
 * bank the finished shoe's story, track peaks, and mark newly completed quests.
 * Mutates and returns the book plus the quest list for display.
 */
export function updateCountQuests(book: CountQuestBook, state: CountState, decks: number): { book: CountQuestBook; quests: CountQuest[]; changed: boolean } {
  const total = decks * 52;
  let changed = false;
  if (state.cardsSeen < book.shoeSeen) {
    if (book.shoeSeen >= 20) book.lastShoe = { seen: book.shoeSeen, total, peakTrue: book.peakTrue, aces: book.acesPeak };
    book.shoeSeen = 0; book.peakTrue = state.trueCount; book.acesPeak = state.acesSeen; book.completed = [];
    changed = true;
  }
  if (state.cardsSeen !== book.shoeSeen) { book.shoeSeen = state.cardsSeen; changed = true; }
  if (state.trueCount > book.peakTrue) { book.peakTrue = state.trueCount; changed = true; }
  if (state.acesSeen > book.acesPeak) { book.acesPeak = state.acesSeen; changed = true; }
  const quests = QUEST_DEFS.map(def => {
    const done = def.met(state, total, book.peakTrue);
    if (done && !book.completed.includes(def.id)) { book.completed.push(def.id); book.lifetime++; changed = true; }
    return { id: def.id, label: def.label, done: done || book.completed.includes(def.id), progress: def.progress(state, total, book.peakTrue) };
  });
  return { book, quests, changed };
}

/** #13: the story of the shoe that just ended, from the stored summary. */
export function shoeStoryMarkup(book: CountQuestBook): string {
  const s = book.lastShoe;
  if (!s) return '';
  const pct = s.total ? Math.round(100 * s.seen / s.total) : 0;
  return `<p class="lobby-note" data-testid="bj-shoe-story">The shoe that just ended: ${s.seen} of ${s.total} cards dealt (${pct}% penetration) · the count peaked at ${formatCount(s.peakTrue)} · ${s.aces} aces showed.</p>`;
}
