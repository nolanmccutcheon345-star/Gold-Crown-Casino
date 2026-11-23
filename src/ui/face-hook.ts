/** Patch 84: faces for every game. The app registers one renderer; each game's view asks it for the
 * faces at its table. Display only: nothing here reaches the engine or the bots. With no renderer
 * (tests, or faces turned off) views keep their plain look. */
import type {Mood} from './avatars';
export type TableFace=(name:string,hero?:boolean,mood?:Mood)=>string;
let renderer:((names:readonly string[])=>TableFace|null)|null=null;
export function setTableFaces(fn:((names:readonly string[])=>TableFace|null)|null):void {renderer=fn;}
/** Faces for one table: no two players share a portrait. Null when faces are off. */
export function facesFor(names:readonly string[]):TableFace|null {return renderer?renderer(names):null;}
