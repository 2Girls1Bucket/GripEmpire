import { describe, expect, it } from 'vitest';
import { createGame } from '../src/game/state';
import * as A from '../src/game/actions';
import { computeDerived } from '../src/game/economy';
import { buyNode, legacyPreview, nodeCost, performLegacy } from '../src/game/prestige';
import { exportSave, importSave, loadFrom, migrate, parseSave, sanitize, serialize, writeTo, memoryKV } from '../src/game/save';
import { simulateOffline, tick } from '../src/game/tick';
import { BACKUP_KEY, SAVE_KEY, SCHEMA_VERSION } from '../src/game/config';
import { MIN_LEGACY_CRED } from '../src/game/content/legacy';

describe('legacy', () => {
  it('is unavailable below the threshold and available above it', () => {
    const s = createGame(0);
    s.run.earnings = 1000;
    expect(legacyPreview(s).available).toBe(false);
    expect(performLegacy(s).ok).toBe(false);
    s.run.earnings = legacyPreview(s).minEarnings * 1.01;
    expect(legacyPreview(s).available).toBe(true);
    expect(legacyPreview(s).gain).toBeGreaterThanOrEqual(MIN_LEGACY_CRED);
  });

  it('spending cash does not change the reward', () => {
    const s = createGame(0);
    s.run.earnings = 1e10;
    s.run.cash = 1e10;
    const g1 = legacyPreview(s).gain;
    A.buyProduct(s, 'bushings', 'max');
    expect(s.run.cash).toBeLessThan(1e10);
    expect(legacyPreview(s).gain).toBe(g1);
  });

  it('next threshold is consistent with the formula', () => {
    const s = createGame(0);
    s.meta.lifetimeRunEarnings = 3e10;
    s.run.earnings = 5e9;
    const p = legacyPreview(s);
    s.run.earnings = p.nextAt * 1.0001;
    expect(legacyPreview(s).gain).toBe(p.gain + 1);
  });

  it('resets exactly what the preview promises and keeps the rest', () => {
    const s = createGame(0);
    s.run.cash = 1e12;
    s.run.earnings = 5e10;
    A.unlockProduct(s, 'bearings');
    A.recruit(s, 'maya');
    s.run.fans = 5000;
    s.meta.achievements = ['firstSale'];
    s.meta.nodes.founder = 2;
    s.run.team[0].training = 40;
    s.meta.hqPhase = 1;
    const gain = legacyPreview(s).gain;
    const res = performLegacy(s, 'maya');
    expect(res.ok).toBe(true);
    expect(s.meta.cred).toBe(gain);
    expect(s.meta.credEarned).toBe(gain);
    expect(s.meta.legacyCount).toBe(1);
    expect(s.meta.lifetimeRunEarnings).toBe(5e10);
    expect(s.run.cash).toBe(0);
    expect(s.run.earnings).toBe(0);
    expect(s.run.products.bearings).toBe(0);
    expect(s.run.fans).toBe(0);
    expect(s.meta.achievements).toEqual(['firstSale']);
    expect(s.meta.hqPhase).toBe(1);
    expect(s.meta.nodes.founder).toBe(2);
    expect(s.run.team).toEqual([{ id: 'maya', training: 20 }]); // founder lvl 2 keeps 50%
    expect(s.meta.unlockedSkaters).toContain('al'); // L1 scouts unlocked
  });

  it('a quick second legacy right after the first gives nothing (no reset farming)', () => {
    const s = createGame(0);
    s.run.earnings = 5e10;
    performLegacy(s);
    s.run.earnings = 1e6;
    expect(legacyPreview(s).available).toBe(false);
  });

  it('tree nodes cost Cred, respect max level and requirements', () => {
    const s = createGame(0);
    s.meta.cred = 1000;
    expect(buyNode(s, 'seat').ok).toBe(false); // requires legacy 1
    const c = nodeCost('loyal', 0);
    expect(buyNode(s, 'loyal').ok).toBe(true);
    expect(s.meta.cred).toBe(1000 - c);
    s.meta.nodes.loyal = 10;
    expect(buyNode(s, 'loyal').ok).toBe(false);
  });

  it('head-start nodes apply to the next run', () => {
    const s = createGame(0);
    s.meta.nodes.dayone = 2;
    s.meta.nodes.kept = 2;
    s.meta.nodes.seed = 1;
    s.run.earnings = 5e10;
    performLegacy(s);
    expect(s.run.tracks.staff).toBe(2);
    expect(s.run.products.grip).toBe(1);
    expect(s.run.cash).toBe(500);
  });
});

describe('saves', () => {
  it('round-trips through serialize/parse', () => {
    const s = createGame(0);
    s.run.cash = 12345;
    A.recruit({ ...s, run: { ...s.run, cash: 1e9 } } as never, 'maya');
    s.run.products.bushings = 33;
    const back = parseSave(serialize(s));
    expect(back.run.cash).toBe(12345);
    expect(back.run.products.bushings).toBe(33);
    expect(back.version).toBe(SCHEMA_VERSION);
  });

  it('export/import works and rejects damaged or foreign data', () => {
    const s = createGame(0);
    s.run.cash = 777;
    const code = exportSave(s);
    expect(importSave(code).run.cash).toBe(777);
    expect(() => importSave('')).toThrow();
    expect(() => importSave('hello world')).toThrow(/does not look/);
    expect(() => importSave(code.slice(0, code.length - 10))).toThrow();
    const tampered = code.slice(0, 20) + (code[20] === 'A' ? 'B' : 'A') + code.slice(21);
    expect(() => importSave(tampered)).toThrow();
    expect(() => importSave('{"foo":1}')).toThrow(/missing/);
    expect(() => importSave('{"version":99,"run":{},"meta":{}}')).toThrow(/newer/);
  });

  it('migrates a v1 save', () => {
    const v1 = { version: 1, run: { money: 4242, products: { bushings: 7 } }, meta: { legacyUpgrades: { loyal: 3 }, legacyCount: 2 } };
    const m = migrate(v1);
    expect(m.version).toBe(SCHEMA_VERSION);
    const s = sanitize(m);
    expect(s.run.cash).toBe(4242);
    expect(s.meta.nodes.loyal).toBe(3);
    expect(s.meta.legacyCount).toBe(2);
  });

  it('sanitizes bad values instead of corrupting state', () => {
    const s = createGame(0);
    const raw = JSON.parse(serialize(s));
    raw.run.cash = -50;
    raw.run.fans = 'lots';
    raw.run.products.bushings = 0;
    raw.run.products.decks = NaN;
    raw.run.team = [{ id: 'nobody', training: 3 }, { id: 'maya', training: -2 }, { id: 'maya', training: 9 }];
    raw.run.opp = { kind: 'rush', expires: 10 };
    raw.meta.nodes = { loyal: 999, fake: 3 };
    const out = sanitize(raw);
    expect(out.run.cash).toBe(0);
    expect(out.run.fans).toBe(0);
    expect(out.run.products.bushings).toBe(1);
    expect(out.run.products.decks).toBe(0);
    expect(out.run.team).toEqual([{ id: 'maya', training: 0 }]);
    expect(out.run.opp).toBeNull();
    expect(out.meta.nodes).toEqual({ loyal: 10 });
  });

  it('falls back to the backup when the main save is corrupt', () => {
    const kv = memoryKV();
    const s = createGame(0);
    s.run.cash = 1;
    writeTo(kv, s);
    s.run.cash = 2;
    writeTo(kv, s); // previous becomes backup
    expect(JSON.parse(kv.getItem(BACKUP_KEY)!).run.cash).toBe(1);
    kv.setItem(SAVE_KEY, '{broken');
    const res = loadFrom(kv);
    expect(res.source).toBe('backup');
    expect(res.state.run.cash).toBe(1);
    expect(res.error).toBeTruthy();
  });

  it('new game when nothing is stored', () => {
    expect(loadFrom(memoryKV()).source).toBe('new');
  });
});

describe('offline progress', () => {
  const idleShop = () => {
    const s = createGame(0);
    Object.assign(s.run.products, { bushings: 60, bearings: 40 });
    s.run.tracks.staff = 3;
    return s;
  };

  it('earns efficiency × automated income, up to the cap', () => {
    const s = idleShop();
    const d = computeDerived(s);
    const sum = simulateOffline(s, 2 * 3600);
    expect(sum.capped).toBe(false);
    expect(sum.earned).toBeCloseTo(d.passive * 7200 * d.offlineEff, -1);
    const s2 = idleShop();
    const sum2 = simulateOffline(s2, 100 * 3600);
    expect(sum2.capped).toBe(true);
    expect(sum2.simulated).toBe(d.offlineCapSec);
    expect(sum2.earned).toBeCloseTo(d.passive * d.offlineCapSec * d.offlineEff, -2);
  });

  it('negative or garbage elapsed time does nothing', () => {
    const s = idleShop();
    expect(simulateOffline(s, -5000).earned).toBe(0);
    expect(simulateOffline(s, NaN).earned).toBe(0);
  });

  it('assignments progress at offline speed and pay once per completion', () => {
    const s = idleShop();
    s.run.cash = 1e9;
    s.run.tracks.manager = 1;
    A.recruit(s, 'kenji');
    A.startJob(s, 'demo', ['kenji'], true);
    const eff = computeDerived(s).offlineEff;
    const sum = simulateOffline(s, 3600);
    expect(sum.jobs).toBe(Math.floor((3600 * eff) / 60));
  });

  it('no active bonuses or opportunities offline', () => {
    const s = idleShop();
    s.run.rushLeft = 10;
    s.run.streak = 20;
    s.run.opp = { kind: 'rush', expires: 20 };
    const before = s.run.stats.manualEarned;
    simulateOffline(s, 600);
    expect(s.run.rushLeft).toBe(0);
    expect(s.run.streak).toBe(0);
    expect(s.run.opp).toBeNull();
    expect(s.run.stats.manualEarned).toBe(before);
  });

  it('online ticks use elapsed time, not tick count', () => {
    const a = idleShop();
    const b = idleShop();
    for (let i = 0; i < 100; i++) tick(a, 0.1, { mode: 'online' });
    tick(b, 10, { mode: 'online' });
    expect(a.run.cash).toBeCloseTo(b.run.cash, 4);
  });
});
