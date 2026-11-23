import { describe,expect,it } from 'vitest';
import { layoutRectangles,perimeterLayout,shortPerimeterLayout,SHORT_TABLE_HEIGHT } from '../../src/ui/table-layout';
const overlap=(a:{x:number;y:number;width:number;height:number},b:{x:number;y:number;width:number;height:number})=>
 Math.min(a.x+a.width,b.x+b.width)>Math.max(a.x,b.x)+.01&&Math.min(a.y+a.height,b.y+b.height)>Math.max(a.y,b.y)+.01;
describe('reserved poker perimeter geometry',()=>{
 // Widths are actual scene content widths after page/table margins, not outer device widths.
 const views=[{viewport:320,scene:260},{viewport:320,scene:263},{viewport:320,scene:278},{viewport:375,scene:333},{viewport:390,scene:348},{viewport:430,scene:388},{viewport:568,scene:526},{viewport:700,scene:646},{viewport:768,scene:712},{viewport:844,scene:788},{viewport:1280,scene:876}];
 for(const {viewport,scene} of views)it(`keeps all 2–10 seats and board disjoint at ${viewport}px (${scene}px scene)`,()=>{
  for(let count=2;count<=10;count++){
   const layout=perimeterLayout(count,viewport<=700),rects=layoutRectangles(layout,scene);
   expect(rects.seats).toHaveLength(count);
   expect(rects.seats[0].x+rects.seats[0].width/2).toBeCloseTo(scene/2);
   expect(layout.points[0].y).toBe(1);
   for(const [i,seat] of rects.seats.entries()){
    expect(seat.x,`${count} seats, seat${i} left`).toBeGreaterThanOrEqual(0);
    expect(seat.y,`${count} seats, seat${i} top`).toBeGreaterThanOrEqual(0);
    expect(seat.x+seat.width,`${count} seats, seat${i} right`).toBeLessThanOrEqual(scene);
    expect(seat.y+seat.height,`${count} seats, seat${i} bottom`).toBeLessThanOrEqual(layout.height);
    expect(overlap(seat,rects.board),`${count} seats, seat${i} against board`).toBe(false);
    for(let j=i+1;j<count;j++)expect(overlap(seat,rects.seats[j]),`${count} seats: ${i}/${j}`).toBe(false);
   }
  }
 });
 it('rejects unsupported seat counts',()=>{for(const n of [0,1,11,2.5,NaN])expect(()=>perimeterLayout(n,true)).toThrow();});
});
describe('short table for laptops and landscape tablets',()=>{
 // 620px is below the narrowest real table width in this mode (660px at a 701px window).
 it('keeps every seat inside the table and clear of the board and of each other, 2–10 seats, 620–1500px',()=>{
  for(let n=2;n<=10;n++)for(let width=620;width<=1500;width+=20){
   const layout=shortPerimeterLayout(n),{seats,board}=layoutRectangles(layout,width);
   expect(seats).toHaveLength(n);
   seats.forEach((seat,i)=>{
    expect(seat.x>=0&&seat.x+seat.width<=width&&seat.y>=0&&seat.y+seat.height<=layout.height,`${n} seats, ${width}px: seat ${i} leaves the table`).toBe(true);
    expect(overlap(seat,board),`${n} seats, ${width}px: seat ${i} covers the board`).toBe(false);
    for(let j=i+1;j<n;j++)expect(overlap(seat,seats[j]),`${n} seats, ${width}px: seats ${i} and ${j} overlap`).toBe(false);
   });
  }
 });
 it('uses full-size seats at one fixed height, with Hero bottom centre and no shared positions',()=>{
  for(let n=2;n<=10;n++){
   const short=shortPerimeterLayout(n),wide=perimeterLayout(n,false);
   expect(short.height).toBe(SHORT_TABLE_HEIGHT);expect(short.height).toBeLessThanOrEqual(wide.height);
   expect([short.seatWidth,short.seatHeight,short.heroWidth,short.heroHeight,short.boardWidth,short.boardHeight]).toEqual([wide.seatWidth,wide.seatHeight,wide.heroWidth,wide.heroHeight,wide.boardWidth,wide.boardHeight]);
   expect(short.points[0]).toEqual({x:.5,y:1});expect(new Set(short.points.map(p=>`${p.x},${p.y}`)).size).toBe(n);
  }
 });
 it('rejects unsupported seat counts',()=>{for(const n of [0,1,11,2.5,NaN])expect(()=>shortPerimeterLayout(n)).toThrow();});
});
