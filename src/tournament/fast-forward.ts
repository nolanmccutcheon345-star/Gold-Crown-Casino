import type {TournamentController} from './controller';
/** No simulated standings: every remaining action goes through the usual durable controller. */
export async function fastForwardTournament(controller:TournamentController,keepGoing:()=>boolean,yieldToUI:()=>Promise<void>=()=>new Promise(resolve=>setTimeout(resolve,0))):Promise<number>{
 if(controller.data?.active?.status!=='hero-out')throw Error('Fast-forward is available only after you are eliminated.');
 let steps=0;
 while(keepGoing()){
  const event=controller.data?.active;
  if(!event||event.status==='complete'||event.paused||controller.status!=='ready'||controller.busy)break;
  if(event.status!=='hero-out'||event.game.actor===0)throw Error('Fast-forward cannot make Hero decisions.');
  const before=controller.data!.revision;
  if(event.game.street==='complete')await controller.nextHand();
  else {await controller.prepareBot();const current=controller.data?.active;
   if(keepGoing()&&controller.status==='ready'&&current&&!current.paused&&current.pending?.decision)await controller.commitBot(current.game.handId,current.game.revision);
  }
  if(controller.data!.revision===before){if(controller.error)throw Error(controller.error);break;}
  steps++;await yieldToUI();
 }
 return steps;
}
