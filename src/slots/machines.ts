/** Patch 90: the four machines. Reel strips are fixed; the payback shown on each machine is measured in
 * tests/ux90 over millions of spins (Lucky Sevens 94.53% and Triple Diamond 94.58%: computed exactly). */
import type {Machine,Sym} from './engine';

/** A reel strip from symbol counts, spread out by a fixed shuffle so the same symbols do not bunch together. */
function strip(counts:Record<Sym,number>,seed:number):Sym[] {
 const out:Sym[]=[];for(const [s,n] of Object.entries(counts))for(let i=0;i<n;i++)out.push(s);
 let h=seed>>>0;const rnd=(n:number)=>{h=(Math.imul(h^(h>>>15),0x2c1b3c6d)+0x6d2b79f5)>>>0;return h%n;};
 for(let i=out.length-1;i>0;i--){const j=rnd(i+1);[out[i],out[j]]=[out[j],out[i]];}
 return out;
}
const LINES20=[[1,1,1,1,1],[0,0,0,0,0],[2,2,2,2,2],[0,1,2,1,0],[2,1,0,1,2],[0,0,1,2,2],[2,2,1,0,0],[1,0,0,0,1],[1,2,2,2,1],[0,1,1,1,0],[2,1,1,1,2],[1,0,1,2,1],[1,2,1,0,1],[0,1,0,1,0],[2,1,2,1,2],[1,1,0,1,1],[1,1,2,1,1],[0,2,0,2,0],[2,0,2,0,2],[0,2,2,2,0]];
const CLASSIC_SYMBOLS={'7':{label:'Seven',art:'seven',tone:'high'},B3:{label:'Triple bar',art:'bar3',tone:'high'},B2:{label:'Double bar',art:'bar2',tone:'mid'},B1:{label:'Bar',art:'bar1',tone:'mid'},CH:{label:'Cherry',art:'cherry',tone:'low'},'-':{label:'Blank',art:'blank',tone:'blank'},WH:{label:'Bonus wheel',art:'wheel',tone:'bonus'}};

export const MACHINES:readonly Machine[]=[
 {id:'lucky-sevens',name:'Lucky Sevens',tagline:'The classic three-reel, one line. Cherries pay anywhere.',kind:'classic',rtp:94.5,volatility:'medium',stats:{hitRate:27.1,featureEvery:null,swing:2,topSeen:400},rows:3,
  reels:[0,1,2].map(i=>strip({'7':2,B3:3,B2:5,B1:8,CH:6,'-':40},101+i)),lines:[[1,1,1]],
  pays:{'7':[0,0,0,400],B3:[0,0,0,120],B2:[0,0,0,60],B1:[0,0,0,30]},cherry:{sym:'CH',pays:[0,2,8,60]},anyBar:{syms:['B3','B2','B1'],pay:10},
  bets:[25,50,100,200,500],symbols:CLASSIC_SYMBOLS,theme:{top:'#8a1020',bottom:'#2a0408',glow:'#ff5a6a',marquee:'Classic 777'}},
 {id:'wheel-of-riches',name:'Wheel of Riches',tagline:'Five lines of classic reels. Land the wheel in the middle for a bonus spin.',kind:'wheel',rtp:94.8,volatility:'medium',stats:{hitRate:67.8,featureEvery:32,swing:2,topSeen:251},rows:3,
  reels:[strip({'7':3,B3:4,B2:6,B1:9,CH:6,'-':36},201),strip({'7':3,B3:4,B2:6,B1:9,CH:6,'-':36},202),strip({'7':3,B3:4,B2:6,B1:9,CH:6,'-':34,WH:2},203)],
  lines:[[1,1,1],[0,0,0],[2,2,2],[0,1,2],[2,1,0]],
  pays:{'7':[0,0,0,200],B3:[0,0,0,70],B2:[0,0,0,35],B1:[0,0,0,15]},cherry:{sym:'CH',pays:[0,1,2,20]},anyBar:{syms:['B3','B2','B1'],pay:6},
  wheel:{sym:'WH',reel:2,row:1,segments:[{x:5,w:60},{x:8,w:48},{x:10,w:36},{x:15,w:24},{x:20,w:16},{x:30,w:8},{x:50,w:4},{x:100,w:2},{x:250,w:1}]},
  bets:[50,100,250,500,1000],symbols:CLASSIC_SYMBOLS,theme:{top:'#5a1a6a',bottom:'#1a0624',glow:'#ff7ad9',marquee:'Spin the wheel'}},
 {id:'gold-rush',name:'Gold Rush',tagline:'Five reels, twenty lines. Gold is wild; three nuggets start free spins at double pay.',kind:'video',rtp:95.6,volatility:'low',stats:{hitRate:31.8,featureEvery:75,swing:1,topSeen:330},rows:3,
  reels:[strip({nug:2,pick:3,lamp:4,mule:4,A:6,K:7,Q:7,J:8,T:9},301),strip({nug:2,gold:2,pick:3,lamp:4,mule:5,A:6,K:7,Q:7,J:8,T:8},302),strip({nug:2,gold:2,pick:3,lamp:4,mule:5,A:6,K:7,Q:7,J:8,T:8},303),strip({nug:2,gold:2,pick:3,lamp:4,mule:5,A:6,K:7,Q:7,J:8,T:8},304),strip({nug:2,pick:3,lamp:4,mule:4,A:6,K:7,Q:7,J:8,T:9},305)],
  lines:LINES20,wild:'gold',
  pays:{gold:[0,0,0,140,550,2750],pick:[0,0,0,80,275,1350],lamp:[0,0,0,55,165,675],mule:[0,0,0,40,110,400],A:[0,0,0,22,70,275],K:[0,0,0,16,55,220],Q:[0,0,0,14,40,160],J:[0,0,0,11,35,135],T:[0,0,0,8,27,110]},
  scatter:{sym:'nug',pays:{3:3,4:12,5:60},freeSpins:{3:8,4:12,5:20},freeMultiplier:2},
  bets:[20,40,100,200,500],
  symbols:{gold:{label:'Gold bar (wild)',art:'goldWild',tone:'wild'},nug:{label:'Nugget (bonus)',art:'nugget',tone:'bonus'},pick:{label:'Pickaxe',art:'pickaxe',tone:'high'},lamp:{label:'Lantern',art:'lantern',tone:'high'},mule:{label:'Mine cart',art:'cart',tone:'high'},A:{label:'Ace',art:'A',tone:'low'},K:{label:'King',art:'K',tone:'low'},Q:{label:'Queen',art:'Q',tone:'low'},J:{label:'Jack',art:'J',tone:'low'},T:{label:'Ten',art:'T',tone:'low'}},
  theme:{top:'#6b4a0e',bottom:'#2a1c06',glow:'#ffcf4a',marquee:'Strike it rich'}},
 {id:'lucky-lightning',name:'Lucky Lightning',tagline:'Six coins start Hold & Spin: coins stick, every new coin resets three respins. Fill the screen for the Grand.',kind:'hold',rtp:94.1,volatility:'high',stats:{hitRate:33.8,featureEvery:124,swing:5,topSeen:1362},rows:3,
  reels:[0,1,2,3,4].map(i=>strip({coin:7,bolt:i>0&&i<4?2:0,seven:3,bell:4,star:5,A:6,K:7,Q:8,J:9},401+i)),
  lines:LINES20,wild:'bolt',
  pays:{bolt:[0,0,0,50,180,700],seven:[0,0,0,30,100,350],bell:[0,0,0,18,50,180],star:[0,0,0,12,36,120],A:[0,0,0,8,24,70],K:[0,0,0,6,18,60],Q:[0,0,0,5,14,50],J:[0,0,0,4,12,40]},
  coin:{sym:'coin',trigger:6,land:.083,grand:1000,values:[{x:1,w:30},{x:2,w:24},{x:3,w:16},{x:5,w:12},{x:8,w:7},{x:10,w:5},{x:20,w:3,name:'Mini'},{x:50,w:2,name:'Minor'},{x:150,w:1,name:'Major'}]},
  bets:[20,40,100,200,500],
  symbols:{coin:{label:'Coin',art:'coin',tone:'bonus'},bolt:{label:'Lightning (wild)',art:'bolt',tone:'wild'},seven:{label:'Seven',art:'seven',tone:'high'},bell:{label:'Bell',art:'bell',tone:'high'},star:{label:'Star',art:'star',tone:'high'},A:{label:'Ace',art:'A',tone:'low'},K:{label:'King',art:'K',tone:'low'},Q:{label:'Queen',art:'Q',tone:'low'},J:{label:'Jack',art:'J',tone:'low'}},
  theme:{top:'#1b3f7a',bottom:'#070f26',glow:'#7ec8ff',marquee:'Hold & Spin'}},
 {id:'triple-diamond',name:'Triple Diamond',tagline:'Nine classic lines. The diamond is wild and triples every win it touches; two of them pay nine times.',kind:'classic',rtp:94.6,volatility:'medium',stats:{hitRate:48.6,featureEvery:null,swing:3,topSeen:208},rows:3,
  reels:[0,1,2].map(i=>strip({DW:2,'7':3,B3:4,B2:6,B1:8,CH:3,'-':38},501+i)),lines:[[1,1,1],[0,0,0],[2,2,2],[0,1,2],[2,1,0],[0,1,0],[2,1,2],[1,0,1],[1,2,1]],wild:'DW',wildMultiplier:3,
  pays:{DW:[0,0,0,1000],'7':[0,0,0,90],B3:[0,0,0,35],B2:[0,0,0,25],B1:[0,0,0,10]},cherry:{sym:'CH',pays:[0,1,3,8]},anyBar:{syms:['B3','B2','B1'],pay:5},
  bets:[45,90,225,450,900],symbols:{...CLASSIC_SYMBOLS,DW:{label:'Triple diamond (wild ×3)',art:'diamondWild',tone:'wild'}},theme:{top:'#0d4a5a',bottom:'#04161c',glow:'#7af0ff',marquee:'Wilds pay triple'}},
 {id:'dust-devil',name:'Dust Devil',tagline:'1,024 ways to win across five reels of four. Sunsets start free spins where every sheriff star is a ×2 or ×3 wild.',kind:'ways',rtp:94.8,volatility:'medium',stats:{hitRate:55.3,featureEvery:49,swing:3,topSeen:403},rows:4,
  reels:[0,1,2,3,4].map(i=>strip({sunset:2,sheriff:i>0&&i<4?3:0,hat:3,boot:4,horseshoe:4,wagon:5,cactus:5,A:6,K:6,Q:7,J:7,T:8},601+i)),lines:[],wild:'sheriff',
  ways:{betUnit:50,freeWild:[{x:2,w:3},{x:3,w:1}]},
  pays:{hat:[0,0,0,33,88,275],boot:[0,0,0,22,55,165],horseshoe:[0,0,0,16,44,132],wagon:[0,0,0,11,28,88],cactus:[0,0,0,9,22,66],A:[0,0,0,4,11,33],K:[0,0,0,4,11,33],Q:[0,0,0,3,9,22],J:[0,0,0,3,9,22],T:[0,0,0,2,7,16]},
  scatter:{sym:'sunset',pays:{3:2.5,4:10,5:50},freeSpins:{3:8,4:15,5:20},freeMultiplier:1},
  bets:[40,80,200,400,800],
  symbols:{sheriff:{label:'Sheriff star (wild)',art:'sheriff',tone:'wild'},sunset:{label:'Sunset (bonus)',art:'sunset',tone:'bonus'},hat:{label:'Hat',art:'hat',tone:'high'},boot:{label:'Boot',art:'boot',tone:'high'},horseshoe:{label:'Horseshoe',art:'horseshoe',tone:'high'},wagon:{label:'Wagon wheel',art:'wagon',tone:'high'},cactus:{label:'Cactus',art:'cactus',tone:'high'},A:{label:'Ace',art:'A',tone:'low'},K:{label:'King',art:'K',tone:'low'},Q:{label:'Queen',art:'Q',tone:'low'},J:{label:'Jack',art:'J',tone:'low'},T:{label:'Ten',art:'T',tone:'low'}},
  theme:{top:'#8a3a10',bottom:'#2a0e04',glow:'#ffb347',marquee:'1,024 ways'}},
 {id:'gem-cascade',name:'Gem Cascade',tagline:'Eight or more of a gem anywhere pay. Winners shatter and new gems tumble in. Bombs multiply the whole cascade.',kind:'cascade',rtp:94.3,volatility:'medium',stats:{hitRate:28.4,featureEvery:150,swing:4,topSeen:1198},rows:5,
  reels:[0,1,2,3,4,5].map(i=>['ruby','emerald','sapphire','amethyst','topaz','diamond'].map((_,k,a)=>a[(i+k)%a.length]).slice(0,5)),lines:[],
  cascade:{weights:[{sym:'ruby',w:6},{sym:'emerald',w:7},{sym:'sapphire',w:8},{sym:'amethyst',w:9},{sym:'topaz',w:10},{sym:'citrine',w:11},{sym:'onyx',w:12},{sym:'pearl',w:13},{sym:'diamond',w:2}],tiers:[8,10,12],bomb:{w:1,values:[{x:2,w:40},{x:3,w:25},{x:5,w:15},{x:10,w:10},{x:25,w:5},{x:50,w:3},{x:100,w:1}]}},
  pays:{ruby:[4,10,20],emerald:[1.6,4,10],sapphire:[1.2,2.4,6],amethyst:[.8,1.6,4.8],topaz:[.6,1.2,4],citrine:[.4,.8,2],onyx:[.28,.55,1.5],pearl:[.18,.38,1]},
  scatter:{sym:'diamond',pays:{4:3,5:5,6:100},freeSpins:{4:10,5:10,6:10},freeMultiplier:1},
  bets:[20,40,100,200,500],
  symbols:{ruby:{label:'Ruby',art:'ruby',tone:'high'},emerald:{label:'Emerald',art:'emerald',tone:'high'},sapphire:{label:'Sapphire',art:'sapphire',tone:'high'},amethyst:{label:'Amethyst',art:'amethyst',tone:'mid'},topaz:{label:'Topaz',art:'topaz',tone:'mid'},citrine:{label:'Citrine',art:'citrine',tone:'mid'},onyx:{label:'Onyx',art:'onyx',tone:'low'},pearl:{label:'Pearl',art:'pearl',tone:'low'},diamond:{label:'Diamond (bonus)',art:'diamond',tone:'bonus'},bomb:{label:'Multiplier bomb',art:'bomb',tone:'bonus'}},
  theme:{top:'#3a0f6a',bottom:'#0e0420',glow:'#c07aff',marquee:'Tumbling gems'}},
 {id:'pirates-plunder',name:"Pirate's Plunder",tagline:'Twenty lines on the high seas. Three treasure maps open the chest bonus: pick three chests.',kind:'pick',rtp:95.2,volatility:'low',stats:{hitRate:28.2,featureEvery:115,swing:1,topSeen:105},rows:3,
  reels:[0,1,2,3,4].map(i=>strip({map:i%2===0?2:0,helm:i>0&&i<4?2:0,chest:3,compass:4,anchor:4,coin:5,A:6,K:6,Q:7,J:7,T:8},701+i)),lines:LINES20,wild:'helm',
  pays:{helm:[0,0,0,184,690,2760],chest:[0,0,0,115,345,1380],compass:[0,0,0,69,207,690],anchor:[0,0,0,57,161,506],coin:[0,0,0,46,115,368],A:[0,0,0,23,69,230],K:[0,0,0,23,57,207],Q:[0,0,0,18,46,161],J:[0,0,0,14,37,138],T:[0,0,0,12,32,115]},
  pick:{sym:'map',trigger:3,picks:3,board:12,prizes:[{x:2,w:14},{x:3,w:21},{x:5,w:20},{x:8,w:12},{x:10,w:8},{x:15,w:5},{x:25,w:3},{x:50,w:1}]},
  bets:[20,40,100,200,500],
  symbols:{helm:{label:"Ship's wheel (wild)",art:'helm',tone:'wild'},map:{label:'Treasure map (bonus)',art:'map',tone:'bonus'},chest:{label:'Treasure chest',art:'chest',tone:'high'},compass:{label:'Compass',art:'compass',tone:'high'},anchor:{label:'Anchor',art:'anchor',tone:'high'},coin:{label:'Doubloon',art:'coin',tone:'high'},A:{label:'Ace',art:'A',tone:'low'},K:{label:'King',art:'K',tone:'low'},Q:{label:'Queen',art:'Q',tone:'low'},J:{label:'Jack',art:'J',tone:'low'},T:{label:'Ten',art:'T',tone:'low'}},
  theme:{top:'#0e3a4a',bottom:'#04141c',glow:'#4adfd0',marquee:'Pick a chest'}},
];
export const machineById=(id:string)=>MACHINES.find(m=>m.id===id);
