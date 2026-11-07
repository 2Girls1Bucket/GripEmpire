import { useCallback, useEffect, useRef, useState } from 'react';
import { useGame, useAct, BuyBtn, Bar, Tip, LocHead, TipCard, Money } from './kit';
import { PRODUCTS, describeMilestone, type ProductId } from '../game/content/products';
import { TRACK_BY_ID, tracksFor } from '../game/content/tracks';
import * as A from '../game/actions';
import { milestoneMults, nextMilestone, trackCost, STREAK_PER_STACK, RUSH_MULT } from '../game/economy';
import { productOffered, trackLock } from '../game/unlocks';
import { fmtMoney, fmtNum, fmtRate } from '../game/format';
import { sfx } from '../platform/audio';
import { getSettings } from '../platform/settings';
import { ShopScene } from './ShopScene';
import { HOLD_SERVE_RATE } from '../game/config';

type Mode = 1 | 10 | 'max' | 'next';

export function Shop() {
  const [s, d] = useGame();
  const [tab, setTab] = useState<'products' | 'upgrades'>('products');
  const [mode, setMode] = useState<Mode>(1);
  return (
    <>
      <LocHead title="The Shop" blurb="Serve customers, sign supplier contracts and grow the store. Everything else in your empire pays in proportion to how big the shop is." />
      <TipCard id="tip-shop">
        Click <b>SERVE</b> (or hold <span className="kbd">Space</span>) to sell. Spend cash on more stock levels. Hire staff to earn while you do other things!
      </TipCard>
      <div className="grid two">
        <div className="stack">
          <ServePanel />
          <Opportunity />
          <IncomeCard />
        </div>
        <div className="stack">
          <div className="card">
            <div className="row between" style={{ marginBottom: 10 }}>
              <div className="seg" role="group" aria-label="Shop sections">
                <button aria-pressed={tab === 'products'} onClick={() => setTab('products')}>
                  Products
                </button>
                <button aria-pressed={tab === 'upgrades'} onClick={() => setTab('upgrades')}>
                  Shop Upgrades
                </button>
              </div>
              {tab === 'products' && (
                <div className="seg" role="group" aria-label="Buy amount">
                  {([1, 10, 'max', 'next'] as Mode[]).map((m) => (
                    <button key={String(m)} aria-pressed={mode === m} onClick={() => setMode(m)} title={m === 'next' ? 'Buy up to the next milestone' : m === 'max' ? 'Buy as many as you can afford' : `Buy ${m}`}>
                      {m === 'max' ? 'MAX' : m === 'next' ? 'NEXT ★' : `×${m}`}
                    </button>
                  ))}
                </div>
              )}
            </div>
            {tab === 'products' ? <ProductList mode={mode} /> : <UpgradeList />}
          </div>
          {s.meta.nodes.autobuy ? <AutoBuy /> : null}
        </div>
      </div>
      <span className="sr-only">{fmtMoney(d.passive)}</span>
    </>
  );
}

// ---------------- Serving ----------------
function ServePanel() {
  const [s, d, e] = useGame();
  const [held, setHeld] = useState(false);
  const [floaters, setFloaters] = useState<{ id: number; x: number; y: number; v: number }[]>([]);
  const [flash, setFlash] = useState(0);
  const heldRef = useRef(false);
  const fid = useRef(0);
  const btn = useRef<HTMLButtonElement>(null);

  const doServe = useCallback(() => {
    const got = e.quick((st, dd) => A.serve(st, dd)) ?? 0;
    if (got > 0) {
      sfx.sale();
      setFlash((f) => f + 1);
      if (getSettings().saleFloaters) {
        const id = ++fid.current;
        setFloaters((xs) => [...xs.slice(-6), { id, x: 20 + Math.random() * 60, y: 10 + Math.random() * 30, v: got }]);
        setTimeout(() => setFloaters((xs) => xs.filter((f) => f.id !== id)), 900);
      }
    }
  }, [e]);

  // Hold-to-serve loop at a controlled rate (equal to the serve cap, so mashing is never required).
  useEffect(() => {
    heldRef.current = held;
    if (!held) return;
    doServe();
    const iv = setInterval(() => heldRef.current && doServe(), 1000 / HOLD_SERVE_RATE);
    return () => clearInterval(iv);
  }, [held, doServe]);

  // Keyboard: hold Space (anywhere except text fields / other buttons) or S.
  useEffect(() => {
    const isField = (t: EventTarget | null) => t instanceof HTMLElement && (t.tagName === 'INPUT' || t.tagName === 'TEXTAREA' || t.tagName === 'SELECT');
    const down = (ev: KeyboardEvent) => {
      if (isField(ev.target) || document.querySelector('.modal-back')) return;
      const onOtherButton = ev.target instanceof HTMLButtonElement && ev.target !== btn.current;
      if ((ev.code === 'Space' && !onOtherButton) || ev.code === 'KeyS') {
        ev.preventDefault();
        if (!ev.repeat) setHeld(true);
      }
    };
    const up = (ev: KeyboardEvent) => {
      if (ev.code === 'Space' || ev.code === 'KeyS') setHeld(false);
    };
    const blur = () => setHeld(false);
    window.addEventListener('keydown', down);
    window.addEventListener('keyup', up);
    window.addEventListener('blur', blur);
    return () => {
      window.removeEventListener('keydown', down);
      window.removeEventListener('keyup', up);
      window.removeEventListener('blur', blur);
    };
  }, []);

  const r = s.run;
  const streakBonus = STREAK_PER_STACK * Math.floor(r.streak);
  const rush = r.rushLeft > 0;
  const perSale = d.saleValue * (1 + streakBonus) * (rush ? RUSH_MULT : 1);
  const customers = Math.min(7, 1 + Math.floor(Math.log10(1 + d.passive + d.saleValue)) + (rush ? 3 : 0));
  return (
    <div className="card">
      <ShopScene products={r.products} staff={r.tracks.staff ?? 0} displays={r.tracks.displays ?? 0} customers={customers} rush={rush} online={(r.tracks.online ?? 0) > 0} serveFlash={flash} />
      <div className="serve-wrap" style={{ marginTop: 12 }}>
        <button
          ref={btn}
          className={`serve ${held ? 'held' : ''} ${rush ? 'rush' : ''}`}
          onPointerDown={(ev) => {
            ev.preventDefault();
            (ev.target as HTMLElement).setPointerCapture?.(ev.pointerId);
            setHeld(true);
          }}
          onPointerUp={() => setHeld(false)}
          onPointerCancel={() => setHeld(false)}
          onKeyDown={(ev) => {
            if (ev.key === 'Enter' && !ev.repeat) setHeld(true);
          }}
          onKeyUp={(ev) => ev.key === 'Enter' && setHeld(false)}
          aria-label={`Serve a customer for ${fmtMoney(perSale)}. Hold to keep serving.`}
        >
          SERVE
          <small>
            {fmtMoney(perSale)} per sale · hold to keep serving
          </small>
          <span className="floaters" aria-hidden>
            {floaters.map((f) => (
              <span key={f.id} className="floater" style={{ left: `${f.x}%`, top: `${f.y}%` }}>
                +{fmtMoney(f.v)}
              </span>
            ))}
          </span>
        </button>
      </div>
      <div className="row between small" style={{ marginTop: 10 }}>
        <span>
          Streak <b className="num">{Math.floor(r.streak)}</b>/{d.streakMax} <span className="good">+{Math.round(streakBonus * 100)}%</span>{' '}
          <Tip text={`Each consecutive sale adds +2% sale value up to the max. The streak fades slowly after ~2.5s without a sale, so short breaks are fine. Serving is capped at ${HOLD_SERVE_RATE}/s — holding is as fast as clicking.`} />
        </span>
        {rush && <span className="sticker" style={{ background: 'var(--pink)' }}>RUSH ×{RUSH_MULT} · {Math.ceil(r.rushLeft)}s</span>}
      </div>
      <div style={{ marginTop: 6 }}>
        <Bar value={r.streak} max={d.streakMax} tone="lime" label="Sales streak" />
      </div>
      {(r.tracks.staff ?? 0) === 0 && <p className="small warn" style={{ marginBottom: 0 }}>No staff yet — the shop only earns when you serve. Hire staff under Shop Upgrades.</p>}
    </div>
  );
}

// ---------------- Opportunities ----------------
function Opportunity() {
  const [s, d] = useGame();
  const act = useAct();
  const [pick, setPick] = useState({ wheels: -1, trucks: -1, bushings: -1 });
  const o = s.run.opp;
  useEffect(() => setPick({ wheels: -1, trucks: -1, bushings: -1 }), [o?.kind, o && 'customer' in o ? o.customer : '']);
  if (!o) return null;
  if (o.kind === 'rush') {
    return (
      <div className="card opp">
        <h3>🚨 Customer rush outside!</h3>
        <p className="small">A skate camp just let out. Open the doors for {Math.round(12 * d.oppReward)}s of ×{RUSH_MULT} sale value.</p>
        <div className="row">
          <button className="btn primary" onClick={() => act((st) => A.openRush(st), 'unlock')}>
            Open the doors!
          </button>
          <span className="small muted">Leaves in {Math.ceil(o.expires)}s</span>
          <button className="btn small ghost" onClick={() => act((st) => A.dismissOpp(st), 'none')}>
            Ignore
          </button>
        </div>
      </div>
    );
  }
  if (o.kind === 'bulk') {
    const reward = o.rewardSec * d.shopBase * d.oppReward;
    return (
      <div className="card opp bulk">
        <h3>📦 {o.label}</h3>
        {!o.accepted ? (
          <>
            <p className="small">
              Ring up {o.need} sales within {o.timeLeft}s to deliver. Pays <b>{fmtMoney(reward)}</b> (half pay pro-rata if you run out of time).
            </p>
            <div className="row">
              <button className="btn primary" onClick={() => act((st) => A.acceptBulk(st), 'buy')}>
                Accept order
              </button>
              <span className="small muted">Expires in {Math.ceil(o.expires)}s</span>
              <button className="btn small ghost" onClick={() => act((st) => A.dismissOpp(st), 'none')}>
                Pass
              </button>
            </div>
          </>
        ) : (
          <>
            <p className="small">
              Packing… {o.progress}/{o.need} sales · {Math.ceil(o.timeLeft)}s left
            </p>
            <Bar value={o.progress} max={o.need} tone="sky" label="Bulk order progress" />
          </>
        )}
      </div>
    );
  }
  const style = A.BOARD_STYLES[o.style];
  const reward = o.rewardSec * d.shopBase * d.oppReward;
  const ready = pick.wheels >= 0 && pick.trucks >= 0 && pick.bushings >= 0;
  return (
    <div className="card opp board">
      <h3>
        🛹 Build a {style.label} complete for {o.customer}
      </h3>
      <p className="small">“{style.hint}”</p>
      {(['wheels', 'trucks', 'bushings'] as const).map((part) => (
        <div key={part} className="row" style={{ marginBottom: 6 }}>
          <span className="small" style={{ width: 70, textTransform: 'capitalize' }}>
            {part}
          </span>
          <div className="seg" role="group" aria-label={part}>
            {A.BOARD_PARTS[part].map((label, i) => (
              <button key={label} aria-pressed={pick[part] === i} onClick={() => setPick((p) => ({ ...p, [part]: i }))}>
                {label}
              </button>
            ))}
          </div>
        </div>
      ))}
      <div className="row">
        <button className="btn lime" disabled={!ready} onClick={() => act((st, dd) => A.completeBoard(st, pick, dd), 'none')}>
          Hand it over ({fmtMoney(reward)} if perfect)
        </button>
        <span className="small muted">{Math.ceil(o.expires)}s</span>
      </div>
    </div>
  );
}

// ---------------- Income breakdown ----------------
function IncomeCard() {
  const [s, d] = useGame();
  const rows: [string, number, string][] = [
    ['Shop (staffed)', d.shopPassive, 'Product income × staff multiplier.'],
    ['Online store', d.online, 'A share of passive shop income. Runs at double efficiency offline.'],
    ['Video royalties', d.royalties, 'Fixed at release from shop size × video quality.'],
    ['Brand income', d.brandIncome, 'Your own brand lines.'],
    ['Skatepark', d.parkIncome + d.members, 'Visitors and memberships.'],
  ];
  return (
    <div className="card">
      <h3>
        Income <Tip text="Automated income keeps flowing while the tab is open but idle. When the game is closed it runs at reduced offline efficiency, up to a cap. Assignment and event payouts come on top and scale with shop size." />
      </h3>
      {rows
        .filter((r) => r[1] > 0 || r[0] === 'Shop (staffed)')
        .map(([label, v, tip]) => (
          <div key={label} className="row between small" title={tip}>
            <span>{label}</span>
            <b className="num">{fmtRate(v)}</b>
          </div>
        ))}
      <hr className="divider" />
      <div className="row between small">
        <span>
          <b>Total automated</b>
        </span>
        <b className="num warn">{fmtRate(d.passive)}</b>
      </div>
      <div className="row between small muted">
        <span>Holding SERVE adds about</span>
        <span className="num">{fmtRate(d.saleValue * HOLD_SERVE_RATE * (1 + STREAK_PER_STACK * d.streakMax * 0.8))}</span>
      </div>
      <div className="row between small muted">
        <span>Fans traffic bonus</span>
        <span className="num">×{d.fanMult.toFixed(2)}</span>
      </div>
      <div className="row between small muted">
        <span>Run earnings</span>
        <Money v={s.run.earnings} />
      </div>
    </div>
  );
}

// ---------------- Products ----------------
function ProductList({ mode }: { mode: Mode }) {
  const [s, d] = useGame();
  const act = useAct();
  const visible = PRODUCTS.filter((p) => s.run.products[p.id] > 0 || productOffered(s, p.id));
  const total = d.shopBase || 1;
  return (
    <div>
      {visible.map((p) => {
        const lvl = s.run.products[p.id];
        if (lvl <= 0) {
          return (
            <div key={p.id} className="item locked">
              <div className="icon" style={{ background: p.color }}>
                ?
              </div>
              <div>
                <div className="title">{p.name}</div>
                <div className="sub">
                  Sign the <b>{p.contract}</b>. {p.flavor}
                </div>
                <div className="sub">Base ${fmtNum(p.incomePerLevel * d.productMult[p.id] * d.globalMult)}/s per level at current multipliers.</div>
              </div>
              <div className="actions">
                <BuyBtn cost={p.unlockCost} cash={s.run.cash} label="Sign contract" onClick={() => act((st) => A.unlockProduct(st, p.id), 'unlock')} />
              </div>
            </div>
          );
        }
        return <ProductRow key={p.id} id={p.id} mode={mode} share={d.productIncome[p.id] / total} act={act} />;
      })}
      {PRODUCTS.some((p) => !productOffered(s, p.id)) && <p className="small dim">More supplier contracts unlock as you sign each one.</p>}
    </div>
  );
}

function ProductRow({ id, mode, share, act }: { id: ProductId; mode: Mode; share: number; act: ReturnType<typeof useAct> }) {
  const [s, d] = useGame();
  const p = PRODUCTS.find((x) => x.id === id)!;
  const lvl = s.run.products[id];
  const plan = A.productBuyPlan(s, id, mode, d);
  const ms = nextMilestone(p, lvl);
  const prevMs = [...p.milestones].reverse().find((m) => m.level <= lvl)?.level ?? 0;
  const cur = milestoneMults(p, lvl);
  const after = milestoneMults(p, lvl + plan.n);
  const perLevel = d.productIncome[id] / (lvl * cur.self);
  const gain = (lvl + plan.n) * after.self * perLevel - d.productIncome[id];
  const crosses = ms && lvl + plan.n >= ms.level;
  return (
    <div className="item">
      <div className="icon" style={{ background: p.color }}>
        {p.name[0]}
      </div>
      <div style={{ minWidth: 0 }}>
        <div className="title">
          {p.name} <span className="lvl">LV {lvl}</span>
          <span className="chip y">{fmtRate(d.productIncome[id])}</span>
          <span className="tiny muted">{Math.round(share * 100)}% of shop</span>
        </div>
        {ms ? (
          <>
            <div className="sub">
              Next ★ Lv {ms.level}: {describeMilestone(ms)}
            </div>
            <Bar value={lvl - prevMs} max={ms.level - prevMs} label={`${p.name} milestone progress`} />
          </>
        ) : (
          <div className="sub">All milestones reached.</div>
        )}
      </div>
      <div className="actions">
        <BuyBtn
          cost={plan.cost}
          cash={s.run.cash}
          label={`+${plan.n}`}
          onClick={() => act((st, dd) => A.buyProduct(st, id, mode === 'max' ? 'max' : mode, dd))}
          title={`+${fmtRate(gain)}${crosses ? ' and a milestone!' : ''}`}
        />
        <span className="tiny muted" style={{ textAlign: 'center' }}>
          +{fmtRate(gain)}
          {crosses ? ' ★' : ''}
        </span>
      </div>
    </div>
  );
}

// ---------------- Upgrades ----------------
function UpgradeList() {
  const [s] = useGame();
  return (
    <div>
      {tracksFor('shop').map((t) => (
        <TrackRow key={t.id} id={t.id} />
      ))}
      <p className="small dim" style={{ marginBottom: 0 }}>
        Tip: Staff boosts automated income; Checkout boosts your own sales. Marketing and Displays boost everything (including manual sales, assignments and events, which all scale
        with the shop).
      </p>
      <span className="sr-only">{s.run.cash}</span>
    </div>
  );
}

export function TrackRow({ id }: { id: string }) {
  const [s] = useGame();
  const act = useAct();
  const t = TRACK_BY_ID[id];
  const lvl = s.run.tracks[id] ?? 0;
  const lock = trackLock(s, id);
  const maxed = t.maxLevel !== undefined && lvl >= t.maxLevel;
  const cost = trackCost(id, lvl);
  return (
    <div className={`item ${lock ? 'locked' : ''}`}>
      <div className="icon" style={{ background: 'var(--sky)' }}>
        {lvl}
      </div>
      <div style={{ minWidth: 0 }}>
        <div className="title">
          {t.name} <span className="lvl">LV {lvl}{t.maxLevel !== undefined ? `/${t.maxLevel}` : ''}</span>
          {t.tierNames && <span className="tiny muted">{t.tierNames[Math.min(lvl, t.tierNames.length - 1)]}</span>}
        </div>
        <div className="sub">{t.desc}</div>
        <div className="sub">
          Now: <b>{t.show(lvl)}</b>
          {!maxed && (
            <>
              {' '}
              → <span className="good">{t.show(lvl + 1)}</span>
            </>
          )}
        </div>
      </div>
      <div className="actions">
        {lock ? (
          <button className="btn small" disabled>
            {lock}
          </button>
        ) : maxed ? (
          <button className="btn small" disabled>
            Maxed
          </button>
        ) : (
          <BuyBtn cost={cost} cash={s.run.cash} label="Upgrade" onClick={() => act((st) => A.buyTrack(st, id))} />
        )}
      </div>
    </div>
  );
}

function AutoBuy() {
  const [s] = useGame();
  const act = useAct();
  return (
    <div className="card">
      <h3>Shop Manager (auto-buyer)</h3>
      <div className="row">
        <button className={`btn small ${s.run.autoBuy ? 'lime' : ''}`} onClick={() => act((st) => A.setAutoBuy(st, !st.run.autoBuy), 'none')}>
          {s.run.autoBuy ? 'ON' : 'OFF'}
        </button>
        <label className="small grow">
          Keep {Math.round(s.run.autoBuyReserve * 100)}% of cash in reserve
          <input type="range" min={0} max={0.9} step={0.05} value={s.run.autoBuyReserve} onChange={(ev) => act((st) => ((st.run.autoBuyReserve = Number(ev.target.value)), { ok: true }), 'none')} />
        </label>
      </div>
      <p className="tiny muted" style={{ margin: 0 }}>
        Buys the best-value product levels and contracts about once a second while the game is open (not while closed).
      </p>
    </div>
  );
}
