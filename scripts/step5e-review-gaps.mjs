/** Read-only, ID-preserving evidence triage. No acceptance status or old artifact is edited. */
import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
import {execFileSync} from 'node:child_process';
import {existsSync,mkdirSync,readFileSync,writeFileSync,statSync} from 'node:fs';
import {dirname,resolve} from 'node:path';
import process from 'node:process';
import console from 'node:console';
import {parseCsv} from './step5d-audit-execution-links.mjs';
const sha=bytes=>createHash('sha256').update(bytes).digest('hex');
const read=path=>readFileSync(path),json=path=>JSON.parse(read(path));
const baselinePath='tests/step5d-gates/REMAINING_EVIDENCE_WORK.json',baseline=json(baselinePath),rows=parseCsv(read('ACCEPTANCE_STATUS.csv').toString()),byId=new Map(rows.map(row=>[row.id,row]));
const actions={
 B10:['BROWSER','Assert invalid non-all-in under-minimum editor disabled/rejected; then exact whole-stack short raise accepted. Unit legality is already supported.'],
 B11:['BROWSER','At $1/$2 enter literal raise-to $16 and assert visible label, submitted raiseTo=1600 and resulting street contribution=1600.'],
 D02:['BROWSER','Configure table capacity10 with6occupied including Hero; inspect ten perimeter slots and no action actor among empty slots.'],
 D05:['BROWSER','Execute literal $1/$3,$2/$5,$50/$100 displays; assert cents, BB conversions, pot and stack values against frozen authoritative states.'],
 D06:['BROWSER','Execute literal SB$3/BB$7/stack$350; assert config validation, display and minimum unopened street bet$7. The older $1/$3 scenario is not equivalent.'],
 D07:['BROWSER','Five configured known styles plus Random and Unknown: verify Host choices, Live concealment and recorded Random semantics with exact source-bound capture.'],
 E06:['BROWSER','Assert Unknown latent type absent from active Live/tooltips/public telemetry; only explicit post-session style insight may disclose its recorded starting label.'],
 F13:['BROWSER_PLUS_EXISTING_SIMULATION','Combine already executed paired known/Unknown100-hand identical-policy outcomes with fresh actual Unknown UI concealment; no human-frequency claim.'],
 G04:['BROWSER','Populate exact +10BB/100, 30hands/hour fixture; assert +3BB/hour label explicitly projected, separately from actual-clock result.'],
 G05:['BROWSER_PLUS_EXISTING_SIMULATION','Populate the literal100-hand calling-station result; show N, uncertainty and synthetic population scope. Current nine-hand and mixed200-hand browser cases are not this scenario.'],
 G09:['BROWSER','Render a positive very-small-N result; assert N and uncertainty visible and no verified-winning badge. Preserve actual small sample and interval values.'],
 U01:['BROWSER','One-click default must select live$1/$2,nine seats,$300 starting stack and remain editable; preset cloning alone is insufficient.'],
 U02:['BROWSER_AND_DEVICE','At360–430px and landscape assert readable action controls, sizing/minmax/added amount, safe-area/touch bounds and central pot geometry; distinguish emulation from physical devices.'],
 U03:['BROWSER','Exercise call amount, cumulative raise-to and additional contribution with prior chips already committed; assert all labels and actual submission.'],
 U04:['BROWSER','Use exact min/max legal sizes, under-min disabled state, over-stack cap and short all-in from current engine legality.'],
 U07:['SCOPE_OR_CODE_REVIEW','Original title says user-selectable showdown; exact criterion requires only permitted reveals/no folded leak. Public replay guards exist, but current UI has no show/muck choice. Resolve governing specification without silently weakening either wording.'],
 U12:['PERFORMANCE_AND_PROVENANCE','Original ten-thousand-hand resource run lacks a contemporaneous compiled-generation hash. Keep it historical partial evidence; execute or qualify a full current sustained run with heap/storage/timer trends and immutable build proof.'],
 U13:['BROWSER_AND_DEVICE','Actual rapid DOM action tests cover commit idempotence; execute touch/pointer and retry/race scenarios with exact revision/settlement assertions. Do not label emulation physical touch.'],
 U14:['BROWSER_AND_STORAGE','Current native archive/rollback tests are useful but need their true assertion/build provenance plus visible ordinary-UI failed quota/write recovery.'],
 U15:['BROWSER','Inspect all active Unknown surfaces including DOM attributes, tooltips, notes and displayed statistics; configuration selection alone cannot prove private-type concealment.'],
 M05:['SCOPE_OR_CODE_REVIEW','Results are grouped; History has filters. Original cash portion requires filterable cash statistics. Verify actual Results filtering or implement it; do not substitute history filtering. Tournament namespace remains later scope.'],
 M06:['BROWSER','Show positive small-N and deliberately high-variance cash records; inspect uncertainty and absence of statistically-proven-positive-live language/badge.'],
 M09:['BROWSER_AND_STORAGE','Execute current ordinary multi-tab contention and saved-state recovery with exact source/build, immutable hand count, wallet, sequence and visible repair state.'],
 M12:['BROWSER_AND_PROVENANCE','Deletion/export are exercised; capture diagnostic default-Off/no-network-collection and no-private-card public logging boundaries. A nonexistent optional service is not an executed opt-in path.'],
 X01:['BROWSER','Replay actual raise-to editing and verify total commitment versus added amount, including earlier street contribution.'],
 X02:['BROWSER','Exercise pot-percentage raise/bet and maximum-stack legality from actual current pot/call cost; preserve UI input and resulting authoritative event.'],
 X05:['BROWSER','Manual adjustment math passes; capture visible explicit adjustment/reset epoch, reason code and unchanged poker P&L/statistics.'],
 X10:['BROWSER','Show exact +10BB/100 times30hands/hour=+3BB/hour as projection, while actual-session rate uses wall-clock elapsed duration.'],
 X15:['BROWSER_PLUS_EXISTING_UNIT','Unsupported engine flags reject; exercise actual URL/local configuration attempts and confirm no variant/straddle activation or fallback labeling.'],
 Y11:['BROWSER','Combine actual known/Unknown policy-pair equivalence with active Live/public observation concealment and explicit ended-session insight.'],
 Y12:['FRESH_SOURCE_BOUND_SUPPLEMENT','Fresh b202f9a execution hashes actual QUALITATIVE_SOURCES.md and existing named rejection assertion; proposed full qualification stored separately, no CSV promotion.'],
 Y16:['BROWSER','Inspect all persona cards and settings for DESIGNED evidence tier, provisional stake/rake scope and absence of unsupported empirical/solver labels.'],
 Z01:['BROWSER_AND_DEVICE','Capture supported portrait and landscape configurations with readable visible action controls, no overlap/horizontal overflow and accessible confirmation.'],
 Z03:['HISTORICAL_AND_CURRENT_RECOVERY','Qualify native9-check V7→candidate→V7-R→candidate receipt with each frozen compiled artifact and actual QA revision; rerun current checkpoint schema recovery. Redeploying unchangedV7 is not data rollback.'],
 Z14:['BROWSER_AND_PERFORMANCE','Base Hero notes/replay must work with keyboard/touch, bounded storage, privacy and no action/performance regression; FUT050 defers bookmarks only.'],
 V408:['BROWSER','Verify visible sizing values use exact call/eligible pot/raise-to/prior commitment mathematics; bind independent arithmetic assertions and actual UI submissions.'],
 V429:['LONG_BROWSER_RUN','Existing historical100-browser-hand run needs original build proof; current27hands split among widths are not100continuous. Include speed/RNG independence evidence.'],
 V435:['BROWSER_AND_DEVICE','Execute literal phone sizing/controls geometry and landscape layout; distinguish actual pointer gestures, emulated viewport and physical-device checks.'],
 V436:['BROWSER','Capture practice/offline/not-real-money/not-real-time-assistance disclosure and ingestion rights refusal before study-only import; no live-client integration.'],
 V505:['BROWSER','Exercise actual percent-pot sizing and prior-street commitments, validate added amount and raise-to legality against independent expected values.'],
 V509:['BROWSER','Inspect Unknown identity masking in Live/ordinary Study/export and explicit post-session style-only opt-in; hidden cards and parameters remain private.'],
 V510:['SCOPE_OR_CODE_REVIEW','Permitted/mucked replay card guards pass. Exact criterion also requires developer full-state diagnostics distinctly gated and non-training; absence of a diagnostic UI is not implementation evidence.'],
 V512:['BROWSER_AND_STORAGE','Bind native concurrent-tab and interruption receipts to exact source/build; check at most one owner and no duplicated journal/settlement after reload and stale actions.'],
 V514:['BROWSER','Current versus historical population/mix/rules/rake settings must be visible without rewriting old records; older persona capture itself explicitly says historical grouping NOT_IMPLEMENTED.'],
 V521:['BROWSER_PLUS_EXISTING_UNIT','Verify actual UI/URL/localflag attempts cannot enable unsupported modes; preserve all86 future IDs and actionable unavailable state.'],
 V601:['FRESH_SOURCE_BOUND_SUPPLEMENT','Fresh exact-current-registry gate tests plus original source-bound 2–10 compiled UI hands after full runtime/build byte equality. Hosted CI remains separate NOT_EXECUTED underV522.'],
 V603:['BROWSER','Unknown actual type must stay hidden on every active public surface; combine private observation tests with real DOM/export/notes checks.'],
 V604:['BROWSER','Freeze seeded hand/legal state and pending identity; toggle Host/Live/Study and assert identical next decision, distribution and settlement. Merely display-only navigation is partial.'],
 V605:['BROWSER','Force unavailable secure entropy in isolated ordinary-UI flow and assert clear failure with no buy-in/deal; seeded laboratory harness must remain distinctly separate.'],
 V612:['BROWSER_AND_DEVICE','Literal360px facing3bet with prior contribution; inspect call/additional/raise-to/minmax labels and rapid duplicate input commits only once.'],
 V613:['BROWSER','Use exact prescribed pacing example and actual elapsed time independently; confirm projected and measured units remain separate on screen.'],
 V614:['BROWSER','Capture truthful designed/qualitative/calibrated evidence tiers and lack of empirical promotion for all actual opponent/setup/Study surfaces.'],
 V615:['BROWSER_PLUS_EXISTING_UNIT','Preserved future flags must not activate unsupported poker variants through ordinary controls, URL or localstorage; expected rejection remains visible.'],
 V701:['BROWSER','Run100actual UI rerenders while same committed decision is pending; compare token, action and settlement.100projectView calls alone do not execute UI rerenders.'],
 V708:['BROWSER_AND_STORAGE','Current interrupted-write/reload/quota/multi-tab workflows need exact runtime/build/seed/effect proof; ensure visible repair preserves records and never resets wallet.'],
};
const mandatory={
 U10:['MIXED_TECHNICAL_EXTERNAL','Execute actual supported screen-reader turn/bet/board/payout announcements; keyboard/ARIA automated checks remain partial.','User or tester with named screen reader/browser; record exact spoken announcements and successful core actions.'],
 U11:['MIXED_TECHNICAL_EXTERNAL','Current reference browser profiling is executable; named phone/desktop p50/p95/frame/input-to-confirm measurements remain.','Provide/operate declared physical reference phone and desktop, recording conditions and trusted input measurements.'],
 U16:['EXTERNAL_PROVIDER_AUDIT','Existing project identity and candidate build can be reverified; complete historical all-write nonmutation audit is unavailable locally.','Obtain native Sites/provider historical project write log covering prior work; do not access or modify Poker MaxEV to manufacture proof.'],
 Z02:['TECHNICAL_PLUS_PROVIDER_AUDIT_RELEASE','Current build/guest smoke executable. Historical nonmutation proof and signed-off actual deployment require provider evidence and completed release gates.','Provide historical write audit; final deployment only after every mandatory gate passes.'],
 Z12:['WORK_EXECUTABLE_WITH_UPSTREAM_GATES','Complete exact criterion/source/build/input/expected-observed qualification, retain honest unknown statuses and fail-closed release decision.','No separate account needed for local audit; missing upstream device/user/provider checks cannot be waived.'],
 V513:['MIXED_TECHNICAL_EXTERNAL','Actual document reload and interrupted transaction are executable; actual OS suspend/kill during pending bot/settlement remains distinct.','On physical supported browser, suspend/kill while pending, reopen and record exact revision/ledger/payout agreement.'],
 V518:['MIXED_TECHNICAL_EXTERNAL','Cloud2/6/10performance and keyboard/color labels are executable; named reference devices and real reader remain.','Run declared phone/desktop and screen-reader matrix with p50/p95/render/memory/error measurements.'],
 V522:['WORK_PLUS_CONNECTED_CI','Local workflow blocks failures and preserves V7 authority. Hosted source-bound runner execution still requires a supported authorized connection.','Connect an authorized hosted repository/runner, then retain actual run ID, commit/artifact provenance and failure-blocking proof. Do not invent GitHub mirror.'],
 V620:['WORK_EXECUTABLE_WITH_UPSTREAM_GATES','Complete every passing critical original-ID proof, including actual engine/policy/room/seed/environment/build and expected/observed cases.','No separate account for local verifier; obtain exact missing browser/device/historical artifacts rather than retagging current files.'],
 V707:['EXTERNAL_NEW_USER_EVALUATION','No automated harness substitutes for3newusers×25hands and observed misclick/ambiguity reports.','Recruit three actual new users on specified mobile/desktop; record minraise/raise-to/call tasks and each user’s25hands, misclicks and observations.'],
};
assert.equal(rows.length,302);assert.equal(new Set(rows.map(r=>r.id)).size,302);assert.equal(json('docs/specs/backlog-source.json').length,86);
assert.deepEqual(Object.keys(actions).sort(),baseline.requirements.map(r=>r.id).sort(),'All55 gaps need an individual reviewed action');
const artifact=path=>{
 if(!existsSync(path))return{path,status:'ABSENT'};
 const bytes=read(path),result={path,status:'PRESENT_NOT_AUTOMATICALLY_QUALIFIED',sha256:sha(bytes),bytes:bytes.length};
 if(path.endsWith('.json')&&statSync(path).size<1_000_000)try{const value=JSON.parse(bytes);result.recordedSource=value.sourceCommit??value.sourceSnapshot?.gitCommit??null;result.recordedBuildKeys=Object.keys(value.buildHashes??{});result.recordedStatus=value.status??null;}catch{result.jsonParse='FAILED';}
 // Introduction is archive provenance, explicitly not execution provenance.
 result.archivedAtCommit=execFileSync('git',['log','--diff-filter=A','--format=%H','--',path],{encoding:'utf8'}).trim().split('\n')[0]||null;
 return result;
};
const requirements=baseline.requirements.map(old=>{const row=byId.get(old.id);assert.equal(row.acceptance,old.originalCriterion,`Original wording changed: ${old.id}`);const [workClass,nextAction]=actions[old.id];return{id:row.id,title:row.title,originalCriterion:row.acceptance,criterionSha256:sha(row.acceptance),originalStatus:row.status,gateBasis:row.r1_gate_basis,category:old.category,workClass,nextAction,sourceReferences:[...new Set(old.existingEvidence.split(';').map(p=>p.trim()).filter(Boolean))].map(artifact),qualificationProposal:['Y12','V601'].includes(row.id)?'tests/step5e-gates/evidence/exact-source/qualification-results.json':null,statusChanged:false};});
const mandatoryGates=Object.entries(mandatory).map(([id,[dependencyClass,workExecutable,externalAction]])=>{const row=byId.get(id);assert(row&&row.r1_blocking==='YES');return{id,title:row.title,originalCriterion:row.acceptance,criterionSha256:sha(row.acceptance),originalStatus:row.status,dependencyClass,workExecutable,externalAction,fullCriterionExecuted:false};});
const report={format:'step5e-individual-r1-evidence-review',version:1,at:new Date().toISOString(),sourceCommit:execFileSync('git',['rev-parse','HEAD'],{encoding:'utf8'}).trim(),originalRequirements:302,deferredFeatures:86,registerSHA256:sha(read('ACCEPTANCE_STATUS.csv')),baselineReview:{path:baselinePath,sha256:sha(read(baselinePath)),previousQualified:172,effectiveCriticalPassCount:227,remaining:55},statusCounts:Object.fromEntries(['PASS','FAIL','BLOCKED','NOT_EXECUTED'].map(s=>[s,rows.filter(r=>r.status===s).length])),qualificationBoundary:'Two proposed baseline qualifications have actual new tests; no CSV status is changed. New production changes require current regression. Archived-at commit is not a claimed execution commit. Unmapped passing tests never become acceptance passes.',requirements,mandatoryGates,physicalIPhoneExport:'AWAITING USER VERIFICATION',decision:'NOT_READY_FOR_R1'};
const output=process.argv[2]??'tests/step5e-gates/evidence/individual-review.json';assert(/^tests\/step5e-gates\/evidence\/[A-Za-z0-9_./-]+\.json$/.test(output)&&!output.includes('..'),'Output must remain in Step5E evidence');mkdirSync(dirname(resolve(output)),{recursive:true});writeFileSync(output,JSON.stringify(report,null,2)+'\n');console.log(JSON.stringify({output,individualGaps:requirements.length,mandatoryGates:mandatoryGates.length,originalRequirements:302,deferredFeatures:86,originalStatusChanged:false,decision:report.decision}));
