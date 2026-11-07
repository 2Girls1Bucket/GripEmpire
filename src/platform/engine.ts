// Browser runtime: owns the game state, advances time by wall clock, saves, handles offline/away,
// and coordinates multiple tabs so only one tab ever advances and saves the game.
import { AUTOSAVE_INTERVAL_MS, AWAY_THRESHOLD_SEC, BACKUP_KEY, LOCK_KEY, SAVE_KEY } from '../game/config';
import { createGame, type GameState } from '../game/state';
import { computeDerived, type Derived } from '../game/economy';
import { periodic, simulateOffline, tick, type OfflineSummary } from '../game/tick';
import { loadFrom, writeTo, type KV } from '../game/save';
import { feedback } from '../game/feedback';

const LOCK_STALE_MS = 6_000;
const HEARTBEAT_MS = 2_000;

const safeStorage = (): KV => {
  try {
    const t = '__ge_test';
    localStorage.setItem(t, '1');
    localStorage.removeItem(t);
    return localStorage;
  } catch {
    const m = new Map<string, string>();
    return { getItem: (k) => m.get(k) ?? null, setItem: (k, v) => void m.set(k, v), removeItem: (k) => void m.delete(k) };
  }
};

export type TabStatus = 'owner' | 'blocked';

export class Engine {
  state: GameState;
  version = 0;
  tabStatus: TabStatus = 'owner';
  offline: OfflineSummary | null = null;
  loadNote: string | null = null;
  storageOk = true;
  lastSavedAt = 0;
  private kv: KV;
  private tabId = Math.random().toString(36).slice(2);
  private listeners = new Set<() => void>();
  timer: ReturnType<typeof setInterval> | null = null;
  hb: ReturnType<typeof setInterval> | null = null;
  private lastPeriodic = 0;
  private lastAutosave = 0;
  private saveSoon: ReturnType<typeof setTimeout> | null = null;
  private lastInput = Date.now();
  private derivedCache: { v: number; d: Derived } | null = null;
  private channel: BroadcastChannel | null = null;
  /** Dev-only time multiplier (debug panel). */
  timeScale = 1;

  constructor() {
    this.kv = safeStorage();
    this.storageOk = this.kv !== undefined && typeof localStorage !== 'undefined';
    const res = loadFrom(this.kv);
    this.state = res.state;
    if (res.source === 'backup') this.loadNote = `Your main save could not be read (${res.error}). Restored the backup save.`;
    else if (res.source === 'new' && res.error) this.loadNote = `Your save could not be read (${res.error}). Started a new game.`;
  }

  // ---------------- lifecycle ----------------
  start() {
    try {
      this.channel = new BroadcastChannel('gripEmpire');
      this.channel.onmessage = (e) => this.onChannel(e.data);
    } catch {
      this.channel = null;
    }
    window.addEventListener('storage', (e) => {
      if (e.key === LOCK_KEY) this.checkLock();
    });
    if (!this.acquireLock()) {
      this.tabStatus = 'blocked';
    } else {
      this.catchUp(true);
    }
    this.timer = setInterval(() => this.loop(), 100);
    this.hb = setInterval(() => this.heartbeat(), HEARTBEAT_MS);
    document.addEventListener('visibilitychange', () => {
      if (document.visibilityState === 'hidden') this.save();
      else this.loop();
    });
    window.addEventListener('pagehide', () => this.shutdown());
    window.addEventListener('beforeunload', () => this.shutdown());
    for (const ev of ['pointerdown', 'keydown', 'wheel', 'touchstart']) window.addEventListener(ev, () => (this.lastInput = Date.now()), { passive: true });
    this.notify();
  }

  shutdown() {
    if (this.tabStatus !== 'owner') return;
    this.save();
    try {
      const raw = this.kv.getItem(LOCK_KEY);
      if (raw && JSON.parse(raw).id === this.tabId) this.kv.removeItem(LOCK_KEY);
    } catch {
      /* ignore */
    }
  }

  // ---------------- multi-tab ----------------
  private readLock(): { id: string; ts: number } | null {
    try {
      const raw = this.kv.getItem(LOCK_KEY);
      return raw ? JSON.parse(raw) : null;
    } catch {
      return null;
    }
  }
  private writeLock() {
    this.kv.setItem(LOCK_KEY, JSON.stringify({ id: this.tabId, ts: Date.now() }));
  }
  private acquireLock(): boolean {
    const l = this.readLock();
    if (l && l.id !== this.tabId && Date.now() - l.ts < LOCK_STALE_MS && Date.now() >= l.ts - 1000) return false;
    this.writeLock();
    return true;
  }
  private checkLock() {
    if (this.tabStatus !== 'owner') return;
    const l = this.readLock();
    if (l && l.id !== this.tabId && Date.now() - l.ts < LOCK_STALE_MS) this.becomeBlocked();
  }
  private heartbeat() {
    if (this.tabStatus === 'owner') {
      const l = this.readLock();
      if (l && l.id !== this.tabId && Date.now() - l.ts < LOCK_STALE_MS) this.becomeBlocked();
      else this.writeLock();
    }
  }
  private becomeBlocked() {
    if (this.tabStatus === 'blocked') return;
    this.tabStatus = 'blocked';
    this.notify();
  }
  private onChannel(msg: { type: string; from: string }) {
    if (!msg || msg.from === this.tabId) return;
    if (msg.type === 'takeover' && this.tabStatus === 'owner') {
      this.save();
      this.becomeBlocked();
      this.channel?.postMessage({ type: 'released', from: this.tabId });
    }
  }
  /** Make this tab the active one. The other tab saves and pauses first. */
  takeOver() {
    this.channel?.postMessage({ type: 'takeover', from: this.tabId });
    this.writeLock();
    // Give the previous owner a moment to flush its save, then reload from storage.
    setTimeout(() => {
      const res = loadFrom(this.kv);
      this.state = res.state;
      this.tabStatus = 'owner';
      this.writeLock();
      this.catchUp(true);
      this.notify();
    }, 400);
  }

  // ---------------- time ----------------
  /** Advance state to the current wall-clock time. */
  private catchUp(allowSummary: boolean) {
    const s = this.state;
    const now = Date.now();
    let dt = (now - s.lastTick) / 1000;
    if (!Number.isFinite(dt) || dt < 0) {
      // Clock moved backwards (or bad data): never produce negative time.
      s.lastTick = now;
      return;
    }
    dt *= this.timeScale;
    if (dt > AWAY_THRESHOLD_SEC) {
      const summary = simulateOffline(s, dt);
      if (allowSummary && summary.simulated > 60) this.offline = summary;
      this.save();
    } else if (dt > 0) {
      const engaged = document.visibilityState === 'visible' && now - this.lastInput < 120_000;
      let left = dt;
      while (left > 1e-6) {
        const step = Math.min(1, left);
        tick(s, step, { mode: 'online', engaged });
        left -= step;
      }
    }
    s.lastTick = now;
  }

  private loop() {
    if (this.tabStatus !== 'owner') return;
    this.catchUp(true);
    const now = Date.now();
    if (now - this.lastPeriodic > 1000) {
      this.lastPeriodic = now;
      periodic(this.state, { mode: 'online' });
    }
    if (now - this.lastAutosave > AUTOSAVE_INTERVAL_MS) this.save();
    this.notify();
  }

  // ---------------- actions ----------------
  /** Run a mutating action at the current time, then save shortly after. */
  act<T>(fn: (s: GameState, d: Derived) => T): T | undefined {
    if (this.tabStatus !== 'owner') return undefined;
    this.catchUp(false);
    const out = fn(this.state, computeDerived(this.state));
    this.derivedCache = null;
    this.notify();
    this.queueSave();
    return out;
  }

  /** Serve is called very often: no extra save scheduling. */
  quick<T>(fn: (s: GameState, d: Derived) => T): T | undefined {
    if (this.tabStatus !== 'owner') return undefined;
    this.catchUp(false);
    const out = fn(this.state, computeDerived(this.state));
    this.derivedCache = null;
    return out;
  }

  derived(): Derived {
    if (!this.derivedCache || this.derivedCache.v !== this.version) this.derivedCache = { v: this.version, d: computeDerived(this.state) };
    return this.derivedCache.d;
  }

  engaged() {
    return document.visibilityState === 'visible' && Date.now() - this.lastInput < 120_000;
  }

  // ---------------- persistence ----------------
  queueSave() {
    if (this.saveSoon) return;
    this.saveSoon = setTimeout(() => {
      this.saveSoon = null;
      this.save();
    }, 600);
  }

  save() {
    if (this.tabStatus !== 'owner') return;
    try {
      this.state.lastTick = Math.min(this.state.lastTick, Date.now());
      writeTo(this.kv, this.state);
      this.lastAutosave = Date.now();
      this.lastSavedAt = Date.now();
    } catch (e) {
      feedback.emit({ kind: 'error', text: `Save failed: ${(e as Error).message}` });
    }
  }

  replaceState(next: GameState) {
    next.lastTick = Date.now();
    this.state = next;
    this.offline = null;
    this.derivedCache = null;
    this.save();
    this.notify();
  }

  hardReset() {
    this.kv.removeItem(SAVE_KEY);
    this.kv.removeItem(BACKUP_KEY);
    this.state = createGame();
    this.offline = null;
    this.derivedCache = null;
    this.save();
    this.notify();
  }

  // ---------------- subscription ----------------
  subscribe = (l: () => void) => {
    this.listeners.add(l);
    return () => this.listeners.delete(l);
  };
  getVersion = () => this.version;
  notify() {
    this.version++;
    for (const l of this.listeners) l();
  }
}
