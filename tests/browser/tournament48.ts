export {};
const frame=document.querySelector<HTMLIFrameElement>('#frame')!,out=document.querySelector('#result')!;
const pause=(ms:number)=>new Promise(resolve=>setTimeout(resolve,ms));
const check=(value:unknown,message:string)=>{if(!value)throw Error(message);};
const doc=()=>frame.contentDocument!;
const button=(selector:string)=>doc().querySelector<HTMLButtonElement>(selector);
async function wait(test:()=>unknown,limit=60000){const start=performance.now();while(!test()){check(performance.now()-start<limit,'Timed out waiting for UI');await pause(50);}}
document.querySelector<HTMLButtonElement>('#run')!.onclick=()=>{void(async()=>{const start=performance.now();let actions=0,moves=0,reloaded=false;try{
 frame.src='./tournament34-frame.html?id=stats48-'+Date.now();await wait(()=>button('[data-view="tournaments"]'));button('[data-view="tournaments"]')!.click();await wait(()=>button('#tournament-register'));
 button('[data-tournament-tier="casino"]')?.click();await pause(100);
 button('[data-tournament-event="daily-125"]')?.click();await pause(100);
 button('[data-tournament-field="27"]')!.click();await pause(100);button('#tournament-register')!.click();await wait(()=>button('#t-pace'));
 const pace=doc().querySelector<HTMLSelectElement>('#t-pace')!;pace.value='fast';pace.dispatchEvent(new Event('change',{bubbles:true}));
 while(!button('#t-finish')){
  check(performance.now()-start<900000,'15 minute limit');
  const ack=button('#tournament-move-ack');
  if(ack){check(doc().activeElement===ack,'Move did not receive focus');check(!button('#t-call:not(:disabled)')&&!button('#t-fold:not(:disabled)'),'Play enabled behind move');const hand=doc().querySelector('.tournament-table .hand-tag')?.textContent;await pause(700);check(doc().querySelector('.tournament-table .hand-tag')?.textContent===hand,'Move advanced without acknowledgement');ack.click();moves++;}
  if(!reloaded&&actions>=2&&button('#t-pause:not(:disabled)')){button('#t-pause')!.click();await wait(()=>button('#t-pause')?.textContent==='Resume');const before=doc().querySelector('.tournament-wallet strong')?.textContent;await new Promise<void>(resolve=>{frame.addEventListener('load',()=>resolve(),{once:true});frame.contentWindow!.location.reload();});await wait(()=>button('[data-view="tournaments"]'));button('[data-view="tournaments"]')!.click();await wait(()=>button('#t-pause'));check(button('#t-pause')!.textContent==='Resume','Reload lost pause');check(doc().querySelector('.tournament-wallet strong')?.textContent===before,'Reload changed balance');button('#t-pause')!.click();reloaded=true;}
  const skip=button('#t-fast-forward:not(:disabled)');if(skip&&!skip.textContent?.includes('Stop'))skip.click();
  const next=button('#t-next:not(:disabled)'),call=button('#t-call:not(:disabled)'),fold=button('#t-fold:not(:disabled)');
  if(!skip){if(next)next.click();else if(call?.textContent==='Check'){call.click();actions++;}else if(fold){fold.click();actions++;}}
  check(doc().documentElement.scrollWidth<=frame.clientWidth+1,'Sideways overflow');
  const alerts=[...doc().querySelectorAll('[role="alert"]')].map(e=>e.textContent).join('');check(!/replay|busy|integrity|failed/i.test(alerts),alerts);
  out.textContent=JSON.stringify({status:'RUNNING',actions,moves,reloaded,elapsed:Math.round((performance.now()-start)/1000),hand:doc().querySelector('.tournament-table .hand-tag')?.textContent});await pause(100);
 }
 const result=doc().querySelector('[data-testid="tournament-result"]')?.textContent;button('#t-finish')!.click();await wait(()=>button('#tournament-register'));
 button('[data-view="results"]')!.click();button('[data-view="tournament-stats"]')!.click();await wait(()=>button('[data-tstats-format="all"]'));
 check(doc().querySelectorAll('.tstats-play tbody tr').length===11,'All playing stats present');
 check(doc().querySelector('.tstats-play')!.textContent!.includes('Named regulars'),'Named regular comparisons absent');
 const statsText=doc().querySelector('[data-testid="tournament-stats"]')!.textContent;
 for(const [width,height] of [[390,844],[320,568],[1366,768]]){frame.width=String(width);frame.height=String(height);await pause(150);check(doc().documentElement.scrollWidth<=width+1,`Stats overflow at ${width}`);}
 button('[data-tstats-format="single"]')!.click();check(doc().body.textContent!.includes('No finished tournaments match'),'Single-table filter');
 button('[data-tstats-format="multi"]')!.click();check(doc().querySelectorAll('.tstats-play tbody tr').length===11,'Multi-table filter');
 button('[data-tstats-tier="home"]')!.click();check(doc().body.textContent!.includes('No finished tournaments match'),'Event filter');
 button('[data-tstats-tier="all"]')!.click();button('[data-tstats-recent="20"]')!.click();check(doc().querySelectorAll('.tstats-play tbody tr').length===11,'Recent filter');
 button('[data-view="live"]')!.click();button('[data-view="host"]')!.click();await wait(()=>button('#seat-regulars'));button('#seat-regulars')!.click();
 check(doc().querySelectorAll('[data-testid="regular-read"]').length===5,'Cash setup regular roster');
 for(const [width,height] of [[320,568],[390,844],[1366,768]]){frame.width=String(width);frame.height=String(height);await pause(150);check(doc().documentElement.scrollWidth<=width+1,`Setup overflow at ${width}`);}
 button('[data-view="results"]')!.click();button('[data-view="tournament-stats"]')!.click();frame.width='390';frame.height='844';
 out.textContent=JSON.stringify({status:'PASS',actions,moves,reloaded,result,statsText,widths:[320,390,1366],cashRegulars:5,elapsedMs:performance.now()-start});
 }catch(error){out.textContent=JSON.stringify({status:'FAIL',actions,moves,reloaded,error:String(error)});}})();};
