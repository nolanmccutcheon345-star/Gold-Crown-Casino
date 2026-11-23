/** Candidate wrapper only: never changes game state or interprets readiness. */
export function beginCandidateVerification(button:HTMLButtonElement,status:HTMLElement):void {
 const hadFocus=button.ownerDocument.activeElement===button;
 status.textContent='Verifying candidate source and exact compiled assets…';
 // Move keyboard focus before disabling its current element. This is an asset
 // verification message, never a claim that the wallet has been verified.
 if(hadFocus)status.focus({preventScroll:true});
 button.disabled=true;
}

export function focusCandidateApplication(app:HTMLElement):void {
 // Explicit navigation only. The application owns its loading state and all
 // action enablement; no polling or private-state access is needed here.
 const target=app.querySelector<HTMLElement>('#main-content')??app;
 target.focus({preventScroll:true});
 target.scrollIntoView({block:'start'});
}
