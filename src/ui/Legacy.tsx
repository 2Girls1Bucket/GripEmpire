import { useState } from 'react';
import { useGame, useAct, LocHead, Modal, Money, Portrait, Tip } from './kit';
import { BRANCH_INFO, LEGACY_NODES, LEGACY_UNLOCKS, MIN_LEGACY_CRED, CRED_INCOME_BONUS, type LegacyBranch } from '../game/content/legacy';
import { ACHIEVEMENTS } from '../game/content/achievements';
import { SKATER_BY_ID } from '../game/content/skaters';
import { legacyPreview, performLegacy, buyNode, nodeCost, nodeLock, RUN_ACCOMPLISHMENTS, ACCOMPLISHMENT_BONUS } from '../game/prestige';
import { credMult } from '../game/economy';
import { fmtMoney, fmtNum, fmtTime } from '../game/format';
import { sfx } from '../platform/audio';

export function LegacyView() {
  const [s] = useGame();
  const [tab, setTab] = useState<'legacy' | 'tree' | 'awards' | 'stats'>('legacy');
  return (
    <>
      <LocHead title="Hall of Fame" blurb={`Legacy ${s.meta.legacyCount} · ${fmtNum(s.meta.cred)} Cred to spend · lifetime Cred ${fmtNum(s.meta.credEarned)} (all income ×${credMult(s.meta.credEarned).toFixed(2)})`}>
        <div className="seg" role="group" aria-label="Hall of Fame sections">
          {(
            [
              ['legacy', 'Legacy'],
              ['tree', 'Upgrades'],
              ['awards', `Achievements ${s.meta.achievements.length}/${ACHIEVEMENTS.length}`],
              ['stats', 'Stats'],
            ] as const
          ).map(([k, label]) => (
            <button key={k} aria-pressed={tab === k} onClick={() => setTab(k)}>
              {label}
            </button>
          ))}
        </div>
      </LocHead>
      {tab === 'legacy' && <LegacyPanel />}
      {tab === 'tree' && <Tree />}
      {tab === 'awards' && <Awards />}
      {tab === 'stats' && <Stats />}
    </>
  );
}

function LegacyPanel() {
  const [s, , e] = useGame();
  const [confirm, setConfirm] = useState(false);
  const pv = legacyPreview(s);
  const progress = Math.min(1, s.run.earnings / Math.max(1, pv.minEarnings));
  return (
    <div className="grid two">
      <div className="stack">
        <div className="card paper">
          <div className="tape" />
          <h2>Legacy</h2>
          <p>
            Retire this run and start fresh with <b>Cred</b> — a permanent currency for the upgrade tree. Every Cred you ever earn also boosts all income (
            <i>×√(1 + {CRED_INCOME_BONUS}×lifetime Cred)</i>). Spending cash never reduces your reward.
          </p>
          <div style={{ fontFamily: 'var(--display)', fontSize: 34 }}>{pv.available ? `+${pv.gain} Cred` : `${pv.gain} / ${MIN_LEGACY_CRED} Cred`}</div>
          <p className="small muted">
            Based on this run's earnings (<Money v={s.run.earnings} />) on top of your lifetime earnings, ×{pv.mult.toFixed(2)} for accomplishments.
          </p>
          {!pv.available ? (
            <>
              <div className="bar" style={{ marginBottom: 6 }}>
                <span style={{ width: `${progress * 100}%` }} />
              </div>
              <p className="small">
                Legacy unlocks at about <b>{fmtMoney(pv.minEarnings)}</b> run earnings ({MIN_LEGACY_CRED} Cred).
              </p>
            </>
          ) : (
            <p className="small">
              Next Cred at <b>{fmtMoney(pv.nextAt)}</b> run earnings. Cred grows with total lifetime earnings, so a quick reset gives little — pushing further this run (new contracts, accomplishments) pays off.
            </p>
          )}
          <button className="btn primary" disabled={!pv.available} onClick={() => setConfirm(true)} style={{ minHeight: 48, fontSize: 16 }}>
            {pv.available ? `Legacy for +${pv.gain} Cred…` : 'Not yet'}
          </button>
        </div>
        <div className="card">
          <h3>
            This run's accomplishments <span className="chip y">+{Math.round(ACCOMPLISHMENT_BONUS * 100)}% Cred each</span>
          </h3>
          <div className="grid halves" style={{ gap: 4 }}>
            {RUN_ACCOMPLISHMENTS.map((a) => {
              const done = s.run.accomplishments.includes(a.id);
              return (
                <div key={a.id} className={`small ${done ? 'good' : 'dim'}`}>
                  {done ? '✔' : '○'} {a.text}
                </div>
              );
            })}
          </div>
        </div>
      </div>
      <div className="card">
        <h2>The road ahead</h2>
        {LEGACY_UNLOCKS.map((u) => {
          const got = s.meta.legacyCount >= u.legacy;
          return (
            <div key={u.legacy} className={`item ${got ? '' : 'locked'}`}>
              <div className="icon" style={{ background: got ? 'var(--yellow)' : 'var(--line)' }}>
                {u.legacy}
              </div>
              <div>
                <div className="title">
                  Legacy {u.legacy}: {u.title} {got && <span className="chip">UNLOCKED</span>}
                </div>
                <ul className="small" style={{ margin: '2px 0 0', paddingLeft: 18 }}>
                  {u.items.map((i) => (
                    <li key={i}>{i}</li>
                  ))}
                </ul>
              </div>
              <span />
            </div>
          );
        })}
        <p className="tiny muted">Unlocks are permanent availability — you still invest in each system again every run.</p>
      </div>
      {confirm && (
        <Modal title={`Legacy ${s.meta.legacyCount + 1}: +${pv.gain} Cred`} onClose={() => setConfirm(false)} wide>
          <LegacyConfirm
            onDo={(founder) => {
              const r = e.act((st) => performLegacy(st, founder));
              if (r?.ok) {
                sfx.milestone();
                setConfirm(false);
              }
            }}
            onCancel={() => setConfirm(false)}
          />
        </Modal>
      )}
    </div>
  );
}

function LegacyConfirm({ onDo, onCancel }: { onDo: (founder: string | null) => void; onCancel: () => void }) {
  const [s] = useGame();
  const pv = legacyPreview(s);
  const [founder, setFounder] = useState<string | null>(s.run.team[0]?.id ?? null);
  const keepPct = pv.founderLevel * 25;
  return (
    <div className="stack">
      <div className="grid halves">
        <div className="card">
          <h3 className="bad">Resets</h3>
          <ul className="small" style={{ margin: 0, paddingLeft: 18 }}>
            <li>Cash ({fmtMoney(s.run.cash)}) and run earnings</li>
            <li>Supplier contracts, product levels and shop upgrades</li>
            <li>All run upgrades (team, gear, venue, park, warehouse, factory)</li>
            <li>Skaters signed and their training{pv.founderLevel ? ' (except your Founding Skater)' : ''}</li>
            <li>Assignments, filming project, videos & royalties, events, fans</li>
            <li>Brand lines, facilities, regions, factory allocation</li>
          </ul>
        </div>
        <div className="card">
          <h3 className="good">Keeps</h3>
          <ul className="small" style={{ margin: 0, paddingLeft: 18 }}>
            <li>
              Cred: {fmtNum(s.meta.cred)} → <b>{fmtNum(s.meta.cred + pv.gain)}</b> (lifetime {fmtNum(s.meta.credEarned + pv.gain)}, income ×{credMult(s.meta.credEarned + pv.gain).toFixed(2)})
            </li>
            <li>Permanent upgrades from the tree</li>
            <li>Scouted skaters ({s.meta.unlockedSkaters.length}) and unlocked systems</li>
            <li>Empire HQ progress, achievements ({s.meta.achievements.length}), lifetime stats</li>
            <li>Settings</li>
          </ul>
        </div>
      </div>
      {pv.unlocks && (
        <div className="card paper">
          <h3>Unlocking now: {pv.unlocks.title}</h3>
          <ul className="small" style={{ margin: 0, paddingLeft: 18 }}>
            {pv.unlocks.items.map((i) => (
              <li key={i}>{i}</li>
            ))}
          </ul>
        </div>
      )}
      {pv.founderLevel > 0 && s.run.team.length > 0 && (
        <div className="card">
          <h3>Founding Skater (keeps {keepPct}% of training)</h3>
          <div className="pick">
            <button aria-pressed={founder === null} onClick={() => setFounder(null)}>
              Nobody
            </button>
            {s.run.team.map((t) => (
              <button key={t.id} aria-pressed={founder === t.id} onClick={() => setFounder(t.id)}>
                <Portrait id={t.id} size={22} /> {SKATER_BY_ID[t.id].name} (Lv {t.training} → {Math.floor((t.training * keepPct) / 100)})
              </button>
            ))}
          </div>
        </div>
      )}
      <div className="row">
        <button className="btn primary" onClick={() => onDo(founder)} style={{ minHeight: 46 }}>
          Retire this run — Legacy!
        </button>
        <button className="btn" onClick={onCancel}>
          Keep playing
        </button>
      </div>
    </div>
  );
}

function Tree() {
  const [s] = useGame();
  const act = useAct();
  const branches = Object.keys(BRANCH_INFO) as LegacyBranch[];
  return (
    <>
      <p className="small muted">
        Cred to spend: <b className="warn">{fmtNum(s.meta.cred)}</b>. Upgrades apply immediately; head-start upgrades (starting staff, contracts, seed money, fans) take effect from your next run.
        Costs rise per level, so mixing branches is usually stronger than maxing one.
      </p>
      {branches.map((b) => (
        <div key={b} style={{ marginBottom: 16 }}>
          <div className="section-title" style={{ color: BRANCH_INFO[b].color }}>
            {BRANCH_INFO[b].label.toUpperCase()}
          </div>
          <div className="tree">
            {LEGACY_NODES.filter((n) => n.branch === b).map((n) => {
              const lvl = s.meta.nodes[n.id] ?? 0;
              const lock = nodeLock(s, n.id);
              const maxed = lvl >= n.maxLevel;
              const cost = nodeCost(n.id, lvl);
              return (
                <div key={n.id} className={`node ${maxed ? 'maxed' : ''}`} style={{ borderTopColor: BRANCH_INFO[b].color, opacity: lock ? 0.55 : 1 }}>
                  <h4>
                    {n.name}{' '}
                    <span className="muted tiny">
                      {lvl}/{n.maxLevel === Infinity ? '∞' : n.maxLevel}
                    </span>
                  </h4>
                  <div className="tiny muted">{n.desc}</div>
                  <div className="small" style={{ margin: '4px 0' }}>
                    {n.show(lvl)}
                    {!maxed && <span className="good"> → {n.show(lvl + 1)}</span>}
                  </div>
                  {lock ? (
                    <button className="btn small" disabled>
                      {lock}
                    </button>
                  ) : maxed ? (
                    <button className="btn small" disabled>
                      Maxed
                    </button>
                  ) : (
                    <button className={`btn small ${s.meta.cred >= cost ? 'lime' : 'unaffordable'}`} onClick={() => s.meta.cred >= cost && act((x) => buyNode(x, n.id), 'unlock')} aria-disabled={s.meta.cred < cost}>
                      Buy <span className="price">{fmtNum(cost)} Cred</span>
                    </button>
                  )}
                </div>
              );
            })}
          </div>
        </div>
      ))}
    </>
  );
}

function Awards() {
  const [s] = useGame();
  return (
    <>
      <p className="small muted">Each achievement permanently adds +1% to all income. They persist through Legacy.</p>
      <div className="tree">
        {ACHIEVEMENTS.map((a) => {
          const got = s.meta.achievements.includes(a.id);
          return (
            <div key={a.id} className="node" style={{ borderTopColor: got ? 'var(--yellow)' : 'var(--line)', opacity: got ? 1 : 0.55 }}>
              <h4>
                {got ? '🏆' : '🔒'} {a.name}
              </h4>
              <div className="tiny muted">{a.desc}</div>
            </div>
          );
        })}
      </div>
    </>
  );
}

function Stats() {
  const [s] = useGame();
  const st = s.meta.stats;
  const r = s.run.stats;
  const rows: [string, string][] = [
    ['Total earned (all time)', fmtMoney(st.totalEarned)],
    ['Customers served (all time)', fmtNum(st.totalServes)],
    ['Time played', fmtTime(st.playTime)],
    ['Legacies', String(s.meta.legacyCount)],
    ['Best run earnings', fmtMoney(Math.max(st.bestRunEarnings, s.run.earnings))],
    ['Run durations', st.runDurations.length ? st.runDurations.map((x) => fmtTime(x)).join(', ') : '—'],
    ['Videos released', fmtNum(st.videosReleased)],
    ['Lines filmed / best score', `${fmtNum(st.minigameRuns)} / ${fmtNum(st.bestLineScore)}`],
    ['Perfect landings', fmtNum(st.perfectLandings)],
    ['Events hosted', fmtNum(st.eventsHosted)],
    ['Tours completed', fmtNum(st.toursDone)],
    ['Contest wins', fmtNum(st.contestWins)],
    ['Skaters signed', fmtNum(st.skatersSigned)],
    ['Opportunities completed', fmtNum(st.oppsCompleted)],
  ];
  const sum = r.manualEarned + r.passiveEarned + r.jobEarned + r.eventEarned + r.minigameEarned + r.oppEarned || 1;
  const src: [string, number][] = [
    ['Manual sales', r.manualEarned],
    ['Automated income', r.passiveEarned],
    ['Assignments', r.jobEarned],
    ['Events', r.eventEarned],
    ['Film a Line', r.minigameEarned],
    ['Opportunities', r.oppEarned],
  ];
  return (
    <div className="grid halves">
      <div className="card">
        <h2>Lifetime</h2>
        {rows.map(([k, v]) => (
          <div key={k} className="row between small">
            <span>{k}</span>
            <b className="num">{v}</b>
          </div>
        ))}
      </div>
      <div className="card">
        <h2>
          This run <Tip text="Where this run's money came from." />
        </h2>
        <div className="row between small">
          <span>Run time</span>
          <b>{fmtTime(s.run.time)}</b>
        </div>
        {src.map(([k, v]) => (
          <div key={k} className="row between small">
            <span>{k}</span>
            <span className="num">
              {fmtMoney(v)} <span className="muted">({Math.round((v / sum) * 100)}%)</span>
            </span>
          </div>
        ))}
      </div>
    </div>
  );
}
