/** Shared premium Card Room presentation. This module has no game or storage dependencies. */
export type CasinoGame = 'live' | 'tournaments' | 'omaha' | 'heads-up' | 'blackjack' | 'slots' | 'career' | 'roulette' | 'craps' | 'baccarat' | 'races';

/** Decorative, accessible-label-free spade crest. Pure SVG: scalable and crisp on a retina phone. */
export function casinoCrest(): string {
 return `<svg class="casino-crest" viewBox="0 0 64 64" fill="none" aria-hidden="true" focusable="false"><defs><linearGradient id="casino-spade-gold" x1=".1" y1="0" x2=".9" y2="1"><stop stop-color="#fff7cb"/><stop offset=".44" stop-color="#e7b45f"/><stop offset=".7" stop-color="#916027"/><stop offset="1" stop-color="#ffe6a5"/></linearGradient></defs><path d="M32 5C24 19 6 26 6 39c0 7.3 5.4 13 12 13 5.8 0 9.6-3.8 11.7-7.6L25 58h14l-4.7-13.6C36.5 48.2 40.3 52 46 52c6.6 0 12-5.7 12-13C58 26 40 19 32 5Z" stroke="url(#casino-spade-gold)" stroke-width="3" stroke-linejoin="round"/><path d="M32 15C26 26 13 30 13 39c0 3.4 2.1 6 5 6 5.7 0 10.6-5.9 14-10 3.4 4.1 8.3 10 14 10 2.9 0 5-2.6 5-6 0-9-13-13-19-24Z" fill="url(#casino-spade-gold)" opacity=".17"/></svg>`;
}
/** Original product identity is retained; The Card Room is the visual sub-brand. */
export function casinoWordmark(): string {
 return `<span class="casino-wordmark">${casinoCrest()}<span class="casino-wordmark-type"><b>THE CARD ROOM</b><small>POKER NIGHT AI · VIRTUAL CHIPS</small></span></span>`;
}
const gameAssets: Partial<Record<CasinoGame,string>> = {
 live: 'cards',tournaments:'trophy',omaha:'diamond', 'heads-up':'duel',blackjack:'blackjack',slots:'slots',career:'trophy',roulette:'wheel',craps:'dice',baccarat:'baccarat',races:'horse'
};
/** A tiny decorative vector that follows a live clickable game card; never acts as a control. */
export function casinoGameArt(game: CasinoGame): string {
 const which=gameAssets[game]??'cards';
 const shapes:Record<string,string> = {
 cards:'<rect x="15" y="13" width="38" height="57" rx="5" transform="rotate(-14 34 41)"/><rect x="48" y="10" width="38" height="57" rx="5" transform="rotate(12 67 39)"/><path d="M65 20l7 8-7 9-7-9zM36 42c-7-7-13 3 0 12 13-9 7-19 0-12Z"/>',
 trophy:'<path d="M29 12h42v22c0 18-7 26-21 26S29 52 29 34V12ZM30 18H13v11c0 12 10 17 21 17m36-28h17v11c0 12-10 17-21 17M50 60v13m-21 8h42"/>',
 diamond:'<path d="M23 30l12-17h34l12 17-31 43L23 30ZM23 30h58M35 13l15 60 19-60"/>',
 duel:'<path d="M18 22l24 44M33 15l-21 12m58-5L46 66m21-51l21 12M20 72h59"/>',
 blackjack:'<rect x="14" y="16" width="33" height="55" rx="5" transform="rotate(-10 30 43)"/><rect x="50" y="16" width="33" height="55" rx="5" transform="rotate(10 66 43)"/><path d="M31 28l-6 10 6 10 6-10zM66 28l-8 10 8 9 8-9z"/>',
 slots:'<rect x="12" y="18" width="76" height="60" rx="9"/><path d="M23 25v43m25-43v43m26-43v43"/><path d="M28 41l12 2-8 15m17-17 13 2-8 15m12-17 13 2-8 15"/>',
 wheel:'<circle cx="50" cy="45" r="28"/><circle cx="50" cy="45" r="8"/><path d="M50 17v56m-28-28h56M30 25l40 40m0-40L30 65"/>',
 dice:'<rect x="15" y="25" width="37" height="37" rx="6"/><rect x="50" y="17" width="34" height="34" rx="6"/><circle cx="28" cy="38" r="3"/><circle cx="40" cy="50" r="3"/><circle cx="60" cy="27" r="3"/><circle cx="72" cy="39" r="3"/>',
 baccarat:'<rect x="14" y="19" width="38" height="53" rx="5"/><rect x="50" y="13" width="38" height="53" rx="5"/><path d="M33 33l-7 10 7 10 7-10zM69 27l-8 10 8 10 8-10z"/>',
 horse:'<path d="M23 61l11-23 15-14 15 3 14-13 4 18-11 9-3 12-15 4-5 19m-9-20-11 20m23-21 10 21M35 37l-14-9"/>'
 };
 return `<svg class="casino-game-art" viewBox="0 0 100 90" fill="none" aria-hidden="true" focusable="false"><circle cx="51" cy="45" r="40" stroke="currentColor" opacity=".14"/><circle cx="51" cy="45" r="34" stroke="currentColor" opacity=".13"/> <g stroke="currentColor" stroke-linecap="round" stroke-linejoin="round" stroke-width="3" fill="currentColor" fill-opacity=".11">${shapes[which]}</g></svg>`;
}
export function casinoHomeHero(): string {
 return `<div class="casino-home-hero"><div class="casino-home-copy"><span class="casino-kicker">♠ &nbsp; A PRIVATE VIRTUAL CARD ROOM &nbsp; ♠</span><h2>THE <em>CARD ROOM</em></h2><p>Premium poker, blackjack, roulette, craps, baccarat and racing. Eight illustrated slots. Your decisions.</p><div class="casino-hero-actions"><a href="#home-game-collection" class="casino-hero-link">Explore the games <span aria-hidden="true">↗</span></a><button type="button" class="button secondary" data-view="slots">Visit the slot floor</button></div><small>Practice simulator · Virtual chips only · No real-money wagering</small></div><div class="casino-home-art" aria-hidden="true"><span class="casino-hero-medallion">${casinoCrest()}</span><span class="casino-fan casino-fan-one">A♠</span><span class="casino-fan casino-fan-two">K♠</span><span class="casino-chip-art">♠</span></div><div class="casino-hero-signature" aria-hidden="true">EST. IN THE CARDS <b>♠</b> ALL GAMES · ONE CARD ROOM</div></div>`;
}

/** Visual-only preview links to real supported lobby routes. No invented jackpots, balances or actions. */
export function casinoFeaturedMachines(): string {
 const ids:[string,string,string][]=[['wheel-of-riches','Wheel of Riches','Prize wheel'],['gold-rush','Gold Rush','Free spins'],['lucky-lightning','Lucky Lightning','Hold & Spin']];
 return `<section class="casino-featured-floor" aria-label="Explore the slot floor"><div class="casino-featured-title"><span>THE PRIVATE CASINO COLLECTION</span><b>Signature slot machines</b><small>Illustrated virtual-chip games · Choose a machine on the slot floor</small></div><div class="casino-featured-list">${ids.map(([id,name,tag])=>`<button type="button" class="casino-featured-machine" data-view="slots" aria-label="Explore ${name} on the slot floor"><img src="/casino-art/${id}-marquee.webp" alt="" loading="lazy" decoding="async"><strong>${name}</strong><span>${tag} <i aria-hidden="true">↗</i></span></button>`).join('')}</div></section>`;
}
