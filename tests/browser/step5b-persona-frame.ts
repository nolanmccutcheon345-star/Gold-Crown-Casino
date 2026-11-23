import {appliedProvenance} from './step5e-applied-provenance';
import {mountApp} from '../../src/ui/app';
import {SessionController} from '../../src/session/controller';
import {projectView,assertAccounting} from '../../src/core/engine';
import {OPPONENT_LABELS} from '../../src/ui/opponent-setup';
import {GateMemoryPort} from './step5b-gates-fixtures';
import type {OpponentConfig} from '../../src/contracts';

// This test accesses private metadata only to assert absence/stability. Reports
// contain public selections and booleans, never seeds or latent parameters.
const scenario=new URLSearchParams(location.search).get('case')!,port=new GateMemoryPort();let controller=new SessionController(port);
const checks:string[]=[];const details:Record<string,unknown>={scenario,storage:'isolated memory',checks};
function assert(value:unknown,message:string):asserts value {if(!value)throw Error(message);}
const delay=(ms:number)=>new Promise(resolve=>setTimeout(resolve,ms));
async function ready(test=()=>controller.status==='ready'&&!controller.busy){for(let i=0;i<300;i++){if(test()&&!controller.busy&&!document.querySelector('.save-status')?.textContent?.includes('Saving'))return;await delay(20);}throw Error('UI/controller readiness timeout');}
function get<T extends HTMLElement=HTMLElement>(selector:string):T{const el=document.querySelector<T>(selector);assert(el,`Missing ${selector}`);return el;}
function click(selector:string){const el=get<HTMLButtonElement>(selector);assert(!el.disabled,`Disabled ${selector}`);el.click();}
function set(selector:string,value:string,type='change'){const el=get<HTMLInputElement|HTMLSelectElement>(selector);assert(!el.disabled,`Disabled ${selector}`);el.value=value;el.dispatchEvent(new Event(type,{bubbles:true}));}
function noPrivateKeys(value:unknown){if(!value||typeof value!=='object')return;for(const [key,child] of Object.entries(value)){assert(!['privateProfiles','profiles','personalityId','personalitySeed','archetype','traits','skill','aggression','looseness','deck','deckCursor','burned','drawToken','diagnostics','ranges','distribution'].includes(key),`Private key reached public output: ${key}`);noPrivateKeys(child);}}
function privateDomAbsent(){const html=get('#app').innerHTML;for(const profile of Object.values(controller.data?.active?.profiles??{})){assert(!profile.personalityId||!html.includes(profile.personalityId),'Private personality identity in DOM');}assert(!/personalitySeed|data-archetype|data-private-profile/.test(html),'Private metadata attribute in DOM');}
async function finishHand(){click('[data-view="live"]');set('#pace','250');for(let i=0;i<2500;i++){const game=controller.data?.active?.game;assert(game,'Active hand vanished');if(game.street==='complete'){await ready();return;}if(game.actor===0&&!controller.busy&&!get<HTMLButtonElement>('#fold').disabled)click('#fold');await delay(25);}throw Error('Actual bot hand did not finish');}
try{
 mountApp(get('#app'),controller);await ready();click('#configure');set('#seat-count',scenario==='unknown-random'?'8':'9');click('#randomize-lineup');
 const choices:OpponentConfig['selection'][]=scenario==='unknown-random'?['nit','tag','lag','station','maniac','random','unknown']:['nit','tag','lag','station','maniac','fit-or-fold','passive-reg','stronger-reg'];
 for(const [index,selection] of choices.entries())set(`#opponent-${index+1}-selection`,selection);
 const population=scenario.startsWith('high')?'high':scenario.startsWith('mid')?'mid':'low';
 const stake=scenario==='low-13'?'1':scenario==='mid-25'?'2':scenario==='high-510'?'3':'0';set('#population',population);set('#stake-select',stake);set('#buy-in','300','input');
 for(const [index,selection] of choices.entries()){const select=get<HTMLSelectElement>(`#opponent-${index+1}-selection`);assert(select.value===selection&&select.selectedOptions[0].textContent===OPPONENT_LABELS[selection],'Selected known/Random/Unknown label is incorrect');}
 assert(document.querySelectorAll('[data-evidence-tier="DESIGNED"]').length===choices.length,'Persona evidence tier is not DESIGNED for every initial card');
 assert(get('.opponent-explainer').textContent?.includes('synthetic style mixes, not measured player pools'),'Population evidence disclaimer missing');
 assert([...document.querySelectorAll('.draw-curves')].every(el=>el.textContent?.includes('synthetic inclination adjustment')),'Street/draw node provenance missing');
 privateDomAbsent();checks.push('Actual Host choices and DESIGNED status correct for every configured persona; nodes and populations explicitly synthetic');
 click('#setup-form button[type="submit"]');await ready(()=>!!controller.data?.active&&!controller.busy);click('#pause');await ready(()=>!!controller.data?.active?.paused&&!controller.busy);
 const active=controller.data!.active!,session=controller.data!.sessions.find(s=>s.id===active.sessionId)!,profileSnapshot=JSON.stringify(active.profiles);
 assert(session.settings.population===population,'Population not persisted');assert(JSON.stringify(session.settings.opponents!.slice(0,choices.length).map(c=>c.selection))===JSON.stringify(choices),'Selected lineup not persisted');
 assert(Object.values(active.profiles).every(profile=>profile.environment===population),'Resolved population differs from selected environment');
 const publicView=projectView(active.game,0);noPrivateKeys(publicView);assert(publicView.seats.filter(seat=>seat.id!==0).every(seat=>seat.hole.length===0),'Opponent hole cards exposed during active hand');
 assert(!document.querySelector('[data-opponent-selection]')&&!document.querySelector('[data-evidence-tier]'),'Host style parameters exposed on Live table');privateDomAbsent();
 checks.push('Active Hero projection, Live DOM and tooltips conceal latent identities, seeds and opponent cards');
 click('[data-view="opponents"]');assert(!!document.querySelector('[data-testid="opponent-study-locked"]')&&!document.querySelector('#reveal-session-styles'),'Active hand permits style reveal');
 click('[data-view="host"]');for(const [index,selection] of choices.entries())assert(get<HTMLSelectElement>(`#opponent-${index+1}-selection`).value===selection,'Host editor resolved a concealed choice');privateDomAbsent();
 click('[data-view="live"]');assert(JSON.stringify(controller.data!.active!.profiles)===profileSnapshot,'Navigation changed stable personalities');
 // Actual isolated reload of the committed session, then continue through UI.
 controller.close();controller=new SessionController(port);mountApp(get('#app'),controller);await ready();assert(JSON.stringify(controller.data!.active!.profiles)===profileSnapshot,'Reload changed stable personalities');
 click('#pause');await ready(()=>!controller.data!.active!.paused&&!controller.busy);await finishHand();
 if(scenario==='unknown-random'){click('#next-hand');await ready(()=>controller.data!.active!.number===2&&!controller.busy);assert(JSON.stringify(controller.data!.active!.profiles)===profileSnapshot,'Random/Unknown profile changed between hands');await finishHand();}
 const endedGame=controller.data!.active!.game;assertAccounting(endedGame);checks.push('Actual bot hands completed; personality identities/policy versions stable across navigation, reload and next hand');
 click('[data-view="opponents"]');assert(!document.querySelector('#reveal-session-styles'),'Still-seated completed session allows style reveal');privateDomAbsent();
 click('[data-view="study"]');click('#export-history');await ready(()=>!!document.querySelector('#view-export'));click('#view-export');
 const exported=JSON.parse(get<HTMLTextAreaElement>('#export-json').value);noPrivateKeys(exported);assert(exported.hands.length===controller.data!.hands.length,'UI export omitted completed hands');
 const exportedBefore=JSON.stringify(exported),historyBefore=JSON.stringify(controller.data!.hands);checks.push('Actual UI history export contains permitted redacted records and policy versions only');
 click('#new-session');click('#end-complete');await ready(()=>!controller.data!.active&&!controller.busy);assert(!!controller.data!.sessions.find(s=>s.id===session.id)?.endedAt,'Session did not close durably');
 const financial=JSON.stringify({wallet:controller.data!.wallet,ledger:controller.data!.ledger,hands:controller.data!.hands});
 click('[data-view="opponents"]');assert(!document.querySelector('[data-testid="revealed-session-styles"]'),'Post-session style insight revealed without opt-in');
 const oldReveal=get<HTMLButtonElement>('#reveal-session-styles');click('#reveal-session-styles');
 const shown=[...document.querySelectorAll<HTMLElement>('[data-insight-seat]')];
 if(scenario==='unknown-random'){assert(shown.length===2,'Expected only original Unknown and unchanged Random styles');for(const el of shown){const id=Number(el.dataset.insightSeat);assert([6,7].includes(id),'Unrequested private style in insight');assert(el.textContent!.includes(OPPONENT_LABELS[controller.data!.hands[0].privateProfiles[id].archetype]),'Insight does not match immutable starting record');}}
 assert(!/personalitySeed|personalityId|drawToken|data-private-profile/.test(get('[data-testid="revealed-session-styles"]').innerHTML),'Post-session insight leaks private parameters');
 assert(JSON.stringify({wallet:controller.data!.wallet,ledger:controller.data!.ledger,hands:controller.data!.hands})===financial,'Style insight mutated financial or canonical history');
 assert(JSON.stringify(await controller.exportHistory())===exportedBefore&&JSON.stringify(controller.data!.hands)===historyBefore,'Opt-in changed public export or canonical hands');
 checks.push('Explicit ended-session opt-in reveals only recorded style labels, leaving cards, private parameters, exports, history and money unchanged');
 click('#reveal-session-styles');click('[data-view="host"]');oldReveal.click();assert(!document.querySelector('[data-testid="revealed-session-styles"]'),'Detached reveal button activated outside selected Study view');
 if(scenario==='unknown-random'){
  click('#setup-form button[type="submit"]');await ready(()=>!!controller.data?.active&&!controller.busy);oldReveal.click();assert(!document.querySelector('[data-testid="revealed-session-styles"]'),'Stale ended-session button revealed styles in new active session');
  click('#pause');await ready(()=>!!controller.data!.active!.paused&&!controller.busy);click('[data-view="opponents"]');oldReveal.click();assert(!!document.querySelector('[data-testid="opponent-study-locked"]')&&!document.querySelector('[data-testid="revealed-session-styles"]'),'Stale button bypassed active-hand lock');
 }
 details.appliedProvenance=appliedProvenance(controller.data,`persona:${scenario}`,`Fresh isolated ${scenario}; ordinary UI selections above; normal CSPRNG cards, no predetermined winning deal.`);details.publicSelections=choices;details.population=population;details.completedHands=controller.data!.hands.length;details.ruleVersion=session.profile.version;details.rake=session.profile.rake;details.syntheticStatus='DESIGNED';details.historicalPopulationChangeStats='NOT_IMPLEMENTED — separate V514 gap';details.noPrivateDataInReport=true;
 parent.postMessage({kind:'step5b-persona-result',result:{status:'PASS',...details}},location.origin);
}catch(error){parent.postMessage({kind:'step5b-persona-result',result:{status:'FAIL',...details,error:(error as Error).message}},location.origin);}
