/** Phase 5 (6A): a session no-repeat window for table talk. Presentation only: this module remembers which
 * lines have already been said recently so the table does not repeat itself within a session. It reads
 * nothing about any hand — only the texts of lines already shown — and it never reaches a decision, the
 * ledger or an observation. Pickers that opt in stay deterministic: the same seed and the same memory
 * contents always produce the same line. */

const hash=(seed:string)=>{let h=2166136261;for(let i=0;i<seed.length;i++){h^=seed.charCodeAt(i);h=Math.imul(h,16777619)>>>0;}h^=h>>>13;h=Math.imul(h,0x5bd1e995)>>>0;return (h^(h>>>15))>>>0;};

/** The last `capacity` line texts said at the table, oldest first. Adding a text that is already in the
 * window is a no-op (it keeps its original place); once the window is full the oldest text falls out. */
export class RecentLines {
 readonly capacity:number;
 private order:string[]=[];
 private set=new Set<string>();
 constructor(capacity=48){this.capacity=Math.max(1,Math.floor(capacity));}
 /** Has this exact line been said within the current window? */
 seen(text:string):boolean {return this.set.has(text);}
 /** Remember a line that was just said. */
 add(text:string):void {
  if(this.set.has(text))return;
  this.order.push(text);this.set.add(text);
  while(this.order.length>this.capacity){const old=this.order.shift()!;this.set.delete(old);}
 }
 get size():number {return this.order.length;}
 /** The remembered lines, oldest first. */
 recent():readonly string[] {return [...this.order];}
 clear():void {this.order=[];this.set.clear();}
}

/** Pick a line from `pool` that is not in `memory`'s recent window, deterministically from `seed`: the
 * pool is scanned from the seed's usual slot onwards and the first unseen line wins. The chosen line is
 * added to `memory`. When every line in the pool is already in the window (pool exhausted), this falls
 * back to the plain seeded pick, so a small pool can never dead-end the table. */
export function pickFresh(pool:readonly string[],seed:string,memory:RecentLines):string {
 if(!pool.length)return '';
 const start=hash(seed)%pool.length;
 for(let i=0;i<pool.length;i++){const line=pool[(start+i)%pool.length];if(!memory.seen(line)){memory.add(line);return line;}}
 const line=pool[start];memory.add(line);return line;
}
