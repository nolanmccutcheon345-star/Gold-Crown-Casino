const escape=(value:string)=>value.replace(/[&<>"']/g,character=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'})[character]!);

/** Full immutable provenance remains available to assistive text, hover and
 * canonical export. Only a recognized configuration digest is abbreviated. */
export function ruleVersionMarkup(version:string):string {
 const match=version.match(/^(.*)\+cfg\.([0-9a-f]{64})$/);
 if(!match)return escape(version);
 const short=`${match[1]}+cfg.${match[2].slice(0,12)}…`;
 return `<span class="rule-version" title="Complete rule version: ${escape(version)}"><span aria-hidden="true">${escape(short)}</span><span class="sr-only">${escape(version)}</span></span>`;
}
