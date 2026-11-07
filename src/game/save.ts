// Save system: versioned schema, migration, validation (sanitize onto defaults), backup, export/import.
import { BACKUP_KEY, SAVE_KEY, SCHEMA_VERSION } from './config';
import { createGame, createRun, type GameState } from './state';
import { PRODUCT_IDS } from './content/products';
import { TRACK_BY_ID } from './content/tracks';
import { SKATER_BY_ID } from './content/skaters';
import { ASSIGNMENT_BY_ID, EVENT_BY_ID, VIDEO_BY_ID } from './content/activities';
import { BRAND_FOCUS, FACILITIES, REGIONS } from './content/business';
import { LEGACY_NODE_BY_ID } from './content/legacy';
import { ACHIEVEMENTS } from './content/achievements';
import { RUN_ACCOMPLISHMENTS } from './prestige';

export interface KV {
  getItem(k: string): string | null;
  setItem(k: string, v: string): void;
  removeItem(k: string): void;
}

const EXPORT_PREFIX = 'GRIPEMPIRE1:';

type Json = any; // eslint-disable-line @typescript-eslint/no-explicit-any

// ---------------- MIGRATIONS ----------------
// Each entry upgrades a save FROM that version to version+1.
// v1 = pre-release prototype schema: cash was `run.money`, legacy tree was `meta.legacyUpgrades`.
export const MIGRATIONS: Record<number, (raw: Json) => Json> = {
  1: (raw) => {
    const out = { ...raw, version: 2 };
    if (out.run && out.run.money !== undefined && out.run.cash === undefined) {
      out.run = { ...out.run, cash: out.run.money };
      delete out.run.money;
    }
    if (out.meta && out.meta.legacyUpgrades && !out.meta.nodes) {
      out.meta = { ...out.meta, nodes: out.meta.legacyUpgrades };
      delete out.meta.legacyUpgrades;
    }
    return out;
  },
};

export function migrate(raw: Json): Json {
  let cur = raw;
  let v = typeof cur.version === 'number' ? cur.version : 1;
  if (v > SCHEMA_VERSION) throw new Error(`Save is from a newer version of the game (v${v}).`);
  while (v < SCHEMA_VERSION) {
    const fn = MIGRATIONS[v];
    if (!fn) throw new Error(`No migration from save v${v}.`);
    cur = fn(cur);
    v++;
    cur.version = v;
  }
  return cur;
}

// ---------------- SANITIZE ----------------
const num = (x: unknown, def = 0, max = 1e300): number => (typeof x === 'number' && Number.isFinite(x) && x >= 0 ? Math.min(x, max) : def);
const int = (x: unknown, def = 0, max = 1e9): number => Math.floor(num(x, def, max));
const bool = (x: unknown, def: boolean) => (typeof x === 'boolean' ? x : def);
const str = (x: unknown, def = '') => (typeof x === 'string' ? x.slice(0, 200) : def);
const arr = (x: unknown): unknown[] => (Array.isArray(x) ? x : []);
const obj = (x: unknown): Record<string, unknown> => (x && typeof x === 'object' && !Array.isArray(x) ? (x as Record<string, unknown>) : {});
const uniq = <T>(a: T[]) => [...new Set(a)];

/** Copy validated values from `raw` onto a fresh default state. Unknown/invalid data is dropped. */
export function sanitize(rawIn: Json): GameState {
  const raw = obj(rawIn);
  const def = createGame(num(raw.createdAt, Date.now()));
  const rm = obj(raw.meta);
  const m = def.meta;
  m.legacyCount = int(rm.legacyCount);
  m.cred = num(rm.cred);
  m.credEarned = num(rm.credEarned);
  m.lifetimeRunEarnings = num(rm.lifetimeRunEarnings);
  const nodes = obj(rm.nodes);
  for (const [k, v] of Object.entries(nodes)) {
    const nd = LEGACY_NODE_BY_ID[k];
    if (nd) m.nodes[k] = Math.min(int(v), nd.maxLevel === Infinity ? 1e6 : nd.maxLevel);
  }
  m.unlockedSkaters = uniq([...m.unlockedSkaters, ...arr(rm.unlockedSkaters).filter((x): x is string => typeof x === 'string' && !!SKATER_BY_ID[x])]);
  m.achievements = uniq(arr(rm.achievements).filter((x): x is string => typeof x === 'string' && ACHIEVEMENTS.some((a) => a.id === x)));
  const rs = obj(rm.stats);
  for (const k of Object.keys(m.stats) as (keyof typeof m.stats)[]) {
    if (k === 'runDurations') m.stats.runDurations = arr(rs.runDurations).map((x) => int(x)).slice(-100);
    else (m.stats as unknown as Record<string, number>)[k] = num(rs[k]);
  }
  m.hqPhase = Math.min(5, int(rm.hqPhase));
  m.capstoneAt = typeof rm.capstoneAt === 'number' && Number.isFinite(rm.capstoneAt) ? rm.capstoneAt : null;
  m.seenTips = uniq(arr(rm.seenTips).filter((x): x is string => typeof x === 'string')).slice(0, 200);
  m.founderId = typeof rm.founderId === 'string' && SKATER_BY_ID[rm.founderId] ? rm.founderId : null;
  m.tainted = bool(rm.tainted, false);

  const rr = obj(raw.run);
  const r = createRun(m); // defaults (head-starts get overwritten by saved values below)
  r.cash = num(rr.cash);
  r.earnings = num(rr.earnings);
  r.time = num(rr.time);
  const rp = obj(rr.products);
  for (const id of PRODUCT_IDS) r.products[id] = int(rp[id], r.products[id], 100_000);
  r.products.bushings = Math.max(1, r.products.bushings);
  const rt = obj(rr.tracks);
  for (const [k, v] of Object.entries(rt)) {
    const t = TRACK_BY_ID[k];
    if (t) r.tracks[k] = Math.min(int(v), t.maxLevel ?? 10_000);
  }
  const seen = new Set<string>();
  r.team = arr(rr.team)
    .map((x) => obj(x))
    .filter((t) => typeof t.id === 'string' && SKATER_BY_ID[t.id] && !seen.has(t.id) && (seen.add(t.id as string), true))
    .slice(0, 6)
    .map((t) => ({ id: t.id as string, training: int(t.training, 0, 100_000) }));
  const teamIds = new Set(r.team.map((t) => t.id));
  r.nextUid = Math.max(1, int(rr.nextUid, 1));
  r.jobs = arr(rr.jobs)
    .map((x) => obj(x))
    .filter((j) => typeof j.assignmentId === 'string' && ASSIGNMENT_BY_ID[j.assignmentId])
    .map((j) => ({
      uid: int(j.uid, r.nextUid++),
      assignmentId: j.assignmentId as string,
      skaters: uniq(arr(j.skaters).filter((x): x is string => typeof x === 'string' && teamIds.has(x))),
      elapsed: num(j.elapsed),
      duration: Math.max(1, num(j.duration, 60)),
      repeat: bool(j.repeat, false),
    }))
    .filter((j) => j.skaters.length >= ASSIGNMENT_BY_ID[j.assignmentId].minSkaters);
  r.nextUid = Math.max(r.nextUid, ...r.jobs.map((j) => j.uid + 1));
  const rf = rr.film ? obj(rr.film) : null;
  if (rf && typeof rf.tierId === 'string' && VIDEO_BY_ID[rf.tierId]) {
    const required = VIDEO_BY_ID[rf.tierId].footage;
    r.film = {
      tierId: rf.tierId,
      required,
      footage: Math.min(required, num(rf.footage)),
      crew: uniq(arr(rf.crew).filter((x): x is string => typeof x === 'string' && teamIds.has(x))),
      bestGrade: Math.min(1.5, num(rf.bestGrade)),
      linesPlayed: int(rf.linesPlayed),
    };
  }
  r.videos = arr(rr.videos)
    .map((x) => obj(x))
    .filter((v) => typeof v.tierId === 'string' && VIDEO_BY_ID[v.tierId])
    .map((v) => ({ tierId: v.tierId as string, title: str(v.title, 'Untitled'), quality: num(v.quality, 1, 10), royaltyBase: num(v.royaltyBase) }));
  const vc = obj(rr.videoCounts);
  for (const [k, v] of Object.entries(vc)) if (VIDEO_BY_ID[k]) r.videoCounts[k] = int(v);
  r.fans = num(rr.fans, r.fans);
  r.merchBoost = Math.min(3, num(rr.merchBoost));
  r.eventsUnlocked = uniq(arr(rr.eventsUnlocked).filter((x): x is string => typeof x === 'string' && !!EVENT_BY_ID[x]));
  const re = rr.event ? obj(rr.event) : null;
  if (re && typeof re.tierId === 'string' && EVENT_BY_ID[re.tierId] && r.eventsUnlocked.includes(re.tierId)) {
    const dur = EVENT_BY_ID[re.tierId].duration;
    r.event = { tierId: re.tierId, elapsed: Math.min(dur, num(re.elapsed)), duration: dur, hypeBonus: Math.min(0.3, num(re.hypeBonus)), momentIn: num(re.momentIn, dur / 3, dur), momentLeft: 0 };
  }
  r.eventHeadliner = typeof rr.eventHeadliner === 'string' && teamIds.has(rr.eventHeadliner) ? rr.eventHeadliner : null;
  r.autoHost = bool(rr.autoHost, true);
  const rb = obj(rr.brand);
  for (const id of PRODUCT_IDS) {
    if (!rb[id]) continue;
    const b = obj(rb[id]);
    const focus = typeof b.focus === 'string' && b.focus in BRAND_FOCUS ? (b.focus as keyof typeof BRAND_FOCUS) : 'quality';
    r.brand[id] = { level: Math.max(1, int(b.level, 1, 100_000)), focus, signature: typeof b.signature === 'string' && teamIds.has(b.signature) ? b.signature : null };
  }
  r.facilities = uniq(arr(rr.facilities).filter((x): x is string => typeof x === 'string' && FACILITIES.some((f) => f.id === x)));
  r.regions = uniq(arr(rr.regions).filter((x): x is string => typeof x === 'string' && REGIONS.some((f) => f.id === x)));
  r.distroSlots = uniq(arr(rr.distroSlots).filter((x): x is (typeof PRODUCT_IDS)[number] => typeof x === 'string' && PRODUCT_IDS.includes(x as never))).slice(0, 6);
  const rfac = obj(rr.factory);
  for (const id of PRODUCT_IDS) if (rfac[id] !== undefined) r.factory[id] = int(rfac[id], 0, 100);
  r.accomplishments = uniq(arr(rr.accomplishments).filter((x): x is string => typeof x === 'string' && RUN_ACCOMPLISHMENTS.some((a) => a.id === x)));
  r.autoBuy = bool(rr.autoBuy, false);
  r.autoBuyReserve = Math.min(0.9, num(rr.autoBuyReserve, 0.25));
  r.autoProduce = bool(rr.autoProduce, false);
  r.streak = 0;
  r.sinceServe = 999;
  r.rushLeft = 0;
  r.opp = null; // transient, never restored (prevents re-claiming)
  r.nextOppIn = num(rr.nextOppIn, 75, 600);
  r.lastLineAttempt = str(rr.lastLineAttempt);
  const st = obj(rr.stats);
  for (const k of Object.keys(r.stats) as (keyof typeof r.stats)[]) r.stats[k] = num(st[k]);

  def.run = r;
  def.lastTick = num(raw.lastTick, Date.now());
  def.version = SCHEMA_VERSION;
  return def;
}

export function validateRaw(raw: Json): string | null {
  if (!raw || typeof raw !== 'object') return 'Not a save file.';
  if (!raw.run || typeof raw.run !== 'object') return 'Save is missing run data.';
  if (!raw.meta || typeof raw.meta !== 'object') return 'Save is missing permanent data.';
  return null;
}

/** Parse + migrate + validate a JSON string. Throws with a readable message on failure. */
export function parseSave(json: string): GameState {
  let raw: Json;
  try {
    raw = JSON.parse(json);
  } catch {
    throw new Error('Save data is not valid JSON.');
  }
  const pre = validateRaw(raw);
  if (pre) throw new Error(pre);
  const migrated = migrate(raw);
  const post = validateRaw(migrated);
  if (post) throw new Error(post);
  return sanitize(migrated);
}

export const serialize = (s: GameState) => JSON.stringify(s);

// ---------------- EXPORT / IMPORT ----------------
const hash = (txt: string) => {
  let h = 2166136261;
  for (let i = 0; i < txt.length; i++) {
    h ^= txt.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return (h >>> 0).toString(36);
};

const toB64 = (txt: string) => {
  const bytes = new TextEncoder().encode(txt);
  let bin = '';
  for (let i = 0; i < bytes.length; i++) bin += String.fromCharCode(bytes[i]);
  return btoa(bin);
};
const fromB64 = (b64: string) => {
  const bin = atob(b64);
  const bytes = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i);
  return new TextDecoder().decode(bytes);
};

export function exportSave(s: GameState): string {
  const json = serialize(s);
  return EXPORT_PREFIX + toB64(JSON.stringify({ h: hash(json), d: json }));
}

export function importSave(text: string): GameState {
  const t = text.trim();
  if (!t) throw new Error('Paste a save first.');
  let json: string;
  if (t.startsWith(EXPORT_PREFIX)) {
    let wrapper: { h?: string; d?: string };
    try {
      wrapper = JSON.parse(fromB64(t.slice(EXPORT_PREFIX.length)));
    } catch {
      throw new Error('That save code is damaged or incomplete.');
    }
    if (typeof wrapper.d !== 'string' || wrapper.h !== hash(wrapper.d)) throw new Error('That save code is damaged (checksum mismatch).');
    json = wrapper.d;
  } else if (t.startsWith('{')) {
    json = t;
  } else throw new Error('That does not look like a Grip Empire save.');
  return parseSave(json);
}

// ---------------- STORAGE ----------------
export interface LoadResult {
  state: GameState;
  source: 'main' | 'backup' | 'new';
  error?: string;
}

export function loadFrom(kv: KV): LoadResult {
  const main = kv.getItem(SAVE_KEY);
  let error: string | undefined;
  if (main) {
    try {
      return { state: parseSave(main), source: 'main' };
    } catch (e) {
      error = (e as Error).message;
    }
  }
  const backup = kv.getItem(BACKUP_KEY);
  if (backup) {
    try {
      return { state: parseSave(backup), source: 'backup', error };
    } catch (e) {
      error = error ?? (e as Error).message;
    }
  }
  return { state: createGame(), source: 'new', error };
}

/** Write a save; the previous valid main save becomes the backup. */
export function writeTo(kv: KV, s: GameState) {
  const json = serialize(s);
  const prev = kv.getItem(SAVE_KEY);
  if (prev && prev !== json) {
    try {
      parseSave(prev);
      kv.setItem(BACKUP_KEY, prev);
    } catch {
      /* previous main is corrupt: keep the existing backup */
    }
  }
  kv.setItem(SAVE_KEY, json);
}

export function memoryKV(): KV & { data: Map<string, string> } {
  const data = new Map<string, string>();
  return {
    data,
    getItem: (k) => data.get(k) ?? null,
    setItem: (k, v) => void data.set(k, v),
    removeItem: (k) => void data.delete(k),
  };
}
