import { describe, expect, it } from 'vitest';
import { createGame } from '../src/game/state';
import { PRODUCTS, PRODUCT_BY_ID } from '../src/game/content/products';
import {
  computeDerived,
  milestoneMults,
  productBulkCost,
  productLevelCost,
  productMaxAffordable,
} from '../src/game/economy';
import * as A from '../src/game/actions';
import { fmtNum, fmtMoney, fmtTime } from '../src/game/format';

const finiteDeep = (o: unknown): boolean => {
  if (typeof o === 'number') return Number.isFinite(o) && o >= 0;
  if (o && typeof o === 'object') return Object.values(o).every(finiteDeep);
  return true;
};

describe('product costs and bulk buying', () => {
  it('bulk cost equals the sum of single-level costs', () => {
    for (const def of PRODUCTS) {
      let sum = 0;
      for (let i = 0; i < 25; i++) sum += productLevelCost(def, 10 + i, 0.9);
      expect(productBulkCost(def, 10, 25, 0.9)).toBeCloseTo(sum, -Math.floor(Math.log10(sum)) + 8);
    }
  });

  it('max affordable never overspends and is maximal (randomized)', () => {
    let seed = 42;
    const rand = () => ((seed = (seed * 16807) % 2147483647) / 2147483647);
    for (let k = 0; k < 2000; k++) {
      const def = PRODUCTS[Math.floor(rand() * PRODUCTS.length)];
      const lvl = 1 + Math.floor(rand() * 400);
      const cash = Math.pow(10, rand() * 60);
      const cm = 0.3 + rand();
      const n = productMaxAffordable(def, lvl, cash, cm);
      expect(productBulkCost(def, lvl, n, cm)).toBeLessThanOrEqual(cash);
      expect(productBulkCost(def, lvl, n + 1, cm)).toBeGreaterThan(cash);
    }
  });

  it('buyProduct refuses when unaffordable and never leaves negative cash', () => {
    const s = createGame(0);
    s.run.cash = 3;
    expect(A.buyProduct(s, 'bushings', 1).ok).toBe(false);
    expect(s.run.products.bushings).toBe(1);
    expect(s.run.cash).toBe(3);
    s.run.cash = 1e6;
    expect(A.buyProduct(s, 'bushings', 'max').ok).toBe(true);
    expect(s.run.cash).toBeGreaterThanOrEqual(0);
    expect(s.run.cash).toBeLessThan(productLevelCost(PRODUCT_BY_ID.bushings, s.run.products.bushings, computeDerived(s).costMult.bushings));
  });

  it('next-milestone buy lands exactly on the milestone', () => {
    const s = createGame(0);
    s.run.cash = 1e9;
    A.buyProduct(s, 'bushings', 'next');
    expect(s.run.products.bushings).toBe(25);
  });

  it('contracts must be signed in order', () => {
    const s = createGame(0);
    s.run.cash = 1e15;
    expect(A.unlockProduct(s, 'grip').ok).toBe(false);
    expect(A.unlockProduct(s, 'bearings').ok).toBe(true);
    expect(A.unlockProduct(s, 'grip').ok).toBe(true);
    expect(s.run.products.grip).toBe(1);
  });
});

describe('income pipeline', () => {
  it('milestones multiply income', () => {
    const def = PRODUCT_BY_ID.bushings;
    expect(milestoneMults(def, 24).self).toBe(1);
    expect(milestoneMults(def, 25).self).toBe(2);
    expect(milestoneMults(def, 100).self).toBe(2 * 2 * 3);
    expect(milestoneMults(def, 100).global).toBeCloseTo(1.1);
  });

  it('no passive income before staff; staff turns it on', () => {
    const s = createGame(0);
    expect(computeDerived(s).passive).toBe(0);
    s.run.tracks.staff = 1;
    const d = computeDerived(s);
    expect(d.passive).toBeGreaterThan(0);
    expect(d.shopPassive).toBeCloseTo(d.shopBase);
  });

  it('temporary bonuses (rush, streak) never change derived income', () => {
    const s = createGame(0);
    s.run.tracks.staff = 3;
    s.run.products.bearings = 40;
    const a = computeDerived(s);
    s.run.rushLeft = 10;
    s.run.streak = 30;
    const b = computeDerived(s);
    expect(b.passive).toBe(a.passive);
    expect(b.saleValue).toBe(a.saleValue);
    expect(b.shopBase).toBe(a.shopBase);
  });

  it('derived values are finite for extreme states', () => {
    const s = createGame(0);
    for (const p of PRODUCTS) s.run.products[p.id] = 1500;
    for (const k of Object.keys(s.run.tracks)) s.run.tracks[k] = 60;
    s.run.fans = 1e30;
    s.meta.credEarned = 1e12;
    s.meta.legacyCount = 9;
    s.run.team = [{ id: 'maya', training: 5000 }, { id: 'kenji', training: 5000 }, { id: 'lou', training: 5000 }];
    const d = computeDerived(s);
    expect(finiteDeep({ passive: d.passive, sale: d.saleValue, base: d.shopBase, skaters: d.skaters })).toBe(true);
  });

  it('manual sales stay within a bounded multiple of automated income at comparable progression', () => {
    // A mid-run shop with balanced upgrades: holding serve (5/s, max streak) vs automated income.
    const s = createGame(0);
    Object.assign(s.run.products, { bushings: 100, bearings: 100, grip: 70, wheels: 50, trucks: 35, decks: 25 });
    Object.assign(s.run.tracks, { staff: 7, marketing: 8, displays: 6, checkout: 6, online: 5 });
    const d = computeDerived(s);
    const manualPerSec = d.saleValue * 5 * (1 + 0.02 * d.streakMax);
    const ratio = (manualPerSec + d.passive) / d.passive;
    expect(ratio).toBeGreaterThan(1.5);
    expect(ratio).toBeLessThan(5);
  });
});

describe('formatting', () => {
  it('formats safely', () => {
    expect(fmtNum(0)).toBe('0');
    expect(fmtNum(NaN)).toBe('0');
    expect(fmtNum(Infinity)).toBe('∞');
    expect(fmtNum(1234)).toBe('1.23K');
    expect(fmtNum(999_999)).toBe('1000.0K');
    expect(fmtNum(1.5e12)).toBe('1.50T');
    expect(fmtNum(1e80)).toMatch(/e80$/);
    expect(fmtMoney(-5)).toBe('$-5');
    expect(fmtTime(3725)).toBe('1h 02m');
    expect(fmtTime(-1)).toBe('—');
  });
});
