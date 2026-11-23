import {expect,it} from 'vitest';
import type {StudyImportPreview} from '../../src/storage/study-import';
import {studyImportPreviewMarkup} from '../../src/ui/study-import-preview';
const preview=(count=2):StudyImportPreview=>({kind:'public-study-import-preview',previewId:'fixture-only',format:'ai-texas-hold-em-public-history',version:'0.3.0',requiresExplicitSelection:true,totalRows:count,validCount:count-1,invalidCount:1,disclosure:'Verified preview only.',rows:Array.from({length:count},(_,index)=>({index,handId:index===0?'<untrusted>':`hand-${index}`,status:index===0?'INVALID':'VALID',errors:index===0?['Private fields rejected.']:[],warnings:[]}))});
it('leaves all rows unchecked and prevents selecting rejected records',()=>{
 const html=studyImportPreviewMarkup(preview(),new Set(),0,false);
 expect(html).not.toContain(' checked');expect(html).toContain('data-import-selection="0"  disabled');
 expect(html).toContain('id="confirm-study-import" class="button primary" disabled');expect(html).toContain('&lt;untrusted&gt;');
});
it('enables explicit confirmation only after selection and shows count',()=>{
 const html=studyImportPreviewMarkup(preview(),new Set([1]),0,false);
 expect(html).toContain('data-import-selection="1" checked');expect(html).toContain('Import 1 selected study hand');
 expect(html).not.toContain('id="confirm-study-import" class="button primary" disabled');
});
it('bounds the preview DOM to fifty rows per page while retaining the global selection count',()=>{
 const html=studyImportPreviewMarkup(preview(150),new Set([1,100]),1,false);
 expect((html.match(/data-import-row=/g)??[]).length).toBe(50);expect(html).toContain('data-import-row="50"');expect(html).not.toContain('data-import-row="100"');expect(html).toContain('Import 2 selected study hands');
});
