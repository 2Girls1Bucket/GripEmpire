import { describe, expect, it } from 'vitest';
import { createGame, type GameState } from '../src/game/state';
import * as A from '../src/game/actions';
import { computeDerived, RUSH_MULT } from '../src/game/economy';
import { tick } from '../src/game/tick';

const rich = (): GameState => {
  const s = createGame(0);
  s.run.cash = 1e12;
  s.run.earnings = 1e7;
  s.run.tracks.staff = 2;
  return s;
};

describe('manual serving', () => {
  it('enforces the serve-rate cap regardless of call rate', () => {
    const s = createGame(0);
    let served = 0;
    // 1000 attempts within one simulated second → at most 5 succeed
    for (let i = 0; i < 1000; i++) {
      if (i % 200 === 0) tick(s, 0.2, { mode: 'online' });
      if (A.serve(s) > 0) served++;
    }
    expect(served).toBeLessThanOrEqual(6);
    expect(served).toBeGreaterThanOrEqual(4);
  });

  it('streak is bounded and rush multiplies only manual sales', () => {
    const s = createGame(0);
    const d = computeDerived(s);
    for (let i = 0; i < 200; i++) {
      s.run.sinceServe = 1;
      A.serve(s, d);
    }
    expect(s.run.streak).toBe(d.streakMax);
    s.run.sinceServe = 1;
    const normal = A.serve(s, d);
    s.run.rushLeft = 5;
    s.run.sinceServe = 1;
    const rushed = A.serve(s, d);
    expect(rushed / normal).toBeCloseTo(RUSH_MULT);
  });

  it('bulk order completes once and pays a bounded reward', () => {
    const s = createGame(0);
    s.run.products.bearings = 5;
    s.run.products.grip = 5;
    s.run.tracks.staff = 1;
    s.run.opp = { kind: 'bulk', expires: 30, accepted: true, need: 3, progress: 0, timeLeft: 30, rewardSec: 40, label: 'Test' };
    const before = s.run.stats.oppEarned;
    for (let i = 0; i < 10; i++) {
      s.run.sinceServe = 1;
      A.serve(s);
    }
    expect(s.run.opp).toBeNull();
    expect(s.run.stats.oppEarned - before).toBeCloseTo(40 * computeDerived(s).shopBase, 3);
  });

  it('board order scores by matching parts', () => {
    const s = createGame(0);
    s.run.opp = { kind: 'board', expires: 40, style: 'street', customer: 'T', rewardSec: 50 };
    const r = A.completeBoard(s, A.BOARD_STYLES.street.answer);
    expect(r.ok && r.matches).toBe(3);
    expect(A.completeBoard(s, A.BOARD_STYLES.street.answer).ok).toBe(false); // already claimed
  });
});

describe('team', () => {
  it('recruit, train, assign, complete, replace', () => {
    const s = rich();
    expect(A.recruit(s, 'maya').ok).toBe(true);
    expect(A.recruit(s, 'maya').ok).toBe(false); // duplicate
    expect(A.recruit(s, 'dusty').ok).toBe(true);
    expect(A.recruit(s, 'kenji').ok).toBe(false); // 2 slots
    expect(A.train(s, 'maya', 5).ok).toBe(true);
    expect(s.run.team.find((t) => t.id === 'maya')!.training).toBe(5);
    expect(A.startJob(s, 'demo', ['maya']).ok).toBe(true);
    expect(A.startJob(s, 'contestLocal', ['maya']).ok).toBe(false); // busy
    expect(A.startJob(s, 'tourVan', ['dusty']).ok).toBe(false); // needs 2
    const earnedBefore = s.run.stats.jobEarned;
    for (let i = 0; i < 61; i++) tick(s, 1, { mode: 'online', quiet: true });
    expect(s.run.stats.jobEarned).toBeGreaterThan(earnedBefore);
    expect(s.run.jobs.length).toBe(0); // no repeat without manager
    // Replace: release Dusty, sign Kenji
    expect(A.release(s, 'dusty').ok).toBe(true);
    expect(A.recruit(s, 'kenji').ok).toBe(true);
    expect(s.run.team.map((t) => t.id)).toEqual(['maya', 'kenji']);
  });

  it('repeating jobs pay once per completion', () => {
    const s = rich();
    s.run.tracks.manager = 1;
    A.recruit(s, 'kenji');
    A.startJob(s, 'demo', ['kenji'], true);
    let payouts = 0;
    let last = s.run.stats.jobEarned;
    for (let i = 0; i < 300; i++) {
      tick(s, 1, { mode: 'online', quiet: true });
      if (s.run.stats.jobEarned > last) payouts++;
      last = s.run.stats.jobEarned;
    }
    expect(payouts).toBe(5); // 300s / 60s
    expect(s.run.jobs.length).toBe(1);
  });

  it('releasing a skater removes them from every activity', () => {
    const s = rich();
    s.meta.legacyCount = 1;
    A.recruit(s, 'maya');
    A.recruit(s, 'dusty');
    A.fundFilm(s, 'clip', ['maya']);
    s.run.eventsUnlocked = ['jam'];
    A.setHeadliner(s, 'dusty');
    s.run.products.decks = 1;
    A.designLine(s, 'decks');
    A.setSignature(s, 'decks', 'maya');
    A.release(s, 'maya');
    A.release(s, 'dusty');
    expect(s.run.film!.crew).toEqual([]);
    expect(s.run.eventHeadliner).toBeNull();
    expect(s.run.brand.decks!.signature).toBeNull();
  });
});

describe('filming and the minigame reward', () => {
  it('auto footage completes a project and release adds royalties once', () => {
    const s = rich();
    A.recruit(s, 'maya');
    A.fundFilm(s, 'clip', ['maya']);
    for (let i = 0; i < 300; i++) tick(s, 1, { mode: 'online', quiet: true });
    expect(s.run.film!.footage).toBe(s.run.film!.required);
    expect(A.releaseVideo(s).ok).toBe(true);
    expect(A.releaseVideo(s).ok).toBe(false);
    expect(s.run.videos.length).toBe(1);
    expect(computeDerived(s).royalties).toBeGreaterThan(0);
  });

  it('repeated tiers suffer audience fatigue', () => {
    const s = rich();
    s.run.videos = [{ tierId: 'clip', title: 'a', quality: 1, royaltyBase: 1 }];
    expect(A.videoFatigue(s, 'clip')).toBeCloseTo(0.75);
    expect(A.videoFatigue(s, 'shopvid')).toBe(1);
  });

  it('a minigame attempt can only be rewarded once', () => {
    const s = rich();
    A.fundFilm(s, 'clip');
    const r1 = A.applyLineResult(s, { attemptId: 'x1', score: 6000, grade: 1, perfects: 4 });
    const cash = s.run.cash;
    const r2 = A.applyLineResult(s, { attemptId: 'x1', score: 6000, grade: 1, perfects: 4 });
    expect(r1.ok).toBe(true);
    expect(r2.ok).toBe(false);
    expect(s.run.cash).toBe(cash);
    expect(s.run.film!.footage).toBeGreaterThan(0);
  });

  it('a bailed line still pays something and never takes money away', () => {
    const s = rich();
    const cash = s.run.cash;
    A.applyLineResult(s, { attemptId: 'b', score: 0, grade: 0, perfects: 0 });
    expect(s.run.cash).toBeGreaterThan(cash);
  });
});

describe('events', () => {
  it('event cycles pay out and auto-host only with crew', () => {
    const s = rich();
    expect(A.unlockEvent(s, 'besttrick').ok).toBe(false); // must unlock in order
    expect(A.unlockEvent(s, 'jam').ok).toBe(true);
    expect(s.run.event?.tierId).toBe('jam');
    for (let i = 0; i < 91; i++) tick(s, 1, { mode: 'online', quiet: true });
    expect(s.run.stats.eventsHosted).toBe(1);
    expect(s.run.event).toBeNull();
    s.run.tracks.eventCrew = 1;
    A.hostEvent(s, 'jam');
    for (let i = 0; i < 181; i++) tick(s, 1, { mode: 'online', quiet: true });
    expect(s.run.stats.eventsHosted).toBe(3);
    expect(s.run.event).not.toBeNull();
  });
});

describe('spending guards', () => {
  it('track purchases respect max level and cash', () => {
    const s = rich();
    s.run.earnings = 1e9;
    expect(A.buyTrack(s, 'manager').ok).toBe(true);
    expect(A.buyTrack(s, 'manager').ok).toBe(false);
    s.run.cash = 0;
    expect(A.buyTrack(s, 'marketing').ok).toBe(false);
    expect(s.run.cash).toBe(0);
  });

  it('spend rejects NaN/negative/oversized costs', () => {
    const s = createGame(0);
    s.run.cash = 100;
    expect(A.spend(s, NaN)).toBe(false);
    expect(A.spend(s, -5)).toBe(false);
    expect(A.spend(s, 101)).toBe(false);
    expect(A.spend(s, 100)).toBe(true);
    expect(s.run.cash).toBe(0);
  });
});
