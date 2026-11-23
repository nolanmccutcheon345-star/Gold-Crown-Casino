/** Unique command/hand identity using secure entropy; independent of the deck stream. */
export function newHandId():string {
  if (!globalThis.crypto?.getRandomValues) throw new Error('Secure randomness unavailable. The table cannot start.');
  const bytes=globalThis.crypto.getRandomValues(new Uint8Array(16));
  return `hand-${Array.from(bytes,b=>b.toString(16).padStart(2,'0')).join('')}`;
}
