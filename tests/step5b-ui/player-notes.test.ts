import {expect,it} from 'vitest';
import {playerNotesMarkup,type PlayerNoteEditor} from '../../src/ui/player-notes';
const editor:PlayerNoteEditor={open:true,sessionId:'session',seatId:1,text:'',stored:false,dirty:false,locked:false,notice:'',sessions:[{id:'session',label:'Cash practice'}],players:[{id:1,name:'Alex'}]};
it('renders manually authored text safely without executable HTML or auto-generated opponent analysis',()=>{
 const html=playerNotesMarkup({...editor,text:'</textarea><script>alert(1)</script>',dirty:true});
 expect(html).not.toContain('<script>');expect(html).toContain('&lt;/textarea&gt;');expect(html).toContain('Unsaved draft');expect(html).toContain('Nothing is inferred from hidden cards');expect(html).toContain('maxlength="500"');
});
it('does not offer deleting a nonexistent note and provides labelled controls/status',()=>{
 const html=playerNotesMarkup(editor);expect(html).toContain('id="delete-player-note" class="button secondary" disabled');expect(html).toContain('for="player-note-text"');expect(html).toContain('aria-live="polite"');
});
it('shows persisted-note deletion and safely reports failures while preserving a draft',()=>{
 const html=playerNotesMarkup({...editor,stored:true,dirty:true,text:'Kept draft',notice:'<save failed>'});expect(html).toContain('Kept draft');expect(html).toContain('&lt;save failed&gt;');expect(html).not.toContain('id="delete-player-note" class="button secondary" disabled');
});
