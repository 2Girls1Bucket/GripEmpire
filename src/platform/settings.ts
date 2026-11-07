// Player preferences. Stored separately from the save so they survive resets and Legacy.
import { SETTINGS_KEY } from '../game/config';
import { setNotation } from '../game/format';

export interface Settings {
  volume: number; // 0..1
  muted: boolean;
  motion: 'system' | 'reduced' | 'full';
  notation: 'suffix' | 'scientific';
  saleFloaters: boolean;
}

const DEFAULTS: Settings = { volume: 0.5, muted: false, motion: 'system', notation: 'suffix', saleFloaters: true };

let current: Settings = { ...DEFAULTS };
const listeners = new Set<() => void>();

export function loadSettings(): Settings {
  try {
    const raw = localStorage.getItem(SETTINGS_KEY);
    if (raw) {
      const p = JSON.parse(raw);
      current = {
        volume: typeof p.volume === 'number' ? Math.min(1, Math.max(0, p.volume)) : DEFAULTS.volume,
        muted: typeof p.muted === 'boolean' ? p.muted : DEFAULTS.muted,
        motion: ['system', 'reduced', 'full'].includes(p.motion) ? p.motion : DEFAULTS.motion,
        notation: p.notation === 'scientific' ? 'scientific' : 'suffix',
        saleFloaters: typeof p.saleFloaters === 'boolean' ? p.saleFloaters : true,
      };
    }
  } catch {
    current = { ...DEFAULTS };
  }
  apply();
  return current;
}

function apply() {
  setNotation(current.notation);
  if (typeof document !== 'undefined') document.documentElement.dataset.motion = reducedMotion() ? 'reduced' : 'full';
}

export const getSettings = () => current;

export function updateSettings(patch: Partial<Settings>) {
  current = { ...current, ...patch };
  try {
    localStorage.setItem(SETTINGS_KEY, JSON.stringify(current));
  } catch {
    /* storage unavailable */
  }
  apply();
  for (const l of listeners) l();
}

export const onSettings = (l: () => void) => {
  listeners.add(l);
  return () => listeners.delete(l);
};

export function reducedMotion(): boolean {
  if (current.motion === 'reduced') return true;
  if (current.motion === 'full') return false;
  return typeof window !== 'undefined' && !!window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches;
}
