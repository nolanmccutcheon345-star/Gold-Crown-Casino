import {expect,it} from 'vitest';
import {ruleVersionMarkup} from '../../src/ui/rule-version';

it('abbreviates only the visible configuration digest while preserving the entire accessible version',()=>{
 const version=`0.3.0+cfg.${'abcdef0123456789'.repeat(4)}`,markup=ruleVersionMarkup(version);
 expect(markup).toContain('<span aria-hidden="true">0.3.0+cfg.abcdef012345…</span>');
 expect(markup).toContain(`<span class="sr-only">${version}</span>`);
 expect(markup).toContain(`title="Complete rule version: ${version}"`);
});
it('keeps legacy and nonconfiguration source versions exact',()=>{
 expect(ruleVersionMarkup('0.1.0')).toBe('0.1.0');
 expect(ruleVersionMarkup('2026-11-01')).toBe('2026-11-01');
 expect(ruleVersionMarkup('1+cfg.unrecognized')).toBe('1+cfg.unrecognized');
});
it('escapes untrusted imported version text and attributes',()=>{
 expect(ruleVersionMarkup('<script>"x"</script>')).toBe('&lt;script&gt;&quot;x&quot;&lt;/script&gt;');
 const markup=ruleVersionMarkup(`"<b>+cfg.${'a'.repeat(64)}`);
 expect(markup).not.toContain('<b>');expect(markup).toContain('&quot;&lt;b&gt;');
});
