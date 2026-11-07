// Skatepark, Warehouse (distribution), Factory (manufacturing), Empire HQ (capstone).
import { useGame, useAct, BuyBtn, LocHead, TipCard, Bar, Money } from './kit';
import { FACILITIES, REGIONS, HQ_PHASES, HQ_PHASE_MULT, BRAND_LINES, DISTRO_REACH_MULT, PARK_VISITOR_RATE } from '../game/content/business';
import { PRODUCTS, PRODUCT_BY_ID } from '../game/content/products';
import { tracksFor } from '../game/content/tracks';
import * as A from '../game/actions';
import { fmtNum, fmtRate, fmtMoney } from '../game/format';
import { TrackRow } from './Shop';

export function Park() {
  const [s, d] = useGame();
  const act = useAct();
  const open = s.run.facilities.includes('miniramp');
  return (
    <>
      <LocHead title="Skatepark" blurb={`Facilities bring visitors and unlock perks across the empire. Park income: ${fmtRate(d.parkIncome)} visitors + ${fmtRate(d.members)} memberships.`} />
      <TipCard id="tip-park">
        Visitors pay admission & lessons while the park is busy; <b>memberships</b> pay a steady amount that runs at <b>full speed while you're away</b>. Each facility also has a perk for another system.
      </TipCard>
      <div className="grid two">
        <div className="card">
          <h2>Facilities {open && <span className="chip">{fmtNum(d.parkVisitors)} visitors</span>}</h2>
          {FACILITIES.map((f) => {
            const built = s.run.facilities.includes(f.id);
            const needsRamp = f.id !== 'miniramp' && !open;
            return (
              <div key={f.id} className={`item ${built ? '' : 'locked'}`}>
                <div className="icon" style={{ background: built ? 'var(--mint)' : 'var(--line)' }}>
                  {built ? '✓' : '+'}
                </div>
                <div style={{ minWidth: 0 }}>
                  <div className="title">{f.name}</div>
                  <div className="sub">{f.desc}</div>
                  <div className="sub">
                    +{f.visitors} visitors · <b className="good">{f.perk}</b>
                  </div>
                </div>
                <div className="actions">
                  {built ? (
                    <button className="btn small" disabled>
                      Built
                    </button>
                  ) : (
                    <BuyBtn cost={f.cost} cash={s.run.cash} label="Build" disabled={needsRamp} disabledText="Build Mini Ramp first" onClick={() => act((x) => A.buyFacility(x, f.id), 'unlock')} />
                  )}
                </div>
              </div>
            );
          })}
        </div>
        <div className="card">
          <h2>Park business</h2>
          {tracksFor('park').map((t) => (
            <TrackRow key={t.id} id={t.id} />
          ))}
          <p className="tiny muted" style={{ marginBottom: 0 }}>
            Visitor income = shop base × {PARK_VISITOR_RATE} × visitors × spend. Lessons also make skater training cheaper.
          </p>
        </div>
      </div>
    </>
  );
}

export function Warehouse() {
  const [s, d] = useGame();
  const act = useAct();
  const reachMult = 1 + DISTRO_REACH_MULT * d.distroReach;
  return (
    <>
      <LocHead title="Warehouse" blurb={`Ship product lines to new regions. Each slotted category (and its brand line) earns ×${reachMult.toFixed(2)}.`} />
      <TipCard id="tip-warehouse">
        Open regions to increase <b>reach</b>. You only have a few <b>distribution slots</b> — pick which categories to ship. Your biggest categories, or the ones with strong brand lines, usually win.
      </TipCard>
      <div className="grid two">
        <div className="stack">
          <div className="card">
            <h2>
              Distribution slots {s.run.distroSlots.length}/{d.distroSlots}
            </h2>
            {PRODUCTS.filter((p) => s.run.products[p.id] > 0).map((p) => {
              const on = s.run.distroSlots.includes(p.id);
              return (
                <div key={p.id} className="item">
                  <div className="icon" style={{ background: p.color }}>
                    {p.name[0]}
                  </div>
                  <div>
                    <div className="title">
                      {p.name} {on && <span className="chip">SHIPPING</span>} {s.run.brand[p.id] && <span className="chip p">brand line</span>}
                    </div>
                    <div className="sub">
                      {fmtRate(d.productIncome[p.id])} now{on ? ` (includes ×${reachMult.toFixed(2)})` : ` → ≈ ${fmtRate(d.productIncome[p.id] * reachMult)} if slotted`}
                    </div>
                  </div>
                  <div className="actions">
                    <button className={`btn small ${on ? 'lime' : ''}`} disabled={!on && s.run.distroSlots.length >= d.distroSlots} onClick={() => act((x, dd) => A.toggleSlot(x, p.id, dd), 'none')}>
                      {on ? 'Unslot' : 'Slot'}
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
        <div className="stack">
          <div className="card">
            <h2>Regions · reach {d.distroReach.toFixed(1)}</h2>
            {REGIONS.map((g, i) => {
              const owned = s.run.regions.includes(g.id);
              const prevOk = i === 0 || s.run.regions.includes(REGIONS[i - 1].id);
              return (
                <div key={g.id} className={`item ${owned ? '' : 'locked'}`}>
                  <div className="icon" style={{ background: owned ? 'var(--yellow)' : 'var(--line)' }}>
                    {i + 1}
                  </div>
                  <div>
                    <div className="title">{g.name}</div>
                    <div className="sub">+{g.reach} reach</div>
                  </div>
                  <div className="actions">
                    {owned ? (
                      <button className="btn small" disabled>
                        Open
                      </button>
                    ) : (
                      <BuyBtn cost={g.cost} cash={s.run.cash} label="Open" disabled={!prevOk} disabledText="Open previous first" onClick={() => act((x) => A.buyRegion(x, g.id), 'unlock')} />
                    )}
                  </div>
                </div>
              );
            })}
          </div>
          <div className="card">
            <h2>Operations</h2>
            {tracksFor('distro').map((t) => (
              <TrackRow key={t.id} id={t.id} />
            ))}
          </div>
        </div>
      </div>
    </>
  );
}

export function Factory() {
  const [s, d] = useGame();
  const act = useAct();
  const used = Object.values(s.run.factory).reduce((a: number, b) => a + (b ?? 0), 0);
  const lines = BRAND_LINES.filter((b) => s.run.brand[b.product]);
  return (
    <>
      <LocHead title="Factory" blurb={`Allocate production capacity to your brand lines. ${used}/${d.factoryPoints} points in use.`} />
      <TipCard id="tip-factory">
        Each point boosts a line's <b>brand income</b> and its <b>shop category</b>, with diminishing returns per line — so spreading out vs. stacking your best line is a real choice. Reallocating is free.
      </TipCard>
      <div className="grid two">
        <div className="card">
          <h2>Allocation</h2>
          {!lines.length && <p className="small muted">Design brand lines in the Workshop first.</p>}
          {lines.map((bl) => {
            const p = s.run.factory[bl.product] ?? 0;
            const info = d.brandByLine[bl.product];
            return (
              <div key={bl.product} className="item">
                <div className="icon" style={{ background: PRODUCT_BY_ID[bl.product].color }}>
                  {p}
                </div>
                <div>
                  <div className="title">{bl.name}</div>
                  <div className="sub">
                    Brand ×{Math.pow(1 + 0.5 * p, 0.7).toFixed(2)} · {PRODUCT_BY_ID[bl.product].name} ×{Math.pow(1 + 0.25 * p, 0.6).toFixed(2)} · now {fmtRate(info?.income ?? 0)}
                  </div>
                </div>
                <div className="actions" style={{ flexDirection: 'row' }}>
                  <button className="btn small" aria-label={`Remove a point from ${bl.name}`} disabled={p <= 0} onClick={() => act((x, dd) => A.allocate(x, bl.product, -1, dd), 'none')}>
                    −
                  </button>
                  <button className="btn small primary" aria-label={`Add a point to ${bl.name}`} disabled={used >= d.factoryPoints} onClick={() => act((x, dd) => A.allocate(x, bl.product, 1, dd), 'buy')}>
                    +
                  </button>
                </div>
              </div>
            );
          })}
        </div>
        <div className="card">
          <h2>Plant</h2>
          {tracksFor('factory').map((t) => (
            <TrackRow key={t.id} id={t.id} />
          ))}
        </div>
      </div>
    </>
  );
}

export function HQ() {
  const [s] = useGame();
  const act = useAct();
  const phase = s.meta.hqPhase;
  const done = phase >= HQ_PHASES.length;
  const next = HQ_PHASES[phase];
  return (
    <>
      <LocHead title="Empire HQ" blurb="The capstone. Fund five construction phases with run cash. Progress is permanent across Legacies, and each phase multiplies all income." />
      <div className="grid two">
        <div className="card">
          <svg viewBox="0 0 400 300" style={{ width: '100%', display: 'block', border: '3px solid #000', borderRadius: 12, background: '#1e2a3a' }} role="img" aria-label={`Empire Tower: ${phase} of 5 phases built`}>
            <rect y={250} width={400} height={50} fill="#3a3a40" />
            {Array.from({ length: 5 }).map((_, i) => {
              const built = i < phase;
              const y = 250 - (i + 1) * 44;
              return (
                <g key={i} opacity={built ? 1 : 0.18}>
                  <rect x={130 - i * 2} y={y} width={140 + i * 4} height={44} fill={built ? '#2d3d55' : 'none'} stroke={built ? '#000' : '#aaa'} strokeDasharray={built ? undefined : '6 6'} strokeWidth={3} />
                  {built && Array.from({ length: 5 }).map((__, j) => <rect key={j} x={142 + j * 26} y={y + 12} width={16} height={20} fill="#3dc6ff" opacity={0.8} />)}
                </g>
              );
            })}
            {done && (
              <g>
                <rect x={150} y={8} width={100} height={22} fill="#c6ff3d" stroke="#000" strokeWidth={3} />
                <text x={200} y={24} textAnchor="middle" fontFamily="Bungee, sans-serif" fontSize={12}>
                  GRIP EMPIRE
                </text>
              </g>
            )}
          </svg>
          <Bar value={phase} max={HQ_PHASES.length} tone="lime" label="HQ phases" />
          <p className="small muted">Built phases multiply all income by ×{HQ_PHASE_MULT} each (currently ×{Math.pow(HQ_PHASE_MULT, phase).toFixed(2)}).</p>
        </div>
        <div className="card">
          {done ? (
            <>
              <h2>🏆 The Empire Tower stands.</h2>
              <p>From a bin of bushings to a skyline logo. You completed the main progression of Grip Empire.</p>
              <p className="small muted">
                Keep playing as long as you like: Reputation in the Legacy tree is endless, every system keeps scaling, and there are achievements left to chase.
                {s.meta.capstoneAt ? ` Completed ${new Date(s.meta.capstoneAt).toLocaleDateString()}.` : ''}
              </p>
            </>
          ) : (
            <>
              <h2>
                Phase {phase + 1}: {next.name}
              </h2>
              <p>{next.desc}</p>
              <BuyBtn cost={next.cost} cash={s.run.cash} label="Fund phase" onClick={() => act((x) => A.fundHQ(x), 'unlock')} />
              <p className="small muted">
                You have <Money v={s.run.cash} /> of {fmtMoney(next.cost)}.
              </p>
              <ol className="small">
                {HQ_PHASES.map((p, i) => (
                  <li key={p.name} className={i < phase ? 'good' : i === phase ? '' : 'dim'}>
                    {p.name} — {fmtMoney(p.cost)}
                  </li>
                ))}
              </ol>
            </>
          )}
        </div>
      </div>
    </>
  );
}
