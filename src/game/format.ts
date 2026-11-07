// Consistent number formatting. Handles NaN/Infinity/negative safely.
const SUFFIXES = ['', 'K', 'M', 'B', 'T', 'Qa', 'Qi', 'Sx', 'Sp', 'Oc', 'No', 'Dc', 'UDc', 'DDc', 'TDc', 'QaDc', 'QiDc', 'SxDc', 'SpDc', 'OcDc', 'NoDc', 'Vg'];

let notation: 'suffix' | 'scientific' = 'suffix';
export const setNotation = (n: 'suffix' | 'scientific') => {
  notation = n;
};

export function fmtNum(x: number, decimals = 2): string {
  if (!Number.isFinite(x)) return x > 0 ? '∞' : '0';
  if (Number.isNaN(x)) return '0';
  const neg = x < 0;
  const v = Math.abs(x);
  let out: string;
  if (v < 1000) {
    out = v < 10 && v % 1 !== 0 ? v.toFixed(Math.min(decimals, 2)) : v < 100 && v % 1 !== 0 ? v.toFixed(1) : Math.floor(v).toString();
  } else {
    const exp = Math.floor(Math.log10(v));
    const tier = Math.floor(exp / 3);
    if (notation === 'scientific' || tier >= SUFFIXES.length) {
      const m = v / Math.pow(10, exp);
      out = `${m.toFixed(2)}e${exp}`;
    } else {
      const scaled = v / Math.pow(10, tier * 3);
      // Guard against 999.995 rounding to "1000.00K"
      const str = scaled >= 99.995 ? scaled.toFixed(1) : scaled.toFixed(decimals);
      out = `${str}${SUFFIXES[tier]}`;
    }
  }
  return neg ? `-${out}` : out;
}

export const fmtMoney = (x: number) => `$${fmtNum(x)}`;
export const fmtRate = (x: number) => `$${fmtNum(x)}/s`;

export function fmtTime(sec: number): string {
  if (!Number.isFinite(sec) || sec < 0) return '—';
  const s = Math.ceil(sec);
  if (s < 60) return `${s}s`;
  const m = Math.floor(s / 60);
  if (m < 60) return `${m}m ${String(s % 60).padStart(2, '0')}s`;
  const h = Math.floor(m / 60);
  if (h < 48) return `${h}h ${String(m % 60).padStart(2, '0')}m`;
  return `${Math.floor(h / 24)}d ${h % 24}h`;
}

export const fmtPct = (x: number) => `${Math.round(x * 100)}%`;
export const fmtMult = (x: number) => `×${x >= 1000 ? fmtNum(x) : x >= 100 ? x.toFixed(0) : x >= 10 ? x.toFixed(1) : x.toFixed(2)}`;
