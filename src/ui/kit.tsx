// Shared UI building blocks.
import { createContext, useContext, useEffect, useRef, useState, useSyncExternalStore, type ReactNode } from 'react';
import type { Engine } from '../platform/engine';
import type { GameState } from '../game/state';
import type { Derived } from '../game/economy';
import { fmtMoney, fmtNum } from '../game/format';
import type { Portrait as PortraitDef } from '../game/content/skaters';
import { SKATER_BY_ID } from '../game/content/skaters';
import { feedback, type Feedback } from '../game/feedback';
import { sfx } from '../platform/audio';
import type { Result } from '../game/actions';

export const EngineCtx = createContext<Engine | null>(null);

export function useEngine(): Engine {
  const e = useContext(EngineCtx);
  if (!e) throw new Error('Engine missing');
  return e;
}

/** Re-render on every engine notify (≈10/s). Returns [state, derived, engine]. */
export function useGame(): [GameState, Derived, Engine] {
  const e = useEngine();
  useSyncExternalStore(e.subscribe, e.getVersion);
  return [e.state, e.derived(), e];
}

/** Run an action with audio/visual feedback for failures. */
export function useAct() {
  const e = useEngine();
  return (fn: (s: GameState, d: Derived) => Result | undefined, sound: 'buy' | 'unlock' | 'none' = 'buy') => {
    const r = e.act(fn);
    if (!r) return r;
    if (r.ok) {
      if (sound === 'buy') sfx.buy();
      else if (sound === 'unlock') sfx.unlock();
    } else if (r.msg) {
      sfx.error();
      feedback.emit({ kind: 'error', text: r.msg });
    }
    return r;
  };
}

export const Money = ({ v, className }: { v: number; className?: string }) => <span className={`num ${className ?? ''}`}>{fmtMoney(v)}</span>;

export function Bar({ value, max, tone, label }: { value: number; max: number; tone?: 'lime' | 'sky' | 'pink'; label?: string }) {
  const pct = max > 0 ? Math.max(0, Math.min(100, (value / max) * 100)) : 0;
  return (
    <div className={`bar ${tone ?? ''}`} role="progressbar" aria-valuemin={0} aria-valuemax={100} aria-valuenow={Math.round(pct)} aria-label={label}>
      <span style={{ width: `${pct}%` }} />
    </div>
  );
}

interface BuyProps {
  cost: number;
  cash: number;
  onClick: () => void;
  label: ReactNode;
  disabled?: boolean;
  disabledText?: string;
  className?: string;
  title?: string;
}

/** A purchase button: shows price, distinguishes unaffordable from locked. */
export function BuyBtn({ cost, cash, onClick, label, disabled, disabledText, className, title }: BuyProps) {
  const afford = cash >= cost && Number.isFinite(cost);
  if (disabled) {
    return (
      <button className={`btn small ${className ?? ''}`} disabled title={title}>
        {disabledText ?? label}
      </button>
    );
  }
  return (
    <button
      className={`btn small ${afford ? 'primary' : 'unaffordable'} ${className ?? ''}`}
      onClick={afford ? onClick : undefined}
      aria-disabled={!afford}
      title={title ?? (afford ? undefined : `Need ${fmtMoney(cost - cash)} more`)}
    >
      <span>{label}</span>
      <span className="price">{fmtMoney(cost)}</span>
    </button>
  );
}

export function Tip({ text, children }: { text: ReactNode; children?: ReactNode }) {
  return (
    <span className="tip">
      {children ?? (
        <button className="info" type="button" aria-label="More info">
          i
        </button>
      )}
      <span className="tipbox" role="tooltip">
        {text}
      </span>
    </span>
  );
}

export function Modal({ title, children, onClose, paper, wide }: { title: string; children: ReactNode; onClose?: () => void; paper?: boolean; wide?: boolean }) {
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const prev = document.activeElement as HTMLElement | null;
    ref.current?.querySelector<HTMLElement>('button, [href], input, textarea, select')?.focus();
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && onClose) onClose();
    };
    window.addEventListener('keydown', onKey);
    return () => {
      window.removeEventListener('keydown', onKey);
      prev?.focus?.();
    };
  }, [onClose]);
  return (
    <div className="modal-back" onMouseDown={(e) => e.target === e.currentTarget && onClose?.()}>
      <div ref={ref} className={`modal ${paper ? 'paper' : ''}`} role="dialog" aria-modal="true" aria-label={title} style={wide ? { maxWidth: 860 } : undefined}>
        <h2>{title}</h2>
        {children}
      </div>
    </div>
  );
}

export function LocHead({ title, blurb, children }: { title: string; blurb: string; children?: ReactNode }) {
  return (
    <div className="loc-head">
      <h1>{title}</h1>
      <p className="grow">{blurb}</p>
      {children}
    </div>
  );
}

export function TipCard({ id, children }: { id: string; children: ReactNode }) {
  const [s, , e] = useGame();
  if (s.meta.seenTips.includes(id)) return null;
  return (
    <div className="card paper" style={{ marginBottom: 14 }}>
      <div className="tape" />
      <div className="row between">
        <div className="grow" style={{ fontFamily: 'var(--marker)', fontSize: 16 }}>
          {children}
        </div>
        <button className="btn small ghost" style={{ color: 'var(--paper-ink)' }} onClick={() => e.act((st) => void st.meta.seenTips.push(id))}>
          Got it
        </button>
      </div>
    </div>
  );
}

// ---------------- Portrait (procedural SVG) ----------------
export function Portrait({ id, size = 56, dim }: { id: string; size?: number; dim?: boolean }) {
  const def = SKATER_BY_ID[id];
  if (!def) return null;
  return <PortraitSvg p={def.portrait} size={size} dim={dim} label={def.name} />;
}

export function PortraitSvg({ p, size, dim, label }: { p: PortraitDef; size: number; dim?: boolean; label: string }) {
  const hair = () => {
    switch (p.hairStyle) {
      case 'long':
        return <path d="M14 30 Q12 14 32 12 Q52 14 50 30 L52 50 Q46 44 46 34 L18 34 Q18 44 12 50 Z" fill={p.hair} />;
      case 'curly':
        return (
          <g fill={p.hair}>
            {[16, 22, 28, 34, 40, 46].map((x, i) => (
              <circle key={i} cx={x} cy={20 + (i % 2) * 3} r={6} />
            ))}
          </g>
        );
      case 'mohawk':
        return <path d="M28 4 L36 4 L37 24 L27 24 Z" fill={p.hair} />;
      case 'bun':
        return (
          <g fill={p.hair}>
            <circle cx={32} cy={9} r={6} />
            <path d="M15 28 Q15 13 32 13 Q49 13 49 28 Q42 20 32 20 Q22 20 15 28 Z" />
          </g>
        );
      case 'buzz':
        return <path d="M16 26 Q16 13 32 13 Q48 13 48 26 Q40 19 32 19 Q24 19 16 26 Z" fill={p.hair} opacity={0.85} />;
      case 'bald':
        return null;
      default:
        return <path d="M15 27 Q14 12 32 12 Q50 12 49 27 Q44 18 32 18 Q20 18 15 27 Z" fill={p.hair} />;
    }
  };
  const hat = () => {
    switch (p.hat) {
      case 'beanie':
        return (
          <g>
            <path d="M14 26 Q14 8 32 8 Q50 8 50 26 Z" fill={p.hatColor} stroke="#000" strokeWidth={2} />
            <rect x={13} y={22} width={38} height={7} rx={2} fill={p.hatColor} stroke="#000" strokeWidth={2} />
          </g>
        );
      case 'cap':
        return (
          <g>
            <path d="M15 24 Q15 10 32 10 Q49 10 49 24 Z" fill={p.hatColor} stroke="#000" strokeWidth={2} />
            <path d="M30 22 L58 24 L50 28 L30 26 Z" fill={p.hatColor} stroke="#000" strokeWidth={2} />
          </g>
        );
      case 'capBack':
        return (
          <g>
            <path d="M15 24 Q15 10 32 10 Q49 10 49 24 Z" fill={p.hatColor} stroke="#000" strokeWidth={2} />
            <path d="M15 22 L4 25 L9 28 L17 26 Z" fill={p.hatColor} stroke="#000" strokeWidth={2} />
          </g>
        );
      case 'bucket':
        return (
          <g>
            <path d="M18 22 L20 9 L44 9 L46 22 Z" fill={p.hatColor} stroke="#000" strokeWidth={2} />
            <ellipse cx={32} cy={23} rx={20} ry={4} fill={p.hatColor} stroke="#000" strokeWidth={2} />
          </g>
        );
      default:
        return null;
    }
  };
  return (
    <svg className="portrait" width={size} height={size} viewBox="0 0 64 64" role="img" aria-label={label} style={dim ? { filter: 'grayscale(1) brightness(0.6)' } : undefined}>
      <rect width={64} height={64} fill={p.bg} />
      <path d="M0 64 L0 58 Q32 40 64 58 L64 64 Z" fill={p.shirt} stroke="#000" strokeWidth={2} />
      <rect x={27} y={40} width={10} height={9} fill={p.skin} />
      <ellipse cx={32} cy={30} rx={15} ry={16} fill={p.skin} stroke="#000" strokeWidth={2} />
      {hair()}
      <circle cx={26} cy={31} r={1.8} fill="#111" />
      <circle cx={38} cy={31} r={1.8} fill="#111" />
      <path d="M27 38 Q32 41 37 38" stroke="#111" strokeWidth={1.6} fill="none" strokeLinecap="round" />
      {p.accessory === 'glasses' && (
        <g stroke="#111" strokeWidth={1.6} fill="none">
          <circle cx={26} cy={31} r={4} />
          <circle cx={38} cy={31} r={4} />
          <path d="M30 31 L34 31" />
        </g>
      )}
      {p.accessory === 'beard' && <path d="M18 34 Q20 48 32 48 Q44 48 46 34 Q42 42 32 42 Q22 42 18 34 Z" fill={p.hair} />}
      {p.accessory === 'earring' && <circle cx={17} cy={35} r={1.8} fill="#ffd23d" stroke="#000" strokeWidth={0.8} />}
      {p.accessory === 'bandana' && <path d="M17 22 Q32 17 47 22 L47 26 Q32 22 17 26 Z" fill="#ff3d5a" stroke="#000" strokeWidth={1.2} />}
      {hat()}
    </svg>
  );
}

// ---------------- Toasts ----------------
interface ToastItem extends Feedback {
  id: number;
}

export function Toasts() {
  const [items, setItems] = useState<ToastItem[]>([]);
  useEffect(() => {
    let n = 0;
    const off = feedback.on((f) => {
      if (f.kind === 'sale') return;
      const id = ++n;
      if (f.kind === 'milestone' || f.kind === 'achievement') sfx.milestone();
      else if (f.kind === 'unlock' || f.kind === 'video') sfx.unlock();
      else if (f.kind === 'opp' || f.kind === 'job' || f.kind === 'event') sfx.coin();
      setItems((xs) => [...xs.slice(-4), { ...f, id }]);
      setTimeout(() => setItems((xs) => xs.filter((x) => x.id !== id)), f.big ? 5000 : 3200);
    });
    return () => void off();
  }, []);
  return (
    <div className="toasts" role="status" aria-live="polite">
      {items.map((t) => (
        <div key={t.id} className={`toast ${t.kind}`}>
          {t.text}
        </div>
      ))}
    </div>
  );
}

export const Fans = ({ v }: { v: number }) => <span className="num">{fmtNum(v)}</span>;
