/** Validate the user's complete input without rounding, clipping or treating
 * an empty in-progress field as zero. Invalid drafts keep the last projection. */
export function readLivePaceInput(text:string):number|null {
 if(!text.trim())return null;
 const value=Number(text);
 return Number.isInteger(value)&&value>=1&&value<=1000?value:null;
}
