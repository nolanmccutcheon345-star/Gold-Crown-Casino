import {regularById} from '../../src/bots/regulars';
const frame=document.querySelector<HTMLIFrameElement>('#frame')!,out=document.querySelector('#result')!;
const pause=()=>new Promise(r=>setTimeout(r,75)),doc=()=>frame.contentDocument!;
function check(ok:unknown,msg:string):asserts ok{if(!ok)throw Error(msg);}
async function until(f:()=>unknown){const start=performance.now();while(!f()){check(performance.now()-start<30000,'UI timeout');await pause();}}
function click(s:string){const b=doc().querySelector<HTMLButtonElement>(s);check(b&&!b.disabled,`Missing or disabled ${s}`);b.click();}
async function select(s:string,value:string){const e=doc().querySelector<HTMLSelectElement>(s);check(e,`Missing ${s}`);e.value=value;e.dispatchEvent(new Event('change',{bubbles:true}));await pause();}
document.querySelector<HTMLButtonElement>('#run')!.onclick=()=>{void(async()=>{const results:unknown[]=[];try{
 frame.src='./tournament34-frame.html?id=habits51-'+crypto.randomUUID();await until(()=>doc().querySelector('[data-view="host"]'));click('[data-view="host"]');await until(()=>doc().querySelector('#seat-regulars'));
 for(const [preset,tier] of [['0','low'],['2','mid'],['4','high']] as const){
  await select('#stake-select',preset);click('#seat-regulars');await pause();
  const selected=[...doc().querySelectorAll<HTMLSelectElement>('[data-opponent-selection]')].map(e=>e.value.slice(8));check(selected.every(id=>regularById(id)?.stakes.includes(tier)),`Wrong ${tier} cast`);
  const menu=doc().querySelector<HTMLSelectElement>('[data-opponent-selection]')!,groups=[...menu.querySelectorAll('optgroup')].map(g=>g.label),choices=[...menu.options].filter(o=>o.value.startsWith('regular:'));
  check(groups.length===4&&groups.slice(1).every(g=>g.startsWith('Regulars · ')),'Missing grouped menu');check(choices.length===40&&new Set(choices.map(o=>o.value)).size===40,'Missing or duplicate regular');
  for(const [width,height] of [[320,568],[390,844],[1366,768]]){frame.width=String(width);frame.height=String(height);await pause();check(doc().documentElement.scrollWidth<=width+1,`Setup overflow ${tier} ${width}`);const details=doc().querySelector<HTMLDetailsElement>('[data-opponent-card]')!;details.open=true;await pause();check(doc().documentElement.scrollWidth<=width+1,`Expanded menu overflow ${tier} ${width}`);}
  results.push({tier,selected,groups,regularOptions:choices.length,widths:[320,390,1366]});
 }
 // Exercise a new high-stakes character selected through the grouped native menu.
 await select('[data-opponent-selection="1"]','regular:viktor');check(doc().querySelector('[data-opponent-seat="1"]')?.textContent?.includes('Viktor'),'New regular not selected');
 frame.width='390';frame.height='844';out.textContent=JSON.stringify({status:'PASS',results,selectedNewRegular:'Viktor',browser:navigator.userAgent});
 }catch(e){out.textContent=JSON.stringify({status:'FAIL',error:String(e),results});}})();};
