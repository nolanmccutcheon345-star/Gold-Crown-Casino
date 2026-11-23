import type {AppData} from './types';
import {getArchiveContext} from '../storage/verified';

export const MAX_PLAYER_NOTES=200;
export const MAX_PLAYER_NOTE_LENGTH=500;
export interface PlayerNote {
 id:string;sessionId:string;seatId:number;text:string;revision:number;createdAt:string;updatedAt:string;
}
export interface UserNotes {version:1;revision:number;entries:PlayerNote[];}
const keys=['id','sessionId','seatId','text','revision','createdAt','updatedAt'];
function requireNote(ok:unknown,message:string):asserts ok {if(!ok)throw Error(message);}
const sequence=(value:unknown)=>Number.isSafeInteger(value)&&Number(value)>=0;
const timestamp=(value:unknown):value is string=>typeof value==='string'&&value.length<=40&&Number.isFinite(Date.parse(value));
const noteId=(sessionId:string,seatId:number)=>`player-note:${sessionId}:${seatId}`;
function plain(value:unknown,fields:string[]):value is Record<string,unknown>{
 return !!value&&typeof value==='object'&&!Array.isArray(value)&&Object.keys(value).length===fields.length&&Object.keys(value).every(key=>fields.includes(key));
}
function knownPlayer(data:AppData,sessionId:string,seatId:number,publicSeats?:readonly {sessionId:string;seats:readonly number[]}[]):boolean {
 if(!data.sessions.some(session=>session.id===sessionId))return false;
 if(data.active?.sessionId===sessionId&&data.active.game.seats.some(seat=>seat.id===seatId))return true;
 return data.hands.some(hand=>hand.sessionId===sessionId&&hand.view.seats.some(seat=>seat.id===seatId))||(publicSeats??getArchiveContext(data)?.handIndex??[]).some(hand=>hand.sessionId===sessionId&&hand.seats.includes(seatId));
}
export function getPlayerNote(data:Pick<AppData,'userNotes'>,sessionId:string,seatId:number):PlayerNote|undefined {
 return data.userNotes?.entries.find(note=>note.sessionId===sessionId&&note.seatId===seatId);
}
function validateText(text:unknown):asserts text is string {
 requireNote(typeof text==='string'&&text.trim().length>0&&text.length<=MAX_PLAYER_NOTE_LENGTH,`Enter a player note between 1 and ${MAX_PLAYER_NOTE_LENGTH} characters.`);
 requireNote(![...text].some(character=>{const code=character.charCodeAt(0);return code===127||code<32&&![9,10,13].includes(code);}), 'Player notes must be plain text without control characters.');
}
/** Manual notes are an optional versioned nonfinancial header, not inferred
 * evidence, bot memory, immutable hand data, or public hand-history export.
 * Verified unchanged identity makes ordinary bot/game commits constant work. */
export function validateUserNotes(data:AppData,prior?:AppData,publicSeats?:readonly {sessionId:string;seats:readonly number[]}[]):void {
 const notes=data.userNotes;if(prior&&notes===prior.userNotes)return;
 if(notes===undefined){requireNote(!prior?.userNotes,'Remove player notes individually or use explicit all-data deletion.');return;}
 requireNote(plain(notes,['version','revision','entries'])&&notes.version===1&&sequence(notes.revision)&&Array.isArray(notes.entries),'Unsupported or invalid player-note data. Existing notes were preserved.');
 requireNote(notes.entries.length<=MAX_PLAYER_NOTES,`At most ${MAX_PLAYER_NOTES} player notes can be stored. Delete a note before adding another.`);
 const ids=new Set<string>(),revisions=new Set<number>(),previous=new Map((prior?.userNotes?.entries??[]).map(note=>[note.id,note]));let changes=0;
 for(const note of notes.entries){
  requireNote(plain(note,keys)&&typeof note.sessionId==='string'&&note.sessionId.length>0&&note.sessionId.length<=160&&Number.isInteger(note.seatId)&&note.seatId>=0&&note.seatId<=9&&note.id===noteId(note.sessionId,note.seatId)&&!ids.has(note.id),'Invalid or duplicate player-note identity.');ids.add(note.id);
  requireNote(sequence(note.revision)&&note.revision>0&&note.revision<=notes.revision&&!revisions.has(note.revision),'Invalid player-note revision.');revisions.add(note.revision);
  const old=previous.get(note.id);previous.delete(note.id);
  if(old===note)continue;
  validateText(note.text);requireNote(note.text===note.text.trim(),'Saved player notes must not have surrounding whitespace.');
  requireNote(timestamp(note.createdAt)&&timestamp(note.updatedAt)&&Date.parse(note.updatedAt)>=Date.parse(note.createdAt),'Invalid player-note timestamps.');
  requireNote(knownPlayer(data,note.sessionId,note.seatId,publicSeats),'Player note must refer to a publicly seated player in an existing session.');
  if(prior){changes++;requireNote(note.revision===notes.revision&&(!old||old.createdAt===note.createdAt),'A changed note must use the current note revision and preserve its creation time.');}
 }
 if(prior){changes+=previous.size;requireNote(notes.revision===(prior.userNotes?.revision??0)+1&&changes===1,'Player-note update must change exactly one note with the next revision.');}
}
/** Never reads private profiles, cards or policy parameters. UI must render
 * user-authored text as text, and identify it as the user's observation. */
export function savePlayerNote(data:AppData,sessionId:string,seatId:number,text:string,expectedNoteRevision=0,at=new Date().toISOString()):UserNotes {
 validateText(text);const normalized=text.trim();requireNote(sequence(expectedNoteRevision),'Invalid expected player-note revision.');
 requireNote(knownPlayer(data,sessionId,seatId),'Choose a publicly seated player in this session.');
 const existing=getPlayerNote(data,sessionId,seatId),notes=data.userNotes??{version:1 as const,revision:0,entries:[]};
 if(existing?.text===normalized)return notes;
 requireNote((existing?.revision??0)===expectedNoteRevision,'This player note changed. Reload the saved note before editing; your draft was not saved.');
 requireNote(existing||notes.entries.length<MAX_PLAYER_NOTES,`At most ${MAX_PLAYER_NOTES} player notes can be stored. Delete a note before adding another.`);
 const revision=notes.revision+1;requireNote(sequence(revision),'Player-note revision limit reached.');
 requireNote(timestamp(at),'Invalid player-note time.');
 const updatedAt=existing&&Date.parse(at)<Date.parse(existing.updatedAt)?existing.updatedAt:at;
 const note:PlayerNote={id:noteId(sessionId,seatId),sessionId,seatId,text:normalized,revision,createdAt:existing?.createdAt??at,updatedAt};
 return {version:1,revision,entries:existing?notes.entries.map(previous=>previous.id===note.id?note:previous):[...notes.entries,note]};
}
export function deletePlayerNote(data:AppData,sessionId:string,seatId:number,expectedNoteRevision:number):UserNotes|undefined {
 requireNote(sequence(expectedNoteRevision),'Invalid expected player-note revision.');
 const existing=getPlayerNote(data,sessionId,seatId);if(!existing)return data.userNotes;
 requireNote(existing.revision===expectedNoteRevision,'This player note changed. Reload the saved note before deleting it.');
 const notes=data.userNotes!,revision=notes.revision+1;requireNote(sequence(revision),'Player-note revision limit reached.');
 return {version:1,revision,entries:notes.entries.filter(note=>note.id!==existing.id)};
}
