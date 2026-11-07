// Development-only debug panel. Never included in production builds (guarded by import.meta.env.DEV
// at the call site, so Vite tree-shakes it). Any use marks the save as tainted, shown in the top bar.
import { useState } from 'react';
import { useGame } from './kit';
import { tick, periodic, simulateOffline } from '../game/tick';
import { fmtMoney } from '../game/format';

export function DebugPanel() {
  const [s, d, e] = useGame();
  const [open, setOpen] = useState(false);
  if (!open)
    return (
      <button className="btn small" style={{ position: 'fixed', left: 8, bottom: 8, zIndex: 70, opacity: 0.6 }} onClick={() => setOpen(true)}>
        dev
      </button>
    );
  const taint = (fn: () => void) =>
    e.act((st) => {
      st.meta.tainted = true;
      fn();
    });
  const warp = (sec: number) =>
    taint(() => {
      let left = sec;
      while (left > 0) {
        const dt = Math.min(1, left);
        tick(e.state, dt, { mode: 'online', engaged: false, quiet: true });
        left -= dt;
      }
      periodic(e.state, { mode: 'online', quiet: true });
    });
  return (
    <div className="card" style={{ position: 'fixed', left: 8, bottom: 8, zIndex: 70, width: 270 }}>
      <div className="row between">
        <b>DEV PANEL</b>
        <button className="btn small" onClick={() => setOpen(false)}>
          ×
        </button>
      </div>
      <div className="small muted">Using this marks the save as DEBUG.</div>
      <div className="row" style={{ marginTop: 6 }}>
        <button className="btn small" onClick={() => taint(() => (s.run.cash += Math.max(1000, d.passive * 600 + s.run.cash)))}>
          Cash ×2 / +10min
        </button>
        <button className="btn small" onClick={() => warp(300)}>
          Warp 5m
        </button>
        <button className="btn small" onClick={() => warp(1800)}>
          Warp 30m
        </button>
        <button className="btn small" onClick={() => taint(() => ((s.meta.cred += 50), (s.meta.credEarned += 50)))}>
          +50 Cred
        </button>
        <button className="btn small" onClick={() => taint(() => (s.meta.legacyCount += 1))}>
          Legacy +1
        </button>
        <button
          className="btn small"
          onClick={() =>
            taint(() => {
              e.offline = simulateOffline(e.state, 3 * 3600);
            })
          }
        >
          Away 3h
        </button>
        <button className="btn small" onClick={() => taint(() => (s.run.opp = { kind: 'board', expires: 40, style: 'street', customer: 'Dev', rewardSec: 50 }))}>
          Board order
        </button>
      </div>
      <div className="tiny muted">cash {fmtMoney(s.run.cash)} · base {fmtMoney(d.shopBase)}/s</div>
    </div>
  );
}
