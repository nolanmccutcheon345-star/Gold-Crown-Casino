import {describeHandProvenance, type HandNamespace, type ProvenanceCarrier} from '../session/hand-provenance';

/** Read-only display of an already audited record. Storage/import validation
 * verifies every replay frame; this label only needs the final public profile. */
export function handOriginDescription(hand:Pick<ProvenanceCarrier,'provenance'|'view'>,namespace:HandNamespace):string {
  const origin=describeHandProvenance({provenance:hand.provenance,view:hand.view},namespace);
  if(origin.mode==='study')return 'Mode: Study only · Source: Replay import · No bankroll or cash-stat credit';
  const mode=origin.mode==='lab'?'Lab':'Cash practice';
  const source=origin.source==='csprng'?'CSPRNG (recorded)':origin.source==='fixed-deck'?'Fixed deck (recorded)':'Unknown (legacy record)';
  return `Mode: ${mode} · Source: ${source}`;
}
