import { describe, expect, it } from 'vitest';
import { chooseBank, chooseHammer, createLine, gradeOf, nextObstacle, POP_OFFSET, pressLand, pressTrick, update, type LineState, type Tier } from '../src/minigame/line';

/** Bot that pops at the zone centre and lands on the exact frame. */
function play(l: LineState, opts: { tier: Tier; hammer?: boolean; skipLand?: boolean; landOffset?: number } ) {
  let guard = 0;
  while (l.phase !== 'done' && guard++ < 20000) {
    const dt = 1 / 120;
    if (l.phase === 'roll') {
      const o = nextObstacle(l);
      if (o && Math.abs(l.x - (o.x - POP_OFFSET)) < 3) pressTrick(l, opts.tier);
    }
    if (l.phase === 'air' && l.air && !opts.skipLand) {
      const target = l.air.start + l.air.dur + (opts.landOffset ?? 0);
      if (l.t >= target - dt / 2) pressLand(l);
    }
    if (l.phase === 'choice') (opts.hammer ? chooseHammer : chooseBank)(l);
    update(l, dt);
  }
  return l;
}

describe('Film a Line', () => {
  it('clean play lands every trick and earns a top grade', () => {
    const l = play(createLine(1), { tier: 2 });
    expect(l.bails).toBe(0);
    expect(l.landed).toBe(9);
    expect(l.perfects).toBe(9);
    expect(gradeOf(l.score)).toBeGreaterThanOrEqual(1);
  });

  it('easy tricks score less than hard ones', () => {
    const easy = play(createLine(5), { tier: 0 });
    const hard = play(createLine(5), { tier: 2 });
    expect(easy.score).toBeLessThan(hard.score);
  });

  it('never landing bails out after 3 lives but keeps score earned', () => {
    const l = play(createLine(3), { tier: 1, skipLand: true });
    expect(l.phase).toBe('done');
    expect(l.lives).toBe(0);
    expect(l.score).toBe(0);
  });

  it('imperfect landing timing gives good/sloppy, not bails, within the window', () => {
    const l = play(createLine(7, 1), { tier: 0, landOffset: 0.08 });
    expect(l.bails).toBe(0);
    expect(l.perfects).toBe(0);
    expect(l.landed).toBe(9);
  });

  it('hammer: landing multiplies the score by 1.5', () => {
    const banked = play(createLine(9), { tier: 1 });
    const hammered = play(createLine(9), { tier: 1, hammer: true });
    expect(hammered.hammer).toBe('landed');
    expect(hammered.score).toBeGreaterThan(banked.score * 1.5);
  });

  it('hammer: bailing reduces but never erases the score', () => {
    const l = createLine(11);
    play(l, { tier: 1 }); // plays until choice→bank; redo with bail on hammer
    const l2 = createLine(11);
    let guard = 0;
    while (l2.phase !== 'choice' && guard++ < 20000) {
      const o = nextObstacle(l2);
      if (l2.phase === 'roll' && o && Math.abs(l2.x - (o.x - POP_OFFSET)) < 3) pressTrick(l2, 1);
      if (l2.phase === 'air' && l2.air && l2.t >= l2.air.start + l2.air.dur - 1 / 240) pressLand(l2);
      update(l2, 1 / 120);
    }
    const before = l2.score;
    chooseHammer(l2);
    while (l2.phase !== 'done' && guard++ < 40000) update(l2, 1 / 120); // never pop the hammer
    expect(l2.hammer).toBe('bailed');
    expect(l2.score).toBe(Math.round(before * 0.8));
    expect(l.score).toBe(before);
  });

  it('forgiveness widens the timing window', () => {
    const strict = play(createLine(13, 0.6), { tier: 2, landOffset: 0.05 });
    const loose = play(createLine(13, 1.6), { tier: 2, landOffset: 0.05 });
    expect(loose.bails).toBeLessThan(strict.bails);
  });
});
