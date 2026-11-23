export {};
const frame=document.querySelector<HTMLIFrameElement>('#table-frame')!;
const viewport=document.querySelector<HTMLSelectElement>('#viewport')!;
const players=document.querySelector<HTMLSelectElement>('#players')!;
const phase=document.querySelector<HTMLSelectElement>('#phase')!;
function show(){const [width,height]=viewport.value.split('x').map(Number);frame.style.width=`${width}px`;frame.style.height=`${height}px`;frame.src=`./layout-frame.html?seats=${players.value}&phase=${phase.value}`;}
for(const el of document.querySelectorAll('select'))el.addEventListener('change',show);
const rect=(e:Element)=>{const r=e.getBoundingClientRect();return{x:r.x,y:r.y,width:r.width,height:r.height,right:r.right,bottom:r.bottom};};
function measure(){
 const d=frame.contentDocument!,scene=d.querySelector('.table-scene')!,board=d.querySelector('.board-area')!,seats=[...d.querySelectorAll('.table-scene .seat')];
 const overlap=(a:ReturnType<typeof rect>,b:ReturnType<typeof rect>)=>Math.min(a.right,b.right)-Math.max(a.x,b.x)>.5&&Math.min(a.bottom,b.bottom)-Math.max(a.y,b.y)>.5;
 const failures:string[]=[],bounds=rect(scene),boxes=seats.map(rect),boardBox=rect(board);
 seats.forEach((seat,i)=>{
  if(boxes[i].x<bounds.x-.5||boxes[i].right>bounds.right+.5||boxes[i].y<bounds.y-.5||boxes[i].bottom>bounds.bottom+.5)failures.push(`seat ${i} outside table`);
  if(overlap(boxes[i],boardBox))failures.push(`seat ${i} overlaps board`);
  for(let j=i+1;j<seats.length;j++)if(overlap(boxes[i],boxes[j]))failures.push(`seat ${i}/${j} overlap`);
  const cards=rect(seat.querySelector('.seat-cards')!),label=rect(seat.querySelector('.seat-label')!);
  if(overlap(cards,label))failures.push(`seat ${i} cards/label overlap`);
  for(const e of seat.querySelectorAll('.seat-label strong,.seat-label b,.seat-status,.seat-bet'))if(e.scrollWidth>e.clientWidth+1||e.scrollHeight>e.clientHeight+1)failures.push(`seat ${i} text overflows ${e.className||e.tagName}`);
 });
 if(d.documentElement.scrollWidth>d.documentElement.clientWidth)failures.push('horizontal overflow');
 if(boxes[0].bottom<Math.max(...boxes.map(b=>b.bottom))-.5)failures.push('Hero not bottom');
 if(seats.length!==Number(players.value))failures.push('wrong seat count');
 const actions=d.querySelector('.action-panel')!,buttons=[...actions.querySelectorAll('button')].map(e=>({text:e.textContent,box:rect(e),disabled:e.disabled}));
 const shortcuts=[...d.querySelectorAll<HTMLButtonElement>('.mobile-table-nav button')].map(e=>({text:e.textContent,box:rect(e)}));
 if(d.documentElement.clientWidth<=700&&shortcuts.some(b=>b.box.height<44||b.box.y<0||b.box.bottom>Number(frame.style.height.replace('px',''))+.5))failures.push('mobile shortcut inaccessible');
 const shortcut=d.querySelector<HTMLButtonElement>('#jump-action');let actionReachable=true;if(d.documentElement.clientWidth<=700&&shortcut){shortcut.click();const primary=[...actions.querySelectorAll<HTMLButtonElement>('#fold,#call,#raise,#next-hand')].map(rect);actionReachable=primary.length>0&&primary.every(b=>b.height>=44&&b.x>=0&&b.right<=d.documentElement.clientWidth&&b.y>=0&&b.bottom<=d.documentElement.clientHeight-58);if(!actionReachable)failures.push('primary controls not visible after shortcut');}
 return{actionReachable,case:{viewport:viewport.value,seats:seats.length,phase:phase.value},status:failures.length?'FAIL':'PASS',failures,viewportWidth:d.documentElement.clientWidth,scrollWidth:d.documentElement.scrollWidth,table:bounds,board:boardBox,seats:seats.map((e,i)=>({id:e.getAttribute('data-seat'),box:boxes[i],dealer:!!e.querySelector('.dealer-button'),blind:e.querySelector('.blind-tag')?.textContent,acting:e.classList.contains('acting')})),actions:rect(actions),buttons,shortcuts};
}
document.querySelector('#measure')!.addEventListener('click',()=>{document.querySelector('#measure-result')!.textContent=JSON.stringify(measure(),null,2);});
async function loaded(){await new Promise<void>((resolve,reject)=>{const timeout=setTimeout(()=>reject(Error('Fixture render timeout')),10000);frame.addEventListener('load',()=>{const d=frame.contentDocument!;const ready=()=>{if(!d.querySelector('.table-scene .seat'))return;clearTimeout(timeout);observer.disconnect();resolve();};const observer=new MutationObserver(ready);observer.observe(d.body,{childList:true,subtree:true});ready();},{once:true});show();});await new Promise<void>(resolve=>requestAnimationFrame(()=>requestAnimationFrame(()=>resolve())));}
document.querySelector('#run-matrix')!.addEventListener('click',async()=>{const out=document.querySelector('#matrix-result')!;try{const results=[];for(const v of [...viewport.options].map(x=>x.value))for(const p of [...players.options].map(x=>x.value))for(const s of [...phase.options].map(x=>x.value)){viewport.value=v;players.value=p;phase.value=s;out.textContent=`Running ${v} / ${p} / ${s}`;await loaded();results.push(measure());}out.textContent=JSON.stringify({status:results.every(x=>x.status==='PASS')?'PASS':'FAIL',count:results.length,passed:results.filter(x=>x.status==='PASS').length,results},null,2);}catch(error){out.textContent=JSON.stringify({status:'FAIL',error:String(error)});}});
document.querySelector('#table-photo')!.addEventListener('click',()=>{frame.style.height='1150px';frame.contentDocument?.querySelector('.table-panel')?.scrollIntoView({block:'start'});});
show();
