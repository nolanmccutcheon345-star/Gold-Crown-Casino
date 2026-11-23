/** Patch 82: money that changes counts up or down to its new value instead of jumping. Display only: the text ends
 * exactly as rendered. Elements opt in with data-count-key (who they are) and data-count (the value in cents). */
const shown=new Map<string,number>();
export function countUp(root:ParentNode,format:(cents:number)=>string,enabled:boolean,ms=550):void {
 for(const el of Array.from(root.querySelectorAll<HTMLElement>('[data-count-key][data-count]'))){
  const key=el.dataset.countKey!,to=Number(el.dataset.count),seen=shown.get(key),from=el.dataset.countFrom!==undefined&&seen!==to?Number(el.dataset.countFrom):seen;shown.set(key,to);
  const span=Number(el.dataset.countMs)||ms;
  if(!enabled||from===undefined||from===to||!Number.isFinite(to)||typeof requestAnimationFrame==='undefined')continue;
  const final=el.textContent,start=performance.now();el.classList.add(to>from?'counting-up':'counting-down');
  const step=(now:number)=>{const t=Math.min(1,(now-start)/span),e=1-Math.pow(1-t,3);
   if(!el.isConnected||Number(el.dataset.count)!==to)return;
   el.textContent=t<1?format(Math.round(from+(to-from)*e)):final;
   if(t<1)requestAnimationFrame(step);else el.classList.remove('counting-up','counting-down');};
  requestAnimationFrame(step);
 }
}
/** For tests: forget what was shown. */
export const resetCountUp=()=>shown.clear();
