/** Presentation-only perimeter coordinates. Money, seat eligibility and action order stay in the engine. */
export interface SeatPoint { x:number; y:number; }
export interface PerimeterLayout {
 height:number; insetX:number; insetY:number; seatWidth:number; seatHeight:number;
 heroWidth:number; heroHeight:number; boardWidth:number; boardHeight:number; boardGutter:number; points:SeatPoint[];
}
type Coordinates = [number,number][];
// Phone layout: seats ring the table. Hero sits bottom centre, opponents run clockwise up the
// left side, across the top edge and down the right side. Side seats use the outer columns so
// the board keeps the middle; top seats sit inside those columns, above the board.
const compact:Record<number,Coordinates>={
 2:[[.5,1],[.5,0]],
 3:[[.5,1],[.2,0],[.8,0]],
 4:[[.5,1],[0,.5],[.5,0],[1,.5]],
 5:[[.5,1],[0,.6],[.25,0],[.75,0],[1,.6]],
 6:[[.5,1],[0,.72],[0,.25],[.5,0],[1,.25],[1,.72]],
 7:[[.5,1],[.05,1],[0,.5],[.25,0],[.75,0],[1,.5],[.95,1]],
 8:[[.5,1],[.05,1],[0,.5],[.14,0],[.5,0],[.86,0],[1,.5],[.95,1]],
 9:[[.5,1],[.05,1],[0,2/3],[0,1/3],[.25,0],[.75,0],[1,1/3],[1,2/3],[.95,1]],
 10:[[.5,1],[.05,1],[0,2/3],[0,1/3],[.14,0],[.5,0],[.86,0],[1,1/3],[1,2/3],[.95,1]],
};
const wide:Record<number,Coordinates>={
 2:[[.5,1],[.5,0]],
 3:[[.5,1],[.15,.1],[.85,.1]],
 4:[[.5,1],[0,.5],[.5,0],[1,.5]],
 5:[[.5,1],[0,.7],[.15,.05],[.85,.05],[1,.7]],
 6:[[.5,1],[0,.75],[0,.25],[.5,0],[1,.25],[1,.75]],
 7:[[.5,1],[.05,.9],[0,.4],[.25,0],[.75,0],[1,.4],[.95,.9]],
 8:[[.5,1],[.15,.95],[0,.6],[0,.17],[.5,0],[1,.17],[1,.6],[.85,.95]],
 9:[[.5,1],[.15,.95],[0,.65],[0,.25],[.27,0],[.73,0],[1,.25],[1,.65],[.85,.95]],
 10:[[.5,1],[.18,.96],[0,.67],[0,.33],[.18,.04],[.5,0],[.82,.04],[1,.33],[1,.67],[.82,.96]],
};
// Short, wide screens (laptops, landscape tablets): one seat at each end and the rest along the
// top and bottom edges, so a full table with full-size seats needs 480px instead of up to 680px.
// Order is unchanged: clockwise from Hero at bottom centre.
const short:Record<number,Coordinates>={
 2:[[.5,1],[.5,0]],
 3:[[.5,1],[.2,0],[.8,0]],
 4:[[.5,1],[0,.5],[.5,0],[1,.5]],
 5:[[.5,1],[0,.5],[.3,0],[.7,0],[1,.5]],
 6:[[.5,1],[0,.5],[.2,0],[.5,0],[.8,0],[1,.5]],
 7:[[.5,1],[.2,1],[0,.5],[.3,0],[.7,0],[1,.5],[.8,1]],
 8:[[.5,1],[.2,1],[0,.5],[.2,0],[.5,0],[.8,0],[1,.5],[.8,1]],
 9:[[.5,1],[.2,1],[0,.5],[.14,0],[.38,0],[.62,0],[.86,0],[1,.5],[.8,1]],
 10:[[.5,1],[.2,1],[0,.5],[.06,0],[.28,0],[.5,0],[.72,0],[.94,0],[1,.5],[.8,1]],
};
export const SHORT_TABLE_HEIGHT=480;
const compactHeights:Record<number,number>={2:336,3:336,4:336,5:336,6:336,7:340,8:340,9:402,10:402};
const wideHeights:Record<number,number>={2:480,3:510,4:540,5:560,6:600,7:620,8:640,9:660,10:680};
export function perimeterLayout(seats:number,narrow:boolean):PerimeterLayout {
 if(!Number.isInteger(seats)||seats<2||seats>10)throw new Error('A table needs 2–10 seats');
 return {
  height:(narrow?compactHeights:wideHeights)[seats],insetX:narrow?34:64,insetY:narrow?54:80,
  seatWidth:narrow?68:106,seatHeight:narrow?96:145,heroWidth:narrow?96:116,heroHeight:narrow?108:155,
  boardWidth:narrow?184:240,boardHeight:narrow?110:140,boardGutter:narrow?140:0,
  points:(narrow?compact:wide)[seats].map(([x,y])=>({x,y})),
 };
}
/** Wide-screen seats and board on the short table. CSS selects it by viewport height (desktop-play.css). */
export function shortPerimeterLayout(seats:number):PerimeterLayout {
 return {...perimeterLayout(seats,false),height:SHORT_TABLE_HEIGHT,points:short[seats].map(([x,y])=>({x,y}))};
}
/** Exact reserved rectangles used by the CSS positioning contract, for overlap regression tests. */
export function layoutRectangles(layout:PerimeterLayout,width:number) {
 const seats=layout.points.map((point,index)=>{
  const w=index===0?layout.heroWidth:layout.seatWidth,h=index===0?layout.heroHeight:layout.seatHeight;
  return {x:layout.insetX+(width-2*layout.insetX)*point.x-w/2,y:layout.insetY+(layout.height-2*layout.insetY)*point.y-h/2,width:w,height:h};
 });
 const boardWidth=layout.boardGutter?Math.min(layout.boardWidth,Math.max(124,width-layout.boardGutter)):layout.boardWidth;
 return {seats,board:{x:(width-boardWidth)/2,y:(layout.height-layout.boardHeight)/2,width:boardWidth,height:layout.boardHeight}};
}
