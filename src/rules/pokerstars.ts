import type {RuleProfile} from '../contracts';
import type {VersionedRake} from './rake';

/** Pinned source snapshot, not a promise of future rates or a venue endorsement. */
export const POKERSTARS_SOURCE={
 url:'https://www.pokerstars.com/poker/room/rake/?no_redirect=1',
 retrievedAt:'2026-11-01',currency:'USD',format:'regular-nlhe',
} as const;
export const POKERSTARS_PROFILE_VERSION='2026-11-01';
/** Cents, basis points, then two / three-four / five-plus dealt-in caps. */
export const POKERSTARS_USD_SCHEDULE:readonly (readonly [number,number,number,number,number,number])[]=[
 [1,2,500,100,100,100],[2,5,500,100,100,100],[5,10,500,100,100,100],
 [10,25,450,50,100,200],[25,50,500,75,75,200],[50,100,500,100,100,250],
 [100,200,500,125,125,275],[200,400,500,150,150,300],[250,500,500,150,150,300],
 [300,600,500,150,150,350],[500,1000,450,150,150,300],[1000,2000,450,175,175,300],
 [2500,5000,450,225,200,300],[5000,10000,450,250,300,500],[10000,20000,450,300,500,500],
];

/** Only exact verified USD regular NLHE stakes. Zoom/other currencies unsupported. */
export function pokerStarsProfile(smallBlind:number,bigBlind:number):RuleProfile {
 const row=POKERSTARS_USD_SCHEDULE.find(([small,big])=>small===smallBlind&&big===bigBlind);
 if(!row)throw new Error('PokerStars snapshot supports only its listed USD regular NLHE stakes');
 const rake:VersionedRake={basisPoints:row[2],cap:row[5],noFlopNoDrop:true,rounding:'half-even',
  capByDealtIn:{two:row[3],threeFour:row[4],fivePlus:row[5]},source:{...POKERSTARS_SOURCE}};
 return {id:'pokerstars-com-usd-regular-nlhe',version:POKERSTARS_PROFILE_VERSION,mode:'cash',smallBlind,bigBlind,chipUnit:1,rake,
  shortRaiseReopens:'cumulative',oddChipOrder:'clockwise-from-button'};
}
