/** Patch 52: optional table sounds, made with Web Audio (no sound files). Off by default; never affects play. */
import type {HeroViewModel} from '../contracts';
import type {PloHand} from '../plo/engine';

/** The public parts of a hand that sounds react to. */
type TableView=Pick<HeroViewModel,'handId'|'street'|'events'|'payouts'>;
export type SoundKind='deal'|'card'|'chip'|'check'|'fold'|'turn'|'win'|
 /* Patch 80 */'allin'|'collect'|'shuffle'|'blackjack'|'bust'|'push'|'lose'|'flip'|
 /* Patch 83 */'levelup'|'money'|'champion'|'knockout'|'promo'|'matchwin'|'matchlose'|'tap'|
 /* Patch 92: slots */'reel'|'anticipate'|'bigwin'|'bells'|
 /* Patch 102: casino tables */'ballroll'|'balldrop'|'dice'|'cardsnap'|'bugle'|'crowd';
/** Patch 102: every sound the casino tables use, for checking that each one has a voice. */
export const CASINO_KINDS:readonly SoundKind[]=['ballroll','balldrop','dice','cardsnap','bugle','crowd','chip','shuffle','money','win','fold'];
export interface SoundState {handId:string;street:string;events:number;heroTurn:boolean;heroWon:boolean}

export const soundState=(view:TableView|null|undefined,heroTurn:boolean):SoundState|null=>view?{handId:view.handId,street:view.street,events:view.events.length,heroTurn,heroWon:view.street==='complete'&&(view.payouts[0]??0)>0}:null;

/**
 * What changed between two renders, as sounds. Nothing plays for the first render, after a page change, or when
 * many events arrive at once (a restored session or a skipped stretch), so sounds never pile up.
 */
export function soundCues(prev:SoundState|null,next:SoundState|null,view:TableView|null|undefined):SoundKind[] {
 if(!prev||!next||!view)return [];
 if(prev.handId!==next.handId)return next.heroTurn?['deal','turn']:['deal'];
 const fresh=view.events.slice(prev.events);
 if(fresh.length>4)return [];
 const cues:SoundKind[]=[];
 for(const event of fresh){
  if(event.type==='street')cues.push('card');
  else if(event.type==='action'&&event.action){const type=event.action.type,seats=(view as {seats?:readonly {id:number;stack:number}[]}).seats,actor=seats?.find(x=>x.id===event.seatId);cues.push(type==='raise'&&actor&&actor.stack===0?'allin':type==='raise'||type==='call'?'chip':type==='check'?'check':'fold');}
  else if(event.type==='award'&&!next.heroWon)cues.push('collect');
 }
 if(next.heroWon&&!prev.heroWon)cues.push('win');
 else if(next.heroTurn&&!prev.heroTurn)cues.push('turn');
 return [...new Set(cues)].slice(0,3);
}

let context:AudioContext|null=null,master:GainNode|null=null,volume=.7;
/** Patch 80: one volume for every sound, 0 to 1. */
export function setVolume(level:number):void {volume=Math.max(0,Math.min(1,Number.isFinite(level)?level:.7));if(master&&context)master.gain.setValueAtTime(volume,context.currentTime);}
const out=()=>{const ctx=context!;if(!master){master=ctx.createGain();master.gain.value=volume;master.connect(ctx.destination);}return master;};
/** Browsers only allow audio after a tap or click, so this runs from the player's own input. */
export function unlockAudio():void {
 try{
  const Ctor=(globalThis as {AudioContext?:typeof AudioContext;webkitAudioContext?:typeof AudioContext}).AudioContext??(globalThis as {webkitAudioContext?:typeof AudioContext}).webkitAudioContext;
  if(!Ctor)return;
  context??=new Ctor();
  if(context.state==='suspended')void context.resume();
 }catch{/* no audio on this device */}
}

function tone(at:number,frequency:number,duration:number,volume:number,type:OscillatorType='sine'):void {
 const ctx=context!;const osc=ctx.createOscillator(),gain=ctx.createGain();
 osc.type=type;osc.frequency.setValueAtTime(frequency,at);
 gain.gain.setValueAtTime(0.0001,at);gain.gain.exponentialRampToValueAtTime(volume,at+0.008);gain.gain.exponentialRampToValueAtTime(0.0001,at+duration);
 osc.connect(gain).connect(out());osc.start(at);osc.stop(at+duration+0.02);
}
function swish(at:number,duration:number,volume:number,low=1800):void {
 const ctx=context!;const length=Math.max(1,Math.floor(ctx.sampleRate*duration));
 const buffer=ctx.createBuffer(1,length,ctx.sampleRate),data=buffer.getChannelData(0);
 for(let i=0;i<length;i++)data[i]=(Math.random()*2-1)*(1-i/length);
 const source=ctx.createBufferSource(),filter=ctx.createBiquadFilter(),gain=ctx.createGain();
 source.buffer=buffer;filter.type='bandpass';filter.frequency.value=low;filter.Q.value=.8;gain.gain.value=volume;
 source.connect(filter).connect(gain).connect(out());source.start(at);
}
/** Shaped noise: a swell up over `attack` seconds, then a fade to the end. */
function rumble(at:number,duration:number,volume:number,freq:number,q:number,attack:number):void {
 const ctx=context!;const length=Math.max(1,Math.floor(ctx.sampleRate*duration));
 const buffer=ctx.createBuffer(1,length,ctx.sampleRate),data=buffer.getChannelData(0);
 for(let i=0;i<length;i++)data[i]=Math.random()*2-1;
 const source=ctx.createBufferSource(),filter=ctx.createBiquadFilter(),gain=ctx.createGain();
 source.buffer=buffer;filter.type='bandpass';filter.frequency.value=freq;filter.Q.value=q;
 gain.gain.setValueAtTime(0.0001,at);gain.gain.exponentialRampToValueAtTime(volume,at+attack);gain.gain.exponentialRampToValueAtTime(0.0001,at+duration);
 source.connect(filter).connect(gain).connect(out());source.start(at);source.stop(at+duration+.05);
}
export function playSound(kind:SoundKind,delay=0):void {
 if(!context||context.state!=='running')return;
 const t=context.currentTime+delay;
 switch(kind){
  case 'deal':swish(t,.07,.35);swish(t+.09,.07,.35);break;
  case 'card':swish(t,.08,.4,2400);break;
  case 'chip':tone(t,2350,.05,.12,'triangle');tone(t+.035,2800,.06,.1,'triangle');break;
  case 'check':tone(t,190,.07,.22);tone(t+.09,170,.07,.18);break;
  case 'fold':swish(t,.12,.18,900);break;
  case 'turn':tone(t,660,.16,.09,'triangle');tone(t+.13,880,.22,.08,'triangle');break;
  case 'win':[523,659,784,1047].forEach((f,i)=>tone(t+i*.08,f,.22,.08,'triangle'));break;
  // Patch 80.
  case 'allin':tone(t,110,.25,.25);tone(t+.02,220,.18,.12,'triangle');[2300,2500,2700,2900].forEach((f,i)=>tone(t+.12+i*.03,f,.05,.08,'triangle'));break;
  case 'collect':for(let i=0;i<6;i++)tone(t+i*.045,2200+((i*317)%600),.05,.07,'triangle');break;
  case 'shuffle':for(let i=0;i<8;i++)swish(t+i*.035,.03,.18,2600+i*80);break;
  case 'blackjack':[659,784,988,1319].forEach((f,i)=>tone(t+i*.07,f,.26,.09,'triangle'));tone(t+.3,1568,.4,.06,'sine');break;
  case 'bust':tone(t,330,.16,.12,'sawtooth');tone(t+.14,247,.28,.1,'sawtooth');break;
  case 'push':tone(t,440,.12,.08,'triangle');tone(t+.12,440,.12,.07,'triangle');break;
  case 'lose':tone(t,262,.22,.08);tone(t+.16,196,.32,.07);break;
  case 'flip':swish(t,.06,.35,3200);break;
  // Patch 83: event stings and a button click.
  case 'levelup':tone(t,392,.18,.08,'triangle');tone(t+.16,523,.28,.08,'triangle');break;
  case 'money':[523,659,784].forEach((f,i)=>tone(t+i*.09,f,.3,.08,'triangle'));for(let i=0;i<5;i++)tone(t+.3+i*.04,2400+i*90,.05,.06,'triangle');break;
  case 'champion':[523,659,784,1047,784,1047,1319].forEach((f,i)=>tone(t+i*.11,f,i===6?.7:.22,.09,'triangle'));break;
  case 'knockout':tone(t,294,.3,.09,'triangle');tone(t+.25,220,.5,.08,'triangle');break;
  case 'promo':for(let i=0;i<10;i++)tone(t+i*.05,1500+((i*233)%900),.06,.06,'triangle');[784,1047,1319].forEach((f,i)=>tone(t+.5+i*.1,f,.35,.08,'sine'));break;
  case 'matchwin':[392,523,659,784,1047].forEach((f,i)=>tone(t+i*.1,f,.3,.09,'triangle'));break;
  case 'matchlose':[392,349,330,262].forEach((f,i)=>tone(t+i*.14,f,.3,.07,'sine'));break;
  case 'tap':tone(t,1800,.025,.05,'square');break;
  // Patch 92: a reel thudding to a stop, a rising whirr while a reel holds back for a bonus, and a big-win fanfare.
  case 'reel':tone(t,140,.06,.18,'triangle');swish(t,.04,.25,1400);break;
  case 'anticipate':for(let i=0;i<8;i++)tone(t+i*.09,330+i*70,.11,.05,'sawtooth');break;
  // Patch 102: the casino tables.
  // The ball rolling round the rim, slowing: a low whirr and ticks that spread out.
  case 'ballroll':rumble(t,3.6,.09,420,1.2,.3);for(let i=0,at=0;i<22;i++){at+=.06+i*.0075;tone(t+at,2600-i*35,.02,.035,'triangle');}break;
  // The ball dropping off the cone and clattering over the frets into a pocket.
  case 'balldrop':[0,.09,.16,.24,.3,.37,.42,.5].forEach((d,i)=>tone(t+d,3100-((i*523)%900),.03,.09-i*.008,'square'));tone(t+.62,1900,.05,.03,'triangle');break;
  // Dice shaken, thrown, rattling across the felt and hitting the back wall.
  case 'dice':for(let i=0;i<7;i++)tone(t+i*.045,1100+((i*389)%700),.025,.08,'square');swish(t+.33,.16,.25,1200);[.5,.58,.63].forEach((d,i)=>tone(t+d,180-i*25,.07,.22-i*.05,'triangle'));tone(t+.5,1300,.03,.1,'square');break;
  // A card snapped onto the felt.
  case 'cardsnap':swish(t,.05,.4,3400);tone(t+.04,240,.04,.12,'triangle');break;
  // "Call to post": a short bugle call on the open notes of the horn.
  case 'bugle':[[392,.12],[523,.12],[659,.12],[784,.24],[659,.12],[784,.12],[659,.12],[523,.36]].reduce((at,[f,d])=>{tone(t+at,f,d*.95,.07,'sawtooth');tone(t+at,f*2,d*.9,.02,'triangle');return at+d;},0);break;
  // The crowd roaring down the stretch.
  case 'crowd':rumble(t,2.8,.16,700,.6,.9);rumble(t+.2,2.4,.08,1500,.9,.8);break;
  case 'bigwin':[523,659,784,1047,1319,1047,1319,1568].forEach((f,i)=>tone(t+i*.12,f,i===7?.8:.22,.09,'triangle'));for(let i=0;i<14;i++)tone(t+.4+i*.06,2200+((i*277)%900),.05,.05,'triangle');break;
  // Phase 6: a peal of slot bells for the free-spins trigger — bright sine strikes with the
  // inharmonic partial a real bell carries, rung in a rising then answering pattern.
  case 'bells':[1568,2093,2637,2093,1568,2093,2637,3136].forEach((f,i)=>{tone(t+i*.13,f,1.1,.055,'sine');tone(t+i*.13,f*2.76,.5,.014,'sine');});break;
 }
}
export const playCues=(cues:readonly SoundKind[]):void=>cues.forEach((kind,index)=>playSound(kind,index*.12));

/** Phone vibration (Android browsers; iPhone browsers have no vibration API). Turn: one short buzz; win: two. */
export const canVibrate=():boolean=>typeof navigator!=='undefined'&&typeof navigator.vibrate==='function';
export function vibrateFor(cues:readonly SoundKind[]):void {
 if(!canVibrate())return;
 try{if(cues.includes('win'))navigator.vibrate([30,60,30]);else if(cues.includes('turn'))navigator.vibrate(40);}catch{/* not allowed here */}
}

/* Patch 80: Omaha and blackjack sounds, worked out the same way: from what changed between two screens. */
export interface PloSoundState {handId:string;events:number;heroTurn:boolean;heroWon:boolean}
export const ploSoundState=(h:PloHand|null|undefined,heroTurn:boolean):PloSoundState|null=>h?{handId:h.handId,events:h.events.length,heroTurn,heroWon:h.street==='complete'&&(h.payouts[0]??0)>0}:null;
export function ploSoundCues(prev:PloSoundState|null,next:PloSoundState|null,h:PloHand|null|undefined):SoundKind[] {
 if(!prev||!next||!h)return [];
 if(prev.handId!==next.handId)return next.heroTurn?['shuffle','deal','turn']:['shuffle','deal'];
 const fresh=h.events.slice(prev.events);if(fresh.length>6)return [];
 const cues:SoundKind[]=[];
 for(const e of fresh){
  if(e.kind==='street')cues.push('card');
  else if(e.kind==='action'&&e.action){const t=e.action.type,seat=h.seats.find(x=>x.id===e.seatId);cues.push(t==='raise'&&seat?.allIn?'allin':t==='raise'||t==='call'?'chip':t==='check'?'check':'fold');}
  else if(e.kind==='award'&&!next.heroWon)cues.push('collect');
 }
 if(next.heroWon&&!prev.heroWon)cues.push('win');else if(next.heroTurn&&!prev.heroTurn)cues.push('turn');
 return [...new Set(cues)].slice(0,3);
}
export interface BjSoundState {roundId:string|null;cards:number;settled:boolean;outcome:string|null;shoe:number}
/** Blackjack: new cards on the felt, and your result when the round settles. */
export function bjSoundCues(prev:BjSoundState|null,next:BjSoundState|null):SoundKind[] {
 if(!prev||!next)return [];
 if(next.shoe>prev.shoe+20)return ['shuffle'];
 if(!next.roundId)return [];
 if(prev.roundId!==next.roundId)return ['deal'];
 const cues:SoundKind[]=[];
 if(next.cards>prev.cards)cues.push(next.cards-prev.cards>2?'deal':'card');
 if(next.settled&&!prev.settled&&next.outcome)cues.push(next.outcome==='blackjack'?'blackjack':next.outcome==='win'?'win':next.outcome==='push'?'push':next.outcome==='bust'?'bust':'lose');
 return cues.slice(0,2);
}

/* Patch 83: an optional card-room murmur. Very quiet filtered noise with a slow swell, plus a distant chip clack now and
 * then. It runs only while you are at a table with Sound and Ambience on, and stops when the page is hidden. */
let room:{source:AudioBufferSourceNode;gain:GainNode;timer:number}|null=null;
export function ambience(on:boolean):void {
 if(!on||!context||context.state!=='running'){if(room){try{room.source.stop();}catch{/* already stopped */}clearInterval(room.timer);room=null;}return;}
 if(room)return;
 const ctx=context,seconds=4,length=ctx.sampleRate*seconds,buffer=ctx.createBuffer(1,length,ctx.sampleRate),data=buffer.getChannelData(0);
 let b0=0,b1=0,b2=0;for(let i=0;i<length;i++){const w=Math.random()*2-1;b0=.997*b0+w*.029;b1=.985*b1+w*.032;b2=.95*b2+w*.048;data[i]=(b0+b1+b2)*.22*(1+.25*Math.sin(2*Math.PI*i/length));}
 const source=ctx.createBufferSource(),filter=ctx.createBiquadFilter(),gain=ctx.createGain();
 source.buffer=buffer;source.loop=true;filter.type='lowpass';filter.frequency.value=650;gain.gain.value=.05;
 source.connect(filter).connect(gain).connect(out());source.start();
 const timer=setInterval(()=>{if(!context||context.state!=='running'||Math.random()<.45)return;const at=context.currentTime+Math.random()*.4;tone(at,2600+Math.random()*700,.04,.012,'triangle');tone(at+.03,2900+Math.random()*500,.04,.01,'triangle');},2200) as unknown as number;
 room={source,gain,timer};
}
export const ambienceOn=()=>!!room;
