/** Only hash-verified local QA packages are selectable; never a production URL. */
export function compiledCandidatePath(name:string|null):string {
 const selected=name??'step5f-candidate-checkpoint';
 if(selected.length>100||!/^step5f-candidate(?:-[a-z0-9]+)*$/.test(selected))throw Error('Invalid local compiled candidate package');
 return `./${selected}/manifest.json`;
}
