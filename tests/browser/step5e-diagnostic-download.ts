// Export only the existing rendered diagnostic report. This adds no assertions
// and cannot turn a failed or unexecuted browser scenario into a passing one.
const report=document.querySelector<HTMLElement>('#result');
if(report){
 const button=document.createElement('button');button.id='download-observed-diagnostic';button.textContent='Download observed diagnostic JSON';report.before(button);
 button.onclick=()=>{const text=report.textContent??'';if(!text.trim())return;JSON.parse(text);const url=URL.createObjectURL(new Blob([text],{type:'application/json'})),link=document.createElement('a');link.href=url;link.download='observed-browser-diagnostic.json';link.click();setTimeout(()=>URL.revokeObjectURL(url),1000);};
}
export {};
