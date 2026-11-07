// Global, easy-to-change game configuration.
export const GAME_TITLE = 'Grip Empire';
export const GAME_TAGLINE = 'From a bushing bin to a skate empire';
export const SAVE_KEY = 'gripEmpire.save';
export const BACKUP_KEY = 'gripEmpire.save.backup';
export const SETTINGS_KEY = 'gripEmpire.settings';
export const LOCK_KEY = 'gripEmpire.tabLock';
export const SCHEMA_VERSION = 2;

/** Manual serving: a hard cap on how often a serve can register (per second). */
export const SERVE_RATE_CAP = 5;
/** Hold-to-serve / keyboard repeat rate. Equal to the cap so rapid clicking is never required. */
export const HOLD_SERVE_RATE = 5;

/** Gaps between ticks longer than this are treated as "away" (offline rules apply). */
export const AWAY_THRESHOLD_SEC = 180;

/** Offline baseline. Legacy upgrades improve both. */
export const OFFLINE_BASE_EFFICIENCY = 0.3;
export const OFFLINE_BASE_CAP_HOURS = 8;

/** Autosave cadence. Important actions also save immediately. */
export const AUTOSAVE_INTERVAL_MS = 10_000;
