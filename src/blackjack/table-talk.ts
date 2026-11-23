/** Patch 76: blackjack table life. The other players at a full table talk the way people at a real table do: they cheer
 * a dealer bust, groan at a dealer blackjack, toke the dealer after a blackjack, notice a hot or cold table, and grumble
 * when you "take the dealer's bust card" (a superstition: it changes nothing about the odds, and the coach still tells
 * you the right play). Presentation only: seat decisions and the shoe are frozen for replay and are not touched. Lines
 * are picked from the round id, so the same round always says the same thing. */
import type { PlayerStyle } from './table-players';
import { personaFor } from '../bots/personas';
import { gestureFor, heroQuestionLine, smallTalk } from '../bots/banter';
/** Questions that make sense at a blackjack table. */
export const BJ_QUESTIONS = ['from', 'often', 'team', 'night', 'learn', 'drink', 'work'] as const;

export interface TalkHand { cards: readonly string[]; total: number; status: string; result?: string | null; doubled?: boolean }
export interface TalkSeat { seat: number; name: string; style: PlayerStyle | null; hands: readonly TalkHand[] }
export interface TalkRound { id: string; dealer: readonly (string | null)[]; hero: readonly TalkHand[]; seats: readonly TalkSeat[];
 /** Patch 104: your insurance bet and what it paid back (0 when the dealer had no blackjack). */
 insurance?: { bet: number; back: number } }
export interface TalkLine { seat: number; text: string }
/** Dealer bust (true) or not (false) for the last few rounds, newest last. */
export type TableMood = readonly boolean[];

const value = (card: string) => card[0] === 'A' ? 11 : 'TJQK'.includes(card[0]) ? 10 : Number(card[0]);
export function dealerTotal(cards: readonly string[]): number {
 let total = cards.reduce((a, c) => a + value(c), 0), aces = cards.filter(c => c[0] === 'A').length;
 while (total > 21 && aces > 0) { total -= 10; aces--; }
 return total;
}
const hash = (text: string) => { let h = 0x811c9dc5; for (let i = 0; i < text.length; i++) { h ^= text.charCodeAt(i); h = Math.imul(h, 0x01000193) >>> 0; } return h; };
const pick = <T>(list: readonly T[], key: string): T => list[hash(key) % list.length];
const chance = (key: string, percent: number) => hash(key) % 100 < percent;

const CHEER = ['Dealer’s dead! Pay everybody!', 'Twenty-six! Beautiful!', 'Break, baby!', 'Bust! Pay the table!', 'There it is!', 'Dealer breaks, everybody eats!', 'Pay us!', 'Dealer busts! Winner winner!', 'Pay the whole table!', 'Thank you, dealer!'];
const GROAN = ['Ten underneath. Always.', 'Dealer’s got a horseshoe.', 'Seventeen to twenty-one again?', 'Of course.', 'Every time.', 'Dealer’s hot tonight.', 'Ugh, a ten under there.', 'Twenty again? Come on.', 'How does the dealer always have it?'];
const BJ_SELF = ['Look at that!', 'Blackjack! Pay me!', 'There’s my twenty-one!', 'Blackjack, baby!', 'Twenty-one!', 'Finally!', 'Look at that! Ace-king!', 'Pay me three to two!'];
const BJ_NICE = ['Blackjack! Nice!', 'Somebody’s lucky tonight.', 'That’s how it’s done.', 'Nice hand!', 'There you go.', 'Good one!', 'Look at you!', 'Lucky!'];
const TOKE = ['One for you, dealer.', 'Here, that’s for you.', 'Dealer’s bet!', 'Toke for the dealer, she’s been good to us.'];
const BUST_CARD = ['You took the dealer’s bust card!', 'Why’d you hit that? The dealer was busting!', 'Dealer had a stiff, man…'];
const GOOD_HIT = ['Good hit!', 'Nice, that fed the dealer a bust.'];
const BIG_DOUBLE = ['Big double!', 'Love that double.'];
const HOT = ['Don’t change a thing!', 'Who brought the good luck?', 'Dealer, you’re the best!', 'This table is hot!', 'Don’t anybody leave, we’re rolling.', 'Nobody touch anything. We’re hot.', 'Keep it coming, dealer!'];
const COLD = ['I’m changing tables after this shoe.', 'Can we color up and go home?', 'Dealer, have mercy.', 'This dealer is killing us.', 'Time for a new dealer.', 'Maybe I should switch tables.', 'I need a new shoe.', 'This shoe is cursed.'];
const SELF_BUST = ['Of course it’s a ten.', 'Greedy. I was greedy.', 'Why do I ever hit sixteen?', 'Too many.', 'Twenty-two. Of course.', 'Should’ve stayed.', 'Ugh, a face card.', 'Busted again.'];
const SELF_DOUBLE = ['Pay me double!', 'Eleven never lies.', 'That’s why you double!', 'Double down, double fun!', 'Doubled and got there!', 'Love an eleven.'];
const HERO_BUST = ['Ouch.', 'Too many, huh?', 'Tough card.', 'That ten, man.', 'Unlucky.', 'Get ’em next time.'];
const HERO_DRAW21 = ['Look at that! Twenty-one!', 'Nice draw!', 'Four cards to twenty-one!', 'Now that’s a hit!'];
const HERO_PUSH = ['At least it’s a push.', 'Push. Better than losing.', 'Nobody wins, nobody loses.'];
const SPLIT_TENS = ['Splitting tens?!', 'You’re splitting twenty?'];
/* Patch 104: surrender, split aces, five-card hands, insurance, and players answering each other. */
const HERO_SURRENDER = ['Smart. Live to fight another hand.', 'Half back beats nothing.', 'Surrender? Respect.', 'Good call. That one was ugly.', 'Saved half. Not bad.'];
const SURRENDER_BUST = ['Ooh, dealer busted. Would’ve won that.', 'Dealer broke! Bad timing on the surrender.', 'Hindsight, man. Dealer busted.'];
const SPLIT_ACES = ['Split aces and both got there!', 'Two aces, two winners!', 'That’s why you split aces!'];
const FIVE_CARD = ['Five cards! Look at that hand!', 'Five-card hand! Beautiful.', 'Little cards all the way. Nice!'];
const INSURED = ['Insurance paid! Good call.', 'You smelled that blackjack.', 'Nice insurance.'];
const INSURED_LOST = ['Insurance never pays.', 'Took insurance? Dealer didn’t have it.', 'That insurance cost you.'];
const ECHO_CHEER = ['Pay us all!', 'Told you she’d break!', 'Everybody eats!', 'Yes!', 'That’s what I’m talking about!'];
const ECHO_GROAN = ['Every time.', 'Tell me about it.', 'Brutal.', 'Same old story.', 'Ugh.'];

/** What the table says when a round settles. At most three lines, from different players. */
export function roundChatter(round: TalkRound, mood: TableMood): TalkLine[] {
 const dealer = round.dealer.filter((c): c is string => !!c);
 if (dealer.length < 2) return [];
 const total = dealerTotal(dealer), bust = total > 21, dealerBJ = dealer.length === 2 && total === 21, up = value(dealer[0]);
 const players = round.seats.filter(s => s.hands.length);
 if (!players.length) return [];
 const out: TalkLine[] = [], used = new Set<number>(), k = round.id;
 const say = (seat: TalkSeat | undefined, list: readonly string[], tag: string) => { if (!seat || used.has(seat.seat) || out.length >= 3) return; used.add(seat.seat); out.push({ seat: seat.seat, text: pick(list, `${k}:${tag}:${seat.seat}`) }); };
 const who = (tag: string, filter: (s: TalkSeat) => boolean = () => true) => { const list = players.filter(s => !used.has(s.seat) && filter(s)); return list.length ? list[hash(`${k}:${tag}`) % list.length] : undefined; };
 // A player's own blackjack, and maybe a toke for the dealer.
 const natural = players.find(s => s.hands.some(h => h.cards.length === 2 && h.total === 21 && s.hands.length === 1));
 if (natural && !dealerBJ) { say(natural, chance(`${k}:toke`, 40) ? TOKE : BJ_SELF, 'bj'); }
 const heroNatural = round.hero.some(h => h.cards.length === 2 && h.total === 21) && round.hero.length === 1;
 if (heroNatural && !dealerBJ && chance(`${k}:nice`, 60)) say(who('nice'), BJ_NICE, 'nice');
 // Patch 96: the table talks to you about your own hand.
 if (round.hero.some(h => h.total > 21) && !bust && chance(`${k}:herobust`, 30)) say(who('herobust'), HERO_BUST, 'herobust');
 if (round.hero.some(h => h.cards.length >= 4 && h.total === 21) && chance(`${k}:herofive`, 65)) say(who('herofive'), HERO_DRAW21, 'herofive');
 if (round.hero.some(h => h.result === 'push') && !round.hero.some(h => h.result === 'win') && chance(`${k}:heropush`, 15)) say(who('heropush'), HERO_PUSH, 'heropush');
 if (bust && chance(`${k}:cheer`, 75)) say(who('cheer'), CHEER, 'cheer');
 if (dealerBJ || (!bust && total >= 20 && chance(`${k}:groan`, 40))) say(who('groan'), GROAN, 'groan');
 // The superstition: you hit a stiff against a weak up card and the dealer made a hand.
 const heroHitStiff = round.hero.some(h => h.cards.length >= 3 && !h.doubled && dealerTotal(h.cards.slice(0, 2)) >= 12 && dealerTotal(h.cards.slice(0, 2)) <= 16);
 if (heroHitStiff && up >= 2 && up <= 6) {
  if (!bust && chance(`${k}:card`, 70)) say(who('card', s => s.style === 'never-bust' || s.style === 'mimic-dealer') ?? who('card2'), BUST_CARD, 'card');
  else if (bust && chance(`${k}:goodhit`, 40)) say(who('goodhit'), GOOD_HIT, 'goodhit');
 }
 if (round.hero.some(h => h.doubled && (h.result === 'win' || h.result === 'blackjack')) && chance(`${k}:double`, 50)) say(who('double', s => s.style === 'gambler') ?? who('double2'), BIG_DOUBLE, 'double');
 if (round.hero.length > 1 && round.hero.every(h => value(h.cards[0]) === 10) && chance(`${k}:tens`, 80)) say(who('tens', s => s.style !== 'gambler'), SPLIT_TENS, 'tens');
 // A streak of dealer busts or dealer wins.
 const recent = [...mood, bust].slice(-5);
 if (recent.length >= 3 && recent.slice(-3).every(Boolean)) say(who('hot'), HOT, 'hot');
 if (recent.length >= 5 && recent.every(x => !x) && chance(`${k}:cold`, 30)) say(who('cold'), COLD, 'cold');
 // Patch 104: your surrender, split aces, a five-card winner, and how your insurance went.
 if (round.hero.some(h => h.status === 'surrendered') && chance(`${k}:surrender`, 45)) say(who('surrender'), bust ? SURRENDER_BUST : HERO_SURRENDER, 'surrender');
 if (round.hero.length > 1 && round.hero.every(h => h.cards[0]?.[0] === 'A' && (h.result === 'win' || h.result === 'blackjack')) && chance(`${k}:aces`, 75)) say(who('aces'), SPLIT_ACES, 'aces');
 if (round.hero.some(h => h.cards.length >= 5 && h.total < 21 && h.result === 'win') && chance(`${k}:five`, 60)) say(who('five'), FIVE_CARD, 'five');
 if (round.insurance && round.insurance.bet > 0) { if (round.insurance.back > 0 && chance(`${k}:ins`, 70)) say(who('ins'), INSURED, 'ins'); else if (!round.insurance.back && chance(`${k}:insl`, 25)) say(who('insl', s => s.style !== 'gambler') ?? who('insl2'), INSURED_LOST, 'insl'); }
 // Patch 104: a second player chimes in on a cheer or a groan.
 const echo = out[0] && (CHEER.includes(out[0].text) ? ECHO_CHEER : GROAN.includes(out[0].text) ? ECHO_GROAN : null);
 if (echo && out.length < 3 && chance(`${k}:echo`, 40)) say(who('echo'), echo, 'echo');
 // Patch 86: a player's own bust or winning double, and small talk when nobody else spoke.
 const selfBust = players.find(s => !used.has(s.seat) && s.hands.some(h => h.total > 21));
 if (selfBust && chance(`${k}:selfbust`, 30)) say(selfBust, SELF_BUST, 'selfbust');
 const selfDouble = players.find(s => !used.has(s.seat) && s.hands.some(h => h.doubled && (h.result === 'win' || h.result === 'blackjack')));
 if (selfDouble && chance(`${k}:selfdouble`, 45)) say(selfDouble, SELF_DOUBLE, 'selfdouble');
 if (!out.length && chance(`${k}:small`, 18)) {
  const first = who('small');
  // Patch 95: a real conversation (an opener and one or two answers), or the old opener and answer.
  if (first && chance(`${k}:thread`, 70)) { const talk = smallTalk(players.map(s => ({ id: s.seat, name: s.name })), `${k}:thread`, false); for (const l of talk) { const seat = players.find(s => s.seat === l.seatId); if (seat && !used.has(seat.seat) && out.length < 3) { used.add(seat.seat); out.push({ seat: seat.seat, text: l.text }); } } }
  else if (first) { say(first, personaFor(first.name).openers, 'small'); const second = who('answer'); if (second && chance(`${k}:answer`, 55)) say(second, personaFor(second.name).answers, 'answer'); }
 }
 // Patch 98: now and then a player asks you something (you can answer from the quick-chat row).
 if (out.length < 2) { const q = heroQuestionLine(players.filter(s => !used.has(s.seat)).map(s => ({ id: s.seat, name: s.name })), `${k}:question`, .06, BJ_QUESTIONS); if (q) { const seat = players.find(s => s.seat === q.line.seatId)!; used.add(seat.seat); out.push({ seat: seat.seat, text: q.line.text }); } }
 // Patch 95: a gesture now and then from someone who said nothing.
 if (out.length < 2 && chance(`${k}:gesture`, 20)) { const g = who('gesture'); if (g) say(g, [gestureFor(g.name, `${k}:gesture`)], 'gesture'); }
 return out;
}
