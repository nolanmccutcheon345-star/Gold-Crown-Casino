import {describe,expect,it} from 'vitest';
import {beginCandidateVerification,focusCandidateApplication} from '../browser/step5g-external-navigation';

describe('Isolated candidate keyboard entry',()=>{
 it('moves keyboard focus to the verification status before disabling the active button',()=>{
  const order:string[]=[];
  const doc={activeElement:null as unknown};
  const status={textContent:'',focus:()=>{order.push('focus-status');doc.activeElement=status;}};
  const button={ownerDocument:doc,set disabled(value:boolean){expect(value).toBe(true);order.push('disable-start');}};
  doc.activeElement=button;
  beginCandidateVerification(button as unknown as HTMLButtonElement,status as unknown as HTMLElement);
  expect(order).toEqual(['focus-status','disable-start']);
  expect(doc.activeElement).toBe(status);
  expect(status.textContent).toBe('Verifying candidate source and exact compiled assets…');
 });
 it('does not steal focus from a tester who activated by another input method',()=>{
  const focused={};const doc={activeElement:focused};let moved=false;
  const button={ownerDocument:doc,disabled:false};
  const status={textContent:'',focus:()=>{moved=true;}};
  beginCandidateVerification(button as unknown as HTMLButtonElement,status as unknown as HTMLElement);
  expect(moved).toBe(false);expect(button.disabled).toBe(true);expect(doc.activeElement).toBe(focused);
 });
 it('explicit shortcut focuses the application main region and scrolls it into reach',()=>{
  const calls:string[]=[];const main={focus:()=>calls.push('focus-main'),scrollIntoView:()=>calls.push('scroll-main')};
  const app={querySelector:(selector:string)=>{expect(selector).toBe('#main-content');return main;}};
  focusCandidateApplication(app as unknown as HTMLElement);expect(calls).toEqual(['focus-main','scroll-main']);
 });
 it('supports the loading shell without making a gameplay-readiness assertion',()=>{
  const calls:string[]=[];const app={querySelector:()=>null,focus:()=>calls.push('focus-shell'),scrollIntoView:()=>calls.push('scroll-shell')};
  focusCandidateApplication(app as unknown as HTMLElement);expect(calls).toEqual(['focus-shell','scroll-shell']);
 });
});
