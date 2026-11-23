import {UNAVAILABLE_FEATURES} from '../session/release-scope';

/** A disclosure only: no enabled callback, URL switch, or local flag exists. */
export function unavailableFeaturesMarkup():string {
 return `<details class="unavailable-features" data-testid="unavailable-features"><summary>Unavailable features and future modes</summary><p>Cash R1 supports No-Limit Texas Hold’em practice. These options remain unavailable and do not delay the supported cash release.</p><div class="unavailable-feature-list">${UNAVAILABLE_FEATURES.map(feature=>`<div class="unavailable-feature"><button type="button" class="button secondary" disabled aria-disabled="true" data-unavailable-feature="${feature.id}" aria-describedby="unsupported-${feature.id}">${feature.label} · unavailable</button><p id="unsupported-${feature.id}"><b>${feature.phase}.</b> ${feature.reason}${feature.backlog?` <small>Deferred record: ${feature.backlog}.</small>`:''}</p></div>`).join('')}</div><p>Future formats require compatible rules, settlement, recovery and acceptance tests before they can be enabled. A URL parameter or saved local flag cannot activate them.</p></details>`;
}
