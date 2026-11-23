import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {plan} from '../../scripts/step5d-ci-plan.mjs';
const workflow=readFileSync('.github/workflows/verify.yml','utf8');
const resource=readFileSync('.github/workflows/resource.yml','utf8');
const pins=JSON.parse(readFileSync('tests/step5n-ci/action-pins.json','utf8'));
for(const [path,text] of [['verify.yml',workflow],['resource.yml',resource]]){
 test(`${path} pins every action to an independently recorded immutable commit`,()=>{
  const uses=[...text.matchAll(/uses: (actions\/[a-z-]+)@([^\s]+)/g)];assert(uses.length>0);
  for(const [,name,commit]of uses){assert.match(commit,/^[a-f0-9]{40}$/);assert.equal(commit,pins[name].commit);assert.equal(pins[name].commitURL,`https://github.com/${name}/commit/${commit}`);}
 });
 test(`${path} grants read-only access, persists no credentials and performs no deployment`,()=>{
  assert.match(text,/permissions:\n {2}contents: read/);assert(!text.includes('pull_request_target'));
  assert(!/contents: write|id-token: write|secrets\.|deploy_site|save_site_version|publish_on_push|continue-on-error/.test(text));
  const checkouts=text.match(/uses: actions\/checkout@/g)??[];assert.equal((text.match(/persist-credentials: false/g)??[]).length,checkouts.length);
  assert.equal((text.match(/fetch-depth: 0/g)??[]).length,checkouts.length);
  assert(text.includes('if: always()'));assert(text.includes('if-no-files-found: error'));
 });
}
test('ordinary critical and oracle execution bound workers without removing more tests',()=>{
 for(const mode of ['critical','oracle'])assert(plan(mode,'test-results/run').find(x=>x[0]==='tests')[2].includes('--maxWorkers=2'));
 assert(plan('release','test-results/run').find(x=>x[0]==='tests')[2].includes('--maxWorkers=4'));
});
test('browser checks run for source changes and consume exact upstream compiled artifacts',()=>{
 const browser=workflow.split('  browser:\n')[1].split('  r1-release:')[0];
 assert(!browser.includes('workflow_dispatch'));assert(browser.includes('needs: critical'));
 assert(browser.includes('test-results/critical/manifest.json'));assert(browser.includes('npx playwright install --with-deps chromium'));
 assert(!browser.includes('npm run build'));
});
test('release refusal remains mandatory and only high-volume jobs require manual dispatch',()=>{
 assert.match(workflow,/r1-release:[\s\S]*needs: \[critical, oracle, release-load, browser\]/);
 assert(workflow.includes('step5d-ci-runner.mjs gate'));assert(resource.includes('workflow_dispatch:'));
 assert(!/^ {2}(push|pull_request):/m.test(resource));assert(resource.includes('10000'));
 assert(resource.includes('verify-archive.ts'));assert(resource.includes('verify-report.mjs'));
});
test('all supported seat counts and keyboard journey are included in compiled browser suite',()=>{
 assert(readFileSync('tests/browser/cash-hand.spec.ts','utf8').includes('[2,3,4,5,6,7,8,9,10]'));
 const keyboard=readFileSync('tests/browser/keyboard.spec.ts','utf8');
 assert(keyboard.includes("page.keyboard.press('Tab')"));assert(keyboard.includes("page.keyboard.press('Enter')"));
 assert(keyboard.includes('HAND COMPLETE'));assert(keyboard.includes('table-announcement'));
});
