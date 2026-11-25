import { mttProfileAt } from '../tournament/mtt-event';
import { answerRow, chatterFor, heroSaidMarkup, HERO_SAY_MS, namesAt, quickChatRow, quipFor, quipMarkup, readTableTalk, saveTableTalk, shownHand, talkMarkup, type HeroSaid } from './table-talk';
import { HERO_PHRASES, answerHero, chimeIn, questionOf, reactTo, type HeroQuestion, heroHandOf, mutterFor, spectatorLine, withBanter, type HeroPhrase } from '../bots/banter';
import { QUIET, regularOfProfile, type TalkLine } from '../bots/talk';
import { STRONG_CUES, WEAK_CUES, liveTells, lastActionTells, needleFor, type Tells } from '../bots/tells';
import { tempoOf, TEMPO_LINES, type Tempo } from '../bots/tempo-reads';
import { tellNotes } from './tell-coach';
import { greetingFor, MEMORY_LINES } from '../bots/hero-memory';
import { cashMemoryReads } from '../session/human-context';
import { dealerLines, speakDealer } from './dealer-voice';
import { ordinal } from '../tournament/screens';
import { readCareer, saveCareer, startCareer, careerStatus, newMilestones, changeLevel, stakeName, LADDER, MOVE_UP_BUYINS, MOVE_DOWN_BUYINS, MOVE_UP_HANDS, BUYIN_BB, type Career } from './career';
import { tableChoices, seatPreview, moveSeat, straddleTable, type TableChoice } from './table-picker';
import { findLeaks, leakTrends, type Leak } from '../stats/leaks';
import { cashResult, tournamentResult, blackjackResult, omahaResult, slotsResult, casinoResult, type GameResult } from '../stats/by-game';
import { careerStats, slotsMachines, CAREER_GAMES, type CareerGameId, type CareerSources, type CareerStats } from '../stats/career';
import { readStatsBook, saveStatsBook, takeSnapshot, deleteSnapshot, resetCounters, clearBaseline, cursorsFromSources, periodStats, periodArchives, type StatsBook } from '../stats/snapshots';
import { readDailyBook, saveDailyBook, ensureDay, fixBjBaseline, setSessionGoal, localDayKey, dailyObjectives, cashToday, handStreak, type DailyBaselines, type DailyBook } from '../stats/daily';
import { CASINO_GAMES } from '../casino/wallet';
import { machineById, MACHINES } from '../slots/machines';
import { newHandId } from '../identity';
import { readSlots, saveSlots, type GambleChoice } from '../slots/state';
import { SlotsPlayer } from '../slots/play';
import { CasinoPlayer } from '../casino/play';
import { casinoMarkup } from '../casino/view';
import './tokens.css';
import './casino.css';
import { slotsMarkup, freshSlotsUi } from '../slots/view';
import { deepStats, heroExtras, pct as countPct, aggressionFactor, aggressionFrequency, type PlayerStats, type Count } from '../stats/deep';
import { findTournamentLeaks, pushDrills, tournamentCoachHands } from '../stats/tournament-coach';
import { buildDrills, answerDrill, observedStyle, type Drill, type DrillAnswer, type DrillChoice } from '../stats/drills';
import { advise, type TournamentCoachContext } from '../coach/coach';
import { mttStandings, playerAt } from '../tournament/multi-table';
import { coachMarkup, coachReviewMarkup, freshCoachUi, saveCoachUi, reviewAction } from '../coach/view';
import {cashGrudges,cashIdentity} from '../session/human-context';
import {grudge} from '../bots/rivalry';
import {fastForwardTournament} from '../tournament/fast-forward';
import type { Action, Card, GameState, HeroViewModel, RuleProfile } from '../contracts';
import type { CashSettings, PublicHand, StoredHand } from '../session/types';
import { SessionController, DEFAULT_SETTINGS } from '../session/controller';
import { frozenPolicyVersions, projectLivePace, STAT_DEFINITIONS, deriveCashStats, type CashStats, type MetricKey, type RateStat, type ResultGroup as CashResultGroup } from '../stats/cash';
import { cashPerformanceHands, stakesTierGroups, heroVsOpponents, biggestPots, headsUpHands, buyInTierGroups, biggestCashes, ploDrill, blackjackDrill, rouletteDrill, baccaratDrill, crapsDrill, racesDrill, slotsDrill } from '../stats/drilldown';
import type { BlackjackRound } from '../blackjack/engine';
import {AsyncCashStats} from './async-cash-stats';
import {ALL_CASH_RESULTS_FILTER,cashResultsFilterMarkup,deriveFilteredCashStats,type CashResultsFilter,type FilteredCashResults} from './cash-results-filter';
import { projectView, nextHandStraddleSeat } from '../core/engine';
import './styles.css';
import './session-controls.css';
import { prepareHistoryBatchFiles, shareableFile, sharePreparedHistory, type HistoryFiles } from './history-file';
import { perimeterLayout, shortPerimeterLayout } from './table-layout';
import { initializeOpponentSettings, opponentSetup, randomizeOpponentSettings, readOpponentSettings, seatRegulars, OPPONENT_LABELS } from './opponent-setup';
import { observedOpponentCards } from './opponent-study';
import { publicMemoryHands } from '../session/bot-observation';
import { buildOpponentMemory } from '../bots/policy';
import { bigBlindSizing, incrementSizing, inspectSizing, openSizing, POT_PERCENT_PRESETS, POT_SIZING_BASIS, potPercentOf, potSizing, PREFLOP_OPEN_BIG_BLINDS, PREFLOP_RAISE_MULTIPLES, raiseMultipleSizing, type SizingContext, type SizingProposal } from './bet-sizing';
import './release-controls.css';
import { timed } from '../performance/timing';
import { isVerifiedSnapshot } from '../storage/verified';
import { pokerStarsProfile } from '../rules/pokerstars';
import { previewPublicStudyImport, type StudyImportPreview } from '../storage/study-import';
import { studyImportPreviewMarkup } from './study-import-preview';
import { DELETE_PRACTICE_CONFIRMATION } from '../storage/erasure';
import { deletedPracticeMarkup, privacyControls } from './privacy-controls';
import { backupControls, restoreMarkup, RESTORE_CONFIRMATION, type BackupState } from './backup-controls';
import { makeBackup, readBackup, type Backup } from '../storage/backup';
import { promoBoard, tokeSelect, houseTakeMarkup, dollars } from './promo-board';
import { replayLog, streetJumps, heroSpot, miniTable, replayImage, actorLine, type LogEntry } from './replayer';
import { LADDER_IDS, readLadder, saveLadder, matchSettings, matchState, recordMatch, ladderMarkup, matchBanner, matchLine, noticedMarkup, nextRung, type MatchRecord } from './heads-up';
import { cashInsight } from '../session/human-context';
import { PloTable, savePlo, PLO_STAKES } from '../plo/table';
import { ploMarkup, ploFlights, flySnapshot, type PloUiState, type FlySnapshot } from '../plo/view';
import { withRestless, foldStreak } from '../bots/restless';
import { countUp } from './count-up';
import { readLivePaceInput } from './live-pace';
import { ruleVersionMarkup } from './rule-version';
import { handOriginDescription } from './hand-origin';
import { unavailableFeaturesMarkup } from './release-scope';
import { canRevealSessionStyles, recordedSessionStyles } from './post-session-insight';
import { getPlayerNote } from '../session/notes';
import { playerNotesMarkup } from './player-notes';
import { configurationHistoryMarkup } from './configuration-history';
import { tableSeatSlots } from './table-capacity';
import { LIVE_ONE_TWO_DISCLOSURE, occupiedSeatIds, syntheticLiveOneTwoPreset, normalizeTableSettings } from '../session/configuration';
import './opponent-setup.css';
import {cardName,focusSelector,restoreFocus,savedPracticeAnnouncement,tableAnnouncement} from './accessibility';
import {assertStudyImportRights,importRightsMarkup,PRACTICE_DISCLOSURE} from './practice-disclosure';
import { morphInto, snapshotScroll, restoreScroll } from './dom-morph';
import './accessibility.css';
import './phone-play.css';
import './desktop-play.css';
import './host-setup.css';
import { lobbyMarkup, normalizeLobby, tournamentRecordMarkup, type LobbyState } from '../tournament/screens';
import { findPreset, entryCost } from '../tournament/presets';
import { TournamentController } from '../tournament/controller';
import { tournamentPlayMarkup, bindTournamentPlay, tournamentAnnouncement } from './tournament-play';
import './tournament-play.css';
import './tournament.css';
import { blackjackTabsMarkup, COACH_TABLES, countTrainerMarkup, deviationCoachMarkup, normalizeBlackjackLobby, strategyCoachMarkup, type BlackjackLobbyState, type BlackjackTab } from '../blackjack/screens';
import { checkCount, dealNext, DEFAULT_TRAINER, newTrainer, retune, secureIndex, type TrainerSettings, type TrainerState } from '../blackjack/trainer';
import { deviationQuestion, gradeDrill, newDrill, nextDrill, strategyQuestion, type DrillState } from '../blackjack/drills';
import { strategyRules } from '../blackjack/presets';
import type { CountSystemId } from '../blackjack/counting';
import type { Play } from '../blackjack/strategy';
import './blackjack.css';
import './full-table.css';
import './blackjack-table.css';
import './blackjack-seats.css';
import './polish.css';
import './structure.css';
import './motion-more.css';
import './visuals.css';
import './slots.css';
import './landscape.css';
import './premium-casino.css';
import './casino-design.css';
import './casino-visual107.css';
import './casino-visual108.css';
import './casino-visual109.css';
import './shell.css';
import { casinoWordmark, casinoHomeHero, casinoGameArt, casinoFeaturedMachines } from './casino-components';
import { dealClass, readMotion, saveMotion, turnTitle } from './motion';
import { FACE_PARTS, avatarSvg, faceFor, liveMood, sessionMoodFace, type FacePart, type Mood } from './avatars';
import { setTableFaces } from './face-hook';
import { personaFor } from '../bots/personas';
import { sideTells, sideTellMarkup, TELL_GUIDE, type SideTell } from '../bots/more-tells';
import { DEFAULT_HERO_PORTRAIT, PORTRAIT_COUNT, portraitFor, portraitMarkup, tablePortraits, tablePortraitsForSeats } from './portraits';
import { potPile, winningCards } from './showdown-cards';
import { allInSpotlight, headsUpPotsNet, rivalsOf, sessionRecap, sparkline, stackBaselines, stackTrend } from './recap';
import { BACKS, BREAK_CHOICES, FELTS, TEXT_SIZES, THEMES, breaksDue, chipStackMarkup, heroHandLabel, readStyle, saveStyle, shortcutTarget, styleClasses, type TableStyle } from './table-style';
import { durationText, emoteMarkup, handMoment, momentMarkup, seatEmote, summarizeSession, tournamentFlags, tournamentMoment as eventMilestone, type SessionSummary, type TournamentFlags } from './moments';
import { cashMilestones, sessionResults, sessionStreaks, tournamentMilestones, type Milestone } from './achievements';
import { bankrollSeries, bindCharts, lineChartMarkup, resultSeries } from './charts';
import { canVibrate, playCues, playSound, soundCues, soundState, unlockAudio, vibrateFor, setVolume, ploSoundState, ploSoundCues, bjSoundCues, ambience, type SoundKind, type SoundState, type PloSoundState, type BjSoundState } from './sounds';
import { BlackjackLiveUI } from '../blackjack/live-ui';
import { regularFor, regularById, isRegularName, REGULARS } from '../bots/regulars';
import { cashThinkPlan, pacedMs, READ_HOLD_MS, tournamentThinkPlan } from './think-time';
import { cashBreak } from '../session/human-context';
import { tournamentMoment, tournamentRecent } from '../tournament/runtime';
import { cashRecentResults } from '../session/human-context';
import { moodFrom } from '../bots/human';
import { farewellLine, headsUpExtra, heroShowdowns, heroTankLine, idleActivity, reraiseLine, sweatLine } from '../bots/table-life';
import { policyUsesMood } from '../tournament/bot-policy';
import { tournamentStats, DEFAULT_STATS_FILTER, type StatsFilter, type TournamentStats } from '../tournament/stats';
import { tournamentStatsMarkup } from '../tournament/stats-screen';
import type { BlackjackController } from '../blackjack/controller';
import { oddsHelp, oddsHelperMarkup, ODDS_HELPER_KEY } from './odds-helper';

/** Patch 78: where you are, above every page title. */
const SECTION_LABELS: Record<string, string> = { home: 'WELCOME BACK', live: 'PLAY · HOLD’EM CASH', session: 'PLAY · HOLD’EM CASH', host: 'PLAY · TABLE SETUP', tournaments: 'PLAY · TOURNAMENTS', omaha: 'PLAY · POT-LIMIT OMAHA', 'heads-up': 'PLAY · HEADS-UP', career: 'PLAY · CAREER', blackjack: 'PLAY · BLACKJACK', slots: 'PLAY · SLOTS', roulette: 'PLAY · ROULETTE', craps: 'PLAY · CRAPS', baccarat: 'PLAY · BACCARAT', races: 'PLAY · HORSE RACING', study: 'HISTORY', results: 'STATS · CASH RESULTS', 'tournament-stats': 'STATS · TOURNAMENTS', opponents: 'STATS · OPPONENTS', coach: 'STATS · COACH', 'by-game': 'STATS · BY GAME', 'deep-stats': 'STATS · DEEP STATS', 'game-detail': 'STATS · GAME DETAIL', cashier: 'CASHIER' };
/** Patch 81: small line icons for the main tabs (drawn here, no icon font). */
const NAV_ICONS: Record<string, string> = {
  home: '<path d="M3 11l9-7 9 7v9a1 1 0 0 1-1 1h-5v-6h-6v6H4a1 1 0 0 1-1-1z"/>',
  live: '<path d="M12 3c3 4 7 6 7 10a4 4 0 0 1-7 2.6A4 4 0 0 1 5 13c0-4 4-6 7-10zM12 15l-2 6h4z"/>',
  study: '<path d="M4 12a8 8 0 1 0 2.3-5.7M4 4v4h4M12 8v4l3 2"/>',
  results: '<path d="M4 20V10M10 20V4M16 20v-7M22 20H2"/>',
  cashier: '<circle cx="12" cy="12" r="8.5"/><path d="M12 7v10M9.5 9.5c0-1.2 1.1-2 2.5-2s2.5.8 2.5 2-1.1 1.7-2.5 2-2.5.8-2.5 2 1.1 2 2.5 2 2.5-.8 2.5-2"/>',
};
const navIcon = (view: string) => NAV_ICONS[view] ? `<svg class="nav-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${NAV_ICONS[view]}</svg>` : '';
const sectionLabel = (view: string) => SECTION_LABELS[view] ?? 'THE PRACTICE ROOM';
type View = 'home' | 'live' | 'host' | 'study' | 'cashier' | 'results' | 'session' | 'opponents' | 'coach' | 'by-game' | 'deep-stats' | 'game-detail' | 'career' | 'heads-up' | 'omaha' | 'tournaments' | 'tournament-stats' | 'blackjack' | 'slots' | 'roulette' | 'craps' | 'baccarat' | 'races';
/** Top-level menu. Each entry opens one page; `pages` lists the other pages of that group for the row under the header. */
const MENU: readonly { view: View; label: string; text: string; group: string; pages: readonly { view: View; label: string; text: string; short: string }[] }[] = [
  { view: 'home', label: 'Home', text: 'Home', group: 'Home', pages: [] },
  { view: 'live', label: 'Play: live table', text: 'Play', group: 'Play', pages: [{ view: 'live', label: 'Cash table', text: 'Cash table', short: 'Cash' }, { view: 'tournaments', label: 'Tournaments', text: 'Tournaments', short: 'Tourneys' }, { view: 'omaha', label: 'Pot-Limit Omaha', text: 'Omaha', short: 'Omaha' }, { view: 'heads-up', label: 'Heads-up challenge', text: 'Heads-up', short: 'Heads-up' }, { view: 'career', label: 'Career', text: 'Career', short: 'Career' }, { view: 'blackjack', label: 'Blackjack', text: 'Blackjack', short: 'Blackjack' }, { view: 'slots', label: 'Slots', text: 'Slots', short: 'Slots' }, { view: 'roulette', label: 'Roulette', text: 'Roulette', short: 'Roulette' }, { view: 'craps', label: 'Craps', text: 'Craps', short: 'Craps' }, { view: 'baccarat', label: 'Baccarat', text: 'Baccarat', short: 'Baccarat' }, { view: 'races', label: 'Horse racing', text: 'Horse racing', short: 'Races' }, { view: 'host', label: 'Host setup', text: 'Host setup', short: 'Setup' }] },
  { view: 'study', label: 'Hand history', text: 'History', group: 'History', pages: [] },
  { view: 'by-game', label: 'Stats and results', text: 'Stats', group: 'Stats', pages: [{ view: 'results', label: 'Results', text: 'Results', short: 'Results' }, { view: 'deep-stats', label: 'Deep stats', text: 'Deep stats', short: 'Deep' }, { view: 'tournament-stats', label: 'Tournament stats', text: 'Tournament stats', short: 'Tourneys' }, { view: 'opponents', label: 'Opponent study', text: 'Opponent study', short: 'Opponents' }, { view: 'coach', label: 'Leaks and drills', text: 'Leaks and drills', short: 'Coach' }, { view: 'by-game', label: 'Results by game', text: 'Results by game', short: 'By game' }] },
  { view: 'cashier', label: 'Cashier', text: 'Cashier', group: 'Cashier', pages: [] },
];
const menuGroup = (view: View) => view === 'game-detail' ? MENU.find(entry => entry.view === 'by-game')! : MENU.find(entry => entry.view === view || entry.pages.some(page => page.view === view)) ?? MENU[0];
type Settings = CashSettings;
type ReviewHand = Pick<StoredHand, 'number'|'net'|'view'|'frames'|'startedAt'|'endedAt'|'sessionId'|'provenance'> & {id:string; imported:boolean; policyVersions?:string[]; originLabel:string};
const PRESETS = [[100, 200], [100, 300], [200, 500], [500, 1000], [1000, 2000], [2000, 4000], [5000, 10000]];
const NAMES = ['You', 'Alex', 'Morgan', 'Jordan', 'Riley', 'Casey', 'Taylor', 'Drew', 'Quinn', 'Sam'];
const COLORS = ['#e9c582', '#9ca9f0', '#72c6b3', '#d9a4c4', '#dda575', '#85b8dc', '#bba4df', '#b9c57d', '#d79494', '#8ec5cb'];
// Constructing an Intl.NumberFormat costs far more than using one, and one table update formats
// well over a hundred amounts, so the two formatters are built once. Output is unchanged.
const WHOLE_DOLLARS = new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD', maximumFractionDigits: 0 });
const DOLLARS_AND_CENTS = new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD', maximumFractionDigits: 2 });
const money = (value: number) => (value % 100 ? DOLLARS_AND_CENTS : WHOLE_DOLLARS).format(value / 100);
const signed = (value: number) => `${value > 0 ? '+' : value < 0 ? '−' : ''}${money(Math.abs(value))}`;
const escape = (value: unknown) => String(value).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]!);
const title = (value: string) => value.charAt(0).toUpperCase() + value.slice(1);
function cents(value: string): number { if (!/^\d+(\.\d{1,2})?$/.test(value.trim())) throw new Error('Enter a positive amount with no more than two decimal places.'); const amount = Math.round(Number(value) * 100); if (!Number.isSafeInteger(amount)) throw new Error('That amount is too large.'); return amount; }
function card(card: Card | undefined, size = ''): string {
  if (!card) return `<span class="playing-card card-back ${size}" role="img" aria-label="Hidden card"><span aria-hidden="true">♠</span></span>`;
  const suits: Record<string, string> = { c: '♣', d: '♦', h: '♥', s: '♠' };
  const rank = card[0] === 'T' ? '10' : card[0];
  return `<span class="playing-card ${'dh'.includes(card[1]) ? 'red-card' : ''} suit-${card[1]} ${size}" role="img" aria-label="${escape(cardName(card))}"><b aria-hidden="true">${escape(rank)}</b><span aria-hidden="true">${suits[card[1]] ?? '?'}</span></span>`;
}
export function mountApp(root: HTMLElement, suppliedController?: SessionController, suppliedTournament?: TournamentController, suppliedBlackjack?: BlackjackController): void {
  const controller = suppliedController ?? new SessionController();
  // This status node survives all content renders, so assistive technology can
  // observe committed turn/board/payout changes instead of a replacement node.
  const announcement=document.createElement('div');
  announcement.id='table-announcement';announcement.className='sr-only';
  announcement.setAttribute('role','status');announcement.setAttribute('aria-live','polite');announcement.setAttribute('aria-atomic','true');
  const content=document.createElement('div');
  root.replaceChildren(announcement,content);
  let game: GameState | null = null;
  let view: View = 'live';
  let bootNavDone = false, userNavigated = false;
  /** Patch 67: a returning player (hands played, no cash table in play) opens on the hub. First runs and open tables open on the table. */
  let landed = false, pendingDrillId = '', homeRetry = 0;
  let gamesMenuOpen = false;
  let lobby: LobbyState = normalizeLobby({tier:'home',presetId:'home-20',entrants:6,pace:'fast'});
  let tournament: TournamentController|undefined=suppliedTournament;
  const blackjackRun = new URLSearchParams(location.search).get('run');
  const blackjackLive = new BlackjackLiveUI(()=>{if(view==='blackjack')render();},blackjackRun?`poker-night-ai-blackjack-test:${blackjackRun}`:'poker-night-ai-blackjack-guest',suppliedBlackjack);
  let blackjackLobby: BlackjackLobbyState = normalizeBlackjackLobby({}), blackjackTab: BlackjackTab = 'tables', trainer: TrainerState | null = null, trainerDraft = '', trainerAcesDraft = '';
  let coachTable = 'casino-5', coachDrill: DrillState | null = null, deviationSystem: CountSystemId = 'hi-lo', deviationTable = 'casino-5', deviationDrill: DrillState | null = null;
  const coachRules = (id: string) => strategyRules(COACH_TABLES.find(table => table.id === id) ?? COACH_TABLES[0])!;
  function blackjackSection(): string {
    if (blackjackTab === 'trainer') trainer ??= newTrainer(DEFAULT_TRAINER);
    if (blackjackTab === 'strategy') coachDrill ??= newDrill(strategyQuestion(secureIndex));
    if (blackjackTab === 'deviations') deviationDrill ??= newDrill(deviationQuestion(coachRules(deviationTable), deviationSystem, secureIndex));
    /* Phase 9 backdrops: the blackjack screens share one wrapper so the salon photo
       paints behind them via --game-backdrop (see casino.css). Presentation only. */
    return `<div class="bj-screen">${blackjackTabsMarkup(blackjackTab) + (blackjackTab === 'trainer' ? countTrainerMarkup(trainer!, trainerDraft, trainerAcesDraft) : blackjackTab === 'strategy' ? strategyCoachMarkup(coachTable, coachDrill!) : blackjackTab === 'deviations' ? deviationCoachMarkup(deviationTable, deviationSystem, deviationDrill!) : blackjackLive.markup(blackjackLobby))}</div>`;
  }
  let tournamentStarted=false,tournamentWorking=false,tournamentDraft='',tournamentWatch=false,tournamentFast=false;
  let tournamentPace: 'normal'|'fast'='normal',tournamentLastTick=0;
  let tournamentBackupURL='',tournamentBackupMessage='';
  const tournamentBackupControls=()=>`<p>A previous snapshot is not automatically restored: it could omit a committed wager or prize. Export it for recovery review; it is a private backup and may contain hidden cards.</p><button id="t-backup" class="button secondary">Prepare verified previous backup</button>${tournamentBackupURL?`<a class="button secondary" href="${escape(tournamentBackupURL)}" download="poker-night-ai-tournament-recovery.json">Download private recovery backup</a>`:''}<p role="status">${escape(tournamentBackupMessage)}</p>`;
  /* Table conveniences only: no chips move here. Check/Fold is remembered until Hero's next decision in the same hand. */
  const TOURNAMENT_AUTO_DEAL_KEY='poker-night-ai:tournament-auto-deal',TOURNAMENT_AUTO_DEAL_MS=3000;
  let tournamentAutoDeal=(()=>{try{return localStorage.getItem(TOURNAMENT_AUTO_DEAL_KEY)==='1';}catch{return false;}})();
  let tournamentPre='',tournamentDealAt:{hand:string;at:number}|null=null,tournamentHeld='';
  const tournamentStreetKey=()=>tournament?.data?.active?.game.handId??'';
  const tournamentDealSeconds=()=>tournamentDealAt?Math.max(0,Math.ceil((tournamentDealAt.at-Date.now())/1000)):TOURNAMENT_AUTO_DEAL_MS/1000;
  const runId=new URLSearchParams(location.search).get('run');
  const tournamentDatabase=runId?`poker-night-ai-tournament-test:${runId}`:'poker-night-ai-tournament-guest';
  const ensureTournament=()=>{
    if(tournamentStarted)return;
    tournamentStarted=true;
    tournament??=new TournamentController(tournamentDatabase);
    tournament.subscribe(()=>{if(view==='tournaments'||view==='tournament-stats'||view==='coach'||view==='by-game'||view==='game-detail'||view==='home')render();});
    void tournament.init().catch(cause=>{error=String(cause);render();});
  };
  /* The table-move notice stays until Hero dismisses it, for the hand that follows the move. */
  let tournamentMoveAck='',tournamentMoveFocused='';
  let tournamentThink:{key:string;at:number}|null=null;
  const tournamentMoveBlocked=()=>!!tournament?.view?.pendingMove&&tournament.data?.active?.status==='running'&&tournamentMoveAck!==`${tournament.data.active.id}:${tournament.data.active.handNumber}`;
  const tournamentClock=setInterval(()=>{void(async()=>{
    if(view!=='tournaments'){tournamentDealAt=null;tournamentThink=null;return;}
    if(tournamentWorking||!tournament||tournament.status!=='ready'||tournament.busy)return;
    const active=tournament.data?.active;
    const humanTurn=active&&active.game.actor!==0&&active.game.street!=='complete'&&policyUsesMood(active.tournamentPolicyVersion);
    if(Date.now()-tournamentLastTick<(humanTurn?100:tournamentPace==='fast'?100:500))return;
    tournamentLastTick=Date.now();
    if(!active||active.paused||active.status==='complete'){tournamentDealAt=null;tournamentThink=null;return;}
    if(tournamentMoveBlocked()){tournamentDealAt=null;return;}
    if(active.game.street==='complete'){if(active.status==='hero-out'&&tournamentWatch){tournamentWorking=true;try{await tournament.nextHand();}finally{tournamentWorking=false;}}
      else if(active.status==='running'&&tournamentAutoDeal&&tournamentHeld!==active.game.handId){
        if(tournamentDealAt?.hand!==active.game.handId){const lines=tableTalk?tournamentChatter().lines:[],turns=new Set(lines.map(l=>l.seatId)).size<lines.length;tournamentDealAt={hand:active.game.handId,at:Date.now()+Math.max(TOURNAMENT_AUTO_DEAL_MS,lines.length?1900+lines.length*(turns?2100:1100):0)};}
        const count=root.querySelector('#t-auto-count');if(count)count.textContent=String(tournamentDealSeconds());
        if(Date.now()>=tournamentDealAt.at){tournamentWorking=true;try{await tournament.nextHand();}finally{tournamentWorking=false;}}
      }
      return;}
    if(active.game.actor===0){
      if(tournamentPre&&tournamentPre===tournamentStreetKey()&&active.status==='running'){const shown=tournament.gameView;if(shown){tournamentWorking=true;try{await tournament.act({type:shown.legal.check?'check':'fold'},shown.handId,shown.revision);/* A refused or unsaved action leaves the request queued for the next tick. */if(tournament.gameView?.revision!==shown.revision){tournamentPre='';tournamentDraft='';}}finally{tournamentWorking=false;}}}
      return;}
    tournamentWorking=true;
    try{await tournament.prepareBot();const current=tournament.data?.active;
      if(view==='tournaments'&&current&&!current.paused&&current.pending?.decision){
        // Think time: wait out the rest of this decision's natural delay before committing it.
        const key=`${current.id}:${current.game.handId}:${current.game.revision}:${tournamentPace}`;if(tournamentThink?.key!==key)tournamentThink={key,at:Date.now()+tournamentDelay(current)};
        if(Date.now()<tournamentThink.at)return;
        await tournament.commitBot(current.game.handId,current.game.revision);}
    }catch(cause){error=String(cause);render();}finally{tournamentWorking=false;}
  })();},100);
  window.addEventListener('pagehide',()=>{clearInterval(tournamentClock);tournamentFast=false;if(tournamentBackupURL)URL.revokeObjectURL(tournamentBackupURL);tournament?.close();blackjackLive.close();},{once:true});
  function tournamentSection():string {
    const c=tournament;
    if(!c||!c.data)return `<section class="panel"><h2>Restoring tournament practice…</h2><p>${escape(c?.error||'Checking saved tournament state before enabling play.')}</p>${c?.status==='error'?`<button id="t-retry" class="button">Retry tournament recovery</button>${tournamentBackupControls()}`:''}</section>`;
    const blocked=c.status!=='ready'||c.busy;
    const preset=findPreset(lobby.presetId)!;
    const supported=preset.fields.includes(lobby.entrants);
    const available=!blocked&&!controller.data?.active&&supported&&c.data.balance>=entryCost(preset);
    const reason=blocked?'Tournament save is busy or owned by another tab.':controller.data?.active?'Finish your cash hand and cash out before registering. Your cash records will be preserved.':!supported?'Choose a field size this event offers.':c.data.balance<entryCost(preset)?'Add virtual tournament funds below before registering.':lobby.entrants>9?`Multi-table tournament: ${Math.ceil(lobby.entrants/9)} tables of nine, balanced and broken as players are knocked out, then a final table. Late registration and re-entry stay open through level 4, so the field and prize pool grow; computer players may re-enter once. You get one entry, charged once when you register.`:'Single-table freezeout: one entry, no rebuys. Your virtual entry is charged once when you register.';
    return `<section class="panel tournament-wallet"><h2>Tournament practice</h2><p><strong>${money(c.data.balance)}</strong> available virtual tournament balance · kept separate from cash bankroll and cash statistics.</p>${c.data.active?'<details class="tournament-help"><summary>About this tournament and balance</summary>':''}<p>Every listed event is playable, from six-player home games to 90-player series events. Other tables play a hand each time yours does. Blinds advance by completed hands, not wall-clock time. Opponents use synthetic policies; tournament strategy is not human-validated.</p><details id="t-balance-controls"><summary>Adjust virtual tournament balance</summary><label>Available tournament balance ($)<input id="t-balance" inputmode="decimal" value="${(c.data.balance/100).toFixed(2)}"></label><button id="t-adjust" class="button" ${blocked?'disabled':''}>Record manual adjustment</button><p>Manual adjustments are not tournament winnings. No real money and no transfers from your cash bankroll.</p></details>${c.data.active?'</details>':''}</section>${c.error||c.status==='readonly'?`<section class="panel"><p role="alert">${escape(c.error||'Another tab changed this tournament. Reload its committed state.')}</p><button id="t-retry" class="button">Retry saved tournament</button>${c.status==='error'?tournamentBackupControls():''}</section>`:''}${c.data.active?tournamentPlayMarkup(c,tournamentDraft,{oddsHelper:(()=>{const g=c.data.active.game,h=g.seats.find(x=>x.id===0);return h&&g.street!=='complete'?oddsPanel(h.hole,g.board,g.actor===0?Math.min(h.stack,Math.max(0,...g.seats.map(x=>x.streetCommitted))-h.streetCommitted):0,g.pot,h.folded,n=>`${n.toLocaleString('en-US')} chips`)+(c.gameView?coachPanel(c.gameView,c.gameView.actor===0&&c.data.active.status==='running','tournament',n=>`${n.toLocaleString('en-US')} chips`):''):'';})(),chatter:tournamentChatter(),talkOn:tableTalk,motion,watchToResult:tournamentWatch,externalAnnouncement:true,preCheckFold:!!tournamentPre&&tournamentPre===tournamentStreetKey(),fastForward:tournamentFast,pace:tournamentPace,autoDeal:tournamentAutoDeal,autoDealSeconds:tournamentDealSeconds(),autoDealHeld:tournamentHeld===c.data.active.game.handId,moveAcked:tournamentMoveAck===`${c.data.active.id}:${c.data.active.handNumber}`,handLabel:style.handLabel,drawnAvatars:style.avatars,moment:eventMoment?.markup,cue:tournamentCue(),sideTells:tournamentSideTells(),quip:tableTalk?tournamentQuipShown():null,heroSaid:saying('tournament'),idleAt:(id:number)=>{const e=c.data!.active!,seat=e.game.seats.find(x=>x.id===id);return seat&&policyUsesMood(e.tournamentPolicyVersion)?idleActivity(seat.name,regularOfProfile(tournamentProfileAt(e,id)),`${e.game.handId}:${id}`):null;},quickChat:tableTalk&&policyUsesMood(c.data.active.tournamentPolicyVersion)&&c.data.active.status==='running'?answerMarkup('tournament')+quickChatRow(HERO_PHRASES,'data-t-say'):''})+stylePanel():lobbyMarkup(lobby,{available,reason})}${tournamentRecordMarkup(c.records)}`;
  }
  let savedFocusDuringCommit:{selector:string;view:View;decision:string|null;selection:[number|null,number|null]|null;drafts:{id:string;value:string}[]}|null=null;
  let settings: Settings = initializeOpponentSettings({ seats: 6, stake: '0', smallBlind: 100, bigBlind: 200, buyIn: 20000, rakeMode: 'none', rakeBasisPoints: 500, rakeCap: 300, noFlopNoDrop: true, archetypes: ['tag', 'station', 'nit', 'lag', 'passive-reg', 'fit-or-fold', 'stronger-reg', 'maniac', 'tag'], minBuyInBB: 1, maxBuyInBB: 500, allowTopUp: true });
  /** A seat's name: from the hand when there is one, otherwise the seated regular's name or the default seat name. */
  const seatName=(id:number,source?:{seats:readonly {id:number;name:string}[]}|null)=>source?.seats.find(seat=>seat.id===id)?.name??(id>0?regularFor(settings.opponents?.[id-1])?.name:undefined)??NAMES[id];
  let historySource:StoredHand[]|null=null;
  let historyWasFullyLoaded=controller.historyLoaded;
  let reviewCache:ReviewHand[]=[];
  let originCache=new WeakMap<object,{cash?:string;imported?:string}>();
  const statsProjection=new AsyncCashStats(()=>render());
  let assumedHandsPerHour=30;
  let configurationHistoryPage=0;
  let historyPage=0;
  let resultsFilter:CashResultsFilter={...ALL_CASH_RESULTS_FILTER};
  let filteredCache:{data:NonNullable<typeof controller.data>;key:string;result:FilteredCashResults}|null=null;
  let handNumber = 0;
  let paused = false;
  const PACE_KEY = 'ai-texas-hold-em:bot-pace';
  // After Hero folds there is nothing left to decide, so the rest of the hand plays at this speed or faster.
  const FOLDED_PACE_MS = 200, SKIP_PACE_MS = 140, TIME_CALL_MS = 6000, READ_AFTER_MS = 1700;
  // Auto-deal is a remembered, off-by-default convenience. It only continues ordinary play.
  const AUTO_DEAL_KEY = 'ai-texas-hold-em:auto-deal';
  const AUTO_DEAL_MS = 2500, AUTO_DEAL_SHOWDOWN_MS = 5000, AUTO_DEAL_QUICK_MS = 1200;
  let autoDeal = (() => { try { return localStorage.getItem(AUTO_DEAL_KEY) === '1'; } catch { return false; } })();
  let autoDealToken = '', autoDealHeld = '', autoDealAt = 0;
  let tableTalk = readTableTalk();
  let motion = readMotion();
  let renderedView: string | null = null;
  let skipReEntryWarned = '';
  let style: TableStyle = readStyle();
  controller.dealerTipPolicy=style.tokes;
  setVolume(style.volume / 100);
  let stylePanelOpen = false;
  let lastSound: SoundState | null = null;
  let lastSoundView = '';
  root.addEventListener('pointerdown', () => { if (style.sound) unlockAudio(); });
  let lastActiveSession = '';
  let cashOutSummary: SessionSummary | null = null;
  let tournamentFlagState: { id: string; flags: TournamentFlags } | null = null;
  let eventMoment: { hand: number; markup: string } | null = null;
  let thinkFor: { token: string; ms: number } | null = null;
  let profileSeat: number | null = null;
  let trendBase: Map<string, number> | null = null;
  let winSet: Set<Card> = new Set();
  let quip: ReturnType<typeof quipFor> = null;
  let dealOrder = new Map<number, number>();
  let revealOrder = new Map<number, number>();
  let lastBoard: { handId: string; len: number } | null = null;
  let sweat: { handId: string; turn: boolean } | null = null;
  let dealerSeen: HeroViewModel | null = null;
  let viewSwitches = 0, lastAnimView: string = view;
  const talkLog: { key: string; hand: number; name: string; text: string }[] = [];
  let talkLogOpen = false;
  let lastStacks: { handId: string; stacks: Map<number, number> } | null = null;
  let lastBets: { handId: string; street: string; bets: { id: number; amount: number }[] } | null = null;
  let sweep: { key: string; bets: { id: number; amount: number }[] } | null = null;
  let installPrompt: (Event & { prompt: () => Promise<unknown> }) | null = null;
  window.addEventListener('beforeinstallprompt', event => { event.preventDefault(); installPrompt = event as Event & { prompt: () => Promise<unknown> }; render(); });
  window.addEventListener('appinstalled', () => { installPrompt = null; render(); });
  document.addEventListener('keydown', event => { if (event.key === 'Escape' && profileSeat !== null) { const seat = profileSeat; profileSeat = null; render(); root.querySelector<HTMLElement>(`[data-profile="${seat}"]`)?.focus(); } });
  const BREAK_KEY = 'poker-night-ai:break-ack';
  const breakAck = new Map<string, number>((() => { try { return Object.entries(JSON.parse(sessionStorage.getItem(BREAK_KEY) ?? '{}') as Record<string, number>); } catch { return []; } })());
  const ackBreak = () => { const clock = sessionClock(); if (!clock) return; breakAck.set(clock.sessionId, clock.due); try { sessionStorage.setItem(BREAK_KEY, JSON.stringify(Object.fromEntries(breakAck))); } catch { /* this visit only */ } };
  // Playing time is kept by the session controller; refresh the clock text and check for a due break twice a minute.
  setInterval(() => {
    if (view !== 'live') return;
    const clock = sessionClock(), label = root.querySelector('#session-clock-time');
    if (clock && label) label.textContent = durationText(clock.ms);
    if (clock && clock.due > (breakAck.get(clock.sessionId) ?? 0) && !root.querySelector('[data-testid=break-reminder]')) render();
  }, 30000);
  const TOUR_KEY = 'poker-night-ai:welcome-tour';
  let tourStep = (() => { try { return localStorage.getItem(TOUR_KEY) === 'done' ? -1 : 0; } catch { return -1; } })();
  // Opt-in single-key shortcuts (Table look & sound). They press the same buttons a tap would.
  root.addEventListener('keydown', event => {
    if (!style.keys || event.repeat || (view !== 'live' && view !== 'tournaments')) return;
    const button = shortcutTarget(event, root);
    if (button) { event.preventDefault(); if (style.sound) unlockAudio(); button.click(); }
  });
  const pageTitle = document.title || 'Gold Crown Casino';
  const cashChatter = () => { const a = controller.data?.active; const grudges = a && Number(a.humanLayer?.split('.')[1] ?? 0) >= 10 ? cashGrudges(controller.data!.hands.filter(h => h.id !== a.game.handId)) : null; const chatter = chatterFor(a?.humanLayer ? a.game : null, id => a?.profiles[id], false, tableTalk, grudges && a ? (id => grudge(grudges, cashIdentity(a)(id), 'hero')) : undefined, undefined, !!a && Number(a.humanLayer?.split('.')[1] ?? 0) >= 18);
    // Patch 77: card-dead and tired players speak up (display only).
    if (!a || !tableTalk || a.game.street !== 'complete' || !a.humanLayer) return chatter;
    const session = controller.data!.sessions.find(x => x.id === a.sessionId), ids = new Set(session?.handIds ?? []);
    const previous = controller.data!.hands.filter(h => ids.has(h.id) && h.id !== a.game.handId), views = previous.map(h => h.view);
    const same = (seat: number) => (i: number) => previous[i].privateProfiles?.[seat]?.personalityId === a.profiles[seat]?.personalityId;
    const moodAt = (id: number) => { const p = a.profiles[id]; if (!p) return undefined; try { return moodFrom(cashRecentResults(controller.data!.hands, a, id), p); } catch { return undefined; } };
    return withBanter(withRestless(chatter, a.game, { streak: seat => foldStreak(views, seat, same(seat)), handsPlayed: previous.length + 1, tournament: false }), a.game, namesAt(a.game, id => a.profiles[id]), { recent: views.slice(-12).map(heroHandOf) }, { showdowns: heroShowdowns(views.map((v, i) => ({ ...v, seats: v.seats.filter(x => x.id === 0 || same(x.id)(i)) }))), moodAt, ask: true, answers: answersFor('cash', a.sessionId) }); };
  /** Patch 66: tells at the tournament table (events whose policy uses moods). */
  let tournamentTurn: { key: string; at: number; hidden: boolean } | null = null;
  const tournamentProfileAt = (e: NonNullable<NonNullable<TournamentController['data']>['active']>, id: number) => { try { return e.mtt ? mttProfileAt(e, id) : e.profiles[id]; } catch { return undefined; } };
  function tournamentCue(): { seatId: number; text: string } | null {
    const e = tournament?.data?.active;
    const key = e && e.game.actor === 0 && e.game.street !== 'complete' ? `${e.game.handId}:${e.game.revision}` : '';
    if (!key) tournamentTurn = null;
    else if (tournamentTurn?.key !== key) tournamentTurn = { key, at: performance.now(), hidden: document.hidden };
    else if (document.hidden) tournamentTurn.hidden = true;
    if (!e || !policyUsesMood(e.tournamentPolicyVersion) || e.game.actor === null || e.game.actor === 0 || !e.pending?.decision) return null;
    const cue = liveTells(e.game, tournamentProfileAt(e, e.game.actor), e.pending.decision.action)?.cue;
    return cue ? { seatId: e.game.actor, text: cue } : null;
  }
  function tournamentSideTells(): Map<number, SideTell> {
    const e = tournament?.data?.active;
    if (!e || !policyUsesMood(e.tournamentPolicyVersion) || e.game.street === 'complete' || e.status !== 'running') return new Map();
    return sideTells(e.game, id => tournamentProfileAt(e, id));
  }
  /** Patch 94: snap the easy ones, tank the hard ones, and leave time to read a tell or a remark. */
  function tournamentDelay(current: NonNullable<NonNullable<typeof tournament>['data']>['active']): number {
    if (!current) return 0;
    const plan = tournamentThinkPlan(current);
    if (!plan) return 0;
    const fast = tournamentPace === 'fast', ms = pacedMs(plan, fast ? .15 : .7, fast ? 0 : 2000);
    const at = (id: number) => tournamentProfileAt(current, id), told = lastActionTells(current.game, at);
    const said = !fast && tableTalk && (needleFor(current.game, at) || (told?.tells.speech && told.event.action?.type === 'raise')) ? READ_AFTER_MS * .8 : 0;
    return Math.max(ms, said);
  }
  /** Patch 95: the quip shown, with a reaction from players out of the hand, and none over your conversation. */
  function tournamentQuipShown(): TalkLine | null {
    const e = tournament?.data?.active; if (!e) return null;
    let q = tournamentQuip();
    if (policyUsesMood(e.tournamentPolicyVersion)) q = heroWaitLine('tournament') ?? q;
    if (!q && policyUsesMood(e.tournamentPolicyVersion)) { const n = namesAt(e.game, id => tournamentProfileAt(e, id)); q = sweatLine(e.game, n) ?? reraiseLine(e.game, n) ?? spectatorLine(e.game, n); }
    const said = saying('tournament');
    return said && q && (q.seatId === 0 || said.replies.some(r => r.seatId === q!.seatId)) ? null : q;
  }
  function tournamentQuip(): TalkLine | null {
    const e = tournament?.data?.active;
    if (!e || !policyUsesMood(e.tournamentPolicyVersion) || e.game.street === 'complete') return null;
    const g = e.game;
    if (g.actor !== null && g.actor !== 0 && e.pending?.decision) {
      const m = /:tempo:(tempo-fold|tempo-call):/.exec(e.pending.decision.observationHash);
      if (m) { const bet = g.events.filter(x => x.type === 'action' && x.street === g.street && x.action?.type === 'raise').at(-1), t = bet ? tempoOf(bet) : null; if (t) { const pool = TEMPO_LINES[m[1] as 'tempo-fold' | 'tempo-call'][t]; return { seatId: g.actor, text: pool[g.revision % pool.length] }; } }
      const tells = liveTells(g, tournamentProfileAt(e, g.actor), e.pending.decision.action);
      if (tells?.speech && e.pending.decision.action.type === 'call') return { seatId: g.actor, text: tells.speech };
    }
    const at = (id: number) => tournamentProfileAt(e, id);
    const needle = needleFor(g, at); if (needle) return needle;
    const told = lastActionTells(g, at);
    return told?.tells.speech && told.event.action?.type === 'raise' ? { seatId: told.seatId, text: told.tells.speech } : null;
  }
  const tournamentChatter = () => { const e = tournament?.data?.active; if (!e || !policyUsesMood(e.tournamentPolicyVersion)) return QUIET; const chatter = chatterFor(e.game, id => { try { return e.mtt ? mttProfileAt(e, id) : e.profiles[id]; } catch { return undefined; } }, true, tableTalk, undefined, tournamentMoment(e), Number(e.tournamentPolicyVersion?.split('.')[1] ?? 0) >= 21);
    // Patch 77: card-dead, short-stacked and tired players speak up (display only). Seat history only at a single table.
    if (!tableTalk || e.game.street !== 'complete') return chatter;
    const previous = e.mtt ? [] : e.history.filter(h => h.state.handId !== e.game.handId).map(h => h.state);
    const moodAt = (id: number) => { const p = tournamentProfileAt(e, id); if (!p) return undefined; try { return moodFrom(tournamentRecent(e, id) ?? [], p); } catch { return undefined; } };
    return withBanter(withRestless(chatter, e.game, { streak: seat => foldStreak(previous, seat), handsPlayed: e.handNumber, tournament: true }), e.game, namesAt(e.game, id => tournamentProfileAt(e, id)), e.mtt ? null : { recent: previous.slice(-12).map(heroHandOf) }, { showdowns: e.mtt ? [] : heroShowdowns(previous), moodAt, ask: e.status === 'running', answers: answersFor('tournament', e.id) }); };
  let autoDealTimer: ReturnType<typeof setTimeout> | null = null;
  // Check/Fold chosen ahead of Hero's turn, for one street of one hand: "<handId>:<street>".
  let preCheckFold = '';
  /** Patch 67: play the other players' actions quickly until Hero's turn in this hand ("<handId>"). */
  let skipToTurn = '';
  /** Patch 67: choosing a table and a seat before sitting down. */
  let tablePick: { tables: TableChoice[]; chosen: number | null; waiting: { until: number; ahead: number } | null; note: string } | null = null;
  function tablePickerMarkup(): string {
    const t = tablePick!;
    if (t.chosen === null) return `<section id="table-actions" tabindex="-1" class="action-panel table-picker" data-testid="table-picker"><span class="eyebrow">THE FLOOR</span><h2>Pick a table</h2>${t.note ? `<p class="muted">${escape(t.note)}</p>` : ''}<p class="muted">${money(t.tables[0].settings.smallBlind)}/${money(t.tables[0].settings.bigBlind)} no-limit · nine seats. Regulars are named; everyone else is a new face.</p><ul class="table-list">${t.tables.map((x, i) => { const seats = seatPreview(x.settings), regs = seats.filter(p => p.regular); return `<li><button type="button" class="table-choice" data-pick-table="${i}"><span class="table-name"><b>${escape(x.label)}</b>${x.straddle ? '<span class="table-straddle">Straddle game</span>' : ''}${x.full ? `<span class="table-full">Full · ${x.ahead} on the list</span>` : '<span class="table-open">Seat open</span>'}</span><span class="table-who">${regs.length ? regs.map(r => `<b>${escape(r.name)}</b> <span class="muted">(${escape(r.style)})</span>`).join(', ') : 'No regulars tonight'}</span><span class="muted">${seats.length - regs.length} new face${seats.length - regs.length === 1 ? '' : 's'}</span></button></li>`; }).join('')}</ul><div class="drill-nav"><button type="button" class="button secondary" id="pick-cancel">Back</button><button type="button" class="button secondary" id="pick-refresh">Other tables</button></div></section>`;
    const x = t.tables[t.chosen], seats = seatPreview(x.settings);
    if (t.waiting) { const left = Math.max(0, Math.ceil((t.waiting.until - Date.now()) / 1000)); return `<section id="table-actions" tabindex="-1" class="action-panel table-picker" data-testid="waiting-list"><span class="eyebrow">WAITING LIST · ${escape(x.label)}</span><h2>${left > 0 ? `You're ${t.waiting.ahead === 1 ? 'next' : `number ${t.waiting.ahead} on the list`}` : 'A seat just opened.'}</h2><p class="muted">${left > 0 ? `The floor will call you in about ${left} second${left === 1 ? '' : 's'}.` : 'Taking you to your seat…'}</p><div class="drill-nav"><button type="button" class="button secondary" id="pick-cancel">Leave the list</button></div></section>`; }
    const left = seats[0], right = seats.at(-1)!;
    return `<section id="table-actions" tabindex="-1" class="action-panel table-picker" data-testid="seat-picker"><span class="eyebrow">${escape(x.label)} · CHOOSE YOUR SEAT</span><h2>Who sits beside you</h2><p>On your left (acts after you): <b>${escape(left.name)}</b> <span class="muted">${escape(left.style)}</span><br>On your right (acts before you): <b>${escape(right.name)}</b> <span class="muted">${escape(right.style)}</span></p><ol class="seat-order" aria-label="Clockwise from your left">${seats.map(p => `<li class="${p.regular ? 'regular' : ''}">${escape(p.name)}</li>`).join('')}</ol><p class="muted">Clockwise from your left. Good seats have the aggressive players on your right, so you act after them.</p>${x.straddle ? `<p class="straddle-note" data-testid="straddle-note"><b>Straddle game.</b> The player under the gun may post a straddle of ${money(2 * x.settings.bigBlind)} before the cards are dealt, and then acts last before the flop. Pots start bigger, and it plays like a ${money(x.settings.bigBlind)}/${money(2 * x.settings.bigBlind)} game. You choose whether you straddle when it's your turn under the gun.</p>` : ''}<div class="drill-nav"><button type="button" class="button secondary" id="seat-left">◀ Move a seat</button><button type="button" class="button secondary" id="seat-right">Move a seat ▶</button></div><div class="drill-nav"><button type="button" class="button secondary" id="pick-back">Other tables</button><button type="button" class="button primary" id="take-seat">${x.full ? `Join the waiting list` : `Take this seat · ${money(x.settings.buyIn)}`}</button></div></section>`;
  }
  /** Patch 68: the table settings for a rung of the career ladder: nine seats, 100 big blind buy-ins. */
  function stakeSettings(level: number): CashSettings {
    const base = syntheticLiveOneTwoPreset(settings);
    if (level === 0) return base;
    const [smallBlind, bigBlind] = LADDER[level];
    return normalizeTableSettings({ ...base, stake: String(level), smallBlind, bigBlind, buyIn: 100 * bigBlind, minBuyInBB: Math.min(base.minBuyInBB, 40), maxBuyInBB: Math.max(base.maxBuyInBB, 150), population: bigBlind <= 200 ? 'low' : bigBlind <= 1000 ? 'mid' : 'high', opponents: undefined }) as CashSettings;
  }
  function openTablePicker(note = '', buyIn?: number, level = 0) {
    const base = stakeSettings(level);
    if (buyIn !== undefined) base.buyIn = Math.max(base.minBuyInBB * base.bigBlind, Math.min(base.maxBuyInBB * base.bigBlind, Math.floor(buyIn / base.chipUnit!) * base.chipUnit!));
    const tables = tableChoices(base);
    // Patch 88: a live straddle game is running too, with the regulars who like to straddle.
    const sitting = tables.flatMap(t => (t.settings.opponents ?? []).map(o => regularFor(o)?.id).filter((id): id is string => !!id));
    tablePick = { tables: [...tables, straddleTable(base, undefined, sitting)], chosen: null, waiting: null, note };
  }
  let career: Career | null = readCareer();
  function careerView(): string {
    const data = controller.data;
    if (!data) return '';
    if (!career) return `<section class="panel career" data-testid="career"><span class="eyebrow">CAREER MODE</span><h2>Start at $1/$2. Earn your way up.</h2><p>Your career uses your cash bankroll (${money(data.wallet)} now). It moves you up the stakes the way a careful pro does:</p><ul class="hub-list"><li>Move up once your bankroll covers <b>${MOVE_UP_BUYINS} buy-ins</b> of the next stakes and you have beaten your current stakes over at least <b>${MOVE_UP_HANDS.toLocaleString()} hands</b>.</li><li>Move down if it falls under <b>${MOVE_DOWN_BUYINS} buy-ins</b> of where you play.</li><li>A buy-in is ${BUYIN_BB} big blinds. Ladder: ${LADDER.map((_, i) => stakeName(i)).join(' → ')}.</li></ul><button type="button" class="button primary" id="career-start" ${data.active ? 'disabled' : ''}>Start my career</button>${data.active ? '<p class="muted">Cash out your current table first.</p>' : ''}</section>`;
    const fresh = newMilestones(data, career);
    if (fresh.length) { career = { ...career, story: [...career.story, ...fresh].slice(-200) }; saveCareer(career); }
    const st = careerStatus(data, career), pct = (a: number, b: number) => Math.max(0, Math.min(100, Math.round(100 * a / Math.max(1, b))));
    const bar = (label: string, have: string, value: number) => `<div class="career-bar"><div class="career-bar-head"><span>${escape(label)}</span><b>${escape(have)}</b></div><div class="career-track"><i style="width:${value}%"></i></div></div>`;
    return `<section class="panel career" data-testid="career"><span class="eyebrow">CAREER · STARTED ${escape(new Date(career.startedAt).toLocaleDateString())}</span><h2>You play ${st.stake}</h2>
      <div class="hub-balances"><div><span class="eyebrow">BANKROLL</span><b>${money(st.bankroll)}</b></div><div><span class="eyebrow">BUY-INS HERE</span><b>${Math.floor(st.buyIns)}</b></div><div><span class="eyebrow">WIN RATE HERE</span><b>${st.winRateHere === null ? '—' : `${st.winRateHere > 0 ? '+' : ''}${st.winRateHere} BB/100`}</b></div></div>
      ${st.mustMoveDown ? `<p class="career-warn" role="status">Your bankroll is under ${MOVE_DOWN_BUYINS} buy-ins for ${st.stake}. Move down to protect it.</p><button type="button" class="button primary" id="career-down">Move down to ${stakeName(career.level - 1)}</button>` : ''}
      ${st.nextStake ? `<h3>Next: ${st.nextStake}</h3>${bar(`Bankroll toward ${MOVE_UP_BUYINS} buy-ins`, `${money(st.bankroll)} of ${money(st.needBankroll!)}`, pct(st.bankroll, st.needBankroll!))}${bar(`Hands at ${st.stake}`, `${st.handsHere.toLocaleString()} of ${MOVE_UP_HANDS.toLocaleString()}`, pct(st.handsHere, MOVE_UP_HANDS))}${bar(`Beating ${st.stake}`, st.netHereBB > 0 ? `Yes, +${st.netHereBB} BB` : `Not yet (${st.netHereBB} BB)`, st.netHereBB > 0 ? 100 : 0)}${st.canMoveUp ? `<button type="button" class="button primary" id="career-up">Move up to ${st.nextStake}</button>` : ''}` : '<h3>You reached the top of the ladder.</h3>'}
      <div class="drill-nav"><button type="button" class="button ${st.canMoveUp ? 'secondary' : 'primary'}" id="career-play" ${data.active ? 'disabled' : ''}>Play your career table · ${st.stake}</button></div>${data.active ? '<p class="muted">You have a table open. Finish it first.</p>' : ''}
      <h3>Your story</h3><ol class="career-story" reversed>${[...career.story].reverse().map(e => `<li><span class="muted">${escape(new Date(e.at).toLocaleDateString())}</span> ${escape(e.text)}</li>`).join('')}</ol>
      <p class="muted">${st.totalHands.toLocaleString()} career hands · ${st.totalNet >= 0 ? '+' : '−'}${money(Math.abs(st.totalNet))} since you started. Hands at any stakes count toward your story; only hands at ${st.stake} count toward moving up.</p>
      <button type="button" class="button secondary" id="career-end">End this career</button></section>`;
  }
  /* Patch 90/92: slots. The spin is paid and saved first; the reels, features and celebrations are only the show. */
  const slotsRead = readSlots();
  const slotsUi = freshSlotsUi(); slotsUi.notice = slotsRead.notice;
  const slotsPlayer = new SlotsPlayer(slotsRead.state, slotsUi, {
    render: () => render(),
    sound: kind => { if (style.sound && view === 'slots') playSound(kind); },
    active: () => view === 'slots' && document.visibilityState === 'visible',
    motion: () => motion,
  });
  function slotsView(): string { return slotsMarkup(slotsPlayer.state, slotsUi); }
  /* Patch 99: roulette, craps, baccarat and the races share one casino balance. */
  const CASINO_SOUNDS: Record<string, SoundKind> = { chip: 'chip', dice: 'dice', roll: 'ballroll', drop: 'balldrop', card: 'cardsnap', bugle: 'bugle', crowd: 'crowd', shuffle: 'shuffle', flip: 'flip', money: 'money', win: 'win', fold: 'fold' };
  const casino = new CasinoPlayer({
    render: () => render(),
    sound: kind => { const k = CASINO_SOUNDS[kind]; if (k && style.sound && (view === 'roulette' || view === 'craps' || view === 'baccarat' || view === 'races')) playSound(k); },
    active: game => view === game && document.visibilityState === 'visible',
  });
  let casinoShown = '';
  /* Patch 74: Pot-Limit Omaha, its own table and balance. Players act one at a time with a short think. */
  let plo: PloTable | null = null, ploTimer = 0, subnavShown = '', wasSeated = false;
  let lastLevel: { id: string; level: number } | null = null;
  let lastPloSound: PloSoundState | null = null, lastBjSound: BjSoundState | null = null, ploLastFly: FlySnapshot | null = null, ploFlyTimer = 0;
  const ploUi: PloUiState = { stakes: '1-2', buyInBB: 100, raiseTo: null, error: '', notice: '', thinking: false, fast: (() => { try { return localStorage.getItem('poker-night-ai:plo-fast') === '1'; } catch { return false; } })() };
  function omahaView(): string {
    plo ??= new PloTable();
    schedulePlo();
    // Patch 82: chips fly to the pot when a street ends and to the winners when the hand ends.
    const h = plo.state.active ? plo.hand : null;
    if (h) { const flights = ploFlights(ploLastFly, h, `${h.handId.slice(-6)}-${h.events.length}`); ploLastFly = flySnapshot(h); if (flights.length) { ploUi.fly = flights; clearTimeout(ploFlyTimer); ploFlyTimer = window.setTimeout(() => { ploUi.fly = []; if (view === 'omaha') render(); }, 900); } } else ploLastFly = null;
    ploUi.heroSaid = saying('omaha'); ploUi.quickChat = tableTalk && h ? answerMarkup('omaha') + quickChatRow(HERO_PHRASES, 'data-plo-say') : '';
    return ploMarkup(plo, ploUi, { card, esc: escape });
  }
  function schedulePlo() {
    if (!plo || ploTimer || view !== 'omaha' || !plo.botTurn) return;
    ploUi.thinking = true;
    let wait = 900; try { wait = plo.planBot(); } catch (cause) { ploUi.error = (cause as Error).message; }
    if (ploUi.fast) wait = Math.min(1200, Math.round(wait * 0.4));
    ploTimer = window.setTimeout(() => { ploTimer = 0; ploUi.thinking = false; try { plo!.botStep(); } catch (cause) { ploUi.error = (cause as Error).message; } render(); }, wait);
  }
  function ploDo(work: () => void) { if (!plo) return; ploUi.error = ''; ploUi.blockedByTable = false; try { work(); } catch (cause) { ploUi.error = (cause as Error).message; } render(); }
  /* Patch 73: heads-up challenge. */
  let huLast: MatchRecord | null = null, huEnding = false, huFinish = false, huNotice = '';
  function headsUpView(): string {
    const d = controller.data; if (!d) return '';
    return ladderMarkup(readLadder(), { busy: operation || controller.busy, tableOpen: !!d.active, bankroll: d.wallet, buyIn: 100 * stakeSettings(0).bigBlind, last: huLast, notice: huNotice });
  }
  function startChallenge(rung: number) {
    if (!LADDER_IDS[rung]) return;
    /* Phase 9 (F-02): a challenge click must never die silently. An open table gets an
       explanation; a transient save in flight gets a short wait and a retry, not a dead click. */
    if (controller.data?.active) { huNotice = 'You have a Hold’em table open. Finish or cash out first — your match will be here.'; render(); return; }
    if (game || unavailable()) {
      huNotice = 'One moment — finishing a save, then your match starts.';
      render();
      let tries = 0;
      const retry = () => {
        if (view !== 'heads-up') return;
        if (!game && !unavailable() && !controller.data?.active) { huNotice = ''; startChallenge(rung); return; }
        if (++tries < 20) window.setTimeout(retry, 150);
        else { huNotice = 'The match could not be started just now. Try again.'; render(); }
      };
      window.setTimeout(retry, 150);
      return;
    }
    huNotice = '';
    const chosen = matchSettings(stakeSettings(0), rung);
    settings = chosen; discardSetupDraft = true;
    void run(async () => { await controller.startSession(chosen); if (controller.data?.active) { view = 'live'; sessionNotice = 'Heads-up match. First to bust the other, or the chip leader after 150 hands.'; } });
  }
  /** After each hand: when the match is decided, record it once and cash out. */
  async function checkChallenge(): Promise<void> {
    const d = controller.data; if (huEnding || !d || controller.busy || operation) return;
    const m = matchState(d); if (!m || !m.over) return;
    if (d.active && !huFinish) return; // the player sees the last hand first, then taps Finish match
    huFinish = false;
    const ladder = readLadder(); if (ladder.matches.some(r => r.sessionId === m.sessionId)) return;
    huEnding = true;
    try {
      if (d.active && d.active.game.street === 'complete') { clearTimer(); cancelAutoDeal(); await controller.cashOut(); }
      const after = controller.data ? matchState(controller.data) : null;
      const final = after && after.sessionId === m.sessionId ? { ...m, net: after.net, how: m.how === 'left' ? 'left' as const : m.how } : m;
      const record = recordMatch(ladder, final); if (record) { saveLadder(ladder); huLast = record; if (style.sound) playSound(record.won ? 'matchwin' : 'matchlose'); view = 'heads-up'; render(); }
    } finally { huEnding = false; }
  }
  function sitAtPicked() {
    const t = tablePick; if (!t || t.chosen === null || game || unavailable()) return;
    const chosen = t.tables[t.chosen].settings;
    tablePick = null; settings = chosen; discardSetupDraft = true;
    void run(async () => { await controller.startSession(settings); if (controller.data?.active) { view = 'live'; sessionNotice = 'You are seated. Your neighbours are as you chose.'; } });
  }
  /** Patch 67: a long think gets "time" called on it (display only). */
  let timeCall: { token: string; at: number; by: number } | null = null;
  const rememberedPace = () => { try { const value = Number(localStorage.getItem(PACE_KEY)); return [250, 900, 1800].includes(value) ? value : 900; } catch { return 900; } };
  let pace = rememberedPace();
  let error = '';
  let raiseValue = 0;
  /** Patch 105: the Live coach (off until switched on). */
  const coachUi = freshCoachUi();
  let coachStyleCache: { key: string; value: Map<number, ReturnType<typeof observedStyle>> } = { key: '', value: new Map() };
  let raiseToken = '';
  let customPercent = 100, shortcutBB = 3, incrementBB = 1;
  // Percentage the pot slider shows for this decision; null means work it out from the raise amount.
  let sliderPercent: number | null = null;
  // null = follow the viewport default (open on wide screens, closed on phones).
  let sizingMoreOpen: boolean | null = null;
  /* Phase 10 (P10-F03/F07): the phone action panel's peek state. The player's explicit
   * choice is kept per decision token; with no choice the panel peeks while waiting
   * (nothing to decide) and opens on the hero's turn. CSS applies it only where the
   * panel is the pinned bottom bar, so wide layouts are untouched. */
  let panelPeekChoice: boolean | null = null;
  let panelPeekToken = '';
  let potLevelsOpen = false;
  // True wherever the action panel is the pinned bottom bar (see phone-play.css).
  const compactViewport = () => typeof matchMedia === 'function' && matchMedia('(max-width:1180px)').matches;
  let timer: ReturnType<typeof setTimeout> | null = null;
  let pendingToken = '';
  let preparingToken = '';
  let operation = false;
  let lockHostForOperation = false;
  let loadedSettingsFor = '';
  let loadedSettingsHand = '';
  let initialSettingsLoaded = false;
  let opponentStudySession = '';
  /** Patch 65: leak finder and spot drills. 'recent' = your last 500 hands; otherwise a session id. */
  let coachScope = '', drillIndex = 0;
  const drillPicks = new Map<string, DrillChoice>(), drillAnswerCache = new Map<string, DrillAnswer>();
  let coachCache: { key: string; leaks: Leak[]; drills: Drill[]; hands: StoredHand[] } | null = null;
  let revealedStyleSession = '';
  let notesOpen=false,notesSession='',notesSeat=1,noteNotice='';
  const noteDrafts=new Map<string,{text:string;revision:number}>();
  const noteKey=()=>JSON.stringify([notesSession,notesSeat]);
  const openOpponentDetails = new Set<number>();
  // Host setup sections and opponent rows the player has opened. Kept here because some setup
  // changes (rake model, preset load, randomize) deliberately discard the form's other drafts.
  const openSetupSections = new Set<string>(), openOpponentCards = new Set<number>();
  let historySession = 'all', historyStake = 'all', historyResult = 'all';
  let replayId = '', replayFrame = 0, replayPlaying = false, replayShareNote = '';
  /* Patch 71: Play steps through the hand, one action a second. */
  setInterval(() => { if (!replayPlaying) return; const hand = replayId ? currentReplayHand() : undefined; if (!hand || replayFrame >= hand.frames.length - 1) { replayPlaying = false; render(); return; } replayFrame++; render(); }, 1000);
  let downloadUrl = '';
  let exportFiles:HistoryFiles|null=null;
  let exportRange:{startIndex:number;nextIndex:number;total:number}|null=null;
  let showExportText=false, showImportText=false, importRightsConfirmed=false, importTextDraft='';
  let exportNotice='', sessionNotice='';
  let afterExitConfigure=false;
  let resetConfirm = false, deleteConfirm=false;
  /* Patch 69: backup and restore. A backup is read only; a restore checks every part before anything changes. */
  const backupState:BackupState={blocked:'',working:false,notice:'',problem:'',file:null,pending:null,report:[]};
  let pendingBackup:Backup|null=null,backupBlob:Blob|null=null;
  const waitFor=async(ready:()=>boolean,ms=8000)=>{const end=Date.now()+ms;while(!ready()&&Date.now()<end)await new Promise(r=>setTimeout(r,50));return ready();};
  const backupBlocked=()=>controller.data?.active?'Cash out your table before backing up or restoring.':(plo??=new PloTable()).state.active?'Leave the Omaha table before backing up or restoring.':tournament?.data?.active?'Finish your tournament before backing up or restoring.':blackjackLive.controller.data?.active?'Leave the blackjack table before backing up or restoring.':(operation||controller.busy)?'Your save is busy. Try again in a moment.':'';
  /** Tournament and blackjack saves load on demand; wait until both have settled. */
  async function otherSavesReady():Promise<void>{
    ensureTournament();blackjackLive.init();
    const t=tournament!,b=blackjackLive.controller;
    await waitFor(()=>t.status!=='loading'&&!t.busy&&b.status!=='loading'&&!b.busy);
    if(t.status!=='ready')throw new Error(`The tournament save is not ready${t.error?`: ${t.error}`:'.'}`);
    if(b.status!=='ready')throw new Error(`The blackjack save is not ready${b.error?`: ${b.error}`:'.'}`);
  }
  async function makeBackupNow():Promise<void>{
    if(backupState.working)return;
    backupState.working=true;backupState.problem='';backupState.notice='';render();
    try{
      await otherSavesReady();
      const why=backupBlocked();if(why)throw new Error(why);
      const backup=makeBackup(await controller.backupData(),tournament!.backupData(),await blackjackLive.controller.backupSnapshot());
      backup.career=career ? structuredClone(career) : null;
      backup.omaha=structuredClone((plo??=new PloTable()).state);
      // Patch 101: slots and the casino tables too. Their rounds are saved before any animation, so a snapshot now is whole.
      backup.slots=structuredClone(slotsPlayer.state);casino.finishNow();backup.casino=structuredClone(casino.state);
      backupBlob=new Blob([JSON.stringify(backup)],{type:'application/json'});
      if(backupState.file)URL.revokeObjectURL(backupState.file.url);
      backupState.file={url:URL.createObjectURL(backupBlob),name:`poker-night-ai-backup-${backup.createdAt.slice(0,10)}.json`};
      const s=backup.summary;backupState.notice=`Backup ready: ${s.cashHands.toLocaleString('en-US')} cash hands, ${s.tournamentEvents} tournaments, ${s.blackjackRecords} blackjack records. Save it somewhere safe.`;
    }catch(cause){backupState.problem=cause instanceof Error?cause.message:String(cause);}
    finally{backupState.working=false;render();}
  }
  async function chooseBackupFile(file:File):Promise<void>{
    backupState.problem='';backupState.report=[];backupState.pending=null;pendingBackup=null;backupState.working=true;render();
    try{
      const backup=await readBackup(await file.text());
      pendingBackup=backup;backupState.pending={name:file.name,createdAt:backup.createdAt,summary:backup.summary};
    }catch(cause){backupState.problem=cause instanceof Error?cause.message:String(cause);}
    finally{backupState.working=false;render();root.querySelector<HTMLInputElement>('#restore-confirmation')?.focus();}
  }
  const cashStatus=()=>controller.status;
  async function restoreNow(typed:string):Promise<void>{
    const backup=pendingBackup;if(!backup||backupState.working)return;
    if(typed!==RESTORE_CONFIRMATION){backupState.problem=`Type ${RESTORE_CONFIRMATION} exactly to confirm.`;render();return;}
    backupState.working=true;backupState.problem='';backupState.report=[];render();
    const report:string[]=[];
    try{
      await otherSavesReady();
      const why=backupBlocked();if(why)throw new Error(why);
      /* Check every part first, so a refusal changes nothing. */
      const tProblem=backup.tournament?tournament!.restoreProblem(backup.tournament):'';
      const bProblem=backup.blackjack?blackjackLive.controller.restoreProblem(backup.blackjack):'';
      const mine=(plo??=new PloTable()).state,oProblem=backup.omaha&&mine.sessions.some(x=>!backup.omaha!.sessions.some(y=>y.id===x.id))?'This device has Omaha sessions that are not in the backup, so they would be lost.':'';
      if(tProblem||bProblem||oProblem)throw new Error(`Nothing was changed. ${[tProblem,bProblem,oProblem].filter(Boolean).join(' ')}`);
      if(controller.status!=='deleted'&&controller.status!=='ready')throw new Error('Nothing was changed. Your cash save is not ready.');
      if(backup.tournament){await tournament!.restoreBackup(backup.tournament);report.push(`Tournaments restored: ${backup.summary.tournamentEvents} finished events.`);}else report.push('No tournament data in this backup; left as it was.');
      if(backup.omaha){savePlo(backup.omaha);plo=new PloTable();report.push(`Omaha restored: balance $${Math.round(backup.omaha.balance/100).toLocaleString('en-US')}, ${backup.omaha.hands.length} recent hands.`);}
      if(backup.slots){saveSlots(backup.slots);slotsPlayer.state=backup.slots;report.push(`Slots restored: balance ${money(backup.slots.balance)}.`);}
      if(backup.casino){casino.restore(backup.casino);report.push(`Casino restored: balance ${money(backup.casino.balance)}.`);}
      if(backup.blackjack){await blackjackLive.controller.restoreBackup(backup.blackjack);report.push(`Blackjack restored: ${backup.summary.blackjackRecords} records.`);}else report.push('No blackjack data in this backup; left as it was.');
      clearTimer();
      await controller.restoreBackup(backup.cash,typed);
      if(controller.error||cashStatus()!=='ready')throw new Error(controller.error||'Cash restore could not be verified. Keep the backup file and retry.');
      clearPracticeViews();
      if(backup.career!==undefined){career=backup.career;saveCareer(career);if(career && !readCareer())report.push('Career is available for this visit only.');}
      report.push(`Cash restored: ${backup.summary.cashHands.toLocaleString('en-US')} hands, bankroll ${money(backup.summary.cashBankroll)}.`);
      backupState.pending=null;pendingBackup=null;settings=initializeOpponentSettings(structuredClone(DEFAULT_SETTINGS));view='cashier';
    }catch(cause){backupState.problem=cause instanceof Error?cause.message:String(cause);}
    finally{backupState.report=report;backupState.working=false;render();}
  }
  function wireBackup():void{
    root.querySelector('#make-backup')?.addEventListener('click',()=>{void makeBackupNow();});
    root.querySelector('#share-backup')?.addEventListener('click',()=>{const f=backupState.file;if(!f||!backupBlob)return;const file=new File([backupBlob],f.name,{type:'application/json'});const nav=navigator as Navigator&{canShare?:(d:unknown)=>boolean};if(nav.canShare&&!nav.canShare({files:[file]})){backupState.problem='Sharing files is not available here. Use Save instead.';render();return;}void navigator.share({files:[file],title:'Gold Crown Casino backup'}).catch(()=>{});});
    root.querySelector<HTMLInputElement>('#restore-file')?.addEventListener('change',event=>{const input=event.currentTarget as HTMLInputElement;const file=input.files?.[0];input.value='';if(file)void chooseBackupFile(file);});
    root.querySelector('#cancel-restore')?.addEventListener('click',()=>{backupState.pending=null;pendingBackup=null;backupState.problem='';render();});
    root.querySelector('#restore-form')?.addEventListener('submit',event=>{event.preventDefault();void restoreNow(root.querySelector<HTMLInputElement>('#restore-confirmation')?.value??'');});
  }
  let privacyGeneration=0;
  let importPreview:StudyImportPreview|null=null, importPreviewBusy=false, importPreviewPage=0, importPreviewRequest=0;
  const importSelection=new Set<number>();
  let presetChoice = '', presetName = '';
  let discardSetupDraft = false;
  let protectionNotice = '';
  let archiveNotice = '', maintenanceNotice = '';
  const unavailable = () => operation || controller.busy || controller.status !== 'ready';
  function clearTimer() { if (timer !== null) clearTimeout(timer); timer = null; pendingToken = ''; }
  function publicGame(): HeroViewModel | null { return game ? projectView(game, 0) : null; }
  function sync() { return timed('ui.sync',syncBody); }
  function syncBody() {
    // Maintenance releases the expanded archive before independently reading
    // it again. Hidden Study/Results views must not keep the old body graph alive.
    if(historyWasFullyLoaded&&!controller.historyLoaded){
      historySource=null;reviewCache=[];originCache=new WeakMap();filteredCache=null;statsProjection.reset();
    }
    historyWasFullyLoaded=controller.historyLoaded;
    const active = controller.data?.active;
    if(active?.exitMode)afterExitConfigure=true;
    if(!active&&afterExitConfigure){afterExitConfigure=false;view='host';sessionNotice='Session ended. Remaining chips were returned once to your bankroll. Your hands and results are saved.';}
    game = active?.game ?? null; paused = active?.paused ?? false; handNumber = active?.number ?? 0; noteHeroTurn();
    /* Phase 9 (F-22): a fresh visit with no table in progress opens on Home, not the
       empty cash lobby. Only the first ready sync decides, and never after the
       player has navigated somewhere themselves. */
    if (!bootNavDone && controller.status === 'ready') { bootNavDone = true; if (!userNavigated && !active && view === 'live') view = 'home'; }

    if (!initialSettingsLoaded && controller.data) {
      const saved = controller.data.sessions.find(session => session.id === active?.sessionId) ?? controller.data.sessions.at(-1);
      if (saved) settings = initializeOpponentSettings(structuredClone(saved.settings));
      initialSettingsLoaded = true;
    }
    if (active && (loadedSettingsFor !== active.sessionId || loadedSettingsHand !== active.game.handId)) {
      const session = controller.data!.sessions.find(item => item.id === active.sessionId);
      if (session) { settings = initializeOpponentSettings(structuredClone(session.settings)); delete settings.seatStacks; }
      loadedSettingsFor = active.sessionId; loadedSettingsHand = active.game.handId;
    }
    applyPreAction();
    render();
    void scheduleBot();
    void checkChallenge();
  }
  async function run(work: () => Promise<unknown>, lockHost = true) {
    if (operation || controller.busy) return;
    operation = true; lockHostForOperation=lockHost; error = ''; render();
    try { await work(); }
    catch (cause) { sessionNotice=''; error = cause instanceof Error ? cause.message : 'The action could not be saved. Please retry.'; }
    finally { operation = false; lockHostForOperation=false; sync(); }
  }
  async function scheduleBot() {
    if (!game || paused || game.street === 'complete' || game.actor === null || game.actor === 0 || controller.status !== 'ready') { clearTimer(); return; }
    if (unavailable()) return;
    const current = game;
    const token = `${current.handId}:${current.revision}:${current.actor}`;
    if ((timer && pendingToken === token) || preparingToken === token) return;
    clearTimer(); preparingToken = token;
    try {
      await controller.prepareBot();
      if (preparingToken !== token) return;
      preparingToken = '';
      const active = controller.data?.active;
      if (!active || active.paused || `${active.game.handId}:${active.game.revision}:${active.game.actor}` !== token || controller.status !== 'ready') return;
      if (!active.pending?.decision) { error = controller.error || 'The opponent decision could not be saved. Retry the saved session.'; render(); return; }
      pendingToken = token;
      const commitWhenReady = () => {
        if (pendingToken !== token) return;
        if (controller.status !== 'ready') { clearTimer(); return; }
        if (unavailable()) { timer = setTimeout(commitWhenReady, 40); return; }
        timer = null; pendingToken = '';
        // Automated play must not disable a draft field while its DOM node is
        // replaced: disabled inputs cannot regain focus after the render.
        void run(() => controller.commitBot(current.handId, current.revision),false);
      };
      const heroFolded = current.seats.find(seat => seat.id === 0)?.folded === true;
      if (skipToTurn && skipToTurn !== current.handId) skipToTurn = '';
      const plan = cashThinkPlan(active, controller.data), scale = pace / 900;
      // Patch 94: a remark from the last player stays up long enough to read before the next one acts.
      const said = tableTalk && active.humanLayer && (quipFor(active.game, id => active.profiles[id], true) || reraiseLine(active.game, namesAt(active.game, id => active.profiles[id])) || spectatorLine(active.game, namesAt(active.game, id => active.profiles[id]))) ? READ_AFTER_MS * Math.max(.5, scale) : 0;
      const delay = heroFolded ? Math.min(pace, FOLDED_PACE_MS) : skipToTurn === current.handId ? SKIP_PACE_MS : plan ? Math.max(said, pacedMs(plan, scale, pace <= 250 ? 1000 : READ_HOLD_MS)) : pace;
      // Patch 67: someone calls time on a long think, part way through it.
      timeCall = null;
      if (!heroFolded && delay >= TIME_CALL_MS && current.actor !== null) {
        const others = current.seats.filter(seat => seat.id !== current.actor && seat.id !== 0 && !seat.folded).map(seat => seat.id);
        if (others.length) { timeCall = { token, at: Date.now() + Math.round(delay * .6), by: others[current.revision % others.length] }; setTimeout(() => { if (timeCall?.token === token) render(); }, Math.round(delay * .6) + 20); }
      }
      timer = setTimeout(commitWhenReady, delay);
      // Patch 54: the acting seat's ring fills over the same delay (display only).
      if (!heroFolded && delay >= 400) { thinkFor = { token, ms: delay }; render(); }
    } catch (cause) {
      preparingToken = ''; clearTimer();
      error = cause instanceof Error ? cause.message : 'The opponent decision could not be saved.';
      render();
    }
  }
  function startSession() {
    if (unavailable()) return;
    try { readSettings(); void run(async () => { await controller.startSession(settings); if (controller.data?.active) { view = 'live'; sessionNotice = ''; } }); }
    catch (cause) { error = (cause as Error).message; render(); }
  }
  const completeToken = () => game && game.street === 'complete' ? `${game.handId}:${game.revision}` : '';
  /** Never deals while paused, leaving, short of chips, with settings queued, with a notice
      showing, or away from the table. Those all need the player. */
  function autoDealReady(): boolean {
    const active = controller.data?.active;
    if (!autoDeal || view !== 'live' || !game || game.street !== 'complete' || !active || paused || active.exitMode || active.queuedConfiguration || error || controller.error || controller.status !== 'ready') return false;
    return game.seats.filter(seat => seat.stack > 0).length >= 2 && (game.seats.find(seat => seat.id === 0)?.stack ?? 0) > 0;
  }
  const autoDealCounting = () => autoDealTimer !== null && autoDealToken === completeToken();
  const autoDealSeconds = () => Math.max(1, Math.ceil((autoDealAt - Date.now()) / 1000));
  function cancelAutoDeal() { if (autoDealTimer !== null) clearTimeout(autoDealTimer); autoDealTimer = null; }
  /** Called at the start of every render, so the panel always matches the timer. Never renders. */
  function scheduleAutoDeal() {
    const token = completeToken();
    if (!token) autoDealHeld = '';
    if (!token || autoDealHeld === token || !autoDealReady()) { cancelAutoDeal(); return; }
    if (autoDealTimer !== null && autoDealToken === token) return;
    cancelAutoDeal(); autoDealToken = token;
    const foldedEarly = !game!.revealedSeats.length && game!.events.some(e => e.type === 'action' && e.seatId === 0 && e.action?.type === 'fold' && e.street === 'preflop');
    // Patch 94: when players are talking, the next hand waits until the last line has been up for a moment.
    const lines = tableTalk ? cashChatter().lines : [], talking = lines.length, turns = new Set(lines.map(l => l.seatId)).size < talking;
    autoDealAt = Date.now() + Math.max(game!.revealedSeats.length ? AUTO_DEAL_SHOWDOWN_MS : foldedEarly ? AUTO_DEAL_QUICK_MS : AUTO_DEAL_MS, talking ? 1900 + talking * (turns ? 2100 : 1100) : 0);
    autoDealTimer = setTimeout(autoDealTick, 250);
  }
  function autoDealTick() {
    autoDealTimer = null;
    const token = completeToken();
    if (!token || token !== autoDealToken || autoDealHeld === token || !autoDealReady()) { render(); return; }
    if (Date.now() < autoDealAt || unavailable() || document.visibilityState === 'hidden') {
      autoDealTimer = setTimeout(autoDealTick, 250);
      const count = root.querySelector('#auto-deal-count'), seconds = String(autoDealSeconds());
      if (count && count.textContent !== seconds) count.textContent = seconds;
      return;
    }
    nextHand(game!.handId, game!.revision);
  }
  /** Acts on a Check/Fold chosen earlier this street: checks when that is free, otherwise folds. */
  function applyPreAction() {
    if (!game || game.street === 'complete') { preCheckFold = ''; return; }
    if (preCheckFold && preCheckFold !== `${game.handId}:${game.street}`) preCheckFold = '';
    if (!preCheckFold || game.actor !== 0 || paused || unavailable() || controller.data?.active?.exitMode) return;
    preCheckFold = '';
    submit({ type: projectView(game, 0).legal.check ? 'check' : 'fold' }, game.handId, game.revision, true);
  }
  function nextHand(expectedHandId: string, expectedRevision: number) {
    if (!game || game.street !== 'complete' || game.handId !== expectedHandId || game.revision !== expectedRevision || unavailable()) return;
    clearTimer(); cancelAutoDeal(); sessionNotice = '';
    // Patch 73: a decided heads-up match ends instead of dealing again.
    if (controller.data && matchState(controller.data)?.over) { huFinish = true; void checkChallenge(); return; }
    void run(() => controller.nextHand());
  }
  /** Patch 64: when your turn began, so the table can see whether you snapped or thought it over. */
  let heroTurn: { key: string; at: number; hidden: boolean } | null = null;
  function noteHeroTurn() {
    if (game && (game.actor === 0 || game.street === 'complete') && skipToTurn === game.handId) skipToTurn = '';
    const key = game && game.actor === 0 && game.street !== 'complete' ? `${game.handId}:${game.revision}` : '';
    if (!key) { heroTurn = null; return; }
    if (heroTurn?.key !== key) heroTurn = { key, at: performance.now(), hidden: document.hidden };
    else if (document.hidden) heroTurn.hidden = true;
  }
  function heroTempo(handId: string, revision: number, auto: boolean): Tempo | null {
    const turn = heroTurn;if (auto || !turn || turn.key !== `${handId}:${revision}` || turn.hidden || document.hidden) return null;
    const ms = performance.now() - turn.at;
    return ms < 1500 ? 'snap' : ms >= 7000 ? 'tank' : null;
  }
  function submit(action: Action, handId: string, revision: number, auto = false) {
    if (!game || paused || game.actor !== 0 || game.handId !== handId || game.revision !== revision || unavailable()) return;
    sessionNotice = '';
    if (!auto) reviewAction(coachUi, `${handId}:${revision}`, action, money);
    const tempo = heroTempo(handId, revision, auto);
    void run(() => controller.act(action, handId, revision, tempo));
  }
  function readSettings(validateSource=true) {
    const form = root.querySelector<HTMLFormElement>('#setup-form');
    if (!form) return;
    const data = new FormData(form);
    const stake = String(data.get('stake'));
    const [smallBlind, bigBlind] = stake === 'custom' ? [cents(String(data.get('smallBlind'))), cents(String(data.get('bigBlind')))] : PRESETS[Number(stake)];
    const seats = Number(data.get('seats'));
    const capacity = Number(data.get('capacity') ?? seats);
    if(!Number.isInteger(capacity)||capacity<seats||capacity>10)throw new Error('Capacity must be at least the occupied player count and no more than 10.');
    const selectedSeats = [0,...data.getAll('occupied-seat').map(Number)].sort((a,b)=>a-b);
    if(selectedSeats.length!==seats||selectedSeats.some(id=>id<0||id>=capacity)||new Set(selectedSeats).size!==seats)throw new Error('Select one occupied position for every player, including your seat.');
    const seatStacks:Record<number,number>={};
    for(const id of selectedSeats){const amount=String(data.get(`seat-stack-${id}`)??'').trim();if(amount)seatStacks[id]=cents(amount);}
    if (!Number.isInteger(seats) || seats < 2 || seats > 10) throw new Error('Choose between 2 and 10 players.');
    const selectedRake=String(data.get('rakeMode'));
    const rakeMode = selectedRake==='pokerstars-usd-2026'?'pokerstars-usd-2026':selectedRake==='custom'?'custom':'none';
    const chipUnit=Number(data.get('chipUnit')??1);
    if(![1,5,25,100].includes(chipUnit))throw new Error('Choose a supported chip denomination.');
    if(validateSource&&rakeMode==='pokerstars-usd-2026'){pokerStarsProfile(smallBlind,bigBlind);if(chipUnit!==1)throw new Error('The sourced PokerStars USD schedule uses one-cent accounting.');}
    const rakeBasisPoints = rakeMode === 'custom' ? cents(String(data.get('rakeRate'))) : settings.rakeBasisPoints;
    const rakeCap = rakeMode === 'custom' ? cents(String(data.get('rakeCap'))) : settings.rakeCap;
    if (rakeBasisPoints > 10000) throw new Error('Rake must be between 0% and 100%, with at most two decimal places.');
    if (rakeCap > 1000000000) throw new Error('The rake cap cannot exceed $10,000,000.');
    const minBuyInBB = Number(data.get('minBuyInBB'));
    const maxBuyInBB = Number(data.get('maxBuyInBB'));
    if (!Number.isInteger(minBuyInBB) || !Number.isInteger(maxBuyInBB) || minBuyInBB < 1 || maxBuyInBB < minBuyInBB || maxBuyInBB > 10000) throw new Error('Choose whole-number buy-in limits from 1 to 10,000 BB, with maximum at least minimum.');
    settings = { ...settings, chipUnit, capacity, occupiedSeatIds:selectedSeats, seatStacks, minBuyInBB, maxBuyInBB, allowTopUp: data.get('allowTopUp') === 'on', liveStraddle: data.get('straddle') === 'on' ? true : undefined, seats, stake, smallBlind, bigBlind, buyIn: cents(String(data.get('buyIn'))), rakeMode, rakeBasisPoints, rakeCap, noFlopNoDrop: rakeMode === 'custom' ? data.get('noFlopNoDrop') === 'on' : settings.noFlopNoDrop, ...readOpponentSettings(data, settings) };
  }
  function setup(): string {
    const locked = unavailable() || !!controller.data?.active?.exitMode;
    const active = controller.data?.active;
    const editorLocked=lockHostForOperation || controller.status!=='ready' || !!active?.exitMode;
    const capacity = settings.capacity ?? settings.seats;
    const occupied = occupiedSeatIds(settings);
    return `<section class="setup-panel panel"><div class="section-heading"><div><span class="eyebrow">YOUR ROOM, YOUR GAME</span><h2>Build your table</h2><p>${active ? 'Edit the next hand only. The current hand keeps its cards, chips and frozen rules until settlement.' : 'Choose the stakes, take a seat, and make every decision.'}</p></div><span class="outline-tag">Cash game</span></div>
      ${active?.queuedConfiguration ? `<div class="queued-configuration" role="status"><b>Next-hand changes saved</b><p>${active.queuedConfiguration.settings.seats} occupied seats / ${active.queuedConfiguration.settings.capacity ?? active.queuedConfiguration.settings.seats} capacity · ${money(active.queuedConfiguration.settings.smallBlind)} / ${money(active.queuedConfiguration.settings.bigBlind)}. Applied only when you deal the next hand.</p><button type="button" id="cancel-queued-config" class="button secondary" ${locked?'disabled':''}>Cancel queued changes</button></div>` : ''}
      <form id="setup-form"><fieldset class="setup-fieldset" ${editorLocked ? 'disabled' : ''}><div class="setup-fields"><label>Players at the table<select name="seats" id="seat-count">${Array.from({ length: 9 }, (_, i) => `<option value="${i + 2}" ${settings.seats === i + 2 ? 'selected' : ''}>${i + 2} players${i + 2 === 6 ? ' · 6-max' : ''}</option>`).join('')}</select></label><label>Blinds<select name="stake" id="stake-select">${PRESETS.map(([s, b], i) => `<option value="${i}" ${settings.stake === String(i) ? 'selected' : ''}>${money(s)} / ${money(b)}</option>`).join('')}<option value="custom" ${settings.stake === 'custom' ? 'selected' : ''}>Custom stakes</option></select></label>
      ${settings.stake === 'custom' ? `<label>Small blind ($)<input id="small-blind" name="smallBlind" inputmode="decimal" value="${settings.smallBlind / 100}" required></label><label>Big blind ($)<input id="big-blind" name="bigBlind" inputmode="decimal" value="${settings.bigBlind / 100}" required></label>` : ''}
      <label>Default buy-in per player ($)<input name="buyIn" id="buy-in" inputmode="decimal" value="${settings.buyIn / 100}" required><small>${(settings.buyIn / settings.bigBlind).toFixed(0)} big blinds per player</small></label></div>
      <div class="capacity-fields"><div class="setup-fields"><label>Table capacity<select name="capacity" id="table-capacity">${Array.from({length:9},(_,i)=>i+2).map(value=>`<option value="${value}" ${capacity===value?'selected':''} ${value<settings.seats?'disabled':''}>${value} positions</option>`).join('')}</select><small>Empty positions remain around the table and never act.</small></label></div><div class="seat-occupancy" role="group" aria-label="Occupied physical seats">${Array.from({length:capacity},(_,id)=>`<label><input type="checkbox" name="${id?'occupied-seat':'hero-seat'}" id="occupied-seat-${id}" data-occupied-seat="${id}" value="${id}" ${occupied.includes(id)?'checked':''} ${id===0?'disabled':''}>${id===0?'You':`Seat ${id+1}`}</label>`).join('')}</div><details id="stack-target-details"><summary>Individual stack targets for the next hand</summary><p class="muted">Blank carries a returning player’s settled stack; a new seat uses the default buy-in. Explicit targets transfer Hero’s difference to or from the bankroll between hands. Committed chips cannot be removed.</p><div class="seat-stack-fields">${occupied.map(id=>`<label>${escape(seatName(id))} · Seat ${id+1} ($)<input id="seat-stack-${id}" name="seat-stack-${id}" inputmode="decimal" value="${settings.seatStacks?.[id]===undefined?'':settings.seatStacks[id]/100}" placeholder="Carry stack / default buy-in"></label>`).join('')}</div></details></div>
      <details id="setup-presets" class="setup-section" ${openSetupSections.has('setup-presets')?'open':''}><summary>Saved table presets</summary><section class="preset-controls"><h3>Named table presets</h3><div class="preset-actions"><label>Saved preset<select id="saved-preset"><option value="">Choose a preset</option>${(controller.data?.namedPresets??[]).map(preset=>`<option value="${escape(preset.id)}" ${presetChoice===preset.id?'selected':''}>${escape(preset.name)}</option>`).join('')}</select></label><label>Name<input id="preset-name" value="${escape(presetName)}" maxlength="80" placeholder="Friday loose-passive table"></label><button id="preset-load" type="button" class="button secondary" ${presetChoice?'':'disabled'}>Load for editing</button><button id="preset-save" type="button" class="button secondary" ${locked?'disabled':''}>Save as new preset</button><button id="preset-update" type="button" class="button secondary" ${presetChoice&&!locked?'':'disabled'}>Update selected preset</button><button id="preset-clone" type="button" class="button secondary" ${presetChoice&&!locked?'':'disabled'}>Clone selected preset</button></div><p class="muted">Load and clone only change this setup. Queue or start it explicitly; prior sessions and original presets stay intact.</p></section></details>
      <details id="setup-rake" class="setup-section" ${openSetupSections.has('setup-rake')?'open':''}><summary>Rake and chip size</summary><div class="rake-setup"><div class="roster-heading"><h3>Cash-game rules</h3><span>Frozen for each hand</span></div><div class="setup-fields rake-fields"><label>Rake model<select name="rakeMode" id="rake-mode"><option value="none" ${settings.rakeMode === 'none' ? 'selected' : ''}>No rake</option><option value="custom" ${settings.rakeMode === 'custom' ? 'selected' : ''}>Custom practice rake</option><option value="pokerstars-usd-2026" ${settings.rakeMode === 'pokerstars-usd-2026' ? 'selected' : ''}>PokerStars USD regular NLHE · sourced 2026</option></select></label><label>Chip denomination<select id="chip-unit" name="chipUnit">${[1,5,25,100].map(unit=>`<option value="${unit}" ${(settings.chipUnit??1)===unit?'selected':''}>${money(unit)}</option>`).join('')}</select><small>Applied between hands only; online schedule requires $0.01.</small></label>${settings.rakeMode === 'custom' ? `<label>Rake rate (%)<input name="rakeRate" id="rake-rate" inputmode="decimal" value="${settings.rakeBasisPoints / 100}" required><small>0–100% · two decimal places</small></label><label>Cap per hand ($)<input name="rakeCap" id="rake-cap" inputmode="decimal" value="${settings.rakeCap / 100}" required><small>A $0 cap means no rake is taken</small></label>` : ''}</div>${settings.rakeMode === 'custom' ? `<label class="checkbox-label"><input type="checkbox" name="noFlopNoDrop" id="no-flop-no-drop" ${settings.noFlopNoDrop ? 'checked' : ''}>No flop, no drop <small>No rake when the hand ends before the flop.</small></label>` : ''}<p class="rake-explanation">${settings.rakeMode==='pokerstars-usd-2026'?'Sourced schedule: PokerStars USD regular No-Limit Hold’em, checked November 1, 2026. Not Zoom. Exact supported stakes only; the cap is chosen from the number actually dealt in (2, 3–4, 5+), not table capacity. No flop, no drop; percentage rounded to nearest cent with ties to even. The immutable rules version stays attached to each hand.':'Transparent practice profile: percentage of contestable chips, rounded down to the configured chip unit and capped once per hand. Uncalled returns are excluded. Custom practice rake is not a casino or online-room schedule.'}</p></div></details>
      ${opponentSetup(settings, NAMES, COLORS, openOpponentDetails, openOpponentCards)}
      ${unavailableFeaturesMarkup()}
      <div class="setup-note"><span>◎</span><p>Transparent practice rules · ${settings.rakeMode === 'none' ? 'No rake' : settings.rakeMode==='pokerstars-usd-2026'?'PokerStars USD 2026 · occupancy-dependent cap':`${settings.rakeBasisPoints / 100}% rake, ${money(settings.rakeCap)} cap`} · Cash antes, button straddles and multiple straddles remain unavailable. A live UTG straddle can be enabled below. New sessions use the current synthetic policies. Saved sessions and old hands keep their original policy versions.</p></div>
      <details id="setup-buyin" class="setup-section" ${openSetupSections.has('setup-buyin')?'open':''}><summary>Buy-in limits and top-ups</summary><div class="roster-heading"><h3>Table buy-in rules</h3><span>Applied at the next hand boundary</span></div><div class="setup-fields"><label>Minimum buy-in (BB)<input name="minBuyInBB" id="min-buyin-bb" type="number" min="1" max="10000" value="${settings.minBuyInBB}" required></label><label>Maximum stack / buy-in (BB)<input name="maxBuyInBB" id="max-buyin-bb" type="number" min="1" max="10000" value="${settings.maxBuyInBB}" required></label></div><label class="checkbox-label"><input type="checkbox" name="allowTopUp" id="allow-topup" ${settings.allowTopUp ? 'checked' : ''}>Allow top-ups between hands</label><label class="checkbox-label"><input type="checkbox" name="straddle" id="allow-straddle" ${settings.liveStraddle ? 'checked' : ''}>Allow a live straddle (under the gun posts 2× the big blind and acts last before the flop)</label><p class="muted">Your buy-in transfers from your virtual bankroll. Opponents use separate simulator chips. Old hands and results remain saved.</p></details>
      </fieldset><div class="setup-start-bar"><button id="setup-submit" type="submit" class="button primary start-button" ${locked ? 'disabled' : ''}>${game ? 'Queue changes for next hand' : 'Take your seat'} <span>→</span></button></div>${game ? '<p class="muted">Queued edits do not change this hand. Deal the next hand after settlement to apply them, or use New session to cash out safely.</p>' : '<button type="button" id="quick-start-live" class="button secondary">Play synthetic live $1/$2 · 9 seats · $300</button>'}<p class="muted">${LIVE_ONE_TWO_DISCLOSURE}</p></form></section>`;
  }
  function sessionManager():string{
    const active=controller.data?.active;
    if(!active)return setup();
    const completed=active.game.street==='complete';
    const hero=active.game.seats.find(seat=>seat.id===0)!;
    const ending=active.exitMode;
    return `<section class="panel session-manager" data-testid="session-manager"><span class="eyebrow">YOUR SESSION</span><h2>${ending?'This session is ending':completed?'Ready for a new table?':'Finish this hand safely'}</h2>
      <p>${completed?'This hand is settled. Cash out your remaining table chips, then choose new stakes, seats and opponents.':'An active hand cannot be reset: your committed chips stay in the pot and the result must be settled.'}</p>
      <p>Available bankroll <b>${money(controller.data!.wallet)}</b> · Seated stack <b>${money(hero.stack)}</b>${!completed?` · Committed this hand <b>${money(hero.totalCommitted)}</b>`:''}. Saved records and poker results are kept.</p>
      ${ending?`<p role="status">${ending==='fold'?'Fold and leave is saved. Your next legal turn will fold; an existing all-in remains live. Opponents finish the hand, then your remaining chips cash out automatically.':'Finish current hand is saved. Play your remaining decisions; cashout happens automatically after settlement.'}</p><button id="back-live" class="button primary">Return to current hand</button>`:completed?`<button id="end-complete" class="button primary" ${unavailable()?'disabled':''}>Cash out ${money(hero.stack)} & configure new session</button>`:`<div class="session-options"><div><h3>Play it out</h3><p>Keep making your decisions. After this hand settles, the session ends and your remaining chips return to your bankroll.</p><button id="end-finish" class="button primary" ${unavailable()?'disabled':''}>Finish current hand & end session</button></div><div><h3>Leave the table</h3><p>Fold at your next legal turn, even if checking is available. Committed chips stay in play. If already all-in, wait for the result. Opponents complete the hand before cashout.</p><button id="end-fold" class="button secondary" ${unavailable()?'disabled':''}>Fold & leave after this hand</button></div></div><button id="back-live" class="button secondary">Keep playing this session</button>`}
    </section>`;
  }
  function seatOnBreak(id: number): boolean {
    const a = controller.data?.active;
    return !!a && Number(a.humanLayer?.split('.')[1] ?? 0) >= 15 && cashBreak(controller.data!.hands, a, id, controller.data!.humanMemory).onBreak;
  }
  function resultCharts(filtered: boolean): string {
    const data = controller.data;
    if (!data) return '';
    const results = lineChartMarkup('chart-results', 'Results over time · all cash hands', resultSeries(data, money), money, true);
    const bankroll = lineChartMarkup('chart-bankroll', 'Available bankroll', bankrollSeries(data, money), money, false);
    if (!results && !bankroll) return '';
    return `<div class="chart-row" data-testid="result-charts">${results}${bankroll}</div>${filtered ? '<p class="muted">The charts always show all cash play; the filter applies to the tables below.</p>' : ''}`;
  }
  /** Patch 55: the gliding dealer button and, at settlement, pot chips flying to each winner. Positioned like seats. */
  function anchorStyle(id: number, total: number): string {
    const c = perimeterLayout(total, true).points[id], w = perimeterLayout(total, false).points[id], sh = shortPerimeterLayout(total).points[id];
    return c && w && sh ? `--compact-x:${c.x};--compact-y:${c.y};--wide-x:${w.x};--wide-y:${w.y};--short-x:${sh.x};--short-y:${sh.y}` : '';
  }
  /**
   * Patch 60: when a stack changes during a hand, its number counts to the new value. The real value stays in the
   * element's text (screen readers and tests read it); the moving number is drawn from a data attribute by CSS.
   */
  function countStacks(): void {
    if (!game) { lastStacks = null; return; }
    const now = new Map(game.seats.map(seat => [seat.id, seat.stack] as [number, number]));
    const prev = lastStacks?.handId === game.handId ? lastStacks.stacks : null;
    lastStacks = { handId: game.handId, stacks: now };
    if (!prev || !motion || matchMedia('(prefers-reduced-motion: reduce)').matches) return;
    const unit = game.profile.chipUnit || 1;
    for (const [id, to] of now) {
      const from = prev.get(id);
      if (from === undefined || from === to) continue;
      const el = root.querySelector<HTMLElement>(`[data-seat="${id}"] .seat-label strong`);
      if (!el) continue;
      const start = performance.now(), duration = 520;
      const step = (time: number) => {
        if (!el.isConnected) return;
        const t = Math.min(1, (time - start) / duration), eased = 1 - (1 - t) ** 3;
        if (t >= 1) { el.removeAttribute('data-tick'); return; }
        el.setAttribute('data-tick', money(Math.round((from + (to - from) * eased) / unit) * unit));
        requestAnimationFrame(step);
      };
      el.setAttribute('data-tick', money(from));
      requestAnimationFrame(step);
    }
  }
  /** A live reaction if there is one; otherwise the player's public session mood (patch 61). */
  function faceMood(shown: HeroViewModel | null, id: number): Mood {
    const live = liveMood(shown, id);
    if (live !== 'neutral' || !shown) return live;
    const seat = shown.seats.find(item => item.id === id);
    return seat ? sessionMoodFace(seat.stack, trendBase?.get(`${id}:${seat.name}`), shown.profile.bigBlind) : 'neutral';
  }
  function talkLogMarkup(): string {
    if (!tableTalk) return '';
    return `<details class="talk-log" id="talk-log" ${talkLogOpen ? 'open' : ''}><summary>Table talk · ${talkLog.length}</summary>${talkLog.length ? `<ol>${talkLog.slice().reverse().map(entry => `<li><b>${escape(entry.name)}</b> <span>“${escape(entry.text)}”</span><small>Hand ${entry.hand}</small></li>`).join('')}</ol>` : '<p class="muted">Nothing said yet this visit.</p>'}</details>`;
  }
  function totalAwardFor(view: HeroViewModel): number { return Object.values(view.payouts).reduce((a, b) => a + b, 0); }
  function dealerVars(button: number, total: number): string {
    return anchorStyle(button, total).replace(/--(compact|wide|short)-/g, '--dealer-$1-');
  }
  function potPileMarkup(amount: number, bigBlind: number): string {
    const stacks = potPile(amount, bigBlind);
    return stacks.length ? `<i class="pot-pile" aria-hidden="true">${stacks.map(stack => `<span class="pile-stack">${stack.map(color => `<span class="chip chip-${color}"></span>`).join('')}</span>`).join('')}</i>` : '';
  }
  function tableAnchors(shown: HeroViewModel | null, total: number): string {
    if (!shown) return '';
    const swept = sweep && sweep.key === `${shown.handId}:${shown.street}` ? sweep.bets.map(bet => `<span class="seat-anchor pot-sweep" style="${anchorStyle(bet.id, total)}" aria-hidden="true">${chipStackMarkup(bet.amount, shown.profile.bigBlind)}</span>`).join('') : '';
    const dealer = `<span class="seat-anchor dealer-glide" style="${anchorStyle(shown.button, total)}" aria-hidden="true">D</span>`;
    const winners = shown.street === 'complete' ? Object.entries(shown.payouts).filter(([, amount]) => amount > 0) : [];
    return swept + dealer + winners.map(([id, amount]) => `<span class="seat-anchor pot-fly" style="${anchorStyle(Number(id), total)}" aria-hidden="true">${chipStackMarkup(amount, shown.profile.bigBlind, ' pot-chips')}</span>`).join('');
  }
  function sessionClock(): { ms: number; due: number; sessionId: string } | null {
    const active = controller.data?.active;
    const session = active ? controller.data?.sessions.find(item => item.id === active.sessionId) : undefined;
    return session ? { ms: session.activeMs, due: breaksDue(session.activeMs, style.breakEvery), sessionId: session.id } : null;
  }
  function breakReminder(): string {
    const clock = sessionClock();
    if (!clock || clock.due <= (breakAck.get(clock.sessionId) ?? 0)) return '';
    return `<div class="break-reminder" role="status" data-testid="break-reminder"><span aria-hidden="true">☕</span><p><b>You have been playing for ${durationText(clock.ms)}.</b> A short break is a good idea. Your seat and chips stay put.</p><div><button type="button" id="break-pause" class="button secondary">Pause the table</button><button type="button" id="break-dismiss" class="button secondary">Keep playing</button></div></div>`;
  }
  /** Patch 56: a player card from public information only: name, stack, your note, and completed-hand observations. */
  function profileCard(shown: HeroViewModel | null): string {
    const data = controller.data, active = data?.active;
    if (profileSeat === null || !shown || !data || !active) return '';
    const seat = shown.seats.find(item => item.id === profileSeat);
    if (!seat) { profileSeat = null; return ''; }
    const name = seatName(seat.id, shown);
    const together = data.hands.filter(hand => hand.sessionId === active.sessionId && hand.view.seats.some(item => item.id === seat.id && item.name === seat.name));
    const note = getPlayerNote(data, active.sessionId, seat.id);
    const between = shown.street === 'complete';
    let observed = '';
    if (between && together.length) {
      const memory = buildOpponentMemory(publicMemoryHands(together, active.sessionId, 0), 0, 1);
      const o = memory.opponents.find(item => item.seatId === seat.id);
      const pct = (r: { count: number; opportunities: number }) => r.opportunities ? `${Math.round(100 * r.count / r.opportunities)}%` : '—';
      observed = o ? `<dl class="profile-rates"><div><dt>Played a hand</dt><dd>${pct(o.vpip)}</dd><small>${o.vpip.count}/${o.vpip.opportunities}</small></div><div><dt>Raised preflop</dt><dd>${pct(o.pfr)}</dd><small>${o.pfr.count}/${o.pfr.opportunities}</small></div><div><dt>Bet or raised</dt><dd>${pct(o.aggression)}</dd><small>${o.aggression.count}/${o.aggression.opportunities}</small></div><div><dt>Folded to a bet</dt><dd>${pct(o.foldToBet)}</dd><small>${o.foldToBet.count}/${o.foldToBet.opportunities}</small></div></dl>${o.showdowns.length ? `<p class="profile-shown">Shown down: ${o.showdowns.slice(-3).map(cards => cards.map(c => card(c, 'mini-card')).join('')).join('<span aria-hidden="true"> · </span>')}</p>` : ''}` : '';
    }
    return `<section class="profile-card" role="dialog" aria-labelledby="profile-name" data-testid="profile-card"><button type="button" id="profile-close" class="profile-close" aria-label="Close player card">×</button><div class="profile-head">${style.avatars ? `<span class="profile-face" aria-hidden="true">${faceArt(name, 'neutral', false, 'large', shown, seat.id)}</span>` : ''}<div><h3 id="profile-name">${escape(name)}</h3><p>${money(seat.stack)} · ${together.length} ${together.length === 1 ? 'hand' : 'hands'} together this session</p>${(() => { const t = personaFor(name, REGULARS.find(r => r.name === name)?.id); return `<p class="profile-persona" data-testid="profile-persona"><b>${escape(t.label)}</b> · ${escape(t.blurb)} <span class="muted">Table manner only: it says nothing about how they play.</span></p>`; })()}</div></div>${(() => { if (!between) return ''; const p = deepData().players.get(name); if (!p || p.hands < 5) return ''; const af = aggressionFactor(p), r = (x: Count) => { const v = countPct(x); return v === null ? '—' : `${v.toFixed(0)}%`; }; return `<p class="profile-deep" data-testid="profile-deep"><b>All sessions:</b> ${p.hands} hands · VPIP ${r(p.vpip)} · PFR ${r(p.pfr)} · 3-bet ${r(p.threeBet)} · aggression ${af === null ? '—' : af === Infinity ? '∞' : af.toFixed(1)} · c-bet ${r(p.cbet)} · showdown ${r(p.wtsd)} · won at showdown ${r(p.wsd)}</p>`; })()}${(() => { const net = rivalryNet(name); if (!net) return ''; const hu = headsUpPotsNet(together, name); return `<p class="profile-rivalry" data-testid="profile-rivalry"><b>Against you this session:</b> ≈ ${net > 0 ? '+' : '−'}${money(Math.abs(net))} <span class="muted">(estimate — each pot split between the players it was won from or lost to, the same split the recap uses)</span>${hu.pots ? `<br>Heads-up pots only, exact: ${hu.pots} pot${hu.pots === 1 ? '' : 's'}, you ${hu.net >= 0 ? '+' : '−'}${money(Math.abs(hu.net))}` : ''}</p>`; })()}${between ? (observed || '<p class="muted">No completed hands with this player yet.</p>') : '<p class="muted">Observed numbers show between hands, like the Opponent study page.</p>'}<div class="profile-note"><span class="eyebrow">YOUR NOTE</span><p>${note ? escape(note.text) : '<span class="muted">No note yet.</span>'}</p><button type="button" id="profile-edit-note" class="button secondary">${note ? 'Edit note' : 'Add a note'}</button></div><p class="muted profile-foot">Completed public actions only. Styles and hidden cards are never shown.</p></section>`;
  }
  function trendArrow(seat: { id: number; name: string; stack: number } | undefined, shown: HeroViewModel | null): string {
    if (!style.trends || !seat || !shown || !trendBase) return '';
    const trend = stackTrend(seat.stack, trendBase.get(`${seat.id}:${seat.name}`), shown.profile.bigBlind);
    return trend ? `<i class="stack-trend ${trend}" title="${trend === 'up' ? 'Up' : 'Down'} this session"><span aria-hidden="true">${trend === 'up' ? '▲' : '▼'}</span><span class="sr-only">, ${trend} this session</span></i>` : '';
  }
  function recapMarkup(sessionId: string, expectedHands: number): string {
    const data = controller.data;
    const r = data ? sessionRecap(data, sessionId) : null;
    if (!r) return expectedHands ? `<p class="muted" role="status">Session recap unavailable: older hand details are not currently loaded.</p>` : '';
    const partial = r.hands < expectedHands ? `<p class="muted" role="status">Partial recap: ${r.hands} of ${expectedHands} hands are currently loaded. Key hands, trends and opponent estimates may be incomplete.</p>` : '';
    const hand = (h: { id: string; number: number; net: number; label: string }) => `<li><button type="button" class="recap-hand" data-recap-hand="${escape(h.id)}"><span>Hand ${h.number} · ${escape(h.label)}</span><b class="${h.net > 0 ? 'positive' : 'negative'}">${signed(h.net)}</b><span class="recap-replay" aria-hidden="true">Replay ›</span></button></li>`;
    // Patch 64: tells shown by players who then showed their cards, the ones you acted against first.
    const notes = data ? tellNotes(data, sessionId) : [];
    const sessionLeaks = data ? findLeaks(data.hands.filter(h => h.sessionId === sessionId)) : [];
    const leakPart = `<h4>Where you lost money</h4>${leakCards(sessionLeaks, 3)}<button type="button" class="button secondary" data-coach-session="${escape(sessionId)}">Drill this session's spots</button>`;
    const coach = notes.length ? `<h4>Tells you could have used</h4><ul class="recap-tells">${notes.map(n => `<li class="${n.missed ? 'missed' : ''}${n.fake ? ' fake' : ''}"><button type="button" class="recap-hand" data-recap-hand="${escape(n.handId)}"><span>Hand ${n.number} · ${escape(n.text)}</span><span class="recap-replay" aria-hidden="true">Replay ›</span></button></li>`).join('')}</ul><p class="muted">Only from hands where the player's cards were shown, so you can check each one in History.</p>` : '';
    const rivals = r.rivals.map(x => `<li><span>${escape(x.name)}</span><b class="${x.net > 0 ? 'positive' : 'negative'}">${x.net > 0 ? 'You won ' : 'You lost '}${money(Math.abs(x.net))}</b></li>`).join('');
    /* Phase 10 (fun #3): hand of the session — the single biggest pot (total awarded),
     * surfaced on the recap with its one-tap replay. Presentation over stored hands. */
    const sessionHands = data ? data.hands.filter(h => h.sessionId === sessionId) : [];
    const potOf = (h: StoredHand) => Object.values(h.view.payouts).reduce((a, b) => a + b, 0);
    const handOfSession = sessionHands.reduce<StoredHand | null>((best, h) => (best === null || potOf(h) > potOf(best) ? h : best), null);
    const handOfSessionMarkup = handOfSession && potOf(handOfSession) > 0 ? `<h4>Hand of the session</h4><ol class="recap-hands"><li><button type="button" class="recap-hand" data-recap-hand="${escape(handOfSession.id)}"><span>Hand ${handOfSession.number} · biggest pot ${money(potOf(handOfSession))} · your result ${signed(handOfSession.net)}</span><span class="recap-replay" aria-hidden="true">Replay ›</span></button></li></ol>` : '';
    return `<details class="session-recap" open><summary>Session recap</summary>${partial}<div class="recap-grid"><div class="recap-curve"><span>How it went</span>${sparkline(r.curve)}</div><dl class="recap-facts"><div><dt>Pots won</dt><dd>${r.won} of ${r.hands}</dd></div><div><dt>Showdowns won</dt><dd>${r.showdowns ? `${r.showdownsWon} of ${r.showdowns}` : '—'}</dd></div></dl></div>${handOfSessionMarkup}${r.keyHands.length ? `<h4>Key hands</h4><ol class="recap-hands">${r.keyHands.map(hand).join('')}</ol>` : ''}${rivals ? `<h4>Who the chips went to</h4><ul class="recap-rivals">${rivals}</ul><p class="muted">Each hand's result is split between the players it was won from or lost to, rounded to the dollar.</p>` : ''}${leakPart}${coach}</details>`;
  }
  function tourMarkup(): string {
    if (tourStep < 0) return '';
    const steps = [
      ['Start in one tap', 'Quick game deals you into a synthetic $1/$2 table. Build your table lets you pick stakes, seats and opponents first.'],
      ['At the table', 'Your choices appear in the bar at the bottom. Under the table, “Table look & sound” sets the felt, cards, sounds, a hand label and keyboard shortcuts.'],
      ['After you play', 'History replays every hand. Stats shows your results, charts and milestones. Everything is saved on this device; virtual chips only.'],
    ];
    const step = Math.min(tourStep, steps.length - 1), [heading, body] = steps[step];
    return `<section class="welcome-tour" aria-label="Getting started" data-testid="welcome-tour"><div class="tour-dots" aria-hidden="true">${steps.map((_, i) => `<i class="${i === step ? 'on' : ''}"></i>`).join('')}</div><span class="eyebrow">GETTING STARTED · ${step + 1} OF ${steps.length}</span><h3>${heading}</h3><p>${body}</p><div class="tour-buttons">${step > 0 ? '<button type="button" id="tour-back" class="button secondary">Back</button>' : '<button type="button" id="tour-skip" class="button secondary">Skip</button>'}${step < steps.length - 1 ? '<button type="button" id="tour-next" class="button primary">Next</button>' : '<button type="button" id="tour-done" class="button primary">Got it</button>'}</div></section>`;
  }
  function milestonesMarkup(): string {
    const data = controller.data;
    if (!data) return '';
    const streak = sessionStreaks(sessionResults(data));
    const items = [...cashMilestones(data), ...tournamentMilestones(tournament?.records ?? [])];
    const earned = items.filter(item => item.earned).length;
    const card = (m: Milestone) => `<li class="milestone${m.earned ? ' earned' : ''}"><span class="milestone-mark" aria-hidden="true">${m.earned ? '★' : '☆'}</span><div><b>${escape(m.title)}</b><small>${escape(m.detail)}</small>${m.progress && !m.earned ? `<span class="milestone-bar" role="img" aria-label="${m.progress.have} of ${m.progress.need}"><i style="width:${Math.round(100 * m.progress.have / m.progress.need)}%"></i></span><small>${m.progress.have.toLocaleString('en-US')} / ${m.progress.need.toLocaleString('en-US')}</small>` : ''}</div><span class="sr-only">${m.earned ? 'Earned' : 'Not yet'}</span></li>`;
    return `<section class="panel results-panel milestones" data-testid="milestones"><div class="section-heading"><div><span class="eyebrow">MILESTONES</span><h2>${earned} of ${items.length} reached</h2><p>Worked out from your saved play on this device. Pot sizes and showdowns use the hands currently loaded.</p></div></div><div class="streaks"><div><span>Winning sessions in a row</span><b>${streak.current}</b></div><div><span>Best run</span><b>${streak.best}</b></div><div><span>Completed sessions</span><b>${streak.completed}</b></div></div><h3 class="milestone-group">Cash</h3><ul class="milestone-grid">${items.filter(m => m.group === 'cash').map(card).join('')}</ul><h3 class="milestone-group">Tournaments</h3><ul class="milestone-grid">${items.filter(m => m.group === 'tournament').map(card).join('')}</ul></section>`;
  }
  function cashMoment(shown: HeroViewModel | null): string {
    if (!shown || shown.street !== 'complete') return '';
    const sessionId = controller.data?.active?.sessionId;
    const others = (controller.data?.hands ?? []).filter(hand => hand.sessionId === sessionId && hand.view.handId !== shown.handId).map(hand => hand.net);
    return momentMarkup(handMoment(shown, 0, money, others.length ? Math.max(...others) : null), shown.handId);
  }
  function cashOutSummaryMarkup(): string {
    const s = cashOutSummary;
    if (!s) return '';
    const cell = (label: string, value: string) => `<div><dt>${label}</dt><dd>${value}</dd></div>`;
    return `<section class="panel cashout-summary" role="status" data-testid="cashout-summary"><div class="cashout-head"><div><span class="eyebrow">SESSION COMPLETE · ${money(s.smallBlind)}/${money(s.bigBlind)}</span><h2 class="${s.result > 0 ? 'positive' : s.result < 0 ? 'negative' : ''}">${signed(s.result)}</h2><p>${s.hands} ${s.hands === 1 ? 'hand' : 'hands'} · ${durationText(s.activeMs)}${s.bb100 === null ? '' : ` · ${s.bb100.toFixed(1)} bb/100`}</p></div><button type="button" id="dismiss-summary" class="button secondary">Done</button></div><dl>${cell('Bought in', money(s.buyIns))}${cell('Cashed out', money(s.cashOut))}${cell('Best hand profit', s.biggestWin === null ? '—' : `+${money(s.biggestWin)}`)}</dl>${recapMarkup(s.sessionId, s.hands)}<p class="muted">Virtual chips. Simulator results do not predict live poker winnings.</p></section>`;

  }
  /** Patch 63: the face shown for a player: an illustrated portrait, or the drawn face. One portrait per player at a table. */
  let portraitKey = '', portraitMap = new Map<number, number>();
  function heroPortrait(): number { return style.heroPortrait ?? DEFAULT_HERO_PORTRAIT; }
  function faceArt(name: string, mood: Mood, hero: boolean, size: 'seat' | 'large' = 'seat', view: { seats: readonly { id: number; name: string }[] } | null = null, seatId: number | null = null): string {
    if (!style.portraits) return avatarSvg(name, mood, hero ? style.heroFace : null);
    if (hero) return portraitMarkup(heroPortrait(), mood, size);
    if (view) {
      const seats = view.seats.filter(seat => seat.id !== 0), key = `${heroPortrait()}|${seats.map(seat => `${seat.id}:${seat.name}`).join('|')}`;
      if (key !== portraitKey) { portraitKey = key; portraitMap = tablePortraitsForSeats(seats, heroPortrait()); }
    }
    return portraitMarkup((seatId === null ? undefined : portraitMap.get(seatId)) ?? portraitFor(name, new Set([heroPortrait()])), mood, size);
  }
  /** Patch 84: the same faces in every game. One portrait per player at each table, Hero's own reserved. */
  const tableFaceCache = new Map<string, Map<string, number>>();
  setTableFaces(names => {
    if (!style.avatars) return null;
    const key = `${heroPortrait()}|${names.join('|')}`;
    let map = tableFaceCache.get(key);
    if (!map) { if (tableFaceCache.size > 40) tableFaceCache.clear(); map = tablePortraits(names, heroPortrait()); tableFaceCache.set(key, map); }
    const seats = map;
    return (name, hero = false, mood = 'neutral') => {
      if (!style.portraits) return faceArt(hero ? 'You' : name, mood, hero);
      return portraitMarkup(hero ? heroPortrait() : seats.get(name) ?? portraitFor(name, new Set([heroPortrait()])), mood);
    };
  });
  function portraitPicker(): string {
    const chosen = heroPortrait();
    return `<fieldset class="portrait-picker"><legend>Your portrait</legend><div class="portrait-grid" role="radiogroup" aria-label="Your portrait">${Array.from({ length: PORTRAIT_COUNT }, (_, i) => `<button type="button" class="portrait-choice ${i === chosen ? 'chosen' : ''}" role="radio" aria-checked="${i === chosen}" aria-label="Portrait ${i + 1}" data-portrait="${i}">${portraitMarkup(i, 'neutral', 'seat')}</button>`).join('')}</div></fieldset>`;
  }
  /** Patch 64: the tell the acting computer player is giving while they decide (cash tables with a human layer). */
  function thinkingTells(id: number): Tells | null {
    const a = controller.data?.active;
    if (!a?.humanLayer || a.game.actor !== id || id === 0 || a.pending?.seatId !== id || !a.pending.decision) return null;
    return liveTells(a.game, a.profiles[id], a.pending.decision.action);
  }
  /** A word while deciding: reading your timing (layer 1.20.0), or asking about your bet. */
  /** Patch 67: facing a bet for a big part of their stack, a player counts their chips first. */
  function countingChips(id: number): string | undefined {
    const g = controller.data?.active?.game, seat = g?.seats.find(s => s.id === id);
    if (!g || !seat || g.actor !== id || id === 0) return undefined;
    const toCall = Math.max(0, ...g.seats.map(s => s.streetCommitted)) - seat.streetCommitted;
    return toCall >= .4 * seat.stack && toCall > 0 && seat.stack > 0 ? 'counts their chips' : undefined;
  }
  /** Patch 87: waiting tells and board reactions from players other than the one acting (cash, with a human layer). */
  let sideCache: { key: string; map: Map<number, SideTell> } | null = null;
  function cashSideTells(): Map<number, SideTell> {
    const a = controller.data?.active;
    if (!a?.humanLayer || a.game.street === 'complete') return new Map();
    const key = `${a.game.handId}:${a.game.revision}:${a.game.actor}`;
    if (sideCache?.key !== key) sideCache = { key, map: sideTells(a.game, id => a.profiles[id]) };
    return sideCache.map;
  }
  function cueClass(id: number): string {
    const cue = thinkingTells(id)?.cue;if (!cue) return '';
    const s = (STRONG_CUES as readonly string[]).indexOf(cue), w = (WEAK_CUES as readonly string[]).indexOf(cue);
    return s >= 0 ? ` cue-s${s}` : w >= 0 ? ` cue-w${w}` : '';
  }
  /** Patch 68: on your first hand of a session, a player who remembers you from before says so. */
  let greetCache: { key: string; line: TalkLine | null } | null = null;
  function memoryGreeting(): TalkLine | null {
    const a = controller.data?.active, d = controller.data;
    if (!tableTalk || !a || !d || a.game.events.some(e => e.type === 'action' && e.action?.type === 'raise')) return null;
    const first = !d.hands.some(h => h.sessionId === a.sessionId);if (!first) return null;
    const key = a.game.handId;
    if (greetCache?.key === key) return greetCache.line;
    let line: TalkLine | null = null;
    for (const seat of a.game.seats) { if (seat.id === 0 || !isRegularName(seat.name)) continue; const m = cashMemoryReads(d.hands, a, seat.id); const text = m ? greetingFor(m.tempo, m.river, m.together) : null; if (text) { line = { seatId: seat.id, text }; break; } }
    greetCache = { key, line }; return line;
  }
  /** Patch 88: between hands, when you will be under the gun next hand at a straddle table: straddle or not. */
  function straddlePrompt(): string {
    const a = controller.data?.active;
    if (!a || !a.game.profile.straddle || a.game.street !== 'complete' || nextHandStraddleSeat(a.game) !== 0) return '';
    const amount = money(2 * a.game.profile.bigBlind), on = !!a.heroStraddle;
    return `<div class="straddle-prompt" data-testid="straddle-prompt"><p><b>You're under the gun next hand.</b> Straddle ${amount}? You act last before the flop.</p><div class="segmented" role="group" aria-label="Straddle next hand"><button type="button" class="segment${on ? ' selected' : ''}" data-straddle-choice="on" aria-pressed="${on}">Straddle ${amount}</button><button type="button" class="segment${on ? '' : ' selected'}" data-straddle-choice="off" aria-pressed="${!on}">No straddle</button></div><small class="muted">Your choice stays for later hands under the gun.</small></div>`;
  }
  /** Patch 88: a word from a computer player who just straddled, before anyone acts. */
  function straddleLine(): TalkLine | null {
    const a = controller.data?.active, g = a?.game;
    if (!tableTalk || !g || g.straddleSeat === undefined || g.straddleSeat === 0 || g.events.some(e => e.type === 'action')) return null;
    const seat = g.seats.find(x => x.id === g.straddleSeat);if (!seat) return null;
    const pool = ['Straddle!', 'Let’s play bigger.', 'Straddle’s on. Make it worth it.', 'Live four, baby.', 'Straddling. Somebody wake me up.', 'Gotta straddle, it’s tradition.'];
    return { seatId: seat.id, text: pool[g.handId.length % pool.length] };
  }
  /** Patch 67: someone who just sat down says hello, before the first bet of their first hand. */
  function arrivalLine(): TalkLine | null {
    const a = controller.data?.active, n = a?.churnNews;
    if (!tableTalk || !a || !n || n.handId !== a.game.handId || a.game.events.some(e => e.type === 'action' && e.action?.type === 'raise')) return null;
    const names = n.lines.flatMap(line => [...line.matchAll(/([^.]+?) sits down\./g)].map(m => m[1].trim()));
    const seat = a.game.seats.find(x => names.includes(x.name) && x.id !== 0);if (!seat) return null;
    const regular = isRegularName(seat.name);
    const pool = regular ? ['Same table, same faces.', 'Did I miss anything?', 'Alright, who’s running hot tonight?', 'Back again. Deal me in.'] : ['Evening, everyone.', 'Mind if I join you?', 'What are we playing, one-two?', 'Deal me in.', 'Good luck, everybody.'];
    return { seatId: seat.id, text: pool[a.game.handId.length % pool.length] };
  }
  /** Patch 94/95: something you say at the table, and who answers, in cash, tournaments and Omaha. Display only. */
  type SayMode = 'cash' | 'tournament' | 'omaha';
  let heroSay: (HeroSaid & { mode: SayMode }) | null = null;
  function sayToTable(phrase: HeroPhrase, mode: SayMode) {
    if (!HERO_PHRASES.includes(phrase) || (heroSay && Date.now() - heroSay.at < 1500)) return;
    let seats: { id: number; name: string; regular?: string }[] = [], actor: number | null = null, winner: number | undefined, key = '';
    if (mode === 'cash') {
      const a = controller.data?.active; if (!a) return;
      const g = a.game, names = namesAt(g, id => a.profiles[id]);
      seats = g.seats.filter(s => s.id !== 0 && names(s.id)).map(s => ({ id: s.id, ...names(s.id)! }));
      actor = g.actor; winner = Object.entries(g.payouts ?? {}).filter(([id, v]) => v > 0 && id !== '0').map(([id]) => Number(id))[0]; key = `${g.handId}:${g.revision}`;
    } else if (mode === 'tournament') {
      const e = tournament?.data?.active; if (!e) return;
      const g = e.game, names = namesAt(g, id => tournamentProfileAt(e, id));
      seats = g.seats.filter(s => s.id !== 0 && s.stack + s.totalCommitted > 0 && names(s.id)).map(s => ({ id: s.id, ...names(s.id)! }));
      actor = g.actor; winner = Object.entries(g.payouts ?? {}).filter(([id, v]) => v > 0 && id !== '0').map(([id]) => Number(id))[0]; key = `${g.handId}:${g.revision}`;
    } else {
      const h = plo?.state.active ? plo.hand : null; if (!h) return;
      seats = h.seats.filter(s => s.id !== 0).map(s => ({ id: s.id, name: s.name }));
      actor = h.street === 'complete' ? null : h.actor; key = `${h.handId}:${h.events.length}`;
      winner = Object.entries(h.payouts ?? {}).filter(([id, v]) => v > 0 && id !== '0').map(([id]) => Number(id))[0];
    }
    const prefer = phrase === 'Time?' ? actor ?? undefined : phrase === 'Good luck' || phrase === 'One more orbit' ? undefined : winner;
    const at = Date.now(), seed = `${key}:${phrase}:${at}`, first = answerHero(phrase, seats, seed, prefer ?? undefined);
    const chime = first ? chimeIn(phrase, seats, first.seatId, seed) : null;
    heroSay = { mode, at, phrase, replies: [first, chime].filter((x): x is TalkLine => !!x) };
    render();
    setTimeout(() => { if (heroSay?.at === at) { heroSay = null; render(); } }, HERO_SAY_MS);
  }
  const saying = (mode: SayMode = 'cash') => tableTalk && heroSay?.mode === mode && Date.now() - heroSay.at < HERO_SAY_MS ? heroSay : null;
  const heroSayMarkup = (id: number) => heroSaidMarkup(saying('cash'), id);
  /** Patch 98: someone speaks up while you take a long time, and says goodbye or hello when the table changes. */
  const waitTurn: Record<string, { key: string; at: number }> = {};
  function heroWaitLine(mode: 'cash' | 'tournament'): TalkLine | null {
    if (!tableTalk) return null;
    const a = mode === 'cash' ? controller.data?.active : null, e = mode === 'tournament' ? tournament?.data?.active : null;
    const g = a?.game ?? e?.game; if (!g || g.actor !== 0 || g.street === 'complete' || (a && a.paused) || (e && e.paused)) { delete waitTurn[mode]; return null; }
    const key = `${g.handId}:${g.revision}`;
    if (waitTurn[mode]?.key !== key) { waitTurn[mode] = { key, at: Date.now() }; for (const ms of [9200, 22200]) setTimeout(() => { if (waitTurn[mode]?.key === key) render(); }, ms); return null; }
    const names = a ? namesAt(g, id => a.profiles[id]) : namesAt(g, id => tournamentProfileAt(e!, id));
    return heroTankLine(g, names, (Date.now() - waitTurn[mode]!.at) / 1000);
  }
  function farewellQuip(): TalkLine | null {
    const a = controller.data?.active, n = a?.churnNews;
    if (!tableTalk || !a || !n || n.handId !== a.game.handId || a.game.events.some(e => e.type === 'action' && e.action?.type === 'raise')) return null;
    return farewellLine(a.game, n.lines, namesAt(a.game, id => a.profiles[id]));
  }
  /** Patch 98: what you have answered this session, so players can bring it up later. */
  const heroAnswers: Record<string, { session: string; list: { question: string; answer: number }[] }> = {};
  const answersFor = (mode: string, session: string) => heroAnswers[mode]?.session === session ? heroAnswers[mode].list : [];
  /** Patch 97: a question a player asked you at the end of this hand, until you answer it. */
  const answered = new Set<string>();
  function pendingQuestion(mode: SayMode): { question: HeroQuestion; asker: { id: number; name: string; regular?: string }; key: string } | null {
    if (!tableTalk) return null;
    let lines: TalkLine[] = [], key = '', nameOf: (id: number) => { name: string; regular?: string } | undefined = () => undefined;
    if (mode === 'cash') { const a = controller.data?.active; if (!a?.humanLayer || a.game.street !== 'complete') return null; lines = cashChatter().lines; key = `cash:${a.game.handId}`; nameOf = namesAt(a.game, id => a.profiles[id]); }
    else if (mode === 'tournament') { const e = tournament?.data?.active; if (!e || e.game.street !== 'complete' || !policyUsesMood(e.tournamentPolicyVersion)) return null; lines = tournamentChatter().lines; key = `t:${e.game.handId}`; nameOf = namesAt(e.game, id => tournamentProfileAt(e, id)); }
    else { const a = plo?.state.active, h = a ? plo!.hand : null; if (!a || !h || h.street !== 'complete') return null; lines = (a.talk ?? []).filter(x => x.hand === a.number); key = `plo:${h.handId}`; nameOf = id => { const s = h.seats.find(x => x.id === id); return s && id !== 0 ? { name: s.name } : undefined; }; }
    if (answered.has(key)) return null;
    for (const l of lines) { const q = questionOf(l.text), who = nameOf(l.seatId); if (q && who) return { question: q, asker: { id: l.seatId, ...who }, key }; }
    return null;
  }
  function answerMarkup(mode: SayMode): string {
    const p = pendingQuestion(mode); if (!p) return '';
    return answerRow(p.question.answers.map(a => a.label), mode, p.asker.name.split(' ')[0]);
  }
  function answerQuestion(mode: SayMode, index: number) {
    const p = pendingQuestion(mode); if (!p) return;
    const label = p.question.answers[index]?.label; if (!label) return;
    answered.add(p.key);
    if (p.question.id !== 'show') { const session = mode === 'cash' ? controller.data?.active?.sessionId ?? '' : mode === 'tournament' ? tournament?.data?.active?.id ?? '' : 'omaha'; const list = answersFor(mode, session).filter(x => x.question !== p.question.id); heroAnswers[mode] = { session, list: [...list, { question: p.question.id, answer: index }].slice(-8) }; }
    const at = Date.now(), reply = reactTo(p.question, index, p.asker, `${p.key}:${index}`);
    heroSay = { mode, at, phrase: label, replies: reply ? [reply] : [] };
    render();
    setTimeout(() => { if (heroSay?.at === at) { heroSay = null; render(); } }, HERO_SAY_MS);
  }
  function quickChatMarkup(): string {
    if (!tableTalk || !controller.data?.active?.humanLayer) return '';
    return answerMarkup('cash') + quickChatRow(HERO_PHRASES, 'data-say');
  }
  /** Patch 96: what a player who folded is doing while the hand plays out. Display only. */
  function idleMarkup(shown: HeroViewModel | null, id: number): string {
    const a = controller.data?.active, seat = shown?.seats.find(s => s.id === id);
    if (!tableTalk || !a?.humanLayer || !shown || !seat || id === 0 || !seat.folded || shown.street === 'complete') return '';
    const what = idleActivity(seat.name, regularOfProfile(a.profiles[id]), `${shown.handId}:${id}`);
    return what ? `<span class="idle-act" data-testid="idle-act">${escape(what)}</span>` : '';
  }
  function thinkingCue(id: number): string {
    const a = controller.data?.active, called = timeCall && a && timeCall.token === `${a.game.handId}:${a.game.revision}` && Date.now() >= timeCall.at;
    if (called) return `<span class="tell-cue">Time has been called…</span>`;
    const cue = thinkingTells(id)?.cue ?? countingChips(id);
    return cue ? `<span class="tell-cue">${escape(cue[0].toUpperCase() + cue.slice(1))}…</span>` : 'Thinking…';
  }
  function thinkingLine(): TalkLine | null {
    const a = controller.data?.active;
    if (tableTalk && timeCall && a && timeCall.token === `${a.game.handId}:${a.game.revision}` && Date.now() >= timeCall.at) return { seatId: timeCall.by, text: ['Time?', 'Clock, please.', 'Any day now.', 'Dealer, can we get a clock?'][a.game.revision % 4] };
    if (!tableTalk || !a?.pending?.decision || a.game.actor === null || a.game.actor === 0) return null;
    const seatId = a.game.actor, hash = a.pending.decision.observationHash, m = /:tempo:(tempo-fold|tempo-call):/.exec(hash);
    if (m) {
      const bet = a.game.events.filter(e => e.type === 'action' && e.street === a.game.street && e.action?.type === 'raise').at(-1), t = bet ? tempoOf(bet) : null;
      if (t) { const pool = TEMPO_LINES[m[1] as 'tempo-fold' | 'tempo-call'][t]; return { seatId, text: pool[a.game.revision % pool.length] }; }
    }
    const mem = /:memory:(remember-call|remember-fold):/.exec(hash);
    if (mem) { const pool = MEMORY_LINES[mem[1] as 'remember-call' | 'remember-fold']; return { seatId, text: pool[a.game.revision % pool.length] }; }
    const tells = thinkingTells(seatId);
    if (tells?.speech && a.pending.decision.action.type === 'call') return { seatId, text: tells.speech };
    // Patch 94: a mutter on a long think. Neutral: it says nothing about the hand.
    if (thinkFor?.token === `${a.game.handId}:${a.game.revision}:${seatId}` && thinkFor.ms >= 3200 && (a.game.revision + a.game.handId.length) % 3 !== 0) {
      const seat = a.game.seats.find(s => s.id === seatId), profile = a.profiles[seatId];
      if (seat && profile) return { seatId, text: mutterFor(seat.name, regularOfProfile(profile), `${a.game.handId}:${a.game.revision}:mutter`) };
    }
    return null;
  }
  function facePicker(): string {
    const name = seatName(0, game), current = { ...faceFor(name), ...(style.heroFace ?? {}) };
    const labels: Record<FacePart, [string, string[]]> = {
      skin: ['Skin tone', ['Tone 1', 'Tone 2', 'Tone 3', 'Tone 4', 'Tone 5', 'Tone 6']],
      hair: ['Hair', ['Short', 'Long', 'Swept', 'Curly', 'Side part', 'Bob', 'Bald', 'Bun']],
      hairColor: ['Hair colour', ['Black-brown', 'Brown', 'Auburn', 'Blond', 'Grey', 'Black', 'Red', 'White']],
      hat: ['Hat', ['None', 'Beanie', 'Wide brim', 'Cap']],
      outfit: ['Outfit', ['Crew neck', 'Hoodie', 'Jacket and tie', 'Open collar']],
      shirt: ['Colour', ['Seat colour', 'Navy', 'Wine', 'Forest', 'Slate', 'Gold']],
      extra: ['Extra', ['None', 'Glasses', 'Sunglasses', 'Beard', 'Moustache', 'Rosy cheeks']],
      brows: ['Brows', ['Soft', 'Straight', 'Angled']],
    };
    const select = (part: FacePart) => { const [label, names] = labels[part]; return `<label class="style-select face-part" for="face-${part}">${label}<select id="face-${part}" data-face-part="${part}">${Array.from({ length: FACE_PARTS[part] }, (_, i) => `<option value="${i}" ${current[part] === i ? 'selected' : ''}>${names[i] ?? i + 1}</option>`).join('')}</select></label>`; };
    return `<fieldset class="face-picker" style="--avatar:#e8c58b"><legend>Your face</legend><span class="face-preview" aria-hidden="true">${avatarSvg(name, 'content', style.heroFace)}</span><div class="face-parts">${(Object.keys(FACE_PARTS) as FacePart[]).map(select).join('')}</div>${style.heroFace ? '<button type="button" id="face-reset" class="button secondary">Use my default face</button>' : ''}</fieldset>`;
  }
  function stylePanel(): string {
    const box = (id: string, on: boolean, text: string) => `<label class="auto-deal-toggle" for="${id}"><input type="checkbox" id="${id}" ${on ? 'checked' : ''}>${text}</label>`;
    /* Phase 10 (fun #30): a cosmetic unlockable, earned from recorded play and
     * nothing else — Crown royal card backs for beating the whole heads-up ladder.
     * The unlock is monotonic: ladder wins are never un-earned, so a chosen back
     * never re-locks. (A matching unlockable felt was dropped: the felt catalogue
     * is pinned exactly by a Patch-60 test, and tests are never weakened to fit.) */
    const ladderBeaten = readLadder().beaten.length;
    const backUnlocked = ladderBeaten >= LADDER_IDS.length;
    const backOption = ([id, label]: readonly [string, string]) => id === 'crown' && !backUnlocked
      ? `<option value="crown" disabled>Crown royal · locked — beat the whole ladder (${ladderBeaten}/${LADDER_IDS.length})</option>`
      : `<option value="${id}" ${style.back === id ? 'selected' : ''}>${label}</option>`;
    const unlockNote = `<p class="muted" data-testid="unlockables">Unlockable (cosmetic only): Crown royal card backs ${backUnlocked ? '— unlocked. Find them under Card backs.' : `— beat the whole heads-up ladder to unlock (${ladderBeaten}/${LADDER_IDS.length} rungs beaten)`}.</p>`;
    return `<details class="table-style" id="table-style" ${stylePanelOpen ? 'open' : ''}><summary>Table look &amp; sound</summary><div class="table-style-grid"><label class="style-select" for="style-felt">Felt<select id="style-felt">${FELTS.map(([id, label]) => `<option value="${id}" ${style.felt === id ? 'selected' : ''}>${label}</option>`).join('')}</select></label><label class="style-select" for="style-back">Card backs<select id="style-back">${BACKS.map(backOption).join('')}</select></label>${box('style-four', style.fourColor, 'Four-color deck')}${box('style-chips', style.chips, 'Chip stacks')}${view==='tournaments'?'':box('table-motion', motion, 'Animations')}${box('style-sound', style.sound, 'Sounds')}${box('style-dealer-voice', style.dealerVoice, 'Dealer voice')}${tokeSelect(style.tokes)}${style.sound ? `${box('style-ambience', style.ambience, 'Card room ambience')}${box('style-clicks', style.clicks, 'Button clicks')}` : ''}${style.sound ? `<label class="style-select style-volume" for="style-volume">Volume <input type="range" id="style-volume" min="0" max="100" step="5" value="${style.volume}" aria-valuetext="${style.volume}%"></label>` : ''}${box('style-hand-label', style.handLabel, 'Show my hand')}${box('style-keys', style.keys, 'Keyboard shortcuts')}${canVibrate() ? box('style-vibrate', style.vibrate, 'Vibrate on my turn') : ''}${box('style-avatars', style.avatars, 'Avatars')}${style.avatars ? `<label class="style-select" for="style-portraits">Avatar style<select id="style-portraits"><option value="portraits" ${style.portraits ? 'selected' : ''}>Portraits</option><option value="drawn" ${style.portraits ? '' : 'selected'}>Drawn</option></select></label>${style.portraits ? portraitPicker() : facePicker()}` : ''}${box('style-trends', style.trends, 'Stack trend arrows')}<label class="style-select" for="style-text">Text size<select id="style-text">${TEXT_SIZES.map(([id, label]) => `<option value="${id}" ${style.textSize === id ? 'selected' : ''}>${label}</option>`).join('')}</select></label><label class="style-select" for="style-break">Break reminder<select id="style-break">${BREAK_CHOICES.map(minutes => `<option value="${minutes}" ${style.breakEvery === minutes ? 'selected' : ''}>${minutes ? `Every ${minutes} min` : 'Off'}</option>`).join('')}</select></label><label class="style-select" for="style-theme">App theme<select id="style-theme">${THEMES.map(([id, label]) => `<option value="${id}" ${style.theme === id ? 'selected' : ''}>${label}</option>`).join('')}</select></label></div><p class="muted">Display only. “Show my hand” names your best hand from your own two cards and the board; it never uses anyone else’s cards.${style.keys ? ' Shortcuts: F fold · C or K check/call · R bet or raise · N next hand.' : ''}</p>${unlockNote}</details>`;
  }
  /* Phase 10 (fun #1): the rivalry estimate for one opponent this session — the same
   * disclosed proportional split the recap uses (rivalsOf), cached per session state.
   * It is always labelled an estimate; the exact heads-up-pots figure lives on the
   * player card. Never an unqualified per-opponent net. */
  let rivalryCache: { key: string; map: Map<string, number> } = { key: '', map: new Map() };
  function rivalryNet(name: string): number | null {
    const data = controller.data, active = data?.active;
    if (!data || !active) return null;
    const key = `${active.sessionId}:${data.hands.length}`;
    if (rivalryCache.key !== key) rivalryCache = { key, map: new Map(rivalsOf(data.hands.filter(h => h.sessionId === active.sessionId)).map(r => [r.name, r.net])) };
    return rivalryCache.map.get(name) ?? null;
  }
  function seatMarkup(shown: HeroViewModel | null, id: number, index: number, total: number): string {
    const seat = shown?.seats.find(s => s.id === id);
    const compactPoint = perimeterLayout(total, true).points[index];
    const widePoint = perimeterLayout(total, false).points[index];
    const shortPoint = shortPerimeterLayout(total).points[index];
    const active = !!shown && shown.actor === id && shown.street !== 'complete';
    const folded = !!seat?.folded;
    const last = shown?.events.filter(e => e.type === 'action' && e.seatId === id).at(-1);
    const amountPart = (amount: number, joiner = ' ') => `<span class="action-amount">${joiner}${money(amount)}</span>`;
    const talk = cashChatter();
    let action = !shown ? 'Ready<span class="action-amount"> to play</span>' : folded ? 'Folded' : seat?.allIn ? 'All-in' : active ? id === 0 ? 'Your turn' : thinkingCue(id) : last?.action ? last.action.type === 'raise' ? `Raise${amountPart(last.action.to, ' to ')}` : title(last.action.type) : 'Waiting';
    const award = shown?.street === 'complete' ? shown.payouts[id] ?? 0 : 0;
    if (shown?.street === 'complete') action = award > 0 ? `<span class="award-word">Awarded</span>${amountPart(award)}` : folded ? 'Folded' : '<span class="settled-word">Hand complete</span>';
    // Layer 1.15.0: a player on a break.
    if (id !== 0 && shown?.street !== 'complete' && seatOnBreak(id)) action = 'On break';
    return `<article class="seat ${id === 0 ? 'hero-seat' : ''} ${active ? 'acting' : ''} ${folded ? 'folded' : ''} ${award > 0 ? 'winner' : ''}" style="--deal-i:${dealOrder.get(id) ?? 0};--compact-x:${compactPoint.x};--compact-y:${compactPoint.y};--wide-x:${widePoint.x};--wide-y:${widePoint.y};--short-x:${shortPoint.x};--short-y:${shortPoint.y};--avatar:${COLORS[id]}" aria-label="${escape(seatName(id,shown))}, ${money(seat?.stack ?? settings.buyIn)}${active ? ', current player' : ''}" data-seat="${id}">${active && id !== 0 && game && thinkFor?.token === `${game.handId}:${game.revision}:${game.actor}` ? `<i class="think-bar" style="--think-ms:${thinkFor.ms}ms" aria-hidden="true"></i>` : ''}${style.avatars ? `<span class="face-badge${cueClass(id)}" aria-hidden="true">${faceArt(seatName(id,shown), faceMood(shown, id), id === 0, 'seat', shown, id)}</span>` : ''}${id !== 0 && shown ? `<button type="button" class="seat-profile-hit" data-profile="${id}" aria-label="${escape(seatName(id,shown))}: player card"></button>` : ''}${tableTalk ? emoteMarkup(seatEmote(shown, id, 0)) : ''}${quipMarkup(quip, id, `${shown?.events.length ?? 0}`).replace('class="seat-quip"', `class="seat-quip quip-${(shown?.events.length ?? 0) % 2}"`)}${heroSayMarkup(id)}
      <div class="seat-cards"><div class="hole-cards ${dealClass(handNumber)}${shownHand(talk, id) ? ' shown-hand' : ''}${revealOrder.has(id) ? ' revealed' : ''}"${revealOrder.has(id) ? ` style="--reveal-i:${revealOrder.get(id)}"` : ''}>${(shownHand(talk, id)?.cards ?? (seat?.hole.length ? seat.hole : null))?.map(c => card(c, winSet.has(c) ? 'small-card win-card' : 'small-card')).join('') ?? card(undefined, 'small-card') + card(undefined, 'small-card')}</div><div class="seat-markers">${shown?.button === id ? '<span class="dealer-button" title="Dealer button" aria-label="Dealer button">D</span>' : ''}${shown && (shown.smallBlindSeat === id || shown.bigBlindSeat === id) ? `<span class="blind-tag" aria-label="${shown.smallBlindSeat === id ? 'Small blind' : 'Big blind'}">${shown.smallBlindSeat === id ? 'SB' : 'BB'}</span>` : ''}${shown?.straddleSeat === id ? '<span class="blind-tag straddle-tag" aria-label="Straddle">STR</span>' : ''}</div></div>
      <div class="seat-label ${money(seat?.stack ?? settings.buyIn).length > 9 ? 'long-stack' : ''}"><span class="avatar">${escape(seatName(id,shown)[0])}</span><div><b>${escape(seatName(id,shown))}${id === 0 ? '<span class="hero-tag">YOU</span>' : ''}</b><strong>${money(seat?.stack ?? settings.buyIn)}${trendArrow(seat, shown)}</strong>${id !== 0 && shown ? (() => { const net = rivalryNet(seatName(id, shown)); return net ? `<span class="rivalry-plate" title="Your result against ${escape(seatName(id, shown))} this session — an estimate: each pot is split between the players it was won from or lost to, the same split the session recap shows. Tap the seat for the exact heads-up-pots figure.">You ≈ ${net > 0 ? '+' : '−'}${money(Math.abs(net))} · est.</span>` : ''; })() : ''}</div></div>
      <div class="seat-status"><span class="seat-action ${active ? 'active-label' : ''}">${shownHand(talk, id) ? 'Showed' : action}</span>${talkMarkup(talk, id)}${id !== 0 ? sideTellMarkup(cashSideTells().get(id), escape) : ''}${idleMarkup(shown, id)}${shown?.handLabels[id] ? `<span class="seat-hand-label" title="${escape(shown.handLabels[id])}">${escape(shown.handLabels[id])}</span>` : ''}</div>
      <span class="seat-bet ${seat && seat.streetCommitted > 0 && shown?.street !== 'complete' ? '' : award > 0 ? 'empty-bet award-bet' : 'empty-bet'}" ${seat && seat.streetCommitted > 0 && shown?.street !== 'complete' ? `aria-label="Current street contribution ${money(seat.streetCommitted)}"` : 'aria-hidden="true"'}>${seat && shown && seat.streetCommitted > 0 && shown.street !== 'complete' ? chipStackMarkup(seat.streetCommitted, shown.profile.bigBlind) : shown && award > 0 ? chipStackMarkup(award, shown.profile.bigBlind) : '<i></i>'}${seat && seat.streetCommitted > 0 && shown?.street !== 'complete' ? money(seat.streetCommitted) : award > 0 ? `+${money(award)}` : ' '}</span>
    </article>`;
  }
  function emptySeat(id:number,total:number):string {
    const compact=perimeterLayout(total,true).points[id],wide=perimeterLayout(total,false).points[id],short=shortPerimeterLayout(total).points[id];
    return `<article class="seat empty-seat" data-empty-seat="${id}" aria-label="Seat ${id+1}, empty" style="--compact-x:${compact.x};--compact-y:${compact.y};--wide-x:${wide.x};--wide-y:${wide.y};--short-x:${short.x};--short-y:${short.y}"><span class="empty-seat-icon">○</span><b>Seat ${id+1}</b><small>Empty</small></article>`;
  }
  function table(shown: HeroViewModel | null): string {
    winSet = winningCards(shown);
    { const a = controller.data?.active; quip = a?.humanLayer ? heroWaitLine('cash') ?? thinkingLine() ?? straddleLine() ?? farewellQuip() ?? arrivalLine() ?? memoryGreeting() ?? quipFor(a.game, id => a.profiles[id], tableTalk) : null; const said = saying(); if (said && quip && (quip.seatId === 0 || said.replies.some(r => r.seatId === quip!.seatId))) quip = null; if (!quip && a?.humanLayer && tableTalk) { const n = namesAt(a.game, id => a.profiles[id]); quip = sweatLine(a.game, n) ?? reraiseLine(a.game, n) ?? spectatorLine(a.game, n); } }
    dealOrder = new Map();
    revealOrder = new Map();
    // Patch 61: river sweat. When an all-in is called and the river arrives in this render, deal it slowly.
    if (shown) {
      const before = lastBoard?.handId === shown.handId ? lastBoard.len : null;
      // Patch 67: also a big pot Hero is still in (25 big blinds or more): the river is squeezed out slowly.
      const bigPot = shown.seats.some(seat => seat.id === 0 && !seat.folded) && shown.pot >= 25 * shown.profile.bigBlind;
      if (before !== null && before < 5 && shown.board.length === 5 && (allInSpotlight(shown) || bigPot)) sweat = { handId: shown.handId, turn: before < 4 && !!allInSpotlight(shown) };
      else if (sweat && sweat.handId !== shown.handId) sweat = null;
      lastBoard = { handId: shown.handId, len: shown.board.length };
    }
    // Patch 67: the dealer voice, when on, says what changed since the last screen.
    if (shown && style.dealerVoice && view === 'live') { const lines = dealerLines(dealerSeen, shown); if (dealerSeen && lines.length) speakDealer(lines); }
    dealerSeen = shown ?? null;
    if (shown?.street === 'complete') {
      // Patch 60: shown-down hands turn over one at a time, in deal order, with the winners last.
      const shownIds = Object.keys(shown.handLabels).map(Number).filter(id => id !== 0 && (shown.seats.find(seat => seat.id === id)?.hole.length ?? 0) === 2);
      const order = (id: number) => { const dealt = shown.seats.filter(seat => seat.startingStack > 0).map(seat => seat.id).sort((a, b) => a - b); const start = dealt.findIndex(seatId => seatId > shown.button); const ordered = start < 0 ? dealt : [...dealt.slice(start), ...dealt.slice(0, start)]; return ordered.indexOf(id); };
      shownIds.sort((a, b) => Number((shown.payouts[a] ?? 0) > 0) - Number((shown.payouts[b] ?? 0) > 0) || order(a) - order(b)).forEach((id, i) => revealOrder.set(id, i));
    }
    if (shown && tableTalk) {
      const logLine = (seatId: number, text: string, key: string) => { if (talkLog.some(entry => entry.key === key)) return; talkLog.push({ key, hand: handNumber, name: seatName(seatId, shown), text }); if (talkLog.length > 20) talkLog.shift(); };
      cashChatter().lines.forEach(line => logLine(line.seatId, line.text, `${shown.handId}:end:${line.seatId}`));
      if (quip) logLine(quip.seatId, quip.text, `${shown.handId}:${shown.events.length}:${quip.seatId}`);
    }
    if (shown) { const dealt = shown.seats.filter(seat => seat.startingStack > 0).map(seat => seat.id).sort((a, b) => a - b); const start = dealt.findIndex(id => id > shown.button); const ordered = start < 0 ? dealt : [...dealt.slice(start), ...dealt.slice(0, start)]; ordered.forEach((id, i) => dealOrder.set(id, i)); }
    const ids = shown ? shown.seats.map(s => s.id).sort((a, b) => a - b) : occupiedSeatIds(settings);
    const activeSettings=controller.data?.sessions.find(session=>session.id===controller.data?.active?.sessionId)?.settings;
    const capacity=shown ? activeSettings?.capacity ?? Math.max(ids.length,...ids.map(id=>id+1)) : settings.capacity ?? settings.seats;
    const slots=tableSeatSlots(capacity,ids);
    const totalAward = shown ? Object.values(shown.payouts).reduce((a, b) => a + b, 0) : 0;
    const compactLayout = perimeterLayout(capacity, true), wideLayout = perimeterLayout(capacity, false);
    const layoutStyle = [compactLayout, wideLayout].map((layout, index) => {
      const prefix = index === 0 ? 'compact' : 'wide';
      return Object.entries(layout).filter(([key]) => key !== 'points').map(([key, value]) => `--${prefix}-${key.replace(/[A-Z]/g, letter => '-'+letter.toLowerCase())}:${value}px`).join(';');
    }).join(';');
    return `<section class="table-panel"><div class="table-heading"><div><span class="live-dot"></span><b>${shown ? 'Practice table' : 'Your next hand starts here'}</b><span class="muted">${ids.length}-handed · ${capacity} positions · No-Limit Hold’em</span></div><span class="table-hand">${shown ? `HAND ${String(handNumber).padStart(3, '0')}` : 'CASH TABLE'}</span></div>
      <div class="table-scene perimeter-table seats-${capacity}${allInSpotlight(shown) ? ' allin-spotlight' : ''}${shown && (shown.street === 'complete' ? totalAwardFor(shown) : shown.pot) >= 40 * shown.profile.bigBlind ? ' pot-big' : ''}" data-testid="poker-table" style="${layoutStyle};--short-height:${shortPerimeterLayout(capacity).height}px;--reveal-n:${revealOrder.size}${sweat && shown && sweat.handId === shown.handId ? ';--sweat:1.7s' : ''}"><div class="table-rail"><div class="felt"><div class="felt-line"></div><div class="table-watermark">GOLD<br><strong>CROWN</strong></div></div></div>
      <div class="board-area"><div class="street-row"><span class="street-label" data-testid="street">${shown ? shown.street === 'complete' ? 'HAND COMPLETE' : shown.street.toUpperCase() : 'NO-LIMIT TEXAS HOLD’EM'}</span>${shown ? `<span class="hand-tag">Hand ${handNumber}</span>` : ''}</div><div class="board-cards${winSet.size ? ' has-winner' : ''}${sweat && shown && sweat.handId === shown.handId ? ` sweat${sweat.turn ? ' sweat-turn' : ''}` : ''}">${Array.from({ length: 5 }, (_, i) => shown?.board[i] ? card(shown.board[i], winSet.has(shown.board[i]) ? 'win-card' : '') : '<span class="board-slot" aria-label="Community card not dealt">♠</span>').join('')}</div>${allInSpotlight(shown) ? '<span class="allin-badge" role="status">ALL IN</span>' : ''}<div class="pot-display${shown?.street === 'complete' && totalAward > 0 ? ' awarded' : ''}">${shown ? potPileMarkup(shown.street === 'complete' ? totalAward : shown.pot, shown.profile.bigBlind) : ''}<span>${shown?.street === 'complete' ? 'TOTAL AWARDED' : 'TOTAL POT'}</span><strong data-testid="pot">${money(shown?.street === 'complete' ? totalAward : shown?.pot ?? 0)}</strong></div>${!shown ? '<span class="table-intro">The felt is yours.</span>' : ''}</div>
      ${cashMoment(shown)}<div class="seat-layer has-dealer-glide pitch" style="--deal-n:${Math.max(1, dealOrder.size)};${shown ? dealerVars(shown.button, capacity) : ''}">${slots.map(slot => slot.occupied ? seatMarkup(shown,slot.id,slot.id,capacity) : emptySeat(slot.id,capacity)).join('')}${tableAnchors(shown, capacity)}</div></div>
      ${shown ? potBreakdown(shown) : ''}
      ${(()=>{const n=controller.data?.active?.churnNews;return n&&game&&n.handId===game.handId?`<p class="table-news" role="status"><b>Table news</b> ${n.lines.map(escape).join(' ')}</p>`:'';})()}
      ${(()=>{const a=controller.data?.active;if(!a||!shown||shown.street!=='complete')return '';const t=a.dealerTips?.lastHand===shown.handId?a.dealerTips.lastTip:0;return t?`<p class="toke-line" data-testid="toke-line">You toss the dealer ${dollars(t)}. “Thank you!”</p>`:'';})()}
      ${(()=>{const d=controller.data,m=d?.active?matchState(d):null;if(!m)return '';const a=d!.active!,ids=new Set(d!.sessions.find(x=>x.id===a.sessionId)?.handIds??[]);const noticed=(()=>{try{return [...(cashInsight(d!.hands.filter(h=>ids.has(h.id)),a,1)?.leaks[0]??[])];}catch{return [];}})();const hero0=a.game.seats.find(x=>x.id===0),netBB=hero0?((a.game.payouts?.[0]??0)-hero0.totalCommitted)/a.game.profile.bigBlind:0;const said=a.game.street==='complete'?matchLine(m,a.game.handId,noticed,a.game.profile.bigBlind)??(tableTalk&&!m.over?headsUpExtra(m.name,m.opponent,netBB,m.hero+m.villain?m.hero/(m.hero+m.villain):.5,`${a.game.handId}:hu`):null):m.hands===0?matchLine(m,a.game.handId,noticed,a.game.profile.bigBlind):null;return matchBanner(m)+noticedMarkup(m.name,noticed)+(said?`<p class="hu-say" data-testid="hu-say"><b>${escape(m.name)}:</b> “${escape(said)}”</p>`:'')+(m.over?`<div class="hu-over" data-testid="hu-over"><b>${m.won?'You win the match!':`${escape(m.name)} wins the match.`}</b> ${m.how==='bust'?'Someone is out of chips.':`${m.hands} hands played.`} <button type="button" class="button primary" id="hu-finish">Finish match</button></div>`:'');})()}
      ${controller.data?.active&&!controller.data.sessions.find(x=>x.id===controller.data!.active!.sessionId)?.settings.challenge?promoBoard(controller.data,controller.data.active.sessionId,controller.data.ledger.at(-1)?.id.startsWith('promo:')?controller.data.ledger.at(-1)!.note:''):''}
      <div class="table-toolbar">${sessionClock() ? `<span class="session-clock" data-testid="session-clock" title="Playing time this session"><span aria-hidden="true">⏱</span> <span id="session-clock-time">${durationText(sessionClock()!.ms)}</span></span>` : ''}<span><i class="status-dot"></i>${!game ? 'Ready when you are' : paused ? 'Table paused' : game.street === 'complete' ? 'Ready for the next hand' : game.actor === 0 ? 'Action is on you' : `${escape(seatName(game.actor ?? 0,shown))} is thinking`}</span><div><label class="auto-deal-toggle" for="auto-deal"><input type="checkbox" id="auto-deal" ${autoDeal ? 'checked' : ''}>Auto-deal</label><label class="auto-deal-toggle" for="table-talk"><input type="checkbox" id="table-talk" ${tableTalk ? 'checked' : ''}>Table talk</label>${game?.profile.straddle ? `<label class="auto-deal-toggle" for="hero-straddle"><input type="checkbox" id="hero-straddle" ${unavailable()?'disabled':''} ${controller.data?.active?.heroStraddle ? 'checked' : ''}>Straddle UTG</label>` : ''}<label for="pace">Pace</label><select id="pace" aria-label="Bot action pace"><option value="250" ${pace === 250 ? 'selected' : ''}>Fast</option><option value="900" ${pace === 900 ? 'selected' : ''}>Normal</option><option value="1800" ${pace === 1800 ? 'selected' : ''}>Relaxed</option></select><button id="pause" class="icon-button" ${!game || game.street === 'complete' || unavailable() ? 'disabled' : ''}><span class="shape-icon ${paused ? 'shape-play' : 'shape-pause'}" aria-hidden="true"></span>${paused ? 'Resume' : 'Pause'}</button></div></div>${quickChatMarkup()}${breakReminder()}${stylePanel()}${talkLogMarkup()}${profileCard(shown)}
    </section>`;
  }
  function potBreakdown(shown: HeroViewModel): string {
    const settled = shown.street === 'complete';
    // Contribution levels only become side pots when a player is all-in for less.
    const levelsOnly = !settled && shown.pots.length > 1 && !shown.seats.some(seat => seat.allIn);
    const matched = shown.pots.reduce((sum, pot) => sum + pot.amount, 0);
    const tiers = shown.pots.map((pot, i) => `<div class="pot-tier" data-testid="pot-tier"><span>${levelsOnly ? `Level ${i + 1}` : i === 0 ? 'Main pot' : `Side pot ${i}`}</span><b>${money(pot.amount)}</b><small>${settled ? `Awarded to ${pot.winners.map(id => escape(seatName(id,shown))).join(', ')}` : `Eligible: ${pot.eligible.map(id => escape(seatName(id,shown))).join(', ')}`}</small></div>`).join('');
    const body = !shown.pots.length ? '<div class="pot-tier"><span>Pot</span><b>$0</b><small>No matched chips yet</small></div>'
      : levelsOnly ? `<details id="pot-levels" class="pot-levels" ${potLevelsOpen ? 'open' : ''}><summary><span>Pot</span><b>${money(matched)}</b><small>Nobody is all-in, so there is no side pot. Show contribution levels</small></summary><div class="pot-tiers">${tiers}</div></details>`
      : tiers;
    return `<div class="pot-breakdown" data-testid="pot-breakdown"><div class="pot-breakdown-heading"><span>${settled ? 'POT AWARDS' : 'POT'}</span><small>${settled ? 'After rake; uncalled chips returned separately' : 'Matched chips; an uncalled bet is listed separately'}</small></div><div class="pot-tiers">${body}${shown.uncalledBet ? `<div class="pot-tier pending-bet" data-testid="uncalled-bet"><span>Uncalled bet</span><b>${money(shown.uncalledBet.amount)}</b><small>${escape(seatName(shown.uncalledBet.seatId,shown))} · returned if nobody calls</small></div>` : ''}</div><div class="rake-line"><span>${rakeDescription(shown.profile)}</span><b data-testid="hand-rake">${settled ? `Rake taken ${money(shown.rake)}` : 'Rake applied only at settlement'}</b></div></div>`;
  }
  function rakeDescription(rules: RuleProfile): string {
    return !rules.rake.basisPoints || !rules.rake.cap ? 'Practice cash · No rake' : `${rules.id.startsWith('pokerstars-')?'PokerStars USD regular NLHE · '+ruleVersionMarkup(rules.version):'Practice rake'} ${rules.rake.basisPoints / 100}% · Cap ${money(rules.rake.cap)}${rules.rake.noFlopNoDrop ? ' · No flop, no drop' : ' · Preflop rake enabled'}`;
  }
  function actions(shown: HeroViewModel | null): string {
    if (!shown && tablePick) return tablePickerMarkup();
    if (!shown) { const played = controller.data?.hands.length ?? 0; return `<section id="table-actions" tabindex="-1" aria-label="Poker actions" class="action-panel welcome-action home-start"><div class="home-intro"><span class="eyebrow">PLAY THE HAND. BUILD YOUR INSTINCTS.</span><h2>${played ? 'Welcome back. Your seat is open.' : 'A seat at your own table.'}</h2><p>Natural deals. Complete hands. Every decision is yours.</p></div>${played === 0 ? tourMarkup() : ''}<div class="home-cards"><button id="quick-start-live" class="home-card home-card-main"><span class="home-card-icon" aria-hidden="true">♠</span><b>Quick game</b><span>Play synthetic live $1/$2 · 9 seats · $300</span></button><button id="pick-table" class="home-card"><span class="home-card-icon" aria-hidden="true">♠</span><b>Pick a table</b><span>See who's playing, choose your seat</span></button><button id="open-setup" class="home-card"><span class="home-card-icon red-suit" aria-hidden="true">♦</span><b>Build your table</b><span>Stakes, seats and opponents</span></button><button type="button" data-view="tournaments" class="home-card"><span class="home-card-icon" aria-hidden="true">♣</span><b>Tournaments</b><span>Sit &amp; gos to big fields</span></button><button type="button" data-view="${played ? 'results' : 'blackjack'}" class="home-card"><span class="home-card-icon red-suit" aria-hidden="true">♥</span><b>${played ? 'Your stats' : 'Blackjack'}</b><span>${played ? 'Results, charts and leaks' : 'A quick change of game'}</span></button></div>${installPrompt ? '<button type="button" id="install-app" class="button secondary install-app">Install the app · plays offline</button>' : ''}<p class="muted home-fine-print">${LIVE_ONE_TWO_DISCLOSURE}</p></section>`; }
    if (shown.street === 'complete') {
      const net = controller.data?.hands.at(-1)?.net ?? 0;
      const winners = Object.entries(shown.payouts).filter(([, amount]) => amount > 0).map(([id]) => escape(seatName(Number(id),shown))).join(', ');
      const shownHands = Object.entries(shown.handLabels).map(([id, label]) => `${escape(seatName(Number(id),shown))}: ${label}`);
      const nextAllowed = !!controller.data?.active?.queuedConfiguration || (shown.seats.filter(s => s.stack > 0).length >= 2 && (shown.seats.find(s => s.id === 0)?.stack ?? 0) > 0);
      const counting = nextAllowed && autoDealCounting();
      return `<section id="table-actions" tabindex="-1" aria-label="Poker actions" class="action-panel complete-action"><div><span class="eyebrow">HAND ${handNumber} SETTLED</span><h2>${escape(winners ? `${winners} ${winners === 'You' || winners.includes(',') ? 'collect' : 'collects'} the pot` : 'Hand complete')}</h2><p>Your result <b class="${net > 0 ? 'positive' : net < 0 ? 'negative' : ''}">${signed(net)}</b> · Rake ${money(shown.rake)} · ${Object.keys(shown.handLabels).length ? 'Showdown settled' : 'Won without showdown'}. ${shown.handLabels[0] ? `<span class="settled-hand-label">Your hand: ${escape(shown.handLabels[0])}.</span>` : ''}</p>${coachReviewMarkup(coachUi)}${shownHands.length ? `<p class="showdown-hands" data-testid="showdown-hands" tabindex="0" role="region" aria-label="Shown hands; scroll for more">${escape(shownHands.join(' · '))}</p>` : ''}${straddlePrompt()}</div>${counting ? '<div class="deal-row"><button type="button" id="auto-deal-hold" class="button secondary" aria-label="Hold: do not deal the next hand automatically">Hold</button>' : ''}<button ${nextAllowed ? 'id="next-hand"' : 'data-action="open-cashier"'} class="button primary" ${unavailable() ? 'disabled' : ''}>${counting ? `<span class="deal-count">Next hand in <span id="auto-deal-count">${autoDealSeconds()}</span>s</span>` : nextAllowed ? controller.data?.active?.queuedConfiguration?'Apply settings & deal next hand':'Deal next hand' : 'Add chips or cash out'} <span>→</span></button>${counting ? '</div>' : ''}${!counting && !controller.data?.active?.exitMode ? `<button type="button" id="change-table" class="button secondary change-table" ${unavailable() ? 'disabled' : ''}>Change tables</button>` : ''}</section>`;
    }
    const hero = shown.seats.find(s => s.id === 0)!;
    const legal = shown.legal;
    const turn = shown.actor === 0 && !paused && !unavailable() && controller.data?.active?.exitMode !== 'fold';
    const allInCall = turn && legal.callAmount > 0 && legal.callAmount === hero.stack;
    const canRaise = turn && (legal.canRaise || legal.shortAllInTo !== null);
    const min = legal.shortAllInTo ?? legal.minRaiseTo ?? 0;
    const max = legal.maxRaiseTo ?? legal.shortAllInTo ?? 0;
    // While opponents act and Hero is still in the hand, Check/Fold can be chosen ahead of time.
    const canPreAct = shown.actor !== null && shown.actor !== 0 && !paused && !hero.folded && hero.stack > 0 && !controller.data?.active?.exitMode && controller.status === 'ready';
    const preArmed = canPreAct && preCheckFold === `${shown.handId}:${shown.street}`;
    const token = `${shown.handId}:${shown.revision}`;
    if (raiseToken !== token) { raiseToken = token; raiseValue = min; sliderPercent = null; if (compactViewport()) sizingMoreOpen = null; }
    if (panelPeekToken !== token) { panelPeekToken = token; panelPeekChoice = null; }
    const panelPeek = panelPeekChoice ?? !turn;
    const sizingNow: SizingContext = {pot:shown.pot,streetCommitted:hero.streetCommitted,bigBlind:shown.profile.bigBlind,chipUnit:shown.profile.chipUnit,legal};
    const sizing = inspectSizing(sizingNow,raiseValue);
    // The slider and its label follow the amount in the raise box instead of resting at an unrelated 100%.
    const potPercent = canRaise ? sliderPercent ?? potPercentOf(sizingNow,raiseValue) : null;
    // Preflop quick sizes: big blinds to open an unraised pot, multiples of the bet when re-raising.
    const facing = Math.max(0, ...shown.seats.map(seat => seat.streetCommitted));
    // Each shows the dollar total it prepares. The pot-percentage presets stay beside them.
    const streetSizes: string[][] = shown.street !== 'preflop' ? [] : facing <= shown.profile.bigBlind
      ? PREFLOP_OPEN_BIG_BLINDS.map(bb => [`bb-${bb}`, `${bb} BB <small>${money(openSizing(sizingNow, bb).to)}</small>`, 'street'])
      : PREFLOP_RAISE_MULTIPLES.map(multiple => [`x-${multiple}`, `${multiple}× <small>${money(raiseMultipleSizing({...sizingNow, streetCommitted: facing, legal: {...legal, callAmount: 0}}, multiple).to)}</small>`, 'street']);
    return `<section id="table-actions" tabindex="-1" aria-label="Poker actions" class="action-panel ${turn ? 'your-action' : 'waiting'}${panelPeek ? ' panel-peek' : ''}" data-testid="action-panel" data-decision-token="${escape(token)}"><button type="button" id="panel-peek-toggle" class="panel-peek-toggle" aria-expanded="${!panelPeek}" aria-label="${panelPeek ? 'Expand the table controls' : 'Collapse the table controls to a peek strip'}">${panelPeek ? '▴ Controls' : '▾ Peek'}</button><div class="action-top"><div><span class="eyebrow">${paused ? 'PAUSED' : turn ? 'YOUR DECISION' : 'WAITING FOR ACTION'}</span><h2>${paused ? 'Take your time.' : turn ? legal.check ? 'You can check.' : `${money(legal.callAmount)} to call` : `${style.avatars && shown.actor !== null ? `<span class="bar-face bar-face-actor" aria-hidden="true">${faceArt(seatName(shown.actor, shown), faceMood(shown, shown.actor), shown.actor === 0, 'seat', shown, shown.actor)}</span>` : ''}${escape(seatName(shown.actor ?? 0,shown))} is up next`}</h2>${style.handLabel && hero.hole.length === 2 && !hero.folded ? `<span class="hero-hand-label" data-testid="hero-hand-label">${escape(heroHandLabel(hero.hole, shown.board))}</span>` : ''}</div><div class="hero-stack-label">${style.avatars ? `<span class="bar-face" aria-hidden="true">${faceArt(seatName(0, shown), faceMood(shown, 0), true)}</span>` : ''}<span>YOUR STACK</span><b>${money(hero.stack)}</b></div></div>${canPreAct ? `<button type="button" id="skip-to-turn" class="pre-action skip-action${skipToTurn === shown.handId ? ' armed' : ''}" aria-pressed="${skipToTurn === shown.handId}" aria-label="Skip to my turn" title="Play the other players' actions quickly until your turn">${skipToTurn === shown.handId ? 'Skipping…' : 'Skip ▸'}</button>` : ''}${canPreAct ? `<button type="button" id="pre-check-fold" class="pre-action${preArmed ? ' armed' : ''}" aria-pressed="${preArmed}" title="When your turn comes: check if it is free, otherwise fold">${preArmed ? '✓ ' : ''}Check/Fold</button>` : ''}
      <div class="action-buttons"><button class="button fold-button" id="fold" ${!turn || !legal.fold ? 'disabled' : ''}>Fold</button><button class="button call-button" id="call" ${!turn || (!legal.check && !legal.callAmount) ? 'disabled' : ''}>${turn ? legal.check ? 'Check' : `${allInCall ? 'Call all-in' : 'Call'} ${money(legal.callAmount)}` : 'Check / Call'}</button><button class="button primary" id="raise" ${!turn || !sizing.legal ? 'disabled' : ''}><span id="raise-action-label">${canRaise && (legal.shortAllInTo !== null || raiseValue === max) ? 'All-in' : turn && legal.callAmount === 0 && hero.streetCommitted === 0 ? 'Bet' : 'Raise'} to</span> <span id="raise-button-value">${money(raiseValue)}</span></button></div>
      ${oddsPanel(hero.hole, shown.board, turn ? legal.callAmount : 0, shown.pot, hero.folded, money)}
      ${coachPanel(shown, turn, 'cash', money)}
      <div class="raise-controls"><div class="raise-input-group${hero.streetCommitted === 0 ? ' no-prior' : ''}"><label for="raise-to">${turn && legal.callAmount === 0 && hero.streetCommitted === 0 ? 'Bet' : 'Raise'} to ($)</label><span class="raise-stepper"><button type="button" class="step-button" data-step="-1" aria-label="Decrease by one big blind" ${!canRaise ? 'disabled' : ''}>−</button><input id="raise-to" inputmode="decimal" type="number" min="${min / 100}" max="${max / 100}" step="${shown.profile.chipUnit / 100}" value="${raiseValue / 100}" aria-describedby="raise-additional raise-limits sizing-validation" ${!canRaise ? 'disabled' : ''}><button type="button" class="step-button" data-step="1" aria-label="Increase by one big blind" ${!canRaise ? 'disabled' : ''}>+</button></span><span id="raise-additional">${turn ? `${money(Math.max(0, raiseValue - hero.streetCommitted))} additional` : 'Available on your turn'}</span></div><div class="size-presets">${[['min', 'Min'], ...streetSizes, ...POT_PERCENT_PRESETS.map(percent=>[percent===50?'half':percent===100?'pot':String(percent), `${percent}% pot`]), ['all', 'All-in']].map(([id, label, kind]) => `<button type="button" data-size="${id}"${kind ? ' class="street-size"' : ''} ${(!canRaise && !(id === 'all' && allInCall)) ? 'disabled' : ''}>${id === 'all' && allInCall ? 'All-in call' : label}</button>`).join('')}</div></div>
      ${canRaise && max > min ? `<div class="amount-slider"><span aria-hidden="true">Min</span><input id="amount-slider" type="range" min="${min}" max="${max}" step="${shown.profile.chipUnit}" value="${Number.isFinite(raiseValue) ? Math.min(max, Math.max(min, raiseValue)) : min}" aria-label="${legal.callAmount === 0 && hero.streetCommitted === 0 ? 'Bet' : 'Raise'} amount" aria-valuetext="${money(Number.isFinite(raiseValue) ? raiseValue : min)} total" ${!turn ? 'disabled' : ''}><span aria-hidden="true">All-in</span></div>` : ''}
      <p id="sizing-validation" class="sizing-validation" role="status" aria-live="polite">${canRaise ? sizingMessage(sizing) : ''}</p>
      <details id="sizing-more" class="sizing-more" ${(sizingMoreOpen ?? !compactViewport()) ? 'open' : ''}><summary><span>More sizes</span></summary><div class="sizing-more-body">
      <div id="raise-limits" class="raise-limits"><span>Minimum <b>${money(min)}</b></span><span>Maximum <b>${money(max)}</b></span><span>Chip unit <b>${money(shown.profile.chipUnit)}</b></span>${legal.shortAllInTo !== null ? '<span>Short all-in only</span>' : ''}</div>
      <div class="pot-slider-control"><label for="pot-slider">Bet size, % of pot <output id="pot-slider-value">${potPercent===null?'—':`${potPercent}%`}</output></label><input id="pot-slider" type="range" min="0" max="300" step="1" value="${Math.min(potPercent??0,300)}" aria-valuetext="${potPercent===null?'No size set':`${potPercent}% of the pot, ${money(raiseValue)} total`}" aria-describedby="pot-sizing-basis sizing-validation" ${!canRaise?'disabled':''}></div>
      <details id="sizing-shortcuts" class="sizing-shortcuts"><summary>Custom sizes: your own % or big blinds</summary><div class="shortcut-fields"><label>Custom pot %<input id="custom-pot-percent" type="number" inputmode="decimal" min="0" max="10000" step="0.01" value="${customPercent}" ${!canRaise?'disabled':''}></label><button id="custom-pot-apply" class="button secondary" ${!canRaise?'disabled':''}>Use %</button><label>Total in BB<input id="shortcut-bb" type="number" inputmode="decimal" min="0" max="10000" step="0.1" value="${shortcutBB}" ${!canRaise?'disabled':''}></label><button id="shortcut-bb-apply" class="button secondary" ${!canRaise?'disabled':''}>Use BB total</button><label>Increment (BB)<input id="increment-bb" type="number" inputmode="decimal" min="0" max="10000" step="0.1" value="${incrementBB}" ${!canRaise?'disabled':''}></label><button id="increment-bb-apply" class="button secondary" ${!canRaise?'disabled':''}>Add increment</button></div></details>
      <div class="action-footnote" id="action-guidance">${allInCall ? `Calling puts your remaining ${money(hero.stack)} all-in. Confirm with Call all-in above.` : 'Size buttons only set the amount. Nothing is bet until you tap Bet or Raise.'}</div><details id="sizing-basis" class="sizing-basis"><summary>How pot sizes are calculated</summary><p id="pot-sizing-basis">${POT_SIZING_BASIS}</p></details></div></details></section>`;
  }
  /** Patch 105: the Live coach panel. It reads the same view Hero sees: Hero's cards, the board and the public action. */
  /** Phase 3: the tournament payout context for the coach (players left, places paid, remaining prizes and
   * stacks, Hero and the current bettor located in the stack list), so tournament advice can price prize
   * equity (ICM) instead of chips alone. Public information only; undefined whenever it cannot be built. */
  function coachTournamentContext(shown: HeroViewModel): TournamentCoachContext | undefined {
    try {
      const event = tournament?.data?.active; if (!event) return undefined;
      const bettor = shown.seats.filter(s => s.id !== 0 && !s.folded).sort((a, b) => b.streetCommitted - a.streetCommitted)[0];
      if (event.mtt) {
        const base = mttStandings(event.mtt.state, true), ids = base.playerIds ?? [];
        const table = event.mtt.state.tables.find(t => t.game.handId === event.game.handId);
        const opponentPlayer = table && bettor ? playerAt(table, bettor.id) : undefined;
        return { playersLeft: base.playersLeft, paidPlaces: base.paid, prizes: base.prizes, stacks: base.stacks, heroIndex: ids.indexOf(0) >= 0 ? ids.indexOf(0) : undefined, opponentIndex: opponentPlayer !== undefined && ids.indexOf(opponentPlayer) >= 0 ? ids.indexOf(opponentPlayer) : undefined };
      }
      const seatsIn = event.game.seats.filter(s => s.startingStack > 0), ids = seatsIn.map(s => s.id);
      return { playersLeft: ids.length, paidPlaces: event.ladder.filter(p => p > 0).length, prizes: event.ladder.slice(0, ids.length), stacks: seatsIn.map(s => s.startingStack), heroIndex: ids.indexOf(0) >= 0 ? ids.indexOf(0) : undefined, opponentIndex: bettor && ids.indexOf(bettor.id) >= 0 ? ids.indexOf(bettor.id) : undefined };
    } catch { return undefined; }
  }
  function coachPanel(shown: HeroViewModel, turn: boolean, mode: 'cash' | 'tournament', format: (n: number) => string): string {
    const hero = shown.seats.find(s => s.id === 0);
    const advice = coachUi.on && turn ? advise(shown, { mode, money: format, styleOf: mode === 'cash' ? coachStyle : undefined, tournament: mode === 'tournament' ? coachTournamentContext(shown) : undefined }) : null;
    if (advice) coachUi.last = advice;
    return coachMarkup(coachUi, advice, { waiting: !turn && !!hero && !hero.folded && shown.street !== 'complete', tournament: mode === 'tournament' });
  }
  /** What Hero has seen a player do in this session (public actions only), for the coach's "your read" line. */
  function coachStyle(seat: number) {
    const data = controller.data, active = data?.active, name = game?.seats.find(s => s.id === seat)?.name;
    if (!data || !active || !name) return null;
    const key = `${active.sessionId}:${data.hands.length}`;
    if (coachStyleCache.key !== key) coachStyleCache = { key, value: new Map() };
    let style = coachStyleCache.value.get(seat);
    if (!style) { style = observedStyle(data.hands.filter(h => h.sessionId === active.sessionId), seat, name); coachStyleCache.value.set(seat, style); }
    return { label: style.label, hands: style.hands, aggressive: style.aggressive, vpip: style.vpip, faced: style.faced, foldToBet: style.foldToBet };
  }
  /** Patch 103: the odds helper, with its switch (off until you turn it on; remembered on this device). */
  function oddsOn(): boolean { try { return localStorage.getItem(ODDS_HELPER_KEY) === 'on'; } catch { return false; } }
  function oddsPanel(hole: readonly Card[], board: readonly Card[], call: number, pot: number, folded: boolean, format: (n: number) => string): string {
    const on = oddsOn(), show = on && !folded && hole.length === 2;
    return `<div class="odds-helper-row"><label class="t-watch-result"><input id="odds-helper-on" type="checkbox" ${on ? 'checked' : ''}>Odds helper</label>${show ? oddsHelperMarkup(oddsHelp(hole, board, call, pot), format) : ''}</div>`;
  }
  function sizingMessage(proposal:SizingProposal):string {
    return proposal.legal ? `${money(proposal.to)} total this round · ${money(proposal.additional)} more from your stack.` : proposal.reason==='below-minimum' ? `${money(proposal.to)} is below the ${money(proposal.minimum ?? 0)} minimum. Tap Min or enter a larger amount. Your amount was not changed.` : proposal.reason==='above-maximum' ? `${money(proposal.to)} is above your ${money(proposal.maximum ?? 0)} maximum. Tap All-in or enter a smaller amount. Your amount was not changed.` : proposal.reason==='invalid-denomination' ? 'The amount must be a whole number of this table’s chips. Your amount was not changed.' : 'Enter an amount with no more than two decimal places.';
  }
  function cashStats() { return timed('statistics.aggregate',()=>statsProjection.readData(controller.data)); }
  function statisticsPending():string {return `<p role="status" data-testid="statistics-pending">${statsProjection.error?`Statistics unavailable: ${escape(statsProjection.error)}. No partial totals are shown. <button id="retry-statistics" class="button secondary">Retry statistics</button>`:'Calculating verified statistics… Balances and table chips remain available; no partial results are shown.'}</p>`;}
  function provenance(rules:RuleProfile,policyVersions:readonly string[]|undefined,human?:string):string {
    return `Rules ${escape(rules.id)}@${ruleVersionMarkup(rules.version)} · Policies ${policyVersions?.length?policyVersions.map(escape).join(', '):'unrecorded'}${human?` · Human touches ${escape(human)} (mood, round bet amounts, think time)`:''}`;
  }
  function session(shown: HeroViewModel | null): string {
    const stats = cashStats(), current = stats?.activeSession;
    const profit = current?.profit ?? 0;
    const count = current?.hands ?? 0;
    /* Phase 10 (fun #2 + #4): the player's own session goal, and the session's
     * current hand streak — both read straight from the settled record. */
    const activeId = controller.data?.active?.sessionId ?? '';
    const goal = dailyBook.sessionGoal?.sessionId === activeId && activeId ? dailyBook.sessionGoal : null;
    const sessionHands = activeId ? (controller.data?.hands ?? []).filter(h => h.sessionId === activeId) : [];
    const streak = handStreak(sessionHands);
    const goalMarkup = activeId ? (goal
      ? `<div class="stack-line session-goal" data-testid="session-goal"><span>Your session goal</span><b class="${profit >= goal.targetCents ? 'positive' : ''}">${signed(goal.targetCents)} target · ${profit >= goal.targetCents ? 'reached' : `${signed(profit)} so far`}</b><button type="button" class="text-button" id="session-goal-clear">Clear</button></div>`
      : `<div class="stack-line session-goal"><span>Session goal</span><span class="goal-set"><input id="session-goal-amount" type="number" inputmode="decimal" min="0" step="1" placeholder="$ target" aria-label="Session goal in dollars"><button type="button" class="text-button" id="session-goal-set">Set</button></span></div>`) : '';
    const streakMarkup = streak && streak.count >= 2 ? `<div class="stack-line session-streak" data-testid="session-streak"><span>Hand streak</span><b class="${streak.kind === 'won' ? 'positive' : 'negative'}">${streak.kind === 'won' ? 'Won' : 'Lost'} the last ${streak.count} hands</b></div>` : '';
    return `<aside class="session-rail"><section class="panel session-card"><div class="small-heading"><h3>Your session</h3><span class="outline-tag">VIRTUAL</span></div><div class="wallet-summary"><span>Available bankroll</span><strong data-testid="wallet-balance">${money(controller.data?.wallet ?? 0)}</strong><button class="button secondary" id="open-cashier">Cashier / bankroll</button></div><div class="main-stat"><span>Settled session result</span><strong class="${stats?(profit > 0 ? 'positive' : profit < 0 ? 'negative' : ''):''}" data-testid="session-profit">${stats?signed(profit):'—'}</strong><small>Completed hands only · transfers excluded</small></div>${goalMarkup}${streakMarkup}<div class="stat-grid"><div><span>Hands played</span><b data-testid="hand-count">${stats?count:'…'}</b></div><div><span>bb / 100</span><b>${!stats?'…':current?.bb100 == null ? '—' : current.bb100.toFixed(1)}</b></div></div><div class="stack-line"><span>Seated chip stack</span><b data-testid="table-stack">${money(shown?.seats.find(s => s.id === 0)?.stack ?? 0)}</b></div><div class="stack-line"><span>Cumulative poker result</span><b data-testid="total-profit">${stats?signed(stats.profit):'—'}</b></div>${stats?`<p class="stat-disclaimer">${stats.hands} saved hands. Observed simulator results do not predict live poker winnings.</p>`:statisticsPending()}${shown?`<details class="provenance-details"><summary>Session versions</summary><p class="muted" data-testid="session-provenance" style="overflow-wrap:anywhere">Frozen session versions: ${provenance(shown.profile,frozenPolicyVersions(controller.data?.active?.profiles ?? {}),controller.data?.active?.humanLayer)}</p></details>`:''}<button class="button secondary rail-results" id="open-results">Player statistics →</button></section>
      <section class="panel activity-card"><div class="small-heading"><h3>At the table</h3><span class="activity-icon shape-icon shape-arrow" aria-hidden="true"></span></div>${shown ? `<div class="activity-list">${shown.events.filter(e => ['action', 'street', 'award', 'refund', 'rake'].includes(e.type)).slice(-6).reverse().map(e => `<div class="activity-item"><span class="activity-marker ${e.type === 'award' ? 'gold-marker' : ''}"></span><div><b>${e.seatId !== undefined ? escape(seatName(e.seatId,shown)) : e.type === 'street' ? title(e.street ?? '') : 'Table'}</b><span>${escape(eventDescription(e))}</span></div></div>`).join('') || '<p class="muted">Blinds posted. The first decision is underway.</p>'}</div>` : '<div class="empty-activity"><span aria-hidden="true">♠</span><p>Every hand has a story.<br>Your table activity will appear here.</p></div>'}</section>
      <section class="build-note"><h3>Saved on this device.</h3><p>Bankroll, hands and committed game progress are stored in this browser. Guest data does not synchronize across devices.</p><p class="memory-notice">Keep an exported history for your records. Clearing browser site data removes the local save.</p></section></aside>`;
  }
  function playerNotes():string {
    const data=controller.data;if(!data)return '';
    const selected=data.sessions.find(session=>session.id===notesSession)??data.sessions.find(session=>session.id===data.active?.sessionId)??data.sessions.at(-1);
    notesSession=selected?.id??'';
    const seats=selected?occupiedSeatIds(selected.settings).filter(id=>id!==0):[];if(!seats.includes(notesSeat))notesSeat=seats[0]??1;
    const saved=selected?getPlayerNote(data,selected.id,notesSeat):undefined,draft=noteDrafts.get(noteKey());
    return playerNotesMarkup({open:notesOpen,sessionId:notesSession,seatId:notesSeat,text:draft?.text??saved?.text??'',stored:!!saved,dirty:!!draft,locked:unavailable(),notice:noteNotice,players:seats.map(id=>({id,name:seatName(id,game)})),sessions:notesOpen?data.sessions.slice().reverse().map(session=>({id:session.id,label:`${session.id===data.active?.sessionId?'Current table':'Saved session'} · ${money(session.profile.smallBlind)}/${money(session.profile.bigBlind)} · ${new Date(session.startedAt).toLocaleString()}`})):[]});
  }
  function archiveCheck():string {
    if(!controller.canAuditArchive&&!controller.canCompactSavedHistory)return '';
    const audit=controller.archiveAuditStatus;
    const state=audit==='verified'?'The retained history copy passed its last check.':audit==='failed'?'The retained history copy failed verification. Existing records were preserved; keep this save and seek recovery before rolling back the application.':audit==='not-audited'?'The current bankroll, financial ledger and active game passed recovery verification. Older canonical hand bodies have not yet been fully audited in this visit.':'The current save passed recovery verification.';
    return `<section class="panel cashier-panel"><h2>Saved-history verification</h2><p data-testid="archive-audit-status">${escape(state)}</p><p>This optional full check independently reads every original canonical hand and reconciles it to the verified financial state. It can take time with thousands of hands and never changes your bankroll.</p>${controller.canAuditArchive?`<button id="audit-archive" class="button secondary" ${unavailable()||controller.data?.active?'disabled':''}>Check retained history copy</button>`:''}${controller.data?.active?'<p>End and cash out this table before running the full check.</p>':''}<p id="archive-audit-notice" role="status">${escape(archiveNotice)}</p>${controller.canCompactSavedHistory?`<hr><h3>Reduce saved-history storage</h3><p id="storage-maintenance-description">Keep every original hand, financial record and saved bankroll. After verifying the original history, this removes redundant older acceleration copies and retains up to 120 recent copies. Large histories can take time; this does not export or reset your account.</p><button type="button" id="compact-history-storage" class="button secondary" aria-describedby="storage-maintenance-description" ${unavailable()||controller.data?.active?'disabled':''}>Reduce saved-history storage</button>${controller.data?.active?'<p>End and cash out this table before reducing storage.</p>':''}<p id="storage-maintenance-notice" role="status" aria-live="polite" tabindex="-1">${escape(maintenanceNotice)}</p>`:''}</section>`;
  }
  function cashier(): string {
    const data = controller.data, stats = cashStats();
    const current = data?.active ? data.sessions.find(item => item.id === data.active!.sessionId) : null;
    const stack = game?.seats.find(seat => seat.id === 0)?.stack ?? 0;
    const between = game?.street === 'complete';
    const locked = unavailable();
    return `<div class="cashier-layout"><section class="panel cashier-panel"><div class="section-heading"><div><span class="eyebrow">VIRTUAL CHIPS ONLY</span><h2>Your bankroll</h2><p>Manual changes and transfers never count as poker winnings.</p></div><span class="outline-tag">EPOCH ${data?.epoch ?? 1}</span></div><div class="money-cards"><div><span>Available bankroll</span><b data-testid="cashier-wallet">${money(data?.wallet ?? 0)}</b></div><div><span>Seated stack</span><b data-testid="cashier-table">${money(stack)}</b></div><div><span>Lifetime poker result</span><b data-testid="cashier-profit" class="${stats?(stats.profit >= 0 ? 'positive' : 'negative'):''}">${stats?signed(stats.profit):'—'}</b></div></div>${stats?'':statisticsPending()}<form id="bankroll-form" class="cash-form" data-cashier-context="${data?.epoch}"><label>Set available virtual bankroll ($)<input name="bankroll" id="bankroll-amount" inputmode="decimal" value="${(data?.wallet ?? 0) / 100}" required ${locked ? 'disabled' : ''}></label><label>Adjustment note<input name="note" id="bankroll-note" value="Manual bankroll adjustment" maxlength="160" ${locked ? 'disabled' : ''}></label><button type="submit" id="save-bankroll" class="button primary" ${locked ? 'disabled' : ''}>Record bankroll adjustment</button></form><p class="muted">This edits only unseated funds. It is safe during a hand and leaves cards, table chips and past results intact.</p><div class="reset-area">${resetConfirm ? `<p>Reset the available bankroll to the original ${money(data?.initialBankroll ?? 1000000)} baseline? This starts a new accounting epoch; saved poker results and seated chips remain unchanged.</p><button class="button secondary" id="confirm-reset" ${locked ? 'disabled' : ''}>Confirm bankroll reset</button><button class="button secondary" id="cancel-reset">Cancel</button>` : `<button class="button secondary" id="show-reset" ${locked ? 'disabled' : ''}>Reset bankroll baseline…</button>`}</div></section>
      <section class="panel cashier-panel"><span class="eyebrow">TABLE TRANSFERS</span><h2>${game ? 'Manage your seat' : 'Ready for another session?'}</h2>${game && current ? `<p class="muted">${money(current.profile.smallBlind)} / ${money(current.profile.bigBlind)} · ${current.settings.seats} seats · buy-in ${current.settings.minBuyInBB}–${current.settings.maxBuyInBB} BB. ${current.settings.allowTopUp ? 'Top-ups allowed between hands.' : 'Top-ups disabled for this table.'}</p><form id="topup-form" class="cash-form" data-cashier-context="${escape(current.id)}"><label>Add chips ($)<input name="amount" id="topup-amount" inputmode="decimal" value="${Math.max(0, Math.min(current.settings.buyIn - stack, data?.wallet ?? 0)) / 100}" required ${!between || !current.settings.allowTopUp || locked ? 'disabled' : ''}></label><button type="submit" id="topup-submit" class="button primary" ${!between || !current.settings.allowTopUp || locked ? 'disabled' : ''}>Transfer to table</button></form><div class="cash-actions"><button class="button secondary" data-action="continue-session" ${locked ? 'disabled' : ''}>Continue session →</button><button class="button secondary" data-action="new-session">End session / new table</button><button class="button secondary" id="cashout" ${!between || locked ? 'disabled' : ''}>Cash out ${money(stack)} and leave</button></div>${!between ? '<p class="muted">Finish the active hand before adding chips or cashing out. Your bankroll adjustment remains available.</p>' : ''}` : '<p class="muted">Choose stakes and a buy-in to transfer funds from your bankroll to the next table.</p><button class="button primary" data-action="new-session">New session →</button>'}<div class="saved-note"><b>Guest save</b><p>No Google sign-in is required. This browser stores your save locally; another device has a separate bankroll.</p><button class="button secondary" id="protect-storage">Request storage protection</button><p id="storage-protection-notice" role="status">${escape(protectionNotice || 'Storage remains subject to browser policies and can be removed when you clear site data.')}</p></div></section>
      ${archiveCheck()}
      ${backupControls({...backupState,blocked:backupBlocked()})}
      ${privacyControls({active:!!data?.active,locked,handCount:controller.totalHandCount,confirm:deleteConfirm})}
      <section class="panel cashier-panel ledger-panel"><div class="section-heading"><div><span class="eyebrow">ACCOUNTING TRAIL</span><h2>Recent transactions</h2><p>Unique saved events. Hand results are separate from manual adjustments.</p></div></div><div class="ledger-list">${data?.ledger.length ? data.ledger.slice(-30).reverse().map(entry => `<article><div><b>${escape(entry.kind.replaceAll('-', ' '))}</b><small>${escape(new Date(entry.at).toLocaleString())} · Epoch ${entry.epoch}</small><small>${escape(entry.note)}</small></div><div><span>Wallet ${signed(entry.walletDelta)}</span><span>Table ${signed(entry.tableDelta)}</span><span>Poker ${signed(entry.pokerNet)}</span></div></article>`).join('') : '<p class="muted">Your saved transactions will appear here.</p>'}</div></section></div>`;
  }
  function selectedCashResults():FilteredCashResults|null {
    const data=controller.data;if(!data||!controller.historyLoaded||resultsFilter.sessionId==='all'&&resultsFilter.stake==='all')return null;
    const key=JSON.stringify(resultsFilter);if(filteredCache?.data===data&&filteredCache.key===key)return filteredCache.result;
    const result=deriveFilteredCashStats(data,resultsFilter);filteredCache={data,key,result};return result;
  }
  function results(): string {
    const controls=controller.data?cashResultsFilterMarkup(controller.data,resultsFilter,unavailable()):'';
    const requested=resultsFilter.sessionId!=='all'||resultsFilter.stake!=='all';
    if(requested&&!controller.historyLoaded)return `<section class="panel results-panel"><h2>Cash-game statistics</h2>${controls}<p role="status">${controller.historyLoading?'Verifying the full archive for these filters. No partial result is shown; poker controls are temporarily paused.':'Load the complete saved archive to calculate this filter.'}</p><button id="load-older-history" class="button secondary" ${unavailable()?'disabled':''}>Load and verify all older hands</button></section>`;
    const selected=selectedCashResults(),stats=selected?.stats??cashStats();
    if(!stats)return `<section class="panel results-panel"><h2>Cash-game statistics</h2>${statisticsPending()}</section>`;
    const metrics = [['vpip','VPIP'],['pfr','PFR'],['threeBet','3-bet'],['foldToThreeBet','Fold to 3-bet'],['raise','Postflop raise'],['checkRaise','Check-raise'],['foldToCbet','Fold to flop c-bet'],['wtsd','WTSD'],['wsd','W$SD'],['wwsf','WWSF']] as const;
    const projection=projectLivePace(stats,assumedHandsPerHour);
    const groups = (heading:string, rows:typeof stats.positions) => `<section class="panel results-panel"><h2>${heading}</h2><div class="result-table"><div class="result-row result-head"><span>Group</span><span>Hands</span><span>Result</span><span>BB/100</span></div>${rows.length ? rows.map(item => `<div class="result-row"><span>${escape(item.label)}</span><span>${item.hands}</span><span>${signed(item.profit)}</span><span>${item.bb100 == null ? '—' : item.bb100.toFixed(1)}</span></div>`).join('') : '<p class="muted">No settled samples yet.</p>'}</div></section>`;
    return `<section class="panel results-panel"><div class="section-heading"><div><span class="eyebrow">CASH-GAME RESULTS</span><h2>Your recorded play</h2><p>Based on ${stats.hands} completed hands. Manual adjustments and imported study hands are excluded.</p></div></div>${controls}${selected?`<p class="muted" data-testid="selected-results-disclosure">${escape(selected.disclosure)}</p>`:''}${resultCharts(!!selected)}${milestonesMarkup()}<div class="money-cards stats-summary"><div><span>Total poker result</span><b data-testid="stats-profit">${signed(stats.profit)}</b></div><div><span>Hands played</span><b>${stats.hands}</b></div><div><span>BB / 100</span><b>${stats.bb100 == null ? '—' : stats.bb100.toFixed(2)}</b></div><div><span>App-clock result / hour</span><b>${stats.perHour == null ? '—' : signed(Math.round(stats.perHour))}</b></div><div><span>Tracked playing time</span><b>${selected?.hoursAvailable===false?'—':(stats.activeMs / 60000).toFixed(1)+' min'}</b></div><div><span>Attributed rake (contributed)</span><b>${money(stats.rake)}</b></div><div><span>Winning / losing sessions</span><b>${stats.winningSessions} / ${stats.losingSessions}</b><small>${stats.evenSessions} break-even; completed sessions only</small></div><div><span>Current session result</span><b>${signed(stats.activeSession?.profit ?? 0)}</b></div></div><p class="muted" data-testid="ev-availability"><b>All-in-adjusted EV: NOT IMPLEMENTED.</b> The amounts above are recorded simulator profits and losses. Full decision EV is not calculated.</p><p class="muted" data-testid="population-results-disclosure">Results depend on this synthetic opponent population and do not predict real poker winnings.</p><p class="muted">${escape(stats.disclosure)}</p><p class="muted">${stats.mixedStakes ? 'Mixed stakes: BB/100 = 100 × sum(each hand net ÷ that hand’s big blind) ÷ hands.' : 'BB/100 = 100 × sum(each hand net ÷ its big blind) ÷ hands.'} App-clock $/hour uses recorded foreground playing time; pauses, hidden-tab time and closed-browser time are excluded. The last unsaved few seconds may be lost on an abrupt close. Simulator speed affects this rate. No EV is calculated.</p><section class="live-projection" data-testid="live-pace-projection" data-assumed-hands-per-hour="${assumedHandsPerHour}"><h3>Hypothetical live-pace projection</h3><p>This assumption is separate from measured app-clock playing time and does not predict live earnings.</p><label for="assumed-live-pace">Assumed live hands per hour<input id="assumed-live-pace" type="number" min="1" max="1000" step="1" value="${assumedHandsPerHour}" aria-describedby="live-pace-validation"></label><p id="live-pace-validation" class="sizing-validation" role="status" aria-live="polite"></p><div class="money-cards"><div><span>Live-equivalent hours · hypothetical</span><b data-testid="live-equivalent-hours">${projection.liveEquivalentHours===null?'—':projection.liveEquivalentHours.toFixed(2)}</b></div><div><span>Projected BB/hour · hypothetical</span><b data-testid="projected-bb-hour">${projection.projectedBBPerHour===null?'—':projection.projectedBBPerHour.toFixed(2)}</b></div><div><span>Projected $/hour · hypothetical</span><b data-testid="projected-profit-hour">${projection.projectedProfitPerHour===null?'—':signed(Math.round(projection.projectedProfitPerHour))}</b></div></div><p class="muted" id="live-pace-disclosure">${escape(projection.disclosure)}</p></section><details class="metric-definitions"><summary>How these statistics are counted</summary>${metrics.map(([key,label]) => `<p><b>${label}:</b> ${escape(STAT_DEFINITIONS[key])}</p>`).join('')}<p>Rake is a contributed-share attribution of actual engine rake, not an extra charge. Confidence intervals are descriptive; hands are correlated within sessions and small samples remain uncertain. Tournament results will use a separate namespace.</p></details></section>
      <section class="metric-grid">${metrics.map(([key,label]) => { const metric=stats.metrics[key]; return `<article class="panel metric-card"><h3>${label}</h3><strong>${metric.percent == null ? '—' : metric.percent.toFixed(1)+'%'}</strong><small>${metric.numerator} / ${metric.denominator} opportunities</small><small>${metric.status === 'NO_OPPORTUNITIES' ? 'No opportunities yet' : metric.status === 'INSUFFICIENT_SAMPLE' ? 'Small sample · uncertain' : 'Descriptive simulator sample'}</small>${metric.ci95 ? `<small>95% descriptive interval ${metric.ci95[0].toFixed(1)}–${metric.ci95[1].toFixed(1)}%</small>` : ''}</article>`; }).join('')}</section>
      ${controller.data?houseTakeMarkup(controller.data,style.tokes):''}${groups('Results by position', stats.positions)}${groups('Results by stakes', stats.stakes)}${groups('Results by table configuration', stats.configurations)}${configurationHistoryMarkup(stats.configurationHistory,configurationHistoryPage)}<section class="panel results-panel"><h2>Session history</h2><div class="session-history">${stats.sessions.length ? stats.sessions.slice().reverse().map(item => `<article><div><b>${escape(new Date(item.startedAt).toLocaleString())}</b><small>${item.endedAt ? 'Cashed out' : 'Active session'} · ${item.hands} hands · ${selected?.unavailableSessionIds.includes(item.id)?'time unavailable':(item.activeMs / 60000).toFixed(1)+' active minutes'}</small></div><strong class="${item.profit >= 0 ? 'positive' : 'negative'}">${signed(item.profit)}</strong><button class="button secondary" data-session-history="${escape(item.id)}">View hands</button></article>`).join('') : '<p class="muted">Your first saved session is waiting.</p>'}</div></section>`;
  }
  function eventDescription(event: HeroViewModel['events'][number]): string {
    if (event.action) return event.action.type === 'raise' ? `Raises to ${money(event.action.to)}` : event.action.type === 'call' ? `Calls${event.amount !== undefined ? ` ${money(event.amount)}` : ''}` : title(event.action.type === 'check' ? 'checks' : 'folds');
    if (event.type === 'award') return `Awarded ${money(event.amount ?? 0)}${event.detail ? ` · ${event.detail}` : ''}`;
    if (event.type === 'blind') return event.detail === 'Live straddle' ? `Straddles ${money(event.amount ?? 0)}` : `Posts blind ${money(event.amount ?? 0)}`;
    if (event.type === 'rake') return `Rake taken ${money(event.amount ?? 0)}`;
    if (event.type === 'refund') return `Uncalled ${money(event.amount ?? 0)} returned`;
    if (event.type === 'street') return `${title(event.street ?? '')} dealt`;
    return event.detail ?? event.type;
  }
  function reviewOrigin(hand:StoredHand|PublicHand,imported:boolean,verified:boolean):string {
    const namespace=imported?'imported':'cash';
    const cached=verified?originCache.get(hand):undefined;
    if(cached?.[namespace])return cached[namespace]!;
    const label=handOriginDescription(hand,namespace);
    if(verified)originCache.set(hand,{...cached,[namespace]:label});
    return label;
  }
  function allReviewHands(): ReviewHand[] {
    const source=controller.data?.hands??[];
    const verified=!!controller.data&&isVerifiedSnapshot(controller.data);
    if(source!==historySource||!verified){
      reviewCache=timed('ui.historyProjection',()=>source.map(hand=>({id:hand.id,number:hand.number,net:hand.net,view:hand.view,frames:hand.frames,startedAt:hand.startedAt,endedAt:hand.endedAt,sessionId:hand.sessionId,imported:false,provenance:hand.provenance,originLabel:reviewOrigin(hand,false,verified),policyVersions:frozenPolicyVersions(hand.privateProfiles)})));
      historySource=verified?source:null;
    }
    return [...reviewCache, ...(controller.data?.importedHands ?? []).map((hand:PublicHand) => ({ ...hand, id:hand.handId, imported:true,originLabel:reviewOrigin(hand,true,verified) }))];
  }
  function study(): string {
    const all = allReviewHands();
    const archiveNotice=controller.historyLoaded?'':`<section class="history-archive-notice" data-testid="lazy-history-notice"><p>${all.length} recent or imported hands are loaded; ${controller.totalHandCount} canonical hands are saved. Older hand details remain on this device.</p><button id="load-older-history" class="button secondary" ${unavailable()?'disabled':''}>Load and verify all older hands</button><p role="status">${controller.historyLoading?'Reading the complete archive. Poker controls are temporarily paused; no action or payout is being changed.':'The bankroll is verified. Full archived-hand auditing is a separate check.'}</p></section>`;
    const sessions = [...new Set(all.map(hand => hand.sessionId))];
    const stakes = [...new Set(all.map(hand => `${hand.view.profile.smallBlind}/${hand.view.profile.bigBlind}`))];
    const filtered = all.filter(hand => (historySession === 'all' || hand.sessionId === historySession) && (historyStake === 'all' || `${hand.view.profile.smallBlind}/${hand.view.profile.bigBlind}` === historyStake) && (historyResult === 'all' || historyResult === 'won' && hand.net > 0 || historyResult === 'lost' && hand.net < 0 || historyResult === 'even' && hand.net === 0));
    const selected = all.find(hand => hand.id === replayId);
    return `<section class="panel history-panel"><div class="section-heading"><div><span class="eyebrow">LOOK BACK AT THE ACTION</span><h2>Hand history</h2><p>Saved completed hands and permitted information. Imported hands are study-only and never affect your bankroll or statistics.</p></div><details class="history-tools-wrap" ${downloadUrl ? 'open' : ''}><summary>Export or import history</summary><div class="history-tools"><button id="export-history" class="button secondary" ${controller.totalHandCount>0&&!controller.busy ? '' : 'disabled'}>Prepare history export ↓</button>${downloadUrl ? `<a class="button primary" id="download-history" href="${escape(downloadUrl)}" download="${escape(exportFiles?.json.name??'ai-texas-hold-em-history.json')}">Download JSON</a>${exportFiles&&shareableFile(exportFiles,navigator)?'<button class="button primary" id="share-history">Share / Save to Files</button>':''}<button class="button secondary" id="view-export">View / copy JSON</button>` : ''}<label class="button secondary import-label">Import study history<input id="import-history" type="file" accept="application/json,text/plain,.json,.txt" ${unavailable() ? 'disabled' : ''}></label><button class="button secondary" id="show-import-text">Import pasted JSON</button></div></details></div>
      ${archiveNotice}
      ${exportRange?`<p role="status" data-testid="export-range">This file contains hands ${exportRange.startIndex+1}–${exportRange.nextIndex} of ${exportRange.total}. Save it before preparing the next file. Each file imports separately as study history; it is not a bankroll backup.</p>${exportRange.nextIndex<exportRange.total?`<button class="button secondary" id="export-next" ${controller.busy?'disabled':''}>Prepare next export file</button>`:'<p>All files in this export have been prepared.</p>'}`:''}
      ${exportFiles?`<p class="export-notice" role="status">${escape(exportNotice||'Export ready. On iPhone, use Share / Save to Files when available, or Download JSON. View / copy JSON is available if downloads are blocked. Only completed, redacted hands are included.')}</p>`:''}
      ${showExportText&&exportFiles?`<div class="export-text"><label for="export-json">Redacted history JSON</label><textarea id="export-json" readonly spellcheck="false">${escape(exportFiles.text)}</textarea><button id="copy-history" class="button secondary">Copy JSON</button><p class="muted">You can also select this text manually. Save it as a .json or .txt file, or paste it into Import pasted JSON. It cannot restore or add bankroll funds.</p></div>`:''}
      ${importRightsMarkup(importRightsConfirmed)}
      ${importPreviewBusy?'<p role="status">Verifying the public file. No records have been imported…</p>':''}
      ${importPreview?studyImportPreviewMarkup(importPreview,importSelection,importPreviewPage,unavailable()||importPreviewBusy):''}
      ${showImportText?`<form id="import-text-form" class="export-text"><label for="import-json">Paste a redacted history export</label><textarea id="import-json" spellcheck="false" required maxlength="10000000">${escape(importTextDraft)}</textarea><button class="button secondary" id="import-pasted" ${unavailable()||importPreviewBusy?'disabled':''}>Review study import</button></form>`:''}
      <div class="history-filters"><label>Session<select id="history-session"><option value="all">All sessions</option>${sessions.map(id => `<option value="${escape(id)}" ${historySession === id ? 'selected' : ''}>${escape(new Date(all.find(hand => hand.sessionId === id)!.startedAt).toLocaleString())}</option>`).join('')}</select></label><label>Stakes<select id="history-stake"><option value="all">All stakes</option>${stakes.map(stake => `<option value="${stake}" ${historyStake === stake ? 'selected' : ''}>${stake.split('/').map(Number).map(money).join(' / ')}</option>`).join('')}</select></label><label>Result<select id="history-result">${[['all','All results'],['won','Winning hands'],['lost','Losing hands'],['even','Break-even']].map(([key,label]) => `<option value="${key}" ${historyResult === key ? 'selected' : ''}>${label}</option>`).join('')}</select></label></div>${selected ? replay(selected) : ''}<p class="muted">${filtered.length} of ${all.length} loaded hands · ${controller.totalHandCount} saved canonical hands</p><nav aria-label="Hand history pages"><button class="button secondary" id="history-newer" ${historyPage===0?'disabled':''}>Newer hands</button><span>Page ${historyPage+1} of ${Math.max(1,Math.ceil(filtered.length/25))}</span><button class="button secondary" id="history-older" ${(historyPage+1)*25>=filtered.length?'disabled':''}>Older hands</button></nav>${filtered.length ? filtered.slice().reverse().slice(historyPage*25,historyPage*25+25).map(hand => `<details class="hand-record"><summary><span><b>Hand ${String(hand.number).padStart(3, '0')} ${hand.imported ? '· Imported study' : ''}</b><small>${escape(new Date(hand.startedAt).toLocaleString())}</small><small>${money(hand.view.profile.smallBlind)} / ${money(hand.view.profile.bigBlind)} · ${hand.view.seats.length} players</small><small data-testid="hand-provenance" style="overflow-wrap:anywhere">${provenance(hand.view.profile,hand.policyVersions)}${hand.imported?' · Public import may omit policy versions':''}</small><small data-testid="hand-origin">${escape(hand.originLabel)}</small></span><span class="history-board">${hand.view.board.map(c => card(c, 'mini-card')).join('')}</span><b class="${hand.net > 0 ? 'positive' : hand.net < 0 ? 'negative' : ''}">${signed(hand.net)}</b><span class="chevron">⌄</span></summary><div class="hand-detail">${potBreakdown(hand.view)}<button class="button secondary replay-open" data-replay="${escape(hand.id)}">Replay hand step by step</button><div class="showdown-list">${hand.view.seats.filter(seat => seat.hole.length).map(seat => `<div><b>${escape(seat.name)}</b><span>${seat.hole.map(c => card(c, 'small-card')).join('')}</span>${hand.view.handLabels[seat.id] ? `<span class="showdown-hand-label">${escape(hand.view.handLabels[seat.id])}</span>` : ''}<small>${hand.view.payouts[seat.id] ? `Awarded ${money(hand.view.payouts[seat.id])}` : 'No award'}</small></div>`).join('')}</div><ol class="history-events">${hand.view.events.filter(e => e.type !== 'start').map(e => `<li><b>${e.seatId === undefined ? 'Table' : escape(seatName(e.seatId,hand.view))}</b> ${escape(eventDescription(e))}</li>`).join('')}</ol></div></details>`).join('') : '<div class="history-empty"><span>♠</span><h3>No hands match yet.</h3><p>Finish a hand or change the filters to review saved action.</p><button class="button secondary" id="back-live">Back to table →</button></div>'}</section>`;
  }
  let statsFilter:StatsFilter={...DEFAULT_STATS_FILTER};
  let statsCache:{revision:number;filter:string;stats:TournamentStats}|null=null;
  function currentTournamentStats():TournamentStats|null {
    const c=tournament;
    if(!c||!c.data)return null;
    const key=JSON.stringify(statsFilter);
    if(!statsCache||statsCache.revision!==c.data.revision||statsCache.filter!==key)statsCache={revision:c.data.revision,filter:key,stats:timed('tournament.stats',()=>tournamentStats(c.data!,statsFilter))};
    return statsCache.stats;
  }
  function tournamentStatsPage():string {
    const c=tournament;
    if(!c||!c.data)return `<section class="panel"><h2>Loading tournament records…</h2><p>${escape(c?.error||'Reading your saved tournaments.')}</p></section>`;
    return tournamentStatsMarkup(currentTournamentStats()!);
  }
  /** Patch 66: long-run results by game, with likely ranges. Blackjack history is read once per visit. */
  let blackjackRounds: { state: 'idle' | 'loading' | 'ready' | 'error'; rounds: { net: number; bet: number }[]; note: string } = { state: 'idle', rounds: [], note: '' };
  function loadBlackjackRounds(attempt = 0) {
    const c = blackjackLive.controller;
    if (c.status !== 'ready' || c.busy) {
      if (attempt === 0) blackjackLive.init();
      if (attempt < 40) { blackjackRounds.state = 'loading'; window.setTimeout(() => loadBlackjackRounds(attempt + 1), 250); }
      else { blackjackRounds = { state: 'error', rounds: [], note: 'Blackjack history could not be opened. Visit the Blackjack tab, then come back.' }; if (view === 'by-game') render(); }
      return;
    }
    blackjackRounds.state = 'loading';
    void c.roundResults().then(rounds => { blackjackRounds = { state: 'ready', rounds, note: '' }; if (view === 'by-game') render(); })
      .catch(error => { blackjackRounds = { state: 'error', rounds: [], note: String(error) }; if (view === 'by-game') render(); });
  }
  /* Phase 7: the full blackjack round records, read once per visit, for the
   * detailed stats page (doubles, splits, upcards, bet sizes). */
  let blackjackRecords: { state: 'idle' | 'loading' | 'ready' | 'error'; rounds: BlackjackRound[]; note: string } = { state: 'idle', rounds: [], note: '' };
  function loadBlackjackRecords(attempt = 0) {
    const c = blackjackLive.controller;
    if (c.status !== 'ready' || c.busy) {
      if (attempt === 0) blackjackLive.init();
      if (attempt < 40) { blackjackRecords.state = 'loading'; window.setTimeout(() => loadBlackjackRecords(attempt + 1), 250); }
      else { blackjackRecords = { state: 'error', rounds: [], note: 'Blackjack history could not be opened. Visit the Blackjack tab, then come back.' }; if (view === 'game-detail') render(); }
      return;
    }
    blackjackRecords.state = 'loading';
    void c.roundRecords().then(rounds => { blackjackRecords = { state: 'ready', rounds, note: '' }; if (view === 'game-detail') render(); })
      .catch(error => { blackjackRecords = { state: 'error', rounds: [], note: String(error) }; if (view === 'game-detail') render(); });
  }
  function gameCard(r: GameResult, format: (n: number) => string): string {
    const signed = (x: number) => `${x >= 0 ? '+' : '−'}${Math.abs(Math.round(x * 10) / 10)}`;
    const verdictText = r.verdict === 'winning' ? 'Likely winning' : r.verdict === 'losing' ? 'Likely losing' : 'Too early to tell';
    const n = r.rateSamples ?? r.samples;
    const range = r.rate ? `<p class="game-rate"><b>${signed(r.rate.mean)}</b> ${escape(r.rateLabel)}</p><p class="muted">Likely between ${signed(r.rate.low)} and ${signed(r.rate.high)} (95% range, ${n.toLocaleString()} ${r.unit}).</p>` : `<p class="muted">Play at least 2 ${r.unit} to see a rate.</p>`;
    const more = n < r.minimum ? `<p class="muted">A fair read needs at least ${r.minimum.toLocaleString()} ${r.unit}; you have ${n.toLocaleString()} and need ${(r.minimum-n).toLocaleString()} more.</p>` : r.verdict === 'too-early' && r.more ? `<p class="muted">If your average held, about ${r.more.toLocaleString()} more ${r.unit} would settle it.</p>` : '';
    const detail = r.detail ? `<p class="muted">${escape(r.detail)}</p>` : '';
    return `<article class="game-card ${r.verdict}" data-testid="game-${r.game}"><div class="game-head"><h3>${escape(r.label)}</h3><span class="game-verdict">${verdictText}</span></div>${range}<p>Total: <b class="${r.net >= 0 ? 'pos' : 'neg'}">${r.net >= 0 ? '+' : '−'}${format(Math.abs(r.net))}</b></p>${detail}${more}<button type="button" class="button secondary detail-open" data-game-detail="${r.game}">Detailed stats →</button></article>`;
  }
  /* Phase 2: stats snapshots and the reset point, in their own saved record.
   * Career totals are always projected live from the games' own records; the
   * book only holds snapshots and the baseline a reset leaves behind. */
  const statsBookRead = readStatsBook();
  let statsBook: StatsBook = statsBookRead.book;
  let statsNotice = statsBookRead.notice;
  /* Phase 10 (fun #28/#2/#4): the daily card record — baselines per local day plus
   * the player's own session goal. Issued lazily at the first render that needs it. */
  const dailyRead = readDailyBook();
  let dailyBook: DailyBook = dailyRead.book;
  const dailyNotice = dailyRead.notice;
  function dailyCounters(): DailyBaselines & { handsToday: number; showdownFreePotsToday: number } {
    const data = controller.data;
    const slots = slotsPlayer.state;
    const today = cashToday(data?.hands ?? [], localDayKey());
    return {
      cashHands: data ? data.sessions.reduce((sum, s) => sum + s.handIds.length, 0) : 0,
      slotsSpins: Object.values(slots.machines).reduce((sum, r) => sum + r.spins, 0),
      slotsFeatures: Object.entries(slots.machines).reduce((sum, [id, r]) => sum + (slots.watch?.[id]?.hits ?? r.features), 0),
      ladderBeaten: readLadder().beaten.length,
      bjRounds: blackjackRounds.state === 'ready' ? blackjackRounds.rounds.length : 0,
      ...today,
    };
  }
  function dailyCardMarkup(): string {
    const date = localDayKey();
    if (blackjackRounds.state === 'idle') loadBlackjackRounds();
    if (blackjackRounds.state === 'ready') { const fixed = fixBjBaseline(dailyBook, date, blackjackRounds.rounds.length); if (fixed !== dailyBook) { dailyBook = fixed; saveDailyBook(dailyBook); } }
    const counters = dailyCounters();
    const before = dailyBook;
    dailyBook = ensureDay(dailyBook, date, counters, blackjackRounds.state !== 'ready');
    if (dailyBook !== before) saveDailyBook(dailyBook);
    const day = dailyBook.days[date];
    const objectives = dailyObjectives(date, counters, day.baselines);
    const done = objectives.filter(o => o.done).length;
    return `<div class="hub-block daily-card" data-testid="daily-card"><h3>Today's card · ${done} of ${objectives.length} done</h3>${dailyNotice ? `<p class="muted">${escape(dailyNotice)}</p>` : ''}<ul class="daily-objectives">${objectives.map(o => `<li class="${o.done ? 'done' : ''}"><span aria-hidden="true">${o.done ? '✓' : '○'}</span> ${escape(o.label)} <small>${o.have} / ${o.need}</small></li>`).join('')}</ul><p class="muted">Objectives count only events your saved records on this device show. A fresh day starts a fresh card.</p></div>`;
  }
  function trophyRoomMarkup(): string {
    const data = controller.data;
    if (!data) return '';
    const items = [...cashMilestones(data), ...tournamentMilestones(tournament?.records ?? [])];
    const earned = items.filter(m => m.earned), locked = items.filter(m => !m.earned);
    const ladder = readLadder();
    const slotTitles = Object.entries(slotsPlayer.state.machines).filter(([, r]) => r.spins >= 25).sort((a, b) => b[1].spins - a[1].spins).slice(0, 3)
      .map(([id, r]) => { const m = MACHINES.find(x => x.id === id); return m ? `${escape(m.name)} — ★ ${r.spins >= 300 ? 'FLOOR LEGEND' : r.spins >= 100 ? 'SHARP' : 'REGULAR'}` : ''; }).filter(Boolean);
    return `<div class="hub-block trophy-room" data-testid="trophy-room"><h3>Trophy room</h3><p>${earned.length} of ${items.length} milestones earned · heads-up ladder ${ladder.beaten.length} of ${LADDER_IDS.length} beaten${slotTitles.length ? ` · ${slotTitles.join(' · ')}` : ''}</p>${earned.length ? `<ul class="hub-list">${earned.slice(0, 6).map(m => `<li>★ <b>${escape(m.title)}</b></li>`).join('')}</ul>` : '<p class="muted">Nothing on the shelf yet. Your first milestone is one hand away.</p>'}${locked.length ? `<p class="muted">Still on the shelf to win: ${locked.slice(0, 4).map(m => `☆ ${escape(m.title)}`).join(' · ')}</p>` : ''}<button type="button" class="button secondary" data-view="results">All milestones</button></div>`;
  }
  let compareSnapshotId: string | null = null;
  let statsResetConfirm = false;
  function careerSources(): CareerSources {
    return {
      cashHands: controller.data?.hands ?? [],
      tournamentEvents: tournament?.data ? tournamentStats(tournament.data).events : [],
      blackjackRounds: blackjackRounds.rounds,
      omahaHands: (plo ??= new PloTable()).state.hands,
      slots: slotsPlayer.state,
      casino: casino.state,
    };
  }
  const netCell = (net: number) => `<b class="${net >= 0 ? 'pos' : 'neg'}">${net >= 0 ? '+' : '−'}${money(Math.abs(net))}</b>`;
  function totalsTable(stats: CareerStats): string {
    return `<table class="stats-table"><thead><tr><th scope="col">Game</th><th scope="col">Played</th><th scope="col">Wagered</th><th scope="col">Net</th><th scope="col">Biggest win</th></tr></thead><tbody>${CAREER_GAMES.map(g => { const t = stats.games[g]; return `<tr><th scope="row">${escape(t.label)}</th><td>${t.samples.toLocaleString()} ${t.unit}</td><td>${t.wagered === null ? '—' : money(t.wagered)}</td><td>${netCell(t.net)}</td><td>${t.biggest === null ? '—' : money(t.biggest)}</td></tr>`; }).join('')}</tbody></table>`;
  }
  function periodSection(career: CareerStats, sources: CareerSources): string {
    const baseline = statsBook.baseline;
    const resetArea = statsResetConfirm
      ? `<p>Reset the current counters to zero? Your career totals, hand history, game records and snapshots all stay exactly as they are — only the "since reset" counting starts over.</p><button type="button" class="button primary" id="stats-reset-confirm">Confirm reset</button> <button type="button" class="button secondary" id="stats-reset-cancel">Cancel</button>`
      : `<button type="button" class="button secondary" id="stats-reset">Reset current counters…</button>${baseline ? ` <button type="button" class="button secondary" id="stats-baseline-clear">Clear the reset point</button>` : ''}`;
    if (!baseline) return `<div class="stats-block" data-testid="stats-period"><h3>Current counters</h3><p class="muted">No reset point yet, so your current counters are your whole career. When you have worked on your game and want to measure what changes, save a snapshot below, then reset: the counters start again from zero while your career totals and records stay untouched.</p>${resetArea}</div>`;
    const period = periodStats(career, baseline);
    const arch = periodArchives(sources, baseline.cursors);
    const rateCards = [
      arch.located.cash ? gameCard(cashResult(arch.cashHands), money) : '',
      arch.located.tournaments ? gameCard(tournamentResult(arch.tournamentEvents), money) : '',
      arch.located.blackjack ? gameCard(blackjackResult(arch.blackjackRounds), money) : '',
      arch.located.omaha ? gameCard(omahaResult(arch.omahaHands, label => PLO_STAKES.find(x => x.label === label)?.bigBlind), money) : '',
    ].join('');
    const unlocated = (['cash', 'tournaments', 'blackjack', 'omaha'] as const).filter(g => !arch.located[g]);
    return `<div class="stats-block" data-testid="stats-period"><h3>Since your reset · ${escape(new Date(baseline.at).toLocaleDateString())}</h3><p class="muted">${period.totalSamples.toLocaleString()} rounds of play since the reset · net ${netCell(period.totalNet)}. Biggest-win records are career-only: a reset never rewrites them, and a period record cannot be worked out from totals alone.</p>${totalsTable(period)}${rateCards ? `<div class="game-grid">${rateCards}</div>` : ''}${unlocated.length ? `<p class="muted">Rates for ${unlocated.map(g => career.games[g].label).join(', ')} need the records around the reset point loaded; the totals above already count everything since the reset. <button id="load-older-history" class="button secondary" ${unavailable() ? 'disabled' : ''}>Load older hands</button></p>` : ''}${resetArea}</div>`;
  }
  function snapshotsSection(career: CareerStats): string {
    const period = periodStats(career, statsBook.baseline);
    const rows = statsBook.snapshots.map(s => `<li class="snapshot-row"><div><b>${escape(s.name)}</b> <span class="muted">${escape(new Date(s.at).toLocaleString())} · ${s.career.totalSamples.toLocaleString()} played · net ${netCell(s.career.totalNet)}</span></div><div><button type="button" class="button secondary" data-snapshot-compare="${escape(s.id)}" aria-pressed="${compareSnapshotId === s.id}">Compare</button> <button type="button" class="button secondary" data-snapshot-delete="${escape(s.id)}">Delete</button></div></li>`).join('');
    const chosen = statsBook.snapshots.find(s => s.id === compareSnapshotId);
    const compare = chosen ? `<div class="stats-block" data-testid="stats-compare"><h3>${escape(chosen.name)} vs now</h3><p class="muted">Saved ${escape(new Date(chosen.at).toLocaleString())}. "Since reset" is what has happened since your reset point — compare it with the snapshot to see what changed after you saved it.</p><table class="stats-table"><thead><tr><th scope="col">Game</th><th scope="col">Snapshot</th><th scope="col">Since reset</th><th scope="col">Career now</th></tr></thead><tbody>${CAREER_GAMES.map(g => { const a = chosen.career.games[g], b = period.games[g], c = career.games[g]; const cell = (t: typeof a) => `${t.samples.toLocaleString()} ${t.unit} · ${netCell(t.net)}`; return `<tr><th scope="row">${escape(c.label)}</th><td>${cell(a)}</td><td>${cell(b)}</td><td>${cell(c)}</td></tr>`; }).join('')}</tbody></table><button type="button" class="button secondary" id="stats-compare-close">Close comparison</button></div>` : '';
    return `<div class="stats-block" data-testid="stats-snapshots"><h3>Snapshots</h3><p class="muted">Save your career stats as they stand, then reset the counters and play on. Snapshots are kept on this device and are never changed by a reset.</p>${statsNotice ? `<p role="status">${escape(statsNotice)}</p>` : ''}<div class="snapshot-save"><label>Snapshot name <input id="snapshot-name" type="text" maxlength="60" placeholder="e.g. Before coaching block"></label> <button type="button" class="button primary" id="snapshot-save">Save snapshot</button></div>${statsBook.snapshots.length ? `<ul class="snapshot-list">${rows}</ul>` : '<p class="muted">No snapshots saved yet.</p>'}${compare}</div>`;
  }
  function byGameView(): string {
    if (blackjackRounds.state === 'idle') loadBlackjackRounds();
    const sources = careerSources();
    const career = careerStats(sources);
    const cash = cashResult(sources.cashHands);
    const tour = tournamentResult(sources.tournamentEvents);
    const bj = blackjackResult(sources.blackjackRounds);
    const bjCard = blackjackRounds.state === 'ready' ? gameCard(bj, money) : `<article class="game-card" data-testid="game-blackjack"><div class="game-head"><h3>Blackjack</h3></div><p class="muted">${blackjackRounds.state === 'error' ? escape(blackjackRounds.note) : 'Reading your blackjack history…'}</p></article>`;
    const partial = controller.historyLoaded ? '' : `<p class="muted">Cash uses the ${controller.data?.hands.length ?? 0} hands loaded on this screen. <button id="load-older-history" class="button secondary" ${unavailable() ? 'disabled' : ''}>Load older hands</button></p>`;
    const gamesPlayed = CAREER_GAMES.filter(g => career.games[g].samples > 0).length;
    const biggest = CAREER_GAMES.map(g => career.games[g]).filter(t => t.biggest !== null).sort((a, b) => (b.biggest ?? 0) - (a.biggest ?? 0))[0];
    const overview = `<div class="hub-balances career-overview" data-testid="career-overview"><div><span class="eyebrow">NET · ALL GAMES</span><b>${signed(career.totalNet)}</b></div><div><span class="eyebrow">ROUNDS PLAYED</span><b>${career.totalSamples.toLocaleString()}</b></div><div><span class="eyebrow">GAMES PLAYED</span><b>${gamesPlayed} of ${CAREER_GAMES.length}</b></div><div><span class="eyebrow">BIGGEST WIN</span><b>${biggest ? `${money(biggest.biggest ?? 0)} · ${escape(biggest.label)}` : '—'}</b></div><div><span class="eyebrow">CAREER SINCE</span><b>${career.since ? escape(new Date(career.since).toLocaleDateString()) : 'On this device'}</b></div></div>`;
    const machines = slotsMachines(sources.slots);
    const slotsDetail = machines.length ? `<div class="slots-result" data-testid="slots-result"><h3>Slots by machine</h3><p>${career.games.slots.samples.toLocaleString()} spins · bet ${money(career.games.slots.wagered ?? 0)} · paid back ${money((career.games.slots.wagered ?? 0) + career.games.slots.net)} · <b class="${career.games.slots.net >= 0 ? 'positive' : 'negative'}">${signed(career.games.slots.net)}</b>${(career.games.slots.wagered ?? 0) > 0 ? ` (${(100 * ((career.games.slots.wagered ?? 0) + career.games.slots.net) / (career.games.slots.wagered ?? 1)).toFixed(1)}% back)` : ''}. Slots have no skill edge: over time every machine returns about its posted payback, 94–96%.</p><table class="stats-table"><thead><tr><th scope="col">Machine</th><th scope="col">Spins</th><th scope="col">Bet</th><th scope="col">Paid back</th><th scope="col">Net</th><th scope="col">Biggest spin</th><th scope="col">Features</th></tr></thead><tbody>${machines.map(m => `<tr><th scope="row">${escape(machineById(m.id)?.name ?? m.id)}</th><td>${m.spins.toLocaleString()}</td><td>${money(m.wagered)}</td><td>${money(m.won)}${m.payback !== null ? ` (${m.payback.toFixed(1)}%)` : ''}</td><td>${netCell(m.net)}</td><td>${money(m.biggest)}</td><td>${m.features.toLocaleString()}</td></tr>`).join('')}</tbody></table>${sources.slots.gamble ? `<p class="muted">Double-up gamble: ${sources.slots.gamble.rounds.toLocaleString()} rounds · wagered ${money(sources.slots.gamble.wagered)} · won ${money(sources.slots.gamble.won)}.</p>` : ''}</div>` : '';
    return `<section class="panel by-game" data-testid="by-game"><span class="eyebrow">ALL GAMES · VIRTUAL CHIPS</span><h2>Results by game</h2><p class="muted">Your whole career in every game, not just recent sessions. Each game's average result comes with a likely range; short-term swings are big, so the verdict waits until the whole range is above or below zero. Slots and casino rates rest on the recent rounds those games keep on this device; their totals are all-time.</p>${partial}${overview}<div class="game-grid">${gameCard(cash, money)}${(()=>{const hu=headsUpHands(cashPerformanceHands(sources.cashHands));if(!hu.length)return '';const r=cashResult(hu);return `<article class="game-card" data-testid="game-heads-up"><div class="game-head"><h3>Heads-up</h3><span class="game-verdict">One on one</span></div><p class="game-rate"><b>${hu.length.toLocaleString()}</b> hands at two-seat tables</p><p>Total: <b class="${r.net>=0?'pos':'neg'}">${r.net>=0?'+':'−'}${money(Math.abs(r.net))}</b></p><button type="button" class="button secondary detail-open" data-game-detail="heads-up">Detailed stats →</button></article>`;})()}${tournament?.data ? gameCard(tour, money) : `<article class="game-card" data-testid="game-tournaments"><h3>Tournaments</h3><p class="muted">${escape(tournament?.error || 'Reading your tournament history…')}</p></article>`}${bjCard}${gameCard(omahaResult(sources.omahaHands, label => PLO_STAKES.find(x => x.label === label)?.bigBlind), money)}${gameCard(slotsResult(sources.slots), money)}${CASINO_GAMES.map(g => gameCard(casinoResult(g, sources.casino), money)).join('')}</div>${slotsDetail}${periodSection(career, sources)}${snapshotsSection(career)}<p class="muted">Cash rate is big blinds won per 100 hands. Tournament rate is profit as a share of your average buy-in, per event. Blackjack rate is your result per round as a share of your opening bet, so +0.5 means a 0.5% edge. Slots and casino rates are the result per spin or round as a share of the stake, over recent play. Simulator results do not predict real-money play.</p></section>`;
  }
  /* Phase 7: per-game detailed stats. Every number below comes from the same
   * stored records the career page totals — the drill-down modules in
   * src/stats/drilldown.ts and the existing deep/cash engines. Metrics the
   * records do not capture are flagged as gaps on the page, never faked. */
  type DetailGame = CareerGameId | 'heads-up';
  let detailGame: DetailGame = 'cash';
  const DETAIL_GAMES: { id: DetailGame; label: string }[] = [
    { id: 'cash', label: 'Cash games' }, { id: 'heads-up', label: 'Heads-up' }, { id: 'tournaments', label: 'Tournaments' }, { id: 'omaha', label: 'Omaha' },
    { id: 'blackjack', label: 'Blackjack' }, { id: 'slots', label: 'Slots' }, { id: 'roulette', label: 'Roulette' }, { id: 'craps', label: 'Craps' }, { id: 'baccarat', label: 'Baccarat' }, { id: 'races', label: 'Horse racing' }];
  const detailFact = (label: string, value: string, sub = '') => `<div><span class="eyebrow">${label}</span><b>${value}</b>${sub ? `<small>${sub}</small>` : ''}</div>`;
  const detailSection = (title: string, body: string, note = '') => body ? `<div class="detail-section"><h3>${title}</h3>${body}${note ? `<p class="muted">${note}</p>` : ''}</div>` : '';
  const bbCell = (x: number | null) => x === null ? '—' : `${x >= 0 ? '+' : ''}${x.toFixed(1)}`;
  function detailShell(title: string, sub: string, body: string): string {
    const nav = DETAIL_GAMES.map(g => `<button type="button" class="chip-button detail-chip${g.id === detailGame ? ' selected' : ''}" data-game-detail="${g.id}" aria-pressed="${g.id === detailGame}">${g.label}</button>`).join('');
    return `<section class="panel game-detail" data-testid="game-detail"><button type="button" class="button secondary" data-view="by-game">← All games</button><span class="eyebrow">DETAILED STATS</span><h2>${escape(title)}</h2><p class="muted">${escape(sub)}</p><div class="detail-nav" role="group" aria-label="Choose a game">${nav}</div>${body}</section>`;
  }
  const METRIC_LABELS: Record<MetricKey, string> = { vpip: 'VPIP', pfr: 'PFR', threeBet: '3-bet', foldToThreeBet: 'Fold to 3-bet', raise: 'Raise vs a bet', checkRaise: 'Check-raise', foldToCbet: 'Fold to c-bet', wtsd: 'WTSD', wsd: 'W$SD', wwsf: 'WWSF' };
  function metricTable(stats: CashStats): string {
    const row = (key: MetricKey) => { const m: RateStat = stats.metrics[key]; const status = m.status === 'NO_OPPORTUNITIES' ? 'No chances yet' : m.status === 'INSUFFICIENT_SAMPLE' ? 'Small sample' : ''; return `<tr><th scope="row" title="${escape(STAT_DEFINITIONS[key])}">${METRIC_LABELS[key]}</th><td>${m.percent === null ? '—' : `${m.percent.toFixed(1)}%`}</td><td>${m.numerator}/${m.denominator}</td><td class="muted">${m.ci95 ? `${m.ci95[0].toFixed(0)}–${m.ci95[1].toFixed(0)}%` : ''}</td><td class="muted">${status}</td></tr>`; };
    return `<div class="table-scroll"><table class="stats-table"><thead><tr><th scope="col">Measure</th><th scope="col">Rate</th><th scope="col">Count</th><th scope="col">95% range</th><th scope="col"></th></tr></thead><tbody>${(Object.keys(METRIC_LABELS) as MetricKey[]).map(row).join('')}</tbody></table></div>`;
  }
  function groupTable(groups: readonly CashResultGroup[], firstCol: string): string {
    if (!groups.length) return '';
    return `<div class="table-scroll"><table class="stats-table"><thead><tr><th scope="col">${firstCol}</th><th scope="col">Hands</th><th scope="col">Result</th><th scope="col">bb/100</th><th scope="col">Rake</th></tr></thead><tbody>${groups.map(g => `<tr><th scope="row">${escape(g.label)}</th><td>${g.hands.toLocaleString()}</td><td>${netCell(g.profit)}</td><td>${bbCell(g.bb100)}</td><td>${money(g.rake)}</td></tr>`).join('')}</tbody></table></div>`;
  }
  const POSITION_ORDER = ['UTG', 'UTG+1', 'UTG+2', 'MP', 'LJ', 'HJ', 'CO', 'BTN', 'SB', 'BB'];
  function vsTable(hands: readonly StoredHand[]): string {
    const rows = heroVsOpponents(hands).filter(v => v.hands >= 3).slice(0, 12);
    if (!rows.length) return '';
    return `<div class="table-scroll"><table class="stats-table"><thead><tr><th scope="col">Opponent</th><th scope="col">Hands together</th><th scope="col">Your result</th><th scope="col">Your bb/100</th><th scope="col">Their result</th><th scope="col">Showdowns (you won)</th></tr></thead><tbody>${rows.map(v => `<tr><th scope="row">${escape(v.name)}</th><td>${v.hands.toLocaleString()}</td><td>${netCell(v.heroNet)}</td><td>${bbCell(v.heroBb100)}</td><td>${netCell(v.oppNet)}</td><td>${v.showdowns} (${v.heroShowdownWins})</td></tr>`).join('')}</tbody></table></div>`;
  }
  function biggestPotsMarkup(hands: readonly StoredHand[]): string {
    const pots = biggestPots(hands, 5);
    const item = (p: (typeof pots.won)[number]) => `<li>Hand ${p.number} · ${new Date(p.at).toLocaleDateString()} · pot ${money(p.pot)} · <b class="${p.net >= 0 ? 'pos' : 'neg'}">${signed(p.net)}</b> <button type="button" class="chip-button" data-recap-hand="${escape(p.id)}">Replay</button></li>`;
    if (!pots.won.length && !pots.lost.length) return '';
    return `<div class="detail-two-col">${pots.won.length ? `<div><h4>Biggest pots you won</h4><ol class="fact-list">${pots.won.map(item).join('')}</ol></div>` : ''}${pots.lost.length ? `<div><h4>Biggest pots you lost</h4><ol class="fact-list">${pots.lost.map(item).join('')}</ol></div>` : ''}</div>`;
  }
  function cashDetail(): string {
    const data = controller.data!;
    const hands = cashPerformanceHands(data.hands);
    if (!hands.length) return detailShell('Cash games', 'No cash hands yet.', '<p>Play a cash session and your full breakdown lands here: VPIP, PFR and 3-bet, results by position and stakes tier, your record against each opponent, session history, biggest pots and your top leaks.</p>');
    const stats = deriveCashStats(hands, data.sessions);
    const { players, extras } = deepData();
    const me = players.get('You');
    const positions = [...stats.positions].sort((a, b) => { const ia = POSITION_ORDER.indexOf(a.label), ib = POSITION_ORDER.indexOf(b.label); return (ia < 0 ? 99 : ia) - (ib < 0 ? 99 : ib); });
    const sessions = [...stats.sessions].sort((a, b) => b.startedAt.localeCompare(a.startedAt)).slice(0, 12);
    const leaks = findLeaks(data.hands.slice(-500));
    const facts = `<div class="hub-balances detail-facts">${detailFact('Hands', stats.hands.toLocaleString())}${detailFact('Result', signed(stats.profit), stats.bb100 === null ? '' : `${bbCell(stats.bb100)} bb/100`)}${detailFact('Per hour', stats.perHour === null ? '—' : money(Math.round(stats.perHour)) + '/hr', `${(stats.activeMs / 3600000).toFixed(1)} hours at the table`)}${detailFact('Sessions', `${stats.winningSessions} won · ${stats.losingSessions} lost · ${stats.evenSessions} even`)}${detailFact('Rake paid', money(stats.rake))}</div>`;
    const sessionsTable = sessions.length ? `<div class="table-scroll"><table class="stats-table"><thead><tr><th scope="col">Session</th><th scope="col">Hands</th><th scope="col">Result</th><th scope="col">bb/100</th><th scope="col">Per hour</th></tr></thead><tbody>${sessions.map(s => `<tr><th scope="row">${new Date(s.startedAt).toLocaleString()}${s.endedAt ? '' : ' · live'}</th><td>${s.hands.toLocaleString()}</td><td>${netCell(s.profit)}</td><td>${bbCell(s.bb100)}</td><td>${s.perHour === null ? '—' : money(Math.round(s.perHour)) + '/hr'}</td></tr>`).join('')}</tbody></table></div>` : '';
    const tiers = stakesTierGroups(hands);
    const tierTable = tiers.length ? `<div class="table-scroll"><table class="stats-table"><thead><tr><th scope="col">Stakes tier</th><th scope="col">Hands</th><th scope="col">Result</th><th scope="col">bb/100</th></tr></thead><tbody>${tiers.map(t => `<tr><th scope="row">${escape(t.label)}</th><td>${t.hands.toLocaleString()}</td><td>${netCell(t.net)}</td><td>${bbCell(t.bb100)}</td></tr>`).join('')}</tbody></table></div>` : '';
    const luck = extras ? detailSection('All-in luck', `<p class="muted">Across ${extras.allIn.spots} all-in spots your equity said ${signed(extras.allIn.expected)}; you actually won ${signed(extras.allIn.actual)} (${signed(extras.allIn.actual - extras.allIn.expected)} of luck).</p>`) : '';
    const body = facts
      + detailSection('Your rates', metricTable(stats), 'Opportunity-based rates with the statistician\u2019s definitions, the same engine behind the Results page. A rate with no chances shows as a dash, never as 0%.')
      + (me ? detailSection('The rest of the deep sheet', `<div class="deep-grid">${playerRates(me)}</div>`, 'Aggression, showdown lines, biggest single-hand swings and shown hands, from the full action record.') : '')
      + detailSection('By position', groupTable(positions, 'Position'))
      + detailSection('By stakes', groupTable(stats.stakes, 'Stakes'))
      + detailSection('By stakes tier', tierTable)
      + detailSection('Sessions', sessionsTable)
      + detailSection('You vs the field', vsTable(hands), 'Opponents you have shared at least three hands with, most hands first. Their result counts only the pots you played together.')
      + detailSection('Biggest pots', biggestPotsMarkup(hands))
      + luck
      + (leaks.length ? detailSection('Top leaks', leakCards(leaks.slice(0, 3), 3) + '<p><button type="button" class="button secondary" data-view="coach">All leaks and drills →</button></p>') : '')
      + `<p class="muted">${escape(stats.disclosure)} <button type="button" class="button secondary" data-view="results">Filtered results →</button> <button type="button" class="button secondary" data-view="deep-stats">The whole table\u2019s deep stats →</button></p>`;
    return detailShell('Cash games', 'Your full professional breakdown: rates, positions, stakes, sessions, opponents, pots and leaks.', body);
  }
  function headsUpDetail(): string {
    const data = controller.data!;
    const hu = headsUpHands(cashPerformanceHands(data.hands));
    const ladder = readLadder();
    if (!hu.length && !ladder.matches.length) return detailShell('Heads-up', 'No heads-up play yet.', '<p>Beat the ladder or sit at a two-seat table and your one-on-one record lands here: match results by opponent, plus the full rate sheet on your heads-up hands.</p>');
    const byOpp = new Map<string, { matches: number; wins: number; hands: number; net: number }>();
    for (const m of ladder.matches) { const row = byOpp.get(m.opponent) ?? { matches: 0, wins: 0, hands: 0, net: 0 }; row.matches++; if (m.won) row.wins++; row.hands += m.hands; row.net += m.net; byOpp.set(m.opponent, row); }
    const matchTable = byOpp.size ? `<div class="table-scroll"><table class="stats-table"><thead><tr><th scope="col">Opponent</th><th scope="col">Matches</th><th scope="col">Won–lost</th><th scope="col">Hands</th><th scope="col">Net</th></tr></thead><tbody>${[...byOpp.entries()].map(([id, r]) => `<tr><th scope="row">${escape(regularById(id)?.name ?? id)}</th><td>${r.matches}</td><td>${r.wins}–${r.matches - r.wins}</td><td>${r.hands.toLocaleString()}</td><td>${netCell(r.net)}</td></tr>`).join('')}</tbody></table></div>` : '';
    const facts = `<div class="hub-balances detail-facts">${detailFact('Ladder matches', ladder.matches.length.toLocaleString(), `${ladder.matches.filter(m => m.won).length} won`)}${detailFact('Rungs beaten', `${ladder.beaten.length} of ${LADDER_IDS.length}`)}${detailFact('Heads-up hands', hu.length.toLocaleString())}${detailFact('Heads-up result', signed(hu.reduce((s, h) => s + h.net, 0)))}</div>`;
    let handBody = '';
    if (hu.length) {
      const stats = deriveCashStats(hu, []);
      const me = deepStats(hu).get('You');
      handBody = detailSection('Your heads-up rates', metricTable(stats))
        + (me ? detailSection('Deep sheet, heads-up hands only', `<div class="deep-grid">${playerRates(me)}</div>`) : '')
        + detailSection('By position', groupTable(stats.positions, 'Position'), 'Heads-up positions: you are the button and small blind, or the big blind.')
        + detailSection('You vs each opponent', vsTable(hu));
    }
    return detailShell('Heads-up', 'Your one-on-one record: the ladder, and the full rate sheet on every two-seat hand.', facts + detailSection('Ladder matches by opponent', matchTable) + handBody);
  }

  function tournamentsDetail(): string {
    const c = tournament;
    if (!c || !c.data) return detailShell('Tournaments', 'Reading your tournament records…', `<p>${escape(c?.error || 'One moment.')}</p>`);
    const stats = currentTournamentStats()!;
    if (!stats.events.length) return detailShell('Tournaments', 'No finished tournaments yet.', '<p>Finish a tournament and your record lands here: results by format, tier, field size and buy-in, your record against the field, and your biggest cashes.</p>');
    const tiers = buyInTierGroups(stats.events);
    const tierTable = tiers.length ? `<div class="table-scroll"><table class="stats-table"><thead><tr><th scope="col">Buy-in tier</th><th scope="col">Events</th><th scope="col">Cashed</th><th scope="col">Net</th><th scope="col">Return</th></tr></thead><tbody>${tiers.map(t => `<tr><th scope="row">${escape(t.label)}</th><td>${t.events}</td><td>${t.cashes} (${t.itm === null ? '—' : `${(t.itm * 100).toFixed(0)}%`})</td><td>${netCell(t.net)}</td><td>${t.roi === null ? '—' : `${(t.roi * 100).toFixed(1)}%`}</td></tr>`).join('')}</tbody></table></div>` : '';
    const cashes = biggestCashes(stats.events);
    const cashList = cashes.length ? `<ol class="fact-list">${cashes.map(e => `<li>${escape(e.name)} · ${ordinal(e.place)} of ${e.entrants} · <b class="pos">+${money(e.prize)}</b> · ${new Date(e.finishedAt).toLocaleDateString()}</li>`).join('')}</ol>` : '';
    const extras = detailSection('By buy-in tier', tierTable, 'Buy-in bands on the events shown below (the tournament filters apply to both).')
      + detailSection('Biggest cashes', cashList)
      + '<p class="muted">Flagged gap: knockouts and bounties are not carried into the saved event records, so there is no KO table. Adding one would need a new field in the tournament record, which is a versioned change, not a display change.</p>';
    return detailShell('Tournaments', 'Your tournament record in full: format, tier, field, buy-in and your biggest results.', extras) + tournamentStatsMarkup(stats);
  }
  function omahaDetail(): string {
    const table = (plo ??= new PloTable());
    const d = ploDrill(table.state.hands, table.state.sessions, label => PLO_STAKES.find(x => x.label === label)?.bigBlind);
    if (!d.hands && !d.sessions.length) return detailShell('Omaha', 'No Omaha hands yet.', '<p>Play a pot-limit Omaha session and your results land here: volume and bb/100 by stakes, your shown-hands record and session history.</p>');
    const facts = `<div class="hub-balances detail-facts">${detailFact('Hands', d.hands.toLocaleString())}${detailFact('Result', signed(d.net), d.bb100 === null ? '' : `${bbCell(d.bb100)} bb/100`)}${detailFact('Hands won', d.winRate === null ? '—' : `${(d.winRate * 100).toFixed(1)}%`)}${detailFact('Biggest win', d.biggestWin > 0 ? '+' + money(d.biggestWin) : '—')}${detailFact('Biggest loss', d.biggestLoss < 0 ? '−' + money(-d.biggestLoss) : '—')}${detailFact('Shown hands', `${d.shownWins} won of ${d.shownHands}`)}</div>`;
    const stakesTable = d.byStakes.length ? `<div class="table-scroll"><table class="stats-table"><thead><tr><th scope="col">Stakes</th><th scope="col">Hands</th><th scope="col">Result</th><th scope="col">bb/100</th></tr></thead><tbody>${d.byStakes.map(g => `<tr><th scope="row">${escape(g.stakes)}</th><td>${g.hands.toLocaleString()}</td><td>${netCell(g.net)}</td><td>${bbCell(g.bb100)}</td></tr>`).join('')}</tbody></table></div>` : '';
    const sessionRows = d.sessions.map(s => `<tr><th scope="row">${new Date(s.startedAt).toLocaleString()}${s.endedAt ? '' : ' · live'}</th><td>${escape(PLO_STAKES.find(x => x.id === s.stakes)?.label ?? s.stakes)}</td><td>${s.hands}</td><td>${s.net === null ? '—' : netCell(s.net)}</td></tr>`).join('');
    const sessionsTable = sessionRows ? `<div class="table-scroll"><table class="stats-table"><thead><tr><th scope="col">Session</th><th scope="col">Stakes</th><th scope="col">Hands</th><th scope="col">Result</th></tr></thead><tbody>${sessionRows}</tbody></table></div>` : '';
    const shownTable = d.shownBreakdown.length ? `<div class="table-scroll"><table class="stats-table"><thead><tr><th scope="col">Hand you showed</th><th scope="col">Times</th><th scope="col">Won</th></tr></thead><tbody>${d.shownBreakdown.slice(0, 10).map(s => `<tr><th scope="row">${escape(s.label)}</th><td>${s.hands}</td><td>${s.wins}</td></tr>`).join('')}</tbody></table></div>` : '';
    const body = facts + detailSection('By stakes', stakesTable) + detailSection('Sessions', sessionsTable) + detailSection('Hands you showed down', shownTable)
      + '<p class="muted">Flagged gap: Omaha hand records keep the result, the board and the shown hands, but not the action stream, so VPIP, PFR and 3-bet cannot be computed for Omaha. Results only, honestly.</p>';
    return detailShell('Omaha', 'Pot-limit Omaha, results depth: stakes, sessions and showdowns.', body);
  }
  function blackjackDetail(): string {
    if (blackjackRecords.state === 'idle') loadBlackjackRecords();
    if (blackjackRecords.state !== 'ready') return detailShell('Blackjack', 'Reading your blackjack history…', `<p>${blackjackRecords.state === 'error' ? escape(blackjackRecords.note) : 'One moment while the verified round records load.'}</p>`);
    const d = blackjackDrill(blackjackRecords.rounds);
    if (!d.rounds) return detailShell('Blackjack', 'No blackjack rounds yet.', '<p>Play a round and your record lands here: outcomes, doubles and splits, insurance, results by bet size and by the dealer\u2019s upcard.</p>');
    const share = (n: number) => d.hands ? `${((n / d.hands) * 100).toFixed(1)}%` : '—';
    const facts = `<div class="hub-balances detail-facts">${detailFact('Rounds', d.rounds.toLocaleString())}${detailFact('Hands', d.hands.toLocaleString())}${detailFact('Result', signed(d.net))}${detailFact('Biggest round won', d.biggestWin > 0 ? '+' + money(d.biggestWin) : '—')}${detailFact('Biggest round lost', d.biggestLoss < 0 ? '−' + money(-d.biggestLoss) : '—')}${detailFact('Blackjacks', `${d.outcomes.blackjack} (${share(d.outcomes.blackjack)} of hands)`)}</div>`;
    const outcomeTable = `<div class="table-scroll"><table class="stats-table"><thead><tr><th scope="col">Outcome</th><th scope="col">Hands</th><th scope="col">Share</th></tr></thead><tbody>${([['Won', d.outcomes.win], ['Lost', d.outcomes.loss], ['Pushed', d.outcomes.push], ['Blackjack', d.outcomes.blackjack], ['Surrendered', d.outcomes.surrender]] as [string, number][]).map(([label, n]) => `<tr><th scope="row">${label}</th><td>${n}</td><td>${share(n)}</td></tr>`).join('')}</tbody></table></div>`;
    const playsTable = `<div class="table-scroll"><table class="stats-table"><thead><tr><th scope="col">Play</th><th scope="col">Hands</th><th scope="col">Won</th><th scope="col">Lost</th><th scope="col">Pushed</th></tr></thead><tbody><tr><th scope="row">Double down</th><td>${d.doubles.hands}</td><td>${d.doubles.win}</td><td>${d.doubles.loss}</td><td>${d.doubles.push}</td></tr><tr><th scope="row">Split hands</th><td>${d.splits.hands}</td><td>${d.splits.win}</td><td>${d.splits.loss}</td><td>${d.splits.push}</td></tr></tbody></table></div>`;
    const insurance = d.insurance.rounds ? `<p class="muted">Insurance taken in ${d.insurance.rounds} round${d.insurance.rounds === 1 ? '' : 's'}: wagered ${money(d.insurance.wagered)}, returned ${money(d.insurance.returned)}, net ${signed(d.insurance.net)}.</p>` : '<p class="muted">You have never taken insurance.</p>';
    const betTable = d.byBetSize.length ? `<div class="table-scroll"><table class="stats-table"><thead><tr><th scope="col">Opening bet</th><th scope="col">Rounds</th><th scope="col">Result</th><th scope="col">Rounds won</th></tr></thead><tbody>${d.byBetSize.map(g => `<tr><th scope="row">${escape(g.label)}</th><td>${g.rounds}</td><td>${netCell(g.net)}</td><td>${g.winRate === null ? '—' : `${(g.winRate * 100).toFixed(0)}%`}</td></tr>`).join('')}</tbody></table></div>` : '';
    const upTable = d.byUpcard.length ? `<div class="table-scroll"><table class="stats-table"><thead><tr><th scope="col">Dealer upcard</th><th scope="col">Rounds</th><th scope="col">Result</th><th scope="col">Rounds won</th></tr></thead><tbody>${d.byUpcard.map(g => `<tr><th scope="row">${escape(g.label)}</th><td>${g.rounds}</td><td>${netCell(g.net)}</td><td>${g.winRate === null ? '—' : `${(g.winRate * 100).toFixed(0)}%`}</td></tr>`).join('')}</tbody></table></div>` : '';
    const body = facts + detailSection('Hand outcomes', outcomeTable) + detailSection('Doubles and splits', playsTable) + detailSection('Insurance', insurance) + detailSection('By bet size', betTable, 'Rounds grouped by the opening bet; the round result is the whole round, splits and doubles included.') + detailSection('By dealer upcard', upTable, 'Round results grouped by the card the dealer showed.');
    return detailShell('Blackjack', 'Every round on record: outcomes, plays, bet sizes and upcards.', body);
  }
  function slotsDetail(): string {
    const d = slotsDrill(slotsPlayer.state);
    if (!d.machines.length) return detailShell('Slots', 'No spins yet.', '<p>Spin any machine and its record lands here: spins, payback, biggest win and how often its features land, plus your hit rate over the recent spins the game keeps.</p>');
    const machineName = (id: string) => machineById(id)?.name ?? id;
    const rows = d.machines.map(m => `<tr><th scope="row">${escape(machineName(m.id))}</th><td>${m.spins.toLocaleString()}</td><td>${m.avgBet === null ? '—' : money(Math.round(m.avgBet))}</td><td>${money(m.wagered)}</td><td>${money(m.won)}</td><td>${m.payback === null ? '—' : `${m.payback.toFixed(1)}%`}</td><td>${netCell(m.net)}</td><td>${money(m.biggest)}</td><td>${m.features}</td><td>${m.featurePct === null ? '—' : `${m.featurePct.toFixed(1)}%`}</td></tr>`).join('');
    const table = `<div class="table-scroll"><table class="stats-table"><thead><tr><th scope="col">Machine</th><th scope="col">Spins</th><th scope="col">Avg bet</th><th scope="col">Wagered</th><th scope="col">Paid back</th><th scope="col">Payback</th><th scope="col">Net</th><th scope="col">Biggest win</th><th scope="col">Features</th><th scope="col">Feature rate</th></tr></thead><tbody>${rows}</tbody></table></div>`;
    const recentFacts = d.recentSpins ? `<div class="hub-balances detail-facts">${detailFact('Recent spins kept', d.recentSpins.toLocaleString())}${detailFact('Hit rate, recent', `${(d.recentHitPct ?? 0).toFixed(1)}%`, `${d.recentHits} spins paid something`)}${detailFact('Recent result', signed(d.recentNet))}</div>` : '';
    const recentRows = d.recentByMachine.map(m => `<tr><th scope="row">${escape(machineName(m.id))}</th><td>${m.spins}</td><td>${m.hits}</td><td>${m.spins ? (100 * m.hits / m.spins).toFixed(1) : '0.0'}%</td><td>${netCell(m.net)}</td></tr>`).join('');
    const recentTable = recentRows ? `<div class="table-scroll"><table class="stats-table"><thead><tr><th scope="col">Machine</th><th scope="col">Spins</th><th scope="col">Hits</th><th scope="col">Hit rate</th><th scope="col">Net</th></tr></thead><tbody>${recentRows}</tbody></table></div>` : '';
    const gamble = d.gamble && d.gamble.rounds ? `<p class="muted">Gamble feature: ${d.gamble.rounds} rounds, wagered ${money(d.gamble.wagered)}, won ${money(d.gamble.won)}, net ${signed(d.gamble.net)}.</p>` : '';
    const body = detailSection('Every machine, all time', table, 'Features counts free spins, hold-and-win and wheel features together; the saved record does not split them, so there is no per-feature table.')
      + detailSection('Hit frequency, recent window', recentFacts + recentTable, 'Slots keep only the last 30 spins on this device, so hit frequency is a recent-window figure, labelled as such. All-time hit rate is not recorded and is not guessed.')
      + gamble;
    return detailShell('Slots', 'Per-machine records: spins, payback, features, and your recent hit rate.', body);
  }
  function casinoDetail(game: 'roulette' | 'craps' | 'baccarat' | 'races'): string {
    const state = casino.state;
    const totals = state.games[game];
    const recent = state.recent.filter(r => r.game === game);
    const label = { roulette: 'Roulette', craps: 'Craps', baccarat: 'Baccarat', races: 'Horse racing' }[game];
    if (!totals || totals.rounds === 0) return detailShell(label, `No ${label.toLowerCase()} rounds yet.`, '<p>Play a round and the detailed record lands here, computed from the rounds and outcome boards the game keeps on this device.</p>');
    const facts = `<div class="hub-balances detail-facts">${detailFact('Rounds, all time', totals.rounds.toLocaleString())}${detailFact('Wagered', money(totals.wagered))}${detailFact('Returned', money(totals.returned))}${detailFact('Net', signed(totals.returned - totals.wagered))}${detailFact('Biggest round', '+' + money(totals.biggest))}</div>`;
    let body = facts;
    if (game === 'roulette') {
      const d = rouletteDrill(state.boards?.roulette ?? [], state.recent);
      const pctOf = (n: number) => d.spins ? `${((n / d.spins) * 100).toFixed(1)}%` : '—';
      const distTable = `<div class="table-scroll"><table class="stats-table"><thead><tr><th scope="col">Section</th><th scope="col">Landed</th><th scope="col">Share</th></tr></thead><tbody><tr><th scope="row">Red</th><td>${d.red}</td><td>${pctOf(d.red)}</td></tr><tr><th scope="row">Black</th><td>${d.black}</td><td>${pctOf(d.black)}</td></tr><tr><th scope="row">Green (0 and 00)</th><td>${d.green}</td><td>${pctOf(d.green)}</td></tr>${d.dozens.map((n, i) => `<tr><th scope="row">Dozen ${i + 1}</th><td>${n}</td><td>${pctOf(n)}</td></tr>`).join('')}${d.columns.map((n, i) => `<tr><th scope="row">Column ${i + 1}</th><td>${n}</td><td>${pctOf(n)}</td></tr>`).join('')}${d.evenMoney.map(e => `<tr><th scope="row">${escape(e.label)}</th><td>${e.count}</td><td>${pctOf(e.count)}</td></tr>`).join('')}</tbody></table></div>`;
      const hotCold = `<div class="detail-two-col"><div><h4>Hot numbers</h4><ol class="fact-list">${d.hot.map(h => `<li>${escape(h.label)} · ${h.count} times</li>`).join('')}</ol></div><div><h4>Cold numbers</h4><ol class="fact-list">${d.cold.map(h => `<li>${escape(h.label)} · ${h.count} times</li>`).join('')}</ol></div></div>`;
      const betTable = d.byBetType.length ? `<div class="table-scroll"><table class="stats-table"><thead><tr><th scope="col">Bet</th><th scope="col">Rounds</th><th scope="col">Wagered</th><th scope="col">Returned</th><th scope="col">Net</th></tr></thead><tbody>${d.byBetType.map(g => `<tr><th scope="row">${escape(g.label)}</th><td>${g.rounds}</td><td>${money(g.wagered)}</td><td>${money(g.returned)}</td><td>${netCell(g.net)}</td></tr>`).join('')}</tbody></table></div>` : '';
      body += detailSection(`Outcome distribution, last ${d.spins} spins`, distTable + hotCold, 'The wheel board keeps the last 300 spins on this device.')
        + detailSection('Results by bet', betTable, d.multiBetRounds ? `${d.multiBetRounds} recent round(s) combined several bets; the saved record has no amount per bet, so those rounds are counted in your totals but not split across bet types.` : '');
    } else if (game === 'baccarat') {
      const d = baccaratDrill(state.boards?.baccarat ?? [], state.recent);
      const pctOf = (n: number) => d.coups ? `${((n / d.coups) * 100).toFixed(1)}%` : '—';
      const distTable = `<div class="table-scroll"><table class="stats-table"><thead><tr><th scope="col">Winner</th><th scope="col">Coups</th><th scope="col">Share</th></tr></thead><tbody><tr><th scope="row">Player</th><td>${d.player}</td><td>${pctOf(d.player)}</td></tr><tr><th scope="row">Banker</th><td>${d.banker}</td><td>${pctOf(d.banker)}</td></tr><tr><th scope="row">Tie</th><td>${d.tie}</td><td>${pctOf(d.tie)}</td></tr></tbody></table></div>`;
      const streakFacts = `<div class="hub-balances detail-facts">${detailFact('Longest player run', String(d.longestPlayer))}${detailFact('Longest banker run', String(d.longestBanker))}${detailFact('Current run', d.current ? `${d.current.side === 'P' ? 'Player' : 'Banker'} × ${d.current.length}` : '—')}</div>`;
      const spotTable = d.bySpot.length ? `<div class="table-scroll"><table class="stats-table"><thead><tr><th scope="col">Spot bet</th><th scope="col">Rounds</th><th scope="col">Wagered</th><th scope="col">Returned</th><th scope="col">Net</th></tr></thead><tbody>${d.bySpot.map(g => `<tr><th scope="row">${escape(g.label)}</th><td>${g.rounds}</td><td>${money(g.wagered)}</td><td>${money(g.returned)}</td><td>${netCell(g.net)}</td></tr>`).join('')}</tbody></table></div>` : '';
      body += detailSection(`Shoe board, last ${d.coups} coups`, distTable + streakFacts, 'The board is the current shoe: it resets when the shoe is shuffled and keeps at most 150 coups.')
        + detailSection('Results by spot', spotTable, d.multiSpotRounds ? `${d.multiSpotRounds} recent round(s) bet several spots at once; the saved record has no amount per spot, so those rounds stay in your totals only.` : '');
    } else if (game === 'craps') {
      const d = crapsDrill(state.boards?.craps ?? [], state.recent);
      const sumTable = `<div class="table-scroll"><table class="stats-table"><thead><tr><th scope="col">Total</th><th scope="col">Rolled</th><th scope="col">Actual</th><th scope="col">Expected</th></tr></thead><tbody>${d.sums.map(s => `<tr><th scope="row">${s.sum}</th><td>${s.count}</td><td>${(d.rolls ? (s.count / d.rolls) * 100 : 0).toFixed(1)}%</td><td>${(s.expected * 100).toFixed(1)}%</td></tr>`).join('')}</tbody></table></div>`;
      const rollFacts = `<div class="hub-balances detail-facts">${detailFact('Rolls on the board', d.rolls.toLocaleString())}${detailFact('Sevens', `${d.sevens} (${d.rolls ? ((d.sevens / d.rolls) * 100).toFixed(1) : '0.0'}%)`, 'Expected 16.7%')}${detailFact('Doubles', String(d.doubles))}${detailFact('Hardways rolled', d.hard.map(h => `${h.sum}: ${h.count}`).join(' · '))}${detailFact('Best recorded roll', d.bestRoll ? signed(d.bestRoll.profit) : '—', d.bestRoll ? escape(d.bestRoll.result) : '')}</div>`;
      body += detailSection('Dice distribution', sumTable + rollFacts, 'The dice board keeps the last 600 rolls on this device. Expected shares are the exact 36-way dice math.')
        + `<p class="muted">Recent rounds on record: ${recent.length} (the game keeps the last 60), net ${signed(d.recentNet)}. Flagged gap: the saved round notes name the spots that settled but not the amount riding on each, so results by bet type cannot be split honestly.</p>`;
    } else {
      const d = racesDrill(state.recent, state.boards?.races ?? []);
      const raceFacts = `<div class="hub-balances detail-facts">${detailFact('Rounds on record', d.rounds.toLocaleString(), 'The game keeps the last 60')}${detailFact('Wagered', money(d.wagered))}${detailFact('Returned', money(d.returned))}${detailFact('Return on stakes', d.wagered ? `${((d.returned / d.wagered) * 100).toFixed(1)}%` : '—')}${detailFact('Rounds that paid', `${d.cashed} of ${d.rounds}`)}</div>`;
      const typeTable = d.byType.length ? `<div class="table-scroll"><table class="stats-table"><thead><tr><th scope="col">Bet</th><th scope="col">Rounds</th><th scope="col">Wagered</th><th scope="col">Returned</th><th scope="col">Net</th></tr></thead><tbody>${d.byType.map(g => `<tr><th scope="row">${escape(g.label)}</th><td>${g.rounds}</td><td>${money(g.wagered)}</td><td>${money(g.returned)}</td><td>${netCell(g.net)}</td></tr>`).join('')}</tbody></table></div>` : '';
      const freq = d.betFrequency.length ? `<p class="muted">How often each bet type appears in complete bet listings: ${d.betFrequency.map(f => `${escape(f.kind)} × ${f.rounds}`).join(' · ')}.</p>` : '';
      const best = d.bestWins.length ? `<ol class="fact-list">${d.bestWins.map(w => `<li>${escape(w.bet)} · ${escape(w.result)} · <b class="pos">+${money(w.profit)}</b></li>`).join('')}</ol>` : '';
      const winners = d.winners.length ? `<p class="muted">Winners board (last ${state.boards?.races?.length ?? 0} races): ${d.winners.map(w => `${escape(w.name)} × ${w.wins}`).join(' · ')}.</p>` : '';
      body += detailSection('Recent record', raceFacts)
        + detailSection('Results by bet', typeTable, (d.multiBetRounds ? `${d.multiBetRounds} recent round(s) combined several bets; the saved record has no amount per bet, so those rounds stay in your totals only. ` : '') + 'Flagged gap: the odds of each bet are not saved, so results cannot be split by odds band.')
        + freq + detailSection('Best wins on record', best) + winners;
    }
    return detailShell(label, 'The detailed record, from the rounds and boards this device keeps.', body);
  }
  function gameDetailView(): string {
    switch (detailGame) {
      case 'cash': return cashDetail();
      case 'heads-up': return headsUpDetail();
      case 'tournaments': return tournamentsDetail();
      case 'omaha': return omahaDetail();
      case 'blackjack': return blackjackDetail();
      case 'slots': return slotsDetail();
      default: return casinoDetail(detailGame);
    }
  }

  /** Patch 67: the home screen hub. */
  function homeView(): string {
    ensureTournament();
    const data = controller.data, t = tournament?.data, bj = blackjackLive.controller.data;
    if (!bj && blackjackLive.controller.status !== 'error') { blackjackLive.init(); if (!homeRetry) homeRetry = window.setTimeout(() => { homeRetry = 0; if (view === 'home') render(); }, 600); }
    const active = data?.active, heroStack = active?.game.seats.find(x => x.id === 0)?.stack ?? 0;
    const games: string[] = [];
    if (active) games.push(`<button type="button" class="home-card home-card-main" data-view="live"><span class="home-card-icon" aria-hidden="true">♠</span><b>Back to your table</b><span>${money(active.game.profile.smallBlind)}/${money(active.game.profile.bigBlind)} · ${money(heroStack)} in front of you</span></button>`);
    if (t?.active && t.active.status !== 'complete') games.push(`<button type="button" class="home-card" data-view="tournaments"><span class="home-card-icon" aria-hidden="true">♣</span><b>Back to your tournament</b><span>${t.active.status === 'running' ? 'Still in' : 'Watching'} · hand ${t.active.handNumber}</span></button>`);
    if (bj?.active) games.push(`<button type="button" class="home-card" data-view="blackjack"><span class="home-card-icon red-suit" aria-hidden="true">♥</span><b>Back to blackjack</b><span>${money(bj.active.engine.balance)} at the table</span></button>`);
    const start = active ? '' : `<button type="button" id="home-quick" class="home-card home-card-main"><span class="home-card-icon" aria-hidden="true">♠</span>${casinoGameArt('live')}<b>Quick game</b><span>$1/$2 · 9 seats · $300</span></button>`;
    /* Phase 7: the concept-board game grid. Each tile's art is a named slot in
     * public/casino-art (tile-*.webp) layered over a production fallback, so a
     * tile whose art has not landed yet still shows a rich casino image.
     * All seven generated tiles have landed and are wired in as WebP. */
    const tile = (o: { view?: View; attr?: string; id?: string; name: string; sub: string; art: string; pos?: string; wide?: boolean }) => `<button type="button" class="home-tile${o.wide ? ' wide' : ''}"${o.id ? ` id="${o.id}"` : ''}${o.attr ?? (o.view ? ` data-view="${o.view}"` : '')}><span class="home-tile-art" style="background-image:${o.art}${o.pos ? `;background-position:${o.pos}` : ''}" aria-hidden="true"></span><span class="home-tile-band"><b>${o.name}</b><small>${o.sub}</small></span></button>`;
    const tiles = [
      active ? tile({ view: 'live', name: 'Poker', sub: 'Texas Hold\u2019em · back to your table', art: `url('/casino-art/tile-poker.webp'),url('/casino-art/lobby-hero.webp')`, wide: true })
        : tile({ id: 'home-pick', name: 'Poker', sub: 'Texas Hold\u2019em · pick a table, choose your seat', art: `url('/casino-art/tile-poker.webp'),url('/casino-art/lobby-hero.webp')`, wide: true }),
      tile({ attr: ' data-view="slots"', name: 'Slots', sub: 'Thirteen unique virtual-chip machines', art: `url('/casino-art/tile-slots.webp')`, wide: true }),
      tile({ view: 'blackjack', name: 'Blackjack', sub: 'Count, bet, beat the shoe', art: `url('/casino-art/tile-blackjack.webp'),url('/casino-art/lobby-hero.webp')`, pos: 'right center', wide: true }),
      tile({ attr: ' data-view="baccarat"', name: 'Baccarat', sub: 'Player, Banker or Tie', art: `url('/casino-art/tile-baccarat.webp'),url('/casino-art/room-atmosphere.webp')` }),
      tile({ attr: ' data-view="roulette"', name: 'Roulette', sub: 'Single or double zero', art: `url('/casino-art/tile-roulette.webp'),url('/casino-art/room-atmosphere.webp')` }),
      tile({ attr: ' data-view="races"', name: 'Horse racing', sub: 'Win, place, show, exacta', art: `url('/casino-art/tile-horse-racing.webp'),url('/casino-art/horse-racing.webp')` }),
      tile({ attr: ' data-view="craps"', name: 'Craps', sub: 'You\u2019re the shooter', art: `url('/casino-art/tile-craps.webp'),url('/casino-art/room-atmosphere.webp')` }),
      tile({ view: 'tournaments', name: 'Tournaments', sub: 'Sit & gos to big fields', art: `url('/casino-art/tile-tournaments.webp'),url('/casino-art/lobby-hero.webp')` }),
      tile({ view: 'omaha', name: 'Omaha', sub: 'Four cards, pot limit', art: `url('/casino-art/tile-omaha.webp'),url('/casino-art/lobby-hero.webp')` }),
      tile({ view: 'heads-up', name: 'Heads-up', sub: 'Beat the regulars one on one', art: `url('/casino-art/tile-heads-up.webp'),url('/casino-art/lobby-hero.webp')` }),
      tile({ view: 'career', name: 'Career', sub: 'Climb the stakes, bankroll rules', art: `url('/casino-art/tile-career.webp'),url('/casino-art/room-atmosphere.webp')` }),
    ].join('');
    const featureStrip = `<div class="home-features"><div><b>Premium experience</b><small>Luxurious, immersive, unified</small></div><div><b>Real casino games</b><small>Seven game families, one floor</small></div><div><b>Tournaments &amp; career</b><small>Compete and climb the ranks</small></div><div><b>Practice, protected</b><small>Virtual chips only · no real money</small></div></div>`;
    const sessions = data?.sessions.filter(x => data.hands.some(h => h.sessionId === x.id)) ?? [];
    const last = sessions.at(-1), lastHands = last ? data!.hands.filter(h => h.sessionId === last.id) : [];
    const leaks = findLeaks(lastHands).slice(0, 2);
    const recent = data?.hands.slice(-500) ?? [], drills = recent.length ? buildDrills(recent, 10) : [];
    const day = Math.floor(Date.now() / 86400000), drill = drills.length ? drills[day % drills.length] : null;
    const biggest = lastHands.reduce<StoredHand | null>((best, h) => h.net > (best?.net ?? 0) ? h : best, null);
    const lastEvent = t ? tournamentStats(t).events.at(-1) : undefined;
    const highlights = [
      biggest ? `<li>Biggest pot last session: <b>+${money(biggest.net)}</b> <button type="button" class="chip-button" data-recap-hand="${escape(biggest.id)}">Hand ${biggest.number}</button></li>` : '',
      lastEvent ? `<li>Last tournament: <b>${ordinal(lastEvent.place)} of ${lastEvent.entrants}</b> in ${escape(lastEvent.name)}${lastEvent.prize > 0 ? ` · won ${money(lastEvent.prize)}` : ''}</li>` : '',
      data ? `<li>${(controller.totalHandCount ?? data.hands.length).toLocaleString()} cash hands played</li>` : '',
    ].join('');
    /* Phase 9 (fun #10): the heads-up ladder, surfaced on the front door. */
    const ladderState = readLadder(), nextIdx = nextRung(ladderState), nextOpp = nextIdx < LADDER_IDS.length ? regularById(LADDER_IDS[nextIdx]) : null;
    const huStrip = `<div class="hub-block"><h3>Heads-up ladder</h3><p>${ladderState.beaten.length} of ${LADDER_IDS.length} regulars beaten${nextOpp ? `. Next up: <b>${escape(nextOpp.name)}</b> — ${escape(nextOpp.style)}.` : '. The whole ladder is beaten. Rematch anyone.'}</p><button type="button" class="button secondary" data-view="heads-up">${nextOpp ? `Challenge ${escape(nextOpp.name)}` : 'Open the ladder'}</button></div>`;
    return `<section class="panel home-hub" data-testid="home-hub">
      ${casinoHomeHero()}
      <div class="hub-balances">${[['CASH BANKROLL', 'cash', data ? data.wallet + heroStack : null], ['TOURNAMENTS', 'tournament', t ? t.balance : null], ['BLACKJACK', 'blackjack', bj ? bj.balance + (bj.active?.engine.balance ?? 0) : null], ['OMAHA', 'omaha', (() => { const o = (plo ??= new PloTable()).state; return o.balance + (o.active?.stacks[0] ?? 0); })()], ['SLOTS', 'slots', slotsPlayer.state.balance], ['CASINO', 'casino', casino.state.balance]].map(([label, key, cents]) => `<div><span class="eyebrow">${label}</span><b ${cents === null ? '' : `data-count-key="home-${key}" data-count="${cents}"`}>${cents === null ? '—' : money(cents as number)}</b></div>`).join('')}</div><p class="hub-balances-note muted">Six games, six separate chip balances. Each stack belongs to its own game.</p>
      <div class="home-cards">${games.join('')}${start}</div><div class="home-tiles" id="home-game-collection">${tiles}</div>${featureStrip}${casinoFeaturedMachines()}
      <div class="hub-block">${career && data ? (() => { const st = careerStatus(data, career); return `<h3>Career · ${st.stake}</h3><p>${money(st.bankroll)} · ${Math.floor(st.buyIns)} buy-ins${st.nextStake ? ` · ${st.canMoveUp ? `<b>ready to move up to ${st.nextStake}</b>` : `next ${st.nextStake}: ${Math.min(100, Math.round(100 * st.bankroll / st.needBankroll!))}% of the bankroll, ${st.handsHere.toLocaleString()}/${MOVE_UP_HANDS} hands`}` : ''}${st.mustMoveDown ? ' · <b>time to move down</b>' : ''}</p><button type="button" class="button secondary" data-view="career">Open career</button>`; })() : `<h3>Career mode</h3><p class="muted">Start at $1/$2 and climb the stakes with bankroll rules.</p><button type="button" class="button secondary" data-view="career">Start a career</button>`}</div>
      ${drill ? `<div class="hub-block"><h3>Drill of the day</h3><p>${escape(drill.prompt)}</p><button type="button" class="button secondary" id="home-drill" data-drill-id="${escape(drill.id)}">Try it</button></div>` : ''}
      <div class="hub-block"><h3>Latest leaks</h3>${leaks.length ? `<ul class="hub-list">${leaks.map(l => `<li><b>${escape(l.title)}</b> <span class="muted">${escape(l.finding)}</span></li>`).join('')}</ul>` : `<p class="muted">${lastHands.length ? 'No clear leaks in your last session.' : 'Play a session to see your leaks here.'}</p>`}<button type="button" class="button secondary" data-view="coach">Leaks and drills</button></div>
      ${highlights ? `<div class="hub-block"><h3>Recent highlights</h3><ul class="hub-list">${highlights}</ul></div>` : ''}
      ${huStrip}
      ${dailyCardMarkup()}
      ${trophyRoomMarkup()}
      ${stylePanel()}
    </section>`;
  }
  function coachData() {
    const data = controller.data!, sessions = data.sessions.filter(session => data.hands.some(hand => hand.sessionId === session.id));
    if (!coachScope || (coachScope !== 'recent' && coachScope !== 'tournaments' && !sessions.some(x => x.id === coachScope))) coachScope = sessions.at(-1)?.id ?? 'recent';
    if (coachScope === 'tournaments' && !tournament?.data) coachScope = 'recent';
    const events = coachScope === 'tournaments' ? [...(tournament!.data!.completed ?? []), ...(tournament!.data!.active ? [tournament!.data!.active] : [])].slice(-20) : [];
    const hands = coachScope === 'tournaments' ? events.flatMap(tournamentCoachHands) : coachScope === 'recent' ? data.hands.slice(-500) : data.hands.filter(hand => hand.sessionId === coachScope);
    const key = `${coachScope}|${hands.length}|${hands.at(-1)?.id ?? ''}`;
    if (coachCache?.key !== key) {
      coachCache = coachScope === 'tournaments' ? { key, leaks: findTournamentLeaks(hands), drills: [...pushDrills(hands, 4), ...buildDrills(hands, 10)].slice(0, 10), hands } : { key, leaks: findLeaks(hands), drills: buildDrills(hands), hands };
      drillIndex = Math.min(drillIndex, Math.max(0, coachCache.drills.length - 1));
    }
    if (pendingDrillId) { const i = coachCache.drills.findIndex(d => d.id === pendingDrillId); if (i >= 0) drillIndex = i; pendingDrillId = ''; }
    return { sessions, ...coachCache };
  }
  function leakCards(leaks: readonly Leak[], max = leaks.length): string {
    if (!leaks.length) return `<p class="muted">No clear leaks in these hands. Each check needs a minimum number of spots before it says anything, so play more hands to see more.</p>`;
    return `<ol class="leak-list">${leaks.slice(0, max).map(leak => `<li class="leak"><div class="leak-head"><b>${escape(leak.title)}</b><span class="${leak.bb < 0 ? 'neg' : 'pos'}">${leak.bb > 0 ? '+' : ''}${leak.bb} BB</span></div><p>${escape(leak.finding)}</p><p class="muted">${escape(leak.guide)}</p><div class="leak-hands">${leak.handIds.slice(-8).map(id => { const cash = controller.data?.hands.find(h => h.id === id), hand = cash ?? coachCache?.hands.find(h => h.id === id); return hand ? `<button type="button" class="chip-button" ${cash ? 'data-recap-hand' : 'data-coach-replay'}="${escape(id)}">Hand ${hand.number}</button>` : ''; }).join('')}${leak.handIds.length > 8 ? `<span class="muted">+${leak.handIds.length - 8} more</span>` : ''}</div></li>`).join('')}</ol>`;
  }
  function drillMarkup(drills: readonly Drill[], hands: readonly StoredHand[]): string {
    if (!drills.length) return `<p class="muted">Drills come from hands where you faced a bet after the flop, or a 3-bet. None in these hands yet.</p>`;
    const d = drills[drillIndex], picked = drillPicks.get(d.id);
    if (picked && !drillAnswerCache.has(d.id)) drillAnswerCache.set(d.id, answerDrill(d, hands));
    const answers = drills.filter(x => drillPicks.has(x.id));
    const matched = answers.filter(x => { const a = drillAnswerCache.get(x.id); return a && (drillPicks.get(x.id) === a.best || a.close && (x.push || drillPicks.get(x.id) !== 'raise')); }).length;
    const label = (c: DrillChoice) => c === 'fold' ? 'Fold' : c === 'call' ? 'Call' : d.push ? 'Shove' : 'Raise';
    let result = '';
    if (picked) {
      const a = drillAnswerCache.get(d.id) ?? answerDrill(d, hands); drillAnswerCache.set(d.id, a);
      const ok = picked === a.best || (a.close && (d.push || picked !== 'raise'));
      const happened = d.push ? '' : d.shown ? `${escape(d.villain.name)} showed ${d.shown.map(c => card(c, 'small')).join('')} ${escape(d.shownLabel ?? '')}.` : 'Their cards were not shown.';
      result = `<div class="drill-result ${ok ? 'right' : 'wrong'}" role="status"><b>${ok ? 'Good choice.' : `The guide prefers ${label(a.best)}.`}</b><p>${escape(a.why)}</p><p>In the hand you chose <b>${label(d.did)}</b>. ${happened} You ${d.net >= 0 ? 'won' : 'lost'} ${Math.abs(Math.round(10 * d.net / d.bb) / 10)} BB in the hand.</p><div class="drill-nav"><button type="button" class="button secondary" ${coachScope === 'tournaments' ? 'data-coach-replay' : 'data-recap-hand'}="${escape(d.handId)}">Replay hand</button>${drillIndex < drills.length - 1 ? `<button type="button" class="button" id="drill-next">Next drill</button>` : `<button type="button" class="button secondary" id="drill-restart">Start again</button>`}</div></div>`;
    }
    return `<div class="drill" data-testid="spot-drill"><div class="drill-top"><span class="eyebrow">DRILL ${drillIndex + 1} OF ${drills.length} · HAND ${d.number}</span>${answers.length ? `<span class="muted">${matched} of ${answers.length} matched the guide</span>` : ''}</div>
      <p class="drill-who">You are ${escape(d.position)} with</p><div class="drill-cards">${d.hole.map(c => card(c)).join('')}</div>
      ${d.board.length ? `<p class="drill-who">Board</p><div class="drill-cards board">${d.board.map(c => card(c, 'small')).join('')}</div>` : ''}
      <p class="drill-prompt">${escape(d.prompt)}</p>${d.push ? '' : `<p class="muted">${escape(d.villain.name)} (${escape(d.villain.position)}) has played ${escape(d.villain.style)}.</p>`}
      <div class="drill-choices${d.push ? ' two' : ''}" role="group" aria-label="Your decision">${((d.push ? ['fold', 'raise'] : ['fold', 'call', 'raise']) as DrillChoice[]).map(c => `<button type="button" class="button ${picked === c ? '' : 'secondary'}" data-drill-choice="${c}" ${picked || (c === 'raise' && !d.canRaise) ? 'disabled' : ''}>${label(c)}</button>`).join('')}</div>${result}</div>`;
  }
  /** Patch 66: the leak measures session by session, so you can see whether you are fixing them. */
  function trendMarkup(): string {
    const data = controller.data!, sessions = data.sessions.filter(x => data.hands.some(h => h.sessionId === x.id));
    const trends = leakTrends(data.hands, sessions).filter(t => t.points.length >= 2);
    if (!trends.length) return `<p class="muted">Trends appear once you have two or more sessions with enough hands in each spot.</p>`;
    return `<ul class="trend-list">${trends.map(({ metric, points }) => {
      const W = 120, H = 34, max = Math.max(100, ...points.map(p => p.value)), y = (v: number) => H - 3 - (v / max) * (H - 6), x = (i: number) => points.length === 1 ? W / 2 : 4 + i * (W - 8) / (points.length - 1);
      const last = points.at(-1)!, inBand = last.value >= metric.low && last.value <= metric.high, first = points[0].value;
      const better = Math.abs(last.value - (metric.low + metric.high) / 2) < Math.abs(first - (metric.low + metric.high) / 2);
      const unit = metric.id === 'limp' ? '' : '%';
      return `<li class="trend"><div><b>${escape(metric.label)}</b><span class="muted">${points.slice(-4).map(p => `${p.value}${unit}`).join(' → ')} · target ${metric.low}–${metric.high}${unit}${metric.id === 'limp' ? ' per 100 hands' : ''}</span></div><svg viewBox="0 0 ${W} ${H}" width="${W}" height="${H}" role="img" aria-label="${escape(metric.label)}: ${points.map(p => p.value).join(', ')}"><rect x="0" y="${y(metric.high)}" width="${W}" height="${Math.max(1, y(metric.low) - y(metric.high))}" class="trend-band"/><polyline points="${points.map((p, i) => `${x(i)},${y(p.value)}`).join(' ')}" class="trend-line"/>${points.map((p, i) => `<circle cx="${x(i)}" cy="${y(p.value)}" r="2.5" class="trend-dot"/>`).join('')}</svg><span class="trend-verdict ${inBand ? 'ok' : better ? 'up' : 'off'}">${inBand ? 'On target' : better ? 'Improving' : 'Off target'}</span></li>`;
    }).join('')}</ul>`;
  }
  /** Patch 87: every tell the computer players give, and what it usually means. */
  function tellGuideMarkup(): string {
    return `<details class="tell-guide" data-testid="tell-guide"><summary>Reading tells</summary><p class="muted">Weaker players give more tells and give them honestly. Good players give few, and some of theirs are an act. A tell is a nudge, never proof.</p><table><thead><tr><th>Tell</th><th>Usually means</th><th>When</th></tr></thead><tbody>${TELL_GUIDE.map(t => `<tr><td>${escape(t.tell)}</td><td>${escape(t.usually)}</td><td>${escape(t.when)}</td></tr>`).join('')}</tbody></table></details>`;
  }
  /** Patch 89: deep stats for you and every player you have sat with. Saved cash hands only. */
  let deepCache: { key: string; players: Map<string, PlayerStats>; extras: ReturnType<typeof heroExtras> } | null = null;
  function deepData() {
    const d = controller.data!, key = `${d.hands.length}:${d.hands.at(-1)?.id ?? ''}:${d.sessions.length}`;
    if (deepCache?.key !== key) deepCache = { key, players: deepStats(d.hands), extras: heroExtras(d.hands, d.sessions) };
    return deepCache;
  }
  const rateCell = (label: string, x: Count, tip: string) => { const v = countPct(x); return `<div class="deep-rate${x.of && x.of < 20 ? ' thin' : ''}" title="${escape(tip)}"><dt>${label}</dt><dd>${v === null ? '—' : `${v.toFixed(0)}%`}</dd><small>${x.count}/${x.of}</small></div>`; };
  function playerRates(p: PlayerStats): string {
    const af = aggressionFactor(p), afq = aggressionFrequency(p);
    return `<dl class="deep-grid">${rateCell('VPIP', p.vpip, 'Put money in voluntarily before the flop')}${rateCell('PFR', p.pfr, 'Raised before the flop')}${rateCell('3-bet', p.threeBet, 'Re-raised a single raise before the flop')}${rateCell('4-bet', p.fourBet, 'Raised again after opening and being re-raised')}${rateCell('Fold to 3-bet', p.foldToThreeBet, 'Opened, got re-raised, folded')}${rateCell('Limp', p.limp, 'Just called the big blind as the first player in')}${rateCell('Cold call', p.coldCall, 'Called a raise without money in already')}${rateCell('Steal', p.steal, 'Opened from the cutoff, button or small blind when folded to')}${rateCell('Fold to steal', p.foldToSteal, 'In a blind, folded to a late-position open')}${rateCell('Saw flop', p.sawFlop, 'Hands that reached the flop with them in it')}${rateCell('C-bet', p.cbet, 'Bet the flop after raising before it')}${rateCell('Turn barrel', p.turnBarrel, 'Bet the turn again after a flop c-bet')}${rateCell('Donk bet', p.donk, 'Led into the preflop raiser on the flop')}${rateCell('Fold to c-bet', p.foldToCbet, 'Folded to a flop c-bet')}${rateCell('Check-raise', p.checkRaise, 'Checked, then raised a bet on the same street')}<div class="deep-rate"><dt>Aggression</dt><dd>${af === null ? '—' : af === Infinity ? '∞' : af.toFixed(1)}</dd><small>bets per call</small></div><div class="deep-rate"><dt>Aggression %</dt><dd>${afq === null ? '—' : `${afq.toFixed(0)}%`}</dd><small>of postflop actions</small></div>${rateCell('WTSD', p.wtsd, 'Went to showdown after seeing the flop')}${rateCell('W$SD', p.wsd, 'Won money at showdown')}${rateCell('WWSF', p.wwsf, 'Won the pot after seeing the flop')}</dl>`;
  }
  function deepStatsView(): string {
    const d = controller.data;
    if (!d) return '';
    if (game && game.street !== 'complete') return `<section class="panel deep-stats"><span class="eyebrow">BETWEEN HANDS</span><h2>Finish the current hand first.</h2><p>Stats read finished hands only.</p></section>`;
    const older = controller.historyLoaded ? '' : `<p class="muted">Older hands are archived. <button id="load-older-history" class="button secondary" ${unavailable() ? 'disabled' : ''}>Load older hands</button></p>`;
    const { players, extras: x } = deepData(), me = players.get('You');
    if (!me || !me.hands) return `<section class="panel deep-stats" data-testid="deep-stats"><h2>No hands yet</h2><p>Play some cash hands and your numbers will appear here.</p></section>`;
    const luck = x.allIn, diff = luck.actual - luck.expected;
    const group = (g: { key: string; hands: number; net: number; bb: number }) => `<tr><td>${escape(g.key)}</td><td>${g.hands}</td><td class="${g.net > 0 ? 'positive' : g.net < 0 ? 'negative' : ''}">${signed(g.net)}</td><td>${(100 * g.bb / g.hands).toFixed(1)}</td></tr>`;
    const others = [...players.values()].filter(p => p.name !== 'You' && p.hands >= 10).sort((a, b) => b.hands - a.hands).slice(0, 40);
    const v = (n: number | null) => n === null ? '—' : `${n.toFixed(0)}%`;
    return `<section class="panel deep-stats" data-testid="deep-stats"><span class="eyebrow">CASH · ${me.hands} HANDS · ALL SESSIONS</span><h2>Your numbers</h2>${older}<p class="muted">Counts from your saved cash hands. Faded numbers have fewer than 20 chances, so read them lightly. Hover or long-press a number for what it counts.</p>${playerRates(me)}
    <h3>Where the money comes from</h3><dl class="deep-money"><div><dt>Won at showdown</dt><dd class="${me.showdownNet >= 0 ? 'positive' : 'negative'}">${signed(me.showdownNet)}</dd></div><div><dt>Won without showdown</dt><dd class="${me.nonShowdownNet >= 0 ? 'positive' : 'negative'}">${signed(me.nonShowdownNet)}</dd></div><div><dt>Biggest pot won</dt><dd class="positive">${signed(me.biggestWin)}</dd></div><div><dt>Biggest pot lost</dt><dd class="negative">${signed(me.biggestLoss)}</dd></div><div><dt>Longest winning run</dt><dd>${x.streakWin} hand${x.streakWin === 1 ? '' : 's'}</dd></div><div><dt>Longest losing run</dt><dd>${x.streakLose} hand${x.streakLose === 1 ? '' : 's'}</dd></div><div><dt>Best session</dt><dd>${x.bestSession === null ? '—' : signed(x.bestSession)}</dd></div><div><dt>Worst session</dt><dd>${x.worstSession === null ? '—' : signed(x.worstSession)}</dd></div></dl>
    <h3>All-in luck</h3><div class="allin-luck" data-testid="allin-luck">${luck.spots ? `<p>In <b>${luck.spots}</b> all-in${luck.spots === 1 ? '' : 's'} where both hands were shown before the river, you had on average <b>${(100 * (luck.avgEquity ?? 0)).toFixed(0)}%</b> to win. You were expected to win about <b>${luck.expectedWins.toFixed(1)}</b> of them and won <b>${luck.won}</b>.</p><dl class="deep-money"><div><dt>Expected result</dt><dd>${signed(Math.round(luck.expected))}</dd></div><div><dt>Actual result</dt><dd>${signed(luck.actual)}</dd></div><div><dt>Luck</dt><dd class="${diff >= 0 ? 'positive' : 'negative'}">${signed(Math.round(diff))}</dd></div></dl><p class="muted">${Math.abs(diff) < 1 ? 'Right on expectation.' : diff > 0 ? 'You have run above expectation in all-ins.' : 'You have run below expectation in all-ins. Over a big sample this evens out; the deal is fair.'}</p>` : '<p class="muted">No all-ins with both hands shown yet.</p>'}</div>
    <h3>Starting hands</h3><div class="table-scroll"><table class="deep-table"><thead><tr><th>Group</th><th>Hands</th><th>Result</th><th>bb/100</th></tr></thead><tbody>${x.groups.map(group).join('')}</tbody></table></div>
    ${x.best.length ? `<div class="deep-two"><div><h4>Best hands <small class="muted">(3+ times)</small></h4><table class="deep-table"><tbody>${x.best.map(group).join('')}</tbody></table></div><div><h4>Worst hands</h4><table class="deep-table"><tbody>${x.worst.map(group).join('')}</tbody></table></div></div>` : ''}
    ${x.straddled.hands ? `<h3>Straddled pots</h3><p>${x.straddled.hands} hands with a straddle (${x.straddled.yours} yours): <b class="${x.straddled.net >= 0 ? 'positive' : 'negative'}">${signed(x.straddled.net)}</b>, ${(100 * x.straddled.bb / x.straddled.hands).toFixed(1)} bb/100.</p>` : ''}
    <h3>The players you sit with</h3><p class="muted">Everyone with 10 or more hands beside you, from their public actions only. Their result is what they won or lost in those hands.</p>${others.length ? `<div class="table-scroll"><table class="deep-table deep-players" data-testid="deep-players"><thead><tr><th>Player</th><th>Hands</th><th>VPIP</th><th>PFR</th><th>3-bet</th><th>Aggr.</th><th>C-bet</th><th>Fold to c-bet</th><th>WTSD</th><th>W$SD</th><th>Result</th></tr></thead><tbody>${others.map(p => { const af = aggressionFactor(p); return `<tr><td><b>${escape(p.name)}</b></td><td>${p.hands}</td><td>${v(countPct(p.vpip))}</td><td>${v(countPct(p.pfr))}</td><td>${v(countPct(p.threeBet))}</td><td>${af === null ? '—' : af === Infinity ? '∞' : af.toFixed(1)}</td><td>${v(countPct(p.cbet))}</td><td>${v(countPct(p.foldToCbet))}</td><td>${v(countPct(p.wtsd))}</td><td>${v(countPct(p.wsd))}</td><td class="${p.net > 0 ? 'positive' : p.net < 0 ? 'negative' : ''}">${signed(p.net)}</td></tr>`; }).join('')}</tbody></table></div>` : '<p class="muted">Nobody yet with 10 hands beside you.</p>'}
    <p class="muted">Virtual chips. Descriptive counts, not predictions or solver advice.</p></section>`;
  }
  function coachView(): string {
    if (game && game.street !== 'complete') return `<section class="panel coach"><span class="eyebrow">BETWEEN HANDS</span><h2>Finish the current hand first.</h2><p>Leaks and drills read finished hands only.</p></section>`;
    if (!controller.historyLoaded) return `<section class="panel coach"><h2>Load saved hands</h2><p>Older hands are archived. Load them to look for leaks across sessions.</p><button id="load-older-history" class="button secondary" ${unavailable() ? 'disabled' : ''}>Load older hands</button></section>`;
    const { sessions, leaks, drills, hands } = coachData();
    const coachHand = coachScope === 'tournaments' ? hands.find(h => h.id === replayId) : undefined;
    const coachReplay = coachHand ? replay({ ...coachHand, imported: false, originLabel: 'Tournament hand' } as ReviewHand) : '';
    const options = [...sessions].reverse().map((x, i) => `<option value="${escape(x.id)}" ${x.id === coachScope ? 'selected' : ''}>${i === 0 ? 'Latest session' : `Session started ${escape(new Date(x.startedAt).toLocaleDateString())}`} (${controller.data!.hands.filter(h => h.sessionId === x.id).length} hands)</option>`).join('');
    return `${coachReplay}<section class="panel coach" data-testid="coach"><span class="eyebrow">YOUR OWN HANDS</span><h2>Leak finder</h2>
      <label class="style-select" for="coach-scope">Hands<select id="coach-scope">${options}<option value="recent" ${coachScope === 'recent' ? 'selected' : ''}>Your last 500 cash hands</option>${tournament?.data ? `<option value="tournaments" ${coachScope === 'tournaments' ? 'selected' : ''}>Tournaments (your last 20 events)</option>` : ''}</select></label>
      <p class="muted">${hands.length} hands. Worst first, by what the spot cost you. Tap a hand to replay it. The guide numbers are rough targets for solid play${coachScope === 'tournaments' ? '; shove and call lines follow a push/fold chart and do not model pay jumps' : ''}.</p>${leakCards(leaks)}
      <h2>Are you fixing them? (cash)</h2><p class="muted">Each measure per session, oldest to newest, against its rough target band.</p>${trendMarkup()}
      <h2>Spot drills</h2><p class="muted">Decisions you faced, asked again with what you knew then. The guide compares your chance to win against a range for that player, built only from how they played this session, with the price of the call. It is a guide, not a solver.</p>${drillMarkup(drills, hands)}${tellGuideMarkup()}</section>`;
  }
  function opponentStudy():string {
    if(game && game.street!=='complete')return `<section class="panel opponent-study" data-testid="opponent-study-locked"><span class="eyebrow">STUDY IS BETWEEN HANDS</span><h2>Finish the current hand first.</h2><p>Opponent study is available only after settlement. The current hand continues unchanged; return to the table to complete it.</p><button id="back-live" class="button primary">Return to current hand</button></section>`;
    if(!controller.historyLoaded)return `<section class="panel opponent-study"><h2>Load saved observations</h2><p>Older public observations are archived. Load and verify them before reviewing previous sessions.</p><button id="load-older-history" class="button secondary" ${unavailable()?'disabled':''}>Load and verify all older hands</button><p role="status">${controller.historyLoading?'Verifying archived hands…':''}</p></section>`;
    const sessions=(controller.data?.sessions ?? []).filter(session=>(controller.data?.hands ?? []).some(hand=>hand.sessionId===session.id)).slice().reverse();
    const selected=sessions.find(session=>session.id===opponentStudySession) ?? sessions[0];
    if(selected)opponentStudySession=selected.id;
    const memory=selected?buildOpponentMemory(publicMemoryHands(controller.data!.hands,selected.id,0),0,1):{windowHands:0,opponents:[]};
    const mayReveal=!!selected&&!!controller.data&&canRevealSessionStyles(controller.data,selected.id);
    const revealed=mayReveal&&revealedStyleSession===selected!.id?recordedSessionStyles(controller.data!,selected!.id):null;
    const insight=selected?`<section class="post-session-insight" data-testid="post-session-insight"><h3>Optional post-session style insight</h3><p>Ordinary observations above do not disclose styles. After all tables are ended and cashed out, you can opt in to recorded starting styles for Unknown and unchanged Random seats. This never reveals private parameters, hidden cards or decision logic.</p>${mayReveal?`<button class="button secondary" id="reveal-session-styles" data-session-insight="${escape(selected.id)}">${revealed?'Hide recorded starting styles':'Reveal recorded starting styles'}</button>`:'<p>End and cash out the session first. Styles remain concealed while any table is seated.</p>'}${revealed?`<div data-testid="revealed-session-styles">${revealed.length?revealed.map(row=>`<p data-insight-seat="${row.seatId}"><b>${escape(seatName(row.seatId,controller.data?.hands.find(hand=>hand.sessionId===selected!.id)?.view))}</b>: ${escape(OPPONENT_LABELS[row.archetype])} <small>DESIGNED · recorded starting style</small></p>`).join(''):'<p>No qualifying original style records are available.</p>'}<p class="muted">Read-only first-hand metadata. Later profile changes are not inferred. Historical Random choices that cannot be matched to their original recorded identity remain unavailable.</p></div>`:''}</section>`:'';
    return `<section class="panel opponent-study" data-testid="opponent-study"><span class="eyebrow">COMPLETED PUBLIC ACTIONS ONLY</span><h2>Opponent study</h2><p>Review what opponents actually did in completed hands. Ordinary observations do not reveal profiles, skills, internal parameters, hidden styles or decision logic. A separate optional style-only insight is available after cashout. Imported study hands are excluded.</p>${selected?`<label class="opponent-study-filter" for="opponent-study-session">Session<select id="opponent-study-session">${sessions.map(session=>`<option value="${escape(session.id)}" ${session.id===selected.id?'selected':''}>${escape(new Date(session.startedAt).toLocaleString())} · ${money(session.profile.smallBlind)} / ${money(session.profile.bigBlind)} · ${session.settings.seats} seats</option>`).join('')}</select></label>${observedOpponentCards(memory,NAMES)}${insight}`:'<p>No completed hands yet. Play a hand to start a public observation sample.</p><button id="back-live" class="button primary">Back to table</button>'}<details><summary>Observation definitions and limits</summary><ul><li>Each frequency shows its exact action or hand opportunity count. No opportunity is shown as a dash.</li><li>VPIP / preflop raise: denominator is a hand with at least one actual preflop decision. VPIP counts positive calls or raises; PFR counts raises. Blind posts and forced all-ins without a decision do not count.</li><li>Aggressive actions: postflop raises divided by all actual postflop decisions (fold, check, call or raise). Fold facing a bet: postflop folds facing a positive unmatched wager divided by actual postflop decisions facing that wager; free checks are excluded.</li><li>Only the latest 120 completed canonical hands in one session are considered. Seats from different sessions are not combined.</li><li>Showdown samples contain only cards publicly revealed by the engine. Unknown styles remain concealed unless you explicitly opt into the separate post-session insight after cashout.</li></ul><p>Synthetic opponents are not human-validated. These descriptive observations are not solver advice, EV or predictions of real-poker performance.</p></details></section>`;
  }
  function replay(hand:ReviewHand):string {
    replayFrame = Math.max(0, Math.min(replayFrame, hand.frames.length - 1));
    if (replayPlaying && replayFrame >= hand.frames.length - 1) replayPlaying = false;
    const frame = hand.frames[replayFrame] ?? hand.view;
    const draw = { card, money, esc: escape };
    const log = replayLog(hand.frames).filter(e => e.event.type === 'action' || e.event.type === 'street' || e.event.type === 'award' || e.event.type === 'blind');
    const nameOf = (id?: number) => id === undefined ? '' : id === 0 ? 'You' : hand.view.seats.find(seat => seat.id === id)?.name ?? `Seat ${id}`;
    const line = (e: LogEntry) => e.event.type === 'street' ? `${title(e.event.street ?? '')}${e.event.cards?.length ? ': ' + e.event.cards.map(c => c[0] === 'T' ? '10' + c[1] : c).join(' ') : ''}` : actorLine(nameOf(e.event.seatId), eventDescription(e.event));
    const jumps = streetJumps(hand.frames);
    const spot = heroSpot(hand.frames, replayFrame);
    const spotBox = spot ? `<p class="rp-spot" data-testid="replay-spot"><b>Your decision.</b> ${spot.toCall > 0 ? `${money(spot.toCall)} to call into ${money(spot.pot)}: you need ${(100 * spot.potOdds!).toFixed(0)}% equity.` : `Checked to you; pot ${money(spot.pot)}.`} Stack-to-pot ${spot.spr.toFixed(1)}.${spot.choice ? ` You chose to <b>${escape(spot.choice)}</b>.` : ''}</p>` : '';
    return `<section class="replay-panel" data-testid="hand-replay"><div class="section-heading"><div><span class="eyebrow">READ-ONLY REPLAY</span><h2>Hand ${hand.number} · ${title(frame.street)}</h2><p data-testid="replay-step">Step ${replayFrame + 1} / ${hand.frames.length} · live table and wallet are unchanged.</p><p data-testid="replay-provenance" style="overflow-wrap:anywhere">${provenance(hand.view.profile,hand.policyVersions)}</p><p data-testid="replay-origin">${escape(hand.originLabel)}</p></div><button class="button secondary" id="close-replay">Close replay</button></div>
      <div class="rp-jumps" role="group" aria-label="Jump to street">${jumps.map(j => `<button type="button" class="rp-jump${frame.street === j.street ? ' current' : ''}" data-replay-step="${j.frame}">${j.label}</button>`).join('')}</div>
      ${miniTable(frame, draw)}
      <p class="muted rp-last">${frame.street === 'complete' ? `Awarded ${money(Object.values(frame.payouts).reduce((sum,n) => sum+n,0))}` : `Pot ${money(frame.pot)}`} · ${frame.events.length ? escape(eventDescription(frame.events.at(-1)!)) : 'Hand begins'}</p>${spotBox}
      <div class="replay-controls"><button class="button secondary" id="replay-first" ${replayFrame === 0 ? 'disabled' : ''}>Start</button><button class="button secondary" id="replay-prev" ${replayFrame === 0 ? 'disabled' : ''}>Previous</button><button class="button secondary" id="replay-play" ${replayFrame >= hand.frames.length - 1 && !replayPlaying ? 'disabled' : ''}>${replayPlaying ? 'Pause' : 'Play'}</button><button class="button primary" id="replay-next" ${replayFrame >= hand.frames.length - 1 ? 'disabled' : ''}>Next action</button><button class="button secondary" id="replay-last" ${replayFrame >= hand.frames.length - 1 ? 'disabled' : ''}>Settlement</button></div>
      <ol class="rp-log" data-testid="replay-log">${log.map(e => `<li class="${e.frame > replayFrame ? 'future' : e.frame === replayFrame ? 'now' : ''}${e.event.type === 'street' ? ' street' : ''}"><button type="button" data-replay-step="${e.frame}">${escape(line(e))}</button></li>`).join('')}</ol>
      <div class="rp-share"><button class="button secondary" id="replay-image">Save picture</button>${typeof navigator !== 'undefined' && 'share' in navigator ? '<button class="button secondary" id="replay-share">Share…</button>' : ''}${replayShareNote ? `<span class="muted" role="status">${escape(replayShareNote)}</span>` : ''}</div>
      <details class="rp-text"><summary>Seats as text</summary><div class="replay-board">${frame.board.length ? frame.board.map(c => card(c)).join('') : '<span class="muted">Community cards have not been dealt</span>'}</div><div class="replay-seats">${frame.seats.map(seat => `<article><b>${escape(seat.name)} ${frame.button === seat.id ? '· D' : ''}</b><span>${card(seat.hole[0], 'small-card')}${card(seat.hole[1], 'small-card')}</span><small>${money(seat.stack)} · ${seat.folded ? 'Folded' : frame.actor === seat.id ? 'Acting' : 'Waiting'}</small></article>`).join('')}</div></details></section>`;
  }
  /** Patch 71: the hand as a picture, for the current step. */
  async function replayPicture(share: boolean): Promise<void> {
    const hand = currentReplayHand(); if (!hand) return;
    const frame = hand.frames[replayFrame] ?? hand.view;
    const nameOf = (id?: number) => id === undefined ? '' : id === 0 ? 'You' : hand.view.seats.find(seat => seat.id === id)?.name ?? `Seat ${id}`;
    const lines: { text: string; bold?: boolean }[] = [];
    for (const e of replayLog(hand.frames).filter(x => x.frame <= replayFrame)) {
      if (e.event.type === 'street') lines.push({ text: `${title(e.event.street ?? '')}${e.event.cards?.length ? ': ' + e.event.cards.join(' ') : ''}`, bold: true });
      else if (e.event.type === 'action' || e.event.type === 'award') lines.push({ text: actorLine(nameOf(e.event.seatId), eventDescription(e.event)) });
    }
    const blob = await replayImage(frame, `Hand ${hand.number} · ${money(frame.profile.smallBlind)}/${money(frame.profile.bigBlind)} · ${hand.net >= 0 ? '+' : ''}${money(hand.net)}`, lines.slice(-24), money);
    if (!blob) { replayShareNote = 'Pictures are not available in this browser.'; render(); return; }
    const name = `poker-night-ai-hand-${hand.number}.png`;
    if (share && 'share' in navigator) {
      const file = new File([blob], name, { type: 'image/png' }); const nav = navigator as Navigator & { canShare?: (d: unknown) => boolean };
      if (!nav.canShare || nav.canShare({ files: [file] })) { try { await navigator.share({ files: [file], title: `Hand ${hand.number}` }); replayShareNote = ''; render(); return; } catch { /* cancelled: fall back to saving */ } }
    }
    const url = URL.createObjectURL(blob); const a = document.createElement('a'); a.href = url; a.download = name; document.body.append(a); a.click(); a.remove(); setTimeout(() => URL.revokeObjectURL(url), 10000);
    replayShareNote = `Saved ${name}.`; render();
  }
  function currentReplayHand(): ReviewHand | undefined { return allReviewHands().find(hand => hand.id === replayId) ?? (coachCache?.hands.find(hand => hand.id === replayId) as ReviewHand | undefined); }
  function render() { return timed('ui.render',renderBody); }
  function renderBody() {
    if (!landed && controller.data && controller.status === 'ready') { landed = true; if (view === 'live' && !controller.data.active && controller.data.hands.length > 0) view = 'home'; }
    if (view !== 'by-game' && (blackjackRounds.state === 'ready' || blackjackRounds.state === 'error')) blackjackRounds.state = 'idle';
    if (view !== 'slots' && slotsUi.phase !== 'idle' && slotsUi.phase !== 'done') slotsPlayer.finishNow();
    if (view !== casinoShown && casinoShown) casino.finishNow();
    casinoShown = view === 'roulette' || view === 'craps' || view === 'baccarat' || view === 'races' ? view : '';
    if(view !== 'live')gamesMenuOpen=false;
    if(controller.status==='deleted'){
      content.innerHTML=deletedPracticeMarkup(operation||controller.busy,error||controller.error).replace('</section></main>',`<section class="panel cashier-panel backup-panel" data-testid="backup-controls">${backupState.problem?`<p class="error-banner" role="alert">${escape(backupState.problem)}</p>`:''}${restoreMarkup(backupState,!!backupBlocked())}</section></section></main>`);
      wireBackup();
      announcement.textContent='Saved practice data deleted. No new bankroll has been created.';
      try { localStorage.removeItem(PACE_KEY); localStorage.removeItem(AUTO_DEAL_KEY); } catch { /* preference only */ }
      autoDeal = false; cancelAutoDeal();
      root.querySelector('#start-fresh-practice')?.addEventListener('click',()=>{void run(async()=>{await controller.startFreshPracticeData();if(controller.error)throw new Error(controller.error);settings=initializeOpponentSettings(structuredClone(DEFAULT_SETTINGS));view='live';});});
      return;
    }
    const expandedSetupDetails=view==='host'&&!discardSetupDraft?Array.from(root.querySelectorAll<HTMLDetailsElement>('#setup-form details[id][open]')).map(details=>details.id):[];
    const setupDrafts = view==='host'&&!discardSetupDraft ? Array.from(root.querySelectorAll<HTMLInputElement|HTMLSelectElement>('#setup-form input, #setup-form select')).filter(input=>input.id).map(input=>({id:input.id,value:input.value,checked:input instanceof HTMLInputElement?input.checked:undefined})) : [];
    discardSetupDraft=false;
    if (view !== lastAnimView) { viewSwitches++; lastAnimView = view; }
    // Patch 53: a cash session that just ended (by Cash out or an automatic end) gets a summary card.
    const activeSession = controller.data?.active?.sessionId ?? '';
    if (lastActiveSession && !activeSession && controller.data && controller.status === 'ready') cashOutSummary = summarizeSession(controller.data, lastActiveSession);
    if (activeSession) cashOutSummary = null;
    trendBase = controller.data && activeSession ? stackBaselines(controller.data, activeSession) : null;
    // Patch 58: when a street ends, the bets that were in front of players sweep into the pot.
    if (game && lastBets && lastBets.handId === game.handId && lastBets.street !== game.street && lastBets.bets.length) sweep = { key: `${game.handId}:${game.street}`, bets: lastBets.bets };
    else if (!game || (sweep && !sweep.key.startsWith(`${game.handId}:`))) sweep = null;
    lastBets = game ? { handId: game.handId, street: game.street, bets: game.seats.filter(seat => seat.streetCommitted > 0).map(seat => ({ id: seat.id, amount: seat.streetCommitted })) } : null;
    if (controller.data) lastActiveSession = activeSession;
    // Patch 54: tournament milestones reached during this event.
    const tView = tournament?.view, tEvent = tournament?.data?.active;
    if (tView && tEvent) {
      const flags = tournamentFlags(tView);
      const moment = eventMilestone(tournamentFlagState?.id === tEvent.id ? tournamentFlagState.flags : null, flags, tView, money);
      if (moment) { eventMoment = { hand: tEvent.handNumber, markup: momentMarkup(moment, `${tEvent.id}:${tEvent.handNumber}:${moment.title}`) }; if (style.sound && tournamentFlagState?.id === tEvent.id) playSound(moment.title === 'Champion' ? 'champion' : moment.kind === 'bust' ? 'knockout' : 'money'); }
      else if (eventMoment && tEvent.handNumber > eventMoment.hand) eventMoment = null;
      // Patch 83: a chime when the blinds go up.
      const level = tView.current.level; if (style.sound && lastLevel?.id === tEvent.id && level > lastLevel.level) playSound('levelup', .2); lastLevel = { id: tEvent.id, level };
      tournamentFlagState = { id: tEvent.id, flags };
    } else { tournamentFlagState = null; eventMoment = null; }
    // Preserve unsubmitted sizes only while the authoritative betting decision
    // is unchanged. Clock saves can rerender, but a new hand/action cannot inherit
    // an unapplied proposal from the previous decision.
    scheduleAutoDeal();
    const shown = publicGame();
    const sameBettingDecision=view==='live'&&shown?.street!=='complete'&&!!shown&&root.querySelector<HTMLElement>('#table-actions')?.dataset.decisionToken===`${shown.handId}:${shown.revision}`;
    const bettingDrafts=sameBettingDecision?Array.from(root.querySelectorAll<HTMLInputElement>('#custom-pot-percent, #shortcut-bb, #increment-bb')).map(input=>({id:input.id,value:input.value})):[];
    const expandedBettingDetails=sameBettingDecision?Array.from(root.querySelectorAll<HTMLDetailsElement>('#table-actions details[id][open]')).map(details=>details.id):[];
    /* Phase 10 (F05 follow-on): EVERY id'd details the user has open survives a render,
     * not just the setup/betting scopes — tapping a paytable bet-size chip re-renders,
     * and the paytable must not slam shut under the reader's finger. */
    const expandedDetails=Array.from(root.querySelectorAll<HTMLDetailsElement>('details[id][open]')).map(details=>details.id);
    // A bot commit may arrive while Cashier is open. Preserve the user's active
    // input and caret across a display refresh; saved state remains authoritative.
    const focused = (document.activeElement instanceof HTMLInputElement || document.activeElement instanceof HTMLSelectElement || document.activeElement instanceof HTMLTextAreaElement) && root.contains(document.activeElement) ? document.activeElement : null;
    let keyboardFocus=focusSelector(document.activeElement instanceof HTMLElement?document.activeElement:null,content);
    const focusDecision=view==='live'&&shown?`${shown.handId}:${shown.revision}`:null;
    // A disabled replacement cannot receive focus. Remember the user's location
    // only for this unchanged view/decision across a transient save lock.
    if(savedFocusDuringCommit&&(savedFocusDuringCommit.view!==view||savedFocusDuringCommit.decision!==focusDecision||(keyboardFocus&&keyboardFocus!=='#table-actions'&&keyboardFocus!=='#main-content'&&keyboardFocus!==savedFocusDuringCommit.selector)))savedFocusDuringCommit=null;
    if(controller.busy&&keyboardFocus&&keyboardFocus!=='#table-actions'&&keyboardFocus!=='#main-content'&&!savedFocusDuringCommit)savedFocusDuringCommit={selector:keyboardFocus,view,decision:focusDecision,selection:focused instanceof HTMLInputElement||focused instanceof HTMLTextAreaElement?[focused.selectionStart,focused.selectionEnd]:null,drafts:[]};
    const resumedFocus=!unavailable()?savedFocusDuringCommit:null;
    if(resumedFocus){keyboardFocus=resumedFocus.selector;savedFocusDuringCommit=null;}
    // A clock save may replace the form after the user tabs to its submit
    // button. Carry edited values across that render even after focus leaves
    // the field. A new bankroll epoch or table gets its own form defaults.
    const cashierDrafts = view === 'cashier' ? Array.from(content.querySelectorAll<HTMLInputElement>('form[data-cashier-context] input'))
      .filter(input => input.value !== input.defaultValue)
      .map(input => ({id:input.id, value:input.value, context:input.form!.dataset.cashierContext})) : [];
    const focusId = focused?.id ?? '';
    const preserveDraft = ['bankroll-amount', 'bankroll-note', 'topup-amount', 'assumed-live-pace', 'delete-practice-confirmation', 'import-json', 'export-json', 'player-note-text'].includes(focusId) || (view==='host'&&!!focused?.closest('#setup-form')) || (sameBettingDecision&&bettingDrafts.some(draft=>draft.id===focusId));
    const drafts = preserveDraft ? Array.from(root.querySelectorAll<HTMLInputElement|HTMLTextAreaElement>('#assumed-live-pace, #delete-practice-confirmation, #import-json, #export-json')).map(input => ({id:input.id,value:input.value})) : savedFocusDuringCommit?.drafts??resumedFocus?.drafts??[];
    // The disabled replacement loses native focus before the ready render.
    // Carry only unsubmitted UI text alongside its guarded focus location.
    if(controller.busy&&savedFocusDuringCommit&&preserveDraft)savedFocusDuringCommit.drafts=drafts;
    const selection = focused instanceof HTMLInputElement || focused instanceof HTMLTextAreaElement ? [focused.selectionStart, focused.selectionEnd] : null;
    const smallBlind = shown?.profile.smallBlind ?? settings.smallBlind;
    const bigBlind = shown?.profile.bigBlind ?? settings.bigBlind;
    const message = error || (controller.status === 'ready' ? controller.error : '');
    // Phase 10 (P10-F02): scroll positions join drafts/focus/details in what a render
    // must not lose — the morph transiently collapses scrollable subtrees and the
    // browser clamps their scrollTop to 0 (the coach "why" snap-back).
    const scrollSnap = snapshotScroll(content);
    // Edit the live tree in place instead of rebuilding it (see dom-morph.ts).
    morphInto(content, `<a class="skip-link" href="#main-content">Skip to table and controls</a><div class="app-shell view-${view}${game?' has-game':''}${motion?'':' motion-off'}${styleClasses(style)}${view==='tournaments'&&tournament?.data?.active?' tournament-active':''}${(view==='live'&&game)||(view==='tournaments'&&tournament?.data?.active)||(view==='omaha'&&plo?.state.active)?' at-table':''}"><header class="app-header"><a class="brand" href="#" aria-label="Gold Crown Casino home">${casinoWordmark()}</a><nav aria-label="Main navigation">${MENU.map(entry => { const current = menuGroup(view) === entry; return `<button data-view="${entry.view}" class="nav-button ${current ? 'selected' : ''}" aria-label="${entry.label}" ${view === entry.view ? 'aria-current="page"' : current ? 'aria-current="true"' : ''}>${navIcon(entry.view)}<span>${entry.text}</span></button>${entry.view === 'live' && view === 'live' && game ? `<button type="button" id="nav-games" class="nav-button nav-more" aria-label="Other games and setup" aria-expanded="${gamesMenuOpen}" aria-controls="subnav-Play"><span aria-hidden="true">${gamesMenuOpen ? '▴' : '▾'}</span></button>` : ''}`; }).join('')}</nav><div class="header-status"><span class="virtual-label"><span></span>Virtual chips only</span></div></header>${MENU.filter(entry => entry.pages.length).map(entry => { const current = menuGroup(view) === entry, overlay = view === 'live' && !!game; return `<nav class="subnav${overlay ? ' subnav-overlay' : ''}" id="subnav-${entry.group}" aria-label="${entry.group} pages" ${current && (!overlay || gamesMenuOpen) ? '' : 'hidden'}>${entry.pages.map(page => page.view === entry.view ? `<button type="button" data-view-home="${page.view}" class="subnav-button ${view === page.view ? 'selected' : ''}" ${view === page.view ? 'aria-current="true"' : ''}><span class="nav-full">${page.text}</span><span class="nav-short">${page.short}</span></button>` : `<button type="button" data-view="${page.view}" class="subnav-button ${view === page.view ? 'selected' : ''}" aria-label="${page.label}" ${view === page.view ? 'aria-current="page"' : ''}><span class="nav-full">${page.text}</span><span class="nav-short">${page.short}</span></button>`).join('')}</nav>`; }).join('')}
      <nav class="bottom-nav" aria-label="Primary">${MENU.map(entry => { const current = menuGroup(view) === entry; return `<button type="button" data-view="${entry.view}" class="bottom-nav-button ${current ? 'selected' : ''}" aria-label="${entry.label}" ${view === entry.view ? 'aria-current="page"' : current ? 'aria-current="true"' : ''}>${navIcon(entry.view)}<span>${entry.text}</span></button>`; }).join('')}</nav>
      <main id="main-content" tabindex="-1" class="view-anim-${viewSwitches % 2}"><div class="page-heading"><div><span class="eyebrow">${sectionLabel(view)}</span><h1>${view === 'blackjack' ? 'Blackjack.' : view === 'tournaments' ? 'Pick your tournament.' : view === 'session' ? 'Your next table starts here.' : view === 'host' ? 'Make it your game.' : view === 'study' ? 'Every decision, remembered.' : view === 'opponents' ? 'Observe. Then reflect.' : view === 'home' ? 'Your casino.' : view === 'career' ? 'Climb the stakes.' : view === 'heads-up' ? 'One on one.' : view === 'omaha' ? 'Four cards. Pot limit.' : view === 'coach' ? 'Find the leaks. Drill the spots.' : view === 'by-game' ? 'Winning, or running hot?' : view === 'game-detail' ? 'Every number, in detail.' : view === 'deep-stats' ? 'Every number, yours and theirs.' : view === 'slots' ? 'Spin the reels.' : view === 'roulette' ? 'Round and round she goes.' : view === 'craps' ? 'Shooter coming out.' : view === 'baccarat' ? 'Player or Banker?' : view === 'races' ? 'And they’re off.' : view === 'tournament-stats' ? 'Every event, counted.' : view === 'cashier' ? 'Keep your chips in order.' : view === 'results' ? 'Know your sample.' : 'Pull up a seat.'}</h1></div><div class="room-details">${controller.data ? `<span><small>BLINDS</small><b>${money(smallBlind)} <em>/</em> ${money(bigBlind)}</b></span><span><small>FORMAT</small><b>No-Limit Hold’em</b></span><button id="configure" class="button secondary" aria-label="Table settings">⚙ <span>Table settings</span></button>` : '<span>Restoring saved practice…</span>'}<button type="button" id="theme-toggle" class="theme-toggle" aria-pressed="${style.theme === 'light'}" aria-label="Light theme">${style.theme === 'light' ? '☾' : '☀'}</button></div></div>
      ${controller.status !== 'ready' ? `<div class="storage-banner ${controller.status}" role="status"><b>${controller.status === 'loading' ? 'Loading saved game…' : controller.status === 'readonly' ? 'Another tab owns this session' : controller.data ? 'Save paused — showing your last committed state' : 'Saved data is unavailable'}</b><p>${escape(controller.error || (controller.status === 'readonly' ? 'This tab cannot change saved chips. Close the other table tab and retry, or take over here; the other tab will become read-only.' : ''))}</p>${controller.status !== 'loading' ? '<button id="retry-save" class="button secondary">Retry saved session</button>' : ''}${controller.status === 'readonly' ? '<p>Taking over gives this tab control of the saved game. The other tab will become read-only; no chips are transferred.</p><button id="take-over" class="button primary">Take over this tab</button>' : ''}</div>` : `<div class="save-status" data-testid="save-status">${controller.busy || operation ? 'Saving…' : 'Saved on this device'}<span class="session-nav">${game ? '<button class="text-button" id="continue-session">Continue session</button>' : ''}<button class="button secondary" id="new-session">New session</button></span></div>`}
      ${sessionNotice?`<p class="session-notice" role="status">${escape(sessionNotice)}</p>`:''}
      ${controller.data?.active?.exitMode?`<div class="ending-notice" role="status">${controller.data.active.exitMode==='fold'?'Leaving after this hand: queued fold or all-in runout, then automatic cashout.':'Session ends after this hand. Finish your decisions; cashout is automatic.'}<button class="text-button" data-action="continue-session">Go to hand</button></div>`:''}
      ${cashOutSummaryMarkup()}${message ? `<div class="error-banner" role="alert"><b>Table notice</b><span>${escape(message)}</span><button id="dismiss-error" aria-label="Dismiss notice">×</button></div>` : ''}
      ${controller.recoveryDiagnostics.length?`<details class="storage-banner recovery-note" role="status"><summary><b>Saved-data recovery notice</b> <span class="muted">Your save was checked. Details</span></summary><ul>${controller.recoveryDiagnostics.map(message=>`<li>${escape(message)}</li>`).join('')}</ul></details>`:''}
      ${!controller.data ? `<section class="panel restore-placeholder" aria-busy="${controller.status === 'loading'}"><h2>${controller.status === 'loading' ? 'Restoring your bankroll and table…' : 'Your saved session has not loaded'}</h2><p>Balances, hands and table controls appear after the saved state is verified.${controller.status !== 'loading' ? ' Retry the saved session above. No new session has been created.' : ''}</p></section>` : view === 'blackjack' ? blackjackSection() : view === 'tournaments' ? tournamentSection() : view === 'session' ? sessionManager() : view === 'host' ? `<div class="host-layout">${setup()}<aside class="host-guide"><span class="large-suit">♠</span><h2>A little pressure.<br>A lot of possibility.</h2><p>Build a lineup, find your rhythm, and play complete hands at stakes that suit your practice.</p><div><b>01</b><span>Set your stakes and table size.</span></div><div><b>02</b><span>Choose your opponents’ styles.</span></div><div><b>03</b><span>Take your seat. Play the hand.</span></div><small>Live Table keeps opponent profiles hidden. Queue table changes safely for the next hand. Your saved history stays intact.</small></aside></div>` : view === 'study' ? study() : view === 'tournament-stats' ? tournamentStatsPage() : view === 'home' ? homeView() : view === 'career' ? careerView() : view === 'heads-up' ? headsUpView() : view === 'omaha' ? omahaView() : view === 'coach' ? coachView() : view === 'by-game' ? byGameView() : view === 'game-detail' ? gameDetailView() : view === 'deep-stats' ? deepStatsView() : view === 'slots' ? slotsView() : view === 'roulette' || view === 'craps' || view === 'baccarat' || view === 'races' ? casinoMarkup(casino, view) : view === 'opponents' ? opponentStudy() : view === 'cashier' ? cashier() : view === 'results' ? results() : `<div class="game-layout"><div class="main-table-column">${shown ? table(shown) + actions(shown) : actions(shown) + table(shown)}${playerNotes()}</div>${session(shown)}</div>`}
      <p class="practice-disclosure" data-testid="practice-disclosure">${PRACTICE_DISCLOSURE}</p><footer><div><span class="footer-mark">♛</span><span>GOLD CROWN CASINO <small>Cash-game candidate · Synthetic cash practice</small></span></div><p>SYNTHETIC / NOT HUMAN-VALIDATED<br><small>Local engine isolation. Hidden cards are inspectable through developer tools.</small></p></footer></main></div>`);
    /* Patch 85: sitting down starts at the top of the page, so in landscape the felt is in view. */
    { const seated = !!content.querySelector('.app-shell.at-table, .bj-grid'); if (seated && !wasSeated) { try { if (matchMedia('(orientation: landscape) and (max-height: 540px), (orientation: landscape) and (min-width: 900px) and (max-width: 1180px)').matches) window.scrollTo(0, 0); } catch { /* no matchMedia */ } } wasSeated = seated; }
    bind(shown);
    countUp(root, money, motion && !matchMedia?.('(prefers-reduced-motion: reduce)').matches);
    // Patch 78: bring the current page tab into view when the page changes.
    if (subnavShown !== view) { subnavShown = view; const tab = root.querySelector<HTMLElement>('.subnav:not([hidden]) .subnav-button.selected'), bar = tab?.parentElement; if (tab && bar && bar.scrollWidth > bar.clientWidth) bar.scrollLeft = Math.max(0, tab.offsetLeft - (bar.clientWidth - tab.offsetWidth) / 2); }
    // A new page starts at its top: starting a session from the long setup form used to leave the table scrolled out of view.
    if (renderedView !== null && renderedView !== view) { const scroller = document.scrollingElement; if (scroller) scroller.scrollTop = 0; }
    renderedView = view;
    if (view === 'live') countStacks();
    const heroTurn = view === 'live' ? !!game && game.street !== 'complete' && game.actor === 0 && !paused : view === 'tournaments' && !!tournament?.gameView && tournament.data?.active?.status === 'running' && tournament.gameView.street !== 'complete' && tournament.gameView.actor === 0;
    const wantTitle = turnTitle(pageTitle, heroTurn);
    if (document.title !== wantTitle) document.title = wantTitle;
    const soundView = view === 'live' ? game : view === 'tournaments' ? tournament?.gameView ?? null : null;
    const nextSound = soundState(soundView, heroTurn);
    if ((style.sound || style.vibrate) && lastSoundView === view) { const cues = soundCues(lastSound, nextSound, soundView); if (style.sound) playCues(cues); if (style.vibrate) vibrateFor(cues); }
    lastSound = nextSound; lastSoundView = view;
    // Patch 83: the card-room murmur, only at a table and only while the page is visible.
    ambience(style.sound && style.ambience && ['live', 'omaha', 'blackjack', 'tournaments', 'heads-up'].includes(view) && document.visibilityState === 'visible');
    // Patch 80: Omaha and blackjack sounds.
    if (view === 'omaha' && plo) { const next = ploSoundState(plo.state.active ? plo.hand : null, plo.heroTurn); if (style.sound && lastPloSound && next) { const cues = ploSoundCues(lastPloSound, next, plo.hand); playCues(cues); if (style.vibrate) vibrateFor(cues); } lastPloSound = next; } else lastPloSound = null;
    if (view === 'blackjack') { const next = blackjackLive.soundState(); if (style.sound && lastBjSound && next) { const cues = bjSoundCues(lastBjSound, next); playCues(cues); } lastBjSound = next; } else lastBjSound = null;
    const announced=savedPracticeAnnouncement({status:controller.status,error:controller.error,maintenanceNotice:view==='cashier'?maintenanceNotice:'',table:view==='blackjack'?blackjackLive.announcement():view==='tournaments'?(tournament?tournamentAnnouncement(tournament):'Loading tournament.'):controller.status==='ready'&&(view==='live'||view==='host'||view==='heads-up')?tableAnnouncement(shown,handNumber,paused):''});
    if(announcement.textContent!==announced)announcement.textContent=announced;
    for(const draft of setupDrafts){const input=root.querySelector<HTMLInputElement|HTMLSelectElement>(`#${draft.id}`);if(input){input.value=draft.value;if(input instanceof HTMLInputElement&&draft.checked!==undefined)input.checked=draft.checked;}}
    for(const id of expandedSetupDetails){const details=root.querySelector<HTMLDetailsElement>(`#${id}`);if(details)details.open=true;}
    for(const id of expandedBettingDetails){const details=root.querySelector<HTMLDetailsElement>(`#${id}`);if(details)details.open=true;}
    for(const id of expandedDetails){const details=root.querySelector<HTMLDetailsElement>(`#${id}`);if(details)details.open=true;}
    for(const draft of bettingDrafts){const input=root.querySelector<HTMLInputElement>(`#${draft.id}`);if(input)input.value=draft.value;}
    for (const draft of drafts) { const input = root.querySelector<HTMLInputElement|HTMLTextAreaElement>(`#${draft.id}`); if (input) input.value = draft.value; }
    for (const draft of cashierDrafts) {
      const input = content.querySelector<HTMLInputElement>(`#${draft.id}`);
      if (input?.form && input.form.dataset.cashierContext === draft.context) input.value = draft.value;
    }
    restoreFocus(root,keyboardFocus);
    if(resumedFocus?.selection){const input=root.querySelector<HTMLInputElement|HTMLTextAreaElement>(resumedFocus.selector);const [start,end]=resumedFocus.selection;if(input&&(input instanceof HTMLInputElement||input instanceof HTMLTextAreaElement)&&start!==null&&end!==null)input.setSelectionRange(start,end);}
    if (preserveDraft) {
      const replacement = root.querySelector<HTMLInputElement|HTMLSelectElement|HTMLTextAreaElement>(`#${focusId}`);
      replacement?.focus({preventScroll:true});
      if ((replacement instanceof HTMLInputElement || replacement instanceof HTMLTextAreaElement) && selection && selection[0] !== null && selection[1] !== null) replacement.setSelectionRange(selection[0], selection[1]);
    }
    // Phase 10 (P10-F02): put back every scroll position the morph clamped.
    restoreScroll(content, scrollSnap);
  }
  async function prepareStudyPreview(text:string) {
    try{assertStudyImportRights(importRightsConfirmed);}catch(cause){error=(cause as Error).message;render();return;}
    const request=++importPreviewRequest,generation=privacyGeneration;importPreviewBusy=true;importPreview=null;importSelection.clear();importPreviewPage=0;error='';render();
    try{const preview=await previewPublicStudyImport(text);if(request!==importPreviewRequest||generation!==privacyGeneration||controller.status==='deleted')return;importPreview=preview;}
    catch(cause){if(request===importPreviewRequest&&generation===privacyGeneration)error=(cause as Error).message;}
    finally{if(request===importPreviewRequest&&generation===privacyGeneration){importPreviewBusy=false;render();}}
  }
  function clearPracticeViews() {
    if(backupState.file)URL.revokeObjectURL(backupState.file.url);
    backupState.file=null;backupBlob=null;pendingBackup=null;backupState.pending=null;backupState.notice='';backupState.report=[];backupState.problem='';
    coachCache=null;drillPicks.clear();drillAnswerCache.clear();
    if(controller.status==='deleted'){career=null;saveCareer(null);}
    privacyGeneration++;importPreviewRequest++;importPreview=null;importSelection.clear();importPreviewBusy=false;importPreviewPage=0;clearTimer();preparingToken='';historySource=null;reviewCache=[];originCache=new WeakMap();statsProjection.reset();
    if(downloadUrl)URL.revokeObjectURL(downloadUrl);downloadUrl='';exportFiles=null;exportRange=null;showExportText=false;showImportText=false;importRightsConfirmed=false;importTextDraft='';exportNotice='';
    settings=structuredClone(DEFAULT_SETTINGS);presetChoice='';presetName='';openOpponentDetails.clear();openOpponentCards.clear();openSetupSections.clear();
    resultsFilter={...ALL_CASH_RESULTS_FILTER};filteredCache=null;historyPage=0;replayId='';replayFrame=0;historySession='all';historyStake='all';historyResult='all';opponentStudySession='';revealedStyleSession='';configurationHistoryPage=0;noteDrafts.clear();notesOpen=false;notesSession='';notesSeat=1;noteNotice='';
    initialSettingsLoaded=false;loadedSettingsFor='';loadedSettingsHand='';afterExitConfigure=false;sessionNotice='';deleteConfirm=false;resetConfirm=false;view='live';
  }
  function refreshHostSettings() {
    const active=controller.data?.active;
    if(active){const saved=active.queuedConfiguration?.settings ?? controller.data?.sessions.find(item=>item.id===active.sessionId)?.settings;if(saved){settings=initializeOpponentSettings(structuredClone(saved));if(!active.queuedConfiguration)delete settings.seatStacks;}}
    discardSetupDraft=true;
  }
  // Elements now persist between renders, so the handlers attached by the previous
  // render are removed before this render attaches its own.
  let boundListeners: AbortController | null = null;
  function bind(shown: HeroViewModel | null) {
    boundListeners?.abort();
    boundListeners = new AbortController();
    const live: AddEventListenerOptions = { signal: boundListeners.signal };
    const on = (selector: string, fn: (event: Event) => void) => root.querySelectorAll(selector).forEach(element => element.addEventListener('click', fn, live));
    const saveSetupDraft = ():boolean => { try { if(!root.querySelector<HTMLFieldSetElement>('#setup-form fieldset')?.disabled)readSettings(); return true; } catch(cause) { error=(cause as Error).message; render(); return false; } };
    root.querySelectorAll<HTMLButtonElement>('[data-view]').forEach(el => el.addEventListener('click', () => { if (!saveSetupDraft()) return; userNavigated = true; view = el.dataset.view as View; if(view==='tournaments'||view==='tournament-stats'||view==='coach'||view==='by-game')ensureTournament();if(view==='blackjack')blackjackLive.init(); gamesMenuOpen = false; if(view==='host')refreshHostSettings(); error = ''; render(); }, live));
    root.querySelectorAll<HTMLButtonElement>('[data-game-detail]').forEach(el => el.addEventListener('click', () => { if (!saveSetupDraft()) return; detailGame = el.dataset.gameDetail as DetailGame; if (detailGame === 'tournaments') ensureTournament(); if (detailGame === 'blackjack') blackjackLive.init(); view = 'game-detail'; gamesMenuOpen = false; error = ''; render(); }, live));
    root.querySelectorAll<HTMLButtonElement>('[data-view-home]').forEach(el => el.addEventListener('click', () => root.querySelector<HTMLButtonElement>(`.app-header [data-view="${el.dataset.viewHome}"]`)?.click(), live));
    on('#nav-games', () => { gamesMenuOpen = !gamesMenuOpen; render(); });
    on('#tournament-register',()=>{if(!tournament||controller.data?.active){error='Finish and cash out the cash session before registering.';render();return;}void tournament.startEvent(lobby.presetId,lobby.entrants,lobby.pace).then(()=>{tournamentDraft='';tournamentWatch=false;render();if(tournament?.data?.active){root.querySelector<HTMLElement>('.level-strip')?.scrollIntoView({block:'start'});root.querySelector<HTMLElement>('#t-actions')?.focus({preventScroll:true});}}).catch(cause=>{error=String(cause);render();});});
    on('#t-retry',()=>{void tournament?.retry().then(render).catch(cause=>{error=String(cause);render();});});
    on('#t-backup',()=>{if(!tournament)return;void tournament.exportRecoveryBackup().then(text=>{if(tournamentBackupURL)URL.revokeObjectURL(tournamentBackupURL);tournamentBackupURL=URL.createObjectURL(new Blob([text],{type:'application/json'}));tournamentBackupMessage='Verified previous snapshot prepared. Current save has not been changed.';render();}).catch(cause=>{tournamentBackupMessage=String(cause);render();});});
    on('#t-adjust',()=>{try{const target=cents(root.querySelector<HTMLInputElement>('#t-balance')!.value);void tournament?.adjustBalance(target,'Manual tournament balance adjustment').then(render).catch(cause=>{error=String(cause);render();});}catch(cause){error=String(cause);render();}});
    if(view==='tournaments'&&tournamentMoveBlocked()){const key=`${tournament?.data?.active?.id}:${tournament?.data?.active?.handNumber}`;if(tournamentMoveFocused!==key){tournamentMoveFocused=key;root.querySelector<HTMLElement>('#tournament-move-ack')?.focus();}}
    if(view==='tournaments'&&tournament)bindTournamentPlay(root,tournament,{signal:boundListeners.signal,onMoveAck:()=>{const active=tournament?.data?.active;if(active)tournamentMoveAck=`${active.id}:${active.handNumber}`;render();root.querySelector<HTMLElement>('#t-actions')?.focus({preventScroll:true});},onManualAction:()=>{tournamentPre='';},onHeroAction:(action)=>{const v=tournament?.gameView;if(v)reviewAction(coachUi,`${v.handId}:${v.revision}`,action,n=>`${n.toLocaleString('en-US')} chips`);},heroTempo:(handId,revision)=>{const t=tournamentTurn;if(!t||t.key!==`${handId}:${revision}`||t.hidden||document.hidden)return null;const ms=performance.now()-t.at;return ms<1500?'snap':ms>=7000?'tank':null;},onFastForward:()=>{if(tournamentFast){tournamentFast=false;render();return;}if(tournamentWorking||!tournament||tournament.data?.active?.status!=='hero-out')return;const reEntryOpen=()=>!!tournament?.view?.registration?.heroReEntry?.available,startedOpen=reEntryOpen(),warnKey=`${tournament.data.active.id}:${tournament.data.active.handNumber}`;if(startedOpen&&skipReEntryWarned!==warnKey){skipReEntryWarned=warnKey;error='You can still re-enter this tournament. Skipping plays on past that chance. Press Skip to result again to skip anyway.';render();return;}tournamentFast=true;tournamentWorking=true;render();let stoppedForReEntry=false;void fastForwardTournament(tournament,()=>{if(!startedOpen&&reEntryOpen()){stoppedForReEntry=true;return false;}return tournamentFast&&view==='tournaments';}).catch(cause=>{error=String(cause);}).finally(()=>{tournamentFast=false;tournamentWorking=false;if(stoppedForReEntry&&!error)error='Skip stopped: you can re-enter this tournament. Re-enter, or press Skip to result again to keep watching.';render();});},onPace:value=>{tournamentPace=value;},onWatchToResult:value=>{tournamentWatch=value;render();},onPreCheckFold:value=>{tournamentPre=value?tournamentStreetKey():'';render();},onAutoDeal:value=>{tournamentAutoDeal=value;tournamentDealAt=null;tournamentHeld='';try{localStorage.setItem(TOURNAMENT_AUTO_DEAL_KEY,value?'1':'0');}catch{/* preference only */}render();},onAutoHold:()=>{tournamentHeld=tournament?.data?.active?.game.handId??'';render();root.querySelector<HTMLElement>('#t-next')?.focus({preventScroll:true});},onDraft:value=>{tournamentDraft=value;render();},onAction:()=>{tournamentDraft='';render();(root.querySelector<HTMLElement>('#tournament-move-ack')??root.querySelector<HTMLElement>('#t-actions'))?.focus({preventScroll:true});},onError:message=>{error=message;render();}});

    root.addEventListener('keydown',event=>{if(event.key==='Escape'&&gamesMenuOpen){event.preventDefault();gamesMenuOpen=false;render();root.querySelector<HTMLButtonElement>('#nav-games')?.focus();}},live);
    if(view==='blackjack'&&blackjackTab==='tables')blackjackLive.bind(root,boundListeners.signal,blackjackLobby);
    root.querySelectorAll<HTMLButtonElement>('[data-blackjack-tab]').forEach(el => el.addEventListener('click', () => { blackjackTab = el.dataset.blackjackTab as BlackjackTab; render(); root.querySelector<HTMLElement>(`[data-blackjack-tab="${blackjackTab}"]`)?.focus({ preventScroll: true }); }, live));
    root.querySelectorAll<HTMLButtonElement>('[data-blackjack-group]').forEach(el => el.addEventListener('click', () => { blackjackLobby = normalizeBlackjackLobby({ group: el.dataset.blackjackGroup as BlackjackLobbyState['group'], ante: blackjackLobby.group === 'home' ? undefined : blackjackLobby.ante, others: blackjackLobby.others, heroSeat: blackjackLobby.heroSeat, pace: blackjackLobby.pace }); render(); }, live));
    root.querySelectorAll<HTMLButtonElement>('[data-blackjack-others]').forEach(el => el.addEventListener('click', () => { blackjackLobby = normalizeBlackjackLobby({ ...blackjackLobby, others: Number(el.dataset.blackjackOthers) }); render(); root.querySelector<HTMLElement>(`[data-blackjack-others="${blackjackLobby.others}"]`)?.focus({ preventScroll: true }); }, live));
    root.querySelectorAll<HTMLButtonElement>('[data-blackjack-pace]').forEach(el => el.addEventListener('click', () => { blackjackLobby = normalizeBlackjackLobby({ ...blackjackLobby, pace: el.dataset.blackjackPace as BlackjackLobbyState['pace'] }); render(); root.querySelector<HTMLElement>(`[data-blackjack-pace="${blackjackLobby.pace}"]`)?.focus({ preventScroll: true }); }, live));
    root.querySelectorAll<HTMLButtonElement>('[data-blackjack-seat]').forEach(el => el.addEventListener('click', () => { blackjackLobby = normalizeBlackjackLobby({ ...blackjackLobby, heroSeat: Number(el.dataset.blackjackSeat) }); render(); root.querySelector<HTMLElement>(`[data-blackjack-seat="${blackjackLobby.heroSeat}"]`)?.focus({ preventScroll: true }); }, live));
    root.querySelectorAll<HTMLButtonElement>('[data-blackjack-ante]').forEach(el => el.addEventListener('click', () => { blackjackLobby = normalizeBlackjackLobby({ ...blackjackLobby, ante: Number(el.dataset.blackjackAnte) }); render(); root.querySelector<HTMLElement>(`[data-blackjack-ante="${blackjackLobby.ante}"]`)?.focus({ preventScroll: true }); }, live));
    root.querySelectorAll<HTMLButtonElement>('[data-coach-play]').forEach(el => el.addEventListener('click', () => { if (coachDrill) { coachDrill = gradeDrill(coachDrill, el.dataset.coachPlay as Play, coachRules(coachTable)); render(); root.querySelector<HTMLElement>('#coach-next')?.focus({ preventScroll: true }); } }, live));
    on('#coach-next', () => { if (coachDrill) { coachDrill = nextDrill(coachDrill, strategyQuestion(secureIndex)); render(); root.querySelector<HTMLElement>('#coach-next')?.focus({ preventScroll: true }); } });
    root.querySelector<HTMLSelectElement>('#coach-table')?.addEventListener('change', event => { coachTable = (event.currentTarget as HTMLSelectElement).value; coachDrill = newDrill(strategyQuestion(secureIndex)); render(); root.querySelector<HTMLElement>('#coach-table')?.focus({ preventScroll: true }); }, live);
    const freshDeviation = (focus: string) => { deviationDrill = newDrill(deviationQuestion(coachRules(deviationTable), deviationSystem, secureIndex)); render(); root.querySelector<HTMLElement>(focus)?.focus({ preventScroll: true }); };
    root.querySelectorAll<HTMLButtonElement>('[data-deviation-play]').forEach(el => el.addEventListener('click', () => { if (deviationDrill) { deviationDrill = gradeDrill(deviationDrill, el.dataset.deviationPlay as Play, coachRules(deviationTable)); render(); root.querySelector<HTMLElement>('#deviation-next')?.focus({ preventScroll: true }); } }, live));
    on('#deviation-next', () => { if (deviationDrill) { deviationDrill = nextDrill(deviationDrill, deviationQuestion(coachRules(deviationTable), deviationSystem, secureIndex)); render(); root.querySelector<HTMLElement>('#deviation-next')?.focus({ preventScroll: true }); } });
    root.querySelector<HTMLSelectElement>('#deviation-system')?.addEventListener('change', event => { deviationSystem = (event.currentTarget as HTMLSelectElement).value as CountSystemId; freshDeviation('#deviation-system'); }, live);
    root.querySelector<HTMLSelectElement>('#deviation-table')?.addEventListener('change', event => { deviationTable = (event.currentTarget as HTMLSelectElement).value; freshDeviation('#deviation-table'); }, live);
    root.querySelectorAll<HTMLButtonElement>('[data-blackjack-table]').forEach(el => el.addEventListener('click', () => { blackjackLobby = normalizeBlackjackLobby({ ...blackjackLobby, tableId: el.dataset.blackjackTable }); render(); }, live));
    const refocus = (selector: string) => root.querySelector<HTMLElement>(selector)?.focus({ preventScroll: true });
    const tune = (change: Partial<TrainerSettings>, focus: string) => { if (trainer) { trainer = retune(trainer, change); trainerDraft = ''; trainerAcesDraft = ''; render(); refocus(focus); } };
    root.querySelector<HTMLSelectElement>('#trainer-system')?.addEventListener('change', event => tune({ system: (event.currentTarget as HTMLSelectElement).value as TrainerSettings['system'] }, '#trainer-system'), live);
    root.querySelector<HTMLSelectElement>('#trainer-decks')?.addEventListener('change', event => tune({ decks: Number((event.currentTarget as HTMLSelectElement).value) as TrainerSettings['decks'] }, '#trainer-decks'), live);
    root.querySelector<HTMLSelectElement>('#trainer-pace')?.addEventListener('change', event => tune({ cardsPerDeal: Number((event.currentTarget as HTMLSelectElement).value) as TrainerSettings['cardsPerDeal'] }, '#trainer-pace'), live);
    root.querySelectorAll<HTMLButtonElement>('[data-trainer-mode]').forEach(el => el.addEventListener('click', () => tune({ mode: el.dataset.trainerMode as TrainerSettings['mode'] }, `[data-trainer-mode="${el.dataset.trainerMode}"]`), live));
    on('#trainer-deal', () => { if (trainer) { trainer = dealNext(trainer); trainerDraft = ''; trainerAcesDraft = ''; render(); refocus('#trainer-deal'); } });
    on('#trainer-new', () => { if (trainer) { trainer = newTrainer(trainer.settings); trainerDraft = ''; trainerAcesDraft = ''; render(); refocus('#trainer-deal'); } });
    root.querySelector<HTMLInputElement>('#trainer-answer')?.addEventListener('input', event => { trainerDraft = (event.currentTarget as HTMLInputElement).value; }, live);
    root.querySelector<HTMLInputElement>('#trainer-aces')?.addEventListener('input', event => { trainerAcesDraft = (event.currentTarget as HTMLInputElement).value; }, live);
    const checkTrainer = () => {
      if (!trainer) return;
      const answer = Number(trainerDraft.trim().replace('−', '-').replace(/^\+/, '')), aces = Number(trainerAcesDraft);
      if (!trainerDraft.trim() || !Number.isFinite(answer)) { error = 'Enter your running count as a number, such as 3 or -1.5.'; render(); refocus('#trainer-answer'); return; }
      if (!trainerAcesDraft.trim() || !Number.isInteger(aces) || aces < 0 || aces > trainer.settings.decks * 4) { error = 'Enter aces seen as a whole number, including 0 if none were exposed.'; render(); refocus('#trainer-aces'); return; }
      error = ''; trainer = checkCount(trainer, answer, aces); render(); refocus('#trainer-deal');
    };
    on('#trainer-check', checkTrainer);
    root.querySelectorAll<HTMLInputElement>('#trainer-answer, #trainer-aces').forEach(input => input.addEventListener('keydown', event => { if (event.key === 'Enter') { event.preventDefault(); checkTrainer(); } }, live));
    /* Patch 72: a satellite seat goes straight to registration for its event. */
    root.querySelectorAll<HTMLButtonElement>('[data-seat-target]').forEach(el => el.addEventListener('click', () => { const target = findPreset(el.dataset.seatTarget ?? ''); if (!target || !tournament) return; void (async () => { if (tournament!.data?.active?.status === 'complete') await tournament!.finishEvent(); lobby = normalizeLobby({ tier: target.tier, presetId: target.id, pace: lobby.pace }); view = 'tournaments'; render(); root.querySelector<HTMLElement>('#tournament-register')?.focus(); })(); }, live));
    root.querySelectorAll<HTMLButtonElement>('[data-tournament-tier]').forEach(el => el.addEventListener('click', () => { lobby = normalizeLobby({ tier: el.dataset.tournamentTier as LobbyState['tier'], pace: lobby.pace }); render(); }, live));
    root.querySelectorAll<HTMLButtonElement>('[data-tournament-event]').forEach(el => el.addEventListener('click', () => { lobby = normalizeLobby({ ...lobby, presetId: el.dataset.tournamentEvent }); render(); }, live));
    root.querySelectorAll<HTMLButtonElement>('[data-tournament-field]').forEach(el => el.addEventListener('click', () => { lobby = normalizeLobby({ ...lobby, entrants: Number(el.dataset.tournamentField) }); render(); }, live));
    root.querySelectorAll<HTMLButtonElement>('[data-tournament-pace]').forEach(el => el.addEventListener('click', () => { lobby = normalizeLobby({ ...lobby, pace: el.dataset.tournamentPace as LobbyState['pace'] }); render(); }, live));
    on('.brand', event => { event.preventDefault(); if (!saveSetupDraft()) return; view = 'live'; render(); });
    for (const selector of ['#configure', '#open-setup']) on(selector, () => { refreshHostSettings(); view = 'host'; render(); });
    on('#back-live', () => { view = 'live'; render(); });
    on('#load-older-history',()=>{void controller.loadFullHistory().catch(cause=>{error=(cause as Error).message;render();});});
    /* Phase 2: stats snapshots + reset point. Every action rewrites only the
     * stats book; game records, archives and balances are never touched. */
    on('#snapshot-save',()=>{try{statsBook=takeSnapshot(statsBook,careerStats(careerSources()),newHandId(),new Date().toISOString(),root.querySelector<HTMLInputElement>('#snapshot-name')?.value??'');saveStatsBook(statsBook);statsNotice='Snapshot saved. It will not change when you reset or keep playing.';}catch(cause){statsNotice=(cause as Error).message;}render();});
    root.querySelectorAll<HTMLButtonElement>('[data-snapshot-compare]').forEach(b=>b.addEventListener('click',()=>{compareSnapshotId=compareSnapshotId===b.dataset.snapshotCompare?null:b.dataset.snapshotCompare!;render();},live));
    root.querySelectorAll<HTMLButtonElement>('[data-snapshot-delete]').forEach(b=>b.addEventListener('click',()=>{statsBook=deleteSnapshot(statsBook,b.dataset.snapshotDelete!);saveStatsBook(statsBook);if(compareSnapshotId===b.dataset.snapshotDelete)compareSnapshotId=null;statsNotice='Snapshot deleted.';render();},live));
    on('#stats-compare-close',()=>{compareSnapshotId=null;render();});
    on('#stats-reset',()=>{statsResetConfirm=true;render();});
    on('#stats-reset-cancel',()=>{statsResetConfirm=false;render();});
    on('#stats-reset-confirm',()=>{const sources=careerSources();statsBook=resetCounters(statsBook,careerStats(sources),cursorsFromSources(sources),new Date().toISOString());saveStatsBook(statsBook);statsResetConfirm=false;statsNotice='Counters reset. Your career totals, records and snapshots are unchanged.';render();});
    on('#stats-baseline-clear',()=>{statsBook=clearBaseline(statsBook);saveStatsBook(statsBook);statsNotice='Reset point cleared. Your current counters are your whole career again.';render();});
    on('#history-newer',()=>{historyPage=Math.max(0,historyPage-1);render();});
    on('#history-older',()=>{historyPage++;render();});
    for(const [selector,key] of [['#results-filter-session','sessionId'],['#results-filter-stake','stake']] as const)root.querySelector<HTMLSelectElement>(selector)?.addEventListener('change',event=>{resultsFilter={...resultsFilter,[key]:(event.target as HTMLSelectElement).value};filteredCache=null;configurationHistoryPage=0;if(!controller.historyLoaded&&(resultsFilter.sessionId!=='all'||resultsFilter.stake!=='all'))void controller.loadFullHistory().catch(cause=>{error=(cause as Error).message;render();});render();}, live);
    on('#retry-statistics',()=>{statsProjection.reset();render();});
    on('#dismiss-error', () => { error = ''; render(); });
    on('#pause', () => { clearTimer(); void run(() => controller.setPaused(!paused)); });
    root.querySelector<HTMLSelectElement>('#pace')?.addEventListener('change', event => { pace = Number((event.target as HTMLSelectElement).value); try { localStorage.setItem(PACE_KEY, String(pace)); } catch { /* preference only */ } clearTimer(); void scheduleBot(); }, live);
    if (shown) on('#next-hand', () => nextHand(shown.handId, shown.revision));
    on('#auto-deal-hold', () => { autoDealHeld = completeToken(); cancelAutoDeal(); render(); root.querySelector<HTMLElement>('#next-hand')?.focus(); });
    root.querySelector<HTMLDetailsElement>('#table-style')?.addEventListener('toggle', event => { stylePanelOpen = (event.currentTarget as HTMLDetailsElement).open; }, live);
    const restyle = (change: Partial<TableStyle>) => { style = { ...style, ...change }; controller.dealerTipPolicy=style.tokes; saveStyle(style); render(); };
    root.querySelector<HTMLSelectElement>('#style-felt')?.addEventListener('change', event => restyle({ felt: (event.currentTarget as HTMLSelectElement).value as TableStyle['felt'] }), live);
    root.querySelector<HTMLSelectElement>('#style-back')?.addEventListener('change', event => restyle({ back: (event.currentTarget as HTMLSelectElement).value as TableStyle['back'] }), live);
    root.querySelector<HTMLInputElement>('#style-four')?.addEventListener('change', event => restyle({ fourColor: (event.currentTarget as HTMLInputElement).checked }), live);
    root.querySelector<HTMLInputElement>('#style-chips')?.addEventListener('change', event => restyle({ chips: (event.currentTarget as HTMLInputElement).checked }), live);
    on('#dismiss-summary', () => { cashOutSummary = null; render(); });
    bindCharts(root, boundListeners!.signal);
    root.querySelector<HTMLInputElement>('#style-vibrate')?.addEventListener('change', event => { const on = (event.currentTarget as HTMLInputElement).checked; if (on) vibrateFor(['turn']); restyle({ vibrate: on }); }, live);
    root.querySelector<HTMLSelectElement>('#style-theme')?.addEventListener('change', event => restyle({ theme: (event.currentTarget as HTMLSelectElement).value as TableStyle['theme'] }), live);
    root.querySelector<HTMLInputElement>('#style-avatars')?.addEventListener('change', event => restyle({ avatars: (event.currentTarget as HTMLInputElement).checked }), live);
    root.querySelector<HTMLSelectElement>('#style-text')?.addEventListener('change', event => restyle({ textSize: (event.currentTarget as HTMLSelectElement).value as TableStyle['textSize'] }), live);
    root.querySelector<HTMLSelectElement>('#style-break')?.addEventListener('change', event => { restyle({ breakEvery: Number((event.currentTarget as HTMLSelectElement).value) }); ackBreak(); render(); }, live);
    on('#break-dismiss', () => { ackBreak(); render(); });
    on('#break-pause', () => { ackBreak(); if (!paused && game && game.street !== 'complete') void run(() => controller.setPaused(true)); else { cancelAutoDeal(); render(); } });
    root.querySelectorAll<HTMLButtonElement>('[data-say]').forEach(button => button.addEventListener('click', () => sayToTable(button.dataset.say as HeroPhrase, 'cash'), live));
    root.querySelectorAll<HTMLButtonElement>('[data-answer]').forEach(button => button.addEventListener('click', () => answerQuestion(button.dataset.answerMode as SayMode, Number(button.dataset.answer)), live));
    root.querySelectorAll<HTMLButtonElement>('[data-t-say]').forEach(button => button.addEventListener('click', () => sayToTable(button.dataset.tSay as HeroPhrase, 'tournament'), live));
    root.querySelectorAll<HTMLButtonElement>('[data-plo-say]').forEach(button => button.addEventListener('click', () => sayToTable(button.dataset.ploSay as HeroPhrase, 'omaha'), live));
    root.querySelectorAll<HTMLButtonElement>('[data-profile]').forEach(button => button.addEventListener('click', () => { const id = Number(button.dataset.profile); profileSeat = profileSeat === id ? null : id; render(); root.querySelector<HTMLElement>('#profile-close')?.focus({ preventScroll: true }); }, live));
    on('#profile-close', () => { const seat = profileSeat; profileSeat = null; render(); root.querySelector<HTMLElement>(`[data-profile="${seat}"]`)?.focus({ preventScroll: true }); });
    on('#profile-edit-note', () => { if (profileSeat === null) return; notesSeat = profileSeat; notesSession = controller.data?.active?.sessionId ?? notesSession; notesOpen = true; profileSeat = null; render(); root.querySelector('#player-notes')?.scrollIntoView({ block: 'start' }); });
    on('#install-app', () => { const prompt = installPrompt; installPrompt = null; void prompt?.prompt().catch(() => undefined); render(); });
    root.querySelectorAll<HTMLButtonElement>('[data-recap-hand]').forEach(button => button.addEventListener('click', () => { replayId = button.dataset.recapHand!; replayFrame = 0; view = 'study'; render(); root.querySelector('.replay-panel')?.scrollIntoView({ block: 'start' }); }, live));
    root.querySelector<HTMLInputElement>('#style-trends')?.addEventListener('change', event => restyle({ trends: (event.currentTarget as HTMLInputElement).checked }), live);
    root.querySelector<HTMLDetailsElement>('#talk-log')?.addEventListener('toggle', event => { talkLogOpen = (event.currentTarget as HTMLDetailsElement).open; }, live);
    root.querySelectorAll<HTMLSelectElement>('[data-face-part]').forEach(select => select.addEventListener('change', () => { const part = select.dataset.facePart as FacePart; restyle({ heroFace: { ...(style.heroFace ?? {}), [part]: Number(select.value) } }); }, live));
    on('#face-reset', () => restyle({ heroFace: null }));
    root.querySelector<HTMLSelectElement>('#style-portraits')?.addEventListener('change', event => restyle({ portraits: (event.currentTarget as HTMLSelectElement).value === 'portraits' }));
    root.querySelectorAll<HTMLButtonElement>('[data-portrait]').forEach(button => button.addEventListener('click', () => restyle({ heroPortrait: Number(button.dataset.portrait) })));
    on('#theme-toggle', () => restyle({ theme: style.theme === 'light' ? 'dark' : 'light' }));
    on('#tour-next', () => { tourStep++; render(); });
    on('#tour-back', () => { tourStep = Math.max(0, tourStep - 1); render(); });
    on('#tour-skip, #tour-done', () => { tourStep = -1; try { localStorage.setItem(TOUR_KEY, 'done'); } catch { /* shown again next visit */ } render(); });
    root.querySelector<HTMLInputElement>('#style-keys')?.addEventListener('change', event => restyle({ keys: (event.currentTarget as HTMLInputElement).checked }), live);
    root.querySelector<HTMLInputElement>('#style-hand-label')?.addEventListener('change', event => restyle({ handLabel: (event.currentTarget as HTMLInputElement).checked }), live);
    root.querySelector<HTMLInputElement>('#style-ambience')?.addEventListener('change', event => { unlockAudio(); restyle({ ambience: (event.currentTarget as HTMLInputElement).checked }); }, live);
    root.querySelector<HTMLInputElement>('#style-clicks')?.addEventListener('change', event => { unlockAudio(); restyle({ clicks: (event.currentTarget as HTMLInputElement).checked }); if ((event.currentTarget as HTMLInputElement).checked) playSound('tap'); }, live);
    root.querySelector<HTMLInputElement>('#style-volume')?.addEventListener('change', event => { const v = Number((event.currentTarget as HTMLInputElement).value); setVolume(v / 100); restyle({ volume: v }); unlockAudio(); setTimeout(() => playSound('chip'), 40); }, live);
    root.querySelector<HTMLSelectElement>('#style-tokes')?.addEventListener('change', event => { const v = (event.currentTarget as HTMLSelectElement).value; restyle({ tokes: v === 'one' || v === 'regular' ? v : 'off' }); }, live);
    root.querySelector<HTMLInputElement>('#style-dealer-voice')?.addEventListener('change', event => { const on = (event.currentTarget as HTMLInputElement).checked; restyle({ dealerVoice: on }); if (on) speakDealer(['Dealer voice on.']); }, live);
    root.querySelector<HTMLInputElement>('#style-sound')?.addEventListener('change', event => { const on = (event.currentTarget as HTMLInputElement).checked; if (on) { unlockAudio(); setTimeout(() => { if (style.sound) playSound('chip'); }, 60); } restyle({ sound: on }); }, live);
    root.querySelectorAll<HTMLInputElement>('#table-motion').forEach(box => box.addEventListener('change', () => { motion = box.checked; saveMotion(motion); render(); }, live));
    root.querySelectorAll<HTMLInputElement>('#table-talk,#t-table-talk').forEach(box => box.addEventListener('change', () => { tableTalk = box.checked; saveTableTalk(tableTalk); render(); }, live));
    const slotDo = (work: () => void) => () => { try { work(); } catch (cause) { slotsUi.error = (cause as Error).message; } render(); };
    root.querySelectorAll<HTMLButtonElement>('[data-slot-machine]').forEach(b => b.addEventListener('click', () => { slotsPlayer.open(b.dataset.slotMachine!); render(); const scroller = document.scrollingElement; if (scroller) scroller.scrollTop = 0; }, live));
    on('#slots-back', slotDo(() => slotsPlayer.back()));
    root.querySelectorAll<HTMLButtonElement>('[data-slot-bet]').forEach(b => b.addEventListener('click', slotDo(() => slotsPlayer.setBet(Number(b.dataset.slotBet))), live));
    /* Phase 10 (P10-F05): the paytable's own bet-size switcher — view-only. */
    root.querySelectorAll<HTMLButtonElement>('[data-slot-paybet]').forEach(b => b.addEventListener('click', () => { if (slotsUi.machine) { slotsUi.payBet[slotsUi.machine] = Number(b.dataset.slotPaybet); render(); } }, live));
    on('#slots-spin', () => { if (slotsUi.phase === 'idle' || slotsUi.phase === 'done') slotsUi.auto = 0; slotsPlayer.press(); });
    on('#slots-slam', () => slotsPlayer.slam());
    on('#slots-skip', () => slotsPlayer.skip());
    root.querySelectorAll<HTMLButtonElement>('[data-slot-pick]').forEach(b => b.addEventListener('click', () => slotsPlayer.pick(Number(b.dataset.slotPick)), live));
    on('#slots-max', slotDo(() => slotsPlayer.maxBet()));
    on('#slots-pays', () => { const table = root.querySelector<HTMLDetailsElement>('#slot-paytable'); if (table) { table.open = true; table.scrollIntoView({ block: 'start' }); } });
    on('#slots-turbo', slotDo(() => slotsPlayer.toggleTurbo()));
    on('#slots-auto', slotDo(() => { slotsUi.autoOpen = !slotsUi.autoOpen; }));
    on('#slots-auto-start', () => slotsPlayer.startAuto());
    on('#slots-stop', slotDo(() => slotsPlayer.stopAuto()));
    root.querySelectorAll<HTMLButtonElement>('[data-auto-count]').forEach(b => b.addEventListener('click', slotDo(() => slotsPlayer.setPlan({ count: Number(b.dataset.autoCount) })), live));
    root.querySelector<HTMLInputElement>('#auto-stop-feature')?.addEventListener('change', e => { slotsPlayer.setPlan({ stopFeature: (e.target as HTMLInputElement).checked }); }, live);
    root.querySelector<HTMLInputElement>('#auto-stop-big')?.addEventListener('change', e => { slotsPlayer.setPlan({ stopBig: (e.target as HTMLInputElement).checked }); }, live);
    root.querySelector<HTMLSelectElement>('#auto-loss')?.addEventListener('change', e => { slotsPlayer.setPlan({ lossLimit: Number((e.target as HTMLSelectElement).value) }); }, live);
    on('#slots-reload', slotDo(() => slotsPlayer.reload()));
    // Patch 99: the casino tables.
    root.querySelectorAll<HTMLButtonElement>('[data-casino-chip]').forEach(b => b.addEventListener('click', () => casino.setChip(Number(b.dataset.casinoChip)), live));
    on('#casino-reload', () => casino.reload());
    root.querySelectorAll<HTMLButtonElement>('[data-wheel]').forEach(b => b.addEventListener('click', () => casino.setWheel(b.dataset.wheel as 'european' | 'american'), live));
    root.querySelectorAll<HTMLButtonElement>('[data-rbet]').forEach(b => b.addEventListener('click', () => { const [kind, ns] = b.dataset.rbet!.split('|'); casino.placeRoulette(kind as never, ns.split('-').map(Number)); }, live));
    on('#roulette-spin', () => casino.spinRoulette()); on('#roulette-undo', () => casino.undoRoulette()); on('#roulette-clear', () => casino.clearRoulette()); on('#roulette-rebet', () => casino.rebetRoulette());
    root.querySelectorAll<HTMLButtonElement>('[data-bspot]').forEach(b => b.addEventListener('click', () => casino.placeBaccarat(b.dataset.bspot as never), live));
    on('#bac-deal', () => casino.dealBaccarat()); on('#bac-clear', () => casino.clearBaccarat()); on('#bac-rebet', () => casino.rebetBaccarat());
    root.querySelectorAll<HTMLButtonElement>('[data-cspot]').forEach(b => b.addEventListener('click', () => casino.crapsSpot(b.dataset.cspot as never), live));
    on('#craps-roll', () => casino.rollCraps()); on('#craps-takedown', () => casino.toggleTakeDown());
    root.querySelectorAll<HTMLButtonElement>('[data-race-kind]').forEach(b => b.addEventListener('click', () => casino.setRaceKind(b.dataset.raceKind as never), live));
    root.querySelectorAll<HTMLButtonElement>('[data-race-pick]').forEach(b => b.addEventListener('click', () => casino.pickRunner(Number(b.dataset.racePick)), live));
    root.querySelectorAll<HTMLButtonElement>('[data-race-remove]').forEach(b => b.addEventListener('click', () => casino.removeRaceBet(Number(b.dataset.raceRemove)), live));
    // Patch 100.
    root.querySelectorAll<HTMLButtonElement>('[data-neighbours]').forEach(b => b.addEventListener('click', () => casino.placeNeighbours(Number(b.dataset.neighbours)), live));
    root.querySelectorAll<HTMLButtonElement>('[data-announced]').forEach(b => b.addEventListener('click', () => casino.placeAnnounced(b.dataset.announced as never), live));
    root.querySelector<HTMLInputElement>('#bac-ez')?.addEventListener('change', e => casino.setEz((e.target as HTMLInputElement).checked), live);
    root.querySelector<HTMLInputElement>('#bac-squeeze')?.addEventListener('change', e => casino.setSqueeze((e.target as HTMLInputElement).checked), live);
    on('[data-bac-peel]', () => casino.peel()); on('#craps-same', () => casino.sameBets());
    // Patch 101.
    root.querySelector<HTMLInputElement>('#rl-partage')?.addEventListener('change', e => casino.setPartage((e.target as HTMLInputElement).checked), live);
    root.querySelectorAll<HTMLButtonElement>('[data-finals]').forEach(b => b.addEventListener('click', () => casino.placeFinals(Number(b.dataset.finals)), live));
    on('#rl-save', () => casino.saveFavourite());
    root.querySelectorAll<HTMLButtonElement>('[data-fav]').forEach(b => b.addEventListener('click', () => casino.useFavourite(Number(b.dataset.fav)), live));
    root.querySelectorAll<HTMLButtonElement>('[data-fav-del]').forEach(b => b.addEventListener('click', () => casino.deleteFavourite(Number(b.dataset.favDel)), live));
    root.querySelectorAll<HTMLButtonElement>('[data-auto-spin]').forEach(b => b.addEventListener('click', () => casino.autoSpin(Number(b.dataset.autoSpin), root.querySelector<HTMLInputElement>('#rl-stop-win')?.checked ?? true), live));
    root.querySelectorAll<HTMLButtonElement>('[data-auto-deal]').forEach(b => b.addEventListener('click', () => casino.autoDeal(Number(b.dataset.autoDeal)), live));
    on('#casino-stop-auto', () => casino.stopAuto()); on('#craps-horn', () => casino.placeHorn()); on('#craps-press', () => casino.pressPlace()); on('#race-replay', () => casino.replayRace());
    // Patch 102.
    root.querySelectorAll<HTMLButtonElement>('[data-rt-width]').forEach(b => b.addEventListener('click', () => casino.setWidth(Number(b.dataset.rtWidth)), live));
    root.querySelectorAll<HTMLButtonElement>('[data-odds-x]').forEach(b => b.addEventListener('click', () => casino.setOddsX(b.dataset.oddsX as '345' | '10'), live));
    // Patch 105: the Live coach.
    root.querySelector<HTMLInputElement>('#coach-on')?.addEventListener('change', e => { coachUi.on = (e.target as HTMLInputElement).checked; if (!coachUi.on) { coachUi.review = null; coachUi.last = null; } saveCoachUi(coachUi); render(); }, live);
    on('#coach-enable', () => { coachUi.on = true; saveCoachUi(coachUi); render(); });
    /* Phase 10 (P10-F01): expand/collapse the coach card's "why" on compact viewports. */
    root.querySelectorAll<HTMLButtonElement>('[data-coach-toggle]').forEach(el => el.addEventListener('click', () => { const key = el.dataset.coachToggle!; coachUi.expandedKey = coachUi.expandedKey === key ? null : key; render(); }, live));
    root.querySelector<HTMLInputElement>('#coach-test')?.addEventListener('change', e => { coachUi.test = (e.target as HTMLInputElement).checked; coachUi.revealed = null; saveCoachUi(coachUi); render(); }, live);
    on('#coach-reveal', () => { coachUi.revealed = coachUi.last?.key ?? null; render(); });
    root.querySelectorAll<HTMLButtonElement>('[data-coach-size]').forEach(b => b.addEventListener('click', () => { const to = Number(b.dataset.coachSize); if (!Number.isSafeInteger(to)) return; if (view === 'tournaments') tournamentDraft = String(to); else { raiseValue = to; sliderPercent = null; } render(); }, live));
    root.querySelector<HTMLInputElement>('#odds-helper-on')?.addEventListener('change', e => { try { localStorage.setItem(ODDS_HELPER_KEY, (e.target as HTMLInputElement).checked ? 'on' : 'off'); } catch { /* this visit only */ } render(); }, live);
    root.querySelectorAll<HTMLButtonElement>('[data-special]').forEach(b => b.addEventListener('click', () => casino.placeSpecial(b.dataset.special as never), live));
    root.querySelector<HTMLInputElement>('#craps-working')?.addEventListener('change', e => casino.setWorking((e.target as HTMLInputElement).checked), live);
    root.querySelector<HTMLInputElement>('#race-box')?.addEventListener('change', e => casino.setBox((e.target as HTMLInputElement).checked), live);
    root.querySelectorAll<HTMLButtonElement>('[data-cz-say]').forEach(b => b.addEventListener('click', () => { const g = b.closest<HTMLElement>('[data-cz-game]')?.dataset.czGame; if (g === 'roulette' || g === 'craps' || g === 'baccarat' || g === 'races') casino.casinoSay(g, b.dataset.czSay!); }, live));
    on('#roulette-double', () => casino.doubleRoulette()); on('#bac-shuffle', () => casino.shuffleShoe()); on('#craps-ce', () => casino.placeGroup('ce')); on('#craps-world', () => casino.placeGroup('world'));
    root.querySelector<HTMLInputElement>('#race-quick')?.addEventListener('change', e => casino.setQuick((e.target as HTMLInputElement).checked), live);
    on('#race-start', () => { casino.startRace(); render(); root.querySelector('.rc-track')?.scrollIntoView({ block: 'center' }); }); on('#race-clear', () => casino.clearRace()); on('#race-next', () => casino.nextRace());
    root.querySelectorAll<HTMLButtonElement>('[data-slot-fav]').forEach(b => b.addEventListener('click', slotDo(() => slotsPlayer.toggleFav(b.dataset.slotFav!)), live));
    root.querySelector<HTMLSelectElement>('#slot-sort')?.addEventListener('change', slotDo(() => slotsPlayer.setSort(root.querySelector<HTMLSelectElement>('#slot-sort')!.value)), live);
    root.querySelectorAll<HTMLButtonElement>('[data-slot-floor]').forEach(b => b.addEventListener('click', slotDo(() => { slotsUi.floor = b.dataset.slotFloor as typeof slotsUi.floor; }), live));
    on('#slots-gamble', slotDo(() => slotsPlayer.openGamble()));
    root.querySelectorAll<HTMLButtonElement>('[data-gamble]').forEach(b => b.addEventListener('click', slotDo(() => slotsPlayer.choose(b.dataset.gamble as GambleChoice)), live));
    on('#slots-collect', slotDo(() => slotsPlayer.collect()));
    root.querySelectorAll<HTMLButtonElement>('[data-straddle-choice]').forEach(button => button.addEventListener('click', () => { void controller.setHeroStraddle(button.dataset.straddleChoice === 'on').then(() => render()); }, live));
    root.querySelector<HTMLInputElement>('#hero-straddle')?.addEventListener('change', event => { void controller.setHeroStraddle((event.target as HTMLInputElement).checked).then(() => { render(); root.querySelector<HTMLElement>('#hero-straddle')?.focus(); }); }, live);
    root.querySelector<HTMLInputElement>('#auto-deal')?.addEventListener('change', event => { autoDeal = (event.target as HTMLInputElement).checked; try { localStorage.setItem(AUTO_DEAL_KEY, autoDeal ? '1' : '0'); } catch { /* preference only */ } autoDealHeld = ''; if (!autoDeal) cancelAutoDeal(); render(); root.querySelector<HTMLElement>('#auto-deal')?.focus(); }, live);
    if (shown) on('#skip-to-turn', () => { skipToTurn = skipToTurn === shown.handId ? '' : shown.handId; render(); root.querySelector<HTMLElement>('#skip-to-turn')?.focus(); });
    if (shown) on('#pre-check-fold', () => { const key = `${shown.handId}:${shown.street}`; preCheckFold = preCheckFold === key ? '' : key; render(); root.querySelector<HTMLElement>('#pre-check-fold')?.focus(); });
    const setupHandId = game?.handId ?? null;
    root.querySelector('#setup-form')?.addEventListener('invalid', event => { for (let section = (event.target as HTMLElement).closest('details'); section; section = section.parentElement?.closest('details') ?? null) if (!section.open) section.open = true; }, { capture: true, signal: live.signal });
    root.querySelector('#setup-form')?.addEventListener('submit', event => { event.preventDefault(); if ((game?.handId ?? null) !== setupHandId) return; const active=controller.data?.active;if(!active){startSession();return;}try{readSettings();void run(async()=>{await controller.queueConfiguration(settings,active.sessionId,active.game.handId);if(controller.error)throw new Error(controller.error);sessionNotice='Next-hand settings saved. The active hand is unchanged; deal the next hand after settlement to apply them.';});}catch(cause){error=(cause as Error).message;render();} }, live);
    on('#cancel-queued-config',()=>{const active=controller.data?.active,queued=active?.queuedConfiguration;if(active&&queued)void run(()=>controller.cancelQueuedConfiguration(active.sessionId,queued.id));});
    on('#change-table', () => {
      const a = controller.data?.active; if (!a || a.game.street !== 'complete' || unavailable()) return;
      const stack = a.game.seats.find(seat => seat.id === 0)?.stack ?? 0;
      void run(async () => { await controller.cashOut(); if (!controller.data?.active) { openTablePicker(stack > 0 ? `Table change: the floor has three other tables. Your ${money(stack)} comes with you.` : 'Table change: pick your new table and buy in.', stack > 0 ? stack : undefined); view = 'live'; } });
    });
    on('#home-quick', () => { view = 'live'; render(); root.querySelector<HTMLButtonElement>('#quick-start-live')?.click(); });
    on('#home-pick', () => { if (game || unavailable()) return; openTablePicker(); view = 'live'; render(); root.querySelector<HTMLElement>('#table-actions')?.focus(); });
    on('#home-drill', event => { pendingDrillId = (event.currentTarget as HTMLButtonElement).dataset.drillId ?? ''; coachScope = 'recent'; view = 'coach'; render(); root.querySelector('.drill')?.scrollIntoView({ block: 'start' }); });
    on('#career-start', () => { const d = controller.data; if (!d || d.active) return; career = startCareer(d.wallet); saveCareer(career); render(); });
    on('#career-up', () => { const d = controller.data; if (!d || !career) return; const st = careerStatus(d, career); if (!st.canMoveUp) return; career = changeLevel(career, 1, st); saveCareer(career); render(); });
    on('#career-down', () => { const d = controller.data; if (!d || !career) return; const st = careerStatus(d, career); if (!st.mustMoveDown) return; career = changeLevel(career, -1, st); saveCareer(career); render(); });
    on('#career-end', () => { if (!career || !window.confirm('End this career? Your hands and bankroll stay; only the career story is cleared.')) return; career = null; saveCareer(null); render(); });
    if (view === 'omaha' && plo) {
      root.querySelectorAll<HTMLButtonElement>('[data-plo-stakes]').forEach(el => el.addEventListener('click', () => { ploUi.stakes = el.dataset.ploStakes!; render(); }, live));
      root.querySelectorAll<HTMLButtonElement>('[data-plo-buyin]').forEach(el => el.addEventListener('click', () => { ploUi.buyInBB = Number(el.dataset.ploBuyin); render(); }, live));
      on('#plo-sit', () => { if (controller.data?.active) { ploUi.error = 'Finish your Hold’em table first.'; ploUi.blockedByTable = true; render(); return; } ploDo(() => plo!.sit(ploUi.stakes, ploUi.buyInBB)); });
      on('#plo-reset', () => ploDo(() => plo!.resetBalance()));
      on('#plo-fold', () => ploDo(() => plo!.act({ type: 'fold' })));
      on('#plo-check', () => ploDo(() => plo!.act({ type: 'check' })));
      on('#plo-call', () => ploDo(() => plo!.act({ type: 'call' })));
      on('#plo-raise', () => ploDo(() => { const to = Number(root.querySelector<HTMLInputElement>('#plo-raise-to')?.value); ploUi.raiseTo = null; plo!.act({ type: 'raise', to }); }));
      root.querySelectorAll<HTMLButtonElement>('[data-plo-size]').forEach(el => el.addEventListener('click', () => { ploUi.raiseTo = Number(el.dataset.ploSize); render(); }, live));
      root.querySelector<HTMLInputElement>('#plo-raise-to')?.addEventListener('input', event => { const v = Number((event.currentTarget as HTMLInputElement).value); ploUi.raiseTo = v; const label = root.querySelector('#plo-raise-label'); if (label) label.textContent = money(v); const btn = root.querySelector('#plo-raise'); if (btn) btn.textContent = `${btn.textContent?.startsWith('Bet') ? 'Bet' : 'Raise to'} ${money(v)}`; }, live);
      root.querySelector<HTMLInputElement>('#plo-fast')?.addEventListener('change', event => { ploUi.fast = (event.currentTarget as HTMLInputElement).checked; try { localStorage.setItem('poker-night-ai:plo-fast', ploUi.fast ? '1' : '0'); } catch { /* this visit only */ } }, live);
      on('#plo-next', () => ploDo(() => plo!.nextHand()));
      on('#plo-rebuy', () => ploDo(() => plo!.rebuy()));
      on('#plo-leave', () => ploDo(() => { if (ploTimer) { clearTimeout(ploTimer); ploTimer = 0; ploUi.thinking = false; } plo!.leave(); }));
    }
    on('#hu-finish', () => { huFinish = true; void checkChallenge(); });
    root.querySelectorAll<HTMLButtonElement>('[data-hu-rung]').forEach(el => el.addEventListener('click', () => startChallenge(Number(el.dataset.huRung)), live));
    on('#career-play', () => { if (game || unavailable() || !career) return; try { openTablePicker(`Career table · ${stakeName(career.level)}.`, undefined, career.level); view = 'live'; } catch (cause) { error = (cause as Error).message; } render(); root.querySelector<HTMLElement>('#table-actions')?.focus(); });
    on('#pick-table', () => { if (game || unavailable()) return; openTablePicker(); render(); root.querySelector<HTMLElement>('#table-actions')?.focus(); });
    on('#pick-cancel', () => { tablePick = null; render(); });
    on('#pick-refresh', () => { if (tablePick) { const note = tablePick.note; openTablePicker(note, tablePick.tables[0].settings.buyIn); } render(); });
    on('#pick-back', () => { if (tablePick) tablePick.chosen = null; render(); });
    root.querySelectorAll<HTMLButtonElement>('[data-pick-table]').forEach(button => button.addEventListener('click', () => { if (!tablePick) return; tablePick.chosen = Number(button.dataset.pickTable); render(); root.querySelector<HTMLElement>('#table-actions')?.focus(); }, live));
    on('#seat-left', () => { const t = tablePick; if (t?.chosen != null) { t.tables[t.chosen] = { ...t.tables[t.chosen], settings: moveSeat(t.tables[t.chosen].settings, -1) }; render(); root.querySelector<HTMLElement>('#seat-left')?.focus(); } });
    on('#seat-right', () => { const t = tablePick; if (t?.chosen != null) { t.tables[t.chosen] = { ...t.tables[t.chosen], settings: moveSeat(t.tables[t.chosen].settings, 1) }; render(); root.querySelector<HTMLElement>('#seat-right')?.focus(); } });
    on('#take-seat', () => {
      const t = tablePick; if (!t || t.chosen === null) return;
      if (!t.tables[t.chosen].full) { sitAtPicked(); return; }
      const ahead = t.tables[t.chosen].ahead, ms = 3000 + 2500 * ahead; t.waiting = { until: Date.now() + ms, ahead };
      const tick = () => { if (tablePick !== t || !t.waiting) return; if (Date.now() >= t.waiting.until) { sitAtPicked(); return; } render(); setTimeout(tick, 1000); };
      render(); setTimeout(tick, 1000);
    });
    on('#quick-start-live',()=>{if(game||unavailable())return;settings=initializeOpponentSettings(syntheticLiveOneTwoPreset(settings));discardSetupDraft=true;void run(async()=>{await controller.startSession(settings);if(controller.data?.active){view='live';sessionNotice='Synthetic live $1/$2 practice table started: nine players, $300 default stacks. Host setup remains editable for the next hand.';}});});
    root.querySelector<HTMLSelectElement>('#saved-preset')?.addEventListener('change',event=>{presetChoice=(event.target as HTMLSelectElement).value;presetName=controller.data?.namedPresets?.find(preset=>preset.id===presetChoice)?.name??'';discardSetupDraft=true;render();}, live);
    root.querySelector<HTMLInputElement>('#preset-name')?.addEventListener('input',event=>{presetName=(event.target as HTMLInputElement).value;}, live);
    on('#preset-save',()=>{try{readSettings();void run(async()=>{await controller.savePreset(presetName,settings);if(controller.error)throw new Error(controller.error);presetChoice=controller.data?.namedPresets?.find(preset=>preset.name===presetName.trim())?.id??presetChoice;discardSetupDraft=true;sessionNotice='Named preset saved. Existing presets and history were preserved.';});}catch(cause){error=(cause as Error).message;render();}});
    on('#preset-update',()=>{try{readSettings();void run(async()=>{await controller.savePreset(presetName,settings,presetChoice);if(controller.error)throw new Error(controller.error);discardSetupDraft=true;sessionNotice='Selected preset updated. Other presets and saved hand histories were preserved.';});}catch(cause){error=(cause as Error).message;render();}});
    on('#preset-load',()=>{try{const saved=controller.loadPreset(presetChoice);settings=initializeOpponentSettings(structuredClone(saved));discardSetupDraft=true;sessionNotice='Preset loaded for editing only. Start or queue it to use these settings.';render();}catch(cause){error=(cause as Error).message;render();}});
    on('#preset-clone',()=>{void run(async()=>{await controller.clonePreset(presetChoice,presetName);if(controller.error)throw new Error(controller.error);presetChoice=controller.data?.namedPresets?.find(preset=>preset.name===presetName.trim())?.id??presetChoice;settings=initializeOpponentSettings(controller.loadPreset(presetChoice));discardSetupDraft=true;sessionNotice='Preset cloned and loaded for editing. Update selected preset after changing it; the original is preserved.';});});
    root.querySelectorAll<HTMLDetailsElement>('.setup-section[id]').forEach(details=>details.addEventListener('toggle',()=>{ if(details.open)openSetupSections.add(details.id);else openSetupSections.delete(details.id); }, live));
    root.querySelectorAll<HTMLDetailsElement>('[data-opponent-card]').forEach(details=>details.addEventListener('toggle',()=>{ const seat=Number(details.dataset.opponentCard);if(details.open)openOpponentCards.add(seat);else openOpponentCards.delete(seat); }, live));
    root.querySelectorAll<HTMLDetailsElement>('[data-opponent-details]').forEach(details=>details.addEventListener('toggle',()=>{ const seat=Number(details.dataset.opponentDetails);if(details.open)openOpponentDetails.add(seat);else openOpponentDetails.delete(seat); }, live));
    root.querySelectorAll<HTMLSelectElement>('[data-opponent-selection], #population').forEach(select=>select.addEventListener('change',()=>{ try { readSettings(); render(); } catch(cause) { error=(cause as Error).message; render(); } }, live));
    root.querySelector<HTMLDetailsElement>('#player-notes-details')?.addEventListener('toggle',event=>{const details=event.target as HTMLDetailsElement;if(!root.contains(details))return;const next=details.open;if(notesOpen!==next){const focused=document.activeElement===details.querySelector('summary');notesOpen=next;render();if(focused)root.querySelector<HTMLElement>('#player-notes-details summary')?.focus();}}, live);
    root.querySelector<HTMLSelectElement>('#player-note-session')?.addEventListener('change',event=>{notesSession=(event.target as HTMLSelectElement).value;noteNotice='';render();}, live);
    root.querySelector<HTMLSelectElement>('#player-note-seat')?.addEventListener('change',event=>{notesSeat=Number((event.target as HTMLSelectElement).value);noteNotice='';render();}, live);
    const noteSessionAtRender=notesSession,noteSeatAtRender=notesSeat,keyAtRender=noteKey();
    const savedNoteAtRender=controller.data&&notesSession?getPlayerNote(controller.data,notesSession,notesSeat):undefined;
    root.querySelector<HTMLTextAreaElement>('#player-note-text')?.addEventListener('input',event=>{if(noteKey()!==keyAtRender)return;const prior=noteDrafts.get(keyAtRender);noteDrafts.set(keyAtRender,{text:(event.target as HTMLTextAreaElement).value,revision:prior?.revision??savedNoteAtRender?.revision??0});const help=root.querySelector('#player-note-help');if(help)help.textContent='Up to 500 characters. Unsaved draft — kept while play updates.';}, live);
    on('#save-player-note',()=>{if(view!=='live'||noteKey()!==keyAtRender)return;const draft=noteDrafts.get(keyAtRender)??{text:savedNoteAtRender?.text??'',revision:savedNoteAtRender?.revision??0};noteDrafts.set(keyAtRender,draft);void run(async()=>{const saved=await controller.savePlayerNote(noteSessionAtRender,noteSeatAtRender,draft.text,draft.revision);if(saved){const current=noteDrafts.get(keyAtRender);if(current===draft)noteDrafts.delete(keyAtRender);else if(current)noteDrafts.set(keyAtRender,{text:current.text,revision:getPlayerNote(controller.data!,noteSessionAtRender,noteSeatAtRender)?.revision??0});noteNotice='Note saved on this device.';}else{noteNotice=controller.error||'Note was not saved. Your draft is kept; retry when the current save finishes.';}},false);});
    on('#reload-player-note',()=>{if(view!=='live'||noteKey()!==keyAtRender)return;noteDrafts.delete(keyAtRender);noteNotice='Saved note reloaded. The unsaved draft was discarded.';render();});
    on('#delete-player-note',()=>{if(view!=='live'||noteKey()!==keyAtRender||!savedNoteAtRender)return;const submitted=noteDrafts.get(keyAtRender),expected=submitted?.revision??savedNoteAtRender.revision;void run(async()=>{const deleted=await controller.deletePlayerNote(noteSessionAtRender,noteSeatAtRender,expected);if(deleted){const current=noteDrafts.get(keyAtRender);if(current===submitted)noteDrafts.delete(keyAtRender);else if(current)noteDrafts.set(keyAtRender,{text:current.text,revision:0});noteNotice='Saved note deleted.';}else{noteNotice=controller.error||'Note was not deleted. Your draft is kept; review the current saved note and retry.';}},false);});
    on('#reveal-session-styles',event=>{const expected=(event.currentTarget as HTMLButtonElement).dataset.sessionInsight;if(view!=='opponents'||!expected||opponentStudySession!==expected||!controller.data||controller.status!=='ready'||!canRevealSessionStyles(controller.data,expected))return;try{recordedSessionStyles(controller.data,expected);revealedStyleSession=revealedStyleSession===expected?'':expected;render();}catch(cause){error=(cause as Error).message;render();}});
    root.querySelectorAll<HTMLButtonElement>('[data-tstats-format],[data-tstats-tier],[data-tstats-recent]').forEach(button=>button.addEventListener('click',()=>{const d=button.dataset;statsFilter={format:(d.tstatsFormat as StatsFilter['format'])??statsFilter.format,tier:(d.tstatsTier as StatsFilter['tier'])??statsFilter.tier,recent:(d.tstatsRecent as StatsFilter['recent'])??statsFilter.recent};render();},live));
    on('#seat-regulars',()=>{ try { readSettings(); settings=seatRegulars(settings); openOpponentDetails.clear(); openOpponentCards.clear(); discardSetupDraft=true; render(); } catch(cause) { error=(cause as Error).message; render(); } });
    on('#randomize-lineup',()=>{ try { readSettings(); settings=randomizeOpponentSettings(settings); openOpponentDetails.clear(); openOpponentCards.clear(); discardSetupDraft=true; render(); } catch(cause) { error=(cause as Error).message; render(); } });
    root.querySelector<HTMLSelectElement>('#opponent-study-session')?.addEventListener('change',event=>{opponentStudySession=(event.target as HTMLSelectElement).value;revealedStyleSession='';render();}, live);
    root.querySelector<HTMLSelectElement>('#coach-scope')?.addEventListener('change', event => { coachScope = (event.target as HTMLSelectElement).value; drillIndex = 0; render(); }, live);
    root.querySelectorAll<HTMLButtonElement>('[data-drill-choice]').forEach(button => button.addEventListener('click', () => { const d = coachCache?.drills[drillIndex]; if (!d || drillPicks.has(d.id)) return; drillPicks.set(d.id, button.dataset.drillChoice as DrillChoice); render(); root.querySelector('.drill-result')?.scrollIntoView({ block: 'nearest' }); }, live));
    root.querySelector('#drill-next')?.addEventListener('click', () => { drillIndex++; render(); root.querySelector('.drill')?.scrollIntoView({ block: 'start' }); }, live);
    root.querySelector('#drill-restart')?.addEventListener('click', () => { for (const d of coachCache?.drills ?? []) drillPicks.delete(d.id); drillIndex = 0; render(); }, live);
    root.querySelectorAll<HTMLButtonElement>('[data-coach-session]').forEach(button => button.addEventListener('click', () => { coachScope = button.dataset.coachSession!; drillIndex = 0; view = 'coach'; ensureTournament(); render(); window.scrollTo(0, 0); }, live));
    root.querySelector<HTMLSelectElement>('#seat-count')?.addEventListener('change', event => { const selector=event.target as HTMLSelectElement;const selected=Number(selector.value);try{selector.value=String(settings.seats);readSettings();settings={...settings,seats:selected,capacity:settings.capacity===undefined||settings.capacity===settings.seats?selected:Math.max(settings.capacity,selected),occupiedSeatIds:Array.from({length:selected},(_,id)=>id)};discardSetupDraft=true;render();}catch(cause){error=(cause as Error).message;render();} }, live);
    root.querySelector<HTMLSelectElement>('#table-capacity')?.addEventListener('change',()=>{try{readSettings();discardSetupDraft=true;render();}catch(cause){error=(cause as Error).message;render();}}, live);
    root.querySelectorAll<HTMLInputElement>('[data-occupied-seat]').forEach(input=>input.addEventListener('change',()=>{const count=root.querySelectorAll('[data-occupied-seat]:checked').length;const selector=root.querySelector<HTMLSelectElement>('#seat-count');if(selector)selector.value=String(count);try{readSettings();discardSetupDraft=true;render();}catch(cause){error=(cause as Error).message;render();}}, live));
    root.querySelector<HTMLSelectElement>('#stake-select')?.addEventListener('change', event => { const selector=event.target as HTMLSelectElement; const chosen=selector.value; try { selector.value=settings.stake; readSettings(false); if(chosen!=='custom'&&settings.rakeMode==='pokerstars-usd-2026')pokerStarsProfile(...PRESETS[Number(chosen)] as [number,number]); settings.stake=chosen; if(chosen!=='custom'){[settings.smallBlind,settings.bigBlind]=PRESETS[Number(chosen)];settings.buyIn=settings.bigBlind*100;} discardSetupDraft=true; render(); } catch (cause) { error = (cause as Error).message; render(); } }, live);
    root.querySelector<HTMLSelectElement>('#rake-mode')?.addEventListener('change', event => {
      const selected = (event.target as HTMLSelectElement).value;
      try {
        // Preserve currently visible fields before adding/removing the custom field group.
        const selector = event.target as HTMLSelectElement;
        selector.value = settings.rakeMode;
        readSettings(false);
        if(selected==='pokerstars-usd-2026')pokerStarsProfile(settings.smallBlind,settings.bigBlind);
        settings.rakeMode = selected==='pokerstars-usd-2026'?'pokerstars-usd-2026':selected === 'custom' ? 'custom' : 'none';
        if(settings.rakeMode==='pokerstars-usd-2026')settings.chipUnit=1;
        discardSetupDraft=true;
        render();
      } catch (cause) { error = (cause as Error).message; render(); }
    }, live);
    if (shown) {
      on('#panel-peek-toggle', () => { const heroTurn = shown.street !== 'complete' && shown.actor === 0; panelPeekChoice = !(panelPeekChoice ?? !heroTurn); render(); });
      on('#fold', () => submit({ type: 'fold' }, shown.handId, shown.revision));
      on('#call', () => submit({ type: shown.legal.check ? 'check' : 'call' }, shown.handId, shown.revision));
      on('#raise', () => { const input = root.querySelector<HTMLInputElement>('#raise-to'); try { const value = cents(input?.value ?? ''); const legal = shown.legal; const minimum = legal.shortAllInTo ?? legal.minRaiseTo; const maximum = legal.maxRaiseTo ?? legal.shortAllInTo; if (minimum === null || maximum === null || value < minimum || value > maximum) throw new Error(`Enter a legal total between ${money(minimum ?? 0)} and ${money(maximum ?? 0)}.`); submit({ type: 'raise', to: value }, shown.handId, shown.revision); } catch (cause) { error = (cause as Error).message; render(); } });
      const sizingContext: SizingContext = {pot:shown.pot,streetCommitted:shown.seats.find(seat=>seat.id===0)!.streetCommitted,bigBlind:shown.profile.bigBlind,chipUnit:shown.profile.chipUnit,legal:shown.legal};
      const showPercent=(percent:number|null)=>{ const output=root.querySelector('#pot-slider-value');if(output)output.textContent=percent===null?'—':`${percent}%`; const slider=root.querySelector<HTMLInputElement>('#pot-slider');if(slider){slider.value=String(Math.min(300,percent??0));slider.setAttribute('aria-valuetext',percent===null||!Number.isFinite(raiseValue)?'No size set':`${percent}% of the pot, ${money(raiseValue)} total`);} };
      const updateRaise = (proposal: SizingProposal, updateInput=true, followPercent=true) => {
        raiseValue = proposal.to;
        if(followPercent){ sliderPercent=null; showPercent(potPercentOf(sizingContext,proposal.to)); }
        const amountSlider=root.querySelector<HTMLInputElement>('#amount-slider');
        if(amountSlider&&Number.isFinite(proposal.to)&&document.activeElement!==amountSlider){amountSlider.value=String(proposal.to);amountSlider.setAttribute('aria-valuetext',`${money(proposal.to)} total`);}
        const input=root.querySelector<HTMLInputElement>('#raise-to');
        if(input){ if(updateInput)input.value=String(proposal.to/100); input.setAttribute('aria-invalid',String(!proposal.legal)); }
        const button = root.querySelector('#raise-button-value'); if (button) button.textContent = Number.isFinite(proposal.to)?money(proposal.to):'—';
        const actionLabel = root.querySelector('#raise-action-label'); if (actionLabel) actionLabel.textContent = `${proposal.to === shown.legal.maxRaiseTo ? 'All-in' : shown.legal.callAmount === 0 && sizingContext.streetCommitted === 0 ? 'Bet' : 'Raise'} to`;
        const additional = root.querySelector('#raise-additional'); if (additional) additional.textContent = Number.isFinite(proposal.additional)?`${money(Math.max(0,proposal.additional))} additional`:'Enter an amount';
        const validation=root.querySelector('#sizing-validation');if(validation)validation.textContent=sizingMessage(proposal);
        const commit=root.querySelector<HTMLButtonElement>('#raise');if(commit)commit.disabled=!proposal.legal || unavailable() || paused || shown.actor!==0;
      };
      const applyPercent=(percent:number)=>{ customPercent=percent; updateRaise(potSizing(sizingContext,percent),true,false); sliderPercent=percent; showPercent(percent); const custom=root.querySelector<HTMLInputElement>('#custom-pot-percent');if(custom)custom.value=String(percent); };
      const safeSizing=(work:()=>void)=>{try{work();}catch(cause){const validation=root.querySelector('#sizing-validation');if(validation)validation.textContent=(cause as Error).message;}};
      root.querySelector<HTMLInputElement>('#raise-to')?.addEventListener('input', event => { const value = (event.target as HTMLInputElement).value; updateRaise(inspectSizing(sizingContext,/^\d+(\.\d{0,2})?$/.test(value)?Math.round(Number(value)*100):NaN),false); }, live);
      // Patch 53: drag from the minimum to all-in; snaps to whole big blinds between the ends.
      root.querySelector<HTMLInputElement>('#amount-slider')?.addEventListener('input',event=>safeSizing(()=>{const el=event.target as HTMLInputElement,lo=Number(el.min),hi=Number(el.max),bb=sizingContext.bigBlind;let v=Number(el.value);v=v>=hi?hi:v<=lo?lo:Math.min(hi,Math.max(lo,Math.round(v/bb)*bb));el.setAttribute('aria-valuetext',`${money(v)} total`);updateRaise(inspectSizing(sizingContext,v));}), live);
      root.querySelector<HTMLInputElement>('#pot-slider')?.addEventListener('input',event=>safeSizing(()=>applyPercent(Number((event.target as HTMLInputElement).value))), live);
      on('#custom-pot-apply',()=>safeSizing(()=>applyPercent(Number(root.querySelector<HTMLInputElement>('#custom-pot-percent')!.value))));
      on('#shortcut-bb-apply',()=>safeSizing(()=>{shortcutBB=Number(root.querySelector<HTMLInputElement>('#shortcut-bb')!.value);updateRaise(bigBlindSizing(sizingContext,shortcutBB));}));
      on('#increment-bb-apply',()=>safeSizing(()=>{incrementBB=Number(root.querySelector<HTMLInputElement>('#increment-bb')!.value);updateRaise(incrementSizing(sizingContext,raiseValue,incrementBB));}));
      root.querySelectorAll<HTMLButtonElement>('[data-step]').forEach(el => el.addEventListener('click', () => {
        const legal = shown.legal, unit = shown.profile.chipUnit;
        const minimum = legal.shortAllInTo ?? legal.minRaiseTo ?? 0, maximum = legal.maxRaiseTo ?? legal.shortAllInTo ?? 0;
        const from = Number.isFinite(raiseValue) ? raiseValue : minimum;
        const stepped = Math.round((from + Number(el.dataset.step) * shown.profile.bigBlind) / unit) * unit;
        updateRaise(inspectSizing(sizingContext, Math.min(maximum, Math.max(minimum, stepped))));
      }, live));
      root.querySelector<HTMLDetailsElement>('#pot-levels')?.addEventListener('toggle', event => { potLevelsOpen = (event.currentTarget as HTMLDetailsElement).open; }, live);
      root.querySelector<HTMLDetailsElement>('#sizing-more')?.addEventListener('toggle', event => { sizingMoreOpen = (event.currentTarget as HTMLDetailsElement).open; }, live);
      root.querySelectorAll<HTMLButtonElement>('[data-size]').forEach(el => el.addEventListener('click', () => {
        const legal = shown.legal; const hero = shown.seats.find(s => s.id === 0)!;
        if (el.dataset.size === 'all' && legal.callAmount > 0 && legal.callAmount === hero.stack) {
          root.querySelector<HTMLButtonElement>('#call')?.focus();
          const guidance = root.querySelector('#action-guidance');
          if (guidance) guidance.textContent = `All-in call selected: ${money(legal.callAmount)} additional. Press Call all-in to commit.`;
          return;
        }
        if(el.dataset.size==='min'||el.dataset.size==='all')updateRaise(inspectSizing(sizingContext,el.dataset.size==='min'?legal.shortAllInTo??legal.minRaiseTo??0:legal.maxRaiseTo??legal.shortAllInTo??0));
        else if(el.dataset.size?.startsWith('bb-'))safeSizing(()=>updateRaise(openSizing(sizingContext,Number(el.dataset.size!.slice(3)))));
        else if(el.dataset.size?.startsWith('x-'))safeSizing(()=>updateRaise(raiseMultipleSizing(sizingContext,Number(el.dataset.size!.slice(2)))));
        else safeSizing(()=>applyPercent(el.dataset.size==='half'?50:el.dataset.size==='pot'?100:Number(el.dataset.size)));
      }, live));
    }
    on('#open-cashier, [data-action="open-cashier"]', () => { view = 'cashier'; error = ''; render(); });
    on('#open-results', () => { view = 'results'; render(); });
    /* Phase 10 (fun #2): the player's own session goal, stored in the daily record. */
    on('#session-goal-set', () => { const input = root.querySelector<HTMLInputElement>('#session-goal-amount'); const sessionId = controller.data?.active?.sessionId; if (!input || !sessionId) return; try { const target = cents(input.value); if (target <= 0) throw new Error('Enter a goal above zero.'); dailyBook = setSessionGoal(dailyBook, { sessionId, targetCents: target }); saveDailyBook(dailyBook); render(); } catch (cause) { error = (cause as Error).message; render(); } });
    on('#session-goal-clear', () => { dailyBook = setSessionGoal(dailyBook, null); saveDailyBook(dailyBook); render(); });
    const livePaceInput=root.querySelector<HTMLInputElement>('#assumed-live-pace');
    const updateLivePace=()=>{
      if(!livePaceInput)return;
      const value=readLivePaceInput(livePaceInput.value),validation=root.querySelector('#live-pace-validation');
      livePaceInput.setAttribute('aria-invalid',String(value===null));
      if(value===null){if(validation)validation.textContent=`Enter 1–1,000 whole hands per hour. The projection still uses ${assumedHandsPerHour}.`;return;}
      assumedHandsPerHour=value;if(validation)validation.textContent='';
      const stats=selectedCashResults()?.stats??cashStats();if(!stats)return;
      const projection=projectLivePace(stats,value);
      const put=(selector:string,text:string)=>{const element=root.querySelector(selector);if(element)element.textContent=text;};
      put('[data-testid="live-equivalent-hours"]',projection.liveEquivalentHours===null?'—':projection.liveEquivalentHours.toFixed(2));
      put('[data-testid="projected-bb-hour"]',projection.projectedBBPerHour===null?'—':projection.projectedBBPerHour.toFixed(2));
      put('[data-testid="projected-profit-hour"]',projection.projectedProfitPerHour===null?'—':signed(Math.round(projection.projectedProfitPerHour)));
      put('#live-pace-disclosure',projection.disclosure);
      root.querySelector<HTMLElement>('[data-testid="live-pace-projection"]')?.setAttribute('data-assumed-hands-per-hour',String(value));
    };
    livePaceInput?.addEventListener('input',updateLivePace, live);
    livePaceInput?.addEventListener('change',updateLivePace, live);
    on('#new-session, [data-action="new-session"]', () => { if(!saveSetupDraft())return; view = game?'session':'host'; error=''; render();root.querySelector('main')?.scrollIntoView({block:'start'}); });
    const endingSession=controller.data?.active;
    for(const [button,mode] of [['#end-complete','finish'],['#end-finish','finish'],['#end-fold','fold']] as const)on(button,()=>{
      if(!endingSession)return;afterExitConfigure=true;clearTimer();
      void run(async()=>{await controller.requestEndSession(mode,endingSession.sessionId,endingSession.game.handId);view=controller.data?.active?'live':'host';});
    });
    on('#continue-session, [data-action="continue-session"]', () => { view = 'live'; if (paused) void run(() => controller.setPaused(false)); else render(); });
    on('#retry-save', () => { clearTimer(); void run(() => controller.retry()); });
    on('#take-over', () => { clearTimer(); void run(() => controller.takeOver()); });
    on('#audit-archive',()=>{archiveNotice='Checking every retained history record…';void run(async()=>{
      try{const result=await controller.auditSavedArchive();archiveNotice=`Verified ${result.hands} hands and bankroll ${money(result.wallet)} at saved revision ${result.revision}. The current save was not changed.`;}
      catch(cause){archiveNotice=`History check did not complete: ${cause instanceof Error?cause.message:'Storage is unavailable.'} No records were reset.`;}
    });});
    on('#compact-history-storage',()=>{maintenanceNotice='Verifying saved history before reducing redundant copies… Poker actions are paused.';void run(async()=>{
      try{const result=await controller.compactSavedHistory();maintenanceNotice=`Storage maintenance completed. All ${result.hands} original hands remain available. Bankroll ${money(result.wallet)} and saved revision ${result.revision} are unchanged. No winnings or payouts were added.`;}
      catch(cause){maintenanceNotice=`Storage maintenance did not complete: ${cause instanceof Error?cause.message:'Storage is unavailable.'} Original records were not reset. Use Retry to verify the saved account before continuing.`;}
    }).then(()=>root.querySelector<HTMLElement>('#storage-maintenance-notice')?.focus({preventScroll:true}));});
    on('#protect-storage', () => {
      void controller.protectStorage().then(granted => {
        protectionNotice = granted ? 'Storage protection was granted by this browser. This reduces automatic eviction risk, but clearing site data still removes the save. Keep exported records.' : 'This browser did not grant persistent-storage protection. Saves remain best-effort local storage; keep exported records.';
        render();
      }).catch(() => { protectionNotice = 'Storage protection could not be requested. Your existing save was not changed.'; render(); });
    });
    wireBackup();
    on('#show-delete-practice',()=>{deleteConfirm=true;render();root.querySelector<HTMLInputElement>('#delete-practice-confirmation')?.focus();});
    on('#cancel-delete-practice',()=>{deleteConfirm=false;render();});
    root.querySelector('#delete-practice-form')?.addEventListener('submit',event=>{event.preventDefault();const confirmation=root.querySelector<HTMLInputElement>('#delete-practice-confirmation')?.value??'';if(confirmation!==DELETE_PRACTICE_CONFIRMATION){error=`Type ${DELETE_PRACTICE_CONFIRMATION} exactly to confirm deletion.`;render();return;}clearTimer();void run(async()=>{await controller.deleteSavedPracticeData(confirmation);if(controller.error)throw new Error(controller.error);if(controller.status!=='deleted')throw new Error('Deletion was not confirmed. Your saved practice was not discarded from this view.');clearPracticeViews();});}, live);
    on('#show-reset', () => { resetConfirm = true; render(); });
    on('#cancel-reset', () => { resetConfirm = false; render(); });
    on('#confirm-reset', () => { void run(async () => { await controller.adjustBankroll(controller.data?.initialBankroll ?? 1000000, 'Reset available bankroll baseline', true); resetConfirm = false; }); });
    root.querySelector('#bankroll-form')?.addEventListener('submit', event => {
      event.preventDefault();
      try { const data = new FormData(event.target as HTMLFormElement); const amount = cents(String(data.get('bankroll'))); const note = String(data.get('note')).trim() || 'Manual bankroll adjustment'; void run(async () => {
        await controller.adjustBankroll(amount,note);
        if (!controller.error) root.querySelector<HTMLFormElement>('#bankroll-form')?.reset();
      }); }
      catch (cause) { error=(cause as Error).message; render(); }
    }, live);
    root.querySelector('#topup-form')?.addEventListener('submit', event => {
      event.preventDefault();
      try { const data = new FormData(event.target as HTMLFormElement); const amount = cents(String(data.get('amount'))); void run(async () => {
        await controller.topUp(amount);
        if (!controller.error) root.querySelector<HTMLFormElement>('#topup-form')?.reset();
      }); }
      catch (cause) { error=(cause as Error).message; render(); }
    }, live);
    on('#cashout', () => { void run(async () => { await controller.cashOut(); view = 'cashier'; }); });
    const filter = (id:string, update:(value:string)=>void) => root.querySelector<HTMLSelectElement>(id)?.addEventListener('change', event => { update((event.target as HTMLSelectElement).value); historyPage=0;replayId=''; render(); }, live);
    filter('#history-session', value => { historySession=value; });
    filter('#history-stake', value => { historyStake=value; });
    filter('#history-result', value => { historyResult=value; });
    root.querySelectorAll<HTMLButtonElement>('[data-session-history]').forEach(button => button.addEventListener('click', () => { historySession=button.dataset.sessionHistory!; historyStake='all'; historyResult='all'; view='study'; render(); }, live));
    root.querySelectorAll<HTMLButtonElement>('[data-replay]').forEach(button => button.addEventListener('click', () => { replayId=button.dataset.replay!; replayFrame=0; replayPlaying=false; replayShareNote=''; render(); root.querySelector('.replay-panel')?.scrollIntoView({block:'start'}); }, live));
    on('[data-configuration-page]',event=>{configurationHistoryPage=Math.max(0,Number((event.currentTarget as HTMLButtonElement).dataset.configurationPage));render();root.querySelector('[data-testid=configuration-history]')?.scrollIntoView({block:'start'});});
    on('#close-replay', () => { replayId=''; replayPlaying=false; replayShareNote=''; render(); });
    on('#replay-play', () => { replayPlaying = !replayPlaying; render(); });
    root.querySelectorAll<HTMLButtonElement>('[data-replay-step]').forEach(button => button.addEventListener('click', () => { replayFrame = Number(button.dataset.replayStep) || 0; replayPlaying = false; render(); }, live));
    on('#replay-image', () => { void replayPicture(false); });
    on('#replay-share', () => { void replayPicture(true); });
    on('#replay-first', () => { replayFrame=0; render(); });
    on('#replay-prev', () => { replayFrame--; render(); });
    on('#replay-next', () => { replayFrame++; render(); });
    on('#replay-last', () => { replayFrame=(allReviewHands().find(hand => hand.id===replayId)?.frames.length ?? coachCache?.hands.find(hand => hand.id===replayId)?.frames.length ?? 1)-1; render(); });
    root.querySelectorAll<HTMLButtonElement>('[data-coach-replay]').forEach(button => button.addEventListener('click', () => { replayId = button.dataset.coachReplay!; replayFrame = 0; render(); root.querySelector('.replay-panel')?.scrollIntoView({ block: 'start' }); }, live));
    const prepareExport=(startIndex=0,total=controller.totalHandCount)=>{
      const generation=privacyGeneration;
      void controller.exportHistoryBatch(startIndex,total).then(payload => {
        if(generation!==privacyGeneration||controller.status==='deleted')return;
        if (downloadUrl) URL.revokeObjectURL(downloadUrl);
        exportFiles=prepareHistoryBatchFiles(payload);
        exportRange={startIndex:payload.startIndex,nextIndex:payload.nextIndex,total:payload.total};showExportText=false;
        downloadUrl=URL.createObjectURL(exportFiles.json);exportNotice='';
        view='study'; render();
        root.querySelector<HTMLAnchorElement>('#download-history')?.focus();
      }).catch(cause => { if(generation!==privacyGeneration||controller.status==='deleted')return;error=(cause as Error).message; render(); });
    };
    on('#export-history, #privacy-export',()=>prepareExport());
    on('#export-next',()=>{if(exportRange)prepareExport(exportRange.nextIndex,exportRange.total);});
    on('#share-history',()=>{
      if(!exportFiles)return;
      // Prepared before this tap: preserve Safari's transient user activation.
      void sharePreparedHistory(exportFiles,navigator).then(result=>{exportNotice=result==='shared'?'Share sheet finished. Check your chosen destination for the file.':result==='cancelled'?'Sharing cancelled. Your export is still ready.':'Sharing is unavailable here. Use Download JSON or View / copy JSON.';render();});
    });
    on('#view-export',()=>{showExportText=!showExportText;render();});
    on('#copy-history',()=>{
      if(!exportFiles)return;
      if(navigator.clipboard?.writeText)void navigator.clipboard.writeText(exportFiles.text).then(()=>{exportNotice='JSON copied. Paste it into a file or Import pasted JSON.';render();}).catch(()=>{exportNotice='Copy was blocked. Select the JSON text manually.';render();});
      else {root.querySelector<HTMLTextAreaElement>('#export-json')?.select();exportNotice='JSON selected. Use your device’s Copy command.';const notice=root.querySelector('.export-notice');if(notice)notice.textContent=exportNotice;}
    });
    root.querySelector<HTMLInputElement>('#import-rights')?.addEventListener('change',event=>{importRightsConfirmed=(event.target as HTMLInputElement).checked;}, live);
    on('#show-import-text',()=>{showImportText=!showImportText;render();});
    on('#study-import-select-all',()=>{if(importPreview)for(const row of importPreview.rows)if(row.status==='VALID')importSelection.add(row.index);render();});
    on('#study-import-clear-selection',()=>{importSelection.clear();render();});
    on('#cancel-study-import',()=>{importPreviewRequest++;importPreview=null;importSelection.clear();importPreviewBusy=false;render();});
    on('#study-import-prev',()=>{importPreviewPage--;render();});
    on('#study-import-next',()=>{importPreviewPage++;render();});
    root.querySelectorAll<HTMLInputElement>('[data-import-selection]').forEach(input=>input.addEventListener('change',()=>{const index=Number(input.dataset.importSelection);if(input.checked)importSelection.add(index);else importSelection.delete(index);render();}, live));
    on('#confirm-study-import',()=>{try{assertStudyImportRights(importRightsConfirmed);}catch(cause){error=(cause as Error).message;render();return;}const preview=importPreview;if(!preview)return;const selection=[...importSelection];void run(async()=>{await controller.importSelectedStudyHands(preview,selection);if(controller.error)throw new Error(controller.error);importPreview=null;importSelection.clear();showImportText=false;importTextDraft='';exportNotice='Selected public study hands imported. Canonical history, bankroll and poker statistics were not changed.';sessionNotice=exportNotice;historySession='all';historyStake='all';historyResult='all';});});
    root.querySelector<HTMLTextAreaElement>('#import-json')?.addEventListener('input',event=>{importTextDraft=(event.target as HTMLTextAreaElement).value;}, live);
    root.querySelector('#import-text-form')?.addEventListener('submit',event=>{event.preventDefault();const text=root.querySelector<HTMLTextAreaElement>('#import-json')?.value??'';void prepareStudyPreview(text);}, live);
    root.querySelector<HTMLInputElement>('#import-history')?.addEventListener('change', event => {
      const input=event.target as HTMLInputElement;
      const file=input.files?.[0];
      // Nodes now survive renders. Clear the picker so the same file can be
      // selected again after a rights error or cancelled preview.
      input.value='';
      if (!file) return;
      try{assertStudyImportRights(importRightsConfirmed);}catch(cause){error=(cause as Error).message;render();return;}
      if (file.size>10000000) { error='History import is limited to 10 MB.'; render(); return; }
      const generation=privacyGeneration;
      void file.text().then(text=>{if(generation!==privacyGeneration||controller.status==='deleted')return;return prepareStudyPreview(text);}).catch(cause=>{if(generation!==privacyGeneration||controller.status==='deleted')return;error=(cause as Error).message;render();});
    }, live);
  }
  // Patch 83: a click on buttons when asked for, and silence when the page is hidden.
  root.addEventListener('click', event => { if (style.sound && style.clicks && (event.target as Element | null)?.closest?.('.button,.segment,.subnav-button,.nav-button,.home-card,.chip-button')) playSound('tap'); });
  // Patch 92: the space bar spins (or stops the reels, or skips a celebration) on a slot machine.
  document.addEventListener('keydown', event => { if (view !== 'slots' || !slotsUi.machine || event.code !== 'Space' || event.repeat) return; const t = event.target as HTMLElement | null; if (t && t.closest('input,select,textarea,button,summary,[contenteditable]')) return; event.preventDefault(); if (slotsUi.phase === 'idle' || slotsUi.phase === 'done') slotsUi.auto = 0; slotsPlayer.press(); });
  document.addEventListener('visibilitychange', () => { if (document.visibilityState !== 'visible') ambience(false); else render(); });
  controller.subscribe(sync);
  render();
  void controller.init().then(sync).catch(cause => { error=(cause as Error).message; sync(); });
}
